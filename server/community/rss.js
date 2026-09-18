import { Buffer } from "node:buffer";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import * as cheerio from "cheerio";

export const UNIVERSITY_RSS_URL = "https://www.uni-weimar.de/en/university/aktuell/pinnwaende/rss/";
const HOST = "www.uni-weimar.de";
const MAX_BYTES = 4_000_000;
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true });

export function sanitizeRssExcerpt(value) {
  if (typeof value !== "string") return "";
  const $ = cheerio.load(`<div>${value.slice(0, 12000)}</div>`);
  $("script, style, iframe, object, svg").remove();
  return $("div").text()
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "")
    .replace(/(?:\+?\d[\d\s()./-]{7,}\d)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function approvedNoticeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === HOST && !url.port && !url.username && !url.password && !url.hash && url.href.length < 1000 ? url.href : "";
  } catch {
    return "";
  }
}

function asArray(value) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function normalizeDate(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

export function parseCommunityRss(xml, feed, now = new Date()) {
  if (typeof xml !== "string" || !xml.trim() || Buffer.byteLength(xml) > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error("Invalid RSS document");
  const root = parser.parse(xml);
  const rawItems = asArray(root?.rss?.channel?.item ?? root?.feed?.entry);
  const cutoff = now.getTime() - feed.maxAgeDays * 86_400_000;
  const output = [];
  const seen = new Set();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const category = asArray(raw.category).map((v) => typeof v === "object" ? v["#text"] : v).find((v) => feed.categories.includes(String(v || "")));
    const date = normalizeDate(raw.pubDate || raw.published || raw.updated);
    const linkValue = typeof raw.link === "object" ? raw.link["@_href"] : raw.link;
    const url = approvedNoticeUrl(linkValue || "");
    const title = sanitizeRssExcerpt(String(raw.title?.["#text"] ?? raw.title ?? ""));
    if (!category || !date || Date.parse(date) < cutoff || !url || !title) continue;
    const key = String(raw.guid || url);
    if (seen.has(key)) continue;
    seen.add(key);
    // RSS descriptions can contain contact data or personal names; process only through
    // the sanitizer and do not publish them in the student-facing notice model.
    sanitizeRssExcerpt(String(raw.description?.["#text"] ?? raw.description ?? raw.summary ?? ""));
    output.push({ id: key.slice(0, 300), title: title.slice(0, 180), date, category: category === "Housing / Accomodation" ? "Housing & accommodation" : category === "Piazza" ? "Community notice" : "Offering / seeking", excerpt: "", url });
  }
  return output.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
}

export async function fetchCommunityRss(fetchImpl = fetch) {
  let target = UNIVERSITY_RSS_URL;
  for (let count = 0; count <= 2; count++) {
    const url = new URL(target);
    if (url.protocol !== "https:" || url.hostname !== HOST || url.pathname !== new URL(UNIVERSITY_RSS_URL).pathname || url.search || url.hash) throw new Error("Unapproved RSS redirect");
    const response = await fetchImpl(target, { redirect: "manual", headers: { Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(10000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || count === 2) throw new Error("RSS redirect unavailable");
      target = new URL(location, target).href;
      continue;
    }
    if (!response.ok || !/^(application\/(?:rss\+xml|xml)|text\/xml)(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) {
      await response.body?.cancel();
      throw new Error("RSS source unavailable");
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_BYTES) throw new Error("RSS too large");
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body || []) {
      size += chunk.byteLength;
      if (size > MAX_BYTES) throw new Error("RSS too large");
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "");
  }
  throw new Error("RSS redirect unavailable");
}
