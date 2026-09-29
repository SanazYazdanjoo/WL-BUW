import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { encodeSession, decodeSession } from "../server/staff/auth.js";
import { staffMiddleware } from "../server/staff/api.js";
import { createPresenceStore } from "../server/staff/presence.js";

function memoryStore() {
  const files = new Map();
  let n = 0;
  return {
    files,
    paths: { presence: "staff-data/presence.json", loginHistory: "staff-data/login-history.json" },
    async readJson(path) { return files.get(path) || { value: null, etag: null }; },
    async writeJson(path, value, etag) {
      if ((files.get(path)?.etag || null) !== etag) throw Object.assign(new Error("conflict"), { status: 409 });
      files.set(path, { value: structuredClone(value), etag: `"${++n}"` });
    },
  };
}

test("presence lists people seen in the last three minutes and forgets them on sign-out", async () => {
  let clock = Date.parse("2026-09-29T10:00:00Z");
  const store = memoryStore();
  const presence = createPresenceStore(store, () => clock);
  const anna = { staffId: "staff_a", name: "Anna", role: "tutor" }, ben = { staffId: "staff_b", name: "Ben", role: "coordinator" };
  assert.deepEqual((await presence.ping(anna)).map((person) => person.name), ["Anna"]);
  const writes = store.files.get(store.paths.presence).etag;
  clock += 10000;
  await presence.ping(anna);
  assert.equal(store.files.get(store.paths.presence).etag, writes, "a quick second ping does not rewrite the file");
  assert.deepEqual((await presence.ping(ben)).map((person) => person.name), ["Anna", "Ben"]);
  clock += 4 * 60 * 1000;
  assert.deepEqual((await presence.ping(ben)).map((person) => person.name), ["Ben"], "Anna closed her tab");
  await presence.leave(ben);
  assert.deepEqual(await presence.online(), []);
  // Tabs that have not chosen a name yet are not listed.
  await presence.ping({ name: "tutor", role: "tutor" });
  assert.deepEqual(await presence.online(), []);
});

test("the sign-in history keeps the newest 1,000 events", async () => {
  const presence = createPresenceStore(memoryStore());
  for (let i = 0; i < 1005; i += 1) await presence.record("sign-in", { name: `Person ${i}`, role: "tutor", login: "tutor", method: "shared" });
  await presence.record("unknown-event", { name: "Nobody" });
  const history = await presence.history();
  assert.equal(history.length, 1000);
  assert.equal(history[0].name, "Person 1004");
});

test("sign-ins, failed attempts and sign-outs are recorded; only Admins and up can read them", async () => {
  const files = new Map();
  let revision = 0;
  // A tiny WebDAV stand-in with ETags, enough for the private JSON files.
  const dav = async (url, options = {}) => {
    const path = decodeURIComponent(new URL(url).pathname).split("/APP/")[1];
    const method = options.method || "GET";
    if (method === "MKCOL") return new Response(null, { status: 405 });
    const current = files.get(path);
    if (method === "GET") return current ? new Response(current.body, { status: 200, headers: { etag: current.etag } }) : new Response(null, { status: 404 });
    const match = options.headers["If-Match"], none = options.headers["If-None-Match"];
    if ((match && current?.etag !== match) || (none === "*" && current)) return new Response(null, { status: 412 });
    const etag = `"${++revision}"`;
    files.set(path, { body: options.body, etag });
    return new Response(null, { status: 201, headers: { etag } });
  };
  const env = {
    STAFF_PILOT_ENABLED: "true",
    STAFF_SESSION_SECRET: "synthetic-session-secret-32-characters-long",
    STAFF_ACCESS_CODE: "synthetic-tutor-code-long-enough",
    STAFF_ADMIN_CODE: "synthetic-admin-code-long-enough",
    NEXTCLOUD_USERNAME: "synthetic",
    NEXTCLOUD_APP_PASSWORD: "synthetic",
    NEXTCLOUD_BASE_URL: "https://cloud.example",
    NEXTCLOUD_ROOT_FOLDER: "/APP",
    NEXTCLOUD_WORKBOOK_FILE: "",
  };
  const api = staffMiddleware(env, dav, () => ({}));
  const server = createServer((req, res) => api(req, res, () => res.writeHead(404).end()));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, token) => fetch(`${base}/api/staff/${path}`, { method: "POST", headers: { origin: base, "content-type": "application/json", ...(token ? { cookie: `wl_staff=${token}`, "x-csrf-token": decodeSession(token, env).csrf } : {}) }, body: JSON.stringify(body) });
  const get = (path, token) => fetch(`${base}/api/staff/${path}`, { headers: { cookie: `wl_staff=${token}` } });
  try {
    assert.equal((await post("login", { username: "tutor", password: "not-the-password" })).status, 401);
    assert.equal((await post("login", { username: "tutor", password: env.STAFF_ACCESS_CODE })).status, 200);
    const anna = encodeSession({ id: "a", name: "Anna", role: "tutor", staffId: "staff_a" }, env);
    const online = await (await post("presence", {}, anna)).json();
    assert.deepEqual(online.online.map((person) => person.name), ["Anna"]);
    assert.equal((await post("logout", {}, anna)).status, 200);
    assert.equal((await get("logins", anna)).status, 403);
    assert.equal((await get("logins", encodeSession({ id: "c", name: "Cora", role: "coordinator", staffId: "staff_c" }, env))).status, 403);
    const history = await (await get("logins", encodeSession({ id: "s", name: "Sam", role: "admin", staffId: "staff_s" }, env))).json();
    assert.deepEqual(history.entries.map((entry) => [entry.event, entry.name, entry.login]), [["sign-out", "Anna", ""], ["sign-in", "", "tutor"], ["failed", "", "tutor"]]);
    assert.deepEqual(history.online, [], "signing out removes Anna from the online list");
    assert.ok(![...files.values()].some((file) => file.body.includes("not-the-password")), "passwords are never stored");
  } finally {
    server.close();
  }
});
