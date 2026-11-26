// Interfaz web: selector de puzzle, scrambles, editor de estado y reproducción de la solución.
// Solo usa la interfaz común de los puzzles (ver ARQUITECTURA.md). Lo pesado
// (tablas, scrambles de estado aleatorio, validación y búsquedas) va a un Web
// Worker a través de motor.js, con el hilo principal como alternativa.

import { PUZZLES, PUZZLES_PRONTO, BANDAGED, buscarPuzzle } from '../puzzles/index.js';
import { crearMotor } from './motor.js';
import { crearVista3D, hayWebGL } from './vista3d.js';
import { crearReproductor } from './reproductor.js';
import { puzzleConBloqueos, claveBloqueos } from '../core/bloqueos.js';
import { crearPanelBloqueos, bloqueosDeURL, leerBloqueosGuardados, textoDeBloqueos } from './bloqueos-ui.js';
import { SECCIONES, INTRO_SECCION, seccion as datosSeccion, leerRuta, hashDe } from './secciones.js';
import { crearTema } from './tema.js';

/* global __CODIGO_WORKER__ */
const CODIGO_WORKER = typeof __CODIGO_WORKER__ !== 'undefined' ? __CODIGO_WORKER__ : null;

const $ = (id) => document.getElementById(id);

const st = {
  p: null,
  scramble: [],
  estadoScramble: null,
  /** Scramble con el que se cargó el editor (se manda al validar; el Worker comprueba que coincide). */
  secuenciaEditor: null,
  /** Scramble cargado en el editor y su huella (para saber si se ha tocado; ver seguirScrambleEnEditor). */
  editorCargado: null,
  /** Análisis del vendado actual (del Worker) y clave del puzzle con el scramble mezclado pedido. */
  analisisBloqueos: null,
  /**
   * Longitud del scramble práctico elegida (sesión «longitud del práctico»): '30', '40', '60', '100'
   * o 'mezclado' (como en la URL), o null = la de por defecto (la WCA del tamaño). Se recuerda en el
   * navegador (localStorage) y va en la URL.
   */
  /** Opciones (JSON) con las que se generó el scramble a la vista ('null' = el de siempre). */
  opcionesScrambleMostrado: 'null',
  eleccionScramble: (() => { try { const v = localStorage.getItem('cubo-solver:scramble-practico'); return v && /^(\d+|mezclado)$/.test(v) ? v : null; } catch { return null; } })(),
  editor: null,
  color: 0,       // índice en paleta + herramientas
  ultimoColor: 0, // último color de la paleta elegido (lo usan las herramientas con usaColor)
  vista: null,    // vista del editor (vistasEditor), p. ej. una cara ampliada
  velocidad: 1,   // multiplicador de la reproducción
  seleccion: null, // primer toque de una herramienta de dos toques
  sol: null,       // { movimientos, base, ms }
  paso: 0,
  timer: null,
  ocupado: false,    // id del puzzle que se está resolviendo (o false)
  gen: 0,            // generación de la vista del scramble (cambia al elegir puzzle o pedir otro)
  precargados: new Map(), // puzzle -> scramble listo para mostrar
  enCamino: new Map(),    // puzzle -> petición de scramble en marcha
  visitados: new Set(),   // puzzles que el usuario ha elegido
  sel: 0,            // cambia en cada selección de puzzle
  listos: new Set(), // puzzles con las tablas ya generadas (donde se calcula)
  historial: [],     // estados anteriores del editor (Deshacer)
  // Vista 3D
  webgl: false,      // hay WebGL (si no, todo en 2D)
  modo: { previa: '3d', edicion: '2d', solucion: '3d' }, // 2D o 3D en cada sitio (se recuerda)
  v3d: { previa: null, editor: null },
  pasoScramble: 0,   // paso del reproductor del scramble (n = scramble aplicado)
  prefijos: [],      // estados del scramble tras 0..n movimientos (orientación real)
  metodos: {},       // modo aprender: método elegido en cada puzzle ('' = solución óptima)
  bloqueos: [],      // bloques del puzzle vendado elegido (sección Bandaged Cubes): [[clave de pieza, ...]]
  vendado: '3x3',    // puzzle de Bandaged Cubes (su nombre en la URL: 3x3, 4x4 o 5x5; noche 13)
  bloqueosPor: {},   // bloques aplicados de cada puzzle de Bandaged Cubes (al cambiar de uno a otro)
  seccion: 'portada', // 'portada', 'wca' o 'bandaged' (ver secciones.js)
};

// ---------- Bloqueos (cubo vendado) ----------
// En la sección Bandaged Cubes, con bloques aplicados, el 3x3 es el mismo puzzle envuelto
// por puzzleConBloqueos: la interfaz lo usa como cualquier otro, y las peticiones al Worker
// llevan los bloques. En WCA Puzzles el 3x3 es siempre el normal.
const vendados = new Map(); // id + clave de los bloques -> puzzle con bloqueos
function puzzleActivo(id) {
  const base = buscarPuzzle(id); // del registro o una base del modo vendado (4x4, 5x5)
  if (!base || !base.soporteBloqueos || st.seccion !== 'bandaged' || !st.bloqueos.length) return base;
  const k = id + '#' + claveBloqueos(st.bloqueos);
  if (!vendados.has(k)) vendados.set(k, puzzleConBloqueos(base, st.bloqueos));
  return vendados.get(k);
}
/** Clave de un puzzle para las cachés (scrambles, tablas): el id y, si hay, sus bloques. */
const claveP = (p) => (p.claveBloqueos ? p.id + '#' + p.claveBloqueos : p.id);
/** Datos de una petición al motor: con los bloques, si el puzzle los tiene. */
const datosDe = (p, extra = {}) => (p.bloqueos && p.bloqueos.length ? { ...extra, bloqueos: p.bloqueos } : extra);
const baseDe = (p) => (p ? buscarPuzzle(p.id) : null);
/** Puzzle de Bandaged Cubes por su nombre en la URL (3x3 si no existe). */
const bandagedDe = (url) => BANDAGED.find((b) => b.url === url) || BANDAGED[0];
/** Cambia el puzzle de Bandaged Cubes (guarda los bloques del que se deja). */
function cambiarVendado(url) {
  if (url === st.vendado) return;
  st.bloqueosPor[st.vendado] = st.bloqueos;
  st.vendado = bandagedDe(url).url;
  st.bloqueos = st.bloqueosPor[st.vendado] || leerBloqueosGuardados(st.vendado);
}
const ms3D = () => 420 / st.velocidad;
const ocupado = () => !!st.ocupado && !!st.p && st.ocupado === claveP(st.p);

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
  for (const b of ['s-inicio', 's-atras', 's-play', 's-adelante', 's-fin']) $(b).disabled = !n;
  pintarModos();
}

const MAX_HISTORIAL = 200;
/** Guarda el estado del editor antes de cambiarlo (para Deshacer). */
function recordar() {
  st.historial.push(st.p.clonar(estadoMostrado()));
  if (st.historial.length > MAX_HISTORIAL) st.historial.shift();
}
function deshacer() {
  if (!st.historial.length || ocupado()) return;
  quitarSolucion();
  st.seleccion = null;
  st.editor = st.historial.pop();
  limpiarMensajes();
  pintarEditor();
}

const esperarPintado = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

let motor = null;

const panelBloqueos = crearPanelBloqueos({
  $,
  base: () => (st.seccion === 'bandaged' ? baseDe(st.p) : null),
  aplicados: () => st.bloqueos,
  puzzleURL: () => st.vendado,
  consultaPuzzle: () => (st.vendado === '3x3' ? '' : `puzzle=${st.vendado}&`),
  aplicar(def) {
    st.bloqueos = def;
    st.bloqueosPor[st.vendado] = def;
    reemplazarURL(hashVendado());
    seleccionar(st.p.id);
  },
  pintarEditor: () => pintarEditor(),
  quitarSolucion: () => quitarSolucion(),
  mensaje: (t, x) => mensaje(t, x),
  limpiarMensajes: () => limpiarMensajes(),
  vistaEditor: () => vista3D('editor'),
  contenedor2D: 'vista-editor',
  vistaCara: () => st.vista,
});

function puedeResolver(p) {
  return p.capacidades.resolver && p.capacidades.editar;
}

// ---------- Selector ----------
function pintarSelector() {
  const nav = $('selector');
  nav.innerHTML = '';
  nav.hidden = st.seccion !== 'wca' && st.seccion !== 'bandaged';
  if (nav.hidden) return;
  if (st.seccion === 'bandaged') {
    // Bandaged Cubes (noche 13): 3x3, 4x4 y 5x5
    for (const b of BANDAGED) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'chip con-solver';
      el.dataset.vendado = b.url;
      el.setAttribute('aria-pressed', String(st.vendado === b.url));
      el.title = `${b.url} vendado: crea tus bloques, scramble y solución con giros legales`;
      el.innerHTML = `<span class="punto" aria-hidden="true"></span>${b.url}`;
      el.addEventListener('click', () => {
        cambiarVendado(b.url);
        reemplazarURL(hashVendado());
        seleccionar(bandagedDe(st.vendado).puzzle.id);
      });
      nav.appendChild(el);
    }
    return;
  }
  for (const p of PUZZLES.filter((x) => x.categoria === 'wca')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (puedeResolver(p) ? ' con-solver' : '');
    b.setAttribute('aria-pressed', String(!!st.p && st.p.id === p.id));
    b.title = puedeResolver(p) ? 'Scramble, validador y solucionador' : 'Scramble (solucionador próximamente)';
    b.innerHTML = `<span class="punto" aria-hidden="true"></span>${p.nombre}`;
    b.addEventListener('click', () => { reemplazarURL(hashDe({ seccion: 'wca', puzzle: p.id })); seleccionar(p.id); });
    nav.appendChild(b);
  }
  // puzzles anunciados: chip bloqueado, no es un botón ni se puede elegir
  for (const p of PUZZLES_PRONTO.filter((x) => x.categoria === 'wca')) {
    const c = document.createElement('span');
    c.className = 'chip-pronto';
    c.dataset.pronto = p.id;
    c.title = `${p.nombre}: próximamente`;
    c.innerHTML = `${CANDADO}${p.nombre} · pronto`;
    nav.appendChild(c);
  }
}

async function seleccionar(id) {
  const p = puzzleActivo(id);
  if (!p) return;
  // Los dos paneles cambian a la vez y al momento; lo que esté en marcha para el
  // puzzle anterior sigue en el Worker, pero su respuesta ya no se mostrará.
  pararReproduccion();
  repScr.cancelar();
  st.sel++;
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
  if (st.seccion === 'wca') try { localStorage.setItem('cubo-solver:puzzle', id); } catch { /* sin almacenamiento */ }
  pintarSelector();
  const activo = puedeResolver(p);
  $('editor').classList.toggle('desactivado', !activo);
  $('proximamente').hidden = activo;
  $('desc-solver').textContent = activo ? (p.descripcion || '') : '';
  // la pista de la vista 3D del editor: en el 4x4 y el 5x5 vendados no se pinta
  const pista = document.querySelector('#vista3d-editor .pista-3d');
  if (pista) pista.textContent = p.avisoPintar ? 'Arrastra para girarlo' : 'Arrastra para girarlo · toca para pintar';
  $('tipo-scramble').textContent = p.tipoScramble || '';
  for (const b of ['resetear', 'cargar', 'resolver']) $(b).disabled = !activo;
  $('nuevo').disabled = false;
  pintarLeyenda();
  pintarMetodo();
  pintarPaleta();
  pintarAccionesEditor();
  pintarVistas();
  limpiarMensajes();
  panelBloqueos.alSeleccionar();
  pintarEditor();
  $('aviso-tablas').hidden = true;
  const r = nuevoScramble();
  asegurarTablas().catch((err) => { if (st.p === p) mensaje('error', `No se pudieron generar las tablas: ${err.message}`); });
  await r;
}

// ---------- Tablas (en el Worker o en el hilo principal) ----------
function textoSegundos(ms) { return (ms / 1000).toFixed(1).replace('.', ',') + ' s'; }

const tablasEnCamino = new Map(); // puzzle -> promesa de 'inicializar' (una sola petición por puzzle)
const avisoEnCamino = new Map(); // puzzle -> promesa de asegurarTablas (un solo aviso con su reloj)
const inicioTablas = new Map();  // puzzle -> instante en que se empezaron a generar sus tablas
function asegurarTablas() {
  const p = st.p;
  const k = claveP(p);
  if (!p.capacidades.resolver || st.listos.has(k)) return Promise.resolve();
  if (!avisoEnCamino.has(k)) avisoEnCamino.set(k, generarTablas(p).finally(() => avisoEnCamino.delete(k)));
  return avisoEnCamino.get(k);
}
async function generarTablas(p) {
  const aviso = $('aviso-tablas');
  aviso.hidden = false;
  aviso.classList.add('cargando');
  const base = p.avisoInicializacion || 'Generando tablas de búsqueda…';
  const dondeTxt = () => (motor.modo() === 'worker' ? ' (en segundo plano)' : '');
  const t0 = performance.now();
  const k = claveP(p);
  inicioTablas.set(k, t0);
  aviso.textContent = base + dondeTxt();
  // el aviso es de este puzzle: si se cambia de puzzle, deja de actualizarse (y vuelve al volver)
  const reloj = setInterval(() => {
    if (st.p !== p) return;
    aviso.hidden = false;
    aviso.classList.add('cargando');
    aviso.textContent = `${base}${dondeTxt()} ${textoSegundos(performance.now() - t0)}`;
  }, 100);
  try {
    if (!tablasEnCamino.has(k)) tablasEnCamino.set(k, motor.pedir('inicializar', p.id, datosDe(p)).finally(() => tablasEnCamino.delete(k)));
    const r = await tablasEnCamino.get(k);
    const ms = r.yaEstaba ? Math.round(performance.now() - t0) : r.ms;
    st.listos.add(k);
    if (st.p === p && p.bloqueos) {
      panelBloqueos.fijarAnalisis({ ...r.analisis, msTablas: r.analisis && r.analisis.msTablas != null ? r.analisis.msTablas : ms });
      st.analisisBloqueos = r.analisis ? { clave: k, ...r.analisis } : null;
      pintarAvisoScramble();
      // la URL lleva la longitud solo si esta configuración usa el práctico
      if (st.seccion === 'bandaged') reemplazarURL(hashVendado());
      // si se eligió otra longitud que la de por defecto, el scramble a la vista (de las precargas) no vale
      if (st.p === p && st.scramble.length && JSON.stringify(opcionesScramble(p)) !== st.opcionesScrambleMostrado) nuevoScramble();
    }
    if (st.p === p) aviso.textContent = `Tablas de ${p.nombre} generadas en ${ms} ms ${motor.modo() === 'worker' ? 'en un Web Worker (la página no se bloquea)' : 'en el hilo principal'}.`;
  } finally {
    clearInterval(reloj);
    if (st.p === p) aviso.classList.remove('cargando');
  }
}

// ---------- Scramble ----------
// Scrambles precargados: uno listo por puzzle (st.precargados). Al mostrar uno se pide
// el siguiente de ese puzzle (prioridad media) y, con el Worker de fondo libre, se
// precargan los demás (prioridad baja), empezando por los más rápidos de generar.
// Cada petición lleva un id; st.gen cambia con cada selección o "Nuevo scramble", y
// una respuesta de otra generación no se muestra (se guarda como precargada).
const esMovil = () => !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 700px), (pointer: coarse)').matches);
const COSTE_PESADO = 500; // ms: en el móvil, no se precargan los que tardan más hasta que se elige el puzzle

/** Tiempo de generación (ms, en el Worker) de cada scramble recibido. */
const msGeneracion = new WeakMap();

function pedirScramble(p, prioridad) {
  const k = claveP(p);
  let prom = st.enCamino.get(k);
  if (prom) {
    if (prioridad !== 'baja') motor.subirPrioridad(prom.idPeticion, prioridad);
    return prom;
  }
  const peticion = motor.pedir('scramble', p.id, datosDe(p), { prioridad });
  prom = peticion.then((r) => {
    st.enCamino.delete(k);
    msGeneracion.set(r.movimientos, r.ms); // (para las mediciones en Chromium: cuánto tardó el Worker)
    // nadie la espera (precarga) o la esperaba una generación ya pasada: se guarda
    if (!prom.reclamada && !st.precargados.has(k)) st.precargados.set(k, r.movimientos);
    return r.movimientos;
  }, (err) => { st.enCamino.delete(k); throw err; });
  prom.idPeticion = peticion.id;
  prom.reclamada = false;
  st.enCamino.set(k, prom);
  return prom;
}

/** Después de mostrar un scramble de p: el siguiente de p y, en segundo plano, los demás. */
function rellenarPrecargas(p) {
  if (!st.precargados.has(claveP(p))) pedirScramble(p, 'media').catch(() => {});
  st.visitados.add(p.id);
  // las de los demás puzzles, cuando ya se sabe si hay Worker (sin él, solo las baratas)
  motor.listo.then(() => precargarOtros(p));
}
function precargarOtros(p) {
  const local = motor.modo() !== 'worker';
  const candidatos = PUZZLES
    .filter((q) => q.id !== p.id && !st.precargados.has(claveP(q)) && !st.enCamino.has(claveP(q)))
    // sin Worker, solo los que no necesitan tablas (no bloquear la página);
    // en el móvil, los pesados solo cuando el usuario ya ha elegido ese puzzle
    .filter((q) => (local ? (q.costeScramble || 0) <= 20 : !(esMovil() && (q.costeScramble || 0) > COSTE_PESADO && !st.visitados.has(q.id))))
    .sort((a, b) => (a.costeScramble || 0) - (b.costeScramble || 0));
  for (const q of candidatos) pedirScramble(q, 'baja').catch(() => {});
}

function mostrarGenerando(p) {
  repScr.cancelar();
  st.scramble = [];
  st.prefijos = [p.estadoResuelto()];
  st.pasoScramble = 0;
  st.estadoScramble = st.prefijos[0];
  $('panel-scramble').dataset.puzzle = p.id; // de qué puzzle es lo que se ve (lo comprueban los tests)
  const el = $('scramble');
  el.textContent = 'Generando scramble…';
  el.classList.add('generando');
  el.classList.remove('largo');
  $('longitud').textContent = '';
  $('copiar').disabled = true;
  $('cargar').disabled = true;
  $('nota-scramble').hidden = true;
  pintarPrevia();
}

function mostrarScramble(p, movimientos) {
  repScr.cancelar();
  st.scramble = movimientos;
  st.prefijos = [p.estadoResuelto()];
  for (const m of st.scramble) st.prefijos.push(p.aplicarMovimiento(st.prefijos[st.prefijos.length - 1], m));
  st.pasoScramble = st.scramble.length;
  st.estadoScramble = st.prefijos[st.scramble.length];
  // puzzles cuyos scrambles giran el puzzle entero (Megaminx): se muestra (y se
  // carga en el editor) en la orientación de referencia
  if (p.estadoVistaScramble) st.estadoScramble = p.estadoVistaScramble(st.estadoScramble);
  $('panel-scramble').dataset.puzzle = p.id;
  const texto = p.formatear(st.scramble);
  const el = $('scramble');
  el.textContent = !st.scramble.length && p.bloqueos ? 'Con estos bloques no hay ningún movimiento posible (mira «Tus bloques»).' : texto;
  el.classList.remove('generando');
  el.classList.toggle('largo', texto.length > 140);
  $('longitud').textContent = p.describirLongitud ? p.describirLongitud(st.scramble) : `${st.scramble.length} movimientos`;
  $('copiar').disabled = false;
  $('cargar').disabled = !puedeResolver(p);
  pintarPrevia();
  const nota = $('nota-scramble');
  nota.textContent = p.notaScramble ? p.notaScramble(st.scramble) : '';
  nota.hidden = !p.notaScramble;
  pintarAvisoScramble();
  seguirScrambleEnEditor(p);
}

/** ¿Se ha pedido el scramble de estado mezclado (y esta configuración tiene los dos modos)? */
/** Análisis del vendado p (si ya ha llegado y es de esta configuración). */
const analisisDe = (p) => (p && p.bloqueos && st.analisisBloqueos && st.analisisBloqueos.clave === claveP(p) ? st.analisisBloqueos : null);
/**
 * Opciones del scramble según la elección (null = el de siempre, de las precargas). Una longitud que
 * esta configuración no ofrece (p. ej. 60 en un 4x4) cuenta como la de por defecto.
 * @returns {{ modo: 'mezclado' } | { giros: number } | null}
 */
function opcionesScramble(p) {
  const a = analisisDe(p);
  if (!a || !a.scramblePractico || !st.eleccionScramble) return null;
  if (st.eleccionScramble === 'mezclado') return { modo: 'mezclado' };
  const n = Number(st.eleccionScramble);
  if (n === a.girosPractico || !(a.longitudesPractico || []).includes(n)) return null;
  return { giros: n };
}
/** Elección efectiva: 'mezclado' o la longitud (número). */
function eleccionEfectiva(p) {
  const a = analisisDe(p);
  const o = opcionesScramble(p);
  if (!o) return a ? a.girosPractico : null;
  return 'modo' in o ? 'mezclado' : o.giros;
}
const mezcladoPedido = (p) => eleccionEfectiva(p) === 'mezclado';
/** Cambia la elección (y la guarda en el navegador si se pide). */
function fijarEleccionScramble(valor, { guardar = true } = {}) {
  st.eleccionScramble = valor;
  if (guardar) { try { localStorage.setItem('cubo-solver:scramble-practico', valor); } catch { /* */ } }
}

/**
 * Aviso del scramble práctico (bloque 3 de la sesión «509 giros…»): en las configuraciones donde
 * mezclar necesita más de 10.000 pasos, el scramble por defecto son 100 giros al azar; se dice, y un
 * botón pide el de estado mezclado (diciendo antes cuánto mide) o vuelve al práctico.
 */
function pintarAvisoScramble() {
  const caja = $('aviso-scramble');
  const p = st.p;
  const a = analisisDe(p);
  if (!a || !a.scramblePractico || !st.scramble.length) { caja.hidden = true; return; }
  caja.hidden = false;
  const fmt = (n) => Number(n).toLocaleString('es-ES');
  const actual = eleccionEfectiva(p);
  const mezclado = actual === 'mezclado';
  $('aviso-scramble-texto').textContent = mezclado
    ? `Scramble de estado mezclado: la inversa de una solución comprobada de un estado bien mezclado (${fmt(a.pasosMezcla)} pasos de un paseo al azar). Es largo: unos ${fmt(a.longitudMezclado)} giros.`
    : `Configuración muy restringida: scramble práctico de giros al azar, no de estado aleatorio. Mezclar de verdad necesita unos ${fmt(a.pasosMezcla)} pasos de un paseo al azar.`;
  // selector: 30 · WCA (por defecto) · 100 · Mezclado
  const sel = $('longitud-practico');
  sel.innerHTML = '';
  const opciones = [...(a.longitudesPractico || [a.girosPractico]).map((n) => ({ valor: String(n), n })), { valor: 'mezclado', n: 'mezclado' }];
  for (const o of opciones) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opcion-longitud';
    b.dataset.valor = o.valor;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(o.n === actual));
    b.textContent = o.n === 'mezclado' ? `Mezclado (unos ${fmt(a.longitudMezclado)})` : o.n === a.girosPractico ? `${o.n} (WCA)` : String(o.n);
    b.title = o.n === 'mezclado' ? 'Inversa de una solución comprobada de un estado bien mezclado' : `${o.n} giros legales al azar`;
    b.addEventListener('click', () => {
      if (o.n === actual) return;
      fijarEleccionScramble(o.valor);
      reemplazarURL(hashVendado());
      nuevoScramble();
    });
    sel.appendChild(b);
  }
  const c = a.calidadPractico && a.calidadPractico[String(actual)];
  const calidad = $('calidad-practico');
  calidad.hidden = !c;
  if (c) calidad.textContent = `Mezcla de la forma: ${c.mezcla} % (distancia media de la forma al resuelto ${fmt(c.distanciaMedia)}, frente a ${fmt(c.distanciaExacta)} en un estado al azar)`;
}

/** Huella de un estado para compararlos (arrays, typed arrays u objetos). */
const huellaEstado = (e) => JSON.stringify(ArrayBuffer.isView(e) || Array.isArray(e) ? Array.from(/** @type {ArrayLike<unknown>} */ (e)) : e);

/**
 * Sesión «509 giros» (26/11/2026). Antes, con un scramble cargado en el editor, «Nuevo scramble» no
 * tocaba el editor y «Resolver» volvía a resolver el estado del scramble ANTERIOR (cuatro scrambles
 * distintos daban la misma solución de 509 giros). Ahora, si el editor tiene un scramble cargado sin
 * tocar, pasa al nuevo (y se quita la solución vieja); si el usuario lo ha editado, se le deja y se
 * le avisa de que no es el scramble actual.
 */
function seguirScrambleEnEditor(p) {
  const c = st.editorCargado;
  if (!c || c.clave !== claveP(p) || !st.estadoScramble || ocupado()) return;
  if (c.scramble === st.scramble) return;
  const actual = st.sol ? st.sol.base : st.editor;
  if (actual && huellaEstado(actual) === c.huella) {
    quitarSolucion();
    st.seleccion = null;
    cargarScrambleEnEditor(p);
    limpiarMensajes();
    pintarEditor();
  } else {
    limpiarMensajes();
    mensaje('aviso', 'El editor tiene un estado que has cambiado, no el scramble nuevo: pulsa «Cargar scramble actual» si quieres resolver el scramble.');
    st.editorCargado = null;
  }
}

/** Pone el scramble actual en el editor y anota de dónde sale. */
function cargarScrambleEnEditor(p) {
  st.editor = st.estadoScramble ? p.clonar(st.estadoScramble) : p.estadoResuelto();
  // de dónde sale el estado (para el validador de los vendados: alcanzable por construcción)
  st.secuenciaEditor = st.estadoScramble && p.bloqueos ? st.scramble.slice() : null;
  st.editorCargado = st.estadoScramble ? { clave: claveP(p), scramble: st.scramble, huella: huellaEstado(st.editor) } : null;
}

async function nuevoScramble() {
  const p = st.p;
  const gen = ++st.gen;
  // Scramble de estado mezclado pedido a mano (vendados con mezcla extrema: bloque 3 de la sesión
  // «509 giros…»): no sale de las precargas (que son prácticas), se pide aparte
  const opcionesPedidas = opcionesScramble(p);
  if (opcionesPedidas) {
    mostrarGenerando(p);
    let r;
    try { r = await motor.pedir('scramble', p.id, datosDe(p, { opciones: opcionesPedidas }), { prioridad: 'alta' }); } catch (err) {
      if (gen === st.gen) mensaje('error', `No se pudo generar el scramble: ${err.message}`);
      return;
    }
    msGeneracion.set(r.movimientos, r.ms);
    if (gen === st.gen && st.p === p) { mostrarScramble(p, r.movimientos); st.opcionesScrambleMostrado = JSON.stringify(opcionesPedidas); }
    return;
  }
  const listo = st.precargados.get(claveP(p));
  st.opcionesScrambleMostrado = 'null';
  if (listo) {
    st.precargados.delete(claveP(p));
    mostrarScramble(p, listo);
    rellenarPrecargas(p);
    return;
  }
  mostrarGenerando(p);
  let movs;
  const prom = pedirScramble(p, 'alta');
  prom.reclamada = true;
  try {
    movs = await prom;
  } catch (err) {
    if (gen === st.gen) mensaje('error', `No se pudo generar el scramble: ${err.message}`);
    return;
  }
  if (gen !== st.gen || st.p !== p) {
    // respuesta obsoleta (se cambió de puzzle o se pidió otro): no se muestra
    if (!st.precargados.has(claveP(p))) st.precargados.set(claveP(p), movs);
    return;
  }
  mostrarScramble(p, movs);
  rellenarPrecargas(p);
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
  if (p.avisoPintar) {
    // 4x4 y 5x5 vendados: sin paleta (pintar está desactivado; ver nxn-identidad.js)
    const t = document.createElement('p');
    t.className = 'aviso aviso-pintar';
    t.textContent = p.avisoPintar;
    cont.appendChild(t);
    return;
  }
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
  if (panelBloqueos.editando()) {
    // editando los bloques: el editor enseña el cubo resuelto con los bloques del borrador
    $('panel-resolver').dataset.puzzle = p.id;
    const v = vista3D('editor');
    $('vista-editor').hidden = !!v;
    $('vista3d-editor').hidden = !v;
    panelBloqueos.dibujar();
    pintarModos();
    $('deshacer').disabled = true;
    pintarSolucion();
    return;
  }
  const editable = puedeResolver(p);
  const mostrado = estadoMostrado();
  $('panel-resolver').dataset.puzzle = p.id;
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
      } else if (v.escena.resaltado && (v._resalteEditor || v._resalteAprender)) v.resaltar(null);
      v._resalteEditor = st.seleccion != null;
      v._resalteAprender = false;
      // modo aprender: las piezas en las que se trabaja en este paso
      const peg = st.seleccion == null ? pegatinasResaltadas() : null;
      if (peg) {
        const set = new Set(peg);
        v.resaltar(vista.geometria.pegatinas.map((q, k) => (set.has(q.indice) ? k : -1)).filter((k) => k >= 0), 'brillo');
        v._resalteAprender = true;
      }
    }
  } else {
    $('vista-editor').innerHTML = p.renderizar(mostrado, { editable, editables, seleccion: st.seleccion, vista: st.vista, etiquetas: !!st.sol });
    const peg = pegatinasResaltadas();
    if (peg) {
      const svg = $('vista-editor').querySelector('svg');
      if (svg) svg.classList.add('con-resalte');
      for (const i of peg) { const el = $('vista-editor').querySelector(`[data-i="${i}"]`); if (el) el.classList.add('resaltada'); }
    }
  }
  pintarModos();
  $('deshacer').disabled = !editable || st.historial.length === 0;
  pintarSolucion();
}

function alPulsarPegatina(ev) {
  const t = ev.target.closest('.pegatina');
  // 4x4 y 5x5 vendados: sus pegatinas no se pueden pintar; al tocarlas se dice por qué
  if (!t && st.p && st.p.avisoPintar && !panelBloqueos.editando() && ev.target.closest('[data-i]')) { mensaje('info', st.p.avisoPintar); return; }
  if (!t) return;
  tocarPegatina(parseInt(t.getAttribute('data-i'), 10));
}

function tocarPegatina(i) {
  if (panelBloqueos.editando()) { panelBloqueos.tocar(i); return; }
  // 4x4 y 5x5 vendados: no se puede pintar (no se sabe qué centro es cuál): se dice por qué
  if (st.p.avisoPintar) { mensaje('info', st.p.avisoPintar); return; }
  if (!puedeResolver(st.p) || ocupado()) return;
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

// ---------- Modo aprender: selector de método ----------
/** Método humano elegido en el puzzle actual ('' = solución óptima por ordenador). */
function metodoActual(p = st.p) {
  const m = st.metodos[p.id] || '';
  return p.metodosAprender && p.metodosAprender.some((x) => x.id === m) ? m : '';
}
function pintarMetodo() {
  const p = st.p;
  const caja = $('metodo');
  caja.hidden = !p.metodosAprender || !puedeResolver(p);
  if (caja.hidden) return;
  const sel = $('sel-metodo');
  sel.innerHTML = '';
  const opciones = [{ id: '', texto: 'Solución óptima (por ordenador)' }].concat(p.metodosAprender.map((m) => ({ id: m.id, texto: `Aprender (método ${m.nombre})` })));
  for (const o of opciones) {
    const op = document.createElement('option');
    op.value = o.id;
    op.textContent = o.texto;
    sel.appendChild(op);
  }
  sel.value = metodoActual(p);
  const m = p.metodosAprender.find((x) => x.id === sel.value);
  $('desc-solver').textContent = m ? m.descripcion : (p.descripcion || '');
}
function cambiarMetodo() {
  st.metodos[st.p.id] = $('sel-metodo').value;
  try { localStorage.setItem('cubo-solver:metodos', JSON.stringify(st.metodos)); } catch { /* sin almacenamiento */ }
  if (st.sol) { st.editor = st.sol.base; quitarSolucion(); }
  pintarMetodo();
  limpiarMensajes();
  pintarEditor();
}

/** Bloque del modo aprender en el que está el paso k (el siguiente movimiento), o null. */
function bloqueDelPaso(k) {
  const s = st.sol;
  if (!s || !s.etapas || k >= s.movimientos.length) return null;
  for (const et of s.etapas) for (const b of et.bloques) if (k >= b.inicio && k < b.fin) return { etapa: et, bloque: b };
  return null;
}
/** Pegatinas (índices del estado) de las piezas del bloque actual en el paso actual. */
function pegatinasResaltadas() {
  const x = bloqueDelPaso(st.paso);
  if (!x || !x.bloque.piezas.length) return null;
  const p = st.p;
  // se siguen las pegatinas desde el inicio del bloque: un "estado" con el índice de cada pegatina
  let id = p.estadoResuelto().map((_, i) => i);
  for (let i = x.bloque.inicio; i < st.paso; i++) id = p.aplicarMovimiento(id, st.sol.movimientos[i]);
  const quiero = new Set(x.bloque.piezas);
  const r = [];
  id.forEach((orig, j) => { if (quiero.has(orig)) r.push(j); });
  return r;
}

function pintarExplicacion() {
  const caja = $('explicacion');
  const s = st.sol;
  if (!s || !s.etapas) { caja.hidden = true; caja.innerHTML = ''; return; }
  caja.hidden = false;
  const n = s.movimientos.length;
  const x = bloqueDelPaso(st.paso);
  // etapa a mostrar: la del siguiente movimiento (o la última al terminar)
  const et = x ? x.etapa : s.etapas[s.etapas.length - 1];
  const ie = s.etapas.indexOf(et);
  caja.innerHTML = '';
  const h = document.createElement('h3');
  h.textContent = st.paso >= n ? `¡Resuelto! Última etapa: ${et.nombre}` : `Etapa ${ie + 1}/${s.etapas.length} · ${et.nombre}`;
  const obj = document.createElement('p');
  obj.className = 'objetivo';
  obj.textContent = et.objetivo;
  const ol = document.createElement('ol');
  for (const b of et.bloques) {
    const li = document.createElement('li');
    if (st.paso >= b.fin) li.classList.add('hecho');
    if (x && x.bloque === b) li.classList.add('actual');
    const t = document.createElement('span');
    t.textContent = b.texto;
    li.appendChild(t);
    if (b.algoritmo) {
      const a = document.createElement('span');
      a.className = 'alg';
      a.textContent = b.algoritmo;
      li.appendChild(a);
    }
    const c = document.createElement('code');
    c.textContent = s.movimientos.slice(b.inicio, b.fin).join(' ');
    li.appendChild(c);
    li.title = 'Ir al final de este paso';
    li.addEventListener('click', () => { repSol.parar(); repSol.irA(b.fin); });
    ol.appendChild(li);
  }
  caja.append(h, obj, ol);
  const act = ol.querySelector('li.actual');
  if (act && ol.scrollHeight > ol.clientHeight) ol.scrollTop = Math.max(0, act.offsetTop - ol.offsetTop - 40);
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
  return d;
}

// ---------- Resolver ----------
async function resolver() {
  const p = st.p;
  // Un clic nunca se pierde en silencio: si aún no hay puzzle (no debería pasar: el
  // inicial se elige al arrancar y los botones empiezan desactivados) o ya se está
  // resolviendo, se dice.
  if (!p) { mensaje('info', 'Cargando la aplicación… vuelve a pulsar en un momento.'); return; }
  if (ocupado()) { mensaje('info', 'Ya se está calculando la solución: aparecerá aquí al terminar.'); return; }
  if (!puedeResolver(p)) { mensaje('error', 'Este puzzle aún no tiene solucionador.'); return; }
  const sel = st.sel; // si se cambia de puzzle (aunque se vuelva a este), la respuesta no se muestra
  const vigente = () => st.p === p && st.sel === sel;
  st.ocupado = claveP(p);
  $('resolver').disabled = true;
  let reloj = null;
  try {
    if (st.sol) { st.editor = st.sol.base; quitarSolucion(); }
    st.seleccion = null;
    limpiarMensajes();
    if (!st.listos.has(claveP(p))) {
      // tablas en camino (o por pedir): el clic queda en espera, con el tiempo a la vista
      const pedidas = asegurarTablas();
      const t0 = inicioTablas.get(claveP(p)) ?? performance.now();
      const m = mensaje('info', `Generando tablas… ${textoSegundos(performance.now() - t0)} · la solución aparecerá al terminar.`);
      reloj = setInterval(() => { m.textContent = `Generando tablas… ${textoSegundos(performance.now() - t0)} · la solución aparecerá al terminar.`; }, 100);
      await pedidas;
      clearInterval(reloj);
      reloj = null;
      if (!vigente()) return;
      limpiarMensajes();
    }
    // Un scramble de la app cargado sin tocar es alcanzable por construcción: se manda con su
    // secuencia (el Worker comprueba que el estado es exactamente el que da; si se ha editado, no
    // lo es y se valida como siempre). Sesión «validador con muchas geometrías».
    const secuencia = p.bloqueos && st.secuenciaEditor ? st.secuenciaEditor : null;
    const v = await motor.pedir('validar', p.id, datosDe(p, secuencia ? { estado: st.editor, opciones: { secuencia } } : { estado: st.editor }));
    if (!vigente()) return;
    // Tres resultados: válido e imposible (demostrados) y sin comprobar, que es un aviso (nunca un
    // error) y deja intentar resolver
    const resultado = v.resultado || (v.valido ? 'valido' : 'imposible');
    if (resultado === 'imposible') {
      mensaje('error', 'Este estado no es posible:');
      v.errores.forEach((e) => mensaje('error', e));
      return;
    }
    if (resultado === 'sin-comprobar') (v.avisos || []).forEach((e) => mensaje('aviso', e));
    const metodo = metodoActual(p);
    if (metodo) { await resolverAprendiendo(p, metodo, vigente); return; }
    mensaje('info', 'Buscando solución…');
    await esperarPintado();
    const r = await motor.pedir('resolver', p.id, datosDe(p, p.bloqueos ? { estado: st.editor, opciones: { estrategia: panelBloqueos.estrategia(), ...(secuencia ? { secuencia } : {}) } } : { estado: st.editor }));
    if (!vigente()) return;
    limpiarMensajes();
    if (!r.ok) {
      (r.errores.length ? r.errores : ['No se pudo resolver.']).forEach((e) => mensaje('error', e));
      return;
    }
    if (r.movimientos.length === 0) {
      mensaje('ok', 'El puzzle ya está resuelto.');
      return;
    }
    st.sol = { movimientos: r.movimientos, base: p.clonar(st.editor), ms: r.ms, fases: r.fases || null, vendado: p.bloqueos ? { estrategia: r.estrategia, detalle: r.detalle, sinBloqueos: r.sinBloqueos } : null };
    st.paso = 0;
    pintarVistas();
    mensaje('ok', 'Estado válido. Sigue la solución paso a paso con los controles.');
  } catch (err) {
    if (!vigente()) return;
    limpiarMensajes();
    mensaje('error', `Error al resolver: ${err.message}`);
  } finally {
    if (reloj) clearInterval(reloj);
    if (st.ocupado === claveP(p)) st.ocupado = false;
    if (vigente()) {
      $('resolver').disabled = !puedeResolver(st.p);
      pintarEditor();
    }
  }
}

/** Modo aprender: solución por el método humano (y la óptima, para comparar la longitud). */
async function resolverAprendiendo(p, metodo, vigente) {
  const nombre = p.metodosAprender.find((m) => m.id === metodo).nombre;
  mensaje('info', `Preparando la solución paso a paso (método ${nombre})…`);
  await esperarPintado();
  const base = p.clonar(st.editor);
  const r = await motor.pedir('aprender', p.id, datosDe(p, { estado: base, opciones: { metodo } }));
  if (!vigente()) return;
  let optima = null;
  try {
    const o = await motor.pedir('resolver', p.id, datosDe(p, { estado: base }));
    if (o.ok) optima = o.movimientos.length;
  } catch { /* la comparación es opcional */ }
  if (!vigente()) return;
  limpiarMensajes();
  if (!r.ok) { (r.errores && r.errores.length ? r.errores : ['No se pudo resolver.']).forEach((e) => mensaje('error', e)); return; }
  if (r.movimientos.length === 0) { mensaje('ok', 'El puzzle ya está resuelto.'); return; }
  st.sol = { movimientos: r.movimientos, base, ms: r.ms, fases: r.fases || null, etapas: r.etapas, giros: r.giros, metodo: nombre, optima };
  st.paso = 0;
  pintarVistas();
  mensaje('ok', `Estado válido. Solución por el método ${nombre}, etapa a etapa: avanza con los controles y lee qué consigue cada paso.`);
}

function quitarSolucion() {
  repSol.cancelar();
  const habia = !!st.sol;
  st.sol = null;
  st.paso = 0;
  if (habia) pintarVistas();
}

const NOMBRE_FASE = { paridad: 'Paridad', centros: 'Centros', aristas: 'Aristas', '3x3': '3x3', geometria: 'Geometría', permutacion: 'Permutación' };
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
  if (!st.sol) { caja.hidden = true; pintarExplicacion(); return; }
  caja.hidden = false;
  const n = st.sol.movimientos.length;
  const largo = st.p.describirLongitud ? st.p.describirLongitud(st.sol.movimientos) : `${n} movimiento${n === 1 ? '' : 's'}`;
  if (st.sol.etapas) {
    const rot = n - st.sol.giros;
    $('sol-resumen').textContent = `Método ${st.sol.metodo}: ${st.sol.giros} giros${rot ? ` (+ ${rot} ${rot === 1 ? 'giro' : 'giros'} del cubo entero)` : ''}`
      + (st.sol.optima != null ? ` · solución óptima: ${st.sol.optima} giros` : '');
  } else if (st.sol.vendado) $('sol-resumen').textContent = resumenVendado(largo);
  else $('sol-resumen').textContent = `${largo} · ${Math.max(1, Math.round(st.sol.ms))} ms`;
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
    if (/^[xyz]/.test(m)) cls.push('rotacion');
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
  pintarExplicacion();
}

/** Resumen de una solución del cubo vendado: estrategia, fases y comparación sin bloqueos. */
function resumenVendado(largo) {
  const v = st.sol.vendado, d = v.detalle || {};
  let t = `${largo} · ${Math.max(1, Math.round(st.sol.ms))} ms`;
  if (v.estrategia === 'A') t += ` · estrategia A (búsqueda directa: ${d.A ? d.A.metodo + (d.A.optima ? ', óptima' : '') : ''})`;
  else if (v.estrategia === 'B' && !d.B.fase2) t += ` · estrategia B (solo geometría: ${d.B.fase1})`;
  else if (v.estrategia === 'B') t += ` · estrategia B (geometría ${d.B.fase1} + permutación ${d.B.fase2})`;
  const otra = v.estrategia === 'A' ? d.B : d.A;
  if (otra) t += ` · la otra: ${otra.longitud}`;
  if (v.sinBloqueos) t += ` · sin bloqueos: ${v.sinBloqueos.longitud}${v.sinBloqueos.optima ? ' (óptima)' : ' (Kociemba)'}`;
  return t;
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

// ---------- Secciones y navegación ----------
const CANDADO = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const FLECHA = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const tema = crearTema({ boton: () => $('tema'), texto: () => $('tema-texto') });

/** Vuelve arriba de la página (sin window.scrollTo, que jsdom no tiene). */
function subirArriba() { const r = document.scrollingElement || document.documentElement; r.scrollTop = 0; }

/** Cambia la URL sin añadir una entrada al historial ni disparar hashchange. */
function reemplazarURL(hash) {
  const base = location.href.split('#')[0].split('?')[0];
  try { history.replaceState(history.state, '', base + hash); } catch { /* p. ej. about:blank */ }
}
/** Hash de Bandaged Cubes con los bloques aplicados (para que recargar o compartir la URL los conserve). */
const hashVendado = () => hashDe({ seccion: 'bandaged', consulta: [st.vendado === '3x3' ? '' : `puzzle=${st.vendado}`, st.bloqueos.length ? 'bloqueos=' + encodeURIComponent(textoDeBloqueos(st.bloqueos)) : '', parametroScramble()].filter(Boolean).join('&') });
/**
 * `scramble=<30|40|60|100|mezclado>` en la URL: solo si se ha elegido una longitud y la configuración
 * actual usa el scramble práctico (o aún no se sabe porque el análisis no ha llegado). Las demás
 * configuraciones no lo llevan.
 */
function parametroScramble() {
  if (!st.eleccionScramble) return '';
  const a = st.p && st.p.bloqueos ? analisisDe(st.p) : null;
  if (a && !a.scramblePractico) return '';
  return 'scramble=' + st.eleccionScramble;
}

/** Portada: una tarjeta por sección de SECCIONES (las disponibles son enlaces; las bloqueadas, no). */
function pintarPortada() {
  const disp = $('secciones-disponibles');
  const bloq = $('secciones-bloqueadas');
  disp.innerHTML = '';
  bloq.innerHTML = '';
  for (const s of SECCIONES) {
    if (s.estado === 'disponible') {
      const a = document.createElement('a');
      a.className = `tarjeta-seccion ${s.estilo || 'suave'}`;
      a.href = hashDe({ seccion: s.id });
      a.dataset.seccion = s.id;
      a.innerHTML = `<span class="lista"><span class="larga">${s.descripcion}</span><span class="corta">${s.descripcionCorta || s.descripcion}</span></span>`
        + `<span class="pie-tarjeta"><span class="nombre">${s.nombre}</span>${FLECHA}</span>`;
      disp.appendChild(a);
    } else {
      const li = document.createElement('li');
      li.className = 'tarjeta-bloqueada';
      li.dataset.seccion = s.id;
      li.innerHTML = `<span class="candado">${CANDADO}<span class="candado-texto">Próximamente</span></span>`
        + `<span><span class="nombre">${s.nombre}</span><span class="ejemplos">${s.descripcion}</span></span>`;
      bloq.appendChild(li);
    }
  }
  const mas = document.createElement('li');
  mas.className = 'tarjeta-mas';
  mas.textContent = 'Más en camino';
  bloq.appendChild(mas);
}

/** Puzzle de WCA Puzzles que se abre sin uno en la URL: el último elegido (o el 3x3). */
function puzzleWCAInicial() {
  let id = '3x3';
  try { id = localStorage.getItem('cubo-solver:puzzle') || id; } catch { /* sin almacenamiento */ }
  return PUZZLES.some((p) => p.id === id && p.categoria === 'wca') ? id : '3x3';
}

/**
 * Orden de los paneles según la sección. Se mueven los nodos (no CSS order) para que el orden del DOM,
 * el del tabulador y el de los lectores de pantalla sean el visual:
 *   WCA Puzzles: [Scramble, Resolver] (en .paneles-par, display: contents) y Tus bloques (oculto), como siempre;
 *   Bandaged Cubes: [Tus bloques, Resolver] (en .paneles-par: lado a lado en escritorio) y Scramble.
 * Solo maquetación: los paneles conservan sus nodos, escuchadores y lienzos (mover un canvas no pierde WebGL).
 * @param {string} seccion
 */
function ordenarPaneles(seccion) {
  const par = $('paneles-par');
  const [a, b, c] = seccion === 'bandaged'
    ? ['panel-bloqueos', 'panel-resolver', 'panel-scramble']
    : ['panel-scramble', 'panel-resolver', 'panel-bloqueos'];
  const sig = par.nextElementSibling;
  if ([...par.children].map((e) => e.id).join() === `${a},${b}` && sig && sig.id === c) return;
  const foco = document.activeElement;
  par.append($(a), $(b));
  $('paneles').append($(c));
  if (foco instanceof HTMLElement && foco !== document.activeElement && foco.isConnected) foco.focus({ preventScroll: true });
}

/** Escritorio, Bandaged Cubes: el Resolver solo se queda fijo al bajar (sticky, CSS) si cabe entero en la ventana. */
function vigilarResolverFijo() {
  const panel = $('panel-resolver');
  const mirar = () => panel.classList.toggle('cabe', panel.offsetHeight + 32 <= window.innerHeight);
  if (typeof ResizeObserver === 'function') new ResizeObserver(mirar).observe(panel);
  window.addEventListener('resize', mirar);
  mirar();
}

/**
 * Lee la URL y muestra la sección. Enlaces antiguos (#bloqueos=…, ?firma=…) abren Bandaged
 * Cubes con esa configuración; una sección bloqueada o desconocida vuelve a la portada.
 * navegacion: el usuario ha cambiado el hash (enlace, atrás/adelante): el foco va al título.
 */
function aplicarRuta({ navegacion = false } = {}) {
  const r = leerRuta(location.hash, location.search);
  if (r.redirigir) reemplazarURL('#/');
  const herramienta = r.seccion === 'wca' || r.seccion === 'bandaged';
  $('portada').hidden = herramienta;
  $('herramienta').hidden = !herramienta;
  $('app').dataset.seccion = r.seccion;
  $('herramienta').dataset.seccion = herramienta ? r.seccion : '';
  if (herramienta) ordenarPaneles(r.seccion);
  if (!herramienta) {
    // fuera de las herramientas: nada se anima en segundo plano
    repSol.cancelar();
    repScr.cancelar();
    st.seccion = 'portada';
    document.title = 'Cubo-solver · scrambles, validador y solucionador de puzzles';
    if (r.ancla) {
      const el = $(r.ancla);
      if (el.scrollIntoView) el.scrollIntoView({ block: 'start' });
      el.focus({ preventScroll: true });
    } else if (navegacion) { subirArriba(); }
    return;
  }
  const entra = st.seccion !== r.seccion;
  st.seccion = r.seccion;
  const datos = datosSeccion(r.seccion);
  $('t-seccion').textContent = datos.nombre;
  $('intro-seccion').textContent = INTRO_SECCION[r.seccion] || '';
  document.title = `${datos.nombre} · Cubo-solver`;
  if (r.seccion === 'wca') {
    const valido = r.puzzle && PUZZLES.some((p) => p.id === r.puzzle && p.categoria === 'wca');
    const id = valido ? r.puzzle : (st.p && !entra ? st.p.id : puzzleWCAInicial());
    reemplazarURL(hashDe({ seccion: 'wca', puzzle: id }));
    if (entra || !st.p || st.p.id !== id) seleccionar(id);
  } else {
    // Bandaged Cubes: el puzzle de la URL (sin él, el 3x3: los enlaces de antes) y la configuración
    // de la URL (enlace compartido) o la última aplicada de ese puzzle
    cambiarVendado(r.puzzle && BANDAGED.some((b) => b.url === r.puzzle) ? r.puzzle : '3x3');
    if (r.consulta) {
      // (las firmas del Bandaged Cube Explorer son solo del 3x3)
      const deURL = bloqueosDeURL({ hash: '#' + r.consulta, search: '' }, st.vendado);
      if (deURL) { st.bloqueos = deURL; st.bloqueosPor[st.vendado] = deURL; }
      // longitud del scramble práctico pedida en la URL (sesión «longitud del práctico»)
      const sc = new URLSearchParams(r.consulta).get('scramble');
      if (sc && /^(\d+|mezclado)$/.test(sc)) fijarEleccionScramble(sc, { guardar: true });
    }
    reemplazarURL(hashVendado());
    const clave = (p) => (p && p.claveBloqueos) || '';
    const quiero = st.bloqueos.length ? claveBloqueos(st.bloqueos) : '';
    const id = bandagedDe(st.vendado).puzzle.id;
    if (entra || !st.p || st.p.id !== id || clave(st.p) !== quiero) seleccionar(id);
  }
  if (navegacion && entra) {
    subirArriba();
    $('t-seccion').focus({ preventScroll: true });
  }
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
    cargarScrambleEnEditor(st.p);
    limpiarMensajes();
    pintarEditor();
  });
  $('resolver').addEventListener('click', resolver);

  $('sel-metodo').addEventListener('change', cambiarMetodo);
  try { st.metodos = JSON.parse(localStorage.getItem('cubo-solver:metodos') || '{}') || {}; } catch { /* */ }
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
    estado: () => ({ msScramble: st.scramble ? msGeneracion.get(st.scramble) ?? null : null, seccion: st.seccion, tema: tema.actual(), puzzle: st.p && st.p.id, bloqueos: st.p && st.p.bloqueos ? st.p.bloqueos.length : 0, paso: st.paso, pasoScramble: st.pasoScramble, modo: { ...st.modo }, webgl: st.webgl }),
    editor: () => st.p.clonar(estadoMostrado()),
    resuelto: () => st.p.estaResuelto(estadoMostrado()),
    // (para las comprobaciones en Chromium: muestra un scramble concreto como si lo hubiera generado
    // la app; sesión «validador con muchas geometrías», el scramble del fallo)
    mostrarScramble: (movs) => mostrarScramble(st.p, movs),
  };
  $('copiar').addEventListener('click', (e) => copiar(st.p.formatear(st.scramble), e.currentTarget));
  $('copiar-sol').addEventListener('click', (e) => st.sol && copiar(st.p.formatear(st.sol.movimientos), e.currentTarget));
  // Bloques del vendado: los de un enlace (los lee la ruta) o los últimos aplicados en este navegador
  st.bloqueos = leerBloqueosGuardados('3x3');
  panelBloqueos.iniciar();
  tema.iniciar();
  pintarPortada();
  // Navegación por hash: la portada, WCA Puzzles (#/wca/<id>) y Bandaged Cubes (#/bandaged).
  // El puzzle de una sección con herramienta se elige al momento al entrar (antes se esperaba
  // al ping de los Workers y un clic en "Resolver" en ese tiempo se perdía).
  window.addEventListener('hashchange', () => aplicarRuta({ navegacion: true }));
  vigilarResolverFijo();
  aplicarRuta();
}

iniciar();
