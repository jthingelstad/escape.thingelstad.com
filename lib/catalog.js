const fs = require('fs');
const path = require('path');

const PUBLIC_STATUSES = new Set(['Escaped', 'Try again', 'Completed', 'Scheduled']);

function snapshotRecords(snapshot) {
  if (!snapshot) return [];
  return Array.isArray(snapshot.records) ? snapshot.records : [];
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_-]+/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeUniqueSlug(type, value, airtableId, registry) {
  const base = slugify(value) || airtableId.toLowerCase();
  let slug = base;
  let counter = 2;

  while (registry.has(`${type}:${slug}`)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  registry.add(`${type}:${slug}`);
  return slug;
}

function makePublicSlug(type, record, value, registry, overrides = {}) {
  const explicit = overrides[type]?.[record.id] || record.fields?.['Public Slug'];
  return makeUniqueSlug(type, explicit || value, record.id, registry);
}

function roomSlug(date, game, airtableId = null, hasCollision = false) {
  const gameSlug = slugify(game) || 'room';
  const collisionSuffix = hasCollision && airtableId ? `-${slugify(airtableId)}` : '';
  return `${date}/${gameSlug}${collisionSuffix}`;
}

function roomLegacySlug(id, game) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return `${id}-${slugify(game)}`;
}

function listSlug(id, name) {
  const base = id != null ? `${id} ${name}` : name;
  return slugify(base);
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function resolveRoomId(fields) {
  const value = fields.get('Room ID');
  return typeof value === 'boolean' ? null : toNumber(value);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateVisibleRoomRecords(records, lookups) {
  const roomIds = new Map();
  const roomsByDate = new Map();

  records.forEach((record) => {
    const fields = record.fields;
    const label = fields.get('Game') || record.airtableId;
    const rawRoomId = fields.get('Room ID');
    const roomId = resolveRoomId(fields);

    if (rawRoomId != null && rawRoomId !== '' && (!Number.isSafeInteger(roomId) || roomId <= 0)) {
      throw new Error(`Room ${record.airtableId} (${label}) has an invalid legacy Room ID.`);
    }
    if (roomId != null) {
      if (roomIds.has(roomId)) {
        throw new Error(
          `Legacy Room ID ${roomId} is duplicated by ${record.airtableId} (${label}) and ${roomIds.get(roomId)}.`
        );
      }
      roomIds.set(roomId, record.airtableId);
    }

    if (!String(fields.get('Game') || '').trim()) {
      throw new Error(`Room ${record.airtableId} (#${roomId}) must have a Game name.`);
    }
    if (!isValidIsoDate(fields.get('When'))) {
      throw new Error(`Room ${record.airtableId} (#${roomId} ${label}) must have a valid When date.`);
    }
    const date = fields.get('When');
    roomsByDate.set(date, [...(roomsByDate.get(date) || []), record]);
    if (!PUBLIC_STATUSES.has(fields.get('Status'))) {
      throw new Error(
        `Room ${record.airtableId} (#${roomId} ${label}) has unsupported Status ${JSON.stringify(fields.get('Status'))}.`
      );
    }

    const locationIds = linkedIds(fields.get('Location'));
    if (locationIds.length !== 1 || !lookups.locations[locationIds[0]]) {
      throw new Error(`Room ${record.airtableId} (#${roomId} ${label}) must link to exactly one valid Location.`);
    }
    const location = lookups.locations[locationIds[0]];
    if (!location.company?.airtableId || !lookups.companies[location.company.airtableId]) {
      throw new Error(`Room ${record.airtableId} (#${roomId} ${label}) must resolve to a valid Company.`);
    }

    const optionalLinks = [
      ['Players', lookups.players],
      ['Awards', lookups.awards],
      ['Trips', lookups.trips],
      ['Themes', lookups.themes]
    ];
    optionalLinks.forEach(([fieldName, lookup]) => {
      const missingId = linkedIds(fields.get(fieldName)).find((airtableId) => !lookup[airtableId]);
      if (missingId) {
        throw new Error(
          `Room ${record.airtableId} (#${roomId} ${label}) links to missing ${fieldName} record ${missingId}.`
        );
      }
    });
  });

  roomsByDate.forEach((sameDayRooms, date) => {
    if (sameDayRooms.length < 2) return;
    const orders = new Map();
    sameDayRooms.forEach((record) => {
      const order = toNumber(record.fields.get('Order'));
      const label = record.fields.get('Game') || record.airtableId;
      if (!Number.isSafeInteger(order) || order <= 0) {
        throw new Error(
          `Room ${record.airtableId} (${label}) must have a positive integer Order because ${date} has multiple rooms.`
        );
      }
      if (orders.has(order)) {
        throw new Error(`Room Order ${order} is duplicated on ${date} by ${record.airtableId} and ${orders.get(order)}.`);
      }
      orders.set(order, record.airtableId);
    });
  });
}

function parseCoordinates(value) {
  if (!value) return { lat: null, lng: null };
  const parts = String(value).split(',').map((part) => part.trim());
  if (parts.length !== 2) return { lat: null, lng: null };
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: null, lng: null };
  }
  return { lat, lng };
}

const emojiSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function cleanEmojify(raw, limit = 5) {
  if (!raw) return null;
  const counts = {};
  for (const { segment } of emojiSegmenter.segment(raw)) {
    if (/\p{Emoji_Presentation}/u.test(segment)) {
      counts[segment] = (counts[segment] || 0) + 1;
    }
  }
  const result = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ch]) => ch)
    .join('');
  return result || null;
}

function getFirstLinkedId(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function linkedIds(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function resolveOfficialUrl(roomFields, location, company) {
  return roomFields.get('Room URL') || location?.locationUrl || company?.companyUrl || null;
}

function resolvePhotoFilename(roomRecord, imagesDir) {
  const fields = roomRecord.fields;
  const airtableId = roomRecord.airtableId || roomRecord.id;
  const attachments = fields.get('Team Photo');
  if (Array.isArray(attachments) && attachments.length > 0) {
    const filename = attachments[0]?.filename || 'photo.jpg';
    const ext = path.extname(filename) || '.jpg';
    const localName = `team_${airtableId}${ext}`;
    if (fs.existsSync(path.join(imagesDir, localName))) {
      return localName;
    }
  }

  return null;
}

function buildEntityRef(entity, extra = {}) {
  if (!entity) return null;
  return {
    airtableId: entity.airtableId,
    slug: entity.slug,
    name: entity.name,
    ...extra
  };
}

function buildLocationRef(location) {
  if (!location) return null;
  return {
    airtableId: location.airtableId,
    slug: location.slug,
    label: location.label,
    city: location.city,
    region: location.region,
    country: location.country,
    lat: location.lat,
    lng: location.lng
  };
}

function buildCompanyRef(company) {
  if (!company) return null;
  return {
    airtableId: company.airtableId,
    slug: company.slug,
    name: company.name
  };
}

function buildListRef(list, extra = {}) {
  if (!list) return null;
  return {
    airtableId: list.airtableId,
    id: list.id,
    slug: list.slug,
    name: list.name,
    ...extra
  };
}

function createLookupHelpers(items) {
  const byId = {};
  const bySlug = {};

  items.forEach((item) => {
    byId[item.airtableId] = item;
    bySlug[item.slug] = item;
  });

  return { byId, bySlug };
}

function buildCatalog(rawData, options = {}) {
  const imagesDir = options.imagesDir || path.join(process.cwd(), 'src', 'images', 'rooms');
  const publicSlugs = options.publicSlugs || {};
  const slugRegistry = new Set();

  const rawCompanies = snapshotRecords(rawData.companies);
  const rawLocations = snapshotRecords(rawData.locations);
  const rawThemes = snapshotRecords(rawData.themes);
  const rawPlayers = snapshotRecords(rawData.players);
  const rawAwards = snapshotRecords(rawData.awards);
  const rawTrips = snapshotRecords(rawData.trips);
  const rawLists = snapshotRecords(rawData.lists);
  const rawListItems = snapshotRecords(rawData.listItems);
  const rawRooms = snapshotRecords(rawData.rooms);
  const rawExperiences = snapshotRecords(rawData.experiences);

  const hiddenRoomIds = new Set(
    rawRooms
      .filter((record) => Boolean(record.fields?.Hide))
      .map((record) => record.id)
  );

  const companies = rawCompanies.map((record) => ({
    airtableId: record.id,
    slug: makeUniqueSlug('company', record.fields?.Company, record.id, slugRegistry),
    name: record.fields?.Company || 'Unknown Company',
    companyUrl: record.fields?.['Company URL'] || null,
    roomIds: [],
    locationIds: []
  }));
  const companiesLookup = createLookupHelpers(companies);

  const locations = rawLocations.map((record) => {
    const coords = parseCoordinates(record.fields?.Coordinates);
    const company = companiesLookup.byId[getFirstLinkedId(record.fields?.Company)] || null;
    const label = record.fields?.Location || [
      record.fields?.City,
      record.fields?.Region,
      record.fields?.Country
    ].filter(Boolean).join(', ');

    const location = {
      airtableId: record.id,
      slug: makeUniqueSlug('location', label || record.id, record.id, slugRegistry),
      label,
      city: record.fields?.City || null,
      region: record.fields?.Region || null,
      country: record.fields?.Country || null,
      lat: coords.lat,
      lng: coords.lng,
      locationUrl: record.fields?.['Location URL'] || null,
      company: buildCompanyRef(company),
      roomIds: []
    };

    if (company) company.locationIds.push(location.airtableId);
    return location;
  });
  const locationsLookup = createLookupHelpers(locations);

  const themes = rawThemes.map((record) => ({
    airtableId: record.id,
    slug: makeUniqueSlug('theme', record.fields?.Name, record.id, slugRegistry),
    name: record.fields?.Name || 'Unknown Theme',
    roomIds: []
  }));
  const themesLookup = createLookupHelpers(themes);

  const players = rawPlayers.map((record) => ({
    airtableId: record.id,
    slug: makePublicSlug('players', record, record.fields?.Name, slugRegistry, publicSlugs),
    name: record.fields?.Name || 'Unknown Player',
    bio: record.fields?.Bio || null,
    featured: Boolean(record.fields?.Featured),
    roomIds: [],
    experienceIds: [],
    listIds: []
  }));
  const playersLookup = createLookupHelpers(players);

  const awards = rawAwards.map((record) => {
    return {
      airtableId: record.id,
      slug: makeUniqueSlug('award', record.fields?.Name, record.id, slugRegistry),
      name: record.fields?.Name || 'Unknown Award',
      organization: record.fields?.Organization || null,
      year: record.fields?.Year || null,
      awardName: record.fields?.['Award Name'] || null,
      awardLink: record.fields?.['Award Link'] || null,
      roomIds: []
    };
  });
  const awardsLookup = createLookupHelpers(awards);

  const trips = rawTrips.map((record) => ({
    airtableId: record.id,
    slug: makePublicSlug('trips', record, record.fields?.Name, slugRegistry, publicSlugs),
    name: record.fields?.Name || 'Unknown Trip',
    featured: Boolean(record.fields?.Featured),
    roomIds: [],
    listIds: []
  }));
  const tripsLookup = createLookupHelpers(trips);

  const lists = rawLists.map((record) => {
    const player = playersLookup.byId[getFirstLinkedId(record.fields?.Player)] || null;
    const trip = tripsLookup.byId[getFirstLinkedId(record.fields?.Trip)] || null;
    const listId = toNumber(record.fields?.['List ID']);

    const list = {
      airtableId: record.id,
      id: listId,
      slug: makeUniqueSlug('list', listSlug(listId, record.fields?.Name || record.id), record.id, slugRegistry),
      name: record.fields?.Name || 'Untitled List',
      notes: record.fields?.Notes || null,
      player: buildEntityRef(player, { featured: player?.featured }),
      trip: buildEntityRef(trip, { featured: trip?.featured }),
      roomIds: [],
      listItemIds: []
    };

    if (player) player.listIds.push(list.airtableId);
    if (trip) trip.listIds.push(list.airtableId);

    return list;
  });
  const listsLookup = createLookupHelpers(lists);

  const visibleRoomRecords = rawRooms
    .map((record, index) => ({
      airtableId: record.id,
      fields: new Map(Object.entries(record.fields || {})),
      sourceIndex: index
    }))
    .filter((record) => !record.fields.get('Hide'))
    .sort((left, right) => {
      const leftDate = left.fields.get('When') || '9999-99-99';
      const rightDate = right.fields.get('When') || '9999-99-99';
      if (leftDate < rightDate) return -1;
      if (leftDate > rightDate) return 1;

      const leftOrder = toNumber(left.fields.get('Order'));
      const rightOrder = toNumber(right.fields.get('Order'));
      const safeLeftOrder = leftOrder == null ? Number.POSITIVE_INFINITY : leftOrder;
      const safeRightOrder = rightOrder == null ? Number.POSITIVE_INFINITY : rightOrder;
      if (safeLeftOrder < safeRightOrder) return -1;
      if (safeLeftOrder > safeRightOrder) return 1;

      return left.sourceIndex - right.sourceIndex;
    });

  validateVisibleRoomRecords(visibleRoomRecords, {
    companies: companiesLookup.byId,
    locations: locationsLookup.byId,
    players: playersLookup.byId,
    awards: awardsLookup.byId,
    trips: tripsLookup.byId,
    themes: themesLookup.byId
  });

  const roomSlugCounts = new Map();
  visibleRoomRecords.forEach((record) => {
    const baseSlug = roomSlug(record.fields.get('When'), record.fields.get('Game'));
    roomSlugCounts.set(baseSlug, (roomSlugCounts.get(baseSlug) || 0) + 1);
  });

  const roomIdByAirtableId = {};
  visibleRoomRecords.forEach((record) => {
    roomIdByAirtableId[record.airtableId] = resolveRoomId(record.fields);
  });

  const listItems = [];
  const listItemsByRoom = {};
  const listItemsByList = {};
  rawListItems.forEach((record) => {
    const fields = new Map(Object.entries(record.fields || {}));
    const listAirtableId = getFirstLinkedId(fields.get('List'));
    const roomAirtableId = getFirstLinkedId(fields.get('Room'));
    if (!listAirtableId || !roomAirtableId || hiddenRoomIds.has(roomAirtableId)) return;

    const list = listsLookup.byId[listAirtableId];
    if (!list) return;

    const item = {
      airtableId: record.id,
      id: toNumber(fields.get('List Item ID')),
      order: toNumber(fields.get('Order')),
      notes: fields.get('Notes') || null,
      listAirtableId,
      roomAirtableId,
      roomId: roomIdByAirtableId[roomAirtableId] || null
    };

    listItems.push(item);
    list.listItemIds.push(item.airtableId);
    if (!list.roomIds.includes(roomAirtableId)) {
      list.roomIds.push(roomAirtableId);
    }
    listItemsByRoom[roomAirtableId] ||= [];
    listItemsByRoom[roomAirtableId].push(item);
    listItemsByList[listAirtableId] ||= [];
    listItemsByList[listAirtableId].push(item);
  });

  const compareListItems = (left, right) => {
    const safeLeft = left.order == null ? Number.POSITIVE_INFINITY : left.order;
    const safeRight = right.order == null ? Number.POSITIVE_INFINITY : right.order;
    if (safeLeft < safeRight) return -1;
    if (safeLeft > safeRight) return 1;
    return left.airtableId.localeCompare(right.airtableId);
  };

  listItems.sort(compareListItems);
  Object.values(listItemsByRoom).forEach((items) => items.sort(compareListItems));
  Object.values(listItemsByList).forEach((items) => items.sort(compareListItems));

  const experiences = [];
  const experiencesByRoom = {};
  rawExperiences.forEach((record) => {
    const fields = new Map(Object.entries(record.fields || {}));
    const roomAirtableId = getFirstLinkedId(fields.get('Room'));
    const playerAirtableId = getFirstLinkedId(fields.get('Player'));
    if (!roomAirtableId || hiddenRoomIds.has(roomAirtableId)) return;

    const player = playersLookup.byId[playerAirtableId];
    if (!player) return;

    const experience = {
      airtableId: record.id,
      roomAirtableId,
      roomId: roomIdByAirtableId[roomAirtableId] || null,
      player: buildEntityRef(player, { featured: player.featured }),
      rating: toNumber(fields.get('Rating')),
      gameplay: fields.get('Gameplay') || null,
      atmosphere: fields.get('Atmosphere') || null,
      experience: fields.get('Experience') || null,
      bestThings: Boolean(fields.get('Best Things')),
      comments: fields.get('Comments') || null,
      emojify: fields.get('Emojify') || null,
      reviewed: Boolean(fields.get('Reviewed')),
      createdAt: fields.get('Created at') || null,
      modifiedAt: fields.get('Modified at') || null
    };

    experiences.push(experience);
    player.experienceIds.push(experience.airtableId);
    experiencesByRoom[roomAirtableId] ||= [];
    experiencesByRoom[roomAirtableId].push(experience);
  });

  experiences.sort((left, right) => {
    const leftStamp = left.modifiedAt || left.createdAt || '';
    const rightStamp = right.modifiedAt || right.createdAt || '';
    if (leftStamp < rightStamp) return -1;
    if (leftStamp > rightStamp) return 1;
    return left.player.name.localeCompare(right.player.name);
  });

  const rooms = visibleRoomRecords.map((record, index) => {
    const fields = record.fields;
    const roomId = resolveRoomId(fields);
    const game = fields.get('Game');
    const date = fields.get('When') || null;
    const baseSlug = roomSlug(date, game);
    const location = locationsLookup.byId[getFirstLinkedId(fields.get('Location'))] || null;
    const company = location ? companiesLookup.byId[location.company?.airtableId] : null;

    const roomPlayers = linkedIds(fields.get('Players'))
      .map((airtableId) => playersLookup.byId[airtableId])
      .filter(Boolean);
    const roomAwards = linkedIds(fields.get('Awards'))
      .map((airtableId) => awardsLookup.byId[airtableId])
      .filter(Boolean);
    const roomTrips = linkedIds(fields.get('Trips'))
      .map((airtableId) => tripsLookup.byId[airtableId])
      .filter(Boolean);
    const roomThemes = linkedIds(fields.get('Themes'))
      .map((airtableId) => themesLookup.byId[airtableId])
      .filter(Boolean);
    const roomListItems = [...(listItemsByRoom[record.airtableId] || [])];
    const roomLists = roomListItems
      .map((item) => listsLookup.byId[item.listAirtableId])
      .filter(Boolean);

    const roomExperiences = [...(experiencesByRoom[record.airtableId] || [])].sort((left, right) => {
      const leftStamp = left.modifiedAt || left.createdAt || '';
      const rightStamp = right.modifiedAt || right.createdAt || '';
      if (leftStamp < rightStamp) return -1;
      if (leftStamp > rightStamp) return 1;
      return left.player.name.localeCompare(right.player.name);
    });

    const numericRatings = roomExperiences
      .map((entry) => entry.rating)
      .filter((value) => value != null);

    const room = {
      id: roomId,
      legacyId: roomId,
      number: index + 1,
      airtableId: record.airtableId,
      slug: roomSlug(date, game, record.airtableId, roomSlugCounts.get(baseSlug) > 1),
      legacySlug: roomLegacySlug(roomId, game),
      game,
      date,
      status: fields.get('Status'),
      timeLeft: toNumber(fields.get('Time Left')),
      officialUrl: resolveOfficialUrl(fields, location, company),
      blogUrl: fields.get('thingelstad.com URL') || null,
      mortyId: fields.get('Morty ID') || null,
      photo: resolvePhotoFilename(record, imagesDir),
      notes: fields.get('Notes') || null,
      commentary: fields.get('Commentary') || null,
      company: buildCompanyRef(company),
      location: buildLocationRef(location),
      players: roomPlayers.map((player) => buildEntityRef(player, { featured: player.featured })),
      awards: roomAwards.map((award) => buildEntityRef(award, {
        organization: award.organization,
        year: award.year,
        awardLink: award.awardLink
      })),
      trips: roomTrips.map((trip) => buildEntityRef(trip, { featured: trip.featured })),
      lists: roomLists.map((list) => buildListRef(list, {
        player: list.player,
        trip: list.trip
      })),
      themes: roomThemes.map((theme) => buildEntityRef(theme)),
      experiences: roomExperiences,
      emojify: cleanEmojify(fields.get('Emojify')),
      ratingSummary: {
        count: roomExperiences.length,
        average: numericRatings.length
          ? Number((numericRatings.reduce((sum, value) => sum + value, 0) / numericRatings.length).toFixed(1))
          : null,
        bestThingsCount: roomExperiences.filter((entry) => entry.bestThings).length
      },
      searchText: [
        game,
        company?.name,
        location?.city,
        location?.region,
        location?.country,
        fields.get('Notes'),
        fields.get('Commentary'),
        roomPlayers.map((player) => player.name).join(' '),
        roomAwards.map((award) => award.name).join(' '),
        roomTrips.map((trip) => trip.name).join(' '),
        roomLists.map((list) => list.name).join(' '),
        roomThemes.map((theme) => theme.name).join(' ')
      ].filter(Boolean).join(' ')
    };

    if (company) company.roomIds.push(room.airtableId);
    if (location) location.roomIds.push(room.airtableId);
    roomPlayers.forEach((player) => player.roomIds.push(room.airtableId));
    roomAwards.forEach((award) => award.roomIds.push(room.airtableId));
    roomTrips.forEach((trip) => trip.roomIds.push(room.airtableId));
    roomThemes.forEach((theme) => theme.roomIds.push(room.airtableId));

    return room;
  });

  const roomsLookup = {
    byAirtableId: {},
    bySlug: {},
    byId: {},
    byNumber: {}
  };
  rooms.forEach((room) => {
    roomsLookup.byAirtableId[room.airtableId] = room;
    if (roomsLookup.bySlug[room.slug]) {
      throw new Error(`Canonical room slug ${room.slug} is duplicated.`);
    }
    roomsLookup.bySlug[room.slug] = room;
    if (room.id != null) roomsLookup.byId[room.id] = room;
    roomsLookup.byNumber[room.number] = room;
  });

  const finalizeCounts = (items) => items.map((item) => ({
    ...item,
    roomIds: [...item.roomIds],
    roomCount: item.roomIds.length
  }));

  const finalizedCompanies = finalizeCounts(companies).map((company) => ({
    ...company,
    locationIds: [...company.locationIds],
    locationCount: company.locationIds.length
  })).sort((left, right) => left.name.localeCompare(right.name));
  const finalizedLocations = finalizeCounts(locations).sort((left, right) => left.label.localeCompare(right.label));
  const finalizedThemes = finalizeCounts(themes).sort((left, right) => left.name.localeCompare(right.name));
  const finalizedPlayers = players
    .map((player) => {
      const roomIds = [...player.roomIds];
      const playedRoomIds = roomIds.filter(
        (roomId) => roomsLookup.byAirtableId[roomId]?.status !== 'Scheduled'
      );

      return {
        ...player,
        roomIds,
        playedRoomIds,
        roomCount: playedRoomIds.length,
        experienceIds: [...player.experienceIds],
        experienceCount: player.experienceIds.length
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const finalizedAwards = finalizeCounts(awards).sort((left, right) => left.name.localeCompare(right.name));
  const finalizedTrips = finalizeCounts(trips).sort((left, right) => left.name.localeCompare(right.name));
  const finalizedLists = finalizeCounts(lists)
    .map((list) => {
      const orderedItems = [...(listItemsByList[list.airtableId] || [])];
      return {
        ...list,
        roomIds: orderedItems.map((item) => item.roomAirtableId),
        listItemIds: orderedItems.map((item) => item.airtableId),
        itemCount: orderedItems.length
      };
    })
    .sort((left, right) => {
      const safeLeft = left.id == null ? Number.POSITIVE_INFINITY : left.id;
      const safeRight = right.id == null ? Number.POSITIVE_INFINITY : right.id;
      if (safeLeft < safeRight) return -1;
      if (safeLeft > safeRight) return 1;
      return left.name.localeCompare(right.name);
    });

  const lookups = {
    rooms: roomsLookup,
    companies: createLookupHelpers(finalizedCompanies),
    locations: createLookupHelpers(finalizedLocations),
    themes: createLookupHelpers(finalizedThemes),
    players: createLookupHelpers(finalizedPlayers),
    awards: createLookupHelpers(finalizedAwards),
    trips: createLookupHelpers(finalizedTrips),
    lists: createLookupHelpers(finalizedLists),
    listItems: {
      byId: Object.fromEntries(listItems.map((item) => [item.airtableId, item]))
    },
    experiences: {
      byId: Object.fromEntries(experiences.map((experience) => [experience.airtableId, experience]))
    }
  };

  const featured = {
    players: finalizedPlayers.filter((player) => player.featured),
    trips: finalizedTrips.filter((trip) => trip.featured)
  };

  return {
    rooms,
    companies: finalizedCompanies,
    locations: finalizedLocations,
    themes: finalizedThemes,
    players: finalizedPlayers,
    awards: finalizedAwards,
    trips: finalizedTrips,
    lists: finalizedLists,
    listItems,
    experiences,
    featured,
    lookups
  };
}

module.exports = {
  buildCatalog,
  roomLegacySlug,
  roomSlug,
  slugify
};
