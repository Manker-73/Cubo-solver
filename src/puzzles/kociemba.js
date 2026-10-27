// Algoritmo de dos fases de Kociemba para el 3x3.
//
// Fase 1: llevar el cubo al subgrupo G1 = <U, D, R2, L2, F2, B2>
//         (esquinas y aristas orientadas, aristas del ecuador en el ecuador).
// Fase 2: resolver dentro de G1.
// Las tablas de movimientos y de poda se generan en tiempo de ejecución.

import { indicePerm, permDeIndice, binom } from '../core/perm.js';

// Esquinas: URF UFL ULB UBR DFR DLF DBL DRB · Aristas: UR UF UL UB DR DF DL DB FR FL BL BR
// Movimientos básicos en notación "reemplazado por" (cp[i] = pieza que va a la posición i).
const BASICOS = {
  U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  R: { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  F: { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
  D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  L: { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  B: { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
};
export const CARAS_K = ['U', 'R', 'F', 'D', 'L', 'B'];
const SUF = ['', '2', "'"];
// Índice de movimiento m = 3*cara + (potencia-1)
export const NOMBRES_MOV = [];
for (const c of CARAS_K) for (const s of SUF) NOMBRES_MOV.push(c + s);

export function cuboResuelto() {
  return { cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
}

/** Producto a·b (primero a, luego b). */
export function multiplicar(a, b) {
  const r = { cp: new Array(8), co: new Array(8), ep: new Array(12), eo: new Array(12) };
  for (let i = 0; i < 8; i++) {
    r.cp[i] = a.cp[b.cp[i]];
    r.co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    r.ep[i] = a.ep[b.ep[i]];
    r.eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
  }
  return r;
}

export const MOV_CUBO = [];
for (const c of CARAS_K) {
  let x = BASICOS[c];
  for (let k = 0; k < 3; k++) {
    MOV_CUBO.push(x);
    x = multiplicar(x, BASICOS[c]);
  }
}

export function aplicarMovCubo(cubo, m) {
  return multiplicar(cubo, MOV_CUBO[m]);
}

// ---------- Coordenadas ----------
export function getTwist(c) { let r = 0; for (let i = 0; i < 7; i++) r = r * 3 + c.co[i]; return r; }
function setTwist(c, t) {
  let s = 0;
  for (let i = 6; i >= 0; i--) { c.co[i] = t % 3; s += c.co[i]; t = Math.floor(t / 3); }
  c.co[7] = (3 - (s % 3)) % 3;
}
export function getFlip(c) { let r = 0; for (let i = 0; i < 11; i++) r = r * 2 + c.eo[i]; return r; }
function setFlip(c, f) {
  let s = 0;
  for (let i = 10; i >= 0; i--) { c.eo[i] = f & 1; s += c.eo[i]; f >>= 1; }
  c.eo[11] = s & 1;
}
/** Posición (sin orden) de las 4 aristas del ecuador: 0..494, 0 = resuelto. */
export function getSlice(c) {
  let a = 0, x = 0;
  for (let j = 11; j >= 0; j--) {
    if (c.ep[j] >= 8) { a += binom(11 - j, x + 1); x++; }
  }
  return a;
}
function setSlice(c, idx) {
  const ep = new Array(12).fill(-1);
  let a = idx, x = 4;
  for (let j = 0; j < 12; j++) {
    if (x > 0 && a - binom(11 - j, x) >= 0) { ep[j] = 8 + (4 - x); a -= binom(11 - j, x); x--; }
  }
  let k = 0;
  for (let j = 0; j < 12; j++) if (ep[j] < 0) ep[j] = k++;
  c.ep = ep;
}
const getCPerm = (c) => indicePerm(c.cp);
const getUDPerm = (c) => indicePerm(c.ep.slice(0, 8));
const getSlicePerm = (c) => indicePerm(c.ep.slice(8).map((x) => x - 8));

const N_TWIST = 2187, N_FLIP = 2048, N_SLICE = 495, N_PERM8 = 40320, N_SPERM = 24;
const N_MOV = 18;
// Movimientos de la fase 2 (índices en NOMBRES_MOV): U U2 U' D D2 D' R2 F2 L2 B2
const MOV_F2 = [0, 1, 2, 9, 10, 11, 4, 7, 13, 16];
const ES_F2 = new Array(N_MOV).fill(false);
MOV_F2.forEach((m) => { ES_F2[m] = true; });

let T = null; // tablas
let msTablas = 0;

function tablaMov(tam, movs, set, get) {
  const t = new Uint16Array(tam * movs.length);
  for (let i = 0; i < tam; i++) {
    const c = cuboResuelto();
    set(c, i);
    for (let k = 0; k < movs.length; k++) t[i * movs.length + k] = get(multiplicar(c, MOV_CUBO[movs[k]]));
  }
  return t;
}

/** BFS para una tabla de poda sobre el par (a, b); nM movimientos. */
function tablaPoda(tamA, movA, tamB, movB, nM) {
  const total = tamA * tamB;
  const p = new Int8Array(total).fill(-1);
  p[0] = 0;
  let hechos = 1, d = 0;
  while (hechos < total) {
    // búsqueda hacia delante o hacia atrás según lo lleno que esté
    const atras = hechos > total / 2;
    let nuevos = 0;
    for (let i = 0; i < total; i++) {
      if (atras ? p[i] !== -1 : p[i] !== d) continue;
      const a = Math.floor(i / tamB), b = i - a * tamB;
      for (let m = 0; m < nM; m++) {
        const j = movA[a * nM + m] * tamB + movB[b * nM + m];
        if (atras) {
          if (p[j] === d) { p[i] = d + 1; nuevos++; break; }
        } else if (p[j] === -1) { p[j] = d + 1; nuevos++; }
      }
    }
    if (nuevos === 0) break;
    hechos += nuevos;
    d++;
  }
  return p;
}

/** Genera todas las tablas (idempotente). Devuelve los milisegundos empleados. */
export function inicializarKociemba() {
  if (T) return 0;
  return generarTablas();
}
/** Milisegundos que tardó la generación de tablas (0 si aún no se han generado). */
export const msTablasKociemba = () => msTablas;
function generarTablas() {
  const t0 = Date.now();
  const todos = Array.from({ length: N_MOV }, (_, i) => i);
  const twist = tablaMov(N_TWIST, todos, setTwist, getTwist);
  const flip = tablaMov(N_FLIP, todos, setFlip, getFlip);
  const slice = tablaMov(N_SLICE, todos, setSlice, getSlice);
  const cperm = tablaMov(N_PERM8, MOV_F2, (c, i) => { c.cp = permDeIndice(i, 8); }, getCPerm);
  const udperm = tablaMov(N_PERM8, MOV_F2, (c, i) => { c.ep = permDeIndice(i, 8).concat([8, 9, 10, 11]); }, getUDPerm);
  const sperm = tablaMov(N_SPERM, MOV_F2, (c, i) => { c.ep = [0, 1, 2, 3, 4, 5, 6, 7].concat(permDeIndice(i, 4).map((x) => x + 8)); }, getSlicePerm);
  const podaST = tablaPoda(N_SLICE, slice, N_TWIST, twist, N_MOV);
  const podaSF = tablaPoda(N_SLICE, slice, N_FLIP, flip, N_MOV);
  const podaTF = tablaPoda(N_TWIST, twist, N_FLIP, flip, N_MOV);
  const podaSC = tablaPoda(N_SPERM, sperm, N_PERM8, cperm, MOV_F2.length);
  const podaSE = tablaPoda(N_SPERM, sperm, N_PERM8, udperm, MOV_F2.length);
  T = { twist, flip, slice, cperm, udperm, sperm, podaST, podaSF, podaTF, podaSC, podaSE };
  msTablas = Date.now() - t0;
  return msTablas;
}

export const kociembaListo = () => !!T;

/** Inversa de un cubo (cubies). */
export function inversaCubo(c) {
  const r = { cp: new Array(8), co: new Array(8), ep: new Array(12), eo: new Array(12) };
  for (let i = 0; i < 8; i++) r.cp[c.cp[i]] = i;
  for (let i = 0; i < 8; i++) r.co[i] = (3 - c.co[r.cp[i]]) % 3;
  for (let i = 0; i < 12; i++) r.ep[c.ep[i]] = i;
  for (let i = 0; i < 12; i++) r.eo[i] = c.eo[r.ep[i]];
  return r;
}

/**
 * Resuelve un cubo (cubies).
 * entrada: un cubo, o una lista de variantes [{ cubo, mapa, inversa }] del mismo
 *   estado (el cubo visto desde otra orientación —mapa[cara de la variante] =
 *   cara original— y/o invertido). Se buscan todas a la vez, intercalando por
 *   profundidad de fase 1, y se devuelve la solución más corta encontrada
 *   traducida al estado original. Es la técnica de min2phase y acelera mucho
 *   la búsqueda de soluciones de 20 movimientos.
 * opciones: { objetivo (longitud con la que parar), msMax, maxLong }
 */
export function resolverKociemba(entrada, opciones = {}) {
  inicializarKociemba();
  const variantes = (Array.isArray(entrada) ? entrada : [{ cubo: entrada }]).map((v) => ({
    ...v,
    tw: getTwist(v.cubo), fl: getFlip(v.cubo), sl: getSlice(v.cubo),
  }));
  const objetivo = opciones.objetivo ?? 20;
  const msMax = opciones.msMax ?? 1000;
  let maxLong = opciones.maxLong ?? 30;
  const t0 = Date.now();
  let mejor = null;
  let tiempoAgotado = false;
  let nodos = 0;
  let actual = variantes[0];

  const cam = new Array(40);

  function traducir(movs, v) {
    let r = movs;
    if (v.inversa) r = r.slice().reverse().map((m) => 3 * ((m / 3) | 0) + (2 - (m % 3)));
    if (v.mapa) r = r.map((m) => 3 * v.mapa[(m / 3) | 0] + (m % 3));
    return r;
  }

  function fase2(cp, ud, sp, prof, n1, ultima) {
    // IDA* de la fase 2 con profundidad máxima prof
    const h = Math.max(T.podaSC[sp * N_PERM8 + cp], T.podaSE[sp * N_PERM8 + ud]);
    if (h > prof) return -1;
    for (let lim = h; lim <= prof; lim++) {
      if (dfs2(cp, ud, sp, lim, n1, ultima)) return lim;
    }
    return -1;
  }
  function dfs2(cp, ud, sp, togo, k, ultima) {
    if (togo === 0) return cp === 0 && ud === 0 && sp === 0;
    for (let i = 0; i < MOV_F2.length; i++) {
      const m = MOV_F2[i];
      const f = (m / 3) | 0;
      if (ultima >= 0 && (f === ultima || (f % 3 === ultima % 3 && f < ultima))) continue;
      const cp2 = T.cperm[cp * 10 + i], ud2 = T.udperm[ud * 10 + i], sp2 = T.sperm[sp * 10 + i];
      const h = Math.max(T.podaSC[sp2 * N_PERM8 + cp2], T.podaSE[sp2 * N_PERM8 + ud2]);
      if (h >= togo) continue;
      cam[k] = m;
      if (dfs2(cp2, ud2, sp2, togo - 1, k + 1, f)) return true;
    }
    return false;
  }

  function alFinalFase1(n1) {
    // Calcula las coordenadas de fase 2 aplicando la fase 1 al cubo
    let c = actual.cubo;
    for (let i = 0; i < n1; i++) c = multiplicar(c, MOV_CUBO[cam[i]]);
    const cp = getCPerm(c), ud = getUDPerm(c), sp = getSlicePerm(c);
    const ultima = n1 > 0 ? (cam[n1 - 1] / 3) | 0 : -1;
    const n2 = fase2(cp, ud, sp, maxLong - n1, n1, ultima);
    if (n2 >= 0) {
      mejor = traducir(cam.slice(0, n1 + n2), actual);
      maxLong = n1 + n2 - 1;
      if (mejor.length <= objetivo) return true; // suficiente
    }
    return false;
  }

  function dfs1(tw, fl, sl, togo, k, ultima) {
    if (togo === 0) {
      if (tw === 0 && fl === 0 && sl === 0) {
        // el último movimiento de la fase 1 no puede ser de la fase 2 (sería redundante)
        if (k > 0 && ES_F2[cam[k - 1]]) return false;
        return alFinalFase1(k);
      }
      return false;
    }
    if ((++nodos & 1023) === 0 && Date.now() - t0 > msMax && mejor) { tiempoAgotado = true; return true; }
    for (let m = 0; m < N_MOV; m++) {
      const f = (m / 3) | 0;
      if (ultima >= 0 && (f === ultima || (f % 3 === ultima % 3 && f < ultima))) continue;
      const tw2 = T.twist[tw * N_MOV + m], fl2 = T.flip[fl * N_MOV + m], sl2 = T.slice[sl * N_MOV + m];
      if (T.podaST[sl2 * N_TWIST + tw2] >= togo) continue;
      if (T.podaSF[sl2 * N_FLIP + fl2] >= togo) continue;
      if (T.podaTF[tw2 * N_FLIP + fl2] >= togo) continue;
      cam[k] = m;
      if (dfs1(tw2, fl2, sl2, togo - 1, k + 1, f)) return true;
      if (k + togo > maxLong) return false; // la cota bajó al encontrar una solución
    }
    return false;
  }

  for (const v of variantes) {
    v.h0 = Math.max(T.podaST[v.sl * N_TWIST + v.tw], T.podaSF[v.sl * N_FLIP + v.fl], T.podaTF[v.tw * N_FLIP + v.fl]);
  }
  let fin = false;
  for (let n1 = Math.min(...variantes.map((v) => v.h0)); n1 <= maxLong && !fin; n1++) {
    for (const v of variantes) {
      if (v.h0 > n1 || n1 > maxLong) continue;
      actual = v;
      if (dfs1(v.tw, v.fl, v.sl, n1, 0, -1)) { fin = true; break; }
    }
  }
  return mejor ? { movimientos: mejor.map((m) => NOMBRES_MOV[m]), tiempoAgotado, ms: Date.now() - t0 } : null;
}

// ---------- Conversión pegatinas <-> cubies ----------

/** esquinas/aristas: listas de pegatinas de cada pieza (orden de Kociemba). */
export function cuboDesdeIdentificacion(orbitas) {
  return { cp: orbitas[0].perm.slice(), co: orbitas[0].ori.slice(), ep: orbitas[1].perm.slice(), eo: orbitas[1].ori.slice() };
}

export function paridad8(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) s ^= 1;
  return s;
}
