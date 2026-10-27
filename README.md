# Cubo Solver

Generador de scrambles WCA, validador de estado y solucionador visual de puzzles.
Aplicación web en un único HTML, sin servidor.

- **Scrambles**: 2x2 a 7x7, Square-1, Skewb, Pyraminx y Megaminx (estado aleatorio en 2x2, 3x3, Pyraminx, Skewb y Square-1).
- **Validador y solucionador**: 2x2 (óptimo), 3x3 (dos fases de Kociemba), Pyraminx (óptimo), Skewb (óptimo) y Square-1 (dos fases: forma de cubo y permutación, solo con giros posibles).
- Las tablas se generan en el navegador dentro de un Web Worker (la página no se bloquea); si no hay Worker, en el hilo principal.

## Uso

Abre `dist/index.html` en el navegador (doble clic). Para regenerarlo:

```
npm install
npm run build
```

## Tests

```
npm test            # 1000 casos por puzzle (unos minutos)
npm run test:rapido # 100 casos por puzzle
npm run bench       # benchmark de los solvers (N=200 npm run bench para más casos)
```

Los resultados (porcentajes, longitudes, tiempos) se guardan en `tests/resultados/`.

## Documentación

- `ARQUITECTURA.md`: interfaz común de los puzzles y cómo añadir uno nuevo.
- `DECISIONES.md`: decisiones tomadas durante el desarrollo.
- `ESTADO.md`: qué funciona, resultados de los tests y siguientes pasos.
