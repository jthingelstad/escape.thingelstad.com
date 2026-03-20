const catalog = require('./catalog');
const ai = require('./ai');

module.exports = function() {
  const data = catalog();
  const aiData = ai();
  const roomLookup = data.lookups.rooms.byAirtableId;
  const listLookup = data.lookups.lists.byId;

  return data.featured.players.map((player) => {
    const rooms = player.roomIds
      .map((roomId) => roomLookup[roomId])
      .filter(Boolean);
    const lists = (player.listIds || [])
      .map((listId) => listLookup[listId])
      .filter(Boolean);
    const comments = data.experiences
      .filter((experience) => experience.player.airtableId === player.airtableId && experience.comments)
      .slice(-6)
      .reverse();
    const wins = rooms.filter((room) => room.status === 'Escaped' || room.status === 'Completed').length;

    return {
      ...player,
      rooms,
      lists,
      comments,
      wins,
      winRate: rooms.length ? Math.round((wins / rooms.length) * 100) : 0,
      bio: player.bio || null,
      aiIntro: player.bio ? null : aiData.copy.players[player.slug]?.intro || null,
      firstDate: rooms[0]?.date || null,
      lastDate: rooms[rooms.length - 1]?.date || null
    };
  });
};
