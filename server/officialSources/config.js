import rawConfig from "../../content/app-content/sources.json" with { type: "json" };

export const OFFICIAL_HOST = "www.uni-weimar.de";
export const SOURCE_IDS = ["preparingStudies", "welcomeEvents"];
const fail = () => {
  throw new Error("Invalid official source configuration.");
};

export function approvedSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === OFFICIAL_HOST &&
      url.port === "" &&
      !url.username &&
      !url.password &&
      !url.hash
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function validateSourceConfig(value) {
  if (!value || value.version !== 1 || typeof value.enabled !== "boolean")
    fail();
  if (
    !value.sources ||
    Object.keys(value.sources).length !== SOURCE_IDS.length ||
    SOURCE_IDS.some((id) => !value.sources[id])
  )
    fail();
  const sources = Object.fromEntries(
    SOURCE_IDS.map((id) => {
      const source = value.sources[id];
      const url = approvedSourceUrl(source.url);
      if (
        !url ||
        typeof source.enabled !== "boolean" ||
        typeof source.label !== "string" ||
        !source.label.trim() ||
        !Number.isInteger(source.refreshHours) ||
        source.refreshHours < 1 ||
        source.refreshHours > 168 ||
        !Number.isInteger(source.staleAfterHours) ||
        source.staleAfterHours < source.refreshHours ||
        source.staleAfterHours > 720 ||
        !Number.isInteger(source.retryMinutes) ||
        source.retryMinutes < 5 ||
        source.retryMinutes > 1440
      )
        fail();
      if (
        id === "preparingStudies" &&
        (!Number.isInteger(source.minSections) || source.minSections < 1 ||
          !Number.isInteger(source.maxCountChange) || source.maxCountChange < 1)
      )
        fail();
      if (
        id === "welcomeEvents" &&
        (!Number.isInteger(source.minEvents) ||
          source.minEvents < 1 ||
          !Number.isInteger(source.maxEvents) ||
          source.maxEvents < source.minEvents ||
          source.maxEvents > 100 ||
          !Number.isInteger(source.maxCountChange) ||
          source.maxCountChange < 1)
      )
        fail();
      return [id, { ...source, url }];
    }),
  );
  const topicMappings = {};
  for (const [topicId, mapping] of Object.entries(value.topicMappings || {})) {
    const url = mapping?.url === undefined ? "" : approvedSourceUrl(mapping.url);
    if (
      !/^[a-z0-9][a-z0-9-]{0,79}$/.test(topicId) ||
      !SOURCE_IDS.includes(mapping?.sourceId) ||
      (mapping.sectionId !== undefined &&
        !/^[a-z0-9][a-z0-9-]{0,119}$/.test(mapping.sectionId)) ||
      (mapping.url !== undefined && !url)
    )
      fail();
    topicMappings[topicId] = {
      sourceId: mapping.sourceId,
      ...(mapping.sectionId ? { sectionId: mapping.sectionId } : {}),
      ...(url ? { url } : {}),
    };
  }
  return { version: 1, enabled: value.enabled, sources, topicMappings };
}

export const officialSourceConfig = validateSourceConfig(rawConfig);
