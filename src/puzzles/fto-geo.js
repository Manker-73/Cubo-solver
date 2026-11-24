// @ts-check
// FTO (Face-Turning Octahedron): geometría, red 2D, giros, piezas y orientación libre.
//
// Notación WCA (Reglamento 2027, 12f; borrador en la rama drafts2027 de
// github.com/thewca/wca-regulations, PR #31 «P002-FTO»):
//   12f1) se sujeta con cuatro caras a la vista y el vértice que comparten hacia quien mezcla;
//   12f2) U (arriba), F (delante, la de abajo de las cuatro), R (derecha), L (izquierda),
//         B (detrás, vecina de U), D (abajo, vecina de F), BR (detrás a la derecha, vecina de R),
//         BL (detrás a la izquierda, vecina de L): 120° en sentido horario mirando la cara;
//   12f3) con ' en sentido antihorario.
// Caras opuestas (paralelas): U–D, F–B, R–BL, L–BR. Dos caras opuestas no comparten piezas
// (sus giros conmutan); cualquier otro par sí.
//
// Coordenadas: x a la derecha, y arriba, z hacia quien sujeta el puzzle. Vértices en (0,0,±1)
// (delante/detrás) y (±1,±1,0)/√2; la cara U es la de arriba del vértice delantero.
//
// Colores (paleta, color i = cara i): los de TNoodle, el programa oficial de scrambles de la
// WCA (FaceTurningOctahedronPuzzle.getDefaultColorScheme): U blanco, F verde, R rojo,
// L morado, B azul, D amarillo, BR gris, BL naranja. Cumple el Reglamento 4d6 (blanco arriba
// y verde delante, que comparte esquina con blanco). Pendiente de comprobar con un FTO físico.
//
// Cortes: cada cara gira lo que queda por encima del plano paralelo a ella a 1/3 de su
// distancia al centro. Cada cara se divide en 9 triángulos: 3 esquinas, 3 aristas y 3
// "triángulos" (centros). Piezas: 6 esquinas (4 pegatinas), 12 aristas (2) y 24 triángulos (1).
//
// Las caras se reparten en dos tétradas que no se tocan entre sí: A = {U, F, BR, BL} y
// B = {R, L, B, D}. Cada arista une una cara de cada tétrada, y alrededor de cada esquina
// se alternan A y B. Las pegatinas de las piezas se ordenan empezando por una de la tétrada A,
// así un giro nunca cambia la orientación de una arista y una esquina solo gira 0 o 2 pasos.

import { crearGeoPuzzle, modelo3DGeo } from '../core/geopuzzle.js';
import { carasDesdeVertices, unit, dot } from '../core/geometria.js';
import { crearModeloPiezas } from '../core/piezas.js';
import { permutacionesDeColor } from '../core/simetria.js';
import { encoger } from '../core/render.js';

/** @import { ColorPaleta } from '../core/tipos.js' */

export const CARAS = ['U', 'F', 'R', 'L', 'B', 'D', 'BR', 'BL'];
/** @type {Record<string, number>} */
export const IDX = Object.fromEntries(CARAS.map((c, i) => [c, i]));
export const TETRADA_A = ['U', 'F', 'BR', 'BL'];
export const TETRADA_B = ['R', 'L', 'B', 'D'];
export const enA = CARAS.map((c) => TETRADA_A.includes(c));
/** @type {Record<string, string>} */
export const OPUESTA = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'BL', BL: 'R', L: 'BR', BR: 'L' };

/** @type {ColorPaleta[]} */
export const PALETA_FTO = [
  { nombre: 'blanco', hex: '#f4f4f4' },  // U
  { nombre: 'verde', hex: '#2a9d4b' },   // F
  { nombre: 'rojo', hex: '#d62828' },    // R
  { nombre: 'morado', hex: '#7b3fb5' },  // L
  { nombre: 'azul', hex: '#1d5ad8' },    // B
  { nombre: 'amarillo', hex: '#ffd60a' }, // D
  { nombre: 'gris', hex: '#9aa0a6' },    // BR
  { nombre: 'naranja', hex: '#f77f00' }, // BL
];

const S = Math.SQRT1_2, R2 = Math.SQRT2;
const VERTICES = [[0, 0, 1], [0, 0, -1], [S, S, 0], [-S, S, 0], [S, -S, 0], [-S, -S, 0]];
/** @type {Record<string, number[]>} */
const N0 = { U: [0, R2, 1], F: [0, -R2, 1], R: [R2, 0, 1], L: [-R2, 0, 1], B: [0, R2, -1], D: [0, -R2, -1], BR: [R2, 0, -1], BL: [-R2, 0, -1] };
/** Normales unitarias de las caras, en el orden de CARAS. */
export const NORMALES = CARAS.map((c) => unit(N0[c]));
/** Profundidad de los cortes: 1/3 del inradio (1/√3). */
export const H = 1 / (3 * Math.sqrt(3));
const T = (2 * Math.PI) / 3;

/** Giros de cara: X (120° horario mirando la cara) y X' (antihorario). */
export const MOVS = CARAS.flatMap((c) => [c, c + "'"]);
/** @type {Record<string, { eje: number[], ang: number, umbral: number }>} */
const giros = {};
CARAS.forEach((c, i) => {
  giros[c] = { eje: NORMALES[i], ang: -T, umbral: H };
  giros[c + "'"] = { eje: NORMALES[i], ang: T, umbral: H };
});

export const geo = crearGeoPuzzle({
  caras: carasDesdeVertices(VERTICES, NORMALES),
  cortes: NORMALES.map((n) => ({ n, h: H })),
  giros,
  // 90° alrededor del eje delante–detrás y 120° alrededor de U: las 24 rotaciones
  rotaciones: [{ eje: [0, 0, 1], ang: Math.PI / 2 }, { eje: NORMALES[0], ang: T }],
  red: { arboles: [] },
});
if (geo.n !== 72) throw new Error('FTO: se esperaban 72 pegatinas y hay ' + geo.n);
if (geo.rotaciones.length !== 24) throw new Error('FTO: se esperaban 24 rotaciones');

// ---------- Red 2D ----------
// Como la imagen de TNoodle: dos cuadrados. A la izquierda, las cuatro caras de delante
// vistas de frente (U arriba, F abajo, L y R a los lados); a la derecha, las cuatro de
// detrás vistas desde atrás (el puzzle girado media vuelta alrededor del eje vertical:
// B arriba, D abajo, BR a la izquierda y BL a la derecha).
const SEPARACION = 2 * S + 0.32;
geo.pegatinas.forEach((/** @type {{ cara: number, poligono: number[][] }} */ p, /** @type {number} */ i) => {
  const delante = NORMALES[p.cara][2] > 0;
  const poly = p.poligono.map(([x, y]) => (delante ? [x, -y] : [-x + SEPARACION, -y]));
  geo.pegatinas2D[i] = { poligono: encoger(poly, 0.86) };
});

// ---------- Piezas ----------
/** Caras en cuya capa está la pegatina i (su centro queda por encima del corte de esa cara). */
/** @param {number} i @returns {number[]} */
export const carasDePegatina = (i) => NORMALES.map((n, f) => (dot(geo.pegatinas[i].centro, n) > H + 1e-9 ? f : -1)).filter((f) => f >= 0);
/** @typedef {{ caras: number[], pegatinas: number[] }} PiezaFTO */
/** @type {{ clave: string, pegatinas: number[] }[]} */
const grupos = geo.piezasPor((/** @type {number[]} */ _c, /** @type {number} */ i) => carasDePegatina(i).join(','));
/** @param {number} k @returns {PiezaFTO[]} */
const piezasDe = (k) => grupos.filter((g) => g.pegatinas.length === k)
  .map((g) => ({ caras: g.clave.split(',').map(Number), pegatinas: g.pegatinas }))
  .sort((a, b) => a.caras.join(',').localeCompare(b.caras.join(','), 'en', { numeric: true }));
/** @type {(f: number) => number} */
const caraDe = (f) => geo.pegatinas[f].cara;

/** Esquinas: pegatinas en sentido horario visto desde fuera, empezando por una de la tétrada A. */
export const ESQUINAS = piezasDe(4).map((pz) => {
  const k = pz.pegatinas.findIndex((f) => enA[caraDe(f)]);
  return { caras: pz.caras, pegatinas: [...pz.pegatinas.slice(k), ...pz.pegatinas.slice(0, k)] };
});
/** Aristas: [pegatina de la cara A, pegatina de la cara B]. */
export const ARISTAS = piezasDe(2).map((pz) => ({
  caras: pz.caras,
  pegatinas: enA[caraDe(pz.pegatinas[0])] ? pz.pegatinas : [pz.pegatinas[1], pz.pegatinas[0]],
}));
const triangulos = piezasDe(1).sort((a, b) => caraDe(a.pegatinas[0]) - caraDe(b.pegatinas[0]) || a.pegatinas[0] - b.pegatinas[0]);
/** Triángulos de las caras de la tétrada A (una órbita de 12) y de la B (otra de 12). */
export const TRI_A = triangulos.filter((t) => enA[caraDe(t.pegatinas[0])]);
export const TRI_B = triangulos.filter((t) => !enA[caraDe(t.pegatinas[0])]);
if (ESQUINAS.length !== 6 || ARISTAS.length !== 12 || TRI_A.length !== 12 || TRI_B.length !== 12) {
  throw new Error('FTO: piezas inesperadas');
}
for (const e of ESQUINAS) if (!e.pegatinas.every((f, j) => enA[caraDe(f)] === (j % 2 === 0))) throw new Error('FTO: las caras de una esquina no alternan A y B');
for (const a of ARISTAS) if (!enA[caraDe(a.pegatinas[0])] || enA[caraDe(a.pegatinas[1])]) throw new Error('FTO: una arista no une una cara A y una B');

export const ORB_ESQ = 0, ORB_ARI = 1, ORB_TA = 2, ORB_TB = 3;
/** Nombre de una posición: sus caras (U-F-R-L). @param {PiezaFTO} pz */
export const nombrePos = (pz) => pz.caras.map((f) => CARAS[f]).join('-');

export const modelo = crearModeloPiezas({
  orbitas: [
    { nombre: 'esquinas', piezas: ESQUINAS.map((p) => p.pegatinas) },
    { nombre: 'aristas', piezas: ARISTAS.map((p) => p.pegatinas) },
    { nombre: 'triángulos A', piezas: TRI_A.map((p) => p.pegatinas) },
    { nombre: 'triángulos B', piezas: TRI_B.map((p) => p.pegatinas) },
  ],
  movimientos: Object.fromEntries(MOVS.map((m) => [m, /** @type {Record<string, number[]>} */ (geo.perms)[m]])),
  coloresResuelto: geo.resuelto,
});

// ---------- Orientación libre ----------
// Las 24 rotaciones del puzzle entero como permutaciones de colores (sigma[colorPintado] =
// color canónico). Solo 12 están en el grupo de los giros (las que no cambian de tétrada, ver
// fto-grupo.js): las otras 12 llevan los colores de A a caras B.
const REP = CARAS.map((_, c) => TRI_A.concat(TRI_B).find((t) => caraDe(t.pegatinas[0]) === c)?.pegatinas[0] ?? -1);
export const SIGMAS = permutacionesDeColor(geo.rotaciones, geo.resuelto, REP);
if (SIGMAS.length !== 24) throw new Error('FTO: se esperaban 24 orientaciones');
/** true si la rotación conserva las tétradas (está en el grupo de los giros). */
export const sigmaPar = SIGMAS.map((s) => s.every((c, f) => enA[c] === enA[f]));

/** Cámara de la vista 3D: casi de frente al vértice delantero (como se sujeta para mezclar, 12f1), un poco desde arriba y la derecha. */
export const CAMARA_FTO = { desde: [0.12, 0.2, 1], arriba: [0, 1, 0] };
export const vista3DGeo = modelo3DGeo(geo, CAMARA_FTO);
