import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, parseDate } from "../shared/dates.js";
import { dateValue } from "../server/excel/excelUtils.js";

test("dates read as DD.MM.YYYY and times as 24-hour Weimar time", () => {
  assert.equal(formatDate("2026-09-29"), "29.09.2026");
  assert.equal(formatDate("2026-09-29T23:30:00Z"), "30.09.2026");
  assert.equal(formatDate(""), "");
  assert.equal(formatDate("not a date"), "");
  assert.equal(formatDateTime("2026-01-05T13:05:00Z"), "05.01.2026, 14:05");
  assert.equal(formatDateTime("2026-07-05T13:05:00Z"), "05.07.2026, 15:05");
});

test("typed and workbook dates accept DD.MM.YYYY and older YYYY-MM-DD", () => {
  assert.equal(parseDate("29.09.2026"), "2026-09-29");
  assert.equal(parseDate("5.1.2026"), "2026-01-05");
  assert.equal(parseDate("2026-09-29"), "2026-09-29");
  assert.equal(parseDate("31.02.2026"), "");
  assert.equal(parseDate("09/29/2026"), "");
  assert.equal(dateValue("29.09.2026"), "2026-09-29");
  assert.equal(dateValue("2026-09-29 10:00"), "2026-09-29");
  assert.throws(() => dateValue("29/09/2026"), /DD\.MM\.YYYY/);
});
