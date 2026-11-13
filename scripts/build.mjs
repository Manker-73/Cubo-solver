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
const cuerpo = plantilla.replace('/*ESTILOS*/', () => css).replace('/*SCRIPT*/', () => js);

fs.mkdirSync(path.join(raiz, 'dist'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dist/artifact.html'), cuerpo);
const corte = cuerpo.indexOf('<div class="app">');
const completo = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 3'%3E%3Cpath fill='%23d62828' d='M0 0h1v1H0z'/%3E%3Cpath fill='%23ffd60a' d='M1 0h1v1H1z'/%3E%3Cpath fill='%232a9d4b' d='M2 0h1v1H2z'/%3E%3Cpath fill='%231d5ad8' d='M0 1h1v1H0z'/%3E%3Cpath fill='%23f4f4f4' d='M1 1h1v1H1z'/%3E%3Cpath fill='%23f77f00' d='M2 1h1v1H2z'/%3E%3Cpath fill='%23ffd60a' d='M0 2h1v1H0z'/%3E%3Cpath fill='%23d62828' d='M1 2h1v1H1z'/%3E%3Cpath fill='%232a9d4b' d='M2 2h1v1H2z'/%3E%3C/svg%3E">
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
