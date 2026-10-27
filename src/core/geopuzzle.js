// Construcción de puzzles de pegatinas a partir de geometría 3D
// (Pyraminx, Skewb, Megaminx). Ver geometria.js.

import {
  construirPegatinas, permDeGiro, desplegar, unit, dot, cruz, res, esc, centroide, norma,
} from './geometria.js';
import { componer, identidad, aplicarPerm } from './perm.js';
import { cierreGrupo } from './simetria.js';

/**
 * def: {
 *   caras: [{normal, poligono}],
 *   cortes: [{n, h}],
 *   giros: { nombre: { eje, ang, umbral } }   // gira las pegatinas con eje·centro > umbral
 *   rotaciones: [{ eje, ang }]                // generadores de las rotaciones del puzzle entero
 *   red: { arboles: [{ raiz, arriba, hijos, origen }] } // despliegue 2D
 *   encoger: 0.9
 * }
 */
export function crearGeoPuzzle(def) {
  const pegatinas = construirPegatinas(def.caras, def.cortes);
  const n = pegatinas.length;
  const perms = {};
  for (const [nombre, g] of Object.entries(def.giros)) {
    const e = unit(g.eje);
    perms[nombre] = permDeGiro(pegatinas, e, g.ang, (c) => dot(c, e) > g.umbral + 1e-9);
  }
  const rotaciones = def.rotaciones
    ? cierreGrupo(def.rotaciones.map((r) => permDeGiro(pegatinas, unit(r.eje), r.ang, () => true)))
    : [identidad(n)];

  // Estado resuelto: color = índice de la cara
  const resuelto = pegatinas.map((p) => p.cara);
  const porCara = def.caras.map((_, f) => pegatinas.filter((p) => p.cara === f).length);

  // Despliegue 2D
  const pegatinas2D = new Array(n);
  for (const arbol of def.red.arboles) {
    const mapas = desplegar(def.caras, arbol, arbol.origen || [0, 0]);
    const incluidas = new Set([arbol.raiz, ...arbol.hijos.map((h) => h[0])]);
    pegatinas.forEach((p, i) => {
      if (!incluidas.has(p.cara)) return;
      let poly = p.poligono.map(mapas[p.cara]);
      if (arbol.transformar) poly = poly.map(arbol.transformar);
      pegatinas2D[i] = { poligono: encoger2D(poly, def.encoger ?? 0.9) };
    });
  }

  /** Agrupa pegatinas en piezas según una clave (función del centro de la pegatina). */
  function piezasPor(clave, filtro = () => true) {
    const grupos = new Map();
    pegatinas.forEach((p, i) => {
      if (!filtro(p, i)) return;
      const k = clave(p.centro, i);
      if (k === null) return;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(i);
    });
    return [...grupos.entries()].map(([k, l]) => ({ clave: k, pegatinas: ordenarHorario(l) }));
  }

  /** Ordena las pegatinas de una pieza en sentido horario visto desde fuera. */
  function ordenarHorario(lista) {
    if (lista.length < 3) return lista;
    const d = unit(centroide(lista.map((i) => pegatinas[i].centro)));
    const c0 = pegatinas[lista[0]].centro;
    const u = unit(res(c0, esc(d, dot(c0, d))));
    const w = cruz(d, u);
    const ang = (i) => {
      const c = pegatinas[i].centro;
      const a = Math.atan2(dot(c, w), dot(c, u));
      return a < -1e-9 ? a + 2 * Math.PI : a;
    };
    // horario visto desde fuera = ángulo decreciente
    return lista.slice().sort((a, b) => ang(b) - ang(a));
  }

  return {
    pegatinas, n, perms, rotaciones, resuelto, porCara, pegatinas2D, piezasPor,
    aplicar: (estado, nombre) => aplicarPerm(estado, perms[nombre]),
    componer: (a, b) => componer(perms[a], perms[b]),
    norma,
  };
}

function encoger2D(poly, k) {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  cx /= poly.length; cy /= poly.length;
  return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}
