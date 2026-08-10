const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildCatalog, slugify } = require('../lib/catalog');
const buildFilters = require('../src/_data/filters');

function loadRealCatalog() {
  return buildCatalog(
    {
      companies: require('../src/_data/airtable/companies.json'),
      locations: require('../src/_data/airtable/locations.json'),
      themes: require('../src/_data/airtable/themes.json'),
      players: require('../src/_data/airtable/players.json'),
      awards: require('../src/_data/airtable/awards.json'),
      trips: require('../src/_data/airtable/trips.json'),
      lists: require('../src/_data/airtable/lists.json'),
      listItems: require('../src/_data/airtable/listItems.json'),
      rooms: require('../src/_data/airtable/rooms.json'),
      experiences: require('../src/_data/airtable/experiences.json')
    },
    {
      imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms')
    }
  );
}

function loadRealRoomsSnapshot() {
  return require('../src/_data/airtable/rooms.json');
}

test('real catalog excludes hidden rooms, keeps legacy IDs, and assigns contiguous public numbers', () => {
  const catalog = loadRealCatalog();
  const roomsSnapshot = loadRealRoomsSnapshot();
  const visibleRawRooms = roomsSnapshot.records.filter((record) => !record.fields?.Hide);
  const visibleRoomIds = visibleRawRooms.map((record) => record.fields?.['Room ID']).filter((value) => value != null);

  assert.equal(visibleRoomIds.length, visibleRawRooms.length);
  assert.equal(catalog.rooms.length, visibleRawRooms.length);
  assert.deepEqual(
    [...catalog.rooms.map((room) => room.id)].sort((left, right) => left - right),
    [...visibleRoomIds].sort((left, right) => left - right)
  );
  assert.equal(new Set(catalog.rooms.map((room) => room.id)).size, catalog.rooms.length);
  assert.deepEqual(
    catalog.rooms.map((room) => room.number),
    Array.from({ length: catalog.rooms.length }, (_, index) => index + 1)
  );

  const latestRoom = catalog.rooms.at(-1);
  assert.equal(latestRoom.id, 105);
  assert.equal(latestRoom.number, 104);
  assert.equal(latestRoom.slug, '2026-05-10/the-vault');
  assert.equal(latestRoom.legacySlug, '105-the-vault');

  assert.ok(catalog.featured.players.length > 0);
  assert.ok(catalog.featured.trips.length > 0);
  assert.ok(catalog.featured.players.every((player) => player.featured));
  assert.ok(catalog.featured.trips.every((trip) => trip.featured));
  assert.ok(catalog.awards.length > 0);
});

test('filter data exposes primary typed dimensions including locations, trips, and themes', () => {
  const filters = buildFilters();

  assert.ok(filters.locations.length > 0);
  assert.ok(filters.trips.length > 0);
  assert.ok(filters.lists.length > 0);
  assert.ok(filters.themes.length > 0);
  assert.ok(!Object.hasOwn(filters, 'legacyTagMap'));
});

test('slugify strips punctuation before collapsing separators', () => {
  assert.equal(slugify("Jamie's Escape in Europe Favorites"), 'jamies-escape-in-europe-favorites');
  assert.equal(slugify('RÉALM: Chapter_2'), 'realm-chapter-2');
});

test('lists preserve ordered room membership and attached player/trip metadata', () => {
  const catalog = buildCatalog(
    {
      companies: {
        records: [{ id: 'comp1', fields: { Company: 'Puzzle Co' } }]
      },
      locations: {
        records: [{ id: 'loc1', fields: { Location: 'Downtown', City: 'Paris', Country: 'France', Company: ['comp1'] } }]
      },
      themes: { records: [] },
      players: {
        records: [{ id: 'player1', fields: { Name: 'Jamie', Featured: true } }]
      },
      awards: { records: [] },
      trips: {
        records: [{ id: 'trip1', fields: { Name: 'Europe 2026', Featured: true } }]
      },
      lists: {
        records: [
          { id: 'list1', fields: { Name: 'Favorites', 'List ID': 12, Player: ['player1'], Trip: ['trip1'] } }
        ]
      },
      listItems: {
        records: [
          { id: 'item1', fields: { List: ['list1'], Room: ['room2'], Order: 2, 'List Item ID': 2, Notes: 'Second pick' } },
          { id: 'item2', fields: { List: ['list1'], Room: ['room1'], Order: 1, 'List Item ID': 1, Notes: 'Top pick' } }
        ]
      },
      experiences: { records: [] },
      rooms: {
        records: [
          { id: 'room1', fields: { Game: 'Visible Room', 'Room ID': 31, Location: ['loc1'], Status: 'Escaped', When: '2025-01-01' } },
          { id: 'room2', fields: { Game: 'Visible Room 2', 'Room ID': 32, Location: ['loc1'], Status: 'Escaped', When: '2025-01-02' } }
        ]
      }
    },
    { imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms') }
  );

  assert.equal(catalog.lists.length, 1);
  assert.equal(catalog.lists[0].slug, '12-favorites');
  assert.equal(catalog.lists[0].player?.name, 'Jamie');
  assert.equal(catalog.lists[0].trip?.name, 'Europe 2026');
  assert.deepEqual(catalog.lists[0].roomIds, ['room1', 'room2']);
  assert.deepEqual(catalog.lists[0].listItemIds, ['item2', 'item1']);
  assert.deepEqual(catalog.rooms[0].lists.map((list) => list.slug), ['12-favorites']);
  assert.deepEqual(catalog.rooms[1].lists.map((list) => list.slug), ['12-favorites']);
});

test('list slugs do not add separator breaks for apostrophes in names', () => {
  const catalog = buildCatalog(
    {
      companies: { records: [] },
      locations: { records: [] },
      themes: { records: [] },
      players: { records: [] },
      awards: { records: [] },
      trips: { records: [] },
      lists: {
        records: [
          { id: 'list1', fields: { Name: "Jamie's Escape in Europe Favorites", 'List ID': 1 } }
        ]
      },
      listItems: { records: [] },
      experiences: { records: [] },
      rooms: { records: [] }
    },
    { imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms') }
  );

  assert.equal(catalog.lists[0].slug, '1-jamies-escape-in-europe-favorites');
});

test('public slug overrides keep featured player and trip URLs stable after a rename', () => {
  const catalog = buildCatalog(
    {
      companies: { records: [] },
      locations: { records: [] },
      themes: { records: [] },
      players: {
        records: [{ id: 'player1', fields: { Name: 'Jamie Renamed', Featured: true } }]
      },
      awards: { records: [] },
      trips: {
        records: [{ id: 'trip1', fields: { Name: 'Europe Retitled', Featured: true } }]
      },
      lists: { records: [] },
      listItems: { records: [] },
      experiences: { records: [] },
      rooms: { records: [] }
    },
    {
      imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms'),
      publicSlugs: {
        players: { player1: 'jamie' },
        trips: { trip1: 'escape-in-europe' }
      }
    }
  );

  assert.equal(catalog.players[0].slug, 'jamie');
  assert.equal(catalog.trips[0].slug, 'escape-in-europe');
});

test('officialUrl prefers room URL, then location URL, then company URL', () => {
  const baseData = {
    companies: {
      records: [
        { id: 'comp1', fields: { Company: 'Puzzle Co', 'Company URL': 'https://company.example' } }
      ]
    },
    locations: {
      records: [
        {
          id: 'loc1',
          fields: {
            Location: 'Downtown',
            City: 'Minneapolis',
            Country: 'United States',
            Company: ['comp1'],
            'Location URL': 'https://location.example'
          }
        },
        {
          id: 'loc2',
          fields: {
            Location: 'Mall',
            City: 'St. Paul',
            Country: 'United States',
            Company: ['comp1']
          }
        }
      ]
    },
    themes: { records: [] },
    players: { records: [] },
    awards: { records: [] },
    trips: { records: [] },
    experiences: { records: [] },
    rooms: {
      records: [
        { id: 'room1', fields: { Game: 'Company Fallback', 'Room ID': 1, Location: ['loc2'], Status: 'Escaped', When: '2025-01-01' } },
        { id: 'room2', fields: { Game: 'Location Fallback', 'Room ID': 2, Location: ['loc1'], Status: 'Escaped', When: '2025-01-02' } },
        { id: 'room3', fields: { Game: 'Room Priority', 'Room ID': 3, Location: ['loc1'], Status: 'Escaped', When: '2025-01-03', 'Room URL': 'https://room.example' } }
      ]
    }
  };

  const catalog = buildCatalog(baseData, { imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms') });

  assert.equal(catalog.rooms[0].officialUrl, 'https://company.example');
  assert.equal(catalog.rooms[1].officialUrl, 'https://location.example');
  assert.equal(catalog.rooms[2].officialUrl, 'https://room.example');
});

test('awards are metadata and hidden rooms stay out of public counts', () => {
  const catalog = buildCatalog(
    {
      companies: {
        records: [{ id: 'comp1', fields: { Company: 'Puzzle Co' } }]
      },
      locations: {
        records: [{ id: 'loc1', fields: { Location: 'Downtown', City: 'Paris', Country: 'France', Company: ['comp1'] } }]
      },
      themes: { records: [] },
      players: { records: [] },
      awards: {
        records: [
          { id: 'award1', fields: { Name: 'TERPECA: Top Rooms (2025)', Organization: 'TERPECA', Year: 2025, 'Award Name': 'Top Rooms' } }
        ]
      },
      trips: { records: [] },
      experiences: { records: [] },
      rooms: {
        records: [
          { id: 'room1', fields: { Game: 'Visible Room', 'Room ID': 1, Location: ['loc1'], Status: 'Escaped', When: '2025-01-01', Awards: ['award1'] } },
          { id: 'room2', fields: { Game: 'Hidden Room', Location: ['loc1'], Status: 'Escaped', When: '2025-01-02', Awards: ['award1'], Hide: true } }
        ]
      }
    },
    { imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms') }
  );

  assert.equal(catalog.rooms.length, 1);
  assert.equal(catalog.awards[0].roomCount, 1);
  assert.equal(catalog.awards[0].organization, 'TERPECA');
  assert.equal(catalog.awards[0].year, 2025);
});

test('legacy room IDs are optional while public numbers stay contiguous across gaps', () => {
  const baseData = {
    companies: {
      records: [{ id: 'comp1', fields: { Company: 'Puzzle Co' } }]
    },
    locations: {
      records: [{ id: 'loc1', fields: { Location: 'Downtown', Company: ['comp1'] } }]
    },
    themes: { records: [] },
    players: { records: [] },
    awards: { records: [] },
    trips: { records: [] },
    lists: { records: [] },
    listItems: { records: [] },
    experiences: { records: [] },
    rooms: {
      records: [
        { id: 'room10', fields: { Game: 'Room Ten', 'Room ID': 10, Location: ['loc1'], Status: 'Escaped', When: '2025-01-01' } },
        { id: 'room12', fields: { Game: 'Room Twelve', 'Room ID': 12, Location: ['loc1'], Status: 'Scheduled', When: '2025-02-01' } },
        { id: 'draft', fields: { Hide: true } }
      ]
    }
  };
  const options = { imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms') };

  const catalog = buildCatalog(baseData, options);
  assert.deepEqual(catalog.rooms.map((room) => room.id), [10, 12]);
  assert.deepEqual(catalog.rooms.map((room) => room.number), [1, 2]);
  assert.deepEqual(catalog.rooms.map((room) => room.slug), [
    '2025-01-01/room-ten',
    '2025-02-01/room-twelve'
  ]);

  const missingId = structuredClone(baseData);
  delete missingId.rooms.records[0].fields['Room ID'];
  const catalogWithoutLegacyId = buildCatalog(missingId, options);
  assert.equal(catalogWithoutLegacyId.rooms[0].id, null);
  assert.equal(catalogWithoutLegacyId.rooms[0].legacySlug, null);
  assert.deepEqual(catalogWithoutLegacyId.rooms.map((room) => room.number), [1, 2]);

  const duplicateId = structuredClone(baseData);
  duplicateId.rooms.records[1].fields['Room ID'] = 10;
  assert.throws(
    () => buildCatalog(duplicateId, options),
    /Legacy Room ID 10 is duplicated/
  );

  const invalidId = structuredClone(baseData);
  invalidId.rooms.records[0].fields['Room ID'] = true;
  assert.throws(
    () => buildCatalog(invalidId, options),
    /invalid legacy Room ID/
  );
});

test('same-day rooms with the same name receive deterministic collision-safe routes', () => {
  const data = {
    companies: { records: [{ id: 'comp1', fields: { Company: 'Puzzle Co' } }] },
    locations: {
      records: [{ id: 'loc1', fields: { Location: 'Downtown', Company: ['comp1'] } }]
    },
    themes: { records: [] },
    players: { records: [] },
    awards: { records: [] },
    trips: { records: [] },
    lists: { records: [] },
    listItems: { records: [] },
    experiences: { records: [] },
    rooms: {
      records: [
        { id: 'recAlpha', fields: { Game: 'The Room', Location: ['loc1'], Status: 'Escaped', When: '2025-03-01', Order: 1 } },
        { id: 'recBeta', fields: { Game: 'The Room', Location: ['loc1'], Status: 'Completed', When: '2025-03-01', Order: 2 } }
      ]
    }
  };
  const options = { imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms') };
  const catalog = buildCatalog(data, options);

  assert.deepEqual(catalog.rooms.map((room) => room.slug), [
    '2025-03-01/the-room-recalpha',
    '2025-03-01/the-room-recbeta'
  ]);
  assert.equal(new Set(catalog.rooms.map((room) => room.slug)).size, 2);

  const missingOrder = structuredClone(data);
  delete missingOrder.rooms.records[1].fields.Order;
  assert.throws(
    () => buildCatalog(missingOrder, options),
    /must have a positive integer Order because 2025-03-01 has multiple rooms/
  );
});
