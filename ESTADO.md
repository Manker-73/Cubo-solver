# Estado del proyecto (final de la noche 6 — 15/11/2026)

## Qué funciona

| Puzzle | Scramble | Validador | Solver | Editor |
|---|---|---|---|---|
| 2x2 | estado aleatorio | sí | óptimo (IDA*, U R F) | sí |
| 3x3 | estado aleatorio | sí | Kociemba dos fases (~20 mov.) | sí |
| **4x4 – 7x7** | movimientos aleatorios WCA (40/60/80/100) | sí | **reducción** (4x4: 3 fases de búsqueda estilo TPR; 5x5–7x7: centros por IDA*, aristas con un voraz de macros que no mueven los centros, resto con conmutadores) → 3x3 | sí (+ rellenar cara, cara ampliada) |
| Pyraminx | estado aleatorio + puntas | sí | óptimo (BFS completo) + puntas | sí |
| Skewb | estado aleatorio (uniforme exacto) | sí | óptimo (IDA*) | sí |
| **Square-1** | **estado aleatorio (uniforme, ≥ 11 mov.)** | **sí** | **dos fases (~11,4 barras)** | **sí** |
| **Megaminx** | Pochmann (7×11) | **sí** | **por etapas con búsqueda (IDA*) + última capa con macros (~90 giros de cara)** | **sí** (+ rellenar cara, vistas U/D, deshacer) |

Ya no queda ningún puzzle sin validador ni solver.

## Noche 6: 5x5, 6x6 y 7x7 más cortos

### Resultado (`npm test`: 100 tests, 100 pasan, 52 min con 2 núcleos)
Mismos casos que en la noche 4 (500 en 4x4 y 5x5, 100 en 6x6 y 7x7, misma semilla, cubo reorientado al azar; cada solución se aplica movimiento a movimiento). Longitudes en OBTM.

| Cubo | Antes (noche 4) | Cociente antes | **Ahora** | **Cociente ahora** | Objetivo | Long. máx. (antes → ahora) |
|---|---|---|---|---|---|---|
| 4x4 | 54,8 | 1,57 | **54,8** | **1,57** | ≤ 2,0 ✅ (sin cambios) | 216 → 216 |
| 5x5 | 159,6 | 3,07 | **109,1** | **2,10** | ≤ 3,0 (≤ 155) ✅ | 257 → 208 |
| 6x6 | 357,6 | 4,77 | **256,2** | **3,42** | ≤ 3,5 (≤ 260) ✅ (justo) | 392 → 291 |
| 7x7 | 436,5 | 4,41 | **355,7** | **3,59** | ≤ 4,0 (≤ 400) ✅ | 556 → 495 |

Por fase (longitud media, antes → ahora):

| Cubo | Centros | Aristas | Paridad | 3x3 |
|---|---|---|---|---|
| 5x5 | 36,5 → 36,4 | **103,7 → 54,3** | 0 → 0,02 | 19,4 → 18,5 |
| 6x6 | 159,6 → 150,6 | **174,2 → 85,0** | 4,4 → 2,2 | 19,4 → 18,5 |
| 7x7 | 228,6 → 219,8 | **188,2 → 117,2** | 0,1 → 0,1 | 19,6 → 18,7 |

Tiempos por solución (media / máximo; en el test, 2 hilos en 2 núcleos):

| Cubo | Antes | Ahora | Tablas (1.ª vez) |
|---|---|---|---|
| 4x4 | 1,1 s / 13,0 s | 1,2 s / 13,3 s | 2,8 s |
| 5x5 | 1,1 s / 5,1 s | 2,2 s / 6,7 s | 3,6 s (2.880 macros) |
| 6x6 | 1,3 s / 3,0 s | 3,5 s / 5,3 s | 4,4 s (6.048) |
| 7x7 | 4,2 s / 11,8 s | 6,6 s / 12,2 s | 8,2 s (8.496) |

El peor caso de todos sigue por debajo de los 13,7 s de antes (13,3 s, un 4x4 que acaba en el método de respaldo). Las tablas nuevas son pocas: las macros de aristas ocupan unos cientos de KB; nada cerca del límite de 100 MB.

### Qué ha cambiado
- **Aristas por búsqueda voraz con macros que no mueven los centros** ("aristas libres"): `S · A M A⁻¹ · S⁻¹` (S una capa ancha o interior; A un giro de una cara de alrededor; M un giro de una cara del eje de S). Se generan solas al inicializar. En cada paso, un giro de cara opcional + una macro, lo que más wings coloca por movimiento, con un paso de anticipación (primero rápido, luego fino para los mejores). Coloca casi todo; lo que queda, con los 3-ciclos de antes. Detalles en DECISIONES.md.
- **6x6 (N par)**: las wings se emparejan entre sí (no con su sitio final) y al acabar se elige qué arista entera va en cada ranura; la paridad PLL se decide con esa asignación. Fue lo que más ayudó en el 6x6 (aristas 172 → 92 con el voraz).
- 3x3 final con objetivo 18 (−1,2), conmutadores dobles un poco más largos en 6x6/7x7 y el voraz de centros mirando más candidatos (−2 en oblicuos), y límite de tiempo (`tiempoMax`, 10 s) que recorta lo opcional si hace falta.
- **No funcionó** (y lo dejé fuera): emparejar las aristas del 5x5 por fases tipo dominó con búsqueda exacta. Las aristas solas salen en ~30 movimientos, pero con los centros resueltos la búsqueda no termina (explicación y cifras en DECISIONES.md).

### Tests más rápidos
- Los tests largos de solver (4x4–7x7, Megaminx) reparten los casos entre **worker_threads** (`tests/paralelo.mjs`); los ficheros van de uno en uno para que los hilos no compitan por los núcleos (los solvers con límite de tiempo darían soluciones distintas).
- `npm test`: 52 min aquí con 2 núcleos (antes, 64 min con el Megaminx y con las soluciones NxN más rápidas que ahora); el solver del Megaminx pasa de 23 a ~11 min. Con más núcleos baja casi en proporción (el resto, Schreier–Sims del 7x7, última capa exhaustiva, la app, es ~12 min). `HILOS=n` fija el número de hilos. `npm run test:rapido`: 8 min.
- `TAMANOS=4,5 npm test` (o con `node --test tests/cubo-grande.test.mjs`) prueba solo esos tamaños.

### Qué limita ahora
- **6x6 y 7x7: los centros oblicuos** (~120 y ~140 movimientos de 3-ciclos): son ya la mitad de la solución. Cualquier movimiento que los mueve mueve también centros en X o en cruz, así que no se pueden buscar por parejas como los demás, y con las aristas aún libres tampoco hay macros cortas que solo los muevan a ellos (las que no mueven X no son más que 3-ciclos).
- El 6x6 queda en 3,42 con el objetivo en 3,5: cumple, pero con poco margen (en muestras de 30 casos salió entre 255 y 260).

## Noche 5 (corrección): `R++` del Megaminx y vista previa del scramble
- **Fallo corregido**: `R++`/`R--` giraban alrededor del eje de R dejando quieta la cara opuesta a R (DBL). Según la WCA (notación Pochmann) y TNoodle, se sujeta la cara **L** y se gira todo lo demás (eje de DBR). Los scrambles se aplicaban mal: un scramble hecho en un Megaminx real no coincidía con la vista previa. `D++` y `U` estaban bien.
- **Los centros se mueven, y es lo correcto**: los movimientos Pochmann giran casi todo el puzzle, así que tras el scramble los centros acaban en otro sitio (60 (todas) orientaciones distintas en 1000 scrambles, siempre rotaciones rígidas). La vista previa ahora se muestra **siempre en la orientación de referencia** (blanco arriba, verde oscuro delante), y debajo se indica dónde quedan el blanco y el verde y que hay que girar el puzzle entero para que coincida. *Cargar scramble actual* carga ese estado reorientado.
- Tests nuevos (`tests/megaminx-pochmann.test.mjs`):
  - Las pegatinas que no mueve `R++` (falla con el código antiguo).
  - Los centros tras cada movimiento Pochmann, contra TNoodle.
  - Rigidez de los centros y vista previa fija en 1000 scrambles.
  - Validador y solver sobre el estado reorientado: 1000/1000.
- `npm run test:rapido`: 96/96 (7 min). Detalles en DECISIONES.md.

## Noche 5: Megaminx

### Resultado (`npm test`: 93 tests, 93 pasan, 64 min; tras el último cambio del solver se repitió el fichero del Megaminx: 13/13, 23 min; y otra vez tras corregir `R++`, con los scrambles ya bien aplicados: 13/13 + 5/5 de `megaminx-pochmann`, 26 min — estas son las cifras de abajo; con el `R++` erróneo la media era 88,05)
500 casos: scramble Pochmann → puzzle reorientado al azar (una de sus 60 orientaciones) → validador → solver → la solución se aplica giro a giro con el modelo de pegatinas → cada pegatina queda con el color de su centro. Además, sin giros que se puedan unir y con las etapas cubriendo toda la solución.

| | Valor |
|---|---|
| Resueltos | **500/500 (100 %)** |
| Longitud media (giros de cara) | **89,53** |
| Longitud mínima / máxima | 82 / 94 |
| Cota inferior por conteo (calculada aquí) | **48** |
| **Cociente media / cota inferior** | **1,87** |
| Tiempo medio / máximo por solución | 2,6 s / 3,0 s |
| Orientaciones probadas (media) | 22,5 de 60 |
| Tablas (1.ª vez) | 1,2 s: 59 tablas de poda (409 ms) + 10.765 macros de última capa (822 ms); 2,9 MB en memoria |
| Etapas que necesitaron el respaldo (partirse en sub-etapas) | 0 de 169.255 |

Métrica: cualquier giro de una cara (72° o 144°, en cualquier sentido) = 1. Objetivo orientativo (< 200): ✅, con margen.

Longitud media por etapa:

| Base 1 | Base 2 | Base 3 | Base 4 | Anillo 1 | Anillo 2 | Anillo 3 | F2L 1 | F2L 2 | F2L 3 | Última capa |
|---|---|---|---|---|---|---|---|---|---|---|
| 7,13 | 5,44 | 5,44 | 9,43 | 5,48 | 9,16 | 8,81 | 8,89 | 5,49 | 9,40 | 14,85 |

- **Base 1–4**: la cara D y las aristas del anillo inferior (15 piezas); **Anillo 1–3**: las piezas de BL, L y BR que tocan el anillo inferior (13); **F2L 1–3**: las 12 piezas de F y R que no son de U, solo con U, F, R; **Última capa**: las 10 piezas de U con dos macros. Detalle en DECISIONES.md.
- Evolución durante la noche (20 casos): primera versión 95,0 → tablas que cubren todos los pares (más orientaciones en el mismo tiempo) 92,1 → orientaciones ordenadas por sus primeras etapas 91,0 → varias soluciones por etapa 88,2.

### Restricciones demostradas (Schreier–Sims, 2,5 s)
| Grupo | Orden calculado | Significa |
|---|---|---|
| Esquinas | 20!/2 · 3¹⁹ | permutación par y giro total ≡ 0 (mód. 3) |
| Aristas | 30!/2 · 2²⁹ | permutación par y número par de volteos |
| Puzzle entero | producto ≈ 1,0067·10⁶⁸ | esquinas y aristas independientes: **no hay relación de paridad entre ellas** |

Todos los scrambles pasan el validador (1000); los estados alterados fallan.

### Estados imposibles probados
Rechazados, con su mensaje: esquina girada; arista volteada; dos esquinas intercambiadas; dos aristas intercambiadas; dos esquinas **y** dos aristas intercambiadas a la vez (dos mensajes); pieza especular ("…tiene los colores de una esquina real pero en orden especular"); pieza inexistente o repetida; colores de más o de menos ("Hay 12 pegatinas de color azul y debería haber 11"); centros repetidos; centros con los opuestos mal ("…están en caras opuestas, pero en el Megaminx el opuesto del rojo es el naranja") y centros en orden especular.
Aceptados y resueltos: dos esquinas giradas en sentidos opuestos, dos aristas volteadas, 3-ciclos de esquinas y de aristas, dos parejas intercambiadas, y el puzzle pintado en cualquiera de sus 60 orientaciones.

### Última capa: comprobada en todos los casos
Los 4.665.600 estados posibles de la última capa (con el resto resuelto): 4.661.530 se resuelven con dos macros y los 4.070 restantes con una macro corta delante y dos más; el test los recorre todos y comprueba cada solución (75 s). Una última capa al azar sale en ~18 giros; en el solver, ~15.

### Interfaz
- Editor y "Resolver" activos en el Megaminx. Vistas **Red / Arriba (U) / Abajo (D)** (en el móvil, pegatinas de ~11 px en la red y ~30 px en cada flor), **Rellenar cara** y **Deshacer** (nuevo, en todos los puzzles; también Ctrl+Z).
- Leyenda "Notación: qué cara es cada letra" (red con las letras y explicación de R, R', R2, R2') y, durante la reproducción, las letras en los centros del editor. Barra de etapas coloreada por grupo y "Paso 36/90 · Anillo 3".
- Prueba de humo (jsdom): Megaminx sin Worker (vistas, rellenar, deshacer, leyenda, etapas, reproducción completa) y con el Worker real.
- **Comprobado en Chromium real** (Chrome 1280 px y móvil 390 px, tema claro y oscuro): tablas en el Worker (~1,3 s), solución en ~2,5–3 s, reproducción hasta el final, sin errores en consola ni scroll horizontal.

## Noche 4: soluciones NxN más cortas

### Referencia: número de Dios y cotas (comprobadas)
Todas en **OBTM** (métrica de la WCA: un giro de cara o de bloque exterior = 1; una capa interior suelta = 2), que es en la que se cuentan nuestras soluciones.

| Cubo | Número de Dios | Cota inferior | Cota superior / estimación | Estado |
|---|---|---|---|---|
| 2x2 | 11 | 11 | 11 | Demostrado (búsqueda completa; 11 HTM = OBTM, 14 QTM). |
| 3x3 | 20 | 20 | 20 | Demostrado (Rokicki, Kociemba, Davidson, Dethridge, 2010; 20 HTM = OBTM). |
| 4x4 | desconocido | 35 | 55 (demostrada) / ~36–48 (estimada) | Cota inferior 35: conteo (hilo de speedsolving.com) y **recalculada aquí**. 55: demostrada (7+12+16+20). En 2026 se ha publicado en speedsolving.com una prueba asistida por ordenador de **54**, pendiente de verificación independiente. Estimación: **sin confirmar en OBTM** (Hirata, 2024: 41 en una métrica de capas sueltas). |
| 5x5 | desconocido | 52 | 130 (demostrada) / ~60–80 (estimada) | 52: **calculada aquí** (no encontré fuente publicada con ese valor). 130: xyzzy, speedsolving.com, 2018. Estimación: **sin confirmar** (Hirata: 58 en otra métrica; el solver de xyzzy reduce en ~70–75). |
| 6x6 | desconocido | 75 | ~90–120 (estimación teórica) | 75: **calculada aquí** (un conteo más tosco en speedsolving da 73). Estimación: **sin confirmar** (no encontré ninguna fuente). |
| 7x7 | desconocido | 99 | ~120–160 (estimación teórica) | 99: **calculada aquí** (el conteo tosco da 95). Estimación: **sin confirmar**. |

Cálculo de las cotas inferiores (test en `tests/cubo-grande.test.mjs`): posiciones con los centros de un color indistinguibles frente a secuencias canónicas de n movimientos (los del mismo eje conmutan: por eje, C(N−1, j)·3^j elementos con j movimientos). Sale exactamente 35 / 52 / 75 / 99 (y 9 / 18 para 2x2 / 3x3, las cotas clásicas por conteo).

### Resultado (`npm test`: 81 tests, 81 pasan, 45 min)
500 casos en 4x4 y 5x5, 100 en 6x6 y 7x7, con el cubo reorientado al azar; cada solución se aplica movimiento a movimiento y se comprueba que el cubo queda resuelto y sin tramos simplificables.

| Cubo | Long. media | Long. máxima | Cociente (media / cota inf.) | Objetivo | Cota sup. / estimación | Distancia de la media a ella | Antes (noche 3) |
|---|---|---|---|---|---|---|---|
| 4x4 | **54,8** | 216 | **1,57** | ≤ 2,0 ✅ | 55 (demostrada) · ~36–48 | −0,2 · +7 a +19 | 195,1 |
| 5x5 | **159,6** | 257 | **3,07** | ≤ 3,0 ❌ (por 0,07) | 130 (demostrada) · ~60–80 | +29,6 · +80 a +100 | 269,0 |
| 6x6 | **357,6** | 392 | **4,77** | ≤ 3,5 ❌ | ~90–120 (sin confirmar) | +238 a +268 | 527,1 |
| 7x7 | **436,5** | 556 | **4,41** | ≤ 4,0 ❌ | ~120–160 (sin confirmar) | +277 a +317 | 686,9 |

Por fase (longitud media) y tiempos:

| Cubo | Centros | Aristas | Paridad | 3x3 | Tiempo medio (máx.) | Tablas (1.ª vez) |
|---|---|---|---|---|---|---|
| 4x4 | 14,8 (fases 1–2) | 20,6 (fase 3) | 0 | 19,4 | 1,2 s (13,7 s) | 4,1 s |
| 5x5 | 36,5 | 103,7 | 0 | 19,4 | 1,1 s (5,1 s) | 3,7 s |
| 6x6 | 159,6 | 174,2 | 4,4 | 19,4 | 1,3 s (3,0 s) | 4,0 s |
| 7x7 | 228,6 | 188,2 | 0,1 | 19,6 | 4,2 s (11,8 s) | 7,9 s |

El tiempo ha subido (antes 30–180 ms por solución): es búsqueda en vez de conmutadores. Sigue siendo en el Web Worker (la página no se bloquea) y con límites: si una búsqueda no termina, se pasa al método de conmutadores, que siempre funciona. En el 4x4 eso ocurre en ~3 de cada 500 casos (de ahí el máximo de 216 movimientos).

### Qué limita y qué haría falta
- **4x4 (objetivo cumplido)**: la media está en la cota superior demostrada (55). El TPR original llega a ~44 con una tabla de aristas de 12!/16 estados (~30 millones, varios segundos de generación); aquí la fase 3 está partida en dos con tablas pequeñas. Para bajar a ~45–48: esa tabla grande (con simetrías), o más candidatos entre fases.
- **5x5 (3,07 frente a 3,0)**: limitan las **aristas** (104 de 160 movimientos): se emparejan con 3-ciclos puros (~4,5 movimientos por wing). Con una muestra de 30 casos salió 2,97, así que está en el límite. Haría falta emparejar con búsqueda (fases tipo "dominó" como el solver de xyzzy, que reduce en ~70–75) en vez de con conmutadores.
- **6x6 (4,77)**: los **centros oblicuos** (~130 movimientos) se hacen con 3-ciclos porque están en las capas 2 y 3 a la vez y no se pueden aislar para la búsqueda por parejas de órbitas; una búsqueda conjunta de 4 órbitas necesitaría tablas combinadas de cientos de MB (lo que hace, p. ej., el solver de dwalton76). Las **aristas** (174) igual que en el 5x5.
- **7x7 (4,41)**: igual que el 6x6: oblicuos (~150) y aristas (188).
- Lo probado que no funcionó está en DECISIONES.md.

## Noche 3: 4x4, 5x5, 6x6 y 7x7 completos

Llegué a los cuatro tamaños: el mismo código, parametrizado por N, pasa todos los tests en los cuatro.

### Resultados (`npm test`: 79 tests, 79 pasan, 17,6 min)

Casos con el cubo reorientado al azar (la solución se aplica movimiento a movimiento con el modelo de pegatinas y se comprueba que el estado final es exactamente el resuelto; además, que no tenga tramos simplificables y que las fases cubran toda la solución).

| Tamaño | Casos | Resueltos | Long. media (máx.) | Tiempo medio (máx.) | Tablas |
|---|---|---|---|---|---|
| 4x4 | 1000 | **100 %** | 195,1 (250) | 27 ms (388 ms) | 1,6 s |
| 5x5 | 1000 | **100 %** | 269,0 (326) | 47 ms (162 ms) | 1,0 s |
| 6x6 | 200 | **100 %** | 527,1 (586) | 121 ms (222 ms) | 1,1 s |
| 7x7 | 200 | **100 %** | 686,9 (759) | 178 ms (351 ms) | 1,3 s |

Por fase: longitud media (máx.) · tiempo medio (máx.). "Paridad" suma la de wings (al principio) y la PLL (N par); entre paréntesis, en cuántos casos hizo falta alguna.

| Tamaño | Paridad | Centros | Aristas | 3x3 |
|---|---|---|---|---|
| 4x4 | 5,3 (13) · 658/1000 | 67,2 (106) · 7 ms (38) | 102,4 (125) · 9 ms (32) | 20,3 (22) · 12 ms (305) |
| 5x5 | 0,6 (4) · 320/1000 | 144,1 (189) · 19 ms (56) | 103,0 (123) · 12 ms (26) | 21,2 (22) · 18 ms (240) |
| 6x6 | 6,2 (14) · 150/200 | 291,7 (345) · 83 ms (143) | 208,8 (240) · 29 ms (45) | 20,4 (22) · 15 ms (113) |
| 7x7 | 1,0 (4) · 93/200 | 455,9 (524) · 142 ms (223) | 208,7 (236) · 33 ms (50) | 21,2 (22) · 17 ms (151) |

Los tiempos varían un ±10 % entre ejecuciones (los de esta tabla son los de `tests/resultados/`). Los de "Tablas" incluyen las de Kociemba (~1 s) si aún no estaban; la búsqueda de conmutadores y setups en sí tarda 0,1–0,4 s.

### Restricciones demostradas (Schreier–Sims; detalles en DECISIONES.md)
| Tamaño | Orientación | Paridad visible | Cómo |
|---|---|---|---|
| 4x4 | esquinas: giro total ≡ 0 (mod 3); las wings nunca se voltean | **ninguna** (la de esquinas = centros no se ve: los centros de un color son iguales) | \|H\| calculado = predicho (0,6 s) |
| 5x5 | ídem + aristas centrales: volteos pares | **esquinas = aristas centrales** | ídem (3,6 s) |
| 6x6 | como el 4x4 | **ninguna** | ídem (25 s) |
| 7x7 | como el 5x5 | **esquinas = aristas centrales** | ídem (72 s) |

El test calcula el orden del grupo con Schreier–Sims sobre todas las pegatinas y comprueba que coincide exactamente con el que predicen las órbitas por separado más las relaciones de paridad: eso demuestra que no hay más restricciones. También comprueba los números de estados conocidos del 3x3, 4x4 y 5x5.

### Paridades encontradas
- **Paridad de wings** (todas las N): la permutación de cada órbita de wings puede ser impar; se arregla con un cuarto de vuelta de su capa interior (`Rw R'` para las exteriores, `3Rw Rw'` para las interiores del 6x6/7x7). En N par es la paridad OLL (una arista "volteada" al final); en N impar, la de "dos aristas" del 5x5. En el 6x6 y el 7x7 cada órbita de wings tiene la suya, independiente.
- **Paridad PLL** (N par): esquinas con permutación impar y aristas resueltas. `r2 U2 r2 Uw2 r2 Uw2 U2` (r = capas 2..N/2, Uw = N/2 capas) intercambia las aristas UF y UB enteras; verificado al inicializar en 4x4 y 6x6.
- En N impar no hay paridad PLL (esquinas y aristas centrales van ligadas, como en el 3x3).

### Estados imposibles probados (por tamaño)
Rechazados, con su mensaje: esquina girada; wing volteada en su sitio ("Una wing está en una posición imposible (volteada en su sitio): …"); wing inexistente (colores opuestos o repetidos); número de pegatinas de un color; centros de dos órbitas mezclados ("Faltan centros blancos: hay 3 centros en X blancos y debería haber 4", 5x5+); y en N impar: arista central volteada, dos aristas centrales intercambiadas, dos esquinas intercambiadas, centros fijos especulares o no opuestos.
Aceptados y resueltos (no hay restricción): dos wings intercambiadas; dos centros de distinto color intercambiados; en N par, dos esquinas intercambiadas y una arista entera volteada.

### Interfaz
- Editor y "Resolver" activos en 4x4–7x7, con la orientación libre (como el 3x3).
- **Rellenar cara** (herramienta de la paleta: un toque pinta toda la cara con el último color elegido) y **cara ampliada** (botones "Red · U · R · F · D · L · B"): en el móvil (390 px) la red del 7x7 deja pegatinas de ~10 px; ampliada, ~45 px.
- Reproducción: barra de fases (Paridad, Centros, Aristas, 3x3; cada botón salta al final de su fase), movimientos coloreados por fase, "Paso 584/818 · Aristas", velocidad ×1/×2/×4/×8 y la lista sigue al movimiento actual.
- Prueba de humo (jsdom): sin Worker resuelve todos los puzzles con solver (también 6x6 y 7x7); test nuevo de 4x4 y 5x5 (vistas, rellenar cara, validador, fases, velocidad, reproducción completa); con Worker real, 4x4 y 5x5 pasan por él.
- **Comprobado en Chromium real** (Chrome 1280 px y móvil 390 px, tema claro y oscuro): 4x4–7x7 con scramble cargado, resueltos en el Worker y reproducidos hasta el final; sin errores en consola ni scroll horizontal.

## Noche 2

- **Square-1 completo**: modelo corregido según la Regulación 12c1, validador con mensajes claros, solver en dos fases que solo genera movimientos posibles, scramble de estado aleatorio según 4b3d y editor pensado para el móvil (mover piezas con dos toques, pintar, girar capas, capa del medio). La reproducción paso a paso se ve en la vista del editor.
- **Web Worker** (nuevo): todas las tablas, los scrambles de estado aleatorio, la validación y las búsquedas se hacen en un Worker creado desde un blob (la app sigue siendo un único HTML sin servidor, ~160 KB). Mientras se generan las tablas se ve "Generando… X s" y al final el tiempo y dónde se calcularon. Si el Worker no existe, no arranca en 4 s o falla, todo sigue en el hilo principal.
- `npm run bench` funciona (benchmark de todos los solvers).
- Comprobado en Chromium real (escritorio 1280 px y móvil 390 px, tema claro y oscuro): sin errores, sin scroll horizontal, con el Worker activo.

## Resultados de los tests de los demás puzzles (noche 2; siguen igual en la noche 3)

1000 casos por puzzle.

| Puzzle | Scrambles válidos sin redundancias | Long. media scramble | Resueltos | Long. media solución (máx.) | Tiempo medio solución (máx.) | Tablas |
|---|---|---|---|---|---|---|
| 2x2 | 1000/1000 | 8,72 (4–10) | **100 %** | 8,76 (10) | 1,0 ms (13 ms) | 0,4 s |
| 3x3 | 1000/1000 | 20,72 (17–21) | **100 %** | 19,80 (21) | 64 ms (1,0 s) | 0,8 s |
| Pyraminx | 1000/1000 | 10,53 (7–13) | **100 %** | 10,56 (13) | 0,02 ms (0,7 ms) | 0,3 s |
| Skewb | 1000/1000 | 8,44 (7–10) | **100 %** | 8,42 (10) | 0,16 ms (4 ms) | 0,1 s |
| **Square-1** | 1000/1000 | 11,68 barras · 24,18 WCA · 32,48 giros | **100 %** | 11,38 barras (15) · 23,67 WCA (31) · 32,01 giros (45) | 207 ms (456 ms) | 0,9 s (+0,2 s el conjunto para la longitud mínima) |
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
- La suite completa tarda ~52 min con 2 núcleos (en paralelo con worker_threads; menos con más núcleos); `npm run test:rapido` tarda ~8 min (20 casos por tamaño de NxN y de Megaminx, Schreier–Sims solo hasta el 5x5, muestra de 1.000 últimas capas).
- Soluciones NxN: 55 / 109 / 256 / 356 de media (noche 4: 55 / 160 / 358 / 437); ver la sección de la noche 6. Resolver tarda 1–7 s de media (máximo medido 13,3 s en un 4x4 que acaba usando el método de respaldo) y las tablas 3–8 s la primera vez.
- Los scrambles de 4x4–7x7 siguen siendo de movimientos aleatorios (TNoodle usa estado aleatorio en el 4x4).
- Megaminx: los scrambles siguen siendo de movimientos aleatorios (Pochmann, como exige la WCA). Resolver tarda ~2,5–3 s porque prueba orientaciones hasta agotar el tiempo (`tiempoMax`); la primera vez se generan sus tablas (~1,3 s). En el móvil la red completa queda pequeña: para pintar, mejor las vistas "Arriba (U)" y "Abajo (D)".

## Siguiente paso recomendado (noche 7)
1. **Oblicuos del 6x6/7x7**: son lo que más pesa. Ideas no probadas: construir primero "barras" (oblicuo A + oblicuo B del mismo color, que con giros de hasta dos capas viajan juntos) y resolver luego el 6x6 como un 5x5 virtual (capas 1, 2, bloque 3–4, 5, 6) con la búsqueda de centros del 5x5.
2. **Megaminx más corto**: etapas más grandes o búsqueda en haz entre etapas; macros de última capa con más caras.
3. **4x4**: scramble de estado aleatorio (las tablas de `tpr4.js` sirven de base).
