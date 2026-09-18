import test from "node:test";
import assert from "node:assert/strict";
import { serializeUnifiedWorkbook, parseUnifiedWorkbook } from "../server/excel/unifiedWorkbook.js";
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
