// Estima cuántas geometrías tiene una configuración vendada cuyo BFS de geometrías no cabe
// (sesión «validador con muchas geometrías»).
//   node scripts/geometrias-bloqueos.mjs [N=5] [bloques=el 5x5 de 16 barras] [radio=8] [muestras=3000] [pasos=25600]
//
// Método (todas las geometrías tienen los mismos estados, así que un estado uniforme da una
// geometría uniforme; el paseo perezoso tiende a un estado uniforme):
//  1. BFS exacto hasta `radio`: n_d = número de geometrías a distancia d (d ≤ radio).
//  2. `muestras` geometrías de paseos perezosos de `pasos` pasos (la geometría mezcla con ~6.400–12.800
//     en el 5x5 de 16 barras: medido con la TV de la colocación de cada bloque frente a paseos de 25.600).
//  3. Distancia exacta de cada muestra si es ≤ radio + 2 (BFS de profundidad 2 desde la muestra
//     hasta la bola). Con f_d = fracción de muestras a distancia d: N ≈ n_d / f_d para cada d ≤ radio
//     con muestras suficientes, y N ≈ |bola| / P(d ≤ radio) en conjunto (intervalo de Wilson al 95 %).
import { soporteBloqueosIdentidad } from '../src/puzzles/nxn-identidad.js';
import { crearModeloBloqueos } from '../src/core/bloqueos.js';
import { rngConSemilla } from '../src/core/rng.js';

const BARRAS = 'B.B12.B32.DB-B11.B21.B31.DB3-B13.B23.B33.DB1-BL.BL1.BL3.DBL-BR.BR1.BR3.DBR-DF.F.F12.F32-DF1.F11.F21.F31-DF3.F13.F23.F33-DFL.FL.FL1.FL3-DFR.FR.FR1.FR3-DL.L.L12.L32-DL1.L11.L21.L31-DL3.L13.L23.L33-DR.R.R12.R32-DR1.R13.R23.R33-DR3.R11.R21.R31';
const N = parseInt(process.argv[2] || '5', 10);
const def = (process.argv[3] || BARRAS).split('-').map((b) => b.split('.'));
const RADIO = parseInt(process.argv[4] || '8', 10);
const MUESTRAS = parseInt(process.argv[5] || '3000', 10);
const PASOS = parseInt(process.argv[6] || '25600', 10);

const mod = crearModeloBloqueos(soporteBloqueosIdentidad(N), def);
const t0 = performance.now();
const G0 = mod.geometriaDe(mod.resuelto);
/** @type {Map<string, number>} */
const bola = new Map([[mod.claveG(G0), 0]]);
const n = [1];
let frente = [G0];
for (let d = 1; d <= RADIO; d++) {
  const nuevo = [];
  for (const G of frente) for (let m = 0; m < mod.nM; m++) {
    if (!mod.legalG(G, m)) continue;
    const H = mod.aplicarG(G, m), k = mod.claveG(H);
    if (!bola.has(k)) { bola.set(k, d); nuevo.push(H); }
  }
  n.push(nuevo.length); frente = nuevo;
  console.error(`d=${d}: ${nuevo.length} (total ${bola.size}, ${Math.round((performance.now() - t0) / 1000)} s)`);
}
frente = null;
const rng = rngConSemilla(2026);
/** Paseo perezoso sobre la geometría (sin canonizar en cada paso: la legalidad no depende del orden). */
function muestra() {
  let G = G0.slice();
  const H = new Int16Array(G.length);
  for (let i = 0; i < PASOS; i++) {
    const m = Math.floor(rng() * mod.nM);
    if (!mod.legalG(G, m)) continue;
    const M = mod.MAPA[m];
    for (let j = 0; j < G.length; j++) H[j] = M[G[j]];
    G.set(H);
  }
  return mod.canonica(G);
}
/** Distancia exacta si es ≤ RADIO + 2, o -1. */
function distancia(G) {
  const k = mod.claveG(G);
  if (bola.has(k)) return bola.get(k);
  let mejor = Infinity;
  const vecinos = [];
  for (let m = 0; m < mod.nM; m++) {
    if (!mod.legalG(G, m)) continue;
    const H = mod.aplicarG(G, m), kh = mod.claveG(H);
    if (bola.has(kh)) mejor = Math.min(mejor, bola.get(kh) + 1); else vecinos.push(H);
  }
  if (mejor <= RADIO) return mejor; // (no puede ser: estaría en la bola)
  if (mejor < Infinity) return mejor; // RADIO + 1
  for (const H of vecinos) for (let m = 0; m < mod.nM; m++) {
    if (!mod.legalG(H, m)) continue;
    const kk = mod.claveG(mod.aplicarG(H, m));
    if (bola.has(kk)) mejor = Math.min(mejor, bola.get(kk) + 2);
  }
  return mejor < Infinity ? mejor : -1;
}
const cuenta = new Map();
const tm = performance.now();
for (let i = 0; i < MUESTRAS; i++) {
  const d = distancia(muestra());
  cuenta.set(d, (cuenta.get(d) || 0) + 1);
  if ((i + 1) % 500 === 0) console.error(`${i + 1} muestras (${Math.round((performance.now() - tm) / 1000)} s)`);
}
const enBola = [...cuenta].filter(([d]) => d >= 0 && d <= RADIO).reduce((s, [, c]) => s + c, 0);
// intervalo de Wilson (95 %) de p = P(d ≤ RADIO)
const z = 1.96, p = enBola / MUESTRAS;
const c = (p + z * z / (2 * MUESTRAS)), r = z * Math.sqrt(p * (1 - p) / MUESTRAS + z * z / (4 * MUESTRAS * MUESTRAS)), q = 1 + z * z / MUESTRAS;
const [pMin, pMax] = [(c - r) / q, (c + r) / q];
const res = {
  radio: RADIO, bola: bola.size, niveles: n, muestras: MUESTRAS, pasos: PASOS,
  distancias: Object.fromEntries([...cuenta].sort((a, b) => a[0] - b[0])),
  enBola, estimacion: p > 0 ? Math.round(bola.size / p) : null,
  intervalo95: [pMax > 0 ? Math.round(bola.size / pMax) : null, pMin > 0 ? Math.round(bola.size / pMin) : 'sin cota'],
  porNivel: n.map((nd, d) => (cuenta.get(d) ? { d, estimacion: Math.round(nd / (cuenta.get(d) / MUESTRAS)), muestras: cuenta.get(d) } : null)).filter(Boolean),
};
console.log(JSON.stringify(res, null, 1));
