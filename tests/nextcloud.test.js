import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { cleanPath, davUrl, parseListing, nextcloudMiddleware } from '../server/nextcloud.js';

test('paths remain inside the configured folder and encode filenames', () => {
  for (const path of ['../secret', 'sub/../secret', 'sub\\secret', './secret', '\u0000']) assert.throws(() => cleanPath(path));
  assert.ok(davUrl('test', 'A #/über.pdf').endsWith('/Welcome.Lounge_WiSe2026_27/S.Y/A%20%23/%C3%BCber.pdf'));
});

test('WebDAV listing handles folders, arbitrary file types, failed properties and self entries', () => {
  const base = new URL(davUrl('test')).pathname;
  const entry = (href, props, status = '200 OK') => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${props}</d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response>`;
  const xml = `<d:multistatus xmlns:d="DAV:">${entry(base, '<d:resourcetype><d:collection/></d:resourcetype>')}${entry(`${base}/Report%20%26%20notes.xyz`, '<d:resourcetype/><d:getcontentlength>42</d:getcontentlength>')}${entry(`${base}/Docs/`, '<d:resourcetype><d:collection/></d:resourcetype>')}${entry(`${base}/hidden`, '', '403 Forbidden')}${entry('/elsewhere/private', '')}</d:multistatus>`;
  const entries = parseListing(xml, davUrl('test'), '');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].isFolder, true);
  assert.equal(entries[1].name, 'Report & notes.xyz');
  assert.equal(entries[1].size, 42);
  assert.throws(() => parseListing('<html>Login</html>', davUrl('test'), ''));
});

async function withApi(env, fetchImpl, run) {
  const handler = nextcloudMiddleware(env, fetchImpl);
  const server = createServer((req, res) => handler(req, res, () => res.writeHead(404).end()));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('missing credentials, traversal and writes never contact Nextcloud', async () => {
  await withApi({}, () => { throw new Error('Unexpected request'); }, async base => {
    assert.equal((await fetch(`${base}/api/nextcloud/files`)).status, 503);
    assert.equal((await fetch(`${base}/api/nextcloud/files?path=..%2Fsecret`)).status, 400);
    assert.equal((await fetch(`${base}/api/nextcloud/files`, { method: 'POST' })).status, 405);
  });
});

test('binary files stream unchanged as attachments and credentials stay server-side', async () => {
  const binary = new Uint8Array([0, 255, 12, 65]);
  await withApi({ NEXTCLOUD_USERNAME: 'test', NEXTCLOUD_APP_PASSWORD: 'test-secret' }, async (url, options) => {
    assert.equal(url, davUrl('test', 'Docs/file.bin'));
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.ok(options.headers.Authorization.startsWith('Basic '));
    return new Response(binary);
  }, async base => {
    const response = await fetch(`${base}/api/nextcloud/download?path=Docs%2Ffile.bin`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-disposition').startsWith('attachment;'));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), binary);
  });
});

test('authentication errors are useful without exposing upstream responses', async () => {
  await withApi({ NEXTCLOUD_USERNAME: 'test', NEXTCLOUD_APP_PASSWORD: 'test-secret' }, async () => new Response('private details', { status: 401 }), async base => {
    const response = await fetch(`${base}/api/nextcloud/files`);
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.match(body, /denied access/);
    assert.ok(!body.includes('private details') && !body.includes('test-secret'));
  });
});
