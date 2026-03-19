const catalog = require('./catalog');

module.exports = function() {
  const data = catalog();
  const allRooms = data.rooms;
  const roomsById = Object.fromEntries(allRooms.map((room) => [room.id, room]));
  const played = allRooms.filter((room) => room.status !== 'Scheduled');
  const wins = played.filter((room) => room.status === 'Escaped' || room.status === 'Completed');
  const timesWithValues = played.filter((room) => room.timeLeft != null);

  const avgTimeLeft = timesWithValues.length > 0
    ? timesWithValues.reduce((sum, room) => sum + room.timeLeft, 0) / timesWithValues.length
    : null;

  const sortedTimes = timesWithValues
    .map((room) => room.timeLeft)
    .sort((left, right) => left - right);

  const companyStats = {};
  played.forEach((room) => {
    const companyId = room.company?.airtableId;
    if (!companyId) return;

    companyStats[companyId] ||= { total: 0, wins: 0, roomIds: [] };
    companyStats[companyId].total += 1;
    if (room.status === 'Escaped' || room.status === 'Completed') {
      companyStats[companyId].wins += 1;
    }
    companyStats[companyId].roomIds.push(room.id);
  });

  const overallWinRate = played.length
    ? Math.round((wins.length / played.length) * 100)
    : 0;

  const sameDayRoomIds = {};
  allRooms.forEach((room) => {
    sameDayRoomIds[room.date] ||= [];
    sameDayRoomIds[room.date].push(room.id);
  });

  return allRooms.map((room, index) => {
    const companyInfo = room.company ? companyStats[room.company.airtableId] : null;
    const otherCompanyRooms = companyInfo
      ? companyInfo.roomIds
        .filter((id) => id !== room.id)
        .map((id) => roomsById[id])
        .filter(Boolean)
        .map((candidate) => ({
          id: candidate.id,
          slug: candidate.slug,
          game: candidate.game,
          status: candidate.status,
          date: candidate.date
        }))
      : [];

    let timePercentile = null;
    if (room.timeLeft != null && sortedTimes.length > 0) {
      const rank = sortedTimes.filter((value) => value <= room.timeLeft).length;
      timePercentile = Math.round((rank / sortedTimes.length) * 100);
    }

    const sameDayRooms = (sameDayRoomIds[room.date] || [])
      .filter((id) => id !== room.id)
      .map((id) => roomsById[id])
      .map((candidate) => ({
        id: candidate.id,
        slug: candidate.slug,
        game: candidate.game,
        company: candidate.company
      }));

    const previousRoom = index > 0
      ? { id: allRooms[index - 1].id, slug: allRooms[index - 1].slug, game: allRooms[index - 1].game }
      : null;
    const nextRoom = index < allRooms.length - 1
      ? { id: allRooms[index + 1].id, slug: allRooms[index + 1].slug, game: allRooms[index + 1].game }
      : null;

    return {
      ...room,
      stats: {
        avgTimeLeft: avgTimeLeft != null ? Number(avgTimeLeft.toFixed(2)) : null,
        timePercentile,
        overallWinRate,
        totalPlayed: played.length,
        companyTotal: companyInfo ? companyInfo.total : 0,
        companyWins: companyInfo ? companyInfo.wins : 0,
        otherCompanyRooms,
        sameDayRooms
      },
      nav: {
        prev: previousRoom,
        next: nextRoom
      }
    };
  });
};
