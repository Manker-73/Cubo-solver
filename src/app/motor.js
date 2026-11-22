// Motor de cálculo de la interfaz: envía las tareas pesadas a Web Workers creados
// desde un blob. Si no hay Worker (o no arranca, o falla), todo sigue funcionando en
// el hilo principal con el mismo servicio.
//
// Dos Workers con el mismo código:
//   - "principal": lo que pide el usuario y necesita las tablas del solver
//     (inicializar, validar, resolver). Nunca recibe trabajo de fondo.
//   - "fondo": los scrambles. Los que pide el usuario (prioridad alta) van primero; los
//     precargados (prioridad baja) solo se envían cuando este Worker está libre y no
//     espera nada más. Si el de fondo está ocupado con una precarga y el principal está
//     libre, un scramble pedido por el usuario va al principal: nunca espera a una precarga.
// Cada Worker hace una tarea cada vez (la cola está aquí, no en el Worker), así una
// petición del usuario solo puede esperar a la tarea que ya está en marcha.
// Cada petición lleva un identificador (`id`) que se devuelve con la respuesta.

import { atender } from './servicio.js';

const PING_MS = 4000;
const PRIORIDAD = { alta: 0, media: 1, baja: 2 };

/**
 * crearMotor({ codigoWorker, alCambiarModo, dosWorkers })
 * Devuelve { pedir(op, puzzle, datos, { prioridad }) -> Promise, modo(), listo, ocupado(), estadisticas() }.
 * La promesa de pedir lleva `.id` (identificador de la petición).
 */
export function crearMotor({ codigoWorker = null, alCambiarModo = () => {}, dosWorkers = true } = {}) {
  let modo = 'local';
  let siguienteId = 1;
  const trabajadores = []; // { nombre, w, tarea, vivo }
  const cola = [];         // { id, msg, prioridad, destino, resolver, rechazar, orden }
  let orden = 0;
  let localOcupado = false;
  const registro = { enviadas: [] }; // para los tests: { id, op, puzzle, prioridad, a }

  const local = async (msg) => {
    // dejar que la página se pinte antes de bloquear el hilo
    await new Promise((r) => setTimeout(r, 30));
    return atender(msg);
  };

  function crearTrabajador(nombre, url) {
    const t = { nombre, w: new Worker(url), tarea: null, vivo: true };
    t.w.onmessage = (ev) => {
      const { id, ok, resultado, error } = ev.data || {};
      const tarea = t.tarea;
      if (!tarea || tarea.id !== id) return;
      t.tarea = null;
      if (ok) tarea.resolver(resultado); else tarea.rechazar(new Error(error));
      despachar();
    };
    t.w.onerror = (ev) => {
      if (ev && ev.preventDefault) ev.preventDefault();
      caido(t, 'el Worker ha fallado');
    };
    return t;
  }

  function caido(t, motivo) {
    if (!t.vivo) return;
    t.vivo = false;
    try { t.w.terminate(); } catch { /* nada */ }
    const pendiente = t.tarea;
    t.tarea = null;
    if (pendiente) cola.unshift(pendiente); // se rehace en otro sitio
    if (!trabajadores.some((x) => x.vivo)) {
      modo = 'local';
      alCambiarModo(modo, motivo);
    }
    despachar();
  }

  const vivo = (nombre) => trabajadores.find((t) => t.vivo && t.nombre === nombre);
  const libre = (t) => t && !t.tarea;

  let listo = Promise.resolve();
  if (codigoWorker && typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    try {
      const url = URL.createObjectURL(new Blob([codigoWorker], { type: 'text/javascript' }));
      trabajadores.push(crearTrabajador('principal', url));
      modo = 'worker';
      if (dosWorkers) {
        try { trabajadores.push(crearTrabajador('fondo', url)); } catch { /* con uno basta */ }
      }
      // Comprobar que arrancan de verdad (algunas páginas bloquean los workers de blob)
      listo = Promise.all(trabajadores.map((t) => new Promise((resolve) => {
        const temporizador = setTimeout(() => { caido(t, 'el Worker no responde'); resolve(); }, PING_MS);
        encolar({ op: 'ping' }, 'alta', t.nombre).then(() => { clearTimeout(temporizador); resolve(); }, () => { clearTimeout(temporizador); resolve(); });
      }))).then(() => {});
    } catch (err) {
      for (const t of trabajadores) { try { t.w.terminate(); } catch { /* */ } }
      trabajadores.length = 0;
      modo = 'local';
    }
  }
  alCambiarModo(modo, trabajadores.length ? null : 'Worker no disponible');

  function despachar() {
    cola.sort((a, b) => PRIORIDAD[a.prioridad] - PRIORIDAD[b.prioridad] || a.orden - b.orden);
    if (!trabajadores.some((t) => t.vivo)) { despacharLocal(); return; }
    const principal = vivo('principal');
    const fondo = vivo('fondo');
    for (let i = 0; i < cola.length; i++) {
      const tarea = cola[i];
      let t = null;
      if (tarea.destino === 'principal' || tarea.destino === 'fondo') {
        // ping a un Worker concreto (o, si ya no está, a cualquiera)
        t = vivo(tarea.destino) || principal || fondo;
        if (!libre(t)) continue;
      } else if (tarea.msg.op === 'scramble' && !tarea.msg.bloqueos) {
        // (los de un cubo vendado necesitan sus tablas: van con lo demás, al principal)
        if (tarea.prioridad === 'baja') {
          // precarga: solo en el Worker de fondo libre y sin nada más urgente esperando
          // (si no hay Worker de fondo, en el principal libre y sin nada esperando)
          const destino = fondo || principal;
          const urgentes = cola.some((x) => x !== tarea && x.prioridad !== 'baja');
          if (urgentes || !libre(destino)) continue;
          t = destino;
        } else {
          t = libre(fondo) ? fondo : libre(principal) && !cola.some((x, j) => j < i && x.msg.op !== 'scramble') ? principal : null;
          if (!t) continue;
        }
      } else {
        t = principal || fondo;
        if (!libre(t)) continue;
      }
      cola.splice(i, 1);
      i--;
      t.tarea = tarea;
      registro.enviadas.push({ id: tarea.id, op: tarea.msg.op, puzzle: tarea.msg.puzzle, prioridad: tarea.prioridad, a: t.nombre });
      try {
        t.w.postMessage({ id: tarea.id, ...tarea.msg });
      } catch {
        caido(t, 'no se pudo enviar al Worker');
        return;
      }
    }
  }

  function despacharLocal() {
    if (localOcupado || !cola.length) return;
    // en el hilo principal: de una en una, lo urgente primero
    const tarea = cola.shift();
    localOcupado = true;
    registro.enviadas.push({ id: tarea.id, op: tarea.msg.op, puzzle: tarea.msg.puzzle, prioridad: tarea.prioridad, a: 'local' });
    local(tarea.msg).then(tarea.resolver, tarea.rechazar).finally(() => { localOcupado = false; despachar(); });
  }

  function encolar(msg, prioridad = 'alta', destino = null) {
    const id = siguienteId++;
    let resolver, rechazar;
    const p = new Promise((res, rej) => { resolver = res; rechazar = rej; });
    p.id = id;
    cola.push({ id, msg, prioridad, destino, resolver, rechazar, orden: orden++ });
    despachar();
    return p;
  }

  return {
    pedir: (op, puzzle, datos = {}, { prioridad = 'alta' } = {}) => encolar({ op, puzzle, ...datos }, prioridad),
    modo: () => modo,
    listo,
    /** Sube la prioridad de una petición que aún espera (p. ej. una precarga que ahora pide el usuario). */
    subirPrioridad(id, prioridad) {
      const t = cola.find((x) => x.id === id);
      if (t && PRIORIDAD[prioridad] < PRIORIDAD[t.prioridad]) { t.prioridad = prioridad; despachar(); }
    },
    /** true si hay algo en marcha o esperando con prioridad alta o media. */
    ocupado: () => cola.some((x) => x.prioridad !== 'baja') || trabajadores.some((t) => t.vivo && t.tarea && t.tarea.prioridad !== 'baja') || localOcupado,
    /** Peticiones enviadas (para los tests). */
    registro,
    workers: () => trabajadores.filter((t) => t.vivo).map((t) => t.nombre),
  };
}
