// Geometría 3D genérica para puzzles "de cortes planos" (Pyraminx, Skewb,
// Megaminx...). Un puzzle se describe con:
//   - las caras de un poliedro (normal + polígono 3D),
//   - los planos de corte (normal + distancia),
// y las pegatinas salen solas al trocear cada cara con todos los cortes.
// Un movimiento es una rotación de las pegatinas que están a un lado de un
// plano; de ahí se obtiene su permutación de pegatinas comparando centroides.
// También despliega el poliedro en una red 2D para dibujarlo.

export const sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const res = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const esc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cruz = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norma = (a) => Math.sqrt(dot(a, a));
export const unit = (a) => esc(a, 1 / norma(a));
export const dist = (a, b) => norma(res(a, b));

export function centroide(puntos) {
  let c = [0, 0, 0];
  for (const p of puntos) c = sum(c, p);
  return esc(c, 1 / puntos.length);
}

/** Devuelve una función que rota vectores `ang` radianes alrededor de `eje` (regla de la mano derecha). */
export function rotacion(eje, ang) {
  const k = unit(eje);
  const c = Math.cos(ang), s = Math.sin(ang);
  return (v) => {
    const kv = cruz(k, v);
    const kd = dot(k, v) * (1 - c);
    return [
      v[0] * c + kv[0] * s + k[0] * kd,
      v[1] * c + kv[1] * s + k[1] * kd,
      v[2] * c + kv[2] * s + k[2] * kd,
    ];
  };
}

/** Matriz 3x3 (filas) que lleva el vector `desde` al vector `hasta` (ambos se normalizan). */
export function rotacionEntre(desde, hasta) {
  const a = unit(desde), b = unit(hasta);
  const eje = cruz(a, b);
  const s = norma(eje);
  if (s < 1e-12) {
    if (dot(a, b) > 0) return (v) => v.slice();
    // 180 grados alrededor de un eje perpendicular cualquiera
    const perp = Math.abs(a[0]) < 0.9 ? cruz(a, [1, 0, 0]) : cruz(a, [0, 1, 0]);
    return rotacion(perp, Math.PI);
  }
  return rotacion(eje, Math.atan2(s, dot(a, b)));
}

const EPS = 1e-9;

/**
 * Corta un polígono convexo por el plano n·x = h.
 * Devuelve [parteDentro (n·x > h), parteFuera] o null en la parte vacía.
 */
export function cortarPoligono(poly, n, h) {
  const d = poly.map((p) => dot(p, n) - h);
  const hayDentro = d.some((x) => x > EPS);
  const hayFuera = d.some((x) => x < -EPS);
  if (!hayDentro) return [null, poly];
  if (!hayFuera) return [poly, null];
  const dentro = [], fuera = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = d[i], dq = d[(i + 1) % poly.length];
    if (dp >= -EPS) dentro.push(p);
    if (dp <= EPS) fuera.push(p);
    if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) {
      const t = dp / (dp - dq);
      const x = sum(p, esc(res(q, p), t));
      dentro.push(x);
      fuera.push(x);
    }
  }
  return [dentro.length >= 3 ? dentro : null, fuera.length >= 3 ? fuera : null];
}

/**
 * Trocea cada cara con todos los planos de corte.
 * caras: [{normal, poligono}], cortes: [{n, h}]
 * Devuelve pegatinas [{cara, poligono, centro}] ordenadas por cara.
 */
export function construirPegatinas(caras, cortes) {
  const pegatinas = [];
  caras.forEach((cara, ci) => {
    let trozos = [cara.poligono];
    for (const c of cortes) {
      const nuevos = [];
      for (const t of trozos) {
        const [a, b] = cortarPoligono(t, c.n, c.h);
        if (a) nuevos.push(a);
        if (b) nuevos.push(b);
      }
      trozos = nuevos;
    }
    for (const t of trozos) {
      // descartar astillas degeneradas
      if (areaPoligono3D(t) < 1e-7) continue;
      pegatinas.push({ cara: ci, poligono: t, centro: centroide(t) });
    }
  });
  return pegatinas;
}

export function areaPoligono3D(poly) {
  let acc = [0, 0, 0];
  for (let i = 1; i + 1 < poly.length; i++) {
    acc = sum(acc, cruz(res(poly[i], poly[0]), res(poly[i + 1], poly[0])));
  }
  return norma(acc) / 2;
}

/** Busca el índice de la pegatina cuyo centro está en `p`. */
function buscarPegatina(pegatinas, p, tol) {
  let mejor = -1, md = Infinity;
  for (let i = 0; i < pegatinas.length; i++) {
    const d = dist(pegatinas[i].centro, p);
    if (d < md) { md = d; mejor = i; }
  }
  if (md > tol) throw new Error('Geometría: no se encontró la pegatina destino (distancia ' + md + ')');
  return mejor;
}

/**
 * Permutación (nuevo[i] = viejo[P[i]]) de girar `ang` radianes alrededor de `eje`
 * las pegatinas cuyo centro cumple `dentro(centro)`.
 */
export function permDeGiro(pegatinas, eje, ang, dentro, tol = 1e-6) {
  const rot = rotacion(eje, ang);
  const P = pegatinas.map((_, i) => i);
  pegatinas.forEach((s, j) => {
    if (!dentro(s.centro)) return;
    const k = buscarPegatina(pegatinas, rot(s.centro), tol);
    P[k] = j;
  });
  // Comprobación: debe ser una permutación
  const visto = new Uint8Array(P.length);
  for (const x of P) {
    if (visto[x]) throw new Error('Geometría: el giro no es una permutación');
    visto[x] = 1;
  }
  return P;
}

/** Vértices de las caras: agrupa los vértices del poliedro que están en el plano de cada normal. */
export function carasDesdeVertices(vertices, normales) {
  return normales.map((n0) => {
    const n = unit(n0);
    const maxd = Math.max(...vertices.map((v) => dot(v, n)));
    const enCara = vertices.filter((v) => Math.abs(dot(v, n) - maxd) < 1e-6);
    // ordenar en sentido antihorario visto desde fuera
    const c = centroide(enCara);
    const u = unit(res(enCara[0], c));
    const w = cruz(n, u);
    enCara.sort((a, b) => {
      const da = res(a, c), db = res(b, c);
      return Math.atan2(dot(da, w), dot(da, u)) - Math.atan2(dot(db, w), dot(db, u));
    });
    return { normal: n, poligono: enCara };
  });
}

/**
 * Despliega caras en 2D.
 * caras: [{normal, poligono}]
 * arbol: { raiz, arriba (vector 3D que en 2D apuntará hacia arriba), hijos: [[hija, padre], ...] }
 * Devuelve un array de funciones (por cara) que llevan un punto 3D de esa cara a 2D [x, y]
 * (y hacia abajo, como en SVG).
 */
export function desplegar(caras, arbol, origen2D = [0, 0]) {
  const mapas = new Array(caras.length).fill(null);
  const centro3 = caras.map((c) => centroide(c.poligono));
  {
    const r = arbol.raiz;
    const n = caras[r].normal;
    const c = centro3[r];
    let up = res(arbol.arriba, esc(n, dot(arbol.arriba, n)));
    up = unit(up);
    const der = cruz(up, n); // derecha vista desde fuera
    mapas[r] = (p) => {
      const d = res(p, c);
      return [origen2D[0] + dot(d, der), origen2D[1] - dot(d, up)];
    };
  }
  let pendientes = arbol.hijos.slice();
  let guard = 0;
  while (pendientes.length && guard++ < 100) {
    const resto = [];
    for (const [hija, padre] of pendientes) {
      if (!mapas[padre]) { resto.push([hija, padre]); continue; }
      const comunes = caras[hija].poligono.filter((v) =>
        caras[padre].poligono.some((w) => dist(v, w) < 1e-6));
      if (comunes.length !== 2) throw new Error('Despliegue: las caras ' + hija + ' y ' + padre + ' no comparten arista');
      const [p, q] = comunes;
      const e = unit(res(q, p));
      const nh = caras[hija].normal;
      let m = cruz(nh, e);
      if (dot(res(centro3[hija], p), m) < 0) m = esc(m, -1);
      const P2 = mapas[padre](p), Q2 = mapas[padre](q);
      const ex = Q2[0] - P2[0], ey = Q2[1] - P2[1];
      const el = Math.hypot(ex, ey);
      const e2 = [ex / el, ey / el];
      let w2 = [-e2[1], e2[0]];
      const C2 = mapas[padre](centro3[padre]);
      if ((C2[0] - P2[0]) * w2[0] + (C2[1] - P2[1]) * w2[1] > 0) w2 = [-w2[0], -w2[1]];
      mapas[hija] = (x) => {
        const d = res(x, p);
        const a = dot(d, e), b = dot(d, m);
        return [P2[0] + a * e2[0] + b * w2[0], P2[1] + a * e2[1] + b * w2[1]];
      };
    }
    pendientes = resto;
  }
  return mapas;
}
