# Escaping Things

The Thingelstad family's escape room journey — tracking every room, every win, every lockout.

**[escape.thingelstad.com](https://escape.thingelstad.com)**

## What is this?

A static website that catalogs the family's escape room adventures with typed Airtable-backed data for rooms, players, awards, trips, themes, locations, companies, and experiences.

- **100 public rooms** across the US, Canada, UK, Iceland, Italy, Belgium, France, the Netherlands, and Spain
- Interactive filterable list and map with typed facets for companies, players, awards, trips, and themes
- Featured hub plus standalone featured pages for selected players, awards, and trips
- Charts, room detail pages, and a scrapbook powered by a normalized site catalog

## Tech

Built with [Eleventy (11ty)](https://www.11ty.dev/) v3, plain CSS, and vanilla JavaScript. No frameworks, no bundlers.

- **Templates:** Nunjucks
- **Maps:** Leaflet.js + MarkerCluster
- **Charts:** Chart.js
- **Analytics:** Tinylytics
- **Hosting:** GitHub Pages (deployed via GitHub Actions)

Raw Airtable snapshots live in `src/_data/airtable/*.json` and are synced via `scripts/sync_airtable.py`. Eleventy then builds a normalized catalog in `src/_data/catalog.js`.

## Development

```bash
npm install
npm start       # http://localhost:8080 with live reload
npm run build   # Production build to _site/
npm run sync    # Refresh raw Airtable snapshots under src/_data/airtable/
npm test        # Run catalog contract tests
```

## License

Content and data are personal to the Thingelstad family. Code structure is available for reference.
