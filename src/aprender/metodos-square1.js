// Modo aprender del Square-1: método de principiantes.
//   1. Forma de cubo: las dos capas con forma de cuadrado (la secuencia con menos barras "/";
//      se ignora la paridad, que se arregla al final).
//   2. Orientar esquinas: las cuatro esquinas de arriba arriba y las de abajo abajo.
//   3. Orientar aristas: lo mismo con las aristas.
//   4. Permutar esquinas (y la capa del medio).
//   5. Paridad, si hace falta: dos aristas intercambiadas solas, algo que no se arregla sin
//      salir de la forma de cubo; un algoritmo propio.
//   6. Permutar aristas.
// Todo en forma de cubo usa solo los giros que la conservan: (3a,3b) y "/" en las dos
// alineaciones en las que el "/" deja el cubo (las tablas de la fase 2 del solver). En cada
// etapa se busca la secuencia con menos barras que cumple su objetivo (IDA* con tablas exactas).

import { crearGuion } from './guion.js';
import {
  tablas, mascara, girarCapas, rotarArriba, rotarAbajo, MARCO_T, MARCO_B, ESTADO_MARCO, cortar,
  cortarMascaras, mascaraCortable, IDX_MASCARA, MASCARAS, esquinasDeMascara, aplicarSecuenciaIds,
  simplificar, resolverIds, paridadEstado, RESUELTO_ARRIBA, RESUELTO_ABAJO, MASCARA_RESUELTO, normalizarGiro, contarBarras, mod12,
} from '../puzzles/square1-motor.js';

const MAX_BARRAS = 14;

let datos = null;
function preparar() {
  if (datos) return datos;
  const T = tablas();
  // --- forma (sin paridad): clases de forma (arriba y abajo, salvo giros), distancia en barras a la de cubo ---
  const NM = MASCARAS.length;
  const canon = (m) => { let r = m; for (let x = 1; x < 12; x++) r = Math.min(r, rotarArriba(m, x)); return r; };
  const claseDe = (t, b) => IDX_MASCARA[canon(t)] * NM + IDX_MASCARA[canon(b)];
  const distForma = new Int8Array(NM * NM).fill(-1);
  const meta = claseDe(MARCO_T, MARCO_B);
  distForma[meta] = 0;
  let frente = [[MARCO_T, MARCO_B]];
  for (let d = 0; frente.length; d++) {
    const sig = [];
    for (const [t, b] of frente) {
      for (let x = 0; x < 12; x++) {
        const t1 = rotarArriba(t, x);
        if (!mascaraCortable(t1)) continue;
        for (let y = 0; y < 12; y++) {
          const b1 = rotarAbajo(b, y);
          if (!mascaraCortable(b1)) continue;
          const [t2, b2] = cortarMascaras(t1, b1);
          const c = claseDe(t2, b2);
          if (distForma[c] < 0) { distForma[c] = d + 1; sig.push([t2, b2]); }
        }
      }
    }
    frente = sig;
  }
  // --- tablas de orientación (0-1 BFS en las coordenadas del marco) ---
  const { movSE, movSA } = T;
  const fin = T.coordsCompletas(ESTADO_MARCO);
  const bfs01 = (N, ini, vecinos) => {
    const dist = new Int8Array(N).fill(-1);
    const cola = [];
    for (const v of ini) { dist[v] = 0; cola.push(v); }
    // 0-1 BFS por niveles: primero se cierra cada nivel con los giros (coste 0)
    let nivel = cola.slice();
    for (let d = 0; nivel.length; d++) {
      for (let i = 0; i < nivel.length; i++) {
        vecinos(nivel[i], (w, coste) => { if (coste === 0 && dist[w] < 0) { dist[w] = d; nivel.push(w); } });
      }
      const sig = [];
      for (const v of nivel) vecinos(v, (w, coste) => { if (coste === 1 && dist[w] < 0) { dist[w] = d + 1; sig.push(w); } });
      nivel = sig;
    }
    return dist;
  };
  const vecinosSE = (v, emitir) => { for (let g = 0; g < 4; g++) emitir(movSE[g][v], g >= 2 ? 1 : 0); };
  const distCO = bfs01(70, [fin.se], vecinosSE);
  const distEO = bfs01(4900, [fin.se * 70 + fin.sa], (v, emitir) => {
    const se = Math.floor(v / 70), sa = v % 70;
    for (let g = 0; g < 4; g++) emitir(movSE[g][se] * 70 + movSA[g][sa], g >= 2 ? 1 : 0);
  });
  // --- algoritmo de paridad: lleva el resuelto a "dos aristas de arriba intercambiadas" (y al revés) ---
  const par = { arriba: RESUELTO_ARRIBA.slice(), abajo: RESUELTO_ABAJO.slice(), medio: 0 };
  par.arriba[0] = 10; par.arriba[6] = 8;
  const solPar = resolverIds(par, { msMax: 400 }).movimientos;
  const invMov = (m) => { if (m === '/') return '/'; const [x, y] = m.slice(1, -1).split(',').map(Number); return `(${normalizarGiro(-x)},${normalizarGiro(-y)})`; };
  const algParidad = solPar.slice().reverse().map(invMov);
  datos = { T, distForma, claseDe, distCO, distEO, fin, algParidad, paridadMarco: paridadEstado(ESTADO_MARCO) };
  return datos;
}

/** Giro (x,y) que lleva un estado en forma de cubo a la alineación del marco. */
function giroAlMarco(e) {
  const t = mascara(e.arriba), b = mascara(e.abajo);
  let gx = -1, gy = -1;
  for (let x = 0; x < 12 && gx < 0; x++) if (rotarArriba(t, x) === MARCO_T) gx = x;
  for (let y = 0; y < 12 && gy < 0; y++) if (rotarAbajo(b, y) === MARCO_B) gy = y;
  return gx < 0 || gy < 0 ? null : [gx, gy];
}

/**
 * IDA* en las coordenadas del marco (como la fase 2 del solver): en cada paso, giros
 * (3x, 3y) y "/" en una de las dos alineaciones. objetivo(c, alin) devuelve null, true o
 * el giro final. Devuelve los pasos [[x, y], ...] (giro real antes de cada "/") y el final.
 */
function buscarMarco(T, c0, objetivo, h, maxProf) {
  const { movE, movA, movSE, movSA } = T;
  const mover = (c, g) => ({ ce: movE[g][c.ce], ca: movA[g][c.ca], se: movSE[g][c.se], sa: movSA[g][c.sa], m: g >= 2 ? c.m ^ 1 : c.m });
  const pasos = [];
  function buscar(c, alin, d, primera) {
    if (d === 0) return objetivo(c, alin);
    let c1 = c;
    for (let x = 0; x < 4; x++) {
      let c2 = c1;
      for (let y = 0; y < 4; y++) {
        for (let nueva = 0; nueva < 2; nueva++) {
          if (!primera && x === 0 && y === 0 && nueva === alin) continue;
          const c3 = mover(c2, 2 + nueva);
          if (h(c3) > d - 1) continue;
          pasos.push([3 * x + nueva - alin, 3 * y + nueva - alin]);
          const r = buscar(c3, nueva, d - 1, false);
          if (r) return r;
          pasos.pop();
        }
        c2 = mover(c2, 1);
      }
      c1 = mover(c1, 0);
    }
    return null;
  }
  const h0 = h(c0);
  if (h0 < 0 || h0 === Infinity) return null;
  for (let d = h0; d <= maxProf; d++) {
    const r = buscar(c0, 0, d, true);
    if (r) return { pasos: pasos.slice(), final: r === true ? null : r };
  }
  return null;
}

const giro = (x, y) => `(${normalizarGiro(x)},${normalizarGiro(y)})`;

export function crearAprenderSquare1({ aplicarMovimiento, analizar }) {
  return function aprenderSquare1(estado) {
    const t0 = Date.now();
    const a = analizar(estado);
    if (!a.valido) return { ok: false, errores: a.errores };
    const D = preparar();
    const { T } = D;
    const g = crearGuion(aplicarMovimiento, estado);
    let ids = a.ids;
    const hacer = (movs, texto, algoritmo = null) => {
      const sm = simplificar(movs);
      ids = aplicarSecuenciaIds(ids, sm); // lanza un error si algún "/" es ilegal
      g.bloque(sm, texto, { algoritmo });
    };
    const esquinasArriba = (e) => esquinasDeMascara(mascara(e.arriba));

    // 1. Forma de cubo
    g.etapa('Forma de cubo', 'Dar a las dos capas forma de cuadrado (cuatro esquinas y cuatro aristas en cada una, alternadas). Es lo primero porque sin forma de cubo casi ningún giro conserva las piezas en su sitio; aquí se ignora la paridad, que se arregla al final si hace falta.', 'forma');
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const t = mascara(ids.arriba), b = mascara(ids.abajo);
      const d = D.distForma[D.claseDe(t, b)];
      g.comprobar(d >= 0, 'forma de cubo: forma no alcanzable');
      if (d === 0) break;
      let mejor = null;
      for (let x = -5; x <= 6; x++) {
        const t1 = rotarArriba(t, mod12(x));
        if (!mascaraCortable(t1)) continue;
        for (let y = -5; y <= 6; y++) {
          const b1 = rotarAbajo(b, mod12(y));
          if (!mascaraCortable(b1)) continue;
          const [t2, b2] = cortarMascaras(t1, b1);
          if (D.distForma[D.claseDe(t2, b2)] !== d - 1) continue;
          const coste = Math.abs(x) + Math.abs(y);
          if (!mejor || coste < mejor.coste) mejor = { x, y, coste };
        }
      }
      g.comprobar(!!mejor, 'forma de cubo: paso');
      const antes = `${esquinasArriba(ids)} esquinas arriba y ${8 - esquinasArriba(ids)} abajo`;
      const tras = cortar(girarCapas(ids, mejor.x, mejor.y));
      const despues = `${esquinasArriba(tras)} arriba y ${8 - esquinasArriba(tras)} abajo`;
      hacer([giro(mejor.x, mejor.y), '/'], d === 1
        ? `Último paso a la forma de cubo (hay ${antes}): coloca las capas con ${giro(mejor.x, mejor.y)} y haz "/": las dos capas quedan cuadradas.`
        : `Hay ${antes}. Coloca las capas con ${giro(mejor.x, mejor.y)} y haz "/" (quedan ${despues}); ${d - 1 === 1 ? 'falta 1 barra' : `faltan ${d - 1} barras`} para la forma de cubo.`);
    }
    g.comprobar(D.distForma[D.claseDe(mascara(ids.arriba), mascara(ids.abajo))] === 0, 'forma de cubo');

    /** Una etapa en forma de cubo: alinea con el marco y busca con IDA*. */
    const etapaCubo = (objetivo, h, texto, algoritmo, maxProf = MAX_BARRAS) => {
      const gm = giroAlMarco(ids);
      g.comprobar(!!gm, 'forma de cubo perdida');
      const em = girarCapas(ids, gm[0], gm[1]);
      const c0 = { ...T.coordsCompletas(em), m: em.medio };
      const r = buscarMarco(T, c0, objetivo, h, maxProf);
      g.comprobar(!!r, 'etapa en forma de cubo: sin solución');
      const movs = [giro(gm[0], gm[1])];
      for (const [x, y] of r.pasos) movs.push(giro(x, y), '/');
      if (r.final) movs.push(giro(r.final[0], r.final[1]));
      const sm = simplificar(movs);
      if (sm.length) hacer(sm, texto(r.pasos.length, c0), algoritmo);
      return r;
    };
    const { fin } = D;
    const coSi = (c) => c.se === fin.se;
    const eoSi = (c) => coSi(c) && c.sa === fin.sa;

    // 2. Orientar esquinas
    g.etapa('Orientar esquinas', 'Las cuatro esquinas de la capa de arriba (las que tienen el color de arriba) arriba, y las de abajo abajo, sin perder la forma de cubo. Solo se usan giros de 90° (3,0), (0,3) y "/" con las capas alineadas.', 'co');
    {
      etapaCubo((c) => (coSi(c) ? true : null), (c) => D.distCO[c.se], (n) => `Lleva las esquinas de arriba a la capa de arriba (y las de abajo abajo) con ${n} barra${n === 1 ? '' : 's'}: cada "/" cambia de capa tres piezas de la mitad derecha.`);
    }
    // 3. Orientar aristas
    g.etapa('Orientar aristas', 'Lo mismo con las aristas: las cuatro de arriba arriba y las de abajo abajo, sin deshacer las esquinas.', 'eo');
    etapaCubo((c) => (eoSi(c) ? true : null), (c) => D.distEO[c.se * 70 + c.sa], (n) => `Lleva las aristas de arriba a la capa de arriba (y las de abajo abajo) con ${n} barra${n === 1 ? '' : 's'}, sin mover las esquinas de capa.`);

    // 4. Permutar esquinas (y la capa del medio)
    const objA = (c) => T.podaA[(c.ce * 70 + c.sa) * 2 + c.m];
    g.etapa('Permutar esquinas', 'Cada esquina a su sitio dentro de su capa (con los colores de los lados a juego), sin desorientar nada; de paso, la capa del medio queda bien (sin voltear).', 'cp');
    etapaCubo((c) => (objA(c) === 0 ? true : null), (c) => objA(c), (n) => `Coloca las esquinas en su sitio con ${n} barra${n === 1 ? '' : 's'} (cada esquina queda junto a las de sus colores; la capa del medio, recta).`);

    // 5. Paridad (si hace falta) y 6. permutar aristas
    const coordsAhora = () => { const gm = giroAlMarco(ids); const em = girarCapas(ids, gm[0], gm[1]); return { ...T.coordsCompletas(em), m: em.medio }; };
    const objB = (c) => T.podaB[(c.ca * 70 + c.se) * 2 + c.m];
    // con la forma de cubo, se puede terminar sin salir de ella solo si la paridad es la del marco
    const conParidad = () => { const gm = giroAlMarco(ids); return paridadEstado(girarCapas(ids, gm[0], gm[1])) !== D.paridadMarco; };
    void coordsAhora;
    if (conParidad()) {
      g.etapa('Paridad', 'Quedan dos aristas intercambiadas solas: con los giros que conservan la forma de cubo es imposible arreglarlo (es la paridad del Square-1). El algoritmo de paridad sale de la forma de cubo y vuelve, intercambiando dos aristas.', 'paridad');
      // alinear con el resuelto (las dos capas como en el puzzle resuelto) y aplicar el algoritmo
      const t = mascara(ids.arriba), b = mascara(ids.abajo);
      let gx = 0, gy = 0;
      for (let x = 0; x < 12; x++) if (rotarArriba(t, x) === MASCARA_RESUELTO) { gx = x; break; }
      for (let y = 0; y < 12; y++) if (rotarAbajo(b, y) === MASCARA_RESUELTO) { gy = y; break; }
      const alinear = gx || gy ? `alinea las capas con ${giro(gx, gy)} y haz` : 'haz';
      hacer([giro(gx, gy), ...D.algParidad], `Paridad: ${alinear} el algoritmo de paridad (${contarBarras(D.algParidad)} barras), que intercambia las aristas de delante y de detrás de arriba y deja todo lo demás como estaba.`, 'Paridad');
      g.comprobar(!conParidad(), 'paridad');
    }
    g.etapa('Permutar aristas', 'Cada arista a su sitio, sin mover las esquinas, y el giro final de las capas para que todo quede resuelto.', 'ep');
    etapaCubo((c, alin) => {
      if (c.m !== 0) return null;
      // como en la fase 2 del solver: el giro final hasta el resuelto
      let ce = c.ce, ca = c.ca;
      for (let x = 0; x < 4; x++) {
        let e2 = ce, a2 = ca;
        for (let y = 0; y < 4; y++) {
          const o = T.objetivoDe.get(e2 * 40320 + a2);
          if (o) return [3 * x - 3 * o.a - alin, 3 * y - 3 * o.b + 1 - alin];
          e2 = T.movE[1][e2]; a2 = T.movA[1][a2];
        }
        ce = T.movE[0][ce]; ca = T.movA[0][ca];
      }
      return null;
    }, (c) => Math.max(objA(c), objB(c)), (n) => (n ? `Coloca las aristas en su sitio con ${n} barra${n === 1 ? '' : 's'} y termina con el giro de las capas.` : 'Gira las capas para terminar: todo queda en su sitio.'));
    g.comprobar(ids.medio === 0 && RESUELTO_ARRIBA.every((v, k) => ids.arriba[k] === v) && RESUELTO_ABAJO.every((v, k) => ids.abajo[k] === v), 'resuelto');
    const r = g.resultado('principiantes');
    r.ms = Date.now() - t0;
    return r;
  };
}

export const METODOS_SQUARE1 = [
  { id: 'principiantes', nombre: 'Principiantes', descripcion: 'Forma de cubo, orientar esquinas y aristas, permutar esquinas, paridad (si hace falta) y permutar aristas.' },
];
