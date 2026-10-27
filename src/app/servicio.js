// Servicio de cálculo: genera tablas, scrambles, valida y resuelve.
// Lo usan el Web Worker (worker.js) y, si no hay Worker, el hilo principal
// (motor.js). Solo usa la interfaz común de los puzzles.

import { PUZZLES } from '../puzzles/index.js';
import { rngSeguro } from '../core/rng.js';

const rng = rngSeguro();
const ahora = () => (globalThis.performance || Date).now();

/**
 * Atiende una petición { op, puzzle, estado, opciones } y devuelve el resultado
 * (lanza un error si algo falla). Operaciones:
 *   ping                      -> 'ok'
 *   inicializar               -> { ms, yaEstaba }
 *   scramble                  -> { movimientos, ms }
 *   validar   (estado)        -> { valido, errores }
 *   resolver  (estado)        -> { ok, movimientos, errores, ms }
 */
export function atender(msg) {
  if (msg.op === 'ping') return 'ok';
  const p = PUZZLES.find((x) => x.id === msg.puzzle);
  if (!p) throw new Error(`Puzzle desconocido: ${msg.puzzle}`);
  switch (msg.op) {
    case 'inicializar': {
      if (p.estaInicializado()) return { ms: 0, yaEstaba: true };
      const t0 = ahora();
      const r = p.inicializar();
      return { ms: Math.round(r && r.ms ? r.ms : ahora() - t0), yaEstaba: false };
    }
    case 'scramble': {
      const t0 = ahora();
      const movimientos = p.generarScramble(rng);
      return { movimientos, ms: ahora() - t0 };
    }
    case 'validar': {
      if (!p.capacidades.validar) throw new Error(`${p.nombre} no tiene validador`);
      const v = p.validar(msg.estado);
      return { valido: v.valido, errores: v.errores };
    }
    case 'resolver': {
      if (!p.capacidades.resolver) throw new Error(`${p.nombre} no tiene solucionador`);
      const r = p.resolver(msg.estado, msg.opciones || {});
      return { ok: r.ok, movimientos: r.movimientos || [], errores: r.errores || [], ms: r.ms };
    }
    default:
      throw new Error(`Operación desconocida: ${msg.op}`);
  }
}
