# Development log

## 2026-09-17: Nextcloud migration

**Request:** Remove Google Sheets and connect the supplied Nextcloud folder, supporting all file formats.

**Implementation:** Removed useSheetData.js, the direct Sheets request and its environment references. Replaced structured FAQ rendering with folder browsing and file details. Added the Nextcloud hook, breadcrumbs, filename search, downloads and Nextcloud links. Kept the React/Vite foundation and adjusted styling for mobile and long filenames.

Added read-only WebDAV middleware, fast-xml-parser, a fixed source folder, validated relative paths, server-only credentials, controlled errors, timeouts and binary streaming. Integrated the API into Vite development/preview and a standalone Node server. Added environment examples, secret-file ignore rules, Node lint settings, test/start scripts and setup instructions.

**Verification:** Five backend tests, lint and build passed. Browser inspection verified the setup-needed page with no JavaScript error. Standalone HTTP checks returned 200 for home/file routes and JSON 503 for missing credentials. Source search found no remaining Sheets integration references at implementation time.

**Pending:** Authenticated access, actual folder contents and live downloads. The supplied URL returned HTTP 401 anonymously. Credentials still require local configuration.

**Limits:** File access supports arbitrary formats; extracting document contents into FAQ pages is not implemented. Previews/editing depend on Nextcloud or local software. No writes to Nextcloud or visitor login are provided.

## 2026-09-17: Development documentation

**Request:** Document decisions and technical developments in a documentation folder, then commit this chat's changes with a short message and push to main.

**Implementation:** Added documentation/ with an index, decisions, architecture/API details, operations and this log. Linked it from the root README. Included maintenance guidance for future changes and distinguished local verification from the pending live connection.

**Scope:** The migration and documentation belong to this chat's commit. Unrelated local assets, workspace settings and unrelated lockfile version changes remain outside that scope. Git history records the eventual commit; this document does not claim a push before it occurs.

## 2026-09-17: Remaining local project files

**Request:** Review, commit and push the local changes excluded from the migration commit.

**Review:** The lockfile updates brace-expansion 5.0.8 → 5.0.12, nanoid 3.3.16 → 3.3.19, postcss 8.5.22 → 8.5.28, and react-router/react-router-dom 7.18.1 → 7.18.4. It also restores npm's dependency-key ordering. No manifest version ranges change.

Added `WL_BUW.code-workspace`, which opens the repository through the portable relative path `.`. Added the existing [navigation sketch](../Docs/60751ec8-f4a2-4e81-8d6a-9ce20e508137.jpg), showing linked context nodes and an idea for opening a context-specific topic list. The image is design reference material, not a newly implemented interaction.

**Verification:** Inspected the workspace JSON, lockfile diff and image. `npm ls --depth=0` succeeds and the diff has no whitespace errors. The dependency installation is unchanged from the preceding successful five-test, lint and build checks.

## 2026-09-17: Welcome Lounge operational pilot milestone

**Request:** Evolve the existing repository into an anonymous student companion with portable Nextcloud content, restricted public access, Vercel-compatible API, mobile journey, and maintainable handover. This is an operational project, not a thesis.

**Audit:** The starting application was a small React/Vite directory browser backed by one WebDAV middleware and five mocked backend tests. Credentials were server-only; path validation, redirect rejection, XML safety and forced attachment streaming were reusable. Root and frontend folder assumptions were hardcoded; the whole root was publicly browseable. Traditional Node serving lacked a Vercel function entry point. Empty widgets and unused directory styles were obsolete. Existing documentation described the prior behavior accurately but needed superseding.

**Implementation:** Added one configurable server root, shared public path validation, fixed structured-content reads, bounded/versioned content validation, a Vercel catch-all API and SPA routing configuration. Removed public listings and restricted downloads to the expressly public documents subtree. Reused attachment streaming and retained the XML parser/tests. Added labelled fallback/example JSON, seven-step journey, topic explanations/actions/documents/contextual FAQ, local-only progress with reset/failure handling, configured WhatsApp, events, later-stage topics, help/privacy and not-found pages. Added honest not-saved feedback UI/service, unavailable staff pages and an unwired server-only operations boundary. Removed obsolete directory components/hook/styles. No remote files were changed and no vendor, authentication system or database was added.

Added a content-validation CLI, Node engine requirement, content guide, current README, technical/operations handover and superseding decisions. Semester text/contact/invitation and topic content update through Nextcloud JSON without a rebuild. Environment/root changes require restart or redeployment.

**Verification:** `npm ci` succeeds (211 packages, zero reported vulnerabilities). `npm test`: 15 passing tests, preserving original security coverage and adding public-path, content, WhatsApp, events, progress, feedback and staff-boundary cases. `npm run lint`, `npm run build`, `npm run content:check`, and `git diff --check` pass. Vite build: approximately 81 KB gzipped JavaScript and 1.7 KB CSS. A Windows native-module lock initially prevented clean installation; repository Vite processes were stopped to release it, then installation and all required checks passed.

Browser verification using agent-browser confirmed meaningful desktop/mobile rendering, topic deep links, sample labels, contextual FAQ presence, events, later-stage routes, not-found UI, no reported runtime errors, and no horizontal overflow at 320/390px. Keyboard activation toggled completion and a full page load retained 1 of 7 completed; feedback reported that nothing was sent or saved. Agent-browser pointer clicks did not initially activate completion; DOM/keyboard activation established that the React handler and storage worked. Full touch-device and assistive-technology testing remains a pilot activity.

Standalone HTTP smoke checks verified frontend deep links and blocked public listings. The actual Vercel handler was imported into a local Node HTTP server and returned valid content. This verifies handler compatibility locally, not Vercel infrastructure, rewrite execution or authenticated upstream access.

**Pending launch work:** Publish International Office-approved content/documents and real contact information; configure the confirmed current WhatsApp invite; verify authenticated Nextcloud reads/downloads and a Vercel preview; review institutional privacy/contact wording and test with students/tutors. Production staff auth, persistence, retention/permissions, operational records, reports, RSVP and visual admin editing remain unimplemented. Feedback is not saved. Public documents subtree contents must be reviewed before exposure; unlinked files there are still public.

**Workspace:** No secrets were added to source or built client output. No commit, push or deployment was performed. Reference HTML/assets that appeared under Docs during implementation were left untouched.

## 2026-09-17: Existing Vercel deployment context and verification

**Request:** Preserve the already-working GitHub integration and existing project; inspect configuration, retain shared local/serverless code, and explicitly check protection and production acceptance criteria.

**Findings:** The committed baseline contains no Vercel config, API entry point or tracked CI files. The previous P0 slice added the current uncommitted Vercel config; it was inspected and retained. No local `.vercel` link exists. Anonymous requests to the supplied deployment's home, topic and API URLs returned HTTP 302 to Vercel's `/sso-api`. Connector team discovery returned no teams; protected URL access returned 403. Remote project settings/environment/commit could not be established. No access setting, integration, project or environment variable was modified.

**Changes:** Corrected README/operations to use the existing commit/push -> automatic deployment workflow. Added deployment-verification.md with all seven acceptance criteria and explicit local/hosted status. Added `scripts/check-deployment.js`, a read-only anonymous HTTP checker that fails on protection, fallback-only content or missing download verification. Added an actual Vercel handler integration test for safe missing-credential behavior and absence of server-setting leakage. No alternative CI, project link or deployment command was introduced.

**Verification:** All 16 tests, lint and production build pass. An additional production build injected unique non-secret sentinel values into the server-only Nextcloud environment; scanning every built asset found no sentinel values or credential variable names. The readiness script against the supplied URL exited nonzero with an explicit protection finding, as intended. Documentation links and whitespace checks pass.

**Pending:** Push/deployment of the reviewed implementation through the existing Git workflow; owner-approved access path for live inspection; real Nextcloud content and approved document checks; live browser refresh/assets verification. Hosted support is not marked complete. Project protection remains unchanged, and any public-access change must be identified for explicit approval first.

**Resumed verification:** Added configured-root content and binary-download coverage through the actual Vercel handler using controlled upstream responses. Both configured and missing-credential paths now have handler-level regression tests. All 17 tests, lint, production build and whitespace checks pass. Corrected a README encoding typo; existing project configuration and protection remain unchanged.

**Production domain clarification:** The user supplied `https://wl-buw.vercel.app/` and project ID `prj_VrjEwDB09VK3PldfyLvnfZn9bxIQ`. Anonymous HTTP and browser checks confirm the production homepage returns 200 and renders the old Info-Directory/file-browser UI with “Files are unavailable.” The new topic route and content API return 404. This domain is already public; the previous protection finding applies only to the deployment-specific URL. Connector project access returned 403. Recorded the existing identifiers and updated hosted acceptance status; no project/protection/integration changes, commit or push occurred. The P0 code remains local pending its Git release.

## 2026-09-17: Reference-led student journey refinement

**Request:** Implement the student journey using the provided cream-background, numbered-node reference, with whole-row interactions, accessible FAQs, browser-only completion and document access limited to topic references.

**Inspection and preservation:** The local P0 work already supplied React/Vite routes, content adapters, progress and shared Vercel/local WebDAV handling. Reused those instead of restoring the old file browser or creating another project. The screenshot was treated as visual reference only; its administrative deadlines and requirements were not imported as policy.

**Implementation:** Added AppHeader with red-square branding and a native mobile menu; converted journey cards to open full-row links, neutral contextual labels, outlined circles, dashed connectors and text/checkmark completion states. Added a shared CSS token system with restrained red and cream. Updated the heading to “Your first steps in Weimar” and kept progress close to the introduction. Replaced native details with reusable native-button FAQ items exposing aria-expanded and aria-controls. Topic pages use the same editorial layout. The progress hook retains its existing storage key/version and gains explicit mark/unmark/query helpers. Added active-topic lookup for not-found handling. The optional eyebrow field is backward-compatible with version-1 content; sample text remains labelled and non-authoritative.

**Security change:** Subtree-only document access is superseded. Downloads must be exactly referenced by active, non-demo topics in current validated Nextcloud onboarding/after-arrival content. Missing/malformed/fallback content and removed references fail closed. The shared server authorizes before fetching file bytes; redirects, path safety and attachment headers remain. No remote files or Vercel settings were changed.

**Verification:** 20 tests pass, including the preserved WebDAV/security tests and new reference revocation, explicit completion/serialization and invalid-topic lookup tests. Lint, production build, content validation and whitespace checks pass. Build is approximately 82 KB gzipped JavaScript and 2.5 KB CSS.

Agent-browser screenshots were inspected at 375px phone, 768px tablet and 1280px desktop widths. All seven rows render; row navigation and back navigation work. Keyboard tests confirm immediate completion count updates, persistence across reload, unmarking, FAQ open/close, visible focus, mobile menu expansion, Escape closing and focus restoration. Invalid topic IDs show not-found UI. Mobile topic content has no horizontal overflow; missing WhatsApp configuration renders no external link, and samples expose no document links. No runtime errors were reported. Automation pointer clicks navigated links but did not reliably activate React buttons in this environment; button behavior was verified with keyboard input. Physical touch-device testing remains part of pilot review.

**Handover:** Updated README, content guide, technical architecture, operations and decisions with the visual/content model and stricter publication rule. International Office content/contact approval and real Nextcloud/Vercel download verification remain pending. No commit, push, deployment, new vendor or student authentication was introduced in this slice.

## 2026-09-17 — Workbook workflows and private staff pilot

Implemented server-only ExcelJS editorial/MasterExcel parsing with bounded ZIP expansion; variable-count steps; required-item text; insurer/portal/Rundfunk content models and public pages. Added coordinator preview, source-bound confirmation, private backup and atomic conditional publication. Browser progress can be isolated by publication revision. Added A4 print center using published content.

Added disabled-by-default pilot tutor/admin sessions, server authorization and CSRF checks, confined private Nextcloud aggregate storage with ETag conflicts, explicit MasterExcel import/export, opaque student IDs, status editing, separate daily check-ins, attributed handover, shift/tutor screens and count-summary CSV reports. No external vendor or production filesystem persistence. Existing WebDAV/path/download protections remain in place.

Verification: 35 automated tests pass, including synthetic workbook variants, publication/conflict checks, session tampering/expiry, role/CSRF denial, private path confinement, public release fallback and progress revisions. Production build, lint, dependency audit and all seven sample schema checks pass. Synthetic browser flow verified coordinator sign-in, MasterExcel preview/import, publication review/confirm, public 10-step journey, completion surviving reload and matching four-part print content. Checked 375px mobile, 768px tablet and desktop; no horizontal overflow or browser errors were reported. The student app now fetches the seven content collections in one request; the dev browser showed no legacy per-collection calls.

**Vercel request-body fix:** Vercel's Node runtime parses JSON requests onto `req.body`, while local Node requests arrive as streams. The staff API now accepts both forms and bounds the parsed JSON size. A regression test passes a parsed-body request through the staff login route. This closes a local-vs-Vercel behavior gap discovered during deployment review. See [Vercel Node.js runtime request body](https://vercel.com/docs/functions/runtimes/node-js).

Private stored state now validates record shapes, field lengths and collection limits before serving or updating staff records. Invalid state fails with a safe review message. A regression test covers malformed saved data.

**Production routing follow-up:** After pushing the pilot, live probes showed the root Vercel catch-all answered `/api` plus one following segment, but Vercel returned platform `NOT_FOUND` for nested content, download and staff endpoints. Added Vercel rewrites for these paths to the existing single-segment catch-all; its adapter restores the bounded route before entering shared middleware. The extra nested function files were removed. Unit tests cover nested content and staff normalization. After the routing follow-up was pushed, live checks confirmed `/api/content/config` returns 200, `/api/staff/session` returns safe 401, `/api/nextcloud/files` returns safe 404, and a document download returns safe 503 because Nextcloud credentials are unavailable. Browser refresh of `/journey/enrollment` succeeds without browser errors. No project, domain or protection setting was changed.

Real source workbooks were not present locally, so exact institutional layouts and real Nextcloud writes are unverified. Staff codes remain unconfigured/disabled by default. No Nextcloud records were created during verification; the browser fixture used only isolated in-memory synthetic data. The changes were pushed through GitHub and the existing automatic Vercel deployment. No project, protection, or integration settings were changed. Feedback persistence, institutional identity, dedicated events/after-arrival editing, audit browsing and retention policy remain outstanding.

## 2026-09-17 — Arrival companion student UX redesign

**Request:** Make the existing public student experience warmer and easier to revisit without changing administrative facts, content contracts, progress behavior, routes, staff functionality or the React/Vite and Nextcloud architecture.

**Changes:** Reworked the journey home into an editorial welcome hero with a progress meter, next-incomplete-topic action and completed-journey state. Added a compact “today” layer that uses local progress and at most one confirmed upcoming event; demo events never appear as real event previews. Kept the connected whole-row journey path and added supported action/document counts where published content provides them. Added concise exploration links that reuse existing useful-information, after-arrival and event routes. Topic pages now scan from the short explanation through supported “At a glance” counts, actions, requirements, approved documents, notes, FAQs and completion; only supplied structured fields are presented. Documents have human-readable action rows, FAQs use a subtle triangle motif, and the help block is visually distinct while retaining the configured WhatsApp safe fallback.

**Boundaries preserved:** No topic, policy statement, deadlines, events, document references, WhatsApp settings, API, content schema, staff code or storage behavior was changed. The home uses `topics.length` and the first active incomplete topic; completion remains anonymous/local. Explore destinations and the existing public navigation routes are reused. No generic dashboard framework, animation dependency, external font or added persistence was introduced.

**Verification:** 36 automated tests pass; lint, production build and `content:check` pass. Playwright browser inspection at 375, 430, 768 and 1280 CSS pixels confirmed seven current topics and no horizontal overflow. A topic route, completion acknowledgement, FAQ expansion, no-link WhatsApp fallback, all-complete state and keyboard-opened mobile menu were exercised; no console errors occurred. Current events content has no confirmed upcoming event, and the home correctly omits the event preview. The agent-browser CLI listed in the Vercel skill was unavailable; the installed Playwright package was used for these local checks. No physical-device, Vercel-hosted or authoritative-content review is claimed.

## 2026-09-17 — Official BUW visual identity alignment

**Request:** Align the existing student experience to the university’s official digital identity without cloning its global website or changing application behavior.

**Changes:** Replaced the cream/brick palette and duplicated arrival-theme overrides with one white, black and neutral-grey stylesheet. Centralized the official university colour values as CSS tokens; burgundy is the primary action and navigation accent, while blue, yellow, green and red are limited to event/info, attention, completion and warning contexts. Changed the compact brand header to a top burgundy rule and made the footer black with official university, International Office, Help/privacy and staff links. Rebalanced headings and open journey rows for a tighter editorial grid with thin rules and small corner radii.

Bundled Fira Sans locally via `@fontsource/fira-sans`, including Latin and Latin Extended subsets at weights 400, 500, 600 and 700; no runtime font request or licensed print font was added. The family is SIL Open Font License 1.1. Mobile journey, progress, event and topic behaviors remain unchanged.

**Verification:** All 36 automated tests pass; lint, production build, content validation, dependency audit and whitespace checks pass. The supplied colour contrast was checked in-browser: white text on BUW magenta is 6.45:1. Fira Sans loaded successfully. Browser renders at 375, 430, 768 and 1280px showed a white canvas, the exact magenta brand token, black footer, seven current steps and no horizontal overflow. The topic detail and missing-WhatsApp fallback rendered without console errors. Keyboard testing confirmed mobile menu open/close, Escape return focus and reduced-motion transition suppression. Current content has no confirmed upcoming event, so no event preview appears. No approved photography was present, so the interface remains image-free and light. No physical-device or live Vercel test is claimed.

## 2026-09-17 — Minimal student journey

**Request:** Make the student interface quiet and task-focused. Keep the journey primary and move secondary information behind simple routes.

**Changes:** The public home now contains only “Your first steps”, a compact progress count/indicator, the connected journey rows and links to Events, Useful information and Help. Removed the promotional hero, next-step panel, Today block, event preview and Explore cards. Journey rows now show only the stable order, completion state, title, existing short summary and open cue. Topic pages present available actions, requirements, explicitly referenced documents, questions, completion and configured support without separate repeated “why”, “about” or “at a glance” sections. Added `/info` as a short index into existing public information routes and relabelled the header navigation accordingly. Existing content fields, routes, local progress, secure Nextcloud document API, WhatsApp settings and staff functionality are preserved.

**Verification:** All 36 tests pass; lint, production build and all seven content checks pass. Playwright inspection at 375px and 1280px found no horizontal overflow or browser errors and confirmed seven journey steps. Browser flow confirmed mark-as-done, persistence after reload, FAQ expansion, the disabled-WhatsApp fallback and navigation to `/info`. Screenshots of the mobile home, desktop home and mobile topic were reviewed. There are currently no referenced topic documents, so no document actions are rendered. No administrative content or policy claims were edited; no live Vercel or physical-device review is claimed.

## 2026-09-17 — Official university source synchronization

**Request:** Integrate the official Preparing your studies and Welcome Events pages with server-side parsing, freshness tracking, durable fallback, student source references, and maintainable staff refresh while preserving the existing student/staff/Nextcloud/Vercel architecture.

**Implementation:** Added a validated source registry, allowlisted bounded HTML fetcher, server-side parsers, structured validators, normalized hashing and private Nextcloud last-known-good cache. Welcome events are parsed as factual structured records; the Preparing page contributes section names and links only. Topic mappings and source schedules live in `content/app-content/sources.json`. Public APIs expose validated JSON and never HTML/cache paths. Topic/Info pages gain small canonical links and freshness copy; Events renders unambiguous future events and flags conflicting dates. Added admin source status/refresh/review at `/staff/sources`, local check and sync commands, and a disabled-by-default secret-protected internal refresh endpoint. Existing Vercel rewrites and the catch-all function remain in place. No Vercel Cron was configured.

**Source review:** Live parser inspection on 17 September 2026 extracted nine Preparing page sections and eight Welcome Events entries. One event's heading says 14 September while its detail says 16 March; the app retains the raw source string, hides its normalized date/time, and links to the official programme. The source declares a favicon URL; the parser records and validates favicon references, but the app icon is unchanged pending reuse-rights confirmation.

**Verification boundary:** Parser tests use small synthetic fixtures rather than copies of university pages. Live fetch/parse and `npm run sources:dry-run` are separate from persistent synchronization. Local Nextcloud credentials are not configured here, so a real Nextcloud write and hosted refresh are not claimed. No university content was edited and no Vercel project setting or deployment protection was changed. Final command results are recorded after execution below.

**Verification:** `npm test` passes 48 tests; `npm run lint`, `npm run build`, `npm run content:check`, `npm run sources:check`, and `git diff --check` pass. `npm run sources:dry-run` fetched both live pages and parsed 9 study sections and 8 events (one event needs review); favicon URL references were resolved. `npm run sources:sync` exited safely before writing because Nextcloud credentials are absent. Playwright inspection at 375px and 1280px confirmed seven journey steps, no horizontal overflow, a working topic official link, Events heading/programme link, a JSON unavailable fallback from the source API and no browser console errors. The agent-browser CLI is not installed in this workspace, so Playwright was used for the local browser check. No persistent Nextcloud write or hosted Vercel behavior is claimed.
## 2026-09-17 — Responsive editorial journey map

Replaced the straight vertical student timeline with a spatial serpentine map. The semantic ordered list remains in topic order; a small layout utility groups any topic count into alternating rows (three columns on desktop, two on tablet, and alternating one-column nodes on mobile). A ResizeObserver measures node centers for a decorative SVG path. The path is neutral and dashed ahead, burgundy through completed progress, and routed around mobile text. Entire step regions remain links with explicit accessible labels; the circle is a status marker only. The separate progress bar and repeated “Open” cues were removed. Completed nodes use a burgundy fill, a checkmark and a visible Done label. Topic detail routes remain linear and unchanged. The global footer is now a compact white identity row.

Automated checks: 50 tests pass, including dynamic grouping and next-incomplete lookup; lint and build pass. Playwright checks at 375, 430, 768, 1024, 1440 and 1920px confirm seven rendered steps, expected responsive columns, no horizontal overflow and no browser errors. Local interaction verified keyboard focus, marking a step done, immediate progress update and burgundy connector progress. Twelve-topic content was checked with long title/summary variants. No administrative content, APIs, persistence, staff behavior or project settings were changed.

## 2026-09-17 - Use supplied app favicon

Replaced the app entry's SVG favicon link with the project-owner-supplied public/favicon.ico. The separately discovered BUW website favicon remains unused pending reuse permission. The supplied ICO header and all three image entries were validated before copy.

## 2026-09-17 - Journey node pointer interaction

Added a restrained mouse-proximity effect to the semantic journey map: nodes glide a few pixels away from the pointer, and the existing SVG connector is recalculated in the same animation frame so it remains attached. The effect is limited to fine pointers and is disabled for reduced-motion preferences. Touch, keyboard, link behavior and topic order are unchanged.

## 2026-09-17 - Refine journey map interaction and states

Journey nodes glide slightly away from nearby mouse pointers while the decorative SVG path follows. The effect is limited to fine pointers and disabled for reduced motion. Connector and circle outlines now use 2px black strokes; incomplete nodes fill with BUW magenta on hover/focus, while completed nodes remain black with a white check. Removed the Journey header progress strip and sample notice; completion remains visible in the map.

## 2026-09-17 - Round journey row transitions outward

Journey connector turns at the end of each serpentine row now curve outward, using measured node positions and the active column count. The single-column mobile route remains unchanged. The sticky-footer flex shell now gives the main element full width so tablet breakpoints correctly select the two-column journey.

## 2026-09-17 - Survey-informed information findability and tutor continuity

The current survey input is preliminary and directional: four respondents, all Welcome Lounge tutors. It is not treated as representative of International Office staff, future tutors, or students. The product response focuses on navigation to current information, visible official sources, WhatsApp as human support, and lightweight shared context rather than replacing familiar tools.

Student `/info` is now an editorial list that routes directly to existing university portals, health-insurance contacts, Rundfunkbeitrag and later-stage information. `/help` explains that Journey/Info cover common questions and the Welcome Lounge is the route for individual or unusual cases; WhatsApp remains configuration-driven with its existing safe fallback. No authoritative topic content or data was changed.

The staff dashboard emphasizes today's named/time-stamped check-ins, links to student records, quick find/check-in/handover actions, unresolved cases and recent handover notes grouped by day. Student details show a compact recent change-field summary with actor/time and check-in history. Coordinator Semester setup summarizes the current semester, publication, WhatsApp, MasterExcel, shift data and official-source freshness; mismatched semester labels require human review and are never auto-corrected. Existing workbook preview/publish, data import/export and official-source refresh flows remain the actions. MasterExcel remains familiar import/export/backup compatibility.

Documentation now records the limited research scope, product rationale, Info/Help roles, operational continuity workflow and semester review process. No search, AI, analytics, notifications, student identity collection, new vendor, or replacement of WhatsApp/Excel was introduced.

**Verification:** `npm test` passes all 50 tests; lint, build, `content:check` and `git diff --check` pass. Local Playwright inspection at 375px and 1440px confirmed the journey/info routes render without horizontal overflow. Info links lead to the existing sections; Help displayed the safe no-WhatsApp-configured fallback. Mocked staff API responses exercised dashboard and semester-status rendering, including mismatch warning, and student details displayed changed-field attribution and check-in timestamps without browser errors. These local checks do not verify live Nextcloud, real workbook imports, Vercel, or actual deployment settings.

## 2026-09-17 - Reorder the fallback journey

Reordered the bundled onboarding fallback to Health insurance, Accommodation, Enrollment & student ID, City registration, Bank account, Meetup with Program Tutors, Campus & departments, Welcome events, and Language courses. Accommodation and the tutor meetup are explicitly demo entries with neutral copy; existing topic IDs were retained. A focused test now asserts semantic topic order. Published workbook content remains authoritative and must be reviewed in Semester setup if the same order should be used in a published journey.

## 2026-09-17 - Extend the fallback from the Welcome Lounge first-steps PDF

Kept every existing journey topic, moved City registration and Bank account ahead of enrollment, and added Semester contribution, Residence permit, and Deutschlandsemesterticket topics. Reordered Language courses last. PDF-derived details remain demo content; references to Summer Semester 2026 were excluded. Semester contribution figures were checked against the current official Winter Semester 2026/27 page and the topic links directly to the university's source. Added approved-host validation for topic-specific official URLs and linked the relevant official pages. The fallback cannot update a currently published Nextcloud workbook; coordinators must preview and publish an approved workbook separately. No Nextcloud content was changed from this environment.

## 2026-09-17 - Refine the fallback journey order

Moved Enrollment & student ID before City registration and Bank account after City registration, removed Campus & departments from the bundled first-steps journey, and moved Residence permit to the final position. The fallback now has eleven steps; remaining topic content and IDs are retained. A published Nextcloud workbook remains unchanged until a coordinator reviews and publishes its updated version.

## 2026-09-17 - Refine journey spacing and connector turns

Reduced the node-to-title gap consistently across breakpoints while keeping labels centered below nodes. Desktop row turns now use paired gentle Bézier curves along the outer edge. Reduced the compact black footer's minimum height and padding; journey content, semantic ordering, and route behavior are unchanged.

## 2026-09-17 - Stabilize journey summary reveal

Moved summary visibility to the semantic step link's hover and keyboard-focus states, removing pointer-enter state that fired only at the list item's outer boundary. Raised the active step above adjacent map rows, positioned its summary bubble above the title, and gave the hovered node the highest local stacking level. Reduced topic title size slightly.

## 2026-09-18 - Animate the journey entrance

Journey nodes and connectors now alternate at the same pace: each node appears over 800ms, its dotted connector grows from that node over the next 800ms, then the following node appears. Timing is derived from topic index so variable journey lengths work. The dots stay dotted throughout the reveal, including completed segments. CSS animation is lightweight and automatically disabled by the existing reduced-motion rule; all journey links remain present and operable during the animation.

The entrance animation now runs only the first time the Journey opens in a browser tab. Returning from a topic or another student page displays the complete map immediately; the session flag falls back to in-memory state if browser storage is unavailable.

## 2026-09-18 - Add university portals to the journey

Added a University portals step after enrollment and before city registration. Its topic detail links to the existing Useful information portal list rather than duplicating portal content. The optional in-app related-page route is validated to reject external URLs and path traversal.

## 2026-09-18 - Add community and peer-support information under Info

Added a searchable Info entry and `/info/community` page with verified BUW links for Bauhaus Internationals, StuKo, DiversityGuides, and StudyGuides. Added a server-only RSS reader for the university message boards, restricted to housing, offering/seeking, and Piazza categories, same-host notice links, 30-day expiry, bounded XML fetches and a private Nextcloud last-good cache. Feed descriptions are sanitized but omitted from public output to avoid publishing personal details. “Sharing is Caring” remains disabled until a verified Telegram link is supplied. Added RSS discovery and validation commands, focused security/parser/cache tests, and handover documentation. The four-response tutor survey is documented as preliminary and directional only.

**Verification:** 58 tests pass; lint, build, content validation, and official-source configuration validation pass. The live RSS discovery script confirmed the configured feed currently returns 198 total items, contains the three allowlisted categories, and normalizes one item within the 30-day window. Browser inspection of Info and `/info/community` at 375 px and 1440 px showed no horizontal overflow, no error overlay, and no browser console errors. The local environment had no Nextcloud cache, so live notices were intentionally omitted; persistent Vercel/Nextcloud operation was not verified.
# 2026-09-18 — Move semester ticket and language courses out of the journey

Deactivated the bundled `Deutschlandsemesterticket` and `Language courses` onboarding entries without deleting their source records. Added `Deutschlandsemesterticket` to the searchable Info list, linking to the existing after-arrival topic. The active journey and anonymous progress total now exclude both items. A published Nextcloud workbook remains authoritative in production and must reflect the same change when its content is next reviewed and published.
# 2026-09-18 — List later-stage topics directly in Info

Info now lists every active After-arrival topic as a separate searchable entry, each linking to its existing detail route. Removed the separate `/after-arrival` index page and route; the topic content and `/after-arrival/:topicId` detail routes remain available.


## 2026-09-18 — Workbook-driven content maintenance and APP-root configuration

Made the editorial workbook the only staff-maintained source for public semester settings, journey text, official links, useful-information links, student-support links and curated community links. The admin Content page now downloads a safe workbook template, reports source modification/publication status, shows semantic changes, and provides restore actions. Removed the separate semester/WhatsApp configuration save form. Publication retains the existing HMAC preview proof and single conditional runtime release, while saving the source workbook, prior content and release metadata in private timestamped Nextcloud backups/history. Public runtime reads remain generated/validated and require no Vercel redeploy. Automatic official-source/RSS synchronization remains separate.

Configured the current Nextcloud host/root as `NEXTCLOUD_BASE_URL` and `NEXTCLOUD_ROOT_FOLDER=/Welcome.Lounge_WiSe2026_27/APP` through environment only; no backend default embeds the browser UI ID, host or folder. The optional staff browser URL is separately configurable. Extended the student Info/community routes to consume workbook-published links/support resources, and preserved compatibility with older releases missing the new optional resource kinds. Added tests for safe template parsing, private-note exclusion, unsafe URLs, backup/restore, and configured WebDAV host/root.

Operational state remains private structured Nextcloud storage with ETag conflict protection; MasterExcel remains import/export/backup. A shared aggregate state file remains a known concurrency limit before wider multi-tutor use.

## 2026-09-18 - Staff workspace presentation pass

Refined the private staff shell, sign-in presentation, responsive navigation, coordinator content review, and Today dashboard hierarchy. Kept authentication, Nextcloud storage, content publishing, student records, and permission behavior unchanged. Verified staff screens locally with synthetic test-only session/data at mobile and desktop widths.

## 2026-09-18 - MasterExcel sample workbook

Added an admin-only downloadable MasterExcel sample to Staff → Data. The workbook explains its four expected sheets and includes fictional sample rows; marked sample rows are skipped by the importer so they cannot create fictitious operational records. Documented that `staff-data/state.json` is created automatically on the first successful staff data change and does not need to be uploaded manually.

## 2026-09-18 — Unified Welcome-Lounge.xlsx implementation

Added a server-side six-sheet workbook parser/serializer and private staff repository. Staff UI mutations now have workbook-backed routes for content, semester/WhatsApp settings, students, check-ins, attributed activity, handover, staff and shifts. Public content is projected from active workbook rows only; private Students, Activity, Staff, Shifts, workbook bytes and backups are excluded. One-time migration preserves old files and validates inputs. The implementation uses conditional Nextcloud writes and private snapshots; actual university WebDAV CAS enforcement still needs production acceptance. The app looks for the default `Welcome-Lounge.xlsx` and switches when present, leaving old sources active while it is missing. See [unified workbook docs](excel-database.md).
