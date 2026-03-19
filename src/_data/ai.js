const path = require('node:path');
const {
  createEmptyAiCopyArtifact,
  createEmptyAiSearchArtifact,
  mergeAiCopyArtifacts,
  normalizeAiSearchArtifact,
  readJsonFile
} = require('../../lib/aiArtifacts');

const GENERATED_COPY_PATH = path.join(__dirname, '..', '_generated', 'ai-copy.json');
const GENERATED_SEARCH_PATH = path.join(__dirname, '..', '_generated', 'ai-search.json');
const OVERRIDES_PATH = path.join(__dirname, '..', '_manual', 'ai-overrides.json');

module.exports = function() {
  const generatedCopy = readJsonFile(GENERATED_COPY_PATH, createEmptyAiCopyArtifact());
  const generatedSearch = readJsonFile(GENERATED_SEARCH_PATH, createEmptyAiSearchArtifact());
  const overrides = readJsonFile(OVERRIDES_PATH, createEmptyAiCopyArtifact());

  return {
    copy: mergeAiCopyArtifacts(generatedCopy, overrides),
    search: normalizeAiSearchArtifact(generatedSearch)
  };
};
