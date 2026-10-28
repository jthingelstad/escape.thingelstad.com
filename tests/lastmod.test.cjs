const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildLastmod, INDEX_PAGES } = require('../lib/lastmod');

// The sitemap's <lastmod> (lib/lastmod.js): the newest Airtable timestamp
// behind what a page shows, never the build time.

const record = (id, fields = {}, createdTime = '2026-01-01T00:00:00.000Z') => ({ id, createdTime, fields });
const raw = {
  rooms: { records: [record('recRoom', { 'Modified at': '2026-03-01T00:00:00.000Z' }), record('recOld', { 'Modified at': '2026-02-01T00:00:00.000Z' })] },
  locations: { records: [record('recLoc', { 'Modified at': '2026-04-01T00:00:00.000Z' })] },
  companies: { records: [record('recCo', { 'Modified at': '2026-01-15T00:00:00.000Z' })] },
  trips: { records: [record('recTrip', {}, '2026-01-02T00:00:00.000Z')] },
  lists: { records: [record('recList', {}, '2026-01-03T00:00:00.000Z')] },
  listItems: { records: [record('recItem', { 'Created at': '2026-02-10T00:00:00.000Z' })] }
};
const room = {
  airtableId: 'recRoom', slug: '2026-01-01/a',
  location: { airtableId: 'recLoc' }, company: { airtableId: 'recCo' },
  experiences: [{ modifiedAt: '2026-05-01T00:00:00.000Z', createdAt: '2026-01-05T00:00:00.000Z' }]
};
const oldRoom = { airtableId: 'recOld', slug: '2025-01-01/b', experiences: [] };
const catalog = { rooms: [room, oldRoom], listItems: [{ airtableId: 'recItem', roomAirtableId: 'recOld' }] };
const trip = { airtableId: 'recTrip', slug: 'trip', roomIds: ['recOld'] };
const list = { airtableId: 'recList', slug: '1-list', roomIds: ['recOld'], listItemIds: ['recItem'] };
const pages = { rooms: [room, oldRoom], trips: [trip], players: [], lists: [list], featured: { trips: [trip], players: [] } };

test('a room takes the newest of its record, experiences, location, company and list items', () => {
  const lastmod = buildLastmod(raw, catalog, pages, { templateDates: {} });
  assert.equal(lastmod['/room/2026-01-01/a/'], '2026-05-01T00:00:00.000Z'); // the experience
  assert.equal(lastmod['/room/2025-01-01/b/'], '2026-02-10T00:00:00.000Z'); // the list item
});

test('trips and lists roll up their rooms; index pages take their template or newest item', () => {
  const lastmod = buildLastmod(raw, catalog, pages, { templateDates: { 'src/trips.njk': '2026-09-01T00:00:00-05:00' } });
  assert.equal(lastmod['/trip/trip/'], '2026-02-10T00:00:00.000Z');
  assert.equal(lastmod['/list/1-list/'], '2026-02-10T00:00:00.000Z');
  assert.equal(lastmod['/rooms/'], '2026-05-01T00:00:00.000Z');
  assert.equal(lastmod['/trips/'], '2026-09-01T05:00:00.000Z');
  assert.equal(lastmod['/lists/'], '2026-02-10T00:00:00.000Z');
});

test('the real catalog dates every page the templates build', () => {
  const lastmod = require('../src/_data/lastmod')();
  const count = (name) => require(`../src/_data/${name}`)().length;
  const expected = count('roomDetail') + count('tripPages') + count('playerPages') + count('listPages') + Object.keys(INDEX_PAGES).length;
  assert.equal(Object.keys(lastmod).length, expected);
  for (const [url, date] of Object.entries(lastmod)) {
    assert.ok(Date.parse(date) <= Date.now(), `${url}: ${date}`);
  }
  for (const { template } of Object.values(INDEX_PAGES)) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', template)), template);
  }
});
