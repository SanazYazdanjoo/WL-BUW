import test from "node:test";
import assert from "node:assert/strict";
import { serializeUnifiedWorkbook, parseUnifiedWorkbook, publicContentFromWorkbook } from "../server/excel/unifiedWorkbook.js";
import { createUnifiedRepository } from "../server/staff/unifiedRepository.js";

function memoryStore(initialBytes) {
  const paths = { unified: "Welcome-Lounge.xlsx", unifiedName: "Welcome-Lounge.xlsx", unifiedBackups: "backups", unifiedBackupStatus: "content-meta/unified-workbook-backup-status.json", master: "staff-data/MasterExcel.xlsx" };
  const files = new Map(initialBytes ? [[paths.unified, { value: initialBytes, etag: '"v1"' }]] : []);
  let counter = 1;
  const conflict = () => Object.assign(new Error("precondition failed"), { status: 409 });
  return {
    paths,
    async read(path) { return files.get(path) ? { ...files.get(path) } : { value: null, etag: null }; },
    async readJson(path) { const file = files.get(path); return file ? { value: JSON.parse(file.value.toString()), etag: file.etag } : { value: null, etag: null }; },
    async writeBytes(path, bytes, etag) {
      const existing = files.get(path);
      if (etag === null ? existing : !existing || existing.etag !== etag) throw conflict();
      const next = { value: Buffer.from(bytes), etag: `"v${++counter}"` };
      files.set(path, next);
      return next.etag;
    },
    async writeJson(path, value, etag) {
      const bytes = Buffer.from(JSON.stringify(value));
      const existing = files.get(path);
      if (etag === null ? existing : !existing || existing.etag !== etag) throw conflict();
      const next = { value: bytes, etag: `"v${++counter}"` };
      files.set(path, next);
      return next.etag;
    },
    files,
  };
}

test("parallel staff edits using one workbook ETag cannot silently overwrite one another", async () => {
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    content: [{ id: "health-insurance", section: "First Step", order: 1, title: "Health insurance", text: "Current text", link: "https://www.uni-weimar.de/en/university/", active: true }],
    staff: [{ id: "staff_12345678-1234-4234-8234-123456789abc", name: "Tutor Example", role: "admin", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "admin", staffId: "staff_12345678-1234-4234-8234-123456789abc" };
  const { etag } = await repo.contentStatus();
  const outcomes = await Promise.allSettled([
    repo.saveContent(actor, { etag, item: { id: "health-insurance", section: "First Step", order: 1, title: "Update A", text: "Text A", link: "https://www.uni-weimar.de/en/university/", active: true } }),
    repo.saveContent(actor, { etag, item: { id: "health-insurance", section: "First Step", order: 1, title: "Update B", text: "Text B", link: "https://www.uni-weimar.de/en/university/", active: true } }),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((result) => result.status === "rejected" && result.reason.status === 409).length, 1);
  const stored = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.ok(["Update A", "Update B"].includes(stored.data.content[0].title));
  assert.ok([...store.files.keys()].some((path) => path.startsWith("backups/manual/")));
});

test("removing a journey step deletes its workbook row and removes the generated topic", async () => {
  const staffId = "staff_12345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    content: [
      { id: "health-insurance", section: "First Step", order: 1, title: "Health insurance", text: "Confirm insurance.", link: "https://www.uni-weimar.de/en/university/", active: true },
      { id: "enrollment", section: "First Step", order: 2, title: "Enrollment", text: "Complete enrollment.", link: "https://www.uni-weimar.de/en/university/", active: true },
    ],
    staff: [{ id: staffId, name: "Tutor Example", role: "admin", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "admin", staffId };
  const current = await repo.contentStatus();
  assert.deepEqual(current.content.onboarding.topics.map((topic) => topic.id), ["health-insurance", "enrollment"]);

  await repo.deleteContent(actor, { id: "health-insurance", etag: current.etag });

  const parsed = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.deepEqual(parsed.data.content.map((item) => item.id), ["enrollment"]);
  assert.deepEqual(publicContentFromWorkbook(parsed).onboarding.topics.map((topic) => topic.id), ["enrollment"]);
});

test("autosaves merge independent student fields and report same-field conflicts", async () => {
  const studentId = "stu_12345678-1234-4234-8234-123456789abc";
  const staffId = "staff_12345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    students: [{ id: studentId, name: "Example Student", accommodation: null, notes: "" }],
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "tutor", staffId };
  const initial = await repo.workspace();
  const results = await Promise.all([
    repo.updateStudent(actor, { id: studentId, etag: initial.etag, patch: { accommodation: true }, base: { accommodation: null } }),
    repo.updateStudent(actor, { id: studentId, etag: initial.etag, patch: { notes: "Needs follow-up" }, base: { notes: "" } }),
  ]);
  assert.equal(results.length, 2);
  let parsed = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.equal(parsed.data.students[0].accommodation, true);
  assert.equal(parsed.data.students[0].notes, "Needs follow-up");
  const etag = (await repo.workspace()).etag;
  const concurrent = await Promise.allSettled([
    repo.updateStudent(actor, { id: studentId, etag, patch: { notes: "Called landlord" }, base: { notes: "Needs follow-up" } }),
    repo.updateStudent(actor, { id: studentId, etag, patch: { notes: "Waiting for response" }, base: { notes: "Needs follow-up" } }),
  ]);
  assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1);
  const conflict = concurrent.find((item) => item.status === "rejected");
  assert.equal(conflict.reason.status, 409);
  assert.equal(conflict.reason.code, "EDIT_CONFLICT");
  assert.deepEqual(conflict.reason.fields, ["notes"]);
  assert.ok(["Called landlord", "Waiting for response"].includes(conflict.reason.latest.notes));
  parsed = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.ok(["Called landlord", "Waiting for response"].includes(parsed.data.students[0].notes));
  assert.equal(parsed.data.activity.filter((item) => item.type === "Student Update").length, 3);
  assert.equal([...store.files.keys()].filter((path) => path.startsWith("backups/daily/")).length, 1);
});

test("a student autosave and check-in racing against one workbook both persist", async () => {
  const studentId = "stu_22345678-1234-4234-8234-123456789abc";
  const staffId = "staff_22345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    students: [{ id: studentId, name: "Example Student", accommodation: null }],
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store), actor = { name: "Tutor Example", role: "tutor", staffId };
  const initial = await repo.workspace();
  await Promise.all([
    repo.updateStudent(actor, { id: studentId, etag: initial.etag, patch: { accommodation: true }, base: { accommodation: null } }),
    repo.checkIn(actor, { id: studentId, etag: initial.etag }),
  ]);
  const parsed = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.equal(parsed.data.students[0].accommodation, true);
  assert.equal(parsed.data.activity.filter((item) => item.type === "Check-in" && item.studentId === studentId).length, 1);
});

test("student creation stores phone, email and note/comment in the private workbook", async () => {
  const staffId = "staff_32345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "tutor", staffId };
  const { etag } = await repo.workspace();
  await repo.addStudent(actor, { etag, name: "New Student", matriculationNumber: "12345", country: "Germany", studyProgram: "European Urban Studies", phone: "+49 123", email: "student@example.org", notes: "Call after arrival" });
  const { data } = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.match(data.students[0].legacyDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.students[0].matriculationNumber, "12345");
  assert.equal(data.students[0].phone, "+49 123");
  assert.equal(data.students[0].email, "student@example.org");
  assert.equal(data.students[0].notes, "Call after arrival");
  const latest = await repo.workspace();
  await assert.rejects(repo.addStudent(actor, { etag: latest.etag, name: "Invalid Email", email: "not-an-email" }), (error) => error.status === 400);
  await assert.rejects(repo.addStudent(actor, { etag: latest.etag, name: "Duplicate Student", matriculationNumber: " 12345 " }), (error) => error.status === 409 && error.message === "A student with this matriculation number already exists.");
});

test("template initialization is explicit, inactive and never overwrites an existing workbook", async () => {
  const store = memoryStore(null);
  const repo = createUnifiedRepository(store);
  await assert.rejects(repo.createFromTemplate({ name: "Coordinator" }, { confirm: true }), /Enter the current semester/);
  await repo.createFromTemplate({ name: "Coordinator" }, { confirm: true, semesterLabel: "Winter Semester 2026/27" });
  const parsed = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.equal(parsed.data.settings.semesterLabel, "Winter Semester 2026/27");
  assert.equal(parsed.data.content.every((item) => item.active === false), true);
  await assert.rejects(repo.createFromTemplate({ name: "Coordinator" }, { confirm: true, semesterLabel: "Summer Semester 2027" }), (error) => error.status === 409);
});

test("staff can add, autosave and remove events stored in the Events tab", async () => {
  const staffId = "staff_12345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    content: [],
    staff: [{ id: staffId, name: "Tutor Example", role: "admin", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "tutor", staffId };
  let status = await repo.listEvents();
  await assert.rejects(repo.saveEvent(actor, { etag: status.etag, event: { title: "Bad", date: "2026-13-45", active: true } }), /valid event date/);
  await repo.saveEvent(actor, { etag: status.etag, event: { title: "Welcome brunch", date: "2026-10-05", startTime: "10:30", endTime: "12:00", location: "Mensa", description: "Meet peers.", link: "", active: true } });
  const [event] = (await repo.listEvents()).events;
  assert.equal(event.id, "event-2026-10-05-welcome-brunch");
  assert.deepEqual((await repo.contentStatus()).content.events.events.map(({ title, startTime }) => [title, startTime]), [["Welcome brunch", "10:30"]]);
  await repo.autosaveEvent(actor, { id: event.id, patch: { location: "Main building" }, base: { location: "Mensa" } });
  await assert.rejects(repo.autosaveEvent(actor, { id: event.id, patch: { endTime: "09:00" }, base: { endTime: "12:00" } }), /after the start time/);
  status = await repo.listEvents();
  assert.equal(status.events[0].location, "Main building");
  await repo.deleteEvent(actor, { id: event.id });
  const stored = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.deepEqual(stored.data.events, []);
  assert.deepEqual(publicContentFromWorkbook(stored, {}).events.events, []);
});

test("staff can correct a student's name, matriculation number and welcome materials", async () => {
  const studentId = "stu_12345678-1234-4234-8234-123456789abc";
  const otherId = "stu_22345678-1234-4234-8234-123456789abc";
  const staffId = "staff_12345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    students: [
      { id: studentId, name: "Exmaple Student", matriculationNumber: "12345", receivedBackpack: null },
      { id: otherId, name: "Other Student", matriculationNumber: "99999" },
    ],
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "tutor", staffId };
  await repo.updateStudent(actor, { id: studentId, patch: { name: "Example Student", matriculationNumber: "012346", receivedBackpack: true }, base: { name: "Exmaple Student", matriculationNumber: "12345", receivedBackpack: null } });
  const [student] = (await parseUnifiedWorkbook(store.files.get(store.paths.unified).value)).data.students;
  assert.deepEqual([student.name, student.matriculationNumber, student.receivedBackpack], ["Example Student", "012346", true]);
  await assert.rejects(repo.updateStudent(actor, { id: studentId, patch: { matriculationNumber: "99999" }, base: { matriculationNumber: "012346" } }), /already has this matriculation number/);
  await assert.rejects(repo.updateStudent(actor, { id: studentId, patch: { name: "  " }, base: { name: "Example Student" } }), /full name/);
});

test("student list checkboxes and accommodation contact round-trip, and old text values count as ticked", async () => {
  const studentId = "stu_12345678-1234-4234-8234-123456789abc";
  const staffId = "staff_12345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    students: [{ id: studentId, name: "Example Student", accommodation: "Student housing, room 12", cityRegistration: "" }],
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "tutor", staffId };
  const [before] = (await repo.workspace()).data.students;
  assert.deepEqual([before.accommodation, before.cityRegistration, before.accommodationContact], [true, null, ""]);
  await repo.updateStudent(actor, { id: studentId, patch: { accommodation: false, accommodationContact: "+49 123 456", cityRegistration: true }, base: { accommodation: true, accommodationContact: "", cityRegistration: null } });
  const [after] = (await parseUnifiedWorkbook(store.files.get(store.paths.unified).value)).data.students;
  assert.deepEqual([after.accommodation, after.cityRegistration, after.accommodationContact], [false, true, "+49 123 456"]);
  await assert.rejects(repo.updateStudent(actor, { id: studentId, patch: { cityRegistration: "maybe" }, base: { cityRegistration: true } }), /Yes, No or Unknown/);
});

test("any staff member can edit the shift grid and every change is logged", async () => {
  const staffId = "staff_12345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    shifts: [{ date: "2026-10-01", first: ["Sanaz", "Ali"], second: ["Daniel"], event: "" }],
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "tutor", staffId };
  await repo.updateShiftDay(actor, { id: "2026-10-01", patch: { s1p3: "Zarina", s2p1: "Nayeem" }, base: { s1p3: "", s2p1: "Daniel" } });
  await repo.updateShiftDay(actor, { id: "2026-10-03", patch: { note: "Bank Holiday" }, base: { note: "" } });
  const workspace = await repo.workspace();
  const day = workspace.data.shifts.find((entry) => entry.date === "2026-10-01");
  assert.deepEqual([day.first, day.second], [["Sanaz", "Ali", "Zarina", ""], ["Nayeem", "", "", ""]]);
  assert.equal(workspace.data.shifts.find((entry) => entry.date === "2026-10-03").event, "Bank Holiday");
  assert.deepEqual(workspace.shiftLog.map((entry) => [entry.actor, entry.note]), [
    ["Tutor Example", "2026-10-03 · Note: “—” → “Bank Holiday”"],
    ["Tutor Example", "2026-10-01 · S1 Person 3: “—” → “Zarina” · S2 Person 1: “Daniel” → “Nayeem”"],
  ]);
  await assert.rejects(repo.updateShiftDay(actor, { id: "2026-10-01", patch: { s1p1: "Ehsan" }, base: { s1p1: "Someone else" } }), (error) => error.code === "EDIT_CONFLICT" && error.latest.s1p1 === "Sanaz");
  await repo.updateShiftDay(actor, { id: "2026-10-03", patch: { note: "" }, base: { note: "Bank Holiday" } });
  assert.equal((await repo.workspace()).data.shifts.some((entry) => entry.date === "2026-10-03"), false);
});

test("students can be exported for a day by check-in or by date added", async () => {
  const { ExcelJS } = await import("../server/excel/excelUtils.js");
  const staffId = "staff_12345678-1234-4234-8234-123456789abc";
  const a = "stu_12345678-1234-4234-8234-123456789abc", b = "stu_22345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({
    settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false },
    students: [
      { id: a, legacyDate: "2026-09-28", name: "Ana Example", matriculationNumber: "00123", accommodation: false, accommodationContact: "+49 1", enrolled: true },
      { id: b, legacyDate: "2026-09-30", name: "Ben Example", matriculationNumber: "00456" },
    ],
    activity: [{ id: "act_12345678-1234-4234-8234-123456789abc", timestamp: "2026-09-30T08:15:00.000Z", type: "Check-in", studentId: a, actor: "Tutor Example", note: "Checked in" }],
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const read = async (bytes) => { const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes); return book.getWorksheet("Students").getSheetValues().slice(2).map((row) => row.slice(1)); };
  const [header, ana] = await read(await repo.exportStudents({ date: "2026-09-30", by: "checkin" }));
  assert.deepEqual([header.at(-2), ana[0], ana[1], ana[6], ana[7], ana[8], ana.at(-2), ana.at(-1)], ["Checked in at", "Ana Example", "00123", "Yes", "No", "+49 1", "10:15", "Tutor Example"]);
  const added = await read(await repo.exportStudents({ date: "2026-09-30", by: "added" }));
  assert.deepEqual(added.slice(1).map((row) => row[0]), ["Ben Example"]);
  await assert.rejects(repo.exportStudents({ date: "2026-02-31", by: "checkin" }), /valid date/);
  await assert.rejects(repo.exportStudents({ date: "2026-09-30", by: "everyone" }), /checked-in or added/);
});

test("the Super Admin saves the semester period and manages the tutor list; tutors don't get change history", async () => {
  const adminId = "staff_12345678-1234-4234-8234-123456789abc", tutorId = "staff_22345678-1234-4234-8234-123456789abc";
  const store = memoryStore(await serializeUnifiedWorkbook({ settings: { semesterLabel: "Winter Semester 2026/27", whatsappEnabled: false }, staff: [{ id: adminId, name: "Super Admin", role: "admin", isActive: true }, { id: tutorId, name: "Tutor Example", role: "tutor", isActive: true }] }));
  const repo = createUnifiedRepository(store);
  const admin = { name: "Super Admin", role: "admin", staffId: adminId };
  let { etag } = await repo.workspace();
  await assert.rejects(repo.saveScheduleSetup(admin, { etag, start: "2026-10-23", end: "2026-09-28" }), /on or after the start date/);
  await repo.saveScheduleSetup(admin, { etag, start: "2026-09-28", end: "2026-10-23", shift1Time: "09:30–12:30", shift2Time: "" });
  ({ etag } = await repo.workspace());
  await assert.rejects(repo.saveTutors(admin, { etag, tutors: ["Sanaz", "sanaz "] }), /twice/);
  await repo.saveTutors(admin, { etag, tutors: ["Sanaz", " Ali", "", "Zarina"] });
  ({ etag } = await repo.workspace());
  await repo.saveTutors(admin, { etag, tutors: ["Sanaz", "Zarina", "Nayeem"] });
  const workspace = await repo.workspace(admin);
  assert.deepEqual(workspace.schedule, { start: "2026-09-28", end: "2026-10-23" });
  assert.deepEqual(workspace.shiftTimes, { first: "09:30–12:30", second: "12:00–15:00" });
  assert.deepEqual(workspace.tutors, ["Sanaz", "Zarina", "Nayeem"]);
  const log = (await repo.activityLog()).entries.map((entry) => entry.note);
  assert.deepEqual(log.slice(0, 2), ["Tutor list updated · added: Nayeem · removed: Ali", "Tutor list updated · added: Sanaz, Ali, Zarina"]);
  assert.ok(workspace.shiftLog.length > 0);
  const tutorView = await repo.workspace({ name: "Tutor Example", role: "tutor", staffId: tutorId });
  assert.deepEqual([tutorView.shiftLog, tutorView.data.audit], [[], []]);
  assert.deepEqual(tutorView.tutors, ["Sanaz", "Zarina", "Nayeem"]);
});
