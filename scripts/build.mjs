// Construye la app en un único HTML autocontenido:
//   dist/index.html    -> documento completo (abrir con doble clic, sin servidor)
//   dist/artifact.html -> el mismo contenido sin <html>/<head>/<body> (para publicarlo como artifact)
//   El Web Worker se empaqueta aparte y va incrustado como texto: la app lo crea desde un blob.
import fs from 'node:fs';
import path from 'node:path';
import { construirApp, raiz } from './construir.mjs';

const { app } = await construirApp();
const js = app.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(raiz, 'src/app/estilos.css'), 'utf8');
const plantilla = fs.readFileSync(path.join(raiz, 'src/app/plantilla.html'), 'utf8');
// Fuentes: subconjuntos woff2 incrustados en base64 (sin peticiones de red; ver DECISIONES.md, noche 11).
// SIN_FUENTES=1 construye sin ellas (pilas de fuentes del sistema), para comparar tamaños.
const FUENTES = [
  { familia: 'Inter', fichero: 'inter.woff2', peso: '100 900' },
  { familia: 'Bricolage Grotesque', fichero: 'bricolage-grotesque-800.woff2', peso: '800' },
  { familia: 'JetBrains Mono', fichero: 'jetbrains-mono-500.woff2', peso: '500' },
];
const fuentes = process.env.SIN_FUENTES ? '' : FUENTES.map((f) => {
  const b64 = fs.readFileSync(path.join(raiz, 'src/app/fuentes', f.fichero)).toString('base64');
  return `@font-face{font-family:"${f.familia}";font-style:normal;font-weight:${f.peso};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
}).join('\n');
const cuerpo = plantilla.replace('/*FUENTES*/', () => fuentes).replace('/*ESTILOS*/', () => css).replace('/*SCRIPT*/', () => js);

fs.mkdirSync(path.join(raiz, 'dist'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dist/artifact.html'), cuerpo);
const corte = cuerpo.indexOf('<div class="app"');
const completo = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Scrambles oficiales, validador de estados y soluciones animadas en 3D para tus puzzles (WCA y cubos vendados), con métodos humanos explicados paso a paso.">
<meta name="theme-color" content="#0f1218">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3E%3Crect width='30' height='30' rx='7' fill='%230f1218'/%3E%3Crect x='3' y='3' width='24' height='24' rx='5' fill='none' stroke='%237d97ff' stroke-width='2'/%3E%3Cpath d='M11 3v24M19 3v24M3 11h24M3 19h24' stroke='%237d97ff' stroke-width='2'/%3E%3C/svg%3E">
${cuerpo.slice(0, corte)}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
<script>try{var t=localStorage.getItem('cubo-solver:tema');if(t==='claro')document.documentElement.dataset.theme='light'}catch(e){}</script>
</head>
<body>
${cuerpo.slice(corte)}
</body>
</html>
`;
fs.writeFileSync(path.join(raiz, 'dist/index.html'), completo);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`dist/index.html: ${kb(Buffer.byteLength(completo))} (fuentes: ${kb(Buffer.byteLength(fuentes))}; JS de la app con el Worker: ${kb(Buffer.byteLength(js))}; CSS: ${kb(Buffer.byteLength(css))})`);
