import test from "node:test";
import assert from "node:assert/strict";
import { createContentWorkbookBuffer } from "../scripts/generate-content-workbook.js";
import { ExcelJS } from "../server/excel/excelUtils.js";
import { parseContentWorkbook } from "../server/excel/contentWorkbook.js";

async function activeTemplateWorkbook() {
  const bytes = await createContentWorkbookBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const settings = workbook.getWorksheet("Semester Settings");
  settings.getCell("B2").value = "Winter Semester 2026/27";
  settings.getCell("B3").value = "WiSe2026/27";
  settings.getCell("B4").value = "TRUE";
  settings.getCell("B6").value = "FALSE";
  const first = workbook.getWorksheet("First Steps");
  first.getCell("A2").value = "health-insurance";
  first.getCell("C2").value = "Health insurance";
  first.getCell("D2").value = "Find the relevant information.";
  first.getCell("G2").value = "TRUE";
  first.getCell("H2").value = "Winter Semester 2026/27";
  first.getCell("J2").value = "Private editorial reminder";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("generated editorial workbook parses into public content without internal notes", async () => {
  const result = await parseContentWorkbook(await activeTemplateWorkbook());
  assert.equal(result.semesterLabel, "Winter Semester 2026/27");
  assert.equal(result.content.onboarding.topics.length, 1);
  assert.equal(result.content.onboarding.topics[0].id, "health-insurance");
  assert.equal(result.content.config.semesterCode, "WiSe2026/27");
  assert.equal(result.content.config.whatsappEnabled, false);
  assert.ok(!JSON.stringify(result.content).includes("Private editorial reminder"));
  assert.deepEqual(result.content["community-resources"].resources, []);
});

test("editorial workbook rejects private or unsafe URLs instead of rewriting them", async () => {
  const bytes = await activeTemplateWorkbook();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const first = workbook.getWorksheet("First Steps");
  first.getCell("E2").value = "https://[fd00::1]/internal";
  await assert.rejects(
    parseContentWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())),
    /public website/,
  );
});
