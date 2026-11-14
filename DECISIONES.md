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
- `R++` gira todo menos la capa de la cara opuesta a R, 144° en sentido horario visto desde R; `D++` igual con el eje de D (todo menos la capa de U). La vista previa se calcula con el motor geométrico (132 pegatinas, dos "flores").
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
