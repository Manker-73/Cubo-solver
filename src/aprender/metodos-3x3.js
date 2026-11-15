// Métodos humanos del 3x3 (modo aprender): por capas para principiantes y CFOP.
// También los usa la etapa final de la reducción de los cubos grandes (sobre un
// 3x3 "virtual"). Cada etapa se comprueba con objetivos-cubo.js.

import { motorCubo, AJUSTES_U, rotY, parsear, coloresPieza, NOMBRE_COLOR } from './motor-cubo.js';
import { crearGuion } from './guion.js';
import { OBJETIVOS_3x3 as OB } from './objetivos-cubo.js';
import { OLL, OLL_ARISTAS, PLL, PRINCIPIANTES } from './algoritmos.js';
import { esRotacion } from '../puzzles/nxn.js';

const M = motorCubo(3);
const BLANCO = 0, AMARILLO = 3;
const TODOS = ['U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2', 'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2'];
const RUF = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2'];
const RU = ['U', "U'", 'U2', 'R', "R'", 'R2'];
const LETRA = 'URFDLB';
// Huecos de la primera/segunda capa (caras laterales); y^k lleva el hueco k delante a la derecha
const HUECOS = [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']];
const NOMBRE_HUECO = ['delante a la derecha', 'detrás a la derecha', 'detrás a la izquierda', 'delante a la izquierda'];

const centroDe = (e, letra) => e[LETRA.indexOf(letra) * 9 + 4];
const carasDeCasilla = (f) => M.pegatinasDe(f).map((x) => LETRA[M.caraDe(x)]);
/** Hueco (0..3) en el que está la casilla f (esquina de abajo o arista del medio), o -1. */
function huecoDe(f) {
  const cs = carasDeCasilla(f).filter((c) => c !== 'U' && c !== 'D');
  if (cs.length !== 2) return -1;
  return HUECOS.findIndex((h) => h.every((c) => cs.includes(c)));
}
const enCapaU = (f) => carasDeCasilla(f).includes('U');
const enCapaD = (f) => carasDeCasilla(f).includes('D');

const pieza = (e, colores) => M.pieza(e, M.marcoCentros(e), colores);
const bien = (e, colores) => { const p = pieza(e, colores); return p.casa === p.donde; };
const pegs = (e, ...colores) => colores.flatMap((c) => M.pegatinasDe(pieza(e, c).donde));
const nombreRot = (k) => ['', 'y', 'y2', "y'"][k];
const textoRot = (k, que) => `Gira el cubo entero (${nombreRot(k)}) para tener ${que} delante a la derecha.`;

// ---------- Preparación de algoritmos (se comprueban una vez) ----------
let prep = null;
function preparar() {
  if (prep) return prep;
  const resuelto = M.b.estadoResuelto();
  // estado con blanco abajo, amarillo arriba
  const base = M.aplicar(resuelto, 'z2');
  const respetaF2L = (e) => OB.dosCapas(e);
  const ollOk = [], pllOk = [];
  for (const o of OLL) {
    const movs = parsear(o.alg);
    const e = M.aplicarSec(base, movs);
    // orienta desde algún caso: aplicado al revés desde orientado, da un caso válido con F2L
    if (respetaF2L(e) && respetaF2L(M.aplicarSec(base, invertir(movs)))) ollOk.push({ ...o, movs });
  }
  for (const p of PLL) {
    const movs = parsear(p.alg);
    const e = M.aplicarSec(base, movs);
    if (!OB.caraAmarilla(e)) continue; // no respeta las dos capas o la orientación
    if (!familiaPLL(e).has(p.familia)) continue;
    pllOk.push({ ...p, movs });
  }
  prep = { ollOk, pllOk, base };
  return prep;
}
const invertir = (movs) => movs.slice().reverse().map((m) => M.b.invertirMovimiento(m));

/** Esquinas y aristas de U (casillas de la cara U) en orden cíclico. */
const ESQ_U = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11]]; // URF UFL ULB UBR
const ARI_U = [[5, 10], [7, 19], [3, 37], [1, 46]]; // UR UF UL UB
/** Permutación de las piezas de U respecto a los centros: [desplazamientos esquinas], [aristas]. */
function permU(e) {
  const lado = (f) => e[f];
  const centrosLat = ['R', 'F', 'L', 'B'].map((c) => centroDe(e, c));
  // posición (0..3) a la que pertenece una arista por su color lateral (orden UR UF UL UB)
  const ar = ARI_U.map(([, s]) => centrosLat.indexOf(lado(s)));
  // esquina: por sus dos colores laterales
  const es = ESQ_U.map(([, a, b]) => {
    const cs = [lado(a), lado(b)];
    for (let k = 0; k < 4; k++) {
      const [, x, y] = ESQ_U[k];
      const cc = [M.caraDe(x), M.caraDe(y)].map((f) => e[f * 9 + 4]);
      if (cs.includes(cc[0]) && cs.includes(cc[1])) return k;
    }
    return -1;
  });
  return { es, ar };
}
function ciclos(p) {
  const vis = new Array(4).fill(false), r = [];
  for (let i = 0; i < 4; i++) {
    if (vis[i]) continue;
    const c = [];
    for (let j = i; !vis[j]; j = p[j]) { vis[j] = true; c.push(j); }
    if (c.length > 1) r.push(c);
  }
  return r;
}
/** Familias posibles (letras) de una PLL a partir del estado tras aplicarla al cubo resuelto (con cualquier ajuste de U). */
function familiaPLL(e) {
  const r = new Set();
  for (let k = 0; k < 4; k++) {
    const { es, ar } = permU(e);
    const tipo = (cs) => cs.map((c) => (c.length === 2 ? ((c[1] - c[0] + 4) % 4 === 2 ? 'o' : 'a') : String(c.length))).sort().join('');
    const te = tipo(ciclos(es)), ta = tipo(ciclos(ar));
    const f = { '|3': 'U', '|oo': 'H', '|aa': 'Z', '3|': 'A', 'aa|': 'E', '3|3': 'G', 'o|a': 'VY', 'o|o': 'N', 'a|o': 'TF', 'a|a': 'JR' }[te + '|' + ta];
    if (f) r.add(f);
    e = M.aplicar(e, 'U');
  }
  return r;
}
// T y F, J y R, V e Y comparten tipo de intercambio: la comprobación acepta cualquiera de las dos
for (const p of PLL) p.familia = { T: 'TF', F: 'TF', J: 'JR', R: 'JR', V: 'VY', Y: 'VY' }[p.familia] || p.familia;

/** Descripción (calculada) de lo que hace una PLL en el estado e (antes de aplicarla; con el ajuste final que haga falta). */
function describirPLL(e) {
  let mejor = null;
  for (let k = 0; k < 4; k++) {
    const { es, ar } = permU(e);
    const ce = ciclos(es), ca = ciclos(ar);
    const n = ce.flat().length + ca.flat().length;
    if (!mejor || n < mejor.n) mejor = { n, ce, ca };
    e = M.aplicar(e, 'U');
  }
  const partes = [];
  const de = (cs, esq, plural) => {
    if (!cs.length) return;
    if (cs.length === 1 && cs[0].length === 3) partes.push(`tres ${plural} en ciclo`);
    else if (cs.length === 1 && cs[0].length === 2) partes.push(`dos ${plural} intercambiadas ${(cs[0][1] - cs[0][0] + 4) % 4 === 2 ? (esq ? 'en diagonal' : 'opuestas') : 'contiguas'}`);
    else if (cs.length === 2) partes.push(`dos parejas de ${plural} intercambiadas`);
    else partes.push(`las cuatro ${plural} fuera de su sitio`);
  };
  de(mejor.ce, true, 'esquinas');
  de(mejor.ca, false, 'aristas');
  return partes.join(' y ') || 'nada por colocar';
}
/** Qué hace cada familia de PLL. */
const EFECTO_PLL = { U: 'mueve tres aristas en ciclo', A: 'mueve tres esquinas en ciclo' };

/** Descripción del caso de OLL: aristas y esquinas con el amarillo arriba. */
function describirOLL(e) {
  const y = AMARILLO;
  const ar = [5, 7, 3, 1].map((f) => e[f] === y);
  const nA = ar.filter(Boolean).length;
  const nE = [8, 6, 0, 2].filter((f) => e[f] === y).length;
  let forma;
  if (nA === 0) forma = 'ninguna arista orientada (punto)';
  else if (nA === 4) forma = 'cruz hecha';
  else if (nA === 2) forma = (ar[0] && ar[2]) || (ar[1] && ar[3]) ? 'dos aristas en línea' : 'dos aristas en L';
  else forma = `${nA} aristas`;
  return `${forma}, ${nE} esquina${nE === 1 ? '' : 's'} con el amarillo arriba`;
}

// ---------- Etapas comunes ----------

function rotacionInicial(g) {
  const marco = M.marcoCentros(g.estado);
  const rot = { 0: ['z2'], 1: ['z'], 2: ["x'"], 3: [], 4: ["z'"], 5: ['x'] }[marco[BLANCO]];
  g.etapa('Preparación', 'Sujetar el cubo con el centro blanco abajo: así la primera capa queda abajo y la última (amarilla) arriba, a la vista.', 'prep');
  g.bloque(rot, `Gira el cubo entero (${rot.join(' ')}) para dejar el centro blanco abajo.`);
}

const aristasBlancas = (e) => ['F', 'R', 'B', 'L'].map((c) => [BLANCO, centroDe(e, c)]);

/** Cruz arista a arista (principiantes): primero la que esté más cerca. */
function cruzPorAristas(g) {
  g.etapa('Cruz', 'Poner abajo las cuatro aristas blancas, cada una con su otro color junto al centro de ese color (la cruz blanca).', 'cruz');
  const hechas = [];
  let pendientes = aristasBlancas(g.estado).filter((c) => { if (bien(g.estado, c)) { hechas.push(c); return false; } return true; });
  while (pendientes.length) {
    let mejor = null;
    for (const col of pendientes) {
      const ps = hechas.concat([col]).map((c) => pieza(g.estado, c));
      const n = ps.length;
      const grupos = n === 1 ? [[0]] : ps.slice(0, -1).map((_, i) => [i, n - 1]);
      const sol = M.buscar(ps.map((p) => p.donde), ps.map((p) => p.casa), TODOS, { grupos, maxProf: 10 });
      if (sol && (!mejor || sol.length < mejor.sol.length)) mejor = { col, sol };
    }
    const c = mejor.col;
    g.bloque(mejor.sol, `Lleva la arista ${coloresPieza(c)} abajo, con el blanco hacia abajo y el ${NOMBRE_COLOR[c[1]]} junto al centro ${NOMBRE_COLOR[c[1]]}.`, { piezas: pegs(g.estado, c) });
    hechas.push(c);
    pendientes = pendientes.filter((x) => x !== c);
  }
  g.comprobar(OB.cruz(g.estado), 'cruz');
}

/** Cruz entera de una vez, con la menor cantidad de movimientos (CFOP). */
function cruzOptima(g) {
  g.etapa('Cruz', 'Las cuatro aristas blancas abajo, cada una junto a su centro. En CFOP se planea entera antes de empezar (normalmente en 8 movimientos o menos).', 'cruz');
  const cols = aristasBlancas(g.estado);
  const ps = cols.map((c) => pieza(g.estado, c));
  const grupos = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
  const sol = M.buscar(ps.map((p) => p.donde), ps.map((p) => p.casa), TODOS, { grupos, maxProf: 10, maxNodos: 2e7 });
  g.bloque(sol, 'Haz la cruz blanca entera: las cuatro aristas blancas a su sitio a la vez.', { piezas: pegs(g.estado, ...cols) });
  g.comprobar(OB.cruz(g.estado), 'cruz');
}

/** Primera capa: esquinas blancas con R U R' U' repetido (principiantes). */
function esquinasPrimeraCapa(g) {
  g.etapa('Primera capa', 'Colocar las cuatro esquinas blancas abajo, entre sus colores: la cara blanca y la primera capa quedan completas.', 'capa1');
  const sexy = parsear(PRINCIPIANTES.sexy);
  for (let vueltas = 0; vueltas < 8; vueltas++) {
    const e = g.estado;
    const cols = HUECOS.map(([a, b]) => [BLANCO, centroDe(e, a), centroDe(e, b)]);
    const pend = cols.filter((c) => !bien(e, c));
    if (!pend.length) break;
    // primero las que ya están arriba
    let c = pend.find((x) => enCapaU(pieza(e, x).donde));
    if (!c) {
      // todas las que faltan están abajo: si alguna está en un hueco que no es el suyo, sacarla
      c = pend.find((x) => huecoDe(pieza(e, x).donde) !== huecoDe(pieza(e, x).casa)) || pend[0];
      const p = pieza(e, c);
      if (huecoDe(p.donde) !== huecoDe(p.casa)) {
        const k = huecoDe(p.donde);
        g.bloque(rotY(k), textoRot(k, 'el hueco donde está la esquina'), { piezas: pegs(g.estado, c) });
        g.bloque(sexy, `La esquina ${coloresPieza(c)} está abajo pero en un hueco que no es el suyo: sácala a la capa de arriba con R U R' U'.`, { algoritmo: 'Sexy move', piezas: pegs(g.estado, c) });
      }
    }
    // girar el cubo para tener su hueco delante a la derecha
    const k = huecoDe(pieza(g.estado, c).casa);
    g.bloque(rotY(k), textoRot(k, `el hueco de la esquina ${coloresPieza(c)} (entre los centros ${NOMBRE_COLOR[c[1]]} y ${NOMBRE_COLOR[c[2]]})`), { piezas: pegs(g.estado, c) });
    if (enCapaU(pieza(g.estado, c).donde)) {
      const j = [[], ['U'], ['U2'], ["U'"]].find((u) => M.pegatinasDe(pieza(M.aplicarSec(g.estado, u), c).donde).includes(8));
      g.bloque(j, 'Gira la capa de arriba para dejar la esquina justo encima de su hueco (arriba, delante a la derecha).', { piezas: pegs(g.estado, c) });
    }
    let r = 0, e2 = g.estado;
    while (!bien(e2, c) && r < 6) { e2 = M.aplicarSec(e2, sexy); r++; }
    g.comprobar(bien(e2, c), 'esquina con R U R\' U\'');
    g.bloque(Array.from({ length: r }, () => sexy).flat(), `Repite R U R' U' hasta que la esquina ${coloresPieza(c)} baje a su sitio con el blanco abajo (${r} ${r === 1 ? 'vez' : 'veces'}).`, { algoritmo: r > 1 ? `Sexy move ×${r}` : 'Sexy move', piezas: pegs(g.estado, c) });
  }
  g.comprobar(OB.primeraCapa(g.estado), 'primera capa');
}

/** Segunda capa: aristas sin amarillo con los algoritmos de la derecha y la izquierda. */
function segundaCapa(g) {
  g.etapa('Segunda capa', 'Colocar las cuatro aristas de la capa del medio (las que no tienen amarillo). Las dos primeras capas quedan completas.', 'capa2');
  const der = parsear(PRINCIPIANTES.derecha), izq = parsear(PRINCIPIANTES.izquierda);
  for (let vueltas = 0; vueltas < 10; vueltas++) {
    const e = g.estado;
    const cols = HUECOS.map(([a, b]) => [centroDe(e, a), centroDe(e, b)]);
    const pend = cols.filter((c) => !bien(e, c));
    if (!pend.length) break;
    let c = pend.find((x) => enCapaU(pieza(e, x).donde));
    if (!c) {
      c = pend[0];
      const k = huecoDe(pieza(e, c).donde);
      g.bloque(rotY(k), textoRot(k, 'la arista que está mal colocada en la capa del medio'), { piezas: pegs(g.estado, c) });
      g.bloque(der, `La arista ${coloresPieza(c)} está en la capa del medio pero mal (en otro hueco o al revés): sácala a la capa de arriba con el algoritmo de la derecha.`, { algoritmo: 'Algoritmo de la derecha', piezas: pegs(g.estado, c) });
    }
    // color lateral (el que no mira arriba) y color de arriba
    const p = pieza(g.estado, c);
    const casillas = M.pegatinasDe(p.donde);
    const lat = casillas.find((f) => M.caraDe(f) !== 0), arr = casillas.find((f) => M.caraDe(f) === 0);
    const cLat = g.estado[lat], cArr = g.estado[arr];
    const k = ['F', 'R', 'B', 'L'].findIndex((l) => centroDe(g.estado, l) === cLat);
    g.bloque(rotY(k), `Gira el cubo entero (${nombreRot(k)}) para tener delante el centro ${NOMBRE_COLOR[cLat]} (el color de la arista que no mira arriba).`, { piezas: pegs(g.estado, c) });
    const j = [[], ['U'], ['U2'], ["U'"]].find((u) => M.pegatinasDe(pieza(M.aplicarSec(g.estado, u), c).donde).includes(7));
    g.bloque(j, `Gira la capa de arriba hasta que la arista quede delante, encima del centro ${NOMBRE_COLOR[cLat]}.`, { piezas: pegs(g.estado, c) });
    const derecha = centroDe(g.estado, 'R') === cArr;
    g.bloque(derecha ? der : izq, `Su color de arriba (${NOMBRE_COLOR[cArr]}) es el del centro de la ${derecha ? 'derecha' : 'izquierda'}: algoritmo de la ${derecha ? 'derecha' : 'izquierda'} para bajarla a su sitio.`, { algoritmo: derecha ? 'Algoritmo de la derecha' : 'Algoritmo de la izquierda', piezas: pegs(g.estado, c) });
    g.comprobar(bien(g.estado, c), 'arista de la segunda capa');
  }
  g.comprobar(OB.dosCapas(g.estado), 'dos capas');
}

/** F2L: las cuatro parejas esquina-arista, cada una buscada con U, R y F. */
function f2l(g) {
  g.etapa('F2L', 'First two layers: emparejar cada esquina blanca con su arista de la capa del medio y meter las dos juntas en su hueco. Las dos primeras capas quedan completas.', 'f2l');
  let numero = 0;
  for (let vueltas = 0; vueltas < 12; vueltas++) {
    const e = g.estado;
    const parejas = HUECOS.map(([a, b]) => ({ esq: [BLANCO, centroDe(e, a), centroDe(e, b)], ari: [centroDe(e, a), centroDe(e, b)] }));
    const pend = parejas.filter((p) => !bien(e, p.esq) || !bien(e, p.ari));
    if (!pend.length) break;
    let mejor = null;
    for (let k = 0; k < 4; k++) {
      const par = parejas[k];
      if (!pend.includes(par)) continue;
      const e2 = M.aplicarSec(e, rotY(k));
      // en el marco girado: el hueco está delante a la derecha
      const C = (l) => centroDe(e2, l);
      const piezas = [par.esq, par.ari, [BLANCO, C('R')], [BLANCO, C('F')]];
      const grupos = [[0, 1, 2], [0, 1, 3]];
      const fl = [[BLANCO, C('F'), C('L')], [C('F'), C('L')]];
      const br = [[BLANCO, C('R'), C('B')], [C('R'), C('B')]];
      if (bien(e2, fl[0]) && bien(e2, fl[1])) { piezas.push(...fl); grupos.push([piezas.length - 2, piezas.length - 1, 3]); }
      if (bien(e2, br[0]) && bien(e2, br[1])) { piezas.push(...br); grupos.push([piezas.length - 2, piezas.length - 1, 2]); }
      const ps = piezas.map((c) => pieza(e2, c));
      // primero solo con R y U (lo más cómodo); con F si sale más corto
      const desde = ps.map((p) => p.donde), hasta = ps.map((p) => p.casa);
      const ru = M.buscar(desde, hasta, RU, { grupos, maxProf: 12, maxNodos: 4e5 });
      const ruf = M.buscar(desde, hasta, RUF, { grupos, maxProf: ru ? ru.length - 1 : 13, maxNodos: 1.5e6 });
      const sol = ruf || ru;
      if (!sol) continue;
      const coste = sol.length + (k ? 0.5 : 0);
      if (!mejor || coste < mejor.coste) mejor = { k, sol, par, coste };
    }
    if (!mejor) {
      // ninguna pareja se puede meter directamente: sacar una pieza atascada en otro hueco
      const p = pend[0];
      const atasc = [p.esq, p.ari].find((c) => { const x = pieza(e, c); return !enCapaU(x.donde) && huecoDe(x.donde) !== huecoDe(x.casa); }) || p.esq;
      const k = huecoDe(pieza(e, atasc).donde);
      g.bloque(rotY(k), textoRot(k, 'el hueco donde está atascada la pieza'), { piezas: pegs(g.estado, atasc) });
      g.bloque(["R", "U", "R'"], `La ${atasc.length === 3 ? 'esquina' : 'arista'} ${coloresPieza(atasc)} está en un hueco que no es el suyo: sácala a la capa de arriba con R U R'.`, { piezas: pegs(g.estado, atasc) });
      continue;
    }
    numero++;
    const { par } = mejor;
    g.bloque(rotY(mejor.k), textoRot(mejor.k, `el hueco de la pareja ${coloresPieza(par.ari)}`), { piezas: pegs(g.estado, par.esq, par.ari) });
    g.bloque(mejor.sol, `Pareja ${numero}: junta la esquina ${coloresPieza(par.esq)} con la arista ${coloresPieza(par.ari)} y mételas en su hueco (delante a la derecha) sin romper lo ya hecho.`, { piezas: pegs(g.estado, par.esq, par.ari) });
    g.comprobar(bien(g.estado, par.esq) && bien(g.estado, par.ari), 'pareja de F2L');
  }
  g.comprobar(OB.dosCapas(g.estado), 'F2L');
}

/** Aplica una secuencia de macros como bloques, con textos. */
function bloquesMacros(g, pasos, texto) {
  for (const { macro } of pasos) {
    const t = texto(macro, g.estado);
    g.bloque(macro.movs, t.texto, { algoritmo: t.algoritmo || null, piezas: t.piezas || piezasU() });
  }
}
/** Pegatinas de las piezas de la capa de arriba (para resaltarlas). */
function piezasU() {
  const s = new Set();
  for (const r of ESQ_U) r.forEach((f) => s.add(f));
  for (const r of ARI_U) r.forEach((f) => s.add(f));
  return [...s];
}
const textoAjuste = (que) => ({ texto: `Gira la capa de arriba (U) para ${que}.` });

function orientarPrincipiantes(g) {
  const cruz = { nombre: PRINCIPIANTES.cruz.nombre, movs: parsear(PRINCIPIANTES.cruz.alg) };
  const sune = { nombre: 'Sune', movs: parsear(PRINCIPIANTES.sune.alg) };
  const amarillas = (e) => [5, 7, 3, 1].filter((f) => e[f] === AMARILLO).length;

  g.etapa('Cruz amarilla', 'Hacer una cruz amarilla arriba (solo la cara de arriba; los lados aún no importan) con F R U R\' U\' F\'.', 'cruzam');
  let pasos = M.buscarMacros(g.estado, [...AJUSTES_U, cruz], OB.cruzAmarilla, 6);
  bloquesMacros(g, pasos, (mac, e) => {
    if (mac.ajuste) {
      const d = M.aplicarSec(e, mac.movs);
      const t = d[3] === AMARILLO && d[1] === AMARILLO && d[5] !== AMARILLO ? 'dejar la L amarilla detrás y a la izquierda'
        : d[3] === AMARILLO && d[5] === AMARILLO ? 'dejar la línea amarilla en horizontal (de izquierda a derecha)' : 'colocar el caso';
      return textoAjuste(t);
    }
    const n = amarillas(e);
    const caso = n === 0 ? 'Solo el centro amarillo (punto)' : n === 2 && ((e[5] === AMARILLO && e[3] === AMARILLO) || (e[7] === AMARILLO && e[1] === AMARILLO)) ? 'Línea amarilla' : 'L amarilla';
    return { texto: `${caso}: haz F R U R' U' F'.`, algoritmo: "F R U R' U' F'" };
  });
  g.comprobar(OB.cruzAmarilla(g.estado), 'cruz amarilla');

  g.etapa('Cara amarilla', 'Orientar las esquinas de arriba con Sune (repetido si hace falta) hasta tener toda la cara de arriba amarilla.', 'caraam');
  pasos = M.buscarMacros(g.estado, [...AJUSTES_U, sune], OB.caraAmarilla, 7);
  bloquesMacros(g, pasos, (mac, e) => {
    if (mac.ajuste) {
      const d = M.aplicarSec(e, mac.movs);
      const hacia = d[6] === AMARILLO ? 'arriba' : d[18] === AMARILLO ? 'hacia delante' : 'hacia la izquierda';
      return textoAjuste(`dejar la esquina de delante a la izquierda con el amarillo mirando ${hacia} antes del Sune`);
    }
    const n = [8, 6, 0, 2].filter((f) => e[f] === AMARILLO).length;
    return { texto: `${n} esquina${n === 1 ? '' : 's'} con el amarillo arriba: haz Sune (R U R' U R U2 R').`, algoritmo: 'Sune' };
  });
  g.comprobar(OB.caraAmarilla(g.estado), 'cara amarilla');
}

function permutarPrincipiantes(g) {
  const { pllOk } = preparar();
  const macrosDe = (nombres) => nombres.map((n) => pllOk.find((p) => p.nombre === n)).filter(Boolean).map((p) => ({ nombre: p.nombre, movs: p.movs }));
  g.etapa('Esquinas amarillas', 'Llevar cada esquina de arriba a su sitio (entre sus colores) con la A-perm. Si dos esquinas de un lado ya tienen el mismo color ("faros"), ese lado va detrás.', 'esqam');
  let pasos = M.buscarMacros(g.estado, [...AJUSTES_U, ...macrosDe(PRINCIPIANTES.esquinas)], OB.esquinasUltimaCapa, 5);
  bloquesMacros(g, pasos, (mac, e) => {
    if (mac.ajuste) {
      const d = M.aplicarSec(e, mac.movs);
      return textoAjuste(d[45] === d[47] ? 'dejar detrás las dos esquinas del mismo color (los faros)' : 'colocar el caso');
    }
    return { texto: `Caso: ${describirPLL(e)}. PLL ${mac.nombre} (${EFECTO_PLL[mac.nombre[0]]}).`, algoritmo: `PLL ${mac.nombre}` };
  });
  g.comprobar(OB.esquinasUltimaCapa(g.estado), 'esquinas de la última capa');

  g.etapa('Aristas amarillas', 'Llevar cada arista de arriba a su sitio con la U-perm y ajustar la capa de arriba: el cubo queda resuelto.', 'ariam');
  pasos = M.buscarMacros(g.estado, [...AJUSTES_U, ...macrosDe(PRINCIPIANTES.aristas)], OB.resuelto, 5);
  bloquesMacros(g, pasos, (mac, e) => {
    if (mac.ajuste) {
      const d = M.aplicarSec(e, mac.movs);
      return textoAjuste(OB.resuelto(d) ? 'terminar: todo queda en su sitio' : d[45] === d[46] && d[46] === d[47] ? 'dejar detrás el lado que ya está completo' : 'colocar el caso');
    }
    return { texto: `Caso: ${describirPLL(e)}. PLL ${mac.nombre} (${EFECTO_PLL[mac.nombre[0]]}).`, algoritmo: `PLL ${mac.nombre}` };
  });
  g.comprobar(OB.resuelto(g.estado), 'resuelto');
}

function oll(g) {
  const { ollOk } = preparar();
  g.etapa('OLL', 'Orientation of the last layer: dejar toda la cara de arriba amarilla con un solo algoritmo (eligiendo el caso tras ajustar la capa de arriba).', 'oll');
  const mOLL = ollOk.map((o) => ({ nombre: o.n ? `OLL ${o.n}${o.apodo ? ` (${o.apodo})` : ''}` : 'OLL', movs: o.movs }));
  let pasos = M.buscarMacros(g.estado, [...AJUSTES_U, ...mOLL], OB.caraAmarilla, 2);
  let dosPasos = false;
  if (!pasos) {
    // OLL en dos pasos (por si faltara algún caso)
    dosPasos = true;
    const ar = OLL_ARISTAS.map((o) => ({ nombre: o.nombre, movs: parsear(o.alg) }));
    pasos = M.buscarMacros(g.estado, [...AJUSTES_U, ...ar], OB.cruzAmarilla, 4) || [];
    const e2 = M.aplicarSec(g.estado, pasos.flatMap((p) => p.macro.movs));
    pasos = pasos.concat(M.buscarMacros(e2, [...AJUSTES_U, ...mOLL], OB.caraAmarilla, 3));
  }
  bloquesMacros(g, pasos, (mac, e) => {
    if (mac.ajuste) return textoAjuste('colocar el caso en la posición del algoritmo');
    return { texto: `${dosPasos ? 'OLL en dos pasos. Caso' : 'Caso'}: ${describirOLL(e)}. Algoritmo: ${mac.nombre === 'OLL' ? 'el de OLL para este caso' : mac.nombre}.`, algoritmo: mac.nombre };
  });
  g.comprobar(OB.caraAmarilla(g.estado), 'OLL');
}

function pll(g) {
  const { pllOk } = preparar();
  let pasos;
  g.etapa('PLL', 'Permutation of the last layer: llevar las piezas de arriba a su sitio con un solo algoritmo y ajustar la capa de arriba.', 'pll');
  const mPLL = pllOk.map((p) => ({ nombre: p.nombre, movs: p.movs }));
  pasos = M.buscarMacros(g.estado, [...AJUSTES_U, ...mPLL], OB.resuelto, 3);
  bloquesMacros(g, pasos, (mac, e) => {
    if (mac.ajuste) return OB.resuelto(M.aplicarSec(e, mac.movs)) ? textoAjuste('terminar (AUF): todo queda en su sitio') : textoAjuste('colocar el caso en la posición del algoritmo');
    return { texto: `Caso: ${describirPLL(e)}. Algoritmo: PLL ${mac.nombre}-perm.`, algoritmo: `PLL ${mac.nombre}-perm` };
  });
  g.comprobar(OB.resuelto(g.estado), 'resuelto');
}

export const METODOS_3x3 = [
  { id: 'principiantes', nombre: 'Principiantes (por capas)', descripcion: "Por capas: cruz blanca, esquinas blancas con R U R' U', segunda capa con dos algoritmos y la última capa en cuatro pasos (F R U R' U' F', Sune, A-perm y U-perm)." },
  { id: 'cfop', nombre: 'CFOP', descripcion: 'CFOP (Fridrich): cruz planificada entera, F2L por parejas esquina-arista, y la última capa con una OLL (57 casos) y una PLL (21 casos).' },
];

/**
 * Etapas del 3x3 (tras sujetar el cubo con el blanco abajo) sobre un guion.
 * `ganchos.trasDosCapas` y `ganchos.trasOrientar`: para las paridades de los cubos grandes.
 */
export function etapas3x3(g, metodo, ganchos = {}) {
  if (metodo === 'cfop') {
    cruzOptima(g);
    f2l(g);
    if (ganchos.trasDosCapas) ganchos.trasDosCapas();
    oll(g);
    if (ganchos.trasOrientar) ganchos.trasOrientar();
    pll(g);
  } else {
    cruzPorAristas(g);
    esquinasPrimeraCapa(g);
    segundaCapa(g);
    if (ganchos.trasDosCapas) ganchos.trasDosCapas();
    orientarPrincipiantes(g);
    if (ganchos.trasOrientar) ganchos.trasOrientar();
    permutarPrincipiantes(g);
  }
}
export { rotacionInicial };

/** Resuelve un 3x3 por un método humano. Devuelve el guion (ver guion.js). */
export function aprender3x3(estado, metodo = 'principiantes') {
  const t0 = Date.now();
  const g = crearGuion(M.aplicar, estado, { esRotacion });
  rotacionInicial(g);
  etapas3x3(g, metodo);
  const r = g.resultado(metodo);
  r.ms = Date.now() - t0;
  return r;
}

/** Para los tests: algoritmos que pasan la comprobación. */
export function algoritmosComprobados() { return preparar(); }
export { describirPLL, describirOLL, familiaPLL };
