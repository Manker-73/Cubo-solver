// @ts-check
// Registro de puzzles. Para añadir un puzzle nuevo: crear su módulo (que exporte un puzzle hecho con
// definirPuzzle, o una función que lo construya) y añadir aquí su entrada.
// La interfaz y los tests no necesitan ningún otro cambio.
//
// Registro PEREZOSO (sesión «carga más rápida», 27/11/2026): cada entrada dice lo que la portada y los
// selectores necesitan (id, nombre, categoría, coste del scramble y capacidades) SIN construir el puzzle.
// Se construye la primera vez que se pide con `cargarPuzzle(id)`: es asíncrona porque su módulo se carga
// con import() y así tampoco se ejecuta hasta entonces el código de nivel superior del módulo (geometrías,
// piezas). Antes, al abrir la página se construían los 16, en la página y otra vez en el Worker (~0,35 s
// de CPU en un portátil, ~1,7 s en un móvil; ver docs/investigacion-carga.md). En el build (un solo
// fichero), esbuild deja cada módulo cargado con import() en una función que se ejecuta al pedirlo.
// Una vez cargado, `puzzleCargado(id)` lo da sin esperar. El test del registro comprueba que cada entrada
// coincide con su puzzle construido (nombre, coste, capacidades).
//
// `categoria`: sección de la app en la que aparece cada puzzle (ver src/app/secciones.js): 'wca' = WCA
// Puzzles, 'cuboids' = Cuboids (noche 15), 'shapemods' = Shape Mods (noche 16). Es un dato del registro,
// no de la interfaz común: los módulos de los puzzles no lo conocen. El 3x3 vendado (Bandaged Cubes) es el
// 3x3 de esta lista envuelto por puzzleConBloqueos; el 4x4 y el 5x5 vendados (noche 13), los de esta lista
// con el estado de identidades (nxn-identidad.js), en BANDAGED.

/** @import { Categoria, Capacidades, EntradaRegistro, EntradaBandaged, PuzzleRegistrado, PuzzlePronto, Puzzle, EstadoPegatinas } from '../core/tipos.js' */

/** @type {Capacidades} */
const TODAS = { scramble: true, validar: true, resolver: true, editar: true };

/**
 * Entradas de una categoría.
 * @param {Categoria} categoria
 * @param {Array<Omit<EntradaRegistro, 'categoria'>>} lista
 * @returns {EntradaRegistro[]}
 */
const conCategoria = (categoria, lista) => lista.map((e) => ({ ...e, categoria }));

/** Un cubo NxN grande (4x4–7x7): todos de cubo-grande.js. @param {number} n @returns {Omit<EntradaRegistro, 'categoria'>} */
const cuboGrande = (n) => ({
  id: `${n}x${n}`, nombre: `${n}x${n}`, costeScramble: 0, capacidades: TODAS,
  crear: async () => (await import('./cubo-grande.js')).crearCuboGrande(n),
});

/**
 * Cuboids (noche 15): a = ancho (R/L), b = fondo (F/B), c = alto (U/D); las caras cuadradas arriba y abajo.
 * Un cuboide más (2x2x4, 3x3x4…) es una línea aquí: crearCuboide deduce todo de las medidas.
 * @param {number} a @param {number} b @param {number} c @param {string} nombre @param {number} costeScramble
 * @returns {Omit<EntradaRegistro, 'categoria'>}
 */
const cuboide = (a, b, c, nombre, costeScramble) => {
  const id = `${a}x${b}x${c}`;
  return { id, nombre, costeScramble, capacidades: TODAS, crear: async () => (await import('./cuboide.js')).crearCuboide(a, b, c, { id, nombre, costeScramble }) };
};

/** @type {EntradaRegistro[]} */
export const REGISTRO = conCategoria('wca', [
  { id: '2x2', nombre: '2x2', costeScramble: 300, capacidades: TODAS, crear: async () => (await import('./cubo2.js')).default },
  { id: '3x3', nombre: '3x3', costeScramble: 800, capacidades: TODAS, crear: async () => (await import('./cubo3.js')).default },
  cuboGrande(4),
  cuboGrande(5),
  cuboGrande(6),
  cuboGrande(7),
  { id: 'pyraminx', nombre: 'Pyraminx', costeScramble: 250, capacidades: TODAS, crear: async () => (await import('./pyraminx.js')).default },
  { id: 'skewb', nombre: 'Skewb', costeScramble: 100, capacidades: TODAS, crear: async () => (await import('./skewb.js')).default },
  { id: 'square1', nombre: 'Square-1', costeScramble: 1200, capacidades: TODAS, crear: async () => (await import('./square1.js')).default },
  { id: 'megaminx', nombre: 'Megaminx', costeScramble: 0, capacidades: TODAS, crear: async () => (await import('./megaminx.js')).default },
  { id: 'fto', nombre: 'FTO', costeScramble: 2500, capacidades: TODAS, crear: async () => (await import('./fto.js')).default },
]).concat(conCategoria('cuboids', [
  cuboide(3, 3, 1, '3x3x1 Floppy', 5),
  cuboide(3, 3, 2, '3x3x2 Domino', 1200),
  cuboide(2, 2, 3, '2x2x3 Tower', 120),
])).concat(conCategoria('shapemods', [
  // Shape Mods (noche 16): un 3x3 por dentro (planos de corte a ±corte en los tres ejes del mecanismo) con
  // otro cuerpo por fuera. Otro shape mod = otra definición de cortes. Fuentes y supuestos: DECISIONES.md.
  {
    id: 'mirror', nombre: 'Mirror Blocks', costeScramble: 900, capacidades: TODAS,
    crear: async () => (await import('./shapemod.js')).crearShapeMod({
      id: 'mirror',
      nombre: 'Mirror Blocks',
      // capa del medio = 1 (19 mm en un cubo de 57 mm); cuerpo desplazado: grosores U 0,5 · L 0,67 · F 0,83 ·
      // B 1,17 · R 1,33 · D 1,5 (el orden publicado, de la más fina a la más gruesa, con pasos iguales)
      cortes: { corte: 0.5, semilado: 1.5, centro: [1 / 3, -1 / 2, -1 / 6] },
      material: { nombre: 'plateado', hex: '#c9ced6' },
    }),
  },
  {
    id: 'ghost', nombre: 'Ghost Cube', costeScramble: 900, capacidades: TODAS,
    crear: async () => {
      const [{ crearShapeMod }, { cuboInclinado }] = await Promise.all([import('./shapemod.js'), import('./shapemod-geo.js')]);
      return crearShapeMod({
        id: 'ghost',
        nombre: 'Ghost Cube',
        // mecanismo inclinado y desplazado, y capas de arriba y abajo desfasadas en la forma de cubo (ajuste a una
        // foto de onexmac/ad, PR #163); planos de corte a 1/3 del semilado (supuesto: proporciones de un 3x3)
        cortes: {
          corte: 1 / 3, semilado: 1,
          ...cuboInclinado([-0.607, 0.484, 0.63], (63.3 * Math.PI) / 180, [0.034, 0.075, -0.038]),
          desfase: { abajo: (-27.5 * Math.PI) / 180, arriba: (26.7 * Math.PI) / 180 },
        },
        material: { nombre: 'plateado', hex: '#c9ced6' },
      });
    },
  },
]));

/** Puzzles anunciados que aún no existen: el selector los muestra bloqueados ("pronto"). */
/** @type {PuzzlePronto[]} */
export const PUZZLES_PRONTO = [
  { id: '2x2x4', nombre: '2x2x4', categoria: 'cuboids' },
  { id: '3x3x4', nombre: '3x3x4', categoria: 'cuboids' },
  { id: '3x3x5', nombre: '3x3x5', categoria: 'cuboids' },
  { id: 'fisher', nombre: 'Fisher Cube', categoria: 'shapemods' },
  { id: 'windmill', nombre: 'Windmill Cube', categoria: 'shapemods' },
  { id: 'axis', nombre: 'Axis Cube', categoria: 'shapemods' },
];

/**
 * Bandaged Cubes (noche 13): los puzzles que se pueden vendar, con su nombre en la URL
 * (#/bandaged?puzzle=4x4) y el id del puzzle base. El 3x3 es el del registro (estado de colores: sus
 * piezas se distinguen); el 4x4 y el 5x5 llevan la identidad de los centros iguales en el estado y
 * comparten el solver (sin bloques) con los de la lista.
 * @type {EntradaBandaged[]}
 */
export const BANDAGED = [
  { url: '3x3', id: '3x3' },
  { url: '4x4', id: 'vendado-4x4' },
  { url: '5x5', id: 'vendado-5x5' },
];
/** Cómo se construyen las bases del 4x4 y el 5x5 vendados. @type {Record<string, () => Promise<Puzzle<unknown>>>} */
const CREAR_BASE_VENDADA = {
  'vendado-4x4': async () => (await import('./nxn-identidad.js')).crearCuboConIdentidad(/** @type {Puzzle<EstadoPegatinas>} */ (await cargarPuzzle('4x4')), 4),
  'vendado-5x5': async () => (await import('./nxn-identidad.js')).crearCuboConIdentidad(/** @type {Puzzle<EstadoPegatinas>} */ (await cargarPuzzle('5x5')), 5),
};

/** @param {string} id @returns {EntradaRegistro | undefined} */
export const entradaDe = (id) => REGISTRO.find((e) => e.id === id);

/** Puzzles ya construidos (por id) y los que se están construyendo. */
/** @type {Map<string, Puzzle<unknown>>} */
const construidos = new Map();
/** @type {Map<string, Promise<Puzzle<unknown>>>} */
const enCamino = new Map();

/** ¿Es el id de un puzzle del registro o de una base del modo vendado? @param {string} id */
export const existePuzzle = (id) => !!entradaDe(id) || id in CREAR_BASE_VENDADA;

/**
 * El puzzle de ese id (los del registro y las bases del modo vendado), construyéndolo la primera vez.
 * Rechaza si el id no existe. Cada puzzle se construye una sola vez (las llamadas a la vez comparten la promesa).
 * @param {string} id
 * @returns {Promise<Puzzle<unknown>>}
 */
export function cargarPuzzle(id) {
  const ya = construidos.get(id);
  if (ya) return Promise.resolve(ya);
  let prom = enCamino.get(id);
  if (!prom) {
    const entrada = entradaDe(id);
    const crear = entrada ? entrada.crear : CREAR_BASE_VENDADA[id];
    if (!crear) return Promise.reject(new Error(`Puzzle desconocido: ${id}`));
    prom = crear().then((p) => {
      // la categoría es del registro (como antes: se añadía al puzzle construido)
      if (entrada) /** @type {PuzzleRegistrado} */ (p).categoria = entrada.categoria;
      construidos.set(id, p);
      enCamino.delete(id);
      return p;
    }, (err) => { enCamino.delete(id); throw err; });
    enCamino.set(id, prom);
  }
  return prom;
}

/** El puzzle de ese id si ya está construido (si no, undefined). @param {string} id @returns {Puzzle<unknown> | undefined} */
export const puzzleCargado = (id) => construidos.get(id);

/** Ids de los puzzles construidos hasta ahora, en orden (para los tests y el diagnóstico). @returns {string[]} */
export const puzzlesConstruidos = () => [...construidos.keys()];

/**
 * Todos los puzzles del registro, construidos, en su orden (los tests y los scripts que los recorren todos).
 * @returns {Promise<PuzzleRegistrado[]>}
 */
export async function todosLosPuzzles() {
  const lista = [];
  for (const e of REGISTRO) lista.push(/** @type {PuzzleRegistrado} */ (await cargarPuzzle(e.id)));
  return lista;
}
