# Existing Vercel deployment verification

Checked 2026-09-17. The user confirmed an existing GitHub-connected Vercel project with working automatic deployments. Keep GitHub as the source of truth: commit/push, then the existing Vercel integration builds the commit. No new project, CI workflow, relinking, remote setting change or deployment was performed here.

Observed URL: https://wl-11f32lbt9-sanazyazdanjoos-projects.vercel.app/

## Production domain clarification

The user subsequently supplied the production domain **https://wl-buw.vercel.app/** and existing project ID **`prj_VrjEwDB09VK3PldfyLvnfZn9bxIQ`**. These identify the existing project; do not create a replacement or change the integration.

On 2026-09-17 the production homepage returned HTTP 200 without authentication. Browser inspection showed the previous `Info-Directory` / `Welcome Lounge · Files` UI with “Files are unavailable.” `/journey/enrollment`, `/api/content/config`, and `/api/nextcloud/files` returned HTTP 404. Thus this production domain is already publicly accessible, but it is not serving the new P0 implementation. The new API and Vercel configuration are still uncommitted locally. Connector project inspection returned 403; remote settings and the exact deployed commit remain unverified.

No protection change is needed to make this production domain reachable. The earlier protection finding applies to the supplied deployment-specific URL, not this production alias. Next, release the reviewed changes through the existing Git integration, then rerun acceptance checks against `https://wl-buw.vercel.app/`.

## Access finding

Anonymous GET requests to `/`, `/journey/enrollment`, `/api/content/config`, and `/api/nextcloud/files` returned HTTP 302 to `vercel.com/sso-api`. This is a Deployment Protection barrier. The connected Vercel account exposed no teams; the protected-URL tool returned 403. The underlying deployment's app behavior, deployed commit, project settings and environment-variable configuration could not be inspected. Protection was not disabled, and no successful bypass/share URL was created.

The final student URL must work anonymously. The project owner must explicitly review the intended URL/environment and any proposed access-setting change before it is made. Do not disable protection as a side effect of a deployment or test.

## Required acceptance checks

| Requirement | Local evidence | Existing hosted deployment |
| --- | --- | --- |
| Frontend loads | Desktop/mobile browser checks passed | Production alias loads the old file-browser UI; new UI not deployed |
| Routes refresh correctly | Standalone deep-link checks and browser topic reload passed | Production topic deep link returns 404; new rewrites not deployed |
| Server-side Nextcloud calls work | Shared API tested with mocked upstream; Vercel entry point tested through Node HTTP | Authenticated live Nextcloud read still pending |
| Secrets unavailable to browser | Production build with unique server-only sentinel credentials scanned: no sentinel values or credential variable names in `dist`; server API errors sanitized | Deployed assets and actual environment settings still need review |
| Document downloads work | Binary attachment test preserves bytes and forced-download headers | Approved real document download still pending |
| Missing credentials fail safely | Actual Vercel handler returns demo config and document 503 without upstream requests | Verify only in an isolated test environment; do not remove working production credentials to test |
| Production build succeeds | `npm run build` passed; 20 tests and lint passed | New implementation has not yet been pushed/deployed |

These are local implementation checks, not a declaration that hosted Vercel support is complete.

The Vercel entry point is also tested with controlled upstream responses: configured-root JSON reads and unchanged binary attachment downloads pass through the actual exported handler. These tests use fake credentials and mocked Nextcloud responses, not the live university account.

## Repeatable check after Git deployment

Run the read-only script against the URL produced by the existing Git integration:

```sh
node scripts/check-deployment.js https://DEPLOYMENT-HOST documents/enrollment/approved.pdf
```

Replace the document path with an existing approved public document. The script checks frontend HTML/deep-link responses, all four live content endpoints, disabled listing access and streamed download headers/bytes. It does not follow protection redirects, create bypasses or print response bodies. It exits nonzero if protection blocks access, content is still a demo fallback, a document is not supplied or a check fails. Browser rendering, client-secret auditing, file integrity comparison and isolated missing-credential verification remain separate steps.

## Configuration inspection

The committed baseline had no `vercel.json`, API entry point or tracked CI files. The current uncommitted P0 implementation adds `vercel.json` and `api/[...path].js`; no pre-existing configuration was overwritten. There is no local `.vercel` project link. Existing remote project settings could not be read and were not changed.

The API invokes `server/api.js`, shared with Vite and the standalone Node server. Current configuration supplies the Vite framework, SPA rewrite excluding API/assets, function duration and response security headers. It contains no secrets, Git integration changes, project identifiers or protection settings. Configure Nextcloud credentials only through Environment Variables in the existing Vercel project.
