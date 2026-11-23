// @ts-check
// Interfaz común de los puzzles (ver ARQUITECTURA.md).
//
// Cada módulo de puzzle exporta un objeto creado con definirPuzzle({...}).
// definirPuzzle comprueba que estén los métodos obligatorios y rellena los
// métodos genéricos que no se hayan definido.
// Tipos: DefinicionPuzzle y Puzzle en ./tipos.d.ts. Con "// @ts-check" en el módulo
// del puzzle, `npm run tipos` comprueba la definición contra DefinicionPuzzle (un
// método obligatorio que falta, un campo mal escrito…) antes de ejecutar nada.

/** @import { DefinicionPuzzle, Puzzle, Movimiento } from './tipos.js' */

/** @type {Array<keyof DefinicionPuzzle<unknown>>} */
const OBLIGATORIOS = [
  'id', 'nombre', 'paleta', 'estadoResuelto', 'aplicarMovimiento', 'estaResuelto',
  'generarScramble', 'renderizar', 'invertirMovimiento', 'infoMovimiento',
];

/**
 * @template E
 * @template {DefinicionPuzzle<E>} D
 * @param {D & DefinicionPuzzle<E>} def
 * @returns {D & Puzzle<E>}
 */
export function definirPuzzle(def) {
  for (const k of OBLIGATORIOS) {
    if (def[k] === undefined) throw new Error(`Puzzle "${def.id || '?'}": falta "${k}"`);
  }
  const cap = Object.assign({ scramble: true, validar: false, resolver: false, editar: false }, def.capacidades || {});
  if (cap.validar && typeof def.validar !== 'function') throw new Error(`Puzzle ${def.id}: capacidades.validar sin validar()`);
  if (cap.resolver && typeof def.resolver !== 'function') throw new Error(`Puzzle ${def.id}: capacidades.resolver sin resolver()`);

  /**
   * Métodos por defecto (los de la definición los sustituyen). Los de edición suponen que
   * el estado es un array de pegatinas: los puzzles con otro estado (Square-1) dan los suyos.
   * @typedef {'descripcion' | 'costeScramble' | 'separador' | 'aplicarSecuencia' | 'parsear' | 'formatear' | 'invertir'
   *   | 'buscarRedundancia' | 'inicializar' | 'estaInicializado' | 'pegatinasEditables' | 'pintar' | 'clonar'} PorDefecto
   */
  const p = /** @type {D & Puzzle<E>} */ (Object.assign(
    /** @type {Pick<Puzzle<E>, PorDefecto>} */ ({
      descripcion: '',
      costeScramble: 0, // ms aprox. del primer scramble (tablas que necesita): ordena las precargas
      separador: ' ',
      aplicarSecuencia(estado, movs) {
        let e = estado;
        for (const m of movs) e = p.aplicarMovimiento(e, m);
        return e;
      },
      parsear(texto) {
        return texto.trim().split(/\s+/).filter(Boolean);
      },
      formatear(movs) {
        return movs.join(p.separador);
      },
      invertir(movs) {
        return movs.slice().reverse().map((m) => p.invertirMovimiento(m));
      },
      buscarRedundancia(movs) {
        let tramoEje = null;
        let claves = new Set();
        for (let i = 0; i < movs.length; i++) {
          const { eje, clave } = p.infoMovimiento(movs[i]);
          if (eje !== tramoEje) { tramoEje = eje; claves = new Set(); }
          if (claves.has(clave)) return `movimiento redundante en la posición ${i + 1} (${movs[i]})`;
          claves.add(clave);
        }
        return null;
      },
      inicializar() { return { ms: 0 }; },
      estaInicializado() { return true; },
      // Edición: por defecto el estado es un array de colores por pegatina
      pegatinasEditables() { return []; },
      pintar(estado, i, color) { const e = /** @type {unknown[]} */ (estado).slice(); e[i] = color; return /** @type {E} */ (e); },
      // Copia independiente de un estado (por defecto: array de colores u objeto JSON)
      clonar(estado) { return Array.isArray(estado) ? /** @type {E} */ (estado.slice()) : JSON.parse(JSON.stringify(estado)); },
    }),
    def,
  ));
  if (!p.buscarRedundanciaSolucion) p.buscarRedundanciaSolucion = (movs) => p.buscarRedundancia(movs);
  p.capacidades = cap;
  return p;
}
