// Modelo de piezas de un cubo NxN, deducido de la geometría (no escrito a mano).
//
// Las pegatinas se agrupan en piezas por la posición 3D de su cubie, y las
// piezas en órbitas según los movimientos (cualquier cara, cualquier
// profundidad). Así salen solas, para cualquier N:
//   - esquinas (8)            orden de pegatinas de Kociemba (cubo-comun.js)
//   - aristas centrales (12)  solo N impar; orden de pegatinas como en el 3x3
//   - wings (24 por órbita)   ⌊(N-2)/2⌋ órbitas; la primera pegatina de cada
//                             wing es siempre la de la misma órbita de
//                             pegatinas, así que una wing nunca está "girada"
//   - centros (24 por órbita) X, +, oblicuos...; en N impar, además, los 6
//                             centros fijos
//
// Cada órbita: { tipo, nombre, piezas: [[pegatinas]], nombresPos: [texto] }.

import { geometriaNxN, CARAS } from './nxn.js';
import { piezasCubo, NOMBRES_ESQUINAS, NOMBRES_ARISTAS } from './cubo-comun.js';

const VEC = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
const CARA_NEG_EJE = ['L', 'D', 'B']; // cara del extremo negativo de los ejes x, y, z

function unionFind(n) {
  const p = Array.from({ length: n }, (_, i) => i);
  const raiz = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
  return { raiz, unir: (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) p[a] = b; } };
}

const cache = new Map();

/** Generadores (cuartos de vuelta de cada cara a cada profundidad) como permutaciones de pegatinas. */
export function generadoresNxN(N) {
  const geo = geometriaNxN(N);
  const gens = [];
  for (const c of CARAS) for (let p = 1; p < N; p++) gens.push(geo.cuarto(c, p));
  return gens;
}

export function modeloPiezasNxN(N) {
  if (cache.has(N)) return cache.get(N);
  const geo = geometriaNxN(N);
  const n2 = N * N;
  const nPeg = 6 * n2;
  const caraDe = (i) => Math.floor(i / n2);
  const idx = (cara, p) => geo.indice.get(p.join(','));

  // Órbitas de pegatinas (sin unir las pegatinas de una misma pieza)
  const ufPeg = unionFind(nPeg);
  const gens = generadoresNxN(N);
  for (const P of gens) for (let i = 0; i < nPeg; i++) ufPeg.unir(i, P[i]);

  const orbitas = [];
  const { esquinas } = piezasCubo(N);
  orbitas.push({ tipo: 'esquinas', nombre: 'esquinas', piezas: esquinas, nombresPos: NOMBRES_ESQUINAS.slice() });

  // Aristas: para cada arista, pegatinas a lo largo del eje libre
  const aristasPorT = new Map(); // |t| -> lista de piezas
  const nombresPorT = new Map();
  const centrales = [];
  NOMBRES_ARISTAS.forEach((nom) => {
    const caras = nom.split('');
    const d = [0, 0, 0];
    for (const c of caras) for (let k = 0; k < 3; k++) d[k] += VEC[c][k];
    const libre = d.findIndex((x) => x === 0);
    const pegDe = (t) => caras.map((cara) => {
      const n = VEC[cara];
      const p = [0, 1, 2].map((k) => (k === libre ? t : n[k] !== 0 ? N * n[k] : d[k] * (N - 1)));
      return idx(cara, p);
    });
    for (let t = -(N - 3), i = 1; t <= N - 3; t += 2, i++) {
      if (t === 0) { centrales.push(pegDe(0)); continue; }
      const k = Math.abs(t);
      if (!aristasPorT.has(k)) { aristasPorT.set(k, []); nombresPorT.set(k, []); }
      aristasPorT.get(k).push(pegDe(t));
      nombresPorT.get(k).push(`${nom} n.º ${i} desde ${CARA_NEG_EJE[libre]}`);
    }
  });
  if (centrales.length) {
    orbitas.push({ tipo: 'aristas', nombre: 'aristas centrales', piezas: centrales, nombresPos: NOMBRES_ARISTAS.slice() });
  }
  const ks = [...aristasPorT.keys()].sort((a, b) => b - a); // de fuera hacia dentro
  ks.forEach((k, w) => {
    const piezas = aristasPorT.get(k);
    // primera pegatina: la de la órbita de pegatinas de la primera pegatina de la primera wing
    const ref = ufPeg.raiz(piezas[0][0]);
    const ordenadas = piezas.map((pz) => (ufPeg.raiz(pz[0]) === ref ? pz : [pz[1], pz[0]]));
    if (!ordenadas.every((pz) => ufPeg.raiz(pz[0]) === ref && ufPeg.raiz(pz[1]) !== ref)) {
      throw new Error(`Modelo NxN: las pegatinas de las wings no se separan en dos órbitas (N=${N})`);
    }
    const nombre = ks.length === 1 ? 'wings' : `wings ${w === 0 ? 'exteriores' : 'interiores'}`;
    orbitas.push({ tipo: 'wings', nombre, piezas: ordenadas, nombresPos: nombresPorT.get(k) });
  });

  // Centros: pegatinas interiores de cada cara, agrupadas por órbita
  const interiores = [];
  for (let i = 0; i < nPeg; i++) {
    const r = Math.floor((i % n2) / N), c = i % N;
    if (r > 0 && r < N - 1 && c > 0 && c < N - 1) interiores.push(i);
  }
  const grupos = new Map();
  for (const i of interiores) {
    const k = ufPeg.raiz(i);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(i);
  }
  const centrales2 = [];
  const listas = [...grupos.values()].sort((a, b) => a[0] - b[0]);
  const descr = (lista) => {
    // representante en U: fila y columna del primer índice
    const i = lista[0];
    const r = Math.floor((i % n2) / N), c = i % N;
    const a = Math.min(r, N - 1 - r), b = Math.min(c, N - 1 - c);
    const medio = (x) => N % 2 === 1 && x === (N - 1) / 2;
    if (medio(r) && medio(c)) return { tipo: 'fijos', clave: [0, 0, 0] };
    if (a === b) return { tipo: 'X', clave: [1, a, 0] };
    if (medio(r) || medio(c)) return { tipo: '+', clave: [2, Math.min(a, b), 0] };
    return { tipo: 'oblicuos', clave: [3, Math.min(a, b), r < c ? 0 : 1] };
  };
  const info = listas.map((l) => ({ lista: l, ...descr(l) }));
  const cuenta = (tipo) => info.filter((x) => x.tipo === tipo).length;
  info.sort((x, y) => x.clave[0] - y.clave[0] || x.clave[1] - y.clave[1] || x.clave[2] - y.clave[2]);
  const vistos = {};
  for (const x of info) {
    if (x.tipo === 'fijos') { centrales2.push(...x.lista); continue; }
    vistos[x.tipo] = (vistos[x.tipo] || 0) + 1;
    let nombre;
    if (x.tipo === 'X') nombre = cuenta('X') === 1 ? (N === 4 ? 'centros' : 'centros en X') : `centros en X ${vistos.X === 1 ? 'exteriores' : 'interiores'}`;
    else if (x.tipo === '+') nombre = cuenta('+') === 1 ? 'centros en cruz' : `centros en cruz ${vistos['+'] === 1 ? 'exteriores' : 'interiores'}`;
    else nombre = `centros oblicuos ${vistos.oblicuos === 1 ? 'A' : 'B'}`;
    const piezas = x.lista.map((i) => [i]);
    const nombresPos = x.lista.map((i) => `cara ${CARAS[caraDe(i)]}`);
    orbitas.push({ tipo: 'centros', subtipo: x.tipo, nombre, piezas, nombresPos });
  }
  const fijos = centrales2.length ? centrales2 : null; // índices de los centros fijos (N impar), en orden U R F D L B

  // Comprobación: cada pegatina está en exactamente una pieza
  const usadas = new Uint8Array(nPeg);
  for (const o of orbitas) for (const pz of o.piezas) for (const f of pz) usadas[f]++;
  if (fijos) for (const f of fijos) usadas[f]++;
  for (let i = 0; i < nPeg; i++) if (usadas[i] !== 1) throw new Error(`Modelo NxN: pegatina ${i} en ${usadas[i]} piezas (N=${N})`);

  const res = { N, orbitas, fijos, geo };
  cache.set(N, res);
  return res;
}
