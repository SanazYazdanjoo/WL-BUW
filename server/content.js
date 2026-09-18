import healthInsurance from "../content/app-content/health-insurance.json" with { type: "json" };
import usefulLinks from "../content/app-content/useful-links.json" with { type: "json" };
import rundfunk from "../content/app-content/rundfunk.json" with { type: "json" };
import community from "../content/app-content/community.json" with { type: "json" };
import supportResources from "../content/app-content/support-resources.json" with { type: "json" };
import communityResources from "../content/app-content/community-resources.json" with { type: "json" };
import officialLinks from "../content/app-content/official-links.json" with { type: "json" };
import { Buffer } from "node:buffer";
import { davUrl } from "./nextcloud.js";
import { validateContent } from "../shared/content.js";
import config from "../content/app-content/config.json" with { type: "json" };
import onboarding from "../content/app-content/onboarding.json" with { type: "json" };
import events from "../content/app-content/events.json" with { type: "json" };
import afterArrival from "../content/app-content/after-arrival.json" with { type: "json" };
import { createPrivateStore } from "./staff/store.js";
import { parseUnifiedWorkbook, publicContentFromWorkbook } from "./excel/unifiedWorkbook.js";
const samples = {
  config,
  onboarding,
  events,
  "after-arrival": afterArrival,
  "health-insurance": healthInsurance,
  "useful-links": usefulLinks,
  rundfunk,
  community,
  "support-resources": supportResources,
  "community-resources": communityResources,
  "official-links": officialLinks,
};
const optionalWorkbookKinds = new Set(["support-resources", "community-resources", "official-links"]);
const unifiedCache = new Map();
const legacyOnlyKinds = new Set(["events", "community", "official-links"]);
function cacheKey(env) {
  return `${env.NEXTCLOUD_BASE_URL || ""}|${env.NEXTCLOUD_ROOT_FOLDER || ""}|${env.NEXTCLOUD_WORKBOOK_FILE || "Welcome-Lounge.xlsx"}`;
}
function unifiedWorkbookEnabled(env) {
  // The target filename is the safe default. An explicit empty value lets
  // tests and emergency rollbacks retain the legacy release reader.
  return env.NEXTCLOUD_WORKBOOK_FILE !== "";
}
async function readUnifiedContent(env, fetchImpl) {
  const key = cacheKey(env);
  const previous = unifiedCache.get(key);
  try {
    const store = createPrivateStore(env, fetchImpl);
    const file = await store.read(store.paths.unified, 10 * 1024 * 1024, previous?.etag || "");
    if (file.notModified && previous) return { content: previous.content, status: previous.status };
    if (!file.value) {
      if (previous) return { content: previous.content, status: { ...previous.status, stale: true, state: "stale" } };
      return { missing: true, content: null, status: { etag: "", lastModified: "", stale: false, state: "missing" } };
    }
    const parsed = await parseUnifiedWorkbook(file.value);
    const content = publicContentFromWorkbook(parsed, { config });
    const status = { etag: file.etag || "", lastModified: file.lastModified || "", stale: false, state: "current" };
    unifiedCache.set(key, { etag: status.etag, content, status });
    return { content, status };
  } catch {
    if (previous) return { content: previous.content, status: { ...previous.status, stale: true, state: "stale" } };
    return { unavailable: true, content: null, status: { etag: "", lastModified: "", stale: false, state: "invalid" } };
  }
}
async function legacyExtras(env, fetchImpl) {
  try {
    const release = await readPublicJson("app-content/published.json", env, fetchImpl, 4 * 1024 * 1024);
    const extra = release?.version === 1 && release.content
      ? Object.fromEntries([...legacyOnlyKinds].map((kind) => [kind, release.content[kind]]).filter(([, value]) => value))
      : {};
    try {
      const automaticCommunity = await readPublicJson("app-content/community.json", env, fetchImpl, 512000);
      if (automaticCommunity) extra.community = automaticCommunity;
    } catch { /* The bundled automatic-feed configuration remains available. */ }
    return extra;
  } catch {
    return {};
  }
}
export async function loadContentBundle(env, fetchImpl = fetch) {
  const data = {},
    sources = {};
  if (!env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD) {
    for (const [kind, sample] of Object.entries(samples)) {
      sources[kind] = "demo";
      data[kind] = validateContent(kind, sample);
    }
    return { sources, data };
  }
  const unified = unifiedWorkbookEnabled(env) ? await readUnifiedContent(env, fetchImpl) : null;
  if (unified?.unavailable) {
    return { sources: Object.fromEntries(Object.keys(samples).map((kind) => [kind, "demo"])), data: Object.fromEntries(Object.entries(samples).map(([kind, sample]) => [kind, validateContent(kind, sample)])), workbook: { status: unified.status.state, lastModified: "" } };
  }
  if (unified) {
    const extras = await legacyExtras(env, fetchImpl);
    const data = {};
    for (const [kind, sample] of Object.entries(samples)) {
      const value = unified.content[kind] || extras[kind] || sample;
      try { data[kind] = validateContent(kind, value); }
      catch { data[kind] = validateContent(kind, sample); }
    }
    data["after-arrival"] = validateContent("after-arrival", { version: 1, topics: [] });
    data["health-insurance"] = validateContent("health-insurance", { version: 1, providers: [] });
    data.rundfunk = validateContent("rundfunk", { version: 1, title: "Rundfunkbeitrag", sections: [] });
    return {
      sources: Object.fromEntries(Object.keys(samples).map((kind) => [kind, unified.status.stale ? "stale" : unified.content[kind] || extras[kind] ? "nextcloud" : "demo"])),
      data,
      workbook: { status: unified.status.stale ? "stale" : "current", lastModified: unified.status.lastModified },
    };
  }
  try {
    const release = await readPublicJson(
      "app-content/published.json",
      env,
      fetchImpl,
      4 * 1024 * 1024,
    );
    if (release && (release.version !== 1 || !release.content))
      throw new Error("invalid release");
    if (release) {
      for (const kind of Object.keys(samples)) {
        let value = release.content[kind];
        const missingOptionalKind = value === undefined && optionalWorkbookKinds.has(kind);
        if (missingOptionalKind) value = samples[kind];
        if (kind === "community" && !value) {
          try { value = await readPublicJson("app-content/community.json", env, fetchImpl); } catch { value = null; }
        }
        if (kind === "community" && !value) {
          data[kind] = validateContent(kind, samples[kind]);
          sources[kind] = "demo";
        } else {
          data[kind] = validateContent(kind, value);
          sources[kind] = missingOptionalKind ? "demo" : "nextcloud";
        }
      }
      return { sources, data };
    }
    await Promise.all(
      Object.entries(samples).map(async ([kind, sample]) => {
        try {
          const value = await readPublicJson(
            `app-content/${kind}.json`,
            env,
            fetchImpl,
          );
          if (!value) throw new Error("missing legacy content");
          data[kind] = validateContent(kind, value);
          sources[kind] = "nextcloud";
        } catch {
          data[kind] = validateContent(kind, sample);
          sources[kind] = "demo";
        }
      }),
    );
    return { sources, data };
  } catch {
    console.warn(
      "Published content unavailable or invalid; serving labelled samples.",
    );
    for (const [kind, sample] of Object.entries(samples)) {
      sources[kind] = "demo";
      data[kind] = validateContent(kind, sample);
    }
    return { sources, data };
  }
}
async function readPublicJson(path, env, fetchImpl, limit = 512000) {
  const response = await fetchImpl(
    davUrl(env.NEXTCLOUD_USERNAME, path, env.NEXTCLOUD_ROOT_FOLDER, env.NEXTCLOUD_BASE_URL),
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.NEXTCLOUD_USERNAME}:${env.NEXTCLOUD_APP_PASSWORD}`).toString("base64")}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("upstream");
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error("oversize");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(
    Buffer.concat(chunks)
      .toString("utf8")
      .replace(/^\uFEFF/, ""),
  );
}
export async function loadContent(kind, env, fetchImpl = fetch) {
  if (!Object.hasOwn(samples, kind)) throw new Error("Unknown content");
  try {
    if (!env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD)
      throw new Error("unconfigured");
    const unified = unifiedWorkbookEnabled(env) ? await readUnifiedContent(env, fetchImpl) : null;
    if (unified?.unavailable) return { source: "demo", data: validateContent(kind, samples[kind]), workbook: { status: unified.status.state } };
    if (unified) {
      if (unified.content[kind]) return { source: unified.status.stale ? "stale" : "nextcloud", data: validateContent(kind, unified.content[kind]) };
      if (["after-arrival", "health-insurance", "rundfunk"].includes(kind)) {
        const empty = kind === "after-arrival" ? { version: 1, topics: [] } : kind === "health-insurance" ? { version: 1, providers: [] } : { version: 1, title: "Rundfunkbeitrag", sections: [] };
        return { source: "nextcloud", data: validateContent(kind, empty) };
      }
    }
    const release = await readPublicJson(
      "app-content/published.json",
      env,
      fetchImpl,
      8 * 1024 * 1024,
    );
    if (release && (release.version !== 1 || !release.content))
      throw new Error("invalid release");
    // Legacy JSON is read only when no release exists. Invalid releases fail closed.
    let value = release
      ? release.content[kind]
      : await readPublicJson(`app-content/${kind}.json`, env, fetchImpl);
    const missingOptionalKind = Boolean(release && value === undefined && optionalWorkbookKinds.has(kind));
    if (missingOptionalKind) value = samples[kind];
    if (release && kind === "community" && !value)
      value = await readPublicJson("app-content/community.json", env, fetchImpl);
    return { source: missingOptionalKind ? "demo" : "nextcloud", data: validateContent(kind, value) };
  } catch {
    console.warn(
      `Content unavailable or invalid: ${kind}; serving labelled sample content.`,
    );
    return { source: "demo", data: validateContent(kind, samples[kind]) };
  }
}
export function contentMiddleware(env, fetchImpl = fetch, loadOfficialSources = async () => ({}), loadCommunityFeed = async () => null) {
  return async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/content") {
      const status = req.method === "GET" ? 200 : 405;
      let body = status === 200
        ? await loadContentBundle(env, fetchImpl)
        : { error: "Content not available." };
      if (status === 200) {
        try {
          body.officialSources = await loadOfficialSources();
        } catch {
          body.officialSources = {};
        }
        try {
          const feed = await loadCommunityFeed(body.data?.community);
          if (feed) body.data.community.notices = feed.notices;
          body.communityFeed = feed?.status || "unavailable";
        } catch {
          body.communityFeed = "unavailable";
        }
      }
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
      return;
    }
    if (!url.pathname.startsWith("/api/content/")) return next();
    const kind = url.pathname.slice("/api/content/".length);
    const status =
      req.method !== "GET" ? 405 : !Object.hasOwn(samples, kind) ? 404 : 200;
    const body =
      status === 200
        ? await loadContent(kind, env, fetchImpl)
        : { error: "Content not available." };
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(body));
  };
}
