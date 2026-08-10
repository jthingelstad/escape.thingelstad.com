const path = require('path');
const { buildCatalog } = require('../../lib/catalog');
const publicSlugs = require('./publicSlugs.json');

function loadSnapshot(name) {
  try {
    return require(`./airtable/${name}.json`);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return { records: [] };
    }
    throw error;
  }
}

module.exports = function() {
  return buildCatalog(
    {
      companies: loadSnapshot('companies'),
      locations: loadSnapshot('locations'),
      themes: loadSnapshot('themes'),
      players: loadSnapshot('players'),
      awards: loadSnapshot('awards'),
      trips: loadSnapshot('trips'),
      lists: loadSnapshot('lists'),
      listItems: loadSnapshot('listItems'),
      rooms: loadSnapshot('rooms'),
      experiences: loadSnapshot('experiences')
    },
    {
      imagesDir: path.join(__dirname, '..', 'images', 'rooms'),
      publicSlugs
    }
  );
};
