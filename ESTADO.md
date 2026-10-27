# Estado del proyecto (final de la noche 1 — 27/10/2026)

## Qué funciona

| Puzzle | Scramble | Validador | Solver | Editor |
|---|---|---|---|---|
| 2x2 | estado aleatorio | sí | óptimo (IDA*, U R F) | sí |
| 3x3 | estado aleatorio | sí | Kociemba dos fases (~20 mov.) | sí |
| 4x4 – 7x7 | movimientos aleatorios WCA (40/60/80/100) | — | próximamente | próximamente |
| Pyraminx | estado aleatorio + puntas | sí | óptimo (BFS completo) + puntas | sí |
| Skewb | estado aleatorio (uniforme exacto) | sí | óptimo (IDA*) | sí |
| Square-1 | movimientos aleatorios, "/" siempre legal | — | próximamente | próximamente |
| Megaminx | Pochmann (7×11) | — | próximamente | próximamente |

- App web en un único HTML (`dist/index.html`, ~60 KB), sin servidor, adaptada al móvil y con tema claro/oscuro.
- Vista previa del estado mezclado en todos los puzzles (redes desplegadas; Square-1 con vista de arriba y de abajo).
- Editor: paleta, tocar pegatinas, "Resetear", "Cargar scramble actual", "Resolver" y reproducción paso a paso (inicio, anterior, reproducir/pausa, siguiente, final, o tocando un movimiento).
- El puzzle se puede pintar sujetándolo en cualquier orientación (ver DECISIONES.md).
- Las tablas se generan en el navegador; la app indica cuánto han tardado.

## Resultados de los tests (`npm test`: 43 tests, 43 pasan, ~3,5 min)

1000 casos por puzzle. En los solvers, el estado se reorienta al azar antes de resolver (prueba también la detección de orientación).

| Puzzle | Scrambles válidos sin redundancias | Long. media scramble | Resueltos | Long. media solución (máx.) | Tiempo medio solución (máx.) | Tablas |
|---|---|---|---|---|---|---|
| 2x2 | 1000/1000 | 8,72 (4–10) | **100 %** | 8,76 (10) | 1,8 ms (26 ms) | 0,7 s |
| 3x3 | 1000/1000 | 20,72 (17–21) | **100 %** | 19,81 (21) | 101 ms (1,0 s) | 1,5 s |
| Pyraminx | 1000/1000 | 10,53 (7–13) | **100 %** | 10,56 (13) | 0,05 ms (2 ms) | 0,5 s |
| Skewb | 1000/1000 | 8,44 (7–10) | **100 %** | 8,42 (10) | 0,17 ms (2 ms) | 0,2 s |
| 4x4 / 5x5 / 6x6 / 7x7 | 1000/1000 cada uno | 40 / 60 / 80 / 100 | — | — | — | — |
| Megaminx | 1000/1000 (formato Pochmann comprobado) | 77 | — | — | — | — |
| Square-1 | 1000/1000 ("/" legales, métrica 40) | 15,2 barras | — | — | — | — |

Otras comprobaciones:
- Las tablas de cubies de Kociemba coinciden con el modelo de pegatinas en los 18 movimientos.
- Pyraminx: el espacio sin puntas tiene 933.120 estados y número de Dios 11. Skewb: 3.149.280 estados y número de Dios 11 (BFS completo).
- Estados imposibles rechazados, con su mensaje: arista volteada, dos aristas/esquinas intercambiadas, esquina girada (una y dos), pieza especular, pieza inexistente (colores opuestos o repetidos), centros mal colocados (3x3), puntas cambiadas de vértice (Pyraminx), centros intercambiados (Skewb), número de colores incorrecto. También se comprueba que estados legales que parecen raros (dos esquinas intercambiadas en el 2x2, un centro girado en el Pyraminx) sí se aceptan.
- Prueba de humo de la interfaz construida con jsdom (cambia de puzzle, carga el scramble, resuelve, reproduce hasta el final y comprueba que el validador se queja tras pintar una pegatina).
- Superflip del 3x3: 22 movimientos en ~3 s (estado simétrico: las 6 variantes de búsqueda no ayudan).

## Problemas conocidos
- **No se pudo hacer push a GitHub.** Al principio de la noche el repositorio no era accesible; al final ya se podía leer (`Manker-73/cubo-solver`, con un "Initial commit"), pero la sesión no tiene permiso de escritura: falta instalar la app de GitHub de Claude para esa cuenta (https://github.com/apps/claude/installations/select_target). Todo el trabajo está en commits locales y como copia en el artifact publicado (código, tests, docs y un `git bundle` con el historial completo).
- La generación de tablas del 3x3 (~1,5 s) bloquea la página un momento al elegir el 3x3 por primera vez (se muestra un aviso). Se podría mover a un Web Worker.
- El 3x3 a veces agota el límite de 1 s y devuelve una solución de 21 movimientos.
- Square-1 usa scrambles de movimientos aleatorios (no de estado aleatorio como TNoodle) hasta que haya solver.
- Los colores del Megaminx y la orientación exacta de su red son orientativos (no hay esquema oficial).
- La vista previa no se ha comparado una a una con las imágenes de TNoodle.

## Siguiente paso recomendado (noche 2)
1. Dar acceso de escritura al repositorio y subir el historial (`git bundle` incluido en el artifact o este repositorio local).
2. **Square-1**: modelo de piezas (ya existe `square1.js` con `/` legales), solver en dos fases (BFS sobre las formas de las capas para llegar a forma de cubo, y después permutación) y pasar los scrambles a estado aleatorio. Editor específico (no es de pegatinas fijas).
3. Mover la generación de tablas a un Web Worker.
4. Después: 4x4+ por reducción (centros → aristas → `kociemba.js` + paridades) y Megaminx (el motor geométrico ya da pegatinas y giros).
