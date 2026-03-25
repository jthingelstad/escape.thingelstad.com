const catalog = require('./catalog');

module.exports = function() {
  const data = catalog();
  const rooms = data.rooms;

  const years = [...new Set(rooms.map((room) => room.date.slice(0, 4)))].sort().reverse();
  const countries = [...new Set(
    rooms
      .map((room) => room.location?.country)
      .filter(Boolean)
  )].sort();

  const usedCompanyIds = new Set(rooms.map((room) => room.company?.airtableId).filter(Boolean));
  const usedLocationIds = new Set(rooms.map((room) => room.location?.airtableId).filter(Boolean));
  const usedPlayerIds = new Set(rooms.flatMap((room) => room.players.map((player) => player.airtableId)));
  const usedAwardIds = new Set(rooms.flatMap((room) => room.awards.map((award) => award.airtableId)));
  const usedTripIds = new Set(rooms.flatMap((room) => room.trips.map((trip) => trip.airtableId)));
  const usedListIds = new Set(rooms.flatMap((room) => room.lists.map((list) => list.airtableId)));
  const usedThemeIds = new Set(rooms.flatMap((room) => room.themes.map((theme) => theme.airtableId)));

  return {
    years,
    countries,
    companies: data.companies
      .filter((company) => usedCompanyIds.has(company.airtableId))
      .map((company) => ({ slug: company.slug, label: company.name })),
    locations: data.locations
      .filter((location) => usedLocationIds.has(location.airtableId))
      .map((location) => ({ slug: location.slug, label: location.label })),
    players: data.players
      .filter((player) => usedPlayerIds.has(player.airtableId))
      .map((player) => ({ slug: player.slug, label: player.name, featured: player.featured })),
    awards: data.awards
      .filter((award) => usedAwardIds.has(award.airtableId))
      .map((award) => ({ slug: award.slug, label: award.name })),
    trips: data.trips
      .filter((trip) => usedTripIds.has(trip.airtableId))
      .map((trip) => ({ slug: trip.slug, label: trip.name, featured: trip.featured })),
    lists: data.lists
      .filter((list) => usedListIds.has(list.airtableId))
      .map((list) => ({ slug: list.slug, label: list.name, id: list.id })),
    themes: data.themes
      .filter((theme) => usedThemeIds.has(theme.airtableId))
      .map((theme) => ({ slug: theme.slug, label: theme.name }))
  };
};
