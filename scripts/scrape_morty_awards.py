#!/usr/bin/env python3
"""Scrape award data from Morty attraction pages and link to Airtable awards.

Fetches each room's Morty page, extracts the awards from the embedded Next.js
JSON payload, and matches them against existing Airtable award records.

Scraping is slow (~5 min), so results are cached locally. Use --scrape to
refresh the cache from Morty. Subsequent runs reuse the cache automatically.

By default runs in dry-run mode. Pass --apply to update Airtable.

Requires env vars (for --apply only):
  AIRTABLE_PAT       - Airtable Personal Access Token
  AIRTABLE_BASE_ID   - Airtable Base ID (starts with "app")

Usage:
  python3 scripts/scrape_morty_awards.py --scrape    # fetch fresh data from Morty
  python3 scripts/scrape_morty_awards.py             # dry-run using cached data
  python3 scripts/scrape_morty_awards.py --apply     # write to Airtable using cached data
  python3 scripts/scrape_morty_awards.py --scrape --apply  # scrape + apply in one step
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "src" / "_data" / "airtable"
CACHE_FILE = ROOT_DIR / "morty_awards_cache.json"
API_BASE = "https://api.airtable.com/v0"
MORTY_BASE = "https://morty.app/attraction"
FETCH_DELAY_SECONDS = 0.5
AWARDS_TABLE = "Awards"


def load_env_file():
    """Load .env file from project root if present."""
    env_path = ROOT_DIR / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def load_local_data():
    """Load rooms and awards from local Airtable snapshots."""
    rooms_path = DATA_DIR / "rooms.json"
    awards_path = DATA_DIR / "awards.json"

    with open(rooms_path, encoding="utf-8") as f:
        rooms_data = json.load(f)
    with open(awards_path, encoding="utf-8") as f:
        awards_data = json.load(f)

    return rooms_data["records"], awards_data["records"]


def build_award_lookup(award_records):
    """Build lookup from (organization, award_name, year) -> award record.

    Also returns the set of known organization names (lowercase) so that
    awards from unrecognized organizations can be flagged separately.
    """
    lookup = {}
    known_orgs = set()
    for record in award_records:
        fields = record.get("fields", {})
        org = fields.get("Organization", "")
        award_name = fields.get("Award Name", "")
        year = fields.get("Year")
        if org:
            known_orgs.add(org.lower())
        if org and year:
            key = (org.lower(), award_name.lower(), int(year))
            lookup[key] = record
    return lookup, known_orgs


def parse_display_title(display_title):
    """Parse a Morty displayTitle into (award_name, year).

    Formats:
      "Finalist (2024)"               -> ("Finalist", 2024)
      "Best of Morty (2025)"          -> ("Best of Morty", 2025)
      "#63 - Top Rooms (2023)"        -> ("Top Rooms", 2023)
      "Nominee - Best Original Room (2020)" -> ("Best Original Room", 2020)
      "Nominee (2025)"                -> ("Nominee", 2025)
    """
    # Extract year from the end
    year_match = re.search(r"\((\d{4})\)\s*$", display_title)
    if not year_match:
        return display_title.strip(), None

    year = int(year_match.group(1))
    name_part = display_title[: year_match.start()].strip()

    # Strip leading rank: "#63 - "
    name_part = re.sub(r"^#\d+\s*-\s*", "", name_part)

    # Handle "Nominee - Best Original Room" -> keep just "Best Original Room"
    # But NOT "Best of Morty" (no dash pattern that looks like prefix)
    prefix_match = re.match(r"^(Nominee|Finalist|Winner)\s*-\s*(.+)$", name_part, re.IGNORECASE)
    if prefix_match:
        name_part = prefix_match.group(2).strip()

    return name_part, year


class _RedirectHandler(urllib.request.HTTPRedirectHandler):
    """Follow redirects including 308 with relative Location headers."""

    def http_error_308(self, req, fp, code, msg, headers):
        location = headers.get("Location", "")
        if location.startswith("/"):
            location = f"https://morty.app{location}"
        newreq = urllib.request.Request(location, headers=dict(req.header_items()))
        return self.parent.open(newreq, timeout=15)


_opener = urllib.request.build_opener(_RedirectHandler)


def fetch_morty_page(morty_id):
    """Fetch a Morty attraction page and extract the awards from JSON payload."""
    url = f"{MORTY_BASE}/{morty_id}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "EscapingThings-AwardScraper/1.0",
    })

    try:
        with _opener.open(req, timeout=15) as resp:
            page_html = resp.read().decode("utf-8")
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        return None, str(e)

    # Extract Next.js JSON payload from <script> tag
    # Next.js embeds data in: <script id="__NEXT_DATA__" type="application/json">
    pattern = r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>'
    match = re.search(pattern, page_html, re.DOTALL)
    if not match:
        return None, "Could not find __NEXT_DATA__ script tag"

    try:
        raw_json = html.unescape(match.group(1))
        data = json.loads(raw_json)
    except (json.JSONDecodeError, ValueError) as e:
        return None, f"Failed to parse JSON: {e}"

    # Navigate to the awards array
    try:
        awards = data["props"]["pageProps"]["game"]["awards"]
    except (KeyError, TypeError):
        return [], None

    parsed = []
    for award in awards:
        display_title = award.get("displayTitle", "")
        source = award.get("category", {}).get("source", {})
        organization = source.get("awardName", "")
        award_url = award.get("coarseUrl", "")
        award_name, year = parse_display_title(display_title)

        parsed.append({
            "organization": organization,
            "award_name": award_name,
            "year": year,
            "award_link": award_url,
            "display_title": display_title,
        })

    return parsed, None


def save_cache(morty_awards, errors):
    """Save scraped Morty awards to a local cache file."""
    # Convert for JSON serialization (morty_id keys are ints)
    data = {
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "awards": {str(k): v for k, v in morty_awards.items()},
        "errors": [{"morty_id": m, "game": g, "error": e} for m, g, e in errors],
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"\nCache saved to {CACHE_FILE.name} ({len(morty_awards)} rooms)", flush=True)


def load_cache():
    """Load previously scraped Morty awards from cache. Returns (morty_awards, errors, scraped_at) or None."""
    if not CACHE_FILE.is_file():
        return None
    with open(CACHE_FILE, encoding="utf-8") as f:
        data = json.load(f)
    morty_awards = {int(k): v for k, v in data["awards"].items()}
    errors = [(e["morty_id"], e["game"], e["error"]) for e in data.get("errors", [])]
    return morty_awards, errors, data.get("scraped_at", "unknown")


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


def update_award_rooms(base_id, token, award_record_id, room_ids):
    """PATCH an award record to set its linked Rooms field."""
    url = f"{API_BASE}/{base_id}/{urllib.parse.quote(AWARDS_TABLE)}/{award_record_id}"
    payload = {"fields": {"Rooms": room_ids}}
    return airtable_request(url, token, method="PATCH", payload=payload)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Scrape Morty award data and link to Airtable awards."
    )
    parser.add_argument(
        "--scrape",
        action="store_true",
        help="Fetch fresh data from Morty (slow). Without this, uses cached data.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to Airtable. Default is dry-run.",
    )
    parser.add_argument(
        "--room",
        action="append",
        nargs="+",
        metavar="MORTY_ID",
        help="Limit to specific Morty IDs (e.g., --room 6656 25957).",
    )
    return parser.parse_args()


def main():
    load_env_file()
    args = parse_args()

    # Flatten --room args
    requested_morty_ids = set()
    if args.room:
        for group in args.room:
            requested_morty_ids.update(int(x) for x in group)

    # Load local data
    print("Loading local Airtable snapshots...", flush=True)
    room_records, award_records = load_local_data()

    # Build rooms list with Morty IDs
    rooms = []
    for record in room_records:
        fields = record.get("fields", {})
        morty_id = fields.get("Morty ID")
        if not morty_id:
            continue
        morty_id = int(morty_id)
        if requested_morty_ids and morty_id not in requested_morty_ids:
            continue
        rooms.append({
            "airtable_id": record["id"],
            "morty_id": morty_id,
            "game": fields.get("Game", "Unknown"),
            "existing_awards": fields.get("Awards", []),
        })

    print(f"  {len(rooms)} rooms with Morty IDs to process", flush=True)

    # Build award lookup
    award_lookup, known_orgs = build_award_lookup(award_records)
    print(f"  {len(award_lookup)} award keys in lookup ({len(known_orgs)} known organizations)", flush=True)

    # Phase 1: Get Morty awards (scrape or cache)
    morty_awards = {}
    errors = []

    if args.scrape:
        est_minutes = len(rooms) * FETCH_DELAY_SECONDS / 60
        print(f"\nScraping {len(rooms)} Morty pages (~{est_minutes:.1f} min at {FETCH_DELAY_SECONDS}s/req)...",
              flush=True)
        phase1_start = time.time()

        for i, room in enumerate(rooms):
            morty_id = room["morty_id"]
            game = room["game"]

            awards, error = fetch_morty_page(morty_id)
            if error:
                errors.append((morty_id, game, error))
                print(f"  [{i+1}/{len(rooms)}] ERROR {game} (morty:{morty_id}): {error}", flush=True)
            else:
                morty_awards[morty_id] = awards
                award_count = len(awards) if awards else 0
                if award_count > 0:
                    print(f"  [{i+1}/{len(rooms)}] {game} (morty:{morty_id}): {award_count} awards", flush=True)
                else:
                    print(f"  [{i+1}/{len(rooms)}] {game} (morty:{morty_id}): no awards", flush=True)

            if i < len(rooms) - 1:
                time.sleep(FETCH_DELAY_SECONDS)

        elapsed = time.time() - phase1_start
        print(f"\nScraping complete in {elapsed:.0f}s", flush=True)
        save_cache(morty_awards, errors)
    else:
        cached = load_cache()
        if cached is None:
            print("\nNo cache found. Run with --scrape first to fetch data from Morty.", file=sys.stderr)
            sys.exit(1)
        morty_awards, errors, scraped_at = cached
        print(f"\nUsing cached data from {scraped_at} ({len(morty_awards)} rooms)", flush=True)

    # Phase 2: Match and diff
    print("\nMatching awards...", flush=True)

    # Track what needs to be linked: award_airtable_id -> set of room_airtable_ids to add
    links_to_add = {}  # award_record_id -> {"award_name": str, "room_ids": set()}
    unmapped = []  # (game, morty_id, display_title, org, award_name, year)
    ignored = []   # awards from orgs not in Airtable — intentionally skipped
    already_linked = 0
    newly_linked = 0

    for room in rooms:
        morty_id = room["morty_id"]
        game = room["game"]
        room_airtable_id = room["airtable_id"]
        existing_award_ids = set(room["existing_awards"])

        scraped = morty_awards.get(morty_id, [])
        for award in scraped:
            org = award["organization"]
            award_name = award["award_name"]
            year = award["year"]

            # Skip awards from organizations not tracked in Airtable
            if not org or org.lower() not in known_orgs:
                ignored.append((game, morty_id, award["display_title"], org, award_name, year))
                continue

            if not year:
                unmapped.append((game, morty_id, award["display_title"], org, award_name, year))
                continue

            key = (org.lower(), award_name.lower(), year)
            matched_record = award_lookup.get(key)

            if not matched_record:
                unmapped.append((game, morty_id, award["display_title"], org, award_name, year))
                continue

            award_airtable_id = matched_record["id"]
            award_display = matched_record["fields"].get("Name", f"{org}: {award_name} ({year})")

            if award_airtable_id in existing_award_ids:
                already_linked += 1
                continue

            # Queue this link
            if award_airtable_id not in links_to_add:
                existing_rooms = matched_record["fields"].get("Rooms", [])
                links_to_add[award_airtable_id] = {
                    "award_name": award_display,
                    "existing_room_ids": list(existing_rooms),
                    "new_room_ids": set(),
                }
            links_to_add[award_airtable_id]["new_room_ids"].add(room_airtable_id)
            newly_linked += 1

    # Phase 3: Report
    mode_label = "APPLY" if args.apply else "DRY-RUN"
    print(f"\n{'=' * 60}")
    print(f"Mode: {mode_label}")
    print(f"{'=' * 60}")

    print(f"\nAlready linked: {already_linked}")
    print(f"New links to add: {newly_linked} (across {len(links_to_add)} awards)")

    if links_to_add:
        print(f"\nAward links to add:")
        for award_id, info in sorted(links_to_add.items(), key=lambda x: x[1]["award_name"]):
            new_count = len(info["new_room_ids"])
            existing_count = len(info["existing_room_ids"])
            print(f"  {info['award_name']}: +{new_count} rooms (currently {existing_count})")

    if unmapped:
        print(f"\nUnmapped awards ({len(unmapped)} total):")
        print("  These are from known organizations but have no matching Airtable award record.")
        print("  Create the award in Airtable first, then re-run this script.\n")
        seen = set()
        for game, morty_id, display, org, name, year in sorted(unmapped, key=lambda x: (x[3], x[2])):
            unmapped_key = (org, name, year)
            if unmapped_key not in seen:
                seen.add(unmapped_key)
                print(f"  [{org}] {display}")
                room_names = []
                seen_rooms = set()
                for g2, m2, d2, o2, n2, y2 in unmapped:
                    if (o2, n2, y2) == unmapped_key and g2 not in seen_rooms:
                        room_names.append(f"{g2} (morty:{m2})")
                        seen_rooms.add(g2)
                for rn in room_names[:5]:
                    print(f"    - {rn}")
                if len(room_names) > 5:
                    print(f"    ... and {len(room_names) - 5} more")

    if ignored:
        # Count unique (org, award_name, year) combos
        ignored_keys = set()
        for _, _, _, org, name, year in ignored:
            ignored_keys.add((org or "Unknown", name, year))
        print(f"\nIgnored awards ({len(ignored_keys)} unique, {len(ignored)} total):")
        print("  Organization not tracked in Airtable. Add the organization to use these.")
        for org, name, year in sorted(ignored_keys):
            year_label = f" ({year})" if year else ""
            print(f"  [{org}] {name}{year_label}")

    if errors:
        print(f"\nFetch errors ({len(errors)}):")
        for morty_id, game, error in errors:
            print(f"  {game} (morty:{morty_id}): {error}")

    # Phase 4: Apply
    if not args.apply:
        if links_to_add:
            print(f"\nRun with --apply to write {newly_linked} links to Airtable.")
        return

    token = os.environ.get("AIRTABLE_PAT")
    base_id = os.environ.get("AIRTABLE_BASE_ID")
    if not token or not base_id:
        print("Error: AIRTABLE_PAT and AIRTABLE_BASE_ID env vars are required for --apply.",
              file=sys.stderr)
        sys.exit(1)

    if not links_to_add:
        print("\nNothing to apply.")
        return

    print(f"\nApplying {len(links_to_add)} award updates to Airtable...", flush=True)
    succeeded = 0
    failed = 0

    for award_id, info in links_to_add.items():
        # Merge existing + new room IDs
        all_room_ids = list(info["existing_room_ids"])
        for rid in info["new_room_ids"]:
            if rid not in all_room_ids:
                all_room_ids.append(rid)

        try:
            update_award_rooms(base_id, token, award_id, all_room_ids)
            succeeded += 1
            print(f"  OK   {info['award_name']}: {len(all_room_ids)} rooms")
        except RuntimeError as e:
            failed += 1
            print(f"  FAIL {info['award_name']}: {e}")

    print(f"\nDone: {succeeded} succeeded, {failed} failed")


if __name__ == "__main__":
    main()
