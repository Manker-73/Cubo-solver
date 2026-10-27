// Orden de un grupo de permutaciones (algoritmo de Schreier–Sims, versión
// clásica con cadena de estabilizadores sobre la base 0, 1, ..., n-1).
// Se usa en los tests para demostrar qué restricciones de paridad existen.
//
// Las permutaciones son arrays: p[i] = imagen de i.
// mul(a, b)(x) = a(b(x)): primero b, luego a.

const mul = (a, b) => b.map((x) => a[x]);
const inv = (p) => { const r = new Array(p.length); p.forEach((x, i) => { r[x] = i; }); return r; };

/** Orden (BigInt) del grupo generado por `generadores` (permutaciones de 0..n-1). */
export function ordenGrupo(generadores) {
  const n = generadores[0].length;
  const id = Array.from({ length: n }, (_, i) => i);
  // tr[k][i]: elemento del grupo que fija 0..k-1 y lleva k a i (o null)
  const tr = Array.from({ length: n }, (_, k) => { const f = new Array(n).fill(null); f[k] = id; return f; });
  const gens = Array.from({ length: n }, () => []);

  function pertenece(g, k) {
    for (; k < n; k++) {
      const t = tr[k][g[k]];
      if (!t) return false;
      g = mul(inv(t), g);
    }
    return true;
  }
  function actualizar(g, k) {
    const i = g[k];
    if (tr[k][i]) { ampliar(mul(inv(tr[k][i]), g), k + 1); return; }
    tr[k][i] = g;
    for (const s of gens[k]) actualizar(mul(s, g), k);
  }
  function ampliar(g, k) {
    if (k >= n || pertenece(g, k)) return;
    gens[k].push(g);
    for (let i = 0; i < n; i++) if (tr[k][i]) actualizar(mul(g, tr[k][i]), k);
  }

  for (const g of generadores) ampliar(g.slice(), 0);
  let orden = 1n;
  for (let k = 0; k < n; k++) orden *= BigInt(tr[k].filter(Boolean).length);
  return orden;
}
