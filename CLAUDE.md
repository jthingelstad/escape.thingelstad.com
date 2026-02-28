# Escaping Things — Project Reference

## Project Overview

A static website for "Escaping Things" at escape.thingelstad.com — a personal site showcasing the Thingelstad family's escape room journey. Built with 11ty (Eleventy) and hosted on GitHub Pages. Nunjucks templates, CSS, and JavaScript with room data pre-computed and inlined at build time. Source data in `src/_data/rooms.json` is synced from Airtable.

## Tech Stack

- **11ty (Eleventy) v3** — Static site generator with Nunjucks templates
- Plain CSS and JavaScript (no React, no framework, no bundler)
- Leaflet.js v1.9.4 via CDN for maps
- Leaflet.markercluster v1.5.3 via CDN for marker clustering
- Chart.js v4.4.7 via CDN for stats charts
- Google Fonts: Bungee (headings) + Space Grotesk (body) + Caveat (scrapbook details)
- Tinylytics for analytics (kudos, hit counter, visitor countries, event tracking)
- GitHub Pages hosting via GitHub Actions
- `src/_data/rooms.json` is the single data source, committed to the repo; per-page data files pre-compute and inline subsets at build time

## Build & Development

```bash
npm install          # Install dependencies (11ty + html-minifier-terser)
npm start            # Dev server with hot reload (localhost:8080)
npm run build        # Production build to _site/
```

## File Structure

```
/
├── eleventy.config.js        # 11ty config: passthrough, filters, HTML minification
├── package.json
├── CLAUDE.md
├── src/                      # 11ty input directory
│   ├── index.njk             # Home page
│   ├── list.njk              # Filterable room list with detail modal
│   ├── scrapbook.njk         # Photo scrapbook
│   ├── map.njk               # Interactive map
│   ├── stats.njk             # Charts and statistics
│   ├── feed.njk              # Atom RSS feed (/feed.xml)
│   ├── 404.njk               # Escape-room-themed 404 page
│   ├── sitemap.njk           # Auto-generated sitemap from collections
│   ├── _includes/            # Nunjucks partials & layouts
│   │   ├── base.njk          # Base HTML layout (head, scripts, footer)
│   │   ├── nav.njk           # Navigation bar
│   │   ├── footer.njk        # Site footer
│   │   ├── filter-bar.njk    # Shared filter controls (list + map pages)
│   │   └── room-card.njk     # Reusable room card macro
│   ├── _data/                # 11ty data files
│   │   ├── rooms.json        # Room data (90+ rooms, synced from Airtable)
│   │   ├── stats.js          # Computed stats + chart datasets (inlined on stats page)
│   │   ├── filters.js        # Filter options (tags, years, countries, players)
│   │   ├── listRooms.js      # Trimmed room data for list modal (no lat/lng)
│   │   ├── scrapbook.js      # Photo rooms with display fields only
│   │   └── mapRooms.js       # Room data for map (all fields including lat/lng)
│   ├── css/
│   │   └── style.css         # Shared styles
│   ├── js/
│   │   ├── data.js           # Shared client-side utilities (formatting, escaping, nav, URL state)
│   │   ├── list.js           # List page logic (filter, sort, URL state, modal)
│   │   ├── map.js            # Map page logic (Leaflet, markers, filter panel)
│   │   ├── scrapbook.js      # Scrapbook page logic (photo layout, shuffle/sort)
│   │   └── stats.js          # Stats page logic (Chart.js charts)
│   ├── images/
│   │   ├── favicon.svg       # Key-shaped gold SVG favicon
│   │   └── rooms/            # Room photos (NN.jpg)
│   ├── CNAME                 # Contains: escape.thingelstad.com
│   └── robots.txt            # Allows all crawlers, references sitemap
├── _site/                    # Built output (do not edit)
└── .github/workflows/
    └── deploy.yml            # GitHub Actions: build + deploy to Pages
```

## Data Schema

`src/_data/rooms.json` contains an array of room objects. Data is synced from Airtable.

```json
{
  "rooms": [
    {
      "id": 86,
      "airtableId": "recIifKoB4QBKlyCe",
      "game": "Loose Sleuth",
      "company": "Puzzleworks",
      "date": "2026-01-03",
      "status": "Escaped",
      "timeLeft": 10.92,
      "location": {
        "city": "Minneapolis",
        "region": "Minnesota",
        "country": "United States",
        "lat": 44.9778,
        "lng": -93.265
      },
      "companyUrl": "https://www.puzzle.works/",
      "blogUrl": "https://www.thingelstad.com/2026/01/03/we-had-a-great-time.html",
      "mortyId": 13321,
      "tags": ["best"],
      "players": ["Jamie", "Tammy", "Mazie", "Tyler"],
      "notes": "Great puzzles",
      "photo": "85.jpg"
    }
  ]
}
```

Field notes:
- `id` — Sequential integer (1–91+). Primary identifier.
- `airtableId` — String like "recXXXXXX". Airtable record ID. Used for permalinks and kudos paths.
- `date` — ISO 8601 (YYYY-MM-DD).
- `status` — One of: `"Escaped"`, `"Try again"`, `"Completed"`, `"Scheduled"`. Win rate counts Escaped + Completed as wins.
- `timeLeft` — Number (minutes remaining, can be negative) or null. Displayed as "Xm Ys left" or "Xm Ys over".
- `location.region` — State (US), province (CA), or absent (international). Not "state".
- `location.country` — Full country name (e.g. "United States", "Canada", "Iceland"). Not a country code.
- `location.lat` / `location.lng` — May be null for online or scheduled rooms (don't render on map).
- `companyUrl` / `blogUrl` — May be null.
- `mortyId` — Integer or absent. Links to morty.app attraction page.
- `tags` — Array of strings. May be empty. Values include "best", "online", "fun", terpeca tags ("terpeca-2024"), and trip tags ("quebec-2025").
- `players` — Array of first names (capitalized). May be empty.
- `notes` — May be null. Shown on cards.
- `photo` — Filename like "85.jpg" or absent. The `/images/rooms/` prefix is applied at the point of use (templates, JS). Not all rooms have photos.

## 11ty Data Layer

Data files in `src/_data/` are available globally in templates:

- **`rooms.json`** — Raw room data. Accessed as `rooms.rooms` in templates. Source of truth for all other data files.
- **`stats.js`** — Computed at build time. Provides `stats.totalRooms`, `stats.totalWins`, `stats.winRate`, `stats.regionCount`, `stats.countryCount`, `stats.companyCount`, `stats.yearsActive`, `stats.firstYear`, `stats.lastYear`, `stats.latestCompleted`, `stats.recentCompleted` (6 most recent), `stats.planned`, and `stats.charts` (pre-computed chart datasets: `roomsPerYear`, `monthly`, `states`, `countries`, `companies`, `timeLeft`).
- **`filters.js`** — Computed at build time. Provides `filters.tags`, `filters.years`, `filters.countries`, `filters.players` for pre-populating filter dropdowns.
- **`listRooms.js`** — Pre-computes room data for the list page detail modal. Strips `lat`/`lng` from locations. Inlined as JSON in `list.njk`.
- **`scrapbook.js`** — Filters to rooms with photos and trims to display-only fields. Inlined as JSON in `scrapbook.njk`.
- **`mapRooms.js`** — All rooms with full location data (including `lat`/`lng`) for map markers. Inlined as JSON in `map.njk`.

## 11ty Nunjucks Filters (eleventy.config.js)

- `formatDate` — "2025-08-02" → "August 2, 2025"
- `formatLocation` — location object → "City, Region, Country"
- `formatTimeLeft` — number (minutes) → "5m 46s left" (positive) or "2m 30s over" (negative), empty string for null
- `classifyTag` — tag → CSS class: "best", "terpeca", "online", "trip", "default"
- `formatTagLabel` — tag → display label: "best" → "★ Best", "terpeca-2024" → "TERPECA 2024"
- `cacheBust` — Appends content hash to asset URLs for cache busting

## Design

Dark, moody, immersive "escape room" aesthetic with atmospheric effects.

- **Background:** Very dark (#060910) with SVG film grain noise texture overlay
- **Accent colors:** Gold (#e8924f) for highlights/best rooms, teal (#43e6d0) for interactive elements, red (#f06060) for losses, blue (#5a8bff) for scheduled
- **Typography:** Bungee (display/headings — bold retro feel), Space Grotesk (body — clean sans-serif), Caveat (scrapbook captions — handwritten feel)
- **Map tiles:** CartoDB Dark Matter
- **Atmospheric effects:**
  - Film grain noise texture via SVG data URI filter
  - Animated gold shimmer on hero title (background-clip: text with sweeping gradient)
  - CSS keyhole motif above hero title
  - Breathing ambient light animation behind hero
  - Decorative diamond dividers (✦ ✦ ✦)
  - Spring cubic-bezier card transitions with animated teal glow on hover
  - Featured card with pulsing gold top-line
  - "Best" tags with pulsing glow animation
  - 404 page with pulsing red ambient, lock wiggle, sweep-shine button
- **Footer:** Gold gradient accent line, Tinylytics visitor countries, hit counter, copyright

## Shared Components

### Navigation (nav.njk)

Frosted glass navbar (backdrop-filter blur) on all pages. Links: Home, Rooms, Scrapbook, Map, Stats. Active page highlighted via `page.url`. "Escaping Things" wordmark on left. Hamburger menu on mobile. Toggle initialized via `initNav()` from data.js.

### Room Card (room-card.njk)

Nunjucks macro `roomCard(room, options)`. Server-rendered on home page and list page. Shows:
- Photo thumbnail (if photo exists)
- Room number (#id) and game name as heading
- Company name (linked to companyUrl if available)
- Formatted date (e.g. "August 2, 2025")
- Location (city, region, country)
- Status badge (✓ Escaped / ✗ Try Again / ✓ Completed / Scheduled)
- Time left with stopwatch icon (if available)
- Players with 👥 icon (comma-separated, if available)
- Tags as styled pills
- Tinylytics kudos button (data-path="/room/{airtableId}")

Options: `{ compact: boolean, featured: boolean }`

### Filter Bar (filter-bar.njk)

Shared filter controls included on list and map pages. Contains:
- Search input (text, debounced in JS)
- Tag, Year, Status, Country, Player dropdown selects (options server-rendered from filters data)
- Clear All button (hidden when no filters active)

### Tag Rendering

Tags are visually categorized by `classifyTag()`:
- `best` → Gold pill with star icon, pulsing glow animation
- `terpeca-*` → Purple/deep blue pill, displayed as "TERPECA 2024"
- `online` → Distinct pill indicating remote room (no physical location)
- Trip tags (e.g. "quebec-2025") → Muted teal pill, displayed as "Quebec 2025"
- Default → Neutral dark pill

## Page Specifications

### Home Page (index.njk)

- **Hero:** Animated shimmer title "Escaping Things", keyhole motif, subtitle, breathing ambient light
- **Stats row:** Server-rendered from `stats` data — total rooms, wins, win rate, regions, countries, years active
- **Recent rooms:** Up to 6 most recent completed rooms as cards (server-rendered via room-card macro)
- **Coming Up:** Conditional section showing scheduled rooms (hidden if none)
- **Escape Trail:** Four themed cards with icons (key, puzzle, camera, lock) describing site sections

### List Page (list.njk)

- **Filter bar:** Search input (debounced), Tag/Year/Country/Player dropdowns (server-rendered options), Status toggle, Clear All button
- **Active filter pills:** Dismissible pills showing current filters
- **URL-driven:** All filters reflected in query params (`?tag=best&player=Tyler&year=2025`), applied on load, updated via replaceState
- **Sort controls:** Date (default desc), Game, Company, City — click to toggle direction
- **Results:** Count display ("Showing 12 of 91 rooms"), room cards in grid layout (server-rendered, filtered/sorted client-side)
- **Detail modal:** Click a card to open modal overlay with photo, full room details, blog/morty links, and copy permalink button

### Scrapbook Page (scrapbook.njk)

- **Photo scrapbook** of rooms that have photos
- **Scattered layout** with random rotation, sizing, and offset (polaroid-on-table aesthetic)
- **Controls:** Date sort (toggles newest/oldest) and Shuffle button
- **Photo details:** Click a photo to expand and show room name, company, date, location, status, time left, blog link
- **"Best" rooms** highlighted with gold accent

### Map Page (map.njk)

- **Full-viewport Leaflet map** with CartoDB Dark Matter tiles
- **Custom SVG markers:** Green (escaped), red (try again), gray (completed), blue/dashed (scheduled), gold with star (best)
- **Marker clustering** via Leaflet.markercluster
- **Popups:** Compact room info with photo, game, company, date, location, status, tags, blog link, morty link
- **Collapsible filter panel:** Search, Tag/Year/Country/Player dropdowns (server-rendered options), Status toggle
- **URL-driven:** Same query param scheme as list page
- **No footer** (full viewport layout)

### Stats Page (stats.njk)

- **Summary stats row:** Server-rendered from `stats` data
- **Charts (Chart.js, dark themed, client-rendered):**
  1. Time left — Bar chart (room date vs. minutes left, allows negatives), full-width, shown first
  2. Rooms per year — Stacked bar (escaped/try again/completed/scheduled)
  3. Monthly distribution — Bar chart (Jan–Dec aggregate)
  4. Rooms by state — Horizontal bar (US states only)
  5. Rooms by country — Horizontal bar (all countries)
  6. Top companies — Horizontal bar, top 10

### Feed (feed.njk)

- **Atom XML feed** at `/feed.xml`
- Includes all non-Scheduled rooms in reverse chronological order
- Each entry has room details as HTML content: status, company, date, location, time left, players, tags, notes, blog/morty links, photo
- Autodiscovery link in `<head>` of all pages

### 404 Page (404.njk)

- Escape-room-themed messaging ("This Room Doesn't Exist")
- Pulsing red ambient glow, lock icon with rotation wiggle animation
- "Find Your Way Back" button with sweep-shine effect
- Standard navigation for returning to real pages

## Analytics

Tinylytics integration on all pages (loaded in base.njk):
- **Embed script:** `https://tinylytics.app/embed/jDupbLUKfFyNMs5d5WjD.js?kudos&hits&countries&events`
- **Kudos:** Per-room thumbs up on room cards via `data-path="/room/{airtableId}"`
- **Event tracking:** `data-tinylytics-event="category.action"` attributes on interactive elements. Categories match page names (nav, card, list, map, scrapbook, filter, 404). Optional `data-tinylytics-event-value` for context (company name, game name, sort field).
- **Footer:** Visitor country flags (`tinylytics_countries`), hit counter (`tinylytics_hits`), copyright

## Server-Rendered vs Client-Rendered

| Feature | Rendered by | Data source |
|---------|------------|-------------|
| Stats rows (home, stats pages) | Server (11ty data) | stats.js |
| Recent room cards (home) | Server (room-card macro) | stats.js |
| Scheduled room cards (home) | Server (room-card macro) | stats.js |
| Room cards on list page | Server (room-card macro, filtered/sorted client-side) | rooms.json |
| Detail modal content (list) | Client (list.js) | Inlined listRooms JSON |
| Filter dropdown options | Server (filters data) | filters.js |
| Sitemap | Server (11ty collections) | — |
| Atom feed | Server (11ty/Nunjucks) | rooms.json |
| Scrapbook photos | Client (scrapbook.js) | Inlined scrapbook JSON |
| Map markers + popups | Client (map.js) | Inlined mapRooms JSON |
| Charts | Client (stats.js + Chart.js) | Inlined stats.charts JSON |
| Filtering/sorting/URL state | Client (list.js, map.js) | DOM data attrs / inlined JSON |

## Implementation Notes

### data.js — Shared Client-Side Utilities

Lightweight utility module with no data fetching. All room data is inlined at build time via `<script type="application/json">` blocks in each page template. Exports:
- `escapeHtml(str)` — HTML entity escaping for safe template literal interpolation
- `formatDate(dateStr)`, `formatLocation(location)` — Display formatting
- `renderTag(tag)` — Tag pill HTML (uses internal `classifyTag` and `formatTagLabel`)
- `statusBadgeHtml(status)` — Status badge HTML
- `getFilterParams()`, `setFilterParams(filters)` — URL query param helpers
- `initNav()` — Hamburger menu toggle

All pages use ES modules (`type="module"` in script tags).

### Inlined Data Pattern

Each page that needs room data has a corresponding `src/_data/*.js` file that pre-computes a trimmed dataset at build time. The template inlines it as `<script id="..." type="application/json">{{ data | dump | safe }}</script>`, and the client JS reads it synchronously via `JSON.parse(document.getElementById('...').textContent)`. This eliminates runtime `fetch()` calls and ensures pages render immediately with data.

### URL-driven Filter State

Both list and map pages:
1. Read `window.location.search` on load and apply as initial filter values
2. Update URL via `history.replaceState()` on filter change (no history pollution)
3. Support multiple tags comma-separated (`?tag=best,terpeca-2024`)
4. Support player filter (`?player=Tyler`)

### Responsive Design

- Hamburger nav on small screens
- Single-column card layout on mobile
- Full-width map on all sizes
- Charts stack vertically on mobile
- Filter bar wraps naturally
- Film grain texture disabled on mobile for performance

## What NOT to Build

- No CMS or admin interface
- No server-side runtime code
- No database
- No user authentication
- No comments or social features
- No rating input or forms
- No image gallery or photo uploads
- No escape room company logos
