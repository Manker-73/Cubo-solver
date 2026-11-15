// Métodos humanos del 2x2 (modo aprender): por capas para principiantes y Ortega.
// El 2x2 no tiene centros: el marco (qué color va en cada cara) lo da una esquina
// de referencia que se deja abajo con el blanco hacia abajo.

import { motorCubo, AJUSTES_U, rotY, parsear, coloresPieza, NOMBRE_COLOR, OPUESTO } from './motor-cubo.js';
import { crearGuion } from './guion.js';
import { OBJETIVOS_2x2 as OB } from './objetivos-cubo.js';
import { PLL, PRINCIPIANTES } from './algoritmos.js';
import { esRotacion } from '../puzzles/nxn.js';

const M = motorCubo(2);
const BLANCO = 0, AMARILLO = 3;
const LETRA = 'URFDLB';
const HUECOS = [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']];
const URF = M.esquinas[0];
const nombreRot = (k) => ['', 'y', 'y2', "y'"][k];

const carasDeCasilla = (f) => M.pegatinasDe(f).map((x) => LETRA[M.caraDe(x)]);
function huecoDe(f) {
  const cs = carasDeCasilla(f).filter((c) => c !== 'U' && c !== 'D');
  return HUECOS.findIndex((h) => h.every((c) => cs.includes(c)));
}
const enCapaU = (f) => carasDeCasilla(f).includes('U');

/** Marco a partir de la esquina de referencia (abajo, con el blanco hacia abajo). */
function marcoRef(e, ref) {
  for (const r of M.esquinas) {
    const cs = r.map((f) => e[f]);
    if (!ref.every((c) => cs.includes(c))) continue;
    const marco = new Array(6);
    r.forEach((f) => { marco[e[f]] = M.caraDe(f); });
    for (const c of ref) marco[OPUESTO[c]] = (marco[c] + 3) % 6;
    return marco;
  }
  throw new Error('esquina de referencia no encontrada');
}

/** Gira el cubo para dejar abajo, con el blanco hacia abajo, la esquina blanca que menos giro necesite. */
function preparacion(g) {
  g.etapa('Preparación', 'El 2x2 no tiene centros: se elige una esquina blanca de referencia y se deja abajo con el blanco hacia abajo. Sus otros dos colores dicen qué color va en cada lado.', 'prep');
  const rotDe = { 0: ['z2'], 1: ['z'], 2: ["x'"], 3: [], 4: ["z'"], 5: ['x'] };
  let mejor = null;
  for (const r of M.esquinas) {
    const k = r.findIndex((f) => g.estado[f] === BLANCO);
    if (k < 0) continue;
    const rot = rotDe[M.caraDe(r[k])];
    const cs = r.map((f) => g.estado[f]);
    if (!mejor || rot.length < mejor.rot.length) mejor = { rot, ref: [BLANCO, ...cs.filter((c) => c !== BLANCO)] };
  }
  g.bloque(mejor.rot, `Gira el cubo entero (${mejor.rot.join(' ')}) para dejar abajo la esquina ${coloresPieza(mejor.ref)} con el blanco hacia abajo.`, { piezas: [] });
  // texto informativo aunque no haga falta girar
  return mejor.ref;
}

function primeraCapa(g, ref) {
  g.etapa('Primera capa', 'Colocar las otras tres esquinas blancas abajo, junto a la de referencia y con sus colores a juego: la capa blanca queda completa.', 'capa1');
  const sexy = parsear(PRINCIPIANTES.sexy);
  const pz = (e, c) => M.pieza(e, marcoRef(e, ref), c);
  const bien = (e, c) => { const p = pz(e, c); return p.casa === p.donde; };
  const pegs = (e, c) => M.pegatinasDe(pz(e, c).donde);
  const textoRot = (k, que) => `Gira el cubo entero (${nombreRot(k)}) para tener ${que} delante a la derecha.`;
  for (let vueltas = 0; vueltas < 8; vueltas++) {
    const e = g.estado;
    const marco = marcoRef(e, ref);
    const colorDe = (l) => marco.indexOf(LETRA.indexOf(l));
    const cols = HUECOS.map(([a, b]) => [BLANCO, colorDe(a), colorDe(b)]);
    const pend = cols.filter((c) => !bien(e, c));
    if (!pend.length) break;
    let c = pend.find((x) => enCapaU(pz(e, x).donde));
    if (!c) {
      c = pend.find((x) => huecoDe(pz(e, x).donde) !== huecoDe(pz(e, x).casa)) || pend[0];
      const p = pz(e, c);
      if (huecoDe(p.donde) !== huecoDe(p.casa)) {
        const k = huecoDe(p.donde);
        g.bloque(rotY(k), textoRot(k, 'el hueco donde está la esquina'), { piezas: pegs(g.estado, c) });
        g.bloque(sexy, `La esquina ${coloresPieza(c)} está abajo pero en un sitio que no es el suyo: sácala arriba con R U R' U'.`, { algoritmo: 'Sexy move', piezas: pegs(g.estado, c) });
      }
    }
    const k = huecoDe(pz(g.estado, c).casa);
    g.bloque(rotY(k), textoRot(k, `el sitio de la esquina ${coloresPieza(c)}`), { piezas: pegs(g.estado, c) });
    if (enCapaU(pz(g.estado, c).donde)) {
      const j = [[], ['U'], ['U2'], ["U'"]].find((u) => M.pegatinasDe(pz(M.aplicarSec(g.estado, u), c).donde).includes(URF[0]));
      g.bloque(j, 'Gira la capa de arriba para dejar la esquina justo encima de su sitio (arriba, delante a la derecha).', { piezas: pegs(g.estado, c) });
    }
    let r = 0, e2 = g.estado;
    while (!bien(e2, c) && r < 6) { e2 = M.aplicarSec(e2, sexy); r++; }
    g.comprobar(bien(e2, c), 'esquina con R U R\' U\'');
    g.bloque(Array.from({ length: r }, () => sexy).flat(), `Repite R U R' U' hasta que la esquina ${coloresPieza(c)} baje a su sitio con el blanco abajo (${r} ${r === 1 ? 'vez' : 'veces'}).`, { algoritmo: r > 1 ? `Sexy move ×${r}` : 'Sexy move', piezas: pegs(g.estado, c) });
  }
  g.comprobar(OB.primeraCapa(g.estado), 'primera capa');
}

// casillas de la fila de arriba de cada lado (R F L B) y de la de abajo
const FILA_ARRIBA = [[4, 5], [8, 9], [16, 17], [20, 21]];
const FILA_ABAJO = [[6, 7], [10, 11], [18, 19], [22, 23]];
const ladosIguales = (e, filas) => filas.filter(([a, b]) => e[a] === e[b]).length;
const caso = (n) => (n === 4 ? 'resuelta' : n === 1 ? 'dos esquinas contiguas intercambiadas' : n === 0 ? 'dos esquinas intercambiadas en diagonal' : 'por colocar');
const piezasTodas = () => M.esquinas.flat();
const piezasArriba = () => M.esquinas.filter((r) => r.some((f) => M.caraDe(f) === 0)).flat();

function textoAjuste(e, mac, filas, lado) {
  const d = M.aplicarSec(e, mac.movs);
  const iguales = filas.findIndex(([a, b]) => d[a] === d[b]);
  const capa = mac.ajuste === 'D' ? 'de abajo' : 'de arriba';
  if (OB.resuelto(d)) return `Gira la capa ${capa} (${mac.nombre}) para terminar: el cubo queda resuelto.`;
  if (ladosIguales(d, filas) === 1) return `Gira la capa ${capa} (${mac.nombre}) para dejar ${lado[iguales]} las dos esquinas que ya encajan entre sí.`;
  return `Gira la capa ${capa} (${mac.nombre}) para colocar el caso en la posición del algoritmo.`;
}
const LADO = ['a la derecha', 'delante', 'a la izquierda', 'detrás'];

function ultimaCapaPrincipiantes(g) {
  const sune = { nombre: 'Sune', movs: parsear(PRINCIPIANTES.sune.alg) };
  g.etapa('Cara amarilla', 'Dejar toda la cara de arriba amarilla con Sune (R U R\' U R U2 R\'), repetido si hace falta.', 'caraam');
  let pasos = M.buscarMacros(g.estado, [...AJUSTES_U, sune], OB.caraAmarillaConCapa, 7);
  for (const { macro } of pasos) {
    const e = g.estado;
    if (macro.ajuste) {
      const d = M.aplicarSec(e, macro.movs);
      const hacia = d[2] === AMARILLO ? 'arriba' : d[8] === AMARILLO ? 'hacia delante' : 'hacia la izquierda';
      g.bloque(macro.movs, `Gira la capa de arriba (U) para dejar la esquina de delante a la izquierda con el amarillo mirando ${hacia} antes del Sune.`, { piezas: piezasArriba() });
    } else {
      const n = [0, 1, 2, 3].filter((f) => e[f] === AMARILLO).length;
      g.bloque(macro.movs, `${n} esquina${n === 1 ? '' : 's'} con el amarillo arriba: haz Sune (R U R' U R U2 R').`, { algoritmo: 'Sune', piezas: piezasArriba() });
    }
  }
  g.comprobar(OB.caraAmarillaConCapa(g.estado), 'cara amarilla');

  const t = PLL.find((p) => p.nombre === 'T');
  const tperm = { nombre: 'T-perm', movs: parsear(t.alg) };
  g.etapa('Esquinas amarillas', 'Colocar las esquinas de arriba en su sitio. La T-perm intercambia las dos esquinas de la derecha; si hay dos esquinas que ya encajan entre sí (faros), van a la izquierda.', 'esqam');
  pasos = M.buscarMacros(g.estado, [...AJUSTES_U, tperm], OB.resuelto, 5);
  for (const { macro } of pasos) {
    const e = g.estado;
    if (macro.ajuste) g.bloque(macro.movs, textoAjuste(e, macro, FILA_ARRIBA, LADO), { piezas: piezasArriba() });
    else g.bloque(macro.movs, `Caso: ${caso(ladosIguales(e, FILA_ARRIBA))}. T-perm (intercambia las dos esquinas de la derecha).`, { algoritmo: 'PLL T-perm', piezas: piezasArriba() });
  }
  g.comprobar(OB.resuelto(g.estado), 'resuelto');
}

// ---------- Ortega ----------
let tablaCara = null;
/** Distancia (en giros de U R F D L B) de cada conjunto de posiciones de las pegatinas blancas a la cara D blanca. */
function distanciaCara() {
  if (tablaCara) return tablaCara;
  const movs = [];
  for (const c of 'URFDLB') movs.push(c, c + "'", c + '2');
  const ds = movs.map((m) => M.destino(m));
  const D = [12, 13, 14, 15];
  const cod = (v) => v.reduce((a, f) => a | (1 << f), 0);
  const dist = new Map([[cod(D), 0]]);
  let frontera = [D];
  for (let d = 0; frontera.length; d++) {
    const sig = [];
    for (const v of frontera) for (const dm of ds) {
      const w = v.map((f) => dm[f]);
      const k = cod(w);
      if (!dist.has(k)) { dist.set(k, d + 1); sig.push(w); }
    }
    frontera = sig;
  }
  tablaCara = { dist, movs, ds, cod };
  return tablaCara;
}
function caraBlanca(g) {
  g.etapa('Cara', 'Poner las cuatro esquinas blancas abajo con el blanco hacia abajo (la cara blanca). Sus lados todavía no tienen que coincidir.', 'cara');
  const { dist, movs, ds, cod } = distanciaCara();
  // primero, girar el cubo para tener abajo la cara en la que la cara blanca está más cerca
  const blancas = (e) => { const v = []; e.forEach((c, f) => { if (c === BLANCO) v.push(f); }); return v; };
  let mejor = null;
  for (const rot of [[], ['z2'], ['z'], ["z'"], ['x'], ["x'"]]) {
    const d = dist.get(cod(blancas(M.aplicarSec(g.estado, rot))));
    if (!mejor || d < mejor.d) mejor = { rot, d };
  }
  g.bloque(mejor.rot, `Gira el cubo entero (${mejor.rot.join(' ')}) para tener abajo el lado en el que la cara blanca se hace con menos giros.`);
  let v = blancas(g.estado);
  const sol = [];
  while (dist.get(cod(v)) > 0) {
    const d = dist.get(cod(v));
    const m = ds.findIndex((dm) => dist.get(cod(v.map((f) => dm[f]))) === d - 1);
    v = v.map((f) => ds[m][f]);
    sol.push(movs[m]);
  }
  g.bloque(sol, 'Haz la cara blanca abajo (con la menor cantidad de giros posible).', { piezas: g.estado.map((c, f) => (c === BLANCO ? f : -1)).filter((f) => f >= 0).flatMap((f) => M.pegatinasDe(f)) });
  g.comprobar(OB.caraBlanca(g.estado) && [12, 13, 14, 15].every((f) => g.estado[f] === BLANCO), 'cara blanca');
}
function ollOrtega(g) {
  g.etapa('OLL', 'Dejar toda la cara de arriba amarilla con un solo algoritmo (los mismos siete casos que las esquinas de la OLL del 3x3).', 'oll');
  const occl = OLL_2x2.map(([nombre, alg]) => ({ nombre, movs: parsear(alg) }));
  const pasos = M.buscarMacros(g.estado, [...AJUSTES_U, ...occl], OB.carasOpuestas, 2);
  for (const { macro } of pasos) {
    const e = g.estado;
    const n = [0, 1, 2, 3].filter((f) => e[f] === AMARILLO).length;
    if (macro.ajuste) g.bloque(macro.movs, 'Gira la capa de arriba (U) para colocar el caso en la posición del algoritmo.', { piezas: piezasArriba() });
    else g.bloque(macro.movs, `Caso: ${n} esquina${n === 1 ? '' : 's'} con el amarillo arriba. Algoritmo: OLL ${macro.nombre}.`, { algoritmo: `OLL ${macro.nombre}`, piezas: piezasArriba() });
  }
  g.comprobar(OB.carasOpuestas(g.estado), 'caras blanca y amarilla');
}

// Los siete casos de orientar las esquinas (como la OCLL del 3x3; sin capas anchas)
const OLL_2x2 = [
  ['Sune', "R U R' U R U2 R'"],
  ['Antisune', "R U2 R' U' R U' R'"],
  ['H', "R U2 R' U' R U R' U' R U' R'"],
  ['Pi', "R U2 R2 U' R2 U' R2 U2 R"],
  ['U (Headlights)', "R2 D' R U2 R' D R U2 R"],
  ['T', "R U R' U' R' F R F'"],
  ['L (Bowtie)', "F R' F' R U R U' R'"],
];
const PBL = [
  { nombre: 'T-perm', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { nombre: 'Y-perm', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { nombre: 'Doble diagonal', alg: 'R2 F2 R2' },
  { nombre: 'Doble contigua', alg: "R2 U' B2 U2 R2 U' R2" },
  { nombre: 'Contigua arriba y diagonal abajo', alg: "R U' R F2 R' U R'" },
  { nombre: 'Diagonal arriba y contigua abajo', alg: "R' U R' F2 R F' R" },
  { nombre: 'Contigua abajo', alg: "x2 R U R' U' R' F R2 U' R' U' R U R' F' x2" },
  { nombre: 'Diagonal abajo', alg: "x2 F R U' R' U' R U R' F' R U R' U' R' F R F' x2" },
];
const AJUSTES_D = [
  { nombre: 'D', movs: ['D'], ajuste: 'D' },
  { nombre: "D'", movs: ["D'"], ajuste: 'D' },
  { nombre: 'D2', movs: ['D2'], ajuste: 'D' },
];
let pblOk = null;
function pbl(g) {
  if (!pblOk) {
    // solo los que respetan las dos caras (blanca abajo y amarilla arriba)
    const base = M.aplicar(M.b.estadoResuelto(), 'z2');
    pblOk = PBL.map((p) => ({ nombre: p.nombre, movs: parsear(p.alg) }))
      .filter((p) => { const e = M.aplicarSec(base, p.movs); return [12, 13, 14, 15].every((f) => e[f] === BLANCO) && [0, 1, 2, 3].every((f) => e[f] === AMARILLO); });
  }
  g.etapa('PBL', 'Permutation of both layers: colocar a la vez las esquinas de arriba y las de abajo con un algoritmo, y ajustar las dos capas.', 'pbl');
  const pasos = M.buscarMacros(g.estado, [...AJUSTES_U, ...AJUSTES_D, ...pblOk], OB.resuelto, 6);
  for (const { macro } of pasos) {
    const e = g.estado;
    if (macro.ajuste === 'U') g.bloque(macro.movs, textoAjuste(e, macro, FILA_ARRIBA, LADO), { piezas: piezasArriba() });
    else if (macro.ajuste === 'D') g.bloque(macro.movs, textoAjuste(e, macro, FILA_ABAJO, LADO), { piezas: piezasTodas().filter((f) => !piezasArriba().includes(f)) });
    else g.bloque(macro.movs, `Caso: arriba, ${caso(ladosIguales(e, FILA_ARRIBA))}; abajo, ${caso(ladosIguales(e, FILA_ABAJO))}. Algoritmo: ${macro.nombre}.`, { algoritmo: `PBL ${macro.nombre}`, piezas: piezasTodas() });
  }
  g.comprobar(OB.resuelto(g.estado), 'resuelto');
}

export const METODOS_2x2 = [
  { id: 'principiantes', nombre: 'Principiantes (por capas)', descripcion: "Por capas: una esquina blanca de referencia, la primera capa con R U R' U', la cara amarilla con Sune y las esquinas con la T-perm." },
  { id: 'ortega', nombre: 'Ortega', descripcion: 'Ortega: la cara blanca (sin importar los lados), la cara amarilla con una OLL (7 casos) y las dos capas a la vez con una PBL.' },
];

export function aprender2x2(estado, metodo = 'principiantes') {
  const t0 = Date.now();
  const g = crearGuion(M.aplicar, estado, { esRotacion });
  if (metodo === 'ortega') {
    caraBlanca(g);
    ollOrtega(g);
    pbl(g);
  } else {
    const ref = preparacion(g);
    primeraCapa(g, ref);
    ultimaCapaPrincipiantes(g);
  }
  const r = g.resultado(metodo);
  r.ms = Date.now() - t0;
  return r;
}
export function pblComprobados() { if (!pblOk) pbl({ etapa() {}, bloque() {}, comprobar() {}, estado: M.b.estadoResuelto() }); return pblOk; }
void NOMBRE_COLOR;
