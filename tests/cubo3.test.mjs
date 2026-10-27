// 3x3: scrambles de estado aleatorio, validador y algoritmo de dos fases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p from '../src/puzzles/cubo3.js';
import { geometriaNxN, baseNxN } from '../src/puzzles/nxn.js';
import { piezasCubo } from '../src/puzzles/cubo-comun.js';
import * as K from '../src/puzzles/kociemba.js';
import { crearModeloPiezas } from '../src/core/piezas.js';
import { aplicarPerm } from '../src/core/perm.js';
import { entero } from '../src/core/rng.js';
import { probarScrambles, probarSolver, debeRechazar, guardarResultado } from './util.mjs';

const geo = geometriaNxN(3);

test('3x3: las tablas de cubies de Kociemba coinciden con el modelo de pegatinas', () => {
  const b = baseNxN(3);
  const { esquinas, aristas } = piezasCubo(3);
  // pegatinas de las piezas en el orden de Kociemba (U1=0 ... B9=53)
  assert.deepEqual(esquinas, [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]]);
  assert.deepEqual(aristas[0], [5, 10]);
  const m = crearModeloPiezas({ orbitas: [{ nombre: 'e', piezas: esquinas }, { nombre: 'a', piezas: aristas }], movimientos: {}, coloresResuelto: b.estadoResuelto() });
  K.NOMBRES_MOV.forEach((nom, i) => {
    const id = m.identificar(b.aplicarMovimiento(b.estadoResuelto(), nom));
    const c = K.cuboDesdeIdentificacion(id.orbitas);
    const k = K.MOV_CUBO[i];
    assert.deepEqual(c, { cp: k.cp, co: k.co, ep: k.ep, eo: k.eo }, nom);
  });
});

test('3x3: generación de tablas en tiempo de ejecución', () => {
  const t = performance.now();
  p.inicializar();
  const ms = p.inicializar().ms || Math.round(performance.now() - t);
  console.log(`  tablas de Kociemba: ${ms} ms`);
  guardarResultado('3x3', { msTablas: ms });
});

test('3x3: scrambles de estado aleatorio válidos y sin redundancias', () => {
  const r = probarScrambles(p, 31);
  assert.ok(r.longitudMax <= 22);
  guardarResultado('3x3', r);
});

const rotarAzar = (e, i, rng) => {
  let r = e;
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, geo.rot.x);
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, geo.rot.y);
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, geo.rot.z);
  return r;
};

test('3x3: el solver de dos fases resuelve el 100% (cubo reorientado al azar)', () => {
  const r = probarSolver(p, { semilla: 32, transformar: rotarAzar });
  guardarResultado('3x3', r);
});

test('3x3: estados imposibles', () => {
  const base = p.aplicarSecuencia(p.estadoResuelto(), p.parsear("R U2 F' L D B2 R' U"));
  const intercambiar = (e, pares) => { const r = e.slice(); for (const [a, b] of pares) [r[a], r[b]] = [e[b], e[a]]; return r; };
  // arista UF volteada
  console.log('  volteada:', debeRechazar(p, intercambiar(base, [[7, 19]]), 'volteada'));
  // aristas UF y UR intercambiadas
  console.log('  intercambio:', debeRechazar(p, intercambiar(base, [[7, 5], [19, 10]]), 'intercambiadas'));
  // esquinas URF y UFL intercambiadas
  debeRechazar(p, intercambiar(base, [[8, 6], [9, 18], [20, 38]]), 'intercambiadas');
  // esquina URF girada
  const g = base.slice(); [g[8], g[9], g[20]] = [base[20], base[8], base[9]];
  console.log('  girada:', debeRechazar(p, g, 'girada'));
  // dos esquinas giradas en el mismo sentido
  const g2 = g.slice(); [g2[6], g2[18], g2[38]] = [g[38], g[6], g[18]];
  debeRechazar(p, g2, 'girada');
  // centros en disposición especular (rojo y naranja cambiados)
  console.log('  centros:', debeRechazar(p, intercambiar(p.estadoResuelto(), [[13, 40]]), 'especular'));
  // centros opuestos mal
  debeRechazar(p, intercambiar(p.estadoResuelto(), [[4, 13]]), 'opuestos');
  // pieza inexistente: arista blanco-amarillo
  const r = p.estadoResuelto(); [r[19], r[28]] = [r[28], r[19]];
  console.log('  inexistente:', debeRechazar(p, r, 'no existe'));
  // conteo
  const c = base.slice(); c[0] = (c[0] + 1) % 6;
  debeRechazar(p, c, 'debería haber 9');
});

test('3x3: superflip (caso difícil, simétrico) y estado resuelto', () => {
  const sf = p.parsear("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
  const e = p.aplicarSecuencia(p.estadoResuelto(), sf);
  const r = p.resolver(e, { objetivo: 20, msMax: 3000 });
  assert.ok(r.ok);
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e, r.movimientos)));
  console.log(`  superflip: ${r.movimientos.length} movimientos en ${r.ms.toFixed(0)} ms`);
  const r0 = p.resolver(p.estadoResuelto());
  assert.ok(r0.ok && r0.movimientos.length === 0);
});
