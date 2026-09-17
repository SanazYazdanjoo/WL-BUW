# Welcome Lounge file directory

React + Vite frontend with a read-only Nextcloud WebDAV backend. The configured root is:

https://nextcloud.uni-weimar.de/apps/files/files?dir=/Welcome.Lounge_WiSe2026_27/S.Y

Browse subfolders, search filenames in the current folder, inspect file details, download any file type, or open the containing folder in Nextcloud. Downloads preserve the original bytes. Viewing and editing in Nextcloud depend on its installed apps; the website does not extract arbitrary documents into FAQ text or promise previews for every format.

## Connect Nextcloud

1. Use Node.js 22.16+ and run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXTCLOUD_USERNAME` to your Nextcloud account ID and `NEXTCLOUD_APP_PASSWORD` to an app password created under Nextcloud personal settings → Security. The account must have access to the configured folder.
4. Run `npm run dev`. Restart after changing credentials.

The supplied folder link requires authentication. A successful live connection requires the above local configuration; no credentials are included in the repository. Browser login cookies are not used by the backend.

Only the Node server reads the credentials. Never prefix them with `VITE_`. Environment files are ignored by Git. Requests can only read the configured `S.Y` folder and its descendants; redirects and parent-directory traversal are rejected.

The local server grants its visitors read access to this folder using the configured account. It binds to localhost by default. Before exposing it to other users, place it behind your organization's authentication/access control and confirm that those users should have access to every file under `S.Y`. The Nextcloud login itself still applies when following an “Open in Nextcloud” link.

## Run and validate

- `npm run dev`: Vite and the Nextcloud API during development.
- `npm test`: WebDAV parsing, folder confinement, binary download, configuration and authentication failure checks using mocked upstream responses.
- `npm run lint`: ESLint.
- `npm run build`: build the frontend.
- `npm start`: serve the built frontend and API with Node on `127.0.0.1:3000`. Optional server settings: `HOST`, `PORT`.
- `npm run preview`: local Vite preview including the API.

Production requires a Node server or equivalent backend; uploading `dist` alone to static hosting will not provide the Nextcloud API. Inject `NEXTCLOUD_USERNAME` and `NEXTCLOUD_APP_PASSWORD` on the server, or use `.env.local` at the project root. Content is read live on folder navigation or refresh; it is not copied into the frontend build.

WebDAV reference: https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/basic.html

## Development documentation

See [project documentation](documentation/README.md) for decisions, technical implementation, operations and the development log.
