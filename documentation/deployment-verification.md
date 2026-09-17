# Existing Vercel deployment verification

Checked 2026-09-17 after the GitHub push. This is the user's existing Git-connected project and production domain; no replacement project, integration, or project-level protection change was made.

- Production URL: https://wl-buw.vercel.app/
- Project ID supplied by the user: `prj_VrjEwDB09VK3PldfyLvnfZn9bxIQ`
- Latest repository commit at this check: `420e4f2` (`Remove ineffective nested function routes`), pushed to `main`.

## Hosted smoke checks

| Request | Result | Meaning |
| --- | --- | --- |
| `/` | 200, React app loads | Frontend is public |
| `/journey/enrollment` | Browser renders the sample topic | Client-side deep links refresh correctly |
| `/api/content` | 200, seven labelled sample collections | Bundle API is routed |
| `/api/content/config` | 200 | Rewritten nested content API reaches shared middleware |
| `/api/staff/session` without cookie | 401 JSON | Nested staff API reaches application auth |
| `/api/nextcloud/files` | 404 JSON | Generic directory browsing is unavailable |
| `/api/nextcloud/download?path=documents/test.pdf` | 503 safe JSON | Download route works, but Nextcloud credentials are unavailable |

Browser inspection at `/journey/enrollment` showed the expected Welcome Lounge sample topic and no browser errors. `/journey/first-step-01` shows the proper not-found state because no workbook has been published to production. The `/api/content` response identifies all collections as `demo`; it does not show a real Nextcloud release.

Nested routing initially returned Vercel's platform `NOT_FOUND`. That issue was fixed with narrow rewrites in `vercel.json` to the existing shared catch-all and a server-side adapter that restores only bounded API path segments. The live checks above confirm the rewrites reached application middleware.

## Limits and remaining setup

Production content currently falls back to demo data. A real Nextcloud read, approved document download, Excel workbook preview/import, persistence write, ETag conflict, backup and print handout from institutional content have not been tested against the university account. No real workbook was present under `local-data/`. Staff access remains unusable until its Vercel environment values and Nextcloud permissions are configured; do not treat the 401 session check as proof that staff credentials are configured.

The hosted production alias was anonymously reachable in these checks. The earlier deployment-specific URL may still have Deployment Protection. No protection setting was changed. Vercel project APIs could not inspect settings because the connected Vercel tool returned no teams; environment variables and the exact deployment record were not inspected.

Before the semester pilot, configure server-only Nextcloud credentials and the required staff codes in the existing Vercel project's Environment Variables; upload both workbooks and review their previews; confirm a content publication; then repeat authenticated read, download, import, backup and conditional-write checks. Keep the student's production URL publicly accessible through the project's existing intended access configuration. Do not expose workbooks or private staff folders as public Nextcloud shares.
