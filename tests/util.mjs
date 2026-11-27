// Utilidades comunes a los tests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { rngConSemilla } from '../src/core/rng.js';

export const CASOS = parseInt(process.env.CASOS || '1000', 10);

/**
 * Nivel de la suite (ver README.md, "Tests"):
 *  - 'completo' (npm test, CASOS=1000): los casos de siempre;
 *  - 'rapido' (npm run test:rapido y test:solo, CASOS=100): las mismas comprobaciones con
 *    menos casos en los tests caros;
 *  - 'humo' (npm run test:humo): tests/humo.test.mjs y la prueba de humo de la app.
 */
export const NIVEL = process.env.NIVEL || (CASOS >= 1000 ? 'completo' : 'rapido');
export const COMPLETO = NIVEL === 'completo';

/**
 * Número de casos de un test caro: `completo` en la suite completa y `rapido` en las
 * demás. `variable` (opcional): variable de entorno que lo fija a mano (p. ej. CASOS_NXN).
 */
export function casosPor(completo, rapido, variable = null) {
  if (variable && process.env[variable]) return parseInt(process.env[variable], 10);
  return COMPLETO ? completo : rapido;
}

const DIR_COMPLETO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'resultados');
// Las ejecuciones con menos casos no pisan los resultados de la suite completa (que se
// citan en ESTADO.md): van a un directorio ignorado por git. GUARDAR=1 fuerza lo contrario.
const DIR = COMPLETO || process.env.GUARDAR === '1' ? DIR_COMPLETO : path.join(DIR_COMPLETO, '..', '.resultados-parciales');

/** Guarda métricas de un test en tests/resultados/<nombre>.json (para ESTADO.md). */
export function guardarResultado(nombre, datos) {
  fs.mkdirSync(DIR, { recursive: true });
  const f = path.join(DIR, nombre + '.json');
  let previo = {};
  try { previo = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* nuevo */ }
  const todo = { ...previo, ...datos, casos: CASOS, fecha: new Date().toISOString() };
  fs.writeFileSync(f, JSON.stringify(todo, null, 2));
  console.log(`  [${nombre}]`, JSON.stringify(datos));
}

/**
 * Test estándar de scrambles: CASOS scrambles aplicados al puzzle resuelto deben
 * dar estados válidos (si hay validador), sin movimientos redundantes y que se
 * puedan volver a leer desde su texto.
 */
export function probarScrambles(puzzle, semilla = 1, n = CASOS) {
  const rng = rngConSemilla(semilla);
  let suma = 0, min = Infinity, max = 0, resueltos = 0;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const s = puzzle.generarScramble(rng);
    const red = puzzle.buscarRedundancia(s);
    assert.equal(red, null, `scramble ${i}: ${red}\n${puzzle.formatear(s)}`);
    const texto = puzzle.formatear(s);
    assert.deepEqual(puzzle.parsear(texto), s, 'el scramble debe poder releerse desde su texto');
    const e = puzzle.aplicarSecuencia(puzzle.estadoResuelto(), s);
    if (puzzle.capacidades.validar) {
      const v = puzzle.validar(e);
      assert.ok(v.valido, `scramble ${i} produce un estado no válido: ${v.errores.join(' | ')}\n${texto}`);
    }
    if (puzzle.estaResuelto(e)) resueltos++;
    suma += s.length; min = Math.min(min, s.length); max = Math.max(max, s.length);
  }
  const ms = (performance.now() - t0) / n;
  assert.ok(resueltos <= n * 0.001 + 1, `demasiados scrambles dejan el puzzle resuelto (${resueltos})`);
  return { scrambles: n, longitudMedia: +(suma / n).toFixed(2), longitudMin: min, longitudMax: max, msPorScramble: +ms.toFixed(2) };
}

/**
 * Test estándar de solver: CASOS estados mezclados (por scramble) deben quedar
 * resueltos al aplicar la solución. `transformar` permite, por ejemplo,
 * reorientar el puzzle entero antes de resolver.
 */
export function probarSolver(puzzle, { semilla = 2, transformar = null, opciones = {}, n = CASOS } = {}) {
  const rng = rngConSemilla(semilla);
  const msIni = puzzle.inicializar().ms;
  let suma = 0, max = 0, ok = 0, tiempo = 0, tmax = 0;
  for (let i = 0; i < n; i++) {
    const s = puzzle.generarScramble(rng);
    let e = puzzle.aplicarSecuencia(puzzle.estadoResuelto(), s);
    if (transformar) e = transformar(e, i, rng);
    const t = performance.now();
    const r = puzzle.resolver(e, opciones);
    const dt = performance.now() - t;
    assert.ok(r.ok, `caso ${i}: el solver rechazó un estado válido: ${(r.errores || []).join(' | ')}`);
    const red = puzzle.buscarRedundanciaSolucion(r.movimientos);
    assert.equal(red, null, `caso ${i}: solución con movimientos redundantes: ${red}`);
    const fin = puzzle.aplicarSecuencia(e, r.movimientos);
    assert.ok(puzzle.estaResuelto(fin), `caso ${i}: la solución no resuelve el puzzle\nscramble: ${puzzle.formatear(s)}\nsolución: ${puzzle.formatear(r.movimientos)}`);
    ok++;
    suma += r.movimientos.length; max = Math.max(max, r.movimientos.length);
    tiempo += dt; tmax = Math.max(tmax, dt);
  }
  return {
    resueltos: `${ok}/${n} (${((100 * ok) / n).toFixed(1)}%)`,
    longitudMediaSolucion: +(suma / n).toFixed(2),
    longitudMaxSolucion: max,
    msMedioSolucion: +(tiempo / n).toFixed(2),
    msMaxSolucion: +tmax.toFixed(1),
    msInicializacion: msIni,
  };
}

/** Comprueba que el validador rechaza el estado y que el mensaje contiene `texto`. */
export function debeRechazar(puzzle, estado, texto) {
  const v = puzzle.validar(estado);
  assert.equal(v.valido, false, `debería rechazarse (${texto})`);
  const todo = v.errores.join(' | ');
  assert.ok(todo.toLowerCase().includes(texto.toLowerCase()), `mensaje esperado "${texto}", obtenido: ${todo}`);
  const r = puzzle.resolver(estado);
  assert.equal(r.ok, false, 'el solver también debe rechazarlo');
  return todo;
}

/**
 * Ejecuta `fn` (síncrona) como en una máquina muchísimo más lenta: cada lectura del reloj
 * (performance.now y Date.now) avanza además `saltoMs` ms. Todo presupuesto en milisegundos se
 * agota en cuanto se mira. Sirve para comprobar que el resultado de un test no depende de lo
 * rápida que sea la máquina (sesión de mantenimiento, 27/11/2026; ver DECISIONES.md).
 */
export function conRelojLento(fn, saltoMs = 1000) {
  const pn = performance.now, dn = Date.now;
  let k = 0;
  performance.now = () => pn.call(performance) + saltoMs * ++k;
  Date.now = () => dn() + saltoMs * ++k;
  try { return fn(); } finally { performance.now = pn; Date.now = dn; }
}
