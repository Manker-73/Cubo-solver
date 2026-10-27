// Pyraminx: scrambles de estado aleatorio, validador y solucionador óptimo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p from '../src/puzzles/pyraminx.js';
import { aplicarPerm } from '../src/core/perm.js';
import { entero } from '../src/core/rng.js';
import { probarScrambles, probarSolver, debeRechazar, guardarResultado } from './util.mjs';

const [puntas, centros, aristas] = p.modelo.orbitas.map((o) => o.piezas);

test('Pyraminx: geometría (36 pegatinas, movimientos de orden 3)', () => {
  assert.equal(p.estadoResuelto().length, 36);
  for (const m of ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b']) {
    let e = p.estadoResuelto();
    e = p.aplicarSecuencia(e, [m, m, m]);
    assert.ok(p.estaResuelto(e), m);
    assert.ok(!p.estaResuelto(p.aplicarMovimiento(p.estadoResuelto(), m)));
  }
  assert.equal(p.geo.rotaciones.length, 12);
});

test('Pyraminx: el espacio de estados (sin puntas) tiene 933.120 estados', () => {
  const tp = p.obtenerBuscador().tablasPoda[0];
  assert.equal(tp.alcanzables, 933120);
  assert.equal(tp.profMax, 11, 'número de Dios del Pyraminx sin puntas: 11');
});

test('Pyraminx: scrambles de estado aleatorio válidos y sin redundancias', () => {
  const r = probarScrambles(p, 41);
  guardarResultado('pyraminx', r);
});

const rotarAzar = (e, i, rng) => aplicarPerm(e, p.geo.rotaciones[entero(rng, 12)]);

test('Pyraminx: el solver resuelve el 100% (puzzle reorientado al azar)', () => {
  const r = probarSolver(p, { semilla: 42, transformar: rotarAzar });
  assert.ok(r.longitudMaxSolucion <= 15, 'máximo 11 movimientos + 4 puntas');
  guardarResultado('pyraminx', r);
});

test('Pyraminx: estados imposibles', () => {
  const base = p.aplicarSecuencia(p.estadoResuelto(), p.parsear("U L' R B U' l r'"));
  const inter = (e, pares) => { const r = e.slice(); for (const [a, b] of pares) [r[a], r[b]] = [e[b], e[a]]; return r; };
  const [a0, a1] = [aristas[0], aristas[3]];
  console.log('  volteada:', debeRechazar(p, inter(base, [[a0[0], a0[1]]]), 'volteada'));
  console.log('  intercambio:', debeRechazar(p, inter(base, [[a0[0], a1[0]], [a0[1], a1[1]]]), 'intercambiadas'));
  // punta con los colores en orden especular
  const t = puntas[0];
  console.log('  espejo:', debeRechazar(p, inter(base, [[t[0], t[1]]]), 'especular'));
  // dos puntas intercambiadas (cada una en un vértice que no es el suyo)
  const [t0, t1] = [puntas[0], puntas[1]];
  const sw = inter(p.estadoResuelto(), [[t0[0], t1[0]], [t0[1], t1[1]], [t0[2], t1[2]]]);
  const v = p.validar(sw);
  assert.equal(v.valido, false);
  console.log('  puntas:', v.errores.join(' | '));
  // conteo
  const c = base.slice(); c[0] = (c[0] + 1) % 4;
  debeRechazar(p, c, 'debería haber 9');
});

test('Pyraminx: centro girado SÍ es posible', () => {
  // girar una pieza central = mover su capa y deshacer la punta... basta con "U u'"
  const e = p.aplicarSecuencia(p.estadoResuelto(), ['U', "u'"]);
  assert.ok(p.validar(e).valido);
  void centros;
});
