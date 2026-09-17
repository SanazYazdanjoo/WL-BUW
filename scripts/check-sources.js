import { officialSourceConfig, validateSourceConfig } from "../server/officialSources/config.js";

validateSourceConfig(officialSourceConfig);
for (const [sourceId, source] of Object.entries(officialSourceConfig.sources)) {
  console.log(`${sourceId}: ${source.enabled ? "enabled" : "disabled"}; refresh ${source.refreshHours}h; stale after ${source.staleAfterHours}h`);
}
console.log(`${Object.keys(officialSourceConfig.topicMappings).length} topic source mappings: valid`);
