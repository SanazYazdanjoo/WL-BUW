import { davUrl } from "../nextcloud.js";
import { cleanPath } from "../../shared/paths.js";
import { StaffError } from "./auth.js";
export function staffPaths(env) {
  const dirs = {
    staff: env.STAFF_DATA_DIR || "staff-data",
    source: env.CONTENT_SOURCE_DIR || "content-source",
    backups: env.CONTENT_BACKUP_DIR || "content-backups",
  };
  for (const value of Object.values(dirs))
    if (
      cleanPath(value) !== value ||
      value.includes("/") ||
      ["documents", "app-content"].includes(value) ||
      value.startsWith(".")
    )
      throw new StaffError(503, "Staff folder configuration needs review.");
  if (new Set(Object.values(dirs)).size !== 3)
    throw new StaffError(503, "Staff folders must be separate.");
  const master = env.STAFF_MASTER_WORKBOOK || `${dirs.staff}/MasterExcel.xlsx`,
    editorial =
      env.CONTENT_SOURCE_WORKBOOK ||
      `${dirs.source}/Welcome Lounge First Steps and some other informations.xlsx`;
  if (
    cleanPath(master) !== master ||
    !master.startsWith(dirs.staff + "/") ||
    cleanPath(editorial) !== editorial ||
    !editorial.startsWith(dirs.source + "/")
  )
    throw new StaffError(503, "Workbook folder configuration needs review.");
  return {
    ...dirs,
    master,
    editorial,
    state: `${dirs.staff}/state.json`,
    release: "app-content/published.json",
  };
}
export function createPrivateStore(env, fetchImpl = fetch) {
  const paths = staffPaths(env);
  const permitted = (path) =>
    path === paths.master ||
    path === paths.editorial ||
    path === paths.state ||
    path === paths.release ||
    /^app-content\/(config|onboarding|events|after-arrival|useful-links|health-insurance|rundfunk)\.json$/.test(
      path,
    ) ||
    path.startsWith(paths.backups + "/") ||
    path.startsWith(paths.staff + "/backups/");
  const request = async (path, options = {}) => {
    if (cleanPath(path) !== path || !permitted(path))
      throw new StaffError(
        403,
        "This file is not available through staff actions.",
      );
    if (!env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD)
      throw new StaffError(503, "The university connection is not configured.");
    try {
      return await fetchImpl(
        davUrl(env.NEXTCLOUD_USERNAME, path, env.NEXTCLOUD_ROOT_FOLDER),
        {
          ...options,
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.NEXTCLOUD_USERNAME}:${env.NEXTCLOUD_APP_PASSWORD}`).toString("base64")}`,
            ...options.headers,
          },
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new StaffError(
        502,
        "The university file service is unavailable. Please retry.",
      );
    }
  };
  async function read(path, limit = 8 * 1024 * 1024) {
    const response = await request(path);
    if (response.status === 404) {
      await response.body?.cancel();
      return { value: null, etag: null };
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new StaffError(502, "The university file could not be read.");
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > limit)
        throw new StaffError(422, "The file exceeds the supported pilot size.");
      chunks.push(Buffer.from(chunk));
    }
    return { value: Buffer.concat(chunks), etag: response.headers.get("etag") };
  }
  async function readJson(path) {
    const r = await read(path);
    if (r.value === null) return r;
    try {
      return {
        ...r,
        value: JSON.parse(r.value.toString("utf8").replace(/^\uFEFF/, "")),
      };
    } catch {
      throw new StaffError(
        422,
        "Stored data is invalid. Ask the coordinator to restore a backup.",
      );
    }
  }
  async function ensureFolders(path) {
    if (!env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD)
      throw new StaffError(503, "The university connection is not configured.");
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const folder = parts.slice(0, i).join("/");
      let response;
      try {
        response = await fetchImpl(
          davUrl(env.NEXTCLOUD_USERNAME, folder, env.NEXTCLOUD_ROOT_FOLDER),
          {
            method: "MKCOL",
            headers: {
              Authorization: `Basic ${Buffer.from(`${env.NEXTCLOUD_USERNAME}:${env.NEXTCLOUD_APP_PASSWORD}`).toString("base64")}`,
            },
            redirect: "error",
            signal: AbortSignal.timeout(15000),
          },
        );
      } catch {
        throw new StaffError(
          502,
          "The university file service is unavailable. Please retry.",
        );
      }
      if (![201, 405].includes(response.status)) {
        await response.body?.cancel();
        throw new StaffError(
          502,
          "A required application folder could not be prepared.",
        );
      }
      await response.body?.cancel();
    }
  }
  async function writeJson(path, value, etag) {
    if (!permitted(path) || cleanPath(path) !== path)
      throw new StaffError(403, "Invalid write destination.");
    if (etag === undefined)
      throw new StaffError(409, "Reload the latest version before saving.");
    const body = JSON.stringify(value);
    if (Buffer.byteLength(body) > 8 * 1024 * 1024)
      throw new StaffError(
        422,
        "The pilot data limit has been reached. Export and ask the coordinator to archive it.",
      );
    await ensureFolders(path);
    const response = await request(path, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(etag === null ? { "If-None-Match": "*" } : { "If-Match": etag }),
      },
      body,
    });
    await response.body?.cancel();
    if ([409, 412].includes(response.status))
      throw new StaffError(
        409,
        "This record was changed by another tutor. Reload the latest version before saving.",
      );
    if (!response.ok)
      throw new StaffError(502, "The university file could not be saved.");
    return response.headers.get("etag");
  }
  return { paths, read, readJson, writeJson };
}
