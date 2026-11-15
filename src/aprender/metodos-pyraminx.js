// Modo aprender del Pyraminx: método de principiantes por capas.
//   1. Puntas: cada punta como la pieza central que tiene debajo (u, l, r, b).
//   2. Centros: las piezas centrales de abajo con el color de abajo hacia abajo (un giro de L, R o B).
//   3. Primera capa: las tres aristas de abajo, de una en una (la secuencia más corta que la mete
//      sin romper lo ya hecho, como haría una persona con R' U' R y parecidos).
//   4. Última capa: las tres aristas de arriba con dos algoritmos (ciclo de tres aristas y voltear
//      dos aristas) y el giro final de arriba.
// Se trabaja sobre el estado con los colores normalizados (el validador ya sabe qué color va en
// cada cara); los textos usan los colores reales.

import { crearGuion } from './guion.js';

const VN = ['U', 'L', 'R', 'B'];
const NOMBRE_V = { U: 'de arriba (U)', L: 'de la izquierda (L)', R: 'de la derecha (R)', B: 'de atrás (B)' };
const NOMBRE_P = { U: 'de arriba', L: 'de la izquierda', R: 'de la derecha', B: 'de atrás' };
const ARISTAS_N = ['UL', 'UR', 'UB', 'LR', 'LB', 'RB'];
const ABAJO = [3, 4, 5]; // LR, LB, RB
const ARRIBA = [0, 1, 2];
const MOVS = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"];
const COLOR_F = ['verde', 'roja', 'azul', 'amarilla'];
const COLOR_M = ['verde', 'rojo', 'azul', 'amarillo'];

// Última capa (escritos a mano, notación WCA; se comprueban al cargar: no tocan la primera capa)
const ALGS_LL = [
  { nombre: 'Ciclo de tres aristas', alg: "R U R' U R U R'" },
  { nombre: 'Ciclo de tres aristas', alg: "R U' R' U' R U' R'" },
  { nombre: 'Ciclo de tres aristas', alg: "L' U' L U' L' U' L" },
  { nombre: 'Ciclo de tres aristas', alg: "L' U L U L' U L" },
  { nombre: 'Voltear dos aristas', alg: "R' L R L' U L' U' L" },
  { nombre: 'Voltear dos aristas', alg: "L R' L' R U' R U R'" },
  { nombre: 'Voltear dos aristas', alg: "R U' R' U R' L R L'" },
];

export function crearAprenderPyraminx({ geo, modelo, analizar, puntas, centros }) {
  const inv = (m) => (m.endsWith("'") ? m.slice(0, -1) : m + "'");
  const parsear = (s) => s.trim().split(/\s+/);
  const aplicarP = (pz, movs) => movs.reduce((x, m) => modelo.aplicarPiezas(x, m), pz);
  const caraDe = (i) => geo.pegatinas[i].cara;

  // ---- comprobaciones sobre las piezas (colores normalizados) ----
  const centroOk = (pz, v) => pz[1].ori[v] === 0;
  const aristaOk = (pz, k) => pz[2].perm[k] === k && pz[2].ori[k] === 0;
  const resueltoP = (pz) => [0, 1, 2, 3].every((v) => centroOk(pz, v) && pz[0].ori[v] === 0) && [0, 1, 2, 3, 4, 5].every((k) => aristaOk(pz, k));
  const primeraCapa = (pz) => [1, 2, 3].every((v) => centroOk(pz, v)) && ABAJO.every((k) => aristaOk(pz, k));

  // algoritmos de la última capa: que no toquen la primera capa (centros de abajo, aristas de abajo)
  const resuelto0 = modelo.identificar(geo.resuelto).orbitas;
  const algsLL = ALGS_LL.map((a) => ({ ...a, movs: parsear(a.alg) })).filter((a) => {
    const pz = aplicarP(resuelto0, a.movs);
    return primeraCapa(pz);
  });

  /** Puntas alineadas con su pieza central (por pegatinas: cada pegatina de la punta como la de la pieza central en esa cara). */
  const puntaOk = (e, v) => puntas[v].every((i) => { const j = centros[v].find((x) => caraDe(x) === caraDe(i)); return e[i] === e[j]; });

  /** Búsqueda en profundidad iterativa (piezas) de la secuencia más corta que cumple objetivo. */
  function buscar(pz, objetivo, maxProf, movs = MOVS) {
    for (let prof = 0; prof <= maxProf; prof++) {
      const camino = [];
      const dfs = (x, d, ult) => {
        if (d === 0) return objetivo(x);
        for (const m of movs) {
          if (ult && m[0] === ult) continue;
          camino.push(m);
          if (dfs(modelo.aplicarPiezas(x, m), d - 1, m[0])) return true;
          camino.pop();
        }
        return false;
      };
      if (dfs(pz, prof, null)) return camino;
    }
    return null;
  }

  function contarLL(pz) {
    const orientadas = ARRIBA.filter((k) => pz[2].ori[k] === 0).length;
    const enSitio = ARRIBA.filter((k) => aristaOk(pz, k)).length;
    return { orientadas, enSitio };
  }

  return function aprenderPyraminx(estado) {
    const t0 = Date.now();
    const a = analizar(estado);
    if (!a.valido) return { ok: false, errores: a.errores };
    const sigma = a.sigma;
    const real = new Array(4); // color normalizado -> color real
    sigma.forEach((n, r) => { real[n] = r; });
    const colF = (c) => COLOR_F[real[c]];
    const colM = (c) => COLOR_M[real[c]];
    const g = crearGuion((e, m) => geo.aplicar(e, m), estado);
    const piezas = () => modelo.identificar(g.estado.map((c) => sigma[c])).orbitas;
    // pegatinas de la arista que está en la posición k
    const modeloAristas = (k) => modelo.orbitas[2].piezas[k];
    const abajo = 3; // color normalizado de la cara de abajo (D)

    // 1. Puntas
    g.etapa('Puntas', 'Girar cada punta para que sus colores coincidan con los de la pieza central que tiene debajo. Las puntas se giran solas (u, l, r, b) y no afectan a nada más, así que se hacen primero y ya no se tocan.', 'puntas');
    VN.forEach((v, p) => {
      if (puntaOk(g.estado, p)) return;
      const m = v.toLowerCase();
      const mov = puntaOk(geo.aplicar(g.estado, m), p) ? m : m + "'";
      g.bloque([mov], `Gira la punta ${NOMBRE_P[v]} (${mov}) para que coincida con la pieza central de debajo.`, { piezas: [...puntas[p], ...centros[p]] });
    });
    g.comprobar(VN.every((_, p) => puntaOk(g.estado, p)), 'puntas');

    // 2. Centros: las tres piezas centrales de abajo con el color de abajo hacia abajo
    g.etapa('Centros', `Girar los vértices de abajo (L, R y B) para que sus piezas centrales tengan el ${colM(abajo)} abajo: así se forma el triángulo ${colF(abajo)} de la cara de abajo y quedan colocadas respecto a las demás. La punta gira con su vértice, así que sigue bien.`, 'centros');
    for (const v of ['L', 'R', 'B']) {
      const p = VN.indexOf(v);
      const pz = piezas();
      if (centroOk(pz, p)) continue;
      const mov = centroOk(modelo.aplicarPiezas(pz, v), p) ? v : v + "'";
      g.bloque([mov], `Gira el vértice ${NOMBRE_V[v]} (${mov}): su pieza central queda con el ${colM(abajo)} abajo.`, { piezas: centros[p] });
    }
    g.comprobar([1, 2, 3].every((p) => centroOk(piezas(), p)), 'centros');

    // 3. Primera capa: las tres aristas de abajo
    g.etapa('Primera capa', `Colocar las tres aristas de abajo (las que tienen ${colM(abajo)}) entre las piezas centrales, de una en una y sin romper lo ya hecho. Cada una con una secuencia corta: se lleva la arista arriba encima de su sitio y se baja con un giro de un vértice (como R' U' R o L U L').`, 'capa1');
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const pz = piezas();
      const pend = ABAJO.filter((k) => !aristaOk(pz, k));
      if (!pend.length) break;
      const hechas = ABAJO.filter((k) => aristaOk(pz, k));
      let mejor = null;
      for (const k of pend) {
        const sol = buscar(pz, (x) => [1, 2, 3].every((p) => centroOk(x, p)) && [...hechas, k].every((j) => aristaOk(x, j)), 7);
        if (sol && (!mejor || sol.length < mejor.sol.length)) mejor = { k, sol };
      }
      g.comprobar(!!mejor, 'primera capa: arista');
      const pieza = pz[2].perm.indexOf(mejor.k); // dónde está ahora la arista que se coloca
      const nombre = ARISTAS_N[mejor.k];
      const colores = modelo.orbitas[2].piezas[mejor.k].map((i) => geo.resuelto[i]).map(colF).join(' y ');
      const piezasB = [...modeloAristas(pieza)];
      g.bloque(mejor.sol, `Arista ${colores} a su sitio (entre los vértices ${nombre[0]} y ${nombre[1]}) con ${mejor.sol.join(' ')}${mejor.sol.length <= 4 ? '' : ': primero se coloca encima de su sitio y luego se baja'}.`, { piezas: piezasB });
    }
    g.comprobar(primeraCapa(piezas()), 'primera capa');

    // 4. Última capa: las tres aristas de arriba (+ el giro de arriba)
    g.etapa('Última capa', 'Colocar y orientar las tres aristas de arriba sin romper la primera capa, con dos algoritmos: uno mueve las tres aristas en ciclo y otro voltea dos. Al final se gira la capa de arriba (U) para que su pieza central encaje.', 'ultima');
    {
      const pz0 = piezas();
      // coste uniforme sobre: giro de U, algoritmo
      const macros = [{ movs: ['U'], nombre: null }, { movs: ["U'"], nombre: null }, ...algsLL];
      const clave = (x) => JSON.stringify(x);
      const cubos = [[{ x: pz0, camino: [] }]];
      const vistos = new Set([clave(pz0)]);
      let sol = null;
      for (let c = 0; c < cubos.length && !sol; c++) {
        for (const n of cubos[c] || []) {
          if (resueltoP(n.x)) { sol = n.camino; break; }
          if (n.camino.length >= 6) continue;
          for (const mac of macros) {
            const y = aplicarP(n.x, mac.movs);
            const k = clave(y);
            if (vistos.has(k)) continue;
            vistos.add(k);
            const nc = c + mac.movs.length;
            (cubos[nc] = cubos[nc] || []).push({ x: y, camino: [...n.camino, mac] });
          }
        }
      }
      g.comprobar(!!sol, 'última capa');
      // bloques: los giros de U se juntan con el algoritmo que viene detrás
      let pend = [];
      sol.forEach((mac, i) => {
        pend.push(mac);
        if (!mac.nombre && i < sol.length - 1) return;
        const movs = pend.flatMap((p) => p.movs);
        const alg = pend.find((p) => p.nombre);
        const pz = piezas();
        const { orientadas, enSitio } = contarLL(pz);
        let texto;
        if (!alg) texto = `Gira la capa de arriba (${movs.join(' ')}) para terminar: la pieza central de arriba encaja y todo queda resuelto.`;
        else {
          const prep = pend.length > 1 ? `Gira arriba (${pend.slice(0, -1).flatMap((p) => p.movs).join(' ')}) para colocar el caso y ` : '';
          const volteadas = 3 - orientadas;
          const caso = `${enSitio === 3 ? 'las tres aristas de arriba están en su sitio' : enSitio === 1 ? 'una arista de arriba está en su sitio y las otras dos no' : 'ninguna arista de arriba está en su sitio'}${volteadas ? `, ${volteadas === 1 ? 'una volteada' : `${volteadas} volteadas`}` : ', todas bien orientadas'}`;
          texto = `Caso: ${caso}. ${prep ? prep + 'haz' : 'Haz'} ${alg.movs.join(' ')} (${alg.nombre.toLowerCase()}).`;
        }
        const piezasB = alg ? ARRIBA.flatMap((k) => modeloAristas(k)) : centros[0];
        g.bloque(movs, texto, { algoritmo: alg ? alg.nombre : null, piezas: piezasB });
        pend = [];
      });
    }
    g.comprobar(resueltoP(piezas()) && VN.every((_, p) => puntaOk(g.estado, p)), 'resuelto');
    const r = g.resultado('principiantes');
    r.ms = Date.now() - t0;
    return r;
  };
}

export const METODOS_PYRAMINX = [
  { id: 'principiantes', nombre: 'Principiantes (por capas)', descripcion: 'Puntas, centros, primera capa (las tres aristas de abajo) y última capa con dos algoritmos.' },
];
