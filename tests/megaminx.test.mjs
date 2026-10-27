// Megaminx: scrambles Pochmann (WCA 12d) y modelo de pegatinas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p from '../src/puzzles/megaminx.js';
import { rngConSemilla } from '../src/core/rng.js';
import { probarScrambles, guardarResultado, CASOS } from './util.mjs';

test('Megaminx: 132 pegatinas, 11 por cara, giros de orden 5', () => {
  const e0 = p.estadoResuelto();
  assert.equal(e0.length, 132);
  for (let f = 0; f < 12; f++) assert.equal(e0.filter((c) => c === f).length, 11);
  for (const m of ['U', 'R++', 'D++']) {
    let e = e0;
    for (let i = 0; i < 5; i++) { e = p.aplicarMovimiento(e, m); if (i < 4) assert.ok(!p.estaResuelto(e), m); }
    assert.ok(p.estaResuelto(e), m + '^5');
  }
  // R++ R-- se cancelan; R++ R++ = R--^3 ...
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e0, ['R++', 'R--'])));
});

test('Megaminx: scrambles con el formato de Pochmann', () => {
  const r = probarScrambles(p, 61);
  assert.equal(r.longitudMin, 77);
  assert.equal(r.longitudMax, 77);
  const rng = rngConSemilla(62);
  for (let i = 0; i < CASOS; i++) {
    const s = p.generarScramble(rng);
    const lineas = p.formatear(s).split('\n');
    assert.equal(lineas.length, 7);
    for (const l of lineas) {
      const t = l.split(' ');
      assert.equal(t.length, 11);
      t.slice(0, 10).forEach((m, k) => assert.match(m, k % 2 === 0 ? /^R(\+\+|--)$/ : /^D(\+\+|--)$/));
      assert.equal(t[10], t[9] === 'D++' ? 'U' : "U'", 'U tras D++, U\' tras D--');
    }
    const e = p.aplicarSecuencia(p.estadoResuelto(), s);
    assert.ok(p.estaResuelto(p.aplicarSecuencia(e, p.invertir(s))));
  }
  guardarResultado('megaminx', r);
});
