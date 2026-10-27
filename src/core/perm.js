// Utilidades de permutaciones.
//
// Convención para permutaciones de pegatinas: una permutación P es un array
// tal que, al aplicarla, nuevo[i] = viejo[P[i]]  ("la pegatina i viene de P[i]").

/** Aplica la permutación P a un estado (array). Devuelve un array nuevo. */
export function aplicarPerm(estado, P) {
  const n = P.length;
  const r = new Array(n);
  for (let i = 0; i < n; i++) r[i] = estado[P[i]];
  return r;
}

/** Composición: primero A, luego B. */
export function componer(A, B) {
  const n = A.length;
  const r = new Array(n);
  for (let i = 0; i < n; i++) r[i] = A[B[i]];
  return r;
}

/** Inversa de una permutación. */
export function invertir(P) {
  const r = new Array(P.length);
  for (let i = 0; i < P.length; i++) r[P[i]] = i;
  return r;
}

export function identidad(n) {
  return Array.from({ length: n }, (_, i) => i);
}

export function esIdentidad(P) {
  for (let i = 0; i < P.length; i++) if (P[i] !== i) return false;
  return true;
}

/** Potencia k-ésima de una permutación (k >= 0). */
export function potencia(P, k) {
  let r = identidad(P.length);
  for (let i = 0; i < k; i++) r = componer(r, P);
  return r;
}

/** Paridad de una permutación de enteros 0..n-1 (0 = par, 1 = impar). */
export function paridad(p) {
  const n = p.length;
  const visto = new Uint8Array(n);
  let par = 0;
  for (let i = 0; i < n; i++) {
    if (visto[i]) continue;
    let largo = 0;
    let j = i;
    while (!visto[j]) { visto[j] = 1; j = p[j]; largo++; }
    par ^= (largo - 1) & 1;
  }
  return par;
}

const FACT = [1];
for (let i = 1; i <= 13; i++) FACT[i] = FACT[i - 1] * i;
export const factorial = (n) => FACT[n];

/** Índice de Lehmer de una permutación de 0..n-1, en [0, n!). */
export function indicePerm(p) {
  const n = p.length;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    let menores = 0;
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) menores++;
    idx += menores * FACT[n - 1 - i];
  }
  return idx;
}

/** Inversa de indicePerm. */
export function permDeIndice(idx, n) {
  const disp = identidad(n);
  const p = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = FACT[n - 1 - i];
    const k = Math.floor(idx / f);
    idx -= k * f;
    p[i] = disp.splice(k, 1)[0];
  }
  return p;
}

/** Coeficiente binomial. */
export function binom(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}
