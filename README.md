# Cubo Solver

Generador de scrambles WCA, validador de estado y solucionador visual de puzzles.
Aplicación web en un único HTML, sin servidor.

- **Scrambles**: 2x2 a 7x7, Square-1, Skewb, Pyraminx y Megaminx (estado aleatorio en 2x2, 3x3, Pyraminx, Skewb y Square-1).
- **Validador y solucionador**: 2x2 (óptimo), 3x3 (dos fases de Kociemba), 4x4 (reducción en tres fases de búsqueda, sin paridades OLL ni PLL, ~55 movimientos) y 5x5 a 7x7 (reducción con búsqueda por etapas en los centros y conmutadores en el resto), Pyraminx (óptimo), Skewb (óptimo) y Square-1 (dos fases: forma de cubo y permutación, solo con giros posibles).
- Las tablas se generan en el navegador dentro de un Web Worker (la página no se bloquea); si no hay Worker, en el hilo principal.

**App en línea: https://manker-73.github.io/Cubo-solver/**

## Cómo usarla

1. Elige el puzzle en la barra superior (2x2 … 7x7, Pyraminx, Skewb, Square-1, Megaminx).
2. **Scramble**: pulsa *Nuevo scramble*; *Copiar* lo copia al portapapeles. La primera vez en cada puzzle se generan sus tablas en segundo plano (unos segundos; hasta ~8 s en el 7x7).
3. **Resolver** (todos menos Megaminx): pinta el estado de tu puzzle eligiendo un color de la paleta y tocando las pegatinas (o pulsa *Cargar scramble actual*) y luego *Resolver*. Si el estado es imposible, la app dice qué pieza falla. Resolver un 4x4–7x7 tarda 1–4 s de media y un 6x6 o 7x7 puede tardar varios segundos más (hasta ~12 s en el peor caso medido).
4. Recorre la solución con los botones de reproducción (paso a paso, play y velocidad); *Copiar* copia los movimientos.

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
npm test            # 1000 casos por puzzle (500 en 4x4 y 5x5, 100 en 6x6 y 7x7); ~45 min
npm run test:rapido # 100 casos por puzzle (20 en 4x4–7x7); ~6 min
npm run bench       # benchmark de los solvers (N=200 npm run bench para más casos)
```

Los resultados (porcentajes, longitudes, tiempos) se guardan en `tests/resultados/`.

## Documentación

- `ARQUITECTURA.md`: interfaz común de los puzzles y cómo añadir uno nuevo.
- `DECISIONES.md`: decisiones tomadas durante el desarrollo.
- `ESTADO.md`: qué funciona, resultados de los tests y siguientes pasos.
