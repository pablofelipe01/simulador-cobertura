// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Prueba de carga de la malla MeshCore: N pagos (o mensajes de texto: WhatsApp, consultas a la IA) al tiempo y hasta
// dónde aguanta la frecuencia.
// Simulación por eventos del canal LoRa, nodo por nodo, con lo que hace el firmware de MeshCore: espera aleatoria de
// cada repetidor antes de retransmitir (txdelay 0,5 inundado y 0,3 directo), escucha antes de transmitir (si está
// recibiendo, espera 120–360 ms; a los 4 s transmite igual), ciclo de trabajo del 50 % por hora, cola de 32 paquetes
// en el repetidor y 16 en la billetera, deduplicación, ruta directa aprendida o inundación, acuses y 3 reintentos (el
// último por inundación). En el aire: un nodo que transmite no recibe; dos señales que se pisan en un receptor se
// pierden salvo que una le saque 6 dB a la otra (captura LoRa); y cada enlace pasa con la probabilidad de su margen.
// Las billeteras se oyen entre sí según la distancia (el análisis de la malla no calcula esos enlaces): se estima con
// el margen sobre terreno plano y el entorno; las que no se oyen no esperan a las otras (terminal oculto). Es una
// estimación para planear; se valida midiendo el canal en una red piloto.
import { margenPlanoDe } from "./alcance-plano";
import { presetPorId } from "./constantes";
import { bytesAcuse, bytesDatos, esperaAcuseMs, INTENTOS, probabilidadEnlace, RETARDO, tiempoEnAireMs } from "./mensaje";
import { generador } from "./poblar";
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

export type ResultadoCarga = {
  tipo: TipoCarga;
  modo: PedidoCarga["modo"];
  mensajes: number;
  /** Remitentes posibles (personas con ruta al gateway). */
  remitentes: number;
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
  /** Tiempo en el aire por pago completo en un enlace limpio (s), para comparar con el documento. */
  airePorPagoS: number;
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
};

type Envio = {
  id: number;
  mensaje: number;
  etapa: Etapa;
  origen: number;
  destino: number;
  /** Ruta conocida de origen a destino (repetidores intermedios), o null si no se conoce. */
  ruta: number[] | null;
  intento: number;
  confirmado: boolean;
  fallido: boolean;
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
};

type Nodo = {
  id: string;
  nombre: string;
  repite: boolean;
  pasarela: boolean;
  cola: { pk: Paquete; listo: number; prioridad: number }[];
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

const percentil = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.max(0, Math.ceil((p / 100) * o.length) - 1))];
};

/** Tiempo en el aire de un pago completo por una ruta de `saltos` enlaces, sin colisiones (s). */
function aireDePago(p: Parametros, saltos: number, conAviso: boolean): number {
  const preset = presetPorId(p.preset);
  let ms = 0;
  for (let k = 0; k < saltos; k++) {
    const r = Math.max(0, saltos - 1 - k);
    const par = (b: number) => tiempoEnAireMs(bytesDatos(b, r), preset) + tiempoEnAireMs(bytesAcuse(r), preset);
    ms += par(BYTES_PAGO.orden) + par(BYTES_PAGO.comprobante) + (conAviso ? par(BYTES_PAGO.aviso) : 0);
  }
  return ms / 1000;
}

/** Lo que pasó con cada pago y en cada nodo (para la prueba de estrés por repetidor). */
export type DetalleCarga = {
  /** Ids de los nodos activos, en el orden de los índices. */
  ids: string[];
  /** Por mensaje: el remitente, el nodo por el que entra a la malla (primer salto), cuándo salió y la espera (s, si completó). */
  mensajes: { remitente: number; zona: number; t0: number; latS: number | null; entregado: boolean }[];
  /** Por nodo: aire propio, transmisiones, recepciones perdidas y tiempo con el canal ocupado (solo gateway y repetidores). */
  nodos: { aireMs: number; transmisiones: number; colisiones: number; sordos: number; perdidasCola: number; esperasCanal: number; canalMs: number | null }[];
  /** Tiempo que se generaron pagos y tiempo total simulado (ms). */
  generacionMs: number;
  spanMs: number;
  /** Remitente → nodo por el que entra a la malla. */
  zonaDe: Map<number, number>;
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
  const azar = generador(q.semilla);
  const activos = q.antenas.filter((a) => a.activa);
  const idx = new Map(activos.map((a, i) => [a.id, i]));
  const nodosMalla = new Map(q.nodos.map((n) => [n.id, n]));
  const nodos: Nodo[] = activos.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    repite: a.rol === "REPETIDOR",
    pasarela: a.pasarela,
    cola: [],
    pool: a.rol === "REPETIDOR" ? 32 : 16,
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
  const porNodo = nodos.map(() => ({ colisiones: 0, sordos: 0, perdidasCola: 0, esperasCanal: 0 }));
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
  const esPersona = nodos.map((n) => !n.repite && !n.pasarela);
  const gLat = 111_320;
  const lat0 = activos.length ? activos.reduce((s, a) => s + a.lat, 0) / activos.length : 0;
  const cos0 = Math.cos((lat0 * Math.PI) / 180);
  const xs = activos.map((a) => a.lon * gLat * cos0);
  const ys = activos.map((a) => a.lat * gLat);
  const equipo = (a: Antena) => `${a.alturaM}|${a.potenciaDbm}|${a.gananciaDbi}|${a.perdidaCableDb}`;
  const curvas = new Map<string, (km: number) => number>();
  const curvaEntre = (a: Antena, b: Antena) => {
    const k = `${equipo(a)}>${equipo(b)}`;
    let c = curvas.get(k);
    if (!c) curvas.set(k, (c = margenPlanoDe(a, b, p)));
    return c;
  };
  const entrePersonas = new Map<number, number>();
  const margen = (t: number, r: number): number => {
    if (t === r) return -Infinity;
    const k = clave(t, r);
    const v = margenInfra.get(k);
    if (v !== undefined) return v;
    if (!esPersona[t] || !esPersona[r]) return -Infinity;
    const ya = entrePersonas.get(k);
    if (ya !== undefined) return ya;
    const dKm = Math.hypot(xs[t] - xs[r], ys[t] - ys[r]) / 1000;
    let m = dKm > MAX_KM_ENTRE_PERSONAS ? -Infinity : curvaEntre(activos[t], activos[r])(dKm);
    if (!(m > MARGEN_INAUDIBLE)) m = -Infinity;
    entrePersonas.set(k, m);
    return m;
  };

  // Remitentes: personas (que no retransmiten) con ruta al gateway
  const rutaDe = (i: number): { gateway: number; intermedios: number[] } | null => {
    const n = nodosMalla.get(nodos[i].id);
    if (!n || n.saltos === null || n.ruta.length < 2) return null;
    const ids = n.ruta.map((id) => idx.get(id));
    if (ids.some((x) => x === undefined)) return null;
    const g = ids[ids.length - 1]!;
    if (!nodos[g].pasarela) return null;
    return { gateway: g, intermedios: ids.slice(1, -1) as number[] };
  };
  const rutas = new Map<number, { gateway: number; intermedios: number[] }>();
  const remitentes: number[] = [];
  const zonaDe = new Map<number, number>();
  for (let i = 0; i < nodos.length; i++) {
    if (nodos[i].repite || nodos[i].pasarela) continue;
    const r = rutaDe(i);
    if (r) {
      rutas.set(i, r);
      remitentes.push(i);
      zonaDe.set(i, r.intermedios[0] ?? r.gateway);
    }
  }
  const saltosMedios = remitentes.length ? remitentes.reduce((s, i) => s + rutas.get(i)!.intermedios.length + 1, 0) / remitentes.length : 2;
  const generacionMs = q.modo === "rafaga" ? q.ventanaS * 1000 : q.duracionMin * 60_000;
  const base: ResultadoCarga = {
    tipo: q.tipo,
    modo: q.modo,
    mensajes: q.mensajes,
    remitentes: remitentes.length,
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
    colisiones: 0,
    sordos: 0,
    perdidasCola: 0,
    esperasCanal: 0,
    canalGatewayPct: 0,
    ocupacion: [],
    duracionS: 0,
    ventanaS: generacionMs / 1000,
    airePorPagoS: aireDePago(p, Math.round(saltosMedios), q.conAviso),
    saturada: false,
    lenta: false,
    motivo: null,
  };
  const detalle: DetalleCarga = {
    ids: nodos.map((n) => n.id),
    mensajes: [],
    nodos: nodos.map(() => ({ aireMs: 0, transmisiones: 0, colisiones: 0, sordos: 0, perdidasCola: 0, esperasCanal: 0, canalMs: null })),
    generacionMs,
    spanMs: 0,
    zonaDe,
  };
  if (!remitentes.length) return { resultado: { ...base, motivo: "No hay personas con ruta al gateway: ponga personas (o «Poblar personas») donde haya cobertura y simule." }, detalle };
  if (q.mensajes <= 0) return { resultado: { ...base, motivo: "Indique cuántos pagos o mensajes." }, detalle };

  const agenda = new Agenda();
  /** Señales al aire o que terminaron hace poco (todas las de la red; cada receptor ve las que oye). */
  let senales: Senal[] = [];
  let ahora = 0;
  let hash = 1;
  let nEnvio = 0;
  const envios = new Map<number, Envio>();
  const mensajes: Mensaje[] = [];
  const historial: [number, number, number][] = [];
  const r = base;

  const aireDe = (pk: Paquete) => {
    const largoRuta = pk.ruta.length;
    const bytes = pk.acuse ? (pk.ruteo === "inundacion" ? 12 + largoRuta : bytesAcuse(largoRuta)) : bytesDatos(pk.carga, largoRuta);
    return tiempoEnAireMs(bytes, preset);
  };

  const encolar = (i: number, pk: Paquete, listo: number, prioridad: number) => {
    const n = nodos[i];
    if (n.cola.length >= n.pool) {
      r.perdidasCola++;
      porNodo[i].perdidasCola++;
      return;
    }
    n.cola.push({ pk, listo, prioridad });
    if (!n.intentando) {
      n.intentando = true;
      agenda.poner(Math.max(ahora, listo), () => intentar(i));
    }
  };

  /** Escucha antes de transmitir: ¿hay una señal al aire que este nodo oye? */
  const recibiendo = (i: number) => {
    for (const s of senales) if (s.ini <= ahora && s.fin > ahora && s.tx !== i && margen(s.tx, i) >= 0) return true;
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
    // Ciclo de trabajo (presupuesto de aire por hora)
    n.presupuesto = Math.min(VENTANA_CICLO_MS * CICLO, n.presupuesto + (ahora - n.ultimoPresupuesto) * CICLO);
    n.ultimoPresupuesto = ahora;
    const minimo = tiempoEnAireMs(255, preset) / 2;
    if (n.presupuesto < minimo) {
      n.intentando = true;
      agenda.poner(ahora + (minimo - n.presupuesto) / CICLO, () => intentar(i));
      return;
    }
    // Escucha antes de transmitir
    if (recibiendo(i)) {
      if (n.cadDesde === null) n.cadDesde = ahora;
      if (ahora - n.cadDesde < 4000) {
        r.esperasCanal++;
        porNodo[i].esperasCanal++;
        n.intentando = true;
        agenda.poner(ahora + 120 * (1 + Math.floor(azar() * 3)), () => intentar(i));
        return;
      }
    }
    n.cadDesde = null;
    const { pk } = n.cola.splice(mejor, 1)[0];
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
    senales.push({ tx: i, ini, fin, m: 0 });
    // Limpieza de señales viejas (ningún paquete dura más de unos segundos)
    if ((r.transmisiones & 63) === 0) senales = senales.filter((s) => s.fin > ahora - 20_000);
    agenda.poner(fin, () => finTx(i, pk, ini, fin));
  };

  /** Quienes podían necesitar el paquete: el siguiente de la ruta, el destino o los repetidores que lo inundarían. */
  const interesados = (i: number, pk: Paquete): number[] => {
    if (pk.ruteo === "directa") return [pk.ruta.length ? pk.ruta[0] : pk.destino];
    const lista: number[] = [];
    for (const k of repetidores) if (k !== i && !nodos[k].vistos.has(pk.hash)) lista.push(k);
    if (!nodos[pk.destino].repite && pk.destino !== i) lista.push(pk.destino);
    return lista;
  };

  const finTx = (i: number, pk: Paquete, ini: number, fin: number) => {
    for (const rxI of interesados(i, pk)) {
      const m = margen(i, rxI);
      if (!(m >= 0)) continue;
      const rx = nodos[rxI];
      // Semidúplex: si el receptor transmitió durante este paquete, no lo oyó
      if (rx.propias.some(([a, b]) => a < fin && b > ini)) {
        r.sordos++;
        porNodo[rxI].sordos++;
        continue;
      }
      // Dos señales que se pisan en el receptor se pierden, salvo que esta le saque 6 dB a la otra (captura)
      let choque = false;
      for (const s of senales) {
        if (s.tx === i || s.tx === rxI || s.ini >= fin || s.fin <= ini) continue;
        if (margen(s.tx, rxI) > m - 6) {
          choque = true;
          break;
        }
      }
      if (choque) {
        r.colisiones++;
        porNodo[rxI].colisiones++;
        continue;
      }
      if (azar() > probabilidadEnlace(m)) continue;
      recibir(rxI, pk);
    }
    const n = nodos[i];
    if (!n.intentando && n.cola.length) {
      n.intentando = true;
      agenda.poner(ahora, () => intentar(i));
    }
  };

  const enviar = (e: Envio, ruteo: "directa" | "inundacion") => {
    const pk: Paquete = { hash: hash++, acuse: false, ruteo, origen: e.origen, destino: e.destino, ruta: ruteo === "directa" && e.ruta ? [...e.ruta] : [], carga: cargaDe(e.etapa), envio: e.id };
    if (ruteo === "inundacion") r.inundaciones++;
    nodos[e.origen].vistos.add(pk.hash);
    encolar(e.origen, pk, ahora, ruteo === "directa" ? 0 : 1);
    const aire = aireDe(pk);
    const saltos = (e.ruta?.length ?? 2) + 1;
    agenda.poner(ahora + esperaAcuseMs(aire, saltos, ruteo), () => vencio(e));
  };

  const cargaDe = (etapa: Etapa) =>
    etapa === "orden" ? BYTES_PAGO.orden : etapa === "comprobante" ? BYTES_PAGO.comprobante : etapa === "aviso" ? BYTES_PAGO.aviso : q.caracteres;

  const nuevoEnvio = (mensaje: number, etapa: Etapa, origen: number, destino: number, ruta: number[] | null, retraso = 0) => {
    const e: Envio = { id: nEnvio++, mensaje, etapa, origen, destino, ruta, intento: 1, confirmado: false, fallido: false };
    envios.set(e.id, e);
    agenda.poner(ahora + retraso, () => enviar(e, e.ruta ? "directa" : "inundacion"));
    return e;
  };

  const vencio = (e: Envio) => {
    if (e.confirmado || e.fallido) return;
    if (e.intento >= INTENTOS) {
      e.fallido = true;
      return;
    }
    e.intento++;
    r.reintentos++;
    if (e.etapa === "orden" || e.etapa === "texto") mensajes[e.mensaje].primerIntento = false;
    // El último reintento olvida la ruta e inunda
    if (e.intento === INTENTOS) e.ruta = null;
    // La app reintenta cuando vence la espera; el celular, el Bluetooth (o el USB del gateway) le suman un retraso
    // variable, que desincroniza a dos que chocaron sin oírse
    const pk = { carga: cargaDe(e.etapa), ruta: e.ruta ?? [] };
    const aire = tiempoEnAireMs(bytesDatos(pk.carga, pk.ruta.length), preset);
    agenda.poner(ahora + azar() * Math.max(500, aire), () => enviar(e, e.ruta ? "directa" : "inundacion"));
  };

  const acusar = (desde: number, pk: Paquete, rutaVuelta: number[]) => {
    const e = envios.get(pk.envio);
    if (!e) return;
    const ack: Paquete = { hash: hash++, acuse: true, ruteo: pk.ruteo, origen: desde, destino: pk.origen, ruta: pk.ruteo === "directa" ? rutaVuelta : [], carga: 0, envio: pk.envio };
    nodos[desde].vistos.add(ack.hash);
    // TXT_ACK_DELAY: 200 ms
    agenda.poner(ahora + 200, () => encolar(desde, ack, ahora, pk.ruteo === "directa" ? 0 : 1));
  };

  const llegada = (i: number, pk: Paquete, rutaRecorrida: number[]) => {
    const e = envios.get(pk.envio);
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
        nuevoEnvio(e.mensaje, "comprobante", i, m.remitente, haciaPersona, q.servidorMs);
        if (q.conAviso && m.receptor >= 0) {
          r.avisosPedidos++;
          const rr = rutas.get(m.receptor);
          nuevoEnvio(e.mensaje, "aviso", i, m.receptor, rr ? [...rr.intermedios].reverse() : null, q.servidorMs + 300);
        }
      } else if (q.respuesta) nuevoEnvio(e.mensaje, "respuesta", i, m.remitente, haciaPersona, q.servidorMs);
      else m.completo = ahora;
    } else if (e.etapa === "comprobante" || e.etapa === "respuesta") {
      if (m.completo === null) m.completo = ahora;
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
    const ru = rutas.get(remitente)!;
    let receptor = -1;
    if (q.tipo === "pago" && remitentes.length > 1) {
      do receptor = remitentes[Math.floor(azar() * remitentes.length)];
      while (receptor === remitente);
    }
    mensajes.push({ remitente, receptor, gateway: ru.gateway, t0, entregado: false, completo: null, aviso: false, primerIntento: true, respondido: false });
    agenda.poner(t0, () => {
      ahora = t0;
      nuevoEnvio(k, q.tipo === "pago" ? "orden" : "texto", remitente, ru.gateway, q.rutaConocida ? [...ru.intermedios] : null);
    });
  });

  // Simulación
  const limite = (q.modo === "rafaga" ? q.ventanaS * 1000 : q.duracionMin * 60_000) + 15 * 60_000;
  let pasos = 0;
  while (!agenda.vacia && pasos < 2_000_000) {
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
  r.saturada = r.completosPct < UMBRAL_COMPLETOS_PCT;
  r.lenta = !r.saturada && r.latenciaS.p95 > ESPERA_MAXIMA_S;
  detalle.mensajes = mensajes.map((m) => ({ remitente: m.remitente, zona: zonaDe.get(m.remitente) ?? m.gateway, t0: m.t0, latS: m.completo !== null ? (m.completo - m.t0) / 1000 : null, entregado: m.entregado }));
  detalle.spanMs = ventanaMs;
  detalle.nodos = nodos.map((n, k) => ({ aireMs: n.aire, transmisiones: n.transmisiones, ...porNodo[k], canalMs: n.repite || n.pasarela ? canalDe(k) : null }));
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
