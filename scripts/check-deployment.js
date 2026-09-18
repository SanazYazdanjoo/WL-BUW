import process from "node:process";
import { isPublicDocument } from "../shared/paths.js";

// Read-only anonymous checks. Never create protection bypasses or print response bodies.
const [target, documentPath] = process.argv.slice(2);
let base;
try {
  base = new URL(target);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error();
  if (documentPath && !isPublicDocument(documentPath)) throw new Error();
} catch {
  console.error(
    "Usage: node scripts/check-deployment.js https://deployment.example [documents/topic/approved.pdf]",
  );
  process.exit(1);
}

let incomplete = false;
function report(name, passed, note) {
  if (!passed) incomplete = true;
  console.log(`${passed ? "PASS" : "PENDING/FAIL"} ${name}: ${note}`);
}
async function request(path) {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    signal: AbortSignal.timeout(55000),
  });
  const location = response.headers.get("location");
  if (location && new URL(location, base).hostname === "vercel.com") {
    await response.body?.cancel();
    throw new Error(
      "Deployment redirects to Vercel authentication; protection was not changed.",
    );
  }
  return response;
}
try {
  for (const path of [
    "/",
    "/journey/enrollment",
    "/events",
    "/info",
  ]) {
    const response = await request(path);
    const html = await response.text();
    report(
      `Frontend document ${path}`,
      response.ok && /id="root"/.test(html) && /\/assets\//.test(html),
      "SPA shell and built asset references (browser rendering requires a separate check)",
    );
  }
  for (const kind of ["config", "onboarding", "events", "after-arrival"]) {
    const response = await request(`/api/content/${kind}`);
    const json = response.headers
      .get("content-type")
      ?.includes("application/json");
    const data = json ? await response.json() : null;
    if (!json) await response.body?.cancel();
    report(
      `Live Nextcloud ${kind}`,
      response.ok && data?.source === "nextcloud",
      data?.source === "demo"
        ? "safe demo fallback; live Nextcloud is not verified"
        : `HTTP ${response.status}, source ${data?.source === "nextcloud" ? "nextcloud" : "unverified"}`,
    );
  }
  const listing = await request("/api/nextcloud/files");
  report(
    "Directory access disabled",
    listing.status === 404 &&
      listing.headers.get("content-type")?.includes("application/json"),
    `HTTP ${listing.status}`,
  );
  await listing.body?.cancel();
  if (documentPath) {
    const response = await request(
      `/api/nextcloud/download?path=${encodeURIComponent(documentPath)}`,
    );
    const safeHeaders =
      response.headers.get("content-disposition")?.startsWith("attachment;") &&
      response.headers.get("x-content-type-options") === "nosniff" &&
      response.headers.get("content-type") === "application/octet-stream";
    let bytes = 0;
    if (response.ok && safeHeaders) {
      for await (const chunk of response.body) bytes += chunk.length;
    } else await response.body?.cancel();
    report(
      "Document download",
      response.ok && safeHeaders && bytes > 0,
      `HTTP ${response.status}, ${bytes} bytes; compare with the original approved file separately`,
    );
  } else
    report(
      "Document download",
      false,
      "supply an approved documents/ path to verify",
    );
  console.log(
    "Separate required checks: browser navigation/rendering, client-secret audit, isolated missing-credential test, production build. This script does not certify full pilot readiness.",
  );
} catch (error) {
  report(
    "Deployment access",
    false,
    error.message.startsWith("Deployment redirects")
      ? error.message
      : "Request failed or response was invalid; no response body or credentials printed.",
  );
}
process.exitCode = incomplete ? 1 : 0;
