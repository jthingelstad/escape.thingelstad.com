const catalog = require('./catalog');

function countSharedByAirtableId(left = [], right = []) {
  const rightIds = new Set((right || []).map((item) => item.airtableId).filter(Boolean));
  return (left || []).filter((item) => rightIds.has(item.airtableId)).length;
}

function scoreRelatedRoom(sourceRoom, candidateRoom) {
  let score = 0;

  score += countSharedByAirtableId(sourceRoom.themes, candidateRoom.themes) * 8;
  score += countSharedByAirtableId(sourceRoom.awards, candidateRoom.awards) * 5;
  score += countSharedByAirtableId(sourceRoom.trips, candidateRoom.trips) * 4;
  score += countSharedByAirtableId(sourceRoom.lists, candidateRoom.lists) * 4;
  score += countSharedByAirtableId(sourceRoom.players, candidateRoom.players) * 2;

  if (sourceRoom.location?.country && sourceRoom.location.country === candidateRoom.location?.country) score += 1.5;
  if (sourceRoom.location?.city && sourceRoom.location.city === candidateRoom.location?.city) score += 1;
  if (sourceRoom.status && sourceRoom.status === candidateRoom.status) score += 0.5;
  if (sourceRoom.company?.airtableId && sourceRoom.company.airtableId === candidateRoom.company?.airtableId) score += 0.5;

  return score;
}

function findRelatedRooms(sourceRoom, allRooms, options = {}) {
  const limit = options.limit || 4;
  const minimumScore = options.minimumScore || 3;

  return allRooms
    .filter((candidate) => candidate.airtableId !== sourceRoom.airtableId)
    .map((candidate) => ({
      room: candidate,
      score: scoreRelatedRoom(sourceRoom, candidate)
    }))
    .filter((entry) => entry.score >= minimumScore)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.room.date !== right.room.date) return String(right.room.date || '').localeCompare(String(left.room.date || ''));
      return left.room.game.localeCompare(right.room.game);
    })
    .slice(0, limit)
    .map((entry) => entry.room);
}

function buildRoomDetail() {
  const data = catalog();
  const allRooms = data.rooms;
  const played = allRooms.filter((room) => room.status !== 'Scheduled');
  const wins = played.filter((room) => room.status === 'Escaped' || room.status === 'Completed');
  const timesWithValues = played.filter((room) => room.timeLeft != null);

  const avgTimeLeft = timesWithValues.length > 0
    ? timesWithValues.reduce((sum, room) => sum + room.timeLeft, 0) / timesWithValues.length
    : null;

  const sortedTimes = timesWithValues
    .map((room) => room.timeLeft)
    .sort((left, right) => left - right);

  const overallWinRate = played.length
    ? Math.round((wins.length / played.length) * 100)
    : 0;

  const companyStats = new Map();
  played.forEach((room) => {
    const companyId = room.company?.airtableId;
    if (!companyId) return;
    const current = companyStats.get(companyId) || { total: 0, wins: 0 };
    current.total += 1;
    if (room.status === 'Escaped' || room.status === 'Completed') current.wins += 1;
    companyStats.set(companyId, current);
  });

  return allRooms.map((room, index) => {
    let timePercentile = null;
    if (room.timeLeft != null && sortedTimes.length > 0) {
      const rank = sortedTimes.filter((value) => value <= room.timeLeft).length;
      timePercentile = Math.round((rank / sortedTimes.length) * 100);
    }

    const previousRoom = index > 0
      ? {
          id: allRooms[index - 1].id,
          number: allRooms[index - 1].number,
          slug: allRooms[index - 1].slug,
          game: allRooms[index - 1].game
        }
      : null;
    const nextRoom = index < allRooms.length - 1
      ? {
          id: allRooms[index + 1].id,
          number: allRooms[index + 1].number,
          slug: allRooms[index + 1].slug,
          game: allRooms[index + 1].game
        }
      : null;
    const relatedRooms = findRelatedRooms(room, allRooms);
    const company = companyStats.get(room.company?.airtableId) || { total: 0, wins: 0 };

    return {
      ...room,
      stats: {
        avgTimeLeft: avgTimeLeft != null ? Number(avgTimeLeft.toFixed(2)) : null,
        timePercentile,
        overallWinRate,
        totalPlayed: played.length,
        companyTotal: company.total,
        companyWins: company.wins,
        relatedRooms
      },
      nav: {
        prev: previousRoom,
        next: nextRoom
      }
    };
  });
}

module.exports = buildRoomDetail;
module.exports.findRelatedRooms = findRelatedRooms;
