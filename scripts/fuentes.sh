#!/bin/sh
# Regenera los subconjuntos de fuentes de src/app/fuentes/ (opcional: ya están en el repositorio).
# Necesita npm y Python con fonttools y brotli:  pip install fonttools brotli
# Caracteres: ASCII, Latin-1 (tildes, ñ, ¿¡, ·, ×), rayas, comillas, …, ′ (prima) y las flechas
# de los reproductores. Lo que no esté en el subconjunto lo dibuja la fuente del sistema.
set -e
U="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2032,U+2190-2193,U+21E4-21E5,U+2212"
raiz=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
cd "$tmp"
npm pack --silent @fontsource-variable/inter@5.3.0 @fontsource/bricolage-grotesque@5.3.0 @fontsource/jetbrains-mono@5.3.0 >/dev/null
for f in *.tgz; do mkdir -p "${f%.tgz}"; tar xzf "$f" -C "${f%.tgz}"; done
out="$raiz/src/app/fuentes"
pyftsubset fontsource-variable-inter-5.3.0/package/files/inter-latin-wght-normal.woff2 --unicodes="$U" --flavor=woff2 --layout-features='kern,liga,calt,tnum' --output-file="$out/inter.woff2"
pyftsubset fontsource-bricolage-grotesque-5.3.0/package/files/bricolage-grotesque-latin-800-normal.woff2 --unicodes="$U" --flavor=woff2 --layout-features='kern,liga' --output-file="$out/bricolage-grotesque-800.woff2"
pyftsubset fontsource-jetbrains-mono-5.3.0/package/files/jetbrains-mono-latin-500-normal.woff2 --unicodes="$U" --flavor=woff2 --layout-features='kern' --output-file="$out/jetbrains-mono-500.woff2"
ls -l "$out"/*.woff2
rm -rf "$tmp"
