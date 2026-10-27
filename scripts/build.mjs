// Construye la app en un único HTML autocontenido:
//   dist/index.html    -> documento completo (abrir con doble clic, sin servidor)
//   dist/artifact.html -> el mismo contenido sin <html>/<head>/<body> (para publicarlo como artifact)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = await build({
  entryPoints: [path.join(raiz, 'src/app/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  write: false,
  legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(raiz, 'src/app/estilos.css'), 'utf8');
const plantilla = fs.readFileSync(path.join(raiz, 'src/app/plantilla.html'), 'utf8');
const cuerpo = plantilla.replace('/*ESTILOS*/', () => css).replace('/*SCRIPT*/', () => js);

fs.mkdirSync(path.join(raiz, 'dist'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dist/artifact.html'), cuerpo);
const corte = cuerpo.indexOf('<div class="app">');
const completo = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${cuerpo.slice(0, corte)}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
</head>
<body>
${cuerpo.slice(corte)}
</body>
</html>
`;
fs.writeFileSync(path.join(raiz, 'dist/index.html'), completo);
console.log(`dist/index.html: ${(completo.length / 1024).toFixed(1)} KB`);
