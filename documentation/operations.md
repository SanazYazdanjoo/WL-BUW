# Setup, operation and verification

## Setup

Use a Node version compatible with installed Vite; local development used Node 22.16.0.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Set `NEXTCLOUD_USERNAME` and `NEXTCLOUD_APP_PASSWORD` in .env.local. Create an app password in Nextcloud personal settings under Security. Use the account ID, which may differ from its display name. The account must have access to Welcome.Lounge_WiSe2026_27/S.Y.

Never commit credentials or give them a VITE_ prefix. Run `npm run dev`, open the printed address and restart after environment changes. A browser login to Nextcloud does not authenticate the backend.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development frontend and API |
| `npm test` | Five Node backend tests |
| `npm run lint` | ESLint |
| `npm run build` | Build dist |
| `npm run preview` | Local build preview with API |
| `npm start` | Standalone Node build/API server |

Run the standalone server from the repository root after building. Defaults are HOST=127.0.0.1 and PORT=3000; override via server environment. Server-injected Nextcloud credentials can replace .env.local.

## Deployment

Deploy both backend and frontend. Static-only hosting cannot serve the Nextcloud API. Provide outbound HTTPS access to the university server. Use the standalone server for runtime rather than treating Vite preview as production hosting.

The app has no visitor authentication: reachable API clients use the configured account's access to the source folder. Put external deployments behind appropriate organizational access control and HTTPS. Subpath hosting requires route/API URL configuration changes.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Connection not configured / 503 | Both credentials exist on the server; restart after changes |
| Access denied / 502 | Account ID, app password and folder permissions |
| Resource missing / 404 | Relative path and source folder visible to the account |
| Unable to read Nextcloud / 502 | Network, upstream availability, redirects or timeout |
| Service unavailable in frontend | API returned non-JSON; ensure middleware is running |
| UI works but hosted API fails | Backend must be deployed along with dist |
| No preview for a format | Use a compatible local app or a supported Nextcloud viewer |
| Search misses document text | Search only checks names in the current folder |

## Verification

Tests cover path rejection and filename encoding; WebDAV folder/file parsing and exclusion rules; missing credentials, traversal and unsupported methods without upstream access; unchanged binary streaming as an attachment; and sanitized authentication errors.

Local browser inspection confirmed the page, navigation, search input and setup-needed state, with no JavaScript error. Standalone HTTP checks returned HTML for the home/file routes and JSON 503 for the unconfigured API.

After providing real credentials, check root listing, nested navigation, spaces and non-ASCII filenames, a binary download and the corresponding Nextcloud link. These authenticated checks remain pending. No uploads or edits are needed to verify this read-only integration.

Protocol reference used during implementation: [Nextcloud WebDAV basics](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/basic.html).
