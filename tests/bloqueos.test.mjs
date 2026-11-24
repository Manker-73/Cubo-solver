// Cubos vendados (bloqueos definidos por el usuario): src/core/bloqueos.js y el 3x3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, COMPLETO, casosPor, guardarResultado } from './util.mjs';
import { resolverEnParalelo } from './paralelo.mjs';
import { rngConSemilla } from '../src/core/rng.js';
import cubo3 from '../src/puzzles/cubo3.js';
import { crear3x3Vendado } from '../src/puzzles/vendado.js';
import { crearAnalisisBloqueos, comprobarBloqueos, claveBloqueos, resolverBloqueos, puzzleConBloqueos } from '../src/core/bloqueos.js';
import { definirPuzzle } from '../src/core/puzzle.js';
import { soporteBloqueosNxN, bloquesDesdeFirma, firmaDesdeBloques } from '../src/puzzles/nxn-bloqueos.js';
import { soporteBloqueos3x3, EJEMPLOS_BLOQUEOS } from '../src/puzzles/cubo3-bloqueos.js';

// rápido: cada caso son ~1,1 s de solver con límite de tiempo (A, B y la comparación sin bloqueos)
const N_CASOS = casosPor(Math.min(CASOS, 500), 10, 'CASOS_BLOQUEOS');
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
  { id: 'meffert', nombre: 'Bandaged Cube de Meffert (1680008C2FB461, centros opuestos)', def: '1680008C2FB461' },
  { id: 'bandaged-cube', nombre: 'Bandaged Cube de twistypuzzles (33EC01800846)', def: '33EC01800846' },
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
  // Bandaged Cube de Meffert (1680008C2FB461, con un bloque L + DL + D + DR + R + núcleo, dos
  // centros opuestos): 32 formas y 58.320 permutaciones (foro de twistypuzzles)
  const mef = crearAnalisisBloqueos(s, bloquesDesdeFirma('1680008C2FB461'));
  assert.deepEqual(mef.info.errores, []);
  assert.equal(mef.info.geometrias, 32);
  assert.equal(mef.info.grupoFase2, '58320');
  assert.equal(mef.bfs.tabla.tamano, 32 * 58320);
  // Firma <-> bloques, ida y vuelta
  for (const f of ['1680008C2FB461', '22006F100000C6', '33EC01800846', 'E0400B43FC5A1', '300C0000000C03', '10840080200C21']) {
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
  // dos centros opuestos sí se pueden unir (a través de aristas o del núcleo), como en cubos reales
  assert.equal(err([['U', 'UF', 'F', 'DF', 'D']]), '');
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
  for (let caso = 0; caso < casosPor(20, 6); caso++) {
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

test('bloqueos: el envoltorio solo tiene vista 3D si el puzzle de debajo la tiene', () => {
  // con 3D: la del 3x3, con las pegatinas de un mismo bloque unidas
  const con = crear3x3Vendado([['UFR', 'UF']]);
  assert.equal(typeof con.vista3D, 'function');
  assert.ok(con.vista3D(con.estadoResuelto()).geometria.pegatinas.some((q) => q.expandir));
  // sin 3D: el mismo 3x3 sin vista3D (como un puzzle que no la tiene)
  const sin3D = definirPuzzle({ ...cubo3, vista3D: undefined, giro3D: undefined });
  const p = puzzleConBloqueos(sin3D, [['UFR', 'UF']]);
  assert.equal(p.vista3D, undefined);
  assert.equal(p.giro3D, undefined);
  // lo demás sigue funcionando: dibujo 2D con los bloques unidos, scramble y solución
  assert.match(p.renderizar(p.estadoResuelto()), /<svg/);
  p.inicializar();
  const e = p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rngConSemilla(4)));
  const s = p.resolver(e, { msMax: 300, compararSinBloqueos: false });
  assert.ok(s.ok);
  assert.ok(p.estaResuelto(aplicarComprobando(p, e, s.movimientos, 'sin 3D')));
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
    // rápido, espacio pequeño: en este hilo, que ya tiene la tabla del BFS completo (generarla
    // otra vez en cada worker_thread costaba más que resolver los casos: hasta 6 s por copia)
    const enEsteHilo = !COMPLETO && info.espacio === 'pequeño';
    const { resultados } = enEsteHilo
      ? { resultados: estados.map((e) => { const t = performance.now(); const r = p.resolver(e, { msMax: MS_SOLVER }); return { r, ms: performance.now() - t }; }) }
      : await resolverEnParalelo({
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

// ===========================================================================
// Noche 13: 4x4 y 5x5 vendados (identidad de las piezas iguales)
// ===========================================================================
import { soporteBloqueosIdentidad, EJEMPLOS_NXN, analizarGiroVendado } from '../src/puzzles/nxn-identidad.js';
import { crearNxNVendado } from '../src/puzzles/vendado.js';
import { crearCadena, completarAleatorio } from '../src/core/schreier.js';

/** Claves de las piezas cuyo cubie cumple f (coordenadas en pasos de 2; sin el núcleo). */
const piezasDonde = (N, f) => soporteBloqueosIdentidad(N).piezas.filter((p) => p.tipo !== 'nucleo' && f(...p.cubie)).map((p) => p.clave);
/** Casi bloqueada: todo lo que no está en U ni en R pegado en un bloque, y la barra UR (solo giran U y R). */
const casiBloqueada = (N) => [piezasDonde(N, (x, y) => x <= N - 3 && y <= N - 3), N === 4 ? ['UBR', 'UR1', 'UR2', 'UFR'] : ['UBR', 'UR1', 'UR', 'UR3', 'UFR']];
const ej = (N, id) => EJEMPLOS_NXN[N].find((e) => e.id === id).bloques;

const CONFIGS_NXN = [
  { N: 4, id: 'pareja', nombre: '4x4: una pareja (UFR+UF2)', def: ej(4, 'pareja') },
  { N: 4, id: 'barra', nombre: '4x4: una barra 1x1x4', def: ej(4, 'barra') },
  { N: 4, id: 'centros', nombre: '4x4: los cuatro centros de U', def: ej(4, 'centros') },
  { N: 4, id: 'varios', nombre: '4x4: varios bloques', def: ej(4, 'varios') },
  { N: 4, id: 'casi', nombre: '4x4: casi bloqueada (solo U y R; espacio pequeño)', def: casiBloqueada(4) },
  { N: 5, id: 'pareja', nombre: '5x5: una pareja (UFR+UF3)', def: ej(5, 'pareja') },
  { N: 5, id: 'barra', nombre: '5x5: una barra 1x1x5', def: ej(5, 'barra') },
  { N: 5, id: 'centros', nombre: '5x5: los nueve centros de U', def: ej(5, 'centros') },
  { N: 5, id: 'opuestos', nombre: '5x5: centros opuestos U y D unidos por el núcleo', def: ej(5, 'opuestos') },
  { N: 5, id: 'varios', nombre: '5x5: varios bloques', def: ej(5, 'varios') },
  { N: 5, id: 'casi', nombre: '5x5: casi bloqueada (solo U y R; espacio pequeño)', def: casiBloqueada(5) },
];

test('bloqueos NxN: piezas, nombres, giros de búsqueda y notación (3Uw = D + rotación)', () => {
  const s4 = soporteBloqueosIdentidad(4), s5 = soporteBloqueosIdentidad(5);
  // 4x4: 8 esquinas, 24 wings, 24 centros; 5x5: + 12 aristas centrales, 24 + 24 centros, 6 fijos y núcleo
  const cuenta = (s) => s.piezas.reduce((m, p) => ({ ...m, [p.tipo]: (m[p.tipo] || 0) + 1 }), {});
  assert.deepEqual(cuenta(s4), { esquina: 8, arista: 24, centro: 24 });
  assert.deepEqual(cuenta(s5), { esquina: 8, arista: 24, 'arista-central': 12, 'centro-x': 24, 'centro-t': 24, centro: 6, nucleo: 1 });
  assert.ok(['UFR', 'UF1', 'UF2', 'U11', 'U22'].every((k) => s4.piezas.some((p) => p.clave === k)));
  assert.ok(['UFR', 'UF1', 'UF', 'UF3', 'U11', 'U12', 'U', 'núcleo'].every((k) => s5.piezas.some((p) => p.clave === k)));
  // UF1 es la wing de UF del lado de L (pegatina de U en la fila de abajo, columna 1)
  assert.deepEqual(s4.piezas.find((p) => p.clave === 'UF1').puntos.filter((q) => q < 16), [13]);
  // centros iguales: 6 clases de 4 en el 4x4; 12 en el 5x5 (X y cruz por color); los fijos no
  assert.deepEqual(s4.iguales.map((c) => c.length), [4, 4, 4, 4, 4, 4]);
  assert.equal(s5.iguales.length, 12);
  // giros de búsqueda: 4x4 U, R, F de 1 a 3 capas (la esquina DBL no se mueve); 5x5 las 6 caras
  // de 1 y 2 capas y las capas interiores 2U… (ver el test de las capas interiores)
  assert.equal(s4.busqueda.length, 27);
  assert.ok(s4.busqueda.includes('3Uw') && !s4.busqueda.some((m) => /^[DLB]/.test(m)));
  assert.equal(s5.busqueda.length, 54);
  assert.deepEqual(analizarGiroVendado("2U'", 5), { cara: 'U', desde: 2, hasta: 2, veces: 3, rotacion: false });
  assert.throws(() => analizarGiroVendado('3U', 5)); // la capa del medio (lleva los centros fijos) no
  // notación: 3Uw se escribe D y los giros siguientes se traducen; mismo estado salvo una rotación
  assert.deepEqual(s4.notacion(['3Uw', 'R', "3Fw'"]), ['D', 'B', "L'"]); // 3Uw = D + y: tras D falta la y, y la R del plan es la cara que está en B
  const p = crearNxNVendado(4, []);
  const rng = rngConSemilla(2);
  for (let k = 0; k < casosPor(200, 30); k++) {
    const movs = Array.from({ length: 25 }, () => s4.todos[Math.floor(rng() * s4.todos.length)]);
    const a = s4.identificar(p.aplicarSecuencia(p.estadoResuelto(), movs)).donde;
    const b = s4.identificar(p.aplicarSecuencia(p.estadoResuelto(), s4.notacion(movs))).donde;
    assert.ok(s4.rotaciones.some((Q) => a.every((x, i) => Q[x] === b[i])), movs.join(' '));
    assert.ok(!s4.notacion(movs).some((m) => /^3/.test(m)));
  }
});

test('bloqueos NxN: legalidad = mover todas las piezas de cada bloque o ninguna, con todos los giros (caras, anchos, interiores)', () => {
  for (const N of [4, 5]) {
    const s = soporteBloqueosIdentidad(N);
    const todos = s.todos.concat(N === 4 ? ['2U', '2R', "2F'", '3D2'] : []).concat(['x', 'y2', "z'"]);
    for (const cfg of CONFIGS_NXN.filter((c) => c.N === N)) {
      const p = crearNxNVendado(N, cfg.def);
      const bloques = p.piezasDeBloques().map((b) => b.piezas.map((k) => s.piezas.find((q) => q.clave === k)));
      const rng = rngConSemilla(N * 10 + cfg.id.length);
      let e = p.estadoResuelto();
      let legales = 0, ilegales = 0;
      for (let k = 0; k < casosPor(400, 80); k++) {
        const m = todos[Math.floor(rng() * todos.length)];
        // regla directa: el mapa del giro mueve todos los puntos de cada bloque o ninguno
        const donde = s.identificar(e).donde, M = s.mapa(m);
        const regla = bloques.every((b) => { const mov = b.flatMap((q) => q.puntos).map((q) => M[donde[q]] !== donde[q] || s.enCapa(m)[donde[q]] === 1); return mov.every(Boolean) || mov.every((x) => !x); });
        const l = p.movimientoLegal(e, m).legal;
        assert.equal(l, regla, `${cfg.nombre}: ${m}`);
        if (l) { e = p.aplicarMovimiento(e, m); assert.ok(p.bloquesIntactos(e)); legales++; } else { assert.throws(() => p.aplicarMovimiento(e, m), /ilegal/); ilegales++; }
      }
      assert.ok(legales > 0 && ilegales > 0, cfg.nombre);
    }
  }
});

test('bloqueos NxN: reglas de validación de los bloques (N par sin núcleo; N impar con núcleo y centros opuestos)', () => {
  const s4 = soporteBloqueosIdentidad(4), s5 = soporteBloqueosIdentidad(5);
  const err = (s, def) => comprobarBloqueos(s, def).errores.join(' ');
  // vecinas: cubies que comparten una cara
  assert.equal(err(s4, [['UFR', 'UF2', 'U22']]), '');
  assert.match(err(s4, [['UFR', 'U22']]), /no son vecinas/); // esquina y centro: solo un vértice
  assert.match(err(s4, [['U11', 'U22']]), /no son vecinas/); // centros en diagonal
  assert.match(err(s4, [['U22', 'F12']]), /no son vecinas/); // centros de caras distintas no se tocan
  // N par: no hay núcleo ni centro fijo: dos centros opuestos solo se unen a través de piezas de la superficie
  assert.ok(!s4.piezas.some((p) => p.tipo === 'nucleo'));
  assert.match(err(s4, [['U22', 'D22']]), /no son vecinas/);
  // N impar: el núcleo, unido a los seis centros fijos (no a los demás centros)
  assert.equal(err(s5, [['U', 'núcleo', 'D']]), '');
  assert.match(err(s5, [['U12', 'núcleo']]), /no son vecinas/);
  assert.match(err(s5, [['U', 'D']]), /no son vecinas/);
  // totalmente bloqueado: cada plano de corte lo cruza algún bloque
  for (const N of [4, 5]) {
    const tot = crearAnalisisBloqueos(soporteBloqueosIdentidad(N), [piezasDonde(N, () => true)]);
    assert.ok(tot.info.bloqueado);
    assert.match(tot.info.errores.join(' '), /totalmente bloqueado/);
    // basta con que quede un plano libre para que no lo esté
    const casi = crearAnalisisBloqueos(soporteBloqueosIdentidad(N), [piezasDonde(N, (x, y) => y < N - 1)], { limiteEstados: 0 });
    assert.ok(!casi.info.bloqueado);
    assert.deepEqual(casi.info.legalesResuelto.map((m) => m.replace(/['2]$/, '')).filter((v, i, a) => a.indexOf(v) === i), ['U']);
  }
});

test('bloqueos NxN: los giros de búsqueda alcanzan todo (BFS con todos los giros, salvo rotación) y en el 5x5 hacen falta las capas interiores', () => {
  // Con todos los giros con nombre (caras opuestas, anchos de N−1 capas, capas interiores 2U…) y las
  // rotaciones, el BFS de aspectos (normalizando la orientación) llega a los mismos estados que con
  // los giros de búsqueda: la demostración está en DECISIONES.md (noche 13) y esto la comprueba.
  for (const N of [4, 5]) {
    const s = soporteBloqueosIdentidad(N);
    const def = casiBloqueada(N);
    const A = crearAnalisisBloqueos(s, def);
    assert.ok(A.bfs);
    const p = crearNxNVendado(N, def);
    p.inicializar();
    const extra = N === 4 ? ['2U', '2R', '2F', '2D', '2L', '2B'] : [];
    const todos = s.todos.concat(extra.flatMap((m) => [m, m + '2', m + "'"])).concat(['x', 'y', 'z']);
    const clave = (e) => { const r = p.analisisInterno().mod; const n = s.identificar(e).donde; const Q = s.rotaciones.find((R) => [...Array(s.puntos).keys()].filter((q) => r.fijo[q]).every((q) => R[n[q]] === q)); const d = Int16Array.from(n, (x) => Q[x]); return Array.from(r.SDesdeDonde(d)).join(','); };
    const vistos = new Set([clave(p.estadoResuelto())]);
    let frontera = [p.estadoResuelto()];
    while (frontera.length) {
      const sig = [];
      for (const e of frontera) for (const m of todos) {
        if (!p.movimientoLegal(e, m).legal) continue;
        const e2 = p.aplicarMovimiento(e, m), k = clave(e2);
        if (!vistos.has(k)) { vistos.add(k); sig.push(e2); }
      }
      frontera = sig;
    }
    assert.equal(vistos.size, A.bfs.tabla.tamano, `${N}x${N}`);
  }
  // 5x5 con U + núcleo + D: 2U es legal aunque U y Uw no lo sean, así que sin las capas interiores
  // no se llegaría a todo
  const s5 = soporteBloqueosIdentidad(5);
  const op = crearAnalisisBloqueos(s5, ej(5, 'opuestos'), { limiteEstados: 0, msMinkwitz: 0 });
  assert.ok(op.info.legalesResuelto.includes('2U') && !op.info.legalesResuelto.includes('U') && !op.info.legalesResuelto.includes('Uw'));
});

test('bloqueos NxN: recuento de estados distinguibles (cifras publicadas sin bloques y BFS completo en los pequeños)', () => {
  // Sin bloques, el recuento con piezas iguales da las cifras conocidas del 4x4 y el 5x5
  const libre4 = crearAnalisisBloqueos(soporteBloqueosIdentidad(4), [], { rng: rngConSemilla(1), limiteEstados: 0, msMinkwitz: 0 });
  assert.equal(libre4.info.estadosDistinguibles, '7401196841564901869874093974498574336000000000');
  assert.ok(libre4.info.distinguiblesExacto);
  const libre5 = crearAnalisisBloqueos(soporteBloqueosIdentidad(5), [], { rng: rngConSemilla(1), limiteEstados: 0, msMinkwitz: 0 });
  assert.equal(libre5.info.estadosDistinguibles, '282870942277741856536180333107150328293127731985672134721536000000000000000');
  // Espacios pequeños: aspectos distintos (colores + qué posiciones están pegadas) en el BFS completo
  const resumenRecuento = {};
  for (const N of [4, 5]) {
    const s = soporteBloqueosIdentidad(N);
    const n2 = N * N;
    const casos = {
      casi: casiBloqueada(N),
      // con un bloque de centros del mismo color que puede girar (K no trivial por los bloques)
      'casi+centros': casiBloqueada(N).concat([N === 4 ? ['U11', 'U12', 'U21', 'U22'] : ['U11', 'U12', 'U21', 'U']]),
      'solo-y': [piezasDonde(N, (x, y) => y <= -(N - 3))],
    };
    for (const [id, def] of Object.entries(casos)) {
      const A = crearAnalisisBloqueos(s, def, { rng: rngConSemilla(1) });
      assert.ok(A.bfs, id);
      const { mod } = A;
      const vistos = new Set();
      const k = new Uint32Array(mod.palabras);
      for (let t = 0; t < A.bfs.tabla.tamano; t++) {
        A.bfs.tabla.nesimo(t, k);
        const donde = mod.dondeDesdeS(mod.desempaquetar(k));
        const col = s.estadoDesde(donde).map((x) => Math.floor(x / n2)).join('');
        const pegado = mod.bloques.map((b) => b.piezas.flatMap((kk) => s.piezas[kk].puntos.map((q) => donde[q])).sort((a, b) => a - b).join(',')).sort().join('|');
        vistos.add(col + '#' + pegado);
      }
      assert.equal(String(A.bfs.tabla.tamano), A.info.estados, `${N}x${N} ${id}: estados`);
      assert.equal(String(vistos.size), A.info.estadosDistinguibles, `${N}x${N} ${id}: distinguibles`);
      assert.ok(A.info.distinguiblesExacto);
      resumenRecuento[`${N}x${N} ${id}`] = `${A.info.estados} estados, ${A.info.estadosDistinguibles} distinguibles (|K| = ${A.info.simetriaIguales}); BFS: ${A.bfs.tabla.tamano} y ${vistos.size}`;
    }
  }
  guardarResultado('bloqueos', { recuentoNxN: resumenRecuento });
});

test('bloqueos NxN: Schreier–Sims aleatorio = determinista (orden del grupo de la fase 2)', () => {
  // El aleatorio (con prefijo de base) se usa con piezas iguales; el determinista, en el 3x3.
  // Aquí se cuentan los mismos grupos con los dos.
  for (const [N, id] of [[4, 'pareja'], [4, 'centros'], [5, 'opuestos']]) {
    const A = crearAnalisisBloqueos(soporteBloqueosIdentidad(N), ej(N, id), { rng: rngConSemilla(3), limiteEstados: 0, msMinkwitz: 0 });
    const det = crearCadena(A.mod.soporte.puntos);
    for (const g of A.g2.cadena.niveles[0].gens) det.incluir(g);
    assert.equal(det.orden().toString(), A.info.grupoFase2, `${N}x${N} ${id}`);
    // y otra cadena aleatoria con otra semilla da lo mismo
    const otra = crearCadena(A.mod.soporte.puntos, { sinSchreier: true });
    completarAleatorio(otra, A.g2.cadena.niveles[0].gens, rngConSemilla(99));
    assert.equal(otra.orden().toString(), A.info.grupoFase2);
  }
});

test('bloqueos NxN: solución óptima "a la vista" en los espacios pequeños (BFS de aspectos)', () => {
  for (const N of [4, 5]) {
    const def = casiBloqueada(N).concat([N === 4 ? ['U11', 'U12', 'U21', 'U22'] : ['U11', 'U12', 'U21', 'U']]);
    const p = crearNxNVendado(N, def, { rng: rngConSemilla(1) });
    p.inicializar();
    const A = p.analisisInterno(), { mod } = A, s = mod.soporte, n2 = N * N;
    const aspecto = (S) => { const d = mod.dondeDesdeS(S); return s.estadoDesde(d).map((x) => Math.floor(x / n2)).join('') + '#' + mod.bloques.map((b) => b.piezas.flatMap((kk) => s.piezas[kk].puntos.map((q) => d[q])).sort((a, b) => a - b).join(',')).sort().join('|'); };
    const dist = new Map([[aspecto(mod.resuelto), 0]]);
    let fr = [mod.resuelto];
    for (let d = 0; fr.length; d++) { const sig = []; for (const S of fr) for (let m = 0; m < mod.nM; m++) { if (!mod.legal(S, m)) continue; const T = mod.aplicar(S, m), k = aspecto(T); if (!dist.has(k)) { dist.set(k, d + 1); sig.push(T); } } fr = sig; }
    const k = new Uint32Array(mod.palabras);
    for (let t = 0; t < A.bfs.tabla.tamano; t++) {
      A.bfs.tabla.nesimo(t, k);
      const S = mod.desempaquetar(k);
      const r = resolverBloqueos(A, S, { msMax: 100 });
      assert.equal(r.movs.length, dist.get(aspecto(S)), `${N}x${N}: estado ${t}`);
    }
  }
});

test('bloqueos NxN: pintar está desactivado y el estado es de identidades (validar rechaza lo que no lo es)', () => {
  const p = crearNxNVendado(4, ej(4, 'pareja'));
  assert.deepEqual(p.pegatinasEditables(p.estadoResuelto()), []);
  assert.match(p.avisoPintar, /no se puede pintar/);
  const colores = p.colores(p.estadoResuelto());
  assert.equal(colores[0], 0); assert.equal(colores[95], 5);
  p.inicializar();
  assert.equal(p.validar(colores).valido, false); // un estado de colores no es una permutación
  const roto = p.estadoResuelto(); [roto[15], roto[14]] = [roto[14], roto[15]]; // esquina y wing cambiadas: piezas rotas
  assert.equal(p.validar(roto).valido, false);
  // sin bloques delega en el 4x4 normal (sobre los colores)
  const libre = crearNxNVendado(4, []);
  libre.inicializar();
  const e = libre.aplicarSecuencia(libre.estadoResuelto(), ['R', 'Uw', "F'", '3Rw2']);
  const s = libre.resolver(e);
  assert.ok(s.ok);
  assert.ok(libre.estaResuelto(libre.aplicarSecuencia(e, s.movimientos)));
});

// ---------- 4x4 y 5x5: scrambles y soluciones (500 casos por configuración en la suite completa) ----------
const N_CASOS_NXN = casosPor(Math.min(CASOS, 500), 6, 'CASOS_BLOQUEOS');
const SOLO_NXN = process.env.BLOQUEOS_NXN ? process.env.BLOQUEOS_NXN.split(',') : null;
for (const cfg of CONFIGS_NXN) {
  const clave = `${cfg.N}x${cfg.N}-${cfg.id}`;
  if (SOLO_NXN && !SOLO_NXN.includes(clave)) continue;
  test(`bloqueos NxN: ${cfg.nombre}: ${N_CASOS_NXN} scrambles y soluciones`, { timeout: 3 * 3600 * 1000 }, async () => {
    const p = crearNxNVendado(cfg.N, cfg.def, { rng: rngConSemilla(7) });
    const tIni = performance.now();
    p.inicializar();
    const msIni = performance.now() - tIni;
    const info = p.analisis();
    assert.deepEqual(info.errores, []);
    const rng = rngConSemilla(11);
    const scrambles = [], estados = [];
    let sumaScr = 0;
    const tScr = performance.now();
    for (let i = 0; i < N_CASOS_NXN; i++) {
      const s = p.generarScramble(rng);
      assert.equal(p.buscarRedundancia(s), null, `scramble ${i}: redundante`);
      const e = aplicarComprobando(p, p.estadoResuelto(), s, `scramble ${i}`);
      assert.ok(p.validar(e).valido, `scramble ${i}: estado no válido`);
      assert.ok(!p.estaResuelto(e), `scramble ${i}: parece resuelto`);
      scrambles.push(s); estados.push(e); sumaScr += s.length;
    }
    const msScr = (performance.now() - tScr) / N_CASOS_NXN;
    // en este hilo (que ya tiene las tablas) si el espacio es pequeño o hay pocos casos; si no, en paralelo
    const { resultados } = info.espacio === 'pequeño' || !COMPLETO
      ? { resultados: estados.map((e) => { const t = performance.now(); const r = p.resolver(e, { msMax: MS_SOLVER }); return { r, ms: performance.now() - t }; }) }
      : await resolverEnParalelo({
        modulo: new URL('../src/puzzles/vendado.js', import.meta.url).href,
        exportar: 'crearNxNVendado', args: [cfg.N, cfg.def],
        estados, opciones: { msMax: MS_SOLVER },
      });
    const est = { n: 0, suma: 0, max: 0, ms: 0, msMax: 0, gana: {}, f1: 0, f2: 0, nB: 0, fallos: [] };
    resultados.forEach(({ r, ms }, i) => {
      if (!r.ok) { est.fallos.push(i); return; }
      assert.equal(p.buscarRedundanciaSolucion(r.movimientos), null, `caso ${i}: solución redundante`);
      const fin = aplicarComprobando(p, estados[i], r.movimientos, `solución ${i}`);
      assert.ok(p.estaResuelto(fin), `caso ${i}: la solución no resuelve\nscramble: ${scrambles[i].join(' ')}\nsolución: ${r.movimientos.join(' ')}`);
      est.n++; est.suma += r.movimientos.length; est.max = Math.max(est.max, r.movimientos.length); est.ms += ms; est.msMax = Math.max(est.msMax, ms);
      est.gana[r.estrategia] = (est.gana[r.estrategia] || 0) + 1;
      const d = r.detalle;
      if (d && d.B && r.estrategia === 'B') {
        est.nB++; est.f1 += d.B.fase1; est.f2 += d.B.fase2;
        const tras1 = aplicarComprobando(p, estados[i], d.B.movimientos.slice(0, d.B.fase1), `fase 1 (B) ${i}`);
        assert.ok(p.geometriaResuelta(tras1), `caso ${i}: la fase 1 no deja la geometría resuelta`);
      }
    });
    const m2 = (x, n) => (n ? +(x / n).toFixed(1) : null);
    const resumen = {
      nombre: cfg.nombre, bloques: cfg.def.length,
      geometrias: info.geometrias, estados: info.estados, distinguibles: info.estadosDistinguibles, espacio: info.espacio,
      msTablas: Math.round(msIni), minkwitz: info.minkwitz || null,
      scramble: { longitudMedia: m2(sumaScr, N_CASOS_NXN), msMedio: +msScr.toFixed(1), pasos: info.pasosScramble },
      resueltos: `${est.n}/${N_CASOS_NXN} (${((100 * est.n) / N_CASOS_NXN).toFixed(1)}%)`,
      longitud: { media: m2(est.suma, est.n), max: est.max }, ms: { media: m2(est.ms, est.n), max: Math.round(est.msMax) },
      gana: est.gana, B: { fase1: m2(est.f1, est.nB), fase2: m2(est.f2, est.nB) },
      sinResolver: est.fallos.length,
    };
    guardarResultado('bloqueos', { [clave]: resumen });
    // Toda solución devuelta se ha comprobado arriba giro a giro; las que no se encuentran se
    // cuentan (y se documentan en ESTADO.md): con las tablas completas no debería haber ninguna.
    assert.equal(est.fallos.length, 0, `${cfg.nombre}: sin resolver ${est.fallos.length} de ${N_CASOS_NXN} (casos ${est.fallos.slice(0, 10).join(', ')})`);
  });
}
