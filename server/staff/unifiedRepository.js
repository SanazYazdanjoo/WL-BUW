import { randomUUID, createHash } from "node:crypto";
import { createUnifiedWorkbookTemplate, parseUnifiedWorkbook, serializeUnifiedWorkbook, publicContentFromWorkbook, slotNames, MAX_TUTORS, DEFAULT_SHIFT_TIMES } from "../excel/unifiedWorkbook.js";
import { parseContentWorkbook } from "../excel/contentWorkbook.js";
import { parseMasterExcel, exportMasterExcel } from "../excel/masterExcel.js";
import { validateContent } from "../../shared/content.js";
import { CONTENT_KINDS } from "../../shared/contentKinds.js";
import { StaffError } from "./auth.js";
import { shiftSummary } from "../excel/masterExcel.js";
import { EXPORT_MODES, exportStudentsForDay } from "../excel/studentExport.js";
import { safeLink } from "../../shared/content.js";
import onboardingSample from "../../content/app-content/onboarding.json" with { type: "json" };
import eventsSample from "../../content/app-content/events.json" with { type: "json" };
import afterArrivalSample from "../../content/app-content/after-arrival.json" with { type: "json" };
import healthSample from "../../content/app-content/health-insurance.json" with { type: "json" };
import usefulSample from "../../content/app-content/useful-links.json" with { type: "json" };
import rundfunkSample from "../../content/app-content/rundfunk.json" with { type: "json" };
import supportSample from "../../content/app-content/support-resources.json" with { type: "json" };
import communityResourcesSample from "../../content/app-content/community-resources.json" with { type: "json" };
import officialLinksSample from "../../content/app-content/official-links.json" with { type: "json" };

import configSample from "../../content/app-content/config.json" with { type: "json" };
const samples = { config: configSample, onboarding: onboardingSample, events: eventsSample, "after-arrival": afterArrivalSample, "health-insurance": healthSample, "useful-links": usefulSample, rundfunk: rundfunkSample, "support-resources": supportSample, "community-resources": communityResourcesSample, "official-links": officialLinksSample };
const now = () => new Date().toISOString();
const dateToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
const text = (value, max = 12000) => {
  if (typeof value !== "string" || value.length > max || [...value].some((c) => c.charCodeAt(0) < 32 && !["\n", "\t"].includes(c))) throw new StaffError(400, "A text field is invalid or too long.");
  return value;
};
const contentSections = new Set(["First Step", "Useful Info", "Student Support", "Community", "Help"]);
const slug = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "content-item";
const idFor = (prefix) => `${prefix}_${randomUUID()}`;
const STUDENT_FIELDS = ["name", "matriculationNumber", "enrolled", "accommodation", "accommodationContact", "receivedBackpack", "cityRegistration", "address", "country", "studyProgram", "notes", "phone", "email"];
const yesNo = (value) => (typeof value === "boolean" ? value : value ? true : null);
const STUDENT_YES_NO_FIELDS = ["enrolled", "accommodation", "receivedBackpack", "cityRegistration"];
const STUDENT_FIELD_LIMITS = { name: 200, matriculationNumber: 100, notes: 4000, email: 254, phone: 100, accommodationContact: 1000 };
function checkStudentField(field, value, student, data) {
  if (STUDENT_YES_NO_FIELDS.includes(field)) {
    if (![true, false, null].includes(value)) throw new StaffError(400, "Choose Yes, No or Unknown.");
    return;
  }
  if (typeof value !== "string" || value.length > (STUDENT_FIELD_LIMITS[field] || 12000)) throw new StaffError(400, "A student field is too long.");
  if (field === "name" && !value.trim()) throw new StaffError(400, "Enter the student's full name.");
  if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new StaffError(400, "Enter a valid email address.");
  const matriculation = value.trim().toLocaleLowerCase("en");
  if (field === "matriculationNumber" && matriculation && data.students.some((other) => other.id !== student.id && String(other.matriculationNumber || "").trim().toLocaleLowerCase("en") === matriculation))
    throw new StaffError(409, "Another student already has this matriculation number.");
}
// Shift grid cells: s1p1..s1p4, s2p1..s2p4 and the day note.
const SHIFT_FIELDS = [...[1, 2].flatMap((slot) => [1, 2, 3, 4].map((person) => `s${slot}p${person}`)), "note"];
const shiftCell = (field) => { const [, slot, person] = field.match(/^s([12])p([1-4])$/); return [slot === "1" ? "first" : "second", Number(person) - 1]; };
const shiftValue = (day, field) => (field === "note" ? day.event : day[shiftCell(field)[0]][shiftCell(field)[1]]) || "";
function setShiftValue(day, field, value) {
  if (field === "note") day.event = value;
  else { const [slot, index] = shiftCell(field); day[slot][index] = value; }
}
const shiftFieldLabel = (field) => (field === "note" ? "Note" : `S${field[1]} Person ${field[3]}`);
const toShiftDay = (shift) => ({ id: shift.date, date: shift.date, first: slotNames((shift.first || []).filter(Boolean)), second: slotNames((shift.second || []).filter(Boolean)), event: shift.event || "" });
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function checkEvent(event) {
  if (!event.title?.trim() || event.title.length > 200) throw new StaffError(400, "Enter an event title.");
  if (!isDate(event.date)) throw new StaffError(400, "Enter a valid event date.");
  if ((event.startTime && !isTime(event.startTime)) || (event.endTime && !isTime(event.endTime))) throw new StaffError(400, "Enter event times in 24-hour format, for example 14:00.");
  if (event.endTime && (!event.startTime || event.endTime < event.startTime)) throw new StaffError(400, "The end time must be after the start time.");
  if (event.location.length > 300 || event.description.length > 12000) throw new StaffError(400, "An event field is too long.");
  if (event.link && !safeLink(event.link)) throw new StaffError(400, "Use a valid public HTTPS link.");
  if (typeof event.active !== "boolean") throw new StaffError(400, "Choose whether this event is active.");
}

export function createUnifiedRepository(store) {
  async function current() {
    const file = await store.read(store.paths.unified, 10 * 1024 * 1024);
    if (!file.value) throw new StaffError(409, "Welcome Lounge workbook is not initialized. Ask a coordinator to create it or import existing content.");
    let parsed;
    try { parsed = await parseUnifiedWorkbook(file.value); }
    catch (error) { throw new StaffError(422, `The Welcome Lounge data file needs attention. ${error.message}`); }
    return { ...file, parsed };
  }
  async function recordBackup(file, actor, reason, daily = false) {
    const day = dateToday();
    const meta = await store.readJson(store.paths.unifiedBackupStatus);
    if (daily && meta.value?.dailyDate === day) return meta.value;
    const timestamp = now().replace(/[:.]/g, "-");
    const path = daily
      ? `${store.paths.unifiedBackups}/daily/${day}/Welcome-Lounge.xlsx`
      : `${store.paths.unifiedBackups}/manual/${timestamp}/Welcome-Lounge.xlsx`;
    try {
      await store.writeBytes(path, file.value, null);
    } catch (error) {
      if (!(daily && error.status === 409)) throw error;
    }
    const value = { version: 1, lastBackupAt: now(), lastBackupBy: actor?.name || "System", reason, dailyDate: day, path };
    try { await store.writeJson(store.paths.unifiedBackupStatus, value, meta.etag); }
    catch { /* Workbook safety does not depend on the optional status pointer. */ }
    return value;
  }
  async function commit(file, data, actor, reason, { major = false } = {}) {
    if (!file.etag) throw new StaffError(409, "The workbook has no version marker. Refresh it before saving.");
    await recordBackup(file, actor, reason, !major);
    const bytes = await serializeUnifiedWorkbook(data);
    try {
      const etag = await store.writeBytes(store.paths.unified, bytes, file.etag);
      return { ok: true, etag };
    } catch (error) {
      if (error.status === 409) throw new StaffError(409, "The workbook changed while you were saving. Reload the latest version and review your change again.");
      throw error;
    }
  }
  const appendActivity = (data, actor, type, { studentId = "", note = "" } = {}) => {
    data.activity.push({ id: idFor("act"), timestamp: now(), type, studentId, actor: actor.name, note: text(note, 4000) });
  };
  async function mutate(actor, input, reason, callback, options = {}) {
    if (!actor.staffId && !options.allowUnassigned) throw new StaffError(403, "Choose your name from the active staff list before saving.");
    const attempts = options.safeRetry ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const file = await current();
      if (!options.safeRetry && (!input.etag || input.etag !== file.etag)) throw new StaffError(409, "The workbook changed while you were saving. Reload the latest version and review your change again.");
      if (actor.staffId) {
        const selectedStaff = file.parsed.data.staff.find((person) => person.id === actor.staffId && person.isActive);
        if (!selectedStaff && !options.allowUnassigned) throw new StaffError(403, "Your selected staff identity is no longer active. Choose an active name before saving.");
        if (selectedStaff) actor.name = selectedStaff.name;
      }
      const data = structuredClone(file.parsed.data);
      const changed = await callback(data, file.parsed);
      if (changed === false) return { ok: true, etag: file.etag, unchanged: true };
      try {
        const result = await commit(file, data, actor, reason, options);
        return result;
      } catch (error) {
        if (error.status !== 409 || attempt + 1 === attempts) throw error;
      }
    }
    throw new StaffError(409, "The workbook is busy with another update. Retry in a moment.");
  }
  async function mutateFields(actor, input, { id, collection, allowed, reason, activityType, fieldMap = (field, value) => [field, value], validate }) {
    const patch = input.patch;
    if (!patch || typeof patch !== "object" || Array.isArray(patch) || !Object.keys(patch).length || Object.keys(patch).some((field) => !allowed.includes(field))) throw new StaffError(400, "The requested fields cannot be updated.");
    if (!input.base || typeof input.base !== "object" || Object.keys(patch).some((field) => !Object.hasOwn(input.base, field))) throw new StaffError(400, "Reload this record before saving your changes.");
    if (!actor.staffId) throw new StaffError(403, "Choose your name from the active staff list before saving.");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const file = await current();
      const selectedStaff = file.parsed.data.staff.find((person) => person.id === actor.staffId && person.isActive);
      if (!selectedStaff) throw new StaffError(403, "Your selected staff identity is no longer active. Choose an active name before saving.");
      actor.name = selectedStaff.name;
      const data = structuredClone(file.parsed.data);
      const record = (data[collection] || []).find((item) => item.id === id);
      if (!record) throw new StaffError(404, "The record could not be found. Reload and try again.");
      const latest = {}, conflicts = [];
      for (const field of Object.keys(patch)) {
        const [targetField] = fieldMap(field, patch[field]);
        latest[field] = structuredClone(record[targetField]);
        const baseValue = input.base[field];
        const latestValue = record[targetField];
        const requestedValue = fieldMap(field, patch[field])[1];
        if (JSON.stringify(latestValue) !== JSON.stringify(baseValue) && JSON.stringify(latestValue) !== JSON.stringify(requestedValue)) conflicts.push(field);
      }
      if (conflicts.length) {
        const error = new StaffError(409, "Some fields were changed elsewhere. Review both versions before continuing.");
        error.code = "EDIT_CONFLICT"; error.fields = conflicts; error.latest = Object.fromEntries(conflicts.map((field) => [field, latest[field]]));
        throw error;
      }
      const changed = [];
      for (const [field, value] of Object.entries(patch)) {
        const [targetField, mappedValue] = fieldMap(field, value);
        if (JSON.stringify(record[targetField]) !== JSON.stringify(mappedValue)) changed.push(field);
        record[targetField] = mappedValue;
      }
      if (!changed.length) return { ok: true, etag: file.etag, unchanged: true };
      validate?.(record, patch, data);
      appendActivity(data, actor, activityType, { studentId: collection === "students" ? record.id : "", note: collection === "students" ? changed.join(",") : `${record.title || record.date || "Record"} · ${changed.join(",")}` });
      const priorVersion = file.etag;
      try {
        const result = await commit(file, data, actor, reason);
        return { ...result, record: structuredClone(record), changed };
      } catch (error) {
        if (error.status !== 409) throw error;
        if (attempt === 2) {
          const busy = new StaffError(409, "The workbook is busy with another update. Your draft is still available; retry in a moment.");
          busy.code = "WORKBOOK_BUSY";
          throw busy;
        }
        const refreshed = await current();
        if (refreshed.etag === priorVersion) throw error;
      }
    }
    throw new StaffError(409, "The workbook is busy with another update. Retry in a moment.");
  }
  async function migrateData(actor, input = {}) {
    const target = await store.read(store.paths.unified, 10 * 1024 * 1024);
    if (target.value) throw new StaffError(409, "A Welcome Lounge workbook already exists. It was left unchanged.");
    const [release, stateFile, editorialFile, masterFile] = await Promise.all([
      store.readJson(store.paths.release),
      store.readJson(store.paths.state),
      store.read(store.paths.editorial, 10 * 1024 * 1024),
      store.read(store.paths.master, 10 * 1024 * 1024),
    ]);
    let content = release.value?.content || {};
    if (!release.value) {
      const legacyKinds = ["config", "onboarding", "after-arrival", "health-insurance", "useful-links", "rundfunk", "support-resources", "community-resources"];
      const values = await Promise.all(legacyKinds.map((kind) => store.readJson(`app-content/${kind}.json`)));
      content = Object.fromEntries(legacyKinds.map((kind, index) => [kind, values[index].value]).filter(([, value]) => value));
    }
    if (!release.value && editorialFile.value && !content.onboarding) {
      try { content = (await parseContentWorkbook(editorialFile.value)).content; }
      catch (error) { throw new StaffError(422, `The existing content workbook could not be migrated. ${error.message}`); }
    }
    const config = content.config || {};
    const items = [];
    const add = (section, value) => {
      const baseId = value.id || slug(value.title || "content-item");
      const id = uniqueContentId(baseId, items);
      items.push({ id, section, order: Number.isInteger(value.order) && value.order > 0 ? value.order : 1 + items.filter((item) => item.section === section).length, title: value.title || "Information", text: value.summary || value.description || value.shortText || "", link: value.officialSource || value.url || value.officialUrl || value.websiteUrl || value.telegramUrl || value.instagramUrl || "", active: value.isActive !== false });
    };
    for (const topic of content.onboarding?.topics || []) add("First Step", topic);
    for (const item of content["useful-links"]?.links || []) add("Useful Info", item);
    for (const item of content["support-resources"]?.resources || []) add("Student Support", item);
    for (const item of content["community-resources"]?.resources || []) add("Community", item);
    for (const topic of content["after-arrival"]?.topics || []) add("Useful Info", topic);
    for (const provider of content["health-insurance"]?.providers || []) add("Useful Info", { id: provider.id, title: provider.name, description: [provider.address, ...Object.entries(provider.openingHours || {}).filter(([, hours]) => hours).map(([day, hours]) => `${day}: ${hours}`)].filter(Boolean).join("\n"), url: "" });
    if (content.rundfunk?.sections?.length) add("Useful Info", { id: "rundfunkbeitrag", title: "Rundfunkbeitrag", description: content.rundfunk.sections.map((section) => [section.heading, ...(section.paragraphs || [])].join("\n")).join("\n\n"), url: "" });
    if (config.helpText) add("Help", { id: "welcome-lounge-help", title: "Welcome Lounge support", description: config.helpText, url: config.whatsappGroupUrl || "" });
    let staffData = stateFile.value;
    if (!staffData && masterFile.value) {
      try { staffData = await parseMasterExcel(masterFile.value); }
      catch (error) { throw new StaffError(422, `The existing MasterExcel file could not be migrated. ${error.message}`); }
    }
    const legacyStudentIds = new Map();
    const students = (staffData?.students || []).map((student) => {
      const id = /^stu_[0-9a-f-]{36}$/i.test(student.id || "") ? student.id : idFor("stu");
      if (student.id) legacyStudentIds.set(student.id, id);
      return { id, legacyDate: student.legacyDate || student.dateAdded || "", name: student.name || "", matriculationNumber: String(student.matriculationNumber || ""), country: student.country || "", studyProgram: student.studyProgram || "", enrolled: student.enrolled ?? null, accommodation: yesNo(student.accommodation), accommodationContact: student.accommodationContact || "", address: student.address || "", receivedBackpack: student.receivedBackpack ?? null, cityRegistration: yesNo(student.cityRegistration), notes: student.notes || "", phone: student.phone || "", email: student.email || "", updatedAt: student.updatedAt || "", updatedBy: student.updatedBy || "" };
    });
    const shifts = (staffData?.shifts || []).map(toShiftDay);
    const staff = (staffData?.programTutors || []).filter((entry) => entry.tutor && entry.tutor !== "?").map((entry) => ({ id: idFor("staff"), name: entry.tutor, role: "tutor", program: entry.program || "", email: entry.email || "", phone: entry.phone || "", telegram: entry.telegram || "", isActive: true }));
    const activity = [];
    for (const entry of staffData?.checkins || []) {
      const mappedStudentId = legacyStudentIds.get(entry.studentId) || (students.some((student) => student.id === entry.studentId) ? entry.studentId : "");
      activity.push({ id: idFor("act"), timestamp: entry.timestamp || (entry.date ? `${entry.date}T12:00:00.000Z` : now()), type: "Check-in", studentId: mappedStudentId, actor: entry.actor?.name || "Staff", note: entry.status || "Checked in" });
    }
    for (const entry of staffData?.handover || []) activity.push({ id: idFor("act"), timestamp: entry.timestamp || (entry.date ? `${entry.date}T12:00:00.000Z` : now()), type: "Handover", studentId: "", actor: entry.author || "Staff", note: entry.note || "" });
    for (const entry of staffData?.audit || []) activity.push({ id: idFor("act"), timestamp: entry.timestamp || now(), type: entry.action?.startsWith("student") ? "Student Update" : "Other", studentId: legacyStudentIds.get(entry.recordId) || (students.some((student) => student.id === entry.recordId) ? entry.recordId : ""), actor: entry.actor?.name || "Staff", note: (entry.changedFields || []).join(",") });
    for (const entry of (staffData?.students || [])) if (!staffData?.audit?.some((audit) => audit.recordId === entry.id)) {
      const mapped = students.find((student) => student.id === entry.id);
      if (mapped?.updatedBy && mapped.updatedAt) activity.push({ id: idFor("act"), timestamp: mapped.updatedAt, type: "Student Update", studentId: mapped.id, actor: mapped.updatedBy, note: "Imported student details" });
    }
    const semesterLabel = String(input.semesterLabel || config.semesterLabel || staffData?.semesterLabel || "").trim();
    if (!semesterLabel) throw new StaffError(409, "Set the current semester in existing content or the staff setup before creating the workbook.");
    const data = { settings: { semesterLabel, whatsappGroupUrl: config.whatsappGroupUrl || "", whatsappEnabled: Boolean(config.whatsappEnabled), contentReviewedDate: config.contentReviewedDate || "" }, content: items, students, activity, staff, shifts };
    const bytes = await serializeUnifiedWorkbook(data);
    await store.writeBytes(store.paths.unified, bytes, null);
    return { ok: true, contentItems: items.length, students: students.length, activity: activity.length, shifts: shifts.length, createdBy: actor.name };
  }
  const sha = (value) => createHash("sha256").update(value).digest("hex");
  function workspaceData(data) {
    const programTutors = data.programTutors;
    return { version: 1, semesterLabel: data.semesterLabel, students: data.students, programTutors, shifts: data.shifts, checkins: data.checkins, handover: data.handover, audit: data.audit, lastImported: data.lastImported };
  }
  return {
    async workspace(actor = { role: "admin" }) {
      const file = await current();
      const admin = actor.role === "admin";
      const shiftLog = file.parsed.data.activity.filter((item) => item.type === "Shift Update").sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 30);
      return { data: workspaceData(file.parsed.data), etag: file.etag, today: dateToday(), shiftSummary: shiftSummary(file.parsed.data.shifts), shiftTimes: file.parsed.data.shiftTimes, schedule: file.parsed.data.schedule, tutors: file.parsed.data.tutors, shiftLog: admin ? shiftLog : [], unified: true, ...(admin ? {} : { data: { ...workspaceData(file.parsed.data), audit: [] } }) };
    },
    async listArrivals() {
      const { parsed } = await current();
      return parsed.data.checkins.filter((entry) => entry.date === dateToday());
    },
    async updateStudent(actor, input) {
      if (input.patch && input.base) return mutateFields(actor, input, {
        id: input.id, collection: "students", allowed: STUDENT_FIELDS,
        reason: "student update", activityType: "Student Update",
        validate(record, patch, data) {
          for (const [field, value] of Object.entries(patch)) checkStudentField(field, value, record, data);
        },
      });
      const allowed = new Set(STUDENT_FIELDS);
      if (!input.patch || Object.keys(input.patch).length === 0 || Object.keys(input.patch).some((field) => !allowed.has(field))) throw new StaffError(400, "Only the listed student support details can be changed.");
      return mutate(actor, input, "student update", (data) => {
        const student = data.students.find((item) => item.id === input.id);
        if (!student) throw new StaffError(404, "Student not found.");
        for (const [field, value] of Object.entries(input.patch)) {
          student[field] = typeof value === "string" ? text(value) : value;
          checkStudentField(field, value, student, data);
        }
        appendActivity(data, actor, "Student Update", { studentId: student.id, note: Object.keys(input.patch).join(",") });
      });
    },
    async addStudent(actor, input) {
      return mutate(actor, input, "student added", (data) => {
        const name = text(input.name || "", 200).trim();
        if (!name) throw new StaffError(400, "Enter the student's full name.");
        const matriculationNumber = text(input.matriculationNumber || "", 100).trim();
        const normalizedMatriculationNumber = matriculationNumber.toLocaleLowerCase("en");
        if (normalizedMatriculationNumber && data.students.some((student) => String(student.matriculationNumber || "").trim().toLocaleLowerCase("en") === normalizedMatriculationNumber)) {
          throw new StaffError(409, "A student with this matriculation number already exists.");
        }
        const email = text(input.email || "", 254).trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StaffError(400, "Enter a valid email address.");
        const student = { id: idFor("stu"), legacyDate: dateToday(), name, matriculationNumber, country: text(input.country || "", 200), studyProgram: text(input.studyProgram || "", 300), phone: text(input.phone || "", 100), email, enrolled: null, accommodation: null, accommodationContact: "", address: "", receivedBackpack: null, cityRegistration: null, notes: text(input.notes || "", 4000), updatedAt: now(), updatedBy: actor.name };
        data.students.push(student);
        appendActivity(data, actor, "Student Update", { studentId: student.id, note: "Student created" });
        return student.id;
      }, { major: true, safeRetry: true });
    },
    async checkIn(actor, input) {
      return mutate(actor, input, "daily operations", (data) => {
        if (!data.students.some((student) => student.id === input.id)) throw new StaffError(404, "Student not found.");
        if (data.activity.some((item) => item.type === "Check-in" && item.studentId === input.id && item.timestamp.slice(0, 10) === dateToday())) return false;
        appendActivity(data, actor, "Check-in", { studentId: input.id, note: "Checked in" });
      }, { safeRetry: true });
    },
    async addHandover(actor, input) {
      const note = text(input.note || "", 4000).trim();
      if (!note) throw new StaffError(400, "Write a handover note.");
      return mutate(actor, input, "daily operations", (data) => {
        const studentId = input.studentId || "";
        if (studentId && !data.students.some((student) => student.id === studentId)) throw new StaffError(404, "Student not found.");
        appendActivity(data, actor, "Handover", { studentId, note });
      });
    },
    async contentStatus() {
      const file = await current();
      const publicContent = publicContentFromWorkbook(file.parsed, samples);
      const content = Object.fromEntries(CONTENT_KINDS.map((kind) => [kind, validateContent(kind, publicContent[kind] || samples[kind])]));
      const backups = await store.readJson(store.paths.unifiedBackupStatus);
      return { content, items: file.parsed.data.content, settings: file.parsed.data.settings, staff: file.parsed.data.staff, warnings: file.parsed.warnings, idAssignments: file.parsed.idAssignments, etag: file.etag, sourceFilename: store.paths.unifiedName, nextcloudBrowserUrl: "", workbook: { available: true, lastModified: file.lastModified || "", matchesPublished: true }, lastBackup: backups.value?.lastBackupAt || "", lastBackupBy: backups.value?.lastBackupBy || "", history: [] };
    },
    async getConfig() {
      const file = await current();
      return { config: file.parsed.data.settings, etag: file.etag };
    },
    async saveContent(actor, input) {
      const item = input.item;
      if (!item || !contentSections.has(item.section)) throw new StaffError(400, "Choose a content section.");
      const title = text(item.title || "", 200).trim(), description = text(item.text || "", 12000).trim();
      if (!title || !description) throw new StaffError(400, "Enter a title and short text.");
      const link = text(item.link || "", 1000).trim();
      if (link && !/^https:\/\//i.test(link)) throw new StaffError(400, "Use a complete HTTPS link.");
      const order = Number(item.order);
      if (!Number.isInteger(order) || order < 1 || order > 10000) throw new StaffError(400, "Order must be a positive whole number.");
      return mutate(actor, input, "content updated", (data) => {
        const existing = item.id ? data.content.find((entry) => entry.id === item.id) : null;
        if (item.id && !existing) throw new StaffError(404, "Content item not found.");
        const id = existing?.id || uniqueContentId(slug(title), data.content);
        const next = { id, section: item.section, order, title, text: description, link, active: item.active === true };
        const duplicateOrder = data.content.find((entry) => entry.id !== id && entry.section === next.section && entry.order === order);
        if (duplicateOrder) throw new StaffError(400, "Another item in this section already uses that order.");
        if (existing) Object.assign(existing, next); else data.content.push(next);
        appendActivity(data, actor, "Content Update", { note: `${existing ? "Updated" : "Added"} ${next.section}: ${next.title}` });
      }, { major: true });
    },
    async deleteContent(actor, input) {
      const id = text(input.id || "", 100).trim();
      if (!id) throw new StaffError(400, "Choose a content item to remove.");
      return mutate(actor, input, "content removed", (data) => {
        const index = data.content.findIndex((entry) => entry.id === id);
        if (index < 0) throw new StaffError(404, "Content item not found.");
        const [removed] = data.content.splice(index, 1);
        appendActivity(data, actor, "Content Update", { note: `Removed ${removed.section}: ${removed.title}` });
      }, { major: true, safeRetry: true });
    },
    async autosaveContent(actor, input) {
      return mutateFields(actor, input, {
        id: input.id, collection: "content", allowed: ["title", "text", "link", "active", "order"], reason: "content update", activityType: "Content Update",
        validate(record) {
          if (!record.title?.trim() || record.title.length > 200 || !record.text?.trim() || record.text.length > 12000) throw new StaffError(400, "Enter a title and short text before saving.");
          if (!Number.isInteger(record.order) || record.order < 1 || record.order > 10000) throw new StaffError(400, "Order must be a positive whole number.");
          if (typeof record.active !== "boolean") throw new StaffError(400, "Choose whether this item is active.");
          if (record.link && !safeLink(record.link)) throw new StaffError(400, "Use a valid public HTTPS link.");
          if (record.active && record.section === "First Step" && !record.text.trim()) throw new StaffError(400, "An active First Step needs a short text description.");
          if (record.active && record.section === "Community" && !record.link) throw new StaffError(400, "An active Community item needs a link.");
        },
      });
    },
    async deactivateContent(actor, input) {
      return mutate(actor, input, "content deactivated", (data) => {
        const item = data.content.find((entry) => entry.id === input.id);
        if (!item) throw new StaffError(404, "Content item not found.");
        item.active = false;
        appendActivity(data, actor, "Content Update", { note: `Deactivated ${item.section}: ${item.title}` });
      }, { major: true });
    },
    async listEvents() {
      const file = await current();
      return { events: file.parsed.data.events || [], etag: file.etag };
    },
    async saveEvent(actor, input) {
      const item = input.event || {};
      const next = { title: text(item.title || "", 200).trim(), date: text(item.date || "", 10), startTime: text(item.startTime || "", 5), endTime: text(item.endTime || "", 5), location: text(item.location || "", 300).trim(), description: text(item.description || "", 12000).trim(), link: text(item.link || "", 1000).trim(), active: item.active === true };
      checkEvent(next);
      return mutate(actor, input, "event updated", (data) => {
        data.events ||= [];
        const existing = item.id ? data.events.find((entry) => entry.id === item.id) : null;
        if (item.id && !existing) throw new StaffError(404, "Event not found.");
        const id = existing?.id || uniqueContentId(`event-${slug(`${next.date} ${next.title}`)}`.slice(0, 80), data.events);
        if (existing) Object.assign(existing, next); else data.events.push({ id, ...next });
        appendActivity(data, actor, "Content Update", { note: `${existing ? "Updated" : "Added"} event: ${next.title}` });
      }, { major: true });
    },
    async autosaveEvent(actor, input) {
      return mutateFields(actor, input, {
        id: input.id, collection: "events", allowed: ["title", "date", "startTime", "endTime", "location", "description", "link", "active"], reason: "event update", activityType: "Content Update",
        validate: checkEvent,
      });
    },
    async deleteEvent(actor, input) {
      const id = text(input.id || "", 100).trim();
      if (!id) throw new StaffError(400, "Choose an event to remove.");
      return mutate(actor, input, "event removed", (data) => {
        const index = (data.events || []).findIndex((entry) => entry.id === id);
        if (index < 0) throw new StaffError(404, "Event not found.");
        const [removed] = data.events.splice(index, 1);
        appendActivity(data, actor, "Content Update", { note: `Removed event: ${removed.title}` });
      }, { major: true, safeRetry: true });
    },
    async saveSettings(actor, input) {
      return mutate(actor, input, "settings updated", (data) => {
        const semesterLabel = text(input.semesterLabel || "", 100).trim();
        if (!semesterLabel) throw new StaffError(400, "Enter the current semester.");
        const url = text(input.whatsappGroupUrl || "", 500).trim();
        const enabled = input.whatsappEnabled === true;
        if (enabled && !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+\/?$/i.test(url)) throw new StaffError(400, "Enter a valid WhatsApp group invitation or turn WhatsApp off.");
        data.settings = { ...data.settings, semesterLabel, whatsappEnabled: enabled, whatsappGroupUrl: enabled ? url : "", contentReviewedDate: text(input.contentReviewedDate || "", 10) };
        data.semesterLabel = semesterLabel;
        appendActivity(data, actor, "Content Update", { note: "Updated semester and support settings" });
      }, { major: true });
    },
    async staffRoster() {
      const file = await current();
      return { staff: file.parsed.data.staff.filter((person) => person.isActive), etag: file.etag };
    },
    async saveStaff(actor, input) {
      const item = input.staff || {};
      const name = text(item.name || "", 200).trim();
      if (!name) throw new StaffError(400, "Enter a staff member name.");
      if (!new Set(["tutor", "admin"]).has(item.role)) throw new StaffError(400, "Choose Tutor or Admin.");
      return mutate(actor, input, "staff list updated", (data) => {
        const currentStaff = item.id ? data.staff.find((person) => person.id === item.id) : null;
        if (item.id && !currentStaff) throw new StaffError(404, "Staff member not found.");
        const next = { id: currentStaff?.id || idFor("staff"), name, role: item.role, program: text(item.program || "", 300), email: text(item.email || "", 254), phone: text(item.phone || "", 100), telegram: text(item.telegram || "", 200), isActive: item.active === true };
        if (currentStaff) Object.assign(currentStaff, next); else data.staff.push(next);
        data.programTutors = data.staff.filter((person) => person.program).map(({ program, name: tutor, email, phone, telegram }) => ({ program, tutor, email, phone, telegram }));
        appendActivity(data, actor, "Other", { note: `${currentStaff ? "Updated" : "Added"} staff member` });
      }, { major: true, allowUnassigned: true });
    },
    async saveScheduleSetup(actor, input) {
      const start = text(input.start || "", 10), end = text(input.end || "", 10);
      if ((start && !isDate(start)) || (end && !isDate(end))) throw new StaffError(400, "Enter valid start and end dates.");
      if (start && end && end < start) throw new StaffError(400, "The end date must be on or after the start date.");
      const times = [input.shift1Time, input.shift2Time].map((value) => text(value || "", 40).trim());
      return mutate(actor, input, "schedule setup", (data) => {
        data.schedule = { start, end };
        data.shiftTimes = { first: times[0] || DEFAULT_SHIFT_TIMES.first, second: times[1] || DEFAULT_SHIFT_TIMES.second };
        appendActivity(data, actor, "Shift Update", { note: `Semester setup: ${start || "no start"} – ${end || "no end"} · S1 ${data.shiftTimes.first} · S2 ${data.shiftTimes.second}` });
      }, { major: true });
    },
    async saveTutors(actor, input) {
      if (!Array.isArray(input.tutors) || input.tutors.length > MAX_TUTORS) throw new StaffError(400, `Send the tutor list (at most ${MAX_TUTORS} names).`);
      const tutors = input.tutors.map((name) => text(name ?? "", 200).trim()).filter(Boolean);
      const keys = tutors.map((name) => name.toLocaleLowerCase("en"));
      const duplicate = tutors.find((_, index) => keys.indexOf(keys[index]) !== index);
      if (duplicate) throw new StaffError(400, `“${duplicate}” is in the list twice.`);
      return mutate(actor, input, "tutor list", (data) => {
        const before = data.tutors || [];
        const added = tutors.filter((name) => !before.includes(name)), removed = before.filter((name) => !tutors.includes(name));
        if (!added.length && !removed.length && before.join("\n") === tutors.join("\n")) return false;
        data.tutors = tutors;
        appendActivity(data, actor, "Other", { note: `Tutor list updated${added.length ? ` · added: ${added.join(", ")}` : ""}${removed.length ? ` · removed: ${removed.join(", ")}` : ""}${!added.length && !removed.length ? " · reordered" : ""}` });
      }, { major: true });
    },
    async activityLog() {
      const { parsed } = await current();
      const studentNames = new Map(parsed.data.students.map((student) => [student.id, student.name]));
      return { entries: [...parsed.data.activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500).map((entry) => ({ ...entry, studentName: studentNames.get(entry.studentId) || "" })) };
    },
    async updateShiftDay(actor, input) {
      const date = text(input.date || input.id || "", 10);
      if (!isDate(date)) throw new StaffError(400, "Choose a valid date.");
      const patch = input.patch, base = input.base;
      if (!patch || typeof patch !== "object" || !Object.keys(patch).length || Object.keys(patch).some((field) => !SHIFT_FIELDS.includes(field))) throw new StaffError(400, "Only shift names and the day note can be changed.");
      if (!base || typeof base !== "object" || Object.keys(patch).some((field) => typeof base[field] !== "string")) throw new StaffError(400, "Reload the schedule before saving your changes.");
      for (const [field, value] of Object.entries(patch)) text(value, field === "note" ? 1000 : 200);
      return mutate(actor, input, "shift update", (data) => {
        let day = data.shifts.find((entry) => entry.date === date);
        if (!day) { day = toShiftDay({ date }); data.shifts.push(day); }
        const conflicts = Object.keys(patch).filter((field) => shiftValue(day, field) !== base[field] && shiftValue(day, field) !== patch[field]);
        if (conflicts.length) {
          const error = new StaffError(409, "Someone else changed this day. Review both versions before continuing.");
          error.code = "EDIT_CONFLICT"; error.fields = conflicts; error.latest = Object.fromEntries(conflicts.map((field) => [field, shiftValue(day, field)]));
          throw error;
        }
        const changes = [];
        for (const [field, value] of Object.entries(patch)) {
          const before = shiftValue(day, field), after = value.trim();
          if (before === after) continue;
          setShiftValue(day, field, after);
          changes.push(`${shiftFieldLabel(field)}: “${before || "—"}” → “${after || "—"}”`);
        }
        if (!changes.length) return false;
        if (![...day.first, ...day.second, day.event].some(Boolean)) data.shifts = data.shifts.filter((entry) => entry !== day);
        appendActivity(data, actor, "Shift Update", { note: `${date} · ${changes.join(" · ")}` });
      }, { safeRetry: true });
    },
    async previewMasterExcelImport() {
      const [file, currentFile] = await Promise.all([store.read(store.paths.master, 10 * 1024 * 1024), current()]);
      if (!file.value) throw new StaffError(404, "MasterExcel.xlsx is missing from the private staff folder.");
      const parsed = await parseMasterExcel(file.value);
      return { data: parsed, currentCount: currentFile.parsed.data.students.length, sourceHash: sha(file.value), etag: currentFile.etag, warnings: parsed.warnings || [] };
    },
    async commitMasterExcelImport(actor, input) {
      if (input.reviewed !== true) throw new StaffError(400, "Review the workbook before importing it.");
      const [file, currentFile] = await Promise.all([store.read(store.paths.master, 10 * 1024 * 1024), current()]);
      if (!file.value) throw new StaffError(404, "MasterExcel.xlsx is missing from the private staff folder.");
      if (!input.sourceHash || input.sourceHash !== sha(file.value) || input.etag !== currentFile.etag) throw new StaffError(409, "A workbook changed while you were reviewing the import. Preview again.");
      const parsed = await parseMasterExcel(file.value);
      const data = structuredClone(currentFile.parsed.data);
      for (const row of parsed.students) {
        const mat = String(row.matriculationNumber || "");
        const existing = data.students.find((student) => mat && student.matriculationNumber === mat) || data.students.find((student) => !mat && student.name === row.name && student.studyProgram === row.studyProgram);
        if (existing) Object.assign(existing, { ...row, id: existing.id, matriculationNumber: mat, enrolled: existing.enrolled, receivedBackpack: existing.receivedBackpack, accommodation: existing.accommodation, address: existing.address, cityRegistration: existing.cityRegistration, notes: existing.notes });
        else data.students.push({ ...row, id: idFor("stu"), matriculationNumber: mat, enrolled: null, accommodation: null, accommodationContact: "", address: "", receivedBackpack: null, cityRegistration: null, notes: "", updatedAt: now(), updatedBy: actor.name });
      }
      for (const item of parsed.programTutors.filter((entry) => entry.tutor && entry.tutor !== "?")) {
        if (!data.staff.some((person) => person.name === item.tutor && person.program === item.program)) data.staff.push({ id: idFor("staff"), name: item.tutor, role: "tutor", program: item.program, email: item.email || "", phone: item.phone || "", telegram: item.telegram || "", isActive: true });
      }
      const importedShifts = parsed.shifts.map(toShiftDay);
      const importedDates = new Set(importedShifts.map((shift) => shift.date));
      data.shifts = [...data.shifts.filter((shift) => !importedDates.has(shift.date)), ...importedShifts];
      data.semesterLabel = input.semesterLabel || data.semesterLabel;
      data.settings.semesterLabel = data.semesterLabel;
      appendActivity(data, actor, "Other", { note: `Imported MasterExcel data: ${parsed.students.length} students` });
      await commit(currentFile, data, actor, "MasterExcel import", { major: true });
      return { ok: true, students: parsed.students.length };
    },
    async exportStudents({ date, by }) {
      if (!isDate(date)) throw new StaffError(400, "Choose a valid date.");
      if (!Object.hasOwn(EXPORT_MODES, by)) throw new StaffError(400, "Choose checked-in or added students.");
      const { parsed } = await current();
      return exportStudentsForDay(parsed.data, date, by);
    },
    async exportMasterExcel() {
      const { parsed } = await current();
      return exportMasterExcel(workspaceData(parsed.data));
    },
    async createBackup(actor) {
      const file = await current();
      const status = await recordBackup(file, actor, "Manual backup", false);
      return { ok: true, createdAt: status.lastBackupAt };
    },
    async status() {
      try {
        const file = await current();
        const backupStatus = await store.readJson(store.paths.unifiedBackupStatus);
        return { connected: true, workbook: "available", lastModified: file.lastModified || "", lastWrite: file.lastModified || "", lastBackup: backupStatus.value?.lastBackupAt || "", fileName: store.paths.unifiedName };
      } catch (error) {
        if (error.status === 404 || error.status === 409) return { connected: true, workbook: "missing", fileName: store.paths.unifiedName };
        if (error.status === 503) return { connected: false, workbook: "unknown", fileName: store.paths.unifiedName };
        if (error.status === 422) return { connected: true, workbook: "invalid", error: error.message, fileName: store.paths.unifiedName };
        return { connected: false, workbook: "invalid", fileName: store.paths.unifiedName };
      }
    },
    async initialize(actor, input = {}) {
      if (input.confirm !== true) throw new StaffError(400, "Confirm that you want to create the unified workbook from existing private app data.");
      return migrateData(actor, input);
    },
    async createFromTemplate(actor, input = {}) {
      if (input.confirm !== true) throw new StaffError(400, "Confirm that you want to create a workbook from the safe template.");
      const existing = await store.read(store.paths.unified, 10 * 1024 * 1024);
      if (existing.value) throw new StaffError(409, "A Welcome Lounge workbook already exists. It was left unchanged.");
      const semesterLabel = text(input.semesterLabel || "", 100).trim();
      if (!semesterLabel) throw new StaffError(400, "Enter the current semester before creating the workbook.");
      const bytes = await createUnifiedWorkbookTemplate({ semesterLabel });
      await store.writeBytes(store.paths.unified, bytes, null);
      return { ok: true, contentItems: 5, createdBy: actor.name };
    },
    async downloadWorkbook() {
      return (await current()).value;
    },
  };
}
function uniqueContentId(base, items) {
  const used = new Set(items.map((item) => item.id));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}
