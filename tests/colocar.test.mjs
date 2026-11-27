// Colocar piezas (noche 14): introducir el estado de un puzzle físico colocando bloques y piezas.
//
//  - Ida y vuelta: para cada configuración (WCA 3x3/4x4/5x5 y vendados 3x3/4x4/5x5, incluido el 5x5
//    de 16 barras), se toman estados alcanzables y se vuelven a introducir con las MISMAS acciones
//    que hace el usuario (elegir bloque y tocar un hueco, Girar / Siguiente posición; tocar un hueco
//    y elegir la pieza, Girar). El resultado tiene que verse igual (colores y bloques) y validarse
//    como alcanzable desde el resuelto (con las piezas iguales elegidas por la app).
//  - Rechazos: bloque donde no cabe, pieza en un hueco de otro tipo, paridad imposible, bloque roto.
//  - Piezas iguales: dos estados que solo se diferencian en qué centro blanco está dónde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { casosPor, guardarResultado } from './util.mjs';
import { rngConSemilla } from '../src/core/rng.js';
import { crearModeloColocar, crearSesionColocar } from '../src/core/colocar.js';
import { puzzleConBloqueos } from '../src/core/bloqueos.js';
import { PUZZLES } from '../src/puzzles/index.js';
import cubo3 from '../src/puzzles/cubo3.js';
import { crearCuboGrande } from '../src/puzzles/cubo-grande.js';
import { crearCuboConIdentidad } from '../src/puzzles/nxn-identidad.js';
import { EJEMPLOS_BLOQUEOS } from '../src/puzzles/cubo3-bloqueos.js';

const N_CASOS = casosPor(200, 25, 'CASOS_COLOCAR');
const N_CASOS_GRANDE = casosPor(200, 8, 'CASOS_COLOCAR');

const base4 = crearCuboConIdentidad(crearCuboGrande(4), 4);
const base5 = crearCuboConIdentidad(crearCuboGrande(5), 5);
const desdeTexto = (t) => t.split('-').map((b) => b.split('.'));
const BARRAS_5X5 = 'B.B12.B32.DB-B11.B21.B31.DB3-B13.B23.B33.DB1-BL.BL1.BL3.DBL-BR.BR1.BR3.DBR-DF.F.F12.F32-DF1.F11.F21.F31-DF3.F13.F23.F33-DFL.FL.FL1.FL3-DFR.FR.FR1.FR3-DL.L.L12.L32-DL1.L11.L21.L31-DL3.L13.L23.L33-DR.R.R12.R32-DR1.R13.R23.R33-DR3.R11.R21.R31';

/** Modelo y sesión para un puzzle (vendado o no), como los crea la interfaz (main.js). */
function preparar(p, base) {
  const bloques = p.bloqueos && p.bloqueos.length ? p.piezasDeBloques().map((b) => ({ nombre: b.piezas.join('+'), pegatinas: b.pegatinas })) : [];
  const M = crearModeloColocar(base, { bloques, rotaciones: bloques.length ? base.soporteBloqueos.rotaciones : [] });
  return { M, S: crearSesionColocar(M) };
}

/** Color de cada valor del estado (colores: él mismo; identidades: el de esa pegatina). */
function coloresDe(M, e) {
  const color = new Map();
  for (const pz of M.piezas) pz.valores.forEach((v, j) => color.set(v, pz.colores[j]));
  return e.map((v) => (v < 0 ? -1 : color.get(v)));
}

/**
 * Introduce el estado `e` con las acciones del usuario. Devuelve los toques: elegir un bloque (1) +
 * tocar un hueco (1) + cada Girar / Siguiente posición (1); tocar un hueco (1) + elegir la pieza (1,
 * salvo que solo quepa una: se coloca sola) + cada Girar (1). Las piezas que se colocan solas no cuentan.
 */
function colocarComoUsuario(M, S, e) {
  let toques = 0;
  const objetivo = coloresDe(M, e);
  S.autoRellenar();
  // 1) bloques: la colocación que tiene cada pieza del bloque donde está en e
  for (const bq of M.bloques) {
    const ci = bq.colocaciones.findIndex((c) => c.tuplas.every((t, j) => t.every((i, k) => e[i] === M.piezas[bq.piezas[j]].valores[k])));
    assert.ok(ci >= 0, `el bloque ${bq.nombre} no tiene una colocación con la que quede como en el estado`);
    const h = bq.colocaciones[ci].huecos[0];
    S.colocarBloque(bq.id, h); toques += 2;
    let vueltas = 0;
    while (S.colocacionBloque(bq.id) !== ci && vueltas++ < 30) { S.girarBloque(bq.id); toques++; }
    vueltas = 0;
    while (S.colocacionBloque(bq.id) !== ci && vueltas++ < 200) { S.siguientePosicion(bq.id); toques++; }
    assert.equal(S.colocacionBloque(bq.id), ci, `el bloque ${bq.nombre} no se pudo llevar a su sitio con Girar / Siguiente posición`);
    S.autoRellenar();
  }
  // 2) piezas sueltas, hueco a hueco
  for (let h = 0; h < M.piezas.length; h++) {
    const peg = M.pegatinasHueco(h);
    const quiero = peg.map((i) => objetivo[i]);
    const col = () => { const cc = S.colores(); return peg.map((i) => cc[i]).join(','); };
    if (S.colocada(h)) {
      // colocada sola (o de un bloque): si es suelta y no quedó como en el estado, tocarla y Girar
      if (S.colocada(h).bloque >= 0 || col() === quiero.join(',')) continue;
      toques++;
    } else {
      const clave = quiero.slice().sort((a, b) => a - b).join(',');
      const cand = S.candidatos(h);
      const c = cand.find((x) => M.grupos[x.grupo].colores.slice().sort((a, b) => a - b).join(',') === clave);
      assert.ok(c, `hueco ${h}: la pieza que va ahí no está entre las que ofrece la lista`);
      S.colocar(h, c.grupo); toques += cand.length === 1 ? 1 : 2;
    }
    let vueltas = 0;
    while (col() !== quiero.join(',') && vueltas++ < 12) { S.girar(h); toques++; }
    assert.equal(col(), quiero.join(','), `hueco ${h}: Girar no llega a la orientación del estado`);
    S.autoRellenar();
  }
  assert.ok(S.completo(), 'no está todo colocado');
  return toques;
}

/** Ida y vuelta de un puzzle; estados(rng) da estados alcanzables. */
function idaYVuelta(nombre, p, base, estados, n) {
  const rng = rngConSemilla(14);
  const { M } = preparar(p, base);
  let toques = 0, maxT = 0, minT = Infinity, porIguales = 0;
  for (let k = 0; k < n; k++) {
    const e = estados(rng);
    const S = crearSesionColocar(M);
    const t = colocarComoUsuario(M, S, e);
    toques += t; maxT = Math.max(maxT, t); minT = Math.min(minT, t);
    const e2 = S.estado();
    // equivalente: mismos colores y mismos bloques en las mismas posiciones
    assert.deepEqual(coloresDe(M, e2), coloresDe(M, e), `${nombre}, caso ${k}: los colores no coinciden`);
    if (p.bloqueEnPosicion) assert.deepEqual([...p.bloqueEnPosicion(e2)], [...p.bloqueEnPosicion(e)], `${nombre}, caso ${k}: los bloques no están donde estaban`);
    const v = p.validar(e2, { elegirIguales: true });
    assert.equal(v.resultado || (v.valido ? 'valido' : 'imposible'), 'valido', `${nombre}, caso ${k}: ${[...v.errores, ...(v.avisos || [])].join(' ')}`);
    if (v.estado) {
      porIguales++;
      assert.deepEqual(coloresDe(M, v.estado), coloresDe(M, e), `${nombre}, caso ${k}: las identidades elegidas cambian los colores`);
      assert.equal(p.validar(v.estado).valido, true, `${nombre}, caso ${k}: el estado con las identidades elegidas no es válido`);
      if (p.bloqueEnPosicion) assert.deepEqual([...p.bloqueEnPosicion(v.estado)], [...p.bloqueEnPosicion(e)]);
    } else if (!p.bloqueos || !p.bloqueos.length || base === cubo3) {
      // sin piezas iguales que elegir, el estado es exactamente el de partida (colores)
      assert.deepEqual(e2, e, `${nombre}, caso ${k}: el estado no es el mismo`);
    }
  }
  const r = { casos: n, toquesMedia: +(toques / n).toFixed(1), toquesMin: minT, toquesMax: maxT, identidadesElegidas: porIguales };
  guardarResultado('colocar', { [nombre]: r });
  return r;
}

/** Estados de giros al azar con los generadores (alcanzables). */
const porGiros = (p, giros = 60) => (rng) => {
  let e = p.estadoResuelto();
  const g = p.colocarPiezas.generadores;
  for (let i = 0; i < giros; i++) e = p.aplicarMovimiento(e, g[Math.floor(rng() * g.length)] + ['', "'", '2'][Math.floor(rng() * 3)]);
  return e;
};
const porScramble = (p) => (rng) => p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rng));

const wca = (id) => PUZZLES.find((p) => p.id === id);

for (const id of ['3x3', '4x4', '5x5']) {
  test(`colocar: ida y vuelta, WCA ${id}`, { timeout: 600000 }, () => {
    const p = wca(id);
    const r = idaYVuelta(`WCA ${id}`, p, p, porGiros(p), N_CASOS);
    assert.ok(r.toquesMedia > 0);
  });
}

// Cuboids (noche 15): estados de scrambles de estado aleatorio, y además girados al azar (orientación libre)
for (const id of ['3x3x1', '3x3x2', '2x2x3']) {
  test(`colocar: ida y vuelta, Cuboids ${id} (también sujetado de cualquier forma)`, { timeout: 600000 }, () => {
    const p = wca(id);
    const rots = p.cuboide.G.geo.rotaciones;
    const estados = (rng) => {
      const e = p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rng));
      return rots[Math.floor(rng() * rots.length)].map((k) => e[k]);
    };
    const r = idaYVuelta(`Cuboids ${id}`, p, p, estados, N_CASOS);
    assert.ok(r.toquesMedia > 0);
  });
}

const VENDADOS = [
  { nombre: 'vendado 3x3 pareja', crear: () => [puzzleConBloqueos(cubo3, EJEMPLOS_BLOQUEOS.find((x) => x.id === 'pareja').bloques), cubo3], n: N_CASOS },
  { nombre: 'vendado 3x3 varios', crear: () => [puzzleConBloqueos(cubo3, EJEMPLOS_BLOQUEOS.find((x) => x.id === 'varios').bloques), cubo3], n: N_CASOS },
  { nombre: 'vendado 3x3 2x2x2', crear: () => [puzzleConBloqueos(cubo3, EJEMPLOS_BLOQUEOS.find((x) => x.id === '2x2x2').bloques), cubo3], n: N_CASOS },
  { nombre: 'vendado 4x4 varios', crear: () => [puzzleConBloqueos(base4, base4.ejemplosBloqueos.find((x) => x.id === 'varios').bloques), base4], n: N_CASOS },
  { nombre: 'vendado 4x4 centros', crear: () => [puzzleConBloqueos(base4, base4.ejemplosBloqueos.find((x) => x.id === 'centros').bloques), base4], n: N_CASOS },
  { nombre: 'vendado 5x5 varios', crear: () => [puzzleConBloqueos(base5, base5.ejemplosBloqueos.find((x) => x.id === 'varios').bloques), base5], n: N_CASOS },
  { nombre: 'vendado 5x5 opuestos', crear: () => [puzzleConBloqueos(base5, base5.ejemplosBloqueos.find((x) => x.id === 'opuestos').bloques), base5], n: N_CASOS },
  { nombre: 'vendado 5x5 16 barras', crear: () => [puzzleConBloqueos(base5, desdeTexto(BARRAS_5X5), { rng: rngConSemilla(7) }), base5], n: N_CASOS_GRANDE },
];
for (const cfg of VENDADOS) {
  test(`colocar: ida y vuelta, ${cfg.nombre}`, { timeout: 1200000 }, () => {
    const [p, base] = cfg.crear();
    p.inicializar();
    idaYVuelta(cfg.nombre, p, base, porScramble(p), cfg.n);
  });
}

test('colocar: modelo de cada puzzle (tipos, piezas fijas colocadas solas, Square-1 fuera)', () => {
  const esperado = {
    '2x2': { piezas: 8, solas: 1 }, '3x3': { piezas: 26, solas: 6 }, '4x4': { piezas: 56, solas: 0 }, '5x5': { piezas: 98, solas: 6 },
    '6x6': { piezas: 152, solas: 0 }, '7x7': { piezas: 218, solas: 6 }, pyraminx: { piezas: 14, solas: 0 }, skewb: { piezas: 14, solas: 1 },
    megaminx: { piezas: 62, solas: 12 }, fto: { piezas: 42, solas: 0 },
    // cuboides (noche 15): con las rotaciones como generadores (orientación libre) nada queda solo
    '3x3x1': { piezas: 9, solas: 0 }, '3x3x2': { piezas: 18, solas: 0 }, '2x2x3': { piezas: 12, solas: 0 },
  };
  for (const p of PUZZLES) {
    if (!esperado[p.id]) { assert.equal(p.colocarPiezas, undefined, `${p.id} no debería ofrecer colocar piezas`); continue; }
    const M = crearModeloColocar(p);
    const S = crearSesionColocar(M);
    assert.equal(M.piezas.length, esperado[p.id].piezas, p.id);
    assert.equal(S.autoRellenar().length, esperado[p.id].solas, `${p.id}: piezas fijas`);
    // toda pegatina es de un hueco y todo hueco tiene al menos su propia pieza
    assert.ok([...M.huecoDePegatina].every((h) => h >= 0), p.id);
    M.piezas.forEach((pz, k) => assert.ok(M.opciones(k, k).length >= 1, `${p.id}: la pieza ${k} no cabe en su casa`));
    // la sesión vacía da un estado vacío y la llena (con la casa de cada pieza) el resuelto
    const S2 = crearSesionColocar(M);
    for (let h = 0; h < M.piezas.length; h++) if (!S2.colocada(h)) {
      const g = M.piezas[h].grupo;
      S2.colocar(h, g);
      let v = 0;
      while (S2.colores().filter((c, i) => M.huecoDePegatina[i] === h).join() !== M.piezas[h].colores.slice().join() && v++ < 6) {
        const peg = M.pegatinasHueco(h), cc = S2.colores();
        if (peg.every((i, j) => cc[i] === M.piezas[h].colores[j])) break;
        S2.girar(h);
      }
    }
    assert.ok(S2.completo(), p.id);
    assert.ok(p.estaResuelto(S2.estado()), `${p.id}: colocar cada pieza en su casa no da el resuelto`);
  }
});

// ---------------------------------------------------------------------------
// Rechazos (cada uno con su mensaje claro)
// ---------------------------------------------------------------------------
test('colocar: rechazos — bloque donde no cabe, pieza en un hueco de otro tipo, paridad imposible, bloque roto', () => {
  // pieza en un hueco de otro tipo (3x3): una arista en el hueco de una esquina
  {
    const M = crearModeloColocar(cubo3);
    const S = crearSesionColocar(M);
    const esquina = M.piezas.findIndex((pz) => pz.pegatinas.length === 3);
    const arista = M.grupos.find((g) => M.piezas[g.piezas[0]].pegatinas.length === 2);
    assert.throws(() => S.colocar(esquina, arista.id), /no cabe ahí: es un hueco de esquina/);
    assert.ok(!S.candidatos(esquina).some((c) => c.grupo === arista.id), 'la lista de un hueco de esquina no ofrece aristas');
    // hueco ocupado
    S.colocar(esquina, M.piezas[esquina].grupo);
    assert.throws(() => S.colocar(esquina, M.piezas[esquina].grupo), /ya tiene una pieza/);
  }
  // bloque donde no cabe (3x3 vendado, dos barras 1x1x3): con una barra en UFL-UF-UFR, la otra no
  // se ofrece en ninguna posición que pise esos huecos, y tocar uno de ellos lo explica
  {
    const p = puzzleConBloqueos(cubo3, EJEMPLOS_BLOQUEOS.find((x) => x.id === 'barras').bloques);
    const { M, S } = preparar(p, cubo3);
    const [a, b] = M.bloques;
    S.colocarBloque(a.id, a.colocaciones[0].huecos[0]);
    const ocupados = new Set(a.colocaciones[0].huecos);
    const antes = b.colocaciones.length;
    assert.ok(S.posicionesBloque(b.id) < antes, 'las posiciones que chocan no se ofrecen');
    const pisa = b.colocaciones.find((c) => c.huecos.some((h) => ocupados.has(h)));
    assert.ok(pisa);
    const h = pisa.huecos.find((x) => ocupados.has(x));
    assert.throws(() => S.colocarBloque(b.id, h), /no cabe ahí/);
    // un hueco en el que el bloque no cabe en ninguna orientación (un centro, para una barra de esquinas y aristas)
    const centro = M.piezas.findIndex((pz) => pz.pegatinas.length === 1);
    assert.throws(() => S.colocarBloque(b.id, centro), /no puede ocupar ese hueco/);
    // las piezas de los bloques no están en la bandeja (se colocan siempre juntas)
    for (const bq of M.bloques) for (const k of bq.piezas) assert.equal(M.piezas[k].grupo, -1);
    // todas las colocaciones que se ofrecen dejan el bloque entero (rígido)
    for (const bq of M.bloques) for (const c of bq.colocaciones) {
      const S2 = crearSesionColocar(M);
      S2.ponerColocacionBloque(bq.id, bq.colocaciones.indexOf(c));
      // rellenar el resto con el resuelto donde se pueda no hace falta: basta con mirar el bloque
      const e = S2.estado();
      const r = cubo3.estadoResuelto().map((x, i) => (e[i] >= 0 ? e[i] : x));
      const intacto = p.bloquesIntactos(r);
      // (si el resto del resuelto choca con el bloque movido, no es comparable: solo se mira la forma)
      if (c === bq.colocaciones[0]) assert.ok(intacto);
    }
  }
  // paridad imposible (3x3): dos aristas cambiadas
  {
    const M = crearModeloColocar(cubo3);
    const S = crearSesionColocar(M);
    S.autoRellenar();
    const aristas = M.piezas.filter((pz) => pz.pegatinas.length === 2).map((pz) => pz.id);
    const [x, y] = aristas;
    for (let h = 0; h < M.piezas.length; h++) {
      if (S.colocada(h)) continue;
      const pieza = h === x ? y : h === y ? x : h;
      S.colocar(h, M.piezas[pieza].grupo);
    }
    assert.ok(S.completo());
    // orientaciones: dejar cada pieza «bien orientada» no importa para la paridad de permutación
    const v = cubo3.validar(S.estado());
    assert.equal(v.valido, false);
    assert.match(v.errores.join(' '), /paridad|intercambi|imposible|cambiad/i);
  }
  // esquina girada (3x3): mensaje que dice qué pasa
  {
    const M = crearModeloColocar(cubo3);
    const S = crearSesionColocar(M);
    S.autoRellenar();
    for (let h = 0; h < M.piezas.length; h++) if (!S.colocada(h)) S.colocar(h, M.piezas[h].grupo);
    const esquina = M.piezas.findIndex((pz) => pz.pegatinas.length === 3);
    S.girar(esquina);
    const v = cubo3.validar(S.estado());
    assert.equal(v.valido, false);
    assert.match(v.errores.join(' '), /esquina|orientaci|girad/i);
  }
  // bloque roto (el validador del vendado): una pieza del bloque fuera de su sitio
  {
    const p = puzzleConBloqueos(cubo3, [['UFR', 'UF']]);
    p.inicializar();
    // R sin bloques separa UFR de UF
    const roto = cubo3.aplicarMovimiento(cubo3.estadoResuelto(), 'R');
    const v = p.validar(roto, { elegirIguales: true });
    assert.equal(v.resultado, 'imposible');
    assert.match(v.errores.join(' '), /bloque UFR\+UF está roto/);
  }
  // imposible en un vendado 4x4 con centros iguales, ni eligiendo las identidades: una esquina
  // girada. (Dos esquinas cambiadas SÍ son alcanzables en el 4x4: esa paridad se compensa con una
  // permutación impar de los centros iguales, y la app la encuentra.)
  {
    const p = puzzleConBloqueos(base4, base4.ejemplosBloqueos.find((x) => x.id === 'pareja').bloques);
    p.inicializar();
    const { M, S } = preparar(p, base4);
    const e = p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rngConSemilla(3)));
    colocarComoUsuario(M, S, e);
    // dos esquinas sueltas cambiadas (de colores distintos): paridad de esquinas imposible
    const sueltas = M.piezas.filter((pz) => pz.pegatinas.length === 3 && pz.bloque < 0);
    const h1 = S.modelo.huecoDePegatina[e.indexOf(sueltas[0].valores[0])];
    const h2 = S.modelo.huecoDePegatina[e.indexOf(sueltas[1].valores[0])];
    S.quitar(h1); S.quitar(h2);
    S.colocar(h1, sueltas[1].grupo); S.colocar(h2, sueltas[0].grupo);
    const cambiadas = p.validar(S.estado(), { elegirIguales: true });
    assert.equal(cambiadas.resultado, 'valido', 'dos esquinas cambiadas en el 4x4: alcanzable eligiendo los centros');
    S.girar(h1);
    const v = p.validar(S.estado(), { elegirIguales: true });
    assert.equal(v.resultado, 'imposible', 'una esquina girada no puede ser alcanzable');
    assert.match(v.errores.join(' '), /esquina|orientaci|girad/i);
  }
});

// ---------------------------------------------------------------------------
// Piezas iguales
// ---------------------------------------------------------------------------
test('colocar: piezas iguales — qué centro blanco está dónde no importa', () => {
  // WCA 4x4 (estado de colores): los dos estados son el mismo array y se validan igual
  {
    const p = wca('4x4');
    const M = crearModeloColocar(p);
    const blancos = M.grupos.find((g) => g.piezas.length === 4 && M.piezas[g.piezas[0]].colores[0] === 0);
    assert.ok(blancos, 'los cuatro centros blancos son un solo grupo de la bandeja');
    const e = porGiros(p, 40)(rngConSemilla(5));
    const a = crearSesionColocar(M), b = crearSesionColocar(M);
    colocarComoUsuario(M, a, e);
    colocarComoUsuario(M, b, e);
    assert.deepEqual(a.estado(), b.estado());
    assert.equal(p.validar(a.estado()).valido, true);
  }
  // 4x4 y 5x5 vendados (estado de identidades): cambiar entre sí dos centros blancos sueltos da otro
  // estado de identidades, pero los dos se validan igual (la app elige las identidades) y se ven igual
  for (const [base, id] of [[base4, 'pareja'], [base5, 'pareja']]) {
    const p = puzzleConBloqueos(base, base.ejemplosBloqueos.find((x) => x.id === id).bloques);
    p.inicializar();
    const rng = rngConSemilla(8);
    const sop = base.soporteBloqueos;
    const enB = new Set(p.bloqueos.flat());
    const clase = sop.iguales.map((cl) => cl.filter((k) => !enB.has(sop.piezas[k].clave)).map((k) => sop.piezas[k].puntos[0])).find((cl) => cl.length >= 2);
    let distintos = 0;
    for (let k = 0; k < 10; k++) {
      const e = p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rng));
      const e2 = e.slice();
      const i = e.indexOf(clase[0]), j = e.indexOf(clase[1]);
      e2[i] = clase[1]; e2[j] = clase[0];
      const v1 = p.validar(e, { elegirIguales: true }), v2 = p.validar(e2, { elegirIguales: true });
      assert.equal(v1.resultado, 'valido');
      assert.equal(v2.resultado, 'valido', 'cambiar dos centros blancos sueltos no puede hacerlo imposible');
      if (!p.validar(e2).valido) distintos++;
      assert.deepEqual(base.colores(v2.estado || e2), base.colores(e));
    }
    // (sin elegir, la mitad de esos cambios no serían alcanzables: la elección es necesaria)
    assert.ok(distintos > 0, 'el test no llega a probar ningún caso en el que haya que elegir');
  }
});
