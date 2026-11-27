// @ts-check
// Registro de puzzles. Para añadir un puzzle nuevo: crear su módulo (que
// exporte un objeto hecho con definirPuzzle) y añadirlo a esta lista.
// La interfaz y los tests no necesitan ningún otro cambio.
//
// `categoria`: sección de la app en la que aparece cada puzzle (ver src/app/secciones.js):
// 'wca' = WCA Puzzles, 'cuboids' = Cuboids (noche 15). Es un dato del registro, no de la interfaz común: los módulos
// de los puzzles no lo conocen. El 3x3 vendado (Bandaged Cubes) es el 3x3 de esta lista
// envuelto por puzzleConBloqueos; el 4x4 y el 5x5 vendados (noche 13), los de esta lista con el
// estado de identidades (nxn-identidad.js), en BANDAGED.

import cubo2 from './cubo2.js';
import cubo3 from './cubo3.js';
import { crearCuboGrande } from './cubo-grande.js';
import { crearCuboide } from './cuboide.js';
import { crearShapeMod } from './shapemod.js';
import { cuboInclinado } from './shapemod-geo.js';
import pyraminx from './pyraminx.js';
import skewb from './skewb.js';
import square1 from './square1.js';
import megaminx from './megaminx.js';
import fto from './fto.js';
import { crearCuboConIdentidad } from './nxn-identidad.js';

/** @import { Categoria, PuzzleRegistrado, PuzzlePronto, Puzzle, EstadoPegatinas } from '../core/tipos.js' */

/**
 * Cada puzzle de la lista tiene que cumplir la interfaz común (Puzzle, en src/core/tipos.d.ts).
 * @type {(categoria: Categoria, lista: Array<Omit<PuzzleRegistrado, 'categoria'>>) => PuzzleRegistrado[]}
 */
const conCategoria = (categoria, lista) => lista.map((p) => Object.assign(p, { categoria }));

const cubo4 = crearCuboGrande(4), cubo5 = crearCuboGrande(5);

export const PUZZLES = conCategoria('wca', [
  cubo2,
  cubo3,
  cubo4,
  cubo5,
  crearCuboGrande(6),
  crearCuboGrande(7),
  pyraminx,
  skewb,
  square1,
  megaminx,
  fto,
]).concat(conCategoria('cuboids', [
  // Cuboids (noche 15): a = ancho (R/L), b = fondo (F/B), c = alto (U/D); las caras cuadradas arriba y abajo.
  // Un cuboide más (2x2x4, 3x3x4…) es una línea aquí: crearCuboide deduce todo de las medidas.
  crearCuboide(3, 3, 1, { id: '3x3x1', nombre: '3x3x1 Floppy', costeScramble: 5 }),
  crearCuboide(3, 3, 2, { id: '3x3x2', nombre: '3x3x2 Domino', costeScramble: 1200 }),
  crearCuboide(2, 2, 3, { id: '2x2x3', nombre: '2x2x3 Tower', costeScramble: 120 }),
])).concat(conCategoria('shapemods', [
  // Shape Mods (noche 16): un 3x3 por dentro (planos de corte a ±corte en los tres ejes del mecanismo) con
  // otro cuerpo por fuera. Otro shape mod = otra definición de cortes. Fuentes y supuestos: DECISIONES.md.
  crearShapeMod({
    id: 'mirror',
    nombre: 'Mirror Blocks',
    // capa del medio = 1 (19 mm en un cubo de 57 mm); cuerpo desplazado: grosores U 0,5 · L 0,67 · F 0,83 ·
    // B 1,17 · R 1,33 · D 1,5 (el orden publicado, de la más fina a la más gruesa, con pasos iguales)
    cortes: { corte: 0.5, semilado: 1.5, centro: [1 / 3, -1 / 2, -1 / 6] },
    material: { nombre: 'plateado', hex: '#c9ced6' },
  }),
  crearShapeMod({
    id: 'ghost',
    nombre: 'Ghost Cube',
    // mecanismo inclinado y desplazado, y capas de arriba y abajo desfasadas en la forma de cubo (ajuste a una
    // foto de onexmac/ad, PR #163); planos de corte a 1/3 del semilado (supuesto: proporciones de un 3x3)
    cortes: {
      corte: 1 / 3, semilado: 1,
      ...cuboInclinado([-0.607, 0.484, 0.63], (63.3 * Math.PI) / 180, [0.034, 0.075, -0.038]),
      desfase: { abajo: (-27.5 * Math.PI) / 180, arriba: (26.7 * Math.PI) / 180 },
    },
    material: { nombre: 'plateado', hex: '#c9ced6' },
  }),
]));

/** Puzzles anunciados que aún no existen: el selector los muestra bloqueados ("pronto"). */
/** @type {PuzzlePronto[]} */
export const PUZZLES_PRONTO = [
  { id: '2x2x4', nombre: '2x2x4', categoria: 'cuboids' },
  { id: '3x3x4', nombre: '3x3x4', categoria: 'cuboids' },
  { id: '3x3x5', nombre: '3x3x5', categoria: 'cuboids' },
  { id: 'fisher', nombre: 'Fisher Cube', categoria: 'shapemods' },
  { id: 'windmill', nombre: 'Windmill Cube', categoria: 'shapemods' },
  { id: 'axis', nombre: 'Axis Cube', categoria: 'shapemods' },
];

/** @param {string} id @returns {PuzzleRegistrado | undefined} */
export const obtenerPuzzle = (id) => PUZZLES.find((p) => p.id === id);

/**
 * Bandaged Cubes (noche 13): los puzzles que se pueden vendar, con su nombre en la URL
 * (#/bandaged?puzzle=4x4). El 3x3 es el del registro (estado de colores: sus piezas se
 * distinguen); el 4x4 y el 5x5 llevan la identidad de los centros iguales en el estado y comparten
 * el solver (sin bloques) con los de la lista.
 * @type {Array<{ url: string, puzzle: Puzzle<EstadoPegatinas> }>}
 */
export const BANDAGED = [
  { url: '3x3', puzzle: /** @type {Puzzle<EstadoPegatinas>} */ (/** @type {unknown} */ (cubo3)) },
  { url: '4x4', puzzle: crearCuboConIdentidad(/** @type {Puzzle<EstadoPegatinas>} */ (/** @type {unknown} */ (cubo4)), 4) },
  { url: '5x5', puzzle: crearCuboConIdentidad(/** @type {Puzzle<EstadoPegatinas>} */ (/** @type {unknown} */ (cubo5)), 5) },
];

/** Cualquier puzzle por su id: los del registro y las bases del modo vendado. @param {string} id @returns {Puzzle<unknown> | undefined} */
export const buscarPuzzle = (id) => obtenerPuzzle(id) || BANDAGED.map((b) => b.puzzle).find((p) => p.id === id);
