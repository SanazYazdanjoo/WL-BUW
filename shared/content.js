import { isPublicDocument } from "./paths.js";
const fail = () => {
  throw new Error("Invalid content");
};
const text = (v, max = 12000) =>
  typeof v === "string" && v.length <= max ? v : fail();
const list = (v) => (Array.isArray(v) && v.length <= 100 ? v : fail());
const flag = (v) => (typeof v === "boolean" ? v : fail());
const id = (v) => (/^[a-z0-9][a-z0-9-]{0,79}$/.test(text(v, 80)) ? v : fail());
export function safeLink(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function whatsappLink(config) {
  if (!config?.whatsappEnabled || !config.semesterLabel) return "";
  const link = safeLink(config.whatsappGroupUrl);
  return link &&
    new URL(link).hostname === "chat.whatsapp.com" &&
    /^\/[a-zA-Z0-9]+$/.test(new URL(link).pathname)
    ? link
    : "";
}
const strings = (v) => list(v).map((x) => text(x));
const metadata = (v) => ({
  semesterLabel:
    v.semesterLabel === undefined ? "" : text(v.semesterLabel, 100),
  publishedAt: v.publishedAt === undefined ? "" : text(v.publishedAt, 40),
  progressRevision:
    v.progressRevision === undefined ? "legacy" : text(v.progressRevision, 100),
});
const source = (v) =>
  v === undefined
    ? undefined
    : {
        workbook: text(v.workbook, 200),
        sheet: text(v.sheet, 100),
        row: Number.isInteger(v.row) && v.row > 0 ? v.row : fail(),
      };
export function safeInformationLink(value) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
function topic(v) {
  return {
    id: id(v.id),
    order: Number.isInteger(v.order) ? v.order : fail(),
    title: text(v.title, 200),
    shortTitle: text(v.shortTitle, 100),
    eyebrow:
      v.eyebrow === undefined ? "Your first weeks" : text(v.eyebrow, 120),
    summary: text(v.summary),
    description: text(v.description),
    why: text(v.why),
    requiredDocumentsText:
      v.requiredDocumentsText === undefined
        ? ""
        : text(v.requiredDocumentsText),
    requiredItems:
      v.requiredItems === undefined ? [] : strings(v.requiredItems),
    source: source(v.source),
    actions: strings(v.actions),
    importantNotes: strings(v.importantNotes),
    category: text(v.category, 100),
    isActive: flag(v.isActive),
    isDemo: flag(v.isDemo),
    documents: list(v.documents).map((d) => {
      const path = text(d.path, 500);
      if (!isPublicDocument(path)) fail();
      return { label: text(d.label, 200), path };
    }),
    faqs: unique(
      list(v.faqs).map((f) => ({
        id: id(f.id),
        question: text(f.question, 500),
        answer: text(f.answer),
      })),
    ),
  };
}
function unique(items) {
  if (new Set(items.map((x) => x.id)).size !== items.length) fail();
  return items;
}
export function validateContent(kind, value) {
  if (!value || value.version !== 1) fail();
  if (kind === "config") {
    const config = {
      version: 1,
      semesterLabel: text(value.semesterLabel, 100),
      contactLabel: text(value.contactLabel, 200),
      helpText: text(value.helpText),
      whatsappEnabled: flag(value.whatsappEnabled),
      whatsappGroupUrl: text(value.whatsappGroupUrl, 500),
    };
    config.whatsappGroupUrl = whatsappLink(config);
    config.whatsappEnabled = Boolean(config.whatsappGroupUrl);
    return config;
  }
  if (kind === "onboarding" || kind === "after-arrival")
    return {
      version: 1,
      ...metadata(value),
      topics: unique(list(value.topics).map(topic))
        .filter((t) => t.isActive)
        .sort((a, b) => a.order - b.order),
    };
  if (kind === "health-insurance")
    return {
      version: 1,
      ...metadata(value),
      providers: unique(
        list(value.providers).map((p) => ({
          id: id(p.id),
          name: text(p.name, 200),
          address: text(p.address),
          openingHours: Object.fromEntries(
            [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ].map((d) => [
              d,
              p.openingHours?.[d] === undefined
                ? ""
                : text(p.openingHours[d], 500),
            ]),
          ),
          source: source(p.source),
        })),
      ),
    };
  if (kind === "useful-links")
    return {
      version: 1,
      ...metadata(value),
      links: unique(
        list(value.links).map((l) => {
          const url = safeInformationLink(l.url);
          if (!url) fail();
          return {
            id: id(l.id),
            title: text(l.title, 200),
            url,
            description: text(l.description),
            category: text(l.category, 100),
            isActive: flag(l.isActive),
            source: source(l.source),
          };
        }),
      ).filter((l) => l.isActive),
    };
  if (kind === "rundfunk")
    return {
      version: 1,
      ...metadata(value),
      title: text(value.title, 200),
      sections: list(value.sections).map((s) => ({
        heading: text(s.heading, 200),
        paragraphs: strings(s.paragraphs),
        source: source(s.source),
      })),
    };
  if (kind === "events")
    return {
      version: 1,
      events: unique(
        list(value.events).map((e) => {
          const date = text(e.date, 10);
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(Date.parse(date)) ||
            new Date(date).toISOString().slice(0, 10) !== date
          )
            fail();
          const time = (v) =>
            /^([01]\d|2[0-3]):[0-5]\d$/.test(text(v, 5)) ? v : fail();
          const startTime = time(e.startTime),
            endTime = time(e.endTime);
          if (endTime < startTime) fail();
          return {
            id: id(e.id),
            title: text(e.title, 200),
            date,
            startTime,
            endTime,
            location: text(e.location, 300),
            description: text(e.description),
            externalLink: safeLink(e.externalLink),
            isActive: flag(e.isActive),
            isDemo: flag(e.isDemo),
          };
        }),
      )
        .filter((e) => e.isActive)
        .sort((a, b) =>
          (a.date + a.startTime).localeCompare(b.date + b.startTime),
        ),
    };
  fail();
}
