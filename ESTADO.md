# Estado del proyecto (final de la noche 2 — 28/10/2026)

## Qué funciona

| Puzzle | Scramble | Validador | Solver | Editor |
|---|---|---|---|---|
| 2x2 | estado aleatorio | sí | óptimo (IDA*, U R F) | sí |
| 3x3 | estado aleatorio | sí | Kociemba dos fases (~20 mov.) | sí |
| 4x4 – 7x7 | movimientos aleatorios WCA (40/60/80/100) | — | próximamente | próximamente |
| Pyraminx | estado aleatorio + puntas | sí | óptimo (BFS completo) + puntas | sí |
| Skewb | estado aleatorio (uniforme exacto) | sí | óptimo (IDA*) | sí |
| **Square-1** | **estado aleatorio (uniforme, ≥ 11 mov.)** | **sí** | **dos fases (~11,4 barras)** | **sí** |
| Megaminx | Pochmann (7×11) | — | próximamente | próximamente |

- **Square-1 completo** (nuevo): modelo corregido según la Regulación 12c1, validador con mensajes claros, solver en dos fases que solo genera movimientos posibles, scramble de estado aleatorio según 4b3d y editor pensado para el móvil (mover piezas con dos toques, pintar, girar capas, capa del medio). La reproducción paso a paso se ve en la vista del editor.
- **Web Worker** (nuevo): todas las tablas, los scrambles de estado aleatorio, la validación y las búsquedas se hacen en un Worker creado desde un blob (la app sigue siendo un único HTML sin servidor, ~160 KB). Mientras se generan las tablas se ve "Generando… X s" y al final el tiempo y dónde se calcularon. Si el Worker no existe, no arranca en 4 s o falla, todo sigue en el hilo principal.
- `npm run bench` funciona (benchmark de todos los solvers).
- Comprobado en Chromium real (escritorio 1280 px y móvil 390 px, tema claro y oscuro): sin errores, sin scroll horizontal, con el Worker activo.

## Resultados de los tests (`npm test`: 56 tests, 56 pasan, ~13 min)

1000 casos por puzzle.

| Puzzle | Scrambles válidos sin redundancias | Long. media scramble | Resueltos | Long. media solución (máx.) | Tiempo medio solución (máx.) | Tablas |
|---|---|---|---|---|---|---|
| 2x2 | 1000/1000 | 8,72 (4–10) | **100 %** | 8,76 (10) | 1,0 ms (13 ms) | 0,4 s |
| 3x3 | 1000/1000 | 20,72 (17–21) | **100 %** | 19,80 (21) | 64 ms (1,0 s) | 0,8 s |
| Pyraminx | 1000/1000 | 10,53 (7–13) | **100 %** | 10,56 (13) | 0,02 ms (0,7 ms) | 0,3 s |
| Skewb | 1000/1000 | 8,44 (7–10) | **100 %** | 8,42 (10) | 0,16 ms (4 ms) | 0,1 s |
| **Square-1** | 1000/1000 | 11,68 barras · 24,18 WCA · 32,48 giros | **100 %** | 11,38 barras (15) · 23,67 WCA (31) · 32,01 giros (45) | 207 ms (456 ms) | 0,9 s (+0,2 s el conjunto para la longitud mínima) |
| 4x4 / 5x5 / 6x6 / 7x7 | 1000/1000 cada uno | 40 / 60 / 80 / 100 | — | — | — | — |
| Megaminx | 1000/1000 (formato Pochmann) | 77 | — | — | — | — |

Métricas del Square-1: **barras**; **WCA** = Regulación 12c4 (cada `(x,y)` y cada "/" cuentan 1); **giros** = cada capa girada y cada "/" cuentan 1. El solver busca la primera solución (~7 ms) y luego la mejora durante 200 ms; de ahí el tiempo medio.

### Square-1 en detalle
- **Scrambles**: los 1000 estados pasan el validador, todas las barras son legales (el modelo lanza error ante cualquier "/" ilegal), sin redundancias, con x, y en −5..6. Todos permiten "/" sin girar antes y requieren **al menos 11 movimientos** (comprobado de forma exacta en cada uno; el más corto salió de 13).
- **Distribución**: uniforme entre los 3.678 · 2 · 8!² ≈ 1,2·10¹³ estados alcanzables en los que se puede hacer "/" (como exige 4b3d); test de chi cuadrado sobre las formas, la paridad y la capa del medio.
- **Solver**: 1000/1000 resueltos aplicando los movimientos uno a uno con el modelo que lanza error ante cualquier "/" ilegal, y comprobando que el estado final es exactamente el resuelto. En 418 de los casos se empezó desde una alineación en la que el "/" es imposible.
- **Paridad (demostrada)**: no hay ninguna restricción, tampoco con la capa del medio (Schreier–Sims: el grupo en forma de cubo es 8!·8!·2; BFS: las 19.305 formas con las 4 combinaciones de paridad y capa del medio). Detalles en DECISIONES.md.
- **Estados imposibles rechazados**, con su mensaje: pieza inexistente, pieza especular, esquina girada, arista volteada, pieza repetida (y la que falta), capa que no suma 12 casillas, número de colores, pegatina sin pintar y capa del medio no válida. Y aceptados: dos aristas intercambiadas (no hay paridad) y estados en los que no se puede hacer "/" sin girar antes.

### Cómo se han cubierto los giros imposibles
- El modelo (de ids y de colores) **lanza un error** ante un "/" ilegal; no se ha desactivado en ningún test.
- La fase 1 solo genera los `(x,y)` que dejan el "/" legal en la forma actual, y la fase 2 trabaja en las dos alineaciones de la forma de cubo en las que "/" es legal; nunca se calcula una solución "en abstracto".
- **Formas**: hay **29 formas de capa** (sin contar giros: 1 con 6 esquinas, 3 con 5, 10 con 4, 10 con 3 y 5 con 2), **170 combinaciones** arriba/abajo, y **19.305 combinaciones contando los giros** (322 máscaras de capa). El test recorre **las 19.305**: genera directamente (no por scramble) un estado de cada una con piezas al azar y lo resuelve aplicando la solución movimiento a movimiento. **Todas cubiertas**; 15.627 de esos estados empezaban sin "/" posible. Incluye las 216 combinaciones con la estrella (6 esquinas, 0 aristas) y las 216 con una capa de 2 esquinas y 8 aristas.
- La prueba de humo de la interfaz construye con el editor una capa en estrella, la gira a una alineación sin "/" posible, voltea la capa del medio, resuelve y reproduce hasta el final.

### Prueba de humo de la interfaz (`tests/app.test.mjs`, jsdom)
- Sin Worker: cada puzzle con solver carga el scramble, resuelve, reproduce hasta "Resuelto" y el validador se queja tras pintar una pegatina.
- Editor del Square-1 (estrella, giros, capa del medio, estado imposible, cargar scramble, reproducción paso a paso).
- Con Worker: el código empaquetado real del Worker se ejecuta en `worker_threads`; Square-1, 3x3 y Skewb pasan por él (ping, tablas, scramble, validar, resolver).
- Worker que no se puede crear y Worker que falla al primer mensaje: la app pasa al hilo principal y sigue funcionando.

## Problemas conocidos
- Los scrambles de la noche 1 del Square-1 partían de un estado resuelto incorrecto (capa de arriba desplazada una casilla); ya corregido (ver DECISIONES.md).
- El solver del Square-1 no es óptimo: ~11,4 barras de media (los de TNoodle suelen tener 11–13). La primera solución sale en ~7 ms, pero en algún caso raro tarda más (máximo medido 1,3 s, en una de las 19.305 formas).
- La primera vez que se elige el Square-1 se tarda ~1 s en generar las tablas (en el Worker, la página no se bloquea). En el hilo principal (sin Worker) ese segundo sí bloquea.
- El editor del Square-1 supone la orientación de referencia (blanco arriba, azul delante, corte según 12c1); no reorienta colores como el de los cubos.
- La suite completa tarda ~13 min (el Square-1 recorre las 19.305 formas y 2000 scrambles); `npm run test:rapido` tarda ~2 min.
- Los colores del Megaminx y la orientación de su red siguen siendo orientativos.

## Siguiente paso recomendado (noche 3: 4x4+ por reducción)
1. Modelo de piezas del 4x4 (centros, aristas dobles, esquinas) sobre el modelo de pegatinas NxN que ya existe; validador (paridad de centros/aristas propias del 4x4; usar `src/core/grupo.js` para demostrar qué restricciones hay, como en el Square-1).
2. Solver por reducción: centros → emparejar aristas → fase 3x3 con `kociemba.js`, resolviendo las paridades OLL/PLL. Las tablas irán al Worker sin tocar nada (basta con `inicializar()`).
3. El editor de pegatinas actual vale para NxN; quizá añadir con `accionesEditor` un "rellenar cara".
4. Después, 5x5–7x7 y el Megaminx (el motor geométrico ya da pegatinas y giros).
