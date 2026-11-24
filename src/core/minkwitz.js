// @ts-check
// Tablas de Minkwitz: resolver un grupo de permutaciones con palabras cortas (noche 13).
//
// Lo usa la fase 2 de la estrategia B de los cubos vendados grandes (4x4, 5x5): desde la
// geometría resuelta, las secuencias legales que vuelven a ella forman un grupo (el de la fase
// 2), generado por los "lazos" del BFS de geometrías, que son palabras de giros legales. Una
// búsqueda (IDA*) no llega a resolver un 4x4 entero; esto sí, con soluciones largas pero
// siempre correctas: es un "método por piezas" automático.
//
// T. Minkwitz, "An Algorithm for Solving the Factorization Problem in Permutation Groups",
// J. Symbolic Computation 26 (1998). Para una base b₁…bₙ (un punto de cada pieza, en el orden
// en que se van a colocar), la tabla k guarda, para cada posición q de la órbita de b_k bajo el
// estabilizador de b₁…b_{k−1}, un elemento u con u(b_k) = q y la palabra más corta encontrada
// para él. Resolver: para k = 1…n, la pieza k está en q: se aplica la palabra de u⁻¹ (la lleva
// a su sitio sin mover las anteriores). Las tablas se llenan cribando productos de los
// generadores al azar y productos de entradas de las tablas, quedándose siempre con la palabra
// más corta (y siguiendo la criba con la que sobra).
//
// Convención (la de schreier.js): perm[p] = imagen de p; producto(a, b) = primero a, luego b.

import { permProducto as producto, permInversa as inversa, crearCadena, completarAleatorio } from './schreier.js';

/**
 * @import { Rng } from './tipos.js'
 * @typedef {{ perm: Int16Array, palabra: number[] }} Generador
 * @typedef {{ perm: Int16Array, inv: Int16Array, palabra: number[], palabraInv: number[] }} Entrada  u y u⁻¹, palabras de u y u⁻¹
 * @typedef {ReturnType<typeof crearTablasMinkwitz>} TablasMinkwitz
 */

/**
 * @param {{ puntos: number, base: number[], generadores: Generador[], inverso: (m: number) => number,
 *   reducir?: (palabra: number[]) => number[], rng: Rng, msMax?: number, longitudMax?: number }} opciones
 *   inverso: índice del giro inverso; reducir: simplifica una palabra (U U -> U2…) sin cambiar el elemento.
 */
export function crearTablasMinkwitz({ puntos: P, base, generadores, inverso, reducir = (w) => w, rng, msMax = 3000, longitudMax = 3000 }) {
  const t0 = Date.now();
  const n = base.length;
  /** @param {number[]} w */
  const invPalabra = (w) => { const r = new Array(w.length); for (let i = 0; i < w.length; i++) r[i] = inverso(w[w.length - 1 - i]); return r; };
  /** @param {number[]} a @param {number[]} b */
  const unir = (a, b) => reducir(a.concat(b));

  // Órbitas que hay que cubrir: las de una cadena con esta base (Schreier–Sims aleatorio)
  const cadena = crearCadena(P, { prefijo: base, sinSchreier: true });
  completarAleatorio(cadena, generadores.map((g) => g.perm), rng, { seguidas: 40 });
  const orbita = base.map((_, k) => cadena.niveles[k].rep.size);
  if (cadena.niveles.length > n) throw new Error('Minkwitz: la base no es una base del grupo');

  const id = new Int16Array(P); for (let i = 0; i < P; i++) id[i] = i;
  // tablas[k][q] = entrada (o undefined); tam[k] = entradas de la tabla k
  /** @type {Array<Array<Entrada | undefined>>} */
  const tablas = base.map((b) => { const T = new Array(P); T[b] = { perm: id, inv: id, palabra: [], palabraInv: [] }; return T; });
  const tam = base.map(() => 1);
  let llenas = tam.filter((t, k) => t === orbita[k]).length;
  /** @param {Int16Array} g @param {Int16Array} gi @param {number[]} w @returns {Entrada} */
  const entrada = (g, gi, w) => ({ perm: g, inv: gi, palabra: w, palabraInv: invPalabra(w) });
  // último nivel con la tabla incompleta (−1 si todas están llenas)
  let ultimaIncompleta = -1;
  const actualizarUltima = () => { ultimaIncompleta = -1; for (let k = n - 1; k >= 0; k--) if (tam[k] < orbita[k]) { ultimaIncompleta = k; break; } };
  actualizarUltima();
  // Límite de longitud de las palabras que se criban: bajo (las largas casi nunca acaban en la
  // tabla y cribarlas es caro; medido: con 60 las soluciones del 4x4 salen un 15 % más cortas que
  // con 250 en el mismo tiempo), SALVO si por debajo queda algún nivel incompleto: los restos que
  // llegan a los niveles profundos son largos y son los únicos que pueden llenarlos (la mejora
  // los acorta después).
  let limite = Math.min(60, longitudMax);
  let rescate = false;

  const img = new Int16Array(n);
  /** @type {Int16Array[]} */
  const factores = [];
  /**
   * Criba el elemento g (con su palabra) desde el nivel k; guarda en las tablas lo que mejore.
   * Solo se siguen las imágenes de los puntos base que faltan; el elemento entero (g por los u⁻¹
   * que se han ido aplicando) se calcula únicamente cuando hay que guardarlo.
   * @param {Int16Array} g @param {number[]} w @param {number} k
   */
  function cribar(g, w, k = 0) {
    for (let j = k; j < n; j++) img[j] = g[base[j]];
    factores.length = 0;
    const entero = () => { for (const f of factores) g = producto(g, f); factores.length = 0; return g; };
    for (; k < n; k++) {
      if (w.length > (rescate && k <= ultimaIncompleta ? longitudMax : limite)) return;
      const q = img[k];
      const T = tablas[k];
      const u = T[q];
      if (!u) {
        const ge = entero();
        T[q] = entrada(ge, inversa(ge), w);
        if (++tam[k] === orbita[k]) { llenas++; actualizarUltima(); }
        return; // lo que queda es la identidad
      }
      if (w.length < u.palabra.length) {
        // la nueva es más corta: se guarda y se sigue cribando la vieja (u · g⁻¹ fija b_k)
        const ge = entero(), gi = inversa(ge);
        const nueva = entrada(ge, gi, w);
        T[q] = nueva;
        g = producto(u.perm, gi); w = unir(u.palabra, nueva.palabraInv);
        for (let j = k + 1; j < n; j++) img[j] = g[base[j]];
      } else {
        const ui = u.inv;
        factores.push(ui);
        for (let j = k + 1; j < n; j++) img[j] = ui[img[j]];
        w = unir(w, u.palabraInv);
      }
    }
  }

  // 1) los generadores y sus inversos
  for (const s of generadores) { cribar(s.perm, reducir(s.palabra)); cribar(inversa(s.perm), invPalabra(s.palabra)); }
  // 2) productos al azar de generadores, cada vez más largos mientras falten entradas
  const nG = generadores.length;
  /** @type {Generador[]} */
  const conInv = generadores.concat(generadores.map((s) => ({ perm: inversa(s.perm), palabra: invPalabra(s.palabra) })));
  let pasos = 0;
  const limiteFase = msMax * 0.6;
  let largo = 4;
  // (si al acabar faltan entradas, se sigue en modo rescate, hasta 2·msMax: se admiten palabras
  // largas en los niveles que faltan)
  while ((Date.now() - t0 < limiteFase) || (llenas < n && Date.now() - t0 < 2 * msMax)) {
    rescate = Date.now() - t0 >= limiteFase;
    let g = id, w = /** @type {number[]} */ ([]);
    for (let i = 0; i < largo; i++) {
      const s = conInv[Math.floor(rng() * 2 * nG)];
      g = producto(g, s.perm); w = unir(w, s.palabra);
      cribar(g, w);
      pasos++;
    }
  }
  const rescatadas = rescate;
  rescate = false;
  // 3) mejorar: productos de dos entradas de las tablas (como en el artículo)
  /** @type {Entrada[]} */
  let todas = [];
  // (ordenadas por longitud: se eligen sobre todo las cortas, que son las que pueden mejorar algo)
  const recoger = () => { todas = []; for (const T of tablas) for (const e of T) if (e && e.palabra.length) todas.push(e); todas.sort((x, y) => x.palabra.length - y.palabra.length); };
  recoger();
  let ronda = 0;
  while (Date.now() - t0 < msMax && todas.length) {
    const elegir = () => todas[Math.floor(rng() * rng() * todas.length)];
    const a = elegir(), b = elegir();
    if (rng() < 0.5) cribar(producto(a.perm, b.perm), unir(a.palabra, b.palabra));
    else cribar(producto(a.perm, b.inv), unir(a.palabra, b.palabraInv));
    if (++ronda % 5000 === 0) recoger();
  }

  /**
   * @param {number[] | Int16Array} posiciones
   * @param {Int16Array | number[] | null} clase
   * @returns {number[] | null}
   */
  function resolverDesde(posiciones, clase) {
    // x: elemento con x(b_k) = posición actual de la pieza k
    const pos = Int16Array.from(posiciones);
    /** @type {number[]} */
    let res = [];
    for (let k = 0; k < n; k++) {
      if (clase && clase[k] >= 0) {
        // la pieza igual (sin colocar) más barata de llevar a b_k
        let mejor = -1, lon = Infinity;
        for (let j = k; j < n; j++) {
          if (clase[j] !== clase[k]) continue;
          const e = tablas[k][pos[j]];
          if (e && e.palabra.length < lon) { lon = e.palabra.length; mejor = j; }
        }
        if (mejor < 0) return null;
        if (mejor !== k) { const t = pos[k]; pos[k] = pos[mejor]; pos[mejor] = t; }
      }
      const u = tablas[k][pos[k]];
      if (!u) return null;
      if (!u.palabra.length) continue;
      res = res.concat(u.palabraInv);
      const ui = u.inv;
      for (let j = k; j < n; j++) pos[j] = ui[pos[j]];
    }
    return reducir(res);
  }

  const completo = llenas === n;
  let suma = 0, entradas = 0;
  for (const T of tablas) for (const e of T) if (e) { suma += e.palabra.length; entradas++; }
  return {
    base, tablas, orbita, completo,
    info: { niveles: n, entradas, longitudMedia: entradas ? +(suma / entradas).toFixed(1) : 0, completo, ms: Date.now() - t0, pasos, rescate: rescatadas },
    /**
     * Palabra que resuelve un estado: posiciones[k] = dónde está ahora el punto base[k] (la pieza
     * k). null si falta alguna entrada.
     *
     * Piezas iguales (clase[k] ≥ 0: centros del mismo color que no están en ningún bloque): en
     * el nivel k vale cualquier pieza de su clase que aún no esté colocada; se elige la que tenga
     * la palabra más corta (se intercambian sus etiquetas: el estado se ve igual). Si con eso se
     * llega a un nivel sin entrada (el reetiquetado cambió la paridad), se resuelve sin elegir.
     * @param {number[] | Int16Array} posiciones
     * @param {Int16Array | number[] | null} [clase]
     * @returns {number[] | null}
     */
    resolver(posiciones, clase = null) {
      if (clase) {
        const r = resolverDesde(posiciones, clase);
        if (r) return r;
      }
      return resolverDesde(posiciones, null);
    },
  };
}
