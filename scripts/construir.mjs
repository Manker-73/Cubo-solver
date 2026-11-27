// Funciones de empaquetado (las usan scripts/build.mjs y los tests).
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// tsconfig.json es solo para comprobar tipos (npm run tipos). esbuild lo leería por su cuenta
// (con "strict" añadiría "use strict" al IIFE y cambiaría lo que se ejecuta): se le pasa uno vacío.
const tsconfigRaw = '{}';

/**
 * Código de la app (texto): un solo script para la página y el Web Worker (src/app/entrada.js).
 * Sin trozos (`splitting`), los import() de entrada.js quedan dentro del mismo fichero, cada uno envuelto
 * en una función que solo se ejecuta al pedirlo (la página no ejecuta el Worker y al revés).
 */
export async function construirApp() {
  const r = await build({
    entryPoints: [path.join(raiz, 'src/app/entrada.js')],
    bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none', tsconfigRaw,
  });
  return { app: r.outputFiles[0].text };
}
