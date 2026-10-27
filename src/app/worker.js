// Punto de entrada del Web Worker. scripts/build.mjs lo empaqueta aparte y lo
// incrusta como texto en la app; la app crea el Worker desde un blob, así que
// sigue siendo un único HTML sin servidor.

import { atender } from './servicio.js';

self.onmessage = (ev) => {
  const { id, ...msg } = ev.data || {};
  const t0 = (self.performance || Date).now();
  try {
    const resultado = atender(msg);
    self.postMessage({ id, ok: true, resultado, ms: (self.performance || Date).now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
