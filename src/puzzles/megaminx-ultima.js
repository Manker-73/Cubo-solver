// Megaminx: última capa (las 5 esquinas y 5 aristas de U) con macros encontradas
// por búsqueda.
//
// Macros: secuencias de U, F, R que dejan en su sitio todas las piezas que no son
// de U. Se encuentran por colisiones: se recorren todas las secuencias canónicas
// de hasta LONG_SEC giros de U, F, R y se guarda, para cada "huella" (dónde quedan
// las 12 piezas de F y R que no son de U), la primera secuencia p que la produce;
// cada secuencia c con la misma huella da la macro p · c⁻¹. Se añaden sus inversas
// y sus versiones giradas alrededor de U (con R, BR; BR, BL; ...), y de cada efecto
// sobre la última capa se guarda la macro más corta.
//
// Resolver la última capa: probar cada macro a de la biblioteca y buscar en una
// tabla hash si el estado que deja es el efecto de otra macro b; solución a · b⁻¹,
// la más corta. Un test comprueba de forma exhaustiva que así se resuelven los
// 4.665.600 estados posibles de la última capa.

import { slotMov, NS, carasPieza } from './megaminx-busqueda.js';
import { ESQUINAS, ARISTAS, ORB_ESQ, ORB_ARI } from './megaminx-piezas.js';
import { IDX } from './megaminx-geo.js';

export const LONG_SEC = 6;
const U = IDX.U;
export const ESQ_LL = ESQUINAS.map((p, i) => i).filter((i) => ESQUINAS[i].caras.includes(U));
export const ARI_LL = ARISTAS.map((p, i) => i).filter((i) => ARISTAS[i].caras.includes(U));
const invMov = (m) => (m & ~3) | (3 - (m & 3));
const invertirSec = (s) => s.slice().reverse().map(invMov);

/** Une giros seguidos de la misma cara (en índices de giro: cara·4 + quintos − 1). */
export function unirSeguidos(sec) {
  const r = [];
  for (const m of sec) {
    if (r.length && r[r.length - 1] >> 2 === m >> 2) {
      const f = m >> 2;
      const q = ((r.pop() & 3) + 1 + (m & 3) + 1) % 5;
      if (q) r.push(f * 4 + q - 1);
    } else r.push(m);
  }
  return r;
}

// Rotación de 72°·k alrededor de U: U fijo, anillo superior desplazado k caras
// (F→R→BR→BL→L→F); el resto no aparece en las macros.
const girarSec = (sec, k) => sec.map((m) => {
  const f = m >> 2;
  const g = f >= 1 && f <= 5 ? 1 + ((f - 1 + k) % 5) : f;
  return g * 4 + (m & 3);
});

// Simetría especular respecto al plano que contiene el eje de U y el centro de F:
// U y F fijas, R↔L, BR↔BL, y cada giro cambia de sentido.
const ESPEJO = { [IDX.U]: IDX.U, [IDX.F]: IDX.F, [IDX.R]: IDX.L, [IDX.L]: IDX.R, [IDX.BR]: IDX.BL, [IDX.BL]: IDX.BR };
const espejoSec = (sec) => sec.map((m) => ESPEJO[m >> 2] * 4 + (3 - (m & 3)));

let BIB = null;

/** Hueco local de la última capa: esquinas 0..14 (pos·3 + ori), aristas 0..9 (pos·2 + ori). */
const locEsq = (h) => ESQ_LL.indexOf(Math.floor(h / 3)) * 3 + (h % 3);
const locAri = (h) => ARI_LL.indexOf(Math.floor(h / 2)) * 2 + (h % 2);

/** Acción de una secuencia sobre los huecos locales de la última capa (si no sale de ella). */
function accionDe(sec) {
  const ae = new Uint8Array(15), aa = new Uint8Array(10);
  for (let k = 0; k < 15; k++) {
    let h = ESQ_LL[Math.floor(k / 3)] * 3 + (k % 3);
    for (const m of sec) h = slotMov[ORB_ESQ][m * NS + h];
    const l = locEsq(h);
    if (l < 0) return null;
    ae[k] = l;
  }
  for (let k = 0; k < 10; k++) {
    let h = ARI_LL[k >> 1] * 2 + (k & 1);
    for (const m of sec) h = slotMov[ORB_ARI][m * NS + h];
    const l = locAri(h);
    if (l < 0) return null;
    aa[k] = l;
  }
  return { ae, aa };
}

/** Clave de un estado de la última capa: e[j], a[j] = hueco local de la pieza j. */
const clave = (e, a) => {
  let c = 0, d = 0;
  for (let j = 4; j >= 0; j--) { c = c * 15 + e[j]; d = d * 10 + a[j]; }
  return c * 100000 + d;
};

/** ¿Deja la secuencia en su sitio todas las piezas que no son de la última capa? */
function conservaElResto(sec) {
  for (let i = 0; i < 20; i++) {
    if (ESQ_LL.includes(i)) continue;
    let h = i * 3;
    for (const m of sec) h = slotMov[ORB_ESQ][m * NS + h];
    if (h !== i * 3) return false;
  }
  for (let i = 0; i < 30; i++) {
    if (ARI_LL.includes(i)) continue;
    let h = i * 2;
    for (const m of sec) h = slotMov[ORB_ARI][m * NS + h];
    if (h !== i * 2) return false;
  }
  return true;
}

export function inicializarUltima() {
  if (BIB) return BIB;
  const t0 = Date.now();
  const caras = [U, IDX.F, IDX.R];
  const resto = [];
  ESQUINAS.forEach((p, i) => { if (!p.caras.includes(U) && p.caras.some((f) => caras.includes(f))) resto.push([ORB_ESQ, i * 3]); });
  ARISTAS.forEach((p, i) => { if (!p.caras.includes(U) && p.caras.some((f) => caras.includes(f))) resto.push([ORB_ARI, i * 2]); });
  const movs = [];
  for (const f of caras) for (let q = 0; q < 4; q++) movs.push(f * 4 + q);
  const primera = new Map();
  const pares = [];
  const camino = [];
  const nR = resto.length;
  const pila = new Uint8Array((LONG_SEC + 1) * nR);
  resto.forEach(([, h], j) => { pila[j] = h; });
  let nSec = 0;
  function dfs(prof, lim, ultima) {
    const base = prof * nR;
    if (prof === lim) {
      nSec++;
      const k = String.fromCharCode(...pila.subarray(base, base + nR));
      const p = primera.get(k);
      if (p === undefined) primera.set(k, camino.slice());
      else pares.push(p, camino.slice());
      return;
    }
    for (const m of movs) {
      const f = m >> 2;
      if (f === ultima) continue;
      for (let j = 0; j < nR; j++) pila[base + nR + j] = slotMov[resto[j][0]][m * NS + pila[base + j]];
      camino.push(m);
      dfs(prof + 1, lim, f);
      camino.pop();
    }
  }
  for (let lim = 0; lim <= LONG_SEC; lim++) dfs(0, lim, -1);

  const porClave = new Map();
  const id = { e: Uint8Array.from({ length: 5 }, (_, j) => j * 3), a: Uint8Array.from({ length: 5 }, (_, j) => j * 2) };
  const anadir = (sec) => {
    const acc = accionDe(sec);
    if (!acc) return;
    const e = id.e.map((x) => acc.ae[x]), a = id.a.map((x) => acc.aa[x]);
    const k = clave(e, a);
    const p = porClave.get(k);
    if (!p || p.sec.length > sec.length) porClave.set(k, { sec, ...acc });
  };
  // 1) macros base (U, F, R): la más corta de cada efecto
  anadir([]);
  for (let i = 0; i < pares.length; i += 2) anadir(unirSeguidos([...pares[i], ...invertirSec(pares[i + 1])]));
  const base = [...porClave.values()].map((m) => m.sec);
  // 2) sus inversas, sus imágenes especulares y todas ellas giradas alrededor de U
  for (const b of base) {
    for (const s0 of [b, espejoSec(b)]) {
      for (let k = 0; k < 5; k++) {
        const s = girarSec(s0, k);
        anadir(s);
        anadir(invertirSec(s));
      }
    }
  }
  const lista = [...porClave.values()].sort((x, y) => x.sec.length - y.sec.length);
  for (const m of lista) if (!conservaElResto(m.sec)) throw new Error('Megaminx: macro de última capa incorrecta');
  const indice = new Map();
  lista.forEach((m, i) => {
    const e = id.e.map((x) => m.ae[x]), a = id.a.map((x) => m.aa[x]);
    indice.set(clave(e, a), i);
  });
  BIB = { lista, indice, secuencias: nSec, ms: Date.now() - t0 };
  return BIB;
}

/** La combinación a · b⁻¹ de dos macros más corta que resuelve (e, a), o null. */
function dosMacros(e, a, cota = Infinity) {
  const { lista, indice } = BIB;
  let mejor = null;
  const ye = new Uint8Array(5), ya = new Uint8Array(5);
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i];
    if (m.sec.length >= Math.min(cota, mejor ? mejor.length : Infinity)) break; // ordenada por longitud
    for (let j = 0; j < 5; j++) { ye[j] = m.ae[e[j]]; ya[j] = m.aa[a[j]]; }
    const b = indice.get(clave(ye, ya));
    if (b === undefined) continue;
    const sec = unirSeguidos([...m.sec, ...invertirSec(lista[b].sec)]);
    if (!mejor || sec.length < mejor.length) mejor = sec;
  }
  return mejor;
}

/**
 * Resuelve la última capa: e[j], a[j] = huecos locales de las piezas de la última
 * capa (esquina ESQ_LL[j], arista ARI_LL[j]). Devuelve los giros (índices de giro)
 * de la combinación de dos macros más corta; si no hay ninguna (0,09 % de los
 * casos), una macro corta delante y dos más. El test recorre los 4.665.600 casos.
 */
export function resolverUltima(e, a) {
  const { lista } = inicializarUltima();
  const r = dosMacros(e, a);
  if (r) return r;
  let mejor = null;
  const pe = new Uint8Array(5), pa = new Uint8Array(5);
  for (const p of lista) {
    if (p.sec.length === 0) continue;
    if (mejor && p.sec.length >= mejor.length) break;
    for (let j = 0; j < 5; j++) { pe[j] = p.ae[e[j]]; pa[j] = p.aa[a[j]]; }
    const resto = dosMacros(pe, pa, mejor ? mejor.length - p.sec.length : Infinity);
    if (!resto) continue;
    const sec = unirSeguidos([...p.sec, ...resto]);
    if (!mejor || sec.length < mejor.length) mejor = sec;
  }
  return mejor;
}

/** Para los tests: biblioteca y utilidades. */
export const _interno = { clave, accionDe, invertirSec, dosMacros: (e, a) => (inicializarUltima(), dosMacros(e, a)) };
