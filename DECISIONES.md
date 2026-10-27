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
- Los 12 colores son orientativos (no hay un esquema único oficial).

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
