// Megaminx: demostración de las restricciones (Schreier–Sims) y cota inferior del
// número de Dios por conteo (métrica de giros de cara: 72° o 144° = 1).
//
// Restricciones: con los 12 giros de cara (los centros no se mueven) se calcula el
// orden del grupo de las esquinas (sus 60 pegatinas), el de las aristas (60) y el
// del puzzle entero. Cada giro es un 5-ciclo de esquinas y otro de aristas
// (permutaciones pares), y la suma de giros de las esquinas (mód. 3) y de volteos de
// las aristas (mód. 2) no cambia con ningún giro (se comprueba). Si los órdenes
// calculados son exactamente 20!/2·3^19, 30!/2·2^29 y su producto, el grupo es
// TODO el conjunto de estados que cumplen esas cuatro condiciones: no hay ninguna
// otra restricción (ni relación entre las paridades de esquinas y aristas).

import { ordenGrupo } from '../core/grupo.js';
import { invertir, paridad } from '../core/perm.js';
import { geo, CARAS, MOVS_CARA, VECINAS } from './megaminx-geo.js';
import { ESQUINAS, ARISTAS, modelo } from './megaminx-piezas.js';

const fact = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };

export const ORDEN_ESQUINAS = (fact(20) / 2n) * 3n ** 19n;
export const ORDEN_ARISTAS = (fact(30) / 2n) * 2n ** 29n;
export const ORDEN_TOTAL = ORDEN_ESQUINAS * ORDEN_ARISTAS;

export function analizarGrupo() {
  const t0 = Date.now();
  // grupo.js usa p[i] = imagen de i; nuestras permutaciones son "viene de"
  const gens = CARAS.map((c) => invertir(geo.perms[c]));
  const restr = (pegs) => {
    const loc = new Map(pegs.map((f, i) => [f, i]));
    return gens.map((g) => pegs.map((f) => loc.get(g[f])));
  };
  const ordenEsquinas = ordenGrupo(restr(ESQUINAS.flatMap((p) => p.pegatinas)));
  const ordenAristas = ordenGrupo(restr(ARISTAS.flatMap((p) => p.pegatinas)));
  const orden = ordenGrupo(gens);
  // invariantes de cada giro
  const giros = MOVS_CARA.map((m) => {
    const [e, a] = modelo.movPiezas[m];
    return {
      m,
      sumaGiros: e.delta.reduce((x, y) => x + y, 0) % 3,
      sumaVolteos: a.delta.reduce((x, y) => x + y, 0) % 2,
      paridadEsquinas: paridad(e.orig),
      paridadAristas: paridad(a.orig),
    };
  });
  return { ordenEsquinas, ordenAristas, orden, giros, ms: Date.now() - t0 };
}

/**
 * Cota inferior del número de Dios por conteo, en la métrica de giros de cara.
 * Dos giros de caras no vecinas conmutan, así que se cuentan las secuencias en
 * forma normal de Foata: pasos = conjuntos de caras no vecinas entre sí (cada
 * una con 4 giros posibles), y cada cara de un paso debe ser vecina de alguna del
 * paso anterior (si no, podría pasar al anterior) y distinta de todas ellas (si
 * no, se unirían). N(n) = número de secuencias de n giros en forma normal ≥
 * número de estados a distancia n. La cota es el menor n con N(0)+…+N(n) ≥ |G|.
 * Devuelve { cota, porLongitud: [N(0), N(1), ...] }.
 */
export function cotaInferiorConteo(orden = ORDEN_TOTAL) {
  const n = 12;
  const ady = VECINAS.map((v) => new Set(v));
  const indep = [];
  for (let m = 1; m < 1 << n; m++) {
    let ok = true;
    for (let a = 0; a < n && ok; a++) if ((m >> a) & 1) for (const b of ady[a]) if ((m >> b) & 1) { ok = false; break; }
    if (ok) indep.push(m);
  }
  const pc = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
  const sigue = (S, T) => {
    if (S & T) return false;
    for (let x = 0; x < n; x++) {
      if (!((T >> x) & 1)) continue;
      let d = false;
      for (const y of ady[x]) if ((S >> y) & 1) { d = true; break; }
      if (!d) return false;
    }
    return true;
  };
  const trans = new Map(indep.map((S) => [S, indep.filter((T) => sigue(S, T))]));
  const MAX = 200;
  const F = Array.from({ length: MAX + 4 }, () => new Map());
  for (const S of indep) F[pc(S)].set(S, 4n ** BigInt(pc(S)));
  const porLongitud = [1n];
  let acumulado = 1n;
  for (let L = 1; L <= MAX; L++) {
    let s = 0n;
    for (const [S, c] of F[L]) {
      s += c;
      for (const T of trans.get(S)) {
        const k = L + pc(T);
        if (k <= MAX + 3) F[k].set(T, (F[k].get(T) || 0n) + c * 4n ** BigInt(pc(T)));
      }
    }
    porLongitud.push(s);
    acumulado += s;
    if (acumulado >= orden) return { cota: L, porLongitud };
  }
  throw new Error('cota no encontrada');
}
