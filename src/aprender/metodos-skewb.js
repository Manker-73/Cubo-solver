// Modo aprender del Skewb: método de principiantes.
//   1. Primera capa: el centro de abajo y sus cuatro esquinas (de pieza en pieza, cada una con la
//      secuencia más corta que la coloca sin romper lo ya hecho).
//   2. Esquinas de la última capa: primero con el color de arriba hacia arriba, después en su sitio
//      (secuencias tipo "sledgehammer", R' L R L', que no rompen la primera capa).
//   3. Centros: los cinco que faltan, con un algoritmo que no mueve ninguna esquina.
// Notación WCA (R, U, L, B: los vértices DRB, ULB, DLF y DBL); la esquina URF no se mueve nunca,
// así que la primera capa es la de abajo (D). Se trabaja con los colores normalizados (los que da
// el validador) y los textos usan los colores reales.

import { crearGuion } from './guion.js';

const MOVS = ['R', "R'", 'U', "U'", 'L', "L'", 'B', "B'"];
const COLOR_F = ['blanca', 'roja', 'verde', 'amarilla', 'naranja', 'azul'];
const COLOR_M = ['blanco', 'rojo', 'verde', 'amarillo', 'naranja', 'azul'];
const DONDE = ['arriba', 'a la derecha', 'delante', 'abajo', 'a la izquierda', 'detrás'];
const CARAS_N = ['U', 'R', 'F', 'D', 'L', 'B'];

export function crearAprenderSkewb({ geo, modelo, analizar, centros, esqA, esqB, buscadorDe, coordsDe }) {
  const caraDe = geo.pegatinas.map((p) => p.cara);
  const esquinas = [...esqA, ...esqB];
  // Con R, U, L y B (los vértices DRB, ULB, DLF y DBL) la esquina URF no se mueve nunca, y los
  // conmutadores tipo sledgehammer que no rompen una capa (R' B R B', L B' L' B…) son los que respetan
  // la de arriba: la primera capa se hace ARRIBA (D = cara de la primera capa) y la última es la de abajo.
  const D = 0, U = 3;
  // esquinas de la primera capa ("abajo" en el código) y de la última ("arriba")
  const esD = (pz) => pz.some((i) => caraDe[i] === D);
  const abajo = esquinas.map((pz, k) => (esD(pz) ? k : -1)).filter((k) => k >= 0);
  const arriba = esquinas.map((pz, k) => (esD(pz) ? -1 : k)).filter((k) => k >= 0);
  const colorCara = (e, f) => e[centros[f][0]];
  const piezaOk = (e, pz) => pz.every((i) => e[i] === geo.resuelto[i]);
  const centroOk = (e, f) => e[centros[f][0]] === geo.resuelto[centros[f][0]];

  /** IDA* sobre pegatinas: la secuencia más corta (hasta maxProf) que cumple objetivo. */
  function buscar(e0, objetivo, maxProf) {
    for (let prof = 0; prof <= maxProf; prof++) {
      const camino = [];
      const dfs = (e, d, ult) => {
        if (d === 0) return objetivo(e);
        for (const m of MOVS) {
          if (m[0] === ult) continue;
          camino.push(m);
          if (dfs(geo.aplicar(e, m), d - 1, m[0])) return true;
          camino.pop();
        }
        return false;
      };
      if (dfs(e0, prof, null)) return camino;
    }
    return null;
  }

  // macros de la última capa: giros sueltos y conmutadores de cuatro movimientos (sledgehammer: R' L R L' y parecidos)
  const inv = (m) => (m.endsWith("'") ? m.slice(0, -1) : m + "'");
  const macros = MOVS.map((m) => ({ movs: [m], nombre: null }));
  for (const x of MOVS) for (const y of MOVS) {
    if (x[0] === y[0]) continue;
    const movs = [x, y, inv(x), inv(y)];
    // solo los que no rompen la primera capa
    const e = movs.reduce((a, m) => geo.aplicar(a, m), geo.resuelto);
    if (esquinas.filter(esD).every((pz) => pz.every((i) => e[i] === geo.resuelto[i])) && e[centros[D][0]] === geo.resuelto[centros[D][0]]) macros.push({ movs, nombre: 'Sledgehammer' });
  }
  /** Coste uniforme sobre macros (hasta maxMacros): la combinación más corta que cumple objetivo. */
  function buscarMacros(e0, objetivo, maxMacros) {
    const cubos = [[{ e: e0, camino: [] }]];
    const vistos = new Set([e0.join()]);
    for (let c = 0; c < cubos.length; c++) {
      for (const n of cubos[c] || []) {
        if (objetivo(n.e)) return n.camino;
        if (n.camino.length >= maxMacros) continue;
        for (const mac of macros) {
          const e = mac.movs.reduce((x, m) => geo.aplicar(x, m), n.e);
          const k = e.join();
          if (vistos.has(k)) continue;
          vistos.add(k);
          const nc = c + mac.movs.length;
          (cubos[nc] = cubos[nc] || []).push({ e, camino: [...n.camino, mac] });
        }
      }
    }
    return null;
  }
  /** Bloques: los giros sueltos van con el conmutador que les sigue. */
  function bloquesDe(g, camino, texto, piezas) {
    let pend = [];
    camino.forEach((mac, i) => {
      pend.push(mac);
      if (!mac.nombre && i < camino.length - 1) return;
      const movs = pend.flatMap((p) => p.movs);
      const com = pend.filter((p) => p.nombre).map((p) => p.movs.join(' '));
      const prep = pend.filter((p) => !p.nombre).map((p) => p.movs[0]);
      g.bloque(movs, texto(com, prep), { algoritmo: com.length ? 'Sledgehammer' : null, piezas: piezas() });
      pend = [];
    });
  }

  return function aprenderSkewb(estado) {
    const t0 = Date.now();
    const a = analizar(estado);
    if (!a.valido) return { ok: false, errores: a.errores };
    const sigma = a.sigma;
    const real = new Array(6);
    sigma.forEach((n, r) => { real[n] = r; });
    const colF = (c) => COLOR_F[real[c]];
    const colM = (c) => COLOR_M[real[c]];
    const norm = (e) => e.map((c) => sigma[c]);
    // se trabaja con el estado normalizado (mismas posiciones, colores del validador)
    const g = crearGuion((e, m) => geo.aplicar(e, m), estado);
    const N = () => norm(g.estado);
    const nombreEsq = (k) => esquinas[k].map((i) => geo.resuelto[i]).map(colF).join('-');

    // 1. Primera capa
    g.etapa('Primera capa', `Hacer la cara de arriba (${colF(D)}) con sus cuatro esquinas bien colocadas, es decir, que sus colores de los lados coincidan entre sí: primero el centro ${colM(D)} arriba y después las esquinas de una en una. Con la notación WCA (R, U, L, B) la esquina de arriba delante a la derecha no se mueve nunca: ya está en su sitio y marca la orientación; por eso aquí la primera capa es la de arriba y la última la de abajo.`, 'capa1');
    if (!centroOk(N(), D)) {
      const sol = buscar(N(), (e) => centroOk(e, D), 4);
      const desde = [0, 1, 2, 3, 4, 5].find((f) => colorCara(N(), f) === D);
      g.bloque(sol, `Lleva el centro ${colM(D)} arriba (está ${DONDE[desde]}) con ${sol.join(' ')}.`, { piezas: centros[desde] });
    }
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const e = N();
      const pend = abajo.filter((k) => !piezaOk(e, esquinas[k]));
      if (!pend.length) break;
      const hechas = abajo.filter((k) => piezaOk(e, esquinas[k]));
      let mejor = null;
      for (const k of pend) {
        const sol = buscar(e, (x) => centroOk(x, D) && [...hechas, k].every((j) => piezaOk(x, esquinas[j])), 6);
        if (sol && (!mejor || sol.length < mejor.sol.length)) mejor = { k, sol };
      }
      g.comprobar(!!mejor, 'primera capa: esquina');
      // dónde está ahora la esquina que se coloca (por sus colores)
      const cols = esquinas[mejor.k].map((i) => geo.resuelto[i]).sort().join();
      const ahora = esquinas.find((pz) => pz.map((i) => e[i]).sort().join() === cols);
      g.bloque(mejor.sol, `Esquina ${nombreEsq(mejor.k)} a su sitio en la primera capa (${hechas.length + 1}/4) con ${mejor.sol.join(' ')}.`, { piezas: ahora });
    }
    const capa = (e) => centroOk(e, D) && abajo.every((k) => piezaOk(e, esquinas[k]));
    g.comprobar(capa(N()), 'primera capa');

    // 2. Esquinas de la última capa: orientar y permutar
    g.etapa('Esquinas de abajo', `Las esquinas de la última capa (abajo): primero que todas tengan el ${colM(U)} hacia abajo y después que cada una esté en su sitio, con conmutadores de cuatro movimientos como R' B R B' (sledgehammer) que no rompen la primera capa. Los centros se pueden mover: se arreglan al final.`, 'esquinas');
    const arribaUp = (e) => arriba.every((k) => esquinas[k].some((i) => caraDe[i] === U && e[i] === U));
    const cuantasUp = (e) => arriba.filter((k) => esquinas[k].some((i) => caraDe[i] === U && e[i] === U)).length;
    const piezasArriba = () => arriba.flatMap((k) => esquinas[k]);
    if (!arribaUp(N())) {
      const sol = buscarMacros(N(), (x) => capa(x) && arribaUp(x), 4);
      g.comprobar(!!sol, 'esquinas: orientar');
      bloquesDe(g, sol, (com, prep, n0 = cuantasUp(N())) => (com.length
        ? `Orienta las esquinas de abajo (ahora ${n0 === 0 ? 'ninguna tiene' : n0 === 1 ? 'solo una tiene' : `${n0} tienen`} el ${colM(U)} abajo)${prep.length ? `: prepara con ${prep.join(' ')} y` : ':'} haz ${com.join(' y ')} (sledgehammer), que gira esquinas de abajo sin romper la primera capa.`
        : `Termina de orientar con ${prep.join(' ')}.`), piezasArriba);
    }
    const esquinasOk = (e) => esquinas.every((pz) => piezaOk(e, pz));
    if (!esquinasOk(N())) {
      const sol = buscarMacros(N(), (x) => capa(x) && esquinasOk(x), 4);
      g.comprobar(!!sol, 'esquinas: permutar');
      bloquesDe(g, sol, (com, prep) => (com.length
        ? `Coloca las esquinas de abajo en su sitio (todas tienen el ${colM(U)} abajo, pero alguna no coincide con sus vecinas)${prep.length ? `: prepara con ${prep.join(' ')} y` : ':'} haz ${com.join(' y ')}.`
        : `Termina de colocarlas con ${prep.join(' ')}.`), piezasArriba);
    }
    g.comprobar(capa(N()) && esquinasOk(N()), 'esquinas');

    // 3. Centros: un algoritmo que solo mueve centros
    g.etapa('Centros', 'Los centros que faltan, con un algoritmo que los cambia de sitio sin mover ninguna esquina (al final del algoritmo las esquinas vuelven a estar como antes).', 'centros');
    if (![0, 1, 2, 3, 4, 5].every((f) => centroOk(N(), f))) {
      const e = N();
      const mal = [0, 1, 2, 3, 4, 5].filter((f) => !centroOk(e, f));
      // ciclos de la permutación de los centros (el centro de la cara f va a la cara de su color)
      const destino = (f) => e[centros[f][0]];
      const visto = new Set(), largos = [];
      for (const f of mal) { if (visto.has(f)) continue; let l = 0; for (let x = f; !visto.has(x); x = destino(x)) { visto.add(x); l++; } largos.push(l); }
      largos.sort();
      const NUM = { 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco' };
      const ciclo = largos.join() === '2,2' ? 'dos parejas de centros intercambiadas' : largos.length === 1 ? `${NUM[largos[0]]} centros en ciclo` : largos.map((l) => (l === 2 ? 'una pareja intercambiada' : `${NUM[l]} centros en ciclo`)).join(' y ');
      const r = buscadorDe().resolver(coordsDe(modelo.identificar(e).orbitas), 14);
      g.comprobar(!!r, 'centros');
      g.bloque(r.movimientos, `Caso: ${ciclo} (${mal.map((f) => CARAS_N[f]).join(', ')}). ${r.movimientos.join(' ')} los coloca: es un algoritmo de centros, las esquinas salen y vuelven a su sitio.`, { algoritmo: 'Centros', piezas: mal.flatMap((f) => centros[f]) });
    }
    g.comprobar(esquinas.every((pz) => piezaOk(N(), pz)) && [0, 1, 2, 3, 4, 5].every((f) => centroOk(N(), f)), 'resuelto');
    const res = g.resultado('principiantes');
    res.ms = Date.now() - t0;
    return res;
  };
}

export const METODOS_SKEWB = [
  { id: 'principiantes', nombre: 'Principiantes (por capas)', descripcion: 'Primera capa (centro y cuatro esquinas), esquinas de arriba (orientar y colocar) y centros.' },
];
