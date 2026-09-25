import { ExcelJS } from "./excelUtils.js";

const yesNo = (value) => (value === true ? "Yes" : value === false ? "No" : "");

export const studentsAddedOn = (data, date) => data.students.filter((student) => student.legacyDate === date);

// Excel list of the students added on one day, with every student detail.
export async function exportStudentsForDay(data, date) {
  const students = studentsAddedOn(data, date).sort((a, b) => a.name.localeCompare(b.name));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Welcome Lounge";
  const sheet = workbook.addWorksheet("Students");
  sheet.addRow([`Welcome Lounge students · added on ${date}`]);
  sheet.getRow(1).font = { bold: true, size: 13 };
  const headers = ["Full name", "Matriculation number", "Country", "Study program", "Phone", "Email", "Enrolled", "Accommodation", "Contact (if no accommodation)", "City registration appointment", "Address", "Note", "Date added"];
  sheet.addRow(headers);
  sheet.getRow(2).font = { bold: true };
  for (const s of students)
    sheet.addRow([s.name, String(s.matriculationNumber || ""), s.country, s.studyProgram, s.phone, s.email, yesNo(s.enrolled), yesNo(s.accommodation), s.accommodationContact || "", yesNo(s.cityRegistration), s.address, s.notes, s.legacyDate]);
  if (!students.length) sheet.addRow(["No students were added on this day."]);
  sheet.columns = headers.map((header) => ({ width: ["Address", "Note", "Contact (if no accommodation)"].includes(header) ? 36 : 20 }));
  sheet.getColumn(2).numFmt = "@";
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.eachRow((row, number) => { if (number > 1) row.alignment = { vertical: "top", wrapText: true }; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
