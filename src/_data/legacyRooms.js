const catalog = require('./catalog');

module.exports = function() {
  return catalog().rooms.filter((room) => room.legacySlug);
};
