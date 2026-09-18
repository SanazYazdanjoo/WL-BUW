# Content guide for Welcome Lounge staff

## First setup

1. In the configured Nextcloud root, create `app-content` and `documents` if they do not exist. Do not move unrelated files.
2. Upload the JSON examples from `content/app-content`, including `community.json`. These contain samples/configuration, not a substitute for university instructions.
3. Replace topic text using the approved International Office source. Do not ask the application to interpret PDFs or Word files automatically.
4. Add only approved public documents to `documents/<topic>/`, then reference each file in its topic's `documents` array. Downloads require an exact reference in an active, non-demo topic from valid Nextcloud content. Unlinked, inactive and demo-only documents are denied. Missing/invalid content does not grant access.
5. Review the student page on a phone. Set `isDemo` to `false` only after approval; leave `isActive` false for unpublished topics/events.

JSON can be maintained in Nextcloud's text editor where installed, or downloaded, edited in a plain-text editor and uploaded again. Preserve double quotes, commas, brackets and `version: 1`. Rich text/HTML is not interpreted. A visual admin editor is not implemented. Back up the previous files before editing and use Nextcloud version history if available.

## Configuration (`config.json`)

- `semesterLabel`: e.g. `Winter Semester 2026/27`.
- `whatsappEnabled`: `true` only when the invitation has been confirmed.
- `whatsappGroupUrl`: current HTTPS `chat.whatsapp.com` group invitation. Empty or invalid links are disabled. External services open in a new tab.
- `contactLabel`: team label, e.g. `Welcome Lounge team`.
- `helpText`: confirmed fallback contact instructions, as plain text. Do not place private contact information here.

Disable WhatsApp first when an old semester ends. Publish the new invitation and label together. Reload the app to see changes; no rebuild is required. An already-open page retains its loaded content until reloaded.

## Topics (`onboarding.json`, `after-arrival.json`)

Each file has `version: 1` and a `topics` array. Every topic requires:

| Field | Meaning |
| --- | --- |
| `id` | Stable lowercase ID using letters, digits and hyphens; do not change just to edit text |
| `order` | Integer display order |
| `title`, `shortTitle`, `summary` | Heading and short introduction |
| `eyebrow` | Optional short contextual label; use neutral wording until reviewed. Defaults to `Your first weeks` for older content |
| `description`, `why` | Explanation and why it matters |
| `actions` | Ordered array of plain-text action steps |
| `documents` | Array of `{ "label": "Form name", "path": "documents/enrollment/form.pdf" }` |
| `faqs` | Array of `{ "id": "stable-question-id", "question": "...", "answer": "..." }` |
| `importantNotes` | Array of plain-text notes |
| `category` | Editorial category, e.g. `first-week` |
| `isActive` | Whether to publish the topic |
| `isDemo` | Whether it is sample content |

Empty arrays are allowed. IDs must be unique within each file (FAQ IDs within their topic). No absolute document paths, dot segments, hidden files, percent signs, backslashes or control characters. Spaces and Unicode filenames are supported. Download paths are relative to the configured root, never to a personal browser URL.

Each text field is bounded; long explanations allow up to 12,000 characters, titles 200, IDs 80. Each list supports up to 100 entries; a JSON file is limited to 512,000 bytes. Text is rendered literally, not as HTML. An invalid file falls back as a whole to clearly labelled samples. Inactive entries must still have valid fields.

## Events (`events.json`)

Use `version: 1` and `events`. Each event has `id`, `title`, `date` (`YYYY-MM-DD`), `startTime`/`endTime` (`HH:mm`), `location`, `description`, `externalLink` (HTTPS or empty), `isActive`, `isDemo`. Times are Weimar local time; end time must not precede start time. Split multi-day events into dated entries. Confirmed past events are omitted; demo events are separated and never presented as real upcoming events.

## Semester change / institutional move

1. Back up all four JSON files and approved documents.
2. Disable the old WhatsApp invitation, update semester/contact text, then confirm the new invitation.
3. Review all topics/documents, remove or deactivate outdated events, and mark approved content accurately.
4. Keep topic IDs stable; progress persists per browser and is not automatically reset each semester. Students can reset it themselves.
5. If moving to `/Welcome-Lounge-App`, copy the same structure there through the approved institutional process. Set `NEXTCLOUD_ROOT_FOLDER` on the server/Vercel and redeploy for environment changes. Content edits alone do not require redeployment.
6. Replace the personal account/app password with an institutional account and rotate/revoke the previous password after verifying access.

## When content does not appear

Check exact filenames, JSON syntax, required fields and folder access. The student app deliberately shows a safe sample instead of raw errors. Server logs identify the failed content kind without credentials or private upstream bodies. Correct the file, reload or use Try again. No uploaded file is changed by the application.

To validate a local draft before uploading, run `node scripts/check-content.js /path/to/draft/app-content`. `npm run content:check` validates the repository examples. These commands do not upload anything. Correct a reported file using the field guide above, then validate again.
