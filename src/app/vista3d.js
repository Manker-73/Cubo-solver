// Vista 3D con WebGL (sin librerías): dibuja la escena de escena3d.js, la gira con
// el ratón o el dedo, anima los giros y deja tocar pegatinas.
//
//   const v = crearVista3D(contenedor, { paleta, alTocar })   // null si no hay WebGL
//   v.mostrar(vista3D)                    // estado sin animación
//   await v.animar(partes, { ms, desde, hasta })   // giro animado (fracción desde → hasta)
//   v.terminar()                          // acaba ya la animación en curso
//   v.resaltar(indices, 'brillo' | 'transparencia'); v.resaltarPiezas(claves)
//   v.vistaInicial(); v.estadisticas(); v.destruir()

import { crearEscena3D } from './escena3d.js';
import { pegatinasDePiezas } from '../core/modelo3d.js';

const VS = `
attribute vec3 a_pos; attribute vec3 a_nor; attribute vec3 a_col; attribute float a_parte; attribute float a_res;
uniform mat4 u_proy; uniform mat3 u_vista; uniform mat3 u_rot1; uniform mat3 u_rot2;
uniform float u_hayRes; uniform float u_modo; uniform float u_metal;
varying vec3 v_col; varying float v_alfa;
void main() {
  vec3 p = a_pos; vec3 n = a_nor;
  if (a_parte > 0.5 && a_parte < 1.5) { p = u_rot1 * p; n = u_rot1 * n; }
  else if (a_parte > 1.5) { p = u_rot2 * p; n = u_rot2 * n; }
  vec3 pv = u_vista * p; vec3 nv = normalize(u_vista * n);
  gl_Position = u_proy * vec4(pv, 1.0);
  vec3 L = normalize(vec3(0.3, 0.75, 0.6));
  float luz = 0.70 + 0.26 * max(dot(nv, L), 0.0) + 0.08 * max(nv.z, 0.0);
  vec3 c = a_col * luz;
  if (u_metal > 0.5) {
    // shape mods (noche 16): un solo color; la forma se ve por el contraste entre caras (luz principal,
    // luz de relleno desde abajo a la izquierda y un brillo especular), no por los colores
    float dif2 = max(dot(nv, normalize(vec3(-0.7, -0.35, 0.45))), 0.0);
    luz = 0.26 + 0.66 * max(dot(nv, L), 0.0) + 0.2 * dif2 + 0.1 * max(nv.z, 0.0);
    float esp = pow(max(dot(nv, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 24.0) * step(0.2, a_col.g);
    c = min(a_col * luz + vec3(0.5 * esp), vec3(1.0));
  }
  v_alfa = 1.0;
  if (u_hayRes > 0.5) {
    if (a_res < 0.5) {
      if (u_modo < 0.5) { c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), 0.7) * 0.45; }
      else { v_alfa = 0.16; }
    } else { c = min(c * 1.12 + 0.04, 1.0); }
  }
  v_col = c;
}`;
const FS = `
precision mediump float;
varying vec3 v_col; varying float v_alfa; uniform float u_pasada;
void main() {
  // pasada 0: opaco; pasada 1: solo lo transparente
  if (u_pasada < 0.5 && v_alfa < 0.99) discard;
  if (u_pasada > 0.5 && v_alfa > 0.99) discard;
  gl_FragColor = vec4(v_col, v_alfa);
}`;

const FOV = 24 * Math.PI / 180;

/** ¿Hay WebGL? (sin crear nada visible) */
export function hayWebGL(doc = typeof document !== 'undefined' ? document : null) {
  try {
    if (!doc) return false;
    const c = doc.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return true;
  } catch { return false; }
}

// ---------- matrices 3x3 (por filas) ----------
const mul3 = (A, B) => A.map((f) => [0, 1, 2].map((j) => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
const tr3 = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
const mv3 = (A, v) => A.map((f) => f[0] * v[0] + f[1] * v[1] + f[2] * v[2]);
function rot3(eje, ang) {
  const l = Math.hypot(...eje); const [x, y, z] = eje.map((e) => e / l);
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}
/** Rotación que pone `desde` (dirección de la cámara) en +z y `arriba` hacia +y. */
function mirarDesde(desde, arriba) {
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const z = norm(desde);
  const x = norm([arriba[1] * z[2] - arriba[2] * z[1], arriba[2] * z[0] - arriba[0] * z[2], arriba[0] * z[1] - arriba[1] * z[0]]);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [x, y, z];
}
const gl3 = (A) => new Float32Array([A[0][0], A[1][0], A[2][0], A[0][1], A[1][1], A[2][1], A[0][2], A[1][2], A[2][2]]);

export function crearVista3D(contenedor, { paleta, alTocar, documento } = {}) {
  const doc = documento || contenedor.ownerDocument;
  const canvas = doc.createElement('canvas');
  canvas.className = 'lienzo-3d';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Vista 3D del puzzle: arrastra para girarlo');
  let gl;
  try { gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl'); } catch { gl = null; }
  if (!gl) return null;
  const escena = crearEscena3D(paleta);
  const prog = programa(gl);
  if (!prog) return null;
  contenedor.appendChild(canvas);
  const capaEtiquetas = doc.createElement('div');
  capaEtiquetas.className = 'etiquetas-3d';
  capaEtiquetas.setAttribute('aria-hidden', 'true');
  contenedor.appendChild(capaEtiquetas);
  let verEtiquetas = false, etiquetasDe = null;

  const loc = {};
  for (const a of ['a_pos', 'a_nor', 'a_col', 'a_parte', 'a_res']) loc[a] = gl.getAttribLocation(prog, a);
  for (const u of ['u_proy', 'u_vista', 'u_rot1', 'u_rot2', 'u_hayRes', 'u_modo', 'u_pasada', 'u_metal']) loc[u] = gl.getUniformLocation(prog, u);
  const bufs = {};
  for (const k of ['pos', 'nor', 'col', 'parte', 'res']) bufs[k] = gl.createBuffer();
  let nVert = 0, versionSubida = -1;

  let base = mirarDesde([0.62, 0.72, 1], [0, 1, 0]); // orientación de la cámara del puzzle
  let usuario = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];    // giro que añade el usuario arrastrando
  let camaraActual = null;
  let pedido = false, destruida = false, perdido = false;
  let anim = null; // { t0, ms, desde, hasta, resolver, partes }
  const tiemposFrame = [];
  let ultimoFrame = 0;

  function subir() {
    const b = escena.buffers();
    const put = (k, arr, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, bufs[k]); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(loc['a_' + k]); gl.vertexAttribPointer(loc['a_' + k], n, gl.FLOAT, false, 0, 0); };
    put('pos', b.pos, 3); put('nor', b.nor, 3); put('col', b.col, 3); put('parte', b.parte, 1); put('res', b.res, 1);
    nVert = b.n;
    versionSubida = escena.version;
  }
  let coloresSubidos = null;

  function tamano() {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h };
  }

  function dibujar(ahora) {
    pedido = false;
    if (destruida || perdido || !escena.geometria) return;
    if (anim) {
      const f = Math.min(1, (ahora - anim.t0) / anim.ms);
      const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; // suavizado
      escena.giro(anim.partes, anim.desde + (anim.hasta - anim.desde) * e);
      if (ultimoFrame) tiemposFrame.push(ahora - ultimoFrame);
      if (tiemposFrame.length > 600) tiemposFrame.shift();
      ultimoFrame = ahora;
      if (f >= 1) { const r = anim.resolver; anim = null; ultimoFrame = 0; r(); }
      else pedir();
    }
    if (escena.version !== versionSubida || escena.colores !== coloresSubidos) { subir(); coloresSubidos = escena.colores; }
    const { w, h } = tamano();
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(prog);
    // proyección: el puzzle (radio r) cabe con margen
    const r = escena.geometria.radio || 1.8;
    const asp = w / h;
    const dist = (r * 1.08) / Math.sin(FOV / 2) / Math.min(1, asp);
    const f = 1 / Math.tan(FOV / 2), cerca = Math.max(0.01, dist - r * 2), lejos = dist + r * 2;
    const proy = new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (lejos + cerca) / (cerca - lejos), -1, 0, 0, (2 * lejos * cerca) / (cerca - lejos) + 0, 0]);
    // la cámara está en (0, 0, dist): trasladar en la proyección
    proy[14] += -dist * proy[10]; proy[15] = dist; // (proy · T(0,0,−dist)); w = −z_vista = dist − z
    gl.uniformMatrix4fv(loc.u_proy, false, proy);
    const vista = mul3(usuario, base);
    camaraActual = { vista, dist, asp };
    gl.uniformMatrix3fv(loc.u_vista, false, gl3(vista));
    const rots = escena.rotacionesActuales();
    const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    gl.uniformMatrix3fv(loc.u_rot1, false, gl3(rots[0] ? rot3(rots[0].eje, rots[0].angulo) : I));
    gl.uniformMatrix3fv(loc.u_rot2, false, gl3(rots[1] ? rot3(rots[1].eje, rots[1].angulo) : I));
    const res = escena.resaltado;
    gl.uniform1f(loc.u_hayRes, res ? 1 : 0);
    gl.uniform1f(loc.u_metal, escena.geometria.material === 'metal' ? 1 : 0);
    gl.uniform1f(loc.u_modo, res && res.modo === 'transparencia' ? 1 : 0);
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.uniform1f(loc.u_pasada, 0);
    gl.drawArrays(gl.TRIANGLES, 0, nVert);
    pintarEtiquetas(vista, dist, f, asp);
    if (res && res.modo === 'transparencia') {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.uniform1f(loc.u_pasada, 1);
      gl.drawArrays(gl.TRIANGLES, 0, nVert);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
  }
  // Letras sobre el puzzle (p. ej. caras del Megaminx), en HTML encima del lienzo
  function pintarEtiquetas(vista, dist, f, asp) {
    const et = verEtiquetas && escena.geometria.etiquetas;
    if (!et) { if (etiquetasDe) { capaEtiquetas.innerHTML = ''; etiquetasDe = null; } return; }
    if (etiquetasDe !== et) {
      capaEtiquetas.innerHTML = et.map((e) => `<span>${e.texto}</span>`).join('');
      etiquetasDe = et;
    }
    const W = canvas.clientWidth, H = canvas.clientHeight;
    et.forEach((e, i) => {
      const el = capaEtiquetas.children[i];
      const p = mv3(vista, e.pos), n = mv3(vista, e.normal);
      if (n[2] < 0.2) { el.style.display = 'none'; return; }
      const w = dist - p[2];
      el.style.display = '';
      el.style.left = (((f / asp) * p[0]) / w + 1) / 2 * W + 'px';
      el.style.top = (1 - (f * p[1]) / w) / 2 * H + 'px';
      el.style.opacity = String(Math.min(1, (n[2] - 0.2) * 4));
    });
  }
  function pedir() {
    if (pedido || destruida) return;
    pedido = true;
    requestAnimationFrame(dibujar);
  }

  // ---------- arrastrar para girar; tocar para elegir pegatina ----------
  let arrastre = null;
  const punteros = new Map();
  canvas.addEventListener('pointerdown', (ev) => {
    punteros.set(ev.pointerId, ev);
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* */ }
    arrastre = { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, movido: false };
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!arrastre || !punteros.has(ev.pointerId)) return;
    const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y;
    arrastre.x = ev.clientX; arrastre.y = ev.clientY;
    if (Math.hypot(ev.clientX - arrastre.x0, ev.clientY - arrastre.y0) > 5) arrastre.movido = true;
    if (!arrastre.movido) return;
    const k = 3.2 / Math.max(160, canvas.clientWidth);
    usuario = mul3(mul3(rot3([1, 0, 0], dy * k), rot3([0, 1, 0], dx * k)), usuario);
    ev.preventDefault();
    pedir();
  });
  const soltar = (ev) => {
    if (!punteros.has(ev.pointerId)) return;
    punteros.delete(ev.pointerId);
    const a = arrastre; arrastre = null;
    if (a && !a.movido && ev.type === 'pointerup' && alTocar && camaraActual) {
      const k = pegatinaEn(ev.clientX, ev.clientY);
      if (k >= 0) alTocar(escena.geometria.pegatinas[k], k);
    }
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  function pegatinaEn(cx, cy) {
    const rc = canvas.getBoundingClientRect();
    const nx = ((cx - rc.left) / rc.width) * 2 - 1, ny = 1 - ((cy - rc.top) / rc.height) * 2;
    const { vista, dist, asp } = camaraActual;
    const t = Math.tan(FOV / 2);
    const dirV = [nx * t * asp, ny * t, -1];
    const inv = tr3(vista);
    return escena.elegir(mv3(inv, [0, 0, dist]), mv3(inv, dirV));
  }

  canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); perdido = true; if (api.alPerder) api.alPerder(); });
  let observador = null;
  if (typeof ResizeObserver !== 'undefined') { observador = new ResizeObserver(() => pedir()); observador.observe(canvas); }

  const api = {
    canvas,
    escena,
    alPerder: null,
    mostrar(vista) {
      if (anim) api.terminar();
      const cam = vista.geometria.camara;
      if (cam && cam !== api._cam) { base = mirarDesde(cam.desde, cam.arriba); api._cam = cam; }
      escena.mostrar(vista);
      pedir();
    },
    /** Anima un giro (partes de giro3D sobre la geometría mostrada). Devuelve una promesa. */
    animar(partes, { ms = 400, desde = 0, hasta = 1 } = {}) {
      if (anim) api.terminar();
      if (!partes.length || ms <= 0) { escena.giro(partes, hasta); pedir(); return Promise.resolve(); }
      return new Promise((resolver) => {
        escena.giro(partes, desde);
        anim = { t0: performance.now(), ms, desde, hasta, resolver, partes };
        pedir();
      });
    },
    get animando() { return !!anim; },
    terminar() {
      if (!anim) return;
      const a = anim; anim = null; ultimoFrame = 0;
      escena.giro(a.partes, a.hasta);
      pedir();
      a.resolver();
    },
    fijarPaleta(p) { escena.fijarPaleta(p); pedir(); },
    /** Mostrar u ocultar las letras de geometria.etiquetas. */
    etiquetas(si) { if (verEtiquetas !== !!si) { verEtiquetas = !!si; pedir(); } },
    resaltar(indices, modo) { escena.resaltar(indices, modo); pedir(); },
    resaltarPiezas(piezas, modo) { escena.resaltar(piezas ? pegatinasDePiezas(escena.geometria, piezas) : null, modo); pedir(); },
    vistaInicial() { usuario = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; pedir(); },
    pegatinaEn,
    /** FPS durante las animaciones (últimos ~600 fotogramas). */
    estadisticas() {
      if (!tiemposFrame.length) return null;
      const s = tiemposFrame.slice().sort((a, b) => a - b);
      const media = s.reduce((a, b) => a + b, 0) / s.length;
      return { fotogramas: s.length, fps: 1000 / media, fpsP5: 1000 / s[Math.floor(s.length * 0.95)], msMax: s[s.length - 1] };
    },
    reiniciarEstadisticas() { tiemposFrame.length = 0; },
    redibujar: pedir,
    destruir() {
      destruida = true;
      if (anim) api.terminar();
      if (observador) observador.disconnect();
      canvas.remove();
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    },
  };
  return api;
}

function programa(gl) {
  const sh = (tipo, src) => {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  try {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Vista 3D desactivada:', e.message);
    return null;
  }
}
