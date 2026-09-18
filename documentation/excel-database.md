# Welcome-Lounge.xlsx: staff data and recovery

## The source of truth

When the unified workbook is enabled, `Welcome-Lounge.xlsx` in the configured Nextcloud application root is the single persistent source for human-maintained application data. The current configured root is `/Welcome.Lounge_WiSe2026_27/APP`; the workbook is stored at `<NEXTCLOUD_ROOT_FOLDER>/Welcome-Lounge.xlsx`. The browser-facing Nextcloud Files URL and its numeric file ID are not used for storage. Moving the app later requires changing the configured root and, if needed, the workbook filename only.

The web app reads and writes the workbook server-side. Staff use the staff pages for normal work; Excel remains a portable backup, handover and emergency fallback. No database service, generated JSON content store, or client-side Excel handling is part of this model. Existing `Welcome-Lounge-Content.xlsx`, `MasterExcel.xlsx`, JSON releases and `staff-data/state.json` are retained as migration inputs/fallbacks and are never deleted automatically.

The server-side filename defaults to `Welcome-Lounge.xlsx`; `NEXTCLOUD_WORKBOOK_FILE` is only needed to choose another safe basename. Once that file exists, the app detects it and uses it on the next request. While it is missing, the existing release and operational stores remain active so an admin can migrate safely. Setting the option to an empty string explicitly disables workbook detection for an emergency rollback. `.env.example` contains no credentials.

## The six tabs

- **Settings**: one `Setting | Value` table for Semester, WhatsApp Group URL, WhatsApp Enabled, Last Reviewed, and the app-managed Workbook Version. No credentials belong here.
- **Content**: one row per student-facing item: Section, Order, Title, Text, Link, Active, ID. Sections are First Step, Useful Info, Student Support, Community, and Help. The app generates IDs for new rows and keeps existing IDs stable; First Step IDs preserve browser progress.
- **Students**: private student support records. Matriculation numbers are stored as text, and app-generated IDs—not matriculation numbers—are primary identifiers.
- **Activity**: private chronological check-ins, handovers, student/content updates and operational changes. The app adds rows and attributes them to the selected staff identity.
- **Staff**: names, role, programme and optional contact details used for display and attribution. Authentication secrets remain in server environment configuration.
- **Shifts**: shift date/time, up to three tutors, event and notes. Summaries are calculated from rows; no formula sheet is used.

Normal staff should use the staff web interface. Direct Excel editing is a fallback: keep sheet names and headings unchanged, preserve IDs, and save the file in Nextcloud. The app reads the latest ETag before a mutation. Stale browser forms receive a plain-language conflict and must be reloaded; conditional `If-Match` writes prevent silent last-writer-wins updates. Whether the university Nextcloud deployment enforces these WebDAV preconditions is an operational acceptance check; automated tests verify that the conditions are sent and that conflicts are surfaced, not the live university server behavior.

## Migration and first setup

In Staff → Content, a coordinator can initialize `Welcome-Lounge.xlsx` from existing private state, the previous content workbook, published content, and MasterExcel when present. The server validates sources before writing and creates the target only if it does not already exist. A stale or invalid source stops migration with an actionable error. Existing files remain untouched. If no current semester can be derived, enter the semester in the setup form; the app does not infer it from the root-folder name.

The generated local template is available with `npm run workbook:template` at `templates/Welcome-Lounge-Template.xlsx`. It contains exactly the six tabs, inactive fictional content rows, dropdowns, filters and no real student data. Set the semester before using it as an application workbook.

## Public/private boundary

Anonymous student APIs receive only the safe Settings subset and active Content rows normalized into the existing Journey, Info, Help and support schemas. Students, Activity, Staff, Shifts, workbook bytes, backups and private operational notes are never included. Official university sync, event/RSS feeds and browser-only student progress remain separate systems.

When the configured workbook is unavailable or invalid, the public app uses only its bundled labelled fallback and does not silently expose a stale legacy release. The server retains a process-local last-known-good parsed workbook during that instance's lifetime. This cache is not a second editable store and is not durable across serverless instances.

## Backups and recovery

Before the first ordinary change of each Berlin calendar day, the app saves a daily workbook copy under `backups/daily/`; major content, settings, roster or shift changes get a separate pre-change snapshot under `backups/manual/`. Admins can create an additional backup and download the current workbook. Backups are private under the configured app root. The UI does not yet select and restore an arbitrary backup. Recovery is: download the desired backup, ask the coordinator to verify it, then restore it through the approved Nextcloud process while the app is in maintenance. Keep the current workbook copy first; after replacement, reload the staff app and verify the semester and records. Do not assume Nextcloud version history is enabled unless the university confirms it.

## MasterExcel compatibility

MasterExcel remains a one-time/bulk import and export compatibility format, not a second live data source. Admins preview and explicitly commit an import; it merges students by matriculation number where possible and imports the legacy programme tutor/shift structure. The unified workbook export is the full portable current format. A MasterExcel export may omit workbook-only activity history and should not be treated as a complete backup.
