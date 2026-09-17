# Staff operations guide

## Enable the pilot

Use the existing Vercel project's Environment Variables, or `.env.local` for local development. Never use `VITE_` for credentials.

- `STAFF_PILOT_ENABLED=true` (default false)
- `STAFF_ACCESS_CODE`: independently generated random tutor code, at least 20 characters
- `STAFF_ADMIN_CODE`: different random coordinator code, at least 20 characters
- `STAFF_SESSION_SECRET`: independently generated random secret, at least 32 characters
- Existing NEXTCLOUD_USERNAME, NEXTCLOUD_APP_PASSWORD, NEXTCLOUD_ROOT_FOLDER
- Optional STAFF_DATA_DIR, CONTENT_SOURCE_DIR, CONTENT_BACKUP_DIR (three distinct single folder names, defaults staff-data/content-source/content-backups)
- Optional STAFF_MASTER_WORKBOOK and CONTENT_SOURCE_WORKBOOK paths, confined to their corresponding private folders

The Nextcloud account needs read/write permissions in the application folders, including MKCOL and conditional PUT support. Public visitors cannot read private folders through the API. Do not make these folders public via separate Nextcloud shares. Changing the application root remains a single server environment setting.

## Authentication limits

This is explicitly **pilot-only shared-code authentication**, not institutional identity verification. Tutors enter their own name; the session signs it but cannot verify who typed it. Actions record that name, server-assigned session actor ID, role and server timestamp. Do not present this as verified personal accountability. Move to institutional authentication before permanent operation.

Sessions expire after eight hours. Cookies are HttpOnly, SameSite=Lax, Secure on Vercel/production. Writes require same-origin plus a session CSRF token. Tutor/coordinator permissions are enforced on the server, not only hidden in navigation. Staff API responses are private/no-store. Sign out on shared machines. Rotate the session secret to invalidate all sessions; changing a code alone does not revoke existing cookies. Disable STAFF_PILOT_ENABLED to shut off access.

Login has only best-effort per-instance throttling. Serverless instances do not share counters; high-entropy codes are essential. No new external authentication/rate-limit vendor has been introduced.

## Daily workflow

- `/staff/dashboard`: today's Berlin-local shifts/events, check-in count, incomplete/unknown enrollment/backpack statuses, latest handover.
- `/staff/students`: search by name/matriculation number and filter statuses. Addresses and long notes appear only in details.
- `/staff/students/:opaqueId`: update permitted operational fields, check in once per student per day. Check-in is a separate record; it does not overwrite the imported date.
- `/staff/shifts`, `/staff/program-tutors`: schedules and contacts; calculated shift summary.
- `/staff/handover`: add an attributed note for the next shift.
- `/staff/reports`: daily check-ins/handover on screen, count-only CSV download. No email is sent.
- Coordinator only: `/staff/data`, `/staff/content`, `/staff/print`.

Audit entries include changed field names, actor and timestamp; they do not duplicate sensitive field values. They are stored with private state, not sent to public logs. A staff audit-view screen is not yet implemented.

If a save conflicts, copy any unsaved text somewhere approved, reload the latest record and review before saving again. Do not keep retrying an old version. If Nextcloud is unavailable, no success is claimed and nothing is queued in browser storage.

## Deployment and handover

Keep GitHub → existing Vercel automatic deployment. No new project, CI provider or protection-setting change is required by this implementation. Test real sign-in, read/write, backup, export and document downloads after configuring environment values. Source workbook shape and live conditional-write support were not verified during implementation because the real workbooks/account setup were unavailable.

Set an institutional retention policy for private state/backups and obtain an institutional service account before handover. The app performs no automatic deletion. Preserve Nextcloud permissions, source workbooks, release/state files and backups. Do not copy credentials into documentation.
