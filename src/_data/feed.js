const catalog = require('./catalog');
const { buildFeed } = require('../../lib/feed');

module.exports = function() {
  return buildFeed(catalog().rooms);
};
