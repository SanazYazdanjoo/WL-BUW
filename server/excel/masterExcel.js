import {
  ExcelJS,
  readWorkbook,
  requireSheets,
  rows,
  key,
  cellText,
  dateValue,
  booleanValue,
  WorkbookError,
} from "./excelUtils.js";
export const studentColumns = [
  "date",
  "Full name",
  "Matr-no.",
  "Country",
  "Study Program",
  "Enrolled",
  "Accomodation",
  "Address",
  "Received Backpack",
  "City registration appointment",
  "Notes",
];
export const studentFields = [
  "legacyDate",
  "name",
  "matriculationNumber",
  "country",
  "studyProgram",
  "enrolled",
  "accommodation",
  "address",
  "receivedBackpack",
  "cityRegistration",
  "notes",
];
export function shiftSummary(shifts) {
  const totals = new Map();
  for (const shift of shifts)
    for (const tutor of new Set(
      [...shift.first, ...shift.second].filter((t) => t && t !== "?"),
    )) {
      const entry = totals.get(tutor) || {
        tutor,
        first: 0,
        second: 0,
        total: 0,
      };
      if (shift.first.includes(tutor)) entry.first++;
      if (shift.second.includes(tutor)) entry.second++;
      entry.total = entry.first + entry.second;
      totals.set(tutor, entry);
    }
  return [...totals.values()];
}
export async function parseMasterExcel(bytes) {
  const workbook = await readWorkbook(bytes);
  const [studentsSheet, tutorsSheet, shiftsSheet] = requireSheets(workbook, [
    "Students_List",
    "Program_Tutors",
    "Welcome_Lounge_Shifts",
    "Shifts_Summary",
  ]);
  const warnings = [],
    students = [],
    programTutors = [],
    shifts = [];
  const dataRows = rows(studentsSheet);
  const header = dataRows.find((r) =>
    r.values.some((v) => key(v) === "fullname"),
  );
  if (!header)
    throw new WorkbookError("Students_List needs the expected column headers.");
  const columns = studentColumns.map((c) =>
    header.values.findIndex(
      (v) =>
        key(v) === key(c) ||
        (c === "Accomodation" && key(v) === "accommodation"),
    ),
  );
  if (columns.some((c) => c < 0))
    throw new WorkbookError("Students_List is missing required columns.");
  const seen = new Set();
  for (const r of dataRows.filter((r) => r.number > header.number)) {
    // Checkbox template rows alone are not people.
    const values = columns.map((c) => r.values[c] || "");
    if (
      !values.some(
        (v, i) =>
          ![5, 8].includes(i) &&
          v &&
          !["true", "false"].includes(v.toLowerCase()),
      )
    )
      continue;
    if (!values[1] && !values[2])
      throw new WorkbookError(`Student identity missing at row ${r.number}.`);
    const student = Object.fromEntries(
      studentFields.map((f, i) => [f, values[i]]),
    );
    student.legacyDate = dateValue(r.row.getCell(columns[0] + 1));
    student.enrolled = booleanValue(values[5]);
    student.receivedBackpack = booleanValue(values[8]);
    student.sourceRow = r.number;
    const fingerprint = student.matriculationNumber
      ? `matr:${student.matriculationNumber}`
      : JSON.stringify(values);
    if (seen.has(fingerprint))
      throw new WorkbookError(`Duplicate student identity at row ${r.number}.`);
    seen.add(fingerprint);
    if (!student.matriculationNumber)
      warnings.push(
        `Student at row ${r.number} has no matriculation number; review matching before import.`,
      );
    students.push(student);
  }
  const tutorRows = rows(tutorsSheet),
    tutorHeader = tutorRows.find((r) =>
      r.values.some((v) => key(v) === "program"),
    );
  if (!tutorHeader)
    throw new WorkbookError(
      "Program_Tutors needs Program, Tutor, Email, Phone number and Telegram ID columns.",
    );
  const tutorFields = [
    "Program",
    "Tutor",
    "Email",
    "Phone number",
    "Telegram ID",
  ];
  const tutorCols = tutorFields.map((f) =>
    tutorHeader.values.findIndex((v) => key(v) === key(f)),
  );
  if (tutorCols.some((c) => c < 0))
    throw new WorkbookError("Program_Tutors is missing required columns.");
  for (const r of tutorRows.filter((r) => r.number > tutorHeader.number)) {
    const values = tutorCols.map((c) => r.values[c] || "");
    if (!values.some(Boolean)) continue;
    if (!values[0])
      throw new WorkbookError(`Programme missing at row ${r.number}.`);
    if (programTutors.some((p) => p.program === values[0]))
      warnings.push(
        `Duplicate programme at Program_Tutors row ${r.number}; contacts are kept separately.`,
      );
    programTutors.push({
      program: values[0],
      tutor: values[1],
      email: values[2],
      phone: values[3],
      telegram: values[4],
      sourceRow: r.number,
    });
  }
  for (const r of rows(shiftsSheet)) {
    let date;
    try {
      date = dateValue(r.row.getCell(1));
    } catch {
      if (/date|shift|tutor|important|10:|12:/i.test(r.values.join(" ")))
        continue;
      throw new WorkbookError(`Shift date not recognized at row ${r.number}.`);
    }
    if (!date) continue;
    if (shifts.some((s) => s.date === date))
      throw new WorkbookError(`Duplicate shift date at row ${r.number}.`);
    shifts.push({
      date,
      first: r.values.slice(1, 4).map((v) => v || ""),
      second: r.values.slice(4, 7).map((v) => v || ""),
      event: r.values.slice(7).filter(Boolean).join("\n"),
    });
  }
  return {
    students,
    programTutors,
    shifts,
    summary: shiftSummary(shifts),
    warnings,
  };
}
export async function exportMasterExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const students = workbook.addWorksheet("Students_List");
  students.addRow(studentColumns);
  for (const s of data.students)
    students.addRow(studentFields.map((f) => s[f] ?? ""));
  const tutors = workbook.addWorksheet("Program_Tutors");
  tutors.addRow(["Program", "Tutor", "Email", "Phone number", "Telegram ID"]);
  for (const p of data.programTutors)
    tutors.addRow(
      [p.program, p.tutor, p.email, p.phone, p.telegram].map((v) =>
        cellText(v),
      ),
    );
  const shifts = workbook.addWorksheet("Welcome_Lounge_Shifts");
  shifts.addRow([
    "Date",
    "First Shift Tutor 1",
    "First Shift Tutor 2",
    "First Shift Tutor 3",
    "Second Shift Tutor 1",
    "Second Shift Tutor 2",
    "Second Shift Tutor 3",
    "Important Events",
  ]);
  for (const s of data.shifts)
    shifts.addRow([
      s.date,
      ...[0, 1, 2].map((i) => s.first[i] || ""),
      ...[0, 1, 2].map((i) => s.second[i] || ""),
      s.event,
    ]);
  const summary = workbook.addWorksheet("Shifts_Summary");
  summary.addRow(["Tutor", "First Shift", "Second Shift", "Total"]);
  for (const s of shiftSummary(data.shifts))
    summary.addRow([s.tutor, s.first, s.second, s.total]);
  workbook.eachSheet((sheet) => {
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((c) => {
      c.width = 24;
    });
    sheet.eachRow((row) => {
      row.alignment = { wrapText: true, vertical: "top" };
    });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
