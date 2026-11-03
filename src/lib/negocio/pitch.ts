// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El pitch del modelo de negocio, armado con la red que está en el mapa: el problema y la solución de Trama, cada
// antena (dónde, a qué altura y por qué), la cobertura, la capacidad real, la inversión (CAPEX), la operación (OPEX),
// el costo por usuario, el punto de equilibrio (con la comisión por pago que se quiera probar) y cómo escala al
// departamento y al país. Solo usa cifras del simulador y del documento de Trama: no inventa ingresos. Todo se escribe
// en el idioma de la pantalla (español o inglés); los pedidos se entienden en los dos.
import { numeroLocal, tx } from "../idioma";
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

const ent = (x: number) => numeroLocal(Math.round(x));
const f1 = (x: number, d = 1) => numeroLocal(Math.round(x * 10 ** d) / 10 ** d, { maximumFractionDigits: d });
/** El porcentaje: «45 %» en español, «45%» en inglés. */
const pct = (x: number) => {
  const v = f1(x, x >= 10 ? 0 : 1);
  return tx(`${v} %`, `${v}%`);
};

/**
 * Pesos para decirlos en voz alta: «6,4 millones de pesos», «178 mil pesos» (en inglés, «6.4 million pesos», «178
 * thousand pesos», «1.5 billion pesos»).
 */
export function pesosHablados(v: number): string {
  const n = (x: number, d: number) => numeroLocal(x, { maximumFractionDigits: d });
  if (v >= 1e12) return tx(`${n(v / 1e12, 1)} billones de pesos`, `${n(v / 1e12, 1)} trillion pesos`);
  if (v >= 1e9) return tx(`${n(v / 1e9, 1)} mil millones de pesos`, `${n(v / 1e9, 1)} billion pesos`);
  if (v >= 1e6) return tx(`${n(v / 1e6, v >= 1e8 ? 0 : 1)} millones de pesos`, `${n(v / 1e6, v >= 1e8 ? 0 : 1)} million pesos`);
  if (v >= 1e4) return tx(`${n(Math.round(v / 1000), 0)} mil pesos`, `${n(Math.round(v / 1000), 0)} thousand pesos`);
  return tx(`${n(Math.round(v), 0)} pesos`, `${n(Math.round(v), 0)} pesos`);
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
    titulo: tx("Trama: pagos, WhatsApp e IA donde no hay señal", "Trama: payments, WhatsApp and AI where there's no signal"),
    subtitulo: d.nombre ? `${d.nombre}${dondeTxt ? ` · ${dondeTxt}` : ""}` : (dondeTxt ?? tx("Red por radio LoRa de Melki", "Melki's LoRa radio network")),
    guion: [
      tx("Buenas, soy Melki, el asistente del simulador de cobertura.", "Good day. I'm Melki, the Coverage Simulator's assistant."),
      tx(
        `Les presento la red Trama${dondeTxt ? ` que diseñamos para ${dondeTxt}` : ""}: una malla de radio LoRa que lleva pagos, mensajes de WhatsApp por texto y consultas a la inteligencia artificial a donde no llega la señal del celular.`,
        `Allow me to present the Trama network${dondeTxt ? ` we designed for ${dondeTxt}` : ""}: a LoRa radio mesh that carries payments, WhatsApp text messages and queries to artificial intelligence to places the mobile signal doesn't reach.`,
      ),
      tx(
        "Vamos a recorrer el problema, la red antena por antena, lo que cubre, cuánta gente atiende de verdad, cuánto cuesta montarla y operarla, y cuándo se paga sola.",
        "We'll go through the problem, the network antenna by antenna, what it covers, how many people it truly serves, what it costs to build and run, and when it pays for itself.",
      ),
    ].join(" "),
    cifras: [
      { etiqueta: "Gateways", valor: ent(red.gateways.length) },
      { etiqueta: tx("Repetidores", "Repeaters"), valor: ent(red.repetidores.length) },
      { etiqueta: tx("Personas en el mapa", "People on the map"), valor: ent(personas) },
      { etiqueta: tx("Protocolo", "Protocol"), valor: protocolo.nombre, detalle: preset.nombre },
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 2 · El problema */
  const sinCanalPais = DEPARTAMENTOS_TRAMA.reduce((s, x) => s + (x.sinCanal[0] + x.sinCanal[1]) / 2, 0);
  const rurales = DEPARTAMENTOS_TRAMA.reduce((s, x) => s + x.rurales, 0);
  caps.push({
    id: "problema",
    clave: "problema",
    titulo: tx("El problema: territorios sin canal digital", "The problem: territories with no digital channel"),
    subtitulo: dep ? tx(`${dep.nombre}, puesto ${dep.puesto} de 33`, `${dep.nombre}, ranked ${dep.puesto} of 33`) : tx("Colombia rural", "Rural Colombia"),
    guion: dep
      ? tx(
          `En ${dep.nombre} viven ${ent(dep.rurales)} personas en el campo y entre ${ent(dep.sinCanal[0])} y ${ent(dep.sinCanal[1])} adultos no tienen ningún canal digital: no pueden pagar, recibir un giro ni consultar nada sin viajar al pueblo. ${dep.ruralUsaInternetPct < 60 ? "Solo el" : "El"} ${f1(dep.ruralUsaInternetPct, 0)} % de la población rural usa internet${dep.ruralUsaInternetPct >= 60 ? ", pero en las veredas alejadas no hay señal" : ""}. En todo el país son cerca de ${ent(sinCanalPais)} adultos rurales en esa situación.`,
          `In ${dep.nombre}, ${ent(dep.rurales)} people live in the countryside, and between ${ent(dep.sinCanal[0])} and ${ent(dep.sinCanal[1])} adults have no digital channel at all: they can't pay, receive a money transfer or look anything up without traveling to town. ${dep.ruralUsaInternetPct < 60 ? "Only " : ""}${f1(dep.ruralUsaInternetPct, 0)}% of the rural population uses the internet${dep.ruralUsaInternetPct >= 60 ? ", but in the outlying villages there is no signal" : ""}. Across the country, close to ${ent(sinCanalPais)} rural adults are in that situation.`,
        )
      : tx(
          `En la Colombia rural viven unos ${ent(rurales)} personas, y cerca de ${ent(sinCanalPais)} adultos no tienen ningún canal digital: no pueden pagar, recibir un giro ni consultar nada sin viajar al pueblo. Llevar fibra o torres celulares a esas veredas no es rentable para nadie.`,
          `Some ${ent(rurales)} people live in rural Colombia, and close to ${ent(sinCanalPais)} adults have no digital channel at all: they can't pay, receive a money transfer or look anything up without traveling to town. Bringing fiber or cell towers to those villages pays off for no one.`,
        ),
    cifras: dep
      ? [
          { etiqueta: tx("Personas rurales", "Rural population"), valor: ent(dep.rurales) },
          { etiqueta: tx("Adultos sin canal digital", "Adults with no digital channel"), valor: `${ent(dep.sinCanal[0])}–${ent(dep.sinCanal[1])}`, tono: "mal" },
          { etiqueta: tx("Rural que usa internet", "Rural internet use"), valor: pct(dep.ruralUsaInternetPct) },
          { etiqueta: tx("En el país", "Nationwide"), valor: ent(sinCanalPais), detalle: tx("adultos rurales sin canal", "rural adults with no channel") },
        ]
      : [
          { etiqueta: tx("Personas rurales", "Rural population"), valor: ent(rurales) },
          { etiqueta: tx("Adultos sin canal digital", "Adults with no digital channel"), valor: ent(sinCanalPais), tono: "mal" },
        ],
    foco: { tipo: "pais" },
  });

  /* 3 · La solución */
  caps.push({
    id: "solucion",
    clave: "solucion",
    titulo: tx("La solución: una malla de radio que se paga sola", "The solution: a radio mesh that pays for itself"),
    subtitulo: `${protocolo.nombre} · LoRa ${f1(d.parametros.frecuenciaMhz, 1)} MHz`,
    guion: [
      tx("Cada persona lleva una billetera de radio del tamaño de un llavero, emparejada con su celular por Bluetooth.", "Each person carries a radio wallet the size of a key fob, paired with their phone over Bluetooth."),
      tx(
        "El mensaje salta de repetidor en repetidor: equipos solares SenseCAP P1 en un tubo de seis metros, que no necesitan red eléctrica ni internet.",
        "The message hops from repeater to repeater: solar-powered SenseCAP P1 units on a six-meter pole, which need neither grid power nor internet.",
      ),
      tx(
        "Al final llega al gateway, un mini PC con radios LoRa y Starlink, que lo entrega a internet y trae la respuesta: el comprobante del pago, el WhatsApp o lo que contestó la inteligencia artificial.",
        "Finally it reaches the gateway, a mini PC with LoRa radios and Starlink, which hands it to the internet and brings back the reply: the payment receipt, the WhatsApp message or the artificial intelligence's answer.",
      ),
      tx(
        `La red usa ${protocolo.nombre}: ${preset.protocolo === "meshcore" ? "solo repiten los repetidores y la ruta se aprende, así el canal se cuida" : "todos pueden repetir con inundación administrada, y en redes grandes los equipos de las personas se dejan mudos"}.`,
        `The network runs ${protocolo.nombre}: ${preset.protocolo === "meshcore" ? "only the repeaters relay and the route is learned, which keeps the channel clear" : "every device can relay through managed flooding, and in large networks people's devices are kept muted"}.`,
      ),
    ].join(" "),
    cifras: [
      { etiqueta: tx("Repetidor solar", "Solar repeater"), valor: pesosTrama(PRECIOS.repetidor), detalle: tx("P1 + antena 8 dBi + tubo 6 m", "P1 + 8 dBi antenna + 6 m pole") },
      { etiqueta: tx("Sitio gateway", "Gateway site"), valor: pesosTrama(PRECIOS.sitioBase + PRECIOS.radio + PRECIOS.starlink), detalle: tx("torre 12 m, mini PC, Starlink solar", "12 m tower, mini PC, solar Starlink") },
      { etiqueta: tx("Billetera", "Wallet"), valor: pesosTrama(PRECIOS.nodo.xiao), detalle: "XIAO + Wio-SX1262" },
      { etiqueta: tx("Saltos máximos", "Max hops"), valor: ent(Math.min(d.parametros.limiteSaltos, protocolo.saltosMax)) },
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
    frases.push(tx(`${a.nombre}${sitioTxt ? `, en ${sitioTxt}` : ""}.`, `${a.nombre}${sitioTxt ? `, in ${sitioTxt}` : ""}.`));
    if (conSuelo)
      frases.push(
        tx(
          `El suelo está a ${ent(res!.elevacionM)} m sobre el nivel del mar y la antena va a ${f1(a.alturaM, 1)} m ${gw ? "en la torre del sitio" : "en su mástil"}.`,
          `The ground is ${ent(res!.elevacionM)} m above sea level and the antenna sits at ${f1(a.alturaM, 1)} m ${gw ? "on the site's tower" : "on its mast"}.`,
        ),
      );
    else frases.push(tx(`La antena va a ${f1(a.alturaM, 1)} m ${gw ? "en la torre del sitio" : "en su mástil"}.`, `The antenna sits at ${f1(a.alturaM, 1)} m ${gw ? "on the site's tower" : "on its mast"}.`));
    if (gw)
      frases.push(
        tx(
          "Es el gateway: aquí entra internet por Starlink y se atienden los pagos, los WhatsApp y las consultas a la IA.",
          "This is the gateway: the internet comes in here through Starlink, and this is where payments, WhatsApp messages and AI queries are handled.",
        ),
      );
    if (enlace) {
      const m = enlace.margen;
      const vista = enlace.lineaVista ? "con línea de vista despejada" : "sin línea de vista, por difracción sobre el terreno";
      const vistaEn = enlace.lineaVista ? "with a clear line of sight" : "without line of sight, by diffraction over the terrain";
      frases.push(
        tx(
          `Se enlaza con ${nombreDe(d.antenas, siguienteId!)} a ${f1(enlace.distanciaKm, 1)} km, ${vista}, con ${f1(m, 0)} dB de margen: ${m >= 37 ? "un enlace sólido que aguanta lluvia y follaje" : m >= 30 ? "un enlace bueno" : m >= 20 ? "un enlace que funciona pero es inestable" : "un enlace que no alcanza"}.`,
          `It links to ${nombreDe(d.antenas, siguienteId!)}, ${f1(enlace.distanciaKm, 1)} km away, ${vistaEn}, with ${f1(m, 0)} dB of margin: ${m >= 37 ? "a solid link that holds up to rain and foliage" : m >= 30 ? "a good link" : m >= 20 ? "a link that works but is unstable" : "a link that falls short"}.`,
        ),
      );
      cifras.push({
        etiqueta: tx(`Enlace con ${nombreDe(d.antenas, siguienteId!)}`, `Link to ${nombreDe(d.antenas, siguienteId!)}`),
        valor: `${f1(m, 0)} dB`,
        detalle: `${f1(enlace.distanciaKm, 1)} km · ${enlace.lineaVista ? tx("línea de vista", "line of sight") : tx("difracción", "diffraction")}`,
        tono: m >= 30 ? "bien" : m >= 20 ? "alerta" : "mal",
      });
    }
    // Por qué aquí y a esta altura
    if (!gw) {
      if (a.alturaM < 6) frases.push(tx("Conviene subirla al menos a 6 m, el tubo estándar de Trama, para despejar techos y árboles.", "It should be raised to at least 6 m, Trama's standard pole, to clear roofs and trees."));
      else if (enlace && enlace.margen < 30)
        frases.push(
          tx(
            "Para que quede estable conviene subirla a 9 o 12 m o moverla a la loma más alta cercana; el Ajuste inteligente prueba alturas y lomas hasta dejarla firme.",
            "To make it stable, it should go up to 9 or 12 m or move to the highest nearby hill; the automatic adjustment tries heights and hills until it holds firm.",
          ),
        );
      else if (enlace) frases.push(tx(`A ${f1(a.alturaM, 0)} m alcanza con holgura: no hace falta una torre más alta, y eso abarata la instalación.`, `At ${f1(a.alturaM, 0)} m it reaches comfortably: no taller tower is needed, which keeps the installation cheaper.`));
    }
    if (res && res.areaServicioKm2 > 0) {
      frases.push(tx(`Da servicio en ${ent(res.areaServicioKm2)} km², con un alcance de hasta ${f1(res.alcanceKm, 1)} km.`, `It provides service over ${ent(res.areaServicioKm2)} km², with a range of up to ${f1(res.alcanceKm, 1)} km.`));
      cifras.push({ etiqueta: tx("Área con servicio", "Area with service"), valor: `${ent(res.areaServicioKm2)} km²`, detalle: tx(`alcance ${f1(res.alcanceKm, 1)} km`, `range ${f1(res.alcanceKm, 1)} km`) });
    }
    const at = atendidas.get(a.id) ?? 0;
    if (at) frases.push(at === 1 ? tx("Por aquí entra 1 persona a la red.", "1 person enters the network here.") : tx(`Por aquí entran ${ent(at)} personas a la red.`, `${ent(at)} people enter the network here.`));
    if (n?.critico)
      frases.push(
        tx(
          "Es un punto crítico: si se apaga, otros nodos quedan sin camino al gateway; un repetidor de respaldo lo resuelve.",
          "It is a critical point: if it goes down, other nodes are left without a path to the gateway; a backup repeater solves that.",
        ),
      );
    cifras.unshift({ etiqueta: tx("Altura de la antena", "Antenna height"), valor: `${f1(a.alturaM, 1)} m`, detalle: conSuelo ? tx(`suelo a ${ent(res!.elevacionM)} m s. n. m.`, `ground at ${ent(res!.elevacionM)} m a.s.l.`) : undefined });
    cifras.splice(1, 0, { etiqueta: tx("Ubicación", "Location"), valor: `${a.lat.toFixed(5)}, ${a.lon.toFixed(5)}`, detalle: sitioTxt ?? undefined });
    if (!gw && n) cifras.push({ etiqueta: tx("Saltos al gateway", "Hops to the gateway"), valor: n.saltos === null ? tx("sin ruta", "no route") : ent(n.saltos), tono: n.saltos === null ? "mal" : undefined });
    if (at) cifras.push({ etiqueta: tx("Personas que entran aquí", "People entering here"), valor: ent(at) });
    caps.push({
      id: "antena",
      clave: `antena-${a.id}`,
      titulo: a.nombre,
      subtitulo: gw ? tx("Gateway · Starlink + radios LoRa", "Gateway · Starlink + LoRa radios") : tx("Repetidor solar · SenseCAP P1", "Solar repeater · SenseCAP P1"),
      guion: frases.join(" "),
      cifras: cifras.slice(0, 6),
      foco: { tipo: "punto", lat: a.lat, lon: a.lon, zoom: gw ? 12.5 : 13 },
      antena: a.id,
    });
  }
  if (orden.length > MAX_ANTENAS) {
    const resto = orden.length - MAX_ANTENAS;
    caps[caps.length - 1].guion += tx(
      ` Y ${resto} ${resto === 1 ? "antena más" : "antenas más"} con el mismo criterio, que pueden ver en el mapa.`,
      ` And ${resto} ${resto === 1 ? "more antenna" : "more antennas"} placed by the same criteria, which you can see on the map.`,
    );
  }

  /* 5 · Cobertura */
  if (r) {
    const util = r.areaObjetivo ? r.areaObjetivo.utilPct : r.porcentajeUtil;
    const servicio = r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio;
    const areaTxt = r.areaObjetivo
      ? tx(`del área objetivo, ${ent(r.areaObjetivo.areaKm2)} km²`, `of the target area, ${ent(r.areaObjetivo.areaKm2)} km²`)
      : tx(`del área de estudio, ${ent(r.areaEstudioKm2)} km²`, `of the study area, ${ent(r.areaEstudioKm2)} km²`);
    const recomienda = primeraFrase(r.factibilidad.recomendaciones[0]);
    caps.push({
      id: "cobertura",
      clave: "cobertura",
      titulo: tx("Cobertura simulada con el relieve real", "Coverage simulated with the real terrain"),
      subtitulo: r.factibilidad.titulo,
      guion: [
        tx(
          `Con el relieve real, la red da servicio en el ${f1(servicio, 0)} % ${areaTxt}, y en el ${f1(util, 0)} % la señal es media o mejor, lo que se necesita para pagar sin reintentos.`,
          `With the real terrain, the network provides service over ${f1(servicio, 0)}% ${areaTxt}, and over ${f1(util, 0)}% the signal is fair or better, which is what it takes to pay without retries.`,
        ),
        tx(
          `${ent(conectadas)} de ${ent(personas)} personas del mapa llegan al gateway${red.saltosMax ? ` en máximo ${red.saltosMax} ${red.saltosMax === 1 ? "salto" : "saltos"}` : ""}.`,
          `${ent(conectadas)} of the ${ent(personas)} people on the map ${conectadas === 1 ? "reaches" : "reach"} the gateway${red.saltosMax ? ` in at most ${red.saltosMax} ${red.saltosMax === 1 ? "hop" : "hops"}` : ""}.`,
        ),
        tx(
          `El simulador la califica como «${r.factibilidad.titulo}».${recomienda ? ` Lo siguiente que recomienda: ${recomienda}.` : ""}`,
          `The simulator rates it as “${r.factibilidad.titulo}”.${recomienda ? ` Its next recommendation: ${recomienda}.` : ""}`,
        ),
      ].join(" "),
      cifras: [
        { etiqueta: tx("Con servicio", "With service"), valor: pct(servicio), tono: servicio >= 80 ? "bien" : servicio >= 50 ? "alerta" : "mal" },
        { etiqueta: tx("Señal media o mejor", "Fair signal or better"), valor: pct(util), tono: util >= 60 ? "bien" : util >= 40 ? "alerta" : "mal" },
        { etiqueta: tx("Personas conectadas", "Connected people"), valor: tx(`${ent(conectadas)} de ${ent(personas)}`, `${ent(conectadas)} of ${ent(personas)}`) },
        { etiqueta: tx("Área", "Area"), valor: `${ent(r.areaObjetivo?.areaKm2 ?? r.areaEstudioKm2)} km²` },
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
    titulo: tx("Capacidad real, persona por persona", "Real capacity, person by person"),
    subtitulo: e ? tx(`Hora pico simulada paquete por paquete · ${protocolo.nombre}`, `Peak hour simulated packet by packet · ${protocolo.nombre}`) : tx(`Diseño de capacidad de Trama · SF${sf}`, `Trama capacity design · SF${sf}`),
    guion: e
      ? [
          tx(
            `Pusimos a toda la gente a usar la red en la hora más cargada del día: ${f1(e.pagosPersonaDia, 1)} mensajes por persona al día, el ${e.horaPicoPct} % en esa hora.`,
            `We had everyone use the network during the busiest hour of the day: ${f1(e.pagosPersonaDia, 1)} messages per person per day, ${e.horaPicoPct}% of them in that hour.`,
          ),
          tx(
            `De ${ent(e.resumenUsuarios.total)} personas, a ${ent(e.resumenUsuarios.funcionan)} les funciona: el ${f1(e.resumenUsuarios.funcionanPct, 0)} %. El ${f1(e.completosPct, 0)} % de los mensajes vuelve con respuesta, y el canal del gateway está ocupado el ${f1(e.canalGatewayPct, 0)} % del tiempo.`,
            `Of ${ent(e.resumenUsuarios.total)} people, it works for ${ent(e.resumenUsuarios.funcionan)}: ${f1(e.resumenUsuarios.funcionanPct, 0)}%. ${f1(e.completosPct, 0)}% of the messages come back with a reply, and the gateway channel is busy ${f1(e.canalGatewayPct, 0)}% of the time.`,
          ),
          capReal ? tx(`Subiendo la carga, la capacidad real de esta red es de unas ${ent(capReal)} personas atendidas.`, `Ramping up the load, this network's real capacity is about ${ent(capReal)} people served.`) : "",
          tx(
            `Cada frecuencia de Trama atiende unos ${ent(SF_TRAMA[sf].usuariosFrecuencia)} usuarios con SF${sf}, y un sitio tiene hasta ${CAPACIDAD_TRAMA.radiosPorSitio} frecuencias: si la red crece, se suman radios o sitios, no se rehace.`,
            `Each Trama frequency serves about ${ent(SF_TRAMA[sf].usuariosFrecuencia)} users with SF${sf}, and a site holds up to ${CAPACIDAD_TRAMA.radiosPorSitio} frequencies: if the network grows, you add radios or sites; you don't rebuild it.`,
          ),
        ]
          .filter(Boolean)
          .join(" ")
      : tx(
          `Cada frecuencia de Trama atiende unos ${ent(SF_TRAMA[sf].usuariosFrecuencia)} usuarios con SF${sf} y el canal al ${CAPACIDAD_TRAMA.canalPicoPct} % en la hora pico. Con ${radios === 1 ? "una radio en el gateway" : `${ent(radios)} radios en los gateways`}, esta red atiende unas ${ent(capacidadDoc)} personas, y cada sitio admite hasta ${CAPACIDAD_TRAMA.radiosPorSitio} frecuencias: hasta ${ent(capacidadDoc * CAPACIDAD_TRAMA.radiosPorSitio)} personas sumando radios de unos ${pesosHablados(PRECIOS.radio)} cada una. La prueba de estrés lo confirma persona por persona.`,
          `Each Trama frequency serves about ${ent(SF_TRAMA[sf].usuariosFrecuencia)} users with SF${sf}, with the channel at ${CAPACIDAD_TRAMA.canalPicoPct}% at peak hour. With ${radios === 1 ? "one radio at the gateway" : `${ent(radios)} radios at the gateways`}, this network serves about ${ent(capacidadDoc)} people, and each site takes up to ${CAPACIDAD_TRAMA.radiosPorSitio} frequencies: up to ${ent(capacidadDoc * CAPACIDAD_TRAMA.radiosPorSitio)} people by adding radios at about ${pesosHablados(PRECIOS.radio)} each. The stress test confirms it person by person.`,
        ),
    cifras: e
      ? [
          {
            etiqueta: tx("Les funciona", "Works for"),
            valor: pct(e.resumenUsuarios.funcionanPct),
            detalle: tx(`${ent(e.resumenUsuarios.funcionan)} de ${ent(e.resumenUsuarios.total)}`, `${ent(e.resumenUsuarios.funcionan)} of ${ent(e.resumenUsuarios.total)}`),
            tono: e.resumenUsuarios.funcionanPct >= 90 ? "bien" : e.resumenUsuarios.funcionanPct >= 60 ? "alerta" : "mal",
          },
          { etiqueta: tx("Mensajes con respuesta", "Messages answered"), valor: pct(e.completosPct) },
          { etiqueta: tx("Canal del gateway", "Gateway channel"), valor: pct(e.canalGatewayPct), tono: e.canalGatewayPct <= 30 ? "bien" : e.canalGatewayPct <= 60 ? "alerta" : "mal" },
          {
            etiqueta: tx("Capacidad real", "Real capacity"),
            valor: capReal ? tx(`${ent(capReal)} personas`, `${ent(capReal)} people`) : "—",
            detalle: capReal ? tx("con la rampa de carga", "with the load ramp") : tx("pida «¿hasta dónde aguanta?»", "ask “how much can it handle?”"),
          },
        ]
      : [
          { etiqueta: tx("Usuarios por frecuencia", "Users per frequency"), valor: ent(SF_TRAMA[sf].usuariosFrecuencia), detalle: `SF${sf}` },
          { etiqueta: tx("Radios en gateways", "Radios at gateways"), valor: ent(radios), detalle: tx(`hasta ${CAPACIDAD_TRAMA.radiosPorSitio} por sitio`, `up to ${CAPACIDAD_TRAMA.radiosPorSitio} per site`) },
          {
            etiqueta: tx("Capacidad de diseño", "Design capacity"),
            valor: tx(`${ent(capacidadDoc)} personas`, `${ent(capacidadDoc)} people`),
            detalle: tx(`${ent(capacidadDoc * CAPACIDAD_TRAMA.radiosPorSitio)} con ${CAPACIDAD_TRAMA.radiosPorSitio} radios`, `${ent(capacidadDoc * CAPACIDAD_TRAMA.radiosPorSitio)} with ${CAPACIDAD_TRAMA.radiosPorSitio} radios`),
          },
        ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 7 · Inversión (CAPEX) */
  const logistica = dep?.logistica ?? 1;
  // Con pocas personas en el mapa (una muestra), las cuentas van con la red llena: su capacidad real o la de diseño
  const muestra = personas < 50;
  const usuariosNegocio = muestra ? Math.max(personas, capReal ?? capacidadDoc) : personas;
  const baseTxt = muestra
    ? capReal
      ? tx(`con la red a su capacidad real, ${ent(usuariosNegocio)} usuarios`, `with the network at its real capacity, ${ent(usuariosNegocio)} users`)
      : tx(`con la red llena, ${ent(usuariosNegocio)} usuarios (una frecuencia por gateway)`, `with the network full, ${ent(usuariosNegocio)} users (one frequency per gateway)`)
    : tx(`con las ${ent(usuariosNegocio)} personas del mapa`, `with the ${ent(usuariosNegocio)} people on the map`);
  const costo = costoRedTrama(red.gateways.length, red.repetidores.length, usuariosNegocio, "xiao", logistica);
  const inv = costo.inversion;
  caps.push({
    id: "inversion",
    clave: "inversion",
    titulo: tx("Inversión inicial (CAPEX)", "Initial investment (CAPEX)"),
    subtitulo: tx(
      `${ent(red.gateways.length)} ${red.gateways.length === 1 ? "sitio gateway" : "sitios gateway"}, ${ent(red.repetidores.length)} repetidores y ${ent(usuariosNegocio)} billeteras`,
      `${ent(red.gateways.length)} ${red.gateways.length === 1 ? "gateway site" : "gateway sites"}, ${ent(red.repetidores.length)} ${red.repetidores.length === 1 ? "repeater" : "repeaters"} and ${ent(usuariosNegocio)} ${usuariosNegocio === 1 ? "wallet" : "wallets"}`,
    ),
    guion: [
      tx(`Montar esta red, ${baseTxt}, cuesta ${pesosHablados(inv.total)}.`, `Building this network, ${baseTxt}, costs ${pesosHablados(inv.total)}.`),
      tx(
        `Los sitios gateway, con torre, mini PC, radios y Starlink solar, son ${pesosHablados(inv.sitios)}; los repetidores solares, ${pesosHablados(inv.repetidores)}; las billeteras de ${ent(usuariosNegocio)} personas, ${pesosHablados(inv.personas)}; y la instalación y el transporte, ${pesosHablados(inv.instalacion + inv.transporte)}.`,
        `The gateway sites, with tower, mini PC, radios and solar Starlink, come to ${pesosHablados(inv.sitios)}; the solar repeaters, ${pesosHablados(inv.repetidores)}; the wallets for ${ent(usuariosNegocio)} people, ${pesosHablados(inv.personas)}; and installation and transport, ${pesosHablados(inv.instalacion + inv.transporte)}.`,
      ),
      logistica > 1 ? tx(`Ya incluye el recargo de logística de la región, del ${f1((logistica - 1) * 100, 0)} %.`, `That already includes the region's ${f1((logistica - 1) * 100, 0)}% logistics surcharge.`) : "",
      tx(`Repartida en usuarios, son ${pesosHablados(inv.total / Math.max(1, usuariosNegocio))} por persona conectada.`, `Spread across users, that comes to ${pesosHablados(inv.total / Math.max(1, usuariosNegocio))} per connected person.`),
    ]
      .filter(Boolean)
      .join(" "),
    cifras: [
      { etiqueta: tx("Inversión total", "Total investment"), valor: pesosTrama(inv.total) },
      { etiqueta: tx("Sitios gateway", "Gateway sites"), valor: pesosTrama(inv.sitios) },
      { etiqueta: tx("Repetidores", "Repeaters"), valor: pesosTrama(inv.repetidores) },
      { etiqueta: tx("Billeteras", "Wallets"), valor: pesosTrama(inv.personas) },
      { etiqueta: tx("Instalación y transporte", "Installation and transport"), valor: pesosTrama(inv.instalacion + inv.transporte) },
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 8 · Operación (OPEX) */
  const m = costo.mensual;
  caps.push({
    id: "operacion",
    clave: "operacion",
    titulo: tx("Operación mensual (OPEX)", "Monthly operation (OPEX)"),
    subtitulo: tx(`Con la inversión pagada en ${OPERACION_TRAMA.aniosInversion} años`, `With the investment paid over ${OPERACION_TRAMA.aniosInversion} years`),
    guion: [
      tx(
        `Operarla cuesta ${pesosHablados(m.total)} al mes: internet Starlink comercial, ${pesosHablados(m.internet)}; mantenimiento de los sitios, ${pesosHablados(m.sitios)}; baterías y visitas a los repetidores, ${pesosHablados(m.repetidores)}; y soporte a los usuarios, ${pesosHablados(m.soporte)}.`,
        `Running it costs ${pesosHablados(m.total)} a month: commercial Starlink internet, ${pesosHablados(m.internet)}; site maintenance, ${pesosHablados(m.sitios)}; batteries and visits to the repeaters, ${pesosHablados(m.repetidores)}; and user support, ${pesosHablados(m.soporte)}.`,
      ),
      tx(
        `Los repetidores son solares: no pagan energía. Sumando la inversión repartida en ${OPERACION_TRAMA.aniosInversion} años, la red completa cuesta ${pesosHablados(costo.totalMes)} al mes.`,
        `The repeaters are solar: they pay nothing for power. Adding the investment spread over ${OPERACION_TRAMA.aniosInversion} years, the whole network costs ${pesosHablados(costo.totalMes)} a month.`,
      ),
    ].join(" "),
    cifras: [
      { etiqueta: tx("Operación al mes", "Operation per month"), valor: pesosTrama(m.total) },
      { etiqueta: "Internet (Starlink)", valor: pesosTrama(m.internet) },
      { etiqueta: tx("Sitios y repetidores", "Sites and repeaters"), valor: pesosTrama(m.sitios + m.repetidores) },
      { etiqueta: tx("Soporte", "Support"), valor: pesosTrama(m.soporte) },
      {
        etiqueta: tx("Red completa al mes", "Whole network per month"),
        valor: pesosTrama(costo.totalMes),
        detalle: tx(`inversión a ${OPERACION_TRAMA.aniosInversion} años + operación`, `investment over ${OPERACION_TRAMA.aniosInversion} years + operation`),
      },
    ],
    foco: { tipo: "red", caja: cajaRed },
  });

  /* 9 · Punto de equilibrio */
  const eq = equilibrio(inv.total, m.total, usuariosNegocio, pagosDia, d.comisionPago ?? null);
  const usuariosEq = eq.comision ? usuariosParaEquilibrio(red.gateways.length, red.repetidores.length, eq.comision, pagosDia, logistica) : null;
  caps.push({
    id: "equilibrio",
    clave: "equilibrio",
    titulo: tx("Punto de equilibrio", "Break-even point"),
    subtitulo: eq.comision
      ? tx(`Con una comisión de ${pesosTrama(eq.comision)} por pago`, `With a commission of ${pesosTrama(eq.comision)} per payment`)
      : tx(`Con ${f1(pagosDia, 1)} pagos por persona al día`, `With ${f1(pagosDia, 1)} payments per person per day`),
    guion: [
      tx(
        `${muestra ? `Con la red llena, ${ent(eq.usuarios)} usuarios` : `Con ${ent(eq.usuarios)} usuarios`}, la red cuesta ${pesosHablados(eq.costoMesUsuario)} por usuario al mes.`,
        `${muestra ? `With the network full, ${ent(eq.usuarios)} users` : `With ${ent(eq.usuarios)} users`}, the network costs ${pesosHablados(eq.costoMesUsuario)} per user per month.`,
      ),
      tx(
        `Si cada uno hace ${f1(pagosDia, 1)} pagos al día, son ${ent(eq.pagosMes)} pagos al mes, y una comisión de ${pesosHablados(eq.comisionEquilibrio)} por pago cubre toda la red, inversión incluida.`,
        `If each one makes ${f1(pagosDia, 1)} payments a day, that's ${ent(eq.pagosMes)} payments a month, and a commission of ${pesosHablados(eq.comisionEquilibrio)} per payment covers the whole network, investment included.`,
      ),
      eq.comision && eq.ingresosMes !== null
        ? eq.mesesRecuperacion !== null
          ? tx(
              `Con ${pesosHablados(eq.comision)} por pago, entran ${pesosHablados(eq.ingresosMes)} al mes, quedan ${pesosHablados(eq.margenOperacionMes!)} después de la operación, y la inversión se recupera en ${f1(eq.mesesRecuperacion, 0)} meses.${usuariosEq ? ` La red se paga sola, inversión incluida, desde unos ${ent(usuariosEq)} usuarios.` : ""}`,
              `At ${pesosHablados(eq.comision)} per payment, ${pesosHablados(eq.ingresosMes)} comes in each month, ${pesosHablados(eq.margenOperacionMes!)} remains after operating costs, and the investment is recovered in ${f1(eq.mesesRecuperacion, 0)} months.${usuariosEq ? ` The network pays for itself, investment included, from about ${ent(usuariosEq)} users.` : ""}`,
            )
          : tx(
              `Con ${pesosHablados(eq.comision)} por pago no alcanza a cubrir la operación: hacen falta más usuarios o una comisión más alta.`,
              `At ${pesosHablados(eq.comision)} per payment it doesn't cover the operating costs: it needs more users or a higher commission.`,
            )
        : tx(
            "La comisión se puede probar aquí mismo: escriba la que quiera y le digo en cuánto se recupera la inversión.",
            "You can try a commission right here: type any amount and I'll tell you how long it takes to recover the investment.",
          ),
    ].join(" "),
    cifras: [
      { etiqueta: tx("Costo por usuario al mes", "Cost per user per month"), valor: pesosTrama(eq.costoMesUsuario) },
      { etiqueta: tx("Comisión de equilibrio", "Break-even commission"), valor: pesosTrama(eq.comisionEquilibrio), detalle: tx("por pago, inversión incluida", "per payment, investment included") },
      ...(eq.comision && eq.ingresosMes !== null
        ? [
            { etiqueta: tx("Ingresos al mes", "Revenue per month"), valor: pesosTrama(eq.ingresosMes), tono: (eq.ingresosMes >= eq.costoMes ? "bien" : "alerta") as CifraPitch["tono"] },
            {
              etiqueta: tx("Recupera la inversión", "Investment recovered in"),
              valor: eq.mesesRecuperacion !== null ? tx(`${f1(eq.mesesRecuperacion, 0)} meses`, `${f1(eq.mesesRecuperacion, 0)} months`) : tx("no alcanza", "not reached"),
              tono: (eq.mesesRecuperacion !== null && eq.mesesRecuperacion <= 60 ? "bien" : "mal") as CifraPitch["tono"],
            },
          ]
        : [{ etiqueta: tx("Pagos al mes", "Payments per month"), valor: ent(eq.pagosMes) }]),
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
    titulo: tx("Cómo escala", "How it scales"),
    subtitulo: tx(`Con el ${adopcion} % de adopción`, `With ${adopcion}% adoption`),
    guion: [
      dd
        ? tx(
            `Llevada a todo ${dep!.nombre} con el ${adopcion} % de los adultos sin canal, serían ${ent(dd.usuarios)} usuarios, ${ent(dd.repetidores)} repetidores y ${ent(dd.sitios)} sitios gateway, con una inversión de ${pesosHablados(dd.costo.total)} y ${pesosHablados(dd.totalMesPorUsuario)} por usuario al mes.`,
            `Extended to all of ${dep!.nombre}, with ${adopcion}% of the adults who lack a channel, that would be ${ent(dd.usuarios)} users, ${ent(dd.repetidores)} repeaters and ${ent(dd.sitios)} gateway sites, with an investment of ${pesosHablados(dd.costo.total)} and ${pesosHablados(dd.totalMesPorUsuario)} per user per month.`,
          )
        : "",
      tx(
        `En todo el país serían ${ent(suma((x) => x.usuarios))} usuarios, ${ent(suma((x) => x.repetidores))} repetidores y ${ent(suma((x) => x.sitios))} sitios gateway, con ${pesosHablados(suma((x) => x.costo.total))} de inversión.`,
        `Nationwide it would be ${ent(suma((x) => x.usuarios))} users, ${ent(suma((x) => x.repetidores))} repeaters and ${ent(suma((x) => x.sitios))} gateway sites, with ${pesosHablados(suma((x) => x.costo.total))} of investment.`,
      ),
      tx(
        "Cada sitio se diseña aquí mismo con el relieve real antes de instalarlo, y la red crece por celdas: se agregan repetidores y frecuencias sin rehacer lo que ya está.",
        "Each site is designed right here with the real terrain before it's installed, and the network grows cell by cell: repeaters and frequencies are added without redoing what's already there.",
      ),
    ]
      .filter(Boolean)
      .join(" "),
    cifras: [
      ...(dd
        ? [
            { etiqueta: tx(`${dep!.nombre}: usuarios`, `${dep!.nombre}: users`), valor: ent(dd.usuarios) },
            { etiqueta: tx(`${dep!.nombre}: inversión`, `${dep!.nombre}: investment`), valor: pesosTrama(dd.costo.total) },
          ]
        : []),
      { etiqueta: tx("País: usuarios", "Country: users"), valor: ent(suma((x) => x.usuarios)) },
      { etiqueta: tx("País: repetidores", "Country: repeaters"), valor: ent(suma((x) => x.repetidores)) },
      { etiqueta: tx("País: inversión", "Country: investment"), valor: pesosTrama(suma((x) => x.costo.total)) },
    ],
    foco: { tipo: "pais" },
  });

  /* 11 · Cierre */
  caps.push({
    id: "cierre",
    clave: "cierre",
    titulo: tx("Lo que sigue", "What comes next"),
    subtitulo: tx("Del simulador al piloto", "From the simulator to the pilot"),
    guion: [
      tx(
        "Lo que sigue es un piloto: instalar esta red, medir el canal y los pagos reales, y ajustar el modelo con datos de campo.",
        "What comes next is a pilot: install this network, measure the channel and the real payments, and refine the model with field data.",
      ),
      tx(
        "Todo lo que vieron sale de este simulador: el relieve real, la malla paquete por paquete, la gente en la hora pico y los precios del documento de Trama.",
        "Everything you've seen comes from this simulator: the real terrain, the mesh packet by packet, the people at peak hour and the prices from Trama's document.",
      ),
      tx("Gracias. Pueden preguntarme lo que quieran sobre la red.", "Thank you. Feel free to ask me anything about the network."),
    ].join(" "),
    cifras: [
      { etiqueta: tx("Inversión", "Investment"), valor: pesosTrama(inv.total) },
      { etiqueta: tx("Red completa al mes", "Whole network per month"), valor: pesosTrama(costo.totalMes) },
      { etiqueta: tx("Comisión de equilibrio", "Break-even commission"), valor: pesosTrama(eq.comisionEquilibrio) },
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

/** Los capítulos dichos en inglés («go to the investment», «show me the break-even», «skip to the end»). */
const CAPITULOS_INGLES: [RegExp, IdCapitulo][] = [
  [/\b(cover|title slide|intro|introduction|opening|beginning|start)\b/, "portada"],
  [/\bproblems?\b/, "problema"],
  [/\bsolutions?\b/, "solucion"],
  [/\b(antennas?|repeaters?|gateways?|towers?)\b/, "antena"],
  [/\bcoverage\b/, "cobertura"],
  [/\bcapacity\b/, "capacidad"],
  [/\b(investment|capex|upfront costs?|initial costs?|setup costs?)\b/, "inversion"],
  [/\b(operations?|operating costs?|opex|monthly costs?|running costs?)\b/, "operacion"],
  [/\b(break[- ]?even|commissions?|fees?|pays? for itself|payback|recover\w*)\b/, "equilibrio"],
  [/\b(scales?|scaling|country|countrywide|nationwide|national|department)\b/, "escala"],
  [/\b(closing|conclusion|wrap[- ]?up|final|the end|next steps|what'?s next|last (chapter|slide))\b/, "cierre"],
];

/** Lo dicho en inglés sin cortesías ni comillas: «can you present the business model please» → «present the business model». */
const limpiarIngles = (t: string) =>
  t
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»"]/g, " ")
    .replace(/^(hi |hello |ok |okay )melk[iy]\s*/, "")
    .replace(/^(please |can you |could you |would you |will you |i want you to |i'd like you to |i would like you to )+/, "")
    .replace(/ please$/, "")
    .replace(/\s+/g, " ")
    .trim();

/** La comisión dicha en inglés («a commission of 1,500 pesos», «a $300 fee», «set the fee to 800»), o undefined. */
function comisionIngles(base: string, t: string): number | undefined {
  if (!/\b(commissions?|fees?)\b/.test(t)) return undefined;
  const s = base.replace(/(\d)[.,](?=\d{3}(?!\d))/g, "$1");
  const m = s.match(/\$\s*(\d+)|(\d+)\s*(?:pesos?|cop)\b/) ?? s.match(/\b(?:commissions?|fees?)\D{0,24}?(\d+)/);
  const v = m ? Number(m[1] ?? m[2]) : NaN;
  return v > 0 ? v : undefined;
}

/** Terminar, en inglés (palabras enteras: «cancela» o «parar» siguen siendo del español). */
const TERMINA_INGLES = /\b(stop|end|close|exit|quit|finish|leave|cancel)\b/;

/** «Present the business model», «give me the pitch», «start the presentation», «business model presentation». */
function empiezaPitchIngles(t: string): boolean {
  const pide =
    (/\b(present|show|explain|give|start|begin|run|do|launch|play|open|walk me through|walk us through|take me through|take us through|go through|pitch me)\b/.test(t) &&
      /\b(business model|business plan|business case|presentation|pitch|deck|slides|slideshow)\b/.test(t)) ||
    /^(the )?(business model|business plan)( (presentation|pitch))?$|^(presentation|presentation mode|pitch mode|business pitch|sales pitch)$/.test(t);
  return pide && !TERMINA_INGLES.test(t);
}

/** Con la presentación abierta, en inglés: «next», «back», «pause», «resume», «repeat», «stop», «go to the investment». */
function pitchEnCursoIngles(t: string, comision: number | undefined): PedidoPitch | null {
  if (/\b(stop|end|close|exit|quit|finish|leave|cancel|get out of)\b.*\b(presentation|pitch|business model|slides?|slideshow|deck)\b|^(stop|exit|quit|end|finish|close|done|enough|that's enough|that's all|we're done|i'm done|end it|stop it|close it|finish it)$/.test(t))
    return { accion: "terminar" };
  if (comision !== undefined) return { accion: "ir", capitulo: "equilibrio", comision };
  if (/\b(go|jump|skip|move|head|switch|return|back to|take me|bring me|show|let's see|lets see|let me see|let's go|lets go|turn to)\b/.test(t))
    for (const [re, id] of CAPITULOS_INGLES) if (re.test(t)) return { accion: "ir", capitulo: id };
  if (/^(next|next one|forward|go forward|move on|skip|skip it|skip this one|onward|onwards)( (chapter|slide|step|part|one))?$|\bnext (chapter|slide|step|part|one)\b|^(go|move|skip) (on )?to the next\b/.test(t)) return { accion: "siguiente" };
  if (/^(previous|back|go back|back up|previous one|the previous one)( (chapter|slide|step|part))?$|\bprevious (chapter|slide|step|part|one)\b/.test(t)) return { accion: "anterior" };
  if (/^(pause|pause it|pause that|hold on|hold it|wait|wait a (moment|second|minute|sec)|hang on|one moment|one second|just a (moment|second|minute))$|\bpause (the )?(presentation|pitch|slides?|slideshow)\b/.test(t)) return { accion: "pausar" };
  if (/^(continue|resume|go on|go ahead|keep going|carry on|unpause|play|keep playing|proceed)$|\b(resume|continue) (the )?(presentation|pitch|slides?|slideshow)\b/.test(t)) return { accion: "seguir" };
  if (/^(repeat|repeat that|repeat it|repeat this|again|once more|one more time|say that again|say it again|do it again|from the top)$|\brepeat (the|this|that) (chapter|slide|step|part)\b/.test(t)) return { accion: "repetir" };
  return null;
}

/**
 * ¿El texto le pide algo a la presentación? «preséntame el modelo de negocio», «haz el pitch», «siguiente»,
 * «anterior», «pausa», «sigue», «repite», «termina la presentación», «ve a la inversión», «prueba una comisión de
 * 500 pesos». `enCurso`: si la presentación está abierta, también entiende las órdenes cortas. También en inglés:
 * «present the business model», «give me the pitch», «next», «go to the investment», «try a commission of 500 pesos»,
 * «finish the pitch»… (solo con palabras del inglés: lo dicho en español se entiende igual que siempre).
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
  // En inglés: el texto sin cortesías y la comisión («commission», «fee»; en español nunca aparecen)
  const tEn = limpiarIngles(t);
  const comisionEn = comisionIngles(base, tEn);
  const conComision = comision ?? comisionEn;
  // Las preguntas («¿qué es el pitch?», «¿cómo funciona la presentación?») las contesta el cerebro
  if (/^(que|como|cual|cuales|para que|por que|cuanto|cuando|donde)\b/.test(t) && !/\b(haz|hazme|inicia|empieza|presenta\w*|muestra\w*|arranca)\b/.test(t)) return null;
  // También en inglés («what is the pitch?», «how does the presentation work?»), salvo si prueba una comisión
  if (/^(what|whats|what's|how|which|why|when|where|who|whose)\b/.test(tEn) && comisionEn === undefined && !/\b(present|show|give|start|begin|launch|open|walk me through|walk us through|take me through|take us through)\b/.test(tEn)) return null;
  const empezar =
    /\b(pitch|pich|pitch de negocio)\b/.test(t) ||
    /\b(presenta\w*|muestra\w*|explica\w*|expon\w*|ensena\w*)\b.*\b(modelo de negocio|negocio|presentacion|pitch)\b/.test(t) ||
    /\b(inicia|empieza|comienza|arranca|abre|haz|hazme|dame)\w*\b.*\b(presentacion|pitch)\b/.test(t) ||
    /^(modo )?presentacion$/.test(t);
  // (sin empezar si pide terminar, también en inglés: «finish the pitch»)
  if (empezar && !/\b(termina|cierra|sal|salir|deten|para)\w*\b/.test(t) && !TERMINA_INGLES.test(tEn)) return { accion: "empezar", ...(conComision ? { comision: conComision } : {}) };
  if (empiezaPitchIngles(tEn)) return { accion: "empezar", ...(conComision ? { comision: conComision } : {}) };
  if (!enCurso) return null;
  const ingles = pitchEnCursoIngles(tEn, comisionEn);
  if (ingles) return ingles;
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
