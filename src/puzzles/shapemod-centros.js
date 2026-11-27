// Shape mods (noche 16): fase de centros del solver.
//
// Tras Kociemba (que ya deja cada centro con un número par de cuartos de vuelta de más: lo exige su
// gancho `aceptar`), lo que falta son medias vueltas de centros. Se arreglan con algoritmos PUROS: no
// mueven ninguna esquina ni arista, solo giran centros 180°. Se encontraron por búsqueda
// (meet-in-the-middle de todas las secuencias de hasta 5 + 7 giros; ver DECISIONES.md, «Noche 16»):
//   - dos centros 180° en 10 giros (vecinos y opuestos), un centro 180° en 12 y cuatro (los de un ecuador) en 12;
//   - NINGUNO de 90° en 12 giros o menos (por eso la paridad de los cuartos de vuelta la arregla Kociemba).
// Al crear la tabla se comprueba cada algoritmo (piezas intactas y giro de centros esperado) y se
// generan sus conjugados por las 24 rotaciones del cubo (cambiar el nombre de las caras). Con eso,
// Dijkstra sobre las 2⁶ combinaciones de medias vueltas da la secuencia más corta de algoritmos.

import { MOV_CUBO, NOMBRES_MOV, multiplicar, cuboResuelto } from './kociemba.js';
import { CARAS, DIR, matRot, mv, mm, ID3 } from './shapemod-geo.js';

/** Algoritmos puros de centros (Δ = medias vueltas por cara, orden U R F D L B). */
export const ALGORITMOS_CENTROS = [
  { algoritmo: 'U R2 F2 L2 U\' D F2 R2 B2 D\'', delta: [0, 0, 0, 0, 2, 2] },        // L y B (vecinos)
  { algoritmo: 'U2 R2 F2 B2 L2 D2 L2 B2 F2 R2', delta: [2, 0, 0, 2, 0, 0] },         // U y D (opuestos)
  { algoritmo: 'U R L U2 R\' L\' U L R U2 L\' R\'', delta: [2, 0, 0, 0, 0, 0] },     // solo U
];

const iguales = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

/** Δ de centros (cuartos de vuelta mod 4 por cara) de una secuencia, y si deja las piezas en su sitio. */
export function efectoSecuencia(movs) {
  let c = cuboResuelto();
  const d = [0, 0, 0, 0, 0, 0];
  for (const m of movs) {
    const i = NOMBRES_MOV.indexOf(m);
    if (i < 0) throw new Error(`Movimiento no válido: "${m}"`);
    c = multiplicar(c, MOV_CUBO[i]);
    d[(i / 3) | 0] = (d[(i / 3) | 0] + (i % 3) + 1) % 4;
  }
  const puro = c.cp.every((x, i) => x === i) && c.ep.every((x, i) => x === i) && c.co.every((x) => !x) && c.eo.every((x) => !x);
  return { delta: d, puro };
}

/** @param {number[]} periodos periodo visible de la orientación de cada centro (1, 2 o 4) */
export function crearTablaCentros(periodos) {
  // rotaciones del cubo como permutaciones de caras
  const rots = [ID3];
  const vistos = new Set([ID3.flat().join()]);
  for (let i = 0; i < rots.length; i++) for (const g of [matRot([1, 0, 0], -Math.PI / 2), matRot([0, 1, 0], -Math.PI / 2)]) {
    const M = mm(g, rots[i]);
    if (!vistos.has(M.flat().join())) { vistos.add(M.flat().join()); rots.push(M); }
  }
  const caraDe = (R, f) => CARAS.find((g) => iguales(DIR[g], mv(R, DIR[f])));
  // macros: cada algoritmo y sus conjugados (comprobados)
  const macros = [];
  const claves = new Set();
  for (const a of ALGORITMOS_CENTROS) {
    const ef = efectoSecuencia(a.algoritmo.split(' '));
    if (!ef.puro || ef.delta.join() !== a.delta.join()) throw new Error(`Algoritmo de centros incorrecto: ${a.algoritmo}`);
    for (const R of rots) {
      const movs = a.algoritmo.split(' ').map((m) => caraDe(R, m[0]) + m.slice(1));
      const { delta, puro } = efectoSecuencia(movs);
      if (!puro) throw new Error('conjugado de centros no puro');
      const clave = delta.join();
      if (claves.has(clave + movs.length)) continue;
      claves.add(clave + movs.length);
      macros.push({ movs, delta });
    }
  }
  // Dijkstra sobre las medias vueltas de los centros con periodo 4 (los de periodo 2 o 1 no ven una media vuelta)
  const usa = periodos.map((p) => p === 4);
  const indice = (d) => d.reduce((s, x, f) => s | (usa[f] && x % 4 === 2 ? 1 << f : 0), 0);
  const N = 64;
  const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(null);
  dist[0] = 0;
  const hecho = new Array(N).fill(false);
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!hecho[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    hecho[u] = true;
    for (const m of macros) {
      const v = u ^ indice(m.delta);
      if (dist[u] + m.movs.length < dist[v]) { dist[v] = dist[u] + m.movs.length; prev[v] = { u, m }; }
    }
  }
  return {
    macros,
    /** giros de la fase de centros para `falta` (cuartos de vuelta por cara; tienen que ser pares) */
    coste: (falta) => dist[indice(falta)],
    secuencia(falta) {
      if (falta.some((x, f) => periodos[f] > 1 && x % 2)) throw new Error('La fase de centros solo arregla medias vueltas');
      let v = indice(falta);
      const r = [];
      while (v) { const p = prev[v]; r.unshift(...p.m.movs); v = p.u; }
      return r;
    },
  };
}
