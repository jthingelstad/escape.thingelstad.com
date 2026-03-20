const catalog = require('./catalog');
const ai = require('./ai');
const { getRoomAiSearchHints } = require('../../lib/aiArtifacts');

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizeHints(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .flatMap((value) => normalizeToken(value).split(/\s+/))
      .filter((token) => token.length >= 3)
  )];
}

function countSharedByAirtableId(left = [], right = []) {
  const rightIds = new Set((right || []).map((item) => item.airtableId).filter(Boolean));
  return (left || []).filter((item) => rightIds.has(item.airtableId)).length;
}

function buildRelatedRoomsIndex(rooms, aiSearch) {
  const hintTokensBySlug = new Map();
  const tokenFrequency = new Map();

  rooms.forEach((room) => {
    const tokens = tokenizeHints(getRoomAiSearchHints(aiSearch, room));
    hintTokensBySlug.set(room.slug, new Set(tokens));
    tokens.forEach((token) => {
      tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
    });
  });

  return {
    hintTokensBySlug,
    tokenFrequency,
    roomCount: rooms.length
  };
}

function scoreSharedHintTokens(leftRoom, rightRoom, relatedIndex) {
  const leftTokens = relatedIndex.hintTokensBySlug.get(leftRoom.slug) || new Set();
  const rightTokens = relatedIndex.hintTokensBySlug.get(rightRoom.slug) || new Set();
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let score = 0;
  leftTokens.forEach((token) => {
    if (!rightTokens.has(token)) return;
    const frequency = relatedIndex.tokenFrequency.get(token) || relatedIndex.roomCount;
    score += Math.max(0.45, Math.log((relatedIndex.roomCount + 1) / (frequency + 1)));
  });

  return Math.min(score, 4.5);
}

function scoreRelatedRoom(sourceRoom, candidateRoom, relatedIndex) {
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

  score += scoreSharedHintTokens(sourceRoom, candidateRoom, relatedIndex);
  return score;
}

function findRelatedRooms(sourceRoom, allRooms, relatedIndex, options = {}) {
  const limit = options.limit || 4;
  const minimumScore = options.minimumScore || 3;

  return allRooms
    .filter((candidate) => candidate.airtableId !== sourceRoom.airtableId)
    .map((candidate) => ({
      room: candidate,
      score: scoreRelatedRoom(sourceRoom, candidate, relatedIndex)
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
  const aiData = ai();
  const allRooms = data.rooms;
  const roomsById = Object.fromEntries(allRooms.map((room) => [room.id, room]));
  const relatedIndex = buildRelatedRoomsIndex(allRooms, aiData.search);
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

  return allRooms.map((room, index) => {
    let timePercentile = null;
    if (room.timeLeft != null && sortedTimes.length > 0) {
      const rank = sortedTimes.filter((value) => value <= room.timeLeft).length;
      timePercentile = Math.round((rank / sortedTimes.length) * 100);
    }

    const previousRoom = index > 0
      ? { id: allRooms[index - 1].id, slug: allRooms[index - 1].slug, game: allRooms[index - 1].game }
      : null;
    const nextRoom = index < allRooms.length - 1
      ? { id: allRooms[index + 1].id, slug: allRooms[index + 1].slug, game: allRooms[index + 1].game }
      : null;
    const relatedRooms = findRelatedRooms(room, allRooms, relatedIndex);

    return {
      ...room,
      stats: {
        avgTimeLeft: avgTimeLeft != null ? Number(avgTimeLeft.toFixed(2)) : null,
        timePercentile,
        overallWinRate,
        totalPlayed: played.length,
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
module.exports.buildRelatedRoomsIndex = buildRelatedRoomsIndex;
module.exports.findRelatedRooms = findRelatedRooms;
