import test from "node:test";
import assert from "node:assert/strict";
import { findTopic } from "../src/services/topics.js";
import { validateContent } from "../shared/content.js";
import onboarding from "../content/app-content/onboarding.json" with { type: "json" };

test("semantic route lookup resolves active topics and leaves invalid/inactive IDs not found", () => {
  const { topics } = validateContent("onboarding", onboarding);
  assert.equal(topics.length, 7);
  assert.equal(
    findTopic(topics, "enrollment").title,
    "Enrollment & student ID",
  );
  for (const id of ["missing", "../enrollment", "enrollment.pdf", undefined])
    assert.equal(findTopic(topics, id), undefined);
  assert.equal(
    findTopic([{ ...topics[0], isActive: false }], topics[0].id),
    undefined,
  );
  assert.ok(topics.every((topic) => topic.eyebrow && topic.isDemo));
});
