// Desglose del tamaño de dist/index.html por módulo y por área (metafile de esbuild).
//   node investigacion/desglose.mjs [--json salida.json]
// Construye igual que scripts/construir.mjs (mismas opciones) pero con metafile, y además:
//   - cuánto del script principal está repetido como texto del Worker (duplicación);
//   - gzip y brotli de cada parte (aproximado por área: gzip de los trozos de salida de esa área juntos).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { raiz } from '../scripts/construir.mjs';

const opciones = { bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none', tsconfigRaw: '{}', metafile: true };
const gz = (s) => zlib.gzipSync(Buffer.from(s), { level: 9 }).length;
const br = (s) => zlib.brotliCompressSync(Buffer.from(s), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const kb = (n) => (n / 1024).toFixed(1);

/** Área de un módulo (por su ruta). */
export function area(p) {
  p = p.replace(/\\/g, '/');
  if (p.startsWith('src/aprender/')) return 'modo aprender';
  if (/src\/core\/(bloqueos|tabla-estados|calidad-practico)/.test(p) || /src\/puzzles\/(vendado|cubo3-bloqueos)/.test(p) || /bloqueos-ui/.test(p)) return 'bloqueos (vendados)';
  if (/colocar/.test(p)) return 'colocar piezas';
  if (/src\/app\/(vista3d|escena3d)/.test(p) || /src\/core\/(modelo3d)/.test(p)) return 'vista 3D';
  if (p.startsWith('src/app/')) return 'interfaz';
  if (p.startsWith('src/core/')) return 'núcleo';
  const m = p.match(/src\/puzzles\/([a-z0-9]+)/);
  if (m) {
    const n = m[1];
    if (/^(nxn|cubo|kociemba)/.test(n)) return n === 'kociemba' ? 'puzzle: 3x3 (Kociemba)' : 'puzzle: NxN';
    if (/^megaminx/.test(n)) return 'puzzle: megaminx';
    if (/^square1/.test(n)) return 'puzzle: square-1';
    if (/^fto/.test(n)) return 'puzzle: FTO';
    if (/^cuboide/.test(n)) return 'puzzle: cuboides';
    if (/^shapemod/.test(n)) return 'puzzle: shape mods';
    if (n === 'index') return 'registro de puzzles';
    return 'puzzle: ' + n;
  }
  return 'otros';
}

async function construir(entrada, extra = {}) {
  const r = await build({ entryPoints: [path.join(raiz, entrada)], ...opciones, ...extra });
  return { texto: r.outputFiles[0].text, meta: r.metafile };
}

const worker = await construir('src/app/worker.js');
const app = await construir('src/app/main.js', { define: { __CODIGO_WORKER__: JSON.stringify(worker.texto) } });
const appSin = await construir('src/app/main.js', { define: { __CODIGO_WORKER__: 'null' } });

const modulos = (meta) => Object.values(meta.outputs)[0].inputs;
const mApp = modulos(appSin.meta), mWk = modulos(worker.meta);
const filas = new Map();
const suma = (k, campo, n) => { const f = filas.get(k) || { app: 0, worker: 0, dup: 0, mods: 0 }; f[campo] += n; filas.set(k, f); };
for (const [p, i] of Object.entries(mApp)) { suma(area(p), 'app', i.bytesInOutput); suma(area(p), 'mods', 1); if (mWk[p]) suma(area(p), 'dup', i.bytesInOutput); }
for (const [p, i] of Object.entries(mWk)) suma(area(p), 'worker', i.bytesInOutput);

const css = fs.readFileSync(path.join(raiz, 'src/app/estilos.css'), 'utf8');
const plantilla = fs.readFileSync(path.join(raiz, 'src/app/plantilla.html'), 'utf8');
const fuentes = fs.readdirSync(path.join(raiz, 'src/app/fuentes')).filter((f) => f.endsWith('.woff2')).map((f) => [f, fs.statSync(path.join(raiz, 'src/app/fuentes', f)).size]);
const html = fs.readFileSync(path.join(raiz, 'dist/index.html'), 'utf8');
const textoWorkerEnHtml = JSON.stringify(worker.texto).length;

const res = {
  html: { bytes: Buffer.byteLength(html), gzip: gz(html), brotli: br(html) },
  scriptPrincipalSinWorker: { bytes: appSin.texto.length, gzip: gz(appSin.texto), brotli: br(appSin.texto) },
  textoWorker: { bytes: textoWorkerEnHtml, gzip: gz(worker.texto), brotli: br(worker.texto) },
  // lo que añade el texto del Worker al HTML comprimido (comprimido junto al resto: gzip no ve repeticiones a > 32 KB)
  htmlSinWorker: (() => { const h = html.replace(JSON.stringify(worker.texto).replace(/<\/script/gi, '<\\/script'), 'null'); return { bytes: Buffer.byteLength(h), gzip: gz(h), brotli: br(h) }; })(),
  css: { bytes: css.length, gzip: gz(css) },
  plantilla: { bytes: plantilla.length },
  fuentes: Object.fromEntries(fuentes.map(([f, n]) => [f, { woff2: n, base64: Math.ceil(n / 3) * 4 }])),
  areas: Object.fromEntries([...filas].sort((a, b) => b[1].app - a[1].app)),
  modulos: Object.fromEntries(Object.entries(mApp).sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput).map(([p, i]) => [p, { bytes: i.bytesInOutput, enWorker: !!mWk[p] }])),
};
const salida = process.argv.indexOf('--json');
if (salida > 0) fs.writeFileSync(process.argv[salida + 1], JSON.stringify(res, null, 1));

console.log(`HTML: ${kb(res.html.bytes)} KB, gzip ${kb(res.html.gzip)}, brotli ${kb(res.html.brotli)}`);
console.log(`  script principal (sin el texto del Worker): ${kb(res.scriptPrincipalSinWorker.bytes)} KB (gzip ${kb(res.scriptPrincipalSinWorker.gzip)})`);
console.log(`  texto del Worker: ${kb(res.textoWorker.bytes)} KB (gzip ${kb(res.textoWorker.gzip)} por separado)`);
console.log(`  HTML sin el texto del Worker: ${kb(res.htmlSinWorker.bytes)} KB, gzip ${kb(res.htmlSinWorker.gzip)}, brotli ${kb(res.htmlSinWorker.brotli)}`);
console.log(`  CSS ${kb(res.css.bytes)} KB; fuentes (base64): ${fuentes.map(([f, n]) => `${f} ${kb(Math.ceil(n / 3) * 4)}`).join(', ')}`);
console.log('\nÁrea | script principal KB | también en el Worker KB | Worker KB | módulos');
let tot = { app: 0, dup: 0, worker: 0 };
for (const [k, f] of Object.entries(res.areas)) { console.log(`${k} | ${kb(f.app)} | ${kb(f.dup)} | ${kb(f.worker)} | ${f.mods}`); tot.app += f.app; tot.dup += f.dup; tot.worker += f.worker; }
console.log(`TOTAL | ${kb(tot.app)} | ${kb(tot.dup)} | ${kb(tot.worker)}`);
console.log('\nMódulos más grandes:');
for (const [p, i] of Object.entries(res.modulos).slice(0, 25)) console.log(`  ${kb(i.bytes).padStart(6)} KB ${i.enWorker ? 'W' : ' '} ${p}`);
