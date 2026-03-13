const rooms = require('./rooms.json');

module.exports = function() {
  return rooms.rooms
    .filter(r => r.photo)
    .map(r => ({
      airtableId: r.airtableId,
      game: r.game,
      company: r.company,
      date: r.date,
      location: r.location,
      status: r.status,
      timeLeft: r.timeLeft ?? null,
      blogUrl: r.blogUrl || null,
      tags: r.tags || [],
      photo: r.photo
    }));
};
