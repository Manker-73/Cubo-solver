// Megaminx: solver por etapas.
//
// 1. Etapas 1–11 (todo menos la última capa): IDA* con tablas de poda pequeñas.
//    Cada etapa resuelve unas pocas piezas nuevas con un conjunto de caras que se
//    va reduciendo: una vez que se deja de usar una cara, las piezas que solo
//    están en caras ya retiradas no se vuelven a mover. Cuando una etapa usa caras
//    que tocan piezas ya resueltas, esas piezas entran en su objetivo (se protegen).
//    IDA* da la solución más corta de cada etapa con esos giros.
// 2. Última capa: dos macros (ver megaminx-ultima.js).
// 3. Todo se repite con el puzzle visto en varias de sus 60 orientaciones (mientras
//    quede tiempo) y se queda la solución más corta.
//
// Métrica: cualquier giro de una cara (72° o 144°, en cualquier sentido) = 1.

import { crearEtapa, resolverEtapa, carasPieza, ADY } from './megaminx-busqueda.js';
import { inicializarUltima, resolverUltima, ESQ_LL, ARI_LL, unirSeguidos } from './megaminx-ultima.js';
import { modelo, ESQUINAS, ARISTAS, ORB_ESQ, ORB_ARI, sigmaDeCentros, reetiquetar } from './megaminx-piezas.js';
import { geo, IDX, CARAS, MOVS_CARA } from './megaminx-geo.js';
import { aplicarPerm } from '../core/perm.js';

const TODAS = CARAS.filter((c) => c !== 'D');
// Cada etapa: caras permitidas y piezas nuevas (por sus caras). Las piezas
// resueltas antes que estén en la región de esas caras se protegen solas.
export const ETAPAS = [
  { nombre: 'Base 1', grupo: 'base', caras: TODAS, piezas: ['D-B', 'D-DBL', 'DBL-B', 'D-DBL-B'] },
  { nombre: 'Base 2', grupo: 'base', caras: ['U', 'F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'DL'], piezas: ['D-DL', 'DBL-DL', 'D-DBL-DL'] },
  { nombre: 'Base 3', grupo: 'base', caras: ['U', 'F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR'], piezas: ['D-DR', 'DR-DL', 'D-DR-DL'] },
  { nombre: 'Base 4', grupo: 'base', caras: ['U', 'F', 'R', 'BR', 'BL', 'L', 'DBR'], piezas: ['D-DBR', 'DR-DBR', 'DBR-B', 'D-DR-DBR', 'D-DBR-B'] },
  { nombre: 'Anillo 1', grupo: 'anillo', caras: ['U', 'F', 'R', 'BR', 'BL', 'L'], piezas: ['BL-B', 'BL-DBL', 'BL-DBL-B'] },
  { nombre: 'Anillo 2', grupo: 'anillo', caras: ['U', 'F', 'R', 'BR', 'L'], piezas: ['BL-L', 'L-DBL', 'L-DL', 'BL-L-DBL', 'L-DBL-DL'] },
  { nombre: 'Anillo 3', grupo: 'anillo', caras: ['U', 'F', 'R', 'BR'], piezas: ['BR-BL', 'BR-B', 'BR-DBR', 'BR-BL-B', 'BR-DBR-B'] },
  { nombre: 'F2L 1', grupo: 'f2l', caras: ['U', 'F', 'R'], piezas: ['F-L', 'F-DL', 'F-DR', 'F-L-DL', 'F-DR-DL'] },
  { nombre: 'F2L 2', grupo: 'f2l', caras: ['U', 'F', 'R'], piezas: ['F-R', 'F-R-DR', 'R-DR'] },
  { nombre: 'F2L 3', grupo: 'f2l', caras: ['U', 'F', 'R'], piezas: ['R-BR', 'R-DBR', 'R-BR-DBR', 'R-DR-DBR'] },
];
export const ULTIMA = { nombre: 'Última capa', grupo: 'ultima' };

/** [orb, id] de la pieza con esas caras ("R-DR-DBR", en cualquier orden). */
export function piezaPorCaras(nom) {
  const cs = nom.split('-').map((c) => {
    if (!(c in IDX)) throw new Error(`Cara desconocida: ${c}`);
    return IDX[c];
  }).sort((a, b) => a - b).join(',');
  let i = ESQUINAS.findIndex((p) => p.caras.join(',') === cs);
  if (i >= 0) return [ORB_ESQ, i];
  i = ARISTAS.findIndex((p) => p.caras.join(',') === cs);
  if (i >= 0) return [ORB_ARI, i];
  throw new Error(`No hay ninguna pieza ${nom}`);
}

/**
 * Grupos de ≤ 3 piezas para las tablas de poda: tríos consecutivos y, después,
 * tríos que cubren los pares que falten, hasta que cada par de piezas esté junto en
 * alguna tabla (la heurística, el máximo de las tablas, es así mucho más fuerte).
 */
export function gruposDe(n) {
  if (n <= 3) return [[...Array(n).keys()]];
  const g = [];
  for (let k = 0; k < n; k += 3) {
    const t = [...Array(Math.min(3, n - k)).keys()].map((x) => x + k);
    if (t.length < 3) while (t.length < 3) t.unshift(t[0] - 1);
    g.push(t);
  }
  const cubierto = (a, b) => g.some((t) => t.includes(a) && t.includes(b));
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (cubierto(a, b)) continue;
      // el tercero: el que cubra más pares aún sin cubrir
      let mejor = -1, mc = -1;
      for (let c = 0; c < n; c++) {
        if (c === a || c === b) continue;
        const nc = (cubierto(a, c) ? 0 : 1) + (cubierto(b, c) ? 0 : 1);
        if (nc > mc) { mc = nc; mejor = c; }
      }
      g.push([a, b, mejor].sort((x, y) => x - y));
    }
  }
  return g;
}

let EST = null;

function prepararEtapa(def, previas) {
  const caras = def.caras.map((c) => IDX[c]);
  const nuevas = def.piezas.map(piezaPorCaras);
  const prot = previas.filter(([o, i]) => carasPieza(o, i).some((f) => caras.includes(f)));
  const piezas = [...prot, ...nuevas];
  const et = crearEtapa({ nombre: def.nombre, caras, piezas, grupos: gruposDe(piezas.length) });
  return { ...et, def, nProt: prot.length, nuevas };
}

export function inicializarSolver() {
  if (EST) return EST.info;
  const t0 = Date.now();
  const etapas = [];
  let previas = [];
  for (const def of ETAPAS) {
    const et = prepararEtapa(def, previas);
    etapas.push(et);
    previas = [...previas, ...et.nuevas];
  }
  const msEtapas = Date.now() - t0;
  const ll = inicializarUltima();
  // Orientaciones: para cada rotación del puzzle entero, qué cara del puzzle original
  // es cada cara del puzzle girado (para traducir los giros de la solución).
  const prueba = (() => {
    let e = geo.resuelto.slice();
    for (const m of ['R', 'U2', "F'", 'DBL', 'B2\'', 'L', 'DR2', 'BR']) e = aplicarPerm(e, geo.perms[m]);
    return e;
  })();
  const orientaciones = geo.rotaciones.map((P) => {
    const girar = (e) => { const r = aplicarPerm(e, P); return reetiquetar(r, sigmaDeCentros(r)); };
    const gp = girar(prueba);
    const mapa = CARAS.map((_, g) => {
      const obj = aplicarPerm(gp, geo.perms[CARAS[g]]);
      const f = CARAS.findIndex((c) => girar(aplicarPerm(prueba, geo.perms[c])).every((x, i) => x === obj[i]));
      if (f < 0) throw new Error('Megaminx: no se pudo traducir una orientación');
      return f;
    });
    return { P, girar, mapa };
  });
  let bytes = 0;
  for (const et of etapas) for (const t of et.tablas) bytes += t.d.length;
  for (const m of ll.lista) bytes += m.sec.length + 25;
  EST = {
    etapas,
    orientaciones,
    info: { ms: Date.now() - t0, msEtapas, msUltima: ll.ms, bytes, tablas: etapas.reduce((a, e) => a + e.tablas.length, 0), macros: ll.lista.length },
  };
  return EST.info;
}
export const solverInicializado = () => !!EST;

const huecoDe = (est, o, id) => {
  const p = est[o].perm.indexOf(id);
  return p * (o === ORB_ESQ ? 3 : 2) + est[o].ori[p];
};

/**
 * Resuelve una etapa; si la búsqueda pasa de su límite de nodos, la parte en
 * sub-etapas (las piezas nuevas de una en una), que siempre son más fáciles.
 */
function resolverEtapaSegura(et, est, opciones, previasEtapa) {
  const huecos = et.piezas.map(([o, id]) => huecoDe(est, o, id));
  const r = resolverEtapa(et, huecos, { maxNodos: opciones.maxNodos ?? 4e7 });
  if (r) return r.movs;
  // respaldo: piezas nuevas de una en una
  const movs = [];
  let e = est;
  let previas = previasEtapa;
  for (const pz of et.nuevas) {
    const sub = prepararEtapa({ nombre: et.nombre, caras: et.def.caras, piezas: [] }, previas);
    const sub2 = crearEtapa({
      nombre: et.nombre, caras: sub.caras, piezas: [...sub.piezas, pz], grupos: gruposDe(sub.piezas.length + 1),
    });
    const hh = sub2.piezas.map(([o, id]) => huecoDe(e, o, id));
    const rr = resolverEtapa(sub2, hh, { maxNodos: opciones.maxNodosRespaldo ?? 2e8 });
    if (!rr) throw new Error(`Megaminx: no se pudo completar la etapa ${et.nombre}`);
    for (const m of rr.movs) e = modelo.aplicarPiezas(e, MOVS_CARA[m]);
    movs.push(...rr.movs);
    previas = [...previas, pz];
  }
  return movs;
}

/** Resuelve un estado de piezas (centros en su sitio). Devuelve { movs, fases } (índices de giro). */
function resolverOrientacion(est0, opciones) {
  const { etapas } = EST;
  let est = est0;
  const tramos = [];
  let previas = [];
  for (const et of etapas) {
    const movs = resolverEtapaSegura(et, est, opciones, previas);
    for (const m of movs) est = modelo.aplicarPiezas(est, MOVS_CARA[m]);
    tramos.push({ nombre: et.def.nombre, grupo: et.def.grupo, movs });
    previas = [...previas, ...et.nuevas];
  }
  const e = ESQ_LL.map((id) => { const h = huecoDe(est, ORB_ESQ, id); return ESQ_LL.indexOf(Math.floor(h / 3)) * 3 + (h % 3); });
  const a = ARI_LL.map((id) => { const h = huecoDe(est, ORB_ARI, id); return ARI_LL.indexOf(Math.floor(h / 2)) * 2 + (h % 2); });
  const ll = resolverUltima(e, a);
  if (!ll) throw new Error('Megaminx: no se encontró la última capa');
  tramos.push({ nombre: ULTIMA.nombre, grupo: ULTIMA.grupo, movs: ll });
  return tramos;
}

/**
 * Simplifica una solución por tramos: une giros de la misma cara separados solo
 * por giros de caras que conmutan con ella (caras no vecinas), hasta que no quede
 * nada que unir. Cada giro conserva el tramo del primero de los que se unen.
 */
export function simplificarTramos(tramos) {
  let lista = [];
  tramos.forEach((t, k) => t.movs.forEach((m) => lista.push({ m, k })));
  for (let cambio = true; cambio;) {
    cambio = false;
    const out = [];
    for (const x of lista) {
      const f = x.m >> 2;
      let j = out.length - 1;
      while (j >= 0 && (out[j].m >> 2) !== f && !ADY[out[j].m >> 2][f]) j--;
      if (j >= 0 && (out[j].m >> 2) === f) {
        const q = ((out[j].m & 3) + 1 + (x.m & 3) + 1) % 5;
        if (q) out[j] = { m: f * 4 + q - 1, k: out[j].k };
        else out.splice(j, 1);
        cambio = true;
      } else out.push(x);
    }
    lista = out;
  }
  const fases = [];
  lista.forEach((x, i) => {
    const t = tramos[x.k];
    const ult = fases[fases.length - 1];
    if (ult && ult.k === x.k) ult.fin = i + 1;
    else fases.push({ nombre: t.nombre, grupo: t.grupo, inicio: i, fin: i + 1, k: x.k });
  });
  // un tramo puede quedar partido si un giro de un tramo anterior se ha unido más
  // tarde: se fusionan los trozos con el mismo nombre de forma que queden en orden
  const limpias = [];
  for (const f of fases) {
    const ult = limpias[limpias.length - 1];
    if (ult && ult.k >= f.k) { ult.fin = f.fin; continue; }
    limpias.push({ ...f });
  }
  return { movs: lista.map((x) => x.m), fases: limpias.map(({ nombre, grupo, inicio, fin }) => ({ nombre, grupo, inicio, fin })) };
}

/**
 * Resuelve un estado de pegatinas cuyos centros ya tienen el color de su cara
 * (estado validado y reetiquetado). opciones: { tiempoMax (ms), orientaciones (máximo),
 * maxNodos }. Devuelve { movimientos, fases, orientacionesProbadas }.
 */
export function resolverMegaminx(estado, opciones = {}) {
  inicializarSolver();
  const t0 = Date.now();
  const tiempoMax = opciones.tiempoMax ?? 2500;
  const maxOr = opciones.orientaciones ?? 60;
  let mejor = null;
  let probadas = 0;
  // orden de prueba: la identidad y después las demás, en un orden fijo
  for (let k = 0; k < EST.orientaciones.length && probadas < maxOr; k++) {
    if (probadas > 0 && Date.now() - t0 > tiempoMax) break;
    const o = EST.orientaciones[(k * 7) % 60];
    const eg = o.girar(estado);
    const { orbitas } = modelo.identificar(eg);
    const tramos = resolverOrientacion(orbitas, opciones);
    // traducir los giros al puzzle original
    for (const t of tramos) t.movs = t.movs.map((m) => o.mapa[m >> 2] * 4 + (m & 3));
    const s = simplificarTramos(tramos);
    probadas++;
    if (!mejor || s.movs.length < mejor.movs.length) mejor = s;
  }
  return { movimientos: mejor.movs.map((m) => MOVS_CARA[m]), fases: mejor.fases, orientacionesProbadas: probadas };
}

export const _interno = () => EST;
