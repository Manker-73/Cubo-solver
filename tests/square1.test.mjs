// Square-1: scrambles de movimientos aleatorios con "/" legales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p, { sePuedeCortar, LONGITUD_METRICA } from '../src/puzzles/square1.js';
import { rngConSemilla } from '../src/core/rng.js';
import { probarScrambles, guardarResultado, CASOS } from './util.mjs';

test('Square-1: modelo', () => {
  const e = p.estadoResuelto();
  assert.ok(p.estaResuelto(e));
  assert.ok(sePuedeCortar(e));
  // "/" dos veces = nada; "/ (6,6) / (6,6)" mantiene la forma de cubo
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e, ['/', '/'])));
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e, ['(3,3)', '(-3,-3)'])));
  // (1,0) deja una esquina atravesando el corte: "/" ilegal
  assert.throws(() => p.aplicarSecuencia(e, ['(1,0)', '/']), /ilegal/);
  // (1,0)/(−1,0) desde resuelto: se permite (1,0) solo si la de abajo también... (comprobación de forma)
  const e2 = p.aplicarSecuencia(e, ['/', '(3,0)', '/']);
  assert.equal(e2.medio, 0);
  assert.ok(!p.estaResuelto(e2));
  assert.deepEqual(p.parsear('(1,0)/ (-1, 2) /(3,3)/'), ['(1,0)', '/', '(-1,2)', '/', '(3,3)', '/']);
});

test('Square-1: scrambles con "/" siempre legales y sin redundancias', () => {
  const r = probarScrambles(p, 71); // aplicarSecuencia lanza error si algún "/" es ilegal
  const rng = rngConSemilla(72);
  let barras = 0;
  for (let i = 0; i < CASOS; i++) {
    const s = p.generarScramble(rng);
    let metrica = 0;
    for (const m of s) {
      if (m === '/') { metrica++; barras++; continue; }
      const [x, y] = m.slice(1, -1).split(',').map(Number);
      assert.ok(x >= -5 && x <= 6 && y >= -5 && y <= 6, m);
      assert.ok(x !== 0 || y !== 0);
      metrica += (x !== 0) + (y !== 0);
    }
    assert.ok(metrica >= LONGITUD_METRICA && metrica < LONGITUD_METRICA + 3, `métrica ${metrica}`);
    const e = p.aplicarSecuencia(p.estadoResuelto(), s);
    assert.ok(p.estaResuelto(p.aplicarSecuencia(e, p.invertir(s))), 'el inverso deshace el scramble');
  }
  r.barrasMedias = +(barras / CASOS).toFixed(2);
  guardarResultado('square1', r);
});
