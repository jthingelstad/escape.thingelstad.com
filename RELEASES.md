# Releases

A timeline of major milestones for the Escaping Things site.

---

## 4.0.0 — Pagefind Search & AI Removal

- Removed all OpenAI-generated content (search hints, editorial copy)
- Added [Pagefind](https://pagefind.app) for static full-text site-wide search
- Search accessible from nav bar icon, indexes all room/player/trip/award/list pages
- Catalog filter on list and map pages unchanged

## 3.1.0 — Entity Refactor & Featured Pages

- Refactored site around normalized Airtable entities
- Added standalone featured pages for players, awards, trips, and lists
- Cross-linking between all entity types
- Introduced build-time AI editorial content and search hints
- Redesigned room cards with photo-backed layout
- Added related rooms to detail pages

## 3.0.0 — Room Detail Pages

- Added individual room detail pages at `/room/<id>-<slug>/`
- Comparative stats: time percentile, win rate
- Mini-maps on room pages
- Entity chips for players, awards, trips, and themes
- Room-to-room navigation (prev/next)
- Related room suggestions

## 2.4.0 — Data Model Cleanup

- Switched from embedded photo URLs to local filenames (`photo` field)
- Added Room URL as top priority in official URL fallback chain
- Renamed Blog URL field to thingelstad.com URL

## 2.3.0 — Time Left Overhaul

- Replaced `escapeTime` with `timeLeft` across the entire site
- Added clickable chart bars linking to room detail pages

## 2.2.0 — Deeplinks & Data Sync Improvements

- Deeplink navigation from home page room cards to filtered list view
- Scroll-to and highlight on deeplink arrival
- Airtable sync script: `.env` auto-loading, data validation warnings
- Optimized room images

## 2.1.0 — Zero Client-Side Fetch

- Pre-computed chart datasets, scrapbook photos, room index, and map data at build time
- Inlined all data into HTML — no runtime API calls
- Fixed XSS issues and color mismatches

## 2.0.0 — Airtable Integration & Analytics

- Added Airtable sync script (`sync_airtable.py`) for live data snapshots
- Added Atom RSS feed for completed rooms
- Added Tinylytics event tracking
- Improved stats charts: split location charts, line graph for escape times

## 1.2.0 — Photos & Server-Rendered Cards

- Added room photos from blog posts
- Photo thumbnails on room cards and map popups
- Server-rendered room cards on list page (previously client-side)
- Added Scrapbook page with polaroid-style gallery
- Content-hash cache busting for CSS and JS

## 1.1.0 — Eleventy Migration & Design Refresh

- Migrated from hand-coded static HTML to Eleventy (11ty) with Nunjucks templates
- Warm parchment color palette, IBM Plex + Newsreader typography
- Extracted partials and shared base layout

## 1.0.0 — Initial Launch

- Single-page static HTML site with rooms JSON dataset
- Client-side filtering and sorting
- Leaflet map and Chart.js stats
- Morty escape room tracker integration
- Data maintained in a local `rooms.json` exported from a spreadsheet
