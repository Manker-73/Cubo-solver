// 4x4: reducción por búsqueda en tres fases (idea del método de Tsai / TPR de
// Chen Shuang; implementación propia sobre el modelo de pegatinas).
//
//   Fase 1  (los 36 movimientos)  un par de colores opuestos a las caras R/L
//   Fase 2  (caras, Uw2 Dw2 Fw2 Bw2, Rw y Lw)  centros R/L resueltos, los otros
//           dos pares separados y permutación de las wings par (sin paridad OLL).
//           Solo se aceptan finales en los que las dos wings de cada arista
//           quedan en "mitades" distintas (ver fase 3) y con la paridad relativa
//           par: si no, la fase 3 no podría emparejarlas.
//   Fase 3  (U D F B, R2 L2 y las capas anchas a 180°)  centros resueltos y
//           todas las aristas emparejadas, con la paridad de aristas igual a la
//           de esquinas (sin paridad PLL). Estos movimientos dejan las 24
//           posiciones de wings en dos órbitas de 12 ("mitades" A y B); cada
//           arista tiene una posición de cada mitad.
//   3x3     Kociemba (cubo3.js), fuera de este módulo.
//
// En el 4x4 los centros no marcan la orientación: la fase 1 elige qué par de
// colores va a R/L y las fases 2 y 3 la orientación final (siempre una rotación
// válida del esquema de colores).
//
// Tablas (se generan al inicializar; nada se guarda en el repositorio):
//   fase 1  posiciones de un par de colores (C(24,8) = 735.471)
//   fase 2  separación de los otros dos pares × centros R/L × paridad de wings
//           (12.870 × 70 × 2)
//   fase 3  centros (70³ × paridad PLL) y, para las aristas, una tabla de
//           3 aristas (posiciones de sus dos wings: 12⁶) que se consulta con
//           varios tríos a la vez.

import { baseNxN, nombreMovimiento, CARAS } from './nxn.js';
import { modeloPiezasNxN } from './nxn-piezas.js';
import { paridad, aplicarPerm } from '../core/perm.js';
import { cierreGrupo } from '../core/simetria.js';
import { NOMBRES_ARISTAS } from './cubo-comun.js';

const popcount = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };

let instancia = null;
export function tpr4() {
  if (!instancia) instancia = crearTPR4();
  return instancia;
}

function crearTPR4() {
  const N = 4, n2 = 16;
  const b = baseNxN(N);
  const { orbitas } = modeloPiezasNxN(N);
  const OC = orbitas.find((o) => o.tipo === 'centros');
  const OW = orbitas.find((o) => o.tipo === 'wings');
  const OE = orbitas.find((o) => o.tipo === 'esquinas');
  const caraDe = (f) => Math.floor(f / n2);
  const EJE = [0, 1, 2, 0, 1, 2]; // U R F D L B

  // ---- movimientos ----
  const MOVS = [];
  CARAS.forEach((c, f) => {
    for (const p of [1, 2]) for (const v of [1, 2, 3]) MOVS.push({ nombre: nombreMovimiento(c, p, v), cara: f, prof: p, v, eje: EJE[f], bloque: f * 2 + p - 1 });
  });
  const NM = MOVS.length;
  const destinoDe = (P) => { const inv = new Int32Array(P.length); for (let i = 0; i < P.length; i++) inv[P[i]] = i; return inv; };

  // centros: posiciones reordenadas por grupos UD (bits 0-7), RL (8-15), FB (16-23)
  const ordenCaras = [0, 3, 1, 4, 2, 5];
  const posC = [];
  for (const f of ordenCaras) for (const pz of OC.piezas) if (caraDe(pz[0]) === f) posC.push(pz[0]);
  const idxC = new Map(posC.map((s, j) => [s, j]));
  const caraC = posC.map(caraDe);
  const bitsCara = new Array(6).fill(0);
  caraC.forEach((f, j) => { bitsCara[f] |= 1 << j; });
  // wings
  const posW = OW.piezas.map((pz) => pz[0]);
  const idxW = new Map(posW.map((s, j) => [s, j]));
  const slotW = OW.nombresPos.map((n) => NOMBRES_ARISTAS.indexOf(n.split(' ')[0]));
  // esquinas (para la paridad)
  const posE = OE.piezas.map((pz) => pz[0]);
  const idxE = new Map(); OE.piezas.forEach((pz, j) => pz.forEach((s) => idxE.set(s, j)));

  for (const m of MOVS) {
    const D = destinoDe(b.permDe(m.nombre));
    m.c = posC.map((s) => idxC.get(D[s]));
    m.w = posW.map((s) => idxW.get(D[s]));
    m.e = posE.map((s) => idxE.get(D[s]));
    m.parW = paridad(m.w);
    m.parE = paridad(m.e);
    // tablas para permutar máscaras de 24 bits
    const T = new Uint32Array(768);
    for (let k = 0; k < 3; k++) for (let x = 0; x < 256; x++) {
      let r = 0;
      for (let t = 0; t < 8; t++) if (x & (1 << t)) r |= 1 << m.c[k * 8 + t];
      T[k * 256 + x] = r >>> 0;
    }
    m.T = T;
  }
  const mover = (m, x) => (m.T[x & 255] | m.T[256 + ((x >>> 8) & 255)] | m.T[512 + (x >>> 16)]) >>> 0;
  const subconjunto = (nombres) => nombres.map((n) => { const i = MOVS.findIndex((m) => m.nombre === n); if (i < 0) throw new Error(n); return i; });

  const G1 = MOVS.map((_, i) => i);
  const G2 = subconjunto([
    ...CARAS.flatMap((c) => [c, c + '2', c + "'"]), 'Uw2', 'Dw2', 'Fw2', 'Bw2', 'Rw', 'Rw2', "Rw'", 'Lw', 'Lw2', "Lw'",
  ]);
  const G3 = subconjunto([
    ...['U', 'D', 'F', 'B'].flatMap((c) => [c, c + '2', c + "'"]), 'R2', 'L2', 'Uw2', 'Dw2', 'Rw2', 'Lw2', 'Fw2', 'Bw2',
  ]);
  // puede ir el movimiento j después del i (orden canónico de los que conmutan)
  const permitido = (i, j) => i < 0 || MOVS[i].eje !== MOVS[j].eje || MOVS[j].bloque > MOVS[i].bloque;

  // ---- combinatoria ----
  const C = Array.from({ length: 25 }, () => new Int32Array(25));
  for (let n = 0; n <= 24; n++) { C[n][0] = 1; for (let k = 1; k <= n; k++) C[n][k] = C[n - 1][k - 1] + (k <= n - 1 ? C[n - 1][k] : 0); }
  const rangoMascara = (x) => { let r = 0, t = 0; while (x) { const lo = x & -x; const p = 31 - Math.clz32(lo); t++; r += C[p][t]; x ^= lo; } return r; };
  const r70 = new Int8Array(256).fill(-1);
  { let k = 0; for (let x = 0; x < 256; x++) if (popcount(x) === 4) r70[x] = k++; }
  const r16 = new Int16Array(65536).fill(-1);
  { let k = 0; for (let x = 0; x < 65536; x++) if (popcount(x) === 8) r16[x] = k++; }

  function bfs(tam, inicios, indice, vecinos) {
    const T = new Int8Array(tam).fill(-1);
    let frontera = [];
    for (const s of inicios) { const k = indice(s); if (T[k] < 0) { T[k] = 0; frontera.push(s); } }
    let d = 0;
    while (frontera.length) {
      const sig = [];
      for (const s of frontera) {
        vecinos(s, (t) => { const k = indice(t); if (T[k] < 0) { T[k] = d + 1; sig.push(t); } });
      }
      frontera = sig; d++;
    }
    return T;
  }

  // ---- fase 1: un par de colores en R/L ----
  const RL = (bitsCara[1] | bitsCara[4]) >>> 0;
  const T1 = bfs(C[24][8], [RL], rangoMascara, (s, f) => { for (const i of G1) f(mover(MOVS[i], s)); });

  // ---- fase 2 ----
  // estado: mascara (24 bits) = posiciones del par Y (en UD∪FB) | posiciones de x1 (en RL); bit 24 = paridad de wings
  const UD = (bitsCara[0] | bitsCara[3]) >>> 0, FB = (bitsCara[2] | bitsCara[5]) >>> 0;
  const comp16 = (x) => (x & 255) | ((x >>> 16) << 8);
  const indice2 = (s) => ((r16[comp16(s & ~RL & 0xffffff)] * 70 + r70[(s & RL) >>> 8]) << 1) | (s >>> 24);
  const mover2 = (m, s) => (mover(m, s & 0xffffff) | ((((s >>> 24) ^ m.parW) & 1) << 24)) >>> 0;
  const T2 = bfs(12870 * 140, [UD | bitsCara[1], UD | bitsCara[4]],
    indice2, (s, f) => { for (const i of G2) f(mover2(MOVS[i], s)); });

  // ---- fase 3: mitades de las wings ----
  const uf = Array.from({ length: 24 }, (_, i) => i);
  const raiz = (x) => (uf[x] === x ? x : (uf[x] = raiz(uf[x])));
  for (const i of G3) MOVS[i].w.forEach((d, j) => { uf[raiz(j)] = raiz(d); });
  const mitad = posW.map((_, j) => (raiz(j) === raiz(0) ? 0 : 1));
  // cada arista tiene una posición de cada mitad
  const posMitad = [new Int8Array(12).fill(-1), new Int8Array(12).fill(-1)]; // [mitad][slot] = posición
  posW.forEach((_, j) => { if (posMitad[mitad[j]][slotW[j]] >= 0) throw new Error('TPR4: mitades mal formadas'); posMitad[mitad[j]][slotW[j]] = j; });
  // permutaciones de slots de cada mitad para los movimientos de G3
  for (const i of G3) {
    const m = MOVS[i];
    m.mA = new Int8Array(12); m.mB = new Int8Array(12);
    for (let s = 0; s < 12; s++) {
      const dA = m.w[posMitad[0][s]], dB = m.w[posMitad[1][s]];
      if (mitad[dA] !== 0 || mitad[dB] !== 1) throw new Error('TPR4: G3 no conserva las mitades');
      m.mA[s] = slotW[dA]; m.mB[s] = slotW[dB];
    }
    if (paridad(Array.from(m.mA)) !== paridad(Array.from(m.mB))) throw new Error('TPR4: paridades distintas en las mitades');
    m.par3 = paridad(Array.from(m.mA)) ^ m.parE;
  }
  // centros de la fase 3: máscara de los colores "primeros" (U, R, F de la orientación 0) y bit de paridad PLL
  const indice3 = (s) => ((((r70[s & 255] * 70 + r70[(s >>> 8) & 255]) * 70 + r70[(s >>> 16) & 255]) << 1) | (s >>> 24));
  const mover3 = (m, s) => (mover(m, s & 0xffffff) | ((((s >>> 24) ^ m.par3) & 1) << 24)) >>> 0;
  const meta3 = [(bitsCara[0] | bitsCara[1] | bitsCara[2]) >>> 0, (bitsCara[3] | bitsCara[1] | bitsCara[5]) >>> 0];
  // fase 3b: grupo "dominó" (U D, R2 L2 F2 B2 y capas anchas a 180°)
  const G3b = subconjunto([...['U', 'D'].flatMap((c) => [c, c + '2', c + "'"]), 'R2', 'L2', 'F2', 'B2', 'Uw2', 'Dw2', 'Rw2', 'Lw2', 'Fw2', 'Bw2']);
  const visitados3b = [];
  const T3b = bfs(70 * 70 * 70 * 2, meta3, indice3, (s, f) => { visitados3b.push(s); for (const i of G3b) f(mover3(MOVS[i], s)); });
  // fase 3a: centros hasta un estado alcanzable en la 3b
  const T3a = bfs(70 * 70 * 70 * 2, visitados3b, indice3, (s, f) => { for (const i of G3) f(mover3(MOVS[i], s)); });
  // fase 3a: aristas "del ecuador" (sus dos colores de los pares de R/L y F/B) a las posiciones del ecuador
  const E_SLOTS = 0xf00; // FR FL BL BR
  const r495 = new Int16Array(4096).fill(-1);
  { let k = 0; for (let x = 0; x < 4096; x++) if (popcount(x) === 4) r495[x] = k++; }
  for (const i of G3) {
    const m = MOVS[i];
    m.pA = new Int16Array(4096); m.pB = new Int16Array(4096);
    for (let x = 0; x < 4096; x++) {
      let ya = 0, yb = 0;
      for (let t = 0; t < 12; t++) if (x & (1 << t)) { ya |= 1 << m.mA[t]; yb |= 1 << m.mB[t]; }
      m.pA[x] = ya; m.pB[x] = yb;
    }
  }
  const indiceSep = (ea, eb) => r495[ea] * 495 + r495[eb];
  const TS = bfs(495 * 495, [E_SLOTS * 4096 + E_SLOTS], (s) => indiceSep(s >>> 12, s & 4095),
    (s, f) => { for (const i of G3) { const m = MOVS[i]; f(m.pA[s >>> 12] * 4096 + m.pB[s & 4095]); } });
  // fase 3b: aristas = permutación relativa (slot A -> slot B de su gemela) en el ecuador (4!) y en U/D (8!)
  const F8 = 40320;
  const permDe = (idx, n) => { const disp = Array.from({ length: n }, (_, i) => i); const p = []; let f = 1; for (let i = 2; i < n; i++) f *= i; for (let i = 0; i < n; i++) { const k = Math.floor(idx / f); idx -= k * f; p.push(disp.splice(k, 1)[0]); if (i < n - 1) f /= (n - 1 - i); } return p; };
  const indiceDe = (p) => { const n = p.length; let idx = 0, f = 1; for (let i = n - 2; i >= 0; i--) { let men = 0; for (let j = i + 1; j < n; j++) if (p[j] < p[i]) men++; idx += men * f; f *= n - i; } return idx; };
  for (const i of G3b) {
    const m = MOVS[i];
    for (let s = 8; s < 12; s++) if (m.mA[s] < 8 || m.mB[s] < 8) throw new Error('TPR4: el dominó no conserva el ecuador');
    m.qU = new Int32Array(F8); m.qE = new Int8Array(24);
    for (let x = 0; x < F8; x++) { const q = permDe(x, 8); const r = new Array(8); for (let s = 0; s < 8; s++) r[m.mA[s]] = m.mB[q[s]]; m.qU[x] = indiceDe(r); }
    for (let x = 0; x < 24; x++) { const q = permDe(x, 4); const r = new Array(4); for (let s = 0; s < 4; s++) r[m.mA[s + 8] - 8] = m.mB[q[s] + 8] - 8; m.qE[x] = indiceDe(r); }
  }
  const TQ = bfs(24 * F8, [0], (s) => s, (s, f) => { const e = Math.floor(s / F8), u = s % F8; for (const i of G3b) { const m = MOVS[i]; f(m.qE[e] * F8 + m.qU[u]); } });

  // esquemas de color válidos (cara -> color) de las 24 rotaciones
  const esquemas = cierreGrupo([b.geo.rot.x, b.geo.rot.y]).map((P) => {
    const e = aplicarPerm(b.estadoResuelto(), P);
    return [0, 1, 2, 3, 4, 5].map((f) => e[f * n2]);
  });

  // ================= búsqueda =================
  /**
   * norm: estado (colores normalizados: un esquema válido). wingPieza: función
   * (colores de la pegatina primaria y secundaria) -> pieza (posición en el resuelto).
   * Devuelve { fases: [[movs fase 1], [fase 2], [fase 3]] } o null si se agota el tiempo.
   */
  function reducir(norm, wingPieza, opciones = {}) {
    const t0 = Date.now();
    const msMax = opciones.msMax ?? 3000;
    const centros = posC.map((s) => norm[s]);
    const wings0 = OW.piezas.map((pz) => wingPieza(norm[pz[0]], norm[pz[1]])); // pieza en cada posición
    const gemela = (p) => { const s = slotW[p]; return posMitad[0][s] === p ? posMitad[1][s] : posMitad[0][s]; };
    const parW0 = paridad(wings0);
    // esquinas: identificar por colores para la paridad PLL
    const coloresE = OE.piezas.map((pz) => pz.map((s) => norm[s]).slice().sort().join());
    const resE = OE.piezas.map((pz) => pz.map((s) => Math.floor(s / n2)));

    const aplicarC = (cs, mi) => { const m = MOVS[mi]; const r = new Array(24); for (let j = 0; j < 24; j++) r[m.c[j]] = cs[j]; return r; };
    const aplicarW = (ws, mi) => { const m = MOVS[mi]; const r = new Array(24); for (let j = 0; j < 24; j++) r[m.w[j]] = ws[j]; return r; };
    const aplicarE = (es, mi) => { const m = MOVS[mi]; const r = new Array(8); for (let j = 0; j < 8; j++) r[m.e[j]] = es[j]; return r; };
    const mascaraDe = (cs, cols) => { let x = 0; for (let j = 0; j < 24; j++) if (cols.includes(cs[j])) x |= 1 << j; return x >>> 0; };

    // ---- fase 1 ----
    const camino = new Int8Array(40);
    const sols1 = [];
    const MAX1 = opciones.sols1 ?? 50;
    for (let X = 0; X < 3; X++) {
      const s0 = mascaraDe(centros, [X, X + 3]);
      const h0 = T1[rangoMascara(s0)];
      const buscar = (s, prof, resto, ult) => {
        if (resto === 0) {
          if (T1[rangoMascara(s)] === 0) sols1.push({ X, movs: Array.from(camino.subarray(0, prof)) });
          return sols1.length >= MAX1 * 3;
        }
        for (const i of G1) {
          if (!permitido(ult, i)) continue;
          const t = mover(MOVS[i], s);
          if (T1[rangoMascara(t)] >= resto) continue;
          camino[prof] = i;
          if (buscar(t, prof + 1, resto - 1, i)) return true;
        }
        return false;
      };
      for (let L = h0; L <= h0 + 1 && L < 12; L++) buscar(s0, 0, L, -1);
    }
    const min1 = Math.min(...sols1.map((s) => s.movs.length));
    // estado para la fase 2 de cada solución de la fase 1
    const cand1 = [];
    for (const s of sols1) {
      if (s.movs.length > min1 + 1) continue;
      let cs = centros;
      for (const i of s.movs) cs = aplicarC(cs, i);
      let par = parW0;
      for (const i of s.movs) par ^= MOVS[i].parW;
      const otros = [0, 1, 2].filter((x) => x !== s.X);
      const Y = otros[0];
      const s2 = (mascaraDe(cs, [Y, Y + 3]) & ~RL & 0xffffff) | (mascaraDe(cs, [s.X]) & RL) | (par << 24);
      cand1.push({ ...s, s2: s2 >>> 0, cs, h: s.movs.length + T2[indice2(s2 >>> 0)] });
    }
    cand1.sort((x, y) => x.h - y.h);
    const cand = cand1.slice(0, opciones.cand1 ?? 30);

    // ---- fase 2 (con el filtro de mitades) ----
    const sols2 = [];
    const MAX2 = opciones.sols2 ?? 30;
    let probados2 = 0;
    const filtrar = (c1, movs2) => {
      let ws = wings0;
      for (const i of c1.movs) ws = aplicarW(ws, i);
      for (const i of movs2) ws = aplicarW(ws, i);
      // posición de cada pieza
      const donde = new Int8Array(24);
      ws.forEach((p, j) => { donde[p] = j; });
      const a = new Int8Array(12), bq = new Int8Array(12);
      const q = new Array(12);
      for (let s = 0; s < 12; s++) {
        const p = posMitad[0][s];
        const x = donde[p], y = donde[gemela(p)];
        if (mitad[x] === mitad[y]) return null;
        const pa = mitad[x] === 0 ? x : y, pb = mitad[x] === 0 ? y : x;
        a[s] = slotW[pa]; bq[s] = slotW[pb]; q[slotW[pa]] = slotW[pb];
      }
      if (paridad(q)) return null;
      return { a, bq, ws };
    };
    const tLimite2 = t0 + msMax * 0.5;
    let pararTodo = false;
    for (let L12 = cand[0].h; L12 <= cand[0].h + 6 && !pararTodo; L12++) {
      for (const c1 of cand) {
        if (c1.h > L12) break;
        const L2 = L12 - c1.movs.length;
        if (L2 < 0) continue;
        const camino2 = new Int8Array(L2 + 1);
        const buscar = (s, prof, resto, ult) => {
          if (resto === 0) {
            if (T2[indice2(s)] !== 0) return false;
            probados2++;
            const movs2 = Array.from(camino2.subarray(0, prof));
            const f = filtrar(c1, movs2);
            if (f) sols2.push({ c1, movs2, ...f, L12: c1.movs.length + prof });
            return sols2.length >= MAX2 || (probados2 & 255) === 0 && Date.now() > tLimite2 && sols2.length > 0;
          }
          if ((++probados2 & 4095) === 0 && Date.now() > tLimite2 + msMax * 1.5) { if (sols2.length) return true; throw new Error('TPR4: tiempo agotado'); }
          for (const i of G2) {
            if (!permitido(ult, i)) continue;
            const t = mover2(MOVS[i], s);
            if (T2[indice2(t)] >= resto) continue;
            camino2[prof] = i;
            if (buscar(t, prof + 1, resto - 1, i)) return true;
          }
          return false;
        };
        const ult = c1.movs.length ? c1.movs[c1.movs.length - 1] : -1;
        if (buscar(c1.s2, 0, L2, ult)) { pararTodo = true; break; }
      }
      if (sols2.length >= (opciones.min2 ?? 3)) break;
    }
    if (!sols2.length) return null;

    // ---- fase 3a ----
    const tLimite = t0 + msMax;
    let nodos = 0;
    const cand3 = [];
    for (const s of sols2) {
      let cs = s.c1.cs;
      for (const i of s.movs2) cs = aplicarC(cs, i);
      // orientación 0: el color de R ya está fijado; U y F, los de un esquema válido
      const enR = cs[caraC.indexOf(1)];
      const colUD = cs[caraC.indexOf(0)] % 3;
      const colFB = 3 - (enR % 3) - colUD;
      const esq = esquemas.find((e) => e[1] === enR && e[0] % 3 === colUD && e[2] % 3 === colFB);
      if (!esq) throw new Error('TPR4: no hay esquema válido');
      let m3 = 0;
      for (let j = 0; j < 24; j++) if (cs[j] === esq[caraC[j] % 3]) m3 |= 1 << j;
      // paridad PLL respecto al esquema: aristas (mitad A) y esquinas
      let es0 = coloresE;
      for (const i of [...s.c1.movs, ...s.movs2]) es0 = aplicarE(es0, i);
      const permE = es0.map((cols) => resE.findIndex((fs) => fs.map((f) => esq[f]).sort().join() === cols));
      const coloresArista = NOMBRES_ARISTAS.map((nom) => [esq['URFDLB'.indexOf(nom[0])], esq['URFDLB'.indexOf(nom[1])]].sort().join());
      const casaA = (pieza) => { const pz = OW.piezas[pieza]; return coloresArista.indexOf([caraDe(pz[0]), caraDe(pz[1])].sort().join()); };
      const permA = new Array(12);
      for (let sl = 0; sl < 12; sl++) permA[sl] = casaA(s.ws[posMitad[0][sl]]);
      const par3 = paridad(permA) ^ paridad(permE);
      const s3 = (m3 | (par3 << 24)) >>> 0;
      // aristas del ecuador: sin colores del par de U/D
      const esE = new Array(12);
      let ea = 0, eb = 0;
      for (let d = 0; d < 12; d++) {
        const pz = OW.piezas[posMitad[0][d]];
        const c0 = Math.floor(pz[0] / n2), c1 = Math.floor(pz[1] / n2);
        esE[d] = c0 % 3 !== colUD && c1 % 3 !== colUD;
        if (esE[d]) { ea |= 1 << s.a[d]; eb |= 1 << s.bq[d]; }
      }
      const h = Math.max(T3a[indice3(s3)], TS[indiceSep(ea, eb)]);
      cand3.push({ ...s, s3, ea, eb, esE, esq, h: s.L12 + h });
    }
    cand3.sort((x, y) => x.h - y.h);
    const sols3a = [];
    const MAX3A = opciones.sols3a ?? 40;
    const camino3 = new Int8Array(40);
    for (let L = cand3[0].h; L <= cand3[0].h + 4 && sols3a.length < (opciones.min3a ?? 4); L++) {
      for (const c of cand3) {
        if (c.h > L) break;
        if (L - c.h > 3) continue;
        const L3 = L - c.L12;
        const buscar = (s, ea, eb, prof, resto, ult) => {
          if (resto === 0) {
            if (T3a[indice3(s)] !== 0 || TS[indiceSep(ea, eb)] !== 0) return false;
            const movs = Array.from(camino3.subarray(0, prof));
            const a = Int8Array.from(c.a), bq = Int8Array.from(c.bq);
            for (const i of movs) { const m = MOVS[i]; for (let d = 0; d < 12; d++) { a[d] = m.mA[a[d]]; bq[d] = m.mB[bq[d]]; } }
            const qE = new Array(4), qU = new Array(8);
            for (let d = 0; d < 12; d++) { if (c.esE[d]) qE[a[d] - 8] = bq[d] - 8; else qU[a[d]] = bq[d]; }
            const iE = indiceDe(qE), iU = indiceDe(qU);
            const he = TQ[iE * F8 + iU];
            if (he < 0) return false;
            sols3a.push({ c, movs3a: movs, s3: s, iE, iU, L: c.L12 + prof, h: c.L12 + prof + Math.max(he, T3b[indice3(s)]) });
            return sols3a.length >= MAX3A;
          }
          if ((++nodos & 4095) === 0 && Date.now() > tLimite) { if (sols3a.length || Date.now() > tLimite + 2500) { if (sols3a.length) return true; throw new Error('TPR4: tiempo agotado'); } }
          for (const i of G3) {
            if (!permitido(ult, i)) continue;
            const m = MOVS[i];
            const t = mover3(m, s);
            if (T3a[indice3(t)] >= resto) continue;
            const ea2 = m.pA[ea], eb2 = m.pB[eb];
            if (TS[indiceSep(ea2, eb2)] >= resto) continue;
            camino3[prof] = i;
            if (buscar(t, ea2, eb2, prof + 1, resto - 1, i)) return true;
          }
          return false;
        };
        const prev = c.movs2.length ? c.movs2 : c.c1.movs;
        if (buscar(c.s3, c.ea, c.eb, 0, L3, prev.length ? prev[prev.length - 1] : -1)) break;
      }
    }
    if (!sols3a.length) return null;
    // ---- fase 3b ----
    sols3a.sort((x, y) => x.h - y.h);
    let mejor = null;
    const camino4 = new Int8Array(40);
    // cada candidato por separado (IDA* con límite de nodos), del más prometedor al menos;
    // se para cuando ningún candidato restante puede mejorar lo encontrado
    for (const c of sols3a.slice(0, opciones.cand3b ?? 12)) {
      if (mejor && c.h >= mejor.total) break;
      let nodosC = 0;
      const limiteC = opciones.nodos3b ?? 1e6;
      for (let L4 = c.h - c.L; (!mejor || c.L + L4 < mejor.total) && L4 <= c.h - c.L + 8; L4++) {
        const buscar = (s, iE, iU, prof, resto, ult) => {
          if (resto === 0) return T3b[indice3(s)] === 0 && iE === 0 && iU === 0;
          if (++nodosC > limiteC) throw new Error('límite');
          for (const i of G3b) {
            if (!permitido(ult, i)) continue;
            const m = MOVS[i];
            const t = mover3(m, s);
            if (T3b[indice3(t)] >= resto) continue;
            const e2 = m.qE[iE], u2 = m.qU[iU];
            if (TQ[e2 * F8 + u2] >= resto) continue;
            camino4[prof] = i;
            if (buscar(t, e2, u2, prof + 1, resto - 1, i)) return true;
          }
          return false;
        };
        const prev = c.movs3a.length ? c.movs3a : c.c.movs2;
        let ok = false;
        try { ok = buscar(c.s3, c.iE, c.iU, 0, L4, prev.length ? prev[prev.length - 1] : -1); } catch (err) { if (err.message !== 'límite') throw err; break; }
        if (ok) { mejor = { c, movs3b: Array.from(camino4.subarray(0, L4)), total: c.L + L4 }; break; }
      }
      nodos += nodosC;
      if (Date.now() > tLimite + 1500 && mejor || Date.now() > tLimite + 4000) break;
    }
    if (!mejor) return null;
    const nombres = (l) => l.map((i) => MOVS[i].nombre);
    const c3 = mejor.c.c;
    return {
      fases: [nombres(c3.c1.movs), nombres(c3.movs2), nombres(mejor.c.movs3a), nombres(mejor.movs3b)],
      esquema: c3.esq,
      nodos,
      ms: Date.now() - t0,
    };
  }

  const depurar = () => ({ G3b, MOVS, T3b, TQ, F8, indice3, mover3, visitados3b });
  return { depurar, TQ, F8, reducir, MOVS, hist: () => ({ T1: hist(T1), T2: hist(T2), T3a: hist(T3a), T3b: hist(T3b), TS: hist(TS), TQ: hist(TQ) }), tamTablas: {} };
}
