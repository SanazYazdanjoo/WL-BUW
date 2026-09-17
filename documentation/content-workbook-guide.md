# Editorial workbook guide

The coordinator workflow is **edit workbook → upload to Nextcloud → preview → review → publish**. Normal text changes do not require a rebuild. The application never publishes automatically.

## Setup

Place `Welcome Lounge First Steps and some other informations.xlsx` in `content-source/`, relative to `NEXTCLOUD_ROOT_FOLDER`. Keep this folder private. Configure server-only staff access as described in [Staff operations](staff-operations-guide.md). Open **Semester setup** (`/staff/content`) with the coordinator code. Review current semester, publication time, WhatsApp readiness, MasterExcel import, shift data and official-source status. Configure the semester/contact fields before publication.

Required sheet names (case-insensitive): `first steps`, `Krankenversicherungen`, `student portal Links`, `Rundfunkbeitrag`.

**Real workbook validation remains pending:** no actual source workbook was available locally during implementation. The parser is tested with synthetic workbooks. Always inspect the preview against every source sheet before first use; an unrecognized layout must be adapted and tested before publishing. No administrative policy has been invented or independently corrected.

## Supported layout

- First steps: an English semester label, numbered rows (number in column A or B), instruction text and a REQUIRED DOCUMENTS column (D when no heading is detected). Optional Title/Instruction headings are recognized. Original instruction paragraphs are preserved; an absent title uses a short display label derived from the text. Stable IDs use `first-step-01`, etc. The number of steps is data-driven. Blank rows are ignored. Duplicate numbers and empty instructions are rejected; number gaps are flagged. Keep numbers stable within a semester. The bundled twelve-step demo fallback orders Health insurance, Accommodation, City registration, Bank account, Semester contribution, Enrollment & student ID, Residence permit, Deutschlandsemesterticket, Meetup with Program Tutors, Campus & departments, Welcome events, then Language courses. Some topic details originated in the supplied Welcome Lounge PDF; Summer Semester 2026 references are excluded. PDF-derived content is labelled demo and must be reviewed against current official sources. A reviewed workbook publication becomes authoritative and replaces the fallback order; preview and publish the updated workbook to change the live public journey.
- Insurance: Provider/Name, Address and weekday heading columns, or constrained provider/address/hour blocks. Incomplete hours generate review warnings. No provider is recommended by the application.
- Portals: labels and actual Excel hyperlinks or http/https URL cells. Unsafe links are rejected. Descriptions are retained.
- Rundfunkbeitrag: numbered or bold headings followed by paragraphs. Original text is retained; formulas are not evaluated.

Limits: 10 MB compressed workbook, 60 MB expanded ZIP, 500 archive entries, 20 sheets, 10,000 rows per sheet and 60 columns. Individual text fields are bounded. Encrypted and ZIP64 workbooks are rejected. Formula cells use only saved results; export recalculates shift totals independently.

## Review and publication

Choose **Preview content update** to see the source and current semester, counts, warnings and expandable before/after changes. Review the full source text, required items, links and all warnings. Any mismatch among configured, public and operational semester labels is a review signal; nothing is auto-corrected. A workbook semester mismatch requires explicit confirmation. Reordered/reused numbers need a new progress revision; new-semester numbered steps require it. Cancel changes nothing.

Confirming re-reads the workbook and published content and checks a signed, expiring preview proof. Changed sources or content require a new preview. A private backup is saved first, then a single conditional PUT writes `app-content/published.json`. That release contains all validated public collections, so one publication cannot leave partially written sheets. No existing workbook is moved or deleted. A failed publication can leave an extra harmless backup.

Public JSON collections: config, onboarding, events, after-arrival, health-insurance, useful-links, rundfunk. Before the first release, the existing separate JSON files are supported. After a release exists it takes precedence; editing a legacy JSON file no longer changes the public site. Events and after-arrival are retained during workbook publication; their dedicated editing UI remains future work.

Required items (passport/photo/etc.) are text, not downloadable file paths. The importer grants no document access. Existing approved download references continue through the restricted document API; do not infer filenames from workbook text. Imported steps currently have no automatic document mapping.

## Printing and recovery

`/staff/print` renders first steps, insurer directory, portals, Rundfunkbeitrag or a full packet from the same published normalized data used by the public pages. Use browser Print / Save as PDF, A4. Screen controls and navigation are hidden in print. Check the preview before distributing.

Backups live in private `content-backups/`. A university maintainer can restore a previous release from a backup with Nextcloud/version history; recovery is currently manual, not a staff restore button. Retention/cleanup is a coordinator decision; nothing is automatically deleted.
