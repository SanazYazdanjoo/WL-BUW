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
| `src/pages/StudentPages.jsx` | Journey, topic, events, later-stage, help, feedback, staff-unavailable pages |
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
| `server/operations.js` | Unwired server-only authorization/repository boundary for future staff records |
| `src/services/feedback.js` | Unavailable adapter; reports `saved: false`; no transmission/storage |

The old directory pages/hook and unused directory widgets/styles were removed. The tested XML parser and fast-xml-parser dependency remain reusable; there is no public PROPFIND route.

## Routes

`/` and `/journey` show the seven-step sample journey. `/journey/:topicId` opens any topic independently. `/events` shows upcoming real entries separately from demo entries. `/after-arrival` and `/after-arrival/:topicId` hold later-stage information. `/help`, `/feedback`, `/staff`, `/staff/dashboard` complete the shell. Unknown routes and topic IDs show not-found UI. Staff routes only show an unavailable notice; they do not protect or fetch any records because no staff features are enabled. SPA unknown routes return HTML 200 with not-found UI, not an HTTP 404.

## API

- `GET /api/content/config`
- `GET /api/content/onboarding`
- `GET /api/content/events`
- `GET /api/content/after-arrival`

Each returns `{source: "nextcloud" | "demo", data: ...}` with `no-store`. Only the corresponding fixed `app-content/<kind>.json` path is requested. Upstream reads use a 10-second timeout and a streamed 512,000-byte cap before parsing. Missing credentials, upstream denial, invalid/missing JSON or a timeout return validated sample data with `source: demo`. The client has a 15-second timeout and its own bundled sample fallback for an unavailable API. Config fallback always disables WhatsApp. There is no cache of previous WhatsApp invitations. Content is loaded once per page load, or on retry.

`GET /api/nextcloud/download?path=documents/enrollment/form.pdf` streams an attachment. The path must be within `documents/` and exactly referenced by an active, non-demo topic in current validated Nextcloud onboarding or after-arrival content. The server reads both content collections in parallel on each download request; it does not cache authorization. Missing/malformed/demo fallback content cannot grant access. Unreferenced documents are rejected before fetching their bytes. No folder listing is available (`/api/nextcloud/files` returns 404). Paths reject dot segments, backslashes, percent-encoded ambiguity, controls and hidden path segments; root configuration is separately validated. Upstream redirects are disabled. Bytes are never rendered inline: octet-stream, attachment disposition, nosniff, no-store. Document reads time out after 40 seconds, following up to 10 seconds for content authorization; Vercel function duration is 60 seconds. The client buffers a blob for an error-aware download; publish reasonably small PDFs suitable for phones. Platform file-size/streaming limits still need live verification.

Errors: 400 invalid path, 404 missing/disallowed file or endpoint, 405 unsupported method, 503 unconfigured document connection, 502 upstream/network failure. Raw upstream bodies and credentials are never returned. Safe server diagnostics identify failed content kinds; no student data is logged by application code. Hosting/upstream infrastructure may keep request logs.

## Progress and privacy

`wl-progress` stores `{version: 1, completed: [topicId]}`. Corrupt/missing/unknown versions reset safely; valid IDs are deduplicated. Unknown versions are intentionally not interpreted; future schema changes require a migration here. Browser storage failure retains in-memory progress with an explicit warning. No progress leaves the browser. IDs persist across semesters unless a student resets them. No sensitive staff/student records belong in local storage.

## Security boundary and future work

The download boundary combines subtree confinement and current per-file topic references. The low-level download middleware defaults to deny unless an approval function is supplied; the shared API supplies the content-based authorizer. The four JSON files are public editorial content. Keep all personal data elsewhere. Future staff adapters must authorize every operation server-side, validate inputs, set tutor identity/timestamps on the server, and use approved durable storage. The current staff interface is not an authentication system and is not connected to HTTP routes.

## Reference-led student journey

The screenshot informs layout and geometry, not administrative claims. `src/index.css` defines shared cream, text, red, border, connector and width tokens. Journey rows use outlined numbered circles, a dashed vertical line, open text layout and a single full-row Link. Completion changes both the node/checkmark and accessible state text. At desktop widths titles and summaries may flow inline; mobile stacks contextual label, title, summary and action. The mobile menu exposes expanded state, supports Escape and restores focus to its button. FAQ items use native buttons and hidden labelled answer panels.

The topic schema adds an optional `eyebrow` without breaking existing version-1 files. Sample summaries are neutral UX text and remain explicitly marked as demo. Stable IDs and existing `wl-progress` version-1 storage are retained, so existing completion data is preserved. The progress hook now exposes explicit markComplete, markIncomplete, isComplete and totalCompleted alongside toggle/reset; displayed counts are scoped to the current active journey topics.

Vercel security headers include CSP, nosniff and referrer policy. Local Vite development allows its normal development tooling. Institutional production review, live Nextcloud/Vercel verification, accessible testing with students, and approved contact/privacy details remain required.

## Workbook/staff implementation update — 2026-09-17

New server modules: `server/excel/` (bounded ExcelJS parsers/export), `server/staff/auth.js` (pilot session/role/CSRF), `store.js` (private confined WebDAV conditional writes), `repository.js` (imports, publication, operational records), `api.js` (protected routes). `server/api.js` composes this with existing public content/download handlers. Vite loads only server configuration prefixes into middleware; no staff/Nextcloud secrets are injected into client code.

Public content adds health-insurance, useful-links and rundfunk collections and routes. Required workbook items are shown separately from downloads. `loadContent` first checks the atomic release, falls back to legacy JSON only when absent, and serves labelled samples on invalid/unavailable content. The document allowlist uses that same validated content. ExcelJS is absent from the frontend bundle.

The student client requests `/api/content` once for all seven collections to reduce mobile round trips. The server validates a complete atomic release in one Nextcloud read. Before the first release, it fetches legacy collections concurrently and marks missing/invalid ones as samples. Individual content routes remain for compatibility and download authorization.

The existing root API catch-all is preserved for local compatibility. Vercel's deployed route check showed that it did not receive multi-segment URLs in this project. More specific `api/content/[kind].js`, `api/nextcloud/[...path].js` and `api/staff/[...path].js` entrypoints now forward to the same shared `server/vercel-handler.js` and `server/api.js` middleware. This keeps path validation and authorization in one implementation.

`src/staff/` isolates staff routes, services, workspace and coordinator pages from student pages. Sessions/CSRF stay in memory/cookies; operational records are never written to localStorage. Browser progress retains the legacy key for existing content and uses a publication revision suffix for resets. Native print styles consume the same normalized published collections.

See the workbook, MasterExcel and staff-operation guides for schemas, limits, workflows and known pilot limitations. These sections supersede the earlier unimplemented staff architecture description.
