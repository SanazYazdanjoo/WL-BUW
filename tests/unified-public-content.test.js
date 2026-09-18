import test from "node:test";
import assert from "node:assert/strict";
import { createUnifiedWorkbook } from "../server/excel/unifiedWorkbook.js";
import { loadContentBundle } from "../server/content.js";

async function bytes(title) {
  return Buffer.from(await createUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    content: [{ id: "health-insurance", section: "First Step", order: 1, title, text: "Review the current requirements.", link: "https://www.uni-weimar.de/en/university/", active: true }],
    students: [{ id: "stu_12345678-1234-4234-8234-123456789abc", legacyDate: "2026-09-18", name: "Private Student Name", matriculationNumber: "00123456", country: "Private Country", studyProgram: "Private programme", enrolled: false, accommodation: "", address: "Private address", receivedBackpack: null, cityRegistration: "", notes: "Private note" }],
  }).xlsx.writeBuffer());
}

test("public bundle refreshes by workbook ETag and never serializes private sheets", async () => {
  const env = { NEXTCLOUD_USERNAME: "public-test", NEXTCLOUD_APP_PASSWORD: "synthetic", NEXTCLOUD_BASE_URL: "https://workbook-public-test.example", NEXTCLOUD_ROOT_FOLDER: `/test-${Date.now()}`, NEXTCLOUD_WORKBOOK_FILE: "Welcome-Lounge.xlsx" };
  const v1 = await bytes("Health insurance");
  const v2 = await bytes("Health cover");
  let current = v1, currentTag = '"workbook-v1"', workbookReads = 0, conditional = "";
  const fetchImpl = async (url, options) => {
    if (String(url).endsWith("/Welcome-Lounge.xlsx")) {
      workbookReads++;
      conditional = options.headers["If-None-Match"] || "";
      if (conditional === currentTag) return new Response(null, { status: 304 });
      return new Response(current, { status: 200, headers: { etag: currentTag, "last-modified": "Fri, 18 Sep 2026 10:00:00 GMT" } });
    }
    return new Response(null, { status: 404 });
  };
  const first = await loadContentBundle(env, fetchImpl);
  assert.equal(first.data.onboarding.topics[0].title, "Health insurance");
  assert.equal(first.data.config.semesterLabel, "Winter Semester 2026/27");
  assert.equal(JSON.stringify(first).includes("Private Student Name"), false);
  assert.equal(JSON.stringify(first).includes("00123456"), false);
  const second = await loadContentBundle(env, fetchImpl);
  assert.equal(second.data.onboarding.topics[0].title, "Health insurance");
  assert.equal(conditional, '"workbook-v1"');
  current = v2; currentTag = '"workbook-v2"';
  const refreshed = await loadContentBundle(env, fetchImpl);
  assert.equal(refreshed.data.onboarding.topics[0].title, "Health cover");
  assert.equal(workbookReads, 3);
});
