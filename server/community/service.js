import { createPrivateStore } from "../staff/store.js";
import { validateContent } from "../../shared/content.js";
import { fetchCommunityRss, parseCommunityRss } from "./rss.js";

const ageMinutes = (date, now) => Math.max(0, (now.getTime() - Date.parse(date)) / 60_000);

export function createCommunityFeedService({ env = process.env, fetchImpl = fetch, now = () => new Date(), injectedStore } = {}) {
  const store = injectedStore || createPrivateStore(env, fetchImpl);
  const cachePath = store.paths.communityRss || "official-source-cache/community-rss.json";
  let pending;
  return {
    async getPublic(rawContent) {
      const content = validateContent("community", rawContent);
      const activeFeed = content.feeds[0];
      if (!activeFeed) return { status: "unavailable", notices: [] };
      if (!env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD) return { status: "unavailable", notices: [] };
      let saved;
      try { saved = await store.readJson(cachePath); } catch { return { status: "unavailable", notices: [] }; }
      let record = saved.value;
      if (record && (record.version !== 1 || record.feedId !== activeFeed.id || !Array.isArray(record.notices) || (record.checkedAt && !Number.isFinite(Date.parse(record.checkedAt))) || (record.lastAttemptAt && !Number.isFinite(Date.parse(record.lastAttemptAt))))) record = null;
      const nowDate = now();
      const failureBackoff = record?.lastAttemptAt && ageMinutes(record.lastAttemptAt, nowDate) < activeFeed.refreshMinutes;
      const shouldRefresh = !failureBackoff && (!record?.checkedAt || ageMinutes(record.checkedAt, nowDate) >= activeFeed.refreshMinutes);
      if (shouldRefresh) {
        try {
          pending ||= fetchCommunityRss(fetchImpl).then((xml) => parseCommunityRss(xml, activeFeed, nowDate)).finally(() => { pending = null; });
          const notices = await pending;
          const next = { version: 1, feedId: activeFeed.id, checkedAt: nowDate.toISOString(), lastAttemptAt: nowDate.toISOString(), notices };
          await store.writeJson(cachePath, next, saved.etag ?? null);
          record = next;
        } catch {
          // Keep and re-filter the last successful snapshot when the university feed is unavailable.
          const failed = record
            ? { ...record, lastAttemptAt: nowDate.toISOString() }
            : { version: 1, feedId: activeFeed.id, checkedAt: "", lastAttemptAt: nowDate.toISOString(), notices: [] };
          try {
            await store.writeJson(cachePath, failed, saved.etag ?? null);
            record = failed;
          } catch {
            // If private cache storage is also unavailable, fail safely without exposing errors.
          }
        }
      }
      if (!record?.checkedAt) return { status: "unavailable", notices: [] };
      const cutoff = nowDate.getTime() - activeFeed.maxAgeDays * 86_400_000;
      const notices = record.notices.filter((item) => Number.isFinite(Date.parse(item.date)) && Date.parse(item.date) >= cutoff && /^https:\/\/www\.uni-weimar\.de\//.test(item.url));
      return { status: ageMinutes(record.checkedAt, nowDate) > 24 * 60 ? "stale" : "current", notices };
    },
  };
}
