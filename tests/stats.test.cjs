const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStats } = require('../src/_data/stats');

function makeRoom({ id, date, status }) {
  return {
    id,
    number: id,
    slug: `${date}/room-${id}`,
    game: `Room ${id}`,
    date,
    status,
    timeLeft: null,
    location: { region: 'Minnesota', country: 'United States' },
    company: { airtableId: 'company1' },
    players: [],
    themes: [],
    awards: [],
    trips: [],
    lists: [],
    ratingSummary: { count: 0, average: null, bestThingsCount: 0 }
  };
}

test('scheduled rooms stay available for planning without entering team statistics', () => {
  const stats = buildStats([
    makeRoom({ id: 10, date: '2025-01-01', status: 'Escaped' }),
    makeRoom({ id: 12, date: '2026-01-01', status: 'Scheduled' })
  ]);

  assert.equal(stats.totalRooms, 2);
  assert.equal(stats.totalPlayed, 1);
  assert.equal(stats.scheduledRooms, 1);
  assert.equal(stats.planned.length, 1);
  assert.equal(stats.latestCompleted.id, 10);
  assert.equal(stats.latestCompleted.number, 10);
  assert.equal(stats.charts.cumulativeStreak.length, 1);
  assert.deepEqual(stats.charts.roomsPerYear.labels, ['2025']);
  assert.equal(Object.hasOwn(stats.charts.roomsPerYear, 'scheduled'), false);
});
