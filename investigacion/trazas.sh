#!/bin/sh
# Solo las trazas (parseo, compilación, ejecución; mediana de 5): sh investigacion/trazas.sh
cd "$(dirname "$0")/.."
for v in base a b c abc d; do
  python investigacion/medir-carga.py --dir investigacion/dist/$v --traza --solo ninguna --etiqueta $v --salida investigacion/resultados/traza-$v.json
done
