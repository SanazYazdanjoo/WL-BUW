import test from "node:test";
import assert from "node:assert/strict";
import { ExcelJS } from "../server/excel/excelUtils.js";
import { createUnifiedWorkbook, createUnifiedWorkbookTemplate, parseUnifiedWorkbook, publicContentFromWorkbook, SHEETS } from "../server/excel/unifiedWorkbook.js";
async function loadWorkbook(bytes) { const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes); return book; }

const settings = { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false };
async function workbookBytes(content = []) {
  return Buffer.from(await createUnifiedWorkbook({ settings, content }).xlsx.writeBuffer());
}

test("unified template contains only the six simple workbook sheets and inactive examples", async () => {
  const bytes = await createUnifiedWorkbookTemplate();
  const parsed = await loadWorkbook(bytes);
  assert.deepEqual(parsed.worksheets.map((sheet) => sheet.name), SHEETS);
  const content = parsed.getWorksheet("Content");
  assert.deepEqual(content.getRow(3).values.slice(1), ["Section", "Order", "Title", "Text", "Link", "Active", "ID"]);
  assert.ok([4, 5, 6, 7, 8].every((row) => content.getCell(row, 6).value === false));
  assert.equal(parsed.getWorksheet("Students").getRow(4).getCell(3).value, null);
});

test("parser locates headers, preserves supplied IDs, assigns stable IDs to blank rows and maps only active content", async () => {
  const bytes = await workbookBytes([
    { id: "health-insurance", section: "First Step", order: 1, title: "Health insurance", text: "Check requirements before enrolment.", link: "https://www.uni-weimar.de/en/university/", active: true },
    { id: "", section: "Useful Info", order: 1, title: "University portals", text: "Open the university services.", link: "https://www.uni-weimar.de/en/university/", active: true },
    { id: "inactive-item", section: "Community", order: 1, title: "Inactive sample", text: "Not published.", link: "https://example.org/", active: false },
  ]);
  const book = await loadWorkbook(bytes);
  const settingsSheet = book.getWorksheet("Settings");
  settingsSheet.spliceRows(1, 0, ["Welcome Lounge workbook"], ["Update settings and rows through the staff app."]);
  const contentSheet = book.getWorksheet("Content");
  contentSheet.spliceRows(1, 0, ["Student-facing information"], ["One row per item."]);
  const parsed = await parseUnifiedWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
  assert.equal(parsed.data.content[0].id, "health-insurance");
  assert.equal(parsed.data.content[1].id, "university-portals");
  assert.deepEqual(parsed.idAssignments.map(({ id }) => id), ["university-portals"]);
  assert.equal(parsed.data.content[2].active, false);
  const publicContent = publicContentFromWorkbook(parsed, {});
  assert.deepEqual(publicContent.onboarding.topics.map(({ id }) => id), ["health-insurance"]);
  assert.deepEqual(publicContent["useful-links"].links.map(({ id }) => id), ["university-portals"]);
  assert.equal(JSON.stringify(publicContent).includes("Students"), false);
});

test("blank content IDs are unique and active First Step links outside BUW are warned without rewriting", async () => {
  const parsed = await parseUnifiedWorkbook(await workbookBytes([
    { section: "First Step", order: 1, title: "Accommodation", text: "Find housing information.", link: "https://example.org/housing", active: true },
    { section: "First Step", order: 2, title: "Accommodation", text: "Second accommodation item.", link: "", active: true },
  ]));
  assert.deepEqual(parsed.data.content.map(({ id }) => id), ["accommodation", "accommodation-2"]);
  assert.equal(parsed.data.content[0].link, "https://example.org/housing");
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0], /outside the university domain/);
  assert.equal(publicContentFromWorkbook(parsed).onboarding.topics[0].officialSource, "https://example.org/housing");
});

test("parser rejects an unknown section, duplicate IDs and enabled WhatsApp without a valid invite", async () => {
  const unknown = await loadWorkbook(await workbookBytes([{ id: "known", section: "Bogus", order: 1, title: "Bad", text: "Bad section", active: false }]));
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await unknown.xlsx.writeBuffer())), /choose First Step/);
  const duplicate = await loadWorkbook(await workbookBytes([
    { id: "same-id", section: "Useful Info", order: 1, title: "One", text: "One", active: false },
    { id: "same-id", section: "Community", order: 1, title: "Two", text: "Two", active: false },
  ]));
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await duplicate.xlsx.writeBuffer())), /duplicate ID/);
  const noInvite = await loadWorkbook(await workbookBytes());
  const settingsSheet = noInvite.getWorksheet("Settings");
  for (let row = 1; row <= settingsSheet.rowCount; row++) {
    if (settingsSheet.getCell(row, 1).value === "WhatsApp Group URL") settingsSheet.getCell(row, 2).value = "https://example.org/";
    if (settingsSheet.getCell(row, 1).value === "WhatsApp Enabled") settingsSheet.getCell(row, 2).value = true;
  }
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await noInvite.xlsx.writeBuffer())), /valid chat\.whatsapp\.com/);
});

test("parser rejects incomplete workbook structures and invalid links or orders", async () => {
  const bytes = await workbookBytes();
  const missing = await loadWorkbook(bytes);
  missing.removeWorksheet(missing.getWorksheet("Activity").id);
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await missing.xlsx.writeBuffer())), /exactly these sheets/);
  const bad = await loadWorkbook(await workbookBytes([{ id: "bad", section: "Useful Info", order: 0, title: "Bad", text: "Text", link: "javascript:alert(1)", active: false }]));
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await bad.xlsx.writeBuffer())), /positive whole number/);
  const unsafe = await loadWorkbook(await workbookBytes([{ id: "bad", section: "Useful Info", order: 1, title: "Bad", text: "Text", link: "javascript:alert(1)", active: false }]));
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await unsafe.xlsx.writeBuffer())), /public HTTPS link/);
});
