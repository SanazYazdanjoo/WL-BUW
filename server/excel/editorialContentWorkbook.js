import { booleanValue, dateValue, key, rows, WorkbookError } from "./excelUtils.js";
import { safeLink, validateContent, whatsappLink } from "../../shared/content.js";

const REQUIRED = {
  "Semester Settings": ["setting", "value"],
  "First Steps": ["id", "order", "title", "short_text", "official_link", "official_link_label", "active", "semester", "last_reviewed", "notes_internal"],
  "Useful Information": ["id", "category", "order", "title", "short_text", "link", "link_label", "active", "last_reviewed", "notes_internal"],
  "Student Support": ["id", "order", "title", "type", "short_text", "official_url", "website_url", "telegram_url", "instagram_url", "email", "active", "last_reviewed", "notes_internal"],
  Community: ["id", "order", "title", "type", "short_text", "url", "platform", "active", "last_reviewed", "notes_internal"],
  "Official Links": ["id", "label", "url", "category", "active", "last_reviewed"],
};
const settingsAllowed = new Set([
  "semester_label", "semester_code", "welcome_lounge_enabled", "whatsapp_group_url",
  "whatsapp_enabled", "content_reviewed_date", "content_reviewed_by", "default_language",
]);
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validLink = (value, { official = false, telegram = false } = {}) => {
  if (!value) return "";
  let url;
  try { url = new URL(value); } catch { throw new WorkbookError("A link is not a valid URL."); }
  const host = url.hostname.toLowerCase();
  if (!safeLink(url.href))
    throw new WorkbookError("Links must use HTTPS and point to a public website.");
  if (official && host !== "uni-weimar.de" && !host.endsWith(".uni-weimar.de"))
    throw new WorkbookError("Official university links must use a uni-weimar.de domain.");
  if (telegram && !["t.me", "telegram.me"].includes(host))
    throw new WorkbookError("Telegram links must use t.me or telegram.me.");
  return url.href;
};
const bool = (value, sheet, row, field) => {
  const result = booleanValue(value);
  if (result === null) throw new WorkbookError(`${sheet} · row ${row} · ${field}: enter TRUE or FALSE.`);
  return result;
};
const plain = (value, max = 12000) => {
  const result = String(value || "").trim();
  if (result.length > max) throw new WorkbookError("A text field is too long. Shorten it and try again.");
  return result;
};
function table(workbook, sheetName, columns) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new WorkbookError(`Missing required sheet: ${sheetName}.`);
  const contentRows = rows(sheet);
  const headerIndex = contentRows.findIndex(({ values }) =>
    columns.every((column) => values.some((v) => key(v) === key(column))),
  );
  if (headerIndex < 0) throw new WorkbookError(`${sheetName}: required column headings are missing.`);
  const headerRow = contentRows[headerIndex];
  const headers = headerRow.values.map((value) => key(value));
  const expected = new Set(columns.map(key));
  const unknown = headers.filter((value) => value && !expected.has(value));
  if (unknown.length) throw new WorkbookError(`${sheetName}: remove or rename the unexpected column “${unknown[0]}”.`);
  const positions = Object.fromEntries(columns.map((column) => [key(column), headers.indexOf(key(column))]));
  return {
    sheet,
    records: contentRows.slice(headerIndex + 1).filter(({ values }) =>
      values.some((value) => value && !["false", "0"].includes(String(value).toLowerCase())),
    ).map(({ number, values }) => ({
      row: number,
      value: (column) => values[positions[key(column)]] || "",
    })),
  };
}
function dates(record, sheet, field = "last_reviewed") {
  const value = record.value(field);
  if (!value) return "";
  try { return dateValue(value); } catch {
    throw new WorkbookError(`${sheet} · row ${record.row} · ${field}: use a date or YYYY-MM-DD.`);
  }
}
function uniqueOrders(items, sheet) {
  const seen = new Set();
  for (const item of items) {
    if (!Number.isInteger(item.order) || item.order < 1 || item.order > 1000)
      throw new WorkbookError(`${sheet} · row ${item._row}: order must be a whole number from 1 to 1000.`);
    if (seen.has(item.order)) throw new WorkbookError(`${sheet}: order ${item.order} is used more than once.`);
    seen.add(item.order);
    delete item._row;
  }
  return items.sort((a, b) => a.order - b.order);
}
function checkId(value, sheet, row, seen) {
  const id = plain(value, 80);
  if (!slug.test(id)) throw new WorkbookError(`${sheet} · row ${row} · id: use a lowercase ID with letters, numbers and hyphens.`);
  if (seen.has(id)) throw new WorkbookError(`${sheet} · row ${row}: duplicate ID “${id}”.`);
  seen.add(id);
  return id;
}

export function parseEditorialContentWorkbook(workbook, currentSemester = "") {
  if (!workbook.getWorksheet("Instructions"))
    throw new WorkbookError("Missing required sheet: Instructions.");
  const tables = Object.fromEntries(Object.entries(REQUIRED).map(([name, columns]) => [name, table(workbook, name, columns)]));
  const warnings = [];
  const knownSheets = new Set(["instructions", ...Object.keys(REQUIRED).map((name) => key(name))]);
  for (const sheet of workbook.worksheets)
    if (!knownSheets.has(key(sheet.name))) warnings.push(`Extra sheet ignored: ${sheet.name.slice(0, 80)}`);
  for (const [name, sheetTable] of Object.entries(tables))
    if (sheetTable.records.length > 500)
      throw new WorkbookError(`${name}: too many populated rows. Review unexpected pasted content.`);
  const settingsTable = tables["Semester Settings"];
  const settings = {};
  for (const record of settingsTable.records) {
    const name = plain(record.value("setting"), 100).toLowerCase();
    if (!name) continue;
    if (!settingsAllowed.has(name)) { warnings.push(`Semester Settings · row ${record.row}: unknown setting “${name}” was ignored.`); continue; }
    if (Object.hasOwn(settings, name)) throw new WorkbookError(`Semester Settings · row ${record.row}: duplicate setting “${name}”.`);
    settings[name] = plain(record.value("value"), 500);
  }
  const semesterLabel = plain(settings.semester_label, 100);
  if (!/^(?:Winter|Summer) Semester 20\d{2}(?:\/\d{2,4})?$/i.test(semesterLabel))
    throw new WorkbookError("Semester Settings: enter a semester label such as Winter Semester 2026/27.");
  if (currentSemester && key(currentSemester) !== key(semesterLabel))
    warnings.push(`Semester mismatch: workbook ${semesterLabel}; currently published ${currentSemester}. Review before publishing.`);
  const whatsappEnabled = bool(settings.whatsapp_enabled || "FALSE", "Semester Settings", 0, "whatsapp_enabled");
  const whatsappGroupUrl = validLink(settings.whatsapp_group_url || "");
  if (whatsappEnabled && !whatsappLink({ whatsappEnabled, semesterLabel, whatsappGroupUrl }))
    throw new WorkbookError("Semester Settings · WhatsApp group URL: enter the current chat.whatsapp.com invitation or turn WhatsApp off.");
  const config = validateContent("config", {
    version: 1, semesterLabel, contactLabel: "Welcome Lounge team", helpText: "",
    whatsappEnabled, whatsappGroupUrl,
    semesterCode: settings.semester_code || "",
    welcomeLoungeEnabled: settings.welcome_lounge_enabled
      ? bool(settings.welcome_lounge_enabled, "Semester Settings", 0, "welcome_lounge_enabled")
      : true,
    defaultLanguage: settings.default_language || "English",
    contentReviewedDate: settings.content_reviewed_date ? dates({ row: 0, value: (field) => field === "content_reviewed_date" ? settings.content_reviewed_date : "" }, "Semester Settings", "content_reviewed_date") : "",
  });

  const officialSheet = tables["Official Links"];
  const officialLinks = [], officialById = new Map(), officialIds = new Set();
  for (const record of officialSheet.records) {
    const active = bool(record.value("active"), "Official Links", record.row, "active");
    if (!active) continue;
    const id = checkId(record.value("id"), "Official Links", record.row, officialIds);
    const url = validLink(plain(record.value("url"), 1000), { official: true });
    const item = { id, label: plain(record.value("label"), 200), url, category: plain(record.value("category"), 100), lastReviewed: dates(record, "Official Links"), isActive: true };
    if (!item.label || !item.category) throw new WorkbookError(`Official Links · row ${record.row}: label and category are required.`);
    officialById.set(id, item);
    officialLinks.push(item);
  }

  const firstSteps = [], stepIds = new Set(), stepOrders = new Set();
  for (const record of tables["First Steps"].records) {
    const active = bool(record.value("active"), "First Steps", record.row, "active");
    if (!active) continue;
    const id = checkId(record.value("id"), "First Steps", record.row, stepIds);
    const orderText = plain(record.value("order"), 20);
    const order = /^\d+$/.test(orderText) ? Number(orderText) : NaN;
    if (!Number.isInteger(order) || order < 1 || order > 100 || stepOrders.has(order))
      throw new WorkbookError(`First Steps · row ${record.row}: order must be a unique whole number from 1 to 100.`);
    stepOrders.add(order);
    const title = plain(record.value("title"), 200), summary = plain(record.value("short_text"), 12000);
    if (!title || !summary) throw new WorkbookError(`First Steps · row ${record.row}: title and short text are required.`);
    if (summary.length > 700) warnings.push(`First Steps · row ${record.row}: short text is longer than 700 characters.`);
    const semester = plain(record.value("semester"), 100);
    if (semester && key(semester) !== key(semesterLabel)) warnings.push(`First Steps · row ${record.row}: semester does not match workbook settings.`);
    let officialLink = plain(record.value("official_link"), 1000);
    let linkRecord = officialById.get(officialLink);
    if (!officialLink && plain(record.value("official_link_label"))) throw new WorkbookError(`First Steps · row ${record.row}: official link URL or registered link ID is missing.`);
    if (officialLink && !linkRecord) {
      const url = validLink(officialLink, { official: true });
      linkRecord = { url, label: plain(record.value("official_link_label"), 200) || "Official university information" };
    }
    firstSteps.push({
      id, order, title, shortTitle: title.slice(0, 100), summary, description: summary,
      why: "", requiredItems: [], requiredDocumentsText: "", actions: [], documents: [], faqs: [],
      importantNotes: [], category: "first-week", eyebrow: "First steps", isActive: true,
      isDemo: false, semesterLabel, officialSource: linkRecord?.url || "",
      officialSourceLabel: linkRecord?.label || "", lastReviewed: dates(record, "First Steps"),
    });
  }
  if (!firstSteps.length) throw new WorkbookError("First Steps: add at least one active step before previewing.");
  uniqueOrders(firstSteps, "First Steps");
  if (firstSteps.length > 100) throw new WorkbookError("First Steps: no more than 100 active rows are supported.");

  const useful = [], usefulIds = new Set();
  for (const record of tables["Useful Information"].records) {
    const active = bool(record.value("active"), "Useful Information", record.row, "active");
    if (!active) continue;
    const id = checkId(record.value("id"), "Useful Information", record.row, usefulIds);
    const orderText = plain(record.value("order"), 20), order = /^\d+$/.test(orderText) ? Number(orderText) : NaN;
    const title = plain(record.value("title"), 200), summary = plain(record.value("short_text"), 12000);
    const category = plain(record.value("category"), 100);
    const url = validLink(plain(record.value("link"), 1000));
    if (!title || !summary || !category || !url) throw new WorkbookError(`Useful Information · row ${record.row}: title, short text, category and link are required.`);
    if (!slug.test(category)) throw new WorkbookError(`Useful Information · row ${record.row}: category must be a lowercase category name with hyphens.`);
    if (summary.length > 700) warnings.push(`Useful Information · row ${record.row}: short text is longer than 700 characters.`);
    useful.push({ id, order, title, url, description: summary, category, isActive: true, linkLabel: plain(record.value("link_label"), 200), lastReviewed: dates(record, "Useful Information") });
  }
  uniqueOrders(useful, "Useful Information");

  const supportResources = [], supportIds = new Set();
  for (const record of tables["Student Support"].records) {
    const active = bool(record.value("active"), "Student Support", record.row, "active");
    if (!active) continue;
    const id = checkId(record.value("id"), "Student Support", record.row, supportIds);
    const orderText = plain(record.value("order"), 20), order = /^\d+$/.test(orderText) ? Number(orderText) : NaN;
    const type = plain(record.value("type"), 80), title = plain(record.value("title"), 200);
    const shortText = plain(record.value("short_text"), 700);
    if (!title || !shortText || !["student-initiative", "student-representation", "peer-support", "official-support"].includes(type))
      throw new WorkbookError(`Student Support · row ${record.row}: enter a title, short text and supported type.`);
    supportResources.push({
      id, order, title, type, shortText,
      officialUrl: validLink(plain(record.value("official_url"), 1000), { official: true }),
      websiteUrl: validLink(plain(record.value("website_url"), 1000)),
      telegramUrl: validLink(plain(record.value("telegram_url"), 1000), { telegram: true }),
      instagramUrl: validLink(plain(record.value("instagram_url"), 1000)),
      email: plain(record.value("email"), 254), isActive: true,
      lastReviewed: dates(record, "Student Support"),
    });
  }
  uniqueOrders(supportResources, "Student Support");

  const communityResources = [], communityIds = new Set();
  for (const record of tables.Community.records) {
    const active = bool(record.value("active"), "Community", record.row, "active");
    if (!active) continue;
    const id = checkId(record.value("id"), "Community", record.row, communityIds);
    const orderText = plain(record.value("order"), 20), order = /^\d+$/.test(orderText) ? Number(orderText) : NaN;
    const title = plain(record.value("title"), 200), type = plain(record.value("type"), 80);
    const shortText = plain(record.value("short_text"), 700), platform = plain(record.value("platform"), 40).toLowerCase();
    const url = validLink(plain(record.value("url"), 1000), { telegram: platform === "telegram" });
    if (!title || !shortText || !url || !["community", "student-initiative"].includes(type) || !["telegram", "website"].includes(platform))
      throw new WorkbookError(`Community · row ${record.row}: enter a title, description, valid URL, type and platform.`);
    communityResources.push({ id, order, title, type, shortText, url, platform, isActive: true, lastReviewed: dates(record, "Community") });
  }
  uniqueOrders(communityResources, "Community");

  const content = {
    config,
    onboarding: { version: 1, semesterLabel, topics: firstSteps },
    "useful-links": { version: 1, semesterLabel, links: useful.map((item) => { const output = { ...item }; delete output.linkLabel; delete output.lastReviewed; return output; }) },
    "support-resources": { version: 1, resources: supportResources.map((item) => { const output = { ...item }; delete output.lastReviewed; return output; }) },
    "community-resources": { version: 1, resources: communityResources.map((item) => { const output = { ...item }; delete output.lastReviewed; return output; }) },
    "official-links": { version: 1, links: officialLinks },
  };
  for (const [kind, value] of Object.entries(content)) validateContent(kind, value);
  return { semesterLabel, warnings, content, sourceFilename: "Welcome-Lounge-Content.xlsx" };
}
