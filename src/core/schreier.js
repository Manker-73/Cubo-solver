// Cadena de estabilizadores (Schreier–Sims) con arrays tipados, para grupos de
// permutaciones de unos pocos cientos de puntos con muchos generadores.
//
// La usa la capa de bloqueos (src/core/bloqueos.js) para contar el grupo de la
// fase 2 de un cubo vendado (las secuencias que salen de la geometría resuelta y
// vuelven a ella) y para saber si un estado pertenece a él.
//
// Convención: una permutación g es un Int16Array con g[p] = imagen del punto p.
// Producto "primero a, luego b": (a·b)[p] = b[a[p]].

const producto = (a, b) => { const r = new Int16Array(a.length); for (let i = 0; i < a.length; i++) r[i] = b[a[i]]; return r; };
const inversa = (a) => { const r = new Int16Array(a.length); for (let i = 0; i < a.length; i++) r[a[i]] = i; return r; };
const esId = (a) => { for (let i = 0; i < a.length; i++) if (a[i] !== i) return false; return true; };

export function crearCadena(n) {
  // Base: los puntos que se van necesitando (el primero que mueve un generador
  // que no se puede cribar). niveles[k] = { punto, gens, rep: Map(imagen -> elemento que lleva punto a imagen) }
  const niveles = [];

  /** Criba g por la cadena desde el nivel k: devuelve { resto, nivel }. */
  function cribar(g, k = 0) {
    for (; k < niveles.length; k++) {
      const N = niveles[k];
      const t = N.rep.get(g[N.punto]);
      if (!t) return { resto: g, nivel: k };
      g = producto(g, N.inv.get(g[N.punto]));
    }
    return { resto: g, nivel: k };
  }

  function nuevoNivel(punto) {
    const id = new Int16Array(n); for (let i = 0; i < n; i++) id[i] = i;
    const N = { punto, gens: [], rep: new Map([[punto, id]]), inv: new Map([[punto, id]]) };
    niveles.push(N);
    return N;
  }

  /**
   * Añade el generador g, que fija los puntos de base de los niveles < k: es
   * generador de los niveles 0..k (sus órbitas tienen que cerrarse con él).
   */
  function anadir(g, k) {
    if (k === niveles.length) {
      let p = 0;
      while (g[p] === p) p++;
      nuevoNivel(p);
    }
    for (let j = k; j >= 0; j--) extender(g, j);
  }

  function extender(g, k) {
    const N = niveles[k];
    N.gens.push(g);
    // Ampliar la órbita del punto base con el generador nuevo, y los
    // generadores de Schreier de los representantes que ya había
    const cola = [];
    for (const [img, t] of N.rep) cola.push([img, t]);
    const viejos = new Set(N.rep.keys());
    let i = 0;
    const pendientes = [];
    while (i < cola.length) {
      const [img, t] = cola[i++];
      const gensProbar = viejos.has(img) ? [g] : N.gens;
      for (const s of gensProbar) {
        const ts = producto(t, s);
        const j = ts[N.punto];
        const r = N.rep.get(j);
        if (!r) {
          N.rep.set(j, ts);
          N.inv.set(j, inversa(ts));
          cola.push([j, ts]);
        } else {
          pendientes.push(producto(ts, N.inv.get(j)));
        }
      }
    }
    // Generadores de Schreier: se criban en los niveles siguientes
    for (const h of pendientes) incluir(h, k + 1);
  }

  /** Incluye g en el grupo (a partir del nivel k). Devuelve true si lo amplió. */
  function incluir(g, k = 0) {
    const { resto, nivel } = cribar(g, k);
    if (esId(resto)) return false;
    anadir(resto, nivel);
    return true;
  }

  return {
    incluir,
    /** true si g pertenece al grupo. */
    contiene(g) { return esId(cribar(g).resto); },
    /** Orden del grupo (BigInt). */
    orden() { let o = 1n; for (const N of niveles) o *= BigInt(N.rep.size); return o; },
    /** Elemento uniforme del grupo. */
    aleatorio(rng) {
      let g = new Int16Array(n); for (let i = 0; i < n; i++) g[i] = i;
      for (let k = niveles.length - 1; k >= 0; k--) {
        const reps = [...niveles[k].rep.values()];
        g = producto(g, reps[Math.floor(rng() * reps.length)]);
      }
      return g;
    },
    niveles,
  };
}

export const permProducto = producto;
export const permInversa = inversa;
export const permEsIdentidad = esId;
