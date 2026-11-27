// @ts-check
// Cuboides (noche 15): crearCuboide(a, b, c) da un puzzle completo de la interfaz común a partir de
// sus medidas (a = ancho x, b = fondo z, c = alto y). Añadir un cuboide = una línea en el registro.
//
//  - Geometría, giros legales, rotaciones y piezas: cuboide-geo.js (todo deducido de las medidas).
//  - Grupo, órbitas y restricciones demostradas: cuboide-grupo.js (Schreier–Sims).
//  - Solver óptimo y estado aleatorio: cuboide-solver.js.
//
// Orientación libre: el puzzle se puede pintar o colocar sujetado de cualquier forma. El validador
// prueba los reetiquetados de colores de las rotaciones que conservan la forma (como el Skewb) y se
// queda con uno en el que el estado pertenece al grupo de los giros de búsqueda. La solución vale
// en la orientación del usuario: deja cada cara de un color.

import { definirPuzzle } from '../core/puzzle.js';
import { svgDePegatinas } from '../core/render.js';
import { permutacionesDeColor, reetiquetar } from '../core/simetria.js';
import { aplicarPerm } from '../core/perm.js';
import { rngSeguro } from '../core/rng.js';
import { PALETA_CUBO } from './nxn.js';
import { crearGeoCuboide, CARAS } from './cuboide-geo.js';
import { crearGrupoCuboide } from './cuboide-grupo.js';
import { crearSolverCuboide } from './cuboide-solver.js';

/**
 * @import { EstadoPegatinas, ResultadoResolver, Rng, Movimiento, ResultadoAprender } from '../core/tipos.js'
 */

const PLURAL = /** @type {Record<string, string>} */ ({ esquina: 'esquinas', arista: 'aristas', centro: 'centros' });
/** color como adjetivo de «pegatina» @param {string} c */
const femenino = (c) => c.replace(/o$/, 'a');
const FEMENINO = /** @type {Record<string, boolean>} */ ({ esquina: true, arista: true, centro: false });

/**
 * @param {number} a ancho (x: R/L)
 * @param {number} b fondo (z: F/B)
 * @param {number} c alto (y: U/D)
 * @param {{ id?: string, nombre?: string, descripcion?: string, costeScramble?: number, metodosAprender?: Array<{ id: string, nombre: string, descripcion: string }>, aprender?: (estado: EstadoPegatinas, metodo?: string) => ResultadoAprender }} [opciones]
 */
export function crearCuboide(a, b, c, opciones = {}) {
  // (cuboide-geo.js no está tipado: sus tablas se usan como objetos de datos)
  const G = /** @type {any} */ (crearGeoCuboide(a, b, c));
  const id = opciones.id || `${a}x${b}x${c}`;
  const nombre = opciones.nombre || id;
  const RESUELTO = /** @type {EstadoPegatinas} */ (G.resuelto.slice());
  const n = G.n;
  const porCara = CARAS.map((_, f) => G.caraDe.filter((/** @type {number} */ x) => x === f).length);
  const rep = CARAS.map((_, f) => G.caraDe.indexOf(f));
  const SIGMAS = permutacionesDeColor(G.geo.rotaciones, RESUELTO, rep);

  // grupo y solver: al pedirlos (Schreier–Sims ~10–40 ms; las tablas, en inicializar)
  /** @type {any} */
  let grupo = null;
  /** @type {any} */
  let solver = null;
  const obtenerGrupo = () => (grupo ||= crearGrupoCuboide(G));
  const obtenerSolver = () => (solver ||= crearSolverCuboide(G, obtenerGrupo()));

  /** @param {number} col */
  const nombreColor = (col) => (PALETA_CUBO[col] ? PALETA_CUBO[col].nombre : 'sin color');
  /** @param {number[]} cs */
  const lista = (cs) => cs.map(nombreColor).join('-');
  /** @param {number} h */
  const pos = (h) => G.piezas[h].nombre;
  /** @param {number} j @param {number[]} [sigmaInv] colores de la pieza j tal como los pintó el usuario */
  const coloresUsuario = (j, sigmaInv) => obtenerGrupo().coloresPieza[j].map((/** @type {number} */ x) => (sigmaInv ? sigmaInv[x] : x));

  /**
   * Mensajes de los errores de una identificación (con el reetiquetado sigma).
   * @param {any[]} errores @param {number[]} sigma @param {number[]} colores (los del usuario)
   */
  function mensajes(errores, sigma, colores) {
    const sigmaInv = /** @type {number[]} */ ([]);
    sigma.forEach((x, i) => { sigmaInv[x] = i; });
    /** @type {string[]} */
    const r = [];
    for (const e of errores) {
      const tipo = e.pieza !== undefined ? G.piezas[e.pieza].tipo : G.piezas[e.hueco].tipo;
      const la = FEMENINO[tipo] ? 'La' : 'El';
      if (e.tipo === 'inexistente') {
        const cs = G.piezas[e.hueco].pegatinas.map((/** @type {number} */ i) => colores[i]);
        const repe = new Set(cs).size < cs.length;
        const opuestos = cs.some((/** @type {number} */ x) => cs.some((/** @type {number} */ y) => (x + 3) % 6 === y));
        r.push(`La pieza en ${pos(e.hueco)} (${lista(cs)}) no existe en un ${nombre}${repe ? ' (tiene un color repetido)' : opuestos ? ' (tiene dos colores de caras opuestas)' : ''}.`);
      } else if (e.tipo === 'repetida') r.push(`${la} ${tipo} ${lista(coloresUsuario(e.pieza, sigmaInv))} aparece ${e.veces} veces.`);
      else if (e.tipo === 'falta') r.push(`Falta ${FEMENINO[tipo] ? 'la' : 'el'} ${tipo} ${lista(coloresUsuario(e.pieza, sigmaInv))}.`);
      else if (e.tipo === 'especular') {
        const cs = G.piezas[e.hueco].pegatinas.map((/** @type {number} */ i) => colores[i]);
        r.push(`${la} ${tipo} en ${pos(e.hueco)} (${lista(cs)}) tiene los colores en un orden imposible: es la imagen especular de una pieza real.`);
      } else if (e.tipo === 'orbita') {
        const huecos = [...obtenerGrupo().colocaciones[e.pieza].keys()];
        const donde = huecos.length === 1 ? `nunca sale de su sitio (${pos(huecos[0])})` : `solo puede estar en ${huecos.map(pos).join(', ')}`;
        r.push(`${la} ${tipo} ${lista(coloresUsuario(e.pieza, sigmaInv))} no puede estar en ${pos(e.hueco)}: en el ${nombre} esa pieza ${donde}.`);
      } else if (e.tipo === 'orientacion') {
        const t = e.correcta;
        const col = sigmaInv[obtenerGrupo().coloresPieza[e.pieza][0]];
        const cara = CARAS[G.caraDe[t[0]]];
        // girada: una esquina de 3 pegatinas; volteada: las demás (dos pegatinas, o arriba y abajo a la vez)
        const verbo = G.piezas[e.pieza].pegatinas.length === 3 && tipo === 'esquina' ? 'girada' : 'volteada';
        r.push(`${la} ${tipo} ${lista(coloresUsuario(e.pieza, sigmaInv))} en ${pos(e.hueco)} está ${FEMENINO[tipo] ? verbo : verbo.replace(/a$/, 'o')}: en esa posición su pegatina ${femenino(nombreColor(col))} tiene que estar en la cara ${cara}.`);
      }
    }
    return r;
  }

  /** Mensaje de una restricción incumplida (rasgos ℤ₂ de crearGrupoCuboide) para el estado img. */
  function mensajeRestriccion(/** @type {any} */ restr, /** @type {Int16Array} */ img) {
    const Gr = obtenerGrupo();
    const { volteo } = Gr.huecosYVolteos(img);
    const v = Gr.rasgos(img);
    /** @type {Map<string, { paridad: number | null, volteadas: number, hayVolteo: boolean }>} */
    const porTipo = new Map();
    restr.rasgos.forEach((/** @type {any} */ x) => {
      const o = Gr.orbitas[x.orbita];
      const k = PLURAL[o.tipo];
      if (!porTipo.has(k)) porTipo.set(k, { paridad: null, volteadas: 0, hayVolteo: false });
      const t = /** @type {{ paridad: number | null, volteadas: number, hayVolteo: boolean }} */ (porTipo.get(k));
      if (x.tipo === 'paridad') t.paridad = v[Gr.rasgosDef.indexOf(x)];
      else { t.hayVolteo = true; t.volteadas += o.piezas.reduce((/** @type {number} */ s, /** @type {number} */ j) => s + volteo[j], 0); }
    });
    const partes = [];
    for (const [k, t] of porTipo) {
      if (t.paridad !== null) partes.push({ texto: `la permutación de las ${k} es ${t.paridad ? 'impar' : 'par'}`, regla: `la paridad de la permutación de las ${k}` });
      if (t.hayVolteo) partes.push({ texto: `hay ${t.volteadas} ${k.replace(/s$/, '')}${t.volteadas === 1 ? '' : 's'} volteada${t.volteadas === 1 ? '' : 's'}`, regla: `la del número de ${k} volteadas` });
    }
    if (partes.length === 1) {
      const p = partes[0];
      if (p.regla.startsWith('la paridad')) return `Hay dos piezas intercambiadas: ${p.texto}, y en el ${nombre} siempre es par.`;
      return `Hay una pieza volteada: ${p.texto}, y en el ${nombre} siempre es un número par.`;
    }
    return `Paridad imposible: ${partes.map((p) => p.texto).join(' y ')}. En el ${nombre} ${partes.map((p) => p.regla).join(' y ')} siempre coinciden (por ejemplo, dos piezas intercambiadas sin nada volteado no se puede).`;
  }

  /**
   * @param {EstadoPegatinas} estado
   * @returns {{ valido: false, errores: string[] } | { valido: true, errores: string[], img: Int16Array, sigma: number[] }}
   */
  function analizar(estado) {
    /** @type {string[]} */
    const errores = [];
    if (!Array.isArray(estado) || estado.length !== n) return { valido: false, errores: [`El estado debe tener ${n} pegatinas.`] };
    const cuenta = new Array(6).fill(0);
    let vacias = 0;
    for (const col of estado) { if (col >= 0 && col < 6) cuenta[col]++; else vacias++; }
    if (vacias) errores.push(`Hay ${vacias} pegatina${vacias > 1 ? 's' : ''} sin pintar.`);
    // cuántas de cada color: las de su cara en el resuelto (en un cuboide las caras no miden lo mismo:
    // el número dice ya qué colores van en las caras grandes)
    cuenta.forEach((k, col) => { if (k !== porCara[col]) errores.push(`Hay ${k} pegatina${k === 1 ? '' : 's'} de color ${nombreColor(col)} y debería haber ${porCara[col]}.`); });
    if (errores.length) return { valido: false, errores };
    const Gr = obtenerGrupo();
    /** @type {{ peso: number[], errores: string[] } | null} */
    let mejor = null;
    for (const sigma of SIGMAS) {
      const norm = reetiquetar(estado, sigma);
      const id = Gr.identificar(norm);
      if (id.errores.length) {
        const m = mensajes(id.errores, sigma, estado);
        const peso = [id.errores.length, 0];
        if (!mejor || menor(peso, mejor.peso)) mejor = { peso, errores: m };
        continue;
      }
      if (Gr.cadena.contiene(id.img)) return { valido: true, errores: [], img: id.img, sigma };
      const inc = Gr.incumplidas(id.img);
      const m = inc.length ? inc.map((/** @type {any} */ r) => mensajeRestriccion(r, id.img)) : [`Este estado no se puede alcanzar con giros del ${nombre}.`];
      const peso = [0, Math.max(1, inc.length)];
      if (!mejor || menor(peso, mejor.peso)) mejor = { peso, errores: m };
    }
    return { valido: false, errores: mejor ? mejor.errores : ['Estado no válido.'] };
  }

  /** @param {number[]} x @param {number[]} y */
  const menor = (x, y) => x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]);

  /** @param {EstadoPegatinas} estado @returns {ResultadoResolver} */
  function resolver(estado) {
    const t0 = performance.now();
    const an = analizar(estado);
    if (!an.valido) return { ok: false, errores: an.errores };
    const r = obtenerSolver().resolverImg(an.img);
    if (!r) return { ok: false, errores: ['No se encontró solución (esto no debería pasar).'] };
    return { ok: true, movimientos: r.movimientos, ms: performance.now() - t0 };
  }

  /** @param {Movimiento} m */
  function invertirMovimiento(m) {
    const k = G.canonico(m);
    if (!k) throw new Error(`Movimiento no válido: "${m}"`);
    const d = G.movimientos[k];
    if (d.vueltas === 2) return k;
    return d.vueltas === 1 ? k + "'" : k.slice(0, -1);
  }

  /**
   * Scramble de estado aleatorio: un elemento uniforme del grupo (Schreier–Sims), su solución óptima
   * y la inversa. Devuelve también el estado elegido (colores) para comprobar que es exacto.
   * @param {Rng} rng
   */
  function scrambleDetallado(rng) {
    const S = obtenerSolver();
    S.inicializar();
    const Gr = obtenerGrupo();
    for (;;) {
      const img = S.imgAleatoria(rng);
      const r = S.resolverImg(img);
      if (!r || r.movimientos.length === 0) continue; // el resuelto (o una rotación suya) no es un scramble
      return { movimientos: r.movimientos.slice().reverse().map(invertirMovimiento), estado: Gr.coloresDe(img), img };
    }
  }

  const caraDe = G.caraDe;
  /** generadores de «Colocar piezas»: un giro de cada capa exterior y las rotaciones (orientación libre) */
  const generadoresColocar = [...new Set([...G.exteriores, ...G.rotaciones].map((m) => {
    const d = G.movimientos[m];
    return d.vueltas === 2 ? m : d.base;
  }))];

  return definirPuzzle({
    id,
    nombre,
    capacidades: { scramble: true, validar: true, resolver: true, editar: true },
    descripcion: opciones.descripcion || `Solución óptima con ${G.busqueda.filter((/** @type {string} */ m) => G.movimientos[m].vueltas !== 3).join(', ')} (cada giro cuenta 1).`,
    tipoScramble: 'estado aleatorio',
    costeScramble: opciones.costeScramble ?? 50,
    paleta: PALETA_CUBO,
    estadoResuelto: () => /** @type {EstadoPegatinas} */ (RESUELTO.slice()),
    aplicarMovimiento(e, m) {
      const k = G.canonico(m);
      if (!k) throw new Error(`Movimiento no válido: "${m}"`);
      return /** @type {EstadoPegatinas} */ (aplicarPerm(e, G.movimientos[k].perm));
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
      const k = G.canonico(m);
      if (!k) throw new Error(`Movimiento no válido: "${m}"`);
      const d = G.movimientos[k];
      return { eje: d.j === null ? 'rot-' + d.eje : d.eje, clave: d.base };
    },
    // los alias (R en el 3x3x2, R2 en el 3x3x1…) se leen en la notación canónica del puzzle
    parsear: (texto) => texto.trim().split(/\s+/).filter(Boolean).map((m) => G.canonico(m) || m),
    renderizar(estado, opciones = {}) {
      return svgDePegatinas(G.geo.pegatinas2D, estado, PALETA_CUBO, opciones);
    },
    pegatinasEditables: () => RESUELTO.map((_, i) => i),
    inicializar: () => obtenerSolver().inicializar(),
    estaInicializado: () => !!solver && solver.estaInicializado(),
    validar: (e) => { const r = analizar(e); return { valido: r.valido, errores: r.errores }; },
    resolver,
    generarScramble: (rng = rngSeguro()) => scrambleDetallado(rng).movimientos,
    colocarPiezas: {
      generadores: generadoresColocar,
      nombreTipo: (pegs) => {
        const t = G.piezas[G.piezaDePegatina[pegs[0]]].tipo;
        return [PLURAL[t][0].toUpperCase() + PLURAL[t].slice(1), t];
      },
    },
    ...(opciones.metodosAprender ? { metodosAprender: opciones.metodosAprender, aprender: opciones.aprender } : {}),
    ...G.modelo3D,
    // propio: geometría, grupo, solver y utilidades para los tests y scripts
    cuboide: { G, grupo: obtenerGrupo, solver: obtenerSolver, analizar, scrambleDetallado, sigmas: SIGMAS },
  });
}
