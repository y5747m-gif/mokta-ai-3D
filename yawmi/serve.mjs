#!/usr/bin/env node
/* ============================================================
 * serve.mjs — خادم محلي بسيط لتشغيل "يومي | YAWMI" أثناء التطوير
 * التشغيل:  node serve.mjs   (أو npm start)
 * يخدم الملفات الثابتة من مجلد yawmi الحالي.
 * ============================================================ */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403).end('403');
      return;
    }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) {
      // SPA fallback
      const html = await readFile(join(root, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(html);
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500).end('500');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('YAWMI dev server → http://localhost:' + PORT);
});
