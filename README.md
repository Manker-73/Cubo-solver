# Cubo Solver

Generador de scrambles WCA, validador de estado y solucionador visual de puzzles.
Aplicación web en un único HTML, sin servidor.

- **Scrambles**: 2x2 a 7x7, Square-1, Skewb, Pyraminx y Megaminx (estado aleatorio en 2x2, 3x3, Pyraminx, Skewb y Square-1).
- **Validador y solucionador en todos los puzzles**: 2x2 (óptimo), 3x3 (dos fases de Kociemba), 4x4 (reducción en tres fases de búsqueda, sin paridades OLL ni PLL, ~55 movimientos) y 5x5 a 7x7 (reducción con búsqueda por etapas en los centros y conmutadores en el resto), Pyraminx (óptimo), Skewb (óptimo), Square-1 (dos fases: forma de cubo y permutación, solo con giros posibles) y Megaminx (por etapas con búsqueda IDA* y la última capa con macros buscadas automáticamente; ~88 giros de cara de media).
- Las tablas se generan en el navegador dentro de un Web Worker (la página no se bloquea); si no hay Worker, en el hilo principal.

**App en línea: https://manker-73.github.io/Cubo-solver/**

## Cómo usarla

1. Elige el puzzle en la barra superior (2x2 … 7x7, Pyraminx, Skewb, Square-1, Megaminx).
2. **Scramble**: pulsa *Nuevo scramble*; *Copiar* lo copia al portapapeles. La primera vez en cada puzzle se generan sus tablas en segundo plano (unos segundos; hasta ~8 s en el 7x7).
3. **Resolver**: pinta el estado de tu puzzle eligiendo un color de la paleta y tocando las pegatinas (o pulsa *Cargar scramble actual*) y luego *Resolver*. Puedes sujetar el puzzle en cualquier orientación: la solución sale para como lo tengas. *Rellenar cara* (cubos grandes y Megaminx) pinta una cara entera de un toque y *Deshacer* (o Ctrl+Z) deshace el último cambio. Si el estado es imposible, la app dice qué pieza falla. Resolver un 4x4–7x7 tarda 1–4 s de media (hasta ~12 s en el peor caso medido en un 6x6 o 7x7); un Megaminx, unos 2,5–3 s (prueba muchas orientaciones y se queda con la solución más corta).
4. Recorre la solución con los botones de reproducción (paso a paso, play y velocidad); *Copiar* copia los movimientos. En los puzzles con etapas (cubos grandes, Megaminx) la barra de fases muestra en qué etapa está cada tramo.

### Notación del Megaminx
Los scrambles están en notación Pochmann (`R++`, `D--`, `U'`), como en la WCA. Las soluciones usan notación de caras: **U** arriba; a su alrededor, en sentido horario, **F** (delante), **R**, **BR**, **BL**, **L**; **D** abajo y a su alrededor **DR** (debajo de F y R), **DBR**, **B** (detrás, opuesta a F), **DBL**, **DL**. `R` = 72° en sentido horario mirando la cara R, `R'` = 72° antihorario, `R2` = 144° horario, `R2'` = 144° antihorario; cada giro cuenta 1. La app tiene una leyenda con la red y la letra de cada cara, y durante la reproducción muestra las letras en los centros.

Funciona sin conexión una vez cargada: todo se calcula en el navegador.

## Uso local

Abre `dist/index.html` en el navegador (doble clic). Para regenerarlo:

```
npm install
npm run build
```

## Publicación

`.github/workflows/pages.yml` construye `dist/index.html` en cada push a `main` y lo publica en GitHub Pages como `index.html` (requiere *Settings → Pages → Source: GitHub Actions*).

## Tests

```
npm test            # 1000 casos por puzzle (500 en 4x4, 5x5 y Megaminx, 100 en 6x6 y 7x7); ~64 min
npm run test:rapido # 100 casos por puzzle (20 en 4x4–7x7 y Megaminx); ~7 min
npm run bench       # benchmark de los solvers (N=200 npm run bench para más casos)
```

Los resultados (porcentajes, longitudes, tiempos) se guardan en `tests/resultados/`.

## Documentación

- `ARQUITECTURA.md`: interfaz común de los puzzles y cómo añadir uno nuevo.
- `DECISIONES.md`: decisiones tomadas durante el desarrollo.
- `ESTADO.md`: qué funciona, resultados de los tests y siguientes pasos.
