// @ts-check
// Modelo 3D genérico de un puzzle, sin dibujar nada (lo dibuja src/app/vista3d.js).
//
// Interfaz común (ver ARQUITECTURA.md, "Vista 3D"): cada puzzle da
//   vista3D(estado)      -> { geometria, colores }
//     geometria: { pegatinas: [{ puntos, normal, indice, pieza }], radio, camara, cortes }
//       puntos: polígono convexo 3D de la pegatina entera (sin encoger); normal: hacia fuera;
//       indice: índice que entienden pintar()/usarHerramienta() (o null si no se edita);
//       pieza: clave de la pieza a la que pertenece (para resaltar piezas).
//       etiquetas (opcional): [{ texto, pos, normal }] letras sobre el puzzle (Megaminx: caras).
//       La misma geometría (mismo objeto) mientras no cambie la forma: la vista solo
//       recalcula los colores. El Square-1 da una geometría nueva en cada estado.
//     colores: color (índice de la paleta, -1 = sin pintar) de cada pegatina de la geometría.
//   giro3D(estado, mov)  -> [{ eje, angulo, pegatinas }] (partes que giran a la vez; pegatinas =
//                           índices en geometria.pegatinas de vista3D(estado)), o lanza error.
//   reorientar3D(estado) -> opcional: { partes, estado } giro del puzzle entero que lleva al
//                           estado de la vista previa (Megaminx, tras los movimientos Pochmann).
//
// La regla que comprueban los tests: girar las pegatinas de giro3D(e, m) su ángulo
// completo deja exactamente las posiciones y colores de vista3D(aplicarMovimiento(e, m)).

import { dot, unit, res, esc, sum, cruz, norma, centroide, rotacion } from './geometria.js';

/**
 * Tipos de la vista 3D en ./tipos.d.ts (Geometria3D, Pegatina3D, Vista3D, ParteGiro3D…).
 * @import { Vec3, Corte, Camara3D, Etiqueta3D, Geometria3D, Pegatina3D, Vista3D, ParteGiro3D, Modelo3D, EstadoPegatinas, Movimiento } from './tipos.js'
 */
/**
 * Modelo 3D de un puzzle cuyo estado es un array de colores por pegatina, con
 * geometría fija.
 *   poligonos[i]: polígono 3D de la pegatina i (índice del estado)
 *   normales[i]:  normal saliente (si falta, se calcula del polígono y del centro)
 *   giro(mov):    [{ eje, angulo, pegatinas }] o null si el movimiento no existe
 *   cortes:       [{ n, h }] planos de corte (para agrupar pegatinas en piezas)
 *   camara:       { desde: [x, y, z], arriba: [x, y, z] }
 * @param {{ poligonos: Vec3[][], normales?: Vec3[] | null, giro: (mov: Movimiento) => ParteGiro3D[] | null,
 *   cortes?: Corte[], camara?: Camara3D, radio?: number, etiquetas?: Etiqueta3D[] | null }} datos
 * @returns {Modelo3D<EstadoPegatinas>}
 */
export function modelo3DPegatinas({ poligonos, normales, giro, cortes = [], camara, radio, etiquetas = null }) {
  /** @type {Pegatina3D[]} */
  const pegatinas = poligonos.map((puntos, i) => {
    const c = centroide(puntos);
    let n = normales ? normales[i] : normalPoligono(puntos);
    if (dot(n, c) < 0) n = esc(n, -1);
    return { puntos, normal: unit(n), indice: i, pieza: null, centro: c };
  });
  asignarPiezas(pegatinas, cortes);
  const r = radio || Math.max(...poligonos.flat().map((p) => norma(p)));
  /** @type {Geometria3D} */
  const geometria = { pegatinas, radio: r, camara: camara || CAMARA_CUBO, cortes, etiquetas };
  /** @type {Map<Movimiento, ParteGiro3D[]>} */
  const cacheGiros = new Map();
  return {
    vista3D(estado) {
      return { geometria, colores: Array.from(estado, (c) => (c == null ? -1 : c)) };
    },
    giro3D(_estado, mov) {
      if (!cacheGiros.has(mov)) {
        const g = giro(mov);
        if (!g) throw new Error(`Movimiento no válido: "${mov}"`);
        cacheGiros.set(mov, g);
      }
      return /** @type {ParteGiro3D[]} */ (cacheGiros.get(mov));
    },
  };
}

/** @type {Camara3D} */
export const CAMARA_CUBO = { desde: [0.62, 0.72, 1], arriba: [0, 1, 0] };

/** Normal de un polígono plano (sin normalizar el sentido). @param {Vec3[]} puntos @returns {Vec3} */
export function normalPoligono(puntos) {
  let acc = [0, 0, 0];
  for (let i = 1; i + 1 < puntos.length; i++) acc = sum(acc, cruz(res(puntos[i], puntos[0]), res(puntos[i + 1], puntos[0])));
  return unit(acc);
}

/**
 * Agrupa las pegatinas en piezas: misma pieza = mismo lado de todos los planos de corte.
 * @param {Pegatina3D[]} pegatinas
 * @param {Corte[]} cortes
 */
export function asignarPiezas(pegatinas, cortes) {
  for (const p of pegatinas) {
    if (p.pieza != null) continue;
    // un punto un poco hacia dentro de la pegatina, para que no caiga justo en un plano
    const c = p.centro || centroide(p.puntos);
    const q = res(c, esc(p.normal, 1e-3));
    p.pieza = cortes.map(({ n, h }) => (dot(q, n) > h ? '1' : '0')).join('');
  }
}

/** Pegatinas (índices de la geometría) de las piezas dadas. @param {Geometria3D} geometria @param {Iterable<string>} piezas */
export function pegatinasDePiezas(geometria, piezas) {
  /** @type {Set<string | null>} */
  const s = new Set(piezas);
  /** @type {number[]} */
  const r = [];
  geometria.pegatinas.forEach((p, k) => { if (s.has(p.pieza)) r.push(k); });
  return r;
}

/**
 * Aplica (sin dibujar) un giro 3D completo: devuelve, para cada pegatina de la
 * geometría, su centro tras el giro. Es lo que hace la vista al acabar la animación.
 * @param {Geometria3D} geometria
 * @param {ParteGiro3D[]} partes
 * @returns {Vec3[]}
 */
export function centrosTrasGiro(geometria, partes, fraccion = 1) {
  const centros = geometria.pegatinas.map((p) => p.centro || centroide(p.puntos));
  for (const parte of partes) {
    const rot = rotacion(parte.eje, parte.angulo * fraccion);
    for (const k of parte.pegatinas) centros[k] = rot(centros[k]);
  }
  return centros;
}

/**
 * Compara dos "fotos" 3D: { centros, colores } y { geometria, colores }.
 * Devuelve null si cada posición tiene el mismo color, o un texto con la primera diferencia.
 * @param {Vec3[]} centrosA
 * @param {number[]} coloresA
 * @param {Vista3D} vistaB
 * @returns {string | null}
 */
export function compararFotos(centrosA, coloresA, vistaB, tol = 1e-6) {
  const pegB = vistaB.geometria.pegatinas;
  if (centrosA.length !== pegB.length) return `número de pegatinas distinto (${centrosA.length} frente a ${pegB.length})`;
  const usados = new Uint8Array(pegB.length);
  for (let i = 0; i < centrosA.length; i++) {
    let k = -1, md = Infinity;
    for (let j = 0; j < pegB.length; j++) {
      const d = norma(res(pegB[j].centro || centroide(pegB[j].puntos), centrosA[i]));
      if (d < md) { md = d; k = j; }
    }
    if (md > tol) return `la pegatina ${i} acaba en una posición donde no hay pegatina (distancia ${md.toExponential(2)})`;
    if (usados[k]) return `dos pegatinas acaban en la misma posición (${k})`;
    usados[k] = 1;
    if (coloresA[i] !== vistaB.colores[k]) return `la pegatina ${i} acaba en la posición ${k} con color ${coloresA[i]} y el modelo dice ${vistaB.colores[k]}`;
  }
  return null;
}

/**
 * Comprueba la regla de la interfaz para un movimiento (lo usan los tests).
 * @template E
 * @param {{ vista3D(e: E): Vista3D, giro3D(e: E, m: Movimiento): ParteGiro3D[], aplicarMovimiento(e: E, m: Movimiento): E }} puzzle
 * @param {E} estado
 * @param {Movimiento} mov
 */
export function comprobarGiro3D(puzzle, estado, mov) {
  const antes = puzzle.vista3D(estado);
  const partes = puzzle.giro3D(estado, mov);
  const centros = centrosTrasGiro(antes.geometria, partes);
  const despues = puzzle.vista3D(puzzle.aplicarMovimiento(estado, mov));
  return compararFotos(centros, antes.colores, despues);
}

/**
 * @typedef {number[][]} Matriz3  matriz 3x3 por filas
 */
/** Matriz 3x3 (por filas) de la rotación de `ang` radianes alrededor de `eje`. @param {Vec3} eje @param {number} ang @returns {Matriz3} */
export function matrizRotacion(eje, ang) {
  const r = rotacion(eje, ang);
  const c = [r([1, 0, 0]), r([0, 1, 0]), r([0, 0, 1])]; // columnas
  return [[c[0][0], c[1][0], c[2][0]], [c[0][1], c[1][1], c[2][1]], [c[0][2], c[1][2], c[2][2]]];
}
/** @type {(A: Matriz3, B: Matriz3) => Matriz3} */
export const mulMat = (A, B) => A.map((f) => [0, 1, 2].map((j) => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
/** @type {(A: Matriz3, v: Vec3) => Vec3} */
export const mulMatVec = (A, v) => A.map((f) => f[0] * v[0] + f[1] * v[1] + f[2] * v[2]);

/** Eje y ángulo (en (−π, π]) de una matriz de rotación. @param {Matriz3} M @returns {{ eje: Vec3, angulo: number }} */
export function ejeAngulo(M) {
  const tr = M[0][0] + M[1][1] + M[2][2];
  const cos = Math.max(-1, Math.min(1, (tr - 1) / 2));
  const ang = Math.acos(cos);
  if (ang < 1e-9) return { eje: [0, 1, 0], angulo: 0 };
  if (Math.PI - ang < 1e-6) {
    // 180°: eje = columna dominante de (M + I)/2
    const B = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (M[i][j] + (i === j ? 1 : 0)) / 2));
    let k = 0;
    for (let i = 1; i < 3; i++) if (B[i][i] > B[k][k]) k = i;
    return { eje: unit([B[0][k], B[1][k], B[2][k]]), angulo: Math.PI };
  }
  const e = [M[2][1] - M[1][2], M[0][2] - M[2][0], M[1][0] - M[0][1]];
  return { eje: unit(e), angulo: ang };
}
