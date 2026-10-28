// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El pitch del modelo de negocio, armado con la red que está en el mapa: el problema y la solución de Trama, cada
// antena (dónde, a qué altura y por qué), la cobertura, la capacidad real, la inversión (CAPEX), la operación (OPEX),
// el costo por usuario, el punto de equilibrio (con la comisión por pago que se quiera probar) y cómo escala al
// departamento y al país. Solo usa cifras del simulador y del documento de Trama: no inventa ingresos.
import { estadoRed } from "../radio/estado-red";
import type { ResultadoEstres } from "../radio/estres";
import { PROTOCOLOS } from "../radio/protocolos";
import { presetPorId } from "../radio/constantes";
import {
  CAPACIDAD_TRAMA,
  costoRedTrama,
  DEPARTAMENTOS_TRAMA,
  dimensionarDepartamento,
  OPERACION_TRAMA,
  PRECIOS,
  pesosTrama,
  SF_TRAMA,
  type DepartamentoTrama,
  type Dimension,
  type SfTrama,
} from "../radio/trama";
import type { Antena, Parametros, ResultadoSimulacion } from "../radio/tipos";

export type Caja = [number, number, number, number];

/** A dónde mira la cámara y dónde se pone el robot en cada capítulo. */
export type FocoPitch =
  | { tipo: "red"; caja: Caja | null }
  | { tipo: "punto"; lat: number; lon: number; zoom: number }
  | { tipo: "pais" };

export type CifraPitch = { etiqueta: string; valor: string; detalle?: string; tono?: "bien" | "alerta" | "mal" };

export type IdCapitulo = "portada" | "problema" | "solucion" | "antena" | "cobertura" | "capacidad" | "inversion" | "operacion" | "equilibrio" | "escala" | "cierre";

export type CapituloPitch = {
  id: IdCapitulo;
  /** Clave única (las antenas comparten `id`). */
  clave: string;
  titulo: string;
  subtitulo: string;
  /** Lo que Melki dice (en prosa, para leer en voz alta). */
  guion: string;
  cifras: CifraPitch[];
  foco: FocoPitch;
  /** La antena de la que se habla (para resaltarla en el mapa). */
  antena?: string;
};

export type DatosPitch = {
  antenas: Antena[];
  parametros: Parametros;
  /** Última simulación al día (null si falta simular). */
  resultado: ResultadoSimulacion | null;
  /** Última prueba de estrés al día (opcional). */
  estres: ResultadoEstres | null;
  /** Municipio y departamento de un punto (si el mapa de referencia está cargado). */
  lugar?: (lat: number, lon: number) => { municipio: string; departamento: string } | null;
  /** Comisión por pago que se quiere probar (COP); sin ella, el pitch da la de equilibrio. */
  comisionPago?: number | null;
  /** Pagos por persona al día (2,4 del documento de Trama). */
  pagosPersonaDia?: number;
  /** Parte de los adultos sin canal digital que adopta la red (%). */
  adopcionPct?: number;
  /** Nombre del proyecto o del escenario. */
  nombre?: string;
};

export type Equilibrio = {
  usuarios: number;
  /** Lo que cuesta la red al mes: la inversión repartida en los años del documento más la operación (COP). */
  costoMes: number;
  costoMesUsuario: number;
  pagosMes: number;
  /** Comisión por pago que cubre la red (COP). */
  comisionEquilibrio: number;
  /** Con la comisión dada: ingresos al mes, lo que queda tras la operación y en cuántos meses se recupera la inversión. */
  comision: number | null;
  ingresosMes: number | null;
  margenOperacionMes: number | null;
  mesesRecuperacion: number | null;
};

export const PAGOS_DIA_DEFECTO = 2.4;
export const ADOPCION_DEFECTO = 30;

/* ───────────── Formato ───────────── */

const ent = (x: number) => Math.round(x).toLocaleString("es-CO");
const f1 = (x: number, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("es-CO", { maximumFractionDigits: d });
const pct = (x: number) => `${f1(x, x >= 10 ? 0 : 1)} %`;

/** Pesos para decirlos en voz alta: «6,4 millones de pesos», «178 mil pesos». */
export function pesosHablados(v: number): string {
  const n = (x: number, d: number) => x.toLocaleString("es-CO", { maximumFractionDigits: d });
  if (v >= 1e12) return `${n(v / 1e12, 1)} billones de pesos`;
  if (v >= 1e9) return `${n(v / 1e9, 1)} mil millones de pesos`;
  if (v >= 1e6) return `${n(v / 1e6, v >= 1e8 ? 0 : 1)} millones de pesos`;
  if (v >= 1e4) return `${n(Math.round(v / 1000), 0)} mil pesos`;
  return `${n(Math.round(v), 0)} pesos`;
}

/* ───────────── Cuentas ───────────── */

/**
 * Punto de equilibrio: la red cuesta al mes la inversión repartida en `aniosInversion` años más la operación. Cada
 * usuario hace `pagosDia` pagos al día; la comisión de equilibrio es la que cubre ese costo. Con una comisión dada,
 * da los ingresos, el margen sobre la operación, los meses para recuperar la inversión y los usuarios de equilibrio.
 */
export function equilibrio(inversion: number, operacionMes: number, usuarios: number, pagosDia = PAGOS_DIA_DEFECTO, comision: number | null = null): Equilibrio {
  const u = Math.max(0, Math.round(usuarios));
  const costoMes = inversion / (12 * OPERACION_TRAMA.aniosInversion) + operacionMes;
  const pagosMes = u * pagosDia * 30;
  const c = comision !== null && Number.isFinite(comision) && comision > 0 ? comision : null;
  const ingresosMes = c !== null ? pagosMes * c : null;
  const margen = ingresosMes !== null ? ingresosMes - operacionMes : null;
  return {
    usuarios: u,
    costoMes,
    costoMesUsuario: u ? costoMes / u : 0,
    pagosMes,
    comisionEquilibrio: pagosMes ? costoMes / pagosMes : 0,
    comision: c,
    ingresosMes,
    margenOperacionMes: margen,
    mesesRecuperacion: margen !== null && margen > 0 ? inversion / margen : null,
  };
}

/**
 * Desde cuántos usuarios la red se paga sola con esa comisión: los ingresos cubren la red completa al mes (la
 * inversión repartida en los años del documento más la operación), contando que cada usuario suma su billetera, su
 * inscripción y su soporte. Null si no se alcanza con dos millones de usuarios.
 */
export function usuariosParaEquilibrio(gateways: number, repetidores: number, comision: number, pagosDia = PAGOS_DIA_DEFECTO, logistica = 1): number | null {
  if (!(comision > 0)) return null;
  const cubre = (u: number) => comision * pagosDia * 30 * u >= costoRedTrama(gateways, repetidores, u, "xiao", logistica).totalMes;
  let alto = 2_000_000;
  if (!cubre(alto)) return null;
  let bajo = 0;
  while (alto - bajo > 1) {
    const medio = Math.floor((bajo + alto) / 2);
    if (cubre(medio)) alto = medio;
    else bajo = medio;
  }
  return alto;
}

const sinTildes = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Las palabras que distinguen un nombre de departamento (sin tildes, signos ni «de», «la», «D. C.»…). */
const palabrasDepartamento = (t: string) =>
  sinTildes(t)
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["la", "de", "del", "y", "d", "c", "dc"].includes(w));

/**
 * El departamento de Trama con ese nombre (como lo da el mapa de referencia: «Bogotá, D. C.», «San Andrés y
 * Providencia»). Primero el nombre igual; si no, el de Trama cuyas palabras están todas en el pedido.
 */
export function departamentoTrama(nombre: string | null | undefined): DepartamentoTrama | null {
  if (!nombre) return null;
  const n = palabrasDepartamento(nombre);
  if (!n.length) return null;
  const clave = n.join(" ");
  const igual = DEPARTAMENTOS_TRAMA.find((d) => palabrasDepartamento(d.nombre).join(" ") === clave);
  if (igual) return igual;
  let mejor: DepartamentoTrama | null = null;
  let largo = 0;
  for (const d of DEPARTAMENTOS_TRAMA) {
    const p = palabrasDepartamento(d.nombre);
    if (p.length > largo && p.every((w) => n.includes(w))) {
      mejor = d;
      largo = p.length;
    }
  }
  return mejor;
}

/** La caja que encierra los puntos, con un borde. */
export function cajaDe(puntos: { lat: number; lon: number }[]): Caja | null {
  if (!puntos.length) return null;
  let o = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const p of puntos) {
    o = Math.min(o, p.lon);
    e = Math.max(e, p.lon);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  const m = Math.max(0.01, (e - o) * 0.15, (n - s) * 0.15);
  return [o - m, s - m, e + m, n + m];
}

const nombreDe = (antenas: Antena[], id: string) => antenas.find((a) => a.id === id)?.nombre ?? id;

/** La primera frase de un consejo, en minúscula inicial y sin el punto final. */
function primeraFrase(t: string | undefined): string {
  if (!t) return "";
  const f = t.split(/(?<=[.;])\s+/)[0].replace(/[.;]$/, "").trim();
  return f ? f[0].toLowerCase() + f.slice(1) : "";
}

/* ───────────── El pitch ───────────── */

/** Arma los capítulos del pitch con la red del mapa. */
export function armarPitch(d: DatosPitch): CapituloPitch[] {
  const pagosDia = d.pagosPersonaDia ?? PAGOS_DIA_DEFECTO;
  const adopcion = d.adopcionPct ?? ADOPCION_DEFECTO;
  const r = d.resultado;
  const red = estadoRed(d.antenas, r, d.parametros.limiteSaltos, !!r);
  const infra = [...red.gateways, ...red.repetidores];
  const preset = presetPorId(d.parametros.preset);
  const protocolo = PROTOCOLOS[preset.protocolo];
  const centro = infra[0] ?? d.antenas[0] ?? null;
  const lugar = centro && d.lugar ? d.lugar(centro.lat, centro.lon) : null;
  const dep = departamentoTrama(lugar?.departamento);
  const dondeTxt = lugar ? (lugar.municipio && lugar.municipio !== lugar.departamento ? `${lugar.municipio}, ${lugar.departamento}` : lugar.departamento) : null;
  const cajaRed = cajaDe(d.antenas.filter((a) => a.activa));
  const caps: CapituloPitch[] = [];
  const personas = red.personas.length;
  const conectadas = red.conectadas.length;

  /* 1 · Portada */
  caps.push({
    id: "portada",
    clave: "portada",
    titulo: "Trama: pagos, WhatsApp e IA donde no hay señal",
    subtitulo: d.nombre ? `${d.nombre}${dondeTxt ? ` · ${dondeTxt}` : ""}` : (dondeTxt ?? "Red por radio LoRa de Melki"),
    guion: [
      "Buenas, soy Melki, el asistente del simulador de cobertura.",
      `Les presento la red Trama${dondeTxt ? ` que diseñamos para ${dondeTxt}` : ""}: una malla de radio LoRa que lleva pagos, mensajes de WhatsApp por texto y consultas a la inteligencia artificial a donde no llega la señal del celular.`,
      "Vamos a recorrer el problema, la red antena por antena, lo que cubre, cuánta gente atiende de verdad, cuánto cuesta montarla y operarla, y cuándo se paga sola.",
    ].join(" "),
    cifras: [
      { etiqueta: "Gateways", valor: ent(red.gateways.length) },
      { etiqueta: "Repetidores", valor: ent(red.repetidores.length) },
      { etiqueta: "Personas en el mapa", valor: ent(personas) },
      { etiqueta: "Protocolo", valor: protocolo.nombre, detalle: preset.nombre },
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 2 · El problema */
  const sinCanalPais = DEPARTAMENTOS_TRAMA.reduce((s, x) => s + (x.sinCanal[0] + x.sinCanal[1]) / 2, 0);
  const rurales = DEPARTAMENTOS_TRAMA.reduce((s, x) => s + x.rurales, 0);
  caps.push({
    id: "problema",
    clave: "problema",
    titulo: "El problema: territorios sin canal digital",
    subtitulo: dep ? `${dep.nombre}, puesto ${dep.puesto} de 33` : "Colombia rural",
    guion: dep
      ? `En ${dep.nombre} viven ${ent(dep.rurales)} personas en el campo y entre ${ent(dep.sinCanal[0])} y ${ent(dep.sinCanal[1])} adultos no tienen ningún canal digital: no pueden pagar, recibir un giro ni consultar nada sin viajar al pueblo. ${dep.ruralUsaInternetPct < 60 ? "Solo el" : "El"} ${f1(dep.ruralUsaInternetPct, 0)} % de la población rural usa internet${dep.ruralUsaInternetPct >= 60 ? ", pero en las veredas alejadas no hay señal" : ""}. En todo el país son cerca de ${ent(sinCanalPais)} adultos rurales en esa situación.`
      : `En la Colombia rural viven unos ${ent(rurales)} personas, y cerca de ${ent(sinCanalPais)} adultos no tienen ningún canal digital: no pueden pagar, recibir un giro ni consultar nada sin viajar al pueblo. Llevar fibra o torres celulares a esas veredas no es rentable para nadie.`,
    cifras: dep
      ? [
          { etiqueta: "Personas rurales", valor: ent(dep.rurales) },
          { etiqueta: "Adultos sin canal digital", valor: `${ent(dep.sinCanal[0])}–${ent(dep.sinCanal[1])}`, tono: "mal" },
          { etiqueta: "Rural que usa internet", valor: pct(dep.ruralUsaInternetPct) },
          { etiqueta: "En el país", valor: ent(sinCanalPais), detalle: "adultos rurales sin canal" },
        ]
      : [
          { etiqueta: "Personas rurales", valor: ent(rurales) },
          { etiqueta: "Adultos sin canal digital", valor: ent(sinCanalPais), tono: "mal" },
        ],
    foco: { tipo: "pais" },
  });

  /* 3 · La solución */
  caps.push({
    id: "solucion",
    clave: "solucion",
    titulo: "La solución: una malla de radio que se paga sola",
    subtitulo: `${protocolo.nombre} · LoRa ${f1(d.parametros.frecuenciaMhz, 1)} MHz`,
    guion: [
      "Cada persona lleva una billetera de radio del tamaño de un llavero, emparejada con su celular por Bluetooth.",
      "El mensaje salta de repetidor en repetidor: equipos solares SenseCAP P1 en un tubo de seis metros, que no necesitan red eléctrica ni internet.",
      "Al final llega al gateway, un mini PC con radios LoRa y Starlink, que lo entrega a internet y trae la respuesta: el comprobante del pago, el WhatsApp o lo que contestó la inteligencia artificial.",
      `La red usa ${protocolo.nombre}: ${preset.protocolo === "meshcore" ? "solo repiten los repetidores y la ruta se aprende, así el canal se cuida" : "todos pueden repetir con inundación administrada, y en redes grandes los equipos de las personas se dejan mudos"}.`,
    ].join(" "),
    cifras: [
      { etiqueta: "Repetidor solar", valor: pesosTrama(PRECIOS.repetidor), detalle: "P1 + antena 8 dBi + tubo 6 m" },
      { etiqueta: "Sitio gateway", valor: pesosTrama(PRECIOS.sitioBase + PRECIOS.radio + PRECIOS.starlink), detalle: "torre 12 m, mini PC, Starlink solar" },
      { etiqueta: "Billetera", valor: pesosTrama(PRECIOS.nodo.xiao), detalle: "XIAO + Wio-SX1262" },
      { etiqueta: "Saltos máximos", valor: ent(Math.min(d.parametros.limiteSaltos, protocolo.saltosMax)) },
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 4 · Antena por antena */
  const porId = new Map((r?.antenas ?? []).map((x) => [x.id, x]));
  const nodos = new Map((r?.nodos ?? []).map((x) => [x.id, x]));
  const atendidas = new Map<string, number>();
  for (const p of red.personas) {
    const ruta = nodos.get(p.id)?.ruta;
    const primera = ruta?.slice(1).find((id) => infra.some((a) => a.id === id));
    if (primera) atendidas.set(primera, (atendidas.get(primera) ?? 0) + 1);
  }
  const orden = [...red.gateways, ...red.repetidores.sort((a, b) => (nodos.get(a.id)?.saltos ?? 99) - (nodos.get(b.id)?.saltos ?? 99))];
  const MAX_ANTENAS = 8;
  for (const a of orden.slice(0, MAX_ANTENAS)) {
    const res = porId.get(a.id);
    const n = nodos.get(a.id);
    const gw = a.pasarela;
    const sitio = d.lugar?.(a.lat, a.lon);
    const sitioTxt = sitio ? (sitio.municipio !== sitio.departamento ? `${sitio.municipio} (${sitio.departamento})` : sitio.departamento) : null;
    const siguienteId = n?.ruta?.[1] ?? null;
    const enlace = siguienteId ? r?.enlaces.find((e) => (e.a === a.id && e.b === siguienteId) || (e.b === a.id && e.a === siguienteId)) : undefined;
    const frases: string[] = [];
    const cifras: CifraPitch[] = [];
    const conSuelo = !!res && res.elevacionM > 0;
    frases.push(`${a.nombre}${sitioTxt ? `, en ${sitioTxt}` : ""}.`);
    if (conSuelo) frases.push(`El suelo está a ${ent(res!.elevacionM)} m sobre el nivel del mar y la antena va a ${f1(a.alturaM, 1)} m ${gw ? "en la torre del sitio" : "en su mástil"}.`);
    else frases.push(`La antena va a ${f1(a.alturaM, 1)} m ${gw ? "en la torre del sitio" : "en su mástil"}.`);
    if (gw) frases.push("Es el gateway: aquí entra internet por Starlink y se atienden los pagos, los WhatsApp y las consultas a la IA.");
    if (enlace) {
      const m = enlace.margen;
      const vista = enlace.lineaVista ? "con línea de vista despejada" : "sin línea de vista, por difracción sobre el terreno";
      frases.push(
        `Se enlaza con ${nombreDe(d.antenas, siguienteId!)} a ${f1(enlace.distanciaKm, 1)} km, ${vista}, con ${f1(m, 0)} dB de margen: ${m >= 37 ? "un enlace sólido que aguanta lluvia y follaje" : m >= 30 ? "un enlace bueno" : m >= 20 ? "un enlace que funciona pero es inestable" : "un enlace que no alcanza"}.`,
      );
      cifras.push({ etiqueta: `Enlace con ${nombreDe(d.antenas, siguienteId!)}`, valor: `${f1(m, 0)} dB`, detalle: `${f1(enlace.distanciaKm, 1)} km · ${enlace.lineaVista ? "línea de vista" : "difracción"}`, tono: m >= 30 ? "bien" : m >= 20 ? "alerta" : "mal" });
    }
    // Por qué aquí y a esta altura
    if (!gw) {
      if (a.alturaM < 6) frases.push("Conviene subirla al menos a 6 m, el tubo estándar de Trama, para despejar techos y árboles.");
      else if (enlace && enlace.margen < 30) frases.push("Para que quede estable conviene subirla a 9 o 12 m o moverla a la loma más alta cercana; el Ajuste inteligente prueba alturas y lomas hasta dejarla firme.");
      else if (enlace) frases.push(`A ${f1(a.alturaM, 0)} m alcanza con holgura: no hace falta una torre más alta, y eso abarata la instalación.`);
    }
    if (res && res.areaServicioKm2 > 0) {
      frases.push(`Da servicio en ${ent(res.areaServicioKm2)} km², con un alcance de hasta ${f1(res.alcanceKm, 1)} km.`);
      cifras.push({ etiqueta: "Área con servicio", valor: `${ent(res.areaServicioKm2)} km²`, detalle: `alcance ${f1(res.alcanceKm, 1)} km` });
    }
    const at = atendidas.get(a.id) ?? 0;
    if (at) frases.push(at === 1 ? "Por aquí entra 1 persona a la red." : `Por aquí entran ${ent(at)} personas a la red.`);
    if (n?.critico) frases.push("Es un punto crítico: si se apaga, otros nodos quedan sin camino al gateway; un repetidor de respaldo lo resuelve.");
    cifras.unshift({ etiqueta: "Altura de la antena", valor: `${f1(a.alturaM, 1)} m`, detalle: conSuelo ? `suelo a ${ent(res!.elevacionM)} m s. n. m.` : undefined });
    cifras.splice(1, 0, { etiqueta: "Ubicación", valor: `${a.lat.toFixed(5)}, ${a.lon.toFixed(5)}`, detalle: sitioTxt ?? undefined });
    if (!gw && n) cifras.push({ etiqueta: "Saltos al gateway", valor: n.saltos === null ? "sin ruta" : ent(n.saltos), tono: n.saltos === null ? "mal" : undefined });
    if (at) cifras.push({ etiqueta: "Personas que entran aquí", valor: ent(at) });
    caps.push({
      id: "antena",
      clave: `antena-${a.id}`,
      titulo: a.nombre,
      subtitulo: gw ? "Gateway · Starlink + radios LoRa" : "Repetidor solar · SenseCAP P1",
      guion: frases.join(" "),
      cifras: cifras.slice(0, 6),
      foco: { tipo: "punto", lat: a.lat, lon: a.lon, zoom: gw ? 12.5 : 13 },
      antena: a.id,
    });
  }
  if (orden.length > MAX_ANTENAS) {
    const resto = orden.length - MAX_ANTENAS;
    caps[caps.length - 1].guion += ` Y ${resto} ${resto === 1 ? "antena más" : "antenas más"} con el mismo criterio, que pueden ver en el mapa.`;
  }

  /* 5 · Cobertura */
  if (r) {
    const util = r.areaObjetivo ? r.areaObjetivo.utilPct : r.porcentajeUtil;
    const servicio = r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio;
    const areaTxt = r.areaObjetivo ? `del área objetivo, ${ent(r.areaObjetivo.areaKm2)} km²` : `del área de estudio, ${ent(r.areaEstudioKm2)} km²`;
    caps.push({
      id: "cobertura",
      clave: "cobertura",
      titulo: "Cobertura simulada con el relieve real",
      subtitulo: r.factibilidad.titulo,
      guion: [
        `Con el relieve real, la red da servicio en el ${f1(servicio, 0)} % ${areaTxt}, y en el ${f1(util, 0)} % la señal es media o mejor, lo que se necesita para pagar sin reintentos.`,
        `${ent(conectadas)} de ${ent(personas)} personas del mapa llegan al gateway${red.saltosMax ? ` en máximo ${red.saltosMax} ${red.saltosMax === 1 ? "salto" : "saltos"}` : ""}.`,
        `El simulador la califica como «${r.factibilidad.titulo}».${primeraFrase(r.factibilidad.recomendaciones[0]) ? ` Lo siguiente que recomienda: ${primeraFrase(r.factibilidad.recomendaciones[0])}.` : ""}`,
      ].join(" "),
      cifras: [
        { etiqueta: "Con servicio", valor: pct(servicio), tono: servicio >= 80 ? "bien" : servicio >= 50 ? "alerta" : "mal" },
        { etiqueta: "Señal media o mejor", valor: pct(util), tono: util >= 60 ? "bien" : util >= 40 ? "alerta" : "mal" },
        { etiqueta: "Personas conectadas", valor: `${ent(conectadas)} de ${ent(personas)}` },
        { etiqueta: "Área", valor: `${ent(r.areaObjetivo?.areaKm2 ?? r.areaEstudioKm2)} km²` },
      ],
      foco: { tipo: "red", caja: cajaRed },
    });
  }

  /* 6 · Capacidad */
  const sf = ([9, 10, 11].includes(preset.sf) ? preset.sf : 11) as SfTrama;
  // Como está montada: una radio (una frecuencia) por gateway; cada sitio admite hasta 4
  const radios = Math.max(1, red.gateways.length);
  const capacidadDoc = SF_TRAMA[sf].usuariosFrecuencia * radios;
  const e = d.estres;
  const capReal = e?.rampa?.capacidadReal?.personas ?? null;
  caps.push({
    id: "capacidad",
    clave: "capacidad",
    titulo: "Capacidad real, persona por persona",
    subtitulo: e ? `Hora pico simulada paquete por paquete · ${protocolo.nombre}` : `Diseño de capacidad de Trama · SF${sf}`,
    guion: e
      ? [
          `Pusimos a toda la gente a usar la red en la hora más cargada del día: ${f1(e.pagosPersonaDia, 1)} mensajes por persona al día, el ${e.horaPicoPct} % en esa hora.`,
          `De ${ent(e.resumenUsuarios.total)} personas, a ${ent(e.resumenUsuarios.funcionan)} les funciona: el ${f1(e.resumenUsuarios.funcionanPct, 0)} %. El ${f1(e.completosPct, 0)} % de los mensajes vuelve con respuesta, y el canal del gateway está ocupado el ${f1(e.canalGatewayPct, 0)} % del tiempo.`,
          capReal ? `Subiendo la carga, la capacidad real de esta red es de unas ${ent(capReal)} personas atendidas.` : "",
          `Cada frecuencia de Trama atiende unos ${ent(SF_TRAMA[sf].usuariosFrecuencia)} usuarios con SF${sf}, y un sitio tiene hasta ${CAPACIDAD_TRAMA.radiosPorSitio} frecuencias: si la red crece, se suman radios o sitios, no se rehace.`,
        ]
          .filter(Boolean)
          .join(" ")
      : `Cada frecuencia de Trama atiende unos ${ent(SF_TRAMA[sf].usuariosFrecuencia)} usuarios con SF${sf} y el canal al ${CAPACIDAD_TRAMA.canalPicoPct} % en la hora pico. Con ${radios === 1 ? "una radio en el gateway" : `${ent(radios)} radios en los gateways`}, esta red atiende unas ${ent(capacidadDoc)} personas, y cada sitio admite hasta ${CAPACIDAD_TRAMA.radiosPorSitio} frecuencias: hasta ${ent(capacidadDoc * CAPACIDAD_TRAMA.radiosPorSitio)} personas sumando radios de unos ${pesosHablados(PRECIOS.radio)} cada una. La prueba de estrés lo confirma persona por persona.`,
    cifras: e
      ? [
          { etiqueta: "Les funciona", valor: pct(e.resumenUsuarios.funcionanPct), detalle: `${ent(e.resumenUsuarios.funcionan)} de ${ent(e.resumenUsuarios.total)}`, tono: e.resumenUsuarios.funcionanPct >= 90 ? "bien" : e.resumenUsuarios.funcionanPct >= 60 ? "alerta" : "mal" },
          { etiqueta: "Mensajes con respuesta", valor: pct(e.completosPct) },
          { etiqueta: "Canal del gateway", valor: pct(e.canalGatewayPct), tono: e.canalGatewayPct <= 30 ? "bien" : e.canalGatewayPct <= 60 ? "alerta" : "mal" },
          { etiqueta: "Capacidad real", valor: capReal ? `${ent(capReal)} personas` : "—", detalle: capReal ? "con la rampa de carga" : "pida «¿hasta dónde aguanta?»" },
        ]
      : [
          { etiqueta: "Usuarios por frecuencia", valor: ent(SF_TRAMA[sf].usuariosFrecuencia), detalle: `SF${sf}` },
          { etiqueta: "Radios en gateways", valor: ent(radios), detalle: `hasta ${CAPACIDAD_TRAMA.radiosPorSitio} por sitio` },
          { etiqueta: "Capacidad de diseño", valor: `${ent(capacidadDoc)} personas`, detalle: `${ent(capacidadDoc * CAPACIDAD_TRAMA.radiosPorSitio)} con ${CAPACIDAD_TRAMA.radiosPorSitio} radios` },
        ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 7 · Inversión (CAPEX) */
  const logistica = dep?.logistica ?? 1;
  // Con pocas personas en el mapa (una muestra), las cuentas van con la red llena: su capacidad real o la de diseño
  const muestra = personas < 50;
  const usuariosNegocio = muestra ? Math.max(personas, capReal ?? capacidadDoc) : personas;
  const baseTxt = muestra ? (capReal ? `con la red a su capacidad real, ${ent(usuariosNegocio)} usuarios` : `con la red llena, ${ent(usuariosNegocio)} usuarios (una frecuencia por gateway)`) : `con las ${ent(usuariosNegocio)} personas del mapa`;
  const costo = costoRedTrama(red.gateways.length, red.repetidores.length, usuariosNegocio, "xiao", logistica);
  const inv = costo.inversion;
  caps.push({
    id: "inversion",
    clave: "inversion",
    titulo: "Inversión inicial (CAPEX)",
    subtitulo: `${ent(red.gateways.length)} ${red.gateways.length === 1 ? "sitio gateway" : "sitios gateway"}, ${ent(red.repetidores.length)} repetidores y ${ent(usuariosNegocio)} billeteras`,
    guion: [
      `Montar esta red, ${baseTxt}, cuesta ${pesosHablados(inv.total)}.`,
      `Los sitios gateway, con torre, mini PC, radios y Starlink solar, son ${pesosHablados(inv.sitios)}; los repetidores solares, ${pesosHablados(inv.repetidores)}; las billeteras de ${ent(usuariosNegocio)} personas, ${pesosHablados(inv.personas)}; y la instalación y el transporte, ${pesosHablados(inv.instalacion + inv.transporte)}.`,
      logistica > 1 ? `Ya incluye el recargo de logística de la región, del ${f1((logistica - 1) * 100, 0)} %.` : "",
      `Repartida en usuarios, son ${pesosHablados(inv.total / Math.max(1, usuariosNegocio))} por persona conectada.`,
    ]
      .filter(Boolean)
      .join(" "),
    cifras: [
      { etiqueta: "Inversión total", valor: pesosTrama(inv.total) },
      { etiqueta: "Sitios gateway", valor: pesosTrama(inv.sitios) },
      { etiqueta: "Repetidores", valor: pesosTrama(inv.repetidores) },
      { etiqueta: "Billeteras", valor: pesosTrama(inv.personas) },
      { etiqueta: "Instalación y transporte", valor: pesosTrama(inv.instalacion + inv.transporte) },
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 8 · Operación (OPEX) */
  const m = costo.mensual;
  caps.push({
    id: "operacion",
    clave: "operacion",
    titulo: "Operación mensual (OPEX)",
    subtitulo: `Con la inversión pagada en ${OPERACION_TRAMA.aniosInversion} años`,
    guion: [
      `Operarla cuesta ${pesosHablados(m.total)} al mes: internet Starlink comercial, ${pesosHablados(m.internet)}; mantenimiento de los sitios, ${pesosHablados(m.sitios)}; baterías y visitas a los repetidores, ${pesosHablados(m.repetidores)}; y soporte a los usuarios, ${pesosHablados(m.soporte)}.`,
      `Los repetidores son solares: no pagan energía. Sumando la inversión repartida en ${OPERACION_TRAMA.aniosInversion} años, la red completa cuesta ${pesosHablados(costo.totalMes)} al mes.`,
    ].join(" "),
    cifras: [
      { etiqueta: "Operación al mes", valor: pesosTrama(m.total) },
      { etiqueta: "Internet (Starlink)", valor: pesosTrama(m.internet) },
      { etiqueta: "Sitios y repetidores", valor: pesosTrama(m.sitios + m.repetidores) },
      { etiqueta: "Soporte", valor: pesosTrama(m.soporte) },
      { etiqueta: "Red completa al mes", valor: pesosTrama(costo.totalMes), detalle: `inversión a ${OPERACION_TRAMA.aniosInversion} años + operación` },
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 9 · Punto de equilibrio */
  const eq = equilibrio(inv.total, m.total, usuariosNegocio, pagosDia, d.comisionPago ?? null);
  const usuariosEq = eq.comision ? usuariosParaEquilibrio(red.gateways.length, red.repetidores.length, eq.comision, pagosDia, logistica) : null;
  caps.push({
    id: "equilibrio",
    clave: "equilibrio",
    titulo: "Punto de equilibrio",
    subtitulo: eq.comision ? `Con una comisión de ${pesosTrama(eq.comision)} por pago` : `Con ${f1(pagosDia, 1)} pagos por persona al día`,
    guion: [
      `${muestra ? `Con la red llena, ${ent(eq.usuarios)} usuarios` : `Con ${ent(eq.usuarios)} usuarios`}, la red cuesta ${pesosHablados(eq.costoMesUsuario)} por usuario al mes.`,
      `Si cada uno hace ${f1(pagosDia, 1)} pagos al día, son ${ent(eq.pagosMes)} pagos al mes, y una comisión de ${pesosHablados(eq.comisionEquilibrio)} por pago cubre toda la red, inversión incluida.`,
      eq.comision && eq.ingresosMes !== null
        ? eq.mesesRecuperacion !== null
          ? `Con ${pesosHablados(eq.comision)} por pago, entran ${pesosHablados(eq.ingresosMes)} al mes, quedan ${pesosHablados(eq.margenOperacionMes!)} después de la operación, y la inversión se recupera en ${f1(eq.mesesRecuperacion, 0)} meses.${usuariosEq ? ` La red se paga sola, inversión incluida, desde unos ${ent(usuariosEq)} usuarios.` : ""}`
          : `Con ${pesosHablados(eq.comision)} por pago no alcanza a cubrir la operación: hacen falta más usuarios o una comisión más alta.`
        : "La comisión se puede probar aquí mismo: escriba la que quiera y le digo en cuánto se recupera la inversión.",
    ].join(" "),
    cifras: [
      { etiqueta: "Costo por usuario al mes", valor: pesosTrama(eq.costoMesUsuario) },
      { etiqueta: "Comisión de equilibrio", valor: pesosTrama(eq.comisionEquilibrio), detalle: "por pago, inversión incluida" },
      ...(eq.comision && eq.ingresosMes !== null
        ? [
            { etiqueta: "Ingresos al mes", valor: pesosTrama(eq.ingresosMes), tono: (eq.ingresosMes >= eq.costoMes ? "bien" : "alerta") as CifraPitch["tono"] },
            { etiqueta: "Recupera la inversión", valor: eq.mesesRecuperacion !== null ? `${f1(eq.mesesRecuperacion, 0)} meses` : "no alcanza", tono: (eq.mesesRecuperacion !== null && eq.mesesRecuperacion <= 60 ? "bien" : "mal") as CifraPitch["tono"] },
          ]
        : [{ etiqueta: "Pagos al mes", valor: ent(eq.pagosMes) }]),
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 10 · Escala */
  const pais = DEPARTAMENTOS_TRAMA.map((x) => dimensionarDepartamento(x, adopcion, sf));
  const suma = (k: (x: Dimension) => number) => pais.reduce((s, x) => s + k(x), 0);
  const dd = dep ? dimensionarDepartamento(dep, adopcion, sf) : null;
  caps.push({
    id: "escala",
    clave: "escala",
    titulo: "Cómo escala",
    subtitulo: `Con el ${adopcion} % de adopción`,
    guion: [
      dd
        ? `Llevada a todo ${dep!.nombre} con el ${adopcion} % de los adultos sin canal, serían ${ent(dd.usuarios)} usuarios, ${ent(dd.repetidores)} repetidores y ${ent(dd.sitios)} sitios gateway, con una inversión de ${pesosHablados(dd.costo.total)} y ${pesosHablados(dd.totalMesPorUsuario)} por usuario al mes.`
        : "",
      `En todo el país serían ${ent(suma((x) => x.usuarios))} usuarios, ${ent(suma((x) => x.repetidores))} repetidores y ${ent(suma((x) => x.sitios))} sitios gateway, con ${pesosHablados(suma((x) => x.costo.total))} de inversión.`,
      "Cada sitio se diseña aquí mismo con el relieve real antes de instalarlo, y la red crece por celdas: se agregan repetidores y frecuencias sin rehacer lo que ya está.",
    ]
      .filter(Boolean)
      .join(" "),
    cifras: [
      ...(dd
        ? [
            { etiqueta: `${dep!.nombre}: usuarios`, valor: ent(dd.usuarios) },
            { etiqueta: `${dep!.nombre}: inversión`, valor: pesosTrama(dd.costo.total) },
          ]
        : []),
      { etiqueta: "País: usuarios", valor: ent(suma((x) => x.usuarios)) },
      { etiqueta: "País: repetidores", valor: ent(suma((x) => x.repetidores)) },
      { etiqueta: "País: inversión", valor: pesosTrama(suma((x) => x.costo.total)) },
    ],
    foco: { tipo: "pais" },
  });

  /* 11 · Cierre */
  caps.push({
    id: "cierre",
    clave: "cierre",
    titulo: "Lo que sigue",
    subtitulo: "Del simulador al piloto",
    guion: [
      "Lo que sigue es un piloto: instalar esta red, medir el canal y los pagos reales, y ajustar el modelo con datos de campo.",
      "Todo lo que vieron sale de este simulador: el relieve real, la malla paquete por paquete, la gente en la hora pico y los precios del documento de Trama.",
      "Gracias. Pueden preguntarme lo que quieran sobre la red.",
    ].join(" "),
    cifras: [
      { etiqueta: "Inversión", valor: pesosTrama(inv.total) },
      { etiqueta: "Red completa al mes", valor: pesosTrama(costo.totalMes) },
      { etiqueta: "Comisión de equilibrio", valor: pesosTrama(eq.comisionEquilibrio) },
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  return caps;
}

/** Caja de Colombia para los capítulos del país. */
export const CAJA_COLOMBIA: Caja = [-79.2, -4.3, -66.8, 12.6];

/** Lo que la presentación necesita del mapa (lo da el simulador). */
export type MapaPitch = {
  /** Píxeles dentro del mapa de un punto (null si el mapa no está listo). */
  proyectar(lat: number, lon: number): { x: number; y: number } | null;
  tamano(): { ancho: number; alto: number };
  /** Mueve la cámara al foco dejando libres los márgenes (px); devuelve cuánto tarda (ms). */
  volar(foco: FocoPitch, margen: { izquierda: number; derecha: number; arriba: number; abajo: number }): number;
  /** Avisa cada vez que el mapa se mueve; devuelve cómo dejar de avisar. */
  alMover(fn: () => void): () => void;
};

/** Pedidos de la presentación (por voz, por escrito o desde la IA). */
export type AccionPitch = "empezar" | "siguiente" | "anterior" | "pausar" | "seguir" | "repetir" | "terminar" | "ir";
export type PedidoPitch = { accion: AccionPitch; capitulo?: IdCapitulo; comision?: number };

const CAPITULOS_TEXTO: [RegExp, IdCapitulo][] = [
  [/\bportada|inicio de la presentacion\b/, "portada"],
  [/\bproblema\b/, "problema"],
  [/\bsolucion\b/, "solucion"],
  [/\bantenas?\b|\brepetidor(es)?\b|\bgateway\b/, "antena"],
  [/\bcobertura\b/, "cobertura"],
  [/\bcapacidad\b/, "capacidad"],
  [/\binversion|capex\b/, "inversion"],
  [/\boperacion|opex|costos? mensual/, "operacion"],
  [/\bequilibrio|comision|se paga sol[ao]|recupera/, "equilibrio"],
  [/\bescala|pais|departamento\b/, "escala"],
  [/\bcierre|final|conclusion\b/, "cierre"],
];

/**
 * ¿El texto le pide algo a la presentación? «preséntame el modelo de negocio», «haz el pitch», «siguiente»,
 * «anterior», «pausa», «sigue», «repite», «termina la presentación», «ve a la inversión», «prueba una comisión de
 * 500 pesos». `enCurso`: si la presentación está abierta, también entiende las órdenes cortas.
 */
export function pedidoPitch(texto: string, enCurso: boolean): PedidoPitch | null {
  const base = sinTildes(texto);
  const t = base.replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim().replace(/^(oye |hey |hola )?melk[iy]\s*/, "");
  // La comisión: la cifra en pesos («$1.500», «1.500 pesos»; los puntos son de miles) o la que sigue a «comisión»
  const conMiles = base.replace(/(\d)\.(?=\d{3}(?!\d))/g, "$1");
  const enPesos = conMiles.match(/\$\s*(\d+)|(\d+)\s*(?:pesos|cop)\b/);
  const trasComision = conMiles.match(/comision\D{0,24}?(\d+)/);
  const valor = enPesos ? Number(enPesos[1] ?? enPesos[2]) : trasComision ? Number(trasComision[1]) : undefined;
  const comision = /\bcomision\b/.test(t) && valor ? valor : undefined;
  // Las preguntas («¿qué es el pitch?», «¿cómo funciona la presentación?») las contesta el cerebro
  if (/^(que|como|cual|cuales|para que|por que|cuanto|cuando|donde)\b/.test(t) && !/\b(haz|hazme|inicia|empieza|presenta\w*|muestra\w*|arranca)\b/.test(t)) return null;
  const empezar =
    /\b(pitch|pich|pitch de negocio)\b/.test(t) ||
    /\b(presenta\w*|muestra\w*|explica\w*|expon\w*|ensena\w*)\b.*\b(modelo de negocio|negocio|presentacion|pitch)\b/.test(t) ||
    /\b(inicia|empieza|comienza|arranca|abre|haz|hazme|dame)\w*\b.*\b(presentacion|pitch)\b/.test(t) ||
    /^(modo )?presentacion$/.test(t);
  if (empezar && !/\b(termina|cierra|sal|salir|deten|para)\w*\b/.test(t)) return { accion: "empezar", ...(comision ? { comision } : {}) };
  if (!enCurso) return null;
  if (/\b(termina|cierra|sal|salir|acaba|finaliza|deten)\w*\b.*\b(presentacion|pitch)\b|^(salir|termina|terminar|fin)$/.test(t)) return { accion: "terminar" };
  if (comision) return { accion: "ir", capitulo: "equilibrio", comision };
  const ir = /\b(ve|vamos|ir|pasa|salta|muestra\w*|regresa|vuelve)\w*\b.*\b(a|al|a la)\b/.test(t);
  if (ir) for (const [re, id] of CAPITULOS_TEXTO) if (re.test(t)) return { accion: "ir", capitulo: id };
  if (/^(siguiente|sigue adelante|adelante|continua|avanza|proximo|proxima)( capitulo| diapositiva| paso| parte)?$|\b(siguiente|proxim[oa]) (capitulo|diapositiva|paso|parte)\b/.test(t)) return { accion: "siguiente" };
  if (/^(anterior|atras|regresa|devuelvete)( capitulo| diapositiva)?$|\b(capitulo|diapositiva) anterior\b/.test(t)) return { accion: "anterior" };
  if (/^(pausa|pausala|espera|detente|alto)$|\bpausa\w*\b.*\b(presentacion|pitch)\b/.test(t)) return { accion: "pausar" };
  if (/^(sigue|seguir|reanuda|continua la presentacion|dale|play)$/.test(t)) return { accion: "seguir" };
  if (/^(repite|repitelo|otra vez|de nuevo)$|\brepite (el|ese|este) (capitulo|paso)\b/.test(t)) return { accion: "repetir" };
  return null;
}
