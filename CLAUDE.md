# Escaping Things — Project Reference

## Project Overview

A static website for "Escaping Things" at escape.thingelstad.com — a personal site showcasing the Thingelstad family's escape room journey. Built with 11ty (Eleventy) and hosted on GitHub Pages. Nunjucks templates, CSS, and JavaScript reading from a `data/rooms.json` file committed in the repo.

## Tech Stack

- **11ty (Eleventy) v3** — Static site generator with Nunjucks templates
- Plain CSS and JavaScript (no React, no framework, no bundler)
- Leaflet.js v1.9.4 via CDN for maps
- Leaflet.markercluster v1.5.3 via CDN for marker clustering
- Chart.js v4.4.7 via CDN for stats charts
- Google Fonts: Cinzel (headings) + Raleway (body)
- Tinylytics for analytics (kudos, hit counter, visitor countries)
- GitHub Pages hosting via GitHub Actions
- `data/rooms.json` is the single data source, committed to the repo

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
│   ├── list.njk              # Filterable room list
│   ├── map.njk               # Interactive map
│   ├── stats.njk             # Charts and statistics
│   ├── 404.njk               # Escape-room-themed 404 page
│   ├── sitemap.njk           # Auto-generated sitemap from collections
│   ├── _includes/            # Nunjucks partials & layouts
│   │   ├── base.njk          # Base HTML layout (head, scripts, footer)
│   │   ├── nav.njk           # Navigation bar
│   │   ├── footer.njk        # Site footer
│   │   └── room-card.njk     # Reusable room card macro
│   ├── _data/                # 11ty data files
│   │   ├── rooms.json        # Room data (86+ rooms)
│   │   ├── stats.js          # Computed stats (totals, win rate, latest room, planned)
│   │   └── filters.js        # Filter options (tags, years, countries, players)
│   ├── css/
│   │   └── style.css         # Shared styles (~1500 lines)
│   ├── js/
│   │   ├── data.js           # Client-side: fetch rooms.json, filtering, card rendering
│   │   ├── list.js           # List page logic (filter, sort, URL state)
│   │   ├── map.js            # Map page logic (Leaflet, markers, filter panel)
│   │   └── stats.js          # Stats page logic (Chart.js charts)
│   ├── images/
│   │   └── favicon.svg       # Key-shaped gold SVG favicon
│   ├── CNAME                 # Contains: escape.thingelstad.com
│   └── robots.txt            # Allows all crawlers, references sitemap
├── _site/                    # Built output (do not edit)
└── .github/workflows/
    └── deploy.yml            # GitHub Actions: build + deploy to Pages
```

## Data Schema

`src/_data/rooms.json` contains an array of room objects:

```json
{
  "rooms": [
    {
      "id": 79,
      "game": "Magnifico",
      "company": "Escaparium",
      "date": "2025-08-02",
      "status": "completed",
      "win": true,
      "escapeTime": "52m 30s",
      "location": {
        "city": "Montreal",
        "region": "Quebec",
        "country": "CA",
        "lat": 45.585974,
        "lng": -73.768325
      },
      "companyUrl": "https://www.escaparium.ca/",
      "blogUrl": "https://www.thingelstad.com/2025/08/02/magnifico-at-escaparium.html",
      "mortyId": "abc123",
      "tags": ["best"],
      "players": ["Jamie", "Tammy", "Mazie", "Tyler"],
      "notes": "Jamie & Mazie favorite of 2025"
    }
  ]
}
```

Field notes:
- `id` — Sequential integer (1–86+). Primary identifier.
- `date` — ISO 8601 (YYYY-MM-DD).
- `status` — "completed" or "planned".
- `win` — Boolean or null (null for planned rooms).
- `escapeTime` — String like "49m 5s" or null.
- `location.region` — State (US), province (CA), or null (international). Not "state".
- `location.lat` / `location.lng` — May be null for online rooms (don't render on map).
- `companyUrl` / `blogUrl` — May be null.
- `mortyId` — String or absent. Links to morty.app attraction page.
- `tags` — Array of strings. May be empty. Values include "best", "online", terpeca tags ("terpeca-2024"), and trip tags ("quebec-2025").
- `players` — Array of first names (capitalized). May be empty.
- `notes` — May be null. Shown on cards.

## 11ty Data Layer

Data files in `src/_data/` are available globally in templates:

- **`rooms.json`** — Raw room data. Accessed as `rooms.rooms` in templates.
- **`stats.js`** — Computed at build time. Provides `stats.totalRooms`, `stats.totalWins`, `stats.winRate`, `stats.regionCount`, `stats.countryCount`, `stats.companyCount`, `stats.yearsActive`, `stats.latestCompleted`, `stats.planned`.
- **`filters.js`** — Computed at build time. Provides `filters.tags`, `filters.years`, `filters.countries`, `filters.players` for pre-populating filter dropdowns.

## 11ty Nunjucks Filters (eleventy.config.js)

- `formatDate` — "2025-08-02" → "August 2, 2025"
- `formatLocation` — location object → "City, Region, Country"
- `classifyTag` — tag → CSS class: "best", "terpeca", "online", "trip", "default"
- `formatTagLabel` — tag → display label: "best" → "★ Best", "terpeca-2024" → "TERPECA 2024"

## Design

Dark, moody, immersive "escape room" aesthetic with atmospheric effects.

- **Background:** Very dark (#060910) with SVG film grain noise texture overlay
- **Accent colors:** Gold (#e6b84f) for highlights/best rooms, teal (#4fd1c5) for interactive elements, red (#f06060) for losses, blue (#60a5fa) for planned
- **Typography:** Cinzel (display/headings — mysterious vintage feel), Raleway (body — clean sans-serif)
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
  - Quick-link cards with per-card themed glow (gold/teal/purple)
  - 404 page with pulsing red ambient, lock wiggle, sweep-shine button
- **Footer:** Gold gradient accent line, Tinylytics visitor countries, hit counter, copyright

## Shared Components

### Navigation (nav.njk)

Frosted glass navbar (backdrop-filter blur) on all pages. Links: Home, Rooms, Map, Stats. Active page highlighted via `page.url`. "Escaping Things" wordmark on left. Hamburger menu on mobile. Toggle initialized via `initNav()` from data.js.

### Room Card (room-card.njk)

Nunjucks macro `roomCard(room, options)`. Server-rendered on home page, client-rendered on list/map. Shows:
- Room number (#id) and game name as heading
- Company name (linked to companyUrl if available)
- Formatted date (e.g. "August 2, 2025")
- Location (city, region, country)
- Win/loss/planned status badge (✓ Escaped / ✗ Locked Out / Planned)
- Escape time with stopwatch icon (if available)
- Players with 👥 icon (comma-separated, if available)
- Tags as styled pills
- Blog post link ("Read post →" if blogUrl exists)
- Morty link ("Morty →" if mortyId exists)
- Tinylytics kudos button (data-path="/room/{id}")
- Notes (muted italic text, non-compact mode only)

Options: `{ compact: boolean, featured: boolean }`

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
- **Latest room:** Most recent completed room as featured card (server-rendered via room-card macro)
- **Upcoming:** Conditional section showing planned rooms (hidden if none)
- **Quick links:** Three themed cards (gold/teal/purple glow) linking to Rooms, Map, Stats

### List Page (list.njk)

- **Filter bar:** Search input (debounced), Tag/Year/Country/Player dropdowns (server-rendered options), Status toggle, Win/Loss toggle, Clear All button
- **Active filter pills:** Dismissible pills showing current filters
- **URL-driven:** All filters reflected in query params (`?tag=best&player=Tyler&year=2025`), applied on load, updated via replaceState
- **Sort controls:** Date (default desc), Game, Company, City — click to toggle direction
- **Results:** Count display ("Showing 12 of 86 rooms"), room cards in grid layout (client-rendered)

### Map Page (map.njk)

- **Full-viewport Leaflet map** with CartoDB Dark Matter tiles
- **Custom SVG markers:** Green (win), red (loss), blue/dashed (planned), gold with star (best)
- **Marker clustering** via Leaflet.markercluster
- **Popups:** Compact room info with game, company, date, location, status, tags, blog link
- **Collapsible filter panel:** Search, Tag/Year/Country/Player dropdowns (server-rendered options), Status toggle
- **URL-driven:** Same query param scheme as list page
- **No footer** (full viewport layout)

### Stats Page (stats.njk)

- **Summary stats row:** Server-rendered from `stats` data
- **Charts (Chart.js, dark themed, client-rendered):**
  1. Rooms per year — Stacked bar (wins/losses)
  2. Monthly distribution — Bar chart (Jan–Dec aggregate)
  3. Rooms by region/country — Horizontal bar, top 15
  4. Top companies — Horizontal bar, top 10
  5. Escape times — Scatter plot (room date vs. minutes), full-width

### 404 Page (404.njk)

- Escape-room-themed messaging ("This Room Doesn't Exist")
- Pulsing red ambient glow, lock icon with rotation wiggle animation
- "Find Your Way Back" button with sweep-shine effect
- Standard navigation for returning to real pages

## Analytics

Tinylytics integration on all pages (loaded in base.njk):
- **Embed script:** `https://tinylytics.app/embed/jDupbLUKfFyNMs5d5WjD.js?kudos&hits&countries`
- **Kudos:** Per-room thumbs up on room cards via `data-path="/room/{id}"`
- **Footer:** Visitor country flags (`tinylytics_countries`), hit counter (`tinylytics_hits`), copyright

## Server-Rendered vs Client-Rendered

| Feature | Rendered by |
|---------|------------|
| Stats rows (home, stats pages) | Server (11ty data) |
| Latest room card (home) | Server (room-card macro) |
| Planned room cards (home) | Server (room-card macro) |
| Filter dropdown options | Server (filters data) |
| Sitemap | Server (11ty collections) |
| Room cards on list page | Client (data.js) |
| Map markers + popups | Client (map.js) |
| Charts | Client (stats.js + Chart.js) |
| Filtering/sorting/URL state | Client (list.js, map.js) |

## Implementation Notes

### data.js — Client-Side Data Layer

Fetches `/data/rooms.json` once and caches it. Exports:
- `loadRooms()`, `getRooms()`, `getCompletedRooms()`, `getPlannedRooms()`
- `getAllTags()`, `getAllYears()`, `getAllCountries()`, `getAllPlayers()`
- `filterRooms(filters)` — Takes `{q, tag, year, status, win, country, player}`, returns matching rooms
- `parseEscapeTime(str)`, `escapeTimeMinutes(str)` — Parse "49m 5s" to seconds/minutes
- `formatDate(dateStr)`, `formatLocation(location)`
- `classifyTag(tag)`, `formatTagLabel(tag)`, `renderTag(tag)`
- `renderRoomCard(room, options)` — Full card HTML generation (for client-side rendering)
- `getFilterParams()`, `setFilterParams(filters)` — URL query param helpers
- `initNav()` — Hamburger menu toggle

All pages use ES modules (`type="module"` in script tags).

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
