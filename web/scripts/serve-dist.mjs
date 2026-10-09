// Servidor estático que replica o Firebase Hosting (firebase.json): trailingSlash:false, index.html por
// diretório (HTML prerenderizado das rotas públicas), rewrites, headers/CSP e brotli. Usado pelo Lighthouse CI
// porque `vite preview` NÃO serve dist/<rota>/index.html e mediria o shell SPA em vez do que vai ao ar (#4196).
// uso: node scripts/serve-dist.mjs [distDir=dist] [port=4173] [firebase.json=../firebase.json]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dist = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 4173);
const fbPath = path.resolve(process.argv[4] || '../firebase.json');
const fb = JSON.parse(fs.readFileSync(fbPath, 'utf8')).hosting;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.xml': 'text/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const headerRules = (fb.headers || []).map((h) => ({ re: g2(h.source), headers: h.headers }));
function g2(src) {
  // suporta **, *, e @(a|b)
  let r = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '*' && src[i + 1] === '*') { r += '.*'; i++; if (src[i + 1] === '/') { r += '(?:'; r = r.slice(0, -3) + '(?:.*/)?'; i++; } }
    else if (c === '*') r += '[^/]*';
    else if (c === '@' && src[i + 1] === '(') { const j = src.indexOf(')', i); r += '(?:' + src.slice(i + 2, j) + ')'; i = j; }
    else if ('.+^${}|\\'.includes(c)) r += '\\' + c;
    else r += c;
  }
  return new RegExp('^' + r + '$');
}
const cache = new Map();
function send(req, res, file, status = 200) {
  const ext = path.extname(file);
  let body = cache.get(file);
  if (!body) { body = fs.readFileSync(file); cache.set(file, body); }
  const urlPath = req.url.split('?')[0];
  const headers = { 'Content-Type': mime[ext] || 'application/octet-stream' };
  for (const r of headerRules) if (r.re.test(urlPath) || r.re.test(path.posix.join('/', path.relative(dist, file).replace(/\\/g, '/')))) for (const h of r.headers) headers[h.key] = h.value;
  if (/text|javascript|json|svg|xml/.test(headers['Content-Type']) && /br/.test(req.headers['accept-encoding'] || '')) {
    const k = file + '#br';
    let z = cache.get(k);
    if (!z) { z = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }); cache.set(k, z); }
    headers['Content-Encoding'] = 'br'; headers['Vary'] = 'Accept-Encoding';
    res.writeHead(status, headers); res.end(z);
  } else { res.writeHead(status, headers); res.end(body); }
}
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const abs = path.join(dist, urlPath);
  if (!abs.startsWith(path.resolve(dist))) { res.writeHead(403); return res.end(); }
  if (isFile(abs)) return send(req, res, abs);
  const idx = path.join(abs, 'index.html');
  if (isFile(idx)) return send(req, res, idx);
  if (urlPath.startsWith('/assets/')) return send(req, res, path.join(dist, 'asset-fallback.js'));
  return send(req, res, path.join(dist, 'index.html'));
}).listen(port, '127.0.0.1', () => console.log('listening', port));
