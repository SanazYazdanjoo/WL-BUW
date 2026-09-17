import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { validateContent } from "../shared/content.js";
const directory = resolve(process.argv[2] || "content/app-content");
let failed = false;
for (const kind of ["config", "onboarding", "events", "after-arrival"]) {
  try {
    const bytes = await readFile(resolve(directory, `${kind}.json`));
    if (bytes.length > 512000) throw new Error("oversize");
    validateContent(
      kind,
      JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")),
    );
    console.log(`${kind}.json: valid`);
  } catch {
    failed = true;
    console.error(
      `${kind}.json: invalid or missing; see documentation/content-guide.md`,
    );
  }
}
process.exitCode = failed ? 1 : 0;
