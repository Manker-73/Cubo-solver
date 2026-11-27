// Cuboides (noche 15): 3x3x1 (Floppy), 3x3x2 (Domino) y 2x2x3 (Tower).
// Geometría y giros legales, grupo y restricciones (Schreier–Sims), BFS completo frente a las cifras
// publicadas (Jaap's Puzzle Page), scrambles de estado aleatorio exactos y uniformes, solver óptimo
// con el puzzle reorientado al azar (comparado con un BFS independiente sobre los colores) y rechazos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todosLosPuzzles, PUZZLES_PRONTO } from '../src/puzzles/index.js';
// (registro perezoso, sesión «carga más rápida»: los puzzles se construyen al pedirlos; aquí, todos)
const PUZZLES = await todosLosPuzzles();
const obtenerPuzzle = (id) => PUZZLES.find((p) => p.id === id);
import { crearCuboide } from '../src/puzzles/cuboide.js';
import { aplicarPerm } from '../src/core/perm.js';
import { reetiquetar } from '../src/core/simetria.js';
import { rngConSemilla, entero } from '../src/core/rng.js';
import { probarScrambles, probarSolver, debeRechazar, guardarResultado, CASOS, casosPor } from './util.mjs';

const floppy = obtenerPuzzle('3x3x1');
const domino = obtenerPuzzle('3x3x2');
const tower = obtenerPuzzle('2x2x3');
const TODOS = [floppy, domino, tower];

// Cifras publicadas (Jaap's Puzzle Page: floppy.htm, domino.htm, cube223.htm; ver DECISIONES.md, «Noche 15»)
const JAAP = {
  '3x3x1': { posiciones: 192, dios: 8, media: 4.4271, dist: [1, 4, 10, 24, 53, 64, 31, 4, 1] },
  '3x3x2': {
    posiciones: 406425600, dios: 18, media: 13.290,
    dist: [1, 7, 34, 168, 807, 3768, 17250, 77696, 342305, 1472169, 6052497, 22364538, 65693109, 121339537, 127175987, 58226238, 3627117, 32344, 28],
  },
  '2x2x3': { posiciones: 241920, dios: 14, media: 9.7372, dist: [1, 8, 35, 157, 678, 2527, 7442, 17088, 31568, 44704, 47216, 49792, 29024, 11104, 576] },
};

test('cuboides: registro (categoría cuboids, ids y anunciados)', () => {
  for (const p of TODOS) assert.equal(p.categoria, 'cuboids', p.id);
  assert.deepEqual(PUZZLES.filter((p) => p.categoria === 'cuboids').map((p) => p.id), ['3x3x1', '3x3x2', '2x2x3']);
  assert.ok(PUZZLES_PRONTO.filter((p) => p.categoria === 'cuboids').length >= 1);
});

test('cuboides: geometría, giros legales (90° solo en capas de sección cuadrada) y rotaciones', () => {
  const esperado = {
    '3x3x1': { pegatinas: 30, piezas: 9, busqueda: ['R', 'L', 'F', 'B'], noExisten: ['U', 'D', 'R2x'] },
    '3x3x2': { pegatinas: 42, piezas: 18, busqueda: ['R2', 'L2', 'U', "U'", 'U2', 'F2', 'B2'], noExisten: ['E', 'Rw'] },
    '2x2x3': { pegatinas: 32, piezas: 12, busqueda: ['R2', 'U', "U'", 'U2', 'D', "D'", 'D2', 'F2'], noExisten: ['M', 'S'] },
  };
  for (const p of TODOS) {
    const G = p.cuboide.G, e = esperado[p.id];
    assert.equal(G.n, e.pegatinas, p.id);
    assert.equal(G.piezas.length, e.piezas, p.id);
    assert.deepEqual(G.busqueda, e.busqueda, p.id);
    for (const m of e.noExisten) assert.throws(() => p.aplicarMovimiento(p.estadoResuelto(), m), p.id + ' ' + m);
    // 8 rotaciones que conservan la forma (prisma de base cuadrada)
    assert.equal(G.geo.rotaciones.length, 8, p.id);
    // cada giro de cuarto de vuelta solo en ejes de sección cuadrada; los de 180° son involuciones
    for (const [m, d] of Object.entries(G.movimientos)) {
      const eje = G.ejes.find((x) => x.id === d.eje);
      if (d.vueltas !== 2) assert.ok(eje.cuadrada, `${p.id}: ${m} gira 90° en una capa no cuadrada`);
      const veces = d.vueltas === 2 ? 2 : 4;
      let x = p.estadoResuelto();
      for (let k = 0; k < veces; k++) x = p.aplicarMovimiento(x, m);
      assert.ok(x.every((v, i) => v === p.estadoResuelto()[i]), `${p.id}: ${m}^${veces} no es la identidad`);
    }
  }
  // 3x3x1: los lados solo giran 180° y no hay U/D; 3x3x2: U/D 90°, lados 180°; 2x2x3: U, D (y E) 90°, lados 180°
  assert.deepEqual(floppy.cuboide.G.ejes.map((e) => [e.id, e.n, e.cuadrada]), [['x', 3, false], ['y', 1, true], ['z', 3, false]]);
  assert.deepEqual(domino.cuboide.G.ejes.map((e) => [e.id, e.n, e.cuadrada]), [['x', 3, false], ['y', 2, true], ['z', 3, false]]);
  assert.deepEqual(tower.cuboide.G.ejes.map((e) => [e.id, e.n, e.cuadrada]), [['x', 2, false], ['y', 3, true], ['z', 2, false]]);
  assert.ok(tower.cuboide.G.movimientos.E && tower.cuboide.G.movimientos["E'"], 'la capa E del 2x2x3 gira 90°');
  // un 90° en una capa no cuadrada es geométricamente imposible: no existe
  assert.equal(domino.cuboide.G.canonico("R'"), 'R2');
  assert.equal(floppy.cuboide.G.canonico('R2'), 'R');
  // alias al leer: «R» en el 3x3x2 es R2 (Jaap), «R2» en el 3x3x1 es R (csTimer escribe R)
  assert.deepEqual(domino.parsear("U R F' B2"), ['U', 'R2', 'F2', 'B2']);
  assert.deepEqual(floppy.parsear('R2 L F2'), ['R', 'L', 'F']);
  // otro cuboide sale solo (y con giros de capas interiores)
  const c = crearCuboide(3, 3, 4);
  assert.equal(c.cuboide.G.n, 2 * 9 + 4 * 12);
  assert.ok(c.cuboide.G.movimientos['2U'] && c.cuboide.G.movimientos.U2 && c.cuboide.G.movimientos.R2 && !c.cuboide.G.movimientos.R);
});

test('cuboides: grupo (Schreier–Sims), restricciones demostradas y posiciones frente a Jaap', () => {
  const datos = {};
  for (const p of TODOS) {
    const Gr = p.cuboide.grupo();
    // el orden calculado coincide con el previsto si las únicas restricciones son las encontradas
    assert.equal(Gr.orden, Gr.previsto, p.id);
    const posiciones = Gr.orden / BigInt(Gr.rotEnG.length);
    assert.equal(posiciones, BigInt(JAAP[p.id].posiciones), `${p.id}: posiciones distinguibles`);
    datos[p.id] = { grupo: String(Gr.orden), rotacionesEnElGrupo: Gr.rotEnG.length, posiciones: String(posiciones), restricciones: Gr.restricciones.length };
  }
  const fac = (n) => { let r = 1n; for (let k = 2n; k <= BigInt(n); k++) r *= k; return r; };
  // 3x3x1: 4! esquinas (orientación según la posición) · 2⁴ volteos de las aristas / 2 (paridad común)
  assert.equal(floppy.cuboide.grupo().orden, fac(4) * 16n / 2n);
  assert.equal(floppy.cuboide.grupo().restricciones.length, 1);
  // 3x3x2: 8!·8! (sin restricción de paridad: U es impar en esquinas y aristas, R2 solo en aristas);
  // contiene y = U D' (4 rotaciones): 8!·8!/4 posiciones
  assert.equal(domino.cuboide.grupo().orden, fac(8) * fac(8));
  assert.equal(domino.cuboide.grupo().rotEnG.length, 4);
  // 2x2x3: la arista BL queda fija con U, D, R2, F2: 8!·3!
  assert.equal(tower.cuboide.grupo().orden, fac(8) * fac(3));
  guardarResultado('cuboides-grupo', datos);
});

test('cuboides: BFS completo del 3x3x1 y del 2x2x3 = distribución publicada (número de Dios 8 y 14)', () => {
  for (const p of [floppy, tower]) {
    const S = p.cuboide.solver();
    assert.ok(S.exacto, p.id);
    const d = S.distribucion();
    assert.deepEqual(d, JAAP[p.id].dist, p.id);
    assert.equal(d.length - 1, JAAP[p.id].dios);
    const media = d.reduce((a, x, k) => a + x * k, 0) / d.reduce((a, x) => a + x, 0);
    assert.ok(Math.abs(media - JAAP[p.id].media) < 1e-4, `${p.id}: media ${media}`);
  }
});

/**
 * Oráculo independiente del solver: BFS sobre los COLORES (no las piezas) desde todas las
 * orientaciones del resuelto, con TODOS los giros de capas exteriores (también L2, B2 y D, que el
 * solver no usa). Distancia exacta en la métrica de la comunidad para cualquier estado pintado.
 */
function oraculo(p) {
  const G = p.cuboide.G;
  const movs = G.exteriores;
  const perms = movs.map((m) => G.movimientos[m].perm);
  const clave = (e) => String.fromCharCode(...e.map((x) => 48 + x));
  const dist = new Map();
  let frontera = G.geo.rotaciones.map((R) => aplicarPerm(p.estadoResuelto(), R));
  for (const e of frontera) dist.set(clave(e), 0);
  for (let d = 1; frontera.length; d++) {
    const sig = [];
    for (const e of frontera) for (const P of perms) {
      const f = aplicarPerm(e, P);
      const k = clave(f);
      if (!dist.has(k)) { dist.set(k, d); sig.push(f); }
    }
    frontera = sig;
  }
  return (e) => dist.get(clave(e));
}

const rotarAzar = (p) => (e, _i, rng) => {
  const R = p.cuboide.G.geo.rotaciones;
  return aplicarPerm(e, R[entero(rng, R.length)]);
};

for (const p of TODOS) {
  test(`cuboides ${p.id}: scrambles de estado aleatorio válidos y sin redundancias`, { timeout: 1200000 }, () => {
    const r = probarScrambles(p, 151);
    guardarResultado(`cuboide-${p.id}`, r);
  });

  test(`cuboides ${p.id}: el solver resuelve el 100 % de forma óptima (puzzle reorientado al azar)`, { timeout: 1200000 }, () => {
    const r = probarSolver(p, { semilla: 152, transformar: rotarAzar(p) });
    assert.ok(r.longitudMaxSolucion <= JAAP[p.id].dios, `${p.id}: el número de Dios es ${JAAP[p.id].dios}`);
    // óptima caso a caso: longitud = distancia exacta del oráculo independiente (3x3x1 y 2x2x3; en el
    // 3x3x2 el espacio de colores tiene 3,3·10⁹ estados: allí la óptima la garantiza IDA* con una
    // heurística admisible y se compara la distribución con la publicada)
    const rng = rngConSemilla(153);
    const N = CASOS;
    const orc = p.id === '3x3x2' ? null : oraculo(p);
    const cuenta = [];
    let suma = 0;
    for (let i = 0; i < N; i++) {
      const s = p.generarScramble(rng);
      const e = rotarAzar(p)(p.aplicarSecuencia(p.estadoResuelto(), s), i, rng);
      const sol = p.resolver(e);
      assert.ok(sol.ok);
      assert.ok(p.estaResuelto(p.aplicarSecuencia(e, sol.movimientos)));
      // el scramble es la inversa de una solución óptima: la solución mide lo mismo
      assert.equal(sol.movimientos.length, s.length, `${p.id}: caso ${i}: la solución óptima debe medir lo que el scramble`);
      if (orc) assert.equal(sol.movimientos.length, orc(e), `${p.id}: caso ${i}: la solución no es óptima`);
      cuenta[sol.movimientos.length] = (cuenta[sol.movimientos.length] || 0) + 1;
      suma += sol.movimientos.length;
    }
    r.optimas = `${N}/${N} (${orc ? 'comparadas con el BFS de colores' : 'IDA* admisible'})`;
    r.distribucion = Array.from(cuenta, (x) => x || 0);
    guardarResultado(`cuboide-${p.id}`, r);
    // la longitud media se parece a la del reparto exacto de todas las posiciones (≈ estado uniforme)
    const media = suma / N;
    assert.ok(Math.abs(media - JAAP[p.id].media) < (N >= 1000 ? 0.15 : 0.5), `${p.id}: media ${media} frente a ${JAAP[p.id].media}`);
  });

  test(`cuboides ${p.id}: scramble exacto (el estado elegido) y uniforme`, { timeout: 1200000 }, () => {
    const rng = rngConSemilla(154);
    const N = casosPor(1000, 200);
    const cuenta = new Array(JAAP[p.id].dist.length).fill(0);
    for (let i = 0; i < N; i++) {
      const { movimientos, estado } = p.cuboide.scrambleDetallado(rng);
      const e = p.aplicarSecuencia(p.estadoResuelto(), movimientos);
      // exacto: el scramble deja el estado elegido, salvo un reetiquetado de colores de una rotación
      // (= el mismo puzzle sujetado de otra forma; en el 3x3x2, las rotaciones y que están en el grupo)
      assert.ok(p.cuboide.sigmas.some((sg) => reetiquetar(e, sg).every((x, k) => x === estado[k])), `${p.id}: caso ${i}: no deja el estado elegido`);
      cuenta[movimientos.length]++;
    }
    // uniforme: la distancia de los scrambles sigue la distribución exacta (sin el resuelto)
    const total = JAAP[p.id].dist.reduce((a, x) => a + x, 0) - 1;
    let tv = 0;
    cuenta.forEach((x, k) => { tv += Math.abs(x / N - (k === 0 ? 0 : JAAP[p.id].dist[k] / total)); });
    tv /= 2;
    guardarResultado(`cuboide-${p.id}`, { scrambleExacto: `${N}/${N}`, distanciaTV: +tv.toFixed(4) });
    assert.ok(tv < (N >= 1000 ? 0.07 : 0.12), `${p.id}: distancia de variación total ${tv}`);
  });
}

// ---------- Rechazos: uno por cada restricción demostrada (y los generales) ----------
const pegatinasDe = (p, nombre) => p.cuboide.G.piezas.find((x) => x.nombre === nombre).pegatinas;
const cambiar = (e, pares) => { const r = e.slice(); for (const [a, b] of pares) [r[a], r[b]] = [e[b], e[a]]; return r; };
const ciclo = (e, l) => { const r = e.slice(); l.forEach((x, k) => { r[l[(k + 1) % l.length]] = e[x]; }); return r; };
/** intercambia dos piezas del mismo tipo, pegatina a pegatina en el mismo orden (U/D primero) */
const intercambiar = (p, e, a, b) => cambiar(e, pegatinasDe(p, a).map((x, k) => [x, pegatinasDe(p, b)[k]]));
/** intercambia dos piezas de verdad: cada una en el hueco de la otra con una colocación posible con los giros */
function intercambiarReal(p, e, a, b) {
  const G = p.cuboide.G, Gr = p.cuboide.grupo();
  const ja = G.piezas.findIndex((x) => x.nombre === a), jb = G.piezas.findIndex((x) => x.nombre === b);
  const r = e.slice();
  for (const [j, h] of [[ja, jb], [jb, ja]]) Gr.colocaciones[j].get(h)[0].forEach((pos, k) => { r[pos] = Gr.coloresPieza[j][k]; });
  return r;
}

test('cuboides 3x3x1: rechazos (paridad esquinas/aristas, esquina volteada, arista fuera de su lado, generales)', () => {
  const base = floppy.aplicarSecuencia(floppy.estadoResuelto(), ['R', 'F', 'L']);
  // restricción 1 (paridad): una arista volteada sola (la permutación de las esquinas sigue igual)
  const [u, d] = pegatinasDe(floppy, 'R'); // U y D (las pegatinas de una pieza van U, D, F, B, R, L)
  console.log('  paridad:', debeRechazar(floppy, cambiar(floppy.estadoResuelto(), [[u, d]]), 'paridad'));
  // dos esquinas intercambiadas sin voltear ninguna arista: también la paridad (con la orientación que les toca)
  const R = floppy.aplicarMovimiento(floppy.estadoResuelto(), 'R');
  const [ru, rd] = pegatinasDe(floppy, 'R');
  console.log('  paridad 2:', debeRechazar(floppy, cambiar(R, [[ru, rd]]), 'paridad'));
  // restricción estructural: la orientación de cada esquina depende de su posición
  const esq = pegatinasDe(floppy, 'FR');
  console.log('  volteada:', debeRechazar(floppy, cambiar(base, [[esq[0], esq[1]], [esq[2], esq[3]]]), 'volteada'));
  // restricción estructural: cada arista se queda en su lado
  console.log('  lado:', debeRechazar(floppy, intercambiar(floppy, floppy.estadoResuelto(), 'R', 'F'), 'no puede estar'));
  // generales: colores, especular
  const c = base.slice(); c[0] = (c[0] + 1) % 6;
  debeRechazar(floppy, c, 'debería haber');
  console.log('  especular:', debeRechazar(floppy, cambiar(base, [[esq[2], esq[3]]]), 'especular'));
});

test('cuboides 3x3x2: rechazos (esquina girada, arista volteada, generales); sin restricciones de paridad', () => {
  const base = domino.aplicarSecuencia(domino.estadoResuelto(), ['U', 'R2', 'F2', "U'"]);
  const esq = pegatinasDe(domino, 'UFR'); // U, F, R
  console.log('  girada:', debeRechazar(domino, ciclo(domino.estadoResuelto(), esq), 'girada'));
  const ar = pegatinasDe(domino, 'UF');
  console.log('  volteada:', debeRechazar(domino, cambiar(domino.estadoResuelto(), [[ar[0], ar[1]]]), 'volteada'));
  console.log('  especular:', debeRechazar(domino, cambiar(domino.estadoResuelto(), [[esq[1], esq[2]]]), 'especular'));
  const c = base.slice(); c[3] = (c[3] + 1) % 6;
  debeRechazar(domino, c, 'debería haber');
  // dos esquinas intercambiadas (o dos aristas) SÍ es posible: no hay paridad que lo impida
  assert.ok(domino.validar(intercambiarReal(domino, domino.estadoResuelto(), 'UFR', 'UBR')).valido);
  assert.ok(domino.validar(intercambiarReal(domino, domino.estadoResuelto(), 'UF', 'UB')).valido);
  // y el centro amarillo arriba (puzzle boca abajo) también
  assert.ok(domino.validar(aplicarPerm(base, domino.cuboide.G.movimientos.x2.perm)).valido);
});

test('cuboides 2x2x3: rechazos (esquina girada, arista del medio volteada, generales); sin paridades', () => {
  const esq = pegatinasDe(tower, 'UFR');
  console.log('  girada:', debeRechazar(tower, ciclo(tower.estadoResuelto(), esq), 'girada'));
  const ar = pegatinasDe(tower, 'FR');
  console.log('  volteada:', debeRechazar(tower, cambiar(tower.estadoResuelto(), [[ar[0], ar[1]]]), 'volteada'));
  console.log('  especular:', debeRechazar(tower, cambiar(tower.estadoResuelto(), [[esq[1], esq[2]]]), 'especular'));
  const c = tower.estadoResuelto(); c[0] = 5;
  debeRechazar(tower, c, 'debería haber');
  const cs = tower.estadoResuelto(); const ufl = pegatinasDe(tower, 'UFL'); cs[ufl[1]] = 0; cs[esq[0]] = 2; // dos verdes... y un blanco de más en otro sitio
  assert.equal(tower.validar(cs).valido, false);
  assert.ok(tower.validar(intercambiarReal(tower, tower.estadoResuelto(), 'UFR', 'UBR')).valido);
  assert.ok(tower.validar(intercambiarReal(tower, tower.estadoResuelto(), 'FR', 'BR')).valido);
});
