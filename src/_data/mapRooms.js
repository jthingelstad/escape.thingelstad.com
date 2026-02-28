const rooms = require('./rooms.json');

module.exports = function() {
  return rooms.rooms.map(r => ({
    id: r.id,
    game: r.game,
    company: r.company,
    companyUrl: r.companyUrl || null,
    date: r.date,
    status: r.status,
    timeLeft: r.timeLeft ?? null,
    location: r.location || null,
    tags: r.tags || [],
    players: r.players || [],
    notes: r.notes || null,
    blogUrl: r.blogUrl || null,
    mortyId: r.mortyId || null,
    photo: r.photo || null
  }));
};
