// Prueba de humo de los puzzles (npm run test:humo, junto con el registro y la prueba de
// humo de la app): pocos casos, pero de todo lo que tiene cada puzzle del registro, para
// cazar los fallos gordos en menos de 2 minutos. También forma parte de test:rapido y de
// npm test (es barata). Recorre el REGISTRO: un puzzle nuevo queda cubierto sin tocar nada.
//
//  1. Huellas de los giros: el estado tras cada giro básico y tras una secuencia fija se
//     compara con tests/huellas.json. Es lo único que detecta un giro invertido o cambiado:
//     el solver, el scramble y la vista 3D salen del mismo modelo, así que un giro mal
//     definido sigue dando soluciones "correctas" para ese modelo equivocado.
//     Si se cambia un giro a propósito: HUELLAS=actualizar npm run test:humo (y revisar el diff).
//  2. Por puzzle: scrambles válidos y sin redundancias, el validador rechaza una pegatina
//     pintada de otro color y el solver resuelve (1–3 casos).
//  3. 3x3 vendado: un espacio grande y uno pequeño, giros legales paso a paso.
//  4. Modo aprender: un caso de cada método, con el objetivo comprobado tras cada etapa.
// En test:rapido y npm test solo se ejecuta 1 (2–4 son un subconjunto de lo que ya
// comprueban los ficheros de cada puzzle, de los vendados y del modo aprender, con más casos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PUZZLES } from '../src/puzzles/index.js';
import { rngConSemilla } from '../src/core/rng.js';
import { crear3x3Vendado } from '../src/puzzles/vendado.js';
import { probarScrambles, probarSolver, NIVEL } from './util.mjs';
import { estadoAlAzar, comprobarCasoAprender } from './aprender-comprobar.mjs';

const FICHERO_HUELLAS = new URL('./huellas.json', import.meta.url);
const ACTUALIZAR = process.env.HUELLAS === 'actualizar';
const huella = (estado) => crypto.createHash('sha256').update(JSON.stringify(estado)).digest('hex').slice(0, 16);
const leerHuellas = () => { try { return JSON.parse(fs.readFileSync(FICHERO_HUELLAS, 'utf8')); } catch { return {}; } };

const enHumo = NIVEL === 'humo';

// Casos del solver por puzzle: los de solver lento (con límite de tiempo, 1,5–5 s) solo uno.
const CASOS_SOLVER = { '2x2': 3, '3x3': 2, pyraminx: 3, skewb: 3, square1: 2 };

test('humo: huellas de los giros (un giro invertido o cambiado cambia la huella)', () => {
  const guardadas = leerHuellas();
  const nuevas = {};
  for (const p of PUZZLES) {
    // secuencia fija: la primera vez, el scramble de semilla 1; después, la guardada
    // y los giros: los que salen en los scrambles de semillas 1–5 (en la práctica, todos)
    const secuencia = (!ACTUALIZAR && guardadas[p.id] && guardadas[p.id].secuencia) || p.generarScramble(rngConSemilla(1));
    const basicos = !ACTUALIZAR && guardadas[p.id] ? Object.keys(guardadas[p.id].giros)
      : [...new Set([1, 2, 3, 4, 5].flatMap((k) => p.generarScramble(rngConSemilla(k))))].sort();
    // (Ghost Cube, noche 16: desde la forma de cubo solo giran U, D y «A»; los demás, con las capas alineadas)
    const inicio = (m) => {
      const r = p.estadoResuelto();
      return p.shapeMod && !p.shapeMod.movimientosLegales(r).includes(m) ? p.aplicarMovimiento(r, 'A') : r;
    };
    const giros = Object.fromEntries(basicos.map((m) => [m, huella(p.aplicarMovimiento(inicio(m), m))]));
    nuevas[p.id] = { secuencia, total: huella(p.aplicarSecuencia(p.estadoResuelto(), secuencia)), giros };
    if (ACTUALIZAR) continue;
    const g = guardadas[p.id];
    assert.ok(g, `${p.nombre}: no tiene huellas guardadas (HUELLAS=actualizar npm run test:humo)`);
    for (const m of basicos) assert.equal(giros[m], g.giros[m], `${p.nombre}: el giro ${m} no deja el estado de siempre (¿giro invertido o cambiado?)`);
    assert.equal(nuevas[p.id].total, g.total, `${p.nombre}: la secuencia fija no deja el estado de siempre`);
  }
  if (ACTUALIZAR) fs.writeFileSync(FICHERO_HUELLAS, JSON.stringify(nuevas, null, 1).replace(/\n {3,}/g, ' ').replace(/\n  \]/g, ' ]') + '\n');
});

for (const p of enHumo ? PUZZLES : []) {
  test(`humo: ${p.nombre}: scrambles, validador y solver`, () => {
    const s = probarScrambles(p, 1, 2);
    assert.equal(s.scrambles, 2);
    if (p.capacidades.validar && p.shapeMod) {
      // shape mods (noche 16): de un solo color, no se pinta; una esquina girada en su sitio no vale
      const e = p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rngConSemilla(3)));
      assert.ok(p.validar(e).valido);
      const g = p.clonar(e);
      g.co[0] = (g.co[0] + 1) % 3;
      assert.equal(p.validar(g).valido, false, `${p.nombre}: el validador acepta una esquina girada`);
    } else if (p.capacidades.validar) {
      // una pegatina pintada de otro color: los colores ya no cuadran
      const e = p.aplicarSecuencia(p.estadoResuelto(), p.generarScramble(rngConSemilla(3)));
      assert.ok(p.validar(e).valido);
      // (la primera editable que es una pegatina de verdad: en el Square-1 hay "editables"
      // especiales, como la capa del medio, que pintadas dan otro estado válido)
      const pintar = (i, c) => (p.pintar ? p.pintar(e, i, c) : Object.assign(e.slice(), { [i]: c }));
      const colorDe = (i) => p.paleta.findIndex((_, c) => huella(pintar(i, c)) === huella(e));
      const i = (p.pegatinasEditables ? p.pegatinasEditables(e) : [0]).find((k) => colorDe(k) >= 0);
      assert.ok(i !== undefined, `${p.nombre}: ninguna pegatina editable`);
      const otro = (colorDe(i) + 1) % p.paleta.length;
      assert.equal(p.validar(pintar(i, otro)).valido, false, `${p.nombre}: el validador acepta una pegatina pintada de otro color`);
    }
    if (p.capacidades.resolver) {
      const r = probarSolver(p, { semilla: 2, n: CASOS_SOLVER[p.id] ?? 1 });
      assert.match(r.resueltos, /\(100\.0%\)/);
    }
  });
}

/** Aplica una secuencia comprobando la legalidad y los bloques en cada paso. */
function aplicarComprobando(p, estado, movs) {
  let e = estado;
  for (const m of movs) {
    assert.ok(p.movimientoLegal(e, m).legal, `${m} es ilegal en ${movs.join(' ')}`);
    e = p.aplicarMovimiento(e, m);
    assert.ok(p.bloquesIntactos(e), `bloque roto tras ${m}`);
  }
  return e;
}

for (const [nombre, def, n] of !enHumo ? [] : [['una pareja UFR+UF (espacio grande)', [['UFR', 'UF']], 2], ['Bicube (espacio pequeño, óptima por BFS)', 'E0400B43FC5A1', 3]]) {
  test(`humo: 3x3 vendado, ${nombre}`, () => {
    const p = crear3x3Vendado(def);
    p.inicializar();
    const rng = rngConSemilla(11);
    for (let i = 0; i < n; i++) {
      const s = p.generarScramble(rng);
      assert.equal(p.buscarRedundancia(s), null);
      const e = aplicarComprobando(p, p.estadoResuelto(), s);
      assert.ok(p.validar(e).valido);
      const r = p.resolver(e, { msMax: 300 });
      assert.ok(r.ok, (r.errores || []).join(' | '));
      assert.ok(p.estaResuelto(aplicarComprobando(p, e, r.movimientos)), `no resuelve\nscramble: ${s.join(' ')}`);
    }
    // un giro que rompe un bloque es ilegal (y aplicarlo da error)
    const ilegal = 'URFDLB'.split('').find((m) => !p.movimientoLegal(p.estadoResuelto(), m).legal);
    assert.ok(ilegal, 'hay algún giro ilegal en el resuelto');
    assert.throws(() => p.aplicarMovimiento(p.estadoResuelto(), ilegal), /ilegal/);
  });
}

for (const p of PUZZLES.filter((q) => enHumo && q.metodosAprender && q.metodosAprender.length)) {
  test(`humo: modo aprender, ${p.nombre} (${p.metodosAprender.map((m) => m.id).join(', ')})`, () => {
    const rng = rngConSemilla(31);
    const n = ['4x4', '5x5'].includes(p.id) ? 1 : 2;
    for (const { id: metodo } of p.metodosAprender) {
      for (let c = 0; c < n; c++) {
        const e = estadoAlAzar(p, rng);
        comprobarCasoAprender(p, metodo, e, p.aprender(e, metodo), c);
      }
    }
  });
}
