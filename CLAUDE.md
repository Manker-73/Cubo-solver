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
1. **Tests en Node.js**: Ejecutar la suite de pruebas (`node scripts/tests.mjs` o los scripts definidos en `package.json`) y comprobar que no haya regresiones respecto a `tests/resultados/*.json` ni `tests/huellas.json`.
   * **Ningún test puede depender de la velocidad de la máquina**: nada de esperas o aserciones en milisegundos de reloj. En la app, `hasta(cond, ms)` (vueltas ociosas, no reloj); en solvers con límite de tiempo, afirmar solo lo que se cumple aun sin tiempo (comprobarlo con `conRelojLento` de `tests/util.mjs`) o usar presupuestos en nodos. Ver DECISIONES.md («Sesión de mantenimiento»).
2. **Comprobaciones visuales / E2E (Python)**: Si se modifica la UI, WebGL (`src/app/`), bloqueos o el modo Aprender (`src/aprender/`), ejecutar los scripts pertinentes en `scripts/comprobar-*.py` (`comprobar-3d.py`, `comprobar-aprender.py`, `comprobar-bloqueos.py`, `comprobar-diseno.py`, etc.).
3. **Build autónomo**: Ejecutar el empaquetado (`node scripts/construir.mjs` / `node scripts/build.mjs` según `package.json`) y verificar que `dist/index.html` y `dist/artifact.html` se generen sin errores.

---

## Flujo de una sesión de trabajo ("noche")
Las sesiones largas se lanzan con un prompt que solo trae el objetivo, las restricciones y la verificación propias de esa noche. Todo lo de esta sección se aplica SIEMPRE, aunque el prompt no lo repita.

### Permisos (lo primero de todo)
Nadie estará esperando para aprobar permisos durante la sesión. En los primeros minutos, ANTES de empezar el trabajo, pide de una vez todos los que puedas necesitar: ejecutar npm/node/python, instalar paquetes, git commit y push, consultar GitHub Actions y Pages, y republicar el artifact. Si alguno no se concede, no te quedes esperando: sigue con lo que no lo necesite y apúntalo en el resumen final.

### Antes de empezar
1. `git status` y `git fetch`. Si hay cambios sin commitear o commits locales sin subir, PARA y explica qué son antes de tocar nada. Si está limpio, `git pull`.
2. Lee `ESTADO.md`, `DECISIONES.md` y `ARQUITECTURA.md` (al menos las secciones