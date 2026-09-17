# Development decisions

Recorded on 2026-09-17.

## D01: Replace Google Sheets with Nextcloud

The user requested removal of the Sheets integration and supplied the university Nextcloud folder. The previous hook fetched `Directory_Index` and `All_Content` via the Sheets REST API using `VITE_SPREADSHEET_ID` and `VITE_GOOGLE_SHEETS_API_KEY`. There was no Google-specific npm package.

Removed that hook, API call and environment references. The content model now uses files and folders instead of FAQ rows and typed text blocks. Existing spreadsheet content is not copied or migrated.

## D02: Support arbitrary formats through file access

The user requested all formats. The implementation lists, searches by filename and downloads arbitrary files without extension filtering or conversion. Original bytes are preserved. Open in Nextcloud delegates viewing/editing to that installation and its apps.

This is not universal document extraction, OCR, full-text indexing, spreadsheet interpretation or an embedded viewer. The interpretation and limits were explained during implementation.

## D03: Keep credentials on a Node backend

The supplied Files browser URL returned HTTP 401 anonymously. A Node middleware accesses the private folder through authenticated WebDAV using an account ID and app password. The frontend calls same-origin routes and never receives those credentials. Browser login cookies are not used by the backend.

This avoids browser cross-origin access to Nextcloud and exposing credentials in frontend JavaScript. Deployment now requires a backend; static frontend hosting alone is insufficient.

## D04: Restrict access to a fixed, read-only root

The upstream origin is fixed to `https://nextcloud.uni-weimar.de` and the root to `/Welcome.Lounge_WiSe2026_27/S.Y`. Clients supply relative paths only. Dot segments, backslashes and control characters are rejected, path segments are encoded, redirects are disabled, and listings exclude entries outside the requested folder's direct children.

The API accepts GET only; the upstream requests are PROPFIND for listings and GET for downloads. Uploads, deletes, renames and editing are not implemented. Changing the source folder currently requires updating backend and frontend references together.

## D05: Shared credentials do not provide visitor authentication

One configured account reads the root folder. There is no visitor login or per-user authorization. Anyone who can reach the API can read accessible files under the configured root. The standalone server binds to localhost by default. External deployment requires appropriate access control in front of the app.

Open Nextcloud links use the visitor's separate Nextcloud browser session, which does not configure the server connection.

## D06: Stream arbitrary files as downloads

Downloads use Node streams with attachment disposition, octet-stream content type, nosniff and no-store. This preserves binary data without buffering whole files or storing copies. It also prevents uploaded HTML/SVG from executing as inline content on the application origin. Range/resumable downloads are not implemented.

## D07: Retain the React/Vite foundation

Kept React, React Router, Vite, Tailwind tooling and the existing visual language. Added fast-xml-parser for WebDAV XML. XML is validated, DOCTYPE is rejected and entity processing is disabled.

The same middleware runs in development, preview and the standalone server. The existing `/topic/:topicId` route shape remains, but now identifies a filename in the selected folder. Previous spreadsheet topic IDs are not migrated.

## D08: Load one folder at a time

PROPFIND uses Depth 1. Navigation or refresh loads current contents. Search filters filenames in the current folder; folders appear first, followed by name sorting. There is no recursive crawl, database, background sync, live subscription or server content cache.

The React hook aborts obsolete requests and hides results belonging to a previous path while the next folder loads.

## D09: Expose controlled failures and verification limits

Missing credentials, invalid paths, unsupported methods, missing resources, upstream denial and network failures have explicit error responses. Credentials and raw upstream error bodies are not exposed. Listings time out after 20 seconds; downloads after five minutes.

Mocked tests and local browser checks verify implementation behavior. They do not establish live access to the private university folder; authenticated verification remains pending.
