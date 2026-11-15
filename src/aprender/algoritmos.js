// Algoritmos estándar de la comunidad para la última capa (escritos a mano en
// notación WCA; sin movimientos de capa central: M = Rw' R). Al cargar el modo
// aprender se comprueba cada uno (que respete las dos primeras capas y haga lo
// que dice su familia); los tests comprueban además que cubren todos los casos.

/**
 * OLL: orientar la última capa. `n` = número de caso según la numeración del wiki de speedsolving.com,
 * comprobado contra dos referencias de la comunidad en tests/oll-numeros.test.mjs (el caso que
 * resuelve cada algoritmo se calcula sobre el cubo y tiene que ser el del número).
 */
export const OLL = [
  ['R U2 R2 F R F\' U2 R\' F R F\'', 1],
  ['F R U R\' U\' F\' Fw R U R\' U\' Fw\'', 2],
  ['Fw R U R\' U\' Fw\' U\' F R U R\' U\' F\'', 3],
  ['Fw R U R\' U\' Fw\' U F R U R\' U\' F\'', 4],
  ['Rw\' U2 R U R\' U Rw', 5],
  ['Rw U2 R\' U\' R U\' Rw\'', 6],
  ['Rw U R\' U R U2 Rw\'', 7],
  ['Lw\' U\' L U\' L\' U2 Lw', 8],
  ['R U R\' U\' R\' F R2 U R\' U\' F\'', 9],
  ['R U R\' U R\' F R F\' R U2 R\'', 10],
  ['Rw U R\' U R\' F R F\' R U2 Rw\'', 11],
  ['F R U R\' U\' F\' U F R U R\' U\' F\'', 12],
  ['F U R U\' R2 F\' R U R U\' R\'', 13],
  ['R\' F R U R\' F\' R F U\' F\'', 14],
  ['Lw\' U\' Lw L\' U\' L U Lw\' U Lw', 15],
  ['Rw U Rw\' R U R\' U\' Rw U\' Rw\'', 16],
  ['R U R\' U R\' F R F\' U2 R\' F R F\'', 17],
  ['Rw U R\' U R U2 Rw2 U\' R U\' R\' U2 Rw', 18],
  ['R\' U2 F R U R\' U\' F2 U2 F R', 19],
  ['Rw U R\' U\' Rw2 R2 U R U\' R\' U\' Rw R\'', 20], // r U R' U' M2 U R U' R' U' M' (la variante de antes no era una OLL)
  ['R U2 R\' U\' R U R\' U\' R U\' R\'', 21, 'H'],
  ['R U2 R2 U\' R2 U\' R2 U2 R', 22, 'Pi'],
  ['R2 D\' R U2 R\' D R U2 R', 23, 'Headlights'],
  ['Rw U R\' U\' Rw\' F R F\'', 24, 'T'],
  ['F\' Rw U R\' U\' Rw\' F R', 25, 'Bowtie'],
  ['R U2 R\' U\' R U\' R\'', 26, 'Antisune'],
  ['R U R\' U R U2 R\'', 27, 'Sune'],
  ['Rw U R\' U\' Rw\' R U R U\' R\'', 28],
  ['R U R\' U\' R U\' R\' F\' U\' F R U R\'', 29],
  ['F R\' F R2 U\' R\' U\' R U R\' F2', 30],
  ['R\' U\' F U R U\' R\' F\' R', 31],
  ['L U F\' U\' L\' U L F L\'', 32],
  ['R U R\' U\' R\' F R F\'', 33],
  ['R U R2 U\' R\' F R U R U\' F\'', 34],
  ['R U2 R2 F R F\' R U2 R\'', 35],
  ['L\' U\' L U\' L\' U L U L F\' L\' F', 36],
  ['F R\' F\' R U R U\' R\'', 37],
  ['R U R\' U R U\' R\' U\' R\' F R F\'', 38],
  ['L F\' L\' U\' L U F U\' L\'', 39],
  ['R\' F R U R\' U\' F\' U R', 40],
  ['R U R\' U R U2 R\' F R U R\' U\' F\'', 41],
  ['R\' U\' R U\' R\' U2 R F R U R\' U\' F\'', 42],
  ['F\' U\' L\' U L F', 43],
  ['Fw R U R\' U\' Fw\'', 44],
  ['F R U R\' U\' F\'', 45],
  ['R\' U\' R\' F R F\' U R', 46],
  ['R\' U\' R\' F R F\' R\' F R F\' U R', 47],
  ['F R U R\' U\' R U R\' U\' F\'', 48],
  ['Rw U\' Rw2 U Rw2 U Rw2 U\' Rw', 49],
  ['Rw\' U Rw2 U\' Rw2 U\' Rw2 U Rw\'', 50],
  ['F U R U\' R\' U R U\' R\' F\'', 51],
  ['R U R\' U R U\' B U\' B\' R\'', 52],
  ['Lw\' U2 L U L\' U\' L U L\' U Lw', 53],
  ['Rw U2 R\' U\' R U R\' U\' R U\' Rw\'', 54],
  ['R U2 R2 U\' R U\' R\' U2 F R F\'', 55],
  ['Rw U Rw\' U R U\' R\' U R U\' R\' Rw U\' Rw\'', 56],
  ['R U R\' U\' Rw R\' U R U\' Rw\'', 57],
  // otras formas de algunos casos (por si alguna de arriba no cubriera el suyo)
  ['R\' U\' R U\' R\' U2 R', 26],
  ['R U2 R\' U2 R\' F R F\'', 8],
  ['F U R U\' R\' F\'', 44],
  ['Fw\' L\' U\' L U Fw', 43],
].map(([alg, n = null, apodo = null]) => ({ alg, n, apodo }));

/** OLL en dos pasos: primero la cruz amarilla (aristas) y después las esquinas (OCLL). */
export const OLL_ARISTAS = [
  { alg: "F R U R' U' F'", nombre: "F R U R' U' F'" },
  { alg: "Fw R U R' U' Fw'", nombre: "Fw R U R' U' Fw'" },
];

/** PLL: permutar la última capa. `familia` se comprueba al cargar. */
export const PLL = [
  ['Ua', "R U' R U R U R U' R' U' R2", 'U'],
  ['Ub', "R2 U R U R' U' R' U' R' U R'", 'U'],
  ['H', "R2 U2 R U2 R2 U2 R2 U2 R U2 R2", 'H'],
  ['Z', "R' U' R U' R U R U' R' U R U R2 U' R'", 'Z'],
  ['Aa', "R' F R' B2 R F' R' B2 R2", 'A'],
  ['Ab', "R2 B2 R F R' B2 R F' R", 'A'],
  ['E', "x' R U' R' D R U R' D' R U R' D R U' R' D' x", 'E'],
  ['T', "R U R' U' R' F R2 U' R' U' R U R' F'", 'T'],
  ['F', "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", 'F'],
  ['Ja', "L' U' L F L' U' L U L F' L2 U L", 'J'],
  ['Jb', "R U R' F' R U R' U' R' F R2 U' R'", 'J'],
  ['Ra', "R U' R' U' R U R D R' U' R D' R' U2 R'", 'R'],
  ['Rb', "R2 F R U R U' R' F' R U2 R' U2 R", 'R'],
  ['V', "R' U R' U' y R' F' R2 U' R' U R' F R F", 'V'],
  ['Y', "F R U' R' U' R U R' F' R U R' U' R' F R F'", 'Y'],
  ['Na', "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", 'N'],
  ['Nb', "R' U R U' R' F' U' F R U R' F R' F' R U' R", 'N'],
  ['Ga', "R2 U R' U R' U' R U' R2 U' D R' U R D'", 'G'],
  ['Gb', "R' U' R U D' R2 U R' U R U' R U' R2 D", 'G'],
  ['Gc', "R2 U' R U' R U R' U R2 U D' R U' R' D", 'G'],
  ['Gd', "R U R' U' D R2 U' R U' R' U R' U R2 D'", 'G'],
].map(([nombre, alg, familia]) => ({ nombre, alg, familia }));

/** Los del método de principiantes (última capa en cuatro pasos). */
export const PRINCIPIANTES = {
  cruz: { alg: "F R U R' U' F'", nombre: "F R U R' U' F'" },
  sune: { alg: "R U R' U R U2 R'", nombre: 'Sune' },
  // A-perm (3-ciclo de esquinas) y U-perm (3-ciclo de aristas), en los dos sentidos
  esquinas: ['Aa', 'Ab'],
  aristas: ['Ua', 'Ub'],
  sexy: "R U R' U'",
  derecha: "U R U' R' U' F' U F",
  izquierda: "U' L' U L U F U' F'",
};
