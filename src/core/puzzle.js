// Interfaz común de los puzzles (ver ARQUITECTURA.md).
//
// Cada módulo de puzzle exporta un objeto creado con definirPuzzle({...}).
// definirPuzzle comprueba que estén los métodos obligatorios y rellena los
// métodos genéricos que no se hayan definido.

const OBLIGATORIOS = [
  'id', 'nombre', 'paleta', 'estadoResuelto', 'aplicarMovimiento', 'estaResuelto',
  'generarScramble', 'renderizar', 'invertirMovimiento', 'infoMovimiento',
];

export function definirPuzzle(def) {
  for (const k of OBLIGATORIOS) {
    if (def[k] === undefined) throw new Error(`Puzzle "${def.id || '?'}": falta "${k}"`);
  }
  const cap = Object.assign({ scramble: true, validar: false, resolver: false, editar: false }, def.capacidades || {});
  if (cap.validar && typeof def.validar !== 'function') throw new Error(`Puzzle ${def.id}: capacidades.validar sin validar()`);
  if (cap.resolver && typeof def.resolver !== 'function') throw new Error(`Puzzle ${def.id}: capacidades.resolver sin resolver()`);

  const p = Object.assign(
    {
      descripcion: '',
      separador: ' ',
      aplicarSecuencia(estado, movs) {
        let e = estado;
        for (const m of movs) e = p.aplicarMovimiento(e, m);
        return e;
      },
      parsear(texto) {
        return texto.trim().split(/\s+/).filter(Boolean);
      },
      formatear(movs) {
        return movs.join(p.separador);
      },
      invertir(movs) {
        return movs.slice().reverse().map((m) => p.invertirMovimiento(m));
      },
      buscarRedundancia(movs) {
        let tramoEje = null;
        let claves = new Set();
        for (let i = 0; i < movs.length; i++) {
          const { eje, clave } = p.infoMovimiento(movs[i]);
          if (eje !== tramoEje) { tramoEje = eje; claves = new Set(); }
          if (claves.has(clave)) return `movimiento redundante en la posición ${i + 1} (${movs[i]})`;
          claves.add(clave);
        }
        return null;
      },
      inicializar() { return { ms: 0 }; },
      estaInicializado() { return true; },
      // Edición: por defecto el estado es un array de colores por pegatina
      pegatinasEditables() { return []; },
      pintar(estado, i, color) { const e = estado.slice(); e[i] = color; return e; },
    },
    def,
  );
  p.capacidades = cap;
  return p;
}
