// Tabla hash de estados con claves de tamaño fijo (palabras de 32 bits) y un
// byte por estado (la distancia). Direccionamiento abierto; crece al llenarse.
// La usa la capa de bloqueos para el BFS completo de los espacios pequeños.

export function crearTablaEstados(palabras, capacidadInicial = 1 << 16) {
  let cap = 1;
  while (cap < capacidadInicial * 2) cap <<= 1;
  let claves = new Uint32Array(cap * palabras);
  let ocupado = new Uint8Array(cap);
  let dist = new Uint8Array(cap);
  let n = 0;
  // orden de inserción (para elegir un estado al azar y recorrer)
  let lista = new Int32Array(Math.max(16, capacidadInicial));

  function hash(k, o = 0) {
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < palabras; i++) {
      h = Math.imul(h ^ k[o + i], 0x01000193);
      h ^= h >>> 15;
    }
    return h >>> 0;
  }
  function buscarHueco(k, o = 0) {
    const mask = cap - 1;
    let i = hash(k, o) & mask;
    for (;;) {
      if (!ocupado[i]) return { i, existe: false };
      let igual = true;
      const b = i * palabras;
      for (let j = 0; j < palabras; j++) if (claves[b + j] !== k[o + j]) { igual = false; break; }
      if (igual) return { i, existe: true };
      i = (i + 1) & mask;
    }
  }
  function crecer() {
    const viejas = claves, viejoOcup = ocupado, viejaDist = dist, viejaCap = cap;
    cap *= 2;
    claves = new Uint32Array(cap * palabras);
    ocupado = new Uint8Array(cap);
    dist = new Uint8Array(cap);
    const nuevaLista = new Int32Array(lista.length);
    let m = 0;
    for (let t = 0; t < n; t++) {
      const i = lista[t];
      const { i: j } = buscarHueco(viejas, i * palabras);
      claves.set(viejas.subarray(i * palabras, (i + 1) * palabras), j * palabras);
      ocupado[j] = 1;
      dist[j] = viejaDist[i];
      nuevaLista[m++] = j;
    }
    lista = nuevaLista;
    void viejoOcup; void viejaCap;
  }

  return {
    get tamano() { return n; },
    get bytes() { return claves.byteLength + ocupado.byteLength + dist.byteLength + lista.byteLength; },
    /** Inserta la clave con distancia d si no estaba. Devuelve true si es nueva. */
    insertar(k, d) {
      if ((n + 1) * 2 > cap) crecer();
      const { i, existe } = buscarHueco(k);
      if (existe) return false;
      claves.set(k, i * palabras);
      ocupado[i] = 1;
      dist[i] = d;
      if (n >= lista.length) { const l = new Int32Array(lista.length * 2); l.set(lista); lista = l; }
      lista[n++] = i;
      return true;
    },
    /** Distancia de la clave, o -1 si no está. */
    distancia(k) {
      const { i, existe } = buscarHueco(k);
      return existe ? dist[i] : -1;
    },
    /** Clave y distancia del t-ésimo estado insertado (t en [0, tamano)). */
    nesimo(t, destino) {
      const i = lista[t];
      for (let j = 0; j < palabras; j++) destino[j] = claves[i * palabras + j];
      return dist[i];
    },
  };
}
