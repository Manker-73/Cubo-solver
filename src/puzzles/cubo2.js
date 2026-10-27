// 2x2: validador, solucionador óptimo (IDA* en <U, R, F>) y scramble de estado aleatorio.

import { definirPuzzle } from '../core/puzzle.js';
import { crearModeloPiezas, crearBuscador } from '../core/piezas.js';
import { reetiquetar } from '../core/simetria.js';
import { barajar, entero, rngSeguro } from '../core/rng.js';
import { baseNxN } from './nxn.js';
import {
  piezasCubo, rotacionesColorCubo, NOMBRES_ESQUINAS, comprobarConteo, erroresDePiezas,
} from './cubo-comun.js';

const b = baseNxN(2);
const { esquinas } = piezasCubo(2);
const MOVS = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"];
const EJES = [0, 0, 0, 1, 1, 1, 2, 2, 2];
const DBL = 6;
const MIN_LONGITUD = 4; // como TNoodle: se descartan estados que se resuelven en menos de 4

const modelo = crearModeloPiezas({
  orbitas: [{ nombre: 'esquinas', piezas: esquinas }],
  movimientos: Object.fromEntries(MOVS.map((m) => [m, b.permDe(m)])),
  coloresResuelto: b.estadoResuelto(),
});
const coloresPieza = esquinas.map((pz) => pz.map((f) => b.estadoResuelto()[f]));
const sigmas = rotacionesColorCubo(2);

let buscador = null;
function inicializar() {
  if (buscador) return { ms: buscador.msInit, yaEstaba: true };
  buscador = crearBuscador({
    coords: [modelo.coordPerm(0), modelo.coordOri(0)],
    movs: MOVS,
    ejes: EJES,
    podas: [[0], [1]],
    objetivo: [0, 0],
  });
  return { ms: buscador.msInit };
}

/** Reetiqueta los colores para que la esquina DBL quede en su sitio y bien orientada. */
function normalizar(estado) {
  const pos = esquinas[DBL];
  for (const s of sigmas) {
    if (pos.every((f, j) => s[estado[f]] === coloresPieza[DBL][j])) return reetiquetar(estado, s);
  }
  return null;
}

/**
 * Analiza un estado pintado. Devuelve { valido, errores, coords }.
 */
function analizar(estado) {
  let errores = comprobarConteo(estado, 4);
  if (errores.length) return { valido: false, errores };
  const ident0 = modelo.identificar(estado);
  errores = erroresDePiezas(ident0, [NOMBRES_ESQUINAS], ['esquina'], [coloresPieza]);
  if (errores.length) return { valido: false, errores };
  const norm = normalizar(estado);
  if (!norm) return { valido: false, errores: ['No se pudo determinar la orientación del cubo.'] };
  const ident = modelo.identificar(norm);
  const giro = ident.orbitas[0].ori.reduce((a, x) => a + x, 0) % 3;
  if (giro !== 0) {
    errores.push(`Una esquina está girada: la suma de las orientaciones de las esquinas no es múltiplo de 3 (sobra ${giro === 1 ? 'un giro horario' : 'un giro antihorario'}).`);
    return { valido: false, errores };
  }
  return { valido: true, errores: [], estadoPiezas: ident.orbitas };
}

function resolver(estado) {
  inicializar();
  const t0 = performance.now();
  const a = analizar(estado);
  if (!a.valido) return { ok: false, errores: a.errores };
  const coords = [modelo.coordPerm(0).codificar(a.estadoPiezas), modelo.coordOri(0).codificar(a.estadoPiezas)];
  const r = buscador.resolver(coords, 14);
  if (!r) return { ok: false, errores: ['No se encontró solución (esto no debería pasar).'] };
  return { ok: true, movimientos: r.movimientos, ms: performance.now() - t0 };
}

/** Estado aleatorio uniforme (con DBL fija), como piezas. */
function estadoAleatorioPiezas(rng) {
  const otras = [0, 1, 2, 3, 4, 5, 7];
  const perm = barajar(rng, otras);
  perm.splice(DBL, 0, DBL);
  const ori = new Array(8).fill(0);
  let suma = 0;
  for (const p of [0, 1, 2, 3, 4, 5]) { ori[p] = entero(rng, 3); suma += ori[p]; }
  ori[7] = (3 - (suma % 3)) % 3;
  return [{ perm, ori }];
}

function estadoAleatorio(rng) {
  return modelo.aColores(estadoAleatorioPiezas(rng), b.estadoResuelto());
}

function generarScramble(rng = rngSeguro()) {
  inicializar();
  for (;;) {
    const est = estadoAleatorioPiezas(rng);
    const coords = [modelo.coordPerm(0).codificar(est), modelo.coordOri(0).codificar(est)];
    const r = buscador.resolver(coords, 14);
    if (r.movimientos.length < MIN_LONGITUD) continue;
    return r.movimientos.slice().reverse().map(b.invertirMovimiento);
  }
}

export default definirPuzzle({
  id: '2x2',
  nombre: '2x2',
  capacidades: { scramble: true, validar: true, resolver: true, editar: true },
  descripcion: 'Solución óptima en movimientos U, R, F (la esquina DBL queda fija).',
  tipoScramble: 'estado aleatorio',
  paleta: b.paleta,
  estadoResuelto: b.estadoResuelto,
  aplicarMovimiento: b.aplicarMovimiento,
  estaResuelto: b.estaResuelto,
  invertirMovimiento: b.invertirMovimiento,
  infoMovimiento: b.infoMovimiento,
  buscarRedundancia: b.buscarRedundancia,
  renderizar: b.renderizar,
  pegatinasEditables: () => b.estadoResuelto().map((_, i) => i),
  inicializar,
  estaInicializado: () => !!buscador,
  validar: (e) => { const a = analizar(e); return { valido: a.valido, errores: a.errores }; },
  resolver,
  generarScramble,
  estadoAleatorio,
});
