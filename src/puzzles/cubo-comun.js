// Piezas, nombres y mensajes del validador comunes al 2x2 y al 3x3.

import { geometriaNxN, CARAS, PALETA_CUBO } from './nxn.js';
import { cierreGrupo, permutacionesDeColor } from '../core/simetria.js';

export const NOMBRES_ESQUINAS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
export const NOMBRES_ARISTAS = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
const VEC = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };

const det = (a, b, c) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);

/**
 * Pegatinas de cada pieza de un cubo N (esquinas y, si N=3, aristas), en el
 * orden de Kociemba: primero la pegatina U/D (o F/B en las aristas del
 * ecuador) y después en sentido horario.
 */
export function piezasCubo(N) {
  const geo = geometriaNxN(N);
  const idx = (cara, coords) => {
    const n = VEC[cara];
    const p = [0, 1, 2].map((k) => (n[k] !== 0 ? N * n[k] : coords[k] * (N - 1)));
    return geo.indice.get(p.join(','));
  };
  const esquinas = NOMBRES_ESQUINAS.map((nom) => {
    const caras = nom.split('');
    const d = [0, 0, 0];
    for (const c of caras) for (let k = 0; k < 3; k++) d[k] += VEC[c][k];
    let [a, b, c] = caras;
    if (det(VEC[a], VEC[b], VEC[c]) > 0) [b, c] = [c, b];
    return [a, b, c].map((cara) => idx(cara, d));
  });
  const aristas = N === 3 ? NOMBRES_ARISTAS.map((nom) => {
    const caras = nom.split('');
    const d = [0, 0, 0];
    for (const c of caras) for (let k = 0; k < 3; k++) d[k] += VEC[c][k];
    return caras.map((cara) => idx(cara, d));
  }) : [];
  return { esquinas, aristas };
}

/** Permutaciones de color de las 24 rotaciones del cubo. */
export function rotacionesColorCubo(N) {
  const geo = geometriaNxN(N);
  const rots = cierreGrupo([geo.rot.x, geo.rot.y]);
  const resuelto = [];
  for (let f = 0; f < 6; f++) for (let i = 0; i < N * N; i++) resuelto.push(f);
  const rep = CARAS.map((_, f) => f * N * N); // primera pegatina de cada cara
  return permutacionesDeColor(rots, resuelto, rep);
}

export const nombreColor = (c) => (PALETA_CUBO[c] ? PALETA_CUBO[c].nombre : 'sin color');
export const listaColores = (cs) => cs.map(nombreColor).join('-');

/** Comprueba que haya exactamente `porColor` pegatinas de cada uno de los 6 colores. */
export function comprobarConteo(estado, porColor) {
  const errores = [];
  const cuenta = new Array(6).fill(0);
  let vacias = 0;
  for (const c of estado) {
    if (c >= 0 && c < 6) cuenta[c]++;
    else vacias++;
  }
  if (vacias) errores.push(`Hay ${vacias} pegatina${vacias > 1 ? 's' : ''} sin pintar.`);
  cuenta.forEach((n, c) => {
    if (n !== porColor) {
      errores.push(`Hay ${n} pegatina${n === 1 ? '' : 's'} de color ${nombreColor(c)} y debería haber ${porColor}.`);
    }
  });
  return errores;
}

/** Mensajes para piezas imposibles, repetidas o que faltan. */
export function erroresDePiezas(ident, nombresPosicion, nombreTipo, coloresPieza) {
  const errores = [];
  for (const e of ident.errores) {
    const pos = nombresPosicion[e.oi][e.pos];
    const cols = listaColores(e.colores);
    const tipo = nombreTipo[e.oi];
    if (e.tipo === 'espejo') {
      errores.push(`La ${tipo} en la posición ${pos} (${cols}) tiene los colores en un orden imposible: es la imagen especular de una pieza real. Probablemente hay dos pegatinas cambiadas.`);
    } else {
      const repe = new Set(e.colores).size < e.colores.length;
      const opuestos = e.colores.some((a) => e.colores.some((b) => a >= 0 && b >= 0 && (a + 3) % 6 === b));
      let porque = '';
      if (repe) porque = ' (tiene un color repetido)';
      else if (opuestos) porque = ' (tiene dos colores de caras opuestas)';
      errores.push(`La ${tipo} en la posición ${pos} (${cols}) no existe en un cubo real${porque}.`);
    }
  }
  if (ident.errores.length === 0) {
    ident.orbitas.forEach((o, oi) => {
      const veces = new Array(o.perm.length).fill(0);
      o.perm.forEach((id) => { if (id >= 0) veces[id]++; });
      veces.forEach((v, id) => {
        const cols = listaColores(coloresPieza[oi][id]);
        if (v > 1) errores.push(`La ${nombreTipo[oi]} ${cols} aparece ${v} veces.`);
        if (v === 0) errores.push(`Falta la ${nombreTipo[oi]} ${cols}.`);
      });
    });
  }
  return errores;
}
