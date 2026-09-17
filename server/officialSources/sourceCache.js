import { createHash } from "node:crypto";
import { createPrivateStore } from "../staff/store.js";
import { officialSourceConfig, SOURCE_IDS } from "./config.js";
import { fetchOfficialSource } from "./fetchOfficialSource.js";
import { parsePreparingStudies } from "./parsePreparingStudies.js";
import { parseWelcomeEvents } from "./parseWelcomeEvents.js";
import { validateCacheRecord, validateOfficialData } from "./validateOfficialData.js";

const parserBySource = {
  preparingStudies: parsePreparingStudies,
  welcomeEvents: parseWelcomeEvents,
};
const stableHash = (value) => {
  const comparable = structuredClone(value);
  delete comparable.fetchedAt;
  for (const event of comparable.events || []) delete event.fetchedAt;
  return createHash("sha256").update(JSON.stringify(comparable)).digest("hex");
};
const hasCredentials = (env) => Boolean(env.NEXTCLOUD_USERNAME && env.NEXTCLOUD_APP_PASSWORD);

export function createOfficialSourcesService({
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
  injectedStore,
} = {}) {
  const store = injectedStore || createPrivateStore(env, fetchImpl);
  const stamp = () => now().toISOString();
  const cachePath = (sourceId) => store.paths.officialSources[sourceId];

  async function readState(sourceId) {
    if (!hasCredentials(env)) return { available: false, record: null, etag: null, failure: "unavailable" };
    try {
      const saved = await store.readJson(cachePath(sourceId), 512_000);
      if (!saved.value) return { available: true, record: null, etag: null };
      try {
        return {
          available: true,
          record: validateCacheRecord(sourceId, saved.value),
          etag: saved.etag,
        };
      } catch {
        return { available: true, record: null, etag: saved.etag, failure: "corrupt" };
      }
    } catch (error) {
      return { available: false, record: null, etag: null, failure: error.status === 422 ? "corrupt" : "unavailable" };
    }
  }

  async function writeRecord(sourceId, record, etag) {
    const validated = validateCacheRecord(sourceId, record);
    return store.writeJson(cachePath(sourceId), validated, etag);
  }

  function ageHours(record) {
    if (!record?.lastSuccessfulCheck) return Infinity;
    return Math.max(0, (now().getTime() - Date.parse(record.lastSuccessfulCheck)) / 3_600_000);
  }

  function shouldHold(state, sourceId, force) {
    const record = state.record;
    if (!record) return false;
    const source = officialSourceConfig.sources[sourceId];
    if (record.pendingReview && !force) return true;
    if (record.lastFailure && record.lastAttemptAt &&
      now().getTime() - Date.parse(record.lastAttemptAt) < source.retryMinutes * 60_000)
      return true;
    return !force && ageHours(record) < source.refreshHours;
  }

  function fallbackRecord(sourceId, status = "unavailable") {
    const source = officialSourceConfig.sources[sourceId];
    return {
      sourceId,
      label: source.label,
      url: source.url,
      status,
      lastSuccessfulCheck: "",
      lastChangedAt: "",
      warnings: [],
      data: null,
    };
  }

  function publicRecord(sourceId, state) {
    if (!officialSourceConfig.enabled || !officialSourceConfig.sources[sourceId].enabled)
      return fallbackRecord(sourceId, "unavailable");
    if (state.failure === "corrupt") return fallbackRecord(sourceId, "needs-review");
    if (!state.record) return fallbackRecord(sourceId, "unavailable");
    const record = state.record;
    let status = record.status;
    if (record.pendingReview || status === "needs-review") status = "needs-review";
    else if (record.lastFailure || ageHours(record) >= officialSourceConfig.sources[sourceId].staleAfterHours) status = "stale";
    else status = "current";
    return {
      sourceId,
      label: officialSourceConfig.sources[sourceId].label,
      url: officialSourceConfig.sources[sourceId].url,
      status,
      lastSuccessfulCheck: record.lastSuccessfulCheck,
      lastChangedAt: record.lastChangedAt,
      warnings: status === "needs-review" && !record.pendingReview
        ? record.warnings
        : [],
      data: record.data,
    };
  }

  async function writeFailure(sourceId, state, failure, failedAt) {
    const source = officialSourceConfig.sources[sourceId];
    const previous = state.record;
    const status = previous?.pendingReview
      ? "needs-review"
      : failure.sourceFailure === "parse-failed"
        ? "parse-failed"
        : "fetch-failed";
    const record = previous
      ? {
          ...previous,
          status,
          lastAttemptAt: failedAt,
          lastFailure: failure.message,
          warnings: previous.pendingReview ? previous.warnings : [failure.message],
        }
      : {
          version: 1,
          sourceId,
          sourceUrl: source.url,
          fetchedAt: "",
          lastSuccessfulCheck: "",
          lastChangedAt: "",
          lastAttemptAt: failedAt,
          contentHash: "",
          status,
          warnings: [failure.message],
          lastFailure: failure.message,
          data: null,
        };
    try {
      await writeRecord(sourceId, record, state.etag);
      return record;
    } catch (error) {
      if (error.status === 409) {
        const current = await readState(sourceId);
        if (current.record) return current.record;
      }
      return previous || record;
    }
  }

  function reviewReason(previous, data, sourceId) {
    if (!previous?.data) return "";
    const before = sourceId === "welcomeEvents" ? previous.data.events.length : previous.data.sections.length;
    const after = sourceId === "welcomeEvents" ? data.events.length : data.sections.length;
    return Math.abs(before - after) > officialSourceConfig.sources[sourceId].maxCountChange
      ? `The number of published ${sourceId === "welcomeEvents" ? "events" : "sections"} changed from ${before} to ${after}.`
      : "";
  }

  async function refreshOne(sourceId, { force = false } = {}) {
    const source = officialSourceConfig.sources[sourceId];
    if (!source || !officialSourceConfig.enabled || !source.enabled)
      return { result: "disabled", sourceId };
    const state = await readState(sourceId);
    if (!state.available) return { result: "unavailable", sourceId };
    if (state.failure === "corrupt") return { result: "needs-review", sourceId };
    if (shouldHold(state, sourceId, force))
      return { result: state.record?.pendingReview ? "needs-review" : "no-change", sourceId };
    if (!hasCredentials(env)) return { result: "unavailable", sourceId };

    const started = Date.now();
    const checkedAt = stamp();
    let candidate;
    try {
      const html = await fetchOfficialSource(sourceId, fetchImpl);
      candidate = validateOfficialData(sourceId, parserBySource[sourceId](html, checkedAt));
    } catch (error) {
      const failure = {
        sourceFailure: error.sourceFailure || "parse-failed",
        message: error.message || "The official source could not be verified.",
      };
      const previous = await writeFailure(sourceId, state, failure, checkedAt);
      console.info("official-source sync:", JSON.stringify({
        sourceId,
        result: failure.sourceFailure,
        durationMs: Date.now() - started,
        warnings: previous.warnings?.length || 0,
      }));
      return { result: failure.sourceFailure, sourceId };
    }

    const contentHash = stableHash(candidate);
    const reason = reviewReason(state.record, candidate, sourceId);
    const record = state.record;
    if (reason || record?.pendingReview) {
      const pendingReview = {
        detectedAt: checkedAt,
        contentHash,
        reason: reason || record.pendingReview.reason,
        data: candidate,
      };
      const held = {
        ...(record || {
          version: 1,
          sourceId,
          sourceUrl: source.url,
          fetchedAt: checkedAt,
          lastSuccessfulCheck: checkedAt,
          lastChangedAt: checkedAt,
          contentHash,
          status: "needs-review",
          warnings: [],
          lastFailure: "",
          data: candidate,
        }),
        status: "needs-review",
        lastAttemptAt: checkedAt,
        lastFailure: "",
        pendingReview,
        warnings: [pendingReview.reason],
      };
      try {
        await writeRecord(sourceId, held, state.etag);
      } catch (error) {
        if (error.status !== 409) {
          console.info("official-source sync:", JSON.stringify({ sourceId, result: "cache-unavailable", durationMs: Date.now() - started, warnings: 1 }));
          return { result: "cache-unavailable", sourceId };
        }
      }
      console.info("official-source sync:", JSON.stringify({ sourceId, result: "needs-review", durationMs: Date.now() - started, warnings: held.warnings.length }));
      return { result: "needs-review", sourceId };
    }

    const warnings = sourceId === "welcomeEvents"
      ? [...new Set(candidate.events.flatMap((event) => event.warnings))]
      : [];
    const next = {
      version: 1,
      sourceId,
      sourceUrl: source.url,
      fetchedAt: checkedAt,
      lastSuccessfulCheck: checkedAt,
      lastChangedAt: record?.contentHash === contentHash ? record.lastChangedAt : checkedAt,
      lastAttemptAt: checkedAt,
      contentHash,
      status: warnings.length ? "needs-review" : "current",
      warnings,
      lastFailure: "",
      data: candidate,
    };
    try {
      await writeRecord(sourceId, next, state.etag);
    } catch (error) {
      if (error.status === 409) {
        const latest = await readState(sourceId);
        console.info("official-source sync:", JSON.stringify({ sourceId, result: "concurrent-update", durationMs: Date.now() - started, warnings: warnings.length }));
        return { result: latest.record ? "no-change" : "cache-unavailable", sourceId };
      }
      console.info("official-source sync:", JSON.stringify({ sourceId, result: "cache-unavailable", durationMs: Date.now() - started, warnings: warnings.length }));
      return { result: "cache-unavailable", sourceId };
    }
    console.info("official-source sync:", JSON.stringify({ sourceId, result: record?.contentHash === contentHash ? "no-change" : "updated", count: sourceId === "welcomeEvents" ? candidate.events.length : candidate.sections.length, durationMs: Date.now() - started, warnings: warnings.length }));
    return { result: record?.contentHash === contentHash ? "no-change" : warnings.length ? "needs-review" : "updated", sourceId };
  }

  async function getOne(sourceId) {
    if (!SOURCE_IDS.includes(sourceId)) return null;
    let state = await readState(sourceId);
    if (state.available && state.failure !== "corrupt" && !shouldHold(state, sourceId, false)) {
      await refreshOne(sourceId);
      state = await readState(sourceId);
    }
    return publicRecord(sourceId, state);
  }

  async function getPublicSources() {
    const results = await Promise.all(SOURCE_IDS.map(async (sourceId) => [sourceId, await getOne(sourceId)]));
    return Object.fromEntries(results);
  }

  async function getAdminStatus() {
    return Promise.all(SOURCE_IDS.map(async (sourceId) => {
      const publicData = await getOne(sourceId);
      const state = await readState(sourceId);
      const record = state.record;
      return {
        ...publicData,
        lastFailure: record?.lastFailure || (state.failure === "corrupt" ? "Stored source information needs review." : ""),
        pendingReview: record?.pendingReview
          ? { detectedAt: record.pendingReview.detectedAt, reason: record.pendingReview.reason, count: sourceId === "welcomeEvents" ? record.pendingReview.data.events.length : record.pendingReview.data.sections.length }
          : null,
        itemCount: record?.data ? sourceId === "welcomeEvents" ? record.data.events.length : record.data.sections.length : 0,
      };
    }));
  }

  async function refreshAll({ force = true } = {}) {
    return Promise.all(SOURCE_IDS.map((sourceId) => refreshOne(sourceId, { force })));
  }

  async function acceptPending(sourceId) {
    if (!SOURCE_IDS.includes(sourceId)) throw new Error("Unknown official source.");
    const state = await readState(sourceId);
    if (!state.available || !state.record?.pendingReview)
      throw new Error("There is no verified update awaiting review.");
    const previous = state.record;
    const pending = previous.pendingReview;
    const warnings = sourceId === "welcomeEvents"
      ? [...new Set(pending.data.events.flatMap((event) => event.warnings))]
      : [];
    const next = {
      ...previous,
      fetchedAt: pending.data.fetchedAt,
      lastSuccessfulCheck: pending.detectedAt,
      lastChangedAt: previous.contentHash === pending.contentHash ? previous.lastChangedAt : pending.detectedAt,
      lastAttemptAt: pending.detectedAt,
      contentHash: pending.contentHash,
      status: warnings.length ? "needs-review" : "current",
      warnings,
      lastFailure: "",
      data: pending.data,
    };
    delete next.pendingReview;
    await writeRecord(sourceId, next, state.etag);
    return { result: warnings.length ? "needs-review" : "updated", sourceId };
  }

  return { getOne, getPublicSources, getAdminStatus, refreshOne, refreshAll, acceptPending, readState };
}
