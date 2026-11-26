// Tipos de los contratos del proyecto (paso 0 de TypeScript: el código sigue siendo JavaScript).
//
// Este fichero es solo de tipos: no se ejecuta ni entra en el bundle. Los ficheros con
// "// @ts-check" lo importan desde comentarios JSDoc:
//   /** @import { Puzzle, DefinicionPuzzle } from './tipos.js' */
// y `npm run tipos` (tsc --noEmit) comprueba que el código los cumple.
// Lo explica ARQUITECTURA.md, "Tipos" (y la tabla de la interfaz común, de la que sale esto).

import type { ModeloBloqueos } from './bloqueos.js';

// ---------------------------------------------------------------------------
// Básicos
// ---------------------------------------------------------------------------

/** Movimiento en notación WCA ("R", "U2'", "Rw", "3Rw", "R++", "(1,0)", "/", "x"…). */
export type Movimiento = string;

/** Generador de aleatorios en [0, 1) (src/core/rng.js: con semilla o criptográfico). */
export type Rng = () => number;

/** Color de la paleta: `hex` para dibujar, `nombre` para los mensajes. */
export interface ColorPaleta {
  nombre: string;
  hex: string;
}

/**
 * Estado de los puzzles de pegatinas: índice en la paleta de cada pegatina
 * (−1, o null en el editor, = sin pintar). El Square-1 usa otro estado (objeto).
 */
export type EstadoPegatinas = number[];

export interface Capacidades {
  scramble: boolean;
  validar: boolean;
  resolver: boolean;
  editar: boolean;
}

/** Para detectar redundancias: dos movimientos con el mismo `eje` conmutan; misma `clave` = misma capa. */
export interface InfoMovimiento {
  eje: string | number;
  clave: string | number;
}

export interface Validacion {
  /** true solo si está demostrado que el estado es posible. */
  valido: boolean;
  /** Mensajes en lenguaje claro (vacío si es válido). */
  errores: string[];
  /**
   * (Sesión «validador con muchas geometrías».) Tres resultados: 'valido' y 'imposible' están
   * demostrados; 'sin-comprobar' no (se muestra como aviso y se deja intentar resolver). Los
   * puzzles que no lo dan: 'valido' si `valido`, 'imposible' si no.
   */
  resultado?: 'valido' | 'imposible' | 'sin-comprobar';
  /** Avisos (con 'sin-comprobar'). */
  avisos?: string[];
  /**
   * (Noche 14, con `elegirIguales`.) El estado con las identidades de las piezas iguales que lo hacen
   * alcanzable (4x4/5x5 vendados: qué centro blanco está en cada sitio). Solo si es distinto del dado.
   */
  estado?: EstadoPegatinas;
}

/** Opciones de `validar`: giros que llevan del resuelto al estado (un scramble de la app sin tocar). */
export interface OpcionesValidar {
  secuencia?: Movimiento[];
  msMax?: number;
  /**
   * (Noche 14: colocar piezas.) El usuario no distingue las piezas iguales: la app puede elegir su
   * identidad. Válido si alguna asignación lo hace alcanzable; `Validacion.estado` la lleva.
   */
  elegirIguales?: boolean;
}

/** Tramo de una solución (barra de fases). `grupo` = clase de color `f-<grupo>`. */
export interface Fase {
  nombre: string;
  inicio: number;
  fin: number;
  grupo?: string | null;
}

/** Resultado de `resolver` (también lo que añade el envoltorio de bloqueos). */
export type ResultadoResolver = ResolverOk | ResolverError;

export interface ResolverOk {
  ok: true;
  movimientos: Movimiento[];
  ms?: number;
  fases?: Fase[] | null;
  errores?: string[];
  // --- solo los puzzles vendados (src/core/bloqueos.js) ---
  estrategia?: 'A' | 'B' | 'sin bloqueos';
  detalle?: DetalleEstrategias;
  sinBloqueos?: { longitud: number; optima: boolean };
  /** Estrategia B: posiciones de la solución en las que se vuelve a la geometría resuelta. */
  vueltasGeometria?: number[];
}

export interface ResolverError {
  ok: false;
  errores: string[];
  movimientos?: Movimiento[];
  ms?: number;
  fases?: null;
  estrategia?: 'sin bloqueos';
}

export interface OpcionesResolver {
  /** Límite de tiempo (ms): se devuelve la mejor solución encontrada. */
  msMax?: number;
  msDuro?: number;
  tiempoMax?: number;
  objetivo?: number;
  /** Bloqueos: 'A' o 'B' para forzar una estrategia. */
  estrategia?: 'A' | 'B';
  compararSinBloqueos?: boolean;
  /** Bloqueos: giros que llevan del resuelto al estado (scramble de la app sin tocar): alcanzable por construcción. */
  secuencia?: Movimiento[];
  [opcion: string]: unknown;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

/** Herramienta del editor (1 o 2 toques). `usaColor`: recibe el último color elegido. */
export interface Herramienta {
  id: string;
  nombre: string;
  icono: string;
  toques: 1 | 2;
  usaColor?: boolean;
  titulo?: string;
}

/** Botón extra del editor (p. ej. girar una capa del Square-1). */
export interface AccionEditor {
  id: string;
  etiqueta: string;
  titulo?: string;
}

export interface VistaEditor {
  id: string;
  nombre: string;
}

/** Opciones de `renderizar` (las que pasa la interfaz y las que añade el envoltorio de bloqueos). */
export interface OpcionesRender {
  editable?: boolean;
  /** Índices que el editor deja pintar. */
  editables?: Set<number> | number[] | null;
  /** Primer toque de una herramienta de dos toques. */
  seleccion?: number | null;
  /** Vista del editor (`vistasEditor`). */
  vista?: string | null;
  /** Letras de las caras (Megaminx) mientras hay una solución. */
  etiquetas?: boolean;
  /** Bloqueos: lados de cada pegatina que llegan hasta el borde (piezas pegadas unidas). */
  expandir?: Map<number, Array<{ dx: number; dy: number } | undefined>>;
  /** Bloqueos: colores que se dibujan en vez de los del estado (el editor de bloques). */
  colores?: EstadoPegatinas;
  bloqueEnPosicion?: Int16Array;
  [opcion: string]: unknown;
}

// ---------------------------------------------------------------------------
// Vista 3D (src/core/modelo3d.js; ARQUITECTURA.md, "Vista 3D")
// ---------------------------------------------------------------------------

export type Vec3 = number[];

export interface Pegatina3D {
  /** Polígono convexo 3D de la pegatina entera (sin encoger). */
  puntos: Vec3[];
  /** Normal hacia fuera (unitaria). */
  normal: Vec3;
  centro?: Vec3;
  /** Índice que entienden `pintar` / `usarHerramienta` (null si no se edita). */
  indice: number | null;
  /** Clave de la pieza (para resaltar piezas). */
  pieza: string | null;
  /** Bloqueos: lados que llegan hasta el borde (sin el hueco negro). */
  expandir?: boolean[];
}

export interface Camara3D {
  desde: Vec3;
  arriba: Vec3;
}

/** Plano de corte n·x = h. */
export interface Corte {
  n: Vec3;
  h: number;
}

export interface Etiqueta3D {
  texto: string;
  pos: Vec3;
  normal: Vec3;
}

export interface Geometria3D {
  pegatinas: Pegatina3D[];
  radio: number;
  camara: Camara3D;
  cortes?: Corte[];
  etiquetas?: Etiqueta3D[] | null;
}

/** Lo que devuelve `vista3D`: la geometría (mismo objeto mientras no cambie la forma) y los colores. */
export interface Vista3D {
  geometria: Geometria3D;
  /** Color (índice de la paleta, −1 sin pintar) de cada pegatina de la geometría. */
  colores: number[];
}

/** Parte que gira en un movimiento (radianes, regla de la mano derecha). */
export interface ParteGiro3D {
  eje: Vec3;
  angulo: number;
  /** Índices en `geometria.pegatinas` de `vista3D(estado)`. */
  pegatinas: number[];
}

export interface Reorientacion3D<E> {
  partes: ParteGiro3D[];
  estado: E;
}

/** Los tres métodos de la vista 3D (lo que devuelve `modelo3DPegatinas` y `modelo3DGeo`). */
export interface Modelo3D<E> {
  vista3D(estado: E): Vista3D;
  giro3D(estado: E, mov: Movimiento): ParteGiro3D[];
}

// ---------------------------------------------------------------------------
// Modo aprender (src/aprender/guion.js; ARQUITECTURA.md, "Modo aprender")
// ---------------------------------------------------------------------------

export interface MetodoAprender {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface BloqueGuion {
  inicio: number;
  fin: number;
  /** Lo que consigue el bloque. */
  texto: string;
  /** Nombre del algoritmo, si es uno conocido (Sune, PLL T-perm, OLL 33…). */
  algoritmo: string | null;
  /** Pegatinas de las piezas en las que se trabaja AL EMPEZAR el bloque. */
  piezas: number[];
}

export interface EtapaGuion {
  nombre: string;
  objetivo: string;
  grupo: string;
  inicio: number;
  fin: number;
  bloques: BloqueGuion[];
}

/** Resultado de `aprender(estado, metodo)`: el guion o, si el estado no es válido, los errores. */
export type ResultadoAprender = GuionAprender | AprenderError;

export interface AprenderError {
  ok: false;
  errores: string[];
  ms?: number;
}

/** Lo que devuelve `crearGuion(...).resultado(metodo)`. */
export interface GuionAprender {
  ok: true;
  metodo: string;
  /** Incluye las rotaciones del cubo entero (x, y, z). */
  movimientos: Movimiento[];
  /** Movimientos que no son rotaciones. */
  giros: number;
  fases: Fase[];
  etapas: EtapaGuion[];
  ms?: number;
}

export interface OpcionesBloque {
  algoritmo?: string | null;
  piezas?: number[];
}

/** Constructor de guiones que devuelve `crearGuion`. */
export interface Guion<E> {
  readonly estado: E;
  etapa(nombre: string, objetivo: string, grupo?: string | null): void;
  bloque(movs: Movimiento[], texto: string, opciones?: OpcionesBloque): void;
  comprobar(ok: boolean, que: string): void;
  resultado(metodo: string): GuionAprender;
}

// ---------------------------------------------------------------------------
// Interfaz común de un puzzle (src/core/puzzle.js; ARQUITECTURA.md, "Interfaz común")
// ---------------------------------------------------------------------------

/**
 * Lo que un módulo de puzzle pasa a `definirPuzzle`. Los métodos usan sintaxis de
 * método (no de propiedad) a propósito: así un Puzzle<EstadoPegatinas> sirve donde se
 * espera un Puzzle<unknown> (el registro mezcla estados distintos).
 */
export interface DefinicionPuzzle<E> {
  // ---- obligatorio ----
  id: string;
  nombre: string;
  paleta: ColorPaleta[];
  capacidades: Partial<Capacidades>;
  estadoResuelto(): E;
  /** Devuelve un estado nuevo; lanza un error si el movimiento no existe. */
  aplicarMovimiento(estado: E, mov: Movimiento): E;
  /** true si está resuelto (en cualquier orientación). */
  estaResuelto(estado: E): boolean;
  /** opciones.modo (vendados con mezcla extrema): 'practico' (por defecto) o 'mezclado'. */
  generarScramble(rng: Rng, opciones?: { modo?: 'practico' | 'mezclado'; giros?: number }): Movimiento[];
  invertirMovimiento(mov: Movimiento): Movimiento;
  infoMovimiento(mov: Movimiento): InfoMovimiento;
  /** SVG (texto); las pegatinas editables llevan class="pegatina" data-i="i". */
  renderizar(estado: E, opciones?: OpcionesRender): string;

  // ---- opcional (según capacidades) ----
  validar?(estado: E, opciones?: OpcionesValidar): Validacion;
  /** Genera las tablas (idempotente). */
  inicializar?(): { ms: number; yaEstaba?: boolean };
  estaInicializado?(): boolean;
  resolver?(estado: E, opciones?: OpcionesResolver): ResultadoResolver;
  /** Índices que el editor deja pintar (pueden depender del estado: Square-1). */
  pegatinasEditables?(estado?: E): number[];
  pintar?(estado: E, i: number, color: number): E;
  buscarRedundancia?(movs: Movimiento[]): string | null;
  buscarRedundanciaSolucion?(movs: Movimiento[]): string | null;
  parsear?(texto: string): Movimiento[];
  formatear?(movs: Movimiento[]): string;
  separador?: string;
  clonar?(estado: E): E;
  herramientas?: Herramienta[];
  /** Lanza un Error con un mensaje claro si no se puede. */
  usarHerramienta?(estado: E, id: string, indices: number[], contexto?: { color?: number }): E;
  herramientaInicial?: string;
  indicesInmediatos?: number[];
  accionesEditor?: AccionEditor[];
  aplicarAccion?(estado: E, id: string, contexto?: { color?: number }): E;
  vistasEditor?: VistaEditor[];
  estadoVistaScramble?(estado: E): E;
  notaScramble?(movs: Movimiento[]): string;
  leyendaNotacion?(): { svg: string; texto: string };
  describirLongitud?(movs: Movimiento[]): string;
  tipoScramble?: string;
  descripcion?: string;
  avisoInicializacion?: string;
  /** ms aproximados del primer scramble: ordena las precargas. */
  costeScramble?: number;
  // vista 3D
  vista3D?(estado: E): Vista3D;
  giro3D?(estado: E, mov: Movimiento): ParteGiro3D[];
  reorientar3D?(estado: E): Reorientacion3D<E> | null;
  // modo aprender
  metodosAprender?: MetodoAprender[];
  aprender?(estado: E, metodo?: string): ResultadoAprender;
  // estado aleatorio y bloqueos
  estadoAleatorio?(rng: Rng): E;
  soporteBloqueos?: SoporteBloqueos<E>;
  /** (Noche 14) Introducir el estado colocando piezas (src/core/colocar.js). */
  colocarPiezas?: ColocarPiezas;
  solucionSinBloqueos?(estado: E): { movimientos: Movimiento[]; optima: boolean } | null;
  ejemplosBloqueos?: EjemploBloqueos[];
}

/** Lo que devuelve `definirPuzzle`: la definición con los métodos por defecto ya rellenos. */
export interface Puzzle<E> extends DefinicionPuzzle<E> {
  capacidades: Capacidades;
  descripcion: string;
  costeScramble: number;
  separador: string;
  aplicarSecuencia(estado: E, movs: Movimiento[]): E;
  invertir(movs: Movimiento[]): Movimiento[];
  parsear(texto: string): Movimiento[];
  formatear(movs: Movimiento[]): string;
  buscarRedundancia(movs: Movimiento[]): string | null;
  buscarRedundanciaSolucion(movs: Movimiento[]): string | null;
  inicializar(): { ms: number; yaEstaba?: boolean };
  estaInicializado(): boolean;
  pegatinasEditables(estado?: E): number[];
  pintar(estado: E, i: number, color: number): E;
  clonar(estado: E): E;
}

// ---------------------------------------------------------------------------
// Colocar piezas (noche 14; src/core/colocar.js, ARQUITECTURA.md «Colocar piezas»)
// ---------------------------------------------------------------------------

/** Lo que un puzzle da para colocar piezas. */
export interface ColocarPiezas {
  /** Giros que generan el grupo (sus órbitas dicen dónde puede ir cada pieza y cómo). */
  generadores: Movimiento[];
  /** Nombre (plural, singular) del tipo de una pieza por sus pegatinas en el resuelto; null = el genérico. */
  nombreTipo?(pegatinas: number[]): [string, string] | null;
}

export interface PiezaColocar {
  id: number;
  tipo: number;
  /** Pegatinas de la pieza en el resuelto (su tupla, en un orden fijo). */
  pegatinas: number[];
  /** Valor del estado de cada pegatina (color o identidad). */
  valores: number[];
  /** Color (paleta) de cada pegatina. */
  colores: number[];
  /** Grupo de la bandeja (−1 si está en un bloque). */
  grupo: number;
  /** Bloque al que pertenece (−1 si es suelta). */
  bloque: number;
  /** «esquina blanco-verde-rojo». */
  nombre: string;
}

export interface TipoColocar {
  id: number;
  nombre: string;
  singular: string;
  piezas: number[];
  /** Piezas que no cambian de sitio (solo giran en él, o ni eso). */
  fija: boolean;
}

/** Piezas sueltas que se ven igual (mismo tipo y colores): una entrada de la bandeja. */
export interface GrupoColocar {
  id: number;
  tipo: number;
  piezas: number[];
  colores: number[];
  nombre: string;
}

export interface BloqueColocar {
  id: number;
  nombre: string;
  piezas: number[];
  /** Colocaciones rígidas posibles: tupla de cada pieza y su hueco. */
  colocaciones: Array<{ tuplas: number[][]; huecos: number[] }>;
}

export interface ModeloColocar {
  /** Pegatinas del estado. */
  n: number;
  piezas: PiezaColocar[];
  tipos: TipoColocar[];
  grupos: GrupoColocar[];
  bloques: BloqueColocar[];
  /** Hueco (= pieza de casa) de cada pegatina. */
  huecoDePegatina: Int16Array;
  opciones(pieza: number, hueco: number): number[][];
  pegatinasHueco(hueco: number): number[];
  tipoHueco(hueco: number): number;
  resuelto: EstadoPegatinas;
}

export interface ColocadaEnHueco {
  pieza: number;
  /** Posiciones de las pegatinas de la pieza (en el orden de su tupla). */
  tupla: number[];
  /** Bloque (o −1). */
  bloque: number;
}

export interface CandidatoHueco {
  grupo: number;
  disposiciones: number;
  restantes: number;
}

export interface SesionColocar {
  modelo: ModeloColocar;
  colocada(hueco: number): ColocadaEnHueco | null;
  candidatos(hueco: number): CandidatoHueco[];
  restantes(grupo: number): number;
  colocar(hueco: number, grupo: number): void;
  disposiciones(hueco: number): number;
  girar(hueco: number): boolean;
  colocarBloque(bloque: number, hueco: number): void;
  girarBloque(bloque: number): boolean;
  siguientePosicion(bloque: number): boolean;
  posicionesBloque(bloque: number): number;
  colocacionBloque(bloque: number): number;
  ponerColocacionBloque(bloque: number, colocacion: number): void;
  quitar(hueco: number): boolean;
  deshacer(): boolean;
  puedeDeshacer(): boolean;
  vaciar(): void;
  autoRellenar(): number[];
  faltan(): { piezas: number; bloques: number };
  completo(): boolean;
  /** Estado del puzzle (−1 en los huecos vacíos). */
  estado(): EstadoPegatinas;
  /** Colores para dibujar (−1 vacío). */
  colores(): number[];
  bloqueEnPosicion(): Int16Array;
}

// ---------------------------------------------------------------------------
// Registro y secciones (src/puzzles/index.js, src/app/secciones.js)
// ---------------------------------------------------------------------------

/** Sección de la app en la que aparece un puzzle del registro. */
export type Categoria = 'wca';

export type PuzzleRegistrado = Puzzle<unknown> & { categoria: Categoria };

/** Puzzle anunciado que aún no existe (el selector lo muestra bloqueado). */
export interface PuzzlePronto {
  id: string;
  nombre: string;
  categoria: Categoria;
}

export interface Seccion {
  id: string;
  nombre: string;
  descripcion: string;
  descripcionCorta?: string;
  estado: 'disponible' | 'bloqueada';
  estilo?: 'acento' | 'suave';
}

/** Ruta leída de la URL (`leerRuta`) y argumento de `hashDe`. */
export interface Ruta {
  seccion: string;
  puzzle?: string | null;
  /** "bloqueos=…" o "firma=…" (sin "?"), o "". */
  consulta?: string;
  ancla?: string;
  redirigir?: boolean;
  antigua?: boolean;
}

// ---------------------------------------------------------------------------
// Bloqueos (src/core/bloqueos.js; ARQUITECTURA.md, "Bloqueos")
// ---------------------------------------------------------------------------

/** Bloques definidos por el usuario: claves de pieza de cada bloque ([['UFR', 'UF'], …]). */
export type DefinicionBloqueos = string[][];

export interface EjemploBloqueos {
  id: string;
  nombre: string;
  bloques: DefinicionBloqueos;
}

export interface PiezaSoporte {
  clave: string;
  tipo: string;
  /** Puntos de la pieza resuelta (el primero, de referencia). */
  puntos: number[];
  cubie?: number[];
}

/** Mapa de puntos: mapa[p] = posición a la que va el punto en la posición p. */
export type MapaPuntos = Int16Array;

export type Identificacion = { donde: Int16Array; errores?: undefined } | { errores: string[]; donde?: undefined };

/** Lo que el puzzle da a la capa de bloqueos (`soporteBloqueos`). */
export interface SoporteBloqueos<E> {
  /** Número de puntos (los primeros `nPegatinas` son las pegatinas del estado). */
  puntos: number;
  nPegatinas: number;
  piezas: PiezaSoporte[];
  /** Giros de los scrambles y las búsquedas. */
  busqueda: Movimiento[];
  mapa(mov: Movimiento): MapaPuntos;
  /** enCapa[p] = 1 si la pieza en la posición p se mueve. */
  enCapa(mov: Movimiento): Uint8Array;
  /** Mapas de las rotaciones del puzzle entero (son libres). */
  rotaciones: MapaPuntos[];
  /** Regla de validación de los bloques (piezas vecinas). */
  adyacentes(a: number, b: number): boolean;
  identificar(estado: E): Identificacion;
  estadoDesde(donde: ArrayLike<number>): E;
  ejeDe?(familia: string): string | number;
  /** Polígonos de la red 2D (para dibujar unidas las piezas pegadas). */
  pegatinas2D?: Array<{ poligono: number[][] }>;
  busquedaRapida?(mod: ModeloBloqueos, S: Int16Array, opciones?: OpcionesBusquedaRapida): number[] | null;
  centrales?: Movimiento[];
  N?: number;
  /** (noche 13) Todos los giros con nombre, para traducir una solución a la orientación del usuario (si no, `busqueda`). */
  todos?: Movimiento[];
  /** (noche 13) Clases de piezas iguales (índices de pieza): se ven igual y se cuentan una vez. */
  iguales?: number[][];
  /** (noche 13) Reescribe una secuencia en la notación preferida (p. ej. 3Uw -> D + rotación en el 4x4). */
  notacion?(movs: Movimiento[]): Movimiento[];
}

export interface OpcionesBusquedaRapida {
  msMax?: number;
  maxLong?: number;
  objetivo?: number;
  ultima?: number;
}

/** Análisis de una configuración (`puzzleVendado.analisis()`). */
export interface InfoBloqueos {
  errores: string[];
  avisos: string[];
  bloques: number;
  legalesResuelto?: Movimiento[];
  bloqueado?: boolean;
  geometrias?: number;
  geometriasExacto?: boolean;
  diametroGeometria?: number;
  msGeometrias?: number;
  pasosScramble?: number;
  /** (noche 13) Mínimo de pasos del paseo de los scrambles (4x4, 5x5: 200; si no, 80). */
  pisoScramble?: number;
  /** Números grandes como texto (BigInt no pasa por JSON). */
  grupoFase2?: string;
  estados?: string;
  estadosExacto?: boolean;
  msGrupo?: number;
  msBFS?: number;
  diametro?: number;
  mbBFS?: number;
  espacio?: 'pequeño' | 'grande';
  msProyecciones?: number;
  tablasProyeccion?: number;
  msTotal?: number;
  msTablas?: number;
  sinBloques?: boolean;
  /**
   * (noche 13, puzzles con piezas iguales) Estados DISTINGUIBLES por colores: `estados` cuenta las
   * piezas iguales como distintas; este es estados / |K| (DECISIONES.md, noche 13).
   */
  estadosDistinguibles?: string;
  distinguiblesExacto?: boolean;
  /** |K|: reetiquetados de piezas iguales que dejan el resuelto alcanzable con el mismo aspecto. */
  simetriaIguales?: string;
  detalleDistinguibles?: string;
  /** (noche 13) Tablas de Minkwitz de la fase 2 (4x4, 5x5 en espacio grande). */
  msMinkwitz?: number;
  minkwitz?: { niveles: number; entradas: number; longitudMedia: number; completo: boolean; ms: number; pasos: number };
  /**
   * (Sesión «validador con muchas geometrías»; solo si el BFS de geometrías no cabe.) Cota superior
   * del grupo de la fase 2 (|R| · |H0|, ver cotaGrupoFase2), permutaciones de bloques realizables |R|,
   * lazos al azar añadidos y si el grupo encontrado llega a la cota (entonces es exacto).
   */
  cotaGrupoFase2?: string;
  permutacionesBloques?: number;
  lazosAlAzar?: number;
  grupoFase2Exacto?: boolean;
  msCota?: number;
  /** Pasos del paseo de la geometría en los scrambles de estado aleatorio de la fase 2 (si el BFS no cabe). */
  pasosGeometria?: number;
  /**
   * (Sesión «509 giros…».) Pasos de paseo perezoso que hacen falta para mezclar; si pasan de 10.000,
   * el scramble por defecto es práctico (100 giros al azar) y el mezclado se pide aparte, con su
   * longitud esperada (media de 3).
   */
  pasosMezcla?: number;
  scramblePractico?: boolean;
  /** Longitud por defecto del práctico (la WCA del tamaño) y las que ofrece la interfaz. */
  girosPractico?: number;
  longitudesPractico?: number[];
  /**
   * Calidad medida de cada longitud (sesión «longitud del práctico»): distancia de la forma al
   * resuelto frente a la distribución exacta; mezcla = 1 − TV, en %. Solo de las configuraciones medidas.
   */
  calidadPractico?: Record<string, { mezcla: number; distanciaMedia: number; distanciaExacta: number; hasta10: number; hasta10Exacta: number; muestras: number; longitudMedia?: number }>;
  longitudMezclado?: number;
  msLongitudMezclado?: number;
  /** Cómo se hacen los scrambles: 'bfs' (estado uniforme), 'paseo' (paseo fijo) o 'fase2' (estado aleatorio de la fase 2 + paseo). */
  tipoScramble?: 'bfs' | 'paseo' | 'fase2';
}

export interface DetalleEstrategias {
  A: { longitud: number; metodo: string; optima: boolean; ms?: number } | null;
  B: { longitud: number; fase1: number; fase2: number; metodo: string; ms?: number; movimientos: Movimiento[] } | null;
}

/** Lo que devuelve `puzzleConBloqueos`: un puzzle más, con lo propio de los bloqueos. */
export interface PuzzleVendado<E> extends Puzzle<E> {
  bloqueos: DefinicionBloqueos;
  claveBloqueos: string;
  analisis(): InfoBloqueos;
  movimientoLegal(estado: E, mov: Movimiento): { legal: true } | { legal: false; motivo: string };
  bloquesIntactos(estado: E): boolean;
  geometriaResuelta(estado: E): boolean;
  bloqueEnPosicion(estado: E): Int16Array;
  piezasDeBloques(estado?: E): Array<{ piezas: string[]; pegatinas: number[] }>;
  /** Solo si el puzzle de debajo tiene vista 3D (noche 13: antes estaba siempre). */
  vista3D?(estado: E, opciones?: { bloqueEnPosicion?: Int16Array }): Vista3D;
  erroresBloqueos: string[];
  avisosBloqueos: string[];
  modeloBloqueos: ModeloBloqueos;
  analisisInterno(): unknown;
}

// ---------------------------------------------------------------------------
// Mensajes entre la app y el Worker (src/app/servicio.js, worker.js, motor.js)
// ---------------------------------------------------------------------------

/** Lo que tienen en común las peticiones sobre un puzzle. El estado viaja con postMessage. */
interface PeticionPuzzle {
  puzzle: string;
  /** Con bloques, se usa la versión vendada de ese puzzle. */
  bloqueos?: DefinicionBloqueos | null;
}

export type Peticion =
  | { op: 'ping' }
  | (PeticionPuzzle & { op: 'inicializar' })
  | (PeticionPuzzle & { op: 'scramble'; opciones?: { modo?: 'practico' | 'mezclado'; giros?: number } })
  | (PeticionPuzzle & { op: 'validar'; estado: unknown; opciones?: OpcionesValidar })
  | (PeticionPuzzle & { op: 'resolver'; estado: unknown; opciones?: OpcionesResolver })
  | (PeticionPuzzle & { op: 'aprender'; estado: unknown; opciones?: { metodo?: string } });

export type Operacion = Peticion['op'];

/** Respuesta de cada operación (lo que devuelve `atender`). */
export interface RespuestasPorOperacion {
  ping: 'ok';
  inicializar: { ms: number; yaEstaba: boolean; analisis?: InfoBloqueos };
  scramble: { movimientos: Movimiento[]; ms: number };
  validar: Validacion;
  resolver: RespuestaResolver;
  aprender: ResultadoAprender & { ms: number };
}

export type Respuesta = RespuestasPorOperacion[Operacion];

/** `resolver` por el Worker: siempre con `movimientos`, `errores` y `fases` (vacíos o null si no hay). */
export type RespuestaResolver = Omit<ResolverOk, 'ok' | 'movimientos' | 'errores' | 'fases'> & {
  ok: boolean;
  movimientos: Movimiento[];
  errores: string[];
  fases: Fase[] | null;
};

/** El puzzle con el que trabaja el servicio: uno del registro o su versión vendada (con `analisis`). */
export type PuzzleServicio = Puzzle<unknown> & { analisis?(): InfoBloqueos };

/** Mensaje de la app al Worker: la petición con su identificador. */
export type MensajeAlWorker = Peticion & { id: number };

/** Mensaje del Worker a la app. */
export type MensajeDelWorker =
  | { id: number; ok: true; resultado: Respuesta; ms: number }
  | { id: number; ok: false; error: string };
