import {
  readWorkbook,
  requireSheets,
  rows,
  key,
  cellText,
  WorkbookError,
  sourceAt,
} from "./excelUtils.js";
import { parseEditorialContentWorkbook } from "./editorialContentWorkbook.js";
export const CONTENT_WORKBOOK = "Welcome-Lounge-Content.xlsx";
export const LEGACY_CONTENT_WORKBOOK = "Welcome Lounge First Steps and some other informations.xlsx";
const SHEETS = [
  "first steps",
  "Krankenversicherungen",
  "student portal Links",
  "Rundfunkbeitrag",
];
export const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const dayMap = {
  mo: "monday",
  montag: "monday",
  monday: "monday",
  di: "tuesday",
  dienstag: "tuesday",
  tuesday: "tuesday",
  mi: "wednesday",
  mittwoch: "wednesday",
  wednesday: "wednesday",
  do: "thursday",
  donnerstag: "thursday",
  thursday: "thursday",
  fr: "friday",
  freitag: "friday",
  friday: "friday",
  sa: "saturday",
  samstag: "saturday",
  saturday: "saturday",
  so: "sunday",
  sonntag: "sunday",
  sunday: "sunday",
};
const urlValue = (value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
};
export async function parseContentWorkbook(bytes, currentSemester = "") {
  const workbook = await readWorkbook(bytes);
  if (workbook.getWorksheet("Semester Settings"))
    return parseEditorialContentWorkbook(workbook, currentSemester);
  return parseLegacyContentWorkbook(workbook, currentSemester);
}
async function parseLegacyContentWorkbook(workbook, currentSemester = "") {
  const [first, insurance, portals, rundfunk] = requireSheets(workbook, SHEETS);
  const warnings = [],
    source = (sheet, row) => sourceAt(CONTENT_WORKBOOK, sheet.name, row);
  for (const sheet of workbook.worksheets)
    if (!SHEETS.some((n) => key(n) === key(sheet.name)))
      warnings.push(`Extra sheet ignored: ${sheet.name.slice(0, 80)}`);
  const firstRows = rows(first);
  const semesterLabel = firstRows
    .flatMap((r) => r.values)
    .find((v) =>
      /\b(?:summer|winter)\s*semester\s*20\d{2}(?:\s*\/\s*\d{2,4})?/i.test(v),
    )
    ?.match(/(?:summer|winter)\s*semester\s*20\d{2}(?:\s*\/\s*\d{2,4})?/i)?.[0];
  if (!semesterLabel)
    throw new WorkbookError("The first steps sheet needs a semester label.");
  if (currentSemester && key(semesterLabel) !== key(currentSemester))
    warnings.push(
      `Semester mismatch: workbook ${semesterLabel}; app ${currentSemester}. Review and confirm explicitly before publishing.`,
    );
  const firstStepRow = firstRows.find((r) =>
    r.values.slice(0, 2).some((v) => /^\d{1,3}[.)]?$/.test(v || "")),
  )?.number;
  const columnHeader = firstRows.find(
    (r) =>
      (!firstStepRow || r.number < firstStepRow) &&
      r.values.some((v) =>
        /required\s*documents|erforderliche.*unterlagen/i.test(v),
      ),
  );
  let docsColumn = 3,
    titleColumn = -1,
    instructionColumn = -1;
  for (const r of columnHeader ? [columnHeader] : [])
    r.values.forEach((v, i) => {
      if (/required\s*documents|erforderliche.*unterlagen/i.test(v))
        docsColumn = i;
      if (/^title$/i.test(v)) titleColumn = i;
      if (/^(instruction|description|first steps)$/i.test(v))
        instructionColumn = i;
    });
  const topics = [],
    seen = new Set();
  for (const r of firstRows) {
    const numberIndex = r.values.findIndex((v) =>
      /^\d{1,3}[.)]?$/.test(v || ""),
    );
    if (numberIndex < 0 || numberIndex > 1) continue;
    const order = Number(r.values[numberIndex].replace(/[.)]/g, ""));
    if (order < 1 || order > 100 || seen.has(order))
      throw new WorkbookError(
        `Invalid or duplicate step number at first steps row ${r.number}.`,
      );
    seen.add(order);
    const instruction =
      instructionColumn > numberIndex
        ? r.values[instructionColumn]
        : r.values
            .slice(numberIndex + 1, docsColumn)
            .filter((v, i) => i + numberIndex + 1 !== titleColumn)
            .filter(Boolean)
            .join("\n");
    if (!instruction)
      throw new WorkbookError(
        `Empty numbered step at first steps row ${r.number}.`,
      );
    const requiredDocumentsText = r.values
      .slice(docsColumn)
      .filter(Boolean)
      .join("\n");
    const title =
      (titleColumn >= 0 ? r.values[titleColumn] : "") ||
      instruction.split("\n")[0].slice(0, 90);
    topics.push({
      id: `first-step-${String(order).padStart(2, "0")}`,
      order,
      title,
      shortTitle: title.slice(0, 100),
      eyebrow: "First steps",
      summary: instruction.split(/\r?\n/)[0].slice(0, 240),
      description: instruction,
      why: "",
      requiredDocumentsText,
      requiredItems: requiredDocumentsText.split("\n").filter(Boolean),
      actions: [],
      documents: [],
      faqs: [],
      importantNotes: [],
      category: "first-week",
      isActive: true,
      isDemo: false,
      source: source(first, r.number),
    });
  }
  if (!topics.length) throw new WorkbookError("No numbered first steps found.");
  topics.sort((a, b) => a.order - b.order);
  if (topics.some((t, i) => t.order !== i + 1))
    warnings.push("Step numbering has gaps; review the sequence.");
  const providerRows = rows(insurance),
    providers = [];
  let current;
  const tableHeader = providerRows.find(
    (r) =>
      r.values.some((v) =>
        ["provider", "name", "insuranceprovider"].includes(key(v)),
      ) && r.values.some((v) => key(v) === "address"),
  );
  if (tableHeader) {
    const headers = tableHeader.values.map(key),
      nameCol = headers.findIndex((v) =>
        ["provider", "name", "insuranceprovider"].includes(v),
      ),
      addressCol = headers.indexOf("address");
    for (const r of providerRows.filter((r) => r.number > tableHeader.number)) {
      if (!r.values[nameCol])
        throw new WorkbookError(
          `Insurance provider name missing at row ${r.number}.`,
        );
      const openingHours = {};
      headers.forEach((v, i) => {
        if (dayMap[v]) openingHours[dayMap[v]] = r.values[i] || "";
      });
      providers.push({
        id: `provider-${r.number}`,
        name: r.values[nameCol],
        address: r.values[addressCol] || "",
        openingHours,
        source: source(insurance, r.number),
      });
    }
  } else {
    for (const r of providerRows) {
      const cells = r.values.filter(Boolean);
      if (!cells.length) continue;
      const day = dayMap[key(cells[0])];
      if (day) {
        if (!current)
          throw new WorkbookError(
            `Insurance hours without a provider at row ${r.number}.`,
          );
        current.openingHours[day] = cells.slice(1).join("\n");
        continue;
      }
      if (/^krankenversicherungen$|^health insurance$/i.test(cells[0]))
        continue;
      if (key(cells[0]) === "address" || key(cells[0]) === "adresse") {
        if (!current)
          throw new WorkbookError("Insurance address without a provider.");
        current.address = cells.slice(1).join("\n");
        continue;
      }
      if (cells.length >= 2 || !current || r.row.getCell(1).font?.bold) {
        current = {
          id: `provider-${r.number}`,
          name: cells[0],
          address: cells.slice(1).join("\n"),
          openingHours: {},
          source: source(insurance, r.number),
        };
        providers.push(current);
      } else if (!current.address) current.address = cells[0];
      else
        throw new WorkbookError(
          `Unrecognized insurance block at row ${r.number}. Use the documented provider table.`,
        );
    }
  }
  for (const p of providers) {
    if (!p.address)
      warnings.push(
        `Insurance provider at row ${p.source.row} has no address.`,
      );
    if (weekdays.slice(0, 5).some((d) => !p.openingHours[d]))
      warnings.push(`Insurance hours are incomplete at row ${p.source.row}.`);
  }
  const links = [];
  for (const r of rows(portals)) {
    const cells = r.values.filter(Boolean);
    if (!cells.length) continue;
    let raw = "";
    r.row.eachCell((cell) => {
      const link =
        cell.value?.hyperlink ||
        cellText(cell).match(/https?:\/\/[^\s<>]+/i)?.[0];
      if (link) raw = link;
    });
    if (!raw) {
      if (cells.some((c) => /javascript:|data:|ftp:/i.test(c)))
        throw new WorkbookError(`Unsafe portal URL at row ${r.number}.`);
      if (
        cells.some((c) =>
          /portal|description|title|url|bison|moodle|webmail/i.test(c),
        ) &&
        cells.length < 2
      )
        continue;
      if (
        cells.every((c) =>
          ["title", "url", "description", "name", "category"].includes(key(c)),
        )
      )
        continue;
      throw new WorkbookError(`Missing portal URL at row ${r.number}.`);
    }
    const url = urlValue(raw);
    if (!url) throw new WorkbookError(`Invalid portal URL at row ${r.number}.`);
    if (url.startsWith("http:"))
      warnings.push(
        `Portal link at row ${r.number} uses HTTP; review HTTPS availability.`,
      );
    const title = cells.find((c) => !c.includes(raw)) || cells[0];
    const id = `portal-${key(title).slice(0, 60) || r.number}`;
    if (links.some((l) => l.id === id))
      throw new WorkbookError(`Duplicate portal at row ${r.number}.`);
    links.push({
      id,
      title,
      url,
      description: cells
        .filter((c) => c !== title && !c.includes(raw))
        .join("\n"),
      category: "University services",
      isActive: true,
      source: source(portals, r.number),
    });
  }
  const sections = [];
  let section;
  for (const r of rows(rundfunk)) {
    const cells = r.values.filter(Boolean);
    if (!cells.length) continue;
    if (cells.length === 1 && /^rundfunkbeitrag$/i.test(cells[0])) continue;
    const numbered = cells[0].match(/^\d+[.)]?\s+(.+)/);
    if (
      numbered ||
      /^\d+[.)]?$/.test(cells[0]) ||
      r.row.getCell(1).font?.bold
    ) {
      const heading = numbered
        ? numbered[1]
        : /^\d+[.)]?$/.test(cells[0])
          ? cells[1] || ""
          : cells[0];
      if (!heading)
        throw new WorkbookError(`Empty Rundfunk heading at row ${r.number}.`);
      section = {
        heading,
        paragraphs: cells.slice(/^\d+[.)]?$/.test(cells[0]) ? 2 : 1),
        source: source(rundfunk, r.number),
      };
      sections.push(section);
    } else {
      if (!section) {
        section = {
          heading: "Information",
          paragraphs: [],
          source: source(rundfunk, r.number),
        };
        sections.push(section);
      }
      section.paragraphs.push(cells.join("\n"));
    }
  }
  if (!providers.length || !links.length || !sections.length)
    throw new WorkbookError(
      "One of the information sheets contains no recognizable entries.",
    );
  return {
    semesterLabel,
    warnings,
    content: {
      onboarding: { version: 1, semesterLabel, topics },
      "health-insurance": { version: 1, semesterLabel, providers },
      "useful-links": { version: 1, semesterLabel, links },
      rundfunk: {
        version: 1,
        semesterLabel,
        title: "Rundfunkbeitrag",
        sections,
      },
    },
  };
}
