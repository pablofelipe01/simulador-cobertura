// Prueba de estrés de la malla en la hora pico, repetidor por repetidor («zonas de popularidad»). Cada persona hace
// sus pagos del día y una parte cae en la hora pico (Trama: 15 % un día normal, 25 % un día de mercado). Se simula el
// canal paquete por paquete (la prueba de carga de MeshCore) y se mide en cada gateway y repetidor: cuántas personas
// entran a la malla por él, cuántos pagos completan, cuánto esperan, qué tanto del canal oye ocupado, cuánto
// transmite frente al tope del ciclo de trabajo, cuántos paquetes pierde, hasta dónde llega con esa carga frente a su
// alcance sin carga y cuánta energía gasta el repetidor solar. La rampa multiplica la carga hasta encontrar dónde se
// revienta cada zona y cuántas personas aguanta. Son estimaciones para planear; se validan midiendo una red piloto.
import { ESPERA_MAXIMA_S, simularCargaDetalle, UMBRAL_COMPLETOS_PCT, BYTES_PAGO, type DetalleCarga, type PedidoCarga } from "./carga";
import { PRESETS, presetPorId, type PresetId } from "./constantes";
import { distanciaM } from "./geo";
import { analizarMalla } from "./malla";
import { airePagoMs } from "./mensaje";
import { claseEnlace } from "./modelo";
import { CAPACIDAD_TRAMA, SF_TRAMA } from "./trama";
import type { Antena, Enlace, NodoMalla, Parametros } from "./tipos";

/**
 * Pagos por persona al día que supone el diseño de Trama: 55 pagos por hora por frecuencia con 150 usuarios y el 15 %
 * de los pagos del día en la hora pico → 55 ÷ (150 × 0,15) ≈ 2,4.
 */
export const PAGOS_PERSONA_DIA_TRAMA = SF_TRAMA[11].pagosHora / ((SF_TRAMA[11].usuariosFrecuencia * CAPACIDAD_TRAMA.horaPicoNormalPct) / 100);

/**
 * Energía del repetidor solar SenseCAP P1 (supuestos de cálculo): el SX1262 a 22 dBm con el nRF52840 gasta ~0,45 W al
 * transmitir y ~0,03 W escuchando; el panel de 5 W rinde ~4 horas de sol pleno al día con 70 % de eficiencia de
 * carga; 4 pilas 18650 de ~3.000 mAh a 3,6 V, usando el 80 %.
 */
export const ENERGIA_P1 = { txW: 0.45, rxW: 0.03, panelW: 5, horasSol: 4, eficiencia: 0.7, bateriaWh: 4 * 3 * 3.6 * 0.8 } as const;

/** Tope del ciclo de trabajo del repetidor (% del tiempo transmitiendo por hora) en el modelo de carga. */
export const TOPE_CICLO_PCT = 50;

export type PedidoEstres = {
  antenas: Antena[];
  enlaces: Enlace[];
  nodos: NodoMalla[];
  parametros: Parametros;
  /** Pagos que hace cada persona al día (Trama ≈ 2,4). */
  pagosPersonaDia: number;
  /** Parte de los pagos del día que cae en la hora pico (%): 15 normal, 25 día de mercado. */
  horaPicoPct: number;
  /** Multiplica la carga de la hora pico (1 = la hora pico tal cual). */
  factor: number;
  /** Minutos de la hora pico que se simulan. */
  duracionMin: number;
  rutaConocida: boolean;
  conAviso: boolean;
  semilla: number;
  /** Subir la carga hasta que cada zona se reviente. */
  rampa: boolean;
  /** Probar la misma hora pico con los otros ajustes de radio. */
  comparar: boolean;
};

export const PEDIDO_ESTRES_DEFECTO: Omit<PedidoEstres, "antenas" | "enlaces" | "nodos" | "parametros"> = {
  pagosPersonaDia: Math.round(PAGOS_PERSONA_DIA_TRAMA * 10) / 10,
  horaPicoPct: CAPACIDAD_TRAMA.horaPicoNormalPct,
  factor: 1,
  duracionMin: 30,
  rutaConocida: true,
  conAviso: true,
  semilla: 11,
  rampa: false,
  comparar: false,
};

export type EstadoZona = "aguanta" | "lento" | "revienta" | "sin-pagos";

/** Lo que limita a una zona: canal lleno, tope del ciclo de trabajo, cola llena, choques, alcance o energía. */
export type LimiteZona = "canal" | "ciclo" | "cola" | "choques" | "alcance" | "energia";

export type EnergiaZona = {
  /** Consumo al día (Wh) con la carga de esta prueba repartida en el día. */
  consumoWhDia: number;
  /** Lo que el panel repone en un día (Wh). */
  generaWhDia: number;
  bateriaWh: number;
  /** Días que aguanta con la batería sin sol. */
  autonomiaDias: number;
  alcanza: boolean;
};

export type ZonaEstres = {
  id: string;
  nombre: string;
  pieza: "gateway" | "repetidor";
  /** Personas que entran a la malla por este nodo (es su primer salto). */
  usuarios: number;
  /** Personas cuyos pagos pasan por este nodo (las suyas y las de más allá). */
  usuariosRuta: number;
  /** Pagos por hora que piden sus personas en la hora pico (con el multiplicador). */
  pagosHora: number;
  /** Pagos simulados de sus personas y cuántos volvieron con comprobante. */
  pagos: number;
  completos: number;
  completosPct: number;
  p50S: number;
  p95S: number;
  /** % del tiempo con alguna señal al aire que este nodo oye (o la suya). */
  canalPct: number;
  /** % del tiempo que este nodo transmite (el tope es el 50 %). */
  txPct: number;
  colisiones: number;
  sordos: number;
  perdidasCola: number;
  /** La persona más lejana que atiende (km) y hasta dónde completa el 90 % con esta carga (km; igual si llega a todos). */
  alcanceKm: number;
  alcanceCargaKm: number | null;
  /** Radio que encierra al 90 % de sus personas (km): el tamaño de la zona en el mapa. */
  radioZonaKm: number;
  /** Aire que gasta cada una de sus personas en la hora pico (s) y qué parte del canal es (%). */
  airePersonaS: number;
  canalPersonaPct: number;
  energia: EnergiaZona | null;
  estado: EstadoZona;
  limites: LimiteZona[];
  /** Rampa: desde qué multiplicador va lento y desde cuál se revienta; personas y pagos por hora que aguanta. */
  factorLento?: number | null;
  factorQuiebre?: number | null;
  usuariosMax?: number | null;
  pagosHoraMax?: number | null;
  /** La rampa no alcanzó a reventarla: aguanta al menos `usuariosMax`. */
  aguantaTodo?: boolean;
};

export type PuntoRampa = {
  factor: number;
  /** Personas equivalentes (las de la red × multiplicador) y pagos por hora pedidos y entregados. */
  usuarios: number;
  pedidosHora: number;
  entregadosHora: number;
  completosPct: number;
  p95S: number;
  canalPct: number;
  zonasRotas: number;
};

export type AjusteEstres = {
  preset: PresetId;
  nombre: string;
  actual: boolean;
  /** Personas que conservan ruta al gateway con este ajuste. */
  conRuta: number;
  completosPct: number;
  p95S: number;
  canalPct: number;
  estado: EstadoZona;
  velocidadKbps: number;
};

export type ResultadoEstres = {
  pagosPersonaDia: number;
  horaPicoPct: number;
  factor: number;
  duracionMin: number;
  preset: { id: PresetId; nombre: string; velocidadKbps: number };
  /** Personas con ruta al gateway. */
  usuarios: number;
  pedidosHora: number;
  entregadosHora: number;
  pagos: number;
  completosPct: number;
  p50S: number;
  p95S: number;
  canalGatewayPct: number;
  /** Bits de pagos entregados por segundo y velocidad del canal (bps). */
  utilBps: number;
  canalBps: number;
  /** Aire de un pago limpio por la ruta típica (s). */
  airePorPagoS: number;
  estado: EstadoZona;
  zonas: ZonaEstres[];
  rampa: null | {
    puntos: PuntoRampa[];
    /** Multiplicador hasta el que toda la malla aguanta sin demora, desde cuál va lenta y desde cuál se revienta. */
    factorSeguro: number | null;
    factorLento: number | null;
    factorQuiebre: number | null;
    /** Personas que aguanta la malla (sin demora) y los pagos por hora que entrega como máximo. */
    usuariosMax: number | null;
    maxEntregadosHora: number;
    /** La zona que se revienta primero. */
    primera: string | null;
  };
  ajustes: AjusteEstres[] | null;
  motivo: string | null;
};

const percentil = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.max(0, Math.ceil((p / 100) * o.length) - 1))];
};

const estadoDe = (pagos: number, completosPct: number, p95S: number): EstadoZona =>
  pagos === 0 ? "sin-pagos" : completosPct < UMBRAL_COMPLETOS_PCT ? "revienta" : p95S > ESPERA_MAXIMA_S ? "lento" : "aguanta";

/** Pagos que se simulan: los de la hora pico de todas las personas, en `duracionMin` minutos. */
function pagosSimulados(q: PedidoEstres, usuarios: number, factor: number) {
  const porHora = usuarios * q.pagosPersonaDia * (q.horaPicoPct / 100) * factor;
  return { porHora, n: Math.round((porHora * q.duracionMin) / 60) };
}

function pedidoCarga(q: PedidoEstres, mensajes: number, semilla: number, parametros = q.parametros, enlaces = q.enlaces, nodos = q.nodos): PedidoCarga {
  return {
    antenas: q.antenas,
    enlaces,
    nodos,
    parametros,
    tipo: "pago",
    mensajes,
    modo: "continua",
    ventanaS: 10,
    duracionMin: q.duracionMin,
    rutaConocida: q.rutaConocida,
    conAviso: q.conAviso,
    caracteres: 60,
    respuesta: true,
    servidorMs: 1500,
    semilla,
  };
}

type Corrida = { detalle: DetalleCarga; completosPct: number; p50S: number; p95S: number; canalGatewayPct: number; pagos: number; completos: number; airePorPagoS: number; remitentes: number; motivo: string | null };

function correr(q: PedidoEstres, factor: number, repeticiones: number, parametros = q.parametros, enlaces = q.enlaces, nodos = q.nodos): Corrida[] {
  const salida: Corrida[] = [];
  // Cuántas personas tienen ruta (lo dice la primera corrida, con un pago de prueba)
  const sonda = simularCargaDetalle(pedidoCarga(q, 1, q.semilla, parametros, enlaces, nodos));
  if (sonda.resultado.motivo) return [{ detalle: sonda.detalle, completosPct: 0, p50S: 0, p95S: 0, canalGatewayPct: 0, pagos: 0, completos: 0, airePorPagoS: 0, remitentes: 0, motivo: sonda.resultado.motivo }];
  const { n } = pagosSimulados(q, sonda.resultado.remitentes, factor);
  for (let k = 0; k < repeticiones; k++) {
    const x = simularCargaDetalle(pedidoCarga(q, Math.max(1, n), q.semilla + 977 * k + Math.round(factor * 1000), parametros, enlaces, nodos));
    salida.push({
      detalle: x.detalle,
      completosPct: x.resultado.completosPct,
      p50S: x.resultado.latenciaS.p50,
      p95S: x.resultado.latenciaS.p95,
      canalGatewayPct: x.resultado.canalGatewayPct,
      pagos: x.resultado.mensajes,
      completos: x.resultado.completos,
      airePorPagoS: x.resultado.airePorPagoS,
      remitentes: x.resultado.remitentes,
      motivo: x.resultado.motivo,
    });
  }
  return salida;
}

/** Métricas por zona (gateway o repetidor) de una o varias corridas con la misma carga. */
function zonas(q: PedidoEstres, corridas: Corrida[], factor: number): ZonaEstres[] {
  const d0 = corridas[0].detalle;
  const porId = new Map(q.antenas.map((a) => [a.id, a]));
  const nodosMalla = new Map(q.nodos.map((n) => [n.id, n]));
  const preset = presetPorId(q.parametros.preset);
  const indices = d0.ids.map((id, i) => ({ id, i, a: porId.get(id)! })).filter((x) => x.a && (x.a.rol === "REPETIDOR" || x.a.pasarela));
  // Personas por zona (primer salto) y por ruta
  const usuarios = new Map<number, number[]>();
  for (const [rem, z] of d0.zonaDe) usuarios.set(z, [...(usuarios.get(z) ?? []), rem]);
  const enRuta = new Map<string, number>();
  for (const rem of d0.zonaDe.keys()) for (const id of nodosMalla.get(d0.ids[rem])?.ruta.slice(1) ?? []) enRuta.set(id, (enRuta.get(id) ?? 0) + 1);
  const distancia = (rem: number, z: number) => {
    const a = porId.get(d0.ids[rem])!;
    const b = porId.get(d0.ids[z])!;
    return distanciaM(a.lat, a.lon, b.lat, b.lon) / 1000;
  };
  return indices.map(({ id, i, a }) => {
    const suyos = usuarios.get(i) ?? [];
    const lat: number[] = [];
    const porDistancia: { km: number; ok: boolean }[] = [];
    let pagos = 0;
    let completos = 0;
    let canal = 0;
    let tx = 0;
    let span = 0;
    let colisiones = 0;
    let sordos = 0;
    let perdidasCola = 0;
    for (const c of corridas) {
      const dn = c.detalle.nodos[i];
      canal += dn.canalMs ?? 0;
      tx += dn.aireMs;
      span += c.detalle.spanMs;
      colisiones += dn.colisiones;
      sordos += dn.sordos;
      perdidasCola += dn.perdidasCola;
      for (const m of c.detalle.mensajes) {
        if (m.zona !== i) continue;
        pagos++;
        if (m.latS !== null) {
          completos++;
          lat.push(m.latS);
        }
        porDistancia.push({ km: distancia(m.remitente, i), ok: m.latS !== null });
      }
    }
    const reps = corridas.length;
    const completosPct = pagos ? (100 * completos) / pagos : 0;
    const p50S = percentil(lat, 50);
    const p95S = percentil(lat, 95);
    const canalPct = span ? Math.min(100, (100 * canal) / span) : 0;
    const txPct = span ? Math.min(100, (100 * tx) / span) : 0;
    const distancias = suyos.map((rem) => distancia(rem, i)).sort((a, b) => a - b);
    const alcanceKm = distancias.length ? distancias[distancias.length - 1] : 0;
    const radioZonaKm = Math.max(0.3, percentil(distancias, 90));
    // Alcance con carga: del más cercano al más lejano de los que pagaron, hasta dónde completa el 90 % (tramos de
    // al menos 6 pagos). Si todos los tramos completan, con esta carga llega a todos.
    let alcanceCargaKm: number | null = null;
    let lejosMuestra = 0;
    if (porDistancia.length >= 6) {
      porDistancia.sort((x, y) => x.km - y.km);
      lejosMuestra = porDistancia[porDistancia.length - 1].km;
      const tramos = Math.max(1, Math.min(5, Math.floor(porDistancia.length / 6)));
      const largo = Math.ceil(porDistancia.length / tramos);
      alcanceCargaKm = 0;
      let todos = true;
      for (let t = 0; t < tramos; t++) {
        const tramo = porDistancia.slice(t * largo, (t + 1) * largo);
        if (!tramo.length) break;
        const ok = tramo.filter((x) => x.ok).length / tramo.length;
        if (ok * 100 < UMBRAL_COMPLETOS_PCT) {
          todos = false;
          break;
        }
        alcanceCargaKm = tramo[tramo.length - 1].km;
      }
      if (todos) alcanceCargaKm = alcanceKm;
    }
    // Aire de una persona en la hora pico: sus pagos por hora × el aire de un pago por su ruta
    const saltosMedios = suyos.length ? suyos.reduce((s, rem) => s + Math.max(1, (nodosMalla.get(d0.ids[rem])?.ruta.length ?? 2) - 1), 0) / suyos.length : 1;
    const airePago = airePagoMs(preset, Math.max(1, Math.round(saltosMedios)), BYTES_PAGO.orden, BYTES_PAGO.comprobante, q.conAviso ? BYTES_PAGO.aviso : 0) / 1000;
    const pagosPersonaHora = q.pagosPersonaDia * (q.horaPicoPct / 100) * factor;
    const airePersonaS = pagosPersonaHora * airePago;
    // Energía del repetidor solar: la transmisión de la hora pico es el `horaPicoPct` del día
    let energia: EnergiaZona | null = null;
    if (a.rol === "REPETIDOR") {
      // Horas al aire en el día: las de la hora pico divididas por la parte del día que es la hora pico
      const txHoraPicoH = span ? tx / span : 0;
      const txDiaH = Math.min(24 * (TOPE_CICLO_PCT / 100), txHoraPicoH / (q.horaPicoPct / 100));
      const consumoWhDia = ENERGIA_P1.txW * txDiaH + ENERGIA_P1.rxW * (24 - txDiaH);
      const generaWhDia = ENERGIA_P1.panelW * ENERGIA_P1.horasSol * ENERGIA_P1.eficiencia;
      energia = { consumoWhDia, generaWhDia, bateriaWh: ENERGIA_P1.bateriaWh, autonomiaDias: ENERGIA_P1.bateriaWh / Math.max(0.01, consumoWhDia), alcanza: consumoWhDia <= generaWhDia };
    }
    const estado = estadoDe(pagos, completosPct, p95S);
    const limites: LimiteZona[] = [];
    if (canalPct >= 60) limites.push("canal");
    if (txPct >= TOPE_CICLO_PCT * 0.9) limites.push("ciclo");
    if (perdidasCola > 0) limites.push("cola");
    if (pagos && colisiones / reps > pagos / reps) limites.push("choques");
    // Pierde alcance: los cercanos completan y los lejanos no (si ni los cercanos completan, es el canal, no la distancia)
    if (alcanceCargaKm !== null && alcanceCargaKm > 0 && lejosMuestra > 0.3 && alcanceCargaKm < 0.8 * lejosMuestra) limites.push("alcance");
    if (energia && !energia.alcanza) limites.push("energia");
    return {
      id,
      nombre: a.nombre,
      pieza: a.pasarela ? "gateway" : "repetidor",
      usuarios: suyos.length,
      usuariosRuta: a.pasarela ? d0.zonaDe.size : (enRuta.get(id) ?? 0),
      pagosHora: suyos.length * pagosPersonaHora,
      pagos: Math.round(pagos / reps),
      completos: Math.round(completos / reps),
      completosPct,
      p50S,
      p95S,
      canalPct,
      txPct,
      colisiones: Math.round(colisiones / reps),
      sordos: Math.round(sordos / reps),
      perdidasCola: Math.round(perdidasCola / reps),
      alcanceKm,
      alcanceCargaKm,
      radioZonaKm,
      airePersonaS,
      canalPersonaPct: (100 * airePersonaS) / 3600,
      energia,
      estado,
      limites,
    } satisfies ZonaEstres;
  });
}

function resumen(corridas: Corrida[]) {
  let pagos = 0;
  let completos = 0;
  let canal = 0;
  const lat: number[] = [];
  for (const c of corridas) {
    pagos += c.pagos;
    completos += c.completos;
    canal += c.canalGatewayPct;
    for (const m of c.detalle.mensajes) if (m.latS !== null) lat.push(m.latS);
  }
  const completosPct = pagos ? (100 * completos) / pagos : 0;
  return { pagos: pagos / corridas.length, completos: completos / corridas.length, completosPct, p50S: percentil(lat, 50), p95S: percentil(lat, 95), canalPct: canal / corridas.length };
}

/** Enlaces con otro ajuste de radio: el margen cambia lo que cambia la sensibilidad del receptor. */
function enlacesCon(enlaces: Enlace[], de: PresetId, a: PresetId): Enlace[] {
  const delta = presetPorId(de).sensibilidadDbm - presetPorId(a).sensibilidadDbm;
  if (!delta) return enlaces;
  return enlaces.map((e) => {
    const margen = e.margen + delta;
    return { ...e, margenAB: e.margenAB + delta, margenBA: e.margenBA + delta, margen, clase: claseEnlace(margen) };
  });
}

/**
 * Prueba de estrés de la hora pico: todas las personas pagan a su ritmo y se mide cada zona (gateway y repetidores).
 * Con `rampa`, sube la carga hasta encontrar dónde se revienta cada zona; con `comparar`, repite la hora pico con los
 * otros ajustes de radio (más alcance o más capacidad).
 */
export function estresMalla(q: PedidoEstres, progreso?: (avance: number) => void): ResultadoEstres {
  const preset = presetPorId(q.parametros.preset);
  const repeticiones = 2;
  const base = correr(q, q.factor, repeticiones);
  const c0 = base[0];
  const vacio: ResultadoEstres = {
    pagosPersonaDia: q.pagosPersonaDia,
    horaPicoPct: q.horaPicoPct,
    factor: q.factor,
    duracionMin: q.duracionMin,
    preset: { id: preset.id, nombre: preset.nombre, velocidadKbps: preset.velocidadKbps },
    usuarios: 0,
    pedidosHora: 0,
    entregadosHora: 0,
    pagos: 0,
    completosPct: 0,
    p50S: 0,
    p95S: 0,
    canalGatewayPct: 0,
    utilBps: 0,
    canalBps: preset.velocidadKbps * 1000,
    airePorPagoS: 0,
    estado: "sin-pagos",
    zonas: [],
    rampa: null,
    ajustes: null,
    motivo: null,
  };
  if (c0.motivo) return { ...vacio, motivo: c0.motivo };
  const usuarios = c0.remitentes;
  const { porHora } = pagosSimulados(q, usuarios, q.factor);
  const g = resumen(base);
  const horas = q.duracionMin / 60;
  const bitsPago = 8 * (BYTES_PAGO.orden + BYTES_PAGO.comprobante + (q.conAviso ? BYTES_PAGO.aviso : 0));
  const res: ResultadoEstres = {
    ...vacio,
    usuarios,
    pedidosHora: porHora,
    entregadosHora: g.completos / horas,
    pagos: Math.round(g.pagos),
    completosPct: g.completosPct,
    p50S: g.p50S,
    p95S: g.p95S,
    canalGatewayPct: g.canalPct,
    utilBps: (g.completos * bitsPago) / (q.duracionMin * 60),
    airePorPagoS: c0.airePorPagoS,
    estado: estadoDe(Math.round(g.pagos), g.completosPct, g.p95S),
    zonas: zonas(q, base, q.factor),
  };
  const pasosComparar = q.comparar ? PRESETS.length : 0;
  let hechos = 1;
  const total = 1 + (q.rampa ? 10 : 0) + pasosComparar;
  progreso?.(hechos / total);

  if (q.rampa) {
    const puntos = new Map<number, { punto: PuntoRampa; zonas: ZonaEstres[] }>();
    const evaluar = (f: number) => {
      const cs = f === q.factor ? base : correr(q, f, repeticiones);
      const r = resumen(cs);
      const zs = f === q.factor ? res.zonas : zonas(q, cs, f);
      const punto: PuntoRampa = {
        factor: f,
        usuarios: usuarios * f,
        pedidosHora: pagosSimulados(q, usuarios, f).porHora,
        entregadosHora: r.completos / horas,
        completosPct: r.completosPct,
        p95S: r.p95S,
        canalPct: r.canalPct,
        zonasRotas: zs.filter((z) => z.estado === "revienta").length,
      };
      puntos.set(f, { punto, zonas: zs });
      hechos++;
      progreso?.(Math.min(0.99, hechos / total));
      return punto;
    };
    // Hacia abajo hasta que todas las zonas aguanten sin demora; hacia arriba hasta que la malla se reviente del todo
    const conDatos = (f: number) => pagosSimulados(q, usuarios, f).n >= 3;
    const todoBien = (f: number) => {
      const x = puntos.get(f)!;
      return x.punto.completosPct >= UMBRAL_COMPLETOS_PCT && x.punto.p95S <= ESPERA_MAXIMA_S && x.zonas.every((z) => z.pagos < 4 || z.estado === "aguanta");
    };
    evaluar(q.factor);
    if (!todoBien(q.factor))
      for (const k of [0.5, 0.25, 0.125, 0.0625, 0.03125]) {
        const f = q.factor * k;
        if (!conDatos(f)) break;
        evaluar(f);
        if (todoBien(f)) break;
      }
    let malos = 0;
    for (const k of [1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32]) {
      const f = q.factor * k;
      if (pagosSimulados(q, usuarios, f).n > 9000) break;
      const pt = evaluar(f);
      if (pt.completosPct < UMBRAL_COMPLETOS_PCT) malos++;
      if (malos >= 2 && (pt.completosPct < 40 || res.zonas.every((z) => puntos.get(f)!.zonas.find((x) => x.id === z.id)?.estado !== "aguanta"))) break;
    }
    const orden = [...puntos.keys()].sort((a, b) => a - b);
    const lista = orden.map((f) => puntos.get(f)!.punto);
    let factorSeguro: number | null = null;
    let factorLento: number | null = null;
    let factorQuiebre: number | null = null;
    for (const pt of lista) {
      if (factorQuiebre !== null) break;
      if (pt.completosPct < UMBRAL_COMPLETOS_PCT) factorQuiebre = pt.factor;
      else if (pt.p95S > ESPERA_MAXIMA_S) factorLento ??= pt.factor;
      else if (factorLento === null) factorSeguro = pt.factor;
    }
    // Por zona: el primer multiplicador donde se revienta y el último que aguanta sin demora antes de eso
    for (const z of res.zonas) {
      let seguro: number | null = null;
      let lento: number | null = null;
      let quiebre: number | null = null;
      for (const f of orden) {
        const x = puntos.get(f)!.zonas.find((y) => y.id === z.id);
        // Con muy pocos pagos en la zona el sorteo no dice nada
        if (!x || x.pagos < 4) continue;
        if (x.estado === "revienta") {
          quiebre = f;
          break;
        }
        if (x.estado === "lento") lento ??= f;
        else if (lento === null) seguro = f;
      }
      z.factorLento = lento;
      z.factorQuiebre = quiebre;
      z.usuariosMax = seguro !== null ? Math.round(z.usuarios * seguro) : null;
      z.pagosHoraMax = seguro !== null ? z.pagosHora * (seguro / q.factor) : null;
      z.aguantaTodo = quiebre === null && lento === null && seguro !== null;
    }
    const conQuiebre = res.zonas.filter((z) => z.factorQuiebre !== null && z.factorQuiebre !== undefined && z.usuarios > 0);
    const primera = conQuiebre.sort((a, b) => a.factorQuiebre! - b.factorQuiebre! || a.completosPct - b.completosPct)[0] ?? null;
    res.rampa = {
      puntos: lista,
      factorSeguro,
      factorLento,
      factorQuiebre,
      usuariosMax: factorSeguro !== null ? Math.round(usuarios * factorSeguro) : null,
      maxEntregadosHora: Math.max(...lista.map((x) => x.entregadosHora)),
      primera: primera?.nombre ?? null,
    };
  }

  if (q.comparar) {
    const ajustes: AjusteEstres[] = [];
    for (const otro of [...PRESETS].sort((a, b) => b.velocidadKbps - a.velocidadKbps)) {
      const parametros = { ...q.parametros, preset: otro.id };
      const enlaces = enlacesCon(q.enlaces, preset.id, otro.id);
      const nodos = otro.id === preset.id ? q.nodos : analizarMalla(q.antenas.filter((a) => a.activa), enlaces, q.parametros.limiteSaltos).nodos;
      const cs = otro.id === preset.id ? base : correr({ ...q, parametros }, q.factor, 1, parametros, enlaces, nodos);
      const r = resumen(cs);
      ajustes.push({
        preset: otro.id,
        nombre: otro.nombre,
        actual: otro.id === preset.id,
        conRuta: cs[0].remitentes,
        completosPct: cs[0].motivo ? 0 : r.completosPct,
        p95S: r.p95S,
        canalPct: r.canalPct,
        estado: cs[0].motivo ? "sin-pagos" : estadoDe(Math.round(r.pagos), r.completosPct, r.p95S),
        velocidadKbps: otro.velocidadKbps,
      });
      hechos++;
      progreso?.(Math.min(0.99, hechos / total));
    }
    res.ajustes = ajustes;
  }
  progreso?.(1);
  return res;
}
