import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  approvedSourceUrl,
  officialSourceConfig,
  validateSourceConfig,
} from "../server/officialSources/config.js";
import { fetchOfficialSource } from "../server/officialSources/fetchOfficialSource.js";
import { parsePreparingStudies } from "../server/officialSources/parsePreparingStudies.js";
import { parseSourceDate, parseWelcomeEvents } from "../server/officialSources/parseWelcomeEvents.js";
import { safeExtractedUrl } from "../server/officialSources/html.js";
import { createOfficialSourcesService } from "../server/officialSources/sourceCache.js";
import { officialSourcesMiddleware } from "../server/officialSources/api.js";

const preparing = (sections = [
  `<div class="csc-default"><h2>Enrolment</h2><a href="/enrolment/">Enrolment</a><a href="javascript:alert(1)">unsafe</a></div>`,
  `<div class="csc-default"><h2>Health insurance</h2><a href="https://www.daad.de/health">DAAD</a></div>`,
  `<div class="frame"><h2>International Networks</h2><a href="http://www.uni-weimar.de/networks">Networks</a></div>`,
], favicon = "") => `<html><head><title>Preparing your studies</title>${favicon}</head><body><div id="content_top"><h1>Preparing your studies</h1></div><article id="content_main"><h2>Preparing your studies</h2>${sections}</article></body></html>`;

const event = ({
  heading = "04 September 2026 | Welcome online event",
  when = "When: 04 Sept. 2026, 12:30 - 2:00 pm",
  language = "Language: English",
  link = "https://events.example.org/register/unique",
  extra = "",
} = {}) => `<div id="content_top"><h1>Welcome Events</h1></div><article id="content_main"><h2>PRE-ARRIVAL WELCOME EVENTS</h2><div class="frame"><h3>${heading}</h3><p>A brief event description for new students.</p><p>Please register here</p><p>${when}</p><p>${language}</p>${extra}<a href="${link}">Register</a></div></article>`;
const welcomePage = (html) => new Response(html, {
  status: 200,
  headers: { "Content-Type": "text/html; charset=utf-8" },
});

test("source configuration is validated and only the approved HTTPS host is fetchable", () => {
  assert.deepEqual(validateSourceConfig(officialSourceConfig), officialSourceConfig);
  assert.equal(approvedSourceUrl("http://www.uni-weimar.de/a"), "");
  assert.equal(approvedSourceUrl("https://127.0.0.1/a"), "");
  assert.equal(approvedSourceUrl("https://localhost/a"), "");
  assert.equal(approvedSourceUrl("https://example.org/a"), "");
  assert.equal(approvedSourceUrl("file:///etc/passwd"), "");
  assert.equal(approvedSourceUrl("https://user:pass@www.uni-weimar.de/a"), "");
  assert.equal(approvedSourceUrl(officialSourceConfig.sources.welcomeEvents.url), officialSourceConfig.sources.welcomeEvents.url);
});

test("Preparing Studies extracts bounded section labels and safe official/external links", () => {
  const parsed = parsePreparingStudies(preparing());
  assert.equal(parsed.sections.length, 3);
  assert.equal(parsed.sections[0].id, "enrolment");
  assert.match(parsed.sections[0].officialUrl, /uni-weimar\.de\/enrolment/);
  assert.equal(parsed.sections[0].externalLinks.some((link) => link.label === "unsafe"), false);
  assert.equal(parsed.sections[1].externalLinks[0].url, "https://www.daad.de/health");
  assert.equal(parsed.sections[2].officialUrl, "https://www.uni-weimar.de/networks");
  assert.ok(parsed.sections.every((section) => !Object.hasOwn(section, "html")));
});

test("favicon references resolve against the official page and reject unsafe schemes", () => {
  const pageRelative = parsePreparingStudies(preparing(undefined, '<link rel="icon" href="favicon.ico">'));
  assert.equal(pageRelative.faviconUrl, `${officialSourceConfig.sources.preparingStudies.url}favicon.ico`);
  const relative = parsePreparingStudies(preparing(undefined, '<link rel="icon" href="/fileadmin/template/favicon.ico">'));
  assert.equal(relative.faviconUrl, "https://www.uni-weimar.de/fileadmin/template/favicon.ico");
  const absolute = parsePreparingStudies(preparing(undefined, '<link rel="icon" href="https://www.uni-weimar.de/assets/icon.png">'));
  assert.equal(absolute.faviconUrl, "https://www.uni-weimar.de/assets/icon.png");
  const unsafe = parsePreparingStudies(preparing(undefined, '<link rel="icon" href="javascript:alert(1)">'));
  assert.equal(unsafe.faviconUrl, "");
  const missing = parsePreparingStudies(preparing());
  assert.equal(missing.faviconUrl, "");
});

test("Preparing Studies rejects an error page, missing title and source regression", () => {
  assert.throws(() => parsePreparingStudies("<html><body>404 error</body></html>"));
  assert.throws(() => parsePreparingStudies("<article id='content_main'><h1>Different page</h1></article>"));
  assert.throws(() => parsePreparingStudies(preparing(["<h2>One</h2>"])), /sections/);
});

test("source links reject unsafe schemes and upgrade the official HTTP host", () => {
  assert.equal(safeExtractedUrl("javascript:alert(1)", officialSourceConfig.sources.preparingStudies.url), "");
  assert.equal(safeExtractedUrl("data:text/html,x", officialSourceConfig.sources.preparingStudies.url), "");
  assert.equal(safeExtractedUrl("http://www.uni-weimar.de/page", officialSourceConfig.sources.preparingStudies.url), "https://www.uni-weimar.de/page");
  assert.equal(safeExtractedUrl("http://example.org/page", officialSourceConfig.sources.preparingStudies.url), "");
});

test("event parser normalizes details, retains source dates and flags conflicting dates", () => {
  const parsed = parseWelcomeEvents(event({
    heading: "04 September 2026 | Welcome online event",
    when: "When: 04 Sept. 2026, 12:30 - 2:00 pm",
    extra: "<p>Where? Online room</p>",
  }));
  const item = parsed.events[0];
  assert.equal(item.date, "2026-09-04");
  assert.equal(item.startTime, "12:30");
  assert.equal(item.endTime, "14:00");
  assert.equal(item.location, "Online");
  assert.equal(item.language, "English");
  assert.match(item.registrationUrl, /events\.example\.org/);
  assert.match(item.id, /^event-[a-f0-9]{20}$/);
  const conflicted = parseWelcomeEvents(event({
    heading: "14 September 2026 | Navigate your pathway",
    when: "When: 16 March 2026, 12 pm",
  })).events[0];
  assert.equal(conflicted.date, "");
  assert.equal(conflicted.startTime, "");
  assert.equal(conflicted.sourceStatus, "needs-review");
  assert.ok(conflicted.warnings.length);
  assert.match(conflicted.dateText, /14 September 2026.*16 March 2026/);
});

test("date parser preserves ranges and rejects impossible dates", () => {
  assert.deepEqual(parseSourceDate("28 September - 09 October 2026"), {
    start: "2026-09-28",
    end: "2026-10-09",
    raw: "28 September - 09 October 2026",
  });
  assert.equal(parseSourceDate("31 February 2026"), null);
});

test("event parser rejects empty/error pages and duplicate identifiers", () => {
  assert.throws(() => parseWelcomeEvents("<html><body>404 error</body></html>"));
  assert.throws(() => parseWelcomeEvents("<div id='content_main'><h1>Welcome Events</h1></div>"));
  const duplicate = `<div id="content_top"><h1>Welcome Events</h1></div><article id="content_main"><div class="frame"><h3>04 September 2026 | Same event</h3><p>When: 04 September 2026</p><a href="https://events.example.org/same">Register</a></div><div class="frame"><h3>04 September 2026 | Same event</h3><p>When: 04 September 2026</p><a href="https://events.example.org/same">Register</a></div></article>`;
  assert.throws(() => parseWelcomeEvents(duplicate), /duplicate/);
});

test("fetcher rejects redirects outside the source allowlist, bad MIME, oversized bodies and timeouts", async () => {
  let calls = 0;
  await assert.rejects(fetchOfficialSource("welcomeEvents", async () => {
    calls++;
    return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } });
  }), /redirected outside/);
  assert.equal(calls, 1);
  await assert.rejects(fetchOfficialSource("welcomeEvents", async () => new Response("not html", {
    headers: { "Content-Type": "application/json" },
  })), /did not return/);
  await assert.rejects(fetchOfficialSource("welcomeEvents", async () => new Response("x", {
    headers: { "Content-Type": "text/html", "Content-Length": "1000001" },
  })), /too large/);
  await assert.rejects(fetchOfficialSource("welcomeEvents", async () => { throw new Error("network"); }), /could not be reached/);
});

test("public source API is narrow and the internal refresh endpoint requires its secret", async () => {
  let refreshes = 0;
  const sourceRecord = {
    sourceId: "welcomeEvents",
    label: "Welcome events",
    url: officialSourceConfig.sources.welcomeEvents.url,
    status: "unavailable",
    data: null,
  };
  const service = {
    getOne: async (id) => id === "welcomeEvents" ? sourceRecord : null,
    refreshAll: async () => { refreshes++; return [{ sourceId: "welcomeEvents", result: "updated" }]; },
  };
  const env = {
    OFFICIAL_SOURCE_SYNC_ENABLED: "true",
    OFFICIAL_SOURCE_SYNC_SECRET: "a-secure-synthetic-secret-that-is-long-enough-123",
  };
  const api = officialSourcesMiddleware(env, fetch, service);
  const server = createServer((req, res) => api(req, res, () => res.writeHead(404).end()));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const publicResponse = await fetch(`${base}/api/content/official/welcome-events`);
    assert.equal(publicResponse.status, 200);
    const publicBody = await publicResponse.text();
    assert.match(publicBody, /Welcome events/);
    assert.doesNotMatch(publicBody, /SECRET|official-source-cache|<html/i);
    assert.equal((await fetch(`${base}/api/content/official/unknown`)).status, 404);
    assert.equal((await fetch(`${base}/api/content/official/welcome-events`, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${base}/api/internal/sync-official-sources`, { method: "POST" })).status, 404);
    assert.equal(refreshes, 0);
    assert.equal((await fetch(`${base}/api/internal/sync-official-sources`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.OFFICIAL_SOURCE_SYNC_SECRET}` },
    })).status, 200);
    assert.equal(refreshes, 1);
  } finally {
    server.close();
    await once(server, "close");
  }
});

class MemorySourceStore {
  paths = { officialSources: { preparingStudies: "official-source-cache/preparing-studies.json", welcomeEvents: "official-source-cache/welcome-events.json" } };
  values = new Map();
  sequence = 0;
  async readJson(path) {
    const item = this.values.get(path);
    return item ? { value: structuredClone(item.value), etag: item.etag } : { value: null, etag: null };
  }
  async writeJson(path, value, etag) {
    const prior = this.values.get(path);
    if ((prior?.etag || null) !== etag) throw Object.assign(new Error("conflict"), { status: 409 });
    const next = `etag-${++this.sequence}`;
    this.values.set(path, { value: structuredClone(value), etag: next });
    return next;
  }
}

test("cache revalidates on TTL, hashes content rather than check timestamps, and keeps last-known-good after failure", async () => {
  const store = new MemorySourceStore();
  let clock = new Date("2026-09-01T10:00:00.000Z");
  let fail = false;
  const html = event({});
  const service = createOfficialSourcesService({
    env: { NEXTCLOUD_USERNAME: "pilot", NEXTCLOUD_APP_PASSWORD: "secret" },
    injectedStore: store,
    now: () => clock,
    fetchImpl: async () => {
      if (fail) throw new Error("upstream unavailable");
      return welcomePage(html);
    },
  });
  assert.equal((await service.refreshOne("welcomeEvents", { force: true })).result, "updated");
  const path = store.paths.officialSources.welcomeEvents;
  const first = (await store.readJson(path)).value;
  clock = new Date("2026-09-01T17:00:00.000Z");
  assert.equal((await service.getOne("welcomeEvents")).status, "current");
  const checked = (await store.readJson(path)).value;
  assert.equal(checked.contentHash, first.contentHash);
  assert.equal(checked.lastChangedAt, first.lastChangedAt);
  assert.notEqual(checked.lastSuccessfulCheck, first.lastSuccessfulCheck);
  clock = new Date("2026-09-02T01:00:00.000Z");
  fail = true;
  const result = await service.getOne("welcomeEvents");
  const failed = (await store.readJson(path)).value;
  assert.equal(result.status, "stale");
  assert.equal(failed.data.events[0].id, first.data.events[0].id);
  assert.equal(failed.data.events[0].title, first.data.events[0].title);
  assert.equal(failed.data.events[0].date, first.data.events[0].date);
  assert.equal(failed.lastSuccessfulCheck, checked.lastSuccessfulCheck);
  assert.equal(failed.status, "fetch-failed");
});

test("large source changes are held for coordinator review and are not silently published", async () => {
  const store = new MemorySourceStore();
  let clock = new Date("2026-09-01T10:00:00.000Z");
  let body = event({});
  const service = createOfficialSourcesService({
    env: { NEXTCLOUD_USERNAME: "pilot", NEXTCLOUD_APP_PASSWORD: "secret" },
    injectedStore: store,
    now: () => clock,
    fetchImpl: async () => welcomePage(body),
  });
  await service.refreshOne("welcomeEvents", { force: true });
  const path = store.paths.officialSources.welcomeEvents;
  const previous = (await store.readJson(path)).value;
  body = Array.from({ length: 8 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `<div class="frame"><h3>${day} September 2026 | Event ${index + 1}</h3><p>When: ${day} September 2026, 12 pm</p><p>Language: English</p><a href="https://events.example.org/register/${index + 1}">Register</a></div>`;
  }).join("");
  body = `<div id="content_top"><h1>Welcome Events</h1></div><article id="content_main"><h2>PRE-ARRIVAL WELCOME EVENTS</h2>${body}</article>`;
  clock = new Date("2026-09-02T10:00:00.000Z");
  assert.equal((await service.refreshOne("welcomeEvents", { force: true })).result, "needs-review");
  assert.equal((await store.readJson(path)).value.data.events.length, previous.data.events.length);
  assert.equal((await store.readJson(path)).value.pendingReview.data.events.length, 8);
  assert.equal((await service.getOne("welcomeEvents")).data.events.length, 1);
  assert.equal((await service.acceptPending("welcomeEvents")).result, "updated");
  assert.equal((await store.readJson(path)).value.data.events.length, 8);
});
