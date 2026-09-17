# Welcome Lounge Digital Companion

A mobile-first arrival companion for incoming international students at Bauhaus-Universität Weimar. This is an operational Welcome Lounge pilot, not a thesis project. It aims to reduce repetitive tutor questions and make arrival easier. The existing React + Vite application has been retained.

## Current status

**Implemented:** seven-step open-order journey, topic pages with contextual FAQs and downloads, browser-only progress, configurable semester/WhatsApp, events, later-stage topics, help/privacy, not-found pages, validated Nextcloud content, restricted public downloads, shared local/Vercel API.

**Partial:** anonymous feedback UI (explicitly does not save); staff landing page and server-only operational interface (no records or login); staff-maintained JSON content (no visual editor).

**Pending before student launch:** International Office-approved content and contact details, current WhatsApp invitation, approved public documents, authenticated Nextcloud smoke test, Vercel deployment verification, institutional privacy/contact review. All supplied topic/event material is clearly labelled sample content.

**Planned, awaiting decisions:** staff authentication, persistent operational/feedback storage, check-in, handover, reports, admin editing, attendance. No external database or auth provider has been added.

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
npm run preview
# Or serve dist and API with the standalone Node server:
npm start
```

## Deploy to Vercel

Existing production URL: **https://wl-buw.vercel.app/**. Existing project ID: `prj_VrjEwDB09VK3PldfyLvnfZn9bxIQ`. The domain is already public; it currently serves the older file-browser build. The earlier deployment-specific URL is protected, which does not require changing protection on the production domain.

This repository is already connected to an existing Vercel project. Keep GitHub as the source of truth: **commit/push -> Vercel automatic Git deployment**. Do not create another project, replace the integration, or add a separate CI system. Check the existing project settings against Vite, `npm run build`, output `dist`, and Node 22.x before changing anything. Add server credentials only through that project's Vercel Environment Variables.

`api/[...path].js` runs the shared Node API; `vercel.json` preserves API/assets and rewrites frontend deep links to the SPA. This follows Vercel's [Vite Functions guidance](https://vercel.com/docs/frameworks/frontend/vite). There is no Next.js dependency. Push reviewed changes through the existing Git integration and follow the [operations smoke checks](documentation/operations.md). The supplied deployment redirects anonymous requests to Vercel authentication; protection was not changed. Live application/API/download verification remains pending. See [deployment verification](documentation/deployment-verification.md).

## Content maintenance

Create the following **inside the configured root**, using Nextcloud's normal UI. Nothing in this repository automatically creates, moves, or deletes remote files.

```text
app-content/
  config.json
  onboarding.json
  events.json
  after-arrival.json
documents/
  enrollment/
  city-registration/
  insurance/
  bank-account/
```

Start with [the example files](content/app-content). See the [content guide](documentation/content-guide.md) for fields, publication, and semester rollover.

Downloads must be inside `documents/` **and explicitly referenced by an active, non-demo topic** in the current validated Nextcloud onboarding or after-arrival content. Unlinked files cannot be downloaded. Keep only approved public material in this area; personal records and case notes must remain elsewhere. There is no public folder-listing API. Removing a reference revokes download access on the next request.

Edit `config.json` to change semester label, contact text, WhatsApp URL, or `whatsappEnabled`. Changes are read at runtime on reload without rebuilding. Missing/invalid configuration disables WhatsApp rather than reusing a cached invitation. Changing the root later requires one environment-variable change plus placing the same content structure at the new location.

## Handover

See [documentation](documentation/README.md), [technical implementation](documentation/technical-implementation.md), [operations](documentation/operations.md), and [decisions](documentation/decisions.md). Preserve topic IDs when editing text so browser progress remains meaningful. No student accounts, operational records, analytics, or database are present.
