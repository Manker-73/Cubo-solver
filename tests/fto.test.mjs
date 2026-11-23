// FTO (Face-Turning Octahedron): geometría y notación WCA, restricciones demostradas,
// validador, scrambles de estado aleatorio y solver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p from '../src/puzzles/fto.js';
import {
  geo, CARAS, IDX, OPUESTA, NORMALES, PALETA_FTO, ESQUINAS, ARISTAS, TRI_A, TRI_B, TETRADA_A, enA, modelo,
  ORB_ESQ, ORB_ARI, ORB_TA, ORB_TB,
} from '../src/puzzles/fto-geo.js';
import {
  analizarGrupo, cotaInferiorConteo, ORDEN_ESQUINAS, ORDEN_ARISTAS, ORDEN_TRIANGULOS, ORDEN_TOTAL, POSICIONES, ORDEN_G2,
} from '../src/puzzles/fto-grupo.js';
import { piezasAleatorias, simplificar, tablas } from '../src/puzzles/fto-solver.js';
import { aplicarPerm, paridad } from '../src/core/perm.js';
import { dot, cruz, res } from '../src/core/geometria.js';
import { rngConSemilla, entero } from '../src/core/rng.js';
import { probarScrambles, probarSolver, debeRechazar, guardarResultado, casosPor } from './util.mjs';

const CASOS_SCR = casosPor(1000, 100, 'CASOS_FTO');
const CASOS_SOL = casosPor(1000, 100, 'CASOS_FTO');
const CASOS_REPARTO = casosPor(300, 60);
const caraDe = (f) => geo.pegatinas[f].cara;
const res0 = p.estadoResuelto();

test('FTO: 72 pegatinas (9 por cara), 8 giros de orden 3, las caras opuestas conmutan y las demás no', () => {
  assert.equal(res0.length, 72);
  assert.deepEqual(geo.porCara, new Array(8).fill(9));
  for (const c of CARAS) {
    assert.ok(p.estaResuelto(p.aplicarSecuencia(res0, [c, c, c])), `${c}³ = identidad`);
    assert.deepEqual(p.aplicarSecuencia(res0, [c, c]), p.aplicarMovimiento(res0, c + "'"), `${c}${c} = ${c}'`);
    assert.ok(!p.estaResuelto(p.aplicarMovimiento(res0, c)));
    // cada giro mueve 27 pegatinas: su cara (9), una fila de 5 en cada vecina y una punta en 3 caras más
    assert.equal(geo.giros3D[c].pegatinas.length, 27);
  }
  const e0 = p.aplicarSecuencia(res0, ['R', 'U', "F'"]); // estado sin simetrías
  for (const a of CARAS) for (const b of CARAS) {
    if (a === b) continue;
    const ab = p.aplicarSecuencia(e0, [a, b]), ba = p.aplicarSecuencia(e0, [b, a]);
    assert.equal(ab.join() === ba.join(), OPUESTA[a] === b, `${a} y ${b} ${OPUESTA[a] === b ? 'conmutan' : 'no conmutan'}`);
  }
});

test('FTO: notación del Reglamento WCA 12f (vértice hacia quien mezcla, U arriba, F abajo; B, BR, BL y D detrás)', () => {
  const n = Object.fromEntries(CARAS.map((c, i) => [c, NORMALES[i]]));
  // 12f1: cuatro caras a la vista (U, F, R, L) con el vértice común delante (+z)
  for (const c of ['U', 'F', 'R', 'L']) assert.ok(n[c][2] > 0, `${c} se ve`);
  for (const c of ['B', 'D', 'BR', 'BL']) assert.ok(n[c][2] < 0, `${c} está detrás`);
  assert.ok(n.U[1] > 0.8 && n.F[1] < -0.8 && n.R[0] > 0.8 && n.L[0] < -0.8);
  // detrás: B vecina de U, D de F, BR de R y BL de L (comparten arista); opuestas: U–D, F–B, R–BL, L–BR
  const vecinas = (a, b) => ARISTAS.some((x) => x.caras.includes(IDX[a]) && x.caras.includes(IDX[b]));
  for (const [a, b] of [['B', 'U'], ['D', 'F'], ['BR', 'R'], ['BL', 'L']]) assert.ok(vecinas(a, b), `${a} vecina de ${b}`);
  for (const [a, b] of [['U', 'D'], ['F', 'B'], ['R', 'BL'], ['L', 'BR']]) {
    assert.ok(dot(n[a], n[b]) < -0.99, `${a} opuesta a ${b}`);
    assert.equal(OPUESTA[a], b);
  }
  // 12f2: X gira 120° en sentido horario mirando la cara X de frente
  for (const c of CARAS) {
    const ni = n[c];
    const P = geo.perms[c]; // P[i] = de dónde viene la pegatina que acaba en i
    let horario = 0;
    for (let i = 0; i < 72; i++) {
      const j = P[i];
      if (j === i || caraDe(i) !== IDX[c]) continue;
      // de j a i: visto desde fuera de la cara, horario = giro negativo alrededor de la normal
      if (dot(cruz(geo.pegatinas[j].centro, geo.pegatinas[i].centro), ni) < 0) horario++; else horario--;
    }
    assert.ok(horario > 0, `${c} es horario mirando la cara`);
  }
});

test('FTO: colores de TNoodle (esquema por defecto de la WCA) y orientación de los scrambles (4d6: blanco arriba, verde delante)', () => {
  const esperado = { U: 'blanco', F: 'verde', R: 'rojo', L: 'morado', B: 'azul', D: 'amarillo', BR: 'gris', BL: 'naranja' };
  for (const [c, col] of Object.entries(esperado)) assert.equal(PALETA_FTO[IDX[c]].nombre, col);
  assert.equal(new Set(PALETA_FTO.map((x) => x.hex)).size, 8);
  // el estado resuelto tiene cada cara de su color; verde (F) comparte esquina con blanco (U)
  for (let i = 0; i < 72; i++) assert.equal(res0[i], caraDe(i));
  assert.ok(ESQUINAS.some((e) => e.caras.includes(IDX.U) && e.caras.includes(IDX.F)));
});

test('FTO: piezas deducidas de la geometría (6 esquinas, 12 aristas, 24 triángulos en dos órbitas)', () => {
  assert.equal(ESQUINAS.length, 6);
  assert.equal(ARISTAS.length, 12);
  assert.equal(TRI_A.length + TRI_B.length, 24);
  for (const e of ESQUINAS) {
    assert.equal(e.pegatinas.length, 4);
    assert.deepEqual(e.pegatinas.map((f) => enA[caraDe(f)]), [true, false, true, false], 'alrededor de una esquina se alternan las tétradas');
  }
  for (const a of ARISTAS) assert.deepEqual(a.pegatinas.map((f) => enA[caraDe(f)]), [true, false]);
  assert.deepEqual([...new Set(TRI_A.map((t) => CARAS[caraDe(t.pegatinas[0])]))].sort(), TETRADA_A.slice().sort());
  // los triángulos de una cara son los 3 "hacia abajo" de las 9 de la cara
  for (let c = 0; c < 8; c++) assert.equal([...TRI_A, ...TRI_B].filter((t) => caraDe(t.pegatinas[0]) === c).length, 3);
});

test('FTO: restricciones demostradas con Schreier–Sims (no hay más que estas)', () => {
  const g = analizarGrupo();
  // cada órbita por separado: esquinas 6!/2·2⁵, aristas 12!/2, cada órbita de triángulos 12!/2
  assert.equal(g.ordenEsquinas, ORDEN_ESQUINAS);
  assert.equal(g.ordenAristas, ORDEN_ARISTAS);
  assert.equal(g.ordenTriA * g.ordenTriB, ORDEN_TRIANGULOS);
  assert.equal(g.ordenTriA, g.ordenAristas);
  // el puzzle entero es exactamente el producto: no hay relaciones entre órbitas
  assert.equal(g.orden, ORDEN_TOTAL);
  assert.equal(g.orden, 158260810061489362698240000000n);
  // invariantes de cada giro: permutaciones pares, aristas sin voltear, esquinas giradas media vuelta (0 o 2)
  for (const x of g.giros) {
    assert.equal(x.paridadEsquinas + x.paridadAristas + x.paridadTriA + x.paridadTriB, 0, x.m);
    assert.equal(x.volteos, 0, x.m);
    assert.ok(x.girosEsquinas.every((d) => d === 2) && x.girosEsquinas.length % 2 === 0, x.m);
  }
  // 12 de las 24 rotaciones están en el grupo: las otras cambian la paridad de esquinas, aristas y triángulos
  assert.equal(g.rotacionesEnGrupo, 12);
  // posiciones distintas: la cifra publicada (Wikipedia: 6!·2⁶·12!·(12!)²/(2·4·3!⁸·12))
  const f = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
  assert.equal(POSICIONES, (f(6) * 64n * f(12) * f(12) ** 2n) / (2n * 4n * 6n ** 8n * 12n));
  assert.equal(POSICIONES, 31408133379194880000000n);
  // el subgrupo de la fase 3 (<R, L, B, D>) tiene 933.120 elementos y los triángulos no añaden nada
  assert.equal(g.ordenG2, ORDEN_G2);
  assert.equal(g.ordenG2EsquinasAristas, ORDEN_G2);
  guardarResultado('fto', { ordenGrupo: String(g.orden), posiciones: String(POSICIONES), msGrupo: g.ms });
});

test('FTO: las restricciones se cumplen en 2000 secuencias de giros al azar (comprobación empírica)', () => {
  const rng = rngConSemilla(91);
  const movs = CARAS.flatMap((c) => [c, c + "'"]);
  let e = modelo.resuelto;
  for (let i = 0; i < 2000; i++) {
    e = modelo.aplicarPiezas(e, movs[entero(rng, 16)]);
    assert.equal(paridad(e[ORB_ESQ].perm), 0);
    assert.equal(paridad(e[ORB_ARI].perm), 0);
    assert.equal(paridad(e[ORB_TA].perm), 0);
    assert.equal(paridad(e[ORB_TB].perm), 0);
    assert.ok(e[ORB_ARI].ori.every((o) => o === 0));
    assert.ok(e[ORB_ESQ].ori.every((o) => o === 0 || o === 2));
    assert.equal(e[ORB_ESQ].ori.reduce((a, o) => a + o / 2, 0) % 2, 0);
  }
});

test('FTO: cota inferior del número de Dios por conteo = 21 giros', () => {
  const { cota, porLongitud } = cotaInferiorConteo();
  assert.equal(cota, 21);
  // 1 secuencia vacía, 16 de un giro y 16·14 − 16 (las dos opuestas en un solo orden) = 208 de dos
  assert.deepEqual(porLongitud.slice(0, 3), [1n, 16n, 208n]);
  guardarResultado('fto', { cotaInferior: cota });
});

test('FTO: orientación libre (el resuelto en cualquiera de las 24 orientaciones es válido y está resuelto)', () => {
  for (const R of geo.rotaciones) {
    const e = aplicarPerm(res0, R);
    assert.ok(p.estaResuelto(e));
    assert.ok(p.validar(e).valido);
    const r = p.resolver(e, { tiempoMax: 50 });
    assert.ok(r.ok);
    assert.equal(r.movimientos.length, 0);
  }
});

test('FTO: simplificación (giros de la misma cara y de su opuesta, que conmuta)', () => {
  assert.deepEqual(simplificar(['U', 'U']), ["U'"]);
  assert.deepEqual(simplificar(['U', "U'"]), []);
  assert.deepEqual(simplificar(['U', 'D', 'U']), ["U'", 'D']);
  assert.deepEqual(simplificar(['R', 'BL', "R'", 'F']), ['BL', 'F']);
  assert.deepEqual(simplificar(['R', 'U', "U'", "R'"]), []);
  assert.equal(p.buscarRedundancia(['U', 'D', 'U']) !== null, true, 'U D U es redundante (U y D conmutan)');
  assert.equal(p.buscarRedundancia(['U', 'D', 'F', 'U']), null);
});

test('FTO: tablas del solver (tamaños y que cada una se llena entera)', () => {
  const [F1, F2, F3] = tablas();
  assert.deepEqual(F1.b.tablasPoda.map((t) => t.prof.length), [96800]);
  assert.deepEqual(F2.b.tablasPoda.map((t) => t.prof.length), [11289600, 35200, 35200, 35200, 35200]);
  assert.deepEqual(F3.b.tablasPoda.map((t) => t.prof.length), [3732480]);
  for (const t of [...F1.b.tablasPoda, ...F2.b.tablasPoda]) assert.equal(t.alcanzables, t.prof.length);
  // fase 3: exactamente los 933.120 estados de <R, L, B, D> (número de Dios dentro de G2: 11)
  assert.equal(F3.b.tablasPoda[0].alcanzables, 933120);
  assert.equal(F3.b.tablasPoda[0].profMax, 11);
  const bytes = [F1, F2, F3].flatMap((F) => F.b.tablasPoda).reduce((a, t) => a + t.prof.length, 0);
  guardarResultado('fto', { mbTablasPoda: +(bytes / 1e6).toFixed(1), msTablas: p.inicializar().ms });
});

test('FTO: scrambles de estado aleatorio válidos, sin redundancias y con piezas repartidas al azar', () => {
  const r = probarScrambles(p, 81, CASOS_SCR); // también pasa cada estado por el validador
  // reparto: qué esquina acaba en la posición 0 y qué arista en la posición 0 (estado uniforme)
  const rng = rngConSemilla(81);
  const esq = new Array(6).fill(0), ari = new Array(12).fill(0);
  for (let i = 0; i < CASOS_REPARTO; i++) {
    const e = p.aplicarSecuencia(res0, p.generarScramble(rng));
    const id = modelo.identificar(e);
    esq[id.orbitas[ORB_ESQ].perm[0]]++;
    ari[id.orbitas[ORB_ARI].perm[0]]++;
  }
  for (const c of esq) assert.ok(c > CASOS_REPARTO / 6 / 3, `esquinas: ${esq}`);
  for (const c of ari) assert.ok(c > 0, `aristas: ${ari}`);
  assert.ok(r.longitudMin >= 2);
  guardarResultado('fto', r);
});

test('FTO: el scramble lleva del resuelto de referencia exactamente al estado aleatorio elegido', () => {
  // generarScramble saca el estado con piezasAleatorias y lo busca en 12 marcos girados: con el
  // mismo generador, aplicar el scramble al resuelto tiene que dar justo ese estado (no uno girado)
  const r1 = rngConSemilla(85), r2 = rngConSemilla(85);
  for (let i = 0; i < casosPor(40, 10); i++) {
    const s = p.generarScramble(r1);
    let x;
    do { x = p.pegatinasDe(piezasAleatorias(r2)); } while (p.estaResuelto(x) || CARAS.some((c) => p.estaResuelto(p.aplicarMovimiento(x, c)) || p.estaResuelto(p.aplicarMovimiento(x, c + "'"))));
    assert.deepEqual(p.aplicarSecuencia(res0, s), x, `scramble ${i}`);
  }
});

test('FTO: estados aleatorios (los que usa el scramble) son válidos en el validador', () => {
  const rng = rngConSemilla(82);
  for (let i = 0; i < 200; i++) assert.ok(p.validar(p.pegatinasDe(piezasAleatorias(rng))).valido);
});

const rotarAzar = (e, i, rng) => aplicarPerm(e, geo.rotaciones[entero(rng, 24)]);

test(`FTO: el solver resuelve el 100 % (${CASOS_SOL} casos, puzzle reorientado al azar, giro a giro)`, () => {
  const r = probarSolver(p, { semilla: 83, transformar: rotarAzar, opciones: { tiempoMax: 300 }, n: CASOS_SOL });
  assert.ok(r.longitudMaxSolucion <= 40, `solución demasiado larga: ${r.longitudMaxSolucion}`);
  guardarResultado('fto', { ...r, cocienteFrenteACota: +(r.longitudMediaSolucion / 21).toFixed(2) });
});

test('FTO: estados imposibles rechazados con mensajes claros (uno por restricción)', () => {
  const base = p.aplicarSecuencia(res0, p.parsear("R U' BL F D' L B' BR U"));
  assert.ok(p.validar(base).valido);
  const poner = (e, pegs, cols) => { const r = e.slice(); pegs.forEach((f, j) => { r[f] = cols[j]; }); return r; };
  const de = (e, pegs) => pegs.map((f) => e[f]);
  const msgs = {};
  // dos esquinas intercambiadas (permutación impar)
  const [e0, e1] = [ESQUINAS[0].pegatinas, ESQUINAS[3].pegatinas];
  msgs.esquinas = debeRechazar(p, poner(poner(base, e0, de(base, e1)), e1, de(base, e0)), 'esquinas están intercambiadas');
  // dos aristas intercambiadas
  const [a0, a1] = [ARISTAS[2].pegatinas, ARISTAS[9].pegatinas];
  msgs.aristas = debeRechazar(p, poner(poner(base, a0, de(base, a1)), a1, de(base, a0)), 'aristas están intercambiadas');
  // una esquina girada media vuelta (orientación total imposible)
  const k = ESQUINAS[4].pegatinas, ck = de(base, k);
  msgs.mediaVuelta = debeRechazar(p, poner(base, k, [ck[2], ck[3], ck[0], ck[1]]), 'número par de esquinas giradas');
  // una esquina girada un cuarto de vuelta
  msgs.cuarto = debeRechazar(p, poner(base, k, [ck[1], ck[2], ck[3], ck[0]]), 'cuarto de vuelta');
  // una arista volteada
  const a = ARISTAS[5].pegatinas, ca = de(base, a);
  msgs.volteada = debeRechazar(p, poner(base, a, [ca[1], ca[0]]), 'volteada');
  // un triángulo de una órbita cambiado por uno de la otra (de distinto color)
  const tA = TRI_A.find((t) => base[t.pegatinas[0]] !== base[TRI_B[0].pegatinas[0]]).pegatinas[0];
  const tB = TRI_B[0].pegatinas[0];
  msgs.triangulos = debeRechazar(p, poner(base, [tA, tB], [base[tB], base[tA]]), 'caras imposibles');
  // esquina especular (dos pegatinas vecinas cambiadas)
  msgs.especular = debeRechazar(p, poner(base, k, [ck[1], ck[0], ck[2], ck[3]]), 'imagen especular');
  // pieza que no existe (una pegatina de una esquina cambiada por la de un triángulo de otro color)
  const t = TRI_B.find((x) => !ck.includes(base[x.pegatinas[0]])).pegatinas[0];
  msgs.inexistente = debeRechazar(p, poner(base, [k[0], t], [base[t], base[k[0]]]), 'no existe en un FTO real');
  // colores mal contados y pegatinas sin pintar
  msgs.colores = debeRechazar(p, poner(base, [0], [(base[0] + 1) % 8]), 'debería haber 9');
  msgs.vacia = debeRechazar(p, poner(base, [5], [-1]), 'sin pintar');
  guardarResultado('fto', { mensajes: msgs });
});

test('FTO: pintado en cualquier orientación (también las 12 que no están en el grupo), la solución es para esa orientación', () => {
  const rng = rngConSemilla(84);
  for (let i = 0; i < 24; i++) {
    const e = aplicarPerm(p.aplicarSecuencia(res0, p.generarScramble(rng)), geo.rotaciones[i]);
    const r = p.resolver(e, { tiempoMax: 0 });
    assert.ok(r.ok, (r.errores || []).join(' | '));
    let f = e;
    for (const m of r.movimientos) f = p.aplicarMovimiento(f, m);
    assert.ok(p.estaResuelto(f));
    assert.ok(r.fases.length >= 2 && r.fases.every((x) => x.fin > x.inicio));
  }
});
