const DEFAULT_ENTRY_LIMIT = 25;
const SITE_URL = 'https://escape.thingelstad.com';

function formatDate(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function formatLocation(location) {
  if (!location) return '';
  return [...new Set([location.city, location.region, location.country].filter(Boolean))].join(', ');
}

function formatPeople(names) {
  if (names.length === 0) return 'The Escaping Things team';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

function formatDuration(value) {
  const totalSeconds = Math.round(Math.abs(value) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (seconds > 0) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  return parts.join(', ');
}

function describeResult(room) {
  const duration = room.timeLeft == null ? null : formatDuration(room.timeLeft);

  if (room.status === 'Escaped') {
    if (duration === '') return 'The team escaped right at the buzzer.';
    return duration
      ? `The team escaped with ${duration} left.`
      : 'The team escaped.';
  }

  if (room.status === 'Completed') {
    if (room.timeLeft == null) return 'The team completed the room.';
    if (duration === '') return 'The team completed it right at the buzzer.';
    return room.timeLeft < 0
      ? `The team completed it after running ${duration} over.`
      : `The team completed it with ${duration} left.`;
  }

  if (room.status === 'Try again') {
    return duration && room.timeLeft < 0
      ? `Time ran out, ending ${duration} over, so this one goes in the “try again” column.`
      : 'Time ran out, so this one goes in the “try again” column.';
  }

  return 'The team completed the experience.';
}

function companyClause(room) {
  const company = room.company?.name?.trim();
  if (!company || company.toLocaleLowerCase() === room.game.trim().toLocaleLowerCase()) return '';
  return ` at ${company}`;
}

function titleFor(room) {
  const company = companyClause(room);
  if (room.status === 'Escaped') return `We escaped ${room.game}${company}`;
  if (room.status === 'Completed') return `We completed ${room.game}${company}`;
  if (room.status === 'Try again') return `We took on ${room.game}${company}`;
  return `We played ${room.game}${company}`;
}

function latestTimestamp(values) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function buildFeedEntry(room) {
  const location = formatLocation(room.location);
  const playerNames = (room.players || []).map((player) => player.name).filter(Boolean);
  const people = formatPeople(playerNames);
  const place = location ? ` in ${location}` : '';
  const lede = `On ${formatDate(room.date)}, ${people} played ${room.game}${companyClause(room)}${place}.`;
  const result = describeResult(room);
  const summary = `${lede} ${result}`;
  const publishedAt = `${room.date}T00:00:00Z`;
  const updatedAt = latestTimestamp([
    publishedAt,
    room.modifiedAt,
    ...(room.experiences || []).flatMap((experience) => [experience.modifiedAt, experience.createdAt])
  ]);

  return {
    id: `tag:escape.thingelstad.com,${room.date}:${room.airtableId}`,
    publishedAt,
    updatedAt,
    title: titleFor(room),
    summary,
    lede,
    result,
    url: `${SITE_URL}/room/${room.slug}/`,
    room
  };
}

function buildFeed(rooms, { limit = DEFAULT_ENTRY_LIMIT } = {}) {
  const playedRooms = rooms
    .filter((room) => room.status !== 'Scheduled' && room.date)
    .toSorted((left, right) => {
      const dateOrder = right.date.localeCompare(left.date);
      return dateOrder || right.number - left.number;
    });
  const entries = playedRooms.slice(0, limit).map(buildFeedEntry);

  return {
    entries,
    updatedAt: latestTimestamp(entries.map((entry) => entry.updatedAt))
  };
}

module.exports = {
  DEFAULT_ENTRY_LIMIT,
  buildFeed,
  buildFeedEntry,
  describeResult,
  formatPeople
};
