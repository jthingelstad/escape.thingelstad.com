const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRoomSearchIndex,
  containsGenderedPronouns,
  containsMarketingHype,
  findDisallowedGenderedPronouns,
  mergeAiCopyArtifacts,
  normalizeAiCopyArtifact,
  normalizeAiSearchArtifact
} = require('../lib/aiArtifacts');

test('AI artifact helpers normalize shapes and preserve human overrides', () => {
  const generated = normalizeAiCopyArtifact({
    home: { summary: '  Archive summary.  ' },
    players: {
      jamie: { intro: 'Jamie intro.' }
    },
    trips: {
      'escape-in-europe': { intro: 'Trip intro.', routeSummary: 'Route summary.' }
    }
  });

  const merged = mergeAiCopyArtifacts(generated, {
    home: { summary: 'Human override summary.' },
    players: {
      jamie: { intro: 'Human override intro.' }
    }
  });

  assert.equal(merged.home.summary, 'Human override summary.');
  assert.equal(merged.players.jamie.intro, 'Human override intro.');
  assert.equal(merged.trips['escape-in-europe'].routeSummary, 'Route summary.');
});

test('room search index includes generated search hints alongside typed archive data', () => {
  const aiSearch = normalizeAiSearchArtifact({
    rooms: {
      '31-visible-room': {
        hints: ['paris award winning room', 'best room in paris']
      }
    }
  });

  const room = {
    slug: '31-visible-room',
    searchText: 'Visible Room Puzzle Co Paris France',
    game: 'Visible Room',
    status: 'Escaped',
    date: '2025-01-01',
    company: { name: 'Puzzle Co' },
    location: { label: 'Puzzle Co (Paris)', city: 'Paris', region: null, country: 'France' },
    players: [{ name: 'Jamie' }],
    awards: [{ name: 'TERPECA' }],
    trips: [{ name: 'Europe 2025' }],
    lists: [{ name: 'Favorites' }],
    themes: [{ name: 'Mystery' }]
  };

  const searchIndex = buildRoomSearchIndex(room, aiSearch.rooms[room.slug].hints);
  assert.match(searchIndex, /best room in paris/);
  assert.match(searchIndex, /award TERPECA/);
  assert.match(searchIndex, /trip Europe 2025/);
});

test('gendered pronoun detection catches inferred pronouns in generated copy', () => {
  assert.equal(containsGenderedPronouns('Jamie and his favorite rooms.'), true);
  assert.equal(containsGenderedPronouns('Jamie shows up across a huge stretch of the archive.'), false);
});

test('gendered pronoun validation can allow bio-supported pronouns', () => {
  assert.deepEqual(findDisallowedGenderedPronouns('Jamie and his favorite rooms.', ['he', 'him', 'his']), []);
  assert.deepEqual(findDisallowedGenderedPronouns('Mazie and his favorite rooms.', ['she', 'her', 'hers']), ['his']);
});

test('marketing-hype detection catches promo language in generated copy', () => {
  assert.equal(containsMarketingHype('Dive into a vibrant archive of thrilling rooms!'), true);
  assert.equal(containsMarketingHype('A Europe run with a lot of destination-room energy.'), false);
});
