// Demostración de las restricciones de un cubo NxN con Schreier–Sims.
//
// H = grupo de los movimientos que dejan quieta la referencia de orientación:
//   N impar: giros de cada cara hasta la profundidad (N-1)/2 (no mueven los centros fijos);
//   N par:   giros de U, R y F a cualquier profundidad (no mueven la esquina DBL).
// Todo estado alcanzable es, salvo una rotación del cubo entero, un elemento de H.
//
// Para cada órbita de piezas se calcula el orden del grupo inducido G_i, y los
// signos (paridad de la permutación de piezas) de cada generador en cada órbita.
// Si |H| = Π|G_i| · |S| / 2^k (S = subespacio de vectores de signos que generan
// los generadores, k = órbitas con permutaciones impares), H es exactamente el
// conjunto de tuplas de G_i cuyas paridades están en S: no hay más restricciones
// que (a) las de cada órbita por separado y (b) las relaciones de paridad de S.

import { ordenGrupo } from '../core/grupo.js';
import { invertir, paridad } from '../core/perm.js';
import { geometriaNxN, CARAS } from './nxn.js';
import { modeloPiezasNxN } from './nxn-piezas.js';

const fact = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };

/** Generadores de H (como permutaciones "imagen de i" para grupo.js) y sus nombres. */
export function generadoresH(N) {
  const geo = geometriaNxN(N);
  const res = [];
  const caras = N % 2 ? CARAS : ['U', 'R', 'F'];
  const maxP = N % 2 ? (N - 1) / 2 : N - 1;
  for (const c of caras) for (let p = 1; p <= maxP; p++) res.push({ nombre: `${c}${p}`, P: geo.cuarto(c, p) });
  return res;
}

/** Permutación de piezas (destino de cada posición) inducida en una órbita. */
function permPiezas(orb, P) {
  const donde = new Map();
  orb.piezas.forEach((pz, j) => pz.forEach((f) => donde.set(f, j)));
  // P: nuevo[i] = viejo[P[i]] -> la pegatina P[i] va a i
  return orb.piezas.map((pz) => {
    const destino = P.indexOf(pz[0]);
    return donde.get(destino);
  });
}

export function analizarGrupo(N, { conOrdenTotal = true } = {}) {
  const { orbitas } = modeloPiezasNxN(N);
  const gens = generadoresH(N);
  // grupo.js usa p[i] = imagen de i; nuestras perms son "viene de", así que se invierten
  const imagenes = gens.map((g) => invertir(g.P));
  const res = { N, orbitas: [], relaciones: [] };
  let producto = 1n;
  const signos = gens.map(() => 0);
  const conImpares = [];
  orbitas.forEach((orb, oi) => {
    const pegs = orb.piezas.flat();
    const local = new Map(pegs.map((f, i) => [f, i]));
    const restr = imagenes.map((g) => pegs.map((f) => local.get(g[f])));
    const orden = ordenGrupo(restr);
    const m = orb.piezas[0].length;
    // piezas que se mueven en H
    const perms = gens.map((g) => permPiezas(orb, g.P));
    const movidas = orb.piezas.filter((_, j) => perms.some((p) => p[j] !== j)).length;
    const libre = fact(movidas) * BigInt(m) ** BigInt(movidas);
    let impar = false;
    perms.forEach((p, gi) => { const s = paridad(p); if (s) { impar = true; signos[gi] |= 1 << oi; } });
    if (impar) conImpares.push(oi);
    producto *= orden;
    res.orbitas.push({
      nombre: orb.nombre, tipo: orb.tipo, piezas: orb.piezas.length, movidas, orden, libre,
      factorOrientacion: libre / orden / (impar ? 1n : 2n), // lo que falta, aparte de la paridad
      soloPares: !impar,
    });
  });
  // rango de los vectores de signos (GF(2))
  const base = [];
  for (let v of signos) {
    for (const b of base) if ((v ^ b) < v) v ^= b;
    if (v) { base.push(v); base.sort((a, b) => b - a); }
  }
  const rango = base.length;
  const k = conImpares.length;
  res.predicho = (producto * 2n ** BigInt(rango)) / 2n ** BigInt(k);
  // relaciones: vectores ortogonales a todos los signos, dentro de las órbitas con impares
  const mascaraK = conImpares.reduce((a, oi) => a | (1 << oi), 0);
  const dot = (a, b) => { let x = a & b, s = 0; while (x) { s ^= x & 1; x >>= 1; } return s; };
  const relaciones = [];
  for (let v = 1; v < 1 << orbitas.length; v++) {
    if ((v & ~mascaraK) !== 0) continue;
    if (signos.every((s) => dot(s, v) === 0)) relaciones.push(v);
  }
  const nombres = (v) => orbitas.map((o, i) => ((v >> i) & 1 ? o.nombre : null)).filter(Boolean);
  const reducir = (lista) => {
    const b = [];
    for (const v0 of lista) {
      let v = v0;
      for (const x of b) if ((v ^ x) < v) v ^= x;
      if (v) { b.push(v); b.sort((x, y) => y - x); }
    }
    return b;
  };
  const sinCentros = (v) => orbitas.every((o, i) => !((v >> i) & 1) || o.tipo !== 'centros');
  res.relaciones = reducir(relaciones).map(nombres);
  // relaciones que no involucran centros (los centros de un color son indistinguibles,
  // así que cualquier relación con centros se puede cumplir siempre)
  res.relacionesVisibles = reducir(relaciones.filter(sinCentros)).map(nombres);
  if (conOrdenTotal) res.orden = ordenGrupo(imagenes);
  return res;
}
