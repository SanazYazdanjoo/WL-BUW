# Official university source sync

The app keeps official university references current without making student page views depend on a live scrape. The two approved sources are configured in `content/app-content/sources.json`:

- [Preparing your studies](https://www.uni-weimar.de/en/university/international/to-weimar/fulltime-students/preparing-your-studies/)
- [Welcome events](https://www.uni-weimar.de/en/university/international/to-weimar/fulltime-students/welcome-events/)

The server fetches only these configured HTTPS pages on `www.uni-weimar.de`. It checks redirects, MIME type, timeout and response size, parses HTML on the server, validates a small structured result and never sends raw HTML to React. External links found on an approved page are retained as links; those sites are not fetched.

## What is synchronized

Welcome Events is normalized into event titles, date/time when unambiguous, location, language, short descriptions, registration/detail links and source warnings. A date conflict is preserved as source text and the normalized date is left empty so the student is directed to the official programme. Valid event changes refresh automatically after the configured six-hour TTL. A large event-count change waits for coordinator review.

Preparing your studies is used as an official directory: the cache contains section labels, canonical university links and bounded external links. Its prose does not replace local onboarding instructions. Topic-to-section mappings live in `sources.json`; if a mapped section is no longer present, the topic falls back to the main official Preparing your studies page.

Local onboarding content, contextual FAQs, tutor tips, documents and semester WhatsApp configuration remain separate. They are maintained through the existing published content and Nextcloud process. Official source references are still available when no cached record exists.

## Cache and freshness

Validated JSON records are stored in the configured Nextcloud root at `official-source-cache/preparing-studies.json` and `official-source-cache/welcome-events.json`. This is a server-only private-store path. It is not listed, downloaded, or selected by a browser, and it is separate from `documents/`. The Vercel filesystem is not used for persistence.

The current configuration checks Welcome Events every 6 hours and Preparing your studies every 24 hours. They are labelled stale after 24 and 72 hours respectively without successful verification. A failed fetch or parse keeps the last-known-good data and records a bounded safe failure state. With no cache, students see the canonical source link and a simple current-information note. An unchanged normalized hash updates the successful-check time without changing `lastChangedAt`.

Statuses in cache records are `current`, `stale`, `needs-review`, `fetch-failed`, and `parse-failed`. A new candidate with an implausible item-count change is held as `pendingReview`; it does not replace the student-visible data until an authorized coordinator accepts it. Individual ambiguous event fields (such as a conflicting date) are also omitted from confident display and linked to the official programme.

## Refresh and staff review

Local commands use the same fetchers, parsers and validators as the application:

```sh
npm run sources:check
npm run sources:dry-run
npm run sources:sync
```

The dry run fetches and parses the live pages but writes nothing. Persistent sync requires `NEXTCLOUD_USERNAME`, `NEXTCLOUD_APP_PASSWORD`, and the correct `NEXTCLOUD_ROOT_FOLDER` in `.env.local`. It safely fails if credentials are absent. It is not accurate to call a persistent sync successful until the Nextcloud write succeeds.

When pilot staff authentication is enabled and configured, admins can use `/staff/sources` to inspect status, check both pages now, and accept a count-change candidate after reviewing the official source. No raw HTML or cache path is shown in that screen. The internal `POST /api/internal/sync-official-sources` entry point is disabled by default; it requires `OFFICIAL_SOURCE_SYNC_ENABLED=true` and a server-only `OFFICIAL_SOURCE_SYNC_SECRET` with at least 32 characters. No Vercel Cron schedule has been added, so current automatic refresh is TTL-based and happens on a content read after expiry. Manual staff and CLI refresh remain available.

Never use a `VITE_` prefix for credentials or the sync secret. Add production values through the existing Vercel project's Environment Variables. Do not change the GitHub-to-Vercel connection or project protection to configure source sync.

## Changing sources and investigating parser changes

To change a source URL or its schedule, edit the corresponding entry in `content/app-content/sources.json`. The server validator accepts only HTTPS on `www.uni-weimar.de`; do not add browser-supplied URLs or arbitrary hosts. `npm run sources:check` validates the settings and public content. Disabling an individual source or the top-level source service keeps the canonical link available while stopping refresh.

If the university changes its page structure, add a small synthetic HTML fixture to `tests/official-sources.test.js`, update the relevant purpose-built parser under `server/officialSources/`, and run:

```sh
npm test
npm run sources:check
npm run sources:sync -- --dry-run
```

Do not commit full university page captures. Check parser warnings and the official page; never repair uncertain policy/event details by guessing. A parser or network failure should leave the last-known-good cache in place.

## Favicon discovery

The approved-page parser resolves a declared favicon URL against that page and validates its URL scheme. The live Preparing your studies page currently declares `https://www.uni-weimar.de/fileadmin/template/Favicon/favicon.ico?1789657819`. Relative, absolute and unsafe references are covered by synthetic tests. The icon bytes are **not** synchronized or hot-linked into the app: rights and institutional reuse permission have not been established. The existing local app favicon remains unchanged. If the International Office confirms reuse rights, a maintainer can review and deliberately add the approved asset to the repository; this is not an automatic source-sync feature.

## Current verification boundary

The parsers have been exercised against the live approved pages and against synthetic fixtures. Live extraction returned nine Preparing your studies sections and eight Welcome Events records at the last check; one event date is contradictory on the source and remains unverified in the app. A live parse does not prove a persistent Nextcloud write. At the time of this implementation, Nextcloud credentials are not available in this local environment, so persistent cache creation, Vercel environment configuration and hosted source refresh remain to be verified by an authorized operator.
