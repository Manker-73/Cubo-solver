// Lanza la suite de tests por niveles (ver README.md, "Tests"):
//
//   node scripts/tests.mjs humo                 # < 2 min: humo de los puzzles, registro y humo de la app
//   node scripts/tests.mjs rapido               # todo, con menos casos en los tests caros
//   node scripts/tests.mjs completo             # igual que npm test
//   node scripts/tests.mjs solo skewb aprender  # solo lo de esas áreas (nivel rápido)
//
// Siempre un fichero a la vez (--test-concurrency=1): los tests largos ya reparten los casos
// entre worker_threads y varios solvers tienen límite de tiempo (ver DECISIONES.md).
// Variables que se respetan si vienen de fuera: CASOS, NIVEL, HILOS, CASOS_NXN, CASOS_MEGA,
// CASOS_BLOQUEOS, CASOS_APRENDER, TAMANOS, BLOQUEOS.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirTests = path.join(raiz, 'tests');
const todos = fs.readdirSync(dirTests).filter((f) => f.endsWith('.test.mjs')).sort();
const f = (nombre) => `tests/${nombre}.test.mjs`;

// Áreas de test:solo. ficheros: se ejecutan enteros; patron: nombres de tests de los
// ficheros compartidos (humo, aprender, vista 3D, registro) que también son de esa área.
const AREAS = {
  '2x2': { ficheros: ['cubo2'], patron: '2x2' },
  '3x3': { ficheros: ['cubo3', 'oll-numeros'], patron: '3x3' },
  nxn: { ficheros: ['cubo-grande', 'nxn', 'nxn-grupo'], patron: 'NxN|[4-7]x[4-7]' },
  pyraminx: { ficheros: ['pyraminx'], patron: 'Pyraminx' },
  skewb: { ficheros: ['skewb'], patron: 'Skewb' },
  square1: { ficheros: ['square1'], patron: 'Square-1' },
  megaminx: { ficheros: ['megaminx', 'megaminx-pochmann'], patron: 'Megaminx' },
  vendado: { ficheros: ['bloqueos'], patron: 'vendado|bloqueos' },
  aprender: { ficheros: ['aprender', 'oll-numeros'], patron: 'aprender' },
  '3d': { ficheros: ['vista3d'], patron: '3D' },
  app: { ficheros: ['app', 'diseno'], patron: null },
  diseno: { ficheros: ['diseno'], patron: 'diseño' },
  humo: { ficheros: ['humo'], patron: null },
  registro: { ficheros: ['registro'], patron: 'registro|interfaz' },
};
const ALIAS = { 'diseño': 'diseno', tema: 'diseno', sq1: 'square1', 'square-1': 'square1', bloqueos: 'vendado', mega: 'megaminx', pyra: 'pyraminx', vista3d: 'vista3d', '3D': '3d', interfaz: 'registro' };
for (const N of [4, 5, 6, 7]) AREAS[`${N}x${N}`] = { ficheros: ['cubo-grande', 'nxn'], patron: `NxN|${N}x${N}`, tamano: N };
AREAS.vista3d = AREAS['3d'];
const COMPARTIDOS = ['humo', 'aprender', 'vista3d', 'registro'];

function ejecutar(ficheros, { patrones = [], env = {} } = {}) {
  if (!ficheros.length) return 0;
  const args = ['--test', '--test-concurrency=1', '--test-reporter=spec', ...patrones.map((p) => `--test-name-pattern=${p}`), ...ficheros];
  const r = spawnSync(process.execPath, args, { cwd: raiz, stdio: 'inherit', env: { ...process.env, ...env } });
  return r.status ?? 1;
}

const [nivel = 'rapido', ...resto] = process.argv.slice(2);
const t0 = Date.now();
let estado;
const rapido = { CASOS: process.env.CASOS || '100', NIVEL: process.env.NIVEL || 'rapido' };

if (nivel === 'completo') {
  estado = ejecutar(todos.map((x) => `tests/${x}`), { env: { CASOS: process.env.CASOS || '1000' } });
} else if (nivel === 'rapido') {
  estado = ejecutar(todos.map((x) => `tests/${x}`), { env: rapido });
} else if (nivel === 'humo') {
  estado = ejecutar([f('humo'), f('registro'), f('diseno'), f('app')], {
    env: { NIVEL: 'humo', CASOS: process.env.CASOS || '100' },
    // noche 11: diseño (rutas y contraste), navegación entre secciones, tema, enlaces antiguos y recorrido completo
    patrones: ['^humo:', '^registro:', '^interfaz:', '^diseño:', '^app: sin Worker, construye', '^app: con Web Worker',
      '^app: navegación', '^app: tema', '^app: bloqueos compartidos por URL', '^app: recorrido completo'],
  });
} else if (nivel === 'solo') {
  const areas = resto.map((a) => ALIAS[a] || ALIAS[a.toLowerCase()] || a.toLowerCase());
  const malas = areas.filter((a) => !AREAS[a]);
  if (!areas.length || malas.length) {
    console.error(`${malas.length ? `Área desconocida: ${malas.join(', ')}. ` : ''}Uso: npm run test:solo -- <área> [<área>…]\nÁreas: ${Object.keys(AREAS).join(', ')}`);
    process.exit(2);
  }
  const propios = [...new Set(areas.flatMap((a) => AREAS[a].ficheros))];
  // las huellas de los giros siempre (2 s): son lo único que detecta un giro invertido
  const patrones = [...new Set([...areas.map((a) => AREAS[a].patron).filter(Boolean), '^humo: huellas'])];
  const tamanos = areas.map((a) => AREAS[a].tamano).filter(Boolean);
  // solo un tamaño de NxN pedido (y no "nxn" entero): el fichero de cubos grandes solo con esos
  const env = { ...rapido, ...(tamanos.length && !areas.includes('nxn') && !process.env.TAMANOS ? { TAMANOS: tamanos.join(',') } : {}) };
  console.log(`test:solo ${areas.join(' ')} — ficheros: ${propios.join(', ')}; y en ${COMPARTIDOS.filter((c) => !propios.includes(c)).join(', ')}: /${patrones.join('|') || '(nada)'}/`);
  estado = ejecutar(propios.map(f), { env });
  const compartidos = COMPARTIDOS.filter((c) => !propios.includes(c));
  if (patrones.length) estado = ejecutar(compartidos.map(f), { env, patrones }) || estado;
} else {
  console.error('Uso: node scripts/tests.mjs <humo|rapido|completo|solo> [áreas…]');
  process.exit(2);
}
console.log(`\n${nivel}: ${estado === 0 ? 'todo pasa' : 'HAY FALLOS'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(estado);
