// Modo aprender: soluciones por métodos humanos (2x2 y 3x3).
//  - 100 % de soluciones correctas, aplicadas movimiento a movimiento con el modelo de pegatinas.
//  - Tras cada etapa, el estado cumple el objetivo de esa etapa (comprobado con objetivos-cubo.js).
//  - Etapas y bloques contiguos que cubren toda la solución, con texto; algoritmos con nombre.
//  - Los algoritmos de la última capa cubren todos los casos (OLL: 216, PLL: 288).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, guardarResultado } from './util.mjs';
import { rngConSemilla } from '../src/core/rng.js';
import cubo2 from '../src/puzzles/cubo2.js';
import cubo3 from '../src/puzzles/cubo3.js';
import pyraminx from '../src/puzzles/pyraminx.js';
import skewb from '../src/puzzles/skewb.js';
import square1 from '../src/puzzles/square1.js';
import { OBJETIVOS_3x3, OBJETIVOS_2x2 } from '../src/aprender/objetivos-cubo.js';
import { algoritmosComprobados } from '../src/aprender/metodos-3x3.js';
import { OLL, PLL } from '../src/aprender/algoritmos.js';
import { motorCubo, AJUSTES_U } from '../src/aprender/motor-cubo.js';
import { crearCuboGrande } from '../src/puzzles/cubo-grande.js';
import { datosNxN, paridades3 } from '../src/aprender/metodos-nxn.js';
import { resolverEnParalelo } from './paralelo.mjs';

const N_CASOS = Math.min(CASOS, 500);
const ROT = ['', 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];

/** Estado al azar: 40 giros de cara y una orientación del cubo al azar. */
function estadoAlAzar(p, rng) {
  if (p.id === 'square1') return p.generarScramble(rng).reduce((x, m) => p.aplicarMovimiento(x, m), p.estadoResuelto());
  if (p.geo) {
    // Pyraminx, Skewb…: estado aleatorio de su scramble y el puzzle girado entero al azar
    let e = p.generarScramble(rng).reduce((x, m) => p.aplicarMovimiento(x, m), p.estadoResuelto());
    const R = p.geo.rotaciones[Math.floor(rng() * p.geo.rotaciones.length)];
    return e.map((_, i) => e[R[i]]);
  }
  let e = p.estadoResuelto();
  if (p.id === '4x4' || p.id === '5x5') { for (let i = 0; i < 40; i++) e = p.aplicarMovimiento(e, ['', '', 'w'].map((w) => 'URFDLB'[Math.floor(rng() * 6)] + w)[Math.floor(rng() * 3)] + ['', "'", '2'][Math.floor(rng() * 3)]); }
  for (let i = 0; i < 40; i++) e = p.aplicarMovimiento(e, 'URFDLB'[Math.floor(rng() * 6)] + ['', "'", '2'][Math.floor(rng() * 3)]);
  for (let i = 0; i < 3; i++) { const r = ROT[Math.floor(rng() * ROT.length)]; if (r) e = p.aplicarMovimiento(e, r); }
  return e;
}

const D_BLANCO_3 = (e) => e[31] === 0; // centro de D blanco
const OBJ = {
  '3x3': {
    prep: D_BLANCO_3,
    cruz: OBJETIVOS_3x3.cruz,
    capa1: OBJETIVOS_3x3.primeraCapa,
    capa2: OBJETIVOS_3x3.dosCapas,
    f2l: OBJETIVOS_3x3.dosCapas,
    cruzam: OBJETIVOS_3x3.cruzAmarilla,
    caraam: OBJETIVOS_3x3.caraAmarilla,
    oll: OBJETIVOS_3x3.caraAmarilla,
    esqam: OBJETIVOS_3x3.esquinasUltimaCapa,
    ariam: OBJETIVOS_3x3.resuelto,
    pll: OBJETIVOS_3x3.resuelto,
  },
  '2x2': {
    prep: (e) => [12, 13, 14, 15].some((f) => e[f] === 0),
    capa1: OBJETIVOS_2x2.primeraCapa,
    caraam: OBJETIVOS_2x2.caraAmarillaConCapa,
    esqam: OBJETIVOS_2x2.resuelto,
    cara: OBJETIVOS_2x2.caraBlanca,
    oll: OBJETIVOS_2x2.carasOpuestas,
    pbl: OBJETIVOS_2x2.resuelto,
  },
};
// 4x4: centros y aristas sobre el cubo; el resto, sobre el 3x3 virtual (esquinas, una pieza de cada arista y un centro)
const D4 = datosNxN(4);
const centroUniforme = (e, f, c) => D4.centros[f].every((i) => e[i] === (c ?? e[D4.centros[f][0]]));
const aristasHechas = (e) => D4.aristas.every(([a, b]) => a.every((i) => e[i] === e[a[0]]) && b.every((i) => e[i] === e[b[0]]));
const reducido = (e) => [0, 1, 2, 3, 4, 5].every((f) => centroUniforme(e, f)) && aristasHechas(e);
const V = (f) => (e) => reducido(e) && f(D4.virtual(e));
OBJ['4x4'] = {
  prep: () => true,
  'Centro blanco': (e) => centroUniforme(e, 3, 0),
  'Centro amarillo': (e) => centroUniforme(e, 3, 0) && centroUniforme(e, 0, 3),
  'Últimos cuatro centros': (e) => [0, 1, 2, 3, 4, 5].every((f) => centroUniforme(e, f)),
  aristas: reducido,
  'Paridad OLL': V((v) => OBJETIVOS_3x3.dosCapas(v) && !paridades3(v).orientacion),
  'Paridad PLL': V((v) => OBJETIVOS_3x3.caraAmarilla(v) && !paridades3(v).permutacion),
};
for (const [k, f] of Object.entries(OBJ['3x3'])) if (k !== 'prep') OBJ['4x4'][k] = V(f);

// 5x5: cada centro en dos partes (X y cruz); aristas de tres piezas; el resto, sobre el 3x3 virtual
const D5 = datosNxN(5);
const X5 = [0, 1, 2, 3, 4, 5].map((f) => [[1, 1], [1, 3], [3, 1], [3, 3]].map(([r, c]) => D5.idx(f, r, c)));
const medio5 = (e, f) => e[D5.idx(f, 2, 2)];
const x5 = (e, f) => X5[f].every((i) => e[i] === medio5(e, f));
const centro5 = (e, f) => D5.centros[f].every((i) => e[i] === medio5(e, f));
const aristas5 = (e) => D5.aristas.every(([a, b]) => a.every((i) => e[i] === e[a[0]]) && b.every((i) => e[i] === e[b[0]]));
const reducido5 = (e) => [0, 1, 2, 3, 4, 5].every((f) => centro5(e, f)) && aristas5(e);
const V5 = (f) => (e) => reducido5(e) && f(D5.virtual(e));
const lados5 = [1, 2, 4, 5];
OBJ['5x5'] = {
  prep: (e) => medio5(e, 3) === 0,
  'Centro blanco: X': (e) => medio5(e, 3) === 0 && x5(e, 3),
  'Centro blanco: cruz': (e) => medio5(e, 3) === 0 && centro5(e, 3),
  'Centro amarillo: X': (e) => medio5(e, 3) === 0 && centro5(e, 3) && x5(e, 0),
  'Centro amarillo: cruz': (e) => medio5(e, 3) === 0 && centro5(e, 3) && centro5(e, 0),
  'Últimos cuatro centros: X': (e) => centro5(e, 3) && centro5(e, 0) && lados5.every((f) => x5(e, f)),
  'Últimos cuatro centros: cruz': (e) => [0, 1, 2, 3, 4, 5].every((f) => centro5(e, f)),
  aristas: reducido5,
};
for (const [k, f] of Object.entries(OBJ['3x3'])) if (k !== 'prep') OBJ['5x5'][k] = V5(f);
OBJ['5x5'].Preparación = (e) => medio5(e, 3) === 0;

// Pyraminx: comprobaciones que no dependen de cómo esté girado el puzzle
{
  const { geo, modelo } = pyraminx;
  const [PUNTAS, CENTROS, ARISTAS] = modelo.orbitas.map((o) => o.piezas);
  const cara = (i) => geo.pegatinas[i].cara;
  const puntaOk = (e, v) => PUNTAS[v].every((i) => e[i] === e[CENTROS[v].find((j) => cara(j) === cara(i))]);
  const puntas = (e) => [0, 1, 2, 3].every((v) => puntaOk(e, v));
  const D = 3; // la cara de abajo (la opuesta al vértice U)
  const colorCara = (e, f) => { const v = [1, 2, 3].find((x) => CENTROS[x].some((j) => cara(j) === f)); return e[CENTROS[v].find((j) => cara(j) === f)]; };
  const centrosAbajo = (e) => new Set([1, 2, 3].map((v) => e[CENTROS[v].find((j) => cara(j) === D)])).size === 1;
  const piezaOk = (e, pz) => pz.every((i) => e[i] === colorCara(e, cara(i)));
  const capa1 = (e) => puntas(e) && centrosAbajo(e) && [1, 2, 3].every((v) => piezaOk(e, CENTROS[v]) && piezaOk(e, PUNTAS[v])) && [3, 4, 5].every((k) => piezaOk(e, ARISTAS[k]));
  OBJ.pyraminx = { puntas, centros: (e) => puntas(e) && centrosAbajo(e), capa1, ultima: (e) => pyraminx.estaResuelto(e) };
}
// Skewb: la esquina URF no se mueve; sus colores dan los de U, R y F (y los opuestos, los de D, L y B)
{
  const { geo, modelo } = skewb;
  const [CEN, A, B] = modelo.orbitas.map((o) => o.piezas);
  const cara = (i) => geo.pegatinas[i].cara;
  const colorCara = (e, f) => { const c = e[A[0].find((i) => cara(i) === f % 3)]; return f < 3 ? c : (c + 3) % 6; };
  const piezaOk = (e, pz) => pz.every((i) => e[i] === colorCara(e, cara(i)));
  const esquinasU = [...A, ...B].filter((pz) => pz.some((i) => cara(i) === 0));
  const capa1 = (e) => piezaOk(e, CEN[0]) && esquinasU.every((pz) => piezaOk(e, pz));
  OBJ.skewb = { capa1, esquinas: (e) => capa1(e) && [...A, ...B].every((pz) => piezaOk(e, pz)), centros: (e) => skewb.estaResuelto(e) };
}

// Square-1 (estado de colores: cada capa, sus piezas en orden; esquina = 3 colores, arista = 2)
{
  const R = square1.estadoResuelto();
  const ARRIBA = R.arriba.piezas[0][0], ABAJO = R.abajo.piezas[0][0];
  const cubo = (capa) => capa.piezas.length === 8 && capa.piezas.every((p, i) => p.length !== capa.piezas[(i + 1) % 8].length);
  const forma = (e) => cubo(e.arriba) && cubo(e.abajo);
  const orient = (e, n) => forma(e) && e.arriba.piezas.every((p) => p.length !== n || p[0] === ARRIBA) && e.abajo.piezas.every((p) => p.length !== n || p[0] === ABAJO);
  const co = (e) => orient(e, 3);
  const eo = (e) => co(e) && orient(e, 2);
  const ciclo = (capa) => capa.piezas.filter((p) => p.length === 3).map((p) => p.join(''));
  const mismoCiclo = (a, b) => [0, 1, 2, 3].some((k) => a.every((x, i) => x === b[(i + k) % 4]));
  const cp = (e) => eo(e) && e.medio === 0 && mismoCiclo(ciclo(e.arriba), ciclo(R.arriba)) && mismoCiclo(ciclo(e.abajo), ciclo(R.abajo));
  OBJ.square1 = { forma, co, eo, cp, paridad: cp, ep: (e) => square1.estaResuelto(e) };
}

// Etapas que tiene que tener cada método (en orden)
const ETAPAS = {
  '3x3/principiantes': ['cruz', 'capa1', 'capa2', 'cruzam', 'caraam', 'esqam', 'ariam'],
  '3x3/cfop': ['cruz', 'f2l', 'oll', 'pll'],
  '2x2/principiantes': ['capa1', 'caraam', 'esqam'],
  '2x2/ortega': ['cara', 'oll', 'pbl'],
  '4x4/principiantes': ['centros', 'aristas', 'cruz', 'capa1', 'capa2', 'paridad', 'cruzam', 'caraam', 'paridad', 'esqam', 'ariam'],
  '4x4/cfop': ['centros', 'aristas', 'cruz', 'f2l', 'paridad', 'oll', 'paridad', 'pll'],
  '5x5/principiantes': ['centros', 'aristas', 'cruz', 'capa1', 'capa2', 'cruzam', 'caraam', 'esqam', 'ariam'],
  '5x5/cfop': ['centros', 'aristas', 'cruz', 'f2l', 'oll', 'pll'],
  'pyraminx/principiantes': ['puntas', 'centros', 'capa1', 'ultima'],
  'skewb/principiantes': ['capa1', 'esquinas', 'centros'],
  'square1/principiantes': ['forma', 'co', 'eo', 'cp', 'paridad', 'ep'],
};

async function probarMetodo(p, metodo, semilla, paralelo = null) {
  const rng = rngConSemilla(semilla);
  const objetivos = OBJ[p.id];
  const stats = { casos: 0, resueltos: 0, giros: 0, giroMax: 0, rotaciones: 0, ms: 0, msMax: 0, porEtapa: {} };
  const estados = Array.from({ length: N_CASOS }, () => estadoAlAzar(p, rng));
  const resultados = paralelo
    ? (await resolverEnParalelo({ ...paralelo, estados, opciones: { aprender: metodo } })).resultados
    : estados.map((e) => { const t0 = Date.now(); const r = p.aprender(e, metodo); return { r, ms: Date.now() - t0 }; });
  for (let c = 0; c < N_CASOS; c++) {
    const e0 = estados[c];
    const { r, ms } = resultados[c];
    assert.ok(r.ok, 'ok');
    // etapas contiguas y en el orden del método (las vacías no aparecen)
    let pos = 0;
    const grupos = r.etapas.map((et) => et.grupo);
    const esperadas = ETAPAS[`${p.id}/${metodo}`];
    const sinPrep = grupos.filter((g, i) => g !== 'prep' && (i === 0 || g !== grupos[i - 1] || g === 'paridad'));
    let k = 0;
    for (const g of sinPrep) { while (k < esperadas.length && esperadas[k] !== g) k++; assert.ok(k < esperadas.length, `orden de las etapas (${grupos.join(', ')})`); k++; }
    // aplicar movimiento a movimiento, comprobando el objetivo al final de cada etapa
    let e = e0;
    for (const et of r.etapas) {
      assert.equal(et.inicio, pos, 'etapas contiguas');
      assert.ok(et.nombre && et.objetivo && et.objetivo.length > 20, 'etapa con nombre y objetivo');
      let b0 = et.inicio;
      for (const b of et.bloques) {
        assert.equal(b.inicio, b0, 'bloques contiguos');
        assert.ok(b.fin > b.inicio, 'bloque no vacío');
        assert.ok(typeof b.texto === 'string' && b.texto.length > 10, 'bloque con texto');
        b0 = b.fin;
      }
      assert.equal(b0, et.fin, 'los bloques cubren la etapa');
      for (let i = et.inicio; i < et.fin; i++) e = p.aplicarMovimiento(e, r.movimientos[i]);
      const obj = objetivos[et.nombre] || objetivos[et.grupo];
      assert.ok(obj, `objetivo para la etapa ${et.grupo}`);
      assert.ok(obj(e), `${p.id}/${metodo}, caso ${c}: tras la etapa "${et.nombre}" no se cumple su objetivo`);
      const s = (stats.porEtapa[et.nombre] = stats.porEtapa[et.nombre] || { suma: 0 });
      s.suma += et.fin - et.inicio;
      pos = et.fin;
    }
    assert.equal(pos, r.movimientos.length, 'las etapas cubren toda la solución');
    // y además: cada etapa esperada cumple su objetivo al final (aunque estuviera vacía)
    assert.ok(p.estaResuelto(e), `${p.id}/${metodo}, caso ${c}: no queda resuelto`);
    stats.casos++;
    stats.resueltos++;
    stats.giros += r.giros;
    stats.giroMax = Math.max(stats.giroMax, r.giros);
    stats.rotaciones += r.movimientos.length - r.giros;
    stats.ms += ms;
    stats.msMax = Math.max(stats.msMax, ms);
  }
  const res = {
    casos: stats.casos,
    resueltos: stats.resueltos,
    girosMedia: +(stats.giros / stats.casos).toFixed(2),
    girosMax: stats.giroMax,
    rotacionesMedia: +(stats.rotaciones / stats.casos).toFixed(2),
    msMedia: +(stats.ms / stats.casos).toFixed(1),
    msMax: stats.msMax,
    porEtapa: Object.fromEntries(Object.entries(stats.porEtapa).map(([k, v]) => [k, +(v.suma / stats.casos).toFixed(2)])),
  };
  guardarResultado('aprender', { [`${p.id}/${metodo}`]: res });
  assert.equal(stats.resueltos, N_CASOS);
}

const PARALELO_4 = { modulo: new URL('../src/puzzles/cubo-grande.js', import.meta.url).href, exportar: 'crearCuboGrande', args: [4] };
const cubo4 = crearCuboGrande(4);
test('aprender: 4x4 por reducción (3x3 por capas)', () => probarMetodo(cubo4, 'principiantes', 15, PARALELO_4));
test('aprender: 4x4 por reducción (3x3 con CFOP)', () => probarMetodo(cubo4, 'cfop', 16, PARALELO_4));
const PARALELO_5 = { modulo: new URL('../src/puzzles/cubo-grande.js', import.meta.url).href, exportar: 'crearCuboGrande', args: [5] };
const cubo5 = crearCuboGrande(5);
test('aprender: 5x5 por reducción (3x3 por capas)', () => probarMetodo(cubo5, 'principiantes', 17, PARALELO_5));
test('aprender: 5x5 por reducción (3x3 con CFOP)', () => probarMetodo(cubo5, 'cfop', 18, PARALELO_5));
test('aprender: Pyraminx por el método de principiantes', () => probarMetodo(pyraminx, 'principiantes', 19));
test('aprender: Skewb por el método de principiantes', () => probarMetodo(skewb, 'principiantes', 20));
test('aprender: Square-1 por el método de principiantes', () => probarMetodo(square1, 'principiantes', 21));
test('aprender: 3x3 por el método de principiantes', () => probarMetodo(cubo3, 'principiantes', 11));
test('aprender: 3x3 por CFOP', () => probarMetodo(cubo3, 'cfop', 12));
test('aprender: 2x2 por el método de principiantes', () => probarMetodo(cubo2, 'principiantes', 13));
test('aprender: 2x2 por Ortega', () => probarMetodo(cubo2, 'ortega', 14));

test('aprender: los algoritmos de OLL y PLL se comprueban y cubren todos los casos', () => {
  const a = algoritmosComprobados();
  assert.equal(a.pllOk.length, PLL.length, 'las 21 PLL respetan las dos capas y son de su familia');
  assert.ok(a.ollOk.length >= OLL.length - 1, 'las OLL respetan las dos capas');
  const M = motorCubo(3);
  const rng = rngConSemilla(3);
  // todos los estados de orientación de la última capa (216) desde las dos capas hechas
  const gen = ['U', "R U R' U R U2 R'", "F R U R' U' F'", "R' F R' B2 R F' R' B2 R2"].map((s) => s.split(' '));
  const genP = ['U', "R U' R U R U R U' R' U' R2", "R' F R' B2 R F' R' B2 R2", "R U R' U' R' F R2 U' R' U' R U R' F'"].map((s) => s.split(' '));
  const orient = new Map(), perm = new Map();
  let e = a.base;
  for (let i = 0; i < 100000 && orient.size < 216; i++) {
    e = M.aplicarSec(e, gen[Math.floor(rng() * gen.length)]);
    const k = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47].map((f) => (e[f] === 3 ? 1 : 0)).join('');
    if (!orient.has(k)) orient.set(k, e);
  }
  e = a.base;
  for (let i = 0; i < 100000 && perm.size < 288; i++) {
    e = M.aplicarSec(e, genP[Math.floor(rng() * genP.length)]);
    if (!perm.has(e.join(''))) perm.set(e.join(''), e);
  }
  assert.equal(orient.size, 216, 'casos de orientación');
  assert.equal(perm.size, 288, 'casos de permutación');
  const mOLL = a.ollOk.map((o) => ({ nombre: o.alg, movs: o.movs }));
  // un ajuste de U (o ninguno) y UNA sola OLL: cada uno de los 216 casos tiene su algoritmo
  const ajustes = [[], ['U'], ["U'"], ['U2']];
  for (const est of orient.values()) {
    assert.ok(OBJETIVOS_3x3.caraAmarilla(est) || ajustes.some((a) => mOLL.some((o) => OBJETIVOS_3x3.caraAmarilla(M.aplicarSec(M.aplicarSec(est, a), o.movs)))), `OLL en un algoritmo: ${[0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47].map((f) => (est[f] === 3 ? 1 : 0)).join('')}`);
  }
  const mPLL = a.pllOk.map((o) => ({ nombre: o.nombre, movs: o.movs }));
  for (const est of perm.values()) assert.ok(M.buscarMacros(est, [...AJUSTES_U, ...mPLL], OBJETIVOS_3x3.resuelto, 3), 'PLL en un algoritmo');
});

test('aprender: un estado ya resuelto no da movimientos (salvo, como mucho, girar el cubo)', () => {
  for (const [p, metodos] of [[cubo3, ['principiantes', 'cfop']], [cubo2, ['principiantes', 'ortega']]]) {
    for (const m of metodos) {
      const r = p.aprender(p.estadoResuelto(), m);
      assert.ok(r.giros === 0, `${p.id}/${m}: ${r.movimientos.join(' ')}`);
      assert.ok(p.estaResuelto(p.aplicarSecuencia(p.estadoResuelto(), r.movimientos)));
    }
  }
});
