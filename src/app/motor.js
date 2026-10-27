// Motor de cálculo de la interfaz: envía las tareas pesadas (tablas, scrambles
// de estado aleatorio, validación y búsquedas) a un Web Worker creado desde un
// blob. Si no hay Worker (o no arranca, o falla), todo sigue funcionando en el
// hilo principal con el mismo servicio.

import { atender } from './servicio.js';

const PING_MS = 4000;

/**
 * crearMotor({ codigoWorker, alCambiarModo })
 *   codigoWorker: texto del worker empaquetado (o null para no usar Worker)
 * Devuelve { pedir(op, puzzle, datos) -> Promise, modo(), listo -> Promise }.
 */
export function crearMotor({ codigoWorker = null, alCambiarModo = () => {} } = {}) {
  let worker = null;
  let modo = 'local';
  let siguiente = 1;
  const pendientes = new Map(); // id -> { msg, resolver, rechazar }

  const local = async (msg) => {
    // dejar que la página se pinte antes de bloquear el hilo
    await new Promise((r) => setTimeout(r, 30));
    return atender(msg);
  };

  function pasarALocal(motivo) {
    if (modo === 'local' && !worker) return;
    modo = 'local';
    if (worker) { try { worker.terminate(); } catch { /* nada */ } }
    worker = null;
    alCambiarModo(modo, motivo);
    // rehacer en el hilo principal lo que estuviera pendiente
    const lista = [...pendientes.values()];
    pendientes.clear();
    for (const p of lista) local(p.msg).then(p.resolver, p.rechazar);
  }

  let listo = Promise.resolve();
  if (codigoWorker && typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    try {
      const url = URL.createObjectURL(new Blob([codigoWorker], { type: 'text/javascript' }));
      worker = new Worker(url);
      modo = 'worker';
      worker.onmessage = (ev) => {
        const { id, ok, resultado, error } = ev.data || {};
        const p = pendientes.get(id);
        if (!p) return;
        pendientes.delete(id);
        if (ok) p.resolver(resultado); else p.rechazar(new Error(error));
      };
      worker.onerror = (ev) => {
        if (ev && ev.preventDefault) ev.preventDefault();
        pasarALocal('el Worker ha fallado');
      };
      // Comprobar que arranca de verdad (algunas páginas bloquean los workers de blob)
      listo = new Promise((resolve) => {
        const t = setTimeout(() => { pasarALocal('el Worker no responde'); resolve(); }, PING_MS);
        enviar({ op: 'ping' }).then(() => { clearTimeout(t); resolve(); }, () => { clearTimeout(t); resolve(); });
      });
    } catch (err) {
      worker = null;
      modo = 'local';
    }
  }
  alCambiarModo(modo, worker ? null : 'Worker no disponible');

  function enviar(msg) {
    if (!worker) return local(msg);
    const id = siguiente++;
    return new Promise((resolver, rechazar) => {
      pendientes.set(id, { msg, resolver, rechazar });
      try { worker.postMessage({ id, ...msg }); } catch (err) { pendientes.delete(id); pasarALocal('no se pudo enviar al Worker'); local(msg).then(resolver, rechazar); }
    });
  }

  return {
    pedir: (op, puzzle, datos = {}) => enviar({ op, puzzle, ...datos }),
    modo: () => modo,
    listo,
  };
}
