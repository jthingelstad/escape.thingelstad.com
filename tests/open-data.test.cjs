const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildLlmsTxt, buildRoomsExport } = require('../lib/open-data');

function makeRoom({ number, date, status, game = `Room ${number}`, trips = [], photo = 'team.jpeg' }) {
  return {
    number,
    airtableId: `room-${number}`,
    slug: `${date}/room-${number}`,
    date,
    modifiedAt: `${date}T12:00:00.000Z`,
    status,
    game,
    timeLeft: 5.5,
    photo,
    company: { name: 'Puzzle Co' },
    location: { label: 'Puzzle Co (Minneapolis)', city: 'Minneapolis', region: 'Minnesota', country: 'United States', lat: 44.9, lng: -93.2 },
    players: [{ name: 'Jamie' }, { name: 'Tammy' }],
    trips,
    lists: [],
    awards: [],
    themes: [{ name: 'Heist' }],
    experiences: [{ player: { name: 'Jamie' }, rating: 4.5, gameplay: 'Loved', bestThings: true, comments: 'Great *finale*.' }],
    ratingSummary: { count: 1, average: 4.5, bestThingsCount: 1 }
  };
}

const trip = { airtableId: 'trip-1', slug: 'road-trip', name: 'Road Trip', featured: true };
const catalog = {
  rooms: [
    makeRoom({ number: 1, date: '2024-01-01', status: 'Escaped', trips: [trip] }),
    makeRoom({ number: 2, date: '2025-06-01', status: 'Try again' }),
    makeRoom({ number: 3, date: '2099-01-01', status: 'Scheduled' })
  ],
  trips: [trip, { airtableId: 'trip-2', slug: 'quiet', name: 'Quiet', featured: false }],
  lists: [{ slug: '1-favorites', name: 'Favorites', player: { name: 'Jamie' } }]
};

test('rooms export lists played rooms newest first and leaves out scheduled rooms and photos', () => {
  const data = buildRoomsExport(catalog);

  assert.deepEqual(data.rooms.map((room) => room.number), [2, 1]);
  assert.deepEqual(data.counts, { rooms: 2, escaped: 1, completed: 0, try_again: 1, countries: 1, companies: 1, players: 2 });
  assert.equal(data.first_room_date, '2024-01-01');
  assert.equal(data.latest_room_date, '2025-06-01');
  assert.equal(data.updated, '2025-06-01T12:00:00.000Z');

  const room = data.rooms[1];
  assert.equal(room.url, 'https://escape.thingelstad.com/room/2024-01-01/room-1/');
  assert.deepEqual(room.players, ['Jamie', 'Tammy']);
  assert.deepEqual(room.trips, [{ name: 'Road Trip', url: 'https://escape.thingelstad.com/trip/road-trip/' }]);
  assert.equal(room.reviews[0].best_thing, true);
  assert.equal(JSON.stringify(data).includes('team.jpeg'), false);
  assert.equal(JSON.stringify(data).includes('room-1"'), false, 'Airtable ids stay out');
});

test('llms.txt links the data files and every played room once', () => {
  const text = buildLlmsTxt(catalog);

  assert.match(text, /^# Escaping Things\n\n> /);
  assert.match(text, /\(https:\/\/escape\.thingelstad\.com\/rooms\.json\)/);
  assert.match(text, /\(https:\/\/escape\.thingelstad\.com\/feed\.json\)/);
  assert.match(text, /- \[Road Trip\]\(https:\/\/escape\.thingelstad\.com\/trip\/road-trip\/\): 1 room\n/);
  assert.equal(text.includes('Quiet'), false, 'only featured trips get a line');
  assert.match(text, /- \[Favorites\]\(https:\/\/escape\.thingelstad\.com\/list\/1-favorites\/\) by Jamie\n/);
  assert.equal(text.match(/\/room\/2024-01-01\/room-1\//g).length, 1);
  assert.equal(text.includes('2099-01-01'), false);
  assert.equal(text.includes('team.jpeg'), false);
});

test('the built JSON Feed carries the same entries as the Atom feed', async () => {
  const { Eleventy } = await import('@11ty/eleventy');
  const root = path.join(__dirname, '..');
  const eleventy = new Eleventy(path.join(root, 'src'), path.join(root, '_site'), {
    configPath: path.join(root, 'eleventy.config.js'),
    quietMode: true
  });
  const pages = await eleventy.toJSON();
  const content = (url) => pages.find((page) => page.url === url)?.content;

  const feed = JSON.parse(content('/feed.json'));
  const atomIds = [...content('/feed.xml').matchAll(/<id>(tag:[^<]+)<\/id>/g)].map((match) => match[1]);
  assert.equal(feed.version, 'https://jsonfeed.org/version/1.1');
  assert.deepEqual(feed.items.map((item) => item.id), atomIds);
  for (const item of feed.items) {
    assert.ok(item.content_html.startsWith('<p>'));
    assert.ok(item.url.startsWith('https://escape.thingelstad.com/room/'));
  }

  const rooms = JSON.parse(content('/rooms.json'));
  assert.equal(rooms.rooms.length, rooms.counts.rooms);
  assert.match(content('/llms.txt'), /^# Escaping Things\n/);
});
