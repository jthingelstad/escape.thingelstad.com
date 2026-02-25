const rooms = require('./rooms.json');

module.exports = function() {
  return rooms.rooms
    .filter(r => r.photoUrl)
    .map(r => ({
      game: r.game,
      company: r.company,
      date: r.date,
      location: r.location,
      status: r.status,
      escapeTime: r.escapeTime || null,
      blogUrl: r.blogUrl || null,
      tags: r.tags || [],
      photoUrl: r.photoUrl
    }));
};
