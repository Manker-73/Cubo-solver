// @ts-check
// «Colocar piezas» (noche 14): editor en pantalla completa para introducir el estado de un puzzle
// físico colocando bloques y piezas en un puzzle vacío. La lógica está en src/core/colocar.js (la
// sesión); esto solo la dibuja y traduce toques en acciones.
//
// Distribución (pensada para una mano en el móvil): arriba la cabecera (título, lo que falta,
// 2D/3D, Cancelar), en medio el puzzle, y abajo, al alcance del pulgar, lo que se puede hacer con
// lo elegido (piezas que caben en el hueco, Girar, Siguiente posición, Quitar), la bandeja y la
// barra con Deshacer y «Aplicar y salir». En escritorio (≥ 900 px), el puzzle a la izquierda y el
// panel a la derecha.

import { crearModeloColocar, crearSesionColocar } from '../core/colocar.js';
import { crearVista3D } from './vista3d.js';

/** @import { Puzzle, EstadoPegatinas, Validacion, MapaPuntos, SesionColocar, ModeloColocar, Vista3D } from '../core/tipos.js' */

/**
 * @typedef {{
 *   puzzle: Puzzle<EstadoPegatinas> & { bloqueEnPosicion?: unknown },
 *   base: Puzzle<EstadoPegatinas>,
 *   bloques?: Array<{ nombre: string, pegatinas: number[] }>,
 *   rotaciones?: MapaPuntos[],
 *   validar: (estado: EstadoPegatinas) => Promise<Validacion>,
 *   alAplicar: (estado: EstadoPegatinas, v: Validacion) => void,
 *   alCerrar?: () => void,
 *   webgl: boolean,
 *   modo?: '2d' | '3d',
 *   alCambiarModo?: (modo: '2d' | '3d') => void,
 * }} OpcionesColocar
 * @typedef {{ tipo: 'hueco', h: number } | { tipo: 'grupo', g: number } | { tipo: 'bloque', b: number } | null} Seleccion
 */

/** ¿Se pueden colocar piezas en este puzzle? @param {Puzzle<unknown> | null | undefined} p */
export function puedeColocar(p) {
  return !!(p && p.colocarPiezas && p.vista3D && Array.isArray(p.estadoResuelto()));
}

/** @param {string} s */
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

/**
 * Abre el editor en pantalla completa. Devuelve un objeto para los tests y las comprobaciones en
 * Chromium (las mismas acciones que los botones).
 * @param {Document} doc
 * @param {OpcionesColocar} op
 */
export function abrirColocar(doc, op) {
  const M = crearModeloColocar(op.base, { bloques: op.bloques, rotaciones: op.rotaciones });
  const S = crearSesionColocar(M);
  const p = op.puzzle;
  const paleta = p.paleta;
  /** @type {'2d' | '3d'} */
  let modo = op.modo === '3d' && op.webgl ? '3d' : '2d';
  /** @type {Seleccion} */
  let sel = null;
  /** @type {{ estado: string, v: Validacion | null, pendiente: boolean }} */
  let validacion = { estado: '', v: null, pendiente: false };
  let versionValidacion = 0;
  /** @type {string | null} */
  let aviso = null;
  /** @type {'info' | 'error' | 'ok' | 'aviso'} */
  let tipoAviso = 'info';
  const anterior = /** @type {HTMLElement | null} */ (doc.activeElement);

  const raiz = doc.createElement('div');
  raiz.className = 'colocar';
  raiz.id = 'colocar';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-labelledby', 'colocar-titulo');
  raiz.innerHTML = `
    <header class="colocar-cab">
      <h2 id="colocar-titulo" tabindex="-1">Colocar piezas · ${esc(p.nombre)}</h2>
      <span class="colocar-faltan" id="colocar-faltan" aria-live="polite"></span>
      <div class="conmutador" id="colocar-modo" role="group" aria-label="Puzzle en 2D o 3D">
        <button type="button" data-modo="2d" aria-pressed="false">2D</button><button type="button" data-modo="3d" aria-pressed="false">3D</button>
      </div>
      <button type="button" class="boton" id="colocar-cancelar">Cancelar</button>
    </header>
    <div class="colocar-cuerpo">
      <div class="colocar-vistas">
        <div class="vista editable colocar-2d" id="colocar-2d"></div>
        <div class="vista vista-3d editable colocar-3d" id="colocar-3d" hidden><span class="pista-3d">Arrastra para girarlo · toca un hueco</span></div>
      </div>
      <div class="colocar-panel">
        <p class="colocar-ayuda" id="colocar-ayuda"></p>
        <div class="colocar-contexto" id="colocar-contexto"></div>
        <div class="mensaje" id="colocar-mensaje" role="status" hidden></div>
        <div class="colocar-bandeja" id="colocar-bandeja" aria-label="Bandeja: lo que queda por colocar"></div>
      </div>
    </div>
    <footer class="colocar-pie">
      <button type="button" class="boton" id="colocar-deshacer">Deshacer</button>
      <button type="button" class="boton" id="colocar-vaciar">Vaciar</button>
      <button type="button" class="boton principal" id="colocar-aplicar" disabled>Aplicar y salir</button>
    </footer>`;
  doc.body.appendChild(raiz);
  doc.documentElement.classList.add('colocando');
  /** @param {string} id */
  const $ = (id) => /** @type {HTMLElement} */ (raiz.querySelector('#' + id));
  // pantalla completa de verdad si el navegador la da (si no, la capa fija ya ocupa la ventana)
  try {
    const r = /** @type {{ requestFullscreen?: () => Promise<void> }} */ (/** @type {unknown} */ (raiz)).requestFullscreen;
    if (r) r.call(raiz).catch(() => { /* sin permiso: se queda la capa fija */ });
  } catch { /* */ }

  /** @type {ReturnType<typeof crearVista3D> | null} */
  let v3d = null;
  /** @type {Vista3D | null} */
  let ultimaVista = null;

  // ---------- acciones (las mismas desde la interfaz y desde los tests) ----------
  /** @param {() => unknown} f */
  function accion(f) {
    aviso = null;
    try {
      f();
    } catch (err) {
      aviso = /** @type {Error} */ (err).message;
      tipoAviso = 'error';
    }
    const puestas = S.autoRellenar();
    if (puestas.length && !aviso) { aviso = puestas.length === 1 ? 'Se ha colocado sola una pieza que no tenía alternativa.' : `Se han colocado solas ${puestas.length} piezas que no tenían alternativa.`; tipoAviso = 'info'; }
    pintar();
    comprobar();
  }
  /** Toque en una pegatina (índice del estado). @param {number} i */
  function tocar(i) {
    const h = M.huecoDePegatina[i];
    if (h < 0) return;
    if (sel && sel.tipo === 'bloque') {
      const b = sel.b;
      accion(() => { S.colocarBloque(b, h); sel = { tipo: 'hueco', h }; });
      return;
    }
    if (sel && sel.tipo === 'grupo' && !S.colocada(h)) {
      const g = sel.g;
      accion(() => { S.colocar(h, g); sel = { tipo: 'hueco', h }; });
      return;
    }
    // volver a tocar el hueco vacío elegido lo deja de elegir
    if (sel && sel.tipo === 'hueco' && sel.h === h && !S.colocada(h)) { sel = null; aviso = null; pintar(); return; }
    sel = { tipo: 'hueco', h };
    if (!S.colocada(h)) {
      const c = S.candidatos(h);
      // solo una pieza posible: se coloca sola
      if (c.length === 1) { const g = c[0].grupo; accion(() => S.colocar(h, g)); return; }
      if (!c.length) { aviso = huecoSinCandidatos(h); tipoAviso = 'info'; }
      else aviso = null;
    } else aviso = null;
    pintar();
  }
  /** @param {number} h */
  function huecoSinCandidatos(h) {
    const quedanBloques = M.bloques.some((b) => S.colocacionBloque(b.id) < 0 && b.colocaciones.some((c) => c.huecos.includes(h)));
    return quedanBloques ? 'En este hueco no cabe ninguna pieza suelta de las que quedan: es para un bloque. Elige el bloque en la bandeja y vuelve a tocar.' : 'No queda ninguna pieza que quepa en este hueco.';
  }
  /** Elegir un grupo de la bandeja (o, con un hueco vacío elegido, colocarlo ahí). @param {number} g */
  function elegirGrupo(g) {
    if (sel && sel.tipo === 'hueco' && !S.colocada(sel.h)) {
      const h = sel.h;
      accion(() => S.colocar(h, g));
      return;
    }
    sel = sel && sel.tipo === 'grupo' && sel.g === g ? null : { tipo: 'grupo', g };
    aviso = sel ? `Toca un hueco para colocar la ${M.grupos[g].nombre}.` : null;
    tipoAviso = 'info';
    pintar();
  }
  /** @param {number} b */
  function elegirBloque(b) {
    if (S.colocacionBloque(b) >= 0) {
      const h = M.bloques[b].colocaciones[S.colocacionBloque(b)].huecos[0];
      sel = { tipo: 'hueco', h };
      aviso = null;
    } else if (sel && sel.tipo === 'hueco' && !S.colocada(sel.h) && M.bloques[b].colocaciones.some((c, ci) => c.huecos.includes(/** @type {{ h: number }} */ (sel).h) && S.posicionesBloque(b) > 0 && ci >= 0)) {
      // hay un hueco vacío elegido: el bloque va ahí si cabe; si no, queda elegido para tocar otro
      const h = sel.h;
      try { accion(() => { S.colocarBloque(b, h); sel = { tipo: 'hueco', h }; }); } catch { /* accion ya lo dice */ }
      if (S.colocacionBloque(b) < 0) { sel = { tipo: 'bloque', b }; tipoAviso = 'error'; pintar(); }
      return;
    } else {
      sel = sel && sel.tipo === 'bloque' && sel.b === b ? null : { tipo: 'bloque', b };
      aviso = sel ? `Toca uno de los huecos que ocupará el bloque ${M.bloques[b].nombre}.` : null;
      tipoAviso = 'info';
    }
    pintar();
  }
  function girar() { if (sel && sel.tipo === 'hueco') { const h = sel.h; accion(() => { if (!S.girar(h)) throw new Error('No hay otra orientación posible aquí.'); }); } }
  function siguiente() {
    if (!sel || sel.tipo !== 'hueco') return;
    const c = S.colocada(sel.h);
    if (!c || c.bloque < 0) return;
    const b = c.bloque;
    accion(() => {
      if (!S.siguientePosicion(b)) throw new Error('El bloque no cabe en ninguna otra posición libre.');
      sel = { tipo: 'hueco', h: M.bloques[b].colocaciones[S.colocacionBloque(b)].huecos[0] };
    });
  }
  function quitar() { if (sel && sel.tipo === 'hueco') { const h = sel.h; accion(() => S.quitar(h)); } }
  function deshacer() { accion(() => { if (!S.deshacer()) throw new Error('No hay nada que deshacer.'); }); }
  function vaciar() { sel = null; accion(() => S.vaciar()); }

  // ---------- validación en vivo ----------
  function comprobar() {
    const ver = ++versionValidacion;
    if (!S.completo()) { validacion = { estado: '', v: null, pendiente: false }; pintarEstado(); return; }
    const e = S.estado();
    validacion = { estado: JSON.stringify(e), v: null, pendiente: true };
    pintarEstado();
    op.validar(e).then((v) => {
      if (ver !== versionValidacion) return;
      validacion = { estado: validacion.estado, v, pendiente: false };
      pintarEstado();
    }, (err) => {
      if (ver !== versionValidacion) return;
      validacion = { estado: validacion.estado, v: { valido: false, resultado: 'sin-comprobar', errores: [], avisos: [`No se pudo comprobar: ${err.message}`] }, pendiente: false };
      pintarEstado();
    });
  }
  /** Resultado de la validación: 'valido', 'imposible' o 'sin-comprobar' (o '' si no está todo). */
  function resultado() {
    const v = validacion.v;
    if (!v) return '';
    return v.resultado || (v.valido ? 'valido' : 'imposible');
  }

  // ---------- dibujo ----------
  function pintar() {
    pintarVista();
    pintarContexto();
    pintarBandeja();
    pintarEstado();
    $('colocar-deshacer').toggleAttribute('disabled', !S.puedeDeshacer());
    for (const b of raiz.querySelectorAll('#colocar-modo button')) {
      const bt = /** @type {HTMLButtonElement} */ (b);
      bt.setAttribute('aria-pressed', String(bt.dataset.modo === modo));
      if (bt.dataset.modo === '3d') bt.disabled = !op.webgl;
    }
  }
  /** Pegatinas a resaltar: las del hueco elegido (o del bloque entero). */
  function resaltadas() {
    if (!sel || sel.tipo !== 'hueco') return null;
    const c = S.colocada(sel.h);
    if (c && c.bloque >= 0) {
      const ci = S.colocacionBloque(c.bloque);
      return M.bloques[c.bloque].colocaciones[ci].huecos.flatMap((h) => M.pegatinasHueco(h));
    }
    return M.pegatinasHueco(sel.h);
  }
  function pintarVista() {
    const colores = S.colores();
    const enB = S.bloqueEnPosicion();
    const res = resaltadas();
    const c2 = $('colocar-2d'), c3 = $('colocar-3d');
    if (modo === '3d' && op.webgl) {
      if (!v3d) {
        v3d = crearVista3D(c3, { paleta, alTocar: (/** @type {{ indice: number | null }} */ peg) => { if (peg.indice != null) tocar(peg.indice); } });
        if (!v3d) { modo = '2d'; op.webgl = false; }
      }
    }
    if (modo === '3d' && v3d) {
      c2.hidden = true; c3.hidden = false;
      const vista = p.bloqueEnPosicion
        ? /** @type {(e: EstadoPegatinas, o: { bloqueEnPosicion: Int16Array }) => Vista3D} */ (/** @type {unknown} */ (p.vista3D))(colores, { bloqueEnPosicion: enB })
        : /** @type {(e: EstadoPegatinas) => Vista3D} */ (p.vista3D)(colores);
      ultimaVista = vista;
      v3d.mostrar(vista);
      if (res) {
        const set = new Set(res);
        v3d.resaltar(vista.geometria.pegatinas.map((q, k) => (q.indice != null && set.has(q.indice) ? k : -1)).filter((k) => k >= 0), 'brillo');
      } else v3d.resaltar(null);
      return;
    }
    c3.hidden = true; c2.hidden = false;
    c2.innerHTML = p.renderizar(colores, { editable: true, colores, bloqueEnPosicion: enB });
    const svg = c2.querySelector('svg');
    if (svg) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Puzzle: toca un hueco (gris) para colocar una pieza');
      // cada pegatina se puede tocar (huecos y piezas colocadas)
      for (const el of svg.querySelectorAll('[data-i]')) el.classList.add('pegatina');
      if (res) {
        svg.classList.add('con-resalte');
        for (const i of res) { const el = svg.querySelector(`[data-i="${i}"]`); if (el) el.classList.add('resaltada'); }
      }
    }
  }
  /** Muestra de colores de una pieza o grupo. @param {number[]} colores */
  const muestra = (colores) => `<span class="muestra-pieza" aria-hidden="true">${colores.map((c) => `<i style="background:${paleta[c] ? paleta[c].hex : '#888'}"></i>`).join('')}</span>`;

  function pintarContexto() {
    const cont = $('colocar-contexto');
    const ayuda = $('colocar-ayuda');
    cont.innerHTML = '';
    if (!sel) {
      ayuda.textContent = M.bloques.some((b) => S.colocacionBloque(b.id) < 0)
        ? 'Empieza por los bloques: elige uno en la bandeja y toca un hueco que vaya a ocupar. Luego, las piezas sueltas: toca un hueco gris y elige la pieza.'
        : 'Toca un hueco gris del puzzle y elige qué pieza va ahí (o elige primero la pieza en la bandeja).';
      return;
    }
    if (sel.tipo === 'grupo' || sel.tipo === 'bloque') {
      ayuda.textContent = sel.tipo === 'grupo' ? `Toca un hueco para la ${M.grupos[sel.g].nombre}.` : `Toca un hueco para el bloque ${M.bloques[sel.b].nombre}.`;
      return;
    }
    const h = sel.h;
    const c = S.colocada(h);
    if (!c) {
      const cand = S.candidatos(h);
      ayuda.textContent = cand.length ? `Hueco de ${M.tipos[M.tipoHueco(h)].singular}: ¿qué pieza va aquí?` : huecoSinCandidatos(h);
      const lista = doc.createElement('div');
      lista.className = 'colocar-candidatos';
      lista.setAttribute('role', 'group');
      lista.setAttribute('aria-label', 'Piezas que caben en este hueco');
      for (const k of cand) {
        const g = M.grupos[k.grupo];
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'pieza-boton';
        b.dataset.grupo = String(g.id);
        b.innerHTML = `${muestra(g.colores)}<span>${esc(g.nombre)}</span>${k.restantes > 1 ? `<small>×${k.restantes}</small>` : ''}`;
        b.addEventListener('click', () => { const hh = h; accion(() => S.colocar(hh, g.id)); });
        lista.appendChild(b);
      }
      cont.appendChild(lista);
      return;
    }
    const pz = M.piezas[c.pieza];
    const enBloque = c.bloque >= 0;
    ayuda.textContent = enBloque ? `Bloque ${M.bloques[c.bloque].nombre}` : `${pz.nombre[0].toUpperCase()}${pz.nombre.slice(1)}`;
    const fila = doc.createElement('div');
    fila.className = 'colocar-botones';
    /** @param {string} id @param {string} texto @param {boolean} activo @param {() => void} f @param {string} [titulo] */
    const boton = (id, texto, activo, f, titulo) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'boton';
      b.id = id;
      b.textContent = texto;
      if (titulo) b.title = titulo;
      b.disabled = !activo;
      b.addEventListener('click', f);
      fila.appendChild(b);
    };
    const n = S.disposiciones(h);
    boton('colocar-girar', 'Girar', n > 1, girar, enBloque ? 'Otra orientación del bloque que pasa por este hueco' : 'Otra orientación de la pieza');
    if (enBloque) boton('colocar-siguiente', 'Siguiente posición', S.posicionesBloque(c.bloque) > 1, siguiente, 'Otra posición en la que cabe el bloque entero');
    boton('colocar-quitar', enBloque ? 'Quitar bloque' : 'Quitar', true, quitar, 'Devolverlo a la bandeja');
    cont.appendChild(fila);
  }

  function pintarBandeja() {
    const cont = $('colocar-bandeja');
    cont.innerHTML = '';
    /** @param {string} titulo */
    const seccion = (titulo) => {
      const s = doc.createElement('section');
      s.className = 'bandeja-seccion';
      const h = doc.createElement('h3');
      h.textContent = titulo;
      s.appendChild(h);
      const l = doc.createElement('div');
      l.className = 'bandeja-lista';
      s.appendChild(l);
      cont.appendChild(s);
      return l;
    };
    // (con todos los bloques colocados la sección se oculta: se eligen tocándolos en el puzzle)
    if (M.bloques.some((b) => S.colocacionBloque(b.id) < 0)) {
      const l = seccion(`Bloques (${M.bloques.filter((b) => S.colocacionBloque(b.id) < 0).length} por colocar)`);
      for (const bq of M.bloques) {
        const puesto = S.colocacionBloque(bq.id) >= 0;
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'pieza-boton bloque' + (puesto ? ' puesta' : '');
        b.dataset.bloque = String(bq.id);
        b.setAttribute('aria-pressed', String(!!sel && sel.tipo === 'bloque' && sel.b === bq.id));
        b.innerHTML = `${muestra(bq.piezas.flatMap((k) => M.piezas[k].colores).filter((x, i, a) => a.indexOf(x) === i))}<span>${esc(bq.nombre)}</span><small>${puesto ? '✓ colocado' : `${bq.piezas.length} piezas`}</small>`;
        b.addEventListener('click', () => elegirBloque(bq.id));
        l.appendChild(b);
      }
    }
    for (const t of M.tipos) {
      const gs = M.grupos.filter((g) => g.tipo === t.id);
      if (!gs.length) continue;
      const quedan = gs.reduce((a, g) => a + S.restantes(g.id), 0);
      if (!quedan) continue;
      const l = seccion(`${t.nombre} (${quedan} por colocar)`);
      for (const g of gs) {
        const r = S.restantes(g.id);
        if (!r) continue;
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'pieza-boton';
        b.dataset.grupo = String(g.id);
        b.setAttribute('aria-pressed', String(!!sel && sel.tipo === 'grupo' && sel.g === g.id));
        b.setAttribute('aria-label', `${g.nombre}${r > 1 ? `, quedan ${r}` : ''}`);
        b.innerHTML = `${muestra(g.colores)}${r > 1 ? `<small>×${r}</small>` : ''}`;
        b.title = g.nombre;
        b.addEventListener('click', () => elegirGrupo(g.id));
        l.appendChild(b);
      }
    }
    if (!cont.children.length) {
      const pTodo = doc.createElement('p');
      pTodo.className = 'colocar-ayuda';
      pTodo.textContent = 'La bandeja está vacía: todo está colocado.';
      cont.appendChild(pTodo);
    }
  }

  function pintarEstado() {
    const f = S.faltan();
    const partes = [];
    if (f.bloques) partes.push(`${f.bloques} bloque${f.bloques === 1 ? '' : 's'}`);
    if (f.piezas) partes.push(`${f.piezas} pieza${f.piezas === 1 ? '' : 's'}`);
    $('colocar-faltan').textContent = partes.length ? `Faltan ${partes.join(' y ')}` : 'Todo colocado';
    const m = $('colocar-mensaje');
    /** @type {Array<{ tipo: string, texto: string }>} */
    const lineas = [];
    if (aviso) lineas.push({ tipo: tipoAviso, texto: aviso });
    const r = resultado();
    if (S.completo()) {
      if (validacion.pendiente) lineas.push({ tipo: 'info', texto: 'Comprobando si este estado es posible…' });
      else if (r === 'valido') lineas.push({ tipo: 'ok', texto: 'Estado válido: se puede llegar a él desde el puzzle resuelto. Pulsa «Aplicar y salir» y luego «Resolver».' });
      else if (r === 'imposible') {
        lineas.push({ tipo: 'error', texto: 'Este estado no es posible:' });
        for (const e of (validacion.v && validacion.v.errores) || []) lineas.push({ tipo: 'error', texto: e });
      } else if (r === 'sin-comprobar') {
        lineas.push({ tipo: 'aviso', texto: 'Sin comprobar:' });
        for (const e of (validacion.v && validacion.v.avisos) || []) lineas.push({ tipo: 'aviso', texto: e });
      }
    }
    m.hidden = !lineas.length;
    m.className = 'mensaje colocar-mensaje ' + (lineas.some((l) => l.tipo === 'error') ? 'error' : lineas.some((l) => l.tipo === 'aviso') ? 'aviso' : lineas.some((l) => l.tipo === 'ok') ? 'ok' : 'info');
    m.dataset.resultado = S.completo() && !validacion.pendiente ? r : '';
    m.innerHTML = lineas.map((l) => `<p class="${l.tipo}">${esc(l.texto)}</p>`).join('');
    const aplicar = /** @type {HTMLButtonElement} */ ($('colocar-aplicar'));
    aplicar.disabled = !S.completo() || validacion.pendiente || !r || r === 'imposible';
  }

  // ---------- eventos ----------
  $('colocar-2d').addEventListener('click', (ev) => {
    const t = /** @type {Element} */ (ev.target).closest('[data-i]');
    if (t) tocar(parseInt(/** @type {string} */ (t.getAttribute('data-i')), 10));
  });
  $('colocar-cancelar').addEventListener('click', () => cerrar());
  $('colocar-deshacer').addEventListener('click', deshacer);
  $('colocar-vaciar').addEventListener('click', vaciar);
  $('colocar-aplicar').addEventListener('click', aplicar);
  $('colocar-modo').addEventListener('click', (ev) => {
    const b = /** @type {Element} */ (ev.target).closest('button[data-modo]');
    if (!b) return;
    const m = /** @type {HTMLButtonElement} */ (b).dataset.modo === '3d' ? '3d' : '2d';
    if (m === modo) return;
    modo = m;
    if (op.alCambiarModo) op.alCambiarModo(modo);
    pintar();
  });
  /** @param {KeyboardEvent} ev */
  const teclas = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); cerrar(); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.stopPropagation(); deshacer(); }
    if (ev.key === 'Tab') {
      // el foco no sale del editor
      const focos = /** @type {HTMLElement[]} */ ([...raiz.querySelectorAll('button:not([disabled]), [tabindex="0"]')]).filter((e) => !e.closest('[hidden]'));
      if (!focos.length) return;
      const i = focos.indexOf(/** @type {HTMLElement} */ (doc.activeElement));
      if (ev.shiftKey && i <= 0) { ev.preventDefault(); focos[focos.length - 1].focus(); } else if (!ev.shiftKey && i === focos.length - 1) { ev.preventDefault(); focos[0].focus(); }
    }
  };
  doc.addEventListener('keydown', teclas, true);

  let abierto = true;
  function aplicar() {
    const r = resultado();
    if (!S.completo() || !validacion.v || r === 'imposible' || !r) return;
    const v = validacion.v;
    const estado = v.estado || S.estado();
    cerrar(true);
    op.alAplicar(estado, v);
  }
  /** @param {boolean} [aplicado] */
  function cerrar(aplicado = false) {
    if (!abierto) return;
    abierto = false;
    versionValidacion++;
    doc.removeEventListener('keydown', teclas, true);
    if (v3d) v3d.destruir();
    raiz.remove();
    doc.documentElement.classList.remove('colocando');
    try { if (doc.fullscreenElement && doc.exitFullscreen) doc.exitFullscreen().catch(() => { /* */ }); } catch { /* */ }
    if (!aplicado && op.alCerrar) op.alCerrar();
    if (anterior && anterior.isConnected) anterior.focus({ preventScroll: true });
  }

  pintar();
  accion(() => { /* colocar solas las piezas fijas (centros del 3x3…) */ });
  /** @type {HTMLElement} */ ($('colocar-titulo')).focus({ preventScroll: true });

  return {
    sesion: S,
    modelo: /** @type {ModeloColocar} */ (M),
    raiz,
    tocar,
    elegirGrupo,
    elegirBloque,
    girar,
    siguiente,
    quitar,
    deshacer,
    aplicar,
    cerrar: () => cerrar(),
    abierto: () => abierto,
    /** Resultado de la validación ('' mientras falte algo o se esté comprobando). */
    resultado: () => (validacion.pendiente ? '' : resultado()),
    seleccion: () => sel,
    ultimaVista: () => ultimaVista,
    /** @param {number} h */
    elegirHueco: (h) => tocar(M.pegatinasHueco(h)[0]),
  };
}

/** @typedef {ReturnType<typeof abrirColocar>} EditorColocar */
/** @typedef {SesionColocar} _Sesion */
