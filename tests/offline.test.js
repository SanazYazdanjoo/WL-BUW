import test from "node:test";
import assert from "node:assert/strict";

// Minimal browser globals for the staff API client.
const store = new Map();
globalThis.sessionStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  key: (index) => [...store.keys()][index],
  get length() { return store.size; },
};
Object.defineProperty(globalThis.sessionStorage, "keys", { value: () => [...store.keys()] });
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.Event = class { constructor(type) { this.type = type; } };

let cloudUp = true;
const posted = [];
let reject409 = false;
globalThis.fetch = async (url, options = {}) => {
  const action = url.replace("/api/staff/", "");
  if (!cloudUp) return { ok: false, status: 502, json: async () => ({ error: "The university file could not be read." }) };
  if (options.method === "POST") {
    posted.push({ action, body: JSON.parse(options.body) });
    if (reject409) return { ok: false, status: 409, json: async () => ({ error: "Someone else changed this day." }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  }
  return { ok: true, status: 200, json: async () => ({ etag: "v1", data: { students: [{ id: "stu_1", name: "Ana", notes: "" }], shifts: [{ id: "2026-10-01", date: "2026-10-01", first: ["Ali", "", "", ""], second: ["", "", "", ""], event: "" }], handover: [] } }) };
};

const { staffRequest, flushQueue, subscribeOffline, clearOfflineData } = await import("../src/staff/service.js");
// Object.keys(sessionStorage) is used by clearOfflineData; expose the stored keys.
const keysOf = () => [...store.keys()];

test("when Nextcloud is down, reads come from the tab's copy and everyday edits are queued", async () => {
  let latest = null;
  subscribeOffline((state) => { latest = state; });
  await staffRequest("workspace");
  cloudUp = false;

  const offline = await staffRequest("workspace");
  assert.equal(offline.offline, true);
  assert.equal(offline.data.students[0].name, "Ana");
  assert.equal(latest.offline, true);

  assert.deepEqual(await staffRequest("shifts/day", { csrf: "x", body: { id: "2026-10-01", patch: { s1p2: "Zarina" }, base: { s1p2: "" } } }), { ok: true, queued: true });
  await staffRequest("students/update", { csrf: "x", body: { id: "stu_1", patch: { notes: "Called landlord" }, base: { notes: "" } } });
  assert.equal(latest.queued, 2);
  const withEdits = await staffRequest("workspace");
  assert.deepEqual(withEdits.data.shifts[0].first, ["Ali", "Zarina", "", ""]);
  assert.equal(withEdits.data.students[0].notes, "Called landlord");

  await assert.rejects(staffRequest("settings/save", { csrf: "x", body: { semesterLabel: "X" } }), /could not be read/);

  cloudUp = true;
  await flushQueue("x");
  assert.deepEqual(posted.map((entry) => entry.action), ["shifts/day", "students/update"]);
  assert.equal(latest.queued, 0);
  assert.equal(latest.offline, false);
});

test("a queued edit that clashes with a newer change is dropped and reported, not forced", async () => {
  let latest = null;
  subscribeOffline((state) => { latest = state; });
  cloudUp = false;
  await staffRequest("shifts/day", { csrf: "x", body: { id: "2026-10-01", patch: { s1p1: "Sanaz" }, base: { s1p1: "" } } });
  cloudUp = true;
  reject409 = true;
  await flushQueue("x");
  reject409 = false;
  assert.equal(latest.queued, 0);
  assert.deepEqual(latest.conflicts, ["Someone else changed this day."]);
});

test("signing out removes the offline copy and the queue from the tab", async () => {
  cloudUp = false;
  await staffRequest("handover", { csrf: "x", body: { note: "Printer is empty" } });
  cloudUp = true;
  assert.ok(keysOf().some((key) => key.startsWith("wl-staff-")));
  clearOfflineData();
  assert.equal(keysOf().filter((key) => key.startsWith("wl-staff-")).length, 0);
});
