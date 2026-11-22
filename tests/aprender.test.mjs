// Modo aprender: soluciones por métodos humanos (2x2 y 3x3).
//  - 100 % de soluciones correctas, aplicadas movimiento a movimiento con el modelo de pegatinas.
//  - Tras cada etapa, el estado cumple el objetivo de esa etapa (comprobado con objetivos-cubo.js).
//  - Etapas y bloques contiguos que cubren toda la solución, con texto; algoritmos con nombre.
//  - Los algoritmos de la última capa cubren todos los casos (OLL: 216, PLL: 288).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, casosPor, guardarResultado } from './util.mjs';
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
import { estadoAlAzar, comprobarCasoAprender } from './aprender-comprobar.mjs';

const N_CASOS = Math.min(CASOS, 500);
// rápido: en el 4x4 y el 5x5 cada caso es una reducción completa (~1 s) y en el Square-1 una
// búsqueda por etapa; en los demás 100 casos cuestan poco
const casosMetodo = (p) => casosPor(N_CASOS, { '4x4': 8, '5x5': 8, square1: 40 }[p.id] ?? N_CASOS, 'CASOS_APRENDER');
async function probarMetodo(p, metodo, semilla, paralelo = null) {
  const rng = rngConSemilla(semilla);
  const n = casosMetodo(p);
  const stats = { casos: 0, resueltos: 0, giros: 0, giroMax: 0, rotaciones: 0, ms: 0, msMax: 0, porEtapa: {} };
  const estados = Array.from({ length: n }, () => estadoAlAzar(p, rng));
  const resultados = paralelo
    ? (await resolverEnParalelo({ ...paralelo, estados, opciones: { aprender: metodo } })).resultados
    : estados.map((e) => { const t0 = Date.now(); const r = p.aprender(e, metodo); return { r, ms: Date.now() - t0 }; });
  for (let c = 0; c < n; c++) {
    const e0 = estados[c];
    const { r, ms } = resultados[c];
    for (const [k, v] of Object.entries(comprobarCasoAprender(p, metodo, e0, r, c))) {
      const s = (stats.porEtapa[k] = stats.porEtapa[k] || { suma: 0 });
      s.suma += v;
    }
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
  assert.equal(stats.resueltos, n);
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
