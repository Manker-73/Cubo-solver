// Tablas del informe desde investigacion/resultados/*.json: node investigacion/tabla.mjs
import fs from 'node:fs';
const R = new URL('./resultados/', import.meta.url);
const VAR = ['base', 'a', 'b', 'c', 'abc', 'abce', 'd', 'abc-brotli'];
const s = (ms) => (ms == null ? '—' : (ms / 1000).toFixed(2).replace('.', ','));
const leer = (f) => { try { return JSON.parse(fs.readFileSync(new URL(f, R), 'utf8')); } catch { return null; } };
console.log('| Variante | KB descargados | Fast 3G ×4 fría: FCP / portada | con caché | Fast 3G ×1 fría | Slow 3G ×4 fría | Slow 3G ×1 fría | 3x3 listo (Fast 3G ×4) |');
console.log('|---|---|---|---|---|---|---|---|');
for (const v of VAR) {
  const d = leer(`carga-${v}.json`); if (!d) continue;
  const c = (k) => d.condiciones[k].medianas;
  console.log(`| ${v} | ${c('fast3g-x4').fria.kb.toFixed(0)} | ${s(c('fast3g-x4').fria.fcp)} / **${s(c('fast3g-x4').fria.usable)}** | ${s(c('fast3g-x4').cache.usable)} | ${s(c('fast3g-x1').fria.usable)} | ${s(c('slow3g-x4').fria.usable)} | ${s(c('slow3g-x1').fria.usable)} | ${s(c('fast3g-x4').wca3x3.listo3x3)} |`);
}
console.log('\nTrazas (mediana de 5 cargas frías sin red simulada; ms en el hilo principal / en el Worker):');
console.log('| Variante | CPU | compilar (+ perezoso) | ejecutar | maquetar | evaluar total | Worker: evaluar |');
console.log('|---|---|---|---|---|---|---|');
for (const v of VAR) {
  const d = leer(`traza-${v}.json`) || leer(`carga-${v}.json`); if (!d || !d.traza) continue;
  for (const cpu of ['cpu1', 'cpu4']) {
    const t = d.traza[cpu]; const g = (k) => Math.round(t[k] || 0);
    console.log(`| ${v} | ${cpu.slice(3)}× | ${g('principal: compilar')} + ${g('principal: compilar (perezoso)')} | ${g('principal: ejecutar')} | ${g('principal: maquetar')} | ${g('principal: evaluar (total)')} | ${g('worker: evaluar (total)')} |`);
  }
}
