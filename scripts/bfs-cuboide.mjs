// BFS completo del 3x3x2 (Domino): distancia de cada una de sus 406.425.600 posiciones en la métrica de
// Jaap (HTM: U, U2, U', D…, R2, L2, F2, B2 cuentan 1). Comprueba el número de Dios (18) y la
// distribución publicada en https://www.jaapsch.net/puzzles/domino.htm (noche 15).
//   node --max-old-space-size=4096 scripts/bfs-cuboide.mjs
// Unos minutos y ~0,5 GB de memoria (un byte por posición).
//
// Posición = estado del grupo de los giros de búsqueda (U, R2, L2, F2, B2; los centros fijos) salvo la
// rotación y = U D' (que está en el grupo): de los cuatro estados s·yᵏ se toma el que deja la esquina 0
// en el primer hueco de su órbita de y (arriba o abajo). Índice = esquinas normalizadas (2·7! = 10.080)
// × aristas (8! = 40.320). Las esquinas y las aristas no tienen orientación libre (la decide el hueco).
import { cargarPuzzle } from '../src/puzzles/index.js';
import { indicePerm, permDeIndice } from '../src/core/perm.js';

const p = await cargarPuzzle('3x3x2');
const G = p.cuboide.G, Gr = p.cuboide.grupo();
const movs = G.busqueda;
const nM = movs.length;
const t0 = Date.now();

// huecos de una órbita: adónde lleva cada giro cada hueco
const orbita = (tipo) => Gr.orbitas.find((o) => o.tipo === tipo && o.huecos.length > 1);
function mapas(o, imgs) {
  const local = new Map(o.huecos.map((h, k) => [h, k]));
  return imgs.map((img) => o.huecos.map((h) => local.get(G.piezaDePegatina[img[G.piezas[h].pegatinas[0]]])));
}
const yImg = Gr.producto(Gr.imgs.U, Gr.imgs["D'"]);
const E = orbita('esquina'), A = orbita('arista');
const mapE = mapas(E, movs.map((m) => Gr.imgs[m])), mapA = mapas(A, movs.map((m) => Gr.imgs[m]));
const [yE] = mapas(E, [yImg]), [yA] = mapas(A, [yImg]);
const N = 40320;
/** tabla[i * nM + m] de una órbita de 8 piezas (pos[pieza] = hueco local) */
function tabla(mapa) {
  const t = new Int32Array(N * mapa.length);
  for (let i = 0; i < N; i++) {
    const pos = permDeIndice(i, 8);
    mapa.forEach((mp, m) => { t[i * mapa.length + m] = indicePerm(pos.map((x) => mp[x])); });
  }
  return t;
}
const tE = tabla(mapE), tA = tabla(mapA), tEy = tabla([yE]), tAy = tabla([yA]);
// huecos representantes de las órbitas de y en las esquinas: el menor de cada ciclo
const rep = new Set();
for (let h = 0; h < 8; h++) { let m = h, x = yE[h]; while (x !== h) { m = Math.min(m, x); x = yE[x]; } rep.add(m); }
// normalización: para cada índice de esquinas, cuántas y aplicar y el índice normalizado (0..10079)
const canonIdx = new Int32Array(N).fill(-1), canon = [];
for (let i = 0; i < N; i++) if (rep.has(permDeIndice(i, 8)[0])) { canonIdx[i] = canon.length; canon.push(i); }
if (canon.length !== 10080) throw new Error('normalización: ' + canon.length);
const kDe = new Int8Array(N), normDe = new Int32Array(N);
for (let i = 0; i < N; i++) {
  let c = i, k = 0;
  while (canonIdx[c] < 0) { c = tEy[c]; k++; }
  kDe[i] = k; normDe[i] = canonIdx[c];
}
const potA = (a, k) => { for (let j = 0; j < k; j++) a = tAy[a]; return a; };
// tabla de y^k en las aristas
const tAyk = [new Int32Array(N).map((_, i) => i), tAy, new Int32Array(N), new Int32Array(N)];
for (let i = 0; i < N; i++) { tAyk[2][i] = potA(i, 2); tAyk[3][i] = potA(i, 3); }

const TOTAL = 10080 * N;
const dist = new Uint8Array(TOTAL).fill(255);
dist[normDe[0] * N + tAyk[kDe[0]][0]] = 0;
const cuenta = [1];
console.log(`tablas en ${Date.now() - t0} ms; ${TOTAL} posiciones`);
for (let d = 0; ; d++) {
  let nuevos = 0;
  const t = Date.now();
  for (let idx = 0; idx < TOTAL; idx++) {
    if (dist[idx] !== d) continue;
    const cn = (idx / N) | 0, a = idx - cn * N, c = canon[cn];
    for (let m = 0; m < nM; m++) {
      const c2 = tE[c * nM + m], a2 = tA[a * nM + m];
      const j = normDe[c2] * N + tAyk[kDe[c2]][a2];
      if (dist[j] === 255) { dist[j] = d + 1; nuevos++; }
    }
  }
  if (!nuevos) break;
  cuenta.push(nuevos);
  console.log(`distancia ${d + 1}: ${nuevos} (${Date.now() - t} ms)`);
}
const total = cuenta.reduce((x, y) => x + y, 0);
const media = cuenta.reduce((x, y, k) => x + y * k, 0) / total;
console.log(JSON.stringify({ posiciones: total, numeroDeDios: cuenta.length - 1, media: +media.toFixed(4), distribucion: cuenta, ms: Date.now() - t0 }));
