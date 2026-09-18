import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import process from "node:process";
import handler from "../api/[...path].js";
import config from "../content/app-content/config.json" with { type: "json" };
import onboarding from "../content/app-content/onboarding.json" with { type: "json" };

test("Vercel handler reads configured content and streams downloads through shared WebDAV code", async () => {
  const settings = {
    NEXTCLOUD_USERNAME: "vercel-test-account",
    NEXTCLOUD_APP_PASSWORD: "vercel-test-secret",
    NEXTCLOUD_ROOT_FOLDER: "/Institutional-App",
    NEXTCLOUD_WORKBOOK_FILE: "",
    NEXTCLOUD_BASE_URL: "https://nextcloud.uni-weimar.de",
  };
  const previous = Object.fromEntries(
    Object.keys(settings).map((key) => [key, process.env[key]]),
  );
  const networkFetch = globalThis.fetch;
  const bytes = new Uint8Array([0, 255, 17, 42]);
  const requested = [];
  Object.assign(process.env, settings);
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/published.json"))
      return new Response(null, { status: 404 });
    requested.push(url);
    assert.equal(options.method || "GET", "GET");
    assert.equal(options.redirect, "error");
    assert.ok(options.headers.Authorization.startsWith("Basic "));
    assert.ok(
      url.startsWith(
        "https://nextcloud.uni-weimar.de/remote.php/dav/files/vercel-test-account/Institutional-App/",
      ),
    );
    if (url.endsWith("/app-content/config.json"))
      return new Response(JSON.stringify(config));
    if (url.endsWith("/app-content/onboarding.json")) {
      const data = structuredClone(onboarding);
      data.topics[0].isDemo = false;
      data.topics[0].documents = [
        { label: "Test file", path: "documents/test file.bin" },
      ];
      return new Response(JSON.stringify(data));
    }
    if (url.endsWith("/app-content/after-arrival.json"))
      return new Response(JSON.stringify({ version: 1, topics: [] }));
    assert.ok(url.endsWith("/documents/test%20file.bin"));
    return new Response(bytes);
  };
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const content = await networkFetch(`${base}/api/content/config`);
    const body = await content.text();
    assert.equal(JSON.parse(body).source, "nextcloud");
    assert.ok(!body.includes(settings.NEXTCLOUD_APP_PASSWORD));
    assert.ok(!body.includes(settings.NEXTCLOUD_ROOT_FOLDER));
    const download = await networkFetch(
      `${base}/api/nextcloud/download?path=documents/test%20file.bin`,
    );
    assert.equal(download.status, 200);
    assert.equal(
      download.headers.get("content-type"),
      "application/octet-stream",
    );
    assert.equal(download.headers.get("x-content-type-options"), "nosniff");
    assert.match(download.headers.get("content-disposition"), /^attachment;/);
    assert.deepEqual(new Uint8Array(await download.arrayBuffer()), bytes);
    assert.equal(requested.length, 4);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = networkFetch;
    for (const key of Object.keys(settings)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("Vercel entry point safely serves missing-credential fallback without leaking server settings", async () => {
  const keys = [
    "NEXTCLOUD_USERNAME",
    "NEXTCLOUD_APP_PASSWORD",
    "NEXTCLOUD_ROOT_FOLDER",
    "NEXTCLOUD_BASE_URL",
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const networkFetch = globalThis.fetch;
  let upstreamCalls = 0;
  delete process.env.NEXTCLOUD_USERNAME;
  delete process.env.NEXTCLOUD_APP_PASSWORD;
  process.env.NEXTCLOUD_ROOT_FOLDER = "/server-only-test-root";
  globalThis.fetch = async () => {
    upstreamCalls++;
    throw new Error("Unexpected upstream call");
  };
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const content = await networkFetch(`${base}/api/content/config`);
    assert.equal(content.status, 200);
    assert.equal(content.headers.get("cache-control"), "no-store");
    const body = await content.json();
    assert.equal(body.source, "demo");
    assert.equal(body.data.whatsappEnabled, false);
    assert.ok(!JSON.stringify(body).includes("server-only-test-root"));
    const download = await networkFetch(
      `${base}/api/nextcloud/download?path=documents/test.pdf`,
    );
    assert.equal(download.status, 503);
    assert.deepEqual(await download.json(), {
      error: "Documents are temporarily unavailable.",
    });
    assert.equal(
      (await networkFetch(`${base}/api/nextcloud/files`)).status,
      404,
    );
    assert.equal(
      (await networkFetch(`${base}/api/content/config`, { method: "POST" }))
        .status,
      405,
    );
    assert.equal(upstreamCalls, 0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = networkFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("Vercel path adapter restores rewritten nested routes before shared API auth", async () => {
  const names = [
    "STAFF_PILOT_ENABLED",
    "NEXTCLOUD_USERNAME",
    "NEXTCLOUD_APP_PASSWORD",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  for (const name of names) delete process.env[name];
  const server = createServer((req, res) => handler(req, res));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const session = await fetch(`${base}/api/staff?__api_path=staff/session`);
    assert.equal(session.status, 401);
    assert.deepEqual(await session.json(), {
      error: "Sign in to the staff area.",
    });
    const content = await fetch(
      `${base}/api/content?__api_path=content/config`,
    );
    assert.equal(content.status, 200);
    assert.equal((await content.json()).source, "demo");
    const denied = await fetch(`${base}/api/staff?__api_path=staff/../private`);
    assert.equal(denied.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
