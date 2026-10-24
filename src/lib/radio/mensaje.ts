// Cómo viaja un paquete por la malla MeshCore de Trama: tiempo en el aire LoRa (fórmula de Semtech con el preámbulo
// de MeshCore), espera de cada repetidor antes de retransmitir (txdelay del firmware), ruta directa aprendida o
// inundación, acuses y reintentos, y la probabilidad de entrega según el margen de cada enlace. Los valores salen del
// código del firmware MeshCore (Dispatcher, Mesh, simple_repeater, companion_radio) y del documento de Trama.
import { presetPorId, type Preset } from "./constantes";
import type { Antena, Enlace, Parametros } from "./tipos";

/** Preámbulo de MeshCore: 32 símbolos con SF ≤ 8 y 16 con SF ≥ 9 (RadioLibWrapper::preambleLengthForSF). */
export function preambuloSimbolos(sf: number): number {
  return sf <= 8 ? 32 : 16;
}

/** Tamaños de los paquetes MeshCore (bytes en el aire). */
export const PAQUETE = {
  /** Cabecera + largo de la ruta. */
  cabecera: 2,
  /** Texto o datos cifrados: destino, origen, MAC, marca de tiempo y tipo (9 bytes). */
  sobrecostoDatos: 9,
  /** Acuse (CRC de 4 bytes). */
  acuse: 4,
  /** Carga máxima del paquete. */
  cargaMaxima: 184,
} as const;

/** Espera antes de retransmitir, en múltiplos del tiempo en el aire del paquete: aleatoria entre 0 y 5 × factor. */
export const RETARDO = {
  /** txdelay del repetidor para paquetes inundados (0,5 por defecto). */
  inundacion: 0.5,
  /** direct.txdelay del repetidor para paquetes con ruta (0,3 por defecto). */
  directa: 0.3,
} as const;

/** Reintentos del remitente: 3 por la ruta guardada y, el último, por inundación (app MeshCore). */
export const INTENTOS = 4;

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
  const preambulo = (preambuloSimbolos(preset.sf) + 4.25) * ts;
  const numerador = 8 * bytes - 4 * preset.sf + 28 + 16;
  const simbolosCarga = 8 + Math.max(Math.ceil(numerador / (4 * (preset.sf - 2 * de))) * preset.cr, 0);
  return preambulo + simbolosCarga * ts;
}

/** Bytes en el aire de un mensaje de datos de `carga` bytes que todavía debe pasar por `ruta` repetidores. */
export function bytesDatos(carga: number, ruta = 0): number {
  return PAQUETE.cabecera + ruta + PAQUETE.sobrecostoDatos + Math.max(0, Math.round(carga));
}

/** Bytes en el aire de un mensaje de texto de `caracteres` (directo, sin ruta pendiente). */
export function bytesMensaje(caracteres: number, ruta = 0): number {
  return bytesDatos(caracteres, ruta);
}

/** Bytes de un acuse. */
export function bytesAcuse(ruta = 0): number {
  return PAQUETE.cabecera + ruta + PAQUETE.acuse;
}

/** Espera de un repetidor antes de retransmitir (ms): entre 0 y 5 × factor × tiempo en el aire. */
export function esperaRetransmision(aireMs: number, modo: "directa" | "inundacion"): { min: number; max: number; tipica: number } {
  const max = 5 * RETARDO[modo] * aireMs;
  return { min: 0, max, tipica: max / 2 };
}

/** Tiempo que espera el remitente el acuse antes de reintentar (ms), como en la app companion de MeshCore. */
export function esperaAcuseMs(aireMs: number, saltos: number, modo: "directa" | "inundacion"): number {
  return modo === "inundacion" ? 500 + 16 * aireMs : 500 + (aireMs * 6 + 250) * (saltos + 1);
}

/** Probabilidad aproximada de que un paquete pase un enlace con ese margen (curva logística: 20 dB ≈ 70 %, 30 dB ≈ 98 %). */
export function probabilidadEnlace(margenDb: number): number {
  if (!Number.isFinite(margenDb)) return 0;
  return 1 / (1 + Math.exp(-(margenDb - 17) / 3.5));
}

/**
 * Tiempo en el aire de un pago de Trama: la orden firmada (118 B) sube, el comprobante (126 B) baja y quien recibe
 * el pago recibe su aviso (126 B), cada uno con su acuse, por `saltos` enlaces. Con SF11 / 250 kHz y dos saltos da
 * 9,5 s, la cifra del documento de Trama.
 */
export function airePagoMs(preset: Preset, saltos = 2, bytesOrden = 118, bytesComprobante = 126, bytesAviso = 126): number {
  let total = 0;
  for (let k = 0; k < saltos; k++) {
    const ruta = Math.max(0, saltos - 1 - k);
    total += tiempoEnAireMs(bytesDatos(bytesOrden, ruta), preset) + tiempoEnAireMs(bytesAcuse(ruta), preset);
    total += tiempoEnAireMs(bytesDatos(bytesComprobante, ruta), preset) + tiempoEnAireMs(bytesAcuse(ruta), preset);
    if (bytesAviso > 0) total += tiempoEnAireMs(bytesDatos(bytesAviso, ruta), preset) + tiempoEnAireMs(bytesAcuse(ruta), preset);
  }
  return total;
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
  /** Probabilidad de entrega en un intento y con los reintentos de MeshCore. */
  probabilidad: number;
  probabilidadReintentos: number;
  preset: string;
  /** «directa»: la ruta ya está aprendida; «inundacion»: el primer mensaje, que repiten todos los repetidores. */
  modo: "directa" | "inundacion";
  /** Transmisiones de radio que cuesta el paquete (con inundación, una por cada repetidor que lo oye). */
  transmisiones: number;
  /** Lo que espera el remitente el acuse antes de reintentar (ms). */
  esperaAcuseMs: number;
};

const clave = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

/**
 * Simula el envío de un paquete desde `ruta[0]` hasta el gateway por la ruta `ruta` (ids desde el origen hasta la
 * pasarela, como la entrega el análisis de la malla). Por defecto la ruta ya está aprendida (envío directo).
 */
export function simularMensaje(ruta: string[], antenas: Antena[], enlaces: Enlace[], p: Parametros, carga = 118, modo: "directa" | "inundacion" = "directa"): ViajeMensaje {
  const preset = presetPorId(p.preset);
  const intermedios = Math.max(0, ruta.length - 2);
  const bytes = bytesDatos(carga, modo === "directa" ? intermedios : 0);
  const aire = tiempoEnAireMs(bytes, preset);
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const porPar = new Map(enlaces.map((e) => [clave(e.a, e.b), e]));
  const repetidores = antenas.filter((a) => a.activa && a.rol === "REPETIDOR").length;
  const base = { ruta, limiteSaltos: p.limiteSaltos, bytes, aireMs: aire, preset: preset.nombre, modo };
  if (ruta.length < 2) {
    return {
      ...base,
      llega: false,
      motivo: ruta.length === 1 && porId.get(ruta[0])?.pasarela ? "Ya está en el gateway." : "No tiene ruta hacia el gateway.",
      saltos: 0,
      tramos: [],
      totalMs: { min: 0, tipica: 0, max: 0 },
      probabilidad: 0,
      probabilidadReintentos: 0,
      transmisiones: modo === "inundacion" ? 1 + repetidores : 1,
      esperaAcuseMs: 0,
    };
  }
  const tramos: Tramo[] = [];
  for (let i = 0; i + 1 < ruta.length; i++) {
    const de = ruta[i];
    const a = ruta[i + 1];
    const e = porPar.get(clave(de, a));
    const margen = e ? (e.a === de ? e.margenAB : e.margenBA) : -Infinity;
    const snr = margen + snrLimite(preset.sf);
    // Con ruta directa el paquete pierde un byte de ruta en cada repetidor
    const aireTramo = modo === "directa" ? tiempoEnAireMs(bytesDatos(carga, Math.max(0, intermedios - i)), preset) : aire;
    // El remitente sale de una vez; cada repetidor espera su retardo aleatorio antes de retransmitir
    const espera = i === 0 ? { min: 0, max: 0, tipica: 0 } : esperaRetransmision(aireTramo, modo);
    tramos.push({ de, a, margenDb: margen, snrDb: snr, distanciaKm: e?.distanciaKm ?? 0, aireMs: aireTramo, espera, probabilidad: probabilidadEnlace(margen) });
  }
  const saltos = tramos.length;
  const suma = (f: (t: Tramo) => number) => tramos.reduce((s, t) => s + f(t), 0);
  const totalMs = { min: suma((t) => t.aireMs + t.espera.min), tipica: suma((t) => t.aireMs + t.espera.tipica), max: suma((t) => t.aireMs + t.espera.max) };
  const probabilidad = tramos.reduce((s, t) => s * t.probabilidad, 1);
  const sinEnlace = tramos.find((t) => t.margenDb < 20);
  const noRepite = ruta.slice(1, -1).map((id) => porId.get(id)).find((x) => x && x.rol !== "REPETIDOR");
  let motivo: string | null = null;
  if (noRepite) motivo = `${noRepite.nombre} no es repetidor: en MeshCore solo los repetidores pasan los paquetes de otros.`;
  else if (saltos > p.limiteSaltos) motivo = `Necesita ${saltos} saltos y el diseño permite ${p.limiteSaltos}: cada mensaje tardaría demasiado y le quitaría capacidad a la frecuencia.`;
  else if (sinEnlace) motivo = `El tramo ${porId.get(sinEnlace.de)?.nombre ?? "?"} → ${porId.get(sinEnlace.a)?.nombre ?? "?"} no tiene enlace (${sinEnlace.margenDb.toFixed(1).replace(".", ",")} dB; se necesitan 20 dB).`;
  return {
    ...base,
    llega: motivo === null,
    motivo,
    saltos,
    tramos,
    totalMs,
    probabilidad: motivo ? 0 : probabilidad,
    probabilidadReintentos: motivo ? 0 : 1 - (1 - probabilidad) ** INTENTOS,
    transmisiones: modo === "inundacion" ? 1 + repetidores : saltos,
    esperaAcuseMs: esperaAcuseMs(aire, saltos, modo),
  };
}
