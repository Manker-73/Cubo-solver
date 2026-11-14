// Interfaz web: selector de puzzle, scrambles, editor de estado y reproducción de la solución.
// Solo usa la interfaz común de los puzzles (ver ARQUITECTURA.md). Lo pesado
// (tablas, scrambles de estado aleatorio, validación y búsquedas) va a un Web
// Worker a través de motor.js, con el hilo principal como alternativa.

import { PUZZLES } from '../puzzles/index.js';
import { crearMotor } from './motor.js';
import { crearVista3D, hayWebGL } from './vista3d.js';
import { crearReproductor } from './reproductor.js';

/* global __CODIGO_WORKER__ */
const CODIGO_WORKER = typeof __CODIGO_WORKER__ !== 'undefined' ? __CODIGO_WORKER__ : null;

const $ = (id) => document.getElementById(id);

const st = {
  p: null,
  scramble: [],
  estadoScramble: null,
  editor: null,
  color: 0,       // índice en paleta + herramientas
  ultimoColor: 0, // último color de la paleta elegido (lo usan las herramientas con usaColor)
  vista: null,    // vista del editor (vistasEditor), p. ej. una cara ampliada
  velocidad: 1,   // multiplicador de la reproducción
  seleccion: null, // primer toque de una herramienta de dos toques
  sol: null,       // { movimientos, base, ms }
  paso: 0,
  timer: null,
  ocupado: false,
  listos: new Set(), // puzzles con las tablas ya generadas (donde se calcula)
  historial: [],     // estados anteriores del editor (Deshacer)
  // Vista 3D
  webgl: false,      // hay WebGL (si no, todo en 2D)
  modo: { previa: '3d', edicion: '2d', solucion: '3d' }, // 2D o 3D en cada sitio (se recuerda)
  v3d: { previa: null, editor: null },
  pasoScramble: 0,   // paso del reproductor del scramble (n = scramble aplicado)
  prefijos: [],      // estados del scramble tras 0..n movimientos (orientación real)
};
const ms3D = () => 420 / st.velocidad;

// ---------- Vista 3D ----------
function usar3D(cual) {
  if (!st.webgl || !st.p || !st.p.vista3D) return false;
  if (cual === 'previa') return st.modo.previa === '3d';
  return (st.sol ? st.modo.solucion : st.modo.edicion) === '3d';
}
function vista3D(cual) {
  if (!usar3D(cual)) return null;
  if (!st.v3d[cual]) {
    const cont = $(cual === 'previa' ? 'vista3d-scramble' : 'vista3d-editor');
    const v = crearVista3D(cont, {
      paleta: st.p.paleta,
      // tocar en 3D pinta; si había una solución, se sigue editando en 3D
      alTocar: cual === 'editor' ? (peg) => { if (peg.indice == null) return; if (st.sol) st.modo.edicion = '3d'; tocarPegatina(peg.indice); } : null,
    });
    if (!v) { st.webgl = false; pintarModos(); return null; }
    v.alPerder = () => { st.webgl = false; st.v3d = { previa: null, editor: null }; pintarModos(); pintarPrevia(); pintarEditor(); };
    v._paleta = st.p.paleta;
    st.v3d[cual] = v;
  }
  const v = st.v3d[cual];
  if (v._paleta !== st.p.paleta) { v.fijarPaleta(st.p.paleta); v._paleta = st.p.paleta; }
  return v;
}
function guardarModos() { try { localStorage.setItem('cubo-solver:modo3d', JSON.stringify(st.modo)); } catch { /* */ } }
function pintarModos() {
  const tiene = st.webgl && st.p && !!st.p.vista3D;
  for (const [id, cual] of [['modo-previa', 'previa'], ['modo-editor', 'editor']]) {
    const g = $(id);
    g.hidden = !tiene;
    const activo = usar3D(cual) ? '3d' : '2d';
    for (const b of g.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.modo === activo));
  }
  $('sin-3d').hidden = st.webgl;
  $('centrar-previa').hidden = !usar3D('previa');
  $('centrar-editor').hidden = !usar3D('editor');
}
function cambiarModo(cual, modo) {
  if (cual === 'previa') { repScr.cancelar(); st.modo.previa = modo; } else {
    repSol.cancelar();
    if (st.sol) st.modo.solucion = modo; else st.modo.edicion = modo;
  }
  guardarModos();
  pintarModos();
  if (cual === 'previa') pintarPrevia(); else { pintarVistas(); pintarEditor(); }
}

// ---------- Reproductores (scramble y solución) ----------
function estadoScrambleEn(k) {
  return k >= st.scramble.length ? st.estadoScramble : st.prefijos[k];
}
const repScr = crearReproductor({
  total: () => st.scramble.length,
  leer: () => st.pasoScramble,
  fijar: (k) => { st.pasoScramble = k; },
  estadoEn: estadoScrambleEn,
  transicion(k) {
    const p = st.p, antes = st.prefijos[k];
    const pasos = [{ antes, partes: p.giro3D(antes, st.scramble[k]) }];
    // Megaminx: al acabar, el puzzle entero gira hasta la orientación de referencia
    if (k + 1 === st.scramble.length && p.reorientar3D) {
      const r = p.reorientar3D(st.prefijos[k + 1]);
      if (r) pasos.push({ antes: st.prefijos[k + 1], partes: r.partes });
    }
    return pasos;
  },
  vista: () => vista3D('previa'),
  puzzle: () => st.p,
  alCambiar: () => pintarPrevia(),
  ms: ms3D,
  pausa: () => 550 / st.velocidad,
  pausa3D: () => 70 / st.velocidad,
});
function estadoSolucionEn(k) {
  const s = st.sol;
  if (!s.estados) s.estados = [s.base];
  while (s.estados.length <= k) s.estados.push(st.p.aplicarMovimiento(s.estados[s.estados.length - 1], s.movimientos[s.estados.length - 1]));
  return s.estados[k];
}
const repSol = crearReproductor({
  total: () => (st.sol ? st.sol.movimientos.length : 0),
  leer: () => st.paso,
  fijar: (k) => { st.paso = k; },
  estadoEn: estadoSolucionEn,
  transicion: (k) => { const antes = estadoSolucionEn(k); return [{ antes, partes: st.p.giro3D(antes, st.sol.movimientos[k]) }]; },
  vista: () => (st.sol ? vista3D('editor') : null),
  puzzle: () => st.p,
  alCambiar: () => pintarEditor(),
  ms: ms3D,
  pausa: () => 550 / st.velocidad,
  pausa3D: () => 70 / st.velocidad,
});

function pintarPrevia() {
  const p = st.p;
  if (!p) return;
  const n = st.scramble.length, k = Math.min(st.pasoScramble, n);
  const estado = estadoScrambleEn(k);
  const v = estado ? vista3D('previa') : null;
  $('vista-scramble').hidden = !!v;
  $('vista3d-scramble').hidden = !v;
  if (!estado) $('vista-scramble').innerHTML = '';
  else if (v) { if (!v.animando) v.mostrar(p.vista3D(estado)); } else $('vista-scramble').innerHTML = p.renderizar(estado, {});
  $('paso-scramble').textContent = !n ? '' : k >= n ? `Scramble aplicado (${n} mov.)` : k === 0 ? `Resuelto · 0/${n}` : `${k}/${n} · ${st.scramble[k - 1]}`;
  $('s-play').textContent = repScr.reproduciendo ? '❚❚' : '▶';
  $('s-play').setAttribute('aria-label', repScr.reproduciendo ? 'Pausar el scramble' : 'Reproducir el scramble');
  $('s-velocidad').textContent = `×${st.velocidad}`;
  $('rep-scramble').hidden = !n;
  pintarModos();
}

const MAX_HISTORIAL = 200;
/** Guarda el estado del editor antes de cambiarlo (para Deshacer). */
function recordar() {
  st.historial.push(st.p.clonar(estadoMostrado()));
  if (st.historial.length > MAX_HISTORIAL) st.historial.shift();
}
function deshacer() {
  if (!st.historial.length || st.ocupado) return;
  quitarSolucion();
  st.seleccion = null;
  st.editor = st.historial.pop();
  limpiarMensajes();
  pintarEditor();
}

const esperarPintado = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

let motor = null;

function puedeResolver(p) {
  return p.capacidades.resolver && p.capacidades.editar;
}

// ---------- Selector ----------
function pintarSelector() {
  const nav = $('selector');
  nav.innerHTML = '';
  for (const p of PUZZLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (puedeResolver(p) ? ' con-solver' : '');
    b.setAttribute('aria-pressed', String(st.p === p));
    b.title = puedeResolver(p) ? 'Scramble, validador y solucionador' : 'Scramble (solucionador próximamente)';
    b.innerHTML = `<span class="punto" aria-hidden="true"></span>${p.nombre}`;
    b.addEventListener('click', () => seleccionar(p.id));
    nav.appendChild(b);
  }
}

async function seleccionar(id) {
  const p = PUZZLES.find((x) => x.id === id);
  if (!p || st.ocupado) return;
  pararReproduccion();
  repScr.cancelar();
  st.p = p;
  st.scramble = [];
  st.estadoScramble = null;
  st.pasoScramble = 0;
  for (const v of Object.values(st.v3d)) if (v) { v.vistaInicial(); v.resaltar(null); }
  st.color = 0;
  st.ultimoColor = 0;
  st.vista = p.vistasEditor ? p.vistasEditor[0].id : null;
  if (p.herramientaInicial && p.herramientas) {
    const k = p.herramientas.findIndex((h) => h.id === p.herramientaInicial);
    if (k >= 0) st.color = p.paleta.length + k;
  }
  st.seleccion = null;
  st.editor = p.estadoResuelto();
  st.sol = null;
  st.historial = [];
  try { localStorage.setItem('cubo-solver:puzzle', id); } catch { /* sin almacenamiento */ }
  pintarSelector();
  const activo = puedeResolver(p);
  $('editor').classList.toggle('desactivado', !activo);
  $('proximamente').hidden = activo;
  $('desc-solver').textContent = activo ? (p.descripcion || '') : '';
  $('tipo-scramble').textContent = p.tipoScramble || '';
  for (const b of ['resetear', 'cargar', 'resolver']) $(b).disabled = !activo;
  pintarLeyenda();
  pintarPaleta();
  pintarAccionesEditor();
  pintarVistas();
  limpiarMensajes();
  pintarEditor();
  await nuevoScramble();
}

// ---------- Tablas (en el Worker o en el hilo principal) ----------
function textoSegundos(ms) { return (ms / 1000).toFixed(1).replace('.', ',') + ' s'; }

async function asegurarTablas() {
  const p = st.p;
  if (!p.capacidades.resolver || st.listos.has(p.id)) return;
  const aviso = $('aviso-tablas');
  aviso.hidden = false;
  aviso.classList.add('cargando');
  const base = p.avisoInicializacion || 'Generando tablas de búsqueda…';
  const dondeTxt = () => (motor.modo() === 'worker' ? ' (en segundo plano)' : '');
  const t0 = performance.now();
  aviso.textContent = base + dondeTxt();
  const reloj = setInterval(() => { aviso.textContent = `${base}${dondeTxt()} ${textoSegundos(performance.now() - t0)}`; }, 100);
  try {
    const r = await motor.pedir('inicializar', p.id);
    const ms = r.yaEstaba ? Math.round(performance.now() - t0) : r.ms;
    st.listos.add(p.id);
    if (st.p === p) aviso.textContent = `Tablas de ${p.nombre} generadas en ${ms} ms ${motor.modo() === 'worker' ? 'en un Web Worker (la página no se bloquea)' : 'en el hilo principal'}.`;
  } finally {
    clearInterval(reloj);
    aviso.classList.remove('cargando');
  }
}

// ---------- Scramble ----------
async function nuevoScramble() {
  if (st.ocupado) return;
  st.ocupado = true;
  const p = st.p;
  $('nuevo').disabled = true;
  try {
    if (p.capacidades.resolver) await asegurarTablas();
    else $('aviso-tablas').hidden = true;
    const r = await motor.pedir('scramble', p.id);
    if (st.p !== p) return;
    repScr.cancelar();
    st.scramble = r.movimientos;
    st.prefijos = [p.estadoResuelto()];
    for (const m of st.scramble) st.prefijos.push(p.aplicarMovimiento(st.prefijos[st.prefijos.length - 1], m));
    st.pasoScramble = st.scramble.length;
    st.estadoScramble = st.prefijos[st.scramble.length];
    // puzzles cuyos scrambles giran el puzzle entero (Megaminx): se muestra (y se
    // carga en el editor) en la orientación de referencia
    if (p.estadoVistaScramble) st.estadoScramble = p.estadoVistaScramble(st.estadoScramble);
  } catch (err) {
    mensaje('error', `No se pudo generar el scramble: ${err.message}`);
    return;
  } finally {
    st.ocupado = false;
    $('nuevo').disabled = false;
  }
  const texto = p.formatear(st.scramble);
  const el = $('scramble');
  el.textContent = texto;
  el.classList.toggle('largo', texto.length > 140);
  $('longitud').textContent = p.describirLongitud ? p.describirLongitud(st.scramble) : `${st.scramble.length} movimientos`;
  pintarPrevia();
  const nota = $('nota-scramble');
  nota.textContent = p.notaScramble ? p.notaScramble(st.scramble) : '';
  nota.hidden = !p.notaScramble;
}

// ---------- Editor ----------
function entradaPaleta(i) {
  const p = st.p;
  if (i < p.paleta.length) return { tipo: 'color', ...p.paleta[i] };
  const h = (p.herramientas || [])[i - p.paleta.length];
  return h ? { tipo: 'herramienta', ...h } : null;
}

function pintarPaleta() {
  const cont = $('paleta');
  cont.innerHTML = '';
  const p = st.p;
  const n = p.paleta.length + (p.herramientas ? p.herramientas.length : 0);
  for (let i = 0; i < n; i++) {
    const ent = entradaPaleta(i);
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === st.color));
    b.setAttribute('aria-label', ent.nombre);
    b.title = ent.nombre;
    if (ent.tipo === 'color') {
      b.className = 'color';
      b.style.background = ent.hex;
    } else {
      b.className = 'herramienta';
      b.dataset.herramienta = ent.id;
      b.innerHTML = `<span aria-hidden="true">${ent.icono || ''}</span>${ent.nombre}`;
      if (ent.titulo) b.title = ent.titulo;
      if (ent.usaColor) {
        const m = document.createElement('i');
        m.className = 'muestra';
        m.style.background = p.paleta[st.ultimoColor].hex;
        m.setAttribute('aria-hidden', 'true');
        b.appendChild(m);
      }
    }
    b.addEventListener('click', () => {
      st.color = i;
      if (i < p.paleta.length) st.ultimoColor = i;
      pintarPaleta();
      if (st.seleccion !== null) { st.seleccion = null; pintarEditor(); }
    });
    cont.appendChild(b);
  }
}

function pintarAccionesEditor() {
  const cont = $('acciones-editor');
  cont.innerHTML = '';
  const acciones = st.p.accionesEditor || [];
  cont.hidden = acciones.length === 0 || !puedeResolver(st.p);
  for (const a of acciones) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'boton pequeno';
    b.dataset.accion = a.id;
    b.textContent = a.etiqueta;
    if (a.titulo) b.title = a.titulo;
    b.addEventListener('click', () => {
      recordar();
      if (st.sol) { st.editor = estadoMostrado(); quitarSolucion(); }
      try {
        st.editor = st.p.aplicarAccion(st.editor, a.id, { color: st.ultimoColor });
        limpiarMensajes();
      } catch (err) {
        limpiarMensajes();
        mensaje('error', err.message);
      }
      st.seleccion = null;
      pintarEditor();
    });
    cont.appendChild(b);
  }
}

function pintarVistas() {
  const cont = $('vistas-editor');
  cont.innerHTML = '';
  const vistas = st.p.vistasEditor || [];
  cont.hidden = vistas.length === 0 || !puedeResolver(st.p) || usar3D('editor');
  if (cont.hidden) return;
  const et = document.createElement('span');
  et.className = 'etiqueta';
  et.textContent = 'Ver';
  cont.appendChild(et);
  for (const v of vistas) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip pequeno';
    b.dataset.vista = v.id;
    b.textContent = v.nombre;
    b.title = v.id === vistas[0].id ? 'Ver todas las caras' : `Ampliar la cara ${v.nombre}`;
    b.setAttribute('aria-pressed', String(st.vista === v.id));
    b.addEventListener('click', () => { st.vista = v.id; st.seleccion = null; pintarVistas(); pintarEditor(); });
    cont.appendChild(b);
  }
}

function estadoMostrado() {
  if (!st.sol) return st.editor;
  return st.p.aplicarSecuencia(st.sol.base, st.sol.movimientos.slice(0, st.paso));
}

function pintarEditor() {
  const p = st.p;
  const editable = puedeResolver(p);
  const mostrado = estadoMostrado();
  const editables = editable ? new Set(p.pegatinasEditables(mostrado)) : null;
  const v = vista3D('editor');
  $('vista-editor').hidden = !!v;
  $('vista3d-editor').hidden = !v;
  if (v) {
    if (!v.animando) {
      const vista = p.vista3D(mostrado);
      v.mostrar(vista);
      v.etiquetas(!!st.sol);
      // primer toque de una herramienta de dos toques: resaltar esa pieza
      if (st.seleccion != null) {
        const sel = vista.geometria.pegatinas.find((q) => q.indice === st.seleccion);
        v.resaltar(sel ? vista.geometria.pegatinas.map((q, k) => (q.pieza === sel.pieza ? k : -1)).filter((k) => k >= 0) : null);
      } else if (v.escena.resaltado && v._resalteEditor) v.resaltar(null);
      v._resalteEditor = st.seleccion != null;
    }
  } else {
    $('vista-editor').innerHTML = p.renderizar(mostrado, { editable, editables, seleccion: st.seleccion, vista: st.vista, etiquetas: !!st.sol });
  }
  pintarModos();
  $('deshacer').disabled = !editable || st.historial.length === 0;
  pintarSolucion();
}

function alPulsarPegatina(ev) {
  const t = ev.target.closest('.pegatina');
  if (!t) return;
  tocarPegatina(parseInt(t.getAttribute('data-i'), 10));
}

function tocarPegatina(i) {
  if (!puedeResolver(st.p) || st.ocupado) return;
  const mostradoAntes = estadoMostrado();
  if (!new Set(st.p.pegatinasEditables(mostradoAntes)).has(i)) return;
  if (st.sol) repSol.cancelar();
  const antes = st.p.clonar(estadoMostrado());
  if (st.sol) { st.editor = estadoMostrado(); quitarSolucion(); }
  limpiarMensajes();
  const ent = entradaPaleta(st.color);
  if (ent && ent.tipo === 'herramienta') {
    const inmediato = (ent.inmediatos || []).includes(i) || (st.p.indicesInmediatos || []).includes(i);
    if (inmediato) { st.editor = st.p.pintar(st.editor, i, null); st.seleccion = null; } else if ((ent.toques || 1) === 1) {
      try { st.editor = st.p.usarHerramienta(st.editor, ent.id, [i], { color: st.ultimoColor }); } catch (err) { mensaje('error', err.message); }
    } else if (st.seleccion === null) {
      st.seleccion = i;
    } else {
      const primero = st.seleccion;
      st.seleccion = null;
      if (primero !== i) {
        try { st.editor = st.p.usarHerramienta(st.editor, ent.id, [primero, i], { color: st.ultimoColor }); } catch (err) { mensaje('error', err.message); }
      }
    }
  } else {
    st.editor = st.p.pintar(st.editor, i, st.color);
  }
  if (JSON.stringify(antes) !== JSON.stringify(st.editor)) {
    st.historial.push(antes);
    if (st.historial.length > MAX_HISTORIAL) st.historial.shift();
  }
  pintarEditor();
}

// ---------- Leyenda de la notación ----------
function pintarLeyenda() {
  const caja = $('leyenda');
  const p = st.p;
  if (!p.leyendaNotacion || !puedeResolver(p)) { caja.hidden = true; caja.innerHTML = ''; return; }
  const l = p.leyendaNotacion();
  caja.hidden = false;
  caja.open = !!(window.matchMedia && window.matchMedia('(min-width: 700px)').matches);
  caja.innerHTML = `<summary>Notación: qué cara es cada letra</summary><div class="leyenda-cuerpo"><div class="vista leyenda-red">${l.svg}</div><p>${l.texto}</p></div>`;
}

// ---------- Mensajes ----------
function limpiarMensajes() { $('mensajes').innerHTML = ''; }
function mensaje(tipo, texto) {
  const d = document.createElement('div');
  d.className = 'mensaje ' + tipo;
  d.textContent = texto;
  $('mensajes').appendChild(d);
}

// ---------- Resolver ----------
async function resolver() {
  const p = st.p;
  if (!puedeResolver(p) || st.ocupado) return;
  if (st.sol) { st.editor = st.sol.base; quitarSolucion(); }
  st.seleccion = null;
  limpiarMensajes();
  st.ocupado = true;
  $('resolver').disabled = true;
  try {
    await asegurarTablas();
    const v = await motor.pedir('validar', p.id, { estado: st.editor });
    if (st.p !== p) return;
    if (!v.valido) {
      mensaje('error', 'Este estado no es posible:');
      v.errores.forEach((e) => mensaje('error', e));
      return;
    }
    mensaje('info', 'Buscando solución…');
    await esperarPintado();
    const r = await motor.pedir('resolver', p.id, { estado: st.editor });
    if (st.p !== p) return;
    limpiarMensajes();
    if (!r.ok) {
      (r.errores.length ? r.errores : ['No se pudo resolver.']).forEach((e) => mensaje('error', e));
      return;
    }
    if (r.movimientos.length === 0) {
      mensaje('ok', 'El puzzle ya está resuelto.');
      return;
    }
    st.sol = { movimientos: r.movimientos, base: p.clonar(st.editor), ms: r.ms, fases: r.fases || null };
    st.paso = 0;
    pintarVistas();
    mensaje('ok', 'Estado válido. Sigue la solución paso a paso con los controles.');
  } catch (err) {
    limpiarMensajes();
    mensaje('error', `Error al resolver: ${err.message}`);
  } finally {
    st.ocupado = false;
    $('resolver').disabled = !puedeResolver(st.p);
    pintarEditor();
  }
}

function quitarSolucion() {
  repSol.cancelar();
  const habia = !!st.sol;
  st.sol = null;
  st.paso = 0;
  if (habia) pintarVistas();
}

const NOMBRE_FASE = { paridad: 'Paridad', centros: 'Centros', aristas: 'Aristas', '3x3': '3x3' };
const nombreFase = (f) => NOMBRE_FASE[f] || f;

/** Fase del paso k (el movimiento k-1 acaba de hacerse; en el paso 0, la primera). */
function faseDelPaso(k) {
  const fases = st.sol && st.sol.fases;
  if (!fases || !fases.length) return null;
  const m = Math.max(0, k - 1);
  return fases.find((f) => m >= f.inicio && m < f.fin) || fases[fases.length - 1];
}

function pintarSolucion() {
  const caja = $('solucion');
  if (!st.sol) { caja.hidden = true; return; }
  caja.hidden = false;
  const n = st.sol.movimientos.length;
  const largo = st.p.describirLongitud ? st.p.describirLongitud(st.sol.movimientos) : `${n} movimiento${n === 1 ? '' : 's'}`;
  $('sol-resumen').textContent = `${largo} · ${Math.max(1, Math.round(st.sol.ms))} ms`;
  // Fases: un botón por tramo que lleva al final de ese tramo
  const barra = $('fases');
  const fases = st.sol.fases || [];
  barra.hidden = fases.length === 0;
  barra.innerHTML = '';
  const actual = faseDelPaso(st.paso);
  fases.forEach((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fase f-' + (f.grupo || f.nombre).replace(/[^a-z0-9]/gi, '');
    b.dataset.fase = f.nombre;
    b.dataset.fin = String(f.fin);
    const hecha = st.paso >= f.fin;
    if (f === actual && st.paso > 0 && !hecha) b.classList.add('actual');
    if (hecha) b.classList.add('hecha');
    b.innerHTML = `<span>${nombreFase(f.nombre)}</span><small>${f.fin - f.inicio}</small>`;
    b.title = `Ir al final de la fase "${nombreFase(f.nombre)}" (movimientos ${f.inicio + 1}–${f.fin})`;
    b.addEventListener('click', () => repSol.irA(f.fin));
    barra.appendChild(b);
  });
  const ol = $('movs');
  ol.innerHTML = '';
  let faseI = 0;
  st.sol.movimientos.forEach((m, i) => {
    const li = document.createElement('li');
    li.textContent = m;
    while (fases[faseI] && i >= fases[faseI].fin) faseI++;
    const cls = [];
    if (fases[faseI]) {
      cls.push('f-' + (fases[faseI].grupo || fases[faseI].nombre).replace(/[^a-z0-9]/gi, ''));
      if (i === fases[faseI].inicio && i > 0) cls.push('inicio-fase');
    }
    if (i < st.paso - 1) cls.push('hecho');
    if (i === st.paso - 1) cls.push('actual');
    if (cls.length) li.className = cls.join(' ');
    li.addEventListener('click', () => repSol.irA(i + 1));
    ol.appendChild(li);
  });
  // que el movimiento actual se vea dentro de la lista (si tiene scroll)
  const li = ol.querySelector('li.actual');
  if (li && ol.scrollHeight > ol.clientHeight && li.offsetTop !== undefined) {
    const top = li.offsetTop; // .movs tiene position: relative
    if (top < ol.scrollTop || top > ol.scrollTop + ol.clientHeight - li.offsetHeight) ol.scrollTop = Math.max(0, top - ol.clientHeight / 2);
  }
  const txtFase = actual && st.paso > 0 && st.paso < n ? ` · ${nombreFase(actual.nombre)}` : '';
  $('paso').textContent = st.paso === 0 ? `Inicio · ${n} pasos` : st.paso === n ? `Resuelto (${n}/${n})` : `Paso ${st.paso}/${n}${txtFase}`;
  $('r-play').textContent = repSol.reproduciendo ? '❚❚' : '▶';
  $('r-play').setAttribute('aria-label', repSol.reproduciendo ? 'Pausar' : 'Reproducir');
  $('r-velocidad').textContent = `×${st.velocidad}`;
}

function pararReproduccion() {
  repSol.cancelar();
}

async function copiar(texto, boton) {
  const original = boton.textContent;
  try {
    await navigator.clipboard.writeText(texto);
    boton.textContent = 'Copiado';
  } catch {
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(boton === $('copiar') ? $('scramble') : $('movs'));
    sel.removeAllRanges(); sel.addRange(r);
    boton.textContent = 'Seleccionado';
  }
  setTimeout(() => { boton.textContent = original; }, 1400);
}

// ---------- Arranque ----------
function iniciar() {
  motor = crearMotor({
    codigoWorker: CODIGO_WORKER,
    alCambiarModo: (modo, motivo) => {
      const el = $('modo-calculo');
      if (!el) return;
      el.textContent = modo === 'worker'
        ? 'Cálculos en un Web Worker: la página no se bloquea.'
        : `Cálculos en el hilo principal${motivo ? ` (${motivo})` : ''}.`;
      el.dataset.modo = modo;
      // si el Worker falló, las tablas que tuviera se han perdido
      if (modo === 'local') st.listos.clear();
    },
  });
  $('nuevo').addEventListener('click', nuevoScramble);
  $('vista-editor').addEventListener('click', alPulsarPegatina);
  $('deshacer').addEventListener('click', deshacer);
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z' && !/input|textarea/i.test(ev.target.tagName)) { ev.preventDefault(); deshacer(); }
  });
  $('resetear').addEventListener('click', () => { recordar(); quitarSolucion(); st.seleccion = null; st.editor = st.p.estadoResuelto(); limpiarMensajes(); pintarEditor(); });
  $('cargar').addEventListener('click', () => {
    recordar();
    quitarSolucion();
    st.seleccion = null;
    st.editor = st.estadoScramble ? st.p.clonar(st.estadoScramble) : st.p.estadoResuelto();
    limpiarMensajes();
    pintarEditor();
  });
  $('resolver').addEventListener('click', resolver);
  $('r-inicio').addEventListener('click', () => repSol.irA(0));
  $('r-atras').addEventListener('click', () => { repSol.parar(); repSol.atras(); });
  $('r-adelante').addEventListener('click', () => { repSol.parar(); repSol.adelante(); });
  $('r-fin').addEventListener('click', () => repSol.irA(Infinity));
  $('r-play').addEventListener('click', () => { if (st.sol) repSol.alternar(); });
  const cambiarVelocidad = () => {
    st.velocidad = st.velocidad >= 8 ? 1 : st.velocidad * 2;
    pintarSolucion();
    pintarPrevia();
  };
  $('r-velocidad').addEventListener('click', cambiarVelocidad);
  $('s-velocidad').addEventListener('click', cambiarVelocidad);
  $('s-inicio').addEventListener('click', () => repScr.irA(0));
  $('s-atras').addEventListener('click', () => { repScr.parar(); repScr.atras(); });
  $('s-adelante').addEventListener('click', () => { repScr.parar(); repScr.adelante(); });
  $('s-fin').addEventListener('click', () => repScr.irA(Infinity));
  $('s-play').addEventListener('click', () => repScr.alternar());
  for (const [id, cual] of [['modo-previa', 'previa'], ['modo-editor', 'editor']]) {
    $(id).addEventListener('click', (ev) => { const b = ev.target.closest('button[data-modo]'); if (b) cambiarModo(cual, b.dataset.modo); });
  }
  $('centrar-previa').addEventListener('click', () => st.v3d.previa && st.v3d.previa.vistaInicial());
  $('centrar-editor').addEventListener('click', () => st.v3d.editor && st.v3d.editor.vistaInicial());
  st.webgl = hayWebGL(document);
  try { Object.assign(st.modo, JSON.parse(localStorage.getItem('cubo-solver:modo3d') || '{}')); } catch { /* */ }
  // Para el modo aprender (y para depurar): vistas 3D y resaltado de piezas
  window.cuboSolver = {
    vista3D: (cual) => st.v3d[cual] || null,
    resaltarPiezas: (cual, piezas, modo) => { const v = st.v3d[cual]; if (v) v.resaltarPiezas(piezas, modo); },
    estado: () => ({ puzzle: st.p && st.p.id, paso: st.paso, pasoScramble: st.pasoScramble, modo: { ...st.modo }, webgl: st.webgl }),
    editor: () => st.p.clonar(estadoMostrado()),
  };
  $('copiar').addEventListener('click', (e) => copiar(st.p.formatear(st.scramble), e.currentTarget));
  $('copiar-sol').addEventListener('click', (e) => st.sol && copiar(st.p.formatear(st.sol.movimientos), e.currentTarget));
  let inicial = '3x3';
  try { inicial = localStorage.getItem('cubo-solver:puzzle') || inicial; } catch { /* sin almacenamiento */ }
  if (!PUZZLES.some((p) => p.id === inicial)) inicial = '3x3';
  motor.listo.then(() => seleccionar(inicial));
}

iniciar();
