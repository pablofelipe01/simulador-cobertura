// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Optimización de una red sobrecargada o con estrés, a partir de la prueba de popularidad. Mira qué les falla a las
// personas (cobertura, saltos, señal, canal, choques, colas o la fila del gateway) y en qué zonas, propone arreglos y
// los prueba uno por uno con la misma carga, paquete por paquete:
//  • gateways de apoyo: convertir el repetidor de una zona cargada en gateway (con internet), un gateway nuevo en el
//    centro de la gente que más sufre, o un gateway de apoyo en otra frecuencia que se lleva a la gente de esa zona
//    (dos canales que no se estorban, como las 4 radios de un sitio de Trama);
//  • antenas de apoyo: un repetidor en el centro de la gente sin cobertura o con señal débil (si no alcanza la red,
//    se corre hacia el nodo conectado más cercano);
//  • ajustes del protocolo: equipos mudos (CLIENT_MUTE) y sin telemetría a la malla en Meshtastic, otro ajuste de
//    radio, y atender en paralelo en el gateway.
// Cada propuesta trae el antes y el después (a cuántas personas les funciona, mensajes completos, espera y canal) y
// al final se combinan las que suman. Son estimaciones para planear; se validan en campo.
import { EQUIPOS, presetPorId, presetsDe, type PresetId } from "./constantes";
import { estresMalla, type EstadoZona, type PedidoEstres, type ResultadoEstres, type UsuarioEstres, type ZonaEstres } from "./estres";
import { distanciaM, metrosPorGrado } from "./geo";
import { analizarMalla, enlaceEntre, retransmite } from "./malla";
import { claseEnlace, longitudOnda } from "./modelo";
import { GATEWAY_SERVIDOR } from "./protocolos";
import { calculoRed } from "./red";
import type { Relieve } from "./relieve";
import { sembrar } from "./siembra";
import { CAPACIDAD_TRAMA } from "./trama";
import type { Antena, Enlace, Parametros } from "./tipos";

export type TipoPropuesta = "gateway-zona" | "gateway-nuevo" | "otra-frecuencia" | "antena-apoyo" | "clientes-mudos" | "sin-telemetria" | "ajuste-radio" | "gateway-paralelo";

/** Cómo queda la red con la carga de la prueba. */
export type MedidaRed = {
  /**
   * Personas atendidas (equivalentes): la suma, persona por persona, de la parte de sus mensajes que vuelve, rebajada si
   * tarda (completa hasta 30 s; 80 % a los 60 s; 30 % pasados 5 minutos). Cambia poco a poco, así que sirve para comparar
   * aunque el estado de una zona entera salte de «le funciona» a «a medias» por unos segundos de espera.
   */
  atendidas: number;
  funcionan: number;
  total: number;
  funcionanPct: number;
  completosPct: number;
  p95S: number;
  canalPct: number;
  estado: EstadoZona;
};

export type PropuestaOptimizar = {
  id: string;
  tipo: TipoPropuesta;
  titulo: string;
  /** Qué hacer en campo, en una o dos frases. */
  que: string;
  /** Por qué ayuda (lo que mostró la prueba). */
  porque: string;
  /** Nodos nuevos (ids «opt-…»), nodos que cambian y parámetros u opciones de la prueba que cambian. */
  agregar: Antena[];
  editar: { id: string; cambios: Partial<Antena> }[];
  parametros: Partial<Parametros> | null;
  opciones: Partial<PedidoEstres> | null;
  /** Dónde mirar en el mapa. */
  lat: number | null;
  lon: number | null;
  /** Se puede aplicar al escenario (la otra frecuencia y lo del servicio del gateway se hacen en campo). */
  aplicable: boolean;
  antes: MedidaRed;
  despues: MedidaRed;
  /** Personas que pasan a funcionar y personas atendidas de más (equivalentes). */
  ganancia: number;
  gananciaAtendidas: number;
};

export type ResultadoOptimizar = {
  antes: MedidaRed;
  /** Lo que encontró la prueba, en frases cortas. */
  diagnostico: string[];
  /** Las propuestas que ayudan, de la que más a la que menos. */
  propuestas: PropuestaOptimizar[];
  /** Las aplicables que suman, juntas. */
  combinada: PropuestaOptimizar | null;
  /** Propuestas probadas que no ayudaron (para no volver a sugerirlas). */
  descartadas: { titulo: string; ganancia: number }[];
  motivo: string | null;
};

export type PedidoOptimizar = {
  /** La prueba de estrés con la que se midió la red (sin rampa ni comparación). */
  estres: PedidoEstres;
  /** Su resultado (de ahí sale el diagnóstico). */
  resultado: ResultadoEstres;
  /** Altura de los repetidores de apoyo (m). */
  alturaApoyoM?: number;
};

const ALTURA_APOYO_M = 12;
const RADIO_GRUPO_KM = 1.5;
const fmt = (x: number, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("es-CO");
const entero = (x: number) => Math.round(x).toLocaleString("es-CO");

/** Cuánto vale una respuesta según lo que tarda el 95 % (s). */
export function valorEspera(p95S: number): number {
  if (p95S <= 30) return 1;
  if (p95S <= 60) return 1 - (0.2 * (p95S - 30)) / 30;
  return Math.max(0.3, 0.8 - (0.5 * (p95S - 60)) / 240);
}

export function medidaDe(r: ResultadoEstres): MedidaRed {
  return {
    atendidas: r.porUsuario.reduce((s, u) => s + (u.exitoPct / 100) * valorEspera(u.esperaP95S), 0),
    funcionan: r.resumenUsuarios.funcionan,
    total: r.resumenUsuarios.total,
    funcionanPct: r.resumenUsuarios.funcionanPct,
    completosPct: r.completosPct,
    p95S: r.p95S,
    canalPct: r.canalGatewayPct,
    estado: r.estado,
  };
}

/** Equipo de un nodo nuevo: el repetidor solar con antena de 8 dBi o la radio del gateway. */
function equipoDe(id: "p1-8dbi" | "t114-8dbi") {
  const q = EQUIPOS.find((x) => x.id === id) ?? EQUIPOS[0];
  return { equipo: q.id, potenciaDbm: q.potenciaDbm, gananciaDbi: q.gananciaDbi, perdidaCableDb: q.perdidaCableDb };
}

function nodoNuevo(id: string, nombre: string, lat: number, lon: number, gateway: boolean, alturaM: number): Antena {
  return {
    id,
    nombre,
    tipo: "antena",
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    alturaM,
    ...equipoDe(gateway ? "t114-8dbi" : "p1-8dbi"),
    rol: gateway ? "COMPANION" : "REPETIDOR",
    pasarela: gateway,
    activa: true,
  };
}

/** Grupos de personas cercanas (a menos de `radioKm` de la primera del grupo), de los más grandes a los más chicos. */
function agrupar(us: UsuarioEstres[], radioKm: number): UsuarioEstres[][] {
  const libres = new Set(us.map((_, i) => i));
  const grupos: UsuarioEstres[][] = [];
  while (libres.size) {
    let mejor = -1;
    let vecinos: number[] = [];
    for (const i of libres) {
      const v = [...libres].filter((k) => distanciaM(us[i].lat, us[i].lon, us[k].lat, us[k].lon) <= radioKm * 1000);
      if (v.length > vecinos.length) {
        vecinos = v;
        mejor = i;
      }
    }
    if (mejor < 0) break;
    grupos.push(vecinos.map((k) => us[k]));
    for (const k of vecinos) libres.delete(k);
  }
  return grupos;
}

const centro = (us: { lat: number; lon: number }[]) => ({ lat: us.reduce((s, u) => s + u.lat, 0) / us.length, lon: us.reduce((s, u) => s + u.lon, 0) / us.length });

/**
 * Optimiza la red para la carga de la prueba. `relieve` cubre la red (para calcular los enlaces de los nodos nuevos);
 * `progreso` va de 0 a 1.
 */
export function optimizar(pedido: PedidoOptimizar, relieve: Relieve, progreso?: (avance: number) => void): ResultadoOptimizar {
  const base: PedidoEstres = { ...pedido.estres, rampa: false, comparar: false, foco: null };
  const r0 = pedido.resultado;
  const antes = medidaDe(r0);
  const vacio: ResultadoOptimizar = { antes, diagnostico: [], propuestas: [], combinada: null, descartadas: [], motivo: null };
  if (r0.motivo) return { ...vacio, motivo: r0.motivo };
  if (!r0.porUsuario.length) return { ...vacio, motivo: "No hay personas en la prueba: ponga una zona de popularidad y pruebe la hora pico." };
  const p = base.parametros;
  const preset = presetPorId(p.preset);
  const mt = preset.protocolo === "meshtastic";
  const alturaApoyo = pedido.alturaApoyoM ?? ALTURA_APOYO_M;
  const red = calculoRed(p);
  const lambda = longitudOnda(p.frecuenciaMhz);
  const activas = base.antenas.filter((a) => a.activa);
  const porId = new Map(activas.map((a) => [a.id, a]));
  const caja = cajaOptimizar(activas);

  // Diagnóstico
  const diagnostico: string[] = [];
  const u = r0.resumenUsuarios;
  diagnostico.push(`Con esta carga le funciona a ${entero(u.funcionan)} de ${entero(u.total)} personas (${fmt(u.funcionanPct)} %); canal del gateway ${fmt(r0.canalGatewayPct)} %.`);
  const zonasMal = r0.zonas.filter((z) => z.usuarios > 0 && (z.estado === "revienta" || z.estado === "lento")).sort((a, b) => a.completosPct - b.completosPct || b.usuarios - a.usuarios);
  for (const z of zonasMal.slice(0, 3)) diagnostico.push(`${z.nombre}: ${z.estado === "revienta" ? "se revienta" : "va lenta"} con ${entero(z.usuarios)} personas (${fmt(z.completosPct)} % completos, canal ${fmt(z.canalPct)} %).`);
  const sinRed = r0.porUsuario.filter((x) => x.causa === "cobertura" || x.causa === "saltos" || x.causa === "senal");
  if (sinRed.length) diagnostico.push(`${entero(sinRed.length)} ${sinRed.length === 1 ? "persona falla" : "personas fallan"} por cobertura, saltos o señal débil: ${sinRed.length === 1 ? "necesita" : "necesitan"} una antena de apoyo, no más capacidad.`);
  if (r0.gateway.modo === "secuencial" && r0.gateway.esperaP95S > 5) diagnostico.push(`La fila del gateway llega a ${fmt(r0.gateway.esperaP95S)} s (atiende de a uno).`);

  // Medir una variante de la red con la misma carga (y la misma semilla, para comparar)
  const medir = (q: PedidoEstres): { r: ResultadoEstres; m: MedidaRed } => {
    const r = estresMalla({ ...q, rampa: false, comparar: false, foco: null });
    return { r, m: medidaDe(r) };
  };
  /** Enlaces de los nodos nuevos con todos los demás (los repetidores y gateways se enlazan con todos). */
  const enlacesCon = (todas: Antena[], nuevas: Antena[], enlaces: Enlace[]): Enlace[] => {
    const ids = new Set(nuevas.map((a) => a.id));
    const extra: Enlace[] = [];
    for (const n of nuevas)
      for (const a of todas) {
        if (a.id === n.id || (ids.has(a.id) && a.id < n.id)) continue;
        if (!(retransmite(n) || n.pasarela || retransmite(a) || a.pasarela)) continue;
        extra.push(enlaceEntre(n, a, p, relieve, red, lambda));
      }
    return [...enlaces.filter((e) => !ids.has(e.a) && !ids.has(e.b)), ...extra];
  };
  type Variante = { antenas: Antena[]; enlaces: Enlace[]; parametros: Parametros; opciones: Partial<PedidoEstres> };
  const variante = (v: Variante): PedidoEstres => {
    const nodos = analizarMalla(v.antenas.filter((a) => a.activa), v.enlaces, v.parametros.limiteSaltos).nodos;
    return { ...base, ...v.opciones, antenas: v.antenas, enlaces: v.enlaces, nodos, parametros: v.parametros };
  };
  const original: Variante = { antenas: base.antenas, enlaces: base.enlaces, parametros: p, opciones: {} };
  /** Aplica una propuesta a una variante. */
  const aplicar = (v: Variante, pr: Pick<PropuestaOptimizar, "agregar" | "editar" | "parametros" | "opciones">): Variante => {
    let antenas = v.antenas.map((a) => {
      const c = pr.editar.find((x) => x.id === a.id);
      return c ? { ...a, ...c.cambios } : a;
    });
    antenas = [...antenas, ...pr.agregar];
    const parametros = { ...v.parametros, ...(pr.parametros ?? {}) };
    let enlaces = pr.agregar.length ? enlacesCon(antenas.filter((a) => a.activa), pr.agregar, v.enlaces) : v.enlaces;
    // Con otro ajuste de radio, el margen cambia lo que cambia la sensibilidad
    if (pr.parametros?.preset && pr.parametros.preset !== v.parametros.preset) {
      const delta = presetPorId(v.parametros.preset).sensibilidadDbm - presetPorId(pr.parametros.preset).sensibilidadDbm;
      enlaces = enlaces.map((e) => ({ ...e, margenAB: e.margenAB + delta, margenBA: e.margenBA + delta, margen: e.margen + delta, clase: claseEnlace(e.margen + delta) }));
    }
    return { antenas, enlaces, parametros, opciones: { ...v.opciones, ...(pr.opciones ?? {}) } };
  };

  type Candidata = Omit<PropuestaOptimizar, "antes" | "despues" | "ganancia" | "gananciaAtendidas"> & { medir?: () => MedidaRed };
  const candidatas: Candidata[] = [];
  const otraFrecuencia = (() => {
    const lista = CAPACIDAD_TRAMA.frecuenciasMhz.filter((f) => Math.abs(f - p.frecuenciaMhz) > 0.2);
    return lista[0] ?? p.frecuenciaMhz + 1.5;
  })();
  const usuariosDe = (z: ZonaEstres) => r0.porUsuario.filter((x) => x.zona === z.id);

  // 1. Zonas cargadas: gateways de apoyo
  for (const z of zonasMal.slice(0, 2)) {
    const a = porId.get(z.id);
    if (!a) continue;
    const suyos = usuariosDe(z);
    if (!a.pasarela) {
      candidatas.push({
        id: `gateway-zona-${z.id}`,
        tipo: "gateway-zona",
        titulo: `Gateway de apoyo en ${z.nombre}`,
        que: `Convierta ${z.nombre} en gateway de apoyo: póngale internet (Starlink o fibra) y el servicio del gateway; sigue repitiendo para los demás.`,
        porque: `${z.nombre} ${z.estado === "revienta" ? "se revienta" : "va lento"} con ${entero(z.usuarios)} personas: sus mensajes salen ahí mismo a internet, con un salto menos y sin cruzar el canal hasta el gateway principal.`,
        agregar: [],
        editar: [{ id: a.id, cambios: { pasarela: true } }],
        parametros: null,
        opciones: null,
        lat: a.lat,
        lon: a.lon,
        aplicable: true,
      });
    } else if (suyos.length >= 6) {
      // La zona del propio gateway: un segundo gateway en el centro de la mitad más lejana de su gente
      const lejos = [...suyos].sort((x, y) => distanciaM(y.lat, y.lon, a.lat, a.lon) - distanciaM(x.lat, x.lon, a.lat, a.lon)).slice(0, Math.ceil(suyos.length / 2));
      const c = centro(lejos);
      if (distanciaM(c.lat, c.lon, a.lat, a.lon) > 400)
        candidatas.push({
          id: `gateway-nuevo-${z.id}`,
          tipo: "gateway-nuevo",
          titulo: `Segundo gateway cerca de la gente de ${z.nombre}`,
          que: `Ponga un segundo gateway (con internet) donde está la mitad más lejana de la gente de ${z.nombre}, a ${fmt(distanciaM(c.lat, c.lon, a.lat, a.lon) / 1000, 1)} km.`,
          porque: `${z.nombre} atiende a ${entero(z.usuarios)} personas y ${z.estado === "revienta" ? "se revienta" : "va lento"}; un segundo gateway reparte la gente y la fila.`,
          agregar: [nodoNuevo(`opt-gw-${z.id}`, `Gateway de apoyo (${z.nombre})`, c.lat, c.lon, true, 12)],
          editar: [],
          parametros: null,
          opciones: null,
          lat: c.lat,
          lon: c.lon,
          aplicable: true,
        });
    }
    // Otra frecuencia: un gateway de apoyo con su propia radio se lleva a la gente de la zona (o a la mitad, si es la
    // zona del gateway)
    const pasan = a.pasarela ? [...suyos].sort((x, y) => Math.atan2(x.lat - a.lat, x.lon - a.lon) - Math.atan2(y.lat - a.lat, y.lon - a.lon)).slice(0, Math.floor(suyos.length / 2)) : suyos;
    if (pasan.length >= 4)
      candidatas.push({
        id: `otra-frecuencia-${z.id}`,
        tipo: "otra-frecuencia",
        titulo: `Gateway de apoyo en ${fmt(otraFrecuencia, 1)} MHz en ${z.nombre}`,
        que: `En el sitio de ${z.nombre} ponga un gateway de apoyo con su propia radio en ${fmt(otraFrecuencia, 3)} MHz (con internet) y configure en esa frecuencia a ${entero(pasan.length)} personas de la zona: quedan dos canales que no se estorban.`,
        porque: `El canal de ${z.nombre} está ocupado el ${fmt(z.canalPct)} %: en una sola frecuencia los mensajes de todos se pisan; con dos, cada una lleva la mitad del aire.`,
        agregar: [],
        editar: [],
        parametros: null,
        opciones: null,
        lat: a.lat,
        lon: a.lon,
        aplicable: false,
        medir: () => {
          // Canal 1: la red sin las que pasan. Canal 2: el sitio como gateway con las que pasan.
          const fuera = new Set(pasan.map((x) => x.id));
          const uno = base.antenas.filter((x) => !fuera.has(x.id));
          const enl1 = base.enlaces.filter((e) => !fuera.has(e.a) && !fuera.has(e.b));
          const r1 = medir(variante({ antenas: uno, enlaces: enl1, parametros: p, opciones: {} })).r;
          const sitio: Antena = { ...a, id: `opt-f2-${a.id}`, nombre: `${a.nombre} (${fmt(otraFrecuencia, 1)} MHz)`, pasarela: true, rol: a.pasarela ? a.rol : "COMPANION" };
          const dos = [sitio, ...base.antenas.filter((x) => fuera.has(x.id))];
          const enl2 = base.enlaces
            .filter((e) => (e.a === a.id && fuera.has(e.b)) || (e.b === a.id && fuera.has(e.a)))
            .map((e) => ({ ...e, a: e.a === a.id ? sitio.id : e.a, b: e.b === a.id ? sitio.id : e.b }));
          const r2 = medir(variante({ antenas: dos, enlaces: enl2, parametros: { ...p, frecuenciaMhz: otraFrecuencia }, opciones: {} })).r;
          const m1 = medidaDe(r1);
          const m2 = r2.motivo ? { ...m1, atendidas: 0, funcionan: 0, total: pasan.length, completosPct: 0 } : medidaDe(r2);
          const total = m1.total + m2.total;
          const pagos1 = r1.pagos;
          const pagos2 = r2.pagos;
          return {
            atendidas: m1.atendidas + m2.atendidas,
            funcionan: m1.funcionan + m2.funcionan,
            total,
            funcionanPct: total ? (100 * (m1.funcionan + m2.funcionan)) / total : 0,
            completosPct: pagos1 + pagos2 ? (m1.completosPct * pagos1 + m2.completosPct * pagos2) / (pagos1 + pagos2) : 0,
            p95S: Math.max(m1.p95S, m2.p95S),
            canalPct: Math.max(m1.canalPct, m2.canalPct),
            estado: [m1.estado, m2.estado].includes("revienta") ? "revienta" : [m1.estado, m2.estado].includes("lento") ? "lento" : "aguanta",
          };
        },
      });
  }

  // 2. Personas sin cobertura, lejos o con señal débil: antenas de apoyo. La cadena la busca el sembrado automático
  // (desde los nodos conectados hasta el centro del grupo, sobre el relieve); si no la encuentra, una antena en el
  // centro del grupo, corrida hacia el nodo conectado más cercano hasta que lo alcance.
  const infraConRuta = activas.filter((a) => (retransmite(a) || a.pasarela) && base.nodos.find((n) => n.id === a.id)?.saltos != null);
  const saltosOrigen: Record<string, number> = {};
  for (const n of base.nodos) if (n.saltos !== null) saltosOrigen[n.id] = n.saltos;
  for (const [k, grupo] of agrupar(sinRed, RADIO_GRUPO_KM)
    .filter((g) => g.length >= Math.min(3, sinRed.length))
    .slice(0, 2)
    .entries()) {
    const c = centro(grupo);
    const plantillaPersona = porId.get(grupo[0].id);
    const molde = nodoNuevo("molde", "Apoyo", c.lat, c.lon, false, alturaApoyo);
    let sitios: { lat: number; lon: number }[] = [];
    let desde: Antena | undefined;
    if (infraConRuta.length && plantillaPersona) {
      const s = sembrar(
        { origenes: infraConRuta, destinos: [{ lat: c.lat, lon: c.lon, nombre: "el grupo" }], repetidor: molde, persona: plantillaPersona, parametros: p, maxRepetidores: 4, saltosOrigen, limiteSaltos: p.limiteSaltos },
        relieve,
        caja,
      );
      if (s.destinos[0]?.llega && s.puntos.length) {
        sitios = s.puntos.map((q) => ({ lat: q.lat, lon: q.lon }));
        desde = porId.get(s.puntos[0].desdeId);
      }
    }
    if (!sitios.length) {
      const cercano = [...infraConRuta].sort((x, y) => distanciaM(c.lat, c.lon, x.lat, x.lon) - distanciaM(c.lat, c.lon, y.lat, y.lon))[0];
      let sitio = c;
      if (cercano) {
        for (const t of [0, 0.33, 0.5, 0.66]) {
          const q = { lat: c.lat + (cercano.lat - c.lat) * t, lon: c.lon + (cercano.lon - c.lon) * t };
          const e = enlaceEntre(nodoNuevo("prueba", "prueba", q.lat, q.lon, false, alturaApoyo), cercano, p, relieve, red, lambda);
          sitio = q;
          if (e.clase !== "sin") break;
        }
      }
      sitios = [sitio];
      desde = cercano;
    }
    const nombre = (i: number) => (sitios.length === 1 ? `Antena de apoyo ${k + 1}` : `Antena de apoyo ${k + 1}.${i + 1}`);
    const ultimo = sitios[sitios.length - 1];
    candidatas.push({
      id: `antena-apoyo-${k}`,
      tipo: "antena-apoyo",
      titulo: `${sitios.length === 1 ? "Antena de apoyo" : `${sitios.length} antenas de apoyo`} para ${entero(grupo.length)} ${grupo.length === 1 ? "persona" : "personas"} sin buena señal`,
      que:
        sitios.length === 1
          ? `Ponga un repetidor de ${alturaApoyo} m en ${ultimo.lat.toFixed(5)}, ${ultimo.lon.toFixed(5)}${desde ? `, a ${fmt(distanciaM(ultimo.lat, ultimo.lon, desde.lat, desde.lon) / 1000, 1)} km de ${desde.nombre}` : ""}.`
          : `Ponga ${sitios.length} repetidores de ${alturaApoyo} m en cadena desde ${desde?.nombre ?? "la red"} hasta el grupo: ${sitios.map((q) => `${q.lat.toFixed(5)}, ${q.lon.toFixed(5)}`).join(" → ")}.`,
      porque: `${entero(grupo.length)} personas fallan por ${[...new Set(grupo.map((x) => x.causa))].map((x) => (x === "cobertura" ? "falta de cobertura" : x === "saltos" ? "demasiados saltos" : "señal débil")).join(" y ")}: les falta una antena cerca, no capacidad.`,
      agregar: sitios.map((q, i) => nodoNuevo(`opt-apoyo-${k}-${i}`, nombre(i), q.lat, q.lon, false, alturaApoyo)),
      editar: [],
      parametros: null,
      opciones: null,
      lat: ultimo.lat,
      lon: ultimo.lon,
      aplicable: true,
    });
  }

  // 3. Meshtastic: equipos mudos y sin telemetría a la malla
  if (mt && p.usuariosRepiten !== false && (r0.canalGatewayPct >= 25 || r0.cancelados > 0))
    candidatas.push({
      id: "clientes-mudos",
      tipo: "clientes-mudos",
      titulo: "Equipos de las personas en CLIENT_MUTE",
      que: "Configure los equipos de las personas con el rol CLIENT_MUTE (no repiten) y deje que repitan solo los ROUTER de la red.",
      porque: `Con todos repitiendo, cada inundación la repiten muchos equipos (se cancelaron ~${entero(r0.cancelados)} retransmisiones y aun así el canal está al ${fmt(r0.canalGatewayPct)} %).`,
      agregar: [],
      editar: [],
      parametros: { usuariosRepiten: false },
      opciones: null,
      lat: null,
      lon: null,
      aplicable: true,
    });
  if (mt && base.fondo !== false && r0.canalGatewayPct >= 25)
    candidatas.push({
      id: "sin-telemetria",
      tipo: "sin-telemetria",
      titulo: "Telemetría solo al teléfono y NodeInfo cada 12 h",
      que: "En los equipos apague el envío de la telemetría a la malla (que quede solo en el teléfono) y suba el intervalo del NodeInfo.",
      porque: "Cada equipo inunda su telemetría cada 30 minutos: con mucha gente eso solo ya ocupa buena parte del canal.",
      agregar: [],
      editar: [],
      parametros: null,
      opciones: { fondo: false },
      lat: null,
      lon: null,
      aplicable: false,
    });

  // 4. La fila del gateway
  if (r0.gateway.modo === "secuencial" && (r0.gateway.esperaP95S > 5 || r0.gateway.ocupadoPct > 50))
    candidatas.push({
      id: "gateway-paralelo",
      tipo: "gateway-paralelo",
      titulo: "Atender en paralelo en el gateway",
      que: "En el servicio del gateway procese los mensajes en paralelo (una cola con varios trabajadores para la base de datos) en vez de uno por uno.",
      porque: `La fila del gateway llega a ${fmt(r0.gateway.esperaP95S)} s: mientras la base de datos responde, los demás mensajes esperan.`,
      agregar: [],
      editar: [],
      parametros: null,
      opciones: { atencion: GATEWAY_SERVIDOR },
      lat: null,
      lon: null,
      aplicable: false,
    });

  // 5. Otro ajuste de radio (más rápido) del mismo protocolo, si el canal es lo que aprieta
  const congestion = zonasMal.length > 0 || r0.canalGatewayPct >= 40;
  const masRapidos = (congestion ? presetsDe(preset.protocolo) : [])
    .filter((x) => x.velocidadKbps > preset.velocidadKbps * 1.3)
    .sort((a, b) => a.velocidadKbps - b.velocidadKbps)
    .slice(0, 2);
  for (const x of masRapidos)
    candidatas.push({
      id: `ajuste-${x.id}`,
      tipo: "ajuste-radio",
      titulo: `Ajuste de radio ${x.nombre}`,
      que: `Pase toda la red (repetidores, gateway y equipos de las personas) a ${x.nombre}${/SF\d/.test(x.nombre) ? "" : ` (SF${x.sf} · ${fmt(x.anchoBandaKhz, 1)} kHz)`}: cada mensaje dura ${fmt(preset.velocidadKbps ? x.velocidadKbps / preset.velocidadKbps : 1, 1)} veces menos en el aire.`,
      porque: `Más rápido cabe más gente en el canal, a cambio de alcance (${fmt(x.sensibilidadDbm - preset.sensibilidadDbm, 1)} dB menos de margen en cada enlace).`,
      agregar: [],
      editar: [],
      parametros: { preset: x.id as PresetId },
      opciones: null,
      lat: null,
      lon: null,
      aplicable: true,
    });

  // Probar cada una
  const propuestas: PropuestaOptimizar[] = [];
  const descartadas: { titulo: string; ganancia: number }[] = [];
  const total = candidatas.length + 1;
  // Mejora si atiende al menos a una persona más (o al 1 % más), sin contar el ruido del sorteo
  const umbral = Math.max(1, antes.total * 0.01);
  candidatas.forEach((c, i) => {
    const despues = c.medir ? c.medir() : medir(variante(aplicar(original, c))).m;
    const { medir: _m, ...resto } = c;
    void _m;
    const ganancia = despues.funcionan - antes.funcionan;
    const gananciaAtendidas = despues.atendidas - antes.atendidas;
    if (gananciaAtendidas >= umbral) propuestas.push({ ...resto, antes, despues, ganancia, gananciaAtendidas });
    else descartadas.push({ titulo: c.titulo, ganancia: Math.round(gananciaAtendidas) });
    progreso?.((i + 1) / total);
  });
  propuestas.sort((a, b) => b.gananciaAtendidas - a.gananciaAtendidas || b.ganancia - a.ganancia);

  // Combinar las aplicables que suman (de la que más gana a la que menos; una de cada nodo)
  let combinada: PropuestaOptimizar | null = null;
  const aplicables = propuestas.filter((x) => x.aplicable);
  if (aplicables.length >= 2) {
    let actual = original;
    let medida = antes;
    const usadas: PropuestaOptimizar[] = [];
    for (const pr of aplicables) {
      if (pr.tipo === "ajuste-radio" && usadas.some((x) => x.tipo === "ajuste-radio")) continue;
      if (pr.editar.some((e) => usadas.some((x) => x.editar.some((y) => y.id === e.id)))) continue;
      const v = aplicar(actual, pr);
      const m = medir(variante(v)).m;
      if (m.atendidas >= medida.atendidas + umbral) {
        actual = v;
        medida = m;
        usadas.push(pr);
      }
    }
    if (usadas.length >= 2)
      combinada = {
        id: "combinada",
        tipo: usadas[0].tipo,
        titulo: `Todo junto: ${usadas.map((x) => x.titulo.charAt(0).toLowerCase() + x.titulo.slice(1)).join(" + ")}`,
        que: usadas.map((x) => x.que).join(" "),
        porque: "Las propuestas que más suman, probadas juntas con la misma carga.",
        agregar: usadas.flatMap((x) => x.agregar),
        editar: usadas.flatMap((x) => x.editar),
        parametros: usadas.reduce<Partial<Parametros> | null>((acc, x) => (x.parametros ? { ...(acc ?? {}), ...x.parametros } : acc), null),
        opciones: null,
        lat: usadas.find((x) => x.lat !== null)?.lat ?? null,
        lon: usadas.find((x) => x.lon !== null)?.lon ?? null,
        aplicable: true,
        antes,
        despues: medida,
        ganancia: medida.funcionan - antes.funcionan,
        gananciaAtendidas: medida.atendidas - antes.atendidas,
      };
  }
  progreso?.(1);
  if (!candidatas.length) diagnostico.push(antes.funcionanPct >= 90 ? "La red aguanta esta carga: no hace falta optimizarla. Súbale la carga (×2, ×5) para ver hasta dónde llega." : "No encontré un arreglo claro para esta carga.");
  else if (!propuestas.length) diagnostico.push("Probé los arreglos de siempre y ninguno mejora con esta carga: baje la carga o divida la red en más frecuencias.");
  return { antes, diagnostico, propuestas, combinada, descartadas, motivo: null };
}

/** Caja que cubre la red y sus alrededores (para el relieve de la optimización). */
export function cajaOptimizar(antenas: Antena[], bordeKm = 3) {
  const lats = antenas.map((a) => a.lat);
  const lons = antenas.map((a) => a.lon);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const g = metrosPorGrado(lat0);
  return { sur: Math.min(...lats) - (bordeKm * 1000) / g.lat, norte: Math.max(...lats) + (bordeKm * 1000) / g.lat, oeste: Math.min(...lons) - (bordeKm * 1000) / g.lon, este: Math.max(...lons) + (bordeKm * 1000) / g.lon };
}

