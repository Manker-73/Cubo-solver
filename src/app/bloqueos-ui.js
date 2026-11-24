// Interfaz de los bloqueos (cubo vendado): sección "Bloqueos" de los puzzles con
// soporte de bloqueos (3x3 y, desde la noche 13, 4x4 y 5x5; las firmas de la comunidad
// son solo del 3x3). El usuario toca piezas en el editor (2D o 3D) para
// agruparlas; puede crear varios bloques con colores distintos, editarlos y
// borrarlos, cargar ejemplos, guardar sus configuraciones en el navegador,
// compartirlas por URL e importar o exportar la firma de la comunidad.
//
// main.js le pasa lo que necesita (ctx) y le delega el editor mientras se editan
// los bloques (editando(), tocar(i), dibujar(...)).

import { puzzleConBloqueos, comprobarBloqueos, claveBloqueos, formatearNumero } from '../core/bloqueos.js';
import { bloquesDesdeFirma, firmaDesdeBloques } from '../puzzles/nxn-bloqueos.js';

export const COLORES_BLOQUE = ['#ff3ea5', '#14c7e8', '#9ad11f', '#a66cff', '#ff8a1f', '#16b89a', '#f5c400', '#ff5a5a', '#6b7cff', '#d946ef'];
const CLAVE_GUARDADAS = 'cubo-solver:bloqueos-guardados';
const CLAVE_ACTUAL = 'cubo-solver:bloqueos';
/** Clave del almacenamiento de los bloques aplicados de un puzzle (la del 3x3, la de siempre). */
const claveActual = (url = '3x3') => (url === '3x3' ? CLAVE_ACTUAL : `${CLAVE_ACTUAL}:${url}`);

/** Texto de una configuración para la URL: grupos separados por "-", piezas por ".". */
export const textoDeBloqueos = (def) => claveBloqueos(def);
export function bloqueosDeTexto(t) {
  if (!t) return [];
  return decodeURIComponent(t).split('-').map((g) => g.split('.').filter(Boolean)).filter((g) => g.length);
}

/**
 * Configuración pedida en la URL (#bloqueos=... o ?bloqueos=... o ?firma=...), o null. Con las secciones (noche 11) main.js le pasa la consulta de #/bandaged?… como hash.
 * url: el puzzle (3x3, 4x4, 5x5): las firmas solo valen en el 3x3.
 */
export function bloqueosDeURL(loc = typeof location !== 'undefined' ? location : null, url = '3x3') {
  if (!loc) return null;
  const params = new URLSearchParams((loc.hash || '').replace(/^#/, '') + '&' + (loc.search || '').replace(/^\?/, ''));
  try {
    if (params.get('firma') && url === '3x3') return bloquesDesdeFirma(params.get('firma'));
  } catch { return null; }
  if (params.has('bloqueos')) return bloqueosDeTexto(params.get('bloqueos'));
  return null;
}

/** Últimos bloques aplicados de un puzzle en este navegador. @param {string} [url] 3x3, 4x4 o 5x5 */
export function leerBloqueosGuardados(url = '3x3') {
  try { return JSON.parse(localStorage.getItem(claveActual(url)) || '[]') || []; } catch { return []; }
}

const aclarar = (hex, k) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const r = c.map((x) => Math.round(x + (200 - x) * k));
  return '#' + r.map((x) => x.toString(16).padStart(2, '0')).join('');
};

/**
 * ctx: { $, base: () => puzzle base (con soporteBloqueos) o null, aplicados: () => def,
 *        aplicar(def), pintarEditor(), quitarSolucion(), mensaje(tipo, texto), limpiarMensajes(),
 *        vistaEditor(): vista 3D del editor o null, vistaEditor2D: id del contenedor 2D, vistaCara: () => vista del editor }
 */
export function crearPanelBloqueos(ctx) {
  const { $ } = ctx;
  let grupos = [];     // borrador: [[clave, ...], ...]
  let actual = -1;     // grupo que se edita
  let editando = false;
  let analisis = null; // del Worker
  let guardadas = [];
  try { guardadas = JSON.parse(localStorage.getItem(CLAVE_GUARDADAS) || '[]') || []; } catch { guardadas = []; }
  const borradores = new Map(); // clave -> puzzle con bloqueos (para dibujar el borrador)

  const sop = () => ctx.base() && ctx.base().soporteBloqueos;
  const urlPuzzle = () => (ctx.puzzleURL ? ctx.puzzleURL() : '3x3');
  const piezaDePegatina = () => {
    const s = sop();
    const m = new Map();
    s.piezas.forEach((pz) => pz.puntos.forEach((p) => m.set(p, pz.clave)));
    return m;
  };
  const igualQueAplicados = () => claveBloqueos(grupos) === claveBloqueos(ctx.aplicados());

  function cargarBorrador(def) {
    grupos = (def || []).map((g) => g.slice());
    actual = grupos.length ? 0 : -1;
  }

  // ---------- dibujo del borrador en el editor ----------
  function puzzleBorrador() {
    const s = sop();
    const validos = grupos.filter((g) => g.length >= 2);
    const c = comprobarBloqueos(s, validos);
    // para dibujar, solo los bloques sin errores (los demás se ven con su color, sin unir)
    const ok = validos.filter((g) => comprobarBloqueos(s, [g]).errores.length === 0 && !c.errores.some((e) => g.some((k) => e.includes(` ${k} `))));
    const k = claveBloqueos(ok);
    if (!borradores.has(k)) borradores.set(k, puzzleConBloqueos(ctx.base(), ok));
    return borradores.get(k);
  }
  function paletaExtendida(base) {
    // 0..5 colores del cubo, 6..11 los mismos apagados, 12.. colores de los bloques
    return base.paleta.concat(base.paleta.map((c) => ({ nombre: c.nombre, hex: aclarar(c.hex, 0.55) })))
      .concat(COLORES_BLOQUE.map((hex, i) => ({ nombre: `bloque ${i + 1}`, hex })));
  }
  /** Dibuja el borrador (cubo resuelto con los bloques coloreados). */
  function dibujar() {
    const base = ctx.base();
    const p = puzzleBorrador();
    const estado = base.estadoResuelto();
    const deP = piezaDePegatina();
    const grupoDe = new Map();
    grupos.forEach((g, i) => g.forEach((k) => grupoDe.set(k, i)));
    const nPal = base.paleta.length;
    // (4x4 y 5x5: el estado es de identidades; sus colores los da el puzzle)
    const coloresEstado = base.colores ? base.colores(estado) : estado;
    const colores = coloresEstado.map((c, i) => {
      const g = grupoDe.get(deP.get(i));
      return g === undefined ? nPal + c : 2 * nPal + (g % COLORES_BLOQUE.length);
    });
    const pal = paletaExtendida(base);
    const delActual = new Set();
    if (actual >= 0 && grupos[actual]) estado.forEach((_, i) => { if (grupos[actual].includes(deP.get(i))) delActual.add(i); });
    const v = ctx.vistaEditor();
    if (v) {
      if (v._paleta !== pal) { v.fijarPaleta(pal); v._paleta = pal; }
      const vista = p.vista3D(estado);
      v.mostrar({ ...vista, colores: vista.geometria.pegatinas.map((q) => (q.indice == null ? -1 : colores[q.indice])) });
      v.resaltar(delActual.size ? vista.geometria.pegatinas.map((q, k) => (delActual.has(q.indice) ? k : -1)).filter((k) => k >= 0) : null, 'brillo');
      v._resalteEditor = true;
      return true;
    }
    const marcas = new Map([...delActual].map((i) => [i, '#161a22']));
    $(ctx.contenedor2D).innerHTML = p.renderizar(estado, {
      editable: true, editables: null, colores, paleta: pal, marcas, vista: ctx.vistaCara(),
    });
    return true;
  }

  function tocar(i) {
    const k = piezaDePegatina().get(i);
    if (!k) return;
    if (actual < 0 || !grupos[actual]) { grupos.push([]); actual = grupos.length - 1; }
    const g = grupos[actual];
    const j = g.indexOf(k);
    if (j >= 0) g.splice(j, 1);
    else {
      // una pieza solo puede estar en un bloque: se quita del otro
      grupos.forEach((h, hi) => { if (hi !== actual) { const x = h.indexOf(k); if (x >= 0) h.splice(x, 1); } });
      g.push(k);
    }
    pintar();
    ctx.pintarEditor();
  }

  // ---------- panel ----------
  function nombreGrupo(g) {
    return g.length ? g.join(' + ') : '(vacío: toca piezas en el cubo)';
  }
  function pintarConfigs() {
    const sel = $('bloq-config');
    const base = ctx.base();
    sel.innerHTML = '';
    const op = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
    sel.appendChild(op('', 'Elegir una configuración…'));
    sel.appendChild(op('vacia', `Sin bloqueos (${base.nombre} normal)`));
    const g1 = document.createElement('optgroup'); g1.label = 'Ejemplos';
    (base.ejemplosBloqueos || []).forEach((e) => g1.appendChild(op('ej:' + e.id, e.nombre)));
    sel.appendChild(g1);
    // las guardadas de este puzzle (las de antes de la noche 13 no llevan puzzle: son del 3x3)
    const delPuzzle = guardadas.map((e, i) => ({ e, i })).filter(({ e }) => (e.puzzle || '3x3') === urlPuzzle());
    if (delPuzzle.length) {
      const g2 = document.createElement('optgroup'); g2.label = 'Guardadas';
      delPuzzle.forEach(({ e, i }) => g2.appendChild(op('g:' + i, e.nombre)));
      sel.appendChild(g2);
    }
    sel.value = '';
  }
  function pintar() {
    const base = ctx.base();
    const panel = $('panel-bloqueos');
    panel.hidden = !base || !base.soporteBloqueos;
    if (panel.hidden) return;
    const aplicados = ctx.aplicados();
    $('bloq-resumen').textContent = aplicados.length ? `${aplicados.length} ${aplicados.length === 1 ? 'bloque' : 'bloques'}` : 'Sin bloqueos';
    const ul = $('bloq-grupos');
    ul.innerHTML = '';
    grupos.forEach((g, i) => {
      const li = document.createElement('li');
      li.className = 'bloq-grupo' + (editando && i === actual ? ' actual' : '');
      const m = document.createElement('span');
      m.className = 'muestra';
      m.style.background = COLORES_BLOQUE[i % COLORES_BLOQUE.length];
      const t = document.createElement('span');
      t.className = 'piezas';
      t.textContent = `Bloque ${i + 1}: ${nombreGrupo(g)}`;
      const be = document.createElement('button');
      be.type = 'button'; be.className = 'boton-texto'; be.textContent = editando && i === actual ? 'Editando' : 'Editar';
      be.dataset.accion = 'editar';
      be.addEventListener('click', () => { actual = i; empezarEdicion(); });
      const bb = document.createElement('button');
      bb.type = 'button'; bb.className = 'boton-texto'; bb.textContent = 'Borrar';
      bb.dataset.accion = 'borrar';
      bb.addEventListener('click', () => {
        grupos.splice(i, 1);
        if (actual >= grupos.length) actual = grupos.length - 1;
        pintar();
        if (editando) ctx.pintarEditor();
      });
      li.append(m, t, be, bb);
      ul.appendChild(li);
    });
    // errores del borrador al momento (sin esperar a las tablas)
    const c = comprobarBloqueos(base.soporteBloqueos, grupos.filter((g) => g.length));
    const ayuda = $('bloq-ayuda');
    const lineas = [];
    if (editando) lineas.push(`Toca piezas del cubo (en 2D o en 3D) para añadirlas al bloque ${actual + 1} o quitarlas. Los bloques se definen sobre el cubo resuelto.`);
    if (!igualQueAplicados()) lineas.push('Hay cambios sin aplicar.');
    ayuda.hidden = !lineas.length;
    ayuda.textContent = lineas.join(' ');
    const err = $('bloq-errores');
    err.innerHTML = '';
    for (const e of c.errores) { const d = document.createElement('div'); d.className = 'mensaje error'; d.textContent = e; err.appendChild(d); }
    for (const e of c.avisos) { const d = document.createElement('div'); d.className = 'mensaje info'; d.textContent = e; err.appendChild(d); }
    $('bloq-aplicar').disabled = c.errores.length > 0 || (igualQueAplicados() && !editando);
    $('bloq-aplicar').textContent = editando ? 'Terminar y aplicar' : 'Aplicar';
    $('bloq-quitar').disabled = !grupos.length;
    $('bloq-guardar').disabled = !grupos.some((g) => g.length >= 2);
    // firmas del Bandaged Cube Explorer: solo del 3x3
    $('bloq-firmas').hidden = urlPuzzle() !== '3x3';
    if (urlPuzzle() === '3x3') try { $('bloq-firma-actual').textContent = firmaDesdeBloques(aplicados) || '0'; } catch { $('bloq-firma-actual').textContent = '—'; }
    pintarAnalisis();
  }

  function pintarAnalisis() {
    const caja = $('bloq-analisis');
    const aplicados = ctx.aplicados();
    caja.innerHTML = '';
    if (!aplicados.length) { caja.hidden = true; return; }
    caja.hidden = false;
    const fila = (t, cls = '') => { const p = document.createElement('p'); p.textContent = t; if (cls) p.className = cls; caja.appendChild(p); };
    if (!analisis) { fila('Analizando la configuración y generando las tablas…', 'cargando'); return; }
    const a = analisis;
    for (const e of a.errores || []) fila(e, 'mensaje error');
    if (a.errores && a.errores.length) return;
    const caras = [...new Set((a.legalesResuelto || []).map((m) => m.replace(/['2]/g, '')))];
    fila(`Giros posibles con el cubo resuelto: ${caras.join(', ') || 'ninguno'}.`);
    if (a.estadosDistinguibles) {
      // 4x4, 5x5: los estados que se ven distintos (los centros iguales no se distinguen)
      fila(`Alcanzables: ${formatearNumero(a.geometrias)} geometrías${a.geometriasExacto ? '' : ' (o más)'} y ${formatearNumero(a.estadosDistinguibles)} estados distinguibles${a.distinguiblesExacto ? '' : ' (aprox.)'} (${formatearNumero(a.estados)} si los centros del mismo color se contaran como distintos).`);
    } else fila(`Alcanzables: ${formatearNumero(a.geometrias)} geometrías${a.geometriasExacto ? '' : ' (o más)'} y ${formatearNumero(a.estados)} estados${a.estadosExacto ? '' : ' (aprox.)'}.`);
    if (a.sinBloques) fila(`Es el ${ctx.base().nombre} normal.`);
    else if (a.espacio === 'pequeño') fila(`Espacio pequeño: scramble de estado aleatorio uniforme y solución óptima (BFS completo, diámetro ${a.diametro}).`);
    else if (a.minkwitz) fila(`Espacio grande: scramble de giros legales al azar (${formatearNumero(a.pasosScramble || 0)} pasos de un paseo al azar); solución en dos fases: geometría (búsqueda) y permutación con tablas de Minkwitz (${a.minkwitz.completo ? 'completas' : 'INCOMPLETAS: puede que algún estado no se resuelva'}). Las soluciones son largas (cientos de giros) pero siempre se comprueban giro a giro.`);
    else fila(`Espacio grande: scramble de giros legales al azar (${formatearNumero(a.pasosScramble || 0)} pasos de un paseo al azar, suficientes para mezclar geometría y piezas); solución por búsqueda directa y por dos fases (geometría y permutación), la más corta.`);
    if (a.msTablas != null) fila(`Tablas generadas en ${formatearNumero(a.msTablas)} ms${a.mbBFS ? ` (${a.mbBFS} MB)` : ''}.`, 'tenue');
    for (const e of a.avisos || []) fila(e, 'mensaje info');
  }

  function empezarEdicion() {
    if (actual < 0) { grupos.push([]); actual = grupos.length - 1; }
    editando = true;
    ctx.quitarSolucion();
    ctx.limpiarMensajes();
    pintar();
    ctx.pintarEditor();
  }
  function terminarEdicion() {
    editando = false;
    grupos = grupos.filter((g) => g.length);
    if (actual >= grupos.length) actual = grupos.length - 1;
  }
  function aplicar() {
    const def = grupos.filter((g) => g.length >= 2);
    const c = comprobarBloqueos(ctx.base().soporteBloqueos, def);
    if (c.errores.length) { pintar(); return; }
    terminarEdicion();
    if (claveBloqueos(def) !== claveBloqueos(ctx.aplicados())) analisis = null;
    try { localStorage.setItem(claveActual(urlPuzzle()), JSON.stringify(def)); } catch { /* sin almacenamiento */ }
    ctx.aplicar(def);
    pintar();
  }
  function cargarYAplicar(def) {
    cargarBorrador(def);
    editando = false;
    aplicar();
  }

  function iniciar() {
    $('bloq-nuevo').addEventListener('click', () => { grupos.push([]); actual = grupos.length - 1; empezarEdicion(); });
    $('bloq-quitar').addEventListener('click', () => { grupos = []; actual = -1; pintar(); if (editando) ctx.pintarEditor(); });
    $('bloq-aplicar').addEventListener('click', aplicar);
    $('bloq-config').addEventListener('change', (ev) => {
      const v = ev.target.value;
      const base = ctx.base();
      let def = null;
      if (v === 'vacia') def = [];
      else if (v.startsWith('ej:')) {
        const e = (base.ejemplosBloqueos || []).find((x) => 'ej:' + x.id === v);
        if (e) def = e.firma ? bloquesDesdeFirma(e.firma) : e.bloques;
      } else if (v.startsWith('g:')) def = (guardadas[+v.slice(2)] || {}).bloques || null;
      if (def) cargarYAplicar(def);
    });
    $('bloq-guardar').addEventListener('click', () => {
      const def = grupos.filter((g) => g.length >= 2);
      const nombre = $('bloq-nombre').value.trim() || `Mi configuración ${guardadas.length + 1}`;
      const u = urlPuzzle();
      const i = guardadas.findIndex((g) => g.nombre === nombre && (g.puzzle || '3x3') === u);
      if (i >= 0) guardadas[i].bloques = def; else guardadas.push(u === '3x3' ? { nombre, bloques: def } : { nombre, bloques: def, puzzle: u });
      try { localStorage.setItem(CLAVE_GUARDADAS, JSON.stringify(guardadas)); ctx.mensaje('ok', `Configuración "${nombre}" guardada en este navegador.`); } catch { ctx.mensaje('error', 'No se pudo guardar: el navegador no deja usar el almacenamiento.'); }
      pintarConfigs();
    });
    $('bloq-borrar').addEventListener('click', () => {
      const nombre = $('bloq-nombre').value.trim();
      const i = guardadas.findIndex((g) => g.nombre === nombre && (g.puzzle || '3x3') === urlPuzzle());
      if (i < 0) { ctx.mensaje('info', 'Escribe el nombre de una configuración guardada para borrarla.'); return; }
      guardadas.splice(i, 1);
      try { localStorage.setItem(CLAVE_GUARDADAS, JSON.stringify(guardadas)); } catch { /* sin almacenamiento */ }
      pintarConfigs();
    });
    $('bloq-enlace').addEventListener('click', async (ev) => {
      const url = location.href.split('#')[0].split('?')[0] + '#/bandaged?' + (ctx.consultaPuzzle ? ctx.consultaPuzzle() : '') + 'bloqueos=' + encodeURIComponent(textoDeBloqueos(ctx.aplicados()));
      const b = ev.currentTarget;
      try { await navigator.clipboard.writeText(url); b.textContent = 'Enlace copiado'; } catch { $('bloq-url').hidden = false; $('bloq-url').value = url; $('bloq-url').select(); b.textContent = 'Cópialo de aquí'; }
      setTimeout(() => { b.textContent = 'Copiar enlace'; }, 1600);
    });
    $('bloq-importar').addEventListener('click', () => {
      try {
        const def = bloquesDesdeFirma($('bloq-firma').value);
        const c = comprobarBloqueos(ctx.base().soporteBloqueos, def);
        cargarBorrador(def);
        if (c.errores.length) { pintar(); return; }
        cargarYAplicar(def);
      } catch (err) { ctx.mensaje('error', err.message); }
    });
    $('bloq-copiar-firma').addEventListener('click', async (ev) => {
      const b = ev.currentTarget;
      try { await navigator.clipboard.writeText($('bloq-firma-actual').textContent); b.textContent = 'Copiada'; } catch { b.textContent = 'No se pudo copiar'; }
      setTimeout(() => { b.textContent = 'Copiar'; }, 1400);
    });
    cargarBorrador(ctx.aplicados());
  }

  return {
    iniciar,
    pintar,
    pintarConfigs,
    editando: () => editando,
    tocar,
    dibujar,
    /** Al cambiar de puzzle o de configuración aplicada. */
    alSeleccionar() {
      editando = false;
      cargarBorrador(ctx.aplicados());
      if (ctx.base() && ctx.base().soporteBloqueos) pintarConfigs();
      pintar();
    },
    fijarAnalisis(a) { analisis = a || null; pintar(); },
    /** Estrategia elegida para resolver ('' = la más corta, 'A' o 'B'). */
    estrategia: () => $('bloq-estrategia').value,
  };
}
