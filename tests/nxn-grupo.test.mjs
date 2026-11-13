// Demostración (Schreier–Sims) de las restricciones de los cubos NxN.
// 4x4 y 5x5 siempre; 6x6 (~20 s) y 7x7 (~70 s) solo en la suite completa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarGrupo } from '../src/puzzles/nxn-grupo.js';
import { CASOS, guardarResultado } from './util.mjs';

const fact = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const TAMANOS = CASOS >= 1000 ? [3, 4, 5, 6, 7] : [3, 4, 5];

for (const N of TAMANOS) {
  test(`${N}x${N}: restricciones demostradas con Schreier–Sims`, () => {
    const t0 = Date.now();
    const r = analizarGrupo(N);
    // 1. El orden de H coincide con el predicho por las órbitas y los signos:
    //    no hay más restricciones que las de cada órbita y las de paridad.
    assert.equal(r.orden, r.predicho, 'orden de H = Π|G_i| · |S| / 2^k');
    // 2. Cada órbita por separado
    for (const o of r.orbitas) {
      if (o.tipo === 'esquinas') assert.equal(o.factorOrientacion, 3n, 'esquinas: la suma de giros es múltiplo de 3');
      if (o.tipo === 'aristas') assert.equal(o.factorOrientacion, 2n, 'aristas centrales: número par de volteos');
      if (o.tipo === 'wings') assert.equal(o.factorOrientacion, 2n ** 24n, 'wings: nunca se voltean en su sitio');
      if (o.tipo === 'centros') assert.equal(o.factorOrientacion, 1n, 'centros: cualquier permutación');
      assert.equal(o.soloPares, false, `${o.nombre}: hay permutaciones impares`);
    }
    // 3. Relaciones de paridad visibles (las que no involucran centros, que son indistinguibles)
    const visibles = r.relacionesVisibles.map((x) => x.join(' + '));
    if (N % 2) assert.deepEqual(visibles, ['esquinas + aristas centrales']);
    else assert.deepEqual(visibles, []);
    // 4. Comprobación con las fórmulas conocidas del número de estados (centros indistinguibles)
    const nW = Math.floor((N - 2) / 2); // órbitas de wings
    const centros = r.orbitas.filter((o) => o.tipo === 'centros').length;
    assert.equal(centros, Math.floor((N - 2) ** 2 / 4), 'órbitas de 24 centros');
    let estados = fact(8) * 3n ** 7n * (N % 2 ? fact(12) * 2n ** 10n : 1n) * fact(24) ** BigInt(nW + centros) / fact(4) ** BigInt(6 * centros);
    if (N % 2 === 0) estados /= 24n; // sin centros fijos: se divide por las 24 orientaciones
    const conocidos = {
      3: 43252003274489856000n,
      4: 7401196841564901869874093974498574336000000000n,
      5: 282870942277741856536180333107150328293127731985672134721536000000000000000n,
    };
    if (conocidos[N]) assert.equal(estados, conocidos[N]);
    guardarResultado(`${N}x${N}`, {
      grupo: {
        ordenH: r.orden.toString(),
        estados: estados.toString(),
        relaciones: r.relaciones.map((x) => x.join(' + ')),
        relacionesVisibles: visibles,
        ms: Date.now() - t0,
      },
    });
  });
}
