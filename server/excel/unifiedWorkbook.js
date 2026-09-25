import ExcelJS from "exceljs";
import { booleanValue, cellText, dateValue, key, readWorkbook, rows, WorkbookError } from "./excelUtils.js";
import { inferLinkLabel, safeLink, whatsappLink } from "../../shared/content.js";

export const UNIFIED_WORKBOOK = "Welcome-Lounge.xlsx";
export const SHIFT_SLOTS = ["S1", "S2"];
export const DEFAULT_SHIFT_TIMES = { first: "10:00–13:00", second: "12:00–15:00" };
export const DEFAULT_TUTORS_PER_SHIFT = 3;
const LEGACY_SHIFT_HEADERS = ["ID", "Date", "Start", "End", "Tutor 1", "Tutor 2", "Tutor 3", "Important Event", "Notes"];
export const SHEETS = ["Settings", "Content", "Students", "Activity", "Staff", "Shifts"];
// Optional tabs: older workbooks without them stay valid; the app writes them on the next save.
export const OPTIONAL_SHEETS = ["Events", "Tutors"];
export const MAX_TUTORS = 100;
// Staff tab Role column: stored key → label shown in Excel ("Super Admin" reads as "superadmin").
export const STAFF_ROLE_LABELS = { tutor: "Tutor", coordinator: "Coordinator", admin: "Admin", superadmin: "Super Admin" };
export const HEADERS = {
  Settings: ["Setting", "Value"],
  Content: ["Section", "Order", "Title", "Text", "Link", "Active", "ID"],
  Students: ["ID", "Date Added", "Full Name", "Matriculation Number", "Country", "Study Program", "Enrolled", "Accommodation", "Address", "Backpack Received", "City Registration", "Notes", "Phone", "Email", "Contact (if no accommodation)", "Added By"],
  Activity: ["ID", "Timestamp", "Type", "Student ID", "Actor", "Note"],
  Staff: ["ID", "Name", "Role", "Program", "Email", "Phone", "Telegram", "Active"],
  // One row per day: two shifts with up to four people each, plus a day note (e.g. "Bank Holiday").
  Shifts: ["Date", ...SHIFT_SLOTS.flatMap((slot) => [1, 2, 3, 4].map((n) => `${slot} - Person ${n}`)), "Note"],
  Events: ["Title", "Date", "Start", "End", "Location", "Description", "Link", "Active", "ID"],
  Tutors: ["Tutor", "Name"],
};
const sectionMap = new Map(["First Step", "Useful Info", "Student Support", "Community", "Help"].map((x) => [key(x), x]));
const bool = (value, context, blank = null) => {
  const parsed = booleanValue(value);
  if (parsed === null && cellText(value)) throw new WorkbookError(`${context} must be TRUE or FALSE.`);
  return parsed ?? blank;
};
const required = (value, context, max = 12000) => {
  const result = cellText(value);
  if (!result || result.length > max) throw new WorkbookError(`${context} is required and must be under ${max} characters.`);
  return result;
};
const safeUrl = (value, context, optional = true) => {
  const raw = cellText(value);
  if (!raw && optional) return "";
  const result = safeLink(raw);
  if (!result) throw new WorkbookError(`${context} must be a public HTTPS link.`);
  return result;
};
const slug = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70).replace(/-+$/g, "") || "content-item";
const uniqueId = (base, used) => {
  let id = base, n = 2;
  while (used.has(id)) id = `${base.slice(0, 70)}-${n++}`;
  used.add(id);
  return id;
};
const dateCell = (value, context, optional = true) => {
  if (!cellText(value)) return optional ? "" : (() => { throw new WorkbookError(`${context} is required.`); })();
  try { return dateValue(value); } catch { throw new WorkbookError(`${context} must be an Excel date or YYYY-MM-DD.`); }
};
const OPTIONAL_HEADERS = { Students: new Set(["Phone", "Email", "Contact (if no accommodation)", "Added By"]) };
// Accommodation and City Registration used to be free text; any old non-empty text counts as ticked.
const checkbox = (value) => booleanValue(value) ?? (cellText(value) ? true : null);
// Excel may store a time as text ("14:00"), a day fraction (0.5833) or a Date on 1899-12-30.
const timeCell = (raw, context) => {
  const value = raw?.result ?? raw;
  let minutes = null;
  if (value instanceof Date) minutes = value.getUTCHours() * 60 + value.getUTCMinutes();
  else if (typeof value === "number" && value >= 0 && value < 1) minutes = Math.round(value * 1440);
  else {
    const textValue = cellText(value);
    if (!textValue) return "";
    const match = textValue.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
    if (match && Number(match[1]) < 24 && Number(match[2]) < 60) minutes = Number(match[1]) * 60 + Number(match[2]);
  }
  if (minutes === null || minutes >= 1440) throw new WorkbookError(`${context} must be a 24-hour time such as 14:00.`);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
const readTable = (workbook, name, labels = HEADERS[name]) => {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new WorkbookError(`The ${name} sheet is missing.`);
  const allRows = rows(sheet);
  const requiredHeaders = labels.filter((label) => !OPTIONAL_HEADERS[name]?.has(label));
  const header = allRows.find(({ values }) => requiredHeaders.every((label) => values.map(key).includes(key(label))));
  if (!header) return null;
  const headers = header.values.map(key);
  return { sheet, header, dataRows: allRows.filter((row) => row.number > header.number), col: Object.fromEntries(labels.map((label) => [label, headers.indexOf(key(label))])), labels };
};
const requireTable = (workbook, name) => {
  const table = readTable(workbook, name) || (name === "Shifts" ? readTable(workbook, name, LEGACY_SHIFT_HEADERS) : null);
  if (!table) throw new WorkbookError(`The ${name} sheet has missing or renamed column headings.`);
  return table;
};
const valueAt = (row, table, label) => row.values[table.col[label]] ?? "";
export const slotNames = (names = []) => [0, 1, 2, 3].map((index) => names[index] || "");
function readShiftDays(table) {
  const days = new Map();
  const name = (row, label) => {
    const value = cellText(valueAt(row, table, label));
    if (value.length > 200) throw new WorkbookError(`Shifts row ${row.number}: ${label} is too long.`);
    return value;
  };
  for (const row of table.dataRows) {
    if (!row.values.some((value) => String(value ?? "").trim())) continue;
    const date = dateCell(row.row.getCell(table.col.Date + 1).value, `Shifts row ${row.number} Date`, false);
    if (table.labels === LEGACY_SHIFT_HEADERS) {
      // Old format had one row per shift: afternoon starts (12:00 or later) become S2.
      const day = days.get(date) || { id: date, date, first: [], second: [], event: "" };
      const slot = name(row, "Start") >= "12:00" ? day.second : day.first;
      slot.push(...["Tutor 1", "Tutor 2", "Tutor 3"].map((label) => name(row, label)).filter(Boolean));
      day.event = [day.event, name(row, "Important Event"), cellText(valueAt(row, table, "Notes"))].filter(Boolean).join("\n");
      days.set(date, day);
      continue;
    }
    if (days.has(date)) throw new WorkbookError(`Shifts row ${row.number}: ${date} appears twice. Use one row per day.`);
    const people = (slot) => [1, 2, 3, 4].map((n) => name(row, `${slot} - Person ${n}`));
    const event = cellText(valueAt(row, table, "Note"));
    if (event.length > 1000) throw new WorkbookError(`Shifts row ${row.number}: Note is too long.`);
    days.set(date, { id: date, date, first: people("S1"), second: people("S2"), event });
  }
  // Legacy days may hold more than four people per shift; keep extras visible in the note.
  return [...days.values()].map((day) => {
    const extra = [...day.first.slice(4), ...day.second.slice(4)];
    return { ...day, first: slotNames(day.first), second: slotNames(day.second), event: extra.length ? [day.event, `Also: ${extra.join(", ")}`].filter(Boolean).join("\n") : day.event };
  });
}

export async function parseUnifiedWorkbook(bytes) {
  const workbook = await readWorkbook(bytes);
  if (SHEETS.some((name) => !workbook.getWorksheet(name)) || workbook.worksheets.some((sheet) => !SHEETS.includes(sheet.name) && !OPTIONAL_SHEETS.includes(sheet.name)))
    throw new WorkbookError(`The workbook must contain these sheets: ${SHEETS.join(", ")} (and optionally ${OPTIONAL_SHEETS.join(", ")}).`);
  const tables = Object.fromEntries([...SHEETS, ...OPTIONAL_SHEETS].filter((name) => name !== "Settings" && workbook.getWorksheet(name)).map((name) => [name, requireTable(workbook, name)]));
  const settingsSheet = workbook.getWorksheet("Settings");
  const settingsRows = rows(settingsSheet);
  const settingsHeader = settingsRows.find(({ values }) => values.map(key).includes("setting") && values.map(key).includes("value"));
  if (!settingsHeader) throw new WorkbookError("The Settings sheet must include Setting and Value column headings.");
  const settingMap = new Map();
  for (const row of settingsRows.filter((entry) => entry.number > settingsHeader.number)) {
    const setting = key(row.values[0]);
    if (setting) {
      if (settingMap.has(setting)) throw new WorkbookError(`Settings contains duplicate ${row.values[0]}.`);
      settingMap.set(setting, row.values[1] || "");
    }
  }
  const semesterLabel = required(settingMap.get("semester"), "Semester", 100);
  const workbookVersion = cellText(settingMap.get("workbookversion"));
  if (workbookVersion && workbookVersion !== "1") throw new WorkbookError(`Workbook version ${workbookVersion} is not supported by this app.`);
  const whatsappEnabled = bool(settingMap.get("whatsappenabled"), "WhatsApp Enabled", false);
  const shiftTimes = { first: cellText(settingMap.get("shift1time")).slice(0, 40) || DEFAULT_SHIFT_TIMES.first, second: cellText(settingMap.get("shift2time")).slice(0, 40) || DEFAULT_SHIFT_TIMES.second };
  const whatsappGroupUrl = safeUrl(settingMap.get("whatsappgroupurl"), "WhatsApp Group URL");
  const perShiftText = cellText(settingMap.get("tutorspershift"));
  if (perShiftText && !/^[1-4]$/.test(perShiftText)) throw new WorkbookError("Tutors per Shift must be a whole number from 1 to 4.");
  const schedule = { start: dateCell(settingMap.get("schedulestart"), "Schedule Start"), end: dateCell(settingMap.get("scheduleend"), "Schedule End"), perShift: Number(perShiftText || DEFAULT_TUTORS_PER_SHIFT) };
  if (schedule.start && schedule.end && schedule.end < schedule.start) throw new WorkbookError("Schedule End must be on or after Schedule Start.");
  const config = { version: 1, semesterLabel, contactLabel: "Welcome Lounge tutors", helpText: "For individual questions, contact the Welcome Lounge.", whatsappEnabled, whatsappGroupUrl: whatsappEnabled ? whatsappGroupUrl : "", contentReviewedDate: dateCell(settingMap.get("lastreviewed"), "Last Reviewed") };
  if (whatsappEnabled && !whatsappLink(config)) throw new WorkbookError("When WhatsApp is enabled, enter a valid chat.whatsapp.com invitation link.");
  const contentIds = new Set(), content = [], idAssignments = [], warnings = [];
  for (const row of tables.Content.dataRows) {
    if (!row.values.some((value) => String(value ?? "").trim())) continue;
    const section = sectionMap.get(key(valueAt(row, tables.Content, "Section")));
    if (!section) throw new WorkbookError(`Content row ${row.number}: choose First Step, Useful Info, Student Support, Community or Help.`);
    const orderText = cellText(valueAt(row, tables.Content, "Order"));
    const order = /^\d+$/.test(orderText) ? Number(orderText) : NaN;
    if (!Number.isInteger(order) || order < 1 || order > 10000) throw new WorkbookError(`Content row ${row.number}: Order must be a positive whole number.`);
    const title = required(valueAt(row, tables.Content, "Title"), `Content row ${row.number} Title`, 200);
    const text = cellText(valueAt(row, tables.Content, "Text"));
    if (text.length > 12000) throw new WorkbookError(`Content row ${row.number}: Text is too long.`);
    const link = safeUrl(valueAt(row, tables.Content, "Link"), `Content row ${row.number} Link`);
    const active = bool(valueAt(row, tables.Content, "Active"), `Content row ${row.number} Active`, false);
    let id = cellText(valueAt(row, tables.Content, "ID"));
    if (!id) { id = uniqueId(slug(title), contentIds); idAssignments.push({ sheet: "Content", row: row.number, column: tables.Content.col.ID + 1, id }); }
    else {
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) throw new WorkbookError(`Content row ${row.number}: ID must use lowercase letters, numbers and hyphens.`);
      if (contentIds.has(id)) throw new WorkbookError(`Content row ${row.number}: duplicate ID ${id}.`);
      contentIds.add(id);
    }
    if (active && !text.trim()) throw new WorkbookError(`Content row ${row.number}: active content needs a short Text description.`);
    if (active && section === "Community" && !link) throw new WorkbookError(`Content row ${row.number}: active Community items need a link.`);
    if (active && section === "First Step" && link) {
      const host = new URL(link).hostname.toLowerCase();
      if (host !== "uni-weimar.de" && !host.endsWith(".uni-weimar.de")) warnings.push(`First Step “${title}” links outside the university domain. Confirm that this is intentional.`);
    }
    content.push({ id, section, order, title, text, link, active, _row: row.number });
  }
  let events = null;
  if (tables.Events) {
    events = [];
    const eventIds = new Set();
    for (const row of tables.Events.dataRows) {
      if (!row.values.some((value) => String(value ?? "").trim())) continue;
      const context = `Events row ${row.number}`;
      const title = required(valueAt(row, tables.Events, "Title"), `${context} Title`, 200);
      // Raw cell values: Excel may hand back dates and times as Date objects or serial numbers.
      const raw = (label) => row.row.getCell(tables.Events.col[label] + 1).value;
      const date = dateCell(raw("Date"), `${context} Date`, false);
      const startTime = timeCell(raw("Start"), `${context} Start`), endTime = timeCell(raw("End"), `${context} End`);
      if (endTime && (!startTime || endTime < startTime)) throw new WorkbookError(`${context}: End must be after Start.`);
      const location = cellText(valueAt(row, tables.Events, "Location"));
      if (location.length > 300) throw new WorkbookError(`${context}: Location is too long.`);
      const description = cellText(valueAt(row, tables.Events, "Description"));
      const link = safeUrl(valueAt(row, tables.Events, "Link"), `${context} Link`);
      const active = bool(valueAt(row, tables.Events, "Active"), `${context} Active`, false);
      let id = cellText(valueAt(row, tables.Events, "ID"));
      if (!id) { id = uniqueId(`event-${slug(`${date} ${title}`)}`.slice(0, 80), eventIds); idAssignments.push({ sheet: "Events", row: row.number, column: tables.Events.col.ID + 1, id }); }
      else {
        if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) throw new WorkbookError(`${context}: ID must use lowercase letters, numbers and hyphens.`);
        if (eventIds.has(id)) throw new WorkbookError(`${context}: duplicate ID ${id}.`);
        eventIds.add(id);
      }
      events.push({ id, title, date, startTime, endTime, location, description, link, active, _row: row.number });
    }
  }
  const students = [];
  const studentIds = new Set();
  for (const row of tables.Students.dataRows) {
    if (!row.values.some((v) => String(v ?? "").trim())) continue;
    const name = required(valueAt(row, tables.Students, "Full Name"), `Students row ${row.number} Full Name`, 200);
    let id = cellText(valueAt(row, tables.Students, "ID"));
    if (!/^stu_[0-9a-f-]{36}$/i.test(id) || studentIds.has(id)) throw new WorkbookError(`Students row ${row.number}: enter a unique app-generated ID; do not use the row number or matriculation number.`);
    studentIds.add(id);
    const enrolled = bool(valueAt(row, tables.Students, "Enrolled"), `Students row ${row.number} Enrolled`);
    const receivedBackpack = bool(valueAt(row, tables.Students, "Backpack Received"), `Students row ${row.number} Backpack Received`);
    const accommodation = checkbox(valueAt(row, tables.Students, "Accommodation"));
    const cityRegistration = checkbox(valueAt(row, tables.Students, "City Registration"));
    students.push({ id, legacyDate: dateCell(valueAt(row, tables.Students, "Date Added"), `Students row ${row.number} Date Added`), name, matriculationNumber: cellText(valueAt(row, tables.Students, "Matriculation Number")), country: cellText(valueAt(row, tables.Students, "Country")), studyProgram: cellText(valueAt(row, tables.Students, "Study Program")), enrolled, accommodation, accommodationContact: cellText(valueAt(row, tables.Students, "Contact (if no accommodation)")), addedBy: cellText(valueAt(row, tables.Students, "Added By")), address: cellText(valueAt(row, tables.Students, "Address")), receivedBackpack, cityRegistration, notes: cellText(valueAt(row, tables.Students, "Notes")), phone: cellText(valueAt(row, tables.Students, "Phone")), email: cellText(valueAt(row, tables.Students, "Email")), updatedAt: "", updatedBy: "" });
  }
  const staff = [], staffIds = new Set();
  for (const row of tables.Staff.dataRows) {
    if (!row.values.some((v) => String(v ?? "").trim())) continue;
    const name = required(valueAt(row, tables.Staff, "Name"), `Staff row ${row.number} Name`, 200);
    const role = cellText(valueAt(row, tables.Staff, "Role")) || "Tutor";
    const roleKey = key(role);
    if (!Object.hasOwn(STAFF_ROLE_LABELS, roleKey)) throw new WorkbookError(`Staff row ${row.number}: Role must be Tutor, Coordinator, Admin or Super Admin.`);
    const id = cellText(valueAt(row, tables.Staff, "ID"));
    if (!/^staff_[0-9a-f-]{36}$/i.test(id)) throw new WorkbookError(`Staff row ${row.number}: enter a unique app-generated ID.`);
    if (staffIds.has(id)) throw new WorkbookError(`Staff row ${row.number}: duplicate ID.`);
    staffIds.add(id);
    staff.push({ id, name, role: roleKey, program: cellText(valueAt(row, tables.Staff, "Program")), email: cellText(valueAt(row, tables.Staff, "Email")), phone: cellText(valueAt(row, tables.Staff, "Phone")), telegram: cellText(valueAt(row, tables.Staff, "Telegram")), isActive: bool(valueAt(row, tables.Staff, "Active"), `Staff row ${row.number} Active`, false) });
  }
  const activity = [];
  const activityIds = new Set();
  for (const row of tables.Activity.dataRows) {
    if (!row.values.some((v) => String(v ?? "").trim())) continue;
    const timestamp = cellText(valueAt(row, tables.Activity, "Timestamp"));
    if (!Number.isFinite(Date.parse(timestamp))) throw new WorkbookError(`Activity row ${row.number}: Timestamp is invalid.`);
    const type = cellText(valueAt(row, tables.Activity, "Type"));
    if (!new Set(["Check-in", "Handover", "Student Update", "Content Update", "Shift Update", "Feedback", "Other"]).has(type)) throw new WorkbookError(`Activity row ${row.number}: Type is not supported.`);
    const id = cellText(valueAt(row, tables.Activity, "ID"));
    if (!/^act_[0-9a-f-]{36}$/i.test(id)) throw new WorkbookError(`Activity row ${row.number}: enter an app-generated ID.`);
    if (activityIds.has(id)) throw new WorkbookError(`Activity row ${row.number}: duplicate ID.`);
    activityIds.add(id);
    activity.push({ id, timestamp, type, studentId: cellText(valueAt(row, tables.Activity, "Student ID")), actor: cellText(valueAt(row, tables.Activity, "Actor")) || "Staff", note: cellText(valueAt(row, tables.Activity, "Note")) });
  }
  const shifts = readShiftDays(tables.Shifts);
  // Tutors are a plain list in row order; the "Tutor N" labels are renumbered on save.
  const tutors = [], tutorKeys = new Set();
  for (const row of tables.Tutors?.dataRows || []) {
    const tutorName = cellText(valueAt(row, tables.Tutors, "Name"));
    if (tutorName.length > 200) throw new WorkbookError(`Tutors row ${row.number}: Name is too long.`);
    const tutorKey = tutorName.toLocaleLowerCase("en");
    if (tutorName && !tutorKeys.has(tutorKey) && tutors.length < MAX_TUTORS) { tutorKeys.add(tutorKey); tutors.push(tutorName); }
  }
  for (const item of content) if (item.active && item.section === "First Step" && !item.text.trim()) throw new WorkbookError(`First Step ${item.title} needs a short Text description.`);
  for (const item of activity) if (item.studentId && !studentIds.has(item.studentId)) throw new WorkbookError(`Activity entry ${item.id} refers to a missing student ID.`);
  // Older rows have no "Added By": take it from the "Student created" entry in the activity history.
  for (const student of students) if (!student.addedBy) student.addedBy = activity.find((item) => item.studentId === student.id && item.note === "Student created")?.actor || "";
  const handover = activity.filter((item) => item.type === "Handover").map((item) => ({ id: item.id, date: item.timestamp.slice(0, 10), timestamp: item.timestamp, author: item.actor, note: item.note }));
  const checkins = activity.filter((item) => item.type === "Check-in").map((item) => ({ id: item.id, studentId: item.studentId, date: item.timestamp.slice(0, 10), timestamp: item.timestamp, actor: { id: "", name: item.actor }, status: item.note }));
  const audit = activity.filter((item) => ["Student Update", "Content Update"].includes(item.type)).map((item) => ({ id: item.id, actor: { id: "", name: item.actor, role: "tutor" }, action: item.type === "Student Update" ? "student.fields" : "content.update", recordId: item.studentId, changedFields: item.note.split(",").filter(Boolean), timestamp: item.timestamp }));
  for (const entry of audit) {
    const student = students.find((item) => item.id === entry.recordId);
    if (student) { student.updatedAt = entry.timestamp; student.updatedBy = entry.actor.name; }
  }
  return { workbook, data: { version: 1, settings: config, shiftTimes, schedule, tutors, content, events, students, activity, staff, shifts, semesterLabel, programTutors: staff.filter((item) => item.program).map(({ program, name, email, phone, telegram }) => ({ program, tutor: name, email, phone, telegram })), checkins, handover, audit, lastImported: "" }, idAssignments, warnings };
}

const SHEET_GUIDANCE = {
  Settings: "Update the current semester and public support settings. Never enter passwords or access codes.",
  Content: "One row per student-facing item. Set Active to TRUE only when the information is ready to show.",
  Students: "Private staff records. The app keeps IDs stable and stores matriculation numbers as text.",
  Activity: "App-maintained history of check-ins, handovers and changes. Do not remove history rows.",
  Staff: "Names support attribution and contact display. Passwords and access codes stay in server settings.",
  Shifts: "One row per day. Write who works in each shift; use Note for closures such as a bank holiday.",
  Tutors: "This semester's tutors, one per row. Add, rename or delete rows; the numbering is updated automatically.",
  Events: "One event per row. Date as YYYY-MM-DD, times as 24-hour 14:00. Set Active to TRUE to show it on the Events page.",
};
function addSheet(workbook, name, dataRows = []) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow([name]);
  sheet.mergeCells(1, 1, 1, HEADERS[name].length);
  sheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF222222" } };
  sheet.addRow([SHEET_GUIDANCE[name]]);
  sheet.mergeCells(2, 1, 2, HEADERS[name].length);
  sheet.getRow(2).font = { italic: true, color: { argb: "FF666666" } };
  sheet.addRow(HEADERS[name]);
  sheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF222222" } };
  sheet.views = [{ state: "frozen", ySplit: 3 }];
  for (const values of dataRows) sheet.addRow(values.map((value) => value ?? ""));
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: HEADERS[name].length } };
  sheet.columns = HEADERS[name].map((header) => ({ width: ["Text", "Notes", "Address", "Accommodation", "Description"].includes(header) ? 48 : 24 }));
  sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  return sheet;
}
export function createUnifiedWorkbook(data = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Welcome Lounge";
  const settings = data.settings || {};
  const shiftTimes = data.shiftTimes || DEFAULT_SHIFT_TIMES;
  const settingsRows = [["Semester", settings.semesterLabel || ""], ["WhatsApp Group URL", settings.whatsappGroupUrl || ""], ["WhatsApp Enabled", settings.whatsappEnabled ?? false], ["Last Reviewed", settings.contentReviewedDate || ""], ["Schedule Start", data.schedule?.start || ""], ["Schedule End", data.schedule?.end || ""], ["Tutors per Shift", String(data.schedule?.perShift || DEFAULT_TUTORS_PER_SHIFT)], ["Shift 1 Time", shiftTimes.first], ["Shift 2 Time", shiftTimes.second], ["Workbook Version", "1"]];
  const sheetSettings = addSheet(workbook, "Settings", settingsRows);
  sheetSettings.getColumn(1).width = 28;
  sheetSettings.getColumn(2).width = 60;
  sheetSettings.getColumn(2).numFmt = "@";
  const contentSheet = addSheet(workbook, "Content", (data.content || []).map((item) => [item.section, item.order, item.title, item.text, item.link, item.active, item.id]));
  for (let row = 4; row <= 1003; row++) {
    contentSheet.getCell(row, 1).dataValidation = { type: "list", allowBlank: true, formulae: ['"First Step,Useful Info,Student Support,Community,Help"'] };
    contentSheet.getCell(row, 6).dataValidation = { type: "list", allowBlank: true, formulae: ['"TRUE,FALSE"'] };
  }
  const eventsSheet = addSheet(workbook, "Events", (data.events || []).map((e) => [e.title, e.date, e.startTime || "", e.endTime || "", e.location || "", e.description || "", e.link || "", e.active, e.id]));
  eventsSheet.getColumn(2).numFmt = "@";
  eventsSheet.getColumn(3).numFmt = "@";
  eventsSheet.getColumn(4).numFmt = "@";
  for (let row = 4; row <= 1003; row++) eventsSheet.getCell(row, 8).dataValidation = { type: "list", allowBlank: true, formulae: ['"TRUE,FALSE"'] };
  const studentsSheet = addSheet(workbook, "Students", (data.students || []).map((s) => [s.id, s.legacyDate, s.name, String(s.matriculationNumber || ""), s.country, s.studyProgram, s.enrolled, s.accommodation, s.address, s.receivedBackpack, s.cityRegistration, s.notes, s.phone, s.email, s.accommodationContact || "", s.addedBy || ""]));
  studentsSheet.getColumn(1).numFmt = "@";
  studentsSheet.getColumn(4).numFmt = "@";
  addSheet(workbook, "Activity", (data.activity || []).map((a) => [a.id, a.timestamp, a.type, a.studentId, a.actor, a.note]));
  const staffSheet = addSheet(workbook, "Staff", (data.staff || []).map((s) => [s.id, s.name, STAFF_ROLE_LABELS[s.role] || "Tutor", s.program, s.email, s.phone, s.telegram, s.isActive]));
  for (let row = 4; row <= 1003; row++) {
    staffSheet.getCell(row, 3).dataValidation = { type: "list", allowBlank: true, formulae: ['"Tutor,Coordinator,Admin,Super Admin"'] };
    staffSheet.getCell(row, 8).dataValidation = { type: "list", allowBlank: true, formulae: ['"TRUE,FALSE"'] };
  }
  const shiftsSheet = addSheet(workbook, "Shifts", [...(data.shifts || [])].sort((a, b) => a.date.localeCompare(b.date)).map((s) => [s.date, ...slotNames(s.first), ...slotNames(s.second), s.event || ""]));
  shiftsSheet.getColumn(1).numFmt = "@";
  // An empty list still gets ten numbered rows so the tab is easy to fill in Excel.
  const tutorRows = data.tutors?.length ? data.tutors : Array(10).fill("");
  addSheet(workbook, "Tutors", tutorRows.map((name, index) => [`Tutor ${index + 1}`, name]));
  HEADERS.Shifts.forEach((label, index) => {
    const color = label.startsWith("S1") ? "FF2F5D62" : label.startsWith("S2") ? "FFB8860B" : null;
    if (color) shiftsSheet.getCell(3, index + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  });
  return workbook;
}
export async function serializeUnifiedWorkbook(data) {
  const bytes = Buffer.from(await createUnifiedWorkbook(data).xlsx.writeBuffer());
  await parseUnifiedWorkbook(bytes);
  return bytes;
}
export async function createUnifiedWorkbookTemplate({ semesterLabel = "" } = {}) {
  const content = [
    { id: "sample-first-step", section: "First Step", order: 1, title: "SAMPLE - First step", text: "Replace with reviewed student guidance.", link: "https://www.uni-weimar.de/en/university/", active: false },
    { id: "sample-useful-info", section: "Useful Info", order: 1, title: "SAMPLE - Useful information", text: "Replace with a short explanation.", link: "https://www.uni-weimar.de/en/university/", active: false },
    { id: "sample-support", section: "Student Support", order: 1, title: "SAMPLE - Student support", text: "Replace with an approved resource.", link: "https://www.uni-weimar.de/en/university/", active: false },
    { id: "sample-community", section: "Community", order: 1, title: "SAMPLE - Community", text: "Replace with a curated community resource.", link: "https://example.org/", active: false },
    { id: "sample-help", section: "Help", order: 1, title: "SAMPLE - Help", text: "Replace with a short support instruction.", link: "https://www.uni-weimar.de/en/university/", active: false },
  ];
  const workbook = createUnifiedWorkbook({ settings: { semesterLabel, whatsappEnabled: false }, content });
  if (semesterLabel) return serializeUnifiedWorkbook({ settings: { semesterLabel, whatsappEnabled: false }, content });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function publicContentFromWorkbook(parsed, preserved = {}) {
  const items = parsed.data.content.filter((item) => item.active);
  const firstSteps = items.filter((item) => item.section === "First Step").sort((a, b) => a.order - b.order);
  const useful = items.filter((item) => ["Useful Info", "Help"].includes(item.section)).sort((a, b) => a.order - b.order);
  const supports = items.filter((item) => item.section === "Student Support").sort((a, b) => a.order - b.order);
  const communities = items.filter((item) => item.section === "Community").sort((a, b) => a.order - b.order);
  const source = (item) => ({ workbook: UNIFIED_WORKBOOK, sheet: "Content", row: item._row || 2 });
  const helpCopy = items.find((item) => item.section === "Help");
  const config = { ...(preserved.config || {}), ...parsed.data.settings, ...(helpCopy ? { helpText: helpCopy.text } : {}) };
  const topics = firstSteps.map((item) => ({ id: item.id, order: item.order, title: item.title, shortTitle: item.title.slice(0, 100), eyebrow: "First steps", summary: item.text.slice(0, 240), description: item.text, officialSource: item.link, officialSourceLabel: inferLinkLabel(item.link), lastReviewed: config.contentReviewedDate || "", why: "", requiredDocumentsText: "", requiredItems: [], source: source(item), relatedPage: "", actions: [], importantNotes: [], category: "first-week", isActive: true, isDemo: false, documents: [], faqs: [] }));
  const links = useful.map((item) => ({ id: item.id, order: item.order, title: item.title, url: item.link, description: item.text, linkLabel: inferLinkLabel(item.link), category: item.section === "Help" ? "Help" : item.link.includes("uni-weimar.de") ? "University services" : "Useful information", isActive: true, source: source(item) }));
  const resources = supports.map((item) => {
    let host = "";
    try { host = new URL(item.link).hostname.toLowerCase(); } catch { /* optional link */ }
    const official = host === "uni-weimar.de" || host.endsWith(".uni-weimar.de");
    const telegram = ["t.me", "telegram.me"].includes(host);
    const instagram = ["instagram.com", "www.instagram.com"].includes(host);
    return { id: item.id, order: item.order, title: item.title, shortText: item.text, type: official ? "official-support" : telegram || instagram ? "student-initiative" : "peer-support", officialUrl: official ? item.link : "", websiteUrl: !official && !telegram && !instagram ? item.link : "", telegramUrl: telegram ? item.link : "", instagramUrl: instagram ? item.link : "", email: "", isActive: true };
  });
  const communityResources = communities.map((item) => {
    let host = "";
    try { host = new URL(item.link).hostname.toLowerCase(); } catch { /* optional link */ }
    return { id: item.id, order: item.order, title: item.title, type: "community", shortText: item.text, url: item.link, platform: ["t.me", "telegram.me"].includes(host) ? "telegram" : "website", isActive: true };
  });
  return {
    config: validatePublic("config", { ...config, version: 1 }),
    onboarding: validatePublic("onboarding", { version: 1, semesterLabel: parsed.data.semesterLabel, topics }),
    "useful-links": validatePublic("useful-links", { version: 1, semesterLabel: parsed.data.semesterLabel, links }),
    "support-resources": validatePublic("support-resources", { version: 1, resources }),
    "community-resources": validatePublic("community-resources", { version: 1, resources: communityResources }),
    // Without an Events tab the existing events source stays in charge.
    ...(parsed.data.events ? { events: validatePublic("events", { version: 1, events: parsed.data.events.filter((item) => item.active).map((item) => ({ id: item.id, title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime, location: item.location, description: item.description, externalLink: item.link, isActive: true, isDemo: false })) }) } : {}),
  };
}

import { validateContent as validatePublic } from "../../shared/content.js";
