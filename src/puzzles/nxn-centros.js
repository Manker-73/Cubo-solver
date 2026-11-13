// Centros de los cubos grandes (5x5, 6x6, 7x7) por búsqueda en tres etapas,
// por grupos de órbitas.
//
//   E1  (todos los movimientos del grupo)  los centros de R y L a las caras R/L
//   E2  (eje R cualquiera; U, F, D, B solo caras exteriores o medias vueltas)
//       los de U y D a U/D (y con ello los de F y B a F/B)
//   E3  (caras exteriores y medias vueltas)  todos resueltos
//
// Cada órbita de centros (24 piezas) es una máscara de 24 bits; las posiciones
// se ordenan por grupos de caras: U/D (bits 0-7), R/L (8-15), F/B (16-23).
// Hay una tabla de distancias por tipo de órbita, etapa y juego de movimientos;
// en la E3 además una por cada grupo de caras con las dos órbitas (70 x 70).
// La búsqueda es IDA* con el máximo de todas; si se pasa de un límite de nodos
// se repite con la heurística inflada (soluciones algo más largas, mucho más
// rápido) y, si aun así no basta, el grupo se deja para los 3-ciclos.
//
// Grupos (los demás centros, los oblicuos, se hacen con 3-ciclos):
//   5x5  {X, cruz} con todos los movimientos
//   6x6  {X exteriores, X interiores} con todos los movimientos
//   7x7  {X exteriores, cruz exteriores} con todos los movimientos y luego
//        {X interiores, cruz interiores} con las caras y la capa 3 suelta (que
//        no toca a las primeras)

import { nombreMovimiento, CARAS } from './nxn.js';
import { aplicarPerm } from '../core/perm.js';

const popcount = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
const EJE = [0, 1, 2, 0, 1, 2];

const C = Array.from({ length: 25 }, () => new Int32Array(25));
for (let n = 0; n <= 24; n++) { C[n][0] = 1; for (let k = 1; k <= n; k++) C[n][k] = C[n - 1][k - 1] + (k <= n - 1 ? C[n - 1][k] : 0); }
const r70 = new Int8Array(256).fill(-1);
{ let k = 0; for (let x = 0; x < 256; x++) if (popcount(x) === 4) r70[x] = k++; }
const r16 = new Int16Array(65536).fill(-1);
{ let k = 0; for (let x = 0; x < 65536; x++) if (popcount(x) === 8) r16[x] = k++; }
// índice de cada etapa
// rango de una máscara de 24 bits con 8 bits a 1, por bytes: RB[k][bits ya vistos][byte]
const PC = new Int8Array(256); for (let x = 0; x < 256; x++) PC[x] = popcount(x);
const RB = [0, 1, 2].map((k) => Array.from({ length: 9 }, (_, t0) => {
  const T = new Int32Array(256);
  for (let x = 0; x < 256; x++) {
    let r = 0, t = t0;
    for (let i = 0; i < 8; i++) if (x & (1 << i)) { t++; if (t <= 8) r += C[8 * k + i][t]; }
    T[x] = r;
  }
  return T;
}));
const rango8 = (x) => { const b0 = x & 255, b1 = (x >>> 8) & 255, p0 = PC[b0]; return RB[0][0][b0] + RB[1][p0][b1] + RB[2][p0 + PC[b1]][x >>> 16]; };
const INDICE = [
  null,
  rango8,
  (x) => r16[(x & 255) | ((x >>> 16) << 8)],
  (x) => (r70[x & 255] * 70 + r70[(x >>> 8) & 255]) * 70 + r70[x >>> 16],
];
const TAM = [0, C[24][8], 12870, 343000];

/** BFS con costes 1 o 2 (cubos de Dial). perms: [{ T, coste }]. */
function bfs(tam, inicios, indice, perms) {
  const T = new Int8Array(tam).fill(-1);
  const cubos = [[], [], []];
  for (const s of inicios) { const k = indice(s); if (T[k] < 0) { T[k] = 0; cubos[0].push(s); } }
  for (let d = 0; cubos[d % 3].length || cubos[(d + 1) % 3].length || cubos[(d + 2) % 3].length; d++) {
    const actual = cubos[d % 3];
    cubos[d % 3] = [];
    for (const s of actual) {
      if (T[indice(s)] !== d) continue;
      for (const { T: P, coste } of perms) {
        const t = (P[s & 255] | P[256 + ((s >>> 8) & 255)] | P[512 + (s >>> 16)]) >>> 0;
        const k = indice(t);
        if (T[k] < 0 || T[k] > d + coste) { T[k] = d + coste; cubos[(d + coste) % 3].push(t); }
      }
    }
  }
  return T;
}

export function crearCentrosNxN(N, b, orbitas, paridad = null) {
  const n2 = N * N;
  const h = Math.floor(N / 2);
  const caraDe = (f) => Math.floor(f / n2);
  const orbs = orbitas.filter((o) => o.tipo === 'centros');
  const ordenCaras = [0, 3, 1, 4, 2, 5];
  const pos = orbs.map((o) => {
    const p = [];
    for (const f of ordenCaras) for (const pz of o.piezas) if (caraDe(pz[0]) === f) p.push(pz[0]);
    return p;
  });
  const bitsCara = (k, f) => { let x = 0; pos[k].forEach((s, j) => { if (caraDe(s) === f) x |= 1 << j; }); return x >>> 0; };
  const meta = (k, etapa) => (etapa === 1 ? bitsCara(k, 1) | bitsCara(k, 4)
    : etapa === 2 ? bitsCara(k, 0) | bitsCara(k, 3) : bitsCara(k, 0) | bitsCara(k, 1) | bitsCara(k, 2)) >>> 0;

  // ---- movimientos ----
  function crearMovimiento(nombres, cara, bloque, eje, v, coste, esCara) {
    let D = null;
    for (const nm of nombres) {
      const P = b.permDe(nm);
      const Dm = new Int32Array(P.length);
      for (let i = 0; i < P.length; i++) Dm[P[i]] = i;
      D = D ? D.map((x) => Dm[x]) : Dm; // destino tras el anterior y luego este
    }
    const T = pos.map((p) => {
      const idx = new Map(p.map((s, j) => [s, j]));
      const c = p.map((s) => idx.get(D[s]));
      const Tk = new Uint32Array(768);
      for (let k = 0; k < 3; k++) for (let x = 0; x < 256; x++) {
        let r = 0;
        for (let t = 0; t < 8; t++) if (x & (1 << t)) r |= 1 << c[k * 8 + t];
        Tk[k * 256 + x] = r >>> 0;
      }
      return { T: Tk, id: c.join(',') };
    });
    let flip = 0;
    if (paridad) { let e = b.estadoResuelto(); for (const nm of nombres) e = b.aplicarMovimiento(e, nm); flip = paridad.bits(e); }
    return { nombres, cara, bloque, eje, v, coste, esCara, flip, T: T.map((x) => x.T), id: T.map((x) => x.id) };
  }
  const MOVS = [];
  CARAS.forEach((c, f) => {
    for (let p = 1; p <= h; p++) for (const v of [1, 2, 3]) MOVS.push(crearMovimiento([nombreMovimiento(c, p, v)], f, f * 8 + p, EJE[f], v, 1, p === 1));
  });
  if (N >= 7) {
    // capa 3 suelta (no toca las órbitas de la capa 2)
    CARAS.forEach((c, f) => {
      for (const v of [1, 2, 3]) {
        const m = crearMovimiento([nombreMovimiento(c, 3, v), nombreMovimiento(c, 2, 4 - v)], f, f * 8 + 7, EJE[f], v, 2, false);
        m.capa3 = true;
        MOVS.push(m);
      }
    });
  }
  const ID0 = pos.map((p) => p.map((_, j) => j).join(','));
  const mueve = (m, k, x) => (m.T[k][x & 255] | m.T[k][256 + ((x >>> 8) & 255)] | m.T[k][512 + (x >>> 16)]) >>> 0;
  // juegos de movimientos de cada etapa (con bloques; la capa 3 suelta solo donde se dice)
  const bloque = (m) => !m.capa3;
  const J1 = (m) => bloque(m);
  const J2 = (m) => bloque(m) && (m.esCara || m.v === 2 || m.eje === 1);
  const J3 = (m) => bloque(m) && (m.esCara || m.v === 2);
  const permitido = (a, c) => !a || a.eje !== c.eje || c.bloque > a.bloque;

  // ---- pasos: [órbitas, etapa, juego de movimientos] ----
  const busca = (sub, ext) => orbs.findIndex((o) => o.subtipo === sub && (ext === null || o.nombre.includes(ext)));
  let PASOS;
  const tres = (A) => [{ orbitas: A, etapa: 1, juego: J1 }, { orbitas: A, etapa: 2, juego: J2 }, { orbitas: A, etapa: 3, juego: J3 }];
  if (N === 5) PASOS = tres([busca('X', null), busca('+', null)]);
  else if (N === 6) PASOS = tres([busca('X', 'exteriores'), busca('X', 'interiores')]);
  else if (N === 7) {
    // A (capa 2) con bloques; B (capa 3) intercalado con movimientos que no estropean lo hecho en A
    const A = [busca('X', 'exteriores'), busca('+', 'exteriores')];
    const B = [busca('X', 'interiores'), busca('+', 'interiores')];
    PASOS = [
      { orbitas: A, etapa: 1, juego: J1 },
      { orbitas: B, etapa: 1, juego: (m) => J2(m) || (m.capa3 && m.eje !== 1) },
      { orbitas: A, etapa: 2, juego: J2 },
      { orbitas: B, etapa: 2, juego: (m) => J3(m) || (m.capa3 && m.eje === 1) },
      { orbitas: A, etapa: 3, juego: J3 },
      { orbitas: B, etapa: 3, juego: (m) => m.esCara || (m.capa3 && m.v === 2) },
    ];
  } else PASOS = [];
  for (const p of PASOS) if (p.orbitas.some((k) => k < 0)) throw new Error(`nxn-centros: órbita no encontrada (${N}x${N})`);
  PASOS.forEach((p) => { p.movs = MOVS.filter(p.juego); p.par = 0; });
  // paridad de las wings: debe quedar par al acabar la última etapa que la puede cambiar
  if (paridad) {
    if (N === 7) { PASOS[2].par = paridad.exteriores; PASOS[3].par = paridad.interiores; } else PASOS[1].par = paridad.todas;
  }
  const GRUPOS = [...new Set(PASOS.map((p) => p.orbitas.join()))].map((x) => x.split(',').map(Number));

  // ---- tablas (por tipo de órbita, juego de movimientos y etapa) ----
  const cacheTablas = new Map();
  function tablaDe(k, movs, etapa) {
    const firma = etapa + ':' + [...new Set(movs.map((m) => m.id[k] + '/' + m.coste))].sort().join('|');
    if (!cacheTablas.has(firma)) {
      const perms = [...new Map(movs.map((m) => [m.id[k] + '/' + m.coste, { T: m.T[k], coste: m.coste }])).values()];
      cacheTablas.set(firma, bfs(TAM[etapa], [meta(k, etapa)], INDICE[etapa], perms));
    }
    return cacheTablas.get(firma);
  }
  function parejasDe(paso) {
    if (paso.parejas) return paso.parejas;
    const movs = paso.movs;
    paso.parejas = [];
    const [k1, k2] = paso.orbitas;
    for (let gr = 0; gr < 3; gr++) {
      const sh = 8 * gr;
      const T = new Int8Array(4900).fill(-1);
      const idx = (a, c) => r70[(a >>> sh) & 255] * 70 + r70[(c >>> sh) & 255];
      const m1 = meta(k1, 3), m2 = meta(k2, 3);
      const cubos = [[[m1, m2]], [], []];
      T[idx(m1, m2)] = 0;
      for (let d = 0; cubos[d % 3].length || cubos[(d + 1) % 3].length || cubos[(d + 2) % 3].length; d++) {
        const actual = cubos[d % 3];
        cubos[d % 3] = [];
        for (const [a, c] of actual) {
          if (T[idx(a, c)] !== d) continue;
          for (const m of movs) {
            const a2 = mueve(m, k1, a), c2 = mueve(m, k2, c);
            const j = idx(a2, c2);
            if (T[j] < 0 || T[j] > d + m.coste) { T[j] = d + m.coste; cubos[(d + m.coste) % 3].push([a2, c2]); }
          }
        }
      }
      paso.parejas.push({ sh, T });
    }
    return paso.parejas;
  }
  let listo = false;
  function inicializar() {
    if (listo) return;
    for (const p of PASOS) {
      for (const k of p.orbitas) tablaDe(k, p.movs, p.etapa);
      if (p.etapa === 3) parejasDe(p);
    }
    listo = true;
  }

  // ---- IDA* (con la heurística inflada por w si hace falta) ----
  function etapa(paso, estado, ultimo, limite, w, par0 = 0) {
    const numEtapa = paso.etapa;
    const [k1, k2] = paso.orbitas;
    // sin movimientos que hagan lo mismo a las dos órbitas (p. ej. 2Rw y 3Rw para las exteriores del 7x7)
    const vistos = new Map();
    for (const m of paso.movs) {
      const clave = m.id[k1] + '|' + m.id[k2] + '|' + (m.flip & paso.par);
      const prev = vistos.get(clave);
      if (!prev || m.coste < prev.coste) vistos.set(clave, m);
    }
    const movs = [...vistos.values()].filter((m) => !(m.id[k1] === ID0[k1] && m.id[k2] === ID0[k2] && !(m.flip & paso.par)));
    const flip = Int8Array.from(movs.map((m) => m.flip & paso.par));
    const T1 = tablaDe(k1, paso.movs, numEtapa), T2 = tablaDe(k2, paso.movs, numEtapa);
    const P = numEtapa === 3 ? parejasDe(paso) : [];
    const M = movs.length;
    const TA = movs.map((m) => m.T[k1]), TC = movs.map((m) => m.T[k2]);
    const coste = Int8Array.from(movs.map((m) => m.coste));
    // permit[(i + 1) * M + j]: puede ir j después de i (fila 0: sin anterior)
    const permit = new Uint8Array((M + 1) * M);
    for (let j = 0; j < M; j++) permit[j] = permitido(ultimo, movs[j]) ? 1 : 0;
    for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) permit[(i + 1) * M + j] = permitido(movs[i], movs[j]) ? 1 : 0;
    const W = new Int16Array(64); for (let v = 0; v < 64; v++) W[v] = Math.floor(v * w);
    const P0 = P[0] ? P[0].T : null, P1 = P[1] ? P[1].T : null, P2 = P[2] ? P[2].T : null;
    const e3 = numEtapa === 3, e2 = numEtapa === 2;
    const hDe = (a, c) => {
      let hv, v2;
      if (e3) {
        hv = T1[(r70[a & 255] * 70 + r70[(a >>> 8) & 255]) * 70 + r70[a >>> 16]];
        v2 = T2[(r70[c & 255] * 70 + r70[(c >>> 8) & 255]) * 70 + r70[c >>> 16]]; if (v2 > hv) hv = v2;
        v2 = P0[r70[a & 255] * 70 + r70[c & 255]]; if (v2 > hv) hv = v2;
        v2 = P1[r70[(a >>> 8) & 255] * 70 + r70[(c >>> 8) & 255]]; if (v2 > hv) hv = v2;
        v2 = P2[r70[a >>> 16] * 70 + r70[c >>> 16]]; if (v2 > hv) hv = v2;
      } else if (e2) {
        hv = T1[r16[(a & 255) | ((a >>> 16) << 8)]];
        v2 = T2[r16[(c & 255) | ((c >>> 16) << 8)]]; if (v2 > hv) hv = v2;
      } else {
        hv = T1[rango8(a)]; v2 = T2[rango8(c)]; if (v2 > hv) hv = v2;
      }
      return hv;
    };
    const h0 = hDe(estado[0], estado[1]);
    if (h0 === 0 && !(par0 & paso.par)) return [];
    let nodos = 0;
    const camino = new Int16Array(80);
    let largo = 0;
    const buscar = (a, c, resto, fila, prof, par) => {
      if (++nodos > limite) throw new Error('límite');
      const base = fila * M;
      for (let j = 0; j < M; j++) {
        if (!permit[base + j] || coste[j] > resto) continue;
        const ta = TA[j], tc = TC[j];
        const a2 = (ta[a & 255] | ta[256 + ((a >>> 8) & 255)] | ta[512 + (a >>> 16)]) >>> 0;
        const c2 = (tc[c & 255] | tc[256 + ((c >>> 8) & 255)] | tc[512 + (c >>> 16)]) >>> 0;
        const hv = hDe(a2, c2);
        const r2 = resto - coste[j];
        const par2 = par ^ flip[j];
        if (hv === 0 && !par2) { camino[prof] = j; largo = prof + 1; return true; }
        if (W[hv] > r2 || hv > r2 || (hv === 0 && r2 === 0)) continue;
        camino[prof] = j;
        if (buscar(a2, c2, r2, j + 1, prof + 1, par2)) return true;
      }
      return false;
    };
    for (let L = Math.max(h0, W[h0], 1); L < 80; L++) {
      if (buscar(estado[0], estado[1], L, 0, 0, par0 & paso.par)) return Array.from(camino.subarray(0, largo)).map((j) => movs[j]);
    }
    throw new Error('sin solución');
  }

  // [peso de la heurística, límite de nodos] por etapa, en orden
  const PLAN = [
    [[1, 6e5], [1.3, 3e5]],
    [[1, 6e5], [1.3, 3e5], [1.7, 2e5]],
    [[1, 1e5], [1.3, 2e5], [1.7, 2e5], [2.5, 2e5]],
  ];

  /** norm: estado normalizado (colores = caras). Devuelve { movimientos, porEtapa, resueltas (índices en `orbitas`) }. */
  // Rotaciones del cubo entero para elegir qué par de caras se separa primero:
  // se resuelve el estado girado (con los colores renombrados) y los movimientos
  // se traducen al sistema del usuario.
  const ROTS = (() => {
    const res = [];
    const nombres = [...new Set(MOVS.flatMap((m) => m.nombres))];
    const resuelto = b.estadoResuelto();
    const giros = [null, b.geo.rot.z, b.geo.rot.y];
    for (const P of giros) {
      if (!P) { res.push({ P: null, sigma: null, mapa: null }); continue; }
      const rot = aplicarPerm(resuelto, P);
      const sigma = new Array(6);
      for (let f = 0; f < 6; f++) sigma[rot[f * n2 + Math.floor(n2 / 2)]] = f;
      const Pinv = new Int32Array(P.length); for (let i = 0; i < P.length; i++) Pinv[P[i]] = i;
      const clave = (Q) => Q.join(',');
      const porPerm = new Map(nombres.map((nm) => [clave(b.permDe(nm)), nm]));
      const mapa = new Map();
      for (const nm of nombres) {
        const Q = b.permDe(nm);
        const Q2 = new Array(Q.length);
        for (let i = 0; i < Q.length; i++) Q2[i] = P[Q[Pinv[i]]];
        const orig = porPerm.get(clave(Q2));
        if (!orig) throw new Error('nxn-centros: rotación sin movimiento equivalente');
        mapa.set(nm, orig);
      }
      res.push({ P, sigma, mapa });
    }
    return res;
  })();

  function resolver(norm, opciones = {}) {
    inicializar();
    // elegir la rotación con la E1 más corta (según la tabla)
    const paso0 = PASOS[0];
    const cands = ROTS.map((R) => {
      const e = R.P ? aplicarPerm(norm, R.P).map((c) => R.sigma[c]) : norm;
      let h0 = 0;
      for (const k of paso0.orbitas) {
        let x = 0; pos[k].forEach((s, j) => { if (e[s] === 1 || e[s] === 4) x |= 1 << j; });
        h0 = Math.max(h0, tablaDe(k, paso0.movs, 1)[rango8(x >>> 0)]);
      }
      return { R, e, h0 };
    }).sort((x, y) => x.h0 - y.h0);
    let r = null;
    for (const c of cands.slice(0, opciones.rotaciones ?? 2)) {
      r = resolverGirado(c.e, opciones);
      if (c.R.mapa) r.movimientos = r.movimientos.map((nm) => c.R.mapa.get(nm));
      if (r.porEtapa[0] !== null) break; // si falla la primera etapa, otra rotación
    }
    return r;
  }

  function resolverGirado(norm, opciones) {
    let est = norm;
    const res = [], porEtapa = [];
    const fallidas = new Set();
    let ultimo = null;
    const COLORES = [null, [1, 4], [0, 3], [0, 1, 2]];
    for (const paso of PASOS) {
      if (paso.orbitas.some((k) => fallidas.has(k))) continue;
      const cols = COLORES[paso.etapa];
      const mascara = (k) => { let x = 0; pos[k].forEach((s, j) => { if (cols.includes(est[s])) x |= 1 << j; }); return x >>> 0; };
      const ini = paso.orbitas.map(mascara);
      let movs = null;
      for (const [w, limite] of (opciones.plan ?? PLAN)[paso.etapa - 1]) {
        try { movs = etapa(paso, ini, ultimo, limite, w, paridad && paso.par ? paridad.bits(est) : 0); break; } catch (err) { if (err.message !== 'límite') throw err; }
      }
      if (!movs) { paso.orbitas.forEach((k) => fallidas.add(k)); porEtapa.push(null); continue; }
      for (const m of movs) for (const nm of m.nombres) { est = b.aplicarMovimiento(est, nm); res.push(nm); }
      porEtapa.push(movs.reduce((s, m) => s + m.coste, 0));
      if (movs.length) ultimo = movs[movs.length - 1];
    }
    const resueltas = [...new Set(PASOS.flatMap((p) => p.orbitas))].filter((k) => !fallidas.has(k));
    return { movimientos: res, porEtapa, resueltas: resueltas.map((k) => orbitas.indexOf(orbs[k])), estado: est };
  }

  const hist = () => [...cacheTablas.entries()].map(([k, T]) => { let neg = 0, mx = 0; for (const v of T) { if (v < 0) neg++; else if (v > mx) mx = v; } return k.slice(0, 3) + " neg=" + neg + " max=" + mx; });
  return { inicializar, resolver, grupos: GRUPOS, hist };
}
