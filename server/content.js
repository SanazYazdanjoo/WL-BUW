import { Buffer } from "node:buffer";
import { davUrl } from "./nextcloud.js";
import { validateContent } from "../shared/content.js";
import config from "../content/app-content/config.json" with { type: "json" };
import onboarding from "../content/app-content/onboarding.json" with { type: "json" };
import events from "../content/app-content/events.json" with { type: "json" };
import afterArrival from "../content/app-content/after-arrival.json" with { type: "json" };
const samples = { config, onboarding, events, "after-arrival": afterArrival };
export async function loadContent(kind, env, fetchImpl = fetch) {
  if (!Object.hasOwn(samples, kind)) throw new Error("Unknown content");
  try {
    if (!env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD)
      throw new Error("unconfigured");
    const response = await fetchImpl(
      davUrl(
        env.NEXTCLOUD_USERNAME,
        `app-content/${kind}.json`,
        env.NEXTCLOUD_ROOT_FOLDER,
      ),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.NEXTCLOUD_USERNAME}:${env.NEXTCLOUD_APP_PASSWORD}`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("upstream");
    }
    // Bound bytes before parsing, including responses without Content-Length.
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 512000) throw new Error("oversize");
        chunks.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
    }
    return {
      source: "nextcloud",
      data: validateContent(
        kind,
        JSON.parse(
          Buffer.concat(chunks)
            .toString("utf8")
            .replace(/^\uFEFF/, ""),
        ),
      ),
    };
  } catch {
    console.warn(
      `Content unavailable or invalid: ${kind}; serving labelled sample content.`,
    );
    return { source: "demo", data: validateContent(kind, samples[kind]) };
  }
}
export function contentMiddleware(env, fetchImpl = fetch) {
  return async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
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
