const rooms = require('./rooms.json');

module.exports = function() {
  const allRooms = rooms.rooms;
  const played = allRooms.filter(r => r.status === 'Escaped' || r.status === 'Try again' || r.status === 'Completed');
  const planned = allRooms.filter(r => r.status === 'Scheduled');
  const escaped = allRooms.filter(r => r.status === 'Escaped');
  const tryAgain = allRooms.filter(r => r.status === 'Try again');

  const regions = new Set();
  const countries = new Set();
  const companies = new Set();

  played.forEach(r => {
    if (r.location && r.location.region) regions.add(r.location.region);
    if (r.location && r.location.country) countries.add(r.location.country);
    if (r.company) companies.add(r.company);
  });

  const years = [...new Set(played.map(r => r.date.slice(0, 4)))].sort();

  const sortedPlayed = [...played].sort((a, b) => b.date.localeCompare(a.date));
  const latestCompleted = sortedPlayed[0] || null;
  const recentCompleted = sortedPlayed.slice(0, 6);

  const completed = allRooms.filter(r => r.status === 'Completed');
  const wins = escaped.length + completed.length;
  const decidedCount = wins + tryAgain.length;
  const winRate = decidedCount > 0 ? Math.round((wins / decidedCount) * 100) : 0;

  return {
    totalRooms: played.length,
    totalWins: wins,
    winRate,
    regionCount: regions.size,
    countryCount: countries.size,
    companyCount: companies.size,
    yearsActive: years.length,
    firstYear: years[0],
    lastYear: years[years.length - 1],
    latestCompleted,
    recentCompleted,
    planned
  };
};
