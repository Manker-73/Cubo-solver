// Megaminx: movimientos Pochmann (R++, R--, D++, D--, U, U') y vista previa del scramble.
//
// Definición (WCA, notación de Stefan Pochmann): R++ = sujetar la cara L y girar todo
// lo demás 2/5 de vuelta en sentido horario visto desde la derecha; D++ = sujetar la
// cara U y girar todo lo demás 2/5 en sentido horario visto desde abajo. En TNoodle
// (MegaminxPuzzle.java): "R" -> bigTurn(DBR) (todo menos la capa opuesta a DBR, que es
// L, girado como la cara DBR) y "D" -> bigTurn(D). Los ciclos de centros esperados de
// abajo están sacados de bigTurn (swapCenters / swapWholeFace) de TNoodle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p from '../src/puzzles/megaminx.js';
import { geo, CARAS, IDX, normales, H } from '../src/puzzles/megaminx-geo.js';
import { CENTROS, sigmaDeCentros } from '../src/puzzles/megaminx-piezas.js';
import { aplicarPerm } from '../src/core/perm.js';
import { dot } from '../src/core/geometria.js';
import { rngConSemilla, entero } from '../src/core/rng.js';
import { CASOS, casosPor, guardarResultado } from './util.mjs';

const N_VISTA = casosPor(Math.min(CASOS, 1000), 30); // rápido: cada caso es una resolución (~0,1 s)

const e0 = p.estadoResuelto();
const centros = (e) => CENTROS.map((i) => e[i]);
const capa = (f) => geo.pegatinas.map((q, i) => (dot(q.centro, normales[f]) > H + 1e-9 ? i : -1)).filter((i) => i >= 0);

/** Centros tras k quintos de un giro "grande" dado como "el contenido de A pasa a B". */
function centrosEsperados(pasos, k) {
  let c = [...Array(12).keys()];
  for (let r = 0; r < k; r++) {
    const n = c.slice();
    for (const [a, b] of pasos) n[IDX[b]] = c[IDX[a]];
    c = n;
  }
  return c;
}
// un quinto de bigTurn(DBR) en TNoodle (L y DBR quedan en su sitio)
const R_QUINTO = [['F', 'U'], ['DL', 'F'], ['DBL', 'DL'], ['BL', 'DBL'], ['U', 'BL'], ['R', 'BR'], ['DR', 'R'], ['D', 'DR'], ['B', 'D'], ['BR', 'B']];
// un quinto de bigTurn(D) en TNoodle (U y D quedan en su sitio)
const D_QUINTO = [['BR', 'BL'], ['R', 'BR'], ['F', 'R'], ['L', 'F'], ['BL', 'L'], ['DBL', 'DL'], ['B', 'DBL'], ['DBR', 'B'], ['DR', 'DBR'], ['DL', 'DR']];

test('Pochmann: R++ deja quieta la capa L (no la opuesta a R) y gira el resto alrededor del eje de DBR', () => {
  const r = p.aplicarMovimiento(e0, 'R++');
  const quietas = geo.perms['R++'].map((x, i) => (x === i ? i : -1)).filter((i) => i >= 0).sort((a, b) => a - b);
  const esperadas = [...capa(IDX.L), CENTROS[IDX.DBR]].sort((a, b) => a - b);
  assert.deepEqual(quietas, esperadas, 'R++: solo la capa L (y el centro de DBR, en el eje) no se mueve');
  // es "todo el puzzle girado" + la capa L girada al revés: tras L2' queda un puzzle entero girado
  assert.ok(p.estaResuelto(p.aplicarMovimiento(r, "L2'")), "R++ L2' es una rotación del puzzle entero");
  assert.ok(!p.estaResuelto(p.aplicarMovimiento(r, 'L2')));
  assert.deepEqual(centros(r), centrosEsperados(R_QUINTO, 2), 'centros tras R++ (TNoodle)');
  assert.deepEqual(centros(p.aplicarMovimiento(e0, 'R--')), centrosEsperados(R_QUINTO, 3), 'centros tras R-- (TNoodle)');
});

test('Pochmann: D++ deja quieta la capa U y gira el resto alrededor del eje de D; U es la cara U', () => {
  const d = p.aplicarMovimiento(e0, 'D++');
  const quietas = geo.perms['D++'].map((x, i) => (x === i ? i : -1)).filter((i) => i >= 0).sort((a, b) => a - b);
  assert.deepEqual(quietas, [...capa(IDX.U), CENTROS[IDX.D]].sort((a, b) => a - b));
  assert.ok(p.estaResuelto(p.aplicarMovimiento(d, "U2'")), "D++ U2' es una rotación del puzzle entero");
  assert.deepEqual(centros(d), centrosEsperados(D_QUINTO, 2), 'centros tras D++ (TNoodle)');
  assert.deepEqual(centros(p.aplicarMovimiento(e0, 'D--')), centrosEsperados(D_QUINTO, 3), 'centros tras D-- (TNoodle)');
  assert.deepEqual(geo.perms.U, geo.perms[CARAS[IDX.U]]);
});

test(`Pochmann: los centros siempre quedan como una rotación rígida y la vista previa los devuelve a su sitio (${CASOS} scrambles)`, () => {
  const rng = rngConSemilla(91);
  const vistas = new Set();
  let distintas = new Set();
  for (let i = 0; i < CASOS; i++) {
    const s = p.generarScramble(rng);
    const e = p.aplicarSecuencia(e0, s);
    // rígida: los centros son una de las 60 rotaciones del esquema (vecinas en el mismo orden)
    assert.ok(sigmaDeCentros(e), `scramble ${i}: los centros no son una rotación rígida`);
    distintas.add(centros(e).join(','));
    // vista previa: mismos colores de centro en las mismas posiciones, siempre
    const v = p.estadoVistaScramble(e);
    assert.deepEqual(centros(v), [...Array(12).keys()], `scramble ${i}: vista previa con los centros movidos`);
    // solo es una rotación del puzzle entero: mismo estado salvo orientación
    assert.ok(geo.rotaciones.some((P) => aplicarPerm(e, P).every((x, k) => x === v[k])));
    vistas.add(centros(v).join(','));
  }
  assert.equal(vistas.size, 1);
  guardarResultado('megaminx', { pochmann: { scrambles: CASOS, orientacionesDistintasTrasElScramble: distintas.size, orientacionesEnLaVistaPrevia: vistas.size } });
});

test('Pochmann: la indicación de cómo sujetar el puzzle coincide con dónde quedan los centros blanco y verde', () => {
  const rng = rngConSemilla(92);
  for (let i = 0; i < 50; i++) {
    const s = p.generarScramble(rng);
    const e = p.aplicarSecuencia(e0, s);
    const nota = p.notaScramble(s);
    const dondeBlanco = CARAS[centros(e).indexOf(IDX.U)], dondeVerde = CARAS[centros(e).indexOf(IDX.F)];
    assert.match(nota, new RegExp(`blanco.*\\b${dondeBlanco}\\b`));
    assert.match(nota, new RegExp(`verde oscuro.*\\b${dondeVerde}\\b`));
  }
});

test(`Pochmann: el estado de la vista previa pasa el validador y el solver lo resuelve (${N_VISTA} casos)`, () => {
  p.inicializar();
  const rng = rngConSemilla(93);
  const n = N_VISTA;
  let suma = 0;
  for (let i = 0; i < n; i++) {
    const v = p.estadoVistaScramble(p.aplicarSecuencia(e0, p.generarScramble(rng)));
    const val = p.validar(v);
    assert.ok(val.valido, val.errores.join(' | '));
    const r = p.resolver(v, { orientaciones: 1 });
    assert.ok(r.ok);
    const fin = p.aplicarSecuencia(v, r.movimientos);
    assert.ok(geo.pegatinas.every((q, k) => fin[k] === q.cara), `caso ${i}: no queda resuelto en la orientación de referencia`);
    suma += r.movimientos.length;
  }
  guardarResultado('megaminx', { vistaPrevia: { casos: n, resueltos: `${n}/${n}`, longitudMediaUnaOrientacion: +(suma / n).toFixed(2) } });
});
