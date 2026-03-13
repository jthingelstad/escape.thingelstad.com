const rooms = require('./rooms.json');

module.exports = function() {
  const allRooms = rooms.rooms;
  const played = allRooms.filter(r =>
    r.status === 'Escaped' || r.status === 'Try again' || r.status === 'Completed'
  );

  // Pre-compute aggregate stats for comparison
  const timesWithValues = played.filter(r => r.timeLeft != null);
  const avgTimeLeft = timesWithValues.length > 0
    ? timesWithValues.reduce((sum, r) => sum + r.timeLeft, 0) / timesWithValues.length
    : null;

  // Time left percentile rankings (higher = better)
  const sortedTimes = timesWithValues
    .map(r => r.timeLeft)
    .sort((a, b) => a - b);

  // Company stats
  const companyCounts = {};
  played.forEach(r => {
    if (r.company) {
      if (!companyCounts[r.company]) companyCounts[r.company] = { total: 0, wins: 0, rooms: [] };
      companyCounts[r.company].total++;
      if (r.status === 'Escaped' || r.status === 'Completed') companyCounts[r.company].wins++;
      companyCounts[r.company].rooms.push(r.id);
    }
  });

  // Overall win rate
  const wins = allRooms.filter(r => r.status === 'Escaped' || r.status === 'Completed').length;
  const decided = wins + allRooms.filter(r => r.status === 'Try again').length;
  const overallWinRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;

  // Build per-room detail data
  return allRooms.map(room => {
    // Room's position in the chronological list
    const playedSorted = played.sort((a, b) => a.date.localeCompare(b.date));
    const chronIndex = playedSorted.findIndex(r => r.id === room.id);
    const roomNumber = chronIndex >= 0 ? chronIndex + 1 : null;

    // Time left percentile
    let timePercentile = null;
    if (room.timeLeft != null && sortedTimes.length > 0) {
      const rank = sortedTimes.filter(t => t <= room.timeLeft).length;
      timePercentile = Math.round((rank / sortedTimes.length) * 100);
    }

    // Rooms at same company
    const companyInfo = companyCounts[room.company] || null;
    const companyRoomIds = companyInfo ? companyInfo.rooms.filter(id => id !== room.id) : [];
    const otherCompanyRooms = companyRoomIds.map(id => {
      const r = allRooms.find(rr => rr.id === id);
      return r ? { id: r.id, airtableId: r.airtableId, game: r.game, status: r.status, date: r.date } : null;
    }).filter(Boolean);

    // Prev/next rooms (chronological by date, all rooms)
    const allSorted = [...allRooms].sort((a, b) => a.date.localeCompare(b.date));
    const idx = allSorted.findIndex(r => r.id === room.id);
    const prevRoom = idx > 0 ? { id: allSorted[idx - 1].id, airtableId: allSorted[idx - 1].airtableId, game: allSorted[idx - 1].game } : null;
    const nextRoom = idx < allSorted.length - 1 ? { id: allSorted[idx + 1].id, airtableId: allSorted[idx + 1].airtableId, game: allSorted[idx + 1].game } : null;

    // Same-day rooms
    const sameDayRooms = allRooms
      .filter(r => r.date === room.date && r.id !== room.id)
      .map(r => ({ id: r.id, airtableId: r.airtableId, game: r.game, company: r.company }));

    return {
      ...room,
      stats: {
        avgTimeLeft: avgTimeLeft != null ? parseFloat(avgTimeLeft.toFixed(2)) : null,
        timePercentile,
        overallWinRate,
        totalPlayed: played.length,
        companyTotal: companyInfo ? companyInfo.total : 0,
        companyWins: companyInfo ? companyInfo.wins : 0,
        otherCompanyRooms,
        sameDayRooms
      },
      nav: { prev: prevRoom, next: nextRoom }
    };
  });
};
