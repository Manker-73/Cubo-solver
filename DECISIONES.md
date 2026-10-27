# Decisiones tomadas sin consultar (noche 1)

Decisiones que he tomado yo cuando había dudas, para que puedas revisarlas.

## Repositorio
- **No se pudo acceder a `Manker-73/Cubo-solver`.** GitHub respondió que el repositorio no existe o que la app de Claude no tiene acceso (la sesión solo ve `misiones_web` y `abd-p1-odm`). He trabajado en un repositorio git local con commits frecuentes y, como copia de seguridad, he publicado la app como artifact con todo el código fuente, los tests y los documentos adjuntos como ficheros. Para la noche 2: crear el repositorio (o dar acceso a la app de GitHub de Claude) y subir el historial.

## Arquitectura y herramientas
- Código en módulos ES (`src/`), probado directamente con Node (`node --test`), y empaquetado con **esbuild** en un único HTML autocontenido (`dist/index.html`), que se abre con doble clic sin servidor. esbuild y jsdom son solo dependencias de desarrollo.
- Estado de los puzzles de pegatinas = array de colores por pegatina. Así el editor, el dibujo y los movimientos son comunes; los solvers convierten pegatinas → piezas.
- Pyraminx, Skewb (y en el futuro Megaminx) salen de un **motor geométrico 3D**: caras + planos de corte → pegatinas; un giro = rotar las pegatinas a un lado de un plano. Las permutaciones y la red desplegada se calculan solas, lo que evita errores de transcripción a mano.
- El **modelo de piezas** es genérico: a partir de las permutaciones de pegatinas deduce posiciones/orientaciones de piezas, identifica piezas por sus colores (validador) y genera coordenadas y tablas de poda para IDA*.

## Orientación del puzzle al pintar
- El usuario puede pintar el puzzle sujetándolo en cualquier orientación. En vez de exigir una orientación, se **reetiquetan los colores** con la rotación adecuada (24 en cubos/Skewb, 12 en Pyraminx), y la solución queda en el sistema de referencia del usuario:
  - 3x3: la marcan los centros.
  - 2x2: la esquina DBL (el solver usa solo U, R, F, como los scrambles WCA).
  - Skewb: la esquina URF (la que no mueven R, U, L, B en notación WCA).
  - Pyraminx: las piezas centrales (no cambian de sitio).
- Esquema de color: el estándar WCA (blanco arriba, verde delante; Pyraminx verde/rojo/azul/amarillo).

## Scrambles
- Estado aleatorio: 2x2, 3x3, Pyraminx, Skewb. Longitud mínima (como TNoodle): 2x2 ≥ 4, 3x3 ≥ 2, Pyraminx ≥ 6 sin puntas, Skewb ≥ 7. Las puntas del Pyraminx van al final.
- 2x2 y Pyraminx: el scramble es la inversa de una solución **óptima** del estado aleatorio. 3x3: inversa de la solución de Kociemba con objetivo ≤ 21.
- Skewb: el estado aleatorio es **exactamente uniforme**: se elige una configuración de esquinas al azar entre las 8.748 alcanzables (salen de la tabla BFS) y una permutación par de centros. Un test comprueba que centros y esquinas son independientes (3.149.280 = 360 × 8.748).
- Movimientos aleatorios 4x4–7x7: longitudes 40/60/80/100. Capas anchas hasta ⌊N/2⌋ en las seis caras (`Rw` en 4x4/5x5; `Rw` y `3Rw` en 6x6/7x7).
- Redundancias en NxN: en un tramo de movimientos del mismo eje, como mucho un movimiento por cara, y las dos caras opuestas no pueden cubrir entre las dos las N capas (evita `R L R`, `Rw R`, y `Rw Lw` en 4x4, que es una rotación).

## Solver 3x3
- Dos fases de Kociemba con tablas de poda slice×twist, slice×flip, twist×flip (fase 1) y sliceperm×cornerperm, sliceperm×edgeperm (fase 2), generadas en el navegador (~1,3 s).
- Para encontrar antes soluciones cortas se buscan a la vez **6 variantes** del mismo estado (3 orientaciones por la diagonal URF × normal/inversa), como hace min2phase. Redujo el tiempo medio para ≤ 20 movimientos de ~400 ms a ~90 ms.
- Por defecto busca ≤ 20 movimientos con un límite de 1 s; si se agota el tiempo devuelve la mejor encontrada (normalmente 21).

## Interfaz
- Al pintar se elige un color de la paleta y se toca la pegatina. Los centros del 3x3 también se pueden pintar (se usan para la orientación).
- La reproducción de la solución se hace sobre la vista del editor.
