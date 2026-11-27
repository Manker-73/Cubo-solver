// Todos los puzzles del registro cumplen la interfaz común.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { todosLosPuzzles, REGISTRO, BANDAGED, cargarPuzzle, puzzleCargado, puzzlesConstruidos, existePuzzle } from '../src/puzzles/index.js';
import { definirPuzzle } from '../src/core/puzzle.js';
import { rngConSemilla } from '../src/core/rng.js';

// ---------- Registro perezoso (sesión «carga más rápida») ----------
test('registro: importarlo no construye ningún puzzle (ni ejecuta sus módulos)', () => {
  // en otro proceso, para que ningún otro test haya construido nada antes
  const codigo = `const m = await import(${JSON.stringify(new URL('../src/puzzles/index.js', import.meta.url).href)});
    console.log(JSON.stringify({ construidos: m.puzzlesConstruidos(), entradas: m.REGISTRO.length }));`;
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { encoding: 'utf8' }));
  assert.deepEqual(r.construidos, []);
  assert.equal(r.entradas, 16);
});

// los demás tests de este fichero recorren todos los puzzles, construidos
const PUZZLES = await todosLosPuzzles();

test('registro: cada entrada dice lo mismo que su puzzle construido (nombre, categoría, coste, capacidades)', () => {
  assert.deepEqual(PUZZLES.map((p) => p.id), REGISTRO.map((e) => e.id), 'mismo orden');
  for (const [i, e] of REGISTRO.entries()) {
    const p = PUZZLES[i];
    assert.equal(p.nombre, e.nombre, e.id);
    assert.equal(p.categoria, e.categoria, e.id);
    assert.equal(p.costeScramble, e.costeScramble, e.id);
    assert.deepEqual(p.capacidades, e.capacidades, e.id);
    assert.equal(puzzleCargado(e.id), p);
  }
});

test('registro: las bases de Bandaged Cubes existen y tienen el id de su entrada', async () => {
  for (const b of BANDAGED) {
    assert.ok(existePuzzle(b.id), b.url);
    const p = await cargarPuzzle(b.id);
    assert.equal(p.id, b.id);
    assert.ok(p.soporteBloqueos, `${b.url}: se puede vendar`);
  }
  // el 4x4 vendado comparte el puzzle (y el solver sin bloques) con el 4x4 de la lista
  assert.ok(puzzlesConstruidos().includes('vendado-4x4'));
});

test('registro: cada puzzle se construye una sola vez; un id desconocido se rechaza', async () => {
  const [a, b] = await Promise.all([cargarPuzzle('3x3'), cargarPuzzle('3x3')]);
  assert.equal(a, b);
  assert.equal(await cargarPuzzle('3x3'), a);
  assert.equal(puzzlesConstruidos().filter((id) => id === '3x3').length, 1);
  assert.equal(existePuzzle('nada'), false);
  await assert.rejects(cargarPuzzle('nada'), /desconocido/);
});

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
