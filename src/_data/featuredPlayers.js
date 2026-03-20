const catalog = require('./catalog');

module.exports = function() {
  return [...catalog().featured.players].sort((left, right) => {
    if (right.roomCount !== left.roomCount) return right.roomCount - left.roomCount;
    return left.name.localeCompare(right.name);
  });
};
