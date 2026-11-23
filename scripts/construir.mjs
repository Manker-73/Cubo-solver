// Funciones de empaquetado (las usan scripts/build.mjs y los tests).
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// tsconfig.json es solo para comprobar tipos (npm run tipos). esbuild lo leería por su cuenta
// (con "strict" añadiría "use strict" al IIFE y cambiaría lo que se ejecuta): se le pasa uno vacío.
const tsconfigRaw = '{}';

/** Código del Web Worker empaquetado (texto). */
export async function construirWorker() {
  const r = await build({
    entryPoints: [path.join(raiz, 'src/app/worker.js')],
    bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none', tsconfigRaw,
  });
  return r.outputFiles[0].text;
}

/** Código de la app con el del Worker incrustado como texto. */
export async function construirApp() {
  const codigoWorker = await construirWorker();
  const r = await build({
    entryPoints: [path.join(raiz, 'src/app/main.js')],
    bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none',
    define: { __CODIGO_WORKER__: JSON.stringify(codigoWorker) }, tsconfigRaw,
  });
  return { app: r.outputFiles[0].text, worker: codigoWorker };
}
