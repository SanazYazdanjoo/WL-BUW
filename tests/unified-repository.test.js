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
    students: [{ id: studentId, name: "Example Student", accommodation: "", notes: "" }],
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store);
  const actor = { name: "Tutor Example", role: "tutor", staffId };
  const initial = await repo.workspace();
  const results = await Promise.all([
    repo.updateStudent(actor, { id: studentId, etag: initial.etag, patch: { accommodation: "Student housing" }, base: { accommodation: "" } }),
    repo.updateStudent(actor, { id: studentId, etag: initial.etag, patch: { notes: "Needs follow-up" }, base: { notes: "" } }),
  ]);
  assert.equal(results.length, 2);
  let parsed = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.equal(parsed.data.students[0].accommodation, "Student housing");
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
    students: [{ id: studentId, name: "Example Student", accommodation: "" }],
    staff: [{ id: staffId, name: "Tutor Example", role: "tutor", isActive: true }],
  }));
  const repo = createUnifiedRepository(store), actor = { name: "Tutor Example", role: "tutor", staffId };
  const initial = await repo.workspace();
  await Promise.all([
    repo.updateStudent(actor, { id: studentId, etag: initial.etag, patch: { accommodation: "Student housing" }, base: { accommodation: "" } }),
    repo.checkIn(actor, { id: studentId, etag: initial.etag }),
  ]);
  const parsed = await parseUnifiedWorkbook(store.files.get(store.paths.unified).value);
  assert.equal(parsed.data.students[0].accommodation, "Student housing");
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
