const catalog = require('./catalog');
const routeAliases = require('./roomRouteAliases.json');

module.exports = function() {
  const data = catalog();
  const redirects = data.rooms
    .filter((room) => room.legacySlug)
    .map((room) => ({ from: room.legacySlug, room }));
  const usedRoutes = new Set(redirects.map((redirect) => redirect.from));

  Object.entries(routeAliases).forEach(([airtableId, aliases]) => {
    const room = data.lookups.rooms.byAirtableId[airtableId];
    if (!room) throw new Error(`Room route aliases reference unknown Airtable record ${airtableId}.`);

    aliases.forEach((from) => {
      if (from === room.slug) return;
      if (data.lookups.rooms.bySlug[from] || usedRoutes.has(from)) {
        throw new Error(`Room redirect route ${from} is duplicated.`);
      }
      usedRoutes.add(from);
      redirects.push({ from, room });
    });
  });

  return redirects;
};
