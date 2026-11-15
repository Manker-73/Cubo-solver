// Objetivos de las etapas de los métodos humanos del 2x2 y el 3x3, comprobados
// directamente sobre las pegatinas (sin el motor de los métodos), en cualquier
// orientación del cubo. Los usan los métodos (para comprobarse a sí mismos) y
// los tests.

import { piezasCubo } from '../puzzles/cubo-comun.js';
import { geometriaNxN, baseNxN, CARAS } from '../puzzles/nxn.js';

const BLANCO = 0, AMARILLO = 3;

const cache = new Map();
function datos(N) {
  if (cache.has(N)) return cache.get(N);
  const n2 = N * N;
  const { esquinas, aristas } = piezasCubo(N);
  const geo = geometriaNxN(N);
  const caraDe = (f) => Math.floor(f / n2);
  // para cada cara: las casillas de las caras vecinas que están en su capa
  const capa = [];
  const NORMALES = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
  for (let f = 0; f < 6; f++) {
    const n = NORMALES[f];
    const vecinas = {};
    geo.pos.forEach((p, i) => {
      const g = caraDe(i);
      if (g === f || g === (f + 3) % 6) return;
      const d = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
      if (d === N - 1) (vecinas[g] = vecinas[g] || []).push(i);
    });
    capa.push(Object.values(vecinas));
  }
  const d = { N, n2, esquinas, aristas, caraDe, capa };
  cache.set(N, d);
  return d;
}

const centro3 = (e, f) => e[f * 9 + 4];

/** 3x3: la pieza en la ranura r encaja con los centros de sus caras. */
function ranuraBien3(e, r) { return r.every((f) => e[f] === centro3(e, Math.floor(f / 9))); }

function caraDeColor3(e, color) { for (let f = 0; f < 6; f++) if (centro3(e, f) === color) return f; return -1; }

/** 3x3: piezas que tocan la cara del color c (aristas o esquinas). */
function piezasDeCara3(lista, f) { return lista.filter((r) => r.some((x) => Math.floor(x / 9) === f)); }

export const OBJETIVOS_3x3 = {
  cruz(e) {
    const { aristas } = datos(3);
    const w = caraDeColor3(e, BLANCO);
    return piezasDeCara3(aristas, w).every((r) => ranuraBien3(e, r));
  },
  primeraCapa(e) {
    const { esquinas } = datos(3);
    const w = caraDeColor3(e, BLANCO);
    return OBJETIVOS_3x3.cruz(e) && piezasDeCara3(esquinas, w).every((r) => ranuraBien3(e, r));
  },
  dosCapas(e) {
    const { aristas } = datos(3);
    const y = caraDeColor3(e, AMARILLO);
    return OBJETIVOS_3x3.primeraCapa(e) && aristas.filter((r) => !r.some((x) => Math.floor(x / 9) === y)).every((r) => ranuraBien3(e, r));
  },
  cruzAmarilla(e) {
    const y = caraDeColor3(e, AMARILLO);
    return OBJETIVOS_3x3.dosCapas(e) && [1, 3, 5, 7].every((k) => e[y * 9 + k] === AMARILLO);
  },
  caraAmarilla(e) {
    const y = caraDeColor3(e, AMARILLO);
    return OBJETIVOS_3x3.dosCapas(e) && [0, 1, 2, 3, 5, 6, 7, 8].every((k) => e[y * 9 + k] === AMARILLO);
  },
  /** Las esquinas de la última capa en su sitio salvo un giro de esa capa. */
  esquinasUltimaCapa(e) {
    if (!OBJETIVOS_3x3.caraAmarilla(e)) return false;
    const { esquinas } = datos(3);
    const y = caraDeColor3(e, AMARILLO);
    const b3 = baseNxN(3);
    let x = e;
    for (let k = 0; k < 4; k++) {
      if (piezasDeCara3(esquinas, y).every((r) => ranuraBien3(x, r))) return true;
      x = b3.aplicarMovimiento(x, CARAS[y]);
    }
    return false;
  },
  resuelto(e) {
    for (let f = 0; f < 6; f++) for (let k = 0; k < 9; k++) if (e[f * 9 + k] !== e[f * 9 + 4]) return false;
    return true;
  },
};

/** NxN sin centros fijos (2x2): una cara de un solo color (devuelve las caras que lo cumplen). */
function carasUniformes(e, N) {
  const n2 = N * N;
  const r = [];
  for (let f = 0; f < 6; f++) {
    let ok = true;
    for (let k = 1; k < n2 && ok; k++) if (e[f * n2 + k] !== e[f * n2]) ok = false;
    if (ok) r.push(f);
  }
  return r;
}
/** Capa de la cara f resuelta: la cara de un color y cada fila vecina de un color. */
function capaResuelta(e, N, f) {
  const { capa } = datos(N);
  if (!carasUniformes(e, N).includes(f)) return false;
  return capa[f].every((fila) => fila.every((i) => e[i] === e[fila[0]]));
}

export const OBJETIVOS_2x2 = {
  /** Una cara blanca (Ortega). */
  caraBlanca(e) { return carasUniformes(e, 2).some((f) => e[f * 4] === BLANCO); },
  /** La capa blanca resuelta (principiantes). */
  primeraCapa(e) { return [0, 1, 2, 3, 4, 5].some((f) => e[f * 4] === BLANCO && capaResuelta(e, 2, f)); },
  /** Capa blanca resuelta y la cara opuesta amarilla. */
  caraAmarillaConCapa(e) {
    return [0, 1, 2, 3, 4, 5].some((f) => e[f * 4] === BLANCO && capaResuelta(e, 2, f) && carasUniformes(e, 2).includes((f + 3) % 6));
  },
  /** Cara blanca y cara amarilla opuestas (Ortega, tras la OLL). */
  carasOpuestas(e) {
    const u = carasUniformes(e, 2);
    return u.some((f) => e[f * 4] === BLANCO && u.includes((f + 3) % 6));
  },
  resuelto(e) { return carasUniformes(e, 2).length === 6; },
};
