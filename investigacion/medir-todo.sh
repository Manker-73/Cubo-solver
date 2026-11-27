#!/bin/sh
# Todas las mediciones del informe (≈ 45 min): node investigacion/prototipos.mjs && sh investigacion/medir-todo.sh
set -e
cd "$(dirname "$0")/.."
R=investigacion/resultados
mkdir -p $R
for v in base a b c abc d; do
  python investigacion/medir-carga.py --dir investigacion/dist/$v --reps ${REPS:-5} --traza --etiqueta $v --salida $R/carga-$v.json
done
# e1: abc servido con brotli (otro alojamiento: GitHub Pages solo da gzip)
python investigacion/medir-carga.py --dir investigacion/dist/abc --reps ${REPS:-5} --comp brotli --etiqueta abc-brotli --salida $R/carga-abc-brotli.json
