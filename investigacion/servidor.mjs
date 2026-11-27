// Servidor estático que imita a GitHub Pages para medir la carga:
//   node investigacion/servidor.mjs <directorio> <puerto> [gzip|brotli|nada]
// - gzip (nivel 6, como el que sirve Pages: 959.374 B → 385.676 B el 27/11/2026) si el navegador lo acepta;
//   Pages NO sirve brotli aunque se pida (comprobado con las cabeceras), pero se puede simular con «brotli»;
// - Cache-Control: max-age=600, ETag y Last-Modified, y 304 si coinciden (como Pages).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const [dir = 'dist', puerto = '8765', modo = 'gzip'] = process.argv.slice(2);
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const cache = new Map();

function leer(fichero) {
  const st = fs.statSync(fichero);
  const k = fichero + ':' + st.mtimeMs;
  let c = cache.get(k);
  if (!c) {
    const crudo = fs.readFileSync(fichero);
    const comprimible = /\.(html|js|css|json|svg|webmanifest)$/.test(fichero);
    c = {
      crudo, mtime: st.mtime,
      etag: '"' + crypto.createHash('md5').update(crudo).digest('hex').slice(0, 16) + '"',
      gzip: comprimible ? zlib.gzipSync(crudo, { level: 6 }) : null,
      brotli: comprimible ? zlib.brotliCompressSync(crudo, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }) : null,
    };
    cache.set(k, c);
  }
  return c;
}

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const fichero = path.join(path.resolve(dir), path.normalize(p).replace(/^([/\\])+/, ''));
  if (!fichero.startsWith(path.resolve(dir)) || !fs.existsSync(fichero) || fs.statSync(fichero).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  const c = leer(fichero);
  const cab = { 'Content-Type': tipos[path.extname(fichero)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ETag: c.etag, 'Last-Modified': c.mtime.toUTCString(), Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, cab); res.end(); return; }
  const acepta = String(req.headers['accept-encoding'] || '');
  let cuerpo = c.crudo;
  if (modo === 'brotli' && c.brotli && /\bbr\b/.test(acepta)) { cuerpo = c.brotli; cab['Content-Encoding'] = 'br'; }
  else if (modo !== 'nada' && c.gzip && /\bgzip\b/.test(acepta)) { cuerpo = c.gzip; cab['Content-Encoding'] = 'gzip'; }
  cab['Content-Length'] = cuerpo.length;
  res.writeHead(200, cab);
  res.end(req.method === 'HEAD' ? undefined : cuerpo);
}).listen(Number(puerto), '127.0.0.1', () => console.log(`sirviendo ${dir} en http://127.0.0.1:${puerto}/ (${modo})`));
