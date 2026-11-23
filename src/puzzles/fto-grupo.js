// @ts-check
// FTO: demostración de las restricciones (Schreier–Sims) y cota inferior del número de Dios
// por conteo (métrica de giros de cara: cada giro de 120° cuenta 1).
//
// Con los 8 giros de cara se calcula el orden del grupo de las pegatinas de cada tipo de pieza
// (esquinas, aristas y cada órbita de triángulos, que se tratan como piezas distintas) y el del
// puzzle entero. Invariantes de cada giro (se comprueban): permuta las esquinas con un 3-ciclo y
// las aristas con dos 3-ciclos (permutaciones pares), no voltea ninguna arista, gira 0 o 2
// esquinas media vuelta (con las pegatinas ordenadas empezando por la tétrada A, ver
// fto-geo.js; nunca un cuarto) y mueve los triángulos de cada órbita con permutaciones pares
// sin sacarlos de su órbita.
// Si los órdenes son exactamente 6!/2·2⁵, 12!/2 y (12!/2)² (una por órbita de triángulos), y el
// del puzzle entero su producto, el grupo es TODO el conjunto de estados que cumplen esas
// condiciones: no hay ninguna otra restricción ni relación entre las piezas.
//
// Posiciones distintas: los 3 triángulos de una cara son iguales (de cada órbita se cambian
// entre sí de 3!⁴/2 maneras pares) y el puzzle no tiene ninguna pieza fija, así que una
// posición se ve igual en sus 12 rotaciones que están en el grupo (las otras 12 cambian la
// paridad de las esquinas, de las aristas y de los triángulos a la vez):
//   |G| / (648² · 12) = 31.408.133.379.194.880.000.000,
// la misma cifra que da Wikipedia («Face Turning Octahedron»: 6!·2⁶·12!·(12!)² / (2·4·3!⁸·12)).

import { ordenGrupo } from '../core/grupo.js';
import { crearCadena } from '../core/schreier.js';
import { invertir, paridad } from '../core/perm.js';
import { geo, CARAS, MOVS, OPUESTA, ESQUINAS, ARISTAS, TRI_A, TRI_B, modelo, ORB_ESQ, ORB_ARI, ORB_TA, ORB_TB } from './fto-geo.js';

/** @param {number} n */
const fact = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };

export const ORDEN_ESQUINAS = (fact(6) / 2n) * 2n ** 5n;      // 11.520
export const ORDEN_ARISTAS = fact(12) / 2n;                  // 239.500.800
export const ORDEN_TRIANGULOS = (fact(12) / 2n) ** 2n;        // por órbita, 12!/2
export const ORDEN_TOTAL = ORDEN_ESQUINAS * ORDEN_ARISTAS * ORDEN_TRIANGULOS;
/** Estabilizador de los colores de los triángulos: en cada órbita, permutaciones pares de 4 tríos iguales. */
export const IGUALES_TRIANGULOS = (6n ** 4n / 2n) ** 2n;     // 648²
export const ROTACIONES_EN_EL_GRUPO = 12n;
export const POSICIONES = ORDEN_TOTAL / IGUALES_TRIANGULOS / ROTACIONES_EN_EL_GRUPO;
/** |<R, L, B, D>| (la fase 3 del solver): 6!/2·2⁵ · 3⁴. */
export const ORDEN_G2 = ORDEN_ESQUINAS * 81n;

export function analizarGrupo() {
  const t0 = Date.now();
  // grupo.js y schreier.js usan p[i] = imagen de i; nuestras permutaciones son "viene de"
  const gens = CARAS.map((c) => invertir(/** @type {Record<string, number[]>} */ (geo.perms)[c]));
  /** @param {number[]} pegs */
  const restr = (pegs) => {
    const loc = new Map(pegs.map((f, i) => [f, i]));
    return gens.map((g) => pegs.map((f) => /** @type {number} */ (loc.get(g[f]))));
  };
  const ordenEsquinas = ordenGrupo(restr(ESQUINAS.flatMap((p) => p.pegatinas)));
  const ordenAristas = ordenGrupo(restr(ARISTAS.flatMap((p) => p.pegatinas)));
  const ordenTriA = ordenGrupo(restr(TRI_A.flatMap((p) => p.pegatinas)));
  const ordenTriB = ordenGrupo(restr(TRI_B.flatMap((p) => p.pegatinas)));
  const cadena = crearCadena(geo.n);
  for (const g of gens) cadena.incluir(Int16Array.from(g));
  const orden = cadena.orden();
  // rotaciones del puzzle entero que están en el grupo
  const rotacionesEnGrupo = geo.rotaciones.filter((/** @type {number[]} */ R) => cadena.contiene(Int16Array.from(invertir(R)))).length;
  // subgrupo de la fase 3 del solver: <R, L, B, D>, sobre todas las pegatinas y sobre esquinas + aristas
  const g2 = ['R', 'L', 'B', 'D'].map((c) => invertir(/** @type {Record<string, number[]>} */ (geo.perms)[c]));
  const cadenaG2 = crearCadena(geo.n);
  for (const g of g2) cadenaG2.incluir(Int16Array.from(g));
  const pegsEA = [...ESQUINAS, ...ARISTAS].flatMap((p) => p.pegatinas);
  const locEA = new Map(pegsEA.map((f, i) => [f, i]));
  const ordenG2EsquinasAristas = ordenGrupo(g2.map((g) => pegsEA.map((f) => /** @type {number} */ (locEA.get(g[f])))));
  // invariantes de cada giro
  const giros = MOVS.map((m) => {
    const o = modelo.movPiezas[m];
    return {
      m,
      paridadEsquinas: paridad(o[ORB_ESQ].orig),
      paridadAristas: paridad(o[ORB_ARI].orig),
      paridadTriA: paridad(o[ORB_TA].orig),
      paridadTriB: paridad(o[ORB_TB].orig),
      volteos: o[ORB_ARI].delta.reduce((a, b) => a + b, 0),
      girosEsquinas: o[ORB_ESQ].delta.filter((d) => d !== 0),
    };
  });
  return {
    ordenEsquinas, ordenAristas, ordenTriA, ordenTriB, orden, rotacionesEnGrupo,
    ordenG2: cadenaG2.orden(), ordenG2EsquinasAristas, giros, ms: Date.now() - t0,
  };
}

/**
 * Cota inferior del número de Dios por conteo, en la métrica de giros de cara (FTO: cada cara
 * gira 120° en un sentido u otro, 2 giros por cara). Solo conmutan las caras opuestas, así que
 * las secuencias distintas se cuentan en forma normal: dos giros seguidos nunca de la misma
 * cara, y de dos caras opuestas seguidas, primero la de menor índice. N(n) = secuencias de n
 * giros en esa forma ≥ número de posiciones a distancia n. La cota es el menor n con
 * N(0)+…+N(n) ≥ número de posiciones (las de distancia ≤ n se alcanzan con una de esas
 * secuencias desde alguna de las 12 orientaciones del resuelto, que son la misma posición).
 * @returns {{ cota: number, porLongitud: bigint[] }}
 */
export function cotaInferiorConteo(objetivo = POSICIONES) {
  const n = CARAS.length;
  const opu = CARAS.map((c) => CARAS.indexOf(OPUESTA[c]));
  // f[c] = secuencias de longitud L que acaban en la cara c
  let f = CARAS.map(() => 2n);
  const porLongitud = [1n, 2n * BigInt(n)];
  let acumulado = 1n + 2n * BigInt(n);
  if (acumulado >= objetivo) return { cota: 1, porLongitud };
  for (let L = 2; L < 200; L++) {
    const g = CARAS.map((_, c) => {
      let s = 0n;
      for (let d = 0; d < n; d++) {
        if (d === c) continue;
        if (opu[c] === d && c < d) continue; // c después de su opuesta d solo si c > d
        s += f[d];
      }
      return 2n * s;
    });
    f = g;
    const total = f.reduce((a, b) => a + b, 0n);
    porLongitud.push(total);
    acumulado += total;
    if (acumulado >= objetivo) return { cota: L, porLongitud };
  }
  throw new Error('cota no encontrada');
}
