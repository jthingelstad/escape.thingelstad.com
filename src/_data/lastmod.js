// The sitemap's <lastmod> for every page it can date: see lib/lastmod.js.
const catalog = require('./catalog');
const tripPages = require('./tripPages');
const playerPages = require('./playerPages');
const listPages = require('./listPages');
const roomDetail = require('./roomDetail');
const { buildLastmod } = require('../../lib/lastmod');

const TABLES = ['companies', 'locations', 'themes', 'players', 'awards', 'trips', 'lists', 'listItems', 'rooms', 'experiences'];

function loadSnapshot(name) {
  try {
    return require(`./airtable/${name}.json`);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return { records: [] };
    throw error;
  }
}

module.exports = function() {
  const data = catalog();
  const raw = Object.fromEntries(TABLES.map((name) => [name, loadSnapshot(name)]));
  return buildLastmod(raw, data, {
    rooms: roomDetail(),
    trips: tripPages(),
    players: playerPages(),
    lists: listPages(),
    featured: data.featured
  });
};
