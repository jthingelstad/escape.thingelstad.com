const catalog = require('./catalog');

const WIN_STATUSES = new Set(['Escaped', 'Completed']);

function increment(map, label) {
  if (!label) return;
  map[label] = (map[label] || 0) + 1;
}

function sortCounts(counts, limit = null) {
  const items = Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  return limit == null ? items : items.slice(0, limit);
}

function buildStats(allRooms) {
  const played = allRooms.filter((room) => room.status !== 'Scheduled');
  const planned = allRooms.filter((room) => room.status === 'Scheduled');
  const escaped = played.filter((room) => room.status === 'Escaped');
  const tryAgain = played.filter((room) => room.status === 'Try again');
  const completed = played.filter((room) => room.status === 'Completed');
  const wins = played.filter((room) => WIN_STATUSES.has(room.status));
  const decidedCount = wins.length + tryAgain.length;
  const years = [...new Set(played.map((room) => room.date.slice(0, 4)))].sort();

  const regions = new Set();
  const countries = new Set();
  const companies = new Set();
  const players = new Set();
  const trips = new Set();
  const lists = new Set();
  const themes = new Set();
  const awards = new Set();

  const yearData = {};
  const monthly = Array(12).fill(0);
  const stateCounts = {};
  const countryCounts = {};
  const playerCounts = {};
  const themeCounts = {};
  const awardCounts = {};
  const teamSizeCounts = {};

  let currentWinStreak = 0;
  let longestWinStreak = 0;
  let ratedRoomCount = 0;
  let totalRatings = 0;
  let totalRatingValue = 0;
  let favoriteVoteCount = 0;
  let roomsWithTrips = 0;
  let roomsWithLists = 0;
  let roomsWithAwards = 0;
  let totalPlayerCount = 0;
  let playerCountSamples = 0;
  const cumulativeStreak = [];
  let cumulative = 0;

  played.forEach((room) => {
    const year = room.date.substring(0, 4);
    const month = Number.parseInt(room.date.substring(5, 7), 10) - 1;

    if (!yearData[year]) {
      yearData[year] = { escaped: 0, tryAgain: 0, completed: 0, scheduled: 0 };
    }

    switch (room.status) {
      case 'Escaped':
        yearData[year].escaped += 1;
        currentWinStreak += 1;
        break;
      case 'Completed':
        yearData[year].completed += 1;
        currentWinStreak += 1;
        break;
      case 'Try again':
        yearData[year].tryAgain += 1;
        currentWinStreak = 0;
        break;
      default:
        break;
    }

    longestWinStreak = Math.max(longestWinStreak, currentWinStreak);

    cumulative += 1;
    cumulativeStreak.push({
      x: room.date,
      y: cumulative,
      win: WIN_STATUSES.has(room.status),
      streak: currentWinStreak
    });

    if (month >= 0 && month < 12) monthly[month] += 1;
    if (room.location?.region) regions.add(room.location.region);
    if (room.location?.country === 'United States' && room.location?.region) {
      increment(stateCounts, room.location.region);
    }
    if (room.location?.country) {
      countries.add(room.location.country);
      increment(countryCounts, room.location.country);
    }
    if (room.company?.airtableId) companies.add(room.company.airtableId);

    room.players.forEach((player) => {
      players.add(player.airtableId);
      increment(playerCounts, player.name);
    });
    room.themes.forEach((theme) => {
      themes.add(theme.airtableId);
      increment(themeCounts, theme.name);
    });
    const seenAwardLabels = new Set();
    room.awards.forEach((award) => {
      awards.add(award.airtableId);
      const awardLabel = award.name.replace(/\s*\(\d{4}\)$/, '');
      if (!seenAwardLabels.has(awardLabel)) {
        seenAwardLabels.add(awardLabel);
        increment(awardCounts, awardLabel);
      }
    });
    room.trips.forEach((trip) => trips.add(trip.airtableId));
    room.lists.forEach((list) => lists.add(list.airtableId));

    if (room.trips.length > 0) roomsWithTrips += 1;
    if (room.lists.length > 0) roomsWithLists += 1;
    if (room.awards.length > 0) roomsWithAwards += 1;

    const playerCount = room.players.length;
    increment(teamSizeCounts, playerCount === 0 ? 'Unknown' : `${playerCount} players`);
    if (playerCount > 0) {
      totalPlayerCount += playerCount;
      playerCountSamples += 1;
    }

    if (room.ratingSummary.count > 0) {
      ratedRoomCount += 1;
      totalRatings += room.ratingSummary.count;
      favoriteVoteCount += room.ratingSummary.bestThingsCount;
      if (room.ratingSummary.average != null) {
        totalRatingValue += room.ratingSummary.average * room.ratingSummary.count;
      }
    }
  });

  planned.forEach((room) => {
    const year = room.date.substring(0, 4);
    if (!yearData[year]) {
      yearData[year] = { escaped: 0, tryAgain: 0, completed: 0, scheduled: 0 };
    }
    yearData[year].scheduled += 1;
  });

  const sortedYears = Object.keys(yearData).sort();
  const yearlyResults = sortedYears.map((year) => {
    const escapedCount = yearData[year].escaped;
    const completedCount = yearData[year].completed;
    const tryAgainCount = yearData[year].tryAgain;
    const decided = escapedCount + completedCount + tryAgainCount;
    const winsForYear = escapedCount + completedCount;

    return {
      year,
      escaped: escapedCount,
      tryAgain: tryAgainCount,
      completed: completedCount,
      scheduled: yearData[year].scheduled,
      played: winsForYear + tryAgainCount,
      winRate: decided > 0 ? Math.round((winsForYear / decided) * 100) : null
    };
  });

  const averageTeamSize = playerCountSamples > 0
    ? Number((totalPlayerCount / playerCountSamples).toFixed(1))
    : null;
  const averageRating = totalRatings > 0
    ? Number((totalRatingValue / totalRatings).toFixed(1))
    : null;

  const ratingBuckets = Array(10).fill(0);
  played.forEach((room) => {
    if (room.ratingSummary.count > 0 && room.ratingSummary.average != null) {
      const index = Math.min(Math.max(Math.round(room.ratingSummary.average * 2) - 1, 0), 9);
      ratingBuckets[index] += 1;
    }
  });
  const ratingDistribution = {
    labels: ['0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'],
    counts: ratingBuckets
  };

  const CHART_TIME_FLOOR = -10;
  const chartTimeLeft = played
    .filter((room) => room.timeLeft != null)
    .map((room) => ({
      x: `#${room.id}`,
      y: Number.parseFloat(Math.max(CHART_TIME_FLOOR, room.timeLeft).toFixed(2)),
      raw: Number.parseFloat(room.timeLeft.toFixed(2)),
      clamped: room.timeLeft < CHART_TIME_FLOOR,
      label: `#${room.id} ${room.game}`,
      slug: room.slug
    }));

  return {
    totalRooms: allRooms.length,
    totalPlayed: played.length,
    scheduledRooms: planned.length,
    totalWins: wins.length,
    winRate: decidedCount > 0 ? Math.round((wins.length / decidedCount) * 100) : 0,
    regionCount: regions.size,
    countryCount: countries.size,
    companyCount: companies.size,
    yearsActive: years.length,
    uniquePlayerCount: players.size,
    tripCount: trips.size,
    listCount: lists.size,
    themeCount: themes.size,
    awardCount: awards.size,
    currentWinStreak,
    longestWinStreak,
    averageTeamSize,
    ratedRoomCount,
    averageRating,
    favoriteVoteCount,
    roomsWithTrips,
    roomsWithLists,
    roomsWithAwards,
    firstYear: years[0],
    lastYear: years[years.length - 1],
    latestCompleted: played[played.length - 1] || null,
    recentCompleted: played.slice(-8).reverse(),
    planned,
    charts: {
      roomsPerYear: {
        labels: yearlyResults.map((entry) => entry.year),
        escaped: yearlyResults.map((entry) => entry.escaped),
        tryAgain: yearlyResults.map((entry) => entry.tryAgain),
        completed: yearlyResults.map((entry) => entry.completed),
        scheduled: yearlyResults.map((entry) => entry.scheduled)
      },
      monthly,
      states: sortCounts(stateCounts),
      countries: sortCounts(countryCounts),
      players: sortCounts(playerCounts, 10),
      themes: sortCounts(themeCounts, 10),
      awards: sortCounts(awardCounts, 15),
      timeLeft: chartTimeLeft,
      cumulativeStreak,
      ratingDistribution
    }
  };
}

module.exports = function() {
  return buildStats(catalog().rooms);
};
module.exports.buildStats = buildStats;
