// When each page's content last changed, for the sitemap's <lastmod>
// (2026-10-28). Google reads lastmod only on sites where it is accurate, so
// this never uses the build time or the sync's commit (one sync rewrites every
// snapshot at once).
//
// A room is the newest Airtable timestamp behind what its page shows: the
// room record's "Modified at", its players' experiences, its location and
// company, and the list items that hold it (the links as lib/catalog.js
// resolved them; the snapshots are read only for timestamps). Players, trips and lists carry no
// "Modified at" in Airtable, so their pages take the record's creation time
// and their rooms. A hand-written index page takes the last commit to its
// template or the newest item it lists, whichever is newer.
//
// A shallow clone has one commit, which would date every template today, so
// the template dates are skipped there (CI checks out full history).

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Index pages: their template and which items they list.
const INDEX_PAGES = {
  '/': { template: 'src/index.njk', items: ['rooms', 'featured'] },
  '/rooms/': { template: 'src/list.njk', items: ['rooms'] },
  '/map/': { template: 'src/map.njk', items: ['rooms'] },
  '/stats/': { template: 'src/stats.njk', items: ['rooms'] },
  '/search/': { template: 'src/search.njk', items: ['rooms'] },
  '/trips/': { template: 'src/trips.njk', items: ['trips'] },
  // The roster counts every player's rooms, not only the featured pages.
  '/players/': { template: 'src/players.njk', items: ['players', 'rooms'] },
  '/lists/': { template: 'src/lists.njk', items: ['lists'] },
  '/featured/': { template: 'src/featured.njk', items: ['featured'] }
};

function newest(...values) {
  let best = null;
  for (const value of values.flat(Infinity)) {
    if (!value) continue;
    const time = Date.parse(value);
    if (!Number.isNaN(time) && (best === null || time > best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
}

function records(snapshot) {
  const list = Array.isArray(snapshot) ? snapshot : snapshot?.records || [];
  return list.filter((record) => record && record.id);
}

// Every date Airtable keeps on a record.
const stamps = (record) => [record.fields?.['Modified at'], record.fields?.['Created at'], record.createdTime];

function gitTemplateDates(templates) {
  const git = (args) =>
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const dates = {};
  try {
    if (git(['rev-parse', '--is-shallow-repository']) !== 'false') return dates;
    for (const template of templates) {
      const date = git(['log', '-1', '--format=%cI', '--', template]);
      if (date) dates[template] = date;
    }
  } catch {
    // no git: index pages use their items alone
  }
  return dates;
}

// raw: the Airtable snapshots by table name, read only for their timestamps.
// catalog: the normalized catalog (lib/catalog.js), which says what each room
// shows. pages: { rooms, trips, players, lists, featured: { trips, players } }
// as the templates paginate them. Returns { '/room/<slug>/': iso, ... } for
// every page it can date.
function buildLastmod(raw, catalog, pages, { templateDates = gitTemplateDates(Object.values(INDEX_PAGES).map((page) => page.template)) } = {}) {
  const stampsById = new Map();
  for (const snapshot of Object.values(raw)) {
    for (const record of records(snapshot)) stampsById.set(record.id, stamps(record));
  }
  const stampsOf = (airtableId) => stampsById.get(airtableId) || [];

  const listItemsByRoom = {};
  for (const item of catalog.listItems || []) (listItemsByRoom[item.roomAirtableId] ||= []).push(item.airtableId);

  const roomDates = {};
  for (const room of catalog.rooms || []) {
    roomDates[room.airtableId] = newest(
      stampsOf(room.airtableId),
      (room.experiences || []).map((experience) => [experience.modifiedAt, experience.createdAt]),
      stampsOf(room.location?.airtableId),
      stampsOf(room.company?.airtableId),
      (listItemsByRoom[room.airtableId] || []).map(stampsOf)
    );
  }

  const lastmod = {};
  const kindDates = { rooms: [], trips: [], players: [], lists: [], featured: [] };

  for (const room of pages.rooms || []) {
    const date = roomDates[room.airtableId];
    if (date) lastmod[`/room/${room.slug}/`] = date;
    kindDates.rooms.push(date);
  }

  const entityDate = (kind, entity) =>
    newest(
      stampsOf(entity.airtableId),
      (entity.roomIds || []).map((roomId) => roomDates[roomId]),
      (entity.listItemIds || []).map(stampsOf)
    );
  const prefix = { trips: '/trip/', players: '/player/', lists: '/list/' };
  for (const kind of ['trips', 'players', 'lists']) {
    for (const entity of pages[kind] || []) {
      const date = entityDate(kind, entity);
      if (date) lastmod[`${prefix[kind]}${entity.slug}/`] = date;
      kindDates[kind].push(date);
    }
  }
  for (const kind of ['trips', 'players']) {
    for (const entity of pages.featured?.[kind] || []) kindDates.featured.push(entityDate(kind, entity));
  }

  for (const [url, { template, items }] of Object.entries(INDEX_PAGES)) {
    const date = newest(templateDates[template], items.map((kind) => kindDates[kind]));
    if (date) lastmod[url] = date;
  }
  return lastmod;
}

module.exports = { buildLastmod, INDEX_PAGES };
