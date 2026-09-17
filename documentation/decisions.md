# Development decisions

Recorded on 2026-09-17.

## D01: Replace Google Sheets with Nextcloud

The user requested removal of the Sheets integration and supplied the university Nextcloud folder. The previous hook fetched `Directory_Index` and `All_Content` via the Sheets REST API using `VITE_SPREADSHEET_ID` and `VITE_GOOGLE_SHEETS_API_KEY`. There was no Google-specific npm package.

Removed that hook, API call and environment references. The content model now uses files and folders instead of FAQ rows and typed text blocks. Existing spreadsheet content is not copied or migrated.

## D02: Support arbitrary formats through file access

The user requested all formats. The implementation lists, searches by filename and downloads arbitrary files without extension filtering or conversion. Original bytes are preserved. Open in Nextcloud delegates viewing/editing to that installation and its apps.

This is not universal document extraction, OCR, full-text indexing, spreadsheet interpretation or an embedded viewer. The interpretation and limits were explained during implementation.

## D03: Keep credentials on a Node backend

The supplied Files browser URL returned HTTP 401 anonymously. A Node middleware accesses the private folder through authenticated WebDAV using an account ID and app password. The frontend calls same-origin routes and never receives those credentials. Browser login cookies are not used by the backend.

This avoids browser cross-origin access to Nextcloud and exposing credentials in frontend JavaScript. Deployment now requires a backend; static frontend hosting alone is insufficient.

## D04: Restrict access to a fixed, read-only root

The upstream origin is fixed to `https://nextcloud.uni-weimar.de` and the root to `/Welcome.Lounge_WiSe2026_27/S.Y`. Clients supply relative paths only. Dot segments, backslashes and control characters are rejected, path segments are encoded, redirects are disabled, and listings exclude entries outside the requested folder's direct children.

The API accepts GET only; the upstream requests are PROPFIND for listings and GET for downloads. Uploads, deletes, renames and editing are not implemented. Changing the source folder currently requires updating backend and frontend references together.

## D05: Shared credentials do not provide visitor authentication

One configured account reads the root folder. There is no visitor login or per-user authorization. Anyone who can reach the API can read accessible files under the configured root. The standalone server binds to localhost by default. External deployment requires appropriate access control in front of the app.

Open Nextcloud links use the visitor's separate Nextcloud browser session, which does not configure the server connection.

## D06: Stream arbitrary files as downloads

Downloads use Node streams with attachment disposition, octet-stream content type, nosniff and no-store. This preserves binary data without buffering whole files or storing copies. It also prevents uploaded HTML/SVG from executing as inline content on the application origin. Range/resumable downloads are not implemented.

## D07: Retain the React/Vite foundation

Kept React, React Router, Vite, Tailwind tooling and the existing visual language. Added fast-xml-parser for WebDAV XML. XML is validated, DOCTYPE is rejected and entity processing is disabled.

The same middleware runs in development, preview and the standalone server. The existing `/topic/:topicId` route shape remains, but now identifies a filename in the selected folder. Previous spreadsheet topic IDs are not migrated.

## D08: Load one folder at a time

PROPFIND uses Depth 1. Navigation or refresh loads current contents. Search filters filenames in the current folder; folders appear first, followed by name sorting. There is no recursive crawl, database, background sync, live subscription or server content cache.

The React hook aborts obsolete requests and hides results belonging to a previous path while the next folder loads.

## D09: Expose controlled failures and verification limits

Missing credentials, invalid paths, unsupported methods, missing resources, upstream denial and network failures have explicit error responses. Credentials and raw upstream error bodies are not exposed. Listings time out after 20 seconds; downloads after five minutes.

Mocked tests and local browser checks verify implementation behavior. They do not establish live access to the private university folder; authenticated verification remains pending.

## D10: Student companion supersedes file-browser UX (2026-09-17)

The operational pilot retains React/Vite (no Next.js migration). D01's file-only content model, D02's directory UX, D04's hardcoded root, D05's broad public access, and D08's public folder navigation are superseded. Students use journey/topic/event routes; Nextcloud is storage and editorial content. The existing XML parser and security tests remain, but public listings are disabled. Historical entries above describe the previous implementation only.

## D11: Portable root and explicit public publication area

`NEXTCLOUD_ROOT_FOLDER` is the single server-side root setting, defaulting to the current S.Y location. Origin stays university-only. Four fixed JSON paths and the `documents/` subtree are public; other root files cannot be requested. All documents in that subtree are public, even without a topic link. This is intentionally simpler than maintaining per-file ACLs. Staff must review the subtree before launch. No remote files were moved/deleted/created. Validation, disabled redirects and forced download headers remain; encoded ambiguity and hidden document paths are also rejected.

## D12: Shared API on local Node and Vercel

The same middleware backs Vite dev/preview, standalone Node and a Vercel catch-all function. No duplicated WebDAV implementation, external database or client secret variables. Rewrites preserve API/assets and support SPA deep links. Vercel deployment/live Nextcloud validation are pending operational checks, not claimed outcomes.

## D13: Reviewed structured content, safe samples

JSON is a deliberately simple interim maintenance format. Staff edit content independently of React and without rebuilds; a visual editor remains planned. Versioned validation bounds text/lists/bytes and discards unknown fields. Invalid or unavailable content falls back to explicit samples; no authoritative university instructions were invented. A failed config disables WhatsApp; previous invites are not cached. Staff must publish a current label and invitation together. Content already loaded in a browser changes on reload.

## D14: Anonymous progress and honest incomplete features

Progress stores only version and completed topic IDs locally, with reset/corruption/storage-failure handling. No student accounts/profiles or server progress. Persistent feedback, staff auth and operational records are deferred pending institutional decisions. The feedback adapter explicitly returns not-saved, and staff routes are unavailable notices. An unwired authorization/repository interface provides a future server-only boundary; it is not a production authentication system. No vendor or ephemeral-filesystem database was introduced.

## D15: Clear mobile journey with contextual help

Seven freely accessible topics use connected circular nodes and restrained Bauhaus colors. Long text stays in readable cards. Semantic controls, native FAQ details, progress labels, keyboard focus and mobile layouts take priority over decoration. Events and later-stage topics are distinct from first-week completion. Demo events are isolated from real upcoming events. Content and contact accuracy remain dependent on International Office review.

## D16: Preserve the existing GitHub-to-Vercel integration

The user clarified that automatic Git deployments already work for an existing Vercel project. Releases remain commit/push followed by that integration's deployment. Initial import instructions are superseded; no new project, relinking or separate CI is needed. Local inspection found no pre-existing tracked Vercel configuration; the current P0 additions provide the shared function entry point and frontend rewrite.

The supplied deployment redirects anonymous requests to Vercel authentication. Protection is preserved. Any change to project-level access must be explicitly identified and approved before changing it. Local handler tests, sentinel-secret build checks and a read-only readiness script improve verification but cannot establish hosted functionality behind the access barrier. Vercel support remains locally verified and live acceptance pending.

## D17: Reference-led editorial journey and per-file publication

The user supplied a primary visual reference and refined the document-access requirement. Open cream-background rows, outlined circular nodes, a dashed connector, restrained red actions and a proper red-square brand replace the earlier bordered-card/multicolour approach. Screenshot administrative claims and timing labels are not copied into content; neutral contextual labels remain demo text. Existing React/Vite, semantic routes, JSON adapters and browser progress are reused.

The prior D11 subtree-only publication policy is superseded: a document also requires an exact reference in an active non-demo topic in validated Nextcloud onboarding or after-arrival content. The server checks fresh references for every request and denies fallback-only, removed, inactive or unreferenced files. This avoids publishing arbitrary documents simply because they are placed in the same directory. Shared WebDAV streaming/path protections remain intact; no remote files are changed.

Native-button FAQ controls expose expanded state explicitly. The existing progress key/schema and topic IDs remain stable rather than resetting previous users' progress for a cosmetic rename. No new authentication, storage vendor, reporting or admin features were added in this slice.

## 2026-09-17 — Workbook publication and private pilot operations (supersedes staff placeholder)

Keep React/Vite and the existing Vercel integration. ExcelJS runs server-side only, with bounded ZIP/workbook parsing and synthetic fixtures. A single `app-content/published.json` release avoids multi-file partial publication; existing JSON collections remain backward compatible until first publication. Preview proofs bind the source, reviewed content and session, expire after 15 minutes, and require explicit confirmation. Publication backs up prior content before a conditional PUT.

Private operational records use one bounded `staff-data/state.json` aggregate with ETag conflict detection. This intentionally chooses simple atomic updates over multi-file transactions or an external database. MasterExcel remains import/export only. Backup/retention is manual; no automatic deletion. This supersedes earlier statements that no staff persistence exists.

Pilot authentication uses server-only random shared tutor/admin codes and signed eight-hour cookies, disabled by default. Names are self-declared, not verified identities. Roles and CSRF are server-enforced. Permanent institutional authentication is still required for long-term handover. No student authentication is added.

Workbook step IDs are numbered and stable within a semester; a publication progress revision isolates browser completion when the coordinator resets/reuses steps. Normal text-only publication can retain the revision. Required items remain separate from approved downloadable documents. The exact real workbook formats require validation before first publication.

ExcelJS's UUID transitive dependency is overridden to 11.1.1 to avoid the audited vulnerable version. The v4 call used by ExcelJS is compatible; workbook read/write tests pass.

## D18: Arrival companion visual hierarchy (2026-09-17)

Keep the student experience calm and editorial, but make the next useful action visible immediately. The home derives progress and the next active incomplete topic from existing browser progress and validated topic content. It may show one event only when active content confirms it is upcoming; demo entries are excluded. A completed journey points to existing events, explore and help routes. “At a glance” only summarizes supported item, document and action counts. Existing routes, schemas, progress key/revision, public document authorization, WhatsApp configuration and staff/product boundaries remain unchanged. Bauhaus geometry has limited meaning (circle for journey, square for documents, triangle for help); CSS transitions honor reduced-motion preferences. No points, streaks, identity, analytics, new dependencies or external services are introduced.

## D19: Use the official BUW digital identity (2026-09-17)

The earlier cream-based “Bauhaus-inspired” palette is superseded for the student-facing web application. Use Fira Sans for digital UI (self-hosted from the SIL OFL Fontsource package at 400–700 weights) and the official BUW digital colours as centralized tokens. White, black and neutral grey dominate; BUW magenta `#b71a49` is the main link/action colour, with other house colours reserved for limited contextual meaning. Keep the product navigation compact, the footer black and the topic path open/editorial. Do not add the licensed print typeface, arbitrary photography, all-colour decoration, large rounded cards or the full university utility navigation. Preserve mobile-first student behavior, React/Vite, staff layout, routes, content, security and browser progress.
