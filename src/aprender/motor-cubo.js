// Motor común de los métodos humanos de los cubos (modo aprender).
//
// Trabaja sobre el estado de pegatinas de un cubo N (2 o 3) y sabe:
//  - dónde está cada pieza (por sus colores) y dónde debería estar (según los
//    colores de las caras, que da el "marco": color -> cara);
//  - buscar (IDA*) una secuencia corta que deje unas piezas en su sitio con un
//    conjunto de movimientos permitido, con tablas de distancias de 1, 2 o 3
//    piezas que se generan la primera vez que hacen falta;
//  - buscar combinaciones de algoritmos conocidos (con ajustes de la capa U)
//    que cumplan un objetivo (última capa).
//
// Una pieza se sigue por UNA de sus pegatinas (la de referencia): la casilla
// (índice de pegatina 0..6N²-1) en la que está esa pegatina determina a la vez
// la posición y la orientación de la pieza. Mover una pieza es mover esa casilla.

import { baseNxN, CARAS } from '../puzzles/nxn.js';
import { piezasCubo } from '../puzzles/cubo-comun.js';

export const NOMBRE_COLOR = ['blanco', 'rojo', 'verde', 'amarillo', 'naranja', 'azul'];
const NOMBRE_COLOR_F = ['blanca', 'roja', 'verde', 'amarilla', 'naranja', 'azul'];
// Pegatina de referencia de una pieza: la de mayor prioridad
const PRIORIDAD = [0, 3, 2, 5, 1, 4]; // blanco, amarillo, verde, azul, rojo, naranja
export const OPUESTO = [3, 4, 5, 0, 1, 2];
export const NOMBRE_CARA = { U: 'arriba', D: 'abajo', F: 'delante', B: 'detrás', R: 'a la derecha', L: 'a la izquierda' };

/** "blanca y roja", "blanca, roja y verde" (para "la arista ...", "la esquina ..."). */
export function coloresPieza(colores) {
  const n = colores.map((c) => NOMBRE_COLOR_F[c]);
  return n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1];
}

const cacheMotores = new Map();

export function motorCubo(N) {
  if (cacheMotores.has(N)) return cacheMotores.get(N);
  const b = baseNxN(N);
  const n2 = N * N;
  const total = 6 * n2;
  const { esquinas, aristas } = piezasCubo(N);
  const caraDe = (f) => Math.floor(f / n2);
  // pieza (lista de casillas) de cada casilla de esquina/arista
  const ranuraDe = new Array(total).fill(null);
  for (const r of esquinas) for (const f of r) ranuraDe[f] = r;
  for (const r of aristas) for (const f of r) ranuraDe[f] = r;
  const centro = (c) => c * n2 + Math.floor(n2 / 2);

  // destino[mov][f] = casilla a la que va la pegatina de la casilla f
  const cacheDestino = new Map();
  function destino(mov) {
    let d = cacheDestino.get(mov);
    if (d) return d;
    const P = b.permDe(mov);
    d = new Int16Array(total);
    for (let j = 0; j < total; j++) d[P[j]] = j;
    cacheDestino.set(mov, d);
    return d;
  }

  const aplicar = (e, mov) => b.aplicarMovimiento(e, mov);
  const aplicarSec = (e, movs) => { for (const m of movs) e = b.aplicarMovimiento(e, m); return e; };

  /** Marco: cara (0..5 = U R F D L B) de cada color, según los centros (N impar). */
  function marcoCentros(e) {
    const cara = new Array(6);
    for (let f = 0; f < 6; f++) cara[e[centro(f)]] = f;
    return cara;
  }

  /** Colores de la pieza en la ranura r (en el orden de la ranura). */
  const coloresEn = (e, r) => r.map((f) => e[f]);

  /**
   * Una pieza = sus colores. Devuelve { colores, ref, casa, donde }:
   * ref = color de referencia, casa = casilla donde debe quedar esa pegatina,
   * donde = casilla donde está ahora.
   */
  function pieza(e, marco, colores) {
    const ref = PRIORIDAD.find((c) => colores.includes(c));
    const caras = colores.map((c) => marco[c]);
    const ranuras = colores.length === 3 ? esquinas : aristas;
    // casa: ranura cuyas caras son las de los colores
    let casa = -1;
    for (const r of ranuras) {
      const cs = r.map(caraDe);
      if (caras.every((c) => cs.includes(c))) { casa = r[cs.indexOf(marco[ref])]; break; }
    }
    let donde = -1;
    for (const r of ranuras) {
      const cs = coloresEn(e, r);
      if (colores.every((c) => cs.includes(c))) { donde = r[cs.indexOf(ref)]; break; }
    }
    return { colores, ref, casa, donde };
  }
  /** Pieza bien colocada y orientada (según el marco). */
  const enSuSitio = (e, marco, colores) => { const p = pieza(e, marco, colores); return p.casa === p.donde; };
  /** Casillas de la ranura de una casilla (todas las pegatinas de esa pieza). */
  const pegatinasDe = (f) => ranuraDe[f].slice();

  // ---------- Tablas de distancias (1, 2 o 3 piezas) ----------
  const cacheTablas = new Map();
  function tabla(movs, casas) {
    const clave = movs.join(' ') + '|' + casas.join(',');
    let t = cacheTablas.get(clave);
    if (t) return t;
    const k = casas.length;
    const tam = total ** k;
    t = new Int8Array(tam).fill(-1);
    const ds = movs.map(destino);
    const cod = (v) => v.reduce((a, x) => a * total + x, 0);
    let frontera = [cod(casas)];
    t[frontera[0]] = 0;
    for (let d = 0; frontera.length; d++) {
      const sig = [];
      for (const c of frontera) {
        const v = []; let x = c;
        for (let i = 0; i < k; i++) { v.unshift(x % total); x = Math.floor(x / total); }
        for (const dm of ds) {
          let y = 0;
          for (let i = 0; i < k; i++) y = y * total + dm[v[i]];
          if (t[y] < 0) { t[y] = d + 1; sig.push(y); }
        }
      }
      frontera = sig;
    }
    cacheTablas.set(clave, t);
    return t;
  }

  /**
   * IDA*: secuencia de `movs` que lleva cada pieza (casilla actual `desde[i]`)
   * a `hasta[i]`. `grupos`: listas de índices de piezas con tabla conjunta
   * (1–3 piezas). Devuelve la lista de movimientos o null si pasa de maxProf o
   * de maxNodos.
   */
  function buscar(desde, hasta, movs, { grupos = null, maxProf = 14, maxNodos = 3e6 } = {}) {
    const k = desde.length;
    if (!grupos) grupos = desde.map((_, i) => [i]);
    const ts = grupos.map((g) => tabla(movs, g.map((i) => hasta[i])));
    const ds = movs.map(destino);
    const ejes = movs.map((m) => 'UDRLFB'.indexOf(m[0]) >> 1);
    const caraM = movs.map((m) => m[0]);
    const h = (v) => {
      let mx = 0;
      for (let g = 0; g < grupos.length; g++) {
        let c = 0;
        for (const i of grupos[g]) c = c * total + v[i];
        const d = ts[g][c];
        if (d < 0) return 99;
        if (d > mx) mx = d;
      }
      return mx;
    };
    const v = desde.slice();
    const h0 = h(v);
    if (h0 >= 99) return null;
    if (h0 === 0) return [];
    const camino = [];
    let nodos = 0;
    const ORDEN = { U: 0, D: 1, R: 0, L: 1, F: 0, B: 1 };
    function dfs(prof, limite, ult) {
      const hv = h(v);
      if (hv === 0) return true;
      if (prof + hv > limite) return false;
      if (++nodos > maxNodos) throw new Error('límite');
      for (let m = 0; m < movs.length; m++) {
        if (ult >= 0) {
          if (caraM[m] === caraM[ult]) continue;
          // caras opuestas: solo en un orden
          if (ejes[m] === ejes[ult] && ORDEN[caraM[m]] === 0) continue;
        }
        const guardado = v.slice();
        for (let i = 0; i < k; i++) v[i] = ds[m][v[i]];
        camino.push(movs[m]);
        if (dfs(prof + 1, limite, m)) return true;
        camino.pop();
        for (let i = 0; i < k; i++) v[i] = guardado[i];
      }
      return false;
    }
    try {
      for (let limite = h0; limite <= maxProf; limite++) {
        if (dfs(0, limite, -1)) return camino.slice();
      }
    } catch (err) {
      if (err.message !== 'límite') throw err;
    }
    return null;
  }

  /**
   * Busca la secuencia más corta (en movimientos) de "macros" (listas de
   * movimientos con nombre: algoritmos y ajustes de una capa) que cumple
   * `objetivo(estado)`, con como mucho maxMacros macros. Búsqueda de coste
   * uniforme (los estados repetidos se descartan). Devuelve [{macro, antes}] o null.
   */
  function buscarMacros(e0, macros, objetivo, maxMacros = 4) {
    if (objetivo(e0)) return [];
    const clave = (e) => e.join('');
    const cubos = []; // cola por coste (cubetas)
    const meter = (n) => { (cubos[n.coste] = cubos[n.coste] || []).push(n); };
    meter({ e: e0, pasos: [], coste: 0 });
    const vistos = new Map([[clave(e0) + '|', 0]]);
    for (let c = 0; c < cubos.length; c++) {
      const cub = cubos[c];
      if (!cub) continue;
      for (let i = 0; i < cub.length; i++) {
        const nodo = cub[i];
        if (objetivo(nodo.e) && nodo.pasos.length) return nodo.pasos;
        if (nodo.pasos.length >= maxMacros) continue;
        const ultimo = nodo.pasos[nodo.pasos.length - 1];
        for (const mac of macros) {
          // dos ajustes seguidos de la misma capa no tienen sentido
          if (mac.ajuste && ultimo && ultimo.macro.ajuste === mac.ajuste) continue;
          const e = aplicarSec(nodo.e, mac.movs);
          const k = clave(e) + '|' + (mac.ajuste || '');
          const coste = nodo.coste + mac.movs.length;
          if (vistos.has(k) && vistos.get(k) <= coste) continue;
          vistos.set(k, coste);
          meter({ e, pasos: nodo.pasos.concat([{ macro: mac, antes: nodo.e }]), coste });
        }
      }
    }
    return null;
  }

  return {
    N, b, total, esquinas, aristas, caraDe, centro, destino, aplicar, aplicarSec,
    marcoCentros, pieza, enSuSitio, pegatinasDe, buscar, buscarMacros, tabla, coloresEn,
  };
}

/** Ajustes de la capa U (como macros) para buscarMacros. */
export const AJUSTES_U = [
  { nombre: 'U', movs: ['U'], ajuste: 'U' },
  { nombre: "U'", movs: ["U'"], ajuste: 'U' },
  { nombre: 'U2', movs: ['U2'], ajuste: 'U' },
];

/** Rotación y^k como lista de movimientos. */
export const rotY = (k) => [[], ['y'], ['y2'], ["y'"]][((k % 4) + 4) % 4];

export const parsear = (s) => s.trim().split(/\s+/).filter(Boolean);
export { CARAS };
