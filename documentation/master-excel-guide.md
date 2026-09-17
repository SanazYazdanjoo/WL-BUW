# MasterExcel guide

MasterExcel is an **import/export format**, not the runtime database. Never put it in `documents/` or `app-content/`. The default source is `staff-data/MasterExcel.xlsx`, relative to the configured application root. No real workbook or personal fixture is committed; local copies belong in ignored `local-data/` or `*.local.xlsx`.

Required sheets: `Students_List`, `Program_Tutors`, `Welcome_Lounge_Shifts`, `Shifts_Summary`.

Students columns: date, Full name, Matr-no., Country, Study Program, Enrolled, Accomodation, Address, Received Backpack, City registration appointment, Notes. False-only template rows are ignored. Unknown booleans remain unknown. Numeric matriculation values become strings; leading zeros are retained when Excel stores them as text. Zeros already lost in numeric cells cannot be reconstructed. Notes are preserved without interpretation. The legacy date is not treated as an expected arrival date or a check-in.

Program tutors: Program, Tutor, Email, Phone number, Telegram ID. Duplicate program rows are flagged for review, not silently removed. `?` displays as Not assigned. Phone values are strings.

Shifts: date, three first-shift tutor columns, three second-shift tutor columns, event text. First shift is 10:00–13:00; second is 12:00–15:00. Excel dates and ISO date strings with a trailing weekday are supported. Multiline events remain intact. The broken summary sheet is not trusted; totals are derived from shift assignments.

## Import

1. Edit/upload the private workbook in Nextcloud.
2. Sign in as coordinator; open `/staff/data` and preview.
3. Review counts, warnings and imported rows. Supply the operational semester.
4. Confirm the reviewed import. Changed source/state requires a fresh preview.

The first import assigns opaque `stu_UUID` IDs. Subsequent same-semester imports match by matriculation number, or exact name + program when there is no matriculation number. Imported fields replace matching source fields, including notes/status; review carefully to avoid replacing newer operational changes with an old workbook. Unmatched current students remain. Duplicate/ambiguous source identities are rejected. Use the exported current workbook as the starting point for later bulk edits.

New semester explicitly backs up the current aggregate and starts fresh with the imported records. It resets check-ins/handover/audit in the new active aggregate; prior data stays in the private backup. This does not change the public semester; coordinate public workbook publication separately.

## Storage and export

Runtime state is `staff-data/state.json`, containing students, tutors, shifts, separate check-ins, separate handover entries and audit metadata. Every save uses ETag/If-Match; new files use If-None-Match. A conflict asks the tutor to reload. This small-pilot aggregate intentionally prioritizes simple atomic saves over high write concurrency. Limits: 1,000 imported students and 8 MB total state. It is not a high-volume database.

`/staff/data` exports a fresh familiar four-sheet workbook. Check-ins, handover and audit remain in the structured state and its backups; the four-sheet export is not a complete operational backup. Back up the whole private subtree for institutional handover. No browser localStorage contains staff records.

The actual MasterExcel layout and live Nextcloud conditional writes still need validation with the institution's files and account permissions before real use.
