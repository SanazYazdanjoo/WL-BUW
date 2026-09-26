# Fact-check: Welcome Lounge Companion case study

**Reference page:** `case-study/` did not exist in the repository. I recreated it from the live published artifact (https://claude.ai/artifact/3gUE1YQ5nXuDvRS2EMyfow, version `1790370089-ef47`): `index.html` plus the 7 images it references. I removed the artifact service's wrapper lines. All line references to the page below point to that original.

**Codebase checked:** commit `772d693` (main).
**Test suite:** `npm test` → **105 tests, 105 pass, 0 fail** (2026-09-26, before the app fix). After the step-link fix: **108 tests, 108 pass, 0 fail**; the page now says 108 (Changed #14).

Statuses: VERIFIED · WRONG · PARTLY · NOT FOUND · NOT CHECKABLE.

## Claims

| # | Section | Text (short) | Status | Evidence | Action taken |
|---|---|---|---|---|---|
| 1 | Header · lede | Tutor in the Welcome Lounge; saw where information and coordination broke down | NOT CHECKABLE | — | None |
| 2 | Header · Role | Sole UX engineer (research, design, front and back end); also a tutor | NOT CHECKABLE | Git shows one human author (68 commits); roles and research can't be seen in code | None |
| 3 | Header · Context | International Office Welcome Lounge, Winter Semester 2026/27 | VERIFIED | documentation/semester-handover.md:14 (`Welcome.Lounge_WiSe2026_27`) | None |
| 4 | Header · Timeline | July – September 2026 | VERIFIED | git: 4aa5607 (2026-07-24) … 772d693 (2026-09-25) | None |
| 5 | Header · Status | Operational pilot | VERIFIED | README.md ("operational pilot") | None |
| 6 | Header · Status | Effect on users not yet measured | NOT CHECKABLE | No measurement code or data in the repo | None |
| 7 | Hero · alt text (dashboard) | Magenta badge, sidebar, four cards, Needs attention, Latest handover, On duty, Events split into Today / Coming up | VERIFIED | img/dashboard-1440.png | None |
| 8 | Hero · alt text (journey) | "Your first steps", numbered circles, Health insurance outlined as next step | VERIFIED | img/journey-390.png | None |
| 9 | Hero · caption | Tutors coordinate in the dark staff workspace | VERIFIED | Black header and sidebar in the screenshots | None |
| 10 | Hero · caption (also 03 row 1, diagram, 08) | "ten first steps" | PARTLY | Step count = active "First Step" rows in the workbook (server/excel/unifiedWorkbook.js:359-360). Bundled sample: 10 active of 12 (content/app-content/onboarding.json). Live workbook not checkable | Kept: your decision (the number can vary with the workbook) |
| 11 | Hero · caption | Students use it without an account | VERIFIED | No student auth; public `/api/content` only; src/hooks/useProgress.js | None |
| 12 | In short · Problem | Information spread across pages, PDFs, WhatsApp; tutors used separate sheets and chats | NOT CHECKABLE | Fragmentation is partly documented (documentation/research-findings.md "Information fragmentation"); the rest is observation | None |
| 13 | In short · What I did | Worked from own shifts and survey, then requirements, design and build | NOT CHECKABLE | — | None |
| 14 | In short · Strongest proof | Link text "evidence-to-decision rows" | VERIFIED (wording only) | Column header is "Design response" (index.html:377) | Changed (B2) |
| 15 | In short · Strongest proof | Two production failures traced and fixed | VERIFIED (fixes) | 6247c67, be3d70d. Incident history itself not in repo | None |
| 16 | In short · Status | Operational pilot; built and tested; effect not measured | VERIFIED / duplicate | Repeats #5, #6 and section 08 | Removed (B4); restored on your decision after publishing, because the summary box is meant to repeat the key facts for skimmers (see Post-publish changes, A) |
| 17 | 01 | Arrival list: insurance, room, semester fee, enrolment, city registration, bank account, residence permit | VERIFIED | content/app-content/onboarding.json topic IDs | None |
| 18 | 01 | The university publishes it across many pages, PDFs and a WhatsApp group | NOT CHECKABLE | — | None |
| 19 | 01 | Tutors keep their work in an Excel file, a shift sheet and chat | NOT CHECKABLE | — | None |
| 20 | 01 · Students card | Often before they arrive | NOT CHECKABLE | — | None |
| 21 | 01 · Students card | Constraint: no account, no tracking | VERIFIED | No analytics dependency or calls (package.json; grep of src/ and index.html); progress in localStorage (src/hooks/useProgress.js) | None |
| 22 | 01 · Team card | Tutors, coordinators and admins | VERIFIED | server/staff/auth.js:8 (ROLE_RANK) | None |
| 23 | 01 · Team card | Needs and constraints (spreadsheet speed, attribution, handover without a developer) | NOT CHECKABLE | Consistent with research-findings.md "Design implications" | None |
| 24 | 02 | Project started from own shifts; checked with other tutors | NOT CHECKABLE | — | None |
| 25 | 02 · Sources | Own observation from July 2026 | NOT CHECKABLE | — | None |
| 26 | 02 · Sources | Tutor survey, September 2026, four responses | VERIFIED | documentation/research-findings.md:3-7; decisions.md D23 | None |
| 27 | 02 · Sources | Survey sent once the first version was running; confirmed some decisions and reordered others | NOT CHECKABLE | — | None |
| 28 | 02 · Sources | Requests during the pilot, later also via the in-app Feedback button | NOT CHECKABLE (requests) / VERIFIED (button) | src/staff/FeedbackButton.jsx; server/staff/unifiedRepository.js:517 | None |
| 29 | 02 · Evidence box | Directional, not representative | VERIFIED | research-findings.md:9; decisions.md D23 | None |
| 30 | 03 · Row 1 Observed | Same arrival questions many times a day; students don't know where to look | NOT CHECKABLE | Survey themes are documented (research-findings.md "Repeated questions", "Information fragmentation"); "many times a day" is observation | None |
| 31 | 03 · Row 1 Problem / Requirement | Official answers spread out; student reaches next step and source without an account | NOT CHECKABLE | — | None |
| 32 | 03 · Row 1 Design response | One ordered journey | VERIFIED | unifiedWorkbook.js:360 (sorted by Order) | None |
| 33 | 03 · Row 1 Design response (also diagram) | "Each step links to the university page" | PARTLY → fixed in app | A step shows a link only if its ID has an entry in `topicMappings` (src/components/OfficialSourceLink.jsx:30-34, content/app-content/sources.json). Bundled sample: 8 of 10 active steps (not `university-portals`, `program-tutors`). Workbook IDs default to title slugs (unifiedWorkbook.js:45-49, 170), so a workbook link on an unmapped ID is not shown Fixed in the app (see "Resolved decisions"): a step\'s own Link is now always shown | Text kept |
| 34 | 03 · Row 1 Design response | Progress stays in the browser | VERIFIED | src/hooks/useProgress.js (localStorage) | None |
| 35 | 03 · Row 2 Observed | Notes, shifts and handovers in separate places; information lost, duplicated or unclear | VERIFIED (survey part) / NOT CHECKABLE (own shifts) | research-findings.md "Internal continuity" | None |
| 36 | 03 · Row 2 Problem / Requirement | No shared picture; one place that records who changed what | NOT CHECKABLE | — | None |
| 37 | 03 · Row 2 Design response | Every change logged with who, when and what (old → new for shifts); shared handover feed | VERIFIED | unifiedRepository.js:109-110 (actor + timestamp), :286 (student fields), :567 (shift changes), :314 (handover) | None |
| 38 | 03 · Row 3 Observed | Tutors rated Excel, WhatsApp and shared documents easy to use | VERIFIED | research-findings.md "Existing tools" | None |
| 39 | 03 · Row 3 Problem / Requirement | Replacement risk; hand the file to the next team without a developer | NOT CHECKABLE | — | None |
| 40 | 03 · Row 3 Design response | Workbook stays source of truth; web workspace reads and writes it | VERIFIED | server/staff/store.js (paths.unified); server/content.js:41-58; decisions.md D27 | None |
| 41 | 03 · Row 4 Observed | Quote "As a tutor I should only be able to put in my own name." | NOT CHECKABLE | — | None |
| 42 | 03 · Row 4 Problem | Free-text cells let any tutor change anyone's shift | VERIFIED | Behaviour before 5fa9e09; coordinators still get free-text cells | None |
| 43 | 03 · Row 4 Requirement | Tutors change only their own shifts; coordinators keep full control | VERIFIED | unifiedRepository.js:544-555 (rule applies to role `tutor` only) | None |
| 44 | 03 · Row 4 Design response | "+ Add me" and ×, same rule on the server | VERIFIED | src/staff/WorkspacePages.jsx (tutor cell); unifiedRepository.js:544-555; test "tutors can only add or remove their own name in the shift grid" | None |
| 45 | 04 · Diagram | Students: on phones, often before arrival | NOT CHECKABLE | — | None |
| 46 | 04 · Diagram | Open, no account | VERIFIED | as #11 | None |
| 47 | 04 · Diagram | Student journey read-only; reads approved content from the workbook | VERIFIED | Only active rows are published (unifiedWorkbook.js:359); public API has no write routes | None |
| 48 | 04 · Diagram | Team signs in by role | VERIFIED | server/staff/auth.js:151; server/staff/accounts.js:10 | None |
| 49 | 04 · Diagram | Staff workspace: students, shifts, handovers, events; every change logged | VERIFIED | as #37; events :393, :409 | None |
| 50 | 04 · Diagram | Reads and writes the workbook, version-checked | VERIFIED | store.js conditional writes (If-Match); test "private storage confines paths and makes conditional writes" | None |
| 51 | 04 · Diagram | Excel / Nextcloud editor edits the workbook directly | VERIFIED | Workbook is parsed on read (server/content.js:47-50) | None |
| 52 | 04 · Diagram | One workbook in Nextcloud; content, students, shifts, staff, activity log are tabs | VERIFIED | unifiedWorkbook.js SHEETS (Settings, Content, Activity, Students, Staff, Shifts) | None |
| 53 | 04 · Diagram caption | Team can always fall back to the file | VERIFIED | Plain .xlsx in Nextcloud (store.js) | None |
| 54 | 04 · Students | Explored a home page with recommendations and event promotions, then cut it back | VERIFIED | documentation/development-log.md:113, :133; decisions.md D20 | None |
| 55 | 04 · Students | Official pages fetched server-side and cached; last good version kept | VERIFIED | server/officialSources/sourceCache.js; decisions.md D21 | None |
| 56 | 04 · Students | No student accounts, no analytics, no server-side profile | VERIFIED | as #11, #21 | None |
| 57 | 04 · Staff Q · Today | Tutors don't see the summary cards | VERIFIED | WorkspacePages.jsx:309 | None |
| 58 | 04 · Staff Q · Today | Cards "only answered questions tutors never ask" | NOT CHECKABLE | — | None |
| 59 | 04 · Staff Q | Students one row each, edited in place; fair share above the Shifts grid; Statistics for coordinators and above | VERIFIED | WorkspacePages.jsx (StudentRow, FairShareNotice, StatisticsPage with canManage) | None |
| 60 | 04 · Req 02 proof | Table behaves like a sheet; attribution needs no typing | VERIFIED | useAutosave.js; `addedBy: actor.name` in addStudent | None |
| 61 | 04 · Students alt text / caption | Columns, Added by, Date added, New student row; cells save themselves | VERIFIED | img/students-1440.png; test "'Added by' records who added a student…" | None |
| 62 | 04 · Req 04 proof paragraph | Repeats row 04 | VERIFIED / duplicate | index.html:410-412 | Removed (B4) |
| 63 | 04 · Shifts alt text | Blue note, own name with ×, + Add me, weekend rows without buttons | VERIFIED | img/tutor-shifts-1440.png; WorkspacePages.jsx:553 | None |
| 64 | 04 · Shifts caption | Grid mirrors the team's existing sheet | NOT CHECKABLE | Original team sheet not in repo | None |
| 65 | 04 · Shifts caption | Refreshes every 20 seconds | VERIFIED | WorkspacePages.jsx:840 | None |
| 66 | 04 · Statistics alt text / caption | Bars with fair-share marker; table; every tutor below fair share | VERIFIED | New img/statistics-1440.png (−8.1 h to −11.1 h, all 7 rows visible) | Screenshot recaptured (B3) |
| 67 | 04 · Formula | open days × (S1 + S2 hours) × tutors per shift ÷ tutors | VERIFIED | src/staff/statistics.js:37-51; test "fair share divides the hours of open days between the tutors" | None |
| 68 | 04 · Formula note | Weekdays plus weekend days with someone scheduled; closed days don't count | VERIFIED | statistics.js:34-36, :48 | None |
| 69 | 04 · Roles | No IT department to manage accounts | NOT CHECKABLE | — | None |
| 70 | 04 · Roles · Tutor | Students, own shifts, events, handover | VERIFIED | server/staff/api.js (routes with "read") | None |
| 71 | 04 · Roles · Coordinator | + tutor list, semester setup, statistics, change log, content, backup | VERIFIED | api.js ("admin" = coordinator and up, auth.js:88): tutors/save, schedule/setup, activity, content/*, workbook/backup. Not a full list: settings, staff list and data import are also allowed | Row extended (your decision) |
| 72 | 04 · Roles · Admin | + tutor and coordinator logins | VERIFIED | api.js:75 (mayManageLoginOf); auth.js:90 | None |
| 73 | 04 · Roles · Super Admin | Everything, including Admin logins; exactly one | VERIFIED | auth.js:92; unifiedRepository.js:475; test "'Who is working?' … one Super Admin" | None |
| 74 | 04 · Roles | Nobody can give anyone a role above their own | VERIFIED | unifiedRepository.js:470-474; test "nobody can give or edit a staff role above their own" | None |
| 75 | 04 · Roles | "I found this gap while designing the ladder" | NOT CHECKABLE | Fix in 3a266d5 | None |
| 76 | 04 · Phone alt text / caption | Tutor Today on a phone; fewer menu items | VERIFIED | img/tutor-today-390.png; src/staff/StaffLayout.jsx | None |
| 77 | 04 · Phone caption | Nothing scrolls sideways | NOT FOUND | No committed check; see Not found | None |
| 78 | 05 · Intro | Evidence said the team trusted its Excel file | VERIFIED | research-findings.md "Existing tools" | None |
| 79 | 05 · Already there | Excel file trusted; handover and one developer | VERIFIED (one human committer) / NOT CHECKABLE (trust) | git shortlog: only Sanaz Yazdanjoo | None |
| 80 | 05 · Already there | No IT department to manage accounts | NOT CHECKABLE / duplicate | Repeated in the roles paragraph | Removed (B4) |
| 81 | 05 · Decided | One workbook is source of truth; Excel and web share it; it doubles as backup and handover document | VERIFIED | as #40; backups unifiedRepository.js:79-99; documentation/semester-handover.md | None |
| 82 | 05 · Cost | Every write version-checked; "Use mine" / "Use latest" on autosaved fields | VERIFIED | store.js; src/staff/SaveStatus.jsx:10 | None |
| 83 | 05 · Cost | Hand-edited rows can be invalid (caused first failure) | VERIFIED (validation) / NOT CHECKABLE (incident) | unifiedWorkbook.js:156 | None |
| 84 | 05 · Cost | Online editor needs a save-then-close habit, "which I documented" | NOT FOUND | See Not found | Removed (your decision: you did not recognise it) |
| 85 | 05 · Offline trade-off | Nextcloud offline: tab keeps last data (sessionStorage, cleared on sign-out); everyday edits queued and replayed through conflict checks; banner with data age; clashing edits dropped and shown; admin changes need a connection | VERIFIED | src/staff/service.js:1-7, :126-159; src/staff/OfflineBanner.jsx; tests/offline.test.js; test "signing out removes the offline copy and the queue from the tab" | First pass (B1): the chain was removed and only the offline-copy, queue and admin-connection points went into the "What it cost" bullet; the banner and clashing-edit details were removed, not merged. Restored later in the "What it cost" card (see Post-publish changes, B) |
| 86 | 05 · Under the interface | Browser never talks to Nextcloud directly; Node API checks every staff request against the role | VERIFIED | No Nextcloud/WebDAV reference in src/; api.js requireActor with permission map | None |
| 87 | 05 · Tech · Interface | React and Vite, plain JavaScript | VERIFIED | package.json; no TypeScript source | None |
| 88 | 05 · Tech · Interface | "Staff edits save field by field" | PARTLY | Autosave of changed fields (src/staff/useAutosave.js:5) covers students, content, events and shift cells. Settings, staff members, tutor list and semester setup use Save buttons (src/staff/UnifiedWorkbookPages.jsx:125, :149, :163, :271) | Corrected |
| 89 | 05 · Tech · Data | WebDAV, ExcelJS, validated on every read | VERIFIED | server/nextcloud.js; package.json (exceljs); server/content.js:47 | None |
| 90 | 05 · Tech · Access | Four roles on the server; signed session cookie; CSRF protection | VERIFIED | auth.js:8, :38-45, :82-83, :109-111 | None |
| 91 | 05 · Tech · Access | Passwords salted and hashed with scrypt, never in the workbook | VERIFIED | server/staff/accounts.js:5-6, :24-26 (stored in staff-data/accounts.json); test "passwords are stored salted and hashed and verified exactly" | None |
| 92 | 05 · Tech · Runtime | Node on Vercel; daily and before-major-change backups in Nextcloud | VERIFIED | vercel.json; api/[...path].js; unifiedRepository.js:79-99 | None |
| 93 | 06 · Intro | Requests from the team; shipped usually within hours; most changes removed things | NOT CHECKABLE | — | None |
| 94 | 06 · Loop | The six quoted requests | NOT CHECKABLE | — | None |
| 95 | 06 · Loop | Check-in removed everywhere, old records readable | VERIFIED | 4370cc3; unifiedWorkbook.js:238 (Check-in activity still parsed) | None |
| 96 | 06 · Loop | Inline editing with autosave and short headers | VERIFIED | WorkspacePages.jsx (STUDENT_COLUMNS `short`); useAutosave.js | None |
| 97 | 06 · Loop | Tables fit their container, cards on narrow screens | VERIFIED | src/index.css (card layouts below 1100 / 1000 / 700 px) | None |
| 98 | 06 · Loop | Red fair-share box became a blue note | VERIFIED | cf0280f | None |
| 99 | 06 · Loop | Read-only "Added by", back-filled from activity history | VERIFIED | unifiedWorkbook.js:261; test "'Added by' records who added a student…" | None |
| 100 | 06 · Loop | "A Feedback button on every page" | PARTLY | Rendered only in the staff workspace shell (src/staff/StaffLayout.jsx:214), not on the student site or sign-in | Corrected |
| 101 | 06 · Loop | Feedback lands in the change log with name and page | VERIFIED | unifiedRepository.js:517; test "feedback from the workspace is saved as an attributed Feedback activity" | None |
| 102 | 06 · Feedback alt text | Choices "Suggestion, Problem or error, and Other" | WRONG (label) | Screenshot label is "Problem / error" (img/feedback-1280.png) | Corrected (C) |
| 103 | 06 · Feedback caption | One click, three choices, one message; name and page sent | VERIFIED | FeedbackButton.jsx; screenshot | None |
| 104 | 07 · Incident 1 | Invalid Section value failed validation; fell back to samples; editor lost connection | NOT CHECKABLE (incident) | Mechanisms exist: unifiedWorkbook.js:156; server/content.js:88-89 | None |
| 105 | 07 · Incident 1 fix | "server now keeps serving the last valid workbook it has loaded instead of dropping to sample steps" | PARTLY | The last valid workbook is kept only in the running instance's memory (server/content.js:31, :44-60). A fresh instance that meets an invalid file returns `invalid` and the site serves samples (:88-89). Client-side fix: 6247c67 | Corrected |
| 106 | 07 · Incident 1 fix | Admins see the exact validation message | VERIFIED | unifiedWorkbook.js:156; unifiedRepository.js:76 | None |
| 107 | 07 · Incident 2 | Super Admin sign-in crash, helper used before defined, fixed order, test added | VERIFIED (fix and test) / NOT CHECKABLE ("reproduced live", "fails on the old code") | be3d70d; test "the Super Admin can sign in through the API (username superadmin)" (tests/staff.test.js:113) | None |
| 108 | 07 · Incident 2 lesson | Every role's sign-in tested; tutor and Super Admin through the full API | VERIFIED | tests/accounts.test.js:43, :76-83 (all four roles); tests/staff.test.js:91, :113 (API) | None |
| 109 | 08 · Output | Staff workspace: Today, Students, Shifts, Handover, Events, Statistics, Change log | VERIFIED | src/App.jsx:34-53 | None |
| 110 | 08 · Output | Four roles, enforced on the server | VERIFIED | auth.js:8, :85-93 | None |
| 111 | 08 · Output | 28 written design decisions | VERIFIED | documentation/decisions.md: D01–D28 (plus 2 dated entries; log ends 2026-09-18) | None |
| 112 | 08 · Validation | 105 automated tests covering parsing, permissions, roles, conflicts, logins, statistics, offline queue | VERIFIED | `npm test` 105/105; tests/*.test.js incl. offline.test.js, statistics.test.js | Updated to 108 after the app fix (Changed #14) |
| 113 | 08 · Validation | Every page checked from 390 to 1920 px for sideways scroll | NOT FOUND | See Not found | None |
| 114 | 08 · Validation | Used by the team during the pilot; two production failures fixed | NOT CHECKABLE (use) / VERIFIED (fixes) | 6247c67, be3d70d | None |
| 115 | 08 · Validation | Accessibility basics built in; no formal audit yet | VERIFIED (basics) / NOT CHECKABLE (no audit) | aria-labels, focus styles, prefers-reduced-motion in src/index.css | None |
| 116 | 08 · Outcomes | No task-based testing; no comparison with the old workflow | NOT CHECKABLE | — | None |
| 117 | 08 · Next | Four next steps | NOT CHECKABLE (plans) | — | None |
| 118 | 09 · Reflection | Keep / Change statements | NOT CHECKABLE (opinion) | — | None |
| 119 | Lesson | "no new database" | VERIFIED | No database dependency (package.json); staff and content data live in the workbook; logins and caches are private JSON files in the same Nextcloud folder (store.js:37-50) | None |
| 120 | Lesson | "no student accounts" | VERIFIED | as #11 | None |
| 121 | Lesson | No replacement for the Excel file; rest of the lesson | VERIFIED (Excel kept) / NOT CHECKABLE (opinion) | as #40 | None |
| 122 | Footer | Student records in screenshots are synthetic | VERIFIED | Screenshots come from the synthetic fixture with injected sample data (portfolio-screenshots/CHECKLIST.md) | None |
| 123 | Footer | Tutor names appear with their agreement | NOT CHECKABLE | — | None |
| 124 | Footer | Built with AI pair programming (Claude Code); I did research, decisions and review | VERIFIED (AI) / NOT CHECKABLE (rest) | 22 commits carry "Co-Authored-By: Claude" | None |

**Counts by primary status (124 rows):** VERIFIED 83 · PARTLY 5 · WRONG 1 · NOT FOUND 3 · NOT CHECKABLE 32. Rows with a split status (e.g. "VERIFIED (fixes) / NOT CHECKABLE (incident)") are counted by their first status.

## Changed

| # | Section | Old → new | Reason | Evidence |
|---|---|---|---|---|
| 1 | In short · Strongest proof | "evidence-to-decision rows" → "rows from evidence to design response" | B2, match the column name | index.html:377 |
| 2 | In short | Status row removed | B4, duplicate of header Status and section 08. Restored later on your decision (Post-publish changes, A) | index.html:298, :616-653 |
| 3 | 04 · Req 04 proof | Paragraph "Free-text cells let anyone overwrite anyone's shift. Tutors now get “+ Add me” and ×, and the server enforces the same rule." removed | B4, duplicate of trace row 04 | index.html:410-412 |
| 4 | 05 · What was already there | Bullet "No IT department to manage accounts" removed | B4, duplicate of the roles paragraph | index.html:499 |
| 5 | 05 · What it cost | Added: "The workbook lives on a server I don't run. When it can't be reached, the tab keeps its last data until sign-out or closing and queues everyday edits for the same conflict checks later; admin changes still need a connection" | B1, one trade-off story | src/staff/service.js:1-7, :152-159 |
| 6 | 05 · Under the interface | Removed h4 "One trade-off: the workbook lives on a server I don't run", the three-step chain and the "The cost: …" note | B1, merged into #5 | — |
| 7 | 05 · Tech · Interface | "Staff edits save field by field." → "Everyday staff edits save field by field." | PARTLY → exact | useAutosave.js:5; UnifiedWorkbookPages.jsx:125, :149, :163, :271 |
| 8 | 06 · Loop | "A Feedback button on every page." → "A Feedback button on every workspace page." | PARTLY → exact | StaffLayout.jsx:214 |
| 9 | 06 · Feedback alt text | "Problem or error" → "Problem / error" | Alt text didn't match the screenshot | img/feedback-1280.png |
| 10 | 07 · Incident 1 fix | Added "(a freshly started server with nothing loaded still falls back to them)" | PARTLY → exact | server/content.js:31, :44-60, :88-89 |
| 11 | img/statistics-1440.png | Recaptured: same synthetic data and fixture (byte-identical reproduction of the old shot first), page scrolled 35 px so all 7 tutor rows show; 1440×900 at scale 1, scrollbars and Feedback hidden | B3 | Captured 2026-09-26 with local-data/browser-fixture.mjs + headless Chrome |

| 12 | 05 · What it cost | Bullet "The online editor needs a save-then-close habit, which I documented" removed | Your decision: not something you recognised; no documentation found | — |
| 13 | 04 · Roles · Coordinator | "+ tutor list, semester setup, statistics, change log, content, backup" → "+ tutor list, staff list, semester setup, settings, statistics, change log, content, data import, backup" | Your decision: the coordinator is the manager and has these rights | server/staff/api.js: settings/save, staff/save, data/import require "admin" (coordinator and up) |
| 14 | 08 · Validation | "105 automated tests" → "108 automated tests" | WRONG after the app fix (3 new tests) | `npm test`: 108 pass, 0 fail |
Not changed: B5, the lesson box ("no new database" and "no student accounts" are both accurate). No captions needed changes besides #9. The statistics caption still holds.

## Resolved decisions (2026-09-26)

1. **"Each step links to the university page"**: fixed in the app, text kept. `src/components/OfficialSourceLink.jsx` hid a step's own workbook Link when the step ID had no entry in `sources.json`. The link logic now lives in `src/services/officialLink.js` and always shows the step's own Link. Tests: `tests/official-link.test.js` (3 new). Checked in the browser: mapped steps still link as before. A step whose Link cell is empty and has no mapping still shows no link, so the sentence holds as long as every First Step row has a Link.
2. **"Ten" steps**: kept. The number can vary with the workbook.
3. **"Save-then-close habit, which I documented"**: removed. You didn't recognise it.
4. **Coordinator rights**: row extended with staff list, settings and data import.

**Follow-on correction:** after the app fix the suite has 108 tests, so the page's "105 automated tests" became wrong and now reads "108 automated tests" (Changed #14).

## Not checkable in code

Only you can confirm these:

- Your role and being a tutor on the team (#1, #2); what you saw at the desk and from when (#24, #25, #30); the "Problem", "What I did" and 01 context statements (#12, #13, #18–20, #23).
- The tutor survey details beyond what `documentation/research-findings.md` records: when it was sent and what it confirmed or reordered (#27).
- Team requests during the pilot, and all quoted requests (#28, #41, #93, #94). This includes "As a tutor I should only be able to put in my own name."
- That the grid mirrors the team's original shift sheet (#64).
- "I found this gap while designing the ladder" (#75).
- The two incidents as events: what happened, the Section typo, the editor losing its connection, reproducing the crash live, the test failing on the old code (#104, #107).
- Pilot use by the team, no formal accessibility audit, no outcome measurement, the next steps (#6, #114–117).
- Reflection and lesson opinions (#118, #121).
- Tutors' agreement to show their names (#123); your share of research, decisions and review (#124).

## Not found

| Claim | What I searched |
|---|---|
| "The online editor needs a save-then-close habit, which I documented" (#84) | grep of `documentation/` and README.md for save/close, "online editor", "document editor", OnlyOffice, Collabora, lock. The only related text is documentation/excel-database.md:11, which is about the web workspace's autosave, not the Nextcloud editor. |
| "Every page checked from 390 to 1920 px for sideways scroll" (#113) | grep of documentation/, tests/, scripts/ for 390/1920. Found only student-journey checks: development-log.md:53 (320/390 px) and :152 (375–1920 px), and operations.md:36 (a manual checklist). No committed check covers the staff pages. |
| "Nothing scrolls sideways" for the tutor phone view (#77) | Same search. The screenshot scripts checked `scrollWidth === innerWidth` but live outside the repo. |

## Post-publish changes (2026-09-26)

After the fact-checked version was published, two edits were made on the published page (version `1790416932-e577`). They are copied into `case-study/index.html` verbatim.

| | Change | Evidence | Status |
|---|---|---|---|
| A | "In short" box: the Status cell is back: "Operational pilot. Built and tested in code; effect on users not measured yet." (last phrase links to `#proven`). Restored on your decision: the summary box is meant to repeat the key facts for skimmers. | "Operational pilot": README.md:11; documentation/decisions.md:59; documentation/development-log.md:41. "Built and tested": `npm test` 108/108 pass. "Effect on users not measured yet": your own statement | VERIFIED; "not measured" is NOT CHECKABLE |
| B | "What it cost": the offline bullet is split in two, and restores the banner and clashing-edit details: "…tutors keep working from the last loaded data, with a banner showing when it was loaded. Everyday edits queue and replay through the same conflict checks." / "A queued edit that clashes with a newer change is not forced: it is dropped and shown to the tutor to enter again. The last data stays in that browser tab until sign-out or closing, and admin changes still need a connection." | Banner: src/staff/OfflineBanner.jsx:16-17 ("You're seeing the data from HH:MM"); src/staff/service.js:80 (`since: cached.at`); tests/offline.test.js:35. Clashing edit: src/staff/service.js:126, :139-142; src/staff/OfflineBanner.jsx:24 ("Not saved: … Please check and enter it again."); tests/offline.test.js:62-73 | VERIFIED |

All file:line references above were re-checked against commit `f352bf7` and are unchanged.

The save-then-close bullet ("The online editor needs a save-then-close habit, which I documented") stays removed: NOT FOUND in the repo, and you didn't recognise it.
