import { createHash } from "node:crypto";
import { officialSourceConfig } from "./config.js";
import { canonicalText, parseDocument, safeExtractedUrl } from "./html.js";

const source = officialSourceConfig.sources.welcomeEvents;
const months = new Map([
  ["jan", 1], ["january", 1], ["feb", 2], ["february", 2],
  ["mar", 3], ["march", 3], ["apr", 4], ["april", 4],
  ["may", 5], ["jun", 6], ["june", 6], ["jul", 7], ["july", 7],
  ["aug", 8], ["august", 8], ["sep", 9], ["sept", 9], ["september", 9],
  ["oct", 10], ["october", 10], ["nov", 11], ["november", 11],
  ["dec", 12], ["december", 12],
]);
const isoDate = (day, month, year) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return "";
  return date.toISOString().slice(0, 10);
};

export function parseSourceDate(value) {
  const text = canonicalText(value, 300);
  const numeric = text.match(/\b(\d{1,2})\.(\d{1,2})\.(?:\s*,?\s*)(\d{4})\b/);
  if (numeric) {
    const date = isoDate(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));
    return date ? { start: date, end: date, raw: numeric[0] } : null;
  }
  const monthDate = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?\s*(?:[-–]\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?)?\s*,?\s*(\d{4})\b/i);
  if (!monthDate) return null;
  const firstMonth = months.get(monthDate[2].toLowerCase());
  const secondMonth = monthDate[4] ? months.get(monthDate[4].toLowerCase()) : firstMonth;
  if (!firstMonth || !secondMonth) return null;
  const start = isoDate(Number(monthDate[1]), firstMonth, Number(monthDate[5]));
  const end = isoDate(Number(monthDate[3] || monthDate[1]), secondMonth, Number(monthDate[5]));
  return start && end ? { start, end, raw: monthDate[0] } : null;
}

function parseClock(value) {
  let hour = Number(value.hour);
  const minute = Number(value.minute || 0);
  const meridiem = value.meridiem?.toLowerCase();
  if (minute > 59 || hour > 23 || hour < 0) return "";
  if (meridiem) {
    if (hour < 1 || hour > 12) return "";
    hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimes(value) {
  const text = canonicalText(value, 400).replace(/\b20\d{2}\b/g, " ");
  const matches = [...text.matchAll(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\b/gi)]
    .filter((match) => match[2] || match[3]);
  if (!matches.length) return { startTime: "", endTime: "", invalid: /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(text) };
  const first = matches[0];
  const second = matches[1];
  const inherited = second?.[3] || first[3] || "";
  const startTime = parseClock({ hour: first[1], minute: first[2], meridiem: first[3] || inherited });
  const endTime = second
    ? parseClock({ hour: second[1], minute: second[2], meridiem: second[3] || first[3] || "" })
    : "";
  if (!startTime || (second && !endTime) || (startTime && endTime && endTime < startTime))
    return { startTime: "", endTime: "", invalid: true };
  return { startTime, endTime, invalid: false };
}

function cleanDescription(card, $) {
  for (const paragraph of card.find("p").toArray()) {
    const text = canonicalText($(paragraph).text(), 2000);
    if (!text || /^(when|where|language|languag)\s*:/i.test(text) || /register\s+(here|now)/i.test(text)) continue;
    return text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text;
  }
  return "";
}

function eventLocation(title, card, $) {
  if (/\bonline\b/i.test(title)) return "Online";
  const cardText = canonicalText(card.text(), 8000);
  if (/\bonline\b.{0,40}\b(session|workshop|event|room)\b/i.test(cardText)) return "Online";
  const paragraphs = card.find("p").toArray();
  for (let i = 0; i < paragraphs.length; i++) {
    const text = canonicalText($(paragraphs[i]).text(), 500);
    if (/^where\s*[?:]?$/i.test(text) && paragraphs[i + 1])
      return canonicalText($(paragraphs[i + 1]).text(), 300);
    const match = text.match(/^where\s*:\s*(.+)$/i);
    if (match) return canonicalText(match[1], 300);
  }
  return "";
}

function parseEvent(heading, $, fetchedAt) {
  const headingText = canonicalText($(heading).text(), 400);
  const separator = headingText.indexOf("|");
  if (separator < 1) return null;
  const headingDateText = canonicalText(headingText.slice(0, separator), 120);
  const title = canonicalText(headingText.slice(separator + 1), 240);
  if (!title) return null;
  const card = $(heading).closest(".frame").length
    ? $(heading).closest(".frame")
    : $(heading).parent().parent();
  const paragraphs = card.find("p").toArray();
  let whenText = "";
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraphText = canonicalText($(paragraphs[i]).text(), 500);
    const label = paragraphText.match(/^(when|date)\s*[?:]?\s*(.*)$/i);
    if (!label) continue;
    whenText = label[2] || canonicalText($(paragraphs[i + 1]).text(), 500);
    break;
  }
  const detailDateText = whenText;
  const headingDate = parseSourceDate(headingDateText);
  const detailDate = parseSourceDate(detailDateText);
  const warnings = [];
  if (!headingDate && !detailDate) warnings.push("The event date could not be verified.");
  const conflict = headingDate && detailDate &&
    (headingDate.start !== detailDate.start || headingDate.end !== detailDate.end);
  if (conflict) warnings.push("The heading date differs from the event details.");
  const date = conflict ? null : detailDate || headingDate;
  const sourceDateText = [headingDateText, detailDateText].filter(Boolean).join(" · ").slice(0, 240);
  const timeText = detailDateText.replace(/.*?\b20\d{2}\b[,.]?\s*/i, "");
  const parsedTimes = parseTimes(timeText);
  if (!conflict && parsedTimes.invalid)
    warnings.push("The event time could not be verified.");
  const times = conflict || parsedTimes.invalid
    ? { startTime: "", endTime: "" }
    : parsedTimes;
  let languageText = "";
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraphText = canonicalText($(paragraphs[i]).text(), 200);
    const label = paragraphText.match(/^(language|languag)\s*:?\s*(.*)$/i);
    if (!label) continue;
    languageText = label[2] || canonicalText($(paragraphs[i + 1]).text(), 200);
    break;
  }
  const language = canonicalText(languageText, 120);
  const registration = [];
  const detail = [];
  card.find("a[href]").each((_, anchor) => {
    const label = canonicalText($(anchor).text(), 140);
    const url = safeExtractedUrl(anchor.attribs.href, source.url);
    if (!url) return;
    if (/register|registration/i.test(label)) registration.push(url);
    else if (new URL(url).hostname === "www.uni-weimar.de" && url !== source.url) detail.push(url);
  });
  const registrationUrl = [...new Set(registration)][0] || "";
  const detailUrl = [...new Set(detail)][0] || source.url;
  const stableSeed = `${title.toLowerCase()}|${headingDateText.toLowerCase()}`;
  return {
    id: `event-${createHash("sha256").update(stableSeed).digest("hex").slice(0, 20)}`,
    title,
    date: date?.start || "",
    endDate: date?.end && date.end !== date.start ? date.end : "",
    dateText: sourceDateText,
    startTime: times.startTime,
    endTime: times.endTime,
    location: eventLocation(title, card, $),
    language,
    descriptionSnippet: cleanDescription(card, $),
    registrationUrl,
    detailUrl,
    sourceUrl: source.url,
    sourceStatus: warnings.length ? "needs-review" : "current",
    warnings,
    fetchedAt,
  };
}

export function parseWelcomeEvents(html, fetchedAt = new Date().toISOString()) {
  const { $, main, title, faviconUrl } = parseDocument(html, source.label, source.url);
  const records = [];
  main.find("h2, h3, h4").each((_, heading) => {
    const text = canonicalText($(heading).text(), 400);
    if (!/^\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\.?\s*(?:[-–]\s*\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\.?)?\s*,?\s*\d{4}\s*\|/i.test(text))
      return;
    const event = parseEvent(heading, $, fetchedAt);
    if (event) records.push(event);
  });
  if (!records.length || records.length > source.maxEvents)
    throw new Error("The welcome programme could not be verified.");
  const registrations = records.map((event) => event.registrationUrl).filter(Boolean);
  for (const event of records) {
    if (
      event.registrationUrl &&
      registrations.filter((url) => url === event.registrationUrl).length === 1
    ) {
      event.id = `event-${createHash("sha256").update(event.registrationUrl).digest("hex").slice(0, 20)}`;
    }
  }
  const ids = records.map((event) => event.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("The welcome programme contains duplicate events.");
  return { sourceId: "welcomeEvents", title, canonicalUrl: source.url, faviconUrl, events: records, fetchedAt };
}
