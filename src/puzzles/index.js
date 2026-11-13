// Registro de puzzles. Para añadir un puzzle nuevo: crear su módulo (que
// exporte un objeto hecho con definirPuzzle) y añadirlo a esta lista.
// La interfaz y los tests no necesitan ningún otro cambio.

import cubo2 from './cubo2.js';
import cubo3 from './cubo3.js';
import { crearCuboGrande } from './cubo-grande.js';
import pyraminx from './pyraminx.js';
import skewb from './skewb.js';
import square1 from './square1.js';
import megaminx from './megaminx.js';

export const PUZZLES = [
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
];

export const obtenerPuzzle = (id) => PUZZLES.find((p) => p.id === id);
