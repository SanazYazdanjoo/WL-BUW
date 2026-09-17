import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { approvedSourceUrl } from "./config.js";

const canonicalText = (value, max = 12000) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r\n ]+/g, " ")
    .trim()
    .slice(0, max);

export function slug(value) {
  return canonicalText(value, 300)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function safeExtractedUrl(value, baseUrl) {
  try {
    if (typeof value !== "string" || !value.trim()) return "";
    const url = new URL(value, baseUrl);
    if (url.protocol === "http:" && url.hostname === "www.uni-weimar.de")
      url.protocol = "https:";
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.href.length > 1000
    )
      return "";
    return url.href;
  } catch {
    return "";
  }
}

export function parseDocument(html, expectedTitle, pageUrl) {
  if (typeof html !== "string" || !html.trim() || html.length > 1_000_000)
    throw new Error("The official page could not be read.");
  if (/access denied|page not found|404\s*(error|not found)|typo3 error/i.test(html.slice(0, 12000)))
    throw new Error("The official page returned an error page.");
  const $ = cheerio.load(html);
  const main = $("#content_main");
  const title = canonicalText(
    $("#content_top h1").first().text() || $("h1").first().text(),
    200,
  );
  if (!main.length || !title || title.toLowerCase() !== expectedTitle.toLowerCase())
    throw new Error("The expected official page content was not found.");
  const iconHref = $("link[rel~='icon']").first().attr("href") || "";
  return { $, main, title, faviconUrl: safeExtractedUrl(iconHref, pageUrl) };
}

export function stableId(prefix, value) {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
}

export { canonicalText, approvedSourceUrl };
