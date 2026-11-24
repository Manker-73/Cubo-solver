# Estado del proyecto (noche 12 — FTO — 24/11/2026)

> Progreso de la noche 12 (FTO): modelo (geometría, notación WCA 12f, 16 giros, colores de TNoodle) ✔ · restricciones demostradas con Schreier–Sims + comprobación empírica ✔ · tamaño del grupo y posiciones (coincide con Wikipedia) ✔ · cota inferior por conteo (21) ✔ · validador con mensajes por restricción ✔ · editor 2D/3D con orientación libre ✔ · solver en tres fases (IDA* + tablas de poda) ✔ · scramble de estado aleatorio (4b3) ✔ · vista 3D animada y resaltado ✔ · test de campos del registro ✔ · huellas (solo las del FTO) y sabotaje ✔ · tests de la app ✔ · `test:humo` ✔ (43/43) · `test:rapido` ✔ (195/195) · FTO con 1000 casos ✔ (16/16, 1000/1000) · `npm test` completo lanzado en GitHub (ejecución manual 45297871921; pendiente de ver el resultado) · Action de `test:rapido` del último push ✔ · `npm run bench` con el FTO ✔ · Chromium real (4 modos) ✔ · documentación ✔ · push, Pages y Action ✔ · artifact republicado ✔ · modo aprender del FTO ✘ (pendiente).

## Noche 12: FTO (Face-Turning Octahedron)

Modalidad oficial de la WCA desde el 2 de enero de 2027 (media de 5). Ya es un puzzle más: chip normal en WCA Puzzles y ruta `#/wca/fto`. Decisiones y lo que no funcionó en DECISIONES.md; cómo está hecho en ARQUITECTURA.md («FTO (cómo está hecho)»).

### Resultados
| | Valor |
|---|---|
| Tamaño del grupo (pegatinas) | **158.260.810.061.489.362.698.240.000.000** = 6!/2·2⁵ · 12!/2 · (12!/2)² (Schreier–Sims; sin relaciones entre órbitas) |
| Posiciones distintas | **31.408.133.379.194.880.000.000** (|G| / (648² · 12)); la misma cifra que Wikipedia |
| Cota inferior por conteo | **21** giros (calculada aquí; métrica: cada giro de 120° = 1, que en el FTO es la OBTM) |
| Longitud media (1 s, por defecto en la app) | **27,0** giros (bench, 100 casos; máx. 30) |
| Longitud media (300 ms, tests) | **27,71** (1000 casos; máx. 32) |
| **Cociente media / cota inferior** | **1,29** (app) · 1,32 (tests) |
| Scrambles | 28,57 giros de media (1000; mín. 24, máx. 32), estado aleatorio |
| Tablas | 15,3 MB (la mayor, 11,3 MB); **2,0 s** en Chromium de escritorio, **8,5 s** con la CPU a ×4 |
| Una solución (Chromium) | ~1,0 s en escritorio y ~1,4 s con CPU ×4 (busca en las 12 orientaciones hasta 1 s) |
| Un scramble (Chromium) | ~0,1 s en escritorio y ~0,9 s con CPU ×4 (330 ms de media en Node con 1000 casos) |
| HTML (`dist/index.html`) | 703,7 KB → **737,5 KB** (+34,6 KB); gzip 288,6 → 300,7 KB (+12,1 KB) |

### Tests
- `tests/fto.test.mjs` (16 tests; área `fto` de `test:solo`): geometría, notación 12f (vecinas, opuestas, sentido horario), colores, piezas, restricciones con Schreier–Sims (órdenes, producto, 12 rotaciones, |⟨R, L, B, D⟩| = 933.120), 2000 giros al azar, cota 21, orientación libre, simplificación, tablas, `probarScrambles` (1000) con reparto de piezas, scramble exacto (lleva justo al estado elegido), `probarSolver` (**1000/1000**, reorientado al azar entre las 24 orientaciones, giro a giro) y `debeRechazar` para cada restricción: dos esquinas, dos aristas, media vuelta de una esquina, cuarto de vuelta, arista volteada, triángulo en la otra órbita, esquina especular, pieza inexistente, colores mal contados y pegatina sin pintar. Con 1000 casos tarda 18,6 min (casi todo scrambles y soluciones); en rápido, 100 casos (~2 min).
- `tests/registro.test.mjs`: cada campo de cada puzzle está en `DefinicionPuzzle`/`Puzzle` o en su lista de campos propios. Sabotaje: `avisoInicialisacion` en el FTO pasa `npm run tipos` y este test falla. Deshecho.
- Huellas: `HUELLAS=actualizar` solo añadió el bloque `fto` (diff revisado). Sabotaje: R del FTO con el ángulo al revés → `test:humo` falla solo en las huellas («FTO: el giro R no deja el estado de siempre»); todo lo demás pasa (por eso hacen falta las huellas). Deshecho.
- App: el chip del FTO es un botón normal, `#/wca/fto` lo abre (antes estaba bloqueado) y el recorrido completo de `test:humo` elige el FTO, genera scramble, carga, resuelve y reproduce hasta «Resuelto». El FTO está entre los de estado aleatorio en la prueba de etiquetas. Vista 3D: el FTO tiene 42 piezas (24 de 1 pegatina, 12 de 2, 6 de 4) y sus giros animados acaban en el estado del modelo.
- `test:humo` 43/43 (2 min 43 s) · `test:rapido` 195/195 (11 min 54 s, 2 núcleos) · `npm run bench` incluye el FTO.
- Chromium real (`scripts/comprobar-fto.py`; escritorio y móvil 390 px, oscuro y claro): portada (la tarjeta dice «… · FTO») → WCA Puzzles → FTO → scramble animado → cargar → resolver → solución en 3D hasta el final → pintar tocando el modelo 3D. 0 errores de consola, 0 px de scroll horizontal. Capturas en `docs/capturas/fto-*.jpg`.

### Pendiente / por verificar con un FTO físico
- **Colores** (los de TNoodle: U blanco, F verde, R rojo, L morado, B azul, D amarillo, BR gris, BL naranja) y **red 2D** (dos cuadrados: delante y, a la derecha, detrás visto desde atrás).
- **Sentido de los giros**: que R gire como dice 12f2 (horario mirando la cara R) y que las caras de detrás estén donde dice la app (B detrás de U, BR detrás de R, BL detrás de L, D detrás de F). Un scramble de la app aplicado a un FTO resuelto con blanco arriba y verde delante tiene que dejarlo como la vista previa.
- **Modo aprender**: no hay. El método de speedsolving más citado es **Bencisco** (Ben Streeter, 2018, según Wikipedia), pero no he comprobado que sea el más extendido ni sus etapas: queda para otra noche.
- Las tablas en un móvil lento tardan ~8,5 s (límite acordado: ~10 s). Si hiciera falta bajar, la tabla de 11,3 MB podría partirse en dos (aristas con paridades por un lado), a costa de búsquedas más lentas.
- El reglamento citado es el borrador de 2027 (rama `drafts2027`): revisar cuando se publique la versión oficial del 1 de enero de 2027.


> Progreso del paso 0 de TypeScript (tipos con JSDoc, sin renombrar ficheros): infraestructura (TypeScript 7, `tsconfig.json`, `npm run tipos`) ✔ · contratos en `src/core/tipos.d.ts` ✔ · `@ts-check` en `puzzle.js`, `piezas.js`, `modelo3d.js`, `bloqueos.js`, `guion.js`, `index.js`, `servicio.js` y `secciones.js` ✔ · y en los puzzles Skewb, Pyraminx y 2x2 ✔ · demás puzzles ✘ (paso 1) · `tipos` en `test:humo` y en la Action ✔ · bundle idéntico byte a byte ✔ · sabotajes ✔ · `test:humo` ✔ (39/39) · `test:rapido` ✔ (174/174) · `npm test` ✔ (completo en GitHub, ejecución 45266099655, 1 h 14 min) · documentación y plan del paso 1 ✔ · push y GitHub Pages ✔.

## Paso 0 de TypeScript: tipos con JSDoc

El código sigue siendo JavaScript; TypeScript solo comprueba (`npm run tipos`). Detalles en ARQUITECTURA.md («Tipos») y DECISIONES.md (decisiones, lo que no funcionó y el plan del paso 1).

- **Tipado**: la interfaz común de un puzzle (`DefinicionPuzzle<E>` / `Puzzle<E>`, con todos los campos de las dos tablas), `soporteBloqueos` y `PuzzleVendado`, el guion del modo aprender, la geometría 3D, secciones y registro, y los mensajes con el Worker. Ficheros comprobados: 11 (8 del núcleo y la app, y Skewb, Pyraminx y 2x2).
- **`npm run tipos`**: ≈ 0,3–0,5 s (TypeScript 7 nativo). Está en `test:humo` (primer paso) y como paso «Tipos» de la Action de tests, en todos los niveles.
- **0 `any` y 0 `@ts-ignore`**. Unos 100 casts JSDoc; los que afirman algo que el comprobador no ve llevan comentario (clases en DECISIONES.md).
- **Bugs reales**: ninguno. Sí cosas que la documentación no decía (`aprender` devuelve `{ ok: false, errores }` con un estado no válido) y una trampa latente (el envoltorio de bloqueos siempre define `vista3D`).
- **Bundle**: `dist/index.html` y `dist/artifact.html` idénticos byte a byte a los de antes de la sesión (sin republicar el artifact). Para lograrlo, esbuild ya no lee `tsconfig.json` (con `strict` añadía `"use strict"`).

Sabotajes (deshechos):
- Sin `estaResuelto` en el Skewb → `src/puzzles/skewb.js(233,30): error TS2345: … Property 'estaResuelto' is missing in type '{ … }' but required in type 'DefinicionPuzzle<any>'.`
- `fasses` en lugar de `fases` en el resultado de `resolver` (envoltorio de bloqueos) → `src/core/bloqueos.js(1301,7): error TS2561: Object literal may only specify known properties, but 'fasses' does not exist in type 'ResolverOk'. Did you mean to write 'fases'?` (lo mismo en el `resolver` del Skewb).

Tests: `test:humo` 39/39 (2 min 22 s, con los tipos); `test:rapido` 174/174 (9 min 37 s, 2 núcleos; también en la Action del último push, con el paso «Tipos»); `npm test` completo en GitHub ✔ (ejecución manual 45266099655).

> Progreso de la noche 11 (rediseño visual): navegación por hash y lista de secciones ✔ · enlaces antiguos (#bloqueos=, #firma=, ?bloqueos=, ?firma=) ✔ · portada (propuesta D) ✔ · WCA Puzzles con el estilo nuevo y «FTO · pronto» ✔ · Bandaged Cubes como página propia ✔ · tema oscuro por defecto con botón y persistencia ✔ · fuentes incrustadas sin red ✔ · accesibilidad (contraste, 44 px, foco, sin scroll horizontal a 390 px) ✔ · tests (humo, contraste, comprobar-diseno.py y los scripts de Chromium) ✔ · `test:rapido` ✔ (174/174, 12 min en local; también en la Action) · `npm test` ✔ (suite completa en GitHub, ejecución manual «completo» 45093708015) · documentación ✔ · push y GitHub Pages ✔ · artifact republicado ✔ · movimientos de la solución como botones ✘ (pendiente).

## Noche 11: rediseño visual

### Qué se ve distinto
- **Portada** (`#/`): cabecera con el logo (cuadrícula 3x3 en el color de acento), «Cómo funciona», GitHub y el botón de tema; el titular «Mezcla. Comprueba. Resuelve. Aprende.»; dos bloques grandes (WCA Puzzles en acento, Bandaged Cubes en acento suave con borde) y las secciones bloqueadas (Shape Mods, Cuboids, Others) rayadas con candado, más «Más en camino»; debajo, «Cómo funciona» en cuatro pasos.
- **WCA Puzzles** (`#/wca/<id>`): la misma herramienta (scramble, editor, resolver, 3D, modo aprender) con Inter / Bricolage Grotesque / JetBrains Mono, paneles de radio 18 px, botones y chips de 44 px, chip elegido y conmutadores 2D/3D en el acento, etiquetas en mono; el FTO como chip bloqueado «FTO · pronto».
- **Bandaged Cubes** (`#/bandaged`): «Tus bloques» arriba (todo lo de antes: crear y editar en 2D/3D, ejemplos, firmas, guardar, enlace, estrategia A/B, análisis) y, debajo, el scramble y el solucionador del 3x3 vendado. En WCA Puzzles el 3x3 ya no tiene bloques.
- **Tema oscuro por defecto** (aunque el sistema esté en claro); el botón cambia a claro y se recuerda.

Capturas antes (`docs/capturas/antes-{escritorio,movil}-{oscuro,claro}.jpg`; antes el tema seguía al sistema) y después (`docs/capturas/diseno-{escritorio,movil}-{oscuro,claro}-{portada,wca,bandaged}.jpg`).

### Tamaño del HTML
| | `dist/index.html` | gzip |
|---|---|---|
| Antes de la noche 11 | 605,7 KB | 223,9 KB |
| Después (fuentes incrustadas: 78,5 KB) | 703,7 KB | 289,8 KB |
| Después sin fuentes (pilas del sistema, para comparar) | 625,3 KB | 228,8 KB |

(La tarea decía «~345 KB»; medido sobre el último `dist/index.html` publicado antes de esta noche son 605,7 KB.) Decisión y números de las fuentes en DECISIONES.md.

### Tests
- **Nuevos** en `test:humo`: `tests/diseno.test.mjs` (rutas `leerRuta`/`hashDe` y **contraste ≥ 4,5:1** de cada par texto/fondo en los dos temas, leído del CSS; comprobado que falla con un gris más claro) y en `app.test.mjs`: navegación entre secciones (tarjetas, `#/wca/<id>`, chips, FTO bloqueado, «Inicio», bloqueadas no navegables ni por clic ni por URL, «Cómo funciona»), tema (oscuro con el sistema en claro, cambio, persistencia, sin almacenamiento), enlaces antiguos (`#bloqueos=`, `?firma=`, `?bloqueos=`, `#firma=` y el nuevo `#/bandaged?bloqueos=`; la URL pasa a la forma nueva y el 3x3 de WCA no tiene bloques) y recorrido completo (scramble → resolver → reproducir con ▶ hasta «Resuelto») en WCA y en Bandaged.
- **Cambiados** (sin quitar comprobaciones; detalle en DECISIONES.md): `abrir()` abre `#/wca` (la raíz es ahora la portada); las pruebas de bloqueos abren `#/bandaged` y comprueban que no hay selector en vez de pulsar el chip del 3x3; los scripts de Chromium usan `#/wca` o `#/bandaged`.
- `npm test` (completo): pasa en GitHub (Actions → *Tests (rápido)* → ejecución manual con nivel `completo`).
- `test:rapido`: 174/174 en 12 min en local (2 núcleos; antes 169 en 8 min 20 s) y pasa en la Action de cada push.
- `test:humo`: 39/39 (antes 33), 3 min 16 s en local (antes 2 min 35 s en esta máquina; ya no baja de 2 min por los cuatro tests nuevos de la app).
- Chromium real: `comprobar-diseno.py` (nuevo: 4 combinaciones × portada/WCA/Bandaged, toda la red bloqueada: 0 peticiones, las 3 fuentes cargadas, 0 errores, sin scroll horizontal, objetivos ≥ 44 px, foco visible, oscuro por defecto con el sistema en claro, el claro se conserva al recargar), `comprobar-bloqueos.py`, `comprobar-3d.py`, `comprobar-aprender.py`, `comprobar-cambios.py` y `comprobar-primer-resolver.py`: todo pasa. Una ejecución de `comprobar-diseno.py` (la primera tras un cambio, con los demás scripts esperando) agotó un tiempo de 90 s en una espera; las dos siguientes pasaron enteras. Desde entonces el script apunta en qué parte falla y guarda una captura.

### Pendiente
- Los movimientos de la solución (`#movs li`) y los pasos de la explicación del modo aprender siguen siendo elementos de lista con clic, no botones (se recorren igual con los botones del reproductor).
- En el artifact de claude.ai solo pasan a la URL los hash simples (`#nombre`), así que un enlace `#/wca/megaminx` abre en la portada; dentro del artifact la navegación funciona. En GitHub Pages y en local, los enlaces funcionan enteros.

> Progreso de la fase 0 (tests más rápidos, sin cambios en `src/`): diagnóstico ✔ · `test:humo` < 2 min ✔ · `test:rapido` ✔ (8 min 20 s; objetivo < 8 min ✘ por ~20 s: la app sola son ~3,6 min) · `npm test` sin cambios en lo que comprueba ✔ (completo lanzado en GitHub; en local solo los ficheros baratos) · `test:solo` ✔ · GitHub Action ✔ (pasa en GitHub) · sabotajes ✔ · caché de tablas en disco ✘ (descartada con números, ver DECISIONES.md) · documentación ✔ · push ✔ · GitHub Pages ✔.

> Progreso de la noche 10 (3x3 vendado): capa genérica de bloqueos ✔ · M/E/S y rotaciones ✔ · validación de la configuración (imposible, bloqueado, muy limitado, geometrías y estados) ✔ · scramble (uniforme o paseo al azar medido) ✔ · estrategias A y B con elección automática ✔ · firmas de la comunidad (importar/exportar) ✔ · interfaz (2D/3D, ejemplos, guardar, URL) ✔ · tests de 500 casos ✔ · Chromium real ✔ · documentación ✔ · push ✔ (hecho al reanudar la sesión; el workflow de GitHub Pages terminó bien) · artifact republicado ✔.

> Progreso de la noche 9: corrección del primer "Resolver" ✔ · 5x5 ✔ · Pyraminx ✔ · Skewb ✔ · Square-1 ✔ · números de las OLL ✔ · Megaminx ✘ · 6x6/7x7 ✘ · tests y Chromium ✔ · documentación ✔ · push, GitHub Pages (despliegue del último commit comprobado en la web: un clic en *Resolver* nada más cargar → "Generando tablas…" → solución) y artifact republicado ✔.

## Fase 0: tests más rápidos

**Antes de empezar cada noche: `npm run test:humo`** (~1 min 40 s). Mientras se trabaja: `npm run test:solo -- <áreas>`. Antes de subir: `npm run test:rapido` (también lo ejecuta la Action en cada push). La suite completa (`npm test`) se puede lanzar en GitHub: Actions → *Tests (rápido)* → *Run workflow* → nivel `completo`.

### Tiempos (2 núcleos, local)
| Nivel | Antes | Después | Tests |
|---|---|---|---|
| `test:humo` | — | 1 min 39 s | 33 (20 del humo de puzzles, 11 del registro, 2 de la app) |
| `test:rapido` | 18 min 24 s | 8 min 20 s | 169 (antes 168; +1: huellas) |
| `npm test` | ~1 h+ (no medido en esta sesión) | mismos casos y comprobaciones | +1 test (huellas) y una comprobación más en la app |

En GitHub (4 núcleos, más lentos): la primera versión de `test:rapido` tardó 13 min.

### `test:rapido` por fichero (segundos)
| Fichero | Antes | Después | Por qué tardaba |
|---|---|---|---|
| bloqueos | 367 | 86 | ~1,1 s por caso con límite de tiempo (A, B y comparación sin bloqueos); tabla BFS generada 3 veces en los espacios pequeños |
| app | 221 | 215 | tablas y solvers de cada puzzle en el hilo principal de jsdom, en cada test (no se puede recortar sin cambiar lo que se prueba) |
| cubo-grande (+ humo) | 207 | 83 | 6x6/7x7 ~3–5 s por caso; respaldo 12 resoluciones |
| aprender | 178 | 37 | 4x4 ~1,2 s por caso (reducción completa), 100 casos × 2 métodos |
| square1 | 50 | 17 | scramble de estado aleatorio = búsqueda; solver ~0,3 s |
| megaminx (+ Pochmann) | 53 | 27 | ~2,6 s por caso |
| resto | 27 | 33 | (skewb: el BFS de 3.149.280 estados, 6–13 s según la memoria) |

### Sabotajes (deshechos; `src/` y `dist/` idénticos a lo publicado)
| Sabotaje | `test:humo` | Nivel rápido | Antes de esta sesión |
|---|---|---|---|
| R del Skewb invertido | ✔ (solo las huellas) | ✔ (solo las huellas; los 5 tests del Skewb y el modo aprender pasan) | **no lo detectaba ningún nivel** |
| Modo aprender: se pierden las etapas de un movimiento (`guion.js`) | ✔ (6 de 7 puzzles) | ✔ (`test:solo aprender`: 10 de 11 métodos; el Skewb no tiene etapas de un movimiento) | lo detectaba `aprender.test.mjs` |
| App: la solución pierde su último giro (`main.js`) | ✔ (los dos tests de la app) | ✔ (mismos tests) | **no lo detectaba** (la prueba de humo solo miraba el texto «Resuelto») |

### Test inestable arreglado
«app: modo aprender» dependía del azar sin semilla (scrambles de `crypto.getRandomValues`) y falló una vez en GitHub (168/169). Ahora jsdom usa una semilla fija (ver DECISIONES.md).

### Pendiente
- Los tests de la app con Workers reales siguen usando scrambles al azar (crypto de Node): no se ha visto que fallen, pero no son reproducibles caso a caso.
- `test:rapido` está ~20 s por encima del objetivo de 8 min; el suelo es la app (~3,6 min). Bajarlo más exigiría acelerar la generación de tablas de la app (cambio en `src/`) o compartir una ventana de jsdom entre tests (cambia lo que se prueba).
- Resultado de `npm test` completo: ver la ejecución manual en Actions (lanzada al terminar la sesión).

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

**3x3 vendado** (sección *Bloqueos*): bloques definidos por el usuario; scramble de estado aleatorio uniforme (espacios ≤ 2 millones de estados) o de giros legales al azar; solución óptima por BFS o la más corta de dos estrategias (búsqueda directa / geometría y luego permutación).

Ya no queda ningún puzzle sin validador ni solver. **Modo aprender** (solución por un método humano, explicada por etapas): 2x2, 3x3, 4x4, **5x5, Pyraminx, Skewb y Square-1** (falta Megaminx, 6x6 y 7x7).

## Noche 10: 3x3 vendado (bloqueos definidos por el usuario)

### Qué hay
- `src/core/bloqueos.js`: capa **genérica** `puzzleConBloqueos(puzzle, bloques)` sobre la interfaz común (el puzzle aporta un `soporteBloqueos`: piezas, giros y capas). Legalidad con una sola regla, geometrías por BFS, grupo de la fase 2 por Schreier–Sims, número exacto de estados alcanzables, BFS completo de los espacios pequeños, scramble, estrategias A y B. Probada también con el 2x2. Detalles en ARQUITECTURA.md ("Bloqueos") y decisiones en DECISIONES.md ("Noche 10").
- 3x3: giros de cara, M, E, S y x, y, z; núcleo como pieza (para las firmas); Kociemba con filtro de legalidad como búsqueda directa; comparación con la solución sin bloqueos (óptima si da tiempo, si no Kociemba).
- Formato de la comunidad: firma hexadecimal de 54 uniones (Bandaged Cube Explorer), importar y exportar. Orden de las uniones comprobado con cifras publicadas: CAB Cube 15.704 formas y 10 permutaciones, Bandaged Cube de Meffert 32 formas y 58.320 permutaciones (exactos).
- Centros opuestos permitidos (decidido después de la noche, a petición de Óscar): el Bandaged Cube de Meffert (1680008C2FB461) ya se puede cargar.
- Interfaz: sección *Bloqueos* (crear, editar y borrar bloques tocando piezas en 2D o 3D, cada uno con su color; errores al momento; ejemplos; guardar en el navegador; enlace `#bloqueos=…` o `?firma=…`; elegir estrategia A, B o la más corta), análisis (giros posibles, geometrías, estados, tiempo de las tablas), piezas pegadas dibujadas unidas en 3D y en 2D, resumen de la solución (estrategia, fases, comparación sin bloqueos) y fases *Geometría* / *Permutación* en la reproducción.

### Resultados (`tests/bloqueos.test.mjs`, 500 scrambles y soluciones por configuración)
Cada scramble y cada solución se aplican giro a giro comprobando que el giro es legal en ese momento y que todos los bloques siguen enteros; estado final resuelto en el 100 % de los casos. Además, en cada caso, la solución de la estrategia B (gane o no): su fase 1 acaba en la geometría resuelta y su fase 2 acaba resuelta (y cada tramo que indica el solver acaba en la geometría resuelta). Límite de tiempo en el test: 700 ms (en la app, 2,5 s); el tiempo de la "elegida" incluye la comparación sin bloqueos (~0,4 s). 2 hilos en 2 núcleos. Longitudes en giros de cara (HTM).

| Configuración | Geometrías | Estados | Espacio | Tablas | Scramble (giros) | Resueltos | A: long. / ms | B: long. (fase 1 + fase 2) / ms | Elegida: long. / ms medio / ms máx. | Gana A / B | Sin bloqueos |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Sin bloqueos | 1 | 43.252.003.274.489.856.000 | grande | 38 ms | 20,73 | 500/500 (100 %) | — | — | 19,81 / 45 / 702 | (3x3 normal) | — |
| Una pareja (UFR+UF) | 24 | 1.802.166.803.103.744.000 | grande | 965 ms | 45,85 | 500/500 (100 %) | 20,27 / 398 | 22,02 (1,92 + 20,1) / 323 | 20,24 / 1.123 / 1.695 | 491 / 9 | 19,89 (0 óptimas) |
| Un bloque 1x2x2 | 4 | 13.652.778.811.392.000 | grande | 1.058 ms | 33,46 | 500/500 (100 %) | 19,78 / 397 | 20,89 (0,75 + 20,14) / 296 | 19,76 / 1.096 / 1.864 | 487 / 13 | 19,46 (0 óptimas) |
| Varios bloques (pareja, barra 1x1x3, centro+arista) | 1.440 | 108.355.387.392.000 | grande | 1.210 ms | 39,15 | 500/500 (100 %) | 24,14 / 396 | 29,24 (5,17 + 24,07) / 328 | 24,13 / 1.125 / 1.550 | 475 / 25 | 19,32 (0 óptimas) |
| Casi bloqueada (2x2x2 + centros D y L unidos: solo gira B) | 1 | 4 | pequeño | 10 ms | 1 | 500/500 (100 %) | 1 / 0 | 1 (0 + 1) / 0 | 1 / 3 / 953 | 500 / 0 | 1 (500 óptimas) |
| Bicube (E0400B43FC5A1) | 121 | 7.260 | pequeño | 32 ms | 18,29 | 500/500 (100 %) | 18,29 / 0 | 20,26 (3,93 + 16,33) / 1 | 18,29 / 223 / 1.048 | 500 / 0 | 11,93 (249 óptimas) |
| CAB Cube 5-5 (22006F100000C6) | 15.704 | 157.040 | pequeño | 1.011 ms | 33,77 | 500/500 (100 %) | 33,77 / 0 | 54,11 (23,77 + 30,34) / 3 | 33,77 / 382 / 1.110 | 500 / 0 | 16,47 (33 óptimas) |
| Bandaged Cube de Meffert (1680008C2FB461, centros opuestos) | 32 | 1.866.240 | pequeño | 8.278 ms | 22,22 | 500/500 (100 %) | 22,22 / 0 | 24,76 (2,88 + 21,88) / 1 | 22,22 / 397 / 1.357 | 500 / 0 | 15,05 (14 óptimas) |
| Bandaged Cube de twistypuzzles (33EC01800846) | 440 | 1.108.800 | pequeño | 4.475 ms | 18,53 | 500/500 (100 %) | 18,53 / 0 | 21,33 (5,59 + 15,74) / 1 | 18,53 / 348 / 1.234 | 500 / 0 | 15,21 (77 óptimas) |
| Most signatures (10840080200C21) | 184.352 | 955.680.768 (aprox.) | grande | 3.620 ms | 74,34 | 500/500 (100 %) | 22,38 / 385 | 30,07 (12,07 + 18) / 354 | 22,63 / 1.128 / 21.390 | 488 / 12 | 17,21 (6 óptimas) |


- **Cuándo gana cada estrategia**: en los espacios pequeños, siempre la A (es la óptima por BFS); la B es 2–20 giros más larga (en el CAB, +20: su fase 1 sola ya son ~24). En los grandes, la A (Kociemba con legalidad) gana en ~95–98 % de los casos y la B en el resto (25 de 500 con varios bloques, 13 con el 1x2x2, 12 en el *Most signatures*, 9 con la pareja), cuando su fase 1 deja un estado que Kociemba resuelve más corto. Lo esperado era que la B ganase en los vendados complejos; con estos datos no es así, porque una búsqueda directa que respeta la legalidad no tiene que pagar la fase 1 por separado. Detalles en DECISIONES.md.
- Unidad: firmas conocidas (CAB, Bicube, Equator, *Most signatures* = 2 · 92.176 geometrías), BFS = |geometrías| · |grupo de la fase 2|, configuraciones imposibles (no vecinas, pieza repetida o inexistente) y totalmente bloqueadas, giros ilegales con mensaje, bloques rotos e inalcanzables en el validador, capas centrales y rotaciones (20 secuencias de 40 giros legales cualesquiera), sin bloqueos = 3x3 normal (mismo scramble y misma solución), 2x2 vendado con la misma capa.
- Mezcla de los scrambles de giros al azar: medida con `scripts/mezcla-bloqueos.mjs` (tabla en DECISIONES.md); pasos = max(80, 4·d²) con d el diámetro de las geometrías.

### Prueba de humo y Chromium
- `tests/app.test.mjs`: tres pruebas nuevas (sin Worker, con los Workers reales y por URL): crear un bloque tocando piezas, error de un bloque imposible, aplicar, análisis, scramble legal, resolver, comprobar la solución en Node, reproducir hasta el final, estrategia B forzada con sus fases, ejemplos, firmas (imposible y válida), guardar y quitar.
- `scripts/comprobar-bloqueos.py` (Chromium real, escritorio 1280 px claro y móvil 390 px oscuro táctil, con 3D y sin 3D): todo lo anterior también tocando el modelo 3D; pegatinas unidas en 3D (4 en la pareja, 8 en el 1x2x2, 36 en el CAB); sin errores en consola ni scroll horizontal. Capturas en `docs/capturas/bloqueos-*.jpg`.

### Pendiente / para decidir
- Un 4x4 vendado necesitaría seguir la identidad de las piezas iguales en el estado.

## Noche 9

### 1. Corrección: el primer "Resolver" tras cargar la página
- **Causa** (reproducida en Chromium real, caché vacía): el puzzle inicial se elegía cuando los dos Workers respondían al ping (~1 s en escritorio, ~1,6 s con la CPU a ×4). En ese tiempo los botones ya estaban activos y el clic en *Resolver* llegaba con `st.p = null`: un `TypeError` dentro de una promesa y nada en pantalla. El segundo clic sí funcionaba. Detalles en DECISIONES.md.
- **Ahora**: el puzzle inicial se elige al momento (las peticiones esperan en la cola del motor), los botones empiezan desactivados en el HTML hasta que hay puzzle, y *Resolver* nunca ignora un clic: si las tablas se están generando muestra **"Generando tablas… X s · la solución aparecerá al terminar."** y la solución aparece sola.
- **Tests**: dos nuevos en la prueba de humo (Worker simulado con ping de 1,5 s y tablas de 1,2 s): un clic nada más cargar, y un clic con un scramble cargado mientras se generan las tablas. Los dos **fallan con el código antiguo** (el segundo con el mismo `TypeError`) y pasan con el nuevo.
- **Chromium real** (`scripts/comprobar-primer-resolver.py`; contexto nuevo con la caché desactivada; escritorio y móvil con la CPU a ×4): un solo clic en cuanto el botón está activo, en el 3x3 resuelto, el 3x3 con scramble y el 5x5 con scramble (tablas de ~9 s): los 6 casos responden sin otro clic, con "Generando tablas… X s" mientras tanto y sin errores en consola (`docs/capturas/primer-resolver.json`).

### 2. Modo aprender en más puzzles
| Puzzle | Método | Etapas |
|---|---|---|
| **5x5** | Reducción (3x3 por capas o CFOP) | Centro blanco: X · Centro blanco: cruz · Centro amarillo: X · Centro amarillo: cruz · Últimos cuatro centros: X · Últimos cuatro centros: cruz · Aristas (tredges, con la **paridad de aristas** del 5x5 cuando aparece) · las del 3x3 elegido |
| **Pyraminx** | Principiantes | Puntas · Centros · Primera capa (3 aristas) · Última capa (ciclo de tres aristas, voltear dos aristas) |
| **Skewb** | Principiantes | Primera capa (arriba: la de la esquina que no se mueve) · Esquinas de abajo (sledgehammers) · Centros |
| **Square-1** | Principiantes | Forma de cubo · Orientar esquinas · Orientar aristas · Permutar esquinas (y capa del medio) · Paridad (si hace falta) · Permutar aristas |

Resultados (`tests/aprender.test.mjs` con `CASOS=500`; cada solución se aplica movimiento a movimiento y **tras cada etapa se comprueba su objetivo** con comprobaciones del test, independientes del método; estados al azar y el puzzle girado entero al azar):

| Puzzle / método | Resueltos | Giros (media / máx.) | Rotaciones (media) | Tiempo medio |
|---|---|---|---|---|
| 5x5 reducción + capas | **500/500** | 424,5 / 494 | 31,5 | 0,36 s |
| 5x5 reducción + CFOP | **500/500** | 336,5 / 394 | 28,9 | 0,43 s |
| Pyraminx principiantes | **500/500** | 26,4 / 37 | — | 8 ms |
| Skewb principiantes | **500/500** | 22,0 / 29 | — | 11 ms |
| Square-1 principiantes | **500/500** | 60,4 / 85 (WCA: cada (x,y) y cada "/" = 1) | — | 0,11 s |
| 4x4, 3x3, 2x2 (de nuevo) | **500/500** en los seis métodos | como en la noche 8 | | |

Por etapa (media): 5x5 (CFOP): centros 4,1 + 16,5 + 7,6 + 25,0 + 12,3 + 45,6 · aristas 192 (con las rotaciones para tener delante cada arista) · el resto como el 3x3. Pyraminx: puntas 2,7 · centros 2,0 · primera capa 9,9 · última capa 11,7. Skewb: primera capa 7,6 · esquinas 5,5 · centros 8,9. Square-1: forma de cubo 9,0 · orientar esquinas 3,9 · orientar aristas 8,5 · permutar esquinas 10,1 · paridad 27 movimientos cuando aparece (~la mitad de las veces) · permutar aristas 15,4.

- **5x5**: con la X de un centro hecha, las piezas en cruz opuestas solo se mueven juntas con giros de caras y capas del medio; por eso la cruz usa conmutadores de una capa interior y una del medio (`Uw U' 3Rw Rw' 3Rw Rw' U Uw' Rw 3Rw' Rw 3Rw'`). Los dos primeros centros se hacen con una búsqueda exacta y se explican pieza a pieza; los cuatro últimos, en dos pasos (separar colores por parejas de caras y cada uno a su cara), como el 4x4. Las aristas, trabajando en la de la izquierda hasta completarla, con la pieza que falta a la derecha y `Uw' R U R' F R' F' R Uw`. Lo más largo son las aristas (~165 giros + rotaciones).
- **Skewb**: el orden es el de los métodos de principiantes habituales (capa → esquinas → centros), no "centros antes que esquinas" como decía la tarea: los algoritmos de centros que no mueven esquinas son los que se enseñan; lo contrario necesita algoritmos de esquinas que respeten los centros. Y la primera capa es la de arriba porque con la notación WCA la esquina de arriba delante a la derecha no se mueve nunca (DECISIONES.md).
- **Square-1**: el algoritmo de paridad (14 barras) lo calcula el solver al iniciar y está comprobado; no es uno de los de memoria de la comunidad. Su estado no es una lista de pegatinas, así que no se resaltan piezas.
- **Megaminx, 6x6 y 7x7: no hechos** (el selector no aparece). Prioricé dejar bien los otros cuatro; el porqué, en DECISIONES.md.
- Fallo corregido de paso: en `datosNxN` las dos caras de algunas aristas iban en orden contrario (en el 4x4 no se notaba; en el 5x5, sí).

### 3. Números de las OLL
- Las **57** OLL llevan ahora su número (antes solo 21–27 y 45), comprobado contra **dos referencias** de la comunidad en `tests/oll-numeros.test.mjs`: el caso de cada referencia se calcula sobre el cubo (aplicando su inversa al resuelto), las dos referencias coinciden en los 57 números y son 57 casos distintos, y cada algoritmo de la app resuelve el caso de su número.
- Al comparar salieron dos errores de una de las fuentes (su "OLL 20" es la 28; llama 26 a la Sune) y uno nuestro: la variante de OLL 20 que se descartaba al cargar no era una OLL. Corregida (`r U R' U' M2 U R U' R' U' M'`): pasan las 61 y los 216 casos de orientación se resuelven con **un solo** algoritmo (el test ya no admite dos).

### Comprobaciones
- Prueba de humo (jsdom, en 2D): modo aprender en 3x3 (×2), 2x2 (×2), 4x4, **5x5, Pyraminx, Skewb y Square-1**: selector, explicación, longitud frente a la óptima, piezas resaltadas (salvo Square-1), algoritmos con nombre, hasta "Resuelto" con el puzzle resuelto; el 6x6 no muestra el selector.
- `npm run test:rapido`: **146/146** (16 min); antes de empezar, 137/137. `tests/aprender.test.mjs` con `CASOS=500`: 13/13 (incluidos los seis métodos de 2x2, 3x3 y 4x4 otra vez, porque cambió código compartido del 4x4).
- Chromium real (`scripts/comprobar-aprender.py`, escritorio 1280×900 y móvil 390×844, WebGL por SwiftShader): los 9 casos (3x3 ×2, 2x2 ×2, 4x4, 5x5, Pyraminx, Skewb, Square-1) llegan a "Resuelto" paso a paso y a ×8, sin scroll horizontal ni errores de consola; piezas resaltadas en 3D en todos los pasos salvo los de girar el cubo entero (y en ninguno del Square-1, que no resalta). Capturas en `docs/capturas/aprender-*.jpg`.

## Noche 8: modo aprender

Además de la solución por ordenador, una solución por un **método humano**, explicada paso a paso para aprender a resolver el puzzle. Selector **Solución** encima de *Resolver*: *Solución óptima (por ordenador)* o *Aprender (método …)*.

### Qué hay
| Puzzle | Métodos | Etapas |
|---|---|---|
| **3x3** | Principiantes (por capas) | Cruz · Primera capa (R U R' U' repetido) · Segunda capa (algoritmos de la derecha y la izquierda) · Cruz amarilla (F R U R' U' F') · Cara amarilla (Sune) · Esquinas amarillas (A-perm) · Aristas amarillas (U-perm) |
| | CFOP | Cruz (planificada entera) · F2L (4 parejas) · OLL (un algoritmo) · PLL (un algoritmo) |
| **2x2** | Principiantes (por capas) | Preparación (esquina de referencia) · Primera capa · Cara amarilla (Sune) · Esquinas amarillas (T-perm) |
| | Ortega | Cara · OLL (7 casos) · PBL |
| **4x4** | Reducción (3x3 por capas) y Reducción (3x3 con CFOP) | Centro blanco · Centro amarillo · Últimos cuatro centros · Aristas · las del 3x3 elegido, con **Paridad OLL** y **Paridad PLL** cuando aparecen |

- Cada etapa tiene nombre y una explicación de su objetivo; cada bloque de movimientos dice qué consigue ("Lleva la arista blanca y roja abajo…", "Pareja 2: junta la esquina blanca, roja y verde con la arista roja y verde…", "Añade otra pieza amarilla al centro de arriba (3/4) con el conmutador Fw U Fw'…") y el nombre del algoritmo cuando es uno conocido (Sexy move, Sune, PLL T-perm, OLL 27 (Sune), Paridad OLL…). Tocar un paso de la lista salta a su final.
- **Piezas resaltadas** en cada paso, en 3D (las demás atenuadas) y en 2D.
- **Longitud total** frente a la óptima, p. ej. "Método CFOP: 56 giros (+ 5 giros del cubo entero) · solución óptima: 20 giros".
- Rotaciones del cubo entero (`x`, `y`, `z`) en los NxN: el método sujeta el cubo con el blanco abajo y gira el cubo para trabajar delante a la derecha, como una persona; se animan en 3D y no cuentan como giros.
- Textos en español; F2L, OLL, PLL, T-perm, Sune… en inglés. Algoritmos estándar escritos a mano y comprobados al cargar; los casos se describen a partir del estado (no de una tabla), así que no pueden contradecir lo que se ve.
- **No hecho**: 5x5 (los centros con dos órbitas no salen con el método de pieza en pieza del 4x4; ver DECISIONES.md), Pyraminx, Skewb, Square-1 y Megaminx. En esos puzzles el selector no aparece.

### Resultados (`tests/aprender.test.mjs`, 500 casos por método, estado al azar y cubo en cualquier orientación)
Cada solución se aplica movimiento a movimiento con el modelo de pegatinas; **tras cada etapa se comprueba su objetivo** (cruz hecha, primera capa, dos capas, cruz/cara amarilla, esquinas en su sitio salvo un giro de U, centros, aristas emparejadas, paridades arregladas…), y que etapas y bloques sean contiguos, cubran la solución y tengan texto.

| Puzzle / método | Resueltos | Giros (media / máx.) | Rotaciones (media) | Óptima (ref.) | Tiempo medio |
|---|---|---|---|---|---|
| 3x3 principiantes | **500/500** | 145,4 / 208 | 7,4 | ~20 | 2 ms |
| 3x3 CFOP | **500/500** | 56,0 / 70 | 4,6 | ~20 | 20 ms |
| 2x2 principiantes | **500/500** | 69,9 / 115 | 3,0 | ~9 | 1 ms |
| 2x2 Ortega | **500/500** | 23,0 / 32 | 0,1 | ~9 | 11 ms |
| 4x4 reducción + capas | **500/500** | 269,9 / 329 | 7,6 | ~55 | 1,4 s |
| 4x4 reducción + CFOP | **500/500** | 182,6 / 215 | 5,0 | ~55 | 1,5 s |

Por etapa (media de giros): 3x3 CFOP: cruz 5,8 · F2L 28,4 · OLL 10,6 · PLL 15,0. 3x3 principiantes: cruz 8,5 · primera capa 53,2 · segunda capa 38,7 · cruz amarilla 10,3 · cara amarilla 17,3 · esquinas 9,3 · aristas 14,6. 4x4 (CFOP): centros 5,7 + 10,5 + 12,3 · aristas 84,1 · paridad OLL 9,9 (18 giros, la mitad de las veces) · paridad PLL 4,5 (9 giros, la mitad de las veces) · el resto como el 3x3.

Además:
- Las 21 PLL respetan las dos capas y son de su familia; 60 de las 61 OLL escritas pasan la comprobación (la que no, se descarta). Resuelven en un solo algoritmo los **216** casos de orientación y los **288** de permutación de la última capa.
- Un cubo ya resuelto no da ningún giro.
- Prueba de humo (jsdom, sin WebGL, en 2D): 3x3 por los dos métodos, 2x2 por los dos y 4x4 con CFOP: selector, explicación, resumen con la longitud óptima, piezas resaltadas en la mayoría de los pasos, nombres de algoritmos, saltar a un paso, hasta "Resuelto" con el cubo resuelto; volver a la solución óptima quita la explicación; el Skewb no muestra el selector.
- **Chromium real** (`scripts/comprobar-aprender.py`, escritorio 1280 px y móvil 390 px): los cinco casos anteriores en 3D, paso a paso (en cada paso, la explicación del bloque actual y piezas resaltadas en la vista 3D en todos menos el último), entera a ×8 y en 2D; sin errores en consola ni scroll horizontal. Capturas en `docs/capturas/aprender-*.jpg`.
- `npm run test:rapido`: 137 tests, 137 pasan (~17 min con 2 núcleos; el modo aprender con 100 casos por método). Los tests anteriores siguen pasando.

### Ideas / pendiente
- (Noche 9: hechos 5x5, Pyraminx, Skewb y Square-1.) Faltan Megaminx y 6x6/7x7.
- 4x4: las aristas (~84 giros) son lo más largo; con el método "3-2-3" o eligiendo mejor qué arista emparejar se podrían acortar.
- Elegir el color de la cruz (ahora siempre blanca) y mostrar el "caso" de F2L con su dibujo.

## Corrección (noche 7): cambio de puzzle y scrambles precargados

- **Fallo corregido**: al cambiar de puzzle, el panel del scramble seguía mostrando el anterior hasta que el Worker acababa (el scramble esperaba a las tablas del solver: hasta ~8 s en el 7x7), y los clics en otro puzzle se ignoraban mientras había algo en marcha. Ahora **los dos paneles cambian a la vez y al momento**. Si no hay scramble listo, se ve el puzzle nuevo resuelto (en 2D o 3D) con "Generando scramble…", y copiar, cargar y el reproductor desactivados.
- **Scrambles precargados**: uno listo por puzzle. Al mostrar uno se pide el siguiente; los demás se precargan con prioridad baja, de más rápido a más lento, y solo con el Worker de fondo libre. **Dos Workers**: el principal (tablas del solver, validar, resolver) nunca recibe precargas, y lo que pide el usuario va siempre primero. En el móvil no se precargan los scrambles pesados (Square-1, 3x3) hasta elegir ese puzzle. Las tablas del solver (las grandes del 6x6/7x7) nunca se precargan.
- **Respuestas obsoletas**: cada petición lleva un id; una respuesta de un puzzle que ya no está elegido no se muestra (un scramble se guarda como precargado de su puzzle). Igual con "Resolver" y con el aviso de tablas.
- **Textos**: descripciones del panel "Resolver" al día (4x4 en tres fases sin paridades, 5x5–7x7 con centros por búsqueda y aristas con macros, Square-1 en dos fases, Megaminx ~90 giros) y avisos de tablas nuevos (ya no "Preparando los conmutadores").
- **Tests** (`npm run test:rapido`: 128 tests, 128 pasan, ~9,5 min). Nuevos, en la prueba de humo:
  - Cambios rápidos (Pyraminx → 7x7 → Skewb → Megaminx y otra secuencia de 5) sin Worker y con los Workers reales. Tras cada cambio del DOM y cada 5 ms, los dos paneles son del puzzle elegido y llevan su etiqueta, y el scramble final es de ese puzzle.
  - Una respuesta tardía del Pyraminx (Worker simulado que tarda 1,2 s) no cambia la vista del Skewb; al volver al Pyraminx, sale al momento.
  - Etiqueta del tipo de scramble en los 10 puzzles.
  - Scramble precargado: el cambio lo muestra al momento.
- **Chromium real** (`scripts/comprobar-cambios.py`, escritorio 1280 px y móvil 390 px):
  - 3 vueltas a 10 puzzles cambiando cada ~120 ms, con 4 comprobaciones tras cada clic: 0 fallos y sin errores en consola.
  - En la 3.ª vuelta, el scramble de los 10 puzzles estaba precargado y salió al momento.
  - Capturas en `docs/capturas/cambios-escritorio.jpg` y `cambios-movil.jpg`.
- Nota: la tarea habla de 11 puzzles; la app tiene 10 (2x2–7x7, Pyraminx, Skewb, Square-1, Megaminx), y los tests recorren todos los que hay en el registro.

## Noche 7: vista 3D

### Qué hay
- **Vista 3D de los 10 puzzles** (2x2–7x7, Pyraminx, Skewb, Square-1, Megaminx) que se gira arrastrando con el ratón o el dedo (*Vista inicial* la devuelve a su sitio).
- **Vista previa del scramble en 3D** (por defecto) con su propio reproductor: ⇤ resuelto, ‹ ›, ▶/❚❚, ⇥ y velocidad ×1…×8; empieza con el scramble aplicado. En el Megaminx, los movimientos Pochmann se animan tal cual y al final el puzzle gira entero hasta la orientación de referencia (la de la imagen y la nota).
- **Solución en 3D con giros animados**: velocidad ×1…×8, pausa, paso atrás animado, saltos a cualquier movimiento o al final de una fase. En el Megaminx, las letras de las caras sobre sus centros (como en 2D).
- **Botones 2D / 3D** en la vista previa y en el editor. El editor sigue en la red 2D para pintar; al resolver pasa a 3D. Con el editor en 3D **se puede pintar tocando el modelo** (también rellenar cara, mover piezas del Square-1 con la primera pieza resaltada y voltear la capa del medio).
- **Resaltar piezas** (`resaltarPiezas`, modos brillo y transparencia) para el modo aprender.
- Interfaz común: `vista3D(estado)` y `giro3D(estado, mov)` (+ `reorientar3D` en el Megaminx). La vista no sabe de ningún puzzle; ver ARQUITECTURA.md, "Vista 3D".
- **Sin librerías**: WebGL 1 propio (~23 KB; la app pasa de 320 a 345 KB, sigue siendo un único HTML). Sin conexión funciona igual (comprobado con Chromium sin red). **Sin WebGL**, todo en 2D con un aviso (comprobado en Chromium con WebGL desactivado y en jsdom).

### Tests (`npm run test:rapido`: 124 tests, 124 pasan, ~9 min)
- `tests/vista3d.test.mjs` (26 tests, sin navegador):
  - **Cada giro animado acaba exactamente en el estado del modelo**: para todos los movimientos de cada puzzle (NxN: todas las caras, capas anchas y sentidos; Pyraminx con puntas; Skewb; Megaminx: giros de cara y Pochmann) desde estados al azar, y en el Square-1 cientos de `(x,y)` y `/` desde formas de todo tipo. Se giran las pegatinas su ángulo completo y se compara color por posición (centro 3D) con `vista3D` del estado siguiente. Si se cambia a propósito el sentido de un giro o se quita una pegatina, falla.
  - **Reproducción completa** con el reproductor real de la app y la escena real (la misma que dibuja WebGL): scramble y solución en los 10 puzzles, adelante hasta el final y 12 pasos atrás; al empezar y al acabar cada animación lo que se ve es el estado del modelo (incluida la reorientación final del Megaminx).
  - Orientación de referencia (blanco arriba, verde delante; Square-1 azul delante y corte según 12c1; Pyraminx verde delante y amarillo abajo; Megaminx con los 12 colores verificados en sus caras), número de piezas para resaltar, y elegir pegatina por rayo (también con una capa a medio girar).
- Prueba de humo: nueva prueba sin WebGL (todo en 2D, reproductor del scramble paso a paso y con play). Las anteriores siguen pasando.

### Comprobado en Chromium real (`scripts/comprobar-3d.py`)
Escritorio 1280 px y móvil 390 px (pantalla ×3, táctil), tema claro y oscuro, los 10 puzzles: scramble animado, cargar, resolver, solución animada hasta el final a ×8, paso atrás y adelante, pieza resaltada, pintar tocando el modelo. Sin errores en consola ni scroll horizontal. Capturas en `docs/capturas/` (una hoja por configuración: scramble a medio girar, solución a medio girar, pieza resaltada; y la página).

FPS de las animaciones (aquí Chrome dibuja WebGL **por software**, SwiftShader con 2 núcleos y sin GPU: peor que un móvil real; 60 es el máximo del navegador):

| Configuración | Puzzle | Movs. solución | Solución a ×8 | FPS medios scramble / solución | Fotograma más lento |
|---|---|---|---|---|---|
| escritorio claro | 2x2 | 8 | 0,6 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | 3x3 | 20 | 1,4 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | 4x4 | 53 | 3,7 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | 5x5 | 104 | 7,2 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | 6x6 | 236 | 18,7 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | 7x7 | 416 | 35,2 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | Pyraminx | 11 | 0,8 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | Skewb | 9 | 0,6 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | Square-1 | 23 | 1,6 s | 60,0 / 60,0 | 17 ms |
| escritorio claro | Megaminx | 87 | 6,2 s | 60,0 / 60,0 | 17 ms |
| movil oscuro | 2x2 | 9 | 0,6 s | 60,0 / 60,0 | 17 ms |
| movil oscuro | 3x3 | 20 | 1,5 s | 60,0 / 60,0 | 17 ms |
| movil oscuro | 4x4 | 50 | 4,0 s | 60,0 / 60,0 | 17 ms |
| movil oscuro | 5x5 | 98 | 8,1 s | 60,0 / 60,0 | 17 ms |
| movil oscuro | 6x6 | 219 | 19,2 s | 60,0 / 59,5 | 33 ms |
| movil oscuro | 7x7 | 395 | 35,9 s | 59,7 / 59,5 | 33 ms |
| movil oscuro | Pyraminx | 12 | 0,8 s | 60,0 / 60,0 | 17 ms |
| movil oscuro | Skewb | 9 | 0,7 s | 60,0 / 60,0 | 17 ms |
| movil oscuro | Square-1 | 27 | 2,1 s | 60,0 / 60,0 | 17 ms |
| movil oscuro | Megaminx | 93 | 8,6 s | 59,2 / 58,6 | 83 ms |

Los 7x7 y Megaminx van a 60 FPS de media también en el móvil; el fotograma más lento (33–83 ms) es puntual, al cambiar de paso (se rehacen los buffers: unos 3.500 vértices en el 7x7).

### Pendiente / ideas
- Modo aprender (noche 8) con `resaltarPiezas`.
- En el móvil, la página no hace scroll si el dedo empieza sobre el lienzo 3D (para poder girarlo); hay margen alrededor para hacer scroll.
- Las letras de las caras en 3D solo están en el Megaminx (en los cubos la notación es la de siempre).

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
| FTO (noche 12) | desconocido | 21 | — | 21: **calculada aquí** (conteo con 8 caras × 2 giros; solo conmutan las opuestas; 3,14·10²² posiciones). Solver: 27,0 de media (cociente 1,29). |

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

## Siguiente paso recomendado (después de la noche 9)
0. **Modo aprender en Megaminx** (por capas: estrella, primera capa, F2L de las capas del medio y la última capa en cuatro pasos) y en **6x6/7x7** (reducción como el 5x5 más los centros oblicuos). En el 5x5, acortar las aristas (~165 giros) eligiendo mejor qué arista completar.
1. **Oblicuos del 6x6/7x7**: son lo que más pesa. Ideas no probadas: construir primero "barras" (oblicuo A + oblicuo B del mismo color, que con giros de hasta dos capas viajan juntos) y resolver luego el 6x6 como un 5x5 virtual (capas 1, 2, bloque 3–4, 5, 6) con la búsqueda de centros del 5x5.
2. **Megaminx más corto**: etapas más grandes o búsqueda en haz entre etapas; macros de última capa con más caras.
3. **4x4**: scramble de estado aleatorio (las tablas de `tpr4.js` sirven de base).
