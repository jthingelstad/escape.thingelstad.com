const catalog = require('./catalog');
const ai = require('./ai');

module.exports = function() {
  const data = catalog();
  const aiData = ai();
  const roomLookup = data.lookups.rooms.byAirtableId;
  const listLookup = data.lookups.lists.byId;

  return data.featured.trips.map((trip) => {
    const rooms = trip.roomIds
      .map((roomId) => roomLookup[roomId])
      .filter(Boolean);
    const lists = (trip.listIds || [])
      .map((listId) => listLookup[listId])
      .filter(Boolean);
    const routeStops = rooms.map((room, index) => ({
      sequence: index + 1,
      room
    }));
    const mapStops = routeStops
      .filter((stop) => stop.room.location?.lat != null && stop.room.location?.lng != null)
      .map((stop) => ({
        sequence: stop.sequence,
        id: stop.room.id,
        slug: stop.room.slug,
        game: stop.room.game,
        date: stop.room.date,
        status: stop.room.status,
        timeLeft: stop.room.timeLeft,
        company: stop.room.company,
        location: stop.room.location
      }));

    return {
      ...trip,
      rooms,
      lists,
      routeStops,
      mapStops,
      countries: [...new Set(rooms.map((room) => room.location?.country).filter(Boolean))].sort(),
      cities: [...new Set(rooms.map((room) => room.location?.city).filter(Boolean))].sort(),
      aiIntro: aiData.copy.trips[trip.slug]?.intro || null,
      aiRouteSummary: aiData.copy.trips[trip.slug]?.routeSummary || null,
      firstDate: rooms[0]?.date || null,
      lastDate: rooms[rooms.length - 1]?.date || null
    };
  });
};
