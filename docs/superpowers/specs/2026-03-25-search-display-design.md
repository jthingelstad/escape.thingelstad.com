# Search Display Improvements

## Problem

The Pagefind search overlay has five display issues:

1. **Room titles leak metadata format** - "The Taxidermist, company:Deep Inside Paris" shows the raw `company:` label because `data-pagefind-meta` encodes company as a keyed field that PagefindUI renders literally.
2. **Noisy snippets** - List pages index structural headings ("Attached To", "Rooms") that appear as meaningless text in excerpts.
3. **No type distinction** - Rooms, lists, players, and trips look identical in results.
4. **Broken emoji in snippets** - The calendar emoji from room detail meta renders as a broken glyph in Pagefind excerpts.
5. **Lists outrank rooms** - Searching a room name surfaces list pages (which mention many rooms) before the room's own detail page.

## Approach

PagefindUI with `processResult` hook (Approach C). Keep PagefindUI for input, loading, and pagination. Customize result display through Pagefind's own callbacks and fix source metadata at the template level.

## Design

### 1. Metadata fixes (templates)

**`src/room.njk`**: Change `data-pagefind-meta` from:
```
title:{{ room.game }}{% if room.company %}, company:{{ room.company.name }}{% endif %}
```
to:
```
title:{{ room.game }}, type:room
```
Drop the `company:` field - company name is already in the page body and surfaces in snippets naturally.

**`src/list-detail.njk`**: Add `data-pagefind-meta="type:list"` to the `<main>` tag.

**`src/player.njk`**: Add `data-pagefind-meta="type:player"` to the `<main>` tag.

**`src/trip.njk`**: Add `data-pagefind-meta="type:trip"` to the `<main>` tag.

### 2. Noise reduction (templates)

**`src/room.njk`**: Wrap `<span class="meta-icon">` elements in `data-pagefind-ignore` so emoji don't leak into excerpts.

**`src/list-detail.njk`**: Add `data-pagefind-ignore` to the "Attached To" section header and the "Rooms" section header to suppress structural text in snippets.

### 3. Result display via `processResult` (base.njk)

Add a `processResult` callback to the `PagefindUI` constructor that:
- Reads `result.meta.type`
- Prepends a color-coded type badge to the result title
- Badge is a styled `<span>` with uppercase mono text

Badge color mapping (using existing site token colors):
- **Room**: green (`#4CAF50` on `rgba(76,175,80,0.15)`)
- **List**: gold (`#FFB703` on `rgba(255,183,3,0.12)`)
- **Player**: purple (`#A78BFA` on `rgba(167,139,250,0.12)`)
- **Trip**: blue (`#5AA9FF` on `rgba(90,169,255,0.15)`)

### 4. Ranking boost

Use Pagefind's `ranking` configuration in the `PagefindUI` constructor to tune `pageLength` and `termFrequency` weights. Room detail pages are shorter and more focused than list pages, so favoring shorter pages with higher term frequency will naturally boost room results.

### 5. CSS (components.css)

Add styles for `.pagefind-type-badge` covering:
- Inline-block display with flex alignment alongside the title
- Mono font, uppercase, small size (10px), letter-spacing
- Pill shape with border-radius
- Color variants for each type via modifier classes or inline styles from `processResult`

## Files changed

- `src/room.njk` - meta fix, emoji ignore
- `src/list-detail.njk` - add type meta, ignore structural headings
- `src/player.njk` - add type meta
- `src/trip.njk` - add type meta
- `src/_includes/base.njk` - processResult callback, ranking config
- `src/css/components.css` - type badge styles

## Out of scope

- Custom search UI replacing PagefindUI
- Changes to which pages are indexed
- Non-search changes
