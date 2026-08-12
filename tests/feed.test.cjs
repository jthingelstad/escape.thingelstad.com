const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFeed, describeResult, formatPeople } = require('../lib/feed');

function makeRoom({
  number,
  date,
  status,
  game = `Room ${number}`,
  timeLeft = null,
  players = ['Jamie', 'Tammy'],
  modifiedAt = null,
  experiences = []
}) {
  return {
    number,
    airtableId: `room-${number}`,
    slug: `${date}/room-${number}`,
    date,
    modifiedAt,
    status,
    game,
    timeLeft,
    company: { name: 'Puzzle Co' },
    location: { city: 'Minneapolis', region: 'Minnesota', country: 'United States' },
    players: players.map((name) => ({ name })),
    experiences
  };
}

test('feed excludes scheduled rooms and publishes a bounded newest-first window', () => {
  const feed = buildFeed([
    makeRoom({ number: 1, date: '2025-01-01', status: 'Escaped' }),
    makeRoom({ number: 2, date: '2025-01-02', status: 'Completed' }),
    makeRoom({ number: 3, date: '2025-01-03', status: 'Scheduled' })
  ], { limit: 1 });

  assert.equal(feed.entries.length, 1);
  assert.equal(feed.entries[0].room.number, 2);
  assert.equal(feed.updatedAt, '2025-01-02T00:00:00.000Z');
  assert.equal(feed.entries.some((entry) => entry.room.status === 'Scheduled'), false);
});

test('feed update timestamps reflect later room edits without changing play order', () => {
  const feed = buildFeed([
    makeRoom({ number: 1, date: '2025-01-01', status: 'Escaped', modifiedAt: '2025-03-01T12:00:00Z' }),
    makeRoom({ number: 2, date: '2025-02-01', status: 'Escaped', modifiedAt: '2025-02-01T13:00:00Z' })
  ]);

  assert.deepEqual(feed.entries.map((entry) => entry.room.number), [2, 1]);
  assert.equal(feed.entries[1].updatedAt, '2025-03-01T12:00:00.000Z');
  assert.equal(feed.updatedAt, '2025-03-01T12:00:00.000Z');
});

test('feed entries use human titles and narrative summaries', () => {
  const room = makeRoom({
    number: 12,
    date: '2025-02-03',
    status: 'Escaped',
    game: 'The Library',
    timeLeft: 2.5,
    players: ['Jamie', 'Tammy', 'Mazie']
  });
  const entry = buildFeed([room]).entries[0];

  assert.equal(entry.title, 'We escaped The Library at Puzzle Co');
  assert.equal(entry.title.includes('#12'), false);
  assert.equal(
    entry.summary,
    'On February 3, 2025, Jamie, Tammy, and Mazie played The Library at Puzzle Co in Minneapolis, Minnesota, United States. The team escaped with 2 minutes, 30 seconds left.'
  );
});

test('feed result language reflects completed and try-again outcomes', () => {
  assert.equal(
    describeResult(makeRoom({ number: 1, date: '2025-01-01', status: 'Completed', timeLeft: -12.2 })),
    'The team completed it after running 12 minutes, 12 seconds over.'
  );
  assert.equal(
    describeResult(makeRoom({ number: 2, date: '2025-01-02', status: 'Try again', timeLeft: -5 })),
    'Time ran out, ending 5 minutes over, so this one goes in the “try again” column.'
  );
});

test('feed prose avoids repeating a room and company with the same name', () => {
  const room = makeRoom({ number: 1, date: '2025-01-01', status: 'Escaped', game: 'Londium' });
  room.company.name = 'Londium';
  const entry = buildFeed([room]).entries[0];

  assert.equal(entry.title, 'We escaped Londium');
  assert.match(entry.lede, /played Londium in Minneapolis/);
  assert.doesNotMatch(entry.lede, /Londium at Londium/);
});

test('a zero time result reads as a buzzer finish', () => {
  assert.equal(
    describeResult(makeRoom({ number: 1, date: '2025-01-01', status: 'Escaped', timeLeft: 0 })),
    'The team escaped right at the buzzer.'
  );
});

test('player names read naturally', () => {
  assert.equal(formatPeople([]), 'The Escaping Things team');
  assert.equal(formatPeople(['Jamie']), 'Jamie');
  assert.equal(formatPeople(['Jamie', 'Tammy']), 'Jamie and Tammy');
  assert.equal(formatPeople(['Jamie', 'Tammy', 'Mazie']), 'Jamie, Tammy, and Mazie');
});
