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


def build_lookup(records):
    """Build a dict mapping record ID to fields."""
    return {r["id"]: r.get("fields", {}) for r in records}


VALID_STATUSES = {"Escaped", "Try again", "Completed", "Scheduled"}


def transform_room(room_fields, airtable_id, company_lookup, location_lookup):
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

    # companyUrl: prefer Location URL, fall back to Company URL
    loc_url = loc_fields.get("URL")
    comp_url = comp_fields.get("URL")
    entry["companyUrl"] = loc_url or comp_url or None

    entry["blogUrl"] = room_fields.get("Blog URL") or None

    # Tags (multi-select comes as a list)
    tags = room_fields.get("Tags")
    entry["tags"] = tags if isinstance(tags, list) else []

    entry["notes"] = room_fields.get("Notes") or None

    # Players (multi-select or linked records)
    players = room_fields.get("Players")
    entry["players"] = players if isinstance(players, list) else []

    # Optional fields — only include if present
    morty_id = room_fields.get("Morty ID")
    if morty_id:
        entry["mortyId"] = morty_id

    photo_path = room_fields.get("Photo Path")
    if photo_path:
        entry["photoUrl"] = photo_path

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
    entries = []
    warning_count = 0
    for record in rooms:
        fields = record.get("fields", {})
        entry, warnings, label = transform_room(fields, record["id"], company_lookup, location_lookup)
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
        ordered["players"] = entry.pop("players")
        # Remaining optional keys
        ordered.update(entry)
        ordered_entries.append(ordered)

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
