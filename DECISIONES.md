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
- **Test inestable encontrado en GitHub**: «app: modo aprender» falló una vez (`muestra el nombre de algún algoritmo`) y pasó en la ejecución anterior con el mismo código. La app saca los scrambles de `crypto.getRandomValues`, así que cada ejecución probaba casos distintos, y alguno no usa ningún algoritmo con nombre. Ahora, en jsdom, `crypto.getRandomValues` es una secuencia con semilla fija (`APP_SEMILLA`, por defecto 20261123): todos los tests de la app sin Worker prueban siempre los mismos casos. Los que usan Workers reales (worker_threads) siguen con el crypto de Node; lo que comprueban no depende del caso.
- La prueba de humo de la app solo miraba el texto «Resuelto» al final de la solución: una interfaz que perdiera el último giro pasaba (comprobado). Ahora también `cuboSolver.resuelto()`.

## Lo que no funcionó / descartado
- Recortar "sin aristas libres" a un tamaño: no ahorra nada. En el proceso completo ese test tarda ~12 s con cualquier número de tamaños (solo, con el 5x5, son 2 s): es el coste de la memoria acumulada por las tablas de 4x4–7x7 del hilo principal, no de las resoluciones. Se deja con 5x5, 6x6 y 7x7 en todos los niveles.
- La app no se puede acelerar desde los tests: compartir una ventana entre tests cambiaría lo que se prueba (estado limpio, tablas generándose) y las tablas viven dentro del bundle. Queda como suelo de `test:rapido` (~3,6 min de ~8).
- **Caché de tablas en disco** (punto 5): no se hizo. Con los números de arriba ahorraría como mucho las tablas de los worker_threads de cubos grandes y aprender (~30–40 s en rápido), no la app (las tablas están dentro del bundle) ni los vendados (las tablas dependen de la configuración); y necesita serializar tablas en `src/`, con riesgo de servir tablas viejas tras un cambio. No compensa ahora.
- Ejecutar ficheros en paralelo: no (ver "Tests más rápidos", noche 6: los solvers con límite de tiempo darían otros resultados).

## Noche 11: rediseño visual (portada, secciones, tema oscuro)

### Navegación y secciones
- **Hash, no rutas**: la app sigue siendo un único HTML que se abre con doble clic (`file://`) y en GitHub Pages; con `#/…` no hace falta servidor ni reescrituras. Rutas: `#/` portada, `#/como-funciona` (portada con el foco en esa parte), `#/wca` y `#/wca/<id>`, `#/bandaged` y `#/bandaged?bloqueos=…`.
- **Una sola lista** (`src/app/secciones.js`, `SECCIONES`): id, nombre, descripción, estado `disponible` | `bloqueada`. La portada pinta una tarjeta por sección; desbloquear una es cambiar su `estado` (y, si trae herramienta nueva, decir en `main.js` qué muestra). Las bloqueadas son `<li>` sin enlace ni botón (no se enfocan) y por URL redirigen a la portada (`history.replaceState`, sin dejar la ruta mala en el historial).
- **Una sola herramienta en el DOM**: WCA Puzzles y Bandaged Cubes usan los mismos paneles (scramble, resolver) con los mismos ids; cambia qué se muestra: en WCA el selector de puzzles y sin bloques; en Bandaged, el 3x3 fijo, sin selector y con «Tus bloques» primero (CSS `order`). Duplicar el DOM habría duplicado también `main.js` y los tests. Consecuencia: **el 3x3 de WCA Puzzles es siempre el normal** aunque haya bloques aplicados en Bandaged Cubes (`puzzleActivo` solo envuelve con `puzzleConBloqueos` en esa sección); los bloques se conservan al volver.
- **La herramienta arranca al entrar**: en la portada no se elige puzzle ni se generan tablas (antes, al cargar la página, se generaban las del 3x3). Al entrar en una sección el puzzle se elige al momento, como desde la noche 9 (el arreglo del primer «Resolver» sigue igual: los tests lo comprueban en `#/wca`).
- **Enlaces antiguos**: `#bloqueos=…`, `#firma=…`, `?bloqueos=…` y `?firma=…` abren Bandaged Cubes con esa configuración y la URL pasa a `#/bandaged?…` (sin `?firma` en la búsqueda). Busqué otros enlaces que la app genere o lea: no hay más (el único `location` era el de los bloqueos; el puzzle elegido va en `localStorage`, no en la URL). «Copiar enlace» genera ahora `#/bandaged?bloqueos=…`, y la URL de Bandaged Cubes refleja siempre los bloques aplicados (recargar o compartir la barra de direcciones los conserva).
- Elegir un puzzle en WCA Puzzles cambia la URL con `replaceState` (no llena el historial de «atrás» con cada chip); entrar en una sección sí añade una entrada.
- El **FTO** aparece como chip bloqueado «FTO · pronto» (`<span class="chip-pronto">`, no es botón) a partir de `PUZZLES_PRONTO` del registro. `#/wca/fto` deja el puzzle actual. El registro tiene ahora `categoria` (`'wca'`) en cada puzzle; lo añade `src/puzzles/index.js`, no los módulos (la interfaz común no cambia).

### Tema
- **Oscuro por defecto aunque el sistema esté en claro** (pedido): ya no se mira `prefers-color-scheme`. Las variables de `:root` son las oscuras; `:root[data-theme="light"]` las claras. La elección va a `localStorage` (`cubo-solver:tema`) dentro de try/catch: si el navegador no deja, el tema dura la página. En `dist/index.html` un script de una línea en `<head>` aplica el claro antes de pintar (sin parpadeo); en el artifact lo aplica `main.js` al arrancar.
- Colores exactos de la propuesta D. El resto (error, ok, lienzo, aviso) los elegí yo y los comprueba el test de contraste: **todos los pares texto/fondo ≥ 4,5:1** en los dos temas (los más justos, en claro: verde de «ok» sobre su fondo 4,71:1 y `--tenue` sobre el lienzo 5,02:1).
- **Lienzo y contornos**: el cuerpo de las piezas es negro (`#1b1b1f` / `#111` en los dibujos de los puzzles, que no se tocan), así que en oscuro un fondo casi negro lo borraba. El lienzo oscuro es `#1d2230` y, solo en oscuro, la vista 2D y el lienzo 3D llevan un contorno claro muy fino (`filter: drop-shadow` con `--contorno`). Los colores de las pegatinas no cambian.
- El botón: en escritorio icono + «Modo claro»/«Modo oscuro» (lo que hará); en el móvil solo el icono, 44×44, con `aria-label` «Cambiar a modo …».

### Fuentes (decidido con números)
| Opción | `dist/index.html` | gzip |
|---|---|---|
| Antes (Archivo/IBM Plex de Google Fonts por red, opcional) | 605,7 KB | 223,9 KB |
| Pilas del sistema (sin incrustar) | 625,3 KB | 228,8 KB |
| **Subconjuntos woff2 incrustados (elegida)** | **703,7 KB** | **289,8 KB** |

- Incrustadas: Inter variable (35,2 KB), Bricolage Grotesque 800 (17,0 KB), JetBrains Mono 500 (7,7 KB) = 59,9 KB en woff2, **78,5 KB en base64** (+12,9 % del HTML; +61 KB comprimido, porque el base64 de un woff2 ya comprimido no se comprime más). Subconjunto: ASCII, Latin-1 (tildes, ñ, ¿¡, ·, ×), rayas, comillas, «…», la prima y las flechas de los reproductores (`scripts/fuentes.sh`, con fonttools, a partir de los paquetes de Fontsource; licencias OFL en `src/app/fuentes/LICENCIAS.txt`).
- Por qué: el diseño D se apoya en la tipografía (titular de 64 px en Bricolage, notación en JetBrains Mono); con las pilas del sistema la portada se veía genérica y la notación cambiaba de ancho entre sistemas. 78 KB son ~1/8 del HTML, que ya pesa por las tablas y los solvers, y la app sigue sin **ninguna petición de red** (antes pedía Google Fonts; sin conexión caía a las del sistema). Inter variable (35 KB) sale más barata que tres estáticas (400/500/600: 48,7 KB).
- `font-display: swap` y pilas de respaldo en las tres variables por si una fuente no carga. Comprobado en Chromium con toda la red bloqueada: las tres fuentes `loaded` y ninguna petición.
- Nota: Inter dibuja «2x2» como «2×2» (alternativa contextual de la fuente); el texto sigue siendo «2x2».

### Accesibilidad
- Objetivos táctiles ≥ 44 px en todo lo interactivo visible (botones, chips, conmutadores 2D/3D, colores de la paleta, selects, desplegables, enlaces de la cabecera); lo mide `scripts/comprobar-diseno.py`. Foco visible global (`:focus-visible`, contorno de acento) y enlace «Saltar al contenido». Al navegar a una sección el foco va a su título.
- Botones deshabilitados: antes `opacity: .45` (texto por debajo de 4,5:1); ahora borde discontinuo y texto `--tenue`, que sí pasa.
- **No hecho**: los movimientos de la solución (`#movs li`) y los pasos de la explicación del modo aprender siguen siendo `<li>` con clic, no botones (cambiarlos afecta a muchos tests; se pueden usar igual con los botones del reproductor).

### Qué cambió en los selectores (DOM) y en los tests
- Ids de la herramienta: **ninguno cambia**. Nuevos: `app`, `contenido`, `portada`, `secciones-disponibles`, `secciones-bloqueadas`, `como-funciona`, `herramienta`, `t-seccion`, `intro-seccion`, `tema`, `tema-texto`. `#selector` ahora está dentro de la cabecera de la sección (oculto en Bandaged). El título del panel de bloques pasa de «Bloqueos» a «Tus bloques» (el id `t-bloqueos` sigue).
- La clase `herramienta` ya existía (herramientas del editor: «Mover», «Rellenar cara»…): el contenedor de las secciones se llama `seccion-herramienta`. Lo vi en la primera captura (la cabecera de la sección salía con el borde y la altura de 44 px de un botón de herramienta).
- `tests/app.test.mjs`: `abrir()` abre `#/wca` (antes `/`: ahora es la portada) y admite `esperarHerramienta: false` para la portada; `abrirSinEsperar()` (primer «Resolver») también `#/wca`; las pruebas de bloqueos abren `#/bandaged` y, en vez de pulsar el chip del 3x3, esperan a que la sección esté lista y comprueban que no hay selector. La de enlaces antiguos comprueba además la sección, la URL nueva y que el 3x3 de WCA no tiene bloques (y prueba también `?bloqueos=`, `#firma=` y el enlace nuevo). Ninguna comprobación se quita.
- `scripts/comprobar-*.py`: la URL de los de WCA es `…index.html#/wca`; `comprobar-bloqueos.py` abre `#/bandaged` y, en vez del clic en el chip del 3x3, comprueba que no hay selector.

### Lo que no funcionó / descartado
- `window.scrollTo` al cambiar de sección: jsdom no lo implementa y llenaba la salida de los tests de avisos; se usa `scrollingElement.scrollTop = 0`.
- Tarjetas con `auto-fill` (como el lienzo de diseño): en 1200 px dejaban una tercera columna vacía junto a las dos secciones disponibles; `auto-fit` las estira.

# TypeScript, paso 0: tipos con JSDoc sin renombrar ficheros (23/11/2026)

### JSDoc + `.d.ts` frente a pasar a `.ts`
- **Ahora, JSDoc**: los ficheros siguen siendo `.js`, Node y esbuild los ejecutan sin cambios, y los tipos son comentarios (`@param`, `@returns`, `@type`, `@import`). Se puede tipar fichero a fichero (`// @ts-check`) y nada de lo que se ejecuta cambia: **el bundle minificado sale idéntico byte a byte** (comprobado en cada hito comparando `dist/index.html` y `dist/artifact.html` con una copia hecha antes de empezar).
- **Los contratos en un `.d.ts` (`src/core/tipos.d.ts`), no en `@typedef`**: la sintaxis de TypeScript es más clara para interfaces con métodos opcionales, genéricos (`Puzzle<E>`), uniones discriminadas (`Peticion`, `ResultadoResolver`) y tipos indexados (`RespuestasPorOperacion[op]`); está todo en un sitio, y en el paso 1 ese fichero sirve tal cual (pasaría a `tipos.ts`). Los tipos internos de un módulo (numéricos) se quedan en ese módulo con `@typedef`.
- **TypeScript 7** (el compilador nativo, estable desde julio de 2026): `npm run tipos` tarda ≈ 0,3–0,5 s con 11 ficheros comprobados (el proyecto entero se lee igualmente).
- **`strict` con `noImplicitAny`**: no se puede activar por fichero, así que cada fichero con `@ts-check` lleva sus firmas anotadas. Sin `noImplicitAny`, casi todo lo que viene de fuera del literal de un puzzle sería `any` y no se comprobaría nada.

### Reglas que se han seguido
- Ningún `any` escrito ni ningún `@ts-ignore`/`@ts-expect-error` (0 y 0).
- **Casts** (`/** @type {X} */ (expr)`): ~100 en los 11 ficheros (65 en `bloqueos.js`). La mayoría son el tipo de un literal vacío (`/** @type {number[]} */ ([])`) o un `Map.get` justo después de comprobar `has`. Los que afirman algo que el comprobador no puede ver llevan un comentario al lado; son de cuatro clases:
  1. **Tablas que son null hasta `inicializar()`** (`buscador` del Skewb, Pyraminx y 2x2; el análisis `A` de `puzzleConBloqueos`): se declaran sin null (cast vía `unknown`, 10 en total). Todo lo que las usa llama antes a `inicializar()`.
  2. **`capacidades.validar` ⇒ existe `validar()`** (y lo mismo con `resolver`) en `servicio.js`: lo comprueba `definirPuzzle` en ejecución; el tipo no relaciona las dos cosas.
  3. **El puzzle con bloqueos tiene estado de pegatinas y vista 3D** (el 3x3): `servicio.js` y `bloqueos.js`.
  4. **Narrowing que TypeScript no ve**: dentro de funciones de un closure (`sop` tras el `throw`, `nueva` tras `unir()`), con índices variables (`b[j].fija`), y que `r.res.B` existe con la estrategia B.
- **Nunca se cambia código para contentar al comprobador**: dos veces lo hice sin darme cuenta (una desestructuración en `caminoBFS` y una constante nueva en `idaGenerico`) y la comparación del bundle lo detectó (el minificador renombraba variables y salían 14 caracteres más); se deshicieron y quedaron como casts.

### Lo que no funcionó
- **esbuild lee `tsconfig.json` por su cuenta**: con `strict` añadía `"use strict"` al IIFE de la app (cambia lo que se ejecuta: el código de la página no estaba en modo estricto). `scripts/construir.mjs` le pasa ahora un tsconfig vacío (`tsconfigRaw: '{}'`): la build no depende de la configuración de los tipos.
- **`definirPuzzle<E, D extends DefinicionPuzzle<E>>(def: D & DefinicionPuzzle<E>): D & Puzzle<E>`** (la primera firma): si faltaba un obligatorio, la inferencia de `D` caía a la restricción y el error era engañoso (`'obtenerBuscador' does not exist in type 'DefinicionPuzzle<any>'` al quitar `estaResuelto`). La firma buena es `definirPuzzle<E, X extends object>(def: DefinicionPuzzle<E> & X & { [extra: string]: unknown }): Puzzle<E> & X`: deduce `E`, permite los campos propios del puzzle, los conserva en el resultado y el error dice `Property 'estaResuelto' is missing`. Precio: un nombre mal escrito de un campo **opcional** (`metodosAprendr`) no se detecta.
- **Un campo mal escrito en lo que devuelve `resolver`** (`fasses`) no lo detecta la firma de `definirPuzzle` si `resolver` es una función aparte (TypeScript no comprueba propiedades de más en un objeto que no es un literal en ese punto). Se detecta anotando la función con `@returns {ResultadoResolver}`; por eso los puzzles tipados lo llevan.
- **El estado de un puzzle salía `any`** cuando venía de un módulo sin tipar (`geo.resuelto` de `geopuzzle.js`): se fija con un cast en `estadoResuelto`.

### Qué encontró el comprobador (ningún bug real)
- `aprender(estado)` también devuelve `{ ok: false, errores }` si el estado no es válido (Skewb, Pyraminx, 2x2…); la tabla de ARQUITECTURA.md no lo decía. Ahora `ResultadoAprender` es la unión y está documentado.
- El envoltorio de bloqueos añade `estrategia: 'sin bloqueos'` también a un resultado con `ok: false`.
- `puzzleConBloqueos` define siempre `vista3D`, aunque el puzzle de debajo no tenga vista 3D (fallaría al llamarla). Hoy solo se venda el 3x3, que la tiene: no es un bug, pero lo será si se vende un puzzle sin 3D.
- `enB[dib.indice[k]]` con `indice` null: da `undefined` y la comparación sale `false`, que es lo correcto.
- `capacidades` está en la tabla de campos obligatorios de ARQUITECTURA.md, pero `definirPuzzle` lo rellena si falta. En los tipos es obligatorio (todos los puzzles lo dan).

### Plan del paso 1: pasar a `.ts` (no hecho)
**Cómo se ejecutaría**: Node 22.23 (el de la Action y el de esta máquina) ya ejecuta `.ts` por defecto quitando los tipos («type stripping», `process.features.typescript === 'strip'`), sin compilar. Así que los tests (`node --test`, los `worker_threads` de `tests/trabajador.mjs`) importarían los `.ts` directamente, y esbuild empaqueta `.ts` sin configuración. **No haría falta un paso de compilación.** Condiciones: solo sintaxis «borrable» (nada de `enum`, `namespace` ni propiedades en parámetros de constructor; `tsconfig`: `erasableSyntaxOnly`, `verbatimModuleSyntax`), `import type` para los tipos, e imports con la extensión `.ts` (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions` para que `tsc` lo acepte). Alternativa si algo falla: compilar con esbuild a una carpeta temporal antes de los tests (más lento y con mapas de código).

**Orden** (de lo más estable y más usado a lo más grande; un hito con push cada vez, y en cada uno: tipos, `test:humo`, bundle idéntico salvo nombres):
1. `core/tipos.d.ts` → `core/tipos.ts`; `core/puzzle.ts`, `core/perm.ts`, `core/rng.ts`, `aprender/guion.ts`, `app/secciones.ts`, `puzzles/index.ts`, `app/servicio.ts` + `app/worker.ts` (pequeños y ya tipados: casi solo mover las anotaciones a la sintaxis de TS).
2. `core/piezas.ts`, `core/modelo3d.ts`, `core/geometria.ts`, `core/geopuzzle.ts` (con `geopuzzle` tipado desaparecen los casts de `geo.perms` y `geo.resuelto` de los puzzles).
3. Puzzles pequeños: `skewb`, `pyraminx`, `cubo2` (ya tipados), y sus métodos de `aprender/`.
4. `core/bloqueos.ts` + `puzzles/nxn-bloqueos.ts` + `cubo3-bloqueos.ts`.
5. `nxn.ts`, `cubo3.ts`, `kociemba.ts`, `cubo-grande.ts` y los del 4x4–7x7; `square1*`; `megaminx*`.
6. `app/main.ts`, `motor.ts`, `vista3d.ts`, `escena3d.ts`, `reproductor.ts`, `bloqueos-ui.ts`, `tema.ts` (el DOM: el más largo de tipar bien).
7. Tests: pueden seguir en `.mjs` (importan los `.ts`); tiparlos es opcional.

**Riesgos**: (1) los imports con extensión: cada `import './x.js'` pasa a `./x.ts` y un olvido solo se ve al ejecutar (lo detectaría `tsc` con `allowImportingTsExtensions`); (2) `tests/trabajador.mjs` y `tests/util.mjs` importan los módulos por ruta: hay que cambiar las rutas; (3) el bundle ya no saldrá idéntico byte a byte si se cambia sintaxis (p. ej. `satisfies`); la comprobación pasa a ser «mismo código salvo nombres» (comparar la build con `minifyIdentifiers: false`, como se hizo aquí para encontrar las dos diferencias); (4) los `@typedef` con `ReturnType<typeof f>` hay que convertirlos en interfaces explícitas si se quieren mensajes de error legibles; (5) la «type stripping» de Node sigue siendo experimental en algunas versiones: fijar la versión de Node en la Action (hoy `node-version: 22`).

**Estimación**: pasos 1–3, una sesión (~3 h); paso 4, media sesión; paso 5, una o dos sesiones (los solvers grandes tienen mucho código numérico: tipos mínimos); paso 6, una sesión. Total ≈ 4–5 sesiones.

# Noche 12: FTO (Face-Turning Octahedron)

## Notación: la del Reglamento WCA 2027 (12f)
La WCA aprobó el FTO el 24/06/2026 como modalidad oficial desde el 2 de enero de 2027 (media de 5). El texto del reglamento aún no está en la versión publicada (1/4/2026); está en la rama `drafts2027` de github.com/thewca/wca-regulations (PR #31, «P002-FTO», último commit 16/11/2026):
- **12f1**: «The puzzle is oriented with four faces visible, and the corner between them facing the scrambler.»
- **12f2/12f3**: U (arriba), F (delante), R, L, B (detrás), D (abajo), BR (detrás a la derecha), BL (detrás a la izquierda); 120° en sentido horario, con `'` antihorario.
- **4d6**: se mezcla con blanco arriba y verde delante. **4b3**: el FTO **no** está entre las excepciones, así que el scramble tiene que ser de **estado aleatorio** (uniforme entre los estados que necesitan al menos 2 giros). **10f3**: desalineación máxima de 60°.

Con el vértice hacia quien mezcla, las cuatro caras de delante son U (arriba), R, F (abajo) y L; detrás, B es la vecina de U, BR la de R, BL la de L y D la de F. Opuestas: U–D, F–B, R–BL, L–BR (los tests lo comprueban sobre la geometría).

**csTimer usa las mismas letras** (`U D F B L BR R BL` con `'`; en su scramble de movimientos aleatorios agrupa justo esas parejas opuestas), así que no hay diferencia que explicar. csTimer tiene además notaciones propias para practicar (giros dobles, `Rw`, `T`, rotaciones entre corchetes) que no forman parte de la notación WCA: no las usamos.

## Colores: los de TNoodle
El reglamento solo exige un color distinto por cara (3a3). El esquema por defecto es el del programa oficial de scrambles, TNoodle (`FaceTurningOctahedronPuzzle.getDefaultColorScheme`): U blanco, F verde, R rojo, L morado, B azul, D amarillo, BR gris, BL naranja. Cumple 4d6 (verde comparte esquina con blanco). Con tonos de la paleta de la app (morado y gris, los del Megaminx). **Pendiente de comprobar con un FTO físico** (la mayoría de FTO de la comunidad, p. ej. el DianSheng, usan este esquema, pero no lo he podido verificar).

## Modelo
- `crearGeoPuzzle` con el octaedro (vértices en (0,0,±1) y (±1,±1,0)/√2) y un plano de corte por cara a 1/3 del inradio: 72 pegatinas, 27 por giro. Red 2D como la imagen de TNoodle: dos cuadrados (las caras de delante de frente y las de detrás vistas desde atrás).
- Piezas por las capas en las que está cada pegatina: 4 caras = esquina (6), 2 = arista (12), 3 = triángulo (24).
- **Tétradas**: las caras se reparten en A = {U, F, BR, BL} y B = {R, L, B, D}, que no se tocan entre sí. Cada arista une una cara A y una B, y alrededor de una esquina se alternan. Ordenando las pegatinas de cada pieza desde una cara A, ningún giro voltea una arista y las esquinas solo giran 0 o 2 pasos (de 4): eso hace las coordenadas mucho más simples.
- El FTO **no tiene ninguna pieza fija**: el estado son las 72 pegatinas tal como se sujeta, y está resuelto si cada cara es de un color (en cualquier orientación).

## Restricciones: demostradas (`fto-grupo.js`)
Schreier–Sims sobre las pegatinas: esquinas 6!/2·2⁵ = 11.520, aristas 12!/2, cada órbita de triángulos (los de las caras A y los de las B, nunca se mezclan) 12!/2, y el puzzle entero **exactamente el producto**: 158.260.810.061.489.362.698.240.000.000. No hay ninguna otra restricción.
- De las 24 rotaciones del puzzle entero, **12 están en el grupo** (las de la tétrada, que no cambian A por B); las otras 12 cambian a la vez la paridad de esquinas, aristas y triángulos.
- Posiciones distintas = |G| / (648² · 12) = **31.408.133.379.194.880.000.000** (648 = 3!⁴/2: en cada órbita de triángulos, los cambios pares entre triángulos iguales; 12: las orientaciones que se ven igual). Coincide con la de Wikipedia (6!·2⁶·12!·(12!)²/(2·4·3!⁸·12)). Las dos fórmulas cuentan lo mismo de dos maneras: Wikipedia habla de «paridades iguales de esquinas y aristas» porque deja libre la orientación; con la orientación fijada por las tétradas, las dos son pares.
- Comprobación empírica en los tests: 2000 giros al azar sobre el modelo de piezas cumplen todas las invariantes.
- **Cota inferior por conteo: 21** giros (8 caras × 2 sentidos; solo conmutan las opuestas, que se cuentan en un solo orden).

## Validador
Sin centros fijos, la orientación se deduce de las piezas: la mayoría de las aristas dice qué colores hacen de tétrada A (si hay empate, los triángulos), y entre las 12 rotaciones de esa mitad se elige la que deja más pegatinas en su sitio. Mensajes: pieza inexistente o especular, repetida o que falta, arista volteada, esquina girada un cuarto, triángulos en caras imposibles (de una tétrada a la otra), dos esquinas o dos aristas intercambiadas, número impar de esquinas giradas media vuelta, colores mal contados.

## Solver: fases
**Lo que hay publicado**: el scrambler oficial de TNoodle usa `fto3phase` (Levi Gibson), tres fases tipo Kociemba: G0 = todos los giros → G1 = ⟨U, R, L, B, D⟩ (aristas y triángulos de D en D) → G2 = ⟨R, L, B, D⟩ (aristas en su cara B, triángulos B, y los de A «pegados» a las esquinas) → resuelto (esquinas 6!/2·2⁵ × aristas 3⁴). csTimer (`ftocta.js`, de cs0x7f) tiene otro solver propio y métodos de entrenamiento de la última capa (L3T, TCP). Elegí las fases de fto3phase porque están pensadas para el estado aleatorio (lo que exige 4b3) y porque comprobé con Schreier–Sims que **G2 tiene 933.120 elementos tanto sobre todas las pegatinas como sobre esquinas + aristas**: dentro de G2 los triángulos no añaden nada, y la fase 3 cabe en una tabla exacta. Las coordenadas y las tablas son nuestras (`crearBuscador`):
1. **G0 → G1** (16 giros): posiciones y paridad de las 3 aristas de D (440) × posiciones de los 3 triángulos amarillos (220). Tabla exacta de 96.800.
2. **G1 → G2** (10 giros): aristas por cara B con la paridad de los tríos de R y L (6720) × triángulos de R, L y B (1680) = **11,3 M** (la tabla más grande, 11,3 MB; como la «TxE» de fto3phase), y una tabla por cara A: posiciones de sus 3 esquinas, en cuál de sus dos huecos A está la pegatina de esa cara (160) × posiciones de sus 3 triángulos (220). El objetivo es un subgrupo: **`crearBuscador` admite ahora `cierre`** (los giros que generan el subgrupo): las tablas empiezan con distancia 0 en todo lo que se alcanza desde el resuelto con ellos. Sin `cierre`, nada cambia para los demás puzzles.
3. **G2 → resuelto** (8 giros): esquinas (720 · 2⁶) × aristas (3⁴) = 3,7 M, exacta: óptima en G2 (como mucho 11 giros).
- Se toman las 20 primeras soluciones de la fase 1 (la más corta y una más) y se busca la fase 2 por longitud total creciente; al llegar a G2 (comprobado con la tabla de la fase 3) se hace la fase 3 y se comprueban las piezas.
- **Orientaciones**: el FTO se puede resolver desde cualquiera de sus 12 orientaciones del grupo, y la fase 2 cuesta muy distinto en cada una (de 30 ms a varios segundos para el mismo estado). El solver reparte el tiempo en rondas (40 ms por orientación, luego ×3) y se queda con la más corta dentro de `tiempoMax` (1 s por defecto). En los tests, 300 ms.
- **Scramble**: estado de piezas uniforme (esquinas y aristas en permutación par, número par de esquinas giradas, triángulos en cualquier orden), descartando los que están a menos de 2 giros. Para no sesgar el reparto, la solución tiene que llevar exactamente al resuelto de referencia (blanco arriba, verde delante), no a uno girado. Por eso no se reetiquetan colores: se gira el puzzle entero con una de las 12 rotaciones del grupo (conjugación), se resuelve en ese marco y se traducen los nombres de los giros. Todas llevan al mismo resuelto, así que se puede probar en los 12 marcos y quedarse con la primera (test: el scramble da exactamente el estado elegido).

## Lo que no funcionó
- **Coordenada de las esquinas de cada cara A con solo su media vuelta** (como fto3phase, que guarda `nCr(6,3)·2³`): en nuestro modelo la orientación depende de qué esquina es, así que no basta. Hay que guardar en qué hueco A está la pegatina de esa cara.
- **Aristas de la fase 2 sin la paridad de los tríos** (1680 en vez de 6720): muchos estados daban 0 en todas las tablas sin estar en G2 (hasta 116 rechazos en un estado y más de 8 s). Con las paridades, ningún rechazo en las pruebas.
- **Tablas extra de aristas o triángulos B × triángulos de cada cara A** (369.600 cada una): no podan más y cada nodo hace más consultas; más lento.
- **Más candidatas de la fase 1** (40–60): igual de largo y más lento que 20. Menos (8–10) alarga ~0,5 giros.
- La tabla de aristas sin paridades × triángulos B (2,8 M) generaba en 1,2 s, pero cada solución tardaba ~1,5 s de media con colas de más de 8 s. La de 11,3 M tarda ~1,8 s en generarse (×4 en móvil: ~8,4 s, dentro del límite de ~10 s acordado) y baja la media a ~0,25 s por orientación.

## Interfaz
Ningún cambio en `main.js`: el FTO entra por el registro (sale de `PUZZLES_PRONTO`, que queda vacío) y la interfaz común. La portada ya no dice «FTO pronto» y el pie lo cuenta entre los scrambles de estado aleatorio. Modo aprender: pendiente (ver ESTADO.md).

## Registro: campos mal escritos
`tsc` no ve un campo opcional mal escrito en la definición de un puzzle (cae en los campos propios). `tests/registro.test.mjs` lee `DefinicionPuzzle` y `Puzzle` de `src/core/tipos.d.ts` y comprueba que cada campo de cada puzzle del registro es de la interfaz o está en la lista de campos propios permitidos de ese puzzle (y que la lista no tiene campos que ya no existen). Comprobado: `avisoInicialisacion` en el FTO pasa `npm run tipos` y este test lo detecta.

# Noche 13: 4x4 y 5x5 vendados (24/11/2026)

## Paso 0: la trampa de `vista3D`
El envoltorio de bloqueos definía siempre `vista3D`, aunque el puzzle de debajo no la tuviera (la interfaz habría creído que había 3D). Ahora solo existe si el de debajo la tiene (`PuzzleVendado.vista3D` pasa a opcional en los tipos). Test con el 3x3 sin `vista3D`: el envoltorio no la tiene, y el dibujo 2D, el scramble y la solución siguen funcionando; sin el arreglo, el test falla.

## Identidad de las piezas iguales
- **El problema**: en el 3x3 cada pieza se deduce de sus colores. En el 4x4 hay cuatro centros de cada color (en el 5x5, cuatro en X y cuatro en cruz por color) que no se distinguen; con bloques, sí importa cuál es cuál (un centro blanco pegado a una wing y otro suelto se ven igual). Las wings no son problema: no se pueden voltear en su sitio, así que el orden de sus dos colores las distingue (24 distintas).
- **Decisión**: dentro del modo vendado, el estado no es de colores sino de **identidades**: `estado[posición] = número de la pegatina que hay ahí` (la pegatina i es la que está en la posición i en el resuelto; su color es ⌊i / N²⌋). Los giros mueven los números como movían los colores; el dibujo, la vista 3D y «resuelto» se calculan con los colores de siempre. Es un puzzle base propio (`crearCuboConIdentidad`, ids `vendado-4x4` y `vendado-5x5`, en `src/puzzles/nxn-identidad.js`) que envuelve al 4x4/5x5 normal: sin bloques delega en su solver pasando a colores (su solución vale para el estado de identidades). Se descartó llevar la identidad «aparte» del estado de colores: todas las funciones que reciben un estado (Worker, reproductor, editor, URL) tendrían que llevar las dos cosas.
- **Pintar un estado mezclado: desactivado**, con un mensaje («no se puede pintar: hay centros del mismo color y, con colores, no se sabe cuál es cuál»). No hay forma de deducir la identidad de los centros sin ambigüedad (tampoco eligiendo «la más probable»: con bloques, la elección decide si el estado es alcanzable). El estado siempre sale de giros (scramble, cargar, reproducir).
- **«Resuelto»** = cada cara de un color y, si hay bloques con piezas iguales, cada uno de esos bloques en las posiciones del resuelto. Lo segundo lo encontró un test: en el 5x5, un bloque centro fijo + centros en X y en cruz girado en su sitio tiene los mismos colores, pero otro pegado.

## Giros y legalidad
La regla es la de siempre (un giro es legal si mueve todas las piezas de cada bloque o ninguna), con los mapas y capas que da el soporte: caras, anchos (`Uw`, `3Uw`), capas interiores (`2U`, notación SiGN) y rotaciones. El test compara `movimientoLegal` con la regla aplicada directamente a los puntos de cada bloque, con todos esos giros, en todas las configuraciones.

Las búsquedas usan un conjunto reducido de giros; está demostrado (y comprobado con BFS) que no se pierde nada:
- **4x4** (N par): giros de U, R y F de 1, 2 y 3 capas (27). La esquina DBL no se mueve nunca y fija la orientación (el estado se normaliza con la rotación que la deja en su sitio). Los bloques son conexos por caras, así que un bloque que tiene piezas a ambos lados de un plano de corte tiene dos piezas vecinas a ambos lados: un giro de las capas i..j es legal ⇔ ningún bloque cruza los dos planos que lo limitan. Por eso cualquier giro (una capa interior `2U` = `Uw U'`, una cara opuesta `D` = `3Uw` salvo la rotación `y`…) es, salvo una rotación, un producto de giros de búsqueda legales a la vez que él.
- **5x5** (N impar): los centros fijos quedan fijos (como en el 3x3) con los giros de las 6 caras de 1 y 2 capas **y las capas interiores `2U`…** (54). Las capas interiores no sobran: el núcleo está unido a los seis centros fijos, así que un bloque `U + núcleo + D` cruza los planos de la capa 2 sin tener piezas en ella. Ahí `2U` es legal aunque `U` y `Uw` no lo sean. Con eso, todo giro de capas contiguas (también las que contienen la capa del medio, que son una rotación por el resto) se escribe con giros de búsqueda legales.
- Comprobación (test): en configuraciones pequeñas, BFS con **todos** los giros con nombre (caras opuestas, anchos de N−1 capas, capas interiores y rotaciones), normalizando la orientación, llega exactamente a los mismos estados que el BFS con los giros de búsqueda. En el 5x5 con `U + núcleo + D`, `2U` es legal y `U`, `Uw` no.
- **Notación**: en el 4x4, `3Uw` es `D` más una rotación `y` (libre). Las soluciones y los scrambles se escriben con `D` y los giros siguientes se traducen a la orientación nueva (`notacion` del soporte); el estado final es el resuelto girado. Test: 30–200 secuencias al azar dan el mismo estado salvo rotación y nunca queda un `3Xw`.
- Redundancias: con varias familias por eje (U, Uw, 3Uw), `U Uw D` no es redundante (cada plano de corte cambia de ángulo) y el criterio «tres del mismo eje» del 3x3 no sirve. Para el 4x4 y el 5x5: redundante si en un tramo de giros del mismo eje se repite una familia. Las reglas internas (forma canónica, palabra reducida del paseo, `redundante` del BFS) se escribieron de forma que en el 3x3 dan exactamente lo mismo que antes.

## Reglas de validación de los bloques
- **Vecinas** = cubies que comparten una cara (la misma regla que el 3x3). En el 4x4 eso deja fuera: esquina y centro (solo un vértice), centros en diagonal y **centros de caras distintas** (en un 4x4 nunca se tocan).
- **N par: no hay núcleo ni centro fijo.** No se puede pegar nada «al núcleo» ni unir centros opuestos directamente; solo a través de una cadena de piezas de la superficie (que sí es un bloque válido, como en el 3x3 desde la noche 10).
- **N impar**: un punto sin pegatina para el núcleo, vecino **solo de los seis centros fijos** (están montados sobre él). Así se pueden unir centros opuestos a través del núcleo (`U + núcleo + D`, como el Bandaged Cube de Meffert en el 3x3). El núcleo no es vecino de los centros en X ni en cruz.
- **Totalmente bloqueado** ⇔ cada plano de corte (3·(N−1)) lo cruza algún bloque; basta un plano libre para tener un giro. Test: con todas las piezas en un bloque, bloqueado; con todo menos la capa U, solo gira U.

## Recuento: estados distinguibles
- Como en el 3x3, estados (con identidades) = |geometrías| · |grupo de la fase 2|. Pero eso cuenta como distintos estados que se ven igual (centros del mismo color cambiados).
- Dos estados se ven igual si se pasa de uno a otro cambiando entre sí piezas iguales sin cambiar qué posiciones están pegadas. Sea **K** el conjunto de esos reetiquetados h con los que el resuelto (reetiquetado) sigue siendo alcanzable. Reetiquetar conmuta con los giros y no cambia la legalidad, así que K es un grupo y cada estado alcanzable tiene exactamente |K| versiones alcanzables con su aspecto: **distinguibles = estados / |K|**.
- |K| = |K libres| · n_bloq:
  - **K libres** (centros iguales que no están en ningún bloque): son los elementos del grupo de la fase 2 que solo mueven esos centros (Gc) y conservan los colores. Para tener Gc, la cadena de Schreier–Sims empieza por **todos los demás puntos** (prefijo de la base): los niveles siguientes son exactamente Gc. |K libres| = |Gc| / |órbita de la coloración|. Si Gc contiene el alternado de cada una de sus órbitas (se comprueba con el orden del subgrupo que solo mueve esa órbita: ≥ n!/2) y en cada órbita se repite algún color, la órbita es «todas las colocaciones con los mismos colores en cada órbita» (un multinomial por órbita). Si no se cumple, el número se marca como aproximado (no ha pasado en ninguna configuración probada).
  - **n_bloq** (centros iguales dentro de bloques): se enumeran los reetiquetados que llevan cada bloque, por una rotación rígida, sobre otro de la misma forma y colores (o sobre sí mismo), y para cada uno se comprueba si el resuelto así reetiquetado es alcanzable salvo un reetiquetado de los libres: geometría en la tabla, transporte por el camino del árbol y criba por los niveles del prefijo; el resto solo mueve centros libres y vale si cada órbita de Gc conserva sus colores.
- **Comprobación**: sin bloques salen exactamente las cifras publicadas: 4x4 **7.401.196.841.564.901.869.874.093.974.498.574.336.000.000.000** y 5x5 **282.870.942.277.741.856.536.180.333.107.150.328.293.127.731.985.672.134.721.536.000.000.000.000.000**. En los espacios pequeños, el BFS completo da los mismos estados y el mismo número de aspectos distintos (colores + qué posiciones están pegadas), también con |K| = 4 (un bloque de los cuatro centros de U que puede girar con el resto resuelto).
- **Schreier–Sims aleatorio**: el determinista tardaba 1,5–3 s en el 4x4 y 10–16 s en el 5x5. Con piezas iguales se usa el aleatorio: los lazos del más corto al más largo hasta que 3.000 seguidos no amplían el grupo, elementos al azar del grupo (product replacement) hasta que 50 seguidos no lo amplían, y 5.000 lazos más al azar que tienen que estar dentro. Si el grupo construido fuera menor, un elemento uniforme del grupo de verdad caería fuera con probabilidad ≥ 1/2, así que el orden es exacto salvo con probabilidad ≤ 2⁻⁵⁰. Test: da lo mismo que el determinista y que otra semilla. El 3x3 sigue con el determinista (mismas cifras publicadas).

## Solver
- **Espacio pequeño** (BFS completo de hasta 2 millones de estados con identidades): solución **óptima a la vista**. La distancia del BFS es a «el resuelto con estas etiquetas», pero se puede acabar en cualquier reetiquetado de K: los estados con el aspecto del resuelto se buscan en la tabla (son |K|, se comprueba) y se resuelve el reetiquetado de S más cercano. Test: en todos los estados de dos configuraciones pequeñas por tamaño, la longitud es la del BFS de aspectos (en el 4x4 «casi bloqueado» el diámetro baja de 18 con etiquetas a 12 a la vista).
- **Espacio grande: estrategia B con tablas de Minkwitz** (`src/core/minkwitz.js`). Ni la búsqueda directa ni la fase 2 por IDA* llegan a resolver un 4x4 (sin solución en 30 s, medido): solo sirven cerca del resuelto. La fase 2 (desde la geometría resuelta) es un problema de grupos de permutaciones con generadores conocidos y legales: los lazos del BFS de geometrías, que son palabras de giros legales (camino del árbol + giro + camino de vuelta). Minkwitz (1998) da, para cada pieza en el orden de una base, una tabla de palabras cortas que la llevan a su sitio sin mover las anteriores; resolver es aplicar una entrada por pieza. Las tablas se llenan cribando productos al azar de generadores y productos de dos entradas, quedándose con la palabra más corta.
  - **Legalidad**: las entradas son lazos (salen y vuelven a la geometría resuelta), y la legalidad solo depende de la geometría, así que cualquier entrada es legal desde cualquier estado de la fase 2. Las palabras se simplifican uniendo giros de la misma cara dentro de un tramo del mismo eje: los giros de un eje no cambian qué planos de ese eje cruzan los bloques, así que la legalidad de cada giro no depende de su orden dentro del tramo.
  - **Generadores cortos**: con miles de geometrías hay cientos de miles de lazos de hasta 2·diámetro+1 giros. Se ordenan por longitud y se toman 200, 400, 800… hasta que el grupo que generan tiene el orden de la fase 2 (en el 5x5 «varios», de no llenar las tablas a ~460 giros por solución).
  - **Orden de la base** (medido): al final van las piezas con 3-ciclos puros cortos (wings, centros en X); las últimas tablas solo admiten elementos que no mueven nada más. En el 5x5, con las aristas centrales y los centros en cruz al final, las tablas no se llenaban en 6 s y las soluciones salían de 1.400–2.800 giros (o ninguna); al principio, se llenan en 3 s y bajan a ~400. En el 4x4, esquinas–aristas–centros fue lo mejor medido (con las aristas al final, un 25 % más largo).
  - **Límite de longitud** de lo que se criba: 60 (con 250, un 15 % más largo en el mismo tiempo), salvo en un modo de rescate al final si falta alguna entrada (se admiten palabras largas en los niveles que faltan; la mejora las acorta).
  - **Centros iguales**: en el nivel de un centro suelto vale cualquier centro libre de su color; se elige el de palabra más corta (si con eso se llega a un nivel sin entrada, se resuelve sin elegir). De ~700 a ~510 giros en el 4x4.
  - **Varios intentos**: además se prueba a empezar por un lazo corto (prefijo) y se queda la más corta; y se combinan varias soluciones de la fase 1. La frontera entre fases se recoloca tras simplificar la unión.
  - **Nunca se muestra una solución sin comprobar**: el envoltorio aplica la solución giro a giro sobre el estado del usuario (cada giro legal en su momento, ningún bloque roto, final resuelto) antes de devolverla; si no pasa, devuelve un error y no la solución. La de la otra estrategia (que la interfaz deja ver) también se comprueba.
- Tiempos: tablas de Minkwitz 3 s (más 1–2 s del resto del análisis) por configuración; resolver, ~1 s.

## Scramble
- Espacio pequeño: estado uniforme de la tabla del BFS (uniforme también a la vista: cada aspecto tiene |K| estados), descartando los que están a menos de 2 giros **a la vista**.
- Espacio grande: el paseo al azar perezoso de pasos fijos de siempre. Medido con `scripts/mezcla-bloqueos.mjs 1500 4x4` y `5x5`: el criterio del 3x3 (TV por pieza) no sirve en el 4x4 (con 24–72 posiciones por pieza, el ruido de muestreo es ~0,07 y «pasa» con 25 pasos). Se añadió un criterio escalar con poco ruido: la media de piezas que se ven en su sitio, frente a paseos de 6.400 pasos, con margen de 3 errores estándar. Hacen falta 50–100 pasos en todas las configuraciones medidas; se usa **max(200, 4·d²)** (el doble), que da scrambles de ~140 giros en el 4x4. En el 3x3 nada cambia (max(80, 4·d²)).

## Interfaz
- Bandaged Cubes tiene un selector 3x3 / 4x4 / 5x5. La URL lleva el puzzle (`#/bandaged?puzzle=4x4&bloqueos=…`); sin `puzzle`, el 3x3, así que los enlaces de antes siguen igual (test). Las firmas del Bandaged Cube Explorer son solo del 3x3: en el 4x4 y el 5x5 no aparecen y una `firma=` en la URL se ignora.
- Cada puzzle recuerda sus bloques (al cambiar de uno a otro y en el navegador; la clave del 3x3 es la de siempre). Las configuraciones guardadas llevan su puzzle (las de antes, sin él, son del 3x3).
- El editor de bloques es el mismo: se toca el cubo resuelto en 2D o 3D. Pintar el estado: desactivado en el 4x4 y el 5x5, con el motivo en lugar de la paleta y al tocar una pegatina.
- El análisis dice los estados distinguibles (y los que serían contando los centros iguales como distintos) y avisa de que las soluciones de los espacios grandes son largas.

## Lo que no funcionó / límites
- **Búsqueda directa e IDA* en espacio grande**: sin solución en 30 s para un 4x4 mezclado con una sola pareja (medido); por eso Minkwitz.
- **Minkwitz con palabras sin límite / con los lazos largos / rellenando con palabras largas desde el principio**: tablas con entradas de cientos de giros (media 105) y soluciones de 700–900.
- **Vendados reales que simulan cuboides** (twistypuzzles: «2x4x4 (bandaged 4x4x4)», «3x4x4 (bandaged 4x4x4)», Cubetwist): pegan por parejas las piezas a ambos lados de uno o dos cortes, así que **todas** las piezas están en bloques y la geometría es casi el estado entero: más de 400.000 geometrías (límite del BFS) en 40 s. Sin la tabla completa de geometrías no hay estrategia B ni tablas de Minkwitz, y el solver no llega. Se pueden construir con `bloquesSinCortes` (en `nxn-identidad.js`), pero no están entre los ejemplos de la interfaz. Para esos haría falta tratar los bloques como piezas de un puzzle reducido (pendiente).
- **Ejemplos reales en la interfaz**: los vendados de 4x4 y 5x5 más conocidos (AI Cube, Wall Cube, Chimera…) tienen patrones que no encontré descritos con exactitud pieza a pieza, o son de los que todas las piezas están en bloques (ver el punto anterior). Los ejemplos de la interfaz son configuraciones propias (pareja, barra, bloque de centros, varios bloques y, en el 5x5, centros opuestos por el núcleo).

## Sesión «orden de Bandaged Cubes» (24/11/2026)
- **Orden por sección moviendo los nodos, no con CSS `order`.** Antes, Tus bloques iba primero solo por `order: -1`: se veía primero pero el tabulador (y un lector de pantalla) lo recorría el último (Scramble → Resolver → Tus bloques; lo detectó la comprobación en Chromium). Ahora `ordenarPaneles(seccion)` (main.js, llamado desde `aplicarRuta`) coloca los paneles: en Bandaged Cubes, Tus bloques → Resolver → Scramble; en WCA Puzzles, el orden de siempre. Se mueven los mismos nodos (no se recrean): escuchadores, estado y lienzos WebGL se conservan, y la prueba de humo lo comprueba (mismo `#vista-editor` al ir y volver).
- **Envoltorio `.paneles-par`** (Tus bloques + Resolver en Bandaged; Scramble + Resolver en WCA). En WCA es `display: contents`, así que la maqueta de WCA es exactamente la de antes (la misma rejilla `auto-fit` de dos columnas). En Bandaged, desde **1000 px** es una rejilla de dos columnas iguales (el cubo del Resolver a la derecha) y el Scramble va debajo a todo el ancho; por debajo, una sola columna en el mismo orden (tablet y móvil). Elegí 1000 px porque con el padding de la app cada columna queda en ~460 px, donde el 3D (380 px de alto) y los botones del Resolver aún caben en una fila o dos; a 900 px el panel de bloques se volvía demasiado estrecho para sus filas de botones.
- **«Tus bloques» más alto que el cubo** (pasa en cuanto hay 3–4 bloques o se abre «Guardar, compartir e importar»: 1.163 px frente a 687 del Resolver en el 3x3 con «Varios bloques»). En escritorio el panel Resolver es `position: sticky; top: 16px`: al bajar por la lista el cubo sigue al lado y se puede seguir tocando piezas. Por qué el panel entero y no solo el lienzo: un lienzo fijo se montaría sobre los botones y la solución que tiene debajo. Por qué dentro de `.paneles-par`: un elemento sticky no sale de su contenedor, así que el Resolver nunca baja hasta tapar el Scramble (comprobado en Chromium). Solo se fija si **cabe entero en la ventana** (clase `.cabe`, que pone un `ResizeObserver` en main.js): con una solución larga mostrada (cientos de giros en el 4x4/5x5) el panel es más alto que la pantalla y fijarlo escondería su propio final (reproductor) hasta acabar la lista. En móvil y tablet no hay nada fijo.
- No he tocado nada de la lógica de bloqueos, solvers ni scrambles: solo plantilla, CSS y `ordenarPaneles`/`vigilarResolverFijo` en main.js.

# Sesión «validador con muchas geometrías» (25/11/2026)

## El fallo
Configuración: 5x5 con 16 bloques (las tres columnas de centros de F, R, B y L, cada una pegada a la arista de D de debajo, y las cuatro aristas verticales con su esquina de D: 16 barras de 4 piezas). Scramble de la propia app: `2R2 2B 2F' Fw' F Bw2 B2 R2 2B2 Bw' Fw F B L' B`. Al cargarlo en Resolver: «Este estado no es posible» + «No se pudo comprobar la forma (demasiadas geometrías)».

## Diagnóstico (con datos)
- **El estado es alcanzable**: cada giro del scramble es legal en su momento y los bloques siguen enteros (test «el scramble de la app … se carga sin errores», `aplicarComprobando` giro a giro).
- **Causa**: el BFS de geometrías se cortaba en 400.000 (`LIMITES.geometrias`) a distancia 7. La geometría del estado no estaba en esa tabla incompleta, y `analizar` devolvía `valido: false` con el texto «No se pudo comprobar la forma»; la interfaz trata todo `valido: false` como «Este estado no es posible». Es decir: **se rendía al llegar al límite del BFS y lo trataba como «no alcanzable»**. Con el código de antes, el test nuevo falla (`valido` es false).
- **Geometrías: 80.452.680 exactas, diámetro 31.** BFS en C fuera de la app (cada barra se codifica por su colocación: 16 o 24 colocaciones por clase; la geometría = el conjunto de colocaciones de cada clase, en el sistema combinatorio: 51 bits) en 4 min y ~1,5 GB. Los niveles 0–9 coinciden con el BFS de la app (1, 36, 494, 3.656, 19.662, 79.166, 242.184, 614.385, 1.265.592, 2.308.108); el más poblado es el 14 (10.301.832). La estimación por muestreo que hice antes (`scripts/geometrias-bloqueos.mjs`: 36 millones, IC 95 % 32–42 M) **se quedó en menos de la mitad**: los paseos de 25.600 pasos no mezclaban la geometría (ver «Mezcla»). Lo dejo como aviso: un intervalo de confianza no protege de un muestreo sesgado.
- **Grupo de la fase 2: 14.092.289.066.888.331.264.000 (demostrado)**: |R| · |H0| con R = 13.824 permutaciones de las barras y |H0| = 1.019.407.484.583.936.000 (ver «Cota superior»). Estados = 80.452.680 · 1,409·10²² ≈ 1,134·10³⁰ (contando los centros iguales como distintos).

## Tres resultados del validador
`validar(estado, { secuencia })` devuelve `resultado`: **'valido'** (demostrado: hay un camino de giros legales), **'imposible'** (demostrado) o **'sin-comprobar'**. `valido` es true solo con 'valido'; 'sin-comprobar' lleva `avisos` y ningún error, y la interfaz lo muestra como aviso (`.mensaje.aviso`) y **deja resolver**: si sale una solución, se comprueba giro a giro, y eso demuestra que era alcanzable.
- Imposible (demostrado): el validador del cubo sin bloques (colores, paridades), bloques rotos, geometría fuera de la tabla **completa**, o fuera del grupo de la fase 2 sabiendo que el grupo encontrado es el entero (BFS completo y exacto, o cota superior alcanzada).
- Sin comprobar: no se encuentra a tiempo un camino de la geometría a la tabla, o el estado no está en el grupo encontrado y no se sabe si ese grupo es el entero. Antes, ese segundo caso (posible en el 3x3 con más de 300.000 lazos) se daba como **válido** sin serlo; ahora es «sin comprobar». En los scrambles de las configuraciones de siempre no cambia nada (están en el grupo).
- **Un scramble de la app cargado sin tocar es alcanzable por construcción**: `main.js` guarda la secuencia al pulsar «Cargar scramble actual» y la manda al validar y al resolver; el Worker aplica la secuencia al resuelto con giros legales y comprueba que da exactamente ese estado. Si el usuario lo ha editado, no coincide y se valida como siempre (la comprobación está en el Worker, no en la interfaz).

## Alcanzabilidad sin enumerar las geometrías
- **Método: búsqueda best-first (A* con peso, f = g + 2·h) desde la geometría del estado hasta cualquier geometría de la tabla** (la bola de radio ~7 que sí cabe), y de ahí el camino del árbol. h = suma, por bloque, de la distancia de su colocación a la casa más cercana de un bloque de su clase moviéndolo solo a él (16 y 24 colocaciones por barra; se calcula al analizar). Luego se lleva el estado a la geometría resuelta por ese camino y se mira si está en el grupo de la fase 2.
- **Por qué esto y no IDA* o BFS desde los dos extremos**: no hace falta el camino más corto, solo uno legal, y la bola ya es un BFS desde la resuelta de 400.000 nodos (el «otro extremo» ya está hecho). Una cota admisible (máximo por bloque) da 1: IDA* no podaría nada. Medido: 50 geometrías de paseos de 200 / 5.000 / 30.000 pasos, todas encontradas, 5 / 45 / 78 ms de media (máx. 0,6 s). Con la voraz pura (f = h) los caminos salían de ~63 giros (máx. 157) en geometrías mezcladas; con f = g + 2·h, ~20 (máx. 27; la distancia exacta media es 14,5) y más rápido. Límite: 3 s al validar; si no llega, 'sin-comprobar'.

## Grupo de la fase 2 cuando el BFS no cabe
- **Los lazos de la bola no generan el grupo entero**: con las aristas de los 400.000 nodos salía 3,9·10²⁰ (36 veces menos). Se añaden **lazos al azar** (paseo perezoso de 400 pasos + vuelta con el buscador, comprobados giro a giro) de 40 en 40 hasta llegar a la cota (118–158 lazos en el 5x5).
- **Cota superior**: todo lazo es un elemento del grupo SIN bloques que lleva cada barra, ranura a ranura, sobre una barra de su clase. Esos elementos son |R| · |H0|: H0 = estabilizador punto a punto de las ranuras (cadena con prefijo), R = permutaciones de las barras (dentro de cada clase) que algún elemento del grupo sin bloques realiza. |R| se cuenta sin enumerarlo (R es un grupo: producto de las órbitas de cada barra fijando las anteriores, decidiendo cada una con una búsqueda en profundidad que criba la imagen de las ranuras nivel a nivel). Si el grupo encontrado tiene ese orden, es el entero: `info.grupoFase2Exacto`. 5x5 de 16 barras: R = 13.824 (de 4!⁴ = 331.776); 2x4x4: R = 8,19·10¹² y |g2| = 1,65·10¹⁷.
- **Un fallo que encontré en `completarAleatorio`**: la tupla del product replacement se llenaba solo con los 30 primeros generadores. Con miles de lazos, esos 30 pueden generar un subgrupo propio y la cadena se da por completa sin estarlo (aquí, un factor 3: la misma cadena daba 1,3·10²⁰ o 3,9·10²⁰ según el orden de la base). Opción nueva `todos`: la tupla empieza con subproductos aleatorios de TODOS los generadores (Babai). Solo se usa en el caso nuevo; sin la opción, todo igual que antes (las configuraciones de la noche 13 están contrastadas con BFS y con el Schreier–Sims determinista, así que no las toco, pero queda anotado como riesgo en configuraciones con muchos lazos).

## Mezcla y longitud del scramble
- **Sí: los 15 giros salían cortos por el diámetro**. Con la tabla cortada, `diametroGeometria` = 7 (el de la bola) y max(200, 4·7²) = 200 pasos del paseo perezoso → palabra reducida de ~14 giros.
- **Medido** (criterio de `mezcla-bloqueos.mjs`, piezas en su sitio frente a paseos muy largos): 200 pasos → 34,3 piezas en casa; 12.800 → 25,8; 102.400 → 21,2; 204.800 → 21,0 (convergido). Y la geometría, con la distribución EXACTA de la distancia (BFS en C) como referencia: TV 0,62 / 0,29 / 0,19 / 0,066 / **0,040** / 0,033 con 1.600 / 12.800 / 25.600 / 102.400 / **204.800** / 409.600 pasos. El criterio por proyecciones que probé antes (TV de la colocación de cada barra frente a paseos de 25.600) «pasaba» con 6.400 pasos: comparaba contra una referencia que tampoco estaba mezclada. Lo que no funcionó, anotado.
- **Scramble nuevo cuando el BFS no cabe** (y el grupo es exacto y hay tablas de Minkwitz): estado = h uniforme en el grupo de la fase 2 (elemento uniforme de la cadena) seguido de un paseo perezoso de **409.600 pasos** (el doble de lo medido) para la geometría; el scramble es la **inversa de una solución rápida** de ese estado (camino de geometría + Minkwitz), comprobada giro a giro. Dada la geometría, el estado es uniforme (h ↦ h·w es una biyección); la geometría del paseo está a TV 0,033 de la uniforme. Piezas en casa de estos scrambles: 20,2 ± 0,6 (referencia 21,0 ± 1,0). Escribir el estado como «palabra de h + paseo» daba ~980 giros; así, ~600. Si no hay tablas o el grupo no es exacto: paseo perezoso de 409.600 pasos (miles de giros; no pasa en las configuraciones probadas).
- **Longitudes**: 5x5 de 16 barras, ~600 giros (370–930); 2x4x4, ~150. Tiempo: ~0,2 s por scramble en Node. Las tablas de Minkwitz tienen límite de tiempo, así que los scrambles de este caso no se repiten byte a byte con la misma semilla en máquinas distintas (las soluciones ya no se repetían antes).

## Solver
Estrategia B con la fase 1 del buscador (camino hasta la bola y luego las soluciones de siempre desde ahí) y la fase 2 con tablas de Minkwitz hechas con los lazos de la bola y los lazos al azar (antes no había tablas sin el BFS completo). Toda solución se comprueba giro a giro. El scramble del fallo: 9 giros (solo geometría). Ver ESTADO.md para las cifras de 200 casos.

## Velocidad del análisis (solo cambia en las configuraciones que no caben)
- `canonica` sin crear arrays (inserción sobre una copia): mismo resultado, el BFS de geometrías 3 veces más rápido. Esta sí afecta a todas, pero da exactamente lo mismo (comparado: análisis, 15 scrambles con semilla y soluciones por BFS de las 9 configuraciones del 3x3 y las 12 del 4x4/5x5, idénticos antes y después).
- El BFS para del todo al llegar al límite (antes seguía recorriendo los 400.000 nodos solo para anotar aristas: el 75 % del tiempo) y el grupo de la fase 2 coge menos lazos de la bola (los completa con los al azar). 5x5 de 16 barras: de 67 s a ~13 s en Node (~16 s en Chromium de escritorio).

## Otras configuraciones con el mismo problema
Simulaciones de cuboides sobre el 4x4 (`bloquesSinCortes`): **2x4x4** (sin los cortes 1|2 y 3|4 de y) y **3x4x4** (sin el corte 1|2). Las dos daban más de 400.000 geometrías y en la noche 13 quedaron como «no llega». Ahora: tablas en 11–14 s, grupo exacto, scrambles de ~150 y ~310 giros, todos válidos, y el solver las resuelve (20/20 cada una en las pruebas: ~73–130 y ~260 giros). El 2x4x4 está en los tests.

## Lo que no funcionó
- Estimar el número de geometrías y la mezcla con paseos de 25.600 pasos (sesgados hacia la resuelta: ver arriba).
- La búsqueda voraz pura: caminos 3 veces más largos.
- Contar R enumerándolo (con barras de clases grandes, como el 2x4x4, eran 48 s; con el producto de órbitas, 0,15 s).

# Sesión «509 giros, determinismo y scramble práctico» (26/11/2026)

## Bloque 1: los 509 giros
**Síntoma** (GitHub Pages, Chromium de escritorio, 5x5 de 16 barras): cuatro scrambles distintos (783, 575, 793 y 972 giros) daban siempre una solución de 509 giros.

**Investigación** (desde aquí no se llega a github.io por el proxy; lo reproduje con el `dist/` del mismo commit que publica Pages, en Chromium con Playwright, `herr/inv509*.py`):
- *Unicidad de estados*: 20 scrambles (semilla 11) → 20 estados distintos (md5 del estado). En Chromium, 5 scrambles con «Cargar» cada vez → 5 estados distintos en el editor y 5 soluciones distintas (552, 472, 791, 782 y 673 giros). El generador no repetía estados.
- *Estado objetivo*: lo mismo pero pulsando «Cargar» solo la primera vez (Nuevo scramble → Resolver directamente): **el estado del editor tenía la misma huella las cuatro veces** (746d25d8) y las soluciones salieron de 286, 286, 288 y 285 giros con los mismos 12 primeros giros (dos idénticas byte a byte; las otras cambian unos pocos giros porque Minkwitz prueba prefijos al azar). Era el patrón de los 509: el solver resolvía bien, pero un estado residual, el del scramble cargado antes.
- *Las soluciones*: todas comprobadas giro a giro (legales, dejan el resuelto). No había ningún fallo en el solver.
- *Trazado del solver* con scrambles legales cortos desde el resuelto (Node): 1 giro (`L2`) → 1 giro, estrategia A (IDA*); 3 (`Lw' R' L'`) → 3, A; 5 (`2F' B F2 Bw2 2B2`) → 3, A; 10 → 162, estrategia B (geometría 5 + Minkwitz 157). Las cuatro geometrías están en la tabla; ninguna pasa por un plan de respaldo.

**Causa raíz**: «Nuevo scramble» no tocaba el editor. Con un scramble cargado, «Resolver» resolvía otra vez el estado del scramble ANTERIOR, aunque el panel mostrase uno nuevo; la solución vieja además seguía a la vista. No es propio de los vendados (pasa en todos los puzzles), pero en el 5x5 de 16 barras, donde cada solución tiene cientos de giros, «siempre la misma longitud» salta a la vista.

**Corrección** (`seguirScrambleEnEditor` en `main.js`): al llegar un scramble nuevo, si el editor tiene el scramble cargado antes sin tocar (se compara su huella), pasa al nuevo y se quita la solución vieja; si el usuario lo ha editado, se le deja y sale un aviso: «pulsa “Cargar scramble actual” si quieres resolver el scramble». Test: `app: tras un scramble nuevo, Resolver no resuelve el estado del scramble anterior` (fallaba antes: «el editor sigue con el estado del scramble anterior»). En Chromium, sin pulsar «Cargar»: 4 scrambles → 4 estados en el editor y 4 soluciones distintas.

**Una corrección del informe anterior**: dije que en Node los scrambles salían de ~550 giros y las soluciones de ~466. Esas cifras eran de dddb725; el commit siguiente (4c4aa6e: lazos al azar con paseos cada vez más largos) alargó los generadores de Minkwitz y, con el código que quedó publicado (7bb398d), salen **1.106 de media (410–7.137) y 809 (328–1.293)** (200 casos, semilla 11, medidos ahora). El máximo de 7.137 es la vuelta al paseo largo cuando la solución rápida no sale. No lo medí después del último cambio, y debía haberlo hecho.

## Bloque 2: el mismo scramble con la misma semilla en cualquier máquina
**Auditoría** (lo que llegaba a los scrambles del caso grande y dependía de la máquina):
- el análisis usaba `opciones.rng` o, en el Worker, `Math.random` (sin semilla): grupo de la fase 2, lazos al azar, generadores y tablas de Minkwitz;
- las tablas de Minkwitz se llenaban durante `msMax` ms (3 s): una máquina más lenta las llena menos y da otras palabras;
- los lazos al azar paraban a los 20 s; el buscador de geometría de `scrambleFase2` y de los lazos, a los 2 s y 1 s;
- `resolverS` elegía los prefijos con el rng interno de las tablas (gastado según lo que se hubiera resuelto antes).

**Cambios** (solo en las configuraciones cuyo BFS no cabe; las demás no se tocan):
- semilla fija para todo el análisis de esas configuraciones (`SEMILLA_GRANDES`);
- Minkwitz con **presupuesto en pasos** (`{ productos: 100.000, mejoras: 60.000 }`) en vez de milisegundos: en una máquina lenta tarda más, pero da las mismas tablas (en Node ~3 s, en un móvil con la CPU ×4 más lenta, ~4 veces más);
- buscador con límite de nodos (2 millones) y sin límite de tiempo; lazos sin límite de tiempo (40 vueltas como mucho);
- `resolverS(S, intentos, rng)` con el rng del scramble.
- `fijarRelojBloqueos(f)` (solo para tests) cambia el reloj del módulo.

**Test**: dos «máquinas» con semilla de análisis distinta (7 y 4242), `msMinkwitz` 3.000 y 150, y la segunda con el reloj 25 veces más rápido: los mismos scrambles mezclados y prácticos byte a byte (fallaba antes del cambio). El solver sigue teniendo límite de tiempo (no hace falta que sea determinista y en una máquina lenta debe cortar igual).

## Bloque 3: scramble práctico y scramble mezclado
- **Cuándo**: si mezclar necesita más de 10.000 pasos de paseo perezoso (`info.pasosMezcla`: 409.600 en las configuraciones que no caben; con el BFS completo, max(80, 4·d²) ≤ 2.304 en todas las probadas) **y** el scramble mezclado mide más de 200 giros (`info.longitudMezclado`, media de 3 con semilla fija, calculada al analizar; en el 5x5 de 16 barras, 687). Si el mezclado ya es corto, es mejor y no hace falta el práctico. Con el código actual pasa en el 5x5 de 16 barras y en el 2x4x4 (su mezclado mide ~300 de media, aunque hay de 83).
- **Práctico (por defecto)**: 100 giros legales al azar, cada uno elegido uniformemente entre los legales del estado al que se llega, y la palabra se reduce en cada paso hasta tener exactamente 100 (sin cancelaciones ni giros seguidos que se junten). Aviso en el panel: «Configuración muy restringida: scramble práctico de giros al azar, no de estado aleatorio. Mezclar de verdad necesita unos 409.600 pasos de un paseo al azar.»
- **Mezclado (a petición)**: botón «Scramble de estado mezclado (unos 687 giros)», que dice la longitud antes de pedirlo; con él activo, cada «Nuevo scramble» es mezclado (no sale de las precargas, que son prácticas) y el botón pasa a «Volver al scramble práctico (100 giros)».
- **Generadores de Minkwitz**: con los lazos al azar solo entran los más cortos que hacen falta (primer bloque de 2^k, por longitud, que completa el grupo). Bajó la media del mezclado de ~1.000 a ~900; probé también más prefijos (200 en vez de 20) y más rondas de mejora (400.000): ninguno cambió la longitud.

**Calidad de la mezcla del práctico** (distancia de la forma al resuelto frente a la distribución exacta de las 80.452.680 geometrías; `herr/c/bfs3.c`): 2.000 scrambles prácticos: **distancia media 9,99 frente a 14,49 exacta, TV 0,567**; el 61 % está a distancia ≤ 10, frente al 10,5 % de las geometrías; el más lejano, a 21 (el diámetro es 31). 300 mezclados: media 14,58, TV 0,109 (con 300 muestras, del orden del ruido). Es decir: el práctico deja la forma claramente más cerca de la resuelta que un estado al azar; sirve para practicar, no para competir, y así lo dice la interfaz.

## Bloque 4: CI
- Fuera `.github/workflows/suite-bloqueos.yml`. La rama remota `suite/bloqueos` no se pudo borrar desde la sesión (el proxy corta el `git push --delete`): hay que borrarla a mano en GitHub (Branches). para lanzar la suite de bloqueos sin permisos de `workflow_dispatch`, después de ejecutarla una última vez con este código: ejecución 45815805833, ✔). La suite completa se lanza a mano desde «Tests (rápido)» con el nivel `completo` (ver ESTADO.md).

# Sesión «longitud del scramble práctico» (26/11/2026)

- **Longitud por defecto = la del scramble WCA del tamaño**: la de la app (`LONGITUD_WCA` de nxn.js, comprobado generando scrambles): **40 en el 4x4 y 60 en el 5x5** (25 en el 3x3, donde el práctico no sale en ninguna configuración probada). `puzzleConBloqueos` la toma del puzzle base (`longitudScramble`), así que vale igual en la interfaz, el Worker y los tests. El umbral para usar el práctico no cambia (mezclar > 10.000 pasos y mezclado > 200 giros).
- **Selector** (solo con el práctico): `30 · 60 (WCA) · 100 · Mezclado (unos N)`; en el 4x4, `30 · 40 (WCA) · 100 · …`. Junto a él, la calidad de la elegida: «Mezcla de la forma: 36 % (distancia media de la forma al resuelto 9,38, frente a 14,49 en un estado al azar)». La elección va en la URL (`&scramble=30|40|60|100|mezclado`) y se recuerda en el navegador (`localStorage['cubo-solver:scramble-practico']`); prioridad: URL, navegador, WCA. Una longitud que la configuración no ofrece (60 en un 4x4) cuenta como la WCA. Las configuraciones sin práctico no muestran nada ni llevan `scramble=` en la URL aunque haya una elección guardada (test).
- **Longitud anunciada del mezclado**: la media de 3 del análisis (que decide si se usa el práctico, y no la cambio para no mover ese umbral) se quedaba corta: 687 frente a 922 de media con 200 en el 5x5. El selector anuncia la media medida (`longitudMedia` en la tabla de calidad: 922 y 171) y, si la configuración no está medida, la estimación del análisis.
- **Determinismo**: `generarScramble(rng, { giros })` solo depende de la semilla (paseo sobre los giros legales); el test de las dos «máquinas» comprueba 30, la WCA, 100 y el mezclado.
- **Calidad por longitud** (200 scrambles por longitud, semilla 77; distancia de la forma al resuelto frente a la distribución EXACTA: BFS completo en C, `herr/c/bfs5.c`; el 2x4x4 tiene **807.003 geometrías, diámetro 11**). «Mezcla» = 1 − TV entre las dos distribuciones de distancia; con 200 muestras la TV tiene un ruido de ~0,05–0,1, por eso el mezclado no llega al 100 %. Los valores se guardan en `src/core/calidad-practico.js` (solo de estas dos configuraciones; las demás no muestran la calidad).

| Configuración | Longitud | Mezcla de la forma | Distancia media (exacta) | % de formas a distancia ≤ 10 (exacta) |
| :--- | :--- | :--- | :--- | :--- |
| 5x5 de 16 barras | 30 | 24 % | 8,03 (14,49) | 86,0 % (10,5 %) |
| 5x5 de 16 barras | **60 (WCA)** | **36 %** | 9,38 (14,49) | 69,5 % (10,5 %) |
| 5x5 de 16 barras | 100 | 46 % | 10,21 (14,49) | 58,0 % (10,5 %) |
| 5x5 de 16 barras | mezclado (~922 giros) | 90 % | 14,46 (14,49) | 12,5 % (10,5 %) |
| 2x4x4 (4x4) | 30 | 86 % | 7,81 (8,08) | 100 % (100 %) |
| 2x4x4 (4x4) | **40 (WCA)** | **90 %** | 7,90 (8,08) | 100 % (100 %) |
| 2x4x4 (4x4) | 100 | 93 % | 7,97 (8,08) | 100 % (100 %) |
| 2x4x4 (4x4) | mezclado (~171 giros) | 96 % | 8,04 (8,08) | 100 % (100 %) |

  En el 2x4x4 el «% a distancia ≤ 10» no distingue nada (el diámetro es 11): la forma mezcla casi del todo ya con 30 giros. En el 5x5 de 16 barras, ni 100 giros se acercan (46 %); el de 100 de la sesión anterior dio 43 % con 2.000 muestras y otra semilla (la diferencia es ruido).

# Noche 14: introducir el estado de un cubo físico colocando piezas y bloques (26/11/2026)

## Punto de partida (cómo era antes de esta noche)
- **WCA Puzzles**: el estado se introduce **pintando pegatinas** (paleta + herramientas como *Rellenar cara*, en 2D o tocando el modelo 3D) o con *Cargar scramble actual*. *Resolver* manda el estado al Worker (`validar`): colores mal contados, «hay N pegatinas sin pintar», paridades y orientaciones con mensajes por pieza; si es imposible, no se resuelve.
- **Bandaged Cubes 3x3**: igual (estado de colores; las piezas se distinguen por sus colores), más el validador de tres resultados (válido / imposible / sin comprobar) del envoltorio `puzzleConBloqueos` (bloques enteros, geometría alcanzable, grupo de la fase 2).
- **Bandaged Cubes 4x4 y 5x5**: **pintar desactivado** (`avisoPintar`): el estado es de identidades y, con colores, no se sabe qué centro es cuál. El estado solo podía salir de un scramble.

## Interacción
- Un modo nuevo, **Colocar piezas** (botón junto a *Cargar scramble actual*), en todos los puzzles con pegatinas fijas de las dos secciones: 2x2–7x7, Pyraminx, Skewb, Megaminx, FTO y los vendados 3x3/4x4/5x5. Pintar sigue donde estaba. El **Square-1 no**: sus piezas no tienen huecos fijos (la forma cambia); para él ya existe el editor de piezas de la noche 2.
- **Pantalla completa**: una capa fija que ocupa la ventana (`position: fixed; inset: 0`; `html.colocando` quita el scroll de la página) y, si el navegador la da, la API Fullscreen sobre esa capa (`requestFullscreen` en el mismo clic del usuario; si se niega, la capa ya ocupa todo). Se sale con *Cancelar*, Escape o *Aplicar y salir* (que sale también de la pantalla completa). Es un `role="dialog"` modal: el foco va al título al abrir, el tabulador no sale de la capa y al cerrar vuelve al botón.
- **Una mano en el móvil**: arriba solo lo que se mira (título, «Faltan N», 2D/3D, Cancelar); en medio el puzzle; abajo, en la zona del pulgar, lo elegido con sus botones (lista de piezas del hueco, *Girar*, *Siguiente posición*, *Quitar*), la bandeja (la única parte que se desplaza: lo elegido nunca se esconde) y la barra *Deshacer · Vaciar · Aplicar y salir*. En escritorio (≥ 900 px), el puzzle a la izquierda y el panel a la derecha. Todos los botones miden ≥ 44 px (lo mide la comprobación en Chromium).
- **Flujo**: bloques primero (elegir en la bandeja + tocar un hueco; o tocar el hueco y luego el bloque) y luego piezas sueltas (tocar un hueco + elegir en la lista; o elegir en la bandeja + tocar el hueco). Volver a tocar el hueco elegido lo deselecciona.
- **Validación en vivo**: en cuanto no falta nada se pide `validar` al Worker con prioridad alta; el resultado (válido / imposible con sus motivos / sin comprobar con su aviso) se muestra en el panel, y *Aplicar y salir* solo se activa si no es imposible.

## Modelo genérico (`src/core/colocar.js`)
- **Piezas** = las pegatinas de cada pieza del modelo 3D (`vista3D(resuelto)`: `pieza` e `indice`), en un orden fijo (su tupla). **Hueco k** = la casa de la pieza k. No hace falta nada específico de cada puzzle salvo los **generadores** (`colocarPiezas.generadores`) y, opcionalmente, los nombres de los tipos.
- **Dónde y cómo cabe cada pieza = la órbita de su tupla con los generadores** (BFS de tuplas; la permutación de cada giro se saca aplicándolo a un array 0..n−1). Así salen solas todas las reglas sin escribirlas: los centros del 3x3 no se mueven con giros de cara (se colocan solos), las wings no se pueden voltear (una sola orientación por hueco), el Skewb tiene dos órbitas de esquinas y una esquina fija con los giros WCA, las puntas del Pyraminx giran en su sitio, el FTO tiene dos órbitas de triángulos… Cálculo: ≤ 45 ms (7x7).
- **Generadores elegidos**: 3x3 y 5x5/7x7, las caras (y anchos), con lo que los centros fijos quedan fijos y se colocan solos (en un cubo real van unidos al núcleo); 2x2 `U R F` (la esquina DBL queda fija, como en los scrambles WCA: el usuario sujeta su 2x2 con esa esquina ahí); Megaminx, las 12 caras (no los giros Pochmann, que mueven los centros); Pyraminx, caras + puntas; Skewb y FTO, sus giros WCA.
- **Bandeja por grupos**: piezas sueltas del mismo tipo y los mismos colores son un grupo (los 4 centros blancos de un 4x4; también las **dos wings blanco-verde**, imágenes especulares: en un hueco solo cabe una de cada forma). Elegir un grupo en un hueco pone su primera disposición; **Girar recorre las disposiciones de colores distintas** que caben ahí (en una wing, cambiar a la gemela; en una esquina, sus 3 giros). Si la gemela ya está colocada en otro hueco, Girar las intercambia (así se arregla sin quitar nada). Qué pieza concreta del grupo se usa lo decide la app.
- **Bloques**: sus colocaciones son las **rotaciones rígidas del puzzle entero** (`soporteBloqueos.rotaciones`) en las que cada pieza del bloque cae en su órbita (un giro legal mueve un bloque entero con la rotación de su capa, así que un bloque entero está siempre en una de ellas). Con centros fijos (3x3) un bloque con un centro solo puede girar alrededor de ese centro, y lo da la misma regla. Solo se ofrecen las que **caben** (sin chocar con lo colocado); *Girar* recorre las que pasan por el hueco tocado y *Siguiente posición*, todas. Un bloque nunca se rompe al colocarlo (sus piezas no están en la bandeja).
- **Colocación automática**: un hueco se rellena solo si en él cabe un único grupo **y de una sola forma**, y además ese grupo es de piezas fijas o ya no quedan bloques por colocar (si quedan, el hueco podría ser de un bloque). Al tocar un hueco en el que solo cabe un grupo, se coloca sin pasar por la lista.

## Validación respecto a un estado conocido
- Se reutiliza el validador de siempre (el de cada puzzle y el de tres resultados de los vendados); no se ha duplicado nada. Todos comprueban **alcanzabilidad desde el estado conocido = el resuelto de esa configuración**:
  - WCA: invariantes por órbita (colores contados, paridades de permutación, sumas de orientación…), demostrados con Schreier–Sims en cada puzzle (noches 3, 5 y 12): un estado cumple los invariantes ⇔ está en la órbita del resuelto bajo el grupo.
  - Vendados: geometría en la tabla (o camino de giros legales hasta ella) + pertenencia al grupo de la fase 2 tras transportar el estado a la geometría resuelta.
- **Por qué basta con el resuelto**: los giros son invertibles, así que «alcanzable desde E₀» es una relación de equivalencia; para cualquier estado conocido alcanzable K (por ejemplo, un scramble de la app), alcanzable desde K ⇔ alcanzable desde el resuelto. En los vendados el puzzle no es un grupo (no se puede componer cualquier secuencia), pero las secuencias legales siguen siendo invertibles giro a giro, así que es la misma componente conexa del grafo de estados. Un scramble de la app sin tocar ya era válido por construcción (`vieneDeSecuencia`); un estado colocado se valida con la comprobación completa.

## Piezas iguales (4x4, 5x5 y mayores)
- **WCA** (estado de colores): no hay nada que elegir: dos estados que solo difieren en qué centro blanco está dónde son literalmente el mismo array, y el validador de colores ya decide la paridad de los centros por su cuenta (test).
- **Vendados 4x4/5x5** (estado de identidades): la sesión pone cualquier identidad de su grupo y el validador, con la opción nueva **`validar(estado, { elegirIguales: true })`**, busca la asignación que lo hace alcanzable y la devuelve (`Validacion.estado`); *Aplicar* usa esa. Método (`elegirIguales`, dentro de `puzzleConBloqueos`):
  1. x = el estado transportado a la geometría resuelta (x[p] = posición del punto p). Reetiquetar con σ (permutación de los centros sueltos que conserva tipo y color) da x' = σ·x.
  2. La cadena de Schreier–Sims del grupo de la fase 2 ya tiene la base empezando por todos los demás puntos (prefijo, noche 13). Cribar por esos niveles da lo mismo para x y x' (σ fija esos puntos) y deja un resto r con x' ∈ G2 ⇔ σ·r ∈ Gc (Gc = lo que solo mueve centros sueltos).
  3. Para cada órbita O de Gc, σ(O) tiene que ser r⁻¹(O) conservando la clase (si los colores no cuadran, ninguna asignación sirve: imposible). Se construye σ así y se prueban las 2^k combinaciones de paridad (k = órbitas con dos centros de la misma clase: cambiar dos centros iguales de O cambia la paridad de σ sobre O) con la pertenencia exacta (`cadena.contiene`).
- **Demostración de que no rechaza estados alcanzables**: si alguna σ₀ funciona (σ₀·r ∈ Gc), entonces π = σ·σ₀⁻¹ deja cada órbita O en sí misma y conserva las clases; dentro de O, π es par o impar. Como Gc contiene el alternado de cada órbita **por separado** (lo comprueba el recuento de distinguibles de la noche 13: el subgrupo que fija los demás centros sueltos tiene orden ≥ |O|!/2), π ∈ Gc salvo su vector de paridades, y una de las 2^k combinaciones lo corrige (en una órbita sin dos centros de la misma clase, π es la identidad). Si el recuento no pudo demostrar el alternado (`distinguiblesExacto` falso; no pasa en ninguna configuración probada), un fallo de la búsqueda se da como **sin comprobar**, nunca como imposible.
- **Empírico**: con los centros sueltos barajados al azar, sin la opción salían válidos 0–6 de cada 8 estados alcanzables según la configuración; con la opción, 8/8 en las 9 configuraciones de ejemplo, y todos los del test de ida y vuelta. En el 4x4, dos esquinas cambiadas **son** alcanzables (la paridad de las esquinas se compensa con una permutación impar de los centros iguales) y la app lo encuentra; una esquina girada no lo es nunca.
- **No cubierto**: bloques que se ven exactamente igual (misma forma y colores, p. ej. dos parejas de centros del mismo color). Se colocan como bloques distintos de la bandeja y la app no prueba a intercambiarlos; si el usuario los pone cambiados, el estado puede salir imposible. No hay ningún ejemplo así en la app.

## Lo que no funcionó
- **Colocar sola la última pieza con la primera orientación**: el relleno automático ponía la última esquina o la última wing «de cualquier manera» y el estado quedaba distinto del físico (lo cazó el test de ida y vuelta). Ahora solo se coloca sola si hay una única forma.
- **Dos wings gemelas**: si las dos estaban colocadas al revés, Girar no podía arreglarlo (la otra disposición necesitaba la gemela, ya usada). Ahora Girar las intercambia.
- **Elegir un bloque con un hueco ya elegido** lo intentaba poner ahí aunque no cupiera; ahora, si no cabe, el bloque queda elegido y se explica por qué.
- (Tests) En jsdom los polígonos SVG no tienen `click()`: se manda el evento.

# Sesión de mantenimiento: tests que dependían de la máquina y tamaño del repo (27/11/2026)

## Regla
Ningún test puede pasar en una máquina y fallar en otra por velocidad. Un límite en milisegundos solo puede
cambiar *cuánto tarda* un test, no *si pasa*. Orden de preferencia: presupuesto en pasos (nodos, vueltas) →
esperar a eventos → límite generoso solo donde es inevitable (y documentado aquí).

## Qué dependía del tiempo y cómo queda
| Test | Antes | Ahora |
| :--- | :--- | :--- |
| `tests/app.test.mjs`: todas las esperas (`hasta(cond, ms)`, 43 llamadas; las 3 de `test:rapido` que fallaban en este PC: «sin Worker, construye…», «cambiar rápidamente de puzzle (sin Worker)» y «modo aprender (sin WebGL)») | `ms` de reloj: el tiempo que el hilo principal pasaba generando tablas o resolviendo contaba | **Vueltas ociosas** (`crearHasta`): una vuelta de 20 ms solo cuenta si el hilo no estaba bloqueado (si lo está, el temporizador no salta) y ningún Worker tiene una petición sin responder. Se espera a la app lo que haga falta; solo cuenta el tiempo en que no hace nada |
| Worker real de los tests (`instalarWorker`) | Arrancar = evaluar el bundle en worker_threads; si pasaba de 4 s (el ping de la app, `PING_MS`), la app se pasaba al hilo principal | El constructor espera (Atomics.wait) a que el código esté evaluado: el ping solo mide la ida y vuelta, como en un navegador. Cuenta las peticiones pendientes para `crearHasta` |
| `cambiosRapidos` (con Worker) | `assert(secuencia < 1000 ms de reloj)` | Quitado: el ritmo lo fija el propio test (120 ms entre clics); medía la máquina |
| `cambiosRapidos` | `assert(comprobaciones > 20)`, contando vueltas de un `setInterval` de 5 ms (menos cuanto más bloqueado el hilo) | `comprobaciones ≥ número de clics` (cada clic cambia el DOM y dispara el MutationObserver) |
| reproductor del scramble (play en 2D) | dormir 1,3 s y mirar | esperar al primer paso con `hasta` |
| `3x3: scrambles … ≤ 22` (y el scramble de la app) | Kociemba con 1 s de límite: con un reloj de máquina muy lenta salían hasta 24 movimientos | **Presupuesto en nodos** (`nodosMax` en `resolverKociemba`, `NODOS_SCRAMBLE_3X3 = 500.000` en `cubo3.js`): medido en 2.100 scrambles, mediana 837 nodos, máximo 221.865, ninguno > 21. Misma semilla → mismo scramble en cualquier máquina (test nuevo con reloj lento) |
| `FTO: … ≤ 40 giros` (`tiempoMax: 300`) | Dependía de cuántas orientaciones daba tiempo a probar | Sin cambios en el solver: con reloj de máquina muy lenta, máximo 31 (media 28,0) en 100 casos. Test nuevo que lo comprueba con `conRelojLento` |
| Bloqueos: «0 sin resolver» (3x3, NxN y grandes) | El solver se rinde a los `msDuro` (≥ 30 s): en una máquina 30 veces más lenta habría fallos | Los tests pasan `msDuro: Infinity`: la calidad la sigue marcando `msMax` (y la solución se comprueba giro a giro), pero el test nunca falla por no llegar a tiempo |
| «bloqueos grandes: el scramble de la app del 5x5 de 16 bloques» | Acepta «resuelto» o «no a tiempo» | Sin cambios (pasa en los dos casos) |
| Square-1, Megaminx, 2x2, Pyraminx, Skewb, NxN | — | No dependen: con tiempo 0 devuelven igualmente una solución (sus tests ya lo usan) o son óptimos/sin límite |

**Límites que quedan (generosos e inevitables)**: los `{ timeout }` de `node:test` (10–180 min por test) son una
red de seguridad contra cuelgues, con margen amplio sobre lo medido con la CPU cargada (p. ej. «4x4 y 5x5
vendados»: 91 s frente a 10 min; «colocar piezas»: 102 s frente a 15 min); los tests sin `timeout` no tienen límite. `PING_MS = 4 s` de la app
es comportamiento del producto (un Worker que no responde se abandona), no del test.

**`conRelojLento(fn)`** (`tests/util.mjs`): ejecuta `fn` con un reloj que avanza 1 s más en cada lectura
(`performance.now` y `Date.now`): todo presupuesto en ms se agota en cuanto se mira. Es la «máquina infinitamente
lenta» para comprobar que un resultado no depende de la velocidad. (Para el módulo de bloqueos ya existía
`fijarRelojBloqueos`.)

**Descartado**: sustituir el reloj de todos los solvers por un reloj de pasos. Cada solver mira el reloj cada
256–4096 nodos de coste muy distinto: un único «ms por lectura» cambiaría lo que hacen en los tests respecto a
la app. Se ha hecho solo donde el resultado del test dependía de ello (scramble del 3x3).

## Capturas y tamaño del repositorio
- Medido al empezar: `.git` 61 MB (pack 51,7 MiB + 8 MiB sueltos), 118 commits; `docs/capturas/` 47 MB en
  disco, 411 ficheros. En el historial, las capturas son **56 MB de ~60 MB** (507 versiones de JPG/JSON:
  cada ejecución de un `comprobar-*.py` añadía o reescribía decenas de capturas).
- **Política**: `docs/capturas/` deja de estar en git (`.gitignore`; `git rm --cached`, los ficheros siguen en
  local). Los scripts siguen escribiendo ahí y sobrescriben (no acumulan). Las capturas de una versión se
  obtienen con la Action manual **«Capturas (Chromium)»** (`.github/workflows/capturas.yml`): construye, ejecuta
  los `comprobar-*.py` elegidos con el Chrome del runner y sube `docs/capturas/` como artifact (30 días). Así el
  repositorio deja de crecer por las capturas.
- **No se ha reescrito el historial** (pendiente de decisión del dueño): los 56 MB siguen en commits antiguos y
  cada clon los descarga. Quitarlos del historial (`git filter-repo --path docs/capturas --invert-paths`, y
  `git push --force` de `main`) dejaría el repositorio en unos 5–8 MB, pero cambia los hashes de todos los
  commits: cualquier copia o clon existente tendría que volver a clonarse.

# Noche 15: Cuboids — 3x3x1, 3x3x2 y 2x2x3 (27/11/2026)

## Modelo: motor de cortes planos, no el NxN
`crearCuboide(a, b, c)` (`src/puzzles/cuboide*.js`) se construye sobre el motor geométrico (`carasDesdeVertices`,
planos de corte, `permDeGiro`), no sobre el modelo NxN. El NxN da por hecho un cubo: N capas en los tres ejes,
todas las capas giran 90° y las caras son N×N; adaptarlo habría sido tocar un modelo que usan seis puzzles. Con
los cortes planos, un cuboide es una caja (a·s × c·s × b·s) troceada por los planos entre capas y todo lo demás se
deduce: pegatinas, piezas (cubitos), qué capas existen y cuánto pueden girar (un giro de 90° de una capa de sección
no cuadrada ni siquiera es una permutación: `permDeGiro` lo rechaza), las rotaciones que conservan la forma y la red
2D (en cruz, la de `crearGeoPuzzle`). Los giros de capa los calcula `cuboide-geo.js` (no `crearGeoPuzzle`, que solo
gira semiespacios) para poder tener capas interiores (2U, 2R…) cuando lleguen el 2x2x4 o el 3x3x4.
- **Medidas**: a = ancho (x, R/L), b = fondo (z, F/B), c = alto (y, U/D). El 3x3x1 es (3, 3, 1), el 3x3x2
  (3, 3, 2) y el 2x2x3 (2, 2, 3): las caras cuadradas (las de la «dimensión distinta» en vertical) quedan arriba
  y abajo, como se sujetan y como los describe Jaap.
- **Comprobado, no supuesto** (`tests/cuboides.test.mjs`): 3x3x1 sin giros de U/D (una sola capa: girarla es girar
  el puzzle) y lados de 180°; 3x3x2 con U/D de 90° y lados de 180°; 2x2x3 con U, E y D de 90° y lados de 180°.
  Ningún giro de 90° en una capa de sección no cuadrada; cada media vuelta es una involución y cada cuarto de vuelta
  tiene orden 4. 8 rotaciones que conservan la forma en los tres (prisma de base cuadrada: y, x2, z2…). Sentido:
  U horario lleva a la fila de arriba de F los colores de R, como en el cubo.

## Notación: la de csTimer (y la de Jaap como alias)
Fuentes: el código de csTimer (`src/js/scramble/1x3x3.js`, tipo `133`: letras `R L F B` sin sufijo;
`megascramble.js`, tipo `233` «Domino/2x3x3»: `U U' U2`, `R2 L2`, `F2 B2`; `2x2x3.js`, tipo `223`: `U D` con
`2` o `'` y `R2 F2`) y Jaap's Puzzle Page (floppy.htm: `R L F B` son medias vueltas; domino.htm y cube223.htm: `U`,
`D` cuartos de vuelta con `2` y `'`, y los lados con la letra sola, que en esos puzzles siempre es media vuelta).
La wiki de speedsolving.com no se pudo leer (403). Hay dos escrituras de los lados de 180°: `R2` (csTimer en
Domino y Tower) y `R` (Jaap, y csTimer en el Floppy). **Elegida la de csTimer**: es la que sale en el temporizador
que usa la comunidad (los scrambles que el usuario reconocerá) y es la más explícita (`R2` no se confunde con un
cuarto de vuelta). Regla general, deducida de la geometría: si el puzzle tiene algún giro de 90°, las medias
vueltas llevan `2`; si no tiene ninguno (3x3x1), van sin él. Al leer se aceptan los alias (`R` = `R2` en el
3x3x2, `R2` = `R` en el 3x3x1, `R'`, `R2'`). Capas del medio de 3 capas: M, E, S (WCA); interiores: 2R… (SiGN).

**Colores**: el esquema del cubo de la app (U blanco, D amarillo, F verde, B azul, R rojo, L naranja) con las caras
cuadradas arriba y abajo. Las pegatinas de cada color son las de su cara (en un cuboide las caras no miden igual: el
3x3x2 tiene 9 blancas y 6 rojas).

## Métrica y giros de búsqueda
Cada giro cuenta 1 (`U`, `U2`, `R2`): la métrica de Jaap («face turn metric», HTM). El solver y los scrambles usan
**giros de búsqueda**: en cada eje todas las capas menos la del medio (n impar: los centros, fijos, son la
referencia) o menos la del lado negativo (n = 2). Resultado: 3x3x1 `R L F B`, 3x3x2 `U R2 L2 F2 B2`, 2x2x3
`U D R2 F2`: exactamente los conjuntos de csTimer. **Por qué no cambia la métrica**: las capas de un eje conmutan
y, con n = 2, `L2 = R2 · x2` y `D = U · y'`: un giro que falta es uno de búsqueda seguido de una rotación del
puzzle entero, que no cambia la posición. Así, la distancia en el grupo de búsqueda hasta «resuelto girado» es la
distancia con todos los giros exteriores (lo comprueba el oráculo del test: BFS sobre colores con los 10 giros
exteriores, también `L2`, `B2` y `D`). **Límite**: con n ≥ 4 par (2x2x4, 3x3x4) quitar una capa sí cambia la
métrica (la que falta equivale a varias); para esos habrá que buscar con todas las capas y normalizar la rotación.
Los objetivos del solver son el resuelto y sus rotaciones que están en el grupo: en el 3x3x2, `y = U D'` lo está
(4 objetivos); en el 3x3x1 y el 2x2x3, ninguna.

## Grupos, posiciones y restricciones (Schreier–Sims), frente a lo publicado
| | Grupo de búsqueda | Rotaciones dentro | Posiciones distinguibles | Jaap | Restricciones |
|---|---|---|---|---|---|
| 3x3x1 | 192 | 1 | **192** | 192 | 1 (paridad de esquinas = paridad de aristas volteadas) |
| 3x3x2 | 8!·8! = 1.625.702.400 | 4 (y) | **406.425.600** | 406.425.600 (3.251.404.800 con la orientación de los centros visible) | 0 |
| 2x2x3 | 8!·3! = 241.920 | 1 | **241.920** | 241.920 | 0 |

- **Cómo se demuestra**: rasgos ℤ₂ de un estado (paridad de la permutación de cada órbita de huecos y, en las
  órbitas en las que una pieza cabe de dos formas en su hueco, la paridad del número de volteadas); las
  combinaciones que ningún generador cambia son las restricciones (núcleo por eliminación de Gauss). El orden de
  Schreier–Sims coincide con el **previsto** (∏ órbitas de huecos (k! · formas^k) / 2^restricciones), así que no hay
  ninguna más. La orientación de cada pieza en cada hueco sale de la órbita de su tupla de pegatinas: en los tres,
  las esquinas solo caben de una forma en cada hueco (en el 3x3x1 eso hace que una esquina vaya «boca abajo» según
  el hueco); en el 2x2x3 las aristas del medio tampoco se pueden voltear; en el 3x3x1 las aristas se voltean pero
  nunca salen de su lado.
- **3x3x1**: Jaap escribe «24·4! = 384 … /2 = 192»; ese 24 es 2⁴ (4 aristas que se voltean): 2⁴·4!/2 = 192. Con
  todos los giros y las 8 rotaciones, 1.536 estados de colores = 192 · 8 (ninguna rotación está en el grupo).
- **3x3x2, la diferencia con 3.251.404.800**: Jaap da las dos cifras. 406.425.600 = 8!·8!/4 son las posiciones con
  los centros lisos (la app pinta colores: un centro no tiene orientación visible); ×8 cuenta las orientaciones de
  los dos centros cuando son dibujos (el dominó con puntos). Wikipedia da 406.425.600. No hay error: cuentan cosas
  distintas. (Casualidad: el grupo de todos los giros exteriores con las rotaciones mide 3.251.404.800 = 8!·8!·2,
  pero es otra cosa: incluye dar la vuelta al puzzle.)
- **2x2x3**: Jaap toma una pieza del medio como referencia: 8!·3!. Con todos los giros exteriores el grupo tiene
  967.680 = 4 · 241.920 (contiene x2, y2, z2) y con las rotaciones, 1.935.360 = 8 · 241.920.

## Número de Dios y solver óptimo
- **3x3x1 y 2x2x3: BFS completo** (una tabla exacta: 26.880 índices / 192 estados y 241.920 / 241.920; 1 ms y
  ~55 ms en Node). La distribución coincide **exactamente** con la de Jaap: 3x3x1 1, 4, 10, 24, 53, 64, 31, 4, 1
  (Dios 8, media 4,4271); 2x2x3 1, 8, 35, 157, 678, 2.527, 7.442, 17.088, 31.568, 44.704, 47.216, 49.792, 29.024,
  11.104, 576 (Dios 14, media 9,7372). Resolver = IDA* sobre la tabla exacta (no se desvía: solo sigue giros que
  bajan la distancia).
- **3x3x2: IDA* con dos bases de patrones** (esquinas + 2 aristas y aristas + 2 esquinas, 2.257.920 entradas cada
  una, llenas desde los 4 objetivos; ~1,1 s en Node, ~1,5 s en el Worker de Chromium). Heurística = máximo
  (admisible) y poda de ejes (dos giros seguidos del mismo eje solo en orden creciente de capa; las capas de un eje
  conmutan): la solución es óptima. Medido con 200 estados: 1,2 ms y ~5.900 nodos por solución. Con 3 piezas
  (13,5 M entradas) las tablas tardan ~10 s para ahorrar 0,4 ms por solución; con 1 pieza, 133 ms pero 3,8 ms y
  32.000 nodos por solución: se eligen 2. El BFS completo de las 406.425.600 posiciones no cabe en el navegador (un
  byte por posición) pero sí en Node: `scripts/bfs-cuboide.mjs` reproduce la distribución de Jaap y el número de
  Dios, 18 (cifras en ESTADO.md).
- El tamaño de las tablas lo decide `crearSolverCuboide` solo (tabla exacta si el producto de las coordenadas
  completas ≤ 30 M; si no, una base por órbita más las piezas de otra que quepan en 3 M), para que un cuboide nuevo
  sea una línea en el registro (con el límite de n ≥ 4 de arriba).
- **Coordenadas**: dónde está la pegatina de referencia de cada pieza (variaciones de k de r posiciones). La
  referencia es la pegatina U/D de la pieza si la tiene (luego F/B, luego R/L): así recorre pocas casillas (8 en
  las esquinas). Al construir se comprueba que esa posición determina la colocación entera.

## Validador y orientación libre
Como en el Skewb: se prueban los reetiquetados de colores de las 8 rotaciones que conservan la forma y el estado es
válido si en uno está en el grupo de búsqueda (pertenencia con la cadena de Schreier–Sims). Si en ninguno, se dan
los mensajes del reetiquetado con menos errores (primero los de piezas; luego las restricciones). Mensajes: número
de pegatinas de cada color, pieza que no existe (color repetido u opuesto), repetida o que falta, especular, pieza
fuera de su órbita («La arista … no puede estar en F: en el 3x3x1 Floppy esa pieza nunca sale de su sitio (R)»),
orientación («La esquina … en UFR está girada: en esa posición su pegatina blanca tiene que estar en la cara U») y
paridad («la permutación de las esquinas es impar y hay 0 aristas volteadas…»). El solver vuelve a validar.

## Scramble de estado aleatorio
Elemento uniforme del grupo (`cadena.aleatorio`, Schreier–Sims), su solución óptima y la inversa. La solución
puede acabar en una rotación ρ del grupo (3x3x2): entonces el scramble deja ρ⁻¹·s, que es s visto con el puzzle
girado (mismos colores tras reetiquetar con esa rotación). El test lo comprueba estado a estado («exacto») y
compara la distancia de los scrambles con la distribución exacta (variación total). Solo se descarta el resuelto
(distancia 0); en el 3x3x1, un 2 % de los scrambles son de un giro (4 de 192 posiciones), como en cualquier scramble
de estado aleatorio sin longitud mínima.

## Colocar piezas
`colocarPiezas.generadores` = un giro de cada capa exterior **y las rotaciones** (`x2`, `y`, `z2`): así las órbitas
de las tuplas admiten el puzzle sujetado de cualquier forma (sin ellas, en el 3x3x1 una esquina con el blanco arriba
en un hueco «de boca abajo» no se podría colocar aunque el puzzle solo esté girado). El validador decide la
orientación.

## Interfaz
`main.js` tenía «WCA Puzzles» escrito en el selector, la ruta y el puzzle guardado. Se ha generalizado a las
**secciones de catálogo** (`CATALOGOS = ['wca', 'cuboids']` en `secciones.js`): el selector muestra los puzzles del
registro con la `categoria` de la sección y sus anunciados (`PUZZLES_PRONTO`: 2x2x4, 3x3x4, 3x3x5); la ruta es
`#/<sección>/<id>`; el último puzzle elegido se guarda por sección (`cubo-solver:puzzle` en WCA, como siempre;
`cubo-solver:puzzle:cuboids`). Es el único cambio de `main.js`, y hacía falta porque la sección de catálogo era una
sola; WCA Puzzles se comporta igual (sus tests no cambian salvo la portada: una tarjeta disponible más y una
bloqueada menos).

## Lo que no funcionó / encontrado
- `crearModeloPiezas` (orientación = desplazamiento cíclico) no sirve: en el 3x3x1, R invierte el orden de las
  pegatinas U, R, D de la arista (no es un desplazamiento). Modelo propio: la posición de la pegatina de referencia.
- Pegatinas de una pieza ordenadas por el índice de cara (U, R, F, D…): la referencia de una esquina de abajo era su
  pegatina R, que recorre 24 casillas → coordenadas de 24!/16!. Con U/D primero, 8.
- Bajar por la tabla exacta eligiendo siempre el primer giro que baja la distancia se puede atascar con la poda de
  ejes; IDA* sobre la misma tabla hace lo mismo y retrocede si hace falta.
- `HUELLAS=actualizar` reescribe también las secuencias de los puzzles de antes (Square-1, FTO): se restauraron
  las guardadas y se añadieron solo las de los cuboides.
- **`scripts/comprobar-colocar.py` (noche 14) nunca probó el tema claro**: guardaba `light`/`dark` en
  `cubo-solver:tema`, pero la app solo entiende `claro`/`oscuro` y se quedaba en oscuro (las capturas «light» eran
  oscuras). Corregido, con una comprobación de `data-theme`; repetido para WCA 3x3 y Bandaged 3x3 (ESTADO.md).

## Colores del Square-1 (27/11/2026, commits 400faca y f57aa71 deshechos)
- **Qué hacía la reordenación**: en `square1.js` los índices de `PALETA` son caras: 0 = arriba, 1 = abajo y
  `LADOS = [4, 5, 2, 3]` = frente, derecha, detrás, izquierda. Antes: arriba blanco, abajo amarillo, frente azul,
  derecha naranja, detrás verde, izquierda rojo. `400faca` cambió los cuatro laterales (frente rojo, derecha verde,
  detrás naranja, izquierda azul) con el blanco arriba: eso es el esquema **especular** (la esquina de arriba-frente-
  derecha pasaba a blanco-rojo-verde en el sentido contrario al del cubo). `f57aa71` cambió además arriba y abajo:
  amarillo arriba, blanco abajo, rojo delante, verde a la derecha, naranja detrás, azul a la izquierda. Eso vuelve a
  ser el esquema occidental de siempre, **girado**: es exactamente la otra orientación que permite la 12c1 (dar la
  vuelta al puzzle sobre el eje de las dos superficies pequeñas de la capa del medio).
- **Regulación 4d3** (texto oficial, `thewca/wca-regulations`): «Square-1 is scrambled starting with the darker color
  on front (out of the 2 possible scrambling orientations)». No fija el color de arriba ni hay un esquema de colores
  obligatorio (3a3 solo pide un color distinto por cara). Con este esquema, los frentes posibles según 12c1 son azul o
  verde (blanco arriba) y rojo o naranja (amarillo arriba); el más oscuro es el **azul**: blanco arriba, azul delante.
  La orientación de la reordenación (rojo delante) no es la de 4d3, así que se deja la WCA por defecto y se deshacen
  los dos commits. Si un Square-1 físico tiene otro esquema, lo correcto es una opción de colores por puzzle (pendiente
  en ESTADO.md), no cambiar el de referencia.
- El `dist` de la noche 15 (db4ea5f), Pages y el artifact llevaban el amarillo arriba: se construyeron desde `main`,
  que ya tenía los dos commits (lo que no cambiaba el dist era solo una errata posterior en un comentario,
  «detrásgit», sin commitear). Este commit reconstruye el dist con el blanco arriba.

# Noche 16: Shape Mods — Mirror Blocks y Ghost Cube (27/11/2026)

## Modelo: un 3x3 por dentro, otro cuerpo por fuera
- **Los planos de corte del mecanismo están siempre a la misma distancia en los tres ejes** (x, y, z = ±c). No es
  una elección: tras un giro de 90° alrededor de x, los cortes de y pasan a z; si no coincidieran, el puzzle no
  podría girar dos veces seguidas. Lo que cambia en un shape mod es el CUERPO (un cubo desplazado y, en el Ghost,
  inclinado). Cada pieza = celda del mecanismo ∩ cuerpo: un poliedro convexo (intersección de semiespacios), que
  `shapemod-geo.js` calcula recortando una caja grande plano a plano. Se calcula una vez y viaja con la pieza.
- **Estado por piezas** = el de `kociemba.js` (`cp, co, ep, eo`, con su convención: la pegatina j de la pieza de la
  posición i está en la pegatina (j + co) mod 3 de la posición) + `ct` (giro de cada centro, 0 si no se ve) y, en el
  Ghost, `cubo` (forma de cubo o capas alineadas). El 3x3 de WCA no se toca. La rotación de cada pieza se deduce del
  estado (llevando las direcciones de sus pegatinas a las de su hueco); `vista3d.test.mjs` comprueba con todos los
  giros que la animación acaba exactamente donde dice el modelo.
- **Entrada del usuario («marcas»)**: identidad de cada pegatina del 3x3 (54) + p marcas por centro con periodo
  visible p ≥ 2 (+ la forma en el Ghost). Las permutaciones de los giros sobre las marcas salen de la geometría
  (rotar huecos y direcciones), no se escriben a mano; los tests comprueban la ida y vuelta marcas ↔ piezas. Con
  las marcas se valida un estado introducido con el puzzle sujetado de cualquier forma (los seis centros son
  distintos: dicen la rotación) y la solución se traduce a la orientación del usuario.
- «Colocar piezas» trabaja sobre un **puzzle adaptador** cuyo estado son las marcas (así `colocar.js` sirve tal
  cual): ganchos genéricos nuevos `colocarPiezas.adaptador / desdeColocar / nombrePieza / miniatura` (la bandeja
  enseña la forma de cada pieza). Como los centros no se mueven entre sí pero el usuario puede sujetarlo de
  cualquier forma, los generadores incluyen las rotaciones x, y.

## Geometría: fuentes y supuestos
- **Mirror Blocks** (Hidetoshi Takeji, 2006): no he encontrado medidas en mm publicadas (Wikipedia y ruwix solo dicen
  que cada pieza es un prisma rectangular distinto; speedsolving y twistypuzzles no se pudieron leer, 403). Usado:
  tamaño 57 mm (la referencia de 3dcubesolver.com, «Mirror cube solver») y el **orden de grosores** de esa misma
  página: de la capa más fina a la más gruesa U, L, F, B, R, D (opuestas suman 7 en el orden), con la capa del
  medio de 19 mm (57/3, la de un 3x3: el mecanismo no cambia). **Supuesto**: pasos iguales entre grosores →
  U 9,5 · L 12,67 · F 15,83 · B 22,17 · R 25,33 · D 28,5 mm (cuerpo desplazado (1/3, −1/2, −1/6) capas). Es lo único
  que habría que medir en un Mirror físico; cambiarlo es una línea del registro.
- **Ghost Cube** (Adam G. Cowan, 2008; Meffert's): ninguna fuente da medidas ni ángulos oficiales. Lo que sí dicen
  varias fuentes independientes (ruwix, Eridian Shores, un blog de PSU): es un 3x3 normal con los ejes de giro
  desplazados e inclinados, **el resuelto es un 3x3 «a mitad de giro»** (las capas de arriba y abajo de un eje
  están giradas un ángulo cualquiera: para girar cualquier otra cara hay que alinearlas primero) y **la orientación
  de los centros importa** («más bien un supercubo»). Medidas usadas: las de un modelo ajustado a una foto
  (onexmac/ad, PR #163, «The Cubes 0.6.45»): eje de apilado (−0,607; 0,484; 0,63) en coordenadas del cubo (cerca de
  una diagonal larga), giro de 63,3° de los otros dos ejes, centro del mecanismo desplazado (0,034; 0,075; −0,038)
  semilados, capas de abajo / medio / arriba giradas −27,5° / 0 / 26,7°. **Supuestos**: (1) esos números (ajuste a
  ojo, no del fabricante); (2) los planos de corte a 1/3 del semilado (proporciones de un 3x3; el modelo citado no
  lo dice). Con ellos el resultado es coherente con lo publicado: piezas todas irregulares, una esquina es un
  tetraedro, los centros llegan a 2–3 caras del cubo (Eridian Shores: «square-ish pieces with 2 to 3 colors»).
- **Notación del Ghost**: la del 3x3 en el marco del mecanismo (U = el eje en el que está «a mitad de giro») y
  `A` / `A'` = alinear las capas de arriba y abajo / volver a la forma de cubo. Con la forma de cubo solo giran U y
  D. Las soluciones empiezan con `A` (si está en forma de cubo) y acaban con `A'`; los scrambles al revés.
  «Colocar piezas» en el Ghost se hace con las capas alineadas.

## Lo demostrado (tests/shapemods.test.mjs)
- **Centros con orientación visible**: el menor giro de 90°·k que deja la forma del centro igual (comparando
  poliedros). Mirror: ninguno (sus centros son prismas de base cuadrada de 19 × 19 mm: el corte es igual en los dos
  ejes, ver arriba; da igual el grosor). Ghost: los seis, con los cuatro giros visibles (ninguna simetría).
- **Grupo de estados distinguibles** (Schreier–Sims sobre las marcas, `grupo.js`): Mirror 43.252.003.274.489.856.000
  (= 3x3; lo publicado: Wikipedia, mismo número de posiciones que el cubo de Rubik); Ghost
  88.580.102.706.155.225.088.000 = 3x3 × 4⁶ / 2 (el del supercubo; para el Ghost no he encontrado cifra publicada).
  La restricción nueva del Ghost: la suma de los giros de los centros (en cuartos) tiene la paridad de la
  permutación de las esquinas (cada giro de cara cambia las dos). En el Mirror no hay ninguna nueva.
- **Estados con la forma de cubo resuelto**: en cada hueco de esquina o arista solo encaja su pieza sin girar
  (todas distintas; comparando poliedros); en los centros, las orientaciones que no se ven. Distinguibles: 1 en los
  dos. Del mecanismo: 2.048 en el Mirror (4⁶ orientaciones de centros / 2 por la paridad) y 1 en el Ghost. Por eso
  `estaResuelto` mira la forma: en el Mirror ignora `ct`, en el Ghost exige además la forma de cubo.

## Solver
- **Mirror**: Kociemba tal cual (los centros no se ven): ~20 giros.
- **Ghost**: Kociemba + fase de centros. Primero busqué algoritmos puros de centros por meet-in-the-middle sobre
  TODAS las secuencias de hasta 5 + 7 giros (621.649 estados de un lado): hay medias vueltas (dos centros en 10
  giros, uno en 12, los cuatro de un ecuador en 12) pero **ningún giro de 90° puro en ≤ 12 giros**. Así que los
  cuartos de vuelta los arregla Kociemba: con dos ganchos opcionales nuevos en `resolverKociemba` (`filtroFase1`: la
  paridad de R, F, L, B se sabe tras la fase 1 porque la fase 2 solo los gira media vuelta; `aceptar`: la de U y D
  al final) solo se aceptan soluciones que dejan cada centro a medias vueltas, y entre ellas la de menor total con
  la fase de centros (Dijkstra sobre las 64 combinaciones de medias vueltas con los algoritmos y sus 24 conjugados).
  Como el algoritmo de centros no mueve otras piezas, se inserta en el punto de la solución que más giros cancela.
  Presupuesto: 150.000 nodos de la fase 1 (en nodos, no en ms: misma solución en cualquier máquina). Medido
  (40 casos): 20.000 nodos → 39,9 giros de media; 150.000 → 35,5 (93 ms); 400.000 → 34,6 (177 ms). Sin el filtro
  de la fase 1, lo mismo costaba ~1,3 s.
- Lo que no se hizo (y por qué): una búsqueda de dos fases con los centros dentro (supercubo) daría ~25 giros, pero
  exige otras tablas de poda y tocar el corazón de Kociemba; con los ganchos, `kociemba.js` no cambia para el 3x3.
- Los ganchos no cambian nada sin ellos: `tests/kociemba-referencia.json` guarda 40 scrambles y soluciones del 3x3
  de WCA de antes del cambio (semilla 16) y el test comprueba que salen idénticos.
- Scramble de estado aleatorio: piezas al azar (con las paridades del 3x3) + centros visibles al azar respetando la
  restricción → solución (presupuesto en nodos) → inversa; comprobado exacto en 200 casos por puzzle.

## Vista 3D y 2D
- Cada cara de cada pieza es una «pegatina» del modelo 3D (la escena dibuja el cuerpo negro y la cara encogida: así
  los bordes de las piezas son líneas oscuras). Material `metal` (nuevo, opcional, solo lo usan los shape mods): luz
  principal más fuerte, luz de relleno desde abajo a la izquierda y brillo especular, para que las caras de un mismo
  color se distingan también a mitad de un giro. Plateado por defecto en los dos (los originales: Rubik's Mirror
  Blocks plateado; el Ghost de Meffert's, plateado). Los huecos vacíos de «Colocar piezas», azul oscuro.
- Las caras de corte de dos piezas vecinas coinciden: el «centro» de cada cara se mete un 0,1 % del radio hacia
  dentro de su pieza para que la comparación de posiciones de los tests no las confunda.
- **2D**: proyección del modelo 3D desde delante-arriba-derecha y desde detrás-abajo-izquierda (algoritmo del
  pintor), con las mismas sombras. Una red desplegada no tiene sentido (las piezas sobresalen al mezclar), pero un
  dibujo sí: sirve sin WebGL y para «Colocar piezas» en 2D.
- Pintar está desactivado (`avisoPintar`, como en los vendados 4x4/5x5): de un solo color no hay nada que pintar.

# Investigación: tamaño y carga de la app (27/11/2026) — decidido: a, c y b hechos (ver «Sesión: carga más rápida»)

Informe completo, con método, cifras y cómo reproducirlo: `docs/investigacion-carga.md`; prototipos en la rama
`investigacion/carga` (no fusionada). main no cambia de comportamiento (solo se añaden `scripts/medir-carga.py` y
`scripts/servidor-pages.mjs`).

## Lo medido (Chromium real, móvil, mediana de 5)
- `dist/index.html` 937 KB → **376 KB con gzip**. **GitHub Pages solo sirve gzip** (no brotli, aunque se pida) y
  `Cache-Control: max-age=600` (comprobado con las cabeceras).
- Portada (= usable) con Fast 3G: 3,0 s (CPU ×1) y **4,2 s (CPU ×4)**; Slow 3G ×4: 11,0 s; con caché ×4: 2,1 s.
- **El texto del Worker repite el 98,5 % del script principal**: 136 de los 376 KB descargados.
- La CPU no se va en parsear (compilar ~0,1 s ×1) sino en **ejecutar**: el registro construye los 16 puzzles al
  cargar (~0,35 s ×1, ~1,7 s ×4), y el Worker lo repite (~0,5 s). La portada solo ejecuta 26 KB del JS.
- Fuentes: 60 KB de woff2 (78 KB en base64); Inter variable 100–900 cuando se usan 400–600. Minificación: ya al
  máximo de esbuild. Código muerto: < 1 KB.

## Opciones (prototipo medido; portada con Fast 3G y CPU ×4)
| Opción | KB | Portada | Con caché | Trabajo / riesgo |
|---|---|---|---|---|
| main | 376 | 4,16 s | 2,08 s | — |
| a · el Worker se crea con el mismo script (sin copia como texto) | 242 | 3,40 s | 2,13 s | bajo / bajo (comprobar `document.currentScript` en el artifact) |
| b · fuentes: español + Inter 400–600 | 356 | 4,09 s | 2,33 s | muy bajo / muy bajo |
| c · registro perezoso (no construir puzzles hasta usarlos) | 383 | 3,34 s | 1,55 s | medio / medio |
| **a + b + c** (un solo HTML: artifact, sin conexión) | **223** | **2,27 s** | 1,29 s | |
| + e2 · la portada no crea un contexto WebGL ni fuerza maquetación | 223 | 2,24 s | 1,54 s | muy bajo (ganancia dentro del ruido) |
| d · varios ficheros solo para Pages (con a + b + c) | 224 | 3,20 s | **0,71 s** | medio; frío peor (una ida y vuelta más), visitas siguientes mejor |
| e1 · a + b + c con brotli (otro alojamiento) | 194 | 2,02 s | 1,15 s | dejar Pages: no compensa |

## Recomendación (pendiente de decidir)
- **Ya**: a, luego c (con constructores perezosos en el registro, sin `Proxy`) y b. −153 KB y −1,9 s en la portada
  del móvil, sin cambiar la arquitectura (un único HTML para Pages y el artifact, sin conexión, tablas en el Worker).
- **Con la PWA**: build en varios ficheros para Pages (d, con hash en los nombres) que guarda el service worker; las
  visitas siguientes bajan a ~0,7 s y funciona sin conexión. Los trozos por puzzle (registro asíncrono) solo si la
  descarga vuelve a crecer mucho.
- **Descartado**: evaluación diferida del código por secciones dentro del HTML (parsear no es el problema; lo que
  costaba era ejecutar, y lo arregla c), terser (1–3 %), cambiar de alojamiento solo por brotli.
- Pendiente de investigar: **maquetar** la portada (~0,12 s ×1, ~0,6 s ×4) es lo siguiente que más pesa.

# Sesión: carga más rápida (27–28/11/2026) — Worker sin duplicar, registro perezoso, fuentes, e2

Lo que recomendó la investigación (arriba), hecho en main paso a paso, con un commit y una medición por paso
(`scripts/medir-carga.py`, versiones intercaladas: ver «Medir con la máquina cargada»). Cifras: ESTADO.md.

## a · La página y el Worker son el mismo script
- `src/app/entrada.js` es el punto de entrada de los dos. En la página, `document.currentScript.textContent` se lee
  al empezar (síncrono: después ya no vale) y es el código con el que `motor.js` crea el Worker desde un blob. En el
  Worker (`typeof document === 'undefined'`) se carga `worker.js`. Con `import()` y sin *code splitting*, esbuild
  deja cada lado en una función que solo se ejecuta si se llama: el Worker no ejecuta la interfaz y la página no
  ejecuta `worker.js`.
- Por qué funciona en todas partes: GitHub Pages, file:// y el artifact sirven el HTML con el script en línea (el
  artifact lo mete en un iframe con sandbox y otro origen; los blobs siguen valiendo). Si `currentScript` no está o
  es un `<script src>` (no es el caso de ningún build), `codigoWorker` es null y se calcula en el hilo principal,
  como sin Worker. Comprobado en Chromium con `scripts/comprobar-entornos.py` (los cuatro entornos).
- Test: el código de los solvers va una sola vez en el HTML y el Worker se crea con el mismo texto que el script.

## c · Registro perezoso (sin Proxy)
- `REGISTRO` son entradas con lo que necesitan la portada, los selectores y las precargas (id, nombre, categoría,
  coste del scramble, capacidades) y `crear()`, que hace `import()` del módulo del puzzle. Importar estático no
  basta: el código de nivel superior de los módulos (geometrías, tablas de piezas, la comprobación de los
  algoritmos de OLL/PLL…) se ejecutaría igual al cargar (medido en Node: ~170 ms con todo, 115 ms sin construir,
  33 ms solo con las fábricas). Por eso `cargarPuzzle` es asíncrona.
- Sin `Proxy` (lo pidió el prompt): `puzzleCargado(id)` da el puzzle ya construido y la app lo usa así después de
  `await cargarPuzzle(id)` en `seleccionar`; `servicio.js` (Worker o hilo principal) hace lo mismo con cada
  petición, y `atender` pasó a ser asíncrona.
- Carreras: `seleccionar` lleva un turno; si mientras se construía se eligió otro puzzle, la construcción se
  descarta (queda hecha para la próxima vez).
- Tests que cambiaron de forma (y siguen comprobando lo mismo):
  - Los que recorrían `PUZZLES` (lista de puzzles construidos) ahora usan `await todosLosPuzzles()` (los construye
    todos, en el mismo orden) o `cargarPuzzle(id)`; las aserciones no cambian.
  - En `app.test.mjs`, la interfaz arranca en una microtarea (por el `import()` de entrada.js): después de crear
    la ventana de jsdom se cede una vuelta (`trasArrancar`) antes de mirar el DOM. «Etiqueta del tipo de scramble» y
    «respuesta tardía» hacían clic en un chip y miraban el resultado en la misma vuelta; la primera vez que se elige
    un puzzle ahora hay que esperar a construirlo (microtareas), así que vacían las microtareas
    (`vaciarMicrotareas`, sin reloj) antes de mirar. Lo que comprueban («al momento», sin esperar al Worker) sigue
    igual: con el puzzle ya construido no hay ninguna espera.
  - Nuevos: importar el registro no construye nada; cada entrada dice lo mismo que su puzzle construido; cada
    puzzle se construye una vez; la portada no construye ningún puzzle (página y Workers, `op: 'construidos'`) y al
    entrar en el 3x3 solo se construye ese.
- Mismos scrambles y soluciones con la misma semilla: el orden de las peticiones al Worker no cambia y las huellas
  (`tests/huellas.json`) y las referencias de los solvers no se tocaron.

## c (ajuste) · Primer uso de un puzzle
- Medido (`scripts/medir-primer-uso.py`, de elegirlo a ver su scramble): con c tal cual, la primera vez la página
  construía el puzzle y SOLO ENTONCES pedía el scramble al Worker, que lo construía otra vez: el 3x3 con CPU ×4
  pasaba de 1,30 a 1,44 s y el 4x4 vendado de 0,28 a 0,41 s.
- Arreglo: si el puzzle no tiene bloques, el scramble se pide al Worker en cuanto se elige (la misma petición que
  haría `nuevoScramble`, que la encuentra en camino; mismo orden, mismos scrambles), y los dos lo construyen a la vez.
- Lo que no funcionó: pedir a los Workers un `op: 'construir'` aparte. Los ocupaba, y la petición del scramble, que
  esperaba en la cola del motor, solo se enviaba cuando el hilo principal quedaba libre, es decir, después de que
  la página acabara de construir: más lento (3x3 ×4: 1,57 s). Se quitó.
- Lo que queda: los puzzles rápidos (7x7, Megaminx, 4x4 vendado) tardan 30–50 ms más con CPU ×1 y hasta ~70 ms más
  con ×4 la primera vez (construirlos en la página, que antes se hacía al cargar). Por debajo de lo que se nota y muy por
  debajo de lo que se gana en la portada (~1 s con ×4). El 3x3 tarda lo mismo que en main.

## b · Fuentes
- Inventario de lo que se ve de verdad (`scripts/comprobar-fuentes.py inventario`, todas las pantallas): Inter 400,
  500 y 600 (la cursiva de 400 es sintética), Bricolage Grotesque 800 y JetBrains Mono 500 (y 400, que se dibuja con
  la única cara, la de 500). Bricolage y JetBrains ya eran un fichero de un peso.
- Caracteres: de todo Latin-1 a ASCII + el español en las dos cajas + los signos de la interfaz (lista en
  `scripts/fuentes.sh`).
- **Inter se deja con el eje de peso entero (100–900)**. Limitarlo a 400–600 (`fontTools.varLib.instancer`) la
  dejaba en 20 KB en vez de 29 KB, pero recalcula las variaciones con redondeo: el suavizado de algunas letras
  cambiaba (~150 píxeles por pantalla; a la vista, igual). Se pidió el mismo aspecto, y se comprobó píxel a píxel
  (`scripts/comprobar-fuentes.py comparar`, ver ESTADO), así que solo se recorta el juego de caracteres.

## e2 · La portada no comprueba WebGL ni lee la maquetación
- `st.webgl` se calcula la primera vez que se pregunta (al abrir un puzzle con vista 3D); el aviso «3D no
  disponible» solo se decide con un puzzle a la vista. `vigilarResolverFijo` deja que el `ResizeObserver` haga la
  primera medida (después de maquetar) en vez de leer `offsetHeight` al arrancar, que forzaba una maquetación.
- Test: en la portada no se llama a `getContext`; al abrir el 3x3 sí (y en jsdom, sin WebGL, sale el aviso). La
  espera hasta que el arranque termina es por condición (el motor sabe dónde calcula) y vaciando tareas, sin reloj.

## Medir con la máquina cargada
- Las primeras mediciones de la sesión salían más lentas que las de la investigación con el mismo HTML (4,9 frente
  a 4,2 s) porque el portátil tenía otras aplicaciones abiertas. `medir-carga.py` y `medir-primer-uso.py` aceptan
  varias versiones (`--dir … --etiqueta …`) y las miden intercaladas (una repetición de cada una por turno): las
  comparaciones son justas aunque el ruido cambie. Las tablas comparan cada paso con el anterior medido a la vez.
- Los scripts fallan si su servidor no arranca (un puerto ocupado por un servidor de otra medición servía otra
  versión sin avisar).
