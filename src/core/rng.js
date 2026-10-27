// Generadores de números aleatorios.
// Un "rng" es una función sin argumentos que devuelve un número en [0, 1).

/** RNG con semilla (mulberry32): reproducible, útil en tests. */
export function rngConSemilla(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG criptográfico cuando está disponible (para scrambles "de verdad"). */
export function rngSeguro() {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(64);
    let i = buf.length;
    return function () {
      if (i >= buf.length) { c.getRandomValues(buf); i = 0; }
      return buf[i++] / 4294967296;
    };
  }
  return Math.random;
}

/** Entero uniforme en [0, n). */
export function entero(rng, n) {
  return Math.floor(rng() * n);
}

/** Elemento uniforme de una lista. */
export function elegir(rng, lista) {
  return lista[entero(rng, lista.length)];
}

/** Baraja (Fisher–Yates) una copia de la lista. */
export function barajar(rng, lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = entero(rng, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
