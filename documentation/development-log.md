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

**Production routing follow-up:** After pushing the pilot, live probes showed the root Vercel catch-all answered `/api` plus one following segment, but Vercel returned platform `NOT_FOUND` for nested content, download and staff endpoints. Added Vercel rewrites for these paths to the existing single-segment catch-all; its adapter restores the bounded route before entering shared middleware. The extra nested function files were removed. Unit tests now cover nested content and staff normalization, but hosted acceptance must be repeated after this routing follow-up deploys. No project, domain or protection setting was changed.

Real source workbooks were not present locally, so exact institutional layouts and real Nextcloud writes are unverified. Staff codes remain unconfigured/disabled by default. No Nextcloud records were created during verification; the browser fixture used only isolated in-memory synthetic data. No Vercel project/protection/integration changes or deployment were performed. Feedback persistence, institutional identity, dedicated events/after-arrival editing, audit browsing and retention policy remain outstanding.
