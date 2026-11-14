# Arquitectura

Aplicación web sin servidor (HTML + JavaScript). El código fuente son módulos ES
en `src/`; `npm run build` los empaqueta en un único fichero `dist/index.html`.

```
src/
  core/           piezas reutilizables, no saben de ningún puzzle concreto
    puzzle.js       definirPuzzle(): interfaz común + métodos por defecto
    perm.js         permutaciones, índices de Lehmer, paridad
    rng.js          aleatorios (con semilla para tests, criptográficos en la app)
    geometria.js    vectores, corte de polígonos, permutación de un giro, despliegue 2D
    geopuzzle.js    puzzle de pegatinas a partir de caras + planos de corte + giros
    piezas.js       modelo de piezas genérico + buscador IDA* con tablas de poda (BFS)
    simetria.js     rotaciones del puzzle entero como permutaciones de colores
    scramble.js     utilidades de scrambles de movimientos aleatorios
    render.js       SVG a partir de polígonos 2D
    modelo3d.js     vista 3D sin dibujar: modelo de pegatinas 3D, piezas, comprobación de giros
    grupo.js        orden de un grupo de permutaciones (Schreier–Sims), para demostrar invariantes
  puzzles/        un módulo por puzzle
    index.js        REGISTRO: la única lista de puzzles
    nxn.js          cubos NxN (modelo de pegatinas, notación, dibujo, scramble aleatorio, simplificación de capas)
    nxn-piezas.js   NxN: piezas y órbitas (esquinas, aristas centrales, wings, centros) deducidas de la geometría
    nxn-grupo.js    NxN: demostración de las restricciones (Schreier–Sims + paridades por órbita)
    cubo-grande.js  4x4–7x7: validador y solver por reducción (búsqueda + "aristas libres" + conmutadores + Kociemba)
    tpr4.js         4x4: reducción por búsqueda en tres fases (centros y aristas, sin paridades)
    nxn-centros.js  5x5–7x7: centros por búsqueda en tres etapas (IDA*, dos órbitas a la vez)
    cubo-comun.js   piezas y mensajes compartidos por 2x2/3x3
    cubo2.js        2x2 (validador, IDA* óptimo, estado aleatorio)
    cubo3.js        3x3 (validador, Kociemba, estado aleatorio)
    kociemba.js     algoritmo de dos fases (cubies, coordenadas, tablas, búsqueda)
    pyraminx.js     Pyraminx
    skewb.js        Skewb
    megaminx.js     Megaminx: scramble Pochmann, validador, editor, dibujo, notación
    megaminx-geo.js     Megaminx: geometría, red, giros de las 12 caras y de Pochmann, 60 rotaciones
    megaminx-piezas.js  Megaminx: piezas (12 centros, 20 esquinas, 30 aristas) y orientación libre
    megaminx-grupo.js   Megaminx: restricciones (Schreier–Sims) y cota inferior por conteo
    megaminx-busqueda.js  Megaminx: etapas (IDA* con tablas de poda de ≤ 3 piezas por región)
    megaminx-solver.js  Megaminx: las etapas, orientaciones, simplificación y respaldo
    megaminx-ultima.js  Megaminx: última capa con macros buscadas por colisiones
    square1.js      Square-1: estado de colores, validador, editor, dibujo y scramble
    square1-motor.js  Square-1: formas, paridad, tablas, solver en dos fases, estado aleatorio
  app/            interfaz
    plantilla.html, estilos.css
    main.js         interfaz (solo usa la interfaz común)
    motor.js        envía el trabajo pesado al Web Worker (o al hilo principal si no hay)
    servicio.js     tablas, scrambles, validación y búsquedas (lo usan el Worker y el hilo principal)
    worker.js       punto de entrada del Worker
    escena3d.js     escena 3D sin WebGL: triángulos, colores, giro en curso, resaltado, selección por rayo
    vista3d.js      dibujo con WebGL (sin librerías), girar con ratón/dedo, animaciones, tocar para pintar
    reproductor.js  reproductor de una secuencia (scramble o solución): pasos animados, atrás, play/pausa
tests/            node --test (npm test)
  paralelo.mjs    reparte los casos de los tests largos entre worker_threads
  trabajador.mjs  hilo de trabajo (importa el puzzle, genera sus tablas, resuelve)
scripts/
  build.mjs       genera dist/index.html y dist/artifact.html
  construir.mjs   empaquetado con esbuild (el Worker va incrustado como texto y se crea desde un blob)
  bench.mjs       benchmark de todos los solvers (npm run bench)
  comprobar-3d.py comprobación en Chromium real de la vista 3D (Playwright; capturas y FPS en docs/capturas/)
```

## Interfaz común de un puzzle

Cada módulo exporta `definirPuzzle({...})`. Obligatorio:

| Campo / método | Qué es |
|---|---|
| `id`, `nombre` | identificador y nombre visible |
| `paleta` | `[{nombre, hex}]`; los estados guardan índices de esta paleta |
| `capacidades` | `{ scramble, validar, resolver, editar }` (la interfaz activa o desactiva el editor con esto) |
| `estadoResuelto()` | estado resuelto (en los puzzles de pegatinas, un array de colores) |
| `aplicarMovimiento(estado, mov)` | devuelve un estado nuevo; lanza error si el movimiento no existe |
| `estaResuelto(estado)` | `true` si está resuelto (en cualquier orientación) |
| `generarScramble(rng)` | lista de movimientos (strings en notación WCA) |
| `invertirMovimiento(mov)` | inverso de un movimiento |
| `infoMovimiento(mov)` | `{eje, clave}` para detectar redundancias |
| `renderizar(estado, {editable, editables, seleccion})` | SVG (string); las pegatinas editables llevan `class="pegatina" data-i="i"`; `seleccion` = primer toque de una herramienta de dos toques |

Opcional (según `capacidades`):

| Método | Qué es |
|---|---|
| `validar(estado)` | `{ valido, errores: [mensajes en lenguaje claro] }` |
| `inicializar()` | genera las tablas (idempotente); devuelve `{ms}` |
| `estaInicializado()` | si las tablas ya están |
| `resolver(estado, opciones)` | `{ ok, movimientos, ms }` o `{ ok: false, errores }` |
| `pegatinasEditables()` | índices que el editor deja pintar |
| `pintar(estado, i, color)` | estado con la pegatina `i` pintada (por defecto: array) |
| `buscarRedundancia(movs)` | `null` o descripción del problema (por defecto usa `infoMovimiento`) |
| `parsear(texto)`, `formatear(movs)` | texto ↔ lista (por defecto separado por espacios) |
| `clonar(estado)` | copia independiente (por defecto: `slice()` de un array o copia JSON) |
| `pegatinasEditables(estado)` | puede depender del estado (Square-1); sin estado, del resuelto |
| `herramientas`, `usarHerramienta(estado, id, indices, {color})` | herramientas del editor `{id, nombre, icono, toques, usaColor, titulo}` (1 o 2 toques; `color` = último color elegido); lanza un `Error` con un mensaje claro si no se puede |
| `herramientaInicial`, `indicesInmediatos` | herramienta elegida al empezar; índices que con una herramienta se aplican al momento (con `pintar`) |
| `accionesEditor`, `aplicarAccion(estado, id, {color})` | botones extra del editor `{id, etiqueta, titulo}` (p. ej. girar una capa) |
| `vistasEditor` | `[{id, nombre}]`: vistas del editor (la primera es la de por defecto); `renderizar` recibe `{vista}` (NxN: red completa o una cara ampliada) |
| `resolver(...).fases` | `[{nombre, inicio, fin}]`: tramos de la solución (la interfaz los muestra en la reproducción) |
| `buscarRedundanciaSolucion(movs)` | redundancias en una solución (por defecto, la regla de los scrambles; NxN: tramos que se pueden escribir con menos movimientos) |
| `estadoVistaScramble(estado)` | estado que muestra la vista previa del scramble y que carga *Cargar scramble actual* (Megaminx: el mismo, girado entero a la orientación de referencia, porque los movimientos Pochmann giran casi todo el puzzle) |
| `notaScramble(movs)` | texto bajo la vista previa (Megaminx: cómo sujetar el puzzle al terminar para que coincida con la imagen) |
| `leyendaNotacion()` | `{svg, texto}`: leyenda de la notación de las soluciones (Megaminx); la interfaz la muestra en un desplegable |
| `renderizar(estado, {etiquetas})` | la interfaz pide `etiquetas: true` mientras hay una solución (Megaminx: letra de cada cara en su centro) |
| `resolver(...).fases[].grupo` | clase de color de la fase (`f-<grupo>`); si no hay, se usa el nombre |
| `vista3D(estado)`, `giro3D(estado, mov)`, `reorientar3D(estado)` | geometría 3D y giros para la vista 3D (ver "Vista 3D" más abajo) |
| `aplicarSecuencia`, `invertir` | se rellenan automáticamente |
| `tipoScramble`, `descripcion`, `avisoInicializacion`, `describirLongitud(movs)` | textos para la interfaz |

## Cómo añadir un puzzle

1. Crear `src/puzzles/mipuzzle.js` que exporte `definirPuzzle({...})`.
2. Añadir una línea en `src/puzzles/index.js`.
3. Crear `tests/mipuzzle.test.mjs` usando `probarScrambles`, `probarSolver` y `debeRechazar` de `tests/util.mjs`.

La interfaz (`src/app/main.js`) solo usa la interfaz común: no hay que tocarla. Las tablas se
generan donde las pida `servicio.js` (Worker o hilo principal) llamando a `inicializar()`; un
puzzle no necesita saber nada del Worker, pero su estado debe poder copiarse con
`postMessage` (arrays y objetos simples).

### Herramientas para puzzles nuevos
- **Puzzle de cortes planos** (Megaminx, FTO, Dino…): `crearGeoPuzzle({caras, cortes, giros, rotaciones, red})` da pegatinas, permutaciones de cada giro, rotaciones del puzzle entero y la red 2D.
- **Validador y solver**: `crearModeloPiezas({orbitas, movimientos, coloresResuelto})` identifica piezas por colores (detecta piezas inexistentes y especulares) y da coordenadas; `crearBuscador({coords, movs, ejes, podas, objetivo})` genera tablas de poda por BFS y resuelve con IDA*. Las tablas también sirven para decidir si una coordenada es alcanzable (validador).
- **Orientación libre al pintar**: `permutacionesDeColor(rotaciones, …)` + `reetiquetar`.

### Square-1 (cómo está hecho)
- Casillas de 30° numeradas desde el corte por el frente; "/" legal si ninguna esquina cruza el corte (el modelo lanza error si no).
- Fase 1: búsqueda por formas (máscaras de 12 bits) hasta la forma de cubo con la paridad adecuada; fase 2: en forma de cubo, con las dos alineaciones en las que "/" conserva el cubo. Detalles y demostraciones en DECISIONES.md.

### Cubos grandes (cómo está hecho)
- `nxn-piezas.js` agrupa las pegatinas en piezas (por cubie) y órbitas (por movimientos); vale para cualquier N.
- `cubo-grande.js`: al inicializar busca 3-ciclos puros de cada órbita de centros y wings (conmutadores [X, A·B·A⁻¹] cuyos soportes se cortan en una pieza) y calcula, para cada trío de posiciones, el setup más corto; también conmutadores "múltiples" (2–4 3-ciclos a la vez).
- Resolver (noche 4):
  - **4x4**: `tpr4.js` reduce el cubo (centros + aristas emparejadas, sin paridad OLL ni PLL) en tres fases de búsqueda con tablas que se generan al inicializar; luego 3x3 con `cubo3.js`.
  - **5x5–7x7**: centros con `nxn-centros.js` (búsqueda por grupos de dos órbitas, que deja además la paridad de las wings arreglada) → centros que falten (oblicuos del 6x6/7x7) con 3-ciclos simples y múltiples → **aristas libres** (noche 6): voraz con macros `S · A M A⁻¹ · S⁻¹` que no mueven ningún centro, un giro de cara de preparación y anticipación de un paso; se generan al inicializar (2.880 / 6.048 / 8.496) y cada una guarda qué comparaciones de pegatinas cambia → lo que quede, con 3-ciclos simples y múltiples (N par: hacia la asignación de aristas enteras a ranuras que se elige al acabar el voraz) → paridad PLL (N par, según la paridad de esa asignación) → 3x3 (objetivo 18).
  - Límite de tiempo `tiempoMax` (10 s): recorta los pasos opcionales (anticipación, tiempo del 3x3, segundo intento del 4x4) si los anteriores ya han tardado; siempre devuelve una solución completa.
  - Si una búsqueda no termina dentro de su límite, se usa el método de conmutadores de la noche 3 para lo que falte (siempre correcto). Detalles y cifras en DECISIONES.md y ESTADO.md.

### Megaminx (cómo está hecho)
- `megaminx-geo.js`: el motor geométrico da las 132 pegatinas, la red (dos flores), los 48 giros de cara (`R`, `R'`, `R2`, `R2'`…), los de Pochmann (`R++`, `D--`, `U`) y las 60 rotaciones. `megaminx-piezas.js` agrupa las pegatinas en piezas por las capas en las que están y crea el modelo de piezas; los centros pintados dan la orientación (se reetiquetan los colores).
- `megaminx-busqueda.js`: una etapa = caras permitidas + piezas objetivo. Los huecos (posición·orientación) se numeran dentro de la región de la etapa; tablas de poda exactas de grupos de ≤ 3 piezas que cubren todos los pares; IDA* con la heurística del máximo, que puede devolver varias soluciones de la longitud mínima.
- `megaminx-solver.js`: 10 etapas que van retirando caras (Base 1–4, Anillo 1–3, F2L 1–3; ver DECISIONES.md), última capa con `megaminx-ultima.js` (dos macros de una biblioteca de ~10.800, encontradas al inicializar por colisiones de secuencias de U, F, R), todo en varias de las 60 orientaciones mientras quede tiempo; simplificación con conmutación de caras no vecinas.
- Restricciones y cota inferior: `megaminx-grupo.js` (los tests las comprueban).

## Vista 3D

La vista 3D es genérica: no sabe de ningún puzzle. Cada puzzle describe su geometría y sus
giros con dos métodos de la interfaz común (`src/core/modelo3d.js` explica el formato):

| Método | Devuelve |
|---|---|
| `vista3D(estado)` | `{ geometria, colores }`. `geometria = { pegatinas, radio, camara }`; cada pegatina es `{ puntos, normal, centro, indice, pieza }`: polígono convexo 3D (la pegatina entera; la vista la encoge y pone el cuerpo negro detrás), normal hacia fuera, `indice` = el índice que entienden `pintar` / `usarHerramienta` (o `null` si no se edita) y `pieza` = clave de su pieza. `camara = { desde, arriba }`: desde dónde se mira en la orientación de referencia. `colores[k]` = color (índice de la paleta, −1 sin pintar) de la pegatina k. Si la forma no cambia, la geometría es siempre el mismo objeto (la vista solo cambia colores). |
| `giro3D(estado, mov)` | `[{ eje, angulo, pegatinas }]`: partes que giran a la vez (radianes, regla de la mano derecha; `pegatinas` = índices en la geometría de `vista3D(estado)`). Una parte en casi todo; dos en el `(x,y)` del Square-1. |
| `reorientar3D(estado)` (opcional) | `{ partes, estado }`: giro del puzzle entero que lleva a la orientación de referencia (Megaminx: al final del scramble, para llegar a la vista previa). |

**La regla** (la comprueban los tests, `comprobarGiro3D`): si se giran las pegatinas de
`giro3D(e, m)` su ángulo completo, cada posición queda con el color que da
`vista3D(aplicarMovimiento(e, m))`. Por eso la animación nunca "salta": al acabar cada giro, la
vista enseña el estado siguiente del modelo y es exactamente lo que ya se veía.

Cómo lo da cada puzzle:
- **Puzzles de pegatinas con geometría fija** (todos menos el Square-1): `modelo3DPegatinas({ poligonos, normales, giro, cortes, camara })`. Las piezas salen solas de los planos de corte (misma pieza = mismo lado de todos los cortes).
  - NxN: `modelo3DNxN(N)` en `nxn.js` (cuadrados de lado 2/N; un giro rota las capas que mueve su permutación).
  - Pyraminx, Skewb, Megaminx: `modelo3DGeo(geo, camara)` en `geopuzzle.js`, a partir de los mismos polígonos, giros (eje, ángulo, umbral) y cortes con los que el motor geométrico calcula las permutaciones. `geo.rotaciones3D()` da las rotaciones del puzzle entero con su eje y ángulo (Megaminx: `reorientar3D`).
- **Square-1** (`square1.js`): la geometría depende del estado (forma de las capas y capa del medio volteada), así que `vista3D` la construye en cada estado: cuñas de 30° por casilla en el mismo sitio que en el dibujo 2D, la capa del medio con el corte según la Regulación 12c1. `giro3D` da dos partes en `(x,y)` (capa de arriba y de abajo alrededor del eje vertical) y una en `/` (la mitad de las casillas 0..5 y la mitad derecha del medio, 180° alrededor del eje perpendicular al corte).

Piezas de la app:
- `src/app/escena3d.js` (sin WebGL; la usan los tests): triángulos (cuerpo negro + pegatina encogida y algo elevada), colores, giro en curso (`giro(partes, fracción)`), resaltado, `foto()` (centros y colores de lo que se ve) y `elegir(origen, dir)` (pegatina que corta un rayo, también con una capa a medio girar).
- `src/app/vista3d.js`: WebGL 1 con un solo shader; el giro en curso son dos matrices uniformes (cada vértice dice si es de la parte 1, de la 2 o fijo), así que animar no reescribe buffers. Se dibuja solo cuando algo cambia (animación, arrastre, nuevo estado). Arrastrar gira el puzzle (ratón o dedo); tocar sin arrastrar elige pegatina. Si no hay WebGL (o se pierde el contexto), la app usa la vista 2D.
- `src/app/reproductor.js`: lo usan el scramble (vista previa) y la solución (editor). En 3D anima cada paso (velocidad ×1…×8, pausa, paso atrás animado, ir a cualquier paso); en 2D cambia al momento.

**Resaltar piezas** (para el modo aprender): `vista.resaltar(indicesDeLaGeometria, 'brillo' | 'transparencia')`, `vista.resaltarPiezas(clavesDePieza, modo)` y `vista.resaltar(null)` para quitarlo; `pegatinasDePiezas(geometria, claves)` (en `modelo3d.js`) da las pegatinas de unas piezas. Desde la consola o desde otro módulo: `window.cuboSolver.vista3D('previa' | 'editor')` y `cuboSolver.resaltarPiezas('editor', claves, modo)`.

Para un puzzle nuevo: si es de cortes planos, `...modelo3DGeo(geo, camara)` y ya está; si no, `vista3D` y `giro3D` a mano, y el test `tests/vista3d.test.mjs` dice si la animación coincide con el modelo.

## Interfaz: Deshacer
`main.js` guarda el estado del editor antes de cada cambio (pintar, herramientas, acciones, *Resetear*, *Cargar scramble*; hasta 200) y *Deshacer* (o Ctrl+Z) lo recupera. No necesita nada de los puzzles salvo `clonar`.

## Tests en paralelo
`tests/paralelo.mjs` (`resolverEnParalelo`) reparte los casos de un test de solver entre worker_threads con una cola dinámica. El hilo principal genera los estados (con la misma semilla que antes) y comprueba cada solución; cada hilo (`tests/trabajador.mjs`) importa el módulo del puzzle, genera sus tablas y llama a `resolver`. Los ficheros de tests se ejecutan de uno en uno (`--test-concurrency=1`) para no tener más hilos que núcleos: varios solvers tienen límites de tiempo.

## Plan para las próximas noches
- Noche 8: modo aprender (usará `resaltarPiezas` de la vista 3D).
- Todos los puzzles tienen ya validador y solver. Lo que más pesa ahora en el 6x6 y el 7x7 son los centros oblicuos (3-ciclos, ~120 y ~125 movimientos); ver ESTADO.md. Otras mejoras posibles: scramble de estado aleatorio en el 4x4 y, para el Megaminx, etapas más grandes o una búsqueda en haz entre etapas.
