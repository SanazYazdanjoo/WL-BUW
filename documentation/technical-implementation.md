# Technical implementation

## Architecture

Deployment uses the existing GitHub-connected Vercel project: commit/push triggers the existing automatic deployment. No additional CI or replacement project is needed. See [live deployment verification](deployment-verification.md) for the protection barrier and the distinction between local tests and hosted acceptance.

React + Vite + React Router remains the frontend. Browser navigation and information architecture do not mirror Nextcloud folders. Plain structured content is fetched from the same-origin API; progress uses a separate browser-only store. No database or student identity is used.

`server/api.js` composes the content and document middleware. Vite development/preview, `server/start.js`, and the Vercel catch-all `api/[...path].js` invoke this same implementation. Credentials and the configured root never enter the frontend dependency graph. The university Nextcloud origin remains fixed to avoid introducing a configurable proxy/SSRF surface.

## Source map

| Module | Responsibility |
| --- | --- |
| `src/App.jsx` | Product routes and not-found route |
| `src/components/Layout.jsx` | Navigation, loading/fallback state, route focus, shared outlet context |
| `src/pages/StudentPages.jsx` | Journey, topic, events, later-stage, info, help and feedback pages |
| `src/components/Journey.jsx` | Reusable progress, full-row step links, actions, downloads, escalation and feedback UI |
| `src/components/AppHeader.jsx` | Red-square brand and responsive navigation with keyboard-operable mobile menu |
| `src/components/FAQAccordion.jsx` | Native button disclosures with aria-expanded/aria-controls and per-item state |
| `src/services/topics.js` | Stable active-topic lookup, including not-found behavior |
| `src/hooks/useContent.js` | Parallel content reads, timeout, cancellation, response validation, safe samples |
| `src/hooks/useProgress.js`, `src/services/progress.js` | Versioned local storage, toggle/reset, cross-tab updates, storage-failure handling |
| `shared/content.js`, `shared/paths.js` | Content/link/path validation used by server and frontend |
| `content/app-content` | Explicit sample data and staff-maintenance templates |
| `server/content.js` | Fixed content paths, bounded JSON read, validation/fallback |
| `server/nextcloud.js` | Configurable DAV root, protected downloads, retained XML parser |
| `server/operations.js` | Server-only staff authorization and operational repository wiring |
| `src/services/feedback.js` | Unavailable adapter; reports `saved: false`; no transmission/storage |

The old directory pages/hook and unused directory widgets/styles were removed. The tested XML parser and fast-xml-parser dependency remain reusable; there is no public PROPFIND route.

## Routes

`/` and `/journey` show the data-driven journey. `/journey/:topicId` opens a focused topic independently. `/events` shows verified upcoming official programme entries and omits demo events. `/info` indexes university portals, health-insurance contacts, Rundfunkbeitrag and later-stage information, linking to existing routes. `/help` distinguishes common information from the configured human-support route; `/feedback` remains explicitly non-persistent. `/staff` routes use the protected pilot session and private server APIs when enabled; they are not unavailable placeholders. Unknown routes and topic IDs show not-found UI. SPA unknown routes return HTML 200 with not-found UI, not an HTTP 404.

## API

- `GET /api/content` returns the validated atomic bundle (config, onboarding, events, after-arrival, health-insurance, useful-links, rundfunk, and official-source summaries).
- `GET /api/content/:kind` retains per-collection reads for compatibility, including the same content collections.

Each returns `{source: "nextcloud" | "demo", data: ...}` with `no-store`. Only the corresponding fixed `app-content/<kind>.json` path is requested. Upstream reads use a 10-second timeout and a streamed 512,000-byte cap before parsing. Missing credentials, upstream denial, invalid/missing JSON or a timeout return validated sample data with `source: demo`. The client has a 15-second timeout and its own bundled sample fallback for an unavailable API. Config fallback always disables WhatsApp. There is no cache of previous WhatsApp invitations. Content is loaded once per page load, or on retry.

`GET /api/nextcloud/download?path=documents/enrollment/form.pdf` streams an attachment. The path must be within `documents/` and exactly referenced by an active, non-demo topic in current validated Nextcloud onboarding or after-arrival content. The server reads both content collections in parallel on each download request; it does not cache authorization. Missing/malformed/demo fallback content cannot grant access. Unreferenced documents are rejected before fetching their bytes. No folder listing is available (`/api/nextcloud/files` returns 404). Paths reject dot segments, backslashes, percent-encoded ambiguity, controls and hidden path segments; root configuration is separately validated. Upstream redirects are disabled. Bytes are never rendered inline: octet-stream, attachment disposition, nosniff, no-store. Document reads time out after 40 seconds, following up to 10 seconds for content authorization; Vercel function duration is 60 seconds. The client buffers a blob for an error-aware download; publish reasonably small PDFs suitable for phones. Platform file-size/streaming limits still need live verification.

Errors: 400 invalid path, 404 missing/disallowed file or endpoint, 405 unsupported method, 503 unconfigured document connection, 502 upstream/network failure. Raw upstream bodies and credentials are never returned. Safe server diagnostics identify failed content kinds; no student data is logged by application code. Hosting/upstream infrastructure may keep request logs.

## Progress and privacy

`wl-progress` stores `{version: 1, completed: [topicId]}`. Corrupt/missing/unknown versions reset safely; valid IDs are deduplicated. Unknown versions are intentionally not interpreted; future schema changes require a migration here. Browser storage failure retains in-memory progress with an explicit warning. No progress leaves the browser. IDs persist across semesters unless a student resets them. No sensitive staff/student records belong in local storage.

## Security boundary and future work

The download boundary combines subtree confinement and current per-file topic references. The low-level download middleware defaults to deny unless an approval function is supplied; the shared API supplies the content-based authorizer. Published content and referenced documents are public; operational data and official-source caches are private. The staff pilot uses server-side shared-code roles, CSRF checks, private Nextcloud state, and server-stamped actor/session IDs and timestamps. Tutor names are self-declared and do not verify real identity; shared-code authentication is pilot-only. Keep personal data out of public content. Institutional retention and long-term identity decisions remain open.

## Student experience and visual structure

The student UI uses Fira Sans and the official BUW palette: white, black, neutral grey and magenta `#b71a49`. Journey is a semantic ordered list arranged as a responsive serpentine map with an aria-hidden measured SVG connector. Topic pages are linear and concise; FAQ and content data remain available in the schema even where the minimal topic presentation does not render them. `/info` and `/help` are short pathways to existing content and human support. Mobile navigation exposes expanded state, supports Escape and restores focus. FAQ controls use native buttons and labelled panels where shown.

The topic schema adds an optional `eyebrow` without breaking existing version-1 files. Sample summaries are neutral UX text and remain explicitly marked as demo. Stable IDs and existing progress storage are retained. The progress hook exposes explicit markComplete, markIncomplete, isComplete and totalCompleted alongside toggle/reset; displayed counts are scoped to the current active journey topics.

Vercel security headers include CSP, nosniff and referrer policy. Local Vite development allows its normal development tooling. Institutional production review, live Nextcloud/Vercel verification, accessible testing with students, and approved contact/privacy details remain required.

## Workbook/staff implementation update — 2026-09-17

New server modules: `server/excel/` (bounded ExcelJS parsers/export), `server/staff/auth.js` (pilot session/role/CSRF), `store.js` (private confined WebDAV conditional writes), `repository.js` (imports, publication, operational records), `api.js` (protected routes). `server/api.js` composes this with existing public content/download handlers. Vite loads only server configuration prefixes into middleware; no staff/Nextcloud secrets are injected into client code.

Public content adds health-insurance, useful-links and rundfunk collections and routes. Required workbook items are shown separately from downloads. `loadContent` first checks the atomic release, falls back to legacy JSON only when absent, and serves labelled samples on invalid/unavailable content. The document allowlist uses that same validated content. ExcelJS is absent from the frontend bundle.

The student client requests `/api/content` once for all seven collections to reduce mobile round trips. The server validates a complete atomic release in one Nextcloud read. Before the first release, it fetches legacy collections concurrently and marks missing/invalid ones as samples. Individual content routes remain for compatibility and download authorization.

The existing root API catch-all is preserved for local compatibility. Vercel's deployed route check showed that it did not receive multi-segment URLs in this project. `vercel.json` rewrites nested content, Nextcloud and staff endpoints to the existing single-segment API function and passes a bounded route marker. `server/vercel-handler.js` restores the original path before forwarding into the shared `server/api.js` middleware. This keeps path validation and authorization in one implementation.

`src/staff/` isolates staff routes, services, workspace and coordinator pages from student pages. Sessions/CSRF stay in memory/cookies; operational records are never written to localStorage. Dashboard check-ins link to students and show actor/time. Student details show changed-field labels and check-in history; handover notes are grouped by day with author/time. Coordinator Semester setup summarizes publication, WhatsApp, MasterExcel, shifts, official sources and semester-label mismatches, then links to existing preview, import, refresh and export flows. It never auto-corrects mismatched values. Browser progress retains the legacy key for existing content and uses a publication revision suffix for resets. Native print styles consume the same normalized published collections.

See the workbook, MasterExcel and staff-operation guides for schemas, limits, workflows and known pilot limitations. These sections supersede the earlier unimplemented staff architecture description.

## Official BUW sources

`server/officialSources/` separates validated source configuration, bounded server fetches, Cheerio parsing, normalized-data validation, Nextcloud cache service and HTTP routes. Only fixed `www.uni-weimar.de` HTTPS URLs in `content/app-content/sources.json` can be fetched. Source URLs, per-source refresh/stale/retry limits, plausibility limits and topic section mappings live there. `server/api.js` composes the routes with the current API; Vercel rewrites preserve the existing catch-all, and local Node/Vite paths use the same service.

Public content responses expose only normalized source records. `src/hooks/useContent.js` provides canonical source-link fallback when an API record is absent. `OfficialSourceLink` renders official links and quiet freshness copy. The topic mapping chooses a discovered official subpage when available and otherwise uses the canonical Preparing your studies URL. The Events page shows validated upcoming events, omits unverified dates, and always links the official programme. Local sample events are omitted from the student event list.

The cache service persists fixed server-owned JSON locations through the private staff WebDAV store. These paths are exactly allowlisted for that store but are not in the public document subtree or file-list API. ETag conditional writes protect concurrent updates. Normalized stable hashes distinguish unchanged checks from content changes. Count anomalies are held in `pendingReview`; individual contradictions carry warnings and uncertain date/time values remain empty. Source raw HTML is never stored or returned. See `official-source-sync.md` for operation and status semantics.
## Student journey map

The new JourneyMap component renders topic links in semantic source order, while the journey layout utility assigns responsive serpentine grid positions for any number of active topics. A ResizeObserver measures each marker and the list height; a small aria-hidden SVG connects the measured marker centers. On narrow screens it uses a one-column zigzag and routes the connector around the text block. Completed topic IDs remain in the existing browser progress hook and update the node and path styles. The topic-detail route is unchanged and remains a linear task page.
