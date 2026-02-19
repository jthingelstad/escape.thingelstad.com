const rooms = require('./rooms.json');

module.exports = function() {
  const allRooms = rooms.rooms;
  const tags = new Set();
  const years = new Set();
  const countries = new Set();
  const players = new Set();

  allRooms.forEach(r => {
    (r.tags || []).forEach(t => tags.add(t));
    if (r.date) years.add(r.date.substring(0, 4));
    if (r.location && r.location.country) countries.add(r.location.country);
    (r.players || []).forEach(p => players.add(p));
  });

  return {
    tags: [...tags].sort(),
    years: [...years].sort().reverse(),
    countries: [...countries].sort(),
    players: [...players].sort()
  };
};
