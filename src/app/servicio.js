// @ts-check
// Servicio de cálculo: genera tablas, scrambles, valida y resuelve.
// Lo usan el Web Worker (worker.js) y, si no hay Worker, el hilo principal
// (motor.js). Solo usa la interfaz común de los puzzles.

import { buscarPuzzle } from '../puzzles/index.js';
import { rngSeguro } from '../core/rng.js';
import { puzzleConBloqueos, claveBloqueos } from '../core/bloqueos.js';

/**
 * Mensajes con el Worker: Peticion, RespuestasPorOperacion, MensajeAlWorker y MensajeDelWorker
 * en src/core/tipos.d.ts.
 * @import { Peticion, Respuesta, PuzzleServicio, PuzzleVendado, Puzzle, EstadoPegatinas } from '../core/tipos.js'
 */

const rng = rngSeguro();
const ahora = () => (globalThis.performance || Date).now();

// Puzzles con bloqueos (cubos vendados): uno por configuración, con sus tablas.
// Se guardan los últimos (las tablas de un espacio pequeño pueden ocupar decenas de MB).
const CONFIGS_GUARDADAS = 3;
/** @type {Map<string, PuzzleVendado<EstadoPegatinas>>} */
const conBloqueos = new Map();
/**
 * El puzzle de la petición: el del registro o, si trae bloqueos, su versión vendada.
 * @param {Exclude<Peticion, { op: 'ping' }>} msg
 * @returns {PuzzleServicio}
 */
export function puzzleDePeticion(msg) {
  const p = buscarPuzzle(msg.puzzle); // los del registro y las bases del modo vendado (4x4, 5x5)
  if (!p) throw new Error(`Puzzle desconocido: ${msg.puzzle}`);
  const def = msg.bloqueos;
  if (!def || !def.length || !p.soporteBloqueos) return p;
  const k = p.id + '#' + claveBloqueos(def);
  let q = conBloqueos.get(k);
  if (q) { conBloqueos.delete(k); conBloqueos.set(k, q); return q; }
  // (los puzzles con soporteBloqueos tienen estado de pegatinas: colores en el 3x3, identidades en el 4x4 y el 5x5)
  q = puzzleConBloqueos(/** @type {Puzzle<EstadoPegatinas>} */ (p), def);
  conBloqueos.set(k, q);
  while (conBloqueos.size > CONFIGS_GUARDADAS) conBloqueos.delete(/** @type {string} */ (conBloqueos.keys().next().value));
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
 *   validar   (estado, opciones.secuencia) -> { valido, errores, resultado ('valido' | 'imposible' | 'sin-comprobar'), avisos }
 *   resolver  (estado)        -> { ok, movimientos, errores, ms, fases }
 *   aprender  (estado, opciones.metodo) -> guion del método humano (ver src/aprender/guion.js)
 * (Tipos de cada petición y su respuesta: Peticion y RespuestasPorOperacion en src/core/tipos.d.ts.)
 * @param {Peticion} msg
 * @returns {Respuesta}
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
      const movimientos = msg.opciones ? p.generarScramble(rng, msg.opciones) : p.generarScramble(rng);
      return { movimientos, ms: ahora() - t0 };
    }
    case 'validar': {
      if (!p.capacidades.validar) throw new Error(`${p.nombre} no tiene validador`);
      // capacidades.validar => validar existe (lo comprueba definirPuzzle al cargar; el tipo no lo sabe)
      const v = /** @type {Required<Puzzle<unknown>>['validar']} */ (p.validar)(msg.estado, msg.opciones || {});
      return { valido: v.valido, errores: v.errores, resultado: v.resultado || (v.valido ? 'valido' : 'imposible'), ...(v.avisos ? { avisos: v.avisos } : {}) };
    }
    case 'resolver': {
      if (!p.capacidades.resolver) throw new Error(`${p.nombre} no tiene solucionador`);
      // capacidades.resolver => resolver existe (como arriba)
      const r = /** @type {Required<Puzzle<unknown>>['resolver']} */ (p.resolver)(msg.estado, msg.opciones || {});
      return { ...r, ok: r.ok, movimientos: r.movimientos || [], errores: r.errores || [], ms: r.ms, fases: r.fases || null };
    }
    case 'aprender': {
      if (!p.aprender) throw new Error(`${p.nombre} no tiene modo aprender`);
      const t0 = ahora();
      const r = p.aprender(msg.estado, (msg.opciones || {}).metodo);
      return { ...r, ms: ahora() - t0 };
    }
    default:
      // solo con un mensaje que no cumple Peticion (para el tipo, msg aquí es `never`)
      throw new Error(`Operación desconocida: ${/** @type {{ op: string }} */ (msg).op}`);
  }
}
