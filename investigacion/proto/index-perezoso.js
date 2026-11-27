// PROTOTIPO (opción c, evaluación diferida): el registro de puzzles sin construir nada al cargar.
// Sustituye a src/puzzles/index.js solo en los builds de investigacion/prototipos.mjs (alias de esbuild).
// - Los datos que la interfaz lee sin usar el puzzle (id, nombre, categoria, costeScramble, capacidades) vienen de
//   META (generado por prototipos.mjs desde el registro real: en una versión de verdad, irían en el registro).
// - Cada puzzle es un Proxy que construye el puzzle real la primera vez que se le pide otra cosa.
// - Los módulos de cada puzzle se cargan con require(): esbuild los envuelve en una función (__esm) que solo se
//   ejecuta al llamarla, así que su código de nivel superior (geometrías, tablas pequeñas) tampoco corre al cargar.
/* global __META_PUZZLES__ */
const META = __META_PUZZLES__;
const construidos = (globalThis.__construidos = []);

function perezoso(meta, crear) {
  let real = null;
  const obtener = () => {
    if (!real) { real = crear(); if (meta.categoria) real.categoria = meta.categoria; construidos.push(meta.id); }
    return real;
  };
  return new Proxy(Object.create(null), {
    get: (_, k) => (!real && Object.prototype.hasOwnProperty.call(meta, k) ? meta[k] : Reflect.get(obtener(), k)),
    set: (_, k, v) => Reflect.set(obtener(), k, v),
    has: (_, k) => k in obtener(),
    ownKeys: () => Reflect.ownKeys(obtener()),
    getOwnPropertyDescriptor: (_, k) => { const d = Reflect.getOwnPropertyDescriptor(obtener(), k); if (d) d.configurable = true; return d; },
  });
}

const CREAR = {
  '2x2': () => require('../../src/puzzles/cubo2.js').default,
  '3x3': () => require('../../src/puzzles/cubo3.js').default,
  '4x4': () => require('../../src/puzzles/cubo-grande.js').crearCuboGrande(4),
  '5x5': () => require('../../src/puzzles/cubo-grande.js').crearCuboGrande(5),
  '6x6': () => require('../../src/puzzles/cubo-grande.js').crearCuboGrande(6),
  '7x7': () => require('../../src/puzzles/cubo-grande.js').crearCuboGrande(7),
  pyraminx: () => require('../../src/puzzles/pyraminx.js').default,
  skewb: () => require('../../src/puzzles/skewb.js').default,
  square1: () => require('../../src/puzzles/square1.js').default,
  megaminx: () => require('../../src/puzzles/megaminx.js').default,
  fto: () => require('../../src/puzzles/fto.js').default,
  '3x3x1': () => require('../../src/puzzles/cuboide.js').crearCuboide(3, 3, 1, { id: '3x3x1', nombre: '3x3x1 Floppy', costeScramble: 5 }),
  '3x3x2': () => require('../../src/puzzles/cuboide.js').crearCuboide(3, 3, 2, { id: '3x3x2', nombre: '3x3x2 Domino', costeScramble: 1200 }),
  '2x2x3': () => require('../../src/puzzles/cuboide.js').crearCuboide(2, 2, 3, { id: '2x2x3', nombre: '2x2x3 Tower', costeScramble: 120 }),
  mirror: () => require('../../src/puzzles/shapemod.js').crearShapeMod({
    id: 'mirror', nombre: 'Mirror Blocks',
    cortes: { corte: 0.5, semilado: 1.5, centro: [1 / 3, -1 / 2, -1 / 6] },
    material: { nombre: 'plateado', hex: '#c9ced6' },
  }),
  ghost: () => require('../../src/puzzles/shapemod.js').crearShapeMod({
    id: 'ghost', nombre: 'Ghost Cube',
    cortes: {
      corte: 1 / 3, semilado: 1,
      ...require('../../src/puzzles/shapemod-geo.js').cuboInclinado([-0.607, 0.484, 0.63], (63.3 * Math.PI) / 180, [0.034, 0.075, -0.038]),
      desfase: { abajo: (-27.5 * Math.PI) / 180, arriba: (26.7 * Math.PI) / 180 },
    },
    material: { nombre: 'plateado', hex: '#c9ced6' },
  }),
};

export const PUZZLES = META.puzzles.map((m) => {
  if (!CREAR[m.id]) throw new Error('prototipo: falta ' + m.id);
  return perezoso(m, CREAR[m.id]);
});
const porId = (id) => PUZZLES.find((p) => p.id === id);

export const PUZZLES_PRONTO = META.pronto;

export const obtenerPuzzle = (id) => porId(id);

export const BANDAGED = META.bandaged.map((b) => ({
  url: b.url,
  puzzle: b.url === '3x3' ? porId('3x3') : perezoso({ id: b.id, nombre: b.nombre }, () => require('../../src/puzzles/nxn-identidad.js').crearCuboConIdentidad(porId(b.url), b.url === '4x4' ? 4 : 5)),
}));

export const buscarPuzzle = (id) => obtenerPuzzle(id) || BANDAGED.map((b) => b.puzzle).find((p) => p.id === id);
