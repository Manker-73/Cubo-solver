// Reproductor de una secuencia de movimientos (scramble o solución): paso adelante,
// paso atrás, ir a un paso, play/pausa. Con la vista 3D anima cada paso; en 2D el
// paso cambia al momento (y la prueba de humo puede contar con ello).
//
// opciones:
//   total()          número de pasos
//   leer(), fijar(k) paso actual (lo guarda quien lo usa)
//   transicion(k)    [{ antes, partes }]: giros 3D que llevan del paso k al k+1
//                    (antes = estado sobre el que se aplica cada giro)
//   estadoEn(k)      estado del paso k (para mostrarlo al final de cada animación)
//   vista()          vista 3D activa o null (2D)
//   puzzle()         puzzle actual (vista3D)
//   alCambiar()      redibujar (texto del paso, lista, 2D...)
//   ms()             duración de un giro animado; pausa() entre pasos al reproducir

export function crearReproductor(o) {
  let reproduciendo = false;
  let gen = 0;             // cambia al saltar o parar: las tareas viejas no hacen nada
  let cola = Promise.resolve();
  let pendientes = 0;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  async function animarTransicion(v, k, haciaAtras, ms) {
    const p = o.puzzle();
    let pasos = o.transicion(k);
    if (haciaAtras) pasos = pasos.slice().reverse();
    for (const { antes, partes } of pasos) {
      v.mostrar(p.vista3D(antes));
      await v.animar(partes, haciaAtras ? { ms, desde: 1, hasta: 0 } : { ms });
    }
  }

  function encolar(tarea) {
    const g = gen;
    const v = o.vista();
    if (pendientes > 0 && v) v.terminar(); // el usuario va más rápido que la animación
    pendientes++;
    const r = cola.then(async () => {
      try { if (g === gen) await tarea(g); } finally { pendientes--; }
    });
    cola = r.catch(() => {});
    return r;
  }

  function mover(d) {
    const k = o.leer();
    const destino = k + d;
    if (destino < 0 || destino > o.total()) return Promise.resolve();
    const v = o.vista();
    if (!v) { o.fijar(destino); o.alCambiar(); return Promise.resolve(); }
    return encolar(async (g) => {
      const k2 = o.leer();
      if (k2 + d < 0 || k2 + d > o.total()) return;
      const ms = pendientes > 1 ? 0 : o.ms();
      await animarTransicion(v, d > 0 ? k2 : k2 - 1, d < 0, ms);
      // si mientras se animaba el usuario saltó a otro paso (⇥, ⇤, un movimiento de la lista) o se
      // canceló, el salto manda: este giro ya no cambia el paso (noche 15: antes lo pisaba)
      if (g !== gen) return;
      o.fijar(k2 + d);
      o.alCambiar();
    });
  }

  const api = {
    get reproduciendo() { return reproduciendo; },
    adelante: () => mover(1),
    atras: () => mover(-1),
    irA(k) {
      gen++;
      reproduciendo = false;
      const v = o.vista();
      if (v) v.terminar();
      o.fijar(Math.max(0, Math.min(o.total(), k)));
      o.alCambiar();
    },
    parar() {
      if (!reproduciendo) return;
      reproduciendo = false;
      o.alCambiar();
    },
    /** Corta todo (cambio de puzzle, de scramble o de modo 2D/3D). */
    cancelar() {
      gen++;
      reproduciendo = false;
      const v = o.vista();
      if (v) v.terminar();
    },
    alternar() {
      if (reproduciendo) { api.parar(); return; }
      if (o.total() === 0) return;
      if (o.leer() >= o.total()) { o.fijar(0); }
      reproduciendo = true;
      o.alCambiar();
      const g = gen;
      (async () => {
        while (reproduciendo && g === gen && o.leer() < o.total()) {
          await mover(1);
          if (!reproduciendo || g !== gen) break;
          await esperar(o.vista() ? o.pausa3D() : o.pausa());
        }
        if (g === gen && reproduciendo) { reproduciendo = false; o.alCambiar(); }
      })();
    },
    /** Promesa que se cumple cuando acaban las animaciones encoladas (tests). */
    esperar: () => cola,
  };
  return api;
}
