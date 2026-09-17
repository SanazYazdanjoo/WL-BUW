import process from "node:process";
import { SOURCE_IDS } from "../server/officialSources/config.js";
import { fetchOfficialSource } from "../server/officialSources/fetchOfficialSource.js";
import { parsePreparingStudies } from "../server/officialSources/parsePreparingStudies.js";
import { parseWelcomeEvents } from "../server/officialSources/parseWelcomeEvents.js";
import { validateOfficialData } from "../server/officialSources/validateOfficialData.js";
import { createOfficialSourcesService } from "../server/officialSources/sourceCache.js";

try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  const parsers = { preparingStudies: parsePreparingStudies, welcomeEvents: parseWelcomeEvents };
  for (const sourceId of SOURCE_IDS) {
    const html = await fetchOfficialSource(sourceId);
    const data = validateOfficialData(sourceId, parsers[sourceId](html));
    const count = sourceId === "welcomeEvents" ? data.events.length : data.sections.length;
    const warnings = sourceId === "welcomeEvents" ? data.events.filter((event) => event.warnings.length).length : 0;
    const icon = data.faviconUrl ? `, favicon ${data.faviconUrl}` : "";
    console.log(`${sourceId}: live page parsed (${count} items${warnings ? `, ${warnings} needs review` : ""}${icon}); cache not written`);
  }
} else {
  if (!process.env.NEXTCLOUD_USERNAME || !process.env.NEXTCLOUD_APP_PASSWORD) {
    console.error("Set NEXTCLOUD_USERNAME and NEXTCLOUD_APP_PASSWORD in .env.local before syncing persistent source data.");
    process.exitCode = 1;
  } else {
    const service = createOfficialSourcesService({ env: process.env });
    const results = await service.refreshAll({ force: true });
    for (const result of results) console.log(`${result.sourceId}: ${result.result}`);
    if (results.some((result) => ["unavailable", "cache-unavailable", "fetch-failed", "parse-failed"].includes(result.result)))
      process.exitCode = 1;
  }
}
