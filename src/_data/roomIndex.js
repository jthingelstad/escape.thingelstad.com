const catalog = require('./catalog');

module.exports = function() {
  return catalog().rooms.map((room) => ({
    id: room.id,
    airtableId: room.airtableId,
    slug: room.slug,
    game: room.game,
    date: room.date,
    status: room.status,
    timeLeft: room.timeLeft,
    officialUrl: room.officialUrl,
    blogUrl: room.blogUrl,
    mortyId: room.mortyId,
    photo: room.photo,
    notes: room.notes,
    commentary: room.commentary,
    searchText: room.searchText,
    ratingSummary: room.ratingSummary,
    company: room.company,
    location: room.location,
    players: room.players,
    awards: room.awards,
    trips: room.trips,
    lists: room.lists,
    themes: room.themes
  }));
};
