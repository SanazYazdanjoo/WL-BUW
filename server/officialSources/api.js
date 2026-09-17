import { createHash, timingSafeEqual } from "node:crypto";
import { requireActor, sessionFromRequest, checkMutation, StaffError } from "../staff/auth.js";
import { SOURCE_IDS, officialSourceConfig } from "./config.js";
import { createOfficialSourcesService } from "./sourceCache.js";

const sourceRouteIds = {
  "preparing-studies": "preparingStudies",
  "welcome-events": "welcomeEvents",
};
const sameSecret = (provided, configured) =>
  typeof provided === "string" && configured.length >= 32 &&
  timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(configured).digest(),
  );

export function officialSourcesMiddleware(env, fetchImpl = fetch, service = createOfficialSourcesService({ env, fetchImpl })) {
  return async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    const send = (status, body, headers = {}) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      });
      res.end(JSON.stringify(body));
    };
    try {
      const publicMatch = path.match(/^\/api\/content\/official\/([a-z-]+)$/);
      if (publicMatch) {
        const sourceId = sourceRouteIds[publicMatch[1]];
        if (req.method !== "GET") return send(405, { error: "Content not available." });
        if (!sourceId) return send(404, { error: "Content not available." });
        return send(200, await service.getOne(sourceId), { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300" });
      }
      if (path === "/api/staff/sources" || path.startsWith("/api/staff/sources/")) {
        const actor = requireActor(sessionFromRequest(req, env), "admin");
        if (path === "/api/staff/sources" && req.method === "GET")
          return send(200, { sources: await service.getAdminStatus() });
        if (req.method !== "POST") throw new StaffError(404, "Staff action not found.");
        checkMutation(req, actor);
        if (path === "/api/staff/sources/sync")
          return send(200, { results: await service.refreshAll({ force: true }) });
        const accept = path.match(/^\/api\/staff\/sources\/([a-z-]+)\/accept$/);
        const sourceId = accept && sourceRouteIds[accept[1]];
        if (!sourceId) throw new StaffError(404, "Staff action not found.");
        return send(200, await service.acceptPending(sourceId));
      }
      if (path === "/api/internal/sync-official-sources") {
        if (
          req.method !== "POST" ||
          env.OFFICIAL_SOURCE_SYNC_ENABLED !== "true" ||
          !sameSecret(req.headers.authorization?.replace(/^Bearer\s+/i, ""), env.OFFICIAL_SOURCE_SYNC_SECRET || "")
        ) return send(404, { error: "Not found." });
        return send(200, { results: await service.refreshAll({ force: true }) });
      }
      if (path.startsWith("/api/staff/sources/") || path.startsWith("/api/content/official/"))
        return send(404, { error: "Not found." });
    } catch (error) {
      const status = error instanceof StaffError ? error.status : 500;
      return send(status, {
        error: error instanceof StaffError
          ? error.message
          : "Official information could not be updated. Previous verified information was kept.",
      });
    }
    return next();
  };
}

export const sourceRouteIdsForApi = Object.freeze({ ...sourceRouteIds });
export const configuredOfficialSourceIds = SOURCE_IDS;
export { officialSourceConfig };
