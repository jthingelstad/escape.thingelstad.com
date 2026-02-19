# Escaping Things

The Thingelstad family's escape room journey — tracking every room, every win, every lockout.

**[escape.thingelstad.com](https://escape.thingelstad.com)**

## What is this?

A static website that catalogs our family's escape room adventures. Browse the full list, explore locations on a map, and dig into stats and charts.

- **86+ rooms** across the US, Canada, UK, Iceland, and Italy
- Interactive filterable list with search, tags, and player filters
- Leaflet map with custom markers and clustering
- Charts showing rooms per year, monthly trends, top companies, and escape times

## Tech

Built with [Eleventy (11ty)](https://www.11ty.dev/) v3, plain CSS, and vanilla JavaScript. No frameworks, no bundlers.

- **Templates:** Nunjucks
- **Maps:** Leaflet.js + MarkerCluster
- **Charts:** Chart.js
- **Analytics:** Tinylytics
- **Hosting:** GitHub Pages (deployed via GitHub Actions)

All room data lives in a single `rooms.json` file.

## Development

```bash
npm install
npm start       # http://localhost:8080 with live reload
npm run build   # Production build to _site/
```

## License

Content and data are personal to the Thingelstad family. Code structure is available for reference.
