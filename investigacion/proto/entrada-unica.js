// PROTOTIPO (opción a): un solo script para la página y el Worker.
// Sin import/export: esbuild lo trata como CommonJS y los require() de abajo envuelven main.js y worker.js (y lo que
// importan) en funciones (__esm) que solo se ejecutan si se llaman. En el Worker no hay `document`.
// El código del Worker es el propio script: su texto (HTML de un solo fichero) o importScripts(src) (varios ficheros).
if (typeof document === 'undefined') {
  require('../../src/app/worker.js');
} else {
  const s = document.currentScript;
  globalThis.__CODIGO_PROPIO__ = s && s.src ? `importScripts(${JSON.stringify(s.src)})` : s ? s.textContent : null;
  require('../../src/app/main.js');
}
