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
    for (const nombre of ['Square-1', '3x3', 'Skewb']) {
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
