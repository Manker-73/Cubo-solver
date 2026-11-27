// Construye los prototipos de la investigación de carga en investigacion/dist/<variante>/ (no toca dist/ ni src/).
//   node investigacion/prototipos.mjs [variante ...]
// Variantes:
//   base   igual que npm run build (referencia)
//   a      un solo script: el Worker se crea con el mismo código (sin copia del Worker como texto)
//   b      recortes: fuentes con los caracteres del español y, en Inter, solo los pesos 400–600
//   c      registro perezoso: ningún puzzle se construye (ni se ejecuta su módulo) hasta que se usa
//   abc    a + b + c, en un solo HTML (sirve también para el artifact)
//   d      varios ficheros (solo para Pages): index.html + app.js (defer) + estilos.css + fuentes .woff2, con a + b + c;
//          el Worker hace importScripts(app.js) (lo toma de la caché HTTP)
//   abce   abc + e2: la portada no crea un contexto WebGL para saber si hay 3D ni fuerza una maquetación
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { raiz } from '../scripts/construir.mjs';

const dirInv = path.join(raiz, 'investigacion');
const opciones = { bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none', tsconfigRaw: '{}' };
const kb = (n) => (n / 1024).toFixed(1);
const gz = (s) => zlib.gzipSync(Buffer.from(s), { level: 6 }).length;

// metadatos del registro real (lo que la interfaz lee sin usar el puzzle), para el registro perezoso
async function metaPuzzles() {
  const m = await import('../src/puzzles/index.js');
  const meta = (p) => ({ id: p.id, nombre: p.nombre, categoria: p.categoria, costeScramble: p.costeScramble, capacidades: p.capacidades });
  return { puzzles: m.PUZZLES.map(meta), pronto: m.PUZZLES_PRONTO, bandaged: m.BANDAGED.map((b) => ({ url: b.url, id: b.puzzle.id, nombre: b.puzzle.nombre })) };
}

const aliasPerezoso = (meta) => ({
  name: 'registro-perezoso',
  setup(b) {
    b.onResolve({ filter: /puzzles[\\/]index\.js$|^\.\.\/puzzles\/index\.js$|^\.\/index\.js$/ }, (args) => {
      const r = path.resolve(args.resolveDir, args.path);
      if (r === path.join(raiz, 'src/puzzles/index.js')) return { path: path.join(dirInv, 'proto/index-perezoso.js') };
      return undefined;
    });
  },
});

// PROTOTIPO (opción e2): la portada no necesita saber si hay WebGL (crear un contexto cuesta) ni medir el panel del
// resolvedor con una maquetación forzada (el ResizeObserver ya lo mide al observarlo). Cambios en main.js al vuelo.
const ajustesPortada = {
  name: 'ajustes-portada',
  setup(b) {
    b.onLoad({ filter: /src[\\/]app[\\/]main\.js$/ }, (args) => {
      let s = fs.readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n');
      const cambios = [
        ['  st.webgl = hayWebGL(document);', `  {
    const fijar = (v) => Object.defineProperty(st, 'webgl', { value: v, writable: true, enumerable: true, configurable: true });
    Object.defineProperty(st, 'webgl', { configurable: true, enumerable: true, get() { const v = hayWebGL(document); fijar(v); return v; }, set: fijar });
  }`],
        ["  window.addEventListener('resize', mirar);\n  mirar();", "  window.addEventListener('resize', mirar);\n  if (typeof ResizeObserver !== 'function') mirar();"],
      ];
      for (const [a, n] of cambios) { if (!s.includes(a)) throw new Error('ajustes: no encuentro ' + a); s = s.replace(a, n); }
      return { contents: s, loader: 'js' };
    });
  },
};

async function js({ unico, perezoso, meta, ajustes }) {
  const extra = perezoso ? { plugins: [aliasPerezoso(meta)], define: { __META_PUZZLES__: JSON.stringify(meta) } } : { define: {}, plugins: [] };
  if (ajustes) extra.plugins = [...extra.plugins, ajustesPortada];
  if (unico) {
    const r = await build({ entryPoints: [path.join(dirInv, 'proto/entrada-unica.js')], ...opciones, ...extra, define: { ...extra.define, __CODIGO_WORKER__: 'globalThis.__CODIGO_PROPIO__' } });
    return r.outputFiles[0].text;
  }
  const w = (await build({ entryPoints: [path.join(raiz, 'src/app/worker.js')], ...opciones, ...extra })).outputFiles[0].text;
  const r = await build({ entryPoints: [path.join(raiz, 'src/app/main.js')], ...opciones, ...extra, define: { ...extra.define, __CODIGO_WORKER__: JSON.stringify(w) } });
  return r.outputFiles[0].text;
}

const FUENTES = [
  { familia: 'Inter', fichero: 'inter.woff2', peso: '100 900', pesoRecorte: '400 600' },
  { familia: 'Bricolage Grotesque', fichero: 'bricolage-grotesque-800.woff2', peso: '800' },
  { familia: 'JetBrains Mono', fichero: 'jetbrains-mono-500.woff2', peso: '500' },
];
const dirFuentes = (recorte) => (recorte ? path.join(dirInv, 'proto/fuentes') : path.join(raiz, 'src/app/fuentes'));
const caraFuente = (f, recorte, src) => `@font-face{font-family:"${f.familia}";font-style:normal;font-weight:${recorte && f.pesoRecorte ? f.pesoRecorte : f.peso};font-display:swap;src:${src} format("woff2")}`;

function envolver(cuerpo) {
  // lo mismo que scripts/build.mjs para dist/index.html
  const corte = cuerpo.indexOf('<div class="app"');
  const ref = fs.readFileSync(path.join(raiz, 'dist/index.html'), 'utf8');
  const cabeza = ref.slice(0, ref.indexOf('<title>'));
  const trasCuerpo = ref.slice(ref.indexOf('<style>:root{padding-top'), ref.indexOf('</head>'));
  return `${cabeza}${cuerpo.slice(0, corte)}\n${trasCuerpo}</head>\n<body>\n${cuerpo.slice(corte)}\n</body>\n</html>\n`;
}

async function variante(nombre, { unico = false, recorte = false, perezoso = false, ficheros = false, ajustes = false }, meta) {
  const out = path.join(dirInv, 'dist', nombre);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const codigo = (await js({ unico, perezoso, meta, ajustes })).replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync(path.join(raiz, 'src/app/estilos.css'), 'utf8');
  const plantilla = fs.readFileSync(path.join(raiz, 'src/app/plantilla.html'), 'utf8');
  let cuerpo;
  if (!ficheros) {
    const fuentes = FUENTES.map((f) => caraFuente(f, recorte, `url(data:font/woff2;base64,${fs.readFileSync(path.join(dirFuentes(recorte), f.fichero)).toString('base64')})`)).join('\n');
    cuerpo = plantilla.replace('/*FUENTES*/', () => fuentes).replace('/*ESTILOS*/', () => css).replace('/*SCRIPT*/', () => codigo);
    fs.writeFileSync(path.join(out, 'artifact.html'), cuerpo);
  } else {
    fs.mkdirSync(path.join(out, 'fuentes'));
    for (const f of FUENTES) fs.copyFileSync(path.join(dirFuentes(recorte), f.fichero), path.join(out, 'fuentes', f.fichero));
    const fuentes = FUENTES.map((f) => caraFuente(f, recorte, `url(fuentes/${f.fichero})`)).join('\n');
    fs.writeFileSync(path.join(out, 'estilos.css'), fuentes + '\n' + css);
    fs.writeFileSync(path.join(out, 'app.js'), codigo);
    const precargas = FUENTES.slice(0, 2).map((f) => `<link rel="preload" href="fuentes/${f.fichero}" as="font" type="font/woff2" crossorigin>`).join('\n');
    cuerpo = plantilla
      .replace('<style>/*FUENTES*/</style>', () => precargas)
      .replace('<style>/*ESTILOS*/</style>', () => '<link rel="stylesheet" href="estilos.css">\n<script defer src="app.js"></script>')
      .replace('<script>/*SCRIPT*/</script>', () => '');
  }
  const html = envolver(cuerpo);
  fs.writeFileSync(path.join(out, 'index.html'), html);
  const fich = fs.readdirSync(out, { recursive: true }).filter((f) => fs.statSync(path.join(out, f)).isFile() && f !== 'artifact.html');
  let total = 0, totalGz = 0;
  const detalle = fich.map((f) => {
    const b = fs.readFileSync(path.join(out, f));
    const g = /\.woff2$/.test(f) ? b.length : gz(b);
    total += b.length; totalGz += g;
    return `${f} ${kb(b.length)}/${kb(g)}`;
  });
  console.log(`${nombre.padEnd(5)} total ${kb(total)} KB, descargado (gzip) ${kb(totalGz)} KB  [${detalle.join(', ')}]`);
}

const VARIANTES = {
  base: {}, a: { unico: true }, b: { recorte: true }, c: { perezoso: true },
  abc: { unico: true, recorte: true, perezoso: true },
  d: { unico: true, recorte: true, perezoso: true, ficheros: true },
  abce: { unico: true, recorte: true, perezoso: true, ajustes: true },
};
const meta = await metaPuzzles();
const pedidas = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VARIANTES);
for (const v of pedidas) await variante(v, VARIANTES[v], meta);
