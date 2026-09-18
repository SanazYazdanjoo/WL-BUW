# Welcome Lounge Digital Companion

A mobile-first service for incoming international students at Bauhaus-Universität Weimar. It brings essential arrival information, official sources and a minimal journey into one place, while helping tutors share lightweight operational context. The existing React + Vite application and Nextcloud integration remain in place.

## Current status

The public student app remains read-only and anonymous. Journey completion stays in browser storage. Events, RSS and official-source synchronization remain separate automatic sources.

A six-sheet `Welcome-Lounge.xlsx` staff workbook is implemented as the unified store for content and staff operations. It contains Settings, Content, Students, Activity, Staff and Shifts. Server-side ExcelJS parsing validates each read/write; the public app receives only approved content. Staff mutations use Nextcloud conditional writes and private backups. The app reads the unified workbook when it is available. Older publication and operational stores remain as migration/emergency fallbacks until the live acceptance gate is complete; no repository cleanup automatically changes or deletes Nextcloud data.

This is an operational pilot. On 18 September 2026, the production public-content endpoint reported the unified workbook as its source, but returned no active Journey topics. The staff roster and operational flows, migration completeness, and live WebDAV ETag/conditional PUT behavior still require authenticated acceptance checks. No live university storage write or Vercel setting change is claimed by local tests.

Early tutor feedback is preliminary and directional, based on four Welcome Lounge tutors. It is not representative of all staff or students. See [research findings](documentation/research-findings.md).

## Local development

Use Node 22.12+ and npm.

```sh
npm ci
# Copy .env.example to .env.local; keep credentials server-only.
npm run dev
```

Without Nextcloud credentials, the app uses labelled local content. Server-only settings:

| Variable | Purpose |
| --- | --- |
| `NEXTCLOUD_USERNAME` | Server-side Nextcloud account ID |
| `NEXTCLOUD_APP_PASSWORD` | Server-side app password |
| `NEXTCLOUD_BASE_URL` | Current host: `https://nextcloud.uni-weimar.de` |
| `NEXTCLOUD_ROOT_FOLDER` | Current temporary APP root: `/Welcome.Lounge_WiSe2026_27/APP` |
| `NEXTCLOUD_WORKBOOK_FILE` | Optional override; defaults to `Welcome-Lounge.xlsx` |
| `NEXTCLOUD_BROWSER_URL` | Optional staff-only browser shortcut; never used by WebDAV |

Staff pilot codes and session secret also remain server environment settings. Never use `VITE_` for secrets. The numeric ID in a Nextcloud browser URL is not a storage identifier. For permanent handover, use an institutional service account and change only configuration when the app root moves.

Run relevant checks with:

```sh
npm test
npm run lint
npm run build
npm run content:check
npm run workbook:template
```

`npm run workbook:template` creates `templates/Welcome-Lounge-Template.xlsx` with six sheets and fictional inactive sample rows.

## Vercel

The existing Vercel/GitHub project remains the deployment path. Pushes to `main` trigger the existing Git integration. This repository uses Vite and Node API routes; it is not a Next.js app. Set credentials through the existing project's server-only Environment Variables. Upload the prepared operational workbook as `Welcome-Lounge.xlsx` to the configured Nextcloud app-folder root; the app detects it on the next request. Verify the production domain and run staff, public-content and backup smoke checks after deployment. No Nextcloud credentials or workbook are committed here.

## Data ownership and migration

When unified workbook mode is enabled, the source of truth for human-maintained data is `<NEXTCLOUD_ROOT_FOLDER>/Welcome-Lounge.xlsx`. Staff normally use the authenticated UI; the workbook remains a portable handover, backup and emergency fallback. The six sheets and recovery process are described in [the unified workbook guide](documentation/excel-database.md).

Existing `Welcome-Lounge-Content.xlsx`, `MasterExcel.xlsx`, published JSON and `staff-data/state.json` remain untouched. To start unified workbook mode, upload a prepared `Welcome-Lounge.xlsx` to the configured app-folder root. The app never derives the semester from the folder name. Generated JSON and bundled files remain fixtures/fallbacks and automatic systems are kept separate from workbook content.

The old [content workbook guide](documentation/content-workbook-guide.md) and [MasterExcel guide](documentation/master-excel-guide.md) describe legacy migration inputs and are not the current editing workflow. For normal work, use the staff web interface. See [semester handover](documentation/semester-handover.md), [operations](documentation/operations.md), [technical implementation](documentation/technical-implementation.md) and [decisions](documentation/decisions.md).

## Public documents and automatic sources

Public downloads remain restricted to exact approved document references and paths inside `documents/`. Do not store personal records there. Official university sync, Events, community RSS, and manually maintained community links remain separate sources; see [official-source sync](documentation/official-source-sync.md) and [community and support](documentation/community-and-support.md).
