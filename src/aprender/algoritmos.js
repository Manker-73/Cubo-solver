// Algoritmos estándar de la comunidad para la última capa (escritos a mano en
// notación WCA; sin movimientos de capa central: M = Rw' R). Al cargar el modo
// aprender se comprueba cada uno (que respete las dos primeras capas y haga lo
// que dice su familia); los tests comprueban además que cubren todos los casos.

/** OLL: orientar la última capa. `n` = número de caso (solo donde el nombre es inequívoco). */
export const OLL = [
  ['R U2 R2 F R F\' U2 R\' F R F\''],
  ['F R U R\' U\' F\' Fw R U R\' U\' Fw\''],
  ['Fw R U R\' U\' Fw\' U\' F R U R\' U\' F\''],
  ['Fw R U R\' U\' Fw\' U F R U R\' U\' F\''],
  ['Rw\' U2 R U R\' U Rw'],
  ['Rw U2 R\' U\' R U\' Rw\''],
  ['Rw U R\' U R U2 Rw\''],
  ['Lw\' U\' L U\' L\' U2 Lw'],
  ['R U R\' U\' R\' F R2 U R\' U\' F\''],
  ['R U R\' U R\' F R F\' R U2 R\''],
  ['Rw U R\' U R\' F R F\' R U2 Rw\''],
  ['F R U R\' U\' F\' U F R U R\' U\' F\''],
  ['F U R U\' R2 F\' R U R U\' R\''],
  ['R\' F R U R\' F\' R F U\' F\''],
  ['Lw\' U\' Lw L\' U\' L U Lw\' U Lw'],
  ['Rw U Rw\' R U R\' U\' Rw U\' Rw\''],
  ['R U R\' U R\' F R F\' U2 R\' F R F\''],
  ['Rw U R\' U R U2 Rw2 U\' R U\' R\' U2 Rw'],
  ['R\' U2 F R U R\' U\' F2 U2 F R'],
  ['Rw U R\' U\' Rw\' R2 U R U\' Rw\' R\' Rw U2 R U R\' U\' Rw\' R\''],
  ['R U2 R\' U\' R U R\' U\' R U\' R\'', 21, 'H'],
  ['R U2 R2 U\' R2 U\' R2 U2 R', 22, 'Pi'],
  ['R2 D\' R U2 R\' D R U2 R', 23, 'Headlights'],
  ['Rw U R\' U\' Rw\' F R F\'', 24, 'T'],
  ['F\' Rw U R\' U\' Rw\' F R', 25, 'Bowtie'],
  ['R U2 R\' U\' R U\' R\'', 26, 'Antisune'],
  ['R U R\' U R U2 R\'', 27, 'Sune'],
  ['Rw U R\' U\' Rw\' R U R U\' R\''],
  ['R U R\' U\' R U\' R\' F\' U\' F R U R\''],
  ['F R\' F R2 U\' R\' U\' R U R\' F2'],
  ['R\' U\' F U R U\' R\' F\' R'],
  ['L U F\' U\' L\' U L F L\''],
  ['R U R\' U\' R\' F R F\''],
  ['R U R2 U\' R\' F R U R U\' F\''],
  ['R U2 R2 F R F\' R U2 R\''],
  ['L\' U\' L U\' L\' U L U L F\' L\' F'],
  ['F R\' F\' R U R U\' R\''],
  ['R U R\' U R U\' R\' U\' R\' F R F\''],
  ['L F\' L\' U\' L U F U\' L\''],
  ['R\' F R U R\' U\' F\' U R'],
  ['R U R\' U R U2 R\' F R U R\' U\' F\''],
  ['R\' U\' R U\' R\' U2 R F R U R\' U\' F\''],
  ['F\' U\' L\' U L F'],
  ['Fw R U R\' U\' Fw\''],
  ['F R U R\' U\' F\'', 45, null],
  ['R\' U\' R\' F R F\' U R'],
  ['R\' U\' R\' F R F\' R\' F R F\' U R'],
  ['F R U R\' U\' R U R\' U\' F\''],
  ['Rw U\' Rw2 U Rw2 U Rw2 U\' Rw'],
  ['Rw\' U Rw2 U\' Rw2 U\' Rw2 U Rw\''],
  ['F U R U\' R\' U R U\' R\' F\''],
  ['R U R\' U R U\' B U\' B\' R\''],
  ['Lw\' U2 L U L\' U\' L U L\' U Lw'],
  ['Rw U2 R\' U\' R U R\' U\' R U\' Rw\''],
  ['R U2 R2 U\' R U\' R\' U2 F R F\''],
  ['Rw U Rw\' U R U\' R\' U R U\' R\' Rw U\' Rw\''],
  ['R U R\' U\' Rw R\' U R U\' Rw\''],
  // otras formas de algunos casos (por si alguna de arriba no cubriera el suyo)
  ['R\' U\' R U\' R\' U2 R'],
  ['R U2 R\' U2 R\' F R F\''],
  ['F U R U\' R\' F\''],
  ['Fw\' L\' U\' L U Fw'],
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
