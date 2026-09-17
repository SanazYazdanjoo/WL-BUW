# Development log

## 2026-09-17: Nextcloud migration

**Request:** Remove Google Sheets and connect the supplied Nextcloud folder, supporting all file formats.

**Implementation:** Removed useSheetData.js, the direct Sheets request and its environment references. Replaced structured FAQ rendering with folder browsing and file details. Added the Nextcloud hook, breadcrumbs, filename search, downloads and Nextcloud links. Kept the React/Vite foundation and adjusted styling for mobile and long filenames.

Added read-only WebDAV middleware, fast-xml-parser, a fixed source folder, validated relative paths, server-only credentials, controlled errors, timeouts and binary streaming. Integrated the API into Vite development/preview and a standalone Node server. Added environment examples, secret-file ignore rules, Node lint settings, test/start scripts and setup instructions.

**Verification:** Five backend tests, lint and build passed. Browser inspection verified the setup-needed page with no JavaScript error. Standalone HTTP checks returned 200 for home/file routes and JSON 503 for missing credentials. Source search found no remaining Sheets integration references at implementation time.

**Pending:** Authenticated access, actual folder contents and live downloads. The supplied URL returned HTTP 401 anonymously. Credentials still require local configuration.

**Limits:** File access supports arbitrary formats; extracting document contents into FAQ pages is not implemented. Previews/editing depend on Nextcloud or local software. No writes to Nextcloud or visitor login are provided.

## 2026-09-17: Development documentation

**Request:** Document decisions and technical developments in a documentation folder, then commit this chat's changes with a short message and push to main.

**Implementation:** Added documentation/ with an index, decisions, architecture/API details, operations and this log. Linked it from the root README. Included maintenance guidance for future changes and distinguished local verification from the pending live connection.

**Scope:** The migration and documentation belong to this chat's commit. Unrelated local assets, workspace settings and unrelated lockfile version changes remain outside that scope. Git history records the eventual commit; this document does not claim a push before it occurs.
