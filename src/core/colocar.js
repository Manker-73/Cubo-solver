// @ts-check
// Colocar piezas (noche 14): introducir el estado de un puzzle físico pieza a pieza (y bloque a
// bloque en los vendados) en lugar de pintar pegatinas. Genérico: no sabe de cubos.
//
// Qué necesita del puzzle (`colocarPiezas` en la interfaz común):
//   generadores   giros que generan el grupo (en el 3x3, las 6 caras: los centros quedan fijos);
//   nombreTipo    (opcional) nombre de cada tipo de pieza (esquinas, wings, centros X…).
// Y de la interfaz común: estadoResuelto, aplicarMovimiento (sobre un array de números: así se
// obtiene la permutación de las pegatinas de cada giro) y vista3D (qué pegatinas forman cada pieza).
//
// Modelo:
//  - Pieza = las pegatinas de una pieza del modelo 3D, en un orden fijo (su «tupla»). Hueco = el
//    sitio de una pieza en el resuelto (hueco k = casa de la pieza k).
//  - Dónde puede ir una pieza y con qué orientación = la ÓRBITA de su tupla con los generadores
//    (BFS de tuplas). Así salen solas las reglas del puzzle: los centros del 3x3 no se mueven, las
//    wings no se pueden voltear, en el Skewb hay dos órbitas de esquinas…
//  - Piezas que se ven igual (mismo tipo y mismos colores: los centros del 4x4, o las dos wings
//    blanco-verde, que solo se distinguen por su orientación) forman un GRUPO de la bandeja. El
//    usuario elige un grupo para un hueco y «Girar» recorre las disposiciones de colores distintas
//    que caben ahí; qué pieza concreta del grupo se usa lo decide esto (y, en los vendados con
//    centros iguales, el validador con `elegirIguales`).
//  - Bloque (vendados): sus piezas se colocan juntas. Sus colocaciones son las rotaciones rígidas
//    del puzzle entero (cada giro legal mueve un bloque entero con la rotación de su capa) en las
//    que cada pieza cae en su órbita. Solo se ofrecen las que caben sin chocar con lo ya colocado.
//
// El estado resultante (`estado()`) es del mismo tipo que el del puzzle: colores (o identidades en
// el 4x4/5x5 vendado), con −1 en los huecos vacíos. Se valida con el validador de siempre.

/** @import { Puzzle, EstadoPegatinas, Movimiento, MapaPuntos, ModeloColocar, PiezaColocar, TipoColocar, GrupoColocar, BloqueColocar, SesionColocar, ColocadaEnHueco, CandidatoHueco } from './tipos.js' */

/** @param {number[]} t */
const claveTupla = (t) => t.join(',');

/**
 * @param {Puzzle<EstadoPegatinas>} puzzle  el puzzle SIN bloques (los giros se aplican tal cual)
 * @param {{ bloques?: Array<{ nombre: string, pegatinas: number[] }>, rotaciones?: MapaPuntos[] }} [opciones]
 *   bloques: pegatinas de cada bloque en el resuelto; rotaciones: mapas de las rotaciones del
 *   puzzle entero (los del soporte de bloqueos; solo se usan sus pegatinas).
 * @returns {ModeloColocar}
 */
export function crearModeloColocar(puzzle, opciones = {}) {
  const cp = puzzle.colocarPiezas;
  if (!cp || !puzzle.vista3D) throw new Error(`${puzzle.nombre}: no se pueden colocar piezas.`);
  const resuelto = puzzle.estadoResuelto();
  const n = resuelto.length;
  // permutación de las pegatinas de cada generador: destino[i] = adónde va la pegatina i
  const ident = Array.from({ length: n }, (_, i) => i);
  const perms = cp.generadores.map((m) => {
    const r = puzzle.aplicarMovimiento(ident.slice(), m);
    const destino = new Int16Array(n);
    r.forEach((origen, j) => { destino[origen] = j; });
    return destino;
  });
  // piezas: pegatinas agrupadas por la pieza del modelo 3D; colores del resuelto
  const v = puzzle.vista3D(resuelto);
  const color = new Int16Array(n).fill(-1);
  /** @type {Map<string, number[]>} */
  const porPieza = new Map();
  v.geometria.pegatinas.forEach((q, k) => {
    if (q.indice == null) return;
    color[q.indice] = v.colores[k];
    const clave = String(q.pieza);
    if (!porPieza.has(clave)) porPieza.set(clave, []);
    /** @type {number[]} */ (porPieza.get(clave)).push(q.indice);
  });
  const tuplas = [...porPieza.values()];
  const huecoDePegatina = new Int16Array(n).fill(-1);
  tuplas.forEach((t, k) => t.forEach((i) => { huecoDePegatina[i] = k; }));
  // órbita de cada pieza: hueco -> tuplas (posiciones de sus pegatinas, en el orden de la pieza)
  /** @type {Array<Map<number, number[][]>>} */
  const orbitas = tuplas.map((t) => {
    /** @type {Map<number, number[][]>} */
    const porHueco = new Map();
    const vistos = new Set([claveTupla(t)]);
    const cola = [t];
    while (cola.length) {
      const u = /** @type {number[]} */ (cola.pop());
      const h = huecoDePegatina[u[0]];
      if (!porHueco.has(h)) porHueco.set(h, []);
      /** @type {number[][]} */ (porHueco.get(h)).push(u);
      for (const P of perms) {
        const w = u.map((i) => P[i]);
        const k = claveTupla(w);
        if (!vistos.has(k)) { vistos.add(k); cola.push(w); }
      }
    }
    // orden estable: por hueco y, dentro, la tupla de la casa primero y luego por clave
    for (const l of porHueco.values()) l.sort((a, b) => (claveTupla(a) < claveTupla(b) ? -1 : 1));
    const casa = porHueco.get(huecoDePegatina[t[0]]);
    if (casa) { const i = casa.findIndex((u) => claveTupla(u) === claveTupla(t)); casa.unshift(...casa.splice(i, 1)); }
    return porHueco;
  });
  // tipos: piezas con las mismas casas posibles (las que giran en su sitio, juntas por tamaño)
  /** @type {Map<string, number[]>} */
  const porTipo = new Map();
  tuplas.forEach((t, k) => {
    const casas = [...orbitas[k].keys()].sort((a, b) => a - b);
    const clave = casas.length === 1 ? `fija:${t.length}` : `${t.length}:${casas.join(',')}`;
    if (!porTipo.has(clave)) porTipo.set(clave, []);
    /** @type {number[]} */ (porTipo.get(clave)).push(k);
  });
  const clavesTipo = [...porTipo.keys()].sort((a, b) => {
    const pa = /** @type {number[]} */ (porTipo.get(a)), pb = /** @type {number[]} */ (porTipo.get(b));
    const fa = a.startsWith('fija') ? 1 : 0, fb = b.startsWith('fija') ? 1 : 0;
    return fa - fb || tuplas[pb[0]].length - tuplas[pa[0]].length || orbitas[pa[0]].size - orbitas[pb[0]].size || pa[0] - pb[0];
  });
  /** @type {TipoColocar[]} */
  const tipos = clavesTipo.map((clave, id) => {
    const piezas = /** @type {number[]} */ (porTipo.get(clave));
    const t = tuplas[piezas[0]];
    const fija = clave.startsWith('fija');
    const propio = cp.nombreTipo ? cp.nombreTipo(t) : null;
    // una pieza fija con nombre propio que no lo dice (la esquina DBL del 2x2): «Esquinas (fija)»
    /** @type {[string, string]} */
    const nombres = propio ? (fija && !/fij|sitio|Puntas/.test(propio[0]) ? [propio[0] + ' (fija)', propio[1]] : propio) : nombreGenerico(t.length, fija);
    return { id, nombre: nombres[0], singular: nombres[1], piezas, fija };
  });
  // nombres repetidos (dos órbitas del mismo tamaño sin nombre propio): se numeran
  /** @type {Map<string, number>} */
  const vecesNombre = new Map();
  for (const t of tipos) vecesNombre.set(t.nombre, (vecesNombre.get(t.nombre) || 0) + 1);
  /** @type {Map<string, number>} */
  const numero = new Map();
  for (const t of tipos) {
    if (/** @type {number} */ (vecesNombre.get(t.nombre)) > 1) {
      const k = (numero.get(t.nombre) || 0) + 1;
      numero.set(t.nombre, k);
      t.nombre += ` (${k})`;
    }
  }
  const tipoDe = new Int16Array(tuplas.length);
  tipos.forEach((t) => t.piezas.forEach((k) => { tipoDe[k] = t.id; }));
  const nombreColor = (/** @type {number} */ c) => (puzzle.paleta[c] ? puzzle.paleta[c].nombre.toLowerCase() : '?');
  // bloques
  const bloqueDe = new Int16Array(tuplas.length).fill(-1);
  const bloquesDef = opciones.bloques || [];
  bloquesDef.forEach((b, bi) => {
    const s = new Set(b.pegatinas);
    tuplas.forEach((t, k) => { if (t.some((i) => s.has(i))) bloqueDe[k] = bi; });
  });
  /** @type {PiezaColocar[]} */
  const piezas = tuplas.map((t, k) => ({
    id: k,
    tipo: tipoDe[k],
    pegatinas: t,
    valores: t.map((i) => resuelto[i]),
    colores: t.map((i) => color[i]),
    grupo: -1,
    bloque: bloqueDe[k],
    nombre: `${tipos[tipoDe[k]].singular} ${t.map((i) => nombreColor(color[i])).join('-')}`,
  }));
  // grupos de la bandeja: piezas sueltas del mismo tipo y los mismos colores
  /** @type {GrupoColocar[]} */
  const grupos = [];
  /** @type {Map<string, number>} */
  const grupoPorClave = new Map();
  for (const t of tipos) {
    for (const k of t.piezas) {
      const pz = piezas[k];
      if (pz.bloque >= 0) continue;
      const clave = t.id + ':' + pz.colores.slice().sort((a, b) => a - b).join(',');
      let g = grupoPorClave.get(clave);
      if (g === undefined) {
        g = grupos.length;
        grupoPorClave.set(clave, g);
        grupos.push({ id: g, tipo: t.id, piezas: [], colores: pz.colores.slice(), nombre: pz.nombre });
      }
      grupos[g].piezas.push(k);
      pz.grupo = g;
    }
  }
  // colocaciones de cada bloque: rotaciones rígidas en las que cada pieza cae en su órbita
  const rotaciones = opciones.rotaciones || [];
  /** @type {BloqueColocar[]} */
  const bloques = bloquesDef.map((b, bi) => {
    const suyas = piezas.filter((pz) => pz.bloque === bi).map((pz) => pz.id);
    /** @type {Array<{ tuplas: number[][], huecos: number[] }>} */
    const colocaciones = [];
    const vistas = new Set();
    // la del resuelto primero (rotación identidad), luego las demás en el orden del soporte
    const mapas = [null, ...rotaciones];
    for (const Q of mapas) {
      const ts = suyas.map((k) => (Q ? tuplas[k].map((i) => Q[i]) : tuplas[k].slice()));
      if (ts.some((t) => t.some((i) => i < 0 || i >= n))) continue;
      const ok = ts.every((t, j) => {
        const l = orbitas[suyas[j]].get(huecoDePegatina[t[0]]);
        return !!l && l.some((u) => claveTupla(u) === claveTupla(t));
      });
      if (!ok) continue;
      const clave = ts.map(claveTupla).join('|');
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      colocaciones.push({ tuplas: ts, huecos: ts.map((t) => huecoDePegatina[t[0]]) });
    }
    return { id: bi, nombre: b.nombre, piezas: suyas, colocaciones };
  });
  return {
    n, piezas, tipos, grupos, bloques, huecoDePegatina,
    /** Tuplas (posiciones de las pegatinas) con las que la pieza k cabe en el hueco h. */
    opciones: (k, h) => orbitas[k].get(h) || [],
    /** Pegatinas del hueco h. */
    pegatinasHueco: (h) => tuplas[h],
    tipoHueco: (h) => tipoDe[h],
    resuelto,
  };
}

/** @param {number} tam @param {boolean} fija @returns {[string, string]} */
function nombreGenerico(tam, fija) {
  if (tam === 1) return fija ? ['Centros fijos', 'centro'] : ['Centros', 'centro'];
  if (fija) return ['Piezas que giran en su sitio', 'pieza'];
  if (tam === 2) return ['Aristas', 'arista'];
  return ['Esquinas', 'esquina'];
}

/**
 * Sesión del editor: lo que el usuario ha colocado y las acciones (las mismas que hace la interfaz;
 * los tests de ida y vuelta las usan tal cual). Los errores se lanzan con un mensaje claro.
 * @param {ModeloColocar} M
 * @returns {SesionColocar}
 */
export function crearSesionColocar(M) {
  const nH = M.piezas.length;
  /** @type {Array<ColocadaEnHueco | null>} */
  let enHueco = new Array(nH).fill(null);
  /** hueco de cada pieza colocada (o −1). */
  let huecoDe = /** @type {Int16Array} */ (new Int16Array(nH).fill(-1));
  /** colocación elegida de cada bloque (índice en sus colocaciones, o −1) y su hueco de referencia. */
  let colBloque = /** @type {Int16Array} */ (new Int16Array(M.bloques.length).fill(-1));
  let ancla = /** @type {Int16Array} */ (new Int16Array(M.bloques.length).fill(-1));
  /** @type {Array<{ enHueco: Array<ColocadaEnHueco | null>, huecoDe: Int16Array, colBloque: Int16Array, ancla: Int16Array }>} */
  const historial = [];
  const guardar = () => {
    historial.push({ enHueco: enHueco.slice(), huecoDe: huecoDe.slice(), colBloque: colBloque.slice(), ancla: ancla.slice() });
    if (historial.length > 300) historial.shift();
  };
  const tipoNombre = (/** @type {number} */ h) => M.tipos[M.tipoHueco(h)].singular;

  /** Piezas del grupo g que no están colocadas. @param {number} g */
  const libresGrupo = (g) => M.grupos[g].piezas.filter((k) => huecoDe[k] < 0);

  /**
   * Disposiciones de colores distintas del grupo g en el hueco h (con las piezas libres del grupo
   * y la que ya esté en h, si es de g). Cada una: pieza y tupla. `conColocadas`: también las piezas
   * del grupo ya colocadas en otros huecos (Girar las intercambia: las dos wings blanco-verde se ven
   * igual y solo se distinguen por cómo quedan los colores).
   * @param {number} g @param {number} h @param {boolean} [conColocadas]
   */
  function disposiciones(g, h, conColocadas = false) {
    const act = enHueco[h];
    const piezas = conColocadas ? M.grupos[g].piezas.filter((k) => huecoDe[k] < 0 || huecoDe[k] === h || (enHueco[huecoDe[k]] || { bloque: 0 }).bloque < 0) : libresGrupo(g);
    if (!conColocadas && act && act.bloque < 0 && M.piezas[act.pieza].grupo === g) piezas.unshift(act.pieza);
    piezas.sort((a, b) => (huecoDe[a] === h ? -1 : 0) - (huecoDe[b] === h ? -1 : 0) || (huecoDe[a] >= 0 && huecoDe[a] !== h ? 1 : 0) - (huecoDe[b] >= 0 && huecoDe[b] !== h ? 1 : 0) || a - b);
    /** @type {Array<{ pieza: number, tupla: number[], clave: string }>} */
    const res = [];
    const vistas = new Set();
    for (const k of piezas) {
      for (const t of M.opciones(k, h)) {
        // clave = colores escritos en las pegatinas del hueco (ordenadas)
        const col = new Map(t.map((i, j) => [i, M.piezas[k].colores[j]]));
        const clave = M.pegatinasHueco(h).slice().sort((a, b) => a - b).map((i) => col.get(i)).join(',');
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        res.push({ pieza: k, tupla: t, clave });
      }
    }
    return res;
  }

  /** @param {number} h @param {number} pieza @param {number[]} tupla @param {number} bloque */
  function poner(h, pieza, tupla, bloque) {
    enHueco[h] = { pieza, tupla, bloque };
    huecoDe[pieza] = h;
  }
  /** @param {number} h */
  function sacar(h) {
    const c = enHueco[h];
    if (!c) return;
    huecoDe[c.pieza] = -1;
    enHueco[h] = null;
  }
  /** Huecos libres para el bloque b (los suyos cuentan como libres). @param {number} b @param {number} ci */
  function cabe(b, ci) {
    return M.bloques[b].colocaciones[ci].huecos.every((h) => { const c = enHueco[h]; return !c || c.bloque === b; });
  }
  /** @param {number} b */
  function quitarBloque(b) {
    if (colBloque[b] < 0) return;
    for (const h of M.bloques[b].colocaciones[colBloque[b]].huecos) sacar(h);
    colBloque[b] = -1;
  }
  /** @param {number} b @param {number} ci */
  function ponerBloque(b, ci) {
    quitarBloque(b);
    const c = M.bloques[b].colocaciones[ci];
    M.bloques[b].piezas.forEach((k, j) => poner(c.huecos[j], k, c.tuplas[j], b));
    colBloque[b] = ci;
  }
  /** Colocaciones del bloque b que caben y contienen el hueco h (todas si h < 0). @param {number} b @param {number} h */
  function colocacionesQueCaben(b, h) {
    /** @type {number[]} */
    const r = [];
    M.bloques[b].colocaciones.forEach((c, ci) => { if ((h < 0 || c.huecos.includes(h)) && cabe(b, ci)) r.push(ci); });
    return r;
  }

  /** @type {SesionColocar} */
  const S = {
    modelo: M,
    colocada: (h) => enHueco[h],
    /** Grupos que caben en el hueco h (vacío) y quedan por colocar. */
    candidatos(h) {
      /** @type {CandidatoHueco[]} */
      const r = [];
      if (enHueco[h]) return r;
      for (const g of M.grupos) {
        if (g.tipo !== M.tipoHueco(h)) continue;
        const d = disposiciones(g.id, h);
        if (d.length) r.push({ grupo: g.id, disposiciones: d.length, restantes: libresGrupo(g.id).length });
      }
      return r;
    },
    restantes: (g) => libresGrupo(g).length,
    colocar(h, g) {
      if (h < 0 || h >= nH) throw new Error('Ese hueco no existe.');
      if (enHueco[h]) throw new Error('Ese hueco ya tiene una pieza: quítala antes.');
      const grupo = M.grupos[g];
      if (!grupo) throw new Error('Esa pieza no existe.');
      if (grupo.tipo !== M.tipoHueco(h)) throw new Error(`La ${grupo.nombre} no cabe ahí: es un hueco de ${tipoNombre(h)}.`);
      if (!libresGrupo(g).length) throw new Error(`Ya no quedan piezas «${grupo.nombre}» por colocar.`);
      const d = disposiciones(g, h);
      if (!d.length) throw new Error(`La ${grupo.nombre} no puede ir en ese hueco.`);
      guardar();
      poner(h, d[0].pieza, d[0].tupla, -1);
    },
    disposiciones(h) {
      const c = enHueco[h];
      if (!c) return 0;
      if (c.bloque >= 0) return colocacionesQueCaben(c.bloque, ancla[c.bloque] >= 0 ? ancla[c.bloque] : h).length;
      return disposiciones(M.piezas[c.pieza].grupo, h, true).length;
    },
    girar(h) {
      const c = enHueco[h];
      if (!c) throw new Error('No hay ninguna pieza en ese hueco.');
      if (c.bloque >= 0) return S.girarBloque(c.bloque);
      const g = M.piezas[c.pieza].grupo;
      const d = disposiciones(g, h, true);
      if (d.length < 2) return false;
      const col = new Map(c.tupla.map((i, j) => [i, M.piezas[c.pieza].colores[j]]));
      const actual = M.pegatinasHueco(h).slice().sort((a, b) => a - b).map((i) => col.get(i)).join(',');
      const i = d.findIndex((x) => x.clave === actual);
      const sig = d[(i + 1) % d.length];
      guardar();
      const otro = huecoDe[sig.pieza];
      sacar(h);
      if (otro >= 0 && otro !== h) {
        // la pieza gemela estaba en otro hueco: se intercambian (la de aquí va allí)
        sacar(otro);
        const op = M.opciones(c.pieza, otro);
        if (op.length) poner(otro, c.pieza, op[0], -1);
      }
      poner(h, sig.pieza, sig.tupla, -1);
      return true;
    },
    colocarBloque(b, h) {
      const bq = M.bloques[b];
      if (!bq) throw new Error('Ese bloque no existe.');
      if (colBloque[b] >= 0) throw new Error(`El bloque ${bq.nombre} ya está colocado: quítalo antes o usa «Siguiente posición».`);
      const l = colocacionesQueCaben(b, h);
      if (!l.length) {
        const alguna = bq.colocaciones.some((c) => c.huecos.includes(h));
        throw new Error(alguna
          ? `El bloque ${bq.nombre} no cabe ahí: en todas sus posiciones que pasan por ese hueco choca con piezas ya colocadas.`
          : `El bloque ${bq.nombre} no puede ocupar ese hueco: sus piezas no caben en él en ninguna orientación.`);
      }
      guardar();
      ancla[b] = h;
      ponerBloque(b, l[0]);
    },
    girarBloque(b) {
      if (colBloque[b] < 0) throw new Error('Ese bloque no está colocado.');
      const l = colocacionesQueCaben(b, ancla[b]);
      if (l.length < 2) return false;
      const i = l.indexOf(colBloque[b]);
      guardar();
      ponerBloque(b, l[(i + 1) % l.length]);
      return true;
    },
    siguientePosicion(b) {
      if (colBloque[b] < 0) throw new Error('Ese bloque no está colocado.');
      const l = colocacionesQueCaben(b, -1);
      if (l.length < 2) return false;
      const i = l.indexOf(colBloque[b]);
      const ci = l[(i + 1) % l.length];
      guardar();
      ponerBloque(b, ci);
      ancla[b] = M.bloques[b].colocaciones[ci].huecos[0];
      return true;
    },
    posicionesBloque: (b) => colocacionesQueCaben(b, -1).length,
    colocacionBloque: (b) => colBloque[b],
    ponerColocacionBloque(b, ci) {
      if (!cabe(b, ci)) throw new Error(`El bloque ${M.bloques[b].nombre} no cabe en esa posición.`);
      guardar();
      ancla[b] = M.bloques[b].colocaciones[ci].huecos[0];
      ponerBloque(b, ci);
    },
    quitar(h) {
      const c = enHueco[h];
      if (!c) return false;
      guardar();
      if (c.bloque >= 0) { quitarBloque(c.bloque); ancla[c.bloque] = -1; } else sacar(h);
      return true;
    },
    deshacer() {
      const s = historial.pop();
      if (!s) return false;
      enHueco = s.enHueco; huecoDe = s.huecoDe; colBloque = s.colBloque; ancla = s.ancla;
      return true;
    },
    puedeDeshacer: () => historial.length > 0,
    vaciar() {
      guardar();
      enHueco = new Array(nH).fill(null);
      huecoDe = new Int16Array(nH).fill(-1);
      colBloque = new Int16Array(M.bloques.length).fill(-1);
      ancla = new Int16Array(M.bloques.length).fill(-1);
    },
    /**
     * Coloca solas las piezas que no tienen alternativa: un hueco en el que solo cabe un grupo y de
     * una sola forma (una disposición de colores), si ese grupo es de piezas fijas (los centros del
     * 3x3) o si ya no quedan bloques por colocar (todo lo que falta es suelto, así que ese hueco solo
     * puede llevar eso). Devuelve los huecos.
     */
    autoRellenar() {
      /** @type {number[]} */
      const puestos = [];
      let cambio = true;
      let guardado = false;
      while (cambio) {
        cambio = false;
        const bloquesFuera = M.bloques.some((b) => colBloque[b.id] < 0);
        for (let h = 0; h < nH; h++) {
          if (enHueco[h]) continue;
          const c = S.candidatos(h);
          if (c.length !== 1) continue;
          if (bloquesFuera && !M.tipos[M.grupos[c[0].grupo].tipo].fija) continue;
          const d = disposiciones(c[0].grupo, h);
          // solo si no hay nada que elegir (una disposición): la orientación no se adivina
          if (d.length !== 1) continue;
          if (!guardado) { guardar(); guardado = true; }
          poner(h, d[0].pieza, d[0].tupla, -1);
          puestos.push(h);
          cambio = true;
        }
      }
      return puestos;
    },
    faltan() {
      let piezas = 0, bloques = 0;
      for (const g of M.grupos) piezas += libresGrupo(g.id).length;
      for (const b of M.bloques) if (colBloque[b.id] < 0) bloques++;
      return { piezas, bloques };
    },
    completo: () => enHueco.every(Boolean),
    estado() {
      const e = new Array(M.n).fill(-1);
      enHueco.forEach((c) => { if (c) c.tupla.forEach((i, j) => { e[i] = M.piezas[c.pieza].valores[j]; }); });
      return e;
    },
    colores() {
      const e = new Array(M.n).fill(-1);
      enHueco.forEach((c) => { if (c) c.tupla.forEach((i, j) => { e[i] = M.piezas[c.pieza].colores[j]; }); });
      return e;
    },
    bloqueEnPosicion() {
      const r = new Int16Array(M.n).fill(-1);
      enHueco.forEach((c) => { if (c && c.bloque >= 0) for (const i of c.tupla) r[i] = c.bloque; });
      return r;
    },
  };
  return S;
}
