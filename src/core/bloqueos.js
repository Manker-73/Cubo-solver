// @ts-check
// Bloqueos (puzzles "vendados"): capa genérica sobre la interfaz común.
//
// El usuario agrupa piezas que quedan pegadas. Un movimiento es LEGAL solo si,
// para cada bloque, mueve todas sus piezas o ninguna. Esta capa no sabe nada de
// ningún puzzle concreto: lo que necesita lo da el "soporte de bloqueos" del
// puzzle (ver ARQUITECTURA.md, "Bloqueos"; el del NxN está en
// src/puzzles/nxn-bloqueos.js):
//
//   puntos            número de puntos (pegatinas y, si hace falta, puntos sin
//                     pegatina como el núcleo del 3x3)
//   piezas            [{ clave, tipo, puntos }]: puntos de cada pieza resuelta
//   busqueda          giros que usan los scrambles y las búsquedas (en el 3x3, los de cara)
//   mapa(mov)         mapa[p] = posición a la que va el punto en la posición p
//   enCapa(mov)       enCapa[p] = 1 si la pieza en la posición p se mueve
//   rotaciones        mapas de las rotaciones del puzzle entero (son libres)
//   adyacentes(a, b)  regla para validar los bloques (piezas vecinas)
//   identificar(estado) -> { donde } | { errores }   donde[p] = posición del punto p
//   estadoDesde(donde) -> estado del puzzle
//   busquedaRapida    (opcional) búsqueda directa propia del puzzle (3x3: Kociemba con legalidad)
//
// La legalidad DEPENDE DEL ESTADO (los bloques viajan), así que en general no
// hay un grupo: la alcanzabilidad se calcula con búsquedas en el grafo. Lo que sí
// es un grupo es el conjunto de secuencias que salen de la geometría resuelta y
// vuelven a ella (el "grupo de vértice" del grupoide); con él se cuentan los
// estados alcanzables: |estados| = |geometrías| · |grupo de la fase 2|.
// Detalles y demostración en DECISIONES.md.

import { crearCadena, permProducto, permInversa, completarAleatorio } from './schreier.js';
import { crearTablaEstados } from './tabla-estados.js';
import { crearTablasMinkwitz } from './minkwitz.js';

/**
 * Tipos de los contratos (soporte, definición, análisis, puzzle vendado) en ./tipos.d.ts;
 * aquí, los internos (mínimos: es código numérico). Un giro de búsqueda es su índice en mod.movs.
 * @import { SoporteBloqueos, DefinicionBloqueos, InfoBloqueos, Puzzle, PuzzleVendado, Movimiento, Rng, ResultadoResolver,
 *   OpcionesResolver, Fase, Vista3D, OpcionesRender, Identificacion, EstadoPegatinas, ResolverOk } from './tipos.js'
 * @typedef {SoporteBloqueos<unknown>} Soporte
 * @typedef {{ piezas: number[], puntos: number[], clase: number }} Bloque  piezas (índices) y punto seguido de cada una
 * @typedef {{ id: number, rep: Bloque, bloques: number[] }} ClaseBloques  bloques congruentes (misma forma por una rotación)
 * @typedef {ReturnType<typeof crearModeloBloqueos>} ModeloBloqueos
 * @typedef {ReturnType<typeof bfsGeometrias>} Geometrias
 * @typedef {ReturnType<typeof grupoFase2>} GrupoFase2
 * @typedef {NonNullable<ReturnType<typeof bfsEstados>>} BFSEstados
 * @typedef {ReturnType<typeof tablasProyeccion>} Proyecciones
 * @typedef {ReturnType<typeof tablasFase2>} TablasMinkwitz
 * @typedef {{ mod: ModeloBloqueos, info: InfoBloqueos, ok: true, geo: Geometrias, distGeo: Map<string, number>, g2: GrupoFase2,
 *   bfs: BFSEstados | null, proy: Proyecciones | null, mink?: TablasMinkwitz | null, objetivos?: Int16Array[] | null }} Analisis  análisis de una configuración válida
 * @typedef {{ movs: number[], optima?: boolean, metodo: string, ms?: number, fase1?: number, fase2?: number }} SolucionEstrategia
 * @typedef {{ rng?: Rng, limiteGeometrias?: number, limiteEstados?: number, msMinkwitz?: number }} OpcionesAnalisis
 */

export const LIMITES = {
  geometrias: 400000,   // BFS de geometrías (fase 1 de la estrategia B)
  estadosBFS: 2000000,  // BFS completo (scramble uniforme y solución óptima)
  lazosExactos: 300000, // lazos que se criban todos (si hay más, se para tras muchos sin ampliar el grupo)
};

// ---------------------------------------------------------------------------
// Configuración: validar y normalizar la definición de los bloques
// ---------------------------------------------------------------------------

/**
 * Comprueba una definición de bloqueos ([[clave, ...], ...]) contra un soporte.
 * Devuelve { bloques: [[índices de pieza]], errores, avisos }.
 * @param {Soporte} soporte
 * @param {DefinicionBloqueos | null | undefined} definicion
 */
export function comprobarBloqueos(soporte, definicion) {
  const errores = /** @type {string[]} */ ([]), avisos = /** @type {string[]} */ ([]);
  const indice = new Map(soporte.piezas.map((p, i) => [p.clave, i]));
  /** @type {Map<number, number>} */
  const usada = new Map();
  /** @type {number[][]} */
  const bloques = [];
  (definicion || []).forEach((grupo, gi) => {
    const nombre = `El bloque ${gi + 1}`;
    /** @type {number[]} */
    const ks = [];
    for (const c of grupo) {
      const k = indice.get(c);
      if (k === undefined) { errores.push(`${nombre} tiene una pieza que no existe: "${c}".`); return; }
      if (ks.includes(k)) continue;
      if (usada.has(k)) { errores.push(`La pieza ${c} está en dos bloques (${/** @type {number} */ (usada.get(k)) + 1} y ${gi + 1}).`); return; }
      ks.push(k);
    }
    if (ks.length < 2) {
      if (ks.length === 1) avisos.push(`${nombre} solo tiene una pieza (${soporte.piezas[ks[0]].clave}): no bloquea nada y se ignora.`);
      return;
    }
    // Conexo por adyacencias (en el puzzle resuelto)
    const visto = new Set([ks[0]]);
    const cola = [ks[0]];
    while (cola.length) {
      const a = /** @type {number} */ (cola.pop());
      for (const b of ks) if (!visto.has(b) && soporte.adyacentes(a, b)) { visto.add(b); cola.push(b); }
    }
    if (visto.size !== ks.length) {
      const sueltas = ks.filter((k) => !visto.has(k)).map((k) => soporte.piezas[k].clave);
      errores.push(`${nombre} tiene piezas que no son vecinas de las demás en el cubo resuelto (${sueltas.join(', ')}): todas deben estar unidas por caras.`);
      return;
    }
    ks.forEach((k) => usada.set(k, gi));
    bloques.push(ks);
  });
  return { bloques, errores, avisos };
}

/** Texto canónico de una configuración (para cachés, URL y comparar). @param {DefinicionBloqueos | null | undefined} definicion */
export function claveBloqueos(definicion) {
  return (definicion || [])
    .filter((g) => g.length >= 2)
    .map((g) => g.slice().sort().join('.'))
    .sort()
    .join('-');
}

// ---------------------------------------------------------------------------
// Modelo: piezas, bloques, clases, legalidad y geometría
// ---------------------------------------------------------------------------

/** @param {Soporte} soporte @param {DefinicionBloqueos | null | undefined} definicion */
export function crearModeloBloqueos(soporte, definicion) {
  const { bloques: grupos, errores, avisos } = comprobarBloqueos(soporte, definicion);
  const P = soporte.puntos;
  const piezas = soporte.piezas;
  const puntoAPieza = new Int16Array(P).fill(-1);
  piezas.forEach((pz, k) => pz.puntos.forEach((p) => { puntoAPieza[p] = k; }));
  const movs = soporte.busqueda;
  const nM = movs.length;
  const MAPA = movs.map((m) => soporte.mapa(m));
  const CAPA = movs.map((m) => soporte.enCapa(m));
  // "familia" del giro, para no repetir: sin el sufijo (U2 -> U, 3Uw' -> 3Uw, 2U2 -> 2U)
  const caraDe = movs.map((m) => m.replace(/(2'|2|')$/, ''));
  const familias = [...new Set(caraDe)];
  const famIdx = caraDe.map((f) => familias.indexOf(f));
  const ejeFam = familias.map((f) => (soporte.ejeDe ? soporte.ejeDe(f) : f));
  /**
   * Forma canónica de las secuencias: después del giro `ultima` no puede ir otro de
   * la misma cara, ni uno de la cara opuesta con índice menor (U D sí, D U no: conmutan,
   * también con bloques, porque la legalidad de uno no depende del otro). Así nunca
   * sale U U ni U D U.
   */
  /** @param {number} m @param {number} ultima */
  const prohibido = (m, ultima) => ultima >= 0 && (famIdx[m] === famIdx[ultima] ||
    (ejeFam[famIdx[m]] === ejeFam[famIdx[ultima]] && famIdx[m] < famIdx[ultima]));
  /**
   * Redundante de verdad: la misma cara seguida, o la misma cara dos veces en tres giros del
   * mismo eje (U D U). En el 3x3 (dos familias por eje) es lo mismo que "tres del mismo eje";
   * en el 4x4 no: U Uw D no es redundante (noche 13).
   */
  /** @param {number} m @param {number} u1 @param {number} u2 */
  const redundante = (m, u1, u2) => u1 >= 0 && (famIdx[m] === famIdx[u1] ||
    (u2 >= 0 && ejeFam[famIdx[m]] === ejeFam[famIdx[u1]] && famIdx[m] === famIdx[u2]));

  // Puntos fijos de la búsqueda (centros y núcleo del 3x3 con giros de cara)
  const fijo = new Uint8Array(P);
  for (let p = 0; p < P; p++) fijo[p] = MAPA.every((m) => m[p] === p) ? 1 : 0;

  // Clases de bloques congruentes y punto que sigue cada pieza de cada bloque
  const rot = soporte.rotaciones;
  /** @type {Bloque[]} */
  const bloques = [];
  /** @type {ClaseBloques[]} */
  const clases = [];
  for (const ks of grupos) {
    const conj = new Set(ks);
    let asignado = false;
    for (const cl of clases) {
      const rep = cl.rep;
      if (rep.piezas.length !== ks.length) continue;
      for (const Q of rot) {
        const imagen = rep.piezas.map((k, i) => puntoAPieza[Q[rep.puntos[i]]]);
        if (imagen.every((k) => conj.has(k)) && new Set(imagen).size === ks.length) {
          const b = { piezas: imagen, puntos: rep.puntos.map((p) => Q[p]), clase: cl.id };
          cl.bloques.push(bloques.length);
          bloques.push(b);
          asignado = true;
          break;
        }
      }
      if (asignado) break;
    }
    if (!asignado) {
      const b = { piezas: ks.slice(), puntos: ks.map((k) => piezas[k].puntos[0]), clase: clases.length };
      clases.push({ id: clases.length, rep: b, bloques: [bloques.length] });
      bloques.push(b);
    }
  }
  const enBloque = new Int16Array(piezas.length).fill(-1);
  bloques.forEach((b, bi) => b.piezas.forEach((k) => { enBloque[k] = bi; }));

  // Punto seguido de cada pieza: el del bloque (para la geometría) o el de referencia
  const seguido = piezas.map((pz, k) => {
    if (enBloque[k] < 0) return pz.puntos[0];
    const b = bloques[enBloque[k]];
    return b.puntos[b.piezas.indexOf(k)];
  });
  // Piezas que se mueven con los giros de búsqueda: forman el estado S
  /** @type {number[]} */
  const moviles = [];
  piezas.forEach((pz, k) => { if (!fijo[seguido[k]]) moviles.push(k); });
  const idxMovil = new Int16Array(piezas.length).fill(-1);
  moviles.forEach((k, i) => { idxMovil[k] = i; });
  const nS = moviles.length;

  // Ranuras de los bloques (bloque a bloque, pieza a pieza): índice en S o -1 (fija)
  const ranuraS = /** @type {number[]} */ ([]), ranuraFija = /** @type {number[]} */ ([]);
  /** @type {number[]} */
  const inicioBloque = [];
  for (const b of bloques) {
    inicioBloque.push(ranuraS.length);
    b.piezas.forEach((k, i) => {
      ranuraS.push(idxMovil[k]);
      ranuraFija.push(b.puntos[i]);
    });
  }
  inicioBloque.push(ranuraS.length);
  const nR = ranuraS.length;

  // Posiciones de todos los puntos de una pieza móvil según la posición del punto seguido
  const puntosDe = moviles.map((k) => {
    const pts = piezas[k].puntos;
    const iSeg = pts.indexOf(seguido[k]);
    /** @type {Map<number, Int16Array>} */
    const mapa = new Map();
    const ini = Int16Array.from(pts);
    mapa.set(ini[iSeg], ini);
    const cola = [ini];
    while (cola.length) {
      const t = /** @type {Int16Array} */ (cola.pop());
      for (const M of MAPA) {
        const u = t.map((p) => M[p]);
        if (!mapa.has(u[iSeg])) { mapa.set(u[iSeg], u); cola.push(u); }
      }
    }
    return mapa;
  });
  // Códigos de posición (para empaquetar estados): órbita del punto seguido
  const codigo = puntosDe.map((mp) => { /** @type {Map<number, number>} */ const m = new Map(); [...mp.keys()].sort((a, b) => a - b).forEach((p, i) => m.set(p, i)); return m; });
  const posDeCodigo = codigo.map((m) => { /** @type {number[]} */ const a = []; for (const [p, c] of m) a[c] = p; return a; });
  const bits = codigo.map((m) => Math.max(1, Math.ceil(Math.log2(m.size))));
  const codigoArr = codigo.map((m) => { const a = new Int16Array(P).fill(0); for (const [p, c] of m) a[p] = c; return a; });
  const totalBits = bits.reduce((a, b) => a + b, 0);
  const palabras = Math.max(1, Math.ceil(totalBits / 32));

  const resuelto = new Int16Array(nS);
  moviles.forEach((k, i) => { resuelto[i] = seguido[k]; });

  // ----- estados S (Int16Array: posición del punto seguido de cada pieza móvil) -----
  /** @param {Int16Array} S @param {number} m */
  function aplicar(S, m) {
    const M = MAPA[m];
    const r = new Int16Array(nS);
    for (let i = 0; i < nS; i++) r[i] = M[S[i]];
    return r;
  }
  /** @param {Int16Array} S @param {number} m @param {Int16Array} r */
  function aplicarEn(S, m, r) {
    const M = MAPA[m];
    for (let i = 0; i < nS; i++) r[i] = M[S[i]];
    return r;
  }
  /** Posición de la ranura j de los bloques en el estado S. */
  /** @type {(S: Int16Array, j: number) => number} */
  const posRanura = (S, j) => (ranuraS[j] >= 0 ? S[ranuraS[j]] : ranuraFija[j]);
  /** @param {Int16Array} S @param {number} m */
  function legal(S, m) {
    const C = CAPA[m];
    for (let b = 0; b < bloques.length; b++) {
      const a = inicioBloque[b], z = inicioBloque[b + 1];
      const v = C[posRanura(S, a)];
      for (let j = a + 1; j < z; j++) if (C[posRanura(S, j)] !== v) return false;
    }
    return true;
  }
  /** @param {Int16Array} S */
  function esResuelto(S) {
    for (let i = 0; i < nS; i++) if (S[i] !== resuelto[i]) return false;
    return true;
  }
  // Piezas iguales (4x4, 5x5: centros del mismo color): clase de cada pieza móvil y las
  // posiciones de su clase en el resuelto. "Resuelto por colores": cada pieza en su sitio o
  // en el de otra igual (en un estado alcanzable los bloques están enteros, así que basta).
  const claseMovil = new Int16Array(nS).fill(-1);
  /** @type {Set<number>[]} */
  const casasClase = [];
  (soporte.iguales || []).forEach((cl, c) => {
    casasClase.push(new Set());
    for (const k of cl) {
      const i = idxMovil[k];
      if (i < 0) continue;
      claseMovil[i] = c;
      casasClase[c].add(resuelto[i]);
    }
  });
  const hayIguales = casasClase.length > 0;
  // Bloques con piezas iguales: además de los colores, tienen que ocupar las mismas posiciones que
  // en el resuelto (un bloque centro fijo + centros iguales girado en su sitio tiene los mismos
  // colores, pero otro pegado). Conjunto de posiciones de cada bloque en el resuelto.
  const bloquesIguales = hayIguales ? bloques.map((b, bi) => bi).filter((bi) => bloques[bi].piezas.some((k) => idxMovil[k] >= 0 && claseMovil[idxMovil[k]] >= 0)) : [];
  /** @param {Int16Array} S @param {number} bi */
  const posicionesBloque = (S, bi) => { const r = []; for (let j = inicioBloque[bi]; j < inicioBloque[bi + 1]; j++) r.push(posRanura(S, j)); return r.sort((a, b) => a - b).join(','); };
  const pegadoResuelto = new Set(bloquesIguales.map((bi) => posicionesBloque(resuelto, bi)));
  /** @param {Int16Array} S */
  function resueltoColores(S) {
    for (let i = 0; i < nS; i++) {
      if (S[i] === resuelto[i]) continue;
      const c = claseMovil[i];
      if (c < 0 || !casasClase[c].has(S[i])) return false;
    }
    for (const bi of bloquesIguales) if (!pegadoResuelto.has(posicionesBloque(S, bi))) return false;
    return true;
  }
  /** Resuelto a la vista: exacto o, con piezas iguales, por colores. @param {Int16Array} S */
  const pareceResuelto = (S) => (hayIguales ? resueltoColores(S) : esResuelto(S));

  // ----- geometría -----
  // G: posiciones de las ranuras (bloque a bloque); canónica = bloques de la misma
  // clase ordenados, porque bloques de la misma forma no se distinguen.
  const clasesMultiples = clases.filter((c) => c.bloques.length > 1);
  /** @param {Int16Array} G */
  function canonica(G) {
    for (const cl of clasesMultiples) {
      const tuplas = cl.bloques.map((b) => Array.from(G.subarray(inicioBloque[b], inicioBloque[b + 1])));
      tuplas.sort((x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
      cl.bloques.forEach((b, i) => G.set(tuplas[i], inicioBloque[b]));
    }
    return G;
  }
  /** @param {Int16Array} S */
  function geometriaDe(S) {
    const G = new Int16Array(nR);
    for (let j = 0; j < nR; j++) G[j] = posRanura(S, j);
    return canonica(G);
  }
  /** @param {Int16Array} G @returns {string} */
  const claveG = (G) => String.fromCharCode.apply(null, /** @type {number[]} */ (/** @type {unknown} */ (G)));
  /** @param {Int16Array} G @param {number} m */
  function legalG(G, m) {
    const C = CAPA[m];
    for (let b = 0; b < bloques.length; b++) {
      const a = inicioBloque[b], z = inicioBloque[b + 1];
      const v = C[G[a]];
      for (let j = a + 1; j < z; j++) if (C[G[j]] !== v) return false;
    }
    return true;
  }
  /** @param {Int16Array} G @param {number} m */
  function aplicarG(G, m) {
    const M = MAPA[m];
    const r = new Int16Array(nR);
    for (let j = 0; j < nR; j++) r[j] = M[G[j]];
    return canonica(r);
  }

  // ----- conversión con el estado del puzzle -----
  /** donde (todas las posiciones) -> S */
  /** @param {ArrayLike<number>} donde */
  const SDesdeDonde = (donde) => { const S = new Int16Array(nS); moviles.forEach((k, i) => { S[i] = donde[seguido[k]]; }); return S; };
  /** @param {Int16Array} S */
  function dondeDesdeS(S) {
    const donde = new Int16Array(P);
    for (let p = 0; p < P; p++) donde[p] = p; // fijas
    moviles.forEach((k, i) => {
      const pos = /** @type {Int16Array} */ (puntosDe[i].get(S[i]));
      piezas[k].puntos.forEach((p, j) => { donde[p] = pos[j]; });
    });
    return donde;
  }
  /** @param {Int16Array} S @param {Uint32Array} destino */
  function empaquetar(S, destino) {
    destino.fill(0);
    let w = 0, b = 0;
    for (let i = 0; i < nS; i++) {
      let c = /** @type {number} */ (codigo[i].get(S[i]));
      let nb = bits[i];
      while (nb > 0) {
        const cabe = Math.min(nb, 32 - b);
        destino[w] = (destino[w] | ((c & ((1 << cabe) - 1)) << b)) >>> 0;
        c >>>= cabe; nb -= cabe; b += cabe;
        if (b === 32) { b = 0; w++; }
      }
    }
    return destino;
  }
  /** @param {Uint32Array} k */
  function desempaquetar(k) {
    const S = new Int16Array(nS);
    let w = 0, b = 0;
    for (let i = 0; i < nS; i++) {
      let c = 0, nb = bits[i], sh = 0;
      while (nb > 0) {
        const cabe = Math.min(nb, 32 - b);
        c |= ((k[w] >>> b) & ((1 << cabe) - 1)) << sh;
        sh += cabe; nb -= cabe; b += cabe;
        if (b === 32) { b = 0; w++; }
      }
      S[i] = posDeCodigo[i][c];
    }
    return S;
  }

  // ----- palabras -----
  const vecesMov = movs.map((n) => (n.endsWith("'") ? 3 : n.endsWith('2') ? 2 : 1));
  /** @type {Map<string, number[]>} */
  const porFamilia = new Map();
  movs.forEach((n, i) => { if (!porFamilia.has(caraDe[i])) porFamilia.set(caraDe[i], [-1, -1, -1, -1]); /** @type {number[]} */ (porFamilia.get(caraDe[i]))[vecesMov[i]] = i; });
  const inversoMov = movs.map((n, i) => /** @type {number[]} */ (porFamilia.get(caraDe[i]))[(4 - vecesMov[i]) % 4]);
  /**
   * Simplifica una palabra sin cambiar lo que hace ni su legalidad: un giro se une al de su misma
   * cara del tramo final de giros del mismo eje (conmutan; U U' desaparece, U U = U2). Los giros
   * del mismo eje no cambian qué planos de ese eje cortan los bloques, así que la legalidad de
   * cada giro no depende de su orden dentro del tramo.
   * @param {number[]} w
   */
  function reducirPalabra(w) {
    /** @type {number[]} */
    const r = [];
    for (const m of w) {
      let j = r.length - 1;
      while (j >= 0 && ejeFam[famIdx[r[j]]] === ejeFam[famIdx[m]] && famIdx[r[j]] !== famIdx[m]) j--;
      if (j >= 0 && famIdx[r[j]] === famIdx[m]) {
        const v = (vecesMov[r[j]] + vecesMov[m]) % 4;
        if (v === 0) r.splice(j, 1); else r[j] = /** @type {number[]} */ (porFamilia.get(caraDe[m]))[v];
      } else r.push(m);
    }
    return r;
  }

  return {
    soporte, errores, avisos, bloques, clases, piezas, movs, nM, caraDe, prohibido, redundante, MAPA, CAPA, fijo,
    inversoMov, reducirPalabra,
    moviles, nS, resuelto, palabras, codigos: codigo, codigoArr, puntoAPieza, seguido, enBloque, idxMovil,
    hayIguales, claseMovil, casasClase, resueltoColores, pareceResuelto,
    aplicar, aplicarEn, legal, esResuelto, geometriaDe, claveG, legalG, aplicarG, canonica,
    SDesdeDonde, dondeDesdeS, empaquetar, desempaquetar,
  };
}

// ---------------------------------------------------------------------------
// Análisis: geometrías (BFS), grupo de la fase 2, conteo, BFS completo
// ---------------------------------------------------------------------------

const ahora = () => (globalThis.performance || Date).now();

/** BFS sobre las geometrías desde la resuelta. @param {ModeloBloqueos} mod @param {number} limite */
function bfsGeometrias(mod, limite) {
  const G0 = mod.geometriaDe(mod.resuelto);
  const nodos = [{ G: G0, d: 0, padre: -1, mov: -1 }];
  const indice = new Map([[mod.claveG(G0), 0]]);
  /** @type {number[]} */
  const aristas = []; // [u, m, v] que no son del árbol
  let completo = true;
  for (let i = 0; i < nodos.length; i++) {
    const { G, d } = nodos[i];
    for (let m = 0; m < mod.nM; m++) {
      if (!mod.legalG(G, m)) continue;
      const H = mod.aplicarG(G, m);
      const k = mod.claveG(H);
      const j = indice.get(k);
      if (j === undefined) {
        if (nodos.length >= limite) { completo = false; continue; }
        indice.set(k, nodos.length);
        nodos.push({ G: H, d: d + 1, padre: i, mov: m });
      } else if (!(nodos[j].padre === i && nodos[j].mov === m)) {
        aristas.push(i, m, j);
      }
    }
  }
  let diametro = 0;
  for (const n of nodos) diametro = Math.max(diametro, n.d);
  return { nodos, indice, aristas, completo, diametro };
}

/**
 * Grupo de la fase 2 (lazos en la geometría resuelta): se genera con los
 * lazos camino(u) · m · camino(v)⁻¹ de las aristas que no son del árbol del BFS.
 * @param {ModeloBloqueos} mod
 * @param {Geometrias} geo
 * @param {Rng} rng
 */
function grupoFase2(mod, geo, rng) {
  const P = mod.soporte.puntos;
  const MAPA = mod.MAPA;
  const nodos = geo.nodos;
  // mapa del camino del árbol de cada geometría (puntos)
  /** @type {Int16Array[]} */
  const camino = new Array(nodos.length);
  const id = new Int16Array(P); for (let i = 0; i < P; i++) id[i] = i;
  camino[0] = id;
  for (let i = 1; i < nodos.length; i++) camino[i] = permProducto(camino[nodos[i].padre], MAPA[nodos[i].mov]);
  const nA = geo.aristas.length / 3;
  if (mod.hayIguales) return grupoFase2Aleatorio(mod, geo, rng, camino);
  const cadena = crearCadena(P);
  let orden = [...Array(nA).keys()];
  let exacto = true;
  if (nA > LIMITES.lazosExactos) {
    // demasiados lazos: en orden aleatorio, hasta que muchos seguidos no amplíen el grupo
    exacto = false;
    for (let i = nA - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = orden[i]; orden[i] = orden[j]; orden[j] = t; }
  }
  let sinAmpliar = 0, usados = 0;
  for (const a of orden) {
    const u = geo.aristas[3 * a], m = geo.aristas[3 * a + 1], v = geo.aristas[3 * a + 2];
    const lazo = permProducto(permProducto(camino[u], MAPA[m]), permInversa(camino[v]));
    usados++;
    if (cadena.incluir(lazo)) sinAmpliar = 0; else sinAmpliar++;
    if (!exacto && sinAmpliar >= 2000) break;
  }
  if (!exacto && usados === nA) exacto = true;
  return { cadena, camino, orden: cadena.orden(), exacto: exacto && geo.completo, aleatorio: false, prefijo: 0, libres: /** @type {number[]} */ ([]) };
}

/**
 * Grupo de la fase 2 con piezas iguales (4x4, 5x5; noche 13). Dos cambios respecto al 3x3:
 *  - Schreier–Sims aleatorio: el determinista tardaba 10–16 s en el 5x5. Se incluyen los lazos y
 *    luego elementos al azar del grupo hasta que 50 seguidos no lo amplían: el orden es exacto
 *    salvo con probabilidad ≤ 2⁻⁵⁰ (contrastado con el determinista y con el BFS en los tests).
 *  - La base empieza por todos los puntos que no son de piezas iguales sueltas (prefijo): los
 *    niveles siguientes son el subgrupo que solo mueve esas piezas, el que hace falta para contar
 *    los estados distinguibles (contarDistinguibles).
 * @param {ModeloBloqueos} mod
 * @param {Geometrias} geo
 * @param {Rng} rng
 * @param {Int16Array[]} camino
 */
function grupoFase2Aleatorio(mod, geo, rng, camino) {
  const sop = mod.soporte;
  const P = sop.puntos;
  // puntos de las piezas iguales que no están en ningún bloque ("libres")
  const libre = new Uint8Array(P);
  for (const cl of sop.iguales || []) for (const k of cl) if (mod.enBloque[k] < 0) for (const p of sop.piezas[k].puntos) libre[p] = 1;
  const prefijo = /** @type {number[]} */ ([]), libres = /** @type {number[]} */ ([]);
  for (let p = 0; p < P; p++) (libre[p] ? libres : prefijo).push(p);
  const cadena = crearCadena(P, { prefijo, sinSchreier: true });
  const nA = geo.aristas.length / 3;
  /** @param {number} a */
  const lazo = (a) => {
    const u = geo.aristas[3 * a], m = geo.aristas[3 * a + 1], v = geo.aristas[3 * a + 2];
    return permProducto(permProducto(camino[u], mod.MAPA[m]), permInversa(camino[v]));
  };
  // Lazos del más corto al más largo hasta que 3.000 seguidos no amplían el grupo (con pocas
  // geometrías, todos); luego elementos al azar del grupo hasta que 50 seguidos no lo amplían, y
  // por último 5.000 lazos más al azar tienen que estar todos dentro (si no, se sigue con ellos).
  const lon = (/** @type {number} */ a) => geo.nodos[geo.aristas[3 * a]].d + geo.nodos[geo.aristas[3 * a + 2]].d;
  const orden = [...Array(nA).keys()].sort((a, b) => lon(a) - lon(b));
  let usados = 0, seguidos = 0;
  for (; usados < nA && seguidos < 3000; usados++) { if (cadena.incluir(lazo(orden[usados]))) seguidos = 0; else seguidos++; }
  let azar = completarAleatorio(cadena, [], rng, { seguidas: 50 });
  let comprobados = 0;
  for (let vuelta = 0; usados < nA && vuelta < 10; vuelta++) {
    let amplia = false;
    for (let i = 0; i < 5000; i++) {
      const a = orden[usados + Math.floor(rng() * (nA - usados))];
      comprobados++;
      if (cadena.incluir(lazo(a))) amplia = true;
    }
    if (!amplia) break;
    azar += completarAleatorio(cadena, [], rng, { seguidas: 50 });
  }
  return { cadena, camino, orden: cadena.orden(), exacto: geo.completo, aleatorio: true, azar, lazosUsados: usados, lazosComprobados: comprobados, prefijo: prefijo.length, libres };
}

// ---------------------------------------------------------------------------
// Piezas iguales: estados distinguibles (noche 13; DECISIONES.md lo demuestra)
// ---------------------------------------------------------------------------
//
// Con centros iguales, dos estados (con identidades) se ven igual si se pasa de uno a otro
// cambiando entre sí piezas iguales sin cambiar qué posiciones están pegadas. Sea K el
// conjunto de esos reetiquetados h con los que el resuelto (reetiquetado) sigue siendo
// alcanzable. K es un grupo, y cada estado alcanzable tiene exactamente |K| versiones
// alcanzables con su mismo aspecto, así que  distinguibles = estados / |K|.
// |K| = |K libres| · n_bloq:
//   K libres: elementos del grupo de la fase 2 que solo mueven piezas iguales sueltas (Gc, los
//     niveles tras el prefijo de la base) y que conservan los colores: |Gc| / |órbita de la
//     coloración|. Si Gc contiene el alternado de cada una de sus órbitas (se comprueba con su
//     orden) y en cada órbita se repite algún color, la órbita es "todas las colocaciones con
//     los mismos colores en cada órbita" (un multinomial por órbita).
//   n_bloq: reetiquetados de las piezas iguales que están en bloques (cada bloque, por una
//     rotación rígida, sobre otro de la misma forma y colores) con los que el resuelto es
//     alcanzable salvo un reetiquetado de las libres: se enumeran y se comprueban uno a uno.

/** n! como BigInt. @param {number} n */
const factorial = (n) => { let f = 1n; for (let i = 2; i <= n; i++) f *= BigInt(i); return f; };

/**
 * @param {ModeloBloqueos} mod
 * @param {Geometrias} geo
 * @param {GrupoFase2} g2
 * @param {Rng} rng
 * @returns {{ K: bigint, exacto: boolean, Klibres: bigint, nBloq: number, detalle: string }}
 */
function contarSimetriaIguales(mod, geo, g2, rng) {
  const sop = mod.soporte;
  const P = sop.puntos;
  const niv = g2.cadena.niveles;
  let exacto = true;
  /** @type {string[]} */
  const detalle = [];
  // clase de cada punto de pieza igual
  const clasePunto = new Int16Array(P).fill(-1);
  (sop.iguales || []).forEach((cl, c) => cl.forEach((k) => sop.piezas[k].puntos.forEach((p) => { clasePunto[p] = c; })));

  // ---- K libres ----
  let Gc = 1n;
  for (let k = g2.prefijo; k < niv.length; k++) Gc *= BigInt(niv[k].rep.size);
  const gensGc = niv.length > g2.prefijo ? niv[g2.prefijo].gens : [];
  // órbitas de Gc (sobre los puntos libres)
  const padre = new Int16Array(P); for (let i = 0; i < P; i++) padre[i] = i;
  /** @param {number} x @returns {number} */
  const raiz = (x) => { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; };
  for (const g of gensGc) for (let p = 0; p < P; p++) { const a = raiz(p), b = raiz(g[p]); if (a !== b) padre[a] = b; }
  /** @type {Map<number, number[]>} */
  const orbitas = new Map();
  for (const p of g2.libres) { const r = raiz(p); if (!orbitas.has(r)) orbitas.set(r, []); /** @type {number[]} */ (orbitas.get(r)).push(p); }
  let orbitaColores = 1n;
  for (const O of orbitas.values()) {
    /** @type {Map<number, number>} */
    const cuenta = new Map();
    for (const p of O) cuenta.set(clasePunto[p], (cuenta.get(clasePunto[p]) || 0) + 1);
    let multinomial = factorial(O.length);
    for (const c of cuenta.values()) multinomial /= factorial(c);
    if (O.length > 1 && multinomial > 1n) {
      // ¿Gc contiene el alternado de O? Subgrupo que fija todos los demás puntos libres
      const enO = new Set(O);
      const cad = crearCadena(P, { prefijo: g2.libres.filter((p) => !enO.has(p)), sinSchreier: true });
      completarAleatorio(cad, gensGc, rng, { seguidas: 40 });
      let orden = 1n;
      for (let k = g2.libres.length - O.length; k < cad.niveles.length; k++) orden *= BigInt(cad.niveles[k].rep.size);
      const fO = factorial(O.length);
      const conAlternado = orden * 2n >= fO;
      const repite = [...cuenta.values()].some((c) => c >= 2);
      if (!(conAlternado && (repite || orden === fO))) {
        exacto = false;
        detalle.push(`órbita de ${O.length} sin el alternado (${orden} de ${fO})`);
      }
    }
    orbitaColores *= multinomial;
  }
  let Klibres = Gc / orbitaColores;
  if (Klibres * orbitaColores !== Gc) { exacto = false; Klibres = Klibres || 1n; detalle.push('|Gc| no es múltiplo de la órbita'); }

  // ---- n_bloq: reetiquetados de las piezas iguales que están en bloques ----
  const bloquesConIguales = mod.bloques.map((b, bi) => bi).filter((bi) => mod.bloques[bi].piezas.some((k) => clasePunto[sop.piezas[k].puntos[0]] >= 0));
  let nBloq = 1;
  if (bloquesConIguales.length) {
    // candidatos de cada bloque: (bloque destino, reetiquetado de piezas) por una rotación rígida
    const puntosBloque = mod.bloques.map((b) => b.piezas.flatMap((k) => sop.piezas[k].puntos));
    /** @type {Array<Array<{ destino: number, h: Map<number, number> }>>} */
    const candidatos = bloquesConIguales.map((bi) => {
      /** @type {Array<{ destino: number, h: Map<number, number> }>} */
      const lista = [];
      const vistos = new Set();
      for (const Q of sop.rotaciones) {
        let destino = -1, ok = true;
        /** @type {Map<number, number>} */
        const h = new Map();
        for (const p of puntosBloque[bi]) {
          const k = mod.puntoAPieza[p], k2 = mod.puntoAPieza[Q[p]];
          if (k2 < 0 || mod.enBloque[k2] < 0) { ok = false; break; }
          if (destino < 0) destino = mod.enBloque[k2]; else if (mod.enBloque[k2] !== destino) { ok = false; break; }
          const iguales = k === k2 || (clasePunto[p] >= 0 && clasePunto[p] === clasePunto[Q[p]]);
          if (!iguales) { ok = false; break; }
          h.set(k, k2);
        }
        if (!ok || puntosBloque[destino].length !== puntosBloque[bi].length) continue;
        const clave = destino + ':' + [...h].join(';');
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        lista.push({ destino, h });
      }
      return lista;
    });
    const total = candidatos.reduce((a, l) => a * l.length, 1);
    if (total > 200000) { exacto = false; detalle.push(`${total} reetiquetados de bloques: no se enumeran`); } else {
      nBloq = 0;
      const ident = new Int16Array(P); for (let p = 0; p < P; p++) ident[p] = p;
      /** @param {number} i @param {Set<number>} usados @param {Map<number, number>} h */
      const recorrer = (i, usados, h) => {
        if (i === candidatos.length) { if (resueltoReetiquetadoAlcanzable(h)) nBloq++; return; }
        for (const c of candidatos[i]) {
          if (usados.has(c.destino)) continue;
          usados.add(c.destino);
          const h2 = new Map(h); for (const [a, b] of c.h) h2.set(a, b);
          recorrer(i + 1, usados, h2);
          usados.delete(c.destino);
        }
      };
      /** ¿El resuelto con las piezas reetiquetadas por h (k -> k2: k va al sitio de k2) es alcanzable salvo las libres? @param {Map<number, number>} h */
      const resueltoReetiquetadoAlcanzable = (h) => {
        const donde = ident.slice();
        for (const [k, k2] of h) sop.piezas[k].puntos.forEach((p, j) => { donde[p] = sop.piezas[k2].puntos[j]; });
        const S = mod.SDesdeDonde(donde);
        const gi = geo.indice.get(mod.claveG(mod.geometriaDe(S)));
        if (gi === undefined) return false;
        // transportar a la geometría resuelta y cribar por los niveles del prefijo
        const cam = g2.camino[gi];
        const inv = new Int16Array(P); cam.forEach((x, i2) => { inv[x] = i2; });
        let x = new Int16Array(P);
        for (let p = 0; p < P; p++) x[p] = inv[donde[p]];
        for (let k = 0; k < g2.prefijo; k++) {
          const t = niv[k].inv.get(x[niv[k].punto]);
          if (!t) return false;
          x = permProducto(x, t);
        }
        // el resto solo mueve puntos libres: vale si cada órbita de Gc conserva sus colores
        const xi = permInversa(x);
        for (const O of orbitas.values()) {
          /** @type {Map<number, number>} */
          const c = new Map();
          for (const p of O) { c.set(clasePunto[p], (c.get(clasePunto[p]) || 0) + 1); const q = xi[p]; c.set(clasePunto[q], (c.get(clasePunto[q]) || 0) - 1); }
          for (const v of c.values()) if (v !== 0) return false;
        }
        for (const p of g2.libres) if (!orbitas.has(raiz(p)) && x[p] !== p) return false;
        return true;
      };
      recorrer(0, new Set(), new Map());
      if (nBloq === 0) { exacto = false; nBloq = 1; detalle.push('el resuelto no salió alcanzable (error interno)'); }
    }
  }
  const K = Klibres * BigInt(nBloq);
  detalle.unshift(`|Gc| = ${Gc}, órbita de colores = ${orbitaColores}, n_bloq = ${nBloq}`);
  return { K, exacto: exacto && g2.exacto, Klibres, nBloq, detalle: detalle.join('; ') };
}

/** BFS completo de los estados (solo si caben). @param {ModeloBloqueos} mod @param {number} limite */
function bfsEstados(mod, limite) {
  const tabla = crearTablaEstados(mod.palabras, 1 << 12);
  const k = new Uint32Array(mod.palabras);
  tabla.insertar(mod.empaquetar(mod.resuelto, k), 0);
  const tmp = new Int16Array(mod.nS);
  let d = 0, frontera = /** @type {Int16Array[]} */ ([mod.resuelto]);
  while (frontera.length) {
    /** @type {Int16Array[]} */
    const sig = [];
    for (const S of frontera) {
      for (let m = 0; m < mod.nM; m++) {
        if (!mod.legal(S, m)) continue;
        mod.aplicarEn(S, m, tmp);
        if (tabla.insertar(mod.empaquetar(tmp, k), d + 1)) {
          if (tabla.tamano > limite) return null;
          sig.push(Int16Array.from(tmp));
        }
      }
    }
    frontera = sig;
    d++;
  }
  return { tabla, diametro: d - 1 };
}

/** 1234567 -> "1.234.567" (también números grandes como texto o BigInt). @param {number | string | bigint} n */
export function formatearNumero(n) {
  const s = BigInt(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ---------------------------------------------------------------------------
// Búsquedas
// ---------------------------------------------------------------------------

/** Tablas de poda por proyecciones (grupos de ≤ 4 piezas móviles), respetando la legalidad. @param {ModeloBloqueos} mod */
function tablasProyeccion(mod, msMax = 4000) {
  const t0 = ahora();
  // grupos de piezas: por tipo, de 4 en 4 (o menos)
  /** @type {Map<string, number[]>} */
  const porTipo = new Map();
  mod.moviles.forEach((k, i) => {
    const t = mod.piezas[k].tipo;
    if (!porTipo.has(t)) porTipo.set(t, []);
    /** @type {number[]} */ (porTipo.get(t)).push(i);
  });
  /** @type {number[][]} */
  const grupos = [];
  for (const lista of porTipo.values()) for (let i = 0; i < lista.length; i += 4) grupos.push(lista.slice(i, i + 4));
  /** @type {Array<{ g: number[], dist: Int8Array, R: number[], cod: Int16Array[] }>} */
  const tablas = [];
  for (const g of grupos) {
    if (ahora() - t0 > msMax) break;
    const R = g.map((i) => mod.codigos[i].size);
    const total = R.reduce((a, b) => a * b, 1);
    if (total > 12e6) continue;
    const dist = new Int8Array(total).fill(-1);
    const cod = g.map((i) => mod.codigoArr[i]);
    /** @param {ArrayLike<number>} pos */
    const idx = (pos) => { let x = 0; for (let j = 0; j < g.length; j++) x = x * R[j] + cod[j][pos[j]]; return x; };
    // estado proyectado: posiciones de las piezas del grupo; legalidad relajada:
    // un bloque es un problema solo si sus piezas conocidas (del grupo o fijas) se separan
    const conocidas = new Set(g);
    /** @typedef {{ fija?: number, i?: number }} RanuraRel  posición fija o índice en el grupo */
    const bloquesRel = mod.bloques.map((b) => /** @type {RanuraRel[]} */ (b.piezas.map((k, j) => {
      const i = mod.moviles.indexOf(k);
      if (i < 0) return { fija: b.puntos[j] };
      return conocidas.has(i) ? { i: g.indexOf(i) } : null;
    }).filter(Boolean))).filter((x) => x.length >= 2);
    /** @param {number[]} pos @param {number} m */
    const legalRel = (pos, m) => {
      const C = mod.CAPA[m];
      for (const b of bloquesRel) {
        // (una ranura tiene fija o i: ver arriba)
        const v = C[b[0].fija !== undefined ? b[0].fija : pos[/** @type {number} */ (b[0].i)]];
        for (let j = 1; j < b.length; j++) if (C[/** @type {number} */ (b[j].fija !== undefined ? b[j].fija : pos[/** @type {number} */ (b[j].i)])] !== v) return false;
      }
      return true;
    };
    const ini = g.map((i) => mod.resuelto[i]);
    let frontera = [ini];
    dist[idx(ini)] = 0;
    let d = 0;
    while (frontera.length) {
      /** @type {number[][]} */
      const sig = [];
      for (const pos of frontera) {
        for (let m = 0; m < mod.nM; m++) {
          if (!legalRel(pos, m)) continue;
          const M = mod.MAPA[m];
          const q = pos.map((p) => M[p]);
          const x = idx(q);
          if (dist[x] === -1) { dist[x] = d + 1; sig.push(q); }
        }
      }
      frontera = sig; d++;
    }
    tablas.push({ g, dist, R, cod });
  }
  return { tablas, ms: ahora() - t0 };
}

/** @param {Proyecciones} proy @param {Int16Array} S */
function hProyeccion(proy, S) {
  let h = 0;
  for (const t of proy.tablas) {
    let x = 0; for (let j = 0; j < t.g.length; j++) x = x * t.R[j] + t.cod[j][S[t.g[j]]];
    const d = t.dist[x];
    if (d > h) h = d;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Puzzle con bloqueos
// ---------------------------------------------------------------------------

/**
 * Envoltorio: el mismo puzzle, pero con los movimientos filtrados por los
 * bloques. El estado es el del puzzle (en el 3x3, colores); las piezas se
 * identifican por sus colores (soporte.identificar).
 * @param {Soporte} soporte
 * @param {DefinicionBloqueos} definicion
 * @param {OpcionesAnalisis} [opciones]
 * @returns {Analisis | { mod: ModeloBloqueos, info: InfoBloqueos, ok: false }}
 */
export function crearAnalisisBloqueos(soporte, definicion, opciones = {}) {
  const t0 = ahora();
  const mod = crearModeloBloqueos(soporte, definicion);
  /** @type {InfoBloqueos} */
  const info = { errores: mod.errores.slice(), avisos: mod.avisos.slice(), bloques: mod.bloques.length };
  if (info.errores.length) return { mod, info, ok: false };
  const rngInterno = opciones.rng || (() => Math.random());

  // legalidad en el resuelto
  /** @type {Movimiento[]} */
  const legalesResuelto = [];
  for (let m = 0; m < mod.nM; m++) if (mod.legal(mod.resuelto, m)) legalesResuelto.push(mod.movs[m]);
  // (en la notación del soporte, giro a giro: en el 4x4, D en vez de 3Uw)
  info.legalesResuelto = soporte.notacion ? legalesResuelto.map((m) => /** @type {SoporteBloqueos<unknown> & { notacion(m: Movimiento[]): Movimiento[] }} */ (soporte).notacion([m])[0]) : legalesResuelto;
  if (!legalesResuelto.length) {
    info.bloqueado = true;
    info.errores.push('El cubo queda totalmente bloqueado: con estos bloques no se puede hacer ningún movimiento.');
    return { mod, info, ok: false };
  }

  // Geometrías
  const tg = ahora();
  const geo = bfsGeometrias(mod, opciones.limiteGeometrias || LIMITES.geometrias);
  info.geometrias = geo.nodos.length;
  info.geometriasExacto = geo.completo;
  info.diametroGeometria = geo.diametro;
  info.msGeometrias = Math.round(ahora() - tg);
  info.pasosScramble = longitudScramble({ info });
  const distGeo = new Map();
  for (const [k, i] of geo.indice) distGeo.set(k, geo.nodos[i].d);

  // Grupo de la fase 2 y número de estados
  const tf = ahora();
  const g2 = grupoFase2(mod, geo, rngInterno);
  info.grupoFase2 = g2.orden.toString();
  info.estados = (g2.orden * BigInt(geo.nodos.length)).toString();
  info.estadosExacto = g2.exacto;
  if (mod.hayIguales) {
    // estados distinguibles por colores (piezas iguales): estados / |K|
    const sim = contarSimetriaIguales(mod, geo, g2, rngInterno);
    const total = g2.orden * BigInt(geo.nodos.length);
    info.simetriaIguales = sim.K.toString();
    info.estadosDistinguibles = (total / sim.K).toString();
    info.distinguiblesExacto = sim.exacto && (total % sim.K === 0n);
    info.detalleDistinguibles = sim.detalle;
  }
  info.msGrupo = Math.round(ahora() - tf);

  // BFS completo si cabe
  let bfs = null;
  const nEst = g2.orden * BigInt(geo.nodos.length);
  const limiteBFS = opciones.limiteEstados ?? LIMITES.estadosBFS;
  if (geo.completo && nEst <= BigInt(limiteBFS)) {
    const tb = ahora();
    bfs = bfsEstados(mod, limiteBFS);
    info.msBFS = Math.round(ahora() - tb);
    if (bfs) {
      info.diametro = bfs.diametro;
      if (BigInt(bfs.tabla.tamano) !== nEst) {
        // no debería pasar: las dos cuentas son independientes
        info.avisos.push(`Aviso interno: el BFS cuenta ${bfs.tabla.tamano} estados y el grupo ${nEst}.`);
      }
      info.mbBFS = +(bfs.tabla.bytes / 1048576).toFixed(1);
    }
  }
  // Piezas iguales con BFS: los estados con el aspecto del resuelto son |K| (se comprueba) y la
  // solución óptima es la más corta hasta cualquiera de ellos (caminoBFS)
  /** @type {Int16Array[] | null} */
  let objetivos = null;
  if (bfs && mod.hayIguales) {
    objetivos = [];
    const indicePos = new Map(); mod.resuelto.forEach((p, i) => indicePos.set(p, i));
    const k = new Uint32Array(mod.palabras);
    for (let t = 0; t < bfs.tabla.tamano; t++) {
      bfs.tabla.nesimo(t, k);
      const Sk = mod.desempaquetar(k);
      if (!mod.resueltoColores(Sk)) continue;
      // pi[i] = pieza cuya casa ocupa i en Sk
      objetivos.push(Int16Array.from(Sk, (p) => /** @type {number} */ (indicePos.get(p))));
    }
    if (info.simetriaIguales && BigInt(objetivos.length) !== BigInt(info.simetriaIguales)) {
      info.avisos.push(`Aviso interno: el BFS tiene ${objetivos.length} estados con el aspecto del resuelto y |K| = ${info.simetriaIguales}.`);
    }
  }
  info.espacio = bfs ? 'pequeño' : 'grande';
  // Tablas de poda por proyecciones (IDA* de las estrategias A y B en espacios grandes)
  let proy = null;
  if (!bfs) {
    proy = tablasProyeccion(mod, mod.hayIguales ? 1000 : 4000);
    info.msProyecciones = Math.round(proy.ms);
    info.tablasProyeccion = proy.tablas.length;
  }
  // 4x4, 5x5 (espacio grande): tablas de Minkwitz para la fase 2 de la estrategia B
  /** @type {TablasMinkwitz | null} */
  let mink = null;
  if (!bfs && mod.hayIguales && geo.completo && (opciones.msMinkwitz ?? 3000) > 0) {
    const tm = ahora();
    mink = tablasFase2(mod, geo, rngInterno, opciones.msMinkwitz ?? 3000, g2.orden);
    info.msMinkwitz = Math.round(ahora() - tm);
    info.minkwitz = mink.info;
  }

  // Avisos
  const total = mod.nM;
  if (legalesResuelto.length <= total / 3 || geo.nodos.length > 1 && nEst < 100000n) {
    info.avisos.push(`El cubo queda muy limitado: ${formatearNumero(geo.nodos.length)} geometrías y ${formatearNumero(nEst)} estados alcanzables.`);
  }
  info.msTotal = Math.round(ahora() - t0);
  return { mod, info, ok: true, geo, distGeo, g2, bfs, proy, mink, objetivos };
}

/**
 * Con piezas iguales: el reetiquetado de S (entre los objetivos) más cerca del resuelto exacto.
 * S'[pi[i]] = S[i]: mismo aspecto, misma legalidad (pi solo cambia entre sí piezas iguales sin
 * cambiar qué posiciones están pegadas), así que un camino de S' al resuelto lleva S a un estado
 * con el aspecto del resuelto. Devuelve { S, d } (sin objetivos, el propio S).
 * @param {Analisis} A @param {Int16Array} S
 */
function reetiquetadoMasCercano(A, S) {
  const { mod, bfs } = A;
  const k = new Uint32Array(mod.palabras);
  if (!bfs) return { S, d: -1 };
  let mejor = S, d = bfs.tabla.distancia(mod.empaquetar(S, k));
  for (const pi of A.objetivos || []) {
    const S2 = new Int16Array(S.length);
    for (let i = 0; i < S.length; i++) S2[pi[i]] = S[i];
    const d2 = bfs.tabla.distancia(mod.empaquetar(S2, k));
    if (d2 >= 0 && (d < 0 || d2 < d)) { d = d2; mejor = S2; }
  }
  return { S: mejor, d };
}

/**
 * Tablas de Minkwitz del grupo de la fase 2 (lazos de la geometría resuelta como palabras).
 * Base: el punto seguido de cada pieza móvil, en el orden de las piezas (esquinas, aristas,
 * centros).
 * @param {ModeloBloqueos} mod @param {Geometrias} geo @param {Rng} rng @param {number} msMax
 */
function tablasFase2(mod, geo, rng, msMax, ordenG2 = 0n) {
  const nodos = geo.nodos;
  /** @type {number[][]} */
  const palabra = new Array(nodos.length);
  palabra[0] = [];
  for (let i = 1; i < nodos.length; i++) palabra[i] = palabra[nodos[i].padre].concat([nodos[i].mov]);
  /** @param {number[]} w */
  const inv = (w) => w.slice().reverse().map((m) => mod.inversoMov[m]);
  const P = mod.soporte.puntos;
  /** @type {Int16Array[]} */
  const camino = new Array(nodos.length);
  const id = new Int16Array(P); for (let i = 0; i < P; i++) id[i] = i;
  camino[0] = id;
  for (let i = 1; i < nodos.length; i++) camino[i] = permProducto(camino[nodos[i].padre], mod.MAPA[nodos[i].mov]);
  // Generadores: los lazos más cortos que generan todo el grupo de la fase 2. Con muchas geometrías
  // hay cientos de miles de lazos, la mayoría largos (hasta 2·diámetro + 1 giros), y con
  // generadores largos las palabras de las tablas salen largas. Se ordenan por longitud y se toman
  // 200, 400, 800… hasta que el grupo que generan tiene el orden de la fase 2.
  const nA = geo.aristas.length / 3;
  /** @param {number} a */
  const lon = (a) => nodos[geo.aristas[3 * a]].d + 1 + nodos[geo.aristas[3 * a + 2]].d;
  const orden = [...Array(nA).keys()].sort((a, b) => lon(a) - lon(b));
  /** @param {number} a */
  const lazo = (a) => {
    const u = geo.aristas[3 * a], m = geo.aristas[3 * a + 1], v = geo.aristas[3 * a + 2];
    return {
      perm: permProducto(permProducto(camino[u], mod.MAPA[m]), permInversa(camino[v])),
      palabra: mod.reducirPalabra(palabra[u].concat([m], inv(palabra[v]))),
    };
  };
  let generadores = /** @type {Array<{ perm: Int16Array, palabra: number[] }>} */ ([]);
  for (let cuantos = 200; ; cuantos *= 2) {
    generadores = orden.slice(0, cuantos).map(lazo).filter((g) => g.palabra.length);
    if (cuantos >= nA || !ordenG2) break;
    const cad = crearCadena(P, { sinSchreier: true });
    completarAleatorio(cad, generadores.map((g) => g.perm), rng, { seguidas: 30 });
    if (cad.orden() === ordenG2) break;
  }
  // Orden de la base (qué piezas se colocan primero). Al final van las que tienen 3-ciclos puros
  // cortos (wings, centros en X), porque las últimas tablas solo admiten elementos que no mueven
  // nada más. Medido (DECISIONES.md, noche 13): en el 5x5, con las aristas centrales y los centros
  // en cruz al final las tablas no se llenaban en 6 s; al principio, se llenan en 3 s y las
  // soluciones bajan a ~400 giros. En el 4x4 (esquinas, aristas, centros) es lo mejor medido.
  const ORDEN_TIPOS = ['arista-central', 'centro-t', 'esquina', 'arista', 'centro-x', 'centro'];
  /** @param {number} i */
  const rango = (i) => { const r = ORDEN_TIPOS.indexOf(mod.piezas[mod.moviles[i]].tipo); return r < 0 ? ORDEN_TIPOS.length : r; };
  const idx = mod.moviles.map((k, i) => i).sort((a, b) => rango(a) - rango(b) || a - b);
  const base = idx.map((i) => mod.resuelto[i]);
  const t = crearTablasMinkwitz({ puntos: P, base, generadores, inverso: (m) => mod.inversoMov[m], reducir: mod.reducirPalabra, rng, msMax });
  // nivel k de la base = pieza móvil idx[k]; centros iguales sueltos: su clase (vale cualquiera)
  const clase = idx.map((i) => (mod.claseMovil[i] >= 0 && mod.enBloque[mod.moviles[i]] < 0 ? mod.claseMovil[i] : -1));
  // Prefijos para varios intentos: los generadores y entradas de las tablas más cortos (lazos:
  // legales desde cualquier estado de la geometría resuelta, porque la legalidad solo depende de ella)
  /** @type {number[][]} */
  const prefijos = [];
  const vistos = new Set();
  for (const w of generadores.map((g) => g.palabra).concat(t.tablas.flatMap((T) => T.flatMap((e) => (e ? [e.palabra] : []))))) {
    if (!w.length || w.length > 8) continue;
    const k = w.join(',');
    if (!vistos.has(k)) { vistos.add(k); prefijos.push(w); }
  }
  prefijos.sort((a, b) => a.length - b.length);
  return {
    ...t,
    prefijos: prefijos.length,
    /**
     * Palabra que resuelve S (desde la geometría resuelta) o null. Con `intentos`, prueba también
     * a empezar por un lazo corto (un prefijo) y se queda con la más corta en total.
     * @param {Int16Array} S @param {number} [intentos]
     */
    resolverS(S, intentos = 0) {
      let mejor = t.resolver(idx.map((i) => S[i]), clase);
      for (let j = 0; j < Math.min(intentos, prefijos.length); j++) {
        const w = prefijos[Math.floor(rng() * prefijos.length)];
        let T = S;
        for (const m of w) T = mod.aplicar(T, m);
        const r = t.resolver(idx.map((i) => T[i]), clase);
        if (r && (!mejor || w.length + r.length < mejor.length)) {
          const total = mod.reducirPalabra(w.concat(r));
          if (!mejor || total.length < mejor.length) mejor = total;
        }
      }
      return mejor;
    },
  };
}

/** Distancia a la geometría resuelta (exacta, de la tabla). @param {Analisis} A @param {Int16Array} S */
function dGeo(A, S) {
  const d = A.distGeo.get(A.mod.claveG(A.mod.geometriaDe(S)));
  return d === undefined ? 99 : d;
}

/**
 * Camino óptimo por el BFS completo. `previos` = los dos giros anteriores (fase 1),
 * para que la unión no sea redundante; null si no hay camino óptimo que lo cumpla.
 * Solo con el BFS completo (A.bfs).
 * @param {Analisis} A
 * @param {Int16Array} S
 * @returns {number[] | null}
 */
function caminoBFS(A, S, previos = [-1, -1]) {
  let [u1, u2] = previos;
  const { mod, bfs } = /** @type {Analisis & { bfs: BFSEstados }} */ (A);
  const k = new Uint32Array(mod.palabras);
  if (A.objetivos) S = reetiquetadoMasCercano(A, S).S; // piezas iguales: al resuelto más cercano a la vista
  let d = bfs.tabla.distancia(mod.empaquetar(S, k));
  if (d < 0) return null;
  // IDA* con la distancia exacta del BFS como cota: sin giros previos es el descenso
  // directo (camino óptimo); con ellos, el camino más corto que no empieza deshaciéndolos.
  /** @param {Int16Array} T @returns {number} */
  const dist = (T) => bfs.tabla.distancia(mod.empaquetar(T, k));
  /** @type {number[]} */
  const cam = [];
  let nodos = 0;
  /** @param {Int16Array} T @param {number} togo @param {number} a1 @param {number} a2 @returns {boolean} */
  function dfs(T, togo, a1, a2) {
    if (togo === 0) return mod.esResuelto(T);
    if (++nodos > 2000000) return false;
    for (let m = 0; m < mod.nM; m++) {
      if (mod.redundante(m, a1, a2)) continue;
      if (!mod.legal(T, m)) continue;
      const T2 = mod.aplicar(T, m);
      const d2 = dist(T2);
      if (d2 < 0 || d2 > togo - 1) continue;
      cam.push(m);
      if (dfs(T2, togo - 1, m, a1)) return true;
      cam.pop();
    }
    return false;
  }
  for (let L = d; L <= d + 24 && nodos <= 2000000; L++) if (dfs(S, L, u1, u2)) return cam;
  return null;
}

/** Soluciones de la fase 1 (geometría): las más cortas y algo más largas. @param {Analisis} A @param {Int16Array} S @returns {number[][]} */
export function solucionesFase1(A, S, { maxSol = 12, holgura = 2, msMax = 300 } = {}) {
  const { mod } = A;
  const G = mod.geometriaDe(S);
  const d0 = A.distGeo.get(mod.claveG(G));
  if (d0 === undefined) return [];
  /** @type {number[][]} */
  const sols = [];
  const t0 = ahora();
  /** @type {number[]} */
  const cam = [];
  /** @param {Int16Array} G @param {number} togo @param {number} ultima */
  function dfs(G, togo, ultima) {
    if (sols.length >= maxSol || ahora() - t0 > msMax) return;
    if (togo === 0) { if (A.distGeo.get(mod.claveG(G)) === 0) sols.push(cam.slice()); return; }
    for (let m = 0; m < mod.nM; m++) {
      if (mod.prohibido(m, ultima)) continue;
      if (!mod.legalG(G, m)) continue;
      const H = mod.aplicarG(G, m);
      const d = A.distGeo.get(mod.claveG(H));
      if (d === undefined || d > togo - 1) continue;
      cam.push(m);
      dfs(H, togo - 1, m);
      cam.pop();
    }
  }
  // con la geometría ya resuelta, la fase 1 es vacía (los lazos no aportan nada)
  const hasta = d0 === 0 ? 0 : d0 + holgura;
  for (let L = d0; L <= hasta && sols.length < maxSol; L++) dfs(G, L, -1);
  return sols;
}

/**
 * IDA* genérico con poda max(distancia a la geometría, proyecciones).
 * @param {Analisis} A
 * @param {Int16Array} S
 * @returns {{ movs: number[], optima: boolean } | null}
 */
function idaGenerico(A, S, { msMax = 1000, maxProf = 30, conGeo = true, ultima = -1 } = {}) {
  const { mod } = A;
  if (!A.proy) A.proy = tablasProyeccion(mod);
  const t0 = ahora();
  /** @type {number[]} */
  const cam = [];
  let nodos = 0, agotado = false;
  /** @param {Int16Array} T */
  const h = (T) => Math.max(hProyeccion(/** @type {Proyecciones} */ (A.proy), T), conGeo ? dGeo(A, T) : 0);
  /** @param {Int16Array} T @param {number} g @param {number} lim @param {number} ultima @returns {boolean} */
  function dfs(T, g, lim, ultima) {
    const hh = h(T);
    if (g + hh > lim) return false;
    if ((hh === 0 && mod.esResuelto(T)) || (mod.hayIguales && mod.resueltoColores(T))) return true;
    if ((++nodos & 1023) === 0 && ahora() - t0 > msMax) { agotado = true; return false; }
    for (let m = 0; m < mod.nM; m++) {
      if (mod.prohibido(m, ultima)) continue;
      if (!mod.legal(T, m)) continue;
      cam.push(m);
      if (dfs(mod.aplicar(T, m), g + 1, lim, m)) return true;
      cam.pop();
      if (agotado) return false;
    }
    return false;
  }
  for (let lim = h(S); lim <= maxProf; lim++) {
    if (dfs(S, 0, lim, ultima)) return { movs: cam.slice(), optima: ultima < 0 };
    if (agotado) return null;
  }
  return null;
}

/**
 * Resuelve un estado S (normalizado) con las dos estrategias y devuelve la más
 * corta (o la de opciones.estrategia, 'A' o 'B'), con los datos de cada una. opciones: { msMax (límite de tiempo; se
 * devuelve la mejor encontrada), msDuro (si en msMax no hay ninguna solución, se
 * sigue buscando con más tiempo hasta este límite), solucionesFase1, sinIDA }.
 * @param {Analisis} A
 * @param {Int16Array} S
 * @param {{ msMax?: number, msDuro?: number, objetivo?: number, sinIDA?: boolean, solucionesFase1?: number, estrategia?: 'A' | 'B' }} [opciones]
 * @returns {{ movs: number[], estrategia: 'A' | 'B', fases: Fase[], res: { A: SolucionEstrategia | null, B: SolucionEstrategia | null }, ms?: number } | null}
 */
export function resolverBloqueos(A, S, opciones = {}) {
  const { mod } = A;
  const msMax = opciones.msMax ?? 2500;
  const msDuro = opciones.msDuro ?? Math.max(30000, 10 * msMax);
  const t0 = ahora();
  const pasado = () => ahora() - t0;
  /** @type {{ A: SolucionEstrategia | null, B: SolucionEstrategia | null }} */
  const res = { A: null, B: null };
  if (mod.pareceResuelto(S)) return { movs: [], estrategia: 'A', fases: [], res };
  const rapida = mod.soporte.busquedaRapida;

  // ---- Estrategia A: búsqueda directa ----
  const tA = ahora();
  /** @param {number} ms */
  const directa = (ms) => {
    if (A.bfs) {
      const c = caminoBFS(A, S);
      if (c) res.A = { movs: c, optima: true, metodo: 'BFS' };
      return;
    }
    if (rapida) {
      const cota = res.A ? res.A.movs.length - 1 : 30;
      const r = rapida(mod, S, { msMax: ms, maxLong: cota, objetivo: opciones.objetivo });
      if (r && (!res.A || r.length < res.A.movs.length)) res.A = { movs: r, optima: false, metodo: 'Kociemba con legalidad' };
    }
    if (!opciones.sinIDA) {
      // IDA* con las tablas de esta configuración: encuentra la óptima si está cerca
      const r = idaGenerico(A, S, { msMax: Math.max(20, Math.min(ms * 0.4, 400)), maxProf: res.A ? res.A.movs.length - 1 : 30 });
      if (r) res.A = { movs: r.movs, optima: true, metodo: 'IDA*' };
    }
  };
  directa(msMax * 0.4);
  if (res.A) res.A.ms = ahora() - tA;

  // ---- Estrategia B: geometría y luego permutación ----
  const tB = ahora();
  const f1 = solucionesFase1(A, S, { maxSol: opciones.solucionesFase1 ?? 12, msMax: Math.min(300, msMax * 0.1) });
  /** @param {number[]} s1 @param {number} ms */
  const fase2 = (s1, ms) => {
    let T = S;
    for (const m of s1) T = mod.aplicar(T, m);
    const ultima = s1.length ? s1[s1.length - 1] : -1;
    const cota = res.B ? res.B.movs.length - s1.length - 1 : 40;
    if (cota < 0) return;
    let s2 = null, metodo2 = '';
    if (A.mink) {
      // 4x4, 5x5: tablas de Minkwitz (siempre llegan; las búsquedas, solo si está cerca)
      const w = A.mink.resolverS(T, Math.max(0, Math.round(ms * 2)));
      if (w) { s2 = w; metodo2 = 'Minkwitz'; }
    }
    if (A.bfs) { s2 = caminoBFS(A, T, [ultima, s1.length > 1 ? s1[s1.length - 2] : -1]); metodo2 = 'BFS'; } else {
      if (rapida) { s2 = rapida(mod, T, { msMax: ms, maxLong: cota, ultima }); metodo2 = 'Kociemba con legalidad'; }
      if (!opciones.sinIDA) {
        const r = idaGenerico(A, T, { msMax: Math.max(15, ms * 0.3), maxProf: s2 ? s2.length - 1 : cota, ultima });
        if (r) { s2 = r.movs; metodo2 = 'IDA*'; }
      }
    }
    if (!s2) return;
    if (metodo2 === 'Minkwitz') {
      // la unión puede repetir una cara en la frontera (… U | U …): se reduce todo y la fase 1
      // acaba donde se vuelve por primera vez a la geometría resuelta
      const total = mod.reducirPalabra(s1.concat(s2));
      let T2 = S, f1 = 0;
      if (dGeo(A, T2) !== 0) for (; f1 < total.length; f1++) { T2 = mod.aplicar(T2, total[f1]); if (dGeo(A, T2) === 0) { f1++; break; } }
      if (!res.B || total.length < res.B.movs.length) res.B = { movs: total, fase1: f1, fase2: total.length - f1, metodo: metodo2 };
      return;
    }
    const tot = s1.length + s2.length;
    if (!res.B || tot < res.B.movs.length) res.B = { movs: s1.concat(s2), fase1: s1.length, fase2: s2.length, metodo: metodo2 };
  };
  // la primera solución de la fase 1 (la más corta) se lleva más tiempo; las demás, el resto
  f1.forEach((s1, i) => {
    const queda = msMax - pasado();
    if (!A.bfs && queda <= 0 && i > 0) return; // con BFS es instantáneo: siempre
    fase2(s1, i === 0 ? Math.max(40, queda * 0.5) : Math.max(15, queda / (f1.length - i)));
  });
  if (res.B) res.B.ms = ahora() - tB;

  // ---- Sin ninguna solución en el tiempo: se sigue buscando, con más tiempo cada vez ----
  let extra = Math.max(200, msMax);
  while (!res.A && !res.B && pasado() < msDuro) {
    const ms = Math.min(extra, msDuro - pasado());
    directa(ms * 0.6);
    if (!res.A && f1.length) fase2(f1[0], ms * 0.4);
    extra *= 2;
  }
  if (res.A && !res.A.ms) res.A.ms = ahora() - tA;

  /** @type {SolucionEstrategia | null} */
  let mejor = null;
  /** @type {'A' | 'B' | null} */
  let estrategia = null;
  for (const e of /** @type {const} */ (['A', 'B'])) {
    if (res[e] && (!mejor || res[e].movs.length < mejor.movs.length)) { mejor = res[e]; estrategia = e; }
  }
  // opciones.estrategia = 'A' | 'B': esa, si la hay (para ver la otra en la interfaz)
  if (opciones.estrategia && res[opciones.estrategia]) { mejor = res[opciones.estrategia]; estrategia = opciones.estrategia; }
  if (!mejor) return null;
  /** @type {Fase[]} */
  let fases = [];
  if (estrategia === 'B') {
    if (mejor.fase1) fases.push({ nombre: 'Geometría', inicio: 0, fin: mejor.fase1, grupo: 'geometria' });
    if (mejor.fase2) fases.push({ nombre: 'Permutación', inicio: /** @type {number} */ (mejor.fase1), fin: mejor.movs.length, grupo: 'permutacion' });
  }
  return { movs: mejor.movs, estrategia: /** @type {'A' | 'B'} */ (estrategia), fases, res, ms: ahora() - t0 };
}

/** Tramos de una secuencia que empieza en la geometría resuelta: fin de cada vuelta a ella. @param {Analisis} A @param {Int16Array} S @param {number[]} movs */
export function vueltasAGeometria(A, S, movs) {
  const { mod } = A;
  /** @type {number[]} */
  const vueltas = [];
  let T = S;
  movs.forEach((m, i) => {
    T = mod.aplicar(T, m);
    if (dGeo(A, T) === 0) vueltas.push(i + 1);
  });
  return vueltas;
}

/**
 * Scramble: estado uniforme (espacio pequeño) o movimientos legales al azar.
 * @param {Analisis} A
 * @param {Rng} rng
 * @param {{ pasos?: number }} [opciones]
 * @returns {number[]}
 */
export function scrambleBloqueos(A, rng, opciones = {}) {
  const { mod } = A;
  if (A.bfs) {
    const n = A.bfs.tabla.tamano;
    if (n <= 1) return [];
    const k = new Uint32Array(mod.palabras);
    for (let intento = 0; intento < 100; intento++) {
      const t = 1 + Math.floor(rng() * (n - 1)); // nunca el resuelto (índice 0)
      let d = A.bfs.tabla.nesimo(t, k);
      const S = mod.desempaquetar(k);
      if (A.objetivos) d = reetiquetadoMasCercano(A, S).d; // a la vista
      if (d < Math.min(2, /** @type {number} */ (A.info.diametro))) continue;
      const sol = caminoBFS(A, S);
      return invertirSecuencia(mod, /** @type {number[]} */ (sol));
    }
  }
  const T = opciones.pasos ?? longitudScramble(A);
  for (let intento = 0; ; intento++) {
    const w = paseoAleatorio(A, rng, 0, T, { pasosFijos: true });
    let S = mod.resuelto;
    for (const m of w) S = mod.aplicar(S, m);
    if (!mod.pareceResuelto(S) || intento >= 20) return w;
  }
}

/**
 * Pasos del paseo al azar de los scrambles de los espacios grandes: max(80, 4·d²),
 * con d el diámetro del grafo de geometrías (un paseo al azar tarda del orden de d²
 * en recorrerlo). Medido con scripts/mezcla-bloqueos.mjs (ver DECISIONES.md): hacen
 * falta 50, 50, 100 y 1.600 pasos con d = 1, 3, 7 y 24; esto da 80, 80, 196 y 2.304.
 * @param {{ info: InfoBloqueos }} A
 */
export function longitudScramble(A) {
  const d = A.info.diametroGeometria || 0;
  return Math.max(80, 4 * d * d);
}

/**
 * Paseo al azar "perezoso": en cada paso se elige uno de todos los giros; si es
 * ilegal, no se hace nada. Así la distribución límite es uniforme sobre los
 * estados alcanzables (la matriz de paso es simétrica), aunque el número de giros
 * legales cambie de una geometría a otra. El scramble es la palabra reducida del
 * paseo: un giro de la misma cara que el anterior se une a él (U + U = U2,
 * U + U' = nada), y en U D U el segundo U se une al primero (conmutan). El estado
 * al que se llega no cambia por escribirlo así; la legalidad de la palabra
 * reducida se comprueba de nuevo.
 * @param {{ mod: ModeloBloqueos }} A
 * @param {Rng} rng
 * @param {number} L
 * @returns {number[]}
 */
export function paseoAleatorio(A, rng, L, maxPasos = 200 * L, { pasosFijos = false } = {}) {
  const { mod } = A;
  const veces = mod.movs.map((n) => (n.endsWith("'") ? 3 : n.endsWith('2') ? 2 : 1));
  /** @type {Map<string, number[]>} */
  const deFamilia = new Map();
  mod.movs.forEach((n, i) => { const f = mod.caraDe[i]; if (!deFamilia.has(f)) deFamilia.set(f, [0, 0, 0, 0]); /** @type {number[]} */ (deFamilia.get(f))[veces[i]] = i; });
  /** @param {number} m */
  const eje = (m) => (mod.soporte.ejeDe ? mod.soporte.ejeDe(mod.caraDe[m]) : mod.caraDe[m]);
  /** @type {number[]} */
  let res = [];
  let estados = [mod.resuelto]; // estados[i] = estado antes de res[i]
  let S = mod.resuelto;
  /** @param {number} desde @param {number[]} nueva */
  const rehacer = (desde, nueva) => {
    // recalcula los estados desde la posición `desde`; null si algún giro es ilegal
    const est = estados.slice(0, desde + 1);
    let T = est[desde];
    for (let i = desde; i < nueva.length; i++) {
      if (!mod.legal(T, nueva[i])) return null;
      T = mod.aplicar(T, nueva[i]);
      est.push(T);
    }
    return { est, T };
  };
  // pasosFijos: exactamente maxPasos pasos (la palabra sale de la longitud que salga);
  // si no, hasta que la palabra reducida tenga L giros
  for (let paso = 0; paso < maxPasos && (pasosFijos || res.length < L); paso++) {
    const m = Math.floor(rng() * mod.nM);
    if (!mod.legal(S, m)) continue;
    const n = res.length;
    /** @type {number[] | null} */
    let nueva = null;
    let desde = n;
    /** @param {number} j */
    const unir = (j) => {
      const v = (veces[res[j]] + veces[m]) % 4;
      nueva = res.slice();
      if (v === 0) nueva.splice(j, 1); else nueva[j] = /** @type {number[]} */ (deFamilia.get(mod.caraDe[m]))[v];
      desde = j;
    };
    // la misma cara en el tramo final de giros del mismo eje (conmutan): se une a ella. En el 3x3
    // es el anterior o el de antes (U D U); en el 4x4 puede estar más atrás (U Uw 3Uw U).
    let j = n - 1;
    while (j >= 0 && eje(res[j]) === eje(m) && mod.caraDe[res[j]] !== mod.caraDe[m]) j--;
    if (j >= 0 && mod.caraDe[res[j]] === mod.caraDe[m]) unir(j);
    else {
      // lo normal: un giro más al final (ya se sabe que es legal)
      S = mod.aplicar(S, m);
      res.push(m);
      estados.push(S);
      continue;
    }
    // (unir() acaba de dar valor a nueva; el tipo no lo ve a través de la función)
    const r = rehacer(Math.min(desde, n), /** @type {number[]} */ (/** @type {unknown} */ (nueva)));
    if (!r) continue; // no debería pasar (ver arriba); por si acaso, se descarta el paso
    res = /** @type {number[]} */ (/** @type {unknown} */ (nueva)); estados = r.est; S = r.T;
  }
  return res;
}

/** @param {ModeloBloqueos} mod @param {number[]} movs */
function invertirSecuencia(mod, movs) {
  return movs.slice().reverse().map((m) => {
    const nombre = mod.movs[m];
    const inv = nombre.endsWith("'") ? nombre.slice(0, -1) : nombre.endsWith('2') ? nombre : nombre + "'";
    return mod.movs.indexOf(inv);
  });
}

// ---------------------------------------------------------------------------
// Dibujo de los bloques: qué pegatinas vecinas comparten lado (3D) y qué lado
// del dibujo 2D da a la vecina. Se calcula una vez por puzzle.
// ---------------------------------------------------------------------------

/**
 * @typedef {{ i: number, j: number, lado: number, dx: number, dy: number }} Par2D
 * @typedef {{ indice: Array<number | null>, vecinos3D: number[][], pares2D: Par2D[] | null }} Dibujo
 * @type {WeakMap<object, Dibujo>}
 */
const cacheDibujo = new WeakMap();
/**
 * @template E
 * @param {Puzzle<E> & { vista3D(e: E): Vista3D }} puzzle
 * @param {SoporteBloqueos<E>} sop
 * @returns {Dibujo}
 */
function prepararDibujo(puzzle, sop) {
  if (cacheDibujo.has(puzzle)) return /** @type {Dibujo} */ (cacheDibujo.get(puzzle));
  const geo = puzzle.vista3D(puzzle.estadoResuelto()).geometria;
  const peg = geo.pegatinas;
  const indice = peg.map((q) => q.indice);
  /** @param {number[]} v */
  const clave = (v) => v.map((x) => Math.round(x * 1000)).join(',');
  /** @type {Map<string, Array<[number, number]>>} */
  const porLado = new Map(); // "a|b" -> [ [k, lado], ... ]
  peg.forEach((q, k) => {
    const n = q.puntos.length;
    for (let i = 0; i < n; i++) {
      const a = clave(q.puntos[i]), b = clave(q.puntos[(i + 1) % n]);
      const kl = a < b ? a + '|' + b : b + '|' + a;
      if (!porLado.has(kl)) porLado.set(kl, []);
      /** @type {Array<[number, number]>} */ (porLado.get(kl)).push([k, i]);
    }
  });
  /** @param {number[]} x @param {number[]} y */
  const mismaNormal = (x, y) => Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 1e-6;
  const vecinos3D = peg.map((q) => q.puntos.map(() => -1));
  for (const lista of porLado.values()) {
    for (const [k, i] of lista) for (const [k2] of lista) {
      if (k2 !== k && mismaNormal(peg[k].normal, peg[k2].normal)) vecinos3D[k][i] = k2;
    }
  }
  // 2D (si el soporte da los polígonos de la red): lado del polígono que mira a la vecina
  /** @type {Par2D[] | null} */
  let pares2D = null;
  if (sop.pegatinas2D) {
    pares2D = [];
    const pol = sop.pegatinas2D.map((x) => x.poligono);
    /** @param {number[][]} P @returns {number[]} */
    const centro = (P) => P.reduce((s, [x, y]) => [s[0] + x / P.length, s[1] + y / P.length], [0, 0]);
    vecinos3D.forEach((vec, k) => vec.forEach((n) => {
      if (n < 0) return;
      const i = indice[k], j = indice[n];
      if (i == null || j == null) return;
      const P = pol[i], cj = centro(pol[j]), ci = centro(P);
      let mejor = -1, dMin = Infinity, dx = 0, dy = 0;
      for (let l = 0; l < P.length; l++) {
        const a = P[l], b = P[(l + 1) % P.length];
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const d = Math.hypot(m[0] - cj[0], m[1] - cj[1]);
        if (d < dMin) { dMin = d; mejor = l; dx = m[0] - ci[0]; dy = m[1] - ci[1]; }
      }
      // hasta la mitad del hueco entre las dos pegatinas
      const Q = pol[j];
      let hueco = Infinity;
      for (let l = 0; l < Q.length; l++) {
        const a = Q[l], b = Q[(l + 1) % Q.length];
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const a2 = P[mejor], b2 = P[(mejor + 1) % P.length];
        hueco = Math.min(hueco, Math.hypot(m[0] - (a2[0] + b2[0]) / 2, m[1] - (a2[1] + b2[1]) / 2));
      }
      const len = Math.hypot(dx, dy) || 1;
      /** @type {Par2D[]} */ (pares2D).push({ i, j, lado: mejor, dx: (dx / len) * hueco / 2, dy: (dy / len) * hueco / 2 });
    }));
  }
  const r = { indice, vecinos3D, pares2D };
  cacheDibujo.set(puzzle, r);
  return r;
}

// ---------------------------------------------------------------------------
// Envoltorio sobre la interfaz común: puzzleConBloqueos(puzzle, bloqueos)
// ---------------------------------------------------------------------------

import { definirPuzzle } from './puzzle.js';

/** Analiza un movimiento cualquiera ("R'", "M2", "x"): familia y potencia. @param {Movimiento} mov */
function partesMov(mov) {
  // (la expresión acepta cualquier texto: nunca es null)
  const m = /** @type {RegExpExecArray} */ (/^(.*?)(2'|2|')?$/.exec(mov));
  return { fam: m[1], veces: m[2] === "'" ? 3 : m[2] ? 2 : 1 };
}
/** @param {Movimiento} n */
const invertirNombre = (n) => (n.endsWith("2'") ? n.slice(0, -1) : n.endsWith('2') ? n : n.endsWith("'") ? n.slice(0, -1) : n + "'");

/**
 * El puzzle `puzzle` con los bloques de `definicion` ([[clave, ...]]). Necesita
 * `puzzle.soporteBloqueos`. Sin bloques válidos se comporta como el puzzle de
 * siempre salvo en que los movimientos se comprueban.
 * El estado es el del puzzle: un array de pegatinas (soporte.identificar lo lee por colores).
 * @param {Puzzle<EstadoPegatinas>} puzzle
 * @param {DefinicionBloqueos} definicion
 * @param {OpcionesAnalisis} [opcionesAnalisis]
 * @returns {PuzzleVendado<EstadoPegatinas>}
 */
export function puzzleConBloqueos(puzzle, definicion, opcionesAnalisis = {}) {
  // (comprobado en la línea siguiente; el cast es para las funciones de dentro, que el tipo no ve narrowed)
  const sop = /** @type {SoporteBloqueos<EstadoPegatinas>} */ (puzzle.soporteBloqueos);
  if (!sop) throw new Error(`${puzzle.nombre} no admite bloqueos`);
  const mod = crearModeloBloqueos(sop, definicion);
  /**
   * Análisis de la configuración. Es null hasta inicializar(), y todas las funciones que lo
   * usan llaman antes a inicializar() (estaInicializado lo comprueba): el tipo no puede seguir
   * esa invariante entre funciones, así que se declara sin null.
   * @type {Analisis | { mod: ModeloBloqueos, info: InfoBloqueos, ok: false }}
   */
  let A = /** @type {Analisis} */ (/** @type {unknown} */ (null));
  /** @type {{ tablas?: number }} */
  const msBase = {};
  /** @type {number[]} */
  const fijos = [];
  for (let p = 0; p < sop.puntos; p++) if (mod.fijo[p]) fijos.push(p);
  // piezas de cada bloque: un punto de cada una (para comprobar la legalidad en cualquier estado)
  const puntosBloque = mod.bloques.map((bq) => bq.piezas.map((k) => sop.piezas[k].puntos[0]));

  /** @param {EstadoPegatinas} estado @returns {Identificacion} */
  function identificar(estado) {
    const r = sop.identificar(estado);
    if (r.errores) return r;
    return { donde: r.donde };
  }
  /**
   * Bloques rotos: sus piezas ya no están juntas como un sólido. Cada giro mueve
   * un bloque entero con una rotación del cubo (la de su capa), así que un bloque
   * entero está siempre en la posición resuelta movida por una de las 24
   * rotaciones del cubo entero.
   */
  /** @param {ArrayLike<number>} donde */
  function bloquesRotos(donde) {
    /** @type {number[]} */
    const rotos = [];
    mod.bloques.forEach((bq, bi) => {
      if (!rigido(bq.piezas.flatMap((k) => sop.piezas[k].puntos), donde)) rotos.push(bi);
    });
    return rotos;
  }
  /** @param {number[]} pts @param {ArrayLike<number>} donde */
  function rigido(pts, donde) { return sop.rotaciones.some((Q) => pts.every((p) => donde[p] === Q[p])); }

  /**
   * ¿Es legal `mov` en el estado (colores)? { legal, bloque }
   * @param {ArrayLike<number>} donde
   * @param {Movimiento} mov
   * @returns {{ legal: true, bloque?: undefined } | { legal: false, bloque: number }}
   */
  function comprobarMovimiento(donde, mov) {
    const C = sop.enCapa(mov);
    for (let bi = 0; bi < puntosBloque.length; bi++) {
      const pts = puntosBloque[bi];
      const v = C[donde[pts[0]]];
      for (let j = 1; j < pts.length; j++) if (C[donde[pts[j]]] !== v) return { legal: false, bloque: bi };
    }
    return { legal: true };
  }
  /** @param {number} bi */
  const nombreBloque = (bi) => mod.bloques[bi].piezas.map((k) => sop.piezas[k].clave).join('+');

  /**
   * Comprueba una solución giro a giro sobre el estado del usuario: cada giro legal en su
   * momento (ningún bloque se rompe) y el estado final resuelto. Nunca se devuelve una solución
   * que no pase esto (noche 13).
   * @param {EstadoPegatinas} estado @param {Movimiento[]} movs
   */
  function solucionComprobada(estado, movs) {
    let e = estado;
    for (const m of movs) {
      const id = identificar(e);
      if (id.errores) return false;
      if (!comprobarMovimiento(id.donde, m).legal) return false;
      const M = sop.mapa(m);
      const nuevo = e.slice();
      for (let p = 0; p < e.length; p++) nuevo[M[p]] = e[p];
      e = nuevo;
    }
    return estaResuelto(e);
  }
  /**
   * Resuelto: el del puzzle (cada cara de un color) y, si hay bloques con piezas iguales, además
   * cada bloque en las posiciones del resuelto (un bloque centro fijo + centros iguales girado en
   * su sitio tiene los mismos colores pero otro pegado). Sin piezas iguales, el del puzzle.
   * @param {EstadoPegatinas} e
   */
  function estaResuelto(e) {
    if (!puzzle.estaResuelto(e)) return false;
    if (!mod.hayIguales || !mod.bloques.length) return true;
    const n = normalizar(e);
    if (n.errores) return false;
    return mod.resueltoColores(mod.SDesdeDonde(n.donde));
  }

  /** @param {EstadoPegatinas} estado @param {Movimiento} mov */
  function aplicarMovimiento(estado, mov) {
    const M = sop.mapa(mov); // lanza un error si el movimiento no existe
    if (puntosBloque.length) {
      const id = identificar(estado);
      if (id.donde) {
        const c = comprobarMovimiento(id.donde, mov);
        if (!c.legal) throw new Error(`Movimiento ilegal: ${mov} rompería el bloque ${nombreBloque(c.bloque)}.`);
      }
    }
    const nuevo = estado.slice();
    for (let p = 0; p < estado.length; p++) nuevo[M[p]] = estado[p];
    return nuevo;
  }

  /**
   * Normaliza (rotación del cubo entero que deja las piezas fijas en su sitio).
   * @param {EstadoPegatinas} estado
   * @returns {{ donde: Int16Array, r: number, errores?: undefined } | { errores: string[] }}
   */
  function normalizar(estado) {
    const id = identificar(estado);
    if (id.errores) return id;
    const d = /** @type {Int16Array} */ (id.donde);
    for (let r = 0; r < sop.rotaciones.length; r++) {
      const Q = sop.rotaciones[r];
      if (fijos.every((p) => Q[d[p]] === p)) {
        const n = new Int16Array(d.length);
        for (let p = 0; p < d.length; p++) n[p] = Q[d[p]];
        return { donde: n, r };
      }
    }
    return { errores: ['Las piezas fijas (centros) no están colocadas como en un cubo real.'] };
  }
  /** @type {Map<number, Movimiento>} */
  const traducciones = new Map();
  // Nombres posibles de un giro en la orientación del usuario: los de búsqueda o, si el soporte
  // los da, todos (en el 4x4 la búsqueda solo usa U, R y F; girado, un U puede ser un D)
  const candidatos = (sop.todos || mod.movs).map((nombre) => ({ nombre, mapa: sop.mapa(nombre) }));
  /** Notación preferida del soporte (4x4: 3Uw -> D + rotación), si la tiene. @param {Movimiento[]} movs */
  const conNotacion = (movs) => (sop.notacion ? sop.notacion(movs) : movs);
  /**
   * Nombre en el marco original del giro m (índice) del marco normalizado por la rotación r.
   * (Siempre hay uno: las rotaciones llevan giros de cara a giros de cara.)
   * @param {number} r @param {number} m @returns {Movimiento}
   */
  function traducir(r, m) {
    const clave = r * 64 + m;
    if (traducciones.has(clave)) return /** @type {Movimiento} */ (traducciones.get(clave));
    const Q = sop.rotaciones[r];
    const Qi = new Int16Array(Q.length); Q.forEach((x, i) => { Qi[x] = i; });
    const M = mod.MAPA[m];
    /** @type {Movimiento | null} */
    let nombre = null;
    for (let j = 0; j < candidatos.length && !nombre; j++) {
      const X = candidatos[j].mapa;
      let igual = true;
      for (let p = 0; p < Q.length; p++) if (Qi[M[Q[p]]] !== X[p]) { igual = false; break; }
      if (igual) nombre = candidatos[j].nombre;
    }
    traducciones.set(clave, /** @type {Movimiento} */ (nombre));
    return /** @type {Movimiento} */ (nombre);
  }

  // Sin ningún bloque (y sin errores) el puzzle es el de siempre: se delega todo en él
  const sinBloques = mod.bloques.length === 0 && mod.errores.length === 0;

  function inicializar() {
    if (A) return { ms: 0 };
    const t0 = ahora();
    if (sinBloques) {
      const r = puzzle.inicializar();
      const c = crearCadena(sop.puntos);
      for (const m of sop.busqueda) c.incluir(sop.mapa(m));
      // sin bloques solo se usan mod e info (todo lo demás se delega en el puzzle)
      A = /** @type {Analisis} */ (/** @type {unknown} */ ({ ok: true, mod, info: { errores: [], avisos: mod.avisos.slice(), bloques: 0, legalesResuelto: sop.busqueda.slice(), geometrias: 1, geometriasExacto: true, diametroGeometria: 0, grupoFase2: c.orden().toString(), estados: c.orden().toString(), estadosExacto: true, espacio: 'grande', sinBloques: true } }));
      A.info.msTablas = Math.round(ahora() - t0);
      return { ms: (r && r.ms) || ahora() - t0 };
    }
    A = crearAnalisisBloqueos(sop, definicion, opcionesAnalisis);
    msBase.tablas = ahora() - t0;
    A.info.msTablas = Math.round(msBase.tablas);
    return { ms: msBase.tablas };
  }

  /**
   * Validación con los bloques; si es válido, también S (normalizado) y la rotación r.
   * @param {EstadoPegatinas} estado
   * @returns {{ valido: boolean, errores: string[], S?: Int16Array, r?: number }}
   */
  function analizar(estado) {
    inicializar();
    if (!A.ok) return { valido: false, errores: A.info.errores.slice() };
    if (sinBloques) return puzzle.validar ? puzzle.validar(estado) : { valido: true, errores: [] };
    if (puzzle.validar) {
      const v = puzzle.validar(estado);
      if (!v.valido) return v;
    }
    const n = normalizar(estado);
    if (n.errores) return { valido: false, errores: n.errores };
    const rotos = bloquesRotos(n.donde);
    if (rotos.length) return { valido: false, errores: rotos.map((bi) => `El bloque ${nombreBloque(bi)} está roto: sus piezas no están juntas como en el cubo resuelto.`) };
    const S = A.mod.SDesdeDonde(n.donde);
    const G = A.mod.geometriaDe(S);
    const gi = A.geo.indice.get(A.mod.claveG(G));
    if (gi === undefined) {
      return { valido: false, errores: [A.info.geometriasExacto ? 'Con estos bloques no se puede llegar a esta forma (los bloques no pueden quedar colocados así).' : 'No se pudo comprobar la forma (demasiadas geometrías).'] };
    }
    // ¿pertenece al grupo de la fase 2? (deshacer el camino del árbol hasta la geometría resuelta)
    const cam = A.g2.camino[gi];
    const inv = new Int16Array(cam.length); cam.forEach((x, i) => { inv[x] = i; });
    const x = new Int16Array(n.donde.length);
    for (let p = 0; p < x.length; p++) x[p] = inv[n.donde[p]];
    if (A.info.estadosExacto && !A.g2.cadena.contiene(x)) {
      return { valido: false, errores: ['Con estos bloques no se puede llegar a este estado: las piezas no pueden quedar así sin romper ningún bloque.'] };
    }
    return { valido: true, errores: [], S, r: n.r };
  }

  /**
   * (Los casts: si analizar() dice válido, ha devuelto S y r y A es un análisis correcto;
   * con la estrategia B, res.B existe.)
   * @param {EstadoPegatinas} estado
   * @param {OpcionesResolver} [opciones]
   * @returns {ResultadoResolver}
   */
  function resolver(estado, opciones = {}) {
    const t0 = ahora();
    // (los puzzles con soporteBloqueos tienen solucionador: el 3x3)
    if (sinBloques) { inicializar(); return { ...(/** @type {Required<Puzzle<EstadoPegatinas>>['resolver']} */ (puzzle.resolver))(estado, opciones), estrategia: 'sin bloqueos' }; }
    const a = analizar(estado);
    if (!a.valido) return { ok: false, errores: a.errores };
    const r = resolverBloqueos(/** @type {Analisis} */ (A), /** @type {Int16Array} */ (a.S), opciones);
    if (!r) return { ok: false, errores: ['No se encontró solución en el tiempo disponible.'] };
    const movimientos = conNotacion(r.movs.map((m) => traducir(/** @type {number} */ (a.r), m)));
    if (!solucionComprobada(estado, movimientos)) return { ok: false, errores: ['La solución encontrada no ha pasado la comprobación giro a giro, así que no se muestra (es un error del programa: por favor, avísalo).'] };
    /** @type {ResolverOk} */
    const res = {
      ok: true, movimientos, ms: ahora() - t0,
      estrategia: r.estrategia,
      fases: r.fases.length ? r.fases : null,
      detalle: {
        A: r.res.A ? { longitud: r.res.A.movs.length, metodo: r.res.A.metodo, optima: !!r.res.A.optima, ms: r.res.A.ms } : null,
        B: r.res.B ? {
          longitud: r.res.B.movs.length, fase1: /** @type {number} */ (r.res.B.fase1), fase2: /** @type {number} */ (r.res.B.fase2), metodo: r.res.B.metodo, ms: r.res.B.ms,
          movimientos: conNotacion(r.res.B.movs.map((m) => traducir(/** @type {number} */ (a.r), m))),
        } : null,
      },
    };
    // la de la otra estrategia (la interfaz deja verla) también se comprueba; si no pasa, no se ofrece
    if (res.detalle && res.detalle.B && r.estrategia !== 'B' && !solucionComprobada(estado, res.detalle.B.movimientos)) res.detalle.B = null;
    if (opciones.compararSinBloqueos !== false && puzzle.solucionSinBloqueos) {
      const s = puzzle.solucionSinBloqueos(estado);
      if (s) res.sinBloqueos = { longitud: s.movimientos.length, optima: s.optima };
    }
    // Fase 2 (estrategia B): dónde vuelve a la geometría resuelta
    if (r.estrategia === 'B' && /** @type {SolucionEstrategia} */ (r.res.B).fase2) {
      let T = /** @type {Int16Array} */ (a.S);
      for (const m of r.movs.slice(0, /** @type {Required<SolucionEstrategia>} */ (r.res.B).fase1)) T = A.mod.aplicar(T, m);
      res.vueltasGeometria = vueltasAGeometria(/** @type {Analisis} */ (A), T, r.movs.slice(/** @type {Required<SolucionEstrategia>} */ (r.res.B).fase1))
        .map((i) => i + /** @type {Required<SolucionEstrategia>} */ (r.res.B).fase1);
    }
    return res;
  }

  /** @param {Rng} rng */
  function generarScramble(rng) {
    if (sinBloques) return puzzle.generarScramble(rng);
    inicializar();
    if (!A.ok) return [];
    return conNotacion(scrambleBloqueos(A, rng).map((m) => mod.movs[m]));
  }

  /** @param {string} fam */
  const ejeDe = (fam) => (sop.ejeDe ? sop.ejeDe(fam) : fam);

  // ----- Dibujo: piezas pegadas unidas (sin la separación negra) -----
  /** @typedef {Puzzle<EstadoPegatinas> & { vista3D(e: EstadoPegatinas): Vista3D }} PuzzleCon3D */
  const dib = puzzle.vista3D ? prepararDibujo(/** @type {PuzzleCon3D} */ (puzzle), sop) : null;
  /** bloque de cada posición de pegatina (o -1) en un estado. @param {EstadoPegatinas} estado */
  function bloqueEnPosicion(estado) {
    const res = new Int16Array(sop.nPegatinas).fill(-1);
    if (!mod.bloques.length) return res;
    const id = identificar(estado);
    if (id.errores) return res;
    mod.bloques.forEach((bq, bi) => bq.piezas.forEach((k) => sop.piezas[k].puntos.forEach((p) => { if (p < sop.nPegatinas) res[id.donde[p]] = bi; })));
    return res;
  }
  /** @type {Map<string, import('./tipos.js').Geometria3D>} */
  const cacheGeo3D = new Map();
  /**
   * (Solo existe si el puzzle de debajo tiene vista 3D: ver el objeto que se devuelve.)
   * @param {EstadoPegatinas} estado
   * @param {{ bloqueEnPosicion?: Int16Array }} [opciones]
   * @returns {Vista3D}
   */
  function vista3D(estado, opciones = {}) {
    const v = /** @type {PuzzleCon3D} */ (puzzle).vista3D(estado);
    if (!dib || !mod.bloques.length) return v;
    const enB = opciones.bloqueEnPosicion || bloqueEnPosicion(estado);
    // (indice null = pegatina que no se edita: enB[null] es undefined y la comparación da false, que es lo que se quiere)
    const marcas = dib.vecinos3D.map((vec, k) => vec.map((n) => n >= 0 && enB[/** @type {number} */ (dib.indice[k])] >= 0
      && enB[/** @type {number} */ (dib.indice[k])] === enB[/** @type {number} */ (dib.indice[n])]));
    const clave = marcas.map((m) => m.map((x) => (x ? 1 : 0)).join('')).join('');
    let geometria = cacheGeo3D.get(clave);
    if (!geometria) {
      geometria = { ...v.geometria, pegatinas: v.geometria.pegatinas.map((q, k) => (marcas[k].some(Boolean) ? { ...q, expandir: marcas[k] } : q)) };
      if (cacheGeo3D.size > 200) cacheGeo3D.clear();
      cacheGeo3D.set(clave, geometria);
    }
    return { ...v, geometria };
  }
  /** @param {EstadoPegatinas} estado @param {OpcionesRender} [opciones] */
  function renderizar(estado, opciones = {}) {
    if (!dib || !dib.pares2D || !mod.bloques.length) return puzzle.renderizar(opciones.colores || estado, opciones);
    const enB = opciones.bloqueEnPosicion || bloqueEnPosicion(estado);
    /** @type {Map<number, Array<{ dx: number, dy: number }>>} */
    const expandir = new Map();
    for (const { i, j, lado, dx, dy } of dib.pares2D) {
      if (enB[i] < 0 || enB[i] !== enB[j]) continue;
      if (!expandir.has(i)) expandir.set(i, []);
      /** @type {Array<{ dx: number, dy: number }>} */ (expandir.get(i))[lado] = { dx, dy };
    }
    return puzzle.renderizar(opciones.colores || estado, { ...opciones, expandir });
  }

  return definirPuzzle({
    ...puzzle,
    id: puzzle.id,
    nombre: puzzle.nombre + ' vendado',
    bloqueos: definicion,
    claveBloqueos: claveBloqueos(definicion),
    capacidades: { scramble: true, validar: true, resolver: true, editar: !!puzzle.capacidades.editar },
    descripcion: 'Cubo vendado: búsqueda directa (BFS o IDA*/Kociemba con legalidad) o dos fases (geometría y permutación).',
    tipoScramble: 'vendado',
    estaResuelto,
    aplicarMovimiento,
    invertirMovimiento: invertirNombre,
    infoMovimiento(mov) { const { fam } = partesMov(mov); return { eje: ejeDe(fam), clave: fam }; },
    buscarRedundancia(movs) {
      if (sop.todos) {
        // varias capas por cara (4x4, 5x5): redundante si en un tramo de giros del mismo eje se
        // repite una familia (conmutan: se podrían unir). U Uw D no lo es.
        let eje = null, fams = new Set();
        for (let i = 0; i < movs.length; i++) {
          const f = partesMov(movs[i]).fam, e = ejeDe(f);
          if (e !== eje) { eje = e; fams = new Set(); }
          if (fams.has(f)) return `movimiento redundante en la posición ${i + 1} (${movs[i]})`;
          fams.add(f);
        }
        return null;
      }
      for (let i = 1; i < movs.length; i++) {
        const a = partesMov(movs[i - 1]).fam, b = partesMov(movs[i]).fam;
        if (a === b) return `movimiento redundante en la posición ${i + 1} (${movs[i]})`;
        if (i >= 2 && ejeDe(a) === ejeDe(b) && ejeDe(partesMov(movs[i - 2]).fam) === ejeDe(b)) return `movimiento redundante en la posición ${i + 1} (${movs[i]})`;
      }
      return null;
    },
    // (this = el puzzle ya hecho por definirPuzzle, que siempre tiene buscarRedundancia)
    buscarRedundanciaSolucion(movs) { return /** @type {Puzzle<EstadoPegatinas>} */ (/** @type {unknown} */ (this)).buscarRedundancia(movs); },
    generarScramble,
    inicializar,
    estaInicializado: () => !!A,
    avisoInicializacion: 'Analizando los bloques y generando las tablas…',
    validar: (e) => { const a = analizar(e); return { valido: a.valido, errores: a.errores }; },
    resolver,
    aprender: undefined,
    metodosAprender: undefined,
    // solo si el puzzle de debajo tiene vista 3D (si no, la interfaz creería que la hay)
    vista3D: puzzle.vista3D ? vista3D : undefined,
    renderizar,
    bloqueEnPosicion,
    estadoAleatorio: undefined,
    /** Análisis de la configuración (geometrías, estados, avisos). */
    /** @returns {InfoBloqueos} */
    analisis() { inicializar(); return A.info; },
    /** true si todos los bloques están enteros (sus piezas siguen juntas como en el resuelto). */
    /** @param {EstadoPegatinas} estado */
    bloquesIntactos(estado) {
      const id = identificar(estado);
      if (id.errores) return false;
      return mod.bloques.every((bq) => rigido(bq.piezas.flatMap((k) => sop.piezas[k].puntos), /** @type {Int16Array} */ (id.donde)));
    },
    /** true si el estado tiene la geometría resuelta (los bloques colocados como en el resuelto). */
    /** @param {EstadoPegatinas} estado */
    geometriaResuelta(estado) {
      inicializar();
      const n = normalizar(estado);
      if (n.errores) return false;
      const S = mod.SDesdeDonde(n.donde);
      return mod.claveG(mod.geometriaDe(S)) === mod.claveG(mod.geometriaDe(mod.resuelto));
    },
    /** ¿Es legal el movimiento en este estado? { legal, motivo } */
    /** @param {EstadoPegatinas} estado @param {Movimiento} mov @returns {{ legal: true } | { legal: false, motivo: string }} */
    movimientoLegal(estado, mov) {
      const id = identificar(estado);
      if (id.errores) return { legal: false, motivo: id.errores[0] };
      const c = comprobarMovimiento(id.donde, mov);
      return c.legal ? { legal: true } : { legal: false, motivo: `rompería el bloque ${nombreBloque(c.bloque)}` };
    },
    /** Bloques: para cada uno, sus piezas (claves) y las pegatinas de sus piezas en el estado dado. */
    /** @param {EstadoPegatinas} [estado] */
    piezasDeBloques(estado) {
      const id = estado ? identificar(estado) : null;
      return mod.bloques.map((bq) => ({
        piezas: bq.piezas.map((k) => sop.piezas[k].clave),
        pegatinas: bq.piezas.flatMap((k) => sop.piezas[k].puntos.filter((p) => p < sop.nPegatinas).map((p) => (id && id.donde ? id.donde[p] : p))),
      }));
    },
    erroresBloqueos: mod.errores,
    avisosBloqueos: mod.avisos,
    modeloBloqueos: mod,
    analisisInterno: () => A,
  });
}
