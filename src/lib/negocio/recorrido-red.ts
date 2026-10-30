// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El recorrido de la red: el robot de Melki cuenta primero cómo calcula el simulador y luego va punto por punto
// siguiendo el camino de la señal (el gateway y cada repetidor, rama por rama), las personas y lo que falta, y en cada
// parada escribe en una nube qué se instaló, por qué ahí y qué papel cumple; al final, qué refuerzos necesita para
// funcionar al 100 % y al 99,9 %, y por qué la red quedó así. Solo usa lo que da el simulador (la red del mapa, la
// simulación al día, la prueba de estrés si la hay y el modelo de costos de Trama): lo que estima lo dice como estimado.
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

const ent = (x: number) => Math.round(x).toLocaleString("es-CO");
const f1 = (x: number, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("es-CO", { maximumFractionDigits: d });
const km = (m: number) => `${f1(m / 1000, m < 10000 ? 1 : 0)} km`;
const pct = (x: number) => `${f1(x, x >= 10 ? 0 : 1)} %`;
const cuenta = (n: number, uno: string, varios: string) => `${ent(n)} ${n === 1 ? uno : varios}`;
/** «a», «a y b», «a, b y c». */
const lista = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const DIRECCIONES = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];
/** El punto cardinal en palabras («noreste»). */
const hacia = (grados: number) => DIRECCIONES[Math.round((((grados % 360) + 360) % 360) / 45) % 8];
const mayuscula = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** La primera frase de un consejo, en minúscula inicial y sin el punto final. */
function primeraFrase(t: string | undefined): string {
  if (!t) return "";
  const f = t.split(/(?<=[.;])\s+/)[0].replace(/[.;]$/, "").trim();
  return f ? f[0].toLowerCase() + f.slice(1) : "";
}

const EQUIPO_TXT: Record<string, string> = {
  "p1-8dbi": "un repetidor solar SenseCAP P1",
  "t114-8dbi": "una radio Heltec T114",
  xiao: "una billetera XIAO ESP32S3 con Wio-SX1262",
  t1000: "una tarjeta SenseCAP T1000-E",
};

/** «antena omnidireccional de 8 dBi», «antena Yagi de 11 dBi apuntando al noreste». */
function antenaTxt(a: Antena): string {
  const g = `${f1(a.gananciaDbi, 1)} dBi`;
  if (!a.patron || a.patron === "omni") return `antena omnidireccional de ${g}`;
  const p = PATRONES.find((x) => x.id === a.patron);
  return `antena ${p ? p.nombre.toLowerCase().replace(/ \(.*\)$/, "") : "direccional"} de ${g} apuntando al ${hacia(a.azimutDeg ?? 0)}`;
}

/** Qué equipo es, con su antena: «un repetidor solar SenseCAP P1 con antena omnidireccional de 8 dBi». */
function equipoTxt(a: Antena): string {
  const base = EQUIPO_TXT[a.equipo] ?? `un equipo de ${f1(a.potenciaDbm, 0)} dBm`;
  return `${base} con ${antenaTxt(a)}`;
}

/** Cómo es un enlace según su margen (los mismos cortes del pitch). */
function calidad(m: number): { texto: string; tono: CifraPitch["tono"] } {
  if (m >= 37) return { texto: "un enlace sólido, que aguanta lluvia y follaje", tono: "bien" };
  if (m >= 30) return { texto: "un enlace bueno", tono: "bien" };
  if (m >= 20) return { texto: "un enlace que funciona, pero es inestable", tono: "alerta" };
  return { texto: "un enlace que no alcanza", tono: "mal" };
}

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

/** Arma las paradas del recorrido con la red del mapa. */
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
      `Esta red lleva pagos, mensajes de WhatsApp por texto y consultas a la inteligencia artificial a donde no llega la señal del celular. ${
        red.gateways.length || red.repetidores.length
          ? `Tiene ${cuenta(red.gateways.length, "gateway", "gateways")} y ${cuenta(red.repetidores.length, "repetidor", "repetidores")}${P ? ` para ${cuenta(P, "persona", "personas")} con billetera de radio` : ""}${lugarRed ? `, en ${lugarRed}` : ""}, sobre ${protocolo.nombre} (LoRa ${f1(d.parametros.frecuenciaMhz, 1)} MHz).`
          : "Todavía no tiene gateway ni repetidores."
      }`,
      `El recorrido sigue el camino de la señal: primero le cuento cómo calcula el simulador; luego empiezo en el gateway, por donde entra internet, y voy repetidor por repetidor, rama por rama, hasta las personas. En cada punto le escribo qué se instaló, por qué quedó ahí y qué papel cumple; al final, ${r ? "qué refuerzos necesita para funcionar al 100 % y al 99,9 %, y " : ""}por qué la red quedó así.`,
    ];
    if (sinSimular) parrafos.push("Aún no hay una simulación al día: mientras termina, le explico lo que se ve en el mapa; los enlaces, la cobertura y los saltos aparecen al simular.");
    else if (r) parrafos.push(`Con el relieve real, la red da servicio en el ${pct(r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio)} ${r.areaObjetivo ? "del área objetivo" : "del área de estudio"}${P ? ` y llegan al gateway ${C} de ${P} personas` : ""}.`);
    paradas.push({
      id: "panorama",
      clave: "panorama",
      titulo: "La red de un vistazo",
      voz: `Le muestro la red punto por punto: ${cuenta(red.gateways.length, "gateway", "gateways")}, ${cuenta(red.repetidores.length, "repetidor", "repetidores")}${P ? ` y ${cuenta(P, "persona", "personas")}` : ""}. Primero le cuento cómo calcula el simulador y luego voy al gateway, por donde entra internet.`,
      resumen: `${cuenta(red.gateways.length, "gateway", "gateways")}, ${cuenta(red.repetidores.length, "repetidor", "repetidores")}${P ? ` y ${cuenta(P, "persona", "personas")}` : ""}${lugarRed ? ` en ${lugarRed}` : ""}.`,
      nube: {
        etiqueta: "Recorrido de la red",
        titulo: d.nombre?.trim() || "La red de un vistazo",
        subtitulo: [lugarRed, `${protocolo.nombre} · LoRa ${f1(d.parametros.frecuenciaMhz, 1)} MHz`].filter(Boolean).join(" · "),
        parrafos,
        datos: [
          { etiqueta: "Gateways", valor: ent(red.gateways.length) },
          { etiqueta: "Repetidores", valor: ent(red.repetidores.length) },
          { etiqueta: "Personas", valor: ent(P), detalle: r && P ? `${ent(C)} conectadas` : undefined },
          ...(r ? [{ etiqueta: "Saltos máximos", valor: ent(red.saltosMax), detalle: `límite ${ent(limite)}` }] : []),
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
        ? "sobre un terreno plano (sin relieve: así se ve lo que alcanzan los equipos solos)"
        : fuente === "hgt"
          ? `con el relieve real de los archivos de elevación cargados${resol ? ` (un dato de altura cada ${ent(resol)} m)` : ""}`
          : `con el relieve real del terreno${resol ? `, descargado en teselas de elevación (un dato de altura cada ${ent(resol)} m)` : ""}`;
    const sens = r?.sensibilidadDbm ?? preset.sensibilidadDbm;
    const entorno = entornoPorId(p.entorno);
    const parrafos = [
      `Para cada antena, el simulador traza el perfil del terreno hacia cada punto de una malla de ${r ? `celdas de unos ${ent(r.malla.celdaM)} m` : "celdas"}, en ${f1(p.radioKm, 1)} km a la redonda, ${relieveTxt}. A la gente la calcula con la billetera a ${f1(p.alturaRxM, 1)} m del suelo.`,
      `${
        p.modelo === "itm"
          ? "En cada perfil calcula la pérdida de la señal con Longley-Rice (el modelo ITM de la NTIA, el mismo que usa Radio Mobile)"
          : "En cada perfil calcula la pérdida de la señal: la del espacio libre más la difracción sobre las lomas que tapan el camino (filo de cuchillo, método de Deygout, con la curvatura de la Tierra), calibrada contra simulaciones de Radio Mobile, con unos 3 dB de diferencia típica en los enlaces"
      }${entorno.metodo === "ninguno" ? "" : `, y le suma la pérdida del entorno elegido, «${entorno.nombre.toLowerCase()}» (${entorno.metodo === "follaje" ? "follaje según UIT-R P.833" : "árboles o construcciones según UIT-R P.2108"})`}.`,
      `Con esa pérdida saca el margen: cuánto le sobra a la señal sobre la sensibilidad del radio (${f1(sens, 1)} dBm con ${preset.nombre.replace(/ \(.*\)$/, "")}, a ${f1(p.frecuenciaMhz, 1)} MHz). Con 20 dB ya hay servicio; con 30 dB, señal media (la cobertura útil), y con 37 dB, confiable aun con lluvia y follaje. Entre dos antenas, un enlace es sólido desde 30 dB.`,
      `Después arma la malla: para cada nodo busca el camino más robusto hasta el gateway (el que tiene su enlace más débil más fuerte), sin pasar de ${cuenta(limite, "salto", "saltos")}, y marca como punto crítico al repetidor que, si se apaga, deja a otros sin camino.`,
      d.estres
        ? `La prueba de la hora pico simula los mensajes de cada persona con el tiempo real que ocupa cada paquete en el aire (LoRa), las esperas y reintentos de ${protocolo.nombre} y los choques entre mensajes, y cuenta cuántos vuelven con su respuesta.`
        : `Y con la prueba de la hora pico («prueba la hora pico») simula los mensajes de cada persona con el tiempo real de cada paquete en el aire y los choques entre mensajes, para saber si el canal aguanta.`,
    ];
    paradas.push({
      id: "metodo",
      clave: "metodo",
      titulo: "Cómo lo calcula el simulador",
      voz: "Así calcula el simulador: traza el perfil del terreno de cada antena a cada punto, le resta lo que tapan las lomas y mira cuánto le sobra a la señal. Con 20 dB ya hay servicio y con 37 es confiable.",
      resumen: `${fuente === "plano" ? "terreno plano" : "relieve real"}${r ? `, celdas de ${ent(r.malla.celdaM)} m` : ""}, ${p.modelo === "itm" ? "Longley-Rice" : "modelo calibrado con Radio Mobile"}; servicio desde 20 dB, cobertura útil desde 30 y confiable desde 37; caminos más robustos al gateway en máximo ${cuenta(limite, "salto", "saltos")}.`,
      nube: {
        etiqueta: "El simulador por dentro",
        titulo: "Cómo lo calcula el simulador",
        subtitulo: `${preset.nombre} · ${f1(p.frecuenciaMhz, 1)} MHz`,
        parrafos,
        datos: [
          { etiqueta: "Relieve", valor: fuente === "plano" ? "Plano" : fuente === "hgt" ? "Archivos HGT" : "Real", detalle: resol ? `un dato cada ${ent(resol)} m` : undefined },
          ...(r ? [{ etiqueta: "Celda de cálculo", valor: `${ent(r.malla.celdaM)} m`, detalle: `${f1(p.radioKm, 1)} km por antena` }] : []),
          { etiqueta: "Sensibilidad", valor: `${f1(sens, 1)} dBm`, detalle: `SF${preset.sf} · ${f1(preset.anchoBandaKhz, 1)} kHz` },
          { etiqueta: "Modelo", valor: p.modelo === "itm" ? "Longley-Rice" : "Calibrado", detalle: p.modelo === "itm" ? "ITM de la NTIA" : "con Radio Mobile" },
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
    const datos: CifraPitch[] = [{ etiqueta: "Altura de la antena", valor: `${f1(a.alturaM, 1)} m`, detalle: suelo !== null ? `suelo a ${ent(suelo)} m s. n. m.` : undefined }];
    const parrafos: string[] = [];

    // El suelo: en lo alto, en lo bajo o en el promedio
    const sueloTxt =
      suelo === null
        ? ""
        : masAlto
          ? `El suelo está a ${ent(suelo)} m sobre el nivel del mar: es el punto más alto de la red, ${ent(dif ?? 0)} m por encima del promedio de las antenas, y desde ahí la señal sale despejada sobre el terreno.`
          : dif !== null && dif >= 15
            ? `El suelo está a ${ent(suelo)} m sobre el nivel del mar, ${ent(dif)} m por encima del promedio de las antenas: desde lo alto la señal pasa sobre lomas y árboles.`
            : dif !== null && dif <= -15
              ? `El suelo está a ${ent(suelo)} m sobre el nivel del mar, ${ent(-dif)} m por debajo del promedio de las antenas: por eso la altura del mástil es la que le abre camino a la señal.`
              : `El suelo está a ${ent(suelo)} m sobre el nivel del mar, a la altura del resto de la red.`;

    if (gw) {
      /* El gateway */
      const dCentro = centroRed ? dist(centroRed, a) : 0;
      const central = dCentro <= radioRed * 0.35;
      parrafos.push(
        `Se instaló el sitio gateway: ${equipoTxt(a)} a ${f1(a.alturaM, 1)} m de altura, un mini PC con UPS y Starlink, todo con energía solar. Es la puerta de la red a internet: aquí llegan los pagos, los WhatsApp y las consultas a la IA, salen por Starlink y vuelven con la respuesta.`,
      );
      const porque: string[] = [];
      if (centroRed && activas.length > 1)
        porque.push(
          central
            ? `${dCentro < 150 ? "Está en el centro de la red" : `Está cerca del centro de la red (a ${km(dCentro)} de él)`}: así los repetidores se reparten a su alrededor y el camino más largo queda corto${r ? `, de ${cuenta(red.saltosMax, "salto", "saltos")}` : ""}.`
            : `Está hacia el ${hacia(rumbo(centroRed.lat, centroRed.lon, a.lat, a.lon))} de la red, a ${km(dCentro)} de su centro: desde aquí la malla se extiende hacia el ${hacia(rumbo(a.lat, a.lon, centroRed.lat, centroRed.lon))}.`,
        );
      if (sueloTxt) porque.push(sueloTxt);
      const conEnlace = susHijos.map((h) => ({ h, e: enlace(a.id, h.id) })).filter((x) => x.e);
      if (conEnlace.length)
        porque.push(
          `Desde aquí enlaza directo con ${lista(conEnlace.slice(0, 4).map(({ h, e: x }) => `${h.nombre} (${km(x!.distanciaKm * 1000)}, ${f1(x!.margen, 0)} dB${x!.lineaVista ? ", con línea de vista" : ""})`))}${conEnlace.length > 4 ? ` y ${cuenta(conEnlace.length - 4, "repetidor más", "repetidores más")}` : ""}.`,
        );
      if (porque.length) parrafos.push(porque.join(" "));
      const papel: string[] = [];
      if (r) {
        papel.push(
          p.personas
            ? `Por este gateway salen a internet las ${cuenta(p.personas, "persona conectada", "personas conectadas")}${p.repetidores.length ? `, a través de ${cuenta(p.repetidores.length, "repetidor", "repetidores")}` : ""}${suyas.length ? `; ${cuenta(suyas.length, "se conecta", "se conectan")} directo, sin repetidor` : ""}.`
            : "Todavía no le llega ninguna persona: hace falta acercar la red a la gente o poner repetidores.",
        );
      }
      papel.push(
        red.gateways.length === 1
          ? "Es el único gateway: conviene cuidarlo con su UPS y mantenimiento preventivo, porque si se apaga la malla sigue en pie pero sin salida a internet."
          : `Es uno de los ${ent(red.gateways.length)} gateways: si uno falla, la gente cercana al otro sigue con internet.`,
      );
      parrafos.push(papel.join(" "));
      parrafos.push(a.alturaM < 10 ? `Conviene subir la antena a 12 m, la torre estándar del sitio gateway: gana alcance y despeja techos y árboles.` : `A ${f1(a.alturaM, 0)} m la antena domina su zona: es la altura que da el alcance que se ve en el mapa.`);
      datos.push({ etiqueta: "Enlaces directos", valor: ent(susHijos.length), detalle: susHijos.length === 1 ? "repetidor" : "repetidores" });
      if (r) datos.push({ etiqueta: "Salen por aquí", valor: ent(p.personas), detalle: "personas a internet" });
      if (res && res.areaServicioKm2 > 0) datos.push({ etiqueta: "Área con servicio", valor: `${ent(res.areaServicioKm2)} km²`, detalle: `alcance ${f1(res.alcanceKm, 1)} km` });
      paradas.push({
        id: "gateway",
        clave: `gateway-${a.id}`,
        titulo: a.nombre,
        voz: `${a.nombre}${sitio ? `, en ${sitio}` : ""}: el gateway, la puerta de la red a internet.${susHijos.length ? ` Enlaza directo con ${cuenta(susHijos.length, "repetidor", "repetidores")}` : ""}${r && p.personas ? `${susHijos.length ? " y por" : " Por"} aquí salen las ${cuenta(p.personas, "persona conectada", "personas conectadas")}` : ""}${susHijos.length || (r && p.personas) ? "." : ""}`,
        resumen: `gateway${sitio ? ` en ${sitio}` : ""}, la entrada a internet por Starlink; antena a ${f1(a.alturaM, 1)} m${susHijos.length ? `, enlaza directo con ${cuenta(susHijos.length, "repetidor", "repetidores")}` : ""}${r ? ` y por él salen ${cuenta(p.personas, "persona", "personas")}` : ""}.`,
        nube: { etiqueta: "Gateway · entrada a internet", titulo: a.nombre, subtitulo: [sitio, `${a.lat.toFixed(5)}, ${a.lon.toFixed(5)}`].filter(Boolean).join(" · "), parrafos, datos: datos.slice(0, 5) },
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
    parrafos.push(`Se instaló ${equipoTxt(a)} en un mástil de ${f1(a.alturaM, 1)} m, con panel solar y baterías: funciona sin red eléctrica ni internet y retransmite los mensajes de la malla.`);
    const porque: string[] = [];
    if (sueloTxt) porque.push(sueloTxt);
    if (padre && e) {
      const q = calidad(e.margen);
      porque.push(`Desde aquí alcanza a ${padre.nombre} a ${km(e.distanciaKm * 1000)}, ${e.lineaVista ? "con línea de vista despejada" : "sin línea de vista, por difracción sobre el terreno"}, con ${f1(e.margen, 0)} dB de margen: ${q.texto}.`);
      datos.push({ etiqueta: `Enlace con ${padre.nombre}`, valor: `${f1(e.margen, 0)} dB`, detalle: `${km(e.distanciaKm * 1000)} · ${e.lineaVista ? "línea de vista" : "difracción"}`, tono: q.tono });
    }
    if (suyas.length) {
      const c = centroDe(suyas)!;
      const lejana = Math.max(...suyas.map((x) => dist(a, x)));
      const prom = suyas.reduce((t, x) => t + dist(a, x), 0) / suyas.length;
      porque.push(
        suyas.length === 1
          ? `Atiende a 1 persona, a ${km(lejana)} hacia el ${hacia(rumbo(a.lat, a.lon, c.lat, c.lon))}.`
          : dist(a, c) <= prom * 0.45
            ? `Queda en medio de las ${cuenta(suyas.length, "persona", "personas")} que atiende: la más lejana está a ${km(lejana)}.`
            : `Atiende a ${cuenta(suyas.length, "persona", "personas")}, la mayoría hacia el ${hacia(rumbo(a.lat, a.lon, c.lat, c.lon))}, a ${km(prom)} en promedio.`,
      );
    } else if (susHijos.length) porque.push(`Su trabajo es de enlace: une a ${lista(susHijos.map((h) => h.nombre))} con el resto de la red.`);
    if (porque.length) parrafos.push(porque.join(" "));

    const papel: string[] = [];
    if (aislado) papel.push("Hoy no tiene camino al gateway: ningún enlace le alcanza. Hay que acercarlo, subir su antena o poner un repetidor entre él y la red.");
    else if (lejos) papel.push(`Llega al gateway en ${cuenta(s!, "salto", "saltos")}, más que el límite de diseño de ${ent(limite)}: un repetidor intermedio o antenas más altas acortan el camino.`);
    if (!aislado && susHijos.length) papel.push(`Es un repetidor troncal: por él pasa el tráfico de ${lista(susHijos.map((h) => h.nombre))}${p.personas ? ` y, en total, el de ${cuenta(p.personas, "persona", "personas")}` : ""}.`);
    else if (!aislado && suyas.length) papel.push(`Es un repetidor de acceso: atiende directamente a ${cuenta(suyas.length, "persona", "personas")} de su zona.`);
    else if (!aislado && r) papel.push("Por ahora no atiende a nadie directamente: sirve de cobertura para la gente que llegue a su zona.");
    if (res && res.porcentajeMejorServidor >= 1) papel.push(`Es la mejor señal en el ${pct(res.porcentajeMejorServidor)} del área de estudio.`);
    if (n?.critico) {
      const dependen = p.repetidores.map(nombre);
      const quienes = [...dependen.slice(0, 3), ...(p.personas ? [cuenta(p.personas, "persona", "personas")] : [])];
      const uno = quienes.length === 1 && (dependen.length === 1 || p.personas === 1);
      papel.push(`Es un punto crítico: si se apaga, ${quienes.length ? lista(quienes) : "otros nodos"} ${uno ? "pierde" : "pierden"} el camino al gateway; un repetidor de respaldo cerca lo resuelve.`);
    } else if (r && !aislado) {
      const respaldos = (r.enlaces ?? []).filter((x) => (x.a === a.id || x.b === a.id) && esInfra.has(x.a === a.id ? x.b : x.a) && x.margen >= 20).length;
      if (respaldos >= 2) papel.push("Tiene respaldo: si uno de sus vecinos falla, sigue llegando al gateway por otro camino.");
    }
    if (papel.length) parrafos.push(papel.join(" "));
    parrafos.push(
      a.alturaM < 6
        ? "Conviene subirlo al menos a 6 m, el tubo estándar de Trama, para despejar techos y árboles."
        : e && e.margen < 30
          ? "Para dejarlo firme conviene subirlo a 9 o 12 m o moverlo a la loma más alta cercana; si me pide «ajústamelo», pruebo alturas y lomas hasta dejarlo firme."
          : e
            ? `A ${f1(a.alturaM, 0)} m alcanza con holgura: no hace falta una torre más alta, y eso abarata la instalación.`
            : `Está a ${f1(a.alturaM, 0)} m de altura.`,
    );
    if (s !== null || aislado) datos.push({ etiqueta: "Saltos al gateway", valor: s === null ? "sin ruta" : ent(s), tono: s === null || lejos ? "mal" : undefined });
    if (suyas.length) datos.push({ etiqueta: "Personas que atiende", valor: ent(suyas.length) });
    if (p.personas > suyas.length) datos.push({ etiqueta: "Pasan por aquí", valor: ent(p.personas), detalle: "personas en total" });
    const corto = dif !== null && dif >= 15 ? `Está en terreno alto, ${ent(dif)} metros sobre el promedio de la red.` : padre && e ? `Enlaza con ${padre.nombre} con ${f1(e.margen, 0)} dB de margen.` : "";
    const papelCorto = aislado
      ? "Hoy no tiene camino al gateway."
      : susHijos.length && p.personas
        ? `Por aquí pasa el tráfico de ${cuenta(p.personas, "persona", "personas")}${n?.critico ? ", y es un punto crítico" : ""}.`
        : suyas.length
          ? `Atiende a ${cuenta(suyas.length, "persona", "personas")}${n?.critico ? " y es un punto crítico" : ""}.`
          : "";
    paradas.push({
      id: "repetidor",
      clave: `repetidor-${a.id}`,
      titulo: a.nombre,
      voz: [`${a.nombre}${dGw !== null ? `, a ${km(dGw)} al ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} del gateway` : ""}${s !== null ? `, en ${cuenta(s, "salto", "saltos")}` : ""}.`, corto, papelCorto].filter(Boolean).join(" "),
      resumen: [
        `repetidor solar a ${f1(a.alturaM, 1)} m`,
        dGw !== null ? `a ${km(dGw)} al ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} del gateway${s !== null ? ` (${cuenta(s, "salto", "saltos")})` : ""}` : null,
        padre && e ? `enlace de ${f1(e.margen, 0)} dB con ${padre.nombre}` : null,
        aislado ? "sin camino al gateway" : susHijos.length ? `troncal de ${lista(susHijos.map((h) => h.nombre))}` : suyas.length ? `atiende a ${cuenta(suyas.length, "persona", "personas")}` : null,
        n?.critico ? "punto crítico" : null,
      ]
        .filter(Boolean)
        .join("; ")
        .concat("."),
      nube: {
        etiqueta: `Repetidor solar · ${aislado ? "sin camino al gateway" : s !== null ? `salto ${ent(s)}` : "por simular"}`,
        titulo: a.nombre,
        subtitulo: [sitio, dGw !== null ? `a ${km(dGw)} al ${hacia(rumbo(g!.lat, g!.lon, a.lat, a.lon))} del gateway` : null].filter(Boolean).join(" · "),
        parrafos,
        datos: datos.slice(0, 5),
        sugerencia: aislado || lejos || (e && e.margen < 30) ? { texto: "Ajústamelo", pedido: "ajústamelo" } : undefined,
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
      return EQUIPO_TXT[id] ?? "una billetera de radio";
    })();
    const parrafos = [
      `Cada persona lleva ${equipoPersonas}, emparejada con su celular por Bluetooth: con ella paga, manda WhatsApp por texto y consulta a la IA sin señal de celular. ${preset.protocolo === "meshcore" ? "En MeshCore las billeteras no retransmiten: la malla la sostienen los repetidores, y así el canal se cuida." : "En Meshtastic las billeteras también pueden retransmitir; en redes grandes conviene dejarlas mudas (CLIENT_MUTE) para cuidar el canal."}`,
    ];
    const datos: CifraPitch[] = [];
    const llegan = C === P ? `${P === 1 ? "La persona del mapa llega" : `Las ${ent(P)} personas del mapa llegan`} al gateway` : `${mayuscula(cuenta(C, "persona", "personas"))} de las ${ent(P)} del mapa ${C === 1 ? "llega" : "llegan"} al gateway (${pct((100 * C) / P)})`;
    if (r) {
      const saltos = conectadas.map((x) => nodos.get(x.id)?.saltos).filter((x): x is number => typeof x === "number");
      const prom = saltos.length ? saltos.reduce((s, x) => s + x, 0) / saltos.length : 0;
      const reparto = infra
        .map((a) => ({ a, n: (directas.get(a.id) ?? []).length }))
        .filter((x) => x.n > 0)
        .sort((x, y) => y.n - x.n);
      const promTxt = `${f1(prom, 1)} ${f1(prom, 1) === "1" ? "salto" : "saltos"}`;
      parrafos.push(
        `${llegan}${saltos.length ? `, en ${promTxt} en promedio; la más lejana, en ${cuenta(Math.max(...saltos), "salto", "saltos")}` : ""}.${
          reparto.length > 1 ? ` Entran a la red por ${lista(reparto.slice(0, 4).map((x) => `${x.a.nombre} (${ent(x.n)})`))}${reparto.length > 4 ? " y otros repetidores" : ""}.` : ""
        }`,
      );
      if (faltan.length) {
        const c = centroDe(faltan)!;
        const ref = centroRed ?? c;
        parrafos.push(`${mayuscula(cuenta(faltan.length, "persona todavía no llega", "personas todavía no llegan"))}${dist(ref, c) > 200 ? `: están hacia el ${hacia(rumbo(ref.lat, ref.lon, c.lat, c.lon))} de la red` : ""}. En la siguiente parada le cuento cómo conectarlas.`);
      }
      const e = d.estres;
      if (e) parrafos.push(`En la hora pico simulada, al ${pct(e.resumenUsuarios.funcionanPct)} de las personas les funciona la red y el ${pct(e.completosPct)} de los mensajes vuelve con respuesta.`);
      datos.push({ etiqueta: "Conectadas", valor: `${ent(C)} de ${ent(P)}`, tono: C === P ? "bien" : C >= P * 0.8 ? "alerta" : "mal" });
      if (saltos.length) datos.push({ etiqueta: "Saltos en promedio", valor: f1(prom, 1) });
      datos.push({ etiqueta: "Sin cobertura", valor: ent(faltan.length), tono: faltan.length ? "mal" : "bien" });
      if (e) datos.push({ etiqueta: "Les funciona", valor: pct(e.resumenUsuarios.funcionanPct), detalle: "en la hora pico" });
    } else parrafos.push("Falta simular para saber cuántas llegan al gateway y por dónde.");
    const anclaP = centroDe(conectadas.length ? conectadas : personas)!;
    paradas.push({
      id: "personas",
      clave: "personas",
      titulo: "Las personas",
      voz: r ? `${llegan}${faltan.length ? `; faltan ${ent(faltan.length)}` : ""}.` : `En el mapa hay ${cuenta(P, "persona", "personas")} con billetera de radio.`,
      resumen: r ? `${C === P ? `${P === 1 ? "la única persona llega" : `las ${ent(P)} llegan`} al gateway` : `${ent(C)} de ${ent(P)} llegan al gateway; faltan ${ent(P - C)}`}.` : `${cuenta(P, "persona", "personas")} con billetera de radio.`,
      nube: { etiqueta: "Las personas · billeteras de radio", titulo: "Quiénes usan la red", subtitulo: `${cuenta(P, "persona", "personas")} en el mapa`, parrafos, datos },
      foco: { tipo: "red", caja: cajaDe(personas) ?? cajaRed },
      ancla: anclaP,
    });
  }

  /* 5 · Lo que falta */
  if (r) {
    const pendientes: { texto: string; ancla: Punto; foco: FocoPitch; sugerencia?: { texto: string; pedido: string } }[] = [];
    if (!red.gateways.length && infra.length)
      pendientes.push({
        texto: "Falta el gateway: sin él la red no tiene salida a internet. Pídame «pon el gateway en…» con el sitio donde habrá Starlink, o «convierte el Repetidor 1 en gateway».",
        ancla: infra[0],
        foco: { tipo: "punto", lat: infra[0].lat, lon: infra[0].lon, zoom: 12.5 },
      });
    if (faltan.length) {
      const c = centroDe(faltan)!;
      const cerca = infra.length ? Math.min(...infra.map((a) => dist(a, c))) : null;
      pendientes.push({
        texto: `${mayuscula(cuenta(faltan.length, "persona no llega", "personas no llegan"))} al gateway${cerca !== null ? `: su centro está a ${km(cerca)} de la antena más cercana` : ""}. Un repetidor entre ellas y la red las conecta; si me pide «conecta a los que faltan», busco con el relieve real dónde ponerlo.`,
        ancla: c,
        foco: { tipo: "red", caja: cajaDe([...faltan, ...infra.filter((a) => dist(a, c) <= (cerca ?? 0) * 1.6)]) ?? cajaRed },
        sugerencia: { texto: "Conecta a los que faltan", pedido: "conecta a los que faltan" },
      });
    }
    const aislados = red.aislados.filter((a) => esInfra.has(a.id));
    if (aislados.length)
      pendientes.push({
        texto: `${lista(aislados.slice(0, 3).map((a) => a.nombre))} ${aislados.length === 1 ? "no tiene" : "no tienen"} camino al gateway. Moverlos a terreno más alto o subir sus antenas los une; con «ajústamelo» pruebo alturas, lomas y antenas de apoyo.`,
        ancla: aislados[0],
        foco: { tipo: "punto", lat: aislados[0].lat, lon: aislados[0].lon, zoom: 12.5 },
        sugerencia: { texto: "Ajústamelo", pedido: "ajústamelo" },
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
        texto: `${debiles.length === 1 ? "Hay un enlace débil" : `Hay ${ent(debiles.length)} enlaces débiles`}: el peor es ${w.a.nombre}–${w.p.nombre}, con ${f1(w.x.margen, 0)} dB (para que no se caiga con lluvia conviene 30 dB o más). Subir esas antenas a 9 o 12 m o buscar una loma lo arregla; «ajústamelo» lo hace por usted.`,
        ancla: w.a,
        foco: { tipo: "punto", lat: w.a.lat, lon: w.a.lon, zoom: 12.5 },
        sugerencia: { texto: "Ajústamelo", pedido: "ajústamelo" },
      });
    }
    const criticos = infra.filter((a) => !a.pasarela && nodos.get(a.id)?.critico);
    if (criticos.length)
      pendientes.push({
        texto: `${lista(criticos.slice(0, 3).map((a) => a.nombre))} ${criticos.length === 1 ? "es un punto crítico" : "son puntos críticos"}: si ${criticos.length === 1 ? "se apaga" : "uno se apaga"}, otros pierden el camino al gateway. Una antena de apoyo cerca da un segundo camino; pídame «sugiéreme antenas de apoyo».`,
        ancla: criticos[0],
        foco: { tipo: "punto", lat: criticos[0].lat, lon: criticos[0].lon, zoom: 12.5 },
        sugerencia: { texto: "Sugiéreme antenas de apoyo", pedido: "sugiéreme antenas de apoyo" },
      });
    if (pendientes.length) {
      const primero = pendientes[0];
      paradas.push({
        id: "pendiente",
        clave: "pendiente",
        titulo: "Lo que falta",
        voz: `${primero.texto.split(/(?<=\.)\s/)[0]}${primero.sugerencia ? ` Pídame «${primero.sugerencia.pedido}».` : ""}`,
        resumen: pendientes.map((x) => x.texto.split(/(?<=\.)\s/)[0].replace(/\.$/, "")).join("; ").concat("."),
        nube: {
          etiqueta: "Lo que falta",
          titulo: "Para dejarla completa",
          subtitulo: cuenta(pendientes.length, "punto por resolver", "puntos por resolver"),
          parrafos: pendientes.slice(0, 4).map((x) => x.texto),
          datos: [
            { etiqueta: "Sin cobertura", valor: ent(faltan.length), tono: faltan.length ? "mal" : "bien" },
            { etiqueta: "Enlaces débiles", valor: ent(debiles.length), tono: debiles.length ? "alerta" : "bien" },
            { etiqueta: "Puntos críticos", valor: ent(criticos.length), tono: criticos.length ? "alerta" : "bien" },
            ...(aislados.length ? [{ etiqueta: "Sin camino", valor: ent(aislados.length), tono: "mal" as const }] : []),
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
        const alcances = [alcanceKm ? `unos ${km(alcanceKm * 1000)} hacia la gente` : null, tramo ? `${km(tramo)} entre antenas` : null].filter(Boolean) as string[];
        plan.push(
          `Al 100 % de las personas: ${cuenta(faltan.length, "persona no llega", "personas no llegan")} al gateway${grupos.length > 1 ? `, en ${cuenta(grupos.length, "grupo", "grupos")}` : ""}${maxLejos >= 300 ? `; ${grupos.length > 1 ? "el más lejano está" : faltan.length === 1 ? "está" : "están"} a ${km(maxLejos)} de la red` : ""}. Con el alcance de los repetidores de esta red${alcances.length ? ` (${lista(alcances)})` : ""}, hacen falta unos ${cuenta(apoyos, "repetidor de apoyo", "repetidores de apoyo")}: es un estimado, «conecta a los que faltan» los ubica con el relieve real.`,
        );
        datos.push({ etiqueta: "Repetidores de apoyo", valor: ent(apoyos), detalle: "para llegar a todos", tono: "alerta" });
      } else if (P && !faltan.length) plan.push(`Al 100 % de las personas: ${P === 1 ? "la persona del mapa llega" : `las ${ent(P)} personas del mapa llegan`} al gateway; no hace falta ningún repetidor más para conectarlas.`);
      const largos = red.lejos.filter((x) => esInfra.has(x.id));
      const sinCamino = red.aislados.filter((a) => esInfra.has(a.id));
      if (sinCamino.length || largos.length)
        plan.push(
          [
            sinCamino.length ? `${lista(sinCamino.slice(0, 3).map((a) => a.nombre))} ${sinCamino.length === 1 ? "necesita" : "necesitan"} llegar a la malla: subir la antena, moverlo a una loma o, si no alcanza, un repetidor intermedio.` : "",
            largos.length ? `${lista(largos.slice(0, 3).map((a) => a.nombre))} ${largos.length === 1 ? "pasa" : "pasan"} del límite de ${cuenta(limite, "salto", "saltos")}: un repetidor que acorte el camino o antenas más altas lo resuelve.` : "",
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
          `Enlaces firmes: ${
            debiles.length
              ? `${debiles.length === 1 ? `el enlace ${tramoTxt(debiles[0])} es inestable` : `${ent(debiles.length)} enlaces son inestables (${lista(debiles.slice(0, 3).map(tramoTxt))})`}: con lluvia se ${debiles.length === 1 ? "puede caer" : "pueden caer"}; hay que subir esas antenas a 9 o 12 m o llevarlas a una loma. `
              : ""
          }${justos.length ? `Para el 99,9 %, todos los enlaces del camino deberían tener 37 dB o más (aguantan lluvia y follaje): ${justos.length === 1 ? "falta" : "faltan"} ${lista(justos.slice(0, 3).map(tramoTxt))}${justos.length > 3 ? ` y ${cuenta(justos.length - 3, "más", "más")}` : ""}.` : ""}`.trim(),
        );
      else if (enRuta.length) plan.push(`Enlaces firmes: ${enRuta.length === 1 ? "el enlace del camino tiene" : "todos los enlaces del camino tienen"} 37 dB o más: aguantan lluvia y follaje.`);
      if (debiles.length + justos.length) datos.push({ etiqueta: "Enlaces por reforzar", valor: ent(debiles.length + justos.length), detalle: "con menos de 37 dB", tono: debiles.length ? "mal" : "alerta" });
      // Respaldo: un segundo camino donde hoy hay un punto único de falla
      if (criticos.length) {
        plan.push(`Respaldo: ${lista(criticos.slice(0, 3).map((a) => a.nombre))} ${criticos.length === 1 ? "es un punto único de falla" : "son puntos únicos de falla"}; un repetidor de respaldo cerca de cada uno da un segundo camino al gateway (${cuenta(criticos.length, "repetidor más", "repetidores más")}).`);
        datos.push({ etiqueta: "Respaldos", valor: ent(criticos.length), detalle: criticos.length === 1 ? "punto único de falla" : "puntos únicos de falla", tono: "alerta" });
      } else if (red.repetidores.length) plan.push("Respaldo: no hay puntos únicos de falla entre los repetidores; si uno se apaga, los demás siguen llegando al gateway.");
      // El 99,9 % del tiempo: la salida a internet y la energía
      plan.push(
        G === 0
          ? "Al 99,9 % del tiempo (menos de 9 horas sin servicio al año): primero, el gateway; sin él no hay salida a internet. Después, un segundo gateway o un segundo enlace a internet para que una falla no deje a todos sin servicio."
          : G === 1
            ? "Al 99,9 % del tiempo (menos de 9 horas sin servicio al año): con un solo gateway, si se cae el Starlink o el mini PC, la malla sigue en pie pero sin internet. Hace falta un segundo gateway en otra parte de la malla, o un segundo enlace a internet en el mismo sitio, además de la UPS, baterías para los días nublados y el mantenimiento preventivo."
            : `Al 99,9 % del tiempo (menos de 9 horas sin servicio al año): con ${ent(G)} gateways, si uno falla, la gente cercana al otro sigue con internet; falta cuidar la energía (UPS y baterías para los días nublados) y el mantenimiento preventivo.`,
      );
      datos.push({ etiqueta: "Gateways", valor: G <= 1 ? `${ent(G)} → ${ent(G + 1)}` : ent(G), detalle: G === 0 ? "sin él no hay internet" : G === 1 ? "para el 99,9 %" : "con respaldo de internet", tono: G <= 1 ? "alerta" : "bien" });
      // La hora pico: si el canal aguanta a toda la gente
      const e = d.estres;
      let saturadas = 0;
      if (e) {
        const malas = e.zonas.filter((z) => z.estado === "revienta" || z.estado === "lento");
        saturadas = malas.length;
        const mejor = (e.ajustes ?? []).filter((x) => !x.actual && x.completosPct >= e.completosPct + 1 && x.conRuta >= e.usuarios).sort((x, y) => y.completosPct - x.completosPct)[0];
        const bien = !malas.length && e.completosPct >= 99.9;
        plan.push(
          `Hora pico: le funciona al ${pct(e.resumenUsuarios.funcionanPct)} de las personas y vuelve el ${pct(e.completosPct)} de los mensajes${bien ? ": el canal aguanta." : "."}${malas.length ? ` Se ${malas.length === 1 ? "satura" : "saturan"} ${lista(malas.slice(0, 3).map((z) => z.nombre))}: un repetidor más en ${malas.length === 1 ? "esa zona" : "esas zonas"} reparte la carga.` : ""}${mejor ? ` Con el ajuste de radio ${mejor.nombre} volvería el ${pct(mejor.completosPct)}.` : ""}`,
        );
      } else plan.push(`Hora pico: falta probarla; pídame «${P ? "prueba la hora pico" : "pon 250 personas alrededor de cada gateway y repetidor y haz la prueba de estrés"}» y le digo si el canal aguanta a toda la gente.`);
      // Lo que costarían los refuerzos, con el modelo de costos de Trama
      const gx = G <= 1 ? 1 : 0;
      const rx = apoyos + criticos.length + saturadas;
      const sitio = infra[0] ?? activas[0];
      let costoTxt = "";
      if ((gx || rx) && sitio) {
        const dep = departamentoTrama(d.lugar?.(sitio.lat, sitio.lon)?.departamento);
        const c = costoRedTrama(gx, rx, 0, "xiao", dep?.logistica ?? 1);
        const piezas = [...(rx ? [cuenta(rx, "repetidor más", "repetidores más")] : []), ...(gx ? [G === 0 ? "el gateway" : "un segundo gateway"] : [])];
        costoTxt = `unos ${pesosHablados(c.inversion.total)} de inversión y ${pesosHablados(c.mensual.total)} más al mes`;
        plan.push(`En total, ${lista(piezas)}: unos ${pesosHablados(c.inversion.total)} de inversión (con instalación y transporte) y ${pesosHablados(c.mensual.total)} más al mes, con el modelo de costos de Trama.`);
      }
      const faltaAlgo = apoyos + debiles.length + justos.length + criticos.length + sinCamino.length + largos.length + saturadas > 0 || G <= 1;
      const piezasVoz = [
        apoyos ? `unos ${cuenta(apoyos, "repetidor de apoyo", "repetidores de apoyo")} para llegar a todos` : "",
        debiles.length + justos.length ? `reforzar ${cuenta(debiles.length + justos.length, "enlace", "enlaces")}` : "",
        criticos.length ? cuenta(criticos.length, "respaldo", "respaldos") : "",
        G <= 1 ? (G === 0 ? "el gateway" : "un segundo gateway") : "",
      ].filter(Boolean);
      paradas.push({
        id: "refuerzos",
        clave: "refuerzos",
        titulo: "Para que funcione al 100 %",
        voz: piezasVoz.length ? `Para que funcione al 100 % y al 99,9 % necesita ${lista(piezasVoz)}.` : "La red ya está reforzada: todos llegan, los enlaces son firmes y no hay puntos únicos de falla.",
        resumen: piezasVoz.length
          ? `para funcionar al 100 % y al 99,9 % necesita ${lista(piezasVoz)}${costoTxt ? ` (${costoTxt})` : ""}${e ? "" : "; falta probar la hora pico"}.`
          : `ya está reforzada: todos llegan, los enlaces son firmes y no hay puntos únicos de falla${e ? "" : "; falta probar la hora pico"}.`,
        nube: {
          etiqueta: "Refuerzos",
          titulo: "Para que funcione al 100 % y al 99,9 %",
          subtitulo: faltaAlgo ? "Lo que le falta, con números del simulador" : "Ya está reforzada",
          parrafos: plan,
          datos: datos.slice(0, 4),
          sugerencia: faltan.length
            ? { texto: "Conecta a los que faltan", pedido: "conecta a los que faltan" }
            : debiles.length || justos.length || sinCamino.length || largos.length
              ? { texto: "Ajústamelo", pedido: "ajústamelo" }
              : criticos.length
                ? { texto: "Sugiéreme antenas de apoyo", pedido: "sugiéreme antenas de apoyo" }
                : !e
                  ? { texto: "Probar la hora pico", pedido: P ? "prueba la hora pico" : "pon 250 personas alrededor de cada gateway y repetidor y haz la prueba de estrés" }
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
    if (R)
      parrafos.push(
        `Es una malla de ${cuenta(G, "gateway", "gateways")} y ${cuenta(R, "repetidor", "repetidores")}${r ? ` que llega en ${cuenta(red.saltosMax, "salto", "saltos")} como máximo (el límite de diseño es ${ent(limite)})` : ""}.${
          tramos.length ? ` Cada repetidor quedó a ${tramos.length > 1 && Math.max(...tramos) - Math.min(...tramos) >= 300 ? `entre ${km(Math.min(...tramos))} y ${km(Math.max(...tramos))}` : km(tramos[0])} de la antena con la que se enlaza: la distancia a la que el enlace conserva margen sobre este terreno.` : ""
        }${resto > 0 ? ` Además de los puntos del recorrido hay ${cuenta(resto, "antena más", "antenas más")} con el mismo criterio.` : ""}`,
      );
    else if (G) parrafos.push("Es una red de un solo sitio: el gateway atiende directo a todas las personas que alcanza, sin repetidores.");
    // El reparto de la gente
    if (r && C && infra.length > 1) {
      const carga = infra.map((a) => ({ a, n: (directas.get(a.id) ?? []).length })).sort((x, y) => y.n - x.n)[0];
      const parte = (100 * carga.n) / C;
      parrafos.push(
        parte <= 50
          ? `La carga quedó repartida: el punto más cargado, ${carga.a.nombre}, atiende al ${pct(parte)} de las personas conectadas (${ent(carga.n)} de ${ent(C)}), así ningún canal se satura antes que los demás.`
          : `La carga se concentra en ${carga.a.nombre}, que atiende al ${pct(parte)} de las personas conectadas: un repetidor más en su zona la repartiría y aliviaría su canal en la hora pico.`,
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
        partes.push(`${enRuta.length === 1 ? "El enlace entre antenas que lleva la señal" : `De los ${ent(enRuta.length)} enlaces entre antenas que lleva la señal,`} ${vista}; ${enRuta.length === 1 ? "tiene" : "el más débil es"} ${enRuta.length === 1 ? "" : `${nombre(peor.a)}–${nombre(peor.b)}, con `}${f1(peor.margen, 0)} dB${enRuta.length === 1 ? " de margen" : ""}.`);
      }
      if (entreAntenas.length > enRuta.length) partes.push(`Hay ${cuenta(entreAntenas.length - enRuta.length, "enlace", "enlaces")} de sobra entre antenas, que sirven de respaldo.`);
      partes.push(criticos.length ? `${criticos.length === 1 ? "Queda un punto crítico" : `Quedan ${ent(criticos.length)} puntos críticos`} (${lista(criticos.slice(0, 3).map((a) => a.nombre))}): un respaldo cerca los cubre.` : R ? "No tiene puntos únicos de falla entre los repetidores: si uno se apaga, los demás siguen llegando al gateway." : "");
      parrafos.push(partes.filter(Boolean).join(" "));
      const servicio = r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio;
      parrafos.push(
        `Con este diseño la red da servicio en el ${pct(servicio)} ${r.areaObjetivo ? "del área objetivo" : "del área de estudio"}${P ? ` y llega a ${ent(C)} de ${ent(P)} personas` : ""}. El simulador la califica «${r.factibilidad.titulo}» (${ent(r.factibilidad.puntaje)} de 100).${primeraFrase(r.factibilidad.recomendaciones[0]) ? ` Lo primero que señala: «${mayuscula(primeraFrase(r.factibilidad.recomendaciones[0]))}».` : ""}`,
      );
    }
    if (G || R) {
      const dep = departamentoTrama(d.lugar?.((infra[0] ?? activas[0]).lat, (infra[0] ?? activas[0]).lon)?.departamento);
      const costo = costoRedTrama(G, R, 0, "xiao", dep?.logistica ?? 1);
      parrafos.push(
        `Montar esta infraestructura (${cuenta(G, "sitio gateway", "sitios gateway")} y ${cuenta(R, "repetidor", "repetidores")}, con instalación y transporte) cuesta ${pesosHablados(costo.inversion.total)}, y mantenerla, ${pesosHablados(costo.mensual.total)} al mes. Las billeteras, el soporte y el punto de equilibrio están en el pitch: pídame «preséntame el modelo de negocio».`,
      );
    }
    if (!parrafos.length) parrafos.push("Todavía no hay red en el mapa: ponga el gateway y los repetidores, o pídame «ármame una red que cubra todo el municipio».");
    const enRuta = red.repetidores.map((a) => {
      const p = padreDe(a);
      return p ? enlace(a.id, p.id) : undefined;
    });
    const minimo = enRuta.filter((x): x is Enlace => !!x).reduce((m, x) => Math.min(m, x.margen), Infinity);
    paradas.push({
      id: "cierre",
      clave: "cierre",
      titulo: "Por qué la red quedó así",
      resumen: parrafos.join(" "),
      voz: r
        ? `La red quedó así para llegar a ${ent(C)} de ${ent(P)} personas en ${cuenta(red.saltosMax, "salto", "saltos")} como máximo${Number.isFinite(minimo) ? `, con enlaces de al menos ${f1(minimo, 0)} dB entre antenas` : ""}. El simulador la califica ${r.factibilidad.titulo.toLowerCase()}.`
        : "Así quedó la red del mapa. Al terminar la simulación le confirmo los enlaces y la cobertura.",
      nube: {
        etiqueta: "Conclusión",
        titulo: "Por qué la red quedó así",
        subtitulo: r ? r.factibilidad.titulo : "Diseño de la malla",
        parrafos,
        datos: r
          ? [
              { etiqueta: "Con servicio", valor: pct(r.areaObjetivo ? r.areaObjetivo.servicioPct : r.porcentajeServicio) },
              ...(P ? [{ etiqueta: "Personas conectadas", valor: `${ent(C)} de ${ent(P)}`, tono: (C === P ? "bien" : "alerta") as CifraPitch["tono"] }] : []),
              { etiqueta: "Saltos máximos", valor: ent(red.saltosMax) },
              ...(Number.isFinite(minimo) ? [{ etiqueta: "Enlace más débil", valor: `${f1(minimo, 0)} dB`, tono: calidad(minimo).tono }] : []),
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
  return [`Le dejo por escrito el recorrido de la red (${cuenta(paradas.length, "parada", "paradas")}):`, ...lineas, ...(cierre ? [`Por qué quedó así: ${cierre.resumen}`] : [])].join("\n");
}

/* ───────────── Pedidos ───────────── */

export type AccionRecorrido = "empezar" | "siguiente" | "anterior" | "pausar" | "seguir" | "repetir" | "terminar" | "ir";
/** `parada`: lo que se dijo para elegir la parada («el Repetidor 2», «el gateway», «por qué quedó así»). */
export type PedidoRecorrido = { accion: AccionRecorrido; parada?: string };

const sinTildes = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const EN_NUMEROS: Record<string, string> = { uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9", diez: "10", once: "11", doce: "12" };
/** Para comparar nombres: sin tildes ni signos y con los números en cifras («repetidor dos» → «repetidor 2»). */
const normal = (t: string) =>
  sinTildes(t)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g, (x) => EN_NUMEROS[x])
    .replace(/\s+/g, " ")
    .trim();

const RED = /\b(la red|mi red|esta red|tu red|nuestra red|la malla|esta malla|mi malla|las antenas|los repetidores|cada (punto|antena|repetidor|nodo)|punto por punto|antena por antena)\b/;
const NO_RED = /\b(modelo de negocio|negocio|pitch|presentacion|como funciona|que es|los saltos|el protocolo|meshcore|meshtastic|lora|los colores|la leyenda)\b/;

/**
 * ¿El texto le pide algo al recorrido de la red? «explícame la red», «hazme un recorrido por la red», «recorre la
 * red punto por punto», «¿por qué la red quedó así?», «¿por qué pusiste el Repetidor 2 ahí?». Con `enCurso` también
 * entiende «siguiente», «anterior», «pausa», «sigue», «repite», «ve al gateway» y «termina el recorrido».
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

const ORDINALES: Record<string, number> = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4, quinto: 5, sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10 };

/** La parada que se pide («el Repetidor 2», «el gateway», «las personas», «lo que falta», «por qué quedó así»), o −1. */
export function buscarParada(paradas: ParadaRecorrido[], texto: string): number {
  const t = ` ${normal(texto)} `;
  if (/\b(cierre|conclusion|final|por que (la red )?(quedo|esta|se armo|se construyo|se diseno|se hizo) (asi|de esa|de esta))\b/.test(t)) return paradas.findIndex((p) => p.id === "cierre");
  // Por el nombre de la antena (el más largo primero: «Repetidor 12» antes que «Repetidor 1»)
  const nombres = paradas
    .map((p, i) => ({ i, n: normal(p.titulo), antena: !!p.antena }))
    .filter((x) => x.antena && x.n.length >= 3)
    .sort((a, b) => b.n.length - a.n.length);
  for (const x of nombres) if (t.includes(` ${x.n} `)) return x.i;
  const ord = t.match(/\b(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo) repetidor\b/);
  if (ord) {
    const reps = paradas.map((p, i) => ({ p, i })).filter((x) => x.p.id === "repetidor");
    return reps[ORDINALES[ord[1]] - 1]?.i ?? -1;
  }
  if (/\b(refuerz\w*|reforzar\w*|100|cien por ciento|99|respaldos?|redundan\w*)\b/.test(t)) return paradas.findIndex((p) => p.id === "refuerzos");
  if (/\b(calcula\w*|calculo|metodo|propagacion|por dentro)\b|\bmodelo\b(?! de negocio)/.test(t)) return paradas.findIndex((p) => p.id === "metodo");
  if (/\b(gateway|pasarela|puerta|internet|starlink)\b/.test(t)) return paradas.findIndex((p) => p.id === "gateway");
  if (/\b(personas|gente|usuarios|billeteras)\b/.test(t)) return paradas.findIndex((p) => p.id === "personas");
  if (/\b(falta|faltan|pendiente\w*|mejorar|debil\w*|problema\w*|arreglar)\b/.test(t)) return paradas.findIndex((p) => p.id === "pendiente");
  if (/\b(inicio|principio|panorama|comienzo|vistazo|empezar)\b/.test(t)) return 0;
  return -1;
}
