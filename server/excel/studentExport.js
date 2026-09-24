import { ExcelJS } from "./excelUtils.js";

export const EXPORT_MODES = { checkin: "Checked in on", added: "Added on" };
const yesNo = (value) => (value === true ? "Yes" : value === false ? "No" : "");
const berlinTime = (timestamp) => new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(timestamp));

// Students for one day: either everyone checked in that day or everyone added that day.
export function studentsForDay(data, date, by) {
  if (by === "added") return data.students.filter((student) => student.legacyDate === date).map((student) => ({ student, checkin: null }));
  const firstCheckin = new Map();
  for (const checkin of [...data.checkins].sort((a, b) => a.timestamp.localeCompare(b.timestamp)))
    if (checkin.date === date && !firstCheckin.has(checkin.studentId)) firstCheckin.set(checkin.studentId, checkin);
  return data.students.filter((student) => firstCheckin.has(student.id)).map((student) => ({ student, checkin: firstCheckin.get(student.id) }));
}

export async function exportStudentsForDay(data, date, by) {
  const rows = studentsForDay(data, date, by).sort((a, b) => (a.checkin?.timestamp || "").localeCompare(b.checkin?.timestamp || "") || a.student.name.localeCompare(b.student.name));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Welcome Lounge";
  const sheet = workbook.addWorksheet("Students");
  sheet.addRow([`Welcome Lounge students · ${EXPORT_MODES[by]} ${date}`]);
  sheet.getRow(1).font = { bold: true, size: 13 };
  const headers = ["Full name", "Matriculation number", "Country", "Study program", "Phone", "Email", "Enrolled", "Accommodation", "Contact (if no accommodation)", "City registration appointment", "Welcome materials", "Address", "Note", "Date added", ...(by === "checkin" ? ["Checked in at", "Checked in by"] : [])];
  sheet.addRow(headers);
  sheet.getRow(2).font = { bold: true };
  for (const { student: s, checkin } of rows)
    sheet.addRow([s.name, String(s.matriculationNumber || ""), s.country, s.studyProgram, s.phone, s.email, yesNo(s.enrolled), yesNo(s.accommodation), s.accommodationContact || "", yesNo(s.cityRegistration), yesNo(s.receivedBackpack), s.address, s.notes, s.legacyDate, ...(checkin ? [berlinTime(checkin.timestamp), checkin.actor?.name || ""] : [])]);
  if (!rows.length) sheet.addRow(["No students for this day."]);
  sheet.columns = headers.map((header) => ({ width: ["Address", "Note", "Contact (if no accommodation)"].includes(header) ? 36 : 20 }));
  sheet.getColumn(2).numFmt = "@";
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.eachRow((row, number) => { if (number > 1) row.alignment = { vertical: "top", wrapText: true }; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
