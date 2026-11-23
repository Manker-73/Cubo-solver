// @ts-check
// FTO (Face-Turning Octahedron): modelo, validador, editor, solver por fases y scramble de
// estado aleatorio. Modalidad oficial de la WCA desde el 2 de enero de 2027 (media de 5).
//
// Notación (Reglamento WCA 2027, 12f): U, F, R, L, B, D, BR, BL giran 120° en sentido
// horario mirando la cara; con ' en sentido antihorario. Se sujeta con cuatro caras a la
// vista y su vértice común hacia quien mezcla: U arriba, F abajo, L y R a los lados.
// Geometría, colores y piezas: fto-geo.js; restricciones: fto-grupo.js; solver: fto-solver.js.
//
// El FTO no tiene ninguna pieza fija: el estado es la lista de las 72 pegatinas tal como se
// ven en la orientación de quien lo sujeta, y cualquier orientación del puzzle resuelto
// cuenta como resuelta.

import { definirPuzzle } from '../core/puzzle.js';
import { svgDePegatinas } from '../core/render.js';
import { reetiquetar } from '../core/simetria.js';
import { paridad, aplicarPerm } from '../core/perm.js';
import { rngSeguro } from '../core/rng.js';
import {
  geo, modelo, CARAS, IDX, OPUESTA, PALETA_FTO, ESQUINAS, ARISTAS, TRI_A, TRI_B, SIGMAS, sigmaPar,
  enA, nombrePos, vista3DGeo, ORB_ESQ, ORB_ARI, ORB_TA, ORB_TB,
} from './fto-geo.js';
import {
  inicializar as inicializarTablas, estaInicializado, resolverPiezas, piezasAleatorias, unirPartes, simplificar,
} from './fto-solver.js';

/**
 * Interfaz común: DefinicionPuzzle en src/core/tipos.d.ts (definirPuzzle la comprueba con npm run tipos).
 * @import { EstadoPegatinas, ResultadoResolver, Rng, Movimiento } from '../core/tipos.js'
 * @import { EstadoOrbita } from '../core/piezas.js'
 */

const caraDe = geo.pegatinas.map((/** @type {{ cara: number }} */ p) => p.cara);
/** @param {number} c */
const nombreColor = (c) => (PALETA_FTO[c] ? PALETA_FTO[c].nombre : 'sin color');
/** @param {number[]} cs */
const lista = (cs) => cs.map(nombreColor).join('-');
/** @param {number[]} cs */
const listaY = (cs) => { const n = cs.map(nombreColor); return n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1]; };
const RESUELTO = /** @type {EstadoPegatinas} */ (geo.resuelto.slice());
const PERMS = /** @type {Record<string, number[]>} */ (geo.perms);

// ---------- Piezas <-> pegatinas ----------
/** Estado de piezas (con los triángulos como colores) a partir de pegatinas ya normalizadas. @param {number[]} c @returns {EstadoOrbita[]} */
function piezasDe(c) {
  const id = modelo.identificar(c);
  return [
    id.orbitas[ORB_ESQ], id.orbitas[ORB_ARI],
    { perm: TRI_A.map((t) => c[t.pegatinas[0]]), ori: new Array(12).fill(0) },
    { perm: TRI_B.map((t) => c[t.pegatinas[0]]), ori: new Array(12).fill(0) },
  ];
}
/** Pegatinas de un estado de piezas. @param {EstadoOrbita[]} est @returns {EstadoPegatinas} */
function pegatinasDe(est) {
  const c = modelo.aColores([est[ORB_ESQ], est[ORB_ARI], modelo.resuelto[ORB_TA], modelo.resuelto[ORB_TB]], RESUELTO);
  TRI_A.forEach((t, p) => { c[t.pegatinas[0]] = est[ORB_TA].perm[p]; });
  TRI_B.forEach((t, p) => { c[t.pegatinas[0]] = est[ORB_TB].perm[p]; });
  return c;
}

// ---------- Validador ----------
/**
 * @param {EstadoPegatinas} estado
 * @returns {{ valido: false, errores: string[] } | { valido: true, errores: string[], orientaciones: EstadoOrbita[][] }}
 *   orientaciones: el estado de piezas en cada una de las 12 orientaciones del grupo
 *   (la primera, la de quien lo sujeta si es posible).
 */
function analizar(estado) {
  /** @type {string[]} */
  const errores = [];
  const cuenta = new Array(8).fill(0);
  let vacias = 0;
  for (const c of estado) { if (c >= 0 && c < 8) cuenta[c]++; else vacias++; }
  if (vacias) errores.push(`Hay ${vacias} pegatina${vacias > 1 ? 's' : ''} sin pintar.`);
  cuenta.forEach((n, c) => { if (n !== 9) errores.push(`Hay ${n} pegatina${n === 1 ? '' : 's'} de color ${nombreColor(c)} y debería haber 9.`); });
  if (errores.length) return { valido: false, errores };

  // 1) Esquinas y aristas: que existan, sin repetir (no depende de la orientación)
  const id = modelo.identificar(estado);
  // (los triángulos se identifican por su color: sus errores de órbita se miran en el paso 2)
  for (const e of id.errores.filter((x) => x.oi === ORB_ESQ || x.oi === ORB_ARI)) {
    const pz = e.oi === ORB_ESQ ? ESQUINAS[e.pos] : ARISTAS[e.pos];
    const tipo = e.oi === ORB_ESQ ? 'La esquina' : 'La arista';
    if (e.tipo === 'espejo') {
      errores.push(`${tipo} en ${nombrePos(pz)} (${lista(e.colores)}) tiene los colores en un orden imposible: es la imagen especular de una pieza real.`);
    } else {
      const repe = new Set(e.colores).size < e.colores.length;
      const opuestos = e.colores.some((a) => e.colores.some((b) => OPUESTA[CARAS[a]] === CARAS[b]));
      errores.push(`${tipo} en ${nombrePos(pz)} (${lista(e.colores)}) no existe en un FTO real${repe ? ' (tiene un color repetido)' : opuestos ? ' (tiene colores de caras opuestas)' : ''}.`);
    }
  }
  if (errores.length) return { valido: false, errores };
  for (const oi of [ORB_ESQ, ORB_ARI]) {
    const veces = new Array(id.orbitas[oi].perm.length).fill(0);
    for (const x of id.orbitas[oi].perm) veces[x]++;
    const piezas = oi === ORB_ESQ ? ESQUINAS : ARISTAS;
    const tipo = oi === ORB_ESQ ? 'esquina' : 'arista';
    veces.forEach((v, i) => {
      const cols = piezas[i].pegatinas.map((f) => RESUELTO[f]);
      if (v > 1) errores.push(`La ${tipo} ${lista(cols)} aparece ${v} veces.`);
      if (v === 0) errores.push(`Falta la ${tipo} ${lista(cols)}.`);
    });
  }
  if (errores.length) return { valido: false, errores };

  // 2) Orientación: las caras se reparten en dos tétradas (A = U, F, BR, BL y B = R, L, B, D) y
  // las rotaciones del grupo no las mezclan. Cada arista tiene un color de cada tétrada: la
  // mayoría de las aristas dice qué colores hacen de tétrada A (si la mitad dice una cosa y la
  // mitad otra, deciden los triángulos).
  const aristasA = ARISTAS.filter((a) => enA[estado[a.pegatinas[0]]]).length;
  const triA = TRI_A.filter((t) => enA[estado[t.pegatinas[0]]]).length;
  const par = aristasA !== 6 ? aristasA > 6 : triA >= 6;
  const candidatas = SIGMAS.map((s, i) => ({ s, i })).filter(({ i }) => sigmaPar[i] === par);
  // primero la que deja más pegatinas en su sitio (con el puzzle resuelto en cualquier
  // orientación, la que lo deja resuelto; a igualdad, la de quien lo sujeta)
  const enSitio = (/** @type {number[]} */ s) => estado.reduce((n, c, i) => n + (s[c] === caraDe[i] ? 1 : 0), 0);
  const identidad = (/** @type {number[]} */ s) => (s.every((x, k) => x === k) ? 1 : 0);
  candidatas.sort((a, b) => enSitio(b.s) - enSitio(a.s) || identidad(b.s) - identidad(a.s));
  const sigma = candidatas[0].s;
  const deA = CARAS.map((_, c) => c).filter((c) => enA[sigma[c]]); // colores pintados que hacen de tétrada A
  const deB = CARAS.map((_, c) => c).filter((c) => !enA[sigma[c]]);
  const est = piezasDe(reetiquetar(estado, sigma));
  const [E, A, TA] = est;

  A.ori.forEach((o, p) => {
    if (o) errores.push(`La arista en ${nombrePos(ARISTAS[p])} está volteada: en el FTO una arista no se puede dar la vuelta (su color de ${listaY(deA)} va siempre en esas caras).`);
  });
  E.ori.forEach((o, p) => {
    if (o % 2) errores.push(`La esquina en ${nombrePos(ESQUINAS[p])} está girada un cuarto de vuelta: en el FTO una esquina solo puede estar girada media vuelta.`);
  });
  const fuera = TA.perm.filter((c) => !enA[c]).length;
  if (fuera) {
    errores.push(`Hay ${fuera} triángulo${fuera > 1 ? 's' : ''} en caras imposibles: los triángulos ${listaY(deA)} nunca pasan a las caras de los triángulos ${listaY(deB)} (y al revés).`);
  }
  if (errores.length) return { valido: false, errores };
  if (paridad(E.perm)) errores.push('Dos esquinas están intercambiadas: la permutación de las esquinas es impar y en el FTO siempre es par.');
  if (paridad(A.perm)) errores.push('Dos aristas están intercambiadas: la permutación de las aristas es impar y en el FTO siempre es par.');
  if (E.ori.reduce((a, o) => a + o / 2, 0) % 2) errores.push('Una esquina está girada media vuelta: la orientación de las esquinas no es posible (siempre hay un número par de esquinas giradas).');
  if (errores.length) return { valido: false, errores };
  // Las 12 orientaciones del grupo (todas válidas si una lo es)
  const orientaciones = candidatas.map(({ s }) => piezasDe(reetiquetar(estado, s)));
  return { valido: true, errores: [], orientaciones };
}

// ---------- Solver ----------
/**
 * Resuelve repartiendo el tiempo entre las 12 orientaciones equivalentes (la dificultad de la
 * fase 2 cambia mucho de una a otra): rondas de presupuesto creciente; se queda con la más corta
 * que salga dentro de `tiempoMax` (o la primera, si `primera`).
 * @param {EstadoOrbita[][]} orientaciones @param {{ tiempoMax?: number, primera?: boolean }} op
 */
function resolverOrientaciones(orientaciones, { tiempoMax = 1000, primera = false } = {}) {
  inicializarTablas();
  const t0 = performance.now();
  /** @type {{ movimientos: Movimiento[], fases: import('../core/tipos.js').Fase[], k: number } | null} */
  let mejor = null;
  const hechas = new Set();
  for (let ronda = 0, presupuesto = 40; ; ronda++, presupuesto *= 3) {
    for (let k = 0; k < orientaciones.length; k++) {
      if (hechas.has(k)) continue;
      const ahora = performance.now();
      // sin solución aún: se sigue aunque se pase de tiempoMax (siempre hay una)
      if (mejor && ahora - t0 > tiempoMax) return mejor;
      const r = resolverPiezas(orientaciones[k], { hasta: ahora + presupuesto });
      if (!r) continue;
      hechas.add(k);
      const u = { ...unirPartes(r.partes), k };
      if (!mejor || u.movimientos.length < mejor.movimientos.length) mejor = u;
      if (primera || mejor.movimientos.length === 0) return mejor;
    }
    if (mejor && (hechas.size === orientaciones.length || ronda >= 2)) return mejor;
  }
}

/** @param {EstadoPegatinas} estado @param {{ tiempoMax?: number }} [opciones] @returns {ResultadoResolver} */
function resolver(estado, opciones = {}) {
  const t0 = performance.now();
  const a = analizar(estado);
  if (!a.valido) return { ok: false, errores: a.errores };
  if (estaResuelto(estado)) return { ok: true, movimientos: [], fases: [], ms: performance.now() - t0 };
  const r = resolverOrientaciones(a.orientaciones, { tiempoMax: opciones.tiempoMax ?? 1000 });
  return { ok: true, movimientos: r.movimientos, fases: r.fases, ms: performance.now() - t0 };
}

// ---------- Scramble ----------
/** @param {Movimiento} m */
const invertirMovimiento = (m) => (m.endsWith("'") ? m.slice(0, -1) : m + "'");
/** @param {EstadoPegatinas} e */
function estaResuelto(e) {
  const color = new Array(8).fill(-1);
  for (let i = 0; i < e.length; i++) {
    const f = caraDe[i];
    if (color[f] < 0) color[f] = e[i];
    else if (color[f] !== e[i]) return false;
  }
  return true;
}
/** @param {EstadoPegatinas} e @param {Movimiento} m */
const aplicar = (e, m) => /** @type {EstadoPegatinas} */ (geo.aplicar(e, m));
const MOVS = CARAS.flatMap((c) => [c, c + "'"]);

// Rotaciones del grupo como cambio de sistema de referencia: girar el puzzle entero con la
// rotación i y renombrar los colores con SIGMAS[i] deja el resuelto de referencia en el resuelto
// de referencia, y un giro X en ese marco es el giro MAPA[i][X] en el original. Una solución
// encontrada en el marco i, traducida, lleva el estado exactamente al resuelto de referencia
// (no a uno girado).
const ROT_GRUPO = SIGMAS.map((_, i) => i).filter((i) => sigmaPar[i])
  .sort((a, b) => (geo.rotaciones[b].every((/** @type {number} */ x, /** @type {number} */ j) => x === j) ? 1 : 0) - (geo.rotaciones[a].every((/** @type {number} */ x, /** @type {number} */ j) => x === j) ? 1 : 0));
const MAPA = geo.rotaciones.map((/** @type {number[]} */ R) => Object.fromEntries(CARAS.map((c, f) => {
  const s = caraDe.indexOf(f);
  return [c, CARAS[caraDe[R[s]]]];
})));
/** @param {Movimiento} m @param {number} i */
const traducir = (m, i) => MAPA[i][m.replace("'", '')] + (m.endsWith("'") ? "'" : '');

/**
 * Scramble de estado aleatorio (Reglamento 4b3: estado uniforme entre los que necesitan al
 * menos 2 giros). Se elige el estado de piezas al azar, se busca una solución que lo lleve
 * exactamente al resuelto de referencia (blanco arriba, verde delante: 4d6) y se invierte.
 * Para no depender de lo difícil que sea un marco, se prueba en los 12 marcos girados (ver
 * ROT_GRUPO): todos llevan al mismo resuelto, así que el reparto sigue siendo uniforme.
 * @param {Rng} rng @returns {Movimiento[]}
 */
function generarScramble(rng = rngSeguro()) {
  inicializarTablas();
  for (;;) {
    const est = piezasAleatorias(rng);
    const e = pegatinasDe(est);
    if (estaResuelto(e) || MOVS.some((m) => estaResuelto(aplicar(e, m)))) continue; // menos de 2 giros
    const marcos = ROT_GRUPO.map((i) => piezasDe(reetiquetar(aplicarPerm(e, geo.rotaciones[i]), SIGMAS[i])));
    const r = resolverOrientaciones(marcos, { primera: true });
    const sol = r.movimientos.map((m) => traducir(m, ROT_GRUPO[r.k]));
    return simplificar(sol.slice().reverse().map(invertirMovimiento));
  }
}

/** Eje de un giro: la cara y su opuesta conmutan. @type {Record<string, string>} */
const EJE = { U: 'U-D', D: 'U-D', F: 'F-B', B: 'F-B', R: 'R-BL', BL: 'R-BL', L: 'L-BR', BR: 'L-BR' };

export default definirPuzzle({
  id: 'fto',
  nombre: 'FTO',
  capacidades: { scramble: true, validar: true, resolver: true, editar: true },
  descripcion: 'Solución en tres fases (U, F, R, L, B, D, BR, BL): la cara D, luego reducir a R, L, B, D y al final esquinas y aristas.',
  tipoScramble: 'estado aleatorio',
  avisoInicializacion: 'Generando las tablas del FTO (unos segundos la primera vez)…',
  costeScramble: 2500, // ms aprox. del primer scramble (tablas); orden de las precargas
  paleta: PALETA_FTO,
  estadoResuelto: () => /** @type {EstadoPegatinas} */ (RESUELTO.slice()),
  aplicarMovimiento(e, m) {
    if (!PERMS[m]) throw new Error(`Movimiento no válido: "${m}"`);
    return aplicar(e, m);
  },
  estaResuelto,
  invertirMovimiento,
  infoMovimiento(m) {
    const c = m.replace("'", '');
    if (!PERMS[m] || IDX[c] === undefined) throw new Error(`Movimiento no válido: "${m}"`);
    return { eje: EJE[c], clave: c };
  },
  describirLongitud: (movs) => `${movs.length} giros`,
  renderizar(estado, opciones = {}) {
    return svgDePegatinas(geo.pegatinas2D, estado, PALETA_FTO, opciones);
  },
  pegatinasEditables: () => RESUELTO.map((_, i) => i),
  inicializar: () => inicializarTablas(),
  estaInicializado,
  validar: (e) => { const a = analizar(e); return { valido: a.valido, errores: a.errores }; },
  resolver,
  generarScramble,
  ...vista3DGeo,
  geo,
  modelo,
  analizar,
  piezasDe,
  pegatinasDe,
});
