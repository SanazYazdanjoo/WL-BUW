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

Historical decision: the initial backend fixed the upstream origin and `/S.Y` root in code. This is superseded by the 2026-09-18 configuration decision below; current deployments set the host/root in server-only environment variables. Relative-path validation, encoding, redirect rejection and direct-child listing protections remain.

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

Historical decision: the first product backend used a root default and broader document-subtree rule. Later decisions superseded both: the configured root now has no code fallback, public Nextcloud calls use validated semantic content only, and a file download also requires the exact path to be referenced by an active non-demo topic. Keep the current rule when maintaining the API.

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

## D20: Keep the public home to the journey (2026-09-17)

The primary student screen is a focused journey, not a dashboard: heading, concise progress, connected topic rows, and small links to Events, Useful information and Help. Do not add hero recommendations, Today panels, event promotions or Explore cards to this screen. Secondary content remains reachable on dedicated existing routes, with `/info` serving as a concise index. Topic detail pages render only supported content once and omit redundant “why”/“at a glance” summaries while retaining the underlying source schema. This reduces scanning overhead and does not alter content, progress storage, public document authorization, WhatsApp configuration or staff operations.

## D21: Official university sources with a last-known-good cache (2026-09-17)

The fixed official Preparing your studies and Welcome Events pages are canonical references, fetched only server-side from the allowlisted BUW host. Welcome Events is normalized as structured event data; Preparing your studies supplies section and link metadata only. Scraped administrative prose never overwrites local guidance. Validated records are persisted in a private Nextcloud cache with content hashes, configurable TTLs and stale thresholds. Failed fetches/parses and implausible changes preserve last-known-good content; ambiguous event dates are surfaced as needing official confirmation. Public API responses contain structured data only. Official links remain available with an empty cache. The internal sync endpoint is disabled by default and no Vercel Cron is configured. The discovered university-site favicon is recorded and validated, but its asset is not reused until rights are confirmed; the app uses a separately supplied local favicon. This decision extends the content pipeline without changing React/Vite, the existing Vercel project, staff architecture or Nextcloud download boundaries.

## D22: Use a measured editorial map for the student journey (2026-09-17)

Replace the straight timeline with a responsive serpentine arrangement while preserving semantic topic order, ordinary React Router links, browser-only progress and the minimal student content. A small grouping utility lays out arbitrary topic counts in alternating three-column desktop or two-column tablet rows; mobile uses an alternating one-column zigzag. A measured decorative SVG follows actual node centers; completed markers and path sections use black. Content stays in HTML, and the detail page remains linear. The map adds no dashboard, game mechanics, illustration assets or dependencies. The footer is a compact black identity row. This is a presentation change only; content, routes, staff and backend behavior remain as already defined.

## D23: Treat the early tutor survey as directional evidence (2026-09-17)

The current survey review covers four responses, all from Welcome Lounge tutors. It is preliminary qualitative input and is not representative of all International Office staff, future tutors, or students. Its strongest product implication is to help students find and understand existing information and its canonical sources, while preserving WhatsApp for community, unusual cases, and human support. Familiar tools such as Excel are integrated with rather than declared obsolete. Staff work should emphasize attribution and shared handover context. Semester preparation should be transferable and reviewable. See [research findings](research-findings.md); do not infer participant quotes or broader statistics.

This evidence supports targeted navigation, help, and handover refinements, not a larger student interface or new collection of student data. It is insufficient to justify AI, complex search, analytics, notifications, or replacing WhatsApp/Excel.

## D25: Preserve the journey and append PDF-informed steps (2026-09-17)

The supplied Welcome Lounge first-steps PDF is an input to the bundled demo fallback, not a replacement for the reviewed semester workbook or authoritative university sources. Preserve all existing semantic topics, reorder where useful, and add distinct topics for semester contribution, residence permit, and Deutschlandsemesterticket. Exclude Summer Semester 2026 information. Link topics to allowlisted university pages; semester-specific payment details must be checked against the current official page. Keep all additions visibly demo until International Office review and publish an approved workbook through the existing workflow. Do not alter the already published Nextcloud content implicitly.

## D26: Put community discovery under Info (2026-09-18)

Preliminary tutor survey feedback suggests information fragmentation is a stronger issue than lack of content, while WhatsApp remains useful for human support. Keep the public navigation unchanged and group peer-support/student-initiative links plus a limited University Message Boards feed under `/info/community`. Treat RSS listings as community notices, not official policy. Fetch one exact BUW RSS URL server-side, allow only reviewed categories and same-host item links, filter by age, sanitize and omit freeform descriptions, and retain a private last-known-good cache. Keep the Telegram invite disabled until a current link is verified. Curated support/community resources are maintained in the private content workbook; this remains separate from the automatic RSS configuration/cache.

## D24: Preserve concise student flow and make maintenance status legible (2026-09-17)

Keep the public path minimal: Journey → topic → official source → optional browser-only completion, with Events, Info, and Help as separate destinations. `/info` is an editorial list into existing content rather than a new content hub; Help distinguishes common information from human support and keeps the configured WhatsApp fallback. Staff dashboard refinements surface today's check-ins, attributed updates, and handovers without introducing analytics. Coordinator semester setup reports current status and mismatched semester labels, links to existing preview/import/refresh/export operations, and never silently corrects content. MasterExcel remains import/export/backup compatibility, not a replacement target. No source-code editing is required for workbook content publication, but real workbook and institutional operating procedures still need validation.


## 2026-09-18 — Workbook publication and current APP root

The temporary current root is `/Welcome.Lounge_WiSe2026_27/APP` on the configured Nextcloud host. `NEXTCLOUD_BASE_URL` and `NEXTCLOUD_ROOT_FOLDER` are server-only configuration; the shared DAV URL builder has no embedded host or folder default. The optional `NEXTCLOUD_BROWSER_URL` is a staff-only shortcut, checked against the configured host. Its numeric browser UI file ID is never a WebDAV identifier. Moving the app later requires copying app-owned content and changing environment values, not code.

The private `content-source/Welcome-Lounge-Content.xlsx` workbook is the human-editable source of truth for semester-specific public content. Authorized staff preview and explicitly publish it from Staff → Content. The server rereads and validates the source, conditionally publishes one atomic `app-content/published.json` runtime release, and saves a timestamped private workbook/publication backup plus admin-only history. JSON is generated output, never an independently edited source. Students read it from Nextcloud at runtime; publication does not require a deployment. Automatic official-source and RSS caches remain separate.

The staff content screen offers a safe template download, workbook/publication status, semantic item/settings diffs, and restore of an earlier release. Semester and WhatsApp settings no longer have a separate save form. Legacy releases missing the new workbook resource kinds remain readable through safe fallback collections. No external database was added. The current private operational pilot still uses bounded `staff-data/state.json` with conditional writes and MasterExcel import/export; conflicts are rejected rather than silently lost, but this aggregate remains a concurrency limitation to revisit before wider multi-tutor use.

## D27: Use one private workbook as the staff data store (2026-09-18)

The target human-maintained source of truth is `Welcome-Lounge.xlsx` under the configured Nextcloud APP root, with six simple tabs: Settings, Content, Students, Activity, Staff and Shifts. Staff normally use the authenticated web UI; Excel remains a portable handover, backup and emergency fallback. Existing legacy workbooks, JSON releases and state files are retained as migration/fallback inputs and are never automatically removed. Public student APIs project only safe active content and settings; operational data and workbook bytes remain private. WebDAV ETag conditional writes reject stale saves, while daily and major-change snapshots stay private in Nextcloud. The app looks for the default `Welcome-Lounge.xlsx` and switches when it exists; live Nextcloud enforcement of conditional writes remains a deployment acceptance check. See [the unified workbook guide](excel-database.md).

## D28: Keep production data intact until unified-workbook acceptance (2026-09-18)

The unified workbook is the current production public-content source, but the verified public response contains no active Journey topics. This repository still includes legacy publication and operational readers for migration/emergency fallback. Retire those readers and archive their Nextcloud files only after all workbook, staff-flow, privacy, backup, and live ETag/If-Match acceptance checks pass. Do not infer that a 200 response from the public content endpoint proves staff writes or concurrency safety. Repository-only dead assets and unused dependencies can be removed independently; no live Nextcloud files are changed by this decision.
