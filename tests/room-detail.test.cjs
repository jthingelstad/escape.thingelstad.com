const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRelatedRoomsIndex, findRelatedRooms } = require('../src/_data/roomDetail');

function makeRoom({
  id,
  slug,
  game,
  status = 'Escaped',
  date = '2025-01-01',
  company = null,
  location = null,
  themes = [],
  players = [],
  awards = [],
  trips = [],
  lists = []
}) {
  return {
    airtableId: `rec${id}`,
    id,
    slug,
    game,
    status,
    date,
    company,
    location,
    themes,
    players,
    awards,
    trips,
    lists
  };
}

test('related rooms favor shared themes and AI hint overlap over weaker matches', () => {
  const themeMystery = { airtableId: 'theme1', name: 'Mystery' };
  const themeHeist = { airtableId: 'theme2', name: 'Heist' };
  const playerJamie = { airtableId: 'player1', name: 'Jamie' };

  const source = makeRoom({
    id: 1,
    slug: '1-source-room',
    game: 'Source Room',
    location: { city: 'Paris', country: 'France' },
    themes: [themeMystery, themeHeist],
    players: [playerJamie]
  });
  const strongest = makeRoom({
    id: 2,
    slug: '2-strongest-match',
    game: 'Strongest Match',
    location: { city: 'Paris', country: 'France' },
    themes: [themeMystery],
    players: [playerJamie]
  });
  const medium = makeRoom({
    id: 3,
    slug: '3-medium-match',
    game: 'Medium Match',
    location: { city: 'Lyon', country: 'France' },
    themes: [themeMystery]
  });
  const weak = makeRoom({
    id: 4,
    slug: '4-weak-match',
    game: 'Weak Match',
    location: { city: 'Paris', country: 'France' }
  });

  const rooms = [source, strongest, medium, weak];
  const aiSearch = {
    rooms: {
      '1-source-room': { hints: ['paris mystery detective room', 'story rich heist puzzles'] },
      '2-strongest-match': { hints: ['paris mystery detective experience', 'immersive heist puzzle room'] },
      '3-medium-match': { hints: ['mystery detective puzzles in france'] },
      '4-weak-match': { hints: ['paris travel escape room'] }
    }
  };

  const relatedIndex = buildRelatedRoomsIndex(rooms, aiSearch);
  const related = findRelatedRooms(source, rooms, relatedIndex, { limit: 4, minimumScore: 2 });

  assert.deepEqual(related.map((room) => room.slug), [
    '2-strongest-match',
    '3-medium-match',
    '4-weak-match'
  ]);
});
