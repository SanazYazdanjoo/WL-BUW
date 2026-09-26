import test from "node:test";
import assert from "node:assert/strict";
import { resolveOfficialLink } from "../src/services/officialLink.js";
import sourcesConfig from "../content/app-content/sources.json" with { type: "json" };

test("a workbook step's own link is shown even when its ID has no source mapping", () => {
  const link = resolveOfficialLink(sourcesConfig, {}, { topicId: "health-insurance-for-students", officialUrl: "https://www.uni-weimar.de/en/insurance" });
  assert.deepEqual([link.url, link.directUrl, link.source], ["https://www.uni-weimar.de/en/insurance", "https://www.uni-weimar.de/en/insurance", null]);
});

test("a mapped step without its own link falls back to the configured official source", () => {
  const link = resolveOfficialLink(sourcesConfig, {}, { topicId: "enrollment" });
  assert.ok(link.url.startsWith("https://"));
  assert.equal(link.source.status, "unavailable");
});

test("a step with neither a link nor a mapping shows no official link", () => {
  assert.equal(resolveOfficialLink(sourcesConfig, {}, { topicId: "program-tutors" }), null);
});
