# Welcome Lounge Digital Companion

A mobile-first service for incoming international students at Bauhaus-Universität Weimar. The Welcome Lounge Digital Companion helps students find essential arrival information and official sources in one structured place, while supporting tutors with lightweight shared operational context. It is an operational pilot, not a thesis project, and retains the existing React + Vite application.

## Current status

**Implemented:** data-driven anonymous journey (twelve labelled fallback steps; workbook imports support variable counts), contextual FAQs, restricted downloads, browser-only versioned progress, semester/WhatsApp settings, events and later-stage pages. Added server-side Excel parsing, coordinator preview/publication with backups, shared published web/print content, private pilot staff sign-in, Nextcloud operational state, student status/check-in, shifts, handover and daily count reports.

**Partial:** actual workbook layout validation and live Nextcloud write verification remain pending. The staff area is disabled by default. Shared pilot codes and self-entered tutor names are not institutional identity verification. Feedback does not persist. Full CMS editing, audit browsing and automated reporting are not implemented.

**Before real use:** validate the real editorial and MasterExcel files against previews; configure university credentials and strong staff codes; test conditional writes/backups on Nextcloud; publish International Office-approved content and current contact details. No personal workbook is bundled or committed. No external database or auth vendor was added.

Product priorities are informed by early tutor feedback, not representative research. See [preliminary tutor survey findings](documentation/research-findings.md) for the response scope and design implications.

See [semester setup and workbook publication](documentation/content-workbook-guide.md), [MasterExcel import/export](documentation/master-excel-guide.md) and [staff setup](documentation/staff-operations-guide.md).

Official BUW references use a server-side parser and private Nextcloud last-known-good cache. Events update as structured facts; Preparing your studies supplies section names and links without replacing local onboarding guidance. See [official source synchronization](documentation/official-source-sync.md).

## Run locally

Use Node 22.12+ (Node 22 LTS recommended) and npm.

```sh
npm ci
# Copy .env.example to .env.local; keep credentials server-only.
npm run dev
```

Without credentials, the app serves labelled samples. Set these **server-only** variables in `.env.local`:

| Variable | Value |
| --- | --- |
| `NEXTCLOUD_USERNAME` | Nextcloud account ID |
| `NEXTCLOUD_APP_PASSWORD` | App password with access to the application folder |
| `NEXTCLOUD_ROOT_FOLDER` | `/Welcome.Lounge_WiSe2026_27/S.Y` currently; later `/Welcome-Lounge-App` |

Restart after environment changes. Never use `VITE_` for credentials. The upstream university origin is fixed server-side. Use an institutional service account for permanent handover, replacing personal credentials.

```sh
npm test
npm run lint
npm run build
npm run content:check
npm run sources:check
# Optional live parse (no cache write):
npm run sources:dry-run
npm run preview
# Or serve dist and API with the standalone Node server:
npm start
```

## Deploy to Vercel

Existing production URL: **https://wl-buw.vercel.app/**. Existing project ID: `prj_VrjEwDB09VK3PldfyLvnfZn9bxIQ`. The domain was publicly accessible at the previous inspection; that observation is historical, not verification of this unpushed change. The earlier deployment-specific URL is protected, which does not require changing protection on the production domain.

This repository is already connected to an existing Vercel project. Keep GitHub as the source of truth: **commit/push -> Vercel automatic Git deployment**. Do not create another project, replace the integration, or add a separate CI system. Check the existing project settings against Vite, `npm run build`, output `dist`, and Node 22.x before changing anything. Add server credentials only through that project's Vercel Environment Variables.

`api/[...path].js` runs the shared Node API; `vercel.json` preserves API/assets and rewrites frontend deep links to the SPA. This follows Vercel's [Vite Functions guidance](https://vercel.com/docs/frameworks/frontend/vite). There is no Next.js dependency. Push reviewed changes through the existing Git integration and follow the [operations smoke checks](documentation/operations.md). The supplied deployment redirects anonymous requests to Vercel authentication; protection was not changed. After pushing to main, hosted smoke checks confirmed frontend refresh, nested content/staff routing and safe missing-credential behavior. Real Nextcloud content and downloads remain unverified because production credentials and workbooks are not available. See [deployment verification](documentation/deployment-verification.md).

## Content maintenance

Create the following **inside the configured root**, using Nextcloud's normal UI. Confirmed staff imports/publications may create application folders, state and backups. Existing source files are never moved or deleted.

```text
app-content/
  config.json
  onboarding.json
  events.json
  after-arrival.json
  health-insurance.json
  useful-links.json
  rundfunk.json
  published.json  # created by confirmed workbook publication
official-source-cache/ # generated private cache, not public documents
content-source/  # private editorial workbook
content-backups/ # private publication backups
staff-data/      # private MasterExcel, state.json and backups
documents/
  enrollment/
  city-registration/
  insurance/
  bank-account/
```

Start with [the example files](content/app-content). See the [content guide](documentation/content-guide.md) for fields, publication, and semester rollover.

Downloads must be inside `documents/` **and explicitly referenced by an active, non-demo topic** in the current validated Nextcloud onboarding or after-arrival content. Unlinked files cannot be downloaded. Keep only approved public material in this area; personal records and case notes must remain elsewhere. There is no public folder-listing API. Removing a reference revokes download access on the next request.

Use `/staff/content` to change semester/contact settings and publish reviewed workbook content. Legacy `config.json` editing is supported before the first release; afterward `published.json` takes precedence. Changes are read at runtime on reload without rebuilding. Missing/invalid configuration disables WhatsApp rather than reusing a cached invitation. Changing the root later requires one environment-variable change plus placing the same content structure at the new location.

Source schedules and topic-to-official-section mappings are changed in `content/app-content/sources.json`. The Nextcloud cache is generated under `official-source-cache/`. To allow the optional internal refresh route in Vercel, set `OFFICIAL_SOURCE_SYNC_ENABLED=true` and a server-only random `OFFICIAL_SOURCE_SYNC_SECRET` (at least 32 characters); it is disabled by default. The existing staff source page and local sync command are described in [the source sync guide](documentation/official-source-sync.md). No Vercel Cron schedule is currently configured.

## Handover

See [documentation](documentation/README.md), [technical implementation](documentation/technical-implementation.md), [operations](documentation/operations.md), and [decisions](documentation/decisions.md). Preserve topic IDs when editing text so browser progress remains meaningful. No student accounts or analytics are present. Private operational records use Nextcloud; permanent institutional authentication remains future work.
