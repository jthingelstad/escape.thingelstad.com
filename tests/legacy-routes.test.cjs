const test = require('node:test');
const assert = require('node:assert/strict');
const buildLegacyRooms = require('../src/_data/legacyRooms');

test('published room routes survive source-title corrections', () => {
  const redirects = buildLegacyRooms();
  const pharaohAlias = redirects.find(
    (redirect) => redirect.from === '2026-07-22/pharoahs-tomb'
  );

  assert.ok(pharaohAlias);
  assert.equal(pharaohAlias.room.airtableId, 'recHceo4lCDzS6lu9');
  assert.equal(pharaohAlias.room.slug, '2026-07-22/pharaohs-tomb');
});
