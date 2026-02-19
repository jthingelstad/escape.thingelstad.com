# 11ty Migration Plan — Escape Things

## Overview

Migrate escape.thingelstad.com from hand-written static HTML to an [Eleventy (11ty)](https://www.11ty.dev/) static site generator. The goal is to eliminate repeated HTML (nav, footer, head), make `rooms.json` available at build time for server-rendered content, and keep the existing client-side interactivity (filtering, map, charts) intact.

The site will continue to be deployed on GitHub Pages, but now via a build step (GitHub Actions).

---

## Guiding Principles

1. **Incremental, not rewrite** — Migrate structure and templates first; preserve all existing CSS and JS as-is initially.
2. **Same output** — The built site should produce the same URLs, same HTML structure, and same visual result.
3. **Keep client-side JS for interactive pages** — List filtering/sorting, Leaflet map, and Chart.js remain client-side. 11ty provides the page shells and any server-rendered data.
4. **No framework** — Continue using plain HTML/CSS/JS. 11ty is a build tool, not a framework.

---

## Phase 1: Project Scaffolding

### 1.1 Initialize npm and install 11ty

```
npm init -y
npm install --save-dev @11ty/eleventy
```

Add to `package.json` scripts:
```json
{
  "scripts": {
    "start": "npx @11ty/eleventy --serve",
    "build": "npx @11ty/eleventy"
  }
}
```

### 1.2 Create `.eleventy.js` configuration

```
/
├── .eleventy.js          # 11ty config
├── src/                  # Source directory (new)
│   ├── _includes/        # Layouts & partials
│   ├── _data/            # Global data files
│   ├── css/              # Passthrough copy
│   ├── js/               # Passthrough copy
│   ├── images/           # Passthrough copy
│   ├── index.njk         # Home page
│   ├── list.njk          # Room list page
│   ├── map.njk           # Map page
│   ├── stats.njk         # Stats page
│   └── 404.njk           # 404 page
├── _site/                # Build output (gitignored)
├── data/                 # Keep rooms.json at repo root for direct access
└── ...
```

Key `.eleventy.js` decisions:
- **Input directory:** `src/`
- **Output directory:** `_site/`
- **Template language:** Nunjucks (`.njk`) — widely used with 11ty, good for layouts
- **Passthrough copy:** `css/`, `js/`, `images/`, `data/`, `CNAME`, `robots.txt`, `sitemap.xml`, `favicon.svg`

### 1.3 Update `.gitignore`

Add:
```
_site/
node_modules/
```

---

## Phase 2: Layouts and Partials

### 2.1 Create base layout: `src/_includes/base.njk`

Extract the common HTML wrapper shared by all 5 pages:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }} — Escape Things</title>
    <meta name="description" content="{{ description }}">
    <link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Raleway:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
    {% block head %}{% endblock %}
</head>
<body>
    {% include "nav.njk" %}
    {% block content %}{% endblock %}
    {% if showFooter !== false %}
    {% include "footer.njk" %}
    {% endif %}
    {% block scripts %}{% endblock %}
    <script src="https://tinylytics.app/embed/jDupbLUKfFyNMs5d5WjD.js?kudos=👍&hits&countries" defer></script>
</body>
</html>
```

Benefits:
- Single place to update `<head>` contents (fonts, favicon, meta)
- Single place for Tinylytics script
- Per-page `title` and `description` via front matter
- `{% block head %}` for page-specific CSS/scripts (Leaflet, Chart.js)
- `{% block scripts %}` for page-specific JS modules
- `showFooter: false` option for map page (no footer)

### 2.2 Create navigation partial: `src/_includes/nav.njk`

Extract the `<nav class="main-nav">` block. Use a variable or 11ty's `page.url` to mark the active link:

```html
<nav class="main-nav">
    <a href="/" class="nav-logo">Escaping Things</a>
    <button class="nav-toggle" aria-label="Toggle navigation">☰</button>
    <div class="nav-links">
        <a href="/"{% if page.url == "/" %} class="active"{% endif %}>Home</a>
        <a href="/list/"{% if page.url == "/list/" %} class="active"{% endif %}>Rooms</a>
        <a href="/map/"{% if page.url == "/map/" %} class="active"{% endif %}>Map</a>
        <a href="/stats/"{% if page.url == "/stats/" %} class="active"{% endif %}>Stats</a>
    </div>
</nav>
```

### 2.3 Create footer partial: `src/_includes/footer.njk`

Extract the `<footer class="site-footer">` block (identical on all pages except map).

---

## Phase 3: Data Layer

### 3.1 Move `data/rooms.json` → `src/_data/rooms.json`

11ty's data cascade will automatically make `rooms` available in all templates. The file stays committed to the repo.

Additionally, copy `data/rooms.json` to the output via passthrough so that client-side JS (`data.js`) can still fetch it at `/data/rooms.json`.

### 3.2 Create computed data file: `src/_data/stats.js`

A Node.js file that pre-computes values the templates need at build time:

```js
const rooms = require('./rooms.json');

module.exports = function() {
    const completed = rooms.rooms.filter(r => r.status === 'completed');
    const planned = rooms.rooms.filter(r => r.status === 'planned');
    const wins = completed.filter(r => r.win);
    const latestCompleted = completed.sort((a, b) => b.date.localeCompare(a.date))[0];
    const regions = new Set(completed.map(r => r.location?.region).filter(Boolean));
    const countries = new Set(completed.map(r => r.location?.country).filter(Boolean));
    const companies = new Set(completed.map(r => r.company));
    const years = [...new Set(completed.map(r => r.date.slice(0, 4)))].sort();

    return {
        totalRooms: completed.length,
        totalWins: wins.length,
        winRate: Math.round((wins.length / completed.length) * 100),
        regionCount: regions.size,
        countryCount: countries.size,
        companyCount: companies.size,
        yearsActive: years.length,
        firstYear: years[0],
        lastYear: years[years.length - 1],
        latestCompleted,
        planned
    };
};
```

This lets the home page and stats page render summary numbers at build time (no flash of loading state).

---

## Phase 4: Page Templates

### 4.1 Home page — `src/index.njk`

```yaml
---
title: Home
description: The Thingelstad family's escape room journey.
permalink: /index.html
---
```

- **Hero section:** Static HTML (no data dependency) — just the title, keyhole, subtitle
- **Stats row:** Rendered at build time using `{{ stats.totalRooms }}`, `{{ stats.winRate }}%`, etc. — **no loading flash**
- **Latest room:** Rendered at build time from `stats.latestCompleted` — server-rendered card HTML
- **Upcoming rooms:** Rendered at build time from `stats.planned` array, with `{% if stats.planned.length %}` conditional
- **Quick links:** Static HTML

The home page becomes **fully server-rendered** — no client-side JS needed except `initNav()` and Tinylytics.

### 4.2 Room list page — `src/list.njk`

```yaml
---
title: All Rooms
description: Browse and filter all escape rooms.
permalink: /list.html
---
```

- **Filter bar:** Static HTML (dropdowns, search input)
- **Room grid:** Initially empty `<div id="room-grid">` — populated by client-side `list.js`
- **JS module:** `<script type="module" src="/js/list.js"></script>` — unchanged

The list page remains client-side interactive. 11ty provides the page shell only. Filter dropdowns could optionally be pre-populated at build time using data, but this is a future optimization.

### 4.3 Map page — `src/map.njk`

```yaml
---
title: Map
description: Explore escape room locations on an interactive map.
permalink: /map.html
showFooter: false
---
```

- **Leaflet/markercluster CDN links** in `{% block head %}`
- **Filter panel + map div:** Static HTML
- **JS module:** `<script type="module" src="/js/map.js"></script>` — unchanged

Fully client-side interactive. 11ty provides the page shell only.

### 4.4 Stats page — `src/stats.njk`

```yaml
---
title: Statistics
description: Charts and statistics about our escape room adventures.
permalink: /stats.html
---
```

- **Summary stats row:** Server-rendered at build time (same as home page)
- **Chart canvases:** Empty `<canvas>` elements — populated by client-side `stats.js`
- **Chart.js CDN link** in `{% block head %}`
- **JS module:** `<script type="module" src="/js/stats.js"></script>` — unchanged

### 4.5 404 page — `src/404.njk`

```yaml
---
title: Room Not Found
description: This room doesn't exist.
permalink: /404.html
---
```

Fully static content. No data dependencies.

---

## Phase 5: URL Structure (Pretty URLs)

Adopt 11ty's default pretty URL convention:

| Current | 11ty Output | Served As |
|---------|------------|-----------|
| `/index.html` | `/index.html` | `/` |
| `/list.html` | `/list/index.html` | `/list/` |
| `/map.html` | `/map/index.html` | `/map/` |
| `/stats.html` | `/stats/index.html` | `/stats/` |
| `/404.html` | `/404.html` | `/404.html` (special case) |

Navigation links update from `/list.html` → `/list/`, etc. Internal links in JS update accordingly.

**JS update needed:** `data.js` fetches `data/rooms.json` with a relative path — this must become an absolute path (`/data/rooms.json`) since pages now live in subdirectories.

---

## Phase 6: Passthrough File Copy

In `.eleventy.js`, configure passthrough copy for files that need no processing:

```js
eleventyConfig.addPassthroughCopy("src/css");
eleventyConfig.addPassthroughCopy("src/js");
eleventyConfig.addPassthroughCopy("src/images");
eleventyConfig.addPassthroughCopy({ "src/_data/rooms.json": "data/rooms.json" });
eleventyConfig.addPassthroughCopy("src/CNAME");
eleventyConfig.addPassthroughCopy("src/robots.txt");
eleventyConfig.addPassthroughCopy("src/sitemap.xml");
```

This ensures:
- CSS, JS, and images are copied to `_site/` unchanged
- `rooms.json` is available at `/data/rooms.json` for client-side fetch
- GitHub Pages config files are preserved

---

## Phase 7: Nunjucks Filters & Helpers

Register custom filters in `.eleventy.js` for template use:

```js
// Format ISO date to "August 2, 2025"
eleventyConfig.addFilter("formatDate", (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
});

// Format location object to "City, Region, Country"
eleventyConfig.addFilter("formatLocation", (loc) => {
    const parts = [loc.city, loc.region, loc.country].filter(Boolean);
    return parts.join(', ');
});

// Classify tag for CSS class
eleventyConfig.addFilter("classifyTag", (tag) => {
    if (tag === 'best') return 'best';
    if (tag.startsWith('terpeca-')) return 'terpeca';
    if (tag === 'online') return 'online';
    if (tag.match(/^[a-z]+-\d{4}$/)) return 'trip';
    return 'default';
});

// Format tag for display label
eleventyConfig.addFilter("formatTagLabel", (tag) => {
    if (tag === 'best') return '★ Best';
    if (tag.startsWith('terpeca-')) return 'TERPECA ' + tag.split('-')[1];
    if (tag === 'online') return 'Online';
    if (tag.match(/^[a-z]+-\d{4}$/)) {
        const [place, year] = tag.split('-');
        return place.charAt(0).toUpperCase() + place.slice(1) + ' ' + year;
    }
    return tag;
});
```

### 7.1 Room card as a Nunjucks macro or shortcode

Create `src/_includes/room-card.njk` — a reusable macro that mirrors the output of `renderRoomCard()` in `data.js`:

```html
{% macro roomCard(room, options = {}) %}
<div class="room-card{% if options.featured %} featured{% endif %}">
    <div class="room-card-header">
        <div class="room-card-title">
            <span class="room-number">#{{ room.id }}</span>
            <h3>{{ room.game }}</h3>
        </div>
        {% if room.status == "completed" %}
            {% if room.win %}
                <span class="status-badge status-win">✓ Escaped</span>
            {% else %}
                <span class="status-badge status-loss">✗ Locked Out</span>
            {% endif %}
        {% else %}
            <span class="status-badge status-planned">Planned</span>
        {% endif %}
    </div>
    <!-- ... remaining card fields ... -->
</div>
{% endmacro %}
```

This macro is used by the home page (latest room, upcoming rooms) for build-time rendering. The list page continues using the client-side `renderRoomCard()` from `data.js` for dynamic filtering.

---

## Phase 8: GitHub Actions Deployment

### 8.1 Create `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 8.2 Update GitHub Pages settings

Switch from "Deploy from branch" to "GitHub Actions" as the source in the repository settings.

---

## Phase 9: Cleanup

After confirming the 11ty build produces equivalent output:

1. Remove the old root-level HTML files (`index.html`, `list.html`, etc.)
2. Move `css/`, `js/`, `images/` into `src/`
3. Move `CNAME`, `robots.txt`, `sitemap.xml` into `src/`
4. Verify all passthrough copies work
5. Update `CLAUDE.md` to reflect new structure

---

## Final File Structure

```
/
├── .eleventy.js              # 11ty configuration
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions deploy
├── package.json              # npm config with 11ty
├── package-lock.json
├── .gitignore                # Adds _site/, node_modules/
├── CLAUDE.md                 # Updated project docs
├── src/
│   ├── _data/
│   │   ├── rooms.json        # Room data (moved from data/)
│   │   └── stats.js          # Computed stats for templates
│   ├── _includes/
│   │   ├── base.njk          # Base HTML layout
│   │   ├── nav.njk           # Navigation partial
│   │   ├── footer.njk        # Footer partial
│   │   └── room-card.njk     # Room card macro
│   ├── css/
│   │   └── style.css         # Unchanged
│   ├── js/
│   │   ├── data.js           # Unchanged (client-side data layer)
│   │   ├── list.js           # Unchanged
│   │   ├── map.js            # Unchanged
│   │   └── stats.js          # Unchanged
│   ├── images/
│   │   └── favicon.svg       # Unchanged
│   ├── CNAME                 # GitHub Pages domain
│   ├── robots.txt            # SEO
│   ├── sitemap.xml           # SEO
│   ├── index.njk             # Home page template
│   ├── list.njk              # Room list template
│   ├── map.njk               # Map template
│   ├── stats.njk             # Stats template
│   └── 404.njk               # 404 template
├── _site/                    # Build output (gitignored)
└── morty_escapes.csv         # External data (ignored)
```

---

## What Changes vs. What Stays the Same

### Changes
- HTML pages become Nunjucks templates with shared layouts
- Repeated nav/footer/head extracted into partials
- Home page stats and latest room rendered at build time (no loading flash)
- Build step required (`npm run build`)
- Deployment via GitHub Actions instead of direct branch deploy
- `data/rooms.json` moves to `src/_data/rooms.json`

### Stays the Same
- All CSS — unchanged
- All client-side JS (`data.js`, `list.js`, `map.js`, `stats.js`) — unchanged
- URL structure — identical
- Visual output — identical
- Data schema — identical
- CDN dependencies (Leaflet, Chart.js, Google Fonts, Tinylytics) — unchanged
- Filtering, sorting, map interactivity — all still client-side

---

## Implementation Order

1. Scaffolding: npm init, install 11ty, create `.eleventy.js`, update `.gitignore`
2. Create `src/_includes/base.njk`, `nav.njk`, `footer.njk`
3. Create `src/_data/rooms.json` (copy) and `src/_data/stats.js`
4. Create Nunjucks filters in `.eleventy.js`
5. Create `src/_includes/room-card.njk` macro
6. Convert each page to `.njk` template (404 first as simplest, then index, list, map, stats)
7. Move static assets into `src/` and configure passthrough copy
8. Verify `npx @11ty/eleventy` produces correct output
9. Create GitHub Actions workflow
10. Clean up old root-level files
11. Update `CLAUDE.md`

---

## Open Questions (Deferred)

1. ~~**Pretty URLs:**~~ **Resolved** — adopting pretty URLs (`/list/`, `/map/`, `/stats/`).

2. **Server-rendering the list/map filter dropdowns:** The filter dropdowns (tags, years, countries, players) could be pre-populated at build time from `rooms.json` data. This would eliminate the brief loading state. Worth doing in a follow-up?

3. **Individual room pages:** 11ty makes it trivial to generate a page per room (`/room/42/`). This isn't part of the current site but would be easy to add. Future enhancement?

4. **Sitemap generation:** 11ty has plugins to auto-generate `sitemap.xml`. Should we switch from the hand-written one, or keep it manual?
