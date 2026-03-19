const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

async function loadBrowserDataModule() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'data.js'), 'utf8');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
}

async function withBrowserGlobals(dom, run) {
  const previous = {
    window: global.window,
    document: global.document,
    history: global.history,
    URLSearchParams: global.URLSearchParams
  };

  global.window = dom.window;
  global.document = dom.window.document;
  global.history = dom.window.history;
  global.URLSearchParams = dom.window.URLSearchParams;

  try {
    return await run();
  } finally {
    global.window = previous.window;
    global.document = previous.document;
    global.history = previous.history;
    global.URLSearchParams = previous.URLSearchParams;
    dom.window.close();
  }
}

test('browser filter helpers keep DOM controls, URL state, and typed matching in sync', async () => {
  const data = await loadBrowserDataModule();
  const dom = new JSDOM(`
    <input id="filter-search" value="">
    <select id="filter-company">
      <option value="">All Companies</option>
      <option value="puzzleworks">Puzzleworks</option>
    </select>
    <select id="filter-location">
      <option value="">All Locations</option>
      <option value="minneapolis-minnesota-united-states">Minneapolis, Minnesota, United States</option>
    </select>
    <select id="filter-player">
      <option value="">All Players</option>
      <option value="jamie">Jamie</option>
    </select>
    <select id="filter-award">
      <option value="">All Awards</option>
      <option value="terpeca">TERPECA</option>
    </select>
    <select id="filter-trip">
      <option value="">All Trips</option>
      <option value="escape-in-europe">Escape in Europe</option>
    </select>
    <select id="filter-list">
      <option value="">All Lists</option>
      <option value="1-jamies-favorites">Jamie's Favorites</option>
    </select>
    <select id="filter-theme">
      <option value="">All Themes</option>
      <option value="snow">Snow</option>
    </select>
    <select id="filter-country">
      <option value="">All Countries</option>
      <option value="United States">United States</option>
    </select>
    <select id="filter-year">
      <option value="">All Years</option>
      <option value="2025">2025</option>
    </select>
    <select id="filter-status">
      <option value="all">All</option>
      <option value="Escaped">Escaped</option>
    </select>
    <button id="clear-filters">Clear</button>
  `, {
    url: 'https://escape.thingelstad.com/list/?q=yeti&company=puzzleworks&location=minneapolis-minnesota-united-states&trip=escape-in-europe&list=1-jamies-favorites&status=Escaped'
  });

  await withBrowserGlobals(dom, async () => {
    const filters = data.getFilterParams();
    assert.equal(filters.q, 'yeti');
    assert.equal(filters.company, 'puzzleworks');
    assert.equal(filters.location, 'minneapolis-minnesota-united-states');
    assert.equal(filters.trip, 'escape-in-europe');
    assert.equal(filters.list, '1-jamies-favorites');
    assert.equal(filters.status, 'Escaped');

    data.applyFiltersToControls(filters);
    assert.equal(document.getElementById('filter-search').value, 'yeti');
    assert.equal(document.getElementById('filter-company').value, 'puzzleworks');
    assert.equal(document.getElementById('filter-location').value, 'minneapolis-minnesota-united-states');
    assert.equal(document.getElementById('filter-list').value, '1-jamies-favorites');

    document.getElementById('filter-player').value = 'jamie';
    document.getElementById('filter-year').value = '2025';
    document.getElementById('filter-country').value = 'United States';
    document.getElementById('filter-theme').value = 'snow';

    const currentFilters = data.readFiltersFromControls();
    assert.equal(currentFilters.player, 'jamie');
    assert.equal(currentFilters.year, '2025');
    assert.equal(currentFilters.country, 'United States');
    assert.equal(currentFilters.theme, 'snow');
    assert.equal(data.hasActiveFilters(currentFilters), true);

    data.setFilterParams(currentFilters);
    assert.equal(
      window.location.search,
      '?q=yeti&year=2025&status=Escaped&country=United+States&company=puzzleworks&player=jamie&trip=escape-in-europe&list=1-jamies-favorites&theme=snow&location=minneapolis-minnesota-united-states'
    );

    const matchingRoom = {
      searchText: 'Legend of the Yeti Puzzleworks Minneapolis Jamie Escape in Europe Snow',
      company: { slug: 'puzzleworks' },
      location: { slug: 'minneapolis-minnesota-united-states', country: 'United States' },
      players: [{ slug: 'jamie' }],
      awards: [],
      trips: [{ slug: 'escape-in-europe' }],
      lists: [{ slug: '1-jamies-favorites' }],
      themes: [{ slug: 'snow' }],
      date: '2025-12-22',
      status: 'Escaped'
    };

    const nonMatchingRoom = {
      ...matchingRoom,
      trips: [{ slug: 'qmsb' }]
    };

    assert.equal(data.roomMatchesFilters(matchingRoom, currentFilters), true);
    assert.equal(data.roomMatchesFilters(nonMatchingRoom, currentFilters), false);

    let callbackCount = 0;
    data.bindFilterControls(() => {
      callbackCount += 1;
    }, { searchDebounce: 0 });

    document.getElementById('filter-search').value = 'reset';
    document.getElementById('filter-search').dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    document.getElementById('clear-filters').click();
    assert.equal(document.getElementById('filter-search').value, '');
    assert.equal(document.getElementById('filter-company').value, '');
    assert.equal(document.getElementById('filter-status').value, 'all');
    assert.ok(callbackCount >= 2);
  });
});
