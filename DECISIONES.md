# Decisiones tomadas sin consultar (noche 1)

Decisiones que he tomado yo cuando había dudas, para que puedas revisarlas.

## Repositorio
- Durante la noche 1 la sesión no tenía permiso de escritura en `Manker-73/Cubo-solver`, así que trabajé en un repositorio git local con commits frecuentes y publiqué una copia (código, tests, docs y `git bundle`) como artifact. Cuando se instaló la app de GitHub de Claude, subí todo el historial, unido con el "Initial commit" del repositorio.

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

## Square-1 (scramble de movimientos aleatorios, de momento)
- Longitud: **40 en métrica de giros** (cada `/` cuenta 1 y cada capa girada en un `(x,y)` cuenta 1), que era el estándar de los scrambles de movimientos aleatorios; salen unas 15 barras de media (los de estado aleatorio de TNoodle tienen ~11-13).
- Cada `(x,y)` se elige al azar entre los que dejan el `/` siguiente legal (ninguna esquina cruzando el corte en ninguna capa); nunca `(0,0)`, y nunca dos `/` seguidos. x, y en −5..6.
- Formato `(x,y)/ (x,y)/ …`; cada unidad termina en `/`.
- Vista previa: capa de arriba vista desde arriba y capa de abajo vista desde abajo, con la línea de corte; la barra de abajo indica si la capa del medio está volteada.

## Megaminx
- Notación Pochmann: 7 líneas de 10 movimientos R/D alternos (empezando por R), cada uno `++` o `--` al azar, y la línea termina en `U` si el último fue `D++` o en `U'` si fue `D--` (como TNoodle).
- ~~`R++` gira todo menos la capa de la cara opuesta a R, 144° en sentido horario visto desde R~~ **(mal; corregido en la noche 5: ver "Corrección: R++ y vista previa del scramble")**; `D++` gira todo menos la capa de U, 144° en sentido horario visto desde D. La vista previa se calcula con el motor geométrico (132 pegatinas, dos "flores").
- Los 12 colores eran orientativos en la noche 1 (no hay un esquema único oficial). **Noche 5: confirmados** con un Megaminx físico, igual que la red (ver abajo).

# Noche 2

## Square-1: corrección del estado resuelto (cambio respecto a la noche 1)
- El modelo de la noche 1 tenía la capa de arriba **desplazada una casilla** respecto a la de abajo: en su "resuelto", "/" conservaba la forma de cubo, lo que en el puzzle real no pasa. Comprobado con la página de Jaap Scherphuis (desde el cubo hace falta `(1,0)/(-1,0)` o `(0,-1)/(0,-1)` para seguir en forma de cubo) y con la Regulación WCA 12c1 (una de las superficies pequeñas de la capa del medio a la izquierda del frente). Consecuencia práctica: los scrambles de la noche 1 empezaban desde un estado que no es el resuelto real.
- Ahora las dos capas resueltas son `A E E A E E …` (A = arista, E = mitad de esquina) empezando en la casilla 0, alineadas. Desde resuelto, `(1,0) /` es legal y `(-1,0) /` no. Se actualizó el test de modelo con esta explicación.
- Colores: blanco arriba, esquema occidental. Por la Regulación 4d3 (se mezcla con el color más oscuro delante, de los dos posibles), el frente es el **azul** (la noche 1 tenía el verde).

## Square-1: representación
- **Motor** (`square1-motor.js`): ids de pieza por casilla, como en la noche 1 (las funciones de giro y "/" eran correctas y se conservan). Las formas se representan con máscaras de 12 bits (bit = empieza una pieza): 322 máscaras válidas, 19.305 combinaciones arriba/abajo.
- **Estado público** (`square1.js`, el que usan la interfaz y el editor): cada capa es una lista de piezas con sus colores (`[cara, lateral]` o `[cara, lateral1, lateral2]`) y la casilla inicial. Así el validador puede detectar piezas inexistentes, especulares, giradas, repetidas y capas que no suman 12 casillas, cosas que con ids no se pueden ni representar. Un test comprueba que los dos modelos coinciden en 300 secuencias legales.
- Interfaz común: hacía falta `clonar(estado)` (el estado ya no es un array) y que `pegatinasEditables(estado)` pueda depender del estado (los índices dependen de la forma). Ambos son **opcionales con valor por defecto**, así que los demás puzzles no cambian.

## Square-1: paridad (demostrada, no supuesta)
- **No hay ninguna restricción de paridad**, tampoco con la capa del medio. Demostración en los tests:
  1. BFS sobre (forma, paridad, capa del medio) con `(1,0)`, `(0,1)` y "/": las 19.305 formas aparecen con las 4 combinaciones de paridad y capa del medio (77.220 estados).
  2. Schreier–Sims en la forma de cubo: el grupo de los movimientos que conservan el cubo es exactamente el de todas las permutaciones **pares** con la capa del medio libre (8!·8!). Con (1) se alcanza también la paridad impar, así que en cada forma hay 8!·8!·2 estados.
- Por tanto el validador no tiene comprobación de paridad; un test verifica que dos aristas intercambiadas, o solo la capa del medio volteada, se aceptan y se resuelven. (Queda en el validador una comprobación de alcanzabilidad de la forma como seguro; nunca falla.)

## Square-1: solver
- Dos fases, minimizando el número de barras:
  - **Fase 1**: llegar a la forma de cubo con la paridad correcta. Búsqueda sobre el estado real, podada con una tabla exacta forma×paridad (máximo 7 barras). Solo se prueban los giros `(x,y)` que dejan el "/" legal en esa forma, así que nunca se genera un movimiento imposible.
  - **Fase 2**: en forma de cubo, con `(3a,3b)` y "/" en las **dos** alineaciones en las que "/" es legal y conserva el cubo (la de "/" directo y la de `(1,1) / (-1,-1)`). Con una sola alineación, cada esquina queda pegada a una arista (grupo de 8!·2 elementos, comprobado): por eso hacen falta las dos. IDA* con dos tablas de poda combinadas (esquinas × qué aristas están arriba × capa del medio, y al revés; 5,6 millones de entradas cada una).
- Las tablas se generan en el navegador (~1 s) con un BFS por niveles (giros con coste 0, "/" con coste 1). Sustituí un primer BFS 0-1 con deque porque el deque podía desbordarse sin avisar.
- Tras la primera solución (~7 ms de media) sigue buscando otras más cortas durante 200 ms (80 ms para los scrambles). Los giros consecutivos se unen y se quitan `(0,0)` y "/ /".

## Square-1: scramble de estado aleatorio
- **Distribución**: uniforme entre los estados alcanzables en los que se puede hacer "/" sin girar antes (Regulación 4b3d). Como todas las formas tienen el mismo número de estados (8!·8!·2), basta con elegir una de las 3.678 formas "cortables" al azar y luego permutaciones y capa del medio al azar. Un test de chi cuadrado lo comprueba.
- **Longitud mínima**: 11 movimientos en la métrica 12c4 (Regulación 4b3d). La longitud de mi solución no basta (no es óptima), así que se comprueba **de forma exacta**: encuentro a mitad de camino con los estados a ≤ 6 movimientos del resuelto (precalculados como hashes) y una búsqueda de ≤ 4 desde el estado, podada con la distancia exacta en barras. Con hashes, un falso positivo solo puede hacer que se descarte un estado válido, nunca que se acepte uno corto. Calculé que, sin esta comprobación, hasta 1 de cada ~16.000 estados podría incumplir la regla (cota: 7,4·10⁸ secuencias de ≤ 10 movimientos).
- El scramble es la inversa de la solución; formato `(x,y)/ (x,y)/ …` con x, y en −5..6. Puede acabar en "/" o en un giro.

## Square-1: editor
- Pensado para el móvil: la herramienta **Mover piezas** (elegida por defecto) intercambia dos piezas con dos toques. Si una es esquina y la otra arista, se intercambian los bloques que empiezan en cada una, ampliados con las piezas siguientes hasta ocupar lo mismo (por ejemplo, esquina+arista ↔ arista+esquina). Así se puede cambiar la forma sin que sobre ni falte ninguna pieza; al cambiar de capa, una esquina conserva su quiralidad. Una primera versión ("esquina ↔ dos aristas seguidas") no permitía salir de la forma de cubo, donde nunca hay dos aristas juntas.
- También: pintar pegatinas con la paleta, botones para girar cada capa 30° y voltear la capa del medio (o tocar su barra).
- Para esto añadí a la interfaz común, todo opcional: `herramientas`, `usarHerramienta`, `herramientaInicial`, `indicesInmediatos`, `accionesEditor` y `aplicarAccion`. Servirán para otros puzzles (4x4, Megaminx).

## Métricas
- Se informa en **barras**, en **movimientos WCA** (Regulación 12c4: cada `(x,y)` cuenta 1 y cada "/" cuenta 1) y en **métrica de giros** (cada capa girada cuenta 1, como en la noche 1).

## Web Worker
- `servicio.js` atiende las peticiones (tablas, scrambles, validación, búsquedas); lo usan el Worker y el hilo principal, así que el comportamiento es idéntico.
- `scripts/build.mjs` empaqueta el Worker aparte y lo incrusta como texto en la app; la app lo crea desde un blob (sigue siendo un único HTML sin servidor, ~160 KB).
- Al arrancar se le hace un "ping"; si no responde en 4 s, si el constructor falla o si da un error, la app pasa al hilo principal y rehace lo que estuviera pendiente. Las tablas viven en el Worker, así que validar (el Skewb usa tablas) y resolver también van al Worker.
- Mientras se generan tablas se ve "Generando… X s" con un indicador; al acabar, el tiempo y dónde se calcularon. Los tests de Node siguen llamando a los solvers directamente.

## Otros
- `npm run bench`: creado (`scripts/bench.mjs`), benchmark de todos los solvers.
- La herramienta de Schreier–Sims (`src/core/grupo.js`) queda disponible para demostrar invariantes en los próximos puzzles.

# Noche 3: cubos grandes (4x4–7x7) por reducción

## Modelo de piezas (`nxn-piezas.js`)
- No está escrito a mano: las pegatinas se agrupan en piezas por la posición 3D de su cubie, y las piezas en **órbitas** según los movimientos (todas las caras, todas las profundidades). Salen solas, para cualquier N: 8 esquinas, 12 aristas centrales (N impar), ⌊(N−2)/2⌋ órbitas de 24 wings, ⌊(N−2)²/4⌋ órbitas de 24 centros (X, cruz y oblicuos; los oblicuos del 6x6/7x7 son dos órbitas quirales, "A" y "B") y, en N impar, los 6 centros fijos.
- Las 48 pegatinas de cada órbita de wings forman **dos órbitas de 24 pegatinas**: ningún movimiento lleva la pegatina "primera" de una wing a la "segunda" de otra. Por eso cada wing se guarda con su pegatina primaria delante y su orientación es siempre 0.
- Nombres de posición de las wings: arista + número contando desde un extremo (p. ej. "UF n.º 1 desde L").

## Restricciones: demostradas, no supuestas (`nxn-grupo.js`, `tests/nxn-grupo.test.mjs`)
- H = movimientos que no mueven la referencia de orientación (N impar: caras hasta profundidad (N−1)/2, que no mueven los centros fijos; N par: U, R y F a cualquier profundidad, que no mueven la esquina DBL). Todo estado alcanzable es, salvo una rotación del cubo entero, un elemento de H.
- Método: para cada órbita, Schreier–Sims del grupo inducido G_i; para cada generador, la paridad de su permutación de piezas en cada órbita (vector en GF(2)); S = subespacio generado. Se comprueba que **|H| = Π|G_i| · |S| / 2^k** (k = órbitas con permutaciones impares), calculando |H| con Schreier–Sims sobre todas las pegatinas. Como H está contenido en ese conjunto de tuplas, la igualdad de órdenes demuestra que **no hay ninguna otra restricción** que las de cada órbita y las relaciones de paridad (ortogonales a S).
- Tiempos: 3x3 0,07 s, 4x4 0,6 s, 5x5 3 s, 6x6 22 s, 7x7 70 s (6x6 y 7x7 solo en `npm test`). El test también comprueba los números de estados conocidos del 3x3, 4x4 y 5x5.
- Resultados (iguales para N = 4..7 salvo lo indicado):
  - Esquinas: la suma de giros es múltiplo de 3 (factor 3). Permutación libre.
  - Aristas centrales (N impar): número par de volteos (factor 2).
  - Wings: **nunca se voltean** (factor 2²⁴: la orientación queda fijada por la posición). Permutación libre.
  - Centros de cada órbita: cualquier permutación.
  - Relaciones de paridad: 4x4: esquinas = centros. 5x5: esquinas = aristas centrales; esquinas = centros X; esquinas + wings = centros en cruz. 6x6: esquinas = centros X ext. = centros X int.; esquinas + wings ext. + wings int. = oblicuos A = oblicuos B. 7x7: las del 6x6 más esquinas = aristas centrales, esquinas + wings ext. = cruz ext., esquinas + wings int. = cruz int.
  - **Visibles**: los centros de un mismo color son indistinguibles, así que cualquier relación en la que entre una órbita de centros se cumple siempre (basta con intercambiar dos centros iguales). Quedan: **ninguna en N par** y **esquinas = aristas centrales en N impar**. En N par no hay ninguna restricción de paridad: dos esquinas intercambiadas (paridad PLL) o una arista entera volteada (paridad OLL) son estados posibles; los tests lo comprueban resolviéndolos.

## Validador
- Orientación libre, como en el 3x3: en N impar la marcan los centros fijos; en N par, la **esquina DBL** (como en el 2x2): se reetiquetan los colores con la rotación que la deja en su sitio. La solución queda en el sistema de referencia del usuario.
- Comprobaciones, en orden: número de pegatinas de cada color; centros fijos (N impar: distintos, opuestos, no especulares); esquinas y aristas centrales (inexistentes, especulares, repetidas, que faltan); wings por órbita; 4 centros de cada color en cada órbita ("Faltan centros rojos: hay 3 centros en X rojos y debería haber 4"); y solo las restricciones demostradas: giro de esquinas, volteo de aristas centrales y paridad esquinas = aristas centrales (N impar).
- Wing volteada en su sitio: como cada wing tiene una "gemela" con los colores al revés (la otra de su arista), una wing volteada se lee como la gemela repetida. El validador lo detecta y lo explica: "Una wing está en una posición imposible (volteada en su sitio): la wing blanco-azul aparece 2 veces (en … y en …) y falta la azul-blanco…".

## Solver por reducción (`cubo-grande.js`)
Elegí un método basado en **conmutadores puros** en vez de tablas de búsqueda por fases (como el TPR del 4x4) porque es el mismo código para cualquier N, siempre correcto y fácil de verificar. La contrapartida es la longitud (ver ESTADO.md).
- **Conmutadores**: al inicializar se buscan solos. X = una capa (cara, capa ancha o capa interior suelta), Y = A·B·A⁻¹ (A una cara, B una cara o capa interior). Si los soportes (en piezas) de X e Y se cortan en exactamente una pieza, [X, Y] es un 3-ciclo; se comprueba sobre las pegatinas que mueve exactamente 3 piezas de una órbita y nada más. Salen 3-ciclos de 10 movimientos (wings) y 12 (centros) para todas las órbitas de 4x4 a 7x7.
- **Setups**: por cada órbita, un recorrido (Dial) sobre los 24·23·22 tríos ordenados de posiciones, desde los tríos de todas las bases a la vez (coste = longitud de la base + 2 por movimiento de setup). Así cualquier 3-ciclo (a→b→c) sale con el setup más corto. El test comprueba que los 12.144 tríos son alcanzables en todas las órbitas.
- **Elección voraz**: en cada paso, el 3-ciclo con más piezas colocadas por movimiento; entre los 24 mejores, el que menos alarga la solución al simplificarse con el final de lo que ya hay. Siempre avanza (en los centros, al haber piezas iguales, cualquier estado con 4 de cada color se resuelve con permutaciones pares; en las wings la paridad se arregla antes).
- **Fases**:
  1. *Centros (libres)*: mientras no hay nada que proteger, movimientos sueltos o parejas que aumenten los centros colocados (mientras ganen ≥ 1 centro cada 3 movimientos). Ahorra ~15 % en centros.
  2. *Paridad*: si la permutación de una órbita de wings (respecto a su objetivo) es impar, un cuarto de vuelta de su capa interior (`Rw R'`, `3Rw Rw'`): es la paridad OLL del 4x4/6x6 y la "paridad de aristas" del 5x5/7x7. Mueve centros, pero aún no están acabados.
  3. *Centros*: 3-ciclos, órbita a órbita.
  4. *Aristas*: 3-ciclos de wings. Objetivo: en N impar, los colores de la arista central de cada arista (emparejar); en N par, directamente su sitio.
  5. *Paridad PLL* (N par): si las esquinas tienen permutación impar, `r2 U2 r2 Uw2 r2 Uw2 U2` (r = capas 2..N/2, Uw = N/2 capas), que intercambia las aristas UF y UB enteras sin tocar nada más. Se verifica al inicializar (si no, se haría con 3-ciclos). Nota: la versión que se suele escribir, `r2 U2 r2 Uw2 r2 Uw2`, deja además la capa U girada 180°; de ahí el `U2` final.
  6. *3x3*: se extrae el 3x3 reducido (esquinas, aristas y centros) y se resuelve con `cubo3.js` (Kociemba, objetivo ≤ 22 movimientos, máx. 300 ms). Las caras del 3x3 son las caras exteriores del NxN.
- **Comprobaciones internas**: al final de la reducción el cubo debe estar resuelto, y la solución simplificada se vuelve a aplicar al estado del usuario; si algo fallara devolvería un error en vez de una solución incorrecta.

## Notación y simplificación
- Solo notación WCA: `R`, `Rw`, `3Rw`… Una capa interior suelta se escribe como dos movimientos (`Rw R'`).
- Los movimientos de un mismo eje conmutan, así que cada tramo de un mismo eje es un vector de giros por capa. Se sustituye por su **forma canónica**: la descomposición con menos movimientos WCA (capas anchas desde las dos caras del eje, sin rotaciones), y con capas menos profundas a igualdad (programación dinámica sobre las fronteras entre capas).
- La regla de redundancia de los scrambles ("como mucho un movimiento por cara en un tramo") no vale para soluciones, porque `Rw R'` es la forma normal de escribir una capa interior. Para las soluciones hay un método opcional nuevo, `buscarRedundanciaSolucion` (por defecto, el de los scrambles): en el NxN comprueba que ningún tramo se pueda escribir con menos movimientos.

## Interfaz
- Editor y "Resolver" activos en 4x4–7x7 (los cuatro pasan todos los tests).
- **Rellenar cara**: lo hice como herramienta de la paleta (un toque en cualquier pegatina pinta toda su cara con el último color elegido, que se ve en el botón) en vez de con `accionesEditor`, porque una acción no sabe qué cara rellenar y la herramienta sí (la pegatina tocada). Para ello `usarHerramienta` y `aplicarAccion` reciben un tercer argumento opcional `{ color }`.
- **Vista de una cara** (nuevo campo opcional `vistasEditor` + `renderizar(estado, { vista })`): en el móvil la red del 7x7 deja pegatinas de ~10 px; ampliando una cara son de ~45 px. Botones "Red · U · R · F · D · L · B".
- **Fases en la reproducción**: `resolver` puede devolver `fases: [{nombre, inicio, fin}]`. Se muestra una barra de fases (cada botón lleva al final de su fase), los movimientos coloreados por fase, la fase actual en "Paso 37/412 · Centros" y un botón de velocidad ×1/×2/×4/×8 (las soluciones son largas). La lista de movimientos tiene scroll y sigue al movimiento actual.

# Noche 4: soluciones NxN más cortas

## Métrica y cotas de referencia
- Todas las longitudes están en **OBTM** (outer block turn metric, la de la WCA): cada giro de una cara o de un bloque de capas que incluye una cara cuenta 1; una capa interior suelta cuenta 2 (`3Rw Rw'`). Es la métrica en la que la simplificación de `nxn.js` deja las soluciones.
- Las cotas inferiores de la tabla (35, 52, 75, 99) **las he recalculado** con el argumento de conteo: número de posiciones (centros de un color indistinguibles, orientación fijada) frente al número de secuencias canónicas de n movimientos (por eje, los movimientos conmutan; un grupo de un eje con j "fronteras" distintas da C(N−1, j)·3^j elementos; grupos consecutivos de ejes distintos). Salen exactamente 35, 52, 75 y 99 (y 9 y 18 para el 2x2 y el 3x3, que son las cotas clásicas por conteo). Hay un test que lo comprueba (`tests/cubo-grande.test.mjs`).
- Fuentes y estado de cada cifra: ver la tabla de ESTADO.md. Resumen: 2x2 = 11 y 3x3 = 20 (HTM/OBTM) demostrados; 4x4 entre 35 y 55 (en 2026 se ha publicado en speedsolving.com una prueba asistida por ordenador de 54, aún sin verificación independiente); 5x5 ≤ 130 (xyzzy, 2018); las "estimaciones" de 4x4 y 5x5 se apoyan en un artículo de 2024 (Hirata: 41 y 58 en una métrica de capas sueltas, no OBTM); las de 6x6 y 7x7 no las he podido confirmar con ninguna fuente.

## 4x4: reducción por búsqueda en tres fases (`tpr4.js`)
Idea del método de Tsai / TPR de Chen Shuang (el solver que usa TNoodle); implementación propia sobre el modelo de pegatinas, no copiada. Lo comprobé antes de escribir nada con Schreier–Sims/BFS sobre el modelo (p. ej. que los movimientos de la fase 3 parten las wings en dos órbitas de 12).
- **Fase 1** (los 36 movimientos): un par de colores opuestos a las caras R/L (C(24,8) = 735.471 estados, tabla exacta). En el 4x4 los centros no fijan la orientación, así que se prueban los tres pares.
- **Fase 2** (caras, `Uw2 Dw2 Fw2 Bw2`, `Rw`, `Lw`): centros de R/L resueltos, los otros dos pares separados y la permutación de las wings par (sin paridad OLL). Tabla exacta 12.870 × 70 × 2. Además se **filtran** los finales: las dos wings de cada arista deben quedar en "mitades" distintas (las dos órbitas de 12 de la fase 3) y la permutación relativa debe ser par; si no, la fase 3 no podría emparejarlas. Se enumeran muchas soluciones de la fase 2 hasta que alguna pasa el filtro (~1 de cada 1.300).
- **Fase 3a** (U D F B, R2 L2 y capas anchas a 180°): las 4 aristas "del ecuador" (sin colores del par de U/D) a las posiciones del ecuador, y los centros a un estado alcanzable en la 3b; se exige que la permutación relativa del ecuador sea una de las 4 alcanzables (filtro, 1 de cada 6).
- **Fase 3b** (grupo "dominó": U D, R2 L2 F2 B2, capas anchas a 180°): centros resueltos y todas las aristas emparejadas. Tablas exactas: aristas = permutación relativa en el ecuador (4!) × en U/D (8!) (alcanzables 4 × 20.160) y centros (20.160 estados con la paridad PLL). La **paridad PLL** se evita aquí: el bit "paridad de aristas ≠ paridad de esquinas" va en la tabla de centros.
- En vez de la tabla de 12!/16 del TPR original (≈ 30 millones de estados con simetrías, varios segundos en generarse) partí la fase 3 en dos con tablas pequeñas. Cuesta unos movimientos (≈ 53 de media contra ≈ 44 del TPR), pero las tablas se generan en ~3 s.
- Si la reducción no termina a tiempo se reintenta con más margen y, si aun así falla, se usa el método de conmutadores de la noche 3 (siempre correcto). Pasa en ~3 de cada 500 casos: la heurística de la fase 3b (máximo de la tabla de centros y la de aristas) a veces se queda 4 o más movimientos por debajo y la búsqueda no termina.
- Tests: los casos del solver NxN bajan a 500 (4x4, 5x5) y 100 (6x6, 7x7) porque cada solución tarda ahora 1–4 s; `npm test` tarda ~45 min.

## 5x5–7x7: centros por búsqueda (`nxn-centros.js`)
- Tres etapas, como en las fases de arriba: E1 (todos los movimientos) los centros de R/L a R/L; E2 (eje R cualquiera, el resto solo caras o medias vueltas) los de U/D a U/D; E3 (caras y medias vueltas) todo resuelto. Cada órbita es una máscara de 24 bits; tablas por tipo de órbita (X, cruz, oblicuos) y etapa.
- **Dos órbitas a la vez**: con más, la búsqueda conjunta es inviable (la heurística es el máximo de las tablas de cada órbita). En la E3 además hay tablas conjuntas de las dos órbitas: por grupo de caras (70²) y por tríos de "trozos" (órbita, grupo de caras) (70³, 18 tablas); bajaron la E3 del 5x5 de ~17 a ~13 movimientos.
- Grupos: 5x5 {X, cruz}; 6x6 {X exteriores, X interiores}; 7x7 {X ext., cruz ext.} con bloques y {X int., cruz int.} **intercalado** con movimientos que no estropean lo ya hecho en el primero (la capa 3 suelta, que no toca la capa 2): E1(A), E1(B), E2(A), E2(B), E3(A), E3(B). Los oblicuos del 6x6/7x7 no se pueden aislar así (están en las capas 2 y 3) y se hacen con 3-ciclos.
- **Paridad de las wings** dentro de la búsqueda (como en la fase 2 del 4x4): la tabla de la E2 lleva los bits de paridad de cada órbita de wings, así que no hace falta el giro de capa de paridad.
- Se elige la rotación del cubo con la E1 más corta (la búsqueda se hace en el cubo girado y los movimientos se traducen).
- IDA* con un límite de nodos; si se pasa, se repite con la heurística inflada (×1,3 … ×8: soluciones algo más largas, mucho más rápido) y, si aun así no basta, ese grupo se termina con 3-ciclos (el respaldo está probado en los tests forzando límites ridículos).

## Conmutadores dobles
- Además de los 3-ciclos puros de una órbita, al inicializar se buscan conmutadores [X, A·B·A⁻¹] cuyos soportes se cortan en 2–4 piezas y que resultan ser 2–4 3-ciclos disjuntos (en una o varias órbitas del mismo tipo) sin mover nada más. Ejemplos: un 3-ciclo de oblicuos A y otro de oblicuos B en **8** movimientos (un 3-ciclo de centros suelto cuesta 12); wings exteriores + interiores (2, 3 o 4 ciclos) en 10.
- El voraz elige en cada paso, entre 3-ciclos simples (con su setup óptimo) y múltiples (base × setup de 0 o 1 movimientos), el que más piezas coloca por movimiento real (contando lo que se simplifica con el final de la solución).

## Lo que no funcionó
- **Búsqueda en haz** para muchas órbitas a la vez: se atasca con todas las órbitas a 1 movimiento de su objetivo y ninguna salida (hace falta un conmutador para acabar).
- **IDA* conjunto de 4–6 órbitas**: con la heurística del máximo, millones de nodos por nivel.
- **Mirar un paso más** en el voraz de 3-ciclos: −2 % de movimientos y el doble de tiempo; queda desactivado (opción `anticipar`).
- Una tabla de 3 aristas para la fase 3 del 4x4 sin partirla (12⁶): heurística demasiado débil (máx. 7 para fases de ~13).

# Noche 5: Megaminx (validador, solver y editor)

## Colores y red: confirmados
- El esquema de colores y la red (dos "flores": U con sus 5 vecinas vistas desde arriba y D con las suyas vistas desde abajo) están **comprobados con un Megaminx físico**. No se han tocado: color *i* = cara *i* (U blanco, F verde oscuro, R rojo, BR morado, BL amarillo, L azul, D gris, DR verde claro, DBR rosa, B crema, DBL naranja, DL celeste).
- Lo único que ha cambiado en `megaminx-geo.js` (la geometría salió de `megaminx.js` sin cambios) son los **nombres internos** de las caras del anillo inferior, que estaban desplazados una posición (la cara 7, que está delante a la derecha, se llamaba "DBR"). Solo eran nombres internos (no salían en ningún sitio); ahora se calculan comprobados con un test (vecinas de cada cara).

## Notación de las soluciones
- Los **scrambles siguen en Pochmann** (`R++`, `D--`, `U'`…), sin cambios.
- Las **soluciones** usan notación de caras: **U, F, R, BR, BL, L** (arriba y su anillo, en sentido horario visto desde arriba, F delante) y **D, DR, DBR, B, DBL, DL** (abajo y su anillo: DR debajo de F y R, B detrás y opuesta a F). Giros: `R` = 72° horario mirando la cara R de frente, `R'` = 72° antihorario, `R2` = 144° horario, `R2'` = 144° antihorario.
- Elegí esta convención porque es la más extendida en algoritmos y simuladores (es la que leen, por ejemplo, el simulador de ruwix y el solver de cubzor, y la que se usa en los hilos de algoritmos de speedsolving.com). Alternativas que existen: DFR/DFL/DB en vez de DR/DL/B (preferida por algún usuario de speedsolving para que todas las de abajo empiecen por D) y la de Randelshofer, con UR/UL y el puzzle sujeto de otra forma.
- La interfaz tiene una **leyenda** ("Notación: qué cara es cada letra": la red con la letra de cada cara en su centro y la explicación de los sentidos) y, durante la reproducción, el editor muestra esas letras en los centros.
- **Métrica**: cualquier giro de una cara (72° o 144°, en cualquier sentido) cuenta 1. Todas las longitudes de esta noche están en esta métrica.

## Modelo de piezas (`megaminx-piezas.js`)
- No está escrito a mano: una pegatina pertenece a la pieza formada por las caras en cuya capa está su centro (1 cara = centro, 2 = arista, 3 = esquina). Salen 12 centros, 20 esquinas y 30 aristas; las pegatinas de cada pieza, en sentido horario visto desde fuera. Sobre eso, `crearModeloPiezas` (el mismo de los demás puzzles) da posiciones y orientaciones (3 en esquinas, 2 en aristas).
- Los 48 giros de cara se calculan con el motor geométrico (`crearGeoPuzzle`, mismos cortes que los de Pochmann). Un test comprueba que pegatinas y piezas coinciden tras 300 giros al azar, que `X X = X2`, que las caras no vecinas conmutan y las vecinas no, etc.
- **Orientación libre**: el motor geométrico da también las 60 rotaciones del puzzle entero. Si los centros pintados son una de ellas, se reetiquetan los colores para que cada centro tenga "el de su cara" y la solución sale en el sistema de referencia de quien sujeta el puzzle (como en los cubos). Los scrambles Pochmann mueven los centros (`R++` es una rotación más un giro), así que esto se usa siempre.

## Restricciones: demostradas (`megaminx-grupo.js`, test "restricciones demostradas")
- Con Schreier–Sims (`src/core/grupo.js`) sobre los 12 giros de cara (que no mueven los centros), 2,4 s:
  - grupo de las esquinas (sus 60 pegatinas): **20!/2 · 3¹⁹** exactamente;
  - grupo de las aristas (60 pegatinas): **30!/2 · 2²⁹** exactamente;
  - grupo entero: **el producto** = 100.669.616.553.523.347.122.516.032.313.645.505.168.688.116.411.019.768.627.200.000.000.000 ≈ 1,0067·10⁶⁸.
- Cada giro es un 5-ciclo de esquinas y otro de aristas (permutaciones pares) y no cambia la suma de giros de las esquinas (mód. 3) ni la de volteos de las aristas (mód. 2); el test lo comprueba en los 48 giros. Como el conjunto de estados que cumplen esas cuatro condiciones tiene exactamente ese tamaño, **no hay ninguna otra restricción**. En particular, **las paridades de esquinas y aristas son independientes**: a diferencia del 3x3, dos esquinas y dos aristas intercambiadas a la vez **también** es imposible.
- Consecuencias en el validador: esquina girada, arista volteada, dos esquinas intercambiadas y dos aristas intercambiadas son imposibles; dos esquinas giradas en sentidos opuestos, dos aristas volteadas, un 3-ciclo y dos parejas intercambiadas son posibles (los tests los resuelven).
- Comprobación empírica: todos los scrambles pasan el validador (1000 en `npm test`) y los estados alterados fallan con su mensaje.

## Validador
En orden: 11 pegatinas de cada color (y ninguna sin pintar); centros de colores distintos; centros que sean una orientación del esquema (si no, se dice qué pareja de opuestos está mal o, si los opuestos están bien, que el orden es especular); cada esquina y arista debe existir (combinación de colores real, no especular) y aparecer una sola vez (si no: "aparece 2 veces (en … y en …) y falta la …"); y las cuatro restricciones demostradas. Los nombres de posición (p. ej. "la esquina de BL-L-DBL") son los del sistema de referencia de quien pinta.

## Cota inferior del número de Dios (`cotaInferiorConteo`)
- **48 giros de cara**, calculada aquí por conteo. Las caras no vecinas conmutan (sus capas no comparten piezas), así que cuento secuencias en **forma normal de Foata**: pasos = conjuntos de caras no vecinas entre sí (cada una con 4 giros); cada cara de un paso tiene que ser vecina de alguna del paso anterior (si no, se podría adelantar) y distinta de todas ellas (si no, se unirían). Todo estado a distancia n tiene una secuencia así de n giros, así que el menor n con N(0)+…+N(n) ≥ |G| es una cota inferior. N(1) = 48, N(2) = 1.536 (60 parejas de vecinas ordenadas + 36 de no vecinas, ·16), N(3) = 43.520; sale **48**.
- Coincide con la cifra que se suele citar para el Megaminx en esta métrica (no he encontrado la fuente original, así que la doy como calculada aquí).

## Solver (`megaminx-solver.js`, `megaminx-busqueda.js`, `megaminx-ultima.js`)

### Etapas con búsqueda
Cada etapa resuelve unas pocas piezas con IDA* usando un conjunto de caras que se va reduciendo. La idea: cuando se deja de usar una cara, las piezas que solo están en caras ya retiradas no se vuelven a mover, así que **ninguna etapa deshace las anteriores sin necesidad de protegerlas**. En las etapas finales, en las que las caras permitidas tocan piezas ya resueltas, esas piezas entran en el objetivo de la búsqueda (se protegen).

| Etapa | Caras permitidas | Piezas nuevas |
|---|---|---|
| Base 1 | todas menos D (11) | D-B, D-DBL, DBL-B, D-DBL-B |
| Base 2 | sin D, B, DBL (9) | D-DL, DBL-DL, D-DBL-DL |
| Base 3 | sin D, B, DBL, DL (8) | D-DR, DR-DL, D-DR-DL |
| Base 4 | U, anillo superior y DBR (7) | las 5 piezas que quedan de D y del anillo inferior |
| Anillo 1–3 | U + anillo superior, quitando BL, L y BR | las piezas de BL, L y BR que tocan el anillo inferior (3, 5 y 5) |
| F2L 1 | U, F, R | las 5 piezas de F que no son de U ni de R |
| F2L 2 | U, F, R | F-R, F-R-DR, R-DR (protegiendo las 5 anteriores) |
| F2L 3 | U, F, R | las 4 de R que quedan (protegiendo las 8 anteriores) |
| Última capa | — | las 10 piezas de U, con macros |

- **Tablas de poda**: para grupos de ≤ 3 piezas, distancia exacta (BFS con los giros de la etapa). Los grupos **cubren todos los pares de piezas** de la etapa (tríos solapados: 4 tablas para 5 piezas, 26 para 12): la heurística (el máximo) es mucho más fuerte que con una partición — en la etapa Base 4 bajó de ~3 millones de nodos (120 ms) a ~40.000 (4 ms). Los huecos se numeran solo dentro de la región de la etapa, así que las tablas son pequeñas: 59 tablas, **2,9 MB** en total.
- **Elegir la más corta**: (1) IDA* da la solución más corta de cada etapa con sus giros; (2) de cada etapa se sacan hasta 6 soluciones de esa longitud mínima y se queda la que deja la siguiente etapa más fácil (cota de sus tablas) o, en la última de F2L, la que deja la última capa más corta; (3) todo se hace con el puzzle visto en sus 60 orientaciones: las 3 primeras etapas en las 60 (son baratas) y, por orden de lo que han costado, se terminan tantas como quepan en el tiempo; se queda la solución más corta. Las soluciones se simplifican (giros de la misma cara separados solo por caras que conmutan con ella se unen).
- **Tiempo**: límite de 2,5 s por defecto (`tiempoMax`); siempre se termina al menos una orientación, así que siempre hay solución. Cada orientación tarda ~60–120 ms; en `npm test`, 2,6 s de media y 3,0 s como máximo.
- **Respaldo**: si una etapa pasa de su límite de nodos (4·10⁷), se parte en sub-etapas de una pieza nueva cada una (con las demás protegidas), que siempre son mucho más fáciles. El test lo fuerza con un límite de 50 nodos y comprueba que la solución sigue siendo correcta.
- **Orientaciones atascadas**: en la primera ejecución de `npm test`, 1 de 163.570 etapas llegó al límite y esa solución tardó 10,8 s (buscar hasta el límite y luego el respaldo). Ahora, cuando ya hay una solución, una orientación en la que alguna etapa pase de 2·10⁶ nodos **se abandona** (no aporta nada esperarla); solo la primera orientación que se termina usa los límites normales y el respaldo. Con eso, en los 500 casos: 0 respaldos en 170.523 etapas y 3,0 s de máximo. Además, en dos pruebas aparte de 3.000 casos cada una con una sola orientación (6.000 soluciones), ningún fallo (máximo 113 giros).
- Comprobación interna: la solución se aplica al estado del usuario y, si no lo resolviera, se devolvería un error en vez de una solución incorrecta.

### Última capa: macros encontradas por búsqueda
- **Generación** (~0,7 s): se recorren todas las secuencias canónicas de hasta 6 giros de U, F, R (449.389) y se guarda, para cada "huella" (dónde quedan las 12 piezas de F y R que no son de U), la primera secuencia p que la produce; cada secuencia c con la misma huella da la **macro p · c⁻¹**, que deja todo en su sitio salvo la última capa. (La primera versión usaba c⁻¹ · p: salían "macros" de 3 giros que no lo eran; ahora cada macro se comprueba sobre las 40 piezas que no son de U.) Se añaden sus inversas, sus imágenes especulares (R↔L, BR↔BL, con los sentidos cambiados) y todas giradas alrededor de U, y de cada efecto en la última capa se guarda la más corta: **10.765 efectos**, con macros de 1 a 12 giros.
- **Resolver**: para cada macro a de la biblioteca se busca en una tabla hash si el estado que deja es el efecto de otra macro b; la solución es a·b⁻¹, la más corta (también probando antes U, U2, U2', U'). Tarda ~6 ms.
- **Demostración (test exhaustivo en `npm test`)**: se recorren los **4.665.600** estados posibles de la última capa (5!/2 · 3⁴ · 5!/2 · 2⁴): **4.661.530** se resuelven con dos macros (calculado como conjunto de todos los a⁻¹·b) y los **4.070** restantes con una macro corta delante y dos más; el test resuelve esos 4.070 y comprueba cada solución. `test:rapido` comprueba una muestra de 1.000.
- Longitud media de la última capa: ~18 giros en un estado al azar; en el solver, ~15 (porque se elige la última etapa de F2L que la deja más corta).

### Lo que no funcionó
- **7 piezas solo con U y R** (la etapa "R" como subgrupo de dos caras, como en un F2L 2-gen): más de 3·10⁷ nodos sin terminar. Se hace con U, F, R protegiendo lo anterior.
- **Fusionar Base 2 y Base 3** (6 piezas a la vez): ahorra ~2,5 giros pero tarda ~0,7 s y a veces no termina. Sí fusioné las dos primeras (ahorra ~1,6 giros y tarda ~3 ms).
- **Macros de hasta 7 giros** (3,1 millones de secuencias): la última capa baja solo de 18,5 a 18,3 y la generación tarda varios segundos.
- **Más soluciones por etapa** (12 en vez de 6): igual longitud (más tiempo por orientación, menos orientaciones probadas).

## Interfaz
- Editor y "Resolver" activos en el Megaminx (era el último "próximamente"). Vistas **Red / Arriba (U) / Abajo (D)**: en el móvil (390 px) la red completa deja pegatinas de ~11 px; cada flor ampliada, de ~30 px.
- **Rellenar cara** (como en el NxN) y **Deshacer** (nuevo, para todos los puzzles: botón y Ctrl+Z; deshace pintar, herramientas, acciones, *Resetear* y *Cargar scramble*, hasta 200 pasos).
- Reproducción: las etapas en la barra de fases (Base 1–4, Anillo 1–3, F2L 1–3, Última capa; coloreadas por grupo), "Paso 36/90 · Anillo 3" y las letras de las caras en los centros del editor.
- Campos nuevos (opcionales) de la interfaz común: `leyendaNotacion()` (`{svg, texto}`, se muestra en un desplegable bajo las fases; abierto por defecto en pantallas anchas), `renderizar(estado, {etiquetas})` y `fases[].grupo` (clase de color de la fase).

# Noche 5 (corrección): R++ y vista previa del scramble

## Problema
En la vista previa del scramble del Megaminx, los centros cambiaban de color de un scramble a otro (siempre los 12 colores, como si el puzzle entero estuviera girado).

## Diagnóstico: las dos cosas a la vez
**(a) Que los centros se muevan es lo correcto.** Los movimientos Pochmann `R++` y `D++` giran todo el puzzle salvo una capa, así que equivalen a una rotación del puzzle entero más un giro de esa capa: tras el scramble, los centros están en otro sitio respecto a como se empezó (blanco arriba, verde delante). En un Megaminx real pasa lo mismo, y TNoodle dibuja así su imagen (no la reorienta). Comprobado en un test con 1000 scrambles: la disposición de los centros es siempre una de las 60 rotaciones rígidas del esquema (las vecinas siguen siendo vecinas y en el mismo orden). En 1000 scrambles aparecen las 60 orientaciones.

**(b) Pero además había un fallo en `R++`.** Se definía como "todo menos la capa de la cara opuesta a R (DBL), girado alrededor del eje de R". La definición de la WCA (notación de Stefan Pochmann) es **sujetar la cara L y girar todo lo demás**, 2/5 en sentido horario visto desde la derecha. En TNoodle (`MegaminxPuzzle.java`), `R` es `bigTurn(DBR)`: todo menos la capa opuesta a DBR, que es L, girado como la cara DBR. Así que nuestro `R++` giraba el bloque equivocado y alrededor del eje equivocado. Un scramble hecho en un Megaminx real no coincidía con nuestra vista previa, aunque fuera un estado válido. Ni el validador ni el solver lo notaban: un estado válido se resuelve igual. `D++` (todo menos U, visto desde abajo) y `U` sí estaban bien.
- No pude ejecutar el código de TNoodle aquí (el entorno no deja ejecutar código descargado), así que lo usé como referencia leída. De `bigTurn` (los `swapCenters` y `swapWholeFace`) saqué cómo se mueven los centros en un quinto de `R` y de `D`, y los tests comparan con eso.
- El test de `D++` contra los ciclos de TNoodle pasaba ya con el código antiguo. Eso confirma que nuestro sentido de giro y el de TNoodle coinciden, y que el fallo estaba solo en `R++`.

## Corrección
- `megaminx-geo.js`: `R++`/`R--` giran ahora las pegatinas que no son de la capa L alrededor del eje de DBR (`eje: DBR, umbral: −H`).
- Tests nuevos (`tests/megaminx-pochmann.test.mjs`):
  - Tras `R++`, las únicas pegatinas que no se mueven son la capa L y el centro de DBR (con el código antiguo eran la capa DBL y el centro de R: **el test falla con el código antiguo y pasa con el nuevo**).
  - `R++ L2'` es una rotación del puzzle entero.
  - Los centros tras `R++`, `R--`, `D++` y `D--` coinciden con los de TNoodle.
  - Rigidez de los centros en 1000 scrambles.
- **Vista previa**: después de aplicar el scramble, se aplica al estado la rotación del puzzle entero (una de las 60) que devuelve los centros a la orientación de referencia (blanco arriba, verde oscuro delante; los colores comprobados con el Megaminx físico). Solo cambia cómo se muestra: el scramble es el mismo. Es el campo opcional `estadoVistaScramble(estado)` de la interfaz común; `main.js` lo usa para la vista previa y para *Cargar scramble actual*, que carga ese mismo estado reorientado.
- **Indicación bajo la vista previa** (`notaScramble(movs)`): "Empieza con el blanco arriba y el verde oscuro delante. Al terminar, el centro blanco queda en X y el verde oscuro en Y: gira el Megaminx entero hasta poner el blanco arriba y el verde oscuro delante, y coincidirá con la imagen." X e Y se calculan para cada scramble.
- Verificación: en 1000 scrambles la vista previa tiene siempre los mismos colores de centro en las mismas posiciones. El estado reorientado pasa el validador y el solver lo resuelve en el 100 % de 1000 casos (con una orientación, para que el test no tarde). La prueba de humo comprueba la vista previa en tres scrambles, la indicación y que el editor tras *Cargar* muestra exactamente la vista previa.

# Noche 6: 5x5, 6x6 y 7x7 más cortos

## Lo que funcionó: "aristas libres" (voraz con macros que no tocan los centros)
- Con los centros resueltos, una **macro** `S · A M A⁻¹ · S⁻¹` no mueve ningún centro: S es una capa ancha o una capa interior suelta (p. ej. `Uw`, `3Rw2`, `Rw R'`), A un giro de una de las cuatro caras de alrededor del eje de S y M un giro de una de las dos caras de ese eje. Mientras S está hecho, los centros desplazados están en las caras de alrededor; `A M A⁻¹` deja esas caras como estaban (A se deshace y M no toca sus centros) y S⁻¹ los devuelve. Las wings y las aristas centrales sí se mueven. Es la idea del "freeslice" de los speedcubers, pero las macros se generan solas (con las dos caras del eje a la vez, `Uw Dw'`, también) y se comprueban sobre el cubo resuelto: 2.880 en el 5x5, 6.048 en el 6x6 y 8.496 en el 7x7 (efectos distintos sobre las aristas). Solo se usan las que no cambian la paridad de ninguna órbita de wings, para que los 3-ciclos puedan terminar.
- **Voraz**: en cada paso, un giro de cara opcional (no cambia ningún centro) más una macro: la combinación que más wings coloca por movimiento. Con **anticipación en dos niveles**: los 20 mejores candidatos se puntúan con el mejor paso siguiente sin giro de preparación (rápido) y los 5 mejores de esos, con preparación (en el 7x7, 10 y 3, porque tiene más macros). Se para cuando ya no hay ningún paso que coloque algo (umbral 0,1 wings por movimiento); lo poco que queda, con los 3-ciclos de siempre. Para evaluar rápido, cada macro guarda qué comparaciones de pegatinas cambia y con qué índices.
- **Objetivo**: en N impar, cada wing con la arista central de su ranura (como antes). En N par no hay central: cada wing se compara con la de al lado hacia el centro de su arista y las dos del medio entre sí; una ranura está hecha cuando todas sus wings muestran los mismos colores. Al acabar el voraz se **asigna** a cada ranura la arista entera que ya tiene más wings en ella (con un número par de volteos, para que sea un 3x3 posible) y los 3-ciclos terminan esa asignación. La paridad PLL se decide entonces con la permutación de la asignación (si no coincide con la de las esquinas, el intercambio de UF y UB de siempre).
- Evolución en el 5x5 (10 casos, aristas): 3-ciclos 100,8 → voraz sin anticipación (umbral 0,34) 72,5 → umbral 0,1 57,9 → con anticipación y 3x3 a 18: 53,4. En el 6x6, el objetivo relativo (en vez de llevar cada wing a su sitio) bajó las aristas de 159,5 a 92,3.

## Otros ajustes que sí ayudaron
- **3x3 final**: objetivo 18 movimientos con hasta 1,2 s (antes 20 y 0,4 s) en 5x5–7x7: −1,2 movimientos de media. (El 4x4 sigue igual.)
- **Conmutadores dobles más largos** (6x6 y 7x7): se guardan los que miden hasta 2 movimientos más que el más corto de cada pareja de órbitas (antes, solo el más corto): oblicuos −2,7 en el 6x6.
- **Voraz de 3-ciclos de centros**: evalúa con el coste real (contando lo que se simplifica) los 48 mejores candidatos en vez de 24: −1,9 en el 6x6.
- **Límite de tiempo** (`tiempoMax`, 10 s por defecto): si los centros ya han tardado más de la mitad, el voraz de aristas no anticipa, y el 3x3 usa como mucho el tiempo que quede (mínimo 150 ms). En el 4x4, el segundo intento de la reducción por búsqueda se salta si ya se ha ido el 60 % del presupuesto (si no, el método de respaldo). Lo probé primero con el 30 %: el peor caso bajaba a 5 s pero la media subía de 54,8 a 59,2 (muchos más casos acababan en el respaldo), así que lo dejé en el 60 %, que en la práctica no cambia nada (54,8, máximo 13,3 s). Siempre se devuelve una solución completa.

## Lo que no funcionó (no lo repitas)
- **Aristas del 5x5 por fases tipo dominó con los centros resueltos** (la idea del 4x4 de Tsai/TPR y del 5x5 de cs0x7f): A) cada wing a su "mitad" (12+12, las órbitas del grupo de la fase B; la mitad de cada wing depende de la orientación de su arista central, así que no hace falta orientar las centrales), con U D F B, medias vueltas, `Uw`/`Fw`… a 90° y `Rw R'` a 90°; B) las piezas de 4 aristas al ecuador con U D F B, R2 L2 y capas anchas a 180°; C) emparejar en el grupo "dominó" (U D, medias vueltas). Tablas exactas: máscara de mitades (C(24,12) = 2,7 millones), parejas de máscaras del ecuador (495²) y permutaciones relativas wings-centrales (8!·4!, tres tablas). Las aristas solas salen muy bien (A ≈ 7, B ≈ 10, C ≈ 12 movimientos, en milisegundos), pero **con los centros no termina**: la fase A con los centros en X tiene que dejarlos en su pareja de caras y en 3·10⁷ nodos no encuentra nada en 18 de 20 casos (sin los centros en X, 7 movimientos al momento). No es una restricción: Schreier–Sims da que, en el grupo de la fase A, wings y centros en X son producto directo (24!·24!); es que la heurística del máximo de tablas separadas es muy floja cuando una parte ya está resuelta y la otra no. La fase C (dominó) con centros tampoco: desde estados aleatorios del grupo, a 5·10⁶ nodos falla en 4 de 6, también con la heurística inflada (×1,5, ×2) o sumando parte de la de los centros. Separarla (C1 emparejar ignorando los centros, C2 centros con macros que no deshacen el emparejamiento) tampoco: C2 no termina nunca (el grupo dominó acopla las paridades de aristas y centros: el orden del grupo es 64 veces menor que el producto de sus proyecciones). Con alfabetos de macros que no mueven los centros (414, 210 y 94 macros de hasta 5 movimientos) la búsqueda es exacta para las aristas pero la cota queda muy por debajo (una macro de 5 movimientos avanza como 1–2) y no termina en ninguna fase. El solver de cs0x7f resuelve esto con centros y aristas a la vez y ~230 MB de tablas, fuera del límite de 100 MB.
- **Dejar que las fases de aristas estropeen los centros y arreglarlos después con 3-ciclos**: 20–34 pegatinas de centro descolocadas al acabar, demasiado caro.
- En el voraz de aristas: **preparación de dos giros** (peor que la anticipación: 89,6 frente a 85,4 en el 6x6, y 14 veces más lento) y **anticipación solo sin preparación** (rápida, pero +5 movimientos en el 6x6).
- En los centros del 6x6: elegir, entre 24 soluciones de la última etapa de búsqueda, la que deja más oblicuos ya en su cara (−1,2 en 16 casos: ruido); probar las tres rotaciones del cubo y quedarse con la más corta (−2,6 en centros pero +4,4 en aristas: ruido, y el doble de tiempo); anticipación en el voraz de 3-ciclos de centros (peor); preparación de dos giros en los conmutadores dobles (peor).
- Evitar la paridad PLL del 6x6 cambiando la asignación de dos ranuras: al acabar el voraz todas las ranuras están formadas y cambiar dos cuesta más que el algoritmo de paridad (queda en el código, con un límite de 2 wings perdidas, pero casi nunca se usa).

## Tests más rápidos
- Los tests largos del solver (4x4–7x7 y Megaminx) reparten los casos entre **worker_threads** (`tests/paralelo.mjs`, `tests/trabajador.mjs`): los scrambles se generan y las soluciones se comprueban en el hilo principal, y cada hilo genera sus tablas una vez y resuelve los casos que se le van dando. Hilos: los núcleos disponibles (o `HILOS=n`).
- `node --test --test-concurrency=1`: un fichero de tests a la vez, para que los hilos no compitan por los núcleos. Varios solvers tienen límites de tiempo (la reducción del 4x4, el Megaminx, el 3x3 final): con más hilos que núcleos darían soluciones más largas en el test que en la app.
- No he cacheado tablas entre ficheros: cada fichero es un proceso y generarlas cuesta segundos, frente a minutos de resolver.

# Noche 7: vista 3D

## Sin three.js: un dibujo WebGL propio (~350 líneas)
- three.js tiene licencia MIT (se podría empaquetar), pero aquí no hace falta: todos los puzzles son polígonos planos de colores lisos, sin texturas ni modelos. Con un solo shader (WebGL 1) y dos matrices uniformes para las capas que giran, la vista entera ocupa ~23 KB en el HTML (la app pasa de 320 a 345 KB); three.js, incluso sin lo que no se usa, serían varios cientos de KB. Tampoco hay que vigilar versiones ni cambios de su API. Funciona igual sin conexión: no se carga nada de fuera (las fuentes de Google que ya había son opcionales; sin conexión se usan las del sistema).
- **WebGL 1**, no 2: lo tiene cualquier móvil; no hace falta nada de WebGL 2.
- Se dibuja **solo cuando algo cambia** (animación, arrastre, estado nuevo), no en un bucle continuo: en el móvil no gasta batería con el puzzle quieto.
- **Si no hay WebGL** (o se pierde el contexto): los botones 2D/3D se ocultan, aparece "3D no disponible…" y todo va en 2D (la prueba de humo con jsdom, que no tiene WebGL, lo comprueba).

## La geometría la da cada puzzle; la vista es genérica
- Dos métodos nuevos en la interfaz común: `vista3D(estado)` (pegatinas como polígonos 3D, con su normal, su pieza y el índice que entiende el editor) y `giro3D(estado, mov)` (partes que giran: eje, ángulo, pegatinas). Detalles en ARQUITECTURA.md.
- La animación gira las pegatinas del estado de antes y, al acabar, la vista pasa a mostrar el estado siguiente del modelo. Para que eso no se note, la regla de la interfaz es que **girar del todo las pegatinas de `giro3D` dé exactamente `vista3D` del estado siguiente** (posiciones y colores). Lo comprueba un test para todos los movimientos de todos los puzzles; si el sentido de un giro estuviera al revés, o faltara una pegatina, el test falla (lo probé a propósito).
- Cubos, Pyraminx, Skewb y Megaminx usan **la misma geometría con la que ya se calculaban las permutaciones** (posiciones de las pegatinas del NxN; caras + planos de corte del motor geométrico). Así la vista 3D no puede contradecir al modelo: no hay una segunda descripción a mano.
- **Square-1**: la forma cambia con el estado, así que su `vista3D` construye la geometría en cada estado. Las casillas de 30° están en el mismo sitio que en el dibujo 2D (el frente en el ángulo de casilla 15°) en las dos capas, y "/" es un giro de 180° alrededor del eje horizontal perpendicular al corte: con eso, la casilla k de arriba va a la 5−k de abajo, que es justo lo que hace el modelo (lo comprueba el test en cientos de "/" desde formas de todo tipo). La capa del medio tiene el corte según 12c1 (la superficie pequeña a la izquierda del frente) y su mitad derecha aparece volteada cuando `medio = 1`. Las piezas no son "cuñas dentro de un cubo": cada pieza conserva su forma, así que en las formas que no son cubo sobresalen, como en el puzzle real.
- **Piezas para resaltar**: en los puzzles de geometría fija, una pieza = las pegatinas que están al mismo lado de todos los planos de corte (sale sola: 26 piezas en el 3x3, 62 en el Megaminx, 218 en el 7x7…); en el Square-1, las piezas de su estado. Modos: **brillo** (el resto se oscurece y pierde color) y **transparencia** (el resto casi transparente, dibujado en una segunda pasada sin escribir profundidad).

## Megaminx: el scramble animado acaba en la orientación de referencia
- Los movimientos Pochmann giran casi todo el puzzle; se animan tal cual (`R++` = todo menos la capa L, 144° alrededor del eje de DBR). Al acabar el último, el **puzzle entero gira** (animado) hasta la orientación de referencia, y así coincide con la vista previa fija (blanco arriba, verde oscuro delante) y con la nota de cómo sujetarlo. `reorientar3D` da ese giro: se buscan las 60 rotaciones como matrices (cierre de dos generadores) con su eje y ángulo, y se elige la que deja los centros en su sitio (la misma que usa `estadoVistaScramble`; un test comprueba que llevan al mismo estado).
- Pensé en animar el scramble ya en la orientación de referencia (allí `R++` equivale a `L2`, `D++` a `U2`), pero se vería girar otra cara distinta de la que gira la mano: confunde más.
- Durante la solución, en 3D también salen las **letras de las caras** sobre sus centros (como en 2D), en HTML encima del lienzo, y solo las de las caras que miran hacia ti.

## Interfaz
- **Vista previa**: en 3D por defecto, con su propio reproductor (⇤ resuelto, ‹ ›, ▶, ⇥, velocidad). Empieza en el scramble ya aplicado, como antes. En 2D el reproductor también funciona (sin animación).
- **Editor**: sigue en la red 2D para pintar (es lo más cómodo para ver todas las caras a la vez); al aparecer una solución pasa a 3D. Los dos se recuerdan por separado (`localStorage`): si quitas el 3D durante una solución, la siguiente también saldrá en 2D. Con el editor en 3D se puede **pintar tocando el modelo** (también con las herramientas: rellenar cara, mover piezas del Square-1 —la primera pieza tocada se resalta—, voltear la capa del medio). Tocar sin arrastrar pinta; arrastrar más de 5 px gira.
- La velocidad (×1…×8) es la misma para el scramble y la solución: un giro dura 420 ms / velocidad, con 70 ms / velocidad de pausa entre giros. Paso atrás = el giro al revés, animado. Si se pulsa › varias veces seguidas, cada animación pendiente se acaba al momento para no ir por detrás.
- Al girar el puzzle con el dedo, la página no hace scroll sobre el lienzo (`touch-action: none`); fuera de él, sí.
- `window.cuboSolver` da acceso a las vistas 3D (para el modo aprender de la noche siguiente y para las comprobaciones en Chromium).

## Comprobación en Chromium
- `scripts/comprobar-3d.py` (Python + Playwright; no es parte de `npm test` porque necesita Chrome): cuatro configuraciones (escritorio 1280 px y móvil 390 px con pantalla ×3 y táctil; tema claro y oscuro) × diez puzzles: scramble animado, cargar, resolver, solución animada hasta el final a ×8, paso atrás y adelante, resaltar una pieza, pintar tocando el modelo. Mide los FPS de las animaciones y guarda capturas en `docs/capturas/`.
- Aquí Chrome dibuja WebGL por software (SwiftShader, 2 núcleos, sin GPU), así que es un caso más lento que un móvil real.

# Corrección (noche 7): cambio de puzzle y scrambles precargados

## El problema
`seleccionar` cambiaba el panel de resolver al momento, pero el scramble se pedía después de `asegurarTablas()`: con un puzzle de tablas grandes (7x7: ~8 s), el panel del scramble seguía enseñando el puzzle anterior (y la etiqueta ya decía la del nuevo). Además, mientras había algo en marcha (`st.ocupado`), los clics en otro puzzle se ignoraban.

## Decisiones
- **El scramble no espera a las tablas del solver.** Los scrambles de 4x4–7x7 y Megaminx no necesitan tablas; los de estado aleatorio generan las suyas dentro de `generarScramble` (0,1–1,2 s la primera vez). Las del solver se piden después, en el Worker principal.
- **Dos Workers** (principal y de fondo) en vez de uno con prioridades: un Worker no se puede interrumpir, así que con uno solo una precarga en marcha (hasta ~1 s) retrasaría lo que pide el usuario, y las tablas del 7x7 (~8 s) retrasarían cualquier scramble. Las tablas de los scrambles de estado aleatorio pueden acabar en los dos Workers (unos pocos MB más); las del solver solo en el principal.
- **Cola en el hilo principal, una tarea por Worker**: así una petición del usuario solo puede esperar a la tarea que ya está en marcha, nunca a una cola de precargas.
- **Orden de las precargas**: por `costeScramble` (medido aquí: 0 en 4x4–7x7 y Megaminx, Skewb ~100 ms, Pyraminx ~230, 2x2 ~280, 3x3 ~800, Square-1 ~1.200).
- **Móvil**: lo que pedía la tarea ("no precargar las tablas grandes del 6x6/7x7") se cumple siempre, también en el ordenador: las precargas son solo scrambles, y los del 6x6/7x7 no necesitan tablas. Además, en el móvil no se precargan los scrambles de más de 500 ms (Square-1, 3x3) hasta que el usuario elige ese puzzle.
- **Sin Worker** (hilo principal) solo se precargan los que no necesitan tablas, para no bloquear la página sin que el usuario lo pida.
- **Respuesta obsoleta de un scramble**: no se muestra, pero se guarda como precargada (si ese puzzle no tenía ya una). Las de "Resolver" obsoletas se descartan (`st.sel`), aunque se haya vuelto al mismo puzzle: el editor ya no es el mismo.
- **"Nuevo scramble" mientras se genera otro del mismo puzzle**: no se pide otro; se espera al que está en camino.
- **Textos**: descripciones del panel "Resolver" con los métodos actuales (4x4 en tres fases sin paridades, 5x5–7x7 con centros por búsqueda y aristas con macros, Square-1 en dos fases, Megaminx con longitudes y tiempos) y avisos de tablas ("Generando las tablas de la reducción del 4x4…", "…de centros y las macros de aristas del 5x5…" en vez de "Preparando los conmutadores").

# Noche 8: modo aprender

## Alcance
- Prioridad pedida: 3x3 > 2x2 > 4x4–5x5 > el resto, y "mejor pocos puzzles muy bien explicados que todos a medias". Hecho: **3x3** (principiantes y CFOP), **2x2** (principiantes y Ortega) y **4x4** (reducción, con el 3x3 por capas o CFOP). **No hecho**: 5x5 (ver abajo), Pyraminx, Skewb, Square-1 y Megaminx; el selector solo aparece en los puzzles que tienen modo aprender.
- 5x5: probé el mismo método de los centros del 4x4 (de pieza en pieza con macros) y no encuentra cómo seguir a partir de unas cuantas piezas del primer centro: con centros en X y en cruz a la vez, las macros de tres pasos no bastan y con cuatro la búsqueda es demasiado grande. Haría falta tratar las dos órbitas por separado (como en el solver por ordenador) con macros propias; lo dejo para otra noche antes que dejarlo a medias.

## Cómo se genera una solución "humana"
- No es la solución óptima recortada: cada etapa se resuelve como la resolvería una persona que sigue el método, y así se explica.
  - **Recetas** donde el método es una receta (principiantes): girar el cubo para tener el hueco delante a la derecha, poner la esquina encima, repetir R U R' U' hasta que baje bien; las aristas de la segunda capa con el algoritmo de la derecha o el de la izquierda según su color de arriba; si una pieza está atascada en otro hueco, se saca primero.
  - **Búsqueda** donde una persona "piensa" (cruz, parejas de F2L, cara del Ortega): la más corta con los giros que usaría. La cruz de CFOP se planea entera (≤ 8 giros, como en competición); la de principiantes, arista a arista, empezando por la más cercana. F2L: para cada pareja pendiente se gira el cubo (`y`) para tener su hueco delante a la derecha y se busca con R y U; con R, U y F solo si sale más corto. Se elige la pareja más corta (cada rotación cuenta medio giro al comparar). Si una pieza está atascada en un hueco que no es el suyo, se saca con R U R'.
  - **Algoritmos** en la última capa: búsqueda de coste uniforme sobre "ajuste de U + algoritmo (+ ajuste)", de modo que sale el caso con su algoritmo, como lo haría alguien que se los sabe.
- **Rotaciones**: el método sujeta el cubo con el blanco abajo (`z2` desde la orientación de referencia) y gira el cubo entero (`y`) para trabajar delante a la derecha. Para que eso se vea y se anime, los NxN entienden ahora `x`, `y`, `z` (con `'` y `2`). Las rotaciones no cuentan como giros en la longitud (se muestran aparte).
- **Marco del 2x2**: no tiene centros; se elige una esquina blanca de referencia (la que menos rotación necesita), se deja abajo con el blanco hacia abajo y sus colores dicen qué color va en cada lado. En el Ortega se elige el lado en el que la cara blanca sale más corta.

## Algoritmos
- Escritos a mano (los estándar de la comunidad, en notación WCA y sin `M`: `M = Rw' R`). Al cargar se comprueba cada uno: que respete las dos primeras capas y, en las PLL, que su efecto sea de su familia (U, H, Z, A, E, G, N; T/F, J/R y V/Y se distinguen solo por nombre). Un algoritmo que no pase se descarta (de las 61 OLL escritas se descarta una, una variante de la OLL 20 mal recordada; el caso lo cubre otra). Los tests comprueban que las OLL resuelven en un algoritmo los **216** casos de orientación y las PLL los **288** de permutación.
- **Nombres**: PLL con su nombre (T-perm, Ua…). En las OLL solo pongo número donde es inequívoco (21–27, la OCLL, y la 45); en el resto el texto describe el caso calculado ("dos aristas en L, 0 esquinas con el amarillo arriba") y dice "el algoritmo de OLL para este caso". Prefiero eso a arriesgarme a poner un número equivocado.
- Los textos de los casos (cuántas aristas/esquinas orientadas, qué piezas hay que intercambiar, si hay "faros") se calculan del estado real, no de una tabla escrita a mano, para que no puedan contradecir lo que se ve.
- 2x2: la OLL del Ortega usa los siete casos de la OCLL con versiones sin capas anchas (en el 2x2 una capa ancha es girar el cubo entero). PBL: T-perm, Y-perm, R2 F2 R2, doble contigua, contigua+diagonal en los dos sentidos, y las de solo abajo como T-perm o Y-perm entre `x2 … x2`; se comprueba que respeten las caras blanca y amarilla.

## 4x4
- Centros: el blanco abajo (donde ya haya más piezas blancas), el amarillo arriba con conmutadores tipo `Rw U Rw'` sin romper el blanco, y los cuatro de los lados en el orden que marcan las esquinas (verde, naranja, azul y rojo alrededor, con el blanco abajo), eligiendo el giro de ese orden que más piezas tenga ya bien. Los cuatro últimos, en dos pasos exactos con giros que no tocan los centros de arriba y abajo (F, R, B, L, Uw, Dw): separar los colores por parejas de caras opuestas y luego cada color a su cara. Con el método de pieza en pieza de los otros centros la búsqueda se quedaba sin salida.
- Aristas: de una en una (o dos) con `Uw' R U R' F R' F' R Uw` y `Dw R F' U R' F Dw'` (y sus simétricos) más giros de cara para colocar las piezas; los algoritmos se comprueban: no mueven los centros.
- Paridades (se detectan en el 3x3 virtual): **OLL** si hay un número impar de aristas volteadas (`Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'`, tras las dos primeras capas); **PLL** si esquinas y aristas tienen distinta paridad (`r2 U2 r2 Uw2 r2 Uw2` con `r` = la capa interior, en WCA `Rw2 R2 U2 Rw2 R2 Uw2 Rw2 R2 Uw2`, tras orientar). La versión con `Rw2` (dos capas) rompe los centros; está comprobado.
- Longitudes en OBTM, como el resto del 4x4 (una capa interior suelta cuenta 2).

# Noche 9: primer "Resolver", modo aprender en más puzzles y números de las OLL

## Corrección: el primer "Resolver" tras cargar la página no hacía nada
- **Causa (reproducida en Chromium real con la caché vacía, clic en *Resolver* nada más cargar)**: el puzzle inicial se elegía en `motor.listo.then(() => seleccionar(inicial))`, es decir, cuando los dos Workers respondían al ping. Eso tarda ~1 s en Chromium de escritorio y ~1,6 s con la CPU a ×4 (más en un móvil de verdad). Durante ese tiempo la página ya se veía con los botones activos, pero `st.p` era `null`: el clic en *Resolver* llamaba a `resolver()`, que hacía `puedeResolver(null)` y lanzaba un `TypeError` dentro de una promesa (en la consola, "Cannot read properties of null (reading 'capacidades')"); en pantalla, nada. El segundo clic, ya con el puzzle elegido, funcionaba. Con *Cargar scramble* pasaba lo mismo.
- **Corrección**:
  - El puzzle inicial se elige al momento, sin esperar al ping: las peticiones esperan en la cola del motor (el ping va primero a cada Worker) y, si un Worker no arranca, lo pendiente se rehace en el otro o en el hilo principal, como antes. Las precargas de los demás puzzles sí esperan a `motor.listo` (sin Worker solo se precargan las baratas, y hasta el ping no se sabe).
  - *Resetear*, *Cargar*, *Resolver*, *Nuevo scramble* y *Copiar* empiezan desactivados en el HTML (entre que se pinta la página y se ejecuta el script no hacen nada, y ahora se ve).
  - `resolver()` ya no puede perder un clic: sin puzzle, ocupado o sin solucionador dice por qué; todo lo demás va dentro del `try`.
  - Si las tablas no están, el clic espera a ellas con el mensaje **"Generando tablas… X s · la solución aparecerá al terminar."** (el tiempo cuenta desde que empezaron a generarse) y la solución aparece sola al terminar. `asegurarTablas` se comparte: un único aviso con su reloj aunque se llame desde la selección y desde *Resolver* (antes, dos relojes escribían en el mismo aviso).
- **Tests** (`tests/app.test.mjs`, Worker simulado con el ping a 1,5 s y las tablas a 1,2 s): un solo clic nada más cargar → "Generando tablas… X s" → "ya está resuelto", una sola petición de tablas y de resolver; y con un scramble cargado mientras se generan las tablas. Con el código antiguo fallan los dos (el segundo con el mismo `TypeError`).

## 5x5: los centros en X y en cruz por separado
- Cada centro del 5x5 tiene 4 piezas en X, 4 en cruz y la del medio (fija con los giros que se usan). Orden: **centro blanco: X**, **centro blanco: cruz**, **centro amarillo: X**, **centro amarillo: cruz**, **últimos cuatro centros: X**, **últimos cuatro centros: cruz**. El color de cada cara lo marca su pieza del medio.
- **Una propiedad que lo condiciona todo (comprobada con BFS)**: con la X de una cara ya hecha, los giros de caras y de las capas del medio mueven las piezas en cruz **de dos en dos**: las dos de lados opuestos de una cara viajan siempre juntas (un giro de cara las lleva a otra pareja opuesta; una capa del medio las cambia de cara a la vez). Para separarlas hace falta una capa interior (la de la X), y para que la X vuelva a su sitio, un conmutador **[capa interior, capa del medio]**, p. ej. `Uw U' 3Rw Rw' 3Rw Rw' U Uw' Rw 3Rw' Rw 3Rw'` (u M2 u' M2). Por eso los primeros intentos (macros de una capa) se quedaban sin salida con 2–3 piezas por poner. Se generan solos al iniciar y solo se quedan los que no mueven ninguna X ni pieza del medio.
- **Los dos primeros centros, de forma exacta**: el estado de cada parte es solo en qué casillas están las cuatro piezas de ese color (C(24,4) = 10.626 estados como mucho); con las macros que no sacan nada de lo ya hecho se busca la secuencia más corta (Dijkstra por movimientos) y se explica pieza a pieza. Antes, una búsqueda de macros pieza a pieza tardaba ~6 s en el centro amarillo (y en algún caso no terminaba).
- **Últimos cuatro centros**: la X como los centros del 4x4 (dos pasos con tablas de 2¹⁶: separar colores por parejas de caras opuestas y luego cada uno a su cara, con F R B L Uw Dw); la cruz igual, pero con giros de F R B L, conjugados de la capa del medio horizontal (`3Uw Uw' R Uw 3Uw'`) y los conmutadores de antes que solo tocan la cruz de los lados (separar: 52 operaciones; cada color a su cara: las 28 que no mezclan delante/detrás con derecha/izquierda). Se comprobó que las 12.870 separaciones y los 4.900 estados del segundo paso son alcanzables. Las tablas se calculan hacia atrás desde el objetivo con las inversas de las macros (los conmutadores no tienen su inversa en la lista).
- **Aristas (tredges)**: como una persona: se gira el cubo para tener a la izquierda (FL) una arista incompleta y se trabaja en ella hasta completarla; con giros de R, U, B y D (que no la tocan) se lleva la pieza que falta a la derecha y se hace `Uw' R U R' F R' F' R Uw` o sus variantes (en el 5x5, este algoritmo cambia la pieza de la fila 1 de FL por la de la fila 3 de FR). Elegir "lo que más parejas junta" en todo el cubo (el voraz del 4x4) se quedaba atascado: en el 5x5 la pieza que falta suele estar emparejada con otra pieza del medio, y moverla no sube el total.
- **Paridad de aristas del 5x5**: `r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2` con r y l solo la segunda capa (en WCA, `Rw R'`): cambia entre sí las dos piezas de los lados de la arista UF y nada más (comprobado: 4 pegatinas de arista, ningún centro). La versión con `Rw` de dos capas (la del 4x4) rompe los centros del 5x5. Sale en ~60 % de los casos.
- **Fallo encontrado y corregido**: en `datosNxN`, las pegatinas de los dos lados de cada arista iban en el orden de su cara, que en algunas aristas es el contrario. En el 4x4 daba igual (dos piezas); en el 5x5 se contaban parejas de piezas distintas. Ahora `a[j]` y `b[j]` son siempre de la misma pieza (se emparejan por la posición 3D de su pieza).

## Pyraminx
- Por capas, con la cara de abajo como primera capa: puntas (u, l, r, b; cada una como la pieza central de debajo, comprobado por pegatinas), centros (L, R, B con el color de abajo abajo), las tres aristas de abajo de una en una (la secuencia más corta con U, L, R, B que la mete sin romper lo hecho: R' U' R y parecidas) y la última capa con dos algoritmos escritos a mano y comprobados al cargar: **ciclo de tres aristas** (`R U R' U R U R'` y sus variantes) y **voltear dos aristas** (`R' L R L' U L' U' L` y variantes), más el giro final de U.
- Se trabaja con los colores normalizados del validador (sirve con el puzzle sujeto de cualquier manera) y los textos usan los colores reales.

## Skewb
- **La primera capa es la de arriba**: con la notación WCA (R, U, L, B = los vértices DRB, ULB, DLF y DBL) la esquina URF no se mueve nunca. Los conmutadores de cuatro movimientos ("sledgehammer") que respetan una capa son `R' B R B'`, `L B' L' B` y sus inversos, y la capa que respetan es la de arriba (la de URF). Así que se hace primero la capa de arriba (su esquina URF ya está) y la última capa es la de abajo. Sin rotaciones del puzzle entero (el modelo del Skewb no las tiene) es lo natural; los textos lo explican.
- **Orden: primera capa → esquinas de la última capa → centros**. La tarea decía "primera capa, centros de la última, esquinas"; seguí el orden de los métodos de principiantes habituales porque los algoritmos de centros que no mueven esquinas son los que se enseñan (y cierran el método), mientras que colocar esquinas sin tocar unos centros ya hechos necesita algoritmos que no se enseñan a principiantes.
- Primera capa pieza a pieza (la secuencia más corta que añade una esquina sin romper lo hecho); esquinas de abajo con combinaciones de sledgehammers (orientar y, si hace falta, colocar); centros con la secuencia más corta del solver óptimo desde ese estado (un algoritmo de centros: las esquinas salen y vuelven). El caso de centros se describe con sus ciclos (tres en ciclo, dos parejas, cinco en ciclo).

## Square-1
- Etapas: **forma de cubo** (ignorando la paridad), **orientar esquinas**, **orientar aristas**, **permutar esquinas** (y la capa del medio), **paridad** si hace falta, **permutar aristas** y el giro final.
- Forma de cubo: BFS sobre clases de forma (las máscaras de arriba y abajo salvo giros, 322²) con la distancia en barras; en cada paso, el giro más pequeño que acerca una barra. El texto dice cuántas esquinas hay arriba y abajo y cuántas barras faltan.
- En forma de cubo se usan las coordenadas y los generadores de la fase 2 del solver ((3,0), (0,3) y "/" en las dos alineaciones que conservan el cubo) y una IDA* propia con objetivo por etapa: orientación con tablas exactas nuevas (70 y 4.900 estados), permutación de esquinas con la tabla A del solver (esquinas × aristas de arriba × medio, exacta) y de aristas con las dos.
- **Paridad**: en forma de cubo solo se puede terminar si la paridad del estado es la del marco (la misma comprobación que usa la fase 1 del solver); si no, hace falta salir de la forma de cubo. El algoritmo de paridad lo calcula el propio solver al iniciar: la inversa de la solución del estado "resuelto con las aristas de delante y detrás de arriba cambiadas" (14 barras); intercambia esas dos aristas y deja todo lo demás. No es uno de los de memoria de la comunidad, pero hace lo mismo y está comprobado.
- El estado del Square-1 no es una lista de pegatinas, así que no se resaltan piezas (la interfaz ya lo admitía: bloques sin `piezas`).

## Números de las OLL
- Antes solo tenían número 21–27 y 45. Ahora las 57, comprobadas: `tests/oll-numeros.test.mjs` lleva dos referencias con un algoritmo por número (A: solvethecube.com, que sigue la numeración del wiki de speedsolving.com; B: zeroplay.io, el wiki de speedsolving.com, cubefreak.net, ca.speedcube.com.au y r/Cubers), calcula el **caso** de cada una aplicando su inversa a un cubo resuelto (qué pegatinas de la capa de arriba tienen el color de arriba, salvo el giro de U) y comprueba que las dos referencias coinciden en los 57 números y que son 57 casos distintos. Después, que cada algoritmo de `algoritmos.js` resuelve el caso de su número.
- Lo que salió al comparar: en zeroplay.io la "OLL 20" es en realidad la 28 (se tomó la 20 del wiki de speedsolving.com), y zeroplay llama 26 a la Sune y 27 a la Antisune, al revés que el wiki y que cubefreak (aquí, como el wiki: 26 Antisune, 27 Sune). Y la variante de OLL 20 que se descartaba al cargar no era una OLL: ahora es `Rw U R' U' Rw2 R2 U R U' R' U' Rw R'` (r U R' U' M2 U R U' R' U' M'), así que pasan las 61 y los 216 casos de orientación se resuelven con **un solo** algoritmo (el test lo comprueba así; antes admitía dos macros).
- Los textos siguen describiendo el caso (aristas en L, esquinas…) y ahora dicen el número: "Algoritmo: OLL 33".

## No hecho: Megaminx, 6x6 y 7x7
- Megaminx por capas (estrella, primera capa, segunda… como un 3x3 extendido) necesita búsquedas pieza a pieza con muchas piezas protegidas (el motor de etapas del solver crea tablas por grupos de tres piezas y crece con el número de piezas que hay que respetar) y algoritmos de última capa propios. Empezarlo a estas alturas de la noche era dejarlo a medias; prioricé terminar y comprobar bien los otros cuatro y la corrección.
- 6x6 y 7x7: además de lo del 5x5 hacen falta los centros oblicuos, que son lo más difícil también para el solver por ordenador. Quedan para otra noche.

# Noche 10: 3x3 vendado (bloqueos definidos por el usuario)

## Modelo genérico: una capa sobre la interfaz común
- `puzzleConBloqueos(puzzle, bloques)` (en `src/core/bloqueos.js`) devuelve otro puzzle con la misma interfaz. La capa no sabe de cubos: el puzzle aporta un `soporteBloqueos` (piezas como conjuntos de puntos, a dónde va cada punto con cada giro y qué posiciones mueve cada giro). La regla es siempre la misma, sin casos especiales: un giro es legal si, para cada bloque, mueve todas sus piezas o ninguna. Se ha probado con el 2x2 (`soporteBloqueosNxN(2)`) sin tocar la capa.
- El estado sigue siendo el de colores del 3x3: las piezas se identifican por sus colores (todas son distintas), así que el editor, el validador y el dibujo de siempre sirven. Lo único que no es genérico es esto: en un 4x4 hay piezas iguales (centros, wings) y habría que llevar su identidad en el estado.
- **Núcleo**: el 3x3 tiene un punto sin pegatina para el núcleo (está en las tres capas centrales y en ninguna de cara). Hace falta para importar las firmas de la comunidad, que unen centros con el núcleo (un centro unido al núcleo es una cara bloqueada). En la interfaz no se puede tocar (no se ve); si un bloque importado lo lleva, aparece como "núcleo" en su lista.

## Giros: M, E, S y rotaciones
- `aplicarMovimiento` acepta los giros de cara, M/E/S (notación WCA: M como L, E como D, S como F) y x/y/z, y lanza un error con un giro ilegal ("rompería el bloque UFR+UF"). Las rotaciones son libres (mueven todos los bloques enteros).
- Los scrambles y las soluciones usan solo los 18 giros de cara. No se pierde nada: **M es legal ⇔ R y L son legales** (un bloque que impide M tiene piezas en la capa del medio y en la de R o la de L, así que también impide R o L; y si R y L son legales, ningún bloque cruza las fronteras R|M ni M|L, así que M lo es), y M = R L' x' (salvo rotación, que es libre). En la métrica de la WCA (OBTM), M cuenta 2, igual que R L'.
- Como las capas centrales mueven los centros, el estado puede estar girado; para buscar se normaliza con la rotación que deja los centros en su sitio y la solución se traduce al marco del usuario (test "capas centrales y rotaciones").

## Validación de la configuración
- Un bloque tiene que ser **conexo por caras** en el cubo resuelto (cubies que comparten una cara: la esquina UFR y el centro U no lo son, solo se tocan en una arista del cubie).
- **Centros opuestos**: se permiten (decisión de Óscar, cambiando lo que decía la especificación). Existen cubos reales así, a través del núcleo o de aristas: la firma 1680008C2FB461, el Bandaged Cube de Meffert, tiene un bloque L + DL + D + DR + R + núcleo, y la app da exactamente las cifras publicadas en el foro de twistypuzzles: 32 formas y 58.320 permutaciones (1.866.240 estados). La regla general (mover todas las piezas del bloque o ninguna) ya basta para que se comporte bien; con L y R en el mismo bloque, por ejemplo, L, R, D, M y E son ilegales y S es legal.
- Totalmente bloqueado: ningún giro legal en el resuelto. Muy limitado: un tercio de los giros o menos en el resuelto, o menos de 100.000 estados; el aviso dice cuántas geometrías y cuántos estados.

## Geometría y estados alcanzables
- **Geometría** = dónde está cada bloque y con qué orientación (las posiciones de sus piezas, en orden), sin las piezas sueltas y sin distinguir bloques congruentes (misma forma por una rotación del cubo): las tuplas de los bloques de una misma clase se ordenan. La legalidad depende solo de la geometría.
- Las firmas de twistypuzzles cuentan "formas" sin orientación: en el *Most signatures* (10840080200C21) salen exactamente el doble (184.352 = 2 · 92.176) porque sus barras 1x1x3 son simétricas por un giro de 180° y aquí cuenta la orientación, como pide la especificación. En el CAB Cube (sin bloques simétricos) coincide: 15.704.
- **Estados = |geometrías| · |grupo de la fase 2|**. El puzzle entero no es un grupo (no se puede componer cualquier secuencia con cualquier otra), pero las secuencias que salen de la geometría resuelta y vuelven a ella sí lo son (el grupo de vértice del grupoide). Se genera con los lazos camino(u) · m · camino(v)⁻¹ de las aristas del BFS de geometrías que no están en el árbol, y se cuenta con Schreier–Sims (`schreier.js`). Para cada geometría g, el camino del árbol hasta g es una biyección entre los estados de g y los de la resuelta (la legalidad de una secuencia solo depende de las geometrías por las que pasa), así que todas tienen los mismos estados. Comprobado con el BFS completo en todos los espacios pequeños (el CAB: 15.704 · 10 = 157.040, igual que lo publicado: "15.704 formas y solo 10 permutaciones").
- Con más de 300.000 lazos (configuraciones con muchísimas geometrías) se criban en orden aleatorio hasta que 2.000 seguidos no amplían el grupo, y el número se marca como aproximado.

## Scramble
- **Espacio pequeño** (BFS completo de hasta 2 millones de estados): estado uniforme (una entrada al azar de la tabla) y el scramble es la inversa de su solución óptima. La tabla guarda los estados empaquetados en bits (5 bits por pieza en el 3x3) en una tabla hash: el Bandaged Cube de twistypuzzles (1.108.800 estados) son ~4,6 s y ~80 MB en Node.
- **Espacio grande**: paseo al azar "perezoso" de un número **fijo** de pasos: en cada paso se elige uno de los 18 giros y, si es ilegal, no se hace nada. Así la matriz de paso es simétrica y la distribución límite es **uniforme sobre los estados**, aunque el número de giros legales cambie de una geometría a otra (si se eligiera solo entre los legales, los estados con más giros saldrían más). El scramble es la palabra reducida del paseo (U + U = U2, U + U' = nada, U D U = U2 D): el estado no cambia por escribirlo así, y la legalidad de la palabra se vuelve a comprobar.
- **Lo que no funcionó**: parar cuando la palabra reducida llega a L giros. Ese momento no es independiente del estado (se para justo después de un giro "nuevo", lejos de las geometrías sin salida), y la distribución queda sesgada: en el *Most signatures* la distancia a la geometría resuelta se quedaba a TV ≈ 0,14 de la uniforme con L = 30, 100 o 300. Con pasos fijos converge (TV 0,029 con 3.200 pasos).
- **Criterio, medido** (`node scripts/mezcla-bloqueos.mjs 2000`): N = 2.000 paseos por longitud; TV de la distancia a la geometría resuelta frente a la exacta de un estado uniforme (todas las geometrías tienen los mismos estados, así que es la del BFS de geometrías), y TV media de la posición de cada pieza frente a paseos de 6.400 pasos (ruido de muestreo ≈ 0,05–0,06). Pasos mínimos con TV(geometría) ≤ 0,05 y TV(piezas) ≤ ruido + 0,02:

  | Configuración | Diámetro geometrías | Pasos mínimos | Giros (palabra reducida) | Pasos usados = max(80, 4·d²) | Giros del scramble |
  |---|---|---|---|---|---|
  | Pareja UFR+UF | 3 | 50 | ~29 | 80 | ~46 |
  | 1x2x2 | 1 | 50 | ~21 | 80 | ~33 |
  | Varios bloques | 7 | 100 | ~21 | 196 | ~40 |
  | Most signatures | 24 | 1.600 | ~58 | 2.304 | ~75 |

  Un paseo al azar tarda del orden de d² en recorrer un grafo de diámetro d, de ahí la fórmula, con margen sobre lo medido.

## Solver: dos estrategias y la más corta
- **A, búsqueda directa**: BFS (óptima) si el espacio es pequeño. Si es grande, IDA* con tablas de poda calculadas para la configuración (proyecciones sobre grupos de 4 esquinas o 4 aristas; en la proyección, un bloque solo impide un giro si separa las piezas que se ven de él, así la tabla sigue siendo una cota inferior), que encuentra la óptima si el estado está cerca, y **Kociemba con legalidad**: el algoritmo de dos fases de siempre con cada giro filtrado por la legalidad del estado de su profundidad. Sus tablas de poda son las del 3x3 sin bloqueos y siguen siendo cotas inferiores (con menos giros nunca se llega antes). Funciona sorprendentemente bien incluso en configuraciones muy restringidas (2x2x2 con solo D, L, B: ~20 giros).
- **B, geometría y luego permutación** (como el Square-1): fase 1 con la tabla exacta de distancias de las geometrías (BFS completo), enumerando las soluciones más cortas y hasta dos giros más largas (como en Kociemba, porque una fase 1 más larga puede dejar una fase 2 más corta); fase 2 desde la geometría resuelta con BFS, Kociemba con legalidad o IDA* con poda max(distancia a la geometría resuelta, proyecciones).
- Las búsquedas usan forma canónica (no U U, no D U —se escribe U D—, nunca U D U): U y D conmutan también con bloques, porque la legalidad de uno no depende del otro. En la unión de las dos fases se evita la redundancia; si todos los caminos desde la geometría resuelta empiezan deshaciendo el último giro de la fase 1, esa fase 1 no sirve para la B (pasa en algún estado del CAB, con solo dos caras libres; el test lo cuenta).
- Límite de tiempo (2,5 s por defecto): se devuelve la mejor encontrada. Si en ese tiempo no hay ninguna (pasa en los estados más difíciles del *Most signatures* con poco tiempo), se sigue con el doble de tiempo cada vez hasta 30 s.
- **Cuándo gana cada una (datos, 500 casos por configuración; tabla completa en ESTADO.md)**:

  | Configuración | Espacio | A (media) | B (media: fase 1 + fase 2) | Gana A / B |
  |---|---|---|---|---|
  | Pareja UFR+UF | grande | 20,27 | 22,02 (1,92 + 20,10) | 491 / 9 |
  | 1x2x2 | grande | 19,78 | 20,89 (0,75 + 20,14) | 487 / 13 |
  | Varios bloques | grande | 24,14 | 29,24 (5,17 + 24,07) | 475 / 25 |
  | Most signatures | grande | 22,38 | 30,07 (12,07 + 18,00) | 488 / 12 |
  | Bicube | pequeño | 18,29 (óptima) | 20,26 (3,93 + 16,33) | 500 / 0 |
  | Bandaged Cube de Meffert (1680008C2FB461) | pequeño | 22,22 (óptima) | 24,76 (2,88 + 21,88) | 500 / 0 |
  | Bandaged Cube (33EC01800846) | pequeño | 18,53 (óptima) | 21,33 (5,59 + 15,74) | 500 / 0 |
  | CAB Cube | pequeño | 33,77 (óptima) | 54,11 (23,77 + 30,34) | 500 / 0 |

  En espacio pequeño la A es óptima y la B no puede ganar (sirve de comparación). En espacio grande, la B gana en un 2–5 % de los casos. La especificación esperaba que la B ganase en los vendados complejos; no pasa porque la búsqueda directa ya respeta la legalidad en cada giro y no paga la fase 1 por separado: cuanto más larga es la fase 1 (el *Most signatures*: 12 giros), más pierde la B. Se dejan las dos y se elige en cada caso; en la interfaz se puede pedir una en concreto.
- **Comparación sin bloqueos**: la óptima del mismo estado sin bloqueos por IDA* con la cota de la fase 1 de Kociemba (solo da tiempo en estados cercanos); si no, la de Kociemba, marcada como tal.

## Formato de la comunidad: la firma del Bandaged Cube Explorer
- La comunidad (twistypuzzles, el Bandaged Cube Explorer de Andreas Nortmann y los programas que lo siguen) describe un 3x3 vendado con **54 uniones** posibles entre cubies vecinos (incluido el núcleo), como un número de 54 bits en hexadecimal. El orden de las uniones no está documentado en ningún sitio; lo tomé del código de `paul_cube_bandaged_graph` (que lo dejó escrito para generar sus dibujos) y lo comprobé con las cifras publicadas: CAB Cube 22006F100000C6 → 15.704 formas y 10 permutaciones (exacto), *Most signatures* 10840080200C21 → 92.176 formas (el doble, por la orientación, ver arriba).
- Importar: firma → uniones → bloques (componentes conexas). Exportar: todas las uniones entre vecinos de un mismo bloque. Ida y vuelta comprobada en el test.

## Interfaz
- Sección "Bloqueos" debajo de los dos paneles, solo en los puzzles con soporte (el 3x3). Mientras se editan los bloques, el editor (2D o 3D) enseña el cubo resuelto con las piezas sueltas atenuadas y cada bloque de un color; tocar una pieza la pone o la quita del bloque que se edita (y la quita de cualquier otro). Los errores (piezas no vecinas, centros opuestos) salen al momento; *Aplicar* manda la configuración al Worker, que hace el análisis y las tablas.
- "No hay interruptores": con bloques aplicados, el 3x3 es el puzzle envuelto y todo (scramble, cargar, resolver, reproducir) va igual que siempre. El modo aprender se oculta (no hay métodos humanos para cubos vendados).
- Se guardan en `localStorage` (con try/catch) la configuración aplicada y las que el usuario guarda con nombre. Enlace: `#bloqueos=UF.UFR-DB.DBL` (piezas separadas por puntos, bloques por guiones); también se acepta `?firma=...`.

# Fase 0: tests más rápidos (mantenimiento, 23/11/2026)

## Diagnóstico (medido, `test:rapido` de partida: 18 min 24 s con 2 núcleos)
Casi todo el tiempo es de **solvers con límite de tiempo**: cada caso consume (casi) todo su presupuesto, así que el tiempo es casos × presupuesto / hilos, más las tablas, que se regeneran en cada proceso, en cada worker_thread y en cada ventana de jsdom.
- **Vendados** (367 s): cada caso ~1,1 s (estrategia A, B y la comparación sin bloqueos, cada una con su límite); en los de espacio pequeño A y B son instantáneas (BFS) y lo que cuesta es la comparación sin bloqueos (~0,4 s) y la tabla del BFS completo, que se generaba 3 veces (hilo principal y 2 hilos; 6 s cada una en el de Meffert).
- **App** (221 s): cada test abre una ventana nueva y la app genera en el hilo principal las tablas de cada puzzle que visita (~16 s si los recorre todos) y resuelve con los límites de la app. Perfilado: cálculo puro del bundle (2 s de espera en 44 s).
- **Cubos grandes** (207 s): 6x6/7x7 ~3–5 s por caso; el método de respaldo (12 resoluciones en un hilo).
- **Modo aprender** (178 s): el 4x4 ~1,2 s por caso (una reducción completa), 100 casos × 2 métodos.
- **Square-1** (50 s): el scramble de estado aleatorio es una búsqueda (~0,15 s) y el solver ~0,3 s.

## Qué se recortó y por qué es seguro
- Solo en `test:rapido`/`test:solo`: **número de casos** de los tests caros (`casosPor(completo, rapido)` en `tests/util.mjs`; la lista está en ARQUITECTURA.md → Tests). Ninguna comprobación desaparece: cada test sigue comprobando lo mismo en cada caso, y `npm test` usa exactamente los casos de antes (la rama completa de cada `casosPor` es la expresión anterior). Todos los casos salen de semillas fijas.
- **Compartir trabajo**: en rápido, los vendados de espacio pequeño se resuelven en el hilo principal, que ya tiene la tabla del BFS (en completo siguen en paralelo: con 500 casos compensa).
- `humo.test.mjs`: en rápido y completo solo las huellas; el resto es un subconjunto de los demás ficheros.
- Las ejecuciones con menos casos ya **no pisan `tests/resultados/`** (van a `tests/.resultados-parciales/`, ignorado): antes había que restaurarlos a mano tras cada `test:rapido`.

## Comprobaciones nuevas (encontradas al sabotear)
- **Huellas de los giros** (`tests/huellas.json`): un giro invertido (probado con R del Skewb) **no lo detectaba ningún test**, ni en la suite completa: scramble, validador, solver, vista 3D y modo aprender salen del mismo modelo y siguen siendo coherentes. Ahora se compara el estado tras cada giro básico con el guardado. `test:solo` las incluye siempre.
- La prueba de humo de la app solo miraba el texto «Resuelto» al final de la solución: una interfaz que perdiera el último giro pasaba (comprobado). Ahora también `cuboSolver.resuelto()`.

## Lo que no funcionó / descartado
- Recortar "sin aristas libres" a un tamaño: no ahorra nada. En el proceso completo ese test tarda ~12 s con cualquier número de tamaños (solo, con el 5x5, son 2 s): es el coste de la memoria acumulada por las tablas de 4x4–7x7 del hilo principal, no de las resoluciones. Se deja con 5x5, 6x6 y 7x7 en todos los niveles.
- La app no se puede acelerar desde los tests: compartir una ventana entre tests cambiaría lo que se prueba (estado limpio, tablas generándose) y las tablas viven dentro del bundle. Queda como suelo de `test:rapido` (~3,6 min de ~8).
- **Caché de tablas en disco** (punto 5): no se hizo. Con los números de arriba ahorraría como mucho las tablas de los worker_threads de cubos grandes y aprender (~30–40 s en rápido), no la app (las tablas están dentro del bundle) ni los vendados (las tablas dependen de la configuración); y necesita serializar tablas en `src/`, con riesgo de servir tablas viejas tras un cambio. No compensa ahora.
- Ejecutar ficheros en paralelo: no (ver "Tests más rápidos", noche 6: los solvers con límite de tiempo darían otros resultados).
