// The S3 and CloudFront hosting: the viewer-request function (run here with a stand-in key value
// store), how each file is typed and cached, and the committed templates matching their source.
// tests/e2e/ checks the same against a real build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { viewerRequestCode } from "../infra/viewer-request.mjs";
import { certificate, site, delivery } from "../infra/templates.mjs";
import { cacheControlFor, contentTypeFor, isOpaque } from "../scripts/publish-plan.mjs";

const store = {
  "/room/9-barber-shop/": "/room/2017-06-29/barber-shop/",
  "/room/2026-07-22/pharoahs-tomb/": "/room/2026-07-22/pharaohs-tomb/",
};
const cf = {
  kvs: () => ({
    get: async (key) => {
      if (key in store) return store[key];
      throw new Error("Key not found");
    },
  }),
};
const handler = new Function("cf", viewerRequestCode.replace("import cf from 'cloudfront';", "") + "\nreturn handler;")(cf);
const request = (uri, querystring = {}) => handler({ request: { uri, querystring } });

test("a legacy room route is a 301 to the room, keeping the query", async () => {
  const r = await request("/room/9-barber-shop/", { ref: { value: "old-bookmark" } });
  assert.equal(r.statusCode, 301);
  assert.equal(r.headers.location.value, "/room/2017-06-29/barber-shop/?ref=old-bookmark");
  const alias = await request("/room/2026-07-22/pharoahs-tomb/");
  assert.equal(alias.headers.location.value, "/room/2026-07-22/pharaohs-tomb/");
});

test("a legacy route without its slash goes straight to the room", async () => {
  const r = await request("/room/9-barber-shop");
  assert.equal(r.statusCode, 301);
  assert.equal(r.headers.location.value, "/room/2017-06-29/barber-shop/");
});

test("directory URLs serve index.html; a bare path gets its slash; files pass", async () => {
  assert.equal((await request("/room/2017-06-29/barber-shop/")).uri, "/room/2017-06-29/barber-shop/index.html");
  assert.equal((await request("/")).uri, "/index.html");
  const bare = await request("/rooms", { player: { value: "jamie" } });
  assert.equal(bare.statusCode, 301);
  assert.equal(bare.headers.location.value, "/rooms/?player=jamie");
  assert.equal((await request("/feed.xml")).uri, "/feed.xml");
  assert.equal((await request("/images/rooms/team_recUJYKLX6I2KkA5t.JPG")).uri, "/images/rooms/team_recUJYKLX6I2KkA5t.JPG");
});

test("every kind of file the build writes has its own type", () => {
  const atom = '<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">';
  assert.equal(contentTypeFor("feed.xml", atom), "application/xml; charset=utf-8");
  assert.match(contentTypeFor("sitemap.xml", '<?xml version="1.0"?>\n<urlset'), /^application\/xml/);
  assert.match(contentTypeFor("feed.json"), /^application\/json; charset=utf-8/);
  assert.match(contentTypeFor("rooms.json"), /^application\/json; charset=utf-8/);
  assert.match(contentTypeFor("llms.txt"), /^text\/plain; charset=utf-8/);
  assert.match(contentTypeFor("room/2017-06-29/barber-shop/index.html"), /^text\/html; charset=utf-8/);
  assert.equal(contentTypeFor("images/rooms/team_recUJYKLX6I2KkA5t.JPG"), "image/jpeg");
  assert.equal(contentTypeFor("img/abc123-640.jpeg"), "image/jpeg");
  assert.equal(contentTypeFor("img/abc123-640.webp"), "image/webp");
  assert.equal(contentTypeFor("pagefind/fragment/en_1.pf_fragment"), "application/octet-stream");
  assert.ok(isOpaque("pagefind/wasm.en.pagefind"));
  assert.ok(!isOpaque("pagefind/pagefind.js"));
});

test("hashed images keep a week in browsers; pages and room photos are cleared by each deploy", () => {
  assert.equal(cacheControlFor("img/abc123-640.webp"), "public, max-age=604800");
  assert.equal(cacheControlFor("index.html"), "public, max-age=300, s-maxage=86400");
  assert.equal(cacheControlFor("images/rooms/team_recUJYKLX6I2KkA5t.JPG"), "public, max-age=300, s-maxage=86400");
});

test("the committed templates are what infra/templates.mjs writes", () => {
  for (const [name, body] of Object.entries({ certificate, site, delivery }))
    assert.deepEqual(JSON.parse(readFileSync(`infra/generated/${name}.json`, "utf8")), body, `run npm run infra:generate (${name})`);
});
