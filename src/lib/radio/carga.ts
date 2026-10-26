// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Prueba de carga de la malla: N pagos (o mensajes de texto: WhatsApp, consultas a la IA, comandos del gateway) al
// tiempo y hasta dónde aguanta la frecuencia. Simulación por eventos del canal LoRa, nodo por nodo, con lo que hace el
// firmware del protocolo escogido (lo da el ajuste de radio):
//  • MeshCore: espera aleatoria de cada repetidor antes de retransmitir (txdelay 0,5 inundado y 0,3 directo), escucha
//    antes de transmitir (si está recibiendo, espera 120–360 ms; a los 4 s transmite igual), ciclo de trabajo del 50 %
//    por hora, cola de 32 paquetes en el repetidor y 16 en la billetera, deduplicación, ruta directa aprendida o
//    inundación, acuses y 3 reintentos (el último por inundación). Solo los repetidores retransmiten.
//  • Meshtastic: inundación administrada. Repiten todos (ROUTER, CLIENT), salvo los mudos (CLIENT_MUTE); cada uno
//    espera según la SNR con que lo oyó (el más lejano sale primero; los ROUTER antes que los demás) y, si oye que otro
//    ya lo repitió, cancela el suyo (los ROUTER no cancelan). Límite de saltos (3 por defecto, hasta 7), siguiente
//    salto aprendido para los mensajes directos (2.6), acuse del destino, hasta 3 envíos con la espera del firmware
//    (el último por inundación), sin tope de ciclo en 915 MHz y cola de 16 paquetes.
// En el aire: un nodo que transmite no recibe; dos señales que se pisan en un receptor se pierden salvo que una le
// saque 6 dB a la otra (captura LoRa); y cada enlace pasa con la probabilidad de su margen (la curva del diseño o la
// medida en un gateway real). Las billeteras se oyen entre sí según la distancia (el análisis de la malla no
// calcula esos enlaces): se estima con el margen sobre terreno plano y el entorno; las que no se oyen no esperan a las
// otras (terminal oculto). El gateway contesta en paralelo (un servidor) o de a uno (como el gateway medido: ~1 s por
// mensaje, hasta 15 s si la base de datos no responde). Es una estimación para planear; se valida midiendo el canal en
// una red piloto.
import { margenPlanoDe } from "./alcance-plano";
import { presetPorId, type ProtocoloId } from "./constantes";
import {
  aireIdaVueltaMs,
  bytesAcuse,
  bytesDatos,
  bytesDatosMt,
  esperaAcuseMs,
  esperaAcuseMt,
  INTENTOS,
  MESHTASTIC,
  PAQUETE_MT,
  probabilidadEnlace,
  RETARDO,
  retardoPropioMt,
  retardoRetransmisionMt,
  snrLimite,
  tiempoEnAireMs,
} from "./mensaje";
import { generador } from "./poblar";
import { entregaPorMargen, FONDO_MT, LARGOS_MEDIDOS, PROTOCOLOS, TRAFICO_MEDIDO, type AtencionGateway, type CurvaEnlace, type PerfilTrafico } from "./protocolos";
import type { Antena, Enlace, NodoMalla, Parametros } from "./tipos";

export type TipoCarga = "pago" | "texto";

export type PedidoCarga = {
  antenas: Antena[];
  enlaces: Enlace[];
  nodos: NodoMalla[];
  parametros: Parametros;
  tipo: TipoCarga;
  /** Cuántos pagos o mensajes. */
  mensajes: number;
  /** «rafaga»: todos salen dentro de `ventanaS`; «continua»: `mensajes` repartidos al azar en `duracionMin` minutos (Poisson). */
  modo: "rafaga" | "continua";
  ventanaS: number;
  duracionMin: number;
  /** La ruta ya está aprendida (envío directo); si no, el primer intento se inunda. */
  rutaConocida: boolean;
  /** Pago: avisar también a quien recibe (un comercio al azar de la red). */
  conAviso: boolean;
  /** Texto: caracteres y si el gateway contesta. */
  caracteres: number;
  respuesta: boolean;
  /** Lo que tarda el banco (o el servidor) en contestar, por Starlink (ms). */
  servidorMs: number;
  semilla: number;
  /**
   * Peso de cada remitente (id de la persona → veces su ritmo; sin valor = 1). Con pesos, cada mensaje sale de una
   * persona al azar en proporción a su peso: así se carga más una zona sin mover a nadie.
   */
  pesos?: Record<string, number>;
  /**
   * Tráfico: «trama» (lo que diga `tipo`) o «medido»: comandos de texto como los del gateway medido (de 15 a 56
   * caracteres, mediana 40), con su respuesta (las de la IA, en varias partes).
   */
  perfil?: PerfilTrafico;
  /** Cómo atiende el gateway: de a uno (lo medido) o en paralelo (sin valor: en paralelo, `servidorMs` cada uno). */
  atencion?: AtencionGateway;
  /** Curva de entrega por enlace (sin valor: la del diseño). */
  curva?: CurvaEnlace;
  /** Meshtastic: cada equipo difunde además su telemetría (cada 30 min) y su NodeInfo (cada 3 h), inundadas. */
  fondo?: boolean;
};

export const PEDIDO_CARGA_DEFECTO: Omit<PedidoCarga, "antenas" | "enlaces" | "nodos" | "parametros"> = {
  tipo: "pago",
  mensajes: 15,
  modo: "rafaga",
  ventanaS: 10,
  duracionMin: 60,
  rutaConocida: true,
  conAviso: true,
  caracteres: 60,
  respuesta: true,
  servidorMs: 1500,
  semilla: 7,
};

/** Bytes de la orden firmada, el comprobante y el aviso de un pago (documento de Trama). */
export const BYTES_PAGO = { orden: 118, comprobante: 126, aviso: 126 } as const;

export type OcupacionNodo = { id: string; nombre: string; aireS: number; pct: number; transmisiones: number };

/** El gateway en la prueba: cómo atiende, cuántos mensajes atendió, la espera en su fila (s) y su ocupación (%). */
export type GatewayCarga = { modo: AtencionGateway["modo"]; atendidos: number; esperaP50S: number; esperaP95S: number; esperaMaxS: number; ocupadoPct: number };

export type ResultadoCarga = {
  tipo: TipoCarga;
  modo: PedidoCarga["modo"];
  protocolo: ProtocoloId;
  mensajes: number;
  /** Remitentes posibles: en MeshCore, las personas con ruta al gateway; en Meshtastic, todas (otros pueden repetirlas). */
  remitentes: number;
  /** Personas en la red y cuántas tienen ruta al gateway. */
  personas: number;
  conRuta: number;
  /** La orden (o el mensaje) llegó al gateway. */
  entregados: number;
  /** El remitente recibió la respuesta: el comprobante (pago) o la respuesta / el acuse (texto). */
  completos: number;
  /** Avisos que le llegaron a quien recibe el pago. */
  avisos: number;
  avisosPedidos: number;
  completosPct: number;
  primerIntentoPct: number;
  /** Segundos desde que se envía hasta que vuelve la respuesta (completos). */
  latenciaS: { p50: number; p95: number; max: number };
  transmisiones: number;
  reintentos: number;
  inundaciones: number;
  /** Meshtastic: retransmisiones canceladas porque el nodo oyó que otro ya lo había repetido. */
  cancelados: number;
  colisiones: number;
  /** Recepciones perdidas porque el receptor estaba transmitiendo (radio semidúplex). */
  sordos: number;
  perdidasCola: number;
  esperasCanal: number;
  /** Ocupación del canal en el gateway (% del tiempo con alguna señal al aire que oye). */
  canalGatewayPct: number;
  /** Los nodos que más transmiten. */
  ocupacion: OcupacionNodo[];
  /** Tiempo hasta que terminó el último (s) y ventana de la prueba (s). */
  duracionS: number;
  ventanaS: number;
  /** Tiempo en el aire por pago (o mensaje con su respuesta) completo en un enlace limpio (s). */
  airePorPagoS: number;
  /** Partes de respuesta enviadas (una respuesta larga va en varias). */
  partes: number;
  /** Meshtastic: difusiones de fondo (telemetría y NodeInfo) enviadas y las que se recortaron por el canal sobre el 25 %. */
  fondo: number;
  recortados: number;
  gateway: GatewayCarga;
  /** Se revienta: menos del 90 % recibe su comprobante (o su respuesta). */
  saturada: boolean;
  /** Aguanta, pero lento: el 95 % tarda más de un minuto. */
  lenta: boolean;
  motivo: string | null;
};

/* ───────────── Cola de eventos ───────────── */

type Evento = { t: number; n: number; f: () => void };

class Agenda {
  private h: Evento[] = [];
  private n = 0;
  poner(t: number, f: () => void) {
    const e = { t, n: this.n++, f };
    const h = this.h;
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p].t < e.t || (h[p].t === e.t && h[p].n < e.n)) break;
      h[i] = h[p];
      i = p;
    }
    h[i] = e;
  }
  sacar(): Evento | undefined {
    const h = this.h;
    if (!h.length) return undefined;
    const top = h[0];
    const ult = h.pop()!;
    if (h.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= h.length) break;
        const r = l + 1;
        const m = r < h.length && (h[r].t < h[l].t || (h[r].t === h[l].t && h[r].n < h[l].n)) ? r : l;
        if (h[m].t > ult.t || (h[m].t === ult.t && h[m].n > ult.n)) break;
        h[i] = h[m];
        i = m;
      }
      h[i] = ult;
    }
    return top;
  }
  get vacia() {
    return this.h.length === 0;
  }
}

/* ───────────── Modelo ───────────── */

type Etapa = "orden" | "comprobante" | "aviso" | "texto" | "respuesta";

type Paquete = {
  hash: number;
  acuse: boolean;
  ruteo: "directa" | "inundacion";
  origen: number;
  destino: number;
  /** Directa: repetidores que faltan (índices). Inundación: repetidores por los que ya pasó. */
  ruta: number[];
  carga: number;
  /** Identificador del envío (para los acuses y los reintentos). */
  envio: number;
  /** Meshtastic: saltos que le quedan (hop_limit). */
  saltos: number;
};

type Envio = {
  id: number;
  mensaje: number;
  etapa: Etapa;
  origen: number;
  destino: number;
  /** Ruta conocida de origen a destino (repetidores intermedios), o null si no se conoce. */
  ruta: number[] | null;
  /** Bytes de la carga y, en una respuesta en partes, cuál es. */
  carga: number;
  parte: number;
  intento: number;
  confirmado: boolean;
  fallido: boolean;
  /** Meshtastic: el reenvío lleva el mismo identificador del paquete. */
  hash: number | null;
};

type Mensaje = {
  remitente: number;
  receptor: number;
  gateway: number;
  t0: number;
  entregado: boolean;
  completo: number | null;
  aviso: boolean;
  primerIntento: boolean;
  respondido: boolean;
  /** Partes de la respuesta y cuáles llegaron. */
  partes: number;
  recibidas: boolean[];
  /** Consulta libre a la IA (perfil medido): va en paralelo y su respuesta es larga. */
  ia: boolean;
};

type Nodo = {
  id: string;
  nombre: string;
  repite: boolean;
  /** Meshtastic: ROUTER (siempre repite y no cancela). */
  router: boolean;
  /** Gateway o repetidor de la infraestructura (no una persona). */
  infra: boolean;
  pasarela: boolean;
  cola: { pk: Paquete; listo: number; prioridad: number; relevo: boolean }[];
  pool: number;
  transmitiendoHasta: number;
  propias: [number, number][];
  vistos: Set<number>;
  cadDesde: number | null;
  presupuesto: number;
  ultimoPresupuesto: number;
  aire: number;
  transmisiones: number;
  intentando: boolean;
};

type Senal = { tx: number; ini: number; fin: number; m: number };

const VENTANA_CICLO_MS = 3_600_000;
const CICLO = 0.5;
/** flood.max del repetidor (por defecto 64 saltos). */
const FLOOD_MAX = 64;
/** Lo que se recuerda un paquete visto (Meshtastic): pasado esto ya terminó de inundarse. */
const RECUERDO_MS = 15 * 60_000;

const percentil = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.max(0, Math.ceil((p / 100) * o.length) - 1))];
};

/** Partes en que va una respuesta de `bytes` con el protocolo (Meshtastic: 200 bytes por parte; MeshCore: 160). */
export function partesDe(bytes: number, protocolo: ProtocoloId): number {
  return Math.max(1, Math.ceil(bytes / PROTOCOLOS[protocolo].textoMaximo));
}

/** Tiempo en el aire de un mensaje y su respuesta por una ruta de `saltos` enlaces, sin colisiones (s). */
export function aireDeMensaje(p: Parametros, saltos: number, ida: number, vueltas: number[]): number {
  return aireIdaVueltaMs(presetPorId(p.preset), saltos, ida, vueltas) / 1000;
}

/** Lo que pasó con cada pago y en cada nodo (para la prueba de estrés por repetidor y por persona). */
export type DetalleCarga = {
  /** Ids de los nodos activos, en el orden de los índices. */
  ids: string[];
  /** Por mensaje: el remitente, el nodo por el que entra a la malla (−1 si no tiene ruta), cuándo salió y la espera (s, si completó). */
  mensajes: { remitente: number; zona: number; t0: number; latS: number | null; entregado: boolean }[];
  /**
   * Por nodo: aire propio, transmisiones, recepciones que le llegaron con señal (y las que perdió por choques o por estar
   * transmitiendo), paquetes que puso en cola y los que botó, retransmisiones canceladas, esperas por canal ocupado y
   * tiempo con el canal ocupado (solo gateway y repetidores).
   */
  nodos: { aireMs: number; transmisiones: number; recepciones: number; colisiones: number; sordos: number; encolados: number; perdidasCola: number; cancelados: number; esperasCanal: number; canalMs: number | null }[];
  /** Tiempo que se generaron pagos y tiempo total simulado (ms). */
  generacionMs: number;
  spanMs: number;
  /** Remitente → nodo por el que entra a la malla. */
  zonaDe: Map<number, number>;
  /** Remitente → su ruta completa (índices: él, los que repiten y el gateway). */
  rutas: Map<number, number[]>;
  /** Índices de todas las personas (con y sin ruta). */
  personas: number[];
  /** Por nodo: cuántos de los que repiten (o el gateway) lo oyen, y el mejor margen hacia la infraestructura (dB). */
  alcanzables: number[];
  mejorMargen: number[];
  /** Margen de un transmisor hacia un receptor (dB sobre la sensibilidad) y probabilidad de que un paquete pase con ese margen. */
  margen: (tx: number, rx: number) => number;
  exito: (margenDb: number) => number;
  /** Envíos de un mensaje con acuse (el primero y los reintentos). */
  envios: number;
  protocolo: ProtocoloId;
  /** Espera de cada mensaje en la fila del gateway (ms). */
  esperasGateway: number[];
};

export function simularCarga(q: PedidoCarga): ResultadoCarga {
  return simularCargaDetalle(q).resultado;
}

/** Distancia máxima a la que se calcula si dos billeteras se oyen (km). */
const MAX_KM_ENTRE_PERSONAS = 30;
/** Por debajo de este margen la señal ni se oye ni estorba (dB). */
const MARGEN_INAUDIBLE = -10;

export function simularCargaDetalle(q: PedidoCarga): { resultado: ResultadoCarga; detalle: DetalleCarga } {
  const p = q.parametros;
  const preset = presetPorId(p.preset);
  const protocolo = preset.protocolo;
  const mt = protocolo === "meshtastic";
  const perfilProtocolo = PROTOCOLOS[protocolo];
  const medido = q.perfil === "medido";
  const tipo: TipoCarga = medido ? "texto" : q.tipo;
  const atencion: AtencionGateway = q.atencion ?? { modo: "paralelo", procesoMs: q.servidorMs, lentoPct: 0, lentoMs: [q.servidorMs, q.servidorMs] };
  const exito = q.curva === "campo" ? entregaPorMargen : probabilidadEnlace;
  const envios = mt ? MESHTASTIC.envios : INTENTOS;
  const limiteMt = Math.min(perfilProtocolo.saltosMax, Math.max(1, Math.round(p.limiteSaltos)));
  const usuariosRepiten = p.usuariosRepiten !== false;
  const azar = generador(q.semilla);
  const activos = q.antenas.filter((a) => a.activa);
  const idx = new Map(activos.map((a, i) => [a.id, i]));
  const nodosMalla = new Map(q.nodos.map((n) => [n.id, n]));
  const esPersona = activos.map((a) => a.rol !== "REPETIDOR" && !a.pasarela);
  const nodos: Nodo[] = activos.map((a, i) => ({
    id: a.id,
    nombre: a.nombre,
    // MeshCore: solo los repetidores. Meshtastic: ROUTER, el gateway (CLIENT) y las personas si no son mudas.
    repite: mt ? a.rol === "REPETIDOR" || a.pasarela || (esPersona[i] && usuariosRepiten) : a.rol === "REPETIDOR",
    router: a.rol === "REPETIDOR",
    infra: a.rol === "REPETIDOR" || a.pasarela,
    pasarela: a.pasarela,
    cola: [],
    pool: mt ? perfilProtocolo.colaRadio : a.rol === "REPETIDOR" ? 32 : 16,
    transmitiendoHasta: -1,
    propias: [],
    vistos: new Set(),
    cadDesde: null,
    presupuesto: VENTANA_CICLO_MS * CICLO,
    ultimoPresupuesto: 0,
    aire: 0,
    transmisiones: 0,
    intentando: false,
  }));
  const porNodo = nodos.map(() => ({ recepciones: 0, colisiones: 0, sordos: 0, encolados: 0, perdidasCola: 0, cancelados: 0, esperasCanal: 0 }));
  const repetidores = nodos.map((_, i) => i).filter((i) => nodos[i].repite);
  // Margen de cada transmisor hacia cada receptor (dB sobre la sensibilidad). Los enlaces con la infraestructura
  // vienen del análisis de la malla; entre billeteras se estima con el margen sobre terreno plano según la distancia
  // y se calcula solo cuando hace falta (con cientos de personas, la tabla completa no cabe).
  const N = Math.max(1, nodos.length);
  const clave = (t: number, r: number) => t * N + r;
  const margenInfra = new Map<number, number>();
  for (const e of q.enlaces) {
    const a = idx.get(e.a);
    const b = idx.get(e.b);
    if (a === undefined || b === undefined) continue;
    if (e.margenAB > MARGEN_INAUDIBLE) margenInfra.set(clave(a, b), e.margenAB);
    if (e.margenBA > MARGEN_INAUDIBLE) margenInfra.set(clave(b, a), e.margenBA);
  }
  const gLat = 111_320;
  const lat0 = activos.length ? activos.reduce((s, a) => s + a.lat, 0) / activos.length : 0;
  const cos0 = Math.cos((lat0 * Math.PI) / 180);
  const xs = activos.map((a) => a.lon * gLat * cos0);
  const ys = activos.map((a) => a.lat * gLat);
  // Curva de margen sobre terreno plano por pareja de equipos (la mayoría de las personas llevan el mismo)
  const equipos = new Map<string, number>();
  const claseEq = activos.map((a) => {
    const k = `${a.alturaM}|${a.potenciaDbm}|${a.gananciaDbi}|${a.perdidaCableDb}`;
    let c = equipos.get(k);
    if (c === undefined) equipos.set(k, (c = equipos.size));
    return c;
  });
  const E = Math.max(1, equipos.size);
  // Entre dos billeteras (a ras del suelo) se usa Longley-Rice, el modelo de Radio Mobile, que cuenta el reflejo del
  // suelo y la curvatura de la tierra: el modelo calibrado es para antenas en torre y entre equipos de mano a 1,5 m
  // daría decenas de kilómetros (con Longley-Rice, sobre terreno plano, se oyen hasta unos 8 km)
  const pSuelo: Parametros = { ...p, modelo: "itm" };
  const curvas: ((km: number) => number)[] = [];
  const curvaEntre = (t: number, r: number) => {
    const k = claseEq[t] * E + claseEq[r];
    return (curvas[k] ??= margenPlanoDe(activos[t], activos[r], pSuelo));
  };
  const margenPersonas = (t: number, r: number) => {
    const dKm = Math.hypot(xs[t] - xs[r], ys[t] - ys[r]) / 1000;
    const m = dKm > MAX_KM_ENTRE_PERSONAS ? -Infinity : curvaEntre(t, r)(dKm);
    return m > MARGEN_INAUDIBLE ? m : -Infinity;
  };
  const personas = nodos.map((_, i) => i).filter((i) => esPersona[i]);
  // Distancia hasta la que dos billeteras se oyen con `umbral` dB de margen: la mayor entre las parejas de equipos que
  // hay (una persona de cada equipo; la curva baja con la distancia)
  const muestra = new Map<number, number>();
  for (const i of personas) if (!muestra.has(claseEq[i])) muestra.set(claseEq[i], i);
  const alcanceEntrePersonasKm = (umbral: number) => {
    let km = 0.1;
    for (const t of muestra.values())
      for (const r of muestra.values()) {
        const c = curvaEntre(t, r);
        let lo = 0;
        let hi = MAX_KM_ENTRE_PERSONAS;
        if (c(hi) >= umbral) lo = hi;
        else
          for (let it = 0; it < 30; it++) {
            const mid = (lo + hi) / 2;
            if (c(mid) >= umbral) lo = mid;
            else hi = mid;
          }
        km = Math.max(km, lo);
      }
    return km;
  };
  // Más allá de esta distancia dos billeteras ni se oyen ni se estorban (se descarta sin calcular la curva)
  const lejosM = personas.length > 1 ? alcanceEntrePersonasKm(MARGEN_INAUDIBLE) * 1020 + 50 : 0;
  const lejos2 = lejosM * lejosM;
  // MeshCore guarda lo calculado (pocas parejas se cruzan); Meshtastic guarda el de las parejas que se oyen
  const entrePersonas = new Map<number, number>();
  const margenOy = new Map<number, number>();
  const margen = (t: number, r: number): number => {
    if (t === r) return -Infinity;
    if (esPersona[t] && esPersona[r]) {
      const dx = xs[t] - xs[r];
      const dy = ys[t] - ys[r];
      if (dx * dx + dy * dy > lejos2) return -Infinity;
      const k = clave(t, r);
      if (mt) return margenOy.get(k) ?? margenPersonas(t, r);
      const ya = entrePersonas.get(k);
      if (ya !== undefined) return ya;
      const m = margenPersonas(t, r);
      entrePersonas.set(k, m);
      return m;
    }
    return margenInfra.get(clave(t, r)) ?? -Infinity;
  };

  // Meshtastic: quiénes oyen a cada nodo entre los que repiten (con señal sobre la sensibilidad). Las personas se buscan
  // en una rejilla del tamaño del alcance entre billeteras.
  const oyentes: number[][] = mt ? nodos.map(() => []) : [];
  /** Distancia entre dos billeteras hasta la que una puede estorbar lo que otra le manda a una tercera (m). */
  let cercaM = 0;
  /** El margen con que oye cada uno (en el mismo orden). */
  const oyentesM: number[][] = mt ? nodos.map(() => []) : [];
  if (mt) {
    for (const [k, v] of margenInfra) {
      const t = Math.floor(k / N);
      const r = k % N;
      if (v >= 0 && nodos[r].repite) {
        oyentes[t].push(r);
        oyentesM[t].push(v);
      }
    }
    if (personas.length > 1) {
      const celda = alcanceEntrePersonasKm(0) * 1020 + 50;
      cercaM = celda + lejosM;
      const rejilla = new Map<string, number[]>();
      const celdaDe = (i: number) => [Math.floor(xs[i] / celda), Math.floor(ys[i] / celda)];
      for (const i of personas) {
        const [cx, cy] = celdaDe(i);
        const k = `${cx},${cy}`;
        const l = rejilla.get(k);
        if (l) l.push(i);
        else rejilla.set(k, [i]);
      }
      for (const t of personas) {
        const [cx, cy] = celdaDe(t);
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (const r of rejilla.get(`${cx + dx},${cy + dy}`) ?? []) {
              if (r === t || !nodos[r].repite) continue;
              const m = margenPersonas(t, r);
              if (m >= 0) {
                oyentes[t].push(r);
                oyentesM[t].push(m);
                margenOy.set(clave(t, r), m);
              }
            }
      }
    }
  }

  // Remitentes y rutas. MeshCore: las personas (que no retransmiten) con ruta al gateway por los repetidores, la del
  // análisis de la malla. Meshtastic: todas las personas; su ruta es la del análisis si cabe en el límite de saltos y,
  // si no, la de menos saltos por los nodos que repiten (personas incluidas).
  const rutaDe = (i: number): { gateway: number; intermedios: number[] } | null => {
    const n = nodosMalla.get(nodos[i].id);
    if (!n || n.saltos === null || n.ruta.length < 2) return null;
    const ids = n.ruta.map((id) => idx.get(id));
    if (ids.some((x) => x === undefined)) return null;
    const g = ids[ids.length - 1]!;
    if (!nodos[g].pasarela) return null;
    return { gateway: g, intermedios: ids.slice(1, -1) as number[] };
  };
  const gateways = nodos.map((_, i) => i).filter((i) => nodos[i].pasarela);
  const distMt = new Int16Array(N).fill(-1);
  const padreMt = new Int32Array(N).fill(-1);
  if (mt) {
    const cola: number[] = [];
    for (const g of gateways) {
      distMt[g] = 0;
      cola.push(g);
    }
    for (let h = 0; h < cola.length; h++) {
      const x = cola[h];
      if (distMt[x] > limiteMt) continue;
      for (const y of oyentes[x])
        if (distMt[y] < 0 && margen(y, x) >= 0) {
          distMt[y] = distMt[x] + 1;
          padreMt[y] = x;
          cola.push(y);
        }
    }
  }
  const rutaMt = (i: number): { gateway: number; intermedios: number[] } | null => {
    let primero = -1;
    if (distMt[i] > 0) primero = padreMt[i];
    else {
      let mejor = -Infinity;
      for (const r of oyentes[i]) {
        if (distMt[r] < 0 || distMt[r] > limiteMt) continue;
        const peor = Math.min(margen(i, r), margen(r, i));
        if (!(peor >= 0)) continue;
        const valor = -1000 * distMt[r] + peor;
        if (valor > mejor) {
          mejor = valor;
          primero = r;
        }
      }
    }
    if (primero < 0) return null;
    const camino: number[] = [];
    for (let x = primero; x >= 0 && !nodos[x].pasarela; x = padreMt[x]) camino.push(x);
    const g = camino.length ? padreMt[camino[camino.length - 1]] : primero;
    if (g < 0 || !nodos[g].pasarela) return null;
    return { gateway: g, intermedios: camino };
  };
  const rutas = new Map<number, { gateway: number; intermedios: number[] }>();
  const remitentes: number[] = [];
  const zonaDe = new Map<number, number>();
  for (const i of personas) {
    let r = rutaDe(i);
    if (mt && r && (r.intermedios.length > limiteMt || r.intermedios.some((k) => !nodos[k].repite))) r = null;
    if (mt && !r) r = rutaMt(i);
    if (r) {
      rutas.set(i, r);
      zonaDe.set(i, r.intermedios.find((k) => nodos[k].infra) ?? r.gateway);
    }
    if (r || mt) remitentes.push(i);
  }
  const conRuta = rutas.size;
  const gatewayCercano = (i: number) => {
    let mejor = gateways[0] ?? -1;
    let d = Infinity;
    for (const g of gateways) {
      const x = Math.hypot(xs[i] - xs[g], ys[i] - ys[g]);
      if (x < d) {
        d = x;
        mejor = g;
      }
    }
    return mejor;
  };
  const saltosMedios = conRuta ? [...rutas.values()].reduce((s, r) => s + r.intermedios.length + 1, 0) / conRuta : 2;
  const generacionMs = q.modo === "rafaga" ? q.ventanaS * 1000 : q.duracionMin * 60_000;
  const bytesRespuesta = medido ? TRAFICO_MEDIDO.respuestaBytes : q.caracteres;
  const vueltasTipicas = tipo === "pago" ? [BYTES_PAGO.comprobante, ...(q.conAviso ? [BYTES_PAGO.aviso] : [])] : q.respuesta || medido ? [bytesRespuesta] : [];
  const base: ResultadoCarga = {
    tipo,
    modo: q.modo,
    protocolo,
    mensajes: q.mensajes,
    remitentes: remitentes.length,
    personas: personas.length,
    conRuta,
    entregados: 0,
    completos: 0,
    avisos: 0,
    avisosPedidos: 0,
    completosPct: 0,
    primerIntentoPct: 0,
    latenciaS: { p50: 0, p95: 0, max: 0 },
    transmisiones: 0,
    reintentos: 0,
    inundaciones: 0,
    cancelados: 0,
    colisiones: 0,
    sordos: 0,
    perdidasCola: 0,
    esperasCanal: 0,
    canalGatewayPct: 0,
    ocupacion: [],
    duracionS: 0,
    ventanaS: generacionMs / 1000,
    airePorPagoS: aireDeMensaje(p, Math.round(saltosMedios), tipo === "pago" ? BYTES_PAGO.orden : medido ? 40 : q.caracteres, vueltasTipicas),
    partes: 0,
    fondo: 0,
    recortados: 0,
    gateway: { modo: atencion.modo, atendidos: 0, esperaP50S: 0, esperaP95S: 0, esperaMaxS: 0, ocupadoPct: 0 },
    saturada: false,
    lenta: false,
    motivo: null,
  };
  const detalle: DetalleCarga = {
    ids: nodos.map((n) => n.id),
    mensajes: [],
    nodos: nodos.map(() => ({ aireMs: 0, transmisiones: 0, recepciones: 0, colisiones: 0, sordos: 0, encolados: 0, perdidasCola: 0, cancelados: 0, esperasCanal: 0, canalMs: null })),
    generacionMs,
    spanMs: 0,
    zonaDe,
    rutas: new Map([...rutas].map(([i, r]) => [i, [i, ...r.intermedios, r.gateway]])),
    personas,
    alcanzables: nodos.map((_, i) => (mt ? oyentes[i].length : esPersona[i] ? nodos.reduce((s, n, k) => s + ((n.repite || n.pasarela) && margen(i, k) >= 0 ? 1 : 0), 0) : 0)),
    mejorMargen: nodos.map((_, i) => (esPersona[i] ? nodos.reduce((s, n, k) => (n.infra ? Math.max(s, margen(i, k)) : s), -Infinity) : -Infinity)),
    margen,
    exito,
    envios,
    protocolo,
    esperasGateway: [],
  };
  if (!gateways.length && personas.length) return { resultado: { ...base, motivo: "No hay gateway: marque una antena como pasarela." }, detalle };
  if (!remitentes.length) return { resultado: { ...base, motivo: "No hay personas con ruta al gateway: ponga personas (o «Poblar personas») donde haya cobertura y simule." }, detalle };
  if (q.mensajes <= 0) return { resultado: { ...base, motivo: "Indique cuántos pagos o mensajes." }, detalle };

  const agenda = new Agenda();
  /** Señales al aire o que terminaron hace poco (todas las de la red; cada receptor ve las que oye). */
  let senales: Senal[] = [];
  let ahora = 0;
  let hash = 1;
  let nEnvio = 0;
  const envios_ = new Map<number, Envio>();
  const mensajes: Mensaje[] = [];
  const historial: [number, number, number][] = [];
  const r = base;

  // Lo visto por cada nodo. MeshCore: un conjunto por nodo (solo los repetidores y el destino ven cada paquete).
  // Meshtastic: por paquete, el estado de cada nodo (0 no lo ha visto, 1 visto, 2 visto y con su retransmisión en cola).
  const vistosMt = new Map<number, Uint8Array>();
  const nacidos: [number, number][] = [];
  let purgado = 0;
  const estado = (h: number, i: number) => (mt ? (vistosMt.get(h)?.[i] ?? 0) : nodos[i].vistos.has(h) ? 1 : 0);
  const marcar = (h: number, i: number, v: number) => {
    if (!mt) {
      nodos[i].vistos.add(h);
      return;
    }
    let a = vistosMt.get(h);
    if (!a) {
      vistosMt.set(h, (a = new Uint8Array(N)));
      nacidos.push([ahora, h]);
    }
    a[i] = v;
  };
  const purgar = () => {
    while (purgado < nacidos.length && nacidos[purgado][0] < ahora - RECUERDO_MS) vistosMt.delete(nacidos[purgado++][1]);
  };

  // Ocupación reciente del canal (0–1, en el último minuto), para la ventana de contención de Meshtastic
  let aireVentana = 0;
  let inicioVentana = 0;
  const ocupacion = () => {
    while (inicioVentana < historial.length && historial[inicioVentana][1] < ahora - 60_000) {
      aireVentana -= historial[inicioVentana][1] - historial[inicioVentana][0];
      inicioVentana++;
    }
    return Math.min(1, Math.max(0, aireVentana / 60_000));
  };

  const aireDe = (pk: Paquete) => {
    // Meshtastic: una difusión (destino −1) va cifrada con la clave del canal, sin los 12 bytes de la clave pública
    if (mt) return tiempoEnAireMs(pk.acuse ? PAQUETE_MT.acuse : pk.destino < 0 ? PAQUETE_MT.cabecera + 6 + pk.carga : bytesDatosMt(pk.carga), preset);
    const largoRuta = pk.ruta.length;
    const bytes = pk.acuse ? (pk.ruteo === "inundacion" ? 12 + largoRuta : bytesAcuse(largoRuta)) : bytesDatos(pk.carga, largoRuta);
    return tiempoEnAireMs(bytes, preset);
  };

  const encolar = (i: number, pk: Paquete, listo: number, prioridad: number, relevo = false): boolean => {
    const n = nodos[i];
    if (n.cola.length >= n.pool) {
      r.perdidasCola++;
      porNodo[i].perdidasCola++;
      return false;
    }
    porNodo[i].encolados++;
    n.cola.push({ pk, listo, prioridad, relevo });
    if (!n.intentando) {
      n.intentando = true;
      agenda.poner(Math.max(ahora, listo), () => intentar(i));
    }
    return true;
  };

  /** Escucha antes de transmitir: ¿hay una señal al aire que este nodo oye? */
  const aireMaximo = tiempoEnAireMs(Math.max(255, PAQUETE_MT.cabecera + PAQUETE_MT.sobrecostoDatos + 255), preset) + 1;
  /** Señales al aire ahora (se depura en cada consulta: son pocas a la vez). */
  let alAire: Senal[] = [];
  const recibiendo = (i: number) => {
    if (alAire.some((s) => s.fin <= ahora)) alAire = alAire.filter((s) => s.fin > ahora);
    for (const s of alAire) if (s.ini <= ahora && s.tx !== i && margen(s.tx, i) >= 0) return true;
    return false;
  };

  const intentar = (i: number) => {
    const n = nodos[i];
    n.intentando = false;
    if (n.transmitiendoHasta > ahora) {
      n.intentando = true;
      agenda.poner(n.transmitiendoHasta, () => intentar(i));
      return;
    }
    if (!n.cola.length) return;
    // El primero listo, con prioridad (0 = directos) y luego el más antiguo
    let mejor = -1;
    let proximo = Infinity;
    for (let k = 0; k < n.cola.length; k++) {
      const c = n.cola[k];
      if (c.listo > ahora) {
        proximo = Math.min(proximo, c.listo);
        continue;
      }
      if (mejor < 0 || c.prioridad < n.cola[mejor].prioridad || (c.prioridad === n.cola[mejor].prioridad && c.listo < n.cola[mejor].listo)) mejor = k;
    }
    if (mejor < 0) {
      n.intentando = true;
      agenda.poner(proximo, () => intentar(i));
      return;
    }
    if (!mt) {
      // Ciclo de trabajo (presupuesto de aire por hora)
      n.presupuesto = Math.min(VENTANA_CICLO_MS * CICLO, n.presupuesto + (ahora - n.ultimoPresupuesto) * CICLO);
      n.ultimoPresupuesto = ahora;
      const minimo = tiempoEnAireMs(255, preset) / 2;
      if (n.presupuesto < minimo) {
        n.intentando = true;
        agenda.poner(ahora + (minimo - n.presupuesto) / CICLO, () => intentar(i));
        return;
      }
    }
    // Escucha antes de transmitir
    if (recibiendo(i)) {
      if (n.cadDesde === null) n.cadDesde = ahora;
      if (ahora - n.cadDesde < (mt ? 30_000 : 4000)) {
        r.esperasCanal++;
        porNodo[i].esperasCanal++;
        n.intentando = true;
        const espera = mt ? retardoPropioMt(ocupacion(), preset, azar()) + MESHTASTIC.macMs : 120 * (1 + Math.floor(azar() * 3));
        agenda.poner(ahora + espera, () => intentar(i));
        return;
      }
    }
    n.cadDesde = null;
    const { pk, relevo } = n.cola.splice(mejor, 1)[0];
    if (mt && relevo && estado(pk.hash, i) === 2) marcar(pk.hash, i, 1);
    const aire = aireDe(pk);
    const ini = ahora;
    const fin = ahora + aire;
    n.transmitiendoHasta = fin;
    n.propias.push([ini, fin]);
    if (n.propias.length > 40) n.propias.splice(0, n.propias.length - 40);
    n.presupuesto -= aire;
    n.aire += aire;
    n.transmisiones++;
    r.transmisiones++;
    historial.push([ini, fin, i]);
    aireVentana += aire;
    const senal = { tx: i, ini, fin, m: 0 };
    senales.push(senal);
    alAire.push(senal);
    // Limpieza de señales viejas (ningún paquete dura más de unos segundos)
    if ((r.transmisiones & 63) === 0) {
      senales = senales.filter((s) => s.fin > ahora - 20_000);
      if (mt) purgar();
    }
    agenda.poner(fin, () => finTx(i, pk, ini, fin));
  };

  /** Quienes podían necesitar el paquete: el siguiente de la ruta, el destino o los que lo repetirían (o lo cancelarían). */
  const interesados = (i: number, pk: Paquete): number[] => {
    if (pk.ruteo === "directa") {
      const sig = pk.ruta.length ? pk.ruta[0] : pk.destino;
      // Meshtastic: los demás que repiten también lo oyen y, si lo tenían en cola, lo cancelan
      return [sig];
    }
    const lista: number[] = [];
    if (mt) {
      const v = vistosMt.get(pk.hash);
      for (const k of oyentes[i]) if (!v || v[k] !== 1 || k === pk.destino) lista.push(k);
      if (pk.destino >= 0 && pk.destino !== i && !nodos[pk.destino].repite) lista.push(pk.destino);
      return lista;
    }
    for (const k of repetidores) if (k !== i && !nodos[k].vistos.has(pk.hash)) lista.push(k);
    if (!nodos[pk.destino].repite && pk.destino !== i) lista.push(pk.destino);
    return lista;
  };

  /** `rxI` recibe (o no) el paquete que `i` transmitió entre `ini` y `fin`, con margen `m`. */
  const recepcion = (i: number, pk: Paquete, ini: number, fin: number, rxI: number, m: number, pisan: Senal[]) => {
    if (!(m >= 0)) return;
    // Lo que se pierde en cada nodo se cuenta sobre los paquetes dirigidos a él (el siguiente de la ruta o el destino;
    // en MeshCore también los repetidores que deben inundar): en Meshtastic, las copias de una inundación que llegan a
    // la vez a muchos son redundantes y no dicen cuánto pierde lo suyo
    const dirigido = !mt || pk.ruteo === "directa" || rxI === pk.destino;
    if (dirigido) porNodo[rxI].recepciones++;
    // Semidúplex: si el receptor transmitió durante este paquete, no lo oyó (sus transmisiones van en orden)
    const propias = nodos[rxI].propias;
    for (let q = propias.length - 1; q >= 0; q--) {
      const [a, b] = propias[q];
      if (b <= ini) break;
      if (a < fin) {
        r.sordos++;
        if (dirigido) porNodo[rxI].sordos++;
        return;
      }
    }
    // Dos señales que se pisan en el receptor se pierden, salvo que esta le saque 6 dB a la otra (captura)
    for (const s of pisan) {
      if (s.tx === rxI) continue;
      if (margen(s.tx, rxI) > m - 6) {
        r.colisiones++;
        if (dirigido) porNodo[rxI].colisiones++;
        return;
      }
    }
    if (azar() > exito(m)) return;
    if (mt) recibirMt(rxI, pk, m, i);
    else recibir(rxI, pk);
  };

  const finTx = (i: number, pk: Paquete, ini: number, fin: number) => {
    // Las señales que se pisan con esta (las mismas para todos los receptores)
    // (las señales están en orden de inicio y ninguna dura más que un paquete de 255 bytes)
    const pisan: Senal[] = [];
    for (let k = senales.length - 1; k >= 0 && senales[k].ini > ini - aireMaximo; k--) {
      const s = senales[k];
      if (s.tx !== i && s.ini < fin && s.fin > ini) pisan.push(s);
    }
    pisan.reverse();
    if (mt && pk.ruteo === "inundacion") {
      // Meshtastic inundado: los que repiten y lo oyen (con el margen guardado), salvo los que ya lo vieron y no lo
      // tienen en cola; y el destino si no repite
      const v = vistosMt.get(pk.hash);
      const oy = oyentes[i];
      const om = oyentesM[i];
      // A una billetera que oye a `i` solo la estorban las infraestructuras y las billeteras cercanas a `i`
      let cerca = pisan;
      if (esPersona[i]) {
        const lim = cercaM * cercaM;
        cerca = pisan.filter((s) => !esPersona[s.tx] || (xs[s.tx] - xs[i]) ** 2 + (ys[s.tx] - ys[i]) ** 2 <= lim);
      }
      for (let j = 0; j < oy.length; j++) {
        const rxI = oy[j];
        if (v && v[rxI] === 1 && rxI !== pk.destino) continue;
        recepcion(i, pk, ini, fin, rxI, om[j], esPersona[rxI] ? cerca : pisan);
      }
      if (pk.destino >= 0 && pk.destino !== i && !nodos[pk.destino].repite) recepcion(i, pk, ini, fin, pk.destino, margen(i, pk.destino), pisan);
    } else for (const rxI of interesados(i, pk)) recepcion(i, pk, ini, fin, rxI, margen(i, rxI), pisan);
    const n = nodos[i];
    if (!n.intentando && n.cola.length) {
      n.intentando = true;
      agenda.poner(ahora, () => intentar(i));
    }
  };

  const enviar = (e: Envio, ruteo: "directa" | "inundacion") => {
    const h = mt ? (e.hash ??= hash++) : hash++;
    const pk: Paquete = { hash: h, acuse: false, ruteo, origen: e.origen, destino: e.destino, ruta: ruteo === "directa" && e.ruta ? [...e.ruta] : [], carga: e.carga, envio: e.id, saltos: limiteMt };
    if (ruteo === "inundacion") r.inundaciones++;
    marcar(pk.hash, e.origen, 1);
    const aire = aireDe(pk);
    if (mt) {
      const u = ocupacion();
      encolar(e.origen, pk, ahora + retardoPropioMt(u, preset, azar()), ruteo === "directa" ? 0 : 1);
      agenda.poner(ahora + esperaAcuseMt(aire, preset, u), () => vencio(e));
      return;
    }
    encolar(e.origen, pk, ahora, ruteo === "directa" ? 0 : 1);
    const saltos = (e.ruta?.length ?? 2) + 1;
    agenda.poner(ahora + esperaAcuseMs(aire, saltos, ruteo), () => vencio(e));
  };

  const cargaDe = (etapa: Etapa) =>
    etapa === "orden" ? BYTES_PAGO.orden : etapa === "comprobante" ? BYTES_PAGO.comprobante : etapa === "aviso" ? BYTES_PAGO.aviso : q.caracteres;

  const nuevoEnvio = (mensaje: number, etapa: Etapa, origen: number, destino: number, ruta: number[] | null, retraso = 0, carga = cargaDe(etapa), parte = 0) => {
    const e: Envio = { id: nEnvio++, mensaje, etapa, origen, destino, ruta, carga, parte, intento: 1, confirmado: false, fallido: false, hash: null };
    envios_.set(e.id, e);
    agenda.poner(ahora + retraso, () => enviar(e, e.ruta ? "directa" : "inundacion"));
    return e;
  };

  const vencio = (e: Envio) => {
    if (e.confirmado || e.fallido) return;
    if (e.intento >= envios) {
      e.fallido = true;
      return;
    }
    e.intento++;
    r.reintentos++;
    if (e.etapa === "orden" || e.etapa === "texto") mensajes[e.mensaje].primerIntento = false;
    if (mt) {
      // El último envío olvida el siguiente salto e inunda (con otro identificador, para que lo repitan de nuevo)
      if (e.intento === envios && e.ruta) {
        e.ruta = null;
        e.hash = null;
      }
      enviar(e, e.ruta ? "directa" : "inundacion");
      return;
    }
    // El último reintento olvida la ruta e inunda
    if (e.intento === INTENTOS) e.ruta = null;
    // La app reintenta cuando vence la espera; el celular, el Bluetooth (o el USB del gateway) le suman un retraso
    // variable, que desincroniza a dos que chocaron sin oírse
    const aire = tiempoEnAireMs(bytesDatos(e.carga, (e.ruta ?? []).length), preset);
    agenda.poner(ahora + azar() * Math.max(500, aire), () => enviar(e, e.ruta ? "directa" : "inundacion"));
  };

  const acusar = (desde: number, pk: Paquete, rutaVuelta: number[]) => {
    const e = envios_.get(pk.envio);
    if (!e) return;
    const ack: Paquete = { hash: hash++, acuse: true, ruteo: pk.ruteo, origen: desde, destino: pk.origen, ruta: pk.ruteo === "directa" ? rutaVuelta : [], carga: 0, envio: pk.envio, saltos: limiteMt };
    marcar(ack.hash, desde, 1);
    // MeshCore: TXT_ACK_DELAY de 200 ms
    agenda.poner(ahora + (mt ? 50 : 200), () => encolar(desde, ack, ahora, pk.ruteo === "directa" ? 0 : 1));
  };

  // El gateway: en paralelo (un servidor) o de a uno, en orden de llegada (lo medido). Las consultas a la IA van aparte.
  const libreDesde = new Map<number, number>();
  let ocupadoGw = 0;
  const atender = (g: number, ia: boolean): number => {
    if (ia) return Math.min(TRAFICO_MEDIDO.iaLimiteMs, TRAFICO_MEDIDO.iaMs[0] + azar() * (TRAFICO_MEDIDO.iaMs[1] - TRAFICO_MEDIDO.iaMs[0]));
    r.gateway.atendidos++;
    if (atencion.modo === "paralelo") {
      detalle.esperasGateway.push(0);
      return atencion.procesoMs;
    }
    const ini = Math.max(ahora, libreDesde.get(g) ?? 0);
    const dur = atencion.lentoPct > 0 && azar() * 100 < atencion.lentoPct ? atencion.lentoMs[0] + azar() * (atencion.lentoMs[1] - atencion.lentoMs[0]) : atencion.procesoMs;
    libreDesde.set(g, ini + dur);
    ocupadoGw += dur;
    detalle.esperasGateway.push(ini - ahora);
    return ini + dur - ahora;
  };

  const llegada = (i: number, pk: Paquete, rutaRecorrida: number[]) => {
    const e = envios_.get(pk.envio);
    if (!e) return;
    if (pk.acuse) {
      if (pk.destino !== i || e.confirmado) return;
      e.confirmado = true;
      // Con inundación, el acuse trae la ruta: los siguientes van directos
      if (pk.ruteo === "inundacion" && !e.ruta) e.ruta = [...rutaRecorrida].reverse();
      return;
    }
    if (pk.destino !== i) return;
    const vuelta = pk.ruteo === "directa" ? [...(e.ruta ?? [])].reverse() : [...rutaRecorrida].reverse();
    acusar(i, pk, vuelta);
    const m = mensajes[e.mensaje];
    if (e.etapa === "orden" || e.etapa === "texto") {
      if (m.entregado) return;
      m.entregado = true;
      // Ruta del gateway hacia la persona: la recorrida al revés
      const haciaPersona = pk.ruteo === "directa" ? [...(e.ruta ?? [])].reverse() : [...rutaRecorrida].reverse();
      if (e.etapa === "orden") {
        const listo = atender(i, false);
        nuevoEnvio(e.mensaje, "comprobante", i, m.remitente, haciaPersona, listo);
        if (q.conAviso && m.receptor >= 0) {
          r.avisosPedidos++;
          const rr = rutas.get(m.receptor);
          nuevoEnvio(e.mensaje, "aviso", i, m.receptor, rr ? [...rr.intermedios].reverse() : null, listo + 300);
        }
      } else if (q.respuesta || medido) {
        const listo = atender(i, m.ia);
        const total = medido ? (m.ia ? TRAFICO_MEDIDO.respuestaIaBytes : TRAFICO_MEDIDO.respuestaBytes) : q.caracteres;
        const tam = medido ? perfilProtocolo.textoMaximo : Math.max(1, total);
        for (let k = 0; k < m.partes; k++) {
          r.partes++;
          // Una respuesta larga sale en partes [i/n], una tras otra
          nuevoEnvio(e.mensaje, "respuesta", i, m.remitente, haciaPersona, listo + 400 * k, Math.min(tam, total - k * tam), k);
        }
      } else m.completo = ahora;
    } else if (e.etapa === "comprobante" || e.etapa === "respuesta") {
      if (!m.recibidas[e.parte]) {
        m.recibidas[e.parte] = true;
        if (m.completo === null && m.recibidas.every(Boolean)) m.completo = ahora;
      }
    } else if (e.etapa === "aviso") m.aviso = true;
  };

  const recibir = (i: number, pk: Paquete) => {
    const n = nodos[i];
    if (pk.ruteo === "directa") {
      if (pk.ruta.length > 0) {
        // Solo el siguiente de la ruta lo pasa, una vez
        if (pk.ruta[0] !== i || !n.repite || n.vistos.has(pk.hash)) return;
        n.vistos.add(pk.hash);
        const sig: Paquete = { ...pk, ruta: pk.ruta.slice(1) };
        encolar(i, sig, ahora + azar() * 5 * RETARDO.directa * aireDe(sig), 0);
        return;
      }
      if (pk.destino !== i || n.vistos.has(pk.hash)) return;
      n.vistos.add(pk.hash);
      llegada(i, pk, []);
      return;
    }
    // Inundación
    if (n.vistos.has(pk.hash)) return;
    n.vistos.add(pk.hash);
    if (pk.destino === i) {
      llegada(i, pk, pk.ruta);
      return;
    }
    if (!n.repite || pk.ruta.length >= FLOOD_MAX) return;
    const sig: Paquete = { ...pk, ruta: [...pk.ruta, i] };
    encolar(i, sig, ahora + azar() * 5 * RETARDO.inundacion * aireDe(sig), 1);
  };

  /** Cancela la retransmisión pendiente de un paquete (inundación administrada de Meshtastic). */
  const cancelar = (i: number, h: number) => {
    const n = nodos[i];
    const k = n.cola.findIndex((c) => c.relevo && c.pk.hash === h);
    if (k >= 0) {
      n.cola.splice(k, 1);
      r.cancelados++;
      porNodo[i].cancelados++;
    }
    marcar(h, i, 1);
  };

  /** Meshtastic: `i` recibió `pk` (que transmitió `tx`) con margen `m`. */
  const recibirMt = (i: number, pk: Paquete, m: number, tx: number) => {
    const n = nodos[i];
    const s = estado(pk.hash, i);
    // Lo oyó directo del remitente: es su primer envío o un reenvío (mismo identificador)
    const delRemitente = tx === pk.origen;
    if (s !== 0) {
      // Duplicado. El destino de un reenvío vuelve a acusar (el acuse anterior se pudo perder); el siguiente salto (o
      // quien repite en una inundación) que oye el reenvío del remitente lo vuelve a pasar si ya no lo tiene en cola;
      // los demás cancelan su retransmisión pendiente (salvo los ROUTER).
      if (delRemitente && s === 1) {
        if (pk.destino === i && !pk.acuse) {
          const e = envios_.get(pk.envio);
          acusar(i, pk, pk.ruteo === "directa" ? [...(e?.ruta ?? [])].reverse() : []);
          return;
        }
        if (n.repite && pk.saltos > 0 && (pk.ruteo === "inundacion" || pk.ruta[0] === i)) relevar(i, pk, m);
        return;
      }
      if (s === 2 && !n.router && !(pk.ruteo === "directa" && pk.ruta[0] === i)) cancelar(i, pk.hash);
      return;
    }
    if (pk.destino === i) {
      marcar(pk.hash, i, 1);
      llegada(i, pk, pk.ruteo === "directa" ? [] : pk.ruta);
      return;
    }
    marcar(pk.hash, i, 1);
    if (!n.repite || pk.saltos <= 0) return;
    if (pk.ruteo === "directa" && pk.ruta[0] !== i) return;
    relevar(i, pk, m);
  };

  /** Meshtastic: pone en cola la retransmisión, con la espera según la SNR (ROUTER y siguiente salto, la ventana corta). */
  const relevar = (i: number, pk: Paquete, m: number) => {
    const n = nodos[i];
    const directa = pk.ruteo === "directa";
    const sig: Paquete = directa ? { ...pk, ruta: pk.ruta.slice(1), saltos: pk.saltos - 1 } : { ...pk, ruta: [...pk.ruta, i], saltos: pk.saltos - 1 };
    const espera = retardoRetransmisionMt(m + snrLimite(preset.sf), n.router || directa, preset, azar());
    if (encolar(i, sig, ahora + espera, directa ? 0 : 1, true)) marcar(pk.hash, i, 2);
  };

  // Tráfico de fondo de Meshtastic: telemetría y NodeInfo de cada equipo, con su fase al azar
  if (mt && q.fondo) {
    const difundir = (k: number, bytes: number) => {
      if (ocupacion() * 100 > FONDO_MT.recortePct) {
        r.recortados++;
        return;
      }
      r.fondo++;
      const pk: Paquete = { hash: hash++, acuse: false, ruteo: "inundacion", origen: k, destino: -1, ruta: [], carga: bytes, envio: -1, saltos: limiteMt };
      marcar(pk.hash, k, 1);
      encolar(k, pk, ahora + retardoPropioMt(ocupacion(), preset, azar()), 2);
    };
    for (let k = 0; k < nodos.length; k++)
      for (const [periodo, bytes] of [
        [FONDO_MT.telemetriaS * 1000, FONDO_MT.bytesTelemetria],
        [FONDO_MT.nodeInfoS * 1000, FONDO_MT.bytesNodeInfo],
      ])
        for (let t0 = azar() * periodo; t0 < generacionMs; t0 += periodo) {
          const t = t0;
          agenda.poner(t, () => {
            ahora = t;
            difundir(k, bytes);
          });
        }
  }

  // Generación de los pagos o mensajes
  const orden = [...remitentes];
  for (let k = orden.length - 1; k > 0; k--) {
    const j = Math.floor(azar() * (k + 1));
    [orden[k], orden[j]] = [orden[j], orden[k]];
  }
  const tiempos: number[] = [];
  if (q.modo === "rafaga") for (let k = 0; k < q.mensajes; k++) tiempos.push(azar() * q.ventanaS * 1000);
  else {
    // Llegadas de Poisson con exactamente `mensajes` en la ventana: instantes uniformes al azar (así lo pedido por
    // hora es exacto y dos pruebas se comparan sin el ruido del conteo)
    const dur = q.duracionMin * 60_000;
    for (let k = 0; k < q.mensajes; k++) tiempos.push(azar() * dur);
  }
  tiempos.sort((a, b) => a - b);
  r.mensajes = tiempos.length;
  // Sin pesos, por turnos (cada persona manda igual); con pesos, al azar en proporción a su peso
  let elegir = (k: number) => orden[k % orden.length];
  if (q.pesos) {
    const pesos = q.pesos;
    const acumulado: number[] = [];
    let total = 0;
    for (const i of orden) acumulado.push((total += Math.max(0, pesos[nodos[i].id] ?? 1)));
    if (total > 0)
      elegir = () => {
        const u = azar() * total;
        let lo = 0;
        let hi = acumulado.length - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (acumulado[m] > u) hi = m;
          else lo = m + 1;
        }
        return orden[lo];
      };
  }
  tiempos.forEach((t0, k) => {
    const remitente = elegir(k);
    const ru = rutas.get(remitente) ?? null;
    let receptor = -1;
    if (tipo === "pago" && remitentes.length > 1) {
      do receptor = remitentes[Math.floor(azar() * remitentes.length)];
      while (receptor === remitente);
    }
    // Perfil medido: un comando del largo medido o, a veces, una consulta a la IA (respuesta larga, en partes)
    const ia = medido && azar() * 100 < TRAFICO_MEDIDO.iaPct;
    const carga = medido ? LARGOS_MEDIDOS[Math.floor(azar() * LARGOS_MEDIDOS.length)] + (ia ? 8 : 0) : cargaDe(tipo === "pago" ? "orden" : "texto");
    const partes = tipo === "pago" ? 1 : medido ? partesDe(ia ? TRAFICO_MEDIDO.respuestaIaBytes : TRAFICO_MEDIDO.respuestaBytes, protocolo) : 1;
    const gateway = ru?.gateway ?? gatewayCercano(remitente);
    mensajes.push({ remitente, receptor, gateway, t0, entregado: false, completo: null, aviso: false, primerIntento: true, respondido: false, partes, recibidas: new Array(partes).fill(false), ia });
    agenda.poner(t0, () => {
      ahora = t0;
      nuevoEnvio(k, tipo === "pago" ? "orden" : "texto", remitente, gateway, q.rutaConocida && ru ? [...ru.intermedios] : null, 0, carga);
    });
  });

  // Simulación
  const limite = (q.modo === "rafaga" ? q.ventanaS * 1000 : q.duracionMin * 60_000) + 15 * 60_000;
  let pasos = 0;
  while (!agenda.vacia && pasos < 4_000_000) {
    const ev = agenda.sacar()!;
    if (ev.t > limite) break;
    ahora = ev.t;
    ev.f();
    pasos++;
  }

  // Resultados
  const lat = mensajes.filter((m) => m.completo !== null).map((m) => (m.completo! - m.t0) / 1000);
  r.entregados = mensajes.filter((m) => m.entregado).length;
  r.completos = lat.length;
  r.avisos = mensajes.filter((m) => m.aviso).length;
  r.completosPct = r.mensajes ? (100 * r.completos) / r.mensajes : 0;
  r.primerIntentoPct = r.mensajes ? (100 * mensajes.filter((m) => m.completo !== null && m.primerIntento).length) / r.mensajes : 0;
  r.latenciaS = { p50: percentil(lat, 50), p95: percentil(lat, 95), max: lat.length ? Math.max(...lat) : 0 };
  let finMs = ahora;
  for (const m of mensajes) if (m.completo !== null && m.completo > finMs) finMs = m.completo;
  r.duracionS = finMs / 1000;
  const ventanaMs = Math.max(1, finMs);
  // Ocupación del canal en un nodo: unión de los intervalos de las señales que oye (y las suyas)
  const canalDe = (k: number) => {
    const tramos = historial.filter(([, , t]) => t === k || margen(t, k) >= 0).sort((x, y) => x[0] - y[0]);
    let oido = 0;
    let a0 = -1;
    let b0 = -1;
    for (const [ini, fin] of tramos) {
      if (ini > b0) {
        if (b0 > a0) oido += b0 - a0;
        a0 = ini;
        b0 = fin;
      } else b0 = Math.max(b0, fin);
    }
    if (b0 > a0) oido += b0 - a0;
    return oido;
  };
  const gw = nodos.findIndex((n) => n.pasarela);
  if (gw >= 0) r.canalGatewayPct = Math.min(100, (100 * canalDe(gw)) / ventanaMs);
  r.ocupacion = nodos
    .map((n) => ({ id: n.id, nombre: n.nombre, aireS: n.aire / 1000, pct: (100 * n.aire) / ventanaMs, transmisiones: n.transmisiones }))
    .filter((x) => x.transmisiones > 0)
    .sort((a, b) => b.aireS - a.aireS)
    .slice(0, 6);
  const esperas = detalle.esperasGateway.map((x) => x / 1000);
  r.gateway = {
    ...r.gateway,
    esperaP50S: percentil(esperas, 50),
    esperaP95S: percentil(esperas, 95),
    esperaMaxS: esperas.length ? Math.max(...esperas) : 0,
    ocupadoPct: Math.min(100, (100 * ocupadoGw) / Math.max(1, gateways.length) / ventanaMs),
  };
  r.saturada = r.completosPct < UMBRAL_COMPLETOS_PCT;
  r.lenta = !r.saturada && r.latenciaS.p95 > ESPERA_MAXIMA_S;
  detalle.mensajes = mensajes.map((m) => ({ remitente: m.remitente, zona: zonaDe.get(m.remitente) ?? -1, t0: m.t0, latS: m.completo !== null ? (m.completo - m.t0) / 1000 : null, entregado: m.entregado }));
  detalle.spanMs = ventanaMs;
  detalle.nodos = nodos.map((n, k) => ({ aireMs: n.aire, transmisiones: n.transmisiones, ...porNodo[k], canalMs: n.infra ? canalDe(k) : null }));
  return { resultado: r, detalle };
}

export type PuntoCurva = { n: number; completosPct: number; p95S: number; canalPct: number; colisiones: number };

/** Se revienta con menos del 90 % completos; con más de un minuto de espera para el 95 %, aguanta pero lento. */
export const UMBRAL_COMPLETOS_PCT = 90;
export const ESPERA_MAXIMA_S = 60;

export type CurvaCargaResultado = {
  puntos: PuntoCurva[];
  /** Primer valor donde menos del 90 % completa: ahí se revienta. */
  quiebre: number | null;
  /** Último valor que aguanta sin demora (≥ 90 % y el 95 % en menos de un minuto). */
  seguro: number | null;
  /** Primer valor que aguanta, pero con más de un minuto de espera. */
  lento: number | null;
};

/**
 * Curva de carga: repite la prueba con más y más pagos al tiempo hasta que la red se revienta (menos del 90 % de
 * los pagos completos). Marca también desde cuándo aguanta pero lento (el 95 % tarda más de un minuto). Cada punto es
 * el promedio de `repeticiones` sorteos.
 */
export function curvaCarga(q: PedidoCarga, valores?: number[], repeticiones = 3): CurvaCargaResultado {
  const lista = valores ?? [5, 10, 15, 25, 40, 60, 80, 100, 130, 160, 200, 250, 300, 400, 500];
  const puntos: PuntoCurva[] = [];
  let quiebre: number | null = null;
  let seguro: number | null = null;
  let lento: number | null = null;
  let malos = 0;
  for (const n of lista) {
    let c = 0;
    let p95 = 0;
    let canal = 0;
    let col = 0;
    for (let k = 0; k < repeticiones; k++) {
      const x = simularCarga({ ...q, mensajes: n, semilla: q.semilla + 101 * k + n });
      if (x.motivo) return { puntos, quiebre, seguro, lento };
      c += x.completosPct;
      p95 += x.latenciaS.p95;
      canal += x.canalGatewayPct;
      col += x.colisiones;
    }
    const pt = { n, completosPct: c / repeticiones, p95S: p95 / repeticiones, canalPct: canal / repeticiones, colisiones: col / repeticiones };
    puntos.push(pt);
    const aguanta = pt.completosPct >= UMBRAL_COMPLETOS_PCT;
    if (quiebre === null) {
      if (!aguanta) quiebre = n;
      else if (pt.p95S <= ESPERA_MAXIMA_S && lento === null) seguro = n;
      else if (pt.p95S > ESPERA_MAXIMA_S && lento === null) lento = n;
    }
    if (!aguanta) malos++;
    // Dos puntos por debajo del 90 % y el último por debajo del 50 %: ya se reventó
    if (malos >= 2 && pt.completosPct < 50) break;
  }
  return { puntos, quiebre, seguro, lento };
}
