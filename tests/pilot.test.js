import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { validateContent, whatsappLink } from "../shared/content.js";
import {
  cleanPath,
  davUrl,
  isPublicDocument,
  parseListing,
} from "../server/nextcloud.js";
import { loadContent } from "../server/content.js";
import { applicationApi } from "../server/api.js";
import {
  parseProgress,
  readProgress,
  writeProgress,
  toggleProgress,
  emptyProgress,
} from "../src/services/progress.js";
import config from "../content/app-content/config.json" with { type: "json" };
import onboarding from "../content/app-content/onboarding.json" with { type: "json" };
import { loadContentBundle } from "../server/content.js";
import events from "../content/app-content/events.json" with { type: "json" };
import afterArrival from "../content/app-content/after-arrival.json" with { type: "json" };
import healthInsurance from "../content/app-content/health-insurance.json" with { type: "json" };
import usefulLinks from "../content/app-content/useful-links.json" with { type: "json" };
import rundfunk from "../content/app-content/rundfunk.json" with { type: "json" };
const env = {
  NEXTCLOUD_USERNAME: "test",
  NEXTCLOUD_APP_PASSWORD: "secret",
  NEXTCLOUD_ROOT_FOLDER: "/Welcome-Lounge-App",
};
test("public subtree rejects private, ambiguous and malicious paths", () => {
  for (const path of [
    "",
    "private.pdf",
    "documents",
    "documents-other/x",
    "/documents/a",
    "documents/../a",
    "documents/./a",
    "documents/.hidden",
    "documents/a\\b",
    "documents/a\u007f",
    "documents/%252e%252e/a",
    "documents//a",
    "app-content/config.json",
  ])
    assert.equal(isPublicDocument(path), false, path);
  assert.equal(isPublicDocument("documents/enrollment/a b.pdf"), true);
  assert.throws(() => cleanPath("\u007f"));
  assert.match(
    davUrl("test", "documents/a.pdf", env.NEXTCLOUD_ROOT_FOLDER),
    /\/Welcome-Lounge-App\/documents\/a.pdf$/,
  );
  assert.throws(() => davUrl("test", "documents/a.pdf", "/x/../private"));
});
test("XML rejects malformed and entity-bearing responses", () => {
  for (const xml of [
    "<broken>",
    '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///secret">]><multistatus>&x;</multistatus>',
    "<html/>",
  ])
    assert.throws(() => parseListing(xml, davUrl("test"), ""));
});
test("content schema enforces IDs, safe document paths, booleans and unique topics", () => {
  assert.equal(
    validateContent("onboarding", onboarding).topics.length,
    onboarding.topics.length,
  );
  for (const change of [
    (v) => v.topics.push(v.topics[0]),
    (v) => (v.topics[0].id = "../bad"),
    (v) => (v.topics[0].isDemo = "false"),
    (v) => (v.topics[0].documents = [{ label: "Bad", path: "private/file" }]),
    (v) =>
      (v.topics[0].documents = [{ label: "Bad", path: "documents/../file" }]),
  ]) {
    const v = structuredClone(onboarding);
    change(v);
    assert.throws(() => validateContent("onboarding", v));
  }
  const v = structuredClone(onboarding);
  v.topics[0].isActive = false;
  assert.equal(
    validateContent("onboarding", v).topics.length,
    onboarding.topics.length - 1,
  );
  assert.throws(() =>
    validateContent("onboarding", { version: 2, topics: [] }),
  );
});
test("WhatsApp requires enabled current configuration and exact secure invite host", () => {
  assert.equal(whatsappLink(config), "");
  for (const link of [
    "javascript:alert(1)",
    "https://chat.whatsapp.com.evil.test/invite",
    "http://chat.whatsapp.com/invite",
    "https://user:pass@chat.whatsapp.com/invite",
    "",
  ])
    assert.equal(
      whatsappLink({
        ...config,
        whatsappEnabled: true,
        whatsappGroupUrl: link,
      }),
      "",
    );
  const current = {
    ...config,
    whatsappEnabled: true,
    whatsappGroupUrl: "https://chat.whatsapp.com/Abc123",
  };
  assert.equal(whatsappLink(current), current.whatsappGroupUrl);
  assert.equal(
    validateContent("config", { ...current, whatsappEnabled: false })
      .whatsappGroupUrl,
    "",
  );
});
test("content reads fixed configured path and falls back safely for every upstream failure", async () => {
  const result = await loadContent("config", env, async (url, options) => {
    if (url.endsWith("/published.json"))
      return new Response(null, { status: 404 });
    assert.match(url, /Welcome-Lounge-App\/app-content\/config.json$/);
    assert.equal(options.redirect, "error");
    return new Response(JSON.stringify(config));
  });
  assert.equal(result.source, "nextcloud");
  assert.equal(result.data.whatsappEnabled, false);
  for (const mock of [
    async () => new Response("private secret", { status: 403 }),
    async () => new Response("{bad"),
    async () => new Response("{}"),
    async () => new Response("x".repeat(512001)),
    async () => {
      throw new Error("secret");
    },
  ]) {
    const result = await loadContent("config", env, mock);
    assert.equal(result.source, "demo");
    assert.equal(result.data.whatsappGroupUrl, "");
    assert.ok(!JSON.stringify(result).includes("secret"));
  }
  await assert.rejects(loadContent("../private", env));
});
test("versioned progress tolerates corruption, duplicates, unknown schemas and unavailable storage", () => {
  for (const raw of [
    null,
    "bad",
    "{}",
    '{"version":2,"completed":["enrollment"]}',
  ])
    assert.deepEqual(parseProgress(raw), emptyProgress());
  assert.deepEqual(
    parseProgress(
      '{"version":1,"completed":["enrollment","enrollment",null,"../bad"]}',
    ).completed,
    ["enrollment"],
  );
  const p = toggleProgress(emptyProgress(), "enrollment");
  assert.deepEqual(toggleProgress(p, "enrollment"), emptyProgress());
  const broken = {
    getItem() {
      throw new Error();
    },
    setItem() {
      throw new Error();
    },
  };
  assert.equal(readProgress(broken).available, false);
  assert.equal(writeProgress(broken, p), false);
});
test("shared API returns JSON 404/405 and never fetches private paths", async () => {
  let calls = 0;
  const handler = applicationApi(env, async () => {
    calls++;
    throw new Error();
  });
  const server = createServer((req, res) =>
    handler(req, res, () => res.writeHead(404).end()),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of [
      "/api/unknown",
      "/api/nextcloud/files",
      "/api/nextcloud/download?path=private.txt",
      "/api/content/private",
    ]) {
      const r = await fetch(base + route);
      assert.equal(r.status, 404);
      assert.match(r.headers.get("content-type"), /json/);
    }
    assert.equal(
      (await fetch(base + "/api/content/config", { method: "POST" })).status,
      405,
    );
    assert.equal(calls, 0);
    const r = await fetch(base + "/api/content/onboarding");
    assert.equal(r.status, 200);
    assert.equal((await r.json()).source, "demo");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

import { createOperationsService } from "../server/operations.js";
import { feedbackService } from "../src/services/feedback.js";
test("events validate dates, times and active state without publishing unsafe links", () => {
  assert.equal(validateContent("events", events).events.length, 1);
  for (const patch of [
    { date: "2026-02-30" },
    { startTime: "25:00" },
    { endTime: "01:00" },
  ]) {
    const value = structuredClone(events);
    Object.assign(value.events[0], patch);
    assert.throws(() => validateContent("events", value));
  }
  const value = structuredClone(events);
  value.events[0].externalLink = "javascript:alert(1)";
  assert.equal(validateContent("events", value).events[0].externalLink, "");
  value.events[0].isActive = false;
  assert.equal(validateContent("events", value).events.length, 0);
});
test("unwired staff interface rejects unauthenticated actors before repository access", async () => {
  let contacted = false;
  const service = createOperationsService({
    authorize: async () => null,
    repository: {
      listArrivals: async () => {
        contacted = true;
      },
    },
  });
  await assert.rejects(
    service.listArrivals(null, "2026-09-17"),
    /Staff access required/,
  );
  assert.equal(contacted, false);
});
test("feedback adapter never reports persistence", async () => {
  const result = await feedbackService.submit({ answer: true });
  assert.equal(result.saved, false);
  assert.match(result.message, /not been sent or saved/);
});

test("published release takes precedence and malformed releases never reveal legacy data", async () => {
  const release = {
    version: 1,
    content: { config: { ...config, semesterLabel: "Reviewed semester" } },
  };
  let calls = 0;
  const published = await loadContent("config", env, async (url) => {
    calls++;
    assert.ok(url.endsWith("/published.json"));
    return new Response(JSON.stringify(release));
  });
  assert.equal(published.data.semesterLabel, "Reviewed semester");
  assert.equal(calls, 1);
  const invalid = await loadContent(
    "config",
    env,
    async () =>
      new Response(JSON.stringify({ version: 2, content: release.content })),
  );
  assert.equal(invalid.source, "demo");
});

test("progress revisions keep completion separate from reused numbered steps", () => {
  const entries = new Map(),
    storage = {
      getItem: (key) => entries.get(key),
      setItem: (key, value) => entries.set(key, value),
    };
  writeProgress(
    storage,
    toggleProgress(emptyProgress(), "first-step-01"),
    "wl-progress:old",
  );
  assert.deepEqual(
    readProgress(storage, "wl-progress:new").value.completed,
    [],
  );
  assert.deepEqual(readProgress(storage, "wl-progress:old").value.completed, [
    "first-step-01",
  ]);
});

test("student content bundle reads the published release once for mobile loads", async () => {
  const content = {
    config,
    onboarding,
    events,
    "after-arrival": afterArrival,
    "health-insurance": healthInsurance,
    "useful-links": usefulLinks,
    rundfunk,
  };
  let calls = 0;
  const bundle = await loadContentBundle(env, async (url) => {
    calls++;
    assert.ok(url.endsWith("/published.json"));
    return new Response(JSON.stringify({ version: 1, content }));
  });
  assert.equal(calls, 1);
  assert.equal(Object.keys(bundle.data).length, 7);
  assert.ok(
    Object.values(bundle.sources).every((source) => source === "nextcloud"),
  );
});
