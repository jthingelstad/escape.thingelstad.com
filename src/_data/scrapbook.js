const catalog = require('./catalog');

module.exports = function() {
  return catalog().rooms
    .filter((room) => room.photo)
    .map((room) => ({
      id: room.id,
      slug: room.slug,
      game: room.game,
      company: room.company,
      location: room.location,
      date: room.date,
      status: room.status,
      timeLeft: room.timeLeft,
      blogUrl: room.blogUrl,
      officialUrl: room.officialUrl,
      awards: room.awards,
      trips: room.trips,
      lists: room.lists,
      themes: room.themes,
      photo: room.photo
    }));
};
