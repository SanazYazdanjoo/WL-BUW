import { contentFixture, masterFixture } from "./helpers/workbooks.js";
import test from "node:test";
import assert from "node:assert/strict";
import { cellText, dateValue } from "../server/excel/excelUtils.js";
import { parseContentWorkbook } from "../server/excel/contentWorkbook.js";
import {
  parseMasterExcel,
  exportMasterExcel,
  createMasterExcelSampleBuffer,
  shiftSummary,
} from "../server/excel/masterExcel.js";
test("editorial workbook preserves variable-count source text, items, directories and review warnings", async () => {
  for (const count of [5, 10, 12]) {
    const r = await parseContentWorkbook(
      await contentFixture(count),
      "Winter Semester 2026/27",
    );
    assert.equal(r.content.onboarding.topics.length, count);
    assert.equal(
      r.content.onboarding.topics[0].description,
      "Original instruction 1\nSecond paragraph.",
    );
    assert.deepEqual(r.content.onboarding.topics[0].requiredItems, [
      "Identity document",
      "Photo",
    ]);
    assert.deepEqual(r.content.onboarding.topics[0].documents, []);
    assert.ok(r.warnings.some((w) => w.startsWith("Semester mismatch")));
    assert.equal(
      r.content["health-insurance"].providers[0].openingHours.tuesday,
      "Closed",
    );
    assert.equal(
      r.content["useful-links"].links[0].url,
      "https://example.org/",
    );
    assert.equal(r.content.rundfunk.sections.length, 1);
  }
});
test("editorial errors do not contain source cell data", async () => {
  for (const edit of [
    (w) => w.removeWorksheet("first steps"),
    (w) => (w.getWorksheet("first steps").getCell("A1").value = ""),
    (w) => (w.getWorksheet("first steps").getCell("A5").value = 1),
    (w) => (w.getWorksheet("first steps").getCell("C3").value = ""),
    (w) =>
      (w.getWorksheet("student portal Links").getCell("B2").value =
        "javascript:alert(1)"),
    (w) =>
      (w.getWorksheet("first steps").getCell("C3").value = "x".repeat(12001)),
  ])
    await assert.rejects(parseContentWorkbook(await contentFixture(3, edit)));
  const result = await parseContentWorkbook(
    await contentFixture(3, (w) => {
      w.addWorksheet("Extra");
      w.getWorksheet("first steps").getCell("A7").value = 8;
    }),
  );
  assert.ok(result.warnings.some((w) => w.includes("gaps")));
  assert.ok(result.warnings.some((w) => w.includes("Extra sheet")));
});
test("editorial prose cannot be mistaken for a worksheet column header", async () => {
  const result = await parseContentWorkbook(
    await contentFixture(2, (workbook) => {
      workbook.getWorksheet("first steps").getCell("C3").value =
        "Title: this is source text, not a second column.\nThe required documents are listed below.";
    }),
  );
  assert.match(result.content.onboarding.topics[0].description, /^Title:/);
  assert.equal(result.content.onboarding.topics[0].title, "Synthetic step 1");
  assert.deepEqual(result.content.onboarding.topics[0].requiredItems, [
    "Identity document",
    "Photo",
  ]);
});
test("MasterExcel ignores empty FALSE rows, preserves IDs and derives correct totals and export", async () => {
  const r = await parseMasterExcel(await masterFixture());
  assert.equal(r.students.length, 1);
  assert.equal(r.students[0].matriculationNumber, "001234");
  assert.equal(r.students[0].legacyDate, "2026-03-23");
  assert.equal(r.programTutors[0].phone, "001234");
  assert.equal(r.summary[0].total, 2);
  assert.equal(r.shifts[0].event, "Event\nSecond line");
  assert.ok(r.warnings.length);
  const exported = await exportMasterExcel(r);
  const again = await parseMasterExcel(exported);
  assert.equal(again.students[0].name, r.students[0].name);
  assert.deepEqual(shiftSummary(again.shifts), r.summary);
});
test("MasterExcel sample workbook documents its format and sample rows never import", async () => {
  const bytes = await createMasterExcelSampleBuffer();
  const parsed = await parseMasterExcel(bytes);
  assert.deepEqual(parsed.students, []);
  assert.deepEqual(parsed.programTutors, []);
  assert.deepEqual(parsed.shifts, []);
  assert.deepEqual(parsed.summary, []);
});
test("MasterExcel missing IDs remain unknown and numeric cell values are safely represented", async () => {
  const r = await parseMasterExcel(
    await masterFixture((w) => {
      w.getWorksheet("Students_List").getCell("C2").value = 1234;
      w.getWorksheet("Students_List").getCell("F2").value = null;
    }),
  );
  assert.equal(r.students[0].matriculationNumber, "1234");
  assert.equal(r.students[0].enrolled, null);
  const missing = await parseMasterExcel(
    await masterFixture(
      (w) => (w.getWorksheet("Students_List").getCell("C2").value = ""),
    ),
  );
  assert.equal(missing.students[0].matriculationNumber, "");
  assert.ok(missing.warnings.some((w) => w.includes("matriculation")));
  await assert.rejects(
    parseMasterExcel(
      await masterFixture((w) => w.removeWorksheet("Program_Tutors")),
    ),
  );
  assert.equal(
    cellText({ richText: [{ text: "one" }, { text: "two" }] }),
    "onetwo",
  );
  assert.equal(dateValue(46104), "2026-03-23");
});
