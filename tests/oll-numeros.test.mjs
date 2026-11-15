// Números de las OLL: cada algoritmo de src/aprender/algoritmos.js que lleva número tiene que
// resolver exactamente el caso de ese número según DOS referencias de la comunidad (numeración
// del wiki de speedsolving.com). Un caso es el dibujo de la cara de arriba (qué pegatinas de la
// capa de arriba tienen el color de arriba), sin importar el giro de U: se calcula aplicando la
// inversa del algoritmo de referencia a un cubo resuelto. Referencias consultadas el 15/11/2026:
//   A: solvethecube.com/algorithms (las 57, "numeradas según el wiki de speedsolving.com")
//   B: por número, de zeroplay.io/docs/rubik/tutorials/oll, del wiki de speedsolving.com
//      (páginas de cada caso; la 20 sale de ahí: la de zeroplay es en realidad la 28), de cubefreak.net
//      (OLL), de ca.speedcube.com.au y de r/Cubers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNxN } from '../src/puzzles/nxn.js';
import { OLL } from '../src/aprender/algoritmos.js';

export const REF_A = {
  1: "R U2 R' R' F R F' U2 R' F R F'", 2: "F R U R' U' F' f R U R' U' f'", 3: "f R U R' U' f' U' F R U R' U' F'",
  4: "f R U R' U' f' U F R U R' U' F'", 5: "r' U2 R U R' U r", 6: "r U2 R' U' R U' r'", 7: "r U R' U R U2 r'",
  8: "r' U' R U' R' U2 r", 9: "R U R' U' R' F R2 U R' U' F'", 10: "R U R' U R' F R F' R U2 R'",
  11: "F' L' U' L U F y F R U R' U' F'", 12: "F R U R' U' F' U F R U R' U' F'", 13: "F U R U' R2 F' R U R U' R'",
  14: "R' F R U R' F' R y' R U' R'", 15: "l' U' l L' U' L U l' U l", 16: "r U r' R U R' U' r U' r'",
  17: "R U R' U R' F R F' U2 R' F R F'", 18: "F R U R' U y' R' U2 R' F R F'", 19: "M U R U R' U' M' R' F R F'",
  20: "M U R U R' U' M2 U R U' r'", 21: "R U R' U R U' R' U R U2 R'", 22: "R U2 R2' U' R2 U' R2' U2 R",
  23: "R2 D R' U2 R D' R' U2 R'", 24: "r U R' U' r' F R F'", 25: "F' r U R' U' r' F R", 26: "R U2 R' U' R U' R'",
  27: "R' U2 R U R' U R", 28: "M' U' M U2' M' U' M", 29: "R U R' U' R U' R' F' U' F R U R'",
  30: "L F' L' F L' U2 L d R U R'", 31: "R' U' F U R U' R' F' R", 32: "F U R U' F' r U R' U' r'",
  33: "R U R' U' R' F R F'", 34: "R U R' U' x D' R' U R U' D x'", 35: "R U2 R' R' F R F' R U2 R'",
  36: "L' U' L U' L' U L U L F' L' F", 37: "F R' F' R U R U' R'", 38: "R U R' U R U' R' U' R' F R F'",
  39: "L F' L' U' L U F U' L'", 40: "R' F R U R' U' F' U R", 41: "R U R' U R U2 R' F R U R' U' F'",
  42: "R' F R F' R' F R F' R U R' U' R U R'", 43: "f' L' U' L U f", 44: "f R U R' U' f'", 45: "F R U R' U' F'",
  46: "R' U' R' F R F' U R", 47: "F' L' U' L U L' U' L U F", 48: "F R U R' U' R U R' U' F'",
  49: "R' F R' F' R2 U2 y R' F R F'", 50: "R' F R2 B' R2' F' R2 B R'", 51: "f R U R' U' R U R' U' f'",
  52: "R U R' U R d' R U' R' F'", 53: "l' U' L U' L' U L U' L' U2 l", 54: "r U R' U R U' R' U R U2' r'",
  55: "R U2 R2 U' R U' R' U2 F R F'", 56: "F R U R' U' R F' r U R' U' r'", 57: "R U R' U' M' U R U' r'",
};
export const REF_B = {
  1: "R U2 R2 F R F' U2 R' F R F'", 2: "F R U R' U' F' f R U R' U' f'", 3: "f R U R' U' f' U' F R U R' U' F'",
  4: "f R U R' U' f' U F R U R' U' F'", 5: "Rw' U2 R U R' U Rw", 6: "Rw U2' R' U' R U' Rw'", 7: "Rw U R' U R U2' Rw'",
  8: "Rw' U' R U' R' U2' Rw", 9: "R U R' U' R' F R2 U R' U' F'", 10: "R U R' U R' F R F' R U2' R'",
  11: "r U R' U R' F R F' R U2 r'", 12: "F R U R' U' F' U F R U R' U' F'", 13: "L F' L' U' L F L' F' U F",
  14: "R' F R U R' F' R F U' F'", 15: "Lw' U' Lw L' U' L U Lw' U Lw", 16: "Rw U Rw' R U R' U' Rw U' Rw'",
  17: "R U R' U R' F R F' U2' R' F R F'", 18: "R U2' R2' F R F' U2' Rw R' U R U' Rw'", 19: "M U R U R' U' Rw R2' F R F'",
  20: "r U R' U' M2 U R U' R' U' M'", 21: "R U R' U R U' R' U R U2 R'", 22: "R U2 R2 U' R2 U' R2 U2 R",
  23: "R2 D' R U2 R' D R U2 R", 24: "r U R' U' r' F R F'", 25: "F' r U R' U' r' F R", 26: "R' U' R U' R' U2 R",
  27: "R U R' U R U2' R'", 28: "U2 M' U M U2 M' U M", 29: "R U R' U' R U' R' F' U' F R U R'",
  30: "F R' F R2 U' R' U' R U R' F2", 31: "R' U' F U R U' R' F' R", 32: "L U F' U' L' U L F L'",
  33: "R U R' U' R' F R F'", 34: "R U R2 U' R' F R U R U' F'", 35: "R U2 R2 F R F' R U2 R'",
  36: "L' U' L U' L' U L U L F' L' F", 37: "F R' F' R U R U' R'", 38: "R U R' U R U' R' U' R' F R F'",
  39: "L F' L' U' L U F U' L'", 40: "R' F R U R' U' F' U R", 41: "R U R' U R U2 R' F R U R' U' F'",
  42: "R' U' R U' R' U2 R F R U R' U' F'", 43: "F' U' L' U L F", 44: "F U R U' R' F'", 45: "F R U R' U' F'",
  46: "R' U' R' F R F' U R", 47: "F' L' U' L U L' U' L U F", 48: "F R U R' U' R U R' U' F'",
  49: "r U' r2 U r2 U r2 U' r", 50: "r' U r2 U' r2' U' r2 U r'", 51: "f R U R' U' R U R' U' f'",
  52: "R' U' R U' R' U F' U F R", 53: "l' U' L U' L' U L U' L' U2 l", 54: "r U R' U R U' R' U R U2' r'",
  55: "R' F R U R U' R2' F' R2 U' R' U R U R'", 56: "r U r' U R U' R' U R U' R' r U' r'", 57: "R U R' U' Rw R' U R U' Rw'",
};

// ---- un 3x3 de pegatinas y la notación de las referencias (r, M, d, y…) en WCA ----
const cubo = baseNxN(3);
const inv = (m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'");
const SUF = (s) => (s === "'" ? "'" : s === '2' ? '2' : '');
// capas del medio en WCA: M = Rw' R (sigue a L), E = Uw' U (sigue a D), S = Fw F' (sigue a F)
const MEDIA = { M: ["Rw'", 'R'], E: ["Uw'", 'U'], S: ['Fw', "F'"] };
export function aWCA(alg) {
  const out = [];
  for (let t of alg.replace(/’/g, "'").replace(/[()]/g, ' ').trim().split(/\s+/)) {
    t = t.replace("2'", '2');
    const m = /^([URFDLBMESxyzurfdlb])(w?)('|2)?$/.exec(t);
    if (!m) throw new Error('notación: ' + t);
    const [, l, w, s = ''] = m;
    if (l in MEDIA) {
      const base = MEDIA[l];
      if (s === '2') out.push(...base.map((x) => x.replace("'", '') + '2'));
      else if (s === "'") out.push(...base.map(inv));
      else out.push(...base);
    } else if (/[urfdlb]/.test(l)) out.push(l.toUpperCase() + 'w' + SUF(s));
    else out.push(l + w + SUF(s));
  }
  return out;
}
const aplicar = (e, movs) => movs.reduce((x, m) => cubo.aplicarMovimiento(x, m), e);
const ARRIBA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47];
/** Caso de OLL que resuelve el algoritmo: dibujo canónico (mínimo entre los cuatro giros de U). */
export function casoOLL(algWCA) {
  let e = aplicar(cubo.estadoResuelto(), algWCA.slice().reverse().map(inv));
  const dibujos = [];
  for (let k = 0; k < 4; k++) {
    const arriba = e[4];
    dibujos.push(ARRIBA.map((i) => (e[i] === arriba ? 1 : 0)).join(''));
    e = cubo.aplicarMovimiento(e, 'y');
  }
  return dibujos.sort()[0];
}
/** ¿Respeta las dos primeras capas y deja la cara de arriba de un color? (la referencia es una OLL de verdad) */
function esOLL(algWCA) {
  const e = aplicar(cubo.estadoResuelto(), algWCA.slice().reverse().map(inv));
  const f = aplicar(e, algWCA);
  return f.every((c, i) => c === f[[4, 13, 22, 31, 40, 49][Math.floor(i / 9)]]);
}

test('OLL: las dos referencias coinciden caso a caso (57 casos distintos)', () => {
  const casos = new Map();
  for (let n = 1; n <= 57; n++) {
    const a = aWCA(REF_A[n]), b = aWCA(REF_B[n]);
    assert.ok(esOLL(a) && esOLL(b), `OLL ${n}: la referencia no deja el cubo resuelto`);
    assert.equal(casoOLL(a), casoOLL(b), `OLL ${n}: las dos referencias no son el mismo caso`);
    assert.ok(!casos.has(casoOLL(a)), `OLL ${n}: el mismo caso que la ${casos.get(casoOLL(a))}`);
    casos.set(casoOLL(a), n);
  }
  assert.equal(casos.size, 57);
});

test('OLL: cada algoritmo con número resuelve el caso de ese número', () => {
  const porCaso = new Map(Object.keys(REF_A).map((n) => [casoOLL(aWCA(REF_A[n])), +n]));
  let conNumero = 0;
  for (const o of OLL) {
    const caso = casoOLL(o.alg.split(' '));
    const n = porCaso.get(caso);
    if (o.n != null) { conNumero++; assert.equal(o.n, n, `${o.alg}: dice OLL ${o.n} y es la ${n}`); }
  }
  assert.ok(conNumero >= 57, `${conNumero} algoritmos con número`);
});
