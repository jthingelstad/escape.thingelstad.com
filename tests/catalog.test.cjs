const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildCatalog } = require('../lib/catalog');
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

test('real catalog excludes hidden rooms, keeps stable Room IDs, and preserves featured entities', () => {
  const catalog = loadRealCatalog();
  const roomsSnapshot = loadRealRoomsSnapshot();
  const visibleRawRooms = roomsSnapshot.records.filter((record) => !record.fields?.Hide);
  const visibleRoomIds = visibleRawRooms.map((record) => record.fields?.['Room ID']).filter((value) => value != null);

  assert.equal(catalog.rooms.length, visibleRawRooms.length);
  assert.deepEqual(
    [...catalog.rooms.map((room) => room.id)].sort((left, right) => left - right),
    [...visibleRoomIds].sort((left, right) => left - right)
  );
  assert.equal(new Set(catalog.rooms.map((room) => room.id)).size, catalog.rooms.length);

  assert.ok(catalog.featured.players.length > 0);
  assert.ok(catalog.featured.awards.length > 0);
  assert.ok(catalog.featured.trips.length > 0);
  assert.ok(catalog.featured.players.every((player) => player.featured));
  assert.ok(catalog.featured.awards.every((award) => award.featured));
  assert.ok(catalog.featured.trips.every((trip) => trip.featured));
});

test('filter data exposes primary typed dimensions including locations, trips, and themes', () => {
  const filters = buildFilters();

  assert.ok(filters.locations.length > 0);
  assert.ok(filters.trips.length > 0);
  assert.ok(filters.lists.length > 0);
  assert.ok(filters.themes.length > 0);
  assert.ok(!Object.hasOwn(filters, 'legacyTagMap'));
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
        { id: 'room1', fields: { Game: 'Company Fallback', Location: ['loc2'], Status: 'Escaped', When: '2025-01-01' } },
        { id: 'room2', fields: { Game: 'Location Fallback', Location: ['loc1'], Status: 'Escaped', When: '2025-01-02' } },
        { id: 'room3', fields: { Game: 'Room Priority', Location: ['loc1'], Status: 'Escaped', When: '2025-01-03', 'Room URL': 'https://room.example' } }
      ]
    }
  };

  const catalog = buildCatalog(baseData, { imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms') });

  assert.equal(catalog.rooms[0].officialUrl, 'https://company.example');
  assert.equal(catalog.rooms[1].officialUrl, 'https://location.example');
  assert.equal(catalog.rooms[2].officialUrl, 'https://room.example');
});

test('featured awards stay public metadata and hidden rooms stay out of public counts', () => {
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
          { id: 'award1', fields: { Name: 'Spotlight', Featured: true } }
        ]
      },
      trips: { records: [] },
      experiences: { records: [] },
      rooms: {
        records: [
          { id: 'room1', fields: { Game: 'Visible Room', Location: ['loc1'], Status: 'Escaped', When: '2025-01-01', Awards: ['award1'] } },
          { id: 'room2', fields: { Game: 'Hidden Room', Location: ['loc1'], Status: 'Escaped', When: '2025-01-02', Awards: ['award1'], Hide: true } }
        ]
      }
    },
    { imagesDir: path.join(__dirname, '..', 'src', 'images', 'rooms') }
  );

  assert.equal(catalog.rooms.length, 1);
  assert.equal(catalog.featured.awards[0].roomCount, 1);
});
