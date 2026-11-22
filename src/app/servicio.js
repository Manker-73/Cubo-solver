// Servicio de cálculo: genera tablas, scrambles, valida y resuelve.
// Lo usan el Web Worker (worker.js) y, si no hay Worker, el hilo principal
// (motor.js). Solo usa la interfaz común de los puzzles.

import { PUZZLES } from '../puzzles/index.js';
import { rngSeguro } from '../core/rng.js';
import { puzzleConBloqueos, claveBloqueos } from '../core/bloqueos.js';

const rng = rngSeguro();
const ahora = () => (globalThis.performance || Date).now();

// Puzzles con bloqueos (cubos vendados): uno por configuración, con sus tablas.
// Se guardan los últimos (las tablas de un espacio pequeño pueden ocupar decenas de MB).
const CONFIGS_GUARDADAS = 3;
const conBloqueos = new Map();
/** El puzzle de la petición: el del registro o, si trae bloqueos, su versión vendada. */
export function puzzleDePeticion(msg) {
  const p = PUZZLES.find((x) => x.id === msg.puzzle);
  if (!p) throw new Error(`Puzzle desconocido: ${msg.puzzle}`);
  const def = msg.bloqueos;
  if (!def || !def.length || !p.soporteBloqueos) return p;
  const k = p.id + '#' + claveBloqueos(def);
  let q = conBloqueos.get(k);
  if (q) { conBloqueos.delete(k); conBloqueos.set(k, q); return q; }
  q = puzzleConBloqueos(p, def);
  conBloqueos.set(k, q);
  while (conBloqueos.size > CONFIGS_GUARDADAS) conBloqueos.delete(conBloqueos.keys().next().value);
  return q;
}

/**
 * Atiende una petición { op, puzzle, estado, opciones, bloqueos } y devuelve el resultado
 * (lanza un error si algo falla). Operaciones:
 *   ping                      -> 'ok'
 *   inicializar               -> { ms, yaEstaba, analisis } (analisis: solo con bloqueos)
 * Con `bloqueos` ([[clave de pieza, ...]], ver src/core/bloqueos.js) se usa el
 * puzzle vendado de esa configuración (sus tablas se generan una vez y se guardan).
 *   scramble                  -> { movimientos, ms }
 *   validar   (estado)        -> { valido, errores }
 *   resolver  (estado)        -> { ok, movimientos, errores, ms, fases }
 *   aprender  (estado, opciones.metodo) -> guion del método humano (ver src/aprender/guion.js)
 */
export function atender(msg) {
  if (msg.op === 'ping') return 'ok';
  const p = puzzleDePeticion(msg);
  switch (msg.op) {
    case 'inicializar': {
      const analisis = () => (p.analisis ? p.analisis() : undefined);
      if (p.estaInicializado()) return { ms: 0, yaEstaba: true, analisis: analisis() };
      const t0 = ahora();
      const r = p.inicializar();
      return { ms: Math.round(r && r.ms ? r.ms : ahora() - t0), yaEstaba: false, analisis: analisis() };
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
      return { ...r, ok: r.ok, movimientos: r.movimientos || [], errores: r.errores || [], ms: r.ms, fases: r.fases || null };
    }
    case 'aprender': {
      if (!p.aprender) throw new Error(`${p.nombre} no tiene modo aprender`);
      const t0 = ahora();
      const r = p.aprender(msg.estado, (msg.opciones || {}).metodo);
      return { ...r, ms: ahora() - t0 };
    }
    default:
      throw new Error(`Operación desconocida: ${msg.op}`);
  }
}
