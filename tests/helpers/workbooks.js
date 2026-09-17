import { ExcelJS } from "../../server/excel/excelUtils.js";
import { studentColumns } from "../../server/excel/masterExcel.js";
export async function contentFixture(count = 10, edit = () => {}) {
  const w = new ExcelJS.Workbook();
  const first = w.addWorksheet("first steps");
  first.addRow(["Summer Semester 2026"]);
  first.addRow(["Step", "Title", "Instruction", "REQUIRED DOCUMENTS"]);
  for (let i = 1; i <= count; i++) {
    first.addRow([
      i,
      `Synthetic step ${i}`,
      `Original instruction ${i}\nSecond paragraph.`,
      "Identity document\nPhoto",
    ]);
    first.addRow([]);
  }
  const health = w.addWorksheet("Krankenversicherungen");
  health.addRow([
    "Provider",
    "Address",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  health.addRow([
    "Example insurer",
    "Example address",
    "09:00-12:00",
    "Closed",
    "",
    "09:00-12:00",
    "Closed",
  ]);
  const links = w.addWorksheet("student portal Links");
  links.addRow(["Title", "URL", "Description"]);
  links.addRow([
    "Example portal",
    { text: "Open portal", hyperlink: "https://example.org" },
    "Synthetic description\nSecond line",
  ]);
  const guide = w.addWorksheet("Rundfunkbeitrag");
  guide.addRow(["1. Example section", "Preserved editorial text."]);
  guide.addRow(["More text with Unicode \u{1F30D}."]);
  edit(w);
  return Buffer.from(await w.xlsx.writeBuffer());
}
export async function masterFixture(edit = () => {}) {
  const w = new ExcelJS.Workbook();
  const s = w.addWorksheet("Students_List");
  s.addRow(studentColumns);
  s.addRow([
    new Date("2026-03-23"),
    "Synthetic Student",
    "001234",
    "Example country",
    "Example programme",
    true,
    "Pending",
    "Example address",
    false,
    "",
    "Synthetic note",
  ]);
  s.addRow(["", "", "", "", "", false, "", "", false]);
  const p = w.addWorksheet("Program_Tutors");
  p.addRow(["Program", "Tutor", "Email", "Phone number", "Telegram ID"]);
  p.addRow(["Example programme", "?", "", "001234", ""]);
  p.addRow(["Example programme", "Synthetic Tutor", "", "", ""]);
  const shifts = w.addWorksheet("Welcome_Lounge_Shifts");
  shifts.addRow([
    "Date",
    "First Shift",
    "",
    "",
    "Second Shift",
    "",
    "",
    "Important Events",
  ]);
  shifts.addRow([
    "2026-03-23 (Monday)",
    "Synthetic Tutor",
    "",
    "",
    "Synthetic Tutor",
    "",
    "",
    "Event\nSecond line",
  ]);
  w.addWorksheet("Shifts_Summary").addRow([
    { formula: "#REF!", result: { error: "#REF!" } },
  ]);
  edit(w);
  return Buffer.from(await w.xlsx.writeBuffer());
}
