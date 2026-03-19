const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../scripts/refresh_ai');

test('ai refresh writes validated copy and search artifacts using a mocked request path', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escape-ai-refresh-'));
  const copyPath = path.join(tempDir, 'ai-copy.json');
  const searchPath = path.join(tempDir, 'ai-search.json');

  const result = await run({
    copyPath,
    searchPath,
    generatedDir: tempDir,
    model: 'test-model',
    requestFn: async ({ schemaName, userPrompt }) => {
      if (schemaName === 'escape_archive_editorial_copy') {
        const promptData = JSON.parse(userPrompt.split('\n\n').pop());
        return {
          home: { summary: 'Archive summary from mock.' },
          featured: { summary: 'Featured summary from mock.' },
          players: promptData.players.map((player) => ({
            slug: player.slug,
            intro: `${player.name} mock intro.`
          })),
          awards: promptData.awards.map((award) => ({
            slug: award.slug,
            intro: `${award.name} mock intro.`
          })),
          trips: promptData.trips.map((trip) => ({
            slug: trip.slug,
            intro: `${trip.name} mock intro.`,
            routeSummary: `${trip.name} mock route.`
          })),
          lists: promptData.lists.map((list) => ({
            slug: list.slug,
            intro: `${list.name} mock intro.`
          }))
        };
      }

      const promptData = JSON.parse(userPrompt.split('\n\n').pop());
      return {
        rooms: promptData.rooms.map((room) => ({
          slug: room.slug,
          hints: [
            `${room.game} ${room.city || room.country || 'archive'}`,
            `${room.company || room.game} ${room.year || ''}`.trim(),
            `${room.status} ${room.game}`.trim(),
            `${room.country || room.city || room.game} escape room`
          ]
        }))
      };
    }
  });

  assert.ok(fs.existsSync(copyPath));
  assert.ok(fs.existsSync(searchPath));

  const copy = JSON.parse(fs.readFileSync(copyPath, 'utf8'));
  const search = JSON.parse(fs.readFileSync(searchPath, 'utf8'));

  assert.equal(copy.home.summary, 'Archive summary from mock.');
  assert.ok(Object.keys(copy.players).length > 0);
  assert.ok(Object.keys(search.rooms).length > 0);
  assert.equal(result.copyArtifact.meta.model, 'test-model');
  assert.equal(result.searchArtifact.meta.model, 'test-model');
});
