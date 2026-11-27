// @ts-check
// Punto de entrada del build (scripts/construir.mjs): la página y el Web Worker son el MISMO script.
//
// - En la página (hay `document`): arranca la interfaz (main.js) y le pasa el texto de este mismo script
//   para crear los Workers desde un blob. Así el código de los solvers va una sola vez en el HTML (antes
//   iba otra vez entero como texto del Worker: 136 de los 376 KB descargados; ver docs/investigacion-carga.md).
// - En el Worker (no hay `document`): atiende los mensajes (worker.js).
//
// Los dos lados se cargan con import(): en el build (un solo fichero, sin trozos) esbuild deja cada módulo
// envuelto en una función que solo se ejecuta al pedirlo, así que cada hilo ejecuta solo su parte (la
// página no ejecuta worker.js y el Worker no ejecuta la interfaz).
//
// `document.currentScript` solo existe mientras se ejecuta el script por primera vez: se lee aquí, antes de
// cualquier espera. Si no está (o el script no va incrustado), no hay código para el Worker y el motor
// calcula en el hilo principal, como cuando el navegador no tiene Workers.

if (typeof document === 'undefined') {
  import('./worker.js');
} else {
  const script = document.currentScript;
  const codigoWorker = script && !(/** @type {HTMLScriptElement} */ (script).src) ? script.textContent : null;
  import('./main.js').then((m) => m.iniciar({ codigoWorker: codigoWorker || null }));
}
