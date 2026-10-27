// 3x3: validador, solucionador de dos fases (Kociemba) y scramble de estado aleatorio.

import { definirPuzzle } from '../core/puzzle.js';
import { crearModeloPiezas } from '../core/piezas.js';
import { reetiquetar, cierreGrupo } from '../core/simetria.js';
import { aplicarPerm, componer } from '../core/perm.js';
import { barajar, entero, rngSeguro } from '../core/rng.js';
import { baseNxN } from './nxn.js';
import {
  piezasCubo, NOMBRES_ESQUINAS, NOMBRES_ARISTAS, comprobarConteo, erroresDePiezas, nombreColor,
} from './cubo-comun.js';
import {
  inicializarKociemba, kociembaListo, msTablasKociemba, resolverKociemba, cuboDesdeIdentificacion, paridad8,
  inversaCubo,
} from './kociemba.js';

const b = baseNxN(3);
const { esquinas, aristas } = piezasCubo(3);
const RESUELTO = b.estadoResuelto();
const modelo = crearModeloPiezas({
  orbitas: [{ nombre: 'esquinas', piezas: esquinas }, { nombre: 'aristas', piezas: aristas }],
  movimientos: {},
  coloresResuelto: RESUELTO,
});
const coloresPieza = [
  esquinas.map((pz) => pz.map((f) => RESUELTO[f])),
  aristas.map((pz) => pz.map((f) => RESUELTO[f])),
];
const CENTROS = [4, 13, 22, 31, 40, 49];
// Rotación de 120° alrededor de la diagonal URF–DBL (U→R→F→U), para buscar
// la solución también desde otras dos orientaciones del cubo.
const CARA_DE = (i) => Math.floor(i / 9);
const ROT_URF = (() => {
  const g = cierreGrupo([b.geo.rot.x, b.geo.rot.y]);
  const mapaDe = (P) => CENTROS.map((c) => CARA_DE(P.indexOf(c)));
  for (const P of g) {
    const m = mapaDe(P);
    if (m[0] === 1 && m[1] === 2 && m[2] === 0) return P;
  }
  throw new Error('no se encontró la rotación URF');
})();

/** Variantes (3 orientaciones x normal/inversa) de un estado ya normalizado. */
function variantes(norm, cubo) {
  const res = [{ cubo }, { cubo: inversaCubo(cubo), inversa: true }];
  let P = ROT_URF;
  for (let k = 1; k <= 2; k++) {
    const rot = aplicarPerm(norm, P);
    const sigma = new Array(6);
    CENTROS.forEach((c, f) => { sigma[rot[c]] = f; });
    const v = reetiquetar(rot, sigma);
    const c = cuboDesdeIdentificacion(modelo.identificar(v).orbitas);
    // la cara f del original pasa a ser la cara gk(f) de la variante
    const gk = CENTROS.map((cc) => CARA_DE(P.indexOf(cc)));
    const mapa = new Array(6);
    gk.forEach((h, f) => { mapa[h] = f; });
    res.push({ cubo: c, mapa }, { cubo: inversaCubo(c), mapa, inversa: true });
    P = componer(P, ROT_URF);
  }
  return res;
}
const NOMBRE_CARA = ['arriba (U)', 'derecha (R)', 'delante (F)', 'abajo (D)', 'izquierda (L)', 'detrás (B)'];

/** Comprueba los centros y devuelve la permutación de colores que los deja en su sitio. */
function analizarCentros(estado) {
  const c = CENTROS.map((i) => estado[i]);
  const errores = [];
  if (new Set(c).size !== 6) {
    errores.push('Los seis centros deben tener seis colores distintos.');
    return { errores };
  }
  for (let f = 0; f < 3; f++) {
    if ((c[f] + 3) % 6 !== c[f + 3]) {
      errores.push(`Los centros de ${NOMBRE_CARA[f]} (${nombreColor(c[f])}) y ${NOMBRE_CARA[f + 3]} (${nombreColor(c[f + 3])}) deberían ser colores opuestos (blanco–amarillo, rojo–naranja, verde–azul).`);
    }
  }
  if (errores.length) return { errores };
  // sigma[colorPintado] = cara. Debe ser una rotación (no una reflexión): la
  // esquina URF formada por los centros U, R, F tiene que existir.
  const sigma = new Array(6);
  c.forEach((col, f) => { sigma[col] = f; });
  const urf = [c[0], c[1], c[2]];
  const existe = coloresPieza[0].some((s) => [0, 1, 2].some((r) => s.every((x, j) => x === urf[(j + r) % 3])));
  if (!existe) {
    errores.push('Los centros están colocados como en la imagen especular de un cubo real (revisa los colores de los centros).');
    return { errores };
  }
  return { errores, sigma };
}

function analizar(estado) {
  let errores = comprobarConteo(estado, 9);
  if (errores.length) return { valido: false, errores };
  const cen = analizarCentros(estado);
  if (cen.errores.length) return { valido: false, errores: cen.errores };
  const norm = reetiquetar(estado, cen.sigma);
  const ident = modelo.identificar(norm);
  // Los mensajes de piezas usan los colores originales del usuario
  const identOrig = {
    errores: ident.errores.map((e) => ({ ...e, colores: e.colores.map((x) => cen.sigma.indexOf(x)) })),
    orbitas: ident.orbitas,
  };
  const colPiezaOrig = coloresPieza.map((o) => o.map((s) => s.map((x) => cen.sigma.indexOf(x))));
  errores = erroresDePiezas(identOrig, [NOMBRES_ESQUINAS, NOMBRES_ARISTAS], ['esquina', 'arista'], colPiezaOrig);
  if (errores.length) return { valido: false, errores };
  const [E, A] = ident.orbitas;
  const giro = E.ori.reduce((a, x) => a + x, 0) % 3;
  const volteo = A.ori.reduce((a, x) => a + x, 0) % 2;
  if (giro !== 0) {
    errores.push(`Una esquina está girada: la suma de las orientaciones de las esquinas no es múltiplo de 3 (sobra ${giro === 1 ? 'un giro horario' : 'un giro antihorario'}).`);
  }
  if (volteo !== 0) {
    errores.push('Una arista está volteada: hay un número impar de aristas mal orientadas.');
  }
  if (paridad8(E.perm) !== paridad8(A.perm)) {
    errores.push('Dos piezas están intercambiadas: la paridad de la permutación de las esquinas no coincide con la de las aristas.');
  }
  if (errores.length) return { valido: false, errores };
  return { valido: true, errores: [], cubo: cuboDesdeIdentificacion(ident.orbitas), norm };
}

function resolver(estado, opciones = {}) {
  const t0 = performance.now();
  const msTablas = inicializarKociemba();
  const a = analizar(estado);
  if (!a.valido) return { ok: false, errores: a.errores };
  const r = resolverKociemba(variantes(a.norm, a.cubo), { objetivo: opciones.objetivo ?? 20, msMax: opciones.msMax ?? 1000 });
  if (!r) return { ok: false, errores: ['No se encontró solución (esto no debería pasar).'] };
  return { ok: true, movimientos: r.movimientos, ms: performance.now() - t0 - msTablas };
}

/** Estado aleatorio uniforme como cubies. */
function cuboAleatorio(rng) {
  const cp = barajar(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  const ep = barajar(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  if (paridad8(cp) !== paridad8(ep)) { const t = ep[0]; ep[0] = ep[1]; ep[1] = t; }
  const co = new Array(8), eo = new Array(12);
  let s = 0;
  for (let i = 0; i < 7; i++) { co[i] = entero(rng, 3); s += co[i]; }
  co[7] = (3 - (s % 3)) % 3;
  s = 0;
  for (let i = 0; i < 11; i++) { eo[i] = entero(rng, 2); s += eo[i]; }
  eo[11] = s % 2;
  return { cp, co, ep, eo };
}

function cuboAPegatinas(c) {
  return modelo.aColores([{ perm: c.cp, ori: c.co }, { perm: c.ep, ori: c.eo }], RESUELTO);
}

function generarScramble(rng = rngSeguro(), opciones = {}) {
  inicializarKociemba();
  for (;;) {
    const c = cuboAleatorio(rng);
    const r = resolverKociemba(variantes(cuboAPegatinas(c), c), { objetivo: opciones.objetivo ?? 21, msMax: opciones.msMax ?? 1000 });
    if (r.movimientos.length < 2) continue; // como TNoodle: mínimo 2 movimientos
    return r.movimientos.slice().reverse().map(b.invertirMovimiento);
  }
}

export default definirPuzzle({
  id: '3x3',
  nombre: '3x3',
  capacidades: { scramble: true, validar: true, resolver: true, editar: true },
  descripcion: 'Algoritmo de dos fases de Kociemba (soluciones de ~20 movimientos).',
  tipoScramble: 'estado aleatorio',
  paleta: b.paleta,
  estadoResuelto: b.estadoResuelto,
  aplicarMovimiento: b.aplicarMovimiento,
  estaResuelto: b.estaResuelto,
  invertirMovimiento: b.invertirMovimiento,
  infoMovimiento: b.infoMovimiento,
  buscarRedundancia: b.buscarRedundancia,
  renderizar: b.renderizar,
  pegatinasEditables: () => RESUELTO.map((_, i) => i),
  inicializar: () => { inicializarKociemba(); return { ms: msTablasKociemba() }; },
  estaInicializado: kociembaListo,
  avisoInicializacion: 'Generando las tablas de Kociemba en el navegador…',
  validar: (e) => { const a = analizar(e); return { valido: a.valido, errores: a.errores }; },
  resolver,
  generarScramble,
  estadoAleatorio: (rng) => cuboAPegatinas(cuboAleatorio(rng)),
});
