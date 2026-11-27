# Investigación: tamaño y carga de la app (27/11/2026)

Sesión de investigación: main **no cambia de comportamiento**. Los prototipos y los scripts de medición están en la
rama `investigacion/carga` (directorio `investigacion/`). Punto de partida: `main` en `85a3912` (noche 16).

**En una frase**: la descarga se puede bajar de **376 KB a 223 KB** (−41 %) y la portada en un móvil con Fast 3G y
CPU ×4 aparece en **2,3 s en vez de 4,2 s**, sin cambiar la arquitectura (un solo HTML, sin conexión, artifact y
Pages iguales), con tres cambios: no duplicar el Worker, no construir los puzzles al cargar y recortar las fuentes. El build en varios ficheros solo compensa junto con la PWA.

## Cómo se ha medido

- **Chromium real** (Chrome instalado, Playwright) con `investigacion/medir-carga.py`. Un servidor local
  (`investigacion/servidor.mjs`) imita a GitHub Pages: gzip, `Cache-Control: max-age=600`, `ETag`, 304.
  - Se comprobó con las cabeceras de `https://manker-73.github.io/Cubo-solver/` (27/11/2026): `Content-Encoding:
    gzip`, 959.374 B → **385.676 B**. **GitHub Pages no sirve brotli** aunque el navegador lo pida
    (`Accept-Encoding: gzip, deflate, br, zstd` → gzip). `Cache-Control: max-age=600`.
- **Red**: los perfiles de DevTools. **Fast 3G**: 562,5 ms de latencia, 1,44 Mbit/s de bajada. **Slow 3G**: 2 s y
  400 kbit/s. **CPU** ×1 (este portátil) y ×4 (`Emulation.setCPUThrottlingRate`, como el «móvil de gama media» de
  Lighthouse). Viewport de móvil (390 × 844, táctil).
- **Cargas**: en cada repetición, contexto nuevo (caché vacía), portada fría (`#/`), la misma portada en otra pestaña
  (con caché) y, en otro contexto, `#/wca/3x3` en frío. **5 repeticiones, mediana**.
- **Métricas**, medidas dentro de la página:
  - **FCP**: primer pintado con contenido.
  - **Portada**: las tarjetas de la portada están en el DOM y el hilo principal ha quedado libre (lo detecta un
    `setInterval` de 20 ms, que no corre mientras haya una tarea larga): «se ve la portada y responde».
  - **Usable**: fin de la última tarea larga (> 50 ms) antes de 1 s sin tareas largas, a partir de la portada
    (TTI simplificado). **En todas las mediciones ha coincidido con «portada»**: cuando la portada aparece, el hilo
    ya está libre. Por eso las tablas dan un solo número («portada = usable»).
  - **3x3 listo**: abriendo `#/wca/3x3`, scramble generado y «Cargar» activo (incluye las tablas de Kociemba en el
    Worker).
  - **KB**: `transferSize` de la página y sus recursos (lo que se descarga, comprimido).
- **Trazas** de Chromium (`--traza`, mediana de 5 cargas frías sin red simulada): compilación, ejecución y
  maquetación en el hilo principal y en el Worker.
- **Cobertura** de V8 por funciones (`investigacion/cobertura.py`): cuánto JS se ejecuta de verdad en la portada.
- Reproducir: ver «Cómo reproducirlo» al final.

Pegas de la medición, para leer bien las cifras:
- **WebGL por software** (SwiftShader, como en los demás scripts de Chromium). Crear un contexto WebGL cuesta aquí
  más que en un móvil con GPU (y ese tiempo no se multiplica con CPU ×4: lo hace el proceso de la GPU).
- Ruido entre repeticiones: ±0,2–0,3 s en Fast 3G ×4 (todas las repeticiones, en `investigacion/resultados/`).
  Diferencias menores que eso no son significativas.
- La simulación de red de Chromium es por petición (latencia + ancho de banda), no un 3G real.
- El portátil con CPU ×4 no es un móvil: sirve para comparar variantes entre sí, no como cifra absoluta.

## 1. Medición de partida (main, noche 16)

| | Sin comprimir | gzip (lo que sirve Pages) | brotli (no lo sirve Pages) |
|---|---|---|---|
| `dist/index.html` | **937,4 KB** (959.852 B) | **375,4 KB** (nivel 9; Pages: 376,6 KB) | 254,7 KB |

| Condición (móvil 390 px) | FCP | Portada = usable | Con caché | 3x3 listo |
|---|---|---|---|---|
| Fast 3G, CPU ×1 | 1,09 s | **3,02 s** | 0,41 s | 4,88 s |
| Fast 3G, CPU ×4 | 1,28 s | **4,16 s** | 2,08 s | 5,98 s |
| Slow 3G, CPU ×1 | 3,53 s | **10,02 s** | 0,41 s | 11,89 s |
| Slow 3G, CPU ×4 | 3,72 s | **11,04 s** | 1,98 s | 13,08 s |

Trazas (mediana de 5; ms):

| CPU | Hilo principal: compilar (+ perezosa) | ejecutar | maquetar | Worker: compilar + ejecutar |
|---|---|---|---|---|
| ×1 | 36 + 78 | **347** | 123 | 585 |
| ×4 | 263 + 593 | **1.697** | 600 | 459 |

Lo que dicen:
- **La descarga manda en frío** (376 KB en Fast 3G ≈ 2,1 s de transferencia, más la latencia), pero en CPU ×4 hay
  casi **2 s de CPU** en el hilo principal antes de ver la portada, **y no es parsear**: compilar son ~0,1 s (×1).
  Es **ejecutar el código de nivel superior**: al cargar, el registro construye los 16 puzzles y sus geometrías
  (Node, `--cpu-prof` de `import('src/puzzles/index.js')`: ~300 ms; shape mods 37 ms, Megaminx 23, cubos grandes 23…)
  aunque la portada no use ninguno. **El Worker hace lo mismo otra vez** (~0,5 s) antes de su primer cálculo.
- **Con caché sigue costando 2 s en CPU ×4**: con el HTML en caché, solo queda la CPU. Un script incrustado en el
  HTML no aprovecha la caché de código de V8 (solo la tienen los scripts externos).
- FCP llega pronto (la cabecera se pinta antes del script), pero la portada no hasta que acaba el script.

## 2. De qué está hecho el tamaño

`node investigacion/desglose.mjs` (metafile de esbuild, mismas opciones que `npm run build`).

| Parte | Sin comprimir | gzip |
|---|---|---|
| Script principal (sin el texto del Worker) | 451,1 KB | 168,5 KB |
| **Texto del Worker** (el mismo código, otra vez, como cadena) | **365,9 KB** | **136,5 KB** |
| Fuentes (base64) | 78,0 KB | ~60 KB (el woff2 ya va comprimido) |
| CSS | 32,4 KB | 7,1 KB |
| Plantilla HTML | 13,8 KB | ~4 KB |
| **Total `dist/index.html`** | **937,4 KB** | **375,4 KB** |

Por área (bytes de salida minificados del script principal; «también en el Worker» = repetido en su texto):

| Área | Script principal | También en el Worker | Módulos |
|---|---|---|---|
| Puzzles NxN (2x2–7x7, `nxn*`, `cubo*`) | 86,0 KB | 86,0 KB | 13 |
| Modo aprender (guiones y métodos) | 80,8 KB | 80,8 KB | 10 |
| Bloqueos (vendados: `bloqueos.js` 44 KB, `vendado`, UI) | 60,0 KB | 49,1 KB | 5 |
| Interfaz (`main.js` 37 KB, motor, secciones, tema…) | 46,4 KB | 1,5 KB | 6 |
| Square-1 | 25,7 KB | 25,7 KB | 2 |
| Megaminx | 24,9 KB | 24,9 KB | 6 |
| Shape mods | 24,2 KB | 24,2 KB | 3 |
| Colocar piezas (`colocar.js` + `colocar-ui.js`) | 23,3 KB | 0,6 KB | 3 |
| Núcleo (`perm`, `grupo`, `geometria`…) | 18,7 KB | 18,7 KB | 10 |
| FTO | 16,6 KB | 16,6 KB | 3 |
| Vista 3D (`vista3d`, `escena3d`, `modelo3d`) | 13,3 KB | 1,7 KB | 3 |
| `tpr4.js` | 11,4 KB | 11,4 KB | 1 |
| Pyraminx · 3x3 Kociemba · Skewb · registro | 19,9 KB | 19,9 KB | 4 |
| **Total** | **451,0 KB** | **360,9 KB** | |

(Cuboides van dentro de «NxN»/núcleo por sus dependencias; ver `investigacion/resultados/desglose.json`, módulo a módulo.)

Comprobaciones concretas:
- **El Worker está duplicado**: el 98,5 % del texto del Worker (360,9 de 366 KB) ya está en el script principal,
  porque el hilo principal importa el mismo `servicio.js` (para funcionar sin Worker) y todos los puzzles (los
  necesita para dibujar). Cuesta **136 KB de los 376 descargados (36 %)**. gzip no lo aprovecha (su ventana es de
  32 KB); brotli sí en parte, pero Pages no lo sirve. Además, cada puzzle nuevo crece **dos veces**.
- **Fuentes**: 59,9 KB en woff2 → 78 KB en base64. Se pueden recortar (`fonttools`, en el scratch):
  - Inter es variable de 100 a 900, pero la app solo usa 400, 500 y 600: limitando el eje a 400–600, 35,2 → 24,9 KB;
  - el subconjunto lleva todo Latin-1 (203 caracteres); el español y los signos de la interfaz necesitan ~125
    (ASCII + `¡¿«»·×°ºª±²³¹áéíóúüñÁÉÍÓÚÜÑ–—‘’“”…′−•`; los símbolos matemáticos y flechas que hay en el código no
    están en ninguna de las tres fuentes y ya los pinta la del sistema);
  - resultado: **Inter 19,8 KB, Bricolage 13,3 KB, JetBrains Mono 5,9 KB = 38,9 KB** (−21 KB de woff2, −28 KB de
    base64, ≈ −20 KB descargados).
- **Código muerto**: casi nada. Lo único de depuración es `window.cuboSolver` (~0,6 KB minificado) y el registro de
  peticiones del motor (unos cientos de bytes), y los usan los scripts de Chromium. Los tests no entran en el build.
- **Minificación**: ya está al máximo de esbuild (`minify: true`). Probado (`investigacion/minificar.mjs`):
  `charset: 'utf8'` −3 KB sin comprimir y +0,3 KB con gzip; `target: es2022` igual; `drop: ['debugger']` igual.
  Sin minificar sería 1.501 KB (397 KB gzip). No se comparó con terser (no se concedió el permiso para descargarlo
  con `npx`); por experiencia, terser gana un 1–3 % a esbuild, no compensa una dependencia nueva.
- **Lo que se ejecuta de verdad** (cobertura por funciones, `investigacion/cobertura.py`): con el registro perezoso
  (prototipo abc), la portada ejecuta **25,6 KB** de los 460,6 KB del script (5,5 %) y el 3x3, 127 KB (27,6 %).

## 3. Opciones, prototipos y cifras

Todas con el mismo script y las mismas condiciones (5 repeticiones, mediana). Funcionan todas: 3x3, Megaminx,
Ghost Cube y 4x4 vendado con scramble → resolver → final resuelto, cálculos en Workers y sin errores de consola
(`investigacion/comprobar-prototipos.py`).

| Variante | KB descargados | Fast 3G ×4 fría: FCP / **portada** | Con caché (×4) | Fast 3G ×1 | Slow 3G ×4 | Slow 3G ×1 | 3x3 listo (Fast 3G ×4) |
|---|---|---|---|---|---|---|---|
| base (main) | 376 | 1,28 / **4,16 s** | 2,08 s | 3,02 s | 11,04 s | 10,02 s | 5,98 s |
| a · Worker sin duplicar | 242 | 1,30 / **3,40 s** | 2,13 s | 2,29 s | 8,42 s | 7,30 s | 5,45 s |
| b · fuentes recortadas | 356 | 1,28 / **4,09 s** | 2,33 s | 2,92 s | 10,88 s | 9,62 s | 6,19 s |
| c · registro perezoso | 383 | 1,35 / **3,34 s** | 1,55 s | 2,86 s | 10,29 s | 9,99 s | 5,79 s |
| **abc** | **223** | 1,42 / **2,27 s** | 1,29 s | 1,94 s | 7,03 s | 6,68 s | 4,75 s |
| abce · abc + e2 | 223 | 1,42 / **2,24 s** | 1,54 s | 2,00 s | 7,05 s | 6,72 s | 4,97 s |
| d · varios ficheros (con abc) | 224 | 2,10 / **3,20 s** | **0,71 s** | 2,99 s | 10,55 s | 10,36 s | 5,83 s |
| e1 · abc con brotli (otro alojamiento) | 194 | 1,20 / **2,02 s** | 1,15 s | 1,78 s | 6,40 s | 6,09 s | 4,68 s |

Trazas (mediana de 5 cargas frías sin red simulada; ms):

| Variante | CPU | Principal: compilar (+ perezosa) | ejecutar | maquetar | Worker: evaluar |
|---|---|---|---|---|---|
| base | ×1 / ×4 | 36 + 78 / 263 + 593 | 347 / 1.697 | 123 / 600 | 585 / 459 |
| a | ×1 / ×4 | 35 + 90 / 182 + 396 | 362 / 1.454 | 122 / 546 | 609 / 578 |
| c | ×1 / ×4 | 34 + 57 / 225 + 335 | 200 / 189 | 125 / 525 | 113 / 73 |
| abc | ×1 / ×4 | 33 + 57 / 172 + 231 | 238 / 248 | 116 / 658 | 113 / 83 |
| abce | ×1 / ×4 | 33 + 52 / 210 + 325 | 63 / 107 | 122 / 616 | 106 / 90 |
| d | ×1 / ×4 | 1 + 20 / 2 + 109 | 132 / 235 | 45 / 259 | 265 / 235 |

(En c y abc, «ejecutar» casi no cambia con CPU ×4 porque lo que queda es sobre todo `hayWebGL()`, que espera al
proceso de la GPU; ver e2.)

### a. Quitar la duplicación del Worker
- **Prototipo**: `investigacion/proto/entrada-unica.js`. Un solo script para la página y el Worker: si no hay
  `document`, arranca el Worker (`worker.js`); si no, guarda su propio texto (`document.currentScript.textContent`)
  y arranca la app (`main.js`). El Worker se crea desde un blob con ese texto, como ahora. Los dos puntos de entrada
  van con `require()`, así que esbuild los envuelve en funciones y cada hilo ejecuta solo el suyo. `src/` no cambia
  (el prototipo define `__CODIGO_WORKER__` como `globalThis.__CODIGO_PROPIO__`).
- **Cifras**: −134 KB descargados (376 → 242, −36 %); portada −0,76 s (Fast 3G ×4), −2,6 s (Slow 3G ×4).
- **Pegas**: el Worker compila también el código de la interfaz (~90 KB más, sin ejecutarlo: +20 ms en el Worker).
  Depende de `document.currentScript` en un script clásico incrustado: funciona en Chrome, Firefox y Safari, y en el
  artifact el script también va incrustado, pero **hay que comprobarlo en claude.ai** antes de fusionarlo (si
  `currentScript` fuera `null`, el motor ya cae al hilo principal: la app sigue funcionando, más lenta).
- **Trabajo / riesgo**: bajo (un fichero de entrada y una línea de `construir.mjs`). Los tests de la app que leen
  `__CODIGO_WORKER__` se adaptarían.

### b. Recortes sin cambiar la arquitectura
- **Fuentes** (prototipo: `investigacion/proto/fuentes/`, hechas con `fonttools`): −20 KB descargados. Portada
  −0,07 s: dentro del ruido. **Minificación** y **código muerto**: nada que ganar (ver arriba).
- **Pegas**: un carácter fuera del subconjunto (p. ej. una «ç» o una «ü» mayúscula que no esté) se pinta con la
  fuente del sistema. Inter deja de tener pesos < 400 o > 600 (la app no los usa; si un día se usan, el navegador
  los sintetiza).
- **Trabajo / riesgo**: muy bajo (cambiar `scripts/fuentes.sh` y regenerar).

### c. Evaluación diferida dentro del mismo HTML
- **Prototipo**: `investigacion/proto/index-perezoso.js` sustituye al registro (alias de esbuild). Los datos que la
  interfaz lee sin usar el puzzle (`id`, `nombre`, `categoria`, `costeScramble`, `capacidades`) van en una tabla; cada
  puzzle es un `Proxy` que construye el real la primera vez que se le pide otra cosa, y su módulo se carga con
  `require()`, que esbuild envuelve en una función: el código de nivel superior de cada puzzle (geometrías, piezas)
  tampoco se ejecuta hasta entonces. En la portada no se construye ninguno (`__construidos = []`).
- **Cifras**: la descarga no baja (+7 KB, la tabla y las envolturas), pero la ejecución sí: hilo principal 347 →
  200 ms (×1), 1.697 → 189 ms (×4); el Worker 585 → 113 ms. Portada −0,82 s (Fast 3G ×4) y, **con caché, 2,08 →
  1,55 s**. 3x3 listo −0,2 s (el Worker arranca antes y solo construye lo que le piden).
- Por secciones (que el código de cada sección solo se parsee al entrar) no compensa: compilar es ~0,1 s (×1) y V8
  ya compila perezosamente las funciones que no se llaman. Lo que costaba era **ejecutar**, y eso lo arregla c.
- **Pegas**: un `Proxy` por puzzle es un parche para el prototipo. En una versión de verdad, el registro declararía
  cada puzzle como `{ id, nombre, categoria, costeScramble, capacidades, crear: () => … }` y `obtenerPuzzle`
  construiría al primer uso (sin `Proxy`). Los tests (que usan `PUZZLES` directamente) no cambian si `PUZZLES` sigue
  devolviendo los puzzles construidos al recorrerlo. Los `require()` no funcionan en Node con ES Modules: habría que
  usar constructores perezosos con `import` estático (lo que solo difiere la construcción, que es lo que más pesa,
  no el código de nivel superior de cada módulo) o generar el registro en el build.
- **Trabajo / riesgo**: medio (el registro y cómo lo recorren `main.js` y los tests). Comportamiento igual.

### d. Build con varios ficheros solo para GitHub Pages
- **Prototipo** (`investigacion/dist/d/`): `index.html` (15 KB) + `estilos.css` + `app.js` (`defer`) + las tres
  fuentes `.woff2`, con a + b + c dentro. El Worker hace `importScripts(app.js)`, que sale de la caché HTTP.
  `dist/artifact.html` seguiría siendo un único fichero (el build haría las dos cosas).
- **Cifras**: la misma descarga que abc (224 KB), pero en frío **es peor**: FCP 2,10 s (el CSS externo bloquea el
  pintado y necesita otra ida y vuelta de 562 ms) y portada 3,20 s (Slow 3G: 10,55 s, con 2 s por ida y vuelta).
  **Con caché es lo mejor: 0,71 s** (V8 guarda el código compilado de `app.js`; con un script incrustado no puede) y
  el hilo principal compila casi nada (1 + 20 ms).
- **Trozos por sección o puzzle** (no prototipado del todo): la cobertura dice que la portada ejecuta 25,6 KB de JS.
  Un build con trozos (ESM + `import()` por puzzle) bajaría la portada a unos **60–80 KB descargados** (HTML + CSS +
  la interfaz + fuentes) y cada puzzle se descargaría al entrar (10–40 KB). Pero exige que el registro y `main.js`
  sean **asíncronos** (`await cargarPuzzle(id)`), que es el cambio más grande de todos; y sin conexión, solo
  funcionaría con un service worker que lo haya guardado todo.
- **Con la PWA**: el service worker guardaría en la instalación la lista de ficheros del build (con un hash en el
  nombre, o una versión en `sw.js`), y desde la segunda visita todo sale de la caché, también sin conexión. Chrome
  genera la caché de código de V8 de los scripts que guarda un service worker, así que la ventaja de d (0,71 s con
  caché) se mantiene. Con un único HTML, la PWA también funciona (guarda un fichero), pero cada versión nueva
  vuelve a descargar los 223 KB enteros y no hay caché de código.
- **Pegas**: dos salidas de build distintas (Pages y artifact) que hay que probar las dos; la app ya no se puede abrir
  con doble clic desde `dist/` sin servidor (los Workers de `file://` y `importScripts` no van), aunque sí
  `dist/artifact.html`/un `dist/index.html` de un solo fichero; un despliegue a medias (HTML nuevo con `app.js`
  viejo) obliga a poner hash en los nombres.
- **Trabajo / riesgo**: medio sin trozos (build), alto con trozos (registro asíncrono).

### e. Otras
- **e1. Un alojamiento con brotli** (Cloudflare Pages, Netlify…): abc pasa de 223 a 194 KB (−13 %) y la portada de
  2,27 a 2,02 s. Hay que dejar GitHub Pages; Pages no permite subir ficheros precomprimidos ni elegir la compresión.
  No compensa por sí solo.
- **e2. La portada no comprueba WebGL ni fuerza una maquetación** (prototipo `abce`, cambio en `main.js` al vuelo):
  después de c, el perfil de la portada muestra que casi todo lo que queda es `hayWebGL()` (crea un contexto WebGL
  para saber si hay 3D: 237 ms aquí, con WebGL por software) y `vigilarResolverFijo()` (lee `offsetHeight` → una
  maquetación forzada de 98 ms; el `ResizeObserver` ya lo mide solo). En el prototipo, `st.webgl` se calcula la
  primera vez que se lee (al abrir un puzzle) y la medida se deja al `ResizeObserver`. **Cifras**: «ejecutar» en el hilo principal baja de 238 a 63 ms (×1) y de 248 a 107 ms (×4), pero **de punta a punta no se nota** (portada 2,24 s frente a 2,27 s; con caché 1,54 frente a 1,29 s): la diferencia está dentro del ruido entre repeticiones (±0,2–0,3 s), porque en frío manda la descarga y lo que queda en la CPU es sobre todo **maquetar** (~120 ms ×1, ~600 ms ×4).
  **Pegas**: ninguna funcional (el 3D sigue funcionando al abrir un puzzle; comprobado). En un móvil con GPU, crear
  el contexto cuesta menos que aquí: la ganancia real será menor que la medida. **Trabajo / riesgo**: muy bajo.
- **e3. `max-age=600` de Pages**: pasados 10 min, la siguiente visita revalida (`If-None-Match` → 304, una ida y
  vuelta: ~0,6 s en Fast 3G antes de empezar). No se puede cambiar en Pages; lo resuelve la PWA (el service worker
  responde sin red y actualiza en segundo plano).
- **e4. Precalcular en el build** lo que hoy se construye al cargar (geometrías): no hace falta si se hace c (no se
  construye nada hasta usarlo, y cada puzzle por separado cuesta 5–40 ms).

## 4. Recomendación

**Ya (sin la PWA), en este orden**; cada paso es independiente, se mide con `scripts/medir-carga.py` y no cambia nada
visible:

| Paso (acumulado) | KB descargados | Portada en móvil (Fast 3G, CPU ×4) | Con caché (×4) | Slow 3G ×4 | Trabajo | Riesgo |
|---|---|---|---|---|---|---|
| 0. Hoy (main) | 376 | 4,16 s | 2,08 s | 11,04 s | — | — |
| 1. a · Worker sin duplicar | 242 (−134) | 3,40 s | 2,13 s | 8,42 s | bajo (½ sesión) | bajo: comprobar el artifact en claude.ai |
| 2. + c · registro perezoso + b · fuentes | 223 (−153) | **2,27 s** (−1,9 s, −45 %) | 1,29 s | 7,03 s | medio (1 sesión, con tests) | medio: tocar el registro |
| 3. + e2 · sin WebGL ni maquetación forzada en la portada | 223 | 2,24 s (≈ igual) | 1,54 s (ruido) | 7,05 s | muy bajo | muy bajo |

(c sola, sin a: 3,34 s / 1,55 s con caché; b sola: −20 KB, sin cambio medible en el tiempo.)

1. **a** primero: es lo que más baja la descarga y hace que cada puzzle nuevo cueste la mitad.
2. **c**: el registro con constructores perezosos (sin `Proxy`); es lo que baja la CPU en frío **y con caché**, y
   el arranque del Worker. Con a, la portada pasa de 4,2 a 2,3 s.
3. **b** en la misma tanda o cuando se toquen las fuentes: gana poco pero no cuesta nada.
4. **e2** es opcional: quita trabajo inútil del hilo principal (y en un móvil sin buena GPU puede notarse), pero aquí
   no se mide de punta a punta. Lo siguiente que pesa en la portada es **maquetar** (~0,6 s con CPU ×4): merece una
   investigación propia (qué parte de la plantilla se maqueta en la portada y si las fuentes provocan una segunda
   maquetación).

**Con la PWA**: el build en varios ficheros (d) solo para Pages (index.html + app.js + css + fuentes, con hash en
los nombres), y el service worker guardándolos. En frío da lo mismo que abc (o algo peor sin `preload`), pero las
visitas siguientes bajan a ~0,7 s y funcionan sin conexión. Los **trozos por puzzle** (registro asíncrono) solo
cuando el HTML vuelva a pasar de ~500 KB descargados: es el cambio más caro y, con a + c, la descarga crece la mitad
de rápido que ahora.

**No recomiendo**: cambiar de alojamiento solo por brotli (−13 %), terser, ni evaluar el código por secciones dentro
del HTML (parsear no es el problema).

## Cómo reproducirlo

En la rama `investigacion/carga` (Node, Python con Playwright y Chrome; `pip install fonttools brotli` solo para
regenerar las fuentes):

```sh
npm ci && npm run build                          # dist/ de main
node investigacion/desglose.mjs                  # desglose por área y duplicación del Worker
node investigacion/minificar.mjs                 # variantes de minificación
node investigacion/prototipos.mjs                # investigacion/dist/{base,a,b,c,abc,abce,d}/
python investigacion/comprobar-prototipos.py     # que todos funcionan (Workers, resolver en 4 puzzles)
sh investigacion/medir-todo.sh                   # todas las mediciones (≈ 45 min) → investigacion/resultados/
sh investigacion/trazas.sh                       # solo las trazas
python investigacion/cobertura.py base abc       # JS ejecutado en la portada
node investigacion/tabla.mjs                     # las tablas de este informe
```

Una sola variante: `python investigacion/medir-carga.py --dir investigacion/dist/abc --reps 5 --traza`.
En main queda `scripts/medir-carga.py` (+ `scripts/servidor-pages.mjs`) para medir `dist/` igual en cada noche.
