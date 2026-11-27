// Shape mods (noche 16): Mirror Blocks y Ghost Cube.
//  - Geometría: en el resuelto las piezas encajan sin huecos ni solapes y forman el cubo; tras cualquier
//    secuencia cada pieza conserva su forma y su volumen; Mirror: medidas de cada pieza.
//  - Qué centros tienen la orientación visible (simetría de su forma), restricciones y tamaño del grupo
//    de estados distinguibles (Schreier–Sims sobre las marcas), estados con la forma de cubo resuelto.
//  - Scrambles (de estado aleatorio, exactos), solver (con el puzzle sujetado de cualquier forma; cada
//    solución se aplica giro a giro), un rechazo por restricción y el 3x3 de WCA sin cambios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { obtenerPuzzle } from '../src/puzzles/index.js';
import cubo3 from '../src/puzzles/cubo3.js';
import { ordenGrupo } from '../src/core/grupo.js';
import { rngConSemilla, entero } from '../src/core/rng.js';
import { volumen, verticesDe, transformar, mismoPoliedro, matRot, mm, NOMBRE_HUECO, TIPO_HUECO } from '../src/puzzles/shapemod-geo.js';
import { ALGORITMOS_CENTROS, efectoSecuencia } from '../src/puzzles/shapemod-centros.js';
import { probarScrambles, probarSolver, debeRechazar, guardarResultado, casosPor, CASOS } from './util.mjs';

const mirror = obtenerPuzzle('mirror');
const ghost = obtenerPuzzle('ghost');
const TODOS = [mirror, ghost];
const N = casosPor(1000, 100);

/** Puzzle sujetado de otra forma: marcas del estado giradas con una de las 24 rotaciones. */
const reorientar = (p) => (e, i, rng) => p.shapeMod.permutar(p.shapeMod.aMarcas(e), p.shapeMod.permRotacion(entero(rng, 24)));

// ---------- geometría ----------
test('shape mods: en el resuelto las piezas encajan sin huecos ni solapes y forman el cubo', () => {
  for (const p of TODOS) {
    const { G } = p.shapeMod;
    const c = G.corte, h = G.semilado;
    const caras = p.shapeMod.carasColocadas(p.estadoResuelto());
    // por pieza: sus caras en la forma de cubo
    const porPieza = new Map();
    for (const f of caras) { if (!porPieza.has(f.hueco)) porPieza.set(f.hueco, []); porPieza.get(f.hueco).push({ pts: f.puntos, n: f.normal }); }
    assert.equal(porPieza.size, 26);
    const planos = G.planosCuerpo(0); // el cubo (en la forma de cubo, sin girar)
    let total = 0;
    for (const [s, fs2] of porPieza) {
      const P = { caras: fs2 };
      total += volumen(P);
      // dentro del cubo
      for (const v of verticesDe(P)) for (const pl of planos) assert.ok(pl.n[0] * v[0] + pl.n[1] * v[1] + pl.n[2] * v[2] <= pl.d + 1e-7, `${p.id}: ${NOMBRE_HUECO[s]} se sale del cubo`);
    }
    // el núcleo (|x|,|y|,|z| ≤ c) está dentro del cubo; piezas + núcleo = cubo: sin huecos (y sin solapes:
    // cada pieza está en su celda del mecanismo, que no se cortan)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const v = [sx * c, sy * c, sz * c];
      for (const pl of planos) assert.ok(pl.n[0] * v[0] + pl.n[1] * v[1] + pl.n[2] * v[2] <= pl.d + 1e-9);
    }
    const nucleo = (2 * c) ** 3, cubo = (2 * h) ** 3;
    assert.ok(Math.abs(total + nucleo - cubo) < 1e-9, `${p.id}: piezas ${total} + núcleo ${nucleo} ≠ cubo ${cubo}`);
    // celdas: cada vértice en el lado de su celda
    for (const [s, fs2] of porPieza) {
      if (p.id === 'ghost') continue; // (en la forma de cubo, las capas de arriba y abajo están giradas)
      const pos = G.posHueco[s];
      for (const v of verticesDe({ caras: fs2 })) for (let a = 0; a < 3; a++) {
        if (pos[a] > 0) assert.ok(v[a] >= c - 1e-9); else if (pos[a] < 0) assert.ok(v[a] <= -c + 1e-9); else assert.ok(Math.abs(v[a]) <= c + 1e-9);
      }
    }
  }
  // Ghost Cube: con las capas alineadas NO es un cubo (cada capa está cortada de un cubo girado distinto)
  const al = ghost.aplicarMovimiento(ghost.estadoResuelto(), 'A');
  const planos = ghost.shapeMod.G.planosCuerpo(0);
  const fuera = ghost.shapeMod.carasColocadas(al).some((f) => f.puntos.some((v) => planos.some((pl) => pl.n[0] * v[0] + pl.n[1] * v[1] + pl.n[2] * v[2] > pl.d + 1e-6)));
  assert.ok(fuera, 'Ghost Cube alineado: alguna pieza sobresale del cubo');
});

test('shape mods: tras cualquier secuencia cada pieza conserva su forma y su volumen', () => {
  const rng = rngConSemilla(8);
  for (const p of TODOS) {
    const { G } = p.shapeMod;
    for (let k = 0; k < 20; k++) {
      let e = p.estadoResuelto();
      for (let i = 0; i < 25; i++) { const l = p.shapeMod.movimientosLegales(e); e = p.aplicarMovimiento(e, l[entero(rng, l.length)]); }
      const caras = p.shapeMod.carasColocadas(e);
      const col = G.colocacion(e);
      for (let s = 0; s < 26; s++) {
        const P = { caras: caras.filter((f) => f.hueco === s).map((f) => ({ pts: f.puntos, n: f.normal })) };
        const k2 = col[s].pieza;
        assert.ok(Math.abs(volumen(P) - volumen(G.formas[k2])) < 1e-9, `${p.id}: volumen de la pieza ${NOMBRE_HUECO[k2]}`);
        // la forma es la de la pieza, movida con un giro (rígido): mismas distancias entre vértices
        const d = (Q) => verticesDe(Q).flatMap((a, i, vs) => vs.slice(i + 1).map((b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))).sort((x, y) => x - y);
        const a = d(P), b = d(G.formas[k2]);
        assert.equal(a.length, b.length);
        a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < 1e-7));
      }
    }
  }
});

test('Mirror Blocks: medidas de cada pieza (orden de grosores publicado, 57 mm, capa del medio de 19 mm)', () => {
  const { G } = mirror.shapeMod;
  const MM = 19; // la capa del medio = 1 unidad = 57 mm / 3
  // grosor de la capa exterior de cada cara (en mm)
  const grosor = {};
  const caja = (P) => [0, 1, 2].map((a) => { const v = verticesDe(P).map((x) => x[a]); return [Math.min(...v), Math.max(...v)]; });
  for (const [f, s, a, lado] of [['U', 20, 1, 1], ['R', 21, 0, 1], ['F', 22, 2, 1], ['D', 23, 1, 0], ['L', 24, 0, 0], ['B', 25, 2, 0]]) {
    const b = caja(G.formas[s])[a];
    grosor[f] = +((b[1] - b[0]) * MM).toFixed(2);
  }
  // fuente (3dcubesolver.com, «Mirror cube solver»): de la más fina a la más gruesa U, L, F, B, R, D; opuestas suman 7 en el orden
  const orden = Object.entries(grosor).sort((x, y) => x[1] - y[1]).map((x) => x[0]).join('');
  assert.equal(orden, 'ULFBRD');
  // cada eje mide 57 mm (cubo de 57 mm): las dos capas exteriores + la del medio
  assert.ok(Math.abs(grosor.U + grosor.D + MM - 57) < 1e-9 && Math.abs(grosor.L + grosor.R + MM - 57) < 1e-9 && Math.abs(grosor.F + grosor.B + MM - 57) < 1e-9);
  assert.deepEqual(grosor, { U: 9.5, R: 25.33, F: 15.83, D: 28.5, L: 12.67, B: 22.17 });
  // medidas de cada pieza = combinación de los grosores de sus capas (19 mm en las del medio)
  const ejeDe = { U: 1, D: 1, R: 0, L: 0, F: 2, B: 2 };
  const medidas = [];
  for (let s = 0; s < 26; s++) {
    const esperado = [MM, MM, MM];
    for (const f of NOMBRE_HUECO[s].split('')) esperado[ejeDe[f]] = grosor[f];
    const real = caja(G.formas[s]).map((b) => +((b[1] - b[0]) * MM).toFixed(2));
    assert.deepEqual(real, esperado, NOMBRE_HUECO[s]);
    medidas.push(`${NOMBRE_HUECO[s]} ${real.join('×')}`);
    // todas las piezas son prismas rectangulares (6 caras)
    assert.equal(G.formas[s].caras.length, 6);
  }
  // ninguna esquina ni arista es igual a otra (ni girada): las 20 tienen medidas distintas
  const formas = medidas.filter((_, s) => s < 20).map((m) => m.split(' ')[1].split('×').map(Number).sort((a, b) => a - b).join('×'));
  assert.equal(new Set(formas).size, 20);
  guardarResultado('shapemods', { mirrorGrosoresMm: grosor, mirrorMedidasMm: medidas });
});

// ---------- grupo, centros y estados con forma de cubo ----------
test('shape mods: centros con orientación visible, restricciones y tamaño del grupo (Schreier–Sims)', () => {
  const tres = 43252003274489856000n;
  for (const p of TODOS) {
    const sm = p.shapeMod;
    // periodo visible de cada centro: el menor giro de 90°·k que deja su forma igual
    const per = sm.G.formas.slice(20).map((P, i) => {
      for (const k of [1, 2]) if (mismoPoliedro(transformar(P, sm.G.rotacionPieza(20 + i, 20 + i, k)), P)) return k;
      return 4;
    });
    assert.deepEqual(per, sm.periodos);
    const gens = ['U', 'R', 'F', 'D', 'L', 'B'].map((m) => sm.permMov(m).slice(0, sm.N_POS - (sm.posForma >= 0 ? 1 : 0)));
    const orden = ordenGrupo(gens);
    const visibles = sm.periodos.reduce((a, x) => a * BigInt(x), 1n);
    const restr = sm.periodos.every((x) => x % 2 === 0) ? 2n : 1n;
    assert.equal(orden, (tres * visibles) / restr, p.id);
    guardarResultado('shapemods', { [p.id]: { periodosCentros: sm.periodos, ordenGrupo: orden.toString(), restriccionCentros: restr === 2n } });
  }
  assert.deepEqual(mirror.shapeMod.periodos, [1, 1, 1, 1, 1, 1]); // sus centros son prismas de base cuadrada
  assert.deepEqual(ghost.shapeMod.periodos, [4, 4, 4, 4, 4, 4]); // ninguna simetría: se ve cualquier giro
});

test('shape mods: estados que se ven como el cubo resuelto', () => {
  for (const p of TODOS) {
    const enc = p.shapeMod.G.encajes();
    // en cada hueco de esquina o arista solo encaja su pieza, sin girar
    for (let s = 0; s < 20; s++) assert.deepEqual(enc[s], [{ pieza: s, o: 0 }], `${p.id} ${NOMBRE_HUECO[s]}`);
    // centros: las orientaciones que dejan la misma forma = las que no se ven
    for (let f = 0; f < 6; f++) assert.equal(enc[20 + f].length, 4 / p.shapeMod.periodos[f]);
    // un único estado distinguible; estados del mecanismo con esa forma: 4⁶/2 = 2.048 (Mirror) o 1 (Ghost)
    const internos = enc.slice(20).reduce((a, l) => a * l.length, 1) / (p.shapeMod.periodos.every((x) => x === 1) ? 2 : 1);
    assert.equal(internos, p.id === 'mirror' ? 2048 : 1);
    assert.ok(p.estaResuelto(p.estadoResuelto()));
    guardarResultado('shapemods', { [p.id + 'FormaDeCubo']: { distinguibles: 1, delMecanismo: internos } });
  }
  // Mirror: girar un centro (invisible) sigue siendo «resuelto»; en el Ghost no
  const m = mirror.clonar(mirror.estadoResuelto()); m.ct = [1, 0, 0, 0, 0, 0];
  assert.ok(mirror.estaResuelto(m));
  const g = ghost.aplicarSecuencia(ghost.estadoResuelto(), ['A', ...ALGORITMOS_CENTROS[2].algoritmo.split(' '), "A'"]);
  assert.equal(ghost.estaResuelto(g), false, 'Ghost: el centro U girado 180° se ve');
  // Ghost alineado (piezas en su sitio): no tiene la forma de cubo
  assert.equal(ghost.estaResuelto(ghost.aplicarMovimiento(ghost.estadoResuelto(), 'A')), false);
});

test('shape mods: algoritmos de centros puros (comprobados)', () => {
  for (const a of ALGORITMOS_CENTROS) {
    const ef = efectoSecuencia(a.algoritmo.split(' '));
    assert.ok(ef.puro, a.algoritmo);
    assert.deepEqual(ef.delta, a.delta);
  }
  // la tabla de la fase de centros cubre las 64 combinaciones de medias vueltas
  const T = ghost.shapeMod.centros();
  for (let m = 0; m < 64; m++) {
    const falta = [0, 1, 2, 3, 4, 5].map((f) => ((m >> f) & 1 ? 2 : 0));
    const s = T.secuencia(falta);
    const ef = efectoSecuencia(s);
    assert.ok(ef.puro);
    assert.deepEqual(ef.delta, falta);
  }
});

// ---------- validador ----------
test('shape mods: un rechazo por restricción (con mensaje claro)', () => {
  for (const p of TODOS) {
    p.inicializar();
    const e = p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rngConSemilla(4)));
    const mod = (f) => { const x = p.clonar(e); f(x); return x; };
    debeRechazar(p, mod((x) => { x.co[0] = (x.co[0] + 1) % 3; }), 'esquina girada');
    debeRechazar(p, mod((x) => { x.eo[3] ^= 1; }), 'arista volteada');
    debeRechazar(p, mod((x) => { [x.ep[0], x.ep[1]] = [x.ep[1], x.ep[0]]; }), 'intercambiadas');
    // marcas: falta una pieza, una pieza repetida, centros en una disposición imposible
    const m = p.shapeMod.aMarcas(e);
    const falta = m.slice(); falta[0] = falta[1] = falta[2] = -1;
    debeRechazar(p, falta, 'Faltan 1 pieza');
    const rep = m.slice(); for (let j = 0; j < 3; j++) rep[3 + j] = m[j];
    debeRechazar(p, rep, 'dos veces');
    const cen = m.slice(); [cen[48], cen[53]] = [cen[53], cen[48]];
    debeRechazar(p, cen, 'centros no están en una disposición posible');
  }
  // Ghost Cube: un centro girado un cuarto de vuelta (paridad de los centros = la de las esquinas)
  const e = ghost.aplicarSecuencia(ghost.estadoResuelto(), ghost.generarScramble(rngConSemilla(5)));
  const x = ghost.clonar(e); x.ct[2] = (x.ct[2] + 1) % 4;
  debeRechazar(ghost, x, 'centro girado un cuarto de vuelta');
  // y la misma pieza con el centro girado media vuelta sí vale (se ve, pero es alcanzable)
  const y = ghost.clonar(e); y.ct[2] = (y.ct[2] + 2) % 4;
  assert.ok(ghost.validar(y).valido);
  // Mirror: los centros no se ven: cualquier giro de centro vale
  const z = mirror.clonar(mirror.estadoResuelto()); z.ct = [1, 0, 0, 0, 0, 0];
  assert.ok(mirror.validar(z).valido);
});

// ---------- scramble y solver ----------
for (const p of TODOS) {
  test(`${p.nombre}: scrambles de estado aleatorio (exactos) y solver con el puzzle sujetado de cualquier forma`, { timeout: 3600000 }, () => {
    p.inicializar();
    const sc = probarScrambles(p, 1, N);
    // exacto: el scramble lleva del resuelto al estado elegido
    const rng = rngConSemilla(9);
    const nExactos = Math.min(N, 200);
    for (let i = 0; i < nExactos; i++) {
      const d = p.shapeMod.scrambleDetallado(rng);
      const fin = p.aplicarSecuencia(p.estadoResuelto(), d.movimientos);
      const a = p.shapeMod.normalizar(fin).estado, b = p.shapeMod.normalizar(d.estado).estado;
      assert.deepEqual(a, b, `scramble ${i} no exacto`);
    }
    const sol = probarSolver(p, { semilla: 2, transformar: reorientar(p), n: N });
    assert.equal(sol.resueltos, `${N}/${N} (100.0%)`);
    guardarResultado('shapemods', { [p.id + 'Solver']: { ...sc, ...sol, scramblesExactos: nExactos } });
  });
}

test('shape mods: casos límite del solver (solo centros, solo forma, resuelto)', () => {
  ghost.inicializar();
  // solo un centro a media vuelta (piezas en su sitio)
  const e = ghost.clonar(ghost.estadoResuelto()); e.ct = [0, 0, 2, 0, 0, 0];
  let r = ghost.resolver(e);
  assert.ok(r.ok && ghost.estaResuelto(ghost.aplicarSecuencia(e, r.movimientos)));
  // dos centros a un cuarto de vuelta (U y D, en sentidos opuestos): Kociemba tiene que mover algo
  const e2 = ghost.clonar(ghost.estadoResuelto()); e2.ct = [1, 0, 0, 3, 0, 0];
  r = ghost.resolver(e2);
  assert.ok(r.ok && ghost.estaResuelto(ghost.aplicarSecuencia(e2, r.movimientos)), ghost.formatear(r.movimientos || []));
  // alineado y resuelto: solo «A'»
  r = ghost.resolver(ghost.aplicarMovimiento(ghost.estadoResuelto(), 'A'));
  assert.deepEqual(r.movimientos, ["A'"]);
  // con la forma de cubo solo giran U y D
  assert.throws(() => ghost.aplicarMovimiento(ghost.estadoResuelto(), 'R'), /primero alinea/);
  assert.ok(ghost.aplicarMovimiento(ghost.estadoResuelto(), 'U2'));
  // resuelto: solución vacía
  assert.deepEqual(mirror.resolver(mirror.estadoResuelto()).movimientos, []);
});

test('3x3 de WCA: mismos scrambles y soluciones que antes de los ganchos de kociemba.js', () => {
  const ref = JSON.parse(fs.readFileSync(new URL('./kociemba-referencia.json', import.meta.url), 'utf8'));
  const rng = rngConSemilla(ref.semilla);
  cubo3.inicializar();
  const n = CASOS >= 1000 ? ref.casos.length : 10;
  for (const c of ref.casos.slice(0, n)) {
    const s = cubo3.generarScramble(rng);
    assert.equal(s.join(' '), c.scramble);
    const r = cubo3.resolver(cubo3.aplicarSecuencia(cubo3.estadoResuelto(), s), { msMax: 60000 });
    assert.equal(r.movimientos.join(' '), c.solucion);
  }
});

test('shape mods: tipos de las piezas y nombres', () => {
  assert.equal(TIPO_HUECO.filter((t) => t === 'esquina').length, 8);
  // giro de 90° de una cara = permutación de las marcas de orden 4
  for (const p of TODOS) {
    const P = p.shapeMod.permMov('U');
    let x = Array.from({ length: P.length }, (_, i) => i);
    for (let k = 0; k < 4; k++) x = p.shapeMod.permutar(x, P);
    assert.ok(x.every((v, i) => v === i));
  }
  assert.ok(mm(matRot([0, 1, 0], Math.PI / 2), matRot([0, 1, 0], -Math.PI / 2)).every((f, i) => f.every((v, j) => Math.abs(v - (i === j ? 1 : 0)) < 1e-12)));
});
