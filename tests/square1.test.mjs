// Square-1: modelo, formas, paridad (demostrada), validador, solver, scramble de
// estado aleatorio, giros imposibles y editor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p, { coloresDeIds, estadoAleatorioValido, MIN_MOVIMIENTOS, indicePegatina, INDICE_MEDIO, PALETA } from '../src/puzzles/square1.js';
import * as M from '../src/puzzles/square1-motor.js';
import { ordenGrupo } from '../src/core/grupo.js';
import { rngConSemilla, entero, barajar } from '../src/core/rng.js';
import { probarScrambles, guardarResultado, debeRechazar, CASOS } from './util.mjs';

const resuelto = () => M.estadoResueltoIds();
const igualesIds = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const azul = PALETA.findIndex((c) => c.nombre === 'azul');
const verde = PALETA.findIndex((c) => c.nombre === 'verde');

/** Secuencia legal aleatoria (giros elegidos entre los que dejan el "/" legal). */
function secuenciaLegal(rng, unidades) {
  let e = resuelto();
  const s = [];
  for (let i = 0; i < unidades; i++) {
    const op = [];
    for (let x = -5; x <= 6; x++) for (let y = -5; y <= 6; y++) if ((x || y) && M.sePuedeCortar(M.girarCapas(e, x, y))) op.push([x, y]);
    const [x, y] = op[entero(rng, op.length)];
    s.push(`(${x},${y})`, '/');
    e = M.cortar(M.girarCapas(e, x, y));
  }
  if (rng() < 0.5) s.push(`(${entero(rng, 11) - 5 || 1},${entero(rng, 12) - 5})`);
  return s;
}

test('Square-1: modelo (estado resuelto según la Regulación 12c1)', () => {
  // CAMBIO RESPECTO A LA NOCHE 1: el estado resuelto de la noche 1 tenía la capa
  // de arriba desplazada una casilla respecto a la de abajo (en el puzzle real
  // las dos están alineadas). Con el estado corregido, "/" desde resuelto es
  // legal pero CAMBIA la forma, y (1,0)/(-1,0) mantiene la forma de cubo, como
  // describe Jaap Scherphuis. Por eso ahora "(1,0) /" es legal y "(-1,0) /" no.
  const e = p.estadoResuelto();
  assert.ok(p.estaResuelto(e));
  assert.ok(p.sePuedeCortar(e));
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e, ['/', '/'])));
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e, ['(3,3)', '(-3,-3)'])));
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e, ['(6,6)'])), 'girar el puzzle entero 180° sigue estando resuelto');
  assert.ok(!p.estaResuelto(p.aplicarSecuencia(e, ['(3,0)'])));
  const tras = M.cortar(resuelto());
  assert.notEqual(M.mascara(tras.arriba), M.MASCARA_RESUELTO, '"/" desde resuelto cambia la forma');
  const cubo = M.aplicarSecuenciaIds(resuelto(), ['(1,0)', '/', '(-1,0)']);
  const cuadrada = (m) => { const t = M.textoMascara(m); return [...Array(12).keys()].some((r) => t.slice(r) + t.slice(0, r) === 'AEEAEEAEEAEE'); };
  assert.ok(cuadrada(M.mascara(cubo.arriba)) && cuadrada(M.mascara(cubo.abajo)), '(1,0)/(-1,0) deja las dos capas en forma de cuadrado');
  assert.ok(!cuadrada(M.mascara(tras.arriba)));
  assert.equal(cubo.medio, 1);
  // (-1,0) deja una esquina atravesando el corte: "/" ilegal (el modelo lanza error)
  assert.throws(() => p.aplicarSecuencia(e, ['(-1,0)', '/']), /ilegal/);
  assert.throws(() => M.aplicarSecuenciaIds(resuelto(), ['(-1,0)', '/']), /ilegal/);
  assert.deepEqual(p.parsear('(1,0)/ (-1, 2) /(3,3)/'), ['(1,0)', '/', '(-1,2)', '/', '(3,3)', '/']);
  assert.equal(p.formatear(['(1,0)', '/', '(-1,2)', '/', '(3,3)']), '(1,0)/ (-1,2)/ (3,3)');
  // colores del estado resuelto: frente azul (4d3), arriba blanco
  assert.equal(e.arriba.piezas[0][1], azul);
  assert.equal(e.arriba.piezas[0][0], 0);
});

test('Square-1: el modelo de colores y el de ids coinciden (300 secuencias legales)', () => {
  const rng = rngConSemilla(301);
  for (let i = 0; i < 300; i++) {
    const s = secuenciaLegal(rng, 1 + entero(rng, 14));
    const ids = M.aplicarSecuenciaIds(resuelto(), s);
    const col = p.aplicarSecuencia(p.estadoResuelto(), s);
    assert.deepEqual(col, coloresDeIds(ids), s.join(' '));
    assert.equal(p.sePuedeCortar(col), M.sePuedeCortar(ids));
    assert.ok(p.estaResuelto(p.aplicarSecuencia(col, p.invertir(s))));
  }
});

test('Square-1: máscaras y efecto de cada movimiento sobre la paridad (contra simulación)', () => {
  const rng = rngConSemilla(302);
  for (let i = 0; i < 2000; i++) {
    const e = M.aplicarSecuenciaIds(resuelto(), secuenciaLegal(rng, entero(rng, 12)));
    const t = M.mascara(e.arriba), b = M.mascara(e.abajo), par = M.paridadEstado(e);
    const x = entero(rng, 12), y = entero(rng, 12);
    const g = M.girarCapas(e, x, y);
    assert.equal(M.mascara(g.arriba), M.rotarArriba(t, x));
    assert.equal(M.mascara(g.abajo), M.rotarAbajo(b, y));
    assert.equal(M.paridadEstado(g), par ^ M.deltaParidadArriba(t, x) ^ M.deltaParidadAbajo(b, y));
    if (M.sePuedeCortar(g)) {
      const c = M.cortar(g);
      const [t2, b2] = M.cortarMascaras(M.mascara(g.arriba), M.mascara(g.abajo));
      assert.equal(M.mascara(c.arriba), t2);
      assert.equal(M.mascara(c.abajo), b2);
      assert.equal(M.paridadEstado(c), M.paridadEstado(g) ^ M.deltaParidadCorte(M.mascara(g.arriba), M.mascara(g.abajo)));
    }
  }
});

test('Square-1: formas (todas alcanzables)', () => {
  M.inicializarMotor();
  const T = M.tablas();
  assert.equal(M.MASCARAS.length, 322, 'máscaras válidas de una capa (número de Lucas L12)');
  // Formas de capa sin contar giros
  const clase = (m) => { let min = m; for (let r = 1; r < 12; r++) min = Math.min(min, M.rotarArriba(m, r)); return min; };
  const clases = new Map();
  for (const m of M.MASCARAS) clases.set(clase(m), M.esquinasDeMascara(m));
  const usables = [...clases.entries()].filter(([, c]) => c >= 2 && c <= 6);
  const porEsquinas = {};
  for (const [, c] of usables) porEsquinas[c] = (porEsquinas[c] || 0) + 1;
  assert.equal(usables.length, 29, 'formas de capa (con 2 a 6 esquinas)');
  assert.deepEqual(porEsquinas, { 2: 5, 3: 10, 4: 10, 5: 3, 6: 1 });
  let combos = 0;
  for (const [, ca] of usables) for (const [, cb] of usables) if (ca + cb === 8) combos++;
  assert.equal(combos, 170, 'combinaciones arriba/abajo sin contar giros');
  // Con giros: 19.305 combinaciones; todas alcanzables con las 4 combinaciones de paridad y capa del medio
  let alineadas = 0;
  for (const t of M.MASCARAS) for (const b of M.MASCARAS) {
    if (M.esquinasDeMascara(t) + M.esquinasDeMascara(b) !== 8) continue;
    alineadas++;
    for (let par = 0; par < 2; par++) for (let med = 0; med < 2; med++) assert.ok(M.alcanzable(t, b, par, med));
  }
  assert.equal(alineadas, 19305);
  assert.equal(T.alc.total, 19305 * 4);
  assert.equal(T.cortables.length, 3678, 'formas en las que se puede hacer "/" (como en la página de Jaap)');
  let maxFase1 = 0;
  for (const d of T.fase1) maxFase1 = Math.max(maxFase1, d);
  assert.equal(maxFase1, 7, 'como mucho 7 barras para llegar a la forma de cubo (con paridad)');
  guardarResultado('square1', { formasCapa: 29, combinacionesFormas: 170, combinacionesConGiros: 19305, formasCortables: 3678 });
});

test('Square-1: no hay ninguna restricción de paridad, ni con la capa del medio (demostración)', () => {
  // 1) BFS sobre (forma, paridad, medio) con (1,0), (0,1) y "/": en TODAS las
  //    formas aparecen las 4 combinaciones de paridad y capa del medio (test anterior).
  // 2) Schreier–Sims en la forma de cubo (marco de la fase 2), sobre las 16
  //    posiciones de piezas más 2 puntos para la capa del medio:
  const S = M.ESTADO_MARCO;
  const pos = [];
  for (const capa of ['arriba', 'abajo']) { const m = M.mascara(S[capa]); for (let k = 0; k < 12; k++) if (m & (1 << k)) pos.push([capa, k]); }
  const permDe = (f) => {
    const e2 = f(S);
    assert.equal(M.mascara(e2.arriba), M.MARCO_T); assert.equal(M.mascara(e2.abajo), M.MARCO_B);
    const a = pos.map(([c, k]) => S[c][k]), b = pos.map(([c, k]) => e2[c][k]);
    const P = b.map((id) => a.indexOf(id));
    P.push(e2.medio === S.medio ? 16 : 17, e2.medio === S.medio ? 17 : 16);
    return P;
  };
  const [g30, g03, gCorte, gCorte2] = M.GENERADORES_FASE2.map(permDe);
  // Solo con (3,0), (0,3) y "/": cada esquina va pegada a una arista
  assert.equal(ordenGrupo([g30, g03, gCorte]), 40320n * 2n);
  // Con la otra alineación en la que "/" conserva el cubo: todas las permutaciones PARES, con la capa del medio libre
  const orden = ordenGrupo([g30, g03, gCorte, gCorte2]);
  assert.equal(orden, 40320n * 40320n * 2n / 2n);
  // Los movimientos que conservan la forma de cubo son pares (Jaap), pero por
  // (1) la paridad impar también se alcanza en la forma de cubo pasando por
  // otras formas. Así, en la forma de cubo se alcanzan los 8!·8!·2 estados, y
  // por (1) lo mismo en cada una de las 19.305 formas: NO hay restricción de
  // paridad ni relación entre la paridad y la capa del medio.
  const r = p.validar(coloresDeIds(M.aplicarSecuenciaIds(resuelto(), ['(1,0)', '/', '(-1,0)'])));
  assert.ok(r.valido, 'capa del medio volteada sola: estado válido');
  // Dos aristas intercambiadas (permutación impar) y solo la capa del medio volteada: válidos y resolubles
  const imp = resuelto();
  imp.arriba[0] = 9; imp.arriba[3] = 8;
  const soloMedio = resuelto(); soloMedio.medio = 1;
  for (const e of [imp, soloMedio]) {
    const col = coloresDeIds(e);
    assert.ok(p.validar(col).valido);
    const s = p.resolver(col);
    assert.ok(s.ok);
    assert.ok(igualesIds(M.aplicarSecuenciaIds(e, s.movimientos), resuelto()));
  }
  guardarResultado('square1', { paridad: 'sin restricción: grupo en forma de cubo = 8!·8!·2; todas las formas con las 4 combinaciones paridad/medio' });
});

test('Square-1: scrambles de estado aleatorio válidos, legales y sin redundancias', () => {
  const r = probarScrambles(p, 71); // aplicarSecuencia lanza error ante cualquier "/" ilegal
  const rng = rngConSemilla(72);
  let barras = 0, wca = 0, giros = 0, minWCA = Infinity, empiezaCorte = 0;
  for (let i = 0; i < CASOS; i++) {
    const s = p.generarScramble(rng);
    for (const m of s) {
      if (m === '/') continue;
      const [x, y] = m.slice(1, -1).split(',').map(Number);
      assert.ok(x >= -5 && x <= 6 && y >= -5 && y <= 6 && (x || y), m);
    }
    const ids = M.aplicarSecuenciaIds(resuelto(), s);
    assert.ok(M.sePuedeCortar(ids), 'el estado mezclado debe permitir "/" sin girar antes (4b3d)');
    assert.ok(M.requiereAlMenos(ids, MIN_MOVIMIENTOS), 'el estado debe requerir al menos 11 movimientos (4b3d)');
    assert.ok(s.length >= MIN_MOVIMIENTOS);
    if (s[0] === '/') empiezaCorte++;
    barras += M.contarBarras(s); wca += s.length; giros += M.contarGiros(s); minWCA = Math.min(minWCA, s.length);
  }
  Object.assign(r, {
    barrasMedias: +(barras / CASOS).toFixed(2), movimientosWCAMedios: +(wca / CASOS).toFixed(2),
    giroMetricaMedia: +(giros / CASOS).toFixed(2), minMovimientosWCA: minWCA, empiezanPorBarra: empiezaCorte,
  });
  guardarResultado('square1', { scramble: r });
});

test('Square-1: el estado aleatorio es uniforme (formas, paridad y capa del medio)', () => {
  M.inicializarMotor();
  const T = M.tablas();
  const rng = rngConSemilla(73);
  const n = T.cortables.length * 20;
  const cuenta = new Map();
  let medio = 0, par = 0;
  for (let i = 0; i < n; i++) {
    const e = M.estadoAleatorioIds(rng);
    const s = M.indiceForma(M.mascara(e.arriba), M.mascara(e.abajo));
    cuenta.set(s, (cuenta.get(s) || 0) + 1);
    medio += e.medio; par += M.paridadEstado(e);
  }
  assert.equal(cuenta.size, T.cortables.length, 'salen todas las formas cortables');
  // chi cuadrado con 3677 grados de libertad: media 3677, desviación ≈ 86
  let chi = 0;
  for (const s of T.cortables) { const o = cuenta.get(s) || 0; chi += (o - 20) ** 2 / 20; }
  assert.ok(Math.abs(chi - 3677) < 6 * 86, `chi² = ${chi.toFixed(0)}`);
  assert.ok(Math.abs(medio / n - 0.5) < 0.02 && Math.abs(par / n - 0.5) < 0.02);
});

test('Square-1: el solver resuelve el 100 % (movimientos aplicados uno a uno, cualquier "/" ilegal = fallo)', () => {
  const msIni = p.inicializar().ms;
  const rng = rngConSemilla(74);
  let ok = 0, sb = 0, sw = 0, sg = 0, maxB = 0, maxW = 0, maxG = 0, t = 0, tmax = 0, noCortables = 0;
  for (let i = 0; i < CASOS; i++) {
    const s = p.generarScramble(rng);
    let e = p.aplicarSecuencia(p.estadoResuelto(), s);
    // la mitad de los casos se empieza girando las capas a una alineación cualquiera (a menudo sin "/" posible)
    if (i % 2) { e = p.aplicarMovimiento(e, `(${entero(rng, 11) - 5 || 1},${entero(rng, 12) - 5})`); if (!p.sePuedeCortar(e)) noCortables++; }
    const t0 = performance.now();
    const r = p.resolver(e);
    const dt = performance.now() - t0;
    assert.ok(r.ok, `caso ${i}: ${(r.errores || []).join(' | ')}`);
    assert.equal(p.buscarRedundancia(r.movimientos), null, `caso ${i}: solución con redundancias`);
    let x = e;
    for (const m of r.movimientos) x = p.aplicarMovimiento(x, m); // lanza error si un "/" es ilegal
    assert.deepEqual(x, p.estadoResuelto(), `caso ${i}: no queda resuelto\n${p.formatear(s)}\n${p.formatear(r.movimientos)}`);
    ok++;
    const b = M.contarBarras(r.movimientos), w = r.movimientos.length, g = M.contarGiros(r.movimientos);
    sb += b; sw += w; sg += g; maxB = Math.max(maxB, b); maxW = Math.max(maxW, w); maxG = Math.max(maxG, g);
    t += dt; tmax = Math.max(tmax, dt);
  }
  const res = {
    resueltos: `${ok}/${CASOS} (${((100 * ok) / CASOS).toFixed(1)}%)`,
    barrasMedia: +(sb / CASOS).toFixed(2), barrasMax: maxB,
    movimientosWCAMedia: +(sw / CASOS).toFixed(2), movimientosWCAMax: maxW,
    giroMetricaMedia: +(sg / CASOS).toFixed(2), giroMetricaMax: maxG,
    msMedio: +(t / CASOS).toFixed(1), msMax: +tmax.toFixed(1), msInicializacion: msIni,
    casosQueEmpiezanSinBarraPosible: noCortables,
  };
  guardarResultado('square1', { solver: res });
});

test('Square-1: giros imposibles — el solver resuelve un estado de cada una de las 19.305 combinaciones de formas', () => {
  M.inicializarMotor();
  const rng = rngConSemilla(75);
  // En modo rápido, una alineación por combinación de formas sin contar giros (170), eligiendo la menos cortable
  const todas = CASOS >= 1000;
  const clase = (m) => { let min = m; for (let r = 1; r < 12; r++) min = Math.min(min, M.rotarArriba(m, r)); return min; };
  const vistas = new Set();
  let resueltos = 0, sinBarra = 0, t = 0, tmax = 0, maxB = 0;
  const especiales = { estrella6: 0, ochoAristas2: 0 };
  for (const tm of M.MASCARAS) for (const bm of M.MASCARAS) {
    if (M.esquinasDeMascara(tm) + M.esquinasDeMascara(bm) !== 8) continue;
    if (!todas) {
      const k = clase(tm) * 4096 + clase(bm);
      if (vistas.has(k)) continue;
      vistas.add(k);
    }
    const e = M.estadoDeForma(tm, bm, barajar(rng, [0, 1, 2, 3, 4, 5, 6, 7]), barajar(rng, [8, 9, 10, 11, 12, 13, 14, 15]), entero(rng, 2));
    if (!M.sePuedeCortar(e)) sinBarra++;
    if (M.esquinasDeMascara(tm) === 6 || M.esquinasDeMascara(bm) === 6) especiales.estrella6++;
    if (M.esquinasDeMascara(tm) === 2 || M.esquinasDeMascara(bm) === 2) especiales.ochoAristas2++;
    const col = coloresDeIds(e);
    assert.ok(p.validar(col).valido, 'estado generado directamente: debe ser válido');
    const t0 = performance.now();
    const r = p.resolver(col, { msMax: 0 });
    const dt = performance.now() - t0;
    assert.ok(r.ok);
    let x = col;
    for (const m of r.movimientos) x = p.aplicarMovimiento(x, m);
    assert.ok(p.estaResuelto(x) && x.medio === 0, `${M.textoMascara(tm)} / ${M.textoMascara(bm)}`);
    resueltos++; t += dt; tmax = Math.max(tmax, dt); maxB = Math.max(maxB, M.contarBarras(r.movimientos));
  }
  assert.equal(resueltos, todas ? 19305 : 170);
  assert.ok(sinBarra > 0);
  guardarResultado('square1', {
    girosImposibles: {
      combinacionesProbadas: resueltos, empezabanSinBarraPosible: sinBarra, ...especiales,
      msMedioPrimeraSolucion: +(t / resueltos).toFixed(1), msMax: +tmax.toFixed(1), barrasMax: maxB,
    },
  });
});

test('Square-1: estados imposibles rechazados con su mensaje (y los raros pero posibles, aceptados)', () => {
  const base = () => p.estadoResuelto();
  const msgs = {};
  // pieza inexistente: esquina con un color repetido (blanco-azul-azul), compensando colores
  let e = base(); e.arriba.piezas[1][2] = azul; e.abajo.piezas[1][1] = PALETA.findIndex((c) => c.nombre === 'naranja');
  msgs.inexistente = debeRechazar(p, e, 'no existe');
  // pieza especular: laterales de una esquina intercambiados
  e = base(); { const q = e.arriba.piezas[1]; [q[1], q[2]] = [q[2], q[1]]; }
  msgs.especular = debeRechazar(p, e, 'especular');
  // esquina girada: la pegatina blanca en un lateral
  e = base(); { const q = e.arriba.piezas[1]; [q[0], q[1]] = [q[1], q[0]]; }
  msgs.girada = debeRechazar(p, e, 'girada');
  // arista volteada
  e = base(); { const q = e.arriba.piezas[0]; [q[0], q[1]] = [q[1], q[0]]; }
  msgs.volteada = debeRechazar(p, e, 'volteada');
  // pieza repetida (y otra que falta), con el número de colores correcto
  e = base(); e.arriba.piezas[0][1] = verde; e.abajo.piezas[4][1] = azul;
  msgs.repetida = debeRechazar(p, e, 'aparece 2 veces');
  assert.match(msgs.repetida, /Falta la arista/);
  // capa que no suma 12 casillas: una arista pasa de abajo a arriba
  e = base(); e.arriba.piezas.push(e.abajo.piezas.splice(0, 1)[0]); // la primera pieza de abajo es una arista
  msgs.casillas = debeRechazar(p, e, 'ocupa 13 casillas');
  // número de colores
  e = base(); e.arriba.piezas[0][1] = verde;
  msgs.colores = debeRechazar(p, e, 'de color azul');
  // pegatina sin pintar
  e = base(); e.abajo.piezas[2][0] = -1;
  msgs.sinPintar = debeRechazar(p, e, 'sin pintar');
  // capa del medio con un valor imposible
  e = base(); e.medio = 2;
  msgs.medio = debeRechazar(p, e, 'capa del medio');
  // Paridad: NO hay restricción (ver la demostración): dos aristas intercambiadas es válido
  e = base(); { const a = e.arriba.piezas; [a[0], a[2]] = [a[2], a[0]]; }
  assert.ok(p.validar(e).valido, 'dos aristas intercambiadas: válido (no hay paridad en el Square-1)');
  // Un estado válido en el que no se puede hacer "/" sin girar antes: debe aceptarse y resolverse
  const sinBarra = [p.aplicarSecuencia(base(), ['(-1,0)']), p.aplicarSecuencia(base(), ['(0,1)'])];
  // estrella (6 esquinas arriba) con 2 esquinas y 8 aristas abajo, en alineaciones donde "/" es imposible
  const estrella = M.MASCARAS.filter((m) => M.esquinasDeMascara(m) === 6);
  const dosEsq = M.MASCARAS.filter((m) => M.esquinasDeMascara(m) === 2);
  for (const t of estrella) for (const b of dosEsq.slice(0, 3)) {
    sinBarra.push(coloresDeIds(M.estadoDeForma(t, b, [0, 1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14, 15], 0)));
  }
  for (const x of sinBarra.filter((y) => !p.sePuedeCortar(y))) {
    assert.equal(p.sePuedeCortar(x), false);
    assert.ok(p.validar(x).valido, 'estado sin "/" posible: debe aceptarse');
    const r = p.resolver(x);
    assert.ok(r.ok);
    let y = x;
    for (const m of r.movimientos) y = p.aplicarMovimiento(y, m);
    assert.ok(p.estaResuelto(y));
  }
  assert.ok(sinBarra.filter((y) => !p.sePuedeCortar(y)).length >= 4);
  for (const [k, v] of Object.entries(msgs)) console.log(`  ${k}: ${v}`);
});

test('Square-1: longitud mínima exacta (4b3d)', () => {
  M.inicializarMotor();
  const rng = rngConSemilla(76);
  // Secuencias legales de 9 y 10 movimientos: siempre hay solución de esa longitud
  for (let i = 0; i < 40; i++) {
    const s = secuenciaLegal(rng, 5).slice(0, 9 + (i % 2));
    const e = M.aplicarSecuenciaIds(resuelto(), s);
    assert.ok(M.haySolucionCorta(e, s.length), s.join(' '));
    assert.ok(!M.requiereAlMenos(e, 11));
  }
  // Casos con su longitud exacta
  for (const s of [['/'], ['(1,0)', '/', '(-1,0)'], ['(1,0)', '/', '(3,3)', '/', '(-1,2)', '/', '(2,0)']]) {
    const e = M.aplicarSecuenciaIds(resuelto(), s);
    assert.ok(M.haySolucionCorta(e, s.length));
    assert.ok(!M.haySolucionCorta(e, s.length - 1));
  }
  const e = estadoAleatorioValido(rng);
  assert.ok(M.requiereAlMenos(e, 11));
});

test('Square-1: editor (mover piezas, pintar, girar capas, capa del medio)', () => {
  const rng = rngConSemilla(77);
  let e = p.estadoResuelto();
  // Desde la forma de cubo: esquina de arriba con arista de abajo => se intercambian esquina+arista y arista+esquina
  const esq = indicePegatina(0, 1, 0), ari = indicePegatina(1, 0, 0);
  const e2 = p.usarHerramienta(e, 'mover', [esq, ari]);
  const masc = (x) => [x.arriba, x.abajo].map((c) => { let m = 0, k = c.ini; for (const q of c.piezas) { m |= 1 << (k % 12); k += q.length - 1; } return m; });
  assert.notDeepEqual(masc(e2), masc(e), 'cambia la forma');
  assert.ok(p.validar(e2).valido, 'mover piezas no crea estados imposibles');
  // Y luego una esquina de abajo por dos aristas seguidas de arriba: 7 piezas arriba y 9 abajo
  const dosAristas = e2.arriba.piezas.findIndex((q, j) => q.length === 2 && e2.arriba.piezas[(j + 1) % e2.arriba.piezas.length].length === 2);
  assert.ok(dosAristas >= 0);
  const e3 = p.usarHerramienta(e2, 'mover', [indicePegatina(1, e2.abajo.piezas.findIndex((q) => q.length === 3), 0), indicePegatina(0, dosAristas, 0)]);
  assert.equal(e3.arriba.piezas.length, 7);
  assert.equal(e3.abajo.piezas.length, 9);
  assert.ok(p.validar(e3).valido);
  // Muchos intercambios al azar: siempre válidos y resolubles
  for (let i = 0; i < 300; i++) {
    const elegir = () => {
      const capa = entero(rng, 2);
      const n = e[capa ? 'abajo' : 'arriba'].piezas.length;
      return indicePegatina(capa, entero(rng, n), 0);
    };
    try { e = p.usarHerramienta(e, 'mover', [elegir(), elegir()]); } catch (err) { assert.match(err.message, /demasiado juntas/); }
    if (i % 7 === 0) e = p.aplicarAccion(e, ['a+', 'a-', 'b+', 'b-', 'medio'][entero(rng, 5)]);
    const v = p.validar(e);
    assert.ok(v.valido, v.errores.join(' | '));
  }
  const r = p.resolver(e);
  assert.ok(r.ok);
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e, r.movimientos)));
  // pintar y la barra del medio
  const pintado = p.pintar(p.estadoResuelto(), indicePegatina(0, 0, 1), verde);
  assert.equal(pintado.arriba.piezas[0][1], verde);
  assert.equal(p.validar(pintado).valido, false);
  assert.equal(p.pintar(p.estadoResuelto(), INDICE_MEDIO, 0).medio, 1);
  // El dibujo marca pegatinas editables y la selección
  const svg = p.renderizar(p.estadoResuelto(), { editable: true, seleccion: indicePegatina(0, 1, 0) });
  assert.match(svg, /class="pegatina sel" data-i="10"/);
  assert.match(svg, new RegExp(`data-i="${INDICE_MEDIO}"`));
  // clonar no comparte arrays
  const c = p.clonar(e); c.arriba.piezas[0][0] = 5;
  assert.notEqual(e.arriba.piezas[0][0], 5);
});
