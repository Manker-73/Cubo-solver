// Benchmark de todos los puzzles con solucionador: tiempo de tablas, de
// scramble y de solución, y longitud de las soluciones.
//   npm run bench            (50 casos por puzzle)
//   N=200 npm run bench      (más casos)
//   PUZZLE=square1 npm run bench
import { PUZZLES } from '../src/puzzles/index.js';
import { rngConSemilla } from '../src/core/rng.js';

const N = parseInt(process.env.N || '50', 10);
const solo = process.env.PUZZLE;
const filas = [];
const fmt = (x, d = 1) => x.toFixed(d).replace('.', ',');

for (const p of PUZZLES) {
  if (!p.capacidades.resolver || (solo && p.id !== solo)) continue;
  const rng = rngConSemilla(1234);
  const t0 = performance.now();
  const ini = p.inicializar();
  const msTablas = ini && ini.ms ? ini.ms : performance.now() - t0;
  let tScr = 0, tSol = 0, maxSol = 0, suma = 0, max = 0, resueltos = 0;
  const longitud = (movs) => movs.length;
  for (let i = 0; i < N; i++) {
    const a = performance.now();
    const s = p.generarScramble(rng);
    tScr += performance.now() - a;
    const e = p.aplicarSecuencia(p.estadoResuelto(), s);
    const b = performance.now();
    const r = p.resolver(e);
    const dt = performance.now() - b;
    tSol += dt; maxSol = Math.max(maxSol, dt);
    if (r.ok && p.estaResuelto(p.aplicarSecuencia(e, r.movimientos))) resueltos++;
    suma += longitud(r.movimientos); max = Math.max(max, longitud(r.movimientos));
  }
  filas.push({
    puzzle: p.nombre,
    tablas: `${Math.round(msTablas)} ms`,
    scramble: `${fmt(tScr / N)} ms`,
    solucion: `${fmt(tSol / N)} ms (máx ${fmt(maxSol, 0)})`,
    longitud: `${fmt(suma / N, 2)} (máx ${max})`,
    resueltos: `${resueltos}/${N}`,
  });
  console.log(`${p.nombre}: listo`);
}

console.log(`\nBenchmark (${N} casos por puzzle; longitud en la métrica de cada puzzle: movimientos WCA)\n`);
console.table(filas);
