// Simetrías (rotaciones del puzzle entero) vistas como permutaciones de colores.
//
// Si el usuario pinta el puzzle sujetándolo en otra orientación, los colores
// están "reetiquetados" por una rotación. En vez de girar el estado, se
// cambian los nombres de los colores con la permutación de colores que induce
// esa rotación; así la solución sigue en el sistema de referencia del usuario.

import { aplicarPerm, componer } from './perm.js';

/** Cierre de un grupo generado por permutaciones (de pegatinas). */
export function cierreGrupo(generadores) {
  const n = generadores[0].length;
  const id = Array.from({ length: n }, (_, i) => i);
  const visto = new Map([[id.join(','), id]]);
  const cola = [id];
  while (cola.length) {
    const p = cola.shift();
    for (const g of generadores) {
      const q = componer(p, g);
      const k = q.join(',');
      if (!visto.has(k)) { visto.set(k, q); cola.push(q); }
    }
  }
  return [...visto.values()];
}

/**
 * Permutaciones de colores inducidas por las rotaciones.
 * rotaciones: perms de pegatinas; resuelto: estado resuelto (colores por pegatina);
 * representante[c]: índice de una pegatina que en el estado resuelto tiene color c
 * (normalmente una pegatina de la cara c).
 * Devuelve arrays sigma con sigma[colorPintado] = colorCanónico.
 */
export function permutacionesDeColor(rotaciones, resuelto, representante) {
  const res = [];
  const vistos = new Set();
  for (const P of rotaciones) {
    const rot = aplicarPerm(resuelto, P);
    // tras la rotación, en la pegatina representante[f] está el color rot[representante[f]]
    const sigma = new Array(representante.length);
    representante.forEach((idx, f) => { sigma[rot[idx]] = f; });
    const k = sigma.join(',');
    if (!vistos.has(k)) { vistos.add(k); res.push(sigma); }
  }
  return res;
}

export function reetiquetar(estado, sigma) {
  return estado.map((c) => (c >= 0 && c < sigma.length ? sigma[c] : c));
}
