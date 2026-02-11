# Escape Things — Project Reference

## Project Overview

A static website for "Escape Things" at escape.thingelstad.com — a personal site showcasing the Thingelstad family's escape room journey. Hosted on GitHub Pages with no build step. Static HTML, CSS, and JavaScript reading from a `data/rooms.json` file committed in the repo. No frameworks, no bundler, no npm.

## Tech Stack

- Plain HTML, CSS, JavaScript (no React, no framework)
- Leaflet.js v1.9.4 via CDN for maps
- Leaflet.markercluster v1.5.3 via CDN for marker clustering
- Chart.js v4.4.7 via CDN for stats charts
- Google Fonts: Cinzel (headings) + Raleway (body)
- Tinylytics for analytics (kudos, hit counter, visitor countries)
- GitHub Pages hosting (static files only)
- `data/rooms.json` is the single data source, committed to the repo

## File Structure

```
/
├── index.html          # Home page
├── list.html           # Filterable room list
├── map.html            # Interactive map
├── stats.html          # Charts and statistics
├── 404.html            # Escape-room-themed 404 page
├── sitemap.xml         # Sitemap for search engines
├── robots.txt          # Allows all crawlers, references sitemap
├── CNAME               # Contains: escape.thingelstad.com
├── css/
│   └── style.css       # Shared styles (~1500 lines)
├── js/
│   ├── data.js         # Fetch/parse rooms.json, shared utilities, room card rendering
│   ├── list.js         # List page logic (filter, sort, URL state)
│   ├── map.js          # Map page logic (Leaflet, markers, filter panel)
│   └── stats.js        # Stats page logic (Chart.js charts)
├── data/
│   └── rooms.json      # Room data (86 rooms, see schema below)
└── images/
    └── favicon.svg     # Key-shaped gold SVG favicon
```

## Data Schema

`data/rooms.json` contains an array of room objects:

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
- `tags` — Array of strings. May be empty. Values include "best", "online", terpeca tags ("terpeca-2024"), and trip tags ("quebec-2025").
- `players` — Array of first names (capitalized). May be empty. Extracted from notes where available. 14 unique players across 35 rooms.
- `notes` — May be null. Shown on cards. Player-only notes were cleared when players were extracted.

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

### Navigation

Frosted glass navbar (backdrop-filter blur) on all pages. Links: Home, Rooms, Map, Stats. Active page highlighted. "Escape Things" wordmark on left. Hamburger menu on mobile. Initialized via `initNav()` from data.js.

### Room Card

Reusable card rendered by `renderRoomCard(room, options)` in data.js. Shows:
- Room number (#id) and game name as heading
- Company name (linked to companyUrl if available)
- Formatted date (e.g. "August 2, 2025")
- Location (city, region, country)
- Win/loss/planned status badge (✓ Escaped / ✗ Locked Out / Planned)
- Escape time with stopwatch icon (if available)
- Players with 👥 icon (comma-separated, if available)
- Tags as styled pills
- Blog post link ("Read post →" if blogUrl exists)
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

### Home Page (index.html)

- **Hero:** Animated shimmer title "Escape Things", keyhole motif, subtitle, breathing ambient light
- **Stats row:** Total rooms, wins, win rate, regions, countries, companies, years active
- **Latest room:** Most recent completed room as featured card
- **Upcoming:** Conditional section showing planned rooms (hidden if none)
- **Quick links:** Three themed cards (gold/teal/purple glow) linking to Rooms, Map, Stats

### List Page (list.html)

- **Filter bar:** Search input (debounced), Tag dropdown, Year dropdown (descending), Status toggle, Win/Loss toggle, Country dropdown, Player dropdown, Clear All button
- **Active filter pills:** Dismissible pills showing current filters
- **URL-driven:** All filters reflected in query params (`?tag=best&player=Tyler&year=2025`), applied on load, updated via replaceState
- **Sort controls:** Date (default desc), Game, Company, City — click to toggle direction
- **Results:** Count display ("Showing 12 of 86 rooms"), room cards in grid layout

### Map Page (map.html)

- **Full-viewport Leaflet map** with CartoDB Dark Matter tiles
- **Custom SVG markers:** Green (win), red (loss), blue/dashed (planned), gold with star (best)
- **Marker clustering** via Leaflet.markercluster
- **Popups:** Compact room info with game, company, date, location, status, tags, blog link
- **Collapsible filter panel:** Same filters as list page (search, tag, year, status, country, player)
- **URL-driven:** Same query param scheme as list page
- **No footer** (full viewport layout)

### Stats Page (stats.html)

- **Summary stats row:** Total rooms, wins, win rate, regions, countries, companies, years active
- **Charts (Chart.js, dark themed):**
  1. Rooms per year — Stacked bar (wins/losses)
  2. Monthly distribution — Bar chart (Jan–Dec aggregate)
  3. Rooms by region/country — Horizontal bar, top 15
  4. Top companies — Horizontal bar, top 10
  5. Escape times — Scatter plot (room date vs. minutes), full-width

### 404 Page (404.html)

- Escape-room-themed messaging ("This Room Doesn't Exist")
- Pulsing red ambient glow, lock icon with rotation wiggle animation
- "Find Your Way Back" button with sweep-shine effect
- Standard navigation for returning to real pages

## Analytics

Tinylytics integration on all pages:
- **Embed script:** `https://tinylytics.app/embed/jDupbLUKfFyNMs5d5WjD.js?kudos&hits&countries`
- **Kudos:** Per-room thumbs up on room cards via `data-path="/room/{id}"`
- **Footer:** Visitor country flags (`tinylytics_countries`), hit counter (`tinylytics_hits`), copyright

## Implementation Notes

### data.js — Shared Data Layer

Fetches `data/rooms.json` once and caches it. Exports:
- `loadRooms()`, `getRooms()`, `getCompletedRooms()`, `getPlannedRooms()`
- `getAllTags()`, `getAllYears()`, `getAllCountries()`, `getAllPlayers()`
- `filterRooms(filters)` — Takes `{q, tag, year, status, win, country, player}`, returns matching rooms
- `parseEscapeTime(str)`, `escapeTimeMinutes(str)` — Parse "49m 5s" to seconds/minutes
- `formatDate(dateStr)`, `formatLocation(location)`
- `classifyTag(tag)`, `formatTagLabel(tag)`, `renderTag(tag)`
- `renderRoomCard(room, options)` — Full card HTML generation
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
- No build step or bundler
- No server-side code
- No database
- No user authentication
- No comments or social features
- No rating input or forms
- No image gallery or photo uploads
- No escape room company logos
