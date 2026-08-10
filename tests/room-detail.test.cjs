const test = require('node:test');
const assert = require('node:assert/strict');
const buildRoomDetail = require('../src/_data/roomDetail');
const { findRelatedRooms } = buildRoomDetail;

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
    number: id,
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

test('related rooms favor shared themes and structured metadata over weaker matches', () => {
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
  const related = findRelatedRooms(source, rooms, { limit: 4, minimumScore: 2 });

  assert.deepEqual(related.map((room) => room.slug), [
    '2-strongest-match',
    '3-medium-match',
    '4-weak-match'
  ]);
});

test('real room details preserve chronological navigation and company comparisons', () => {
  const rooms = buildRoomDetail();
  const first = rooms[0];
  const last = rooms[rooms.length - 1];
  const beforeGap = rooms.find((room) => room.id === 101);

  assert.equal(first.nav.prev, null);
  assert.equal(first.nav.next.number, 2);
  assert.equal(last.number, rooms.length);
  assert.equal(last.nav.prev.number, rooms.length - 1);
  assert.equal(last.nav.next, null);
  assert.equal(beforeGap.number, 101);
  assert.equal(beforeGap.nav.next.id, 103);
  assert.equal(beforeGap.nav.next.number, 102);

  const sameCompany = rooms.filter(
    (room) => room.status !== 'Scheduled' && room.company?.airtableId === last.company.airtableId
  );
  const companyWins = sameCompany.filter(
    (room) => room.status === 'Escaped' || room.status === 'Completed'
  );
  assert.equal(last.stats.companyTotal, sameCompany.length);
  assert.equal(last.stats.companyWins, companyWins.length);
});
