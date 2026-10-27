# Escaping Things — Project Reference

## Project Overview

Escaping Things is a static Eleventy site for the Escaping Things escape room team at `escape.thingelstad.com`.

The project now builds from a normalized Airtable-backed catalog, not from a single committed `rooms.json` export.

## Stack

- Eleventy v3
- Nunjucks templates
- Plain CSS and vanilla JavaScript
- Eleventy Image responsive image transforms
- Leaflet + MarkerCluster on the map page
- Chart.js on the stats page
- Tinylytics for analytics and kudos
- S3 and CloudFront for hosting (GitHub Pages too, until the DNS cutover; see "S3 and CloudFront")

## Development

```bash
npm install
npm start
npm run build
npm run sync
npm test
npm run test:e2e   # after a build: checks _site against the S3 deploy's rules
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
- `featured.trips`
- lookup maps by Airtable ID, canonical slug, legacy room ID, and public room number

Player `roomIds` retain every visible linked room so scheduled rooms remain available for planning and filtering. Player `playedRoomIds` and `roomCount` exclude scheduled rooms; scheduled rooms must not affect player histories, win rates, or team statistics.

## Room Model

Public room objects are normalized with:

- `number` — contiguous public room number derived from chronological catalog order
- `id` / `legacyId` — optional legacy Airtable `Room ID`, retained for old URL redirects
- `airtableId`
- `slug` — canonical `YYYY-MM-DD/room-name` route key
- `legacySlug` — optional old `Room ID` route key
- `game`
- `date`
- `createdAt` / `modifiedAt` — Airtable timestamps used for feed freshness
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
- `/trip/{slug}/`
- `/featured/`

Non-featured players and trips remain metadata and should link to filtered list views.
Awards and themes are always metadata (no standalone pages) and link to filtered list views.
Awards carry `organization`, `year`, `awardName`, and `awardLink` fields reflecting external recognition programs.

Lists are always public and have standalone pages:

- `/lists/`
- `/list/{slug}/`

Lists can be standalone or attached to a player or trip. Rooms can belong to zero or more lists.

## Search

Pagefind provides site-wide text search, accessible from any page via the nav search button, `/`, or `⌘K`/`Ctrl+K`. It indexes only detail pages with `data-pagefind-body` (room detail, featured player/award/trip, list detail). All index/listing pages use `data-pagefind-ignore`. Player names in room detail pages are excluded from the Pagefind index via `data-pagefind-ignore` to avoid noisy results.

`/search/?q={query}` is the durable, shareable search route. Keep the global overlay for quick keyboard access and use the standalone route for copied or deep-linked queries.

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

Rooms also preserve `sort` in the URL; the map preserves the selected popup as `room`. Filter changes create browser-history entries. Detail links add a validated `from` parameter so Back links and previous/next room navigation retain catalog, map, list, trip, or player context.

The old tag model and the old `q` omnibox search are gone and should not be reintroduced.

## Key Files

- `lib/catalog.js` — normalization logic
- `src/_data/catalog.js` — loads the catalog for Eleventy
- `src/_data/filters.js` — filter option data
- `src/_data/roomDetail.js` — detail-page derived data
- `src/_data/roomIndex.js` — inlined room data for list and map
- `lib/open-data.js` — `/rooms.json` and `/llms.txt`
- `src/_data/listPages.js` — standalone list page data
- `src/_data/playerPages.js` — featured player page data
- `src/_data/publicSlugs.json` — durable featured player/trip slugs by Airtable record ID
- `src/_data/tripPages.js` — featured trip page data
- `src/_includes/room-card.njk` — room card component
- `src/_includes/filter-bar.njk` — shared typed filters (list page only; map has inline filters)
- `src/_includes/entity-chips.njk` — shared entity chip rendering
- `src/js/data.js` — shared client helpers and filter state
- `src/js/list.js` — rooms page filtering (sorted by date, newest first)
- `src/js/map.js` — map filtering and popup rendering
- `src/js/room.js` — validated detail-page return context
- `src/js/search.js` — standalone Pagefind query/deep-link state
- `src/js/trip.js` — featured trip route map

## Routes

- `/` — home
- `/rooms/` — typed room browser
- `/map/` — map view
- `/search/` — shareable Pagefind search
- `/stats/` — charts and summary stats
- `/trips/` — featured trip index
- `/players/` — team roster and featured player index
- `/lists/` — all public lists
- `/list/{slug}/` — standalone list pages
- `/room/{date}/{room-slug}/` — canonical room detail pages
- `/room/{legacy-id-slug}/` — redirect-only compatibility routes
- `/featured/` and featured entity pages
- `/feed.xml` — Atom feed
- `/feed.json` — JSON Feed 1.1 of the same entries
- `/rooms.json` — every played room as open data
- `/llms.txt` — the site for agents and LLMs
- `/sitemap.xml`

The Atom feed includes only the 25 most recent non-scheduled rooms. Feed entries should read as narrative activity updates and point readers to room detail pages; exhaustive catalog metadata belongs on the site, not in feed content. The JSON Feed renders the same entries from the same `src/_includes/feed-entry-content.njk`, so the two never drift.

`/rooms.json` and `/llms.txt` are built by `lib/open-data.js` (through `src/_data/openData.js`) from the normalized catalog: played rooms only, newest first, no Airtable IDs. They leave out room photos on purpose, since `robots.txt` keeps `/images/rooms/` away from crawlers; the pages and both feeds still show photos to people. The published `/rooms.json` is an output, not a source: the site still builds from the Airtable snapshots.

`/llms.txt` keeps the shape the llmstxt.org reference parser reads: prose only above the first `##` heading, and under every heading only `- [name](url): note` lines with one link each (a line without a link stops the parser, and a second link is dropped). Names turn `[` `]` into parentheses. `tests/llms-shape.cjs` holds the check, and `tests/open-data.test.cjs` runs it on the built file.

The head advertises only the two feeds (and `llms.txt`). `/rooms.json` is open data, not a feed, so it has no `rel=alternate`: `application/json` is JSON Feed 1.0's discovery type, and a reader could offer it as a feed. `llms.txt` names it.

Played rooms are h-entries (IndieWeb microformats), using the same `isPlayed` test and noon-UTC `playedAt` date as the feeds (`lib/feed.js`, also Eleventy filters). A room page's hero is the h-entry: `p-name` on the h1, `dt-published` on the date's `<time>`, the commentary and notes as `e-content`, and the sentence `summarizeRoom` writes for the room's feed entry as `p-summary`, so a room with no write-up still has a summary. The home page `<main>` and the `/rooms/` grid are h-feeds, with an h-entry for each played room's card (`roomCard(room, { entry: true })`). Up Next cards, a room page's related rooms, and the trip, player and list pages carry no microformats. The `u-url` is a `<data>` holding the clean room address, because card links carry `?from=`. It sits inside the date's `<time>`, as does the `p-summary` `<data>` on room pages; neither holds text, and neither goes in a heading: headings use `text-wrap: balance`, and an element inside one changes where Chrome breaks the line. There is no author property yet; who the author is waits on Jamie's call (open-web audit P13). `tests/microformats.test.cjs` pins all of this.

## S3 and CloudFront

The site is moving from GitHub Pages to S3 and CloudFront (Jamie, 2026-10-26: "Approved: move
escape.thingelstad.com to S3 and CloudFront with real 301 redirects, Pages kept until DNS cutover"). It
copies the pattern weekly.thingelstad.com shipped the same day. Escaping Things shares the domain, not
the publishing system, and is not in the sites strip: the stacks say so in their descriptions and are
tagged `Project=escape`, and nothing in WT Builder or librarian-thing touches them.

Three stacks, generated by `infra/templates.mjs` into `infra/generated/` (`npm run infra:generate`; a
unit test fails when the committed JSON is stale) and deployed **from this Mac as the cloud-engineer
identity** with `npm run infra -- certificate|site|delivery` (`--plan` prints the change set and stops).
`infra/deployment.json` records their names, tags and outputs.

- `escape-certificate`: the ACM certificate, validated by a CNAME at Namecheap. DNS is Jamie's to edit.
  Keep the validation record: renewal needs it. ACM checks CAA along the `escape` record's CNAME chain,
  and GitHub's CAA refuses Amazon, so while `escape` pointed at `jthingelstad.github.io` no certificate
  could issue. Jamie deleted the record for the validation (a short outage), letting the check fall
  through to `thingelstad.com`'s CAA, which allows `amazon.com`.
- `escape-site`: a private, versioned bucket (old versions kept 90 days) behind CloudFront with origin
  access control; AWS's CachingOptimized policy (no query string in the key, so filter URLs and `?ref=`
  share one copy of a page); security headers plus `Access-Control-Allow-Origin: *` as Pages sent;
  403/404 serve `/404.html`; a 5xx alarm to `weekly-thing-librarian-alarms` (the family topic poap,
  nnxyz and thingelstad.xyz use too). The alias and certificate attach only once the certificate is
  ISSUED (rerun `npm run infra -- site`).
- `escape-delivery`: the role GitHub Actions assumes (`vars.AWS_DEPLOY_ROLE_ARN`), `main` only. It can
  publish into the bucket, update the redirect store and clear the cache; it cannot change the stacks.

Both workflows publish to S3 in a `deploy-aws` job beside the Pages deploy: `deploy.yml` on a push to
`main`, and `sync-and-deploy.yml` (the Airtable sync, run by hand), whose job checks out the commit its
build was made from (main after the sync's commit). `scripts/update.sh` pushes, so `deploy.yml` covers it.

**Legacy room routes are real 301s.** The build writes `_redirects.json` (`src/redirects-map.njk`, from
the same `legacyRooms` data as `room-legacy.njk`): every `/room/<Room-ID>-<name>/` route and room route
alias, path to room. Each deploy copies it into the distribution's CloudFront key value store, and the
viewer-request function (`infra/viewer-request.mjs`) answers those paths with a 301 that keeps the query
string. The same function sends a bare path to its slash form and serves `index.html` for directory
URLs; the extensionless files it passes through are listed in its `FILES` (none: `CNAME` is for Pages
and never published). The meta-refresh pages are still built (Pages serves them, and the test reads the
map from them) but never reached on CloudFront. `tests/e2e/built-site.cjs` (`npm run test:e2e`, after
`npm run build`; both workflows run it) keeps the map equal to the redirect pages and `FILES` equal to
the build.

**Content types and caching** are set per file by `scripts/publish-plan.mjs`. `/feed.xml` (Atom) and
`/sitemap.xml` go out as `application/xml` (CloudFront does not compress `application/atom+xml`), the
JSON files as `application/json`, `.jpeg` and Airtable's uppercase `.JPG` as `image/jpeg`, Pagefind's
index files as bytes. The same e2e test fails when the build writes a file the table does not type, so
a new kind of file needs an entry there. Pages are five minutes in browsers and a day in CloudFront
(every deploy clears it). Only Eleventy Image's `/img/` copies, named by content hash, keep a week in
browsers: a room photo in `/images/rooms/` is named by its Airtable record and keeps that name when it is
replaced.

`npm run deploy:aws` (`scripts/deploy-aws.mjs`) refuses unless the site stack's live template equals
`infra/generated/site.json`, so infrastructure goes out first, on its own. It uploads the files whose
MD5 changed (`--all` re-uploads everything, needed after a `publish-plan.mjs` change), syncs the
redirect store, deletes what the build no longer writes, clears the cache, and reads the result back
through the CloudFront domain (the front page as built, `/feed.xml`'s type, a legacy room redirect, the
slash form, a 404). Tinylytics refuses the `cloudfront.net` host, so analytics only count on the real
domain. The deploy assumes the delivery role through GitHub's OIDC token; no AWS keys are stored.

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
- Add featured player/trip Airtable IDs to `publicSlugs.json` before publishing their routes; do not derive an already-public slug from mutable display names.
