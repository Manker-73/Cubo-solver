// Megaminx: scramble en notación Pochmann (WCA 12d) y vista previa.
//
// U / U': cara de arriba 72°. R++ / R--: todo menos la capa de la cara opuesta
// a R, 144° (visto desde R). D++ / D--: todo menos la capa de arriba, 144°
// (visto desde D). Scramble WCA: 7 líneas de 10 movimientos R/D alternos
// terminadas en U (si el último D es ++) o U' (si es --).

import { definirPuzzle } from '../core/puzzle.js';
import { crearGeoPuzzle } from '../core/geopuzzle.js';
import { carasDesdeVertices, dot, unit, esc, rotacion, rotacionEntre } from '../core/geometria.js';
import { svgDePegatinas } from '../core/render.js';
import { rngSeguro } from '../core/rng.js';

const PHI = (1 + Math.sqrt(5)) / 2;
export const PALETA_MEGA = [
  { nombre: 'blanco', hex: '#f4f4f4' },        // U
  { nombre: 'verde oscuro', hex: '#1f7a3a' },  // F
  { nombre: 'rojo', hex: '#d62828' },          // R
  { nombre: 'morado', hex: '#7b3fb5' },        // BR
  { nombre: 'amarillo', hex: '#ffd60a' },      // BL
  { nombre: 'azul', hex: '#1d5ad8' },          // L
  { nombre: 'gris', hex: '#9aa0a6' },          // D
  { nombre: 'verde claro', hex: '#7dd35b' },   // opuesta a U-F
  { nombre: 'rosa', hex: '#f28cc0' },
  { nombre: 'crema', hex: '#f1e3b5' },
  { nombre: 'naranja', hex: '#f77f00' },
  { nombre: 'celeste', hex: '#5bc0eb' },
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
  // D, y el anillo inferior.
  const U = N.find((n) => n[1] > 0.99);
  const D = N.find((n) => n[1] < -0.99);
  const azimut = (n) => Math.atan2(n[0], n[2]); // 0 = frente, positivo hacia la derecha (+x)
  const sup = N.filter((n) => n[1] > 0.3 && n[1] < 0.99).sort((a, b) => ((azimut(a) + 2 * Math.PI + 1e-6) % (2 * Math.PI)) - ((azimut(b) + 2 * Math.PI + 1e-6) % (2 * Math.PI)));
  const inf = N.filter((n) => n[1] < -0.3 && n[1] > -0.99).sort((a, b) => ((azimut(a) + 2 * Math.PI + 1e-6) % (2 * Math.PI)) - ((azimut(b) + 2 * Math.PI + 1e-6) % (2 * Math.PI)));
  const normales = [U, ...sup, D, ...inf];
  return { V, normales };
}
const { V, normales } = construir();
const NOMBRES_CARA = ['U', 'F', 'R', 'BR', 'BL', 'L', 'D', 'DBR', 'DB', 'DBL', 'DFL', 'DFR'];
const IDX = Object.fromEntries(NOMBRES_CARA.map((n, i) => [n, i]));
const caras = carasDesdeVertices(V, normales);
const H = 0.7; // profundidad de los cortes (fracción del inradio)
const nU = normales[IDX.U], nR = normales[IDX.R], nD = normales[IDX.D];
const T = (2 * Math.PI) / 5;
const giros = {
  U: { eje: nU, ang: -T, umbral: H },
  "U'": { eje: nU, ang: T, umbral: H },
  'R++': { eje: nR, ang: -2 * T, umbral: -H },
  'R--': { eje: nR, ang: 2 * T, umbral: -H },
  'D++': { eje: nD, ang: -2 * T, umbral: -H },
  'D--': { eje: nD, ang: 2 * T, umbral: -H },
};
// Las 6 caras vecinas de U forman la flor de arriba; las de D, la de abajo.
const vecinasDe = (f) => normales.map((n, i) => [i, dot(n, normales[f])]).filter(([, d]) => d > 0.3 && d < 0.99).map(([i]) => i);
const geo = crearGeoPuzzle({
  caras,
  cortes: normales.map((n) => ({ n, h: H })),
  giros,
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

// ---------- Scramble Pochmann ----------
export const LINEAS = 7, POR_LINEA = 10;

function generarScramble(rng = rngSeguro()) {
  const movs = [];
  for (let l = 0; l < LINEAS; l++) {
    let ultimo = '';
    for (let i = 0; i < POR_LINEA; i++) {
      const cara = i % 2 === 0 ? 'R' : 'D';
      const suf = rng() < 0.5 ? '++' : '--';
      movs.push(cara + suf);
      ultimo = suf;
    }
    movs.push(ultimo === '++' ? 'U' : "U'");
  }
  return movs;
}

const caraDe = geo.pegatinas.map((p) => p.cara);

export default definirPuzzle({
  id: 'megaminx',
  nombre: 'Megaminx',
  capacidades: { scramble: true, validar: false, resolver: false, editar: false },
  tipoScramble: 'movimientos aleatorios (Pochmann)',
  longitudScramble: LINEAS * (POR_LINEA + 1),
  paleta: PALETA_MEGA,
  estadoResuelto: () => geo.resuelto.slice(),
  aplicarMovimiento(e, m) {
    if (!geo.perms[m]) throw new Error(`Movimiento no válido: "${m}"`);
    return geo.aplicar(e, m);
  },
  estaResuelto(e) {
    const color = new Array(12).fill(-1);
    for (let i = 0; i < e.length; i++) {
      const f = caraDe[i];
      if (color[f] < 0) color[f] = e[i];
      else if (color[f] !== e[i]) return false;
    }
    return true;
  },
  invertirMovimiento(m) {
    if (m.endsWith('++')) return m.slice(0, -2) + '--';
    if (m.endsWith('--')) return m.slice(0, -2) + '++';
    return m.endsWith("'") ? m.slice(0, -1) : m + "'";
  },
  infoMovimiento(m) {
    if (!/^(R\+\+|R--|D\+\+|D--|U'?)$/.test(m)) throw new Error(`Movimiento no válido: "${m}"`);
    return { eje: m[0] === 'R' ? 'R' : 'UD', clave: m[0] };
  },
  formatear(movs) {
    // una línea por cada U / U'
    const lineas = [];
    let actual = [];
    for (const m of movs) {
      actual.push(m);
      if (m[0] === 'U') { lineas.push(actual.join(' ')); actual = []; }
    }
    if (actual.length) lineas.push(actual.join(' '));
    return lineas.join('\n');
  },
  renderizar(estado, opciones = {}) {
    return svgDePegatinas(geo.pegatinas2D, estado, PALETA_MEGA, { ...opciones, editable: false, margen: 0.06, grosor: 0.5 });
  },
  generarScramble,
  geo,
});
