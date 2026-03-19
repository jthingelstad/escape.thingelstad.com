# Escaping Things — Project Reference

## Project Overview

Escaping Things is a static Eleventy site for the Thingelstad family's escape room history at `escape.thingelstad.com`.

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

## Filtering

Filtering is typed and URL-driven. The active dimensions are:

- `q`
- `company`
- `location`
- `player`
- `award`
- `trip`
- `theme`
- `country`
- `year`
- `status`

The old tag model is gone and should not be reintroduced.

## Key Files

- `lib/catalog.js` — normalization logic
- `src/_data/catalog.js` — loads the catalog for Eleventy
- `src/_data/filters.js` — filter option data
- `src/_data/roomDetail.js` — detail-page derived data
- `src/_data/roomIndex.js` — inlined room data for list and map
- `src/_includes/room-card.njk` — room card component
- `src/_includes/filter-bar.njk` — shared typed filters
- `src/js/data.js` — shared client helpers and filter state
- `src/js/list.js` — list filtering and sorting
- `src/js/map.js` — map filtering and popup rendering

## Routes

- `/` — home
- `/list/` — typed room browser
- `/map/` — map view
- `/scrapbook/` — photo scrapbook
- `/stats/` — charts and summary stats
- `/room/{id-slug}/` — room detail pages
- `/featured/` and featured entity pages
- `/feed.xml`
- `/sitemap.xml`

## Notes

- `npm run sync` is the source-data refresh step; there is no separate export pipeline to regenerate a flat room file.
- Prefer working from the normalized catalog rather than rebuilding ad hoc Airtable link resolution in page-specific files.
