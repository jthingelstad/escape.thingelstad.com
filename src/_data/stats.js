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

module.exports = function() {
  const allRooms = catalog().rooms;
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
    room.awards.forEach((award) => {
      awards.add(award.airtableId);
      increment(awardCounts, award.name);
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

  const topPlayer = sortCounts(playerCounts, 1)[0] || null;
  const topTheme = sortCounts(themeCounts, 1)[0] || null;

  const ratedRooms = played
    .filter((room) => room.ratingSummary.count > 0 && room.ratingSummary.average != null)
    .map((room) => ({
      label: `#${room.id} ${room.game}`,
      average: room.ratingSummary.average,
      count: room.ratingSummary.count
    }))
    .sort((left, right) => right.average - left.average || right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 8);

  const averageTeamSize = playerCountSamples > 0
    ? Number((totalPlayerCount / playerCountSamples).toFixed(1))
    : null;
  const averageRating = totalRatings > 0
    ? Number((totalRatingValue / totalRatings).toFixed(1))
    : null;

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
    totalRooms: played.length,
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
    topPlayer,
    topTheme,
    firstYear: years[0],
    lastYear: years[years.length - 1],
    latestCompleted: played[played.length - 1] || null,
    recentCompleted: played.slice(-12).reverse(),
    planned,
    insights: {
      momentum: {
        currentWinStreak,
        longestWinStreak,
        yearsActive: years.length
      },
      cast: {
        uniquePlayers: players.size,
        averageTeamSize,
        topPlayer
      },
      curation: {
        roomsWithAwards,
        roomsWithTrips,
        roomsWithLists,
        tripCount: trips.size,
        listCount: lists.size
      },
      ratings: {
        ratedRoomCount,
        averageRating,
        favoriteVoteCount
      }
    },
    charts: {
      roomsPerYear: {
        labels: yearlyResults.map((entry) => entry.year),
        escaped: yearlyResults.map((entry) => entry.escaped),
        tryAgain: yearlyResults.map((entry) => entry.tryAgain),
        completed: yearlyResults.map((entry) => entry.completed),
        scheduled: yearlyResults.map((entry) => entry.scheduled)
      },
      winRateByYear: {
        labels: yearlyResults.map((entry) => entry.year),
        played: yearlyResults.map((entry) => entry.played),
        winRate: yearlyResults.map((entry) => entry.winRate)
      },
      monthly,
      states: sortCounts(stateCounts),
      countries: sortCounts(countryCounts),
      players: sortCounts(playerCounts, 10),
      themes: sortCounts(themeCounts, 10),
      awards: sortCounts(awardCounts),
      teamSizes: Object.entries(teamSizeCounts).map(([label, count]) => ({ label, count }))
        .sort((left, right) => {
          if (left.label === 'Unknown') return 1;
          if (right.label === 'Unknown') return -1;
          return Number.parseInt(left.label, 10) - Number.parseInt(right.label, 10);
        }),
      ratedRooms,
      timeLeft: chartTimeLeft
    }
  };
};
