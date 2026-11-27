// Escena 3D sin WebGL: triángulos, colores, giro en curso, resaltado y selección
// por rayo. La dibuja vista3d.js; los tests la usan directamente (sin navegador).

import { rotacion } from '../core/geometria.js';
import { centrosTrasGiro } from '../core/modelo3d.js';

const ENCOGER = 0.9;      // tamaño de la pegatina respecto a su hueco (el resto se ve negro)
const ELEVAR = 0.006;     // separación de la pegatina sobre el cuerpo (fracción del radio)
export const COLOR_CUERPO = [0.07, 0.07, 0.08];
export const COLOR_SIN_PINTAR = [0.54, 0.56, 0.61];
export const COLOR_HUECO_METAL = [0.25, 0.3, 0.42];

export function hexARgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

/**
 * paleta: [{hex}] del puzzle.
 * Uso: mostrar({geometria, colores}); giro(partes, fraccion); buffers(); elegir(origen, dir).
 */
export function crearEscena3D(paleta) {
  let rgb = paleta.map((c) => hexARgb(c.hex));
  let geometria = null, colores = [], partes = [], fraccion = 0;
  let resaltadas = null, modoResalte = 'brillo';
  let triangulosGeo = null; // caché de triángulos de la geometría actual
  let version = 0;          // cambia cuando hay que rehacer los buffers de posiciones

  function triangular(geo) {
    // por pegatina: polígono entero (cuerpo negro) + pegatina encogida y algo elevada
    const tri = []; // { k, cuerpo, a, b, c }
    const elev = ELEVAR * geo.radio;
    geo.pegatinas.forEach((p, k) => {
      const c = p.centro || p.puntos.reduce((s, q) => [s[0] + q[0] / p.puntos.length, s[1] + q[1] / p.puntos.length, s[2] + q[2] / p.puntos.length], [0, 0, 0]);
      const peg = p.puntos.map((q) => [0, 1, 2].map((i) => c[i] + (q[i] - c[i]) * ENCOGER + p.normal[i] * elev));
      // Piezas pegadas (cubos vendados): los lados marcados en p.expandir llegan al
      // borde, así dos pegatinas vecinas del mismo bloque se tocan (sin hueco negro)
      if (p.expandir) {
        const n = p.puntos.length;
        for (let i = 0; i < n; i++) {
          if (!p.expandir[i]) continue;
          const a = p.puntos[i], b = p.puntos[(i + 1) % n];
          const off = [0, 1, 2].map((j) => ((a[j] + b[j]) / 2 - c[j]) * (1 - ENCOGER));
          for (const v of [i, (i + 1) % n]) for (let j = 0; j < 3; j++) peg[v][j] += off[j];
        }
      }
      for (let i = 1; i + 1 < p.puntos.length; i++) {
        tri.push({ k, cuerpo: true, v: [p.puntos[0], p.puntos[i], p.puntos[i + 1]] });
        tri.push({ k, cuerpo: false, v: [peg[0], peg[i], peg[i + 1]] });
      }
    });
    return tri;
  }

  const api = {
    get geometria() { return geometria; },
    get colores() { return colores; },
    get version() { return version; },
    get partes() { return partes; },
    get fraccion() { return fraccion; },
    /** Cambia la paleta (al cambiar de puzzle). */
    fijarPaleta(p) { rgb = p.map((c) => hexARgb(c.hex)); version++; },
    /** Muestra un estado: vista = puzzle.vista3D(estado). Quita el giro en curso. */
    mostrar(vista) {
      if (vista.geometria !== geometria) {
        geometria = vista.geometria;
        triangulosGeo = triangular(geometria);
        version++;
        resaltadas = null;
      }
      colores = vista.colores.slice();
      partes = [];
      fraccion = 0;
    },
    /** Giro en curso: partes de puzzle.giro3D(estado, mov) (sobre la geometría mostrada) y fracción 0..1. */
    giro(p, f) {
      if (p.length > 2) throw new Error('La vista 3D admite como mucho dos partes girando a la vez');
      if (p !== partes) { partes = p; version++; }
      fraccion = f;
    },
    /** Resalta unas pegatinas (índices de la geometría); null quita el resaltado. modo: 'brillo' | 'transparencia'. */
    resaltar(indices, modo = 'brillo') {
      resaltadas = indices ? new Set(indices) : null;
      modoResalte = modo;
      version++;
    },
    get resaltado() { return resaltadas ? { indices: [...resaltadas], modo: modoResalte } : null; },
    /** Ángulo actual de cada parte que gira (para las matrices del shader). */
    rotacionesActuales() { return partes.map((p) => ({ eje: p.eje, angulo: p.angulo * fraccion })); },
    /** Arrays para WebGL. */
    buffers() {
      const tri = triangulosGeo || [];
      const n = tri.length * 3;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
      const parte = new Float32Array(n), res = new Float32Array(n);
      const parteDe = new Int8Array(geometria ? geometria.pegatinas.length : 0);
      partes.forEach((p, j) => { for (const k of p.pegatinas) parteDe[k] = j + 1; });
      let v = 0;
      for (const t of tri) {
        const p = geometria.pegatinas[t.k];
        // (shape mods, noche 16: con la luz metálica el gris de siempre parece plata; el hueco vacío, más oscuro)
        const c = t.cuerpo ? COLOR_CUERPO : (rgb[colores[t.k]] || (geometria.material === 'metal' ? COLOR_HUECO_METAL : COLOR_SIN_PINTAR));
        const r = resaltadas ? (resaltadas.has(t.k) ? 1 : 0) : 1;
        for (const q of t.v) {
          pos.set(q, v * 3); nor.set(p.normal, v * 3); col.set(c, v * 3);
          parte[v] = parteDe[t.k]; res[v] = r;
          v++;
        }
      }
      return { pos, nor, col, parte, res, n };
    },
    /** Centros actuales de las pegatinas (con el giro en curso) y sus colores: lo que se ve, sin dibujarlo. */
    foto() {
      return { centros: centrosTrasGiro(geometria, partes, fraccion), colores: colores.slice() };
    },
    /**
     * Pegatina que corta un rayo (en coordenadas del puzzle), sin giro en curso.
     * Devuelve el índice en la geometría o -1.
     */
    elegir(origen, dir) {
      if (!geometria) return -1;
      let mejor = -1, tMin = Infinity;
      const rots = partes.map((p) => rotacion(p.eje, -p.angulo * fraccion));
      geometria.pegatinas.forEach((p, k) => {
        let o = origen, d = dir;
        const j = partes.findIndex((q) => q.pegatinas.includes(k));
        if (j >= 0) { o = rots[j](origen); d = rots[j](dir); }
        const den = d[0] * p.normal[0] + d[1] * p.normal[1] + d[2] * p.normal[2];
        if (den >= -1e-9) return; // de espaldas
        const q0 = p.puntos[0];
        const t = ((q0[0] - o[0]) * p.normal[0] + (q0[1] - o[1]) * p.normal[1] + (q0[2] - o[2]) * p.normal[2]) / den;
        if (t <= 0 || t >= tMin) return;
        const x = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
        if (dentroPoligono(p.puntos, p.normal, x)) { tMin = t; mejor = k; }
      });
      return mejor;
    },
  };
  return api;
}

function dentroPoligono(pts, n, x) {
  let signo = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [x[0] - a[0], x[1] - a[1], x[2] - a[2]];
    const c = (e[1] * w[2] - e[2] * w[1]) * n[0] + (e[2] * w[0] - e[0] * w[2]) * n[1] + (e[0] * w[1] - e[1] * w[0]) * n[2];
    if (Math.abs(c) < 1e-12) continue;
    const s = Math.sign(c);
    if (signo === 0) signo = s; else if (s !== signo) return false;
  }
  return true;
}
