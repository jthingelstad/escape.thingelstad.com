#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../src/_data/catalog');
const stats = require('../src/_data/stats');
const buildPlayerPages = require('../src/_data/playerPages');
const buildAwardPages = require('../src/_data/awardPages');
const buildTripPages = require('../src/_data/tripPages');
const buildListPages = require('../src/_data/listPages');
const {
  containsMarketingHype,
  createEmptyAiCopyArtifact,
  createEmptyAiSearchArtifact,
  extractGenderedPronouns,
  findDisallowedGenderedPronouns,
  normalizeAiCopyArtifact,
  normalizeAiSearchArtifact,
  writeJsonFile
} = require('../lib/aiArtifacts');

const ROOT_DIR = path.join(__dirname, '..');
const GENERATED_DIR = path.join(ROOT_DIR, 'src', '_generated');
const COPY_PATH = path.join(GENERATED_DIR, 'ai-copy.json');
const SEARCH_PATH = path.join(GENERATED_DIR, 'ai-search.json');
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ROOM_BATCH_SIZE = 20;

function loadDotEnv(filePath = path.join(ROOT_DIR, '.env')) {
  if (!fs.existsSync(filePath)) return;

  const source = fs.readFileSync(filePath, 'utf8');
  source.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function uniqueLabels(values) {
  return [...new Set(values.filter(Boolean))];
}

function compactText(value) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : null;
}

function buildHomeContext(siteCatalog, siteStats) {
  return {
    totalRooms: siteStats.totalRooms,
    scheduledRooms: siteStats.scheduledRooms,
    totalWins: siteStats.totalWins,
    winRate: siteStats.winRate,
    countryCount: siteStats.countryCount,
    regionCount: siteStats.regionCount,
    yearsActive: siteStats.yearsActive,
    firstYear: siteStats.firstYear,
    lastYear: siteStats.lastYear,
    topPlayer: siteStats.topPlayer?.label || null,
    topTheme: siteStats.topTheme?.label || null,
    featuredTrips: siteCatalog.featured.trips.map((trip) => trip.name),
    featuredAwards: siteCatalog.featured.awards.map((award) => award.name),
    featuredPlayers: siteCatalog.featured.players.map((player) => player.name)
  };
}

function buildFeaturedContext(siteCatalog) {
  return {
    featuredTripCount: siteCatalog.featured.trips.length,
    featuredAwardCount: siteCatalog.featured.awards.length,
    featuredPlayerCount: siteCatalog.featured.players.length,
    tripNames: siteCatalog.featured.trips.map((trip) => trip.name),
    awardNames: siteCatalog.featured.awards.map((award) => award.name),
    playerNames: siteCatalog.featured.players.map((player) => player.name)
  };
}

function buildEditorialPromptData() {
  const siteCatalog = catalog();
  const siteStats = stats();

  return {
    home: buildHomeContext(siteCatalog, siteStats),
    featured: buildFeaturedContext(siteCatalog),
    players: buildPlayerPages().map((player) => ({
      slug: player.slug,
      name: player.name,
      bio: compactText(player.bio),
      roomCount: player.roomCount,
      wins: player.wins,
      winRate: player.winRate,
      firstDate: player.firstDate,
      lastDate: player.lastDate,
      recentRooms: (player.recentRooms || player.rooms || []).slice(0, 6).map((room) => room.game),
      lists: player.lists.map((list) => list.name)
    })),
    awards: buildAwardPages().map((award) => ({
      slug: award.slug,
      name: award.name,
      roomCount: award.roomCount,
      countries: award.countries,
      notes: award.notes || null,
      recentRooms: award.recentRooms.map((room) => room.game)
    })),
    trips: buildTripPages().map((trip) => ({
      slug: trip.slug,
      name: trip.name,
      roomCount: trip.roomCount,
      countries: trip.countries,
      cities: trip.cities,
      firstDate: trip.firstDate,
      lastDate: trip.lastDate,
      route: trip.routeStops.map((stop) => ({
        sequence: stop.sequence,
        game: stop.room.game,
        city: stop.room.location?.city || null,
        country: stop.room.location?.country || null
      })),
      lists: trip.lists.map((list) => list.name)
    })),
    lists: buildListPages().map((list) => ({
      slug: list.slug,
      name: list.name,
      roomCount: list.roomCount,
      countries: list.countries,
      player: list.player?.name || null,
      playerBio: compactText(list.player?.bio || null),
      trip: list.trip?.name || null,
      notes: list.notes || null,
      rooms: list.rooms.slice(0, 8).map((room) => ({
        game: room.game,
        city: room.location?.city || null,
        country: room.location?.country || null
      }))
    }))
  };
}

function buildRoomSearchPromptData() {
  return catalog().rooms.map((room) => ({
    slug: room.slug,
    id: room.id,
    game: room.game,
    status: room.status,
    year: room.date ? room.date.slice(0, 4) : null,
    company: room.company?.name || null,
    location: room.location?.label || null,
    city: room.location?.city || null,
    region: room.location?.region || null,
    country: room.location?.country || null,
    players: room.players.map((player) => player.name),
    awards: room.awards.map((award) => award.name),
    trips: room.trips.map((trip) => trip.name),
    lists: room.lists.map((list) => list.name),
    themes: room.themes.map((theme) => theme.name)
  }));
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === 'string' && responseJson.output_text.trim()) {
    return responseJson.output_text;
  }

  const outputs = Array.isArray(responseJson.output) ? responseJson.output : [];
  const textParts = [];
  outputs.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        textParts.push(part.text);
      }
    });
  });

  return textParts.join('\n').trim();
}

async function requestStructuredOutput({
  apiKey,
  model,
  schemaName,
  schema,
  systemPrompt,
  userPrompt,
  maxOutputTokens = 5000,
  requestFn
}) {
  if (requestFn) {
    return requestFn({ schemaName, schema, systemPrompt, userPrompt, model, maxOutputTokens });
  }

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable in this Node runtime.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: maxOutputTokens,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  const responseJson = await response.json();
  if (!response.ok) {
    const message = responseJson?.error?.message || `OpenAI API request failed with status ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractOutputText(responseJson);
  if (!outputText) {
    throw new Error(`OpenAI response for ${schemaName} did not include structured output text.`);
  }

  return JSON.parse(outputText);
}

function buildEditorialSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['home', 'featured', 'players', 'awards', 'trips', 'lists'],
    properties: {
      home: {
        type: 'object',
        additionalProperties: false,
        required: ['summary'],
        properties: {
          summary: { type: 'string' }
        }
      },
      featured: {
        type: 'object',
        additionalProperties: false,
        required: ['summary'],
        properties: {
          summary: { type: 'string' }
        }
      },
      players: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'intro'],
          properties: {
            slug: { type: 'string' },
            intro: { type: 'string' }
          }
        }
      },
      awards: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'intro'],
          properties: {
            slug: { type: 'string' },
            intro: { type: 'string' }
          }
        }
      },
      trips: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'intro', 'routeSummary'],
          properties: {
            slug: { type: 'string' },
            intro: { type: 'string' },
            routeSummary: { type: 'string' }
          }
        }
      },
      lists: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'intro'],
          properties: {
            slug: { type: 'string' },
            intro: { type: 'string' }
          }
        }
      }
    }
  };
}

function buildRoomSearchSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['rooms'],
    properties: {
      rooms: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'hints'],
          properties: {
            slug: { type: 'string' },
            hints: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  };
}

function toSlugMap(items, fields) {
  return Object.fromEntries(
    items
      .map((item) => [
        item.slug,
        Object.fromEntries(fields.map((field) => [field, item[field]]))
      ])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function assertExactSlugCoverage(items, expectedSlugs, label) {
  const seen = items.map((item) => item.slug);
  const duplicates = seen.filter((slug, index) => seen.indexOf(slug) !== index);
  const missing = expectedSlugs.filter((slug) => !seen.includes(slug));
  const extra = seen.filter((slug) => !expectedSlugs.includes(slug));

  if (duplicates.length || missing.length || extra.length) {
    throw new Error(
      `${label} output did not match expected slugs.`
      + (duplicates.length ? ` Duplicates: ${uniqueLabels(duplicates).join(', ')}.` : '')
      + (missing.length ? ` Missing: ${missing.join(', ')}.` : '')
      + (extra.length ? ` Extra: ${extra.join(', ')}.` : '')
    );
  }
}

function getAllowedPronounsFromBio(value) {
  const detected = new Set(extractGenderedPronouns(value));
  const allowed = new Set();

  if (detected.has('he') || detected.has('him') || detected.has('his')) {
    ['he', 'him', 'his'].forEach((pronoun) => allowed.add(pronoun));
  }

  if (detected.has('she') || detected.has('her') || detected.has('hers')) {
    ['she', 'her', 'hers'].forEach((pronoun) => allowed.add(pronoun));
  }

  return [...allowed];
}

function assertNoDisallowedGenderedPronounsInCopy(artifact, promptData) {
  const offenders = [];
  const playersBySlug = Object.fromEntries((promptData.players || []).map((player) => [player.slug, player]));
  const listsBySlug = Object.fromEntries((promptData.lists || []).map((list) => [list.slug, list]));

  const checkEntry = (label, value, allowedPronouns = []) => {
    const disallowed = findDisallowedGenderedPronouns(value, allowedPronouns);
    if (disallowed.length) offenders.push(`${label} (${disallowed.join(', ')})`);
  };

  checkEntry('home.summary', artifact.home?.summary);
  checkEntry('featured.summary', artifact.featured?.summary);

  Object.entries(artifact.players || {}).forEach(([slug, entry]) => {
    checkEntry(
      `players.${slug}.intro`,
      entry.intro,
      getAllowedPronounsFromBio(playersBySlug[slug]?.bio)
    );
  });
  Object.entries(artifact.awards || {}).forEach(([slug, entry]) => {
    checkEntry(`awards.${slug}.intro`, entry.intro);
  });
  Object.entries(artifact.trips || {}).forEach(([slug, entry]) => {
    checkEntry(`trips.${slug}.intro`, entry.intro);
    checkEntry(`trips.${slug}.routeSummary`, entry.routeSummary);
  });
  Object.entries(artifact.lists || {}).forEach(([slug, entry]) => {
    checkEntry(
      `lists.${slug}.intro`,
      entry.intro,
      getAllowedPronounsFromBio(listsBySlug[slug]?.playerBio)
    );
  });

  if (offenders.length) {
    throw new Error(
      `Generated copy used unsupported gendered pronouns in: ${offenders.join(', ')}. `
      + 'Only use gendered pronouns when they are explicitly supported by the supplied Airtable bio.'
    );
  }
}

function assertNoMarketingHypeInCopy(artifact) {
  const offenders = [];

  const checkEntry = (label, value) => {
    if (containsMarketingHype(value)) offenders.push(label);
  };

  checkEntry('home.summary', artifact.home?.summary);
  checkEntry('featured.summary', artifact.featured?.summary);

  Object.entries(artifact.players || {}).forEach(([slug, entry]) => {
    checkEntry(`players.${slug}.intro`, entry.intro);
  });
  Object.entries(artifact.awards || {}).forEach(([slug, entry]) => {
    checkEntry(`awards.${slug}.intro`, entry.intro);
  });
  Object.entries(artifact.trips || {}).forEach(([slug, entry]) => {
    checkEntry(`trips.${slug}.intro`, entry.intro);
    checkEntry(`trips.${slug}.routeSummary`, entry.routeSummary);
  });
  Object.entries(artifact.lists || {}).forEach(([slug, entry]) => {
    checkEntry(`lists.${slug}.intro`, entry.intro);
  });

  if (offenders.length) {
    throw new Error(
      `Generated copy drifted into marketing or hype language in: ${offenders.join(', ')}. `
      + 'Rewrite in an enthusiast voice, not ad copy.'
    );
  }
}

function validateEditorialArtifact(artifact, promptData) {
  assertNoDisallowedGenderedPronounsInCopy(artifact, promptData);
  assertNoMarketingHypeInCopy(artifact);
}

async function generateEditorialCopy({ apiKey, model, requestFn, logger }) {
  const promptData = buildEditorialPromptData();
  logger(`Generating editorial copy for ${promptData.players.length} players, ${promptData.awards.length} awards, ${promptData.trips.length} trips, and ${promptData.lists.length} lists.`);

  const systemPrompt = [
    'You are writing short editorial copy for a static personal escape-room site.',
    'Use only the supplied JSON facts.',
    'Do not invent ratings, opinions, dates, relationships, or achievements that are not in the input.',
    'Write with escape-room fluency, texture, and scene awareness.',
    'Sound like someone deep in escape-room culture: trip planning, lineups, destination rooms, local favorites, TERPECA chatter, Morty nods, team dynamics, and post-game debrief energy.',
    'Be specific and textured, not generic, corporate, report-like, or promotional.',
    'Use concrete nouns from the input such as cities, countries, trips, awards, players, and room counts when they help.',
    'Do not use vague filler like "prominent", "distinguished", "top players", "notable selection", or "escape room experience".',
    'Avoid sounding like analytics copy, museum label copy, tourism copy, or launch copy.',
    'Do not sound like marketing. No hype, no ad voice, no invitation language, no exclamation marks.',
    'Do not use words like ultimate, epic, breathtaking, thrilling, unforgettable, captivating, extraordinary, vibrant, picturesque, or similar promo language.',
    'Prefer the voice of an enthusiast talking to other enthusiasts.',
    'Keep the writing grounded, warm, and observant.',
    'Never infer gender or pronouns from a person name alone.',
    'Gendered pronouns are allowed only when they are clearly supported by the supplied Airtable bio for that player.',
    'If no supporting bio pronouns are present, prefer repeating the person name or rewriting the sentence to avoid pronouns entirely.',
    'For player intros and person-named lists, only use pronouns that are explicitly grounded in the supplied bio.',
    'Player intros should still read cleanly if the player name is repeated.',
    'Write plain text only, no markdown.',
    'Each summary or intro should be one or two short sentences.',
    'Prefer concise, lived-in phrasing over dry enumeration.',
    'When writing about awards, lists, trips, or players, make them feel like chapters in a real escape-room archive rather than database entries.',
    'If a player bio is supplied, treat it as canon authored voice and use it to understand that player rather than flattening the player into stats.',
    'If a list includes a playerBio, let that inform the tone of the list intro without copying sentences from the bio.',
    'It is okay to sound understated.'
  ].join(' ');

  const promptPreamble = [
    'Generate public copy for the following data.',
    'Return every slug exactly once.',
    'Keep each slug in its matching section only: player slugs in players, award slugs in awards, trip slugs in trips, and list slugs in lists.',
    'The home summary should describe the archive as a whole.',
    'The featured summary should describe the featured hub.',
    'Trip routeSummary values should describe the route and geography, not repeat the intro.',
    'Bring forward escape-room culture and vibes without inventing new facts.',
    'Do not guess anybody’s gender.',
    'If you use a pronoun for a player or a person-linked list, it must match the pronouns explicitly present in that player bio.',
    'For player intros, write sentences that still work cleanly if the player name is repeated.',
    'If player bios are present, use them as the main grounding for player intros and for any person-linked lists.',
    'Do not paraphrase the whole bio back. Pull out the role, energy, or team dynamic that feels most true to the archive.',
    'Good direction: "A Europe run that moves from Amsterdam to Barcelona, with a lot of destination-room energy packed into one trip."',
    'Good direction: "Jamie shows up across a big stretch of the archive, from local runs to the larger travel lineups."',
    'Good direction: "Mazie turns up in some of the archive’s more memorable later runs, especially when the lineup gets a little bigger."',
    'Good direction: "This list reads like a personal trip shortlist rather than a general best-of."',
    'Bad direction: "Dive into a vibrant archive..."',
    'Bad direction: "Embark on a breathtaking journey..."',
    'Bad direction: "This section highlights two prominent trips, two distinguished awards, and four top players in the escape room experience."',
    'Bad direction: "Jamie has completed 87 rooms, achieving 72 wins with a win rate of 83%."',
    'Bad direction: "Jamie\'s favorite rooms from her unforgettable European escapade..."'
  ];

  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const pronounRevision = lastError?.message.includes('pronouns')
      ? [
          'Pronoun fix: only use gendered pronouns if they are explicitly present in the supplied Airtable bio for that player.',
          'If the supporting bio does not clearly authorize a pronoun, rewrite with the player name instead.'
        ]
      : [];
    const hypeRevision = lastError?.message.includes('marketing or hype')
      ? [
          'Tone fix: strip out trailer language, promo adjectives, and sweeping claims.',
          'Aim for the voice of someone swapping trip notes after a room, not announcing a product.'
        ]
      : [];

    const revisionNote = lastError
      ? [
          '',
          `Revision note for attempt ${attempt}: the previous draft still missed the style target.`,
          `Fix this issue exactly: ${lastError.message}`,
          'Rewrite in plainer, more lived-in language. Think post-trip notes, debriefs, and enthusiast chatter, not launch copy.',
          ...pronounRevision,
          ...hypeRevision
        ]
      : [];

    const userPrompt = [
      ...promptPreamble,
      ...revisionNote,
      '',
      JSON.stringify(promptData, null, 2)
    ].join('\n');

    const response = await requestStructuredOutput({
      apiKey,
      model,
      schemaName: 'escape_archive_editorial_copy',
      schema: buildEditorialSchema(),
      systemPrompt,
      userPrompt,
      maxOutputTokens: 8000,
      requestFn
    });

    assertExactSlugCoverage(response.players || [], promptData.players.map((item) => item.slug), 'Player editorial');
    assertExactSlugCoverage(response.awards || [], promptData.awards.map((item) => item.slug), 'Award editorial');
    assertExactSlugCoverage(response.trips || [], promptData.trips.map((item) => item.slug), 'Trip editorial');
    assertExactSlugCoverage(response.lists || [], promptData.lists.map((item) => item.slug), 'List editorial');

    const artifact = normalizeAiCopyArtifact({
      meta: {
        generatedAt: new Date().toISOString(),
        model
      },
      home: response.home,
      featured: response.featured,
      players: toSlugMap(response.players || [], ['intro']),
      awards: toSlugMap(response.awards || [], ['intro']),
      trips: toSlugMap(response.trips || [], ['intro', 'routeSummary']),
      lists: toSlugMap(response.lists || [], ['intro'])
    });

    assertExactSlugCoverage(
      Object.keys(artifact.players).map((slug) => ({ slug })),
      promptData.players.map((item) => item.slug),
      'Normalized player editorial'
    );
    assertExactSlugCoverage(
      Object.keys(artifact.awards).map((slug) => ({ slug })),
      promptData.awards.map((item) => item.slug),
      'Normalized award editorial'
    );
    assertExactSlugCoverage(
      Object.keys(artifact.trips).map((slug) => ({ slug })),
      promptData.trips.map((item) => item.slug),
      'Normalized trip editorial'
    );
    assertExactSlugCoverage(
      Object.keys(artifact.lists).map((slug) => ({ slug })),
      promptData.lists.map((item) => item.slug),
      'Normalized list editorial'
    );

    try {
      validateEditorialArtifact(artifact, promptData);
      return artifact;
    } catch (error) {
      lastError = error;
      logger(`Editorial copy attempt ${attempt} needs revision: ${error.message}`);
    }
  }

  throw lastError || new Error('Editorial copy generation failed.');
}

async function generateRoomSearchHints({ apiKey, model, requestFn, logger }) {
  const rooms = buildRoomSearchPromptData();
  const roomBatches = chunk(rooms, ROOM_BATCH_SIZE);
  const artifact = createEmptyAiSearchArtifact();

  logger(`Generating search hints for ${rooms.length} rooms in ${roomBatches.length} batches.`);

  for (let index = 0; index < roomBatches.length; index += 1) {
    const batch = roomBatches[index];
    logger(`Generating search hints batch ${index + 1}/${roomBatches.length}.`);

    const systemPrompt = [
      'You generate static search-hint phrases for an escape-room archive.',
      'Use only the supplied JSON facts.',
      'Do not invent new cities, awards, names, or story details.',
      'Hints should feel like real searches typed by escape-room fans, not SEO filler.',
      'Prefer combinations of room name, company, location, awards, trips, lists, themes, year, and status.',
      'Use the language people actually search with: city + award, room name + company, trip name + city, player + favorites, theme + place, scheduled + destination.',
      'Avoid dull generic phrases like "escape challenges", "escape games", or "award-winning escape room" unless those exact grounded entities support the query.',
      'Return 4 to 6 hints per room.'
    ].join(' ');

    const userPrompt = [
      'Generate grounded search hints for each room in this batch.',
      'Return every slug exactly once.',
      'Hints should be plain strings, lowercase is fine, and should not repeat the slug itself.',
      'Write the kind of queries a person would actually type when chasing TERPECA rooms, Morty-recognized games, destination rooms, favorite lists, player lineups, or planned trips.',
      'Good examples: "terpeca paris room", "jamie favorites europe trip", "barcelona morty room", "library room minneapolis", "scheduled escape in europe barcelona".',
      'Bad examples: "themed escape challenges", "award-winning room", "best escape games".',
      '',
      JSON.stringify({ rooms: batch }, null, 2)
    ].join('\n');

    const response = await requestStructuredOutput({
      apiKey,
      model,
      schemaName: `escape_archive_search_hints_batch_${index + 1}`,
      schema: buildRoomSearchSchema(),
      systemPrompt,
      userPrompt,
      maxOutputTokens: 7000,
      requestFn
    });

    assertExactSlugCoverage(response.rooms || [], batch.map((item) => item.slug), `Room search hint batch ${index + 1}`);

    (response.rooms || []).forEach((room) => {
      artifact.rooms[room.slug] = {
        hints: room.hints
      };
    });
  }

  artifact.meta = {
    generatedAt: new Date().toISOString(),
    model,
    roomCount: rooms.length
  };

  const normalizedArtifact = normalizeAiSearchArtifact(artifact);
  assertExactSlugCoverage(
    Object.keys(normalizedArtifact.rooms).map((slug) => ({ slug })),
    rooms.map((room) => room.slug),
    'Normalized room search hints'
  );

  return normalizedArtifact;
}

async function run(options = {}) {
  loadDotEnv(options.envFilePath);

  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const model = options.model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const logger = options.logger || (() => {});

  if (!apiKey && !options.requestFn) {
    throw new Error('OPENAI_API_KEY is required for ai:refresh.');
  }

  fs.mkdirSync(options.generatedDir || GENERATED_DIR, { recursive: true });

  const copyArtifact = await generateEditorialCopy({
    apiKey,
    model,
    requestFn: options.requestFn,
    logger
  });

  const searchArtifact = await generateRoomSearchHints({
    apiKey,
    model,
    requestFn: options.requestFn,
    logger
  });

  const copyPath = options.copyPath || COPY_PATH;
  const searchPath = options.searchPath || SEARCH_PATH;

  writeJsonFile(copyPath, copyArtifact);
  writeJsonFile(searchPath, searchArtifact);

  logger(`Wrote ${path.relative(ROOT_DIR, copyPath)} and ${path.relative(ROOT_DIR, searchPath)}.`);

  return {
    copyArtifact,
    searchArtifact
  };
}

async function main() {
  await run({
    logger: (message) => process.stdout.write(`${message}\n`)
  });
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildEditorialPromptData,
  buildRoomSearchPromptData,
  generateEditorialCopy,
  generateRoomSearchHints,
  loadDotEnv,
  requestStructuredOutput,
  run
};
