// Todos los puzzles del registro cumplen la interfaz común.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLES } from '../src/puzzles/index.js';
import { rngConSemilla } from '../src/core/rng.js';

test('registro: ids únicos y todos los puzzles pedidos', () => {
  const ids = PUZZLES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7', 'square1', 'skewb', 'pyraminx', 'megaminx']) assert.ok(ids.includes(id), id);
});

for (const p of PUZZLES) {
  test(`interfaz: ${p.nombre}`, () => {
    const rng = rngConSemilla(5);
    const e0 = p.estadoResuelto();
    assert.ok(p.estaResuelto(e0));
    const s = p.generarScramble(rng);
    assert.ok(Array.isArray(s) && s.length > 0);
    const e = p.aplicarSecuencia(e0, s);
    assert.ok(p.estaResuelto(p.aplicarSecuencia(e, p.invertir(s))), 'el inverso del scramble lo deshace');
    const svg = p.renderizar(e, {});
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    if (p.capacidades.editar) {
      const editable = p.renderizar(e, { editable: true, editables: new Set(p.pegatinasEditables()) });
      assert.ok((editable.match(/class="pegatina"/g) || []).length === p.pegatinasEditables().length);
    }
    if (p.capacidades.validar) assert.ok(p.validar(e).valido);
    assert.throws(() => p.aplicarMovimiento(e0, 'Q'));
  });
}
