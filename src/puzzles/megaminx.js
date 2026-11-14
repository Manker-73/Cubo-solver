// Megaminx: scramble en notación Pochmann (WCA 12d), validador, editor y solver.
//
// Scrambles: U / U': cara de arriba 72°. R++ / R--: todo menos la capa de la cara
// opuesta a R, 144° (visto desde R). D++ / D--: todo menos la capa de arriba, 144°
// (visto desde D). 7 líneas de 10 movimientos R/D alternos terminadas en U (si el
// último D es ++) o U' (si es --).
//
// Soluciones: notación de caras (U, F, R, BR, BL, L, D, DR, DBR, B, DBL, DL; ver
// megaminx-geo.js), con X, X', X2, X2' (72° y 144° en los dos sentidos).

import { definirPuzzle } from '../core/puzzle.js';
import { svgDePegatinas, cajaDe } from '../core/render.js';
import { rngSeguro } from '../core/rng.js';
import { paridad } from '../core/perm.js';
import { geo, PALETA_MEGA, CARAS, IDX, normales, partirGiro, MOVS_CARA } from './megaminx-geo.js';
import { modelo, ESQUINAS, ARISTAS, CENTROS, sigmaDeCentros, reetiquetar, nombrePos, ORB_ESQ } from './megaminx-piezas.js';
import { inicializarSolver, solverInicializado, resolverMegaminx, ETAPAS } from './megaminx-solver.js';
import { ADY } from './megaminx-busqueda.js';
import { dot } from '../core/geometria.js';

export { PALETA_MEGA };

// ---------- Scramble Pochmann ----------
export const LINEAS = 7, POR_LINEA = 10;
const POCHMANN = /^(R\+\+|R--|D\+\+|D--|U'?)$/;

function generarScramble(rng = rngSeguro()) {
  const movs = [];
  for (let l = 0; l < LINEAS; l++) {
    let ultimo = '';
    for (let i = 0; i < POR_LINEA; i++) {
      const cara = i % 2 === 0 ? 'R' : 'D';
      const suf = rng() < 0.5 ? '++' : '--';
      movs.push(cara + suf);
      ultimo = suf;
    }
    movs.push(ultimo === '++' ? 'U' : "U'");
  }
  return movs;
}

const caraDe = geo.pegatinas.map((p) => p.cara);
const nombreColor = (c) => (PALETA_MEGA[c] ? PALETA_MEGA[c].nombre : 'sin pintar');
const OPUESTA = normales.map((n) => normales.findIndex((m) => dot(n, m) < -0.99));

// ---------- Validador ----------
function validar(estado) {
  const errores = [];
  if (!Array.isArray(estado) || estado.length !== geo.n) return { valido: false, errores: ['Estado mal formado.'] };
  // 1. número de pegatinas de cada color
  const cuenta = new Array(12).fill(0);
  let sinPintar = 0;
  for (const c of estado) { if (c >= 0 && c < 12) cuenta[c]++; else sinPintar++; }
  if (sinPintar) errores.push(`Hay ${sinPintar} pegatina${sinPintar === 1 ? '' : 's'} sin pintar.`);
  cuenta.forEach((n, c) => {
    if (n !== 11) errores.push(`Hay ${n} pegatina${n === 1 ? '' : 's'} de color ${nombreColor(c)} y debería haber 11 (una cara entera).`);
  });
  if (errores.length) return { valido: false, errores };

  // 2. centros: una rotación del esquema de colores (no especular)
  const cc = CENTROS.map((i) => estado[i]);
  const repes = new Map();
  cc.forEach((c, f) => { if (!repes.has(c)) repes.set(c, []); repes.get(c).push(CARAS[f]); });
  for (const [c, fs] of repes) if (fs.length > 1) errores.push(`Los centros de ${fs.join(' y ')} son del mismo color (${nombreColor(c)}): cada centro debe tener un color distinto.`);
  if (errores.length) return { valido: false, errores };
  const sigma = sigmaDeCentros(estado);
  if (!sigma) {
    // ¿parejas de opuestos correctas? (en el esquema, el color c va opuesto a OPUESTA[c])
    for (let f = 0; f < 12; f++) {
      const g = OPUESTA[f];
      if (g > f && OPUESTA[cc[f]] !== cc[g]) {
        errores.push(`Los centros ${nombreColor(cc[f])} (${CARAS[f]}) y ${nombreColor(cc[g])} (${CARAS[g]}) están en caras opuestas, pero en el Megaminx el opuesto del ${nombreColor(cc[f])} es el ${nombreColor(OPUESTA[cc[f]])}.`);
      }
    }
    if (!errores.length) errores.push('Los centros están en orden especular (como vistos en un espejo): ningún Megaminx tiene los colores así colocados.');
    return { valido: false, errores };
  }
  // 3. piezas: que existan, sin especulares, sin repetidas
  const e = reetiquetar(estado, sigma);
  const inv = new Array(12); sigma.forEach((canon, pintado) => { inv[canon] = pintado; });
  const coloresPos = (orb, p) => (orb === ORB_ESQ ? ESQUINAS : ARISTAS)[p].pegatinas.map((i) => nombreColor(estado[i])).join('-');
  const nombrePieza = (orb, id) => (orb === ORB_ESQ ? ESQUINAS : ARISTAS)[id].caras.map((f) => nombreColor(inv[f])).join('-');
  const tipo = (orb) => (orb === ORB_ESQ ? 'esquina' : 'arista');
  const { orbitas, errores: errPz } = modelo.identificar(e);
  for (const er of errPz) {
    const pz = (er.oi === ORB_ESQ ? ESQUINAS : ARISTAS)[er.pos];
    const col = coloresPos(er.oi, er.pos);
    if (er.tipo === 'espejo') errores.push(`La ${tipo(er.oi)} de ${nombrePos(pz)} (${col}) tiene los colores de una ${tipo(er.oi)} real pero en orden especular: esa pieza no existe.`);
    else errores.push(`La ${tipo(er.oi)} de ${nombrePos(pz)} tiene los colores ${col}, que no forman ninguna ${tipo(er.oi)} del Megaminx.`);
  }
  orbitas.forEach(({ perm }, orb) => {
    const lista = orb === ORB_ESQ ? ESQUINAS : ARISTAS;
    const donde = lista.map(() => []);
    perm.forEach((id, p) => { if (id >= 0) donde[id].push(p); });
    const faltan = donde.map((d, id) => (d.length === 0 ? id : -1)).filter((x) => x >= 0);
    donde.forEach((d, id) => {
      if (d.length > 1) {
        errores.push(`La ${tipo(orb)} ${nombrePieza(orb, id)} aparece ${d.length} veces (en ${d.map((p) => nombrePos(lista[p])).join(' y ')})${faltan.length ? ` y falta${faltan.length > 1 ? 'n' : ''} ${faltan.map((x) => `la ${nombrePieza(orb, x)}`).join(', ')}` : ''}.`);
      }
    });
  });
  if (errores.length) return { valido: false, errores };
  // 4. restricciones demostradas (Schreier–Sims, ver DECISIONES.md)
  const [esq, ari] = orbitas;
  if (esq.ori.reduce((a, b) => a + b, 0) % 3 !== 0) errores.push('Hay una esquina girada: la suma de los giros de las esquinas no es múltiplo de 3 (alguna esquina está girada 120° respecto a lo posible).');
  if (ari.ori.reduce((a, b) => a + b, 0) % 2 !== 0) errores.push('Hay una arista volteada: el número de aristas volteadas es impar.');
  if (paridad(esq.perm)) errores.push('La permutación de las esquinas es impar (por ejemplo, dos esquinas intercambiadas): es imposible, porque cada giro mueve las esquinas en ciclos de 5.');
  if (paridad(ari.perm)) errores.push('La permutación de las aristas es impar (por ejemplo, dos aristas intercambiadas): es imposible, porque cada giro mueve las aristas en ciclos de 5.');
  return { valido: errores.length === 0, errores };
}

// ---------- Notación ----------
function invertirMovimiento(m) {
  if (m.endsWith('++')) return m.slice(0, -2) + '--';
  if (m.endsWith('--')) return m.slice(0, -2) + '++';
  if (m.endsWith("2'")) return m.slice(0, -1);
  if (m.endsWith('2')) return m + "'";
  return m.endsWith("'") ? m.slice(0, -1) : m + "'";
}

/** En una solución: dos giros de la misma cara separados solo por caras que conmutan con ella. */
function buscarRedundanciaSolucion(movs) {
  const g = movs.map((m) => partirGiro(m));
  for (let i = 0; i < g.length; i++) {
    if (!g[i]) return `movimiento desconocido en la posición ${i + 1} (${movs[i]})`;
    for (let j = i + 1; j < g.length; j++) {
      if (!g[j]) break;
      if (g[j].f === g[i].f) return `${movs[i]} (posición ${i + 1}) y ${movs[j]} (posición ${j + 1}) se pueden unir`;
      if (ADY[g[j].f][g[i].f]) break;
    }
  }
  return null;
}

// ---------- Dibujo ----------
const VISTAS = [
  { id: 'red', nombre: 'Red' },
  { id: 'arriba', nombre: 'Arriba (U)' },
  { id: 'abajo', nombre: 'Abajo (D)' },
];
const caraArriba = new Set([IDX.U, IDX.F, IDX.R, IDX.BR, IDX.BL, IDX.L]);
const SOLO = {
  arriba: geo.pegatinas.map((p, i) => (caraArriba.has(p.cara) ? i : -1)).filter((i) => i >= 0),
  abajo: geo.pegatinas.map((p, i) => (!caraArriba.has(p.cara) ? i : -1)).filter((i) => i >= 0),
};

const CAJA_RED = cajaDe(geo.pegatinas2D.map((q) => q.poligono));
const claro = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
};
/** Letra de cada cara sobre su centro (texto SVG; no capta los toques). */
function etiquetasCentros(estado, solo) {
  const tam = (CAJA_RED.x1 - CAJA_RED.x0) * 0.036;
  let txt = '';
  CENTROS.forEach((i, f) => {
    if (solo && !solo.includes(i)) return;
    const pol = geo.pegatinas2D[i].poligono;
    const x = pol.reduce((a, q) => a + q[0], 0) / pol.length, y = pol.reduce((a, q) => a + q[1], 0) / pol.length;
    const col = PALETA_MEGA[estado[i]];
    const fill = !col || claro(col.hex) ? '#111' : '#fff';
    txt += `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${tam.toFixed(3)}" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" fill="${fill}" pointer-events="none">${CARAS[f]}</text>`;
  });
  return txt;
}

function renderizar(estado, opciones = {}) {
  const solo = SOLO[opciones.vista] || null;
  const svg = svgDePegatinas(geo.pegatinas2D, estado, PALETA_MEGA, { ...opciones, solo, margen: solo ? 0.04 : 0.06, grosor: 0.5 });
  return opciones.etiquetas ? svg.replace('</svg>', etiquetasCentros(estado, solo) + '</svg>') : svg;
}

/** Red con el nombre de cada cara en su centro (leyenda de la notación). */
function leyendaNotacion() {
  return {
    svg: renderizar(geo.resuelto, { etiquetas: true }),
    texto: 'Cada letra es una cara: la del centro con esa letra (a la izquierda, U y las de su alrededor vistas desde arriba; a la derecha, D y las suyas vistas desde abajo). '
      + 'R = 72° en sentido horario mirando la cara R de frente; R\' = 72° antihorario; R2 = 144° horario; R2\' = 144° antihorario. Cada giro cuenta 1. '
      + 'Arriba: U; a su alrededor, en sentido horario: F (delante), R, BR, BL, L. Abajo: D; a su alrededor: DR (bajo F y R), DBR, B (detrás, opuesta a F), DBL, DL. '
      + 'Durante la reproducción, el editor muestra estas letras en los centros.',
  };
}

function estaResuelto(e) {
  const color = new Array(12).fill(-1);
  for (let i = 0; i < e.length; i++) {
    const f = caraDe[i];
    if (color[f] < 0) color[f] = e[i];
    else if (color[f] !== e[i]) return false;
  }
  return true;
}

// ---------- Puzzle ----------
export default definirPuzzle({
  id: 'megaminx',
  nombre: 'Megaminx',
  capacidades: { scramble: true, validar: true, resolver: true, editar: true },
  tipoScramble: 'movimientos aleatorios (Pochmann)',
  longitudScramble: LINEAS * (POR_LINEA + 1),
  descripcion: 'Por etapas con búsqueda (IDA*): la cara D y el anillo inferior, después las piezas de F y R, y la última capa con dos macros buscadas automáticamente. Notación de caras (ver la leyenda); cualquier giro de una cara cuenta 1.',
  avisoInicializacion: 'Generando las tablas del Megaminx…',
  paleta: PALETA_MEGA,
  estadoResuelto: () => geo.resuelto.slice(),
  aplicarMovimiento(e, m) {
    if (!geo.perms[m]) throw new Error(`Movimiento no válido: "${m}"`);
    return geo.aplicar(e, m);
  },
  estaResuelto,
  invertirMovimiento,
  infoMovimiento(m) {
    if (POCHMANN.test(m)) return { eje: m[0] === 'R' ? 'R' : 'UD', clave: m[0] };
    const g = partirGiro(m);
    if (!g) throw new Error(`Movimiento no válido: "${m}"`);
    return { eje: 'cara-' + g.cara, clave: g.cara };
  },
  buscarRedundanciaSolucion,
  formatear(movs) {
    if (!movs.some((m) => POCHMANN.test(m) && m[0] !== 'U')) return movs.join(' ');
    // scramble: una línea por cada U / U'
    const lineas = [];
    let actual = [];
    for (const m of movs) {
      actual.push(m);
      if (m[0] === 'U') { lineas.push(actual.join(' ')); actual = []; }
    }
    if (actual.length) lineas.push(actual.join(' '));
    return lineas.join('\n');
  },
  renderizar,
  vistasEditor: VISTAS,
  pegatinasEditables: () => geo.pegatinas.map((_, i) => i),
  herramientas: [{ id: 'rellenar', nombre: 'Rellenar cara', icono: '⬟', toques: 1, usaColor: true, titulo: 'Toca una pegatina para pintar toda su cara con el último color elegido' }],
  usarHerramienta(estado, id, indices, contexto = {}) {
    if (id !== 'rellenar') throw new Error(`Herramienta desconocida: ${id}`);
    const color = contexto.color ?? 0;
    const f = caraDe[indices[0]];
    return estado.map((c, i) => (caraDe[i] === f ? color : c));
  },
  leyendaNotacion,
  validar,
  inicializar() { return inicializarSolver(); },
  estaInicializado: solverInicializado,
  resolver(estado, opciones = {}) {
    const t0 = Date.now();
    const v = validar(estado);
    if (!v.valido) return { ok: false, errores: v.errores, ms: Date.now() - t0 };
    const e = reetiquetar(estado, sigmaDeCentros(estado));
    const r = resolverMegaminx(e, opciones);
    // comprobación interna: la solución debe resolver el estado del usuario
    let x = estado;
    for (const m of r.movimientos) x = geo.aplicar(x, m);
    if (!estaResuelto(x)) return { ok: false, errores: ['Error interno: la solución calculada no resuelve el puzzle.'], ms: Date.now() - t0 };
    return { ok: true, movimientos: r.movimientos, fases: r.fases, orientaciones: r.orientacionesProbadas, ms: Date.now() - t0 };
  },
  describirLongitud(movs) {
    if (movs.some((m) => POCHMANN.test(m) && m[0] !== 'U')) return `${movs.length} movimientos (Pochmann)`;
    return `${movs.length} giro${movs.length === 1 ? '' : 's'} de cara`;
  },
  generarScramble,
  geo,
  etapas: ETAPAS,
  movsCara: MOVS_CARA,
});
