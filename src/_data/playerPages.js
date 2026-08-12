const catalog = require('./catalog');

function buildPlayerPages(data) {
  const roomLookup = data.lookups.rooms.byAirtableId;
  const listLookup = data.lookups.lists.byId;

  return data.featured.players.map((player) => {
    const rooms = player.roomIds
      .map((roomId) => roomLookup[roomId])
      .filter((room) => room && room.status !== 'Scheduled');
    const lists = (player.listIds || [])
      .map((listId) => listLookup[listId])
      .filter(Boolean);
    const comments = data.experiences
      .filter((experience) => experience.player.airtableId === player.airtableId && experience.comments)
      .slice(-6)
      .reverse();
    const wins = rooms.filter((room) => room.status === 'Escaped' || room.status === 'Completed').length;

    const roomsWithExperience = new Set(
      data.experiences
        .filter((experience) => experience.player.airtableId === player.airtableId)
        .map((experience) => experience.roomAirtableId)
    );
    const playedStatuses = new Set(['Escaped', 'Completed', 'Try again']);
    const missingExperiences = rooms
      .filter((room) => playedStatuses.has(room.status) && !roomsWithExperience.has(room.airtableId))
      .reverse()
      .slice(0, 10);

    return {
      ...player,
      rooms,
      recentRooms: rooms.slice(-8).reverse(),
      lists,
      comments,
      missingExperiences,
      wins,
      winRate: rooms.length ? Math.round((wins / rooms.length) * 100) : 0,
      bio: player.bio || null,
      firstDate: rooms[0]?.date || null,
      lastDate: rooms[rooms.length - 1]?.date || null
    };
  });
}

module.exports = function() {
  return buildPlayerPages(catalog());
};
module.exports.buildPlayerPages = buildPlayerPages;
