const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const catalog = require('../src/_data/catalog');
const { isPlayed, playedAt, SITE_URL } = require('../lib/feed');

// Rooms are the feed entries, so on the pages a played room is an h-entry (IndieWeb): its own page,
// and its card on the home page and /rooms/, which are h-feeds. The only feeds the head advertises
// are the feeds; rooms.json is open data, named in llms.txt.

const MF_CLASS = /^(h|p|u|dt|e)-/;
const roomUrl = (room) => `${SITE_URL}/room/${room.slug}/`;

let built;
async function pages() {
  if (!built) {
    const { Eleventy } = await import('@11ty/eleventy');
    const root = path.join(__dirname, '..');
    const eleventy = new Eleventy(path.join(root, 'src'), path.join(root, '_site'), {
      configPath: path.join(root, 'eleventy.config.js'),
      quietMode: true
    });
    built = await eleventy.toJSON();
  }
  return built;
}

async function page(url) {
  const found = (await pages()).find((p) => p.url === url);
  assert.ok(found, `no page at ${url}`);
  return new JSDOM(found.content).window.document;
}

const mfClasses = (root) =>
  [root, ...root.querySelectorAll('[class]')].flatMap((el) => [...(el.classList || [])].filter((c) => MF_CLASS.test(c)));

// A card or row in an h-feed: one name, the clean room address (the link may carry ?from=) and the
// play date at noon UTC, as in the feeds.
function assertEntry(entry, room, where) {
  assert.equal(entry.querySelectorAll('.p-name').length, 1, `${where}: one p-name`);
  assert.equal(entry.querySelector('.p-name').textContent.trim(), room.game, `${where}: p-name`);
  const urls = entry.querySelectorAll('.u-url');
  assert.equal(urls.length, 1, `${where}: one u-url`);
  assert.equal(urls[0].tagName, 'DATA');
  assert.equal(urls[0].getAttribute('value'), roomUrl(room), `${where}: u-url`);
  const published = entry.querySelectorAll('.dt-published');
  assert.equal(published.length, 1, `${where}: one dt-published`);
  assert.equal(published[0].tagName, 'TIME');
  assert.equal(published[0].getAttribute('datetime'), playedAt(room.date), `${where}: dt-published`);
  // Headings are text-wrap: balance, and an element inside one changes where Chrome breaks it.
  assert.ok(published[0].contains(urls[0]), `${where}: the u-url sits in the date, not the title`);
  assert.equal(entry.querySelector('.p-name').children.length, 0, `${where}: the title holds only its text`);
}

test('no page advertises rooms.json as a feed, and llms.txt still names it', async () => {
  for (const p of await pages()) {
    if (!p.outputPath?.endsWith('.html')) continue;
    const head = p.content.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? '';
    assert.doesNotMatch(head, /type="application\/json"/, `${p.url} has a JSON alternate`);
    assert.doesNotMatch(head, /rooms\.json/, `${p.url} links rooms.json`);
  }
  const llms = (await pages()).find((p) => p.url === '/llms.txt').content;
  assert.match(llms, /^- \[[^\]]+\]\(https:\/\/escape\.thingelstad\.com\/rooms\.json\): /m);
});

test('each played room page is one h-entry, its hero, with no author and nothing from the related rooms', async () => {
  const rooms = catalog().rooms;
  assert.ok(rooms.some(isPlayed), 'no played rooms');
  for (const room of rooms) {
    const doc = await page(`/room/${room.slug}/`);
    const where = `/room/${room.slug}/`;
    if (!isPlayed(room)) {
      assert.deepEqual(mfClasses(doc.body), [], `${where}: a scheduled room is not an entry`);
      continue;
    }
    const entries = doc.querySelectorAll('.h-entry');
    assert.equal(entries.length, 1, `${where}: one h-entry`);
    const [entry] = entries;
    assert.ok(entry.matches('section.room-hero'), `${where}: the hero is the entry`);
    assert.ok(entry.querySelector('h1').classList.contains('p-name'), `${where}: the h1 names it`);
    assertEntry(entry, room, where);
    assert.equal(entry.querySelector('.u-url').getAttribute('value'), doc.querySelector('link[rel="canonical"]').getAttribute('href'),`${where}: u-url is the canonical`);
    const content = [...entry.querySelectorAll('.e-content')].map((el) => el.className);
    assert.deepEqual(
      content,
      [room.commentary && 'room-hero-commentary rich-text e-content', room.notes && 'room-hero-notes rich-text e-content'].filter(Boolean),
      `${where}: e-content is the commentary and notes shown`
    );
    // Who the author is waits on Jamie's call (open-web audit P13).
    assert.deepEqual(mfClasses(doc.body).filter((c) => /author|h-card/.test(c)), [], `${where}: no author`);
    const outside = [...doc.body.children].flatMap((el) => (el.contains(entry) ? [] : mfClasses(el)));
    const inMain = [...doc.querySelector('main').children].filter((el) => el !== entry).flatMap(mfClasses);
    assert.deepEqual([...outside, ...inMain], [], `${where}: no microformats outside the hero`);
  }
});

test('the home page is one h-feed, named by its title, with an h-entry for each recent room', async () => {
  const doc = await page('/');
  const feeds = doc.querySelectorAll('.h-feed');
  assert.equal(feeds.length, 1);
  assert.ok(feeds[0].matches('main'), 'main is the feed');
  assert.equal(feeds[0].querySelector('h1').className, 'page-intro-title p-name');
  const feedNames = [...feeds[0].querySelectorAll('.p-name')].filter((el) => !el.closest('.h-entry'));
  assert.deepEqual(feedNames.map((el) => el.textContent), ['Escaping Things'], 'the feed has one name');

  const bySlug = new Map(catalog().rooms.map((room) => [`/room/${room.slug}/`, room]));
  const recent = [...doc.querySelectorAll('#recent-rooms .room-card')];
  assert.ok(recent.length > 0, 'no recent rooms');
  for (const card of recent) {
    const room = bySlug.get(card.querySelector('.room-card-link').dataset.roomPath);
    assert.ok(card.classList.contains('h-entry'), `${room.game}: recent card is an h-entry`);
    assertEntry(card, room, `home ${room.game}`);
  }
  for (const card of doc.querySelectorAll('#up-next .room-card')) {
    assert.deepEqual(mfClasses(card), [], 'an Up Next room is not played yet, so not an entry');
  }
  assert.equal(doc.querySelectorAll('.h-entry').length, recent.length);
});

test('/rooms/ is an h-feed with an h-entry for each played room', async () => {
  const doc = await page('/rooms/');
  const feeds = doc.querySelectorAll('.h-feed');
  assert.equal(feeds.length, 1);
  assert.ok(feeds[0].matches('#room-list.room-grid'), 'the room grid is the feed');

  const bySlug = new Map(catalog().rooms.map((room) => [`/room/${room.slug}/`, room]));
  const cards = [...feeds[0].querySelectorAll('.room-card')];
  let entries = 0;
  for (const card of cards) {
    const room = bySlug.get(card.querySelector('.room-card-link').dataset.roomPath);
    if (!isPlayed(room)) {
      assert.deepEqual(mfClasses(card), [], `${room.game}: a scheduled room is not an entry`);
      continue;
    }
    entries += 1;
    assert.ok(card.classList.contains('h-entry'), `${room.game}: an h-entry`);
    assertEntry(card, room, `/rooms/ ${room.game}`);
  }
  assert.equal(entries, catalog().rooms.filter(isPlayed).length);
  assert.equal(doc.querySelectorAll('.h-entry').length, entries);
});

test('no other page carries an h-feed or h-entry, so room cards elsewhere stay plain', async () => {
  for (const p of await pages()) {
    if (!p.outputPath?.endsWith('.html') || p.url === '/' || p.url === '/rooms/' || /^\/room\//.test(p.url)) continue;
    assert.doesNotMatch(p.content, /class="[^"]*\b(h|p|u|dt|e)-[a-z]/, p.url);
  }
});
