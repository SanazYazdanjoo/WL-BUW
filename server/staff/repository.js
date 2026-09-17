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
export function contentChanges(previous, next) {
  const changes = [];
  for (const [kind, value] of Object.entries(next)) {
    const old = previous?.[kind];
    const field =
      kind === "onboarding"
        ? "topics"
        : kind === "health-insurance"
          ? "providers"
          : kind === "useful-links"
            ? "links"
            : "sections";
    const label =
      kind === "onboarding"
        ? "Step"
        : kind === "health-insurance"
          ? "Insurance provider"
          : kind === "useful-links"
            ? "Portal"
            : "Rundfunk section";
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
      return {
        ...release,
        content: Object.fromEntries(
          CONTENT_KINDS.map((k) => [
            k,
            validateContent(k, release.value.content[k]),
          ]),
        ),
      };
    }
    const entries = await Promise.all(
      CONTENT_KINDS.map(async (k) => {
        const r = await store.readJson(`app-content/${k}.json`);
        return [k, r.value ? validateContent(k, r.value) : null];
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
        changes: contentChanges(published.content, parsed.content),
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
      content.config = {
        ...published.content.config,
        semesterLabel: parsed.semesterLabel,
        ...(parsed.semesterLabel !== semester
          ? { whatsappEnabled: false, whatsappGroupUrl: "" }
          : {}),
      };
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
        sourceHash: file.hash,
        content,
      };
      if (Buffer.byteLength(JSON.stringify(release)) > 4 * 1024 * 1024)
        throw new StaffError(
          422,
          "Published content exceeds the supported size. Shorten unusually long source text before previewing again.",
        );
      await backup(`${store.paths.backups}/${revision}.json`, {
        createdAt: stamp,
        source: "Before content publication",
        previous: published.value,
        legacy: published.content,
        reviewer: actor.name,
      });
      await store.writeJson(store.paths.release, release, published.etag);
      return { ok: true, publishedAt: stamp };
    },
    async contentStatus() {
      const r = await currentContent();
      return {
        content: r.content,
        etag: r.etag,
        publishedAt: r.value?.publishedAt || "",
        sourceFilename: store.paths.editorial.split("/").at(-1),
      };
    },
    async updateConfig(actor, input) {
      const r = await currentContent();
      if (r.etag !== input.etag)
        throw new StaffError(
          409,
          "Configuration changed. Reload before saving.",
        );
      const config = validateContent("config", input.config);
      if (
        r.content.config &&
        config.semesterLabel !== r.content.config.semesterLabel &&
        config.whatsappGroupUrl === r.content.config.whatsappGroupUrl
      ) {
        config.whatsappEnabled = false;
        config.whatsappGroupUrl = "";
      }
      const revision = randomUUID();
      await backup(`${store.paths.backups}/${revision}.json`, {
        createdAt: now(),
        reviewer: actor.name,
        previous: r.value,
        legacy: r.content,
      });
      if (r.value) {
        await store.writeJson(
          store.paths.release,
          { ...r.value, revision, content: { ...r.content, config } },
          r.etag,
        );
      } else {
        const old = await store.readJson("app-content/config.json");
        if (input.configEtag !== old.etag)
          throw new StaffError(
            409,
            "Configuration changed. Reload before saving.",
          );
        await store.writeJson("app-content/config.json", config, old.etag);
      }
      return { ok: true };
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
