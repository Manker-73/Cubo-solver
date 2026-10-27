// Pyraminx: modelo geométrico, validador, solucionador óptimo y scramble de estado aleatorio.
//
// Orientación WCA: cara de abajo (D) horizontal y cara frontal (F) hacia ti.
// Vértices U (arriba), L (abajo izquierda), R (abajo derecha), B (atrás).
// U L R B giran las dos capas exteriores de ese vértice 120° en sentido horario
// (mirando el vértice); u l r b giran solo la punta.

import { definirPuzzle } from '../core/puzzle.js';
import { crearGeoPuzzle } from '../core/geopuzzle.js';
import { carasDesdeVertices, unit, dot, esc } from '../core/geometria.js';
import { crearModeloPiezas, crearBuscador } from '../core/piezas.js';
import { permutacionesDeColor, reetiquetar } from '../core/simetria.js';
import { svgDePegatinas } from '../core/render.js';
import { barajar, entero, rngSeguro } from '../core/rng.js';
import { paridad } from '../core/perm.js';

const S6 = Math.sqrt(6), S2 = Math.sqrt(2);
const VERT = { U: [0, 3, 0], L: [-S6, -1, S2], R: [S6, -1, S2], B: [0, -1, -2 * S2] };
const VN = ['U', 'L', 'R', 'B'];
// Caras: F (opuesta a B), L (opuesta a R), R (opuesta a L), D (opuesta a U)
const CARAS_N = ['F', 'L', 'R', 'D'];
const OPUESTO = { F: 'B', L: 'R', R: 'L', D: 'U' };
export const PALETA_PYRA = [
  { nombre: 'verde', hex: '#2a9d4b' },
  { nombre: 'rojo', hex: '#d62828' },
  { nombre: 'azul', hex: '#1d5ad8' },
  { nombre: 'amarillo', hex: '#ffd60a' },
];
const nombreColor = (c) => (PALETA_PYRA[c] ? PALETA_PYRA[c].nombre : 'sin color');

const caras = carasDesdeVertices(Object.values(VERT), CARAS_N.map((f) => esc(VERT[OPUESTO[f]], -1)));
const giros = {};
const T = (2 * Math.PI) / 3;
for (const v of VN) {
  giros[v] = { eje: VERT[v], ang: -T, umbral: 1 / 3 };
  giros[v + "'"] = { eje: VERT[v], ang: T, umbral: 1 / 3 };
  giros[v.toLowerCase()] = { eje: VERT[v], ang: -T, umbral: 5 / 3 };
  giros[v.toLowerCase() + "'"] = { eje: VERT[v], ang: T, umbral: 5 / 3 };
}
const geo = crearGeoPuzzle({
  caras,
  cortes: VN.flatMap((v) => [{ n: unit(VERT[v]), h: 5 / 3 }, { n: unit(VERT[v]), h: 1 / 3 }]),
  giros,
  rotaciones: [{ eje: VERT.U, ang: T }, { eje: VERT.L, ang: T }],
  red: { arboles: [{ raiz: 0, arriba: [0, 1, 0], hijos: [[1, 0], [2, 0], [3, 0]] }] },
  encoger: 0.86,
});
if (geo.n !== 36) throw new Error('Pyraminx: se esperaban 36 pegatinas y hay ' + geo.n);

// ---------- Piezas ----------
const capas = (c) => VN.filter((v) => dot(c, unit(VERT[v])) > 1 / 3 + 1e-9);
const esPunta = (c) => VN.find((v) => dot(c, unit(VERT[v])) > 5 / 3 + 1e-9);
const ordenar = (lista, orden) => orden.map((k) => lista.find((p) => p.clave === k).pegatinas);
const puntas = ordenar(geo.piezasPor((c) => { const v = esPunta(c); return v ? v : null; }), VN);
const centros = ordenar(geo.piezasPor((c) => (!esPunta(c) && capas(c).length === 1 ? capas(c)[0] : null)), VN);
const ARISTAS_N = ['UL', 'UR', 'UB', 'LR', 'LB', 'RB'];
const aristas = ordenar(geo.piezasPor((c) => (capas(c).length === 2 ? capas(c).join('') : null)), ARISTAS_N);

const MOVS = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"];
const EJES = [0, 0, 1, 1, 2, 2, 3, 3];
const PUNTAS_MOV = ['u', "u'", 'l', "l'", 'r', "r'", 'b', "b'"];
const MIN_LONGITUD = 6; // sin contar puntas, como TNoodle

const modelo = crearModeloPiezas({
  orbitas: [
    { nombre: 'puntas', piezas: puntas },
    { nombre: 'centros', piezas: centros },
    { nombre: 'aristas', piezas: aristas },
  ],
  movimientos: Object.fromEntries([...MOVS, ...PUNTAS_MOV].map((m) => [m, geo.perms[m]])),
  coloresResuelto: geo.resuelto,
});
const coloresPieza = modelo.orbitas.map((o) => o.piezas.map((pz) => pz.map((f) => geo.resuelto[f])));
// Permutaciones de color de las 12 rotaciones
const rep = CARAS_N.map((_, f) => geo.pegatinas.findIndex((p) => p.cara === f));
const sigmas = permutacionesDeColor(geo.rotaciones, geo.resuelto, rep);

let buscador = null;
function inicializar() {
  if (buscador) return { ms: buscador.msInit, yaEstaba: true };
  buscador = crearBuscador({
    coords: [modelo.coordOri(1), modelo.coordPerm(2), modelo.coordOri(2)],
    movs: MOVS,
    ejes: EJES,
    podas: [[0, 1, 2]], // tabla completa: búsqueda óptima inmediata
    objetivo: [0, 0, 0],
  });
  return { ms: buscador.msInit };
}

const NOMBRE_VERTICE = { U: 'de arriba (U)', L: 'izquierdo (L)', R: 'derecho (R)', B: 'de atrás (B)' };
const TIPO = ['punta', 'pieza central', 'arista'];
const POS = [VN.map((v) => 'vértice ' + NOMBRE_VERTICE[v]), VN.map((v) => 'vértice ' + NOMBRE_VERTICE[v]), ARISTAS_N.map((a) => a[0] + '-' + a[1])];
const lista = (cs) => cs.map(nombreColor).join('-');

function analizar(estado) {
  const errores = [];
  const cuenta = [0, 0, 0, 0];
  let vacias = 0;
  for (const c of estado) { if (c >= 0 && c < 4) cuenta[c]++; else vacias++; }
  if (vacias) errores.push(`Hay ${vacias} pegatina${vacias > 1 ? 's' : ''} sin pintar.`);
  cuenta.forEach((n, c) => { if (n !== 9) errores.push(`Hay ${n} pegatina${n === 1 ? '' : 's'} de color ${nombreColor(c)} y debería haber 9.`); });
  if (errores.length) return { valido: false, errores };

  const id0 = modelo.identificar(estado);
  for (const e of id0.errores) {
    const repe = new Set(e.colores).size < e.colores.length;
    errores.push(e.tipo === 'espejo'
      ? `La ${TIPO[e.oi]} del ${POS[e.oi][e.pos]} (${lista(e.colores)}) tiene los colores en un orden imposible: es la imagen especular de una pieza real.`
      : `La ${TIPO[e.oi]} en ${POS[e.oi][e.pos]} (${lista(e.colores)}) no existe en un Pyraminx real${repe ? ' (tiene un color repetido)' : ''}.`);
  }
  if (errores.length) return { valido: false, errores };
  // aristas repetidas o que faltan
  const vistas = new Array(6).fill(0);
  id0.orbitas[2].perm.forEach((x) => vistas[x]++);
  vistas.forEach((v, i) => {
    if (v > 1) errores.push(`La arista ${lista(coloresPieza[2][i])} aparece ${v} veces.`);
    if (v === 0) errores.push(`Falta la arista ${lista(coloresPieza[2][i])}.`);
  });
  if (errores.length) return { valido: false, errores };

  // Orientación: la rotación que deja las piezas centrales en su sitio
  const sigma = sigmas.find((s) => centros.every((pz, p) => {
    const cs = pz.map((f) => s[estado[f]]).sort().join(',');
    return cs === coloresPieza[1][p].slice().sort().join(',');
  }));
  if (!sigma) {
    return { valido: false, errores: ['Las cuatro piezas centrales (las que están justo debajo de las puntas) no forman una disposición posible: dos de ellas parecen intercambiadas. Revisa sus colores.'] };
  }
  const norm = reetiquetar(estado, sigma);
  const id = modelo.identificar(norm);
  id.orbitas[0].perm.forEach((x, p) => {
    if (x !== p) errores.push(`La punta del ${POS[0][p]} no corresponde a ese vértice: sus colores deben ser los mismos que los de la pieza central que tiene debajo.`);
  });
  if (errores.length) return { valido: false, errores };
  const A = id.orbitas[2];
  if (paridad(A.perm) !== 0) errores.push('Dos aristas están intercambiadas: en un Pyraminx la permutación de las aristas siempre es par.');
  if (A.ori.reduce((a, x) => a + x, 0) % 2 !== 0) errores.push('Una arista está volteada: el número de aristas volteadas siempre es par.');
  if (errores.length) return { valido: false, errores };
  return { valido: true, errores: [], norm, piezas: id.orbitas };
}

const coordsDe = (piezas) => [modelo.coordOri(1).codificar(piezas), modelo.coordPerm(2).codificar(piezas), modelo.coordOri(2).codificar(piezas)];

/** Movimientos de punta que dejan las puntas orientadas. */
function movsPuntas(piezas) {
  const res = [];
  VN.forEach((v, p) => {
    const o = piezas[0].ori[p];
    if (o === 0) return;
    const m = v.toLowerCase();
    const d = modelo.movPiezas[m][0].delta[p];
    res.push((o + d) % 3 === 0 ? m : m + "'");
  });
  return res;
}

function resolver(estado) {
  inicializar();
  const t0 = performance.now();
  const a = analizar(estado);
  if (!a.valido) return { ok: false, errores: a.errores };
  const r = buscador.resolver(coordsDe(a.piezas), 14);
  if (!r) return { ok: false, errores: ['No se encontró solución (esto no debería pasar).'] };
  let movs = r.movimientos;
  // tras los movimientos grandes, orientar las puntas
  let e = a.norm;
  for (const m of movs) e = geo.aplicar(e, m);
  movs = movs.concat(movsPuntas(modelo.identificar(e).orbitas));
  return { ok: true, movimientos: movs, ms: performance.now() - t0 };
}

function piezasAleatorias(rng) {
  let perm = barajar(rng, [0, 1, 2, 3, 4, 5]);
  if (paridad(perm)) [perm[0], perm[1]] = [perm[1], perm[0]];
  const oriA = new Array(6).fill(0);
  let s = 0;
  for (let i = 0; i < 5; i++) { oriA[i] = entero(rng, 2); s += oriA[i]; }
  oriA[5] = s % 2;
  return [
    { perm: [0, 1, 2, 3], ori: [0, 1, 2, 3].map(() => entero(rng, 3)) },
    { perm: [0, 1, 2, 3], ori: [0, 1, 2, 3].map(() => entero(rng, 3)) },
    { perm, ori: oriA },
  ];
}

function generarScramble(rng = rngSeguro()) {
  inicializar();
  for (;;) {
    const pz = piezasAleatorias(rng);
    const r = buscador.resolver(coordsDe(pz), 14);
    if (r.movimientos.length < MIN_LONGITUD) continue;
    const inv = r.movimientos.slice().reverse().map(invertirMovimiento);
    // puntas al final (conmutan con todo): las que dejan cada punta como en el estado aleatorio
    const puntasAl = [];
    VN.forEach((v, p) => {
      const o = pz[0].ori[p];
      if (o === 0) return;
      const m = v.toLowerCase();
      const d = modelo.movPiezas[m][0].delta[p];
      puntasAl.push(d === o ? m : m + "'");
    });
    return inv.concat(puntasAl);
  }
}

function invertirMovimiento(m) {
  return m.endsWith("'") ? m.slice(0, -1) : m + "'";
}

const pegatinas2D = geo.pegatinas2D;

export default definirPuzzle({
  id: 'pyraminx',
  nombre: 'Pyraminx',
  capacidades: { scramble: true, validar: true, resolver: true, editar: true },
  descripcion: 'Solución óptima en movimientos U, L, R, B, más las puntas al final.',
  tipoScramble: 'estado aleatorio',
  paleta: PALETA_PYRA,
  estadoResuelto: () => geo.resuelto.slice(),
  aplicarMovimiento(e, m) {
    if (!geo.perms[m]) throw new Error(`Movimiento no válido: "${m}"`);
    return geo.aplicar(e, m);
  },
  estaResuelto(e) {
    for (let f = 0; f < 4; f++) {
      const ids = geo.pegatinas.map((p, i) => (p.cara === f ? i : -1)).filter((i) => i >= 0);
      if (ids.some((i) => e[i] !== e[ids[0]])) return false;
    }
    return true;
  },
  invertirMovimiento,
  infoMovimiento(m) {
    const v = m[0];
    if (!'ULRBulrb'.includes(v)) throw new Error(`Movimiento no válido: "${m}"`);
    return { eje: v.toUpperCase(), clave: v === v.toUpperCase() ? 'capa' : 'punta' };
  },
  renderizar(estado, opciones = {}) {
    return svgDePegatinas(pegatinas2D, estado, PALETA_PYRA, opciones);
  },
  pegatinasEditables: () => geo.resuelto.map((_, i) => i),
  inicializar,
  estaInicializado: () => !!buscador,
  obtenerBuscador: () => { inicializar(); return buscador; },
  validar: (e) => { const a = analizar(e); return { valido: a.valido, errores: a.errores }; },
  resolver,
  generarScramble,
  geo,
  modelo,
});
