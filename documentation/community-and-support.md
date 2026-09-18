# Community and support information

The `/info/community` page groups university-hosted notice-board items and links to student initiatives and peer support. It is nested under Info; it does not add a top-level navigation item. The feed is orientation/community material, not official administrative guidance. Students should follow each notice's canonical university page for details.

## RSS source and privacy

The current allowlisted feed is the University Message Boards RSS endpoint:

`https://www.uni-weimar.de/en/university/aktuell/pinnwaende/rss/`

Only the `Housing / Accomodation`, `Offering / Seeking`, and `Piazza` categories are enabled. Their exact university-hosted notice links, titles, categories, and publication dates are shown. RSS descriptions pass through an HTML sanitizer, but are omitted from the public view because they may contain personal contact details or names. No email, phone number, person-name, or social-handle fields are extracted.

The server fetches only the fixed university feed URL, allows a small number of redirects only when they remain on the same host and path, limits response size and request time, parses XML with `fast-xml-parser`, and caches normalized output at the private path `official-source-cache/community-rss.json` under `NEXTCLOUD_ROOT_FOLDER`. The last successful cache is retained if a refresh fails. Individual notices expire after 30 days; refresh is attempted after 30 minutes. With no Nextcloud credentials/cache, the page safely shows no feed items and links to the full official message board.

Run `npm run sources:discover-rss` to inspect the live category names and counts. It is a read-only discovery command: it does not change the allowlist or publish content. Run `npm run content:check` after editing community content.

The RSS fetch is limited to 4 MB and 10 seconds. Failed attempts are recorded privately and use the configured 30-minute retry interval, including when there is no successful cache yet, to avoid retrying on every Vercel invocation.

## Structured content and semester maintenance

The sample configuration is `content/app-content/community.json`. Upload the validated file to `app-content/community.json` in the configured Nextcloud application root. The supported categories, university host, and exact RSS path are validated server-side. The Info list and community page use this data; React code does not contain the resource inventory.

Resources currently link to canonical Bauhaus-Universität Weimar pages for Bauhaus Internationals, StuKo, DiversityGuides, and StudyGuides. No contact details are copied into this app. Review these links during semester preparation.

The “Sharing is Caring” Telegram entry is intentionally disabled with an empty URL. To publish it later, add a verified `https://t.me/...` or `https://telegram.me/...` invite and set `sharingIsCaring.enabled` to `true` in the validated `community.json`, then run the content check and publish/upload through the approved process. Do not publish a guessed, personal, expired, or unverified invitation. A content editor UI for this configuration is not implemented yet; until then a coordinator must update the structured file using the documented review and upload workflow.

## What this does not do

It does not scrape arbitrary websites, ingest WhatsApp messages, OCR documents, publish private contact details, or claim that community notice-board content is authoritative university policy. It does not add a new database or student identity.
