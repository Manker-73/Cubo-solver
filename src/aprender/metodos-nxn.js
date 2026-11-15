// Reducción humana de los cubos grandes (4x4 y 5x5) para el modo aprender:
// centros (blanco, amarillo y los cuatro de los lados), emparejar aristas, y el
// resto como un 3x3 (por capas o CFOP) con las paridades del 4x4 y sus algoritmos.
//
// Los centros y las aristas se hacen de pieza en pieza: en cada paso se busca la
// combinación más corta de "macros" humanas (giros de cara, capas anchas y
// conmutadores como Rw U Rw') que añade una pieza más sin romper lo ya hecho.
// La búsqueda trabaja solo con las pegatinas de los centros (o de las aristas),
// con cada macro convertida en una permutación.

import { baseNxN, esRotacion } from '../puzzles/nxn.js';
import { crearGuion } from './guion.js';
import { etapas3x3, rotacionInicial } from './metodos-3x3.js';
import { motorCubo, parsear, NOMBRE_COLOR, coloresPieza } from './motor-cubo.js';
import { OBJETIVOS_3x3 as OB3 } from './objetivos-cubo.js';

const BLANCO = 0, AMARILLO = 3;
const LETRA = 'URFDLB';
const M3 = motorCubo(3);
const COLOR_F = [['blanca', 'blancas'], ['roja', 'rojas'], ['verde', 'verdes'], ['amarilla', 'amarillas'], ['naranja', 'naranjas'], ['azul', 'azules']];
const NOMBRE_LADO = ['de arriba', 'de la derecha', 'de delante', 'de abajo', 'de la izquierda', 'de detrás'];
// Con el blanco abajo y el amarillo arriba, los lados F R B L en orden: verde, naranja, azul, rojo
const CICLO_LADOS = [2, 4, 5, 1];

const cache = new Map();
export function datosNxN(N) {
  if (cache.has(N)) return cache.get(N);
  const b = baseNxN(N);
  const n2 = N * N;
  const total = 6 * n2;
  const idx = (f, r, c) => f * n2 + r * N + c;
  const interior = (k) => k > 0 && k < N - 1;
  const centros = [], esCentro = new Array(total).fill(false), esArista = new Array(total).fill(false);
  for (let f = 0; f < 6; f++) {
    centros.push([]);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = idx(f, r, c);
      if (interior(r) && interior(c)) { centros[f].push(i); esCentro[i] = true; } else if (interior(r) || interior(c)) esArista[i] = true;
    }
  }
  const mid = Math.floor((N - 1) / 2);
  const a3 = (k) => (k === 0 ? 0 : k === 2 ? N - 1 : mid);
  /** Pegatinas del NxN que corresponden a la pegatina f3 del 3x3 virtual. */
  const deVirtual = (f3) => {
    const f = Math.floor(f3 / 9), r = Math.floor((f3 % 9) / 3), c = f3 % 3;
    const rs = r === 1 ? [...Array(N - 2).keys()].map((k) => k + 1) : [a3(r)];
    const cs = c === 1 ? [...Array(N - 2).keys()].map((k) => k + 1) : [a3(c)];
    return rs.flatMap((R) => cs.map((C) => idx(f, R, C)));
  };
  /** 3x3 virtual de un cubo reducido: esquinas, una pegatina de cada arista y el centro. */
  const virtual = (e) => {
    const v = new Array(54);
    for (let f3 = 0; f3 < 54; f3++) {
      const f = Math.floor(f3 / 9), r = Math.floor((f3 % 9) / 3), c = f3 % 3;
      v[f3] = e[idx(f, a3(r), a3(c))];
    }
    return v;
  };
  // aristas: por cada arista del 3x3, las pegatinas de cada lado (en orden a lo largo de la arista)
  const aristas = M3.aristas.map(([p, q]) => [deVirtual(p), deVirtual(q)]);
  const d = { N, b, n2, total, idx, centros, esCentro, esArista, deVirtual, virtual, aristas, mid };
  cache.set(N, d);
  return d;
}

/** Movimiento de una macro del 3x3 al NxN (las capas anchas del 3x3 son todas menos la cara opuesta). */
function mov3aN(m, N) {
  const x = /^([URFDLB])w(.*)$/.exec(m);
  return x ? `${N - 1}${x[1]}w${x[2]}` : m;
}

// ---------- Búsqueda de macros sobre una proyección (solo unas pegatinas) ----------
function crearProyeccion(d, esta) {
  const pos = [];
  for (let i = 0; i < d.total; i++) if (esta[i]) pos.push(i);
  const enProy = new Int16Array(d.total).fill(-1);
  pos.forEach((i, j) => { enProy[i] = j; });
  const id = [...Array(d.total).keys()];
  const permDe = (movs) => {
    const x = movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
    return Int16Array.from(pos, (i) => enProy[x[i]]);
  };
  return { pos, permDe, proyectar: (e) => pos.map((i) => e[i]) };
}

/**
 * Coste uniforme: la combinación de macros más barata (en movimientos) desde v0
 * (proyección) que cumple objetivo(v). Devuelve la lista de macros o null.
 */
function buscarMacrosProy(v0, macros, objetivo, maxMacros, maxNodos = 4e5) {
  const n = v0.length;
  const cubos = [];
  const meter = (x) => { (cubos[x.coste] = cubos[x.coste] || []).push(x); };
  const inicio = { v: Uint8Array.from(v0), padre: null, mac: null, coste: 0, prof: 0 };
  meter(inicio);
  const clave = (v) => String.fromCharCode.apply(null, v);
  const vistos = new Set([clave(inicio.v)]);
  let nodos = 0;
  const camino = (x) => { const r = []; for (; x.padre; x = x.padre) r.push(x.mac); return r.reverse(); };
  for (let c = 0; c < cubos.length; c++) {
    const cub = cubos[c];
    if (!cub) continue;
    for (let i = 0; i < cub.length; i++) {
      const nodo = cub[i];
      if (nodo.prof && objetivo(nodo.v)) return camino(nodo);
      if (nodo.prof >= maxMacros || ++nodos > maxNodos) continue;
      for (const mac of macros) {
        if (nodo.mac && mac.cara && nodo.mac.cara === mac.cara) continue; // dos giros de la misma cara seguidos
        const v = new Uint8Array(n);
        const p = mac.perm;
        for (let k = 0; k < n; k++) v[k] = nodo.v[p[k]];
        const k = clave(v);
        if (vistos.has(k)) continue;
        vistos.add(k);
        meter({ v, padre: nodo, mac, coste: nodo.coste + mac.movs.length, prof: nodo.prof + 1 });
      }
    }
  }
  return null;
}

const SUF = ['', "'", '2'];
const inv = (m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'");

// ---------- Centros ----------
function macrosCentros(d, proy, { libres }) {
  const N = d.N;
  const lista = [];
  const add = (movs, tipo, cara = null) => lista.push({ movs, perm: proy.permDe(movs), tipo, cara });
  for (const c of LETRA) for (const s of SUF) add([c + s], 'cara', c);
  for (const c of ['Uw', 'Dw']) for (const s of SUF) add([c + s], 'ancha', c);
  const capas = ['Rw', 'Lw', 'Fw', 'Bw'].concat(N >= 5 ? ['3Rw', '3Fw'] : []);
  if (libres) for (const c of capas) for (const s of SUF) add([c + s], 'ancha', c);
  // conmutadores: sube (o baja) una columna, gira U (o D) y la devuelve
  for (const c of capas) for (const t of ['U', 'D']) for (const s of SUF) {
    add([c, t + s, inv(c)], 'conmutador');
    add([inv(c), t + s, c], 'conmutador');
  }
  return lista;
}

function etapaCentros(g, d, nombre, objetivo, caras, hechas, macros, proy) {
  g.etapa(nombre, objetivo, 'centros');
  const { centros } = d;
  const caraDePos = new Map();
  for (const f of [...caras, ...hechas].map((x) => x.f)) for (const i of centros[f]) caraDePos.set(proy.pos.indexOf(i), f);
  const color = new Map([...caras, ...hechas].map((x) => [x.f, x.c]));
  const bienEn = (v, f) => centros[f].reduce((a, i) => a + (v[proy.pos.indexOf(i)] === color.get(f) ? 1 : 0), 0);
  const posDe = centros.map((l) => l.map((i) => proy.pos.indexOf(i)));
  const cuenta = (v, fs) => fs.reduce((a, { f }) => a + posDe[f].reduce((s, j) => s + (v[j] === color.get(f) ? 1 : 0), 0), 0);
  const completas = (v, fs) => fs.every(({ f }) => posDe[f].every((j) => v[j] === color.get(f)));
  const totalObj = caras.length * centros[0].length;
  for (let vueltas = 0; vueltas < 80; vueltas++) {
    const v = proy.proyectar(g.estado);
    const n0 = cuenta(v, caras);
    if (n0 === totalObj) break;
    const pasos = buscarMacrosProy(v, macros, (w) => completas(w, hechas) && cuenta(w, caras) > n0, 3);
    g.comprobar(!!pasos, `${nombre}: no se encontró cómo añadir otra pieza`);
    const movs = pasos.flatMap((p) => p.movs);
    // piezas que acaban bien colocadas en este paso (dónde estaban al empezar)
    const id = [...Array(d.total).keys()];
    const tras = movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
    const eFin = movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), g.estado);
    const nuevas = [];
    let caraGana = null;
    for (const { f } of caras) {
      for (const i of centros[f]) {
        if (eFin[i] === color.get(f) && g.estado[i] !== color.get(f)) { nuevas.push(tras[i]); if (caraGana == null) caraGana = f; }
      }
    }
    const wFin = proy.proyectar(eFin);
    const n1 = cuenta(wFin, caras);
    const cara = caraGana != null ? caraGana : caras[0].f;
    const k = bienEn(wFin, cara);
    const usa = pasos.filter((p) => p.tipo === 'conmutador').map((p) => p.movs.join(' '));
    const ganadas = n1 - n0;
    const col = COLOR_F[color.get(cara)][ganadas > 1 ? 1 : 0];
    const texto = `${ganadas > 1 ? `Añade ${ganadas} piezas ${col}` : `Añade otra pieza ${col}`} al centro ${NOMBRE_LADO[cara]} (${k}/${centros[cara].length})`
      + (usa.length ? ` con ${usa.length > 1 ? 'los conmutadores' : 'el conmutador'} ${usa.join(' y ')}: ${ganadas > 1 ? 'las mete' : 'la mete'} sin deshacer lo que ya estaba hecho.` : '.');
    g.bloque(movs, texto, { algoritmo: usa.length ? 'Conmutador' : null, piezas: nuevas });
  }
  g.comprobar(completas(proy.proyectar(g.estado), [...hechas, ...caras]), nombre);
}

function centros(g, d) {
  const N = d.N;
  const proy = crearProyeccion(d, d.esCentro);
  const libres = macrosCentros(d, proy, { libres: true });
  const fijas = macrosCentros(d, proy, { libres: false });
  const { centros: C } = d;
  // 1. centro blanco: girar el cubo para tener abajo la cara con más blanco (en el 5x5, la del centro blanco)
  const blancos = (e, f) => C[f].filter((i) => e[i] === BLANCO).length;
  let rot = [];
  if (N % 2 === 1) {
    rot = { 0: ['z2'], 1: ['z'], 2: ["x'"], 3: [], 4: ["z'"], 5: ['x'] }[[0, 1, 2, 3, 4, 5].find((f) => g.estado[d.idx(f, d.mid, d.mid)] === BLANCO)];
  } else {
    let mejor = -1;
    for (const r of [[], ['z2'], ['z'], ["z'"], ['x'], ["x'"]]) {
      const n = blancos(r.reduce((e, m) => d.b.aplicarMovimiento(e, m), g.estado), 3);
      if (n > mejor) { mejor = n; rot = r; }
    }
  }
  g.etapa('Preparación', N % 2 ? 'Sujetar el cubo con el centro blanco abajo (en el 5x5 la pieza del medio de cada centro no se mueve: marca el color de esa cara).' : 'Sujetar el cubo con abajo la cara que ya tiene más piezas blancas en el centro: ahí se hará el centro blanco.', 'prep');
  g.bloque(rot, `Gira el cubo entero (${rot.join(' ')}) para trabajar el centro blanco abajo.`);
  etapaCentros(g, d, 'Centro blanco', `Juntar abajo las ${C[3].length} piezas blancas del centro${N % 2 ? ' alrededor de la del medio' : ''}. Al principio vale casi cualquier movimiento: aún no hay nada que respetar.`, [{ f: 3, c: BLANCO }], [], libres, proy);
  etapaCentros(g, d, 'Centro amarillo', 'Juntar arriba las piezas amarillas sin romper el centro blanco: se suben desde los lados con conmutadores como Rw U Rw\' (la columna sube, U la aparta, y la columna vuelve a bajar).', [{ f: 0, c: AMARILLO }], [{ f: 3, c: BLANCO }], fijas, proy);
  // 3. los cuatro de los lados: en el 4x4, el orden de colores que más piezas tiene ya bien
  let lados;
  if (N % 2 === 1) lados = [2, 1, 5, 4].map((f) => ({ f, c: g.estado[d.idx(f, d.mid, d.mid)] }));
  else {
    let mejor = null;
    for (let k = 0; k < 4; k++) {
      const asign = [2, 1, 5, 4].map((f, j) => ({ f, c: CICLO_LADOS[(j + k) % 4] }));
      const n = asign.reduce((a, { f, c }) => a + C[f].filter((i) => g.estado[i] === c).length, 0);
      if (!mejor || n > mejor.n) mejor = { n, asign };
    }
    lados = mejor.asign;
  }
  const orden = lados.map((x) => NOMBRE_COLOR[x.c]).join(', ');
  if (N === 4) { ultimosCuatro4(g, d, lados, orden); return; }
  etapaCentros(g, d, 'Últimos cuatro centros', `Completar los centros de los lados sin romper el blanco ni el amarillo. ${N % 2 ? 'Cada uno va donde marca su pieza del medio' : `Van en este orden (delante, derecha, detrás, izquierda): ${orden}, el que corresponde a los colores de las esquinas`}.`, lados, [{ f: 3, c: BLANCO }, { f: 0, c: AMARILLO }], fijas, proy);
}

/**
 * Últimos cuatro centros del 4x4, en dos pasos con giros que no tocan los centros
 * de arriba ni de abajo (F, R, B, L, Uw, Dw): separar los colores por parejas de
 * caras opuestas, y después cada color a su cara. Tablas exactas (2^16 estados).
 */
const tablasL4C = new Map();
function ultimosCuatro4(g, d, lados, orden) {
  const [Fc, Rc, Bc, Lc] = lados.map((x) => x.c);
  const caras = [2, 1, 5, 4]; // F R B L
  const pos = caras.flatMap((f) => d.centros[f]); // 16 pegatinas: 4 por cara, en ese orden
  const proy = crearProyeccion(d, (() => { const m = new Array(d.total).fill(false); pos.forEach((i) => { m[i] = true; }); return m; })());
  const orden16 = pos.map((i) => proy.pos.indexOf(i));
  const movsA = [], movsB = [];
  for (const c of ['F', 'R', 'B', 'L', 'Uw', 'Dw']) for (const s of SUF) movsA.push(c + s);
  for (const c of ['F', 'R', 'B', 'L']) for (const s of SUF) movsB.push(c + s);
  movsB.push('Uw2', 'Dw2');
  const tabla = (movs, objetivo) => {
    const clave = movs.join(' ') + objetivo;
    if (tablasL4C.has(clave)) return tablasL4C.get(clave);
    const perms = movs.map((m) => { const pm = proy.permDe([m]); return orden16.map((j) => orden16.indexOf(pm[j])); });
    const dist = new Int8Array(1 << 16).fill(-1);
    dist[objetivo] = 0;
    let fr = [objetivo];
    for (let k = 0; fr.length; k++) {
      const sig = [];
      for (const x of fr) for (const p of perms) {
        let y = 0;
        for (let j = 0; j < 16; j++) if (x & (1 << p[j])) y |= 1 << j;
        if (dist[y] < 0) { dist[y] = k + 1; sig.push(y); }
      }
      fr = sig;
    }
    const t = { dist, perms };
    tablasL4C.set(clave, t);
    return t;
  };
  const resolverTabla = (t, x, movs) => {
    const sol = [];
    while (t.dist[x] > 0) {
      const k = t.perms.findIndex((p) => { let y = 0; for (let j = 0; j < 16; j++) if (x & (1 << p[j])) y |= 1 << j; return t.dist[y] === t.dist[x] - 1; });
      const p = t.perms[k];
      let y = 0; for (let j = 0; j < 16; j++) if (x & (1 << p[j])) y |= 1 << j;
      x = y; sol.push(movs[k]);
    }
    return sol;
  };
  const bits = (e, f) => pos.reduce((a, i, j) => a | (f(e[i], Math.floor(j / 4)) ? 1 << j : 0), 0);
  g.etapa('Últimos cuatro centros', `Completar los centros de los lados sin romper el blanco ni el amarillo: solo con giros de las caras de los lados y de las capas anchas Uw y Dw, que no tocan los centros de arriba y abajo. Van en este orden (delante, derecha, detrás, izquierda): ${orden}, el que corresponde a los colores de las esquinas.`, 'centros');
  // paso 1: colores de delante/detrás en F y B (bits a 1 en F y B)


  const objA = (1 << 0 | 1 << 1 | 1 << 2 | 1 << 3) | (1 << 8 | 1 << 9 | 1 << 10 | 1 << 11);
  const TA = tabla(movsA, objA);
  const xA = bits(g.estado, (c) => c === Fc || c === Bc);
  const solA = resolverTabla(TA, xA, movsA);
  const id = [...Array(d.total).keys()];
  const piezasDe = (cols) => pos.filter((i) => cols.includes(g.estado[i]));
  g.bloque(solA, `Separa los colores: las piezas ${COLOR_F[Fc][1]} y ${COLOR_F[Bc][1]} a delante y detrás, y las ${COLOR_F[Rc][1]} y ${COLOR_F[Lc][1]} a los lados (con Uw y Dw las filas pasan de una cara a otra, y girando una cara sus piezas cambian de fila).`, { piezas: piezasDe([Fc, Bc]) });
  // paso 2: cada color a su cara, sin deshacer la separación (F, R, B, L, Uw2, Dw2)
  const objB = (0b1111) | (0b1111 << 4);
  const TB = tabla(movsB, objB);
  const xB = bits(g.estado, (c, k) => (k === 0 || k === 2 ? c === Fc : c === Rc));
  const solB = resolverTabla(TB, xB, movsB);
  g.bloque(solB, `Cada color a su cara: ${COLOR_F[Fc][1]} delante, ${COLOR_F[Rc][1]} a la derecha, ${COLOR_F[Bc][1]} detrás y ${COLOR_F[Lc][1]} a la izquierda (con Uw2 y Dw2 se cambian filas entre caras opuestas sin deshacer el paso anterior).`, { piezas: pos.slice() });
  void id;
  const e = g.estado;
  g.comprobar(lados.every(({ f, c }) => d.centros[f].every((i) => e[i] === c)) && d.centros[0].every((i) => e[i] === AMARILLO) && d.centros[3].every((i) => e[i] === BLANCO), 'últimos cuatro centros');
}

// ---------- Aristas ----------
const ALG_EMPAREJAR = [
  { nombre: 'Emparejar', alg: "Uw' R U R' F R' F' R Uw" },
  { nombre: 'Emparejar', alg: "Uw R U R' F R' F' R Uw'" },
  { nombre: 'Emparejar', alg: "Dw R U R' F R' F' R Dw'" },
  { nombre: 'Emparejar', alg: "Dw' R U R' F R' F' R Dw" },
  { nombre: 'Emparejar dos', alg: "Dw R F' U R' F Dw'" },
  { nombre: 'Emparejar dos', alg: "Dw' R F' U R' F Dw" },
  { nombre: 'Emparejar dos', alg: "Uw R F' U R' F Uw'" },
  { nombre: 'Emparejar dos', alg: "Uw' R F' U R' F Uw" },
];
// 5x5: paridad de las aristas (dos piezas de una arista al revés)
const ALG_PARIDAD_ARISTA_5 = { nombre: 'Paridad de aristas', alg: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'" };

function aristas(g, d) {
  const N = d.N;
  const proy = crearProyeccion(d, d.esArista);
  const P = (i) => proy.pos.indexOf(i);
  const ar = d.aristas.map(([a, b]) => [a.map(P), b.map(P)]);
  // cuenta de pegatinas de arista que coinciden con su vecina (la del medio en el 5x5)
  const ref = (k) => (N % 2 ? d.mid - 1 : 0); void ref;
  const pares = (v) => {
    let n = 0;
    for (const [a, b] of ar) {
      for (let k = 0; k + 1 < a.length; k++) if (v[a[k]] === v[a[k + 1]] && v[b[k]] === v[b[k + 1]]) n++;
    }
    return n;
  };
  const maxPares = 12 * (N - 3);
  /** Aristas (por sus colores) con todas sus piezas juntas. */
  const completasEn = (v) => {
    const r = [];
    for (const [a, b] of ar) {
      if (a.every((j) => v[j] === v[a[0]]) && b.every((j) => v[j] === v[b[0]])) r.push(v[a[0]] < v[b[0]] ? v[a[0]] * 8 + v[b[0]] : v[b[0]] * 8 + v[a[0]]);
    }
    return r;
  };
  const contiene = (x, y) => y.every((k) => x.includes(k));
  const macros = [];
  for (const c of LETRA) for (const s of SUF) macros.push({ movs: [c + s], perm: proy.permDe([c + s]), cara: c, tipo: 'cara' });
  const algs = ALG_EMPAREJAR.concat(N % 2 ? [ALG_PARIDAD_ARISTA_5] : []);
  // solo los que no mueven los centros (se comprueba aquí)
  const centrosBien = (movs) => { const e = movs.reduce((x, m) => d.b.aplicarMovimiento(x, m), d.b.estadoResuelto()); return d.centros.every((l, f) => l.every((i) => e[i] === f)); };
  for (const a of algs) {
    const movs = parsear(a.alg);
    if (centrosBien(movs)) macros.push({ movs, perm: proy.permDe(movs), tipo: 'alg', nombre: a.nombre });
  }
  g.etapa('Aristas', N % 2
    ? 'Juntar las tres piezas de cada arista (las dos de los lados con la del medio) sin romper los centros: se colocan las piezas a juego a izquierda y derecha delante, se baja una capa (Dw), se cambia la arista con R U R\' F R\' F\' R y se sube.'
    : 'Emparejar las dos mitades de cada arista sin romper los centros: se ponen las dos mitades a juego a izquierda y derecha delante, se baja una capa (Dw o Uw), se cambia la arista ya hecha por otra con R U R\' F R\' F\' R y se vuelve a subir.', 'aristas');
  const nombreArista = (e, k) => coloresPieza([e[d.aristas[k][0][0]], e[d.aristas[k][1][0]]].sort((x, y) => x - y));
  for (let vueltas = 0; vueltas < 60; vueltas++) {
    const v = proy.proyectar(g.estado);
    const n0 = pares(v);
    if (n0 === maxPares) break;
    // como haría una persona: las aristas ya completas no se rompen
    const hechas = completasEn(v);
    const pasos = buscarMacrosProy(v, macros, (w) => pares(w) > n0 && contiene(completasEn(w), hechas), 4, 6e5)
      || buscarMacrosProy(v, macros, (w) => pares(w) > n0, 4, 6e5);
    g.comprobar(!!pasos, 'aristas: no se encontró cómo emparejar otra');
    const movs = pasos.flatMap((p) => p.movs);
    const id = [...Array(d.total).keys()];
    const tras = movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
    const eFin = movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), g.estado);
    // aristas que quedan emparejadas en este paso
    const completa = (e, k) => { const [a, b] = d.aristas[k]; return a.every((i) => e[i] === e[a[0]]) && b.every((i) => e[i] === e[b[0]]); };
    const claveDe = (e, k) => { const x = e[d.aristas[k][0][0]], y = e[d.aristas[k][1][0]]; return Math.min(x, y) * 8 + Math.max(x, y); };
    const antes = new Set(d.aristas.map((_, k) => k).filter((k) => completa(g.estado, k)).map((k) => claveDe(g.estado, k)));
    const nuevas = d.aristas.map((_, k) => k).filter((k) => completa(eFin, k) && !antes.has(claveDe(eFin, k)));
    const alg = pasos.find((p) => p.tipo === 'alg');
    const nombres = nuevas.map((k) => nombreArista(eFin, k).replace(' y ', '-'));
    const lista = nombres.length > 1 ? `las aristas ${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : `la arista ${nombres[0]}`;
    const texto = (nuevas.length ? `Completa ${lista}` : 'Junta dos piezas más de una arista')
      + (alg ? `: coloca las piezas a juego y haz ${alg.movs.join(' ')}.` : '.');
    const piezas = (nuevas.length ? nuevas : []).flatMap((k) => d.aristas[k].flat()).map((i) => tras[i]);
    g.bloque(movs, texto, { algoritmo: alg ? alg.nombre : null, piezas });
  }
  g.comprobar(pares(proy.proyectar(g.estado)) === maxPares, 'aristas');
}

// ---------- 3x3 con paridades ----------
/** Paridades del 3x3 virtual: { orientacion: aristas volteadas impares, permutacion: esquinas y aristas con distinta paridad }. */
export function paridades3(v) {
  const marco = M3.marcoCentros(v);
  const caraDe = (f) => Math.floor(f / 9);
  let flips = 0;
  const permA = M3.aristas.map(([a, b]) => {
    const cs = [v[a], v[b]];
    const prim = cs.find((c) => marco[c] === 0 || marco[c] === 3) ?? cs.find((c) => marco[c] === 2 || marco[c] === 5);
    if (v[a] !== prim) flips++;
    return M3.aristas.findIndex(([p, q]) => [caraDe(p), caraDe(q)].every((f) => cs.some((c) => marco[c] === f)));
  });
  const permE = M3.esquinas.map((r) => {
    const cs = r.map((f) => v[f]);
    return M3.esquinas.findIndex((q) => q.every((f) => cs.some((c) => marco[c] === caraDe(f))));
  });
  const par = (p) => { let s = 0; const vis = new Array(p.length).fill(false); for (let i = 0; i < p.length; i++) { if (vis[i]) continue; let l = 0; for (let j = i; !vis[j]; j = p[j]) { vis[j] = true; l++; } s += l - 1; } return s % 2; };
  return { orientacion: flips % 2 === 1, permutacion: par(permA) !== par(permE) };
}

const PARIDAD_OLL = "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'";
// r2 U2 r2 Uw2 r2 Uw2 con r = la capa interior (en notación WCA, Rw2 R2)
const PARIDAD_PLL = "Rw2 R2 U2 Rw2 R2 Uw2 Rw2 R2 Uw2";

function proxy3(g, d) {
  return {
    get estado() { return d.virtual(g.estado); },
    etapa: (...a) => g.etapa(...a),
    comprobar: (...a) => g.comprobar(...a),
    bloque(movs, texto, op = {}) {
      g.bloque(movs.map((m) => mov3aN(m, d.N)), texto, { ...op, piezas: (op.piezas || []).flatMap((f) => d.deVirtual(f)) });
    },
  };
}

export const METODOS_NxN = [
  { id: 'principiantes', nombre: 'Reducción (3x3 por capas)', descripcion: 'Reducción: centros (blanco, amarillo y los cuatro de los lados), emparejar aristas, y después como un 3x3 por capas, con las paridades del cubo grande.' },
  { id: 'cfop', nombre: 'Reducción (3x3 con CFOP)', descripcion: 'Reducción: centros, emparejar aristas, y después como un 3x3 con CFOP (cruz, F2L, OLL y PLL), con las paridades del cubo grande.' },
];

export function aprenderReduccion(N, estado, metodo = 'principiantes') {
  const t0 = Date.now();
  const d = datosNxN(N);
  const g = crearGuion(d.b.aplicarMovimiento, estado, { esRotacion });
  centros(g, d);
  aristas(g, d);
  const g3 = proxy3(g, d);
  rotacionInicial(g3);
  const ganchos = N % 2 ? {} : {
    trasDosCapas() {
      if (!paridades3(g3.estado).orientacion) return;
      g.etapa('Paridad OLL', 'En el 4x4 puede quedar un número impar de aristas volteadas, algo imposible en un 3x3. Se arregla volteando una arista entera con su algoritmo (no rompe las dos primeras capas ni los centros).', 'paridad');
      g.bloque(parsear(PARIDAD_OLL), 'Paridad OLL: el algoritmo voltea la arista de arriba delante (y mueve otras piezas de la capa de arriba, que todavía no está hecha); después se orienta la última capa como en un 3x3.', { algoritmo: 'Paridad OLL', piezas: d.aristas[1].flat() });
      g.comprobar(OB3.dosCapas(g3.estado) && !paridades3(g3.estado).orientacion, 'paridad OLL');
    },
    trasOrientar() {
      if (!paridades3(g3.estado).permutacion) return;
      g.etapa('Paridad PLL', 'En el 4x4 pueden quedar dos aristas intercambiadas solas, algo imposible en un 3x3. Se arregla intercambiando dos aristas enteras con su algoritmo y después se sigue con la última capa.', 'paridad');
      g.bloque(parsear(PARIDAD_PLL), 'Paridad PLL: intercambia dos aristas enteras de la capa de arriba (y mueve algunas esquinas de esa capa); después la PLL coloca todo como en un 3x3.', { algoritmo: 'Paridad PLL', piezas: [...d.aristas[0].flat(), ...d.aristas[2].flat()] });
      g.comprobar(OB3.caraAmarilla(g3.estado) && !paridades3(g3.estado).permutacion, 'paridad PLL');
    },
  };
  etapas3x3(g3, metodo === 'cfop' ? 'cfop' : 'principiantes', ganchos);
  const r = g.resultado(metodo);
  r.ms = Date.now() - t0;
  return r;
}
