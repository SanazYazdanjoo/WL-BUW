import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyProgress,
  setCompleted,
  parseProgress,
  readProgress,
  writeProgress,
} from "../src/services/progress.js";

test("completion is idempotent, serializes and survives a storage read before unmarking", () => {
  let stored = null;
  const storage = {
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
  };
  let value = setCompleted(emptyProgress(), "enrollment", true);
  value = setCompleted(value, "enrollment", true);
  assert.deepEqual(value.completed, ["enrollment"]);
  assert.equal(writeProgress(storage, value), true);
  assert.deepEqual(readProgress(storage).value, value);
  assert.deepEqual(
    setCompleted(readProgress(storage).value, "enrollment", false),
    emptyProgress(),
  );
  assert.deepEqual(setCompleted(value, "../private", true), value);
  assert.deepEqual(parseProgress("corrupt"), emptyProgress());
});
