// Órdenes para Melki: entiende pedidos en español con coordenadas (decimales o en grados, minutos y segundos)
// y los ejecuta en el simulador: inscribir, mover, editar o borrar nodos, cambiar parámetros, simular, ir a un lugar,
// medir distancias, ver perfiles y la señal en un punto. Todo se procesa aquí mismo, sin servicios externos.
import { PRESETS, presetPorId, type PresetId } from "@/lib/radio/constantes";
import { entornoPorId, perdidaEntorno } from "@/lib/radio/entorno";
import { consejoRed, type EstadoRed, type Pieza } from "@/lib/radio/estado-red";
import type { ViajeMensaje } from "@/lib/radio/mensaje";
import type { DestinoSiembra, Siembra } from "@/lib/radio/siembra";
import { aDecimal, aGMS, distanciaM, formatoDistancia, leerCoordenada, puntoCardinal, rumbo, rumboTexto } from "@/lib/radio/geo";
import type { ClimaItm } from "@/lib/radio/itm";
import { anchosHaz, esDireccional, patronPorId } from "@/lib/radio/patron";
import { CLIMAS, CONFIABILIDADES, RED_REFERENCIA, SUELOS, VARIABILIDADES } from "@/lib/radio/red";
import type { Antena, EntornoId, Escenario, Medicion, Parametros, PatronId, ResultadoSimulacion, SueloId, TipoNodo, VariabilidadId } from "@/lib/radio/tipos";
import { textoNivel, uvADbm, type UnidadId } from "@/lib/radio/unidades";
import type { Lugar } from "@/lib/geo/referencia";

import type { EscalaSenal, ModoApp, Vista } from "../simulador/estado";
import type { Respuesta } from "./cerebro";

/** Cambios de la vista que Melki puede pedir (unidad y escala de colores del mapa de señal). */
export type CambiosVista = Partial<Pick<Vista, "unidad" | "escala" | "escalaMinDbm" | "escalaMaxDbm" | "umbralDbm" | "modo" | "animarRed">>;

export type Coordenada = { lat: number; lon: number; corregido?: boolean };

type DatosNodo = Partial<Pick<Antena, "nombre" | "alturaM" | "gananciaDbi" | "potenciaDbm" | "pasarela" | "tipo" | "patron" | "azimutDeg" | "elevacionDeg" | "equipo">>;

export type Orden =
  | { tipo: "agregar"; coord?: Coordenada; datos: DatosNodo }
  | { tipo: "mover"; id: string; coord?: Coordenada }
  | { tipo: "eliminar"; id: string }
  | { tipo: "renombrar"; id: string; nombre: string }
  | { tipo: "editar"; id: string; cambios: Partial<Antena>; descripcion: string }
  | { tipo: "parametros"; cambios: Partial<Parametros>; descripcion: string }
  | { tipo: "vista"; cambios: CambiosVista; descripcion: string }
  | { tipo: "informe"; a: string; b: Referencia }
  | { tipo: "apuntar-omni"; id: string; azimutDeg: number; destino?: string }
  | { tipo: "simular" }
  | { tipo: "ir"; coord?: Coordenada; lugar?: Lugar; id?: string; consulta?: string }
  | { tipo: "distancia"; a: Referencia; b: Referencia }
  | { tipo: "perfil"; a: string; b: Referencia }
  | { tipo: "senal"; coord: Coordenada }
  | { tipo: "donde"; ref: Referencia }
  | { tipo: "listar" }
  | { tipo: "herramienta"; herramienta: "regla" | "inspeccionar" | "agregar" }
  | { tipo: "ejemplo" }
  | { tipo: "nuevo"; confirmado?: boolean }
  | { tipo: "exportar"; formato: "kmz" | "json" | "csv" }
  | { tipo: "borrar-mediciones" }
  | { tipo: "coordenada-sola"; coord: Coordenada }
  /* Modo «Sembrar la malla» */
  | { tipo: "pieza"; pieza: Pieza; coord?: Coordenada; datos: DatosNodo; mover?: boolean }
  | { tipo: "sembrar"; destino: "faltantes" | { coord: Coordenada; nombre: string } | { id: string } }
  | { tipo: "aceptar-siembra" }
  | { tipo: "descartar-siembra" }
  | { tipo: "mensaje"; id?: string }
  | { tipo: "modo"; modo: ModoApp }
  | { tipo: "ejemplo-malla" }
  | { tipo: "que-hago" };

export type Referencia = { tipo: "nodo"; id: string } | { tipo: "coord"; coord: Coordenada };

export type Pendiente = { tipo: "agregar"; datos: DatosNodo } | { tipo: "mover"; id: string } | { tipo: "pieza"; pieza: Pieza; datos: DatosNodo } | null;

export type Api = {
  antenas(): Antena[];
  parametros(): Parametros;
  seleccion(): string | null;
  resultado(): ResultadoSimulacion | null;
  instantanea(): Escenario;
  agregar(datos: DatosNodo & { lat: number; lon: number }): Antena;
  editar(id: string, cambios: Partial<Antena>): void;
  eliminar(id: string): void;
  parametrosCambiar(cambios: Partial<Parametros>): void;
  simular(): void;
  centrar(lat: number, lon: number, zoom?: number): void;
  encuadrarCaja(caja: [number, number, number, number]): void;
  marcar(lat: number, lon: number, titulo: string): void;
  medir(m: Medicion): void;
  perfil(a: Antena, b: Antena | { lat: number; lon: number }, informe?: boolean): void;
  vista(cambios: CambiosVista): void;
  senal(lat: number, lon: number): void;
  herramienta(h: "regla" | "inspeccionar" | "agregar"): void;
  ejemplo(): void;
  nuevo(): void;
  exportar(f: "kmz" | "json" | "csv"): boolean;
  borrarMediciones(): void;
  ubicacion(lat: number, lon: number): string | null;
  buscarLugar(texto: string): Lugar[];
  /* Modo «Sembrar la malla» */
  modo(): ModoApp;
  cambiarModo(m: ModoApp): void;
  /** Pone una pieza (gateway, repetidor o persona) con sus valores de Trama. */
  ponerPieza(pieza: Pieza, lat: number, lon: number, datos?: DatosNodo): Antena;
  /** Arma la herramienta para poner la pieza con un clic en el mapa. */
  armarPieza(pieza: Pieza): void;
  /** Estado de la red frente al gateway (con la última simulación). */
  red(): EstadoRed;
  /** Propone repetidores hacia los destinos (sembrado automático). */
  sembrar(destinos: DestinoSiembra[]): Promise<Siembra | null>;
  propuesta(): Siembra | null;
  /** Pone los repetidores propuestos; devuelve cuántos nodos puso. */
  aceptarSiembra(): number;
  descartarSiembra(): void;
  /** Envía un mensaje desde ese nodo hasta el gateway y lo anima en el mapa (null si falta simular). */
  enviarMensaje(desdeId: string): ViajeMensaje | null;
  ejemploMalla(): void;
};

const n = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,\-°'"\s]/g, " ")
    .replace(/\bnodo\s*-?\s*antena(s?)\b/g, "nodo antena$1")
    .replace(/\s+/g, " ")
    .trim();
const num = (s: string) => Number(s.replace(",", "."));
const f1 = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
/** Número sin decimales si es entero (20 m), con uno si no (1,5 m). */
const fn = (x: number) => (Number.isInteger(x) ? String(x) : f1(x));

/* ───────────── Coordenadas en texto libre ───────────── */

function ajustarColombia(lat: number, lon: number, conHemisferio: boolean): Coordenada | null {
  let corregido = false;
  // Longitud primero: «-73,12, 4,51»
  if (Math.abs(lat) > 20 && Math.abs(lat) <= 82 && Math.abs(lon) <= 14) [lat, lon] = [lon, lat];
  // Longitud sin signo en Colombia: se toma al oeste
  if (!conHemisferio && lon >= 66 && lon <= 82 && lat >= -5 && lat <= 14) {
    lon = -lon;
    corregido = true;
  }
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return { lat, lon, corregido };
}

/** Busca una coordenada (latitud y longitud) dentro de un texto. */
export function extraerCoordenadas(texto: string): Coordenada | null {
  const t = texto.replace(/[’′´`]/g, "'").replace(/[”″“]/g, '"').replace(/''/g, '"').replace(/º/g, "°");
  // 1) Grados, minutos y segundos: 4°30'44,3" N 73°07'24" O
  const gms = /(-?\d{1,3})\s*°\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*'\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*"\s*)?\s*(norte|sur|oeste|occidente|este|[NSEOW](?![a-zA-Z]))?/gi;
  const partes = [...t.matchAll(gms)];
  if (partes.length >= 2) {
    const valores = partes.slice(0, 2).map((m) => {
      const h = (m[4] ?? "").toUpperCase();
      const hem = h.startsWith("NORTE") ? "N" : h.startsWith("SUR") ? "S" : h.startsWith("OESTE") || h.startsWith("OCC") ? "O" : h.startsWith("ESTE") ? "E" : h;
      const texto = `${m[1]}°${m[2] ? `${m[2]}'` : ""}${m[3] ? `${m[3]}"` : ""} ${hem}`.trim();
      return { hem, texto };
    });
    let lat: number | null = null;
    let lon: number | null = null;
    for (const v of valores) {
      if ("NS".includes(v.hem) && v.hem) lat = leerCoordenada(v.texto, "lat");
      else if ("EOW".includes(v.hem) && v.hem) lon = leerCoordenada(v.texto, "lon");
    }
    if (lat === null && lon === null) {
      lat = leerCoordenada(valores[0].texto, "lat");
      lon = leerCoordenada(valores[1].texto, "lon");
    } else if (lat === null) lat = leerCoordenada(valores.find((v) => !"EOW".includes(v.hem) || !v.hem)?.texto ?? "", "lat");
    else if (lon === null) lon = leerCoordenada(valores.find((v) => !"NS".includes(v.hem) || !v.hem)?.texto ?? "", "lon");
    if (lat !== null && lon !== null) return ajustarColombia(lat, lon, valores.some((v) => v.hem));
  }
  // 2) Decimales: «4.5123, -73.1234», «4,5123; -73,1234», «lat 4.51 lon -73.12»
  const limpio = t.replace(/\b(latitud|lat|longitud|long|lon|lng)\b\s*:?/gi, " ");
  const dec = /(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([NS](?![a-zA-Z]))?\s*(?:[,;/]|\sy\s|\s)\s*(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([EOW](?![a-zA-Z]))?/i;
  const m = limpio.match(dec);
  if (m) {
    let lat = num(m[1]);
    let lon = num(m[3]);
    if (m[2]?.toUpperCase() === "S") lat = -Math.abs(lat);
    if (m[4] && "OW".includes(m[4].toUpperCase())) lon = -Math.abs(lon);
    return ajustarColombia(lat, lon, Boolean(m[2] || m[4]));
  }
  return null;
}

/* ───────────── Nodos y datos en el texto ───────────── */

function buscarNodo(tn: string, antenas: Antena[], seleccion: string | null, excluir?: string): Antena | null {
  const candidatos = [...antenas].filter((a) => a.id !== excluir).sort((a, b) => b.nombre.length - a.nombre.length);
  for (const a of candidatos) {
    const nombre = n(a.nombre);
    if (nombre.length >= 2 && new RegExp(`(^|[^a-z0-9])${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(tn)) return a;
  }
  if (/\b(la|el) (ultima|ultimo)\b/.test(tn) && antenas.length) return antenas[antenas.length - 1];
  if (/\b(seleccionad[ao]|esta antena|este nodo|esa antena|ese nodo)\b/.test(tn) && seleccion) return antenas.find((a) => a.id === seleccion) ?? null;
  if (antenas.length === 1 && /\b(antena|nodo|torre)\b/.test(tn)) return antenas[0];
  return null;
}

function nodosMencionados(tn: string, antenas: Antena[]): Antena[] {
  const encontrados: { a: Antena; pos: number }[] = [];
  for (const a of [...antenas].sort((x, y) => y.nombre.length - x.nombre.length)) {
    const nombre = n(a.nombre);
    const pos = tn.search(new RegExp(`(^|[^a-z0-9])${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`));
    if (pos >= 0 && !encontrados.some((e) => Math.abs(e.pos - pos) < 2)) encontrados.push({ a, pos });
  }
  return encontrados.sort((x, y) => x.pos - y.pos).map((e) => e.a);
}

function nombreNuevo(texto: string): string | undefined {
  const comillas = texto.match(/["“«']([^"”»']{2,40})["”»']/);
  if (comillas) return comillas[1].trim();
  const m = texto.match(
    /(?:llamad[oa]|de nombre|con (?:el )?nombre(?: de)?|nombre:?|que se llame)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][\wÁÉÍÓÚÑáéíóúñ .-]{0,38}?)(?=\s+(?:en|a|con|de|ubicad[oa]|que|y|para|sobre)\b|[,.;]|$)/i,
  );
  return m ? m[1].trim() : undefined;
}

function datosNodo(texto: string, tn: string): DatosNodo {
  const d: DatosNodo = {};
  const nombre = nombreNuevo(texto);
  if (nombre) d.nombre = nombre;
  const altura = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
  if (altura) d.alturaM = Math.min(300, Math.max(0.5, num(altura[1])));
  const ganancia = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
  if (ganancia) d.gananciaDbi = num(ganancia[1]);
  const potencia = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbm\b/i);
  if (potencia) d.potenciaDbm = num(potencia[1]);
  if (/\b(pasarela|gateway)\b/.test(tn)) d.pasarela = true;
  const tipo = tipoNodo(tn);
  if (tipo) d.tipo = tipo;
  const patron = patronEnTexto(tn);
  if (patron && patron !== "omni") {
    d.patron = patron;
    d.equipo = "personalizado";
    if (d.gananciaDbi === undefined) d.gananciaDbi = patronPorId(patron).gananciaTipica;
    const az = /\b(apunt\w*|orient\w*|azimut|hacia|mirando)\b/.test(tn) ? azimutEnTexto(texto.replace(/\d+(?:[.,]\d+)?\s*°\s*\d/g, ""), tn) : null;
    d.azimutDeg = az ?? 0;
    d.elevacionDeg = 0;
  }
  return d;
}

function tipoNodo(tn: string): TipoNodo | null {
  if (/\bnodo antena\b|\bantena\b|\btorre\b|\brepetidor\b|\brouter\b/.test(tn)) return "antena";
  if (/\bnodo\b|\bsensor\b|\bportatil\b|\brastreador\b|\btracker\b|equipo de campo|nodo de campo/.test(tn)) return "nodo";
  return null;
}

function presetEnTexto(tn: string): PresetId | null {
  const plano = tn.replace(/[\s_-]+/g, "");
  for (const p of [...PRESETS].sort((a, b) => b.nombre.length - a.nombre.length)) {
    if (plano.includes(p.nombre.toLowerCase().replace(/\s+/g, "")) || plano.includes(p.id.toLowerCase().replace(/_/g, ""))) return p.id;
  }
  return null;
}

/* ───────────── Antenas direccionales, red y vista ───────────── */

/** Tipo de antena mencionado en el texto. */
function patronEnTexto(tn: string): PatronId | null {
  if (/\byagi\b/.test(tn)) return "yagi";
  if (/\bparabolic\w*|\bplato\b|\brejilla\b/.test(tn)) return "parabolica";
  if (/\bsector\w*/.test(tn)) return /\b120\b/.test(tn) ? "sectorial-120" : "sectorial-90";
  if (/\bpanel\b/.test(tn)) return "panel";
  if (/\bomni\w*/.test(tn)) return "omni";
  return null;
}

const CARDINALES: [RegExp, number][] = [
  [/\b(noreste|nororiente|nor ?este)\b/, 45],
  [/\b(noroeste|noroccidente|nor ?oeste)\b/, 315],
  [/\b(sureste|suroriente|sur ?este|sudeste)\b/, 135],
  [/\b(suroeste|suroccidente|sur ?oeste|sudoeste)\b/, 225],
  [/\b(norte)\b/, 0],
  [/\b(sur)\b/, 180],
  [/\b(este|oriente)\b/, 90],
  [/\b(oeste|occidente)\b/, 270],
];

/** Azimut pedido: «45°», «a 120 grados», «al noreste»; null si no se menciona. */
function azimutEnTexto(texto: string, tn: string): number | null {
  const g = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:°|º|grados?\b)/i);
  if (g) return ((num(g[1]) % 360) + 360) % 360;
  const resto = tn.replace(/.*\b(apunt\w*|orient\w*|dirig\w*|gir\w*|hacia|mirando)\b/, "");
  for (const [re, grados] of CARDINALES) if (re.test(resto)) return grados;
  return null;
}

const PREGUNTA = /^(que|como|cual|cuales|por que|porque|para que|explica\w*|dime|cuentame)\b|\b(que es|que son|que significa|para que sirve|como funciona)\b/;

function climaEnTexto(tn: string): ClimaItm | null {
  if (/\becuatorial\b/.test(tn)) return 1;
  if (/\bdesert\w*|\bdesierto\b|\barido\b/.test(tn)) return 4;
  if (/\bmaritimo templado\b.*\bmar\b|\bsobre el mar\b|\bsobre mar\b/.test(tn)) return 7;
  if (/\bmaritimo templado\b|\bmaritimo\b.*\btierra\b/.test(tn)) return 6;
  if (/\bmaritimo subtropical\b|\bmaritimo\b/.test(tn)) return 3;
  if (/\bcontinental templado\b|\btemplado\b/.test(tn)) return 5;
  if (/\bcontinental subtropical\b|\bsubtropical\b|\bcontinental\b/.test(tn)) return 2;
  return null;
}

function sueloEnTexto(tn: string): SueloId | null {
  if (/\bagua de mar\b|\bmar\b|\bsalad\w*/.test(tn)) return "mar";
  if (/\bagua dulce\b|\brio\b|\blago\b|\bcienaga\b|\bagua\b/.test(tn)) return "agua-dulce";
  if (/\bpobre\b|\bseco\b|\barenos\w*|\bdesert\w*/.test(tn)) return "pobre";
  if (/\bbueno\b|\bhumed\w*|\bfertil\b|\bpantanos\w*/.test(tn)) return "bueno";
  if (/\bpromedio\b|\bmedio\b|\bnormal\b|\bcomun\b/.test(tn)) return "promedio";
  return null;
}

function entornoEnTexto(tn: string): EntornoId | null {
  if (/\b(centro urbano|ciudad densa|edificios altos|urbano denso)\b/.test(tn)) return "urbano-denso";
  if (/\b(vegetacion densa|bosque|selva|monte|montes|arboles altos|bosques)\b/.test(tn)) return "bosque";
  if (/\b(plantacion\w*|palma\w*|palmeras|palmares|frutales|cultivo alto|cultivos altos)\b/.test(tn)) return "plantacion";
  if (/\b(cultivos?|arboles dispersos|vegetacion ligera|vegetacion|potreros? con arboles|arboles)\b/.test(tn)) return "cultivos";
  if (/\b(pueblo|suburban\w*|caserio|casas)\b/.test(tn)) return "suburbano";
  if (/\b(ciudad|urbano|urbana|edificios)\b/.test(tn)) return "urbano";
  if (/\b(campo abierto|sabana|sin vegetacion|sin obstaculos|despejad\w*|zona abierta|terreno abierto|llanura abierta|sin entorno|sin perdidas? (de|por) entorno)\b/.test(tn)) return "abierto";
  return null;
}

/** Nivel con unidad en el texto («-100 dBm», «5 µV», «20 dB»), convertido a dBm. */
function nivelesEnTexto(texto: string, sensibilidad: number): number[] {
  const t = texto.replace(/−/g, "-");
  const aDbmU = (v: number, unidad: string) => {
    const u = unidad.toLowerCase();
    return u === "dbm" ? v : u === "db" ? v + sensibilidad : uvADbm(v);
  };
  const UNIDAD = "(dbm|µ\\s?v|uv|microvolt\\w*|db)\\b";
  // Rango con una sola unidad al final: «de -120 a -70 dBm»
  const rango = t.match(new RegExp(`(-?\\d{1,3}(?:[.,]\\d+)?)\\s*(?:dbm|db|µv|uv)?\\s*(?:a|y|hasta|–)\\s*(-?\\d{1,3}(?:[.,]\\d+)?)\\s*${UNIDAD}`, "i"));
  if (rango) return [aDbmU(num(rango[1]), rango[3]), aDbmU(num(rango[2]), rango[3])];
  return [...t.matchAll(new RegExp(`(-?\\d{1,3}(?:[.,]\\d+)?)\\s*${UNIDAD}`, "gi"))].map((m) => aDbmU(num(m[1]), m[2]));
}

function unidadEnTexto(texto: string, tn: string): UnidadId | null {
  if (/db\s*[µu]\s*v\s*\/\s*m|campo el[eé]ctrico|intensidad de campo/i.test(texto)) return "dbuvm";
  if (/[µ]\s?v\b|\buv\b|microvolt/i.test(texto)) return "uv";
  if (/\bdbm\b/.test(tn)) return "dbm";
  if (/\bmargen\b|\ben db\b|\bdecibel\w*/.test(tn)) return "margen";
  return null;
}

/* ───────────── Interpretación ───────────── */

const VERBO_AGREGAR = /\b(inscrib\w*|registr\w*|agreg\w*|anad\w*|adicion\w*|ingres\w*|instal\w*|coloc\w*|crea|crear|creame|crealo|pon|poner|ponme|monta\w*|ubica (?:una|un|otra|otro)|ubicar (?:una|un|otra|otro)|nuev[oa]|mete|meter|incorpor\w*)\b/;
const OBJETO = /\b(antena|antenas|nodo|nodos|torre|repetidor|pasarela|router|sensor|equipo)\b/;

export function interpretarOrden(texto: string, api: Api, pendiente: Pendiente): Orden | null {
  const tn = n(texto);
  if (!tn) return null;
  const antenas = api.antenas();
  const coord = extraerCoordenadas(texto);
  const sel = api.seleccion();

  if (/\b(deshace\w*|deshaz|revierte|revertir|anula lo ultimo)\b/.test(tn)) return null; // lo maneja Melki (necesita la instantánea)

  // Completar un pedido que esperaba coordenadas
  if (pendiente && coord && !OBJETO.test(tn.replace(/\b(en|a)\b/g, ""))) {
    if (pendiente.tipo === "agregar") return { tipo: "agregar", datos: pendiente.datos, coord };
    if (pendiente.tipo === "mover") return { tipo: "mover", id: pendiente.id, coord };
    if (pendiente.tipo === "pieza") return { tipo: "pieza", pieza: pendiente.pieza, datos: pendiente.datos, coord };
  }
  if (pendiente && coord) {
    if (pendiente.tipo === "agregar" && !VERBO_AGREGAR.test(tn)) return { tipo: "agregar", datos: { ...pendiente.datos, ...datosNodo(texto, tn) }, coord };
  }

  if (/\b(borra|borrar|elimina|eliminar|quita|quitar)\b.*\b(medicion|mediciones|regla|medidas)\b/.test(tn)) return { tipo: "borrar-mediciones" };
  if (/\b(nuevo escenario|escenario nuevo|empezar de cero|borra todo|borrar todo|limpia todo|limpiar todo)\b/.test(tn)) return { tipo: "nuevo" };
  if (/\b(carga\w*|muestra\w*|abre|abrir|ver|pon)\b.*\b(ejemplo|demostracion|demo)\b/.test(tn)) return /\b(malla|sembr\w*|siembra|trama|gateway|repetidor\w*|personas?|gente)\b/.test(tn) ? { tipo: "ejemplo-malla" } : { tipo: "ejemplo" };

  const malla = interpretarMalla(texto, tn, api, coord);
  if (malla) return malla;

  // Órdenes sobre un nodo existente. «Inscribe una antena…» pide un nodo nuevo aunque ya exista uno solo,
  // salvo que se nombre uno existente o se diga «la antena», «este nodo»…
  const nombrado = nodosMencionados(tn, antenas)[0];
  const pideNuevo = VERBO_AGREGAR.test(tn) && OBJETO.test(tn) && !nombrado && !/\b(la|el|esta|este|esa|ese|su)\s+(antena|nodo|torre)\b/.test(tn);
  // El nodo del pedido es el primero que se nombra («ponle una Yagi a Ejemplo apuntando a Torre NE» → Ejemplo)
  const nodo = pideNuevo ? null : (nombrado ?? buscarNodo(tn, antenas, sel));
  if (nodo) {
    if (/\b(elimina\w*|borra\w*|quita\w*|suprim\w*|saca\w*)\b/.test(tn) && !/\bpasarela\b/.test(tn)) return { tipo: "eliminar", id: nodo.id };
    if (/\b(mueve|mover|muevela|muevelo|traslad\w*|reubic\w*|desplaz\w*|cambia la ubicacion|cambiar la ubicacion|cambia las coordenadas|cambiar las coordenadas)\b/.test(tn))
      return { tipo: "mover", id: nodo.id, coord: coord ?? undefined };
    const ren = texto.match(/(?:renombr\w*|cambi\w* (?:el )?nombre(?: de)?|ll[aá]mal[ao])\b.*?\b(?:a|por|como)\s+["“«]?([^"”»,.;]{2,40})["”»]?\s*$/i);
    if (ren) return { tipo: "renombrar", id: nodo.id, nombre: ren[1].trim() };
    if (/\b(como pasarela|sea (la )?pasarela|es la pasarela|hazla pasarela|hazlo pasarela|marca\w* .*pasarela|pon\w* .*pasarela)\b/.test(tn) && !/\b(quita|ya no|no es)\b/.test(tn))
      return { tipo: "editar", id: nodo.id, cambios: { pasarela: true }, descripcion: "ahora es pasarela" };
    if (/\b(quita\w* .*pasarela|ya no (es|sea) pasarela|no es pasarela|sin pasarela)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { pasarela: false }, descripcion: "ya no es pasarela" };
    if (/\b(desactiv\w*|exclu\w*|apag\w*|oculta\w*|saca de la simulacion)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { activa: false }, descripcion: "quedó fuera de la simulación" };
    if (/\b(activ\w*|inclu\w*|enciend\w*|prend\w*)\b/.test(tn) && !/\b(no )?activa la regla\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { activa: true }, descripcion: "volvió a la simulación" };
    if (/\b(convier\w*|cambi\w* .*tipo|vuelve\w*|hazl[ao])\b.*\b(nodo de campo|nodo|antena|nodo antena)\b/.test(tn)) {
      const t = /nodo antena|\bantena\b/.test(tn.split(/convier\w*|cambi\w*|vuelve\w*|hazl[ao]/).pop() ?? "") ? "antena" : "nodo";
      return { tipo: "editar", id: nodo.id, cambios: { tipo: t }, descripcion: t === "antena" ? "ahora es un nodo antena" : "ahora es un nodo de campo" };
    }
    if (!PREGUNTA.test(tn) && !/\b(informe|reporte|radioenlace|radio enlace|perfil)\b/.test(tn)) {
      // Tipo de antena: «ponle una Yagi a Ejemplo», «Ejemplo con antena sectorial de 120»
      const patron = patronEnTexto(tn);
      const apuntar = /\b(apunt\w*|orient\w*|dirig\w*|gira\w*|azimut)\b/.test(tn);
      const otro = nodosMencionados(tn, antenas).find((x) => x.id !== nodo.id);
      const azimut = otro && apuntar ? Math.round(rumbo(nodo.lat, nodo.lon, otro.lat, otro.lon) * 10) / 10 : azimutEnTexto(texto, tn);
      if (patron && patron !== (nodo.patron ?? "omni")) {
        if (patron === "omni") return { tipo: "editar", id: nodo.id, cambios: { patron: undefined, azimutDeg: undefined, elevacionDeg: undefined }, descripcion: "ahora tiene antena omnidireccional" };
        const g = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
        const ganancia = g ? num(g[1]) : patronPorId(patron).gananciaTipica;
        const az = azimut ?? nodo.azimutDeg ?? 0;
        const haz = anchosHaz(patron, ganancia);
        return {
          tipo: "editar",
          id: nodo.id,
          cambios: { patron, gananciaDbi: ganancia, equipo: "personalizado", azimutDeg: az, elevacionDeg: nodo.elevacionDeg ?? 0 },
          descripcion: `ahora tiene antena ${patronPorId(patron).nombre.toLowerCase()} de ${fn(ganancia)} dBi apuntando a ${rumboTexto(az)}${otro && apuntar ? `, hacia ${otro.nombre}` : ""} (haz de ≈ ${Math.round(haz.h)}°)`,
        };
      }
      if (apuntar && azimut !== null) {
        if (!esDireccional(nodo)) return { tipo: "apuntar-omni", id: nodo.id, azimutDeg: azimut, destino: otro?.nombre };
        return { tipo: "editar", id: nodo.id, cambios: { azimutDeg: azimut }, descripcion: `apunta a ${rumboTexto(azimut)}${otro ? `, hacia ${otro.nombre}` : ""}` };
      }
      // Inclinación del haz: «inclina Ejemplo 5° hacia abajo»
      const incl = texto.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*(?:°|º|grados?)/i);
      if (incl && /\b(inclin\w*|tilt|elevacion del haz|baja el haz|sube el haz)\b/.test(tn)) {
        let e = num(incl[1]);
        if (/\b(abajo|baja)\b/.test(tn)) e = -Math.abs(e);
        else if (/\b(arriba|sube)\b/.test(tn)) e = Math.abs(e);
        e = Math.min(45, Math.max(-45, e));
        if (!esDireccional(nodo)) return { tipo: "apuntar-omni", id: nodo.id, azimutDeg: nodo.azimutDeg ?? 0 };
        return { tipo: "editar", id: nodo.id, cambios: { elevacionDeg: e }, descripcion: `el haz queda ${e === 0 ? "horizontal" : `${fn(Math.abs(e))}° hacia ${e < 0 ? "abajo" : "arriba"}`}` };
      }
    }
    const alturaTxt = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
    if (alturaTxt && /\b(altura|sube|subir|subela|subelo|eleva\w*|baja|bajar|bajala|bajalo|pon\w*|cambi\w*|deja\w*)\b/.test(tn) && !/\breceptor\b/.test(tn))
      return { tipo: "editar", id: nodo.id, cambios: { alturaM: Math.min(300, Math.max(0.5, num(alturaTxt[1]))) }, descripcion: `altura ${fn(num(alturaTxt[1]))} m` };
    const pot = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbm\b/i);
    if (pot && /\b(potencia|pon\w*|cambi\w*|sube|baja)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { potenciaDbm: num(pot[1]), equipo: "personalizado" }, descripcion: `potencia ${f1(num(pot[1]))} dBm` };
    const gan = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
    if (gan && /\b(ganancia|antena de|pon\w*|cambi\w*)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { gananciaDbi: num(gan[1]), equipo: "personalizado" }, descripcion: `ganancia ${f1(num(gan[1]))} dBi` };
  }

  // Inscribir un nodo nuevo
  if (VERBO_AGREGAR.test(tn) && OBJETO.test(tn) && !/\b(mide|medir|distancia|perfil)\b/.test(tn)) {
    return { tipo: "agregar", datos: datosNodo(texto, tn), coord: coord ?? undefined };
  }

  // Parámetros de la simulación
  const preset = presetEnTexto(tn);
  if (preset && /\b(usa|usar|cambia\w*|pon\w*|configura\w*|preset|modo|simula con|prueba con)\b/.test(tn))
    return { tipo: "parametros", cambios: { preset }, descripcion: `el preset a ${presetPorId(preset).nombre}` };
  const radio = tn.match(/\bradio(?: de estudio)?\s*(?:de|a|en)?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:km|kilometros?)\b/);
  if (radio) return { tipo: "parametros", cambios: { radioKm: Math.min(40, Math.max(1, num(radio[1]))) }, descripcion: `el radio de estudio a ${f1(num(radio[1]), 0)} km` };
  const resol = tn.match(/\bresolucion\s*(?:a|en)?\s*(rapida|normal|fina)\b/);
  if (resol) return { tipo: "parametros", cambios: { resolucion: resol[1] as Parametros["resolucion"] }, descripcion: `la resolución a ${resol[1]}` };
  const saltos = tn.match(/\b(?:limite de saltos|hop ?limit|saltos)\s*(?:a|de|en)?\s*(\d)\b/);
  if (saltos && /\b(cambia\w*|pon\w*|sube|baja|usa|configura\w*|limite)\b/.test(tn))
    return { tipo: "parametros", cambios: { limiteSaltos: Math.min(7, Math.max(1, Number(saltos[1]))) }, descripcion: `el límite de saltos a ${saltos[1]}` };
  const frec = texto.match(/(\d{3}(?:[.,]\d+)?)\s*mhz\b/i);
  if (frec && /\b(frecuencia|canal|cambia\w*|pon\w*|usa)\b/.test(tn)) return { tipo: "parametros", cambios: { frecuenciaMhz: num(frec[1]) }, descripcion: `la frecuencia a ${frec[1]} MHz` };
  const rx = texto.match(/receptor.*?(\d{1,2}(?:[.,]\d+)?)\s*(?:m|metros?)\b/i);
  if (rx) return { tipo: "parametros", cambios: { alturaRxM: num(rx[1]) }, descripcion: `la altura del receptor a ${rx[1]} m` };
  const extra = texto.match(/p[eé]rdida (?:extra|adicional).*?(\d{1,2}(?:[.,]\d+)?)\s*db\b/i);
  if (extra) return { tipo: "parametros", cambios: { perdidaExtraDb: num(extra[1]) }, descripcion: `la pérdida extra a ${extra[1]} dB` };
  const ordenRed = interpretarRed(texto, tn, api);
  if (ordenRed) return ordenRed;

  // Distancias, perfiles, señal y ubicación
  const mencionados = nodosMencionados(tn, antenas);
  const ref = (a: Antena): Referencia => ({ tipo: "nodo", id: a.id });
  if (/\b(distancia|cuanto hay|que tan lejos|a cuant\w* (?:km|kilometros|metros)|mide|medir|medi)\b/.test(tn) && !/\b(regla|herramienta)\b/.test(tn)) {
    if (mencionados.length >= 2) return { tipo: "distancia", a: ref(mencionados[0]), b: ref(mencionados[1]) };
    if (mencionados.length === 1 && coord) return { tipo: "distancia", a: ref(mencionados[0]), b: { tipo: "coord", coord } };
  }
  if (/\b(informe|reporte|radioenlace|radio enlace|radio link|calculo del enlace|balance del enlace|presupuesto del enlace)\b/.test(tn) && mencionados.length >= 1) {
    if (mencionados.length >= 2) return { tipo: "informe", a: mencionados[0].id, b: ref(mencionados[1]) };
    if (coord) return { tipo: "informe", a: mencionados[0].id, b: { tipo: "coord", coord } };
  }
  if (/\bperfil\b/.test(tn) && mencionados.length >= 1) {
    if (mencionados.length >= 2) return { tipo: "perfil", a: mencionados[0].id, b: ref(mencionados[1]) };
    if (coord) return { tipo: "perfil", a: mencionados[0].id, b: { tipo: "coord", coord } };
  }
  if (coord && /\b(senal|cobertura|llega|alcanza|margen|recibe|recepcion)\b/.test(tn)) return { tipo: "senal", coord };
  if (/\b(municipio|departamento|en que (lugar|parte|municipio|departamento)|donde (esta|queda|se encuentra))\b/.test(tn)) {
    if (mencionados[0] && !coord) return { tipo: "donde", ref: ref(mencionados[0]) };
    if (coord) return { tipo: "donde", ref: { tipo: "coord", coord } };
  }
  if (/\b(ve a|ir a|vamos a|llevame|lleva el mapa|muestrame|mostrar|ubicame|centra\w*|acerca\w*|zoom|busca\w*|encuentra|localiza\w*)\b/.test(tn)) {
    if (coord) return { tipo: "ir", coord };
    if (mencionados[0]) return { tipo: "ir", id: mencionados[0].id };
    const consulta = tn
      .replace(/.*\b(ve a|ir a|vamos a|llevame a|llevame|muestrame|mostrar|ubicame en|ubicame|centra el mapa en|centra en|centrar en|acercate a|busca|buscar|encuentra|localiza)\b/, "")
      .replace(/\b(el|la|los|las|municipio de|departamento de|por favor|porfa|porfavor|en el mapa|mapa)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (consulta.length >= 3) {
      const lugar = api.buscarLugar(consulta)[0];
      return lugar ? { tipo: "ir", lugar } : { tipo: "ir", consulta };
    }
  }

  if (/\b(simula|simular|simulalo|simulala|calcula|calcular|recalcula\w*|corre la simulacion|ejecuta la simulacion|actualiza la simulacion|haz la simulacion|realiza la simulacion)\b/.test(tn)) return { tipo: "simular" };
  if (/\b(que|cuales|cuantos|cuantas) (antenas|nodos)\b|\blista\w* (de )?(las |los )?(antenas|nodos)\b|\b(mis|las|los) (antenas|nodos)\b.*\b(hay|tengo)\b/.test(tn)) return { tipo: "listar" };
  if (/\b(regla|medir distancias?|medir areas?|tomar medidas|medidas)\b/.test(tn)) return { tipo: "herramienta", herramienta: "regla" };
  if (/\b(exporta\w*|descarga\w*|guarda\w*|genera\w*)\b/.test(tn)) {
    if (/\b(kmz|kml|google earth)\b/.test(tn)) return { tipo: "exportar", formato: "kmz" };
    if (/\b(csv|excel)\b/.test(tn)) return { tipo: "exportar", formato: "csv" };
    if (/\b(json|escenario)\b/.test(tn)) return { tipo: "exportar", formato: "json" };
  }
  if (coord) return { tipo: "coordenada-sola", coord };
  return null;
}

/* ───────────── Modo «Sembrar la malla» (como en Trama) ───────────── */

const PALABRA_PIEZA: [Pieza, RegExp][] = [
  ["gateway", /\b(gateway|gateways|getway|geteway|internet|starlink)\b/],
  ["repetidor", /\b(repetidor|repetidores|repetidora|repetidoras)\b/],
  ["persona", /\b(persona|personas|gente|familia|familias|casa|casas|vivienda|viviendas|usuario|usuarios|vecino|vecinos|habitante|habitantes|finca)\b/],
];

/** Gateway, repetidor o persona mencionados como pieza nueva (no «Repetidor 2», que es el nombre de un nodo). */
function piezaEnTexto(tn: string, antenas: Antena[]): Pieza | null {
  const otroEquipo = /\b(antena|antenas|nodo|nodos|torre|sensor|equipo|router|pasarela)\b/.test(tn);
  for (const [pieza, re] of PALABRA_PIEZA) {
    const m = tn.match(re);
    if (!m) continue;
    // «Inscribe un nodo antena en mi casa» o «antena con internet» siguen siendo nodos del modo avanzado
    if (otroEquipo && (pieza === "persona" || m[0] === "internet")) continue;
    // «Repetidor 2» o «Persona 3» seguidos de su número son nodos que ya existen
    const resto = tn.slice((m.index ?? 0) + m[0].length);
    if (/^\s*\d/.test(resto) && antenas.some((a) => n(a.nombre) === `${m[0]} ${resto.trim().split(" ")[0]}`)) continue;
    return pieza;
  }
  return null;
}

function interpretarMalla(texto: string, tn: string, api: Api, coord: Coordenada | null): Orden | null {
  if (PREGUNTA.test(tn) && !/\b(puedes|podrias|me ayudas)\b/.test(tn)) return null;
  const antenas = api.antenas();
  // Modo de la pantalla
  if (/\bmodo (avanzado|completo|experto)\b/.test(tn) && !/\bque es\b/.test(tn)) return { tipo: "modo", modo: "avanzado" };
  if (/\b(modo (sembrar|siembra|sencillo|facil|simple|trama)|sembrar la malla|vuelve a sembrar|volver a sembrar)\b/.test(tn) && !/\b(repetidor\w*|hacia|conecta\w*)\b/.test(tn)) return { tipo: "modo", modo: "sembrar" };
  // Animación del flujo de la información
  if (/\b(quita\w*|apaga\w*|desactiva\w*|deten\w*|para|pausa\w*|sin|no quiero)\b.*\b(animacion|animaciones|flujo|parpadeo|destellos)\b/.test(tn)) return { tipo: "vista", cambios: { animarRed: false }, descripcion: "quieta, sin la animación del flujo" };
  if (/\b(anima\w*|activa\w*|enciende|prende|muestra\w*|pon\w*)\b.*\b(animacion|animaciones|flujo|destellos)\b/.test(tn) || /\banima la (red|malla)\b/.test(tn)) return { tipo: "vista", cambios: { animarRed: true }, descripcion: "con el flujo animado hacia el gateway" };
  // Aceptar o descartar la propuesta del sembrado
  if (api.propuesta()) {
    if (/\b(descart\w*|no los pongas|no la quiero|cancela\w*|olvidalo)\b/.test(tn)) return { tipo: "descartar-siembra" };
    if (/\b(acept\w*|ponlos|ponla|ponlo|ponerlos|instalalos|pon los propuestos|confirm\w*|dale|hazlo|si,? pon\w*)\b/.test(tn) || (/\bpropuest\w*/.test(tn) && /\b(pon\w*|instal\w*|deja\w*|usa\w*)\b/.test(tn))) return { tipo: "aceptar-siembra" };
  }
  // Enviar un mensaje por la malla
  if (/\b(envi\w*|mand\w*|prueb\w*|simul\w*)\b.*\b(mensaje|mensajes|sms|texto|sos|alerta|chat)\b/.test(tn)) {
    const desde = nodosMencionados(tn, antenas)[0];
    return { tipo: "mensaje", id: desde?.id };
  }
  // Sembrado automático: «conecta a los que faltan», «siembra repetidores hacia…», «lleva la red a…»
  const sembrar = /\b(siembra|siembrame|siembre|sembrar|conecta|conectame|conectalos|conectalas|conectala|conectalo|conectar|conecte|conectelos|conectelas|conectela|conectelo|lleva\w* la (red|malla|senal|cobertura)|llevar la (red|malla|senal|cobertura)|extiend\w* la (red|malla)|ampli\w* la (red|malla))\b/.test(tn);
  if (sembrar && !/\b(internet|starlink|pc|computador|celular)\b.*\bconecta/.test(tn)) {
    if (/\b(faltan|falta|sin cobertura|sin senal|rojas?|rojos?|desconectad\w*|aislad\w*|todas? las personas|todos|toda la gente)\b/.test(tn)) return { tipo: "sembrar", destino: "faltantes" };
    if (coord) return { tipo: "sembrar", destino: { coord, nombre: "El punto pedido" } };
    const persona = nodosMencionados(tn, antenas).find((a) => !a.pasarela);
    if (persona) return { tipo: "sembrar", destino: { id: persona.id } };
    const consulta = tn.replace(/.*\b(hacia|hasta|a)\b\s+/, "").replace(/\b(el|la|los|las|municipio de|por favor|porfa)\b/g, " ").replace(/\s+/g, " ").trim();
    if (consulta.length >= 3) {
      const lugar = api.buscarLugar(consulta)[0];
      if (lugar) return { tipo: "sembrar", destino: { coord: { lat: lugar.lat, lon: lugar.lon }, nombre: lugar.nombre } };
    }
    if (/\b(siembra|siembrame|siembre|sembrar)\b/.test(tn)) return { tipo: "sembrar", destino: "faltantes" };
  }
  // Poner una pieza: «pon el gateway en…», «agrega un repetidor en… a 20 m», «pon una persona en…»
  const pieza = piezaEnTexto(tn, antenas);
  const moverGateway = pieza === "gateway" && /\b(mueve|mover|muevelo|traslad\w*|cambia\w* .*(sitio|lugar|ubicacion))\b/.test(tn);
  if (pieza && (VERBO_AGREGAR.test(tn) || moverGateway) && !/\b(mide|medir|distancia|perfil|senal en)\b/.test(tn)) {
    const datos: DatosNodo = {};
    const nombre = nombreNuevo(texto);
    if (nombre) datos.nombre = nombre;
    const altura = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
    if (altura) datos.alturaM = Math.min(300, Math.max(0.5, num(altura[1])));
    return { tipo: "pieza", pieza, coord: coord ?? undefined, datos, mover: moverGateway };
  }
  // «¿Qué hago ahora?» con la red sembrada
  if (/\b(que hago ahora|que sigue|siguiente paso|que me falta|que falta)\b/.test(tn)) return { tipo: "que-hago" };
  return null;
}

/** Texto de la propuesta del sembrado automático, con los botones para ponerla o descartarla. */
function textoSiembra(s: Siembra, destinos: DestinoSiembra[]): Respuesta {
  const n = s.puntos.length;
  const resultado = s.destinos
    .map((d, i) => `${destinos[i]?.nombre ?? "El punto"} ${d.llega ? `quedaría con ${f1(d.margenDb, 0)} dB desde ${d.desde}` : `no se alcanza: ${d.motivo}`}`)
    .join("; ");
  if (!n) {
    const algun = s.destinos.some((d) => d.llega);
    return {
      texto: algun ? `No hace falta ningún repetidor: ${resultado}.` : `No encontré cómo llegar: ${resultado}`,
      acciones: algun && destinos.some((d) => !d.antena) ? [{ texto: "Poner una persona ahí", accion: "orden", orden: { tipo: "aceptar-siembra" } }] : undefined,
    };
  }
  const lista = s.puntos.map((q, k) => `Propuesto ${k + 1} a ${f1(q.distanciaKm)} km de ${q.desde} (${f1(q.margenDb, 0)} dB, suelo a ${Math.round(q.sueloM)} m)`).join("; ");
  return {
    texto: `Propongo ${n === 1 ? "un repetidor" : `${n} repetidores`}: ${lista}. ${resultado}. Los ve en el mapa como torres naranjas punteadas; busqué las lomas con enlace sólido (≥ 30 dB). Revise el sitio y el acceso en campo antes de instalar.`,
    acciones: [
      { texto: `Poner ${n === 1 ? "el repetidor" : `los ${n} repetidores`}`, accion: "orden", orden: { tipo: "aceptar-siembra" } },
      { texto: "Descartar", accion: "orden", orden: { tipo: "descartar-siembra" } },
    ],
  };
}

/** Resumen corto de la red sembrada: personas conectadas, sin cobertura y territorio cubierto. */
export function textoRed(r: EstadoRed, limiteSaltos: number): string {
  if (!r.gateways.length) return "Aún no hay gateway: es el primer paso, el sitio donde entra el internet.";
  if (!r.alDia) return "La red se está calculando.";
  const partes = [`${r.conectadas.length} de ${r.personas.length} ${r.personas.length === 1 ? "persona conectada" : "personas conectadas"}`];
  if (r.sinCobertura.length) partes.push(`${r.sinCobertura.length} sin cobertura (${r.sinCobertura.map((a) => a.nombre).join(", ")})`);
  if (r.lejos.length) partes.push(`${r.lejos.length} con más de ${limiteSaltos} saltos`);
  if (r.aislados.length) partes.push(`${r.aislados.length === 1 ? "un repetidor" : `${r.aislados.length} repetidores`} sin red (${r.aislados.map((a) => a.nombre).join(", ")})`);
  partes.push(`${f1(r.areaKm2, r.areaKm2 < 10 ? 1 : 0)} km² cubiertos`);
  return `La red: ${partes.join(", ")}.`;
}

/** Parámetros de red (como en Radio Mobile), entorno, modelo y vista del mapa de señal. */
function interpretarRed(texto: string, tn: string, api: Api): Orden | null {
  if (PREGUNTA.test(tn)) return null;
  const p = api.parametros();
  const verbo = /\b(usa\w*|cambia\w*|pon\w*|configura\w*|simula\w*|prueba\w*|calcula\w*|activa\w*|selecciona\w*|elige|escoge|aplica\w*|considera\w*|toma\w*|agrega\w*|suma\w*|quiero|necesito|deja\w*|con|en|a)\b/;
  // Restablecer los parámetros de Radio Mobile
  if (/\b(restablec\w*|reinici\w*|vuelve\w*|devuelve\w*|regresa\w*|resetea\w*|valores? (de|por) (defecto|referencia)|como (estaba|en las pruebas))\b/.test(tn) && /\b(parametro\w*|radio mobile|red|propagacion|referencia)\b/.test(tn))
    return { tipo: "parametros", cambios: { ...RED_REFERENCIA }, descripcion: "los parámetros de red a los de Radio Mobile (ecuatorial, vertical, suelo promedio, N = 360, móvil 50 % / 70 %)" };
  // Modelo
  if (/\b(longley\w*|itm|irregular terrain)\b/.test(tn) && verbo.test(tn) && p.modelo !== "itm") return { tipo: "parametros", cambios: { modelo: "itm" }, descripcion: "el modelo a Longley-Rice (ITM), como Radio Mobile" };
  if (/\b(modelo calibrado|calibrado)\b/.test(tn) && verbo.test(tn) && p.modelo !== "calibrado") return { tipo: "parametros", cambios: { modelo: "calibrado" }, descripcion: "el modelo al calibrado (recomendado)" };
  // Polarización
  if (/\bpolariz\w*/.test(tn)) {
    const pol = /\bhorizontal\w*/.test(tn) ? "horizontal" : /\bvertical\w*/.test(tn) ? "vertical" : null;
    if (pol) return { tipo: "parametros", cambios: { polarizacion: pol }, descripcion: `la polarización a ${pol}` };
  }
  // Clima
  if (/\bclima\b/.test(tn)) {
    const c = climaEnTexto(tn);
    const datos = CLIMAS.find((x) => x.id === c);
    if (datos) return { tipo: "parametros", cambios: { clima: datos.id, refractividad: datos.refractividad }, descripcion: `el clima a ${datos.nombre.toLowerCase()} (refractividad N = ${datos.refractividad})` };
  }
  // Refractividad
  const nref = tn.match(/\brefractividad\b\D{0,12}(\d{3})\b/);
  if (nref) return { tipo: "parametros", cambios: { refractividad: Math.min(400, Math.max(250, Number(nref[1]))) }, descripcion: `la refractividad a N = ${nref[1]}` };
  // Suelo
  if (/\b(suelo|terreno|tierra)\b/.test(tn) && /\b(suelo|conductividad|permitividad)\b|\bterreno (humedo|seco|arenoso|pobre|bueno|promedio)\b/.test(tn)) {
    const sid = sueloEnTexto(tn.replace(/.*\b(suelo|terreno|tierra)\b/, ""));
    const x = SUELOS.find((q) => q.id === sid);
    if (x) return { tipo: "parametros", cambios: { suelo: x.id, permitividad: x.permitividad, conductividad: x.conductividad }, descripcion: `el suelo a ${x.nombre.toLowerCase()} (εr ${x.permitividad}, σ ${String(x.conductividad).replace(".", ",")} S/m)` };
  }
  // Modo estadístico
  const modo = tn.match(/\bmodo (?:estadistico |de variabilidad )?(movil|accidental|puntual|spot|difusion|broadcast)\b/);
  if (modo) {
    const id: VariabilidadId = modo[1] === "spot" ? "puntual" : modo[1] === "broadcast" ? "difusion" : (modo[1] as VariabilidadId);
    return { tipo: "parametros", cambios: { variabilidad: id }, descripcion: `el modo estadístico a ${VARIABILIDADES.find((v) => v.id === id)?.nombre.toLowerCase()}` };
  }
  // Confiabilidad: «confiabilidad alta», «confiabilidad del 90 %», «95 % del tiempo», «80 % de las situaciones»
  const pctTiempo = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:del|de el)? ?tiempo\b/);
  const pctSit = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:de (?:las )?)?situaciones\b/);
  const pctUbi = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:de (?:las |los )?)?(?:ubicaciones|lugares|sitios)\b/);
  if (pctTiempo || pctSit || pctUbi) {
    const cambios: Partial<Parametros> = {};
    const partes: string[] = [];
    const lim = (x: string) => Math.min(99, Math.max(1, num(x)));
    if (pctTiempo) {
      cambios.tiempoPct = lim(pctTiempo[1]);
      partes.push(`${fn(cambios.tiempoPct)} % del tiempo`);
    }
    if (pctUbi) {
      cambios.ubicacionesPct = lim(pctUbi[1]);
      partes.push(`${fn(cambios.ubicacionesPct)} % de las ubicaciones`);
    }
    if (pctSit) {
      cambios.situacionesPct = lim(pctSit[1]);
      partes.push(`${fn(cambios.situacionesPct)} % de las situaciones`);
    }
    return { tipo: "parametros", cambios, descripcion: `la confiabilidad a ${partes.join(", ")}` };
  }
  if (/\bconfiabilidad\b|\bconfiable al\b/.test(tn)) {
    const pct = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:%|por ciento)/i) ?? tn.match(/\bconfiab\w*\s+(?:del?|al?)\s+(\d{1,2}(?:[.,]\d+)?)\b/);
    const nivel = /\bmuy alta\b/.test(tn) ? CONFIABILIDADES[2] : /\balta\b/.test(tn) ? CONFIABILIDADES[1] : /\b(normal|baja|estandar|de radio mobile)\b/.test(tn) ? CONFIABILIDADES[0] : null;
    if (pct) {
      const v = Math.min(99, Math.max(1, num(pct[1])));
      return { tipo: "parametros", cambios: { tiempoPct: v, ubicacionesPct: v, situacionesPct: v }, descripcion: `la confiabilidad al ${fn(v)} % (tiempo, ubicaciones y situaciones)` };
    }
    if (nivel) return { tipo: "parametros", cambios: { tiempoPct: nivel.tiempoPct, ubicacionesPct: nivel.ubicacionesPct, situacionesPct: nivel.situacionesPct }, descripcion: `la confiabilidad a ${nivel.nombre.toLowerCase()}: ${nivel.descripcion.charAt(0).toLowerCase()}${nivel.descripcion.slice(1).replace(/\.$/, "")}` };
  }
  // Entorno (vegetación o construcciones)
  const ent = entornoEnTexto(tn);
  if (ent && (/\b(entorno|zona|area|region|simula\w*|considera\w*|hay|con|pon\w*|cambia\w*|agrega\w*|suma\w*|incluye|usa\w*|esta en|estan en|dentro de|bajo|entre)\b/.test(tn)) && !/\b(ve a|ir a|llevame|busca\w*)\b/.test(tn)) {
    const e = entornoPorId(ent);
    const perdida = perdidaEntorno(ent, p.alturaRxM, p.frecuenciaMhz);
    return {
      tipo: "parametros",
      cambios: { entorno: ent },
      descripcion: ent === "abierto" ? "el entorno a campo abierto (sin pérdidas por vegetación ni edificios)" : `el entorno a ${e.nombre.toLowerCase()}: ≈ ${f1(perdida)} dB menos para el receptor a ${fn(p.alturaRxM)} m y para los equipos por debajo de ${fn(e.alturaM)} m`,
    };
  }
  // Vista del mapa de señal: unidades y escala de colores
  const mostrar = /\b(muestra\w*|mostrar|ver|veo|pinta\w*|expresa\w*|unidad\w*|cambia\w*|pon\w*|usa\w*|quiero|dame|en|colores?|escala)\b/.test(tn);
  const unidad = unidadEnTexto(texto, tn);
  const cambios: CambiosVista = {};
  const partes: string[] = [];
  if (unidad && mostrar && /\b(en|a|unidad\w*|muestra\w*|ver|pinta\w*|expresa\w*)\b/.test(tn)) {
    cambios.unidad = unidad;
    partes.push({ margen: "como margen en dB", dbm: "en dBm", uv: "en microvoltios (µV)", dbuvm: "como campo en dBµV/m" }[unidad]);
  }
  const s = presetPorId(p.preset).sensibilidadDbm;
  let escala: EscalaSenal | null = /\barco ?iris\b|\brainbow\b|\bdegradado\b/.test(tn) ? "arcoiris" : /\bumbral\b/.test(tn) && !/\bservicio\b/.test(tn) ? "umbral" : /\b(por clases|en clases|clases|colores de radio mobile|colores normales)\b/.test(tn) ? "clases" : null;
  const niveles = nivelesEnTexto(texto, s);
  if (escala === "arcoiris") {
    cambios.escala = "arcoiris";
    if (niveles.length >= 2) {
      cambios.escalaMinDbm = Math.min(niveles[0], niveles[1]);
      cambios.escalaMaxDbm = Math.max(niveles[0], niveles[1]);
    }
    partes.push("con colores arcoíris");
  } else if (escala === "umbral") {
    cambios.escala = "umbral";
    if (niveles.length) cambios.umbralDbm = niveles[0];
    partes.push(`solo donde la señal supera el umbral${niveles.length ? ` de ${textoNivel(niveles[0], unidad ?? "dbm", { sensibilidadDbm: s, gananciaRxDbi: p.gananciaRxDbi, frecuenciaMhz: p.frecuenciaMhz }, 1)}` : ""}`);
  } else if (escala === "clases") {
    cambios.escala = "clases";
    partes.push("con las clases de Radio Mobile");
  } else escala = null;
  if (Object.keys(cambios).length) {
    cambios.modo = "senal";
    return { tipo: "vista", cambios, descripcion: partes.join(" ") };
  }
  return null;
}

/* ───────────── Ejecución ───────────── */

export type ResultadoOrden = Respuesta & { deshacer?: Escenario; esperar?: string; pendiente?: Pendiente; luego?: Promise<Respuesta> };

function textoCoord(c: { lat: number; lon: number }) {
  return `${aGMS(c.lat, "lat")}, ${aGMS(c.lon, "lon")} (${aDecimal(c.lat)}, ${aDecimal(c.lon)})`;
}

const EJEMPLO_COORD = "4.5123, -73.1234 o 4°30'44\" N, 73°07'24\" O";

export function ejecutarOrden(o: Orden, api: Api): ResultadoOrden {
  const antenas = api.antenas();
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const antes = api.instantanea();
  const puntoDe = (r: Referencia) => (r.tipo === "nodo" ? porId.get(r.id) : r.coord);
  const nombreDe = (r: Referencia) => (r.tipo === "nodo" ? (porId.get(r.id)?.nombre ?? "el nodo") : `${aGMS(r.coord.lat, "lat")} ${aGMS(r.coord.lon, "lon")}`);

  switch (o.tipo) {
    case "agregar": {
      const clase = o.datos.tipo === "nodo" ? "nodo" : "nodo antena";
      if (!o.coord) {
        const datos = o.datos;
        return {
          texto: `Con gusto. Escríbame la coordenada del ${clase}, por ejemplo ${EJEMPLO_COORD}. También puede ubicarlo con un clic en el mapa.`,
          acciones: [{ texto: "Ubicar en el mapa", accion: "agregar" }],
          pendiente: { tipo: "agregar", datos },
        };
      }
      const { lat, lon } = o.coord;
      const nueva = api.agregar({ ...o.datos, lat, lon });
      const lugar = api.ubicacion(lat, lon);
      const tipoTxt = (nueva.tipo ?? "antena") === "nodo" ? "el nodo" : "el nodo antena";
      const extras = [`${fn(nueva.alturaM)} m de altura`, `${fn(nueva.gananciaDbi)} dBi`, `${fn(nueva.potenciaDbm)} dBm`].join(", ");
      return {
        texto: `Listo: inscribí ${tipoTxt} «${nueva.nombre}» en ${textoCoord({ lat, lon })}${lugar ? `, en ${lugar}` : ""}, con ${extras}${nueva.pasarela ? "; es la pasarela" : ""}.${o.coord.corregido ? " Tomé la longitud como oeste (negativa), como corresponde en Colombia." : ""} Ya estoy simulando su alcance; en un momento le cuento el resultado.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: nueva.id,
      };
    }
    case "mover": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      if (!o.coord) return { texto: `¿A qué coordenada muevo «${a.nombre}»? Por ejemplo ${EJEMPLO_COORD}.`, pendiente: { tipo: "mover", id: a.id } };
      api.editar(a.id, { lat: Number(o.coord.lat.toFixed(6)), lon: Number(o.coord.lon.toFixed(6)) });
      api.centrar(o.coord.lat, o.coord.lon);
      const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
      return {
        texto: `Moví «${a.nombre}» a ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}. Recalculo la simulación.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: a.id,
      };
    }
    case "eliminar": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      api.eliminar(a.id);
      return { texto: `Eliminé «${a.nombre}».`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes };
    }
    case "renombrar": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      api.editar(a.id, { nombre: o.nombre.slice(0, 60) });
      return { texto: `Ahora «${a.nombre}» se llama «${o.nombre}».`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes };
    }
    case "editar": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      api.editar(a.id, o.cambios);
      return { texto: `Hecho: «${a.nombre}», ${o.descripcion}. Recalculo la simulación.`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes, esperar: a.id };
    }
    case "parametros": {
      api.parametrosCambiar(o.cambios);
      return { texto: `Cambié ${o.descripcion}. Recalculo la simulación.`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes, esperar: "*" };
    }
    case "vista":
      api.vista(o.cambios);
      if (o.cambios.animarRed !== undefined)
        return {
          texto: o.cambios.animarRed
            ? "Listo: la malla se ve con el flujo animado. Las líneas turquesa avanzan hacia el gateway, los pulsos saltan de nodo en nodo, cada pieza destella al retransmitir y la nube «IA» del gateway se enciende cuando le llega algo."
            : "Listo: la malla queda quieta, sin la animación del flujo. Para volver a verla, dígame «anima la red» o use el interruptor del panel.",
        };
      return { texto: `Listo: el mapa de señal se ve ${o.descripcion}. Lo puede ajustar en Capas → Escala de la señal.` };
    case "informe": {
      const a = porId.get(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: "No encontré alguno de los dos extremos." };
      api.perfil(a, o.b.tipo === "nodo" ? (b as Antena) : { lat: b.lat, lon: b.lon }, true);
      const r = api.resultado();
      const idB = o.b.tipo === "nodo" ? o.b.id : null;
      const e = idB ? r?.enlaces.find((x) => (x.a === a.id && x.b === idB) || (x.b === a.id && x.a === idB)) : undefined;
      const s = presetPorId(api.parametros().preset).sensibilidadDbm;
      const resumen = e
        ? ` En la última simulación el enlace tiene ${f1(e.margen)} dB de margen (≈ ${f1(e.margen + s)} dBm recibidos) a ${f1(e.distanciaKm, 2)} km${e.lineaVista ? ", con línea de vista despejada" : ""}.`
        : "";
      return {
        texto: `Abrí el informe del radioenlace de ${a.nombre} a ${nombreDe(o.b)}, como «Radio Link» de Radio Mobile: distancia, azimut y ángulo de elevación, peor despeje de Fresnel, PIRE, pérdidas desglosadas y el nivel recibido en dBm, µV y dBµV/m.${resumen} Desde ahí puede copiarlo o descargarlo.`,
      };
    }
    case "apuntar-omni": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      return {
        texto: `«${a.nombre}» tiene antena omnidireccional: irradia igual hacia todos lados y no se puede apuntar. Si quiere concentrar la señal ${o.destino ? `hacia ${o.destino}` : `hacia el ${puntoCardinal(o.azimutDeg)}`}, le pongo una antena direccional:`,
        acciones: (["yagi", "sectorial-90", "panel"] as const).map((pt) => ({
          texto: `${patronPorId(pt).nombre} a ${Math.round(o.azimutDeg)}°`,
          accion: "orden" as const,
          orden: {
            tipo: "editar" as const,
            id: a.id,
            cambios: { patron: pt, gananciaDbi: patronPorId(pt).gananciaTipica, equipo: "personalizado" as const, azimutDeg: o.azimutDeg, elevacionDeg: 0 },
            descripcion: `ahora tiene antena ${patronPorId(pt).nombre.toLowerCase()} de ${fn(patronPorId(pt).gananciaTipica)} dBi apuntando a ${rumboTexto(o.azimutDeg)}`,
          },
        })),
      };
    }
    case "simular":
      if (!antenas.some((a) => a.activa)) return { texto: "No hay nodos activos. Inscriba uno con una coordenada o cargue el ejemplo.", acciones: [{ texto: "Cargar el ejemplo", accion: "ejemplo" }] };
      api.simular();
      return { texto: "Simulando… en un momento le cuento el resultado.", esperar: "*" };
    case "ir": {
      if (o.coord) {
        api.centrar(o.coord.lat, o.coord.lon, 13);
        api.marcar(o.coord.lat, o.coord.lon, "Coordenada");
        const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
        return {
          texto: `Lo llevé a ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}. Dejé el punto marcado: desde la tarjeta puede inscribir un nodo ahí.`,
          acciones: [{ texto: "Inscribir un nodo antena ahí", accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "antena" } } }],
        };
      }
      if (o.id) {
        const a = porId.get(o.id);
        if (a) {
          api.centrar(a.lat, a.lon, 13);
          return { texto: `Aquí está «${a.nombre}».` };
        }
      }
      if (o.lugar) {
        if (o.lugar.caja) api.encuadrarCaja(o.lugar.caja);
        else api.centrar(o.lugar.lat, o.lugar.lon, 8);
        return { texto: `Lo llevé a ${o.lugar.nombre}${o.lugar.tipo === "municipio" ? ` (${o.lugar.detalle})` : ""}.` };
      }
      return { texto: `No encontré «${o.consulta}». Pruebe con el nombre de un municipio o departamento de Colombia, o con coordenadas como ${EJEMPLO_COORD}.` };
    }
    case "distancia": {
      const a = puntoDe(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: "No encontré alguno de los dos puntos." };
      const d = distanciaM(a.lat, a.lon, b.lat, b.lon);
      const r = rumbo(a.lat, a.lon, b.lat, b.lon);
      api.medir({ id: `m${Date.now().toString(36)}`, nombre: `${nombreDe(o.a)} – ${nombreDe(o.b)}`.slice(0, 60), tipo: "linea", puntos: [[a.lon, a.lat], [b.lon, b.lat]], visible: true });
      return {
        texto: `De ${nombreDe(o.a)} a ${nombreDe(o.b)} hay ${formatoDistancia(d)} en línea recta, con rumbo ${rumboTexto(r)}. La dejé dibujada como medición en la regla.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
      };
    }
    case "perfil": {
      const a = porId.get(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: "No encontré alguno de los dos extremos." };
      api.perfil(a, o.b.tipo === "nodo" ? (b as Antena) : { lat: b.lat, lon: b.lon });
      return { texto: `Abrí el perfil del terreno de ${a.nombre} a ${nombreDe(o.b)}: muestra la línea de vista, la zona de Fresnel y el margen.` };
    }
    case "senal":
      if (!antenas.some((a) => a.activa)) return { texto: "Primero inscriba al menos un nodo antena para calcular la señal." };
      api.senal(o.coord.lat, o.coord.lon);
      api.centrar(o.coord.lat, o.coord.lon);
      return { texto: `Calculé la señal en ${textoCoord(o.coord)}: está en la tarjeta «Señal en este punto», con el margen desde cada nodo.` };
    case "donde": {
      const p = puntoDe(o.ref);
      if (!p) return { texto: "No encontré ese punto." };
      const lugar = api.ubicacion(p.lat, p.lon);
      return { texto: lugar ? `${o.ref.tipo === "nodo" ? `«${nombreDe(o.ref)}»` : "Ese punto"} queda en ${lugar}.` : `${o.ref.tipo === "nodo" ? `«${nombreDe(o.ref)}»` : "Ese punto"} queda fuera de los municipios de Colombia que tengo cargados.` };
    }
    case "listar":
      if (!antenas.length) return { texto: "Aún no hay nodos. Escríbame, por ejemplo: «inscribe un nodo antena en 4.5123, -73.1234».", acciones: [{ texto: "Cargar el ejemplo", accion: "ejemplo" }] };
      return {
        texto: `Hay ${antenas.length} ${antenas.length === 1 ? "nodo" : "nodos"}: ${antenas
          .map((a) => `${a.nombre} (${(a.tipo ?? "antena") === "nodo" ? "nodo" : "nodo antena"}, ${fn(a.alturaM)} m, ${aDecimal(a.lat)}, ${aDecimal(a.lon)}${a.pasarela ? ", pasarela" : ""}${a.activa ? "" : ", excluido"})`)
          .join("; ")}.`,
      };
    case "herramienta":
      api.herramienta(o.herramienta);
      return {
        texto:
          o.herramienta === "regla"
            ? "Activé la regla. Elija Línea, Trayecto o Área y haga clic en el mapa; doble clic o Enter para terminar. Cada medición queda guardada y se puede editar o borrar."
            : o.herramienta === "inspeccionar"
              ? "Activé «Medir señal»: haga clic en el mapa para ver el margen desde cada nodo."
              : "Haga clic en el mapa donde va el nodo.",
      };
    case "ejemplo":
      api.ejemplo();
      return { texto: "Cargué la demostración: un nodo antena llamado «Ejemplo». En un momento le cuento su alcance.", acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes, esperar: "*" };
    case "nuevo":
      if (!o.confirmado)
        return { texto: "¿Seguro? Se quitarán todos los nodos y mediciones del escenario actual (puede deshacerlo).", acciones: [{ texto: "Sí, empezar de cero", accion: "orden", orden: { tipo: "nuevo", confirmado: true } }] };
      api.nuevo();
      return { texto: "Listo, escenario en blanco. Escríbame una coordenada para inscribir el primer nodo antena.", acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes };
    case "exportar":
      return api.exportar(o.formato)
        ? { texto: `Descargué el archivo ${o.formato.toUpperCase()}.` }
        : { texto: "Para exportar a Google Earth primero necesito una simulación al día.", acciones: [{ texto: "Simular ahora", accion: "simular" }] };
    case "borrar-mediciones":
      api.borrarMediciones();
      return { texto: "Borré todas las mediciones de la regla.", acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes };
    case "pieza": {
      const nombrePieza = { gateway: "el gateway", repetidor: "el repetidor", persona: "la persona" }[o.pieza];
      if (!o.coord) {
        api.armarPieza(o.pieza);
        return {
          texto: `Con gusto. Toque el mapa donde va ${nombrePieza}, o escríbame la coordenada, por ejemplo ${EJEMPLO_COORD}.${o.pieza === "repetidor" ? " Busque una loma o una torre que alcance al gateway o a otro repetidor conectado." : ""}`,
          pendiente: { tipo: "pieza", pieza: o.pieza, datos: o.datos },
        };
      }
      const { lat, lon } = o.coord;
      const lugar = api.ubicacion(lat, lon);
      const gw = antenas.find((a) => a.pasarela);
      if (o.pieza === "gateway" && gw && (o.mover || api.modo() === "sembrar")) {
        api.editar(gw.id, { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)), activa: true });
        api.centrar(lat, lon);
        return {
          texto: `Moví el gateway «${gw.nombre}» a ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}: ahí entra el internet. Calculo de nuevo quién queda conectado.`,
          acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
          deshacer: antes,
          esperar: gw.id,
        };
      }
      const nueva = api.ponerPieza(o.pieza, lat, lon, o.datos);
      const que = { gateway: "el gateway (Gateway + Internet)", repetidor: "el repetidor", persona: "la persona" }[o.pieza];
      return {
        texto: `Listo: puse ${que} «${nueva.nombre}» en ${textoCoord({ lat, lon })}${lugar ? `, en ${lugar}` : ""}, a ${fn(nueva.alturaM)} m.${o.coord.corregido ? " Tomé la longitud como oeste (negativa), como corresponde en Colombia." : ""} Ya calculo con el relieve real si queda conectad${o.pieza === "persona" ? "a" : "o"} al gateway.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: nueva.id,
      };
    }
    case "sembrar": {
      const r = api.red();
      if (!r.gateways.length) return { texto: "Primero hace falta el Gateway + Internet: es el punto de partida de la malla. Dígame dónde va, por ejemplo «pon el gateway en 4.2, -73.37».", acciones: [] };
      if (!r.alDia) {
        api.simular();
        return { texto: "Primero termino de calcular la red con el relieve real; pídamelo de nuevo en un momento.", esperar: "*" };
      }
      let destinos: DestinoSiembra[];
      if (o.destino === "faltantes") {
        if (!r.sinCobertura.length) return { texto: r.personas.length ? "Todas las personas ya están conectadas al gateway. 🙂 Si quiere llevar la red más lejos, dígame «lleva la red a» y una coordenada o un municipio." : "Todavía no hay personas en el mapa. Póngalas primero, por ejemplo «pon una persona en 4.25, -73.30»." };
        destinos = r.sinCobertura.map((a) => ({ lat: a.lat, lon: a.lon, nombre: a.nombre, antena: a }));
      } else if ("id" in o.destino) {
        const a = porId.get(o.destino.id);
        if (!a) return { texto: "No encontré ese nodo." };
        destinos = [{ lat: a.lat, lon: a.lon, nombre: a.nombre, antena: a }];
      } else destinos = [{ lat: o.destino.coord.lat, lon: o.destino.coord.lon, nombre: o.destino.nombre }];
      api.cambiarModo("sembrar");
      const luego = api.sembrar(destinos).then((s) => (s ? textoSiembra(s, destinos) : { texto: "No pude calcular la propuesta. Revise que el gateway esté puesto y la red calculada." }));
      return {
        texto: `Busco lomas con buen enlace desde la red conectada hacia ${destinos.length === 1 ? (destinos[0].nombre ?? "ese punto") : `${destinos.length} personas`}. En un momento le muestro la propuesta en el mapa.`,
        luego,
      };
    }
    case "aceptar-siembra": {
      const puestos = api.aceptarSiembra();
      if (!puestos) return { texto: "No tengo una propuesta pendiente. Pídame, por ejemplo, «conecta a los que faltan»." };
      return {
        texto: `Listo: puse ${puestos === 1 ? "1 nodo" : `${puestos} nodos`}. Calculo la red de nuevo y le cuento quién queda conectado.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: "*",
      };
    }
    case "descartar-siembra":
      api.descartarSiembra();
      return { texto: "Descarté la propuesta. Puede poner los repetidores a mano con la pieza «Repetidor»." };
    case "mensaje": {
      const r = api.red();
      if (!r.alDia) {
        api.simular();
        return { texto: "Primero calculo la red; pídame el mensaje otra vez en un momento.", esperar: "*" };
      }
      const desde =
        (o.id ? porId.get(o.id) : undefined) ??
        [...r.conectadas, ...r.lejos].sort((a, b) => (r.porNodo.get(b.id)?.saltos ?? 0) - (r.porNodo.get(a.id)?.saltos ?? 0))[0] ??
        r.personas[0] ??
        r.repetidores[0];
      if (!desde) return { texto: "Ponga al menos una persona para enviar un mensaje al gateway." };
      if (desde.pasarela) return { texto: `«${desde.nombre}» es el gateway: el mensaje ya está en internet. Elija una persona o un repetidor.` };
      api.cambiarModo("sembrar");
      const v = api.enviarMensaje(desde.id);
      if (!v) return { texto: "Primero calculo la red; pídame el mensaje otra vez en un momento." };
      const nombres = new Map(antenas.map((a) => [a.id, a.nombre]));
      const ruta = v.ruta.map((id) => nombres.get(id) ?? id).join(" → ");
      const tiempoTxt = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${f1(ms / 1000)} s`);
      if (!v.llega)
        return {
          texto: `Envié un mensaje desde «${desde.nombre}» y no llega: ${v.motivo ?? "no tiene ruta"}${v.ruta.length > 1 ? ` (ruta: ${ruta})` : ""}.${r.porNodo.get(desde.id)?.estado === "sin-cobertura" ? " ¿Quiere que siembre un repetidor hacia esa persona?" : ""}`,
          acciones: r.porNodo.get(desde.id)?.estado === "sin-cobertura" ? [{ texto: `Conectar a ${desde.nombre}`, accion: "orden", orden: { tipo: "sembrar", destino: { id: desde.id } } }] : undefined,
        };
      const pct = (p: number) => (p >= 0.999 ? "más de 99,9 %" : `${f1(p * 100, 0)} %`);
      return {
        texto: `Envié un mensaje de texto de 40 caracteres desde «${desde.nombre}»: llega al gateway en ${v.saltos} ${v.saltos === 1 ? "salto" : "saltos"} (${ruta}), en ≈ ${tiempoTxt(v.totalMs.tipica)}${v.totalMs.max - v.totalMs.min >= 1 ? ` (entre ${tiempoTxt(v.totalMs.min)} y ${tiempoTxt(v.totalMs.max)})` : ""}. Llega al primer intento ${pct(v.probabilidad)} de las veces y ${pct(v.probabilidadReintentos)} con 3 intentos. Con ${v.preset} cada salto ocupa ${tiempoTxt(v.aireMs)} en el aire (${v.bytes} bytes). Cada nodo lo retransmite una sola vez y los repetidores (ROUTER) salen primero; si el paquete pasara de ${v.limiteSaltos} saltos, se descartaría. La IA del gateway le contesta por la misma ruta: ≈ ${tiempoTxt(v.totalMs.tipica)} de vuelta por radio, más lo que tarde en pensar. Lo puede ver en el mapa: el sobre va, la nube «IA» se enciende y la respuesta regresa.`,
      };
    }
    case "modo":
      api.cambiarModo(o.modo);
      return {
        texto:
          o.modo === "sembrar"
            ? "Listo, modo «Sembrar la malla»: primero el Gateway + Internet, luego los repetidores y al final la gente. Le voy guiando paso a paso en el panel de la izquierda."
            : "Listo, modo avanzado: tiene la lista de nodos, todos los parámetros y las herramientas del simulador. Para volver, toque «Sembrar la malla» arriba del panel.",
      };
    case "ejemplo-malla":
      api.ejemploMalla();
      return {
        texto: "Cargué el ejemplo de malla: el gateway donde entra el internet, un repetidor en torre hacia el oriente y tres personas; la más lejana queda sin cobertura para que practique «Conectar a los que faltan». En un momento le cuento cómo quedó.",
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: "*",
      };
    case "que-hago": {
      const r = api.red();
      const c = consejoRed(r, api.parametros().limiteSaltos);
      const acciones: Respuesta["acciones"] = [];
      if (r.alDia && r.sinCobertura.length) acciones.push({ texto: "Conectar a los que faltan", accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } });
      if (r.alDia && r.conectadas.length) acciones.push({ texto: "Enviar un mensaje de prueba", accion: "orden", orden: { tipo: "mensaje" } });
      return { texto: `${c.paso ? `Paso ${c.paso}: ` : ""}${c.titulo}. ${c.texto}`, acciones: acciones.length ? acciones : undefined };
    }
    case "coordenada-sola": {
      const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
      return {
        texto: `Entendí la coordenada ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}${o.coord.corregido ? " (tomé la longitud como oeste)" : ""}. ¿Qué hago con ella?`,
        acciones: [
          { texto: "Inscribir un nodo antena", accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "antena" } } },
          { texto: "Inscribir un nodo de campo", accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "nodo" } } },
          { texto: "Ir a ese punto", accion: "orden", orden: { tipo: "ir", coord: o.coord } },
          { texto: "Señal en ese punto", accion: "orden", orden: { tipo: "senal", coord: o.coord } },
        ],
      };
    }
  }
}
