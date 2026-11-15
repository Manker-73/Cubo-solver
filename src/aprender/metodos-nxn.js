// Reducción humana de los cubos grandes (4x4 y 5x5) para el modo aprender:
// centros (blanco, amarillo y los cuatro de los lados), emparejar aristas, y el
// resto como un 3x3 (por capas o CFOP) con las paridades del 4x4 y sus algoritmos.
//
// Los centros y las aristas se hacen de pieza en pieza: en cada paso se busca la
// combinación más corta de "macros" humanas (giros de cara, capas anchas y
// conmutadores como Rw U Rw') que añade una pieza más sin romper lo ya hecho.
// La búsqueda trabaja solo con las pegatinas de los centros (o de las aristas),
// con cada macro convertida en una permutación.

import { baseNxN, esRotacion, geometriaNxN } from '../puzzles/nxn.js';
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
  // aristas: por cada arista del 3x3, las pegatinas de cada lado, en el mismo orden a lo largo
  // de la arista (a[j] y b[j] son de la misma pieza; en el 5x5 importa: tres piezas)
  const geo = geometriaNxN(N);
  const cubie = (i) => geo.pos[i].map((x) => (Math.abs(x) === N ? Math.sign(x) * (N - 1) : x)).join(',');
  const aristas = M3.aristas.map(([p, q]) => {
    const a = deVirtual(p), b0 = deVirtual(q);
    const b = a.map((i) => b0.find((j) => cubie(j) === cubie(i)));
    return [a, b];
  });
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
function buscarMacrosProy(v0, macros, objetivo, maxMacros, maxNodos = 4e5, maxGenerados = Infinity) {
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
        if (vistos.size >= maxGenerados) break;
        vistos.add(k);
        meter({ v, padre: nodo, mac, coste: nodo.coste + (mac.coste ?? mac.movs.length), prof: nodo.prof + 1 });
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

function etapaCentros(g, d, nombre, objetivo, caras, hechas, macros, proy, { sub = null, deQue = 'al centro', maxMacros = 3, nueva = true } = {}) {
  if (nueva) g.etapa(nombre, objetivo, 'centros');
  const lim = d.N === 5 ? [4e5, 1.5e6] : [4e5, Infinity];
  // sub: las pegatinas de cada cara que cuentan en esta etapa (5x5: solo la X o solo la cruz);
  // las caras ya hechas (hechas) se comprueban enteras
  const centros = sub || d.centros;
  const enteros = d.centros;
  const color = new Map([...hechas, ...caras].map((x) => [x.f, x.c]));
  const bienEn = (v, f) => centros[f].reduce((a, i) => a + (v[proy.pos.indexOf(i)] === color.get(f) ? 1 : 0), 0);
  const posDe = centros.map((l) => l.map((i) => proy.pos.indexOf(i)));
  const posEnteros = enteros.map((l) => l.map((i) => proy.pos.indexOf(i)));
  const cuenta = (v, fs) => fs.reduce((a, { f }) => a + posDe[f].reduce((s, j) => s + (v[j] === color.get(f) ? 1 : 0), 0), 0);
  // hechas: lista de { f, c, sub? } (sub = solo esas pegatinas de la cara)
  const posHecha = (x) => (x.sub ? x.sub[x.f] : enteros[x.f]).map((i) => proy.pos.indexOf(i));
  const completas = (v, fs) => fs.every((x) => posHecha(x).every((j) => v[j] === x.c));
  const completasSub = (v, fs) => fs.every(({ f }) => posDe[f].every((j) => v[j] === color.get(f)));
  void posEnteros;
  const totalObj = caras.length * centros[0].length;
  // 5x5: primero solo con las macros que no sacan ninguna pieza de lo ya hecho (girarlo dentro de su
  // cara vale: es de un color); si así no sale, con todas
  let preferidas = macros;
  if (d.N === 5 && hechas.length) {
    const id = [...Array(d.total).keys()];
    const fijas = hechas.flatMap((x) => (x.sub ? x.sub[x.f] : enteros[x.f]).map((i) => [i, x.f]));
    preferidas = macros.filter((mac) => {
      const t = mac.movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
      return fijas.every(([i, f]) => Math.floor(t[i] / d.n2) === f && (!hechas.some((x) => x.sub && x.f === f) || fijas.some(([j]) => j === t[i])));
    });
  }
  for (let vueltas = 0; vueltas < 80; vueltas++) {
    const v = proy.proyectar(g.estado);
    const n0 = cuenta(v, caras);
    if (n0 === totalObj) break;
    const pasos = (preferidas !== macros ? buscarMacrosProy(v, preferidas, (w) => completas(w, hechas) && cuenta(w, caras) > n0, maxMacros, 4e5, lim[1]) : null)
      || buscarMacrosProy(v, macros, (w) => completas(w, hechas) && cuenta(w, caras) > n0, maxMacros, 4e5, lim[1])
      || (d.N === 5 ? buscarMacrosProy(v, macros, (w) => completas(w, hechas) && cuenta(w, caras) > n0, maxMacros + 1, 4e5, 2 * lim[1]) : null);
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
    const texto = `${ganadas > 1 ? `Añade ${ganadas} piezas ${col}` : `Añade otra pieza ${col}`} ${deQue} ${NOMBRE_LADO[cara]} (${k}/${centros[cara].length})`
      + (usa.length ? ` con ${usa.length > 1 ? 'los conmutadores' : 'el conmutador'} ${usa.join(' y ')}: ${ganadas > 1 ? 'las mete' : 'la mete'} sin deshacer lo que ya estaba hecho.` : '.');
    g.bloque(movs, texto, { algoritmo: usa.length ? 'Conmutador' : null, piezas: nuevas });
  }
  g.comprobar(completas(proy.proyectar(g.estado), hechas) && completasSub(proy.proyectar(g.estado), caras), nombre);
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
  if (N === 5) {
    g.etapa('Preparación', 'Sujetar el cubo con el centro blanco abajo. En el 5x5 la pieza del medio de cada centro no se mueve (con los giros que se usan aquí): marca el color de esa cara.', 'prep');
    g.bloque(rot, `Gira el cubo entero (${rot.join(' ')}) para tener el centro blanco abajo.`);
    centros5(g, d, proy);
    return;
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
// ---------- Centros del 5x5: la X y la cruz por separado ----------
// En el 5x5 cada centro tiene 4 piezas en X (las esquinas del centro), 4 en cruz (las
// de los lados) y la del medio, fija. Las piezas en X se mueven con las capas anchas de
// dos capas (Rw, Uw…), como los centros del 4x4; las de la cruz, además, con la capa
// del medio. Se hace cada centro en dos partes: primero su X y después su cruz.
const cacheSub5 = new Map();
function subCentros5(d) {
  if (cacheSub5.has(d.N)) return cacheSub5.get(d.N);
  const X = [], C = [];
  for (let f = 0; f < 6; f++) {
    X.push([d.idx(f, 1, 1), d.idx(f, 1, 3), d.idx(f, 3, 1), d.idx(f, 3, 3)]);
    C.push([d.idx(f, 1, 2), d.idx(f, 2, 1), d.idx(f, 2, 3), d.idx(f, 3, 2)]);
  }
  const r = { X, C };
  cacheSub5.set(d.N, r);
  return r;
}
// capas del medio (sin mover la pieza fija, se usan siempre en conmutadores que la devuelven)
const MEDIO = { M: ['3Rw', "Rw'"], Mi: ['Rw', "3Rw'"], S: ['3Fw', "Fw'"], Si: ['Fw', "3Fw'"], E: ['3Uw', "Uw'"], Ei: ['Uw', "3Uw'"] };
const invSec = (sec) => sec.slice().reverse().map(inv);

function macros5(d, proy, tipo) {
  const lista = [];
  const add = (movs, t, cara = null) => lista.push({ movs, perm: proy.permDe(movs), tipo: t, cara });
  for (const c of LETRA) for (const s of SUF) add([c + s], 'cara', c);
  const anchas = ['Rw', 'Lw', 'Fw', 'Bw'];
  if (tipo === 'libre') for (const c of anchas.concat(['Uw', 'Dw'])) for (const s of SUF) add([c + s], 'ancha', c);
  else for (const c of ['Uw', 'Dw']) for (const s of SUF) add([c + s], 'ancha', c);
  // conmutadores de capa ancha (X y cruz de esa columna): sube una columna, gira U o D y la devuelve
  for (const c of anchas) for (const t of ['U', 'D']) for (const s of SUF) {
    add([c, t + s, inv(c)], 'conmutador');
    add([inv(c), t + s, c], 'conmutador');
  }
  if (tipo === 'medio') {
    // solo lo que no mueve la X: caras y conmutadores de las capas del medio
    lista.length = 0;
    for (const c of LETRA) for (const s of SUF) add([c + s], 'cara', c);
    const PERP = { M: 'UDFB', S: 'UDRL', E: 'FRBL' };
    for (const k of ['M', 'Mi', 'S', 'Si', 'E', 'Ei']) for (const t of PERP[k[0]]) for (const s of SUF) add([...MEDIO[k], t + s, ...invSec(MEDIO[k])], 'medio');
    return lista;
  }
  if (tipo !== 'x') {
    // conmutadores de la capa del medio (solo la cruz): la capa sale, se gira una cara y vuelve
    const PERP = { M: 'UDFB', S: 'UDRL', E: 'FRBL' };
    for (const k of ['M', 'Mi', 'S', 'Si', 'E', 'Ei']) for (const t of PERP[k[0]]) for (const s of SUF) {
      add([...MEDIO[k], t + s, ...invSec(MEDIO[k])], 'medio');
    }
  }
  return lista;
}

/**
 * Una parte de un centro del 5x5 (la X o la cruz de una cara) de forma exacta: el estado es
 * solo en qué casillas (de `posiciones`) están las cuatro piezas de ese color, y con las
 * macros que no sacan nada de lo ya hecho se busca la secuencia más corta (Dijkstra, por
 * movimientos). Pocos miles de estados. Devuelve la lista de macros o null.
 */
function rutaSubconjunto(d, estado, posiciones, color, objetivo, macros) {
  const P = posiciones.length;
  const enLista = new Map(posiciones.map((i, j) => [i, j]));
  const id = [...Array(d.total).keys()];
  // para cada macro: casilla j -> casilla a la que va la pieza que está en j
  const mapas = [];
  for (const mac of macros) {
    const t = mac.movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
    const a = new Int8Array(P).fill(-1);
    let ok = true;
    posiciones.forEach((q, jq) => { const src = enLista.get(t[q]); if (src === undefined) ok = false; else a[src] = jq; });
    if (ok) mapas.push({ mac, a });
  }
  const mover = (mask, a) => { let r = 0; for (let j = 0; j < P; j++) if (mask & (1 << j)) r |= 1 << a[j]; return r; };
  let inicio = 0;
  posiciones.forEach((q, j) => { if (estado[q] === color) inicio |= 1 << j; });
  let meta = 0;
  for (const q of objetivo) meta |= 1 << enLista.get(q);
  if ((inicio & meta) === meta) return [];
  const dist = new Map([[inicio, 0]]);
  const padre = new Map();
  const cubos = [[inicio]];
  for (let c = 0; c < cubos.length; c++) {
    for (const m of cubos[c] || []) {
      if (dist.get(m) !== c) continue;
      if ((m & meta) === meta) {
        const ruta = [];
        for (let x = m; padre.has(x); x = padre.get(x)[0]) ruta.push(padre.get(x)[1]);
        return ruta.reverse();
      }
      for (const { mac, a } of mapas) {
        const y = mover(m, a);
        const nc = c + mac.movs.length;
        if (!dist.has(y) || dist.get(y) > nc) { dist.set(y, nc); padre.set(y, [m, mac]); (cubos[nc] = cubos[nc] || []).push(y); }
      }
    }
  }
  return null;
}

/** Etapa exacta de una parte de un centro (5x5), explicada pieza a pieza. */
function etapaSubcentro(g, d, nombre, objetivo, { f, c }, sub, posiciones, macros, hechas, deQue, proy) {
  g.etapa(nombre, objetivo, 'centros');
  // solo macros que no sacan nada de lo ya hecho (girarlo dentro de su cara vale: es de un color)
  const id = [...Array(d.total).keys()];
  const fijas = hechas.flatMap((x) => (x.sub ? x.sub[x.f] : d.centros[x.f]));
  const fijasSet = new Set(fijas);
  const caraDe = (i) => Math.floor(i / d.n2);
  const validas = macros.filter((mac) => {
    const t = mac.movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
    return fijas.every((i) => fijasSet.has(t[i]) && caraDe(t[i]) === caraDe(i));
  });
  const ruta = rutaSubconjunto(d, g.estado, posiciones, c, sub[f], validas);
  if (!ruta) { etapaCentros(g, d, nombre, objetivo, [{ f, c }], hechas, macros, proy, { sub, deQue, nueva: false }); return; }
  const cuenta = (e) => sub[f].filter((i) => e[i] === c).length;
  let pend = [];
  let e = g.estado;
  for (const mac of ruta) {
    const antes = cuenta(e);
    const tras = mac.movs.reduce((x, m) => d.b.aplicarMovimiento(x, m), e);
    pend.push(mac);
    if (cuenta(tras) > antes || mac === ruta[ruta.length - 1]) {
      const movs = pend.flatMap((p) => p.movs);
      const k0 = cuenta(g.estado);
      const idm = movs.reduce((x, m) => d.b.aplicarMovimiento(x, m), id);
      const eFin = movs.reduce((x, m) => d.b.aplicarMovimiento(x, m), g.estado);
      const nuevas = sub[f].filter((i) => eFin[i] === c && g.estado[i] !== c).map((i) => idm[i]);
      const k1 = cuenta(eFin);
      const usa = pend.filter((p) => p.tipo !== 'cara' && p.tipo !== 'ancha').map((p) => p.movs.join(' '));
      const ganadas = k1 - k0;
      const col = COLOR_F[c][ganadas > 1 ? 1 : 0];
      const texto = `${ganadas > 1 ? `Añade ${ganadas} piezas ${col}` : `Añade otra pieza ${col}`} ${deQue} ${NOMBRE_LADO[f]} (${k1}/4)`
        + (usa.length ? ` con ${usa.length > 1 ? 'los conmutadores' : 'el conmutador'} ${usa.join(' y ')}: ${ganadas > 1 ? 'las mete' : 'la mete'} sin deshacer lo que ya estaba hecho.` : '.');
      g.bloque(movs, texto, { algoritmo: usa.length ? 'Conmutador' : null, piezas: nuevas });
      pend = [];
    }
    e = tras;
  }
  g.comprobar(cuenta(g.estado) === 4 && hechas.every((x) => (x.sub ? x.sub[x.f] : d.centros[x.f]).every((i) => g.estado[i] === x.c)), nombre);
}

function centros5(g, d, proy) {
  const { X, C } = subCentros5(d);
  const libre = macros5(d, proy, 'libre');
  const conX = macros5(d, proy, 'x');
  const soloCruz = macros5(d, proy, 'medio');
  // con la X hecha, para separar piezas en cruz de su opuesta: conmutadores [capa interior, capa del medio]
  for (const movs of conmutadoresXFija5(d)) soloCruz.push({ movs, perm: proy.permDe(movs), tipo: 'conmutador' });
  const conCruz = soloCruz;
  const B = { f: 3, c: BLANCO }, A = { f: 0, c: AMARILLO };
  const todasX = X.flat(), todasC = C.flat();
  const sinD = (l) => l.filter((i) => Math.floor(i / d.n2) !== 3);
  etapaSubcentro(g, d, 'Centro blanco: X', 'Juntar abajo las cuatro piezas blancas en X (las esquinas del centro) alrededor de la pieza blanca del medio. Al principio vale casi cualquier movimiento: aún no hay nada que respetar; las capas anchas (Rw, Uw…) mueven las piezas en X igual que los centros del 4x4.', B, X, todasX, libre, [], 'a la X del centro', proy);
  etapaSubcentro(g, d, 'Centro blanco: cruz', 'Completar el centro blanco con las cuatro piezas en cruz (las de los lados de la pieza del medio) sin romper la X, con conmutadores de la capa del medio como 3Rw Rw\' U Rw 3Rw\' (la capa del medio sube, U la aparta y vuelve a bajar) y, para separar dos piezas opuestas, de una capa interior y la del medio.', B, C, todasC, conCruz, [{ ...B, sub: X }], 'a la cruz del centro', proy);
  etapaSubcentro(g, d, 'Centro amarillo: X', 'Juntar arriba las piezas amarillas en X sin romper el centro blanco: se suben desde los lados con conmutadores como Rw U Rw\'.', A, X, sinD(todasX), conX, [B], 'a la X del centro', proy);
  etapaSubcentro(g, d, 'Centro amarillo: cruz', 'Completar el centro amarillo con las piezas en cruz sin romper el blanco ni la X amarilla, con conmutadores de la capa del medio (3Rw Rw\' U Rw 3Rw\' y parecidos) y, para separar dos piezas opuestas, de una capa interior y la del medio.', A, C, sinD(todasC), conCruz, [B, { ...A, sub: X }], 'a la cruz del centro', proy);
  // los cuatro de los lados: cada uno donde marca su pieza del medio
  const lados = [2, 1, 5, 4].map((f) => ({ f, c: g.estado[d.idx(f, d.mid, d.mid)] }));
  const orden = lados.map((x) => NOMBRE_COLOR[x.c]).join(', ');
  ultimosCuatro(g, d, lados, {
    sub: X,
    etapa: ['Últimos cuatro centros: X', `Las piezas en X de los cuatro centros de los lados (delante, derecha, detrás, izquierda: ${orden}, lo que marcan sus piezas del medio), sin romper los centros de arriba y abajo: como en el 4x4, solo con giros de las caras de los lados y de las capas anchas Uw y Dw.`],
    macrosA: MOV_UNO(['F', 'R', 'B', 'L', 'Uw', 'Dw']),
    macrosB: MOV_UNO(['F', 'R', 'B', 'L']).concat([['Uw2'], ['Dw2']]),
    textoA: (Fc, Rc, Bc, Lc) => `Separa los colores de la X: las piezas ${COLOR_F[Fc][1]} y ${COLOR_F[Bc][1]} a delante y detrás, y las ${COLOR_F[Rc][1]} y ${COLOR_F[Lc][1]} a los lados (con Uw y Dw las filas pasan de una cara a otra, y girando una cara sus piezas cambian de fila).`,
    textoB: (Fc, Rc, Bc, Lc) => `Cada color de la X a su cara: ${COLOR_F[Fc][1]} delante, ${COLOR_F[Rc][1]} a la derecha, ${COLOR_F[Bc][1]} detrás y ${COLOR_F[Lc][1]} a la izquierda (Uw2 y Dw2 cambian filas entre caras opuestas sin deshacer el paso anterior).`,
    hechas: [B, A],
  });
  // La cruz de los lados: con la X hecha, las caras y las capas del medio mueven las piezas
  // en cruz de dos en dos (las opuestas de una cara viajan juntas), así que hacen falta
  // conmutadores de una capa interior y una del medio, como Uw U' 3Rw Rw' 3Rw Rw' U Uw' Rw 3Rw' Rw 3Rw'
  // ([u, M2]: u = la capa de debajo de U): la X se va y vuelve, y solo cambian piezas en cruz.
  const { opsA, opsB } = conmutadoresCruz5(d, C);
  ultimosCuatro(g, d, lados, {
    sub: C,
    etapa: ['Últimos cuatro centros: cruz', 'Las piezas en cruz de los lados sin romper nada de lo anterior. Con la X ya hecha, girar caras o la capa del medio mueve las piezas en cruz de dos en dos (las de lados opuestos de una cara van juntas), así que se usan conmutadores de una capa interior (u = Uw U\') y una del medio (M = 3Rw Rw\'), como u M2 u\' M2: la X sale y vuelve a su sitio, y solo cambian de cara unas pocas piezas en cruz.'],
    macrosA: opsA,
    macrosB: opsB,
    textoA: (Fc, Rc, Bc, Lc) => `Separa los colores de la cruz: las piezas ${COLOR_F[Fc][1]} y ${COLOR_F[Bc][1]} a delante y detrás, y las ${COLOR_F[Rc][1]} y ${COLOR_F[Lc][1]} a los lados, con conmutadores (y giros de caras para colocar las piezas).`,
    textoB: (Fc, Rc, Bc, Lc) => `Cada color de la cruz a su cara: ${COLOR_F[Fc][1]} delante, ${COLOR_F[Rc][1]} a la derecha, ${COLOR_F[Bc][1]} detrás y ${COLOR_F[Lc][1]} a la izquierda, con conmutadores que solo cambian piezas entre caras opuestas.`,
    algA: 'Conmutador', algB: 'Conmutador',
    hechas: [B, A, ...lados.map((x) => ({ ...x, sub: X }))],
  });
}

/**
 * Operaciones para la cruz de los cuatro lados del 5x5 (sin mover la X, las piezas del
 * medio ni los centros de arriba y abajo): giros de F R B L, conjugados de la capa del
 * medio horizontal (E) y conmutadores [capa interior, capa del medio]. Se comprueban sobre
 * el cubo: solo se quedan las que no cambian ninguna otra pieza de centro.
 * opsB: las que no mezclan delante/detrás con derecha/izquierda.
 */
/** Conmutadores [capa interior, capa del medio] que no mueven ninguna pieza en X ni las del medio (5x5). */
let cacheXFija5 = null;
function conmutadoresXFija5(d) {
  if (cacheXFija5) return cacheXFija5;
  const id = [...Array(d.total).keys()];
  const ap = (movs) => movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
  const { X } = subCentros5(d);
  const fijas = new Set([...X.flat(), ...[0, 1, 2, 3, 4, 5].map((f) => d.idx(f, d.mid, d.mid))]);
  const res = [];
  const vistos = new Set();
  for (const f of LETRA) for (const s of SUF) {
    const a = [f + 'w' + s, f + (s === "'" ? '' : s === '' ? "'" : '2')];
    for (const k of ['M', 'S', 'E']) for (const m of [MEDIO[k], MEDIO[k + 'i'], [...MEDIO[k], ...MEDIO[k]]]) {
      const movs = [...a, ...m, ...invSec(a), ...invSec(m)];
      const x = ap(movs);
      let ok = true, cambia = false;
      for (let i = 0; i < d.total && ok; i++) { if (!d.esCentro[i] || x[i] === i) continue; if (fijas.has(i)) ok = false; cambia = true; }
      if (!ok || !cambia) continue;
      const clave = id.filter((i) => d.esCentro[i]).map((i) => x[i]).join(',');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      res.push(movs);
    }
  }
  cacheXFija5 = res;
  return res;
}

const cacheCruz5 = new Map();
function conmutadoresCruz5(d, C) {
  if (cacheCruz5.has(d.N)) return cacheCruz5.get(d.N);
  const id = [...Array(d.total).keys()];
  const ap = (movs) => movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
  const lados = new Set([2, 1, 5, 4].flatMap((f) => C[f]));
  const FB = new Set([2, 5].flatMap((f) => C[f]));
  const candidatas = MOV_UNO(['F', 'R', 'B', 'L']);
  for (const [p, q] of [[MEDIO.E, MEDIO.Ei], [MEDIO.Ei, MEDIO.E]]) for (const t of ['F', 'R', 'B', 'L']) for (const s of SUF) candidatas.push([...p, t + s, ...q]);
  const interiores = [];
  for (const f of ['U', 'D', 'R', 'L', 'F', 'B']) for (const s of SUF) {
    const ancha = f + 'w' + s;
    const cara = f + (s === "'" ? '' : s === '' ? "'" : '2');
    interiores.push([ancha, cara]); // capa interior suelta (p. ej. u = Uw U')
  }
  const medios = [];
  for (const k of ['M', 'S', 'E']) { medios.push(MEDIO[k], MEDIO[k + 'i'], [...MEDIO[k], ...MEDIO[k]]); }
  for (const a of interiores) for (const m of medios) candidatas.push([...a, ...m, ...invSec(a), ...invSec(m)]);
  const vistos = new Map();
  const opsA = [], opsB = [];
  for (const movs of candidatas) {
    const x = ap(movs);
    let ok = true, cambia = false, mezcla = false;
    for (let i = 0; i < d.total && ok; i++) {
      if (!d.esCentro[i] || x[i] === i) continue;
      // fuera de la cruz de los lados solo vale girar una cara (sus centros ya son de un color)
      if (!lados.has(i) && Math.floor(i / d.n2) !== Math.floor(x[i] / d.n2)) ok = false;
      if (!lados.has(i) && lados.has(x[i])) ok = false;
      cambia = true;
      if (FB.has(i) !== FB.has(x[i])) mezcla = true;
    }
    if (!ok || !cambia) continue;
    if (lados.size && [...lados].every((i) => x[i] === i)) continue;
    const clave = [...lados].map((i) => x[i]).join(',');
    if (vistos.has(clave)) continue;
    vistos.set(clave, true);
    opsA.push(movs);
    if (!mezcla) opsB.push(movs);
  }
  const r = { opsA, opsB };
  cacheCruz5.set(d.N, r);
  return r;
}

const tablasL4C = new Map();
/**
 * Últimos cuatro centros en dos pasos exactos (tablas de 2^16 estados): separar los
 * colores por parejas de caras opuestas y después cada color a su cara.
 * 4x4: con F, R, B, L, Uw, Dw (no tocan los centros de arriba ni de abajo).
 * 5x5: igual para la X (Uw y Dw mueven la fila de la X), y para la cruz con
 * conmutadores de la capa del medio que no tocan la X.
 * opciones: { sub (pegatinas de cada cara), macrosA, macrosB (listas de movimientos),
 *             textoA, textoB, etapa: [nombre, objetivo] | null, hechas (lo que no se puede romper) }
 */
function ultimosCuatro(g, d, lados, op) {
  const [Fc, Rc, Bc, Lc] = lados.map((x) => x.c);
  const caras = [2, 1, 5, 4]; // F R B L
  const sub = op.sub || d.centros;
  const pos = caras.flatMap((f) => sub[f]); // 16 pegatinas: 4 por cara, en ese orden
  const proy = crearProyeccion(d, (() => { const m = new Array(d.total).fill(false); pos.forEach((i) => { m[i] = true; }); return m; })());
  const orden16 = pos.map((i) => proy.pos.indexOf(i));
  const tabla = (macros, objetivo) => {
    const clave = d.N + '|' + macros.map((m) => m.join(' ')).join(',') + '|' + objetivo;
    if (tablasL4C.has(clave)) return tablasL4C.get(clave);
    const perms = macros.map((m) => { const pm = proy.permDe(m); return orden16.map((j) => orden16.indexOf(pm[j])); });
    // distancia HASTA el objetivo: se expande desde él con las inversas de las macros
    const invs = perms.map((p) => { const q = new Array(16); p.forEach((src, j) => { q[src] = j; }); return q; });
    // coste uniforme en movimientos (las macros tienen longitudes distintas)
    const dist = new Int16Array(1 << 16).fill(-1);
    const cubos = [[objetivo]];
    dist[objetivo] = 0;
    for (let c = 0; c < cubos.length; c++) {
      for (const x of cubos[c] || []) {
        if (dist[x] !== c) continue;
        invs.forEach((p, k) => {
          let y = 0;
          for (let j = 0; j < 16; j++) if (x & (1 << p[j])) y |= 1 << j;
          const nc = c + macros[k].length;
          if (dist[y] < 0 || dist[y] > nc) { dist[y] = nc; (cubos[nc] = cubos[nc] || []).push(y); }
        });
      }
    }
    const t = { dist, perms };
    tablasL4C.set(clave, t);
    return t;
  };
  const aplicarBits = (p, x) => { let y = 0; for (let j = 0; j < 16; j++) if (x & (1 << p[j])) y |= 1 << j; return y; };
  const resolverTabla = (t, x, macros) => {
    const sol = [];
    g.comprobar(t.dist[x] >= 0, `${op.etapa ? op.etapa[0] : 'últimos cuatro centros'}: estado no alcanzable`);
    while (t.dist[x] > 0) {
      const k = t.perms.findIndex((p, k2) => { const y = aplicarBits(p, x); return t.dist[y] >= 0 && t.dist[y] === t.dist[x] - macros[k2].length; });
      g.comprobar(k >= 0, 'últimos cuatro centros: tabla');
      x = aplicarBits(t.perms[k], x);
      sol.push(macros[k]);
    }
    return sol;
  };
  const bits = (e, fn) => pos.reduce((a, i, j) => a | (fn(e[i], Math.floor(j / 4)) ? 1 << j : 0), 0);
  if (op.etapa) g.etapa(op.etapa[0], op.etapa[1], 'centros');
  const objA = 0b1111 | (0b1111 << 8);
  const TA = tabla(op.macrosA, objA);
  const solA = resolverTabla(TA, bits(g.estado, (c) => c === Fc || c === Bc), op.macrosA);
  const piezasDe = (cols) => pos.filter((i) => cols.includes(g.estado[i]));
  g.bloque(solA.flat(), op.textoA(Fc, Rc, Bc, Lc), { piezas: piezasDe([Fc, Bc]), algoritmo: op.algA || null });
  const objB = 0b1111 | (0b1111 << 4);
  const TB = tabla(op.macrosB, objB);
  const solB = resolverTabla(TB, bits(g.estado, (c, k) => (k === 0 || k === 2 ? c === Fc : c === Rc)), op.macrosB);
  g.bloque(solB.flat(), op.textoB(Fc, Rc, Bc, Lc), { piezas: pos.slice(), algoritmo: op.algB || null });
  const e = g.estado;
  g.comprobar(lados.every(({ f, c }) => sub[f].every((i) => e[i] === c)) && (op.hechas || []).every(({ f, c, sub: s2 }) => (s2 ? s2[f] : d.centros[f]).every((i) => e[i] === c)), 'últimos cuatro centros');
}

const MOV_UNO = (lista) => lista.flatMap((c) => SUF.map((s) => [c + s]));
function ultimosCuatro4(g, d, lados, orden) {
  ultimosCuatro(g, d, lados, {
    etapa: ['Últimos cuatro centros', `Completar los centros de los lados sin romper el blanco ni el amarillo: solo con giros de las caras de los lados y de las capas anchas Uw y Dw, que no tocan los centros de arriba y abajo. Van en este orden (delante, derecha, detrás, izquierda): ${orden}, el que corresponde a los colores de las esquinas.`],
    macrosA: MOV_UNO(['F', 'R', 'B', 'L', 'Uw', 'Dw']),
    macrosB: MOV_UNO(['F', 'R', 'B', 'L']).concat([['Uw2'], ['Dw2']]),
    textoA: (Fc, Rc, Bc, Lc) => `Separa los colores: las piezas ${COLOR_F[Fc][1]} y ${COLOR_F[Bc][1]} a delante y detrás, y las ${COLOR_F[Rc][1]} y ${COLOR_F[Lc][1]} a los lados (con Uw y Dw las filas pasan de una cara a otra, y girando una cara sus piezas cambian de fila).`,
    textoB: (Fc, Rc, Bc, Lc) => `Cada color a su cara: ${COLOR_F[Fc][1]} delante, ${COLOR_F[Rc][1]} a la derecha, ${COLOR_F[Bc][1]} detrás y ${COLOR_F[Lc][1]} a la izquierda (con Uw2 y Dw2 se cambian filas entre caras opuestas sin deshacer el paso anterior).`,
    hechas: [{ f: 3, c: BLANCO }, { f: 0, c: AMARILLO }],
  });
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
// r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2 con r y l = solo la segunda capa (en WCA, r = Rw R')
const ALG_PARIDAD_ARISTA_5 = { nombre: 'Paridad de aristas', alg: "Rw2 R2 B2 U2 Lw L' U2 Rw' R U2 Rw R' U2 F2 Rw R' F2 Lw' L B2 Rw2 R2" };

function aristas(g, d) {
  const N = d.N;
  if (N === 5) { aristas5(g, d); return; }
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
    g.comprobar(!!pasos, `aristas: no se encontró cómo emparejar otra (pares ${n0}/${maxPares}, completas ${hechas.length})`);
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

// ---------- Aristas del 5x5 (tredges) ----------
// Como lo haría una persona: se gira el cubo para tener a la izquierda (FL) una arista
// incompleta; con giros de R, U, B y D (que no tocan esa arista) se lleva a la derecha (FR)
// la pieza que le falta, a la altura buena; se baja o se sube su fila (Uw o Dw) para
// juntarla, se cambia la arista de la derecha por otra con R U R' F R' F' R y se deshace el
// giro de la fila. Si al final queda una arista con las dos piezas de los lados cambiadas,
// la paridad de aristas del 5x5.
const ROT_FL = ['', 'y', 'y2', "y'", 'x', "x'", 'x2', 'z', "z'", 'z2', 'x y', 'x y2', "x y'", "x' y", "x' y2", "x' y'", 'z y', 'z y2', "z y'", "z' y", "z' y2", "z' y'", 'x2 y', "x2 y'"];
function aristas5(g, d) {
  const proy = crearProyeccion(d, d.esArista);
  const P = (i) => proy.pos.indexOf(i);
  const ar = d.aristas.map(([a, b]) => [a.map(P), b.map(P)]);
  const paresDe = (v, k) => { const [a, b] = ar[k]; let n = 0; for (let j = 0; j + 1 < a.length; j++) if (v[a[j]] === v[a[j + 1]] && v[b[j]] === v[b[j + 1]]) n++; return n; };
  const pares = (v) => ar.reduce((t, _, k) => t + paresDe(v, k), 0);
  const completa = (v, k) => { const [a, b] = ar[k]; return a.every((j) => v[j] === v[a[0]]) && b.every((j) => v[j] === v[b[0]]); };
  const claveDe = (v, k) => { const x = v[ar[k][0][1]], y = v[ar[k][1][1]]; return Math.min(x, y) * 8 + Math.max(x, y); }; // por la pieza del medio
  const completas = (v) => new Set(ar.map((_, k) => k).filter((k) => completa(v, k)).map((k) => claveDe(v, k)));
  const aplicarP = (v, p) => { const w = new Uint8Array(v.length); for (let k = 0; k < v.length; k++) w[k] = v[p[k]]; return w; };
  const centrosBien = (movs) => { const e = movs.reduce((x, m) => d.b.aplicarMovimiento(x, m), d.b.estadoResuelto()); return d.centros.every((l, f) => l.every((i) => e[i] === f)); };
  const algs = ALG_EMPAREJAR.map((a) => ({ ...a, movs: parsear(a.alg) })).filter((a) => centrosBien(a.movs)).map((a) => ({ ...a, perm: proy.permDe(a.movs) }));
  const paridad = { ...ALG_PARIDAD_ARISTA_5, movs: parsear(ALG_PARIDAD_ARISTA_5.alg) };
  g.comprobar(centrosBien(paridad.movs) && algs.length === ALG_EMPAREJAR.length, 'algoritmos de aristas del 5x5');
  paridad.perm = proy.permDe(paridad.movs);
  const setupMovs = [];
  for (const c of ['R', 'U', 'B', 'D']) for (const s2 of SUF) setupMovs.push({ m: c + s2, cara: c, perm: proy.permDe([c + s2]) });
  const rots = ROT_FL.map((r) => { const movs = r ? r.split(' ') : []; return { movs, perm: proy.permDe(movs) }; });
  const FL = M3.aristas.findIndex(([p, q]) => [Math.floor(p / 9), Math.floor(q / 9)].sort().join() === '2,4');
  const UF = M3.aristas.findIndex(([p, q]) => [Math.floor(p / 9), Math.floor(q / 9)].sort().join() === '0,2');
  const nombreArista = (e, k) => coloresPieza([e[d.aristas[k][0][1]], e[d.aristas[k][1][1]]].sort((x, y) => x - y)).replace(' y ', '-');
  g.etapa('Aristas', 'Juntar las tres piezas de cada arista (la del medio y las dos de los lados) sin romper los centros. Con la arista incompleta a la izquierda (FL), se lleva a la derecha (FR) la pieza que le falta con giros de R, U, B o D, se mueve su fila (Uw o Dw) para juntarla, se cambia la arista de la derecha con R U R\' F R\' F\' R y se devuelve la fila.', 'aristas');
  let enCurso = null; // pieza del medio (colores) de la arista en la que se trabaja: se sigue con ella hasta completarla
  for (let vueltas = 0; vueltas < 60; vueltas++) {
    const v = proy.proyectar(g.estado);
    const n0 = pares(v);
    if (n0 === ar.length * 2) break;
    if (enCurso != null && completas(v).has(enCurso)) enCurso = null;
    const hechas = completas(v);
    const vale = (w) => { if (pares(w) <= n0) return false; const c = completas(w); for (const x of hechas) if (!c.has(x)) return false; return true; };
    let mejor = null;
    // por longitud de la preparación (0..3 giros), la primera que funcione con menos giros
    for (let prof = 0; prof <= 3 && !mejor; prof++) {
      for (const rot of rots) {
        const v1 = aplicarP(v, rot.perm);
        if (completa(v1, FL)) continue; // la arista de la izquierda tiene que estar incompleta
        if (enCurso != null && claveDe(v1, FL) !== enCurso) continue;
        // se trabaja en la arista de la izquierda: tiene que ganar una pieza, sin romper las completas
        const p0 = paresDe(v1, FL);
        const valeFL = (w) => { if (paresDe(w, FL) <= p0) return false; const c = completas(w); for (const x of hechas) if (!c.has(x)) return false; return true; };
        const dfs = (w, camino, ult) => {
          if (camino.length === prof) {
            for (const a of algs) {
              const x = aplicarP(w, a.perm);
              if (valeFL(x)) {
                const n = camino.length + a.movs.length;
                const t = pares(x);
                if (!mejor || n < mejor.n || (n === mejor.n && t > mejor.t)) mejor = { n, t, rot, camino: camino.slice(), alg: a };
              }
            }
            return;
          }
          for (const sm of setupMovs) {
            if (sm.cara === ult) continue;
            camino.push(sm.m);
            dfs(aplicarP(w, sm.perm), camino, sm.cara);
            camino.pop();
          }
        };
        dfs(v1, [], null);
      }
    }
    if (!mejor && enCurso != null) { enCurso = null; vueltas--; continue; } // probar con otra arista
    let movs, texto, algNombre, rotMovs = [];
    if (mejor) {
      enCurso = claveDe(aplicarP(v, mejor.rot.perm), FL);
      rotMovs = mejor.rot.movs;
      movs = [...mejor.camino, ...mejor.alg.movs];
      algNombre = mejor.alg.nombre;
    } else {
      // paridad: una arista con las dos piezas de los lados cambiadas; se pone delante arriba (UF)
      let par = null;
      for (const rot of rots) {
        const x = aplicarP(aplicarP(v, rot.perm), paridad.perm);
        if (vale(x) && (!par || pares(x) > par.n)) par = { rot, n: pares(x) };
      }
      g.comprobar(!!par, `aristas: no se encontró cómo emparejar otra (pares ${n0}/${ar.length * 2})`);
      rotMovs = par.rot.movs;
      movs = paridad.movs;
      algNombre = paridad.nombre;
    }
    // texto: qué arista se completa (o qué piezas se juntan)
    const eRot = rotMovs.reduce((e, m) => d.b.aplicarMovimiento(e, m), g.estado);
    const id = [...Array(d.total).keys()];
    const tras = movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), id);
    const eFin = movs.reduce((e, m) => d.b.aplicarMovimiento(e, m), eRot);
    const vRot = proy.proyectar(eRot), vFin = proy.proyectar(eFin);
    const antes = completas(vRot);
    const nuevas = ar.map((_, k) => k).filter((k) => completa(vFin, k) && !antes.has(claveDe(vFin, k)));
    const objetivo = nuevas.length ? nuevas : ar.map((_, k) => k).filter((k) => paresDe(vFin, k) > paresDe(vRot, k));
    const piezas = objetivo.flatMap((k) => d.aristas[k].flat()).map((i) => tras[i]);
    const nombres = nuevas.map((k) => nombreArista(eFin, k));
    const lista = nombres.length > 1 ? `las aristas ${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : `la arista ${nombres[0]}`;
    if (algNombre === paridad.nombre) {
      texto = `Paridad de aristas del 5x5: en la arista de delante arriba (UF) las dos piezas de los lados están cambiadas entre sí, algo que no se arregla con el método de siempre. El algoritmo r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2 (r y l, solo la segunda capa) las intercambia${nuevas.length ? ` y completa ${lista}` : ''}.`;
    } else {
      const fila = /^U/.test(mejor.alg.movs[0]) ? 'de arriba (Uw)' : 'de abajo (Dw)';
      const prep = mejor.camino.length ? `lleva a la derecha la pieza que falta (${mejor.camino.join(' ')}), ` : 'con la pieza que falta ya a la derecha, ';
      texto = (nuevas.length ? `Completa ${lista}: ` : `Junta otra pieza a la arista ${nombreArista(eRot, FL)} (a la izquierda): `) + `${prep}mueve la fila ${fila} para juntarla, cambia la arista de la derecha y devuelve la fila (${mejor.alg.movs.join(' ')}).`;
    }
    if (rotMovs.length) g.bloque(rotMovs, `Gira el cubo (${rotMovs.join(' ')}) para tener delante la arista en la que vas a trabajar.`);
    g.bloque(movs, texto, { algoritmo: algNombre, piezas });
  }
  g.comprobar(pares(proy.proyectar(g.estado)) === ar.length * 2, 'aristas');
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
export const METODOS_5x5 = [
  { id: 'principiantes', nombre: 'Reducción (3x3 por capas)', descripcion: 'Reducción: cada centro en dos partes (X y cruz), aristas de tres piezas (tredges) con su paridad, y después como un 3x3 por capas.' },
  { id: 'cfop', nombre: 'Reducción (3x3 con CFOP)', descripcion: 'Reducción: cada centro en dos partes (X y cruz), aristas de tres piezas (tredges) con su paridad, y después como un 3x3 con CFOP (cruz, F2L, OLL y PLL).' },
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
