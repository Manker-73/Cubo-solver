# Cubo Solver

Generador de scrambles WCA, validador de estado y solucionador visual de puzzles.
Aplicación web en un único HTML, sin servidor.

- **Scrambles**: 2x2 a 7x7, Square-1, Skewb, Pyraminx y Megaminx (estado aleatorio en 2x2, 3x3, Pyraminx y Skewb).
- **Validador y solucionador**: 2x2 (óptimo), 3x3 (dos fases de Kociemba), Pyraminx (óptimo) y Skewb (óptimo).

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
```

Los resultados (porcentajes, longitudes, tiempos) se guardan en `tests/resultados/`.

## Documentación

- `ARQUITECTURA.md`: interfaz común de los puzzles y cómo añadir uno nuevo.
- `DECISIONES.md`: decisiones tomadas durante el desarrollo.
- `ESTADO.md`: qué funciona, resultados de los tests y siguientes pasos.
