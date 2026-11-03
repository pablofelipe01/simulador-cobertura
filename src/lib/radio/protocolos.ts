// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Los dos protocolos de malla que el simulador sabe simular, con los valores de sus fichas técnicas (26 de octubre
// de 2026): MeshCore (solo los repetidores retransmiten; el primer mensaje se inunda y los demás van por la ruta
// aprendida) y Meshtastic (inundación administrada: todos retransmiten, salvo los configurados como mudos). Y lo que
// se midió en un gateway real (red Meshtastic, semana del 19 al 26 de octubre de 2026): el tamaño real de los
// mensajes, cómo los atiende el gateway, la carga, la ocupación del canal, los errores y, antena por antena, la SNR
// frente a la respuesta a los sondeos. La prueba de popularidad y estrés usa estos valores para decir, usuario por
// usuario, a quién le funciona la red y a quién no.
import { porIdioma, tx } from "../idioma";
import type { ProtocoloId } from "./constantes";
import { snrLimite } from "./mensaje";
import { IDENTIDAD_GATEWAY } from "./ficha-gateway";

export type { ProtocoloId };

export type PerfilProtocolo = {
  id: ProtocoloId;
  nombre: string;
  /** Quién reenvía los paquetes de otros. */
  quienRetransmite: string;
  ruteo: string;
  saltosDefecto: number;
  saltosMax: number;
  /** Bytes de carga útil por paquete y texto máximo por mensaje (más largo, se manda en partes). */
  cargaMaxima: number;
  textoMaximo: number;
  /** Bytes de cabecera del paquete en el aire. */
  cabecera: number;
  /** Bytes de un acuse en el aire. */
  acuse: number;
  /** Envíos de un mensaje directo con acuse (el primero y los reintentos). */
  envios: number;
  /** Cola de transmisión del radio (paquetes). */
  colaRadio: number;
  /** Tope del tiempo de transmisión por hora (%). En la banda de 915 MHz, Meshtastic no limita; MeshCore usa el 50 %. */
  cicloPct: number;
  /** Ocupación del canal desde la que el protocolo empieza a recortar (o se considera saturado) (%). */
  canalAlertaPct: number;
  cifrado: string;
  licencia: string;
  notas: string[];
};

/** Las notas de cada protocolo, armadas una vez por idioma. */
const NOTAS_MESHCORE = porIdioma(() => [
  tx(
    "Para América el proyecto recomienda 910,525 MHz · SF7 · 62,5 kHz (unas 2,5 veces más rápido en el aire que SF11 · 250 kHz).",
    "For the Americas the project recommends 910.525 MHz · SF7 · 62.5 kHz (about 2.5 times faster on the air than SF11 · 250 kHz).",
  ),
  tx("Tasa de código 4/5 en enlaces estables; 4/7 u 4/8 en enlaces intermitentes.", "Coding rate 4/5 on stable links; 4/7 or 4/8 on intermittent links."),
  tx("Texto de hasta 160 bytes: las tildes y la ñ ocupan 2 bytes cada una.", "Text of up to 160 bytes: accented letters and ñ take 2 bytes each."),
  tx("Los canales de grupo siempre se inundan y gastan aire en toda la red.", "Group channels are always flooded and use airtime across the whole network."),
  tx("Los repetidores se anuncian por inundación cada 12 horas (flood.advert.interval).", "Repeaters announce themselves by flooding every 12 hours (flood.advert.interval)."),
]);
const NOTAS_MESHTASTIC = porIdioma(() => [
  tx("Cabecera de 16 bytes; carga útil de hasta ~237 bytes; preámbulo de 16 símbolos.", "16-byte header; payload of up to ~237 bytes; 16-symbol preamble."),
  tx(
    "Con más del 25 % del canal ocupado empieza a recortar el tráfico no esencial (posiciones y telemetría).",
    "With more than 25% of the channel busy it starts cutting non-essential traffic (positions and telemetry).",
  ),
  tx(
    "Los clientes que repiten todo multiplican el aire en las zonas densas: en redes grandes conviene dejar a los usuarios en CLIENT_MUTE y que repitan los ROUTER.",
    "Clients that repeat everything multiply the airtime in dense areas: in large networks it's best to leave users in CLIENT_MUTE and let the ROUTERs repeat.",
  ),
]);

export const PROTOCOLOS: Record<ProtocoloId, PerfilProtocolo> = {
  meshcore: {
    id: "meshcore",
    nombre: "MeshCore",
    get quienRetransmite() {
      return tx("Solo los repetidores (y los servidores de sala con la repetición activada); los equipos de los usuarios no", "Only repeaters (and room servers with repeating turned on); the users' devices don't");
    },
    get ruteo() {
      return tx(
        "El primer mensaje a un contacto se inunda; el acuse trae la ruta y los siguientes van solo por los repetidores de esa ruta. Tras 3 reintentos fallidos vuelve a inundar.",
        "The first message to a contact is flooded; the acknowledgment brings back the route and the following ones go only through the repeaters on that route. After 3 failed retries it floods again.",
      );
    },
    saltosDefecto: 3,
    saltosMax: 64,
    cargaMaxima: 184,
    textoMaximo: 160,
    cabecera: 2,
    acuse: 4,
    envios: 4,
    colaRadio: 16,
    cicloPct: 50,
    canalAlertaPct: 30,
    get cifrado() {
      return tx("AES-128 ECB con HMAC de 2 bytes; mensajes directos con secreto compartido (ECDH)", "AES-128 ECB with a 2-byte HMAC; direct messages with a shared secret (ECDH)");
    },
    licencia: "MIT",
    get notas() {
      return NOTAS_MESHCORE();
    },
  },
  meshtastic: {
    id: "meshtastic",
    nombre: "Meshtastic",
    get quienRetransmite() {
      return tx("Todos los nodos (ROUTER, CLIENT), salvo los configurados para no hacerlo (CLIENT_MUTE)", "All nodes (ROUTER, CLIENT), except those configured not to (CLIENT_MUTE)");
    },
    get ruteo() {
      return tx(
        "Inundación administrada: cada nodo espera según la SNR (los lejanos primero) y, si oye que otro ya lo repitió, no lo repite; los ROUTER siempre repiten. Desde la versión 2.6 los mensajes directos aprenden el siguiente salto.",
        "Managed flooding: each node waits according to the SNR (the farthest first) and, if it hears that another node already repeated the packet, it doesn't repeat it; ROUTERs always repeat. Since version 2.6, direct messages learn the next hop.",
      );
    },
    saltosDefecto: 3,
    saltosMax: 7,
    cargaMaxima: 237,
    textoMaximo: 200,
    cabecera: 16,
    acuse: 24,
    envios: 3,
    colaRadio: 16,
    cicloPct: 100,
    canalAlertaPct: 25,
    get cifrado() {
      return tx("AES-256 CTR por canal; clave pública (X25519) en los mensajes directos", "AES-256 CTR per channel; public key (X25519) in direct messages");
    },
    licencia: "GPL-3.0",
    get notas() {
      return NOTAS_MESHTASTIC();
    },
  },
};

/* ───────────── Lo medido en el gateway (ficha técnica de recepción) ───────────── */

export type AntenaMedida = {
  nombre: string;
  /** ID del nodo, si se puede mostrar. */
  nodo: string | null;
  radio: string;
  /** Distancia al gateway (km), si está registrada y se puede mostrar. */
  distanciaKm: number | null;
  /** Saltos hasta el gateway (0 = directo). */
  saltos: number | null;
  /** SNR mediana (dB). */
  snrDb: number | null;
  /** Respuesta a los últimos 100 sondeos (traceroute, prioridad baja, un reintento: es un piso). */
  respuestaPct: number;
  /** Tiempo de ida y vuelta mediano (s). */
  idaVueltaS: number | null;
};

/** Lo medido en cada antena, en el orden de `IDENTIDAD_GATEWAY.antenas` (los nombres van allá). */
const MEDIDAS_ANTENAS: Omit<AntenaMedida, "nombre" | "nodo" | "distanciaKm">[] = [
  { radio: "Seeed Solar Node", saltos: 0, snrDb: 6, respuestaPct: 64, idaVueltaS: 5.2 },
  { radio: "Heltec V4", saltos: 1, snrDb: -10.8, respuestaPct: 52, idaVueltaS: 9.8 },
  { radio: "Heltec V4", saltos: 1, snrDb: -12.9, respuestaPct: 40, idaVueltaS: 8 },
  { radio: "Heltec V4", saltos: 1, snrDb: -12, respuestaPct: 10, idaVueltaS: 8.6 },
  { radio: "Heltec V3", saltos: null, snrDb: null, respuestaPct: 0, idaVueltaS: null },
];

const ANTENAS_MEDIDAS: AntenaMedida[] = MEDIDAS_ANTENAS.map((m, i) => {
  const id = IDENTIDAD_GATEWAY.antenas[i] ?? { nombre: `Antena ${i + 1}`, nodo: null, distanciaKm: null };
  // El nombre en inglés, en el mismo orden (si falta, el de una antena genérica o el mismo nombre)
  const en = IDENTIDAD_GATEWAY.en?.antenas?.[i] ?? (IDENTIDAD_GATEWAY.antenas[i] ? id.nombre : `Antenna ${i + 1}`);
  return {
    get nombre() {
      return tx(id.nombre, en);
    },
    nodo: id.nodo,
    distanciaKm: id.distanciaKm,
    ...m,
  };
});

/** Los nombres de la ficha en el idioma de la pantalla (los del gateway medido los da `ficha-gateway.ts`). */
const identidad = (k: "nombre" | "medidoEn" | "enFrase" | "equipo" | "servicio") => tx(IDENTIDAD_GATEWAY[k], IDENTIDAD_GATEWAY.en?.[k] ?? IDENTIDAD_GATEWAY[k]);

/** Lo que se observó en la ficha, armado una vez por idioma. */
const OBSERVACIONES = porIdioma(() => [
  tx(
    `${ANTENAS_MEDIDAS[0].nombre} tiene la ocupación de canal más alta de la red (~23 %), cerca del 25 % en que Meshtastic empieza a recortar tráfico no esencial.`,
    `${ANTENAS_MEDIDAS[0].nombre} has the highest channel occupancy in the network (~23%), close to the 25% at which Meshtastic starts cutting non-essential traffic.`,
  ),
  tx(
    "Una SNR de −11 a −13 dB deja poco margen: LoRa aún decodifica, pero cualquier interferencia o lluvia provoca pérdidas.",
    "An SNR of −11 to −13 dB leaves little margin: LoRa still decodes, but any interference or rain causes losses.",
  ),
  tx(`${ANTENAS_MEDIDAS[4].nombre} no respondió a ningún sondeo en el período medido.`, `${ANTENAS_MEDIDAS[4].nombre} didn't answer any probe during the measured period.`),
  tx("Pendiente de confirmar el preset de módem (por ejemplo LongFast).", "The modem preset is still to be confirmed (for example LongFast)."),
]);

export const FICHA_GATEWAY = {
  get nombre() {
    return identidad("nombre");
  },
  /** Texto del perfil de tráfico medido y cómo se nombra el gateway en una frase. */
  get medidoEn() {
    return identidad("medidoEn");
  },
  get enFrase() {
    return identidad("enFrase");
  },
  /** Palabras con que Melki reconoce que se habla de este gateway (en español: se comparan con lo que se escribe). */
  claves: IDENTIDAD_GATEWAY.claves,
  fecha: "2026-10-26",
  get semana() {
    return tx("19 al 26 de octubre de 2026", "October 19–26, 2026");
  },
  protocolo: "meshtastic" as ProtocoloId,
  get equipo() {
    return identidad("equipo");
  },
  get servicio() {
    return identidad("servicio");
  },
  /** Carga útil máxima por paquete (no fragmenta lo que recibe) y tamaño de cada parte de una respuesta larga ([i/n]). */
  cargaMaxima: 237,
  respuestaParte: 200,
  /** Largo real de los mensajes (caracteres). */
  mensaje: { minimo: 15, maximo: 56, mediana: 40 },
  comandos: 18,
  /** Atiende de a uno y en orden de llegada (~1 mensaje/s con la base de datos normal; hasta ~15 s si no responde). */
  proceso: { porMensajeS: 1, peorS: 15, limiteBaseDatosS: 15, reintentosLecturaS: [1, 2, 4] },
  /** Las consultas libres a la IA van en paralelo: hasta 160 tokens y 30 s. */
  ia: { tokens: 160, limiteS: 30 },
  reenvioRespuestaS: 2,
  revisionSolicitudesS: 20,
  nodos: { conocidos: 32, activos: 7 },
  canalPct: { min: 1, max: 4 },
  erroresPct: 3.6,
  picos: { minuto: 11, hora: 45, dia: 185 },
  antenas: ANTENAS_MEDIDAS,
  radios: [
    {
      modelo: "Heltec V4",
      get chip() {
        return tx("SX1262 + amplificador", "SX1262 + amplifier");
      },
      potenciaDbm: 28,
      sensibilidadDbm: -148,
    },
    { modelo: "Heltec V3", chip: "SX1262", potenciaDbm: 22, sensibilidadDbm: -148 },
    { modelo: "Seeed Solar Node", chip: "SX1262", potenciaDbm: 22, sensibilidadDbm: -148 },
  ],
  get observaciones() {
    return OBSERVACIONES();
  },
};

/** Ocupación del canal medida en el router solar, el más cargado de la red (%). */
export const CANAL_ROUTER_PCT = 23;

/* ───────────── Tráfico ───────────── */

/**
 * Perfil de tráfico de la prueba de popularidad:
 *  • «trama»: pagos de Trama (orden firmada de 118 B, comprobante y aviso de 126 B), 2,4 por persona al día y el 15 %
 *    (25 % en día de mercado) en la hora pico; el servidor contesta en paralelo.
 *  • «medido»: lo medido en el gateway: comandos de texto de 15 a 56 caracteres (mediana 40), respuesta de una parte
 *    (las de la IA, de varias), 185 mensajes al día entre 32 equipos (≈ 5,8 por equipo) con el 24 % en la hora pico
 *    (45 de 185), y el gateway que atiende de a uno (~1 mensaje/s).
 */
export type PerfilTrafico = "trama" | "medido";

/** Mensajes por equipo al día y parte en la hora pico (%) según lo medido. */
export const TRAFICO_MEDIDO = {
  mensajesPersonaDia: Math.round((FICHA_GATEWAY.picos.dia / FICHA_GATEWAY.nodos.conocidos) * 10) / 10,
  mensajesEquipoActivoDia: Math.round((FICHA_GATEWAY.picos.dia / FICHA_GATEWAY.nodos.activos) * 10) / 10,
  horaPicoPct: Math.round((100 * FICHA_GATEWAY.picos.hora) / FICHA_GATEWAY.picos.dia),
  /** Bytes típicos de la respuesta a un comando (cabe en una parte) y de una respuesta de la IA (160 tokens). */
  respuestaBytes: 120,
  respuestaIaBytes: 640,
  /** Parte de los mensajes que son consultas libres a la IA (supuesto: la ficha no da la mezcla). */
  iaPct: 5,
  /** Lo que tarda la IA en contestar (supuesto: 4 a 12 s) y su límite (30 s). */
  iaMs: [4000, 12000] as [number, number],
  iaLimiteMs: FICHA_GATEWAY.ia.limiteS * 1000,
} as const;

/**
 * Tráfico de fondo de Meshtastic (valores de fábrica): cada equipo difunde su telemetría cada 30 minutos y su NodeInfo
 * cada 3 horas, y cada difusión se inunda por toda la malla (hasta el límite de saltos). Con el canal sobre el 25 %
 * los equipos la recortan. Las posiciones no se cuentan (equipos sin GPS); algunas versiones recientes del firmware no
 * mandan la telemetría a la malla.
 */
export const FONDO_MT = { telemetriaS: 1800, nodeInfoS: 10800, bytesTelemetria: 30, bytesNodeInfo: 60, recortePct: 25 } as const;

/** Largos de los mensajes (caracteres) de los que se sortea cada uno: mediana 40, entre 15 y 56. */
export const LARGOS_MEDIDOS = [15, 22, 28, 34, 38, 40, 42, 46, 50, 56] as const;

/** Cómo atiende el gateway: de a uno (lo medido) o en paralelo (un servidor que contesta cada mensaje por su lado). */
export type AtencionGateway = { modo: "secuencial" | "paralelo"; procesoMs: number; lentoPct: number; lentoMs: [number, number] };

export const GATEWAY_MEDIDO: AtencionGateway = { modo: "secuencial", procesoMs: FICHA_GATEWAY.proceso.porMensajeS * 1000, lentoPct: 1, lentoMs: [5000, FICHA_GATEWAY.proceso.peorS * 1000] };
export const GATEWAY_SERVIDOR: AtencionGateway = { modo: "paralelo", procesoMs: 1500, lentoPct: 0, lentoMs: [1500, 1500] };

/* ───────────── Entrega por enlace ───────────── */

/**
 * Probabilidad de que un paquete pase un enlace según su margen sobre la sensibilidad (dB), calibrada con lo medido en
 * el gateway: el 3,6 % de los paquetes llega con error aun con buena señal, y las antenas a un salto con SNR de −11 a
 * −13 dB (unos 5,5 dB sobre el límite de SF11, −17,5 dB) responden entre el 40 y el 52 % de los sondeos de ida y
 * vuelta con un reintento: cerca de la mitad de los paquetes pasa cada enlace. Con 10 dB de margen pasa el 85 % y con
 * 20 dB, el 96 %. Desde −11 dB de SNR cualquier interferencia o lluvia provoca pérdidas.
 */
export function entregaPorMargen(margenDb: number): number {
  if (!Number.isFinite(margenDb)) return 0;
  return (1 - FICHA_GATEWAY.erroresPct / 100) / (1 + Math.exp(-(margenDb - 5.5) / 2.2));
}

/** La misma curva con la SNR medida (dB) y el SF del enlace. */
export function entregaMedida(snrDb: number, sf = 11): number {
  return entregaPorMargen(snrDb - snrLimite(sf));
}

/**
 * Curva de entrega por enlace: «diseno», la conservadora del diseño (20 dB de margen ≈ 70 %, 30 dB ≈ 98 %), que cubre
 * el error del modelo de propagación; «campo», la medida en el gateway (con el margen real, no el predicho).
 */
export type CurvaEnlace = "diseno" | "campo";
