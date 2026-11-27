// Cuboides (noche 15): grupo de los giros, órbitas de las piezas, restricciones e identificación
// de un estado de colores. Genérico: vale para cualquier crearGeoCuboide(a, b, c).
//
// Convención de las permutaciones de este módulo (la de src/core/schreier.js): `img[p]` = adónde va
// la pegatina p. Un estado del grupo es la imagen de cada pegatina del resuelto.
//
// - G = grupo que generan los giros de búsqueda (geo.busqueda: los centros o una capa quedan fijos).
//   Cadena de Schreier–Sims (orden exacto, pertenencia, elemento uniforme).
// - Colocaciones: para cada pieza, la órbita de su tupla de pegatinas con G (dónde puede estar y
//   cómo). Si en cada hueco cabe de una sola forma, su orientación la decide la posición.
// - Restricciones: rasgos ℤ₂ de un estado (paridad de la permutación de cada órbita de huecos y,
//   en las órbitas en las que una pieza cabe de dos formas en cada hueco, la paridad de cuántas
//   están «volteadas»). Las combinaciones que ningún giro cambia son las restricciones (núcleo por
//   eliminación de Gauss). El orden del grupo calculado con Schreier–Sims coincide con el producto
//   de las disposiciones libres dividido entre 2^(restricciones): así se demuestra que no hay más.

import { crearCadena } from '../core/schreier.js';

/** Imagen (adónde va cada pegatina) a partir de la permutación de geo (nuevo[i] = viejo[P[i]]). */
export function imagenDe(P) {
  const img = new Int16Array(P.length);
  for (let i = 0; i < P.length; i++) img[P[i]] = i;
  return img;
}
const producto = (a, b) => { const r = new Int16Array(a.length); for (let i = 0; i < a.length; i++) r[i] = b[a[i]]; return r; };

/** Paridad (0/1) de una permutación dada como array (p[i] = imagen). */
function paridadDe(p) {
  const n = p.length, visto = new Uint8Array(n);
  let par = 0;
  for (let i = 0; i < n; i++) {
    if (visto[i]) continue;
    let j = i, largo = 0;
    while (!visto[j]) { visto[j] = 1; j = p[j]; largo++; }
    par ^= (largo - 1) & 1;
  }
  return par;
}

// 24 rotaciones de un cubito (matrices de signos con determinante +1) y las 24 simetrías impropias
const MATRICES = (() => {
  const r = [];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) for (let sg = 0; sg < 8; sg++) {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let f = 0; f < 3; f++) M[f][p[f]] = (sg >> f) & 1 ? -1 : 1;
    const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    r.push({ M, propia: det > 0 });
  }
  return r;
})();
const NORMAL_CARA = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
const caraDeNormal = (v) => NORMAL_CARA.findIndex((n) => n[0] === v[0] && n[1] === v[1] && n[2] === v[2]);
const mulMV = (M, v) => [0, 1, 2].map((f) => M[f][0] * v[0] + M[f][1] * v[1] + M[f][2] * v[2]);

/**
 * @param {ReturnType<import('./cuboide-geo.js').crearGeoCuboide>} G geometría
 */
export function crearGrupoCuboide(G) {
  const n = G.n;
  const imgs = {};
  for (const [m, d] of Object.entries(G.movimientos)) imgs[m] = imagenDe(d.perm);
  const gens = G.busqueda.map((m) => imgs[m]);
  const cadena = crearCadena(n);
  for (const g of gens) cadena.incluir(g);
  const orden = cadena.orden();

  // rotaciones del puzzle entero (las 8 que conservan la forma en un cuboide no cúbico) y cuáles están en G
  const rotImgs = G.geo.rotaciones.map((P) => imagenDe(P));
  const rotEnG = rotImgs.filter((r) => cadena.contiene(r));

  // ---------- Colocaciones de cada pieza con G ----------
  const piezas = G.piezas;
  const huecoDe = G.piezaDePegatina;
  const colocaciones = piezas.map((p) => {
    const porHueco = new Map(); // hueco -> [tuplas]
    const vistos = new Set([p.pegatinas.join(',')]);
    const cola = [p.pegatinas.slice()];
    while (cola.length) {
      const t = cola.pop();
      const h = huecoDe[t[0]];
      if (!porHueco.has(h)) porHueco.set(h, []);
      porHueco.get(h).push(t);
      for (const g of gens) {
        const u = t.map((i) => g[i]);
        const k = u.join(',');
        if (!vistos.has(k)) { vistos.add(k); cola.push(u); }
      }
    }
    return porHueco;
  });
  // la posición de la pegatina de referencia (la primera) determina la colocación entera
  const tuplaDeRef = piezas.map((p, j) => {
    const m = new Map();
    for (const lista of colocaciones[j].values()) for (const t of lista) {
      if (m.has(t[0])) throw new Error(`Cuboide: la pieza ${p.nombre} tiene dos colocaciones con la misma pegatina de referencia`);
      m.set(t[0], t);
    }
    return m;
  });
  const movil = piezas.map((p, j) => colocaciones[j].size > 1 || colocaciones[j].get(j).length > 1);

  // órbitas de huecos: piezas con el mismo conjunto de huecos posibles
  const orbitas = [];
  piezas.forEach((p, j) => {
    const clave = [...colocaciones[j].keys()].sort((x, y) => x - y).join(',');
    let o = orbitas.find((x) => x.clave === clave);
    if (!o) { o = { clave, huecos: clave.split(',').map(Number), piezas: [], tipo: p.tipo }; orbitas.push(o); }
    o.piezas.push(j);
  });
  orbitas.forEach((o) => {
    // formas de colocar una pieza en cada hueco (igual para todos los huecos y piezas de la órbita)
    const formas = new Set(o.piezas.flatMap((j) => [...colocaciones[j].values()].map((l) => l.length)));
    if (formas.size !== 1) throw new Error('Cuboide: número de colocaciones distinto dentro de una órbita');
    o.formas = [...formas][0];
    o.movil = o.huecos.length > 1 || o.formas > 1;
  });

  // ---------- Rasgos ℤ₂ y restricciones ----------
  /** Rasgos de un estado del grupo dado por su imagen: [paridad por órbita de >1 hueco, volteos por órbita de 2 formas]. */
  const rasgosDef = [];
  orbitas.forEach((o, oi) => {
    if (o.huecos.length > 1) rasgosDef.push({ tipo: 'paridad', orbita: oi });
    if (o.formas === 2) rasgosDef.push({ tipo: 'volteo', orbita: oi });
  });
  /** Para un estado como imagen de pegatinas: hueco de cada pieza y si está volteada (ref fuera de la 1ª pegatina del hueco). */
  function huecosYVolteos(img) {
    const hueco = new Int16Array(piezas.length), volteo = new Uint8Array(piezas.length);
    piezas.forEach((p, j) => {
      const pos = img[p.pegatinas[0]];
      const h = huecoDe[pos];
      hueco[j] = h;
      volteo[j] = piezas[h].pegatinas[0] === pos ? 0 : 1;
    });
    return { hueco, volteo };
  }
  function rasgos(img) {
    const { hueco, volteo } = huecosYVolteos(img);
    return rasgosDef.map((r) => {
      const o = orbitas[r.orbita];
      if (r.tipo === 'volteo') return o.piezas.reduce((acc, j) => acc ^ volteo[j], 0);
      const idx = new Map(o.huecos.map((h, k) => [h, k]));
      return paridadDe(o.piezas.map((j) => idx.get(hueco[j])));
    });
  }
  // núcleo: combinaciones c (máscaras de rasgos) con c·v = 0 para el vector v de cada generador
  const R = rasgosDef.length;
  const filas = gens.map((g) => rasgos(g));
  const restricciones = nucleoZ2(filas, R).map((c) => ({ mascara: c, rasgos: c.map((b, k) => (b ? rasgosDef[k] : null)).filter(Boolean) }));
  // orden previsto si solo existen esas restricciones
  let previsto = 1n;
  for (const o of orbitas) {
    let f = 1n;
    for (let k = 2; k <= o.huecos.length; k++) f *= BigInt(k);
    previsto *= f * BigInt(o.formas) ** BigInt(o.piezas.length);
  }
  previsto /= 2n ** BigInt(restricciones.length);

  /** Restricciones que no cumple un estado (imagen). */
  const incumplidas = (img) => {
    const v = rasgos(img);
    return restricciones.filter((r) => r.mascara.reduce((acc, b, k) => acc ^ (b & v[k]), 0) === 1);
  };

  // ---------- Identificación de un estado de colores ----------
  const resuelto = G.resuelto;
  const coloresPieza = piezas.map((p) => p.pegatinas.map((i) => resuelto[i]));
  const claveColores = (cs) => cs.slice().sort((x, y) => x - y).join(',');
  const piezaPorColores = new Map();
  coloresPieza.forEach((cs, j) => {
    const k = claveColores(cs);
    if (piezaPorColores.has(k)) throw new Error('Cuboide: dos piezas con los mismos colores (no soportado todavía)');
    piezaPorColores.set(k, j);
  });

  /** ¿Se puede poner la pieza j en el hueco h con estos colores mediante un giro rígido (propia) o solo con un espejo? */
  function rigido(j, h, colores) {
    const pj = piezas[j], ph = piezas[h];
    if (pj.pegatinas.length !== ph.pegatinas.length) return null;
    const normJ = pj.pegatinas.map((i) => NORMAL_CARA[G.caraDe[i]]);
    const caraH = new Map(ph.pegatinas.map((i) => [G.caraDe[i], i]));
    let propia = false, impropia = false;
    for (const { M, propia: pr } of MATRICES) {
      let ok = true;
      for (let r = 0; r < normJ.length && ok; r++) {
        const f = caraDeNormal(mulMV(M, normJ[r]));
        const dest = caraH.get(f);
        if (dest === undefined || colores[dest] !== coloresPieza[j][r]) ok = false;
      }
      if (ok) { if (pr) propia = true; else impropia = true; }
    }
    return { propia, impropia };
  }

  /**
   * Identifica las piezas de un estado de colores (ya reetiquetado). Devuelve
   * { errores: [{ tipo, hueco, pieza, ... }], img (imagen de pegatinas si no hay errores) }.
   * Tipos de error: 'inexistente', 'repetida', 'falta', 'especular', 'orbita', 'orientacion'.
   */
  function identificar(colores) {
    const errores = [];
    const asignada = new Int16Array(piezas.length).fill(-1); // hueco -> pieza
    const usos = new Int16Array(piezas.length);
    piezas.forEach((ph, h) => {
      const cs = ph.pegatinas.map((i) => colores[i]);
      const j = piezaPorColores.get(claveColores(cs));
      if (j === undefined) { errores.push({ tipo: 'inexistente', hueco: h, colores: cs }); return; }
      asignada[h] = j;
      usos[j]++;
    });
    usos.forEach((u, j) => {
      if (u > 1) errores.push({ tipo: 'repetida', pieza: j, veces: u });
      else if (u === 0 && !errores.some((e) => e.tipo === 'inexistente')) errores.push({ tipo: 'falta', pieza: j });
    });
    if (errores.length) return { errores, img: null };
    const img = new Int16Array(n);
    piezas.forEach((ph, h) => {
      const j = asignada[h];
      const lista = colocaciones[j].get(h);
      if (!lista) {
        const r = rigido(j, h, colores);
        if (r && !r.propia && r.impropia) errores.push({ tipo: 'especular', hueco: h, pieza: j });
        else errores.push({ tipo: 'orbita', hueco: h, pieza: j });
        return;
      }
      const t = lista.find((u) => u.every((pos, r) => colores[pos] === coloresPieza[j][r]));
      if (!t) {
        const r = rigido(j, h, colores);
        errores.push({ tipo: r && !r.propia && r.impropia ? 'especular' : 'orientacion', hueco: h, pieza: j, correcta: lista[0] });
        return;
      }
      piezas[j].pegatinas.forEach((home, r) => { img[home] = t[r]; });
    });
    return { errores, img: errores.length ? null : img };
  }

  /** Colores de un estado del grupo (imagen de pegatinas). */
  function coloresDe(img) {
    const c = new Array(n);
    for (let h = 0; h < n; h++) c[img[h]] = resuelto[h];
    return c;
  }

  return {
    imgs, gens, cadena, orden, rotImgs, rotEnG, colocaciones, tuplaDeRef, movil, orbitas, rasgosDef, rasgos,
    restricciones, previsto, incumplidas, identificar, coloresDe, coloresPieza, huecosYVolteos, producto,
  };
}

/** Núcleo (base) de la matriz `filas` (vectores de longitud R sobre ℤ₂): vectores c con fila·c = 0 para toda fila. */
function nucleoZ2(filas, R) {
  const M = filas.map((f) => f.slice());
  const piv = [];
  let r = 0;
  for (let col = 0; col < R && r < M.length; col++) {
    let k = r;
    while (k < M.length && !M[k][col]) k++;
    if (k === M.length) continue;
    [M[r], M[k]] = [M[k], M[r]];
    for (let i = 0; i < M.length; i++) if (i !== r && M[i][col]) for (let q = 0; q < R; q++) M[i][q] ^= M[r][q];
    piv.push(col);
    r++;
  }
  const libres = [];
  for (let col = 0; col < R; col++) if (!piv.includes(col)) libres.push(col);
  return libres.map((f) => {
    const c = new Array(R).fill(0);
    c[f] = 1;
    piv.forEach((col, i) => { if (M[i][f]) c[col] = 1; });
    return c;
  });
}
