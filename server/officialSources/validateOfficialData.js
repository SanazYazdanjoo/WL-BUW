import { officialSourceConfig } from "./config.js";
import { safeExtractedUrl } from "./html.js";

const invalid = () => {
  throw new Error("Official source data failed validation.");
};
const text = (value, max) =>
  typeof value === "string" && value.length <= max &&
  ![...value].some((char) => char.charCodeAt(0) < 32 && !["\n", "\t"].includes(char))
    ? value
    : invalid();
const list = (value, max) => Array.isArray(value) && value.length <= max ? value : invalid();
const timestamp = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : invalid();
const day = (value, optional = false) => {
  if (optional && value === "") return value;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) invalid();
  return value;
};
const time = (value) =>
  value === "" || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    ? value
    : invalid();
const url = (value, base) => {
  if (value === "") return "";
  const safe = safeExtractedUrl(value, base);
  return safe || invalid();
};

export function validateOfficialData(sourceId, value) {
  if (!officialSourceConfig.sources[sourceId] || !value || value.sourceId !== sourceId)
    invalid();
  const sourceUrl = officialSourceConfig.sources[sourceId].url;
  if (value.canonicalUrl !== sourceUrl) invalid();
  const title = text(value.title, 200);
  if (!title || title.toLowerCase() !== officialSourceConfig.sources[sourceId].label.toLowerCase()) invalid();
  const faviconUrl = url(value.faviconUrl || "", sourceUrl);
  const fetchedAt = timestamp(value.fetchedAt);
  if (sourceId === "preparingStudies") {
    const sections = list(value.sections, 80).map((section) => {
      const id = text(section.id, 120);
      const sectionTitle = text(section.title, 200);
      if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(id) || !sectionTitle) invalid();
      const externalLinks = list(section.externalLinks, 12).map((link) => ({
        label: text(link.label, 160),
        url: url(link.url, sourceUrl),
      }));
      return { id, title: sectionTitle, officialUrl: url(section.officialUrl, sourceUrl), externalLinks };
    });
    if (sections.length < officialSourceConfig.sources.preparingStudies.minSections ||
      new Set(sections.map((section) => section.id)).size !== sections.length) invalid();
    return { sourceId, title, canonicalUrl: sourceUrl, faviconUrl, sections, fetchedAt };
  }
  const events = list(value.events, officialSourceConfig.sources.welcomeEvents.maxEvents).map((event) => {
    const id = text(event.id, 40);
    if (!/^event-[a-f0-9]{20}$/.test(id)) invalid();
    const date = day(event.date, true);
    const endDate = day(event.endDate, true);
    if (date && endDate && endDate < date) invalid();
    const startTime = time(event.startTime);
    const endTime = time(event.endTime);
    if (startTime && endTime && endTime < startTime) invalid();
    const sourceStatus = event.sourceStatus;
    if (!(["current", "needs-review"].includes(sourceStatus)) || (!date && sourceStatus !== "needs-review")) invalid();
    const warnings = list(event.warnings, 10).map((warning) => text(warning, 300));
    return {
      id,
      title: text(event.title, 240),
      date,
      endDate,
      dateText: text(event.dateText, 240),
      startTime,
      endTime,
      location: text(event.location, 300),
      language: text(event.language, 120),
      descriptionSnippet: text(event.descriptionSnippet, 240),
      registrationUrl: url(event.registrationUrl, sourceUrl),
      detailUrl: url(event.detailUrl, sourceUrl),
      sourceUrl,
      sourceStatus,
      warnings,
      fetchedAt: timestamp(event.fetchedAt),
    };
  });
  const minEvents = officialSourceConfig.sources.welcomeEvents.minEvents;
  if (events.length < minEvents || new Set(events.map((event) => event.id)).size !== events.length) invalid();
  return { sourceId, title, canonicalUrl: sourceUrl, faviconUrl, events, fetchedAt };
}

export const CACHE_STATUSES = ["current", "stale", "needs-review", "fetch-failed", "parse-failed"];

export function validateCacheRecord(sourceId, value) {
  if (
    !officialSourceConfig.sources[sourceId] ||
    !value ||
    value.version !== 1 ||
    value.sourceId !== sourceId ||
    value.sourceUrl !== officialSourceConfig.sources[sourceId].url ||
    !CACHE_STATUSES.includes(value.status) ||
    !(value.contentHash === "" || /^[a-f0-9]{64}$/.test(value.contentHash))
  ) invalid();
  const data = value.data === null ? null : validateOfficialData(sourceId, value.data);
  if (!data && !["fetch-failed", "parse-failed"].includes(value.status)) invalid();
  const warnings = list(value.warnings, 80).map((warning) => text(warning, 300));
  const optionalTimestamp = (stamp) => stamp === "" ? "" : timestamp(stamp);
  return {
    version: 1,
    sourceId,
    sourceUrl: value.sourceUrl,
    fetchedAt: optionalTimestamp(value.fetchedAt),
    lastSuccessfulCheck: optionalTimestamp(value.lastSuccessfulCheck),
    lastChangedAt: optionalTimestamp(value.lastChangedAt),
    lastAttemptAt: optionalTimestamp(value.lastAttemptAt),
    contentHash: value.contentHash,
    status: value.status,
    warnings,
    lastFailure: text(value.lastFailure || "", 300),
    data,
    ...(value.pendingReview
      ? {
          pendingReview: {
            detectedAt: timestamp(value.pendingReview.detectedAt),
            contentHash: /^[a-f0-9]{64}$/.test(text(value.pendingReview.contentHash, 64))
              ? value.pendingReview.contentHash
              : invalid(),
            reason: text(value.pendingReview.reason, 300),
            data: validateOfficialData(sourceId, value.pendingReview.data),
          },
        }
      : {}),
  };
}
