#!/usr/bin/env python3
"""Populate Airtable Team Photo attachments from existing room image files.

This is a one-time migration helper. By default it runs in dry-run mode and
prints the records that would be updated. Pass --apply to perform Airtable
writes.

The write path uses Airtable's documented attachment-ingest flow by setting the
attachment field to a publicly reachable image URL. Since the site's room
images are already published, Airtable can fetch and persist those files into
the Team Photo attachment field.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


API_BASE = "https://api.airtable.com/v0"
IMAGE_DIR = Path(__file__).resolve().parent.parent / "src" / "images" / "rooms"
DEFAULT_IMAGE_BASE_URL = "https://escape.thingelstad.com/images/rooms"
TEAM_PHOTO_FIELD = "Team Photo"
ROOMS_TABLE = "Rooms"
POLL_INTERVAL_SECONDS = 2
POLL_ATTEMPTS = 15


def load_env_file():
    """Load .env file from project root if present."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def airtable_request(url, token, method="GET", payload=None):
    """Send a JSON request to Airtable and return the parsed response."""
    headers = {"Authorization": f"Bearer {token}"}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{e.code} {raw}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(str(e)) from e

    if not raw:
        return {}
    return json.loads(raw)


def build_table_url(base_id, table_name, params=None):
    """Build a table URL with optional query params."""
    url = f"{API_BASE}/{base_id}/{urllib.parse.quote(table_name)}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    return url


def fetch_all_room_records(base_id, token):
    """Fetch room records with only the fields needed for migration."""
    records = []
    offset = None
    params = [
        ("fields[]", "Game"),
        ("fields[]", "Photo"),
        ("fields[]", TEAM_PHOTO_FIELD),
        ("fields[]", "Hide"),
    ]

    while True:
        req_params = list(params)
        if offset:
            req_params.append(("offset", offset))
        url = build_table_url(base_id, ROOMS_TABLE, req_params)
        data = airtable_request(url, token)
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break

    return records


def fetch_room_record(base_id, token, record_id):
    """Fetch a single room record."""
    url = f"{build_table_url(base_id, ROOMS_TABLE)}/{record_id}"
    return airtable_request(url, token)


def normalize_record_args(values):
    """Flatten repeated --record args into a set of record ids."""
    if not values:
        return set()
    flattened = []
    for group in values:
        flattened.extend(group)
    return set(flattened)


def build_public_image_url(base_url, filename):
    """Build the public image URL Airtable will ingest."""
    return f"{base_url.rstrip('/')}/{urllib.parse.quote(filename)}"


def build_candidates(records, requested_ids):
    """Split records into migration candidates and skip buckets."""
    scoped_records = [r for r in records if not requested_ids or r["id"] in requested_ids]

    counts = {
        "total_scanned": len(scoped_records),
        "candidates": 0,
        "skipped_existing_team_photo": 0,
        "skipped_missing_file": 0,
        "skipped_no_photo": 0,
        "succeeded": 0,
        "failed": 0,
    }
    missing = []
    candidates = []

    for record in scoped_records:
        fields = record.get("fields", {})
        game = fields.get("Game", "")
        photo = fields.get("Photo")
        team_photo = fields.get(TEAM_PHOTO_FIELD)
        local_path = IMAGE_DIR / photo if photo else None

        if isinstance(team_photo, list) and team_photo:
            counts["skipped_existing_team_photo"] += 1
            continue

        if not photo:
            counts["skipped_no_photo"] += 1
            continue

        if not local_path or not local_path.is_file():
            counts["skipped_missing_file"] += 1
            missing.append({
                "id": record["id"],
                "game": game,
                "photo": photo,
            })
            continue

        candidate = {
            "id": record["id"],
            "game": game,
            "photo": photo,
            "hide": bool(fields.get("Hide")),
            "local_path": str(local_path),
        }
        candidates.append(candidate)

    counts["candidates"] = len(candidates)
    return candidates, missing, counts


def update_team_photo(base_id, token, record_id, image_url, filename):
    """Ask Airtable to ingest an image into the Team Photo field."""
    payload = {
        "fields": {
            TEAM_PHOTO_FIELD: [{
                "url": image_url,
                "filename": filename,
            }]
        }
    }
    url = f"{build_table_url(base_id, ROOMS_TABLE)}/{record_id}"
    return airtable_request(url, token, method="PATCH", payload=payload)


def wait_for_team_photo(base_id, token, record_id):
    """Poll Airtable until Team Photo appears or we time out."""
    for _ in range(POLL_ATTEMPTS):
        record = fetch_room_record(base_id, token, record_id)
        team_photo = record.get("fields", {}).get(TEAM_PHOTO_FIELD)
        if isinstance(team_photo, list) and team_photo:
            return record
        time.sleep(POLL_INTERVAL_SECONDS)
    return None


def print_summary(counts):
    """Print a compact summary."""
    print("\nSummary:")
    print(f"  scanned: {counts['total_scanned']}")
    print(f"  candidates: {counts['candidates']}")
    print(f"  skipped existing Team Photo: {counts['skipped_existing_team_photo']}")
    print(f"  skipped missing local file: {counts['skipped_missing_file']}")
    print(f"  skipped no Photo field: {counts['skipped_no_photo']}")
    print(f"  succeeded: {counts['succeeded']}")
    print(f"  failed: {counts['failed']}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Populate Airtable Team Photo attachments from existing room images."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform Airtable writes. Default is dry-run.",
    )
    parser.add_argument(
        "--record",
        action="append",
        nargs="+",
        metavar="REC_ID",
        help="Limit processing to one or more Airtable record ids.",
    )
    parser.add_argument(
        "--image-base-url",
        default=DEFAULT_IMAGE_BASE_URL,
        help=f"Public base URL where room images are reachable. Default: {DEFAULT_IMAGE_BASE_URL}",
    )
    return parser.parse_args()


def main():
    load_env_file()
    args = parse_args()

    token = os.environ.get("AIRTABLE_PAT")
    base_id = os.environ.get("AIRTABLE_BASE_ID")
    if not token or not base_id:
        print("Error: AIRTABLE_PAT and AIRTABLE_BASE_ID env vars are required.", file=sys.stderr)
        sys.exit(1)

    requested_ids = normalize_record_args(args.record)

    print("Fetching Airtable room records...")
    try:
        records = fetch_all_room_records(base_id, token)
    except RuntimeError as e:
        print(f"Error fetching room records: {e}", file=sys.stderr)
        sys.exit(1)

    candidates, missing, counts = build_candidates(records, requested_ids)

    if requested_ids:
        not_found = sorted(requested_ids - {r["id"] for r in records})
        if not_found:
            print("Warning: requested record ids not found:")
            for rec_id in not_found:
                print(f"  - {rec_id}")

    mode_label = "APPLY" if args.apply else "DRY-RUN"
    print(f"\nMode: {mode_label}")
    print(f"Image base URL: {args.image_base_url}")

    if missing:
        print("\nMissing local files:")
        for item in missing:
            print(f"  - {item['id']} | {item['game']} | {item['photo']}")

    if not candidates:
        print("\nNo migration candidates found.")
        print_summary(counts)
        return

    if not args.apply:
        print("\nCandidates:")
        for item in candidates:
            hidden_suffix = " [hidden]" if item["hide"] else ""
            print(f"  - {item['id']} | {item['game']} | {item['photo']}{hidden_suffix}")
        print_summary(counts)
        return

    print("\nApplying migration:")
    for item in candidates:
        image_url = build_public_image_url(args.image_base_url, item["photo"])
        try:
            update_team_photo(base_id, token, item["id"], image_url, item["photo"])
            confirmed = wait_for_team_photo(base_id, token, item["id"])
            if confirmed is None:
                counts["failed"] += 1
                print(f"  FAIL {item['id']} | {item['game']} | timed out waiting for Team Photo")
                continue
            counts["succeeded"] += 1
            print(f"  OK   {item['id']} | {item['game']} | {item['photo']}")
        except RuntimeError as e:
            counts["failed"] += 1
            print(f"  FAIL {item['id']} | {item['game']} | {e}")

    print_summary(counts)


if __name__ == "__main__":
    main()
