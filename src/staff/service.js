// Staff API client with an offline fallback for when the university's Nextcloud is unreachable:
// - successful reads of CACHED_READS are kept in sessionStorage (this tab only; cleared on sign-out)
//   and served back, marked offline, when the server can't reach Nextcloud;
// - everyday edits (QUEUED_WRITES) are queued in order and replayed once the connection is back,
//   through the server's normal conflict checks.
const CACHED_READS = new Set(["workspace", "events", "roster", "session"]);
const QUEUED_WRITES = new Set(["students/update", "students/create", "shifts/day", "handover", "events/autosave", "feedback/send"]);
const CACHE_PREFIX = "wl-staff-cache:";
const QUEUE_KEY = "wl-staff-queue";
const listeners = new Set();
const status = { offline: false, since: "", queued: 0, conflicts: [] };

const storage = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } },
  remove(key) { try { sessionStorage.removeItem(key); } catch { /* storage blocked */ } },
};
const readQueue = () => storage.get(QUEUE_KEY) || [];
const writeQueue = (queue) => { storage.set(QUEUE_KEY, queue); setStatus({ queued: queue.length }); };

function setStatus(patch) {
  Object.assign(status, patch);
  for (const listener of listeners) listener({ ...status });
}
export function subscribeOffline(listener) {
  listeners.add(listener);
  listener({ ...status, queued: readQueue().length });
  return () => listeners.delete(listener);
}
export function dismissConflicts() { setStatus({ conflicts: [] }); }

// Cloud trouble = no response at all, or the server saying Nextcloud failed (5xx). Not a validation error.
const isCloudFailure = (error) => !error.status || error.status >= 500;

async function send(action, { csrf, body, signal } = {}) {
  const response = await fetch(`/api/staff/${action}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Token": csrf || "" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let value;
  try {
    value = await response.json();
  } catch {
    const error = new Error("The staff service is unavailable. Please retry.");
    error.status = response.status >= 500 ? response.status : 503;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(
      value.error || "The staff action could not be completed.",
    );
    error.status = response.status;
    error.code = value.code;
    error.fields = value.fields;
    error.latest = value.latest;
    throw error;
  }
  return value;
}

export async function staffRequest(action, options = {}) {
  const isRead = options.body === undefined;
  try {
    const value = await send(action, options);
    if (isRead && CACHED_READS.has(action)) storage.set(CACHE_PREFIX + action, { value, at: new Date().toISOString() });
    if (status.offline) { setStatus({ offline: false, since: "" }); flushQueue(options.csrf); }
    return value;
  } catch (error) {
    if (error.name === "AbortError" || !isCloudFailure(error)) throw error;
    if (isRead && CACHED_READS.has(action)) {
      const cached = storage.get(CACHE_PREFIX + action);
      if (cached) {
        setStatus({ offline: true, since: cached.at });
        const value = action === "workspace" ? withQueuedEdits(cached.value) : cached.value;
        return { ...value, offline: true, cachedAt: cached.at };
      }
    }
    if (!isRead && QUEUED_WRITES.has(action)) {
      writeQueue([...readQueue(), { action, body: options.body, at: new Date().toISOString() }]);
      setStatus({ offline: true, since: status.since || new Date().toISOString() });
      scheduleFlush(options.csrf);
      return { ok: true, queued: true };
    }
    setStatus({ offline: true, since: status.since || new Date().toISOString() });
    throw error;
  }
}

// Show queued (not yet saved) edits on top of the offline copy, so nothing seems to disappear.
function withQueuedEdits(workspace) {
  const next = structuredClone(workspace);
  const data = next.data || {};
  for (const { action, body, at } of readQueue()) {
    if (action === "shifts/day") {
      let day = (data.shifts || []).find((entry) => entry.date === body.id);
      if (!day) { day = { id: body.id, date: body.id, first: ["", "", "", ""], second: ["", "", "", ""], event: "" }; (data.shifts ||= []).push(day); }
      for (const [field, value] of Object.entries(body.patch || {})) {
        if (field === "note") day.event = value;
        else { const [, slot, person] = field.match(/^s([12])p([1-4])$/) || []; if (slot) day[slot === "1" ? "first" : "second"][Number(person) - 1] = value; }
      }
    } else if (action === "students/update") {
      const student = (data.students || []).find((entry) => entry.id === body.id);
      if (student) Object.assign(student, body.patch || {});
    } else if (action === "students/create") {
      (data.students ||= []).push({ ...body, id: `pending-${at}`, legacyDate: at.slice(0, 10), addedBy: "Not saved yet", etag: undefined });
    } else if (action === "handover") {
      (data.handover ||= []).push({ id: `pending-${at}`, date: at.slice(0, 10), timestamp: at, author: "Not saved yet", note: body.note });
    }
  }
  return next;
}

let flushing = false, timer = null, lastCsrf = "";
function scheduleFlush(csrf) {
  if (csrf) lastCsrf = csrf;
  clearTimeout(timer);
  timer = setTimeout(() => flushQueue(lastCsrf), 15000);
}
// Replays queued edits in order. Stops at the first cloud failure; drops and reports conflicts.
export async function flushQueue(csrf = lastCsrf) {
  if (csrf) lastCsrf = csrf;
  if (flushing) return;
  const queue = readQueue();
  if (!queue.length) return;
  flushing = true;
  try {
    while (readQueue().length) {
      const [next, ...rest] = readQueue();
      try {
        await send(next.action, { csrf: lastCsrf, body: next.body });
        writeQueue(rest);
      } catch (error) {
        if (isCloudFailure(error)) { setStatus({ offline: true }); scheduleFlush(); return; }
        writeQueue(rest);
        setStatus({ conflicts: [...status.conflicts, error.message] });
      }
    }
    setStatus({ offline: false, since: "" });
    window.dispatchEvent(new Event("staff-queue-flushed"));
  } finally {
    flushing = false;
  }
}

// Sign-out: remove every cached copy and queued edit from this tab.
export function clearOfflineData() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) keys.push(sessionStorage.key(i));
    for (const key of keys) if (key && (key.startsWith(CACHE_PREFIX) || key === QUEUE_KEY)) sessionStorage.removeItem(key);
  } catch { /* storage blocked */ }
  setStatus({ offline: false, since: "", queued: 0, conflicts: [] });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => flushQueue());
  setTimeout(() => { if (readQueue().length) scheduleFlush(); }, 0);
}
