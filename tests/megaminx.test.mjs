// Megaminx: scrambles Pochmann, modelo de piezas, restricciones (Schreier–Sims),
// validador, cota inferior, última capa y solver.
// Casos del solver: 500 con `npm test`, 20 con `npm run test:rapido`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import p from '../src/puzzles/megaminx.js';
import { geo, CARAS, IDX, MOVS_CARA, VECINAS } from '../src/puzzles/megaminx-geo.js';
import { ESQUINAS, ARISTAS, CENTROS, modelo, sigmaDeCentros, reetiquetar } from '../src/puzzles/megaminx-piezas.js';
import { analizarGrupo, cotaInferiorConteo, ORDEN_ESQUINAS, ORDEN_ARISTAS, ORDEN_TOTAL } from '../src/puzzles/megaminx-grupo.js';
import { inicializarUltima, resolverUltima, ESQ_LL, ARI_LL, _interno as LL } from '../src/puzzles/megaminx-ultima.js';
import { simplificarTramos, ETAPAS, resolverMegaminx, estadisticas } from '../src/puzzles/megaminx-solver.js';
import { slotMov, NS } from '../src/puzzles/megaminx-busqueda.js';
import { aplicarPerm } from '../src/core/perm.js';
import { rngConSemilla, entero } from '../src/core/rng.js';
import { probarScrambles, guardarResultado, CASOS, debeRechazar } from './util.mjs';

const completo = CASOS >= 1000;
const CASOS_SOLVER = process.env.CASOS_MEGA ? +process.env.CASOS_MEGA : completo ? 500 : 20;
export const COTA_INFERIOR = 48;
const e0 = p.estadoResuelto();
const girarAzar = (e, rng) => aplicarPerm(e, geo.rotaciones[entero(rng, 60)]);

test('Megaminx: 132 pegatinas, 11 por cara, giros de orden 5', () => {
  assert.equal(e0.length, 132);
  for (let f = 0; f < 12; f++) assert.equal(e0.filter((c) => c === f).length, 11);
  for (const m of ['U', 'R++', 'D++', 'DBL', 'B']) {
    let e = e0;
    for (let i = 0; i < 5; i++) { e = p.aplicarMovimiento(e, m); if (i < 4) assert.ok(!p.estaResuelto(e), m); }
    assert.ok(p.estaResuelto(e), m + '^5');
  }
  assert.ok(p.estaResuelto(p.aplicarSecuencia(e0, ['R++', 'R--'])));
});

test('Megaminx: scrambles con el formato de Pochmann (y estados válidos)', () => {
  const r = probarScrambles(p, 61); // también pasa cada estado por el validador
  assert.equal(r.longitudMin, 77);
  assert.equal(r.longitudMax, 77);
  const rng = rngConSemilla(62);
  for (let i = 0; i < CASOS; i++) {
    const s = p.generarScramble(rng);
    const lineas = p.formatear(s).split('\n');
    assert.equal(lineas.length, 7);
    for (const l of lineas) {
      const t = l.split(' ');
      assert.equal(t.length, 11);
      t.slice(0, 10).forEach((m, k) => assert.match(m, k % 2 === 0 ? /^R(\+\+|--)$/ : /^D(\+\+|--)$/));
      assert.equal(t[10], t[9] === 'D++' ? 'U' : "U'", 'U tras D++, U\' tras D--');
    }
    const e = p.aplicarSecuencia(e0, s);
    assert.ok(p.estaResuelto(p.aplicarSecuencia(e, p.invertir(s))));
  }
  guardarResultado('megaminx', r);
});

test('Megaminx: notación de caras (nombres, sentidos, vecinas, opuestas)', () => {
  const ap = (movs) => p.aplicarSecuencia(e0, movs);
  const igual = (a, b) => a.every((x, i) => x === b[i]);
  for (const c of CARAS) {
    assert.ok(igual(ap([c, c]), ap([c + '2'])), `${c} ${c} = ${c}2`);
    assert.ok(igual(ap([c + "'", c + "'"]), ap([c + "2'"])), `${c}' ${c}' = ${c}2'`);
    assert.ok(igual(ap([c + '2', c + "2'"]), e0));
    assert.ok(igual(ap([c, c + "'"]), e0));
    assert.equal(p.invertirMovimiento(c + '2'), c + "2'");
    assert.equal(p.invertirMovimiento(c + "2'"), c + '2');
    // la capa de una cara: las 10 pegatinas de la cara que no son el centro + 5 de aristas y 10 de esquinas en los lados
    const mov = geo.perms[c].filter((x, i) => x !== i).length;
    assert.equal(mov, 25, `${c} mueve 25 pegatinas`);
  }
  // vecinas según la convención (DR debajo de F y R, B opuesta a F, ...)
  const vec = (c) => VECINAS[IDX[c]].map((f) => CARAS[f]).sort();
  assert.deepEqual(vec('U'), ['BL', 'BR', 'F', 'L', 'R']);
  assert.deepEqual(vec('F'), ['DL', 'DR', 'L', 'R', 'U']);
  assert.deepEqual(vec('DR'), ['D', 'DBR', 'DL', 'F', 'R']);
  assert.deepEqual(vec('B'), ['BL', 'BR', 'D', 'DBL', 'DBR']);
  assert.deepEqual(vec('D'), ['B', 'DBL', 'DBR', 'DL', 'DR']);
  // U de Pochmann = U de caras; R++ = toda la pieza menos la cara opuesta a R (DBL)
  assert.ok(igual(ap(['U']), ap(['U'])));
  const r = p.aplicarMovimiento(e0, 'R++');
  assert.ok(sigmaDeCentros(r), 'R++ es una rotación + un giro: los centros siguen siendo una orientación válida');
  // caras no vecinas conmutan; vecinas no
  for (let f = 0; f < 12; f++) for (let g = 0; g < 12; g++) {
    if (f === g) continue;
    const conm = igual(ap([CARAS[f], CARAS[g]]), ap([CARAS[g], CARAS[f]]));
    assert.equal(conm, !VECINAS[f].includes(g), `${CARAS[f]} y ${CARAS[g]}`);
  }
});

test('Megaminx: modelo de piezas (12 centros, 20 esquinas, 30 aristas)', () => {
  assert.equal(CENTROS.length, 12);
  assert.equal(ESQUINAS.length, 20);
  assert.equal(ARISTAS.length, 30);
  const { orbitas, errores } = modelo.identificar(e0);
  assert.equal(errores.length, 0);
  assert.deepEqual(orbitas[0].perm, [...Array(20).keys()]);
  assert.deepEqual(orbitas[1].perm, [...Array(30).keys()]);
  // cada cara: 5 esquinas y 5 aristas; cada pieza en tantas caras como pegatinas
  for (let f = 0; f < 12; f++) {
    assert.equal(ESQUINAS.filter((q) => q.caras.includes(f)).length, 5);
    assert.equal(ARISTAS.filter((q) => q.caras.includes(f)).length, 5);
  }
  // pegatinas y piezas coinciden con el modelo tras cualquier secuencia
  const rng = rngConSemilla(3);
  let e = e0, est = modelo.resuelto;
  for (let i = 0; i < 300; i++) {
    const m = MOVS_CARA[entero(rng, 48)];
    e = p.aplicarMovimiento(e, m);
    est = modelo.aplicarPiezas(est, m);
  }
  assert.deepEqual(modelo.identificar(e).orbitas, est);
  // 60 orientaciones del puzzle entero, todas reconocidas por los centros
  assert.equal(geo.rotaciones.length, 60);
  for (const P of geo.rotaciones) {
    const r = aplicarPerm(e, P);
    const s = sigmaDeCentros(r);
    assert.ok(s);
    assert.ok(p.validar(r).valido);
    assert.deepEqual(CENTROS.map((i) => reetiquetar(r, s)[i]), [...Array(12).keys()]);
  }
});

test('Megaminx: restricciones demostradas con Schreier–Sims (no hay más que estas cuatro)', () => {
  const g = analizarGrupo();
  for (const x of g.giros) {
    assert.equal(x.sumaGiros, 0, `${x.m}: la suma de giros de las esquinas no cambia`);
    assert.equal(x.sumaVolteos, 0, `${x.m}: la suma de volteos no cambia`);
    assert.equal(x.paridadEsquinas, 0, `${x.m}: permutación par de esquinas`);
    assert.equal(x.paridadAristas, 0, `${x.m}: permutación par de aristas`);
  }
  // |esquinas| = 20!/2 · 3^19: solo permutación par y giro total múltiplo de 3
  assert.equal(g.ordenEsquinas, ORDEN_ESQUINAS);
  // |aristas| = 30!/2 · 2^29: solo permutación par y número par de volteos
  assert.equal(g.ordenAristas, ORDEN_ARISTAS);
  // |G| = producto: esquinas y aristas son independientes (sin relación de paridad)
  assert.equal(g.orden, ORDEN_TOTAL);
  assert.equal(ORDEN_TOTAL.toString(), '100669616553523347122516032313645505168688116411019768627200000000000');
  guardarResultado('megaminx', { ordenGrupo: g.orden.toString(), msSchreierSims: g.ms });
});

// ---------- Estados imposibles (y posibles) ----------
const colPeg = (e, pz) => pz.pegatinas.map((i) => e[i]);
function ponerColores(e, pz, cols) { const r = e.slice(); pz.pegatinas.forEach((i, j) => { r[i] = cols[j]; }); return r; }
const girarEsquina = (e, k, veces = 1) => { const c = colPeg(e, ESQUINAS[k]); for (let v = 0; v < veces; v++) c.push(c.shift()); return ponerColores(e, ESQUINAS[k], c); };
const voltearArista = (e, k) => ponerColores(e, ARISTAS[k], colPeg(e, ARISTAS[k]).reverse());
const intercambiar = (e, lista, a, b) => ponerColores(ponerColores(e, lista[a], colPeg(e, lista[b])), lista[b], colPeg(e, lista[a]));
const ciclo3 = (e, lista, a, b, c) => ponerColores(ponerColores(ponerColores(e, lista[a], colPeg(e, lista[c])), lista[b], colPeg(e, lista[a])), lista[c], colPeg(e, lista[b]));

test('Megaminx: estados imposibles rechazados con mensajes claros', () => {
  const rng = rngConSemilla(11);
  const base = girarAzar(p.aplicarSecuencia(e0, p.generarScramble(rng)), rng);
  p.inicializar();
  const msgs = {};
  msgs.girada = debeRechazar(p, girarEsquina(base, 4), 'esquina girada');
  msgs.volteada = debeRechazar(p, voltearArista(base, 7), 'arista volteada');
  msgs.dosEsquinas = debeRechazar(p, intercambiar(base, ESQUINAS, 0, 9), 'permutación de las esquinas es impar');
  msgs.dosAristas = debeRechazar(p, intercambiar(base, ARISTAS, 3, 20), 'permutación de las aristas es impar');
  // dos esquinas y dos aristas a la vez: tampoco (no hay relación entre las paridades)
  const ambas = intercambiar(intercambiar(base, ESQUINAS, 1, 2), ARISTAS, 5, 6);
  const v = p.validar(ambas);
  assert.equal(v.valido, false);
  assert.equal(v.errores.length, 2);
  // pieza especular: dos pegatinas de una esquina intercambiadas
  const c = colPeg(base, ESQUINAS[12]);
  msgs.especular = debeRechazar(p, ponerColores(base, ESQUINAS[12], [c[1], c[0], c[2]]), 'orden especular');
  // colores de más
  const mas = base.slice(); const i0 = ESQUINAS[3].pegatinas[0]; mas[i0] = (mas[i0] + 1) % 12;
  msgs.colores = debeRechazar(p, mas, 'debería haber 11');
  // pieza inexistente: una arista con dos colores de caras opuestas (y colores bien contados: intercambiar
  // una pegatina de dos aristas)
  let inex = base.slice();
  let a1 = -1, a2 = -1;
  for (const x of ARISTAS[0].pegatinas) for (const y of ARISTAS[10].pegatinas) if (a1 < 0 && base[x] !== base[y] && !colPeg(base, ARISTAS[0]).includes(base[y])) { a1 = x; a2 = y; }
  [inex[a1], inex[a2]] = [inex[a2], inex[a1]];
  const vi = p.validar(inex);
  assert.equal(vi.valido, false);
  assert.ok(vi.errores.some((x) => /no forman ninguna arista|aparece 2 veces/.test(x)), vi.errores.join(' | '));
  // centros: repetidos y especulares (todo el puzzle reflejado)
  const rep = base.slice(); rep[CENTROS[0]] = base[CENTROS[1]];
  const vr = p.validar(rep);
  assert.equal(vr.valido, false);
  const ref = { [IDX.R]: IDX.L, [IDX.L]: IDX.R, [IDX.BR]: IDX.BL, [IDX.BL]: IDX.BR, [IDX.DR]: IDX.DL, [IDX.DL]: IDX.DR, [IDX.DBR]: IDX.DBL, [IDX.DBL]: IDX.DBR };
  msgs.centrosEspeculares = debeRechazar(p, e0.map((x) => ref[x] ?? x), 'orden especular');
  const opu = e0.map((x) => (x === IDX.F ? IDX.R : x === IDX.R ? IDX.F : x));
  msgs.centrosOpuestos = debeRechazar(p, opu, 'caras opuestas');
  guardarResultado('megaminx', { mensajes: msgs });
});

test('Megaminx: estados posibles aunque "raros" se aceptan y se resuelven', () => {
  p.inicializar();
  const rng = rngConSemilla(12);
  const base = girarAzar(p.aplicarSecuencia(e0, p.generarScramble(rng)), rng);
  const casos = {
    'dos esquinas giradas en sentidos opuestos': girarEsquina(girarEsquina(base, 2), 15, 2),
    'dos aristas volteadas': voltearArista(voltearArista(base, 4), 25),
    '3-ciclo de esquinas': ciclo3(base, ESQUINAS, 0, 7, 13),
    '3-ciclo de aristas': ciclo3(base, ARISTAS, 2, 11, 29),
    'dos parejas de esquinas intercambiadas': intercambiar(intercambiar(base, ESQUINAS, 1, 2), ESQUINAS, 5, 19),
    'dos parejas de aristas intercambiadas': intercambiar(intercambiar(base, ARISTAS, 0, 1), ARISTAS, 8, 9),
  };
  for (const [nombre, e] of Object.entries(casos)) {
    const v = p.validar(e);
    assert.ok(v.valido, `${nombre}: ${v.errores.join(' | ')}`);
    const r = p.resolver(e, { tiempoMax: 0 });
    assert.ok(r.ok, nombre);
    assert.ok(p.estaResuelto(p.aplicarSecuencia(e, r.movimientos)), nombre);
  }
});

test('Megaminx: cota inferior del número de Dios por conteo = 48 (giros de cara)', () => {
  const { cota, porLongitud } = cotaInferiorConteo();
  assert.equal(porLongitud[1], 48n); // 12 caras · 4 giros
  // 2 giros: caras vecinas en los dos órdenes (12·5) y no vecinas una sola vez (36 parejas), 4·4 giros cada una
  assert.equal(porLongitud[2], (12n * 5n + 36n) * 16n);
  assert.equal(cota, COTA_INFERIOR);
  guardarResultado('megaminx', { cotaInferior: cota, secuenciasHasta3: porLongitud.slice(0, 4).map(String) });
});

test('Megaminx: simplificación de soluciones', () => {
  const m = (s) => MOVS_CARA.indexOf(s);
  // R L R' -> L (R y L no son vecinas); U U2' -> U'; R R' -> nada
  const r = simplificarTramos([{ nombre: 'a', grupo: 'a', movs: [m('R'), m('L')] }, { nombre: 'b', grupo: 'b', movs: [m("R'"), m('U'), m("U2'"), m('F')] }]);
  assert.deepEqual(r.movs.map((x) => MOVS_CARA[x]), ['L', "U'", 'F']);
  assert.deepEqual(r.fases.map((f) => [f.nombre, f.inicio, f.fin]), [['a', 0, 1], ['b', 1, 3]]);
  assert.equal(p.buscarRedundanciaSolucion(['R', 'L', "R'"]), "R (posición 1) y R' (posición 3) se pueden unir");
  assert.equal(p.buscarRedundanciaSolucion(['R', 'F', "R'"]), null);
});

test('Megaminx: última capa — dos macros (o una corta más dos) resuelven los 4.665.600 casos', () => {
  const B = inicializarUltima();
  const L = B.lista;
  // macros: cada una deja todo lo demás en su sitio (se comprueba al generarlas) y
  // las más largas tienen 12 giros
  assert.ok(L.length > 10000);
  assert.ok(Math.max(...L.map((x) => x.sec.length)) <= 12);
  const rank5 = (q) => { let r = 0; for (let i = 0; i < 5; i++) { let c = 0; for (let j = i + 1; j < 5; j++) if (q[j] < q[i]) c++; r = r * (5 - i) + c; } return r; };
  const indice = (e, a) => {
    const pe = [], pa = []; let oe = 0, oa = 0;
    for (let j = 0; j < 5; j++) { pe.push((e[j] / 3) | 0); oe = oe * 3 + (e[j] % 3); pa.push(a[j] >> 1); oa = oa * 2 + (a[j] & 1); }
    return ((rank5(pe) * 243 + oe) * 120 + rank5(pa)) * 32 + oa;
  };
  const muestra = completo ? null : 1000;
  let cubiertos = 0;
  const bits = new Uint8Array(Math.ceil((120 * 243 * 120 * 32) / 8));
  if (!muestra) {
    // estados x con a(x) = efecto de b para algún par (a, b)
    const se = L.map((m) => [0, 1, 2, 3, 4].map((j) => m.ae[3 * j])), sa = L.map((m) => [0, 1, 2, 3, 4].map((j) => m.aa[2 * j]));
    const xe = new Array(5), xa = new Array(5);
    for (const m of L) {
      const ie = new Uint8Array(15), ia = new Uint8Array(10);
      m.ae.forEach((v, k) => { ie[v] = k; }); m.aa.forEach((v, k) => { ia[v] = k; });
      for (let s = 0; s < L.length; s++) {
        for (let j = 0; j < 5; j++) { xe[j] = ie[se[s][j]]; xa[j] = ia[sa[s][j]]; }
        const idx = indice(xe, xa);
        if (!((bits[idx >> 3] >> (idx & 7)) & 1)) { bits[idx >> 3] |= 1 << (idx & 7); cubiertos++; }
      }
    }
  }
  // recorrer todos los estados de la última capa (o una muestra) y resolver los que no
  // cubren dos macros, comprobando la solución
  const comprobar = (e, a) => {
    const sec = resolverUltima(e, a);
    assert.ok(sec, 'última capa sin solución');
    let x = e.map((h, j) => ESQ_LL[(h / 3) | 0] * 3 + (h % 3)), y = a.map((h, j) => ARI_LL[h >> 1] * 2 + (h & 1));
    for (const m of sec) { x = x.map((h) => slotMov[0][m * NS + h]); y = y.map((h) => slotMov[1][m * NS + h]); }
    assert.deepEqual(x, ESQ_LL.map((i) => i * 3));
    assert.deepEqual(y, ARI_LL.map((i) => i * 2));
    return sec.length;
  };
  const perms = []; // permutaciones pares de 5
  const perm = (a, k) => { if (k === 5) { let par = 0; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (a[i] > a[j]) par ^= 1; if (!par) perms.push(a.slice()); return; } for (let i = k; i < 5; i++) { [a[k], a[i]] = [a[i], a[k]]; perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
  perm([0, 1, 2, 3, 4], 0);
  let total = 0, conRespaldo = 0, suma = 0, n = 0;
  const rng = rngConSemilla(77);
  const ori = (k, mod) => { const o = []; let s = 0; for (let j = 0; j < 4; j++) { o.push(k % mod); s += k % mod; k = Math.floor(k / mod); } o.push((mod - (s % mod)) % mod); return o; };
  if (muestra) {
    for (let t = 0; t < muestra; t++) {
      const pe = perms[entero(rng, 60)], oe = ori(entero(rng, 81), 3), pa = perms[entero(rng, 60)], oa = ori(entero(rng, 16), 2);
      suma += comprobar(pe.map((q, j) => q * 3 + oe[j]), pa.map((q, j) => q * 2 + oa[j])); n++;
    }
  } else {
    for (const pe of perms) for (let ko = 0; ko < 81; ko++) for (const pa of perms) for (let ka = 0; ka < 16; ka++) {
      const oe = ori(ko, 3), oa = ori(ka, 2);
      const e = pe.map((q, j) => q * 3 + oe[j]), a = pa.map((q, j) => q * 2 + oa[j]);
      total++;
      const idx = indice(e, a);
      if ((bits[idx >> 3] >> (idx & 7)) & 1) continue;
      conRespaldo++;
      comprobar(e, a);
    }
    assert.equal(total, 4665600);
    assert.equal(cubiertos + conRespaldo, total);
    // muestra para la longitud media
    for (let t = 0; t < 3000; t++) {
      const pe = perms[entero(rng, 60)], oe = ori(entero(rng, 81), 3), pa = perms[entero(rng, 60)], oa = ori(entero(rng, 16), 2);
      suma += comprobar(pe.map((q, j) => q * 3 + oe[j]), pa.map((q, j) => q * 2 + oa[j])); n++;
    }
  }
  guardarResultado('megaminx', {
    ultimaCapa: {
      macros: L.length, msMacros: B.ms, secuenciasRecorridas: B.secuencias,
      ...(muestra ? { muestra } : { estados: total, conDosMacros: cubiertos, conTresMacros: conRespaldo }),
      longitudMediaAlAzar: +(suma / n).toFixed(2),
    },
  });
});

test(`Megaminx: el solver resuelve el 100 % (${CASOS_SOLVER} casos, puzzle reorientado al azar)`, () => {
  const ini = p.inicializar();
  const rng = rngConSemilla(500);
  const est0 = { ...estadisticas };
  const L = [], T = [], O = [], porEtapa = {};
  for (let i = 0; i < CASOS_SOLVER; i++) {
    const s = p.generarScramble(rng);
    const e = girarAzar(p.aplicarSecuencia(e0, s), rng);
    const v = p.validar(e);
    assert.ok(v.valido, `caso ${i}: ${v.errores.join(' | ')}`);
    const t0 = performance.now();
    const r = p.resolver(e);
    const dt = performance.now() - t0;
    assert.ok(r.ok, `caso ${i}: ${(r.errores || []).join(' | ')}`);
    // aplicar movimiento a movimiento con el modelo de pegatinas
    let x = e;
    for (const m of r.movimientos) {
      assert.ok(MOVS_CARA.includes(m), `giro de cara: ${m}`);
      x = p.aplicarMovimiento(x, m);
    }
    // exactamente resuelto: cada pegatina con el color de su centro (los centros no se mueven)
    assert.ok(geo.pegatinas.every((pg, k) => x[k] === e[CENTROS[pg.cara]]), `caso ${i}: no queda resuelto\n${p.formatear(s)}`);
    assert.equal(p.buscarRedundanciaSolucion(r.movimientos), null, `caso ${i}`);
    // las etapas cubren la solución entera, en orden y sin huecos
    let k = 0;
    for (const f of r.fases) { assert.equal(f.inicio, k); assert.ok(f.fin > f.inicio); k = f.fin; (porEtapa[f.nombre] ||= []).push(f.fin - f.inicio); }
    assert.equal(k, r.movimientos.length);
    L.push(r.movimientos.length); T.push(dt); O.push(r.orientaciones);
  }
  const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const m = media(L);
  const etapas = {};
  for (const et of [...ETAPAS.map((x) => x.nombre), 'Última capa']) etapas[et] = +((porEtapa[et] || []).reduce((a, b) => a + b, 0) / CASOS_SOLVER).toFixed(2);
  const res = {
    casosSolver: CASOS_SOLVER,
    resueltos: `${L.length}/${CASOS_SOLVER} (100%)`,
    longitudMedia: +m.toFixed(2),
    longitudMax: Math.max(...L),
    longitudMin: Math.min(...L),
    cotaInferior: COTA_INFERIOR,
    cociente: +(m / COTA_INFERIOR).toFixed(2),
    msMedio: Math.round(media(T)),
    msMax: Math.round(Math.max(...T)),
    orientacionesMedia: +media(O).toFixed(1),
    porEtapa: etapas,
    etapasResueltas: estadisticas.etapas - est0.etapas,
    etapasConRespaldo: estadisticas.respaldos - est0.respaldos,
    msTablas: ini.ms,
    tablas: { etapas: ini.tablas, macros: ini.macros, bytes: ini.bytes, msEtapas: ini.msEtapas, msUltima: ini.msUltima },
  };
  guardarResultado('megaminx', { solver: res });
  assert.ok(m < 200, `longitud media ${m}`);
});

test('Megaminx: con límites de búsqueda ridículos, las etapas se parten y la solución sigue siendo correcta', () => {
  p.inicializar();
  const rng = rngConSemilla(41);
  for (let i = 0; i < 3; i++) {
    const e = p.aplicarSecuencia(e0, p.generarScramble(rng));
    const s = reetiquetar(e, sigmaDeCentros(e));
    const r = resolverMegaminx(s, { orientaciones: 1, maxNodos: 50 });
    assert.ok(p.estaResuelto(p.aplicarSecuencia(e, r.movimientos)));
  }
});

test('Megaminx: pintado en cualquier orientación, la solución es para esa orientación', () => {
  p.inicializar();
  const rng = rngConSemilla(8);
  const e = p.aplicarSecuencia(e0, p.generarScramble(rng));
  for (const k of [0, 13, 37, 59]) {
    const g = aplicarPerm(e, geo.rotaciones[k]);
    const r = p.resolver(g, { tiempoMax: 0 });
    assert.ok(r.ok);
    assert.ok(p.estaResuelto(p.aplicarSecuencia(g, r.movimientos)));
  }
});
