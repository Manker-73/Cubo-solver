// Skewb: modelo geométrico, validador, solucionador óptimo y scramble de estado aleatorio.
//
// Notación WCA (12h): se sujeta con U arriba y se ven las caras U, F, R.
//   R: vértice inferior derecho más lejano visible (DRB)
//   U: vértice superior (ULB)
//   L: vértice inferior izquierdo (DLF)
//   B: vértice trasero no visible (DLB)
// Cada uno gira 120° en sentido horario mirando ese vértice. La esquina URF
// nunca se mueve con estos cuatro giros.

import { definirPuzzle } from '../core/puzzle.js';
import { crearGeoPuzzle } from '../core/geopuzzle.js';
import { carasDesdeVertices } from '../core/geometria.js';
import { crearModeloPiezas, crearBuscador } from '../core/piezas.js';
import { permutacionesDeColor, reetiquetar } from '../core/simetria.js';
import { svgDePegatinas } from '../core/render.js';
import { entero, rngSeguro } from '../core/rng.js';
import { paridad, permDeIndice } from '../core/perm.js';
import { PALETA_CUBO } from './nxn.js';

const VERTICES = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) VERTICES.push([x, y, z]);
const NORMALES = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]]; // U R F D L B
const caras = carasDesdeVertices(VERTICES, NORMALES);
const ESQ = {
  URF: [1, 1, 1], ULB: [-1, 1, -1], DLF: [-1, -1, 1], DRB: [1, -1, -1],
  UFL: [-1, 1, 1], UBR: [1, 1, -1], DFR: [1, -1, 1], DBL: [-1, -1, -1],
};
const TETRADA_A = ['URF', 'ULB', 'DLF', 'DRB'];
const TETRADA_B = ['UFL', 'UBR', 'DFR', 'DBL'];
const EJE_MOV = { R: ESQ.DRB, U: ESQ.ULB, L: ESQ.DLF, B: ESQ.DBL };
const T = (2 * Math.PI) / 3;
const giros = {};
for (const [m, e] of Object.entries(EJE_MOV)) {
  giros[m] = { eje: e, ang: -T, umbral: 0 };
  giros[m + "'"] = { eje: e, ang: T, umbral: 0 };
}
const geo = crearGeoPuzzle({
  caras,
  cortes: [[1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1]].map((n) => ({ n: n.map((x) => x / Math.sqrt(3)), h: 0 })),
  giros,
  rotaciones: [{ eje: [1, 0, 0], ang: Math.PI / 2 }, { eje: [0, 1, 0], ang: Math.PI / 2 }],
  red: { arboles: [{ raiz: 2, arriba: [0, 1, 0], hijos: [[0, 2], [3, 2], [4, 2], [1, 2], [5, 1]] }] },
  encoger: 0.88,
});
if (geo.n !== 30) throw new Error('Skewb: se esperaban 30 pegatinas y hay ' + geo.n);

// ---------- Piezas ----------
const signo = (x) => (x > 1e-6 ? 1 : x < -1e-6 ? -1 : 0);
const claveEsquina = (c) => {
  const s = c.map(signo);
  if (s.includes(0)) return null;
  return Object.keys(ESQ).find((k) => ESQ[k].every((v, i) => v === s[i]));
};
const CARAS_N = ['U', 'R', 'F', 'D', 'L', 'B'];
const piezasEsq = geo.piezasPor(claveEsquina);
const piezasCen = geo.piezasPor((c, i) => (c.map(signo).filter((x) => x !== 0).length === 1 ? CARAS_N[geo.pegatinas[i].cara] : null));
const ordenar = (lista, orden) => orden.map((k) => lista.find((p) => p.clave === k).pegatinas);
const centros = ordenar(piezasCen, CARAS_N);
const esqA = ordenar(piezasEsq, TETRADA_A);
const esqB = ordenar(piezasEsq, TETRADA_B);

const MOVS = ['R', "R'", 'U', "U'", 'L', "L'", 'B', "B'"];
const EJES = [0, 0, 1, 1, 2, 2, 3, 3];
const MIN_LONGITUD = 7; // como TNoodle

const modelo = crearModeloPiezas({
  orbitas: [
    { nombre: 'centros', piezas: centros },
    { nombre: 'esquinasA', piezas: esqA },
    { nombre: 'esquinasB', piezas: esqB },
  ],
  movimientos: Object.fromEntries(MOVS.map((m) => [m, geo.perms[m]])),
  coloresResuelto: geo.resuelto,
});
const coloresPieza = modelo.orbitas.map((o) => o.piezas.map((pz) => pz.map((f) => geo.resuelto[f])));
const rep = CARAS_N.map((_, f) => centros[f][0]);
const sigmas = permutacionesDeColor(geo.rotaciones, geo.resuelto, rep);

const COORDS = [modelo.coordPerm(0), modelo.coordPerm(1), modelo.coordOri(1), modelo.coordPerm(2), modelo.coordOri(2)];
const coordsDe = (pz) => COORDS.map((c) => c.codificar(pz));
let buscador = null;
let esquinasAlcanzables = null; // índices de la tabla de esquinas alcanzables (para estados aleatorios)
function inicializar() {
  if (buscador) return { ms: buscador.msInit, yaEstaba: true };
  buscador = crearBuscador({
    coords: COORDS,
    movs: MOVS,
    ejes: EJES,
    podas: [[0, 2], [0, 4], [1, 2, 3, 4]],
    objetivo: [0, 0, 0, 0, 0],
  });
  const tp = buscador.tablasPoda[2];
  esquinasAlcanzables = [];
  for (let i = 0; i < tp.prof.length; i++) if (tp.prof[i] >= 0) esquinasAlcanzables.push(i);
  return { ms: buscador.msInit };
}

const nombreColor = (c) => (PALETA_CUBO[c] ? PALETA_CUBO[c].nombre : 'sin color');
const lista = (cs) => cs.map(nombreColor).join('-');
const NOMBRES_ESQ = [TETRADA_A, TETRADA_B];

function analizar(estado) {
  inicializar();
  const errores = [];
  const cuenta = new Array(6).fill(0);
  let vacias = 0;
  for (const c of estado) { if (c >= 0 && c < 6) cuenta[c]++; else vacias++; }
  if (vacias) errores.push(`Hay ${vacias} pegatina${vacias > 1 ? 's' : ''} sin pintar.`);
  cuenta.forEach((n, c) => { if (n !== 5) errores.push(`Hay ${n} pegatina${n === 1 ? '' : 's'} de color ${nombreColor(c)} y debería haber 5.`); });
  if (errores.length) return { valido: false, errores };

  // Las esquinas pueden estar en cualquier tétrada antes de reorientar: se
  // identifican contra las 8 esquinas.
  const todas = [...esqA, ...esqB];
  const colTodas = [...coloresPieza[1], ...coloresPieza[2]];
  const usadas = new Array(8).fill(0);
  todas.forEach((pz, p) => {
    const c = pz.map((f) => estado[f]);
    let id = -1;
    colTodas.forEach((s, i) => { for (let r = 0; r < 3; r++) if (s.every((x, j) => x === c[(j + r) % 3])) id = i; });
    const nom = (p < 4 ? TETRADA_A : TETRADA_B)[p % 4];
    if (id < 0) {
      const espejo = colTodas.some((s) => s.slice().sort().join() === c.slice().sort().join());
      const repe = new Set(c).size < 3;
      const opuestos = c.some((a) => c.some((b) => (a + 3) % 6 === b));
      errores.push(espejo
        ? `La esquina en ${nom} (${lista(c)}) tiene los colores en un orden imposible: es la imagen especular de una pieza real.`
        : `La esquina en ${nom} (${lista(c)}) no existe en un Skewb real${repe ? ' (tiene un color repetido)' : opuestos ? ' (tiene dos colores de caras opuestas)' : ''}.`);
    } else usadas[id]++;
  });
  if (errores.length) return { valido: false, errores };
  usadas.forEach((v, i) => {
    if (v > 1) errores.push(`La esquina ${lista(colTodas[i])} aparece ${v} veces.`);
    if (v === 0) errores.push(`Falta la esquina ${lista(colTodas[i])}.`);
  });
  if (errores.length) return { valido: false, errores };

  // Reorientar: la esquina que está en URF se toma como fija
  const sigma = sigmas.find((s) => esqA[0].every((f, j) => s[estado[f]] === coloresPieza[1][0][j]));
  if (!sigma) return { valido: false, errores: ['No se pudo determinar la orientación del Skewb.'] };
  const norm = reetiquetar(estado, sigma);
  const id = modelo.identificar(norm);
  if (id.errores.length) {
    // una esquina de una tétrada está en la otra: imposible
    return { valido: false, errores: ['Dos esquinas están intercambiadas de una forma imposible: en el Skewb las esquinas nunca cambian de "grupo" (las de vértices alternos).'] };
  }
  const [C, A, B] = id.orbitas;
  if (paridad(C.perm) !== 0) errores.push('Dos centros están intercambiados: en el Skewb la permutación de los centros siempre es par.');
  const v = coordsDe(id.orbitas);
  const tp = buscador.tablasPoda[2];
  if (tp.prof[tp.idxDe([v[1], v[2], v[3], v[4]])] < 0) {
    if (paridad(A.perm.slice(1).map((x) => x - 1)) !== 0 || paridad(B.perm) !== 0) {
      errores.push('Dos esquinas están intercambiadas: esa permutación de esquinas no es posible.');
    } else {
      errores.push('Una esquina está girada: la orientación de las esquinas no es posible.');
    }
  }
  if (errores.length) return { valido: false, errores };
  return { valido: true, errores: [], piezas: id.orbitas };
}

function resolver(estado) {
  const t0 = performance.now();
  const a = analizar(estado);
  if (!a.valido) return { ok: false, errores: a.errores };
  const r = buscador.resolver(coordsDe(a.piezas), 14);
  if (!r) return { ok: false, errores: ['No se encontró solución (esto no debería pasar).'] };
  return { ok: true, movimientos: r.movimientos, ms: performance.now() - t0 };
}

/** Estado aleatorio uniforme: centros con permutación par y una configuración de esquinas alcanzable al azar. */
function coordsAleatorias(rng) {
  let pc;
  do { pc = entero(rng, 720); } while (paridad(permDeIndice(pc, 6)) !== 0);
  let idx = esquinasAlcanzables[entero(rng, esquinasAlcanzables.length)];
  const tams = [24, 81, 24, 81];
  const v = [];
  for (let k = 3; k >= 0; k--) { v[k] = idx % tams[k]; idx = Math.floor(idx / tams[k]); }
  return [pc, ...v];
}

function invertirMovimiento(m) {
  return m.endsWith("'") ? m.slice(0, -1) : m + "'";
}

function generarScramble(rng = rngSeguro()) {
  inicializar();
  for (;;) {
    const r = buscador.resolver(coordsAleatorias(rng), 14);
    if (r.movimientos.length < MIN_LONGITUD) continue;
    return r.movimientos.slice().reverse().map(invertirMovimiento);
  }
}

const caraDe = geo.pegatinas.map((p) => p.cara);

export default definirPuzzle({
  id: 'skewb',
  nombre: 'Skewb',
  capacidades: { scramble: true, validar: true, resolver: true, editar: true },
  descripcion: 'Solución óptima en notación WCA (R, U, L, B); la esquina URF queda fija.',
  tipoScramble: 'estado aleatorio',
  paleta: PALETA_CUBO,
  estadoResuelto: () => geo.resuelto.slice(),
  aplicarMovimiento(e, m) {
    if (!geo.perms[m]) throw new Error(`Movimiento no válido: "${m}"`);
    return geo.aplicar(e, m);
  },
  estaResuelto(e) {
    const color = new Array(6).fill(-1);
    for (let i = 0; i < e.length; i++) {
      const f = caraDe[i];
      if (color[f] < 0) color[f] = e[i];
      else if (color[f] !== e[i]) return false;
    }
    return true;
  },
  invertirMovimiento,
  infoMovimiento(m) {
    if (!/^[RULB]'?$/.test(m)) throw new Error(`Movimiento no válido: "${m}"`);
    return { eje: m[0], clave: m[0] };
  },
  renderizar(estado, opciones = {}) {
    return svgDePegatinas(geo.pegatinas2D, estado, PALETA_CUBO, opciones);
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
  coordsDe,
  coordsAleatorias,
});
