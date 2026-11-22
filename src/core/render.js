// Dibujo SVG genérico a partir de polígonos 2D de pegatinas.

/** Encoge un polígono 2D hacia su centroide (para dejar huecos entre pegatinas). */
export function encoger(poly, k) {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  cx /= poly.length; cy /= poly.length;
  return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

export function cajaDe(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of polys) for (const [x, y] of poly) {
    if (x < x0) x0 = x; if (y < y0) y0 = y;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * pegatinas: [{ poligono: [[x,y],...] }] (en coordenadas 2D)
 * colores: array (por pegatina) de índices de paleta (o -1 = vacío)
 * paleta: [{hex}]
 * opciones: { editable, fondos: [[poligono]] (contornos opcionales), margen, solo: [índices] }
 */
export function svgDePegatinas(pegatinas, colores, paleta, opciones = {}) {
  const margen = opciones.margen ?? 0.1;
  const fondos = opciones.fondos || [];
  const solo = opciones.solo || null; // dibujar solo estas pegatinas (índices globales)
  const lista = solo ? solo.map((i) => [pegatinas[i], i]) : pegatinas.map((p, i) => [p, i]);
  const caja = cajaDe(lista.map(([p]) => p.poligono).concat(fondos));
  const w = caja.x1 - caja.x0, h = caja.y1 - caja.y0;
  const m = Math.max(w, h) * margen * 0.5;
  const vb = [caja.x0 - m, caja.y0 - m, w + 2 * m, h + 2 * m].map(r2).join(' ');
  const trazo = Math.max(w, h) * 0.006 * (opciones.grosor ?? 1);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="puzzle-svg${opciones.editable ? ' editable' : ''}">`;
  for (const f of fondos) {
    s += `<polygon points="${f.map(([x, y]) => r2(x) + ',' + r2(y)).join(' ')}" fill="#1b1b1f" />`;
  }
  const expandir = opciones.expandir || null; // Map(i -> [{ dx, dy } por lado]) : piezas pegadas
  lista.forEach(([p, i]) => {
    const c = colores[i];
    const color = c >= 0 && paleta[c] ? paleta[c].hex : '#3a3a40';
    let poli = p.poligono;
    const ex = expandir && expandir.get(i);
    if (ex) {
      poli = poli.map(([x, y]) => [x, y]);
      ex.forEach((d, k) => {
        if (!d) return;
        for (const v of [k, (k + 1) % poli.length]) { poli[v][0] += d.dx; poli[v][1] += d.dy; }
      });
    }
    const pts = poli.map(([x, y]) => r2(x) + ',' + r2(y)).join(' ');
    const editable = opciones.editable && (!opciones.editables || opciones.editables.has(i));
    const marca = opciones.marcas && opciones.marcas.get(i); // color del contorno (bloques en edición)
    const trazoP = marca ? `stroke="${marca}" stroke-width="${r2(trazo * 3)}"` : `stroke="#111" stroke-width="${r2(trazo)}"`;
    s += `<polygon points="${pts}" fill="${color}" ${trazoP} stroke-linejoin="round" data-i="${i}"${editable ? ' class="pegatina"' : ''}/>`;
  });
  s += '</svg>';
  return s;
}
