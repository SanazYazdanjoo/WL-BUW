# Semester handover

This is the short operational handover for a colleague who maintains the student service without editing application code.

## Public student content

Edit the private Nextcloud workbook `content-source/Welcome-Lounge-Content.xlsx`. Use stable IDs, update active rows and review dates, and keep student data out of it. Then open **Staff → Content**, preview the update, review every change and warning, and publish. Saving the workbook does not itself change the student site. The publish operation saves a timestamped private backup and updates the runtime release in Nextcloud; it does not require GitHub or a Vercel deployment.

If the workbook does not exist, use **Download a clean workbook template** in Staff → Content and upload the downloaded file to the specified private folder. Never replace an existing workbook without a recoverable copy.

## Current Nextcloud location (temporary)

- Host: `https://nextcloud.uni-weimar.de`
- Root folder: `/Welcome.Lounge_WiSe2026_27/APP`
- Browser UI shortcut: optionally set `NEXTCLOUD_BROWSER_URL` to the current Nextcloud Files page. Its numeric file ID is not a WebDAV identifier.

The root and host are environment configuration, not app code. If the folder moves to a permanent International Office location, copy the app-owned structure and set `NEXTCLOUD_ROOT_FOLDER` to the new path; update the optional browser shortcut if used. Use an institutional service account with least necessary access. Configure credentials only in Vercel Environment Variables or local server-only `.env.local`; never put them in the workbook or source control.

## What lives under the root

`content-source/` holds the private editorial workbook. `app-content/published.json` is the generated current release consumed by the student API; it is not staff-edited. `content-backups/` contains prior releases and source copies. `content-meta/` contains private publish history and the last-seen workbook status. `staff-data/` contains the private MasterExcel source, operational state and internal backups. `official-source-cache/` contains automatically refreshed official-source and RSS cache files. `documents/` is the only student-download area, and a download also requires an exact reference in an active, non-demo topic.

All backend storage paths are relative to the configured root. Public APIs do not list or expose the private areas. Missing application directories are created when a permitted write first needs them; no existing files are moved, renamed or deleted automatically.

## Automatic information

Official university sources and Welcome Events / RSS refresh stay separate from the content workbook. Review their status in Staff → Sources. Do not edit cache files. When a source cannot be checked, the application retains last-known-good data and shows the appropriate unavailable/stale state rather than claiming a fresh verification.

## Private staff operations and MasterExcel

Use the staff interface for check-ins, student updates and handover. The current pilot persists structured private operational data in Nextcloud with conditional ETag writes; a conflicting simultaneous change is rejected for reload instead of silently overwriting another tutor. MasterExcel remains the familiar import/export/backup/handover format and is not rewritten after each tutor action. The current pilot uses a bounded `staff-data/state.json` aggregate, so highly concurrent simultaneous editing is a known scaling limitation; before wider use, move to independently written private record/event files while keeping the same staff interface and MasterExcel import/export. No separate database service is configured.

An exported MasterExcel file is not a complete backup of check-ins, handover and audit history. Keep Nextcloud operational backups as well. Do not expose or email raw private structured files.

## If something fails

Students retain labelled local fallback content if Nextcloud content is missing or invalid. A missing workbook is reported in Staff → Content; download the template, upload it to `content-source/`, then preview. A failed/changed preview should be run again before publish. To recover a bad publication, use **Restore** beside the earlier entry in **Previous publications**. If Nextcloud is unavailable, wait and retry; do not edit generated runtime files as a workaround. For code/deployment issues, use the repository README and existing GitHub → Vercel workflow.

The pilot's staff authentication is shared-code based and must not be mistaken for permanent institutional identity management. Confirm long-term staff roles, service-account ownership, access revocation, retention and privacy arrangements before institutional handover.
