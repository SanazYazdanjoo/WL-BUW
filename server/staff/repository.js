import {
  randomUUID,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { parseContentWorkbook } from "../excel/contentWorkbook.js";
import {
  parseMasterExcel,
  exportMasterExcel,
  shiftSummary,
} from "../excel/masterExcel.js";
import { validateContent } from "../../shared/content.js";
import { CONTENT_KINDS } from "../../shared/contentKinds.js";
import { StaffError } from "./auth.js";
import sampleConfig from "../../content/app-content/config.json" with { type: "json" };
import sampleOnboarding from "../../content/app-content/onboarding.json" with { type: "json" };
import sampleEvents from "../../content/app-content/events.json" with { type: "json" };
import sampleAfterArrival from "../../content/app-content/after-arrival.json" with { type: "json" };
import sampleHealth from "../../content/app-content/health-insurance.json" with { type: "json" };
import sampleUsefulLinks from "../../content/app-content/useful-links.json" with { type: "json" };
import sampleRundfunk from "../../content/app-content/rundfunk.json" with { type: "json" };
import sampleSupport from "../../content/app-content/support-resources.json" with { type: "json" };
import sampleCommunity from "../../content/app-content/community-resources.json" with { type: "json" };
import sampleOfficialLinks from "../../content/app-content/official-links.json" with { type: "json" };
const now = () => new Date().toISOString();
export const localDate = (value = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(value);
const hash = (value) =>
  createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(value),
    )
    .digest("hex");
const empty = () => ({
  version: 1,
  semesterLabel: "",
  students: [],
  programTutors: [],
  shifts: [],
  checkins: [],
  handover: [],
  audit: [],
  lastImported: "",
});
function checkState(value) {
  const limits = {
    students: 1000,
    programTutors: 2000,
    shifts: 2000,
    checkins: 10000,
    handover: 1000,
    audit: 20000,
  };
  if (
    !value ||
    value.version !== 1 ||
    Object.entries(limits).some(
      ([key, max]) => !Array.isArray(value[key]) || value[key].length > max,
    )
  )
    throw new StaffError(422, "Stored staff data needs coordinator review.");
  const bounded = (input, max = 12000, required = false) => {
    if (
      typeof input !== "string" ||
      input.length > max ||
      (required && !input.trim()) ||
      [...input].some((c) => c.charCodeAt(0) < 32 && !["\n", "\t"].includes(c))
    )
      throw new StaffError(422, "Stored staff data needs coordinator review.");
    return input;
  };
  const uuid = (id) =>
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  const date = (v) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  const timestamp = (v) =>
    typeof v === "string" && Number.isFinite(Date.parse(v));
  value.semesterLabel = bounded(value.semesterLabel || "", 100);
  value.lastImported = bounded(value.lastImported || "", 40);
  value.students = value.students.map((s) => {
    if (
      !s ||
      typeof s !== "object" ||
      (typeof s.enrolled !== "boolean" && s.enrolled !== null) ||
      (typeof s.receivedBackpack !== "boolean" &&
        s.receivedBackpack !== null) ||
      (s.legacyDate && !date(s.legacyDate)) ||
      (s.updatedAt && !timestamp(s.updatedAt))
    )
      throw new StaffError(422, "Stored staff data needs coordinator review.");
    return {
      id:
        typeof s.id === "string" && /^stu_[0-9a-f-]{36}$/i.test(s.id)
          ? s.id
          : (() => {
              throw new StaffError(
                422,
                "Stored staff data needs coordinator review.",
              );
            })(),
      legacyDate: bounded(s.legacyDate || "", 40),
      name: bounded(s.name || "", 200, true),
      matriculationNumber: bounded(s.matriculationNumber || "", 100),
      country: bounded(s.country || "", 200),
      studyProgram: bounded(s.studyProgram || "", 300),
      enrolled: s.enrolled,
      accommodation: bounded(s.accommodation || "", 4000),
      address: bounded(s.address || "", 2000),
      receivedBackpack: s.receivedBackpack,
      cityRegistration: bounded(s.cityRegistration || "", 4000),
      notes: bounded(s.notes || "", 12000),
      updatedAt: bounded(s.updatedAt || "", 40),
      updatedBy: bounded(s.updatedBy || "", 100),
    };
  });
  value.programTutors = value.programTutors.map((t) => ({
    program: bounded(t.program, 300, true),
    tutor: bounded(t.tutor || "", 200),
    email: bounded(t.email || "", 320),
    phone: bounded(t.phone || "", 100),
    telegram: bounded(t.telegram || "", 200),
  }));
  value.shifts = value.shifts.map((s) => {
    if (
      !s ||
      !date(s.date) ||
      !Array.isArray(s.first) ||
      !Array.isArray(s.second) ||
      s.first.length > 3 ||
      s.second.length > 3
    )
      throw new StaffError(422, "Stored staff data needs coordinator review.");
    return {
      date: s.date,
      first: s.first.map((v) => bounded(v || "", 200)),
      second: s.second.map((v) => bounded(v || "", 200)),
      event: bounded(s.event || "", 4000),
    };
  });
  value.checkins = value.checkins.map((c) => {
    if (
      !c ||
      !uuid(c.id) ||
      !/^stu_[0-9a-f-]{36}$/i.test(c.studentId || "") ||
      !date(c.date) ||
      !timestamp(c.timestamp) ||
      !c.actor ||
      !uuid(c.actor.id)
    )
      throw new StaffError(422, "Stored staff data needs coordinator review.");
    return {
      id: c.id,
      studentId: c.studentId,
      date: c.date,
      timestamp: c.timestamp,
      actor: { id: c.actor.id, name: bounded(c.actor.name, 100, true) },
      status: bounded(c.status || "", 200),
    };
  });
  value.handover = value.handover.map((n) => {
    if (!n || !uuid(n.id) || !date(n.date) || !timestamp(n.timestamp))
      throw new StaffError(422, "Stored staff data needs coordinator review.");
    return {
      id: n.id,
      date: n.date,
      timestamp: n.timestamp,
      author: bounded(n.author, 100, true),
      note: bounded(n.note, 4000, true),
    };
  });
  value.audit = value.audit.map((a) => {
    if (
      !a ||
      !uuid(a.id) ||
      !a.actor ||
      !uuid(a.actor.id) ||
      !["admin", "tutor"].includes(a.actor.role) ||
      !timestamp(a.timestamp) ||
      !Array.isArray(a.changedFields) ||
      a.changedFields.length > 20
    )
      throw new StaffError(422, "Stored staff data needs coordinator review.");
    return {
      id: a.id,
      actor: {
        id: a.actor.id,
        name: bounded(a.actor.name, 100, true),
        role: a.actor.role,
      },
      action: bounded(a.action, 100, true),
      recordId: bounded(a.recordId || "", 100),
      changedFields: a.changedFields.map((v) => bounded(v, 100)),
      timestamp: a.timestamp,
    };
  });
  return value;
}
const safeText = (v, max = 12000) => {
  if (
    typeof v !== "string" ||
    v.length > max ||
    [...v].some((c) => c.charCodeAt(0) < 32 && !["\n", "\t"].includes(c))
  )
    throw new StaffError(400, "A text field is invalid or too long.");
  return v;
};
function token(value, env) {
  return createHmac("sha256", env.STAFF_SESSION_SECRET)
    .update(JSON.stringify(value))
    .digest("base64url");
}
function previewProof(
  type,
  sourceHash,
  etag,
  semester,
  actor,
  env,
  at = Date.now(),
) {
  const value = {
    type,
    sourceHash,
    etag,
    semester,
    actor: actor.id,
    expires: at + 15 * 60 * 1000,
  };
  return { value, signature: token(value, env) };
}
function verifyProof(proof, expected, env) {
  if (!proof?.value || typeof proof.signature !== "string")
    throw new StaffError(409, "Preview the workbook again before confirming.");
  const signature = token(proof.value, env);
  if (
    signature.length !== proof.signature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(proof.signature)) ||
    proof.value.expires < Date.now() ||
    Object.entries(expected).some(([k, v]) => proof.value[k] !== v)
  )
    throw new StaffError(
      409,
      "The source or current data changed. Preview again before confirming.",
    );
}
function nextcloudBrowserUrl(env) {
  if (!env.NEXTCLOUD_BROWSER_URL || !env.NEXTCLOUD_BASE_URL) return "";
  try {
    const link = new URL(env.NEXTCLOUD_BROWSER_URL);
    const base = new URL(env.NEXTCLOUD_BASE_URL);
    return link.protocol === "https:" && link.origin === base.origin &&
      link.pathname.startsWith("/apps/files/") && !link.username && !link.password
      ? link.href : "";
  } catch {
    return "";
  }
}
const emptyPublishedKind = (kind) => ({
  "support-resources": { version: 1, resources: [] },
  "community-resources": { version: 1, resources: [] },
  "official-links": { version: 1, links: [] },
}[kind] || null);
const safeDefaults = {
  config: sampleConfig,
  onboarding: sampleOnboarding,
  events: sampleEvents,
  "after-arrival": sampleAfterArrival,
  "health-insurance": sampleHealth,
  "useful-links": sampleUsefulLinks,
  "support-resources": sampleSupport,
  "community-resources": sampleCommunity,
  "official-links": sampleOfficialLinks,
  rundfunk: sampleRundfunk,
};
const collectionFor = (kind) => ({
  onboarding: ["topics", "Step"],
  "health-insurance": ["providers", "Insurance provider"],
  "useful-links": ["links", "Information link"],
  "support-resources": ["resources", "Student support resource"],
  "community-resources": ["resources", "Community resource"],
  "official-links": ["links", "Official link"],
  "after-arrival": ["topics", "Later-stage topic"],
  events: ["events", "Event"],
  community: ["resources", "Community support resource"],
  rundfunk: ["sections", "Rundfunk section"],
}[kind]);
function publicationRiskWarnings(previous, next) {
  const warnings = [];
  for (const [kind, value] of Object.entries(next)) {
    const [field, label] = collectionFor(kind) || [];
    if (!field) continue;
    const before = previous?.[kind]?.[field]?.length || 0;
    const after = value?.[field]?.length || 0;
    if (before >= 5 && after < before * 0.5)
      warnings.push(`${label}: active items fall from ${before} to ${after}. Review this large change carefully.`);
  }
  return warnings;
}
export function contentChanges(previous, next) {
  const changes = [];
  for (const [kind, value] of Object.entries(next)) {
    const old = previous?.[kind];
    if (kind === "config") {
      for (const key of new Set([...Object.keys(old || {}), ...Object.keys(value)])) {
        if (JSON.stringify(old?.[key]) !== JSON.stringify(value[key]))
          changes.push({ kind, label: `Semester settings: ${key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}`, status: old?.[key] === undefined ? "added" : "changed", before: old?.[key] ?? null, after: value[key] });
      }
      continue;
    }
    const [field, label] = collectionFor(kind) || [null, kind];
    if (!field) continue;
    const before = old?.[field] || [],
      after = value[field] || [];
    for (const [i, item] of after.entries()) {
      const prior = before.find((v, j) => (v.id || j) === (item.id || i));
      if (JSON.stringify(prior) !== JSON.stringify(item))
        changes.push({
          kind,
          label: `${label}: ${item.title || item.name || item.heading || i + 1}`,
          status: prior ? "changed" : "added",
          before: prior || null,
          after: item,
        });
    }
    for (const [i, item] of before.entries())
      if (!after.some((v, j) => (v.id || j) === (item.id || i)))
        changes.push({
          kind,
          label: `${label}: ${item.title || item.name || item.heading || i + 1}`,
          status: "removed",
          before: item,
          after: null,
        });
  }
  return changes;
}
export function createStaffRepository(store, env) {
  async function readState() {
    const r = await store.readJson(store.paths.state);
    return { ...r, value: r.value ? checkState(r.value) : empty() };
  }
  async function currentContent() {
    const release = await store.readJson(store.paths.release);
    if (release.value) {
      if (release.value.version !== 1)
        throw new StaffError(422, "Published content needs review.");
      const entries = await Promise.all(CONTENT_KINDS.map(async (kind) => {
        let value = release.value.content?.[kind];
        if (value === undefined) {
          const legacy = await store.readJson(`app-content/${kind}.json`);
          value = legacy.value || emptyPublishedKind(kind) || safeDefaults[kind];
        }
        try {
          return [kind, validateContent(kind, value)];
        } catch {
          throw new StaffError(422, `Published ${kind} content needs coordinator review.`);
        }
      }));
      return { ...release, content: Object.fromEntries(entries) };
    }
    const entries = await Promise.all(
      CONTENT_KINDS.map(async (k) => {
        const r = await store.readJson(`app-content/${k}.json`);
        return [k, validateContent(k, r.value || emptyPublishedKind(k) || safeDefaults[k])];
      }),
    );
    return { ...release, content: Object.fromEntries(entries) };
  }
  function audit(state, actor, action, id, fields = []) {
    state.audit.push({
      id: randomUUID(),
      actor: { id: actor.id, name: actor.name, role: actor.role },
      action,
      recordId: id,
      changedFields: fields,
      timestamp: now(),
    });
  }
  async function mutate(actor, version, action, callback) {
    const state = await readState();
    if (version !== state.etag)
      throw new StaffError(
        409,
        "This record was changed by another tutor. Reload the latest version before saving.",
      );
    const id = await callback(state.value);
    audit(state.value, actor, action, id);
    await store.writeJson(store.paths.state, state.value, state.etag);
    return { ok: true };
  }
  async function workbook(path) {
    const file = await store.read(path, 10 * 1024 * 1024);
    if (!file.value)
      throw new StaffError(
        404,
        "The source workbook is missing. Upload it to the documented Nextcloud location.",
      );
    return { ...file, hash: hash(file.value) };
  }
  async function backup(path, value) {
    await store.writeJson(path, value, null);
  }
  async function snapshotPublication({ file, published, content, candidate, revision, at, actor }) {
    const folderName = `${at.replace(/[:.]/g, "-")}-${revision.slice(0, 8)}`;
    const folder = `${store.paths.backups}/${folderName}`;
    if (file?.value && store.writeBytes)
      await store.writeBytes(`${folder}/Welcome-Lounge-Content.xlsx`, file.value, null);
    await store.writeJson(`${folder}/published.json`, candidate || published.value || { version: 1, content }, null);
    await store.writeJson(`${folder}/previous-release.json`, published.value || { version: 1, content }, null);
    for (const [kind, value] of Object.entries(content))
      await store.writeJson(`${folder}/previous/${kind}.json`, value, null);
    await store.writeJson(`${folder}/publish-meta.json`, {
      revision,
      createdAt: at,
      semester: content.config?.semesterLabel || "",
      workbookETag: file?.etag || "",
      workbookLastModified: file?.lastModified || "",
      contentHash: hash(content),
      savedBy: actor?.name || "",
    }, null);
    return folder;
  }
  async function recordHistory(entry) {
    const previous = await store.readJson(store.paths.history);
    const items = Array.isArray(previous.value?.items) ? previous.value.items : [];
    await store.writeJson(store.paths.history, {
      version: 1,
      items: [entry, ...items].slice(0, 50),
    }, previous.etag);
  }
  async function writeWorkbookStatus(value) {
    const previous = await store.readJson(store.paths.workbookStatus);
    await store.writeJson(store.paths.workbookStatus, value, previous.etag);
  }
  const api = {
    async workspace() {
      const r = await readState();
      return {
        data: r.value,
        etag: r.etag,
        today: localDate(),
        shiftSummary: shiftSummary(r.value.shifts),
      };
    },
    async listArrivals() {
      const r = await readState();
      return r.value.checkins.filter((c) => c.date === localDate());
    },
    async updateStudent(actor, input) {
      return mutate(actor, input.etag, "student.update", (state) => {
        const s = state.students.find((s) => s.id === input.id);
        if (!s) throw new StaffError(404, "Student not found.");
        const fields = [
          "enrolled",
          "accommodation",
          "receivedBackpack",
          "cityRegistration",
          "notes",
        ];
        if (
          !input.patch ||
          Object.keys(input.patch).some((k) => !fields.includes(k))
        )
          throw new StaffError(
            400,
            "Only operational status fields can be changed.",
          );
        for (const [k, v] of Object.entries(input.patch)) {
          if (["enrolled", "receivedBackpack"].includes(k)) {
            if (![true, false, null].includes(v))
              throw new StaffError(400, "Invalid status.");
          } else safeText(v);
          s[k] = v;
        }
        s.updatedAt = now();
        s.updatedBy = actor.name;
        audit(state, actor, "student.fields", s.id, Object.keys(input.patch));
        return s.id;
      });
    },
    async checkIn(actor, input) {
      return mutate(actor, input.etag, "student.checkin", (state) => {
        if (!state.students.some((s) => s.id === input.id))
          throw new StaffError(404, "Student not found.");
        const date = localDate();
        if (
          !state.checkins.some(
            (c) => c.studentId === input.id && c.date === date,
          )
        )
          state.checkins.push({
            id: randomUUID(),
            studentId: input.id,
            date,
            timestamp: now(),
            actor: { id: actor.id, name: actor.name },
            status: safeText(input.status || "", 200),
          });
        return input.id;
      });
    },
    async addHandover(actor, input) {
      return mutate(actor, input.etag, "handover.add", (state) => {
        const note = safeText(input.note, 4000).trim();
        if (!note) throw new StaffError(400, "Write a handover note.");
        const id = randomUUID();
        state.handover.push({
          id,
          date: localDate(),
          timestamp: now(),
          author: actor.name,
          note,
        });
        return id;
      });
    },
    async previewMasterExcelImport(actor) {
      const [file, state] = await Promise.all([
        workbook(store.paths.master),
        readState(),
      ]);
      const parsed = await parseMasterExcel(file.value);
      if (parsed.students.length > 1000)
        throw new StaffError(
          422,
          "This pilot supports up to 1,000 imported students.",
        );
      return {
        data: parsed,
        currentCount: state.value.students.length,
        lastImported: state.value.lastImported,
        proof: previewProof(
          "master",
          file.hash,
          state.etag,
          state.value.semesterLabel,
          actor,
          env,
        ),
      };
    },
    async commitMasterExcelImport(actor, input) {
      const [file, state] = await Promise.all([
        workbook(store.paths.master),
        readState(),
      ]);
      verifyProof(
        input.proof,
        {
          type: "master",
          sourceHash: file.hash,
          etag: state.etag,
          semester: state.value.semesterLabel,
          actor: actor.id,
        },
        env,
      );
      if (input.confirm !== true)
        throw new StaffError(400, "Confirm the reviewed import.");
      const parsed = await parseMasterExcel(file.value);
      if (parsed.students.length > 1000)
        throw new StaffError(422, "Student limit exceeded.");
      const semester = safeText(input.semesterLabel, 100).trim();
      if (!semester) throw new StaffError(400, "Enter the semester label.");
      const stamp = randomUUID();
      await backup(`${store.paths.staff}/backups/${stamp}.json`, {
        createdAt: now(),
        reason: "Before MasterExcel import",
        state: state.value,
      });
      const reset = input.newSemester === true;
      if (
        state.value.semesterLabel &&
        semester !== state.value.semesterLabel &&
        !reset
      )
        throw new StaffError(
          400,
          "Confirm new-semester setup when changing the operational semester.",
        );
      const next = reset ? empty() : state.value;
      const seen = new Set();
      for (const row of parsed.students) {
        const old = reset
          ? null
          : next.students.find((s) =>
              row.matriculationNumber
                ? s.matriculationNumber === row.matriculationNumber
                : !s.matriculationNumber &&
                  s.name === row.name &&
                  s.studyProgram === row.studyProgram,
            );
        const id = old?.id || `stu_${randomUUID()}`;
        if (seen.has(id))
          throw new StaffError(
            422,
            "Ambiguous student matching; correct duplicates in the workbook.",
          );
        seen.add(id);
        const student = {
          ...old,
          ...row,
          id,
          updatedAt: now(),
          updatedBy: actor.name,
        };
        if (old) next.students[next.students.indexOf(old)] = student;
        else next.students.push(student);
      }
      next.programTutors = parsed.programTutors;
      next.shifts = parsed.shifts;
      next.semesterLabel = semester;
      next.lastImported = now();
      audit(next, actor, "master.import", stamp);
      await store.writeJson(store.paths.state, next, state.etag);
      return { ok: true };
    },
    async exportMasterExcel() {
      const r = await readState();
      return exportMasterExcel(r.value);
    },
    async previewContentWorkbook(actor) {
      const [file, published] = await Promise.all([
        workbook(store.paths.editorial),
        currentContent(),
      ]);
      const semester = published.content.config?.semesterLabel || "";
      const parsed = await parseContentWorkbook(file.value, semester);
      for (const [k, v] of Object.entries(parsed.content))
        validateContent(k, v);
      return {
        ...parsed,
        currentSemester: semester,
        lastPublished: published.value?.publishedAt || "",
        sourceFilename: store.paths.editorial.split("/").at(-1),
        nextcloudBrowserUrl: nextcloudBrowserUrl(env),
        sourceLastModified: file.lastModified || "",
        changes: contentChanges(published.content, parsed.content),
        warnings: [...(parsed.warnings || []), ...publicationRiskWarnings(published.content, { ...published.content, ...parsed.content })],
        proof: previewProof(
          "content",
          file.hash,
          hash(published.content),
          semester,
          actor,
          env,
        ),
      };
    },
    async publishContentWorkbook(actor, input) {
      const [file, published] = await Promise.all([
        workbook(store.paths.editorial),
        currentContent(),
      ]);
      const semester = published.content.config?.semesterLabel || "";
      verifyProof(
        input.proof,
        {
          type: "content",
          sourceHash: file.hash,
          etag: hash(published.content),
          semester,
          actor: actor.id,
        },
        env,
      );
      if (input.reviewed !== true)
        throw new StaffError(
          400,
          "Confirm that you reviewed the full content.",
        );
      const parsed = await parseContentWorkbook(file.value, semester);
      if (
        parsed.semesterLabel.toLowerCase().replace(/\s/g, "") !==
          semester.toLowerCase().replace(/\s/g, "") &&
        input.confirmSemester !== true
      )
        throw new StaffError(
          409,
          "Semester mismatch: review and explicitly confirm before publishing.",
        );
      if (!published.content.config)
        throw new StaffError(
          400,
          "Set up the semester and contact configuration first.",
        );
      const stamp = now(),
        revision = randomUUID();
      const content = { ...published.content, ...parsed.content };
      content.config = parsed.content.config || published.content.config;
      const previousRevision = published.content.onboarding?.progressRevision;
      const progressRevision =
        input.resetProgress === true ? revision : previousRevision || "legacy";
      if (
        published.content.onboarding?.topics.some((t) =>
          t.id.startsWith("first-step-"),
        ) &&
        parsed.semesterLabel !==
          (published.content.onboarding.semesterLabel || semester) &&
        input.resetProgress !== true
      )
        throw new StaffError(
          400,
          "Reset journey progress when numbered steps move to a new semester.",
        );
      for (const k of CONTENT_KINDS) {
        if (!content[k])
          content[k] =
            k === "events"
              ? { version: 1, events: [] }
              : k === "after-arrival"
                ? { version: 1, topics: [] }
                : null;
        if (!content[k])
          throw new StaffError(422, "Required published content is missing.");
        content[k] = validateContent(k, {
          ...content[k],
          publishedAt: stamp,
          progressRevision,
        });
      }
      // One conditional PUT publishes the complete release; readers never see half a workbook.
      const release = {
        version: 1,
        revision,
        publishedAt: stamp,
        publishedBy: actor.name,
        sourceHash: file.hash,
        content,
      };
      if (Buffer.byteLength(JSON.stringify(release)) > 4 * 1024 * 1024)
        throw new StaffError(
          422,
          "Published content exceeds the supported size. Shorten unusually long source text before previewing again.",
        );
      const backupFolder = await snapshotPublication({
        file,
        published,
        content: published.content,
        candidate: release,
        revision,
        at: stamp,
        actor,
      });
      await store.writeJson(store.paths.release, release, published.etag);
      const changedSections = [...new Set(contentChanges(published.content, content).map((change) => change.kind))];
      const entry = {
        revision,
        publishedAt: stamp,
        publishedBy: actor.name,
        semester: content.config.semesterLabel,
        workbookETag: file.etag || "",
        workbookLastModified: file.lastModified || "",
        contentHash: hash(content),
        changedSections,
        validationWarnings: parsed.warnings,
        backupFolder,
      };
      try {
        await recordHistory(entry);
        await writeWorkbookStatus({
          version: 1,
          lastSeenAt: stamp,
          lastModified: file.lastModified || "",
          etag: file.etag || "",
          sourceHash: file.hash,
          publishedRevision: revision,
          publishedAt: stamp,
        });
      } catch {
        console.warn("Content was published but private status history could not be updated.");
      }
      return { ok: true, publishedAt: stamp, revision };
    },
    async contentStatus() {
      const r = await currentContent();
      const [source, status, history] = await Promise.all([
        store.read(store.paths.editorial, 10 * 1024 * 1024),
        store.readJson(store.paths.workbookStatus),
        store.readJson(store.paths.history),
      ]);
      return {
        content: r.content,
        etag: r.etag,
        publishedAt: r.value?.publishedAt || "",
        publishedBy: r.value?.publishedBy || "",
        sourceFilename: store.paths.editorial.split("/").at(-1),
        nextcloudBrowserUrl: nextcloudBrowserUrl(env),
        workbook: {
          available: Boolean(source.value),
          lastModified: source.lastModified || status.value?.lastModified || "",
          matchesPublished: Boolean(source.value && r.value?.sourceHash === hash(source.value)),
        },
        history: (history.value?.items || []).slice(0, 20),
      };
    },
    async rollbackContent(actor, input) {
      const revision = safeText(input.revision, 100);
      if (!/^[0-9a-f-]{36}$/i.test(revision) || input.confirm !== true)
        throw new StaffError(400, "Select a previous publication and confirm the restore.");
      const history = await store.readJson(store.paths.history);
      const selected = history.value?.items?.find((item) => item.revision === revision);
      if (!selected?.backupFolder || !selected.backupFolder.startsWith(`${store.paths.backups}/`) || selected.backupFolder.includes(".."))
        throw new StaffError(404, "That publication backup is not available.");
      const [current, prior] = await Promise.all([
        currentContent(),
        store.readJson(`${selected.backupFolder}/published.json`),
      ]);
      if (!prior.value?.content || prior.value.version !== 1)
        throw new StaffError(404, "That publication backup is not available.");
      const stamp = now();
      const nextRevision = randomUUID();
      const restoredContent = Object.fromEntries(CONTENT_KINDS.map((kind) => [
        kind,
        validateContent(kind, prior.value.content[kind] || safeDefaults[kind]),
      ]));
      const release = {
        version: 1,
        revision: nextRevision,
        publishedAt: stamp,
        publishedBy: actor.name,
        sourceHash: prior.value.sourceHash || "",
        restoredFrom: revision,
        content: restoredContent,
      };
      const backupFolder = await snapshotPublication({
        file: await store.read(store.paths.editorial, 10 * 1024 * 1024),
        published: current,
        content: current.content,
        candidate: release,
        revision: nextRevision,
        at: stamp,
        actor,
      });
      await store.writeJson(store.paths.release, release, current.etag);
      await recordHistory({
        revision: nextRevision,
        publishedAt: stamp,
        publishedBy: actor.name,
        semester: restoredContent.config.semesterLabel,
        contentHash: hash(restoredContent),
        changedSections: CONTENT_KINDS,
        validationWarnings: [],
        restoredFrom: revision,
        backupFolder,
      });
      return { ok: true, publishedAt: stamp };
    },
    async getConfig() {
      const r = await currentContent();
      const old = r.value
        ? null
        : await store.readJson("app-content/config.json");
      return {
        config: r.content.config || {
          version: 1,
          semesterLabel: "",
          contactLabel: "Welcome Lounge team",
          helpText: "",
          whatsappEnabled: false,
          whatsappGroupUrl: "",
        },
        etag: r.etag,
        configEtag: old?.etag || null,
      };
    },
  };
  return api;
}
