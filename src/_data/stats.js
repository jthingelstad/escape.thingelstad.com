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

  // Pre-compute chart datasets for the stats page

  // Rooms per year (stacked bar: escaped, tryAgain, completed, scheduled)
  const yearData = {};
  allRooms.forEach(r => {
    const year = r.date.substring(0, 4);
    if (!yearData[year]) yearData[year] = { escaped: 0, tryAgain: 0, completed: 0, scheduled: 0 };
    switch (r.status) {
      case 'Escaped': yearData[year].escaped++; break;
      case 'Try again': yearData[year].tryAgain++; break;
      case 'Completed': yearData[year].completed++; break;
      case 'Scheduled': yearData[year].scheduled++; break;
    }
  });
  const sortedYears = Object.keys(yearData).sort();
  const chartRoomsPerYear = {
    labels: sortedYears,
    escaped: sortedYears.map(y => yearData[y].escaped),
    tryAgain: sortedYears.map(y => yearData[y].tryAgain),
    completed: sortedYears.map(y => yearData[y].completed),
    scheduled: sortedYears.map(y => yearData[y].scheduled)
  };

  // Monthly distribution (Jan-Dec aggregate, played rooms only)
  const months = Array(12).fill(0);
  played.forEach(r => {
    if (r.date) {
      const month = parseInt(r.date.substring(5, 7)) - 1;
      months[month]++;
    }
  });
  const chartMonthly = months;

  // Rooms by state (US only, sorted desc)
  const states = {};
  played.forEach(r => {
    if (r.location && r.location.country === 'United States' && r.location.region) {
      states[r.location.region] = (states[r.location.region] || 0) + 1;
    }
  });
  const chartStates = Object.entries(states)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  // Rooms by country (sorted desc)
  const countryCounts = {};
  played.forEach(r => {
    if (r.location && r.location.country) {
      countryCounts[r.location.country] = (countryCounts[r.location.country] || 0) + 1;
    }
  });
  const chartCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  // Top companies (top 10, sorted desc)
  const companyCounts = {};
  played.forEach(r => {
    if (r.company) {
      companyCounts[r.company] = (companyCounts[r.company] || 0) + 1;
    }
  });
  const chartCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  // Time left chart data (sorted by date)
  // Clamp extreme negative values so one outlier doesn't compress the chart
  const CHART_TIME_FLOOR = -10;
  const chartTimeLeft = played
    .filter(r => r.timeLeft != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => {
      const slug = r.game.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const clamped = r.timeLeft < CHART_TIME_FLOOR;
      return {
        x: `#${r.id}`,
        y: parseFloat(Math.max(CHART_TIME_FLOOR, r.timeLeft).toFixed(2)),
        raw: parseFloat(r.timeLeft.toFixed(2)),
        clamped,
        label: `#${r.id} ${r.game}`,
        slug: `${r.id}-${slug}`
      };
    });

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
    planned,
    charts: {
      roomsPerYear: chartRoomsPerYear,
      monthly: chartMonthly,
      states: chartStates,
      countries: chartCountries,
      companies: chartCompanies,
      timeLeft: chartTimeLeft
    }
  };
};
