#!/usr/bin/env node
/**
 * NOÖSPHERE // OS — zero-dependency static server
 * ============================================================
 * The project has no build step, so serving it should not require a toolchain
 * either. This is a deliberately small static file server used by `npm start`
 * and by the documented local-development workflow.
 *
 * Design notes:
 *  - Binds 0.0.0.0 so it is reachable from containers, VMs and remote sandboxes.
 *  - Does not restrict Host/Origin, so it works behind reverse proxies.
 *  - Sends no X-Frame-Options / CSP frame-ancestors, so it can be embedded.
 *  - Refuses path traversal and any dotfile below the project root.
 *
 * Usage: node scripts/serve.mjs [--port 4173] [--host 0.0.0.0]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, normalize, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const PORT = Number(arg('port', process.env.PORT ?? 4173));
const HOST = arg('host', process.env.HOST ?? '0.0.0.0');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const target = resolve(join(ROOT, normalize(pathname)));
    // Containment check: the resolved path must live inside ROOT, and no segment
    // may start with a dot (blocks .git, .env, .github tooling, etc.).
    const inside = target === ROOT || target.startsWith(ROOT + sep);
    const hidden = pathname.split('/').some((seg) => seg.startsWith('.'));
    if (!inside || hidden) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('403 Forbidden');
    }

    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`500 ${err.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`NOÖSPHERE // OS  →  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`serving ${ROOT} (no build step, no dependencies)`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
