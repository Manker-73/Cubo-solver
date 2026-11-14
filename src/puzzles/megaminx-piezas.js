// Megaminx: piezas (12 centros fijos, 20 esquinas, 30 aristas) deducidas de la
// geometría, efecto de los giros de cara sobre ellas y orientación libre al pintar.
//
// Una pegatina pertenece a la pieza formada por las caras en cuya capa está (su
// centro queda por encima del corte de esa cara): 1 cara = centro, 2 = arista,
// 3 = esquina. Las pegatinas de cada pieza van en sentido horario visto desde
// fuera; la orientación o significa que la pegatina j de la pieza está en el
// hueco (j + o) de la posición que ocupa (ver core/piezas.js).

import { geo, CARAS, MOVS_CARA, normales, H } from './megaminx-geo.js';
import { crearModeloPiezas } from '../core/piezas.js';
import { permutacionesDeColor, reetiquetar } from '../core/simetria.js';
import { dot } from '../core/geometria.js';

function carasDePegatina(i) {
  const c = geo.pegatinas[i].centro;
  return normales.map((n, f) => (dot(c, n) > H + 1e-9 ? f : -1)).filter((f) => f >= 0);
}

const grupos = geo.piezasPor((_, i) => carasDePegatina(i).join(','));
const piezasDe = (k) => grupos.filter((g) => g.pegatinas.length === k)
  .map((g) => ({ caras: g.clave.split(',').map(Number), pegatinas: g.pegatinas }))
  .sort((a, b) => a.caras.join(',').localeCompare(b.caras.join(','), 'en', { numeric: true }));
export const CENTROS = piezasDe(1).map((p) => p.pegatinas[0]);
export const ESQUINAS = piezasDe(3);
export const ARISTAS = piezasDe(2);
if (CENTROS.length !== 12 || ESQUINAS.length !== 20 || ARISTAS.length !== 30) {
  throw new Error(`Megaminx: piezas inesperadas (${CENTROS.length} centros, ${ESQUINAS.length} esquinas, ${ARISTAS.length} aristas)`);
}
CENTROS.forEach((s, f) => { if (geo.pegatinas[s].cara !== f) throw new Error('Megaminx: centros desordenados'); });

export const ORB_ESQ = 0, ORB_ARI = 1;
export const nombrePos = (pz) => pz.caras.map((f) => CARAS[f]).join('-');

const movimientos = Object.fromEntries(MOVS_CARA.map((m) => [m, geo.perms[m]]));
export const modelo = crearModeloPiezas({
  orbitas: [
    { nombre: 'esquinas', piezas: ESQUINAS.map((p) => p.pegatinas) },
    { nombre: 'aristas', piezas: ARISTAS.map((p) => p.pegatinas) },
  ],
  movimientos,
  coloresResuelto: geo.resuelto,
});

// ---------- Orientación libre ----------
// Las 60 rotaciones del puzzle entero vistas como permutaciones de colores: si los
// centros pintados son una rotación de los del estado resuelto, se reetiquetan los
// colores para que cada centro tenga el color "de su cara"; la solución queda así en
// el sistema de referencia de quien sujeta el puzzle.
export const SIGMAS = permutacionesDeColor(geo.rotaciones, geo.resuelto, CENTROS);
if (SIGMAS.length !== 60) throw new Error('Megaminx: se esperaban 60 orientaciones');

/** sigma (color pintado -> color canónico) que deja cada centro con el color de su cara, o null. */
export function sigmaDeCentros(estado) {
  for (const s of SIGMAS) if (CENTROS.every((i, f) => s[estado[i]] === f)) return s;
  return null;
}
export { reetiquetar };
