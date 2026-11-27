// Cuboides (noche 15): solver ÓPTIMO genérico (en los giros de búsqueda, cada giro cuenta 1:
// U, U2, U' y R2 son un movimiento cada uno; es la métrica de Jaap «face turn metric»).
//
// Estado de búsqueda: dónde está la pegatina de referencia de cada pieza que se mueve (la colocación
// entera depende solo de ella: lo comprueba crearGrupoCuboide). Coordenadas: para una lista de piezas
// de una órbita, el índice de la variación (k posiciones distintas de r) de sus referencias, con su
// tabla de movimientos.
//
// - Espacio pequeño (producto de las coordenadas completas ≤ LIMITE_COMPLETO): una sola tabla con la
//   distancia EXACTA de cada estado (BFS completo desde los objetivos).
//   3x3x1 (26.880 índices, 192 estados) y 2x2x3 (241.920 índices y estados). Con la tabla exacta,
//   IDA* llega en la primera iteración sin desviarse.
// - Espacio grande: IDA* con tablas de poda (bases de patrones) de una órbita entera más unas piezas de
//   otra (≤ LIMITE_PATRON entradas cada una). 3x3x2: esquinas + 2 aristas y aristas + 2 esquinas
//   (2.257.920 entradas cada una; ~1 s en Node; con 3 piezas, 13,5 M y ~10 s para ahorrar solo 0,4 ms
//   por solución: ver DECISIONES.md). Heurística = máximo: admisible, así que IDA* da la óptima.
// - Objetivos: el resuelto y sus rotaciones que pertenecen al grupo (3x3x2: y, y2, y' = U D' …): un
//   estado que «se ve resuelto» girado cuenta como resuelto. Las tablas se llenan desde todos ellos.
// - Poda de la búsqueda: dos giros seguidos del mismo eje solo en orden creciente de capa (las capas de
//   un eje conmutan), nunca la misma capa dos veces. No cambia la longitud óptima.

import { entero } from '../core/rng.js';

export const LIMITE_COMPLETO = 30_000_000;
export const LIMITE_PATRON = 3_000_000;

/** Índice de una variación: k valores distintos de 0..r-1 (en orden). */
function rangoVariacion(vals, r) {
  const usado = new Uint8Array(r);
  let idx = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    let d = 0;
    for (let x = 0; x < v; x++) if (!usado[x]) d++;
    usado[v] = 1;
    idx = idx * (r - i) + d;
  }
  return idx;
}
function variacionDe(idx, r, k) {
  const digitos = new Array(k);
  for (let i = k - 1; i >= 0; i--) { const b = r - i; digitos[i] = idx % b; idx = Math.floor(idx / b); }
  const usado = new Uint8Array(r);
  const vals = new Array(k);
  for (let i = 0; i < k; i++) {
    let d = digitos[i], x = 0;
    for (;; x++) if (!usado[x]) { if (d === 0) break; d--; }
    usado[x] = 1;
    vals[i] = x;
  }
  return vals;
}
const variaciones = (r, k) => { let t = 1; for (let i = 0; i < k; i++) t *= r - i; return t; };

/**
 * @param {ReturnType<import('./cuboide-geo.js').crearGeoCuboide>} G
 * @param {ReturnType<import('./cuboide-grupo.js').crearGrupoCuboide>} Gr
 */
export function crearSolverCuboide(G, Gr) {
  const movs = G.busqueda;
  const nM = movs.length;
  const imgM = movs.map((m) => Gr.imgs[m]);
  const ejeM = movs.map((m) => G.movimientos[m].eje);
  const capaM = movs.map((m) => G.movimientos[m].j);

  // órbitas que se mueven, con las posiciones posibles de las referencias de sus piezas
  const orbitas = Gr.orbitas.filter((o) => o.movil).map((o) => {
    const refs = [...new Set(o.piezas.flatMap((j) => [...Gr.tuplaDeRef[j].keys()]))].sort((x, y) => x - y);
    const local = new Map(refs.map((p, k) => [p, k]));
    return { piezas: o.piezas, refs, local, r: refs.length, tipo: o.tipo };
  });

  /** Coordenada: piezas (de una órbita) -> índice de variación, con tabla de movimientos. */
  function crearCoordenada(oi, piezas) {
    const o = orbitas[oi];
    const k = piezas.length, r = o.r;
    const tam = variaciones(r, k);
    // movimiento de cada posición local
    const mapa = imgM.map((g) => o.refs.map((p) => o.local.get(g[p])));
    const tabla = new Int32Array(tam * nM);
    for (let i = 0; i < tam; i++) {
      const v = variacionDe(i, r, k);
      for (let m = 0; m < nM; m++) tabla[i * nM + m] = rangoVariacion(v.map((x) => mapa[m][x]), r);
    }
    const ref = piezas.map((j) => G.piezas[j].pegatinas[0]);
    return {
      oi, piezas, tam, tabla,
      /** índice a partir de la imagen de pegatinas de un estado */
      codificar: (img) => rangoVariacion(ref.map((h) => o.local.get(img[h])), r),
    };
  }

  // coordenadas completas (una por órbita)
  const completas = orbitas.map((o, oi) => crearCoordenada(oi, o.piezas));
  const coords = completas.slice();
  const totalCompleto = completas.reduce((a, c) => a * c.tam, 1);
  const exacto = totalCompleto <= LIMITE_COMPLETO;
  /** patrones: listas de índices de `coords` */
  const patrones = [];
  if (exacto) patrones.push(completas.map((_, i) => i));
  else {
    // cada órbita entera + las primeras piezas de la órbita más grande de las demás que quepan
    completas.forEach((c, i) => {
      const lista = [i];
      let tam = c.tam;
      const otras = completas.map((_, k) => k).filter((k) => k !== i).sort((x, y) => orbitas[y].piezas.length - orbitas[x].piezas.length);
      for (const k of otras) {
        const o = orbitas[k];
        let m = 0;
        while (m < o.piezas.length && tam * variaciones(o.r, m + 1) <= LIMITE_PATRON) m++;
        if (m === 0) continue;
        if (m === o.piezas.length) { lista.push(k); tam *= completas[k].tam; continue; }
        coords.push(crearCoordenada(k, o.piezas.slice(0, m)));
        lista.push(coords.length - 1);
        tam *= coords[coords.length - 1].tam;
        break;
      }
      patrones.push(lista);
    });
  }
  const nC = coords.length;
  const nCompletas = completas.length;

  /** Valores de todas las coordenadas de un estado del grupo (imagen de pegatinas). */
  const valoresDe = (img) => coords.map((c) => c.codificar(img));
  // objetivos: el resuelto y sus rotaciones que están en el grupo
  const objetivos = Gr.rotEnG.map((r) => valoresDe(r));
  const claveCompleta = (v) => v.slice(0, nCompletas).join(',');
  const esObjetivo = new Set(objetivos.map(claveCompleta));

  let tablas = null;
  let msInit = 0;
  /** Tablas de distancias (BFS desde todos los objetivos). */
  function inicializar() {
    if (tablas) return { ms: msInit, yaEstaba: true };
    const t0 = Date.now();
    tablas = patrones.map((lista) => {
      const tams = lista.map((ci) => coords[ci].tam);
      const total = tams.reduce((a, b) => a * b, 1);
      const prof = new Int8Array(total).fill(-1);
      const idxDe = (vals) => lista.reduce((a, ci, k) => a * tams[k] + vals[ci], 0);
      let cola = new Int32Array(1024), fin = 0;
      const meter = (x) => { if (fin === cola.length) { const c2 = new Int32Array(Math.min(total, cola.length * 2)); c2.set(cola); cola = c2; } cola[fin++] = x; };
      for (const v of objetivos) { const i = idxDe(v); if (prof[i] < 0) { prof[i] = 0; meter(i); } }
      const L = lista.length;
      const tabs = lista.map((ci) => coords[ci].tabla);
      const vals = new Int32Array(L);
      let profMax = 0;
      for (let q = 0; q < fin; q++) {
        let r = cola[q];
        const d = prof[r];
        for (let k = L - 1; k >= 0; k--) { const t = tams[k]; const v = r % t; vals[k] = v; r = (r - v) / t; }
        for (let m = 0; m < nM; m++) {
          let j = 0;
          for (let k = 0; k < L; k++) j = j * tams[k] + tabs[k][vals[k] * nM + m];
          if (prof[j] < 0) { prof[j] = d + 1; if (d + 1 > profMax) profMax = d + 1; meter(j); }
        }
      }
      return { lista, tams, prof, alcanzables: fin, profMax };
    });
    msInit = Date.now() - t0;
    return { ms: msInit };
  }

  /** @param {ArrayLike<number>} v */
  function heuristica(v) {
    let h = 0;
    for (const t of tablas) {
      let idx = 0;
      for (let k = 0; k < t.lista.length; k++) idx = idx * t.tams[k] + v[t.lista[k]];
      const d = t.prof[idx];
      if (d < 0) return Infinity;
      if (d > h) h = d;
    }
    return h;
  }
  const mover = (v, m) => { const w = new Array(nC); for (let k = 0; k < nC; k++) w[k] = coords[k].tabla[v[k] * nM + m]; return w; };
  /** ¿Se puede poner el giro m después del giro u (−1 = ninguno)? */
  const permitido = (u, m) => u < 0 || ejeM[u] !== ejeM[m] || capaM[u] < capaM[m];

  /**
   * Solución óptima (lista de giros) de un estado del grupo dado por su imagen de pegatinas.
   * @returns {{ movimientos: string[], nodos: number } | null}
   */
  function resolverImg(img, maxProf = 40) {
    inicializar();
    const v0 = valoresDe(img);
    // (con la tabla exacta, IDA* no se desvía: solo sigue giros que bajan la distancia; la búsqueda
    // descarta los que la poda de ejes no permite)
    const h0 = heuristica(v0);
    if (h0 === Infinity) return null;
    const camino = [];
    let nodos = 0;
    function dfs(v, g, limite, u) {
      const h = heuristica(v);
      if (h === 0 && esObjetivo.has(claveCompleta(v))) return true;
      if (g + Math.max(h, 1) > limite) return false;
      for (let m = 0; m < nM; m++) {
        if (!permitido(u, m)) continue;
        nodos++;
        camino.push(m);
        if (dfs(mover(v, m), g + 1, limite, m)) return true;
        camino.pop();
      }
      return false;
    }
    for (let lim = h0; lim <= maxProf; lim++) if (dfs(v0, 0, lim, -1)) return { movimientos: camino.map((m) => movs[m]), nodos };
    return null;
  }

  /** Estado uniforme del grupo (imagen de pegatinas), con la cadena de Schreier–Sims. */
  const imgAleatoria = (rng) => Gr.cadena.aleatorio(rng);

  /** Distribución exacta de distancias (solo en espacio pequeño): [estados a distancia 0, 1, …]. */
  function distribucion() {
    if (!exacto) return null;
    inicializar();
    const t = tablas[0];
    const cuenta = new Array(t.profMax + 1).fill(0);
    for (let i = 0; i < t.prof.length; i++) if (t.prof[i] >= 0) cuenta[t.prof[i]]++;
    return cuenta;
  }

  return {
    movs, exacto, totalCompleto, coords, patrones, orbitas, objetivos, inicializar, estaInicializado: () => !!tablas,
    resolverImg, imgAleatoria, distribucion, heuristica, valoresDe, tablas: () => tablas, entero,
  };
}
