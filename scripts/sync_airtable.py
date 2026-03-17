#!/usr/bin/env python3
"""Sync escape room data from Airtable to src/_data/rooms.json.

Requires env vars:
  AIRTABLE_PAT       — Airtable Personal Access Token
  AIRTABLE_BASE_ID   — Airtable Base ID (starts with "app")

Usage:
  python3 scripts/sync_airtable.py

Reads from .env file in the project root if present.
"""

import json
import os
import sys
import urllib.request
import urllib.error

# Load .env file from project root if it exists
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.isfile(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line or _line.startswith("#"):
                continue
            if "=" in _line:
                _key, _, _value = _line.partition("=")
                _key = _key.strip()
                _value = _value.strip().strip("'\"")
                os.environ.setdefault(_key, _value)

API_BASE = "https://api.airtable.com/v0"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "_data", "rooms.json")


def fetch_all_records(base_id, table_name, token):
    """Fetch all records from an Airtable table, handling pagination."""
    records = []
    url = f"{API_BASE}/{base_id}/{urllib.request.quote(table_name)}"
    offset = None

    while True:
        req_url = url
        if offset:
            req_url += f"?offset={offset}"

        req = urllib.request.Request(req_url, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        })

        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"Error fetching {table_name}: {e.code} {body}", file=sys.stderr)
            sys.exit(1)

        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break

    return records


MAX_PHOTO_DIMENSION = 1600


def resize_photo(path):
    """Resize a photo so its longest side is at most MAX_PHOTO_DIMENSION pixels.

    Requires Pillow. Skips if the image is already within bounds.
    """
    from PIL import Image

    with Image.open(path) as img:
        w, h = img.size
        if max(w, h) <= MAX_PHOTO_DIMENSION:
            return
        if w >= h:
            new_w = MAX_PHOTO_DIMENSION
            new_h = int(h * MAX_PHOTO_DIMENSION / w)
        else:
            new_h = MAX_PHOTO_DIMENSION
            new_w = int(w * MAX_PHOTO_DIMENSION / h)
        resized = img.resize((new_w, new_h), Image.LANCZOS)
        resized.save(path, quality=85)
        print(f"  Resized {os.path.basename(path)}: {w}x{h} → {new_w}x{new_h}")


def download_team_photo(attachment, airtable_id, images_dir):
    """Download a Team Photo attachment from Airtable.

    Returns the filename (e.g. 'team_recXXX.jpg') on success, or None on failure.
    Skips download if the file already exists on disk.
    """
    ext = os.path.splitext(attachment.get("filename", "photo.jpg"))[1] or ".jpg"
    filename = f"team_{airtable_id}{ext}"
    dest = os.path.join(images_dir, filename)

    if os.path.isfile(dest):
        return filename

    url = attachment.get("url")
    if not url:
        print(f"  Warning: Team Photo for {airtable_id} has no URL", file=sys.stderr)
        return None

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            with open(dest, "wb") as f:
                f.write(resp.read())
        print(f"  Downloaded team photo: {filename}")
        resize_photo(dest)
        return filename
    except (urllib.error.URLError, OSError) as e:
        print(f"  Warning: Failed to download team photo for {airtable_id}: {e}", file=sys.stderr)
        return None


def build_lookup(records):
    """Build a dict mapping record ID to fields."""
    return {r["id"]: r.get("fields", {}) for r in records}


VALID_STATUSES = {"Escaped", "Try again", "Completed", "Scheduled"}


def transform_room(room_fields, airtable_id, company_lookup, location_lookup, images_dir):
    """Transform an Airtable Room record into a rooms.json entry.

    Returns (entry, warnings) where warnings is a list of strings.
    """
    entry = {}
    warnings = []

    game = room_fields.get("Game", "")
    entry["game"] = game
    date = room_fields.get("When") or None
    entry["date"] = date
    status = room_fields.get("Status", "Completed")
    entry["status"] = status
    time_left = room_fields.get("Time Left")
    entry["timeLeft"] = float(time_left) if time_left is not None else None

    # Room label for warning messages
    label = f"\"{game}\"" if game else f"[{airtable_id}]"
    if date:
        label += f" ({date})"

    if not game:
        warnings.append("Missing game name")
    if not date:
        warnings.append("Missing date")
    if status not in VALID_STATUSES:
        warnings.append(f"Unexpected status \"{status}\"")

    # Resolve Location -> Company chain
    location_ids = room_fields.get("Location", [])
    loc_fields = {}
    comp_fields = {}

    if location_ids:
        loc_id = location_ids[0] if isinstance(location_ids, list) else location_ids
        loc_fields = location_lookup.get(loc_id, {})

        if not loc_fields:
            warnings.append(f"Location record {loc_id} not found")

        company_ids = loc_fields.get("Company", [])
        if company_ids:
            comp_id = company_ids[0] if isinstance(company_ids, list) else company_ids
            comp_fields = company_lookup.get(comp_id, {})
            if not comp_fields:
                warnings.append(f"Company record {comp_id} not found")
        else:
            warnings.append("Location has no linked company")
    else:
        warnings.append("No location linked")

    entry["company"] = comp_fields.get("Company", "")

    # Location object
    location = {}
    city = loc_fields.get("City")
    if city:
        location["city"] = city
    region = loc_fields.get("Region")
    if region:
        location["region"] = region
    country = loc_fields.get("Country")
    if country:
        location["country"] = country
    else:
        if loc_fields:
            warnings.append("Location missing country")

    coords = loc_fields.get("Coordinates")
    if coords:
        parts = [p.strip() for p in coords.split(",")]
        if len(parts) == 2 and parts[0] and parts[1]:
            try:
                location["lat"] = float(parts[0])
                location["lng"] = float(parts[1])
            except ValueError:
                warnings.append(f"Malformed coordinates \"{coords}\"")
                location["lat"] = None
                location["lng"] = None
        else:
            warnings.append(f"Malformed coordinates \"{coords}\"")
            location["lat"] = None
            location["lng"] = None
    else:
        location["lat"] = None
        location["lng"] = None
    entry["location"] = location

    # companyUrl: Room URL > Location URL > Company URL
    room_url = room_fields.get("Room URL")
    loc_url = loc_fields.get("Location URL")
    comp_url = comp_fields.get("Company URL")
    entry["companyUrl"] = room_url or loc_url or comp_url or None

    entry["blogUrl"] = room_fields.get("thingelstad.com URL") or None

    # Tags (multi-select comes as a list)
    tags = room_fields.get("Tags")
    entry["tags"] = tags if isinstance(tags, list) else []

    entry["notes"] = room_fields.get("Notes") or None
    entry["commentary"] = room_fields.get("Commentary") or None

    # Players (multi-select or linked records)
    players = room_fields.get("Players")
    entry["players"] = players if isinstance(players, list) else []

    # Optional fields — only include if present
    morty_id = room_fields.get("Morty ID")
    if morty_id:
        entry["mortyId"] = morty_id

    photo = room_fields.get("Photo")
    if photo:
        entry["photo"] = photo
    else:
        team_photo = room_fields.get("Team Photo")
        if team_photo and isinstance(team_photo, list) and team_photo:
            downloaded = download_team_photo(team_photo[0], airtable_id, images_dir)
            if downloaded:
                entry["photo"] = downloaded

    return entry, warnings, label


def main():
    token = os.environ.get("AIRTABLE_PAT")
    base_id = os.environ.get("AIRTABLE_BASE_ID")

    if not token or not base_id:
        print("Error: AIRTABLE_PAT and AIRTABLE_BASE_ID env vars are required.", file=sys.stderr)
        sys.exit(1)

    print("Fetching Companies...")
    companies = fetch_all_records(base_id, "Companies", token)
    print(f"  {len(companies)} companies")

    print("Fetching Locations...")
    locations = fetch_all_records(base_id, "Locations", token)
    print(f"  {len(locations)} locations")

    print("Fetching Rooms...")
    rooms = fetch_all_records(base_id, "Rooms", token)
    print(f"  {len(rooms)} rooms")

    company_lookup = build_lookup(companies)
    location_lookup = build_lookup(locations)

    # Transform all rooms
    images_dir = os.path.join(os.path.dirname(__file__), "..", "src", "images", "rooms")
    entries = []
    warning_count = 0
    for record in rooms:
        fields = record.get("fields", {})
        entry, warnings, label = transform_room(fields, record["id"], company_lookup, location_lookup, images_dir)
        entry["airtableId"] = record["id"]
        entries.append(entry)
        if warnings:
            warning_count += len(warnings)
            print(f"\n  ⚠ {label}")
            for w in warnings:
                print(f"    - {w}")

    # Sort by date ascending, then by Airtable creation order for ties
    entries.sort(key=lambda r: r.get("date") or "9999-99-99")

    # Assign sequential IDs
    for i, entry in enumerate(entries, start=1):
        entry["id"] = i

    # Reorder keys for readability: id first, then the rest
    ordered_entries = []
    for entry in entries:
        ordered = {"id": entry.pop("id")}
        ordered["airtableId"] = entry.pop("airtableId")
        ordered["game"] = entry.pop("game")
        ordered["company"] = entry.pop("company")
        ordered["date"] = entry.pop("date")
        ordered["status"] = entry.pop("status")
        ordered["timeLeft"] = entry.pop("timeLeft")
        ordered["location"] = entry.pop("location")
        ordered["companyUrl"] = entry.pop("companyUrl")
        ordered["blogUrl"] = entry.pop("blogUrl")
        ordered["tags"] = entry.pop("tags")
        ordered["notes"] = entry.pop("notes")
        ordered["commentary"] = entry.pop("commentary")
        ordered["players"] = entry.pop("players")
        # Remaining optional keys
        ordered.update(entry)
        ordered_entries.append(ordered)

    # Validate that photo files exist on disk
    missing_photos = []
    for entry in ordered_entries:
        photo = entry.get("photo")
        if photo:
            photo_path = os.path.join(images_dir, photo)
            if not os.path.isfile(photo_path):
                missing_photos.append(f"  #{entry['id']} \"{entry['game']}\": {photo}")
    if missing_photos:
        print(f"\n✗ {len(missing_photos)} missing photo file(s):", file=sys.stderr)
        for m in missing_photos:
            print(m, file=sys.stderr)
        sys.exit(1)

    output = {"rooms": ordered_entries}
    output_path = os.path.normpath(OUTPUT_PATH)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nWrote {len(ordered_entries)} rooms to {output_path}")
    if warning_count:
        print(f"⚠ {warning_count} data warning(s) — review above for details")


if __name__ == "__main__":
    main()
