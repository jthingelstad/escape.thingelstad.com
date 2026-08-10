#!/usr/bin/env python3
"""Sync Airtable data into raw JSON snapshots under src/_data/airtable/.

Requires env vars:
  AIRTABLE_PAT       - Airtable Personal Access Token
  AIRTABLE_BASE_ID   - Airtable Base ID (starts with "app")

Usage:
  python3 scripts/sync_airtable.py

Reads from .env file in the project root if present.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(ROOT_DIR, "src", "_data", "airtable")
IMAGES_DIR = os.path.join(ROOT_DIR, "src", "images", "rooms")
API_BASE = "https://api.airtable.com/v0"
TABLES = {
    "companies": "Companies",
    "locations": "Locations",
    "themes": "Themes",
    "players": "Players",
    "awards": "Awards",
    "trips": "Trips",
    "lists": "Lists",
    "listItems": "List Items",
    "rooms": "Rooms",
    "experiences": "Experiences",
}
MAX_PHOTO_DIMENSION = 1600
PUBLIC_ROOM_STATUSES = {"Escaped", "Try again", "Completed", "Scheduled"}


def load_dotenv():
    env_path = os.path.join(ROOT_DIR, ".env")
    if not os.path.isfile(env_path):
        return

    with open(env_path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def fetch_all_records(base_id, table_name, token):
    """Fetch all records from an Airtable table, handling pagination."""
    records = []
    url = f"{API_BASE}/{base_id}/{urllib.request.quote(table_name)}"
    offset = None

    while True:
        req_url = url
        if offset:
            req_url += f"?offset={offset}"

        req = urllib.request.Request(
            req_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            print(f"Error fetching {table_name}: {exc.code} {body}", file=sys.stderr)
            sys.exit(1)

        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break

    return records


def resize_photo(path):
    """Resize a photo so its longest side is at most MAX_PHOTO_DIMENSION pixels."""
    from PIL import Image

    with Image.open(path) as img:
        width, height = img.size
        if max(width, height) <= MAX_PHOTO_DIMENSION:
            return

        if width >= height:
            new_width = MAX_PHOTO_DIMENSION
            new_height = int(height * MAX_PHOTO_DIMENSION / width)
        else:
            new_height = MAX_PHOTO_DIMENSION
            new_width = int(width * MAX_PHOTO_DIMENSION / height)

        resized = img.resize((new_width, new_height), Image.LANCZOS)
        resized.save(path, quality=85)
        print(f"  Resized {os.path.basename(path)}: {width}x{height} -> {new_width}x{new_height}")


def download_team_photo(attachment, airtable_id):
    """Download a Team Photo attachment from Airtable if needed."""
    ext = os.path.splitext(attachment.get("filename", "photo.jpg"))[1] or ".jpg"
    filename = f"team_{airtable_id}{ext}"
    dest = os.path.join(IMAGES_DIR, filename)

    if os.path.isfile(dest):
        return filename

    url = attachment.get("url")
    if not url:
        print(f"  Warning: Team Photo for {airtable_id} has no URL", file=sys.stderr)
        return None

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            with open(dest, "wb") as handle:
                handle.write(resp.read())
        print(f"  Downloaded team photo: {filename}")
        resize_photo(dest)
        return filename
    except (urllib.error.URLError, OSError) as exc:
        print(
            f"  Warning: Failed to download team photo for {airtable_id}: {exc}",
            file=sys.stderr,
        )
        return None


def normalize_room_assets(records):
    """Ensure team photos are available locally for room records."""
    for record in records:
        airtable_id = record["id"]
        fields = record.get("fields", {})
        attachments = fields.get("Team Photo")
        if attachments and isinstance(attachments, list) and attachments:
            download_team_photo(attachments[0], airtable_id)


def validate_room_records(room_records, location_records):
    """Fail before writing snapshots when a public room would build incorrectly."""
    location_ids = {record["id"] for record in location_records}
    seen_room_ids = {}
    rooms_by_date = {}
    errors = []

    for record in room_records:
        fields = record.get("fields", {})
        if fields.get("Hide"):
            continue

        airtable_id = record["id"]
        game = fields.get("Game")
        label = game or airtable_id
        room_id = fields.get("Room ID")

        if room_id is not None:
            if (
                isinstance(room_id, bool)
                or not isinstance(room_id, (int, float))
                or not float(room_id).is_integer()
                or room_id <= 0
            ):
                errors.append(f"{airtable_id} ({label}) has an invalid legacy Room ID")
                room_id = None

        if room_id is not None:
            room_id = int(room_id)
            if room_id in seen_room_ids:
                errors.append(
                    f"Legacy Room ID {room_id} is duplicated by {airtable_id} ({label}) "
                    f"and {seen_room_ids[room_id]}"
                )
            else:
                seen_room_ids[room_id] = airtable_id

        if not isinstance(game, str) or not game.strip():
            errors.append(f"{airtable_id} must have a Game name")

        when = fields.get("When")
        try:
            parsed_when = datetime.strptime(when, "%Y-%m-%d")
            if parsed_when.strftime("%Y-%m-%d") != when:
                raise ValueError
            rooms_by_date.setdefault(when, []).append(record)
        except TypeError, ValueError:
            errors.append(f"{airtable_id} ({label}) must have a valid When date")

        status = fields.get("Status")
        if status not in PUBLIC_ROOM_STATUSES:
            errors.append(f"{airtable_id} ({label}) has unsupported Status {status!r}")

        locations = fields.get("Location")
        if (
            not isinstance(locations, list)
            or len(locations) != 1
            or locations[0] not in location_ids
        ):
            errors.append(f"{airtable_id} ({label}) must link to exactly one valid Location")

    for when, same_day_rooms in rooms_by_date.items():
        if len(same_day_rooms) < 2:
            continue
        seen_orders = {}
        for record in same_day_rooms:
            fields = record.get("fields", {})
            order = fields.get("Order")
            airtable_id = record["id"]
            label = fields.get("Game") or airtable_id
            if (
                isinstance(order, bool)
                or not isinstance(order, (int, float))
                or not float(order).is_integer()
                or order <= 0
            ):
                errors.append(
                    f"{airtable_id} ({label}) must have a positive integer Order "
                    f"because {when} has multiple rooms"
                )
                continue
            order = int(order)
            if order in seen_orders:
                errors.append(
                    f"Room Order {order} is duplicated on {when} by {airtable_id} "
                    f"and {seen_orders[order]}"
                )
            else:
                seen_orders[order] = airtable_id

    if errors:
        details = "\n".join(f"  - {error}" for error in errors)
        raise ValueError(f"Airtable room validation failed:\n{details}")


def write_snapshot(name, table_name, records):
    """Write a raw Airtable snapshot for one table."""
    os.makedirs(DATA_DIR, exist_ok=True)
    output_path = os.path.join(DATA_DIR, f"{name}.json")
    payload = {
        "table": table_name,
        "syncedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(records),
        "records": records,
    }

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"  Wrote {len(records)} records -> {output_path}")


def main():
    load_dotenv()

    token = os.environ.get("AIRTABLE_PAT")
    base_id = os.environ.get("AIRTABLE_BASE_ID")
    if not token or not base_id:
        print("Error: AIRTABLE_PAT and AIRTABLE_BASE_ID env vars are required.", file=sys.stderr)
        sys.exit(1)

    snapshots = {}
    for output_name, table_name in TABLES.items():
        print(f"Fetching {table_name}...")
        records = fetch_all_records(base_id, table_name, token)
        print(f"  {len(records)} records")
        snapshots[output_name] = records

    try:
        validate_room_records(snapshots["rooms"], snapshots["locations"])
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print("Syncing local team photos...")
    normalize_room_assets(snapshots["rooms"])

    print("Writing snapshots...")
    for output_name, table_name in TABLES.items():
        write_snapshot(output_name, table_name, snapshots[output_name])


if __name__ == "__main__":
    main()
