// Megaminx: motor de búsqueda por etapas (IDA* con tablas de poda pequeñas).
//
// Una etapa = (caras permitidas, piezas objetivo). La meta es dejar en su sitio
// todas las piezas objetivo usando solo giros de las caras permitidas. Las piezas
// ya resueltas que estén fuera de las capas de esas caras no se pueden mover, y
// las que estén dentro se incluyen en el objetivo (se "protegen").
//
// Estado de una pieza: "hueco" = posición·m + orientación (60 huecos en cada órbita:
// 20·3 esquinas, 30·2 aristas). Tablas de poda: para grupos de ≤ 3 piezas, distancia
// exacta (BFS con los giros permitidos) desde el objetivo; índice denso 60^k.
// Heurística = máximo de las tablas (admisible), así que IDA* da la solución
// más corta de cada etapa con esos giros.

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
  const orbs = piezas.map(([o]) => o);
  const meta = piezas.map(([o, id]) => id * (o === ORB_ESQ ? 3 : 2));
  const tablas = grupos.map((g) => tablaPoda(g.map((k) => orbs[k]), g.map((k) => meta[k]), movs));
  return { nombre, caras, piezas, grupos, movs, orbs, meta, tablas, n: piezas.length };
}

function tablaPoda(orbs, meta, movs) {
  const k = orbs.length;
  const tam = NS ** k;
  const d = new Int8Array(tam).fill(-1);
  const idx0 = meta.reduce((a, s, j) => a + s * NS ** j, 0);
  d[idx0] = 0;
  let frontera = [idx0];
  let prof = 0;
  const s = new Array(k);
  while (frontera.length) {
    const sig = [];
    for (const idx of frontera) {
      let r = idx;
      for (let j = 0; j < k; j++) { s[j] = r % NS; r = (r - s[j]) / NS; }
      for (const m of movs) {
        let nidx = 0, mul = 1;
        for (let j = 0; j < k; j++) { nidx += slotMov[orbs[j]][m * NS + s[j]] * mul; mul *= NS; }
        if (d[nidx] < 0) { d[nidx] = prof + 1; sig.push(nidx); }
      }
    }
    frontera = sig;
    prof++;
  }
  return { d, maximo: prof - 1 };
}

/**
 * IDA* de una etapa desde los huecos actuales de sus piezas.
 * Devuelve { movs: [índices de giro], nodos } o null si se pasa de maxNodos.
 * opciones: { maxNodos, maxProf, ultimaCara (para no repetir cara con lo anterior),
 *             todas: si se quieren varias soluciones de la longitud mínima (hasta `todas`) }
 */
export function resolverEtapa(et, huecos, { maxNodos = 2e6, maxProf = 30, ultimaCara = -1, todas = 0 } = {}) {
  const n = et.n;
  const { orbs, meta, tablas, grupos, movs } = et;
  const nG = grupos.length;
  const pila = new Int32Array((maxProf + 2) * n);
  for (let j = 0; j < n; j++) pila[j] = huecos[j];
  const camino = new Int32Array(maxProf + 1);
  let nodos = 0;
  const soluciones = [];
  const h = (base) => {
    let hm = 0;
    for (let gi = 0; gi < nG; gi++) {
      const g = grupos[gi];
      let idx = 0, mul = 1;
      for (let j = 0; j < g.length; j++) { idx += pila[base + g[j]] * mul; mul *= NS; }
      const v = tablas[gi].d[idx];
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
    if (hv === 0 && resuelto(base)) {
      soluciones.push(Array.from(camino.subarray(0, prof)));
      return soluciones.length >= Math.max(1, todas);
    }
    if (prof + hv > limite) return false;
    if (nodos > maxNodos) return true;
    const sig = base + n;
    for (let i = 0; i < movs.length; i++) {
      const m = movs[i];
      const f = m >> 2;
      if (ultima >= 0 && (f === ultima || (f < ultima && !ADY[f][ultima]))) continue;
      nodos++;
      for (let j = 0; j < n; j++) pila[sig + j] = slotMov[orbs[j]][m * NS + pila[base + j]];
      camino[prof] = m;
      if (dfs(prof + 1, f)) return true;
    }
    return false;
  }
  const h0 = h(0);
  if (h0 >= 99) return null;
  for (limite = h0; limite <= maxProf; limite++) {
    dfs(0, ultimaCara);
    if (soluciones.length) return { movs: soluciones[0], todas: soluciones, nodos };
    if (nodos > maxNodos) return null;
  }
  return null;
}
