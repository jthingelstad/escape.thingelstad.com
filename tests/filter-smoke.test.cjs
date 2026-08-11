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

test('location formatting keeps city, state, and country without duplicate levels', async () => {
  const data = await loadBrowserDataModule();

  assert.equal(
    data.formatLocation({ city: 'Fremont', region: 'Washington', country: 'United States' }),
    'Fremont, Washington, United States'
  );
  assert.equal(
    data.formatLocation({ city: 'Porto', region: 'Portugal', country: 'Portugal' }),
    'Porto, Portugal'
  );
});

test('browser filter helpers keep DOM controls, URL state, and typed matching in sync', async () => {
  const data = await loadBrowserDataModule();
  const dom = new JSDOM(`
    <select id="filter-player">
      <option value="">All Players</option>
      <option value="jamie">Jamie</option>
    </select>
    <select id="filter-award">
      <option value="">All Awards</option>
      <option value="terpeca">TERPECA</option>
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
    url: 'https://escape.thingelstad.com/list/?status=Escaped'
  });

  await withBrowserGlobals(dom, async () => {
    const filters = data.getFilterParams();
    assert.equal(filters.status, 'Escaped');

    data.applyFiltersToControls(filters);

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
      '?player=jamie&theme=snow&country=United+States&year=2025&status=Escaped'
    );

    data.setFilterParams(currentFilters, { sort: 'rating', room: 42, historyMode: 'push' });
    assert.equal(data.getSortParam(), 'rating');
    assert.equal(data.getSelectedRoomParam(), '42');
    assert.equal(
      window.location.search,
      '?player=jamie&theme=snow&country=United+States&year=2025&status=Escaped&sort=rating&room=42'
    );

    data.setFilterParams(currentFilters, { room: '2025-12-22/the-vault', historyMode: 'push' });
    assert.equal(data.getSelectedRoomParam(), '2025-12-22/the-vault');
    assert.equal(
      window.location.search,
      '?player=jamie&theme=snow&country=United+States&year=2025&status=Escaped&room=2025-12-22%2Fthe-vault'
    );
    assert.equal(
      data.roomUrl({ date: '2025-12-22', game: 'The Vault' }),
      '/room/2025-12-22/the-vault/'
    );

    const matchingRoom = {
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
      themes: [{ slug: 'horror' }]
    };

    assert.equal(data.roomMatchesFilters(matchingRoom, currentFilters), true);
    assert.equal(data.roomMatchesFilters(nonMatchingRoom, currentFilters), false);

    let callbackCount = 0;
    data.bindFilterControls(() => {
      callbackCount += 1;
    });

    document.getElementById('filter-player').value = 'jamie';
    document.getElementById('filter-player').dispatchEvent(new window.Event('change', { bubbles: true }));

    document.getElementById('clear-filters').click();
    assert.equal(document.getElementById('filter-player').value, '');
    assert.equal(document.getElementById('filter-status').value, 'all');
    assert.ok(callbackCount >= 2);
  });
});
