# Cubo Solver

Generador de scrambles WCA, validador de estado y solucionador visual de puzzles.
Aplicación web en un único HTML, sin servidor.

**Mezcla. Comprueba. Resuelve. Aprende.** La portada lleva a las secciones (los nombres, en inglés, como en la comunidad):
- **WCA Puzzles** (`#/wca`, y `#/wca/<puzzle>` para abrir uno: `#/wca/megaminx`): scramble, editor, solucionador, vista 3D y modo aprender de 2x2–7x7, Pyraminx, Skewb, Square-1, Megaminx y FTO (Face-Turning Octahedron, oficial de la WCA desde el 2 de enero de 2027).
- **Bandaged Cubes** (`#/bandaged`): el 3x3, el 4x4 y el 5x5 vendados con tus bloques, y las firmas de la comunidad (3x3).
- **Cuboids** (`#/cuboids`, y `#/cuboids/<puzzle>`: `#/cuboids/3x3x2`; noche 15): 3x3x1 (Floppy), 3x3x2 (Domino) y 2x2x3 (Tower) con scramble de estado aleatorio, validador (pintando o colocando piezas), solución óptima y vista 3D; 2x2x4, 3x3x4 y 3x3x5, anunciados.
- *Shape Mods* y *Others*: próximamente (se ven bloqueadas en la portada).

Tema oscuro por defecto; el botón de la cabecera cambia a claro (y lo recuerda en el navegador). Funciona sin conexión: las fuentes van dentro del HTML y no se pide nada a la red.

- **Scrambles**: 2x2 a 7x7, Square-1, Skewb, Pyraminx, Megaminx, FTO y los cuboides (estado aleatorio en 2x2, 3x3, Pyraminx, Skewb, Square-1, FTO, 3x3x1, 3x3x2 y 2x2x3).
- **Validador y solucionador en todos los puzzles**: 2x2 (óptimo), 3x3 (dos fases de Kociemba), 4x4 (reducción en tres fases de búsqueda, sin paridades OLL ni PLL, ~55 movimientos) y 5x5 a 7x7 (reducción: búsqueda por etapas en los centros, aristas emparejadas con un voraz de macros que no mueven los centros y conmutadores para lo que quede; ~109, ~256 y ~356 movimientos), Pyraminx (óptimo), Skewb (óptimo), Square-1 (dos fases: forma de cubo y permutación, solo con giros posibles) Megaminx (por etapas con búsqueda IDA* y la última capa con macros buscadas automáticamente; ~90 giros de cara de media) y FTO (tres fases con tablas de poda, como el scrambler oficial de TNoodle; ~27 giros de media, cota inferior 21). Cuboides: óptimo (3x3x1, 3x3x2 y 2x2x3).
- **Modo aprender** (2x2, 3x3, 4x4, 5x5, Pyraminx, Skewb y Square-1): además de la solución por ordenador, una solución por un **método humano** explicada paso a paso: 3x3 por capas para principiantes o CFOP; 2x2 por capas o Ortega; 4x4 y 5x5 por reducción (con el 3x3 por capas o CFOP y las paridades); Pyraminx, Skewb y Square-1 por sus métodos de principiantes.
- **3x3 vendado** (bloqueos definidos por el usuario): pega piezas entre sí (parejas, barras, bloques 1x2x2, 2x2x2…) y el 3x3 se comporta como un cubo vendado real: solo giros que no rompen ningún bloque, scramble y solución adaptados a cada configuración, dos estrategias de solución (búsqueda directa, y geometría y luego permutación) y comparación con la solución sin bloqueos.
- **4x4 y 5x5 vendados** (noche 13): lo mismo con capas anchas e interiores, piezas iguales (centros del mismo color) contadas una sola vez y, en el 5x5, bloques que unen centros opuestos a través del núcleo. Si el espacio es pequeño, solución óptima; si es grande, la solución es larga (cientos de giros: geometría y luego piezas con tablas de Minkwitz), siempre comprobada giro a giro.
- Las tablas se generan en el navegador dentro de un Web Worker (la página no se bloquea); si no hay Worker, en el hilo principal.

**App en línea: https://manker-73.github.io/Cubo-solver/**

## Cómo usarla

1. Entra en **WCA Puzzles** y elige el puzzle (2x2 … 7x7, Pyraminx, Skewb, Square-1, Megaminx, FTO); la URL cambia a `#/wca/<puzzle>`, así que se puede guardar o compartir.
2. **Scramble**: pulsa *Nuevo scramble*; *Copiar* lo copia al portapapeles. Los scrambles se preparan por adelantado en segundo plano, así que al cambiar de puzzle suele salir al momento; la primera vez en cada puzzle, las tablas del solucionador se generan en segundo plano (unos segundos; hasta ~8 s en el 7x7) sin retrasar el scramble.
3. **Resolver** (un clic basta; si las tablas aún se están generando, se ve "Generando tablas… X s" y la solución aparece al terminar): pinta el estado de tu puzzle eligiendo un color de la paleta y tocando las pegatinas, **colócalo pieza a pieza con *Colocar piezas*** (ver abajo) o pulsa *Cargar scramble actual*, y luego *Resolver*. Puedes sujetar el puzzle en cualquier orientación: la solución sale para como lo tengas. *Rellenar cara* (cubos grandes y Megaminx) pinta una cara entera de un toque y *Deshacer* (o Ctrl+Z) deshace el último cambio. Si el estado es imposible, la app dice qué pieza falla. Resolver un 4x4–7x7 tarda 1–7 s de media (hasta ~13 s en el peor caso medido); un Megaminx, unos 2,5–3 s (prueba muchas orientaciones y se queda con la solución más corta); un FTO, ~1 s (las tablas, la primera vez, ~2 s en un ordenador y ~8–9 s en un móvil lento).
4. Recorre la solución con los botones de reproducción (paso a paso, play y velocidad); *Copiar* copia los movimientos. En los puzzles con etapas (cubos grandes, Megaminx) la barra de fases muestra en qué etapa está cada tramo.

### Introducir el estado de tu cubo físico: «Colocar piezas» (noche 14)
En lugar de pintar pegatinas, puedes **colocar las piezas** de tu puzzle una a una, como si lo montaras.
Funciona en todos los puzzles de WCA Puzzles salvo el Square-1 (2x2–7x7, Pyraminx, Skewb, Megaminx, FTO) y en
Bandaged Cubes (3x3, 4x4 y 5x5, con sus bloques). En el 4x4 y el 5x5 vendados es la única forma de introducir
un estado a mano (pintar no puede saber qué centro es cuál).

1. Pulsa **Colocar piezas** (debajo del editor). El editor pasa a **pantalla completa**: arriba, lo que falta y
   2D / 3D; en medio, el puzzle **vacío** (huecos en gris); abajo, al alcance del pulgar, la **bandeja** con
   todo lo que hay que colocar —primero los bloques, si los hay, y luego las piezas sueltas por tipo
   (esquinas, aristas o wings, centros X, centros +…)— y la barra con *Deshacer*, *Vaciar* y *Aplicar y salir*.
   Las piezas que no pueden ir en otro sitio (los centros del 3x3, del 5x5 y del Megaminx) ya están puestas.
2. **Bloques** (vendados): elige un bloque en la bandeja y toca un hueco que vaya a ocupar. Aparece colocado
   en una posición que incluye ese hueco; **Girar** prueba las demás orientaciones que pasan por ese hueco y
   **Siguiente posición**, cualquier otra posición en la que el bloque entero quepa sin chocar con lo ya
   colocado. Las piezas de un bloque van siempre juntas: no aparecen sueltas en la bandeja.
3. **Piezas sueltas**: toca un hueco gris y elige en la lista la pieza que tiene tu cubo ahí (solo salen las
   que quedan y caben: en un hueco de esquina, esquinas). Mira los colores de tu pieza y pulsa **Girar** hasta
   que coincidan. Si solo queda una pieza posible para ese hueco, se coloca sola. También puedes elegir
   primero la pieza en la bandeja y luego tocar el hueco.
4. Para corregir: toca una pieza o bloque colocado y pulsa **Quitar** (vuelve a la bandeja), o *Deshacer*.
   Las piezas iguales (los cuatro centros blancos de un 4x4, por ejemplo) no hay que distinguirlas: la app
   elige cuál es cuál.
5. En cuanto está todo colocado, la app lo comprueba: **válido** (se puede llegar a ese estado desde el cubo
   resuelto), **imposible** (con el motivo: una esquina girada, dos piezas cambiadas, un bloque que no puede
   quedar así…) o **sin comprobar** (configuraciones enormes en las que no se ha podido decidir; deja
   intentar resolver). Con un estado válido, **Aplicar y salir** sale de la pantalla completa y deja el estado
   en el editor: pulsa *Resolver* y reproduce la solución como siempre. *Cancelar* (o Escape) sale sin cambiar nada.

Toques para introducir un estado mezclado (medidos con el test de ida y vuelta): ~52 en el 3x3, ~120 en el 4x4 y
~195 en el 5x5 (unos 45–50 en un 3x3 vendado con bloques: cada bloque se coloca de una vez).

### Modo aprender (2x2, 3x3, 4x4, 5x5, Pyraminx, Skewb y Square-1)
Para aprender a resolver el puzzle, no solo resolverlo. Encima de *Resolver* hay un selector **Solución**: *Solución óptima (por ordenador)* o *Aprender (método …)*.

| Puzzle | Métodos |
|---|---|
| 3x3 | **Principiantes (por capas)**: cruz blanca, esquinas blancas con R U R' U', segunda capa con los algoritmos de la derecha y la izquierda, y la última capa en cuatro pasos (F R U R' U' F', Sune, A-perm, U-perm). **CFOP**: cruz planificada entera, F2L por parejas, OLL (57 casos) y PLL (21 casos). |
| 2x2 | **Principiantes (por capas)**: una esquina blanca de referencia, la primera capa con R U R' U', la cara amarilla con Sune y las esquinas con la T-perm. **Ortega**: cara blanca, OLL (7 casos) y PBL (las dos capas a la vez). |
| 4x4 | **Reducción**: centro blanco, centro amarillo, los cuatro centros de los lados, emparejar las aristas, y el resto como un 3x3 (por capas o CFOP), con la **paridad OLL** y la **paridad PLL** cuando aparecen. |
| 5x5 | **Reducción**: cada centro en dos partes (primero la X y luego la cruz: blanco, amarillo y los cuatro de los lados), aristas de tres piezas (tredges, con la **paridad de aristas** del 5x5 cuando aparece) y el resto como un 3x3 (por capas o CFOP). |
| Pyraminx | **Principiantes**: puntas, centros, primera capa (las tres aristas de abajo) y última capa con dos algoritmos (ciclo de tres aristas y voltear dos aristas). |
| Skewb | **Principiantes**: primera capa (la de arriba, la de la esquina que no se mueve con R, U, L, B), esquinas de abajo con sledgehammers (R' B R B'…) y centros. |
| Square-1 | **Principiantes**: forma de cubo, orientar esquinas y aristas, permutar esquinas (y la capa del medio), **paridad** si hace falta y permutar aristas. |

Al resolver en modo aprender:
- La solución va dividida en **etapas con nombre** (barra de fases); el recuadro de explicación dice el **objetivo** de la etapa actual y lista sus pasos: qué consigue cada bloque de movimientos ("Lleva la arista blanca y roja abajo…", "Pareja 2: junta la esquina… con la arista…"), con el **nombre del algoritmo** cuando es uno conocido (*Sune*, *PLL T-perm*, *OLL 33*, *Paridad OLL*, *Sledgehammer*…; las 57 OLL llevan su número, comprobado contra dos referencias de la comunidad). Tocar un paso salta al final de ese paso.
- En la vista 3D (y en 2D) se **resaltan las piezas** con las que se trabaja en cada paso; las demás quedan atenuadas (en todos menos el Square-1).
- Arriba se muestra la **longitud total** del método frente a la de la **solución óptima** (por ejemplo, "Método CFOP: 56 giros (+ 4 giros del cubo entero) · solución óptima: 20 giros"). Las rotaciones del cubo entero (`x`, `y`, `z`) se cuentan aparte.
- Los nombres estándar (F2L, OLL, PLL, T-perm, Sune…) se dejan en inglés; las explicaciones, en español. Los algoritmos son los habituales de la comunidad; los casos de la última capa (y lo que hace cada PLL) se describen a partir del estado real, no de una tabla.

Longitudes medias (500 casos por método): 3x3 por capas ~145 giros y CFOP ~56; 2x2 por capas ~70 y Ortega ~23; 4x4 por reducción ~270 (por capas) y ~183 (CFOP); 5x5 ~424 y ~337; Pyraminx ~26; Skewb ~22; Square-1 ~60 movimientos. Aún no hay modo aprender en 6x6, 7x7, Megaminx ni FTO.

### 3x3, 4x4 y 5x5 vendados (sección *Bandaged Cubes*)
En **Bandaged Cubes** (`#/bandaged`) eliges el cubo (3x3, 4x4 o 5x5) y, encima del scramble y del solucionador, está **Tus bloques** (en WCA Puzzles los cubos son siempre los normales):
1. *Nuevo bloque* y toca las piezas del cubo (en 2D o en 3D) que quieres pegar; vuelve a tocar una pieza para quitarla. Puedes crear varios bloques (cada uno con su color), editarlos y borrarlos. Los bloques se definen sobre el cubo resuelto y sus piezas tienen que ser vecinas (unidas por caras); un bloque imposible (con piezas que no son vecinas) se avisa al momento; dos centros opuestos sí se pueden unir, como en el Bandaged Cube de Meffert.
2. *Aplicar*: la app analiza la configuración en segundo plano y dice qué giros se pueden hacer con el cubo resuelto, cuántas **geometrías** (formas sin mirar los colores) y cuántos **estados** son alcanzables, y avisa si el cubo queda muy limitado o totalmente bloqueado.
3. Desde ese momento el scramble y la solución solo usan giros legales. Si el espacio es pequeño (hasta 2 millones de estados), el scramble es un estado aleatorio uniforme y la solución, óptima; si es grande, el scramble son giros legales al azar y la solución la mejor de dos estrategias: **A** (búsqueda directa) y **B** (primero la geometría, como la forma del Square-1, y luego las piezas). El resumen dice qué estrategia ganó, cuántos movimientos tiene cada fase y cuántos haría falta sin bloqueos; en la reproducción, la barra de fases marca *Geometría* y *Permutación*.
- **4x4 y 5x5** (noche 13): la URL lleva el cubo (`#/bandaged?puzzle=4x4&bloqueos=…`; sin `puzzle`, el 3x3). Las piezas se llaman `UFR`, `UF1`/`UF2` (wings, de izquierda a derecha), `UF` (arista central del 5x5), `U11`… (centros por fila y columna) y `U` (centro fijo del 5x5); el núcleo del 5x5 está unido a los seis centros fijos, así que se pueden pegar centros opuestos a través de él. Como hay centros del mismo color, el cubo lleva en el estado qué centro es cuál, y **no se puede pintar un estado a mano** (con colores no se sabría cuál es cuál): se mezcla con el scramble. El análisis cuenta los **estados distinguibles** (los centros iguales se cuentan una vez). En espacio grande la solución es larga (cientos de giros) y tarda unos segundos en preparar las tablas.
- *Cargar* tiene ejemplos (pareja, centro + arista, 1x2x2, 1x2x3, 2x2x2, cubos clásicos como el Bicube, el Bandaged Cube de Meffert o el CAB Cube; en el 4x4 y el 5x5, pareja, barra, bloque de centros, varios bloques y centros opuestos) y tus configuraciones guardadas. En *Guardar, compartir e importar*: guardar en el navegador, **copiar un enlace** que abre Bandaged Cubes con esos bloques (`#/bandaged?bloqueos=…`; los enlaces antiguos `#bloqueos=…` y `?firma=…` siguen funcionando), y la **firma** de la comunidad (Bandaged Cube Explorer, hexadecimal) para importar o exportar.
- En 3D, las piezas pegadas se dibujan unidas, sin la separación negra.
- La notación es la de la WCA; también se aceptan M, E, S y las rotaciones x, y, z (las soluciones usan solo giros de cara).

### Cuboids: 3x3x1 (Floppy), 3x3x2 (Domino) y 2x2x3 (Tower) (noche 15)
- **Cómo se sujetan**: las caras cuadradas arriba y abajo (U blanco, D amarillo), F verde delante, R rojo a la derecha, B azul y L naranja: el esquema del cubo. En el 3x3x1 «arriba» es la cara grande de 3x3; en el 3x3x2, las dos caras de 3x3; en el 2x2x3, las dos de 2x2 (la torre de pie). Puedes pintarlo o colocar las piezas sujetándolo de cualquier forma: la solución sale para como lo tengas.
- **Notación** (la de csTimer y Jaap's Puzzle Page): las caras que no son cuadradas solo giran media vuelta.
  - 3x3x1: `R`, `L`, `F`, `B` = media vuelta de ese lado (no hay U ni D: girar la cara grande es girar el puzzle entero). Se acepta también `R2`.
  - 3x3x2: `U`, `U'`, `U2` (y `D`…) = cuarto o media vuelta de la capa de arriba (abajo) en sentido horario mirándola; `R2`, `L2`, `F2`, `B2` = media vuelta de un lado. Se acepta `R` como `R2`. Los scrambles y las soluciones usan `U` y los lados (como csTimer): `D` es lo mismo que `U` y girar el puzzle.
  - 2x2x3: `U`, `D` (90° o 180°) y `R2`, `F2` (180°). Con estos cuatro la arista del medio de atrás a la izquierda (BL) no se mueve: es la referencia; `L2` y `B2` se aceptan.
  - Rotaciones del puzzle entero: `y` (90°) y `x2`, `z2` (solo las que conservan la forma).
- **Solución óptima** (cada giro cuenta 1: `U2` y `R2` también): 3x3x1 como mucho 8 giros (4,4 de media), 3x3x2 como mucho 18 (13,3), 2x2x3 como mucho 14 (9,7). Tablas en el navegador: instantáneas en el 3x3x1 y el 2x2x3, ~1–1,5 s la primera vez en el 3x3x2.
- **Estados imposibles**: la app dice qué pieza falla: una esquina girada o una arista volteada (en estos puzzles la orientación de cada pieza la decide su posición; en el 3x3x1, las aristas se voltean pero nunca salen de su lado) o, en el 3x3x1, la paridad (dos esquinas intercambiadas exigen un número impar de aristas volteadas). En el 3x3x2 y el 2x2x3 cualquier permutación es posible.

### Vista 3D
- La vista previa del scramble y la reproducción de la solución se ven en **3D**, con los giros animados: arrastra con el ratón o el dedo para girar el puzzle (*Vista inicial* lo devuelve a su sitio). Los botones **2D / 3D** cambian entre el modelo 3D y la red plana.
- Bajo la vista previa hay un reproductor del scramble: ⇤ lo deja resuelto, ▶ lo aplica movimiento a movimiento (velocidad ×1…×8, pausa, paso atrás). En el Megaminx, al acabar, el puzzle gira entero hasta la orientación de referencia, como indica la nota.
- El editor de colores sigue siendo la red 2D, pero con **3D** también se puede pintar tocando el modelo.
- Si el navegador no tiene WebGL, todo sigue funcionando en 2D.

### Notación del FTO
La del Reglamento WCA 2027 (12f): se sujeta con cuatro caras a la vista y su vértice común hacia ti (U arriba, F abajo, L y R a los lados); detrás, B (vecina de U), D (de F), BR (de R) y BL (de L). Cada letra gira esa cara 120° en sentido horario mirándola; con `'`, antihorario. Colores por defecto de TNoodle: U blanco, F verde, R rojo, L morado, B azul, D amarillo, BR gris, BL naranja. El FTO no tiene ninguna pieza fija: puedes pintarlo en cualquier orientación.

### Notación del Megaminx
Los scrambles están en notación Pochmann (`R++`, `D--`, `U'`), como en la WCA: se empieza con el blanco arriba y el verde oscuro delante; `R++` = sujetar la cara de la izquierda y girar el resto 2/5 en sentido horario visto desde la derecha; `D++` = sujetar la de arriba y girar el resto visto desde abajo. Como estos movimientos giran casi todo el puzzle, al acabar los centros están en otro sitio: la vista previa se muestra con el blanco arriba y el verde delante, y debajo se indica cómo girar el puzzle para que coincida. Las soluciones usan notación de caras: **U** arriba; a su alrededor, en sentido horario, **F** (delante), **R**, **BR**, **BL**, **L**; **D** abajo y a su alrededor **DR** (debajo de F y R), **DBR**, **B** (detrás, opuesta a F), **DBL**, **DL**. `R` = 72° en sentido horario mirando la cara R, `R'` = 72° antihorario, `R2` = 144° horario, `R2'` = 144° antihorario; cada giro cuenta 1. La app tiene una leyenda con la red y la letra de cada cara, y durante la reproducción muestra las letras en los centros.

Funciona sin conexión: todo se calcula en el navegador (también la vista 3D, que no usa ninguna librería externa) y las fuentes van incrustadas.

## Uso local

Abre `dist/index.html` en el navegador (doble clic). Para regenerarlo:

```
npm install
npm run build
```

## Publicación

`.github/workflows/pages.yml` construye `dist/index.html` en cada push a `main` y lo publica en GitHub Pages como `index.html` (requiere *Settings → Pages → Source: GitHub Actions*).

## Tests

Tres niveles (tiempos con 2 núcleos), más la comprobación de tipos:

```
npm run tipos         # < 1 s: TypeScript (tsc --noEmit) comprueba los ficheros con // @ts-check contra src/core/tipos.d.ts
npm run test:humo     # ~3 min: tipos, humo de cada puzzle, registro, diseño (rutas y contraste) y humo de la app (sin Worker, con Worker,
                      # navegación entre secciones, tema, enlaces antiguos, recorrido completo en WCA y Bandaged, «Colocar piezas» y Cuboids)
npm run test:rapido   # ~8 min 20 s: las mismas comprobaciones que npm test, con menos casos en los tests caros
npm test              # suite completa (1000 casos por puzzle; 500 en 4x4, 5x5, Megaminx, el modo aprender
                      # y cada configuración vendada; 100 en 6x6 y 7x7); ~1 h
npm run bench         # benchmark de los solvers (N=200 npm run bench para más casos)
node --max-old-space-size=4096 scripts/bfs-cuboide.mjs   # BFS completo del 3x3x2 (406 M posiciones, unos minutos): número de Dios y distribución
```

- **`test:humo`** es el paso de "Antes de empezar" de cada noche: para cada puzzle del registro, scrambles, validador (rechaza una pegatina pintada de otro color) y solver con 1–3 casos; el 3x3 vendado (un espacio grande y uno pequeño); un caso de cada método del modo aprender; las **huellas de los giros** (`tests/huellas.json`: el estado tras cada giro básico y tras una secuencia fija; es lo que detecta un giro invertido) y la prueba de humo de la app. Si se cambia un giro a propósito: `HUELLAS=actualizar npm run test:humo` y revisar el diff de `tests/huellas.json`.
- **`test:solo`**: solo los tests de unas áreas, al nivel rápido, mientras se trabaja:

  ```
  npm run test:solo -- skewb aprender
  npm run test:solo -- 4x4          # el fichero de cubos grandes solo con el 4x4 (TAMANOS=4)
  ```

  Áreas: `2x2`, `3x3`, `4x4`–`7x7`, `nxn`, `diseno` (o `tema`), `pyraminx`, `skewb`, `square1` (o `sq1`), `megaminx`, `fto`, `cuboides` (o `cuboids`), `vendado` (o `bloqueos`), `colocar`, `aprender`, `3d`, `app`, `humo`, `registro`. Cada área ejecuta sus ficheros enteros y, en los compartidos (humo, aprender, vista 3D, registro), los tests cuyo nombre la menciona.
- Variables: `HILOS=n` (hilos de los tests largos), `CASOS_NXN`, `CASOS_MEGA`, `CASOS_BLOQUEOS`, `CASOS_APRENDER` (casos de esos tests), `TAMANOS=4,5` (cubos grandes), `BLOQUEOS=pareja,cab` (configuraciones vendadas).
- **Ningún test depende de la velocidad de la máquina** (sesión de mantenimiento, 27/11/2026): las esperas de la app cuentan vueltas en las que la app no hace nada (no milisegundos de reloj), los scrambles del 3x3 tienen presupuesto en nodos, los tests de bloqueos no cortan la búsqueda a los 30 s y hay tests con un «reloj de máquina lenta» (`conRelojLento` en `tests/util.mjs`). Ver DECISIONES.md.
- Los resultados (porcentajes, longitudes, tiempos) de `npm test` se guardan en `tests/resultados/`; los de los niveles con menos casos van a `tests/.resultados-parciales/` (ignorado por git), para no pisar los de la suite completa (`GUARDAR=1` lo fuerza).

- **`npm run tipos`**: el código es JavaScript; TypeScript solo comprueba los tipos (no genera nada ni cambia lo que se ejecuta). Los contratos (interfaz de un puzzle, bloqueos, modo aprender, vista 3D, secciones, mensajes con el Worker) están en `src/core/tipos.d.ts`; qué ficheros se comprueban y cómo tipar un puzzle nuevo, en ARQUITECTURA.md («Tipos»).

**En GitHub**: `.github/workflows/tests.yml` ejecuta `npm run tipos` y `npm run test:rapido` en cada push a `main` y en cada pull request, aparte de la publicación en Pages (que no espera a los tests). El resultado se ve en la pestaña **Actions** del repositorio → *Tests (rápido)*, o en el icono ✔/✘ junto a cada commit (en la portada y en *Commits*); al pulsarlo se ve el registro de la ejecución.

## Documentación

- `ARQUITECTURA.md`: interfaz común de los puzzles y cómo añadir uno nuevo.
- `DECISIONES.md`: decisiones tomadas durante el desarrollo.
- `ESTADO.md`: qué funciona, resultados de los tests y siguientes pasos.

## Comprobaciones en Chromium (opcionales)

Python + Playwright + Chrome (`CHROME=/ruta/al/navegador` si no está en `/usr/bin/google-chrome`), después de `npm run build`:

```
python3 scripts/comprobar-diseno.py          # portada, WCA y Bandaged; escritorio/móvil; oscuro/claro; sin red
python3 scripts/comprobar-bloqueos.py        # cubo vendado (2D y 3D); "nxn": solo 4x4 y 5x5 (escritorio/móvil, oscuro/claro)
python3 scripts/comprobar-3d.py              # vista 3D
python3 scripts/comprobar-aprender.py        # modo aprender
python3 scripts/comprobar-cambios.py         # cambios rápidos de puzzle
python3 scripts/comprobar-primer-resolver.py # un clic en Resolver nada más cargar
python3 scripts/comprobar-fto.py             # FTO: tiempos (CPU ×4) y recorrido completo en 4 modos
python3 scripts/comprobar-colocar.py         # «Colocar piezas» en pantalla completa: WCA y Bandaged 3x3/4x4, escritorio/móvil, oscuro/claro, 2D/3D
PUZZLES=cuboids python3 scripts/comprobar-colocar.py  # «Colocar piezas» en los tres cuboides, las 8 combinaciones
python3 scripts/comprobar-cuboides.py        # Cuboids: portada → cada cuboide → scramble → resolver → reproducir (8 combinaciones)
```

**Capturas**: los scripts las escriben en `docs/capturas/` (se sobrescriben en cada ejecución). Esa carpeta
**no se sube al repositorio** (está en `.gitignore`): las capturas pesaban el 90 % del historial. Para tener las
de una versión sin instalar nada: pestaña **Actions** → *Capturas (Chromium)* → *Run workflow* (se eligen los
scripts; por defecto `diseno colocar`) → al terminar, en la ejecución, *Artifacts* → `capturas` (zip, se guarda
30 días). Si una captura hace falta en la documentación, se enlaza el artifact o se añade a propósito, una sola.
