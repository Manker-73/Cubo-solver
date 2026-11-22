// Mide cuánto hay que mezclar un cubo vendado con movimientos legales al azar
// (espacios grandes, donde no se puede elegir un estado uniforme con el BFS).
//   node scripts/mezcla-bloqueos.mjs [N=3000]
//
// El paseo es de un número FIJO de pasos (cada paso, uno de los 18 giros al azar; si es
// ilegal, nada): parar cuando la palabra reducida llega a L giros sesga la distribución
// (se para justo después de un giro "nuevo", lejos de las geometrías sin salida); medido:
// en el Most signatures la geometría se quedaba a TV 0,14 de la uniforme con cualquier L.
// Para cada configuración y cada número de pasos T, con N paseos:
//   - geometría: distancia (total variation) entre la distribución de la distancia a la
//     geometría resuelta y la EXACTA en un estado uniforme (cada geometría tiene los mismos
//     estados: |grupo de la fase 2|, así que es la de las geometrías del BFS);
//   - piezas: TV media, pieza a pieza, entre la distribución de su posición y la de paseos
//     muy largos (6.400 pasos), comparada con el ruido de dos muestras de 6.400 pasos.
// Criterio: el T más pequeño con TV(geometría) ≤ 0,05 y TV(piezas) ≤ ruido + 0,02.
import { soporteBloqueos3x3 } from '../src/puzzles/cubo3-bloqueos.js';
import { crearAnalisisBloqueos, paseoAleatorio, longitudScramble } from '../src/core/bloqueos.js';
import { bloquesDesdeFirma } from '../src/puzzles/nxn-bloqueos.js';
import { rngConSemilla } from '../src/core/rng.js';

const N = parseInt(process.argv[2] || '3000', 10);
const CONFIGS = [
  ['pareja', [['UFR', 'UF']]],
  ['1x2x2', [['UFR', 'UF', 'UR', 'U']]],
  ['varios', [['UFR', 'UF'], ['DBL', 'DB', 'DBR'], ['L', 'FL']]],
  ['most-signatures', bloquesDesdeFirma('10840080200C21')],
];
const PASOS = [25, 50, 100, 200, 400, 800, 1600, 3200];
const REF = 6400;

function muestras(A, rng, T, n) {
  const { mod } = A;
  const dist = new Map();
  const pos = mod.moviles.map(() => new Map());
  let lon = 0;
  for (let i = 0; i < n; i++) {
    let S = mod.resuelto;
    const w = paseoAleatorio(A, rng, 0, T, { pasosFijos: true });
    lon += w.length;
    for (const m of w) S = mod.aplicar(S, m);
    const d = A.distGeo.get(mod.claveG(mod.geometriaDe(S)));
    dist.set(d, (dist.get(d) || 0) + 1);
    for (let j = 0; j < mod.nS; j++) pos[j].set(S[j], (pos[j].get(S[j]) || 0) + 1);
  }
  return { dist, pos, n, longitud: lon / n };
}
const tv = (a, na, b, nb) => {
  const ks = new Set([...a.keys(), ...b.keys()]);
  let s = 0;
  for (const k of ks) s += Math.abs((a.get(k) || 0) / na - (b.get(k) || 0) / nb);
  return s / 2;
};
const tvPiezas = (x, y) => x.pos.reduce((s, p, j) => s + tv(p, x.n, y.pos[j], y.n), 0) / x.pos.length;

const res = {};
for (const [id, def] of CONFIGS) {
  const A = crearAnalisisBloqueos(soporteBloqueos3x3, def);
  // distribución exacta de la distancia a la geometría resuelta (estado uniforme)
  const exacta = new Map();
  for (const n of A.geo.nodos) exacta.set(n.d, (exacta.get(n.d) || 0) + 1);
  const nG = A.geo.nodos.length;
  const rng = rngConSemilla(7);
  const ref = muestras(A, rng, REF, N), ref2 = muestras(A, rng, REF, N);
  const ruido = tvPiezas(ref, ref2);
  const filas = [];
  let elegida = null;
  for (const T of PASOS) {
    const m = muestras(A, rng, T, N);
    const tg = tv(m.dist, m.n, exacta, nG), tp = tvPiezas(m, ref);
    filas.push({ pasos: T, longitud: +m.longitud.toFixed(1), tvGeometria: +tg.toFixed(3), tvPiezas: +tp.toFixed(3) });
    if (elegida === null && tg <= 0.05 && tp <= ruido + 0.02) elegida = T;
  }
  res[id] = { diametroGeometria: A.info.diametroGeometria, geometrias: nG, ruidoPiezas: +ruido.toFixed(3), tvGeometriaRef: +tv(ref.dist, ref.n, exacta, nG).toFixed(3), pasosMinimosMedidos: elegida, pasosUsados: longitudScramble(A), filas };
  console.log(id, JSON.stringify(res[id]));
}
