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


def build_name_lookup(records, field_name="Name"):
    """Build a dict mapping record ID to a display name field."""
    lookup = {}
    for record in records:
        name = record.get("fields", {}).get(field_name)
        if name:
            lookup[record["id"]] = name
    return lookup


def resolve_linked_names(linked_ids, name_lookup, warning_prefix):
    """Resolve linked record ids to names, preserving order."""
    names = []
    warnings = []

    if not isinstance(linked_ids, list):
        linked_ids = [linked_ids]

    for linked_id in linked_ids:
        name = name_lookup.get(linked_id)
        if name:
            names.append(name)
        else:
            warnings.append(f"{warning_prefix} record {linked_id} not found")

    return names, warnings


def normalize_numeric_rating(value):
    """Normalize an Airtable numeric rating to float or None."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_ratings_lookup(records):
    """Build a dict mapping room Airtable IDs to normalized rating records."""
    ratings_by_room = {}
    warnings = []

    for record in records:
        fields = record.get("fields", {})
        room_links = fields.get("Room") or []
        if not isinstance(room_links, list):
            room_links = [room_links]

        if len(room_links) != 1:
            warnings.append(f"Rating {record['id']} skipped: expected exactly one linked room")
            continue

        who = fields.get("Who")
        if not who:
            warnings.append(f"Rating {record['id']} skipped: missing Who")
            continue

        room_id = room_links[0]
        rating = {
            "_recordId": record["id"],
            "who": who,
            "rating": normalize_numeric_rating(fields.get("Rating")),
            "gameplay": fields.get("Gameplay") or None,
            "atmosphere": fields.get("Atmosphere") or None,
            "experience": fields.get("Experience") or None,
            "bestThings": bool(fields.get("Best Things")),
            "comments": fields.get("Comments") or None,
            "createdAt": fields.get("Created at") or None,
            "modifiedAt": fields.get("Modified at") or None,
        }

        room_bucket = ratings_by_room.setdefault(room_id, {})
        existing = room_bucket.get(who)
        if existing:
            existing_stamp = existing.get("modifiedAt") or existing.get("createdAt") or ""
            incoming_stamp = rating.get("modifiedAt") or rating.get("createdAt") or ""
            if incoming_stamp >= existing_stamp:
                warnings.append(
                    f'Rating duplicate for room {room_id} and "{who}": '
                    f'using {record["id"]} over {existing["_recordId"]}'
                )
                room_bucket[who] = rating
            else:
                warnings.append(
                    f'Rating duplicate for room {room_id} and "{who}": '
                    f'keeping {existing["_recordId"]} over {record["id"]}'
                )
            continue

        room_bucket[who] = rating

    return ratings_by_room, warnings


def attach_ratings(entry, ratings_lookup):
    """Attach sorted per-room ratings and summary data to a room entry."""
    room_ratings = list(ratings_lookup.get(entry["airtableId"], {}).values())
    room_ratings.sort(key=lambda r: (
        r["createdAt"] or "",
        r["who"].lower(),
    ))

    normalized = []
    for rating in room_ratings:
        normalized.append({
            "who": rating["who"],
            "rating": rating["rating"],
            "gameplay": rating["gameplay"],
            "atmosphere": rating["atmosphere"],
            "experience": rating["experience"],
            "bestThings": rating["bestThings"],
            "comments": rating["comments"],
            "createdAt": rating["createdAt"],
            "modifiedAt": rating["modifiedAt"],
        })

    numeric_ratings = [r["rating"] for r in normalized if r["rating"] is not None]
    average = None
    if numeric_ratings:
        average = round(sum(numeric_ratings) / len(numeric_ratings), 1)

    entry["ratings"] = normalized
    entry["ratingSummary"] = {
        "count": len(normalized),
        "average": average,
        "bestThingsCount": sum(1 for r in normalized if r["bestThings"]),
    }


VALID_STATUSES = {"Escaped", "Try again", "Completed", "Scheduled"}


def transform_room(
    room_fields,
    airtable_id,
    company_lookup,
    location_lookup,
    images_dir,
    awards_lookup,
    players_lookup,
):
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

    # Tags now come from the linked Awards table.
    tags, tag_warnings = resolve_linked_names(room_fields.get("Awards") or [], awards_lookup, "Award")
    entry["tags"] = tags
    warnings.extend(tag_warnings)

    entry["notes"] = room_fields.get("Notes") or None
    entry["commentary"] = room_fields.get("Commentary") or None

    # Players now come from the linked Players table.
    players, player_warnings = resolve_linked_names(
        room_fields.get("Players") or [],
        players_lookup,
        "Player",
    )
    entry["players"] = players
    warnings.extend(player_warnings)

    # Optional fields — only include if present
    morty_id = room_fields.get("Morty ID")
    if morty_id:
        entry["mortyId"] = morty_id

    team_photo = room_fields.get("Team Photo")
    if team_photo and isinstance(team_photo, list) and team_photo:
        downloaded = download_team_photo(team_photo[0], airtable_id, images_dir)
        if downloaded:
            entry["photo"] = downloaded

    if "photo" not in entry:
        photo = room_fields.get("Photo")
        if photo:
            entry["photo"] = photo

    return entry, warnings, label


def sort_order_value(entry):
    """Return the sort value for same-day room ordering."""
    value = entry.get("sortOrder")
    if value is None:
        return float("inf")
    try:
        return float(value)
    except (TypeError, ValueError):
        return float("inf")


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

    print("Fetching Awards...")
    awards = fetch_all_records(base_id, "Awards", token)
    print(f"  {len(awards)} awards")

    print("Fetching Players...")
    players = fetch_all_records(base_id, "Players", token)
    print(f"  {len(players)} players")

    print("Fetching Rooms...")
    rooms = fetch_all_records(base_id, "Rooms", token)
    print(f"  {len(rooms)} rooms")

    print("Fetching Experiences...")
    ratings = fetch_all_records(base_id, "Experiences", token)
    print(f"  {len(ratings)} experiences")

    company_lookup = build_lookup(companies)
    location_lookup = build_lookup(locations)
    awards_lookup = build_name_lookup(awards)
    players_lookup = build_name_lookup(players)
    ratings_lookup, ratings_warnings = build_ratings_lookup(ratings)

    # Transform all rooms
    images_dir = os.path.join(os.path.dirname(__file__), "..", "src", "images", "rooms")
    entries = []
    hidden_count = 0
    warning_count = 0
    for index, record in enumerate(rooms):
        fields = record.get("fields", {})
        if fields.get("Hide"):
            hidden_count += 1
            continue
        entry, warnings, label = transform_room(
            fields,
            record["id"],
            company_lookup,
            location_lookup,
            images_dir,
            awards_lookup,
            players_lookup,
        )
        entry["airtableId"] = record["id"]
        entry["sortOrder"] = fields.get("Order")
        entry["_sourceIndex"] = index
        entries.append(entry)
        if warnings:
            warning_count += len(warnings)
            print(f"\n  ⚠ {label}")
            for w in warnings:
                print(f"    - {w}")

    # Sort by date ascending, Airtable Order for same-day rooms, then source order for ties.
    entries.sort(key=lambda r: (
        r.get("date") or "9999-99-99",
        sort_order_value(r),
        r["_sourceIndex"],
    ))

    # Assign sequential IDs
    for i, entry in enumerate(entries, start=1):
        entry["id"] = i
        attach_ratings(entry, ratings_lookup)

    if ratings_warnings:
        warning_count += len(ratings_warnings)
        for warning in ratings_warnings:
            print(f"\n  ⚠ {warning}")

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
        ordered["ratings"] = entry.pop("ratings")
        ordered["ratingSummary"] = entry.pop("ratingSummary")
        # Remaining optional keys
        entry.pop("sortOrder", None)
        entry.pop("_sourceIndex", None)
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
    if hidden_count:
        print(f"Skipped {hidden_count} hidden room(s)")
    if warning_count:
        print(f"⚠ {warning_count} data warning(s) — review above for details")


if __name__ == "__main__":
    main()
