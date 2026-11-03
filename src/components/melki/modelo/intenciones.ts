// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Lo que se puede pedir en el simulador, como intenciones del Modelo Melki. El modelo elige la intención; con los datos
// del pedido (ranuras.ts) cada intención arma la orden en las palabras que Melki ya entiende (y que el intérprete
// verifica antes de hacerla), da la orden directa o dice qué tema del cerebro contesta. Las que borran o reemplazan algo
// («delicadas») nunca se hacen solas: se ofrecen con un botón.
// La orden siempre se arma en español (`frase`: es la que el intérprete hace, también con la pantalla en inglés); para
// mostrarla en inglés, cada una trae la misma orden dicha en inglés (`fraseEn`, solo para leer). Los nombres y los
// ejemplos se muestran en el idioma de la pantalla.
import { tx } from "@/lib/idioma";
import type { Orden } from "../ordenes";
import type { Ranuras } from "./ranuras";

export type GrupoIntencion = "diseno" | "piezas" | "red" | "gente" | "ajustes" | "mapa" | "escenario" | "melki" | "pregunta" | "fuera";

export type Intencion = {
  id: string;
  grupo: GrupoIntencion;
  /** Qué hace, en pocas palabras (el botón de «¿Quiso decir…?» cuando no hay una frase más precisa). */
  nombre: string;
  /** Borra o reemplaza algo: se ofrece con un botón, nunca se hace sola. */
  delicada?: boolean;
  /** La orden en las palabras de Melki, o null si faltan datos que no se pueden suponer. */
  frase?: (r: Ranuras) => string | null;
  /**
   * La misma orden dicha en inglés, solo para mostrarla con la pantalla en inglés (la que se hace es `frase`). Es null
   * exactamente cuando `frase` lo es.
   */
  fraseEn?: (r: Ranuras) => string | null;
  /** La orden ya armada (las que no se dicen con una frase, como aceptar la propuesta). */
  directa?: (r: Ranuras) => Orden | null;
  /** El tema del cerebro que la contesta. */
  tema?: string;
  /** Cómo decirla con todos sus datos, para cuando falta uno («borra el Repetidor 2»). */
  ejemplo?: string;
};

/** «el Repetidor 2», «la Persona 1». */
export const elNodo = (n: string) => `${/^(persona|antena|torre)\b/i.test(n) ? "la" : "el"} ${n}`;
/** «del Repetidor 2», «de la Persona 1». */
export const deNodo = (n: string) => (/^(persona|antena|torre)\b/i.test(n) ? `de la ${n}` : `del ${n}`);

const unir = (...partes: (string | false | undefined | null)[]) => partes.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

/** Lo que acompaña un diseño: la señal, el respaldo, la gente, la plata y «aunque cueste más». */
const extrasDiseno = (r: Ranuras) => unir(r.senal && `con ${r.senal}`, r.respaldo && "con respaldo", r.gente && `para ${r.gente}`, r.plata && `con un presupuesto de ${r.plata}`, r.aCualquierCosto && "aunque cueste más");

/** El centro de un diseño a la redonda: un nodo, un lugar, una coordenada o aquí (sin decirlo, el gateway o el mapa). */
function centroDiseno(r: Ranuras): string {
  if (r.nodos[0]) return deNodo(r.nodos[0]);
  if (r.lugar) return `en ${r.lugar}`;
  if (r.coord) return `de ${r.coord}`;
  if (r.aqui) return "de aquí";
  return "";
}

/** «Todo el municipio», «todo el pueblo», «el departamento entero». */
const TODO_EL_LUGAR = /\b(tod[oa]s? (el|la|los|las) (municipio|pueblo|departamento|region|zona|territorio|vereda|ciudad)|(municipio|pueblo|departamento) (entero|completo)|cubrir (el|la) (municipio|pueblo|departamento))\b/;

/** Dónde poner una pieza: a una distancia y rumbo de un nodo, en una coordenada o en un lugar. */
function dondePieza(r: Ranuras): string {
  if (r.dist && r.rumbo) return unir(`a ${r.dist.texto} al ${r.rumbo}`, r.referencia && deNodo(r.referencia));
  if (r.coord) return `en ${r.coord}`;
  if (r.lugar) return `en ${r.lugar}`;
  return "";
}

const conAltura = (r: Ranuras, texto: string) => (r.altura ? `${texto} a ${r.altura}` : texto);

/* La pieza se nombra («agrega un dron a la malla» no es un repetidor): con errores de dictado, pero se nombra */
const DICE_GATEWAY = /\b(gate\w*|get\w*|geit\w*|gueit\w*|pasarel\w*|starlink|estarlink|internet|principal)\b/;
const DICE_REPETIDOR = /\b(repe\w*|repi\w*|router\w*|ruter\w*|retransmi\w*|nodo\w*|antena\w*|torre\w*)\b/;
const DICE_PERSONA = /\b(person\w*|perzon\w*|usuari\w*|familia\w*|casa\w*|viviend\w*|vecin\w*|client\w*|billeter\w*|habitant\w*|finca\w*|gente)\b/;

/* ───────────── La orden en inglés, para mostrarla (los datos llegan como los saca ranuras.ts, en español) ───────────── */

/** Un número escrito en español («1.200», «2,5», «11 mil») con el formato del inglés («1,200», «2.5», «11,000»). */
function numeroEn(s: string): string {
  const t = s.trim();
  const mil = /\s*mil(es)?$/.test(t);
  const base = t.replace(/\s*mil(es)?$/, "");
  let v: number;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(base)) v = Number(base.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(,\d{3}){2,}(\.\d+)?$/.test(base)) v = Number(base.replace(/,/g, ""));
  else v = Number(base.replace(",", "."));
  if (!Number.isFinite(v)) return s;
  return (mil ? v * 1000 : v).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const NUMERO_DICHO = /^(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?:\s*mil(?:es)?\b)?/;

/** Una cantidad con su unidad («3 millas» → «3 miles»), con la unidad en singular o plural según el número. */
function conUnidadEn(texto: string, unidades: [RegExp, string, string][]): string {
  const m = texto.trim().match(new RegExp(String.raw`${NUMERO_DICHO.source}\s*(.+)$`));
  if (!m) return texto;
  const dicho = m[0].slice(0, m[0].length - m[2].length).trim();
  const n = numeroEn(dicho);
  const u = m[2].trim().toLowerCase();
  for (const [re, uno, varios] of unidades) if (re.test(u)) return `${n} ${n === "1" ? uno : varios}`;
  return `${n} ${m[2].trim()}`;
}

const LONGITUD_EN: [RegExp, string, string][] = [
  [/^millas? n[aá]uticas?$/, "nautical mile", "nautical miles"],
  [/^(kil[oó]metros?|kms?)$/, "km", "km"],
  [/^millas?$/, "mile", "miles"],
  [/^(metros?|mts?|m)$/, "m", "m"],
  [/^yardas?$/, "yard", "yards"],
  [/^pies?$/, "foot", "feet"],
  [/^cuadras?$/, "block", "blocks"],
];
const AREA_EN: [RegExp, string, string][] = [
  [/^hect[aá]r[eií]?as?$/, "hectare", "hectares"],
  [/^has?$/, "ha", "ha"],
  [/^(km\s?2|km²|kms?\s+cuadrados?|kil[oó]metros?\s+cuadrados?)$/, "km²", "km²"],
  [/^(m\s?2|m²|metros?\s+cuadrados?)$/, "m²", "m²"],
  [/^(mi\s?2|mi²|millas?\s+cuadradas?)$/, "square mile", "square miles"],
  [/^(yd\s?2|yd²|yardas?\s+cuadradas?)$/, "square yard", "square yards"],
  [/^(ft\s?2|ft²|pies?\s+cuadrados?)$/, "square foot", "square feet"],
  [/^fanegadas?$/, "fanegada", "fanegadas"],
  [/^acres?$/, "acre", "acres"],
];

/** «3 millas» → «3 miles»; «1,5 km» → «1.5 km». */
const distEn = (t: string) => conUnidadEn(t, LONGITUD_EN);

/** «500 hectareas» → «500 hectares»; «un área de 2 km x 1 km» → «an area of 2 km x 1 km»; «un cuadrado de 3 km de lado» → «a square 3 km on each side». */
function areaEn(t: string): string {
  const rect = t.match(/^un [aá]rea de (.+?) x (.+)$/);
  if (rect) return `an area of ${distEn(rect[1])} x ${distEn(rect[2])}`;
  const lado = t.match(/^un cuadrado de (.+?) de lado$/);
  if (lado) return `a square ${distEn(lado[1])} on each side`;
  return conUnidadEn(t, AREA_EN);
}

const GENTE_EN: [RegExp, string, string][] = [
  [/^usuarios?$/, "user", "users"],
  [/^personas?$/, "person", "people"],
  [/^familias?$/, "family", "families"],
  [/^hogares?$/, "household", "households"],
  [/^billeteras?$/, "wallet", "wallets"],
  [/^clientes?$/, "customer", "customers"],
  [/^habitantes?$/, "resident", "residents"],
  [/^(suscriptores?|abonados?)$/, "subscriber", "subscribers"],
  [/^dispositivos?$/, "device", "devices"],
  [/^sensor(es)?$/, "sensor", "sensors"],
];
/** «400 familias» → «400 families». */
const genteEn = (t: string) => conUnidadEn(t, GENTE_EN);

/** El presupuesto como se dijo («80 millones», «$120.000.000», «usd 25.000») en inglés: «80 million pesos», «USD 25,000». */
function plataEn(t: string): string {
  const s = t.toLowerCase();
  const dolares = /usd|us\$|d[oó]lares/.test(s);
  const m = s.match(/(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?:\s*(mil)\b(?!\s+millones))?\s*(mil\s+millones|millones|mill[oó]n|mm?\b|k\b)?/);
  if (!m) return t;
  let v = Number(numeroEn(m[1]).replace(/,/g, "")) * (m[2] ? 1000 : 1);
  const escala = m[3] ?? "";
  if (/^mil\s+millones/.test(escala)) v *= 1e9;
  else if (/^(mill|mm?$)/.test(escala)) v *= 1e6;
  else if (escala === "k") v *= 1e3;
  if (!(v > 0)) return t;
  const en = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (dolares) return `USD ${en(v)}`;
  if (v >= 1e9) return `${en(v / 1e9)} billion pesos`;
  if (v >= 1e6) return `${en(v / 1e6)} million pesos`;
  return `COP ${en(v)}`;
}

/** «95 %» → «95%»; «12,5 m» → «12.5 m». */
const pctEn = (t: string) => `${numeroEn(t.replace(/\s*%$/, ""))}%`;
const alturaEn = (t: string) => `${numeroEn(t.replace(/\s*m$/, ""))} m`;

const RUMBO_EN: Record<string, string> = {
  norte: "north",
  sur: "south",
  este: "east",
  oriente: "east",
  oeste: "west",
  occidente: "west",
  noreste: "northeast",
  nororiente: "northeast",
  noroeste: "northwest",
  noroccidente: "northwest",
  sureste: "southeast",
  suroriente: "southeast",
  sudeste: "southeast",
  suroeste: "southwest",
  suroccidente: "southwest",
  sudoeste: "southwest",
};
const rumboEn = (t: string) => RUMBO_EN[t] ?? t;

const SENAL_EN: Record<string, string> = { "señal media": "fair signal", "señal estable": "stable signal", "señal buena": "good signal", "señal confiable": "reliable signal" };
const senalEn = (t: string) => SENAL_EN[t] ?? t;

const CAPA_EN: Record<string, string> = {
  "lo rojo": "the areas with no service",
  "las vías": "the roads",
  "los ríos": "the rivers",
  "los límites": "the boundaries",
  "los nombres": "the place names",
  "los enlaces": "the links",
  "el alcance": "the range",
  "los círculos de estudio": "the study circles",
  "el relieve en 3d": "the 3D terrain",
  "los anillos": "the rings",
  "los haces": "the antenna beams",
};
const capaEn = (t: string) => CAPA_EN[t] ?? t;

const FONDO_EN: Record<string, string> = { satelital: "satellite", topográfico: "topographic", "de calles": "street", "de curvas de nivel": "contour line" };
const fondoEn = (t: string) => FONDO_EN[t] ?? t;

const TRAFICO_EN: Record<Ranuras["trafico"], string> = { pagos: "payments", "mensajes de WhatsApp": "WhatsApp messages", "consultas a la IA": "AI queries" };

/** El nodo como se llama en el mapa («Repeater 3», «Repetidor 3», «La Loma»); el gateway, «the Gateway». */
const nodoEn = (n: string) => (/^gateway$/i.test(n) ? `the ${n}` : n);

const cantidadEn = (n: number) => n.toLocaleString("en-US");

/** Dónde poner una pieza, en inglés: «2 km north of Repeater 1», «at 4.2500, -73.3000», «in Cumaral». */
function dondePiezaEn(r: Ranuras): string {
  if (r.dist && r.rumbo) return unir(`${distEn(r.dist.texto)} ${rumboEn(r.rumbo)}`, r.referencia && `of ${nodoEn(r.referencia)}`);
  if (r.coord) return `at ${r.coord}`;
  if (r.lugar) return `in ${r.lugar}`;
  return "";
}

const conAlturaEn = (r: Ranuras, texto: string) => (r.altura ? `${texto} with the antenna at ${alturaEn(r.altura)}` : texto);

/** El centro de un diseño a la redonda, en inglés. */
function centroEn(r: Ranuras): string {
  if (r.nodos[0]) return `around ${nodoEn(r.nodos[0])}`;
  if (r.lugar) return `in ${r.lugar}`;
  if (r.coord) return `around ${r.coord}`;
  if (r.aqui) return "around here";
  return "";
}

const extrasEn = (r: Ranuras) => unir(r.senal && `with ${senalEn(r.senal)}`, r.respaldo && "with backup", r.gente && `for ${genteEn(r.gente)}`, r.plata && `with a budget of ${plataEn(r.plata)}`, r.aCualquierCosto && "even if it costs more");

/** Una pregunta que contesta el cerebro: su tema y su nombre en el idioma de la pantalla. */
const pregunta = (id: string, es: string, en: string, tema: string): Intencion => ({
  id,
  grupo: "pregunta",
  get nombre() {
    return tx(es, en);
  },
  tema,
});

export const INTENCIONES: Intencion[] = [
  /* ───────────── Diseño de la red ───────────── */
  {
    id: "disenar",
    grupo: "diseno",
    get nombre() {
      return tx("Armar una red sostenible", "Build a sustainable network");
    },
    frase: (r) => {
      if (TODO_EL_LUGAR.test(r.tn)) return unir("ármame una red sostenible que cubra todo el", r.departamento || /\bdepartamento\b/.test(r.tn) ? "departamento" : "municipio", r.lugar && `de ${r.lugar}`, r.gente && `para ${r.gente}`, r.plata && `con un presupuesto de ${r.plata}`);
      if (r.area) return unir(`ármame una red que cubra ${r.area}`, r.pct ? `con ${r.senal ?? "señal media o mejor"} en el ${r.pct}` : r.senal && `con ${r.senal}`, r.lugar && `en ${r.lugar}`, r.respaldo && "con respaldo", r.gente && `para ${r.gente}`, r.plata && `con un presupuesto de ${r.plata}`, r.aCualquierCosto && "aunque cueste más");
      if (r.dist) return unir(`ármame una red de ${r.dist.texto}`, r.dist.diametro ? "de diámetro" : "a la redonda", centroDiseno(r), extrasDiseno(r));
      return unir("hazme una red sostenible", r.lugar && `en ${r.lugar}`, r.gente && `para ${r.gente}`, r.plata && `con un presupuesto de ${r.plata}`);
    },
    fraseEn: (r) => {
      if (TODO_EL_LUGAR.test(r.tn)) return unir("build me a sustainable network that covers the whole", r.departamento || /\bdepartamento\b/.test(r.tn) ? "department" : "municipality", r.lugar && `of ${r.lugar}`, r.gente && `for ${genteEn(r.gente)}`, r.plata && `with a budget of ${plataEn(r.plata)}`);
      if (r.area) return unir(`build me a network that covers ${areaEn(r.area)}`, r.pct ? `with ${r.senal ? senalEn(r.senal) : "fair or better signal"} over ${pctEn(r.pct)} of it` : r.senal && `with ${senalEn(r.senal)}`, r.lugar && `in ${r.lugar}`, r.respaldo && "with backup", r.gente && `for ${genteEn(r.gente)}`, r.plata && `with a budget of ${plataEn(r.plata)}`, r.aCualquierCosto && "even if it costs more");
      if (r.dist) return unir(r.dist.diametro ? `build me a network ${distEn(r.dist.texto)} in diameter` : `build me a network with a radius of ${distEn(r.dist.texto)}`, centroEn(r), extrasEn(r));
      return unir("build me a sustainable network", r.lugar && `in ${r.lugar}`, r.gente && `for ${genteEn(r.gente)}`, r.plata && `with a budget of ${plataEn(r.plata)}`);
    },
  },
  /* ───────────── Piezas de la malla ───────────── */
  {
    id: "poner-gateway",
    grupo: "piezas",
    get nombre() {
      return tx("Poner el gateway", "Place the gateway");
    },
    frase: (r) => (DICE_GATEWAY.test(r.tnPieza) ? conAltura(r, unir("pon el gateway", dondePieza(r))) : null),
    fraseEn: (r) => (DICE_GATEWAY.test(r.tnPieza) ? conAlturaEn(r, unir("place the gateway", dondePiezaEn(r))) : null),
  },
  {
    id: "poner-repetidor",
    grupo: "piezas",
    get nombre() {
      return tx("Agregar un repetidor", "Add a repeater");
    },
    frase: (r) => (DICE_REPETIDOR.test(r.tnPieza) ? conAltura(r, unir("agrega un repetidor", dondePieza(r))) : null),
    fraseEn: (r) => (DICE_REPETIDOR.test(r.tnPieza) ? conAlturaEn(r, unir("add a repeater", dondePiezaEn(r))) : null),
  },
  {
    id: "poner-persona",
    grupo: "piezas",
    get nombre() {
      return tx("Poner una persona", "Place a person");
    },
    frase: (r) => (DICE_PERSONA.test(r.tnPieza) ? unir("pon una persona", dondePieza(r)) : null),
    fraseEn: (r) => (DICE_PERSONA.test(r.tnPieza) ? unir("place a person", dondePiezaEn(r)) : null),
  },
  {
    id: "sembrar",
    grupo: "piezas",
    get nombre() {
      return tx("Conectar a los que faltan", "Connect everyone who's missing");
    },
    frase: () => "conecta a los que faltan",
    fraseEn: () => "connect everyone who's missing",
  },
  {
    id: "mover-nodo",
    grupo: "piezas",
    get nombre() {
      return tx("Mover un nodo", "Move a node");
    },
    get ejemplo() {
      return tx("mueve el Repetidor 2 a 4.3, -73.2» o «mueve el Repetidor 2 a 1 km al norte", "move Repeater 2 to 4.3, -73.2” or “move Repeater 2 1 km north");
    },
    frase: (r) => {
      if (!r.nodos[0]) return null;
      if (r.coord) return `mueve ${elNodo(r.nodos[0])} a ${r.coord}`;
      if (r.dist && r.rumbo) return unir(`mueve ${elNodo(r.nodos[0])} a ${r.dist.texto} al ${r.rumbo}`, r.referencia && r.referencia !== r.nodos[0] && deNodo(r.referencia));
      if (r.lugar) return `mueve ${elNodo(r.nodos[0])} a ${r.lugar}`;
      return null;
    },
    fraseEn: (r) => {
      if (!r.nodos[0]) return null;
      if (r.coord) return `move ${nodoEn(r.nodos[0])} to ${r.coord}`;
      if (r.dist && r.rumbo) return unir(`move ${nodoEn(r.nodos[0])} ${distEn(r.dist.texto)} ${rumboEn(r.rumbo)}`, r.referencia && r.referencia !== r.nodos[0] && `of ${nodoEn(r.referencia)}`);
      if (r.lugar) return `move ${nodoEn(r.nodos[0])} to ${r.lugar}`;
      return null;
    },
  },
  {
    id: "borrar-nodo",
    grupo: "piezas",
    get nombre() {
      return tx("Borrar un nodo", "Delete a node");
    },
    get ejemplo() {
      return tx("borra el Repetidor 2", "delete Repeater 2");
    },
    delicada: true,
    frase: (r) => (r.nodos[0] ? `borra ${elNodo(r.nodos[0])}` : null),
    fraseEn: (r) => (r.nodos[0] ? `delete ${nodoEn(r.nodos[0])}` : null),
  },
  {
    id: "borrar-personas",
    grupo: "piezas",
    get nombre() {
      return tx("Borrar todas las personas", "Delete all the people");
    },
    delicada: true,
    frase: () => "borra todas las personas",
    fraseEn: () => "delete all the people",
  },
  {
    id: "borrar-repetidores",
    grupo: "piezas",
    get nombre() {
      return tx("Borrar todos los repetidores", "Delete all the repeaters");
    },
    delicada: true,
    frase: () => "borra todos los repetidores",
    fraseEn: () => "delete all the repeaters",
  },
  {
    id: "renombrar",
    grupo: "piezas",
    get nombre() {
      return tx("Cambiar el nombre de un nodo", "Rename a node");
    },
    get ejemplo() {
      return tx("renombra el Repetidor 2 como \"La Loma\"", "rename Repeater 2 to “La Loma”");
    },
    frase: (r) => (r.nodos[0] && r.nombre ? `renombra ${elNodo(r.nodos[0])} como "${r.nombre}"` : null),
    fraseEn: (r) => (r.nodos[0] && r.nombre ? `rename ${nodoEn(r.nodos[0])} to “${r.nombre}”` : null),
  },
  {
    id: "altura",
    grupo: "piezas",
    get nombre() {
      return tx("Cambiar la altura de las antenas", "Change the antenna height");
    },
    get ejemplo() {
      return tx("sube el Repetidor 2 a 12 m» o «sube todos los repetidores a 15 m", "raise Repeater 2 to 12 m” or “raise all the repeaters to 15 m");
    },
    frase: (r) => {
      if (!r.altura) return null;
      const verbo = /\b(baj\w*|reduc\w*|disminu\w*|rebaj\w*|menos alt\w*)\b/.test(r.tn) ? "baja" : "sube";
      if (r.nodos[0]) return `${verbo} ${elNodo(r.nodos[0])} a ${r.altura}`;
      // Todas solo si se dijo (un nodo mal escrito no vuelve el pedido «todos los repetidores»)
      return /\b(todos|todas|cada|los repetidores|las antenas|las torres|los nodos)\b/.test(r.tn) ? `${verbo} todos los repetidores a ${r.altura}` : null;
    },
    fraseEn: (r) => {
      if (!r.altura) return null;
      const verbo = /\b(baj\w*|reduc\w*|disminu\w*|rebaj\w*|menos alt\w*)\b/.test(r.tn) ? "lower" : "raise";
      if (r.nodos[0]) return `${verbo} ${nodoEn(r.nodos[0])} to ${alturaEn(r.altura)}`;
      return /\b(todos|todas|cada|los repetidores|las antenas|las torres|los nodos)\b/.test(r.tn) ? `${verbo} all the repeaters to ${alturaEn(r.altura)}` : null;
    },
  },
  {
    id: "duplicar",
    grupo: "piezas",
    get nombre() {
      return tx("Duplicar un nodo", "Duplicate a node");
    },
    get ejemplo() {
      return tx("duplica el Repetidor 2", "duplicate Repeater 2");
    },
    frase: (r) => (r.nodos[0] ? `duplica ${elNodo(r.nodos[0])}` : null),
    fraseEn: (r) => (r.nodos[0] ? `duplicate ${nodoEn(r.nodos[0])}` : null),
  },
  {
    id: "apuntar",
    grupo: "piezas",
    get nombre() {
      return tx("Apuntar una antena hacia otro nodo", "Point an antenna at another node");
    },
    get ejemplo() {
      return tx("apunta el Repetidor 2 hacia el Gateway", "point Repeater 2 at the Gateway");
    },
    frase: (r) => (r.nodos.length >= 2 ? `apunta ${elNodo(r.nodos[0])} hacia ${elNodo(r.nodos[1])}` : null),
    fraseEn: (r) => (r.nodos.length >= 2 ? `point ${nodoEn(r.nodos[0])} at ${nodoEn(r.nodos[1])}` : null),
  },
  {
    id: "mensaje",
    grupo: "piezas",
    get nombre() {
      return tx("Enviar un mensaje de prueba", "Send a test message");
    },
    frase: (r) => (r.nodos[0] && !/^gateway$/i.test(r.nodos[0]) ? `envía un mensaje de prueba desde ${elNodo(r.nodos[0])}` : "envía un mensaje de prueba"),
    fraseEn: (r) => (r.nodos[0] && !/^gateway$/i.test(r.nodos[0]) ? `send a test message from ${nodoEn(r.nodos[0])}` : "send a test message"),
  },
  {
    id: "info-nodo",
    grupo: "piezas",
    get nombre() {
      return tx("Contar cómo está un nodo", "Tell how a node is doing");
    },
    get ejemplo() {
      return tx("¿cómo está el Repetidor 2?", "how is Repeater 2 doing?");
    },
    frase: (r) => (r.nodos[0] ? `¿cómo está ${elNodo(r.nodos[0])}?` : null),
    fraseEn: (r) => (r.nodos[0] ? `how is ${nodoEn(r.nodos[0])} doing?` : null),
  },
  /* ───────────── La red: simular, resultados y medidas ───────────── */
  {
    id: "simular",
    grupo: "red",
    get nombre() {
      return tx("Simular la red", "Simulate the network");
    },
    frase: () => "simula",
    fraseEn: () => "simulate",
  },
  {
    id: "auto-on",
    grupo: "red",
    get nombre() {
      return tx("Simular solo con cada cambio", "Simulate on every change");
    },
    frase: () => "activa simular al cambiar",
    fraseEn: () => "turn on simulate on change",
  },
  {
    id: "auto-off",
    grupo: "red",
    get nombre() {
      return tx("No simular solo con cada cambio", "Stop simulating on every change");
    },
    frase: () => "desactiva simular al cambiar",
    fraseEn: () => "turn off simulate on change",
  },
  {
    id: "costo-red",
    grupo: "red",
    get nombre() {
      return tx("Decir cuánto cuesta la red", "Tell how much the network costs");
    },
    frase: (r) => (r.lugar && r.departamento ? `¿cuánto cuesta la red para ${r.lugar}?` : "¿cuánto cuesta la red?"),
    fraseEn: (r) => (r.lugar && r.departamento ? `how much does the network cost for ${r.lugar}?` : "how much does the network cost?"),
  },
  {
    id: "listar",
    grupo: "red",
    get nombre() {
      return tx("Decir qué nodos hay", "List the nodes");
    },
    frase: () => "¿qué nodos hay?",
    fraseEn: () => "what nodes are there?",
  },
  {
    id: "donde-nodo",
    grupo: "red",
    get nombre() {
      return tx("Mostrar dónde está un nodo", "Show where a node is");
    },
    get ejemplo() {
      return tx("¿dónde está el Repetidor 2?", "where is Repeater 2?");
    },
    frase: (r) => (r.nodos[0] ? `¿dónde está ${elNodo(r.nodos[0])}?` : null),
    fraseEn: (r) => (r.nodos[0] ? `where is ${nodoEn(r.nodos[0])}?` : null),
  },
  {
    id: "senal-punto",
    grupo: "red",
    get nombre() {
      return tx("Decir qué señal hay en un punto", "Tell the signal at a point");
    },
    get ejemplo() {
      return tx("¿qué señal hay en 4.25, -73.30?", "what's the signal at 4.25, -73.30?");
    },
    frase: (r) => (r.coord ? `¿qué señal hay en ${r.coord}?` : null),
    fraseEn: (r) => (r.coord ? `what's the signal at ${r.coord}?` : null),
  },
  {
    id: "distancia",
    grupo: "red",
    get nombre() {
      return tx("Medir la distancia entre dos nodos", "Measure the distance between two nodes");
    },
    get ejemplo() {
      return tx("distancia entre el Gateway y el Repetidor 2", "distance between the Gateway and Repeater 2");
    },
    frase: (r) => (r.nodos.length >= 2 ? `distancia entre ${elNodo(r.nodos[0])} y ${elNodo(r.nodos[1])}` : null),
    fraseEn: (r) => (r.nodos.length >= 2 ? `distance between ${nodoEn(r.nodos[0])} and ${nodoEn(r.nodos[1])}` : null),
  },
  {
    id: "perfil",
    grupo: "red",
    get nombre() {
      return tx("Ver el perfil del enlace entre dos nodos", "See the link profile between two nodes");
    },
    get ejemplo() {
      return tx("perfil entre el Gateway y el Repetidor 2", "profile between the Gateway and Repeater 2");
    },
    frase: (r) => (r.nodos.length >= 2 ? `perfil entre ${elNodo(r.nodos[0])} y ${elNodo(r.nodos[1])}` : null),
    fraseEn: (r) => (r.nodos.length >= 2 ? `profile between ${nodoEn(r.nodos[0])} and ${nodoEn(r.nodos[1])}` : null),
  },
  {
    id: "informe",
    grupo: "red",
    get nombre() {
      return tx("Hacer el informe de radioenlace", "Make the radio link report");
    },
    get ejemplo() {
      return tx("informe de radioenlace entre el Gateway y el Repetidor 2", "radio link report between the Gateway and Repeater 2");
    },
    frase: (r) => (r.nodos.length >= 2 ? `informe de radioenlace entre ${elNodo(r.nodos[0])} y ${elNodo(r.nodos[1])}` : null),
    fraseEn: (r) => (r.nodos.length >= 2 ? `radio link report between ${nodoEn(r.nodos[0])} and ${nodoEn(r.nodos[1])}` : null),
  },
  {
    id: "encuadrar",
    grupo: "red",
    get nombre() {
      return tx("Mostrar toda la red", "Show the whole network");
    },
    frase: () => "muéstrame toda la red",
    fraseEn: () => "show me the whole network",
  },
  {
    id: "que-hago",
    grupo: "red",
    get nombre() {
      return tx("Decir qué sigue", "Tell what's next");
    },
    directa: () => ({ tipo: "que-hago" }),
  },
  {
    id: "estado-red",
    grupo: "red",
    get nombre() {
      return tx("Contar cómo quedó la red", "Tell how the network turned out");
    },
    tema: "estado",
  },
  /* ───────────── Gente, carga y capacidad ───────────── */
  {
    id: "poblar",
    grupo: "gente",
    get nombre() {
      return tx("Poblar la zona con personas", "Populate the area with people");
    },
    frase: (r) => (r.cantidad ? `puebla la zona con ${r.cantidad} personas` : "puebla la zona"),
    fraseEn: (r) => (r.cantidad ? `populate the area with ${cantidadEn(r.cantidad)} people` : "populate the area"),
  },
  {
    id: "zonas",
    grupo: "gente",
    get nombre() {
      return tx("Poner gente alrededor de los repetidores", "Put people around the repeaters");
    },
    frase: (r) => unir(`pon ${r.cantidad ?? 250} personas alrededor`, r.nodos[0] ? deNodo(r.nodos[0]) : "de cada repetidor", r.estres && "y haz la prueba de estrés"),
    fraseEn: (r) => unir(`put ${cantidadEn(r.cantidad ?? 250)} people around`, r.nodos[0] ? nodoEn(r.nodos[0]) : "each repeater", r.estres && "and run the stress test"),
  },
  {
    id: "estres",
    grupo: "gente",
    get nombre() {
      return tx("Hacer la prueba de estrés", "Run the stress test");
    },
    frase: () => "haz la prueba de estrés",
    fraseEn: () => "run the stress test",
  },
  {
    id: "carga",
    grupo: "gente",
    get nombre() {
      return tx("Probar cuánto tráfico aguanta", "Test how much traffic it can handle");
    },
    frase: (r) => (r.cantidad ? `envía ${r.cantidad} ${r.trafico} al tiempo` : `¿hasta cuántos ${r.trafico} aguanta?`),
    fraseEn: (r) => (r.cantidad ? `send ${cantidadEn(r.cantidad)} ${TRAFICO_EN[r.trafico] ?? r.trafico} at once` : `how many ${TRAFICO_EN[r.trafico] ?? r.trafico} can it handle?`),
  },
  {
    id: "quitar-zonas",
    grupo: "gente",
    get nombre() {
      return tx("Quitar las zonas de popularidad", "Remove the popularity zones");
    },
    delicada: true,
    frase: () => "quita las zonas",
    fraseEn: () => "remove the popularity zones",
  },
  {
    id: "quitar-pobladas",
    grupo: "gente",
    get nombre() {
      return tx("Quitar la gente poblada", "Remove the populated people");
    },
    delicada: true,
    frase: () => "quita las personas pobladas",
    fraseEn: () => "remove the populated people",
  },
  {
    id: "optimizar-carga",
    grupo: "gente",
    get nombre() {
      return tx("Optimizar la red para la carga", "Optimize the network for the load");
    },
    frase: () => "optimiza la red para la carga",
    fraseEn: () => "optimize the network for the load",
  },
  {
    id: "usuarios-estres",
    grupo: "gente",
    get nombre() {
      return tx("Decir a quiénes no les funciona", "Tell who it doesn't work for");
    },
    frase: () => "¿a quiénes no les funciona?",
    fraseEn: () => "who doesn't it work for?",
  },
  {
    id: "dimensionar",
    grupo: "gente",
    get nombre() {
      return tx("Dimensionar la red para los usuarios", "Size the network for the users");
    },
    get ejemplo() {
      return tx("dimensiona la red para 5.000 usuarios", "size the network for 5,000 users");
    },
    frase: (r) => (r.gente ? `dimensiona la red para ${r.gente}` : r.cantidad ? `dimensiona la red para ${r.cantidad} usuarios` : null),
    fraseEn: (r) => (r.gente ? `size the network for ${genteEn(r.gente)}` : r.cantidad ? `size the network for ${cantidadEn(r.cantidad)} users` : null),
  },
  /* ───────────── Ajustes de la red ───────────── */
  {
    id: "ajustar",
    grupo: "ajustes",
    get nombre() {
      return tx("Ajustar la red para que sea factible", "Adjust the network so it's feasible");
    },
    frase: (r) => (r.altura ? `ajústamelo sin pasar de ${r.altura}` : "ajústamelo"),
    fraseEn: (r) => (r.altura ? `adjust it for me without going over ${alturaEn(r.altura)}` : "adjust it for me"),
  },
  {
    id: "ajustar-economico",
    grupo: "ajustes",
    get nombre() {
      return tx("Dejar la red lo más económica posible", "Make the network as economical as possible");
    },
    frase: () => "dame la opción más económica",
    fraseEn: () => "give me the most economical option",
  },
  {
    id: "protocolo",
    grupo: "ajustes",
    get nombre() {
      return tx("Cambiar el protocolo de la malla", "Change the mesh protocol");
    },
    get ejemplo() {
      return tx("cambia a Meshtastic» o «cambia a MeshCore", "switch to Meshtastic” or “switch to MeshCore");
    },
    frase: (r) => (r.protocolo ? `cambia a ${r.protocolo}` : null),
    fraseEn: (r) => (r.protocolo ? `switch to ${r.protocolo}` : null),
  },
  {
    id: "relieve-plano",
    grupo: "ajustes",
    get nombre() {
      return tx("Simular con el terreno plano", "Simulate with flat terrain");
    },
    frase: () => "usa el relieve plano",
    fraseEn: () => "use flat terrain",
  },
  {
    id: "relieve-real",
    grupo: "ajustes",
    get nombre() {
      return tx("Simular con el relieve real", "Simulate with the real terrain");
    },
    frase: () => "usa el relieve real",
    fraseEn: () => "use the real terrain",
  },
  {
    id: "area-objetivo",
    grupo: "ajustes",
    get nombre() {
      return tx("Usar el área medida como área objetivo", "Use the measured area as the target area");
    },
    frase: () => "usa el área que medí como área objetivo",
    fraseEn: () => "use the area I measured as the target area",
  },
  {
    id: "quitar-area-objetivo",
    grupo: "ajustes",
    get nombre() {
      return tx("Quitar el área objetivo", "Remove the target area");
    },
    frase: () => "quita el área objetivo",
    fraseEn: () => "remove the target area",
  },
  {
    id: "aceptar-propuesta",
    grupo: "ajustes",
    get nombre() {
      return tx("Poner los repetidores propuestos", "Place the proposed repeaters");
    },
    directa: () => ({ tipo: "aceptar-siembra" }),
  },
  {
    id: "descartar-propuesta",
    grupo: "ajustes",
    get nombre() {
      return tx("Descartar la propuesta", "Discard the proposal");
    },
    directa: () => ({ tipo: "descartar-siembra" }),
  },
  {
    id: "descartar-ajuste",
    grupo: "ajustes",
    get nombre() {
      return tx("Descartar el ajuste propuesto", "Discard the proposed adjustment");
    },
    directa: () => ({ tipo: "descartar-ajuste" }),
  },
  /* ───────────── El mapa ───────────── */
  {
    id: "ir-lugar",
    grupo: "mapa",
    get nombre() {
      return tx("Llevar el mapa a un lugar", "Take the map to a place");
    },
    get ejemplo() {
      return tx("llévame a Villavicencio", "take me to Villavicencio");
    },
    frase: (r) => (r.lugar ? `llévame a ${r.lugar}` : r.coord ? `llévame a ${r.coord}` : null),
    fraseEn: (r) => (r.lugar ? `take me to ${r.lugar}` : r.coord ? `take me to ${r.coord}` : null),
  },
  {
    id: "capa-mostrar",
    grupo: "mapa",
    get nombre() {
      return tx("Mostrar una capa del mapa", "Show a map layer");
    },
    get ejemplo() {
      return tx("muestra las vías» o «muestra lo rojo", "show the roads” or “show the areas with no service");
    },
    frase: (r) => (r.capa ? `muestra ${r.capa}` : null),
    fraseEn: (r) => (r.capa ? `show ${capaEn(r.capa)}` : null),
  },
  {
    id: "capa-ocultar",
    grupo: "mapa",
    get nombre() {
      return tx("Ocultar una capa del mapa", "Hide a map layer");
    },
    get ejemplo() {
      return tx("oculta los ríos", "hide the rivers");
    },
    frase: (r) => (r.capa ? `oculta ${r.capa}` : null),
    fraseEn: (r) => (r.capa ? `hide ${capaEn(r.capa)}` : null),
  },
  {
    id: "fondo-mapa",
    grupo: "mapa",
    get nombre() {
      return tx("Cambiar el fondo del mapa", "Change the base map");
    },
    get ejemplo() {
      return tx("pon el mapa satelital", "show the satellite map");
    },
    frase: (r) => (r.fondo ? `pon el mapa ${r.fondo}` : null),
    fraseEn: (r) => (r.fondo ? `show the ${fondoEn(r.fondo)} map` : null),
  },
  {
    id: "paneles-ocultar",
    grupo: "mapa",
    get nombre() {
      return tx("Dejar solo el mapa", "Show only the map");
    },
    frase: () => "pantalla limpia",
    fraseEn: () => "show only the map",
  },
  {
    id: "paneles-mostrar",
    grupo: "mapa",
    get nombre() {
      return tx("Mostrar los paneles", "Show the panels");
    },
    frase: () => "muestra los paneles",
    fraseEn: () => "show the panels",
  },
  {
    id: "modo-avanzado",
    grupo: "mapa",
    get nombre() {
      return tx("Pasar al modo avanzado", "Switch to advanced mode");
    },
    frase: () => "modo avanzado",
    fraseEn: () => "switch to advanced mode",
  },
  {
    id: "modo-sembrar",
    grupo: "mapa",
    get nombre() {
      return tx("Pasar al modo «Sembrar la malla»", "Switch to “Seed the mesh” mode");
    },
    frase: () => "modo sembrar la malla",
    fraseEn: () => "switch to “Seed the mesh” mode",
  },
  {
    id: "regla",
    grupo: "mapa",
    get nombre() {
      return tx("Abrir la regla para medir", "Open the ruler to measure");
    },
    frase: () => "abre la regla",
    fraseEn: () => "open the ruler",
  },
  {
    id: "inspeccionar",
    grupo: "mapa",
    get nombre() {
      return tx("Tocar un punto para ver su señal", "Tap a point to see its signal");
    },
    directa: () => ({ tipo: "herramienta", herramienta: "inspeccionar" }),
  },
  {
    id: "borrar-mediciones",
    grupo: "mapa",
    get nombre() {
      return tx("Borrar las mediciones", "Delete the measurements");
    },
    delicada: true,
    frase: () => "borra las mediciones",
    fraseEn: () => "delete the measurements",
  },
  {
    id: "donde-estamos",
    grupo: "mapa",
    get nombre() {
      return tx("Decir dónde estamos", "Tell where we are");
    },
    frase: () => "¿dónde estamos?",
    fraseEn: () => "where are we?",
  },
  {
    id: "animacion-on",
    grupo: "mapa",
    get nombre() {
      return tx("Animar el flujo de la red", "Animate the network flow");
    },
    frase: () => "anima la red",
    fraseEn: () => "animate the network",
  },
  {
    id: "animacion-off",
    grupo: "mapa",
    get nombre() {
      return tx("Quitar la animación de la red", "Stop the network animation");
    },
    frase: () => "quita la animación",
    fraseEn: () => "stop the animation",
  },
  /* ───────────── El escenario ───────────── */
  {
    id: "ejemplo",
    grupo: "escenario",
    get nombre() {
      return tx("Cargar el ejemplo", "Load the example");
    },
    delicada: true,
    frase: () => "carga el ejemplo",
    fraseEn: () => "load the example",
  },
  {
    id: "ejemplo-malla",
    grupo: "escenario",
    get nombre() {
      return tx("Cargar el ejemplo de malla", "Load the mesh example");
    },
    delicada: true,
    frase: () => "carga el ejemplo de malla",
    fraseEn: () => "load the mesh example",
  },
  {
    id: "nuevo",
    grupo: "escenario",
    get nombre() {
      return tx("Empezar un escenario nuevo", "Start a new scenario");
    },
    delicada: true,
    frase: () => "escenario nuevo",
    fraseEn: () => "new scenario",
  },
  {
    id: "exportar",
    grupo: "escenario",
    get nombre() {
      return tx("Exportar el escenario", "Export the scenario");
    },
    frase: (r) => `exporta en ${r.formato ?? "kmz"}`,
    fraseEn: (r) => `export as ${(r.formato ?? "kmz").toUpperCase()}`,
  },
  {
    id: "nombre-escenario",
    grupo: "escenario",
    get nombre() {
      return tx("Ponerle nombre al escenario", "Name the scenario");
    },
    get ejemplo() {
      return tx("llama al escenario \"Piloto Norte\"", "name the scenario “North Pilot”");
    },
    frase: (r) => (r.nombre ? `llama al escenario "${r.nombre}"` : null),
    fraseEn: (r) => (r.nombre ? `name the scenario “${r.nombre}”` : null),
  },
  /* ───────────── Melki ───────────── */
  // Deshacer no tiene «rehacer»: entendido por el modelo, se ofrece con un botón
  {
    id: "deshacer",
    grupo: "melki",
    get nombre() {
      return tx("Deshacer lo último", "Undo the last change");
    },
    delicada: true,
    frase: () => "deshaz lo último",
    fraseEn: () => "undo the last change",
  },
  {
    id: "tours",
    grupo: "melki",
    get nombre() {
      return tx("Ver los tours guiados", "See the guided tours");
    },
    frase: () => "hazme un tour",
    fraseEn: () => "give me a tour",
  },
  {
    id: "recorrido",
    grupo: "melki",
    get nombre() {
      return tx("Recorrer la red punto por punto", "Walk through the network point by point");
    },
    frase: () => "explícame la red punto por punto",
    fraseEn: () => "explain the network point by point",
  },
  {
    id: "pitch",
    grupo: "melki",
    get nombre() {
      return tx("Presentar el modelo de negocio", "Present the business model");
    },
    frase: () => "preséntame el modelo de negocio",
    fraseEn: () => "present the business model",
  },
  {
    id: "voz-on",
    grupo: "melki",
    get nombre() {
      return tx("Leer en voz alta lo que responde", "Read the answers aloud");
    },
    frase: () => "háblame",
    fraseEn: () => "talk to me",
  },
  {
    id: "voz-off",
    grupo: "melki",
    get nombre() {
      return tx("Responder solo por escrito", "Answer in writing only");
    },
    frase: () => "no hables",
    fraseEn: () => "don't talk",
  },
  {
    id: "asistente-on",
    grupo: "melki",
    get nombre() {
      return tx("Activar el Asistente Melki (por voz)", "Turn on the Melki Assistant (voice)");
    },
    frase: () => "activa el asistente",
    fraseEn: () => "turn on the assistant",
  },
  {
    id: "asistente-off",
    grupo: "melki",
    get nombre() {
      return tx("Que el asistente deje de escuchar", "Make the assistant stop listening");
    },
    frase: () => "deja de escuchar",
    fraseEn: () => "stop listening",
  },
  {
    id: "capacidades",
    grupo: "melki",
    get nombre() {
      return tx("Contar qué puede hacer Melki", "Tell what Melki can do");
    },
    tema: "capacidades",
  },
  {
    id: "saludo",
    grupo: "melki",
    get nombre() {
      return tx("Saludar", "Say hello");
    },
    tema: "saludo",
  },
  {
    id: "gracias",
    grupo: "melki",
    get nombre() {
      return tx("Agradecer", "Say thanks");
    },
    tema: "gracias",
  },
  {
    id: "quien",
    grupo: "melki",
    get nombre() {
      return tx("Contar quién es Melki", "Tell who Melki is");
    },
    tema: "quien",
  },
  {
    id: "modelo-melki",
    grupo: "melki",
    get nombre() {
      return tx("Explicar cómo entiende Melki", "Explain how Melki understands");
    },
    tema: "modelo-melki",
  },
  /* ───────────── Preguntas (las contesta el cerebro) ───────────── */
  pregunta("q-que-es", "Qué es el simulador y cómo se usa", "What the simulator is and how to use it", "que-es"),
  pregunta("q-agregar", "Cómo se agrega una antena", "How to add an antenna", "agregar"),
  pregunta("q-diseno", "Cómo se diseña una red para un área", "How to design a network for an area", "diseno"),
  pregunta("q-nodos", "Qué tipos de nodo hay", "What kinds of nodes there are", "nodos"),
  pregunta("q-regla", "Cómo se mide con la regla", "How to measure with the ruler", "regla"),
  pregunta("q-referencia", "Qué muestra el mapa de referencia", "What the reference map shows", "referencia"),
  pregunta("q-buscar", "Cómo se busca un lugar", "How to search for a place", "buscar"),
  pregunta("q-alcance", "Hasta dónde llega una antena", "How far an antenna reaches", "alcance"),
  pregunta("q-coordenadas", "Cómo se escriben las coordenadas", "How to write coordinates", "coordenadas"),
  pregunta("q-mover", "Cómo se mueve una antena", "How to move an antenna", "mover"),
  pregunta("q-eliminar", "Cómo se borra una antena", "How to delete an antenna", "eliminar"),
  pregunta("q-simular", "Qué hace «Simular»", "What “Simulate” does", "simular"),
  pregunta("q-colores", "Qué significan los colores del mapa", "What the map colors mean", "colores"),
  pregunta("q-margen", "Qué es el margen de un enlace", "What a link margin is", "margen"),
  pregunta("q-presupuesto", "Cómo se calcula el balance del enlace", "How the link budget is calculated", "presupuesto"),
  pregunta("q-presets", "Qué ajuste de radio usar", "Which radio setting to use", "presets"),
  pregunta("q-frecuencia", "Qué frecuencia usa la red", "What frequency the network uses", "frecuencia"),
  pregunta("q-altura", "Qué altura conviene", "What height works best", "altura"),
  pregunta("q-malla", "Cómo funciona la malla", "How the mesh works", "malla"),
  pregunta("q-saltos", "Qué son los saltos", "What hops are", "saltos"),
  pregunta("q-gateway", "Qué hace el gateway", "What the gateway does", "pasarela"),
  pregunta("q-protocolos", "MeshCore o Meshtastic", "Whether to use MeshCore or Meshtastic", "protocolos"),
  pregunta("q-gateway-medido", "Qué se midió del gateway", "What was measured on the gateway", "gateway-medido"),
  pregunta("q-usuarios-prueba", "Qué dicen los colores de las personas", "What the people's colors mean", "usuarios-prueba"),
  pregunta("q-optimizar-carga", "Qué hace la optimización para la carga", "What the load optimization does", "optimizar-carga"),
  pregunta("q-pitch", "Cómo se paga la red (el modelo de negocio)", "How the network pays for itself (the business model)", "pitch"),
  pregunta("q-recorrido-red", "Qué es el recorrido de la red", "What the network walkthrough is", "recorrido-red"),
  pregunta("q-analista", "Cómo diseña Melki la red", "How Melki designs the network", "analista"),
  pregunta("q-ia-local", "La IA local de este equipo", "This computer's local AI", "ia-local"),
  pregunta("q-ia-voz", "Conectar a Melki con Gemini", "Connecting Melki to Gemini", "ia-voz"),
  pregunta("q-roles", "Qué roles tienen los nodos", "What roles the nodes have", "roles"),
  pregunta("q-factibilidad", "Qué es la factibilidad", "What feasibility means", "factibilidad"),
  pregunta("q-respaldo", "Qué es el respaldo", "What backup is", "respaldo"),
  pregunta("q-modos", "Qué antena cubre cada punto", "Which antenna covers each point", "modos"),
  pregunta("q-medir", "Cómo saber si llega señal a un punto", "How to tell if signal reaches a point", "medir"),
  pregunta("q-perfil", "Qué es el perfil del enlace", "What the link profile is", "perfil"),
  pregunta("q-modelo-propagacion", "Cómo calcula la propagación", "How propagation is calculated", "modelo"),
  pregunta("q-relieve", "Cómo usa el relieve", "How the terrain is used", "relieve"),
  pregunta("q-privacidad", "Qué pasa con mis datos", "What happens to my data", "privacidad"),
  pregunta("q-capas", "Qué capas tiene el mapa", "What layers the map has", "capas"),
  pregunta("q-exportar", "Cómo se guarda o se exporta", "How to save or export", "exportar"),
  pregunta("q-receptor", "Qué es el receptor", "What the receiver is", "receptor"),
  pregunta("q-confiabilidad", "Qué es la confiabilidad", "What reliability means", "confiabilidad"),
  pregunta("q-red-radio-mobile", "Qué parámetros de red usa", "Which network parameters it uses", "red-radio-mobile"),
  pregunta("q-direccionales", "Qué son las antenas direccionales", "What directional antennas are", "direccionales"),
  pregunta("q-entorno", "Cómo afectan árboles y casas", "How trees and houses affect the signal", "entorno"),
  pregunta("q-unidades", "Qué unidades de señal usa", "Which signal units it uses", "unidades"),
  pregunta("q-informe", "Qué es el informe de radioenlace", "What the radio link report is", "informe"),
  pregunta("q-dictado", "Cómo funciona el dictado", "How dictation works", "dictado"),
  pregunta("q-autoria", "Quién hizo el simulador", "Who made the simulator", "autoria"),
  pregunta("q-manos-libres", "Cómo funciona el Asistente Melki", "How the Melki Assistant works", "manos-libres"),
  pregunta("q-cobertura-maxima", "Cuál es la cobertura máxima", "What the maximum coverage is", "cobertura-maxima"),
  pregunta("q-rendimiento", "Por qué tarda la simulación", "Why the simulation takes time", "rendimiento"),
  pregunta("q-mejorar", "Cómo mejorar la cobertura", "How to improve coverage", "mejorar"),
  pregunta("q-ajuste", "Qué hace «Ajústamelo»", "What “Adjust it for me” does", "ajuste"),
  pregunta("q-area-objetivo", "Qué es el área objetivo", "What the target area is", "area-objetivo"),
  pregunta("q-equipos", "Qué equipos usa Trama", "What equipment Trama uses", "equipos"),
  pregunta("q-trama", "Qué es Trama y qué pasa por la red", "What Trama is and what goes through the network", "trama"),
  pregunta("q-animacion", "Qué son las luces que se mueven", "What the moving lights are", "animacion"),
  pregunta("q-repetidor", "Dónde va un repetidor", "Where a repeater goes", "repetidor"),
  pregunta("q-persona", "Qué lleva cada persona", "What each person carries", "persona"),
  pregunta("q-mensaje", "Cómo viaja un pago o un mensaje", "How a payment or a message travels", "mensaje"),
  pregunta("q-capacidad", "Cuánto tráfico aguanta la red", "How much traffic the network can handle", "capacidad"),
  pregunta("q-estres", "Qué es la prueba de estrés", "What the stress test is", "estres"),
  pregunta("q-poblar", "Qué hace «Poblar personas»", "What “Populate people” does", "poblar"),
  pregunta("q-precios", "Cuánto cuestan los equipos", "How much the equipment costs", "precios"),
  pregunta("q-dimensionamiento", "Cómo se dimensiona la red de un departamento", "How a department's network is sized", "dimensionamiento"),
  pregunta("q-letra-pequena", "Qué tan exactas son las cifras", "How accurate the figures are", "letra-pequena"),
  pregunta("q-sin-cobertura", "Por qué hay zonas sin cobertura", "Why there are areas without coverage", "sin-cobertura"),
  /* ───────────── Fuera del simulador ───────────── */
  {
    id: "fuera",
    grupo: "fuera",
    get nombre() {
      return tx("Algo fuera del simulador", "Something outside the simulator");
    },
  },
  {
    id: "ruido",
    grupo: "fuera",
    get nombre() {
      return tx("Algo que no se entiende (el dictado escribió mal)", "Something I couldn't make out (the dictation got it wrong)");
    },
  },
];

export const INTENCION = new Map(INTENCIONES.map((i) => [i.id, i]));
