# Public content workbook

The Welcome Lounge Content Workbook is the human-editable source of truth for semester-specific public content. Nextcloud is the persistent storage platform. The application generates a validated runtime release from the workbook; staff do not edit generated JSON. Content changes do not require a Git commit or Vercel redeployment.

## Current storage location

The current temporary Nextcloud host is `https://nextcloud.uni-weimar.de`; the current application root is `/Welcome.Lounge_WiSe2026_27/APP`. The human-facing browser link may be configured separately with `NEXTCLOUD_BROWSER_URL`. Its `/apps/files/...` route and numeric UI file ID are only for staff navigating in a browser. WebDAV uses `NEXTCLOUD_BASE_URL`, `NEXTCLOUD_ROOT_FOLDER`, the server-only account credentials, and paths relative to the root. No backend operation uses the browser URL or its file ID.

This location may later move to an International Office-owned folder such as `/Welcome-Lounge-App`. Copy the application-owned folder structure through the approved Nextcloud process, then change `NEXTCLOUD_ROOT_FOLDER` (and optionally `NEXTCLOUD_BROWSER_URL`) in the Vercel environment. Changing only the root setting requires no application code change. Do not move or modify files outside the configured `APP` folder automatically. Use an institutional service account for permanent operation; no personal username or password belongs in the repository.

## Normal semester workflow

1. Download the safe workbook template from the admin-only **Staff → Content** page if the source workbook has not yet been set up.
2. Upload it to the private `content-source/` folder under the application root, named `Welcome-Lounge-Content.xlsx`. Do not overwrite an existing workbook without first making a copy in Nextcloud.
3. Edit and save the workbook in Nextcloud. Keep existing IDs stable. Do not put student personal information or private tutor notes in this workbook.
4. In **Staff → Content**, choose **Preview update**. Review the workbook timestamp, active item counts, warnings, semester, WhatsApp state, and item-by-item changes.
5. Confirm the review and publish. The server rereads the workbook, checks that it still matches the preview, validates again, stores a private backup, then conditionally updates the published release. Students receive the new content from the Nextcloud-backed runtime API on their next load; no deployment is needed.

Only an authenticated admin can preview or publish. A changed workbook or published release invalidates the signed, short-lived preview proof. A semester mismatch requires explicit confirmation; changing the semester while reusing numbered `first-step-*` IDs also requires a progress revision reset so old browser progress is not attached to a different step.

## Workbook sheets

The generated template contains the seven required sheets: **Instructions**, **Semester Settings**, **First Steps**, **Useful Information**, **Student Support**, **Community**, and **Official Links**. Data sheets have fixed headers, filters, frozen heading rows, basic dropdowns and clearly inactive `SAMPLE` rows. Replace or remove examples before publishing.

- **Semester Settings** controls semester label/code, Welcome Lounge enablement, current WhatsApp invitation and enabled state, content review date, and default language. `content_reviewed_by` is private workbook metadata and is not published.
- **First Steps** controls stable IDs, order, titles, concise student text, official source URL or registry ID, active state, semester, review date, and private internal notes. The count is data-driven. `notes_internal` is discarded.
- **Useful Information** controls searchable secondary links shown in Info and existing portal views.
- **Student Support** contains explicitly public student initiatives, representation, peer-support, or official-support resource details.
- **Community** contains curated public community links. Community-run material is labelled as such; the app does not read Telegram messages or call a Telegram API.
- **Official Links** is a small canonical registry for BUW links that First Steps may reference by stable ID.

Use HTTPS for public links. Official links must use a `uni-weimar.de` hostname. Telegram and WhatsApp destinations are restricted to their expected invitation hosts. Private IPs, localhost, credentials in URLs, unsupported schemes, invalid IDs/orders/dates, duplicate IDs, malformed headers, excessive text, and empty active first-step sets block publication. The parser ignores blank and inactive rows, does not rewrite policy text, and never publishes `notes_internal` or editor identity.

## What is published and what stays automatic

The public runtime release contains validated semester config, journey topics, useful links, support resources, community links, and other retained approved content. The release manifest is generated output, not another editable source. The server validates it before returning semantic content; the public API never exposes the workbook, backups, content metadata, staff files, source caches, or arbitrary Nextcloud paths. Exact document references in active, non-demo topics remain required for downloads.

Official university source checks and University Message Board RSS remain automatic, separate systems. Their last-known-good data stays under the current private `official-source-cache/` directory below `NEXTCLOUD_ROOT_FOLDER`; normal editorial staff do not edit this cache. No external database is required for public content, and Excel is parsed only during staff preview/publish, never per student request.

## Backups and recovery

Before publication, the server stores the source workbook, prior published release, previous validated content collections and publication metadata under a timestamped private `content-backups/` folder. A private `content-meta/publish-history.json` index records who published, when, semester, content hash, changed sections, validation warnings and the associated backup folder. Admins can restore a listed earlier publication in Staff → Content; restore itself creates a new release and another backup. Backups and history are not public and are not automatically deleted. Export/retain backups according to university policy.

If a content service fails, the student application uses its bundled, clearly labelled fallback content. It never parses the workbook during student requests. The old legacy workbook parser is retained for transition; new maintenance should use the generated `Welcome-Lounge-Content.xlsx` template and its headers.
