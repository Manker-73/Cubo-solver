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
    square1.js      Square-1 (scramble con "/" legales + vista)
  app/            interfaz: plantilla.html, estilos.css, main.js
tests/            node --test (npm test)
scripts/build.mjs empaquetado con esbuild
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
| `renderizar(estado, {editable, editables})` | SVG (string); las pegatinas editables llevan `class="pegatina" data-i="i"` |

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
| `aplicarSecuencia`, `invertir` | se rellenan automáticamente |
| `tipoScramble`, `descripcion`, `avisoInicializacion` | textos para la interfaz |

## Cómo añadir un puzzle

1. Crear `src/puzzles/mipuzzle.js` que exporte `definirPuzzle({...})`.
2. Añadir una línea en `src/puzzles/index.js`.
3. Crear `tests/mipuzzle.test.mjs` usando `probarScrambles`, `probarSolver` y `debeRechazar` de `tests/util.mjs`.

La interfaz (`src/app/main.js`) solo usa la interfaz común: no hay que tocarla.

### Herramientas para puzzles nuevos
- **Puzzle de cortes planos** (Megaminx, FTO, Dino…): `crearGeoPuzzle({caras, cortes, giros, rotaciones, red})` da pegatinas, permutaciones de cada giro, rotaciones del puzzle entero y la red 2D.
- **Validador y solver**: `crearModeloPiezas({orbitas, movimientos, coloresResuelto})` identifica piezas por colores (detecta piezas inexistentes y especulares) y da coordenadas; `crearBuscador({coords, movs, ejes, podas, objetivo})` genera tablas de poda por BFS y resuelve con IDA*. Las tablas también sirven para decidir si una coordenada es alcanzable (validador).
- **Orientación libre al pintar**: `permutacionesDeColor(rotaciones, …)` + `reetiquetar`.

## Plan para las próximas noches
- **Square-1** (solver): estado = formas de las capas + permutación; búsqueda por formas (la "cubeshape") y luego permutación, o IDA* con tablas por forma. Ya existe el modelo con `/` legales (`square1.js`).
- **4x4+ por reducción**: centros → emparejar aristas → fase 3x3 con `kociemba.js` + paridades. El modelo de pegatinas NxN y la notación ya están.
- **Megaminx**: el motor geométrico ya genera las 132 pegatinas y los giros; falta validador y un solver por etapas.
