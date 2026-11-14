// Megaminx: geometría (132 pegatinas, red de dos "flores"), giros de las 12 caras,
// movimientos Pochmann de los scrambles y rotaciones del puzzle entero.
//
// Los colores (PALETA_MEGA, color i = cara i) y la red están comprobados con un
// Megaminx físico: no cambiarlos.
//
// Nombres de las caras (convención más habitual en algoritmos y simuladores):
//   arriba U; anillo superior, en sentido horario visto desde arriba: F, R, BR, BL, L;
//   abajo D; anillo inferior: DR (debajo, entre F y R), DBR, B (detrás, opuesta a F), DBL, DL.
// Giros: X = 72° en sentido horario mirando la cara X de frente, X' = 72° antihorario,
// X2 = 144° horario, X2' = 144° antihorario.

import { crearGeoPuzzle } from '../core/geopuzzle.js';
import { carasDesdeVertices, dot, unit, esc, rotacion, rotacionEntre } from '../core/geometria.js';

const PHI = (1 + Math.sqrt(5)) / 2;
export const PALETA_MEGA = [
  { nombre: 'blanco', hex: '#f4f4f4' },        // U
  { nombre: 'verde oscuro', hex: '#1f7a3a' },  // F
  { nombre: 'rojo', hex: '#d62828' },          // R
  { nombre: 'morado', hex: '#7b3fb5' },        // BR
  { nombre: 'amarillo', hex: '#ffd60a' },      // BL
  { nombre: 'azul', hex: '#1d5ad8' },          // L
  { nombre: 'gris', hex: '#9aa0a6' },          // D
  { nombre: 'verde claro', hex: '#7dd35b' },   // DR
  { nombre: 'rosa', hex: '#f28cc0' },          // DBR
  { nombre: 'crema', hex: '#f1e3b5' },         // B
  { nombre: 'naranja', hex: '#f77f00' },       // DBL
  { nombre: 'celeste', hex: '#5bc0eb' },       // DL
];

// ---------- Geometría ----------
function construir() {
  let V = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) V.push([a, b, c]);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    V.push([0, a / PHI, b * PHI]); V.push([a / PHI, b * PHI, 0]); V.push([a * PHI, 0, b / PHI]);
  }
  let N = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    N.push([0, PHI * a, b], [b, 0, PHI * a], [PHI * a, b, 0]);
  }
  N = N.map(unit);
  // Llevar una cara a la normal (0,1,0) y girar alrededor de y para que una vecina mire al frente
  const nU = N[0];
  const r1 = rotacionEntre(nU, [0, 1, 0]);
  V = V.map(r1); N = N.map(r1);
  const vecinas = N.filter((n) => n[1] > 0.3 && n[1] < 0.99);
  const nF0 = vecinas[0];
  const ang = Math.atan2(nF0[0], nF0[2]); // ángulo de la vecina respecto a +z
  const r2 = rotacion([0, 1, 0], -ang);
  V = V.map(r2); N = N.map(r2);
  // escalar: inradio 1
  const ir = Math.max(...V.map((v) => dot(v, N[0])));
  V = V.map((v) => esc(v, 1 / ir));
  // Ordenar caras: U, F, R, BR, BL, L (anillo superior en sentido horario visto desde arriba),
  // D, y el anillo inferior (por acimut: DR, DBR, B, DBL, DL).
  const U = N.find((n) => n[1] > 0.99);
  const D = N.find((n) => n[1] < -0.99);
  const azimut = (n) => Math.atan2(n[0], n[2]); // 0 = frente, positivo hacia la derecha (+x)
  const sup = N.filter((n) => n[1] > 0.3 && n[1] < 0.99).sort((a, b) => ((azimut(a) + 2 * Math.PI + 1e-6) % (2 * Math.PI)) - ((azimut(b) + 2 * Math.PI + 1e-6) % (2 * Math.PI)));
  const inf = N.filter((n) => n[1] < -0.3 && n[1] > -0.99).sort((a, b) => ((azimut(a) + 2 * Math.PI + 1e-6) % (2 * Math.PI)) - ((azimut(b) + 2 * Math.PI + 1e-6) % (2 * Math.PI)));
  const normales = [U, ...sup, D, ...inf];
  return { V, normales };
}
const { V, normales } = construir();
export { normales };
export const CARAS = ['U', 'F', 'R', 'BR', 'BL', 'L', 'D', 'DR', 'DBR', 'B', 'DBL', 'DL'];
export const IDX = Object.fromEntries(CARAS.map((n, i) => [n, i]));
const caras = carasDesdeVertices(V, normales);
export const H = 0.7; // profundidad de los cortes (fracción del inradio)
const T = (2 * Math.PI) / 5;
const nU = normales[IDX.U], nR = normales[IDX.R], nD = normales[IDX.D], nF = normales[IDX.F];

// Movimientos Pochmann (scrambles) y giros de cara (soluciones)
export const SUFIJOS = ['', '2', "2'", "'"]; // 1, 2, 3 y 4 quintos de vuelta en sentido horario
const giros = {
  U: { eje: nU, ang: -T, umbral: H },
  "U'": { eje: nU, ang: T, umbral: H },
  'R++': { eje: nR, ang: -2 * T, umbral: -H },
  'R--': { eje: nR, ang: 2 * T, umbral: -H },
  'D++': { eje: nD, ang: -2 * T, umbral: -H },
  'D--': { eje: nD, ang: 2 * T, umbral: -H },
};
CARAS.forEach((c, f) => {
  SUFIJOS.forEach((s, k) => {
    // k = 0: 72° horario (−T); k = 1: 144° horario; k = 2: 144° antihorario; k = 3: 72° antihorario
    const quintos = k + 1;
    const ang = quintos <= 2 ? -quintos * T : (5 - quintos) * T;
    giros[c + s] = { eje: normales[f], ang, umbral: H };
  });
});

// Las 6 caras vecinas de U forman la flor de arriba; las de D, la de abajo.
const vecinasDe = (f) => normales.map((n, i) => [i, dot(n, normales[f])]).filter(([, d]) => d > 0.3 && d < 0.99).map(([i]) => i);
export const VECINAS = CARAS.map((_, f) => vecinasDe(f));
export const geo = crearGeoPuzzle({
  caras,
  cortes: normales.map((n) => ({ n, h: H })),
  giros,
  rotaciones: [{ eje: nU, ang: T }, { eje: nF, ang: T }],
  red: {
    hueco: 0.08,
    arboles: [
      { raiz: IDX.U, arriba: [0, 0, -1], hijos: vecinasDe(IDX.U).map((i) => [i, IDX.U]), origen: [0, 0] },
      { raiz: IDX.D, arriba: [0, 0, 1], hijos: vecinasDe(IDX.D).map((i) => [i, IDX.D]), origen: [5.2, 0.6] },
    ],
  },
  encoger: 0.88,
});
if (geo.n !== 132) throw new Error('Megaminx: se esperaban 132 pegatinas y hay ' + geo.n);
if (geo.rotaciones.length !== 60) throw new Error('Megaminx: se esperaban 60 rotaciones y hay ' + geo.rotaciones.length);

/** Giros de cara en notación de caras: 'R', "R'", 'R2', "R2'"... */
export const MOVS_CARA = CARAS.flatMap((c) => SUFIJOS.map((s) => c + s));
/** Cara y quintos de vuelta horarios (1..4) de un giro de cara. */
export function partirGiro(m) {
  const r = /^(U|F|R|BR|BL|L|D|DR|DBR|B|DBL|DL)(2'|2|')?$/.exec(m);
  if (!r) return null;
  return { cara: r[1], f: IDX[r[1]], q: SUFIJOS.indexOf(r[2] || '') + 1 };
}
export const nombreGiro = (f, q) => CARAS[f] + SUFIJOS[(((q % 5) + 5) % 5) - 1];
