// Cuboides (noche 15): geometría, giros, rotaciones y piezas de un cuboide a×b×c cualquiera.
//
// Ejes y medidas: a = ancho (eje x, R/L), b = fondo (eje z, F/B), c = alto (eje y, U/D). Así el
// 3x3x2 (Domino) es crearCuboide(3, 3, 2) y el 2x2x3 (Tower) crearCuboide(2, 2, 3): las caras
// cuadradas (la dimensión distinta en vertical) quedan arriba y abajo, como se sujetan.
//
// Todo sale de la geometría (motor de cortes planos, src/core/geometria.js):
//  - pegatinas: las 6 caras de la caja troceadas por los planos entre capas;
//  - giros: cada capa de cada eje con al menos 2 capas. Una capa gira 90° solo si su sección es
//    cuadrada (si no, la caja no vuelve a su forma): 90° y 180° en las capas de sección cuadrada,
//    solo 180° en las demás. Girar todas las capas de un eje es girar el puzzle entero (rotación);
//  - rotaciones del puzzle entero: solo las que conservan la forma (90° alrededor de un eje si la
//    sección perpendicular es cuadrada, 180° si no);
//  - piezas: cada cubito (i, j, k) con pegatinas; su tipo (esquina, arista, centro) por cuántos
//    ejes está en un extremo.
//
// Notación (ver DECISIONES.md, «Noche 15»): letras de cara como en el cubo; las capas que solo
// giran 180° se escriben R2, F2… (csTimer 223 y 233) y, si el puzzle no tiene ningún giro de 90°
// (3x3x1), solo con la letra: R, L, F, B (csTimer 133 y Jaap). Capas interiores (a partir de
// 4 capas): 2R, 2U… (SiGN) y la del medio de 3 capas, M, E, S (WCA). Rotaciones: x, y, z (x2…).

import { crearGeoPuzzle } from '../core/geopuzzle.js';
import { carasDesdeVertices, permDeGiro, unit, dot, res, esc } from '../core/geometria.js';
import { modelo3DPegatinas, CAMARA_CUBO } from '../core/modelo3d.js';

export const CARAS = ['U', 'R', 'F', 'D', 'L', 'B'];
/** prioridad de cada cara (índice en CARAS) al ordenar las pegatinas de una pieza */
const PRIORIDAD = [0, 4, 2, 1, 5, 3];
const NORMALES = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];

/**
 * Ejes: x (R/L, a capas), y (U/D, c capas), z (F/B, b capas). `cuadrada`: la sección de sus capas
 * es un cuadrado (las otras dos medidas son iguales). `medio`: nombre de la capa del medio si hay 3
 * (M sigue a L, E a D, S a F, como en la WCA).
 */
function ejesDe(a, b, c) {
  return [
    { id: 'x', dir: [1, 0, 0], n: a, pos: 'R', neg: 'L', cuadrada: b === c, medio: 'M', medioSigue: 'neg' },
    { id: 'y', dir: [0, 1, 0], n: c, pos: 'U', neg: 'D', cuadrada: a === b, medio: 'E', medioSigue: 'neg' },
    { id: 'z', dir: [0, 0, 1], n: b, pos: 'F', neg: 'B', cuadrada: a === c, medio: 'S', medioSigue: 'pos' },
  ];
}

/**
 * Geometría completa de un cuboide.
 * @param {number} a ancho (x)
 * @param {number} b fondo (z)
 * @param {number} c alto (y)
 */
export function crearGeoCuboide(a, b, c) {
  for (const d of [a, b, c]) if (!Number.isInteger(d) || d < 1 || d > 9) throw new Error(`Cuboide: medida no válida (${d})`);
  const s = 2 / Math.max(a, b, c); // lado de un cubito (la medida mayor mide 2, como el NxN)
  const media = { x: (a * s) / 2, y: (c * s) / 2, z: (b * s) / 2 };
  const vertices = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vertices.push([x * media.x, y * media.y, z * media.z]);
  const caras = carasDesdeVertices(vertices, NORMALES);
  const ejes = ejesDe(a, b, c);
  const cortes = [];
  for (const e of ejes) for (let k = 1; k < e.n; k++) cortes.push({ n: e.dir, h: -media[e.id] + k * s });
  const rotGen = ejes.map((e) => ({ eje: e.dir, ang: e.cuadrada ? Math.PI / 2 : Math.PI }));
  const geo = crearGeoPuzzle({
    caras,
    cortes,
    giros: {},
    rotaciones: rotGen,
    red: { hueco: 0.1 * s, arboles: [{ raiz: 2, arriba: [0, 1, 0], hijos: [[0, 2], [3, 2], [4, 2], [1, 2], [5, 1]] }] },
    encoger: 0.88,
  });
  const nPeg = geo.n;

  // ---------- Capas y giros ----------
  /** Capa (0 = la del lado positivo) de la coordenada t a lo largo de un eje. */
  const capaDe = (e, t) => Math.min(e.n - 1, Math.max(0, Math.floor((media[e.id] - t) / s + 1e-6)));
  const conGiro90 = ejes.some((e) => e.n >= 2 && e.cuadrada);
  const sinDos = !conGiro90; // 3x3x1: las medias vueltas se escriben sin el 2 (csTimer 133)
  /** Nombre de la capa j (desde el lado positivo) de un eje y sentido: +1 = horario mirando la cara positiva. */
  function nombreCapa(e, j) {
    const medio = e.n % 2 === 1 && j === (e.n - 1) / 2;
    if (medio) {
      if (e.n === 3) return { nombre: e.medio, signo: e.medioSigue === 'pos' ? 1 : -1 };
      return { nombre: `${j + 1}${e.pos}`, signo: 1 };
    }
    if (j < e.n / 2) return { nombre: j === 0 ? e.pos : `${j + 1}${e.pos}`, signo: 1 };
    const k = e.n - 1 - j;
    return { nombre: k === 0 ? e.neg : `${k + 1}${e.neg}`, signo: -1 };
  }
  /**
   * movimientos[nombre] = { eje, j (capa o null si es rotación), base, vueltas (1 = 90° horario, 2 = 180°, 3 = 90° antihorario),
   *   ejeVec, angulo, pegatinas (índices que giran), perm (nuevo[i] = viejo[perm[i]]) }
   */
  const movimientos = {};
  /** alias (R2', R', X2…) -> nombre canónico */
  const alias = {};
  const centros = geo.pegatinas.map((p) => p.centro);
  function anadir(nombre, datos) {
    const eje = unit(esc(datos.e.dir, datos.signo));
    const ang = (-Math.PI / 2) * datos.vueltas; // horario mirando la cara = ángulo negativo (mano derecha)
    const dentro = datos.dentro;
    const perm = permDeGiro(geo.pegatinas, eje, ang, dentro);
    const pegatinas = [];
    centros.forEach((ct, i) => { if (dentro(ct)) pegatinas.push(i); });
    movimientos[nombre] = { eje: datos.e.id, j: datos.j, base: datos.base, vueltas: datos.vueltas, ejeVec: eje, angulo: ang, pegatinas, perm };
  }
  function anadirFamilia(base, e, signo, j, dentro) {
    if (e.cuadrada) {
      anadir(base, { e, signo, j, base, vueltas: 1, dentro });
      anadir(base + "'", { e, signo, j, base, vueltas: 3, dentro });
      anadir(base + '2', { e, signo, j, base, vueltas: 2, dentro });
      alias[base + "2'"] = base + '2';
    } else {
      const canon = sinDos && j !== null ? base : base + '2';
      anadir(canon, { e, signo, j, base, vueltas: 2, dentro });
      for (const v of [base, base + "'", base + '2', base + "2'"]) if (v !== canon) alias[v] = canon;
    }
  }
  for (const e of ejes) {
    if (e.n < 2) continue;
    for (let j = 0; j < e.n; j++) {
      const { nombre, signo } = nombreCapa(e, j);
      anadirFamilia(nombre, e, signo, j, (ct) => capaDe(e, dot(ct, e.dir)) === j);
    }
  }
  // rotaciones del puzzle entero (las que conservan la forma)
  for (const e of ejes) anadirFamilia(e.id, e, 1, null, () => true);
  for (const [k, v] of Object.entries(alias)) if (movimientos[k]) delete alias[k];

  /** Nombre canónico de un movimiento (o null si no existe). */
  const canonico = (m) => (movimientos[m] ? m : alias[m] || null);
  const esRotacion = (m) => movimientos[m] && movimientos[m].j === null;

  // Giros de búsqueda (los que usan el solver y el scramble): en cada eje, todas las capas menos
  // la del medio (n impar: los centros quedan fijos) o menos la del lado negativo (n par: con
  // n = 2 girar L equivale a girar R y el puzzle entero). Ver DECISIONES.md.
  const busqueda = [];
  for (const e of ejes) {
    if (e.n < 2) continue;
    for (let j = 0; j < e.n; j++) {
      if (e.n % 2 === 1 && j === (e.n - 1) / 2) continue;
      if (e.n % 2 === 0 && j === e.n - 1) continue;
      const { nombre } = nombreCapa(e, j);
      for (const [m, d] of Object.entries(movimientos)) if (d.j === j && d.eje === e.id && d.base === nombre) busqueda.push(m);
    }
  }
  // Todos los giros de capas exteriores (los de la notación de la comunidad)
  const exteriores = Object.keys(movimientos).filter((m) => {
    const d = movimientos[m];
    if (d.j === null) return false;
    const e = ejes.find((x) => x.id === d.eje);
    return d.j === 0 || d.j === e.n - 1;
  });
  const rotaciones = Object.keys(movimientos).filter(esRotacion);

  // ---------- Piezas (cubitos) ----------
  const cubito = (i) => {
    const p = geo.pegatinas[i];
    const n = NORMALES[p.cara];
    const q = res(p.centro, esc(n, 0.25 * s));
    return [
      Math.min(a - 1, Math.floor((q[0] + media.x) / s)),
      Math.min(c - 1, Math.floor((q[1] + media.y) / s)),
      Math.min(b - 1, Math.floor((q[2] + media.z) / s)),
    ];
  };
  const porClave = new Map();
  for (let i = 0; i < nPeg; i++) {
    const k = cubito(i).join(',');
    if (!porClave.has(k)) porClave.set(k, []);
    porClave.get(k).push(i);
  }
  const tams = [a, c, b];
  const piezas = [...porClave.entries()].map(([clave, pegs]) => {
    const ijk = clave.split(',').map(Number);
    // orden de las pegatinas de una pieza: U, D, F, B, R, L (la primera es la de referencia: así su
    // posición basta para saber la colocación y recorre pocas casillas)
    pegs.sort((u, v) => PRIORIDAD[geo.pegatinas[u].cara] - PRIORIDAD[geo.pegatinas[v].cara]);
    const extremos = ijk.filter((v, k) => v === 0 || v === tams[k] - 1).length;
    const tipo = extremos === 3 ? 'esquina' : extremos === 2 ? 'arista' : 'centro';
    // nombre de la posición: caras de la pieza (U/D, F/B, R/L), sin las de un eje de una sola capa
    const caras = pegs.map((i) => CARAS[geo.pegatinas[i].cara]);
    const orden = ['U', 'D', 'F', 'B', 'R', 'L'];
    const sinPlanas = caras.filter((f) => !((f === 'U' || f === 'D') && c === 1) && !((f === 'R' || f === 'L') && a === 1) && !((f === 'F' || f === 'B') && b === 1));
    const nombre = sinPlanas.sort((u, v) => orden.indexOf(u) - orden.indexOf(v)).join('') || 'centro';
    return { clave, ijk, pegatinas: pegs, tipo, nombre };
  });
  // orden estable: esquinas, aristas, centros; dentro, por posición
  const ordenTipo = { esquina: 0, arista: 1, centro: 2 };
  piezas.sort((u, v) => ordenTipo[u.tipo] - ordenTipo[v.tipo] || (u.clave < v.clave ? -1 : 1));
  const piezaDePegatina = new Int16Array(nPeg);
  piezas.forEach((p, k) => p.pegatinas.forEach((i) => { piezaDePegatina[i] = k; }));

  // ---------- Vista 3D ----------
  const modelo3D = modelo3DPegatinas({
    poligonos: geo.pegatinas.map((p) => p.poligono),
    normales: geo.pegatinas.map((p) => NORMALES[p.cara]),
    giro: (mov) => {
      const m = canonico(mov);
      if (!m) return null;
      const d = movimientos[m];
      return [{ eje: d.ejeVec, angulo: d.angulo, pegatinas: d.pegatinas }];
    },
    cortes,
    camara: CAMARA_CUBO,
  });

  return {
    a, b, c, s, geo, n: nPeg, ejes, movimientos, alias, canonico, esRotacion, busqueda, exteriores, rotaciones,
    piezas, piezaDePegatina, sinDos, modelo3D, resuelto: geo.resuelto.slice(),
    caraDe: geo.pegatinas.map((p) => p.cara),
  };
}
