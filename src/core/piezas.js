// Modelo de piezas genérico construido a partir de permutaciones de pegatinas.
//
// Una "órbita" es un conjunto de piezas que intercambian posiciones entre sí
// (esquinas, aristas, centros...). Cada pieza es una lista de pegatinas en un
// orden cíclico coherente. La orientación o de una pieza significa que su
// pegatina j está en el hueco (j + o) mod m de la posición que ocupa.
//
// Con esto se obtiene, de forma automática:
//   - identificar cada pieza a partir de los colores (validador),
//   - el efecto de cada movimiento sobre posiciones y orientaciones,
//   - coordenadas (índice de permutación / de orientación) para las búsquedas.

import { indicePerm, permDeIndice, factorial } from './perm.js';

export function crearModeloPiezas({ orbitas, movimientos, coloresResuelto }) {
  // Hueco -> (posición, índice) para cada órbita
  const huecoDe = new Map();
  orbitas.forEach((orb, oi) => {
    orb.piezas.forEach((pz, p) => pz.forEach((f, t) => huecoDe.set(f, { oi, p, t })));
  });

  // Colores de cada pieza resuelta
  const coloresPieza = orbitas.map((orb) => orb.piezas.map((pz) => pz.map((f) => coloresResuelto[f])));

  // Efecto de cada movimiento a nivel de piezas
  const movPiezas = {};
  for (const [nombre, P] of Object.entries(movimientos)) {
    movPiezas[nombre] = orbitas.map((orb, oi) => {
      const n = orb.piezas.length;
      const m = orb.piezas[0].length;
      const orig = new Array(n), delta = new Array(n);
      for (let p = 0; p < n; p++) {
        const g = P[orb.piezas[p][0]];
        const h = huecoDe.get(g);
        if (!h || h.oi !== oi) throw new Error(`Modelo de piezas: el movimiento ${nombre} saca una pieza de su órbita (${orb.nombre})`);
        orig[p] = h.p;
        delta[p] = (m - h.t) % m;
        // Comprobar que el orden cíclico se respeta
        for (let k = 0; k < m; k++) {
          const gk = P[orb.piezas[p][k]];
          if (gk !== orb.piezas[h.p][(h.t + k) % m]) {
            throw new Error(`Modelo de piezas: orden cíclico incoherente en ${orb.nombre}, movimiento ${nombre}`);
          }
        }
      }
      return { orig, delta };
    });
  }

  /**
   * Identifica las piezas a partir de los colores de las pegatinas.
   * Devuelve { orbitas: [{perm, ori}], errores: [{tipo, orbita, pos, colores}] }
   * tipo: 'inexistente' (combinación de colores imposible) o 'espejo' (colores
   * correctos pero en orden imposible).
   */
  function identificar(colores) {
    const errores = [];
    const res = orbitas.map((orb, oi) => {
      const m = orb.piezas[0].length;
      const perm = [], ori = [];
      orb.piezas.forEach((pz, p) => {
        const c = pz.map((f) => colores[f]);
        let encontrada = -1, o = 0;
        for (let i = 0; i < coloresPieza[oi].length && encontrada < 0; i++) {
          const s = coloresPieza[oi][i];
          for (let r = 0; r < m; r++) {
            let ok = true;
            for (let j = 0; j < m; j++) if (c[(j + r) % m] !== s[j]) { ok = false; break; }
            if (ok) { encontrada = i; o = r; break; }
          }
        }
        if (encontrada < 0) {
          // ¿Coinciden los colores como conjunto con alguna pieza?
          const clave = c.slice().sort().join(',');
          const espejo = coloresPieza[oi].some((s) => s.slice().sort().join(',') === clave);
          errores.push({ tipo: espejo ? 'espejo' : 'inexistente', orbita: orb.nombre, oi, pos: p, colores: c });
        }
        perm.push(encontrada);
        ori.push(o);
      });
      return { perm, ori };
    });
    return { orbitas: res, errores };
  }

  /** Pegatinas a partir de un estado de piezas (solo rellena las pegatinas de las órbitas). */
  function aColores(estadoPiezas, base) {
    const colores = base.slice();
    orbitas.forEach((orb, oi) => {
      const m = orb.piezas[0].length;
      const { perm, ori } = estadoPiezas[oi];
      orb.piezas.forEach((pz, p) => {
        const s = coloresPieza[oi][perm[p]];
        for (let j = 0; j < m; j++) colores[pz[(j + ori[p]) % m]] = s[j];
      });
    });
    return colores;
  }

  function aplicarPiezas(estadoPiezas, nombre) {
    return movPiezas[nombre].map(({ orig, delta }, oi) => {
      const m = orbitas[oi].piezas[0].length;
      const { perm, ori } = estadoPiezas[oi];
      return {
        perm: orig.map((q) => perm[q]),
        ori: orig.map((q, p) => (ori[q] + delta[p]) % m),
      };
    });
  }

  // ---------- Coordenadas ----------
  function coordPerm(oi) {
    const n = orbitas[oi].piezas.length;
    return {
      nombre: orbitas[oi].nombre + ':perm',
      tam: factorial(n),
      codificar: (est) => indicePerm(est[oi].perm),
      mover(idx, mov) {
        const p = permDeIndice(idx, n);
        const { orig } = movPiezas[mov][oi];
        return indicePerm(orig.map((q) => p[q]));
      },
    };
  }
  function coordOri(oi) {
    const n = orbitas[oi].piezas.length;
    const m = orbitas[oi].piezas[0].length;
    const tam = m ** n;
    const dec = (idx) => {
      const o = new Array(n);
      for (let i = n - 1; i >= 0; i--) { o[i] = idx % m; idx = Math.floor(idx / m); }
      return o;
    };
    const cod = (o) => o.reduce((a, x) => a * m + x, 0);
    return {
      nombre: orbitas[oi].nombre + ':ori',
      tam,
      codificar: (est) => cod(est[oi].ori),
      mover(idx, mov) {
        const o = dec(idx);
        const { orig, delta } = movPiezas[mov][oi];
        return cod(orig.map((q, p) => (o[q] + delta[p]) % m));
      },
    };
  }

  const resuelto = orbitas.map((orb) => ({
    perm: orb.piezas.map((_, i) => i),
    ori: orb.piezas.map(() => 0),
  }));

  return { orbitas, movPiezas, identificar, aColores, aplicarPiezas, coordPerm, coordOri, resuelto };
}

/**
 * Buscador IDA* genérico sobre coordenadas.
 * coords: [{tam, mover(idx, mov), nombre}]
 * movs: nombres de movimientos; ejes: eje de cada movimiento (no se repite eje seguido)
 * podas: listas de índices de coordenadas; para cada lista se genera una tabla BFS.
 * objetivo: valores de las coordenadas en el estado resuelto.
 */
export function crearBuscador({ coords, movs, ejes, podas, objetivo }) {
  const nM = movs.length;
  const t0 = Date.now();
  const tablas = coords.map((c) => {
    const t = new Int32Array(c.tam * nM);
    for (let i = 0; i < c.tam; i++) for (let m = 0; m < nM; m++) t[i * nM + m] = c.mover(i, movs[m]);
    return t;
  });

  const tablasPoda = podas.map((lista) => {
    const tams = lista.map((ci) => coords[ci].tam);
    const total = tams.reduce((a, b) => a * b, 1);
    const prof = new Int8Array(total).fill(-1);
    const idxDe = (vals) => vals.reduce((a, v, k) => a * tams[k] + v, 0);
    const valsDe = (idx) => {
      const v = new Array(lista.length);
      for (let k = lista.length - 1; k >= 0; k--) { v[k] = idx % tams[k]; idx = Math.floor(idx / tams[k]); }
      return v;
    };
    prof[idxDe(lista.map((ci) => objetivo[ci]))] = 0;
    let d = 0, cambiado = true;
    while (cambiado) {
      cambiado = false;
      for (let i = 0; i < total; i++) {
        if (prof[i] !== d) continue;
        const v = valsDe(i);
        for (let m = 0; m < nM; m++) {
          const w = v.map((x, k) => tablas[lista[k]][x * nM + m]);
          const j = idxDe(w);
          if (prof[j] < 0) { prof[j] = d + 1; cambiado = true; }
        }
      }
      d++;
    }
    return { lista, tams, prof, idxDe };
  });
  const msInit = Date.now() - t0;

  /** ¿Es alcanzable cada coordenada por separado? (para el validador) */
  const alcanzable = (vals) => tablasPoda.every((tp) => tp.prof[tp.idxDe(tp.lista.map((ci) => vals[ci]))] >= 0);

  function heuristica(vals) {
    let h = 0;
    for (const tp of tablasPoda) {
      let idx = 0;
      for (let k = 0; k < tp.lista.length; k++) idx = idx * tp.tams[k] + vals[tp.lista[k]];
      const d = tp.prof[idx];
      if (d < 0) return Infinity;
      if (d > h) h = d;
    }
    return h;
  }

  /** Devuelve la lista de movimientos (óptima con respecto a `movs`) o null. */
  function resolver(vals0, maxProf = 30) {
    const h0 = heuristica(vals0);
    if (h0 === Infinity) return null;
    const camino = [];
    const nC = coords.length;
    let nodos = 0;
    function dfs(vals, g, limite, ultimoEje) {
      const h = heuristica(vals);
      if (h === 0) {
        let ok = true;
        for (let k = 0; k < nC; k++) if (vals[k] !== objetivo[k]) { ok = false; break; }
        if (ok) return true;
      }
      if (g + Math.max(h, 1) > limite) return false;
      for (let m = 0; m < nM; m++) {
        if (ejes[m] === ultimoEje) continue;
        nodos++;
        const w = new Array(nC);
        for (let k = 0; k < nC; k++) w[k] = tablas[k][vals[k] * nM + m];
        camino.push(m);
        if (dfs(w, g + 1, limite, ejes[m])) return true;
        camino.pop();
      }
      return false;
    }
    for (let lim = h0; lim <= maxProf; lim++) {
      if (dfs(vals0, 0, lim, -1)) return { movimientos: camino.map((m) => movs[m]), nodos };
    }
    return null;
  }

  return { resolver, heuristica, alcanzable, tablas, tablasPoda, msInit, movs };
}
