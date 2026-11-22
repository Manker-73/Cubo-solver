// 3x3 vendado: soporte de bloqueos del 3x3 (el genérico del NxN más una búsqueda
// directa propia: Kociemba con los giros filtrados por la legalidad), ejemplos de
// configuraciones y comparación con el mismo estado sin bloqueos.

import { soporteBloqueosNxN } from './nxn-bloqueos.js';
import { piezasCubo } from './cubo-comun.js';
import { crearModeloPiezas } from '../core/piezas.js';
import { baseNxN } from './nxn.js';
import { resolverKociemba, resolverOptimoKociemba, cuboDesdeIdentificacion, NOMBRES_MOV } from './kociemba.js';

const b = baseNxN(3);
const RESUELTO = b.estadoResuelto();
const { esquinas, aristas } = piezasCubo(3);
const modeloPiezas = crearModeloPiezas({
  orbitas: [{ nombre: 'esquinas', piezas: esquinas }, { nombre: 'aristas', piezas: aristas }],
  movimientos: {},
  coloresResuelto: RESUELTO,
});

/** Cubies (Kociemba) de un estado de colores con los centros en su sitio. */
export function cuboDeColores(estado) {
  return cuboDesdeIdentificacion(modeloPiezas.identificar(estado).orbitas);
}

const base = soporteBloqueosNxN(3);
// Los giros de búsqueda del soporte (U U2 U' R ...) tienen el mismo orden que los de Kociemba
if (base.busqueda.join() !== NOMBRES_MOV.join()) throw new Error('orden de giros distinto del de Kociemba');

/**
 * Búsqueda directa del 3x3: Kociemba con cada giro filtrado por la legalidad del
 * estado de su profundidad (las tablas de poda son las del 3x3 normal: siguen
 * siendo cotas inferiores, porque con menos giros nunca se llega antes).
 * Devuelve la lista de índices de giro o null.
 */
function busquedaRapida(mod, S, { msMax = 500, maxLong = 30, objetivo = 0, ultima = -1 } = {}) {
  const colores = base.estadoDesde(mod.dondeDesdeS(S));
  const cubo = cuboDeColores(colores);
  const pila = [S];
  for (let i = 1; i < 64; i++) pila.push(new Int16Array(mod.nS));
  const r = resolverKociemba(cubo, {
    msMax, maxLong, objetivo,
    ultimaInicial: ultima >= 0 ? Math.floor(ultima / 3) : -1, // giros: 3 por cara, en el orden de Kociemba
    esLegal: (m, k) => mod.legal(pila[k], m),
    alAvanzar: (m, k) => { mod.aplicarEn(pila[k], m, pila[k + 1]); },
  });
  if (!r) return null;
  return r.movimientos.map((n) => NOMBRES_MOV.indexOf(n));
}

export const soporteBloqueos3x3 = { ...base, busquedaRapida };

const CENTROS = [4, 13, 22, 31, 40, 49];

/**
 * Mejor solución del mismo estado SIN bloqueos: óptima si da tiempo, si no
 * Kociemba. El estado puede estar girado (capas centrales): se cambian los
 * colores para que los centros queden en su sitio, que es el mismo estado visto
 * desde otra orientación.
 */
export function solucionSinBloqueos(estado, { msMax = 400 } = {}) {
  const sigma = new Array(6);
  CENTROS.forEach((c, f) => { sigma[estado[c]] = f; });
  if (sigma.some((x) => x === undefined)) return null;
  const norm = estado.map((c) => sigma[c]);
  const ident = modeloPiezas.identificar(norm);
  if (ident.errores && ident.errores.length) return null;
  const cubo = cuboDesdeIdentificacion(ident.orbitas);
  const opt = resolverOptimoKociemba(cubo, { msMax: msMax * 0.6 });
  if (opt) return { movimientos: opt, optima: true };
  const k = resolverKociemba(cubo, { msMax: msMax * 0.4, objetivo: 0 });
  return k ? { movimientos: k.movimientos, optima: false } : null;
}

/**
 * Configuraciones de ejemplo (claves de las piezas; ver nxn-bloqueos.js) y cubos
 * clásicos por su firma (Bandaged Cube Explorer; las cifras están comprobadas en
 * tests/bloqueos.test.mjs).
 */
export const EJEMPLOS_BLOQUEOS = [
  { id: 'pareja', nombre: 'Una pareja 1x1x2 (esquina + arista)', bloques: [['UFR', 'UF']] },
  { id: 'centro-arista', nombre: 'Centro + arista (1x1x2)', bloques: [['U', 'UF']] },
  { id: '1x2x2', nombre: 'Un bloque 1x2x2', bloques: [['UFR', 'UF', 'UR', 'U']] },
  { id: 'barras', nombre: 'Dos barras 1x1x3', bloques: [['UFL', 'UF', 'UFR'], ['DBL', 'DB', 'DBR']] },
  { id: 'varios', nombre: 'Varios bloques (pareja, barra y centro + arista)', bloques: [['UFR', 'UF'], ['DBL', 'DB', 'DBR'], ['L', 'FL']] },
  { id: '1x2x3', nombre: 'Un bloque 1x2x3', bloques: [['UFL', 'UF', 'UFR', 'UL', 'U', 'UR']] },
  { id: '2x2x2', nombre: 'Un bloque 2x2x2 (solo giran D, L y B)', bloques: [['UFR', 'UF', 'UR', 'FR', 'U', 'F', 'R']] },
  { id: 'casi', nombre: 'Casi bloqueado (solo gira B)', bloques: [['UFR', 'UF', 'UR', 'FR', 'U', 'F', 'R'], ['D', 'DL', 'L']] },
  { id: 'quintamese', nombre: 'Quintamese / Equator Cube (300C0000000C03)', firma: '300C0000000C03' },
  { id: 'bicube', nombre: 'Bicube (E0400B43FC5A1)', firma: 'E0400B43FC5A1' },
  { id: 'bandaged-cube', nombre: 'Bandaged Cube de twistypuzzles (33EC01800846)', firma: '33EC01800846' },
  { id: 'cab', nombre: 'CAB Cube 5-5 (22006F100000C6)', firma: '22006F100000C6' },
  { id: 'most-signatures', nombre: 'Most signatures Bandaged Cube (10840080200C21)', firma: '10840080200C21' },
];
