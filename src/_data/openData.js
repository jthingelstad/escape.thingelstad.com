const catalog = require('./catalog');
const { buildLlmsTxt, buildRoomsExport } = require('../../lib/open-data');

module.exports = function() {
  const data = catalog();
  return {
    rooms: buildRoomsExport(data),
    llmsTxt: buildLlmsTxt(data)
  };
};
