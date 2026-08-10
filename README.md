# Escaping Things

The Escaping Things escape room team site, published at **[escape.thingelstad.com](https://escape.thingelstad.com)**.

This is an Eleventy-powered static site built from a normalized Airtable dataset. The current site includes:

- public room totals and played/scheduled breakdowns computed from the current snapshots
- country, company, trip, list, theme, award, and player coverage derived from the catalog
- typed entities for companies, locations, themes, players, awards, trips, lists, and experiences
- standalone featured pages for selected players and trips
- standalone list pages plus room/list/player/trip cross-linking

## Stack

- [Eleventy (11ty)](https://www.11ty.dev/) v3
- [Eleventy Image](https://www.11ty.dev/docs/plugins/image/) for responsive WebP/source image sets
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
- `featured.trips`
- lookup indexes by Airtable ID, canonical slug, legacy room ID, and public room number

Each room carries resolved relations and derived fields such as:

- contiguous chronological public room number
- optional legacy Airtable `Room ID`
- canonical date-and-name room slug and permalink
- `officialUrl` resolved by `Room URL -> Location URL -> Company URL`
- typed `players`, `awards`, `trips`, `lists`, and `themes`
- nested `company` and `location`
- `ratingSummary` from `Experiences`

## Public Pages

- `/` home page
- `/rooms/` typed, URL-driven room browser
- `/map/` filterable map
- `/stats/` stats and charts
- `/search/?q=<query>` shareable full-text search
- `/featured/` featured hub
- `/trips/` featured trip index
- `/players/` team roster and featured player index
- `/room/<room-slug>/`
- `/player/<slug>/` for featured players
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
- contiguous public numbering independent of optional legacy Airtable IDs
- canonical date-and-name room routes plus legacy URL redirects
- public, played, and scheduled room-count semantics
- fallback `officialUrl` behavior
- hidden-room exclusion
- list and list-item relationship handling
- browser-level filter smoke tests using `jsdom`

## Airtable Sync

The sync script reads these environment variables:

- `AIRTABLE_PAT`
- `AIRTABLE_BASE_ID`
It also reads `.env` in the project root if present.

Public rooms must have a game name, a valid date and status, and exactly one valid location. `npm run sync`, the catalog build, and the automated sync workflow fail before publishing when those contracts are broken. Hidden records may remain incomplete while they are being prepared.

The public room number is derived from chronological catalog order (date, then optional `Order`) and is therefore contiguous across visible rooms. Airtable `Room ID` is now optional legacy metadata: when present it must be a positive, unique integer, but it is not used for display numbers, counts, or canonical links. Airtable autonumber gaps are expected and harmless.

When multiple public rooms share a date, each must have a unique positive `Order` value. That makes the public sequence deterministic without depending on Airtable record order.

Canonical room links use `/room/YYYY-MM-DD/room-name/`. Previously published `/room/Room-ID-room-name/` links are generated as redirect pages so old bookmarks continue to work.

When adding rooms:

1. Complete the required room fields and relationships in Airtable; keep unfinished records hidden.
2. Run `npm run sync`.
3. Review the snapshot and downloaded-photo diff.
4. Run `npm test` and `npm run build` before publishing.

## Search

The site separates typed browsing from text search:

- **Typed filters** on `/rooms/` and `/map/` — structured dropdowns backed by the inlined normalized catalog; active filters are preserved in the URL.
- **Site-wide search** via [Pagefind](https://pagefind.app) — full-text search across detail pages, accessible from the nav search button, the shareable `/search/?q=` route, `/`, or `⌘K`/`Ctrl+K`. Pagefind requires a full `npm run build` to regenerate its index.

Catalog filters, sort order, and the selected map room are URL state. User changes create browser-history entries, so Back and Forward restore prior views. Room links include a validated `from` context so room detail navigation can return to the filtered catalog, map, trip, list, or player page.

Featured player and trip routes are pinned by Airtable record ID in `src/_data/publicSlugs.json`. Add a stable entry there before publishing a newly featured entity; later display-name edits will not change its existing public URL.

## Deployment

Pushes to `main` trigger the GitHub Pages workflow in `.github/workflows/deploy.yml`.

## License

Code is licensed under `CC-BY-SA-4.0`. Site content and underlying data are personal to the Escaping Things team.
