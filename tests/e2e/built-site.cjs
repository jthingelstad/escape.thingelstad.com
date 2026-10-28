// Checks against the built site (_site/), so run after `npm run build` (`npm run test:e2e`; CI does).
// What the S3 deploy publishes must match the build: the redirect map the deploy copies into
// CloudFront's key value store is exactly the redirect pages, the viewer-request function knows
// every extensionless file, and every file has a content type chosen for it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = '_site';
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(ROOT).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));

test('the redirect map names every redirect page, and nothing else', () => {
  const pages = {};
  for (const file of files.filter((f) => f.endsWith('/index.html'))) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const target = html.match(/<meta http-equiv="refresh" content="0; url=([^"]+)">/);
    if (target) pages['/' + file.replace(/index\.html$/, '')] = target[1];
  }
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, '_redirects.json'), 'utf8'));
  assert.ok(Object.keys(pages).length > 100, `only ${Object.keys(pages).length} redirect pages`);
  assert.deepEqual(map, pages);
  for (const [from, to] of Object.entries(map)) {
    assert.match(from, /^\/room\/.+\/$/);
    assert.ok(files.includes(to.slice(1) + 'index.html'), `${from} points at ${to}, which the build does not write`);
  }
});

test('the function knows every extensionless file, and every file is typed', async () => {
  const { FILES } = await import('../../infra/viewer-request.mjs');
  const { publishPlan, isOpaque } = await import('../../scripts/publish-plan.mjs');
  const plan = publishPlan(ROOT);
  const keys = plan.map((file) => file.key);
  assert.ok(!keys.includes('_redirects.json'));
  const bare = keys.filter((key) => !key.split('/').pop().includes('.')).map((key) => '/' + key);
  assert.deepEqual(bare.sort(), [...FILES].sort());
  const untyped = plan.filter((file) => file.contentType === 'application/octet-stream' && !isOpaque(file.key));
  assert.deepEqual(untyped.map((file) => file.key), [], 'add these to TYPES in scripts/publish-plan.mjs');
  assert.equal(plan.find((file) => file.key === 'feed.xml').contentType, 'application/xml; charset=utf-8');
});

test('every sitemap url is a built page with a W3C lastmod from its content, not the build time', () => {
  // Google reads <lastmod> only where it is accurate (2026-10-28; lib/lastmod.js).
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: /<loc>([^<]+)<\/loc>/.exec(body)?.[1],
    lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(body)?.[1]
  }));
  assert.ok(urls.length > 100, `only ${urls.length} urls`);
  const w3c = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
  for (const { loc, lastmod } of urls) {
    assert.match(lastmod ?? '', w3c, loc);
    assert.ok(Date.parse(lastmod) <= Date.now(), `${loc}: ${lastmod} is in the future`);
    const file = new URL(loc).pathname.slice(1) + 'index.html';
    assert.ok(files.includes(file), `${loc} is not a built page`);
    assert.ok(!fs.readFileSync(path.join(ROOT, file), 'utf8').includes('http-equiv="refresh"'), `${loc} is a redirect`);
  }
  // One build-time stamp would make them all the same.
  assert.ok(new Set(urls.map(({ lastmod }) => lastmod)).size > 10);
});
