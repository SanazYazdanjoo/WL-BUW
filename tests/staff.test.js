import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { encodeSession, decodeSession, cookie } from "../server/staff/auth.js";
import { staffMiddleware } from "../server/staff/api.js";
import { createPrivateStore, staffPaths } from "../server/staff/store.js";
const env = {
  STAFF_PILOT_ENABLED: "true",
  STAFF_SESSION_SECRET: "synthetic-session-secret-32-characters-long",
  STAFF_ACCESS_CODE: "synthetic-tutor-code-long-enough",
  STAFF_ADMIN_CODE: "synthetic-admin-code-long-enough",
};
test("staff sessions reject tampering, expiry and disabled access", () => {
  const token = encodeSession(
    { id: "synthetic", name: "Test tutor", role: "tutor" },
    env,
    1000,
  );
  assert.equal(decodeSession(token, env, 1001).role, "tutor");
  assert.equal(decodeSession(token + "x", env, 1001), null);
  assert.equal(decodeSession(token, env, 30000000), null);
  assert.equal(
    decodeSession(token, { ...env, STAFF_PILOT_ENABLED: "false" }, 1001),
    null,
  );
  assert.match(
    cookie(token, { ...env, NODE_ENV: "production" }),
    /HttpOnly; SameSite=Lax;.*Secure/,
  );
});
test("staff endpoints authenticate and authorize before repository access, and reject CSRF", async () => {
  let calls = 0;
  const api = staffMiddleware(env, fetch, () => {
    calls++;
    return {
      workspace: async () => ({ data: {} }),
      previewContentWorkbook: async () => ({ ok: true }),
    };
  });
  const server = createServer((req, res) =>
    api(req, res, () => res.writeHead(404).end()),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ["workspace", "content", "config", "data/export"])
      assert.equal((await fetch(`${base}/api/staff/${path}`)).status, 401);
    assert.equal(calls, 0);
    const token = encodeSession(
      { id: "test", name: "Test tutor", role: "tutor" },
      env,
    );
    const headers = {
      cookie: `wl_staff=${token}`,
      origin: base,
      "content-type": "application/json",
      "x-csrf-token": decodeSession(token, env).csrf,
    };
    assert.equal(
      (
        await fetch(`${base}/api/staff/content/preview`, {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${base}/api/staff/checkin`, {
          method: "POST",
          headers: { ...headers, origin: "https://other.example" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(calls, 0);
    const response = await fetch(`${base}/api/staff/workspace`, { headers });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(calls, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("staff login accepts Vercel's parsed JSON body without reading the stream", async () => {
  const api = staffMiddleware(env, fetch, () => ({}));
  const server = createServer((req, res) => {
    req.body = { name: "Vercel test tutor", code: env.STAFF_ACCESS_CODE };
    return api(req, res, () => res.writeHead(404).end());
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/api/staff/login`, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({ name: "Vercel test tutor", code: "ignored" }),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("content workbook template is available only to an authenticated admin", async () => {
  const api = staffMiddleware(env, fetch, () => ({}));
  const server = createServer((req, res) => api(req, res, () => res.writeHead(404).end()));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/staff/content/template`;
    assert.equal((await fetch(url)).status, 401);
    const tutor = encodeSession({ id: "tutor", name: "Tutor", role: "tutor" }, env);
    assert.equal((await fetch(url, { headers: { cookie: `wl_staff=${tutor}` } })).status, 403);
    const admin = encodeSession({ id: "admin", name: "Admin", role: "admin" }, env);
    const response = await fetch(url, { headers: { cookie: `wl_staff=${admin}` } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /spreadsheetml/);
    assert.match(response.headers.get("content-disposition"), /Welcome-Lounge-Content-Template\.xlsx/);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer()).slice(0, 2)], [80, 75]);
    const sampleUrl = `http://127.0.0.1:${server.address().port}/api/staff/data/template`;
    assert.equal((await fetch(sampleUrl)).status, 401);
    assert.equal((await fetch(sampleUrl, { headers: { cookie: `wl_staff=${tutor}` } })).status, 403);
    const sampleResponse = await fetch(sampleUrl, { headers: { cookie: `wl_staff=${admin}` } });
    assert.equal(sampleResponse.status, 200);
    assert.match(sampleResponse.headers.get("content-disposition"), /MasterExcel-SAMPLE\.xlsx/);
    assert.deepEqual([...new Uint8Array(await sampleResponse.arrayBuffer()).slice(0, 2)], [80, 75]);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("private storage confines paths and makes conditional writes", async () => {
  for (const STAFF_DATA_DIR of [
    "documents",
    "app-content",
    "../private",
    "nested/folder",
  ])
    assert.throws(() => staffPaths({ STAFF_DATA_DIR }));
  const calls = [];
  const store = createPrivateStore(
    {
      NEXTCLOUD_USERNAME: "synthetic",
      NEXTCLOUD_APP_PASSWORD: "synthetic",
      NEXTCLOUD_BASE_URL: "https://nextcloud.uni-weimar.de",
      NEXTCLOUD_ROOT_FOLDER: "/Welcome.Lounge_WiSe2026_27/APP",
    },
    async (url, options) => {
      calls.push({ url, options });
      return new Response(null, {
        status: options.method === "MKCOL" ? 201 : 412,
      });
    },
  );
  await assert.rejects(store.read("documents/private.xlsx"));
  assert.equal(calls.length, 0);
  await assert.rejects(store.read("official-source-cache/unrelated.json"));
  assert.equal(calls.length, 0);
  await assert.rejects(
    store.writeJson(store.paths.state, {}, '"v1"'),
    (error) => error.status === 409,
  );
  assert.equal(calls.at(-1).options.headers["If-Match"], '"v1"');
  assert.equal(calls.at(-1).options.redirect, "error");
});
