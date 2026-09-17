# Operations and deployment

## Local setup

Use Node 22.12+ and `npm ci`. Copy `.env.example` to `.env.local` and enter the account ID, app password and application root. Never print/commit credentials or prefix them with `VITE_`. A browser login to Nextcloud does not authenticate the backend. `npm run dev` and `npm run preview` include the shared API. `npm start` serves the built `dist` plus API at 127.0.0.1:3000; HOST/PORT can be set server-side.

No credentials are needed to review labelled demo content. There is no automatic upload or migration of Nextcloud files. Follow [the content guide](content-guide.md) to prepare the public structure. Keep all sensitive files outside both `documents/` and the published JSON.

## Vercel pilot

Use the existing project `prj_VrjEwDB09VK3PldfyLvnfZn9bxIQ` and production domain `https://wl-buw.vercel.app/`. Do not create/relink a project, disconnect GitHub, or change deployment protection from this repository. Hosted acceptance remains distinct from local checks; consult [deployment verification](deployment-verification.md) for the last recorded access check. New working-tree changes do not become live until committed and pushed through the existing GitHub integration.

1. Use the existing GitHub-connected Vercel project. Do not create/relink a project or replace automatic Git deployments. Inspect its existing framework/build/runtime settings; the app expects Vite, Node 22.x, `npm run build`, output `dist`.
2. Set `NEXTCLOUD_USERNAME`, `NEXTCLOUD_APP_PASSWORD`, and `NEXTCLOUD_ROOT_FOLDER` in Project Settings for Preview/Production as appropriate. Use `/Welcome.Lounge_WiSe2026_27/S.Y` now. Do not put these in client variables or vercel.json.
3. Commit/push reviewed application changes to GitHub and let the existing integration create its deployment. The root catch-all API function invokes the same middleware as local development. Frontend rewrites exclude API paths and assets. No external database is required.
4. Check the resulting URL using the checklist below. Keep normal releases on the existing commit/push -> automatic deployment workflow. Do not disable Deployment Protection automatically. Explicitly review any access-setting change with the project owner before making it; students ultimately need an anonymously accessible URL.
5. Environment changes need a new deployment. JSON/content edits need only a page reload. The function runtime imports the fallback JSON from the repository; do not remove these files.

References: [Vite and Functions](https://vercel.com/docs/frameworks/frontend/vite), [Node runtime](https://vercel.com/docs/functions/runtimes/node-js). No live Vercel deployment was made during this implementation.

## Deployment Protection and current access

The supplied deployment `https://wl-11f32lbt9-sanazyazdanjoos-projects.vercel.app/` returned HTTP 302 to `vercel.com/sso-api` for the home page, topic deep link and API paths on 2026-09-17. Authenticated connector access also returned 403, and team discovery returned no accessible teams. This establishes a protection/access barrier, not whether the underlying application works. No protection settings, environment variables, Git integration or project configuration were changed remotely.

Use `node scripts/check-deployment.js https://DEPLOYMENT-HOST documents/topic/approved.pdf` for anonymous read-only HTTP checks. It fails explicitly on protection, demo fallbacks or absent document verification. It does not create share links, bypass protection, print credentials, or replace browser checks.

## Required smoke checks

- Home is the journey, with currently loaded active topics. Samples are labelled when served; approved publication removes the demo state.
- Refresh `/journey/<active-topic-id>`, `/events`, `/info`, `/help`, `/after-arrival`, and an unknown URL; deep links work and unknown pages show not-found UI.
- `GET /api/content/config` returns JSON with source metadata. With a working configured folder, verify `source: nextcloud`, then change harmless public text through Nextcloud and reload to confirm runtime updates.
- `/api/nextcloud/files` and download of an unrelated private path return 404 without upstream access. Encoded `../` is rejected. An unknown API URL returns JSON 404.
- Download an approved small PDF from `documents/`, including a filename with spaces/non-ASCII characters. Confirm original bytes, attachment disposition and nosniff. Test a missing file; the UI must show a readable failure.
- Confirm disabled/missing WhatsApp never links to a previous group. Confirm the current approved invite and explicit semester label when enabled.
- Complete and uncomplete a step; refresh, open another tab, and reset progress. Nothing is submitted to the backend. Test denied browser storage.
- Test 390px and 320px widths, keyboard navigation, FAQ disclosure, visible focus and screen-reader labels.
- Feedback must say it was not sent or saved. When staff pilot is enabled, verify tutor/admin authorization, private/no-store responses, Today check-ins, update attribution, handover, and coordinator semester status. When disabled, staff APIs fail closed.
- Review host function logs, actual response/size limits, outbound access to the university service, and confirmed privacy/contact wording before inviting students.

## Verification commands

```sh
npm ci
npm test
npm run lint
npm run build
npm run content:check
# Validate downloaded draft JSON files before publishing:
node scripts/check-content.js /path/to/draft/app-content
```

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Sample banner appears | Check credentials/root and exact JSON names; inspect safe server logs; validate files |
| Download unavailable (503) | Configure server credentials and restart/redeploy |
| Download 404 | File missing, outside documents/, or not referenced by a current active non-demo topic; check valid Nextcloud content without broadening access |
| Download 502 | Check university availability, app-password access, redirects and timeout |
| Updated content not visible | Reload; validate JSON; confirm configured root and source metadata |
| WhatsApp missing | Confirm enabled flag, semester label and secure chat.whatsapp.com invitation |
| Progress not saved | Browser storage may be disabled/full; use the displayed session-only state |
| API returns HTML on hosting | Verify catch-all function and API-excluding rewrites were deployed |

## Handover and backups

Back up the current atomic `app-content/published.json` release (or the legacy collection JSON files before first publication), public documents, private operational state, source workbooks and backups independently of code. Follow the [MasterExcel guide](master-excel-guide.md); a workbook export omits handover/check-in/audit data and is not a full operational backup. Transfer repository and deployment ownership plus content access to the International Office. Replace personal credentials with an institutional service account and revoke old credentials after verification. Move the content structure through the approved process, then change only `NEXTCLOUD_ROOT_FOLDER` for an institutional root. Document the new responsible content reviewer and access owners without recording passwords.

## Official source freshness

Official-source settings and manual refresh procedures are in [official-source-sync.md](official-source-sync.md). The generated JSON cache is under `official-source-cache/` below `NEXTCLOUD_ROOT_FOLDER`; do not copy it into `documents/` or publish it. `npm run sources:dry-run` checks the live pages without writing. Persistent sync requires configured Nextcloud credentials and has not been verified from an environment without those credentials. The staff `/staff/sources` view is available only after the existing admin pilot authentication is configured. The optional secret-protected internal route is disabled by default; no scheduled Vercel job is configured.

The staff pilot uses shared codes and private Nextcloud state, but shared-code access and self-declared names do not provide institutional identity verification. Confirm authorized roles, retention rules, service-account ownership and privacy information before long-term use. Feedback is not persisted. Hosting-level access logs may contain IP addresses; establish institutional privacy information before public launch.

## Staff/workbook operations update — 2026-09-17

The staff placeholder has been replaced with disabled-by-default pilot access and private Nextcloud persistence. Follow [Staff operations](staff-operations-guide.md), [Editorial workbook](content-workbook-guide.md) and [MasterExcel](master-excel-guide.md). These supersede older instructions to maintain all text through JSON and statements that staff records are unimplemented.

Keep the existing Vercel project and Git deployment workflow. Configure the new server-only environment variables through existing project settings; no project-level protection changes were made. Validate with the actual workbooks and a private test subtree before entering real operational data. Synthetic local verification does not establish live Nextcloud write permissions or production deployment readiness.

## Survey-informed product refinement — 2026-09-17

The current directional input comprises four Welcome Lounge tutor responses, not a representative survey of International Office staff or students. Public `/info` is an editorial index into existing material, while `/help` clarifies that the app serves common information and WhatsApp remains human support. The staff dashboard now foregrounds today's check-ins, recent handover and attributed updates. Coordinator `/staff/content` (labelled Semester setup) summarizes status and mismatched semester labels, and links to existing preview, import, official-source refresh and MasterExcel export flows. These changes do not alter source data or auto-correct discrepancies. See [preliminary research findings](research-findings.md).
