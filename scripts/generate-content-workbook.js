import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { pathToFileURL } from "node:url";

const headers = {
  "First Steps": ["id", "order", "title", "short_text", "official_link", "official_link_label", "active", "semester", "last_reviewed", "notes_internal"],
  "Useful Information": ["id", "category", "order", "title", "short_text", "link", "link_label", "active", "last_reviewed", "notes_internal"],
  "Student Support": ["id", "order", "title", "type", "short_text", "official_url", "website_url", "telegram_url", "instagram_url", "email", "active", "last_reviewed", "notes_internal"],
  Community: ["id", "order", "title", "type", "short_text", "url", "platform", "active", "last_reviewed", "notes_internal"],
  "Official Links": ["id", "label", "url", "category", "active", "last_reviewed"],
};
const sample = (title, fields) => ["sample-row", 1, `SAMPLE — ${title}`, "Replace this clearly marked example before publishing.", ...fields];

export async function createContentWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Welcome Lounge";
  workbook.subject = "Safe, empty editorial template for Welcome Lounge public content";
  workbook.title = "Welcome Lounge Content Template";
  workbook.company = "Bauhaus-Universität Weimar";
  workbook.created = new Date("2026-01-01T00:00:00Z");
  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 28 }, { width: 100 }];
  instructions.addRow(["Welcome Lounge content workbook", "Instructions"]);
  instructions.addRows([
    ["What this controls", "Short student-facing arrival text, links, semester details and community resources."],
    ["How to edit", "Edit the other sheets in this workbook. Leave IDs unchanged when updating an existing item."],
    ["Save", "Save this workbook in your private Nextcloud content-source folder as Welcome-Lounge-Content.xlsx."],
    ["Preview", "In the staff area, choose Semester setup and Preview content update. Review the changes and any warnings."],
    ["Publish", "After review, an authorized coordinator confirms Publish. Saving this workbook alone does not update students."],
    ["Active", "TRUE includes the row in student content. FALSE keeps it out of the publication."],
    ["IDs", "IDs connect saved student progress and links. Normally, do not change an existing ID."],
    ["Links", "Use complete HTTPS links. Official Links must point to a Bauhaus-Universität Weimar website."],
    ["Privacy", "Never enter student personal data, private tutor details, case notes or passwords."],
    ["University information", "Write a short orientation and link to the official page. Do not copy full university webpages."],
    ["SAMPLE rows", "Rows labelled SAMPLE are examples and inactive. Replace or delete them before publishing."],
    ["Internal notes", "notes_internal is for editorial reminders only and is never published to students."],
  ]);
  instructions.views = [{ state: "frozen", ySplit: 1 }];
  instructions.getRow(1).font = { bold: true, size: 14 };
  instructions.autoFilter = "A1:B1";

  const settings = workbook.addWorksheet("Semester Settings");
  settings.columns = [{ width: 30 }, { width: 60 }];
  settings.addRow(["setting", "value"]);
  settings.addRows([
    ["semester_label", ""], ["semester_code", ""], ["welcome_lounge_enabled", "TRUE"],
    ["whatsapp_group_url", ""], ["whatsapp_enabled", "FALSE"],
    ["content_reviewed_date", ""], ["content_reviewed_by", ""], ["default_language", "English"],
  ]);

  for (const [name, cols] of Object.entries(headers)) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = cols.map((column) => ({ width: column === "short_text" || column === "notes_internal" ? 46 : column.includes("url") || column === "link" || column === "official_link" ? 54 : 22 }));
    sheet.addRow(cols);
    let row;
    if (name === "First Steps") row = sample("Health insurance", ["https://www.uni-weimar.de/en/university/", "Official university page", "FALSE", "", "", "Example only"]);
    else if (name === "Useful Information") row = ["sample-resource", "university-services", 1, "SAMPLE — University service", "Replace this example before publishing.", "https://www.uni-weimar.de/en/university/", "Open official page", "FALSE", "", "Example only"];
    else if (name === "Student Support") row = ["sample-support", 1, "SAMPLE — Student support", "peer-support", "Replace this example before publishing.", "https://www.uni-weimar.de/en/university/", "", "", "", "", "FALSE", "", "Example only"];
    else if (name === "Community") row = ["sample-community", 1, "SAMPLE — Community resource", "community", "Replace this example before publishing.", "https://t.me/example", "telegram", "FALSE", "", "Community-run example only"];
    else row = ["sample-link", "SAMPLE — Official link", "https://www.uni-weimar.de/en/university/", "university-services", "FALSE", ""];
    sheet.addRow(row);
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    sheet.getRow(1).font = { bold: true };
    const activeColumn = cols.indexOf("active") + 1;
    if (activeColumn) sheet.getColumn(activeColumn).eachCell((cell, rowNumber) => {
      if (rowNumber > 1) cell.dataValidation = { type: "list", allowBlank: false, formulae: ['"TRUE,FALSE"'] };
    });
    const typeColumn = cols.indexOf("type") + 1;
    if (typeColumn && name === "Student Support") sheet.getCell(2, typeColumn).dataValidation = { type: "list", allowBlank: false, formulae: ['"student-initiative,student-representation,peer-support,official-support"'] };
    if (name === "Community") sheet.getCell(2, cols.indexOf("platform") + 1).dataValidation = { type: "list", allowBlank: false, formulae: ['"telegram,website"'] };
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createContentWorkbookTemplate() {
  const output = resolve(process.cwd(), "templates/Welcome-Lounge-Content-Template.xlsx");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, await createContentWorkbookBuffer());
  return output;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const output = await createContentWorkbookTemplate();
    console.log(`Created safe workbook template: ${output}`);
  } catch {
    console.error("The content workbook template could not be created.");
    process.exitCode = 1;
  }
}
