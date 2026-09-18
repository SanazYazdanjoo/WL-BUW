import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { useAutosave } from "../src/staff/useAutosave.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { addEventListener() {}, removeEventListener() {} };

function fakeTimers() {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  let now = 0, nextId = 1;
  const timers = new Map();
  globalThis.setTimeout = (fn, delay = 0) => { const id = nextId++; timers.set(id, { fn, at: now + Number(delay) }); return id; };
  globalThis.clearTimeout = (id) => timers.delete(id);
  return {
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, timer] = due; timers.delete(id); now = timer.at;
        await act(async () => { timer.fn(); await Promise.resolve(); await Promise.resolve(); });
      }
      now = end;
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    },
    restore() { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; timers.clear(); },
  };
}

test("autosave debounces several edits into one record patch", async () => {
  const timers = fakeTimers(), calls = [];
  let editor;
  const save = async (patch, base) => { calls.push({ patch, base }); return {}; };
  function Harness() { editor = useAutosave({ title: "Old", text: "Text" }, save); return null; }
  let root;
  try {
    await act(async () => { root = create(React.createElement(Harness)); });
    await act(async () => { editor.setField("title", "New"); editor.setField("text", "New text"); });
    await timers.advance(1999);
    assert.equal(calls.length, 0);
    await timers.advance(1);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { patch: { title: "New", text: "New text" }, base: { title: "Old", text: "Text" } });
    assert.equal(editor.status, "saved");
  } finally { await act(async () => root?.unmount()); timers.restore(); }
});

test("a newer edit made during an in-flight save stays dirty and is sent after it", async () => {
  const timers = fakeTimers(), calls = [];
  let editor, resolveFirst;
  const save = (patch, base) => {
    calls.push({ patch, base });
    if (calls.length === 1) return new Promise((resolve) => { resolveFirst = resolve; });
    return Promise.resolve({});
  };
  function Harness() { editor = useAutosave({ notes: "Before" }, save); return null; }
  let root;
  try {
    await act(async () => { root = create(React.createElement(Harness)); });
    await act(async () => editor.setField("notes", "Version A"));
    await timers.advance(2000);
    assert.equal(calls.length, 1);
    await act(async () => editor.setField("notes", "Version B"));
    await act(async () => { resolveFirst({}); await Promise.resolve(); await Promise.resolve(); });
    assert.equal(editor.draft.notes, "Version B");
    await timers.advance(2000);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], { patch: { notes: "Version B" }, base: { notes: "Version A" } });
    assert.equal(editor.status, "saved");
  } finally { await act(async () => root?.unmount()); timers.restore(); }
});

test("invalid drafts stay local and a failed request can be retried", async () => {
  const timers = fakeTimers();
  let editor, attempts = 0;
  const save = async () => { attempts += 1; if (attempts === 1) throw new Error("Network unavailable"); return {}; };
  function Harness() { editor = useAutosave({ link: "" }, save, { validate: (draft) => draft.link && !/^https:\/\/[^\s]+$/i.test(draft.link) ? "Enter a complete HTTPS link." : "" }); return null; }
  let root;
  try {
    await act(async () => { root = create(React.createElement(Harness)); });
    await act(async () => editor.setField("link", "http://uni-weimar.de"));
    await timers.advance(2000);
    assert.equal(attempts, 0);
    assert.equal(editor.status, "error");
    await act(async () => editor.setField("link", "https://uni-weimar.de"));
    await timers.advance(2000);
    assert.equal(attempts, 1);
    assert.equal(editor.status, "error");
    await act(async () => editor.retry());
    await timers.advance(0);
    assert.equal(attempts, 2);
    assert.equal(editor.status, "saved");
  } finally { await act(async () => root?.unmount()); timers.restore(); }
});
