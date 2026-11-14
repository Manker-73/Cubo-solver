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
    grupo.js        orden de un grupo de permutaciones (Schreier–Sims), para demostrar invariantes
  puzzles/        un módulo por puzzle
    index.js        REGISTRO: la única lista de puzzles
    nxn.js          cubos NxN (modelo de pegatinas, notación, dibujo, scramble aleatorio, simplificación de capas)
    nxn-piezas.js   NxN: piezas y órbitas (esquinas, aristas centrales, wings, centros) deducidas de la geometría
    nxn-grupo.js    NxN: demostración de las restricciones (Schreier–Sims + paridades por órbita)
    cubo-grande.js  4x4–7x7: validador y solver por reducción (búsqueda + conmutadores + Kociemba)
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
tests/            node --test (npm test)
scripts/
  build.mjs       genera dist/index.html y dist/artifact.html
  construir.mjs   empaquetado con esbuild (el Worker va incrustado como texto y se crea desde un blob)
  bench.mjs       benchmark de todos los solvers (npm run bench)
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
  - **5x5–7x7**: centros con `nxn-centros.js` (búsqueda por grupos de dos órbitas, que deja además la paridad de las wings arreglada) → centros que falten (oblicuos del 6x6/7x7) con 3-ciclos simples y múltiples → aristas con 3-ciclos simples y múltiples → paridad PLL (N par) → 3x3.
  - Si una búsqueda no termina dentro de su límite, se usa el método de conmutadores de la noche 3 para lo que falte (siempre correcto). Detalles y cifras en DECISIONES.md y ESTADO.md.

### Megaminx (cómo está hecho)
- `megaminx-geo.js`: el motor geométrico da las 132 pegatinas, la red (dos flores), los 48 giros de cara (`R`, `R'`, `R2`, `R2'`…), los de Pochmann (`R++`, `D--`, `U`) y las 60 rotaciones. `megaminx-piezas.js` agrupa las pegatinas en piezas por las capas en las que están y crea el modelo de piezas; los centros pintados dan la orientación (se reetiquetan los colores).
- `megaminx-busqueda.js`: una etapa = caras permitidas + piezas objetivo. Los huecos (posición·orientación) se numeran dentro de la región de la etapa; tablas de poda exactas de grupos de ≤ 3 piezas que cubren todos los pares; IDA* con la heurística del máximo, que puede devolver varias soluciones de la longitud mínima.
- `megaminx-solver.js`: 10 etapas que van retirando caras (Base 1–4, Anillo 1–3, F2L 1–3; ver DECISIONES.md), última capa con `megaminx-ultima.js` (dos macros de una biblioteca de ~10.800, encontradas al inicializar por colisiones de secuencias de U, F, R), todo en varias de las 60 orientaciones mientras quede tiempo; simplificación con conmutación de caras no vecinas.
- Restricciones y cota inferior: `megaminx-grupo.js` (los tests las comprueban).

## Interfaz: Deshacer
`main.js` guarda el estado del editor antes de cada cambio (pintar, herramientas, acciones, *Resetear*, *Cargar scramble*; hasta 200) y *Deshacer* (o Ctrl+Z) lo recupera. No necesita nada de los puzzles salvo `clonar`.

## Plan para las próximas noches
- Todos los puzzles tienen ya validador y solver. Posibles mejoras: aristas del 5x5 por búsqueda (cociente 3,0), scramble de estado aleatorio en el 4x4, y para el Megaminx etapas más grandes (más tablas solapadas) o una búsqueda en haz entre etapas.
