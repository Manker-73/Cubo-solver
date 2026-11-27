// Todos los puzzles del registro cumplen la interfaz común.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PUZZLES } from '../src/puzzles/index.js';
import { definirPuzzle } from '../src/core/puzzle.js';
import { rngConSemilla } from '../src/core/rng.js';

test('registro: ids únicos y todos los puzzles pedidos', () => {
  const ids = PUZZLES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7', 'square1', 'skewb', 'pyraminx', 'megaminx', 'fto', '3x3x1', '3x3x2', '2x2x3']) assert.ok(ids.includes(id), id);
});

// ---------- Campos de cada puzzle ----------
// `npm run tipos` no ve un campo OPCIONAL mal escrito en la definición de un puzzle
// (`metodosAprendr` cae en los campos propios del puzzle, ver ARQUITECTURA.md, «Tipos»). Este
// test lo detecta: todo campo de un puzzle del registro tiene que ser de la interfaz común
// (DefinicionPuzzle o Puzzle, leídos de src/core/tipos.d.ts, más `categoria` del registro) o
// estar en la lista de campos propios permitidos de ese puzzle.
const TIPOS = fs.readFileSync(new URL('../src/core/tipos.d.ts', import.meta.url), 'utf8');
/** Campos (nivel superior) de una interfaz de tipos.d.ts. */
function camposDe(nombre) {
  const i = TIPOS.indexOf(`export interface ${nombre}<E>`);
  assert.ok(i >= 0, `tipos.d.ts: no está la interfaz ${nombre}`);
  const cuerpo = TIPOS.slice(i, TIPOS.indexOf('\n}', i));
  return [...cuerpo.matchAll(/^ {2}(\w+)\??\s*[:(<]/gm)].map((m) => m[1]);
}
const CAMPOS_INTERFAZ = new Set([...camposDe('DefinicionPuzzle'), ...camposDe('Puzzle'), 'categoria']);
/** Campos propios permitidos (los usan sus tests, scripts o el modo aprender). */
const EXTRAS = {
  '4x4': ['longitudScramble', 'nombresFase', '_interno'],
  '5x5': ['longitudScramble', 'nombresFase', '_interno'],
  '6x6': ['longitudScramble', 'nombresFase', '_interno'],
  '7x7': ['longitudScramble', 'nombresFase', '_interno'],
  pyraminx: ['obtenerBuscador', 'geo', 'modelo'],
  skewb: ['obtenerBuscador', 'geo', 'modelo', 'coordsDe', 'coordsAleatorias'],
  square1: ['sePuedeCortar', 'tablasMotor'],
  megaminx: ['longitudScramble', 'geo', 'etapas', 'movsCara'],
  fto: ['geo', 'modelo', 'analizar', 'piezasDe', 'pegatinasDe'],
  // cuboides (noche 15): geometría, grupo, solver, validador y scramble con el estado elegido
  '3x3x1': ['cuboide'],
  '3x3x2': ['cuboide'],
  '2x2x3': ['cuboide'],
  // shape mods (noche 16): geometría, conversiones (marcas ↔ piezas), movimientos legales y scramble con el estado
  mirror: ['shapeMod'],
  ghost: ['shapeMod'],
};
/** Campos de `p` que no son de la interfaz ni están permitidos. */
const camposDesconocidos = (p, extras = EXTRAS[p.id] || []) => Object.keys(p).filter((k) => !CAMPOS_INTERFAZ.has(k) && !extras.includes(k));

test('registro: cada campo de cada puzzle es de la interfaz común (o un campo propio permitido)', () => {
  // la lectura de tipos.d.ts encuentra los campos de las dos tablas de ARQUITECTURA.md
  for (const k of ['id', 'paleta', 'estadoResuelto', 'renderizar', 'validar', 'resolver', 'metodosAprender', 'vista3D', 'soporteBloqueos', 'aplicarSecuencia', 'invertir', 'categoria']) {
    assert.ok(CAMPOS_INTERFAZ.has(k), k);
  }
  for (const p of PUZZLES) assert.deepEqual(camposDesconocidos(p), [], `${p.nombre}: campos que no son de la interfaz (¿mal escritos?)`);
  // y no sobran permitidos: si un puzzle deja de tener un campo propio, se quita de la lista
  for (const [id, extras] of Object.entries(EXTRAS)) {
    const p = PUZZLES.find((x) => x.id === id);
    assert.ok(p, id);
    for (const k of extras) assert.ok(k in p, `${id}: "${k}" ya no existe`);
  }
});

test('registro: un campo opcional mal escrito se detecta (metodosAprendr)', () => {
  const skewb = PUZZLES.find((p) => p.id === 'skewb');
  const malo = definirPuzzle({ ...skewb, metodosAprendr: skewb.metodosAprender });
  assert.deepEqual(camposDesconocidos(malo, EXTRAS.skewb), ['metodosAprendr']);
  // también en un puzzle sin campos propios
  const cubo2 = PUZZLES.find((p) => p.id === '2x2');
  assert.deepEqual(camposDesconocidos(definirPuzzle({ ...cubo2, avisoInicialisacion: 'x' })), ['avisoInicialisacion']);
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
