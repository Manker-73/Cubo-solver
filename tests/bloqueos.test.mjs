// Cubos vendados (bloqueos definidos por el usuario): src/core/bloqueos.js y el 3x3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, guardarResultado } from './util.mjs';
import { resolverEnParalelo } from './paralelo.mjs';
import { rngConSemilla } from '../src/core/rng.js';
import cubo3 from '../src/puzzles/cubo3.js';
import { crear3x3Vendado } from '../src/puzzles/vendado.js';
import { crearAnalisisBloqueos, comprobarBloqueos, claveBloqueos, resolverBloqueos } from '../src/core/bloqueos.js';
import { soporteBloqueosNxN, bloquesDesdeFirma, firmaDesdeBloques } from '../src/puzzles/nxn-bloqueos.js';
import { soporteBloqueos3x3, EJEMPLOS_BLOQUEOS } from '../src/puzzles/cubo3-bloqueos.js';

const N_CASOS = Math.min(CASOS, 500);
const MS_SOLVER = parseInt(process.env.MS_BLOQUEOS || '700', 10);

// Configuraciones de la verificación (ver ESTADO.md)
const CONFIGS = [
  { id: 'sin-bloqueos', nombre: 'Sin bloqueos', def: [] },
  { id: 'pareja', nombre: 'Una pareja (UFR+UF)', def: [['UFR', 'UF']] },
  { id: '1x2x2', nombre: 'Un bloque 1x2x2', def: [['UFR', 'UF', 'UR', 'U']] },
  { id: 'varios', nombre: 'Varios bloques (pareja, barra 1x1x3, centro+arista)', def: [['UFR', 'UF'], ['DBL', 'DB', 'DBR'], ['L', 'FL']] },
  { id: 'casi-bloqueada', nombre: 'Casi bloqueada (2x2x2 + centros D y L unidos: solo gira B)', def: [['UFR', 'UF', 'UR', 'FR', 'U', 'F', 'R'], ['D', 'DL', 'L']] },
  { id: 'bicube', nombre: 'Bicube (E0400B43FC5A1)', def: 'E0400B43FC5A1' },
  { id: 'cab', nombre: 'CAB Cube 5-5 (22006F100000C6)', def: '22006F100000C6' },
  { id: 'meffert', nombre: 'Bandaged Cube de Meffert (33EC01800846)', def: '33EC01800846' },
  { id: 'most-signatures', nombre: 'Most signatures (10840080200C21)', def: '10840080200C21' },
];

const SOLO = process.env.BLOQUEOS ? process.env.BLOQUEOS.split(',') : null;
const resumen = {};

/** Aplica una secuencia comprobando la legalidad y los bloques en cada paso. */
function aplicarComprobando(p, estado, movs, que) {
  let e = estado;
  movs.forEach((m, i) => {
    const l = p.movimientoLegal(e, m);
    assert.ok(l.legal, `${que}: el movimiento ${i + 1} (${m}) es ilegal: ${l.motivo}\n${movs.join(' ')}`);
    e = p.aplicarMovimiento(e, m);
    assert.ok(p.bloquesIntactos(e), `${que}: tras el movimiento ${i + 1} (${m}) hay un bloque roto`);
  });
  return e;
}

// ---------- Configuraciones conocidas (firmas de la comunidad) ----------

test('bloqueos: firmas conocidas (Bandaged Cube Explorer) dan las cifras publicadas', () => {
  const s = soporteBloqueos3x3;
  // CAB Cube 5-5: 15.704 geometrías ("signatures") y 10 permutaciones (twistypuzzles.com)
  const cab = crearAnalisisBloqueos(s, bloquesDesdeFirma('22006F100000C6'));
  assert.equal(cab.info.geometrias, 15704);
  assert.equal(cab.info.grupoFase2, '10');
  assert.equal(cab.info.estados, '157040');
  // El BFS completo cuenta lo mismo que |geometrías| · |grupo de la fase 2|
  assert.equal(cab.bfs.tabla.tamano, 157040);
  // Bicube (E0400B43FC5A1) y Equator / Quintamese (300C0000000C03)
  const bi = crearAnalisisBloqueos(s, bloquesDesdeFirma('E0400B43FC5A1'));
  assert.equal(BigInt(bi.bfs.tabla.tamano), BigInt(bi.info.estados));
  const eq = crearAnalisisBloqueos(s, bloquesDesdeFirma('300C0000000C03'));
  assert.equal(BigInt(eq.bfs.tabla.tamano), BigInt(eq.info.estados));
  // Firma <-> bloques, ida y vuelta
  for (const f of ['22006F100000C6', '33EC01800846', 'E0400B43FC5A1', '300C0000000C03', '10840080200C21']) {
    assert.equal(firmaDesdeBloques(bloquesDesdeFirma(f)), f);
  }
  guardarResultado('bloqueos', { firmas: { cab: cab.info.geometrias + ' geometrías, ' + cab.info.grupoFase2 + ' permutaciones' } });
});

test('bloqueos: "Most signatures" tiene el doble de geometrías que de formas (barras simétricas con orientación)', () => {
  // twistypuzzles.com: 92.176 formas; aquí la geometría distingue la orientación de las
  // barras 1x1x3 (simétricas por un giro de 180°), así que salen exactamente el doble
  const a = crearAnalisisBloqueos(soporteBloqueos3x3, bloquesDesdeFirma('10840080200C21'));
  assert.equal(a.info.geometrias, 2 * 92176);
});

test('bloqueos: configuraciones imposibles y totalmente bloqueadas', () => {
  const s = soporteBloqueos3x3;
  const err = (def) => comprobarBloqueos(s, def).errores.join(' ');
  assert.match(err([['UFR', 'DBL']]), /no son vecinas/);
  assert.match(err([['UFR', 'U']]), /no son vecinas/); // esquina y centro solo se tocan en un vértice
  assert.match(err([['U', 'UF', 'F', 'DF', 'D']]), /centros opuestos/);
  assert.match(err([['UFR', 'UF'], ['UF', 'UL']]), /dos bloques/);
  assert.match(err([['UFR', 'XYZ']]), /no existe/);
  assert.match(comprobarBloqueos(s, [['UFR']]).avisos.join(' '), /solo tiene una pieza/);
  const tot = crearAnalisisBloqueos(s, [['UFR', 'UF', 'UR', 'FR', 'U', 'F', 'R'], ['DBL', 'DB', 'DL', 'BL', 'D', 'B', 'L']]);
  assert.ok(tot.info.bloqueado);
  assert.match(tot.info.errores.join(' '), /totalmente bloqueado/);
  // El puzzle con una configuración imposible no resuelve ni mezcla
  const p = crear3x3Vendado([['UFR', 'DBL']]);
  assert.equal(p.validar(p.estadoResuelto()).valido, false);
  assert.deepEqual(p.generarScramble(rngConSemilla(1)), []);
  // Muy limitada: el aviso dice cuántas geometrías y estados
  const casi = crearAnalisisBloqueos(s, [['UFR', 'UF', 'UR', 'FR', 'U', 'F', 'R'], ['D', 'DL', 'L']]);
  assert.deepEqual(casi.info.legalesResuelto, ['B', 'B2', "B'"]);
  assert.match(casi.info.avisos.join(' '), /muy limitado: 1 geometrías y 4 estados/);
});

test('bloqueos: movimientos ilegales, bloques rotos y estados inalcanzables', () => {
  const p = crear3x3Vendado([['UFR', 'UF']]);
  p.inicializar();
  const r = p.estadoResuelto();
  assert.throws(() => p.aplicarMovimiento(r, 'R'), /ilegal.*UFR\+UF/);
  assert.throws(() => p.aplicarMovimiento(r, 'M'), /ilegal/);
  assert.ok(p.movimientoLegal(r, 'U').legal);
  assert.ok(p.movimientoLegal(r, 'S').legal); // S (entre F y B) no toca ni UFR ni UF
  // Bloque roto (pintado a mano): R sin comprobar
  const roto = cubo3.aplicarMovimiento(r, 'R');
  const v = p.validar(roto);
  assert.equal(v.valido, false);
  assert.match(v.errores.join(' '), /roto/);
  // CAB: estado válido como 3x3 pero inalcanzable con esos bloques
  const cab = crear3x3Vendado('22006F100000C6');
  cab.inicializar();
  const raro = cubo3.aplicarSecuencia(cab.estadoResuelto(), ["R", "U", "R'", "U'"]);
  assert.ok(cubo3.validar(raro).valido);
  assert.equal(cab.validar(raro).valido, false);
});

test('bloqueos: capas centrales y rotaciones (M, E, S, x, y, z) y la solución en cualquier orientación', () => {
  const p = crear3x3Vendado([['U', 'UF'], ['DBL', 'DB']]);
  p.inicializar();
  const todos = ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'x', 'y', 'z'].flatMap((m) => [m, m + "'", m + '2']);
  const rng = rngConSemilla(9);
  for (let caso = 0; caso < 20; caso++) {
    // 40 movimientos legales cualesquiera (también capas centrales y rotaciones)
    let e = p.estadoResuelto();
    const movs = [];
    let centrales = 0;
    while (movs.length < 40) {
      const m = todos[Math.floor(rng() * todos.length)];
      if (!p.movimientoLegal(e, m).legal) { assert.throws(() => p.aplicarMovimiento(e, m), /ilegal/); continue; }
      e = p.aplicarMovimiento(e, m);
      assert.ok(p.bloquesIntactos(e));
      movs.push(m);
      if (/^[MES]/.test(m)) centrales++;
    }
    assert.ok(centrales > 0);
    const s = p.resolver(e, { msMax: 500 });
    assert.ok(s.ok, s.errores && s.errores.join(' '));
    const fin = aplicarComprobando(p, e, s.movimientos, 'solución');
    assert.ok(p.estaResuelto(fin), movs.join(' '));
  }
});

test('bloqueos: sin bloqueos coincide con el 3x3 normal', () => {
  const p = crear3x3Vendado([]);
  p.inicializar();
  cubo3.inicializar();
  const r1 = rngConSemilla(5), r2 = rngConSemilla(5);
  for (let i = 0; i < 20; i++) {
    const a = p.generarScramble(r1), b = cubo3.generarScramble(r2);
    assert.deepEqual(a, b);
    const e = cubo3.aplicarSecuencia(cubo3.estadoResuelto(), a);
    const s1 = p.resolver(e), s2 = cubo3.resolver(e);
    assert.ok(cubo3.estaResuelto(cubo3.aplicarSecuencia(e, s1.movimientos)));
    assert.equal(s1.estrategia, 'sin bloqueos');
    assert.ok(Math.abs(s1.movimientos.length - s2.movimientos.length) <= 1);
  }
  assert.equal(p.analisis().estados, '43252003274489856000');
});

test('bloqueos: la capa es genérica (2x2 vendado con el mismo código)', () => {
  const s2 = soporteBloqueosNxN(2);
  // sin bloques: el grupo del 2x2 con giros de cara (incluye las 24 orientaciones)
  const libre = crearAnalisisBloqueos(s2, [['UFR', 'UFL']], { limiteEstados: 0 });
  assert.ok(libre.ok);
  assert.ok(libre.info.geometrias > 1);
  const conU = crearAnalisisBloqueos(s2, [['UFR', 'UFL', 'UBR', 'UBL']]);
  // la capa U entera pegada: solo U y D... y los que no la cortan
  assert.deepEqual(conU.info.legalesResuelto.filter((m) => !/^[UD]/.test(m)), []);
});

test('bloqueos: ejemplos predefinidos válidos', () => {
  for (const ej of EJEMPLOS_BLOQUEOS) {
    const def = ej.firma ? bloquesDesdeFirma(ej.firma) : ej.bloques;
    const c = comprobarBloqueos(soporteBloqueos3x3, def);
    assert.deepEqual(c.errores, [], ej.nombre);
    assert.ok(claveBloqueos(def).length > 0);
  }
});

// ---------- 500 scrambles y soluciones por configuración ----------

for (const cfg of CONFIGS) {
  if (SOLO && !SOLO.includes(cfg.id)) continue;
  test(`bloqueos: ${cfg.nombre}: ${N_CASOS} scrambles y soluciones`, { timeout: 3 * 3600 * 1000 }, async () => {
    const p = crear3x3Vendado(cfg.def);
    const tIni = performance.now();
    p.inicializar();
    const msIni = performance.now() - tIni;
    const info = p.analisis();
    const rng = rngConSemilla(11);
    const scrambles = [], estados = [];
    let sumaScr = 0;
    const tScr = performance.now();
    for (let i = 0; i < N_CASOS; i++) {
      const s = p.generarScramble(rng);
      assert.equal(p.buscarRedundancia(s), null, `scramble ${i}: redundante`);
      const e = aplicarComprobando(p, p.estadoResuelto(), s, `scramble ${i}`);
      assert.ok(p.validar(e).valido, `scramble ${i}: estado no válido`);
      scrambles.push(s); estados.push(e); sumaScr += s.length;
    }
    const msScr = (performance.now() - tScr) / N_CASOS;
    const def = typeof cfg.def === 'string' ? bloquesDesdeFirma(cfg.def) : cfg.def;
    const { resultados } = await resolverEnParalelo({
      modulo: new URL('../src/puzzles/vendado.js', import.meta.url).href,
      exportar: 'crear3x3Vendado', args: [def],
      estados, opciones: { msMax: MS_SOLVER },
    });
    const est = { n: 0, suma: 0, ms: 0, msMax: 0, A: { n: 0, suma: 0, ms: 0 }, B: { n: 0, suma: 0, ms: 0, f1: 0, f2: 0 }, gana: {}, sin: { n: 0, suma: 0, optimas: 0 } };
    resultados.forEach(({ r, ms }, i) => {
      assert.ok(r.ok, `caso ${i}: ${(r.errores || []).join(' | ')}\nscramble: ${scrambles[i].join(' ')}`);
      assert.equal(p.buscarRedundanciaSolucion(r.movimientos), null, `caso ${i}: solución redundante`);
      const fin = aplicarComprobando(p, estados[i], r.movimientos, `solución ${i}`);
      assert.ok(p.estaResuelto(fin), `caso ${i}: la solución no resuelve\nscramble: ${scrambles[i].join(' ')}\nsolución: ${r.movimientos.join(' ')}`);
      est.n++; est.suma += r.movimientos.length; est.ms += ms; est.msMax = Math.max(est.msMax, ms);
      est.gana[r.estrategia] = (est.gana[r.estrategia] || 0) + 1;
      if (r.sinBloqueos) { est.sin.n++; est.sin.suma += r.sinBloqueos.longitud; if (r.sinBloqueos.optima) est.sin.optimas++; }
      const d = r.detalle;
      if (d && d.A) { est.A.n++; est.A.suma += d.A.longitud; est.A.ms += d.A.ms || 0; }
      if (d && d.B) {
        est.B.n++; est.B.suma += d.B.longitud; est.B.ms += d.B.ms || 0; est.B.f1 += d.B.fase1; est.B.f2 += d.B.fase2;
        // Fase 1 de la estrategia B: termina en la geometría resuelta
        const f1 = d.B.movimientos.slice(0, d.B.fase1);
        const tras1 = aplicarComprobando(p, estados[i], f1, `fase 1 (B) ${i}`);
        assert.ok(p.geometriaResuelta(tras1), `caso ${i}: la fase 1 no deja la geometría resuelta`);
        // Fase 2: empieza y acaba en la geometría resuelta y resuelve el cubo
        const tras2 = aplicarComprobando(p, tras1, d.B.movimientos.slice(d.B.fase1), `fase 2 (B) ${i}`);
        assert.ok(p.estaResuelto(tras2) && p.geometriaResuelta(tras2), `caso ${i}: la fase 2 no termina resuelta`);
      }
      if (r.estrategia === 'B' && r.vueltasGeometria) {
        // cada tramo de la fase 2 que indica el solver acaba en la geometría resuelta
        let e = estados[i];
        let k = 0;
        r.movimientos.forEach((m, j) => {
          e = p.aplicarMovimiento(e, m);
          if (r.vueltasGeometria[k] === j + 1) { assert.ok(p.geometriaResuelta(e), `caso ${i}: tramo de la fase 2 fuera de la geometría resuelta`); k++; }
        });
        assert.equal(r.vueltasGeometria[r.vueltasGeometria.length - 1], r.movimientos.length);
      }
    });
    const m2 = (x, n) => (n ? +(x / n).toFixed(2) : null);
    resumen[cfg.id] = {
      nombre: cfg.nombre,
      firma: typeof cfg.def === 'string' ? cfg.def : firmaDesdeBloques(cfg.def),
      geometrias: info.geometrias, estados: info.estados, estadosExacto: info.estadosExacto, espacio: info.espacio,
      msTablas: Math.round(msIni),
      scramble: { longitudMedia: m2(sumaScr, N_CASOS), msMedio: +msScr.toFixed(1) },
      resueltos: `${est.n}/${N_CASOS} (${((100 * est.n) / N_CASOS).toFixed(1)}%)`,
      elegida: { longitudMedia: m2(est.suma, est.n), msMedio: m2(est.ms, est.n), msMax: Math.round(est.msMax) },
      A: { n: est.A.n, longitudMedia: m2(est.A.suma, est.A.n), msMedio: m2(est.A.ms, est.A.n) },
      B: { n: est.B.n, longitudMedia: m2(est.B.suma, est.B.n), msMedio: m2(est.B.ms, est.B.n), fase1: m2(est.B.f1, est.B.n), fase2: m2(est.B.f2, est.B.n) },
      gana: est.gana,
      sinBloqueos: { longitudMedia: m2(est.sin.suma, est.sin.n), optimas: est.sin.optimas, n: est.sin.n },
    };
    guardarResultado('bloqueos', { [cfg.id]: resumen[cfg.id] });
    assert.equal(est.n, N_CASOS);
  });
}

test('bloqueos: la estrategia B se comprueba también fuera del Worker (resolverBloqueos)', () => {
  const p = crear3x3Vendado('22006F100000C6');
  p.inicializar();
  const A = p.analisisInterno();
  const rng = rngConSemilla(3);
  let conB = 0;
  for (let i = 0; i < 50; i++) {
    const S = A.mod.desempaquetar((() => { const k = new Uint32Array(A.mod.palabras); A.bfs.tabla.nesimo(1 + Math.floor(rng() * (A.bfs.tabla.tamano - 1)), k); return k; })());
    const r = resolverBloqueos(A, S, { msMax: 300 });
    assert.ok(r.res.A);
    // B puede no tener solución si todos los caminos desde la geometría resuelta
    // empiezan deshaciendo el último giro de la fase 1 (ver DECISIONES.md)
    if (!r.res.B) continue;
    conB++;
    assert.ok(r.res.A.movs.length <= r.res.B.movs.length, 'con BFS, la A es óptima');
    let T = S;
    r.res.B.movs.forEach((m, j) => {
      assert.ok(A.mod.legal(T, m));
      T = A.mod.aplicar(T, m);
      if (j + 1 === r.res.B.fase1) assert.equal(A.mod.claveG(A.mod.geometriaDe(T)), A.mod.claveG(A.mod.geometriaDe(A.mod.resuelto)));
    });
    assert.ok(A.mod.esResuelto(T));
  }
  assert.ok(conB >= 40, `B solo resolvió ${conB} de 50`);
});
