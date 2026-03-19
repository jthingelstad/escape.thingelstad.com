const catalog = require('./catalog');
const ai = require('./ai');
const { buildRoomSearchIndex, getRoomAiSearchHints } = require('../../lib/aiArtifacts');

module.exports = function() {
  const aiData = ai();

  return catalog().rooms.map((room) => {
    const aiSearchHints = getRoomAiSearchHints(aiData.search, room);

    return {
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
    aiSearchHints,
    searchIndex: buildRoomSearchIndex(room, aiSearchHints),
    ratingSummary: room.ratingSummary,
    company: room.company,
    location: room.location,
    players: room.players,
    awards: room.awards,
    trips: room.trips,
    lists: room.lists,
    themes: room.themes
    };
  });
};
