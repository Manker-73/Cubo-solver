// Cubos grandes (4x4 ... 7x7): validador y solucionador por reducción.
//
// Validador: orientación libre (centros fijos en N impar; esquina DBL en N par),
// identificación de esquinas, aristas centrales y wings por colores, centros
// contados por órbita, y solo las restricciones demostradas en nxn-grupo.js.
//
// Solver:
//   4x4      reducción por búsqueda en tres fases (tpr4.js)
//   5x5-7x7  centros   búsqueda por parejas de órbitas (nxn-centros.js); lo que
//                      falte (los oblicuos del 6x6/7x7), 3-ciclos simples y dobles
//            aristas   1) "aristas libres": voraz con macros S·(A M A⁻¹)·S⁻¹ que no
//                         mueven los centros (con un paso de anticipación);
//                      2) lo que quede, con 3-ciclos de wings. En N impar cada wing
//                         va con su arista central; en N par se elige al final qué
//                         arista entera va en cada ranura (la que ya está más formada)
//            paridad   N par: si la permutación de las aristas no tiene la paridad
//                      de la de las esquinas, intercambio de las aristas UF y UB
//   3x3      lo que queda es un 3x3: Kociemba (cubo3.js)
// Si una búsqueda no termina, se usa el método de conmutadores (siempre correcto).
// Las soluciones se simplifican uniendo los tramos del mismo eje.

import { definirPuzzle } from '../core/puzzle.js';
import { aprenderReduccion, METODOS_NxN } from '../aprender/metodos-nxn.js';
import { crearModeloPiezas } from '../core/piezas.js';
import { reetiquetar } from '../core/simetria.js';
import { componer, invertir, paridad, identidad } from '../core/perm.js';
import {
  baseNxN, crearNxN, nombreMovimiento, invertirMovimientoNxN, simplificarNxN, redundanciaSolucionNxN, CARAS,
} from './nxn.js';
import { modeloPiezasNxN } from './nxn-piezas.js';
import {
  rotacionesColorCubo, comprobarConteo, erroresDePiezas, nombreColor, listaColores, NOMBRES_ARISTAS,
} from './cubo-comun.js';
import cubo3 from './cubo3.js';
import { tpr4 } from './tpr4.js';
import { crearCentrosNxN } from './nxn-centros.js';

const PLURAL = { blanco: 'blancos', rojo: 'rojos', verde: 'verdes', amarillo: 'amarillos', naranja: 'naranjas', azul: 'azules' };
const NOMBRE_CARA = ['arriba (U)', 'derecha (R)', 'delante (F)', 'abajo (D)', 'izquierda (L)', 'detrás (B)'];
export const FASES = ['paridad', 'centros', 'aristas', '3x3'];

export function crearCuboGrande(N) {
  const b = baseNxN(N);
  const n2 = N * N;
  const RES = b.estadoResuelto();
  const { orbitas, fijos } = modeloPiezasNxN(N);
  const oiEsq = orbitas.findIndex((o) => o.tipo === 'esquinas');
  const oiMid = orbitas.findIndex((o) => o.tipo === 'aristas');
  const oiWings = orbitas.map((o, i) => (o.tipo === 'wings' ? i : -1)).filter((i) => i >= 0);
  const oiCentros = orbitas.map((o, i) => (o.tipo === 'centros' ? i : -1)).filter((i) => i >= 0);
  const impar = N % 2 === 1;
  const caraDe = (i) => Math.floor(i / n2);

  // Modelo de esquinas (+ aristas centrales) para identificar por colores
  const orbs3 = [orbitas[oiEsq]].concat(impar ? [orbitas[oiMid]] : []);
  const modelo3 = crearModeloPiezas({
    orbitas: orbs3.map((o) => ({ nombre: o.nombre, piezas: o.piezas })),
    movimientos: {},
    coloresResuelto: RES,
  });
  const coloresPieza3 = orbs3.map((o) => o.piezas.map((pz) => pz.map((f) => RES[f])));
  const sigmas = rotacionesColorCubo(N);
  const DBL = 6;

  // Wings: colores (en el resuelto) -> pieza, por órbita
  const wingPorColores = oiWings.map((oi) => new Map(orbitas[oi].piezas.map((pz, j) => [RES[pz[0]] + ',' + RES[pz[1]], j])));
  // Arista (0..11) de cada wing
  const aristaDeWing = oiWings.map((oi) => orbitas[oi].nombresPos.map((n) => NOMBRES_ARISTAS.indexOf(n.split(' ')[0])));
  // posición a lo largo de la arista (1..N-2) de cada wing, y wing de cada (ranura, posición)
  const tDeWing = oiWings.map((oi) => orbitas[oi].nombresPos.map((n) => +n.match(/n\.º (\d+)/)[1]));
  const posWing = new Map();
  oiWings.forEach((oi, w) => orbitas[oi].piezas.forEach((pz, j) => posWing.set(aristaDeWing[w][j] + ':' + tDeWing[w][j], pz)));
  // N par: la posición de referencia de cada una (hacia el centro; las dos del medio, entre sí)
  const refT = (t) => { const m = (N - 2) / 2; return t === m ? m + 1 : t === m + 1 ? m : t < m ? t + 1 : t - 1; };

  // ---------- Validador ----------
  function analizarCentrosFijos(estado) {
    const c = fijos.map((i) => estado[i]);
    const errores = [];
    if (new Set(c).size !== 6) return { errores: ['Los seis centros fijos (el del medio de cada cara) deben tener seis colores distintos.'] };
    for (let f = 0; f < 3; f++) {
      if ((c[f] + 3) % 6 !== c[f + 3]) {
        errores.push(`Los centros fijos de ${NOMBRE_CARA[f]} (${nombreColor(c[f])}) y ${NOMBRE_CARA[f + 3]} (${nombreColor(c[f + 3])}) deberían ser colores opuestos (blanco–amarillo, rojo–naranja, verde–azul).`);
      }
    }
    if (errores.length) return { errores };
    const sigma = new Array(6);
    c.forEach((col, f) => { sigma[col] = f; });
    const urf = [c[0], c[1], c[2]];
    const existe = coloresPieza3[0].some((s) => [0, 1, 2].some((r) => s.every((x, j) => x === urf[(j + r) % 3])));
    if (!existe) return { errores: ['Los centros fijos están colocados como en la imagen especular de un cubo real (revisa sus colores).'] };
    return { errores, sigma };
  }

  function analizar(estado) {
    let errores = comprobarConteo(estado, n2);
    if (errores.length) return { valido: false, errores };
    let sigma;
    if (impar) {
      const cen = analizarCentrosFijos(estado);
      if (cen.errores.length) return { valido: false, errores: cen.errores };
      sigma = cen.sigma;
    } else {
      // la orientación la marca la esquina DBL
      const ident0 = modelo3.identificar(estado);
      errores = erroresDePiezas(ident0, [orbs3[0].nombresPos], ['esquina'], [coloresPieza3[0]]);
      if (errores.length) return { valido: false, errores };
      const pos = orbs3[0].piezas[DBL];
      sigma = sigmas.find((s) => pos.every((f, j) => s[estado[f]] === coloresPieza3[0][DBL][j]));
      if (!sigma) return { valido: false, errores: ['No se pudo determinar la orientación del cubo.'] };
    }
    const orig = (x) => sigma.indexOf(x); // color normalizado -> color pintado
    const norm = reetiquetar(estado, sigma);

    // Esquinas y aristas centrales
    const ident = modelo3.identificar(norm);
    const identOrig = { errores: ident.errores.map((e) => ({ ...e, colores: e.colores.map(orig) })), orbitas: ident.orbitas };
    errores = erroresDePiezas(identOrig, orbs3.map((o) => o.nombresPos), ['esquina', 'arista central'],
      coloresPieza3.map((o) => o.map((s) => s.map(orig))));

    // Wings
    const wings = [];
    oiWings.forEach((oi, w) => {
      const orb = orbitas[oi];
      const perm = [];
      const errW = [];
      orb.piezas.forEach((pz, j) => {
        const x = norm[pz[0]], y = norm[pz[1]];
        const pieza = wingPorColores[w].get(x + ',' + y);
        perm.push(pieza ?? -1);
        if (pieza !== undefined) return;
        const cols = listaColores([orig(x), orig(y)]);
        const porque = x === y ? ' (tiene un color repetido)' : (x + 3) % 6 === y ? ' (tiene dos colores de caras opuestas)' : '';
        errW.push(`La wing en ${orb.nombresPos[j]} (${cols}) no existe en un cubo real${porque}.`);
      });
      if (!errW.length) {
        // Cada wing tiene una "gemela" con los colores al revés (la otra de su
        // arista). Una wing volteada en su sitio se lee como su gemela repetida.
        const veces = new Array(24).fill(0);
        const donde = Array.from({ length: 24 }, () => []);
        perm.forEach((p, j) => { veces[p]++; donde[p].push(orb.nombresPos[j]); });
        const colsDe = (p) => { const pz = orb.piezas[p]; return listaColores([orig(RES[pz[0]]), orig(RES[pz[1]])]); };
        const gemela = (p) => { const pz = orb.piezas[p]; return wingPorColores[w].get(RES[pz[1]] + ',' + RES[pz[0]]); };
        const explicadas = new Set();
        veces.forEach((v, p) => {
          if (v < 2) return;
          const q = gemela(p);
          if (v === 2 && veces[q] === 0) {
            explicadas.add(q);
            errW.push(`Una wing está en una posición imposible (volteada en su sitio): la wing ${colsDe(p)} aparece 2 veces (en ${donde[p].join(' y en ')}) y falta la ${colsDe(q)}. En un cubo real una wing no se puede voltear sin cambiarla de sitio; probablemente hay dos pegatinas cambiadas.`);
          } else {
            errW.push(`La wing ${colsDe(p)} (de las ${orb.nombre}) aparece ${v} veces (en ${donde[p].join(', ')}).`);
          }
        });
        veces.forEach((v, p) => { if (v === 0 && !explicadas.has(p)) errW.push(`Falta una wing ${colsDe(p)} (de las ${orb.nombre}).`); });
      }
      errores.push(...errW);
      wings.push(perm);
    });

    // Centros: 4 de cada color en cada órbita
    for (const oi of oiCentros) {
      const orb = orbitas[oi];
      const cuenta = new Array(6).fill(0);
      for (const pz of orb.piezas) cuenta[norm[pz[0]]]++;
      cuenta.forEach((n, x) => {
        const col = PLURAL[nombreColor(orig(x))];
        if (n < 4) errores.push(`Faltan centros ${col}: hay ${n} ${orb.nombre} ${col} y debería haber 4.`);
        if (n > 4) errores.push(`Sobran centros ${col}: hay ${n} ${orb.nombre} ${col} y debería haber 4.`);
      });
    }
    if (errores.length) return { valido: false, errores };

    // Restricciones demostradas (DECISIONES.md): giro de esquinas, volteo de
    // aristas centrales y, en N impar, paridad esquinas = aristas centrales.
    const [E, A] = ident.orbitas;
    const giro = E.ori.reduce((a, x) => a + x, 0) % 3;
    if (giro !== 0) errores.push(`Una esquina está girada: la suma de las orientaciones de las esquinas no es múltiplo de 3 (sobra ${giro === 1 ? 'un giro horario' : 'un giro antihorario'}).`);
    if (impar) {
      if (A.ori.reduce((a, x) => a + x, 0) % 2) errores.push('Una arista central está volteada: hay un número impar de aristas centrales mal orientadas.');
      if (paridad(E.perm) !== paridad(A.perm)) errores.push('Dos piezas están intercambiadas: la paridad de la permutación de las esquinas no coincide con la de las aristas centrales.');
    }
    if (errores.length) return { valido: false, errores };
    return { valido: true, errores: [], norm, sigma, esquinas: E, wings };
  }

  // ---------- Conmutadores puros ----------
  let tablas = null;

  const permSec = (movs) => movs.reduce((P, m) => componer(P, b.permDe(m)), identidad(6 * n2));
  const invSec = (movs) => movs.slice().reverse().map(invertirMovimientoNxN);

  function inicializar(opciones0 = {}) {
    if (tablas) return { ms: tablas.ms, yaEstaba: true };
    const t0 = Date.now();
    const msK = cubo3.inicializar().ms || 0;
    const nPeg = 6 * n2;
    // pieza global de cada pegatina
    const piezaDe = new Int32Array(nPeg).fill(-1);
    let nPiezas = 0;
    const orbitaDePieza = [];
    orbitas.forEach((o, oi) => o.piezas.forEach((pz) => { for (const f of pz) piezaDe[f] = nPiezas; orbitaDePieza.push(oi); nPiezas++; }));
    if (fijos) for (const f of fijos) { piezaDe[f] = nPiezas++; orbitaDePieza.push(-1); }
    const palabras = Math.ceil(nPiezas / 32);
    const soporte = (P) => {
      const s = new Uint32Array(palabras);
      for (let i = 0; i < nPeg; i++) if (P[i] !== i) { const p = piezaDe[i]; s[p >> 5] |= 1 << (p & 31); }
      return s;
    };
    const op = (movs) => { const P = permSec(movs); return { movs, P, s: soporte(P) }; };
    const simples = [], caras1 = [], rodajas = [];
    for (const c of CARAS) for (let p = 1; p < N; p++) for (let v = 1; v <= 3; v++) {
      const o = op([nombreMovimiento(c, p, v)]);
      simples.push(o);
      if (p === 1) caras1.push(o);
    }
    for (const c of ['U', 'R', 'F']) for (let p = 2; p < N; p++) for (let v = 1; v <= 3; v++) {
      rodajas.push(op([nombreMovimiento(c, p, v), nombreMovimiento(c, p - 1, 4 - v)]));
    }
    const X = rodajas.concat(simples);
    const Y = [];
    const ejeDe = (o) => 'UDRLFB'.indexOf(o.movs[0].replace(/[^URFDLB]/g, '')) >> 1;
    for (const A of caras1) for (const B of rodajas.concat(caras1)) {
      if (ejeDe(A) === ejeDe(B)) continue;
      Y.push(op([A.movs[0], ...B.movs, invertirMovimientoNxN(A.movs[0])]));
    }
    // bases por órbita: { movs, ciclo: [p1, p2, p3] } (la pieza de p1 va a p2...)
    const bases = orbitas.map(() => []);
    const primaria = orbitas.map((o) => new Map(o.piezas.map((pz, j) => [pz[0], j])));
    const vistos = new Set();
    for (const x of X) for (const y of Y) {
      let comun = 0, pc = -1;
      for (let w = 0; w < palabras && comun < 2; w++) {
        let v = x.s[w] & y.s[w];
        while (v && comun < 2) { const t = v & -v; pc = w * 32 + 31 - Math.clz32(t); comun++; v ^= t; }
      }
      if (comun !== 1) continue;
      const oi = orbitaDePieza[pc];
      if (oi < 0 || (orbitas[oi].tipo !== 'centros' && orbitas[oi].tipo !== 'wings')) continue;
      const P = componer(componer(componer(x.P, y.P), invertir(x.P)), invertir(y.P));
      const movidas = [];
      for (let i = 0; i < nPeg; i++) if (P[i] !== i) movidas.push(i);
      const m = orbitas[oi].piezas[0].length;
      if (movidas.length !== 3 * m || !movidas.every((i) => orbitaDePieza[piezaDe[i]] === oi)) continue;
      // ciclo en las pegatinas primarias: la pegatina j va a la posición i con P[i] = j
      const prim = movidas.filter((i) => primaria[oi].has(i));
      if (prim.length !== 3) continue;
      const destino = (j) => P.indexOf(j);
      const p1 = prim[0], p2 = destino(p1), p3 = destino(p2);
      if (destino(p3) !== p1) continue;
      const movs = simplificarNxN([...x.movs, ...y.movs, ...invSec(x.movs), ...invSec(y.movs)], N).movimientos;
      const ciclo = [p1, p2, p3].map((f) => primaria[oi].get(f));
      const clave = oi + ':' + movs.join(' ');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      bases[oi].push({ movs, ciclo });
    }
    // Setups: caras y capas anchas hasta N/2
    const setups = [];
    for (const c of CARAS) for (let p = 1; p <= Math.floor(N / 2); p++) for (let v = 1; v <= 3; v++) setups.push(nombreMovimiento(c, p, v));
    const porOrbita = orbitas.map((orb, oi) => {
      if (orb.tipo !== 'centros' && orb.tipo !== 'wings') return null;
      const lista = bases[oi];
      if (!lista.length) throw new Error(`No se encontró ningún 3-ciclo puro para ${orb.nombre} (${N}x${N})`);
      const minimo = Math.min(...lista.map((x) => x.movs.length));
      const usadas = lista.filter((x) => x.movs.length <= minimo + 2);
      // destino de cada posición con cada setup (y con su inverso)
      const nS = orb.piezas.length;
      const destinoCon = (P) => orb.piezas.map((pz) => primaria[oi].get(P.indexOf(pz[0])));
      const destSetupInv = setups.map((m) => destinoCon(b.permDe(invertirMovimientoNxN(m))));
      const destSetup = setups.map((m) => destinoCon(b.permDe(m)));
      // Dial: coste = longitud de la base + 2·(movimientos de setup)
      const T = nS * nS * nS;
      const coste = new Int16Array(T).fill(-1);
      const primerMov = new Int16Array(T).fill(-1);
      const siguiente = new Int32Array(T).fill(-1);
      const base = new Int16Array(T).fill(-1);
      const inversa = new Uint8Array(T);
      const cubos = [];
      const meter = (k, c) => { (cubos[c] = cubos[c] || []).push(k); };
      const idx = (a, b2, c) => (a * nS + b2) * nS + c;
      const tentativo = new Int16Array(T).fill(32767);
      usadas.forEach((x, bi) => {
        const [p1, p2, p3] = x.ciclo;
        const rot = [[p1, p2, p3], [p2, p3, p1], [p3, p1, p2]];
        for (const [a, b2, c] of rot) {
          for (const [k, inv] of [[idx(a, b2, c), 0], [idx(a, c, b2), 1]]) {
            if (x.movs.length < tentativo[k]) { tentativo[k] = x.movs.length; base[k] = bi; inversa[k] = inv; meter(k, x.movs.length); }
          }
        }
      });
      for (let c = 0; c < cubos.length; c++) {
        const cola = cubos[c];
        if (!cola) continue;
        for (let q = 0; q < cola.length; q++) {
          const k = cola[q];
          if (coste[k] >= 0 || tentativo[k] !== c) continue;
          coste[k] = c;
          const a = Math.floor(k / (nS * nS)), b2 = Math.floor(k / nS) % nS, cc = k % nS;
          for (let m = 0; m < setups.length; m++) {
            const d = destSetupInv[m];
            const k2 = idx(d[a], d[b2], d[cc]);
            if (coste[k2] >= 0 || tentativo[k2] <= c + 2) continue;
            tentativo[k2] = c + 2; primerMov[k2] = m; siguiente[k2] = k; base[k2] = base[k]; inversa[k2] = inversa[k];
            meter(k2, c + 2);
          }
        }
      }
      // secuencia que lleva la pieza de a a b, la de b a c y la de c a a
      function secuencia(a, b2, c) {
        let k = idx(a, b2, c);
        if (coste[k] < 0) return null;
        const S = [];
        while (primerMov[k] >= 0) { S.push(setups[primerMov[k]]); k = siguiente[k]; }
        const B = usadas[base[k]].movs;
        return [...S, ...(inversa[k] ? invSec(B) : B), ...invSec(S)];
      }
      return { nS, coste, idx, secuencia, nBases: usadas.length, longitudBase: minimo, destSetup };
    });

    // ---- Conmutadores dobles: dos 3-ciclos a la vez, en dos órbitas del mismo tipo ----
    // (p. ej. una wing exterior y una interior de la misma arista, o un centro
    // oblicuo de cada órbita). X: una capa (o dos capas interiores juntas), Y = A·B·A⁻¹.
    const dobles = [];
    if (N >= 5) {
      const Xd = rodajas.concat(simples);
      for (const c of ['U', 'R', 'F']) for (let p = 3; p < N; p++) for (let v = 1; v <= 3; v++) {
        Xd.push(op([nombreMovimiento(c, p, v), nombreMovimiento(c, 1, 4 - v)])); // capas 2..p
      }
      const Yd = [];
      for (const A of caras1) for (const B of Xd) {
        if (ejeDe(A) === ejeDe(B)) continue;
        Yd.push(op([A.movs[0], ...B.movs, invertirMovimientoNxN(A.movs[0])]));
      }
      const vistosD = new Set();
      const MAXC = opciones0.maxCiclos ?? 4;
      for (const x of Xd) for (const y of Yd) {
        let comun = 0;
        const pcs = [];
        for (let w = 0; w < palabras && comun <= MAXC; w++) {
          let v = x.s[w] & y.s[w];
          while (v && comun <= MAXC) { const t = v & -v; pcs.push(w * 32 + 31 - Math.clz32(t)); comun++; v ^= t; }
        }
        if (comun < 2 || comun > MAXC) continue;
        const os = pcs.map((pc) => orbitaDePieza[pc]);
        if (os.some((o) => o < 0)) continue;
        const tipo = orbitas[os[0]].tipo;
        if ((tipo !== 'centros' && tipo !== 'wings') || os.some((o) => orbitas[o].tipo !== tipo)) continue;
        const P = componer(componer(componer(x.P, y.P), invertir(x.P)), invertir(y.P));
        const movidas = [];
        for (let i = 0; i < nPeg; i++) if (P[i] !== i) movidas.push(i);
        const m = orbitas[os[0]].piezas[0].length;
        if (movidas.length !== 3 * comun * m) continue;
        if (!movidas.every((i) => os.includes(orbitaDePieza[piezaDe[i]]))) continue;
        // descomponer en 3-ciclos de piezas (pegatinas primarias)
        const destino = (j) => P.indexOf(j);
        const ciclos = [];
        const usados = new Set();
        let ok = true;
        for (const oi of [...new Set(os)]) {
          for (const p1 of movidas.filter((i) => primaria[oi].has(i))) {
            if (usados.has(p1)) continue;
            const p2 = destino(p1), p3 = destino(p2);
            if (destino(p3) !== p1 || p2 === p1 || !primaria[oi].has(p2) || !primaria[oi].has(p3)) { ok = false; break; }
            [p1, p2, p3].forEach((z) => usados.add(z));
            ciclos.push({ oi, c: [p1, p2, p3].map((f) => primaria[oi].get(f)) });
          }
          if (!ok) break;
        }
        if (!ok || ciclos.length !== comun) continue;
        const movs = simplificarNxN([...x.movs, ...y.movs, ...invSec(x.movs), ...invSec(y.movs)], N).movimientos;
        const clave = movs.join(' ');
        if (vistosD.has(clave)) continue;
        vistosD.add(clave);
        dobles.push({ movs, ciclos });
        dobles.push({ movs: invSec(movs), ciclos: ciclos.map((c) => ({ oi: c.oi, c: [c.c[0], c.c[2], c.c[1]] })) });
      }
      // solo los más cortos de cada pareja de órbitas
      const minimo = new Map();
      for (const d of dobles) { const k = d.ciclos.map((c) => c.oi).sort().join(); minimo.set(k, Math.min(minimo.get(k) ?? 99, d.movs.length)); }
      const cortos = dobles.filter((d) => d.movs.length <= minimo.get(d.ciclos.map((c) => c.oi).sort().join()) + (opciones0.margenDobles ?? (N >= 6 ? 2 : 0)));
      dobles.length = 0; dobles.push(...cortos);
    }
    // setups para los dobles: ninguno, un movimiento (caras y capas anchas) o dos caras
    const setupsD = [[]];
    for (const m of setups) setupsD.push([m]);
    for (const m1 of caras1) for (const m2 of caras1) if (ejeDe(m1) !== ejeDe(m2)) setupsD.push([m1.movs[0], m2.movs[0]]);
    // para cada setup S y órbita: posición x -> S⁻¹(x) (la base actúa en S(x))
    const invSetup = setupsD.map((S) => {
      let Pinv = identidad(nPeg);
      for (const m of S) Pinv = componer(Pinv, b.permDe(m)); // tras S, en i está lo que había en Pinv[i]
      return orbitas.map((o, oi) => {
        if (o.tipo !== 'centros' && o.tipo !== 'wings') return null;
        return Int8Array.from(o.piezas.map((pz) => primaria[oi].get(Pinv[pz[0]])));
      });
    });

    // Paridad de wings: una capa interior que mueva la órbita con permutación impar
    const paridadWings = oiWings.map((oi) => {
      for (let p = 2; p <= Math.floor(N / 2); p++) {
        const movs = [nombreMovimiento('R', p, 1), nombreMovimiento('R', p - 1, 3)];
        const P = permSec(movs);
        const ok = orbitas.every((o, oj) => {
          if (o.tipo === 'centros') return true;
          const perm = o.piezas.map((pz) => {
            const d = P.indexOf(pz[0]);
            return o.piezas.findIndex((q) => q.includes(d));
          });
          const par = paridad(perm);
          return oj === oi ? par === 1 : perm.every((x, j) => x === j);
        });
        if (ok) return movs;
      }
      throw new Error(`No se encontró la capa de paridad de ${orbitas[oi].nombre}`);
    });

    // Paridad PLL (N par): r2 U2 r2 Uw2 r2 Uw2 U2, con r = capas interiores 2..N/2 y Uw = N/2 capas.
    // Se comprueba aquí que solo intercambia las aristas UF y UB enteras.
    let pll = null;
    if (!impar) {
      const h = N / 2;
      const r2 = [nombreMovimiento('R', h, 2), 'R2'];
      const uw2 = nombreMovimiento('U', h, 2);
      const movs = simplificarNxN([...r2, 'U2', ...r2, uw2, ...r2, uw2, 'U2'], N).movimientos;
      const e = movs.reduce((s, m) => b.aplicarMovimiento(s, m), RES);
      const iUF = NOMBRES_ARISTAS.indexOf('UF'), iUB = NOMBRES_ARISTAS.indexOf('UB');
      const esperado = RES.slice();
      // en UF deben quedar los colores U/B y en UB los U/F
      oiWings.forEach((oi, w) => orbitas[oi].piezas.forEach((pz, j) => {
        const ar = aristaDeWing[w][j];
        for (const f of pz) {
          if (ar === iUF && caraDe(f) === 2) esperado[f] = 5; // pegatina de F con el color de B
          if (ar === iUB && caraDe(f) === 5) esperado[f] = 2; // pegatina de B con el color de F
        }
      }));
      if (e.every((x, i) => x === esperado[i])) pll = movs;
    }
    // Movimientos "libres" para la primera parte de los centros (antes no hay nada
    // resuelto que proteger): caras y capas anchas hasta N/2 y capas interiores
    // sueltas, sin mover los centros fijos (N impar). Se guarda su efecto sobre
    // las pegatinas de centros.
    const pegCentros = [];
    for (const oi of oiCentros) for (const pz of orbitas[oi].piezas) pegCentros.push(pz[0]);
    const posEnCentros = new Map(pegCentros.map((f, k) => [f, k]));
    const libres = [];
    const anadirLibre = (movs) => {
      const P = permSec(movs);
      const desde = pegCentros.map((f) => posEnCentros.get(P[f]));
      if (desde.some((x) => x === undefined)) return; // mueve algo que no es centro a un centro (no pasa)
      if (desde.every((x, k) => x === k)) return;
      libres.push({ movs, desde, coste: movs.length });
    };
    for (const c of CARAS) for (let p = 1; p <= Math.floor(N / 2); p++) for (let v = 1; v <= 3; v++) anadirLibre([nombreMovimiento(c, p, v)]);
    for (const c of ['U', 'R', 'F']) for (let p = 2; p < N; p++) {
      if (impar && p === (N + 1) / 2) continue;
      for (let v = 1; v <= 3; v++) anadirLibre([nombreMovimiento(c, p, v), nombreMovimiento(c, p - 1, 4 - v)]);
    }
    const objCentros = pegCentros.map((f) => RES[f]);
    const libresAristas = N >= 5 ? construirAristasLibres(opciones0) : null;
    tablas = { porOrbita, dobles, setupsD, setups1: setups.length + 1, invSetup, paridadWings, pll, libres, pegCentros, objCentros, libresAristas, ms: 0, tpr: N === 4 ? tpr4() : null, centros: N >= 5 ? crearCentrosNxN(N, b, orbitas, {
      // bit w: la permutación de la órbita de wings w (respecto a su objetivo) es impar
      bits: (e) => oiWings.reduce((acc, oi, w) => {
        const obj = objetivosWings(e, w);
        const cur = orbitas[oi].piezas.map((pz) => wingPorColores[w].get(e[pz[0]] + ',' + e[pz[1]]));
        return acc | (paridad(cur.map((x) => obj.indexOf(x))) << w);
      }, 0),
      todas: (1 << oiWings.length) - 1,
      exteriores: 1,
      interiores: 2,
    }) : null };
    if (tablas.centros) tablas.centros.inicializar();
    tablas.ms = Date.now() - t0 + msK;
    return { ms: tablas.ms };
  }

  // ---------- Aristas "libres": emparejar con macros que no mueven los centros ----------
  // Una macro es S · A M A⁻¹ · S⁻¹: S una capa ancha o interior, A un giro de una
  // de las cuatro caras de alrededor y M un giro de una de las dos caras del eje de S.
  // Mientras S está hecho, los centros desplazados están en las caras de alrededor, y
  // A M A⁻¹ deja esas caras como estaban; S⁻¹ los devuelve. Así que los centros no se
  // mueven y las wings sí. (Se comprueba igualmente sobre el cubo resuelto.)
  // Solo se usan las que no cambian la paridad de ninguna órbita de wings (respecto a
  // su objetivo): si no, los 3-ciclos no podrían terminar.
  function construirAristasLibres(opcionesIni = {}) {
    const pegAr = []; // pegatinas de wings y aristas centrales
    for (const oi of oiWings) for (const pz of orbitas[oi].piezas) pegAr.push(...pz);
    if (impar) for (const pz of orbitas[oiMid].piezas) pegAr.push(...pz);
    const idxAr = new Map(pegAr.map((f, k) => [f, k]));
    const centrosOk = (e) => { for (const oi of oiCentros) for (const pz of orbitas[oi].piezas) if (e[pz[0]] !== RES[pz[0]]) return false; return true; };
    const ejes = [['U', 'D', ['R', 'F', 'L', 'B']], ['R', 'L', ['U', 'F', 'D', 'B']], ['F', 'B', ['U', 'R', 'D', 'L']]];
    const h = Math.floor(N / 2);
    const macros = [];
    const vistos = new Set();
    const efecto = (movs) => { const P = permSec(movs); return Int16Array.from(pegAr, (f) => idxAr.get(P[f])); };
    for (const [P1, P2, lados] of ejes) {
      const Ss = [];
      for (const c of [P1, P2]) for (let p = 2; p <= h; p++) for (const v of [1, 2, 3]) {
        Ss.push([nombreMovimiento(c, p, v)]);
        Ss.push([nombreMovimiento(c, p, v), nombreMovimiento(c, p - 1, 4 - v)]); // capa p sola
      }
      // las dos caras del eje a la vez (p. ej. Uw Dw')
      if (opcionesIni.dosCapas ?? true) for (let p = 2; p <= h; p++) for (let q = 2; q <= h; q++) for (const v of [1, 2, 3]) for (const u of [1, 2, 3]) Ss.push([nombreMovimiento(P1, p, v), nombreMovimiento(P2, q, u)]);
      const Xs = [];
      for (const a of lados) for (const va of [1, 2, 3]) for (const m of [P1, P2]) for (const vm of [1, 2, 3]) {
        Xs.push([nombreMovimiento(a, 1, va), nombreMovimiento(m, 1, vm), nombreMovimiento(a, 1, 4 - va)]);
      }
      for (const S of Ss) for (const X of Xs) {
        const movs = simplificarNxN([...S, ...X, ...invSec(S)], N).movimientos;
        const e = movs.reduce((x, m) => b.aplicarMovimiento(x, m), RES);
        if (!centrosOk(e)) continue;
        if (oiWings.some((oi, w) => paridadRelativa(e, w))) continue;
        const ef = efecto(movs);
        const clave = ef.join(',');
        if (vistos.has(clave) || ef.every((x, k) => x === k)) continue;
        vistos.add(clave);
        macros.push({ movs, src: ef });
      }
    }
    // giros de cara (preparación): no cambian los centros
    const caras = [];
    for (const c of CARAS) for (const v of [1, 2, 3]) { const m = nombreMovimiento(c, 1, v); caras.push({ movs: [m], src: efecto([m]) }); }
    return { pegAr, idxAr, macros, caras };
  }

  /** Paridad de la permutación de la órbita de wings w respecto a su objetivo. */
  function paridadRelativa(e, w) {
    const oi = oiWings[w];
    const obj = objetivosWings(e, w);
    const cur = orbitas[oi].piezas.map((pz) => wingPorColores[w].get(e[pz[0]] + ',' + e[pz[1]]));
    return paridad(cur.map((p) => obj.indexOf(p)));
  }

  /**
   * Voraz: mientras compense (más de `umbral` wings colocadas por movimiento), un giro
   * de cara opcional y una macro, lo que coloque más wings por movimiento.
   */
  function aristasLibres(ref, aplicar, costeReal, umbral, opc = {}) {
    const { pegAr, idxAr, macros, caras } = tablas.libresAristas;
    const nA = pegAr.length;
    // comparaciones: para cada wing, sus dos pegatinas y las dos que debe igualar
    // N impar: cada wing con la arista central de su ranura. N par: con la wing vecina
    // de la misma ranura hacia el centro (las dos del medio, entre sí): así una ranura
    // está "emparejada" cuando todas sus wings muestran los mismos colores.
    const comp = [];
    const mismaCara = (ref, f) => ref[caraDe(ref[0]) === caraDe(f) ? 0 : 1];
    oiWings.forEach((oi, w) => orbitas[oi].piezas.forEach((pz, j) => {
      const ref = impar ? orbitas[oiMid].piezas[aristaDeWing[w][j]] : posWing.get(aristaDeWing[w][j] + ':' + refT(tDeWing[w][j]));
      comp.push([idxAr.get(pz[0]), idxAr.get(mismaCara(ref, pz[0])), idxAr.get(pz[1]), idxAr.get(mismaCara(ref, pz[1]))]);
    }));
    const C = Int16Array.from(comp.flat());
    const nC = comp.length;
    // por macro: las comparaciones que cambia, con los índices ya compuestos (y'[k] = y[src[k]])
    if (!tablas.libresAristas.afect) {
      const deStick = Array.from({ length: nA }, () => []);
      comp.forEach((c, ci) => c.forEach((k) => deStick[k].push(ci)));
      tablas.libresAristas.afect = macros.map((m) => {
        const cs = new Set();
        for (let k = 0; k < nA; k++) if (m.src[k] !== k) for (const ci of deStick[k]) cs.add(ci);
        const lista = [...cs];
        const idx = new Int16Array(4 * lista.length);
        lista.forEach((ci, t) => { for (let q = 0; q < 4; q++) idx[4 * t + q] = m.src[C[4 * ci + q]]; });
        return { cis: Int16Array.from(lista), idx };
      });
    }
    const afect = tablas.libresAristas.afect;
    const aciertos = (x) => {
      let k = 0;
      for (let i = 0; i < 4 * nC; i += 4) {
        if (x[C[i]] === x[C[i + 1]] && x[C[i + 2]] === x[C[i + 3]]) k++;
      }
      return k;
    };
    const aplicarSrc = (x, src) => { const y = new Int8Array(nA); for (let k = 0; k < nA; k++) y[k] = x[src[k]]; return y; };
    // los mejores pasos (giro de cara opcional + macro) desde x0, por wings colocadas por movimiento
    const pasos = (x0, base, n, sinPrep = false) => {
      const res = [];
      const pre = [{ movs: [], x: x0 }].concat(sinPrep ? [] : caras.map((c) => ({ movs: c.movs, x: aplicarSrc(x0, c.src) })));
      const ok = new Uint8Array(nC);
      let corte = -1;
      for (const p of pre) {
        const y = p.x;
        let bp = 0;
        for (let ci = 0, i = 0; ci < nC; ci++, i += 4) { ok[ci] = y[C[i]] === y[C[i + 1]] && y[C[i + 2]] === y[C[i + 3]] ? 1 : 0; bp += ok[ci]; }
        for (let mi = 0; mi < macros.length; mi++) {
          const { cis, idx } = afect[mi];
          let g = bp - base;
          for (let t = 0, i = 0; t < cis.length; t++, i += 4) g += (y[idx[i]] === y[idx[i + 1]] && y[idx[i + 2]] === y[idx[i + 3]] ? 1 : 0) - ok[cis[t]];
          if (g <= 0) continue;
          const m = macros[mi];
          const coste = p.movs.length + m.movs.length;
          if (g / coste < corte) continue;
          res.push({ v: g / coste, g, coste, p, m });
          if (res.length > 4 * n + 16) { res.sort((a, c) => c.v - a.v || a.coste - c.coste); res.length = n; corte = res[n - 1].v; }
        }
      }
      res.sort((a, c) => c.v - a.v || a.coste - c.coste);
      return res.slice(0, n);
    };
    const anticipar = opc.anticiparAristas ?? (N >= 7 ? 10 : 20);
    for (let iter = 0; iter < 60; iter++) {
      const x0 = Int8Array.from(pegAr, (f) => ref.e[f]);
      const base = aciertos(x0);
      if (base === nC) return;
      const cand = pasos(x0, base, Math.max(1, anticipar));
      if (!cand.length) return;
      let mejor = cand[0], vm = -1;
      if (anticipar) {
        // mirar un paso más: primero sin giro de preparación (rápido) para todos los
        // candidatos y después, para los mejores, con preparación
        const valor = (c, rapido) => {
          const y = aplicarSrc(c.p.x, c.m.src);
          const sig = c.g + base < nC ? pasos(y, base + c.g, 1, rapido)[0] : null;
          return sig ? (c.g + sig.g) / (c.coste + sig.coste) : c.v;
        };
        const nFinos = opc.anticiparFinos ?? (N >= 7 ? 3 : 5);
        const orden = cand.map((c) => ({ c, v: valor(c, true) })).sort((a, b2) => b2.v - a.v);
        for (const { c, v } of orden.slice(0, nFinos)) {
          const vf = Math.max(v, valor(c, false));
          if (vf > vm) { vm = vf; mejor = c; }
        }
      }
      const movsP = [...mejor.p.movs, ...mejor.m.movs];
      const real = Math.max(1, costeReal(movsP));
      if (mejor.g / real < umbral) return;
      aplicar(movsP);
    }
  }

  // N par: objetivo de la wing (w, j) si en su ranura va la arista e (volteada si f)
  function piezaAsignada(w, j, e, f) {
    const s = aristaDeWing[w][j];
    const caras = NOMBRES_ARISTAS[s].split('').map((c) => CARAS.indexOf(c));
    const cols = NOMBRES_ARISTAS[e].split('').map((c) => CARAS.indexOf(c));
    const pz = orbitas[oiWings[w]].piezas[j];
    const c = pz.map((x) => (caraDe(x) === caras[0] ? cols[f] : cols[1 - f]));
    return wingPorColores[w].get(c[0] + ',' + c[1]);
  }
  const objetivosAsignados = (asig, w) => orbitas[oiWings[w]].piezas.map((_, j) => { const a = asig[aristaDeWing[w][j]]; return piezaAsignada(w, j, a.e, a.f); });
  /**
   * N par: arista entera (e, volteada f) para cada ranura, empezando por las que ya
   * tienen más wings bien; con un número par de volteos (si no, no sería un 3x3 posible).
   */
  function asignarAristas(e, paridadEsquinas, opcionesPLL) {
    const cur = oiWings.map((oi, w) => orbitas[oi].piezas.map((pz) => wingPorColores[w].get(e[pz[0]] + ',' + e[pz[1]])));
    const pun = []; // [puntos, ranura, arista, volteo]
    for (let s = 0; s < 12; s++) for (let a = 0; a < 12; a++) for (const f of [0, 1]) {
      let k = 0;
      oiWings.forEach((oi, w) => orbitas[oi].piezas.forEach((_, j) => { if (aristaDeWing[w][j] === s && cur[w][j] === piezaAsignada(w, j, a, f)) k++; }));
      pun.push([k, s, a, f]);
    }
    pun.sort((x, y) => y[0] - x[0]);
    const asig = new Array(12).fill(null), usada = new Array(12).fill(false);
    for (const [k, s, a, f] of pun) if (!asig[s] && !usada[a]) { asig[s] = { e: a, f, k }; usada[a] = true; }
    if (asig.reduce((t, x) => t + x.f, 0) % 2) {
      // voltear la ranura en la que menos se pierde
      let mejor = null;
      for (let s = 0; s < 12; s++) {
        const alt = pun.find((x) => x[1] === s && x[2] === asig[s].e && x[3] !== asig[s].f);
        const perdida = asig[s].k - alt[0];
        if (!mejor || perdida < mejor.perdida) mejor = { s, perdida, k: alt[0] };
      }
      asig[mejor.s] = { e: asig[mejor.s].e, f: 1 - asig[mejor.s].f, k: mejor.k };
    }
    // Si la permutación de las aristas no tiene la paridad de la de las esquinas, el 3x3
    // necesitaría la paridad PLL (~10 movimientos). Intercambiar las aristas de dos
    // ranuras que aún no estén emparejadas cuesta menos (pocas wings se pierden).
    if (paridadEsquinas !== undefined && (paridad(asig.map((x) => x.e)) ^ paridadEsquinas)) {
      const punt = new Map(pun.map(([k, s2, a, f]) => [s2 + ':' + a + ':' + f, k]));
      let mejor = null;
      for (let s1 = 0; s1 < 12; s1++) for (let s2 = s1 + 1; s2 < 12; s2++) {
        const antes = asig[s1].k + asig[s2].k;
        const fl = asig[s1].f + asig[s2].f;
        for (const f1 of [0, 1]) for (const f2 of [0, 1]) {
          if ((f1 + f2) % 2 !== fl % 2) continue;
          const k1 = punt.get(s1 + ':' + asig[s2].e + ':' + f1), k2 = punt.get(s2 + ':' + asig[s1].e + ':' + f2);
          const perdida = antes - k1 - k2;
          if (!mejor || perdida < mejor.perdida) mejor = { perdida, s1, s2, f1, f2, k1, k2 };
        }
      }
      if (mejor && mejor.perdida <= (opcionesPLL ?? 2)) {
        const e1 = asig[mejor.s1].e, e2 = asig[mejor.s2].e;
        asig[mejor.s1] = { e: e2, f: mejor.f1, k: mejor.k1 };
        asig[mejor.s2] = { e: e1, f: mejor.f2, k: mejor.k2 };
      }
    }
    return asig;
  }

  // Objetivo de cada wing: la pieza que muestra los colores pedidos en su posición
  function objetivosWings(norm, w, intercambioPLL = false) {
    const oi = oiWings[w];
    return orbitas[oi].piezas.map((pz, j) => {
      let cols;
      if (impar) {
        const mid = orbitas[oiMid].piezas[aristaDeWing[w][j]];
        cols = pz.map((f) => norm[mid[caraDe(mid[0]) === caraDe(f) ? 0 : 1]]);
      } else {
        cols = pz.map((f) => RES[f]);
        const ar = NOMBRES_ARISTAS[aristaDeWing[w][j]];
        if (intercambioPLL && (ar === 'UF' || ar === 'UB')) cols = cols.map((x) => (x === 2 ? 5 : x === 5 ? 2 : x));
      }
      return wingPorColores[w].get(cols[0] + ',' + cols[1]);
    });
  }

  /** Resuelve una órbita con 3-ciclos. actual(estado) -> valores por posición; obj: valores objetivo. */
  function resolverOrbita(oi, estadoRef, obj, aplicar, costeReal) {
    const T = tablas.porOrbita[oi];
    const orb = orbitas[oi];
    const leer = () => orb.piezas.map((pz) => (orb.tipo === 'wings'
      ? wingPorColores[oiWings.indexOf(oi)].get(estadoRef.e[pz[0]] + ',' + estadoRef.e[pz[1]])
      : estadoRef.e[pz[0]]));
    for (let iter = 0; iter < 200; iter++) {
      const cur = leer();
      const mal = [];
      for (let j = 0; j < T.nS; j++) if (cur[j] !== obj[j]) mal.push(j);
      if (!mal.length) return;
      const cand = [];
      for (const a of mal) for (const b2 of mal) {
        if (b2 === a || cur[a] !== obj[b2]) continue; // la pieza de a encaja en b
        for (let c = 0; c < T.nS; c++) {
          if (c === a || c === b2) continue;
          // a -> b, b -> c, c -> a
          const antes = (cur[c] === obj[c] ? 1 : 0);
          const despues = 1 + (cur[b2] === obj[c] ? 1 : 0) + (cur[c] === obj[a] ? 1 : 0);
          const ganancia = despues - antes;
          if (ganancia <= 0) continue;
          const coste = T.coste[T.idx(a, b2, c)];
          if (coste < 0) continue;
          cand.push({ valor: ganancia / coste, ganancia, coste, a, b2, c });
        }
      }
      if (!cand.length) throw new Error(`No se pudo avanzar con ${orb.nombre}`);
      // Entre los mejores, el que más se acorta al unirse con lo anterior
      cand.sort((x, y) => y.valor - x.valor || x.coste - y.coste);
      let mejor = null;
      for (const x of cand.slice(0, 24)) {
        const sec = T.secuencia(x.a, x.b2, x.c);
        const real = costeReal(sec);
        const valor = x.ganancia / Math.max(1, real);
        if (!mejor || valor > mejor.valor) mejor = { valor, sec };
      }
      aplicar(mejor.sec);
    }
    throw new Error(`Demasiados ciclos en ${orb.nombre}`);
  }

  /**
   * Varias órbitas a la vez: en cada paso, el mejor 3-ciclo simple (con su setup
   * óptimo, como resolverOrbita) o doble (base × setup de 0, 1 o 2 movimientos),
   * por piezas colocadas por movimiento.
   */
  function resolverGrupo(ois, estadoRef, objs, aplicar, costeReal, opcionesGrupo = {}) {
    const enG = new Set(ois);
    const dobl = tablas.dobles.filter((d) => d.ciclos.every((c) => enG.has(c.oi)));
    const leer = (e, oi) => {
      const orb = orbitas[oi];
      return orb.piezas.map((pz) => (orb.tipo === 'wings'
        ? wingPorColores[oiWings.indexOf(oi)].get(e[pz[0]] + ',' + e[pz[1]])
        : e[pz[0]]));
    };
    const ganancia = (cur, obj, a, b2, c) => (cur[a] === obj[b2]) + (cur[b2] === obj[c]) + (cur[c] === obj[a]) - (cur[a] === obj[a]) - (cur[b2] === obj[b2]) - (cur[c] === obj[c]);
    const obj = objs;
    // candidatos (ganancia, coste estimado) desde el estado e
    function candidatos(e) {
      const cur = {};
      let quedan = 0;
      for (const oi of ois) { cur[oi] = leer(e, oi); for (let j = 0; j < 24; j++) if (cur[oi][j] !== obj[oi][j]) quedan++; }
      const cand = [];
      if (!quedan) return { cand, quedan };
      for (const oi of ois) {
        const T = tablas.porOrbita[oi];
        const cu = cur[oi], ob = obj[oi];
        const mal = [];
        for (let j = 0; j < 24; j++) if (cu[j] !== ob[j]) mal.push(j);
        for (const a of mal) for (const b2 of mal) {
          if (b2 === a || cu[a] !== ob[b2]) continue;
          for (let c = 0; c < 24; c++) {
            if (c === a || c === b2) continue;
            const g = ganancia(cu, ob, a, b2, c);
            if (g <= 0) continue;
            const coste = T.coste[T.idx(a, b2, c)];
            if (coste < 0) continue;
            cand.push({ valor: g / coste, g, coste, sec: () => T.secuencia(a, b2, c) });
          }
        }
      }
      const resuelta = new Set(ois.filter((oi) => cur[oi].every((x, j) => x === obj[oi][j])));
      const nSetups = opcionesGrupo.setups2 ? tablas.setupsD.length : tablas.setups1;
      for (const d of dobl) {
        const cs = d.ciclos;
        if (cs.some((c) => resuelta.has(c.oi))) continue;
        for (let si = 0; si < nSetups; si++) {
          const inv = tablas.invSetup[si];
          let g = 0;
          for (const c of cs) { const iv = inv[c.oi]; g += ganancia(cur[c.oi], obj[c.oi], iv[c.c[0]], iv[c.c[1]], iv[c.c[2]]); }
          if (g <= 0) continue;
          const S = tablas.setupsD[si];
          const coste = d.movs.length + 2 * S.length;
          cand.push({ valor: g / coste, g, coste, sec: () => [...S, ...d.movs, ...S.slice().reverse().map(invertirMovimientoNxN)] });
        }
      }
      cand.sort((x, y) => y.valor - x.valor || x.coste - y.coste);
      return { cand, quedan };
    }
    const anticipar = opcionesGrupo.anticipar ?? 0;
    for (let iter = 0; iter < 600; iter++) {
      const { cand, quedan } = candidatos(estadoRef.e);
      if (!quedan) return;
      if (!cand.length) throw new Error(`No se pudo avanzar con ${ois.map((oi) => orbitas[oi].nombre).join(', ')}`);
      let mejor = null;
      const evaluados = cand.slice(0, opcionesGrupo.top ?? 24).map((x) => { const sec = x.sec(); const real = Math.max(1, costeReal(sec)); return { ...x, sec, real, v1: x.g / real }; });
      evaluados.sort((x, y) => y.v1 - x.v1);
      for (const [k, x] of evaluados.entries()) {
        let valor = x.v1;
        if (k < anticipar && x.g < quedan) {
          // mirar un paso más: lo mejor que se puede hacer después
          let e2 = estadoRef.e;
          for (const m of x.sec) e2 = b.aplicarMovimiento(e2, m);
          const sig = candidatos(e2).cand[0];
          if (sig) valor = (x.g + sig.g) / (x.real + sig.coste);
        }
        if (!mejor || valor > mejor.valor) mejor = { valor, sec: x.sec };
      }
      aplicar(mejor.sec);
    }
    throw new Error('Demasiados ciclos');
  }

  /** Mejora voraz de los centros con movimientos sueltos o parejas de movimientos. */
  function centrosLibres(ref, aplicar, umbral) {
    const { libres, pegCentros, objCentros } = tablas;
    const n = pegCentros.length;
    for (let iter = 0; iter < 200; iter++) {
      const cur = pegCentros.map((f) => ref.e[f]);
      const aciertos = (vals) => { let k = 0; for (let i = 0; i < n; i++) if (vals[i] === objCentros[i]) k++; return k; };
      const base = aciertos(cur);
      if (base === n) return;
      let mejor = null;
      const tras = libres.map((m) => m.desde.map((k) => cur[k]));
      libres.forEach((m, i) => {
        const g = aciertos(tras[i]) - base;
        if (g > 0 && (!mejor || g / m.coste > mejor.valor)) mejor = { valor: g / m.coste, movs: m.movs };
      });
      // parejas (pueden ganar donde un movimiento solo no gana)
      libres.forEach((m1, i) => {
        const v1 = tras[i];
        for (const m2 of libres) {
          if (m2.movs[0][m2.movs[0].search(/[URFDLB]/)] === m1.movs[0][m1.movs[0].search(/[URFDLB]/)]) continue;
          let k = 0;
          for (let j = 0; j < n; j++) if (v1[m2.desde[j]] === objCentros[j]) k++;
          const g = k - base, c = m1.coste + m2.coste;
          if (g > 0 && (!mejor || g / c > mejor.valor)) mejor = { valor: g / c, movs: [...m1.movs, ...m2.movs] };
        }
      });
      if (!mejor || mejor.valor < umbral) return;
      aplicar(mejor.movs);
    }
  }

  function extraer3x3(e) {
    const r3 = [];
    const medio = impar ? (N - 1) / 2 : 1;
    const fila = (k) => (k === 0 ? 0 : k === 2 ? N - 1 : medio);
    for (let f = 0; f < 6; f++) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        r3.push(e[f * n2 + fila(r) * N + fila(c)]);
      }
    }
    return r3;
  }

  function resolver(estado, opciones = {}) {
    const t0 = performance.now();
    const presupuesto = opciones.tiempoMax ?? 10000; // ms: por encima, se recortan los pasos opcionales
    const msI = inicializar().yaEstaba ? 0 : tablas.ms;
    const a = analizar(estado);
    if (!a.valido) return { ok: false, errores: a.errores };
    const ref = { e: a.norm };
    const movs = [], etq = [];
    const tiempos = {};
    let fase = 'paridad';
    let tf = performance.now();
    const aplicar = (sec) => {
      for (const m of sec) { ref.e = b.aplicarMovimiento(ref.e, m); movs.push(m); etq.push(fase); }
    };
    // movimientos que añade de verdad una secuencia, contando lo que se simplifica con el final de la solución
    const costeReal = (sec) => {
      const cola = movs.slice(-8);
      return simplificarNxN(cola.concat(sec), N).movimientos.length - simplificarNxN(cola, N).movimientos.length;
    };
    const cambiarFase = (f) => { const ahora = performance.now(); tiempos[fase] = (tiempos[fase] || 0) + ahora - tf; tf = ahora; fase = f; };
    // 4x4: reducción por búsqueda en tres fases (tpr4.js); si fallara, el método general
    let reducido = false;
    if (N === 4 && opciones.metodo !== 'conmutadores') {
      let r = null;
      const wp = (x, y) => wingPorColores[0].get(x + ',' + y);
      try { r = tablas.tpr.reducir(a.norm, wp, { msMax: opciones.msReduccion ?? 1500, ...opciones.tpr }); } catch (err) { r = null; }
      // segundo intento, con más margen, antes de pasar al método general (si no se ha
      // ido ya más del 60 % del presupuesto)
      if (!r && performance.now() - t0 < (opciones.tiempoMax ?? 10000) * 0.6) try { r = tablas.tpr.reducir(a.norm, wp, { msMax: 3000, nodos3b: 3e6, cand3b: 20, ...opciones.tpr }); } catch (err) { r = null; }
      if (r) {
        fase = 'centros'; aplicar(r.fases[0]); aplicar(r.fases[1]);
        cambiarFase('aristas'); aplicar(r.fases[2]); aplicar(r.fases[3]);
        reducido = true;
      } else {
        ref.e = a.norm; movs.length = 0; etq.length = 0;
      }
    }
    if (!reducido) {
    const conBusqueda = tablas.centros && opciones.metodo !== 'conmutadores';
    const paridadWings = () => oiWings.forEach((oi, w) => {
      const obj = objetivosWings(ref.e, w);
      const cur = orbitas[oi].piezas.map((pz) => wingPorColores[w].get(ref.e[pz[0]] + ',' + ref.e[pz[1]]));
      // permutación: la pieza de la posición j debe ir a la posición donde obj = cur[j]
      const destino = cur.map((p) => obj.indexOf(p));
      if (paridad(destino)) aplicar(tablas.paridadWings[w]);
    });
    if (conBusqueda) {
      // 1. centros por búsqueda (nxn-centros.js), que dejan además la paridad de las
      // wings arreglada; los que no se resuelvan, con 3-ciclos
      fase = 'centros';
      const rc = tablas.centros.resolver(ref.e, opciones.centros);
      aplicar(rc.movimientos);
      if (opciones.traza) opciones.traza.busquedaCentros = (opciones.traza.busquedaCentros || 0) + rc.movimientos.length;
      // si alguna etapa no se pudo hacer, la paridad puede seguir sin arreglar
      cambiarFase('paridad');
      paridadWings();
    } else {
      // 1. centros con movimientos libres (voraz, mientras compense)
      fase = 'centros';
      centrosLibres(ref, aplicar, opciones.umbralLibre ?? 0.33);
      cambiarFase('paridad');
      // 2. paridad de las wings
      paridadWings();
    }
    // 2. centros (3-ciclos; las órbitas ya resueltas no hacen nada)
    cambiarFase('centros');
    if (opciones.dobles === false) {
      for (const oi of oiCentros) resolverOrbita(oi, ref, orbitas[oi].piezas.map((pz) => RES[pz[0]]), aplicar, costeReal);
    } else {
      resolverGrupo(oiCentros, ref, Object.fromEntries(oiCentros.map((oi) => [oi, orbitas[oi].piezas.map((pz) => RES[pz[0]])])), aplicar, costeReal, opciones.grupoCentros ?? { top: 48 });
    }
    // 3. aristas
    cambiarFase('aristas');
    const conLibres = tablas.libresAristas && opciones.aristasLibres !== false && opciones.metodo !== 'conmutadores';
    // límite de tiempo: si los centros ya han tardado más de la mitad, sin anticipación
    const prisa = performance.now() - t0 > presupuesto * 0.5;
    if (conLibres) aristasLibres(ref, aplicar, costeReal, opciones.umbralAristas ?? 0.1, prisa ? { ...opciones, anticiparAristas: 0 } : opciones);
    if (opciones.traza) opciones.traza.libres = (opciones.traza.libres || 0) + movs.filter((_, i) => etq[i] === 'aristas').length;
    // N par: a qué ranura va cada arista entera (la que ya tiene más wings en ella)
    const asig = !impar && conLibres ? asignarAristas(ref.e, paridad(modelo3.identificar(ref.e).orbitas[0].perm), opciones.perdidaPLL) : null;
    const objW = (w) => (asig ? objetivosAsignados(asig, w) : objetivosWings(ref.e, w));
    const necesitaPLL = !impar && (paridad(modelo3.identificar(ref.e).orbitas[0].perm) ^ (asig ? paridad(asig.map((x) => x.e)) : 0)) === 1;
    if (opciones.dobles === false) oiWings.forEach((oi, w) => resolverOrbita(oi, ref, objW(w), aplicar, costeReal));
    else resolverGrupo(oiWings, ref, Object.fromEntries(oiWings.map((oi, w) => [oi, objW(w)])), aplicar, costeReal);
    // 4. paridad PLL
    if (necesitaPLL) {
      cambiarFase('paridad');
      if (tablas.pll) aplicar(tablas.pll);
      else oiWings.forEach((oi, w) => resolverOrbita(oi, ref, objetivosWings(ref.e, w, true), aplicar, costeReal));
    }
    }
    // 5. 3x3
    cambiarFase('3x3');
    const r3 = cubo3.resolver(extraer3x3(ref.e), { objetivo: opciones.objetivo ?? (N >= 5 ? 18 : 20), msMax: opciones.msMax ?? Math.max(150, Math.min(N >= 5 ? 1200 : 400, presupuesto - (performance.now() - t0))) });
    if (!r3.ok) return { ok: false, errores: ['Fallo interno en la fase 3x3: ' + r3.errores.join(' ')] };
    aplicar(r3.movimientos);
    cambiarFase('fin');
    if (!b.estaResuelto(ref.e)) return { ok: false, errores: ['Fallo interno: la reducción no deja el cubo resuelto.'] };
    const sim = simplificarNxN(movs, N, etq);
    // comprobación final sobre el estado del usuario
    const fin = sim.movimientos.reduce((s, m) => b.aplicarMovimiento(s, m), estado);
    if (!b.estaResuelto(fin)) return { ok: false, errores: ['Fallo interno: la solución simplificada no resuelve el cubo.'] };
    const fases = [];
    sim.etiquetas.forEach((f, i) => {
      const ult = fases[fases.length - 1];
      if (ult && ult.nombre === f) ult.fin = i + 1; else fases.push({ nombre: f, inicio: i, fin: i + 1 });
    });
    return { ok: true, movimientos: sim.movimientos, fases, msFases: tiempos, ms: performance.now() - t0 - msI };
  }

  const NOMBRES_FASE = { paridad: 'paridad', centros: 'centros', aristas: 'aristas', '3x3': '3x3' };

  return crearNxN(N, {
    capacidades: { scramble: true, validar: true, resolver: true, editar: true },
    descripcion: N === 4
      ? 'Reducción en tres fases de búsqueda (centros y aristas emparejadas, sin paridades OLL ni PLL) y después 3x3 con Kociemba: ~55 movimientos, en 1–2 s.'
      : `Reducción: centros por búsqueda${N > 5 ? ' (los oblicuos, con conmutadores)' : ''}, aristas emparejadas con macros que no mueven los centros${N % 2 === 0 ? ', paridad PLL si hace falta' : ''} y 3x3 con Kociemba: ~${{ 5: 109, 6: 256, 7: 356 }[N]} movimientos, en ${{ 5: '2', 6: '3–4', 7: '6–7' }[N]} s de media.`,
    pegatinasEditables: () => RES.map((_, i) => i),
    vistasEditor: b.vistasEditor,
    herramientas: b.herramientas,
    usarHerramienta: b.usarHerramienta,
    inicializar,
    estaInicializado: () => !!tablas,
    avisoInicializacion: N === 4 ? 'Generando las tablas de la reducción del 4x4…' : `Generando las tablas de centros y las macros de aristas del ${N}x${N}…`,
    validar: (e) => { const r = analizar(e); return { valido: r.valido, errores: r.errores }; },
    resolver,
    buscarRedundanciaSolucion: (movs) => redundanciaSolucionNxN(movs, N),
    nombresFase: NOMBRES_FASE,
    // Modo aprender (de momento, el 4x4): reducción humana explicada por etapas
    ...(N === 4 ? { metodosAprender: METODOS_NxN, aprender: (estado, metodo) => aprenderReduccion(N, estado, metodo) } : {}),
    _interno: () => ({ tablas, orbitas, analizar }),
  });
}
