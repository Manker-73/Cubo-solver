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
    nxn.js          cubos NxN (modelo, notación, dibujo, scramble aleatorio)
    cubo-comun.js   piezas y mensajes compartidos por 2x2/3x3
    cubo2.js        2x2 (validador, IDA* óptimo, estado aleatorio)
    cubo3.js        3x3 (validador, Kociemba, estado aleatorio)
    kociemba.js     algoritmo de dos fases (cubies, coordenadas, tablas, búsqueda)
    pyraminx.js     Pyraminx
    skewb.js        Skewb
    megaminx.js     Megaminx (scramble Pochmann + vista)
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
| `herramientas`, `usarHerramienta(estado, id, indices)` | herramientas del editor `{id, nombre, icono, toques}` (1 o 2 toques); lanza un `Error` con un mensaje claro si no se puede |
| `herramientaInicial`, `indicesInmediatos` | herramienta elegida al empezar; índices que con una herramienta se aplican al momento (con `pintar`) |
| `accionesEditor`, `aplicarAccion(estado, id)` | botones extra del editor `{id, etiqueta, titulo}` (p. ej. girar una capa) |
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

## Plan para las próximas noches
- **4x4+ por reducción**: centros → emparejar aristas → fase 3x3 con `kociemba.js` + paridades. El modelo de pegatinas NxN y la notación ya están.
- **Megaminx**: el motor geométrico ya genera las 132 pegatinas y los giros; falta validador y un solver por etapas.
