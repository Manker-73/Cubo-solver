// Soporte de bloqueos (cubos vendados) para los cubos NxN: lo que la capa
// genérica de src/core/bloqueos.js necesita saber del puzzle (ver ARQUITECTURA.md,
// "Bloqueos"). Nada de esto sabe de bloques: solo describe piezas, giros y capas.
//
// Puntos: las 6·N² pegatinas y, en N impar, un punto "virtual" para el núcleo
// (no tiene pegatinas, no se mueve con los giros de cara y está en las tres capas
// centrales). Un mapa de un giro dice a qué posición va cada punto.

import { geometriaNxN, analizarMovimiento, CARAS, pegatinasRedNxN } from './nxn.js';
import { cierreGrupo } from '../core/simetria.js';
import { componer, invertir } from '../core/perm.js';

const NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Capas centrales del 3x3 (notación WCA): M como L, E como D, S como F
export const CAPAS_CENTRALES = { M: 'L', E: 'D', S: 'F' };
const RE_SLICE = /^([MES])(2'|2|')?$/;

/** true si el movimiento es una capa central (M, E, S). */
export const esCapaCentral = (m) => RE_SLICE.test(m);

/** Nombre de una pieza a partir de las caras que toca (orden U/D, F/B, R/L). */
function nombrePieza(caras) {
  const orden = ['U', 'D', 'F', 'B', 'R', 'L'];
  return caras.slice().sort((a, b) => orden.indexOf(a) - orden.indexOf(b)).join('');
}

const cache = new Map();

/**
 * Soporte de bloqueos de un cubo NxN (N = 2 o 3: las piezas se distinguen por
 * sus colores). Devuelve un objeto con la forma que espera crearModeloBloqueos.
 */
export function soporteBloqueosNxN(N) {
  if (cache.has(N)) return cache.get(N);
  const geo = geometriaNxN(N);
  const nPeg = geo.pos.length;
  const impar = N % 2 === 1;
  const P = nPeg + (impar ? 1 : 0); // + núcleo
  const NUCLEO = impar ? nPeg : -1;

  // Cubie (coordenadas enteras, pasos de 2) de cada punto
  const cubie = geo.pos.map((p) => p.map((x) => (Math.abs(x) === N ? Math.sign(x) * (N - 1) : x)));
  if (impar) cubie.push([0, 0, 0]);
  const claveCubie = (c) => c.join(',');

  // Piezas: puntos agrupados por cubie (el primero es el de referencia)
  const porCubie = new Map();
  cubie.forEach((c, p) => {
    const k = claveCubie(c);
    if (!porCubie.has(k)) porCubie.set(k, []);
    porCubie.get(k).push(p);
  });
  const piezas = [];
  for (const [k, pts] of porCubie) {
    const c = cubie[pts[0]];
    const caras = pts.filter((p) => p < nPeg).map((p) => CARAS[Math.floor(p / (N * N))]);
    const nCaras = caras.length;
    const tipo = pts[0] === NUCLEO ? 'nucleo' : nCaras === 3 ? 'esquina' : nCaras === 2 ? 'arista' : 'centro';
    // En N > 3 habría varias piezas con las mismas caras: se añade la posición
    let clave = tipo === 'nucleo' ? 'núcleo' : nombrePieza(caras);
    if (N > 3) clave += '@' + k;
    piezas.push({ clave, tipo, puntos: pts, cubie: c });
  }
  // Orden estable: esquinas, aristas, centros, núcleo
  const ordenTipo = { esquina: 0, arista: 1, centro: 2, nucleo: 3 };
  piezas.sort((a, b) => ordenTipo[a.tipo] - ordenTipo[b.tipo] || (a.clave < b.clave ? -1 : 1));

  // Mapas de los giros: mapa[p] = posición nueva del punto p
  const mapas = new Map();
  const capas = new Map();
  function permSlice(letra, veces) {
    const cara = CAPAS_CENTRALES[letra];
    const q = componer(geo.cuarto(cara, 2), invertir(geo.cuarto(cara, 1)));
    let P2 = q;
    for (let i = 1; i < veces; i++) P2 = componer(P2, q);
    return P2;
  }
  function permDe(mov) {
    const s = RE_SLICE.exec(mov);
    if (s) {
      if (N !== 3) throw new Error(`Movimiento no válido: "${mov}"`);
      return permSlice(s[1], s[2] === "'" ? 3 : s[2] ? 2 : 1);
    }
    const { cara, prof, veces } = analizarMovimiento(mov, N);
    let Q = geo.cuarto(cara, prof);
    const q = Q;
    for (let i = 1; i < veces; i++) Q = componer(Q, q);
    return Q;
  }
  function mapa(mov) {
    let m = mapas.get(mov);
    if (m) return m;
    const Pm = permDe(mov); // nuevo[i] = viejo[Pm[i]]: el punto en Pm[i] pasa a i
    m = new Int16Array(P);
    for (let i = 0; i < nPeg; i++) m[Pm[i]] = i;
    if (impar) m[NUCLEO] = NUCLEO;
    mapas.set(mov, m);
    return m;
  }
  /** Capa que mueve un giro: enCapa[p] = 1 si la pieza en la posición p se mueve. */
  function enCapa(mov) {
    let c = capas.get(mov);
    if (c) return c;
    c = new Uint8Array(P);
    const s = RE_SLICE.exec(mov);
    const rot = /^[xyz]/.test(mov);
    if (rot) c.fill(1);
    else if (s) {
      const a = NORMAL[CAPAS_CENTRALES[s[1]]];
      for (let p = 0; p < P; p++) c[p] = dot(cubie[p], a) === 0 ? 1 : 0;
    } else {
      const { cara, prof } = analizarMovimiento(mov, N);
      const a = NORMAL[cara];
      for (let p = 0; p < P; p++) c[p] = dot(cubie[p], a) > N - 1 - 2 * prof ? 1 : 0;
    }
    capas.set(mov, c);
    return c;
  }

  // Giros de cara (los que usan los scrambles y la búsqueda)
  const busqueda = [];
  for (const c of CARAS) for (const s of ['', '2', "'"]) busqueda.push(c + s);
  const centrales = N === 3 ? ['M', 'E', 'S'].flatMap((l) => [l, l + '2', l + "'"]) : [];
  // Rotaciones del cubo entero (24) como mapas de puntos
  const rotPerms = cierreGrupo([permDe('x'), permDe('y')]);
  const rotaciones = rotPerms.map((Pm) => {
    const m = new Int16Array(P);
    for (let i = 0; i < nPeg; i++) m[Pm[i]] = i;
    if (impar) m[NUCLEO] = NUCLEO;
    return m;
  });

  // Colores
  const colorResuelto = [];
  for (let f = 0; f < 6; f++) for (let i = 0; i < N * N; i++) colorResuelto.push(f);
  // Para identificar: en cada cubie, el conjunto de colores dice qué pieza hay
  const piezaDeColores = new Map();
  piezas.forEach((pz, k) => {
    const cols = pz.puntos.filter((p) => p < nPeg).map((p) => colorResuelto[p]);
    if (cols.length) piezaDeColores.set(cols.slice().sort().join(','), k);
  });
  const piezaEnCubie = new Map();
  piezas.forEach((pz, k) => piezaEnCubie.set(claveCubie(pz.cubie), k));

  const EJE = { U: 0, D: 0, E: 0, y: 0, R: 1, L: 1, M: 1, x: 1, F: 2, B: 2, S: 2, z: 2 };
  const sop = {
    N,
    /** Eje de una familia de giros (U, R, F...): para detectar redundancias. */
    ejeDe: (fam) => EJE[fam[0]],
    /** Polígonos 2D de la red (para dibujar las piezas pegadas unidas). */
    pegatinas2D: pegatinasRedNxN(N),
    puntos: P,
    nPegatinas: nPeg,
    piezas,
    busqueda,
    centrales,
    mapa,
    enCapa,
    rotaciones,
    /** true si dos piezas (índices) son vecinas: cubies que comparten una cara. */
    adyacentes(a, b) {
      const ca = piezas[a].cubie, cb = piezas[b].cubie;
      let dif = 0, tot = 0;
      for (let i = 0; i < 3; i++) { const d = Math.abs(ca[i] - cb[i]); if (d) { dif++; tot += d; } }
      return dif === 1 && tot === 2;
    },
    /** true si son dos centros opuestos. */
    opuestas(a, b) {
      const A = piezas[a], B = piezas[b];
      if (A.tipo !== 'centro' || B.tipo !== 'centro') return false;
      return A.cubie.every((x, i) => x === -B.cubie[i]);
    },
    /**
     * Identifica las piezas por sus colores: donde[p] = posición actual del
     * punto p (de la pieza resuelta). { donde } o { errores }.
     */
    identificar(estado) {
      const donde = new Int16Array(P);
      const vista = new Set();
      for (const [kc, pts] of porCubie) {
        const k0 = piezaEnCubie.get(kc);
        if (piezas[k0].tipo === 'nucleo') { donde[NUCLEO] = NUCLEO; continue; }
        const cols = pts.map((p) => estado[p]);
        const k = piezaDeColores.get(cols.slice().sort().join(','));
        if (k === undefined) return { errores: [`La pieza en ${piezas[k0].clave} tiene unos colores que no son de ninguna pieza.`] };
        if (vista.has(k)) return { errores: [`La pieza ${piezas[k].clave} aparece dos veces.`] };
        vista.add(k);
        // cada pegatina de la pieza k va a la posición del cubie con su color
        for (const q of piezas[k].puntos) {
          const j = pts.findIndex((p) => estado[p] === colorResuelto[q]);
          if (j < 0) return { errores: [`La pieza ${piezas[k].clave} no encaja.`] };
          donde[q] = pts[j];
        }
      }
      return { donde };
    },
    /** Estado de colores a partir de donde. */
    estadoDesde(donde) {
      const e = new Array(nPeg);
      for (let p = 0; p < nPeg; p++) e[donde[p]] = colorResuelto[p];
      return e;
    },
  };
  cache.set(N, sop);
  return sop;
}

// ---------------------------------------------------------------------------
// Firmas de la comunidad (Bandaged Cube Explorer, Andreas Nortmann)
// ---------------------------------------------------------------------------
//
// Un 3x3 vendado se describe con 54 "uniones" posibles entre cubies vecinos
// (incluido el núcleo); la firma es un número de 54 bits en hexadecimal, con el
// bit más significativo para la unión 0. Orden de las uniones (coordenadas
// (a, b, c): a = capa desde U (0) hasta D (2), b desde B (0) hasta F (2), c desde
// L (0) hasta R (2)), tal y como lo genera paul_cube_bandaged_graph:
//   para cada capa a: (a,0,0)-(a,0,1), (a,0,1)-(a,0,2); para b = 0, 1: las tres
//   uniones de la fila b a la b+1 y las dos de la fila b+1; y, si a < 2, las nueve
//   uniones de la capa a con la a+1.

function unionesFirma() {
  const u = [];
  for (let a = 0; a < 3; a++) {
    u.push([[a, 0, 0], [a, 0, 1]], [[a, 0, 1], [a, 0, 2]]);
    for (let b = 0; b < 2; b++) {
      u.push(
        [[a, b, 0], [a, b + 1, 0]], [[a, b, 1], [a, b + 1, 1]], [[a, b, 2], [a, b + 1, 2]],
        [[a, b + 1, 0], [a, b + 1, 1]], [[a, b + 1, 1], [a, b + 1, 2]],
      );
    }
    if (a < 2) for (let m = 0; m < 9; m++) u.push([[a, Math.floor(m / 3), m % 3], [a + 1, Math.floor(m / 3), m % 3]]);
  }
  return u;
}
const UNIONES = unionesFirma();
// (a, b, c) -> cubie (x = R, y = U, z = F) en pasos de 2
const cubieABC = ([a, b, c]) => [(c - 1) * 2, (1 - a) * 2, (b - 1) * 2].join(',');

/** Firma hexadecimal -> bloques del 3x3 ([[clave, ...]]). Lanza un error si no es válida. */
export function bloquesDesdeFirma(hex) {
  const sop = soporteBloqueosNxN(3);
  const limpio = String(hex).trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]+$/.test(limpio)) throw new Error('La firma debe ser un número hexadecimal (por ejemplo 33EC01800846).');
  const n = BigInt('0x' + limpio);
  if (n >= (1n << 54n)) throw new Error('La firma tiene más de 54 bits.');
  const porCubie = new Map(sop.piezas.map((p) => [p.cubie.join(','), p.clave]));
  const padre = new Map();
  const raiz = (x) => { while (padre.get(x) !== x) x = padre.get(x); return x; };
  for (const c of porCubie.values()) padre.set(c, c);
  UNIONES.forEach((par, i) => {
    if ((n >> BigInt(53 - i)) & 1n) {
      const x = raiz(porCubie.get(cubieABC(par[0]))), y = raiz(porCubie.get(cubieABC(par[1])));
      if (x !== y) padre.set(x, y);
    }
  });
  const grupos = new Map();
  for (const c of porCubie.values()) {
    const r = raiz(c);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(c);
  }
  const orden = sop.piezas.map((p) => p.clave);
  return [...grupos.values()].filter((g) => g.length > 1)
    .map((g) => g.sort((x, y) => orden.indexOf(x) - orden.indexOf(y)));
}

/** Bloques del 3x3 -> firma hexadecimal (todas las uniones entre vecinos de un mismo bloque). */
export function firmaDesdeBloques(bloques) {
  const sop = soporteBloqueosNxN(3);
  const deClave = new Map(sop.piezas.map((p) => [p.clave, p.cubie.join(',')]));
  const bloqueDe = new Map();
  (bloques || []).forEach((g, i) => g.forEach((c) => bloqueDe.set(deClave.get(c), i)));
  let n = 0n;
  UNIONES.forEach((par, i) => {
    const x = bloqueDe.get(cubieABC(par[0])), y = bloqueDe.get(cubieABC(par[1]));
    if (x !== undefined && x === y) n |= 1n << BigInt(53 - i);
  });
  return n.toString(16).toUpperCase();
}
