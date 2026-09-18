import test from "node:test";
import assert from "node:assert/strict";
import { contentFixture, masterFixture } from "./helpers/workbooks.js";
import { createStaffRepository } from "../server/staff/repository.js";
import { staffPaths } from "../server/staff/store.js";
import { StaffError } from "../server/staff/auth.js";
import config from "../content/app-content/config.json" with { type: "json" };
function memoryStore() {
  const paths = staffPaths({}),
    files = new Map();
  let revision = 0;
  return {
    paths,
    files,
    async read(path) {
      const r = files.get(path);
      return r ? structuredClone(r) : { value: null, etag: null };
    },
    async readJson(path) {
      return this.read(path);
    },
    async writeJson(path, value, etag) {
      if ((files.get(path)?.etag || null) !== etag)
        throw new StaffError(409, "Conflict");
      const tag = `"${++revision}"`;
      files.set(path, { value: structuredClone(value), etag: tag });
      return tag;
    },
    async writeBytes(path, value, etag) {
      if ((files.get(path)?.etag || null) !== etag)
        throw new StaffError(409, "Conflict");
      const tag = `"${++revision}"`;
      files.set(path, { value: Buffer.from(value), etag: tag });
      return tag;
    },
  };
}
const actor = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Synthetic tutor",
    role: "admin",
  },
  env = { STAFF_SESSION_SECRET: "synthetic-preview-signature-secret" };
test("reviewed content publication backs up previous content and writes one validated release", async () => {
  const store = memoryStore();
  const bytes = await contentFixture();
  store.files.set(store.paths.editorial, { value: bytes, etag: '"source"' });
  // Restore Buffer: real WebDAV returns Buffer, structuredClone intentionally does not.
  store.read = async (path) =>
    store.files.get(path) || { value: null, etag: null };
  await store.writeJson("app-content/config.json", config, null);
  const repo = createStaffRepository(store, env);
  const preview = await repo.previewContentWorkbook(actor);
  assert.equal(preview.content.onboarding.topics.length, 10);
  assert.equal(store.files.has(store.paths.release), false);
  await assert.rejects(
    repo.publishContentWorkbook(actor, {
      proof: preview.proof,
      reviewed: true,
    }),
    (e) => e.status === 409,
  );
  await repo.publishContentWorkbook(actor, {
    proof: preview.proof,
    reviewed: true,
    confirmSemester: true,
    resetProgress: true,
  });
  const release = store.files.get(store.paths.release).value;
  assert.equal(release.content.onboarding.topics.length, 10);
  assert.equal(release.content.config.whatsappEnabled, false);
  assert.notEqual(release.content.onboarding.progressRevision, "legacy");
  assert.ok(
    [...store.files.keys()].some((k) =>
      k.startsWith(store.paths.backups + "/"),
    ),
  );
  const firstRevision = release.revision;
  const firstEntry = (await repo.contentStatus()).history[0];
  assert.equal(firstEntry.revision, firstRevision);
  assert.ok(store.files.has(`${firstEntry.backupFolder}/Welcome-Lounge-Content.xlsx`));
  await assert.rejects(
    repo.publishContentWorkbook(actor, {
      proof: preview.proof,
      reviewed: true,
      confirmSemester: true,
    }),
    (e) => e.status === 409,
  );
  const nextPreview = await repo.previewContentWorkbook(actor);
  await repo.publishContentWorkbook(actor, {
    proof: nextPreview.proof,
    reviewed: true,
    confirmSemester: true,
    resetProgress: true,
  });
  await repo.rollbackContent(actor, { revision: firstRevision, confirm: true });
  const restored = store.files.get(store.paths.release).value;
  assert.equal(restored.restoredFrom, firstRevision);
  assert.equal(restored.content.onboarding.topics.length, 10);
});
test("private import assigns opaque IDs, check-in deduplicates and stale writes conflict", async () => {
  const store = memoryStore();
  store.files.set(store.paths.master, {
    value: await masterFixture(),
    etag: '"source"',
  });
  store.read = async (path) =>
    store.files.get(path) || { value: null, etag: null };
  const repo = createStaffRepository(store, env);
  const preview = await repo.previewMasterExcelImport(actor);
  await repo.commitMasterExcelImport(actor, {
    proof: preview.proof,
    confirm: true,
    semesterLabel: "Synthetic semester",
  });
  let w = await repo.workspace();
  const id = w.data.students[0].id;
  assert.match(id, /^stu_[a-f0-9-]+$/);
  await repo.checkIn(actor, { etag: w.etag, id });
  await assert.rejects(
    repo.updateStudent(actor, { etag: w.etag, id, patch: { enrolled: false } }),
    (e) => e.status === 409,
  );
  w = await repo.workspace();
  await repo.checkIn(actor, { etag: w.etag, id });
  w = await repo.workspace();
  assert.equal(w.data.checkins.length, 1);
  await repo.updateStudent(actor, {
    etag: w.etag,
    id,
    patch: { notes: "New synthetic note" },
  });
  w = await repo.workspace();
  assert.equal(w.data.students[0].notes, "New synthetic note");
  assert.ok(!JSON.stringify(w.data.audit).includes("New synthetic note"));
});

test("malformed private state fails safely before exposing records", async () => {
  const store = memoryStore();
  store.files.set(store.paths.state, {
    etag: '"bad"',
    value: { version: 1, students: [{ name: "private" }] },
  });
  const repo = createStaffRepository(store, env);
  await assert.rejects(repo.workspace(), (error) => error.status === 422);
});
