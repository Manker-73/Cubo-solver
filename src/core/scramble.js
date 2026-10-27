// Utilidades de scrambles por movimientos aleatorios y detección de redundancias.
//
// Cada "giro base" tiene un eje y una clave de capa. Dos movimientos con el
// mismo eje conmutan; una secuencia es redundante si, dentro de un tramo de
// movimientos consecutivos del mismo eje, aparece dos veces la misma clave
// (p. ej. "R R'", "R L R", "Rw R Rw").

import { entero } from './rng.js';

/**
 * Genera n movimientos aleatorios sin redundancias.
 * giros: [{ base: 'R', eje: 0, clave: 'R' }], sufijos: ["", "'", "2"]
 */
export function movimientosAleatorios(rng, n, giros, sufijos) {
  const res = [];
  let tramoEje = -1;
  let tramoClaves = new Set();
  const porEje = new Map();
  for (const g of giros) {
    if (!porEje.has(g.eje)) porEje.set(g.eje, new Set());
    porEje.get(g.eje).add(g.clave);
  }
  while (res.length < n) {
    const g = giros[entero(rng, giros.length)];
    if (g.eje === tramoEje) {
      if (tramoClaves.has(g.clave)) continue;
      // si este eje ya no admite más claves, no elegirlo
      tramoClaves.add(g.clave);
    } else {
      tramoEje = g.eje;
      tramoClaves = new Set([g.clave]);
    }
    res.push(g.base + sufijos[entero(rng, sufijos.length)]);
  }
  return res;
}

/**
 * Comprueba redundancias. info(mov) -> { eje, clave }.
 * Devuelve null si no hay, o una descripción del primer problema.
 */
export function buscarRedundancia(movs, info) {
  let tramoEje = null;
  let claves = new Set();
  for (let i = 0; i < movs.length; i++) {
    const { eje, clave } = info(movs[i]);
    if (eje !== tramoEje) { tramoEje = eje; claves = new Set(); }
    if (claves.has(clave)) return `movimiento redundante en la posición ${i + 1} (${movs[i]})`;
    claves.add(clave);
  }
  return null;
}
