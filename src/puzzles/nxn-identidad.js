// @ts-check
// Cubos 4x4 y 5x5 vendados: identidad de las piezas iguales (noche 13).
//
// En un 4x4 hay piezas que no se distinguen por sus colores: los cuatro centros de cada
// color (en el 5x5, los centros en X y los centros en cruz). En el 3x3 vendado las piezas
// se deducían de los colores; aquí no se puede: un centro blanco pegado a una wing y otro
// centro blanco suelto son piezas distintas aunque se vean igual. Por eso, DENTRO DEL MODO
// VENDADO, el estado no es de colores sino de identidades:
//
//   estado[posición] = número de la pegatina (0..6·N²−1) que hay en esa posición
//
// (la pegatina i es la que está en la posición i en el cubo resuelto; su color es
// floor(i / N²), así que el dibujo, la vista 3D y "resuelto" salen de los colores de
// siempre). Los giros mueven los números igual que movían los colores. El estado sale
// siempre de giros (scramble, reproducción): pintar un estado a mano está desactivado,
// porque con colores no se puede saber qué centro es cuál (ver DECISIONES.md, noche 13).
//
// soporteBloqueosIdentidad(N) da a la capa genérica (src/core/bloqueos.js) lo que necesita;
// crearCuboConIdentidad(colores, N) es el puzzle base (sin bloques delega en el 4x4/5x5
// normal, convirtiendo a colores).

import { geometriaNxN, analizarMovimiento, CARAS, pegatinasRedNxN, nombreMovimiento, baseNxN } from './nxn.js';
import { cierreGrupo } from '../core/simetria.js';
import { componer, invertir } from '../core/perm.js';
import { definirPuzzle } from '../core/puzzle.js';

/**
 * @import { SoporteBloqueos, PiezaSoporte, EstadoPegatinas, Movimiento, Puzzle, ResultadoResolver, OpcionesRender,
 *   Vista3D, EjemploBloqueos, Identificacion, MapaPuntos } from '../core/tipos.js'
 * @typedef {PiezaSoporte & { cubie: number[] }} PiezaNxN
 */

/** @type {Record<string, number[]>} */
const NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
/** @type {Record<string, number>} */
const EJE = { U: 0, D: 0, y: 0, R: 1, L: 1, x: 1, F: 2, B: 2, z: 2 };
/** @param {number[]} a @param {number[]} b */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Nombre de una pieza a partir de las caras que toca (orden U/D, F/B, R/L), como en el 3x3. @param {string[]} caras */
function nombrePieza(caras) {
  const orden = ['U', 'D', 'F', 'B', 'R', 'L'];
  return caras.slice().sort((a, b) => orden.indexOf(a) - orden.indexOf(b)).join('');
}

// Capa interior sola (N impar ≥ 5): "2U" = la segunda capa desde U (notación SiGN; la WCA no
// la tiene). Hace falta en la búsqueda: con un bloque centro + núcleo + centro, 2U es legal
// aunque U y Uw no lo sean (el bloque cruza la capa 2 sin tener piezas en ella).
const RE_CAPA = /^(\d+)([URFDLB])(2'|2|')?$/;

/**
 * Analiza un giro: los del NxN (cara, ancho, rotación) y las capas interiores "2U".
 * { cara, desde, hasta, veces, rotacion }: capas desde..hasta contando desde esa cara.
 * @param {Movimiento} mov @param {number} N
 * @returns {{ cara: string, desde: number, hasta: number, veces: number, rotacion: boolean }}
 */
export function analizarGiroVendado(mov, N) {
  const c = RE_CAPA.exec(mov);
  if (c) {
    const k = parseInt(c[1], 10);
    if (k < 2 || k > N - 1 || 2 * k === N + 1) throw new Error(`Movimiento no válido: "${mov}"`);
    return { cara: c[2], desde: k, hasta: k, veces: c[3] === "'" ? 3 : c[3] ? 2 : 1, rotacion: false };
  }
  const a = analizarMovimiento(mov, N);
  return { cara: /** @type {string} */ (a.cara), desde: 1, hasta: a.prof, veces: a.veces, rotacion: !!a.rotacion };
}
/** Nombre de una capa interior: "2U", "2U2", "2U'". @param {string} cara @param {number} k @param {number} veces */
const nombreCapa = (cara, k, veces) => `${k}${cara}${veces === 1 ? '' : veces === 2 ? '2' : "'"}`;

/** @type {Map<number, SoporteBloqueos<EstadoPegatinas> & { piezas: PiezaNxN[], todos: Movimiento[] }>} */
const cache = new Map();

/**
 * Soporte de bloqueos de un cubo NxN (N ≥ 4) con el estado de identidades.
 *
 * Piezas (nombres que se ven en la interfaz y en los enlaces):
 *   esquinas  UFR, UFL… (como en el 3x3)
 *   aristas   UF1, UF2… (wings, numeradas a lo largo de la arista en el sentido de +R, +U o +F:
 *             UF1 es la de la izquierda en la cara F) y, en N impar, UF para la arista central
 *   centros   U11, U12… (fila y columna de la pegatina en la red, desde 1) y, en N impar, U
 *             para el centro fijo
 *   núcleo    (N impar) un punto sin pegatina, unido solo a los seis centros fijos
 *
 * Giros de las búsquedas (los demás son equivalentes salvo una rotación del cubo entero, que
 * es libre): N impar, los de cada cara hasta (N−1)/2 capas (centros fijos, como en el 3x3);
 * N par, los de U, R y F de 1 a N−1 capas (la esquina DBL no se mueve: es la referencia).
 * @param {number} N
 */
export function soporteBloqueosIdentidad(N) {
  const enCache = cache.get(N);
  if (enCache) return enCache;
  if (N < 4) throw new Error('soporteBloqueosIdentidad: N ≥ 4 (en el 2x2 y el 3x3 las piezas se distinguen por sus colores)');
  const geo = geometriaNxN(N);
  const n2 = N * N;
  const nPeg = geo.pos.length;
  const impar = N % 2 === 1;
  const P = nPeg + (impar ? 1 : 0);
  const NUCLEO = impar ? nPeg : -1;

  // Cubie de cada punto (coordenadas enteras en pasos de 2)
  /** @type {number[][]} */
  const cubie = geo.pos.map((/** @type {number[]} */ p) => p.map((x) => (Math.abs(x) === N ? Math.sign(x) * (N - 1) : x)));
  if (impar) cubie.push([0, 0, 0]);
  /** @param {number[]} c */
  const claveCubie = (c) => c.join(',');
  /** @type {Map<string, number[]>} */
  const porCubie = new Map();
  cubie.forEach((c, p) => {
    const k = claveCubie(c);
    if (!porCubie.has(k)) porCubie.set(k, []);
    /** @type {number[]} */ (porCubie.get(k)).push(p);
  });

  /** @type {PiezaNxN[]} */
  const piezas = [];
  for (const pts of porCubie.values()) {
    const c = cubie[pts[0]];
    if (pts[0] === NUCLEO) { piezas.push({ clave: 'núcleo', tipo: 'nucleo', puntos: pts, cubie: c }); continue; }
    const caras = pts.map((p) => CARAS[Math.floor(p / n2)]);
    const extremos = c.filter((x) => Math.abs(x) === N - 1).length;
    let tipo, clave;
    if (extremos === 3) { tipo = 'esquina'; clave = nombrePieza(caras); } else if (extremos === 2) {
      const libre = c.findIndex((x) => Math.abs(x) !== N - 1);
      const t = (c[libre] + N - 1) / 2; // 1..N-2 a lo largo de la arista
      if (impar && c[libre] === 0) { tipo = 'arista-central'; clave = nombrePieza(caras); } else { tipo = 'arista'; clave = nombrePieza(caras) + t; }
    } else {
      // centro: una pegatina; fila y columna en la red
      const i = pts[0] % n2;
      const r = Math.floor(i / N), col = i % N;
      const otros = c.filter((x) => Math.abs(x) !== N - 1);
      if (impar && otros.every((x) => x === 0)) { tipo = 'centro'; clave = caras[0]; } else {
        tipo = N % 2 === 0 ? 'centro' : otros.some((x) => x === 0) ? 'centro-t' : 'centro-x';
        clave = `${caras[0]}${r}${col}`;
      }
    }
    piezas.push({ clave, tipo, puntos: pts, cubie: c });
  }
  /** @type {Record<string, number>} */
  const ordenTipo = { esquina: 0, arista: 1, 'arista-central': 2, 'centro-x': 3, 'centro-t': 4, centro: 5, nucleo: 6 };
  piezas.sort((a, b) => ordenTipo[a.tipo] - ordenTipo[b.tipo] || (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));
  if (new Set(piezas.map((p) => p.clave)).size !== piezas.length) throw new Error('nombres de pieza repetidos');

  // Mapas de los giros: mapa[p] = posición nueva del punto p
  /** @type {Map<Movimiento, MapaPuntos>} */
  const mapas = new Map();
  /** @type {Map<Movimiento, Uint8Array>} */
  const capas = new Map();
  /** @param {Movimiento} mov */
  function permDe(mov) {
    const { cara, desde, hasta, veces } = analizarGiroVendado(mov, N);
    let Q = desde === 1 ? geo.cuarto(cara, hasta) : componer(geo.cuarto(cara, hasta), invertir(geo.cuarto(cara, desde - 1)));
    const q = Q;
    for (let i = 1; i < veces; i++) Q = componer(Q, q);
    return /** @type {number[]} */ (Q);
  }
  /** @param {Movimiento} mov */
  function mapa(mov) {
    const hecho = mapas.get(mov);
    if (hecho) return hecho;
    const Pm = permDe(mov); // nuevo[i] = viejo[Pm[i]]: el punto en Pm[i] pasa a i
    const m = new Int16Array(P);
    for (let i = 0; i < nPeg; i++) m[Pm[i]] = i;
    if (impar) m[NUCLEO] = NUCLEO;
    mapas.set(mov, m);
    return m;
  }
  /** Capa que mueve un giro: enCapa[p] = 1 si la pieza en la posición p se mueve. @param {Movimiento} mov */
  function enCapa(mov) {
    const hecha = capas.get(mov);
    if (hecha) return hecha;
    const c = new Uint8Array(P);
    const { cara, desde, hasta, rotacion } = analizarGiroVendado(mov, N);
    if (rotacion) c.fill(1);
    else {
      const a = NORMAL[cara];
      // capas desde..hasta: la capa k tiene la coordenada N + 1 − 2k sobre la normal de la cara
      for (let p = 0; p < P; p++) { const d = dot(cubie[p], a); c[p] = d > N - 1 - 2 * hasta && d <= N + 1 - 2 * desde ? 1 : 0; }
    }
    capas.set(mov, c);
    return c;
  }

  /** @type {Movimiento[]} */
  const busqueda = [];
  const carasBusqueda = impar ? CARAS : ['U', 'R', 'F'];
  const profMax = impar ? (N - 1) / 2 : N - 1;
  for (const cara of carasBusqueda) {
    for (let prof = 1; prof <= profMax; prof++) for (const v of [1, 2, 3]) busqueda.push(nombreMovimiento(cara, prof, v));
    // N impar: también las capas interiores (sin la del medio, que lleva los centros fijos)
    if (impar) for (let k = 2; k <= profMax; k++) for (const v of [1, 2, 3]) busqueda.push(nombreCapa(cara, k, v));
  }
  /** Todos los giros con nombre (para traducir una solución a la orientación del usuario). @type {Movimiento[]} */
  const todos = [];
  for (const cara of CARAS) {
    for (let prof = 1; prof < N; prof++) for (const v of [1, 2, 3]) todos.push(nombreMovimiento(cara, prof, v));
    if (impar) for (let k = 2; k <= profMax; k++) for (const v of [1, 2, 3]) todos.push(nombreCapa(cara, k, v));
  }

  const rotPerms = cierreGrupo([permDe('x'), permDe('y')]);
  const rotaciones = rotPerms.map((/** @type {number[]} */ Pm) => {
    const m = new Int16Array(P);
    for (let i = 0; i < nPeg; i++) m[Pm[i]] = i;
    if (impar) m[NUCLEO] = NUCLEO;
    return m;
  });

  /** Familia de un giro ("3Uw", "U", "x") -> letra de su cara. @param {string} fam */
  const letra = (fam) => fam.replace(/^\d+/, '')[0];

  // Piezas iguales: mismo tipo y mismo color (solo hay centros así; las wings se distinguen por
  // el orden de sus colores). Clases de índices de pieza.
  /** @type {Map<string, number[]>} */
  const clasesIguales = new Map();
  piezas.forEach((pz, k) => {
    if (pz.tipo !== 'centro' && pz.tipo !== 'centro-x' && pz.tipo !== 'centro-t') return;
    if (impar && pz.tipo === 'centro') return; // los centros fijos son únicos
    const kk = pz.tipo + ':' + Math.floor(pz.puntos[0] / n2);
    if (!clasesIguales.has(kk)) clasesIguales.set(kk, []);
    /** @type {number[]} */ (clasesIguales.get(kk)).push(k);
  });
  const iguales = [...clasesIguales.values()];

  /** @type {SoporteBloqueos<EstadoPegatinas> & { piezas: PiezaNxN[], todos: Movimiento[] }} */
  const sop = {
    N,
    ejeDe: (fam) => EJE[letra(fam)],
    pegatinas2D: pegatinasRedNxN(N),
    puntos: P,
    nPegatinas: nPeg,
    piezas,
    busqueda,
    todos,
    iguales,
    mapa,
    enCapa,
    rotaciones,
    /**
     * Piezas vecinas: cubies que comparten una cara. Además, en N impar, el núcleo con los seis
     * centros fijos (están montados sobre él: así se pueden unir centros opuestos a través del
     * núcleo, como en el 3x3). En N par no hay núcleo visible: ver DECISIONES.md, noche 13.
     */
    adyacentes(a, b) {
      const ca = piezas[a].cubie, cb = piezas[b].cubie;
      if (impar) {
        const ta = piezas[a].tipo, tb = piezas[b].tipo;
        if ((ta === 'nucleo' && tb === 'centro') || (tb === 'nucleo' && ta === 'centro')) return true;
      }
      let dif = 0, tot = 0;
      for (let i = 0; i < 3; i++) { const d = Math.abs(ca[i] - cb[i]); if (d) { dif++; tot += d; } }
      return dif === 1 && tot === 2;
    },
    /**
     * Estado de identidades -> donde[p] = posición actual del punto p (el núcleo no se mueve).
     * Comprueba que es una permutación y que cada pieza está entera (sus pegatinas en un mismo cubie).
     */
    identificar(estado) {
      if (!Array.isArray(estado) || estado.length !== nPeg) return { errores: ['El estado no tiene el número de pegatinas de este cubo.'] };
      const donde = new Int16Array(P).fill(-1);
      for (let pos = 0; pos < nPeg; pos++) {
        const id = estado[pos];
        if (!Number.isInteger(id) || id < 0 || id >= nPeg || donde[id] !== -1) return { errores: ['El estado no es una permutación de las pegatinas (¿se ha pintado a mano?).'] };
        donde[id] = pos;
      }
      if (impar) donde[NUCLEO] = NUCLEO;
      for (const pz of piezas) {
        const k0 = claveCubie(cubie[donde[pz.puntos[0]]]);
        if (pz.puntos.some((p) => claveCubie(cubie[donde[p]]) !== k0)) return { errores: [`La pieza ${pz.clave} está rota (sus pegatinas no están juntas).`] };
      }
      return { donde };
    },
    estadoDesde(donde) {
      const e = new Array(nPeg);
      for (let p = 0; p < nPeg; p++) e[donde[p]] = p;
      return e;
    },
    /**
     * Notación: en N par, un giro de N−1 capas (3Uw en el 4x4) es el de la cara opuesta (D)
     * más una rotación del cubo entero (y), que es libre. Se escribe así y los giros siguientes
     * se traducen a la orientación nueva. El estado final es el resuelto girado.
     */
    notacion(movs) {
      if (impar) return movs.slice();
      const id = new Int16Array(P); for (let i = 0; i < P; i++) id[i] = i;
      let C = id, Ci = id; // rotación acumulada (y su inversa)
      /** @type {Movimiento[]} */
      const res = [];
      for (const m of movs) {
        // conjugado: primero C, luego m, luego C⁻¹ (lo que queda del plan es C · m · …)
        const M = mapa(m);
        const X = new Int16Array(P);
        for (let p = 0; p < P; p++) X[p] = Ci[M[C[p]]];
        const nombre = buscarNombre(X);
        const a = analizarGiroVendado(nombre, N);
        if (a.desde !== 1 || a.hasta !== N - 1) { res.push(nombre); continue; }
        // N−1 capas: cara opuesta (1 capa, mismas veces) + rotación Q, con X = O · Q
        /** @type {Record<string, string>} */
        const OPUESTA = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
        const opuesta = OPUESTA[a.cara];
        const o = nombreMovimiento(/** @type {string} */ (opuesta), 1, a.veces);
        const O = mapa(o);
        const Oi = new Int16Array(P); for (let p = 0; p < P; p++) Oi[O[p]] = p;
        const Q = new Int16Array(P); for (let p = 0; p < P; p++) Q[p] = X[Oi[p]];
        res.push(o);
        // C ← Q · C (primero Q, luego C)
        const C2 = new Int16Array(P); for (let p = 0; p < P; p++) C2[p] = C[Q[p]];
        C = C2;
        Ci = new Int16Array(P); for (let p = 0; p < P; p++) Ci[C[p]] = p;
      }
      return res;
    },
  };
  /** @type {Map<string, Movimiento>} */
  const porMapa = new Map();
  for (const m of todos) porMapa.set(Array.from(mapa(m)).join(','), m);
  /** @param {Int16Array} X */
  function buscarNombre(X) {
    const n = porMapa.get(Array.from(X).join(','));
    if (!n) throw new Error('notación: giro sin nombre');
    return n;
  }
  cache.set(N, sop);
  return sop;
}

// ---------------------------------------------------------------------------
// El puzzle base del modo vendado (estado de identidades)
// ---------------------------------------------------------------------------

/**
 * Bloques que "eliminan" cortes del cubo: las piezas a ambos lados de cada corte se pegan por
 * parejas (y se juntan en bloques si comparten pieza). Así se construyen los vendados que simulan
 * cuboides (un 2x4x4 es un 4x4 sin los cortes entre las capas 1–2 y 3–4 de un eje).
 * cortes: [eje, k]: eje 'x' (desde R), 'y' (desde U) o 'z' (desde F); k: entre las capas k y k+1.
 * @param {number} N @param {Array<[string, number]>} cortes
 * @returns {string[][]}
 */
export function bloquesSinCortes(N, cortes) {
  const s = soporteBloqueosIdentidad(N);
  const piezas = /** @type {PiezaNxN[]} */ (s.piezas).filter((p) => p.tipo !== 'nucleo');
  const porCubie = new Map(piezas.map((p) => [p.cubie.join(','), p.clave]));
  /** @type {Map<string, string>} */
  const padre = new Map(piezas.map((p) => [p.clave, p.clave]));
  /** @param {string} x @returns {string} */
  const raiz = (x) => { while (padre.get(x) !== x) x = /** @type {string} */ (padre.get(x)); return x; };
  for (const [eje, k] of cortes) {
    const e = { x: 0, y: 1, z: 2 }[eje];
    if (e === undefined) throw new Error(`eje no válido: ${eje}`);
    const c1 = N + 1 - 2 * k, c2 = N - 1 - 2 * k; // las dos capas a ambos lados del corte
    for (const p of piezas) {
      if (p.cubie[e] !== c1) continue;
      const q = p.cubie.slice(); q[e] = c2;
      const otra = porCubie.get(q.join(','));
      if (otra) { const a = raiz(p.clave), b = raiz(otra); if (a !== b) padre.set(a, b); }
    }
  }
  /** @type {Map<string, string[]>} */
  const grupos = new Map();
  for (const p of piezas) { const r = raiz(p.clave); if (!grupos.has(r)) grupos.set(r, []); /** @type {string[]} */ (grupos.get(r)).push(p.clave); }
  return [...grupos.values()].filter((g) => g.length > 1);
}

/**
 * Configuraciones de ejemplo del 4x4 y el 5x5 (las mismas que la verificación de la noche 13;
 * ver tests/bloqueos.test.mjs y ESTADO.md).
 * @type {Record<number, EjemploBloqueos[]>}
 */
export const EJEMPLOS_NXN = {
  4: [
    { id: 'pareja', nombre: 'Una pareja (esquina UFR + wing UF2)', bloques: [['UFR', 'UF2']] },
    { id: 'barra', nombre: 'Una barra 1x1x4 (UFL + UF1 + UF2 + UFR)', bloques: [['UFL', 'UF1', 'UF2', 'UFR']] },
    { id: 'centros', nombre: 'Los cuatro centros de U unidos', bloques: [['U11', 'U12', 'U21', 'U22']] },
    { id: 'varios', nombre: 'Varios bloques (pareja, barra y centro + wing)', bloques: [['UFR', 'UF2'], ['DBL', 'DB1', 'DB2', 'DBR'], ['F11', 'UF1']] },
  ],
  5: [
    { id: 'pareja', nombre: 'Una pareja (esquina UFR + wing UF3)', bloques: [['UFR', 'UF3']] },
    { id: 'barra', nombre: 'Una barra 1x1x5 (UFL + UF1 + UF + UF3 + UFR)', bloques: [['UFL', 'UF1', 'UF', 'UF3', 'UFR']] },
    { id: 'centros', nombre: 'Los nueve centros de U unidos', bloques: [['U11', 'U12', 'U13', 'U21', 'U', 'U23', 'U31', 'U32', 'U33']] },
    { id: 'opuestos', nombre: 'Centros opuestos U y D unidos por el núcleo', bloques: [['U', 'núcleo', 'D']] },
    { id: 'varios', nombre: 'Varios bloques (pareja, barra y centro + arista)', bloques: [['UFR', 'UF3'], ['DBL', 'DB1', 'DB', 'DB3', 'DBR'], ['F12', 'UF']] },
  ],
};

/**
 * Puzzle base del modo vendado de un NxN (N ≥ 4): el mismo cubo con el estado de identidades.
 * Sin bloques delega en el cubo normal `colores` (crearCuboGrande(N)) pasando a colores.
 * @param {Puzzle<EstadoPegatinas> & { longitudScramble?: number, nombresFase?: unknown }} colores
 * @param {number} N
 */
export function crearCuboConIdentidad(colores, N) {
  const b = baseNxN(N);
  const n2 = N * N;
  const nPeg = 6 * n2;
  /** @type {EstadoPegatinas} */
  const resuelto = Array.from({ length: nPeg }, (_, i) => i);
  /** Colores de un estado de identidades. @param {EstadoPegatinas} e */
  const aColores = (e) => e.map((i) => Math.floor(i / n2));
  /** @param {EstadoPegatinas} e */
  const esIdentidad = (e) => e.length === nPeg && e.some((x) => x >= 6);
  const sop = soporteBloqueosIdentidad(N);
  return definirPuzzle({
    id: `vendado-${N}x${N}`,
    nombre: `${N}x${N}`,
    capacidades: { scramble: true, validar: true, resolver: true, editar: true },
    descripcion: colores.descripcion,
    paleta: colores.paleta,
    estadoResuelto: () => resuelto.slice(),
    /** Con el mapa del soporte (acepta también las capas interiores 2U del 5x5). @param {EstadoPegatinas} e @param {Movimiento} mov */
    aplicarMovimiento(e, mov) {
      const M = sop.mapa(mov);
      const r = e.slice();
      for (let p = 0; p < nPeg; p++) r[M[p]] = e[p];
      return r;
    },
    /** Resuelto = cada cara de un color (los centros iguales pueden estar cambiados entre sí). @param {EstadoPegatinas} e */
    estaResuelto: (e) => b.estaResuelto(aColores(e)),
    /** Los colores del estado (para el dibujo y el editor de bloques). @param {EstadoPegatinas} e */
    colores: (e) => (esIdentidad(e) ? aColores(e) : e.slice()),
    invertirMovimiento: colores.invertirMovimiento,
    /** @param {Movimiento} mov */
    infoMovimiento(mov) {
      const a = analizarGiroVendado(mov, N);
      return { eje: EJE[a.cara], clave: a.desde === 1 ? a.cara : `${a.desde}${a.cara}`, prof: a.hasta };
    },
    buscarRedundancia: colores.buscarRedundancia,
    buscarRedundanciaSolucion: colores.buscarRedundanciaSolucion,
    generarScramble: colores.generarScramble,
    tipoScramble: colores.tipoScramble,
    longitudScramble: colores.longitudScramble,
    inicializar: () => colores.inicializar(),
    estaInicializado: () => colores.estaInicializado(),
    avisoInicializacion: colores.avisoInicializacion,
    /** @param {EstadoPegatinas} e */
    validar(e) {
      const id = sop.identificar(e);
      if (id.errores) return { valido: false, errores: id.errores };
      return /** @type {Required<Puzzle<EstadoPegatinas>>['validar']} */ (colores.validar)(aColores(e));
    },
    /**
     * Sin bloques: el solver del cubo normal sobre los colores (su solución vale para el
     * estado de identidades: deja cada cara de un color).
     * @param {EstadoPegatinas} e
     * @returns {ResultadoResolver}
     */
    resolver(e, opciones = {}) {
      const id = sop.identificar(e);
      if (id.errores) return { ok: false, errores: id.errores };
      return /** @type {Required<Puzzle<EstadoPegatinas>>['resolver']} */ (colores.resolver)(aColores(e), opciones);
    },
    /** @param {EstadoPegatinas} e @param {OpcionesRender} [opciones] */
    renderizar: (e, opciones = {}) => colores.renderizar(opciones.colores || (esIdentidad(e) ? aColores(e) : e), opciones),
    /** @param {EstadoPegatinas} e @returns {Vista3D} */
    vista3D: (e) => /** @type {(e: EstadoPegatinas) => Vista3D} */ (colores.vista3D)(esIdentidad(e) ? aColores(e) : e),
    /** Giro animado: el del cubo normal o, para una capa interior (2U), sus pegatinas. @param {EstadoPegatinas} e @param {Movimiento} mov */
    giro3D(e, mov) {
      const a = analizarGiroVendado(mov, N);
      if (a.desde === 1) return /** @type {Required<Puzzle<EstadoPegatinas>>['giro3D']} */ (colores.giro3D)(e, mov);
      const eje = NORMAL[a.cara], capa = sop.enCapa(mov);
      /** @type {number[]} */
      const pegatinas = [];
      for (let p = 0; p < nPeg; p++) if (capa[p]) pegatinas.push(p);
      return [{ eje: /** @type {[number, number, number]} */ (eje), angulo: a.veces === 1 ? -Math.PI / 2 : a.veces === 2 ? -Math.PI : Math.PI / 2, pegatinas }];
    },
    nombresFase: colores.nombresFase,
    // Pintar un estado a mano no se puede: con colores no se sabe qué centro es cuál
    pegatinasEditables: () => [],
    avisoPintar: `En el ${N}x${N} vendado no se puede pintar un estado: hay centros del mismo color y, con colores, no se sabe cuál es cuál (y los bloques dependen de ello). Mezcla con «Nuevo scramble» o «Cargar scramble».`,
    soporteBloqueos: sop,
    ejemplosBloqueos: EJEMPLOS_NXN[N] || [],
  });
}
