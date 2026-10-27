// Cubos grandes (4x4..7x7): scrambles de movimientos aleatorios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearNxN, geometriaNxN, LONGITUD_WCA } from '../src/puzzles/nxn.js';
import { probarScrambles, guardarResultado } from './util.mjs';
import { potencia, esIdentidad } from '../src/core/perm.js';

test('NxN: los movimientos tienen el orden correcto', () => {
  for (const N of [2, 3, 4, 5, 6, 7]) {
    const p = crearNxN(N);
    const g = geometriaNxN(N);
    for (const cara of ['U', 'R', 'F', 'D', 'L', 'B']) {
      for (let prof = 1; prof <= Math.max(1, N - 1); prof++) {
        assert.ok(esIdentidad(potencia(g.cuarto(cara, prof), 4)), `${N}x${N} ${cara}${prof}^4`);
      }
    }
    // (R U R' U')^6 = identidad
    let e = p.estadoResuelto();
    for (let i = 0; i < 6; i++) e = p.aplicarSecuencia(e, ['R', 'U', "R'", "U'"]);
    assert.ok(p.estaResuelto(e));
    // un movimiento y su inverso se cancelan
    const m = N >= 4 ? 'Rw' : 'R';
    assert.ok(p.estaResuelto(p.aplicarSecuencia(p.estadoResuelto(), [m, p.invertirMovimiento(m)])));
  }
});

for (const N of [4, 5, 6, 7]) {
  test(`${N}x${N}: scrambles WCA (${LONGITUD_WCA[N]} movimientos, sin redundancias)`, () => {
    const p = crearNxN(N);
    const r = probarScrambles(p, 10 + N);
    assert.equal(r.longitudMin, LONGITUD_WCA[N]);
    assert.equal(r.longitudMax, LONGITUD_WCA[N]);
    guardarResultado(`${N}x${N}`, r);
  });
}

test('NxN: notación de capas anchas', () => {
  const p6 = crearNxN(6);
  assert.deepEqual(p6.parsear("3Rw2 Uw' F"), ['3Rw2', "Uw'", 'F']);
  assert.throws(() => p6.aplicarMovimiento(p6.estadoResuelto(), 'X'));
  // en 4x4 se usan Rw pero no 3Rw en los scrambles
  const p4 = crearNxN(4);
  const s = p4.generarScramble(Math.random);
  assert.ok(s.every((m) => !/^3/.test(m)));
  assert.ok(crearNxN(7).generarScramble(Math.random).length === 100);
});
