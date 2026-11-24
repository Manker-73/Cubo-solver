// @ts-check
// Registro de puzzles. Para añadir un puzzle nuevo: crear su módulo (que
// exporte un objeto hecho con definirPuzzle) y añadirlo a esta lista.
// La interfaz y los tests no necesitan ningún otro cambio.
//
// `categoria`: sección de la app en la que aparece cada puzzle (ver src/app/secciones.js):
// 'wca' = WCA Puzzles. Es un dato del registro, no de la interfaz común: los módulos
// de los puzzles no lo conocen. El 3x3 vendado (Bandaged Cubes) es el 3x3 de esta lista
// envuelto por puzzleConBloqueos; el 4x4 y el 5x5 vendados (noche 13), los de esta lista con el
// estado de identidades (nxn-identidad.js), en BANDAGED.

import cubo2 from './cubo2.js';
import cubo3 from './cubo3.js';
import { crearCuboGrande } from './cubo-grande.js';
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
]);

/** Puzzles anunciados que aún no existen: el selector los muestra bloqueados ("pronto"). */
/** @type {PuzzlePronto[]} */
export const PUZZLES_PRONTO = [];

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
