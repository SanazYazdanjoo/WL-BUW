import { randomUUID } from "node:crypto";

// Who is working right now, and who signed in when. Both live in private JSON files next to
// accounts.json, never in the Excel workbook. Neither may ever block the work itself.
export const ONLINE_WINDOW = 3 * 60 * 1000; // seen within the last 3 minutes = online
const PING_WRITE_GAP = 45 * 1000; // a heartbeat rewrites the file at most this often per person
const HISTORY_LIMIT = 1000;
const EVENTS = new Set(["sign-in", "failed", "name", "sign-out"]);
const clip = (value, length) => String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, length);

export function createPresenceStore(store, now = () => Date.now()) {
  // Conditional write with a couple of retries: several people ping and sign in at once.
  async function update(path, change) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const file = await store.readJson(path);
      const next = change(file.value);
      if (!next) return;
      try {
        await store.writeJson(path, next, file.etag);
        return;
      } catch (error) {
        if (error.status !== 409 || attempt === 2) throw error;
      }
    }
  }
  const people = (value) => (value && typeof value.people === "object" && !Array.isArray(value.people) ? value.people : {});
  const onlineFrom = (value) => Object.entries(people(value))
    .filter(([, person]) => now() - Date.parse(person.lastSeen) < ONLINE_WINDOW)
    .map(([staffId, person]) => ({ staffId, name: person.name, role: person.role, since: person.since }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  return {
    async online() {
      return onlineFrom((await store.readJson(store.paths.presence)).value);
    },
    // Heartbeat from an open workspace tab. Returns everyone online, including this person.
    async ping(actor) {
      if (!actor.staffId) return this.online();
      let latest = null;
      await update(store.paths.presence, (value) => {
        const current = people(value), mine = current[actor.staffId];
        const at = new Date(now()).toISOString();
        latest = value;
        if (mine && mine.name === actor.name && now() - Date.parse(mine.lastSeen) < PING_WRITE_GAP) return null;
        // Drop people not seen for a day so the file stays small.
        const kept = Object.fromEntries(Object.entries(current).filter(([, person]) => now() - Date.parse(person.lastSeen) < 24 * 60 * 60 * 1000));
        const since = mine && now() - Date.parse(mine.lastSeen) < ONLINE_WINDOW ? mine.since : at;
        latest = { version: 1, people: { ...kept, [actor.staffId]: { name: clip(actor.name, 100), role: actor.role, lastSeen: at, since } } };
        return latest;
      });
      return onlineFrom(latest);
    },
    async leave(actor) {
      if (!actor.staffId) return;
      await update(store.paths.presence, (value) => {
        const current = people(value);
        if (!current[actor.staffId]) return null;
        return { version: 1, people: Object.fromEntries(Object.entries(current).filter(([staffId]) => staffId !== actor.staffId)) };
      });
    },
    // event: "sign-in" | "failed" | "name" (chose a name after a shared login) | "sign-out".
    async record(event, { name = "", role = "", login = "", method = "" } = {}) {
      if (!EVENTS.has(event)) return;
      const entry = { id: randomUUID(), at: new Date(now()).toISOString(), event, name: clip(name, 100), role: clip(role, 20), login: clip(login, 100), method: clip(method, 20) };
      await update(store.paths.loginHistory, (value) => {
        const entries = Array.isArray(value?.entries) ? value.entries : [];
        return { version: 1, entries: [entry, ...entries].slice(0, HISTORY_LIMIT) };
      });
    },
    async history() {
      const entries = (await store.readJson(store.paths.loginHistory)).value?.entries;
      return Array.isArray(entries) ? entries : [];
    },
  };
}
