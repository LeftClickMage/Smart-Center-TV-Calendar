// Local test server — mirrors what Cloudflare Pages does in production:
// serves public/ as static files and GET /api/feeds (functions/api/feeds.js).
// Run with: npm start   then open http://localhost:3000
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './public/config.js';
import { fetchFeeds } from './lib/feeds.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'text/plain', 'Forbidden');
  try {
    const body = await fs.readFile(file);
    send(res, 200, MIME[path.extname(file)] || 'application/octet-stream', body);
  } catch {
    send(res, 404, 'text/plain', 'Not found');
  }
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

http
  .createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'Method not allowed');
      if (new URL(req.url, 'http://x').pathname === '/api/feeds') {
        return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(await fetchFeeds(config)));
      }
      return await serveStatic(req, res);
    } catch (err) {
      console.error(err);
      send(res, 500, 'application/json', JSON.stringify({ error: 'Could not load the calendars.' }));
    }
  })
  .listen(PORT, () => console.log(`SMART Center calendar running at http://localhost:${PORT}`));
