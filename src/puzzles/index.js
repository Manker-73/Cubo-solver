// @ts-check
// Registro de puzzles. Para añadir un puzzle nuevo: crear su módulo (que
// exporte un objeto hecho con definirPuzzle) y añadirlo a esta lista.
// La interfaz y los tests no necesitan ningún otro cambio.
//
// `categoria`: sección de la app en la que aparece cada puzzle (ver src/app/secciones.js):
// 'wca' = WCA Puzzles. Es un dato del registro, no de la interfaz común: los módulos
// de los puzzles no lo conocen. El 3x3 vendado (Bandaged Cubes) es el 3x3 de esta lista
// envuelto por puzzleConBloqueos.

import cubo2 from './cubo2.js';
import cubo3 from './cubo3.js';
import { crearCuboGrande } from './cubo-grande.js';
import pyraminx from './pyraminx.js';
import skewb from './skewb.js';
import square1 from './square1.js';
import megaminx from './megaminx.js';

/** @import { Categoria, PuzzleRegistrado, PuzzlePronto } from '../core/tipos.js' */

/**
 * Cada puzzle de la lista tiene que cumplir la interfaz común (Puzzle, en src/core/tipos.d.ts).
 * @type {(categoria: Categoria, lista: Array<Omit<PuzzleRegistrado, 'categoria'>>) => PuzzleRegistrado[]}
 */
const conCategoria = (categoria, lista) => lista.map((p) => Object.assign(p, { categoria }));

export const PUZZLES = conCategoria('wca', [
  cubo2,
  cubo3,
  crearCuboGrande(4),
  crearCuboGrande(5),
  crearCuboGrande(6),
  crearCuboGrande(7),
  pyraminx,
  skewb,
  square1,
  megaminx,
]);

/** Puzzles anunciados que aún no existen: el selector los muestra bloqueados ("pronto"). */
/** @type {PuzzlePronto[]} */
export const PUZZLES_PRONTO = [
  { id: 'fto', nombre: 'FTO', categoria: 'wca' },
];

/** @param {string} id @returns {PuzzleRegistrado | undefined} */
export const obtenerPuzzle = (id) => PUZZLES.find((p) => p.id === id);
