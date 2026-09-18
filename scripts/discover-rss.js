import { XMLParser, XMLValidator } from "fast-xml-parser";
import { fetchCommunityRss, parseCommunityRss, UNIVERSITY_RSS_URL } from "../server/community/rss.js";
import community from "../content/app-content/community.json" with { type: "json" };

const xml = await fetchCommunityRss();
if (XMLValidator.validate(xml) !== true) throw new Error("The university RSS response is not valid XML.");
const channel = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml)?.rss?.channel;
const items = Array.isArray(channel?.item) ? channel.item : channel?.item ? [channel.item] : [];
const categories = new Map();
for (const item of items) {
  const values = Array.isArray(item.category) ? item.category : item.category ? [item.category] : [];
  for (const category of values) {
    const label = String(typeof category === "object" ? category["#text"] || "" : category).trim();
    if (label) categories.set(label, (categories.get(label) || 0) + 1);
  }
}
console.log(`University RSS source: ${channel?.title || "(untitled)"}`);
console.log(`Feed URL: ${UNIVERSITY_RSS_URL}`);
console.log(`Items inspected: ${items.length}`);
console.log("Categories (discovery only; this does not enable categories):");
for (const [category, count] of [...categories].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`- ${category}: ${count}`);
const normalized = parseCommunityRss(xml, community.feeds[0]);
console.log(`Current normalized items in the configured allowlist: ${normalized.length}`);
