import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateContent } from "../shared/content.js";
import { fetchCommunityRss, parseCommunityRss, sanitizeRssExcerpt, UNIVERSITY_RSS_URL } from "../server/community/rss.js";
import { createCommunityFeedService } from "../server/community/service.js";

const base = JSON.parse(await readFile(new URL("../content/app-content/community.json", import.meta.url), "utf8"));
const now = new Date("2026-09-18T10:00:00.000Z");

test("community content validates canonical university resources and disables unpublished Telegram", () => {
  const data = validateContent("community", base);
  assert.equal(data.resources.length, 4);
  assert.equal(data.sharingIsCaring.enabled, false);
  assert.equal(data.sharingIsCaring.url, "");
  assert.throws(() => validateContent("community", { ...base, feeds: [{ ...base.feeds[0], url: "https://example.org/rss" }] }));
});

test("RSS parser limits categories, age and destinations and sanitizes descriptions", () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Room available</title><link>https://www.uni-weimar.de/en/university/news/message-boards/room</link><guid>1</guid><pubDate>Thu, 17 Sep 2026 09:00:00 +0000</pubDate><category>Housing / Accomodation</category><description><![CDATA[<p>Useful <b>details</b><script>alert(1)</script> name@example.org +49 3643 12345678</p>]]></description></item>
    <item><title>Old item</title><link>https://www.uni-weimar.de/old</link><pubDate>Thu, 01 Jan 2020 09:00:00 +0000</pubDate><category>Piazza</category></item>
    <item><title>External</title><link>https://example.org/item</link><pubDate>Thu, 17 Sep 2026 09:00:00 +0000</pubDate><category>Piazza</category></item>
    <item><title>Unapproved category</title><link>https://www.uni-weimar.de/item</link><pubDate>Thu, 17 Sep 2026 09:00:00 +0000</pubDate><category>University</category></item>
  </channel></rss>`;
  const notices = parseCommunityRss(xml, base.feeds[0], now);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].title, "Room available");
  assert.equal(notices[0].excerpt, "");
  assert.throws(() => parseCommunityRss("<rss><channel>", base.feeds[0], now));
  assert.throws(() => parseCommunityRss('<!DOCTYPE rss [<!ENTITY x "boom">]><rss><channel></channel></rss>', base.feeds[0], now));
  assert.equal(UNIVERSITY_RSS_URL, base.feeds[0].url);
});

test("community feed service reuses last-good cache on fetch failure and expires old notices", async () => {
  const record = {
    version: 1, feedId: base.feeds[0].id, checkedAt: new Date(now.getTime() - 31 * 60_000).toISOString(),
    notices: [
      { id: "recent", title: "Recent", date: "2026-09-17T00:00:00.000Z", category: "Housing & accommodation", excerpt: "", url: "https://www.uni-weimar.de/item" },
      { id: "old", title: "Old", date: "2026-07-01T00:00:00.000Z", category: "Housing & accommodation", excerpt: "", url: "https://www.uni-weimar.de/item" },
    ],
  };
  const store = {
    paths: {},
    async readJson() { return { value: record, etag: "v1" }; },
    async writeJson() { throw new Error("write unavailable"); },
  };
  const service = createCommunityFeedService({
    env: { NEXTCLOUD_USERNAME: "configured", NEXTCLOUD_APP_PASSWORD: "configured" },
    fetchImpl: async () => { throw new Error("offline"); },
    now: () => now,
    injectedStore: store,
  });
  const result = await service.getPublic(validateContent("community", base));
  assert.equal(result.status, "current");
  assert.deepEqual(result.notices.map((item) => item.id), ["recent"]);
});

test("RSS excerpt sanitizer removes executable markup and contact details", () => {
  const excerpt = sanitizeRssExcerpt("Hello <script>bad()</script> user@example.org +49 3643 12345678");
  assert.equal(excerpt, "Hello");
});

test("RSS fetch rejects off-host redirects and non-XML responses", async () => {
  await assert.rejects(fetchCommunityRss(async () => new Response(null, {
    status: 302, headers: { location: "https://attacker.example/feed" },
  })), /Unapproved RSS redirect/);
  await assert.rejects(fetchCommunityRss(async () => new Response("<html />", {
    headers: { "content-type": "text/html" },
  })), /RSS source unavailable/);
});

test("community feed refresh caches normalized university notices", async () => {
  const xml = `<rss><channel><item><title>Room offer</title><link>https://www.uni-weimar.de/en/university/news/message-boards/room</link><pubDate>Thu, 17 Sep 2026 09:00:00 +0000</pubDate><category>Housing / Accomodation</category></item></channel></rss>`;
  let saved = null;
  let fetches = 0;
  const store = {
    paths: {},
    async readJson() { return { value: saved, etag: saved ? "tag-1" : null }; },
    async writeJson(_path, value) { saved = structuredClone(value); return "tag-1"; },
  };
  const service = createCommunityFeedService({
    env: { NEXTCLOUD_USERNAME: "configured", NEXTCLOUD_APP_PASSWORD: "configured" },
    fetchImpl: async () => {
      fetches++;
      return new Response(xml, { headers: { "content-type": "application/rss+xml" } });
    },
    now: () => now,
    injectedStore: store,
  });
  const first = await service.getPublic(validateContent("community", base));
  const second = await service.getPublic(validateContent("community", base));
  assert.equal(first.status, "current");
  assert.equal(first.notices[0].title, "Room offer");
  assert.equal(second.notices.length, 1);
  assert.equal(fetches, 1);
  assert.ok(saved.checkedAt);
});

test("failed first RSS refresh records a private retry backoff", async () => {
  let saved = null;
  let fetches = 0;
  const store = {
    paths: {},
    async readJson() { return { value: saved, etag: saved ? "tag-1" : null }; },
    async writeJson(_path, value) { saved = structuredClone(value); return "tag-1"; },
  };
  const service = createCommunityFeedService({
    env: { NEXTCLOUD_USERNAME: "configured", NEXTCLOUD_APP_PASSWORD: "configured" },
    fetchImpl: async () => { fetches++; throw new Error("offline"); },
    now: () => now,
    injectedStore: store,
  });
  assert.equal((await service.getPublic(validateContent("community", base))).status, "unavailable");
  assert.equal((await service.getPublic(validateContent("community", base))).status, "unavailable");
  assert.equal(fetches, 1);
  assert.equal(saved.checkedAt, "");
  assert.equal(saved.lastAttemptAt, now.toISOString());
});
