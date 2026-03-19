const fs = require('node:fs');

function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createEmptyAiCopyArtifact() {
  return {
    meta: {},
    home: { summary: '' },
    featured: { summary: '' },
    players: {},
    awards: {},
    trips: {},
    lists: {}
  };
}

function createEmptyAiSearchArtifact() {
  return {
    meta: {},
    rooms: {}
  };
}

function normalizeText(value, maxLength = 320) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeHint(value) {
  return normalizeText(value, 96);
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function containsGenderedPronouns(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return /\b(he|she|him|her|his|hers)\b/i.test(value);
}

function extractGenderedPronouns(value) {
  if (typeof value !== 'string' || !value.trim()) return [];

  const matches = value.toLowerCase().match(/\b(he|she|him|her|his|hers)\b/g) || [];
  return [...new Set(matches)];
}

function findDisallowedGenderedPronouns(value, allowedPronouns = []) {
  const allowed = new Set(
    Array.isArray(allowedPronouns)
      ? allowedPronouns.map((pronoun) => String(pronoun).toLowerCase())
      : []
  );

  return extractGenderedPronouns(value).filter((pronoun) => !allowed.has(pronoun));
}

function containsMarketingHype(value) {
  if (typeof value !== 'string' || !value.trim()) return false;

  return [
    /\bultimate\b/i,
    /\bepic\b/i,
    /\bbreathtaking\b/i,
    /\bunforgettable\b/i,
    /\bthrilling\b/i,
    /\bextraordinary\b/i,
    /\bcaptivating\b/i,
    /\bexcitement\b/i,
    /\bvibrant\b/i,
    /\bpicturesque\b/i,
    /\bzest\b/i,
    /\bembark\b/i,
    /\bshowcases\b/i,
    /\bcelebrating\b/i,
    /\bshines a light\b/i,
    /\btaste of\b/i,
    /\bessence of\b/i,
    /!/,
    /\bdive into\b/i,
    /\bexplore the spotlight\b/i
  ].some((pattern) => pattern.test(value));
}

function normalizeCopyEntry(value) {
  if (!value || typeof value !== 'object') return {};

  const entry = {};
  const bio = normalizeText(value.bio, 120);
  const intro = normalizeText(value.intro);
  const routeSummary = normalizeText(value.routeSummary);
  const summary = normalizeText(value.summary);

  if (bio) entry.bio = bio;
  if (intro) entry.intro = intro;
  if (routeSummary) entry.routeSummary = routeSummary;
  if (summary) entry.summary = summary;

  return entry;
}

function normalizeCopyCollection(collection, allowedFields) {
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) return {};

  return Object.fromEntries(
    Object.entries(collection)
      .map(([key, value]) => {
        const normalized = normalizeCopyEntry(value);
        const filtered = Object.fromEntries(
          Object.entries(normalized).filter(([field]) => allowedFields.includes(field))
        );
        return [key, filtered];
      })
      .filter(([, value]) => Object.keys(value).length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function normalizeAiCopyArtifact(value) {
  const base = createEmptyAiCopyArtifact();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;

  base.meta = value.meta && typeof value.meta === 'object' && !Array.isArray(value.meta)
    ? { ...value.meta }
    : {};
  base.home = normalizeCopyEntry(value.home);
  if (!base.home.summary) base.home = { summary: '' };
  base.featured = normalizeCopyEntry(value.featured);
  if (!base.featured.summary) base.featured = { summary: '' };
  base.players = normalizeCopyCollection(value.players, ['bio', 'intro']);
  base.awards = normalizeCopyCollection(value.awards, ['intro']);
  base.trips = normalizeCopyCollection(value.trips, ['intro', 'routeSummary']);
  base.lists = normalizeCopyCollection(value.lists, ['intro']);

  return base;
}

function normalizeAiSearchArtifact(value) {
  const base = createEmptyAiSearchArtifact();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;

  base.meta = value.meta && typeof value.meta === 'object' && !Array.isArray(value.meta)
    ? { ...value.meta }
    : {};

  const rooms = value.rooms && typeof value.rooms === 'object' && !Array.isArray(value.rooms)
    ? value.rooms
    : {};

  base.rooms = Object.fromEntries(
    Object.entries(rooms)
      .map(([slug, entry]) => {
        const hints = dedupeStrings(
          (Array.isArray(entry?.hints) ? entry.hints : []).map(normalizeHint)
        ).slice(0, 8);
        return [slug, { hints }];
      })
      .filter(([, entry]) => entry.hints.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  );

  return base;
}

function mergeCopyEntries(base, override) {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(override || {}).filter(([, value]) => typeof value === 'string' && value.trim())
    )
  };
}

function mergeCopyCollections(baseCollection, overrideCollection) {
  const keys = new Set([
    ...Object.keys(baseCollection || {}),
    ...Object.keys(overrideCollection || {})
  ]);

  return Object.fromEntries(
    [...keys]
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, mergeCopyEntries(baseCollection?.[key] || {}, overrideCollection?.[key] || {})])
      .filter(([, value]) => Object.keys(value).length > 0)
  );
}

function mergeAiCopyArtifacts(baseValue, overrideValue) {
  const base = normalizeAiCopyArtifact(baseValue);
  const override = normalizeAiCopyArtifact(overrideValue);

  return {
    meta: { ...base.meta, ...override.meta },
    home: mergeCopyEntries(base.home, override.home),
    featured: mergeCopyEntries(base.featured, override.featured),
    players: mergeCopyCollections(base.players, override.players),
    awards: mergeCopyCollections(base.awards, override.awards),
    trips: mergeCopyCollections(base.trips, override.trips),
    lists: mergeCopyCollections(base.lists, override.lists)
  };
}

function getRoomAiSearchHints(aiSearch, room) {
  const slug = room?.slug;
  if (!slug) return [];
  return aiSearch?.rooms?.[slug]?.hints || [];
}

function buildRoomSearchIndex(room, aiHints = []) {
  const values = [
    room.searchText,
    room.game,
    room.status,
    room.status ? `status ${room.status}` : '',
    room.date,
    room.date ? `year ${room.date.slice(0, 4)}` : '',
    room.company?.name,
    room.company?.name ? `company ${room.company.name}` : '',
    room.location?.label,
    room.location?.label ? `location ${room.location.label}` : '',
    room.location?.city,
    room.location?.city ? `city ${room.location.city}` : '',
    room.location?.region,
    room.location?.region ? `region ${room.location.region}` : '',
    room.location?.country,
    room.location?.country ? `country ${room.location.country}` : '',
    ...room.players.flatMap((player) => [player.name, `player ${player.name}`]),
    ...room.awards.flatMap((award) => [award.name, `award ${award.name}`]),
    ...room.trips.flatMap((trip) => [trip.name, `trip ${trip.name}`]),
    ...room.lists.flatMap((list) => [list.name, `list ${list.name}`]),
    ...room.themes.flatMap((theme) => [theme.name, `theme ${theme.name}`]),
    ...aiHints
  ];

  return dedupeStrings(values.map((item) => (typeof item === 'string' ? item.trim() : ''))).join(' ');
}

module.exports = {
  buildRoomSearchIndex,
  containsGenderedPronouns,
  containsMarketingHype,
  createEmptyAiCopyArtifact,
  createEmptyAiSearchArtifact,
  extractGenderedPronouns,
  findDisallowedGenderedPronouns,
  getRoomAiSearchHints,
  mergeAiCopyArtifacts,
  normalizeAiCopyArtifact,
  normalizeAiSearchArtifact,
  readJsonFile,
  writeJsonFile
};
