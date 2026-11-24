# Arquitectura

Aplicación web sin servidor (HTML + JavaScript). El código fuente son módulos ES
en `src/`; `npm run build` los empaqueta en un único fichero `dist/index.html`.

```
src/
  core/           piezas reutilizables, no saben de ningún puzzle concreto
    puzzle.js       definirPuzzle(): interfaz común + métodos por defecto
    tipos.d.ts      TIPOS de los contratos (solo tipos, no se ejecuta): puzzle, bloqueos, modo aprender, 3D, secciones, Worker
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
    bloqueos.js     BLOQUEOS (puzzles vendados), genérico: legalidad, geometrías, grupo de la fase 2, BFS, scramble, estrategias A y B, envoltorio puzzleConBloqueos
    schreier.js     cadena de estabilizadores con arrays tipados (orden, pertenencia, elemento al azar)
    tabla-estados.js  tabla hash de estados empaquetados (BFS completo de los espacios pequeños)
  puzzles/        un módulo por puzzle
    index.js        REGISTRO: la única lista de puzzles (con su `categoria`: sección de la app) y PUZZLES_PRONTO (anunciados)
    nxn.js          cubos NxN (modelo de pegatinas, notación, dibujo, scramble aleatorio, simplificación de capas)
    nxn-piezas.js   NxN: piezas y órbitas (esquinas, aristas centrales, wings, centros) deducidas de la geometría
    nxn-grupo.js    NxN: demostración de las restricciones (Schreier–Sims + paridades por órbita)
    cubo-grande.js  4x4–7x7: validador y solver por reducción (búsqueda + "aristas libres" + conmutadores + Kociemba)
    tpr4.js         4x4: reducción por búsqueda en tres fases (centros y aristas, sin paridades)
    nxn-centros.js  5x5–7x7: centros por búsqueda en tres etapas (IDA*, dos órbitas a la vez)
    cubo-comun.js   piezas y mensajes compartidos por 2x2/3x3
    cubo2.js        2x2 (validador, IDA* óptimo, estado aleatorio)
    cubo3.js        3x3 (validador, Kociemba, estado aleatorio)
    kociemba.js     algoritmo de dos fases (cubies, coordenadas, tablas, búsqueda; filtro de legalidad opcional; óptima por IDA* para comparar)
    nxn-bloqueos.js soporte de bloqueos de los NxN (piezas y núcleo, M/E/S, capas, identificar por colores) y firmas de la comunidad
    cubo3-bloqueos.js  3x3 vendado: Kociemba con legalidad (búsqueda directa), comparación sin bloqueos y ejemplos
    vendado.js      fábrica crear3x3Vendado(bloques | firma) para tests y scripts
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
    fto.js          FTO: validador (orientación libre), editor, scramble de estado aleatorio, interfaz común
    fto-geo.js      FTO: geometría (octaedro, cortes), red 2D, 16 giros, piezas (6 esquinas, 12 aristas, 24 triángulos), tétradas, 24 rotaciones
    fto-grupo.js    FTO: restricciones (Schreier–Sims), número de posiciones y cota inferior por conteo
    fto-solver.js   FTO: solver en tres fases (coordenadas propias + crearBuscador), estados aleatorios, simplificación
  aprender/       modo aprender: soluciones por métodos humanos, explicadas por etapas
    guion.js          resultado común: etapas con objetivo, bloques con texto, algoritmo y piezas
    motor-cubo.js     cubos 2x2/3x3: piezas por colores, IDA* con tablas de 1–3 piezas, búsqueda de algoritmos (macros)
    algoritmos.js     OLL, PLL y los del método de principiantes (notación WCA; se comprueban al cargar)
    objetivos-cubo.js objetivo de cada etapa comprobado sobre las pegatinas (lo usan los métodos y los tests)
    metodos-3x3.js    3x3: por capas para principiantes y CFOP (también la etapa 3x3 del 4x4)
    metodos-2x2.js    2x2: por capas y Ortega
    metodos-nxn.js    4x4 y 5x5: reducción humana (centros —en el 5x5, X y cruz por separado—, aristas, 3x3 sobre un cubo virtual y paridades)
    metodos-pyraminx.js  Pyraminx: puntas, centros, primera capa y última capa
    metodos-skewb.js     Skewb: primera capa (arriba), esquinas de abajo (sledgehammers) y centros
    metodos-square1.js   Square-1: forma de cubo, orientar, permutar y paridad (con las tablas de la fase 2 del solver)
  app/            interfaz
    plantilla.html, estilos.css   (cabecera, portada, herramienta; temas oscuro y claro con variables CSS)
    fuentes/        subconjuntos woff2 (Inter, Bricolage Grotesque, JetBrains Mono) que build.mjs incrusta; licencias OFL
    secciones.js    SECCIONES (portada y menú) y rutas por hash: leerRuta / hashDe (sin DOM)
    tema.js         tema oscuro por defecto / claro, guardado en localStorage
    main.js         interfaz (solo usa la interfaz común): secciones, herramienta, navegación
    motor.js        dos Web Workers (principal: tablas del solver, validar, resolver; fondo: scrambles) con cola por prioridades (o el hilo principal si no hay)
    servicio.js     tablas, scrambles, validación y búsquedas (lo usan el Worker y el hilo principal)
    worker.js       punto de entrada del Worker
    escena3d.js     escena 3D sin WebGL: triángulos, colores, giro en curso, resaltado, selección por rayo
    vista3d.js      dibujo con WebGL (sin librerías), girar con ratón/dedo, animaciones, tocar para pintar
    reproductor.js  reproductor de una secuencia (scramble o solución): pasos animados, atrás, play/pausa
    bloqueos-ui.js  sección "Bloqueos": grupos tocando piezas (2D/3D), ejemplos, guardar, URL, firmas
tests/            node --test (npm test; niveles: ver "Tests" más abajo)
  diseno.test.mjs rutas de las secciones y contraste ≥ 4,5:1 de los colores de los dos temas
  humo.test.mjs   prueba de humo de cada puzzle del registro, huellas de los giros, vendado y modo aprender
  huellas.json    huellas (hash del estado) de cada giro básico y de una secuencia fija por puzzle
  aprender-comprobar.mjs  objetivos por etapa y comprobación de una solución del modo aprender (aprender y humo)
  util.mjs        CASOS, NIVEL, casosPor, guardarResultado, probarScrambles, probarSolver, debeRechazar
  paralelo.mjs    reparte los casos de los tests largos entre worker_threads
  trabajador.mjs  hilo de trabajo (importa el puzzle, genera sus tablas, resuelve)
scripts/
  build.mjs       genera dist/index.html y dist/artifact.html (con las fuentes en base64; SIN_FUENTES=1 sin ellas)
  fuentes.sh      regenera los subconjuntos de src/app/fuentes/ (fonttools)
  comprobar-fto.py     FTO en Chromium real: tiempos (escritorio y CPU ×4) y recorrido desde la portada en 4 modos (capturas fto-*.jpg)
  comprobar-diseno.py  rediseño en Chromium real: portada, WCA (3x3 en 3D) y Bandaged, escritorio/móvil, oscuro/claro, sin red
  construir.mjs   empaquetado con esbuild (el Worker va incrustado como texto y se crea desde un blob)
  bench.mjs       benchmark de todos los solvers (npm run bench)
  tests.mjs       lanzador de los tests por niveles (test:humo, test:rapido, test:solo)
  comprobar-3d.py comprobación en Chromium real de la vista 3D (Playwright; capturas y FPS en docs/capturas/)
  comprobar-aprender.py  modo aprender en Chromium real (escritorio y móvil)
  comprobar-primer-resolver.py  un solo clic en "Resolver" nada más cargar la página (caché vacía; móvil con la CPU a ×4)
  comprobar-bloqueos.py  cubo vendado en Chromium real (escritorio y móvil, con y sin 3D)
  mezcla-bloqueos.mjs    cuánto hay que mezclar un cubo vendado con giros al azar (criterio de la longitud del scramble)
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
| `metodosAprender`, `aprender(estado, metodo)` | modo aprender: `[{id, nombre, descripcion}]` y la solución por ese método humano (ver "Modo aprender"); si el estado no es válido, `{ ok: false, errores }` |
| `costeScramble` | ms aproximados del primer scramble (las tablas que necesita generarScramble; 0 en los de movimientos aleatorios): ordena las precargas |

Estas dos tablas están, como tipos, en `src/core/tipos.d.ts` (`DefinicionPuzzle<E>` y `Puzzle<E>`; ver "Tipos"). En los tipos `capacidades` es obligatorio (todos los puzzles lo dan), aunque en ejecución `definirPuzzle` lo rellena si falta.

## Cómo añadir un puzzle

1. Crear `src/puzzles/mipuzzle.js` que exporte `definirPuzzle({...})`, con `// @ts-check` en la primera línea (ver "Tipos").
2. Añadir una línea en `src/puzzles/index.js` (y, si tiene campos propios, a `EXTRAS` en `tests/registro.test.mjs`).
3. Crear `tests/mipuzzle.test.mjs` usando `probarScrambles`, `probarSolver` y `debeRechazar` de `tests/util.mjs`.
4. `npm run tipos` (menos de 1 s) y `npm run test:solo -- <área>`.

La interfaz (`src/app/main.js`) solo usa la interfaz común: no hay que tocarla. Las tablas se
generan donde las pida `servicio.js` (Worker o hilo principal) llamando a `inicializar()`; un
puzzle no necesita saber nada del Worker, pero su estado debe poder copiarse con
`postMessage` (arrays y objetos simples).

### Herramientas para puzzles nuevos
- **Puzzle de cortes planos** (Megaminx, FTO, Dino…): `crearGeoPuzzle({caras, cortes, giros, rotaciones, red})` da pegatinas, permutaciones de cada giro, rotaciones del puzzle entero y la red 2D.
- **Validador y solver**: `crearModeloPiezas({orbitas, movimientos, coloresResuelto})` identifica piezas por colores (detecta piezas inexistentes y especulares) y da coordenadas; `crearBuscador({coords, movs, ejes, podas, objetivo})` genera tablas de poda por BFS y resuelve con IDA*. Las tablas también sirven para decidir si una coordenada es alcanzable (validador). Las coordenadas pueden ser propias (`{nombre, tam, codificar(estadoPiezas), mover(idx, mov)}`; el FTO usa subconjuntos, tríos y paridades). Con `cierre: [índices de movs]` el objetivo es el subgrupo que generan esos giros (fases tipo Kociemba): cada tabla empieza con distancia 0 en lo que se alcanza desde `objetivo` con ellos y el objetivo se da por alcanzado cuando todas las tablas dan 0 (quien lo usa debe comprobar que basta).
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

### FTO (cómo está hecho)
- `fto-geo.js`: octaedro con un corte por cara a 1/3 del inradio (`crearGeoPuzzle`), notación del Reglamento WCA 2027 (12f), colores de TNoodle, red de dos cuadrados (delante y detrás). Las piezas salen de las capas de cada pegatina. Las caras forman dos **tétradas** que no se tocan, A = {U, F, BR, BL} y B = {R, L, B, D}; ordenando las pegatinas de cada pieza desde una cara A, las aristas nunca se voltean y las esquinas solo giran media vuelta. Los triángulos son dos órbitas de 12 (los de A y los de B) y se tratan por su color (los tres de una cara son iguales).
- `fto-grupo.js`: Schreier–Sims (órdenes por órbita, total = producto, 12 rotaciones en el grupo, |⟨R, L, B, D⟩| = 933.120), posiciones (3,14·10²²) y cota inferior por conteo (21).
- `fto.js`: el FTO no tiene ninguna pieza fija. El validador elige el reetiquetado de colores (una de las 24 rotaciones) por las aristas (qué colores hacen de tétrada A) y da el estado de piezas en las 12 orientaciones del grupo. `resolver` reparte el tiempo entre ellas (rondas de 40 ms, ×3) y se queda con la solución más corta en `tiempoMax` (1 s).
- `fto-solver.js`: tres fases (G0 → ⟨U, R, L, B, D⟩ → ⟨R, L, B, D⟩ → resuelto, como `fto3phase` de TNoodle) con coordenadas propias y `crearBuscador` (la fase 2 con `cierre`); tablas: 96.800 + 11,3 M + 4 × 35.200 + 3,7 M bytes (~2 s en escritorio). Una búsqueda propia sobre las tablas del buscador enumera varias soluciones de la fase 1, salta giros de caras opuestas en orden decreciente (conmutan) y comprueba que la fase 2 llega a G2.
- Scramble de estado aleatorio exacto: se resuelve el estado elegido en 12 marcos girados (conjugación: girar el puzzle entero y traducir los nombres de los giros), así la solución lleva siempre al resuelto de referencia y el reparto es uniforme.
- Vista 3D: `modelo3DGeo` (cámara casi de frente al vértice delantero, como se sujeta para mezclar).

## Tipos

El código sigue siendo JavaScript (módulos ES que Node y esbuild ejecutan tal cual). TypeScript 7 solo
**comprueba**: `npm run tipos` = `tsc --noEmit` (≈ 0,4 s), dentro de `test:humo` y como paso de la
Action de tests. No genera nada ni cambia el bundle (esbuild recibe un tsconfig vacío, ver
`scripts/construir.mjs`).

- **Dónde están**: los contratos, en `src/core/tipos.d.ts` (un solo sitio): `DefinicionPuzzle<E>` / `Puzzle<E>`
  (la interfaz común, con el estado como tipo genérico `E`; `EstadoPegatinas = number[]` en casi todos),
  `ResultadoResolver` y `Fase`, `Herramienta`/`AccionEditor`/`OpcionesRender`, la vista 3D (`Vista3D`,
  `Geometria3D`, `Pegatina3D`, `ParteGiro3D`), el modo aprender (`ResultadoAprender`, `EtapaGuion`,
  `BloqueGuion`, `Guion<E>`), los bloqueos (`SoporteBloqueos<E>`, `DefinicionBloqueos`, `InfoBloqueos`,
  `PuzzleVendado<E>`), el registro y las secciones (`Categoria`, `PuzzleRegistrado`, `Seccion`, `Ruta`) y los
  mensajes con el Worker (`Peticion`, `RespuestasPorOperacion`, `MensajeAlWorker`, `MensajeDelWorker`). Los
  tipos internos de un módulo (numéricos, mínimos) van en ese módulo con `@typedef` (`EstadoOrbita` y
  `Buscador` en `piezas.js`; `ModeloBloqueos`, `Analisis`… en `bloqueos.js`).
- **Qué se comprueba**: solo los ficheros que empiezan con `// @ts-check` (`tsconfig.json`: `allowJs`,
  `checkJs: false`, `strict`). Hoy: `core/puzzle.js`, `core/piezas.js`, `core/modelo3d.js`, `core/bloqueos.js`,
  `aprender/guion.js`, `puzzles/index.js`, `app/servicio.js`, `app/secciones.js` y los puzzles `skewb.js`,
  `pyraminx.js`, `cubo2.js` y los cuatro módulos del FTO. Los demás se leen para conocer sus tipos, pero no dan errores.
- **Cómo se usan desde JavaScript**: `/** @import { Puzzle, EstadoPegatinas } from '../core/tipos.js' */` y
  comentarios `@param`, `@returns`, `@type`, `@typedef`. Un cast es `/** @type {X} */ (expresión)`: los
  paréntesis no cambian nada al ejecutar. **Nunca** se cambia código para contentar al comprobador (ni
  variables nuevas ni desestructuraciones distintas): el bundle minificado tiene que salir idéntico.
- **Lo que comprueba `definirPuzzle`**: su parámetro es `DefinicionPuzzle<E> & X`, con `E` deducido de
  `estadoResuelto()` y `X` = los campos propios del puzzle (geo, modelo…), que se permiten y se conservan en
  el resultado. Si falta un obligatorio sale `Property 'estaResuelto' is missing … required in type
  'DefinicionPuzzle<…>'`. Las funciones que devuelven un resultado de la interfaz se anotan
  (`@returns {ResultadoResolver}`), así un campo mal escrito da `'fasses' does not exist in type 'ResolverOk'.
  Did you mean to write 'fases'?`. Un nombre mal escrito de un campo **opcional** de la definición
  (`metodosAprendr`) no se detecta: cae en `X`. Lo detecta `tests/registro.test.mjs` (noche 12): cada campo de cada
  puzzle del registro tiene que estar en `DefinicionPuzzle`/`Puzzle` (los lee de este fichero) o en la lista de
  campos propios permitidos de ese puzzle (`EXTRAS`). Un puzzle nuevo con campos propios los añade ahí.

**Cómo añadir un puzzle tipado** (lo que se hizo con el Skewb, el Pyraminx y el 2x2):
1. `// @ts-check` en la primera línea y, debajo de los imports,
   `/** @import { EstadoPegatinas, ResultadoResolver, Rng, Movimiento } from '../core/tipos.js' */`
   (y `EstadoOrbita`, `Buscador` de `../core/piezas.js` si los usa).
2. Fijar el estado: `estadoResuelto: () => /** @type {EstadoPegatinas} */ (geo.resuelto.slice())`. Sin esto,
   un estado que viene de un módulo sin tipar (`geopuzzle.js`, `nxn.js`) sería `any` y no se comprobaría nada.
3. `@param`/`@returns` en las funciones de fuera del literal (`analizar`, `resolver`, `generarScramble`…):
   `analizar` con su resultado como unión (`{ valido: false, … } | { valido: true, …, piezas }`) para que
   `if (!a.valido)` estreche el tipo.
4. Las tablas que son `null` hasta `inicializar()` se declaran sin `null` con un cast explicado en un
   comentario (el tipo no puede seguir esa invariante entre funciones).
5. Si el modo aprender lo hace una fábrica de `src/aprender/`, poner `@returns {ResultadoAprender}` en la
   función que devuelve (aunque ese fichero aún no tenga `@ts-check`, el tipo declarado se usa).
6. `npm run tipos`, y que el bundle no cambie: `npm run build` y comparar `dist/index.html` con el de antes.

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

## Modo aprender

Un puzzle con `metodosAprender` y `aprender(estado, metodo)` tiene, además de la solución por
ordenador, soluciones por métodos humanos. `aprender` devuelve un **guion** (`src/aprender/guion.js`):

```
{ ok, metodo, movimientos, giros, fases,
  etapas: [{ nombre, objetivo, grupo, inicio, fin,
             bloques: [{ inicio, fin, texto, algoritmo, piezas }] }] }
```
- `movimientos` incluye las rotaciones del cubo entero (`x`, `y`, `z`, que el NxN entiende desde la noche 8); `giros` = los que no son rotaciones.
- Cada etapa tiene un objetivo en texto; cada bloque, lo que consigue, el nombre del algoritmo (si es uno conocido) y `piezas`: las pegatinas de las piezas en las que se trabaja **al empezar el bloque**. La interfaz las sigue movimiento a movimiento aplicando los movimientos a un "estado" con el índice de cada pegatina, y las resalta en la vista 3D (`resaltar`) o en el dibujo 2D (clase `resaltada`). Funciona en cualquier puzzle cuyo estado sea un array de pegatinas.
- `fases` (las etapas con movimientos) alimenta la barra de fases de siempre.

Cómo se construyen las soluciones:
- **Tramos de búsqueda** (cruz, parejas de F2L, cara del Ortega): IDA* sobre las piezas que importan (cada pieza se sigue por una pegatina: su casilla dice a la vez posición y orientación), con tablas exactas de 1–3 piezas que se generan la primera vez, y el conjunto de giros que usaría una persona (F2L: primero solo R y U; con F si sale más corto).
- **Recetas** (método de principiantes): lo que haría una persona, paso a paso (girar el cubo para tener el hueco delante a la derecha, poner la esquina encima, repetir R U R' U' hasta que baje bien…).
- **Algoritmos** (última capa, PBL, paridades, emparejar aristas): búsqueda de coste uniforme sobre combinaciones de "macros" (ajustes de una capa y algoritmos con nombre) que cumplan el objetivo. Los textos de cada caso (cuántas aristas orientadas, qué intercambia una PLL…) se calculan del estado.
- **4x4**: centros y aristas de pieza en pieza con macros humanas (giros de cara, Uw/Dw, conmutadores como `Rw U Rw'`, `Uw' R U R' F R' F' R Uw`) sobre una proyección del estado (solo centros o solo aristas, cada macro convertida en permutación); los cuatro últimos centros con dos tablas exactas (2¹⁶ estados) en el subgrupo F, R, B, L, Uw, Dw, que no toca los centros de arriba y abajo. Después, las etapas del 3x3 sobre un **3x3 virtual** (esquinas, una pieza de cada arista y un centro) a través de un guion intermedio que traduce los movimientos (`Rw` del 3x3 → `3Rw`) y las piezas; las paridades OLL y PLL se detectan en el 3x3 virtual (aristas volteadas impares; paridad distinta de esquinas y aristas) y se arreglan con sus algoritmos entre etapas.
- **5x5**: centros en seis partes (X y cruz de cada centro; los dos primeros con una búsqueda exacta sobre las casillas de sus cuatro piezas, los cuatro últimos con dos tablas de 2¹⁶ como el 4x4; la cruz necesita conmutadores [capa interior, capa del medio] porque, con la X hecha, las piezas en cruz opuestas viajan juntas), aristas de tres piezas trabajando siempre en la de la izquierda hasta completarla (slice–flip–slice) con la paridad de aristas del 5x5, y el 3x3 virtual como en el 4x4 (en N impar no hay paridades de 3x3).
- **Pyraminx, Skewb y Square-1** (`metodos-pyraminx.js`, `metodos-skewb.js`, `metodos-square1.js`): cada puzzle pasa sus piezas (validador, modelo de piezas, tablas del solver) a una fábrica `crearAprender…`, que devuelve `aprender(estado)`. Trabajan con los colores normalizados del validador (cualquier orientación) y escriben los textos con los colores reales. En el Square-1 el estado no es una lista de pegatinas: los bloques no llevan `piezas` y la interfaz no resalta nada.
- Cada método comprueba al final de cada etapa su objetivo (`objetivos-cubo.js` o comprobaciones propias); los tests lo comprueban otra vez aplicando la solución movimiento a movimiento, con comprobaciones independientes del método (`tests/aprender.test.mjs`).
- **Números de las OLL**: `tests/oll-numeros.test.mjs` contiene dos referencias de la comunidad y comprueba que cada algoritmo con número resuelve el caso de ese número (el caso se calcula sobre el cubo).

Para añadir un método: una función que reciba el estado, cree un guion con `crearGuion`, añada etapas y bloques, y devuelva `g.resultado(id)`; en el puzzle, `metodosAprender` y `aprender`. La interfaz y el Worker (`op: 'aprender'`) no necesitan cambios.

## Bloqueos (puzzles vendados)

El usuario agrupa piezas que quedan pegadas; un giro es **legal** solo si, para cada bloque, mueve
todas sus piezas o ninguna. Es una capa genérica sobre la interfaz común:

```js
import { puzzleConBloqueos } from './core/bloqueos.js';
const vendado = puzzleConBloqueos(cubo3, [['UFR', 'UF'], ['U', 'UL']]); // un puzzle más (definirPuzzle)
```

`puzzleConBloqueos(puzzle, bloques)` devuelve otro puzzle con la misma interfaz: `aplicarMovimiento`
lanza un error con los giros ilegales, `generarScramble` y `resolver` solo usan giros legales,
`validar` comprueba además que los bloques estén enteros y que el estado sea alcanzable, y `vista3D` /
`renderizar` dibujan unidas las pegatinas vecinas de un mismo bloque. Extra: `analisis()` (geometrías,
estados, avisos), `movimientoLegal(estado, mov)`, `bloquesIntactos(estado)`, `geometriaResuelta(estado)`.
Sin bloques, delega todo en el puzzle original (mismo scramble y misma solución).

### Qué necesita del puzzle: `soporteBloqueos`
Nada de la capa sabe de cubos. El puzzle describe sus piezas y sus giros con **puntos** (las pegatinas y,
si hace falta, puntos sin pegatina como el núcleo del 3x3):

| Campo | Qué es |
|---|---|
| `puntos`, `nPegatinas` | número de puntos (los primeros `nPegatinas` son las pegatinas del estado) |
| `piezas` | `[{ clave, tipo, puntos }]`: puntos de cada pieza en el puzzle resuelto (el primero, de referencia) |
| `busqueda` | giros de los scrambles y las búsquedas (en el 3x3, los 18 de cara) |
| `mapa(mov)`, `enCapa(mov)` | a dónde va cada punto; qué posiciones mueve el giro (también M/E/S y rotaciones) |
| `rotaciones` | mapas de las rotaciones del puzzle entero (son libres: la solución sirve en cualquier orientación) |
| `adyacentes(a, b)` | regla de validación de los bloques (piezas vecinas) |
| `identificar(estado)`, `estadoDesde(donde)` | posiciones de los puntos a partir de los colores (piezas distinguibles) y al revés |
| `ejeDe(familia)`, `pegatinas2D` | (opcionales) redundancias U D U; polígonos de la red para dibujar unidos los bloques |
| `busquedaRapida(mod, S, opciones)` | (opcional) búsqueda directa propia del puzzle; en el 3x3, Kociemba con legalidad |
| `iguales` | (opcional, noche 13) clases de piezas iguales (índices): se ven igual y se cuentan una vez |
| `todos` | (opcional) todos los giros con nombre, para traducir una solución a la orientación del usuario |
| `notacion(movs)` | (opcional) reescribe una secuencia (4x4: `3Uw` → `D` + rotación, y traduce lo que sigue) |

Dos soportes:
- `soporteBloqueosNxN(N)` (`nxn-bloqueos.js`): N = 2 y 3, estado de **colores** (las piezas se distinguen por sus colores). Es el del 3x3 vendado; no ha cambiado.
- `soporteBloqueosIdentidad(N)` (`nxn-identidad.js`, noche 13): N ≥ 4, estado de **identidades** (`estado[pos]` = número de la pegatina que hay ahí; su color es ⌊i/N²⌋). Piezas con nombre (`UFR`, `UF1`/`UF2` o `UF1`/`UF`/`UF3`, `U11`…, `U`, `núcleo`), giros de búsqueda (4x4: U, R, F de 1 a 3 capas, con la esquina DBL fija; 5x5: las 6 caras de 1 y 2 capas y las capas interiores `2U`…, con los centros fijos), núcleo vecino de los seis centros fijos y `iguales` = los centros por tipo y color. Lo usa `crearCuboConIdentidad(colores, N)`, el puzzle base del 4x4/5x5 vendado (ids `vendado-4x4`, `vendado-5x5`): sin bloques delega en el cubo normal pasando a colores; pintar está desactivado (`pegatinasEditables` vacío y `avisoPintar`).

Ya no queda nada específico del cubo en la capa (`src/core/bloqueos.js`): lo que cambia entre el 3x3 y el 4x4/5x5 lo dice el soporte (`iguales`, `todos`, `notacion`). Con `iguales`, la capa además cuenta los estados distinguibles, busca el resuelto «a la vista», usa Schreier–Sims aleatorio y construye las tablas de Minkwitz; sin él (3x3), hace exactamente lo de antes.

### Modelo (`crearModeloBloqueos`)
- Estado interno `S`: posición del punto seguido de cada pieza que se mueve con los giros de búsqueda
  (en el 3x3, 20: esquinas y aristas; los centros y el núcleo quedan fijos porque se normaliza la
  orientación). La legalidad mira la capa de las posiciones de las piezas de cada bloque.
- **Geometría**: posiciones de las piezas de los bloques, bloque a bloque (orientación incluida), con
  los bloques **congruentes** (misma forma por una rotación) ordenados, porque no se distinguen. Decide
  la legalidad y se mueve con los giros sin mirar las piezas sueltas.
- **Grupo de la fase 2**: las secuencias que salen de la geometría resuelta y vuelven a ella forman un
  grupo (aunque el puzzle entero no lo sea). Se genera con los lazos del árbol del BFS de geometrías y
  se cuenta con Schreier–Sims (`schreier.js`). Estados alcanzables = |geometrías| · |grupo de la fase 2|
  (demostración en DECISIONES.md; el BFS completo da la misma cifra en todos los casos probados).

### Análisis, scramble y solver
1. `crearAnalisisBloqueos`: validación de los bloques, giros legales en el resuelto (si no hay, *totalmente
   bloqueado*), BFS de geometrías (hasta 400.000), grupo de la fase 2, número de estados, BFS completo si
   caben (≤ 2 millones: tabla hash con estados empaquetados en bits) y, si no, tablas de poda por
   proyecciones (grupos de 4 piezas, legalidad relajada a lo que se ve de cada bloque).
   Con piezas iguales (noche 13): grupo de la fase 2 por Schreier–Sims aleatorio con la base empezando por
   todo lo que no son centros iguales sueltos (`schreier.js`: opciones `prefijo` y `sinSchreier`,
   `completarAleatorio`), estados distinguibles (`contarSimetriaIguales`: estados / |K|), estados con el
   aspecto del resuelto (objetivos del BFS) y, en espacio grande, las tablas de Minkwitz de la fase 2
   (`tablasFase2` → `src/core/minkwitz.js`: generadores = los lazos más cortos que generan el grupo, como
   palabras de giros legales; base en el orden aristas centrales, centros en cruz, esquinas, aristas,
   centros).
2. Scramble: espacio pequeño → estado uniforme de la tabla del BFS (y su solución óptima, invertida);
   grande → paseo al azar "perezoso" con giros legales (palabra reducida; longitud medida con
   `scripts/mezcla-bloqueos.mjs`).
3. `resolverBloqueos(A, S)` ejecuta las dos estrategias dentro del límite de tiempo y se queda con la
   más corta (si no hay ninguna, sigue con más tiempo hasta `msDuro`):
   - **A, búsqueda directa**: BFS (óptima) o, si el espacio es grande, la `busquedaRapida` del puzzle
     (3x3: Kociemba con cada giro filtrado por la legalidad del estado de su profundidad, con las
     tablas del 3x3 normal, que siguen siendo cotas inferiores) e IDA* con las tablas de proyecciones.
   - **B, geometría y luego permutación**: varias soluciones de la fase 1 sobre la tabla exacta de
     geometrías (las más cortas y hasta 2 más largas, en forma canónica) y, para cada una, la fase 2
     desde la geometría resuelta (BFS, búsqueda rápida, tablas de Minkwitz en el 4x4/5x5 o IDA* con poda
     max(geometría, proyecciones)).
   - El envoltorio comprueba **toda** solución giro a giro sobre el estado del usuario antes de devolverla
     (`solucionComprobada`); si no pasa, devuelve un error.
4. En el 3x3 la solución se traduce al marco del usuario (si el cubo está girado por M/E/S o x/y/z).

### Interfaz y Worker
- `servicio.js`: las peticiones pueden llevar `bloqueos`; el Worker crea (y guarda, las 3 últimas) la
  versión vendada de ese puzzle, con sus tablas. Los puzzles se buscan con `buscarPuzzle` (los del registro
  y las bases del modo vendado, `BANDAGED` en `src/puzzles/index.js`).
- Bandaged Cubes (noche 13): selector 3x3 / 4x4 / 5x5 (`BANDAGED`), `#/bandaged?puzzle=4x4&bloqueos=…`
  (sin `puzzle`, el 3x3), bloques aplicados y guardados por puzzle, firmas solo en el 3x3. `inicializar` devuelve además el análisis. Los
  scrambles de un puzzle vendado van al Worker principal (el que tiene las tablas).
- `main.js`: con bloques aplicados, `st.p` es el puzzle envuelto y las cachés (scrambles precargados,
  tablas) usan `id#bloques` como clave. `bloqueos-ui.js` lleva la sección "Bloqueos" y, mientras se
  editan, el editor (2D o 3D) enseña el cubo resuelto con cada bloque de un color.
- Vista 3D: una pegatina con `expandir: [bool por lado]` llega hasta el borde por esos lados (sin el
  hueco negro); en 2D, `svgDePegatinas(..., { expandir })` hace lo mismo con la red.

## Interfaz: secciones, navegación y temas (noche 11)

```
#/                    portada: titular, una tarjeta por sección (SECCIONES), «Cómo funciona»
#/como-funciona       portada con el foco en «Cómo funciona»
#/wca[/<id>]          WCA Puzzles: la herramienta con el selector (puzzles con categoria 'wca' + PUZZLES_PRONTO bloqueados)
#/bandaged[?puzzle=4x4|5x5][&bloqueos=…|&firma=…]   Bandaged Cubes: 3x3 (por defecto), 4x4 o 5x5 con «Tus bloques»
#/<bloqueada o desconocida>  -> #/ (replaceState)
#bloqueos=… #firma=… ?bloqueos=… ?firma=…  (enlaces antiguos) -> #/bandaged?…
```

- **`secciones.js`**: `SECCIONES = [{ id, nombre, descripcion, descripcionCorta?, estado: 'disponible' | 'bloqueada', estilo? }]` (los nombres en inglés, como en la comunidad; `INTRO_SECCION` tiene el texto en español de cada herramienta). `leerRuta(hash, search)` devuelve `{ seccion, puzzle?, consulta?, ancla?, redirigir?, antigua? }` y `hashDe(ruta)` lo contrario; no tocan el DOM (los prueba `tests/diseno.test.mjs`). **Para añadir una sección**: una línea en `SECCIONES` (bloqueada sale ya en la portada como «Próximamente»); para abrirla, `estado: 'disponible'` y, en `main.js`, qué hace `aplicarRuta` con ella (qué puzzles muestra el selector: los de su `categoria`).
- **`main.js`**: `aplicarRuta()` (al cargar y en cada `hashchange`) muestra `#portada` o `#herramienta`, pone el título y la introducción de la sección y elige el puzzle (`seleccionar`, síncrona como siempre). `st.seccion` decide dos cosas: el selector (`pintarSelector` solo en WCA) y los bloques (`puzzleActivo` solo envuelve el 3x3 con `puzzleConBloqueos` en Bandaged; el panel de bloques recibe `base() = null` fuera de Bandaged y se oculta). Los cambios de URL que no son una navegación del usuario (elegir un chip, aplicar bloques, normalizar un enlace antiguo) usan `history.replaceState`, que no dispara `hashchange`.
- La herramienta es un solo DOM para las dos secciones (mismos ids que antes); en Bandaged el panel de bloques va primero por CSS (`.seccion-herramienta[data-seccion="bandaged"] .panel-bloqueos { order: -1 }`).
- **Temas** (`tema.js` + `estilos.css`): `data-theme="dark" | "light"` en `<html>`; `:root` tiene los colores oscuros (por defecto, sin mirar `prefers-color-scheme`) y `:root[data-theme="light"]` los claros. Variables: `--fondo`, `--superficie` (paneles), `--linea`, `--tinta`, `--tenue`, `--acento`, `--acento-texto`, `--acento-tinta` (texto sobre acento), `--acento-suave`, `--raya-1`/`--raya-2` (fondo rayado de lo bloqueado), `--error(-suave)`, `--ok(-suave)`, `--aviso`, `--lienzo` (fondo de las vistas 2D/3D) y `--contorno` (contorno fino de los dibujos en oscuro). El test de contraste lee estos dos bloques del CSS: un color nuevo de texto o de fondo debe añadirse a su lista de pares.
- **Fuentes**: `--f-display` (Bricolage Grotesque 800, títulos), `--f-texto` (Inter), `--f-mono` (JetBrains Mono 500, notación y etiquetas), incrustadas como `@font-face` en base64 por `build.mjs` (marcador `/*FUENTES*/` de la plantilla), con pilas del sistema detrás. La app no hace ninguna petición de red.
- `window.cuboSolver.estado()` incluye `seccion`, `tema` y `bloqueos` (número de bloques del puzzle activo).

## Interfaz: arranque
- (Desde la noche 11, al entrar en una sección con herramienta; en la portada no se elige ninguno.) El puzzle inicial se elige **al momento**, sin esperar a que los Workers respondan al ping (las peticiones esperan en la cola del motor). Los botones que necesitan un puzzle (*Resetear*, *Cargar*, *Resolver*, *Nuevo scramble*, *Copiar*) empiezan desactivados en el HTML y `seleccionar` los activa.
- *Resolver* nunca ignora un clic: si las tablas del puzzle no están, muestra "Generando tablas… X s · la solución aparecerá al terminar." (el tiempo desde que empezaron a generarse; `asegurarTablas` comparte una sola petición y un solo aviso por puzzle) y la solución aparece sola al terminar.

## Interfaz: cambio de puzzle, scrambles precargados y Workers
- **Al elegir un puzzle, los dos paneles cambian a la vez, en el mismo instante** (`seleccionar` es síncrona hasta ahí): el de resolver, y el del scramble con su etiqueta y, si no hay uno precargado, el puzzle nuevo resuelto y "Generando scramble…" (copiar, cargar y el reproductor del scramble desactivados). Las tablas del solver se piden después y no retrasan el scramble.
- **Precargas** (`st.precargados`: un scramble listo por puzzle). Al mostrar uno se pide el siguiente de ese puzzle (prioridad media) y los de los demás puzzles (prioridad baja), de menor a mayor `costeScramble`. Sin Worker, solo los que no necesitan tablas. En el móvil (`(max-width: 700px), (pointer: coarse)`), los de más de 500 ms (Square-1 y 3x3) no se precargan hasta que el usuario elige ese puzzle una vez. Las tablas del solver (las grandes del 6x6/7x7, por ejemplo) nunca se precargan: se generan al elegir el puzzle.
- **Respuestas obsoletas**: cada petición lleva un `id` (`motor.pedir(...).id`); `st.gen` cambia en cada selección o "Nuevo scramble" y `st.sel` en cada selección. Una respuesta de otra generación no se muestra; si es un scramble, se guarda como precargado de su puzzle. Lo mismo con "Resolver" y con las tablas (el aviso solo se actualiza si sigue siendo el mismo puzzle).
- **Motor** (`motor.js`): dos Workers con el mismo código. Cada uno hace una tarea cada vez y la cola está en el hilo principal, ordenada por prioridad (alta = lo que pide el usuario, media = el siguiente del puzzle actual, baja = precargas). El **principal** hace lo que necesita las tablas del solver (inicializar, validar, resolver) y nunca recibe precargas. El **de fondo** hace los scrambles; una precarga solo se le envía si está libre y no espera nada más urgente, y si está ocupado con una precarga cuando el usuario pide un scramble, ese scramble va al principal si está libre. `subirPrioridad(id)` sube una precarga en cola cuando el usuario la necesita. Si un Worker falla, lo pendiente se rehace en el otro; si fallan los dos, en el hilo principal.

## Interfaz: Deshacer
`main.js` guarda el estado del editor antes de cada cambio (pintar, herramientas, acciones, *Resetear*, *Cargar scramble*; hasta 200) y *Deshacer* (o Ctrl+Z) lo recupera. No necesita nada de los puzzles salvo `clonar`.

## Tests

### Niveles (`scripts/tests.mjs`)
| Nivel | Qué ejecuta | Tiempo (2 núcleos) |
|---|---|---|
| `npm run test:humo` | `npm run tipos`, `humo.test.mjs`, `registro.test.mjs`, `diseno.test.mjs` y seis tests de `app.test.mjs` (sin Worker, con Worker, navegación, tema, enlaces antiguos y recorrido completo), con `--test-name-pattern` | ~3 min 15 s |
| `npm run test:rapido` | todos los ficheros con `NIVEL=rapido CASOS=100` | ~8 min 20 s |
| `npm test` | todos los ficheros con `CASOS=1000` (el comando de siempre) | ~1 h |
| `npm run test:solo -- <áreas>` | los ficheros de esas áreas y, en los compartidos, los tests que las nombran (nivel rápido) | según el área |

`tests/util.mjs` exporta `NIVEL` (`humo`, `rapido` o `completo`; por defecto, `completo` si `CASOS >= 1000`) y `casosPor(completo, rapido, variable)`: cada test caro pide así su número de casos, de modo que la suite completa usa exactamente los de siempre y las demás menos. Todo test con datos al azar usa `rngConSemilla` (semilla fija).

**Qué recorta el nivel rápido** (solo número de casos; ninguna comprobación desaparece): FTO (scrambles y solver 100 en vez de 1000, reparto 60 en vez de 300), solver de 4x4–7x7 (6/4/2/2 casos), Megaminx (5), vista previa Pochmann (30), Square-1 scrambles y solver (30), 3x3 (50), modo aprender en 4x4/5x5 (8) y Square-1 (40), cada configuración vendada (10), capas centrales del vendado (6), método de respaldo de los NxN (1 por tamaño) y "sin aristas libres" (solo 5x5). Además, en rápido los vendados de espacio pequeño se resuelven en el hilo principal, que ya tiene la tabla del BFS completo (en lugar de generarla otra vez en cada worker_thread). En `humo.test.mjs`, en rápido y completo, solo se ejecutan las huellas: el resto es un subconjunto de lo que comprueban los demás ficheros.

### Huellas de los giros (`tests/huellas.json`)
El solver, el scramble y la vista 3D de un puzzle salen del mismo modelo: si un giro se define al revés, todo sigue siendo coherente y los tests de "resuelve el 100 %" pasan. Lo detecta comparar el estado tras cada giro básico (y tras una secuencia fija) con el guardado. Se regeneran con `HUELLAS=actualizar npm run test:humo` cuando un cambio es intencionado.

### Tests en paralelo
`tests/paralelo.mjs` (`resolverEnParalelo`) reparte los casos de un test de solver entre worker_threads con una cola dinámica. El hilo principal genera los estados (con la misma semilla que antes) y comprueba cada solución; cada hilo (`tests/trabajador.mjs`) importa el módulo del puzzle, genera sus tablas y llama a `resolver`. Los ficheros de tests se ejecutan de uno en uno (`--test-concurrency=1`) para no tener más hilos que núcleos: varios solvers tienen límites de tiempo.

### Integración continua
`.github/workflows/tests.yml`: `npm run tipos` y `npm run test:rapido` en cada push a `main` y en los PR, independiente de `pages.yml` (a mano se elige el nivel; `tipos` se ejecuta en todos).

## Plan para las próximas noches
- Modo aprender en Megaminx (por capas) y 6x6/7x7 (reducción como el 5x5, más los centros oblicuos).
- Cubos vendados (noche 13): soluciones más cortas en el 4x4/5x5 (hoy cientos de giros); vendados con todas
  las piezas en bloques (simulaciones de cuboides: la geometría es casi el estado entero y el BFS de geometrías
  no cabe), tratando los bloques como piezas de un puzzle reducido; el 6x6 y el 7x7 (el código es genérico,
  falta medirlo y la interfaz).
- Todos los puzzles tienen ya validador y solver. Lo que más pesa ahora en el 6x6 y el 7x7 son los centros oblicuos (3-ciclos, ~120 y ~125 movimientos); ver ESTADO.md. Otras mejoras posibles: scramble de estado aleatorio en el 4x4 y, para el Megaminx, etapas más grandes o una búsqueda en haz entre etapas.
