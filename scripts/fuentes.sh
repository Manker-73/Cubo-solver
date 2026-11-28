#!/bin/sh
# Regenera los subconjuntos de fuentes de src/app/fuentes/ (opcional: ya están en el repositorio).
# Necesita npm y Python con fonttools y brotli:  pip install fonttools brotli
#
# Caracteres (sesión «carga más rápida», 27/11/2026): ASCII, el espacio duro, el español en las dos cajas (hay un
# text-transform: uppercase) y los signos que usa la interfaz: ¡¿«»·×°ºª±²³¹, rayas, comillas, •, …, ′ (prima), −
# y las flechas de los reproductores. Antes iba todo Latin-1; el resto de Latin-1 no aparece en ningún texto (ni
# en el código: scripts/comprobar-fuentes.py inventario lo comprueba en pantalla). Lo que no esté en el
# subconjunto (fórmulas, ↺ ↻ ▶…) lo dibuja la fuente del sistema, como antes.
# Pesos: la app solo usa Inter 400, 500 y 600, Bricolage Grotesque 800 y JetBrains Mono 500 (inventario). Bricolage
# y JetBrains ya eran un fichero de un peso. Inter es variable (100–900) y se deja ENTERA: limitar el eje a 400–600
# (fontTools.varLib.instancer wght=400:600) la dejaba en 20 KB en vez de 29 KB, pero recalcula las variaciones con
# redondeo y el suavizado de algunas letras cambiaba (unos 150 píxeles por pantalla, sin que se note a la vista);
# se pidió el mismo aspecto píxel a píxel (scripts/comprobar-fuentes.py comparar).
set -e
U="U+0020-007E,U+00A0-00A1,U+00AA-00AB,U+00B0-00B3,U+00B7,U+00B9-00BB,U+00BF,U+00C1,U+00C9,U+00CD,U+00D1,U+00D3,U+00D7,U+00DA,U+00DC,U+00E1,U+00E9,U+00ED,U+00F1,U+00F3,U+00FA,U+00FC,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2032,U+2190-2193,U+21E4-21E5,U+2212"
raiz=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
cd "$tmp"
npm pack --silent @fontsource-variable/inter@5.3.0 @fontsource/bricolage-grotesque@5.3.0 @fontsource/jetbrains-mono@5.3.0 >/dev/null
for f in *.tgz; do mkdir -p "${f%.tgz}"; tar xzf "$f" -C "${f%.tgz}"; done
out="${SALIDA:-$raiz/src/app/fuentes}"   # SALIDA=dir para generarlas en otro sitio
python -m fontTools.subset fontsource-variable-inter-5.3.0/package/files/inter-latin-wght-normal.woff2 --unicodes="$U" --flavor=woff2 --layout-features='kern,liga,calt,tnum' --output-file="$out/inter.woff2"
python -m fontTools.subset fontsource-bricolage-grotesque-5.3.0/package/files/bricolage-grotesque-latin-800-normal.woff2 --unicodes="$U" --flavor=woff2 --layout-features='kern,liga' --output-file="$out/bricolage-grotesque-800.woff2"
python -m fontTools.subset fontsource-jetbrains-mono-5.3.0/package/files/jetbrains-mono-latin-500-normal.woff2 --unicodes="$U" --flavor=woff2 --layout-features='kern' --output-file="$out/jetbrains-mono-500.woff2"
ls -l "$out"/*.woff2
rm -rf "$tmp"
