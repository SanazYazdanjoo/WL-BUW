import test from "node:test";
import assert from "node:assert/strict";
import {
  arrangeJourneyTopics,
  findNextJourneyTopic,
} from "../src/services/journeyLayout.js";

const topics = (count) =>
  Array.from({ length: count }, (_, index) => ({ id: `step-${index + 1}` }));

test("journey layout groups any topic count into alternating serpentine rows", () => {
  for (const count of [0, 1, 2, 5, 7, 10, 12]) {
    const arranged = arrangeJourneyTopics(topics(count), 3);
    assert.equal(arranged.length, count);
    assert.deepEqual(arranged.map((item) => item.index), Array.from({ length: count }, (_, i) => i));
    assert.ok(arranged.every((item) => item.column >= 0 && item.column < 3));
  }
  assert.deepEqual(
    arrangeJourneyTopics(topics(7), 3).map(({ row, column }) => [row, column]),
    [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0], [2, 0]],
  );
  assert.deepEqual(
    arrangeJourneyTopics(topics(5), 2).map(({ row, column }) => [row, column]),
    [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0]],
  );
  assert.deepEqual(arrangeJourneyTopics(topics(3), 0).map((item) => item.row), [0, 1, 2]);
});

test("next incomplete topic follows semantic topic order and is absent when all are done", () => {
  const list = topics(7);
  assert.equal(findNextJourneyTopic(list, []).id, "step-1");
  assert.equal(findNextJourneyTopic(list, ["step-1", "step-2"]).id, "step-3");
  assert.equal(findNextJourneyTopic(list, list.map((topic) => topic.id)), undefined);
});
