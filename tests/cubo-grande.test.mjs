// Cubos grandes (4x4..7x7): validador y solver por reducción.
// Casos: 1000 en 4x4/5x5 y 200 en 6x6/7x7 con `npm test`; 20 por tamaño con `npm run test:rapido`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCuboGrande } from '../src/puzzles/cubo-grande.js';
import { geometriaNxN } from '../src/puzzles/nxn.js';
import { modeloPiezasNxN } from '../src/puzzles/nxn-piezas.js';
import { aplicarPerm } from '../src/core/perm.js';
import { rngConSemilla, entero } from '../src/core/rng.js';
import { CASOS, probarScrambles, debeRechazar, guardarResultado } from './util.mjs';

const completo = CASOS >= 1000;
const casosDe = (N) => (process.env.CASOS_NXN ? +process.env.CASOS_NXN : completo ? (N <= 5 ? 1000 : 200) : 20);
const TAMANOS = [4, 5, 6, 7];
const puzzles = Object.fromEntries(TAMANOS.map((N) => [N, crearCuboGrande(N)]));

const rotarAzar = (N) => (e, rng) => {
  const g = geometriaNxN(N);
  let r = e;
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, g.rot.x);
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, g.rot.y);
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, g.rot.z);
  return r;
};

const est = (xs) => ({ media: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2), max: +Math.max(...xs).toFixed(1) });

for (const N of TAMANOS) {
  const p = puzzles[N];
  const casos = casosDe(N);

  test(`${N}x${N}: tablas (conmutadores puros y setups)`, () => {
    const r = p.inicializar();
    const { tablas, orbitas } = p._interno();
    tablas.porOrbita.forEach((t, oi) => {
      if (!t) return;
      assert.ok(t.nBases > 0, `${orbitas[oi].nombre}: hay 3-ciclos puros`);
      // todos los tríos ordenados de posiciones distintas se pueden ciclar
      let alcanzables = 0;
      for (let a = 0; a < 24; a++) for (let b = 0; b < 24; b++) for (let c = 0; c < 24; c++) {
        if (a !== b && b !== c && a !== c && t.coste[t.idx(a, b, c)] >= 0) alcanzables++;
      }
      assert.equal(alcanzables, 24 * 23 * 22, `${orbitas[oi].nombre}: todos los 3-ciclos`);
    });
    if (N % 2 === 0) assert.ok(tablas.pll, 'el algoritmo de paridad PLL se ha verificado');
    guardarResultado(`${N}x${N}`, { msTablas: r.ms, longitudConmutador: Math.min(...tablas.porOrbita.filter(Boolean).map((t) => t.longitudBase)) });
  });

  test(`${N}x${N}: los scrambles producen estados válidos`, () => {
    const r = probarScrambles(p, 10 + N); // usa el validador en cada scramble
    assert.equal(r.longitudMin, r.longitudMax);
  });

  test(`${N}x${N}: el solver resuelve el 100 % (${casos} casos, cubo reorientado al azar)`, () => {
    const rng = rngConSemilla(100 + N);
    const rotar = rotarAzar(N);
    const L = [], T = [], fasesL = {}, fasesT = {};
    for (let i = 0; i < casos; i++) {
      const s = p.generarScramble(rng);
      const e = rotar(p.aplicarSecuencia(p.estadoResuelto(), s), rng);
      const t0 = performance.now();
      const r = p.resolver(e);
      const dt = performance.now() - t0;
      assert.ok(r.ok, `caso ${i}: ${(r.errores || []).join(' | ')}`);
      // aplicar movimiento a movimiento con el modelo de pegatinas
      let x = e;
      for (const m of r.movimientos) x = p.aplicarMovimiento(x, m);
      assert.ok(p.estaResuelto(x), `caso ${i}: no queda resuelto\n${p.formatear(s)}`);
      const red = p.buscarRedundanciaSolucion(r.movimientos);
      assert.equal(red, null, `caso ${i}: ${red}`);
      // las fases cubren la solución entera, en orden y sin huecos
      let k = 0;
      for (const f of r.fases) { assert.equal(f.inicio, k); assert.ok(f.fin > f.inicio); k = f.fin; }
      assert.equal(k, r.movimientos.length);
      L.push(r.movimientos.length); T.push(dt);
      const porFase = {};
      for (const f of r.fases) porFase[f.nombre] = (porFase[f.nombre] || 0) + f.fin - f.inicio;
      for (const f of ['paridad', 'centros', 'aristas', '3x3']) {
        (fasesL[f] = fasesL[f] || []).push(porFase[f] || 0);
        (fasesT[f] = fasesT[f] || []).push((r.msFases && r.msFases[f]) || 0);
      }
    }
    const res = {
      resueltos: `${casos}/${casos} (100.0%)`,
      casosSolver: casos,
      longitudMediaSolucion: est(L).media,
      longitudMaxSolucion: Math.max(...L),
      msMedioSolucion: est(T).media,
      msMaxSolucion: est(T).max,
      fases: Object.fromEntries(Object.keys(fasesL).map((f) => [f, {
        longitudMedia: est(fasesL[f]).media, longitudMax: Math.max(...fasesL[f]),
        msMedio: est(fasesT[f]).media, msMax: est(fasesT[f]).max,
        casosConFase: fasesL[f].filter((x) => x > 0).length,
      }])),
    };
    guardarResultado(`${N}x${N}`, res);
  });

  test(`${N}x${N}: estados imposibles (según las restricciones demostradas) y posibles`, () => {
    const { orbitas, fijos } = modeloPiezasNxN(N);
    const orb = (tipo, k = 0) => orbitas.filter((o) => o.tipo === tipo)[k];
    const base = p.aplicarSecuencia(p.estadoResuelto(), p.parsear('R U2 F\' L D B2 R\' U Rw Uw\' Fw2'));
    const inter = (e, pares) => { const r = e.slice(); for (const [a, b] of pares) [r[a], r[b]] = [e[b], e[a]]; return r; };
    const piezaInter = (e, A, B) => inter(e, A.map((f, j) => [f, B[j]]));
    const aceptaYResuelve = (e, que) => {
      const v = p.validar(e);
      assert.ok(v.valido, `${que} debería ser posible: ${v.errores.join(' | ')}`);
      const r = p.resolver(e);
      assert.ok(r.ok && p.estaResuelto(p.aplicarSecuencia(e, r.movimientos)), `${que}: se resuelve`);
    };
    const E = orb('esquinas'), W = orb('wings');
    const msgs = [];
    // esquina girada
    const g = base.slice(); const c0 = E.piezas[0]; [g[c0[0]], g[c0[1]], g[c0[2]]] = [base[c0[2]], base[c0[0]], base[c0[1]]];
    msgs.push(debeRechazar(p, g, 'girada'));
    // wing volteada en su sitio
    msgs.push(debeRechazar(p, inter(base, [W.piezas[3]]), 'posición imposible'));
    // wing inexistente (dos colores de caras opuestas): cambiar pegatinas entre la wing UF y la DF
    {
      const r0 = p.estadoResuelto();
      const uf = W.piezas.find((_, j) => W.nombresPos[j].startsWith('UF '));
      const df = W.piezas.find((pz, j) => W.nombresPos[j].startsWith('DF ') && pz.some((f) => r0[f] === 2));
      const fU = uf.find((f) => r0[f] === 2), fD = df.find((f) => r0[f] === 3);
      msgs.push(debeRechazar(p, inter(r0, [[fU, fD]]), 'no existe'));
    }
    // conteo de colores
    const cc = base.slice(); cc[0] = (cc[0] + 1) % 6;
    msgs.push(debeRechazar(p, cc, `debería haber ${N * N}`));
    // dos wings intercambiadas: POSIBLE (no hay restricción de paridad de wings)
    aceptaYResuelve(piezaInter(base, W.piezas[0], W.piezas[5]), 'dos wings intercambiadas');
    // dos centros de colores distintos intercambiados en una órbita: POSIBLE
    const C = orb('centros');
    const ci = C.piezas.findIndex((pz) => base[pz[0]] !== base[C.piezas[0][0]]);
    aceptaYResuelve(piezaInter(base, C.piezas[0], C.piezas[ci]), 'dos centros intercambiados');
    // centros de dos órbitas distintas mezclados: faltan/sobran
    const C2 = orbitas.filter((o) => o.tipo === 'centros')[1];
    if (C2) {
      const r0 = p.estadoResuelto();
      const j2 = C2.piezas.findIndex((pz) => r0[pz[0]] === 1);
      msgs.push(debeRechazar(p, inter(r0, [[C.piezas[0][0], C2.piezas[j2][0]]]), 'Faltan centros'));
    }
    if (N % 2) {
      const A = orb('aristas');
      // arista central volteada; dos aristas centrales intercambiadas; dos esquinas intercambiadas
      msgs.push(debeRechazar(p, inter(base, [A.piezas[1]]), 'volteada'));
      msgs.push(debeRechazar(p, piezaInter(base, A.piezas[0], A.piezas[1]), 'intercambiadas'));
      msgs.push(debeRechazar(p, piezaInter(base, E.piezas[0], E.piezas[1]), 'intercambiadas'));
      // centros fijos en disposición especular y no opuestos
      msgs.push(debeRechazar(p, inter(p.estadoResuelto(), [[fijos[1], fijos[4]]]), 'especular'));
      msgs.push(debeRechazar(p, inter(p.estadoResuelto(), [[fijos[0], fijos[1]]]), 'opuestos'));
    } else {
      // N par: dos esquinas intercambiadas es POSIBLE (paridad PLL) y una arista entera volteada también (paridad OLL)
      aceptaYResuelve(piezaInter(base, E.piezas[0], E.piezas[1]), 'dos esquinas intercambiadas');
      // arista UF entera volteada (todas sus wings)
      const r0 = p.estadoResuelto();
      const vol = r0.slice();
      for (const o of orbitas.filter((x) => x.tipo === 'wings')) {
        o.piezas.forEach((pz, j) => { if (o.nombresPos[j].startsWith('UF ')) { vol[pz[0]] = r0[pz[1]]; vol[pz[1]] = r0[pz[0]]; } });
      }
      aceptaYResuelve(vol, 'arista UF entera volteada');
    }
    console.log('  ' + msgs.join('\n  '));
  });
}

test('NxN: estado resuelto, resuelto reorientado y validador en la orientación pintada', () => {
  for (const N of TAMANOS) {
    const p = puzzles[N];
    const r = p.resolver(p.estadoResuelto());
    assert.ok(r.ok && r.movimientos.length === 0, `${N}x${N}: resuelto -> 0 movimientos`);
    const rot = aplicarPerm(p.estadoResuelto(), geometriaNxN(N).rot.x);
    const r2 = p.resolver(rot);
    assert.ok(r2.ok && r2.movimientos.length === 0, `${N}x${N}: girado -> 0 movimientos`);
  }
});
