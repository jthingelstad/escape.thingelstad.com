const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStats } = require('../src/_data/stats');

function makeRoom({ id, date, status }) {
  return {
    id,
    slug: `${id}-room`,
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

test('room totals include scheduled rooms while played statistics do not', () => {
  const stats = buildStats([
    makeRoom({ id: 10, date: '2025-01-01', status: 'Escaped' }),
    makeRoom({ id: 12, date: '2026-01-01', status: 'Scheduled' })
  ]);

  assert.equal(stats.totalRooms, 2);
  assert.equal(stats.totalPlayed, 1);
  assert.equal(stats.scheduledRooms, 1);
  assert.equal(stats.latestCompleted.id, 10);
  assert.equal(stats.charts.cumulativeStreak.length, 1);
  assert.deepEqual(stats.charts.roomsPerYear.labels, ['2025', '2026']);
  assert.deepEqual(stats.charts.roomsPerYear.scheduled, [0, 1]);
});
