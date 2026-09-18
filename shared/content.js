import { isPublicDocument } from "./paths.js";
const fail = () => {
  throw new Error("Invalid content");
};
const text = (v, max = 12000) =>
  typeof v === "string" && v.length <= max ? v : fail();
const list = (v) => (Array.isArray(v) && v.length <= 100 ? v : fail());
const flag = (v) => (typeof v === "boolean" ? v : fail());
const id = (v) => (/^[a-z0-9][a-z0-9-]{0,79}$/.test(text(v, 80)) ? v : fail());
const localPath = (v) => {
  if (v === undefined || v === "") return "";
  if (
    typeof v !== "string" ||
    !/^\/[a-z0-9/-]+$/.test(v) ||
    v.includes("//") ||
    v.split("/").some((segment) => segment === "." || segment === "..")
  ) fail();
  return v;
};
export function safeLink(value) {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    const ipHost = host.replace(/^\[|\]$/g, "");
    const privateIp = /^(?:0|10|127|169\.254|192\.168)\./.test(ipHost) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(ipHost) ||
      ipHost === "::" || ipHost === "::1" || /^::ffff:/i.test(ipHost) ||
      /^(?:fc|fd|fe80:)/i.test(ipHost);
    return u.protocol === "https:" && !u.username && !u.password &&
      !["localhost", "localhost.", "[::1]"].includes(host) &&
      !host.endsWith(".local") && !privateIp
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function inferLinkLabel(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host === "uni-weimar.de" || host.endsWith(".uni-weimar.de")) return "Official information";
    if (host === "chat.whatsapp.com") return "Open WhatsApp";
    if (["t.me", "telegram.me"].includes(host)) return "Open Telegram";
    return "Open link";
  } catch {
    return "Open link";
  }
}
function approvedUniversityUrl(value) {
  const url = safeLink(value);
  if (!url) return fail();
  const host = new URL(url).hostname;
  return host === "uni-weimar.de" || host.endsWith(".uni-weimar.de")
    ? url
    : fail();
}
function approvedTelegramUrl(value) {
  const url = safeLink(value);
  const parsed = url ? new URL(url) : null;
  return parsed && ["t.me", "telegram.me"].includes(parsed.hostname) &&
    /^\/[A-Za-z0-9_+/-]+\/?$/.test(parsed.pathname) && !parsed.search && !parsed.hash
    ? url
    : "";
}
function approvedInstagramUrl(value) {
  const url = safeLink(value);
  const parsed = url ? new URL(url) : null;
  return parsed && ["instagram.com", "www.instagram.com"].includes(parsed.hostname) &&
    !parsed.search && !parsed.hash ? url : "";
}
function validEmail(value) {
  const email = text(value, 254).trim();
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : fail();
}
function validDate(value) {
  const date = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
    ? date
    : fail();
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
    // Workbook links are staff-reviewed HTTPS destinations. The parser warns
    // for non-university First Step domains without silently rewriting them.
    officialSource: v.officialSource ? (safeLink(v.officialSource) || fail()) : "",
    officialSourceLabel: v.officialSourceLabel === undefined ? "" : text(v.officialSourceLabel, 200),
    lastReviewed: v.lastReviewed ? validDate(v.lastReviewed) : "",
    why: text(v.why),
    requiredDocumentsText:
      v.requiredDocumentsText === undefined
        ? ""
        : text(v.requiredDocumentsText),
    requiredItems:
      v.requiredItems === undefined ? [] : strings(v.requiredItems),
    source: source(v.source),
    relatedPage: localPath(v.relatedPage),
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
      semesterCode: value.semesterCode === undefined ? "" : text(value.semesterCode, 40),
      welcomeLoungeEnabled: value.welcomeLoungeEnabled === undefined ? true : flag(value.welcomeLoungeEnabled),
      defaultLanguage: value.defaultLanguage === undefined ? "English" : text(value.defaultLanguage, 40),
      contentReviewedDate: value.contentReviewedDate ? validDate(value.contentReviewedDate) : "",
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
          const url = l.url ? safeInformationLink(l.url) : "";
          if (l.url && !url) fail();
          return {
            id: id(l.id),
            order: l.order === undefined ? 0 : Number.isInteger(l.order) && l.order >= 0 ? l.order : fail(),
            title: text(l.title, 200),
            url,
            description: text(l.description),
            linkLabel: l.linkLabel === undefined ? "" : text(l.linkLabel, 200),
            category: text(l.category, 100),
            isActive: flag(l.isActive),
            source: source(l.source),
          };
        }),
      ).filter((l) => l.isActive).sort((a, b) => a.order - b.order),
    };
  if (kind === "support-resources")
    return {
      version: 1,
      resources: unique(list(value.resources).map((r) => ({
        id: id(r.id),
        order: Number.isInteger(r.order) && r.order > 0 ? r.order : fail(),
        title: text(r.title, 200),
        type: ["student-initiative", "student-representation", "peer-support", "official-support"].includes(r.type) ? r.type : fail(),
        shortText: text(r.shortText, 700),
        officialUrl: r.officialUrl ? approvedUniversityUrl(r.officialUrl) : "",
        websiteUrl: r.websiteUrl ? safeLink(r.websiteUrl) : "",
        telegramUrl: r.telegramUrl ? approvedTelegramUrl(r.telegramUrl) : "",
        instagramUrl: r.instagramUrl ? approvedInstagramUrl(r.instagramUrl) : "",
        email: r.email === undefined ? "" : validEmail(r.email),
        isActive: flag(r.isActive),
      }))).filter((r) => r.isActive).sort((a, b) => a.order - b.order),
    };
  if (kind === "community-resources")
    return {
      version: 1,
      resources: unique(list(value.resources).map((r) => ({
        id: id(r.id), order: Number.isInteger(r.order) && r.order > 0 ? r.order : fail(),
        title: text(r.title, 200), type: text(r.type, 80),
        shortText: text(r.shortText, 700), url: safeLink(r.url),
        platform: r.platform === "telegram" && approvedTelegramUrl(r.url) ? "telegram" : r.platform === "website" ? "website" : fail(),
        isActive: flag(r.isActive),
      }))).filter((r) => r.isActive).sort((a, b) => a.order - b.order),
    };
  if (kind === "official-links")
    return {
      version: 1,
      links: unique(list(value.links).map((l) => ({
        id: id(l.id), label: text(l.label, 200), url: approvedUniversityUrl(l.url),
        category: text(l.category, 100), lastReviewed: l.lastReviewed ? validDate(l.lastReviewed) : "",
        isActive: flag(l.isActive),
      }))).filter((l) => l.isActive),
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
  if (kind === "community") {
    const feeds = unique(list(value.feeds).map((feed) => {
      const url = safeLink(feed.url);
      const parsed = url ? new URL(url) : null;
      if (!parsed || parsed.hostname !== "www.uni-weimar.de" ||
        parsed.pathname !== "/en/university/aktuell/pinnwaende/rss/" ||
        parsed.search || parsed.hash) fail();
      const categories = strings(feed.categories);
      if (!categories.length || categories.some((category) => ![
        "Housing / Accomodation", "Offering / Seeking", "Piazza",
      ].includes(category))) fail();
      return {
        id: id(feed.id), label: text(feed.label, 200), url,
        categories, maxAgeDays: Number.isInteger(feed.maxAgeDays) && feed.maxAgeDays >= 1 && feed.maxAgeDays <= 30 ? feed.maxAgeDays : fail(),
        refreshMinutes: Number.isInteger(feed.refreshMinutes) && feed.refreshMinutes >= 15 && feed.refreshMinutes <= 1440 ? feed.refreshMinutes : fail(),
        isActive: flag(feed.isActive),
      };
    }));
    const resources = unique(list(value.resources).map((resource) => {
      const url = safeLink(resource.url);
      const parsed = url ? new URL(url) : null;
      if (!parsed || !["www.uni-weimar.de", "m18.uni-weimar.de"].includes(parsed.hostname)) fail();
      return {
        id: id(resource.id), title: text(resource.title, 200),
        description: text(resource.description, 1000), url,
        category: text(resource.category, 100), isActive: flag(resource.isActive),
      };
    })).filter((resource) => resource.isActive);
    const sharing = value.sharingIsCaring || {};
    const sharingUrl = sharing.url ? safeLink(sharing.url) : "";
    const validTelegram = sharingUrl && ["t.me", "telegram.me"].includes(new URL(sharingUrl).hostname) && !new URL(sharingUrl).search;
    if (sharing.enabled && !validTelegram) fail();
    const notices = list(value.notices || []).map((notice) => {
      const date = text(notice.date, 40);
      const url = safeLink(notice.url);
      if (!Number.isFinite(Date.parse(date)) || !url || new URL(url).hostname !== "www.uni-weimar.de") fail();
      return {
        id: text(notice.id, 300), title: text(notice.title, 180), date,
        category: text(notice.category, 100), excerpt: text(notice.excerpt, 240), url,
      };
    });
    return {
    version: 1, ...metadata(value), feeds: feeds.filter((feed) => feed.isActive),
      resources, notices, sharingIsCaring: {
        enabled: Boolean(sharing.enabled && validTelegram),
        url: sharing.enabled && validTelegram ? sharingUrl : "",
        label: text(sharing.label || "Sharing is Caring", 200),
      },
    };
  }
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
