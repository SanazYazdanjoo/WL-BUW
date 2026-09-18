import { cleanPath, isPublicDocument } from "../shared/paths.js";
export { cleanPath, isPublicDocument } from "../shared/paths.js";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { XMLParser, XMLValidator } from "fast-xml-parser";

function configuredOrigin(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      throw new Error();
    return url.origin;
  } catch {
    throw new Error("Invalid Nextcloud base URL.");
  }
}
const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  processEntities: false,
});
const asArray = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];

export function davUrl(username, path = "", root, baseUrl) {
  if (!username || !cleanPath(root)) throw new Error("Invalid root.");
  const origin = configuredOrigin(baseUrl);
  const parts = [
    "remote.php",
    "dav",
    "files",
    username,
    ...cleanPath(root).split("/"),
    ...cleanPath(path).split("/").filter(Boolean),
  ];
  return `${origin}/${parts.map(encodeURIComponent).join("/")}`;
}

export function parseListing(xml, requestUrl, path) {
  if (XMLValidator.validate(xml) !== true || /<!DOCTYPE/i.test(xml))
    throw new Error("Invalid Nextcloud response.");
  const parsed = parser.parse(xml);
  if (!parsed.multistatus) throw new Error("Invalid Nextcloud response.");
  const origin = new URL(requestUrl).origin;
  const parent =
    decodeURIComponent(new URL(requestUrl).pathname).replace(/\/$/, "") + "/";
  return asArray(parsed.multistatus.response)
    .flatMap((item) => {
      const href = new URL(item.href, origin);
      const decoded = decodeURIComponent(href.pathname).replace(/\/$/, "");
      if (href.origin !== origin || !decoded.startsWith(parent)) return [];
      const name = decoded.slice(parent.length);
      if (!name || name.includes("/")) return [];
      cleanPath(name);
      const prop = asArray(item.propstat).find((value) =>
        /\s200\s/.test(value.status),
      )?.prop;
      if (!prop) return [];
      const isFolder =
        prop.resourcetype != null &&
        typeof prop.resourcetype === "object" &&
        "collection" in prop.resourcetype;
      return [
        {
          name,
          path: [path, name].filter(Boolean).join("/"),
          isFolder,
          mimeType: prop.getcontenttype || "",
          size: Number(prop.getcontentlength) || 0,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name),
    );
}

export function nextcloudMiddleware(
  env,
  fetchImpl = fetch,
  isApproved = async () => false,
) {
  return async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/nextcloud/")) return next();
    const json = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    if (
      !["/api/nextcloud/files", "/api/nextcloud/download"].includes(
        url.pathname,
      )
    )
      return json(404, { error: "Not found." });
    if (req.method !== "GET")
      return json(405, { error: "Only reading files is supported." });
    let path;
    try {
      path = url.searchParams.get("path") || "";
      cleanPath(path);
    } catch {
      return json(400, { error: "Invalid file path." });
    }
    const listing = url.pathname.endsWith("/files");
    // No public directory discovery. Only this explicitly public subtree is downloadable.
    if (listing || !isPublicDocument(path))
      return json(404, { error: "Document not available." });
    if (!env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD) {
      return json(503, { error: "Documents are temporarily unavailable." });
    }
    if (!env.NEXTCLOUD_BASE_URL || !env.NEXTCLOUD_ROOT_FOLDER)
      return json(503, { error: "Documents are temporarily unavailable." });
    try {
      // A safe subtree is necessary but insufficient: current published content
      // must explicitly reference this exact file. Fail closed if content is missing.
      if (!(await isApproved(path)))
        return json(404, { error: "Document not available." });
      const target = davUrl(
        env.NEXTCLOUD_USERNAME,
        path,
        env.NEXTCLOUD_ROOT_FOLDER,
        env.NEXTCLOUD_BASE_URL,
      );
      const response = await fetchImpl(target, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.NEXTCLOUD_USERNAME}:${env.NEXTCLOUD_APP_PASSWORD}`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(40000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const status = response.status === 404 ? 404 : 502;
        const error = [401, 403].includes(response.status)
          ? "Nextcloud denied access. Check the server credentials and folder permissions."
          : response.status === 404
            ? "This Nextcloud file or folder was not found."
            : "Nextcloud could not load the requested files.";
        return json(status, { error });
      }
      // Always download arbitrary files; HTML/SVG must not execute on the app's origin.
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.split("/").at(-1) || "download").replace(/'/g, "%27")}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      await pipeline(Readable.fromWeb(response.body), res);
    } catch {
      console.warn(
        "Nextcloud download failed (network, configuration or stream).",
      );
      if (!res.headersSent)
        json(502, {
          error:
            "Documents are temporarily unavailable. Please try again later.",
        });
      else res.destroy();
    }
  };
}
