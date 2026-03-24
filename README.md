# Escaping Things

The Escaping Things escape room team site, published at **[escape.thingelstad.com](https://escape.thingelstad.com)**.

This is an Eleventy-powered static site built from a normalized Airtable dataset. The current site includes:

- 100 public rooms
- 94 played rooms and 6 scheduled rooms
- 9 countries
- typed entities for companies, locations, themes, players, awards, trips, lists, and experiences
- standalone featured pages for selected players, awards, and trips
- standalone list pages plus room/list/player/trip cross-linking

## Stack

- [Eleventy (11ty)](https://www.11ty.dev/) v3
- Nunjucks templates
- Plain CSS and vanilla JavaScript
- Leaflet for maps
- Chart.js for stats
- Pagefind for site-wide search
- Tinylytics for analytics
- GitHub Pages via GitHub Actions

No framework, no client-side data fetching, no runtime backend.

## Data Model

Raw Airtable snapshots live in `src/_data/airtable/` and are synced with:

```bash
npm run sync
```

The sync script pulls these Airtable tables:

- `Companies`
- `Locations`
- `Themes`
- `Players`
- `Awards`
- `Trips`
- `Lists`
- `List Items`
- `Rooms`
- `Experiences`

Those raw snapshots are normalized in [src/_data/catalog.js](src/_data/catalog.js) through [lib/catalog.js](lib/catalog.js). The catalog is the canonical site data layer and exposes:

- `rooms`
- `companies`
- `locations`
- `themes`
- `players`
- `awards`
- `trips`
- `lists`
- `experiences`
- `featured.players`
- `featured.awards`
- `featured.trips`
- lookup indexes by Airtable ID and slug

Each room carries resolved relations and derived fields such as:

- stable `Room ID`
- canonical room slug and permalink
- `officialUrl` resolved by `Room URL -> Location URL -> Company URL`
- typed `players`, `awards`, `trips`, `lists`, and `themes`
- nested `company` and `location`
- `ratingSummary` from `Experiences`

## Public Pages

- `/` home page
- `/list/` filterable room browser
- `/map/` filterable map
- `/stats/` stats and charts
- `/featured/` featured hub
- `/trips/` featured trip index
- `/players/` team roster and featured player index
- `/room/<room-slug>/`
- `/player/<slug>/` for featured players
- `/award/<slug>/` for featured awards
- `/trip/<slug>/` for featured trips
- `/lists/` all public lists
- `/list/<slug>/` for standalone lists

## Development

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm start
```

Build the site:

```bash
npm run build
```

Refresh Airtable snapshots:

```bash
npm run sync
```

Run tests:

```bash
npm test
```

## Tests

The test suite covers:

- catalog normalization and data contracts
- fallback `officialUrl` behavior
- hidden-room exclusion
- list and list-item relationship handling
- browser-level filter smoke tests using `jsdom`

## Airtable Sync

The sync script reads these environment variables:

- `AIRTABLE_PAT`
- `AIRTABLE_BASE_ID`
It also reads `.env` in the project root if present.

## Search

The site has two search mechanisms:

- **Catalog filter** on `/list/` and `/map/` — structured dropdowns and text search over an embedded JSON index for instant client-side filtering
- **Site-wide search** via [Pagefind](https://pagefind.app) — full-text search across all rendered pages, accessible from the search icon in the nav bar. Pagefind indexes the built site as a post-build step and requires a full `npm run build` to generate the index.

## Deployment

Pushes to `main` trigger the GitHub Pages workflow in `.github/workflows/deploy.yml`.

## License

Code is licensed under `CC-BY-SA-4.0`. Site content and underlying data are personal to the Escaping Things team.
