// Skewb: scrambles de estado aleatorio, validador y solucionador óptimo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p from '../src/puzzles/skewb.js';
import { aplicarPerm } from '../src/core/perm.js';
import { entero } from '../src/core/rng.js';
import { probarScrambles, probarSolver, debeRechazar, guardarResultado } from './util.mjs';

const [centros, esqA, esqB] = p.modelo.orbitas.map((o) => o.piezas);

test('Skewb: geometría (30 pegatinas, giros de orden 3, URF fija)', () => {
  assert.equal(p.estadoResuelto().length, 30);
  for (const m of ['R', 'U', 'L', 'B']) {
    assert.ok(p.estaResuelto(p.aplicarSecuencia(p.estadoResuelto(), [m, m, m])), m);
    const e = p.aplicarMovimiento(p.estadoResuelto(), m);
    assert.ok(esqA[0].every((f) => e[f] === p.estadoResuelto()[f]), 'URF no se mueve con ' + m);
  }
  assert.equal(p.geo.rotaciones.length, 24);
});

test('Skewb: 3.149.280 estados (centros y esquinas independientes)', () => {
  const bus = p.obtenerBuscador();
  const nM = bus.movs.length;
  const tams = [720, 24, 81, 24, 81];
  const cod = (v) => v.reduce((a, x, k) => a * tams[k] + x, 0);
  const ini = [0, 0, 0, 0, 0];
  const visto = new Set([cod(ini)]);
  let frontera = [ini];
  let prof = 0;
  while (frontera.length) {
    const sig = [];
    for (const v of frontera) for (let m = 0; m < nM; m++) {
      const w = v.map((x, k) => bus.tablas[k][x * nM + m]);
      const c = cod(w);
      if (!visto.has(c)) { visto.add(c); sig.push(w); }
    }
    frontera = sig;
    if (sig.length) prof++;
  }
  const r = visto.size;
  assert.equal(prof, 11, 'número de Dios del Skewb: 11');
  // las esquinas alcanzables por separado son 8748 = 3149280 / 360: no hay acoplamiento con los centros
  assert.equal(bus.tablasPoda[2].alcanzables, 8748);
  assert.equal(r, 3149280);
});

test('Skewb: scrambles de estado aleatorio válidos y sin redundancias', () => {
  const r = probarScrambles(p, 51);
  guardarResultado('skewb', r);
});

const rotarAzar = (e, i, rng) => aplicarPerm(e, p.geo.rotaciones[entero(rng, 24)]);

test('Skewb: el solver resuelve el 100% (puzzle reorientado al azar)', () => {
  const r = probarSolver(p, { semilla: 52, transformar: rotarAzar });
  assert.ok(r.longitudMaxSolucion <= 11, 'el número de Dios del Skewb es 11');
  guardarResultado('skewb', r);
});

test('Skewb: estados imposibles', () => {
  const base = p.aplicarSecuencia(p.estadoResuelto(), p.parsear("R U' L B R' U"));
  const inter = (e, pares) => { const r = e.slice(); for (const [a, b] of pares) [r[a], r[b]] = [e[b], e[a]]; return r; };
  // esquina girada (DBL)
  const k = esqB[3];
  const g = base.slice(); [g[k[0]], g[k[1]], g[k[2]]] = [base[k[2]], base[k[0]], base[k[1]]];
  console.log('  girada:', debeRechazar(p, g, 'girada'));
  // dos centros intercambiados
  console.log('  centros:', debeRechazar(p, inter(base, [[centros[0][0], centros[1][0]]]), 'centros'));
  // dos esquinas de la tétrada B intercambiadas
  const [b0, b1] = [esqB[0], esqB[1]];
  const sw = inter(base, [[b0[0], b1[0]], [b0[1], b1[1]], [b0[2], b1[2]]]);
  console.log('  esquinas:', debeRechazar(p, sw, 'esquina'));
  // esquina especular
  console.log('  espejo:', debeRechazar(p, inter(base, [[k[0], k[1]]]), 'especular'));
  const c = base.slice(); c[0] = (c[0] + 1) % 6;
  debeRechazar(p, c, 'debería haber 5');
});
