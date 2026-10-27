// Interfaz web: selector de puzzle, scrambles, editor de estado y reproducción de la solución.
// Solo usa la interfaz común de los puzzles (ver ARQUITECTURA.md).

import { PUZZLES } from '../puzzles/index.js';
import { rngSeguro } from '../core/rng.js';

const $ = (id) => document.getElementById(id);
const rng = rngSeguro();

const st = {
  p: null,
  scramble: [],
  estadoScramble: null,
  editor: null,
  color: 0,
  sol: null,     // { movimientos, base, ms }
  paso: 0,
  timer: null,
  ocupado: false,
};

const esperarPintado = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

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
  st.p = p;
  st.color = 0;
  st.editor = p.estadoResuelto();
  st.sol = null;
  try { localStorage.setItem('cubo-solver:puzzle', id); } catch { /* sin almacenamiento */ }
  pintarSelector();
  const activo = puedeResolver(p);
  $('editor').classList.toggle('desactivado', !activo);
  $('proximamente').hidden = activo;
  $('desc-solver').textContent = activo ? (p.descripcion || '') : '';
  $('tipo-scramble').textContent = p.tipoScramble || '';
  for (const b of ['resetear', 'cargar', 'resolver']) $(b).disabled = !activo;
  pintarPaleta();
  limpiarMensajes();
  pintarEditor();
  await nuevoScramble();
}

// ---------- Tablas ----------
async function asegurarTablas() {
  const p = st.p;
  if (p.estaInicializado()) return;
  const aviso = $('aviso-tablas');
  aviso.hidden = false;
  aviso.textContent = p.avisoInicializacion || 'Generando tablas de búsqueda…';
  await esperarPintado();
  const t0 = performance.now();
  const r = p.inicializar();
  const ms = Math.round(r && r.ms ? r.ms : performance.now() - t0);
  aviso.textContent = `Tablas de ${p.nombre} generadas en el navegador en ${ms} ms.`;
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
    st.scramble = p.generarScramble(rng);
    st.estadoScramble = p.aplicarSecuencia(p.estadoResuelto(), st.scramble);
  } finally {
    st.ocupado = false;
    $('nuevo').disabled = false;
  }
  const texto = p.formatear(st.scramble);
  const el = $('scramble');
  el.textContent = texto;
  el.classList.toggle('largo', texto.length > 140);
  $('longitud').textContent = `${st.scramble.length} movimientos`;
  $('vista-scramble').innerHTML = p.renderizar(st.estadoScramble, {});
}

// ---------- Editor ----------
function pintarPaleta() {
  const cont = $('paleta');
  cont.innerHTML = '';
  st.p.paleta.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'color';
    b.style.background = c.hex;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === st.color));
    b.setAttribute('aria-label', c.nombre);
    b.title = c.nombre;
    b.addEventListener('click', () => { st.color = i; pintarPaleta(); });
    cont.appendChild(b);
  });
}

function estadoMostrado() {
  if (!st.sol) return st.editor;
  return st.p.aplicarSecuencia(st.sol.base, st.sol.movimientos.slice(0, st.paso));
}

function pintarEditor() {
  const p = st.p;
  const editable = puedeResolver(p);
  const editables = editable ? new Set(p.pegatinasEditables()) : null;
  $('vista-editor').innerHTML = p.renderizar(estadoMostrado(), { editable, editables });
  pintarSolucion();
}

function alPulsarPegatina(ev) {
  const t = ev.target.closest('.pegatina');
  if (!t || !puedeResolver(st.p)) return;
  const i = parseInt(t.getAttribute('data-i'), 10);
  if (st.sol) { st.editor = estadoMostrado(); quitarSolucion(); }
  st.editor = st.p.pintar(st.editor, i, st.color);
  limpiarMensajes();
  pintarEditor();
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
  limpiarMensajes();
  const v = p.validar(st.editor);
  if (!v.valido) {
    mensaje('error', 'Este estado no es posible:');
    v.errores.forEach((e) => mensaje('error', e));
    pintarEditor();
    return;
  }
  st.ocupado = true;
  $('resolver').disabled = true;
  mensaje('info', 'Buscando solución…');
  try {
    await asegurarTablas();
    await esperarPintado();
    const r = p.resolver(st.editor);
    limpiarMensajes();
    if (!r.ok) {
      (r.errores || ['No se pudo resolver.']).forEach((e) => mensaje('error', e));
      return;
    }
    if (r.movimientos.length === 0) {
      mensaje('ok', 'El puzzle ya está resuelto.');
      return;
    }
    st.sol = { movimientos: r.movimientos, base: st.editor.slice(), ms: r.ms };
    st.paso = 0;
    mensaje('ok', 'Estado válido. Sigue la solución paso a paso con los controles.');
  } finally {
    st.ocupado = false;
    $('resolver').disabled = false;
    pintarEditor();
  }
}

function quitarSolucion() {
  pararReproduccion();
  st.sol = null;
  st.paso = 0;
}

function pintarSolucion() {
  const caja = $('solucion');
  if (!st.sol) { caja.hidden = true; return; }
  caja.hidden = false;
  const n = st.sol.movimientos.length;
  $('sol-resumen').textContent = `${n} movimiento${n === 1 ? '' : 's'} · ${Math.max(1, Math.round(st.sol.ms))} ms`;
  const ol = $('movs');
  ol.innerHTML = '';
  st.sol.movimientos.forEach((m, i) => {
    const li = document.createElement('li');
    li.textContent = m;
    if (i < st.paso - 1) li.className = 'hecho';
    if (i === st.paso - 1) li.className = 'actual';
    li.addEventListener('click', () => { pararReproduccion(); st.paso = i + 1; pintarEditor(); });
    ol.appendChild(li);
  });
  $('paso').textContent = st.paso === 0 ? `Inicio · ${n} pasos` : st.paso === n ? `Resuelto (${n}/${n})` : `Paso ${st.paso}/${n}`;
  $('r-play').textContent = st.timer ? '❚❚' : '▶';
  $('r-play').setAttribute('aria-label', st.timer ? 'Pausar' : 'Reproducir');
}

function irA(k) {
  if (!st.sol) return;
  st.paso = Math.max(0, Math.min(st.sol.movimientos.length, k));
  pintarEditor();
}
function pararReproduccion() {
  if (st.timer) { clearInterval(st.timer); st.timer = null; }
}
function alternarReproduccion() {
  if (!st.sol) return;
  if (st.timer) { pararReproduccion(); pintarSolucion(); return; }
  if (st.paso >= st.sol.movimientos.length) st.paso = 0;
  st.timer = setInterval(() => {
    if (!st.sol || st.paso >= st.sol.movimientos.length) { pararReproduccion(); pintarSolucion(); return; }
    st.paso++;
    pintarEditor();
  }, 550);
  pintarSolucion();
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
  $('nuevo').addEventListener('click', nuevoScramble);
  $('vista-editor').addEventListener('click', alPulsarPegatina);
  $('resetear').addEventListener('click', () => { quitarSolucion(); st.editor = st.p.estadoResuelto(); limpiarMensajes(); pintarEditor(); });
  $('cargar').addEventListener('click', () => {
    quitarSolucion();
    st.editor = st.estadoScramble ? st.estadoScramble.slice() : st.p.estadoResuelto();
    limpiarMensajes();
    pintarEditor();
  });
  $('resolver').addEventListener('click', resolver);
  $('r-inicio').addEventListener('click', () => { pararReproduccion(); irA(0); });
  $('r-atras').addEventListener('click', () => { pararReproduccion(); irA(st.paso - 1); });
  $('r-adelante').addEventListener('click', () => { pararReproduccion(); irA(st.paso + 1); });
  $('r-fin').addEventListener('click', () => { pararReproduccion(); irA(Infinity); });
  $('r-play').addEventListener('click', alternarReproduccion);
  $('copiar').addEventListener('click', (e) => copiar(st.p.formatear(st.scramble), e.currentTarget));
  $('copiar-sol').addEventListener('click', (e) => st.sol && copiar(st.p.formatear(st.sol.movimientos), e.currentTarget));
  let inicial = '3x3';
  try { inicial = localStorage.getItem('cubo-solver:puzzle') || inicial; } catch { /* sin almacenamiento */ }
  if (!PUZZLES.some((p) => p.id === inicial)) inicial = '3x3';
  seleccionar(inicial);
}

iniciar();
