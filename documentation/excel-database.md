# Welcome-Lounge.xlsx: staff data and recovery

## The source of truth

When the unified workbook is enabled, `Welcome-Lounge.xlsx` in the configured Nextcloud application root is the single persistent source for human-maintained application data. The current configured root is `/Welcome.Lounge_WiSe2026_27/APP`; the workbook is stored at `<NEXTCLOUD_ROOT_FOLDER>/Welcome-Lounge.xlsx`. The browser-facing Nextcloud Files URL and its numeric file ID are not used for storage. Moving the app later requires changing the configured root and, if needed, the workbook filename only.

The web app reads and writes the workbook server-side. Staff use the staff pages for normal work; Excel remains a portable backup, handover and emergency fallback. No database service, generated JSON content store, or client-side Excel handling is part of this model. Existing `Welcome-Lounge-Content.xlsx`, `MasterExcel.xlsx`, JSON releases and `staff-data/state.json` are retained as migration inputs/fallbacks and are never deleted automatically.

## Autosave

Existing student record fields, existing student-facing content items, and fields on an existing shift save automatically. Text fields wait two seconds after the last edit; status/select fields wait about 300 ms. The page shows a small Saving/Saved/error status, and private drafts stay in page memory only. Close or navigate away only after Saved when possible; the editor attempts an immediate final write on unmount, and full page navigation warns while a draft is pending. Offline drafts are not put in browser storage and can be lost if the page is closed.

Adding a student, adding a content item, adding a shift, checking someone in, adding a handover, staff roster changes, semester changes, WhatsApp URL changes, import, backup, restore and workbook initialization remain explicit actions. A different field changed by another tutor is merged against the current workbook. If the same field changed, both values remain visible in a conflict prompt; choose Use mine or Use latest. Failed saves keep the current form draft available for Retry. Autosaves add one attributed activity row per successful field batch, not per keystroke, and reuse the daily backup rather than making a workbook copy for each save. Public workbook content is refreshed through ETag revalidation after changes; no redeployment or Publish action is needed.

The server-side filename defaults to `Welcome-Lounge.xlsx`; `NEXTCLOUD_WORKBOOK_FILE` is only needed to choose another safe basename. Once that file exists, the app detects it and uses it on the next request. While it is missing, the existing release and operational stores remain active so an admin can migrate safely. Setting the option to an empty string explicitly disables workbook detection for an emergency rollback. `.env.example` contains no credentials.

## The six tabs

- **Settings**: one `Setting | Value` table for Semester, WhatsApp Group URL, WhatsApp Enabled, Last Reviewed, and the app-managed Workbook Version. No credentials belong here.
- **Content**: one row per student-facing item: Section, Order, Title, Text, Link, Active, ID. Sections are First Step, Useful Info, Student Support, Community, and Help. The app generates IDs for new rows and keeps existing IDs stable; First Step IDs preserve browser progress.
- **Students**: private student support records, including country, study programme, phone, email and Note / Comment. Accommodation and City Registration are TRUE/FALSE checkboxes (older free-text values count as TRUE); "Contact (if no accommodation)" holds how to reach a student without housing. Enrolled, Accommodation, Contact, City registration appointment and Note are editable directly in the staff Students list. Matriculation numbers are stored as text, and app-generated IDs—not matriculation numbers—are primary identifiers. Older workbooks without the Phone and Email columns remain readable; the app adds those columns the next time a workbook update is saved.

In the staff student form, Country suggestions use a standard country-name list. Study programme suggestions include the university's published programme names and values already present in the student/tutor roster; tutors can type another value when needed. The programme suggestions are convenience values, not an authoritative validation list.
- **Activity**: private chronological check-ins, handovers, student/content updates and operational changes. The app adds rows and attributes them to the selected staff identity.
- **Staff**: names, role, programme and optional contact details used for display and attribution. Authentication secrets remain in server environment configuration.
- **Shifts**: one row per day — Date, S1 - Person 1–4, S2 - Person 1–4, Note (e.g. "Bank Holiday"). Shift times come from the Settings rows **Shift 1 Time** / **Shift 2 Time** (default 10:00–13:00 and 12:00–15:00). All staff edit the grid on the staff Schedule page; every change is logged in Activity as a "Shift Update" with the person's name and the old → new value. Workbooks with the older one-row-per-shift layout are converted automatically on the next save.
- **Tutors** (optional tab): this semester's tutors, one per row ("Tutor 1", "Tutor 2", … are renumbered on save). Add, rename or delete rows here or on the Super Admin **Tutors** page. The names are suggested in the Schedule grid and listed in Statistics. The Settings tab holds **Schedule Start** / **Schedule End** (the days shown in the Schedule) and the shift times, editable on Schedule → Semester setup. **Tutors per Shift** (1–4, default 3) feeds the fair share on Statistics: (open days × both shifts' hours × tutors per shift) ÷ number of tutors. Open days are Mon–Fri in the period plus any staffed weekend day; closed days (Note and no names) are excluded.

**Roles.** Signing in with the admin code makes you the **Super Admin**: Tutors, Statistics (hours per tutor), Change log (every change with who and when), Content and Backup. Tutor sign-ins see Today, Students, Schedule, Handover and Events; the server does not send them change history.

**Logins.** Everyone starts with the shared login: any username plus the shared tutor password (`STAFF_ACCESS_CODE`) or admin password (`STAFF_ADMIN_CODE`), then chooses their name from the Staff list. On **My account** (click your name in the header) anyone can set a personal username and password; after that their name is no longer offered on the shared login. Personal passwords are stored salted and scrypt-hashed in `staff-data/accounts.json` in the app folder — never in the workbook. The Super Admin can reset a personal login from Content → Staff; every set/change/reset is logged. Student check-in has been removed; older "Check-in" rows in the Activity tab remain readable.
- **Events** (optional seventh tab): Title, Date, Start, End, Location, Description, Link, Active, ID. Active rows dated today or later appear on the student Events page. Dates may be Excel dates or `YYYY-MM-DD`; times may be Excel times or `14:00`; Start/End are optional, but End needs a Start. All staff (tutors and coordinators) edit events on the staff **Events** page (autosave) or directly in the tab. Workbooks without the tab stay valid; the app adds it on the next save, and until then the Events page keeps its previous source.

Normal staff should use the staff web interface. Direct Excel editing is a fallback: keep sheet names and headings unchanged, preserve IDs, and save the file in Nextcloud. The app reads the latest ETag before a mutation. Stale browser forms receive a plain-language conflict and must be reloaded; conditional `If-Match` writes prevent silent last-writer-wins updates. Whether the university Nextcloud deployment enforces these WebDAV preconditions is an operational acceptance check; automated tests verify that the conditions are sent and that conflicts are surfaced, not the live university server behavior.

## First setup

Prepare the operational workbook using the documented six-sheet structure, save it with the exact filename `Welcome-Lounge.xlsx`, and upload it to the root of the configured Nextcloud app folder. Do not put it in `content-source/`: `content-source/Welcome-Lounge-Content.xlsx` is a separate public-content source. After uploading, open Staff → Content and select **Refresh workbook status**. When the workbook is available, the app reads and updates it directly. The app does not infer the semester from the folder name.

The coordinator setup page does not create, import, or download operational workbooks. This avoids accidental initialization from the wrong source; existing files remain untouched until the prepared workbook is uploaded.

## Public/private boundary

Anonymous student APIs receive only the safe Settings subset and active Content rows normalized into the existing Journey, Info, Help and support schemas. Students, Activity, Staff, Shifts, workbook bytes, backups and private operational notes are never included. Official university sync, event/RSS feeds and browser-only student progress remain separate systems.

When the configured workbook is unavailable or invalid, the public app uses only its bundled labelled fallback and does not silently expose a stale legacy release. The server retains a process-local last-known-good parsed workbook during that instance's lifetime. This cache is not a second editable store and is not durable across serverless instances.

## Backups and recovery

Before the first ordinary change of each Berlin calendar day, the app saves a daily workbook copy under `backups/daily/`; major content, settings, roster or shift changes get a separate pre-change snapshot under `backups/manual/`. Admins can create an additional backup and download the current workbook. Backups are private under the configured app root. The UI does not yet select and restore an arbitrary backup. Recovery is: download the desired backup, ask the coordinator to verify it, then restore it through the approved Nextcloud process while the app is in maintenance. Keep the current workbook copy first; after replacement, reload the staff app and verify the semester and records. Do not assume Nextcloud version history is enabled unless the university confirms it.

## MasterExcel compatibility

MasterExcel remains a one-time/bulk import and export compatibility format, not a second live data source. Admins preview and explicitly commit an import; it merges students by matriculation number where possible and imports the legacy programme tutor/shift structure. The unified workbook export is the full portable current format. A MasterExcel export may omit workbook-only activity history and should not be treated as a complete backup.
