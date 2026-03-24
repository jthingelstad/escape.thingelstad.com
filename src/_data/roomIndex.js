const catalog = require('./catalog');

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildRoomSearchIndex(room) {
  const values = [
    room.searchText,
    room.game,
    room.status,
    room.status ? `status ${room.status}` : '',
    room.date,
    room.date ? `year ${room.date.slice(0, 4)}` : '',
    room.company?.name,
    room.company?.name ? `company ${room.company.name}` : '',
    room.location?.label,
    room.location?.label ? `location ${room.location.label}` : '',
    room.location?.city,
    room.location?.city ? `city ${room.location.city}` : '',
    room.location?.region,
    room.location?.region ? `region ${room.location.region}` : '',
    room.location?.country,
    room.location?.country ? `country ${room.location.country}` : '',
    ...room.players.flatMap((player) => [player.name, `player ${player.name}`]),
    ...room.awards.flatMap((award) => [award.name, `award ${award.name}`]),
    ...room.trips.flatMap((trip) => [trip.name, `trip ${trip.name}`]),
    ...room.lists.flatMap((list) => [list.name, `list ${list.name}`]),
    ...room.themes.flatMap((theme) => [theme.name, `theme ${theme.name}`])
  ];

  return dedupeStrings(values.map((item) => (typeof item === 'string' ? item.trim() : ''))).join(' ');
}

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
    searchIndex: buildRoomSearchIndex(room),
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
