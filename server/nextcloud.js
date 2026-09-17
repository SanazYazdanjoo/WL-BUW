import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const origin = 'https://nextcloud.uni-weimar.de';
export const folder = '/Welcome.Lounge_WiSe2026_27/S.Y';
export const folderUrl = `${origin}/apps/files/files?dir=${encodeURIComponent(folder)}`;
const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, processEntities: false });
const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];

export function cleanPath(value = '') {
  if (value.includes('\\') || [...value].some(char => char.charCodeAt(0) < 32) || value.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('Invalid file path.');
  }
  return value.split('/').filter(Boolean).join('/');
}

export function davUrl(username, path = '') {
  const parts = ['remote.php', 'dav', 'files', username, ...folder.split('/').filter(Boolean), ...cleanPath(path).split('/').filter(Boolean)];
  return `${origin}/${parts.map(encodeURIComponent).join('/')}`;
}

export function parseListing(xml, requestUrl, path) {
  if (XMLValidator.validate(xml) !== true || /<!DOCTYPE/i.test(xml)) throw new Error('Invalid Nextcloud response.');
  const parsed = parser.parse(xml);
  if (!parsed.multistatus) throw new Error('Invalid Nextcloud response.');
  const parent = decodeURIComponent(new URL(requestUrl).pathname).replace(/\/$/, '') + '/';
  return asArray(parsed.multistatus.response).flatMap(item => {
    const href = new URL(item.href, origin);
    const decoded = decodeURIComponent(href.pathname).replace(/\/$/, '');
    if (href.origin !== origin || !decoded.startsWith(parent)) return [];
    const name = decoded.slice(parent.length);
    if (!name || name.includes('/')) return [];
    cleanPath(name);
    const prop = asArray(item.propstat).find(value => /\s200\s/.test(value.status))?.prop;
    if (!prop) return [];
    const isFolder = prop.resourcetype != null && typeof prop.resourcetype === 'object' && 'collection' in prop.resourcetype;
    return [{ name, path: [path, name].filter(Boolean).join('/'), isFolder, mimeType: prop.getcontenttype || '', size: Number(prop.getcontentlength) || 0 }];
  }).sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name));
}

export function nextcloudMiddleware(env, fetchImpl = fetch) {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/nextcloud/')) return next();
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    if (!['/api/nextcloud/files', '/api/nextcloud/download'].includes(url.pathname)) return json(404, { error: 'Not found.' });
    if (req.method !== 'GET') return json(405, { error: 'Only reading files is supported.' });
    let path;
    try { path = cleanPath(url.searchParams.get('path') || ''); }
    catch { return json(400, { error: 'Invalid file path.' }); }
    if (!env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD) {
      return json(503, { error: 'The Nextcloud connection has not been configured yet.', folderUrl });
    }
    const listing = url.pathname.endsWith('/files');
    try {
      const target = davUrl(env.NEXTCLOUD_USERNAME, path);
      const response = await fetchImpl(target, {
        method: listing ? 'PROPFIND' : 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.NEXTCLOUD_USERNAME}:${env.NEXTCLOUD_APP_PASSWORD}`).toString('base64')}`,
          ...(listing ? { Depth: '1', 'Content-Type': 'application/xml' } : {}),
        },
        body: listing ? '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontenttype/><d:getcontentlength/></d:prop></d:propfind>' : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(listing ? 20000 : 300000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const status = response.status === 404 ? 404 : 502;
        const error = [401, 403].includes(response.status) ? 'Nextcloud denied access. Check the server credentials and folder permissions.' : response.status === 404 ? 'This Nextcloud file or folder was not found.' : 'Nextcloud could not load the requested files.';
        return json(status, { error, folderUrl });
      }
      if (listing) return json(200, { entries: parseListing(await response.text(), target, path), folderUrl });
      // Always download arbitrary files; HTML/SVG must not execute on the app's origin.
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(path.split('/').at(-1) || 'download').replace(/'/g, '%27')}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      await pipeline(Readable.fromWeb(response.body), res);
    } catch {
      if (!res.headersSent) json(502, { error: 'Unable to read Nextcloud. Check the connection and try again.', folderUrl });
      else res.destroy();
    }
  };
}
