// Square-1: modelo, scramble de movimientos aleatorios con "/" siempre legales, y vista previa.
//
// Cada capa son 12 casillas de 30°. Las esquinas ocupan 2 casillas y las
// aristas 1. Las casillas se numeran por su ángulo θ (desde el frente, hacia
// la derecha); la mitad derecha son las casillas 0..5. El corte del "/" está
// entre las casillas 11|0 y 5|6: es legal si ninguna esquina lo atraviesa en
// ninguna de las dos capas.
//
// Notación WCA (12c): (x,y) gira la capa de arriba x·30° en sentido horario
// y la de abajo y·30° en sentido horario (cada una vista desde su cara);
// "/" gira la mitad derecha 180°.

import { definirPuzzle } from '../core/puzzle.js';
import { rngSeguro, entero } from '../core/rng.js';

// Piezas: esquinas 0-3 (arriba), 4-7 (abajo); aristas 8-11 (arriba), 12-15 (abajo)
const esEsquina = (id) => id < 8;
const ARRIBA = [0, 0, 8, 1, 1, 9, 2, 2, 10, 3, 3, 11];
// La capa de abajo es la imagen de la de arriba por el giro del "/": sus vértices están en 60°, 150°, 240°, 330°.
const ABAJO = [12, 4, 4, 13, 5, 5, 14, 6, 6, 15, 7, 7];
const mod12 = (k) => ((k % 12) + 12) % 12;

export function estadoResuelto() {
  return { arriba: ARRIBA.slice(), abajo: ABAJO.slice(), medio: 0 };
}

export function girarCapas(e, x, y) {
  return {
    arriba: e.arriba.map((_, k) => e.arriba[mod12(k + x)]),
    abajo: e.abajo.map((_, k) => e.abajo[mod12(k - y)]),
    medio: e.medio,
  };
}

export function sePuedeCortar(e) {
  return e.arriba[11] !== e.arriba[0] && e.arriba[5] !== e.arriba[6]
    && e.abajo[11] !== e.abajo[0] && e.abajo[5] !== e.abajo[6];
}

export function cortar(e) {
  if (!sePuedeCortar(e)) throw new Error('"/" ilegal: una esquina atraviesa el corte');
  const arriba = e.arriba.slice(), abajo = e.abajo.slice();
  for (let k = 0; k < 6; k++) { arriba[k] = e.abajo[5 - k]; abajo[k] = e.arriba[5 - k]; }
  return { arriba, abajo, medio: e.medio ^ 1 };
}

const RE_TOKEN = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;

function parsear(texto) {
  const res = [];
  let m;
  RE_TOKEN.lastIndex = 0;
  while ((m = RE_TOKEN.exec(texto))) res.push(m[0] === '/' ? '/' : `(${parseInt(m[1], 10)},${parseInt(m[2], 10)})`);
  return res;
}

function aplicarMovimiento(e, mov) {
  if (mov === '/') return cortar(e);
  const m = /^\((-?\d+),(-?\d+)\)$/.exec(mov);
  if (!m) throw new Error(`Movimiento no válido: "${mov}"`);
  return girarCapas(e, parseInt(m[1], 10), parseInt(m[2], 10));
}

const normalizarGiro = (x) => { const r = mod12(x); return r > 6 ? r - 12 : r; }; // -5..6

/**
 * Scramble de movimientos aleatorios: unidades "(x,y)/" hasta sumar 40 en
 * métrica de giros (cada "/" y cada capa girada cuenta 1). Cada (x,y) se
 * elige al azar entre los que dejan el "/" siguiente legal; nunca (0,0).
 */
export const LONGITUD_METRICA = 40;
function generarScramble(rng = rngSeguro()) {
  let e = estadoResuelto();
  const movs = [];
  let cuenta = 0;
  while (cuenta < LONGITUD_METRICA) {
    const opciones = [];
    for (let x = -5; x <= 6; x++) for (let y = -5; y <= 6; y++) {
      if (x === 0 && y === 0) continue;
      if (sePuedeCortar(girarCapas(e, x, y))) opciones.push([x, y]);
    }
    const [x, y] = opciones[entero(rng, opciones.length)];
    movs.push(`(${x},${y})`, '/');
    e = cortar(girarCapas(e, x, y));
    cuenta += (x !== 0) + (y !== 0) + 1;
  }
  return movs;
}

function rotacionDe(capa, sol) {
  for (let r = 0; r < 12; r++) if (capa.every((v, k) => v === sol[mod12(k + r)])) return true;
  return false;
}

// ---------- Dibujo ----------
const COL = {
  arriba: '#f4f4f4', abajo: '#ffd60a',
  F: '#2a9d4b', R: '#d62828', B: '#1d5ad8', L: '#f77f00',
};
const PALETA_SQ1 = [
  { nombre: 'blanco', hex: COL.arriba }, { nombre: 'amarillo', hex: COL.abajo },
  { nombre: 'verde', hex: COL.F }, { nombre: 'rojo', hex: COL.R }, { nombre: 'azul', hex: COL.B }, { nombre: 'naranja', hex: COL.L },
];
const RAD = Math.PI / 180;
// Lado según el ángulo de la normal exterior (0 = frente, 90 = derecha)
const lado = (ang) => ['F', 'R', 'B', 'L'][Math.round(mod360(ang) / 90) % 4];
function mod360(a) { return ((a % 360) + 360) % 360; }
// Casillas iniciales de cada pieza (primera casilla, en sentido θ creciente) y su capa original
const INICIO = {};
ARRIBA.forEach((id, k) => { if (!(id in INICIO)) INICIO[id] = { k, capa: 'arriba' }; });
ABAJO.forEach((id, k) => { if (!(id in INICIO)) INICIO[id] = { k, capa: 'abajo' }; });
// La primera casilla de una esquina resuelta va "antes" de su vértice
function coloresLaterales(id) {
  const { k } = INICIO[id];
  const t0 = k * 30;
  if (esEsquina(id)) return [COL[lado(t0 - 15)], COL[lado(t0 + 75)]];
  return [COL[lado(t0 + 15)]];
}

/** Polígonos de una capa. espejo: dibujar vista desde abajo. */
function dibujarCapa(capa, cx, cy, a, nombreCapa, espejo) {
  // Se gira el dibujo 15° para que la capa en forma de cubo quede recta (el corte sale inclinado)
  const giro = espejo ? -15 : 15;
  const pt = (ang, r) => {
    const x = Math.sin((ang + giro) * RAD) * r * (espejo ? -1 : 1);
    const y = Math.cos((ang + giro) * RAD) * r;
    return [cx + x, cy + y];
  };
  const rEdge = a / Math.cos(15 * RAD), rTip = a * Math.SQRT2;
  const ext = 1.18;
  let s = '';
  const poly = (pts, fill) => `<polygon points="${pts.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ')}" fill="${fill}" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/>`;
  let k = 0;
  // empezar en una casilla que sea comienzo de pieza
  while (capa[mod12(k)] === capa[mod12(k - 1)]) k++;
  const fin = k + 12;
  while (k < fin) {
    const id = capa[mod12(k)];
    const t0 = k * 30;
    const enCasa = INICIO[id].capa === nombreCapa;
    const caraColor = INICIO[id].capa === 'arriba' ? COL.arriba : COL.abajo;
    let lat = coloresLaterales(id);
    if (esEsquina(id)) {
      if (!enCasa) lat = [lat[1], lat[0]];
      const p1 = pt(t0, rEdge), tip = pt(t0 + 30, rTip), p3 = pt(t0 + 60, rEdge);
      const sc = (p) => [cx + (p[0] - cx) * ext, cy + (p[1] - cy) * ext];
      s += poly([p1, tip, sc(tip), sc(p1)], lat[0]);
      s += poly([tip, p3, sc(p3), sc(tip)], lat[1]);
      s += poly([[cx, cy], p1, tip, p3], caraColor);
      k += 2;
    } else {
      const p1 = pt(t0, rEdge), p2 = pt(t0 + 30, rEdge);
      const sc = (p) => [cx + (p[0] - cx) * ext, cy + (p[1] - cy) * ext];
      s += poly([p1, p2, sc(p2), sc(p1)], lat[0]);
      s += poly([[cx, cy], p1, p2], caraColor);
      k += 1;
    }
  }
  // línea del corte
  const c1 = pt(0, rTip * 1.22), c2 = pt(180, rTip * 1.22);
  s += `<line x1="${c1[0].toFixed(1)}" y1="${c1[1].toFixed(1)}" x2="${c2[0].toFixed(1)}" y2="${c2[1].toFixed(1)}" stroke="#e5484d" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  return s;
}

function renderizar(e) {
  const a = 40;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 200" class="puzzle-svg">';
  s += dibujarCapa(e.arriba, 80, 96, a, 'arriba', false);
  s += dibujarCapa(e.abajo, 250, 96, a, 'abajo', true);
  // capa del medio: mitad izquierda fija, mitad derecha volteada si medio = 1
  const y = 176, h = 12;
  s += `<rect x="115" y="${y}" width="50" height="${h}" fill="${COL.F}" stroke="#111" stroke-width="1.2"/>`;
  s += `<rect x="165" y="${y}" width="50" height="${h}" fill="${e.medio ? COL.B : COL.F}" stroke="#111" stroke-width="1.2"/>`;
  s += `<text x="80" y="14" font-size="11" text-anchor="middle" fill="currentColor" font-family="sans-serif">arriba</text>`;
  s += `<text x="250" y="14" font-size="11" text-anchor="middle" fill="currentColor" font-family="sans-serif">abajo (vista desde abajo)</text>`;
  s += '</svg>';
  return s;
}

export default definirPuzzle({
  id: 'square1',
  nombre: 'Square-1',
  capacidades: { scramble: true, validar: false, resolver: false, editar: false },
  tipoScramble: 'movimientos aleatorios',
  separador: ' ',
  paleta: PALETA_SQ1,
  estadoResuelto,
  aplicarMovimiento,
  estaResuelto: (e) => e.medio === 0 && rotacionDe(e.arriba, ARRIBA) && rotacionDe(e.abajo, ABAJO),
  invertirMovimiento(m) {
    if (m === '/') return '/';
    const r = /^\((-?\d+),(-?\d+)\)$/.exec(m);
    return `(${normalizarGiro(-parseInt(r[1], 10))},${normalizarGiro(-parseInt(r[2], 10))})`;
  },
  // Redundancias: dos "/" seguidos, dos giros seguidos o un giro (0,0)
  infoMovimiento: (m) => ({ eje: m === '/' ? 'corte' : 'capas', clave: m === '/' ? 'corte' : 'capas' }),
  buscarRedundancia(movs) {
    for (let i = 0; i < movs.length; i++) {
      if (movs[i] === '(0,0)') return `giro vacío en la posición ${i + 1}`;
      if (i > 0 && (movs[i] === '/') === (movs[i - 1] === '/')) return `movimientos seguidos del mismo tipo en la posición ${i + 1}`;
    }
    return null;
  },
  parsear,
  formatear(movs) {
    let s = '';
    for (const m of movs) s += m === '/' ? '/ ' : m;
    return s.trim();
  },
  describirLongitud(movs) {
    const barras = movs.filter((m) => m === '/').length;
    let metrica = barras;
    for (const m of movs) if (m !== '/') { const [x, y] = m.slice(1, -1).split(',').map(Number); metrica += (x !== 0) + (y !== 0); }
    return `${barras} barras · ${metrica} en métrica de giros`;
  },
  renderizar,
  generarScramble,
  sePuedeCortar,
});
