import type { ClaseId, EquipoId, PresetId, ResolucionId } from "./constantes";
import type { ClimaItm, SalidaItm } from "./itm";

/**
 * Rol MeshCore: solo los repetidores retransmiten. El companion es el nodo de una persona (la billetera) o la radio
 * del gateway conectada por USB al mini PC; el room server guarda mensajes y, por defecto, no retransmite.
 */
export type Rol = "REPETIDOR" | "COMPANION" | "ROOM_SERVER";

/**
 * Tipo de nodo: «antena» = nodo antena de infraestructura (mástil o torre, genera cobertura);
 * «nodo» = nodo de campo (radio portátil, sensor, rastreador): participa en la malla, sin capa de cobertura.
 */
export type TipoNodo = "antena" | "nodo";

export type Antena = {
  id: string;
  nombre: string;
  tipo: TipoNodo;
  lat: number;
  lon: number;
  /** Altura de la antena sobre el suelo (m). */
  alturaM: number;
  potenciaDbm: number;
  gananciaDbi: number;
  perdidaCableDb: number;
  equipo: EquipoId;
  rol: Rol;
  /** Pasarela (gateway): la radio conectada al mini PC con internet (Starlink) que recibe los pagos. */
  pasarela: boolean;
  /** Persona puesta con «Poblar personas» (prueba de densidad): no cuenta en los criterios de la infraestructura. */
  poblada?: boolean;
  /** Zona de popularidad: id del gateway o repetidor alrededor del cual se pobló esta persona. */
  zona?: string;
  activa: boolean;
  /** Tipo de antena (patrón de radiación). Sin valor = omnidireccional. */
  patron?: PatronId;
  /** Dirección a la que apunta una antena direccional (grados desde el norte, sentido horario). */
  azimutDeg?: number;
  /** Ángulo de elevación del haz (grados): 0 = horizontal, negativo = inclinada hacia abajo. */
  elevacionDeg?: number;
};

/** Patrón de radiación: omnidireccional o direccional (Yagi, panel, sectorial, parabólica). */
export type PatronId = "omni" | "yagi" | "panel" | "sectorial-90" | "sectorial-120" | "parabolica";

/** Modelo de propagación: el calibrado contra Radio Mobile (predeterminado) o Longley-Rice puro. */
export type ModeloId = "calibrado" | "itm";
export type PolarizacionId = "vertical" | "horizontal";
/** Tipo de suelo (constantes eléctricas), con las mismas opciones de Radio Mobile. */
export type SueloId = "promedio" | "pobre" | "bueno" | "agua-dulce" | "mar" | "personalizado";
/** Modo estadístico de Radio Mobile: puntual (spot), accidental, móvil o difusión (broadcast). */
export type VariabilidadId = "puntual" | "accidental" | "movil" | "difusion";
/** Entorno de la zona (vegetación o construcciones) que agrega pérdidas a los equipos bajos. */
export type EntornoId = "abierto" | "cultivos" | "plantacion" | "bosque" | "suburbano" | "urbano" | "urbano-denso";

export type Parametros = {
  preset: PresetId;
  frecuenciaMhz: number;
  /** Altura del receptor sobre el suelo (m): radio portátil, vehículo o sensor. */
  alturaRxM: number;
  gananciaRxDbi: number;
  /** Pérdida adicional en el receptor (vegetación, cuerpo, vehículo), en dB. */
  perdidaExtraDb: number;
  /** Radio de estudio alrededor de cada antena (km). */
  radioKm: number;
  resolucion: ResolucionId;
  limiteSaltos: number;
  /** Parámetros de red como en Radio Mobile (los valores por defecto son los de las pruebas de referencia). */
  modelo: ModeloId;
  polarizacion: PolarizacionId;
  clima: ClimaItm;
  /** Refractividad de la superficie (unidades N). */
  refractividad: number;
  suelo: SueloId;
  /** Permitividad relativa y conductividad (S/m) del suelo. */
  permitividad: number;
  conductividad: number;
  variabilidad: VariabilidadId;
  /** Confiabilidad estadística (%): tiempo, ubicaciones y situaciones. */
  tiempoPct: number;
  ubicacionesPct: number;
  situacionesPct: number;
  entorno: EntornoId;
};

export type TipoMedicion = "linea" | "trayecto" | "area";

/** Meta de un área objetivo: margen que debe tener cada punto (30 = señal media o mejor) y en qué % del área. */
export type ObjetivoArea = { metaPct: number; margenDb: number; respaldo?: boolean };

/** Medición de la regla: puntos [lon, lat] en WGS84. Un área puede ser el área objetivo de la red. */
export type Medicion = {
  id: string;
  nombre: string;
  tipo: TipoMedicion;
  puntos: [number, number][];
  visible: boolean;
  /** Área objetivo: la factibilidad mide la cobertura aquí y contra esta meta (una sola por escenario). */
  objetivo?: ObjetivoArea;
};

/** Área objetivo tal como la recibe el motor. */
export type AreaObjetivo = ObjetivoArea & { nombre: string; puntos: [number, number][] };

/** Cobertura dentro del área objetivo, por clase (% del área) y frente a su meta. */
export type CoberturaAreaObjetivo = ObjetivoArea & {
  nombre: string;
  areaKm2: number;
  utilPct: number;
  confiablePct: number;
  servicioPct: number;
  porClase: Record<ClaseId, number>;
  fueraKm2: number;
};

export type Escenario = {
  version: 1;
  nombre: string;
  antenas: Antena[];
  parametros: Parametros;
  mediciones: Medicion[];
};

export type FuenteRelieve =
  | { tipo: "teselas"; url: string }
  | { tipo: "hgt" }
  | { tipo: "plano" };

export type EstadoRelieve = {
  fuente: FuenteRelieve["tipo"];
  /** Teselas o celdas solicitadas y las que no se pudieron obtener. */
  solicitadas: number;
  fallidas: number;
  /** Resolución horizontal del relieve (m por píxel). */
  resolucionM: number;
  mensaje?: string;
};

export type Caja = { oeste: number; sur: number; este: number; norte: number };

/** Malla de cálculo en coordenadas Web Mercator (la fila 0 es el norte). */
export type MallaCalculo = {
  caja: Caja;
  ancho: number;
  alto: number;
  /** Tamaño aproximado de la celda sobre el terreno (m). */
  celdaM: number;
};

export type AreaPorClase = Record<ClaseId, number>;

export type ResumenAntena = {
  id: string;
  nombre: string;
  elevacionM: number;
  /** Área con servicio (margen ≥ 20 dB) en km². */
  areaServicioKm2: number;
  areaConfiableKm2: number;
  /** Distancia máxima con servicio y con servicio confiable (km). */
  alcanceKm: number;
  alcanceConfiableKm: number;
  /** El alcance llega al borde del radio de estudio (podría ser mayor). */
  alcanceLimitado: boolean;
  /** % del círculo de estudio de la antena con servicio. */
  porcentajeCirculo: number;
  /** % del área de estudio donde esta antena es la mejor. */
  porcentajeMejorServidor: number;
  /** Presupuesto de enlace hacia el receptor configurado (dB) y potencia radiada (dBm). */
  presupuestoDb: number;
  pireDbm: number;
  /** Alcance con servicio y confiable por dirección (km), en 72 sectores de 5° desde el norte. */
  alcancePorRumbo: number[];
  alcanceConfiablePorRumbo: number[];
};

export type ClaseEnlace = "solido" | "inestable" | "sin";

export type Enlace = {
  a: string;
  b: string;
  distanciaKm: number;
  /** Margen de cada sentido y el mínimo (dB). */
  margenAB: number;
  margenBA: number;
  margen: number;
  clase: ClaseEnlace;
  /** Parámetro de difracción del obstáculo principal y si hay línea de vista despejada (60 % de Fresnel). */
  vMax: number;
  lineaVista: boolean;
};

export type NodoMalla = {
  id: string;
  /** Saltos desde la pasarela más cercana (null si no alcanza ninguna). */
  saltos: number | null;
  vecinos: number;
  componente: number;
  /** Punto único de falla: si se apaga, otros nodos pierden la pasarela. */
  critico: boolean;
  /** Margen del enlace más débil de la ruta más robusta hacia la pasarela, dentro del límite de saltos. */
  cuelloDb: number | null;
  /** Ruta más robusta (ids desde el nodo hasta la pasarela). */
  ruta: string[];
};

export type Nivel = "factible" | "ajustes" | "no-factible";

export type Factibilidad = {
  nivel: Nivel;
  titulo: string;
  puntaje: number;
  criterios: { nombre: string; ok: boolean; detalle: string }[];
  recomendaciones: string[];
};

export type ResultadoSimulacion = {
  id: number;
  malla: MallaCalculo;
  /** Mejor y segundo mejor margen por celda (NaN fuera del área de estudio). */
  mejor: Float32Array;
  segundo: Float32Array;
  /** Índice de la antena con mejor margen (−1 fuera del área). */
  servidor: Int16Array;
  /** Número de antenas con margen ≥ 20 dB en cada celda. */
  servidores: Uint8Array;
  /** Margen redondeado de cada antena por celda (−128 = fuera de su radio); índice = antena·total + celda. */
  porAntena: Int8Array;
  antenas: ResumenAntena[];
  areaEstudioKm2: number;
  /** Área por clase (km²) usando la mejor antena. */
  areaPorClase: AreaPorClase;
  porcentajeServicio: number;
  porcentajeConfiable: number;
  /** % del área de estudio con señal media o mejor (≥ 30 dB): la cobertura útil. */
  porcentajeUtil: number;
  /** % del área con al menos dos antenas confiables (respaldo). */
  porcentajeRespaldo: number;
  /** Cobertura dentro del área objetivo (si el escenario tiene una). */
  areaObjetivo?: CoberturaAreaObjetivo | null;
  enlaces: Enlace[];
  nodos: NodoMalla[];
  factibilidad: Factibilidad;
  relieve: EstadoRelieve;
  presupuestoDb: number;
  /** Datos del receptor para convertir el margen a otras unidades (dBm, µV, dBµV/m). */
  sensibilidadDbm: number;
  gananciaRxDbi: number;
  frecuenciaMhz: number;
  duracionMs: number;
};

export type PuntoPerfil = { distanciaM: number; terrenoM: number };

/** Perfil del terreno a lo largo de una medición (sin cálculo de radio). */
export type PerfilTerreno = {
  distanciaM: number;
  puntos: PuntoPerfil[];
  /** Distancias acumuladas de los vértices de la ruta (m). */
  vertices: number[];
  minimoM: number;
  maximoM: number;
  subidaM: number;
  bajadaM: number;
  fuente: FuenteRelieve["tipo"];
};

export type Perfil = {
  distanciaM: number;
  puntos: PuntoPerfil[];
  alturaInicioM: number;
  alturaFinM: number;
  /** Radio de la primera zona de Fresnel en el punto medio (m). */
  fresnelMedioM: number;
  vMax: number;
  /** Distancia del obstáculo principal (m), si existe. */
  obstaculoM: number | null;
  perdidaEspacioLibreDb: number;
  perdidaDifraccionDb: number;
  margenDb: number;
  clase: ClaseId;
  lineaVista: boolean;
  /** Informe de radioenlace completo (como «Radio Link» de Radio Mobile). */
  informe?: InformeEnlace;
};

/** Informe de radioenlace: geometría, potencias, pérdidas desglosadas y nivel recibido. */
export type InformeEnlace = {
  origen: string;
  destino: string;
  /** El destino es otro nodo (true) o un receptor genérico en un punto (false). */
  entreNodos: boolean;
  modelo: ModeloId;
  frecuenciaMhz: number;
  // Geometría
  distanciaKm: number;
  rumboIdaDeg: number;
  rumboVueltaDeg: number;
  elevacionIdaDeg: number;
  elevacionVueltaDeg: number;
  sueloOrigenM: number;
  sueloDestinoM: number;
  alturaOrigenM: number;
  alturaDestinoM: number;
  /** Peor despeje de la primera zona de Fresnel (múltiplos de F1; negativo = obstruido) y dónde ocurre. */
  peorFresnel: number;
  peorFresnelKm: number;
  lineaVista: boolean;
  // Potencias y antenas
  potenciaTxDbm: number;
  perdidaCableTxDb: number;
  gananciaTxDbi: number;
  patronTxDb: number;
  pireDbm: number;
  gananciaRxDbi: number;
  patronRxDb: number;
  perdidaCableRxDb: number;
  perdidaExtraRxDb: number;
  // Pérdidas del trayecto
  espacioLibreDb: number;
  obstruccionDb: number;
  estadisticaDb: number;
  ajusteRedDb: number;
  entornoDb: number;
  perdidaTotalDb: number;
  /** Predicción Longley-Rice con los parámetros de la red (referencia, siempre calculada). */
  itm: Pick<SalidaItm, "perdidaDb" | "referenciaDb" | "modo" | "aviso">;
  // Recepción
  nivelDbm: number;
  sensibilidadDbm: number;
  margenDb: number;
  clase: ClaseId;
  /** Resumen legible de los parámetros de red usados. */
  parametrosTexto: string;
};
