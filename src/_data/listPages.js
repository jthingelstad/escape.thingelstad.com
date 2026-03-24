const catalog = require('./catalog');

module.exports = function() {
  const data = catalog();
  const roomLookup = data.lookups.rooms.byAirtableId;
  const listItemLookup = data.lookups.listItems.byId;

  return data.lists.map((list) => {
    const entries = (list.listItemIds || [])
      .map((itemId) => listItemLookup[itemId])
      .filter(Boolean)
      .map((item) => ({
        ...item,
        room: roomLookup[item.roomAirtableId] || null
      }))
      .filter((item) => item.room);

    return {
      ...list,
      entries,
      rooms: entries.map((entry) => entry.room),
      countries: [...new Set(entries.map((entry) => entry.room.location?.country).filter(Boolean))].sort()
    };
  });
};
