import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createUnifiedWorkbook, createUnifiedWorkbookTemplate } from "../server/excel/unifiedWorkbook.js";

export { createUnifiedWorkbook };

export async function writeUnifiedWorkbookTemplate() {
  const output = resolve(process.cwd(), "templates/Welcome-Lounge-Template.xlsx");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, await createUnifiedWorkbookTemplate());
  return output;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const output = await writeUnifiedWorkbookTemplate();
    console.log(`Created unified Welcome Lounge workbook template: ${output}`);
  } catch {
    console.error("The Welcome Lounge workbook template could not be created.");
    process.exitCode = 1;
  }
}
