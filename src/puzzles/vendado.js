// 3x3 vendado (bloqueos definidos por el usuario): fábrica para los tests y los
// scripts. La interfaz y el Worker crean el mismo puzzle con puzzleConBloqueos.
import cubo3 from './cubo3.js';
import { puzzleConBloqueos } from '../core/bloqueos.js';
import { bloquesDesdeFirma } from './nxn-bloqueos.js';

/** 3x3 con los bloques dados ([[clave, ...]]) o con una firma hexadecimal. */
export function crear3x3Vendado(def, opciones = {}) {
  const bloques = typeof def === 'string' ? bloquesDesdeFirma(def) : def;
  return puzzleConBloqueos(cubo3, bloques, opciones);
}

// 4x4 y 5x5 vendados (noche 13): la base con identidad de las piezas iguales (nxn-identidad.js)
import { crearCuboGrande } from './cubo-grande.js';
import { crearCuboConIdentidad } from './nxn-identidad.js';
/** @type {Map<number, ReturnType<typeof crearCuboConIdentidad>>} */
const bases = new Map();
/** NxN (N = 4, 5) vendado con los bloques dados ([[clave, ...]]). */
export function crearNxNVendado(N, def, opciones = {}) {
  if (!bases.has(N)) bases.set(N, crearCuboConIdentidad(crearCuboGrande(N), N));
  return puzzleConBloqueos(bases.get(N), def, opciones);
}
