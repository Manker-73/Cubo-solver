// Guion de una solución por un método humano (modo aprender): etapas con nombre
// y objetivo, y dentro de cada etapa bloques de movimientos con lo que consigue
// cada uno, el algoritmo (si es uno conocido) y las piezas en las que se trabaja.
//
// Formato del resultado (lo usa la interfaz):
//   { ok, metodo, movimientos, giros, fases: [{nombre, inicio, fin, grupo}],
//     etapas: [{ nombre, objetivo, inicio, fin, grupo,
//                bloques: [{ inicio, fin, texto, algoritmo, piezas }] }] }
// `piezas` = índices de las pegatinas de esas piezas AL EMPEZAR el bloque (la
// interfaz las sigue movimiento a movimiento para resaltarlas).

export function crearGuion(aplicar, estado, { esRotacion = () => false } = {}) {
  const movimientos = [];
  const etapas = [];
  let e = estado;
  const g = {
    get estado() { return e; },
    etapa(nombre, objetivo, grupo = null) {
      etapas.push({ nombre, objetivo, grupo: grupo || nombre, inicio: movimientos.length, fin: movimientos.length, bloques: [] });
    },
    /** Añade un bloque (aunque no tenga movimientos no se guarda vacío). */
    bloque(movs, texto, { algoritmo = null, piezas = [] } = {}) {
      if (!movs.length) return;
      const et = etapas[etapas.length - 1];
      const inicio = movimientos.length;
      for (const m of movs) { e = aplicar(e, m); movimientos.push(m); }
      et.bloques.push({ inicio, fin: movimientos.length, texto, algoritmo, piezas: [...new Set(piezas)] });
      et.fin = movimientos.length;
    },
    /** Comprueba el objetivo de la etapa actual (si falla, es un error del método). */
    comprobar(ok, que) {
      if (!ok) throw new Error(`Modo aprender: no se cumple el objetivo de la etapa (${que})`);
    },
    resultado(metodo) {
      const finales = etapas.filter((et) => et.fin > et.inicio);
      return {
        ok: true,
        metodo,
        movimientos,
        giros: movimientos.filter((m) => !esRotacion(m)).length,
        fases: finales.map(({ nombre, inicio, fin, grupo }) => ({ nombre, inicio, fin, grupo })),
        etapas: finales,
      };
    },
  };
  return g;
}
