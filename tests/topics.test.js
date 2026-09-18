import test from "node:test";
import assert from "node:assert/strict";
import { findTopic } from "../src/services/topics.js";
import { validateContent } from "../shared/content.js";
import onboarding from "../content/app-content/onboarding.json" with { type: "json" };

test("semantic route lookup resolves active topics and leaves invalid/inactive IDs not found", () => {
  const { topics } = validateContent("onboarding", onboarding);
  assert.equal(topics.length, onboarding.topics.filter((topic) => topic.isActive).length);
  assert.deepEqual(
    topics.map((topic) => topic.id),
    [
      "insurance",
      "accommodation",
      "semester-contribution",
      "enrollment",
      "university-portals",
      "city-registration",
      "bank-account",
      "program-tutors",
      "welcome-events",
      "residence-permit",
    ],
  );
  assert.equal(
    findTopic(topics, "enrollment").title,
    "Enrollment & student ID",
  );
  assert.equal(findTopic(topics, "university-portals").relatedPage, "/useful-links");
  assert.equal(findTopic(topics, "semester-ticket"), undefined);
  assert.equal(findTopic(topics, "language-courses"), undefined);
  for (const id of ["missing", "../enrollment", "enrollment.pdf", undefined])
    assert.equal(findTopic(topics, id), undefined);
  assert.equal(
    findTopic([{ ...topics[0], isActive: false }], topics[0].id),
    undefined,
  );
  assert.ok(topics.every((topic) => topic.eyebrow && topic.isDemo));
});

test("topic related pages allow safe app routes and reject external or traversing paths", () => {
  const topic = onboarding.topics.find((item) => item.id === "university-portals");
  assert.equal(validateContent("onboarding", { ...onboarding, topics: [topic] }).topics[0].relatedPage, "/useful-links");
  for (const relatedPage of ["https://example.com", "//example.com", "/../staff", "/journey/../staff"])
    assert.throws(() => validateContent("onboarding", {
      ...onboarding,
      topics: [{ ...topic, relatedPage }],
    }));
});
