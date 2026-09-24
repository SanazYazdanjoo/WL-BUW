import test from "node:test";
import assert from "node:assert/strict";
import { ExcelJS } from "../server/excel/excelUtils.js";
import { createUnifiedWorkbook, createUnifiedWorkbookTemplate, parseUnifiedWorkbook, publicContentFromWorkbook, SHEETS } from "../server/excel/unifiedWorkbook.js";
async function loadWorkbook(bytes) { const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes); return book; }

const settings = { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false };
async function workbookBytes(content = []) {
  return Buffer.from(await createUnifiedWorkbook({ settings, content }).xlsx.writeBuffer());
}

test("unified template contains the workbook sheets, including Events, and inactive examples", async () => {
  const bytes = await createUnifiedWorkbookTemplate();
  const parsed = await loadWorkbook(bytes);
  assert.deepEqual(parsed.worksheets.map((sheet) => sheet.name), ["Settings", "Content", "Events", "Students", "Activity", "Staff", "Shifts", "Tutors"]);
  assert.ok(SHEETS.every((name) => parsed.getWorksheet(name)));
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

test("student contact fields round-trip and older workbooks without them remain readable", async () => {
  const student = { id: "stu_12345678-1234-4234-8234-123456789abc", name: "Example Student", country: "Germany", studyProgram: "European Urban Studies", phone: "+49 123 456", email: "student@example.org", notes: "Call after arrival" };
  const current = await loadWorkbook(Buffer.from(await createUnifiedWorkbook({ settings, students: [student] }).xlsx.writeBuffer()));
  const parsed = await parseUnifiedWorkbook(Buffer.from(await current.xlsx.writeBuffer()));
  assert.equal(parsed.data.students[0].phone, student.phone);
  assert.equal(parsed.data.students[0].email, student.email);
  assert.equal(parsed.data.students[0].notes, student.notes);

  const legacySheet = current.getWorksheet("Students");
  legacySheet.spliceColumns(13, 2);
  const legacy = await parseUnifiedWorkbook(Buffer.from(await current.xlsx.writeBuffer()));
  assert.equal(legacy.data.students[0].name, student.name);
  assert.equal(legacy.data.students[0].notes, student.notes);
  assert.equal(legacy.data.students[0].phone, "");
  assert.equal(legacy.data.students[0].email, "");
  const upgradedBytes = Buffer.from(await createUnifiedWorkbook(legacy.data).xlsx.writeBuffer());
  const upgraded = await parseUnifiedWorkbook(upgradedBytes);
  assert.equal(upgraded.data.students[0].studyProgram, student.studyProgram);
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
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await missing.xlsx.writeBuffer())), /must contain these sheets/);
  const bad = await loadWorkbook(await workbookBytes([{ id: "bad", section: "Useful Info", order: 0, title: "Bad", text: "Text", link: "javascript:alert(1)", active: false }]));
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await bad.xlsx.writeBuffer())), /positive whole number/);
  const unsafe = await loadWorkbook(await workbookBytes([{ id: "bad", section: "Useful Info", order: 1, title: "Bad", text: "Text", link: "javascript:alert(1)", active: false }]));
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await unsafe.xlsx.writeBuffer())), /public HTTPS link/);
});

test("Events tab is optional and maps active events with Excel time formats", async () => {
  const withoutEvents = await loadWorkbook(await workbookBytes());
  withoutEvents.removeWorksheet(withoutEvents.getWorksheet("Events").id);
  const legacy = await parseUnifiedWorkbook(Buffer.from(await withoutEvents.xlsx.writeBuffer()));
  assert.equal(legacy.data.events, null);
  assert.equal(publicContentFromWorkbook(legacy, {}).events, undefined);

  const book = await loadWorkbook(await workbookBytes());
  const sheet = book.getWorksheet("Events");
  sheet.addRow(["Welcome brunch", "2026-10-05", "10:30", "12:00", "Mensa", "Meet other new students.", "https://www.uni-weimar.de/en/university/", true, ""]);
  sheet.addRow(["City tour", new Date(Date.UTC(2026, 9, 2)), new Date(Date.UTC(1899, 11, 30, 14, 0)), 0.75, "", "", "", "TRUE", "city-tour"]);
  sheet.addRow(["Draft party", "2026-10-09", "", "", "", "", "", false, ""]);
  const parsed = await parseUnifiedWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
  assert.deepEqual(parsed.data.events.map(({ id, date, startTime, endTime }) => [id, date, startTime, endTime]), [
    ["event-2026-10-05-welcome-brunch", "2026-10-05", "10:30", "12:00"],
    ["city-tour", "2026-10-02", "14:00", "18:00"],
    ["event-2026-10-09-draft-party", "2026-10-09", "", ""],
  ]);
  const events = publicContentFromWorkbook(parsed, {}).events.events;
  assert.deepEqual(events.map(({ id }) => id), ["city-tour", "event-2026-10-05-welcome-brunch"]);
  assert.equal(events[1].description, "Meet other new students.");

  const bad = await loadWorkbook(await workbookBytes());
  bad.getWorksheet("Events").addRow(["Late", "2026-10-05", "18:00", "17:00", "", "", "", true, ""]);
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await bad.xlsx.writeBuffer())), /End must be after Start/);
});

test("Shifts tab uses one row per day and converts the old one-row-per-shift layout", async () => {
  const book = await loadWorkbook(Buffer.from(await createUnifiedWorkbook({ settings, shifts: [{ date: "2026-10-02", first: ["Ehsan", "Ali"], second: ["Zarina", "Darina", "Ali", "Sanaz"], event: "" }] }).xlsx.writeBuffer()));
  const sheet = book.getWorksheet("Shifts");
  assert.deepEqual(sheet.getRow(3).values.slice(1), ["Date", "S1 - Person 1", "S1 - Person 2", "S1 - Person 3", "S1 - Person 4", "S2 - Person 1", "S2 - Person 2", "S2 - Person 3", "S2 - Person 4", "Note"]);
  sheet.addRow(["2026-10-03", "", "", "", "", "", "", "", "", "Bank Holiday"]);
  const parsed = await parseUnifiedWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
  assert.deepEqual(parsed.data.shifts.map(({ date, first, second, event }) => [date, first, second, event]), [
    ["2026-10-02", ["Ehsan", "Ali", "", ""], ["Zarina", "Darina", "Ali", "Sanaz"], ""],
    ["2026-10-03", ["", "", "", ""], ["", "", "", ""], "Bank Holiday"],
  ]);
  assert.deepEqual(parsed.data.shiftTimes, { first: "10:00–13:00", second: "12:00–15:00" });

  const legacy = await loadWorkbook(Buffer.from(await createUnifiedWorkbook({ settings }).xlsx.writeBuffer()));
  const old = legacy.getWorksheet("Shifts");
  old.spliceRows(3, 1, ["ID", "Date", "Start", "End", "Tutor 1", "Tutor 2", "Tutor 3", "Important Event", "Notes"]);
  old.addRow(["shift_1", "2026-09-15", "10:00", "13:00", "Sanaz", "Ali", "", "", ""]);
  old.addRow(["shift_2", "2026-09-15", "12:00", "15:00", "Nayeem", "Daniel", "", "Welcome party", ""]);
  const converted = await parseUnifiedWorkbook(Buffer.from(await legacy.xlsx.writeBuffer()));
  assert.deepEqual(converted.data.shifts.map(({ first, second, event }) => [first, second, event]), [[["Sanaz", "Ali", "", ""], ["Nayeem", "Daniel", "", ""], "Welcome party"]]);
});

test("Tutors tab has ten named slots and Settings holds the schedule period", async () => {
  const book = await loadWorkbook(Buffer.from(await createUnifiedWorkbook({ settings, tutors: ["Sanaz", "Ali"], schedule: { start: "2026-09-28", end: "2026-10-23" } }).xlsx.writeBuffer()));
  const tutorsSheet = book.getWorksheet("Tutors");
  assert.deepEqual([4, 5, 13].map((row) => tutorsSheet.getRow(row).values.slice(1)), [["Tutor 1", "Sanaz"], ["Tutor 2", "Ali"], ["Tutor 10", ""]]);
  tutorsSheet.getCell(6, 2).value = "Zarina";
  const parsed = await parseUnifiedWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
  assert.deepEqual(parsed.data.tutors.slice(0, 4), ["Sanaz", "Ali", "Zarina", ""]);
  assert.equal(parsed.data.tutors.length, 10);
  assert.deepEqual(parsed.data.schedule, { start: "2026-09-28", end: "2026-10-23" });

  const withoutTab = await loadWorkbook(await workbookBytes());
  withoutTab.removeWorksheet(withoutTab.getWorksheet("Tutors").id);
  assert.deepEqual((await parseUnifiedWorkbook(Buffer.from(await withoutTab.xlsx.writeBuffer()))).data.tutors, Array(10).fill(""));

  const backwards = await loadWorkbook(Buffer.from(await createUnifiedWorkbook({ settings, schedule: { start: "2026-10-23", end: "2026-09-28" } }).xlsx.writeBuffer()));
  await assert.rejects(parseUnifiedWorkbook(Buffer.from(await backwards.xlsx.writeBuffer())), /Schedule End must be on or after/);
});
