// @ts-check
// FTO: solver en tres fases (IDA* con tablas de poda de crearBuscador) y estados aleatorios.
//
// Las fases siguen el solver de estado aleatorio de TNoodle (fto3phase, de Levi Gibson), que
// es el que genera los scrambles oficiales; las coordenadas y las tablas son nuestras
// (DECISIONES.md, «FTO: fases del solver»):
//   G0 = <los 8 giros>  ⊃  G1 = <U, R, L, B, D>  ⊃  G2 = <R, L, B, D>  ⊃  {resuelto}
//   1) Bajar a G1: las 3 aristas de D en las posiciones de D (en orden par) y los 3
//      triángulos amarillos en D. Con U, R, L, B y D ya no salen de ahí (U es la opuesta
//      de D y R, L, B solo tocan una esquina de D). Tabla exacta 440 × 220.
//   2) Bajar a G2: cada arista en su cara de la tétrada B, los triángulos de R, L y B en su
//      cara y, para cada cara X de la tétrada A, sus 3 triángulos colocados como lo estarían
//      si las 3 esquinas de X se movieran solo con R, L, B y D (en G2 los triángulos de A van
//      "pegados" a las esquinas). Tablas: aristas (con la paridad de cada trío) × triángulos B
//      (6720 × 1680 = 11,3 M, la más grande, como la "TxE" de fto3phase) y una por cara A
//      (esquinas de X: posiciones y hueco de su pegatina X, 160 × triángulos de X, 220), con
//      distancia 0 en todo lo que se alcanza desde el resuelto con R, L, B, D (opción `cierre`).
//      Que las cinco tablas den 0 no basta en teoría para estar en G2; se comprueba con la
//      tabla de la fase 3 y, al final, con las piezas (si no, se sigue buscando; en las pruebas
//      no ha pasado nunca).
//   3) Resolver dentro de G2 (|G2| = 933.120, demostrado en fto-grupo.js): tabla exacta
//      de esquinas (720 · 2⁶) × aristas (3⁴): solución óptima con R, L, B, D.

import { crearBuscador } from '../core/piezas.js';
import { binom } from '../core/perm.js';
import { entero } from '../core/rng.js';
import { modelo, ARISTAS, ESQUINAS, TRI_A, TRI_B, IDX, CARAS, OPUESTA, TETRADA_A, ORB_ESQ, ORB_ARI, ORB_TA, ORB_TB, geo } from './fto-geo.js';

/**
 * @import { EstadoOrbita, Coordenada, Buscador } from '../core/piezas.js'
 * @import { Rng, Movimiento, Fase } from '../core/tipos.js'
 */

const caraDe = (/** @type {number} */ f) => geo.pegatinas[f].cara;
const caraTri = (/** @type {{ pegatinas: number[] }} */ t) => caraDe(t.pegatinas[0]);
/** cara (índice) de cada movimiento */
const caraMov = (/** @type {string} */ m) => IDX[m.replace("'", '')];
const OPU = CARAS.map((c) => IDX[OPUESTA[c]]);

// ---------- Combinatoria ----------
/** Índice (0 … C(n,k)−1) de un subconjunto ordenado de posiciones (sistema combinatorio). @param {number[]} pos */
const rangoSub = (pos) => pos.reduce((a, p, i) => a + binom(p, i + 1), 0);
/** @param {number} r @param {number} n @param {number} k @returns {number[]} */
function subDeRango(r, n, k) {
  const pos = new Array(k);
  for (let i = k - 1, p = n - 1; i >= 0; i--) {
    while (binom(p, i + 1) > r) p--;
    pos[i] = p; r -= binom(p, i + 1); p--;
  }
  return pos;
}
/** Etiquetas (0..2, tres de cada) en 9 casillas -> 0..1679. @param {number[]} et */
function rangoTrios(et) {
  const p0 = [], resto = [];
  for (let i = 0; i < 9; i++) if (et[i] === 0) p0.push(i); else resto.push(i);
  const p1 = []; for (let j = 0; j < 6; j++) if (et[resto[j]] === 1) p1.push(j);
  return rangoSub(p0) * 20 + rangoSub(p1);
}
/** @param {number} r @returns {number[]} */
function triosDeRango(r) {
  const et = new Array(9).fill(2);
  const p0 = subDeRango(Math.floor(r / 20), 9, 3);
  for (const i of p0) et[i] = 0;
  const resto = []; for (let i = 0; i < 9; i++) if (et[i] !== 0) resto.push(i);
  for (const j of subDeRango(r % 20, 6, 3)) et[resto[j]] = 1;
  return et;
}
/** Paridad de una lista de números distintos (orden relativo). @param {number[]} l */
function paridadLista(l) {
  let p = 0;
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (l[i] > l[j]) p ^= 1;
  return p;
}

const { movPiezas } = modelo;
/** posición nueva de lo que estaba en q tras el movimiento (inversa de orig) */
const destino = Object.fromEntries(Object.entries(movPiezas).map(([m, orbs]) => [m, orbs.map(({ orig }) => {
  const d = new Array(orig.length); orig.forEach((q, p) => { d[q] = p; }); return d;
})]));

// ---------- Piezas que siguen las fases ----------
const ARI_D = ARISTAS.map((a, i) => (a.caras.includes(IDX.D) ? i : -1)).filter((i) => i >= 0); // posiciones = identidades de D
const ARI_NO_D = ARISTAS.map((_, i) => i).filter((i) => !ARI_D.includes(i));
const TB_D = TRI_B.map((t, i) => (caraTri(t) === IDX.D ? i : -1)).filter((i) => i >= 0);
const TB_NO_D = TRI_B.map((_, i) => i).filter((i) => !TB_D.includes(i));
/** cara B de cada arista (la de su segunda pegatina) */
const caraB = ARISTAS.map((a) => caraDe(a.pegatinas[1]));
const GRUPO_RLB = { [IDX.R]: 0, [IDX.L]: 1, [IDX.B]: 2 };
const CARAS_A = TETRADA_A.map((c) => IDX[c]);
/** esquinas (identidades = posiciones) de cada cara A */
const ESQ_DE = CARAS_A.map((f) => ESQUINAS.map((e, i) => (e.caras.includes(f) ? i : -1)).filter((i) => i >= 0));

// ---------- Coordenadas ----------
/** Fase 1, aristas de D: posiciones (220) y paridad de su orden (2). @type {Coordenada} */
const C_ARI_D = {
  nombre: 'aristas de D', tam: 440,
  codificar(est) {
    const perm = est[ORB_ARI].perm, pos = [], ids = [];
    for (let p = 0; p < 12; p++) if (ARI_D.includes(perm[p])) { pos.push(p); ids.push(perm[p]); }
    return rangoSub(pos) * 2 + paridadLista(ids);
  },
  mover(idx, m) {
    const pos = subDeRango(idx >> 1, 12, 3), d = destino[m][ORB_ARI];
    const nuevas = pos.map((p) => d[p]);
    // el orden relativo de las tres piezas cambia según cómo se reordenan sus posiciones
    return rangoSub(nuevas.slice().sort((a, b) => a - b)) * 2 + ((idx & 1) ^ paridadLista(nuevas));
  },
};
/** Fase 1, triángulos de D (en la órbita B): posiciones, C(12,3). @type {Coordenada} */
const C_TRI_D = {
  nombre: 'triángulos de D', tam: 220,
  codificar(est) {
    const pos = /** @type {number[]} */ ([]); est[ORB_TB].perm.forEach((c, p) => { if (c === IDX.D) pos.push(p); });
    return rangoSub(pos);
  },
  mover(idx, m) {
    const d = destino[m][ORB_TB];
    return rangoSub(subDeRango(idx, 12, 3).map((p) => d[p]).sort((a, b) => a - b));
  },
};
/** Fase 2, aristas: cara B (R, L o B) de la arista que hay en cada una de las 9 posiciones que no son de D. @type {Coordenada} */
const C_ARI_GRUPOS = {
  nombre: 'aristas por cara B', tam: 1680,
  codificar(est) {
    const perm = est[ORB_ARI].perm;
    return rangoTrios(ARI_NO_D.map((p) => GRUPO_RLB[caraB[perm[p]]] ?? 3));
  },
  mover(idx, m) {
    const et = triosDeRango(idx), d = destino[m][ORB_ARI];
    const lleno = new Array(12).fill(3);
    ARI_NO_D.forEach((p, j) => { lleno[d[p]] = et[j]; });
    return rangoTrios(ARI_NO_D.map((p) => lleno[p]));
  },
};
/**
 * Fase 2, aristas con paridades: lo mismo que la anterior y, además, la paridad del orden de las
 * 3 aristas de R y la de las 3 de L tal como aparecen en sus posiciones (en G2 cada trío solo
 * gira: orden par; la paridad del trío de B sale de la total). 1680 · 4.
 * @type {Coordenada}
 */
const C_ARI_PARIDADES = {
  nombre: 'aristas por cara B y paridades', tam: 6720,
  codificar(est) {
    const perm = est[ORB_ARI].perm;
    const bit = (/** @type {number} */ g) => paridadLista(ARI_NO_D.map((p) => perm[p]).filter((x) => caraB[x] === g));
    return C_ARI_GRUPOS.codificar(est) * 4 + bit(IDX.R) * 2 + bit(IDX.L);
  },
  mover(idx, m) {
    const et = triosDeRango(idx >> 2), d = destino[m][ORB_ARI];
    const lleno = new Array(12).fill(3);
    /** @type {number[][]} */
    const pos = [[], []];
    ARI_NO_D.forEach((p, j) => { lleno[d[p]] = et[j]; if (et[j] < 2) pos[et[j]].push(d[p]); });
    const b0 = ((idx >> 1) & 1) ^ paridadLista(pos[0]), b1 = (idx & 1) ^ paridadLista(pos[1]);
    return rangoTrios(ARI_NO_D.map((p) => lleno[p])) * 4 + b0 * 2 + b1;
  },
};
/** Fase 2, triángulos de R, L y B en las 9 posiciones de la órbita B que no son de D. @type {Coordenada} */
const C_TRI_RLB = {
  nombre: 'triángulos de R, L y B', tam: 1680,
  codificar(est) {
    const perm = est[ORB_TB].perm;
    return rangoTrios(TB_NO_D.map((p) => GRUPO_RLB[perm[p]] ?? 3));
  },
  mover(idx, m) {
    const et = triosDeRango(idx), d = destino[m][ORB_TB];
    const lleno = new Array(12).fill(3);
    TB_NO_D.forEach((p, j) => { lleno[d[p]] = et[j]; });
    return rangoTrios(TB_NO_D.map((p) => lleno[p]));
  },
};
/**
 * Fase 2, cara A número k (X): posiciones de sus 3 esquinas (20), en cuál de los dos huecos A
 * de cada una está su pegatina de color X (2³), y posiciones de sus 3 triángulos (220). Las
 * esquinas se miran como conjunto: los triángulos de X son iguales, así que da igual cuál es cuál.
 * @param {number} k @returns {Coordenada}
 */
function coordTrio(k) {
  const f = CARAS_A[k], ids = ESQ_DE[k];
  // hueco (0 o 2) de la pegatina de color X dentro de cada esquina de X: el bit que se guarda
  // es en cuál de los dos huecos A de su posición está esa pegatina (con solo la media vuelta
  // de la esquina no basta: depende de qué esquina es)
  const jx = ESQUINAS.map((e) => e.pegatinas.findIndex((g) => caraDe(g) === f));
  return {
    nombre: 'cara ' + CARAS[f], tam: 160 * 220,
    codificar(est) {
      const { perm, ori } = est[ORB_ESQ];
      const pos = [], bits = [];
      for (let p = 0; p < 6; p++) if (ids.includes(perm[p])) { pos.push(p); bits.push(((ori[p] + jx[perm[p]]) % 4) >> 1); }
      const tri = /** @type {number[]} */ ([]); est[ORB_TA].perm.forEach((c, p) => { if (c === f) tri.push(p); });
      return ((rangoSub(pos) * 8) + bits[0] * 4 + bits[1] * 2 + bits[2]) * 220 + rangoSub(tri);
    },
    mover(idx, m) {
      const t = idx % 220, e = Math.floor(idx / 220);
      const pos = subDeRango(e >> 3, 6, 3), bits = [(e >> 2) & 1, (e >> 1) & 1, e & 1];
      const { delta } = movPiezas[m][ORB_ESQ], d = destino[m][ORB_ESQ];
      const nuevas = pos.map((p, j) => ({ p: d[p], b: bits[j] ^ (delta[d[p]] >> 1) })).sort((a, b) => a.p - b.p);
      const dt = destino[m][ORB_TA];
      const tri = subDeRango(t, 12, 3).map((p) => dt[p]).sort((a, b) => a - b);
      return ((rangoSub(nuevas.map((x) => x.p)) * 8) + nuevas[0].b * 4 + nuevas[1].b * 2 + nuevas[2].b) * 220 + rangoSub(tri);
    },
  };
}
/** Fase 3, medias vueltas de las 6 esquinas (2⁶). @type {Coordenada} */
const C_ORI_ESQ = {
  nombre: 'esquinas:medias vueltas', tam: 64,
  codificar: (est) => est[ORB_ESQ].ori.reduce((a, o) => a * 2 + (o >> 1), 0),
  mover(idx, m) {
    const { orig, delta } = movPiezas[m][ORB_ESQ];
    const b = /** @type {number[]} */ ([]); for (let i = 5; i >= 0; i--) { b[i] = idx & 1; idx >>= 1; }
    return orig.reduce((a, q, p) => a * 2 + (b[q] ^ (delta[p] >> 1)), 0);
  },
};
// Fase 3, aristas: en G2 cada arista se queda en su cara B y solo da vueltas (3 posiciones).
const GRUPOS_B = [IDX.R, IDX.L, IDX.B, IDX.D].map((g) => {
  const s0 = ARISTAS.findIndex((_, i) => caraB[i] === g);
  const d = destino[CARAS[g]][ORB_ARI];
  return [s0, d[s0], d[d[s0]]];
});
/** @param {number[]} perm @returns {number} -1 si no es una vuelta dentro de cada cara B */
function codAristasG2(perm) {
  let v = 0;
  for (const S of GRUPOS_B) {
    const k = S.indexOf(perm[S[0]]);
    if (k < 0 || perm[S[1]] !== S[(k + 1) % 3] || perm[S[2]] !== S[(k + 2) % 3]) return -1;
    v = v * 3 + k;
  }
  return v;
}
/** @type {Coordenada} */
const C_ARI_G2 = {
  nombre: 'aristas en G2', tam: 81,
  codificar: (est) => codAristasG2(est[ORB_ARI].perm),
  mover(idx, m) {
    const perm = ARISTAS.map((_, i) => i);
    for (let g = 3; g >= 0; g--) {
      const k = idx % 3; idx = Math.floor(idx / 3);
      const S = GRUPOS_B[g]; for (let j = 0; j < 3; j++) perm[S[j]] = S[(j + k) % 3];
    }
    const { orig } = movPiezas[m][ORB_ARI];
    return codAristasG2(orig.map((q) => perm[q]));
  },
};

// ---------- Fases ----------
const conPrima = (/** @type {string[]} */ l) => l.flatMap((c) => [c, c + "'"]);
const MOVS1 = conPrima(CARAS);
const MOVS2 = conPrima(['U', 'R', 'L', 'B', 'D']);
const MOVS3 = conPrima(['R', 'L', 'B', 'D']);
const COORDS1 = [C_ARI_D, C_TRI_D];
const COORDS2 = [C_ARI_PARIDADES, C_TRI_RLB, coordTrio(0), coordTrio(1), coordTrio(2), coordTrio(3)];
const COORDS3 = [modelo.coordPerm(ORB_ESQ), C_ORI_ESQ, C_ARI_G2];
/** @param {Coordenada[]} cs @param {EstadoOrbita[]} est */
const valores = (cs, est) => cs.map((c) => c.codificar(est));
const RESUELTO = modelo.resuelto.map((o, oi) => (oi === ORB_TA ? { perm: TRI_A.map(caraTri), ori: o.ori } : oi === ORB_TB ? { perm: TRI_B.map(caraTri), ori: o.ori } : o));

/** @typedef {{ b: Buscador, movs: string[], caras: number[] }} FaseSolver */
/**
 * Tablas: null hasta inicializar(); todo lo que las usa llama antes a inicializar(). El tipo no
 * sigue esa invariante entre funciones: se declaran sin null.
 * @type {FaseSolver[]}
 */
let fases = /** @type {FaseSolver[]} */ (/** @type {unknown} */ (null));
let msTablas = 0;
export function inicializar() {
  if (fases) return { ms: msTablas, yaEstaba: true };
  const t0 = Date.now();
  /** @param {Coordenada[]} coords @param {string[]} movs @param {number[][]} podas @param {string[] | null} cierre */
  const fase = (coords, movs, podas, cierre) => ({
    b: crearBuscador({
      coords, movs, ejes: movs.map(caraMov), podas, objetivo: valores(coords, RESUELTO),
      cierre: cierre ? cierre.map((m) => movs.indexOf(m)) : null,
    }),
    movs,
    caras: movs.map(caraMov),
  });
  fases = [
    fase(COORDS1, MOVS1, [[0, 1]], null),
    fase(COORDS2, MOVS2, [[0, 1], [2], [3], [4], [5]], MOVS3),
    fase(COORDS3, MOVS3, [[0, 1, 2]], null),
  ];
  msTablas = Date.now() - t0;
  return { ms: msTablas };
}
export const estaInicializado = () => !!fases;
export const tablas = () => { inicializar(); return fases; };

/**
 * DFS de IDA* sobre las tablas de una fase: llama a `alLlegar(camino)` en cada solución de
 * longitud exactamente `lim` (sin giros seguidos de la misma cara ni de caras opuestas en
 * orden decreciente: conmutan). Si alLlegar devuelve true, para.
 * @param {FaseSolver} F @param {number[]} v0 @param {number} lim @param {number} ultima cara del giro anterior (-1)
 * @param {(camino: number[]) => boolean} alLlegar @param {{ nodos: number, hasta: number }} cuenta
 */
function buscar(F, v0, lim, ultima, alLlegar, cuenta) {
  const tabs = F.b.tablas, tps = F.b.tablasPoda;
  const nM = F.movs.length, nC = v0.length, nT = tps.length;
  // valores de las coordenadas en cada profundidad (sin crear arrays por nodo)
  const pila = new Int32Array((lim + 1) * nC);
  for (let k = 0; k < nC; k++) pila[k] = v0[k];
  /** @type {number[]} */
  const camino = [];
  /** @param {number} g @param {number} ult @returns {boolean} */
  function dfs(g, ult) {
    const base = g * nC;
    let h = 0;
    for (let t = 0; t < nT; t++) {
      const tp = tps[t], lista = tp.lista, tams = tp.tams;
      let idx = 0;
      for (let k = 0; k < lista.length; k++) idx = idx * tams[k] + pila[base + lista[k]];
      const d = tp.prof[idx];
      if (d < 0 || g + d > lim) return false;
      if (d > h) h = d;
    }
    if (g === lim) return h === 0 && alLlegar(camino);
    if (h === 0 && g > 0) return false; // ya en el objetivo: no alargar
    if ((++cuenta.nodos & 4095) === 0 && performance.now() > cuenta.hasta) return true;
    const sig = base + nC;
    for (let m = 0; m < nM; m++) {
      const c = F.caras[m];
      if (c === ult || (OPU[c] === ult && c < ult)) continue;
      for (let k = 0; k < nC; k++) pila[sig + k] = tabs[k][pila[base + k] * nM + m];
      camino.push(m);
      if (dfs(g + 1, c)) return true;
      camino.pop();
    }
    return false;
  }
  return dfs(0, ultima);
}

/** @param {EstadoOrbita[]} est @param {string[]} movs */
const aplicarMovs = (est, movs) => movs.reduce((e, m) => modelo.aplicarPiezas(e, m), est);
/** @param {EstadoOrbita[]} est */
const resueltoPiezas = (est) => est.every((o, oi) => o.perm.every((x, p) => x === RESUELTO[oi].perm[p]) && o.ori.every((x) => x === 0));

/**
 * Une giros seguidos de una misma cara (y de su opuesta, que conmuta): X X = X', X X' = nada.
 * @param {Movimiento[]} movs @returns {Movimiento[]}
 */
export function simplificar(movs) {
  /** @type {Movimiento[]} */
  let res = movs.slice();
  for (let cambio = true; cambio;) {
    cambio = false;
    /** @type {Movimiento[]} */
    const out = [];
    let i = 0;
    while (i < res.length) {
      // tramo de giros de un mismo eje (una cara y su opuesta)
      const c0 = caraMov(res[i]);
      let j = i;
      const giros = new Map();
      while (j < res.length && (caraMov(res[j]) === c0 || caraMov(res[j]) === OPU[c0])) {
        const c = caraMov(res[j]);
        giros.set(c, ((giros.get(c) || 0) + (res[j].endsWith("'") ? 2 : 1)) % 3);
        j++;
      }
      const antes = j - i;
      let despues = 0;
      for (const c of [...giros.keys()].sort((a, b) => a - b)) {
        const k = giros.get(c);
        if (k === 1) { out.push(CARAS[c]); despues++; }
        if (k === 2) { out.push(CARAS[c] + "'"); despues++; }
      }
      if (despues !== antes) cambio = true;
      i = j;
    }
    if (out.join(' ') !== res.join(' ')) cambio = true;
    res = out;
  }
  return res;
}

/**
 * Resuelve un estado de piezas normalizado (en el grupo). Devuelve los movimientos de cada fase
 * o null si se acaba el tiempo `hasta` sin solución.
 * @param {EstadoOrbita[]} est @param {{ hasta: number, candidatos?: number, extra1?: number }} op
 * @returns {{ partes: string[][], nodos: number } | null}
 */
export function resolverPiezas(est, { hasta, candidatos = 40, extra1 = 1 }) {
  inicializar();
  const [F1, F2, F3] = fases;
  const cuenta = { nodos: 0, hasta };
  // Fase 1: soluciones de la longitud mínima y hasta `extra1` más
  const v1 = valores(COORDS1, est);
  const h1 = F1.b.heuristica(v1);
  /** @type {{ movs: string[], est: EstadoOrbita[], v2: number[], ult: number }[]} */
  const cands = [];
  for (let L = h1; L <= h1 + extra1 && cands.length < candidatos; L++) {
    buscar(F1, v1, L, -1, (cam) => {
      const movs = cam.map((m) => F1.movs[m]);
      const e = aplicarMovs(est, movs);
      cands.push({ movs, est: e, v2: valores(COORDS2, e), ult: movs.length ? caraMov(movs[movs.length - 1]) : -1 });
      return cands.length >= candidatos;
    }, cuenta);
  }
  // Fase 2 por longitud total creciente; en cada candidata que llega a G2, fase 3 óptima.
  let minimo = Infinity;
  for (const c of cands) minimo = Math.min(minimo, c.movs.length + F2.b.heuristica(c.v2));
  for (let total = minimo; total < minimo + 30; total++) {
    DIAG.total = total; DIAG.minimo = minimo;
    for (const c of cands) {
      const lim = total - c.movs.length;
      if (lim < 0 || F2.b.heuristica(c.v2) > lim) continue;
      /** @type {{ partes: string[][], nodos: number } | null} */
      let hallada = null;
      const parar = buscar(F2, c.v2, lim, c.ult, (cam) => {
        const m2 = cam.map((m) => F2.movs[m]);
        const e2 = aplicarMovs(c.est, m2);
        const v3 = valores(COORDS3, e2);
        if (v3[2] < 0 || F3.b.heuristica(v3) === Infinity) { DIAG.rechazos++; return false; } // no está en G2
        DIAG.aceptados++;
        const ult = m2.length ? caraMov(m2[m2.length - 1]) : c.ult;
        for (let L = F3.b.heuristica(v3); L <= 20 && !hallada; L++) {
          buscar(F3, v3, L, ult, (cam3) => {
            const m3 = cam3.map((m) => F3.movs[m]);
            if (!resueltoPiezas(aplicarMovs(e2, m3))) return false;
            hallada = { partes: [c.movs, m2, m3], nodos: cuenta.nodos };
            return true;
          }, { nodos: 0, hasta: Infinity });
        }
        return !!hallada;
      }, cuenta);
      if (hallada) return hallada;
      if (parar && performance.now() > hasta) return null;
    }
  }
  return null;
}

export const DIAG = { rechazos: 0, aceptados: 0, total: 0, minimo: 0 };
// ---------- Estados aleatorios ----------
/** @param {Rng} rng @param {number} n @returns {number[]} permutación par uniforme */
function permPar(rng, n) {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = entero(rng, i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  if (paridadLista(p)) [p[0], p[1]] = [p[1], p[0]];
  return p;
}
/** @param {Rng} rng @param {number[]} l */
function barajar(rng, l) {
  const p = l.slice();
  for (let i = p.length - 1; i > 0; i--) { const j = entero(rng, i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}
/**
 * Estado de piezas uniforme entre todos los alcanzables (en la orientación de referencia):
 * esquinas en permutación par con un número par de medias vueltas, aristas en permutación
 * par y triángulos de cada órbita en cualquier orden (los de un mismo color son iguales, así
 * que la paridad de los triángulos no restringe nada: fto-grupo.js).
 * @param {Rng} rng @returns {EstadoOrbita[]}
 */
export function piezasAleatorias(rng) {
  const bits = Array.from({ length: 6 }, () => entero(rng, 2));
  if (bits.reduce((a, b) => a + b, 0) % 2) bits[5] ^= 1;
  return [
    { perm: permPar(rng, 6), ori: bits.map((b) => 2 * b) },
    { perm: permPar(rng, 12), ori: new Array(12).fill(0) },
    { perm: barajar(rng, RESUELTO[ORB_TA].perm), ori: new Array(12).fill(0) },
    { perm: barajar(rng, RESUELTO[ORB_TB].perm), ori: new Array(12).fill(0) },
  ];
}
export { RESUELTO as RESUELTO_PIEZAS, aplicarMovs as aplicarMovsPiezas };
/** Nombres de las fases (para la barra de fases). */
export const NOMBRES_FASES = ['Cara D (aristas y triángulos)', 'Reducción a R, L, B, D', 'Esquinas y aristas'];
/** @param {string[][]} partes @returns {{ movimientos: Movimiento[], fases: Fase[] }} */
export function unirPartes(partes) {
  /** @type {Fase[]} */
  const fs = [];
  /** @type {Movimiento[]} */
  let movs = [];
  partes.forEach((p, k) => {
    const antes = movs.length;
    movs = simplificar(movs.concat(p));
    const inicio = Math.min(antes, movs.length);
    if (movs.length > inicio) fs.push({ nombre: NOMBRES_FASES[k], inicio, fin: movs.length });
  });
  // al simplificar en la unión pueden perderse giros de la fase anterior: rehacer límites
  for (let k = 0; k < fs.length; k++) if (k > 0 && fs[k].inicio < fs[k - 1].fin) fs[k - 1].fin = fs[k].inicio;
  return { movimientos: movs, fases: fs.filter((f) => f.fin > f.inicio) };
}
