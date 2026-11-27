// Diseño (noche 11): rutas de las secciones y contraste de los colores de los dos temas.
// Sin navegador: lee src/app/estilos.css y src/app/secciones.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECCIONES, leerRuta, hashDe, disponible } from '../src/app/secciones.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- Rutas ----------
test('diseño: rutas de las secciones (leerRuta / hashDe)', () => {
  assert.deepEqual(leerRuta('', ''), { seccion: 'portada', redirigir: false });
  assert.deepEqual(leerRuta('#/', ''), { seccion: 'portada' });
  assert.deepEqual(leerRuta('#/como-funciona', ''), { seccion: 'portada', ancla: 'como-funciona' });
  assert.deepEqual(leerRuta('#/wca', ''), { seccion: 'wca', puzzle: null });
  assert.deepEqual(leerRuta('#/wca/megaminx', ''), { seccion: 'wca', puzzle: 'megaminx' });
  assert.deepEqual(leerRuta('#/bandaged', ''), { seccion: 'bandaged', consulta: '' });
  // Cuboids (noche 15): como WCA Puzzles
  assert.deepEqual(leerRuta('#/cuboids', ''), { seccion: 'cuboids', puzzle: null });
  assert.deepEqual(leerRuta('#/cuboids/3x3x2', ''), { seccion: 'cuboids', puzzle: '3x3x2' });
  assert.equal(hashDe({ seccion: 'cuboids', puzzle: '2x2x3' }), '#/cuboids/2x2x3');
  assert.equal(hashDe({ seccion: 'cuboids' }), '#/cuboids');
  // Shape Mods (noche 16)
  assert.deepEqual(leerRuta('#/shapemods', ''), { seccion: 'shapemods', puzzle: null });
  assert.deepEqual(leerRuta('#/shapemods/ghost', ''), { seccion: 'shapemods', puzzle: 'ghost' });
  assert.equal(hashDe({ seccion: 'shapemods', puzzle: 'mirror' }), '#/shapemods/mirror');
  assert.deepEqual(leerRuta('#/bandaged?bloqueos=UFR.UF', ''), { seccion: 'bandaged', consulta: 'bloqueos=UFR.UF' });
  // enlaces antiguos
  assert.deepEqual(leerRuta('#bloqueos=U.UF-DB.DBL', ''), { seccion: 'bandaged', consulta: 'bloqueos=U.UF-DB.DBL', antigua: true });
  assert.deepEqual(leerRuta('#firma=40000000000', ''), { seccion: 'bandaged', consulta: 'firma=40000000000', antigua: true });
  assert.deepEqual(leerRuta('', '?firma=300C0000000C03'), { seccion: 'bandaged', consulta: 'firma=300C0000000C03', antigua: true });
  assert.deepEqual(leerRuta('', '?bloqueos=UFR.UF'), { seccion: 'bandaged', consulta: 'bloqueos=UFR.UF', antigua: true });
  // bloqueadas y desconocidas: a la portada
  for (const s of SECCIONES.filter((x) => x.estado === 'bloqueada')) {
    assert.deepEqual(leerRuta(`#/${s.id}`, ''), { seccion: 'portada', redirigir: true }, s.id);
    assert.equal(disponible(s.id), false);
  }
  assert.deepEqual(leerRuta('#/nada', ''), { seccion: 'portada', redirigir: true });
  assert.deepEqual(leerRuta('#algo', ''), { seccion: 'portada', redirigir: true });
  // ida y vuelta
  for (const r of [{ seccion: 'portada' }, { seccion: 'wca', puzzle: '3x3' }, { seccion: 'cuboids', puzzle: '3x3x1' }, { seccion: 'shapemods', puzzle: 'ghost' }, { seccion: 'bandaged', consulta: 'bloqueos=UFR.UF' }]) {
    const h = hashDe(r);
    const v = leerRuta(h, '');
    assert.equal(v.seccion, r.seccion, h);
    if (r.puzzle) assert.equal(v.puzzle, r.puzzle);
    if (r.consulta) assert.equal(v.consulta, r.consulta);
  }
  // la lista de secciones: ids únicos y las disponibles (Cuboids desde la noche 15)
  assert.equal(new Set(SECCIONES.map((s) => s.id)).size, SECCIONES.length);
  assert.deepEqual(SECCIONES.filter((s) => s.estado === 'disponible').map((s) => s.id), ['wca', 'bandaged', 'shapemods', 'cuboids']);
  assert.ok(SECCIONES.every((s) => ['disponible', 'bloqueada'].includes(s.estado)));
});

// ---------- Contraste ----------
// Variables de cada tema: el bloque ":root {…}" (oscuro, por defecto) y ":root[data-theme="light"] {…}".
function variables(css, selector) {
  const i = css.indexOf(selector + ' {');
  assert.ok(i >= 0, selector);
  const cuerpo = css.slice(i, css.indexOf('}', i));
  const v = {};
  for (const m of cuerpo.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) v[m[1]] = m[2].toLowerCase();
  return v;
}
const lum = (hex) => {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Pares de texto / fondo que usa la interfaz (texto normal: 4,5:1 como mínimo en los dos temas).
const PARES = [
  ['tinta', 'fondo'], ['tinta', 'superficie'], ['tinta', 'acento-suave'], ['tinta', 'lienzo'], ['tinta', 'raya-1'], ['tinta', 'raya-2'],
  ['tenue', 'fondo'], ['tenue', 'superficie'], ['tenue', 'acento-suave'], ['tenue', 'lienzo'], ['tenue', 'raya-1'], ['tenue', 'raya-2'],
  ['acento-texto', 'fondo'], ['acento-texto', 'superficie'],   // etiquetas en mono, enlaces, "Copiar", "Inicio"
  ['acento-tinta', 'acento'],                                  // botones principales, chip elegido, tarjeta de WCA Puzzles
  ['fondo', 'tinta'],                                          // (inverso: listas de movimientos hechas)
  ['error', 'error-suave'], ['ok', 'ok-suave'], ['tinta', 'acento-suave'],
];

test('diseño: contraste ≥ 4,5:1 de cada par de texto y fondo en los temas oscuro y claro', () => {
  const css = fs.readFileSync(path.join(raiz, 'src/app/estilos.css'), 'utf8');
  const temas = { oscuro: variables(css, ':root'), claro: variables(css, ':root[data-theme="light"]') };
  // los colores pedidos para la propuesta D
  assert.equal(temas.oscuro.fondo, '#0f1218');
  assert.equal(temas.oscuro.acento, '#7d97ff');
  assert.equal(temas.claro.fondo, '#f4f6fa');
  assert.equal(temas.claro.acento, '#2f55d4');
  const fallos = [];
  const tabla = [];
  for (const [nombre, v] of Object.entries(temas)) {
    for (const [t, f] of PARES) {
      assert.ok(v[t] && v[f], `${nombre}: falta --${t} o --${f}`);
      const c = contraste(v[t], v[f]);
      tabla.push(`${nombre} ${t}/${f} ${c.toFixed(2)}`);
      if (c < 4.5) fallos.push(`${nombre}: --${t} (${v[t]}) sobre --${f} (${v[f]}) = ${c.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(fallos, [], 'contraste insuficiente');
  // comprobación de la fórmula: negro sobre blanco = 21:1, iguales = 1:1
  assert.equal(contraste('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contraste('#7d97ff', '#7d97ff'), 1);
});
