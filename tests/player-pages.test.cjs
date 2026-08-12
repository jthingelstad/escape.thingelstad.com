const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlayerPages } = require('../src/_data/playerPages');

test('featured player pages exclude scheduled rooms from history and statistics', () => {
  const playedRoom = {
    airtableId: 'played-room',
    date: '2025-01-01',
    status: 'Escaped'
  };
  const scheduledRoom = {
    airtableId: 'scheduled-room',
    date: '2025-01-02',
    status: 'Scheduled'
  };
  const pages = buildPlayerPages({
    featured: {
      players: [{
        airtableId: 'player1',
        name: 'Jamie',
        roomIds: ['played-room', 'scheduled-room'],
        roomCount: 1,
        listIds: []
      }]
    },
    lookups: {
      rooms: {
        byAirtableId: {
          'played-room': playedRoom,
          'scheduled-room': scheduledRoom
        }
      },
      lists: { byId: {} }
    },
    experiences: []
  });

  assert.deepEqual(pages[0].rooms, [playedRoom]);
  assert.deepEqual(pages[0].recentRooms, [playedRoom]);
  assert.equal(pages[0].roomCount, 1);
  assert.equal(pages[0].wins, 1);
  assert.equal(pages[0].winRate, 100);
  assert.equal(pages[0].firstDate, '2025-01-01');
  assert.equal(pages[0].lastDate, '2025-01-01');
});
