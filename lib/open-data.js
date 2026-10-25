const {
  SITE_URL,
  DEFAULT_ENTRY_LIMIT,
  describeResult,
  formatDate,
  formatLocation,
  latestTimestamp,
  playedRooms
} = require('./feed');

// Room photos stay out of the machine-readable files: robots.txt keeps
// /images/rooms/ away from crawlers, and these files are for crawlers and
// agents. The pages and the feeds still show them to people.

function roomUrl(room) {
  return `${SITE_URL}/room/${room.slug}/`;
}

function tripUrl(trip) {
  return trip.featured
    ? `${SITE_URL}/trip/${encodeURIComponent(trip.slug)}/`
    : `${SITE_URL}/rooms/?trip=${encodeURIComponent(trip.slug)}`;
}

function listUrl(list) {
  return `${SITE_URL}/list/${encodeURIComponent(list.slug)}/`;
}

function exportRoom(room) {
  const location = room.location;
  const rating = room.ratingSummary || {};
  return {
    number: room.number,
    url: roomUrl(room),
    game: room.game,
    date: room.date,
    status: room.status,
    time_left_minutes: room.timeLeft ?? null,
    company: room.company?.name ?? null,
    location: location
      ? {
          name: location.label ?? null,
          city: location.city ?? null,
          region: location.region ?? null,
          country: location.country ?? null,
          lat: location.lat ?? null,
          lng: location.lng ?? null
        }
      : null,
    players: (room.players || []).map((player) => player.name),
    trips: (room.trips || []).map((trip) => ({ name: trip.name, url: tripUrl(trip) })),
    lists: (room.lists || []).map((list) => ({ name: list.name, url: listUrl(list) })),
    awards: (room.awards || []).map((award) => ({
      name: award.name,
      organization: award.organization ?? null,
      year: award.year ?? null,
      url: award.awardLink ?? null
    })),
    themes: (room.themes || []).map((theme) => theme.name),
    official_url: room.officialUrl ?? null,
    blog_url: room.blogUrl ?? null,
    morty_url: room.mortyId ? `https://morty.app/attraction/${room.mortyId}` : null,
    notes: room.notes ?? null,
    commentary: room.commentary ?? null,
    rating: {
      average: rating.average ?? null,
      count: rating.count ?? 0,
      best_things: rating.bestThingsCount ?? 0
    },
    reviews: (room.experiences || []).map((experience) => ({
      player: experience.player?.name ?? null,
      rating: experience.rating ?? null,
      gameplay: experience.gameplay ?? null,
      atmosphere: experience.atmosphere ?? null,
      experience: experience.experience ?? null,
      best_thing: Boolean(experience.bestThings),
      comments: experience.comments ?? null,
      emojify: experience.emojify ?? null
    }))
  };
}

function summarize(rooms) {
  const played = playedRooms(rooms);
  const count = (status) => played.filter((room) => room.status === status).length;
  const distinct = (values) => new Set(values.filter(Boolean)).size;
  return {
    played,
    counts: {
      rooms: played.length,
      escaped: count('Escaped'),
      completed: count('Completed'),
      try_again: count('Try again'),
      countries: distinct(played.map((room) => room.location?.country)),
      companies: distinct(played.map((room) => room.company?.name)),
      players: distinct(played.flatMap((room) => (room.players || []).map((player) => player.name)))
    },
    first: played.at(-1)?.date ?? null,
    latest: played[0]?.date ?? null
  };
}

function buildRoomsExport(catalog) {
  const { played, counts, first, latest } = summarize(catalog.rooms);
  return {
    title: 'Escaping Things',
    description: 'Every escape room the Escaping Things team has played, newest first.',
    home_page_url: `${SITE_URL}/`,
    url: `${SITE_URL}/rooms.json`,
    license: 'CC BY-SA 4.0',
    updated: latestTimestamp(played.map((room) => room.modifiedAt)),
    first_room_date: first,
    latest_room_date: latest,
    notes: [
      'time_left_minutes is the time on the clock when the team finished; a negative number means the team ran over.',
      'commentary, notes and review comments are Markdown as written.',
      'Room photos are on each room page, not in this file.'
    ],
    counts,
    rooms: played.map(exportRoom)
  };
}

// llms.txt follows the llmstxt.org shape its reference parser reads: prose only above the first
// "##" heading, and under every heading nothing but "- [name](url): note" lines, one link each.
// A line without a link stops the parser; a second link on a line is dropped. The parser ends a
// name at its first "]", so brackets in a name become parentheses.
function linkName(name) {
  return String(name).replace(/\[/g, '(').replace(/\]/g, ')');
}

function plural(count, word, many = `${word}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? word : many}`;
}

function buildLlmsTxt(catalog) {
  const { played, counts, first, latest } = summarize(catalog.rooms);
  const trips = (catalog.trips || []).filter((trip) => trip.featured);
  const lists = catalog.lists || [];
  const lines = [];

  lines.push('# Escaping Things', '');
  lines.push(
    `> The log of Escaping Things, Jamie Thingelstad's family escape room team: ${plural(counts.rooms, 'room')} played from ${formatDate(first)} to ${formatDate(latest)} in ${plural(counts.countries, 'country', 'countries')}, with each room's result, the players, the trips, and the team's ratings and reviews.`,
    ''
  );
  lines.push(
    `Each room has a page at \`/room/<date>/<room-name>/\`, and the Rooms section lists every one, newest first. A room's status is Escaped (${counts.escaped}), Completed (${counts.completed}) or Try again (${counts.try_again}, time ran out). The team's own words, in room commentary and player reviews, are on the room pages and in the JSON file below.`,
    ''
  );

  lines.push('## Data', '');
  lines.push(
    `- [Every room](${SITE_URL}/rooms.json): all ${counts.rooms} rooms, newest first, with the company, place and coordinates, players, trips, lists, awards, ratings and each player's review`
  );
  lines.push(`- [JSON Feed](${SITE_URL}/feed.json): the ${DEFAULT_ENTRY_LIMIT} most recent rooms`);
  lines.push(`- [Atom feed](${SITE_URL}/feed.xml): the same ${DEFAULT_ENTRY_LIMIT} most recent rooms`);
  lines.push('');

  lines.push('## Pages', '');
  lines.push(`- [Home](${SITE_URL}/): the latest rooms and the team at a glance`);
  lines.push(
    `- [Rooms](${SITE_URL}/rooms/): every room, filtered in the URL by \`player\`, \`award\`, \`theme\`, \`trip\`, \`list\`, \`country\`, \`year\` and \`status\` (as in \`/rooms/?country=France\`)`
  );
  lines.push(`- [Map](${SITE_URL}/map/): every room on a map`);
  lines.push(`- [Stats](${SITE_URL}/stats/): charts and totals for the whole history`);
  lines.push(`- [Trips](${SITE_URL}/trips/): trips the team took rooms on, each with a route map`);
  lines.push(`- [Players](${SITE_URL}/players/): the team roster`);
  lines.push(`- [Lists](${SITE_URL}/lists/): ranked and themed lists of rooms`);
  lines.push(`- [Search](${SITE_URL}/search/): full-text search, shareable as \`/search/?q=<words>\``);
  lines.push('');

  if (trips.length > 0) {
    lines.push('## Trips', '');
    for (const trip of trips) {
      const tripRooms = played.filter((room) => (room.trips || []).some((item) => item.airtableId === trip.airtableId));
      lines.push(`- [${linkName(trip.name)}](${tripUrl(trip)}): ${plural(tripRooms.length, 'room')}`);
    }
    lines.push('');
  }

  if (lists.length > 0) {
    lines.push('## Lists', '');
    for (const list of lists) {
      const by = list.player?.name ? `: by ${list.player.name}` : '';
      lines.push(`- [${linkName(list.name)}](${listUrl(list)})${by}`);
    }
    lines.push('');
  }

  lines.push('## Rooms', '');
  for (const room of played) {
    const where = [room.company?.name, formatLocation(room.location)].filter(Boolean).join(', ');
    const place = where ? `, ${where}` : '';
    lines.push(`- [${linkName(room.game)}](${roomUrl(room)}): ${formatDate(room.date)}${place}. ${describeResult(room)}`);
  }
  lines.push('');

  lines.push('## Optional', '');
  lines.push(`- [Sitemap](${SITE_URL}/sitemap.xml): every page`);

  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildLlmsTxt,
  buildRoomsExport,
  exportRoom
};
