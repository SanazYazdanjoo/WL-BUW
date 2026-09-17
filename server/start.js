import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import process from 'node:process';
import { nextcloudMiddleware } from './nextcloud.js';

try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const api = nextcloudMiddleware(process.env);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  void api(req, res, async () => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, `.${pathname}`);
      if (file !== resolve(root) && !file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
      let target = file;
      try { if (!(await stat(target)).isFile()) target = resolve(root, 'index.html'); }
      catch { target = resolve(root, 'index.html'); }
      await stat(target);
      res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') res.end();
      else await pipeline(createReadStream(target), res);
    } catch {
      if (!res.headersSent) res.writeHead(404).end('Build the application with npm run build first.');
      else res.destroy();
    }
  });
});
server.listen(Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1', () => {
  console.log(`Welcome Lounge running on port ${server.address().port}`);
});
