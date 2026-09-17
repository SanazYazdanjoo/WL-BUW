import { Buffer } from "node:buffer";
import { OFFICIAL_HOST, approvedSourceUrl, officialSourceConfig } from "./config.js";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

export async function fetchOfficialSource(sourceId, fetchImpl = fetch) {
  const source = officialSourceConfig.sources[sourceId];
  if (!source || !source.enabled || !officialSourceConfig.enabled)
    throw Object.assign(new Error("Source is disabled."), { sourceFailure: "fetch-failed" });
  let target = approvedSourceUrl(source.url);
  if (!target) throw Object.assign(new Error("Configured source URL is not approved."), { sourceFailure: "fetch-failed" });
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const url = new URL(target);
    if (url.hostname !== OFFICIAL_HOST || url.protocol !== "https:")
      throw Object.assign(new Error("Official source redirect was not approved."), { sourceFailure: "fetch-failed" });
    let response;
    try {
      response = await fetchImpl(target, {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "text/html",
          "User-Agent": "Welcome Lounge source checker (Bauhaus-Universitaet Weimar)",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw Object.assign(new Error("The official source could not be reached."), { sourceFailure: "fetch-failed" });
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirectCount === MAX_REDIRECTS)
        throw Object.assign(new Error("The official source redirect could not be verified."), { sourceFailure: "fetch-failed" });
      const redirectUrl = new URL(location, target).href;
      if (!approvedSourceUrl(redirectUrl))
        throw Object.assign(new Error("The official source redirected outside the approved university host."), { sourceFailure: "fetch-failed" });
      target = redirectUrl;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error("The official source returned an unavailable response."), { sourceFailure: "fetch-failed" });
    }
    const contentType = response.headers.get("content-type") || "";
    if (!/^text\/html(?:\s*;|$)/i.test(contentType)) {
      await response.body?.cancel();
      throw Object.assign(new Error("The official source did not return a web page."), { sourceFailure: "fetch-failed" });
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_BYTES) {
      await response.body?.cancel();
      throw Object.assign(new Error("The official source page was too large."), { sourceFailure: "fetch-failed" });
    }
    try {
      const chunks = [];
      let bytes = 0;
      if (!response.body) throw new Error("missing body");
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > MAX_BYTES) {
          await response.body.cancel();
          throw new Error("oversized body");
        }
        chunks.push(Buffer.from(chunk));
      }
      const charset = contentType.match(/charset\s*=\s*["']?([^;"']+)/i)?.[1]?.trim() || "utf-8";
      if (!/^(utf-8|utf8|windows-1252|iso-8859-1|us-ascii)$/i.test(charset))
        throw new Error("unsupported encoding");
      const decoder = new TextDecoder(charset, { fatal: true });
      return decoder.decode(Buffer.concat(chunks)).replace(/^\uFEFF/, "");
    } catch {
      await response.body?.cancel().catch(() => {});
      throw Object.assign(new Error("The official source page could not be read safely."), { sourceFailure: "fetch-failed" });
    }
  }
  throw Object.assign(new Error("The official source redirect could not be verified."), { sourceFailure: "fetch-failed" });
}
