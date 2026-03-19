const catalog = require('./catalog');
const ai = require('./ai');

module.exports = function() {
  const data = catalog();
  const aiData = ai();
  const roomLookup = data.lookups.rooms.byAirtableId;

  return data.featured.awards.map((award) => {
    const rooms = award.roomIds
      .map((roomId) => roomLookup[roomId])
      .filter(Boolean);

    return {
      ...award,
      rooms,
      aiIntro: aiData.copy.awards[award.slug]?.intro || null,
      recentRooms: rooms.slice(-6).reverse(),
      countries: [...new Set(rooms.map((room) => room.location?.country).filter(Boolean))].sort()
    };
  });
};
