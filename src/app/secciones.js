// @ts-check
// Secciones de la app y navegación por hash (#/, #/wca, #/wca/<id>, #/bandaged).
//
// SECCIONES es la única lista: la portada pinta una tarjeta por sección y el router
// solo deja entrar en las 'disponible'. Añadir una sección o desbloquearla es
// cambiar una línea aquí (y, si es una herramienta nueva, decir en main.js qué
// puzzles muestra). Los nombres van en inglés: así se llaman en la comunidad.
// Sin DOM: lo usan main.js y los tests.
// Tipos: Seccion y Ruta en src/core/tipos.d.ts.

/** @import { Seccion, Ruta } from '../core/tipos.js' */

/** @type {Seccion[]} */
export const SECCIONES = [
  { id: 'wca', nombre: 'WCA Puzzles', descripcion: '2x2–7x7 · Pyraminx · Skewb · Square-1 · Megaminx · FTO', descripcionCorta: '2x2–7x7 · Pyraminx · Skewb · Square-1 · Megaminx · FTO', estado: 'disponible', estilo: 'acento' },
  { id: 'bandaged', nombre: 'Bandaged Cubes', descripcion: '3x3 con tus bloques · firmas de la comunidad', descripcionCorta: '3x3 con tus bloques', estado: 'disponible', estilo: 'suave' },
  { id: 'shape-mods', nombre: 'Shape Mods', descripcion: 'Mirror, Axis, Fisher…', estado: 'bloqueada' },
  { id: 'cuboids', nombre: 'Cuboids', descripcion: '2x2x3, 3x3x2, 3x3x4…', estado: 'bloqueada' },
  { id: 'others', nombre: 'Others', descripcion: 'Clover Cube, Kilominx…', estado: 'bloqueada' },
];

/** Textos de cabecera de cada sección con herramienta (en español). @type {Record<string, string>} */
export const INTRO_SECCION = {
  wca: 'Scrambles oficiales, validador de estados y solucionador de los puzzles de la WCA, con la solución animada en 3D y el modo aprender.',
  bandaged: 'Un 3x3 con piezas pegadas entre sí: crea tus bloques tocando el cubo, carga ejemplos o firmas de la comunidad, y obtén scrambles y soluciones con giros legales.',
};

/** @param {string} id @returns {Seccion | null} */
export const seccion = (id) => SECCIONES.find((s) => s.id === id) || null;
/** @param {string} id */
export const disponible = (id) => !!seccion(id) && /** @type {Seccion} */ (seccion(id)).estado === 'disponible';

/**
 * Lee la ruta de la URL.
 *   #/  (o nada)          -> { seccion: 'portada' }
 *   #/como-funciona       -> { seccion: 'portada', ancla: 'como-funciona' }
 *   #/wca, #/wca/<id>     -> { seccion: 'wca', puzzle: id | null }
 *   #/bandaged[?bloqueos=…|?firma=…] -> { seccion: 'bandaged', consulta }
 * Enlaces antiguos (antes de las secciones): #bloqueos=…, #firma=…, ?bloqueos=…, ?firma=…
 * abren Bandaged Cubes con esa configuración (antigua: true; main.js reescribe la URL).
 * Una sección bloqueada o desconocida -> portada con redirigir: true.
 * consulta = texto "bloqueos=…" o "firma=…" (sin '?'), o '' si no hay.
 * @param {string} [hash]
 * @param {string} [search]
 * @returns {Ruta}
 */
export function leerRuta(hash = '', search = '') {
  const h = (hash || '').replace(/^#/, '');
  const s = (search || '').replace(/^\?/, '');
  /** @param {string} q */
  const conConfig = (q) => /(^|&)(bloqueos|firma)=/.test(q);
  // enlaces antiguos: la configuración del vendado en el hash sin ruta o en la búsqueda
  if (!h.startsWith('/') && conConfig(h)) return { seccion: 'bandaged', consulta: h, antigua: true };
  if (conConfig(s) && !(h.startsWith('/bandaged') && conConfig(h))) return { seccion: 'bandaged', consulta: s, antigua: true };
  if (!h.startsWith('/')) return { seccion: 'portada', redirigir: h !== '' };
  const [ruta, consulta = ''] = h.slice(1).split('?');
  const partes = ruta.split('/').filter(Boolean).map((x) => decodeURIComponent(x));
  if (!partes.length) return { seccion: 'portada' };
  if (partes[0] === 'como-funciona' && partes.length === 1) return { seccion: 'portada', ancla: 'como-funciona' };
  if (!disponible(partes[0])) return { seccion: 'portada', redirigir: true };
  if (partes[0] === 'wca') return { seccion: 'wca', puzzle: partes[1] || null };
  if (partes[0] === 'bandaged') return { seccion: 'bandaged', consulta: conConfig(consulta) ? consulta : '' };
  return { seccion: partes[0] };
}

/** Hash de una ruta (lo contrario de leerRuta). @param {Ruta} ruta */
export function hashDe({ seccion: id, puzzle, consulta }) {
  if (!id || id === 'portada') return '#/';
  if (id === 'wca') return puzzle ? `#/wca/${encodeURIComponent(puzzle)}` : '#/wca';
  if (id === 'bandaged') return consulta ? `#/bandaged?${consulta}` : '#/bandaged';
  return `#/${id}`;
}
