// Cómo viaja un mensaje por la malla Meshtastic: tiempo en el aire de cada paquete LoRa (fórmula de Semtech),
// espera antes de retransmitir (ventana de contención del firmware, ponderada por la SNR), límite de saltos
// y probabilidad de entrega según el margen de cada enlace. Son estimaciones para planear, no mediciones.
import { presetPorId, type Preset } from "./constantes";
import type { Antena, Enlace, Parametros } from "./tipos";

/** Preámbulo de Meshtastic (símbolos). */
export const PREAMBULO_SIMBOLOS = 16;
/** Cabecera del paquete Meshtastic (bytes) y sobrecosto típico del mensaje de texto (protobuf). */
const CABECERA_BYTES = 16;
const SOBRECOSTO_TEXTO_BYTES = 6;
/** Ventana de contención del firmware: 2^CW ranuras, CW entre CW_MIN y CW_MAX según la SNR. */
const CW_MIN = 3;
const CW_MAX = 8;
const SNR_MIN = -20;
const SNR_MAX = 10;
/** Propagación + cambio de recepción a transmisión + capa MAC (ms), como en el firmware. */
const TIEMPO_MAC_MS = 0.2 + 0.4 + 7;

/** SNR mínima demodulable por factor de dispersión (dB). */
export function snrLimite(sf: number): number {
  return -2.5 * (sf - 4);
}

/** Duración de un símbolo LoRa (ms). */
export function simboloMs(preset: Preset): number {
  return 2 ** preset.sf / preset.anchoBandaKhz;
}

/** Tiempo en el aire de un paquete LoRa de `bytes` (ms), con cabecera explícita y CRC (Semtech AN1200.13). */
export function tiempoEnAireMs(bytes: number, preset: Preset): number {
  const ts = simboloMs(preset);
  const de = ts > 16 ? 1 : 0; // optimización para tasas bajas (símbolos de más de 16 ms)
  const preambulo = (PREAMBULO_SIMBOLOS + 4.25) * ts;
  const numerador = 8 * bytes - 4 * preset.sf + 28 + 16;
  const simbolosCarga = 8 + Math.max(Math.ceil(numerador / (4 * (preset.sf - 2 * de))) * preset.cr, 0);
  return preambulo + simbolosCarga * ts;
}

/** Bytes en el aire de un mensaje de texto de `caracteres`. */
export function bytesMensaje(caracteres: number): number {
  return CABECERA_BYTES + SOBRECOSTO_TEXTO_BYTES + Math.max(0, Math.round(caracteres));
}

/** Ranura de la ventana de contención (ms). */
export function ranuraMs(preset: Preset): number {
  return 2.5 * simboloMs(preset) + TIEMPO_MAC_MS;
}

/** Tamaño de la ventana de contención según la SNR recibida: más SNR = espera más (el más lejano retransmite primero). */
export function ventanaContencion(snr: number): number {
  const t = Math.min(1, Math.max(0, (snr - SNR_MIN) / (SNR_MAX - SNR_MIN)));
  return Math.round(CW_MIN + t * (CW_MAX - CW_MIN));
}

/** Espera antes de retransmitir (ms): los ROUTER tienen prioridad; los demás esperan además 2·CW_MAX ranuras. */
export function esperaRetransmision(snr: number, rol: Antena["rol"], preset: Preset): { min: number; max: number; tipica: number } {
  const ranura = ranuraMs(preset);
  const cw = ventanaContencion(snr);
  if (rol === "ROUTER") {
    const max = 2 * cw * ranura;
    return { min: 0, max, tipica: max / 2 };
  }
  const base = 2 * CW_MAX * ranura;
  const max = base + 2 ** cw * ranura;
  return { min: base, max, tipica: (base + max) / 2 };
}

/** Probabilidad aproximada de que un paquete pase un enlace con ese margen (curva logística: 20 dB ≈ 70 %, 30 dB ≈ 98 %). */
export function probabilidadEnlace(margenDb: number): number {
  if (!Number.isFinite(margenDb)) return 0;
  return 1 / (1 + Math.exp(-(margenDb - 17) / 3.5));
}

export type Tramo = {
  de: string;
  a: string;
  margenDb: number;
  snrDb: number;
  distanciaKm: number;
  aireMs: number;
  /** Espera del nodo `de` antes de retransmitir (0 en el remitente). */
  espera: { min: number; max: number; tipica: number };
  probabilidad: number;
};

export type ViajeMensaje = {
  llega: boolean;
  motivo: string | null;
  /** Ruta desde el remitente hasta el gateway (ids). */
  ruta: string[];
  saltos: number;
  limiteSaltos: number;
  tramos: Tramo[];
  bytes: number;
  aireMs: number;
  totalMs: { min: number; tipica: number; max: number };
  /** Probabilidad de entrega en un intento y con hasta 3 intentos del remitente. */
  probabilidad: number;
  probabilidadReintentos: number;
  preset: string;
};

const clave = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

/**
 * Simula el envío de un mensaje desde `origen` hasta el gateway por la ruta `ruta` (ids desde el origen
 * hasta la pasarela, como la entrega el análisis de la malla).
 */
export function simularMensaje(ruta: string[], antenas: Antena[], enlaces: Enlace[], p: Parametros, caracteres = 40): ViajeMensaje {
  const preset = presetPorId(p.preset);
  const bytes = bytesMensaje(caracteres);
  const aire = tiempoEnAireMs(bytes, preset);
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const porPar = new Map(enlaces.map((e) => [clave(e.a, e.b), e]));
  const base = { ruta, limiteSaltos: p.limiteSaltos, bytes, aireMs: aire, preset: preset.nombre };
  if (ruta.length < 2) {
    return { ...base, llega: false, motivo: ruta.length === 1 && porId.get(ruta[0])?.pasarela ? "Ya está en el gateway." : "No tiene ruta hacia el gateway.", saltos: 0, tramos: [], totalMs: { min: 0, tipica: 0, max: 0 }, probabilidad: 0, probabilidadReintentos: 0 };
  }
  const tramos: Tramo[] = [];
  for (let i = 0; i + 1 < ruta.length; i++) {
    const de = ruta[i];
    const a = ruta[i + 1];
    const e = porPar.get(clave(de, a));
    const margen = e ? (e.a === de ? e.margenAB : e.margenBA) : -Infinity;
    const snr = margen + snrLimite(preset.sf);
    // Quien recibió en el tramo anterior espera su turno antes de retransmitir; el remitente sale de una vez
    const anterior = tramos[i - 1];
    const espera = i === 0 ? { min: 0, max: 0, tipica: 0 } : esperaRetransmision(anterior.snrDb, porId.get(de)?.rol ?? "CLIENT", preset);
    tramos.push({ de, a, margenDb: margen, snrDb: snr, distanciaKm: e?.distanciaKm ?? 0, aireMs: aire, espera, probabilidad: probabilidadEnlace(margen) });
  }
  const saltos = tramos.length;
  const suma = (f: (t: Tramo) => number) => tramos.reduce((s, t) => s + f(t), 0);
  const totalMs = { min: suma((t) => t.aireMs + t.espera.min), tipica: suma((t) => t.aireMs + t.espera.tipica), max: suma((t) => t.aireMs + t.espera.max) };
  const probabilidad = tramos.reduce((s, t) => s * t.probabilidad, 1);
  const sinEnlace = tramos.find((t) => t.margenDb < 20);
  let motivo: string | null = null;
  if (saltos > p.limiteSaltos) motivo = `Necesita ${saltos} saltos y el límite es ${p.limiteSaltos}: el paquete se descarta en el salto ${p.limiteSaltos}.`;
  else if (sinEnlace) motivo = `El tramo ${porId.get(sinEnlace.de)?.nombre ?? "?"} → ${porId.get(sinEnlace.a)?.nombre ?? "?"} no tiene enlace (${sinEnlace.margenDb.toFixed(1).replace(".", ",")} dB; se necesitan 20 dB).`;
  return {
    ...base,
    llega: motivo === null,
    motivo,
    saltos,
    tramos,
    totalMs,
    probabilidad: motivo ? 0 : probabilidad,
    probabilidadReintentos: motivo ? 0 : 1 - (1 - probabilidad) ** 3,
  };
}
