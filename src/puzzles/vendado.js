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
