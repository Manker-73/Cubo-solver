# CLAUDE.md

## Descripción del Proyecto
Simulador, mezclador (scrambler), validador de estados, resolvedor (solver) y plataforma de aprendizaje interactivo para puzles tipo cubo de Rubik y poliedros de cortes planos.
Desarrollado íntegramente en **JavaScript puro (ES Modules)** sin dependencias externas de renderizado ni álgebra, con verificación de tipos mediante JSDoc/`tsconfig.json` y empaquetado a un único archivo autónomo (`dist/index.html` y `dist/artifact.html`) con WebGL puro y Web Workers.

---

## Documentación de Referencia del Proyecto
Antes de diseñar cambios estructurales, tomar decisiones técnicas o planificar nuevas funcionalidades, consulta la documentación viva en la raíz del repositorio:

* **`ARQUITECTURA.md`**: Diseño técnico detallado de módulos, contratos entre capas (`core`, `puzzles`, `aprender`, `app`) y flujos de datos. Léelo antes de modificar interfaces internas o añadir motores nuevos.
* **`DECISIONES.md`**: Registro de decisiones de diseño y compromisos técnicos adoptados (ADR). Consúltalo antes de refactorizar o proponer enfoques alternativos para no revertir decisiones ya cerradas.
* **`ESTADO.md`**: Situación actual del desarrollo, funcionalidades completadas, limitaciones conocidas y próximos pasos. Revísalo al iniciar tareas de implementación para alinear el trabajo con el estado real del proyecto.

---

## Arquitectura y Estructura de Archivos

* **`src/core/` — Núcleo matemático, geométrico y de bloqueos**
  * `perm.js`, `grupo.js`, `schreier.js`, `minkwitz.js`, `simetria.js`: Álgebra de grupos, permutaciones, paridades, índices de Lehmer, algoritmos de Schreier–Sims y Minkwitz, y simetrías.
  * `geometria.js`, `geopuzzle.js`, `modelo3d.js`, `render.js`: Modelado 3D genérico de poliedros mediante planos de corte, pegatinas, centroides, rotaciones y redes desplegadas en 2D.
  * `bloqueos.js`, `tabla-estados.js`, `calidad-practico.js`: Motor de restricciones y configuraciones *bandaged* (piezas pegadas o giros bloqueados).
  * `puzzle.js`, `piezas.js`, `scramble.js`, `rng.js`, `tipos.d.ts`: Contratos base de puzles, generación de mezclas y definiciones de tipos.
  * `colocar.js`: «Colocar piezas» genérico (noche 14): huecos, órbitas de cada pieza, bandeja por grupos de piezas iguales, bloques rígidos y la sesión con las acciones del usuario.

* **`src/puzzles/` — Implementación de motores y solvers por puzle**
  * `index.js`, `tpr4.js`, `vendado.js`: Registro central de puzles y variantes *bandaged*.
  * **Cubos NxN (`nxn*.js` —incluido `nxn-colocar.js`: generadores y nombres de tipos para colocar piezas—, `cubo-comun.js`, `cubo2.js`, `cubo3.js`, `cubo3-bloqueos.js`, `cubo-grande.js`)**: Soporte de 2x2 a 7x7, scrambles WCA sin redundancias, orientación libre, bloqueos NxN y detección de estados imposibles.
  * **Kociemba (`kociemba.js`)**: Solver en dos fases para 3x3.
  * **Poliedros y otros WCA**: `pyraminx.js`, `skewb.js`, `megaminx*.js`, `square1.js` / `square1-motor.js` (solver en 2 fases + detección de formas/paridades) y `fto*.js` (*Face-Turning Octahedron*, 72 pegatinas, cota inferior de 21 giros).
  * **Shape mods (`shapemod.js`, `shapemod-geo.js`, `shapemod-centros.js`)** (noche 16): `crearShapeMod({ id, nombre, cortes })` = 3x3 por dentro con otro cuerpo por fuera; estado por piezas de `kociemba.js` + orientación de los centros que se ven (deducida de la simetría de su forma); piezas = celda del mecanismo ∩ cuerpo; Kociemba (ganchos opcionales `aceptar` / `filtroFase1`) + fase de centros; «Colocar piezas» sobre un adaptador de marcas. Registrados Mirror Blocks y Ghost Cube (categoría `shapemods`).
  * **Cuboides (`cuboide.js`, `cuboide-geo.js`, `cuboide-grupo.js`, `cuboide-solver.js`)** (noche 15): modelo genérico `crearCuboide(a, b, c)` que deduce geometría, giros legales (90° solo en capas cuadradas), rotaciones, piezas, órbitas y restricciones (Schreier–Sims); solver óptimo con tabla exacta o IDA* con bases de patrones. Registrados 3x3x1 Floppy, 3x3x2 Domino y 2x2x3 Tower (categoría `cuboids`).

* **`src/aprender/` — Guiones de enseñanza interactiva**
  * `guion.js`, `algoritmos.js`, `motor-cubo.js`, `objetivos-cubo.js`: Motor de lecciones paso a paso y validación de objetivos.
  * `metodos-2x2.js`, `metodos-3x3.js`, `metodos-nxn.js`, `metodos-pyraminx.js`, `metodos-skewb.js`, `metodos-square1.js`: Métodos humanos en español (Principiantes, CFOP, Ortega, paridades y tablas OLL/PLL).

* **`src/app/` — Interfaz, WebGL y concurrencia**
  * `main.js`, `motor.js`, `secciones.js`, `reproductor.js`, `bloqueos-ui.js`, `servicio.js`, `tema.js`, `plantilla.html`, `estilos.css`: Lógica de aplicación, controles, temas claro/oscuro y UI de bloqueos.
  * `colocar-ui.js`: editor «Colocar piezas» en pantalla completa (puzzle vacío 2D/3D, bandeja, Girar / Siguiente posición, validación en vivo).
  * `vista3d.js`, `escena3d.js`: Motor WebGL nativo a 60 FPS con animaciones de giro, resaltado con transparencia y pintado interactivo.
  * `worker.js`: Web Worker dedicado para tablas de poda y búsquedas IDA* sin bloquear el hilo principal.
  * `fuentes/`: Tipografías `.woff2` locales incrustadas en el build.

* **`scripts/`, `tests/` y `docs/` — Build, verificación y capturas**
  * `scripts/build.mjs`, `scripts/construir.mjs`, `scripts/fuentes.sh`: Empaquetado autónomo en `dist/index.html` y `dist/artifact.html`.
  * `scripts/tests.mjs`, `scripts/bench.mjs`, `tests/*.test.mjs`, `tests/resultados/*.json`: Tests unitarios, de integración y benchmarks en Node.js con resultados de referencia (*golden files*).
  * `scripts/comprobar-*.py`: Scripts de comprobación visual y funcional en Python / Playwright (generan capturas y reportes en `docs/capturas/`, que **no se sube a git**: está en `.gitignore`; las capturas de una versión salen como artifact de la Action manual «Capturas (Chromium)», `.github/workflows/capturas.yml`). No añadas capturas al repositorio salvo una concreta que la documentación necesite.

---

## Convenciones y Reglas de Desarrollo

1. **Cero dependencias en producción**: No introducir librerías externas (ni Three.js, ni frameworks UI, ni librerías matemáticas) en `src/`. Todo el renderizado WebGL, matemáticas vectoriales/matriciales y algoritmos de búsqueda deben mantenerse autocontenidos.
2. **Idioma y tipos**: Todo el código nuevo (nombres de archivos, variables, funciones, comentarios) y los textos de la interfaz / modo Aprender deben redactarse en **español**, manteniendo coherencia con el proyecto y respetando el chequeo de tipos de `tsconfig.json` / `src/core/tipos.d.ts`.
3. **Separación de hilos (UI vs. Cálculo)**: Cualquier generación de tablas de poda (*pruning tables*), algoritmo de Schreier–Sims/Minkwitz o búsqueda IDA* pesada debe ejecutarse dentro de `src/app/worker.js` y comunicarse vía mensajes con la UI.
4. **Integridad matemática y validación**: Todo puzle nuevo debe validar estados ingresados manualmente por el usuario (conteo de pegatinas, paridad de permutación/orientación y alcanzabilidad mediante el grupo generado o tablas de estados) antes de invocar su solver. Si sus piezas tienen huecos fijos, debe dar `colocarPiezas.generadores` para ofrecer «Colocar piezas» (las piezas iguales las elige la app: `validar(estado, { elegirIguales: true })` en los vendados).
5. **Compatibilidad con el empaquetado único**: Evitar cargas dinámicas de recursos externos en tiempo de ejecución que puedan romper la generación de `dist/index.html` y `dist/artifact.html`.
6. **Sincronización documental**: Al añadir un nuevo puzle (ej. cuboides), motor, solver o cambio arquitectónico relevante:
   * Actualiza `ESTADO.md` con el avance completado.
   * Registra nuevas decisiones técnicas en `DECISIONES.md` y cambios estructurales en `ARQUITECTURA.md`.
   * Actualiza este `CLAUDE.md` si cambia la estructura de directorios o las invariantes del dominio.

---

## Flujo de Verificación
Antes de dar por finalizada cualquier modificación:
1. **Tests en Node.js**: en local, `npm run test:humo` y `npm run test:solo -- <área>` de lo que se haya tocado, sin regresiones respecto a `tests/resultados/*.json` ni `tests/huellas.json`. **No lances `test:rapido` en local** (en este portátil tarda más de 15 min): lo ejecuta la Action «Tests (rápido)» en cada push y su resultado es la comprobación limpia. La suite completa (`npm test`) se lanza en GitHub (Actions → «Tests (rápido)» → Run workflow → nivel `completo`) si se tocaron solvers, modelos o bloqueos.
   * **Ningún test puede depender de la velocidad de la máquina**: nada de esperas o aserciones en milisegundos de reloj. En la app, `hasta(cond, ms)` (vueltas ociosas, no reloj); en solvers con límite de tiempo, afirmar solo lo que se cumple aun sin tiempo (comprobarlo con `conRelojLento` de `tests/util.mjs`) o usar presupuestos en nodos. Ver DECISIONES.md («Sesión de mantenimiento»).
2. **Tipos**: `npm run tipos` limpio, sin `any` ni `@ts-ignore` sin un comentario que lo justifique.
3. **Comprobaciones visuales / E2E (Python)**: Si se modifica la UI, WebGL (`src/app/`), bloqueos o el modo Aprender (`src/aprender/`), ejecutar los scripts pertinentes en `scripts/comprobar-*.py` (`comprobar-3d.py`, `comprobar-aprender.py`, `comprobar-bloqueos.py`, `comprobar-diseno.py`, etc.): escritorio y móvil, oscuro y claro, sin errores de consola ni scroll horizontal.
4. **Build autónomo**: Ejecutar el empaquetado (`node scripts/construir.mjs` / `node scripts/build.mjs` según `package.json`) y verificar que `dist/index.html` y `dist/artifact.html` se generen sin errores.

---

## Flujo de una sesión de trabajo ("noche")
Las sesiones largas se lanzan con un prompt que solo trae el objetivo, las restricciones y la verificación propias de esa noche. Todo lo de esta sección se aplica SIEMPRE, aunque el prompt no lo repita.

### Permisos (lo primero de todo)
Nadie estará esperando para aprobar permisos durante la sesión. En los primeros minutos, ANTES de empezar el trabajo, pide de una vez todos los que puedas necesitar: ejecutar npm/node/python, instalar paquetes, git commit y push, consultar GitHub Actions y Pages, y republicar el artifact. Si alguno no se concede, no te quedes esperando: sigue con lo que no lo necesite y apúntalo en el resumen final.

### Antes de empezar
1. `git status` y `git fetch`. Si hay cambios sin commitear o commits locales sin subir, PARA y explica qué son antes de tocar nada. Si está limpio, `git pull`.
2. Lee `ESTADO.md`, `DECISIONES.md` y `ARQUITECTURA.md` (al menos las secciones relacionadas con el objetivo de la noche).
3. `npm run test:humo` como referencia de partida.
4. Si la sesión anterior dejó pendiente el resultado de una Action o de la suite completa, compruébalo y anótalo en `ESTADO.md`. Si falló, arréglalo antes de seguir.
5. Un primer commit pequeño (p. ej. "ESTADO: empieza la noche N") y push, para confirmar que se puede subir.

### Durante la sesión
- Trabaja por orden de prioridad del prompt. Si no da tiempo a todo, deja lo hecho funcionando y escribe qué falta.
- Commit y push tras cada hito: nunca dejes trabajo importante solo en local.
- Mientras trabajas, usa `npm run test:solo -- <área>` para lo que estés tocando y `npm run test:humo` tras cada hito.
- No esperes respuestas del usuario: toma la decisión más razonable y documéntala en `DECISIONES.md`. Excepción: algo irreversible o destructivo (reescribir el historial de git, borrar ramas o datos, cambiar el formato de enlaces o datos guardados de los usuarios). Ahí, prepara todo, explica la decisión y PARA.
- Si el usuario tiene cambios propios en el repo (te lo dirá), no los mezcles con los tuyos: van en commits aparte y no se tocan sin preguntar.
- Restricciones de grupos (paridades, orientaciones, tamaño): se demuestran con `src/core/grupo.js` / `schreier.js` y se comprueban empíricamente, nunca se suponen. Las cifras se contrastan con las publicadas cuando existan.
- Tests nuevos: los de solver aplican cada solución movimiento a movimiento. Para cada arreglo, un test que falle antes y pase después. Para puzzles o giros nuevos, huellas en `tests/huellas.json` (el diff solo debe traer las nuevas) y una prueba de sabotaje (invertir un giro y comprobar que `test:humo` lo detecta; deshacerlo).
- Mide el tamaño de `dist/index.html` y el tiempo de las tablas nuevas (escritorio y móvil con CPU ×4). Avisa si el HTML crece mucho o si alguna tabla supera ~20 MB o ~10 s en móvil.

### Si la sesión se corta (límite de uso, reinicio)
Al reanudar: `git status` y `git log` (local y `origin/main`), push de lo que falte, comprobar lo que esté a medias (`npm run tipos`, `npm run test:solo -- <área>`), relanzar lo que estuviera corriendo en segundo plano si hace falta, y seguir con el siguiente objetivo por orden de prioridad.

### Al terminar
1. **Verificación completa**: el «Flujo de verificación» de arriba. Si un test falla, arréglalo o explica por qué en el resumen; nunca lo des por bueno.
2. **Documentación**: `ESTADO.md` (sección de la noche con lo hecho, resultados medidos y pendiente, y la línea de progreso con ✔/✘ al principio), `DECISIONES.md` (decisiones, fuentes y lo que no funcionó), `ARQUITECTURA.md` y `README.md` si cambian, y este `CLAUDE.md` si cambia la estructura de archivos o las reglas.
3. **Commits**: con mensajes en español; los cambios ajenos al objetivo de la noche van en commits aparte. No commitees capturas (`docs/capturas/`) ni ficheros a medias de una ejecución cortada.
4. **Push y comprobación limpia**: `git push` y espera a la Action «Tests (rápido)» y al despliegue de Pages (si `gh` no está instalado, usa la API pública de GitHub). Anota el resultado de la Action en `ESTADO.md` (commit aparte) y vuelve a subirlo.
5. **Artifact**: si el bundle cambió, republica `dist/artifact.html` en el mismo artifact de siempre (misma URL) después de comprobar que el build es el del último commit.
6. **Resumen final** en español: lo que pida el prompt de la noche, más el estado de `main` (commits), el resultado de la Action y de Pages, el enlace del artifact, los permisos que no se concedieron, lo que queda pendiente y lo que tiene que comprobar el usuario con sus puzzles físicos. Si algo no se hizo o no se verificó, dilo claramente.