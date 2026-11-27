// Vista 3D sin navegador: el estado que se ve en 3D tras cada movimiento coincide
// con el modelo. Se comparan colores de pegatinas por posición (centros 3D), sin
// depender de WebGL: la escena (src/app/escena3d.js) es la misma que dibuja la app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLES, obtenerPuzzle } from '../src/puzzles/index.js';
import { comprobarGiro3D, compararFotos, pegatinasDePiezas } from '../src/core/modelo3d.js';
import { crearEscena3D } from '../src/app/escena3d.js';
import { crearReproductor } from '../src/app/reproductor.js';
import { nombreMovimiento, CARAS as CARAS_CUBO } from '../src/puzzles/nxn.js';
import { normales as NORMALES_MEGA, IDX as IDX_MEGA } from '../src/puzzles/megaminx-geo.js';
import { rngConSemilla, entero } from '../src/core/rng.js';
import { CASOS } from './util.mjs';

const completo = CASOS >= 1000;
const ESTADOS = completo ? 40 : 8; // estados de partida al azar por puzzle

/** Todos los movimientos que puede animar un puzzle (los de scramble y los de las soluciones). */
function movimientosDe(p) {
  const N = { '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5, '6x6': 6, '7x7': 7 }[p.id];
  if (N) {
    const r = [];
    for (const c of CARAS_CUBO) for (let prof = 1; prof < N; prof++) for (const v of [1, 2, 3]) r.push(nombreMovimiento(c, prof, v));
    return r;
  }
  if (p.geo) return Object.keys(p.geo.giros3D);
  if (p.cuboide) return Object.keys(p.cuboide.G.movimientos); // cuboides (noche 15): capas y rotaciones
  return null; // Square-1: dependen del estado
}

/** Un movimiento legal al azar del Square-1 en el estado e (giros (x,y) o "/" si se puede). */
function movSquare1(p, e, rng) {
  if (p.sePuedeCortar(e) && rng() < 0.4) return '/';
  for (;;) {
    const x = entero(rng, 12) - 5, y = entero(rng, 12) - 5;
    if (x || y) return `(${x},${y})`;
  }
}

function estadoAlAzar(p, rng) {
  return p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rng));
}

for (const p of PUZZLES) {
  test(`3D ${p.nombre}: cada giro animado acaba exactamente en el estado del modelo`, () => {
    assert.equal(typeof p.vista3D, 'function');
    assert.equal(typeof p.giro3D, 'function');
    const rng = rngConSemilla(71);
    const movs = movimientosDe(p);
    let comprobados = 0;
    for (let k = 0; k < ESTADOS; k++) {
      let e = k === 0 ? p.estadoResuelto() : estadoAlAzar(p, rng);
      if (movs) {
        for (const m of movs) {
          const r = comprobarGiro3D(p, e, m);
          assert.equal(r, null, `${p.id}: ${m}: ${r}`);
          comprobados++;
        }
      } else {
        for (let i = 0; i < 60; i++) {
          const m = movSquare1(p, e, rng);
          const r = comprobarGiro3D(p, e, m);
          assert.equal(r, null, `${p.id}: ${m}: ${r}`);
          e = p.aplicarMovimiento(e, m);
          comprobados++;
        }
      }
    }
    assert.ok(comprobados > 0);
  });
}

test('3D: el "/" del Square-1 desde formas en las que antes había que girar (giro + "/")', () => {
  const p = obtenerPuzzle('square1');
  const rng = rngConSemilla(5);
  let e = p.estadoResuelto();
  let cortes = 0;
  for (let i = 0; i < 400; i++) {
    const m = movSquare1(p, e, rng);
    assert.equal(comprobarGiro3D(p, e, m), null, m);
    if (m === '/') cortes++;
    e = p.aplicarMovimiento(e, m);
  }
  assert.ok(cortes > 50);
  assert.throws(() => p.giro3D(p.aplicarMovimiento(p.estadoResuelto(), '(-1,0)'), '/'), /ilegal/);
});

/**
 * Reproduce una secuencia con el reproductor real de la app y una vista falsa que
 * usa la escena real: al empezar y al acabar cada animación, lo que se ve (centros
 * y colores de las pegatinas) debe ser el estado del modelo en ese momento.
 */
async function reproducirYComprobar(p, inicial, movs, { reorientar = false } = {}) {
  const estados = [inicial];
  for (const m of movs) estados.push(p.aplicarMovimiento(estados[estados.length - 1], m));
  const final = reorientar && p.estadoVistaScramble ? p.estadoVistaScramble(estados[movs.length]) : estados[movs.length];
  const estadoEn = (k) => (k === movs.length ? final : estados[k]);
  const escena = crearEscena3D(p.paleta);
  const fallos = [];
  let paso = 0;
  let enCurso = null; // { desde, hasta } del giro animado
  const vista = {
    mostrar: (v) => escena.mostrar(v),
    animar(partes, { desde = 0, hasta = 1 } = {}) {
      escena.giro(partes, desde);
      if (!enCurso) enCurso = { foto0: escena.foto() }; // la primera animación del paso
      escena.giro(partes, hasta);
      enCurso.foto1 = escena.foto();
      return Promise.resolve();
    },
    terminar() {},
  };
  let haciaAtras = false;
  const comprobar = (foto, k, cuando) => {
    const r = compararFotos(foto.centros, foto.colores, p.vista3D(estadoEn(k)));
    if (r && fallos.length < 3) fallos.push(`paso ${k} (${cuando}): ${r}`);
  };
  const rep = crearReproductor({
    total: () => movs.length,
    leer: () => paso,
    fijar: (k) => {
      // la última animación del paso debe acabar donde dice el modelo
      if (enCurso) comprobar(enCurso.foto1, k, 'fin de la animación');
      enCurso = null;
      paso = k;
    },
    estadoEn,
    transicion(k) {
      const antes = estados[k];
      const pasos = [{ antes, partes: p.giro3D(antes, movs[k]) }];
      if (reorientar && k + 1 === movs.length && p.reorientar3D) {
        const r = p.reorientar3D(estados[k + 1]);
        if (r) pasos.push({ antes: estados[k + 1], partes: r.partes });
      }
      return pasos;
    },
    vista: () => vista,
    puzzle: () => p,
    alCambiar: () => escena.mostrar(p.vista3D(estadoEn(paso))),
    ms: () => 1, pausa: () => 0, pausa3D: () => 0,
  });
  escena.mostrar(p.vista3D(estadoEn(0)));
  for (let i = 0; i < movs.length; i++) {
    // al empezar el paso, lo que se ve es el estado del paso actual
    comprobar(escena.foto(), paso, 'antes del paso');
    await rep.adelante();
  }
  comprobar(escena.foto(), paso, 'al final');
  assert.equal(paso, movs.length);
  // y hacia atrás hasta el principio (cada animación empieza donde estaba el paso)
  haciaAtras = true;
  for (let i = 0; i < Math.min(movs.length, 12); i++) {
    const antes = escena.foto();
    let inicio = null;
    const fijar0 = vista.animar;
    vista.animar = (partes, o) => { const r = fijar0(partes, o); if (!inicio) inicio = enCurso.foto0; return r; };
    await rep.atras();
    vista.animar = fijar0;
    if (inicio) comprobar(inicio, paso + 1, 'inicio del paso atrás');
    comprobar(antes, paso + 1, 'antes del paso atrás');
    comprobar(escena.foto(), paso, 'después del paso atrás');
  }
  return fallos;
}

test('3D: saltar al final (⇥) mientras se anima un giro deja el último paso (no lo pisa el giro en curso)', async () => {
  let paso = 0, soltar = null;
  const vista = {
    mostrar() {},
    // la animación no acaba hasta que el test la suelta (como un giro de 3D a medias)
    animar: () => new Promise((r) => { soltar = r; }),
    terminar() { if (soltar) soltar(); },
  };
  const rep = crearReproductor({
    total: () => 10, leer: () => paso, fijar: (k) => { paso = k; }, estadoEn: () => null,
    transicion: () => [{ antes: null, partes: [] }], vista: () => vista, puzzle: () => ({ vista3D: () => null }),
    alCambiar() {}, ms: () => 300, pausa: () => 0, pausa3D: () => 0,
  });
  rep.alternar(); // play: empieza el giro del paso 0 al 1
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(soltar, 'el giro está en curso');
  rep.irA(Infinity); // ⇥ (termina la animación en curso)
  await rep.esperar();
  assert.equal(paso, 10, 'el salto al final no lo deshace el giro que se estaba animando');
  assert.equal(rep.reproduciendo, false);
});

for (const p of PUZZLES) {
  test(`3D ${p.nombre}: reproducción de un scramble y de su solución (adelante y atrás)`, async () => {
    const rng = rngConSemilla(17);
    const scramble = p.generarScramble(rng);
    let f = await reproducirYComprobar(p, p.estadoResuelto(), scramble, { reorientar: true });
    assert.deepEqual(f, [], `${p.id} scramble: ${f.join('; ')}`);
    // solución (los solvers lentos solo con la suite completa)
    const lento = ['5x5', '6x6', '7x7', 'megaminx', '4x4'].includes(p.id);
    if (!p.capacidades.resolver || (lento && !completo)) return;
    p.inicializar();
    const inicial = p.estadoVistaScramble ? p.estadoVistaScramble(p.aplicarSecuencia(p.estadoResuelto(), scramble)) : p.aplicarSecuencia(p.estadoResuelto(), scramble);
    const r = p.resolver(inicial, {});
    assert.ok(r.ok);
    f = await reproducirYComprobar(p, inicial, r.movimientos);
    assert.deepEqual(f, [], `${p.id} solución: ${f.join('; ')}`);
  });
}

test('3D Megaminx: la reorientación final del scramble lleva a la vista previa (orientación de referencia)', () => {
  const p = obtenerPuzzle('megaminx');
  const rng = rngConSemilla(3);
  for (let i = 0; i < (completo ? 200 : 30); i++) {
    const e = p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rng));
    const r = p.reorientar3D(e);
    const ref = p.estadoVistaScramble(e);
    if (!r) { assert.deepEqual(ref, e); continue; }
    assert.deepEqual(r.estado, ref);
    const v = p.vista3D(e);
    const escena = crearEscena3D(p.paleta);
    escena.mostrar(v);
    escena.giro(r.partes, 1);
    const foto = escena.foto();
    assert.equal(compararFotos(foto.centros, foto.colores, p.vista3D(ref)), null);
  }
});

test('3D: orientación de referencia del estado resuelto (colores por dirección de la cara)', () => {
  // color de las pegatinas cuya normal apunta en la dirección d
  const colorHacia = (p, d) => {
    const v = p.vista3D(p.estadoResuelto());
    const cols = new Set();
    v.geometria.pegatinas.forEach((q, k) => { if (q.normal[0] * d[0] + q.normal[1] * d[1] + q.normal[2] * d[2] > 0.999) cols.add(v.colores[k]); });
    return [...cols];
  };
  const nombre = (p, c) => c.map((i) => p.paleta[i].nombre).join('/');
  for (const id of ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7', 'skewb']) {
    const p = obtenerPuzzle(id);
    assert.equal(nombre(p, colorHacia(p, [0, 1, 0])), 'blanco', id + ' arriba');
    assert.equal(nombre(p, colorHacia(p, [0, 0, 1])), 'verde', id + ' delante');
    assert.equal(nombre(p, colorHacia(p, [1, 0, 0])), 'rojo', id + ' derecha');
  }
  const sq = obtenerPuzzle('square1');
  assert.equal(nombre(sq, colorHacia(sq, [0, 1, 0])), 'blanco');
  assert.equal(nombre(sq, colorHacia(sq, [0, -1, 0])), 'amarillo');
  assert.equal(nombre(sq, colorHacia(sq, [0, 0, 1])), 'azul', 'Square-1: azul delante (4d3)');
  // 12c1: la superficie pequeña de la capa del medio, a la izquierda del frente
  const v = sq.vista3D(sq.estadoResuelto());
  const medioFrente = v.geometria.pegatinas.filter((q) => q.capa === 2 && q.normal[2] > 0.99);
  const ancho = (q) => Math.max(...q.puntos.map((x) => x[0])) - Math.min(...q.puntos.map((x) => x[0]));
  const izq = medioFrente.find((q) => q.mitad === 0), der = medioFrente.find((q) => q.mitad === 1);
  assert.ok(ancho(izq) < ancho(der) && Math.max(...izq.puntos.map((x) => x[0])) <= Math.min(...der.puntos.map((x) => x[0])) + 1e-9);
  const pyra = obtenerPuzzle('pyraminx');
  const vp = pyra.vista3D(pyra.estadoResuelto());
  const frente = vp.geometria.pegatinas.map((q, k) => [q, k]).filter(([q]) => q.normal[2] > 0.9);
  assert.equal(nombre(pyra, [...new Set(frente.map(([, k]) => vp.colores[k]))]), 'verde', 'Pyraminx: verde delante');
  const abajo = vp.geometria.pegatinas.map((q, k) => [q, k]).filter(([q]) => q.normal[1] < -0.99);
  assert.equal(nombre(pyra, [...new Set(abajo.map(([, k]) => vp.colores[k]))]), 'amarillo', 'Pyraminx: amarillo abajo');
  // Megaminx: colores verificados; cada cara en su normal (U arriba, F delante)
  const mg = obtenerPuzzle('megaminx');
  const ref = ['blanco', 'verde oscuro', 'rojo', 'morado', 'amarillo', 'azul', 'gris', 'verde claro', 'rosa', 'crema', 'naranja', 'celeste'];
  ref.forEach((col, f) => assert.equal(nombre(mg, colorHacia(mg, NORMALES_MEGA[f])), col, `Megaminx cara ${f}`));
  assert.ok(NORMALES_MEGA[IDX_MEGA.U][1] > 0.999 && NORMALES_MEGA[IDX_MEGA.F][2] > 0.8);
});

test('3D: piezas para resaltar (número de piezas y pegatinas de una pieza)', () => {
  const esperado = { '2x2': 8, '3x3': 26, '4x4': 56, '5x5': 98, '6x6': 152, '7x7': 218, pyraminx: 14, skewb: 14, megaminx: 62, square1: 18, fto: 42, '3x3x1': 9, '3x3x2': 18, '2x2x3': 12 };
  for (const p of PUZZLES) {
    const v = p.vista3D(p.estadoResuelto());
    const piezas = new Set(v.geometria.pegatinas.map((q) => q.pieza));
    assert.equal(piezas.size, esperado[p.id], p.id);
  }
  // FTO: 6 esquinas de 4 pegatinas, 12 aristas de 2 y 24 triángulos de 1
  const fto = obtenerPuzzle('fto').vista3D(obtenerPuzzle('fto').estadoResuelto()).geometria;
  const tamanos = {};
  for (const k of new Set(fto.pegatinas.map((q) => q.pieza))) {
    const n = pegatinasDePiezas(fto, [k]).length;
    tamanos[n] = (tamanos[n] || 0) + 1;
  }
  assert.deepEqual(tamanos, { 1: 24, 2: 12, 4: 6 });
  const p = obtenerPuzzle('3x3');
  const v = p.vista3D(p.estadoResuelto());
  const esquina = v.geometria.pegatinas.find((q) => q.centro.every((x) => x > 0.5)).pieza; // UFR
  const peg = pegatinasDePiezas(v.geometria, [esquina]);
  assert.equal(peg.length, 3);
  const escena = crearEscena3D(p.paleta);
  escena.mostrar(v);
  escena.resaltar(peg, 'transparencia');
  assert.deepEqual(escena.resaltado, { indices: peg, modo: 'transparencia' });
  const b = escena.buffers();
  // los vértices resaltados son los de esas 3 pegatinas (cuerpo + pegatina, 2 triángulos cada uno)
  assert.equal(b.res.reduce((s, x) => s + x, 0), 3 * 2 * 2 * 3);
});

test('3D: tocar una pegatina (rayo) elige la que se ve', () => {
  const p = obtenerPuzzle('3x3');
  const escena = crearEscena3D(p.paleta);
  escena.mostrar(p.vista3D(p.estadoResuelto()));
  const k = escena.elegir([0.1, 0.05, 10], [0, 0, -1]);
  const q = escena.geometria.pegatinas[k];
  assert.deepEqual(q.centro.map((x) => Math.round(x * 3)), [0, 0, 3], 'centro de F');
  assert.equal(escena.elegir([5, 5, 10], [0, 0, -1]), -1, 'fuera del cubo');
  // desde atrás se elige B, no F
  const kb = escena.elegir([0, 0, -10], [0, 0, 1]);
  assert.ok(escena.geometria.pegatinas[kb].normal[2] < -0.99);
  // con una capa a medio girar, el rayo sigue a la pegatina girada
  escena.giro(p.giro3D(p.estadoResuelto(), 'F'), 0.5);
  assert.ok(escena.elegir([0.1, 0.05, 10], [0, 0, -1]) >= 0);
  // Square-1: las pegatinas tienen el índice que entiende el editor
  const sq = obtenerPuzzle('square1');
  const es = crearEscena3D(sq.paleta);
  es.mostrar(sq.vista3D(sq.estadoResuelto()));
  const ks = es.elegir([0.3, 10, 0.3], [0, -1, 0]);
  const editables = new Set(sq.pegatinasEditables());
  assert.ok(editables.has(es.geometria.pegatinas[ks].indice));
});
