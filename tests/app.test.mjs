// Prueba de humo de la interfaz construida (dist/index.html) con jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

test('app: construye, carga y resuelve un scramble en cada puzzle con solver', async (t) => {
  let JSDOM;
  try { ({ JSDOM } = await import('jsdom')); } catch { t.skip('jsdom no instalado'); return; }
  execFileSync(process.execPath, [path.join(raiz, 'scripts/build.mjs')], { stdio: 'ignore' });
  const html = fs.readFileSync(path.join(raiz, 'dist/index.html'), 'utf8');
  const errores = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
  const w = dom.window;
  w.addEventListener('error', (e) => errores.push(e.message));
  const doc = w.document;
  const hasta = async (cond, ms = 20000) => {
    const t0 = Date.now();
    while (!cond()) { if (Date.now() - t0 > ms) throw new Error('tiempo agotado'); await espera(50); }
  };
  await hasta(() => doc.getElementById('scramble').textContent.length > 0);
  const nChips = doc.querySelectorAll('#selector .chip').length;
  assert.ok(nChips >= 8);
  for (let k = 0; k < nChips; k++) {
    const nombre = doc.querySelectorAll('#selector .chip')[k].textContent;
    doc.querySelectorAll('#selector .chip')[k].click();
    const chipActual = () => doc.querySelectorAll('#selector .chip')[k];
    await hasta(() => chipActual().getAttribute('aria-pressed') === 'true' && doc.querySelector('#vista-scramble svg'));
    const chip = chipActual();
    await espera(100);
    assert.ok(doc.getElementById('scramble').textContent.length > 0, nombre + ': scramble vacío');
    const conSolver = chip.classList.contains('con-solver');
    assert.equal(doc.getElementById('proximamente').hidden, conSolver, nombre + ': aviso "próximamente"');
    if (!conSolver) continue;
    doc.getElementById('cargar').click();
    doc.getElementById('resolver').click();
    await hasta(() => !doc.getElementById('solucion').hidden || doc.querySelector('.mensaje.error'));
    assert.equal(doc.querySelector('.mensaje.error'), null, nombre + ': error al resolver');
    // ir al final: el editor debe mostrar el puzzle resuelto
    doc.getElementById('r-fin').click();
    assert.match(doc.getElementById('paso').textContent, /Resuelto/);
    // pintar una pegatina y comprobar que el validador se queja
    doc.getElementById('resetear').click();
    const peg = doc.querySelector('#vista-editor .pegatina');
    doc.querySelectorAll('#paleta .color')[1].click();
    peg.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    doc.getElementById('resolver').click();
    await hasta(() => doc.querySelector('.mensaje.error'));
  }
  assert.deepEqual(errores, []);
  w.close();
});
