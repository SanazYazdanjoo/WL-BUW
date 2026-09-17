import { officialSourceConfig } from "./config.js";
import {
  canonicalText,
  parseDocument,
  safeExtractedUrl,
  slug,
} from "./html.js";

const source = officialSourceConfig.sources.preparingStudies;

export function parsePreparingStudies(html, fetchedAt = new Date().toISOString()) {
  const { $, main, title, faviconUrl } = parseDocument(html, source.label, source.url);
  const sections = [];
  const seen = new Set();
  main.find("h2, h3").each((_, heading) => {
    const titleText = canonicalText($(heading).text(), 200);
    if (!titleText || titleText.toLowerCase() === title.toLowerCase()) return;
    const id = slug(titleText);
    if (!id || seen.has(id)) return;
    seen.add(id);
    const card = $(heading).closest(".csc-default").length
      ? $(heading).closest(".csc-default")
      : $(heading).closest(".frame");
    const links = [];
    const linkSeen = new Set();
    card.find("a[href]").each((__, anchor) => {
      const url = safeExtractedUrl(anchor.attribs.href, source.url);
      const label = canonicalText($(anchor).text(), 160);
      if (!url || !label || linkSeen.has(url)) return;
      linkSeen.add(url);
      links.push({ label, url });
    });
    const official = links.find((link) => new URL(link.url).hostname === "www.uni-weimar.de");
    sections.push({
      id,
      title: titleText,
      officialUrl: official?.url || source.url,
      externalLinks: links.slice(0, 12),
    });
  });
  if (sections.length < source.minSections)
    throw new Error("The official source sections could not be verified.");
  return {
    sourceId: "preparingStudies",
    title,
    canonicalUrl: source.url,
    faviconUrl,
    sections,
    fetchedAt,
  };
}
