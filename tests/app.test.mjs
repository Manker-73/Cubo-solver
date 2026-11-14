// Prueba de humo de la interfaz construida (dist/index.html) con jsdom.
//  1. Sin Worker (jsdom no tiene): todo en el hilo principal.
//  2. Editor del Square-1: mover piezas hasta una forma muy restringida, girar, resolver y reproducir.
//  3. Con un Worker de verdad: el código empaquetado del Worker se ejecuta en worker_threads.
//  4. Worker que falla al arrancar o durante el uso: la app pasa al hilo principal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Worker as NodeWorker } from 'node:worker_threads';
import { CENTROS as CENTROS_MEGA } from '../src/puzzles/megaminx-piezas.js';
import { PALETA_MEGA } from '../src/puzzles/megaminx-geo.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let html = null;
function construir() {
  if (!html) {
    execFileSync(process.execPath, [path.join(raiz, 'scripts/build.mjs')], { stdio: 'ignore' });
    html = fs.readFileSync(path.join(raiz, 'dist/index.html'), 'utf8');
  }
  return html;
}

async function abrir(t, { beforeParse } = {}) {
  let JSDOM;
  try { ({ JSDOM } = await import('jsdom')); } catch { t.skip('jsdom no instalado'); return null; }
  const errores = [];
  const dom = new JSDOM(construir(), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/', beforeParse });
  const w = dom.window;
  w.addEventListener('error', (e) => errores.push(e.message));
  const doc = w.document;
  const hasta = async (cond, ms = 30000) => {
    const t0 = Date.now();
    while (!cond()) { if (Date.now() - t0 > ms) throw new Error('tiempo agotado'); await espera(40); }
  };
  await hasta(() => doc.getElementById('scramble').textContent.length > 0);
  return { w, doc, hasta, errores };
}

async function elegirPuzzle(ctx, nombre) {
  const { doc, hasta } = ctx;
  const chip = () => [...doc.querySelectorAll('#selector .chip')].find((c) => c.textContent === nombre);
  chip().click();
  await hasta(() => chip().getAttribute('aria-pressed') === 'true' && doc.querySelector('#vista-scramble svg') && !doc.getElementById('nuevo').disabled);
  await espera(60);
}

async function resolverYReproducir(ctx, nombre) {
  const { doc, hasta } = ctx;
  doc.getElementById('resolver').click();
  await hasta(() => !doc.getElementById('solucion').hidden || doc.querySelector('.mensaje.error'));
  assert.equal(doc.querySelector('.mensaje.error'), null, `${nombre}: ${doc.getElementById('mensajes').textContent}`);
  // reproducir paso a paso hasta el final con "siguiente": cada paso debe dibujarse sin errores
  const n = doc.querySelectorAll('#movs li').length;
  for (let i = 0; i < n; i++) doc.getElementById('r-adelante').click();
  assert.match(doc.getElementById('paso').textContent, /Resuelto/);
}

test('app: sin Worker, construye, carga y resuelve un scramble en cada puzzle con solver', async (t) => {
  const ctx = await abrir(t);
  if (!ctx) return;
  const { w, doc, hasta, errores } = ctx;
  assert.match(doc.getElementById('modo-calculo').textContent, /hilo principal/);
  const nChips = doc.querySelectorAll('#selector .chip').length;
  assert.ok(nChips >= 8);
  for (let k = 0; k < nChips; k++) {
    const nombre = doc.querySelectorAll('#selector .chip')[k].textContent;
    await elegirPuzzle(ctx, nombre);
    const chip = doc.querySelectorAll('#selector .chip')[k];
    assert.ok(doc.getElementById('scramble').textContent.length > 0, nombre + ': scramble vacío');
    assert.equal(doc.getElementById('nota-scramble').hidden, nombre !== 'Megaminx', nombre + ': indicación bajo la vista previa');
    const conSolver = chip.classList.contains('con-solver');
    assert.equal(doc.getElementById('proximamente').hidden, conSolver, nombre + ': aviso "próximamente"');
    if (nombre === 'Square-1') assert.ok(conSolver, 'el Square-1 ya no está "próximamente"');
    if (!conSolver) continue;
    doc.getElementById('cargar').click();
    doc.getElementById('resolver').click();
    await hasta(() => !doc.getElementById('solucion').hidden || doc.querySelector('.mensaje.error'));
    assert.equal(doc.querySelector('.mensaje.error'), null, nombre + ': error al resolver');
    doc.getElementById('r-fin').click();
    assert.match(doc.getElementById('paso').textContent, /Resuelto/);
    // pintar una pegatina y comprobar que el validador se queja
    doc.getElementById('resetear').click();
    const peg = doc.querySelector('#vista-editor .pegatina');
    doc.querySelectorAll('#paleta .color')[1].click();
    peg.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    doc.getElementById('resolver').click();
    try { await hasta(() => doc.querySelector('.mensaje.error'), 10000); } catch { assert.fail(`${nombre}: el validador no se queja tras pintar una pegatina (${doc.getElementById('mensajes').textContent})`); }
  }
  assert.deepEqual(errores, []);
  w.close();
});

// Piezas de cada capa leídas del SVG del editor: [{ j, esquina }]
function piezas(doc, capa) {
  const r = new Map();
  for (const el of doc.querySelectorAll('#vista-editor .pegatina')) {
    const i = +el.getAttribute('data-i');
    if (i === 9999 || Math.floor(i / 1000) !== capa) continue;
    const j = Math.floor((i % 1000) / 10), peg = i % 10;
    const x = r.get(j) || { j, esquina: false };
    if (peg === 2) x.esquina = true;
    r.set(j, x);
  }
  return [...r.values()].sort((a, b) => a.j - b.j);
}

test('app: editor del Square-1 (mover piezas hasta la estrella, girar, cargar, resetear, resolver y reproducir)', async (t) => {
  const ctx = await abrir(t);
  if (!ctx) return;
  const { w, doc, hasta, errores } = ctx;
  await elegirPuzzle(ctx, 'Square-1');
  const tocar = (i) => doc.querySelector(`#vista-editor .pegatina[data-i="${i}"]`).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const svgResuelto = doc.getElementById('vista-editor').innerHTML;
  // la herramienta "Mover piezas" está elegida por defecto
  assert.equal(doc.querySelector('#paleta .herramienta').getAttribute('aria-checked'), 'true');
  // Mover esquinas de abajo a arriba hasta que arriba haya 6 esquinas (la "estrella") y abajo 2
  for (let paso = 0; paso < 40; paso++) {
    const arriba = piezas(doc, 0), abajo = piezas(doc, 1);
    const nEsqArriba = arriba.filter((x) => x.esquina).length;
    if (nEsqArriba === 6) break;
    // una arista de arriba que tenga otra arista detrás, o si no cualquier arista
    const n = arriba.length;
    let a = arriba.find((x, k) => !x.esquina && !arriba[(k + 1) % n].esquina) || arriba.find((x) => !x.esquina);
    const b = abajo.find((x) => x.esquina);
    tocar(1000 + b.j * 10);
    assert.ok(doc.querySelector('#vista-editor .pegatina.sel'), 'la primera pieza tocada se marca');
    tocar(a.j * 10);
    assert.equal(doc.querySelector('.mensaje.error'), null, doc.getElementById('mensajes').textContent);
  }
  assert.equal(piezas(doc, 0).filter((x) => x.esquina).length, 6, 'arriba: estrella (6 esquinas, 0 aristas)');
  assert.equal(piezas(doc, 0).length, 6);
  assert.equal(piezas(doc, 1).filter((x) => x.esquina).length, 2, 'abajo: 2 esquinas y 8 aristas');
  // girar la estrella una casilla: con 6 esquinas solo hay dos alineaciones con "/" posible
  doc.querySelector('#acciones-editor [data-accion="a+"]').click();
  doc.querySelector('#acciones-editor [data-accion="b-"]').click();
  doc.querySelector('#acciones-editor [data-accion="medio"]').click();
  assert.match(doc.getElementById('vista-editor').textContent, /volteada/);
  await resolverYReproducir(ctx, 'Square-1 (estrella)');
  assert.equal(doc.getElementById('vista-editor').innerHTML.replace(/ sel/g, ''), svgResuelto, 'al final de la reproducción el puzzle está resuelto');
  // tocar la barra del medio con la herramienta la voltea
  doc.getElementById('resetear').click();
  tocar(9999);
  assert.match(doc.getElementById('vista-editor').textContent, /volteada/);
  // un estado imposible: pintar una pegatina
  doc.getElementById('resetear').click();
  doc.querySelectorAll('#paleta .color')[2].click();
  tocar(1);
  doc.getElementById('resolver').click();
  await hasta(() => doc.querySelector('.mensaje.error'));
  assert.match(doc.getElementById('mensajes').textContent, /pegatinas de color/);
  // cargar el scramble actual y resolverlo
  doc.getElementById('cargar').click();
  await resolverYReproducir(ctx, 'Square-1 (scramble)');
  assert.deepEqual(errores, []);
  w.close();
});

test('app: cubos grandes (4x4 y 5x5): vistas, rellenar cara, fases y reproducción', async (t) => {
  const ctx = await abrir(t);
  if (!ctx) return;
  const { w, doc, hasta, errores } = ctx;
  for (const nombre of ['4x4', '5x5']) {
    const N = +nombre[0];
    await elegirPuzzle(ctx, nombre);
    assert.equal(doc.getElementById('proximamente').hidden, true, `${nombre}: ya no está "próximamente"`);
    assert.equal(doc.querySelectorAll('#vista-editor .pegatina').length, 6 * N * N);
    // vista de una cara ampliada: solo se dibujan las N² pegatinas de esa cara
    doc.querySelector('#vistas-editor [data-vista="F"]').click();
    assert.equal(doc.querySelectorAll('#vista-editor .pegatina').length, N * N);
    assert.equal(doc.querySelector('#vistas-editor [data-vista="F"]').getAttribute('aria-pressed'), 'true');
    // rellenar la cara F de rojo con la herramienta: el validador se queja del número de pegatinas
    doc.querySelectorAll('#paleta .color')[1].click();
    doc.querySelector('#paleta [data-herramienta="rellenar"]').click();
    doc.querySelector('#vista-editor .pegatina').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const rojas = [...doc.querySelectorAll('#vista-editor .pegatina')].filter((x) => x.getAttribute('fill') === '#d62828').length;
    assert.equal(rojas, N * N, 'la cara entera queda roja');
    doc.getElementById('resolver').click();
    await hasta(() => doc.querySelector('.mensaje.error'));
    assert.match(doc.getElementById('mensajes').textContent, /debería haber/);
    // volver a verde con la misma herramienta: vuelve a ser el resuelto
    doc.querySelectorAll('#paleta .color')[2].click();
    doc.querySelector('#paleta [data-herramienta="rellenar"]').click();
    doc.querySelector('#vista-editor .pegatina').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    doc.getElementById('resolver').click();
    await hasta(() => doc.querySelector('.mensaje.ok'));
    assert.match(doc.getElementById('mensajes').textContent, /ya está resuelto/);
    // volver a la red, cargar el scramble y resolver
    doc.querySelector('#vistas-editor [data-vista="red"]').click();
    doc.getElementById('cargar').click();
    doc.getElementById('resolver').click();
    await hasta(() => !doc.getElementById('solucion').hidden || doc.querySelector('.mensaje.error'));
    assert.equal(doc.querySelector('.mensaje.error'), null, doc.getElementById('mensajes').textContent);
    // barra de fases: centros, aristas y 3x3 siempre; los botones llevan al final de cada fase
    const fases = [...doc.querySelectorAll('#fases .fase')].map((b) => b.dataset.fase);
    for (const f of ['centros', 'aristas', '3x3']) assert.ok(fases.includes(f), `${nombre}: fase ${f}`);
    const bCentros = doc.querySelector('#fases [data-fase="centros"]');
    const finCentros = +bCentros.dataset.fin;
    bCentros.click();
    assert.match(doc.getElementById('paso').textContent, new RegExp(`Paso ${finCentros}/`));
    // un paso más: estamos en la fase de aristas (o de paridad)
    doc.getElementById('r-adelante').click();
    assert.match(doc.getElementById('paso').textContent, /· (Aristas|Paridad)/);
    assert.ok(doc.querySelector('#fases .fase.actual'));
    // los movimientos tienen la clase de su fase
    assert.ok(doc.querySelector('#movs li.f-centros') && doc.querySelector('#movs li.f-aristas') && doc.querySelector('#movs li.f-3x3'));
    // velocidad: ×1 → ×2 → ×4 → ×8 → ×1
    for (const v of ['×2', '×4', '×8', '×1']) { doc.getElementById('r-velocidad').click(); assert.equal(doc.getElementById('r-velocidad').textContent, v); }
    // reproducir paso a paso hasta el final
    const n = doc.querySelectorAll('#movs li').length;
    for (let i = 0; i < n; i++) doc.getElementById('r-adelante').click();
    assert.match(doc.getElementById('paso').textContent, /Resuelto/);
    assert.ok([...doc.querySelectorAll('#fases .fase')].every((b) => b.classList.contains('hecha')));
  }
  assert.deepEqual(errores, []);
  w.close();
});

test('app: Megaminx — vistas, rellenar cara, deshacer, leyenda, etapas y reproducción', async (t) => {
  const ctx = await abrir(t);
  if (!ctx) return;
  const { w, doc, hasta, errores } = ctx;
  const tocar = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await elegirPuzzle(ctx, 'Megaminx');
  assert.equal(doc.getElementById('proximamente').hidden, true, 'el Megaminx ya no está "próximamente"');
  // vista previa del scramble: siempre con los centros en su sitio (blanco arriba, verde delante),
  // con la indicación de cómo sujetar el puzzle
  const centrosDe = (sel) => CENTROS_MEGA.map((i) => doc.querySelector(`${sel} polygon[data-i="${i}"]`).getAttribute('fill'));
  const ref = PALETA_MEGA.map((c) => c.hex);
  for (let k = 0; k < 3; k++) {
    assert.deepEqual(centrosDe('#vista-scramble'), ref, 'centros de la vista previa');
    assert.equal(doc.getElementById('nota-scramble').hidden, false);
    assert.match(doc.getElementById('nota-scramble').textContent, /el centro blanco queda en \w+ y el verde oscuro en \w+/);
    doc.getElementById('nuevo').click();
    await hasta(() => !doc.getElementById('nuevo').disabled);
    await espera(60);
  }
  // "Cargar scramble actual" carga ese mismo estado ya reorientado
  doc.getElementById('cargar').click();
  assert.deepEqual(centrosDe('#vista-editor'), ref, 'centros del editor tras cargar');
  assert.equal(doc.querySelector('#vista-editor svg').innerHTML.replace(/ class="pegatina"/g, ''), doc.querySelector('#vista-scramble svg').innerHTML, 'el editor muestra lo mismo que la vista previa');
  doc.getElementById('deshacer').click(); // vuelve al resuelto, sin historial
  assert.equal(doc.querySelectorAll('#vista-editor .pegatina').length, 132);
  // vistas: cada "flor" ampliada tiene 66 pegatinas
  for (const v of ['arriba', 'abajo']) {
    doc.querySelector(`#vistas-editor [data-vista="${v}"]`).click();
    assert.equal(doc.querySelectorAll('#vista-editor .pegatina').length, 66, v);
  }
  doc.querySelector('#vistas-editor [data-vista="red"]').click();
  // la leyenda de la notación: la red con las 12 letras
  const ley = doc.getElementById('leyenda');
  assert.equal(ley.hidden, false);
  assert.equal(ley.querySelectorAll('text').length, 12);
  assert.match(ley.textContent, /R2' = 144° antihorario/);
  // rellenar una cara con otro color: 22 pegatinas de ese color; el validador se queja
  const deshacer = doc.getElementById('deshacer');
  assert.equal(deshacer.disabled, true);
  const color = doc.querySelectorAll('#paleta .color')[2]; // rojo
  color.click();
  doc.querySelector('#paleta [data-herramienta="rellenar"]').click();
  const cuenta = (hex) => [...doc.querySelectorAll('#vista-editor .pegatina')].filter((x) => x.getAttribute('fill') === hex).length;
  tocar(doc.querySelector('#vista-editor .pegatina[data-i="0"]'));
  const rojo = color.style.background;
  const nRojas = [...doc.querySelectorAll('#vista-editor .pegatina')].filter((x) => x.getAttribute('fill') === '#d62828').length;
  assert.equal(nRojas, 22, `rellenar cara (${rojo})`);
  assert.equal(deshacer.disabled, false);
  doc.getElementById('resolver').click();
  await hasta(() => doc.querySelector('.mensaje.error'));
  assert.match(doc.getElementById('mensajes').textContent, /debería haber 11/);
  // deshacer: vuelve al resuelto
  deshacer.click();
  assert.equal(cuenta('#d62828'), 11);
  assert.equal(deshacer.disabled, true);
  doc.getElementById('resolver').click();
  await hasta(() => doc.querySelector('.mensaje.ok'));
  assert.match(doc.getElementById('mensajes').textContent, /ya está resuelto/);
  // cargar el scramble y resolver
  doc.getElementById('cargar').click();
  assert.equal(deshacer.disabled, false, 'cargar también se puede deshacer');
  doc.getElementById('resolver').click();
  await hasta(() => !doc.getElementById('solucion').hidden || doc.querySelector('.mensaje.error'), 60000);
  assert.equal(doc.querySelector('.mensaje.error'), null, doc.getElementById('mensajes').textContent);
  assert.match(doc.getElementById('sol-resumen').textContent, /giros de cara/);
  // etapas: Base 1..4, Anillo 1..3, F2L 1..3, Última capa (alguna puede quedar vacía al simplificar)
  const fases = [...doc.querySelectorAll('#fases .fase')].map((b) => b.dataset.fase);
  assert.ok(fases.length >= 9, fases.join(', '));
  assert.equal(fases[fases.length - 1], 'Última capa');
  for (const g of ['base', 'anillo', 'f2l', 'ultima']) assert.ok(doc.querySelector(`#fases .fase.f-${g}`), g);
  // durante la reproducción, el editor muestra la letra de cada cara en su centro
  assert.equal(doc.querySelectorAll('#vista-editor text').length, 12);
  const bAnillo = doc.querySelector('#fases [data-fase="Anillo 2"]');
  bAnillo.click();
  doc.getElementById('r-adelante').click();
  assert.match(doc.getElementById('paso').textContent, /· (Anillo 3|F2L 1|F2L 2)/);
  // solo giros de cara en la lista
  for (const li of doc.querySelectorAll('#movs li')) assert.match(li.textContent, /^(U|F|R|BR|BL|L|D|DR|DBR|B|DBL|DL)(2'|2|')?$/);
  const n = doc.querySelectorAll('#movs li').length;
  for (let i = 0; i < n; i++) doc.getElementById('r-adelante').click();
  assert.match(doc.getElementById('paso').textContent, /Resuelto/);
  // pintar sobre el estado mostrado y deshacer: vuelve a ese estado
  doc.querySelectorAll('#paleta .color')[0].click(); // blanco (con la herramienta de pintar)
  const k = [...doc.querySelectorAll('#vista-editor .pegatina')].findIndex((x) => x.getAttribute('fill') !== '#f4f4f4');
  const antes = doc.querySelectorAll('#vista-editor .pegatina')[k].getAttribute('fill');
  tocar(doc.querySelectorAll('#vista-editor .pegatina')[k]);
  assert.equal(doc.querySelectorAll('#vista-editor .pegatina')[k].getAttribute('fill'), '#f4f4f4');
  assert.equal(doc.getElementById('solucion').hidden, true, 'al editar se quita la solución');
  deshacer.click();
  assert.equal(doc.querySelectorAll('#vista-editor .pegatina')[k].getAttribute('fill'), antes);
  assert.deepEqual(errores, []);
  w.close();
});

/** Worker simulado con worker_threads que ejecuta el código empaquetado real. */
function instalarWorker(window, registro) {
  const blobs = new Map();
  let n = 0;
  window.Blob = class { constructor(partes) { this.texto = partes.join(''); } };
  window.URL.createObjectURL = (b) => { const u = `blob:prueba/${++n}`; blobs.set(u, b.texto); return u; };
  window.Worker = class {
    constructor(url) {
      const codigo = blobs.get(url);
      const shim = `const { parentPort } = require('node:worker_threads');
        globalThis.self = globalThis;
        self.postMessage = (m) => parentPort.postMessage(m);
        parentPort.on('message', (m) => self.onmessage && self.onmessage({ data: m }));\n`;
      this.w = new NodeWorker(shim + codigo, { eval: true });
      this.w.on('message', (m) => { registro.respuestas++; if (this.onmessage) this.onmessage({ data: m }); });
      this.w.on('error', (e) => this.onerror && this.onerror({ message: e.message }));
      registro.workers.push(this);
    }
    postMessage(m) { registro.peticiones.push(m.op); this.w.postMessage(m); }
    terminate() { this.w.terminate(); }
  };
}

test('app: con Web Worker (código empaquetado real en worker_threads)', async (t) => {
  const reg = { workers: [], peticiones: [], respuestas: 0 };
  const ctx = await abrir(t, { beforeParse: (win) => instalarWorker(win, reg) });
  if (!ctx) return;
  const { w, doc, errores } = ctx;
  try {
    assert.match(doc.getElementById('modo-calculo').textContent, /Web Worker/);
    for (const nombre of ['Square-1', '3x3', 'Skewb', '4x4', '5x5', 'Megaminx']) {
      await elegirPuzzle(ctx, nombre);
      assert.match(doc.getElementById('aviso-tablas').textContent, /Web Worker/, nombre);
      doc.getElementById('cargar').click();
      await resolverYReproducir(ctx, nombre);
    }
    for (const op of ['ping', 'inicializar', 'scramble', 'validar', 'resolver']) assert.ok(reg.peticiones.includes(op), op);
    assert.equal(reg.workers.length, 1);
    assert.ok(reg.respuestas >= reg.peticiones.length - 1);
    assert.deepEqual(errores, []);
  } finally {
    reg.workers.forEach((x) => x.terminate());
    w.close();
  }
});

test('app: si el Worker no se puede crear o falla, todo sigue en el hilo principal', async (t) => {
  // a) el constructor lanza (por ejemplo, la página bloquea los workers de blob)
  let ctx = await abrir(t, {
    beforeParse: (win) => {
      win.Blob = class { constructor(p) { this.t = p.join(''); } };
      win.URL.createObjectURL = () => 'blob:x';
      win.Worker = class { constructor() { throw new Error('bloqueado'); } };
    },
  });
  if (!ctx) return;
  assert.match(ctx.doc.getElementById('modo-calculo').textContent, /hilo principal/);
  await elegirPuzzle(ctx, 'Square-1');
  ctx.doc.getElementById('cargar').click();
  await resolverYReproducir(ctx, 'Square-1 sin Worker');
  assert.deepEqual(ctx.errores, []);
  ctx.w.close();
  // b) el Worker arranca pero falla al recibir el primer mensaje: lo pendiente se rehace en el hilo principal
  ctx = await abrir(t, {
    beforeParse: (win) => {
      win.Blob = class { constructor(p) { this.t = p.join(''); } };
      win.URL.createObjectURL = () => 'blob:x';
      win.Worker = class {
        postMessage() { setTimeout(() => this.onerror && this.onerror({ message: 'fallo', preventDefault() {} }), 10); }
        terminate() {}
      };
    },
  });
  assert.match(ctx.doc.getElementById('modo-calculo').textContent, /hilo principal \(el Worker ha fallado\)/);
  await elegirPuzzle(ctx, 'Pyraminx');
  ctx.doc.getElementById('cargar').click();
  await resolverYReproducir(ctx, 'Pyraminx tras fallar el Worker');
  assert.deepEqual(ctx.errores, []);
  ctx.w.close();
});
