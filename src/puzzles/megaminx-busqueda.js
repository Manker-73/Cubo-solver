// Megaminx: motor de búsqueda por etapas (IDA* con tablas de poda pequeñas).
//
// Una etapa = (caras permitidas, piezas objetivo). La meta es dejar en su sitio
// todas las piezas objetivo usando solo giros de las caras permitidas. Las piezas
// ya resueltas que estén fuera de las capas de esas caras no se pueden mover, y
// las que estén dentro se incluyen en el objetivo (se "protegen").
//
// Estado de una pieza: "hueco" = posición·m + orientación (60 huecos en cada órbita:
// 20·3 esquinas, 30·2 aristas). Dentro de una etapa solo cuentan los huecos de su
// región (posiciones que tocan alguna cara permitida), numerados localmente: las
// piezas de la etapa nunca salen de ella. Tablas de poda: para grupos de ≤ 3
// piezas, distancia exacta (BFS con los giros permitidos) desde el objetivo.
// Heurística = máximo de las tablas (admisible), así que IDA* da la solución más
// corta de cada etapa con esos giros.

import { modelo, ESQUINAS, ARISTAS, ORB_ESQ, ORB_ARI } from './megaminx-piezas.js';
import { MOVS_CARA, VECINAS } from './megaminx-geo.js';

export const NS = 60;
const NM = MOVS_CARA.length; // 48: cara·4 + (quintos − 1)
export const caraDe = (m) => m >> 2;

// slotMov[orb][m·60 + hueco] = hueco tras el giro m
export const slotMov = [ORB_ESQ, ORB_ARI].map((orb) => {
  const mm = orb === ORB_ESQ ? 3 : 2;
  const t = new Uint8Array(NM * NS);
  MOVS_CARA.forEach((nombre, m) => {
    const { orig, delta } = modelo.movPiezas[nombre][orb];
    orig.forEach((q, p) => {
      for (let o = 0; o < mm; o++) t[m * NS + q * mm + o] = p * mm + ((o + delta[p]) % mm);
    });
  });
  return t;
});

// ADY[f][g]: las caras f y g son vecinas (no conmutan)
export const ADY = VECINAS.map((v) => { const a = new Array(12).fill(false); v.forEach((g) => { a[g] = true; }); return a; });

/** Caras de una pieza (orb, id). */
export const carasPieza = (orb, id) => (orb === ORB_ESQ ? ESQUINAS : ARISTAS)[id].caras;

/**
 * Prepara una etapa.
 * caras: índices de las caras permitidas; piezas: [[orb, id], ...] (objetivo);
 * grupos: [[k1, k2, k3], ...] índices en `piezas` (tablas de poda).
 */
export function crearEtapa({ nombre, caras, piezas, grupos }) {
  const movs = [];
  for (const f of caras) for (let q = 0; q < 4; q++) movs.push(f * 4 + q);
  const nMov = movs.length;
  const caraMov = Int8Array.from(movs, (m) => m >> 2);
  // huecos de la región, numerados localmente; giros sobre huecos locales
  const loc = [ORB_ESQ, ORB_ARI].map((o) => {
    const mm = o === ORB_ESQ ? 3 : 2;
    const l = new Uint8Array(NS).fill(255);
    const glob = [];
    (o === ORB_ESQ ? ESQUINAS : ARISTAS).forEach((pz, p) => {
      if (pz.caras.some((f) => caras.includes(f))) for (let r = 0; r < mm; r++) { l[p * mm + r] = glob.length; glob.push(p * mm + r); }
    });
    const n = glob.length;
    const mov = new Uint8Array(nMov * n);
    movs.forEach((m, i) => glob.forEach((h, s) => {
      const d = l[slotMov[o][m * NS + h]];
      if (d === 255) throw new Error('Megaminx: un giro saca una pieza de la región de la etapa');
      mov[i * n + s] = d;
    }));
    return { l, n, mov };
  });
  const orbs = Uint8Array.from(piezas, ([o]) => o);
  const meta = Uint8Array.from(piezas, ([o, id]) => loc[o].l[id * (o === ORB_ESQ ? 3 : 2)]);
  const tablas = grupos.map((g) => tablaPoda(g.map((k) => orbs[k]), g.map((k) => meta[k]), nMov, loc));
  return { nombre, caras, piezas, grupos, movs, caraMov, orbs, meta, tablas, loc, n: piezas.length };
}

function tablaPoda(orbs, meta, nMov, loc) {
  const k = orbs.length;
  const radix = orbs.map((o) => loc[o].n);
  const [r0 = 1, r1 = 1] = radix;
  const tam = radix.reduce((a, b) => a * b, 1);
  const d = new Int8Array(tam).fill(-1);
  const mov = orbs.map((o) => loc[o].mov);
  const [m0, m1, m2] = mov;
  const idx0 = (meta[0] ?? 0) + r0 * ((meta[1] ?? 0) + r1 * (meta[2] ?? 0));
  d[idx0] = 0;
  let frontera = new Int32Array([idx0]);
  let prof = 0;
  while (frontera.length) {
    const sig = new Int32Array(Math.min(tam, frontera.length * nMov));
    let ns = 0;
    for (let f = 0; f < frontera.length; f++) {
      let r = frontera[f];
      const s0 = r % r0; r = (r - s0) / r0;
      const s1 = r % r1; const s2 = (r - s1) / r1;
      for (let i = 0; i < nMov; i++) {
        const nidx = (k > 0 ? m0[i * r0 + s0] : 0) + r0 * ((k > 1 ? m1[i * r1 + s1] : 0) + r1 * (k > 2 ? m2[i * radix[2] + s2] : 0));
        if (d[nidx] < 0) { d[nidx] = prof + 1; sig[ns++] = nidx; }
      }
    }
    frontera = sig.subarray(0, ns);
    prof++;
  }
  return { d, r0, r01: r0 * r1, maximo: prof - 1 };
}

/**
 * IDA* de una etapa desde los huecos (globales) actuales de sus piezas.
 * Devuelve { movs: [índices de giro], nodos } o null si se pasa de maxNodos.
 */
export function resolverEtapa(et, huecos, { maxNodos = 2e6, maxProf = 30 } = {}) {
  const n = et.n;
  const { orbs, meta, tablas, grupos, movs, caraMov, loc } = et;
  const nMov = movs.length;
  const nG = grupos.length;
  const movOrb = [loc[0].mov, loc[1].mov], nLoc = [loc[0].n, loc[1].n];
  const pila = new Uint8Array((maxProf + 2) * n);
  for (let j = 0; j < n; j++) {
    const v = loc[orbs[j]].l[huecos[j]];
    if (v === 255) throw new Error('Megaminx: una pieza de la etapa está fuera de su región');
    pila[j] = v;
  }
  const camino = new Int32Array(maxProf + 1);
  let nodos = 0;
  let solucion = null;
  const g0 = Int32Array.from(grupos, (g) => g[0]);
  const g1 = Int32Array.from(grupos, (g) => (g.length > 1 ? g[1] : -1));
  const g2 = Int32Array.from(grupos, (g) => (g.length > 2 ? g[2] : -1));
  const h = (base) => {
    let hm = 0;
    for (let gi = 0; gi < nG; gi++) {
      const t = tablas[gi];
      let idx = pila[base + g0[gi]];
      if (g1[gi] >= 0) idx += t.r0 * pila[base + g1[gi]];
      if (g2[gi] >= 0) idx += t.r01 * pila[base + g2[gi]];
      const v = t.d[idx];
      if (v > hm) hm = v;
      else if (v < 0) return 99;
    }
    return hm;
  };
  const resuelto = (base) => { for (let j = 0; j < n; j++) if (pila[base + j] !== meta[j]) return false; return true; };
  let limite = 0;
  function dfs(prof, ultima) {
    const base = prof * n;
    const hv = h(base);
    if (hv === 0 && resuelto(base)) { solucion = Array.from(camino.subarray(0, prof), (i) => movs[i]); return true; }
    if (prof + hv > limite) return false;
    if (nodos > maxNodos) return true;
    const sig = base + n;
    for (let i = 0; i < nMov; i++) {
      const f = caraMov[i];
      if (ultima >= 0 && (f === ultima || (f < ultima && !ADY[f][ultima]))) continue;
      nodos++;
      for (let j = 0; j < n; j++) { const o = orbs[j]; pila[sig + j] = movOrb[o][i * nLoc[o] + pila[base + j]]; }
      camino[prof] = i;
      if (dfs(prof + 1, f)) return true;
    }
    return false;
  }
  const h0 = h(0);
  if (h0 >= 99) return null;
  for (limite = h0; limite <= maxProf; limite++) {
    dfs(0, -1);
    if (solucion) return { movs: solucion, nodos };
    if (nodos > maxNodos) return null;
  }
  return null;
}
