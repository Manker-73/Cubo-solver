// Resolver muchos casos a la vez con worker_threads (para que `npm test` tarde menos).
//
// Cada hilo importa el puzzle, genera sus tablas una vez y resuelve los casos que
// se le van dando (cola dinámica: el primero que acaba coge el siguiente). Los
// scrambles se generan y las soluciones se comprueban en el hilo principal, así
// que los resultados son los mismos que en serie (salvo los tiempos).
//
// Hilos: HILOS=n en el entorno; por defecto, los núcleos disponibles (máximo 16).
import { Worker } from 'node:worker_threads';
import os from 'node:os';

export const HILOS = Math.max(1, Math.min(16, parseInt(process.env.HILOS || '0', 10) || os.availableParallelism()));
const TRABAJADOR = new URL('./trabajador.mjs', import.meta.url);

/**
 * modulo: URL (string) del módulo; exportar: nombre del export (fábrica o puzzle) o 'default';
 * args: argumentos de la fábrica (si es una función); estados: lista de estados;
 * opciones: opciones de resolver; estadisticas: { modulo, exportar } de un objeto de
 * contadores que se suma entre hilos (opcional).
 * Devuelve { resultados: [{ r, ms }], estadisticas, msTablas }.
 */
export async function resolverEnParalelo({ modulo, exportar = 'default', args = [], estados, opciones = {}, estadisticas = null, hilos = HILOS }) {
  const n = Math.max(1, Math.min(hilos, estados.length));
  const resultados = new Array(estados.length);
  let siguiente = 0;
  const sumaEst = {};
  let msTablas = 0;
  await Promise.all(Array.from({ length: n }, () => new Promise((resolve, reject) => {
    const w = new Worker(TRABAJADOR, { workerData: { modulo, exportar, args, estadisticas } });
    const dar = () => {
      if (siguiente >= estados.length) { w.postMessage({ fin: true }); return; }
      const i = siguiente++;
      w.postMessage({ i, estado: estados[i], opciones });
    };
    w.on('message', (m) => {
      if (m.listo) { msTablas = Math.max(msTablas, m.msTablas || 0); dar(); return; }
      if (m.fin) {
        for (const [k, v] of Object.entries(m.estadisticas || {})) if (typeof v === 'number') sumaEst[k] = (sumaEst[k] || 0) + v;
        w.terminate().then(() => resolve());
        return;
      }
      if (m.error) { reject(new Error(`caso ${m.i}: ${m.error}`)); w.terminate(); return; }
      resultados[m.i] = { r: m.r, ms: m.ms };
      dar();
    });
    w.on('error', reject);
  })));
  return { resultados, estadisticas: sumaEst, msTablas, hilos: n };
}
