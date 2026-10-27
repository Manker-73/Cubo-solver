// 2x2: scrambles de estado aleatorio, validador y solucionador óptimo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p from '../src/puzzles/cubo2.js';
import { geometriaNxN } from '../src/puzzles/nxn.js';
import { aplicarPerm } from '../src/core/perm.js';
import { entero } from '../src/core/rng.js';
import { probarScrambles, probarSolver, debeRechazar, guardarResultado } from './util.mjs';

const geo = geometriaNxN(2);
const rotarAzar = (e, i, rng) => {
  // reorientar el cubo entero (como si el usuario lo sujetara de otra forma)
  let r = e;
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, geo.rot.x);
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, geo.rot.y);
  for (let k = entero(rng, 4); k > 0; k--) r = aplicarPerm(r, geo.rot.z);
  return r;
};

test('2x2: scrambles de estado aleatorio válidos y sin redundancias', () => {
  const r = probarScrambles(p, 21);
  assert.ok(r.longitudMin >= 4);
  guardarResultado('2x2', r);
});

test('2x2: el solver resuelve el 100% (con el cubo reorientado al azar)', () => {
  const r = probarSolver(p, { semilla: 22, transformar: rotarAzar });
  assert.ok(r.longitudMaxSolucion <= 11, 'el 2x2 se resuelve siempre en 11 movimientos o menos (HTM)');
  guardarResultado('2x2', r);
});

test('2x2: estados imposibles', () => {
  const base = p.aplicarSecuencia(p.estadoResuelto(), p.parsear("R U2 F' R U'"));
  // esquina girada: rotar las pegatinas de la esquina URF (8? -> índices de la pieza)
  const girada = base.slice();
  // pegatinas de la esquina URF en un 2x2: U(1,1)=3, R(0,0)=4, F(0,1)=9
  [girada[3], girada[4], girada[9]] = [base[9], base[3], base[4]];
  console.log('  girada:', debeRechazar(p, girada, 'girada'));
  // dos pegatinas de una esquina intercambiadas -> pieza especular
  const espejo = base.slice();
  [espejo[3], espejo[4]] = [base[4], base[3]];
  console.log('  espejo:', debeRechazar(p, espejo, 'imagen especular'));
  // pegatinas de más de un color
  const conteo = base.slice();
  conteo[0] = (conteo[0] + 1) % 6;
  console.log('  conteo:', debeRechazar(p, conteo, 'debería haber 4'));
  // esquina con colores opuestos (blanco y amarillo)
  const opuestos = p.estadoResuelto();
  [opuestos[4], opuestos[12]] = [opuestos[12], opuestos[4]]; // URF queda blanco-amarillo-verde
  debeRechazar(p, opuestos, 'no existe');
});

test('2x2: intercambiar dos esquinas SÍ es posible (no hay paridad)', () => {
  // intercambio de dos esquinas = estado alcanzable en el 2x2
  const e = p.aplicarSecuencia(p.estadoResuelto(), p.parsear("R U R' U' R' F R2 U' R' U' R U R' F'")); // T-perm
  assert.ok(p.validar(e).valido);
  const r = p.resolver(e);
  assert.ok(r.ok && p.estaResuelto(p.aplicarSecuencia(e, r.movimientos)));
});
