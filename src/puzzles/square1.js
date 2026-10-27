// Square-1: modelo de colores, validador, solucionador, scramble de estado
// aleatorio, editor y dibujo. El motor (formas, tablas y búsqueda) está en
// square1-motor.js y trabaja con ids de pieza.
//
// ESTADO (el que usan la interfaz, el editor y la reproducción)
//   { arriba: { ini, piezas }, abajo: { ini, piezas }, medio }
// - piezas: lista de piezas de la capa en orden de casilla creciente, empezando
//   en la casilla `ini`. Cada pieza es un array de colores: [cara, lateral] para
//   una arista y [cara, lateral1, lateral2] para una esquina (lateral1 en la
//   casilla de número menor). Una arista ocupa 1 casilla y una esquina 2; una
//   capa correcta suma 12.
// - medio: 0 o 1 (1 = la mitad derecha de la capa del medio está volteada).
// - Colores: índices de PALETA (-1 = sin pintar).
// Las casillas y el corte siguen el convenio de square1-motor.js.

import { definirPuzzle } from '../core/puzzle.js';
import { rngSeguro } from '../core/rng.js';
import {
  RESUELTO_ARRIBA, RESUELTO_ABAJO, esEsquina, mod12, normalizarGiro, mascara, MASCARA_RESUELTO,
  inicializarMotor, motorInicializado, tablas, resolverIds, estadoAleatorioIds, requiereAlMenos,
  leerMovimiento, contarBarras, contarGiros, paridadEstado, alcanzable,
} from './square1-motor.js';

// ---------- Colores ----------
// Esquema occidental con el blanco arriba. Regulación 4d3: se mezcla con el
// color más oscuro de los dos posibles delante; con el corte según 12c1 los
// dos frentes posibles son el azul y el verde, así que el frente es el azul.
export const PALETA = [
  { nombre: 'blanco', hex: '#f4f4f4' },
  { nombre: 'amarillo', hex: '#ffd60a' },
  { nombre: 'verde', hex: '#2a9d4b' },
  { nombre: 'rojo', hex: '#d62828' },
  { nombre: 'azul', hex: '#1d5ad8' },
  { nombre: 'naranja', hex: '#f77f00' },
];
const U = 0, D = 1;
const LADOS = [4, 5, 2, 3]; // frente, derecha, detrás, izquierda
const OPUESTO = { 0: 1, 1: 0, 2: 4, 4: 2, 3: 5, 5: 3 };
const nombreColor = (c) => (PALETA[c] ? PALETA[c].nombre : 'sin color');
// Cara lateral de la casilla s (ángulos [30s, 30s+30]; el frente está centrado en 15°)
const ladoCasilla = (s) => Math.round(mod12(s) / 3) % 4;
const colorLateral = (s) => LADOS[ladoCasilla(s)];

// Orden canónico de una esquina (independiente de la capa): en la capa de
// arriba [cara, lateral de la casilla menor, lateral de la mayor]; en la de
// abajo, al estar vista desde el otro lado, al revés.
const canonica = (piezaColores, capa) => (capa === 'arriba' ? piezaColores.slice() : [piezaColores[0], piezaColores[2], piezaColores[1]]);
const deCanonica = (can, capa) => (capa === 'arriba' ? can.slice() : [can[0], can[2], can[1]]);

// Colores de cada pieza (por id) en el estado resuelto, en forma canónica
const COLORES_ID = [];
for (const [capa, arr, cara] of [['arriba', RESUELTO_ARRIBA, U], ['abajo', RESUELTO_ABAJO, D]]) {
  for (let k = 0; k < 12; k++) {
    const id = arr[k];
    if (arr[mod12(k - 1)] === id) continue;
    COLORES_ID[id] = esEsquina(id)
      ? canonica([cara, colorLateral(k), colorLateral(k + 1)], capa)
      : [cara, colorLateral(k)];
  }
}

// ---------- Conversión ids <-> colores ----------
function capaDeIds(arr, capa) {
  let ini = 0;
  while (arr[ini] === arr[mod12(ini - 1)]) ini++;
  const piezas = [];
  for (let k = ini; k < ini + 12;) {
    const id = arr[mod12(k)];
    piezas.push(esEsquina(id) ? deCanonica(COLORES_ID[id], capa) : COLORES_ID[id].slice());
    k += esEsquina(id) ? 2 : 1;
  }
  return { ini, piezas };
}
export function coloresDeIds(e) {
  return { arriba: capaDeIds(e.arriba, 'arriba'), abajo: capaDeIds(e.abajo, 'abajo'), medio: e.medio };
}

export function clonar(e) {
  return {
    arriba: { ini: e.arriba.ini, piezas: e.arriba.piezas.map((p) => p.slice()) },
    abajo: { ini: e.abajo.ini, piezas: e.abajo.piezas.map((p) => p.slice()) },
    medio: e.medio,
  };
}

export function estadoResuelto() {
  return coloresDeIds({ arriba: RESUELTO_ARRIBA, abajo: RESUELTO_ABAJO, medio: 0 });
}

const casillasDe = (capa) => capa.piezas.reduce((s, p) => s + p.length - 1, 0);

/** Casillas de una capa: [{ pieza (objeto), h (mitad), c (cara), l (lateral) }]. Lanza error si no suma 12. */
function expandir(capa, nombre) {
  const n = casillasDe(capa);
  if (n !== 12) throw new Error(`La capa de ${nombre} ocupa ${n} casillas y debe ocupar 12`);
  const s = new Array(12);
  let k = capa.ini;
  for (const p of capa.piezas) {
    for (let h = 0; h < p.length - 1; h++) s[mod12(k++)] = { pieza: p, h, c: p[0], l: p[1 + h] };
  }
  return s;
}
function compactar(s) {
  let ini = 0;
  while (s[ini].pieza === s[mod12(ini - 1)].pieza) ini++;
  const piezas = [];
  for (let k = ini; k < ini + 12;) {
    const a = s[mod12(k)];
    const b = s[mod12(k + 1)];
    if (b.pieza === a.pieza) { piezas.push([a.c, a.l, b.l]); k += 2; } else { piezas.push([a.c, a.l]); k += 1; }
  }
  return { ini, piezas };
}

// ---------- Movimientos ----------
function sePuedeCortarColores(e) {
  const a = expandir(e.arriba, 'arriba'), b = expandir(e.abajo, 'abajo');
  return a[11].pieza !== a[0].pieza && a[5].pieza !== a[6].pieza && b[11].pieza !== b[0].pieza && b[5].pieza !== b[6].pieza;
}

function aplicarMovimiento(e, mov) {
  const m = leerMovimiento(mov);
  if (!m) throw new Error(`Movimiento no válido: "${mov}"`);
  const a = expandir(e.arriba, 'arriba'), b = expandir(e.abajo, 'abajo');
  if (m.corte) {
    if (a[11].pieza === a[0].pieza || a[5].pieza === a[6].pieza || b[11].pieza === b[0].pieza || b[5].pieza === b[6].pieza) {
      throw new Error('"/" ilegal: una esquina atraviesa el corte');
    }
    const na = a.slice(), nb = b.slice();
    for (let k = 0; k < 6; k++) { na[k] = b[5 - k]; nb[k] = a[5 - k]; }
    return { arriba: compactar(na), abajo: compactar(nb), medio: e.medio ^ 1 };
  }
  const na = a.map((_, k) => a[mod12(k + m.x)]);
  const nb = b.map((_, k) => b[mod12(k - m.y)]);
  return { arriba: compactar(na), abajo: compactar(nb), medio: e.medio };
}

function invertirMovimiento(mov) {
  const m = leerMovimiento(mov);
  if (m.corte) return '/';
  return `(${normalizarGiro(-m.x)},${normalizarGiro(-m.y)})`;
}

/** Resuelto si tiene la forma del cubo alineada, la capa del medio sin voltear y cada cara de un solo color. */
function estaResuelto(e) {
  if (e.medio !== 0) return false;
  let a, b;
  try { a = expandir(e.arriba, 'arriba'); b = expandir(e.abajo, 'abajo'); } catch { return false; }
  const masc = (s) => { let m = 0; for (let k = 0; k < 12; k++) if (s[k].pieza !== s[mod12(k - 1)].pieza) m |= 1 << k; return m; };
  if (masc(a) !== MASCARA_RESUELTO || masc(b) !== MASCARA_RESUELTO) return false;
  const caraA = a[0].c, caraB = b[0].c;
  if (!a.every((x) => x.c === caraA) || !b.every((x) => x.c === caraB)) return false;
  const lado = [null, null, null, null];
  for (const s of [a, b]) {
    for (let k = 0; k < 12; k++) {
      const f = ladoCasilla(k);
      if (lado[f] === null) lado[f] = s[k].l; else if (lado[f] !== s[k].l) return false;
    }
  }
  return new Set([caraA, caraB, ...lado]).size === 6;
}

// ---------- Validador ----------
const NOMBRES_DIR = ['delante', 'delante-derecha', 'derecha', 'detrás-derecha', 'detrás', 'detrás-izquierda', 'izquierda', 'delante-izquierda'];
// Dirección aproximada de una pieza por el centro de sus casillas
function direccion(k, ancho) {
  const centro = mod12(k) * 30 + ancho * 15; // grados
  const i = Math.round((((centro - 15) % 360) + 360) % 360 / 45) % 8;
  return NOMBRES_DIR[i];
}
const lista = (cs) => cs.map(nombreColor).join('-');

/**
 * Analiza un estado de colores. Devuelve { valido, errores, ids } (ids =
 * estado del motor si es válido).
 */
function analizar(e) {
  const errores = [];
  if (!e || !e.arriba || !e.abajo || !Array.isArray(e.arriba.piezas) || !Array.isArray(e.abajo.piezas)) {
    return { valido: false, errores: ['El estado no tiene el formato esperado.'] };
  }
  if (e.medio !== 0 && e.medio !== 1) errores.push('El estado de la capa del medio no es válido: solo puede estar en su sitio o con la mitad derecha volteada.');
  for (const [nombre, capa] of [['arriba', e.arriba], ['abajo', e.abajo]]) {
    if (capa.piezas.some((p) => !Array.isArray(p) || (p.length !== 2 && p.length !== 3))) {
      errores.push(`La capa de ${nombre} tiene una pieza que no es ni esquina ni arista.`);
      continue;
    }
    const n = casillasDe(capa);
    if (n !== 12) {
      errores.push(`La capa de ${nombre} ocupa ${n} casillas y debe ocupar exactamente 12 (cada esquina ocupa 2 casillas y cada arista 1).`);
    }
  }
  if (errores.length) return { valido: false, errores };

  // Pegatinas y número de piezas
  const todas = [...e.arriba.piezas, ...e.abajo.piezas];
  const cuenta = new Array(6).fill(0);
  let vacias = 0;
  for (const p of todas) for (const c of p) { if (c >= 0 && c < 6) cuenta[c]++; else vacias++; }
  if (vacias) errores.push(`Hay ${vacias} pegatina${vacias > 1 ? 's' : ''} sin pintar.`);
  const nEsq = todas.filter((p) => p.length === 3).length;
  const nAri = todas.length - nEsq;
  if (nEsq !== 8) errores.push(`Hay ${nEsq} esquinas y debe haber 8.`);
  if (nAri !== 8) errores.push(`Hay ${nAri} aristas y debe haber 8.`);
  if (!vacias) {
    cuenta.forEach((n, c) => {
      const deberia = c === U || c === D ? 8 : 6;
      if (n !== deberia) errores.push(`Hay ${n} pegatina${n === 1 ? '' : 's'} de color ${nombreColor(c)} y debería haber ${deberia}.`);
    });
  }
  if (errores.length) return { valido: false, errores };

  // Identificar cada pieza
  const usadas = new Array(16).fill(0);
  const ids = { arriba: new Array(12), abajo: new Array(12), medio: e.medio };
  const esqReales = COLORES_ID.slice(0, 8), ariReales = COLORES_ID.slice(8);
  for (const nombre of ['arriba', 'abajo']) {
    const capa = e[nombre];
    let k = capa.ini;
    for (const p of capa.piezas) {
      const ancho = p.length - 1;
      const donde = `de ${nombre} (${direccion(k, ancho)})`;
      let id = -1;
      if (p.length === 3) {
        const can = canonica(p, nombre);
        id = esqReales.findIndex((r) => r[0] === can[0] && r[1] === can[1] && r[2] === can[2]);
        if (id < 0) {
          const mismo = (r) => r.slice().sort().join() === p.slice().sort().join();
          const real = esqReales.find(mismo);
          if (real && (can[0] === U || can[0] === D) && real[0] === can[0]) {
            errores.push(`La esquina ${donde} (${lista(p)}) tiene los colores en un orden imposible: es la imagen especular de una pieza real.`);
          } else if (real) {
            errores.push(`La esquina ${donde} (${lista(p)}) está girada: en el Square-1 la pegatina blanca o amarilla de cada pieza siempre mira hacia arriba o hacia abajo.`);
          } else {
            const repe = new Set(p).size < 3;
            const opuestos = p.some((x) => p.some((y) => OPUESTO[x] === y));
            errores.push(`La esquina ${donde} (${lista(p)}) no existe en un Square-1 real${repe ? ' (tiene un color repetido)' : opuestos ? ' (tiene dos colores de caras opuestas)' : ''}.`);
          }
        }
      } else {
        id = ariReales.findIndex((r) => r[0] === p[0] && r[1] === p[1]);
        if (id >= 0) id += 8;
        else if (ariReales.some((r) => r[0] === p[1] && r[1] === p[0])) {
          errores.push(`La arista ${donde} (${lista(p)}) está volteada: en el Square-1 la pegatina blanca o amarilla de cada pieza siempre mira hacia arriba o hacia abajo.`);
        } else {
          const opuestos = OPUESTO[p[0]] === p[1];
          errores.push(`La arista ${donde} (${lista(p)}) no existe en un Square-1 real${p[0] === p[1] ? ' (tiene un color repetido)' : opuestos ? ' (tiene dos colores de caras opuestas)' : ''}.`);
        }
      }
      if (id >= 0) {
        usadas[id]++;
        for (let h = 0; h < ancho; h++) ids[nombre][mod12(k + h)] = id;
      }
      k += ancho;
    }
  }
  if (errores.length) return { valido: false, errores };
  usadas.forEach((v, id) => {
    const tipo = esEsquina(id) ? 'esquina' : 'arista';
    if (v > 1) errores.push(`La ${tipo} ${lista(COLORES_ID[id])} aparece ${v} veces.`);
    if (v === 0) errores.push(`Falta la ${tipo} ${lista(COLORES_ID[id])}.`);
  });
  if (errores.length) return { valido: false, errores };

  // Forma, paridad y capa del medio: los tests demuestran que todas las
  // combinaciones son alcanzables (no hay restricción de paridad), así que esta
  // comprobación nunca debería fallar; se deja como seguro.
  const t = mascara(ids.arriba), b = mascara(ids.abajo);
  if (!alcanzable(t, b, paridadEstado(ids), ids.medio)) {
    return { valido: false, errores: ['Esta combinación de formas de las capas no se puede alcanzar.'] };
  }
  return { valido: true, errores: [], ids };
}

function validar(e) {
  const a = analizar(e);
  return { valido: a.valido, errores: a.errores };
}

// ---------- Solver ----------
const MS_SOLVER = 200; // tiempo para mejorar la primera solución
const MS_SCRAMBLE = 80;

function resolver(e, opciones = {}) {
  const t0 = (globalThis.performance || Date).now();
  const a = analizar(e);
  if (!a.valido) return { ok: false, errores: a.errores };
  inicializarMotor();
  const r = resolverIds(a.ids, { msMax: opciones.msMax ?? MS_SOLVER });
  return { ok: true, movimientos: r.movimientos, ms: (globalThis.performance || Date).now() - t0 };
}

// ---------- Scramble de estado aleatorio ----------
export const MIN_MOVIMIENTOS = 11; // Regulación 4b3d, métrica 12c4

/** Estado aleatorio (ids): uniforme entre los alcanzables en los que se puede hacer "/" y a ≥ 11 movimientos. */
export function estadoAleatorioValido(rng) {
  for (;;) {
    const e = estadoAleatorioIds(rng);
    if (requiereAlMenos(e, MIN_MOVIMIENTOS)) return e;
  }
}

function generarScramble(rng = rngSeguro()) {
  inicializarMotor();
  const e = estadoAleatorioValido(rng);
  const r = resolverIds(e, { msMax: MS_SCRAMBLE });
  return r.movimientos.slice().reverse().map(invertirMovimiento);
}

// ---------- Notación ----------
const RE_TOKEN = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;
function parsear(texto) {
  const res = [];
  let m;
  RE_TOKEN.lastIndex = 0;
  while ((m = RE_TOKEN.exec(texto))) res.push(m[0] === '/' ? '/' : `(${parseInt(m[1], 10)},${parseInt(m[2], 10)})`);
  return res;
}
function formatear(movs) {
  let s = '';
  for (const m of movs) s += m === '/' ? '/ ' : m;
  return s.trim();
}
function describirLongitud(movs) {
  return `${contarBarras(movs)} barras · ${movs.length} movimientos WCA · ${contarGiros(movs)} en métrica de giros`;
}

// ---------- Editor ----------
// Índice de pegatina: capa (0 arriba, 1 abajo) * 1000 + pieza * 10 + pegatina (0 = cara, 1-2 = laterales)
export const INDICE_MEDIO = 9999;
const NOMBRE_CAPA = ['arriba', 'abajo'];
export const indicePegatina = (capa, pieza, peg) => capa * 1000 + pieza * 10 + peg;
const decodificar = (i) => ({ capa: NOMBRE_CAPA[Math.floor(i / 1000)], pieza: Math.floor((i % 1000) / 10), peg: i % 10 });

function pintar(e, i, color) {
  const n = clonar(e);
  if (i === INDICE_MEDIO) { n.medio ^= 1; return n; }
  const { capa, pieza, peg } = decodificar(i);
  const p = n[capa] && n[capa].piezas[pieza];
  if (!p || peg >= p.length) return n;
  p[peg] = color;
  return n;
}

/**
 * Herramienta "mover piezas": se tocan dos piezas y se intercambian. Si no
 * ocupan lo mismo (una esquina y una arista), se intercambian los bloques que
 * empiezan en cada una, añadiendo las piezas siguientes hasta que los dos
 * bloques ocupen el mismo número de casillas (por ejemplo, esquina+arista con
 * arista+esquina). Así se cambia la forma de las capas sin que sobre ni falte
 * ninguna pieza. Al pasar una esquina a la otra capa se conserva su quiralidad
 * (no se crea su imagen especular).
 */
function moverPiezas(e, i1, i2) {
  if (i1 === INDICE_MEDIO || i2 === INDICE_MEDIO) return clonar(e);
  const A = decodificar(i1), B = decodificar(i2);
  if (!e[A.capa].piezas[A.pieza] || !e[B.capa].piezas[B.pieza]) return clonar(e);
  if (A.capa === B.capa && A.pieza === B.pieza) return clonar(e);
  const sl = { arriba: expandir(e.arriba, 'arriba'), abajo: expandir(e.abajo, 'abajo') };
  const inicio = (capa, idx) => { let k = e[capa].ini; for (let j = 0; j < idx; j++) k += e[capa].piezas[j].length - 1; return mod12(k); };
  // anchos acumulados de los bloques que empiezan en cada pieza
  const acumulados = (capa, idx) => {
    const ps = e[capa].piezas, r = new Map();
    let w = 0;
    for (let j = 0; j < ps.length; j++) { w += ps[(idx + j) % ps.length].length - 1; r.set(w, j + 1); }
    return r;
  };
  const accA = acumulados(A.capa, A.pieza), accB = acumulados(B.capa, B.pieza);
  let ancho = 0;
  for (const w of [...accA.keys()].sort((x, y) => x - y)) if (accB.has(w)) { ancho = w; break; }
  const X = { capa: A.capa, k: inicio(A.capa, A.pieza), ancho };
  const Y = { capa: B.capa, k: inicio(B.capa, B.pieza), ancho };
  const casillas = (blq) => Array.from({ length: blq.ancho }, (_, h) => mod12(blq.k + h));
  if (X.capa === Y.capa) {
    const cx = new Set(casillas(X));
    if (ancho >= 12 || casillas(Y).some((k) => cx.has(k))) throw new Error('Esas dos piezas están demasiado juntas para intercambiarlas: elige otras.');
  }
  const leer = (blq) => casillas(blq).map((k) => sl[blq.capa][k]);
  const cx = leer(X), cy = leer(Y);
  // Copias de las piezas; las esquinas que cambian de capa invierten sus laterales (misma quiralidad)
  const trasladar = (cas, desde, hasta) => {
    const copias = new Map();
    return cas.map((c) => {
      if (!copias.has(c.pieza)) {
        let q = c.pieza.slice();
        if (q.length === 3 && desde !== hasta) q = [q[0], q[2], q[1]];
        copias.set(c.pieza, q);
      }
      return copias.get(c.pieza);
    });
  };
  const escribir = (blq, nuevas) => {
    const vistas = new Set();
    casillas(blq).forEach((k, h) => {
      const q = nuevas[h];
      const mitad = vistas.has(q) ? 1 : 0;
      vistas.add(q);
      sl[blq.capa][k] = { pieza: q, h: mitad, c: q[0], l: q[1 + mitad] };
    });
  };
  const nx = trasladar(cy, Y.capa, X.capa), ny = trasladar(cx, X.capa, Y.capa);
  escribir(X, nx);
  escribir(Y, ny);
  return { arriba: compactar(sl.arriba), abajo: compactar(sl.abajo), medio: e.medio };
}

function usarHerramienta(e, id, indices) {
  if (id === 'mover') return moverPiezas(e, indices[0], indices[1]);
  throw new Error(`Herramienta desconocida: ${id}`);
}

const ACCIONES = [
  { id: 'a+', etiqueta: 'Arriba ↻', titulo: 'Girar la capa de arriba 30° en sentido horario: (1,0)', mov: '(1,0)' },
  { id: 'a-', etiqueta: 'Arriba ↺', titulo: 'Girar la capa de arriba 30° en sentido antihorario: (-1,0)', mov: '(-1,0)' },
  { id: 'b+', etiqueta: 'Abajo ↻', titulo: 'Girar la capa de abajo 30° en sentido horario visto desde abajo: (0,1)', mov: '(0,1)' },
  { id: 'b-', etiqueta: 'Abajo ↺', titulo: 'Girar la capa de abajo 30° en sentido antihorario visto desde abajo: (0,-1)', mov: '(0,-1)' },
  { id: 'medio', etiqueta: 'Voltear medio', titulo: 'Voltear la mitad derecha de la capa del medio' },
];
function aplicarAccion(e, id) {
  const a = ACCIONES.find((x) => x.id === id);
  if (!a) throw new Error(`Acción desconocida: ${id}`);
  if (id === 'medio') { const n = clonar(e); n.medio ^= 1; return n; }
  return aplicarMovimiento(e, a.mov);
}

// ---------- Dibujo ----------
const RAD = Math.PI / 180;
const colorHex = (c) => (PALETA[c] ? PALETA[c].hex : '#8a8f9c');

/**
 * Polígonos de una capa. Vista de arriba desde arriba y de abajo desde abajo,
 * con el frente hacia abajo del dibujo. Admite capas que no suman 12 (se
 * dibujan igualmente para que se vea el problema).
 */
function dibujarCapa(capa, nCapa, cx, cy, a, espejo, editable, seleccion) {
  const pt = (ang, r) => {
    const t = (ang - 15) * RAD; // el frente (15°) abajo
    return [cx + Math.sin(t) * r * (espejo ? -1 : 1), cy + Math.cos(t) * r];
  };
  const rEdge = a / Math.cos(15 * RAD), rTip = a * Math.SQRT2, ext = 1.18;
  const f = (n) => n.toFixed(2);
  const sc = (p) => [cx + (p[0] - cx) * ext, cy + (p[1] - cy) * ext];
  let s = '';
  const poly = (pts, c, i, sel) => {
    const attrs = editable ? ` class="pegatina${sel ? ' sel' : ''}" data-i="${i}"` : '';
    const borde = sel ? ' stroke="var(--acento, #2f55d4)" stroke-width="3"' : ' stroke="#111" stroke-width="1.2"';
    return `<polygon points="${pts.map(([x, y]) => f(x) + ',' + f(y)).join(' ')}" fill="${colorHex(c)}"${borde} stroke-linejoin="round"${attrs}/>`;
  };
  let k = capa.ini;
  const selDe = (j) => seleccion && seleccion.capa === NOMBRE_CAPA[nCapa] && seleccion.pieza === j;
  capa.piezas.forEach((p, j) => {
    const t0 = k * 30, sel = selDe(j);
    if (p.length === 3) {
      const p1 = pt(t0, rEdge), tip = pt(t0 + 30, rTip), p3 = pt(t0 + 60, rEdge);
      s += poly([p1, tip, sc(tip), sc(p1)], p[1], indicePegatina(nCapa, j, 1), sel);
      s += poly([tip, p3, sc(p3), sc(tip)], p[2], indicePegatina(nCapa, j, 2), sel);
      s += poly([[cx, cy], p1, tip, p3], p[0], indicePegatina(nCapa, j, 0), sel);
      k += 2;
    } else {
      const p1 = pt(t0, rEdge), p2 = pt(t0 + 30, rEdge);
      s += poly([p1, p2, sc(p2), sc(p1)], p[1], indicePegatina(nCapa, j, 1), sel);
      s += poly([[cx, cy], p1, p2], p[0], indicePegatina(nCapa, j, 0), sel);
      k += 1;
    }
  });
  const c1 = pt(0, rTip * 1.25), c2 = pt(180, rTip * 1.25);
  s += `<line x1="${f(c1[0])}" y1="${f(c1[1])}" x2="${f(c2[0])}" y2="${f(c2[1])}" stroke="#e5484d" stroke-width="1.6" stroke-dasharray="4 3" pointer-events="none"/>`;
  return s;
}

function renderizar(e, opts = {}) {
  const editable = !!opts.editable;
  const seleccion = opts.seleccion != null && opts.seleccion !== INDICE_MEDIO ? decodificar(opts.seleccion) : null;
  const a = 40;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 214" class="puzzle-svg">';
  s += `<text x="80" y="14" font-size="11" text-anchor="middle" fill="currentColor" font-family="sans-serif">arriba</text>`;
  s += `<text x="250" y="14" font-size="11" text-anchor="middle" fill="currentColor" font-family="sans-serif">abajo (vista desde abajo)</text>`;
  s += dibujarCapa(e.arriba, 0, 80, 98, a, false, editable, seleccion);
  s += dibujarCapa(e.abajo, 1, 250, 98, a, true, editable, seleccion);
  // Capa del medio, vista desde delante: la mitad izquierda fija y la derecha volteada si medio = 1
  const y = 184, h = 14;
  const attrs = editable ? ` class="pegatina" data-i="${INDICE_MEDIO}"` : '';
  s += `<rect x="111" y="${y}" width="54" height="${h}" fill="${colorHex(LADOS[0])}" stroke="#111" stroke-width="1.2"/>`;
  s += `<rect x="165" y="${y}" width="54" height="${h}" fill="${colorHex(e.medio ? LADOS[2] : LADOS[0])}" stroke="#111" stroke-width="1.2"${attrs}/>`;
  s += `<text x="165" y="${y + h + 12}" font-size="10" text-anchor="middle" fill="currentColor" font-family="sans-serif">capa del medio${e.medio ? ' (mitad derecha volteada)' : ''}</text>`;
  s += '</svg>';
  return s;
}

export default definirPuzzle({
  id: 'square1',
  nombre: 'Square-1',
  capacidades: { scramble: true, validar: true, resolver: true, editar: true },
  tipoScramble: 'estado aleatorio',
  descripcion: 'Con «Mover piezas», toca dos piezas para intercambiarlas; si una es esquina y la otra arista, se intercambian también las de al lado hasta ocupar lo mismo (así cambia la forma). Con un color, toca una pegatina para pintarla. Toca la barra del medio para voltearla.',
  avisoInicializacion: 'Generando las tablas del Square-1…',
  separador: ' ',
  paleta: PALETA,
  herramientas: [{ id: 'mover', nombre: 'Mover piezas', icono: '⇄', toques: 2 }],
  herramientaInicial: 'mover',
  accionesEditor: ACCIONES.map(({ id, etiqueta, titulo }) => ({ id, etiqueta, titulo })),
  estadoResuelto,
  clonar,
  aplicarMovimiento,
  estaResuelto,
  invertirMovimiento,
  // Redundancias: dos "/" seguidos, dos giros seguidos o un giro (0,0)
  infoMovimiento: (m) => ({ eje: m === '/' ? 'corte' : 'capas', clave: m === '/' ? 'corte' : 'capas' }),
  buscarRedundancia(movs) {
    for (let i = 0; i < movs.length; i++) {
      if (movs[i] === '(0,0)') return `giro vacío en la posición ${i + 1}`;
      const l = leerMovimiento(movs[i]);
      if (!l) return `movimiento no válido en la posición ${i + 1}`;
      if (!l.corte && (l.x < -5 || l.x > 6 || l.y < -5 || l.y > 6)) return `giro fuera del rango -5..6 en la posición ${i + 1}`;
      if (i > 0 && (movs[i] === '/') === (movs[i - 1] === '/')) return `movimientos seguidos del mismo tipo en la posición ${i + 1}`;
    }
    return null;
  },
  parsear,
  formatear,
  describirLongitud,
  renderizar,
  generarScramble,
  validar,
  resolver,
  inicializar: () => inicializarMotor(),
  estaInicializado: motorInicializado,
  // Los índices dependen de la forma: se calculan para el estado dado (por defecto, el resuelto)
  pegatinasEditables(e = estadoResuelto()) {
    const r = [INDICE_MEDIO];
    [e.arriba, e.abajo].forEach((capa, c) => capa.piezas.forEach((q, j) => q.forEach((_, k) => r.push(indicePegatina(c, j, k)))));
    return r;
  },
  pintar,
  usarHerramienta,
  aplicarAccion,
  sePuedeCortar: sePuedeCortarColores,
  tablasMotor: tablas,
});
