// Interfaz web: selector de puzzle, scrambles, editor de estado y reproducción de la solución.
// Solo usa la interfaz común de los puzzles (ver ARQUITECTURA.md). Lo pesado
// (tablas, scrambles de estado aleatorio, validación y búsquedas) va a un Web
// Worker a través de motor.js, con el hilo principal como alternativa.

import { PUZZLES } from '../puzzles/index.js';
import { crearMotor } from './motor.js';

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
};

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
  st.p = p;
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
  try { localStorage.setItem('cubo-solver:puzzle', id); } catch { /* sin almacenamiento */ }
  pintarSelector();
  const activo = puedeResolver(p);
  $('editor').classList.toggle('desactivado', !activo);
  $('proximamente').hidden = activo;
  $('desc-solver').textContent = activo ? (p.descripcion || '') : '';
  $('tipo-scramble').textContent = p.tipoScramble || '';
  for (const b of ['resetear', 'cargar', 'resolver']) $(b).disabled = !activo;
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
    st.scramble = r.movimientos;
    st.estadoScramble = p.aplicarSecuencia(p.estadoResuelto(), st.scramble);
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
  $('vista-scramble').innerHTML = p.renderizar(st.estadoScramble, {});
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
  cont.hidden = vistas.length === 0 || !puedeResolver(st.p);
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
  $('vista-editor').innerHTML = p.renderizar(mostrado, { editable, editables, seleccion: st.seleccion, vista: st.vista });
  pintarSolucion();
}

function alPulsarPegatina(ev) {
  const t = ev.target.closest('.pegatina');
  if (!t || !puedeResolver(st.p)) return;
  const i = parseInt(t.getAttribute('data-i'), 10);
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
  pararReproduccion();
  st.sol = null;
  st.paso = 0;
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
    b.className = 'fase f-' + f.nombre.replace(/[^a-z0-9]/gi, '');
    b.dataset.fase = f.nombre;
    b.dataset.fin = String(f.fin);
    const hecha = st.paso >= f.fin;
    if (f === actual && st.paso > 0 && !hecha) b.classList.add('actual');
    if (hecha) b.classList.add('hecha');
    b.innerHTML = `<span>${nombreFase(f.nombre)}</span><small>${f.fin - f.inicio}</small>`;
    b.title = `Ir al final de la fase "${nombreFase(f.nombre)}" (movimientos ${f.inicio + 1}–${f.fin})`;
    b.addEventListener('click', () => { pararReproduccion(); irA(f.fin); });
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
      cls.push('f-' + fases[faseI].nombre.replace(/[^a-z0-9]/gi, ''));
      if (i === fases[faseI].inicio && i > 0) cls.push('inicio-fase');
    }
    if (i < st.paso - 1) cls.push('hecho');
    if (i === st.paso - 1) cls.push('actual');
    if (cls.length) li.className = cls.join(' ');
    li.addEventListener('click', () => { pararReproduccion(); st.paso = i + 1; pintarEditor(); });
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
  $('r-play').textContent = st.timer ? '❚❚' : '▶';
  $('r-play').setAttribute('aria-label', st.timer ? 'Pausar' : 'Reproducir');
  $('r-velocidad').textContent = `×${st.velocidad}`;
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
  }, 550 / st.velocidad);
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
  $('resetear').addEventListener('click', () => { quitarSolucion(); st.seleccion = null; st.editor = st.p.estadoResuelto(); limpiarMensajes(); pintarEditor(); });
  $('cargar').addEventListener('click', () => {
    quitarSolucion();
    st.seleccion = null;
    st.editor = st.estadoScramble ? st.p.clonar(st.estadoScramble) : st.p.estadoResuelto();
    limpiarMensajes();
    pintarEditor();
  });
  $('resolver').addEventListener('click', resolver);
  $('r-inicio').addEventListener('click', () => { pararReproduccion(); irA(0); });
  $('r-atras').addEventListener('click', () => { pararReproduccion(); irA(st.paso - 1); });
  $('r-adelante').addEventListener('click', () => { pararReproduccion(); irA(st.paso + 1); });
  $('r-fin').addEventListener('click', () => { pararReproduccion(); irA(Infinity); });
  $('r-play').addEventListener('click', alternarReproduccion);
  $('r-velocidad').addEventListener('click', () => {
    st.velocidad = st.velocidad >= 8 ? 1 : st.velocidad * 2;
    if (st.timer) { pararReproduccion(); alternarReproduccion(); } else pintarSolucion();
  });
  $('copiar').addEventListener('click', (e) => copiar(st.p.formatear(st.scramble), e.currentTarget));
  $('copiar-sol').addEventListener('click', (e) => st.sol && copiar(st.p.formatear(st.sol.movimientos), e.currentTarget));
  let inicial = '3x3';
  try { inicial = localStorage.getItem('cubo-solver:puzzle') || inicial; } catch { /* sin almacenamiento */ }
  if (!PUZZLES.some((p) => p.id === inicial)) inicial = '3x3';
  motor.listo.then(() => seleccionar(inicial));
}

iniciar();
