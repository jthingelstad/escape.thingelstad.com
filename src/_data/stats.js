const rooms = require('./rooms.json');

module.exports = function() {
  const allRooms = rooms.rooms;
  const completed = allRooms.filter(r => r.status === 'completed');
  const planned = allRooms.filter(r => r.status === 'planned');
  const wins = completed.filter(r => r.win === true);

  const regions = new Set();
  const countries = new Set();
  const companies = new Set();

  completed.forEach(r => {
    if (r.location && r.location.region) regions.add(r.location.region);
    if (r.location && r.location.country) countries.add(r.location.country);
    if (r.company) companies.add(r.company);
  });

  const years = [...new Set(completed.map(r => r.date.slice(0, 4)))].sort();

  const latestCompleted = [...completed].sort((a, b) => b.date.localeCompare(a.date))[0] || null;

  return {
    totalRooms: completed.length,
    totalWins: wins.length,
    winRate: completed.length > 0 ? Math.round((wins.length / completed.length) * 100) : 0,
    regionCount: regions.size,
    countryCount: countries.size,
    companyCount: companies.size,
    yearsActive: years.length,
    firstYear: years[0],
    lastYear: years[years.length - 1],
    latestCompleted,
    planned
  };
};
