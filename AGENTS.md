# Escaping Things — Project Reference

## Project Overview

Escaping Things is a static Eleventy site for the Escaping Things escape room team at `escape.thingelstad.com`.

The project now builds from a normalized Airtable-backed catalog, not from a single committed `rooms.json` export.

## Stack

- Eleventy v3
- Nunjucks templates
- Plain CSS and vanilla JavaScript
- Leaflet + MarkerCluster on the map page
- Chart.js on the stats page
- Tinylytics for analytics and kudos
- GitHub Pages for hosting

## Development

```bash
npm install
npm start
npm run build
npm run sync
npm test
```

## Data Model

Raw Airtable snapshots are committed under `src/_data/airtable/`:

- `companies.json`
- `locations.json`
- `themes.json`
- `players.json`
- `awards.json`
- `trips.json`
- `lists.json`
- `listItems.json`
- `rooms.json`
- `experiences.json`

`src/_data/catalog.js` builds the normalized site catalog from those snapshots using `lib/catalog.js`.

The normalized catalog exposes:

- `rooms`
- `companies`
- `locations`
- `themes`
- `players`
- `awards`
- `trips`
- `lists`
- `listItems`
- `experiences`
- `featured.players`
- `featured.awards`
- `featured.trips`
- lookup maps by Airtable ID, slug, and room ID

## Room Model

Public room objects are normalized with:

- `id` — stable public room number from Airtable `Room ID`
- `airtableId`
- `slug`
- `game`
- `date`
- `status`
- `timeLeft`
- `officialUrl` — fallback `Room URL -> Location URL -> Company URL`
- `blogUrl`
- `mortyId`
- `photo`
- `notes`
- `commentary`
- `company`
- `location`
- `players`
- `awards`
- `trips`
- `lists`
- `themes`
- `experiences`
- `ratingSummary`

Hidden rooms are excluded from all public collections and counts.

## Featured Model

Featured pages exist only for records with Airtable `Featured = true`:

- `/player/{slug}/`
- `/award/{slug}/`
- `/trip/{slug}/`
- `/featured/`

Non-featured players, awards, and trips remain metadata and should link to filtered list views.
Themes do not get standalone pages.

Lists are always public and have standalone pages:

- `/lists/`
- `/list/{slug}/`

Lists can be standalone or attached to a player or trip. Rooms can belong to zero or more lists.

## Search

Pagefind provides site-wide text search, accessible from any page via the nav search button, `/`, or `⌘K`/`Ctrl+K`. It indexes only detail pages with `data-pagefind-body` (room detail, featured player/award/trip, list detail). All index/listing pages use `data-pagefind-ignore`. Player names in room detail pages are excluded from the Pagefind index via `data-pagefind-ignore` to avoid noisy results.

## Filtering

Filtering is typed and URL-driven via dropdown controls. There is no free-text search on the rooms or map pages — Pagefind handles text search site-wide. Both pages share the same URL parameter names. The rooms page filter dimensions are:

- `player`
- `award`
- `theme`
- `trip`
- `list`
- `country`
- `year`
- `status`

The map page uses a reduced filter set: `country`, `trip`, `list`, `year`, `status`.

Both filter panels start collapsed when no URL filters are present, and expand automatically when the page loads with active filters.

The old tag model and the old `q` omnibox search are gone and should not be reintroduced.

## Key Files

- `lib/catalog.js` — normalization logic
- `src/_data/catalog.js` — loads the catalog for Eleventy
- `src/_data/filters.js` — filter option data
- `src/_data/roomDetail.js` — detail-page derived data
- `src/_data/roomIndex.js` — inlined room data for list and map
- `src/_data/listPages.js` — standalone list page data
- `src/_data/playerPages.js` — featured player page data
- `src/_data/tripPages.js` — featured trip page data
- `src/_includes/room-card.njk` — room card component
- `src/_includes/filter-bar.njk` — shared typed filters (list page only; map has inline filters)
- `src/_includes/entity-chips.njk` — shared entity chip rendering
- `src/js/data.js` — shared client helpers and filter state
- `src/js/list.js` — rooms page filtering (sorted by date, newest first)
- `src/js/map.js` — map filtering and popup rendering
- `src/js/trip.js` — featured trip route map

## Routes

- `/` — home
- `/rooms/` — typed room browser
- `/map/` — map view
- `/stats/` — charts and summary stats
- `/trips/` — featured trip index
- `/players/` — team roster and featured player index
- `/lists/` — all public lists
- `/list/{slug}/` — standalone list pages
- `/room/{id-slug}/` — room detail pages
- `/featured/` and featured entity pages
- `/feed.xml`
- `/sitemap.xml`

## Keyboard Shortcuts

Global shortcuts are defined in `src/_includes/base.njk`. A `?` overlay lists all shortcuts for users.

- `/` or `⌘K` / `Ctrl+K` — open Pagefind search
- `?` — show keyboard shortcuts help
- `Esc` — close overlay
- `g h` — Home, `g r` — Rooms, `g m` — Map, `g l` — Lists, `g t` — Trips, `g s` — Stats, `g p` — Players

All single-key and `g`-prefix shortcuts are suppressed when an input/textarea/select is focused.

## Notes

- `npm run sync` is the source-data refresh step; there is no separate export pipeline to regenerate a flat room file.
- Prefer working from the normalized catalog rather than rebuilding ad hoc Airtable link resolution in page-specific files.
- Keep the typed entity model intact: do not reintroduce generic tag plumbing.
- Trip pages include an ordered room-card section and a route map with numbered stops.
- Room detail pages use a shared photo-backed room-card design for related rooms; avoid reintroducing one-off room card variants.
