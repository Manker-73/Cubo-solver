// Motor del Square-1: modelo de piezas, formas, paridad, tablas y solver en dos fases.
//
// MODELO
// Cada capa son 12 casillas de 30°. La casilla k de cualquiera de las dos capas
// ocupa los ángulos [30k, 30k+30] medidos desde la línea del corte por el
// frente, hacia la derecha (vistos desde arriba). El corte del "/" pasa entre
// las casillas 11|0 y 5|6 de las dos capas; la mitad derecha son las casillas
// 0..5. Las esquinas ocupan 2 casillas y las aristas 1.
//
// Estado = { arriba: [12 ids], abajo: [12 ids], medio: 0|1 }: cada casilla
// guarda el id de la pieza que la ocupa (una esquina aparece en dos casillas
// seguidas). Esquinas 0-7, aristas 8-15. medio = 1 si la mitad derecha de la
// capa del medio está volteada.
//
// Orientación de referencia (Regulación WCA 12c1): una de las dos superficies
// pequeñas de la capa del medio a la izquierda del frente. Entonces la arista
// frontal de arriba ocupa la casilla 0 y el corte pasa por su lado izquierdo:
// la capa resuelta es  A E E A E E ...  (A = arista, E = esquina) en las dos
// capas, alineadas. Desde el estado resuelto, "/" es legal pero cambia la forma
// (como en el puzzle real: hace falta (1,0)/(-1,0) para seguir en forma de cubo).
//
// Notación WCA (12c2, 12c3): (x,y) gira la capa de arriba x·30° en sentido
// horario visto desde arriba y la de abajo y·30° en sentido horario visto desde
// abajo; "/" gira la mitad derecha 180°.
//
// FORMAS
// La forma de una capa es una máscara de 12 bits: el bit k vale 1 si en la
// casilla k empieza una pieza. Una máscara es válida si no tiene dos ceros
// seguidos (una esquina ocupa dos casillas). Hay 322 máscaras válidas (número
// de Lucas L12); una forma del puzzle es el par (arriba, abajo) con 8 esquinas
// en total.
//
// PARIDAD
// Se leen las piezas en orden (las de arriba por su casilla inicial, luego las
// de abajo) y se compara la paridad de esa secuencia con la del estado
// resuelto. El efecto de cada movimiento sobre esta paridad solo depende de la
// forma, así que se puede seguir en las tablas de formas.

import { indicePerm, permDeIndice } from '../core/perm.js';
import { entero, barajar } from '../core/rng.js';

export const RESUELTO_ARRIBA = Object.freeze([8, 0, 0, 9, 1, 1, 10, 2, 2, 11, 3, 3]);
export const RESUELTO_ABAJO = Object.freeze([12, 4, 4, 13, 5, 5, 14, 6, 6, 15, 7, 7]);
export const esEsquina = (id) => id < 8;
export const mod12 = (k) => ((k % 12) + 12) % 12;
/** Giro normalizado al rango WCA -5..6. */
export const normalizarGiro = (x) => { const r = mod12(x); return r > 6 ? r - 12 : r; };

export function estadoResueltoIds() {
  return { arriba: RESUELTO_ARRIBA.slice(), abajo: RESUELTO_ABAJO.slice(), medio: 0 };
}

export function clonarIds(e) {
  return { arriba: e.arriba.slice(), abajo: e.abajo.slice(), medio: e.medio };
}

/** (x,y): siempre legal. */
export function girarCapas(e, x, y) {
  const a = new Array(12), b = new Array(12);
  for (let k = 0; k < 12; k++) { a[k] = e.arriba[mod12(k + x)]; b[k] = e.abajo[mod12(k - y)]; }
  return { arriba: a, abajo: b, medio: e.medio };
}

/** "/" es legal si ninguna esquina atraviesa el corte en ninguna de las dos capas. */
export function sePuedeCortar(e) {
  return e.arriba[11] !== e.arriba[0] && e.arriba[5] !== e.arriba[6]
    && e.abajo[11] !== e.abajo[0] && e.abajo[5] !== e.abajo[6];
}

/** "/" (lanza un error si es ilegal). */
export function cortar(e) {
  if (!sePuedeCortar(e)) throw new Error('"/" ilegal: una esquina atraviesa el corte');
  const arriba = e.arriba.slice(), abajo = e.abajo.slice();
  for (let k = 0; k < 6; k++) { arriba[k] = e.abajo[5 - k]; abajo[k] = e.arriba[5 - k]; }
  return { arriba, abajo, medio: e.medio ^ 1 };
}

const RE_GIRO = /^\((-?\d+),(-?\d+)\)$/;
/** Lee un movimiento: '/' o '(x,y)'. Devuelve null si no es válido. */
export function leerMovimiento(mov) {
  if (mov === '/') return { corte: true };
  const m = RE_GIRO.exec(mov);
  if (!m) return null;
  return { corte: false, x: parseInt(m[1], 10), y: parseInt(m[2], 10) };
}

export function aplicarMovimientoIds(e, mov) {
  const m = leerMovimiento(mov);
  if (!m) throw new Error(`Movimiento no válido: "${mov}"`);
  return m.corte ? cortar(e) : girarCapas(e, m.x, m.y);
}

export function aplicarSecuenciaIds(e, movs) {
  for (const m of movs) e = aplicarMovimientoIds(e, m);
  return e;
}

// ---------------------------------------------------------------------------
// Máscaras de forma
// ---------------------------------------------------------------------------

export function mascara(capa) {
  let m = 0;
  for (let k = 0; k < 12; k++) if (capa[k] !== capa[(k + 11) % 12]) m |= 1 << k;
  return m;
}

const pop = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
export const piezasDeMascara = pop;
export const esquinasDeMascara = (m) => 12 - pop(m);

/** Giro de la capa de arriba x (0..11): nuevo bit k = viejo bit k+x. */
export const rotarArriba = (m, x) => (x === 0 ? m : ((m >>> x) | (m << (12 - x))) & 0xfff);
/** Giro de la capa de abajo y (0..11): nuevo bit k = viejo bit k-y. */
export const rotarAbajo = (m, y) => rotarArriba(m, (12 - y) % 12);
const CORTE = 0x41; // bits 0 y 6
export const mascaraCortable = (m) => (m & CORTE) === CORTE;

const REV = new Uint16Array(64);
for (let v = 0; v < 64; v++) {
  let r = 0;
  for (let i = 1; i <= 5; i++) if (v & (1 << i)) r |= 1 << (6 - i);
  REV[v] = r;
}
/** Máscaras tras "/" (que debe ser legal). */
export function cortarMascaras(t, b) {
  return [(t & ~0x3e) | REV[(b & 0x3e)], (b & ~0x3e) | REV[(t & 0x3e)]];
}

export function mascaraValida(m) {
  if (m <= 0 || m > 0xfff) return false;
  for (let k = 0; k < 12; k++) if (!(m & (1 << k)) && !(m & (1 << ((k + 1) % 12)))) return false;
  return true;
}

export const MASCARAS = [];
export const IDX_MASCARA = new Int16Array(4096).fill(-1);
for (let m = 1; m < 4096; m++) if (mascaraValida(m)) { IDX_MASCARA[m] = MASCARAS.length; MASCARAS.push(m); }
const NM = MASCARAS.length; // 322
export const N_FORMAS = NM * NM;
export const indiceForma = (t, b) => IDX_MASCARA[t] * NM + IDX_MASCARA[b];
export const formaDeIndice = (s) => [MASCARAS[Math.floor(s / NM)], MASCARAS[s % NM]];

/** Patrón de una máscara como texto (A = arista, EE = esquina), empezando en la casilla 0. */
export function textoMascara(m) {
  let s = '';
  for (let k = 0; k < 12; k++) {
    if (!(m & (1 << k))) { s += 'E'; continue; }
    s += (m & (1 << ((k + 1) % 12))) ? 'A' : 'E';
  }
  return s;
}

// ---------------------------------------------------------------------------
// Paridad
// ---------------------------------------------------------------------------

function secuencia(e) {
  const s = [];
  for (let k = 0; k < 12; k++) if (e.arriba[k] !== e.arriba[(k + 11) % 12]) s.push(e.arriba[k]);
  for (let k = 0; k < 12; k++) if (e.abajo[k] !== e.abajo[(k + 11) % 12]) s.push(e.abajo[k]);
  return s;
}
function paridadSecuencia(s) {
  let inv = 0;
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) if (s[j] < s[i]) inv ^= 1;
  return inv;
}
const PARIDAD_RESUELTO = paridadSecuencia(secuencia(estadoResueltoIds()));
/** Paridad del orden de lectura de las piezas respecto al estado resuelto (0 o 1). */
export function paridadEstado(e) { return paridadSecuencia(secuencia(e)) ^ PARIDAD_RESUELTO; }

// Efecto de cada movimiento sobre la paridad (solo depende de la forma).
export function deltaParidadArriba(m, x) {
  if (x === 0) return 0;
  const n = pop(m), c = pop(m & ((1 << x) - 1));
  return (c * (n - c)) & 1;
}
export function deltaParidadAbajo(m, y) {
  if (y === 0) return 0;
  const n = pop(m), c = pop(m >>> (12 - y));
  return (c * (n - c)) & 1;
}
export function deltaParidadCorte(t, b) {
  const a = pop(t & 0x3f), bb = pop(t) - a, c = pop(b & 0x3f);
  return (a * bb + a * c + bb * c + ((a * (a - 1)) >> 1) + ((c * (c - 1)) >> 1)) & 1;
}

// ---------------------------------------------------------------------------
// Marco de la fase 2: las dos capas en forma de cuadrado, la de arriba como en
// el estado resuelto y la de abajo girada (0,-1). En este marco "/" siempre es
// legal y conserva el marco (igual que (3a,3b)). Al final, (0,1) lleva al
// estado resuelto.
// ---------------------------------------------------------------------------

export const ESTADO_MARCO = girarCapas(estadoResueltoIds(), 0, -1);
export const MARCO_T = mascara(ESTADO_MARCO.arriba);
export const MARCO_B = mascara(ESTADO_MARCO.abajo);
const PARIDAD_MARCO = paridadEstado(ESTADO_MARCO);
const FORMA_MARCO = indiceForma(MARCO_T, MARCO_B);
export const MASCARA_RESUELTO = mascara(RESUELTO_ARRIBA); // misma en las dos capas

// Posiciones de esquinas y aristas en el marco (casilla inicial y capa)
const POS_E = [], POS_A = [];
for (const [capa, arr] of [['arriba', ESTADO_MARCO.arriba], ['abajo', ESTADO_MARCO.abajo]]) {
  const m = mascara(arr);
  for (let k = 0; k < 12; k++) {
    if (!(m & (1 << k))) continue;
    if (esEsquina(arr[k])) POS_E.push([capa, k]); else POS_A.push([capa, k]);
  }
}

function coordsMarco(e) {
  const ce = POS_E.map(([c, k]) => e[c][k]);
  const ca = POS_A.map(([c, k]) => e[c][k] - 8);
  return [indicePerm(ce), indicePerm(ca)];
}
function estadoDeCoordsMarco(ie, ia, medio) {
  const ce = permDeIndice(ie, 8), ca = permDeIndice(ia, 8);
  const e = clonarIds(ESTADO_MARCO);
  e.medio = medio;
  POS_E.forEach(([c, k], i) => { e[c][k] = ce[i]; e[c][(k + 1) % 12] = ce[i]; });
  POS_A.forEach(([c, k], i) => { e[c][k] = ca[i] + 8; });
  return e;
}

// ---------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------

let T = null;
const ahora = () => (globalThis.performance || Date).now();

/**
 * BFS por niveles con dos tipos de aristas: las de coste 0 (giros) y las de
 * coste 1 ("/"). `cero(v, emitir)` y `uno(v, emitir)` llaman a emitir(w) con
 * cada vecino. Cada estado entra una sola vez en la cola. Devuelve Int8Array
 * de distancias (-1 = no alcanzable).
 */
function bfsNiveles(N, iniciales, cero, uno) {
  const dist = new Int8Array(N).fill(-1);
  const cola = new Int32Array(N);
  let fin = 0;
  let nivel = 0;
  for (const v of iniciales) if (dist[v] < 0) { dist[v] = 0; cola[fin++] = v; }
  let a = 0;
  const emitirMismo = (w) => { if (dist[w] < 0) { dist[w] = nivel; cola[fin++] = w; } };
  const emitirSig = (w) => { if (dist[w] < 0) { dist[w] = nivel + 1; cola[fin++] = w; } };
  while (a < fin) {
    // cierre por giros del nivel actual
    for (let i = a; i < fin; i++) cero(cola[i], emitirMismo);
    const b = fin;
    for (let i = a; i < b; i++) uno(cola[i], emitirSig);
    a = b;
    nivel++;
  }
  return dist;
}

/** Estado (forma, paridad, medio) alcanzable: BFS con (1,0), (0,1) y "/". */
function bfsAlcanzables() {
  const s0 = indiceForma(MASCARA_RESUELTO, MASCARA_RESUELTO) * 4;
  const dist = bfsNiveles(N_FORMAS * 4, [s0],
    (v, emitir) => {
      const s = v >> 2, p = (v >> 1) & 1, med = v & 1;
      const [t, b] = formaDeIndice(s);
      emitir(indiceForma(rotarArriba(t, 1), b) * 4 + ((p ^ deltaParidadArriba(t, 1)) << 1) + med);
      emitir(indiceForma(t, rotarAbajo(b, 1)) * 4 + ((p ^ deltaParidadAbajo(b, 1)) << 1) + med);
    },
    (v, emitir) => {
      const s = v >> 2, p = (v >> 1) & 1, med = v & 1;
      const [t, b] = formaDeIndice(s);
      if (!mascaraCortable(t) || !mascaraCortable(b)) return;
      const [t2, b2] = cortarMascaras(t, b);
      emitir(indiceForma(t2, b2) * 4 + ((p ^ deltaParidadCorte(t, b)) << 1) + (med ^ 1));
    });
  const visto = new Uint8Array(dist.length);
  let total = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) { visto[i] = 1; total++; }
  return { visto, total, barras: dist };
}

/**
 * Distancia (en barras) de cada (forma, paridad) al marco de la fase 2 con la
 * paridad del marco. Los giros cuestan 0 y "/" cuesta 1. El grafo es no
 * dirigido (los giros por 1 generan los giros inversos y "/" es su propio
 * inverso), así que distancia desde el marco = distancia hasta el marco.
 */
function bfsFase1() {
  return bfsNiveles(N_FORMAS * 2, [FORMA_MARCO * 2 + PARIDAD_MARCO],
    (v, emitir) => {
      const s = v >> 1, p = v & 1;
      const [t, b] = formaDeIndice(s);
      emitir(indiceForma(rotarArriba(t, 1), b) * 2 + (p ^ deltaParidadArriba(t, 1)));
      emitir(indiceForma(t, rotarAbajo(b, 1)) * 2 + (p ^ deltaParidadAbajo(b, 1)));
    },
    (v, emitir) => {
      const s = v >> 1, p = v & 1;
      const [t, b] = formaDeIndice(s);
      if (!mascaraCortable(t) || !mascaraCortable(b)) return;
      const [t2, b2] = cortarMascaras(t, b);
      emitir(indiceForma(t2, b2) * 2 + (p ^ deltaParidadCorte(t, b)));
    });
}

// Subconjuntos de 4 de 8 posiciones (70)
const SUB_IDX = new Int16Array(256).fill(-1);
const SUB_MASK = [];
for (let m = 0; m < 256; m++) if (pop(m) === 4) { SUB_IDX[m] = SUB_MASK.length; SUB_MASK.push(m); }

/**
 * Generadores de la fase 2, todos dentro del marco (coordenadas del marco):
 *   0: (3,0)   1: (0,3)   2: "/" en el marco   3: (1,1) "/" (-1,-1)
 * El 3 es el "/" de la otra alineación en forma de cubo en la que "/"
 * conserva el cubo (las dos capas giradas una casilla). Sin él, cada esquina
 * quedaría pegada a una arista (ver tests: el grupo pasa de 8!·2 a 8!·8!).
 */
export const GENERADORES_FASE2 = [
  (e) => girarCapas(e, 3, 0),
  (e) => girarCapas(e, 0, 3),
  cortar,
  (e) => girarCapas(cortar(girarCapas(e, 1, 1)), -1, -1),
];

/** Tablas de la fase 2: movimientos sobre coordenadas y dos tablas de poda combinadas. */
function tablasFase2() {
  const N8 = 40320;
  const posIds = (e) => [POS_E.map(([c, k]) => e[c][k]), POS_A.map(([c, k]) => e[c][k] - 8)];
  const [base0e, base0a] = posIds(ESTADO_MARCO);
  const permE = [], permA = [];
  for (const g of GENERADORES_FASE2) {
    const tras = g(ESTADO_MARCO);
    if (mascara(tras.arriba) !== MARCO_T || mascara(tras.abajo) !== MARCO_B) throw new Error('El marco de la fase 2 no se conserva');
    const [ne, na] = posIds(tras);
    permE.push(ne.map((id) => base0e.indexOf(id)));
    permA.push(na.map((id) => base0a.indexOf(id)));
  }
  const NG = GENERADORES_FASE2.length;
  const movE = [], movA = [], movSE = [], movSA = [];
  for (let g = 0; g < NG; g++) {
    movE.push(new Int32Array(N8)); movA.push(new Int32Array(N8));
    movSE.push(new Int8Array(70)); movSA.push(new Int8Array(70));
  }
  const p = new Array(8), q = new Array(8);
  for (let i = 0; i < N8; i++) {
    const pi = permDeIndice(i, 8);
    for (let g = 0; g < NG; g++) {
      for (let j = 0; j < 8; j++) { p[j] = pi[permE[g][j]]; q[j] = pi[permA[g][j]]; }
      movE[g][i] = indicePerm(p);
      movA[g][i] = indicePerm(q);
    }
  }
  for (let s = 0; s < 70; s++) {
    const m = SUB_MASK[s];
    for (let g = 0; g < NG; g++) {
      let me = 0, ma = 0;
      for (let j = 0; j < 8; j++) {
        if (m & (1 << permE[g][j])) me |= 1 << j;
        if (m & (1 << permA[g][j])) ma |= 1 << j;
      }
      movSE[g][s] = SUB_IDX[me]; movSA[g][s] = SUB_IDX[ma];
    }
  }
  // Subconjunto "piezas que en el marco están arriba" (ids de esquina < 4, aristas 8..11)
  const subDe = (ids, enCasa) => { let m = 0; ids.forEach((id, j) => { if (enCasa(id)) m |= 1 << j; }); return SUB_IDX[m]; };
  const coordsCompletas = (e) => {
    const [ie, ia] = posIds(e);
    return {
      ce: indicePerm(ie), ca: indicePerm(ia),
      se: subDe(ie, (id) => id < 4), sa: subDe(ia, (id) => id < 4),
    };
  };
  // Objetivos: el estado del marco girado (3a,3b), con medio = 0
  const objetivos = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    objetivos.push({ a, b, ...coordsCompletas(girarCapas(ESTADO_MARCO, 3 * a, 3 * b)) });
  }
  // Poda A: esquinas (permutación) × aristas (qué posiciones tienen aristas "de arriba") × medio
  // Poda B: aristas (permutación) × esquinas (subconjunto) × medio
  const podaComb = (movP, movS, ini) => {
    const N = N8 * 70 * 2;
    return bfsNiveles(N, ini,
      (v, emitir) => {
        const med = v & 1, r = v >> 1, s = r % 70, c = (r - s) / 70;
        emitir((movP[0][c] * 70 + movS[0][s]) * 2 + med);
        emitir((movP[1][c] * 70 + movS[1][s]) * 2 + med);
      },
      (v, emitir) => {
        const med = v & 1, r = v >> 1, s = r % 70, c = (r - s) / 70;
        emitir((movP[2][c] * 70 + movS[2][s]) * 2 + (med ^ 1));
        emitir((movP[3][c] * 70 + movS[3][s]) * 2 + (med ^ 1));
      });
  };
  const podaA = podaComb(movE, movSA, objetivos.map((o) => (o.ce * 70 + o.sa) * 2));
  const podaB = podaComb(movA, movSE, objetivos.map((o) => (o.ca * 70 + o.se) * 2));
  const objetivoDe = new Map();
  for (const o of objetivos) objetivoDe.set(o.ce * N8 + o.ca, o);
  return { movE, movA, movSE, movSA, podaA, podaB, objetivoDe, coordsCompletas };
}

export function inicializarMotor() {
  if (T) return { ms: T.ms };
  const t0 = ahora();
  const alc = bfsAlcanzables();
  const fase1 = bfsFase1();
  const f2 = tablasFase2();
  // Giros legales por máscara: x tales que tras girar se puede cortar
  const girosArriba = MASCARAS.map((m) => { const r = []; for (let x = 0; x < 12; x++) if (mascaraCortable(rotarArriba(m, x))) r.push(x); return r; });
  const girosAbajo = MASCARAS.map((m) => { const r = []; for (let y = 0; y < 12; y++) if (mascaraCortable(rotarAbajo(m, y))) r.push(y); return r; });
  // Formas cortables y alcanzables (para el estado aleatorio)
  const cortables = [];
  for (let s = 0; s < N_FORMAS; s++) {
    if (!alc.visto[s * 4]) continue;
    const [t, b] = formaDeIndice(s);
    if (mascaraCortable(t) && mascaraCortable(b)) cortables.push(s);
  }
  T = { alc, fase1, ...f2, girosArriba, girosAbajo, cortables, ms: 0 };
  T.ms = Math.round(ahora() - t0);
  return { ms: T.ms };
}
export const motorInicializado = () => !!T;
export function tablas() { inicializarMotor(); return T; }

/** ¿Es alcanzable una forma con esa paridad y capa del medio? */
export function alcanzable(t, b, paridad, medio) {
  inicializarMotor();
  if (!mascaraValida(t) || !mascaraValida(b)) return false;
  return T.alc.visto[indiceForma(t, b) * 4 + paridad * 2 + medio] === 1;
}

// ---------------------------------------------------------------------------
// Solver en dos fases
//   Fase 1: llegar a la forma del marco con la paridad correcta. Búsqueda
//   sobre el estado real, podada con la distancia exacta forma×paridad. Solo
//   se prueban giros (x,y) que dejan el "/" legal en esa forma.
//   Fase 2: en forma de cubo, con (3a,3b) y "/" en las dos alineaciones en las
//   que "/" es legal y conserva el cubo, resolver la permutación y la capa del
//   medio con IDA*.
// Se minimiza el número de barras. Los giros consecutivos se unen al final y
// los tests comprueban cada solución aplicándola con el modelo que lanza error.
// ---------------------------------------------------------------------------

const FIN_TIEMPO = new Error('tiempo agotado');

/**
 * IDA* de la fase 2 desde el marco (alineación 0). Devuelve { pasos, final }:
 * pasos = [[giroX, giroY], ...] reales antes de cada "/", final = giro real
 * hasta el resuelto. null si no hay solución con ≤ maxProf barras.
 */
function fase2(c0, med0, maxProf, permitirCero, limite) {
  const { movE, movA, movSE, movSA, podaA, podaB, objetivoDe } = T;
  const h = (c) => Math.max(podaA[(c.ce * 70 + c.sa) * 2 + c.m], podaB[(c.ca * 70 + c.se) * 2 + c.m]);
  const ini = { ...c0, m: med0 };
  const h0 = h(ini);
  if (h0 > maxProf) return null;
  const pasos = [];
  let nodos = 0;
  function buscar(ce, ca, se, sa, m, alin, d, primera) {
    if (d === 0) {
      if (m !== 0) return null;
      let e1 = ce, a1 = ca;
      for (let x = 0; x < 4; x++) {
        let e2 = e1, a2 = a1;
        for (let y = 0; y < 4; y++) {
          const o = objetivoDe.get(e2 * 40320 + a2);
          if (o) return [3 * x - 3 * o.a - alin, 3 * y - 3 * o.b + 1 - alin];
          e2 = movE[1][e2]; a2 = movA[1][a2];
        }
        e1 = movE[0][e1]; a1 = movA[0][a1];
      }
      return null;
    }
    if ((++nodos & 2047) === 0 && ahora() > limite) throw FIN_TIEMPO;
    let e1 = ce, a1 = ca, s1 = se, t1 = sa;
    for (let x = 0; x < 4; x++) {
      let e2 = e1, a2 = a1, s2 = s1, t2 = t1;
      for (let y = 0; y < 4; y++) {
        for (let nueva = 0; nueva < 2; nueva++) {
          // giro real: (3x + nueva - alin, 3y + nueva - alin)
          if (!primera && x === 0 && y === 0 && nueva === alin) continue;
          const g = 2 + nueva;
          const e3 = movE[g][e2], a3 = movA[g][a2], s3 = movSE[g][s2], t3 = movSA[g][t2], m3 = m ^ 1;
          if (podaA[(e3 * 70 + t3) * 2 + m3] >= d || podaB[(a3 * 70 + s3) * 2 + m3] >= d) continue;
          pasos.push([3 * x + nueva - alin, 3 * y + nueva - alin]);
          const r = buscar(e3, a3, s3, t3, m3, nueva, d - 1, false);
          if (r) return r;
          pasos.pop();
        }
        e2 = movE[1][e2]; a2 = movA[1][a2]; s2 = movSE[1][s2]; t2 = movSA[1][t2];
      }
      e1 = movE[0][e1]; a1 = movA[0][a1]; s1 = movSE[0][s1]; t1 = movSA[0][t1];
    }
    return null;
  }
  for (let d = h0; d <= maxProf; d++) {
    const final = buscar(ini.ce, ini.ca, ini.se, ini.sa, ini.m, 0, d, permitirCero);
    if (final) return { pasos: pasos.slice(), final };
  }
  return null;
}

/** Une giros seguidos, quita (0,0) y cancela "/ /". Devuelve una lista nueva. */
export function simplificar(movs) {
  const res = [];
  for (const m of movs) {
    const l = leerMovimiento(m);
    const ult = res.length ? leerMovimiento(res[res.length - 1]) : null;
    if (l.corte) {
      if (ult && ult.corte) res.pop(); else res.push('/');
    } else if (ult && !ult.corte) {
      res[res.length - 1] = `(${normalizarGiro(ult.x + l.x)},${normalizarGiro(ult.y + l.y)})`;
    } else res.push(`(${normalizarGiro(l.x)},${normalizarGiro(l.y)})`);
    // quitar giros nulos (y cancelar los "/ /" que eso deje juntos)
    while (res.length && res[res.length - 1] === '(0,0)') {
      res.pop();
      const n = res.length;
      if (n >= 2 && res[n - 1] === '/' && res[n - 2] === '/') res.splice(n - 2, 2);
    }
  }
  return res;
}

export const contarBarras = (movs) => movs.filter((m) => m === '/').length;
/** Métrica WCA (Regulación 12c4): cada (x,y) cuenta 1 y cada "/" cuenta 1. */
export const contarWCA = (movs) => movs.length;
/** Métrica de giros: cada "/" cuenta 1 y cada capa girada cuenta 1. */
export function contarGiros(movs) {
  let n = 0;
  for (const m of movs) {
    const l = leerMovimiento(m);
    n += l.corte ? 1 : (l.x !== 0) + (l.y !== 0);
  }
  return n;
}

/**
 * Resuelve un estado de ids (debe ser alcanzable; si no, lanza un error).
 * opciones: { msMax: tiempo para mejorar la primera solución (por defecto 300),
 *             objetivoBarras: parar al llegar a esa longitud }
 * Devuelve { movimientos, barras } en notación WCA.
 */
export function resolverIds(estado, opciones = {}) {
  inicializarMotor();
  const msMax = opciones.msMax ?? 300;
  const objetivo = opciones.objetivoBarras ?? 0;
  const t0 = ahora();
  const t = mascara(estado.arriba), b = mascara(estado.abajo);
  if (!mascaraValida(t) || !mascaraValida(b)) throw new Error('Forma no válida');
  const par0 = paridadEstado(estado);
  const h1 = T.fase1[indiceForma(t, b) * 2 + par0];
  if (h1 < 0) throw new Error('Forma no alcanzable');
  let mejor = null;
  let limite = Infinity;
  const MAX_TOTAL = 40;
  const camino1 = [];

  function registrar(movs) {
    const sol = simplificar(movs);
    const barras = contarBarras(sol);
    if (!mejor || barras < mejor.barras || (barras === mejor.barras && contarGiros(sol) < contarGiros(mejor.movimientos))) {
      if (!mejor) limite = ahora() + msMax;
      mejor = { movimientos: sol, barras };
    }
  }

  // Fase 1 con profundidad exacta d (barras); en las hojas, la fase 2.
  function f1(e, ti, bi, p, d, primera) {
    const tm = MASCARAS[ti], bm = MASCARAS[bi];
    if (d === 0) {
      let gx = -1, gy = -1;
      for (let x = 0; x < 12 && gx < 0; x++) if (rotarArriba(tm, x) === MARCO_T) gx = x;
      for (let y = 0; y < 12 && gy < 0; y++) if (rotarAbajo(bm, y) === MARCO_B) gy = y;
      const em = girarCapas(e, gx, gy);
      const tope = (mejor ? mejor.barras - 1 : MAX_TOTAL) - camino1.length;
      if (tope < 0) return false;
      // (0,0) al empezar la fase 2 solo si antes no hay un "/" (o el giro hasta el marco no es nulo)
      const permitirCero = camino1.length === 0 || gx !== 0 || gy !== 0;
      const r = fase2(T.coordsCompletas(em), em.medio, tope, permitirCero, limite);
      if (!r) return false;
      const movs = [];
      for (const [x, y] of camino1) movs.push(`(${x},${y})`, '/');
      movs.push(`(${gx},${gy})`);
      for (const [x, y] of r.pasos) movs.push(`(${x},${y})`, '/');
      movs.push(`(${r.final[0]},${r.final[1]})`);
      registrar(movs);
      return mejor.barras <= objetivo;
    }
    if (ahora() > limite) throw FIN_TIEMPO;
    for (const x of T.girosArriba[ti]) {
      for (const y of T.girosAbajo[bi]) {
        if (!primera && x === 0 && y === 0) continue;
        const t1 = rotarArriba(tm, x), b1 = rotarAbajo(bm, y);
        const p1 = p ^ deltaParidadArriba(tm, x) ^ deltaParidadAbajo(bm, y);
        const [t2, b2] = cortarMascaras(t1, b1);
        const p2 = p1 ^ deltaParidadCorte(t1, b1);
        const ti2 = IDX_MASCARA[t2], bi2 = IDX_MASCARA[b2];
        const hh = T.fase1[(ti2 * NM + bi2) * 2 + p2];
        if (hh < 0 || hh > d - 1) continue;
        const e2 = cortar(girarCapas(e, x, y));
        camino1.push([x, y]);
        const fin = f1(e2, ti2, bi2, p2, d - 1, false);
        camino1.pop();
        if (fin) return true;
      }
    }
    return false;
  }

  try {
    for (let d1 = h1; d1 <= MAX_TOTAL; d1++) {
      if (mejor && d1 >= mejor.barras) break;
      if (f1(estado, IDX_MASCARA[t], IDX_MASCARA[b], par0, d1, true)) break;
    }
  } catch (err) {
    if (err !== FIN_TIEMPO) throw err;
  }
  if (!mejor) throw new Error('No se encontró solución');
  return { ...mejor, ms: ahora() - t0 };
}

// ---------------------------------------------------------------------------
// Longitud mínima (Regulación 4b3d: el estado debe requerir al menos 11
// movimientos en la métrica 12c4). Búsqueda exacta acotada: ¿existe una
// solución con como mucho `presupuesto` movimientos? Se poda con la distancia
// exacta en barras de (forma, paridad, medio) al resuelto: una solución con h
// barras tiene al menos 2h-1 movimientos.
// ---------------------------------------------------------------------------

/** Si un giro (x,y) deja el estado resuelto, lo devuelve; si no, null. */
export function giroHastaResuelto(e) {
  if (e.medio !== 0) return null;
  let gx = null, gy = null;
  for (let x = 0; x < 12 && gx === null; x++) if (RESUELTO_ARRIBA.every((v, k) => e.arriba[mod12(k + x)] === v)) gx = x;
  for (let y = 0; y < 12 && gy === null; y++) if (RESUELTO_ABAJO.every((v, k) => e.abajo[mod12(k - y)] === v)) gy = y;
  return gx === null || gy === null ? null : [gx, gy];
}

/** Hash de 53 bits de un estado (para el conjunto de estados cercanos al resuelto). */
function hashEstado(e) {
  let a = 2166136261, b = 0x9747b28c;
  const mezclar = (v) => {
    a = Math.imul(a ^ v, 16777619);
    b = Math.imul(b ^ (v + 31), 0x5bd1e995); b ^= b >>> 13;
  };
  for (let k = 0; k < 12; k++) mezclar(e.arriba[k]);
  for (let k = 0; k < 12; k++) mezclar(e.abajo[k] + 16);
  mezclar(e.medio + 40);
  return (a >>> 0) * 2097152 + ((b >>> 0) >>> 11);
}

/** Recorre todas las secuencias legales de como mucho `max` movimientos (sin dos giros ni dos "/" seguidos). */
function recorrer(e0, max, visitar, poda) {
  function rec(e, p, ultimoCorte) {
    if (visitar(e, p) === true) return true;
    if (p === 0 || (poda && poda(e, p))) return false;
    if (ultimoCorte !== false) {
      // un giro (no nulo)
      for (let x = -5; x <= 6; x++) for (let y = -5; y <= 6; y++) {
        if (x === 0 && y === 0) continue;
        if (rec(girarCapas(e, x, y), p - 1, false)) return true;
      }
    }
    if (ultimoCorte !== true && sePuedeCortar(e)) {
      if (rec(cortar(e), p - 1, true)) return true;
    }
    return false;
  }
  return rec(e0, max, null);
}

const RADIO_CERCA = 6;
let CERCA = null; // hashes ordenados de los estados a ≤ RADIO_CERCA movimientos del resuelto
function conjuntoCercano() {
  if (CERCA) return CERCA;
  const hs = [];
  recorrer(estadoResueltoIds(), RADIO_CERCA, (e) => { hs.push(hashEstado(e)); });
  const arr = Float64Array.from(hs).sort();
  let n = 0;
  for (let i = 0; i < arr.length; i++) if (i === 0 || arr[i] !== arr[i - 1]) arr[n++] = arr[i];
  CERCA = arr.slice(0, n);
  return CERCA;
}
function enCercano(e) {
  const arr = conjuntoCercano(), h = hashEstado(e);
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === h) return true;
    if (arr[mid] < h) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}

/**
 * ¿Hay una solución de como mucho `presupuesto` movimientos (métrica WCA 12c4)?
 * Para presupuesto > 6: encuentro a mitad de camino. Si existe una solución
 * óptima de L ≤ presupuesto movimientos, el estado tras sus primeros
 * max(0, L-6) movimientos está a ≤ 6 del resuelto, así que basta recorrer
 * desde el estado como mucho presupuesto-6 movimientos y mirar si se cae en
 * el conjunto precalculado. Un falso positivo del hash solo puede hacer que se
 * descarte un estado válido (nunca que se acepte uno corto).
 */
export function haySolucionCorta(estado, presupuesto) {
  inicializarMotor();
  const dist = T.alc.barras;
  const cota = (e) => {
    const h = dist[indiceForma(mascara(e.arriba), mascara(e.abajo)) * 4 + paridadEstado(e) * 2 + e.medio];
    return h <= 0 ? 0 : 2 * h - 1;
  };
  if (presupuesto <= RADIO_CERCA) {
    return recorrer(estado, presupuesto, esResueltoExacto, (e, p) => cota(e) > p);
  }
  const prof = presupuesto - RADIO_CERCA;
  return recorrer(estado, prof, (e) => enCercano(e), (e, p) => cota(e) > p + RADIO_CERCA);
}
// El recorrido ya prueba los giros finales: basta con mirar si el estado visitado está resuelto.
function esResueltoExacto(e) { const g = giroHastaResuelto(e); return g !== null && g[0] === 0 && g[1] === 0; }

/** ¿Requiere el estado al menos n movimientos (métrica 12c4)? */
export const requiereAlMenos = (estado, n) => !haySolucionCorta(estado, n - 1);

// ---------------------------------------------------------------------------
// Estado aleatorio
// ---------------------------------------------------------------------------

/** Construye un estado a partir de una forma y el orden de esquinas y aristas (en orden de lectura). */
export function estadoDeForma(t, b, esquinas, aristas, medio) {
  const e = { arriba: new Array(12), abajo: new Array(12), medio };
  let ie = 0, ia = 0;
  for (const [capa, m] of [['arriba', t], ['abajo', b]]) {
    for (let k = 0; k < 12; k++) {
      if (!(m & (1 << k))) continue;
      if (m & (1 << ((k + 1) % 12))) e[capa][k] = aristas[ia++];
      else { e[capa][k] = esquinas[ie]; e[capa][(k + 1) % 12] = esquinas[ie++]; }
    }
  }
  return e;
}

/**
 * Estado uniforme entre los estados alcanzables en los que se puede hacer "/"
 * sin girar antes (Regulación 4b3d). Cada forma tiene el mismo número de
 * estados (8!·8!·2, ver tests), así que basta con elegir la forma al azar.
 */
export function estadoAleatorioIds(rng) {
  inicializarMotor();
  const s = T.cortables[entero(rng, T.cortables.length)];
  const [t, b] = formaDeIndice(s);
  const esq = barajar(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  const ari = barajar(rng, [8, 9, 10, 11, 12, 13, 14, 15]);
  return estadoDeForma(t, b, esq, ari, entero(rng, 2));
}
