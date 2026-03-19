const catalog = require('./catalog');

module.exports = function() {
  const data = catalog();
  const roomLookup = data.lookups.rooms.byAirtableId;

  return data.featured.awards.map((award) => {
    const rooms = award.roomIds
      .map((roomId) => roomLookup[roomId])
      .filter(Boolean);

    return {
      ...award,
      rooms,
      recentRooms: rooms.slice(-6).reverse(),
      countries: [...new Set(rooms.map((room) => room.location?.country).filter(Boolean))].sort()
    };
  });
};
