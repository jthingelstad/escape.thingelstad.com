const rooms = require('./rooms.json');

module.exports = function() {
  return rooms.rooms.map(r => ({
    id: r.id,
    airtableId: r.airtableId,
    game: r.game,
    company: r.company,
    companyUrl: r.companyUrl || null,
    date: r.date,
    status: r.status,
    timeLeft: r.timeLeft ?? null,
    location: r.location ? {
      city: r.location.city || null,
      region: r.location.region || null,
      country: r.location.country || null
    } : null,
    tags: r.tags || [],
    players: r.players || [],
    notes: r.notes || null,
    blogUrl: r.blogUrl || null,
    mortyId: r.mortyId || null,
    photoUrl: r.photoUrl || null
  }));
};
