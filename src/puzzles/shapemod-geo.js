// Shape mods del 3x3 (noche 16): geometría de las piezas.
//
// Un shape mod es un 3x3 por dentro (mismo mecanismo, mismos giros) con otra forma por fuera. El
// mecanismo está en su marco de referencia: ejes x = R, y = U, z = F y los planos de corte en
// x, y, z = ±c (los de cualquier 3x3: tienen que estar a la misma distancia en los tres ejes o el
// puzzle se bloquearía tras un giro de 90°). Lo que cambia es el CUERPO: un cubo de semilado h,
// con su centro desplazado respecto al del mecanismo y, si se quiere, inclinado. Cada pieza es
// (celda del mecanismo) ∩ (cuerpo): un poliedro convexo (intersección de semiespacios), que se
// calcula una vez y viaja con la pieza.
//
// Capas desfasadas (Ghost Cube): en la forma de cubo, las capas de arriba y de abajo están giradas
// un ángulo cualquiera alrededor de y respecto a la del medio (el cubo resuelto es un 3x3 «a mitad
// de giro»). Una pieza de esas capas se corta del cuerpo girado hacia atrás lo que gira su capa, así
// que, con las capas alineadas (lo que hace falta para girar cualquier otra cara), el cuerpo no es un
// cubo; al girarlas lo que dice `desfase`, vuelve a serlo.
//
// Estado por piezas: el de kociemba.js (cp, co, ep, eo; cp[i] = pieza en la posición i, la
// pegatina j de la pieza va a la pegatina (j + co) mod 3 de la posición) + ct[f] (giros de 90° del
// centro de la cara f, en el sentido de las agujas del reloj mirándola de frente).
//
// Huecos (slots): 0–7 esquinas (URF UFL ULB UBR DFR DLF DBL DRB), 8–19 aristas (UR UF UL UB DR DF
// DL DB FR FL BL BR), 20–25 centros (U R F D L B): el orden de kociemba.js.

export const CARAS = ['U', 'R', 'F', 'D', 'L', 'B'];
export const DIR = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
export const ESQ_CARAS = [['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'], ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B']];
export const ARI_CARAS = [['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'], ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R']];
/** caras de cada hueco (pegatinas del 3x3 que tendría) */
export const CARAS_HUECO = [...ESQ_CARAS, ...ARI_CARAS, ...CARAS.map((f) => [f])];
export const NOMBRE_HUECO = CARAS_HUECO.map((c) => c.join(''));
export const TIPO_HUECO = CARAS_HUECO.map((c) => (c.length === 3 ? 'esquina' : c.length === 2 ? 'arista' : 'centro'));
export const N_HUECOS = 26;

// ---------- álgebra mínima ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const res = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const esc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = (a) => Math.sqrt(dot(a, a));
const unit = (a) => esc(a, 1 / norma(a));
/** matriz (filas) por vector */
export const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
/** producto de matrices (filas): A·B */
export const mm = (A, B) => A.map((f) => [0, 1, 2].map((j) => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
export const ID3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** matriz de la rotación de `ang` radianes alrededor de `eje` (mano derecha) */
export function matRot(eje, ang) {
  const [x, y, z] = unit(eje);
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  const M = [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
  // los giros de 90°/180° alrededor de los ejes, exactos (sin 1e-17)
  return M.map((f) => f.map((v) => (Math.abs(v - Math.round(v)) < 1e-12 ? Math.round(v) + 0 : v)));
}
/** suma de productos exteriores Σ destino_j ⊗ origen_j: lleva cada origen_j a su destino_j */
function matDeParejas(origenes, destinos) {
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  origenes.forEach((o, j) => { const d = destinos[j]; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) M[r][c] += d[r] * o[c]; });
  return M;
}

/**
 * Cubo inclinado respecto al mecanismo (Ghost Cube). En coordenadas del CUBO (ejes de sus caras): `arriba` =
 * eje y del mecanismo (en el que se apilan las capas desfasadas); los otros dos ejes del mecanismo están en
 * el plano perpendicular, girados `giroMedio` desde e1 = arriba × (0,1,0); `centro` = centro del cubo visto
 * desde el del mecanismo, también en coordenadas del cubo. Devuelve { ejes, centro } en el marco del
 * mecanismo (lo que pide crearGeoShapeMod).
 */
export function cuboInclinado(arriba, giroMedio, centro) {
  const up = unit(arriba);
  const e1 = unit(cruz(up, [0, 1, 0])), e2 = cruz(up, e1);
  const c = Math.cos(giroMedio), s = Math.sin(giroMedio);
  const a1 = sum(esc(e1, c), esc(e2, s)), a2 = sum(esc(e1, -s), esc(e2, c));
  // filas: ejes x, y, z del mecanismo en coordenadas del cubo (x = a2, y = arriba, z = a1: marco directo)
  const M = [a2, up, a1];
  return { ejes: [0, 1, 2].map((j) => [M[0][j], M[1][j], M[2][j]]), centro: mv(M, centro) };
}

// ---------- poliedros convexos ----------
// Poliedro = { caras: [{ pts: Vec3[], n: Vec3 (saliente), tipo: 'exterior' | 'corte' | 'caja' }] }.
const TOL = 1e-9;

function cajaGrande(L) {
  const caras = [];
  for (let a = 0; a < 3; a++) {
    for (const s of [1, -1]) {
      const n = [0, 0, 0]; n[a] = s;
      const u = [0, 0, 0]; u[(a + 1) % 3] = 1;
      const w = cruz(n, u);
      const c = esc(n, L);
      const pts = [sum(sum(c, esc(u, L)), esc(w, L)), sum(sum(c, esc(u, -L)), esc(w, L)), sum(sum(c, esc(u, -L)), esc(w, -L)), sum(sum(c, esc(u, L)), esc(w, -L))];
      caras.push({ pts: orientar(pts, n), n, tipo: 'caja' });
    }
  }
  return { caras };
}

/** ordena los puntos de un polígono plano convexo en sentido antihorario visto desde n */
function orientar(pts, n) {
  const c = esc(pts.reduce(sum, [0, 0, 0]), 1 / pts.length);
  const u = unit(res(pts[0], c));
  const w = cruz(n, u);
  return pts.map((p) => ({ p, a: Math.atan2(dot(res(p, c), w), dot(res(p, c), u)) })).sort((x, y) => x.a - y.a).map((x) => x.p);
}

function sinRepetidos(pts, tol = 1e-9) {
  const r = [];
  for (const p of pts) if (!r.some((q) => norma(res(p, q)) < tol)) r.push(p);
  return r;
}

/** Corta el poliedro por el semiespacio n·x ≤ d (se queda esa parte); la tapa nueva lleva `tipo`. */
export function cortarPoliedro(P, n, d, tipo) {
  const caras = [];
  const tapa = [];
  let corta = false;
  for (const f of P.caras) {
    const sal = [];
    const m = f.pts.length;
    for (let i = 0; i < m; i++) {
      const a = f.pts[i], b = f.pts[(i + 1) % m];
      const da = dot(n, a) - d, db = dot(n, b) - d;
      if (da <= TOL) sal.push(a);
      if (da > TOL) corta = true;
      if ((da < -TOL && db > TOL) || (da > TOL && db < -TOL)) {
        const t = da / (da - db);
        sal.push(sum(a, esc(res(b, a), t)));
      }
    }
    const limpio = sinRepetidos(sal);
    for (const p of limpio) if (Math.abs(dot(n, p) - d) <= 1e-7) tapa.push(p);
    if (limpio.length >= 3 && areaPol(limpio, f.n) > 1e-12) caras.push({ pts: limpio, n: f.n, tipo: f.tipo });
  }
  if (!corta) return P;
  const t = sinRepetidos(tapa, 1e-7);
  if (t.length >= 3) {
    const o = orientar(t, n);
    if (areaPol(o, n) > 1e-12) caras.push({ pts: o, n: n.slice(), tipo });
  }
  return { caras };
}

function areaPol(pts, n) {
  let s = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) s = sum(s, cruz(pts[i], pts[(i + 1) % pts.length]));
  return Math.abs(dot(s, n)) / 2;
}

export function volumen(P) {
  let v = 0;
  for (const f of P.caras) v += (dot(f.pts[0], f.n) * areaPol(f.pts, f.n)) / 3;
  return v;
}
export function verticesDe(P) {
  return sinRepetidos(P.caras.flatMap((f) => f.pts), 1e-7);
}
export function transformar(P, M) {
  return { caras: P.caras.map((f) => ({ ...f, pts: f.pts.map((p) => mv(M, p)), n: mv(M, f.n) })) };
}
/** ¿Los dos poliedros (convexos) son el mismo conjunto? Mismos vértices. */
export function mismoPoliedro(A, B, tol = 1e-6) {
  const va = verticesDe(A), vb = verticesDe(B);
  if (va.length !== vb.length) return false;
  return va.every((p) => vb.some((q) => norma(res(p, q)) < tol));
}

// ---------- el shape mod ----------
/**
 * @param {{ corte: number, semilado: number, centro: number[], ejes?: number[][], desfase?: { abajo: number, medio?: number, arriba: number } }} def
 *   corte: distancia c de los planos del mecanismo; semilado: h del cubo exterior; centro: centro del cubo en
 *   el marco del mecanismo; ejes: filas = las tres direcciones de las caras del cubo (en el marco del
 *   mecanismo; por defecto, los ejes del mecanismo); desfase: ángulos (radianes, alrededor de +y) de las capas
 *   de abajo / medio / arriba en la forma de cubo.
 */
export function crearGeoShapeMod(def) {
  const c = def.corte, h = def.semilado;
  const ejes = def.ejes || ID3;
  const desfase = def.desfase || null;
  const angCapa = (fila) => (!desfase ? 0 : fila > 0 ? desfase.arriba : fila < 0 ? desfase.abajo : (desfase.medio || 0));
  /** planos del cuerpo (n·x ≤ d) girado `ang` alrededor de y */
  function planosCuerpo(ang) {
    const R = matRot([0, 1, 0], ang);
    const C = mv(R, def.centro);
    const r = [];
    for (const e of ejes) for (const s of [1, -1]) { const n = mv(R, esc(e, s)); r.push({ n, d: dot(n, C) + h }); }
    return r;
  }
  const posHueco = CARAS_HUECO.map((cs) => cs.reduce((p, f) => sum(p, DIR[f]), [0, 0, 0]));
  const radioCaja = 4 * (h + norma(def.centro) + c + 1);
  /** forma de la pieza de cada hueco en el estado resuelto, con las capas alineadas */
  const formas = posHueco.map((pos) => {
    let P = cajaGrande(radioCaja);
    for (let a = 0; a < 3; a++) {
      const e = [0, 0, 0]; e[a] = 1;
      if (pos[a] > 0) P = cortarPoliedro(P, esc(e, -1), -c, 'corte');
      else if (pos[a] < 0) P = cortarPoliedro(P, e, -c, 'corte');
      else { P = cortarPoliedro(P, e, c, 'corte'); P = cortarPoliedro(P, esc(e, -1), c, 'corte'); }
    }
    // el cuerpo, girado hacia atrás lo que gira la capa de la pieza en la forma de cubo
    for (const pl of planosCuerpo(-angCapa(pos[1]))) P = cortarPoliedro(P, pl.n, pl.d, 'exterior');
    if (P.caras.some((f) => f.tipo === 'caja')) throw new Error('El cuerpo del shape mod no es acotado');
    return P;
  });
  formas.forEach((P, k) => { if (!(volumen(P) > 1e-9)) throw new Error(`La pieza ${NOMBRE_HUECO[k]} queda vacía: el cuerpo no llega a esa celda`); });

  // ---------- rotaciones de las piezas según el estado ----------
  const dirs = (cs) => cs.map((f) => DIR[f]);
  /** rotación de la pieza `pieza` en el hueco `hueco` con orientación `o` */
  function rotacionPieza(hueco, pieza, o) {
    if (hueco < 8) {
      const src = dirs(ESQ_CARAS[pieza]), dst = dirs(ESQ_CARAS[hueco]);
      return matDeParejas(src, src.map((_, j) => dst[(j + o) % 3]));
    }
    if (hueco < 20) {
      const src = dirs(ARI_CARAS[pieza - 8]), dst = dirs(ARI_CARAS[hueco - 8]);
      const d0 = dst[o % 2], d1 = dst[(1 + o) % 2];
      return matDeParejas([src[0], src[1], cruz(src[0], src[1])], [d0, d1, cruz(d0, d1)]);
    }
    const f = CARAS[hueco - 20];
    return matRot(DIR[f], (-Math.PI / 2) * (o % 4));
  }
  /**
   * Colocación de cada hueco: { pieza, R } (R = rotación desde su casa), con las capas alineadas.
   * @param {{ cp: number[], co: number[], ep: number[], eo: number[], ct: number[] }} e
   */
  function colocacion(e) {
    const r = [];
    for (let i = 0; i < 8; i++) r.push({ pieza: e.cp[i], R: rotacionPieza(i, e.cp[i], e.co[i]) });
    for (let i = 0; i < 12; i++) r.push({ pieza: 8 + e.ep[i], R: rotacionPieza(8 + i, 8 + e.ep[i], e.eo[i]) });
    for (let f = 0; f < 6; f++) r.push({ pieza: 20 + f, R: rotacionPieza(20 + f, 20 + f, e.ct[f] || 0) });
    return r;
  }

  // ---------- simetrías: qué se ve ----------
  /** periodo visible de la orientación de cada centro: 1 (no se ve), 2 o 4 */
  const periodos = CARAS.map((f, i) => {
    const P = formas[20 + i];
    for (const k of [1, 2]) if (mismoPoliedro(transformar(P, rotacionPieza(20 + i, 20 + i, k)), P)) return k;
    return 4;
  });
  /**
   * Para cada hueco, las (pieza, orientación) que dejan en él exactamente la forma del resuelto: las
   * disposiciones que se ven como el cubo resuelto (y si dos piezas distintas se ven iguales).
   */
  function encajes() {
    return formas.map((P, s) => {
      const r = [];
      const tipo = TIPO_HUECO[s];
      const candidatas = tipo === 'esquina' ? [0, 1, 2, 3, 4, 5, 6, 7] : tipo === 'arista' ? Array.from({ length: 12 }, (_, i) => 8 + i) : [s];
      const nOri = tipo === 'esquina' ? 3 : tipo === 'arista' ? 2 : 4;
      for (const k of candidatas) for (let o = 0; o < nOri; o++) {
        if (mismoPoliedro(transformar(formas[k], rotacionPieza(s, k, o)), P)) r.push({ pieza: k, o });
      }
      return r;
    });
  }

  const radio = Math.max(...formas.flatMap((P) => verticesDe(P).map(norma)));
  return {
    def, corte: c, semilado: h, formas, posHueco, colocacion, rotacionPieza, periodos, encajes, radio,
    angCapa, planosCuerpo,
    /** fila (−1, 0, 1) del hueco en el eje y: qué capa desfasada lo lleva */
    filaY: (s) => posHueco[s][1],
  };
}
