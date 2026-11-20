// Minimal static server for the browser tests (no dependencies).
// Serves the repository root the way GitHub Pages serves the published site.
// Usage: node tests/e2e/server.js [port]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.argv[2]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || /[\\/](\.git|node_modules)([\\/]|$)/.test(file)) {
    res.writeHead(404).end();
    return;
  }
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
      return;
    }
    // App update test (dados.spec.js): with the cookie `e2e-sw-version=N`, sw.js is served as if it were version N
    // (a new deploy), only for that browser context. Without the cookie, it is served as it is in the repository.
    const swVersion = /(?:^|;\s*)e2e-sw-version=(\d+)/.exec(req.headers.cookie || '');
    if (swVersion && rel === '/sw.js') {
      body = Buffer.from(body.toString('utf8').replace(/meu-treino-v\d+/, 'meu-treino-v' + swVersion[1]));
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(body);
  });
}).listen(PORT, () => {
  console.log(`Meu Treino at http://localhost:${PORT}/`);
});
