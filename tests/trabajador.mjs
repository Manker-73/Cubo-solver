// Hilo de trabajo de tests/paralelo.mjs: resuelve los casos que le manda el hilo principal.
import { parentPort, workerData } from 'node:worker_threads';

const { modulo, exportar, args, estadisticas } = workerData;
const m = await import(modulo);
const f = m[exportar];
const puzzle = typeof f === 'function' ? f(...args) : f;
const ini = puzzle.inicializar ? puzzle.inicializar() : { ms: 0 };
const est = estadisticas ? (await import(estadisticas.modulo))[estadisticas.exportar] : null;
const est0 = est ? { ...est } : null;
parentPort.postMessage({ listo: true, msTablas: ini && ini.ms });
parentPort.on('message', (msg) => {
  if (msg.fin) {
    const delta = {};
    if (est) for (const [k, v] of Object.entries(est)) if (typeof v === 'number') delta[k] = v - (est0[k] || 0);
    parentPort.postMessage({ fin: true, estadisticas: delta });
    return;
  }
  try {
    const t0 = performance.now();
    // modo aprender: opciones.aprender = método humano
    const r = msg.opciones && msg.opciones.aprender ? puzzle.aprender(msg.estado, msg.opciones.aprender) : puzzle.resolver(msg.estado, msg.opciones);
    const ms = performance.now() - t0;
    parentPort.postMessage({ i: msg.i, r, ms });
  } catch (err) {
    parentPort.postMessage({ i: msg.i, error: String(err && err.stack || err) });
  }
});
