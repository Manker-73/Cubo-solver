// Lado del Web Worker. El Worker ejecuta el mismo script que la página (src/app/entrada.js), creado
// desde un blob con su texto, así que sigue siendo un único HTML sin servidor; entrada.js carga este
// módulo cuando no hay `document`.

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
