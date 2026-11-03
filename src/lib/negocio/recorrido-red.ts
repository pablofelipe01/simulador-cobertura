// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El recorrido de la red: el robot de Melki cuenta primero cómo calcula el simulador y luego va punto por punto
// siguiendo el camino de la señal (el gateway y cada repetidor, rama por rama), las personas y lo que falta, y en cada
// parada escribe en una nube qué se instaló, por qué ahí y qué papel cumple; al final, qué refuerzos necesita para
// funcionar al 100 % y al 99,9 %, y por qué la red quedó así. Solo usa lo que da el simulador (la red del mapa, la
// simulación al día, la prueba de estrés si la hay y el modelo de costos de Trama): lo que estima lo dice como estimado.
// Todo se escribe en el idioma de la pantalla (español o inglés); los pedidos se entienden en los dos.
import { listaLocal, numeroLocal, porIdioma, tx } from "../idioma";
import { presetPorId } from "../radio/constantes";
import { entornoPorId } from "../radio/entorno";
import { estadoRed } from "../radio/estado-red";
import { distanciaM, rumbo } from "../radio/geo";
import { PATRONES } from "../radio/patron";
import { PROTOCOLOS } from "../radio/protocolos";
import { costoRedTrama } from "../radio/trama";
import type { Antena, Enlace } from "../radio/tipos";
import { cajaDe, departamentoTrama, pesosHablados, type CifraPitch, type DatosPitch, type FocoPitch } from "./pitch";

export type IdParada = "panorama" | "metodo" | "gateway" | "repetidor" | "personas" | "pendiente" | "refuerzos" | "cierre";

/** Lo que se escribe en la nube de una parada. */
export type NubeRecorrido = {
  /** Qué es el punto («Gateway · entrada a internet»). */
  etiqueta: string;
  titulo: string;
  subtitulo?: string;
  /** El texto completo, en párrafos: qué se instaló, por qué ahí, su papel y qué conviene. */
  parrafos: string[];
  /** Las cifras clave del punto. */
  datos: CifraPitch[];
  /** Un pedido para Melki que resuelve lo que se explica («conecta a los que faltan»). */
  sugerencia?: { texto: string; pedido: string };
};

export type ParadaRecorrido = {
  id: IdParada;
  /** Clave única (los repetidores comparten `id`). */
  clave: string;
  /** Nombre corto de la parada (controles y pedidos como «ve al Repetidor 2»). */
  titulo: string;
  /** Lo que Melki dice en voz alta: breve (el detalle va escrito en la nube). */
  voz: string;
  /** Una línea para el resumen escrito del recorrido. */
  resumen: string;
  nube: NubeRecorrido;
  foco: FocoPitch;
  /** El punto del que sale la nube; sin él, sale del robot. */
  ancla: { lat: number; lon: number } | null;
  /** La antena de la que se habla (se resalta en el mapa). */
  antena?: string;
};

/** Cuántas antenas se recorren una por una (las demás se cuentan al final). */
export const MAX_PUNTOS_RECORRIDO = 10;

/* ───────────── Formato ───────────── */

const ent = (x: number) => numeroLocal(Math.round(x));
const f1 = (x: number, d = 1) => numeroLocal(Math.round(x * 10 ** d) / 10 ** d, { maximumFractionDigits: d });
const km = (m: number) => `${f1(m / 1000, m < 10000 ? 1 : 0)} km`;
/** El porcentaje: «45 %» en español, «45%» en inglés. */
const pct = (x: number) => {
  const v = f1(x, x >= 10 ? 0 : 1);
  return tx(`${v} %`, `${v}%`);
};
const cuenta = (n: number, uno: string, varios: string) => `${ent(n)} ${n === 1 ? uno : varios}`;
/** «a», «a y b», «a, b y c» (en inglés, «a, b and c»). */
const lista = (xs: string[]) => listaLocal(xs);
const DIRECCIONES = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];
const DIRECCIONES_EN = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
/** El punto cardinal en palabras («noreste»). */
const hacia = (grados: number) => {
  const k = Math.round((((grados % 360) + 360) % 360) / 45) % 8;
  return tx(DIRECCIONES[k], DIRECCIONES_EN[k]);
};
const mayuscula = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
/** «a» o «an» delante de una cifra en inglés: «an 8 dBi…», «an 11 m…», «a 6 m…». */
const unEn = (cifra: string) => (/^8|^1[18](?!\d)/.test(cifra) ? "an" : "a");

/** La primera frase de un consejo, en minúscula inicial y sin el punto final. */
function primeraFrase(t: string | undefined): string {
  if (!t) return "";
  const f = t.split(/(?<=[.;])\s+/)[0].replace(/[.;]$/, "").trim();
  return f ? f[0].toLowerCase() + f.slice(1) : "";
}

const EQUIPO_TXT = porIdioma(
  (): Record<string, string> => ({
    "p1-8dbi": tx("un repetidor solar SenseCAP P1", "a SenseCAP P1 solar repeater"),
    "t114-8dbi": tx("una radio Heltec T114", "a Heltec T114 radio"),
    xiao: tx("una billetera XIAO ESP32S3 con Wio-SX1262", "a XIAO ESP32S3 wallet with Wio-SX1262"),
    t1000: tx("una tarjeta SenseCAP T1000-E", "a SenseCAP T1000-E card"),
  }),
);

/** Las antenas direccionales en inglés («an 11 dBi Yagi antenna»). */
const PATRON_EN: Record<string, string> = { yagi: "Yagi", panel: "panel", "sectorial-90": "90° sector", "sectorial-120": "120° sector", parabolica: "parabolic" };

/** «antena omnidireccional de 8 dBi», «antena Yagi de 11 dBi apuntando al noreste». */
function antenaTxt(a: Antena): string {
  const n = f1(a.gananciaDbi, 1);
  const g = `${n} dBi`;
  if (!a.patron || a.patron === "omni") return tx(`antena omnidireccional de ${g}`, `${unEn(n)} ${g} omnidirectional antenna`);
  const p = PATRONES.find((x) => x.id === a.patron);
  return tx(
    `antena ${p ? p.nombre.toLowerCase().replace(/ \(.*\)$/, "") : "direccional"} de ${g} apuntando al ${hacia(a.azimutDeg ?? 0)}`,
    `${unEn(n)} ${g} ${p ? (PATRON_EN[p.id] ?? p.nombre.toLowerCase().replace(/ \(.*\)$/, "")) : "directional"} antenna pointing ${hacia(a.azimutDeg ?? 0)}`,
  );
}

/** Qué equipo es, con su antena: «un repetidor solar SenseCAP P1 con antena omnidireccional de 8 dBi». */
function equipoTxt(a: Antena): string {
  const n = f1(a.potenciaDbm, 0);
  const base = EQUIPO_TXT()[a.equipo] ?? tx(`un equipo de ${n} dBm`, `${unEn(n)} ${n} dBm radio`);
  return tx(`${base} con ${antenaTxt(a)}`, `${base} with ${antenaTxt(a)}`);
}

/** Cómo es un enlace según su margen (los mismos cortes del pitch). */
function calidad(m: number): { texto: string; tono: CifraPitch["tono"] } {
  if (m >= 37) return { texto: tx("un enlace sólido, que aguanta lluvia y follaje", "a solid link that holds up to rain and foliage"), tono: "bien" };
  if (m >= 30) return { texto: tx("un enlace bueno", "a good link"), tono: "bien" };
  if (m >= 20) return { texto: tx("un enlace que funciona, pero es inestable", "a link that works, but is unstable"), tono: "alerta" };
  return { texto: tx("un enlace que no alcanza", "a link that falls short"), tono: "mal" };
}

/** Los botones de las nubes: lo que dicen y lo que le piden a Melki (en el idioma de la pantalla). */
const AJUSTAR = () => ({ texto: tx("Ajústamelo", "Adjust it for me"), pedido: tx("ajústamelo", "adjust it for me") });
const CONECTAR = () => ({ texto: tx("Conecta a los que faltan", "Connect the missing ones"), pedido: tx("conecta a los que faltan", "connect the missing ones") });
const APOYOS = () => ({ texto: tx("Sugiéreme antenas de apoyo", "Suggest support antennas"), pedido: tx("sugiéreme antenas de apoyo", "suggest support antennas") });
const PROBAR_PICO = () => tx("prueba la hora pico", "test the peak hour");
const POBLAR_Y_PROBAR = () => tx("pon 250 personas alrededor de cada gateway y repetidor y haz la prueba de estrés", "put 250 people around each gateway and repeater and run the stress test");

type Punto = { lat: number; lon: number };
const centroDe = (xs: Punto[]): Punto | null => (xs.length ? { lat: xs.reduce((s, x) => s + x.lat, 0) / xs.length, lon: xs.reduce((s, x) => s + x.lon, 0) / xs.length } : null);
const dist = (a: Punto, b: Punto) => distanciaM(a.lat, a.lon, b.lat, b.lon);
const mediana = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
/** Agrupa los puntos cercanos: cada grupo cabe a `radio` metros de su primer punto. */
function agrupar<T extends Punto>(xs: T[], radio: number): T[][] {
  const grupos: T[][] = [];
  for (const x of xs) {
    const g = grupos.find((y) => dist(y[0], x) <= radio);
    if (g) g.push(x);
    else grupos.push([x]);
  }
  return grupos;
}

/* ───────────── El recorrido ───────────── */

/** Arma las paradas del recorrido con la red del mapa (en el idioma de la pantalla). */
export function armarRecorrido(d: DatosPitch): ParadaRecorrido[] {
  const r = d.resultado;
  const limite = d.parametros.limiteSaltos;
  const red = estadoRed(d.antenas, r, limite, !!r);
  const preset = presetPorId(d.parametros.preset);
  const protocolo = PROTOCOLOS[preset.protocolo];
  const porId = new Map((r?.antenas ?? []).map((x) => [x.id, x]));
  const nodos = new Map((r?.nodos ?? []).map((x) => [x.id, x]));
  const activas = d.antenas.filter((a) => a.activa);
  const infra = [...red.gateways, ...red.repetidores];
  const esInfra = new Set(infra.map((a) => a.id));
  const porNombre = new Map(d.antenas.map((a) => [a.id, a]));
  const nombre = (id: string) => porNombre.get(id)?.nombre ?? id;
  const lugarDe = (p: Punto) => {
    const s = d.lugar?.(p.lat, p.lon);
    return s ? (s.municipio && s.municipio !== s.departamento ? `${s.municipio} (${s.departamento})` : s.departamento) : null;
  };
  const enlace = (x: string, y: string): Enlace | undefined => r?.enlaces.find((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x));
  const cajaRed = cajaDe(activas);
  const personas = red.personas;
  const conectadas = red.conectadas;
  const P = personas.length;
  const C = conectadas.length;

  // Por dónde pasa cada mensaje: cuántas personas y qué repetidores dependen de cada antena, y quién entra por cuál
  const pasan = new Map<string, { personas: number; repetidores: string[] }>();
  const directas = new Map<string, Antena[]>();
  for (const a of activas) {
    const ruta = nodos.get(a.id)?.ruta;
    if (!ruta || ruta.length < 2) continue;
    const esPersona = !esInfra.has(a.id);
    for (const id of ruta.slice(1)) {
      if (!esInfra.has(id)) continue;
      const x = pasan.get(id) ?? { personas: 0, repetidores: [] };
      if (esPersona) x.personas++;
      else x.repetidores.push(a.id);
      pasan.set(id, x);
    }
    if (esPersona) {
      const primera = ruta.slice(1).find((id) => esInfra.has(id));
      if (primera) directas.set(primera, [...(directas.get(primera) ?? []), a]);
    }
  }
  // El árbol de la señal: de qué antena cuelga cada repetidor (el siguiente salto de su ruta)
  const padreDe = (a: Antena): Antena | null => {
    const id = nodos.get(a.id)?.ruta?.[1];
    return id && esInfra.has(id) ? (porNombre.get(id) ?? null) : null;
  };
  const hijos = new Map<string, Antena[]>();
  for (const a of red.repetidores) {
    const p = padreDe(a);
    if (p) hijos.set(p.id, [...(hijos.get(p.id) ?? []), a]);
  }
  // El gateway al que llega cada antena (el último de su ruta) o, sin ruta, el más cercano
  const gatewayDe = (a: Antena): Antena | null => {
    const ruta = nodos.get(a.id)?.ruta;
    const id = ruta?.[ruta.length - 1];
    const g = id ? red.gateways.find((x) => x.id === id) : undefined;
    if (g) return g;
    return [...red.gateways].sort((x, y) => dist(a, x) - dist(a, y))[0] ?? null;
  };

  // El suelo de las antenas: para decir si una está en lo alto o en lo bajo
  const suelos = infra.map((a) => porId.get(a.id)?.elevacionM).filter((x): x is number => typeof x === "number" && x > 0);
  const sueloProm = suelos.length >= 2 ? suelos.reduce((s, x) => s + x, 0) / suelos.length : null;
  const sueloMax = suelos.length >= 2 ? Math.max(...suelos) : null;
  const centroRed = centroDe(activas);
  const radioRed = centroRed ? Math.max(1, ...activas.map((a) => dist(centroRed, a))) : 1;

  // El orden del recorrido: cada gateway (el de más gente primero) y sus repetidores rama por rama, en el sentido
  // de las agujas del reloj; los que no cuelgan de nadie, al final por saltos
  const saltosDe = (a: Antena) => nodos.get(a.id)?.saltos ?? 99;
  const orden: Antena[] = [];
  const vistos = new Set<string>();
  const visitar = (a: Antena) => {
    if (vistos.has(a.id)) return;
    vistos.add(a.id);
    orden.push(a);
    const hs = [...(hijos.get(a.id) ?? [])].sort((x, y) => rumbo(a.lat, a.lon, x.lat, x.lon) - rumbo(a.lat, a.lon, y.lat, y.lon));
    hs.forEach(visitar);
  };
  [...red.gateways].sort((x, y) => (pasan.get(y.id)?.personas ?? 0) - (pasan.get(x.id)?.personas ?? 0)).forEach(visitar);
  [...red.repetidores].filter((a) => !vistos.has(a.id)).sort((x, y) => saltosDe(x) - saltosDe(y)).forEach(visitar);
  const puntos = orden.slice(0, MAX_PUNTOS_RECORRIDO);
  const resto = orden.length - puntos.length;

  const paradas: ParadaRecorrido[] = [];
  const lugarRed = centroRed && (infra[0] ?? activas[0]) ? lugarDe(infra[0] ?? activas[0]) : null;
  const sinSimular = !r;

  /* 1 · Panorama */
  {
    const parrafos = [
      tx(
        `Esta red lleva pagos, mensajes de WhatsApp por texto y consultas a la inteligencia artificial a donde no llega la señal del celular. ${
          red.gateways.length || red.repetidores.length
            ? `Tiene ${cuenta(red.gateways.length, "gateway", "gateways")} y ${cuenta(red.repetidores.length, "repetidor", "repetidores")}${P ? ` para ${cuenta(P, "persona", "personas")} con billetera de radio` : ""}${lugarRed ? `, en ${lugarRed}` : ""}, sobre ${protocolo.nombre} (LoRa ${f1(d.parametros.frecuenciaMhz, 1)} MHz).`
            : "Todavía no tiene gateway ni repetidores."
        }`,
        `This network carries payments, WhatsApp text messages and queries to artificial intelligence to places the mobile signal doesn't reach. ${
          red.gateways.length || red.repetidores.length
            ? `It has ${cuenta(red.gateways.length, "gateway", "gateways")} and ${cuenta(red.repetidores.length, "repeater", "repeaters")}${P ? ` for ${cuenta(P, "person", "people")} with ${P === 1 ? "a radio wallet" : "radio wallets"}` : ""}${lugarRed ? `, in ${lugarRed}` : ""}, running ${protocolo.nombre} (LoRa ${f1(d.parametros.frecuenciaMhz, 1)} MHz).`
            : "It has no gateway or repeaters yet."
        }`,
      ),
      tx(
        `El recorrido sigue el camino de la señal: primero le cuento cómo calcula el simulador; luego empiezo en el gateway, por donde entra internet, y voy repetidor por repetidor, rama por rama, hasta las personas. En cada punto le escribo qué se instaló, por qué quedó ahí y qué papel cumple; al final, ${r ? "qué refuerzos necesita para funcionar al 100 % y al 99,9 %, y " : ""}por qué la red quedó así.`,
        `The walkthrough follows the path of the signal: first I'll explain how the simulator does its calculations; then I start at the gateway, where the internet comes in, and go repeater by repeater, branch by branch, all the way to the people. At each point I'll write down what was installed, why it went there and what role it plays; at the end, ${r ? "what reinforcements it needs to work at 100% and at 99.9%, and " : ""}why the network turned out this way.`,
      ),
    ];
    if (sinSimular)
      parrafos.push(
        tx(
          "Aún no hay una simulación al día: mientras termina, le explico lo que se ve en el mapa; los enlaces, la cobertura y los saltos aparecen al simular.",
          "There's no up-to-date simulation yet: while it finishes, I'll explain what you can see on the map; the links, the coverage and the hops appear once it's simulated.",
        ),
      );
    else if (r)
      parrafos.push(
        tx(
          `Con el relieve real, la red da servicio en el ${pct(r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio)} ${r.areaObjetivo ? "del área objetivo" : "del área de estudio"}${P ? ` y llegan al gateway ${C} de ${P} personas` : ""}.`,
          `With the real terrain, the network provides service over ${pct(r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio)} of the ${r.areaObjetivo ? "target area" : "study area"}${P ? `, and ${ent(C)} of ${ent(P)} ${P === 1 ? "person" : "people"} ${C === 1 ? "reaches" : "reach"} the gateway` : ""}.`,
        ),
      );
    paradas.push({
      id: "panorama",
      clave: "panorama",
      titulo: tx("La red de un vistazo", "The network at a glance"),
      voz: tx(
        `Le muestro la red punto por punto: ${cuenta(red.gateways.length, "gateway", "gateways")}, ${cuenta(red.repetidores.length, "repetidor", "repetidores")}${P ? ` y ${cuenta(P, "persona", "personas")}` : ""}. Primero le cuento cómo calcula el simulador y luego voy al gateway, por donde entra internet.`,
        `Allow me to show you the network, point by point: ${cuenta(red.gateways.length, "gateway", "gateways")}, ${cuenta(red.repetidores.length, "repeater", "repeaters")}${P ? ` and ${cuenta(P, "person", "people")}` : ""}. First, how the simulator does its calculations; then on to the gateway, where the internet comes in.`,
      ),
      resumen: tx(
        `${cuenta(red.gateways.length, "gateway", "gateways")}, ${cuenta(red.repetidores.length, "repetidor", "repetidores")}${P ? ` y ${cuenta(P, "persona", "personas")}` : ""}${lugarRed ? ` en ${lugarRed}` : ""}.`,
        `${cuenta(red.gateways.length, "gateway", "gateways")}, ${cuenta(red.repetidores.length, "repeater", "repeaters")}${P ? ` and ${cuenta(P, "person", "people")}` : ""}${lugarRed ? ` in ${lugarRed}` : ""}.`,
      ),
      nube: {
        etiqueta: tx("Recorrido de la red", "Network walkthrough"),
        titulo: d.nombre?.trim() || tx("La red de un vistazo", "The network at a glance"),
        subtitulo: [lugarRed, `${protocolo.nombre} · LoRa ${f1(d.parametros.frecuenciaMhz, 1)} MHz`].filter(Boolean).join(" · "),
        parrafos,
        datos: [
          { etiqueta: "Gateways", valor: ent(red.gateways.length) },
          { etiqueta: tx("Repetidores", "Repeaters"), valor: ent(red.repetidores.length) },
          { etiqueta: tx("Personas", "People"), valor: ent(P), detalle: r && P ? tx(`${ent(C)} conectadas`, `${ent(C)} connected`) : undefined },
          ...(r ? [{ etiqueta: tx("Saltos máximos", "Max hops"), valor: ent(red.saltosMax), detalle: tx(`límite ${ent(limite)}`, `limit ${ent(limite)}`) }] : []),
        ],
      },
      foco: { tipo: "red", caja: cajaRed },
      ancla: null,
    });
  }

  /* 2 · Cómo lo calcula el simulador: el relieve, la pérdida, el margen, la malla y la hora pico */
  {
    const p = d.parametros;
    const fuente = r?.relieve.fuente;
    const resol = r && r.relieve.resolucionM > 0 ? r.relieve.resolucionM : null;
    const relieveTxt =
      fuente === "plano"
        ? tx("sobre un terreno plano (sin relieve: así se ve lo que alcanzan los equipos solos)", "over flat ground (no terrain: this shows what the equipment reaches on its own)")
        : fuente === "hgt"
          ? tx(
              `con el relieve real de los archivos de elevación cargados${resol ? ` (un dato de altura cada ${ent(resol)} m)` : ""}`,
              `with the real terrain from the loaded elevation files${resol ? ` (one height sample every ${ent(resol)} m)` : ""}`,
            )
          : tx(
              `con el relieve real del terreno${resol ? `, descargado en teselas de elevación (un dato de altura cada ${ent(resol)} m)` : ""}`,
              `with the real terrain${resol ? `, downloaded as elevation tiles (one height sample every ${ent(resol)} m)` : ""}`,
            );
    const sens = r?.sensibilidadDbm ?? preset.sensibilidadDbm;
    const entorno = entornoPorId(p.entorno);
    const parrafos = [
      tx(
        `Para cada antena, el simulador traza el perfil del terreno hacia cada punto de una malla de ${r ? `celdas de unos ${ent(r.malla.celdaM)} m` : "celdas"}, en ${f1(p.radioKm, 1)} km a la redonda, ${relieveTxt}. A la gente la calcula con la billetera a ${f1(p.alturaRxM, 1)} m del suelo.`,
        `For each antenna, the simulator traces the terrain profile to every point of a grid of ${r ? `cells about ${ent(r.malla.celdaM)} m wide` : "cells"}, within a ${f1(p.radioKm, 1)} km radius, ${relieveTxt}. People are calculated with the wallet ${f1(p.alturaRxM, 1)} m above the ground.`,
      ),
      tx(
        `${
          p.modelo === "itm"
            ? "En cada perfil calcula la pérdida de la señal con Longley-Rice (el modelo ITM de la NTIA, el mismo que usa Radio Mobile)"
            : "En cada perfil calcula la pérdida de la señal: la del espacio libre más la difracción sobre las lomas que tapan el camino (filo de cuchillo, método de Deygout, con la curvatura de la Tierra), calibrada contra simulaciones de Radio Mobile, con unos 3 dB de diferencia típica en los enlaces"
        }${entorno.metodo === "ninguno" ? "" : `, y le suma la pérdida del entorno elegido, «${entorno.nombre.toLowerCase()}» (${entorno.metodo === "follaje" ? "follaje según UIT-R P.833" : "árboles o construcciones según UIT-R P.2108"})`}.`,
        `${
          p.modelo === "itm"
            ? "On each profile it calculates the signal loss with Longley-Rice (the NTIA's ITM model, the same one Radio Mobile uses)"
            : "On each profile it calculates the signal loss: free-space loss plus diffraction over the hills blocking the path (knife-edge, Deygout method, with the Earth's curvature), calibrated against Radio Mobile simulations, with a typical difference of about 3 dB on the links"
        }${entorno.metodo === "ninguno" ? "" : `, and adds the loss of the chosen environment, “${entorno.nombre.toLowerCase()}” (${entorno.metodo === "follaje" ? "foliage per ITU-R P.833" : "trees or buildings per ITU-R P.2108"})`}.`,
      ),
      tx(
        `Con esa pérdida saca el margen: cuánto le sobra a la señal sobre la sensibilidad del radio (${f1(sens, 1)} dBm con ${preset.nombre.replace(/ \(.*\)$/, "")}, a ${f1(p.frecuenciaMhz, 1)} MHz). Con 20 dB ya hay servicio; con 30 dB, señal media (la cobertura útil), y con 37 dB, confiable aun con lluvia y follaje. Entre dos antenas, un enlace es sólido desde 30 dB.`,
        `From that loss it derives the margin: how much signal is left over above the radio's sensitivity (${f1(sens, 1)} dBm with ${preset.nombre.replace(/ \(.*\)$/, "")}, at ${f1(p.frecuenciaMhz, 1)} MHz). At 20 dB there is already service; at 30 dB, a fair signal (useful coverage); and at 37 dB, reliable even with rain and foliage. Between two antennas, a link is solid from 30 dB.`,
      ),
      tx(
        `Después arma la malla: para cada nodo busca el camino más robusto hasta el gateway (el que tiene su enlace más débil más fuerte), sin pasar de ${cuenta(limite, "salto", "saltos")}, y marca como punto crítico al repetidor que, si se apaga, deja a otros sin camino.`,
        `Then it builds the mesh: for each node it finds the most robust path to the gateway (the one whose weakest link is strongest), within ${cuenta(limite, "hop", "hops")}, and flags as a critical point any repeater that, if it went down, would leave others without a path.`,
      ),
      d.estres
        ? tx(
            `La prueba de la hora pico simula los mensajes de cada persona con el tiempo real que ocupa cada paquete en el aire (LoRa), las esperas y reintentos de ${protocolo.nombre} y los choques entre mensajes, y cuenta cuántos vuelven con su respuesta.`,
            `The peak-hour test simulates each person's messages with the real airtime of every packet (LoRa), ${protocolo.nombre}'s waits and retries, and the collisions between messages, and counts how many come back with their reply.`,
          )
        : tx(
            `Y con la prueba de la hora pico («prueba la hora pico») simula los mensajes de cada persona con el tiempo real de cada paquete en el aire y los choques entre mensajes, para saber si el canal aguanta.`,
            `And with the peak-hour test (“${PROBAR_PICO()}”) it simulates each person's messages with the real airtime of every packet and the collisions between messages, to find out whether the channel holds up.`,
          ),
    ];
    paradas.push({
      id: "metodo",
      clave: "metodo",
      titulo: tx("Cómo lo calcula el simulador", "How the simulator calculates it"),
      voz: tx(
        "Así calcula el simulador: traza el perfil del terreno de cada antena a cada punto, le resta lo que tapan las lomas y mira cuánto le sobra a la señal. Con 20 dB ya hay servicio y con 37 es confiable.",
        "Here is how the simulator works it out: it traces the terrain profile from each antenna to every point, subtracts what the hills block, and checks how much signal is left over. At 20 dB there is service; at 37, it is reliable.",
      ),
      resumen: tx(
        `${fuente === "plano" ? "terreno plano" : "relieve real"}${r ? `, celdas de ${ent(r.malla.celdaM)} m` : ""}, ${p.modelo === "itm" ? "Longley-Rice" : "modelo calibrado con Radio Mobile"}; servicio desde 20 dB, cobertura útil desde 30 y confiable desde 37; caminos más robustos al gateway en máximo ${cuenta(limite, "salto", "saltos")}.`,
        `${fuente === "plano" ? "flat ground" : "real terrain"}${r ? `, ${ent(r.malla.celdaM)} m cells` : ""}, ${p.modelo === "itm" ? "Longley-Rice" : "model calibrated with Radio Mobile"}; service from 20 dB, useful coverage from 30 and reliable from 37; most robust paths to the gateway in at most ${cuenta(limite, "hop", "hops")}.`,
      ),
      nube: {
        etiqueta: tx("El simulador por dentro", "Inside the simulator"),
        titulo: tx("Cómo lo calcula el simulador", "How the simulator calculates it"),
        subtitulo: `${preset.nombre} · ${f1(p.frecuenciaMhz, 1)} MHz`,
        parrafos,
        datos: [
          {
            etiqueta: tx("Relieve", "Terrain"),
            valor: fuente === "plano" ? tx("Plano", "Flat") : fuente === "hgt" ? tx("Archivos HGT", "HGT files") : "Real",
            detalle: resol ? tx(`un dato cada ${ent(resol)} m`, `one sample every ${ent(resol)} m`) : undefined,
          },
          ...(r ? [{ etiqueta: tx("Celda de cálculo", "Calculation cell"), valor: `${ent(r.malla.celdaM)} m`, detalle: tx(`${f1(p.radioKm, 1)} km por antena`, `${f1(p.radioKm, 1)} km per antenna`) }] : []),
          { etiqueta: tx("Sensibilidad", "Sensitivity"), valor: `${f1(sens, 1)} dBm`, detalle: `SF${preset.sf} · ${f1(preset.anchoBandaKhz, 1)} kHz` },
          {
            etiqueta: tx("Modelo", "Model"),
            valor: p.modelo === "itm" ? "Longley-Rice" : tx("Calibrado", "Calibrated"),
            detalle: p.modelo === "itm" ? tx("ITM de la NTIA", "NTIA's ITM") : tx("con Radio Mobile", "with Radio Mobile"),
          },
        ],
      },
      foco: { tipo: "red", caja: cajaRed },
      ancla: null,
    });
  }

  /* 3 · Antena por antena */
  for (const a of puntos) {
    const res = porId.get(a.id);
    const n = nodos.get(a.id);
    const gw = a.pasarela;
    const sitio = lugarDe(a);
    const suelo = res && res.elevacionM > 0 ? res.elevacionM : null;
    const dif = suelo !== null && sueloProm !== null ? suelo - sueloProm : null;
    const masAlto = suelo !== null && sueloMax !== null && suelo >= sueloMax && infra.length >= 3;
    const p = pasan.get(a.id) ?? { personas: 0, repetidores: [] };
    const suyas = directas.get(a.id) ?? [];
    const susHijos = hijos.get(a.id) ?? [];
    const padre = gw ? null : padreDe(a);
    const e = padre ? enlace(a.id, padre.id) : undefined;
    const datos: CifraPitch[] = [
      {
        etiqueta: tx("Altura de la antena", "Antenna height"),
        valor: `${f1(a.alturaM, 1)} m`,
        detalle: suelo !== null ? tx(`suelo a ${ent(suelo)} m s. n. m.`, `ground at ${ent(suelo)} m a.s.l.`) : undefined,
      },
    ];
    const parrafos: string[] = [];

    // El suelo: en lo alto, en lo bajo o en el promedio
    const sueloTxt =
      suelo === null
        ? ""
        : masAlto
          ? tx(
              `El suelo está a ${ent(suelo)} m sobre el nivel del mar: es el punto más alto de la red, ${ent(dif ?? 0)} m por encima del promedio de las antenas, y desde ahí la señal sale despejada sobre el terreno.`,
              `The ground is ${ent(suelo)} m above sea level: it's the highest point of the network, ${ent(dif ?? 0)} m above the antennas' average, and from there the signal clears the terrain.`,
            )
          : dif !== null && dif >= 15
            ? tx(
                `El suelo está a ${ent(suelo)} m sobre el nivel del mar, ${ent(dif)} m por encima del promedio de las antenas: desde lo alto la señal pasa sobre lomas y árboles.`,
                `The ground is ${ent(suelo)} m above sea level, ${ent(dif)} m above the antennas' average: from up high, the signal passes over hills and trees.`,
              )
            : dif !== null && dif <= -15
              ? tx(
                  `El suelo está a ${ent(suelo)} m sobre el nivel del mar, ${ent(-dif)} m por debajo del promedio de las antenas: por eso la altura del mástil es la que le abre camino a la señal.`,
                  `The ground is ${ent(suelo)} m above sea level, ${ent(-dif)} m below the antennas' average: that's why the mast height is what opens a path for the signal.`,
                )
              : tx(`El suelo está a ${ent(suelo)} m sobre el nivel del mar, a la altura del resto de la red.`, `The ground is ${ent(suelo)} m above sea level, level with the rest of the network.`);

    if (gw) {
      /* El gateway */
      const dCentro = centroRed ? dist(centroRed, a) : 0;
      const central = dCentro <= radioRed * 0.35;
      parrafos.push(
        tx(
          `Se instaló el sitio gateway: ${equipoTxt(a)} a ${f1(a.alturaM, 1)} m de altura, un mini PC con UPS y Starlink, todo con energía solar. Es la puerta de la red a internet: aquí llegan los pagos, los WhatsApp y las consultas a la IA, salen por Starlink y vuelven con la respuesta.`,
          `The gateway site was installed here: ${equipoTxt(a)} at ${f1(a.alturaM, 1)} m, a mini PC with a UPS and Starlink, all solar-powered. It is the network's door to the internet: payments, WhatsApp messages and AI queries arrive here, go out through Starlink and come back with the reply.`,
        ),
      );
      const porque: string[] = [];
      if (centroRed && activas.length > 1)
        porque.push(
          central
            ? tx(
                `${dCentro < 150 ? "Está en el centro de la red" : `Está cerca del centro de la red (a ${km(dCentro)} de él)`}: así los repetidores se reparten a su alrededor y el camino más largo queda corto${r ? `, de ${cuenta(red.saltosMax, "salto", "saltos")}` : ""}.`,
                `${dCentro < 150 ? "It sits at the center of the network" : `It sits near the center of the network (${km(dCentro)} from it)`}: that way the repeaters spread out around it and the longest path stays short${r ? `, at ${cuenta(red.saltosMax, "hop", "hops")}` : ""}.`,
              )
            : tx(
                `Está hacia el ${hacia(rumbo(centroRed.lat, centroRed.lon, a.lat, a.lon))} de la red, a ${km(dCentro)} de su centro: desde aquí la malla se extiende hacia el ${hacia(rumbo(a.lat, a.lon, centroRed.lat, centroRed.lon))}.`,
                `It lies to the ${hacia(rumbo(centroRed.lat, centroRed.lon, a.lat, a.lon))} of the network, ${km(dCentro)} from its center: the mesh spreads out from it toward the ${hacia(rumbo(a.lat, a.lon, centroRed.lat, centroRed.lon))}.`,
              ),
        );
      if (sueloTxt) porque.push(sueloTxt);
      const conEnlace = susHijos.map((h) => ({ h, e: enlace(a.id, h.id) })).filter((x) => x.e);
      if (conEnlace.length) {
        const directos = lista(conEnlace.slice(0, 4).map(({ h, e: x }) => `${h.nombre} (${km(x!.distanciaKm * 1000)}, ${f1(x!.margen, 0)} dB${x!.lineaVista ? tx(", con línea de vista", ", with line of sight") : ""})`));
        porque.push(
          tx(
            `Desde aquí enlaza directo con ${directos}${conEnlace.length > 4 ? ` y ${cuenta(conEnlace.length - 4, "repetidor más", "repetidores más")}` : ""}.`,
            `From here it links directly to ${directos}${conEnlace.length > 4 ? ` and ${cuenta(conEnlace.length - 4, "more repeater", "more repeaters")}` : ""}.`,
          ),
        );
      }
      if (porque.length) parrafos.push(porque.join(" "));
      const papel: string[] = [];
      if (r) {
        papel.push(
          p.personas
            ? tx(
                `Por este gateway salen a internet las ${cuenta(p.personas, "persona conectada", "personas conectadas")}${p.repetidores.length ? `, a través de ${cuenta(p.repetidores.length, "repetidor", "repetidores")}` : ""}${suyas.length ? `; ${cuenta(suyas.length, "se conecta", "se conectan")} directo, sin repetidor` : ""}.`,
                `${p.personas === 1 ? "The one connected person reaches" : `All ${ent(p.personas)} connected people reach`} the internet through this gateway${p.repetidores.length ? `, via ${cuenta(p.repetidores.length, "repeater", "repeaters")}` : ""}${suyas.length ? (p.personas === 1 ? "; they connect directly, with no repeater" : `; ${ent(suyas.length)} of them ${suyas.length === 1 ? "connects" : "connect"} directly, with no repeater`) : ""}.`,
              )
            : tx("Todavía no le llega ninguna persona: hace falta acercar la red a la gente o poner repetidores.", "No one reaches it yet: the network needs to be brought closer to the people, or repeaters added."),
        );
      }
      papel.push(
        red.gateways.length === 1
          ? tx(
              "Es el único gateway: conviene cuidarlo con su UPS y mantenimiento preventivo, porque si se apaga la malla sigue en pie pero sin salida a internet.",
              "It is the only gateway: it deserves care, with its UPS and preventive maintenance, because if it goes down the mesh stays up but without internet access.",
            )
          : tx(`Es uno de los ${ent(red.gateways.length)} gateways: si uno falla, la gente cercana al otro sigue con internet.`, `It is one of ${ent(red.gateways.length)} gateways: if one fails, the people near the other keep their internet.`),
      );
      parrafos.push(papel.join(" "));
      parrafos.push(
        a.alturaM < 10
          ? tx(`Conviene subir la antena a 12 m, la torre estándar del sitio gateway: gana alcance y despeja techos y árboles.`, `It would be wise to raise the antenna to 12 m, the standard tower for a gateway site: it gains range and clears roofs and trees.`)
          : tx(`A ${f1(a.alturaM, 0)} m la antena domina su zona: es la altura que da el alcance que se ve en el mapa.`, `At ${f1(a.alturaM, 0)} m the antenna commands its area: that height gives the range you see on the map.`),
      );
      datos.push({ etiqueta: tx("Enlaces directos", "Direct links"), valor: ent(susHijos.length), detalle: susHijos.length === 1 ? tx("repetidor", "repeater") : tx("repetidores", "repeaters") });
      if (r) datos.push({ etiqueta: tx("Salen por aquí", "Out through here"), valor: ent(p.personas), detalle: tx("personas a internet", "people to the internet") });
      if (res && res.areaServicioKm2 > 0) datos.push({ etiqueta: tx("Área con servicio", "Area with service"), valor: `${ent(res.areaServicioKm2)} km²`, detalle: tx(`alcance ${f1(res.alcanceKm, 1)} km`, `range ${f1(res.alcanceKm, 1)} km`) });
      /** «all 45 connected people go out through here» (al principio de la frase, con mayúscula). */
      const salenEn = (k: number, inicio: boolean) => (k === 1 ? `${inicio ? "The" : "the"} one connected person goes out through here` : `${inicio ? "All" : "all"} ${ent(k)} connected people go out through here`);
      paradas.push({
        id: "gateway",
        clave: `gateway-${a.id}`,
        titulo: a.nombre,
        voz: tx(
          `${a.nombre}${sitio ? `, en ${sitio}` : ""}: el gateway, la puerta de la red a internet.${susHijos.length ? ` Enlaza directo con ${cuenta(susHijos.length, "repetidor", "repetidores")}` : ""}${r && p.personas ? `${susHijos.length ? " y por" : " Por"} aquí salen las ${cuenta(p.personas, "persona conectada", "personas conectadas")}` : ""}${susHijos.length || (r && p.personas) ? "." : ""}`,
          `${a.nombre}${sitio ? `, in ${sitio}` : ""}: the gateway, the network's door to the internet.${susHijos.length ? ` It links directly to ${cuenta(susHijos.length, "repeater", "repeaters")}` : ""}${r && p.personas ? (susHijos.length ? `, and ${salenEn(p.personas, false)}` : ` ${salenEn(p.personas, true)}`) : ""}${susHijos.length || (r && p.personas) ? "." : ""}`,
        ),
        resumen: tx(
          `gateway${sitio ? ` en ${sitio}` : ""}, la entrada a internet por Starlink; antena a ${f1(a.alturaM, 1)} m${susHijos.length ? `, enlaza directo con ${cuenta(susHijos.length, "repetidor", "repetidores")}` : ""}${r ? ` y por él salen ${cuenta(p.personas, "persona", "personas")}` : ""}.`,
          `gateway${sitio ? ` in ${sitio}` : ""}, the internet entry point via Starlink; antenna at ${f1(a.alturaM, 1)} m${susHijos.length ? `, links directly to ${cuenta(susHijos.length, "repeater", "repeaters")}` : ""}${r ? `, and ${cuenta(p.personas, "person goes", "people go")} out through it` : ""}.`,
        ),
        nube: {
          etiqueta: tx("Gateway · entrada a internet", "Gateway · internet entry point"),
          titulo: a.nombre,
          subtitulo: [sitio, `${a.lat.toFixed(5)}, ${a.lon.toFixed(5)}`].filter(Boolean).join(" · "),
          parrafos,
          datos: datos.slice(0, 5),
        },
        foco: { tipo: "punto", lat: a.lat, lon: a.lon, zoom: 12.5 },
        ancla: { lat: a.lat, lon: a.lon },
        antena: a.id,
      });
      continue;
    }

    /* Un repetidor */
    const g = gatewayDe(a);
    const dGw = g ? dist(g, a) : null;
    const s = n?.saltos ?? null;
    const aislado = !!r && s === null;
    const lejos = s !== null && s > limite;
    const altura = f1(a.alturaM, 1);
    parrafos.push(
      tx(
        `Se instaló ${equipoTxt(a)} en un mástil de ${f1(a.alturaM, 1)} m, con panel solar y baterías: funciona sin red eléctrica ni internet y retransmite los mensajes de la malla.`,
        `${mayuscula(equipoTxt(a))} was installed here on ${unEn(altura)} ${altura} m mast, with a solar panel and batteries: it runs without grid power or internet and relays the mesh's messages.`,
      ),
    );
    const porque: string[] = [];
    if (sueloTxt) porque.push(sueloTxt);
    if (padre && e) {
      const q = calidad(e.margen);
      porque.push(
        tx(
          `Desde aquí alcanza a ${padre.nombre} a ${km(e.distanciaKm * 1000)}, ${e.lineaVista ? "con línea de vista despejada" : "sin línea de vista, por difracción sobre el terreno"}, con ${f1(e.margen, 0)} dB de margen: ${q.texto}.`,
          `From here it reaches ${padre.nombre}, ${km(e.distanciaKm * 1000)} away, ${e.lineaVista ? "with a clear line of sight" : "without line of sight, by diffraction over the terrain"}, with ${f1(e.margen, 0)} dB of margin: ${q.texto}.`,
        ),
      );
      datos.push({
        etiqueta: tx(`Enlace con ${padre.nombre}`, `Link to ${padre.nombre}`),
        valor: `${f1(e.margen, 0)} dB`,
        detalle: `${km(e.distanciaKm * 1000)} · ${e.lineaVista ? tx("línea de vista", "line of sight") : tx("difracción", "diffraction")}`,
        tono: q.tono,
      });
    }
    if (suyas.length) {
      const c = centroDe(suyas)!;
      const lejana = Math.max(...suyas.map((x) => dist(a, x)));
      const prom = suyas.reduce((t, x) => t + dist(a, x), 0) / suyas.length;
      porque.push(
        suyas.length === 1
          ? tx(`Atiende a 1 persona, a ${km(lejana)} hacia el ${hacia(rumbo(a.lat, a.lon, c.lat, c.lon))}.`, `It serves 1 person, ${km(lejana)} to the ${hacia(rumbo(a.lat, a.lon, c.lat, c.lon))}.`)
          : dist(a, c) <= prom * 0.45
            ? tx(`Queda en medio de las ${cuenta(suyas.length, "persona", "personas")} que atiende: la más lejana está a ${km(lejana)}.`, `It sits in the middle of the ${cuenta(suyas.length, "person", "people")} it serves: the farthest is ${km(lejana)} away.`)
            : tx(
                `Atiende a ${cuenta(suyas.length, "persona", "personas")}, la mayoría hacia el ${hacia(rumbo(a.lat, a.lon, c.lat, c.lon))}, a ${km(prom)} en promedio.`,
                `It serves ${cuenta(suyas.length, "person", "people")}, mostly to the ${hacia(rumbo(a.lat, a.lon, c.lat, c.lon))}, ${km(prom)} away on average.`,
              ),
      );
    } else if (susHijos.length)
      porque.push(tx(`Su trabajo es de enlace: une a ${lista(susHijos.map((h) => h.nombre))} con el resto de la red.`, `Its job is to link: it connects ${lista(susHijos.map((h) => h.nombre))} with the rest of the network.`));
    if (porque.length) parrafos.push(porque.join(" "));

    const papel: string[] = [];
    if (aislado)
      papel.push(
        tx(
          "Hoy no tiene camino al gateway: ningún enlace le alcanza. Hay que acercarlo, subir su antena o poner un repetidor entre él y la red.",
          "Right now it has no path to the gateway: no link reaches it. It needs to be moved closer, have its antenna raised, or get a repeater between it and the network.",
        ),
      );
    else if (lejos)
      papel.push(
        tx(
          `Llega al gateway en ${cuenta(s!, "salto", "saltos")}, más que el límite de diseño de ${ent(limite)}: un repetidor intermedio o antenas más altas acortan el camino.`,
          `It reaches the gateway in ${cuenta(s!, "hop", "hops")}, more than the design limit of ${ent(limite)}: an intermediate repeater or taller antennas would shorten the path.`,
        ),
      );
    if (!aislado && susHijos.length)
      papel.push(
        tx(
          `Es un repetidor troncal: por él pasa el tráfico de ${lista(susHijos.map((h) => h.nombre))}${p.personas ? ` y, en total, el de ${cuenta(p.personas, "persona", "personas")}` : ""}.`,
          `It is a trunk repeater: it carries the traffic of ${lista(susHijos.map((h) => h.nombre))}${p.personas ? `, and in total that of ${cuenta(p.personas, "person", "people")}` : ""}.`,
        ),
      );
    else if (!aislado && suyas.length)
      papel.push(tx(`Es un repetidor de acceso: atiende directamente a ${cuenta(suyas.length, "persona", "personas")} de su zona.`, `It is an access repeater: it directly serves ${cuenta(suyas.length, "person", "people")} in its area.`));
    else if (!aislado && r)
      papel.push(tx("Por ahora no atiende a nadie directamente: sirve de cobertura para la gente que llegue a su zona.", "For now it serves no one directly: it provides coverage for people who come into its area."));
    if (res && res.porcentajeMejorServidor >= 1) papel.push(tx(`Es la mejor señal en el ${pct(res.porcentajeMejorServidor)} del área de estudio.`, `It is the best signal over ${pct(res.porcentajeMejorServidor)} of the study area.`));
    if (n?.critico) {
      const dependen = p.repetidores.map(nombre);
      const quienes = [...dependen.slice(0, 3), ...(p.personas ? [cuenta(p.personas, tx("persona", "person"), tx("personas", "people"))] : [])];
      const uno = quienes.length === 1 && (dependen.length === 1 || p.personas === 1);
      papel.push(
        tx(
          `Es un punto crítico: si se apaga, ${quienes.length ? lista(quienes) : "otros nodos"} ${uno ? "pierde" : "pierden"} el camino al gateway; un repetidor de respaldo cerca lo resuelve.`,
          `It is a critical point: if it goes down, ${quienes.length ? lista(quienes) : "other nodes"} ${uno ? "loses" : "lose"} the path to the gateway; a backup repeater nearby solves it.`,
        ),
      );
    } else if (r && !aislado) {
      const respaldos = (r.enlaces ?? []).filter((x) => (x.a === a.id || x.b === a.id) && esInfra.has(x.a === a.id ? x.b : x.a) && x.margen >= 20).length;
      if (respaldos >= 2) papel.push(tx("Tiene respaldo: si uno de sus vecinos falla, sigue llegando al gateway por otro camino.", "It has a backup: if one of its neighbors fails, it still reaches the gateway by another path."));
    }
    if (papel.length) parrafos.push(papel.join(" "));
    parrafos.push(
      a.alturaM < 6
        ? tx("Conviene subirlo al menos a 6 m, el tubo estándar de Trama, para despejar techos y árboles.", "It should be raised to at least 6 m, Trama's standard pole, to clear roofs and trees.")
        : e && e.margen < 30
          ? tx(
              "Para dejarlo firme conviene subirlo a 9 o 12 m o moverlo a la loma más alta cercana; si me pide «ajústamelo», pruebo alturas y lomas hasta dejarlo firme.",
              `To make it solid, it should go up to 9 or 12 m or move to the highest nearby hill; if you ask me to “${AJUSTAR().pedido}”, I'll try heights and hills until it holds firm.`,
            )
          : e
            ? tx(`A ${f1(a.alturaM, 0)} m alcanza con holgura: no hace falta una torre más alta, y eso abarata la instalación.`, `At ${f1(a.alturaM, 0)} m it reaches comfortably: no taller tower is needed, which keeps the installation cheaper.`)
            : tx(`Está a ${f1(a.alturaM, 0)} m de altura.`, `It stands ${f1(a.alturaM, 0)} m high.`),
    );
    if (s !== null || aislado)
      datos.push({ etiqueta: tx("Saltos al gateway", "Hops to the gateway"), valor: s === null ? tx("sin ruta", "no route") : ent(s), tono: s === null || lejos ? "mal" : undefined });
    if (suyas.length) datos.push({ etiqueta: tx("Personas que atiende", "People served"), valor: ent(suyas.length) });
    if (p.personas > suyas.length) datos.push({ etiqueta: tx("Pasan por aquí", "Pass through here"), valor: ent(p.personas), detalle: tx("personas en total", "people in total") });
    const corto =
      dif !== null && dif >= 15
        ? tx(`Está en terreno alto, ${ent(dif)} metros sobre el promedio de la red.`, `It stands on high ground, ${ent(dif)} meters above the network's average.`)
        : padre && e
          ? tx(`Enlaza con ${padre.nombre} con ${f1(e.margen, 0)} dB de margen.`, `It links to ${padre.nombre} with ${f1(e.margen, 0)} dB of margin.`)
          : "";
    const papelCorto = aislado
      ? tx("Hoy no tiene camino al gateway.", "Right now it has no path to the gateway.")
      : susHijos.length && p.personas
        ? tx(
            `Por aquí pasa el tráfico de ${cuenta(p.personas, "persona", "personas")}${n?.critico ? ", y es un punto crítico" : ""}.`,
            `The traffic of ${cuenta(p.personas, "person", "people")} passes through here${n?.critico ? ", and it is a critical point" : ""}.`,
          )
        : suyas.length
          ? tx(`Atiende a ${cuenta(suyas.length, "persona", "personas")}${n?.critico ? " y es un punto crítico" : ""}.`, `It serves ${cuenta(suyas.length, "person", "people")}${n?.critico ? " and is a critical point" : ""}.`)
          : "";
    paradas.push({
      id: "repetidor",
      clave: `repetidor-${a.id}`,
      titulo: a.nombre,
      voz: [
        tx(
          `${a.nombre}${dGw !== null ? `, a ${km(dGw)} al ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} del gateway` : ""}${s !== null ? `, en ${cuenta(s, "salto", "saltos")}` : ""}.`,
          `${a.nombre}${dGw !== null ? `, ${km(dGw)} ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} of the gateway` : ""}${s !== null ? `, ${cuenta(s, "hop", "hops")} away` : ""}.`,
        ),
        corto,
        papelCorto,
      ]
        .filter(Boolean)
        .join(" "),
      resumen: [
        tx(`repetidor solar a ${f1(a.alturaM, 1)} m`, `solar repeater at ${f1(a.alturaM, 1)} m`),
        dGw !== null
          ? tx(
              `a ${km(dGw)} al ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} del gateway${s !== null ? ` (${cuenta(s, "salto", "saltos")})` : ""}`,
              `${km(dGw)} ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} of the gateway${s !== null ? ` (${cuenta(s, "hop", "hops")})` : ""}`,
            )
          : null,
        padre && e ? tx(`enlace de ${f1(e.margen, 0)} dB con ${padre.nombre}`, `${f1(e.margen, 0)} dB link to ${padre.nombre}`) : null,
        aislado
          ? tx("sin camino al gateway", "no path to the gateway")
          : susHijos.length
            ? tx(`troncal de ${lista(susHijos.map((h) => h.nombre))}`, `trunk for ${lista(susHijos.map((h) => h.nombre))}`)
            : suyas.length
              ? tx(`atiende a ${cuenta(suyas.length, "persona", "personas")}`, `serves ${cuenta(suyas.length, "person", "people")}`)
              : null,
        n?.critico ? tx("punto crítico", "critical point") : null,
      ]
        .filter(Boolean)
        .join("; ")
        .concat("."),
      nube: {
        etiqueta: tx(
          `Repetidor solar · ${aislado ? "sin camino al gateway" : s !== null ? `salto ${ent(s)}` : "por simular"}`,
          `Solar repeater · ${aislado ? "no path to the gateway" : s !== null ? `hop ${ent(s)}` : "not simulated yet"}`,
        ),
        titulo: a.nombre,
        subtitulo: [
          sitio,
          dGw !== null ? tx(`a ${km(dGw)} al ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} del gateway`, `${km(dGw)} ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} of the gateway`) : null,
        ]
          .filter(Boolean)
          .join(" · "),
        parrafos,
        datos: datos.slice(0, 5),
        sugerencia: aislado || lejos || (e && e.margen < 30) ? AJUSTAR() : undefined,
      },
      foco: { tipo: "punto", lat: a.lat, lon: a.lon, zoom: 13 },
      ancla: { lat: a.lat, lon: a.lon },
      antena: a.id,
    });
  }

  /* 4 · Las personas */
  const faltan = [...red.sinCobertura, ...red.lejos.filter((x) => !esInfra.has(x.id))];
  if (P) {
    const equipoPersonas = (() => {
      const veces = new Map<string, number>();
      for (const x of personas) veces.set(x.equipo, (veces.get(x.equipo) ?? 0) + 1);
      const id = [...veces.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "xiao";
      return EQUIPO_TXT()[id] ?? tx("una billetera de radio", "a radio wallet");
    })();
    const parrafos = [
      tx(
        `Cada persona lleva ${equipoPersonas}, emparejada con su celular por Bluetooth: con ella paga, manda WhatsApp por texto y consulta a la IA sin señal de celular. ${preset.protocolo === "meshcore" ? "En MeshCore las billeteras no retransmiten: la malla la sostienen los repetidores, y así el canal se cuida." : "En Meshtastic las billeteras también pueden retransmitir; en redes grandes conviene dejarlas mudas (CLIENT_MUTE) para cuidar el canal."}`,
        `Each person carries ${equipoPersonas}, paired with their phone over Bluetooth: with it they pay, send WhatsApp text messages and query the AI without any mobile signal. ${preset.protocolo === "meshcore" ? "In MeshCore the wallets don't relay: the repeaters hold up the mesh, which keeps the channel clear." : "In Meshtastic the wallets can relay too; in large networks it's best to keep them muted (CLIENT_MUTE) to protect the channel."}`,
      ),
    ];
    const datos: CifraPitch[] = [];
    const llegan = tx(
      C === P ? `${P === 1 ? "La persona del mapa llega" : `Las ${ent(P)} personas del mapa llegan`} al gateway` : `${mayuscula(cuenta(C, "persona", "personas"))} de las ${ent(P)} del mapa ${C === 1 ? "llega" : "llegan"} al gateway (${pct((100 * C) / P)})`,
      C === P ? `${P === 1 ? "The person on the map reaches" : `All ${ent(P)} people on the map reach`} the gateway` : `${ent(C)} of the ${ent(P)} people on the map ${C === 1 ? "reaches" : "reach"} the gateway (${pct((100 * C) / P)})`,
    );
    if (r) {
      const saltos = conectadas.map((x) => nodos.get(x.id)?.saltos).filter((x): x is number => typeof x === "number");
      const prom = saltos.length ? saltos.reduce((s, x) => s + x, 0) / saltos.length : 0;
      const reparto = infra
        .map((a) => ({ a, n: (directas.get(a.id) ?? []).length }))
        .filter((x) => x.n > 0)
        .sort((x, y) => y.n - x.n);
      const promTxt = tx(`${f1(prom, 1)} ${f1(prom, 1) === "1" ? "salto" : "saltos"}`, `${f1(prom, 1)} ${f1(prom, 1) === "1" ? "hop" : "hops"}`);
      const entradas = reparto.length > 1 ? lista(reparto.slice(0, 4).map((x) => `${x.a.nombre} (${ent(x.n)})`)) : "";
      parrafos.push(
        tx(
          `${llegan}${saltos.length ? `, en ${promTxt} en promedio; la más lejana, en ${cuenta(Math.max(...saltos), "salto", "saltos")}` : ""}.${
            reparto.length > 1 ? ` Entran a la red por ${entradas}${reparto.length > 4 ? " y otros repetidores" : ""}.` : ""
          }`,
          `${llegan}${saltos.length ? `, in ${promTxt} on average; the farthest, in ${cuenta(Math.max(...saltos), "hop", "hops")}` : ""}.${
            reparto.length > 1 ? ` They enter the network through ${entradas}${reparto.length > 4 ? " and other repeaters" : ""}.` : ""
          }`,
        ),
      );
      if (faltan.length) {
        const c = centroDe(faltan)!;
        const ref = centroRed ?? c;
        parrafos.push(
          tx(
            `${mayuscula(cuenta(faltan.length, "persona todavía no llega", "personas todavía no llegan"))}${dist(ref, c) > 200 ? `: están hacia el ${hacia(rumbo(ref.lat, ref.lon, c.lat, c.lon))} de la red` : ""}. En la siguiente parada le cuento cómo conectarlas.`,
            `${faltan.length === 1 ? "1 person still isn't connected" : `${ent(faltan.length)} people still aren't connected`}${dist(ref, c) > 200 ? `: they are to the ${hacia(rumbo(ref.lat, ref.lon, c.lat, c.lon))} of the network` : ""}. At the next stop I'll explain how to connect them.`,
          ),
        );
      }
      const e = d.estres;
      if (e)
        parrafos.push(
          tx(
            `En la hora pico simulada, al ${pct(e.resumenUsuarios.funcionanPct)} de las personas les funciona la red y el ${pct(e.completosPct)} de los mensajes vuelve con respuesta.`,
            `In the simulated peak hour, the network works for ${pct(e.resumenUsuarios.funcionanPct)} of the people and ${pct(e.completosPct)} of the messages come back with a reply.`,
          ),
        );
      datos.push({ etiqueta: tx("Conectadas", "Connected"), valor: tx(`${ent(C)} de ${ent(P)}`, `${ent(C)} of ${ent(P)}`), tono: C === P ? "bien" : C >= P * 0.8 ? "alerta" : "mal" });
      if (saltos.length) datos.push({ etiqueta: tx("Saltos en promedio", "Average hops"), valor: f1(prom, 1) });
      datos.push({ etiqueta: tx("Sin cobertura", "No coverage"), valor: ent(faltan.length), tono: faltan.length ? "mal" : "bien" });
      if (e) datos.push({ etiqueta: tx("Les funciona", "Works for"), valor: pct(e.resumenUsuarios.funcionanPct), detalle: tx("en la hora pico", "at peak hour") });
    } else parrafos.push(tx("Falta simular para saber cuántas llegan al gateway y por dónde.", "It still needs to be simulated to know how many reach the gateway and by which route."));
    const anclaP = centroDe(conectadas.length ? conectadas : personas)!;
    paradas.push({
      id: "personas",
      clave: "personas",
      titulo: tx("Las personas", "The people"),
      voz: r
        ? tx(
            `${llegan}${faltan.length ? `; faltan ${ent(faltan.length)}` : ""}.`,
            `${llegan}${faltan.length ? `; ${ent(faltan.length)} ${faltan.length === 1 ? "is" : "are"} still missing` : ""}.`,
          )
        : tx(`En el mapa hay ${cuenta(P, "persona", "personas")} con billetera de radio.`, `There ${P === 1 ? "is" : "are"} ${cuenta(P, "person", "people")} on the map with ${P === 1 ? "a radio wallet" : "radio wallets"}.`),
      resumen: r
        ? tx(
            `${C === P ? `${P === 1 ? "la única persona llega" : `las ${ent(P)} llegan`} al gateway` : `${ent(C)} de ${ent(P)} llegan al gateway; faltan ${ent(P - C)}`}.`,
            `${C === P ? `${P === 1 ? "the only person reaches" : `all ${ent(P)} reach`} the gateway` : `${ent(C)} of ${ent(P)} ${C === 1 ? "reaches" : "reach"} the gateway; ${ent(P - C)} still missing`}.`,
          )
        : tx(`${cuenta(P, "persona", "personas")} con billetera de radio.`, `${cuenta(P, "person", "people")} with ${P === 1 ? "a radio wallet" : "radio wallets"}.`),
      nube: {
        etiqueta: tx("Las personas · billeteras de radio", "The people · radio wallets"),
        titulo: tx("Quiénes usan la red", "Who uses the network"),
        subtitulo: tx(`${cuenta(P, "persona", "personas")} en el mapa`, `${cuenta(P, "person", "people")} on the map`),
        parrafos,
        datos,
      },
      foco: { tipo: "red", caja: cajaDe(personas) ?? cajaRed },
      ancla: anclaP,
    });
  }

  /* 5 · Lo que falta */
  if (r) {
    const pendientes: { texto: string; ancla: Punto; foco: FocoPitch; sugerencia?: { texto: string; pedido: string } }[] = [];
    if (!red.gateways.length && infra.length)
      pendientes.push({
        texto: tx(
          "Falta el gateway: sin él la red no tiene salida a internet. Pídame «pon el gateway en…» con el sitio donde habrá Starlink, o «convierte el Repetidor 1 en gateway».",
          "The gateway is missing: without it the network has no way out to the internet. Ask me to “put the gateway at…” with the site where Starlink will be, or to “turn Repeater 1 into a gateway”.",
        ),
        ancla: infra[0],
        foco: { tipo: "punto", lat: infra[0].lat, lon: infra[0].lon, zoom: 12.5 },
      });
    if (faltan.length) {
      const c = centroDe(faltan)!;
      const cerca = infra.length ? Math.min(...infra.map((a) => dist(a, c))) : null;
      pendientes.push({
        texto: tx(
          `${mayuscula(cuenta(faltan.length, "persona no llega", "personas no llegan"))} al gateway${cerca !== null ? `: su centro está a ${km(cerca)} de la antena más cercana` : ""}. Un repetidor entre ellas y la red las conecta; si me pide «conecta a los que faltan», busco con el relieve real dónde ponerlo.`,
          `${cuenta(faltan.length, "person doesn't", "people don't")} reach the gateway${cerca !== null ? `: their center is ${km(cerca)} from the nearest antenna` : ""}. A repeater between them and the network connects them; if you ask me to “${CONECTAR().pedido}”, I'll use the real terrain to find where to put it.`,
        ),
        ancla: c,
        foco: { tipo: "red", caja: cajaDe([...faltan, ...infra.filter((a) => dist(a, c) <= (cerca ?? 0) * 1.6)]) ?? cajaRed },
        sugerencia: CONECTAR(),
      });
    }
    const aislados = red.aislados.filter((a) => esInfra.has(a.id));
    if (aislados.length)
      pendientes.push({
        texto: tx(
          `${lista(aislados.slice(0, 3).map((a) => a.nombre))} ${aislados.length === 1 ? "no tiene" : "no tienen"} camino al gateway. Moverlos a terreno más alto o subir sus antenas los une; con «ajústamelo» pruebo alturas, lomas y antenas de apoyo.`,
          `${lista(aislados.slice(0, 3).map((a) => a.nombre))} ${aislados.length === 1 ? "has no path to the gateway. Moving it to higher ground or raising its antenna connects it" : "have no path to the gateway. Moving them to higher ground or raising their antennas connects them"}; with “${AJUSTAR().pedido}” I'll try heights, hills and support antennas.`,
        ),
        ancla: aislados[0],
        foco: { tipo: "punto", lat: aislados[0].lat, lon: aislados[0].lon, zoom: 12.5 },
        sugerencia: AJUSTAR(),
      });
    // Enlaces débiles en el camino de la señal (entre antenas)
    const debiles = red.repetidores
      .map((a) => {
        const p = padreDe(a);
        const x = p ? enlace(a.id, p.id) : undefined;
        return x && x.margen < 30 ? { a, p: p!, x } : null;
      })
      .filter((x): x is { a: Antena; p: Antena; x: Enlace } => !!x)
      .sort((u, v) => u.x.margen - v.x.margen);
    if (debiles.length) {
      const w = debiles[0];
      pendientes.push({
        texto: tx(
          `${debiles.length === 1 ? "Hay un enlace débil" : `Hay ${ent(debiles.length)} enlaces débiles`}: el peor es ${w.a.nombre}–${w.p.nombre}, con ${f1(w.x.margen, 0)} dB (para que no se caiga con lluvia conviene 30 dB o más). Subir esas antenas a 9 o 12 m o buscar una loma lo arregla; «ajústamelo» lo hace por usted.`,
          `${debiles.length === 1 ? "There is one weak link" : `There are ${ent(debiles.length)} weak links`}: the worst is ${w.a.nombre}–${w.p.nombre}, at ${f1(w.x.margen, 0)} dB (to keep it from dropping in the rain, 30 dB or more is advisable). Raising those antennas to 9 or 12 m or finding a hill fixes it; “${AJUSTAR().pedido}” does it for you.`,
        ),
        ancla: w.a,
        foco: { tipo: "punto", lat: w.a.lat, lon: w.a.lon, zoom: 12.5 },
        sugerencia: AJUSTAR(),
      });
    }
    const criticos = infra.filter((a) => !a.pasarela && nodos.get(a.id)?.critico);
    if (criticos.length)
      pendientes.push({
        texto: tx(
          `${lista(criticos.slice(0, 3).map((a) => a.nombre))} ${criticos.length === 1 ? "es un punto crítico" : "son puntos críticos"}: si ${criticos.length === 1 ? "se apaga" : "uno se apaga"}, otros pierden el camino al gateway. Una antena de apoyo cerca da un segundo camino; pídame «sugiéreme antenas de apoyo».`,
          `${lista(criticos.slice(0, 3).map((a) => a.nombre))} ${criticos.length === 1 ? "is a critical point" : "are critical points"}: if ${criticos.length === 1 ? "it goes down" : "one goes down"}, others lose their path to the gateway. A support antenna nearby provides a second path; just ask me to “${APOYOS().pedido}”.`,
        ),
        ancla: criticos[0],
        foco: { tipo: "punto", lat: criticos[0].lat, lon: criticos[0].lon, zoom: 12.5 },
        sugerencia: APOYOS(),
      });
    if (pendientes.length) {
      const primero = pendientes[0];
      paradas.push({
        id: "pendiente",
        clave: "pendiente",
        titulo: tx("Lo que falta", "What's missing"),
        voz: tx(
          `${primero.texto.split(/(?<=\.)\s/)[0]}${primero.sugerencia ? ` Pídame «${primero.sugerencia.pedido}».` : ""}`,
          `${primero.texto.split(/(?<=\.)\s/)[0]}${primero.sugerencia ? ` Just say: “${primero.sugerencia.pedido}”.` : ""}`,
        ),
        resumen: pendientes
          .map((x) => x.texto.split(/(?<=\.)\s/)[0].replace(/\.$/, ""))
          .join("; ")
          .concat("."),
        nube: {
          etiqueta: tx("Lo que falta", "What's missing"),
          titulo: tx("Para dejarla completa", "To make it complete"),
          subtitulo: tx(cuenta(pendientes.length, "punto por resolver", "puntos por resolver"), cuenta(pendientes.length, "issue to resolve", "issues to resolve")),
          parrafos: pendientes.slice(0, 4).map((x) => x.texto),
          datos: [
            { etiqueta: tx("Sin cobertura", "No coverage"), valor: ent(faltan.length), tono: faltan.length ? "mal" : "bien" },
            { etiqueta: tx("Enlaces débiles", "Weak links"), valor: ent(debiles.length), tono: debiles.length ? "alerta" : "bien" },
            { etiqueta: tx("Puntos críticos", "Critical points"), valor: ent(criticos.length), tono: criticos.length ? "alerta" : "bien" },
            ...(aislados.length ? [{ etiqueta: tx("Sin camino", "No path"), valor: ent(aislados.length), tono: "mal" as const }] : []),
          ],
          sugerencia: primero.sugerencia,
        },
        foco: primero.foco,
        ancla: { lat: primero.ancla.lat, lon: primero.ancla.lon },
      });
    }

    /* 6 · Los refuerzos: qué le falta para funcionar al 100 % (que todos lleguen) y al 99,9 % (que no se caiga) */
    {
      const G = red.gateways.length;
      const plan: string[] = [];
      const datos: CifraPitch[] = [];
      let apoyos = 0;
      // El alcance de esta red: hacia la gente (el de las antenas) y entre antenas (lo que miden sus tramos)
      const alcanceKm = mediana(infra.map((a) => porId.get(a.id)?.alcanceKm ?? 0).filter((x) => x > 0));
      const tramo = mediana(
        red.repetidores
          .map((a) => {
            const p = padreDe(a);
            return p ? dist(a, p) : null;
          })
          .filter((x): x is number => x !== null),
      );
      const salto = tramo ?? (alcanceKm ? alcanceKm * 1000 : null);
      // Al 100 % de las personas: los grupos que no llegan, cada uno con los repetidores que lo acercan a la red
      if (faltan.length && salto) {
        const grupos = agrupar(faltan, Math.max(500, (alcanceKm ? alcanceKm * 1000 : salto) * 0.6));
        const conRuta = infra.filter((a) => typeof nodos.get(a.id)?.saltos === "number");
        const base = conRuta.length ? conRuta : infra;
        const lejos = grupos.map((g) => {
          const c = centroDe(g)!;
          return base.length ? Math.min(...base.map((a) => dist(a, c))) : 0;
        });
        apoyos = lejos.reduce((s, x) => s + Math.max(1, Math.round(x / salto)), 0);
        const maxLejos = Math.max(...lejos);
        const alcances = [
          alcanceKm ? tx(`unos ${km(alcanceKm * 1000)} hacia la gente`, `about ${km(alcanceKm * 1000)} to the people`) : null,
          tramo ? tx(`${km(tramo)} entre antenas`, `${km(tramo)} between antennas`) : null,
        ].filter(Boolean) as string[];
        plan.push(
          tx(
            `Al 100 % de las personas: ${cuenta(faltan.length, "persona no llega", "personas no llegan")} al gateway${grupos.length > 1 ? `, en ${cuenta(grupos.length, "grupo", "grupos")}` : ""}${maxLejos >= 300 ? `; ${grupos.length > 1 ? "el más lejano está" : faltan.length === 1 ? "está" : "están"} a ${km(maxLejos)} de la red` : ""}. Con el alcance de los repetidores de esta red${alcances.length ? ` (${lista(alcances)})` : ""}, hacen falta unos ${cuenta(apoyos, "repetidor de apoyo", "repetidores de apoyo")}: es un estimado, «conecta a los que faltan» los ubica con el relieve real.`,
            `For 100% of the people: ${cuenta(faltan.length, "person doesn't", "people don't")} reach the gateway${grupos.length > 1 ? `, in ${cuenta(grupos.length, "group", "groups")}` : ""}${maxLejos >= 300 ? `; ${grupos.length > 1 ? "the farthest group is" : "they are"} ${km(maxLejos)} from the network` : ""}. Given the range of this network's repeaters${alcances.length ? ` (${lista(alcances)})` : ""}, about ${cuenta(apoyos, "support repeater is", "support repeaters are")} needed: this is an estimate; “${CONECTAR().pedido}” places them using the real terrain.`,
          ),
        );
        datos.push({ etiqueta: tx("Repetidores de apoyo", "Support repeaters"), valor: ent(apoyos), detalle: tx("para llegar a todos", "to reach everyone"), tono: "alerta" });
      } else if (P && !faltan.length)
        plan.push(
          tx(
            `Al 100 % de las personas: ${P === 1 ? "la persona del mapa llega" : `las ${ent(P)} personas del mapa llegan`} al gateway; no hace falta ningún repetidor más para conectarlas.`,
            `For 100% of the people: ${P === 1 ? "the person on the map reaches" : `all ${ent(P)} people on the map reach`} the gateway; no further repeaters are needed to connect them.`,
          ),
        );
      const largos = red.lejos.filter((x) => esInfra.has(x.id));
      const sinCamino = red.aislados.filter((a) => esInfra.has(a.id));
      if (sinCamino.length || largos.length)
        plan.push(
          [
            sinCamino.length
              ? tx(
                  `${lista(sinCamino.slice(0, 3).map((a) => a.nombre))} ${sinCamino.length === 1 ? "necesita" : "necesitan"} llegar a la malla: subir la antena, moverlo a una loma o, si no alcanza, un repetidor intermedio.`,
                  `${lista(sinCamino.slice(0, 3).map((a) => a.nombre))} ${sinCamino.length === 1 ? "needs" : "need"} to reach the mesh: raise the antenna, move it to a hill or, if that isn't enough, add an intermediate repeater.`,
                )
              : "",
            largos.length
              ? tx(
                  `${lista(largos.slice(0, 3).map((a) => a.nombre))} ${largos.length === 1 ? "pasa" : "pasan"} del límite de ${cuenta(limite, "salto", "saltos")}: un repetidor que acorte el camino o antenas más altas lo resuelve.`,
                  `${lista(largos.slice(0, 3).map((a) => a.nombre))} ${largos.length === 1 ? "exceeds" : "exceed"} the limit of ${cuenta(limite, "hop", "hops")}: a repeater that shortens the path, or taller antennas, solves it.`,
                )
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        );
      // Enlaces firmes: en el camino de la señal, menos de 30 dB es inestable; para el 99,9 %, 37 dB o más
      const enRuta = red.repetidores
        .map((a) => {
          const p = padreDe(a);
          const x = p ? enlace(a.id, p.id) : undefined;
          return x ? { a, p: p!, x } : null;
        })
        .filter((x): x is { a: Antena; p: Antena; x: Enlace } => !!x)
        .sort((u, v) => u.x.margen - v.x.margen);
      const justos = enRuta.filter((y) => y.x.margen >= 30 && y.x.margen < 37);
      const tramoTxt = (y: { a: Antena; p: Antena; x: Enlace }) => `${y.a.nombre}–${y.p.nombre} (${f1(y.x.margen, 0)} dB)`;
      if (debiles.length || justos.length)
        plan.push(
          tx(
            `Enlaces firmes: ${
              debiles.length
                ? `${debiles.length === 1 ? `el enlace ${tramoTxt(debiles[0])} es inestable` : `${ent(debiles.length)} enlaces son inestables (${lista(debiles.slice(0, 3).map(tramoTxt))})`}: con lluvia se ${debiles.length === 1 ? "puede caer" : "pueden caer"}; hay que subir esas antenas a 9 o 12 m o llevarlas a una loma. `
                : ""
            }${justos.length ? `Para el 99,9 %, todos los enlaces del camino deberían tener 37 dB o más (aguantan lluvia y follaje): ${justos.length === 1 ? "falta" : "faltan"} ${lista(justos.slice(0, 3).map(tramoTxt))}${justos.length > 3 ? ` y ${cuenta(justos.length - 3, "más", "más")}` : ""}.` : ""}`.trim(),
            `Solid links: ${
              debiles.length
                ? `${debiles.length === 1 ? `the ${tramoTxt(debiles[0])} link is unstable` : `${ent(debiles.length)} links are unstable (${lista(debiles.slice(0, 3).map(tramoTxt))})`}: in the rain ${debiles.length === 1 ? "it can drop" : "they can drop"}; those antennas need to go up to 9 or 12 m or be moved to a hill. `
                : ""
            }${justos.length ? `For 99.9%, every link along the path should have 37 dB or more (they hold up to rain and foliage): ${justos.length === 1 ? "this one falls short" : "these fall short"}: ${lista(justos.slice(0, 3).map(tramoTxt))}${justos.length > 3 ? ` and ${cuenta(justos.length - 3, "more", "more")}` : ""}.` : ""}`.trim(),
          ),
        );
      else if (enRuta.length)
        plan.push(
          tx(
            `Enlaces firmes: ${enRuta.length === 1 ? "el enlace del camino tiene" : "todos los enlaces del camino tienen"} 37 dB o más: aguantan lluvia y follaje.`,
            `Solid links: ${enRuta.length === 1 ? "the link along the path has" : "all the links along the path have"} 37 dB or more: they hold up to rain and foliage.`,
          ),
        );
      if (debiles.length + justos.length)
        datos.push({ etiqueta: tx("Enlaces por reforzar", "Links to reinforce"), valor: ent(debiles.length + justos.length), detalle: tx("con menos de 37 dB", "below 37 dB"), tono: debiles.length ? "mal" : "alerta" });
      // Respaldo: un segundo camino donde hoy hay un punto único de falla
      if (criticos.length) {
        plan.push(
          tx(
            `Respaldo: ${lista(criticos.slice(0, 3).map((a) => a.nombre))} ${criticos.length === 1 ? "es un punto único de falla" : "son puntos únicos de falla"}; un repetidor de respaldo cerca de cada uno da un segundo camino al gateway (${cuenta(criticos.length, "repetidor más", "repetidores más")}).`,
            `Backup: ${lista(criticos.slice(0, 3).map((a) => a.nombre))} ${criticos.length === 1 ? "is a single point of failure; a backup repeater near it" : "are single points of failure; a backup repeater near each one"} gives a second path to the gateway (${cuenta(criticos.length, "more repeater", "more repeaters")}).`,
          ),
        );
        datos.push({
          etiqueta: tx("Respaldos", "Backups"),
          valor: ent(criticos.length),
          detalle: criticos.length === 1 ? tx("punto único de falla", "single point of failure") : tx("puntos únicos de falla", "single points of failure"),
          tono: "alerta",
        });
      } else if (red.repetidores.length)
        plan.push(
          tx(
            "Respaldo: no hay puntos únicos de falla entre los repetidores; si uno se apaga, los demás siguen llegando al gateway.",
            "Backup: there are no single points of failure among the repeaters; if one goes down, the others still reach the gateway.",
          ),
        );
      // El 99,9 % del tiempo: la salida a internet y la energía
      plan.push(
        G === 0
          ? tx(
              "Al 99,9 % del tiempo (menos de 9 horas sin servicio al año): primero, el gateway; sin él no hay salida a internet. Después, un segundo gateway o un segundo enlace a internet para que una falla no deje a todos sin servicio.",
              "For 99.9% of the time (less than 9 hours without service a year): first, the gateway; without it there is no way out to the internet. Then, a second gateway or a second internet link, so that a single failure doesn't leave everyone without service.",
            )
          : G === 1
            ? tx(
                "Al 99,9 % del tiempo (menos de 9 horas sin servicio al año): con un solo gateway, si se cae el Starlink o el mini PC, la malla sigue en pie pero sin internet. Hace falta un segundo gateway en otra parte de la malla, o un segundo enlace a internet en el mismo sitio, además de la UPS, baterías para los días nublados y el mantenimiento preventivo.",
                "For 99.9% of the time (less than 9 hours without service a year): with a single gateway, if the Starlink or the mini PC goes down, the mesh stays up but without internet. A second gateway elsewhere in the mesh is needed, or a second internet link at the same site, plus the UPS, batteries for cloudy days and preventive maintenance.",
              )
            : tx(
                `Al 99,9 % del tiempo (menos de 9 horas sin servicio al año): con ${ent(G)} gateways, si uno falla, la gente cercana al otro sigue con internet; falta cuidar la energía (UPS y baterías para los días nublados) y el mantenimiento preventivo.`,
                `For 99.9% of the time (less than 9 hours without service a year): with ${ent(G)} gateways, if one fails, the people near the other keep their internet; what remains is to look after the power supply (UPS and batteries for cloudy days) and preventive maintenance.`,
              ),
      );
      datos.push({
        etiqueta: "Gateways",
        valor: G <= 1 ? `${ent(G)} → ${ent(G + 1)}` : ent(G),
        detalle: G === 0 ? tx("sin él no hay internet", "no internet without it") : G === 1 ? tx("para el 99,9 %", "for 99.9%") : tx("con respaldo de internet", "with internet backup"),
        tono: G <= 1 ? "alerta" : "bien",
      });
      // La hora pico: si el canal aguanta a toda la gente
      const e = d.estres;
      let saturadas = 0;
      if (e) {
        const malas = e.zonas.filter((z) => z.estado === "revienta" || z.estado === "lento");
        saturadas = malas.length;
        const mejor = (e.ajustes ?? []).filter((x) => !x.actual && x.completosPct >= e.completosPct + 1 && x.conRuta >= e.usuarios).sort((x, y) => y.completosPct - x.completosPct)[0];
        const bien = !malas.length && e.completosPct >= 99.9;
        plan.push(
          tx(
            `Hora pico: le funciona al ${pct(e.resumenUsuarios.funcionanPct)} de las personas y vuelve el ${pct(e.completosPct)} de los mensajes${bien ? ": el canal aguanta." : "."}${malas.length ? ` Se ${malas.length === 1 ? "satura" : "saturan"} ${lista(malas.slice(0, 3).map((z) => z.nombre))}: un repetidor más en ${malas.length === 1 ? "esa zona" : "esas zonas"} reparte la carga.` : ""}${mejor ? ` Con el ajuste de radio ${mejor.nombre} volvería el ${pct(mejor.completosPct)}.` : ""}`,
            `Peak hour: it works for ${pct(e.resumenUsuarios.funcionanPct)} of the people and ${pct(e.completosPct)} of the messages come back${bien ? ": the channel holds up." : "."}${malas.length ? ` ${lista(malas.slice(0, 3).map((z) => z.nombre))} ${malas.length === 1 ? "gets" : "get"} overloaded: one more repeater in ${malas.length === 1 ? "that area" : "those areas"} spreads the load.` : ""}${mejor ? ` With the ${mejor.nombre} radio setting, ${pct(mejor.completosPct)} would come back.` : ""}`,
          ),
        );
      } else
        plan.push(
          tx(
            `Hora pico: falta probarla; pídame «${P ? "prueba la hora pico" : "pon 250 personas alrededor de cada gateway y repetidor y haz la prueba de estrés"}» y le digo si el canal aguanta a toda la gente.`,
            `Peak hour: not tested yet; ask me to “${P ? PROBAR_PICO() : POBLAR_Y_PROBAR()}” and I'll tell you whether the channel can handle everyone.`,
          ),
        );
      // Lo que costarían los refuerzos, con el modelo de costos de Trama
      const gx = G <= 1 ? 1 : 0;
      const rx = apoyos + criticos.length + saturadas;
      const sitio = infra[0] ?? activas[0];
      let costoTxt = "";
      if ((gx || rx) && sitio) {
        const dep = departamentoTrama(d.lugar?.(sitio.lat, sitio.lon)?.departamento);
        const c = costoRedTrama(gx, rx, 0, "xiao", dep?.logistica ?? 1);
        const piezas = [
          ...(rx ? [cuenta(rx, tx("repetidor más", "more repeater"), tx("repetidores más", "more repeaters"))] : []),
          ...(gx ? [G === 0 ? tx("el gateway", "the gateway") : tx("un segundo gateway", "a second gateway")] : []),
        ];
        costoTxt = tx(`unos ${pesosHablados(c.inversion.total)} de inversión y ${pesosHablados(c.mensual.total)} más al mes`, `about ${pesosHablados(c.inversion.total)} of investment and ${pesosHablados(c.mensual.total)} more per month`);
        plan.push(
          tx(
            `En total, ${lista(piezas)}: unos ${pesosHablados(c.inversion.total)} de inversión (con instalación y transporte) y ${pesosHablados(c.mensual.total)} más al mes, con el modelo de costos de Trama.`,
            `In total, ${lista(piezas)}: about ${pesosHablados(c.inversion.total)} of investment (including installation and transport) and ${pesosHablados(c.mensual.total)} more per month, using Trama's cost model.`,
          ),
        );
      }
      const faltaAlgo = apoyos + debiles.length + justos.length + criticos.length + sinCamino.length + largos.length + saturadas > 0 || G <= 1;
      const piezasVoz = [
        apoyos ? tx(`unos ${cuenta(apoyos, "repetidor de apoyo", "repetidores de apoyo")} para llegar a todos`, `about ${cuenta(apoyos, "support repeater", "support repeaters")} to reach everyone`) : "",
        debiles.length + justos.length ? tx(`reforzar ${cuenta(debiles.length + justos.length, "enlace", "enlaces")}`, cuenta(debiles.length + justos.length, "reinforced link", "reinforced links")) : "",
        criticos.length ? cuenta(criticos.length, tx("respaldo", "backup"), tx("respaldos", "backups")) : "",
        G <= 1 ? (G === 0 ? tx("el gateway", "the gateway") : tx("un segundo gateway", "a second gateway")) : "",
      ].filter(Boolean);
      paradas.push({
        id: "refuerzos",
        clave: "refuerzos",
        titulo: tx("Para que funcione al 100 %", "To work at 100%"),
        voz: piezasVoz.length
          ? tx(`Para que funcione al 100 % y al 99,9 % necesita ${lista(piezasVoz)}.`, `To work at 100% and at 99.9%, it needs ${lista(piezasVoz)}.`)
          : tx(
              "La red ya está reforzada: todos llegan, los enlaces son firmes y no hay puntos únicos de falla.",
              "The network is already reinforced: everyone gets through, the links are solid and there are no single points of failure.",
            ),
        resumen: piezasVoz.length
          ? tx(
              `para funcionar al 100 % y al 99,9 % necesita ${lista(piezasVoz)}${costoTxt ? ` (${costoTxt})` : ""}${e ? "" : "; falta probar la hora pico"}.`,
              `to work at 100% and at 99.9% it needs ${lista(piezasVoz)}${costoTxt ? ` (${costoTxt})` : ""}${e ? "" : "; the peak hour still needs testing"}.`,
            )
          : tx(
              `ya está reforzada: todos llegan, los enlaces son firmes y no hay puntos únicos de falla${e ? "" : "; falta probar la hora pico"}.`,
              `already reinforced: everyone gets through, the links are solid and there are no single points of failure${e ? "" : "; the peak hour still needs testing"}.`,
            ),
        nube: {
          etiqueta: tx("Refuerzos", "Reinforcements"),
          titulo: tx("Para que funcione al 100 % y al 99,9 %", "To work at 100% and at 99.9%"),
          subtitulo: faltaAlgo ? tx("Lo que le falta, con números del simulador", "What it still needs, with the simulator's numbers") : tx("Ya está reforzada", "Already reinforced"),
          parrafos: plan,
          datos: datos.slice(0, 4),
          sugerencia: faltan.length
            ? CONECTAR()
            : debiles.length || justos.length || sinCamino.length || largos.length
              ? AJUSTAR()
              : criticos.length
                ? APOYOS()
                : !e
                  ? { texto: tx("Probar la hora pico", "Test the peak hour"), pedido: P ? PROBAR_PICO() : POBLAR_Y_PROBAR() }
                  : undefined,
        },
        foco: { tipo: "red", caja: cajaRed },
        ancla: null,
      });
    }
  }

  /* 7 · Por qué la red quedó así */
  {
    const parrafos: string[] = [];
    const G = red.gateways.length;
    const R = red.repetidores.length;
    // La estructura: cuántas piezas, cuántos saltos y a qué distancia quedaron los repetidores
    const tramos = red.repetidores
      .map((a) => {
        const p = padreDe(a);
        return p ? dist(a, p) : null;
      })
      .filter((x): x is number => x !== null);
    if (R) {
      const distancia = tramos.length ? (tramos.length > 1 && Math.max(...tramos) - Math.min(...tramos) >= 300 ? tx(`entre ${km(Math.min(...tramos))} y ${km(Math.max(...tramos))}`, `between ${km(Math.min(...tramos))} and ${km(Math.max(...tramos))}`) : km(tramos[0])) : "";
      parrafos.push(
        tx(
          `Es una malla de ${cuenta(G, "gateway", "gateways")} y ${cuenta(R, "repetidor", "repetidores")}${r ? ` que llega en ${cuenta(red.saltosMax, "salto", "saltos")} como máximo (el límite de diseño es ${ent(limite)})` : ""}.${
            tramos.length ? ` Cada repetidor quedó a ${distancia} de la antena con la que se enlaza: la distancia a la que el enlace conserva margen sobre este terreno.` : ""
          }${resto > 0 ? ` Además de los puntos del recorrido hay ${cuenta(resto, "antena más", "antenas más")} con el mismo criterio.` : ""}`,
          `It is a mesh of ${cuenta(G, "gateway", "gateways")} and ${cuenta(R, "repeater", "repeaters")}${r ? ` where every path takes at most ${cuenta(red.saltosMax, "hop", "hops")} (the design limit is ${ent(limite)})` : ""}.${
            tramos.length ? ` Each repeater ended up ${distancia} from the antenna it links to: the distance at which the link keeps its margin over this terrain.` : ""
          }${resto > 0 ? ` Besides the stops on this walkthrough, there ${resto === 1 ? "is" : "are"} ${cuenta(resto, "more antenna", "more antennas")} placed by the same criteria.` : ""}`,
        ),
      );
    } else if (G) parrafos.push(tx("Es una red de un solo sitio: el gateway atiende directo a todas las personas que alcanza, sin repetidores.", "It is a single-site network: the gateway directly serves everyone it reaches, with no repeaters."));
    // El reparto de la gente
    if (r && C && infra.length > 1) {
      const carga = infra.map((a) => ({ a, n: (directas.get(a.id) ?? []).length })).sort((x, y) => y.n - x.n)[0];
      const parte = (100 * carga.n) / C;
      parrafos.push(
        parte <= 50
          ? tx(
              `La carga quedó repartida: el punto más cargado, ${carga.a.nombre}, atiende al ${pct(parte)} de las personas conectadas (${ent(carga.n)} de ${ent(C)}), así ningún canal se satura antes que los demás.`,
              `The load is well spread: the busiest point, ${carga.a.nombre}, serves ${pct(parte)} of the connected people (${ent(carga.n)} of ${ent(C)}), so no channel saturates before the others.`,
            )
          : tx(
              `La carga se concentra en ${carga.a.nombre}, que atiende al ${pct(parte)} de las personas conectadas: un repetidor más en su zona la repartiría y aliviaría su canal en la hora pico.`,
              `The load is concentrated on ${carga.a.nombre}, which serves ${pct(parte)} of the connected people: one more repeater in its area would spread it out and ease its channel at peak hour.`,
            ),
      );
    }
    // La solidez: línea de vista, el enlace más débil y los puntos críticos
    if (r) {
      const entreAntenas = r.enlaces.filter((x) => esInfra.has(x.a) && esInfra.has(x.b) && x.margen >= 20);
      const usados = red.repetidores.map((a) => {
        const p = padreDe(a);
        return p ? enlace(a.id, p.id) : undefined;
      });
      const enRuta = usados.filter((x): x is Enlace => !!x);
      const peor = [...enRuta].sort((x, y) => x.margen - y.margen)[0];
      const criticos = infra.filter((a) => !a.pasarela && nodos.get(a.id)?.critico);
      const partes: string[] = [];
      if (enRuta.length) {
        const lv = enRuta.filter((x) => x.lineaVista).length;
        const vista =
          lv === 0
            ? `${enRuta.length === 1 ? "no tiene" : "ninguno tiene"} línea de vista despejada (la señal pasa por difracción sobre el terreno)`
            : lv === enRuta.length
              ? enRuta.length === 1
                ? "tiene línea de vista despejada"
                : "todos tienen línea de vista despejada"
              : `${ent(lv)} ${lv === 1 ? "tiene" : "tienen"} línea de vista despejada`;
        const vistaEn =
          lv === 0
            ? `${enRuta.length === 1 ? "has no" : "none has a"} clear line of sight (the signal travels by diffraction over the terrain)`
            : lv === enRuta.length
              ? enRuta.length === 1
                ? "has a clear line of sight"
                : "all have a clear line of sight"
              : `${ent(lv)} ${lv === 1 ? "has" : "have"} a clear line of sight`;
        partes.push(
          tx(
            `${enRuta.length === 1 ? "El enlace entre antenas que lleva la señal" : `De los ${ent(enRuta.length)} enlaces entre antenas que lleva la señal,`} ${vista}; ${enRuta.length === 1 ? "tiene" : "el más débil es"} ${enRuta.length === 1 ? "" : `${nombre(peor.a)}–${nombre(peor.b)}, con `}${f1(peor.margen, 0)} dB${enRuta.length === 1 ? " de margen" : ""}.`,
            enRuta.length === 1
              ? `The antenna-to-antenna link carrying the signal ${vistaEn}; it has ${f1(peor.margen, 0)} dB of margin.`
              : `Of the ${ent(enRuta.length)} antenna-to-antenna links carrying the signal, ${vistaEn}; the weakest is ${nombre(peor.a)}–${nombre(peor.b)}, at ${f1(peor.margen, 0)} dB.`,
          ),
        );
      }
      if (entreAntenas.length > enRuta.length)
        partes.push(
          tx(
            `Hay ${cuenta(entreAntenas.length - enRuta.length, "enlace", "enlaces")} de sobra entre antenas, que sirven de respaldo.`,
            `There ${entreAntenas.length - enRuta.length === 1 ? "is" : "are"} ${cuenta(entreAntenas.length - enRuta.length, "spare link", "spare links")} between antennas, which serve as backup.`,
          ),
        );
      partes.push(
        criticos.length
          ? tx(
              `${criticos.length === 1 ? "Queda un punto crítico" : `Quedan ${ent(criticos.length)} puntos críticos`} (${lista(criticos.slice(0, 3).map((a) => a.nombre))}): un respaldo cerca los cubre.`,
              `${criticos.length === 1 ? "One critical point remains" : `${ent(criticos.length)} critical points remain`} (${lista(criticos.slice(0, 3).map((a) => a.nombre))}): a backup nearby covers ${criticos.length === 1 ? "it" : "them"}.`,
            )
          : R
            ? tx(
                "No tiene puntos únicos de falla entre los repetidores: si uno se apaga, los demás siguen llegando al gateway.",
                "It has no single points of failure among the repeaters: if one goes down, the others still reach the gateway.",
              )
            : "",
      );
      parrafos.push(partes.filter(Boolean).join(" "));
      const servicio = r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio;
      const primera = primeraFrase(r.factibilidad.recomendaciones[0]);
      parrafos.push(
        tx(
          `Con este diseño la red da servicio en el ${pct(servicio)} ${r.areaObjetivo ? "del área objetivo" : "del área de estudio"}${P ? ` y llega a ${ent(C)} de ${ent(P)} personas` : ""}. El simulador la califica «${r.factibilidad.titulo}» (${ent(r.factibilidad.puntaje)} de 100).${primera ? ` Lo primero que señala: «${mayuscula(primera)}».` : ""}`,
          `With this design the network provides service over ${pct(servicio)} of the ${r.areaObjetivo ? "target area" : "study area"}${P ? ` and reaches ${ent(C)} of ${ent(P)} people` : ""}. The simulator rates it “${r.factibilidad.titulo}” (${ent(r.factibilidad.puntaje)} out of 100).${primera ? ` The first thing it points out: “${mayuscula(primera)}”.` : ""}`,
        ),
      );
    }
    if (G || R) {
      const dep = departamentoTrama(d.lugar?.((infra[0] ?? activas[0]).lat, (infra[0] ?? activas[0]).lon)?.departamento);
      const costo = costoRedTrama(G, R, 0, "xiao", dep?.logistica ?? 1);
      parrafos.push(
        tx(
          `Montar esta infraestructura (${cuenta(G, "sitio gateway", "sitios gateway")} y ${cuenta(R, "repetidor", "repetidores")}, con instalación y transporte) cuesta ${pesosHablados(costo.inversion.total)}, y mantenerla, ${pesosHablados(costo.mensual.total)} al mes. Las billeteras, el soporte y el punto de equilibrio están en el pitch: pídame «preséntame el modelo de negocio».`,
          `Building this infrastructure (${cuenta(G, "gateway site", "gateway sites")} and ${cuenta(R, "repeater", "repeaters")}, including installation and transport) costs ${pesosHablados(costo.inversion.total)}, and maintaining it, ${pesosHablados(costo.mensual.total)} a month. The wallets, the support and the break-even point are in the pitch: just ask me to “present the business model”.`,
        ),
      );
    }
    if (!parrafos.length)
      parrafos.push(
        tx(
          "Todavía no hay red en el mapa: ponga el gateway y los repetidores, o pídame «ármame una red que cubra todo el municipio».",
          "There is no network on the map yet: place the gateway and the repeaters, or ask me to “build me a network that covers the whole municipality”.",
        ),
      );
    const enRuta = red.repetidores.map((a) => {
      const p = padreDe(a);
      return p ? enlace(a.id, p.id) : undefined;
    });
    const minimo = enRuta.filter((x): x is Enlace => !!x).reduce((m, x) => Math.min(m, x.margen), Infinity);
    paradas.push({
      id: "cierre",
      clave: "cierre",
      titulo: tx("Por qué la red quedó así", "Why the network turned out this way"),
      resumen: parrafos.join(" "),
      voz: r
        ? tx(
            `La red quedó así para llegar a ${ent(C)} de ${ent(P)} personas en ${cuenta(red.saltosMax, "salto", "saltos")} como máximo${Number.isFinite(minimo) ? `, con enlaces de al menos ${f1(minimo, 0)} dB entre antenas` : ""}. El simulador la califica ${r.factibilidad.titulo.toLowerCase()}.`,
            `The network was laid out this way to reach ${ent(C)} of ${ent(P)} people in at most ${cuenta(red.saltosMax, "hop", "hops")}${Number.isFinite(minimo) ? `, with links of at least ${f1(minimo, 0)} dB between antennas` : ""}. The simulator rates it ${r.factibilidad.titulo.toLowerCase()}.`,
          )
        : tx("Así quedó la red del mapa. Al terminar la simulación le confirmo los enlaces y la cobertura.", "That is how the network on the map turned out. Once the simulation finishes, I'll confirm the links and the coverage."),
      nube: {
        etiqueta: tx("Conclusión", "Conclusion"),
        titulo: tx("Por qué la red quedó así", "Why the network turned out this way"),
        subtitulo: r ? r.factibilidad.titulo : tx("Diseño de la malla", "Mesh design"),
        parrafos,
        datos: r
          ? [
              { etiqueta: tx("Con servicio", "With service"), valor: pct(r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio) },
              ...(P ? [{ etiqueta: tx("Personas conectadas", "Connected people"), valor: tx(`${ent(C)} de ${ent(P)}`, `${ent(C)} of ${ent(P)}`), tono: (C === P ? "bien" : "alerta") as CifraPitch["tono"] }] : []),
              { etiqueta: tx("Saltos máximos", "Max hops"), valor: ent(red.saltosMax) },
              ...(Number.isFinite(minimo) ? [{ etiqueta: tx("Enlace más débil", "Weakest link"), valor: `${f1(minimo, 0)} dB`, tono: calidad(minimo).tono }] : []),
            ]
          : [],
      },
      foco: { tipo: "red", caja: cajaRed },
      ancla: null,
    });
  }

  return paradas;
}

/** El resumen escrito del recorrido (para la conversación, al terminar). */
export function resumenRecorrido(paradas: ParadaRecorrido[]): string {
  const cierre = paradas.find((p) => p.id === "cierre");
  const lineas = paradas.filter((p) => p.id !== "panorama" && p.id !== "cierre").map((p) => `• ${p.titulo}: ${p.resumen}`);
  return [
    tx(`Le dejo por escrito el recorrido de la red (${cuenta(paradas.length, "parada", "paradas")}):`, `Here is the network walkthrough in writing (${cuenta(paradas.length, "stop", "stops")}):`),
    ...lineas,
    ...(cierre ? [tx(`Por qué quedó así: ${cierre.resumen}`, `Why it turned out this way: ${cierre.resumen}`)] : []),
  ].join("\n");
}

/* ───────────── Pedidos ───────────── */

export type AccionRecorrido = "empezar" | "siguiente" | "anterior" | "pausar" | "seguir" | "repetir" | "terminar" | "ir";
/** `parada`: lo que se dijo para elegir la parada («el Repetidor 2», «el gateway», «por qué quedó así»). */
export type PedidoRecorrido = { accion: AccionRecorrido; parada?: string };

const sinTildes = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const EN_NUMEROS: Record<string, string> = { uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9", diez: "10", once: "11", doce: "12" };
/** Para comparar nombres: sin tildes ni signos y con los números en cifras («repetidor dos» → «repetidor 2»). */
const normal = (t: string) =>
  sinTildes(t)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g, (x) => EN_NUMEROS[x])
    .replace(/\s+/g, " ")
    .trim();

const NUMEROS_INGLES: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };
/**
 * Los nombres por defecto de los dos idiomas en una sola forma, para que «Repeater 2» y «Repetidor 2» sean el mismo
 * punto («repeater two» → «repetidor 2», «support 1» → «apoyo 1»). En español no cambia nada.
 */
const canonico = (t: string) =>
  normal(t)
    .replace(/\b(repeater|repetidor|person|persona|support|apoyo) (one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g, (_m, tipo: string, x: string) => `${tipo} ${NUMEROS_INGLES[x]}`)
    .replace(/\brepeaters?\b/g, "repetidor")
    .replace(/\bpersons?\b/g, "persona")
    .replace(/\bsupport (\d+)\b/g, "apoyo $1");

const RED = /\b(la red|mi red|esta red|tu red|nuestra red|la malla|esta malla|mi malla|las antenas|los repetidores|cada (punto|antena|repetidor|nodo)|punto por punto|antena por antena)\b/;
const NO_RED = /\b(modelo de negocio|negocio|pitch|presentacion|como funciona|que es|los saltos|el protocolo|meshcore|meshtastic|lora|los colores|la leyenda)\b/;

/**
 * ¿El texto le pide algo al recorrido de la red? «explícame la red», «hazme un recorrido por la red», «recorre la
 * red punto por punto», «¿por qué la red quedó así?», «¿por qué pusiste el Repetidor 2 ahí?». Con `enCurso` también
 * entiende «siguiente», «anterior», «pausa», «sigue», «repite», «ve al gateway» y «termina el recorrido». También en
 * inglés: «walk me through the network», «explain the network», «why did the network turn out like this?», «next»,
 * «go to Repeater 2», «end the walkthrough»…
 */
export function pedidoRecorrido(texto: string, enCurso: boolean): PedidoRecorrido | null {
  const t = sinTildes(texto)
    .replace(/[¿?¡!.,;:«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(oye |hey |hola )?melk[iy]\s*/, "");
  if (!t) return null;
  // «¿Por qué la red quedó así?»: la conclusión; «¿por qué pusiste el Repetidor 2 ahí?»: ese punto
  if (/\bpor que (la red |la malla |tu red |mi red )?(quedo|esta|se armo|se construyo|se diseno|se hizo|la armaste|la hiciste|la disenaste) (asi|de esa (manera|forma)|de esta (manera|forma))\b/.test(t)) return { accion: enCurso ? "ir" : "empezar", parada: "cierre" };
  if (/\bpor que (pusiste|pusieron|ubicaste|ubicaron|elegiste|escogiste|esta|quedo|va|se puso|lo pusiste|la pusiste)\b.*\b(ahi|alli|alla|aqui|en ese (punto|sitio|lugar)|en esa (loma|ubicacion|parte))\b/.test(t) && /\b(gateway|pasarela|repetidor\w*|antena\w*|nodo)\b/.test(t))
    return { accion: enCurso ? "ir" : "empezar", parada: t };
  // «¿Qué refuerzos necesita la red?», «¿qué le falta para funcionar al 100 %?»: los refuerzos (sin confundirlo con
  // pedir un diseño, «ármame la red al 99,9 %»)
  if (
    /^(que|cuales|cuantos|cuantas|como)\b/.test(t) &&
    (/\b(refuerz\w*|reforzar\w*)\b/.test(t) || (/\b(falta\w*|necesit\w*|requier\w*)\b/.test(t) && /\b(100|cien|99)\b/.test(t))) &&
    !/\b(arma\w*|disen\w*|haz|hazme|crea\w*|pon|ponle|ponme)\b/.test(t)
  )
    return { accion: enCurso ? "ir" : "empezar", parada: "refuerzos" };
  // Con el recorrido abierto, «¿cómo lo calcula el simulador?» va a esa parada
  if (enCurso && /^(como|que)\b/.test(t) && /\b(calcula\w*|calculo)\b/.test(t)) return { accion: "ir", parada: "metodo" };
  // Las preguntas («¿qué es el recorrido?», «¿cómo funciona la red?») las contesta el cerebro
  if (/^(que|como|cual|cuales|para que|cuanto|cuando|donde)\b/.test(t)) return null;
  const explicar = /\b(explica\w*|describ\w*|detall\w*|cuentame|ensename|presentame)\b/.test(t) && RED.test(t) && !NO_RED.test(t);
  const recorrer = /\b(recorrido|recorre|recorrela|recorrer|recorramos|recorreme)\b/.test(t) && !/\b(guiado|guiados|tutorial|tours?)\b/.test(t);
  const puntoAPunto = /\b(punto por punto|antena por antena)\b/.test(t);
  // «Explícame el gateway», «cuéntame del repetidor dos»: el recorrido desde ese punto
  if (/\b(explica\w*|describ\w*|cuentame)\b/.test(t) && /\b(el gateway|la pasarela|repetidor (\d+|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez))\b/.test(t) && !NO_RED.test(t)) return { accion: enCurso ? "ir" : "empezar", parada: t };
  if ((explicar || recorrer || puntoAPunto) && !/\b(termina|cierra|sal|salir|acaba|finaliza|deten|para)\w*\b/.test(t)) return { accion: "empezar" };
  // En inglés (solo con palabras del inglés: lo dicho en español sigue igual)
  const ingles = recorridoEnIngles(t, enCurso);
  if (ingles !== undefined) return ingles;
  if (!enCurso) return null;
  if (/\b(termina|cierra|sal|salir|acaba|finaliza|deten)\w*\b.*\b(recorrido|paseo)\b|^(salir|termina|terminar|fin|cierra|acaba)$/.test(t)) return { accion: "terminar" };
  if (/^(siguiente|sigue adelante|adelante|continua|avanza|proximo|proxima)( punto| parada| antena| paso| parte)?$|\b(siguiente|proxim[oa]) (punto|parada|antena|paso|parte)\b/.test(t)) return { accion: "siguiente" };
  if (/^(anterior|atras|regresa|devuelvete)( punto| parada| antena)?$|\b(punto|parada|antena) anterior\b/.test(t)) return { accion: "anterior" };
  if (/^(pausa|pausala|espera|detente|alto)$|\bpausa\w*\b.*\brecorrido\b/.test(t)) return { accion: "pausar" };
  if (/^(sigue|seguir|reanuda|continua el recorrido|dale|play)$/.test(t)) return { accion: "seguir" };
  if (/^(repite|repitelo|otra vez|de nuevo)$|\brepite (el|ese|este|esta) (punto|parada|paso)\b/.test(t)) return { accion: "repetir" };
  if (/\b(ve|vamos|ir|pasa|salta|regresa|vuelve|llevame|muestrame|explicame|cuentame)\w*\b.*\b(a|al|a la|el|la|los|las)\b/.test(t)) return { accion: "ir", parada: t };
  return null;
}

/** La red, en inglés: «the network», «my mesh», «each antenna», «point by point». */
const RED_EN = /\b(the|my|this|your|our|whole|entire) (network|mesh)\b|\b(the|my|these|your|our|all the) (antennas|repeaters)\b|\b(each|every) (point|antenna|repeater|node|stop)\b|\b(point by point|antenna by antenna|stop by stop|node by node|repeater by repeater|one by one)\b/;
/** Lo que no es el recorrido: el pitch, cómo funciona una red mesh, los protocolos. */
const NO_RED_EN = /\b(business model|business plan|business|pitch|presentation|how (it|this|the network|the mesh|a mesh|mesh networks?|a network|lora|meshcore|meshtastic) works?|how does|what is|what are|the hops|hops work|the protocol|meshcore|meshtastic|lora|the colou?rs|the legend)\b/;
/** Terminar, en inglés (las palabras enteras: «cancela» o «parar» siguen siendo del español). */
const TERMINA_EN = /\b(stop|end|close|exit|quit|finish|leave|cancel)\b/;

/**
 * Los pedidos del recorrido en inglés. Devuelve `undefined` si no es inglés (siguen las reglas del español); `null`
 * si es una pregunta que contesta el cerebro. Solo mira palabras del inglés, así lo dicho en español no cambia.
 */
function recorridoEnIngles(texto: string, enCurso: boolean): PedidoRecorrido | null | undefined {
  const t = texto
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, " ")
    .replace(/^(hi |hello |ok |okay )melk[iy]\s*/, "")
    .replace(/^(please |can you |could you |would you |will you |i want you to |i'd like you to |i would like you to )+/, "")
    .replace(/ please$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return undefined;
  // «Why did you put Repeater 2 there?»: ese punto
  if (/\bwhy\b/.test(t) && /\b(there|here|that (spot|place|site|location|hill|point|position)|on that hill|at that (spot|place|point|location))\b/.test(t) && /\b(gateway|repeaters?|repetidor\w*|antennas?|nodes?|support \d+|apoyo \d+)\b/.test(t))
    return { accion: enCurso ? "ir" : "empezar", parada: t };
  // «Why did the network turn out like this?», «why does the mesh look like this?»: la conclusión
  if (
    /\bwhy (did|does|do|is|was|has|have) (the |my |this |your |our )?(network|mesh|it|design|layout)\b|\bwhy did you (design|build|make|lay out|set up|plan|arrange)\b/.test(t) &&
    /\b(like (this|that)|this way|that way|the way it (is|does|did)|turn(ed|s)? out|end(ed|s)? up|come out|came out|look(s)? (like )?(this|that)( way)?)\b/.test(t)
  )
    return { accion: enCurso ? "ir" : "empezar", parada: "cierre" };
  // «What reinforcements does the network need?», «what does it need to work at 100%?» (no «design it at 99.9%»)
  if (
    /^(what|whats|what's|which|how many|how much|how)\b/.test(t) &&
    (/\b(reinforc\w*|strengthen\w*|redundan\w*|backups?)\b/.test(t) || (/\b(missing|lack\w*|need\w*|requir\w*|take|takes|left)\b/.test(t) && /\b(100|hundred|99)\b/.test(t))) &&
    !/\b(build|design|make|create|set up|put|lay out|plan|draw)\b/.test(t)
  )
    return { accion: enCurso ? "ir" : "empezar", parada: "refuerzos" };
  // Con el recorrido abierto, «how does the simulator calculate it?» va a esa parada
  if (enCurso && /^(how|what|whats|what's)\b/.test(t) && /\b(calculat\w*|comput\w*)\b/.test(t)) return { accion: "ir", parada: "metodo" };
  // Las preguntas («what is the walkthrough?», «how does the network work?») las contesta el cerebro
  if (/^(what|whats|what's|how|which|when|where|who|whose|why)\b/.test(t)) return null;
  // «Explain the gateway», «tell me about repeater two»: el recorrido desde ese punto
  if (/\b(explain|describe|tell me about)\b/.test(t) && /\b(the gateway|(repeater|repetidor) (\d+|one|two|three|four|five|six|seven|eight|nine|ten|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez))\b/.test(t) && !NO_RED_EN.test(t))
    return { accion: enCurso ? "ir" : "empezar", parada: t };
  const explicar =
    /\b(explain|describe|detail|tell me about|walk me through|walk us through|take me through|take us through|talk me through|run me through|guide me through|go through|show me around|break down|present)\b/.test(t) &&
    RED_EN.test(t) &&
    !NO_RED_EN.test(t);
  const recorrer = (/\b(walkthrough|walk-through|walk through)\b/.test(t) || (/\btour\b/.test(t) && /\b(network|antennas|repeaters)\b/.test(t))) && !/\b(guided|tutorials?)\b/.test(t);
  const puntoAPunto = /\b(point by point|antenna by antenna|stop by stop|node by node|repeater by repeater)\b/.test(t);
  if ((explicar || recorrer || puntoAPunto) && !TERMINA_EN.test(t)) return { accion: "empezar" };
  if (!enCurso) return undefined;
  if (/\b(stop|end|close|exit|quit|finish|leave|cancel|get out of)\b.*\b(walkthrough|walk-through|walk through|tour|recorrido)\b|^(stop|exit|quit|end|finish|close|done|enough|that's enough|that's all|we're done|i'm done|end it|stop it|close it|finish it)$/.test(t))
    return { accion: "terminar" };
  if (/^(next|next one|forward|go forward|move on|skip|skip it|skip this one|onward|onwards)( (point|stop|antenna|step|part|one))?$|\bnext (point|stop|antenna|step|part|one|repeater)\b|^(go|move|skip) (on )?to the next\b/.test(t)) return { accion: "siguiente" };
  if (/^(previous|back|go back|back up|previous one|the previous one)( (point|stop|antenna|step|part))?$|\bprevious (point|stop|antenna|step|part|one|repeater)\b/.test(t)) return { accion: "anterior" };
  if (/^(pause|pause it|pause that|hold on|hold it|wait|wait a (moment|second|minute|sec)|hang on|one moment|one second|just a (moment|second|minute))$|\bpause (the )?(walkthrough|walk-through|tour)\b/.test(t)) return { accion: "pausar" };
  if (/^(continue|resume|go on|go ahead|keep going|carry on|unpause|play|keep playing|proceed)$|\b(resume|continue) (the )?(walkthrough|walk-through|tour)\b/.test(t)) return { accion: "seguir" };
  if (/^(repeat|repeat that|repeat it|repeat this|again|once more|one more time|say that again|say it again|do it again|from the top)$|\brepeat (the|this|that) (point|stop|step|part)\b/.test(t)) return { accion: "repetir" };
  if (/\b(go|jump|skip|move|head|switch|return|back to|take me|bring me|show me|let's see|lets see|let me see|let's go|lets go|explain|tell me about)\b \S/.test(t)) return { accion: "ir", parada: t };
  return undefined;
}

const ORDINALES: Record<string, number> = {
  primer: 1,
  primero: 1,
  segundo: 2,
  tercer: 3,
  tercero: 3,
  cuarto: 4,
  quinto: 5,
  sexto: 6,
  septimo: 7,
  octavo: 8,
  noveno: 9,
  decimo: 10,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

/**
 * La parada que se pide («el Repetidor 2», «el gateway», «las personas», «lo que falta», «por qué quedó así»), o −1.
 * También en inglés («Repeater 2», «the second repeater», «the people», «what's missing», «the reinforcements»).
 */
export function buscarParada(paradas: ParadaRecorrido[], texto: string): number {
  const t = ` ${canonico(texto)} `;
  if (
    /\b(cierre|conclusion|final|por que (la red )?(quedo|esta|se armo|se construyo|se diseno|se hizo) (asi|de esa|de esta))\b/.test(t) ||
    /\b(closing|wrap up|why (did|does|is|was) (the )?(network|mesh|it)\b.*\b(like (this|that)|this way|that way|turn(ed)? out|end(ed)? up|look)|turned out (like (this|that)|this way|that way))\b/.test(t)
  )
    return paradas.findIndex((p) => p.id === "cierre");
  // Por el nombre de la antena (el más largo primero: «Repetidor 12» antes que «Repetidor 1»)
  const nombres = paradas
    .map((p, i) => ({ i, n: canonico(p.titulo), antena: !!p.antena }))
    .filter((x) => x.antena && x.n.length >= 3)
    .sort((a, b) => b.n.length - a.n.length);
  for (const x of nombres) if (t.includes(` ${x.n} `)) return x.i;
  const ord = t.match(/\b(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) repetidor\b/);
  if (ord) {
    const reps = paradas.map((p, i) => ({ p, i })).filter((x) => x.p.id === "repetidor");
    return reps[ORDINALES[ord[1]] - 1]?.i ?? -1;
  }
  if (/\b(refuerz\w*|reforzar\w*|100|cien por ciento|99|respaldos?|redundan\w*|reinforc\w*|strengthen\w*|backups?|hundred percent)\b/.test(t)) return paradas.findIndex((p) => p.id === "refuerzos");
  if (/\b(calcula\w*|calculo|metodo|propagacion|por dentro|calculat\w*|method|propagation|under the hood)\b|\bmodelo\b(?! de negocio)|(?<!business )\bmodel\b/.test(t)) return paradas.findIndex((p) => p.id === "metodo");
  if (/\b(gateway|pasarela|puerta|internet|starlink)\b/.test(t)) return paradas.findIndex((p) => p.id === "gateway");
  if (/\b(personas|gente|usuarios|billeteras|people|users|wallets)\b/.test(t)) return paradas.findIndex((p) => p.id === "personas");
  if (/\b(falta|faltan|pendiente\w*|mejorar|debil\w*|problema\w*|arreglar|missing|pending|left to do|improve\w*|weak\w*|problems?|issues?|fix)\b/.test(t)) return paradas.findIndex((p) => p.id === "pendiente");
  if (/\b(inicio|principio|panorama|comienzo|vistazo|empezar|start|beginning|overview|at a glance)\b/.test(t)) return 0;
  return -1;
}
