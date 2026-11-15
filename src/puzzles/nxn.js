// Cubos NxN (2x2 ... 7x7): modelo de pegatinas, notación WCA y dibujo.
//
// Estado: array de 6·N² colores (0..5) en orden de caras U R F D L B; cada
// cara en filas de arriba a abajo tal y como se ve en la red desplegada
// (U con B arriba, D con F arriba, el resto con U arriba). Para N=3 coincide
// con la numeración de pegatinas de Kociemba (U1..U9 R1..R9 F1.. D1.. L1.. B1..).

import { definirPuzzle } from '../core/puzzle.js';
import { aplicarPerm, componer, identidad } from '../core/perm.js';
import { svgDePegatinas } from '../core/render.js';
import { modelo3DPegatinas, CAMARA_CUBO } from '../core/modelo3d.js';

export const CARAS = ['U', 'R', 'F', 'D', 'L', 'B'];
export const PALETA_CUBO = [
  { nombre: 'blanco', hex: '#f4f4f4' },
  { nombre: 'rojo', hex: '#d62828' },
  { nombre: 'verde', hex: '#2a9d4b' },
  { nombre: 'amarillo', hex: '#ffd60a' },
  { nombre: 'naranja', hex: '#f77f00' },
  { nombre: 'azul', hex: '#1d5ad8' },
];
// Eje normal saliente de cada cara (x = R, y = U, z = F)
const NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
const EJE = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

// Longitudes estándar de los scrambles de movimientos aleatorios
export const LONGITUD_WCA = { 2: 11, 3: 25, 4: 40, 5: 60, 6: 80, 7: 100 };

/** Posición 3D (enteros) de la pegatina (cara, fila, columna) en un cubo N. */
function posicion(N, cara, r, c) {
  const a = -(N - 1) + 2 * c; // de izquierda a derecha
  const b = (N - 1) - 2 * r;  // de arriba a abajo
  switch (cara) {
    case 'U': return [a, N, -(N - 1) + 2 * r];
    case 'D': return [a, -N, (N - 1) - 2 * r];
    case 'F': return [a, b, N];
    case 'B': return [-a, b, -N];
    case 'R': return [N, b, -a];
    case 'L': return [-N, b, a];
  }
  throw new Error('cara');
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Giro de 90° horario visto desde la punta del eje a. */
const girar = (v, a) => {
  const d = dot(a, v), x = cruz(a, v);
  return [a[0] * d - x[0], a[1] * d - x[1], a[2] * d - x[2]];
};

const cacheGeo = new Map();
/** Geometría y permutaciones de un cubo N (se calcula una vez). */
export function geometriaNxN(N) {
  if (cacheGeo.has(N)) return cacheGeo.get(N);
  const pos = [];
  const indice = new Map();
  CARAS.forEach((cara) => {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const p = posicion(N, cara, r, c);
      indice.set(p.join(','), pos.length);
      pos.push(p);
    }
  });
  // perm de cuarto de vuelta para (cara, profundidad): capas 1..prof desde esa cara
  const cuartos = {};
  function cuarto(cara, prof) {
    const k = cara + prof;
    if (cuartos[k]) return cuartos[k];
    const a = NORMAL[cara];
    const P = identidad(pos.length);
    pos.forEach((p, j) => {
      if (prof >= N || dot(p, a) > N - 2 * prof) {
        const q = girar(p, a);
        P[indice.get(q.join(','))] = j;
      }
    });
    cuartos[k] = P;
    return P;
  }
  // Rotaciones del cubo entero (x = R, y = U, z = F)
  const rot = { x: cuarto('R', N), y: cuarto('U', N), z: cuarto('F', N) };
  const g = { N, pos, indice, cuarto, rot };
  cacheGeo.set(N, g);
  return g;
}

const RE_MOV = /^(\d*)([URFDLB])(w?)(2'|2|')?$/;
const RE_ROT = /^([xyz])(2'|2|')?$/;
/** true si el movimiento es una rotación del cubo entero (x, y, z). */
export const esRotacion = (mov) => RE_ROT.test(mov);

/** Analiza un movimiento NxN. Devuelve { cara, prof, veces } o lanza error. */
export function analizarMovimiento(mov, N) {
  // Rotaciones del cubo entero (x como R, y como U, z como F): las usan los métodos humanos (modo aprender)
  const r = RE_ROT.exec(mov);
  if (r) return { cara: { x: 'R', y: 'U', z: 'F' }[r[1]], prof: N, veces: r[2] === "'" ? 3 : r[2] ? 2 : 1, rotacion: true };
  const m = RE_MOV.exec(mov);
  if (!m) throw new Error(`Movimiento no válido: "${mov}"`);
  let prof = 1;
  if (m[3] === 'w') prof = m[1] ? parseInt(m[1], 10) : 2;
  else if (m[1]) throw new Error(`Movimiento no válido: "${mov}"`);
  if (prof < 1 || (prof > 1 && prof > N - 1)) throw new Error(`Profundidad no válida en "${mov}" para ${N}x${N}`);
  const veces = m[4] === "'" ? 3 : m[4] === '2' || m[4] === "2'" ? 2 : 1;
  return { cara: m[2], prof, veces };
}

export function nombreMovimiento(cara, prof, veces) {
  const pre = prof === 1 ? '' : prof === 2 ? '' : String(prof);
  const w = prof === 1 ? '' : 'w';
  const suf = veces === 1 ? '' : veces === 2 ? '2' : "'";
  return pre + cara + w + suf;
}

export function invertirMovimientoNxN(mov) {
  if (mov.endsWith("2'")) return mov.slice(0, -1);
  if (mov.endsWith('2')) return mov;
  if (mov.endsWith("'")) return mov.slice(0, -1);
  return mov + "'";
}

/**
 * Modelo 3D del cubo N (vista 3D): cada pegatina es un cuadrado de lado 2/N en
 * la superficie del cubo [-1, 1]³; un giro rota las capas que mueve su permutación.
 */
const cache3D = new Map();
export function modelo3DNxN(N) {
  if (cache3D.has(N)) return cache3D.get(N);
  const geo = geometriaNxN(N);
  const poligonos = [], normales = [];
  geo.pos.forEach((p) => {
    const k = p.findIndex((x) => Math.abs(x) === N); // eje normal
    const n = [0, 0, 0]; n[k] = Math.sign(p[k]);
    const u = [0, 0, 0], v = [0, 0, 0];
    u[(k + 1) % 3] = 1; v[(k + 2) % 3] = 1;
    const esq = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [0, 1, 2].map((i) => (p[i] + a * u[i] + b * v[i]) / N));
    poligonos.push(esq); normales.push(n);
  });
  // cortes entre capas (para agrupar pegatinas en piezas)
  const cortes = [];
  for (let k = 1; k < N; k++) for (let e = 0; e < 3; e++) { const n = [0, 0, 0]; n[e] = 1; cortes.push({ n, h: (-N + 2 * k) / N }); }
  const m = modelo3DPegatinas({
    poligonos,
    normales,
    cortes,
    camara: CAMARA_CUBO,
    giro(mov) {
      let a;
      try { a = analizarMovimiento(mov, N); } catch { return null; }
      const eje = NORMAL[a.cara];
      const pegatinas = [];
      geo.pos.forEach((p, j) => { if (a.prof >= N || dot(p, eje) > N - 2 * a.prof) pegatinas.push(j); });
      // cuarto de vuelta horario visto desde la cara = −90° (regla de la mano derecha)
      const angulo = a.veces === 1 ? -Math.PI / 2 : a.veces === 2 ? -Math.PI : Math.PI / 2;
      return [{ eje, angulo, pegatinas }];
    },
  });
  cache3D.set(N, m);
  return m;
}

/** Disposición de la red: [columna, fila] de cada cara en unidades de cara. */
const RED = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };

export function pegatinasRedNxN(N) {
  const hueco = 0.12 * N;
  const peg = [];
  CARAS.forEach((cara) => {
    const [cx, cy] = RED[cara];
    const ox = cx * (N + hueco), oy = cy * (N + hueco);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = ox + c, y = oy + r, e = 0.04;
      peg.push({ poligono: [[x + e, y + e], [x + 1 - e, y + e], [x + 1 - e, y + 1 - e], [x + e, y + 1 - e]] });
    }
  });
  return peg;
}

/** Crea las piezas genéricas comunes a todos los NxN (movimientos, dibujo, scramble aleatorio). */
export function baseNxN(N) {
  const geo = geometriaNxN(N);
  const cache = new Map();
  function permDe(mov) {
    let P = cache.get(mov);
    if (P) return P;
    const { cara, prof, veces } = analizarMovimiento(mov, N);
    const q = geo.cuarto(cara, prof);
    P = q;
    for (let i = 1; i < veces; i++) P = componer(P, q);
    cache.set(mov, P);
    return P;
  }
  const resuelto = [];
  for (let f = 0; f < 6; f++) for (let i = 0; i < N * N; i++) resuelto.push(f);
  const pegatinas = pegatinasRedNxN(N);

  // Giros permitidos en los scrambles aleatorios: caras + capas anchas hasta floor(N/2)
  const giros = [];
  for (const cara of CARAS) {
    for (let prof = 1; prof <= Math.max(1, Math.floor(N / 2)); prof++) {
      if (N <= 3 && prof > 1) continue;
      giros.push({ base: nombreMovimiento(cara, prof, 1), eje: EJE[cara], clave: cara, prof });
    }
  }

  return {
    N,
    geo,
    paleta: PALETA_CUBO,
    permDe,
    estadoResuelto: () => resuelto.slice(),
    aplicarMovimiento: (e, mov) => aplicarPerm(e, permDe(mov)),
    estaResuelto(e) {
      const n2 = N * N;
      for (let f = 0; f < 6; f++) {
        const c = e[f * n2];
        for (let i = 1; i < n2; i++) if (e[f * n2 + i] !== c) return false;
      }
      return true;
    },
    invertirMovimiento: invertirMovimientoNxN,
    infoMovimiento(mov) {
      const { cara, prof } = analizarMovimiento(mov, N);
      return { eje: EJE[cara], clave: cara, prof };
    },
    // En un tramo de movimientos del mismo eje: como mucho un movimiento por
    // cara, y las dos caras opuestas no pueden cubrir entre ambas las N capas
    // (eso sería una rotación del cubo entero o capas solapadas).
    buscarRedundancia(movs) {
      let eje = null, usados = [];
      for (let i = 0; i < movs.length; i++) {
        const { cara, prof } = analizarMovimiento(movs[i], N);
        if (EJE[cara] !== eje) { eje = EJE[cara]; usados = []; }
        if (usados.some((u) => u.cara === cara)) return `movimiento redundante en la posición ${i + 1} (${movs[i]})`;
        if (usados.some((u) => u.prof + prof >= N)) return `capas solapadas en la posición ${i + 1} (${movs[i]})`;
        usados.push({ cara, prof });
      }
      return null;
    },
    scrambleAleatorio(rng, n = LONGITUD_WCA[N]) {
      const res = [];
      let eje = null, usados = [];
      while (res.length < n) {
        const g = giros[Math.floor(rng() * giros.length)];
        if (g.eje === eje) {
          if (usados.some((u) => u.clave === g.clave || u.prof + g.prof >= N)) continue;
        } else { eje = g.eje; usados = []; }
        usados.push(g);
        res.push(g.base + ['', "'", '2'][Math.floor(rng() * 3)]);
      }
      return res;
    },
    pegatinas,
    ...modelo3DNxN(N),
    renderizar(estado, opciones = {}) {
      const k = opciones.vista ? CARAS.indexOf(opciones.vista) : -1;
      if (k < 0) return svgDePegatinas(pegatinas, estado, PALETA_CUBO, opciones);
      // una sola cara, ampliada (para editar cubos grandes en pantallas pequeñas)
      const solo = Array.from({ length: N * N }, (_, i) => k * N * N + i);
      return svgDePegatinas(pegatinas, estado, PALETA_CUBO, { ...opciones, solo, margen: 0.04 });
    },
    // Vistas del editor: la red completa o una cara ampliada
    vistasEditor: [{ id: 'red', nombre: 'Red' }].concat(CARAS.map((c) => ({ id: c, nombre: c }))),
    // "Rellenar cara": pinta toda la cara de la pegatina tocada con el último color elegido
    herramientas: [{ id: 'rellenar', nombre: 'Rellenar cara', icono: '▦', toques: 1, usaColor: true, titulo: 'Toca una pegatina para pintar toda su cara con el último color elegido' }],
    usarHerramienta(estado, id, indices, contexto = {}) {
      if (id !== 'rellenar') throw new Error(`Herramienta desconocida: ${id}`);
      const color = contexto.color ?? 0;
      const f = Math.floor(indices[0] / (N * N));
      const e = estado.slice();
      for (let i = f * N * N; i < (f + 1) * N * N; i++) e[i] = color;
      return e;
    },
  };
}

/** Puzzle NxN solo con scramble y vista previa (4x4..7x7 esta noche). */
export function crearNxN(N, extra = {}) {
  const b = baseNxN(N);
  return definirPuzzle(Object.assign({
    id: `${N}x${N}`,
    nombre: `${N}x${N}`,
    capacidades: { scramble: true, validar: false, resolver: false, editar: false },
    paleta: b.paleta,
    estadoResuelto: b.estadoResuelto,
    aplicarMovimiento: b.aplicarMovimiento,
    estaResuelto: b.estaResuelto,
    invertirMovimiento: b.invertirMovimiento,
    infoMovimiento: b.infoMovimiento,
    buscarRedundancia: b.buscarRedundancia,
    generarScramble: (rng) => b.scrambleAleatorio(rng),
    renderizar: b.renderizar,
    vista3D: b.vista3D,
    giro3D: b.giro3D,
    tipoScramble: 'movimientos aleatorios',
    longitudScramble: LONGITUD_WCA[N],
  }, extra));
}

// ---------- Simplificación de secuencias (soluciones) ----------
//
// Los movimientos de un mismo eje conmutan. Un tramo de movimientos del mismo
// eje equivale a un vector de giros por capa (en el sentido de U, R o F; capa 1
// = la de U, R o F). La forma canónica de un vector es la descomposición con
// menos movimientos WCA (capas anchas de las dos caras del eje, sin rotaciones
// del cubo entero) y, a igualdad, con capas menos profundas.

const CARA_POS = ['U', 'R', 'F'];
const CARA_NEG = ['D', 'L', 'B'];

/** Vector de capas de un movimiento: { eje, capas: Int8Array(N) } (giros mod 4). */
function vectorDe(mov, N) {
  const { cara, prof, veces } = analizarMovimiento(mov, N);
  const eje = EJE[cara];
  const a = new Int8Array(N);
  if (CARA_POS.includes(cara)) for (let k = 0; k < prof; k++) a[k] = veces;
  else for (let k = N - prof; k < N; k++) a[k] = (4 - veces) % 4;
  return { eje, a };
}

/** Descomposición canónica de un vector de capas (lista de movimientos). */
export function descomponerTramo(eje, a, N) {
  // Fronteras j = 1..N-1 entre las capas j y j+1. x_j = giro de la capa ancha de
  // profundidad j desde la cara positiva; la cara negativa a profundidad N-j gira
  // (x_j - D_j), con D_j = a_j - a_{j+1}. Restricción: Σ x_j ≡ a_1 (mod 4).
  const D = [];
  for (let j = 1; j < N; j++) D[j] = ((a[j - 1] - a[j]) % 4 + 4) % 4;
  const INF = [1e9, 1e9];
  let dp = [[0, 0], INF, INF, INF];
  const elec = []; // elec[j][s] = [x, sPrevio]
  for (let j = 1; j < N; j++) {
    const nd = [INF, INF, INF, INF];
    elec[j] = [];
    for (let s = 0; s < 4; s++) {
      if (dp[s][0] >= 1e9) continue;
      for (let x = 0; x < 4; x++) {
        const movs = (x !== 0 ? 1 : 0) + (x !== D[j] ? 1 : 0);
        const prof = (x !== 0 ? j : 0) + (x !== D[j] ? N - j : 0);
        const c = [dp[s][0] + movs, dp[s][1] + prof];
        const t = (s + x) % 4;
        if (c[0] < nd[t][0] || (c[0] === nd[t][0] && c[1] < nd[t][1])) { nd[t] = c; elec[j][t] = [x, s]; }
      }
    }
    dp = nd;
  }
  const res = [];
  let s = ((a[0] % 4) + 4) % 4;
  if (N === 1) return res;
  const pos = [], neg = [];
  for (let j = N - 1; j >= 1; j--) {
    const [x, sp] = elec[j][s];
    if (x !== 0) pos.push(nombreMovimiento(CARA_POS[eje], j, x));
    const u = ((x - D[j]) % 4 + 4) % 4;
    if (u !== 0) neg.push(nombreMovimiento(CARA_NEG[eje], N - j, (4 - u) % 4));
    s = sp;
  }
  return pos.reverse().concat(neg.sort((p, q) => p.length - q.length || (p < q ? -1 : 1)));
}

/**
 * Simplifica una secuencia uniendo los tramos del mismo eje en su forma
 * canónica (y quitando los que se anulan). `etiquetas` (opcional, una por
 * movimiento) se conservan: un tramo unido toma la etiqueta de su primer
 * movimiento. Devuelve { movimientos, etiquetas }.
 */
export function simplificarNxN(movs, N, etiquetas = null) {
  const pila = []; // { eje, a, etiqueta }
  movs.forEach((m, i) => {
    const { eje, a } = vectorDe(m, N);
    const top = pila[pila.length - 1];
    if (top && top.eje === eje) {
      for (let k = 0; k < N; k++) top.a[k] = (top.a[k] + a[k]) % 4;
      if (top.a.every((x) => x === 0)) pila.pop();
    } else {
      pila.push({ eje, a, etiqueta: etiquetas ? etiquetas[i] : null });
    }
  });
  const movimientos = [], etq = [];
  for (const t of pila) {
    for (const m of descomponerTramo(t.eje, t.a, N)) { movimientos.push(m); etq.push(t.etiqueta); }
  }
  return { movimientos, etiquetas: etq };
}

/**
 * Comprueba que una solución no tenga tramos simplificables: cada tramo de
 * movimientos del mismo eje debe ser su forma canónica (la más corta).
 * Devuelve null o la descripción del problema.
 */
export function redundanciaSolucionNxN(movs, N) {
  for (let i = 0; i < movs.length;) {
    const { eje } = vectorDe(movs[i], N);
    let j = i;
    const a = new Int8Array(N);
    while (j < movs.length && vectorDe(movs[j], N).eje === eje) {
      const v = vectorDe(movs[j], N).a;
      for (let k = 0; k < N; k++) a[k] = (a[k] + v[k]) % 4;
      j++;
    }
    const canon = descomponerTramo(eje, a, N);
    if (canon.length < j - i) return `tramo simplificable en la posición ${i + 1} (${movs.slice(i, j).join(' ')} → ${canon.join(' ') || 'nada'})`;
    i = j;
  }
  return null;
}
