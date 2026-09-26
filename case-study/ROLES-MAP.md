# Where the Coordinator features live

Checked against commit `a241510` (2026-09-26). This covers the Coordinator row of the case study's roles table ("+ tutor list, staff list, semester setup, settings, statistics, change log, content, data import, backup").

"Coordinator+" means Coordinator, Admin and Super Admin. The server check `"admin"` means Coordinator and up ([server/staff/auth.js:88](../server/staff/auth.js#L88)). The sidebar's **Management** section ([src/staff/StaffLayout.jsx:191-199](../src/staff/StaffLayout.jsx#L191-L199)) is shown only to Coordinator+ and contains Tutors, Statistics, Change log, Content and Backup, in that order, for every role that sees it.

| Feature | Where it is in the UI | Roles that can see it | Client check | Server check |
|---|---|---|---|---|
| tutor list | Sidebar → **Tutors** (`/staff/tutor-list`) | Coordinator+ | src/staff/WorkspacePages.jsx:668 | `tutors/save` → `"admin"`, server/staff/api.js:156 |
| staff list | Sidebar → **Content** → **Staff** section (collapsible) | Coordinator+ | Sidebar only; the page has no role check of its own | `staff/save` → `"admin"`, server/staff/api.js:145; role ceiling server/staff/unifiedRepository.js:470-474 |
| semester setup | Sidebar → **Shifts** → **Semester setup** section (collapsible) | Coordinator+ | src/staff/WorkspacePages.jsx:864 | `schedule/setup` → `"admin"`, server/staff/api.js:155 |
| settings | Sidebar → **Content** → **Semester and support** section (collapsible) | Coordinator+ | Sidebar only | `settings/save` → `"admin"`, server/staff/api.js:153 |
| statistics | Sidebar → **Statistics** (`/staff/statistics`) | Coordinator+ | src/staff/WorkspacePages.jsx:890 | None of its own: computed in the browser from `workspace` data, which every signed-in role can read (server/staff/api.js:128) |
| change log | Sidebar → **Change log** (`/staff/activity`) | Coordinator+ | src/staff/WorkspacePages.jsx:762 | `activity` → `"admin"`, server/staff/api.js:131 |
| content | Sidebar → **Content** → **Student content** (`/staff/content`) | Coordinator+ | Sidebar only | `content` → `"admin"`, server/staff/api.js:129; `content/*` writes, :141-149 |
| data import | **No menu link.** Route `/staff/data`, page title "Import & export staff data". The only link to it is on that same page (src/staff/CoordinatorPages.jsx:111, rendered at :256), so it is reachable only by typing the URL | Coordinator+ (by URL) | src/staff/CoordinatorPages.jsx:175 | `data/preview`, `data/import` → `"admin"`, server/staff/api.js:139-140 |
| backup | Sidebar → **Backup** (`/staff/backup`); also Content → **Workbook** section → "Create backup" | Coordinator+ | Sidebar only | `workbook/backup` → `"admin"`, server/staff/api.js:160; `workbook/status`, :253-254 |

For comparison, the Admin row's logins live in Sidebar → **Tutors** → **Logins** section, for Admin and Super Admin (src/staff/WorkspacePages.jsx:699; `accounts` → `"logins"`, server/staff/api.js:133, auth.js:90).

**Notes**
- No permission in the case study's roles table disagrees with the code.
- The table's names don't all match UI labels (e.g. "semester setup" is on the Shifts page, "staff list" and "settings" are sections of Content, and "data import" has no menu entry). By your decision the table cell stays as written; this file records where each one actually is.
