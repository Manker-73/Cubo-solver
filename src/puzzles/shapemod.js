// Shape mods del 3x3 (noche 16): crearShapeMod({ id, nombre, cortes }) da un puzzle completo de la
// interfaz común. Añadir otro shape mod (Fisher, Windmill, Axis…) = una definición de cortes en el
// registro (src/puzzles/index.js).
//
//  - Geometría: shapemod-geo.js (cada pieza = celda del mecanismo ∩ cuerpo; se calcula una vez).
//  - Estado POR PIEZAS: el de kociemba.js ({ cp, co, ep, eo }) + ct (orientación de los centros que
//    se ve; 0 en los que no, porque su forma es simétrica) y, con capas desfasadas (Ghost Cube),
//    `cubo` (true = capas de arriba y abajo giradas a la forma de cubo; false = alineadas). El 3x3
//    de WCA sigue con su estado de pegatinas: aquí no se toca.
//  - Notación: la del 3x3 (U R F D L B con ' y 2). Con capas desfasadas, además «A» (alinear: girar las
//    capas de arriba y de abajo hasta que se pueda girar cualquier cara) y «A'» (volver a la forma de
//    cubo). Con la forma de cubo solo se pueden girar U y D (el eje en el que está «a mitad de giro»).
//  - «Resuelto» = se ve como el cubo resuelto (y, con capas desfasadas, en la forma de cubo): las
//    orientaciones de los centros que no se ven no cuentan.
//  - Entrada del usuario («Colocar piezas»): un array de MARCAS (identidad de cada pegatina del 3x3
//    y de las marcas de orientación de los centros que se ven), con el puzzle sujetado de cualquier
//    forma; se normaliza por los centros (todos distintos) y se convierte al estado por piezas.
//  - Solver: Kociemba (kociemba.js, sin cambios) para las piezas y, si hay centros que se ven, una
//    fase de centros con algoritmos puros (no mueven ninguna otra pieza) encontrados por búsqueda y
//    comprobados al inicializar (shapemod-centros.js). Ver DECISIONES.md («Noche 16»).

import { definirPuzzle } from '../core/puzzle.js';
import { rngSeguro, entero } from '../core/rng.js';
import {
  MOV_CUBO, NOMBRES_MOV, multiplicar, cuboResuelto, inversaCubo, resolverKociemba, inicializarKociemba,
  kociembaListo, msTablasKociemba, paridad8,
} from './kociemba.js';
import {
  crearGeoShapeMod, CARAS, DIR, CARAS_HUECO, NOMBRE_HUECO, TIPO_HUECO, matRot, mv, mm, ID3, transformar, volumen,
} from './shapemod-geo.js';
import { crearTablaCentros } from './shapemod-centros.js';

const OPUESTA = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const EJE_CARA = { U: 'UD', D: 'UD', R: 'RL', L: 'RL', F: 'FB', B: 'FB' };
const iguales = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 && Math.abs(a[2] - b[2]) < 1e-9;
const caraDeDir = (d) => CARAS.find((f) => iguales(DIR[f], d));
const barajar = (rng, a) => { for (let i = a.length - 1; i > 0; i--) { const j = entero(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** 24 rotaciones del cubo (matrices enteras), la identidad primero */
function rotacionesCubo() {
  const gens = [matRot([1, 0, 0], -Math.PI / 2), matRot([0, 1, 0], -Math.PI / 2)];
  const r = [ID3];
  const clave = (M) => M.flat().join(',');
  const vistos = new Set([clave(ID3)]);
  for (let i = 0; i < r.length; i++) for (const g of gens) {
    const M = mm(g, r[i]);
    if (!vistos.has(clave(M))) { vistos.add(clave(M)); r.push(M); }
  }
  return r;
}
const ROTACIONES = rotacionesCubo();

/**
 * @param {{ id: string, nombre: string, descripcion?: string, material?: { nombre: string, hex: string },
 *   cortes: Parameters<typeof crearGeoShapeMod>[0], fuente?: string, costeScramble?: number }} def
 */
export function crearShapeMod(def) {
  const G = crearGeoShapeMod(def.cortes);
  const desfasado = !!def.cortes.desfase;
  const periodos = G.periodos; // por cara: 1 (no se ve), 2 o 4
  const conCentros = periodos.some((p) => p > 1);
  // restricción de los centros que se ven: si todos tienen periodo par, Σ giros ≡ paridad de las esquinas (mod 2)
  const restriccionCentros = periodos.every((p) => p % 2 === 0);
  const material = def.material || { nombre: 'plateado', hex: '#c9ced6' };

  // ---------- estado por piezas ----------
  const resueltoPiezas = () => ({ ...cuboResuelto(), ct: [0, 0, 0, 0, 0, 0], ...(desfasado ? { cubo: true } : {}) });

  /** @param {string} m */
  function leerMov(m) {
    if (desfasado && (m === 'A' || m === "A'")) return { especial: m };
    const i = NOMBRES_MOV.indexOf(m);
    if (i < 0) return null;
    return { i, cara: CARAS[(i / 3) | 0], q: (i % 3) + 1 };
  }

  function aplicarPiezas(e, m) {
    const d = leerMov(m);
    if (!d) throw new Error(`Movimiento no válido: "${m}"`);
    if (d.especial) {
      const quiere = d.especial === 'A';
      if (quiere !== !!e.cubo) throw new Error(quiere ? 'Las capas ya están alineadas («A» alinea las capas desde la forma de cubo).' : "Las capas no están alineadas: «A'» vuelve a la forma de cubo desde las capas alineadas.");
      return { ...e, cubo: !quiere };
    }
    if (desfasado && e.cubo && d.cara !== 'U' && d.cara !== 'D') {
      throw new Error(`Con la forma de cubo solo giran U y D: para girar ${d.cara} primero alinea las capas («A»).`);
    }
    const c = multiplicar(e, MOV_CUBO[d.i]);
    const f = CARAS.indexOf(d.cara);
    const ct = e.ct.slice();
    ct[f] = (ct[f] + d.q) % periodos[f];
    return { ...c, ct, ...(desfasado ? { cubo: !!e.cubo } : {}) };
  }

  // ---------- marcas (entrada del usuario y «Colocar piezas») ----------
  // posiciones: 0–23 pegatinas de las esquinas, 24–47 de las aristas, 48–53 centros, luego las marcas de
  // orientación de los centros que se ven (periodo p: p marcas) y, con capas desfasadas, una posición
  // final con la forma (1 = forma de cubo, 0 / −1 = alineadas).
  const offHueco = CARAS_HUECO.map((_, s) => (s < 8 ? 3 * s : s < 20 ? 24 + 2 * (s - 8) : 48 + (s - 20)));
  const REF = { U: [0, 0, 1], D: [0, 0, 1], R: [0, 1, 0], L: [0, 1, 0], F: [0, 1, 0], B: [0, 1, 0] };
  const offMarca = [];
  let nMarcas = 54;
  CARAS.forEach((f, i) => { offMarca[i] = periodos[i] > 1 ? nMarcas : -1; if (periodos[i] > 1) nMarcas += periodos[i]; });
  const POS_FORMA = desfasado ? nMarcas : -1;
  const N_POS = nMarcas + (desfasado ? 1 : 0);
  /** vector de la marca k del centro de la cara f */
  const vecMarca = (fi, k) => mv(matRot(DIR[CARAS[fi]], (-Math.PI / 2) * k), REF[CARAS[fi]]);
  /** marca k' del centro fi cuyo vector es v (con periodo 2, v y −v son la misma) */
  function marcaDe(fi, v) {
    for (let k = 0; k < periodos[fi]; k++) {
      const m = vecMarca(fi, k);
      if (iguales(m, v) || (periodos[fi] === 2 && iguales(m, v.map((x) => -x)))) return k;
    }
    throw new Error('marca de centro imposible');
  }
  const huecoDePos = (s3) => G.posHueco.findIndex((p) => iguales(p, s3));

  /** permutación de posiciones de un movimiento rígido R de los huecos `huecos`: destino[i] */
  function permRigida(R, huecos) {
    const destino = Array.from({ length: N_POS }, (_, i) => i);
    for (const s of huecos) {
      const s2 = huecoDePos(mv(R, G.posHueco[s]));
      CARAS_HUECO[s].forEach((f, j) => {
        const d2 = mv(R, DIR[f]);
        const j2 = CARAS_HUECO[s2].findIndex((g) => iguales(DIR[g], d2));
        destino[offHueco[s] + j] = offHueco[s2] + j2;
      });
      if (s >= 20 && periodos[s - 20] > 1) {
        const fi = s - 20, fi2 = s2 - 20;
        for (let k = 0; k < periodos[fi]; k++) destino[offMarca[fi] + k] = offMarca[fi2] + marcaDe(fi2, mv(R, vecMarca(fi, k)));
      }
    }
    return destino;
  }
  const capaDe = (f) => G.posHueco.map((p, s) => (p[0] * DIR[f][0] + p[1] * DIR[f][1] + p[2] * DIR[f][2] > 0 ? s : -1)).filter((s) => s >= 0);
  const TODOS = G.posHueco.map((_, s) => s);
  /** permutaciones de los movimientos sobre las marcas: giros de cara y rotaciones x, y, z */
  const PERM_MARCAS = new Map();
  for (const f of CARAS) for (const q of [1, 2, 3]) PERM_MARCAS.set(f + ['', '2', "'"][q - 1], permRigida(matRot(DIR[f], (-Math.PI / 2) * q), capaDe(f)));
  for (const [r, f] of [['x', 'R'], ['y', 'U'], ['z', 'F']]) for (const q of [1, 2, 3]) PERM_MARCAS.set(r + ['', '2', "'"][q - 1], permRigida(matRot(DIR[f], (-Math.PI / 2) * q), TODOS));
  const PERM_ROT = ROTACIONES.map((R) => permRigida(R, TODOS));

  /** aplica una permutación (destino) a un array de marcas */
  function permutar(arr, destino) {
    const r = arr.slice();
    for (let i = 0; i < destino.length; i++) r[destino[i]] = arr[i];
    return r;
  }

  /** estado por piezas -> marcas (en el marco de referencia) */
  function aMarcas(e) {
    const arr = new Array(N_POS).fill(-1);
    G.colocacion(e).forEach(({ pieza: k, R }, s) => {
      CARAS_HUECO[k].forEach((f, j) => {
        const d2 = mv(R, DIR[f]);
        const j2 = CARAS_HUECO[s].findIndex((g) => iguales(DIR[g], d2));
        arr[offHueco[s] + j2] = offHueco[k] + j;
      });
      if (s >= 20 && periodos[s - 20] > 1) {
        const fi = s - 20;
        for (let k2 = 0; k2 < periodos[fi]; k2++) arr[offMarca[fi] + marcaDe(fi, mv(R, vecMarca(fi, k2)))] = offMarca[fi] + k2;
      }
    });
    if (desfasado) arr[POS_FORMA] = e.cubo ? 1 : 0;
    return arr;
  }

  // pieza (hueco de casa) y pegatina de cada posición de pegatina
  const piezaDePos = [], pegDePos = [];
  CARAS_HUECO.forEach((cs, s) => cs.forEach((_, j) => { piezaDePos[offHueco[s] + j] = s; pegDePos[offHueco[s] + j] = j; }));
  // (las marcas de orientación son del centro de su cara; no son una pegatina)
  CARAS.forEach((_, fi) => { for (let k = 0; k < periodos[fi]; k++) if (offMarca[fi] >= 0) { piezaDePos[offMarca[fi] + k] = 20 + fi; pegDePos[offMarca[fi] + k] = -1; } });
  const nombrePieza = (k) => `${TIPO_HUECO[k] === 'centro' ? 'el centro' : TIPO_HUECO[k] === 'arista' ? 'la arista' : 'la esquina'} ${NOMBRE_HUECO[k]}`;

  /**
   * Marcas (con el puzzle sujetado de cualquier forma) -> { estado, Q } o { errores }.
   * Q = índice de la rotación del usuario respecto a la referencia.
   */
  function desdeMarcas(arr) {
    if (!Array.isArray(arr) || arr.length !== N_POS) return { errores: [`El estado debe tener ${N_POS} posiciones.`] };
    const errores = [];
    // huecos vacíos y piezas repetidas
    const vacios = [];
    const vista = new Map();
    for (let s = 0; s < 26; s++) {
      const vals = CARAS_HUECO[s].map((_, j) => arr[offHueco[s] + j]);
      if (vals.some((v) => v == null || v < 0)) { vacios.push(s); continue; }
      const k = piezaDePos[vals[0]];
      if (k === undefined || vals.some((v) => piezaDePos[v] !== k) || TIPO_HUECO[k] !== TIPO_HUECO[s] || new Set(vals).size !== vals.length) {
        errores.push(`En el hueco ${NOMBRE_HUECO[s]} hay una pieza que no existe o no cabe ahí.`);
        continue;
      }
      if (vista.has(k)) errores.push(`${nombrePieza(k)[0].toUpperCase()}${nombrePieza(k).slice(1)} está dos veces (en ${NOMBRE_HUECO[vista.get(k)]} y en ${NOMBRE_HUECO[s]}).`);
      else vista.set(k, s);
    }
    if (vacios.length) errores.unshift(`Faltan ${vacios.length} pieza${vacios.length === 1 ? '' : 's'} por colocar (${vacios.map((s) => NOMBRE_HUECO[s]).join(', ')}).`);
    if (errores.length) return { errores };
    // rotación del usuario: la que lleva cada centro a su hueco
    const Q = ROTACIONES.findIndex((R) => CARAS.every((f, i) => {
      const g = caraDeDir(mv(R, DIR[f]));
      return arr[offHueco[20 + CARAS.indexOf(g)]] === 48 + i;
    }));
    if (Q < 0) return { errores: ['Los centros no están en una disposición posible: en un 3x3 los centros no se mueven entre sí (cada uno tiene que quedar frente a su opuesto y en el orden de siempre).'] };
    // vuelta a la referencia: aplicar la rotación inversa
    const inv = ROTACIONES.findIndex((R) => iguales(mv(mm(R, ROTACIONES[Q]), [1, 2, 3]), [1, 2, 3]));
    const a = permutar(arr, PERM_ROT[inv]);
    const e = { cp: [], co: [], ep: [], eo: [], ct: [0, 0, 0, 0, 0, 0] };
    for (let i = 0; i < 8; i++) {
      const vals = [0, 1, 2].map((j) => a[offHueco[i] + j]);
      e.cp[i] = piezaDePos[vals[0]];
      e.co[i] = vals.findIndex((v) => pegDePos[v] === 0);
    }
    for (let i = 0; i < 12; i++) {
      const vals = [0, 1].map((j) => a[offHueco[8 + i] + j]);
      e.ep[i] = piezaDePos[vals[0]] - 8;
      e.eo[i] = vals.findIndex((v) => pegDePos[v] === 0);
    }
    for (let fi = 0; fi < 6; fi++) {
      if (periodos[fi] < 2) continue;
      const v = a[offMarca[fi]];
      const k = v - offMarca[fi];
      if (!(k >= 0 && k < periodos[fi])) return { errores: [`Falta la orientación del centro ${CARAS[fi]}.`] };
      e.ct[fi] = (periodos[fi] - k) % periodos[fi];
    }
    if (desfasado) e.cubo = a[POS_FORMA] === 1;
    return { estado: e, Q };
  }

  // ---------- validación ----------
  function comprobarPiezas(e) {
    const errores = [];
    const ok = (p, n) => Array.isArray(p) && p.length === n && new Set(p).size === n && p.every((x) => Number.isInteger(x) && x >= 0 && x < n);
    if (!e || !ok(e.cp, 8) || !ok(e.ep, 12) || !Array.isArray(e.co) || !Array.isArray(e.eo) || !Array.isArray(e.ct) || e.ct.length !== 6) return ['Estado mal formado.'];
    const giro = e.co.reduce((a, x) => a + x, 0) % 3;
    if (giro) {
      const sosp = e.co.findIndex((x) => x !== 0);
      errores.push(`Hay una esquina girada: la suma de los giros de las esquinas no es múltiplo de 3 (sobra ${giro === 1 ? 'un tercio de vuelta horario' : 'un tercio de vuelta antihorario'}; mira ${nombrePieza(e.cp[sosp])}, en ${NOMBRE_HUECO[sosp]}).`);
    }
    if (e.eo.reduce((a, x) => a + x, 0) % 2) errores.push('Hay una arista volteada: el número de aristas volteadas es impar.');
    const pc = paridad8(e.cp), pa = paridad8(e.ep);
    if (pc !== pa) errores.push('Hay dos piezas intercambiadas: la paridad de la permutación de las esquinas no coincide con la de las aristas.');
    else if (restriccionCentros) {
      const s = e.ct.reduce((a, x) => a + x, 0) % 2;
      if (s !== pc) errores.push(`Hay un centro girado un cuarto de vuelta de más: la suma de los giros de los centros es ${s ? 'impar' : 'par'} y en el ${def.nombre} siempre tiene la paridad de la permutación de las esquinas (${pc ? 'impar' : 'par'}).`);
    }
    return errores;
  }

  /** estado (por piezas o marcas) -> { estado (referencia), Q } o { errores } */
  function normalizar(entrada) {
    if (Array.isArray(entrada)) {
      const r = desdeMarcas(entrada);
      if (r.errores) return r;
      const err = comprobarPiezas(r.estado);
      return err.length ? { errores: err } : r;
    }
    const err = comprobarPiezas(entrada);
    if (err.length) return { errores: err };
    const e = { cp: entrada.cp.slice(), co: entrada.co.slice(), ep: entrada.ep.slice(), eo: entrada.eo.slice(), ct: entrada.ct.map((x, i) => ((x % periodos[i]) + periodos[i]) % periodos[i]) };
    if (desfasado) e.cubo = !!entrada.cubo;
    return { estado: e, Q: 0 };
  }

  const piezasResueltas = (e) => e.cp.every((x, i) => x === i) && e.ep.every((x, i) => x === i) && e.co.every((x) => x === 0) && e.eo.every((x) => x === 0);
  function estaResuelto(entrada) {
    const r = normalizar(entrada);
    if (r.errores) return false;
    const e = r.estado;
    return piezasResueltas(e) && e.ct.every((x) => x === 0) && (!desfasado || e.cubo);
  }

  // ---------- solver ----------
  let centros = null;
  const obtenerCentros = () => (centros ||= crearTablaCentros(periodos));

  /** Presupuesto de la fase 1 cuando hay centros que se ven (ver DECISIONES.md: longitud frente a tiempo). */
  const NODOS_CENTROS = globalThis.NODOS_SHAPEMOD ?? 150_000;
  /** junta giros de la misma cara (también con la opuesta en medio) */
  function simplificar(movs) {
    const r = [];
    const q = (m) => ({ cara: m[0], n: m.length === 1 ? 1 : m[1] === '2' ? 2 : 3 });
    const nom = (cara, n) => cara + ['', '', '2', "'"][n];
    for (const m of movs) {
      if (m === 'A' || m === "A'") { r.push(m); continue; }
      const a = q(m);
      let j = r.length - 1;
      if (j >= 0 && r[j][0] === OPUESTA[a.cara] && r[j][0] !== 'A') j--;
      if (j >= 0 && r[j][0] === a.cara) {
        const n = (q(r[j]).n + a.n) % 4;
        if (n) r[j] = nom(a.cara, n); else r.splice(j, 1);
      } else r.push(m);
    }
    return r;
  }

  /** Solución (en el marco de referencia) de un estado normalizado. */
  function resolverPiezas(e, { msMax = 1000, nodosMax = Infinity, objetivo = 20, nodosCentros = NODOS_CENTROS } = {}) {
    inicializarKociemba();
    const pre = desfasado && e.cubo ? ['A'] : [];
    let base = { cp: e.cp, co: e.co, ep: e.ep, eo: e.eo };
    let movs = [];
    /** giro que falta en cada centro (cuartos de vuelta) tras unos giros de cara (índices de NOMBRES_MOV) */
    const faltaTras = (idx) => {
      const ct = e.ct.slice();
      for (const i of idx) { const f = (i / 3) | 0; ct[f] = (ct[f] + (i % 3) + 1) % periodos[f]; }
      return ct.map((x, f) => (periodos[f] - x) % periodos[f]);
    };
    const C = conCentros ? obtenerCentros() : null;
    if (!piezasResueltas(base) || (C && faltaTras([]).some((x) => x % 2))) {
      const c = { cp: base.cp.slice(), co: base.co.slice(), ep: base.ep.slice(), eo: base.eo.slice() };
      // con centros que se ven: solo soluciones que dejen cada centro a un número par de cuartos de vuelta
      // (lo que falte son medias vueltas: fase de centros) y más cortas, contando esa fase, que la mejor
      let mejorTotal = Infinity;
      const aceptar = C ? (sol) => {
        const falta = faltaTras(sol);
        if (falta.some((x) => x % 2)) return false;
        const total = sol.length + C.coste(falta);
        if (total >= mejorTotal) return false;
        mejorTotal = total;
        return true;
      } : undefined;
      // piezas resueltas pero algún centro a un cuarto de vuelta: Kociemba no buscaría nada; se parte de un giro
      const pre2 = piezasResueltas(base) ? ['U'] : [];
      const c2 = pre2.length ? multiplicar(c, MOV_CUBO[0]) : c;
      if (pre2.length) e = { ...e, ct: e.ct.map((x, f) => (f === 0 ? (x + 1) % periodos[0] : x)) };
      // la fase 2 de Kociemba solo gira R, F, L y B media vuelta: su paridad de cuartos ya se sabe tras la fase 1
      // (la de la variante invertida es la misma: invertir y dar la vuelta a una secuencia no la cambia)
      const LADOS = [1, 2, 4, 5].filter((f) => periodos[f] > 1);
      const filtroFase1 = C && LADOS.length ? (cam, n1) => {
        const q = [0, 0, 0, 0, 0, 0];
        for (let i = 0; i < n1; i++) q[(cam[i] / 3) | 0] += (cam[i] % 3) + 1;
        return LADOS.every((f) => (e.ct[f] + q[f]) % 2 === 0);
      } : undefined;
      // con centros: sin parar en la primera solución corta; el presupuesto (en nodos: igual en cualquier máquina)
      // se gasta buscando el menor total piezas + centros
      const r = resolverKociemba([{ cubo: c2 }, { cubo: inversaCubo(c2), inversa: true }], {
        objetivo: C ? -1 : objetivo, msMax, nodosMax: C ? Math.min(nodosMax, nodosCentros) : nodosMax, aceptar, filtroFase1,
      });
      if (!r) return null;
      movs = simplificar([...pre2, ...r.movimientos]);
      if (pre2.length) e = { ...e, ct: e.ct.map((x, f) => (f === 0 ? (x + periodos[0] - 1) % periodos[0] : x)) };
    }
    if (C) {
      // giro que falta en cada centro tras las piezas; la fase de centros lo deja a 0
      const falta = faltaTras(movs.map((m) => NOMBRES_MOV.indexOf(m)));
      if (falta.some((x) => x)) {
        const S = C.secuencia(falta);
        // S no mueve ninguna otra pieza: se puede meter en cualquier punto; se elige el que más acorta
        let mejor = null;
        for (let i = 0; i <= movs.length; i++) {
          const s = simplificar([...movs.slice(0, i), ...S, ...movs.slice(i)]);
          if (!mejor || s.length < mejor.length) mejor = s;
        }
        movs = /** @type {string[]} */ (mejor);
      }
    }
    return [...pre, ...movs, ...(desfasado ? ["A'"] : [])];
  }

  /** Traduce movimientos del marco de referencia al del usuario (rotación Q). */
  function traducir(movs, Q) {
    if (!Q) return movs;
    const R = ROTACIONES[Q];
    return movs.map((m) => (m[0] === 'A' ? m : caraDeDir(mv(R, DIR[m[0]])) + m.slice(1)));
  }

  function resolver(entrada, opciones = {}) {
    const t0 = performance.now();
    const n = normalizar(entrada);
    if (n.errores) return { ok: false, errores: n.errores };
    const movs = resolverPiezas(n.estado, { msMax: opciones.msMax ?? 1000, objetivo: opciones.objetivo ?? 20 });
    if (!movs) return { ok: false, errores: ['No se encontró solución (esto no debería pasar).'] };
    return { ok: true, movimientos: traducir(movs, n.Q), ms: performance.now() - t0 };
  }

  /** Estado al azar uniforme (entre los distinguibles): 3x3 al azar + centros que se ven al azar. */
  function estadoAleatorio(rng) {
    const cp = barajar(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
    const ep = barajar(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    if (paridad8(cp) !== paridad8(ep)) [ep[0], ep[1]] = [ep[1], ep[0]];
    const co = [], eo = [];
    let s = 0;
    for (let i = 0; i < 7; i++) { co[i] = entero(rng, 3); s += co[i]; }
    co[7] = (3 - (s % 3)) % 3;
    s = 0;
    for (let i = 0; i < 11; i++) { eo[i] = entero(rng, 2); s += eo[i]; }
    eo[11] = s % 2;
    const ct = periodos.map((p) => entero(rng, p));
    if (restriccionCentros && ct.reduce((a, x) => a + x, 0) % 2 !== paridad8(cp)) {
      const f = periodos.findIndex((p) => p > 1);
      ct[f] = (ct[f] + 1) % periodos[f];
    }
    return { cp, co, ep, eo, ct, ...(desfasado ? { cubo: true } : {}) };
  }

  /** Nodos de la fase 1 para el scramble (determinista en cualquier máquina; como el 3x3). */
  const NODOS_SCRAMBLE = 500_000;
  function scrambleDetallado(rng) {
    for (;;) {
      const e = estadoAleatorio(rng);
      if (estaResuelto(e)) continue;
      const movs = resolverPiezas(e, { msMax: Infinity, nodosMax: NODOS_SCRAMBLE, objetivo: 21 });
      if (!movs) continue;
      return { movimientos: movs.slice().reverse().map(invertirMovimiento), estado: e };
    }
  }

  function invertirMovimiento(m) {
    if (m === 'A') return "A'";
    if (m === "A'") return 'A';
    const d = leerMov(m);
    if (!d) throw new Error(`Movimiento no válido: "${m}"`);
    return d.cara + ['', "'", '2', ''][d.q];
  }

  // ---------- 3D y 2D ----------
  /** caras de las piezas colocadas: [{ puntos, normal, pieza, hueco }] */
  function carasColocadas(colocaciones, cubo) {
    const r = [];
    colocaciones.forEach((c, s) => {
      if (!c) return;
      let M = c.R;
      if (desfasado && cubo) M = mm(matRot([0, 1, 0], G.angCapa(G.filaY(s))), M);
      const P = transformar(G.formas[c.pieza], M);
      P.caras.forEach((f) => r.push({ puntos: f.pts, normal: f.n, pieza: c.pieza, hueco: s, exterior: f.tipo === 'exterior' }));
    });
    return r;
  }
  /**
   * Índice (posición de marca) de cada cara: cada pegatina del hueco y cada marca de orientación de su centro
   * va a una cara distinta (la de normal más parecida a su dirección; así todas están en el modelo y
   * «Colocar piezas» las ve) y las demás caras, a la más parecida.
   */
  function asignarIndices(caras) {
    const r = new Array(caras.length).fill(0);
    /** @type {Map<number, number[]>} */
    const porHueco = new Map();
    caras.forEach((c, k) => { if (!porHueco.has(c.hueco)) porHueco.set(c.hueco, []); porHueco.get(c.hueco).push(k); });
    for (const [s, ks] of porHueco) {
      const dirs = CARAS_HUECO[s].map((f, j) => ({ i: offHueco[s] + j, d: DIR[f], par: false }));
      if (s >= 20 && periodos[s - 20] > 1) for (let k = 0; k < periodos[s - 20]; k++) dirs.push({ i: offMarca[s - 20] + k, d: vecMarca(s - 20, k), par: periodos[s - 20] === 2 });
      const valor = (k, x) => { const v = punto(caras[k].normal, x.d); return x.par ? Math.abs(v) : v; };
      const libres = new Set(ks);
      for (const x of dirs) {
        let mejor = -1;
        for (const k of libres) if (mejor < 0 || valor(k, x) > valor(mejor, x)) mejor = k;
        if (mejor < 0) break;
        r[mejor] = x.i;
        libres.delete(mejor);
      }
      for (const k of libres) {
        let mejor = dirs[0];
        for (const x of dirs) if (valor(k, x) > valor(k, mejor)) mejor = x;
        r[k] = mejor.i;
      }
    }
    return r;
  }
  const centroDe = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);
  /** cámara: como se sujeta el cubo (con el Ghost Cube, el cubo derecho y el mecanismo inclinado) */
  const ejesCubo = def.cortes.ejes || ID3;
  // (0.62, 0.72, 1) en coordenadas del cubo = Σ vᵢ · eje i del cubo (en el marco del mecanismo)
  const camara = { desde: [0, 1, 2].map((a) => 0.62 * ejesCubo[0][a] + 0.72 * ejesCubo[1][a] + 1 * ejesCubo[2][a]), arriba: ejesCubo[1].slice() };

  function geometriaDe(colocaciones, cubo, colorDe) {
    const caras = carasColocadas(colocaciones, cubo);
    // centro: el de la cara, un poco hacia dentro de su pieza (dos caras de corte de piezas vecinas
    // coinciden; así cada una tiene su punto y la comparación de posiciones no las confunde)
    const dentro = 1e-3 * G.radio;
    const indices = asignarIndices(caras);
    const pegatinas = caras.map((c, k) => ({
      puntos: c.puntos, normal: c.normal, centro: centroDe(c.puntos).map((x, a) => x - c.normal[a] * dentro), pieza: String(c.hueco), indice: indices[k],
    }));
    return { geometria: { pegatinas, radio: G.radio * 1.02, camara, material: 'metal' }, colores: caras.map(colorDe) };
  }

  function vista3D(entrada) {
    if (Array.isArray(entrada)) return vistaMarcas(entrada);
    const e = entrada;
    return geometriaDe(G.colocacion(e), !!e.cubo, () => 0);
  }

  function giro3D(e, mov) {
    const d = leerMov(mov);
    if (!d) throw new Error(`Movimiento no válido: "${mov}"`);
    const v = vista3D(e);
    const peg = v.geometria.pegatinas;
    const de = (huecos) => peg.map((q, k) => (huecos.has(Number(q.pieza)) ? k : -1)).filter((k) => k >= 0);
    if (d.especial) {
      // la pieza de cada cara: el hueco está en `pieza` (clave = hueco)
      const signo = d.especial === 'A' ? -1 : 1;
      const arriba = new Set(TODOS.filter((s) => G.filaY(s) > 0)), abajo = new Set(TODOS.filter((s) => G.filaY(s) < 0));
      return [
        { eje: [0, 1, 0], angulo: signo * G.angCapa(1), pegatinas: de(arriba) },
        { eje: [0, 1, 0], angulo: signo * G.angCapa(-1), pegatinas: de(abajo) },
      ];
    }
    aplicarPiezas(e, mov); // lanza si no se puede
    return [{ eje: DIR[d.cara], angulo: (-Math.PI / 2) * (d.q === 3 ? -1 : d.q), pegatinas: de(new Set(capaDe(d.cara))) }];
  }

  // vista de un array de marcas (con huecos vacíos): «Colocar piezas»
  function colocacionesMarcas(arr) {
    return TODOS.map((s) => {
      const vals = CARAS_HUECO[s].map((_, j) => arr[offHueco[s] + j]);
      if (vals.some((v) => v == null || v < 0)) return null;
      const k = piezaDePos[vals[0]];
      if (k === undefined || TIPO_HUECO[k] !== TIPO_HUECO[s]) return null;
      let o = 0;
      if (s < 20) o = vals.findIndex((v) => pegDePos[v] === 0);
      else if (periodos[s - 20] > 1) {
        const fi = s - 20, fk = k - 20;
        const v = arr[offMarca[fi]];
        const kk = v - offMarca[fk];
        o = kk >= 0 && kk < periodos[fk] ? (periodos[fk] - kk) % periodos[fk] : 0;
      }
      if (s >= 20 && k !== s) {
        // centro de otra cara (puzzle sujetado de otra forma): su forma, girada como la rotación más sencilla
        const R = ROTACIONES.find((Rr) => iguales(mv(Rr, DIR[CARAS[k - 20]]), DIR[CARAS[s - 20]]));
        return { pieza: k, R: mm(G.rotacionPieza(s, s, o), R) };
      }
      return { pieza: k, R: G.rotacionPieza(s, k, o) };
    });
  }
  function vistaMarcas(arr) {
    const col = colocacionesMarcas(arr);
    // huecos vacíos: la forma del resuelto, en gris (color −1)
    const conVacios = col.map((c, s) => c || { pieza: s, R: ID3, vacio: true });
    const v = geometriaDe(conVacios, desfasado && arr[POS_FORMA] === 1, () => 0);
    let k = 0;
    const colores = [];
    conVacios.forEach((c, s) => {
      const n = G.formas[c.pieza].caras.length;
      for (let i = 0; i < n; i++) colores.push(c.vacio ? -1 : arr[v.geometria.pegatinas[k + i].indice] ?? 0);
      k += n;
    });
    return { geometria: v.geometria, colores };
  }

  // SVG: proyección del modelo 3D desde delante-arriba-derecha y desde detrás-abajo-izquierda
  function renderizar(entrada, opciones = {}) {
    const v = vista3D(entrada);
    const cam = v.geometria.camara;
    const vistas = [cam.desde, cam.desde.map((x) => -x)];
    const W = 2 * G.radio;
    const partes = [];
    vistas.forEach((desde, iv) => {
      const z = norm(desde);
      const arr = cam.arriba;
      const x = norm(cruzar(arr, z));
      const y = cruzar(z, x);
      const caras = v.geometria.pegatinas.map((q, k) => ({ q, k, prof: punto(q.centro, z), luz: punto(q.normal, z) }))
        .filter((c) => c.luz > 1e-6)
        .sort((a, b) => a.prof - b.prof);
      const dx = iv * (W + 0.6);
      for (const c of caras) {
        const pts = c.q.puntos.map((p) => `${(punto(p, x) + dx).toFixed(3)},${(-punto(p, y)).toFixed(3)}`).join(' ');
        const color = v.colores[c.k] < 0 ? sombrear('#4a5670', c.q.normal, z) : sombrear(material.hex, c.q.normal, z);
        // data-i en todas (al tocar, el editor dice por qué no se pinta); «pegatina» solo en las editables
        const tocable = opciones.editable && c.q.indice != null;
        const editable = tocable && (!opciones.editables || opciones.editables.has(c.q.indice));
        partes.push(`<polygon points="${pts}" fill="${color}" stroke="#15161a" stroke-width="0.025" stroke-linejoin="round"${editable ? ' class="pegatina"' : ''}${tocable ? ` data-i="${c.q.indice}"` : ''}/>`);
      }
    });
    const ancho = 2 * W + 0.6;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(-G.radio - 0.1).toFixed(3)} ${(-G.radio - 0.1).toFixed(3)} ${(ancho + 0.2).toFixed(3)} ${(W + 0.2).toFixed(3)}" class="shapemod-2d">${partes.join('')}</svg>`;
  }
  const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cruzar = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return a.map((t) => t / n); };
  const LUZ = norm([0.35, 0.8, 0.5]);
  function sombrear(hex, n, z) {
    const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const l = 0.38 + 0.5 * Math.max(0, punto(n, LUZ)) + 0.22 * Math.max(0, punto(n, z));
    return '#' + base.map((c) => Math.max(0, Math.min(255, Math.round(c * l))).toString(16).padStart(2, '0')).join('');
  }

  /** miniatura SVG de una pieza (bandeja de «Colocar piezas») */
  function miniatura(k) {
    const P = G.formas[k];
    const pegs = P.caras.map((f) => ({ puntos: f.pts, normal: f.n, centro: centroDe(f.pts) }));
    const c = centroDe(pegs.flatMap((q) => q.puntos));
    const z = norm(camara.desde), x = norm(cruzar(camara.arriba, z)), y = cruzar(z, x);
    const pts2 = pegs.flatMap((q) => q.puntos.map((p) => [punto(p, x) - punto(c, x), -(punto(p, y) - punto(c, y))]));
    const r = Math.max(...pts2.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])))) * 1.12;
    const caras = pegs.filter((q) => punto(q.normal, z) > 1e-6).sort((a, b) => punto(a.centro, z) - punto(b.centro, z));
    const pol = caras.map((q) => `<polygon points="${q.puntos.map((p) => `${(punto(p, x) - punto(c, x)).toFixed(3)},${(-(punto(p, y) - punto(c, y))).toFixed(3)}`).join(' ')}" fill="${sombrear(material.hex, q.normal, z)}" stroke="#15161a" stroke-width="${(r * 0.04).toFixed(3)}" stroke-linejoin="round"/>`).join('');
    // cada pieza llena su miniatura (las pequeñas del Ghost Cube no se verían); su tamaño real se ve en el puzzle
    const R = r;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-R} ${-R} ${2 * R} ${2 * R}" width="40" height="40">${pol}</svg>`;
  }

  // ---------- «Colocar piezas»: puzzle adaptador sobre las marcas ----------
  const PALETA_MARCAS = Array.from({ length: N_POS }, (_, i) => ({ nombre: i < 54 ? NOMBRE_HUECO[piezaDePos[i]] : 'marca', hex: material.hex }));
  const adaptador = definirPuzzle({
    id: def.id + '-marcas',
    nombre: def.nombre,
    capacidades: { scramble: false, validar: true, resolver: false, editar: true },
    paleta: PALETA_MARCAS,
    // (el Ghost Cube se coloca con las capas alineadas: la forma queda sin poner)
    estadoResuelto: () => { const a = aMarcas(resueltoPiezas()); if (desfasado) a[POS_FORMA] = -1; return a; },
    aplicarMovimiento: (arr, m) => {
      const P = PERM_MARCAS.get(m);
      if (!P) throw new Error(`Movimiento no válido: "${m}"`);
      return permutar(arr, P);
    },
    // (con las capas alineadas: en «Colocar piezas» el Ghost Cube se coloca alineado)
    estaResuelto: (arr) => { const r = normalizar(arr); return !r.errores && piezasResueltas(r.estado) && r.estado.ct.every((x) => x === 0); },
    generarScramble: () => [],
    invertirMovimiento,
    infoMovimiento: (m) => ({ eje: m[0], clave: m[0] }),
    renderizar,
    vista3D: vistaMarcas,
    giro3D: () => [],
    validar: (arr) => validar(arr),
    colocarPiezas: {
      generadores: ['U', 'R', 'F', 'D', 'L', 'B', 'x', 'y'],
      nombreTipo: (pegs) => {
        const t = TIPO_HUECO[piezaDePos[pegs[0]]];
        return t === 'esquina' ? ['Esquinas', 'esquina'] : t === 'arista' ? ['Aristas', 'arista'] : ['Centros', 'centro'];
      },
      nombrePieza: (pegs) => `${TIPO_HUECO[piezaDePos[pegs[0]]]} de ${NOMBRE_HUECO[piezaDePos[pegs[0]]]}`,
      miniatura: (valores) => miniatura(piezaDePos[valores[0]]),
    },
  });

  function validar(entrada) {
    const n = normalizar(entrada);
    if (n.errores) return { valido: false, errores: n.errores };
    return { valido: true, errores: [] };
  }

  // ---------- movimientos legales (para la vista 3D y los tests) ----------
  const CARA_MOVS = NOMBRES_MOV.slice();
  function movimientosLegales(e) {
    if (!desfasado) return CARA_MOVS;
    return e.cubo ? [...CARA_MOVS.filter((m) => m[0] === 'U' || m[0] === 'D'), 'A'] : [...CARA_MOVS, "A'"];
  }

  // estado (por piezas o marcas) tras un movimiento
  function aplicarMovimiento(e, m) {
    if (Array.isArray(e)) {
      if (desfasado && (m === 'A' || m === "A'")) {
        const quiere = m === 'A';
        if (quiere !== (e[POS_FORMA] === 1)) throw new Error(quiere ? 'Las capas ya están alineadas.' : 'Las capas no están alineadas.');
        const r = e.slice(); r[POS_FORMA] = quiere ? 0 : 1; return r;
      }
      const P = PERM_MARCAS.get(m);
      if (!P || m.match(/^[xyz]/)) throw new Error(`Movimiento no válido: "${m}"`);
      if (desfasado && e[POS_FORMA] === 1 && m[0] !== 'U' && m[0] !== 'D') throw new Error(`Con la forma de cubo solo giran U y D: primero alinea las capas («A»).`);
      return permutar(e, P);
    }
    return aplicarPiezas(e, m);
  }

  const notaA = desfasado ? ' «A» alinea las capas de arriba y de abajo (desde la forma de cubo) y «A\'» las devuelve a la forma de cubo.' : '';
  return definirPuzzle({
    id: def.id,
    nombre: def.nombre,
    capacidades: { scramble: true, validar: true, resolver: true, editar: true },
    descripcion: def.descripcion || `Kociemba para las piezas${conCentros ? ' y una fase de centros con algoritmos puros' : ''}.${notaA}`,
    tipoScramble: 'estado aleatorio',
    costeScramble: def.costeScramble ?? 900,
    paleta: [material],
    estadoResuelto: resueltoPiezas,
    aplicarMovimiento,
    estaResuelto,
    invertirMovimiento,
    infoMovimiento(m) {
      if (m === 'A' || m === "A'") return { eje: 'A', clave: 'A' };
      const d = leerMov(m);
      if (!d) throw new Error(`Movimiento no válido: "${m}"`);
      return { eje: EJE_CARA[d.cara], clave: d.cara };
    },
    renderizar,
    pegatinasEditables: () => [],
    avisoPintar: `El ${def.nombre} es de un solo color: sus piezas se distinguen por la forma, no por pegatinas, así que pintar no tiene sentido. Para introducir el estado de tu puzzle, usa «Colocar piezas» (cada pieza, con su forma, en su hueco); o mezcla con «Nuevo scramble» o «Cargar scramble».`,
    inicializar: () => { inicializarKociemba(); if (conCentros) obtenerCentros(); return { ms: msTablasKociemba() }; },
    estaInicializado: () => kociembaListo() && (!conCentros || !!centros),
    avisoInicializacion: 'Generando las tablas de Kociemba en el navegador…',
    validar,
    resolver,
    generarScramble: (rng = rngSeguro()) => scrambleDetallado(rng).movimientos,
    vista3D,
    giro3D,
    colocarPiezas: {
      generadores: ['U', 'R', 'F', 'D', 'L', 'B', 'x', 'y'],
      adaptador,
      desdeColocar: (arr) => { const r = desdeMarcas(arr); return r.errores ? arr : r.estado; },
    },
    clonar: (e) => (Array.isArray(e) ? e.slice() : JSON.parse(JSON.stringify(e))),
    // propio: geometría, conversiones y utilidades para los tests y scripts
    shapeMod: {
      G, periodos, restriccionCentros, aMarcas, desdeMarcas, normalizar, movimientosLegales, scrambleDetallado,
      estadoAleatorio, rotaciones: ROTACIONES, permRotacion: (q) => PERM_ROT[q], permutar, N_POS, centros: obtenerCentros,
      simplificar, volumen, fuente: def.fuente || '', permMov: (m) => PERM_MARCAS.get(m), posForma: POS_FORMA, adaptador,
      carasColocadas: (e) => carasColocadas(G.colocacion(e), !!e.cubo),
    },
  });
}
