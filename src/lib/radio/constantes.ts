// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Constantes del modelo de propagación y de la red MeshCore de Trama (LoRa 915–928 MHz).
// El modelo fue calibrado contra simulaciones de Radio Mobile (error típico ≈ 5 dB).
// Los textos visibles (nombres y descripciones) son getters: salen en el idioma de la pantalla al leerlos.
import { tx } from "../idioma";

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

/** Protocolo de la malla: MeshCore (solo los repetidores retransmiten) o Meshtastic (todos, salvo los mudos). */
export type ProtocoloId = "meshcore" | "meshtastic";

/**
 * Ajustes de radio (ancho de banda, factor de dispersión y tasa de código). MeshCore: los de 250 kHz son los de Trama
 * (SF11 para alcance; SF10 y SF9 para capacidad); los de 62,5 kHz, los de la comunidad MeshCore (para América el
 * proyecto recomienda SF7 · 62,5 kHz en 910,525 MHz). Meshtastic: sus «presets» de módem (LongFast por defecto).
 */
export type PresetId =
  | "SF11_250"
  | "SF10_250"
  | "SF9_250"
  | "SF7_62"
  | "SF8_62"
  | "SF9_62"
  | "SF10_62"
  | "MT_SHORT_FAST"
  | "MT_MEDIUM_FAST"
  | "MT_MEDIUM_SLOW"
  | "MT_LONG_FAST"
  | "MT_LONG_MODERATE"
  | "MT_LONG_SLOW";

export type Preset = {
  id: PresetId;
  nombre: string;
  /** Protocolo al que pertenece el ajuste (todos los nodos de una red usan el mismo protocolo y el mismo ajuste). */
  protocolo: ProtocoloId;
  sf: number;
  anchoBandaKhz: number;
  /** Sensibilidad del receptor (dBm) = −174 + 10·log10(BW) + NF(6 dB) + SNR límite. */
  sensibilidadDbm: number;
  /** Velocidad de datos LoRa (kbps) = SF · BW / 2^SF · 4 / CR. */
  velocidadKbps: number;
  /** Tasa de código LoRa 4/cr (5 = 4/5, 8 = 4/8). */
  cr: number;
  /** Símbolos de preámbulo (Meshtastic: 16 por debajo de 1 GHz; MeshCore: 32 con SF ≤ 8 y 16 con SF ≥ 9). */
  preambulo?: number;
  /** Para qué sirve, en una línea. */
  uso: string;
};

const velocidad = (sf: number, bw: number, cr: number) => Math.round(((sf * bw) / 2 ** sf) * (4 / cr) * 1000) / 1000;
const sensibilidad = (sf: number, bw: number) => Math.round((-174 + 10 * Math.log10(bw * 1000) + 6 - 2.5 * (sf - 4)) * 10) / 10;
/** Un texto en español y en inglés. */
type Texto = readonly [es: string, en: string];
const preset = (id: PresetId, nombre: Texto, sf: number, bw: number, uso: Texto, s = sensibilidad(sf, bw)): Preset => ({
  id,
  get nombre() {
    return tx(nombre[0], nombre[1]);
  },
  protocolo: "meshcore",
  sf,
  anchoBandaKhz: bw,
  sensibilidadDbm: s,
  velocidadKbps: velocidad(sf, bw, 5),
  cr: 5,
  get uso() {
    return tx(uso[0], uso[1]);
  },
});
/** Preset de Meshtastic (firmware: módem por nombre, preámbulo de 16 símbolos). */
const presetMt = (id: PresetId, nombre: Texto, sf: number, bw: number, cr: number, uso: Texto, s = sensibilidad(sf, bw)): Preset => ({
  id,
  get nombre() {
    return tx(nombre[0], nombre[1]);
  },
  protocolo: "meshtastic",
  sf,
  anchoBandaKhz: bw,
  sensibilidadDbm: s,
  velocidadKbps: velocidad(sf, bw, cr),
  cr,
  preambulo: 16,
  get uso() {
    return tx(uso[0], uso[1]);
  },
});

export const PRESETS: readonly Preset[] = [
  // SF11 / 250 kHz da −131,5 dBm por fórmula; se usa −131 dBm, el mismo valor de las simulaciones de Radio Mobile
  // que calibraron el modelo (mismos ajustes de radio).
  preset("SF11_250", ["Trama SF11 · 250 kHz (alcance)", "Trama SF11 · 250 kHz (range)"], 11, 250, ["El de Trama: 150 usuarios por frecuencia y unos 10 km por repetidor en plano.", "Trama's setting: 150 users per frequency and about 10 km per repeater on flat terrain."], -131),
  preset("SF10_250", ["Trama SF10 · 250 kHz", "Trama SF10 · 250 kHz"], 10, 250, ["280 usuarios por frecuencia; el alcance baja a ~80 %.", "280 users per frequency; range drops to ~80%."]) ,
  preset("SF9_250", ["Trama SF9 · 250 kHz (capacidad)", "Trama SF9 · 250 kHz (capacity)"], 9, 250, ["500 usuarios por frecuencia; el alcance baja a ~65 %.", "500 users per frequency; range drops to ~65%."]),
  preset("SF7_62", ["MeshCore SF7 · 62,5 kHz", "MeshCore SF7 · 62.5 kHz"], 7, 62.5, ["El recomendado en EE. UU. (allá en 910,525 MHz): rápido, menos alcance.", "The one recommended in the US (on 910.525 MHz there): fast, less range."]),
  preset("SF8_62", ["MeshCore SF8 · 62,5 kHz", "MeshCore SF8 · 62.5 kHz"], 8, 62.5, ["Rápido y un poco más de alcance.", "Fast, with a little more range."]),
  preset("SF9_62", ["MeshCore SF9 · 62,5 kHz", "MeshCore SF9 · 62.5 kHz"], 9, 62.5, ["El equilibrado de la comunidad MeshCore: buen alcance, canal angosto.", "The MeshCore community's balanced setting: good range, narrow channel."]),
  preset("SF10_62", ["MeshCore SF10 · 62,5 kHz", "MeshCore SF10 · 62.5 kHz"], 10, 62.5, ["Más alcance; cada paquete ocupa el aire mucho más tiempo.", "More range; each packet stays on the air much longer."]),
  // Meshtastic: LongFast es el de fábrica (SF11 · 250 kHz, el mismo aire que el SF11 de Trama)
  presetMt("MT_LONG_FAST", ["Meshtastic LongFast", "Meshtastic LongFast"], 11, 250, 5, ["El de fábrica de Meshtastic: buen alcance, ~1,07 kbps.", "Meshtastic's default: good range, ~1.07 kbps."], -131),
  presetMt("MT_LONG_MODERATE", ["Meshtastic LongModerate", "Meshtastic LongModerate"], 11, 125, 8, ["Más alcance que LongFast; cada mensaje dura casi tres veces más en el aire.", "More range than LongFast; each message lasts almost three times longer on the air."]),
  presetMt("MT_LONG_SLOW", ["Meshtastic LongSlow", "Meshtastic LongSlow"], 12, 125, 8, ["El de más alcance y el más lento: pocas personas por canal.", "The longest range and the slowest: few people per channel."]),
  presetMt("MT_MEDIUM_SLOW", ["Meshtastic MediumSlow", "Meshtastic MediumSlow"], 10, 250, 5, ["Un paso más rápido que LongFast, con algo menos de alcance.", "One step faster than LongFast, with somewhat less range."]),
  presetMt("MT_MEDIUM_FAST", ["Meshtastic MediumFast", "Meshtastic MediumFast"], 9, 250, 5, ["Más capacidad: ~3,5 kbps; el alcance baja a ~65 %.", "More capacity: ~3.5 kbps; range drops to ~65%."]),
  presetMt("MT_SHORT_FAST", ["Meshtastic ShortFast", "Meshtastic ShortFast"], 7, 250, 5, ["Para redes densas y cortas: ~11 kbps, poco alcance.", "For dense, short-range networks: ~11 kbps, little range."]),
];

export function presetPorId(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** Ajustes de radio de un protocolo. */
export function presetsDe(protocolo: ProtocoloId): Preset[] {
  return PRESETS.filter((p) => p.protocolo === protocolo);
}

/** Ajuste de fábrica de cada protocolo: el SF11 de Trama en MeshCore y LongFast en Meshtastic. */
export const PRESET_DEFECTO: Record<ProtocoloId, PresetId> = { meshcore: "SF11_250", meshtastic: "MT_LONG_FAST" };

/** El ajuste equivalente en el otro protocolo (mismo SF y ancho de banda si existe; si no, el de fábrica). */
export function presetEquivalente(id: PresetId, protocolo: ProtocoloId): PresetId {
  const p = presetPorId(id);
  if (p.protocolo === protocolo) return id;
  return presetsDe(protocolo).find((x) => x.sf === p.sf && x.anchoBandaKhz === p.anchoBandaKhz)?.id ?? PRESET_DEFECTO[protocolo];
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
  {
    id: "buena",
    get nombre() {
      return tx("Buena", "Good");
    },
    minimoDb: 45,
    color: "#1E7B34",
    get descripcion() {
      return tx("Enlace muy holgado, tolera lluvia, follaje y movimiento.", "Very comfortable link; tolerates rain, foliage and movement.");
    },
  },
  {
    id: "estable",
    get nombre() {
      return tx("Estable", "Stable");
    },
    minimoDb: 37,
    color: "#8BD17C",
    get descripcion() {
      return tx("Servicio confiable para mensajes y telemetría.", "Reliable service for messages and telemetry.");
    },
  },
  {
    id: "media",
    get nombre() {
      return tx("Media", "Fair");
    },
    minimoDb: 30,
    color: "#F5D33B",
    get descripcion() {
      return tx("Funciona, con pérdidas ocasionales de paquetes.", "Works, with occasional packet loss.");
    },
  },
  {
    id: "baja",
    get nombre() {
      return tx("Baja", "Weak");
    },
    minimoDb: 20,
    color: "#F08A2C",
    get descripcion() {
      return tx("Intermitente; depende de la posición del equipo.", "Intermittent; depends on where the device is.");
    },
  },
  {
    id: "sin",
    get nombre() {
      return tx("Sin servicio", "No service");
    },
    minimoDb: -Infinity,
    color: "#D93A2E",
    get descripcion() {
      return tx("Por debajo del margen mínimo de servicio.", "Below the minimum service margin.");
    },
  },
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
  solido: {
    minimoDb: 30,
    get nombre() {
      return tx("Enlace sólido", "Solid link");
    },
    color: "#1E7B34",
  },
  inestable: {
    minimoDb: 20,
    get nombre() {
      return tx("Enlace inestable", "Unstable link");
    },
    color: "#F08A2C",
  },
  sin: {
    minimoDb: -Infinity,
    get nombre() {
      return tx("Sin enlace", "No link");
    },
    color: "#D93A2E",
  },
} as const;

/**
 * Saltos máximos de diseño (enlaces desde el nodo hasta el gateway). MeshCore admite hasta 64 (flood.max), pero
 * Trama diseña con «uno o dos saltos» de repetidores para que el pago o el mensaje vuelva en segundos.
 */
export const LIMITE_SALTOS_DEFECTO = 3;
export const LIMITE_SALTOS_MAXIMO = 64;

export type EquipoId = "p1-8dbi" | "t114-8dbi" | "xiao" | "t1000" | "personalizado";

/**
 * Equipos de Trama (catálogo del cotizador). La pérdida de 1,2 dB es la del cable CFD400 de 3 m, el CFD200 de 1 m y
 * los conectores. La ganancia de los nodos de las personas es una estimación (antena pequeña o interna).
 */
export const EQUIPOS: readonly { id: EquipoId; nombre: string; potenciaDbm: number; gananciaDbi: number; perdidaCableDb: number }[] = [
  {
    id: "p1-8dbi",
    get nombre() {
      return tx("Repetidor SenseCAP Solar P1 + antena 8 dBi", "SenseCAP Solar P1 repeater + 8 dBi antenna");
    },
    potenciaDbm: 22,
    gananciaDbi: 8,
    perdidaCableDb: 1.2,
  },
  {
    id: "t114-8dbi",
    get nombre() {
      return tx("Radio del gateway Heltec T114 + antena 8 dBi", "Heltec T114 gateway radio + 8 dBi antenna");
    },
    potenciaDbm: 22,
    gananciaDbi: 8,
    perdidaCableDb: 1.2,
  },
  {
    id: "xiao",
    get nombre() {
      return tx("Billetera XIAO ESP32S3 + Wio-SX1262", "XIAO ESP32S3 + Wio-SX1262 wallet");
    },
    potenciaDbm: 22,
    gananciaDbi: 2,
    perdidaCableDb: 0,
  },
  {
    id: "t1000",
    get nombre() {
      return tx("Tarjeta SenseCAP T1000-E", "SenseCAP T1000-E card");
    },
    potenciaDbm: 22,
    gananciaDbi: 0,
    perdidaCableDb: 0,
  },
  {
    id: "personalizado",
    get nombre() {
      return tx("Personalizado", "Custom");
    },
    potenciaDbm: 22,
    gananciaDbi: 5.8,
    perdidaCableDb: 1,
  },
];

/** Resolución de la malla de cálculo (m por celda) según el radio de estudio. */
export const RESOLUCIONES = {
  rapida: {
    get nombre() {
      return tx("Rápida", "Fast");
    },
    celdasPorRadio: 90,
  },
  normal: {
    get nombre() {
      return tx("Normal", "Normal");
    },
    celdasPorRadio: 160,
  },
  fina: {
    get nombre() {
      return tx("Fina", "Fine");
    },
    celdasPorRadio: 260,
  },
} as const;
export type ResolucionId = keyof typeof RESOLUCIONES;

/** Zoom de las teselas de elevación Terrarium (≈ 38 m por píxel en el ecuador). */
export const ZOOM_RELIEVE = 12;
