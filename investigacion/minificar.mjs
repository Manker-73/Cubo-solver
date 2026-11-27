// Variantes de minificación del script (tamaño crudo y gzip): node investigacion/minificar.mjs
import { build } from 'esbuild';
import path from 'node:path';
import zlib from 'node:zlib';
import { raiz } from '../scripts/construir.mjs';
const gz = (s) => zlib.gzipSync(Buffer.from(s), { level: 6 }).length;
const kb = (n) => (n / 1024).toFixed(1);
const base = { bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none', tsconfigRaw: '{}' };
async function med(nombre, extra = {}) {
  const w = (await build({ entryPoints: [path.join(raiz, 'src/app/worker.js')], ...base, ...extra })).outputFiles[0].text;
  const a = (await build({ entryPoints: [path.join(raiz, 'src/app/main.js')], ...base, ...extra, define: { __CODIGO_WORKER__: JSON.stringify(w) } })).outputFiles[0].text;
  const s = (await build({ entryPoints: [path.join(raiz, 'src/app/main.js')], ...base, ...extra, define: { __CODIGO_WORKER__: 'null' } })).outputFiles[0].text;
  console.log(`${nombre.padEnd(34)} con Worker ${kb(Buffer.byteLength(a))} KB (gzip ${kb(gz(a))}) | sin Worker ${kb(Buffer.byteLength(s))} KB (gzip ${kb(gz(s))}) | Worker ${kb(Buffer.byteLength(w))} (gzip ${kb(gz(w))})`);
  return { a, s, w };
}
await med('actual (minify, es2020)');
await med('charset utf8', { charset: 'utf8' });
await med('es2022', { target: ['es2022'] });
await med('charset utf8 + es2022 + drop debugger', { charset: 'utf8', target: ['es2022'], drop: ['debugger'] });
await med('sin minify (referencia)', { minify: false });
