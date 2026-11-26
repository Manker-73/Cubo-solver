// @ts-check
// Colocar piezas en los cubos NxN (noche 14): generadores y nombres de los tipos de pieza.
// Pegatinas: cara f (U, R, F, D, L, B), fila r y columna c -> f·N² + r·N + c.

/** @import { ColocarPiezas, Movimiento } from '../core/tipos.js' */

/**
 * @param {number} N
 * @returns {ColocarPiezas}
 */
export function colocarNxN(N) {
  const caras = ['U', 'R', 'F', 'D', 'L', 'B'];
  /** @type {Movimiento[]} */
  let generadores;
  if (N === 2) generadores = ['U', 'R', 'F']; // la esquina DBL queda fija, como en los scrambles WCA
  else {
    generadores = caras.slice();
    for (let k = 2; k <= Math.floor(N / 2); k++) for (const f of caras) generadores.push((k === 2 ? '' : k) + f + 'w');
  }
  const m = (N - 1) / 2;
  return {
    generadores,
    nombreTipo(pegatinas) {
      if (pegatinas.length === 3) return ['Esquinas', 'esquina'];
      const i = pegatinas[0] % (N * N), r = Math.floor(i / N), c = i % N;
      if (pegatinas.length === 2) {
        const k = r === 0 || r === N - 1 ? c : r;
        if (N === 3) return ['Aristas', 'arista'];
        return k === m ? ['Aristas centrales', 'arista central'] : ['Wings', 'wing'];
      }
      if (r === m && c === m) return ['Centros fijos', 'centro'];
      if (N === 4) return ['Centros', 'centro'];
      if (r === c || r + c === N - 1) return ['Centros X', 'centro X'];
      if (r === m || c === m) return ['Centros +', 'centro +'];
      return ['Centros oblicuos', 'centro oblicuo'];
    },
  };
}
