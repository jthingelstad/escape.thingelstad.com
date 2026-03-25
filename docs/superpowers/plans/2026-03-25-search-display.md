# Search Display Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five Pagefind search display issues — leaked metadata in titles, noisy snippets, missing type badges, broken emoji, and poor ranking.

**Architecture:** Fix source metadata in four Nunjucks templates (room, list, player, trip), add a `processResult` callback to PagefindUI for type badges, and tune ranking. All changes are to existing files; no new files.

**Tech Stack:** Eleventy 3, Nunjucks, Pagefind (PagefindUI), CSS

**Spec:** `docs/superpowers/specs/2026-03-25-search-display-design.md`

---

### Task 1: Fix room page metadata and emoji noise

**Files:**

- Modify: `src/room.njk:31` (pagefind-meta attribute)
- Modify: `src/room.njk:50,66,73` (meta-icon emoji spans)

- [ ] **Step 1: Fix the `data-pagefind-meta` attribute on line 31**

Change:

```njk
data-pagefind-meta="title:{{ room.game | safe }}{% if room.company %}, company:{{ room.company.name }}{% endif %}"
```

to:

```njk
data-pagefind-meta="title:{{ room.game | safe }}, type:room"
```

This drops the `company:` meta field (which leaked into displayed titles) and adds a `type:room` field for badge rendering.

- [ ] **Step 2: Wrap the calendar emoji on line 50 with `data-pagefind-ignore`**

Change:

```njk
<span class="meta-icon">📅</span> {{ room.date | formatDate }}
```

to:

```njk
<span class="meta-icon" data-pagefind-ignore>📅</span> {{ room.date | formatDate }}
```

- [ ] **Step 3: Wrap the stopwatch emoji on line 66 with `data-pagefind-ignore`**

Change:

```njk
<span class="meta-icon">⏱</span> {{ room.timeLeft | formatTimeLeft }}
```

to:

```njk
<span class="meta-icon" data-pagefind-ignore>⏱</span> {{ room.timeLeft | formatTimeLeft }}
```

- [ ] **Step 4: Add `data-pagefind-ignore` to the stats section on line 120**

Change:

```njk
<section class="room-stats-section">
```

to:

```njk
<section class="room-stats-section" data-pagefind-ignore>
```

- [ ] **Step 5: Add `data-pagefind-ignore` to the ratings section on line 193**

Change:

```njk
<section class="room-ratings-section">
```

to:

```njk
<section class="room-ratings-section" data-pagefind-ignore>
```

- [ ] **Step 6: Verify the site still builds**

Run: `npx @11ty/eleventy`

Expected: Build completes with no errors, same number of output files.

- [ ] **Step 7: Commit**

```bash
git add src/room.njk
git commit -m "Fix room page Pagefind metadata and suppress emoji/stats noise"
```

---

### Task 2: Add type metadata and noise reduction to list pages

**Files:**

- Modify: `src/list-detail.njk:15` (add type meta)
- Modify: `src/list-detail.njk:26,42` (ignore structural headings)

- [ ] **Step 1: Add `data-pagefind-meta="type:list"` to the `<main>` tag on line 15**

Change:

```njk
<main class="container page-content featured-detail-page" data-pagefind-body>
```

to:

```njk
<main class="container page-content featured-detail-page" data-pagefind-body data-pagefind-meta="type:list">
```

- [ ] **Step 2: Add `data-pagefind-ignore` to the "Attached To" heading on line 26**

Change:

```njk
<h2>Attached To</h2>
```

to:

```njk
<h2 data-pagefind-ignore>Attached To</h2>
```

- [ ] **Step 3: Add `data-pagefind-ignore` to the "Rooms" heading on line 42**

Change:

```njk
<h2>Rooms</h2>
```

to:

```njk
<h2 data-pagefind-ignore>Rooms</h2>
```

- [ ] **Step 4: Verify the site still builds**

Run: `npx @11ty/eleventy`

Expected: Build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/list-detail.njk
git commit -m "Add Pagefind type metadata and suppress structural headings on list pages"
```

---

### Task 3: Add type metadata and noise reduction to player pages

**Files:**

- Modify: `src/player.njk:15` (add type meta)
- Modify: `src/player.njk:34,51,70` (ignore structural headings)

- [ ] **Step 1: Add `data-pagefind-meta="type:player"` to the `<main>` tag on line 15**

Change:

```njk
<main class="container page-content featured-detail-page" data-pagefind-body>
```

to:

```njk
<main class="container page-content featured-detail-page" data-pagefind-body data-pagefind-meta="type:player">
```

- [ ] **Step 2: Add `data-pagefind-ignore` to the "Lists" heading on line 34**

Change:

```njk
<h2>Lists</h2>
```

to:

```njk
<h2 data-pagefind-ignore>Lists</h2>
```

- [ ] **Step 3: Add `data-pagefind-ignore` to the "Recent Notes" heading on line 51**

Change:

```njk
<h2>Recent Notes</h2>
```

to:

```njk
<h2 data-pagefind-ignore>Recent Notes</h2>
```

- [ ] **Step 4: Add `data-pagefind-ignore` to the "All Rooms" heading on line 70**

Change:

```njk
<h2>All Rooms</h2>
```

to:

```njk
<h2 data-pagefind-ignore>All Rooms</h2>
```

- [ ] **Step 5: Verify the site still builds**

Run: `npx @11ty/eleventy`

Expected: Build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/player.njk
git commit -m "Add Pagefind type metadata and suppress structural headings on player pages"
```

---

### Task 4: Add type metadata and noise reduction to trip pages

**Files:**

- Modify: `src/trip.njk:22` (add type meta)
- Modify: `src/trip.njk:33,50` (ignore structural headings)

- [ ] **Step 1: Add `data-pagefind-meta="type:trip"` to the `<main>` tag on line 22**

Change:

```njk
<main class="container page-content featured-detail-page" data-pagefind-body>
```

to:

```njk
<main class="container page-content featured-detail-page" data-pagefind-body data-pagefind-meta="type:trip">
```

- [ ] **Step 2: Add `data-pagefind-ignore` to the "Route" heading on line 33**

Change:

```njk
<h2>Route</h2>
```

to:

```njk
<h2 data-pagefind-ignore>Route</h2>
```

- [ ] **Step 3: Add `data-pagefind-ignore` to the "Lists" heading on line 50**

Change:

```njk
<h2>Lists</h2>
```

to:

```njk
<h2 data-pagefind-ignore>Lists</h2>
```

- [ ] **Step 4: Verify the site still builds**

Run: `npx @11ty/eleventy`

Expected: Build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/trip.njk
git commit -m "Add Pagefind type metadata and suppress structural headings on trip pages"
```

---

### Task 5: Add type badge CSS

**Files:**

- Modify: `src/css/components.css` (after the existing Pagefind overrides, around line 1126)

- [ ] **Step 1: Add type badge styles after the existing Pagefind overrides**

Insert after the `.pagefind-ui__message` rule (line 1125):

```css
.pagefind-type-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 3px;
  vertical-align: middle;
  margin-right: 6px;
}

.pagefind-type-badge--room {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.pagefind-type-badge--list {
  background: var(--color-gold-soft);
  color: var(--color-gold);
}

.pagefind-type-badge--player {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.pagefind-type-badge--trip {
  background: var(--color-scheduled-soft);
  color: var(--color-scheduled);
}
```

- [ ] **Step 2: Verify the site still builds**

Run: `npx @11ty/eleventy`

Expected: Build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/css/components.css
git commit -m "Add CSS for Pagefind search result type badges"
```

---

### Task 6: Add processResult callback and ranking config

**Files:**

- Modify: `src/_includes/base.njk:64` (PagefindUI constructor)

- [ ] **Step 1: Update the PagefindUI constructor to add `processResult` and `ranking`**

In `src/_includes/base.njk`, change the PagefindUI initialization (line 64) from:

```js
new PagefindUI({ element: '#pagefind-search', showSubResults: true, showImages: false });
```

to:

```js
new PagefindUI({
            element: '#pagefind-search',
            showSubResults: true,
            showImages: false,
            ranking: {
              pageLength: 0.75,
              termFrequency: 0.0
            },
            processResult: function(result) {
              var type = result.meta.type || '';
              if (type) {
                result.meta.title = '<span class="pagefind-type-badge pagefind-type-badge--' + type + '">' + type + '</span> ' + result.meta.title;
              }
              return result;
            }
          });
```

The `ranking` config sets `pageLength: 0.75` (strongly prefer shorter pages — room detail pages are much shorter than list/player pages that embed many rooms) and `termFrequency: 0.0` (no boost for term frequency, preventing list pages with many room mentions from outranking the room itself).

The `processResult` callback reads `result.meta.type` and prepends a styled badge span to the title HTML. PagefindUI renders the title as innerHTML, so the span will be rendered as an element.

- [ ] **Step 2: Verify the site still builds**

Run: `npx @11ty/eleventy`

Expected: Build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/_includes/base.njk
git commit -m "Add processResult type badges and ranking boost to Pagefind search"
```

---

### Task 7: Full build with Pagefind and manual verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full build including Pagefind indexing**

Run: `npm run build`

Expected: Eleventy builds all pages, then Pagefind indexes the `_site` directory with no errors.

- [ ] **Step 2: Start the dev server and test search in the browser**

Run: `npm start`

Open `http://localhost:8080/` in the browser, press `/` to open search, and search for "taxidermist".

Verify:
- The room result "The Taxidermist" shows a green **ROOM** badge and clean title (no "company:" leak)
- List results show gold **LIST** badges
- Player results show purple **PLAYER** badges
- No broken emoji in snippets
- No "Attached To. Jamie. Rooms." structural noise in list result snippets
- Room result appears at or near the top of results

- [ ] **Step 3: Test additional search queries**

Search for "jamie" — verify the player result has a purple badge and list results have gold badges.

Search for "paris" — verify room results have green badges.

- [ ] **Step 4: Commit any final adjustments if needed**
