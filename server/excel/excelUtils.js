import ExcelJS from "exceljs";
export { ExcelJS };
export class WorkbookError extends Error {
  constructor(message) {
    super(message);
    this.status = 422;
  }
}
export function cellText(cell) {
  const value = cell?.value ?? cell;
  let result =
    value == null
      ? ""
      : value instanceof Date
        ? value.toISOString().slice(0, 10)
        : typeof value === "object"
          ? value.richText
            ? value.richText.map((x) => x.text).join("")
            : value.hyperlink
              ? value.text || value.hyperlink
              : "formula" in value || "sharedFormula" in value
                ? cellText(value.result)
                : value.error
                  ? ""
                  : ""
          : String(value);
  result = result.replace(/\r\n?/g, "\n").trim();
  if (
    result.length > 12000 ||
    [...result].some((c) => c.charCodeAt(0) < 32 && !["\n", "\t"].includes(c))
  )
    throw new WorkbookError(
      "A cell contains unsupported characters or excessive text.",
    );
  return result;
}
export const key = (value) =>
  cellText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function rows(sheet) {
  const result = [];
  sheet.eachRow((row, number) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      values[column - 1] =
        cell.isMerged && cell.master.address !== cell.address
          ? ""
          : cellText(cell);
    });
    if (values.some(Boolean)) result.push({ number, values, row });
  });
  return result;
}
export function requireSheets(workbook, names) {
  const map = new Map(workbook.worksheets.map((s) => [key(s.name), s]));
  for (const name of names)
    if (!map.has(key(name)))
      throw new WorkbookError(`Missing required sheet: ${name}.`);
  return names.map((name) => map.get(key(name)));
}
export async function readWorkbook(bytes) {
  if (!bytes || bytes.length > 10 * 1024 * 1024)
    throw new WorkbookError("Workbook exceeds the 10 MB limit.");
  // Inspect ZIP directory before decompression. Reject ZIP64/encrypted/oversized archives.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new WorkbookError("A valid .xlsx workbook is required.");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16),
    size = 0;
  if (count > 500 || count === 65535)
    throw new WorkbookError("Workbook archive is too complex.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new WorkbookError("Invalid workbook archive.");
    size += bytes.readUInt32LE(offset + 24);
    if (size > 60 * 1024 * 1024 || bytes.readUInt16LE(offset + 8) & 1)
      throw new WorkbookError("Workbook archive is encrypted or too large.");
    offset +=
      46 +
      bytes.readUInt16LE(offset + 28) +
      bytes.readUInt16LE(offset + 30) +
      bytes.readUInt16LE(offset + 32);
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    throw new WorkbookError(
      "Unable to read the workbook. Save a valid .xlsx file and retry.",
    );
  }
  if (
    workbook.worksheets.length > 20 ||
    workbook.worksheets.some((s) => s.rowCount > 10000 || s.columnCount > 60)
  )
    throw new WorkbookError("Workbook exceeds supported sheet dimensions.");
  return workbook;
}
export function dateValue(value) {
  const raw = value?.value ?? value;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number" && raw > 0 && raw < 100000)
    return new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000)
      .toISOString()
      .slice(0, 10);
  const text = cellText(value);
  if (!text) return "";
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:\s|$)/);
  if (
    match &&
    Number.isFinite(Date.parse(match[1])) &&
    new Date(match[1]).toISOString().slice(0, 10) === match[1]
  )
    return match[1];
  throw new WorkbookError(
    "A date is not recognizable. Use an Excel date or YYYY-MM-DD.",
  );
}
export function booleanValue(value) {
  const text = key(value);
  if (!text) return null;
  if (["true", "yes", "1", "ja"].includes(text)) return true;
  if (["false", "no", "0", "nein"].includes(text)) return false;
  return null;
}
export const sourceAt = (workbook, sheet, row) => ({ workbook, sheet, row });
