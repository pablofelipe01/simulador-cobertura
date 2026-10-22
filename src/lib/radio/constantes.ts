// Constantes del modelo de propagación y de la red Meshtastic (LoRa 915 MHz).
// El modelo fue calibrado contra simulaciones de Radio Mobile (error típico ≈ 5 dB).

/** Radio terrestre medio (m). */
export const RADIO_TIERRA_M = 6371008.8;
/** Radio terrestre efectivo con k = 4/3 (refracción estándar), en metros. */
export const RADIO_EFECTIVO_M = (4 / 3) * 6371000;
/** Velocidad de la luz en m/µs: λ(m) = C / f(MHz). */
export const VELOCIDAD_LUZ_M_US = 299.792458;

/**
 * Coeficientes de la pérdida adicional calibrada:
 *   extra = C0 + C1·log10(d_km) + C2·J(v) − C3·log10(h_tx / 10)
 * margen = presupuesto − FSPL − extra
 */
export const COEFICIENTES = [6.377481902942916, 3.2962400292439673, 1.8957881577652975, 5.68711874863032] as const;

/** Error típico del modelo frente a Radio Mobile (dB). */
export const ERROR_MODELO_DB = 5;

/** Distancia mínima usada en el cálculo (m), para evitar singularidades junto a la antena. */
export const DISTANCIA_MINIMA_M = 30;

/** Banda de uso libre reconocida por la ANE (Resolución 000028 de 2026). */
export const BANDA_LIBRE_MHZ = { min: 915, max: 928 } as const;

export type PresetId =
  | "SHORT_TURBO"
  | "SHORT_FAST"
  | "SHORT_SLOW"
  | "MEDIUM_FAST"
  | "MEDIUM_SLOW"
  | "LONG_FAST"
  | "LONG_MODERATE"
  | "LONG_SLOW";

export type Preset = {
  id: PresetId;
  nombre: string;
  sf: number;
  anchoBandaKhz: number;
  /** Sensibilidad del receptor (dBm) = −174 + 10·log10(BW) + NF(6 dB) + SNR límite. */
  sensibilidadDbm: number;
  /** Velocidad aproximada de datos (kbps) según la documentación de Meshtastic. */
  velocidadKbps: number;
  /** Tasa de código LoRa 4/cr (5 = 4/5, 8 = 4/8), como en el firmware de Meshtastic. */
  cr: number;
};

export const PRESETS: readonly Preset[] = [
  { id: "SHORT_TURBO", nombre: "Short Turbo", sf: 7, anchoBandaKhz: 500, sensibilidadDbm: -118.5, velocidadKbps: 21.88, cr: 5 },
  { id: "SHORT_FAST", nombre: "Short Fast", sf: 7, anchoBandaKhz: 250, sensibilidadDbm: -121.5, velocidadKbps: 10.94, cr: 5 },
  { id: "SHORT_SLOW", nombre: "Short Slow", sf: 8, anchoBandaKhz: 250, sensibilidadDbm: -124, velocidadKbps: 6.25, cr: 5 },
  { id: "MEDIUM_FAST", nombre: "Medium Fast", sf: 9, anchoBandaKhz: 250, sensibilidadDbm: -126.5, velocidadKbps: 3.52, cr: 5 },
  { id: "MEDIUM_SLOW", nombre: "Medium Slow", sf: 10, anchoBandaKhz: 250, sensibilidadDbm: -129, velocidadKbps: 1.95, cr: 5 },
  // Fórmula: −131,5 dBm; se usa −131 dBm, el mismo valor de las simulaciones de Radio Mobile que calibraron el modelo.
  { id: "LONG_FAST", nombre: "Long Fast", sf: 11, anchoBandaKhz: 250, sensibilidadDbm: -131, velocidadKbps: 1.07, cr: 5 },
  { id: "LONG_MODERATE", nombre: "Long Moderate", sf: 11, anchoBandaKhz: 125, sensibilidadDbm: -134.5, velocidadKbps: 0.34, cr: 8 },
  { id: "LONG_SLOW", nombre: "Long Slow", sf: 12, anchoBandaKhz: 125, sensibilidadDbm: -137, velocidadKbps: 0.18, cr: 8 },
];

export function presetPorId(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[5];
}

export type ClaseId = "buena" | "estable" | "media" | "baja" | "sin";

export type Clase = {
  id: ClaseId;
  nombre: string;
  /** Margen mínimo (dB sobre la sensibilidad) para pertenecer a la clase. */
  minimoDb: number;
  color: string;
  descripcion: string;
};

/** Clases de señal por margen sobre la sensibilidad, con la paleta de las simulaciones de Radio Mobile. */
export const CLASES: readonly Clase[] = [
  { id: "buena", nombre: "Buena", minimoDb: 45, color: "#1E7B34", descripcion: "Enlace muy holgado, tolera lluvia, follaje y movimiento." },
  { id: "estable", nombre: "Estable", minimoDb: 37, color: "#8BD17C", descripcion: "Servicio confiable para mensajes y telemetría." },
  { id: "media", nombre: "Media", minimoDb: 30, color: "#F5D33B", descripcion: "Funciona, con pérdidas ocasionales de paquetes." },
  { id: "baja", nombre: "Baja", minimoDb: 20, color: "#F08A2C", descripcion: "Intermitente; depende de la posición del equipo." },
  { id: "sin", nombre: "Sin servicio", minimoDb: -Infinity, color: "#D93A2E", descripcion: "Por debajo del margen mínimo de servicio." },
];

/** Margen mínimo para considerar que hay servicio (clase Baja o mejor). */
export const UMBRAL_SERVICIO_DB = 20;
/** Margen mínimo de servicio confiable (Estable o Buena). */
export const UMBRAL_CONFIABLE_DB = 37;
/** Cobertura útil: señal media o mejor (con lo que se planea la red). */
export const UMBRAL_UTIL_DB = 30;
/** Meta de cobertura útil del área de estudio para que la red sea factible (sin un área objetivo con su meta). */
export const META_UTIL_ESTUDIO_PCT = 60;

/** Clasificación de enlaces entre antenas (margen mínimo de ambos sentidos). */
export const ENLACES = {
  solido: { minimoDb: 30, nombre: "Enlace sólido", color: "#1E7B34" },
  inestable: { minimoDb: 20, nombre: "Enlace inestable", color: "#F08A2C" },
  sin: { minimoDb: -Infinity, nombre: "Sin enlace", color: "#D93A2E" },
} as const;

/** Límite de saltos por defecto de Meshtastic (hop_limit = 3; máximo 7). */
export const LIMITE_SALTOS_DEFECTO = 3;
export const LIMITE_SALTOS_MAXIMO = 7;

export type EquipoId = "nodo-solar-58" | "nodo-3dbi" | "portatil-2dbi" | "personalizado";

export const EQUIPOS: readonly { id: EquipoId; nombre: string; potenciaDbm: number; gananciaDbi: number; perdidaCableDb: number }[] = [
  { id: "nodo-solar-58", nombre: "Nodo solar + antena de fibra 5,8 dBi", potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1 },
  { id: "nodo-3dbi", nombre: "Nodo con antena de 3 dBi", potenciaDbm: 22, gananciaDbi: 3, perdidaCableDb: 1 },
  { id: "portatil-2dbi", nombre: "Radio portátil 2 dBi", potenciaDbm: 22, gananciaDbi: 2, perdidaCableDb: 0 },
  { id: "personalizado", nombre: "Personalizado", potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1 },
];

/** Resolución de la malla de cálculo (m por celda) según el radio de estudio. */
export const RESOLUCIONES = {
  rapida: { nombre: "Rápida", celdasPorRadio: 90 },
  normal: { nombre: "Normal", celdasPorRadio: 160 },
  fina: { nombre: "Fina", celdasPorRadio: 260 },
} as const;
export type ResolucionId = keyof typeof RESOLUCIONES;

/** Zoom de las teselas de elevación Terrarium (≈ 38 m por píxel en el ecuador). */
export const ZOOM_RELIEVE = 12;
