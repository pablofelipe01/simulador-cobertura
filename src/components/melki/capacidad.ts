// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Órdenes de Melki para la gente y la capacidad de la red (pagos, WhatsApp y consultas a la IA): «Poblar personas» (reparte N billeteras al azar
// en la zona), las zonas de popularidad («por cada antena 250 personas»), la prueba de estrés de la hora pico por
// repetidor («¿qué tan colapsada está la red?», «¿hasta cuántos usuarios aguanta cada repetidor?»), la prueba de
// carga («envía 25 pagos al tiempo», «¿hasta cuántos aguanta?») y el dimensionamiento de Trama por departamento o
// por número de usuarios, con los precios y supuestos del documento del Inge.
import type { CurvaCargaResultado, ResultadoCarga } from "@/lib/radio/carga";
import { presetPorId } from "@/lib/radio/constantes";
import { CAUSAS_USUARIO, ESTADOS_USUARIO, ESTRES_MEDIDO, PAGOS_PERSONA_DIA_TRAMA, TOPE_CICLO_PCT, type ResultadoEstres, type ZonaEstres } from "@/lib/radio/estres";
import type { ResultadoOptimizar } from "@/lib/radio/optimizar";
import { FICHA_GATEWAY, PROTOCOLOS } from "@/lib/radio/protocolos";
import {
  CAPACIDAD_TRAMA,
  DEPARTAMENTOS_TRAMA,
  dimensionarDepartamento,
  dimensionarTrama,
  OPERACION_TRAMA,
  pesosTrama,
  SF_TRAMA,
  TERRENOS_TRAMA,
  type Dimension,
  type NodoUsuario,
  type SfTrama,
  type TerrenoTrama,
} from "@/lib/radio/trama";
import type { Parametros, ResultadoSimulacion } from "@/lib/radio/tipos";

import type { OpcionesCarga, PedidoPoblar } from "../simulador/panel-capacidad";
import { MAX_POR_ZONA, MUESTRA_PUNTO, textoLimite, textoLlenado, textoOptimizacion, textoPropuesta, textoUsuarios, textoZonas, ZONA_DEFECTO, type CentroZona, type OpcionesEstres, type PedidoZonas } from "../simulador/panel-estres";
import type { Respuesta } from "./cerebro";
import type { Api, Orden, ResultadoOrden } from "./ordenes";
import { circuloEnTexto } from "./medidas";

const f1 = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
const ent = (x: number) => Math.round(x).toLocaleString("es-CO");
const pct = (x: number) => (x >= 99.95 && x < 100 ? "99,9" : f1(x, x >= 10 || Number.isInteger(x) ? 0 : 1));
const seg = (s: number) => (s < 10 ? `${f1(s, 1)} s` : s < 120 ? `${Math.round(s)} s` : `${f1(s / 60, 1)} min`);

/** Número escrito en español: «250», «1.500», «2,5», «3 mil». */
function numero(s: string): number {
  const t = s.trim();
  const mil = /\s*mil$/.test(t);
  const base = t.replace(/\s*mil$/, "");
  const v = /^\d{1,3}(\.\d{3})+$/.test(base) ? Number(base.replace(/\./g, "")) : Number(base.replace(",", "."));
  return mil ? v * 1000 : v;
}

const NUM = String.raw`(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(?:\s*(mil)\b)?`;
const GENTE = String.raw`(?:personas?|usuari[oa]s?|gente|billeteras?|habitantes?|familias?|nodos? de campo|clientes?)`;

/* ───────────── Poblar personas ───────────── */

function interpretarPoblar(texto: string, tn: string, api: Api): Orden | null {
  if (/\b(quita\w*|borra\w*|elimina\w*|saca\w*|limpia\w*)\b/.test(tn) && /\b(pobladas?|poblacion|al azar|aleatori\w*|repartidas?)\b/.test(tn)) return { tipo: "quitar-pobladas" };
  const verbo = /\b(pobla\w*|puebla\w*|popula\w*|reparte\w*|repart\w*|distribu\w*|esparc\w*|riega\w*|regad\w*)\b/.test(tn);
  const azar = /\b(al azar|aleatori\w*|por (toda )?la (malla|red|zona)|por todo el area|regad\w*)\b/.test(tn) && /\b(pon\w*|mete\w*|agrega\w*|coloca\w*|crea\w*|genera\w*|simula\w*)\b/.test(tn);
  // «Mete 500 personas», «agrega 300 usuarios»: muchas personas a la vez (sin coordenada) es poblar, no una pieza
  const muchas = tn.match(new RegExp(`\\b(?:pon\\w*|mete\\w*|agrega\\w*|anade\\w*|coloca\\w*|crea\\w*|genera\\w*|suma\\w*)\\b.*?\\b${NUM}\\s*${GENTE}`));
  const varias = Boolean(muchas && numero(`${muchas[1]}${muchas[2] ? " mil" : ""}`) >= 5 && !/-?\d{1,2}[.,]\d+\s*,\s*-?\d{1,3}[.,]\d+/.test(texto));
  if (!verbo && !azar && !varias) return null;
  // «poblar personas» sin decir cuántas: 250, como en el ejemplo del Inge
  const cantidad = tn.match(new RegExp(`${NUM}\\s*${GENTE}`)) ?? tn.match(new RegExp(`\\b(?:con|son|unas|unos|de)\\s+${NUM}\\b(?!\\s*(?:km|%|m\\b|metros|saltos))`));
  if (!cantidad && !/\b(personas?|usuari\w*|gente|billeteras?|habitantes?|familias?|zona|area|malla|red)\b/.test(tn)) return null;
  const pedido: PedidoPoblar = {};
  // Densidad: «1 por km²», «a densidad media», «zona dispersa»
  const dens = texto.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(?:personas?|usuari[oa]s?)?\s*(?:por|\/|x)\s*(?:km\s*2|km²|kil[oó]metro cuadrado)/);
  if (dens) pedido.densidadKm2 = numero(dens[1]);
  else if (/\b(densidad|zona|poblacion)\b.*\b(dispers\w*|baja)\b|\bdispers[oa]s?\b/.test(tn)) pedido.densidadKm2 = 0.2;
  else if (/\b(densidad|zona|poblacion)\b.*\b(dens[oa]|alta)\b|\bmuy poblad\w*/.test(tn)) pedido.densidadKm2 = 5;
  else if (/\b(densidad|zona|poblacion)\b.*\b(media|medio|normal)\b/.test(tn)) pedido.densidadKm2 = 1;
  if (cantidad && pedido.densidadKm2 === undefined) pedido.n = numero(`${cantidad[1]}${cantidad[2] ? " mil" : ""}`);
  if (pedido.n === undefined && pedido.densidadKm2 === undefined) pedido.n = 250;
  // Dónde
  const areas = api.areasPoblar();
  if (/\barea objetivo\b/.test(tn)) pedido.areaId = areas.find((a) => a.objetivo)?.id;
  else if (/\b(area de estudio|todo el radio|radio de estudio)\b/.test(tn)) pedido.areaId = "zona-estudio";
  else if (/\b(alrededor de la red|zona de la red|cerca de la red|por la malla|por la red)\b/.test(tn)) pedido.areaId = "zona-red";
  else {
    const m = areas.find((a) => a.id !== "zona-red" && a.id !== "zona-estudio" && tn.includes(a.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^area (objetivo )?/, "").replace(/[«»]/g, "").trim()));
    if (m) pedido.areaId = m.id;
  }
  if (/\b(solo|unicamente|nada mas|solamente)\b.*\b(senal|cobertura)\b|\bdonde (haya|hay|tenga|tengan) (senal|cobertura)\b|\bcon (senal|cobertura)\b/.test(tn)) pedido.soloConSenal = true;
  if (/\b(mas|otras|otros|adicionales|ademas|suma\w*|agrega\w*)\b/.test(tn) && api.antenas().some((a) => a.poblada)) pedido.reemplazar = false;
  return { tipo: "poblar", pedido };
}

/** Cómo quedaron conectadas las personas pobladas (con la simulación real). */
function textoPobladas(r: ResultadoSimulacion | null, api: Api): string {
  if (!r) return "La simulación no terminó; pulse Simular para ver cuántas quedan conectadas.";
  const porId = new Map(api.antenas().map((a) => [a.id, a]));
  const lim = api.parametros().limiteSaltos;
  const pobl = r.nodos.filter((n) => porId.get(n.id)?.poblada);
  if (!pobl.length) return "";
  const ok = pobl.filter((n) => n.saltos !== null && n.saltos <= lim);
  const lejos = pobl.filter((n) => n.saltos !== null && n.saltos > lim).length;
  const sin = pobl.length - ok.length - lejos;
  const medio = ok.length ? ok.reduce((s, n) => s + (n.saltos ?? 0), 0) / ok.length : 0;
  const partes = [`De las ${ent(pobl.length)}, ${ent(ok.length)} llegan al gateway (${pct((100 * ok.length) / pobl.length)} %)${ok.length ? `, en promedio a ${f1(medio)} saltos` : ""}`];
  if (lejos) partes.push(`${ent(lejos)} llegan con más de ${lim} saltos`);
  if (sin) partes.push(`${ent(sin)} quedan sin cobertura (rojo en el mapa)`);
  return `${partes.join("; ")}.`;
}

function ejecutarPoblar(o: Extract<Orden, { tipo: "poblar" }>, api: Api): ResultadoOrden {
  const antes = api.instantanea();
  const x = api.poblar(o.pedido);
  if ("error" in x) return { texto: x.error, acciones: [{ texto: "Poner el gateway", accion: "orden", orden: { tipo: "pieza", pieza: "gateway", datos: {} } }] };
  const dens = x.puestas / Math.max(0.01, x.km2);
  const area = x.area.charAt(0).toLowerCase() + x.area.slice(1);
  const faltan = x.puestas < x.pedidas ? ` Puse ${ent(x.puestas)} de ${ent(x.pedidas)}: ${x.conSenal ? "solo hay señal en parte del área" : "no cupieron más sin quedar encimadas"}.` : "";
  return {
    texto: `Listo: repartí ${ent(x.puestas)} personas al azar en ${area} (${f1(x.km2, x.km2 < 10 ? 1 : 0)} km², ≈ ${f1(dens, dens < 1 ? 2 : 1)} por km²)${x.conSenal ? ", solo donde hay señal" : ""}${x.quitadas ? `, en lugar de las ${ent(x.quitadas)} que había` : ""}. Cada una lleva su billetera (XIAO ESP32S3 + Wio-SX1262, companion: no retransmite) a 1,5 m.${faltan} Simulo cuántas quedan conectadas…`,
    deshacer: antes,
    luego: api.esperarResultado().then(
      (r): Respuesta => ({
        texto: `${textoPobladas(r, api)} Ahora puede probar cuántos pagos, WhatsApp y consultas a la IA aguanta la frecuencia: «envía 15 pagos al tiempo», «manda 15 mensajes de WhatsApp al tiempo» o «¿hasta cuántos pagos aguanta?».`,
        acciones: [
          { texto: "15 pagos al tiempo", accion: "orden", orden: { tipo: "carga", opciones: { mensajes: 15 }, curva: false } },
          { texto: "¿Hasta cuántos aguanta?", accion: "orden", orden: { tipo: "carga", opciones: {}, curva: true } },
          { texto: "Deshacer", accion: "deshacer", escenario: antes },
        ],
      }),
    ),
  };
}

/* ───────────── Prueba de carga ───────────── */

function interpretarCarga(texto: string, tn: string): Orden | null {
  const unidad = String.raw`(pagos?|mensajes?|whatsapps?|consultas?|transacciones?|transferencias?|envios?|paquetes?)`;
  const curva =
    /\bhasta (cuant\w*|donde|que punto|que se revient\w*|reventar\w*)\b.*\b(aguant\w*|soport\w*|resist\w*|da|llega|revient\w*|pagos?|mensajes?)\b|\bcuando se revienta\b|\bhasta que se revient\w*|\bpunto de quiebre\b|\bcapacidad (maxima|de la red|del canal|de la frecuencia)\b|\bcuant\w* (pagos?|mensajes?|whatsapps?|consultas?|transacciones?) (aguanta|soporta|resiste|caben|da)\b|\b(aguanta|soporta|resiste)\b.*\b(pagos?|mensajes?|whatsapps?|transacciones?|carga)\b|\bcurva de carga\b/.test(
      tn,
    );
  const explicita = /\b(prueba|test|ensayo) de (carga|estres|capacidad|saturacion)\b|\bestres(a\w*)?\b|\bsatura\w*\b.*\b(red|canal|frecuencia)\b/.test(tn);
  const cuantos = tn.match(new RegExp(`\\b(\\d{1,4})\\s*${unidad}\\b`));
  const alTiempo = /\b(al tiempo|a la vez|al mismo tiempo|simultane\w*|juntos|juntas|de golpe|en rafaga|por hora|cada hora|en \d+ (s|seg\w*|minutos?|min))\b/.test(tn);
  const verbo = /\b(envia\w*|manda\w*|simula\w*|prueba\w*|dispara\w*|lanza\w*|haz|hagan|hacer|salgan|salen|mete\w*)\b/.test(tn);
  if (!curva && !explicita && !(cuantos && alTiempo && verbo)) return null;
  if (/^(que|como|por que|para que)\b.*\b(es|son|significa|funciona)\b/.test(tn) && !cuantos && !curva) return null; // pregunta de concepto
  const opciones: Partial<OpcionesCarga> = {};
  if (cuantos) opciones.mensajes = Math.min(2000, Number(cuantos[1]));
  if (/\b(mensajes?|whatsapps?|consultas?)\b/.test(tn) && !/\bpagos?\b/.test(tn)) opciones.tipo = "texto";
  else opciones.tipo = "pago";
  if (/\b(por hora|cada hora|en una hora|en la hora)\b/.test(tn)) {
    opciones.modo = "continua";
    if (!cuantos) opciones.mensajes = 55;
  } else {
    opciones.modo = "rafaga";
    const v = texto.toLowerCase().match(/\ben\s+(\d{1,3})\s*(s\b|seg|segundos?|min|minutos?)/);
    if (v) opciones.ventanaS = Math.min(600, Number(v[1]) * (/^m/.test(v[2]) ? 60 : 1));
    else if (/\b(exactamente|el mismo segundo|en un segundo|instantane\w*)\b/.test(tn)) opciones.ventanaS = 1;
    else if (/\ben un minuto\b/.test(tn)) opciones.ventanaS = 60;
  }
  if (/\b(primera vez|sin ruta|inundacion|inundad\w*|flood|ruta nueva|no conocen la ruta)\b/.test(tn)) opciones.rutaConocida = false;
  if (/\bsin aviso\b/.test(tn)) opciones.conAviso = false;
  return { tipo: "carga", opciones, curva: curva && !cuantos ? true : curva };
}

/** Lo que dice la prueba de carga, en palabras (con la referencia de Trama para el SF que se usa). */
export function textoCarga(r: ResultadoCarga, curva: CurvaCargaResultado | null, p: Parametros, ventanaS: number): string {
  if (r.motivo) return r.motivo;
  const preset = presetPorId(p.preset);
  const unidad = r.tipo === "pago" ? "pagos" : "mensajes de texto (WhatsApp o IA)";
  const como = r.modo === "rafaga" ? `${r.mensajes} ${unidad} al tiempo (en ${seg(ventanaS)})` : `${r.mensajes} ${unidad} por hora`;
  const partes: string[] = [];
  partes.push(
    `Probé ${como} desde ${r.remitentes === 1 ? "la persona conectada" : `${ent(r.remitentes)} personas conectadas`}, con ${preset.nombre}, paquete por paquete como lo hace MeshCore: ${r.saturada ? "se revienta" : r.lenta ? "aguanta, pero lento" : "aguanta"}. ${pct(r.completosPct)} % ${r.tipo === "pago" ? "recibieron su comprobante" : "recibieron respuesta"}; la espera típica fue ${seg(r.latenciaS.p50)} y el 95 % en menos de ${seg(r.latenciaS.p95)}.`,
  );
  partes.push(
    `El canal del gateway estuvo ocupado el ${pct(r.canalGatewayPct)} % del tiempo; hubo ${r.colisiones} ${r.colisiones === 1 ? "choque" : "choques"} y ${r.reintentos} ${r.reintentos === 1 ? "reintento" : "reintentos"}${r.sordos ? `, y ${r.sordos} paquetes se perdieron porque el radio estaba transmitiendo` : ""}${r.perdidasCola ? `; ${r.perdidasCola} se descartaron por cola llena` : ""}.`,
  );
  if (r.tipo === "pago") partes.push(`Un pago limpio por esta red ocupa ~${f1(r.airePorPagoS)} s de aire (orden de 118 B, comprobante de 126 B y aviso de 126 B, con sus acuses).`);
  if (curva) {
    const tramos: string[] = [];
    if (curva.seguro !== null) tramos.push(`aguanta sin demora hasta ${curva.seguro} al tiempo`);
    if (curva.lento !== null) tramos.push(`desde ${curva.lento} aguanta pero lento (el 95 % tarda más de un minuto)`);
    if (curva.quiebre !== null) tramos.push(`se revienta desde ${curva.quiebre} (menos del 90 % recibe su respuesta)`);
    else if (curva.puntos.length) tramos.push(`hasta ${curva.puntos[curva.puntos.length - 1].n} al tiempo no se revienta`);
    if (tramos.length) partes.push(`Subiendo la cantidad: ${tramos.join("; ")}.`);
  }
  if (preset.anchoBandaKhz === 250 && preset.sf >= 9 && preset.sf <= 11) {
    const ref = SF_TRAMA[preset.sf as SfTrama];
    partes.push(`Referencia de Trama con SF${preset.sf}: ~${ref.pagosHora} pagos por hora por frecuencia con el canal al ${CAPACIDAD_TRAMA.canalPicoPct} % (${ref.usuariosFrecuencia} usuarios; ${ref.usuariosFrecuencia * CAPACIDAD_TRAMA.radiosPorSitio} por sitio de 4 radios); esa capacidad la comparten con los WhatsApp y las consultas a la IA.`);
  }
  if (r.saturada || r.lenta) {
    const consejos = ["repartir la gente en las 4 frecuencias del sitio (920, 921,5, 924 y 925,5 MHz)"];
    if (preset.sf > 9 && preset.anchoBandaKhz === 250) consejos.push(`bajar a SF${preset.sf - 1} si el alcance lo permite (más mensajes por hora, menos alcance)`);
    consejos.push("acortar las rutas (menos saltos)");
    partes.push(`Para que aguante más: ${consejos.join(", ")}.`);
  }
  return partes.join(" ");
}

function ejecutarCarga(o: Extract<Orden, { tipo: "carga" }>, api: Api): ResultadoOrden {
  const p = api.parametros();
  const ventana = o.opciones.ventanaS ?? 10;
  const n = o.opciones.mensajes ?? (o.opciones.modo === "continua" ? 55 : 15);
  const unidad = o.opciones.tipo === "texto" ? "mensajes de texto (WhatsApp o IA)" : "pagos";
  const quePrueba = o.curva
    ? `Subo la cantidad de ${unidad} al tiempo (5, 10, 15, 25, 40…) hasta que la frecuencia se reviente`
    : o.opciones.modo === "continua"
      ? `Simulo ${n} ${unidad} por hora durante una hora`
      : `Simulo ${n} ${unidad} saliendo al tiempo (en ${seg(ventana)})`;
  return {
    texto:
      presetPorId(api.parametros().preset).protocolo === "meshtastic"
        ? `${quePrueba}, paquete por paquete como Meshtastic: cada nodo escucha antes de hablar, los que repiten esperan según la señal con que lo oyeron y cancelan si otro ya lo repitió, el destino acusa y si no llega se reenvía (hasta 3 envíos, el último por inundación). Tardo unos segundos.`
        : `${quePrueba}, paquete por paquete como MeshCore: cada repetidor escucha antes de hablar, espera su turno al azar, los acuses vuelven y si no llegan se reintenta (3 por la ruta y el último por inundación). Tardo unos segundos.`,
    luego: api.probarCarga(o.opciones, o.curva).then(
      (x): Respuesta =>
        x
          ? {
              texto: textoCarga(x.carga, x.curva, p, ventana),
              acciones: x.carga.motivo
                ? [{ texto: "Poblar 250 personas", accion: "orden", orden: { tipo: "poblar", pedido: { n: 250 } } }]
                : o.curva
                  ? undefined
                  : [{ texto: "¿Hasta cuántos aguanta?", accion: "orden", orden: { tipo: "carga", opciones: { ...o.opciones, mensajes: undefined }, curva: true } }],
            }
          : { texto: "No pude hacer la prueba de carga (falta simular la red o el motor se detuvo). Intente de nuevo en un momento." },
    ),
  };
}

/* ───────────── Zonas de popularidad y prueba de estrés ───────────── */

/** «Por cada punto», «en cada repetidor», «alrededor de todas las antenas». */
const CADA = /\b(?:por|en|para|a|de|alrededor de|cerca de)\s+cada\s+(?:punto|nodo|antena|repetidor\w*|torre|gateway|sitio|uno|una)\b|\b(?:en|a|alrededor de|cerca de|para)\s+(?:todos|todas)\s+(?:los|las)\s+(?:puntos|nodos|antenas|repetidores|torres)\b/;
const POPULARIDAD = /\b(popularidad|zonas? populares?|puntos? calientes?|zonas? calientes?)\b/;
const ALREDEDOR = /\b(alrededor|a la redonda|en torno|al rededor|cerca)\b/;
/** Lo que pide ver qué pasa con la carga: colapso, estrés, ancho de banda, cuánto aguanta. */
const PIDE_ESTRES = /\b(colaps\w*|revent\w*|revient\w*|satur\w*|estres\w*|aguant\w*|soport\w*|resist\w*|ancho de banda|capacidad|transferir|se cae|se caiga|caeria|evalu\w*|verific\w*|hora pico|que tan|congestion\w*|falla\w*|estabilidad|queda estable|quede estable|sigue estable|siga estable)\b/;
const PIDE_RAMPA = /\b(hasta (donde|cuant\w*|que punto)|limite|maximo|cuant\w* (usuarios|personas|gente) (aguanta|soporta|resiste|caben)|antes de que|punto de (estres|quiebre)|colaps\w*|revent\w*|revient\w*|estres\w*|circunstancias)\b/;
const PIDE_COMPARAR = /\b(ancho de banda|ajustes? de radio|sf ?\d+|62[.,]5|250 khz|125 khz|otro ajuste|otros ajustes|circunstancias)\b/;

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normal = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Gateways y repetidores nombrados en el texto («Repetidor 12» no se confunde con «Repetidor 1»). */
function centrosNombrados(tn: string, centros: CentroZona[]): CentroZona[] {
  const vistos: { c: CentroZona; ini: number; fin: number }[] = [];
  for (const c of [...centros].sort((a, b) => b.nombre.length - a.nombre.length)) {
    const nombre = normal(c.nombre);
    for (const m of tn.matchAll(new RegExp(`(^|[^a-z0-9])(${esc(nombre)})(?=$|[^a-z0-9])`, "g"))) {
      const ini = (m.index ?? 0) + m[1].length;
      const fin = ini + nombre.length;
      if (!vistos.some((v) => ini < v.fin && fin > v.ini)) {
        vistos.push({ c, ini, fin });
        break;
      }
    }
  }
  return vistos.sort((a, b) => a.ini - b.ini).map((v) => v.c);
}

/** Opciones de la prueba de estrés que trae el texto: rampa, comparar ajustes, día de mercado, mensajes al día, multiplicador. */
function opcionesEstres(tn: string): Partial<OpcionesEstres> {
  const o: Partial<OpcionesEstres> = { rampa: PIDE_RAMPA.test(tn), comparar: PIDE_COMPARAR.test(tn) };
  // Lo medido en el gateway: el largo real de los mensajes, su ritmo y la fila de a uno
  if (/\b(medid[oa]s?|datos reales|valores reales|ficha( tecnica)?|como (en |el )?(el )?gateway real|trafico real)\b/.test(tn) || FICHA_GATEWAY.claves.some((c) => tn.includes(c))) Object.assign(o, { perfil: "medido", pagosPersonaDia: ESTRES_MEDIDO.pagosPersonaDia, horaPicoPct: ESTRES_MEDIDO.horaPicoPct });
  if (/\b(enlaces? (medidos?|de campo|reales)|curva (de campo|medida))\b/.test(tn)) o.curva = "campo";
  else if (/\b(curva del diseno|enlaces? del diseno|conservador\w*)\b/.test(tn)) o.curva = "diseno";
  if (/\b(dia de mercado|mercado|feria|quincena|dia de pago)\b/.test(tn)) o.horaPicoPct = CAPACIDAD_TRAMA.horaPicoMercadoPct;
  const dia = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:pagos?|mensajes?|whatsapps?|consultas?)\s*(?:por|al|cada|a el)\s*(?:persona|usuario|dia)/);
  if (dia) o.pagosPersonaDia = Math.min(50, Math.max(0.1, numero(dia[1])));
  const veces = tn.match(/\bx\s?(\d{1,2})\b|\b(\d{1,2})\s*veces\b/);
  if (veces) o.factor = Math.min(50, Math.max(1, Number(veces[1] ?? veces[2])));
  else if (/\b(el doble|doble de (carga|gente|pagos|mensajes|trafico))\b/.test(tn)) o.factor = 2;
  else if (/\b(el triple|triple de (carga|gente|pagos|mensajes|trafico))\b/.test(tn)) o.factor = 3;
  return o;
}

function interpretarZonas(texto: string, tn: string, api: Api): Orden | null {
  const centros = api.centrosZona();
  const nombrados = centrosNombrados(tn, centros);
  if (/\b(quita\w*|borra\w*|elimina\w*|saca\w*|limpia\w*)\b/.test(tn) && /\b(zonas? de popularidad|popularidad|zonas? populares?|las zonas)\b/.test(tn)) return { tipo: "quitar-zonas", centros: nombrados.length ? nombrados.map((c) => c.id) : undefined };
  const gente = tn.match(new RegExp(`${NUM}\\s*${GENTE}`));
  const popular = POPULARIDAD.test(tn);
  const cada = CADA.test(tn);
  // «Alrededor del Repetidor 1» o «pon 700 personas en el Repetidor 1»
  const alrededor = (ALREDEDOR.test(tn) || /\b(pon\w*|agreg\w*|anad\w*|mete\w*|coloca\w*|carga\w*)\b/.test(tn)) && nombrados.length > 0;
  if (!popular && !(cada && gente) && !(alrededor && gente)) return null;
  // Preguntas de concepto («¿qué es una zona de popularidad?») las contesta el cerebro
  if (/^(que|como|para que|por que)\s+(es|son|significa|sirve|funciona)\b/.test(tn) && !gente) return null;
  const pedido: PedidoZonas = {};
  const cuantos = gente ?? tn.match(new RegExp(`\\bpopularidad\\s+(?:de|con)\\s+${NUM}`));
  pedido.n = cuantos ? Math.min(MAX_POR_ZONA, Math.max(1, Math.round(numero(`${cuantos[1]}${cuantos[2] ? " mil" : ""}`)))) : 250;
  const km = tn.match(/\b(?:a|en|dentro de|en un radio de|radio de)\s+(\d{1,2}(?:[.,]\d+)?)\s*(?:km|kilometros?)\b/) ?? tn.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*(?:km|kilometros?)\s*(?:a la redonda|de radio|alrededor)\b/);
  const metros = tn.match(/\b(\d{2,4})\s*(?:m|metros)\s*(?:a la redonda|de radio|alrededor)\b/);
  // En millas, yardas, pies o cuadras también («a media milla a la redonda de cada repetidor»)
  const otra = km || metros ? null : circuloEnTexto(tn);
  if (km) pedido.radioKm = Math.min(20, Math.max(0.2, numero(km[1])));
  else if (metros) pedido.radioKm = Math.min(20, Math.max(0.2, Number(metros[1]) / 1000));
  else if (otra) pedido.radioKm = Math.min(20, Math.max(0.2, otra.radio.metros / 1000));
  if (!cada && nombrados.length) pedido.centros = nombrados.map((c) => c.id);
  else if (!cada && /\b(este|ese|esta|esa|el seleccionado|la seleccionada)\s+(repetidor|nodo|antena|gateway|torre)\b/.test(tn)) {
    const sel = api.seleccion();
    if (sel && centros.some((c) => c.id === sel)) pedido.centros = [sel];
  }
  if (/\b(aunque no haya|sin importar la|tambien donde no hay|en toda la zona|incluso sin|con o sin)\b/.test(tn)) pedido.soloConSenal = false;
  return { tipo: "zonas", pedido, estres: PIDE_ESTRES.test(tn) ? opcionesEstres(tn) : null };
}

function interpretarEstres(texto: string, tn: string): Orden | null {
  // La ráfaga («envía 25 pagos al tiempo», «55 pagos por hora») es la prueba de carga
  if (/\b(al tiempo|a la vez|al mismo tiempo|simultane\w*|de golpe|en rafaga|juntos|juntas)\b/.test(tn) || /\b\d{1,4}\s*(pagos?|mensajes?|whatsapps?|consultas?)\s+(por|cada)\s+hora\b/.test(tn)) return null;
  const porZona = /\b(cada|por|el|un|del)\s+(repetidor|zona|antena|nodo)\b|\bhora pico\b|\b(usuarios|personas|gente)\b/.test(tn);
  // «¿Hasta cuántos pagos aguanta?» es la curva de ráfagas
  if (/\bcuant\w* (pagos?|mensajes?|whatsapps?|consultas?|transacciones?)\b/.test(tn) && !porZona) return null;
  const pide =
    /\b(prueba|test|ensayo) de (estres|saturacion)\b|\bestres\w*\b|\bhora pico\b|\bdia de mercado\b|\bcolaps\w*\b|\bancho de banda\b/.test(tn) ||
    /\b(cuant\w*|hasta cuant\w*)\s+(usuarios|personas|gente|billeteras|clientes)\b.*\b(aguant\w*|soport\w*|resist\w*|caben|puede|atiende)\b/.test(tn) ||
    /\b(cada|por|el|un|del)\s+(repetidor|zona|antena|nodo)\b.*\b(aguant\w*|soport\w*|resist\w*|revient\w*|colaps\w*|capacidad|satur\w*)\b/.test(tn) ||
    /\b(aguant\w*|soport\w*|resist\w*)\b.*\b(cada|por) (repetidor|zona|antena|nodo)\b/.test(tn) ||
    /\bque tan (colapsad\w*|saturad\w*|cargad\w*|estresad\w*)\b/.test(tn) ||
    /\bhasta (que|donde) punto\b.*\b(aguant\w*|estres\w*|carga|malla|red)\b/.test(tn) ||
    // «…y mira si aguanta», «a ver si la red aguanta», «¿la red aguanta 500 personas?»
    /^(y )?(mira|mirar|mire|ver|a ver|prueba|probar|pruebe|revisa|revisar|chequea) si (la red |la malla )?(aguanta|soporta|resiste)\b/.test(tn) ||
    /\b(la red|la malla)\s+(aguanta|soporta|resiste)\s+(a\s+)?\d[\d.]*\s*(personas|usuarios|gente|familias|billeteras)\b/.test(tn);
  if (!pide) return null;
  if (/^(que|como|por que|para que)\s+(es|son|significa|quiere decir)\b/.test(tn)) return null;
  return { tipo: "estres", opciones: opcionesEstres(tn) };
}

/** Cómo quedaron conectadas las personas de las zonas (con la simulación real). */
function textoConectadas(r: ResultadoSimulacion | null, api: Api): string {
  if (!r) return "La simulación no terminó; pulse Simular para ver cuántas quedan conectadas.";
  const porId = new Map(api.antenas().map((a) => [a.id, a]));
  const lim = api.parametros().limiteSaltos;
  const de = r.nodos.filter((n) => porId.get(n.id)?.zona);
  if (!de.length) return "";
  const ok = de.filter((n) => n.saltos !== null && n.saltos <= lim).length;
  return `De las ${ent(de.length)} personas de las zonas, ${ent(ok)} llegan al gateway (${pct((100 * ok) / de.length)} %).`;
}

const estadoTxt = (e: ZonaEstres["estado"]) => ({ aguanta: "aguanta", lento: "aguanta, pero lento", revienta: "se revienta", "sin-pagos": "sin mensajes" })[e];
const LIMITES: Record<ZonaEstres["limites"][number], string> = {
  canal: "canal lleno",
  ciclo: `al tope del ciclo de trabajo (${TOPE_CICLO_PCT} %)`,
  recorte: "canal sobre el 25 %: Meshtastic recorta posiciones y telemetría",
  cola: "cola llena (descarta paquetes)",
  choques: "muchos choques",
  alcance: "pierde alcance con la carga",
  energia: "la energía no le alcanza",
};
const veces = (f: number) => `×${f1(f, f < 1 ? 2 : f % 1 ? 1 : 0)}`;

/** Lo que dice la prueba de estrés, en palabras: la red, zona por zona, la rampa, los ajustes de radio y qué hacer. */
export function textoEstres(r: ResultadoEstres): string {
  if (r.motivo) return r.motivo;
  const partes: string[] = [];
  partes.push(
    `Prueba de estrés de la hora pico (${r.preset.nombre}): ${ent(r.usuarios)} personas con ruta × ${f1(r.pagosPersonaDia, 1)} mensajes al día (pagos, WhatsApp y consultas a la IA) × ${r.horaPicoPct} % en la hora pico${r.factor !== 1 ? ` × ${r.factor}` : ""} = ${ent(r.pedidosHora)} mensajes por hora. Resultado: ${r.estado === "revienta" ? "se revienta" : r.estado === "lento" ? "aguanta, pero lento" : "aguanta"}. ${pct(r.completosPct)} % de los mensajes recibieron su respuesta y el 95 % en menos de ${seg(r.p95S)}. Entregó ${ent(r.entregadosHora)} de ${ent(r.pedidosHora)} mensajes por hora (ancho de banda útil ~${ent(r.utilBps)} bps de mensajes, de ${f1(r.canalBps / 1000, 2)} kbps que da el canal); el canal del gateway estuvo ocupado el ${pct(r.canalGatewayPct)} % (Trama diseña al ${CAPACIDAD_TRAMA.canalPicoPct} %).`,
  );
  const zonas = r.zonas.filter((z) => z.usuarios > 0).sort((a, b) => a.completosPct - b.completosPct);
  if (zonas.length) {
    const lineas = zonas.slice(0, 6).map((z) => {
      const lim = z.limites.length ? `; ${z.limites.map((l) => LIMITES[l]).join(", ")}` : "";
      const rampa =
        z.usuariosMax !== undefined
          ? z.usuariosMax !== null
            ? `; aguanta ${z.aguantaTodo ? "más de" : "hasta"} ~${ent(z.usuariosMax)} personas sin demora`
            : z.factorLento
              ? `; va lenta aun con la carga más baja probada (~${ent(z.usuarios * z.factorLento)} personas)`
              : "; no aguanta ni con la carga más baja probada"
          : "";
      return `• ${z.nombre} (${ent(z.usuarios)} personas, ${ent(z.pagosHora)} mensajes/h): ${estadoTxt(z.estado)}, ${pct(z.completosPct)} % completos, el 95 % en ${seg(z.p95S)}, canal ${pct(z.canalPct)} %, transmite el ${f1(z.txPct, 1)} % del tiempo${lim}${rampa}.`;
    });
    partes.push(`Zona por zona (las personas que entran a la malla por cada nodo):\n${lineas.join("\n")}${zonas.length > 6 ? `\n• y ${zonas.length - 6} zonas más en el panel` : ""}`);
  }
  const pierden = zonas.filter((z) => z.limites.includes("alcance") && z.alcanceCargaKm !== null);
  if (pierden.length) partes.push(`Con esta carga el alcance útil baja: ${pierden.slice(0, 3).map((z) => `${z.nombre} completa solo hasta ${f1(z.alcanceCargaKm!)} km (atiende gente hasta ${f1(z.alcanceKm)} km)`).join("; ")}. Los lejanos llegan más débiles y pierden primero cuando dos señales se pisan.`);
  const energia = r.zonas.filter((z) => z.energia).sort((a, b) => b.energia!.consumoWhDia - a.energia!.consumoWhDia)[0];
  if (energia?.energia) {
    const e = energia.energia;
    partes.push(e.alcanza ? `La energía no es el límite: el repetidor que más trabaja (${energia.nombre}) gasta ~${f1(e.consumoWhDia, 1)} Wh al día y su panel de 5 W repone ~${f1(e.generaWhDia, 0)} Wh; con la batería aguanta ~${f1(e.autonomiaDias, 0)} días sin sol.` : `Ojo con la energía: ${energia.nombre} gastaría ~${f1(e.consumoWhDia, 1)} Wh al día y su panel solo repone ~${f1(e.generaWhDia, 0)} Wh.`);
  }
  if (r.rampa) {
    const q = r.rampa;
    const tramos: string[] = [];
    tramos.push(q.usuariosMax !== null ? `toda la malla aguanta sin demora hasta ~${ent(q.usuariosMax)} personas (${veces(q.factorSeguro!)} la carga)` : "la malla no aguanta ni con la carga más baja probada");
    if (q.factorLento !== null) tramos.push(`desde ${veces(q.factorLento)} va lenta`);
    tramos.push(q.factorQuiebre !== null ? `se revienta desde ${veces(q.factorQuiebre)} (~${ent(r.usuarios * q.factorQuiebre)} personas)` : "con lo probado no se revienta");
    partes.push(`Subiendo la carga: ${tramos.join("; ")}. Esta frecuencia entrega como máximo ~${ent(q.maxEntregadosHora)} mensajes por hora; si se le pide más, los choques se comen el canal y entrega menos.${q.primera ? ` La primera zona en reventarse es ${q.primera}.` : ""}`);
  }
  if (r.ajustes) {
    const otros = r.ajustes.map((a) => `${a.nombre.replace(/^Trama /, "").replace(/ \((alcance|capacidad)\)$/, "")}${a.actual ? " (el de ahora)" : ""}: ${a.conRuta ? `${pct(a.completosPct)} % completos, ${ent(a.conRuta)} con ruta` : "nadie con ruta"}`);
    partes.push(`La misma hora pico con otros ajustes de radio: ${otros.join("; ")}. Más ancho de banda o menos SF: cada mensaje dura menos en el aire y caben más, pero baja el alcance.`);
  }
  if (r.estado !== "aguanta") {
    const consejos = ["repartir los repetidores en las 4 frecuencias del sitio (hasta 4 veces la capacidad)"];
    const p = presetPorId(r.preset.id);
    if (p.anchoBandaKhz === 250 && p.sf > 9) consejos.push(`bajar a SF${p.sf - 1} o SF9 si el alcance lo permite`);
    if (p.anchoBandaKhz < 250) consejos.push("usar 250 kHz (el ajuste de Trama)");
    consejos.push("más sitios gateway para repartir la gente y acortar las rutas");
    if (r.rampa?.usuariosMax) consejos.push(`o menos personas por frecuencia (~${ent(r.rampa.usuariosMax)} en esta red)`);
    partes.push(`Para que aguante: ${consejos.join(", ")}.`);
  }
  if (r.resumenUsuarios?.total) partes.push(textoUsuarios(r));
  if (r.gateway?.modo === "secuencial") partes.push(`El gateway atiende de a uno (lo medido en ${FICHA_GATEWAY.enFrase}): la fila llega a ${seg(r.gateway.esperaP95S)} para el 95 % y está ocupado el ${pct(r.gateway.ocupadoPct)} % del tiempo.`);
  partes.push("Son estimaciones para planear; se validan midiendo el canal en una red piloto.");
  return partes.join("\n");
}

const textoQuePruebo = (o: Partial<OpcionesEstres>) =>
  `${o.rampa ? "Subo la carga de la hora pico (×0,5, ×1, ×2, ×4…) hasta que cada zona se reviente" : "Simulo la hora pico"}${o.horaPicoPct === CAPACIDAD_TRAMA.horaPicoMercadoPct ? " de un día de mercado" : ""}${o.perfil === "medido" ? ` con lo medido en ${FICHA_GATEWAY.enFrase} (comandos de ${FICHA_GATEWAY.mensaje.minimo} a ${FICHA_GATEWAY.mensaje.maximo} caracteres, el gateway atiende de a uno)` : ""}: cada persona manda sus ${f1(o.pagosPersonaDia ?? PAGOS_PERSONA_DIA_TRAMA, 1)} mensajes al día (pagos, WhatsApp y consultas a la IA) y el ${o.horaPicoPct ?? CAPACIDAD_TRAMA.horaPicoNormalPct} % cae en esa hora; mido en cada gateway y repetidor los mensajes completos, la espera, el canal, el ciclo de trabajo, las colas, el alcance con carga y la energía, y a cada persona si le funciona${o.comparar ? ", y repito con los otros ajustes de radio" : ""}`;

/** Después de poner las zonas: simula su conexión y, si se pidió, la prueba de estrés. */
export async function seguirConZonas(pedido: PedidoZonas, estres: Partial<OpcionesEstres> | null, api: Api): Promise<Respuesta> {
  const x = api.poblarZonas(pedido);
  if ("error" in x) return { texto: x.error };
  const r = await api.esperarResultado();
  const conectadas = textoConectadas(r, api);
  if (!estres) return { texto: `${textoZonas(x)} ${conectadas}`, acciones: accionesEstres() };
  const e = await api.probarEstres(estres);
  return { texto: `${textoZonas(x)} ${conectadas}\n\n${e ? textoEstres(e) : "No pude hacer la prueba de estrés (falta simular la red o el motor se detuvo)."}`, acciones: e?.rampa ? undefined : [{ texto: "¿Hasta dónde aguanta cada repetidor?", accion: "orden", orden: { tipo: "estres", opciones: { ...estres, rampa: true } } }] };
}

const accionesEstres = (): Respuesta["acciones"] => [
  { texto: "Probar la hora pico", accion: "orden", orden: { tipo: "estres", opciones: {} } },
  { texto: "¿Hasta dónde aguanta cada repetidor?", accion: "orden", orden: { tipo: "estres", opciones: { rampa: true } } },
];

function ejecutarZonas(o: Extract<Orden, { tipo: "zonas" }>, api: Api): ResultadoOrden {
  const antes = api.instantanea();
  const x = api.poblarZonas(o.pedido);
  if ("error" in x) return { texto: x.error, acciones: [{ texto: "Poner el gateway", accion: "orden", orden: { tipo: "pieza", pieza: "gateway", datos: {} } }] };
  const luego = (async (): Promise<Respuesta> => {
    const r = await api.esperarResultado();
    const conectadas = textoConectadas(r, api);
    if (!o.estres) return { texto: `${conectadas} Ahora puede ver cuánto aguanta cada zona: «prueba de estrés» o «¿hasta cuántos usuarios aguanta cada repetidor?».`, acciones: [...accionesEstres()!, { texto: "Deshacer", accion: "deshacer", escenario: antes }] };
    const e = await api.probarEstres(o.estres);
    return {
      texto: `${conectadas}\n\n${e ? textoEstres(e) : "No pude hacer la prueba de estrés (falta simular la red o el motor se detuvo)."}`,
      acciones: [...(e?.rampa ? [] : [{ texto: "¿Hasta dónde aguanta cada repetidor?", accion: "orden" as const, orden: { tipo: "estres" as const, opciones: { ...o.estres, rampa: true } } }]), { texto: "Deshacer", accion: "deshacer", escenario: antes }],
    };
  })();
  return {
    texto: `Listo: ${textoZonas(x).replace(/^Puse/, "puse")} Cada una lleva su ${presetPorId(api.parametros().preset).protocolo === "meshtastic" ? (api.parametros().usuariosRepiten === false ? "radio Meshtastic (CLIENT_MUTE: no repite)" : "radio Meshtastic (CLIENT: repite lo que oye)") : "billetera (companion: no retransmite)"} a 1,5 m. ${o.estres ? `Simulo la conexión y después: ${textoQuePruebo(o.estres).charAt(0).toLowerCase() + textoQuePruebo(o.estres).slice(1)}. Tardo unos segundos.` : "Simulo cuántas quedan conectadas…"}`,
    deshacer: antes,
    luego,
  };
}

function ejecutarEstres(o: Extract<Orden, { tipo: "estres" }>, api: Api): ResultadoOrden {
  return {
    texto: `${textoQuePruebo(o.opciones)}. Paquete por paquete, como ${PROTOCOLOS[presetPorId(api.parametros().preset).protocolo].nombre}. Tardo unos segundos.`,
    luego: api.probarEstres(o.opciones).then(
      (e): Respuesta =>
        e
          ? {
              texto: textoEstres(e),
              acciones: e.motivo
                ? [{ texto: "Poner 250 personas en cada repetidor", accion: "orden", orden: { tipo: "zonas", pedido: { n: 250 }, estres: { ...o.opciones } } }]
                : e.rampa
                  ? undefined
                  : [{ texto: "¿Hasta dónde aguanta cada repetidor?", accion: "orden", orden: { tipo: "estres", opciones: { ...o.opciones, rampa: true } } }],
            }
          : { texto: "No pude hacer la prueba de estrés (falta simular la red o el motor se detuvo). Intente de nuevo en un momento." },
    ),
  };
}

/* ───────────── Límite de un punto ───────────── */

/** «¿Cuántas personas aguanta el Repetidor 1?», «el límite del gateway», «hasta qué punto soporta este repetidor». */
const PIDE_LIMITE = /\b(limite|maximo|maxima|tope|hasta (que|donde) punto|hasta cuant\w*|cuant\w* (personas|usuarios|gente|billeteras|clientes)\b.*\b(aguant\w*|soport\w*|resist\w*|caben|cabe|puede|atiende))\b/;
/** «Llena el Repetidor 2 hasta su límite», «pon en el gateway el máximo de personas que aguante». */
const PIDE_LLENAR = /\b(llen\w*|pon\w*|agreg\w*|anad\w*|mete\w*|carg\w*|complet\w*|coloca\w*)\b.*\b(limite|maximo|maxima|tope|lo que (aguante|soporte|resista|pueda)|(todas )?las que (aguante|soporte|quepan|resista))\b/;

function interpretarLimite(texto: string, tn: string, api: Api): Orden | null {
  if (!PIDE_LIMITE.test(tn) && !PIDE_LLENAR.test(tn)) return null;
  // Tiene que hablar de gente o de aguantar («el límite de saltos» o «la altura máxima» son otra cosa)
  if (/\blimite de saltos\b|\baltura maxima\b|\bmaximo \d+ (repetidores|antenas|sitios)\b/.test(tn)) return null;
  if (!/\b(personas?|usuari\w*|gente|billeteras?|clientes?|aguant\w*|soport\w*|resist\w*|popularidad|zona|capacidad|caben|llen\w*)\b/.test(tn)) return null;
  if (/^(que|como|para que|por que)\s+(es|son|significa)\b/.test(tn)) return null;
  const centros = api.centrosZona();
  const nombrados = centrosNombrados(tn, centros);
  let elegidos: string[] | undefined;
  if (nombrados.length) elegidos = nombrados.map((c) => c.id);
  else if (/\b(este|ese|esta|esa|el seleccionado|la seleccionada)\s+(punto|repetidor|nodo|antena|gateway|torre)\b/.test(tn)) {
    const sel = api.seleccion();
    if (!sel || !centros.some((c) => c.id === sel)) return null;
    elegidos = [sel];
  } else if ((CADA.test(tn) || /\bcada\s+(punto|nodo|antena|repetidor\w*|torre|gateway|sitio|zona)\b|\b(todos|todas)\s+(los|las)\s+(puntos|nodos|antenas|repetidores|zonas)\b/.test(tn)) && /\b(limite|maximo|maxima|tope)\b/.test(tn)) elegidos = undefined;
  else return null;
  const gente = tn.match(new RegExp(`${NUM}\\s*${GENTE}`));
  const n = gente ? Math.min(MAX_POR_ZONA, Math.max(1, Math.round(numero(`${gente[1]}${gente[2] ? " mil" : ""}`)))) : undefined;
  const km = tn.match(/\b(?:a|en|dentro de|en un radio de|radio de)\s+(\d{1,2}(?:[.,]\d+)?)\s*(?:km|kilometros?)\b/);
  const opciones = opcionesEstres(tn);
  delete opciones.rampa;
  delete opciones.comparar;
  return { tipo: "limite", centros: elegidos, n, radioKm: km ? Math.min(20, Math.max(0.2, numero(km[1]))) : undefined, llenar: PIDE_LLENAR.test(tn), opciones };
}

/** Lo que pasó con la red completa en la última prueba (una línea). */
const lineaRed = (e: ResultadoEstres | null) =>
  e && !e.motivo ? ` La red completa en la hora pico: ${pct(e.completosPct)} % de los mensajes con respuesta, el 95 % en menos de ${seg(e.p95S)}, canal del gateway al ${pct(e.canalGatewayPct)} %.` : "";

function ejecutarLimite(o: Extract<Orden, { tipo: "limite" }>, api: Api): ResultadoOrden {
  const antes = api.instantanea();
  const centros = api.centrosZona();
  if (!centros.length) return { texto: "Ponga primero el gateway y los repetidores: cada punto es uno de ellos.", acciones: [{ texto: "Poner el gateway", accion: "orden", orden: { tipo: "pieza", pieza: "gateway", datos: {} } }] };
  const radioKm = o.radioKm ?? ZONA_DEFECTO.radioKm;
  const como = "subo la gente de ese punto, con el resto de la red como está, y simulo la hora pico paquete por paquete con todos enviando información (pagos, WhatsApp y consultas a la IA)";
  const deshacer = { texto: "Deshacer", accion: "deshacer" as const, escenario: antes };
  const uno = o.centros?.length === 1 ? centros.find((c) => c.id === o.centros![0]) : null;
  if (uno) {
    const muestra = !uno.personas ? ` Como no tiene gente, primero pongo ${ent(o.n ?? MUESTRA_PUNTO)} de muestra a ${f1(radioKm, radioKm % 1 ? 1 : 0)} km.` : "";
    return {
      texto: `${o.llenar ? `Busco cuántas personas aguanta ${uno.nombre} y lo lleno hasta ese límite` : `Busco cuántas personas aguanta ${uno.nombre}`}: ${como}.${muestra} Tardo unos segundos.`,
      deshacer: antes,
      luego: api.evaluarPunto({ centro: uno.id, accion: o.llenar ? "llenar" : "limite", n: o.n, radioKm, opciones: o.opciones }).then((x): Respuesta => {
        if (x.error || !x.limite) return { texto: x.error ?? "No pude buscar el límite.", acciones: [deshacer] };
        const l = x.limite;
        const seguro = !l.motivo && !l.redYaFalla && l.personasSeguro !== null ? Math.min(MAX_POR_ZONA, l.personasSeguro) : null;
        const acciones: Respuesta["acciones"] = [];
        if (!o.llenar && seguro !== null) acciones.push({ texto: `Llenar ${uno.nombre} hasta el límite (${ent(seguro)})`, accion: "orden", orden: { tipo: "limite", centros: [uno.id], n: seguro, radioKm, llenar: true, opciones: o.opciones } });
        acciones.push({ texto: "¿Hasta dónde aguanta toda la malla?", accion: "orden", orden: { tipo: "estres", opciones: { ...o.opciones, rampa: true } } }, deshacer);
        return { texto: `${textoLimite(l)}${l.llenado ? ` ${textoLlenado(l)}${lineaRed(x.estres)}` : ""}\nSon estimaciones para planear; se validan midiendo el canal en una red piloto.`, acciones };
      }),
    };
  }
  const lista = o.centros?.length ? centros.filter((c) => o.centros!.includes(c.id)) : centros;
  return {
    texto: `Busco el límite de ${lista.length === 1 ? lista[0].nombre : `cada punto (${lista.length})`}, uno a la vez: ${como}.${lista.some((c) => !c.personas) ? ` A los que no tienen gente les pongo primero ${ent(o.n ?? MUESTRA_PUNTO)} de muestra.` : ""}${o.llenar ? " Después los lleno hasta su límite y pruebo toda la red junta." : ""} Tardo unos segundos.`,
    deshacer: antes,
    luego: (async (): Promise<Respuesta> => {
      const x = await api.evaluarPuntos({ centros: o.centros, n: o.n, radioKm, opciones: o.opciones });
      if (x.error || !x.limites.length) return { texto: x.error ?? "No pude buscar los límites.", acciones: [deshacer] };
      const partes = [`Límite de cada punto (uno a la vez, con los demás como están):\n${x.limites.map((l) => `• ${textoLimite(l, true)}`).join("\n")}`];
      if (o.llenar) {
        const llenables = x.limites.filter((l) => !l.motivo && !l.redYaFalla && l.personasSeguro !== null);
        for (const l of llenables) api.poblarZonas({ centros: [l.id], n: Math.min(MAX_POR_ZONA, l.personasSeguro!), radioKm });
        await api.esperarResultado();
        const e = await api.probarEstres({ ...o.opciones, rampa: true });
        if (e && !e.motivo) {
          partes.push(
            `Llené ${llenables.length === 1 ? "el punto" : `los ${llenables.length} puntos`} hasta su límite al mismo tiempo (${ent(llenables.reduce((s, l) => s + Math.min(MAX_POR_ZONA, l.personasSeguro!), 0))} personas): ${e.estado === "revienta" ? "juntos se revienta" : e.estado === "lento" ? "juntos aguanta, pero lento" : "juntos aguanta"} (${pct(e.completosPct)} % de los mensajes con respuesta), porque comparten el canal.${e.rampa?.usuariosMax !== null && e.rampa?.usuariosMax !== undefined ? ` Para que toda la malla quede estable a la vez: ~${ent(e.rampa.usuariosMax)} personas en total.` : ""}`,
          );
        }
      } else partes.push("Si todos se llenan a la vez comparten el canal y aguantan menos: «¿hasta dónde aguanta toda la malla?» lo mide con la red subiendo junta.");
      partes.push("Son estimaciones para planear; se validan midiendo el canal en una red piloto.");
      return {
        texto: partes.join("\n"),
        acciones: [...(o.llenar ? [] : [{ texto: "Llenar cada punto hasta su límite", accion: "orden" as const, orden: { tipo: "limite" as const, centros: o.centros, radioKm, llenar: true, opciones: o.opciones } }]), { texto: "¿Hasta dónde aguanta toda la malla?", accion: "orden" as const, orden: { tipo: "estres" as const, opciones: { ...o.opciones, rampa: true } } }, deshacer],
      };
    })(),
  };
}

/* ───────────── Dimensionamiento de Trama ───────────── */

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Nombres que se confunden: van primero («Norte de Santander» antes que «Santander», «Valle del Cauca» antes que «Cauca»). */
const CLAVES_DEPTO: [string, RegExp][] = [
  ["nsantander", /\bnorte de santander\b/],
  ["valle", /\bvalle del cauca\b|\b(el|del|al) valle\b/],
  ["guajira", /\bguajira\b/],
  ["sanandres", /\bsan andres\b/],
  ["bogota", /\bbogota\b/],
  // «la meta del 99 %» no es el departamento
  ["meta", /\b(el|del|al|en) meta\b(?! del? \d)|\bdepartamento del meta\b/],
  ...DEPARTAMENTOS_TRAMA.filter((d) => !["nsantander", "valle", "guajira", "sanandres", "bogota", "meta"].includes(d.id)).map((d): [string, RegExp] => [d.id, new RegExp(`\\b${sinTildes(d.nombre)}\\b`)]),
];

function departamentoEn(tn: string) {
  for (const [id, re] of CLAVES_DEPTO) if (re.test(tn)) return DEPARTAMENTOS_TRAMA.find((d) => d.id === id) ?? null;
  return null;
}

function sfEn(tn: string, p: Parametros): SfTrama {
  const m = tn.match(/\bsf\s?(9|10|11)\b/);
  if (m) return Number(m[1]) as SfTrama;
  const preset = presetPorId(p.preset);
  return preset.anchoBandaKhz === 250 && preset.sf >= 9 && preset.sf <= 11 ? (preset.sf as SfTrama) : 11;
}

const nodoEn = (tn: string): NodoUsuario => (/\b(t1000|t 1000|tarjeta)\b/.test(tn) ? "t1000" : "xiao");

function terrenoEn(tn: string): TerrenoTrama | null {
  if (/\b(selva cerrada|selva)\b/.test(tn) && !/\brios?\b/.test(tn)) return "selva";
  if (/\brios?\b|\bribera\w*|\briberen\w*/.test(tn)) return "rios";
  if (/\b(montana\w*|cordillera|ladera\w*|andin\w*)\b/.test(tn)) return "montana";
  if (/\b(sabana\w*|llano\w*|llanura)\b/.test(tn)) return "sabana";
  if (/\b(plano|semidesierto|desierto)\b/.test(tn)) return "plano";
  return null;
}

function interpretarTrama(texto: string, tn: string, api: Api): Orden | null {
  const pideCosto = /\b(cuanto (cuesta|vale|sale|costaria|valdria|saldria)|costo|costos|presupuesto|inversion|dimension\w*|cuant\w* (repetidores|sitios|torres|starlink|radios|gateways)|que se necesita|que necesito|cuanta infraestructura|cubrir|cubriria|llevar la red|red de pagos|red de comunicacion)\b/.test(tn);
  if (!pideCosto) return null;
  const p = api.parametros();
  const sf = sfEn(tn, p);
  const nodo = nodoEn(tn);
  const adop = tn.match(/(\d{1,3})\s*(?:%|por ciento)?\s*(?:de )?(?:adopcion|de la gente|de los adultos)/) ?? tn.match(/adopcion (?:del?|de un)?\s*(\d{1,3})/);
  const adopcionPct = adop ? Math.min(100, Math.max(1, Number(adop[1]))) : 30;
  if (/\b(todo el pais|toda colombia|colombia entera|en colombia|a colombia|el pais|nivel nacional|nacional)\b/.test(tn) && !departamentoEn(tn)) return { tipo: "trama-departamento", id: "colombia", adopcionPct, sf, nodo };
  const dep = departamentoEn(tn);
  if (dep) return { tipo: "trama-departamento", id: dep.id, adopcionPct, sf, nodo };
  // «¿Cuánto cuesta la red para 5.000 usuarios en 2.000 km² de sabana?»
  const us = tn.match(new RegExp(`${NUM}\\s*${GENTE}`));
  if (!us) return null;
  const usuarios = numero(`${us[1]}${us[2] ? " mil" : ""}`);
  const area = texto.toLowerCase().match(/(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(km\s*2|km²|kil[oó]metros? cuadrados?|hect[aá]reas?|ha\b)/);
  const areaKm2 = area ? numero(area[1]) / (/^h/.test(area[2]) ? 100 : 1) : null;
  return { tipo: "trama-dimensionar", usuarios, areaKm2, terreno: terrenoEn(tn) ?? "sabana", sf, nodo };
}

function textoDimension(d: Dimension, titulo: string, sf: SfTrama, nodo: NodoUsuario, terreno: string): string {
  const nodoTxt = nodo === "t1000" ? "T1000-E" : "XIAO ESP32S3 + Wio-SX1262";
  return [
    `${titulo}: ${ent(d.usuarios)} usuarios en ${ent(d.areaKm2)} km² (${terreno}, SF${sf}, billetera ${nodoTxt}).`,
    `Cada repetidor cubre ~${f1(d.radioKm)} km de radio (${ent(d.celdaKm2)} km² por celda hexagonal); manda la ${d.manda}.`,
    `Se necesitan ${ent(d.repetidores)} repetidores solares (P1 + antena 8 dBi en tubo de 6 m), ${ent(d.sitios)} ${d.sitios === 1 ? "sitio gateway" : "sitios gateway"} (torre de 12 m, mini PC N100 y hasta 4 radios Heltec T114), ${ent(d.radios)} radios de gateway, ${ent(d.starlinks)} Starlink y ${ent(d.enlaces)} enlaces WiFi punto a punto.`,
    `Inversión: ${pesosTrama(d.costo.total)} (sitios ${pesosTrama(d.costo.sitios)}, radios ${pesosTrama(d.costo.radios)}, repetidores ${pesosTrama(d.costo.repetidores)}, internet ${pesosTrama(d.costo.internet)}, billeteras ${pesosTrama(d.costo.nodos)}, instalación ${pesosTrama(d.costo.instalacion)} y transporte ${pesosTrama(d.costo.transporte)}); ${pesosTrama(d.porUsuario)} por usuario.`,
    `Operación: ${pesosTrama(d.mensual)} al mes (${pesosTrama(d.mensualPorUsuario)} por usuario); con la inversión pagada en ${OPERACION_TRAMA.aniosInversion} años, ${pesosTrama(d.totalMesPorUsuario)} por usuario al mes.`,
    "Son cuentas de planeación del documento de Trama; el diseño fino sale de simular el relieve real aquí.",
  ].join(" ");
}

function ejecutarTrama(o: Extract<Orden, { tipo: "trama-departamento" | "trama-dimensionar" }>, api: Api): ResultadoOrden {
  if (o.tipo === "trama-dimensionar") {
    const area = o.areaKm2 ?? api.areasPoblar().find((x) => x.objetivo)?.km2 ?? null;
    if (!area) return { texto: `Para dimensionar ${ent(o.usuarios)} usuarios necesito el área: dígame, por ejemplo, «${ent(o.usuarios)} usuarios en 800 km² de sabana», o marque el área objetivo con la regla.` };
    const t = TERRENOS_TRAMA[o.terreno];
    const d = dimensionarTrama({ usuarios: o.usuarios, areaKm2: area, terreno: o.terreno, sf: o.sf, nodo: o.nodo, logistica: 1, solar: 1 });
    return { texto: textoDimension(d, "Dimensionamiento de Trama", o.sf, o.nodo, t.nombre.toLowerCase()) };
  }
  if (o.id === "colombia") {
    const total = DEPARTAMENTOS_TRAMA.map((d) => dimensionarDepartamento(d, o.adopcionPct, o.sf, o.nodo));
    const suma = (k: (x: Dimension) => number) => total.reduce((s, x) => s + k(x), 0);
    return {
      texto: `Colombia con el ${o.adopcionPct} % de los adultos rurales sin canal digital (SF${o.sf}): ${ent(suma((x) => x.usuarios))} usuarios, ${ent(suma((x) => x.repetidores))} repetidores, ${ent(suma((x) => x.sitios))} sitios gateway, ${ent(suma((x) => x.radios))} radios y ${ent(suma((x) => x.starlinks))} Starlink. Inversión ${pesosTrama(suma((x) => x.costo.total))}; operación ${pesosTrama(suma((x) => x.mensual))} al mes. Pregúnteme por un departamento para ver su detalle, por ejemplo «¿cuánto cuesta la red para el Chocó?».`,
    };
  }
  const dep = DEPARTAMENTOS_TRAMA.find((x) => x.id === o.id)!;
  const d = dimensionarDepartamento(dep, o.adopcionPct, o.sf, o.nodo);
  const sinCanal = `${ent(dep.sinCanal[0])} a ${ent(dep.sinCanal[1])}`;
  const contexto = `${dep.nombre} (${dep.region}, puesto ${dep.puesto} de 33 por adultos sin canal digital): ${ent(dep.rurales)} personas rurales, ${sinCanal} adultos sin canal digital; el ${f1(100 - dep.ruralUsaInternetPct, 1)} % de la población rural no usó internet. Se cubre el ${Math.round(dep.fraccion * 100)} % del área habitada (${ent(dep.areaKm2 * dep.fraccion)} de ${ent(dep.areaKm2)} km²).${dep.nota ? ` ${dep.nota}` : ""}`;
  return { texto: `${contexto} ${textoDimension(d, `Con el ${o.adopcionPct} % de adopción`, o.sf, o.nodo, TERRENOS_TRAMA[dep.terreno].nombre.toLowerCase())}` };
}

/* ───────────── Entrada única ───────────── */

/** Órdenes de población, capacidad y dimensionamiento de Trama (null si el texto no es de esto). */
/* ───────────── Persona por persona y optimización para la carga ───────────── */

/** «¿Qué usuarios no funcionan?», «¿a quiénes no les funciona?», «¿quiénes tienen dificultades?». */
function interpretarUsuarios(tn: string): Orden | null {
  const pide =
    /\b(que|cuales|cuantos?|cuantas|quienes|a quienes|a cuales)\s+(usuarios?|personas?|clientes?|billeteras?)?\s*(no\s+(les?\s+)?(funciona\w*|sirve\w*)|tienen (dificultad\w*|problemas?)|fallan|estan mal|les va mal|funcionan|les funciona)\b/.test(tn) ||
    /\b(usuarios?|personas?|clientes?) (que|a los que|a las que) no (les )?(funciona\w*|sirve\w*)\b/.test(tn) ||
    /\b(usuario por usuario|persona por persona|cada (usuario|persona) (en|de) la prueba)\b/.test(tn);
  if (!pide) return null;
  return { tipo: "usuarios-estres", opciones: opcionesEstres(tn) };
}

/** «Optimiza la red para la carga», «recomiéndame gateways de apoyo», «¿qué hago para que aguante la hora pico?». */
function interpretarOptimizar(tn: string): Orden | null {
  if (/\b(aplic\w*|acept\w*|pon\w*|hazl[oa])\b.*\b(optimizacion|propuesta de optimizacion|lo que propusiste|la propuesta|todo junto|esa propuesta|esa mejora)\b/.test(tn) && !/\b(ajuste|factible)\b/.test(tn)) {
    const n = tn.match(/\b(primera|segunda|tercera|cuarta|1|2|3|4)\b/);
    const indice = n ? ({ primera: 0, segunda: 1, tercera: 2, cuarta: 3, "1": 0, "2": 1, "3": 2, "4": 3 } as Record<string, number>)[n[1]] : -1;
    return { tipo: "aplicar-optimizacion", indice, combinada: /\btodo junto|todas|combinad\w*\b/.test(tn) };
  }
  const apoyo = /\b(gateways? de (apoyo|respaldo)|getways? de (apoyo|pollo|respaldo)|gateway (extra|adicional) para (la )?carga)\b/.test(tn);
  const verbo = /\b(optimiz\w*|mejor\w*|arregl\w*|descongestion\w*|desatur\w*|recomiend\w*|propon\w*|sugi\w*|que hago|como hago|como logro|que necesito|que le falta)\b/.test(tn);
  const carga = /\b(carga|cargad\w*|estres\w*|saturad\w*|sobrecargad\w*|congestion\w*|popularidad|hora pico|trafico|capacidad|aguant\w*|colaps\w*|revient\w*|no les? funciona|dificultades|usuarios|personas)\b/.test(tn);
  if (apoyo || (verbo && carga && !/\b(cobertura|factible|costo|barat\w*)\b/.test(tn))) {
    if (/^(que|como|para que|por que)\s+(es|son|significa)\b/.test(tn)) return null;
    return { tipo: "optimizar", opciones: opcionesEstres(tn) };
  }
  return null;
}

export function interpretarCapacidad(texto: string, tn: string, api: Api): Orden | null {
  return interpretarOptimizar(tn) ?? interpretarUsuarios(tn) ?? interpretarLimite(texto, tn, api) ?? interpretarZonas(texto, tn, api) ?? interpretarEstres(texto, tn) ?? interpretarCarga(texto, tn) ?? interpretarPoblar(texto, tn, api) ?? interpretarTrama(texto, tn, api);
}

/** Las personas que peor la pasan, con su causa. */
function textoPeores(r: ResultadoEstres, n = 5): string {
  const malos = (r.porUsuario ?? []).filter((u) => u.estado !== "bien" && u.estado !== "funciona").sort((a, b) => a.exitoPct - b.exitoPct);
  if (!malos.length) return "";
  return `Las que peor la pasan:\n${malos
    .slice(0, n)
    .map((u) => `• ${u.nombre}: ${ESTADOS_USUARIO[u.estado].nombre.toLowerCase()}, le vuelve el ${pct(u.exitoPct)} % y espera hasta ${seg(u.esperaP95S)}${u.causa ? ` (${CAUSAS_USUARIO[u.causa]})` : ""}. ${u.porque}`)
    .join("\n")}${malos.length > n ? `\n• y ${ent(malos.length - n)} más (en el mapa, con el contorno de su color)` : ""}`;
}

function ejecutarUsuarios(o: Extract<Orden, { tipo: "usuarios-estres" }>, api: Api): ResultadoOrden {
  const ya = !Object.keys(o.opciones).some((k) => (o.opciones as Record<string, unknown>)[k]) ? (api.estres?.() ?? null) : null;
  const responder = (e: ResultadoEstres | null): Respuesta =>
    !e
      ? { texto: "No pude hacer la prueba de la hora pico (falta simular la red o el motor se detuvo)." }
      : e.motivo
        ? { texto: e.motivo, acciones: [{ texto: "Poner 250 personas en cada repetidor", accion: "orden", orden: { tipo: "zonas", pedido: { n: 250 }, estres: {} } }] }
        : {
            texto: `${textoUsuarios(e)}\n${textoPeores(e)}\nEn el mapa cada persona lleva el color de su estado en el contorno: verde oscuro le funciona bien, verde claro le funciona, amarillo a medias, naranja con dificultades y rojo no le funciona.`,
            acciones: e.resumenUsuarios.funcionanPct < 95 ? [{ texto: "Optimizar la red para esta carga", accion: "orden", orden: { tipo: "optimizar", opciones: {} } }] : undefined,
          };
  if (ya) return { texto: responder(ya).texto, acciones: responder(ya).acciones };
  return { texto: `${textoQuePruebo(o.opciones)}. Después le digo persona por persona a quién le funciona y a quién no.`, luego: api.probarEstres(o.opciones).then(responder) };
}

function accionesOptimizacion(x: ResultadoOptimizar): Respuesta["acciones"] {
  const acciones: NonNullable<Respuesta["acciones"]> = [];
  if (x.combinada) acciones.push({ texto: "Aplicar todo junto", accion: "orden", orden: { tipo: "aplicar-optimizacion", indice: -1, combinada: true } });
  const primera = x.propuestas.findIndex((p) => p.aplicable);
  if (primera >= 0) acciones.push({ texto: `Aplicar «${x.propuestas[primera].titulo}»`, accion: "orden", orden: { tipo: "aplicar-optimizacion", indice: primera, combinada: false } });
  return acciones.length ? acciones : undefined;
}

function ejecutarOptimizar(o: Extract<Orden, { tipo: "optimizar" }>, api: Api): ResultadoOrden {
  if (!api.optimizarRed) return { texto: "La optimización no está disponible en esta pantalla." };
  const p = presetPorId(api.parametros().preset);
  return {
    texto: `Busco cómo hacer que la red aguante esta carga (${PROTOCOLOS[p.protocolo].nombre}): miro a quién no le funciona y por qué, y pruebo gateways de apoyo, antenas de apoyo y ajustes del protocolo, cada uno con la misma carga, paquete por paquete. Tardo unos segundos.`,
    luego: api.optimizarRed(o.opciones).then((x): Respuesta => {
      if (!x) return { texto: "No pude optimizar la red (falta simular o el motor se detuvo). Intente de nuevo en un momento." };
      const otras = x.propuestas.slice(x.combinada ? 0 : 1, 4).map((p) => `• ${textoPropuesta(p)}`);
      return { texto: `${textoOptimizacion(x)}${otras.length ? `\nOtras que ayudan:\n${otras.join("\n")}` : ""}`, acciones: accionesOptimizacion(x) };
    }),
  };
}

function ejecutarAplicarOptimizacion(o: Extract<Orden, { tipo: "aplicar-optimizacion" }>, api: Api): ResultadoOrden {
  const x = api.optimizacion?.() ?? null;
  if (!x || !api.aplicarOptimizacion) return { texto: "No tengo una optimización al día para aplicar. Pídame «optimiza la red para la carga».", acciones: [{ texto: "Optimizar la red para esta carga", accion: "orden", orden: { tipo: "optimizar", opciones: {} } }] };
  const pr = o.combinada && x.combinada ? x.combinada : o.indice >= 0 ? x.propuestas[o.indice] : (x.combinada ?? x.propuestas.find((p) => p.aplicable));
  if (!pr) return { texto: "Esa propuesta no está en la lista." };
  if (!pr.aplicable) return { texto: `«${pr.titulo}» se hace en campo, no en el mapa: ${pr.que}` };
  const antes = api.instantanea();
  return {
    texto: `Aplico «${pr.titulo}» y vuelvo a probar la hora pico con la red nueva…`,
    deshacer: antes,
    luego: api.aplicarOptimizacion(pr).then((ok): Respuesta => {
      const e = ok ? (api.estres?.() ?? null) : null;
      return {
        texto: ok ? `Listo: apliqué «${pr.titulo}». ${e && !e.motivo ? textoUsuarios(e) : ""}` : "No pude aplicar la propuesta.",
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
      };
    }),
  };
}

export function ejecutarCapacidad(
  o: Extract<Orden, { tipo: "poblar" | "quitar-pobladas" | "carga" | "zonas" | "quitar-zonas" | "estres" | "limite" | "trama-departamento" | "trama-dimensionar" | "optimizar" | "aplicar-optimizacion" | "usuarios-estres" }>,
  api: Api,
): ResultadoOrden {
  switch (o.tipo) {
    case "optimizar":
      return ejecutarOptimizar(o, api);
    case "aplicar-optimizacion":
      return ejecutarAplicarOptimizacion(o, api);
    case "usuarios-estres":
      return ejecutarUsuarios(o, api);
    case "limite":
      return ejecutarLimite(o, api);
    case "zonas":
      return ejecutarZonas(o, api);
    case "quitar-zonas": {
      const antes = api.instantanea();
      const n = api.quitarZonas(o.centros);
      return n ? { texto: `Listo: quité ${o.centros?.length === 1 ? "la zona de popularidad" : "las zonas de popularidad"} (${ent(n)} personas).`, deshacer: antes, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }] } : { texto: "No hay zonas de popularidad que quitar." };
    }
    case "estres":
      return ejecutarEstres(o, api);
    case "poblar":
      return ejecutarPoblar(o, api);
    case "quitar-pobladas": {
      const antes = api.instantanea();
      const n = api.quitarPobladas();
      return n ? { texto: `Listo: quité las ${ent(n)} personas pobladas al azar. Las que puso a mano siguen ahí.`, deshacer: antes, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }] } : { texto: "No hay personas pobladas al azar que quitar." };
    }
    case "carga":
      return ejecutarCarga(o, api);
    default:
      return ejecutarTrama(o, api);
  }
}
