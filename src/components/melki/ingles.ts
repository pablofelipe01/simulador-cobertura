// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Lo que se pide en inglés, dicho con las palabras que Melki ya entiende en español: «add a repeater 8 km north of the
// gateway» → «agrega un repetidor a 8 km al norte del gateway». No es un traductor general: conoce las órdenes del
// simulador (nodos, alturas, diseños de red, personas, pruebas, parámetros, mapa, informes, voz y paneles). Lo que
// arma lo revisa después el mismo intérprete de siempre, y si no lo entiende, contestan el cerebro en inglés, el
// Modelo Melki en inglés o la IA local. Los nombres de los nodos, los lugares, las coordenadas y lo que va entre
// comillas pasan tal cual.

import { detectarIdioma } from "@/lib/idioma";

import { numerosEnPalabrasEn } from "./numeros";
import { corregirIngles } from "./ortografia-en";
import { corregirOido } from "./oido";

export type ContextoTraduccion = {
  /** Los nombres de los nodos del mapa («Gateway», «Repeater 3», «Repetidor 1»…). */
  nombres?: string[];
};

/* ───────────── Preparar el inglés ───────────── */

const CONTRACCIONES: [RegExp, string][] = [
  [/\bwhat's\b/gi, "what is"],
  [/\bwhere's\b/gi, "where is"],
  [/\bhow's\b/gi, "how is"],
  [/\bwho's\b/gi, "who is"],
  [/\bthat's\b/gi, "that is"],
  [/\bthere's\b/gi, "there is"],
  [/\bit's\b/gi, "it is"],
  [/\blet's\b/gi, "let us"],
  [/\bi'm\b/gi, "i am"],
  [/\bi've\b/gi, "i have"],
  [/\bi'd\b/gi, "i would"],
  [/\bi'll\b/gi, "i will"],
  [/\byou're\b/gi, "you are"],
  [/\bwe're\b/gi, "we are"],
  [/\bthey're\b/gi, "they are"],
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bdon't\b/gi, "do not"],
  [/\bdoesn't\b/gi, "does not"],
  [/\bdidn't\b/gi, "did not"],
  [/\bisn't\b/gi, "is not"],
  [/\baren't\b/gi, "are not"],
  [/\bwasn't\b/gi, "was not"],
  [/\bshouldn't\b/gi, "should not"],
  [/\bcouldn't\b/gi, "could not"],
  [/\bhaven't\b/gi, "have not"],
  [/\bhasn't\b/gi, "has not"],
];

/** Cifras al estilo del español del intérprete: «11,226» → «11226»; «$120,000,000» → «120000000 pesos». */
function cifras(t: string): string {
  let s = t;
  // Separador de miles del inglés (no toca coordenadas «4.25, -73.30» ni listas «1, 2»)
  for (let k = 0; k < 3; k++) s = s.replace(/\b(\d{1,3}),(\d{3})(?![\d.])/g, "$1$2");
  s = s.replace(/\b(\d{1,3}),(\d{3})\.(\d+)/g, "$1$2.$3");
  // Plata: «COP 120000000», «$120000000», «120 million pesos», «US$ 50000», «50,000 dollars»
  s = s.replace(/\b(?:cop|col\$)\s*\$?\s*(\d[\d.]*)/gi, "$1 pesos");
  s = s.replace(/\b(?:us\$|usd)\s*(\d[\d.]*)/gi, "$1 dólares");
  s = s.replace(/(^|\s)\$\s*(\d[\d.]*)/g, "$1$2 pesos");
  s = s.replace(/\b(\d[\d.]*)\s*(?:usd|us dollars?|dollars?|bucks)\b/gi, "$1 dólares");
  s = s.replace(/\b(\d[\d.]*)\s*(?:cop|colombian pesos?)\b/gi, "$1 pesos");
  return s;
}

const ESCAPAR = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nombres que se protegen mientras se traduce: los del mapa, lo que va entre comillas y las coordenadas. */
function proteger(texto: string, nombres: string[]): { texto: string; piezas: string[] } {
  const piezas: string[] = [];
  const guardar = (v: string) => {
    piezas.push(v);
    return `⟦${piezas.length - 1}⟧`;
  };
  let t = texto;
  // Coordenadas en grados, minutos y segundos («4°30'44" N 73°07'24" W»): sus ' y " no son comillas (W es oeste: O)
  const guardarCoord = (v: string) => `⟨${guardar(v).slice(1, -1)}⟩`;
  t = t.replace(/\d{1,3}\s*°\s*\d{1,2}\s*['′]\s*(?:\d{1,2}(?:\.\d+)?\s*["″]?)?\s*[NSEWO]\b/gi, (m) => guardarCoord(m.replace(/W$/i, "O")));
  // Lo que va entre comillas (un nombre nuevo): queda con comillas «…» para el intérprete
  t = t.replace(/["“«']([^"”»']{2,60})["”»']/g, (_m, x: string) => guardar(`«${x.trim()}»`));
  // Coordenadas (decimales con o sin signo): «4.25, -73.30», «4.5123 -73.1234»
  t = t.replace(/-?\d{1,2}\.\d+\s*,?\s+-?\d{1,3}\.\d+/g, (m) => guardarCoord(m));
  // Los nombres de los nodos del mapa, del más largo al más corto
  // «Gateway» a secas no se protege: las reglas lo manejan («the gateway» → «el gateway») y el intérprete lo reconoce
  const lista = [...new Set(nombres.filter((x) => x && x.trim().length >= 2 && !/^gateway$/i.test(x.trim())))].sort((a, b) => b.length - a.length);
  // Lo que sigue a un número y lo vuelve una cantidad («a repeater 2 km north»: el 2 no es parte de «Repeater 2»)
  const cantidad = String.raw`(?!\s*(?:[.,]\d|%|km|kms|m\b|mts?|meters?|metres?|metros?|kilomet|kil[oó]met|mi\b|miles?|millas?|ft\b|feet|foot|pies|yards?|yardas?|blocks?|cuadras?|ha\b|hectares?|hect[aá]reas?|acres?|people|persons|users|families|payments|messages|personas|usuarios|familias|pagos|mensajes|db|dbm|dbi|degrees?|grados?|°))`;
  for (const nombre of lista) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${ESCAPAR(nombre)})(?=$|[^\\p{L}\\p{N}])${/\d$/.test(nombre) ? cantidad : ""}`, "giu");
    t = t.replace(re, (_m, antes: string) => `${antes}${guardar(nombre)}`);
  }
  // Los nombres por defecto que no están en el mapa: en inglés o en español, a la forma del mapa (o la española)
  const existe = (n: string) => lista.find((x) => x.toLowerCase() === n.toLowerCase());
  const referencia = new RegExp(String.raw`\b(repeater|repetidor|person|persona|support|apoyo|antenna|antena|tower|torre)\s+(\d{1,3})\b${cantidad}`, "gi");
  t = t.replace(referencia, (_m, tipo: string, num: string) => {
    const k = tipo.toLowerCase();
    const es = { repeater: "Repetidor", repetidor: "Repetidor", person: "Persona", persona: "Persona", support: "Apoyo", apoyo: "Apoyo", antenna: "Antena", antena: "Antena", tower: "Torre", torre: "Torre" }[k] ?? tipo;
    const en = { repeater: "Repeater", repetidor: "Repeater", person: "Person", persona: "Person", support: "Support", apoyo: "Support", antenna: "Antenna", antena: "Antenna", tower: "Tower", torre: "Tower" }[k] ?? tipo;
    const real = existe(`${en} ${num}`) ?? existe(`${es} ${num}`);
    return guardar(real ?? `${es} ${num}`);
  });
  // Un nombre nuevo, dicho sin comillas: «rename Repeater 1 to North Tower», «call the scenario Finca La Esperanza»,
  // «an antenna node called North Tower at …». v17.3: también con cortesía antes o después («please rename it to North
  // Tower, thanks»: el nombre es «North Tower»), con «call/name X …» y con «change its name to …»
  const nombrar = (re: RegExp) => {
    t = t.replace(re, (_m, a: string, nombre: string, cola: string) => `${a}${guardar(nombre)}${cola}`);
  };
  nombrar(new RegExp(String.raw`^(${ANTES_DEL_NOMBRE}(?:rename|change the name of)\s+.+?\s+(?:to|as)\s+)(?!⟦)(.+?)(${DESPUES_DEL_NOMBRE})$`, "i"));
  // (v17.5 · sin volver a guardar «to ⟦0⟧» cuando el nombre ya quedó guardado: «rename the scenario to Finca Uno»)
  nombrar(new RegExp(String.raw`^(${ANTES_DEL_NOMBRE}(?:call|name|rename)\s+(?:the\s+)?scenario\s+(?:to\s+|as\s+)?)(?!⟦|(?:to|as)\s+⟦)(.+?)(${DESPUES_DEL_NOMBRE})$`, "i"));
  nombrar(new RegExp(String.raw`^(${ANTES_DEL_NOMBRE}(?:call|name)\s+(?:⟦\d+⟧|${PRONOMBRE})\s+)(?!⟦)(?!(?:it\s+)?(?:a day|a night|quits|off|done|even)\b)(.+?)(${DESPUES_DEL_NOMBRE})$`, "i"));
  nombrar(new RegExp(String.raw`^(${ANTES_DEL_NOMBRE}change\s+(?:⟦\d+⟧'?s|its)\s+name\s+to\s+)(?!⟦)(.+?)(${DESPUES_DEL_NOMBRE})$`, "i"));
  t = t.replace(new RegExp(String.raw`\b((?:called|named)\s+)(?!⟦)(.+?)(?=\s+(?:at|in|on|near|with|to|by)\b|[,;]|${DESPUES_DEL_NOMBRE}$)`, "i"), (_m, a: string, nombre: string) => `${a}${guardar(nombre)}`);
  return { texto: t, piezas };
}

/** v17.3 · La cortesía alrededor de un nombre nuevo, que no es parte del nombre. */
const ANTES_DEL_NOMBRE = String.raw`(?:(?:please|pls|plz|kindly|ok(?:ay)?|hey|hi|so|now|then|and|melki|can you|could you|would you|will you|would you mind|i want you to|i'd like you to|i would like you to|go ahead and|let's|let us|just)[\s,]+)*`;
const DESPUES_DEL_NOMBRE = String.raw`(?:[\s,]+(?:please|pls|plz|thanks|thank you|thx|cheers|now|for me|right now|asap|ok(?:ay)?|melki))*[\s.!?]*`;

/**
 * v17.3 · Lo que nombra un nodo sin decir su nombre: «move it 2 km east», «delete that one», «rename the last one…».
 * «it» es el último nodo que se puso o se cambió (en español, «muévelo», «bórralo»); «that one», «this node», el
 * seleccionado o, si no hay, ese mismo («mueve ese nodo»); «the last one», el último que se puso.
 */
const PRONOMBRE = String.raw`(?:it|that one|this one|that node|this node|(?:that|this) (?:repeater|person|user|antenna|tower|gateway|device|unit)|the (?:last|latest|newest|most recent|new) (?:one|node|repeater|person|antenna|tower)|the one (?:i|you|we) (?:just )?(?:added|put|placed|created|made))`;

/** Cómo lo dice el español que entiende el intérprete. */
function pronombreEnEspanol(p: string): string {
  const x = p.toLowerCase().replace(/\s+/g, " ");
  if (x === "it") return "ese equipo";
  if (x.startsWith("the ")) return "el último";
  const [det, sust] = x.split(" ");
  const este = det === "this";
  if (sust === "repeater") return este ? "este repetidor" : "ese repetidor";
  if (sust === "person" || sust === "user") return este ? "esta persona" : "esa persona";
  if (sust === "antenna") return este ? "esta antena" : "esa antena";
  if (sust === "tower") return este ? "esta torre" : "esa torre";
  if (sust === "gateway") return "el gateway";
  if (sust === "device" || sust === "unit") return este ? "este equipo" : "ese equipo";
  return este ? "este nodo" : "ese nodo";
}

/** Los verbos que siempre actúan sobre un nodo («simulate it», «optimize it» o «export it» no hablan de un nodo). */
const VERBO_DE_NODO = String.raw`delete|remove|erase|get rid of|trash|ditch|scrap|nuke|rename|duplicate|clone|copy|make a copy of|point|aim|orient|rotate|tilt|deactivate|disable|exclude|activate|enable|reactivate|re-enable|select|highlight|mark|lower`;
/** Mover («move it up to 30 m» es una altura, no un traslado). */
const VERBO_DE_MOVER = String.raw`move|shift|relocate|reposition|nudge|slide|drag|push|displace|transfer`;

/**
 * v17.3 · El nodo dicho sin su nombre queda como un nombre protegido (con lo que lo dice en español), para que valgan
 * las mismas reglas que con «Repeater 1». Solo después de un verbo que actúa sobre un nodo, o con lo que sigue cuando el
 * verbo es de muchos usos («take it out», «make it the gateway», «bring it down to 10 m», «call it Loma Alta»).
 */
function pronombres(t: string, piezas: string[], falsos: Set<number>): string {
  const guardar = (p: string) => {
    piezas.push(pronombreEnEspanol(p));
    falsos.add(piezas.length - 1);
    return `⟦${piezas.length - 1}⟧`;
  };
  const P = PRONOMBRE;
  // Sin «it» ni «that one», que las reglas de siempre ya entienden con «raise» y «lift» («raise it to 20 m»: «súbelo»)
  const sinIt = P.replace("(?:it|that one|", "(?:");
  return t
    .replace(/\bchange its name\b/gi, () => `change ${guardar("it")}'s name`)
    .replace(new RegExp(String.raw`\b(${VERBO_DE_MOVER}) (${P})\b(?! (?:up|down)\b)`, "gi"), (_m, v: string, p: string) => `${v} ${guardar(p)}`)
    .replace(new RegExp(String.raw`\b(${VERBO_DE_NODO}) (${P})\b`, "gi"), (_m, v: string, p: string) => `${v} ${guardar(p)}`)
    .replace(new RegExp(String.raw`\b(raise|lift) (${sinIt})\b`, "gi"), (_m, v: string, p: string) => `${v} ${guardar(p)}`)
    .replace(new RegExp(String.raw`\b(take|bring) (${P}) (?=(?:out|away|off|down)\b)`, "gi"), (_m, v: string, p: string) => `${v} ${guardar(p)} `)
    .replace(new RegExp(String.raw`\b(put|bring) (${P}) (?=back (?:in(?:to)?|on) the (?:simulation|calculation|analysis|network|mesh)\b)`, "gi"), (_m, v: string, p: string) => `${v} ${guardar(p)} `)
    .replace(new RegExp(String.raw`\b(call|name) (${P}) (?=⟦)`, "gi"), (_m, v: string, p: string) => `${v} ${guardar(p)} `)
    .replace(new RegExp(String.raw`^(pick|choose|click on|click|focus on|tap on|tap) (${P})$`, "i"), (_m, v: string, p: string) => `${v} ${guardar(p)}`)
    .replace(
      new RegExp(String.raw`\b(make|set|designate|define|use|convert|change|switch|turn|configure) (${P}) (?=(?:(?:into|to|as)\s+)?(?:the |a |an |our |my )?(?:gateway|repeater|room server|companion|client)\b)`, "gi"),
      (_m, v: string, p: string) => `${v} ${guardar(p)} `,
    )
    .replace(new RegExp(String.raw`\b(make) (${P}) (?=(?:taller|higher|shorter|lower)$)`, "gi"), (_m, v: string, p: string) => `${v} ${guardar(p)} `)
    // «turn that repeater off» (un nodo dicho); «turn it off» puede ser la voz o una capa, y queda como está
    .replace(new RegExp(String.raw`\b(turn|switch|shut|power) (${P.replace("(?:it|", "(?:")}) (?=(?:off|on|back on|down)\b)`, "gi"), (_m, v: string, p: string) => `${v} ${guardar(p)} `);
}

/** v17.3 · Con un nodo dicho sin su nombre, lo que el intérprete entiende mejor dicho de otra forma. */
function arreglarFalsos(t: string, falsos: Set<number>): string {
  if (!falsos.size) return t;
  const es = (k: string) => falsos.has(Number(k));
  return (
    t
      // «ajusta la altura de ese nodo a 20 m» sería el ajuste de la red: es subirlo
      .replace(/\bajusta la altura de ⟦(\d+)⟧ a\b/g, (m, k: string) => (es(k) ? `sube ⟦${k}⟧ a` : m))
      // «pon a ese nodo como repetidor» pondría uno nuevo: es su rol
      .replace(/\bpon (?:a )?⟦(\d+)⟧ como (repetidor|room server|companion|client|cliente)\b/g, (m, k: string, r: string) => (es(k) ? `que ⟦${k}⟧ sea ${r}` : m))
  );
}

const restaurar = (t: string, piezas: string[]) => {
  // (v17.5 · también lo guardado dentro de otra pieza, si quedara)
  let r = t;
  for (let i = 0; i < 3 && /⟦\d+⟧|⟨\d+⟩/.test(r); i++) r = r.replace(/⟦(\d+)⟧|⟨(\d+)⟩/g, (_m, a: string, b: string) => piezas[Number(a ?? b)] ?? "");
  return r;
};

/* ───────────── Palabras ───────────── */

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
// Unidades de longitud del inglés → las del intérprete
const LONGITUD: [RegExp, string][] = [
  [/\bnautical miles?\b/gi, "millas náuticas"],
  [/\b(kilomet(?:er|re)s?|kms?)\b/gi, "km"],
  [/\bsquare miles?\b/gi, "millas cuadradas"],
  [/\bsquare (?:kilomet(?:er|re)s?|kms?)\b|\bsq\.? ?km\b|\b(?:kilomet(?:er|re)s?|kms?) squared\b/gi, "km²"],
  [/\bsquare met(?:er|re)s?\b|\bsq\.? ?m\b/gi, "metros cuadrados"],
  [/\bmiles\b/gi, "millas"],
  [/\bmile\b/gi, "milla"],
  [/\bmet(?:er|re)s?\b/gi, "m"],
  [/\byards?\b/gi, "yardas"],
  [/\b(feet|foot|ft)\b/gi, "pies"],
  [/\bblocks?\b/gi, "cuadras"],
  [/\bhectares?\b/gi, "hectáreas"],
  [/\bacres?\b/gi, "acres"],
  [/\bdegrees?\b/gi, "grados"],
  [/\bpercent\b|\bper cent\b/gi, "%"],
];
const DISTANCIA = String.raw`(?:km|m|millas|milla|millas náuticas|yardas|pies|cuadras)`;
const SUPERFICIE = String.raw`(?:hectáreas|ha|acres|km²|km2|millas cuadradas|metros cuadrados)`;

const RUMBOS: Record<string, string> = {
  north: "norte",
  south: "sur",
  east: "oriente",
  west: "occidente",
  northeast: "noreste",
  northwest: "noroeste",
  southeast: "sureste",
  southwest: "suroeste",
  "north-east": "noreste",
  "north-west": "noroeste",
  "south-east": "sureste",
  "south-west": "suroeste",
};
const RUMBO = String.raw`(north-?east|north-?west|south-?east|south-?west|north|south|east|west)`;
const rumbo = (r: string) => RUMBOS[r.toLowerCase().replace(/-/, "")] ?? RUMBOS[r.toLowerCase()] ?? r;

// Tipos de nodo
const TIPO: [RegExp, string][] = [
  [/\bantenna nodes?\b/gi, "nodo antena"],
  [/\b(?:field|portable|handheld) nodes?\b/gi, "nodo portátil"],
  [/\brepeaters\b/gi, "repetidores"],
  [/\brepeater\b/gi, "repetidor"],
  [/\bgateways\b/gi, "gateways"],
  [/\bnodes\b/gi, "nodos"],
  [/\bnode\b/gi, "nodo"],
  [/\bantennas\b/gi, "antenas"],
  [/\bantenna\b/gi, "antena"],
  [/\btowers\b/gi, "torres"],
  [/\btower\b/gi, "torre"],
  [/\b(people|persons)\b/gi, "personas"],
  [/\bperson\b/gi, "persona"],
  [/\busers\b/gi, "usuarios"],
  [/\buser\b/gi, "usuario"],
  [/\bfamilies\b/gi, "familias"],
  [/\bhouseholds\b/gi, "familias"],
  [/\bwallets\b/gi, "billeteras"],
  [/\bwallet\b/gi, "billetera"],
  [/\bhouses?\b|\bhomes?\b/gi, "casa"],
];

/** El verbo de un gerundio, para «would you mind simulating?» («adding» → «add», «running» → «run»). */
const VERBOS_DE_GERUNDIO = new Set(
  (
    "simulate add move raise lower delete remove show hide export save load run put place optimize optimise adjust design build create connect " +
    "select rename make set take switch turn use apply open close download explain tell give populate measure send test check start stop zoom " +
    "center centre point tilt duplicate copy draw mark calculate compute drop cover seed spread fill increase decrease reduce enable disable " +
    "activate deactivate change"
  ).split(" "),
);
function verboDeGerundio(g: string): string {
  const raiz = g.toLowerCase().replace(/ing$/, "");
  if (VERBOS_DE_GERUNDIO.has(raiz)) return raiz;
  if (VERBOS_DE_GERUNDIO.has(`${raiz}e`)) return `${raiz}e`;
  // «running» → «run», «putting» → «put»
  if (/(.)\1$/.test(raiz) && VERBOS_DE_GERUNDIO.has(raiz.slice(0, -1))) return raiz.slice(0, -1);
  return g;
}

/* ───────────── Las reglas ───────────── */

type Regla = [RegExp, string | ((...m: string[]) => string)];

// 1. Muletillas y cortesía (se quitan)
const CORTESIA: Regla[] = [
  [/^\s*(?:hey|hi|hello) there\b[\s,]*/i, ""],
  [/^\s*(?:(?:hey|hi|hello|ok(?:ay)?|so|well|alright|all right|right|now|um+|uh+|er+|erm|please|melki|and)\b[\s,]*)+/i, ""],
  [/[\s,]*\b(?:melki|please|thanks|thank you|thank you very much|thanks a lot|cheers)\s*[.!?]*\s*$/i, ""],
  // v17.3 · «would you mind simulating?», «do you mind adding…»: el verbo, como orden
  [/^\s*(?:would|do) you mind\s+([a-z]+ing)\b/i, (_m, v: string) => `${verboDeGerundio(v)}`],
  [/[\s,]*\b(?:if you (?:do not|don't) mind|when you (?:can|get a chance)|real quick|right now|right away|asap)\s*[.!?]*\s*$/i, ""],
  [/\b(?:please|kindly|if you can|if you could|if possible|for me)\b/gi, ""],
  [/^\s*(?:can|could|would|will) you(?: please)?(?: just)?\s+/i, ""],
  [/^\s*(?:please )?(?:be so kind as to|would you be so kind as to)\s+/i, ""],
  // («just the map» es la pantalla limpia: ese «just» se queda)
  [/^\s*(?:i (?:want|need|would like) you to|i want to|i would like to|i need to|let us(?: go ahead and)?|go ahead and|try to|help me|just(?! the map\b)|quickly|now)\s+/i, ""],
  [/^\s*(?:i (?:want|need|would like)|give me|get me)\s+(?=(?:a|an)\s+(?:new\s+)?(?:[\w.-]+\s+){0,3}(?:network|mesh)\b)/i, "build "],
];

/** Lo que va antes del acercamiento («a little closer», «a bit farther»). */
const PREVIO_ZOOM_EN = String.raw`(?:a (?:little|bit) )`;
/** v17.6 · Cuánto se acerca o se aleja el mapa («a little», «a lot», «2 levels»), en las palabras del español. */
const CUANTO_ZOOM_EN = String.raw`(?:\s+((?:a|da|the) (?:little|tiny|wee)(?: bit)?(?: more)?|a (?:tiny )?(?:bit|bid|beat)(?: more)?|slightly|a tad|(?:a )?(?:little|bit) more|a lot(?: more)?|a bunch|way (?:more|in|out)|much more|some more|more|all the way(?: in| out)?|as (?:much|far) as (?:you|it) can|(?:\d+|one|won|two|to|too|three|tree|four|for|five|six) (?:levels?|levers?|times|steps|notches|clicks)))?`;
const ZOOM_EN = new RegExp(
  String.raw`^(?:${PREVIO_ZOOM_EN})?(?:zoom(?: (?:the )?(?:map|view|it))? (?:in|out|back)(?: (?:on|into) (?:the )?(?:map|view))?|zoom(?: (?:on|into) (?:the )?(?:map|view))?|zoom closer|(?:get|come|go|move|bring (?:it|the map|the view|us)|take (?:it|the map|us))(?: (?:a little|a bit|a lot|much))? closer(?: to (?:the )?(?:map|view))?|closer|magnify(?: (?:the )?(?:map|view))?|enlarge (?:the )?(?:map|view)|make (?:the map|the view|it) (?:bigger|smaller|larger|more (?:big|small))|(?:get|go|move|pull|take (?:it|the map|the view|us)) (?:away|back|farther|further)(?: away| out)?|(?:a (?:little|bit) )?(?:farther|further)(?: away| out)?|back out)${CUANTO_ZOOM_EN}(?: again| now)?$`,
  "i",
);
/** «a little» → «un poco», «a lot» → «mucho», «2 levels» → «2 niveles». */
function cuantoZoom(c: string): string {
  const t = c.toLowerCase().trim();
  if (!t || t === "more" || t === "some more") return "";
  const n = t.match(/^(\d+|one|won|two|to|too|three|tree|four|for|five|six) /);
  if (n) {
    const k = ({ one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, tree: 3, four: 4, for: 4, five: 5, six: 6 } as Record<string, number>)[n[1]] ?? Number(n[1]);
    return k === 1 ? "" : ` ${k} niveles`;
  }
  if (/all the way|as (?:much|far)/.test(t)) return " al máximo";
  if (/a lot|a bunch|way|much more/.test(t)) return " mucho";
  return " un poco";
}

// 2. Pedidos enteros (voz, paneles, deshacer, sí/no)
const ENTEROS: Regla[] = [
  [/^(?:speak|talk|read)(?: a (?:bit|little))?(?: more)? (?:slow(?:er|ly)?)$|^slow down$|^(?:more )?slowly$|^(?:a (?:bit|little) )?slower$/i, "habla más despacio"],
  [/^(?:speak|talk|read)(?: a (?:bit|little))? faster$|^speed up$|^faster$/i, "habla más rápido"],
  [/^(?:speak|talk)(?: at)?(?: a| your)? normal(?:ly)?(?: speed| pace)?$|^(?:back to )?(?:your )?normal (?:speed|pace)$/i, "habla normal"],
  [/^(?:repeat(?: that| it| what you (?:just )?said)?|say (?:that|it) again|what did you (?:just )?say|come again|again|one more time|once more)$/i, "repite lo que dijiste"],
  [/^(?:talk to me|speak to me|speak|read (?:it )?(?:out loud|aloud)|turn on (?:your|the) voice|enable (?:your|the) voice|use your voice|say it out loud|read out loud|(?:speak|talk|answer|reply) (?:out loud|aloud)|read (?:your|the) (?:answers?|replies) (?:out loud|aloud))$/i, "háblame"],
  [/^(?:stop talking|be quiet|quiet|shut up|silence|mute(?: yourself| your voice| the voice)?|do not (?:talk|speak)|turn off (?:your|the) voice|disable (?:your|the) voice|no voice|stop speaking)$/i, "no hables"],
  [/^(?:turn on|start|activate|enable|open) (?:the )?(?:hands[- ]?free(?: mode)?|(?:melki |voice )?assistant|listening)$|^(?:start listening|listen to me|jarvis mode|hands[- ]?free(?: mode)?)$/i, "activa el asistente"],
  [/^(?:talk|speak) (?:to|with) you$|^let's talk$/i, "quiero hablarte"],
  [/^(?:turn off|stop|deactivate|disable|close) (?:the )?(?:hands[- ]?free(?: mode)?|(?:melki |voice )?assistant|listening)$|^stop listening(?: to me)?$/i, "deja de escuchar"],
  [/^(?:undo|undo (?:that|it|this|the last (?:thing|change|step|one))|revert(?: that| it)?|take (?:that|it) back)$/i, "deshaz lo último"],
  [/^(?:yes|yeah|yep|yup|sure|of course|ok(?:ay)? do it|do it|go ahead|go for it|confirm|confirmed|apply it|apply|correct|exactly|right)$/i, "sí"],
  [/^(?:no|nope|cancel(?: it| that)?|never ?mind|forget it|leave it|not now|no thanks)$/i, "no"],
  [/^(?:none|none of them|none of those|neither|neither of them|not any of them)$/i, "ninguna"],
  // v17.6 · Acercar y alejar el mapa («zoom in», «zoom out a little», «get closer», «zoom in 2 levels», «all the way out»)
  [ZOOM_EN, (m: string, cuanto?: string) => {
    const base = cuanto ? m.slice(0, m.toLowerCase().lastIndexOf(cuanto.toLowerCase())) : m;
    const fuera = /\b(?:out|back|away|farther|further|smaller|small)\b/i.test(base) || /\bout$/i.test(cuanto ?? "");
    const poco = !cuanto && /^a (?:little|bit) /i.test(m);
    return `${fuera ? "aleja" : "acerca"} el mapa${poco ? " un poco" : cuantoZoom(cuanto ?? "")}`;
  }],
  // v17.6 · La leyenda («show the legend», «open the map key», «hide the legend», «show me the colors»)
  [/^(?:show|display|open|bring up|bring back|pull up|expand|turn on|let me see|i want to see|see|view|give me|put|put back)(?: me)?(?: the| de| da)? (?:map |color |colour )?(?:legend|key|legend of the colou?rs|colou?r legend|colou?rs(?: of the map)?)(?: again| of the map| back| on)?$|^(?:the )?legend on$|^turn (?:the )?legend on$/i, "muestra la leyenda"],
  [/^(?:hide|close|collapse|minimi[sz]e|fold|turn off|remove|take away|get rid of|put away|shrink)(?: the| de| da)? (?:map |color |colour )?(?:legend|key)$|^(?:the )?legend off$|^turn (?:the )?legend off$/i, "oculta la leyenda"],
  // v17.6 · El relieve en 3D a la vista («show the terrain relief», «show me the hills», «turn on 3D», «hide the relief»);
  // «turn on the terrain» y «turn off the terrain» siguen siendo el relieve de la simulación
  [/^(?:show|display|see|view|let me see|i want to see|give me|bring up|put)(?: me)?(?: the| de| da)? (?:terrain relief|relief of the terrain|terrain in (?:3d|relief)|3d terrain|3d view|3d map|map in 3d|relief map|relief|terrain|hills(?: and (?:the )?valleys)?|mountains|elevation in 3d|3d)(?: view| mode| on the map)?$/i, "muestra el relieve en 3d"],
  [/^(?:turn on|switch on|enable|activate|put on|switch to|go to|use)(?: the)? (?:terrain relief|terrain in 3d|3d terrain|3d view|3d map|map in 3d|relief map|3d)(?: view| mode)?$|^(?:make|put|turn) (?:the map|it) (?:in(?:to)? )?3d$|^(?:the )?(?:terrain relief|3d terrain|3d view|3d)(?: view| mode)? on$|^put (?:the )?(?:terrain )?relief on$/i, "muestra el relieve en 3d"],
  [/^(?:hide|remove|take away|get rid of|flatten)(?: the)? (?:terrain relief|relief of the terrain|terrain in 3d|3d terrain|3d view|3d map|relief map|relief|hills|3d)(?: view| mode)?$|^(?:turn off|switch off|disable|exit|leave)(?: the)? (?:terrain relief|terrain in 3d|3d terrain|3d view|3d map|3d mode|3d)$|^flatten (?:the map|it)$|^make (?:the map|it) flat$|^(?:back to|go back to) (?:2d|flat|the flat map)$|^(?:the )?(?:terrain relief|3d terrain|3d view|3d)(?: view| mode)? off$/i, "quita el relieve en 3d"],
  [/^what (?:should|do|can) (?:i|we) do (?:next|now)$|^what(?:'s| is) next$|^what now$/i, "¿qué hago ahora?"],
  [/^(?:adjust|tune)(?: it| this| the network| the mesh)?$/i, "ajústamelo"],
  [/^(?:how much|how many(?: payments)?) can (?:the whole|the entire|all the|the) (?:mesh|network) (?:handle|take|hold|withstand)\??$/i, "¿hasta dónde aguanta toda la malla?"],
  [/^how many can (?:it|the network|the mesh) (?:handle|take|hold|withstand)\??$/i, "¿hasta cuántos aguanta?"],
  [/^how much traffic can (?:it|the network|the mesh) (?:handle|take|hold|withstand)\??$/i, "¿cuánto tráfico aguanta?"],
  [/^how (?:much|far) can (?:it|the network) (?:handle|take|hold up|hold|withstand)\??$/i, "¿hasta dónde aguanta?"],
  [/^how (?:far|much) can (?:each|every) repeater (?:hold up|handle|go|take it|withstand|hold|take)\??$/i, "¿hasta dónde aguanta cada repetidor?"],
  [/^why is (.+?) (?:in |shown in |showing )?red\??$/i, "¿por qué $1 está en rojo?"],
  [/^why (?:does not|can not|cannot|is not|isn't) (.+?) (?:reach|reaching|connect(?:ed)? to|getting to) (?:the )?gateway\??$/i, "¿por qué $1 no llega?"],
  [/^(?:the )?(?:melki )?assistant$/i, "asistente melki"],
  [/^(?:the )?load test$/i, "prueba de carga"],
  [/^(?:the )?(?:ruler|measuring tool|measure tool|measuring tape|tape measure)(?: tool)?$/i, "regla"],
  [/^(?:the )?(?:mesh )?(?:pencil|brush)(?: tool)?$/i, "lápiz"],
  [/^(?:i need|i want|give me|get me|hand me|pass me|bring me) (?:the |a )?(?:ruler|measuring tool|measure tool|tape measure)$/i, "regla"],
  [/^(?:i need|i want|give me|get me|hand me|pass me|bring me) (?:the |a )?(?:mesh )?(?:pencil|brush)$/i, "lápiz"],
  [/^draw (?:the |a |my )?(?:mesh|network|zone)(?: myself| by hand| freehand)?$/i, "quiero dibujar la malla"],
  [/^draw(?: it)?(?: myself)?$/i, "quiero dibujar"],
  [/^seed$/i, "sembrar"],
  // El recorrido de la red y la presentación del modelo de negocio
  [/^(?:walk me through|give me a (?:walk-?through|tour) of|take me through|show me around) (?:the |my |this )?(?:network|mesh)$/i, "hazme un recorrido por la red"],
  [/^explain (?:the |my |this )?(?:network|mesh)(?: to me)?$/i, "explícame la red"],
  [/^explain (?:the |my |this )?(?:network|mesh)(?: to me)? (?:point by point|step by step|node by node)$/i, "explícame la red punto por punto"],
  [/^(?:present|show|explain|pitch)(?: me| us)? (?:the |your )?business model$|^(?:start|give|do) (?:the |a |your )?pitch$/i, "preséntame el modelo de negocio"],
  [/^(?:the )?first(?: one| option)?$|^option (?:1|one)$/i, "la primera"],
  [/^(?:the )?second(?: one| option)?$|^option (?:2|two)$/i, "la segunda"],
  [/^(?:the )?third(?: one| option)?$|^option (?:3|three)$/i, "la tercera"],
  [/^(?:the )?last(?: one| option)?$/i, "la última"],
  // Paneles
  [/^(?:clean|clear) (?:the |up the )?screen$|^(?:hide|close) (?:all |both |the )?(?:panels?|sidebars?)$|^(?:just|only) the map$|^full ?screen(?: map)?$|^map only$/i, "pantalla limpia"],
  [/^(?:show|open|bring back) (?:all |both |the )?(?:panels?|sidebars?)$/i, "muestra los paneles"],
  [/^(?:show|open|display|bring back) (?:me )?(?:the )?(?:top bar|top toolbar|toolbar|tool bar|menu bar|top menu)$/i, "muestra la barra de arriba"],
  [/^(?:hide|close) (?:the )?(?:top bar|top toolbar|toolbar|tool bar|menu bar|top menu)$/i, "oculta la barra de arriba"],
  [/^(?:show|open|display) (?:me )?(?:the )?results panel$|^open (?:the )?results$/i, "abre el panel de resultados"],
  [/^(?:hide|close) (?:the )?results(?: panel)?$/i, "oculta el panel de resultados"],
  [/^(?:show|open|display) (?:me )?(?:the )?(?:tools(?: panel)?|left panel|side panel|tool panel)$/i, "abre el panel de herramientas"],
  [/^(?:hide|close) (?:the )?(?:tools(?: panel)?|left panel|side panel|tool panel)$/i, "oculta el panel de herramientas"],
  [/^(?:show|give|tell)(?: me)? (?:the )?results$|^results$|^(?:let me see|see|view|check) (?:the )?results$/i, "muéstrame los resultados"],
  // Modo
  [/^(?:switch|go|change) (?:to )?(?:the )?advanced mode$|^advanced mode$/i, "pasa al modo avanzado"],
  [/^(?:switch|go|change) (?:to )?(?:the )?(?:seed(?:ing)?|simple) mode$|^seed (?:the )?(?:mesh|network) again$|^(?:back to )?seed the mesh$/i, "vuelve a sembrar la malla"],
  // v17.5 · «Seed a mesh around the gateway»: sembrar desde el gateway
  [/^seed (?:a |the )?(?:mesh|network|repeaters) (?:around|near|from|at|next to) (?:the )?gateway$/i, "siembra la malla alrededor del gateway"],
  // Empezar de cero y ejemplos
  [/^(?:start (?:over|again|fresh|anew|from scratch|from zero|from 0|again from (?:scratch|zero|0|the beginning)|over from (?:scratch|zero|0|the beginning))|begin (?:again|from scratch|anew)|restart(?: everything| from scratch)?|clear (?:everything|it all|all|the (?:whole )?map|the scenario)|delete (?:everything|it all|all)|remove (?:everything|it all)|erase (?:everything|it all|all)|wipe (?:everything|it all|the (?:whole )?map|it|the slate)(?: clean)?|reset (?:everything|it all|the (?:whole )?map|the scenario)|clean (?:the (?:whole )?map|everything|it all)(?: up)?|new (?:scenario|map)|empty the map|blank (?:map|slate))$/i, "empieza de cero"],
  [/^load (?:the )?mesh example$|^load (?:the )?example (?:of the )?mesh$/i, "carga el ejemplo de malla"],
  // Cargar el ejemplo reemplaza lo del mapa: solo si se pide cargarlo («load the example», «show me the demo network»);
  // «give me an example» o «show me an example» piden un ejemplo, como «dame un ejemplo» (v17.3)
  [/^(?:load|open|bring up|pull up)(?: the| an| a)? (?:example|sample|demo)(?: network| scenario| mesh| one)?$|^show(?: me)? the (?:example|sample|demo)(?: network| scenario| mesh)?$/i, "carga el ejemplo"],
  // v17.3 · El tour, el mapa base, las vías y los protocolos dichos con pocas palabras
  [/^(?:show me around|give me (?:a|the) (?:quick |guided )?tour|take me on a (?:quick |guided )?tour|(?:a |the )?(?:guided )?tour(?: please)?|i want a tour)$/i, "hazme un tour"],
  [/^(?:the )?satellite(?: view| map| imagery| mode)?$/i, "pon el mapa satelital"],
  [/^(?:the )?topo(?:graphic(?:al)?)?(?: view| map| mode)?$/i, "pon el mapa topográfico"],
  [/^(?:the )?(?:street|streets|road) map$/i, "pon el mapa de calles"],
  [/^(?:the )?(?:roads?|road layer)(?: layer)? on$/i, "muestra las vías"],
  [/^(?:the )?(?:roads?|road layer)(?: layer)? off$/i, "quita las vías"],
  [/^(?:no|without) (?:the )?roads?(?: layer)?$/i, "quita las vías"],
];

/** v17.4 · «Why doesn't Person 1 have signal?», «why is Repeater 2 out of range?»: lo mismo que «¿por qué … no tiene señal?». */
const SIN_SENAL_EN: Regla[] = [
  [/^why (?:doesn't|does not|can't|cannot|isn't|is not|won't|didn't|did not|couldn't) (⟦\d+⟧|it|that one|.+?) (?:have|get|receive|has|got|reach|pick up)(?: any| a| the)? (?:signal|coverage|service|connection|link)(?: anymore| now)?$/i, (_m, x: string) => `¿por qué ${/^(?:it|that one)$/i.test(x) ? "ese nodo" : x} no tiene señal?`],
  [/^why (?:can't|cannot|doesn't|does not|won't|isn't|is not) (⟦\d+⟧|it|that one|.+?) (?:connect|connecting|reach the gateway|get to the gateway|reach the network|be reached)(?: to the (?:network|mesh|gateway))?$/i, (_m, x: string) => `¿por qué ${/^(?:it|that one)$/i.test(x) ? "ese nodo" : x} no tiene señal?`],
  [/^why (?:is|does) (⟦\d+⟧|it|that one|.+?) (?:out of (?:coverage|range|reach)|disconnected|offline|without (?:signal|coverage)|have no (?:signal|coverage)|has no (?:signal|coverage)|not connected|uncovered|in red)$/i, (_m, x: string) => `¿por qué ${/^(?:it|that one)$/i.test(x) ? "ese nodo" : x} no tiene señal?`],
  [/^why (?:has|does) (⟦\d+⟧|it|that one|.+?) (?:got|get|have) no (?:signal|coverage|service)$/i, (_m, x: string) => `¿por qué ${/^(?:it|that one)$/i.test(x) ? "ese nodo" : x} no tiene señal?`],
  [/^what(?:'s| is) wrong with (⟦\d+⟧|.+?)$/i, (_m, x: string) => `¿por qué ${/^(?:it|that one)$/i.test(x) ? "ese nodo" : x} no tiene señal?`],
  // «What does LoRa mean?», «what means LoRa?», «what exactly is LoRa?»: lo mismo que «¿qué es LoRa?»
  [/^what (?:does|do) (?:the )?(?:sf|s f|spreading factor) (?:mean|stand for)$/i, "¿qué es el factor de dispersión?"],
  [/^what (?:does|do) (.+?) (?:mean|stand for)$/i, "¿qué es $1?"],
  [/^what means (.+)$/i, "¿qué es $1?"],
  [/^what (?:exactly is|is exactly) (.+)$|^what is (.+?) exactly$/i, (_m, a: string, b: string) => `¿qué es ${a ?? b}?`],
  [/^(?:what is|what's|explain|define|tell me about) (?:the )?spreading factor$/i, "¿qué es el factor de dispersión?"],
  // «How much does it cost?»: la red del mapa
  [/^how much (?:does|would|will) (?:it|this|all this|that|everything|all of this) cost$/i, "¿cuánto cuesta esto?"],
];

/**
 * v17.4 · Una altura relativa en español («súbelo 5 m más», «baja ⟦0⟧ 3 m más»): con «it» o «that one», el clítico; con
 * un nodo o «the gateway», tal cual (las palabras se traducen después).
 */
function relativa(verbo: "sube" | "baja", x: string | undefined, h: string): string {
  const objeto = (x ?? "").trim();
  if (!objeto || /^(?:it|that one|this one)$/i.test(objeto)) return `${verbo === "sube" ? "súbelo" : "bájalo"} ${h} m más`;
  return `${verbo} ${objeto} ${h} m más`;
}
const POR_CUANTO = String.raw`(?:by |another |an extra |a further |an additional |some |about |around )?`;
/** El número y la unidad («5 m», «5 more m»: «meters» ya llega como «m»). */
const CUANTO_M = String.raw`(\d+(?:\.\d+)?) ?(?:more |extra |additional |further )?m`;
const HACIA_ARRIBA = String.raw`(?: more| higher| up| extra| taller| further| more up)?`;
const HACIA_ABAJO = String.raw`(?: more| lower| down| less| shorter| further| more down)?`;
/** El nodo de una altura relativa (sin «to», «at» ni «until»: «lower X to 10 m» es la altura dicha). */
const OBJETO_ALTURA = String.raw`(?: (it|that one|this one|(?:(?!\b(?:to|at|until|till)\b).)+?))?`;
/** «Raise it 5 m», «lift Repeater 1 by 5 m», «bump it up another 3 m», «raise the gateway 2 m higher». */
const ALTURA_SUBE = new RegExp(String.raw`^(?:raise|lift|increase|bump|hike)(?: up)?${OBJETO_ALTURA}(?: up)? ${POR_CUANTO}${CUANTO_M}${HACIA_ARRIBA}$`, "i");
/** «Move it up 5 m», «bring Repeater 1 up by 2 m» (sin «up», «move it 5 m» es un traslado). */
const ALTURA_SUBE_CON_UP = new RegExp(String.raw`^(?:move|put|push|jack|crank|bring|get)${OBJETO_ALTURA} up ${POR_CUANTO}${CUANTO_M}${HACIA_ARRIBA}$`, "i");
/** «Lower it 3 m», «drop Repeater 1 by 2 m», «reduce the gateway 1 m». */
const ALTURA_BAJA = new RegExp(String.raw`^(?:lower|drop|reduce|decrease|shorten|cut)(?: down)?${OBJETO_ALTURA}(?: down)? ${POR_CUANTO}${CUANTO_M}${HACIA_ABAJO}$`, "i");
/** «Bring it down 4 m», «take Repeater 1 down by 2 m». */
const ALTURA_BAJA_CON_DOWN = new RegExp(String.raw`^(?:bring|take|move|put|get)${OBJETO_ALTURA} down ${POR_CUANTO}${CUANTO_M}${HACIA_ABAJO}$`, "i");

// 3. Frases del dominio (se aplican en orden, sobre todo el texto)
const FRASES: Regla[] = [
  // v17.3 · «northward», «to the north side»: el rumbo de siempre
  [/\b(north|south|east|west|northeast|northwest|southeast|southwest)wards?\b/gi, "$1"],
  [/\b(?:move|take|shift|relocate) the (?:whole )?(?:network|mesh) to\b/gi, "lleva la red a"],
  // «move the map to Villavicencio», «pan the view to Cumaral»: es llevar el mapa (no mover un nodo)
  [/^(?:move|pan|shift|take|bring|scroll) the (?:map|view|camera|screen) (?:to|over to|towards?) (.+?)$/i, "llévame a $1"],
  // Conectores de varias órdenes
  // («next to the gateway» es junto al gateway, no «luego»)
  // v17.4 · «bring it closer to the gateway», «move Repeater 1 close to Person 2»: acercarlo a ese nodo
  [/^(?:bring|get|take|move|put|pull|push) (?!(?:a|an|another|one|some|new|\d+)\b)(.+?) (?:a (?:bit|little) )?(?:closer|nearer|close|near|right next|next) to (.+)$/i, (_m, x: string, y: string) => (/^(?:it|that one|this one)$/i.test(x) ? `acércalo a ${y}` : `acerca ${x} a ${y}`)],
  [/\bnext to\b/gi, "cerca de"],
  // v17.4 · «close to», «beside», «alongside», «nearby»: también junto a ese nodo («close» solo es ocultar)
  [/\b(?:very |really |right |quite )?(?:close to|closer to|nearer to|close by|beside|alongside|by the side of)\b/gi, "cerca de"],
  [/\bnearby (?=(?:the |a |an )?\S)/gi, "cerca de "],
  [/\s*,?\s*\b(?:and then|then|after that|afterwards|next)\b\s*,?\s*/gi, ", luego "],
  // Preguntas que el intérprete contesta
  [/^how much (?:would|will|does|do) (?:it )?cost to cover (?:the )?(?:whole|entire) country(?: with ([\d.]+) ?% (?:adoption|uptake))?\??$/i, (_m, a: string) => `cuánto costaría cubrir todo el país${a ? ` con ${a}% de adopción` : ""}`],
  [/^how much (?:would|will|does|do) (?:it )?cost to cover (?:all (?:of )?)?colombia\??$/i, "¿cuánto cuesta cubrir todo el país?"],
  // «Meta» a secas es el departamento («el Meta»): sin el artículo, el intérprete lo leería como una meta
  [/^how much (?:does|would|will) (?:the |this )?(?:network|mesh)(?: cost)?(?: cost)? (?:in|for) (.+?)\??$/i, (_m, x: string) => `¿cuánto cuesta la red para ${x.replace(/^(?:the )?meta(?: department)?$/i, "el Meta")}?`],
  [/^(?:how much (?:does|would|will) (?:the |this |my )?(?:network|mesh) cost|what (?:does|would) (?:the |this )?(?:network|mesh) cost|what is the cost of the (?:network|mesh)|how much is the (?:network|mesh)|network cost|cost of the network)\??$/i, "¿cuánto cuesta la red?"],
  [/^(?:give me |show me |what is )?(?:the )?(?:detailed|full|complete) (?:budget|cost breakdown|cost)\??$|^break down the cost\??$|^cost breakdown\??$/i, "dame el presupuesto detallado"],
  [/^what is the (?:budget|cost) of the mesh\??$/i, "¿cuál es el presupuesto de la malla?"],
  [/^how many repeaters do (?:i|we) need to cover (.+?)\??$/i, (_m, x: string) => `¿cuántos repetidores necesito para cubrir ${x}?`],
  // v17.3 · «how many repeaters are there?», «number of people?», «count the gateways»
  [/^(?:how many|what number of) (repeaters|people|persons|users|gateways|nodes|antennas|towers)(?: (?:are there|do (?:i|we) have|are on the map|are in the (?:network|mesh)|(?:have|did) (?:i|we|you) (?:put|placed|added|got)|does the (?:network|mesh) have|are placed))?\??$|^(?:the )?number of (repeaters|people|persons|users|gateways|nodes|antennas|towers)\??$|^count (?:the |all the |my )?(repeaters|people|persons|users|gateways|nodes|antennas|towers)$/i, (_m, a: string, b: string, c: string) => {
    const x = (a ?? b ?? c).toLowerCase();
    const es = { repeaters: "cuántos repetidores", people: "cuántas personas", persons: "cuántas personas", users: "cuántas personas", gateways: "cuántos gateways", nodes: "cuántos nodos", antennas: "cuántas antenas", towers: "cuántas torres" }[x] ?? `cuántos ${x}`;
    return `¿${es} hay?`;
  }],
  // v17.3 · «what is the price of the network?», «is any repeater redundant?», «do I need all these repeaters?», «is it optimal?»
  [/^what is the (?:price|cost|total cost|total price) of (?:the |this |my |our )?(?:network|mesh)\??$/i, "¿cuánto cuesta la red?"],
  [/^how much (?:is|will|would|does) (?:the |this |my |our )?(?:network|mesh)(?: going to| gonna)? cost\??$|^how much (?:money|budget|cash|investment) (?:do|would|will) (?:i|we) need (?:for|to build|to set up) (?:the |this |my |our )?(?:network|mesh)\??$|^what (?:would|will|does) (?:the |this |my |our )?(?:network|mesh) cost\??$/i, "¿cuánto cuesta la red?"],
  [/^(?:do|did) (?:i|we) (?:have|put|place|use) more (?:repeaters|antennas|nodes|towers) than (?:i|we) need\??$|^(?:can|could) (?:i|we) (?:remove|take out|drop|get rid of|cut|do without) (?:a|an|one|any) (?:repeater|antenna|node|tower)\??$/i, "¿sobran antenas?"],
  [/^(?:is|are) (?:any|some) (?:of (?:the|my|these|those) )?(?:repeaters?|antennas?|nodes?|towers?) (?:redundant|unnecessary|extra|not needed|useless|left over|spare)\??$/i, "¿sobran antenas?"],
  [/^do (?:i|we) (?:really )?need (?:all )?(?:these|those|the|my|all the|all of the|all my) (?:repeaters|antennas|nodes|towers)\??$/i, "¿sobran antenas?"],
  [/^is (?:it|this|that) (?:optimal|optimized|optimised|the optimal (?:network|mesh|design)|well sized|right-sized)\??$/i, "¿la red es óptima?"],
  [/^how many (?:people|users|persons) can (.+?) (?:handle|hold|support|take)\??$/i, (_m, x: string) => `¿cuántas personas aguanta ${/^el |^⟦/.test(x) ? "" : ""}${x.replace(/^the /i, "el ")}?`],
  [/^(?:up to )?how many payments can (?:it|the network|the mesh) (?:handle|hold|take|support)\??$/i, "¿hasta cuántos pagos aguanta?"],
  [/^(?:up to )?how many (?:users|people) can each repeater (?:handle|hold|take|support)\??$/i, "¿hasta cuántos usuarios aguanta cada repetidor?"],
  [/^what is the (?:people )?limit (?:of|for) each (?:point|node|site)\??$|^how many people can each point (?:handle|hold)\??$/i, "¿cuál es el límite de personas de cada punto?"],
  [/^(?:who|which (?:people|users)) (?:does not|do not|are not|is not) (?:the network )?(?:work(?:ing)?|have service|get service)(?: for)?\??$|^for whom does the network not work\??$|^who is the network failing\??$/i, "¿a quiénes no les funciona la red?"],
  [/^which users (?:are failing|fail|do not work)\??$/i, "¿qué usuarios no funcionan?"],
  [/^(?:who|for whom) (?:does|is) the (?:network|mesh) not (?:work|working)(?: for)?\??$|^who is the (?:network|mesh) not working for\??$/i, "¿a quiénes no les funciona la red?"],
  [/^what is the limit of people (?:of|for|in) each (?:point|node|site)\??$/i, "¿cuál es el límite de personas de cada punto?"],
  [/^is (.+?) connected\??$/i, (_m, x: string) => `¿está conectada ${x}?`],
  [/^what do (?:i|we) need (?:to make it|for it to be|so that it is) feasible\??$/i, "¿qué necesito para que sea factible?"],
  [/^how (?:collapsed|saturated|overloaded|congested) is the (?:network|mesh)\??$/i, "¿qué tan colapsada está la red?"],
  [/^(?:does|is there) (?:the )?signal reach(?:es)? (.+?)\??$|^is there (?:a )?signal (?:at|in) (.+?)\??$/i, (_m, a: string, b: string) => `¿llega señal a ${a ?? b}?`],
  [/^how much (?:area )?does (?:it|the network) cover\??$|^how much does the area cover\??$/i, "¿cuánto cubre el área?"],
  [/^(?:can|will|does) the (?:network|mesh) (?:handle|hold|support|take|withstand) (\d+) (?:people|users|persons|wallets|families)\??$/i, "¿la red aguanta a $1 personas?"],
  // v17.3 · «will it hold 500 people?», «with 500 people, does it hold?», «see if it holds 500 people»
  [/^(?:will|can|does|would|could) it (?:hold|handle|take|support|cope with|survive|withstand) (\d+) (?:people|users|persons)\??$|^(?:with )?(\d+) (?:people|users|persons),? (?:does|will|can|would) (?:it|the network|the mesh) (?:hold(?: up)?|handle it|take it|cope|survive)\??$|^(?:see|check|test) (?:if|whether) (?:it|the network|the mesh) (?:holds|can hold|handles|can handle|supports|can take) (\d+) (?:people|users|persons)$/i, (_m, a: string, b: string, c: string) => `pon ${a ?? b ?? c} personas y mira si aguanta`],
  // «… and see if it holds»
  [/\b(?:and )?(?:see|check|test|verify) (?:if|whether) (?:it|the network|the mesh) (?:holds(?: up)?|can handle it|handles it|survives|withstands it)\b/gi, "y mira si aguanta"],
  // Exportar (v17.3: «give me the KMZ», «export it for Google Earth», «download the PDF», «make a PDF», «save my work»)
  [/\b(?:export|download|save|generate|give me|get me|send me|make)\b(?: the| a| an)?(?: coverage)?(?: as| to| in)?(?: a| an)? (?:kmz|kml|google earth(?: file)?)\b(?: file)?/gi, "exporta el KMZ"],
  [/\b(?:export|download|save|generate)\b(?: it| the coverage| the network| the map)? for google earth\b/gi, "exporta el KMZ"],
  [/\b(?:export|download|save|generate|send)\b(?: [\w-]+){1,3}? (?:as|to|in|into) (?:a |an )?(?:kmz|kml|google earth)\b(?: file| format)?/gi, "exporta el KMZ"],
  [/^(?:i need|i want|i would like|give me|get me|send me|hand me) (?:the |a |an )?(?:kmz|kml|google earth)(?: file)?$/i, "exporta el KMZ"],
  [/^(?:i need|i want|i would like|give me|get me|send me|hand me) (?:the |a |an )?(?:csv|excel)(?: file| spreadsheet)?$/i, "exporta el CSV"],
  [/^(?:i need|i want|i would like|give me|get me|send me|hand me) (?:the |a |an )?pdf(?: report| file| document)?$/i, "exporta un pdf"],
  [/\b(?:export|download|save|generate|give me|get me|send me)\b(?: the| a)?(?: nodes)?(?: as| to| in)?(?: a| an)? (?:csv|excel)\b(?: file)?/gi, "exporta el CSV"],
  [/\b(?:export|download|save)\b(?: the| this| my| our)? (?:scenario|json)\b(?: (?:as|to) json)?(?: file)?/gi, "guarda el escenario"],
  [/\b(?:save|store|keep)(?: the| my| this| our)? (?:project|work|progress|changes|file|session)\b|^save(?: it| this| everything| all)?$/gi, "guarda el escenario"],
  [/\b(?:export|download|save|generate|make|create|give me|get me|send me|print)\b(?: it| the network| the map| the report| the coverage| the results)?(?: as| to| in| into)? (?:a |an |the )?(pdf|word|docx|image|png|jpg|photo|screenshot|powerpoint|presentation)\b(?: report| file| document| version)?/gi, (_m, f: string) => `exporta un ${f.toLowerCase().replace("image", "imagen").replace("photo", "foto").replace("screenshot", "pantallazo").replace("presentation", "presentacion")}`],
  // Informe del enlace y distancia
  [/\b(?:radio )?link (?:budget )?report (?:between|for|of) (.+?) (?:and|to) (.+?)$/i, (_m, a: string, b: string) => `informe del enlace ${a} y ${b}`],
  // v17.3 · «link budget between…», «check the link between…», «how is the link between…?»
  [/\b(?:(?:check|show|test|analy[sz]e|evaluate|verify|review|calculate|give me)(?: me)? )?(?:the )?(?:radio )?link(?: budget)? (?:between|for|of|from) (.+?) (?:and|to) (.+?)\??$/i, (_m, a: string, b: string) => `informe del enlace ${a} y ${b}`],
  [/^(?:(?:analy[sz]e|check|show|test|review|evaluate) )?(?:the )?(?:radio )?link (?:budget |report )?(⟦\d+⟧|(?:the )?gateway),? (?:and |to |with )?(⟦\d+⟧|(?:the )?gateway)$/i, (_m, a: string, b: string) => `informe del enlace ${a} y ${b}`],
  [/^how is the (?:radio )?link (?:between|from) (.+?) (?:and|to) (.+?)\??$/i, (_m, a: string, b: string) => `informe del enlace ${a} y ${b}`],
  [/^(?:show (?:me )?)?(?:the )?path profile (?:from|between|of) (.+?) (?:to|and) (.+?)$/i, (_m, a: string, b: string) => `perfil de ${a} a ${b}`],
  [/^how far apart are (.+?) and (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  [/^how much distance (?:is there |is |there is )?between (.+?) and (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  [/^(?:the )?distance (?:of )?((?:the )?gateway|⟦\d+⟧) (?:to|and|-|with) ((?:the )?gateway|⟦\d+⟧)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  [/^(?:the )?distance from (.+?) to (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  [/\b(?:(?:measure|calculate|tell me|what is|what's) )?(?:the )?distance between (.+?) and (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  [/^how far is (.+?) from (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  [/^(?:show (?:me )?)?(?:the )?(?:terrain |elevation )?profile (?:from|between) (.+?) (?:to|and) (.+?)$/i, (_m, a: string, b: string) => `perfil de ${a} a ${b}`],
  [/^(?:measure|calculate|tell me|what is|what's) (?:the )?distance from (.+?) to (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  // Mapa y capas
  [/\b(?:show|display|turn on|enable|switch on|bring up|bring back|put back|see|view|activate|put) (?:me )?(?:the )?(?:roads|road layer|roads layer|streets)\b(?: layer)?/gi, "muestra las vías"],
  // v17.3 · «turn the roads off», «turn the rivers on»: las capas del mapa
  [/\bturn (?:the )?(roads?|road layer|rivers?|streams|names|labels|place names|links|circles|rings|borders|boundaries|limits|beams) (?:layer )?(on|off)\b/gi, (_m, capa: string, v: string) => `${v.toLowerCase() === "on" ? "muestra" : "quita"} ${capa.toLowerCase().replace(/road layer|roads?/, "roads").replace(/streams|rivers?/, "rivers")}`],
  // v17.3 · «turn off the roads», «disable the roads», «get rid of the roads»
  [/\b(?:turn off|switch off|disable|get rid of|take away|take off|kill|remove|hide|delete|erase|clear) (?:the )?(?:roads|road layer|roads layer|streets)\b(?: layer)?/gi, "quita las vías"],
  [/\b(?:switch|change|go|set|flip)(?: the)?(?: base)?(?: map)? (?:to|into)(?: the)? satellite(?: view| map| imagery| mode)?\b|\b(?:use|show|put|give me)(?: the)? satellite (?:view|map|imagery|mode)\b|\bsatellite (?:view|map|imagery|mode)\b/gi, "pon el mapa satelital"],
  // v17.6 · «switch to OpenTopoMap», «put the map with contour lines», «change to streets», «back to the street map»
  [/\b(?:use|switch(?: the map)? to|change(?: the map)? to|go(?: back)? to|back to|put(?: the map)?(?: with| on)?|show|give me)(?: the)? (?:open ?topo ?map|contour lines|contours|map with contour lines)\b|\bput the map with contour lines\b/gi, "pon el mapa OpenTopoMap"],
  [/\b(?:use|switch to|change to|go to|put|show|give me)(?: the)? topo(?:graphic(?:al)?)?(?: map| view)?\b|\btopo map\b/gi, "pon el mapa topográfico"],
  [/\b(?:use|switch to|change to|go to|put|show|give me)(?: the)? streets? map\b/gi, "pon el mapa de calles"],
  [/\b(?:switch|change|go|go back|back)(?: the map)? to (?:the )?streets?(?: map| view)?\b/gi, "pon el mapa de calles"],
  [/\b(?:town|place|village) names?\b/gi, "nombres de poblados"],
  [/\bwhere(?: there)?(?:'s| is| are) no (?:service|signal|coverage)\b/gi, "las zonas sin servicio"],
  [/\b(?:change|switch|set|put) (?:the )?colou?rs? (?:mode )?to signal\b|\bcolou?rs? (?:it )?by (?:the )?signal\b|^signal mode$/gi, "colorea por señal"],
  [/\b(?:change|switch|set|put) (?:the )?colou?rs? (?:mode )?to (?:the )?best (?:antenna|server)\b|\bcolou?r (?:it )?by (?:the )?best (?:antenna|server)\b/gi, "colorea por mejor antena"],
  [/^(?:the )?(?:backup|redundancy) mode$|\b(?:change|switch|set|put) (?:the )?colou?rs? (?:mode )?to (?:backup|redundancy)\b/gi, "muestra el respaldo"],
  [/\b(?:the )?antenna directions?\b|\bthe direction of the antennas\b/gi, "la dirección de las antenas"],
  [/^(?:set |put |change |make )?(?:the )?(?:coverage )?opacity (?:to |at |of |in )?(\d{1,3}) ?(?:%|percent)?$/gi, "pon la opacidad en $1 %"],
  [/\b(?:hide|remove|turn off|disable) (?:the )?rivers(?: and (?:the )?(?:names|labels))?\b/gi, (m) => (/names|labels/i.test(m) ? "quita los ríos y los nombres" : "quita los ríos")],
  [/\b(?:show|display) (?:me )?(?:the )?backup(?: map)?\b|\bshow (?:the )?redundancy\b/gi, "muestra el respaldo"],
  [/\b(?:show|display) (?:me )?(?:the )?best (?:antenna|server)\b/gi, "muestra la mejor antena"],
  [/\b(?:show|display) (?:me )?(?:the )?signal in dbm\b/gi, "muestra la señal en dBm"],
  [/\b(?:show|display) (?:me )?(?:the )?coverage in (µv|uv|microvolts?)\b/gi, "muéstrame la cobertura en µV"],
  [/\b(?:use|switch to|put|show) (?:the )?topographic map\b|\btopographic map\b/gi, "pon el mapa topográfico"],
  [/\b(?:use|switch to|put|show) (?:the )?satellite(?: map| view| imagery)?\b/gi, "pon el mapa satelital"],
  [/\brainbow colou?rs? from (-?\d+) to (-?\d+) ?dbm\b/gi, "colores arcoíris de $1 a $2 dBm"],
  [/\b(?:paint|color|colour) only with (?:a )?threshold of (-?\d+) ?dbm\b/gi, "pinta solo con umbral de $1 dBm"],
  [/\banimate the (?:network|mesh)\b/gi, "anima la red"],
  [/\b(?:stop|remove|turn off) the animation\b/gi, "quita la animación"],
  [/\b(?:show|fit|zoom to|frame|see) (?:me )?(?:the )?(?:whole|entire|full) (?:network|mesh)\b|\b(?:show|see|view) (?:me )?all (?:of )?the (?:network|mesh)\b|^zoom out to see (?:everything|it all|all of it|all|the whole (?:network|mesh|thing))$|\bfit (?:the )?(?:map|view) to (?:the )?(?:network|mesh)\b|\bzoom to fit\b/gi, "muéstrame toda la red"],
  // v17.5 · Soltar la regla («turn off the ruler», «put down the ruler»)
  [/\b(?:turn off|switch off|deactivate|disable|close|put away|put down|drop|release|stop using|let go of) (?:the )?ruler\b(?: tool)?|\bstop measuring\b/gi, "suelta la regla"],
  [/\b(?:turn on|activate|enable|open|use|give me|grab|get|pick up|take|bring up) (?:the )?ruler\b(?: tool)?|\bmeasure with the ruler\b/gi, "activa la regla"],
  // v17.4 · Borrar lo medido con la regla («delete the measurements», «clear the ruler»)
  [/\b(?:delete|remove|clear|erase|wipe|reset|trash|get rid of)(?: all)?(?: of)? (?:the |my |these |those )?(?:ruler )?(?:measurements?|measures|measured lines|ruler lines)\b|\b(?:clear|erase|wipe|reset) (?:the )?ruler\b/gi, "borra las mediciones"],
  // v17.2 · El lápiz de malla (cómo se usa, soltarlo y activarlo)
  [/\bhow (?:do|can|should|would) (?:i|we|you) use (?:the )?(?:mesh )?(?:pencil|brush)\b/gi, "cómo se usa el lápiz"],
  [/\b(?:turn off|deactivate|disable|close|put down|put away|drop|release|stop using|exit|leave) (?:the )?(?:mesh )?(?:pencil|brush)\b|\bput (?:the )?(?:mesh )?(?:pencil|brush) (?:down|away)\b/gi, "suelta el lápiz"],
  [/\b(?:stop|quit|finish) drawing\b/gi, "deja de dibujar"],
  [/\b(?:turn on|activate|enable|open|use|give me|pick up|grab) (?:the )?(?:mesh )?(?:pencil|brush)\b/gi, "activa el lápiz"],
  [/\b(?:i want to|i wanna|let me|i'll|i will|can i|i'd like to|i would like to) draw (?:the |a |my )?(?:mesh|network|zone|strip)\b/gi, "quiero dibujar la malla"],
  [/\b(?:i want to|i wanna|let me|can i|i'd like to|i would like to) draw(?: it)?(?: myself)?$/gi, "quiero dibujar"],
  [/\bdraw (?:the |a )?(?:mesh|network) (?:by hand|freehand)\b/gi, "dibujar la malla a mano"],
  // v17.2 · El criterio de óptimo: «¿necesito más antenas?», «¿sobran antenas?», «¿por qué no pongo más?»
  [/\b(?:do|would|will) (?:i|we) need (?:any )?more (?:antennas?|repeaters?|nodes?|towers?)\b/gi, "necesito más antenas"],
  [/\b(?:should|must|do|shall) (?:i|we) (?:add|put|place|install) (?:any )?more (?:antennas?|repeaters?|nodes?|towers?)\b/gi, "debo poner más antenas"],
  [/\b(?:are there|do (?:i|we) have|is that|aren't there|isn't that|are these|are those) too many (?:antennas|repeaters|nodes|towers)\b|\btoo many (?:antennas|repeaters|towers)\b/gi, "sobran antenas"],
  [/\b(?:are there|do (?:i|we) have) (?:any )?(?:extra|unnecessary|redundant|spare|surplus) (?:antennas|repeaters|nodes|towers)\b/gi, "sobran antenas"],
  [/\bwhy (?:not|(?:do|don't|should|shouldn't|can|can't|cannot) not (?:i|we)|(?:don't|do not|shouldn't|should not|can't|cannot|can not) (?:i|we)) (?:just )?(?:add|put|place|install) more(?: antennas| repeaters| nodes| towers)?\b/gi, "por qué no pongo más"],
  [/\bis (?:the|my|this) (?:network|mesh) (?:optimal|optimized|optimised|well sized|right-sized|well designed|well-designed|efficient|the best it can be|as good as it can be)\b/gi, "la red es óptima"],
  [/\bis (?:the|my|this) (?:network|mesh) (?:oversized|over-dimensioned|overbuilt)\b/gi, "la red está sobredimensionada"],
  [/\bis (?:the|my|this) (?:network|mesh) (?:undersized|under-dimensioned)\b/gi, "la red está subdimensionada"],
  [/\b(?:can|could) (?:i|we) (?:remove|take out|drop|get rid of|cut) (?:some |any )?(?:of (?:the|my|these|those) )?(?:antennas|repeaters|nodes|towers)\b/gi, "puedo quitar antenas"],
  [/\bwith fewer (?:antennas|repeaters|towers)\b/gi, "con menos antenas"],
  [/\b(?:turn on|activate|enable) (?:the )?(?:automatic simulation|simulate on change|auto[- ]?simulat(?:e|ion))\b|^(?:simulate on change|auto[- ]?simulate)$/gi, "activa la simulación automática"],
  [/\b(?:turn off|deactivate|disable|stop) (?:the )?(?:automatic simulation|simulate on change|auto[- ]?simulat(?:e|ion))\b/gi, "apaga simular al cambiar"],
  [/\b(?:use|with) (?:the )?real terrain\b|\buse (?:the )?real elevation\b/gi, "usa el relieve real"],
  // v17.3 · «use actual terrain», «turn on the terrain», «use the elevation»
  [/\b(?:use|turn on|enable|switch on|switch to|activate|apply)(?: the)? (?:real |actual |true )?(?:terrain|elevation|relief|topography|elevation data|terrain data)\b(?! (?:map|profile|in 3d|view|relief))/gi, "usa el relieve real"],
  [/\b(?:simulate )?with flat terrain\b|\b(?:use )?flat terrain\b/gi, "simula con terreno plano"],
  [/\b(?:assume|consider|treat)(?: that)? the (?:ground|terrain|earth|land) (?:is|as) flat\b|^the (?:ground|terrain) is flat$|\b(?:use|assume|with|simulate with|simulate on)(?: a)? flat (?:ground|earth|land|surface)(?: model)?\b|\bignore (?:the )?(?:terrain|elevation|relief|topography)\b|\bwithout (?:the )?(?:terrain|elevation|relief)\b|\bturn off (?:the )?(?:terrain|relief|elevation)\b/gi, "simula con terreno plano"],
  // Parámetros
  [/\b(?:set|put|change) (?:the )?hop limit (?:of|for) (.+?) to (\d+)\b/gi, "pon el límite de saltos del $1 en $2"],
  [/\b(?:set|put|change) (?:the )?hops? limit (?:to|in|at) (\d+)\b|\bhops? limit (?:of|to|in) (\d+)\b/gi, (_m, a: string, b: string) => `pon el límite de saltos en ${a ?? b}`],
  // v17.3 · «hop limit 5», «max hops 5», «limit the hops to 5», «allow up to 5 hops», «5 hops max»
  [/\b(?:set|put|change|make|limit)(?: the)?(?: max(?:imum)?| maximum number of| max number of| number of)? hops (?:to|at|of) (\d+)\b|\bhop limit(?: of| to| at| =)? (\d+)\b|\blimit (?:the )?hops to (\d+)\b|\b(?:allow|permit) (?:up to|at most|a maximum of|max) (\d+) hops\b|\bmax(?:imum)?(?: of)? (\d+) hops\b|\bmax(?:imum)? hops(?: of| to| at| =)? (\d+)\b|\b(\d+) hops (?:max|maximum|at most|tops)\b/gi, (_m, a: string, b: string, c: string, d: string, e: string, f: string, g: string) => `pon el límite de saltos en ${a ?? b ?? c ?? d ?? e ?? f ?? g}`],
  // v17.3 · El factor de dispersión: «set the spreading factor to 10», «spreading factor 10», «change to SF10»
  [/\b(?:set|change|switch|put|use)(?: the)? (?:spreading factor|sf)(?: of)? (?:to |at |on |=)?(\d{1,2})\b|\b(?:use |with )?(?:a )?spreading factor(?: of)? (\d{1,2})\b|\b(?:change|switch|go|move) to SF ?(\d{1,2})\b/gi, (_m, a: string, b: string, c: string) => `usa SF${a ?? b ?? c}`],
  // v17.3 · El protocolo: «set the protocol to MeshCore», «go with Meshtastic»
  [/\b(?:set|change|switch|put)(?: the)? protocol (?:to|on) (MeshCore|Meshtastic)\b|\bgo with (MeshCore|Meshtastic)\b/gi, (_m, a: string, b: string) => (/tastic/i.test(a ?? b) ? "cambia a Meshtastic" : "usa MeshCore")],
  // v17.3 · El suelo: «the ground is wet»
  [/\bthe (?:ground|soil|terrain) is (?:wet|humid|moist|damp)\b/gi, "el suelo es húmedo"],
  [/\bthe (?:ground|soil|terrain) is dry\b/gi, "el suelo es seco"],
  [/\b(?:study radius|radius of study) (?:of|to) (\d+(?:\.\d+)?) ?km\b/gi, "radio de estudio de $1 km"],
  [/^(?:set )?(?:the )?radius (?:of|to) (\d+(?:\.\d+)?) ?km$/i, "radio de $1 km"],
  [/\buse longley[- ]rice like radio mobile\b|\blike radio mobile\b/gi, "usa Longley-Rice como Radio Mobile"],
  [/\breset (?:the )?radio mobile parameters\b|\brestore (?:the )?radio mobile parameters\b/gi, "restablece los parámetros de Radio Mobile"],
  [/\bwith dense vegetation\b|\bdense vegetation\b/gi, "con vegetación densa"],
  [/\b(?:consider|assume|use) (?:an )?open (?:field|country|terrain)\b/gi, "considera campo abierto"],
  [/\b(?:the )?(?:zone|area) is (?:a|an) (palm|oil palm) plantation\b/gi, "la zona es una plantación de palma"],
  [/\bthe soil is (wet|humid|moist)\b/gi, "el suelo es húmedo"],
  [/\bthe soil is dry\b/gi, "el suelo es seco"],
  [/\b(?:change|set|switch) (?:the )?polari[sz]ation to horizontal\b|\bhorizontal polari[sz]ation\b/gi, "cambia la polarización a horizontal"],
  [/\b(?:change|set|switch) (?:the )?polari[sz]ation to vertical\b|\bvertical polari[sz]ation\b/gi, "cambia la polarización a vertical"],
  [/\b(?:set|put|use) (?:the )?reliability (?:to )?high\b|\bhigh reliability\b/gi, "pon la confiabilidad alta"],
  [/\bwith (?:a )?reliability of (\d+(?:\.\d+)?) ?%/gi, "con una confiabilidad del $1 %"],
  [/\b(\d+(?:\.\d+)?) ?% reliability\b|\b(?:set |put )?(?:the )?reliability (?:of|at|to) (\d+(?:\.\d+)?) ?%/gi, (_m, a: string, b: string) => `confiabilidad del ${a ?? b} %`],
  [/\b(?:set|change|put|move) (?:the )?frequency (?:to|at|on) (\d+(?:\.\d+)?) ?mhz\b|^(?:the )?frequency (?:to|at|of) (\d+(?:\.\d+)?) ?mhz$/gi, (_m, a: string, b: string) => `la frecuencia a ${a ?? b} MHz`],
  [/\b(\d+(?:\.\d+)?) ?% of the time\b/gi, "$1 % del tiempo"],
  [/\b(?:wet|humid|moist) (?:ground|soil)\b/gi, "suelo húmedo"],
  [/\bdry (?:ground|soil)\b/gi, "suelo seco"],
  [/(-\d+(?:\.\d+)?) ?dbm threshold\b|\bthreshold (?:of|at|to) (-\d+(?:\.\d+)?) ?dbm\b/gi, (_m, a: string, b: string) => `umbral de ${a ?? b} dBm`],
  [/\breceiver gain of (\d+(?:\.\d+)?) ?dbi\b/gi, "ganancia del receptor de $1 dBi"],
  [/\buse (?:a )?continental temperate climate\b|\bcontinental temperate\b/gi, "usa clima continental templado"],
  [/\baccidental mode\b/gi, "modo accidental"],
  [/\buse (\d+(?:\.\d+)?) ?% of (?:the )?time\b/gi, "usa $1 % del tiempo"],
  [/\b(?:use|switch to|change to) mesh ?tastic\b/gi, "cambia a Meshtastic"],
  [/\b(?:use|switch to|change to) mesh ?core\b/gi, "usa MeshCore"],
  [/\buse (?:the )?capacity preset\b/gi, "usa el preset de capacidad"],
  [/\buse (?:the )?range preset\b/gi, "usa el preset de alcance"],
  [/\b(?:use|switch to|set) (long ?fast|sf\d{1,2})\b/gi, (_m, x: string) => `usa ${x.replace(/long ?fast/i, "LongFast").toUpperCase().replace("LONGFAST", "LongFast")}`],
  // Ajuste y optimización
  [/\b(?:adjust|tune|fix) it (?:for me |automatically )+|\bauto[- ]?adjust(?: it| the network)?\b|\badjust (?:it|the network) automatically\b|\bmake it feasible automatically\b/gi, "ajústamelo automáticamente"],
  // v17.3 · «do the automatic adjustment», «adjust the network for me»
  [/\b(?:do|run|make|perform|start)(?: the| an)? automatic adjust(?:ment)?\b|\badjust (?:the network|the mesh|my network) for me\b|\bauto[- ]?adjustment\b/gi, "ajústamelo automáticamente"],
  [/\badjust (?:it|the network) (?:using |with )?(?:only|just) heights\b|\bonly (?:with )?heights\b/gi, "ajústala solo con alturas"],
  [/\badjust (?:it|the network) (?:for|to get|to reach) (?:the )?(?:greatest|maximum|max|largest|biggest|highest|most) (?:possible )?coverage(?: possible)?\b/gi, "ajústamelo para la mayor cobertura posible"],
  [/\bat most (\d+) support antennas?\b/gi, "máximo $1 antenas de apoyo"],
  [/\b(?:do not|don't) move the nodes\b/gi, "no muevas los nodos"],
  [/\bwithout moving the nodes\b/gi, "sin mover los nodos"],
  [/\bas (?:the )?target area (?:at|with) (\d+(?:\.\d+)?) ?%/gi, "como área objetivo con el $1 %"],
  [/\bas (?:the )?target area\b/gi, "como área objetivo"],
  [/\badjust (?:it|the network) with towers (?:of )?up to (\d+) ?m\b/gi, "ajústala con torres hasta $1 metros"],
  [/\bmake it feasible without (?:going over|exceeding|passing) (\d+) ?m\b/gi, "hazla factible sin pasar de $1 m"],
  [/\badjust the network to (?:reach|meet) the (?:goal|target) (?:at|with) the (?:lowest|least|minimum) cost\b/gi, "ajusta la red para llegar a la meta con el menor costo"],
  // v17.2 · «Adjust it with fewer repeaters»: es el ajuste (no la pregunta del óptimo)
  [/\badjust (?:it|this|the network|the mesh|my network|my mesh)\b/gi, "ajusta la red"],
  [/\bgive me the (?:cheapest|most economical) option(?: to make it feasible| for it to be feasible)?\b/gi, "dame la opción más económica para que sea factible"],
  [/\bapply the optimi[sz]ation\b/gi, "aplica la optimización"],
  // v17.3 · «accept the optimization», «go with the optimized network», «apply optimization»
  [/\b(?:apply|accept|use|go with|take|keep|implement|confirm|approve)(?: the| that| this| your| my| our)? (?:optimi[sz]ations?|optimi[sz]ed (?:network|mesh|version|design|layout|one)s?|optimi[sz]ation proposals?)\b|^apply optimi[sz]ations?$/gi, "aplica la optimización"],
  // v17.4 · «Run the optimization»: el sustantivo en inglés ya no pasa por el verbo del español («optimiz…»)
  [/\b(?:run|do|make|start|launch|perform|execute|begin|carry out)(?: the| an| a| another| a new)? (?:network |mesh )?optimi[sz]ation(?: of (?:the|my|our) (?:network|mesh))?\b/gi, "optimiza la red"],
  [/\boptimi[sz]e the (?:network|mesh) for the load\b/gi, "optimiza la red para la carga"],
  [/\boptimi[sz]e the (?:network'?s? )?cost(?: of the network)?\b/gi, "optimiza el costo de la red"],
  [/\boptimi[sz]e the (?:network|mesh) with (?:a )?(?:maximum|max|at most) (?:of )?(\d+) support antennas?(?: and (?:do not|don't) move the nodes)?\b/gi, (m, n: string) => `optimiza la red con máximo ${n} antenas de apoyo${/move/i.test(m) ? " y no muevas los nodos" : ""}`],
  [/\boptimi[sz]e (?:the )?(?:network|mesh)\b|\boptimi[sz]e it\b/gi, "optimiza la red"],
  [/\brecommend (?:me )?(?:some )?(?:support|backup|extra) gateways\b/gi, "recomiéndame gateways de apoyo"],
  // Carga y estrés
  [/\b(?:run|do|make) (?:the |a )?stress test (?:on|for) (?:a )?market day\b|\bstress test (?:on|for) market day\b|\b(?:test|run|try) (?:the )?peak hour (?:on|for) (?:a )?market day\b/gi, "haz la prueba de estrés en día de mercado"],
  [/\b(?:on|for) (?:a )?market day\b/gi, "en día de mercado"],
  [/\b(?:on|for) (?:a )?normal day\b/gi, "en día normal"],
  [/\b(?:test|run|try) (?:the )?peak hour with what was measured at the gateway\b|\bpeak hour with the gateway measurements?\b/gi, "prueba la hora pico con lo medido en el gateway"],
  [/\b(?:test|run|try) (?:the )?peak hour with (\d+) payments? per person (?:a|per) day\b/gi, "prueba la hora pico con $1 pagos por persona al día"],
  [/\b(?:run|do|make|perform|start|launch|try) (?:a |the )?stress[- ]test\b(?: (?:on |for )?(?:the |my )?(?:network|mesh))?|\bstress[- ]test(?:ing)?\b(?: (?:the |my )?(?:network|mesh))?/gi, "haz la prueba de estrés"],
  // v17.3 · La prueba de carga: «run a load test», «load test the network»
  [/\b(?:run|do|make|perform|start|launch|try) (?:a |the )?load[- ]test\b(?: (?:on |for )?(?:the |my )?(?:network|mesh))?|\bload[- ]test(?:ing)?\b(?: (?:the |my )?(?:network|mesh))?/gi, "haz la prueba de carga"],
  [/\b(?:test|run|try) (?:the )?peak hour\b|\bpeak hour test\b/gi, "prueba la hora pico"],
  [/\bwith the measured (?:data|profile|traffic)\b|\bwith what was measured\b/gi, "con lo medido"],
  [/\bsend (\d+) payments? at (?:the same time|once)\b/gi, "envía $1 pagos al tiempo"],
  [/\bsend (\d+) messages? at (?:the same time|once) (?:in|within) (\d+) seconds?\b/gi, "manda $1 mensajes al tiempo en $2 segundos"],
  [/\bsend (\d+) whatsapps?(?: messages?)? (?:in|within) (\d+) seconds?\b/gi, "manda $1 mensajes de WhatsApp en $2 segundos"],
  [/\bsend (\d+) whatsapps?(?: messages?)?(?: at (?:the same time|once))?\b/gi, "manda $1 mensajes de WhatsApp al tiempo"],
  [/\bsend (?:a )?test message\b/gi, "manda un mensaje de prueba"],
  [/\bsend (?:a )?message from (.+?)$/gi, "envía un mensaje desde $1"],
  [/\bsend (?:a )?payment from (.+?)$/gi, "envía un pago desde $1"],
  [/\b(?:let us )?send payments until it (?:breaks|collapses|saturates)\b/gi, "mandemos pagos hasta que se reviente"],
  [/\bsimulate (\d+) payments? per hour\b/gi, "simula $1 pagos por hora"],
  [/\bfill (?:each|every) repeater (?:up )?to its (?:people )?limit\b/gi, "llena cada repetidor hasta su límite de personas"],
  [/\bfill the gateway (?:up )?to its limit\b/gi, "llena el gateway hasta su límite"],
  [/\bput (?:the )?maximum (?:number of )?people (?:it|that it) (?:can )?(?:supports?|handles?|holds?) (?:in|on|at) (.+?)$/gi, "pon en $1 la cantidad máxima de personas que soporte"],
  [/\b(?:remove|delete|clear) (?:the )?popularity zones\b/gi, "quita las zonas de popularidad"],
  [/\b(?:remove|delete|clear) (?:the )?populated(?: people| ones)?\b/gi, "quita las pobladas"],
  [/\b(?:remove|delete|clear) (?:the )?target area\b/gi, "quita el área objetivo"],
  [/\b(?:delete|remove|erase) (?:all (?:the )?|every )(?:people|persons|users)\b|\bdelete everyone\b|\bremove everyone\b/gi, "borra todas las personas"],
  [/\b(?:delete|remove|erase) everything (?:except|but) the gateway\b/gi, "elimina todo menos el gateway"],
  [/\bpopulate (?:the )?(?:zone|area) with (\d+) (?:people|persons|users)\b/gi, "puebla la zona con $1 personas"],
  // v17.3 · «fill the area with 500 people», «spread 500 people over the area», «scatter 500 people around the zone»
  [/\b(?:fill|populate|load|pack) (?:the |this )?(?:zone|area|region|map) with (\d+) (?:people|persons|users)\b|\b(?:spread|scatter|distribute|sprinkle|throw|drop|put|place|add) (\d+) (?:people|persons|users) (?:over|across|around|throughout|in|into|on|onto|to|all over) (?:the |this )?(?:zone|area|region|map)\b/gi, (_m, a: string, b: string) => `puebla la zona con ${a ?? b} personas`],
  // «place 300 people around Repeater 1 in a 3 km radius»
  [new RegExp(String.raw`\b(?:put|place|add|spread|scatter) (\d+) (?:people|persons|users) (?:around|near|by) (.+?) (?:in|within) a ${NUM} ?(${DISTANCIA}) radius\b`, "gi"), "pon $1 personas alrededor de $2 a $3 $4"],
  [/\bpopulate (?:the )?(?:zone|area) (?:with )?(?:a )?(sparse|dispersed|scattered) density\b/gi, "puebla la zona con densidad dispersa"],
  [/^populate(?: people)?$/i, "popular personas"],
  [/\bin this (?:zone|area) there are (\d+) users,? (?:spread|distribute) them (?:over|across|through) the (?:network|mesh)\b/gi, "en esta zona son $1 usuarios, repártelos por la malla"],
  [/\b(?:spread|distribute|put) 1 person per km2? only where there is signal\b/gi, "reparte 1 persona por km2 solo donde haya señal"],
  [/\b(?:make|create|add) a popularity zone (?:of|with) (\d+) people (?:in|on|at|around) (.+?)$/gi, "zona de popularidad de $1 personas en el $2"],
  [/\b(?:make|create|add|put) a popularity zone (?:in|on|at|around) the gateway\b|\bpopularity zone (?:in|at|on) the gateway\b/gi, "zona de popularidad en el gateway"],
  [/\b(?:in|on|at) each repeater (\d+) people (?:within|at|in) (\d+(?:\.\d+)?) ?km\b/gi, "en cada repetidor $1 personas a $2 km"],
  [/\bsize (?:the network )?(?:for )?(\d+) users (?:in|over|across|on) (\d+) ?(?:km(?:2|²)?|square kilomet(?:er|re)s?) of (?:savannah|savanna)\b/gi, "dimensiona $1 usuarios en $2 km2 de sabana"],
  [/\b(?:spread|distribute|put) (\d+(?:\.\d+)?) (?:person|people|persons|users?) per (?:km2|km²|square kilomet(?:er|re)) (?:over|across|in|on) (?:the )?target area\b/gi, "reparte $1 persona por km² en el área objetivo"],
  [/\b(?:throw|drop|load) (\d+) (?:users|people|persons) (?:onto|on|into|at) (.+?)$/gi, "métele $1 usuarios al $2"],
  [/\bput (\d+) (?:users|people|persons) onto (.+?)$/gi, "métele $1 usuarios al $2"],
  [/\bhow far can (.+?) (?:hold|handle|go|take) with (\d+) people (?:within|at|in) (\d+) ?km\b/gi, "evalúa hasta qué punto soporta el $1 con $2 personas a $3 km"],
  // Diseños de red: la medida antes del sustantivo («a 4 km network», «a 6 km radius mesh»)
  [new RegExp(String.raw`\b(?:a |an )?${NUM} ?(${DISTANCIA}) radius (?:lora )?(network|mesh)\b`, "gi"), (_m, n: string, u: string, r: string) => `una ${/mesh/i.test(r) ? "malla" : "red"} de ${n} ${u} a la redonda`],
  [new RegExp(String.raw`\b(?:a |an )?${NUM} ?(${DISTANCIA}) (?:lora )?(network|mesh)\b`, "gi"), (_m, n: string, u: string, r: string) => `una ${/mesh/i.test(r) ? "malla" : "red"} de ${n} ${u}`],
  [/\b(?:a )?(sustainable|stable|reliable|robust|economical|cheap|cheaper|redundant) (network|mesh)\b/gi, (_m, adj: string, red: string) => `${/mesh/i.test(red) ? "malla" : "red"} ${{ sustainable: "sostenible", stable: "estable", reliable: "estable", robust: "robusta", economical: "económica", cheap: "económica", cheaper: "económica", redundant: "con respaldo" }[adj.toLowerCase()] ?? adj}`],
  [/\b(?:build|make|create|set up|design|plan|put together|assemble|draw up|lay out)(?: me)?(?: a| an| the)? (?=(?:new )?(?:red|malla|network|mesh|lora network)\b)/gi, "ármame una "],
  [/\b(?:build|make|create|set up|design|plan|put together|assemble|draw up|lay out)(?: me)? (?=una (?:red|malla)\b)/gi, "ármame "],
  [/\b(?:new )?(?:lora )?(?:network|mesh network)\b/gi, "red"],
  // «mesh tastic» es Meshtastic dicho por voz (no la malla)
  [/\bmesh\b(?! ?tastic)/gi, "malla"],
  [/\b(?:the )?(?:whole|entire) municipality\b/gi, "todo el municipio"],
  [/\b(?:the )?northern part of (?:the )?municipality\b|\bthe north (?:zone|part|area) of the municipality\b/gi, "la zona norte del municipio"],
  [/\b(?:the )?southern part of (?:the )?municipality\b|\bthe south (?:zone|part|area) of the municipality\b/gi, "la zona sur del municipio"],
  [/\bwhat i am (?:looking at|seeing)\b|\bwhat i see\b/gi, "lo que estoy viendo"],
  [/\bpopularity zones\b/gi, "zonas de popularidad"],
  [/\bpopularity zone\b/gi, "zona de popularidad"],
  [/\b(red|malla)( (?:sostenible|estable|robusta|económica|con respaldo))? (?=\d)/gi, (_m, r: string, a: string) => `${r}${a ?? ""} de `],
  [/\bthat covers\b|\bcovering\b|\bto cover\b|\bthat gives coverage to\b/gi, "que cubra"],
  [/\b(?:with |and )?(?:a )?budget of\b/gi, "con un presupuesto de"],
  [/\bwith (?:a )?backup\b|\bwith redundancy\b/gi, "con respaldo"],
  [/\b(?:a )?(?:maximum|max|at most|no more than|up to) (?:of )?(\d+) repeaters\b/gi, "máximo $1 repetidores"],
  [/\b(?:with|using) repeaters (?:at|of) (\d+(?:\.\d+)?) ?m\b|\bwith (\d+(?:\.\d+)?) ?m repeaters\b/gi, (_m, a: string, b: string) => `con repetidores de ${a ?? b} m`],
  [/\bwith (good|stable|fair|medium|weak) signal (?:in|at|for|over) (?:the )?(\d+(?:\.\d+)?) ?%/gi, (_m, s: string, p: string) => `con señal ${{ good: "buena", stable: "estable", fair: "media", medium: "media", weak: "baja" }[s.toLowerCase()]} en el ${p} %`],
  [/\bwith (good|stable|fair|medium|weak) signal\b/gi, (_m, s: string) => `con señal ${{ good: "buena", stable: "estable", fair: "media", medium: "media", weak: "baja" }[s.toLowerCase()]}`],
  [/\b(?:a )?(?:square|squared) area of\b/gi, "un área cuadrada de"],
  [/\b(?:a|an) area of (\d+(?:\.\d+)?) (?:by|x) (\d+(?:\.\d+)?) ?(km|millas|milla|m)\b/gi, "un área de $1 por $2 $3"],
  [/\b(\d+(?:\.\d+)?) ?(?:by|x) (\d+(?:\.\d+)?) ?(km|millas|milla|m)\b/gi, "un área de $1 por $2 $3"],
  [/\b(?:a|an) (\d+(?:\.\d+)?) ?(millas|milla|km) square\b|\ba square (?:of|with) (\d+(?:\.\d+)?) ?(millas|milla|km) (?:per|on each|a) side\b/gi, (_m, a: string, u: string, b: string, v: string) => `un cuadrado de ${a ?? b} ${u ?? v} de lado`],
  [/\b(?:a )?circle (?:of )?(\d+(?:\.\d+)?) ?(km|millas|milla) (?:in )?diameter\b|\b(?:a )?(\d+(?:\.\d+)?) ?(km|millas|milla) diameter circle\b/gi, (_m, a: string, u: string, b: string, v: string) => `un círculo de ${a ?? b} ${u ?? v} de diámetro`],
  [/\bthe area (?:that )?i (?:just )?measured\b/gi, "el área que medí"],
  [/\b(?:the )?(?:whole|entire) country\b|\ball of colombia\b/gi, "todo el país"],
  [/\beven if it costs more\b/gi, "aunque cueste más"],
  [/\bwith (\d+(?:\.\d+)?) ?% adoption\b/gi, "con $1% de adopción"],
  [/\bfor (\d+) (familias|personas|usuarios)\b/gi, "para $1 $2"],
  // Radios y alrededores
  [new RegExp(String.raw`\b(\d+) (?:people|persons|personas|users|usuarios) (?:around|alrededor de|at|in|on|en) (?:each|every|cada) (?:repeater|repetidor) (?:within|a|at) ${NUM} ?(${DISTANCIA})\b`, "gi"), "$1 personas a $2 $3 a la redonda de cada repetidor"],
  [new RegExp(String.raw`\bwithin ${NUM} ?(${DISTANCIA}) (?:of|from|around)\b`, "gi"), "en $1 $2 a la redonda de"],
  [new RegExp(String.raw`\bwithin ${NUM} ?(${DISTANCIA})\b`, "gi"), "a $1 $2"],
  [new RegExp(String.raw`\b${NUM} ?(${DISTANCIA}) in radius\b`, "gi"), "de $1 $2 de radio"],
  [new RegExp(String.raw`\b(?:a |an )?${NUM} ?${DISTANCIA} radius\b`, "gi"), "$1 MEDIDA_RADIO"],
  [/\bin a radius of\b|\bwithin a radius of\b/gi, "en un radio de"],
  [/\bradius of\b/gi, "radio de"],
  [new RegExp(String.raw`\b${NUM} ?(${DISTANCIA}) (?:around|round)\b`, "gi"), "$1 $2 a la redonda de"],
  [new RegExp(String.raw`\b${NUM} ?(${SUPERFICIE}) (?:around|near)\b`, "gi"), "$1 $2 alrededor de"],
  [/\ba la redonda de here\b/gi, "a la redonda de aquí"],
  [/\ba la redonda de(?=\s*(?:[,.;]|$))/gi, "a la redonda"],
  [/\b(?:right )?(?:around|from|near) here\b|\bhere\b/gi, "de aquí"],
  [/\b(?:around|surrounding)\b/gi, "alrededor de"],
  [/\bnear\b/gi, "cerca de"],
  // Alturas
  [/^(?:put|set|make)( it| that one)? (?:at |to |up to )?(\d+(?:\.\d+)?) ?m(?: (?:high|tall|height))?$/i, (_m, it: string, h: string) => (it ? `súbelo a ${h} m` : `sube a ${h} m`)],
  [/^(?:raise|lift|increase|bump|move up)( it| that one)?(?: up)? (?:to |up to )(\d+(?:\.\d+)?) ?m$/i, (_m, it: string, h: string) => (it ? `súbelo a ${h} m` : `sube a ${h} m`)],
  [/\bbump (.+?) up to (\d+(?:\.\d+)?) ?m\b/gi, "sube $1 a $2 m"],
  [/^make (.+?) taller,? (?:to )?(\d+(?:\.\d+)?) ?m$/i, "sube $1 a $2 m"],
  // v17.3 · «make it taller», «make Repeater 1 shorter» (sin altura: Melki pregunta a cuánto)
  [/^make (⟦\d+⟧) (?:taller|higher)$/i, "sube $1"],
  [/^make (⟦\d+⟧) (?:shorter|lower)$/i, "baja $1"],
  // v17.3 · «move it up to 30 m», «move Repeater 1 down to 10 m»: es la altura, no un traslado
  [/^(?:move|bring|take) (⟦\d+⟧|it|that one) (up|down) to (\d+(?:\.\d+)?) ?m$/i, (_m, x: string, d: string, h: string) => (/^(?:it|that one)$/i.test(x) ? `${d.toLowerCase() === "up" ? "súbelo" : "bájalo"} a ${h} m` : `${d.toLowerCase() === "up" ? "sube" : "baja"} ${x} a ${h} m`)],
  [/^make (.+?) (\d+(?:\.\d+)?) ?m$/i, "sube $1 a $2 m"],
  [/^(⟦\d+⟧)(?:'s)?(?: antenna)?(?: height)?,? (?:at|to|=|up to|until)? ?(\d+(?:\.\d+)?) ?m(?: (?:high|tall|height))?$/i, "sube $1 a $2 m"],
  [/^(?:raise|lift|increase|bump) (.+?) (?:until|till) (\d+(?:\.\d+)?) ?m$/i, "sube $1 a $2 m"],
  [/^(⟦\d+⟧)(?:'s)? height(?: to| at| of| =)? (\d+(?:\.\d+)?) ?m$/i, "sube $1 a $2 m"],
  [/^(⟦\d+⟧) down to (\d+(?:\.\d+)?) ?m$/i, "baja $1 a $2 m"],
  [/^(⟦\d+⟧) (?:should|must|needs to|has to|will|shall|is going to|could) be (?:at )?(\d+(?:\.\d+)?) ?m(?: (?:high|tall|height))?$/i, "sube $1 a $2 m"],
  [/^(?:i want|i'd like|i would like|i need|make sure) (⟦\d+⟧) (?:is |to be |stands )?(?:at|to) (\d+(?:\.\d+)?) ?m(?: (?:high|tall|height))?$/i, "sube $1 a $2 m"],
  [/^(?:bring|take|move|put) (.+?) down to (\d+(?:\.\d+)?) ?m$/i, "baja $1 a $2 m"],
  [/^(?:set|put|change|adjust|make) (⟦\d+⟧) (?:to|at) (\d+(?:\.\d+)?) ?m(?: (?:high|tall|height))?$/i, "ajusta la altura de $1 a $2 m"],
  [/^(?:make|set) (.+?) (\d+(?:\.\d+)?) ?m (?:tall|high)$/i, "sube $1 a $2 m"],
  [/\b(?:at|to) (?:a )?(?:height of|height) (\d+(?:\.\d+)?) ?m\b/gi, "a $1 m"],
  [/\bat (?=\d+(?:\.\d+)? ?(?:m|km|millas|milla|millas náuticas|pies|yardas|cuadras)\b)/gi, "a "],
  [/\b(\d+(?:\.\d+)?) ?m (?:high|tall|height|above (?:the )?ground)\b/gi, "a $1 m"],
  [/\b(?:put|set) (.+?) (?:at|to) the (?:maximum|max|highest) height\b/gi, "pon el $1 a la altura máxima"],
  // v17.4 · «raise all the repeaters 5 m» suma 5 m a cada uno; «raise all the repeaters to 20 m» los deja a 20 m
  [/\b(raise|lift|increase|bump|lower|drop|reduce|decrease) all (?:of )?(?:the )?(repeaters|antennas|nodes|towers|people|persons) (?:by |another )?(\d+(?:\.\d+)?) ?m(?: more| higher| lower| up| down)?$/gi, (_m, v: string, g: string, h: string) => `${/^(?:lower|drop|reduce|decrease)$/i.test(v) ? "baja" : "sube"} todos los ${g} ${h} m más`],
  [/\b(?:raise|lift|increase|move up) all (?:the )?repeaters (?:to|at|up to) ?(\d+(?:\.\d+)?) ?m\b|\b(?:set|put|make) all (?:the )?repeaters (?:to |at )?(\d+(?:\.\d+)?) ?m(?: high| tall)?\b/gi, (_m, a: string, b: string) => `sube todos los repetidores a ${a ?? b} m`],
  [/\b(?:make|set) all (?:the )?antennas (?:at|to)? ?(\d+(?:\.\d+)?) ?m\b|\ball (?:the )?antennas (?:at|to) (\d+(?:\.\d+)?) ?m\b/gi, (_m, a: string, b: string) => `que todas las antenas estén a ${a ?? b} m`],
  [/\b(?:set|change|adjust) (?:the )?height of (.+?) to (\d+(?:\.\d+)?) ?m\b|\b(?:set|change|adjust) (.+?)'?s height to (\d+(?:\.\d+)?) ?m\b/gi, (_m, a: string, h: string, b: string, k: string) => `ajusta la altura de ${a ?? b} a ${h ?? k} m`],
  [/\b(?:raise|lift|increase|move up)( it| that one)? to (\d+(?:\.\d+)?) ?m\b/gi, (_m, it: string, h: string) => (it ? `súbelo a ${h} m` : `sube a ${h} m`)],
  [/\b(?:raise|lift|increase|move up) (.+?) to (\d+(?:\.\d+)?) ?m\b/gi, "sube $1 a $2 m"],
  [/\b(?:lower|drop|reduce|bring down) (.+?) to (\d+(?:\.\d+)?) ?m\b/gi, "baja $1 a $2 m"],
  // v17.4 · Alturas relativas, como «súbelo 5 m más»: «raise it 5 m», «raise Repeater 1 by 5 m», «lower it 3 m», «make it
  // 5 m taller», «add 5 m to it», «take 2 m off Repeater 1», «increase its height by 5 m», «move it up 5 m»
  [/^(increase|raise|decrease|reduce|lower) (its|it's|that one's|.+?'s) height by (\d+(?:\.\d+)?) ?m$/i, (_m, v: string, x: string, h: string) => relativa(/^(?:increase|raise)$/i.test(v) ? "sube" : "baja", /^(?:its|it's)$/i.test(x) ? "it" : x.replace(/'s$/i, ""), h)],
  [/^(increase|raise|decrease|reduce|lower) (?:the )?height of (it|that one|.+?) by (\d+(?:\.\d+)?) ?m$/i, (_m, v: string, x: string, h: string) => relativa(/^(?:increase|raise)$/i.test(v) ? "sube" : "baja", x, h)],
  [ALTURA_SUBE, (_m, x: string | undefined, h: string) => relativa("sube", x, h)],
  [ALTURA_SUBE_CON_UP, (_m, x: string | undefined, h: string) => relativa("sube", x, h)],
  [ALTURA_BAJA, (_m, x: string | undefined, h: string) => relativa("baja", x, h)],
  [ALTURA_BAJA_CON_DOWN, (_m, x: string | undefined, h: string) => relativa("baja", x, h)],
  [/^make (it|that one|.+?) (\d+(?:\.\d+)?) ?m (taller|higher|shorter|lower)$/i, (_m, x: string, h: string, d: string) => relativa(/^(?:taller|higher)$/i.test(d) ? "sube" : "baja", x, h)],
  [/^(?:add|give|put) (?:another |an extra |an additional )?(\d+(?:\.\d+)?) ?m(?: more| extra)?(?: of height| in height| height)? (?:to|on|onto) (it|that one|.+?)(?:'s height| height)?$/i, (_m, h: string, x: string) => relativa("sube", x, h)],
  [/^give (it|that one|⟦\d+⟧) (?:another |an extra |an additional )?(\d+(?:\.\d+)?) ?m(?: more| extra)?(?: of height| in height| height)?$/i, (_m, x: string, h: string) => relativa("sube", x, h)],
  [/^(?:take|cut|shave|knock) (\d+(?:\.\d+)?) ?m off (?:of )?(it|that one|.+?)$/i, (_m, h: string, x: string) => relativa("baja", x, h)],
  [/^(?:move|bring|take|put) (⟦\d+⟧|it|that one) (up|down) (?:by )?(?:another )?(\d+(?:\.\d+)?) ?m(?: more)?$/i, (_m, x: string, d: string, h: string) => relativa(d.toLowerCase() === "up" ? "sube" : "baja", x, h)],
  [/^(⟦\d+⟧|it|that one),? (?:another )?(\d+(?:\.\d+)?) ?m (higher|taller|up|lower|shorter|down)$/i, (_m, x: string, h: string, d: string) => relativa(/^(?:higher|taller|up)$/i.test(d) ? "sube" : "baja", x, h)],
  [/^(?:raise|lift) (?:it|that one)$/i, "súbelo"],
  [/^(?:lower) (?:it|that one)$/i, "bájalo"],
  [/\b(?:raise|lift) (.+?)$/gi, "sube $1"],
  [/\blower (.+?)$/gi, "baja $1"],
  // Nombres
  [/^(?:rename|change the name of) (.+?) (?:to|as) (.+)$/i, "renombra $1 como $2"],
  [/^(?:call|name) (?:the )?scenario (.+)$|^(?:rename|call) (?:the )?scenario (?:to |as )?(.+)$/i, (_m, a: string, b: string) => `llama al escenario ${a ?? b}`],
  [/^change (.+?)'?s name to (.+)$/i, "renombra $1 como $2"],
  // v17.3 · «Repeater 1 should be called Loma Alta»
  [/^(⟦\d+⟧) (?:should|will|shall|must|is going to) be (?:called|named|renamed(?: to| as)?) (.+)$/i, "renombra $1 como $2"],
  [/^(?:call|name) (.+?) (.+)$/i, "renombra $1 como $2"],
  // Antenas y roles
  [/\bpoint (.+?) (?:to(?:wards?)? (?:the )?|at (?:the )?)?(north-?east|north-?west|south-?east|south-?west|north|south|east|west)\b/gi, (_m, x: string, r: string) => `apunta ${x} al ${rumbo(r)}`],
  [/\b(?:orient|aim|rotate|turn) (.+?) (?:to|at|toward|towards) (\d+(?:\.\d+)?) ?(?:°|grados)/gi, "orienta $1 a $2 grados"],
  // v17.5 · «Point Ejemplo toward the gateway», «aim Repeater 1 at Tower 2» (hacia un nodo, no un rumbo ni grados)
  [/\b(?:point|aim) (.+?) (?:toward|towards|at|to) (?:the )?(?!(?:north|south|east|west|northeast|northwest|southeast|southwest|north-east|north-west|south-east|south-west)\b)(?!-?\d)(.+?)$/gi, "apunta $1 hacia $2"],
  [/\btilt (.+?) (\d+(?:\.\d+)?) ?(?:°|grados) (down|downward|downwards|up|upward|upwards)\b/gi, (_m, x: string, g: string, d: string) => `inclina ${x} ${g}° hacia ${/down/i.test(d) ? "abajo" : "arriba"}`],
  [/\b(?:give|put on|fit) (.+?) (?:an? )?omni(?:directional)?(?: antenna)?\b/gi, "ponle a $1 una antena omnidireccional"],
  [/\b(?:put|give|fit|add) (?:a |an )?yagi(?: antenna)? (?:on|to) (.+?) pointing (?:at|to|toward|towards) (.+?)$/gi, "ponle una antena yagi a $1 apuntando a $2"],
  [/\b(?:set|make|put|configure) (.+?) as (?:a )?(room server|companion|repeater|repetidor|client)\b/gi, (_m, x: string, r: string) => `pon ${x} como ${r.toLowerCase() === "repeater" ? "repetidor" : r.toLowerCase()}`],
  [/^make (.+?) a (repeater|room server|companion)$/i, (_m, x: string, r: string) => `pon a ${x} como ${r.toLowerCase() === "repeater" ? "repetidor" : r.toLowerCase()}`],
  // v17.3 · «set Repeater 1 to companion», «put Repeater 1 in repeater mode», «switch Person 1 to room server»: su rol
  [/^(?:set|switch|change|put|configure) (⟦\d+⟧) (?:to|in|into|as) (?:a |an |the )?(repeater|room server|companion|client)(?: mode| role)?$/i, (_m, x: string, r: string) => `pon a ${x} como ${r.toLowerCase() === "repeater" ? "repetidor" : r.toLowerCase()}`],
  [/\bmark (.+?) as (?:a |the )?gateway\b/gi, "marca $1 como pasarela"],
  // v17.3 · «make Tower 2 the gateway», «set Tower 2 as gateway», «turn Tower 2 into a gateway», «Tower 2 is the gateway»
  [/^(?:make|designate) (.+?) (?:the|a|our|my) gateway$|^(?:set|use|designate|define|choose|pick) (.+?) as (?:the |a |our |my )?gateway$|^(?:turn|convert|change|make) (.+?) (?:into|to) (?:the |a |an )?gateway$|^(⟦\d+⟧) (?:is|will be|should be|becomes|shall be) (?:now )?(?:the|our|my) gateway$/i, (_m, a: string, b: string, c: string, d: string) => `marca ${a ?? b ?? c ?? d} como pasarela`],
  // v17.3 · «turn Person 1 into a repeater», «convert Person 1 to a repeater», «Person 1 as a repeater», «make Person 1 repeat»
  [/^(?:turn|convert|change|switch|make) (.+?) (?:into|to) (?:a |an |the )?(repeater|room server|companion|client)$/i, (_m, x: string, r: string) => `pon a ${x} como ${r.toLowerCase() === "repeater" ? "repetidor" : r.toLowerCase()}`],
  [/^(⟦\d+⟧) (?:should|must|needs to|has to|will|shall|is going to) be (?:a |an |the )?(repeater|room server|companion|client)$/i, (_m, x: string, r: string) => `pon a ${x} como ${r.toLowerCase() === "repeater" ? "repetidor" : r.toLowerCase()}`],
  [/^(⟦\d+⟧) as (?:a |an |the )?(repeater|room server|companion|client)$/i, (_m, x: string, r: string) => `pon a ${x} como ${r.toLowerCase() === "repeater" ? "repetidor" : r.toLowerCase()}`],
  [/^(?:make|let|have) (⟦\d+⟧) (?:repeat|relay|retransmit)$/i, "pon a $1 como repetidor"],
  [/^(.+?) (?:should not|must not|does not|shall not|won't|will not) (?:retransmit|repeat|relay)$|^(?:stop|keep) (.+?) from (?:retransmitting|repeating|relaying)$|^do not let (.+?) (?:retransmit|repeat|relay)$|^(?:make|have|let) (.+?) stop (?:retransmitting|repeating|relaying)$/i, (_m, a: string, b: string, c: string, d: string) => `que ${a ?? b ?? c ?? d} no retransmita`],
  [/\buse (?:the )?(xiao|t1000|t-1000|sensecap) (?:wallet|card|tracker)? ?(?:on|in|for) (.+?)$/gi, (_m, e: string, x: string) => `usa en ${x} la ${/t-?1000/i.test(e) ? "tarjeta T1000" : `billetera ${e.toLowerCase()}`}`],
  [/\bconnect (?:the )?(?:missing|remaining|disconnected) ones\b|\bconnect (?:the )?(?:missing|remaining|disconnected) (?:nodes|people)\b/gi, "conecta a los que faltan"],
  [/\bconnect (?:everyone|everybody|the rest|all of them|those (?:who are )?missing|the ones (?:that are |who are )?missing|the people (?:that are |who are )?missing)\b/gi, "conecta a los que faltan"],
  [/\b(?:suggest|recommend|propose|give)(?: me)?(?: some)? (?:support|backup) antennas?\b/gi, "sugiéreme antenas de apoyo"],
  [/^where (?:should|do|can|could) (?:i|we) (?:put|place|add|install) (?:the |some |my )?(?:backup|support|extra) (?:antennas?|gateways?)\??$/i, "sugiéreme antenas de apoyo"],
  [/^(?:which|what) (?:backup|support|extra) (?:antennas?|gateways?) (?:do|would|can|could) you (?:suggest|recommend|propose|advise)\??$/i, "sugiéreme antenas de apoyo"],
  [/\bconnect (.+?)$/gi, "conecta a $1"],
  // v17.3 · Agregar dicho de otras formas: «I need a repeater…», «stick/throw in a repeater…», «a repeater 2 km north of…»
  [/^(?:i (?:need|want|would like)|we (?:need|want)|give me|get me|i'd like|(?:could|can|may) (?:i|we) (?:get|have|add)) (?=(?:a|an|one|another|a new|\d+) (?:new )?(?:repeater|person|node|antenna|tower|user|antenna node)s?\b)/i, "add "],
  [/^(?:i (?:need|want|would like)|we (?:need|want)|i'd like) (?=(?:the|our|my) gateway\b)/i, "put "],
  [/\b(?:stick|throw in|throw|pop|slap|drop in|plop|chuck|toss|squeeze in|fit)\b(?= (?:a|an|one|another|a new|\d+) (?:new )?(?:repeater|person|node|antenna|tower|user|antenna node)s?\b)/gi, "add"],
  [/^(?:a |an |one |new |another )(?:new )?(repeater|person|antenna node|antenna|tower|node|user)\b(?=.*(?:\b(?:of|from|near|at|in|on|north|south|east|west)\b|⟨))/i, "add a $1"],
  [new RegExp(String.raw`^(repeater|person|antenna|tower|node) (?=${NUM} ?(?:${DISTANCIA}) )`, "i"), "add a $1 "],
  [/^(repeater|person|antenna|tower|node) (?=(?:at|in|on|near) )/i, "add a $1 "],
  // v17.3 · Conectar, el mensaje y escoger un nodo con otras palabras
  [/^(?:hook up|hook|link up) (.+?)(?: up)?(?: to the (?:network|mesh))?$|^get (.+?) connected(?: to the (?:network|mesh))?$|^give (.+?) (?:coverage|signal|service|a signal|connection)$|^(?:bring|get|put) (.+?) online$|^make sure (.+?) (?:has|gets) (?:coverage|signal|service)$/i, (_m, a: string, b: string, c: string, d: string, e: string) => {
    const x = a ?? b ?? c ?? d ?? e;
    return /^(?:everyone|everybody|all|all of them|the rest|all the people|all the users|the missing ones|the people who are missing)$/i.test(x) ? "conecta a los que faltan" : `conecta a ${x}`;
  }],
  [/^(?:have|let|make) (.+?) send (?:a |an )?(?:test )?message$|^(?:a |an )?(?:test )?message from (.+?)$|^(⟦\d+⟧) sends? (?:a |an )?(?:test )?message$/i, (_m, a: string, b: string, c: string) => `envía un mensaje desde ${a ?? b ?? c}`],
  [/^(?:pick|choose|click on|click|highlight|focus on|tap on|tap) (⟦\d+⟧|the gateway)$/i, "selecciona $1"],
  // v17.3 · Sacar un nodo de la simulación y volverlo a meter: «deactivate Repeater 1», «turn Repeater 1 off», «disable
  // it», «take Repeater 1 out of the simulation», «enable Repeater 1 again», «put Repeater 1 back in the simulation»
  [/\b(?:remove|take|leave|keep|exclude) (⟦\d+⟧) (?:out of|from) the (?:simulation|calculation|analysis)\b/gi, "desactiva $1"],
  [/\b(?:deactivate|disable|switch off|turn off|shut off|shut down|power off|power down|exclude|leave out) (⟦\d+⟧)(?: (?:from|of|in) the (?:simulation|calculation|analysis|network|mesh))?/gi, "desactiva $1"],
  [/\b(?:turn|switch|shut|power) (⟦\d+⟧) (?:off|down)\b(?: (?:from|of|in) the (?:simulation|calculation|analysis|network|mesh))?/gi, "desactiva $1"],
  [/\b(?:put|bring|add) (⟦\d+⟧) back (?:in(?:to)?|on) the (?:simulation|calculation|analysis|network|mesh)\b/gi, "activa $1"],
  [/\b(?:activate|enable|reactivate|re-enable|switch on|turn on|power on|power up|include) (⟦\d+⟧)(?: (?:again|back))?(?: in(?:to)? the (?:simulation|calculation|analysis|network|mesh))?(?: again)?/gi, "activa $1"],
  [/\b(?:turn|switch|power) (⟦\d+⟧) (?:back )?on\b(?: again)?/gi, "activa $1"],
  // Nodos: poner, mover, quitar, duplicar, seleccionar («copy that» es «entendido», no duplicar)
  [/\b(?:duplicate|copy|clone) (?!that\s*$)(.+?)$|\bmake a copy of (.+?)$/gi, (_m, a: string, b: string) => `duplica ${a ?? b}`],
  [/\bselect (.+?)$/gi, "selecciona $1"],
  // v17.3 · «take Repeater 2 out», «Repeater 2 has to go», «kill/trash/ditch Repeater 2», «drop Repeater 2» (un nodo del mapa)
  [/^take (.+?) (?:out|away|off(?: the map)?)$/i, "elimina $1"],
  [/^(⟦\d+⟧) (?:has to|must|needs to|should|can) go$/i, "elimina $1"],
  [/^(?:drop|lose|ditch|scrap|nuke|trash|kill|axe|bin|zap|wipe out|dump) (⟦\d+⟧)$/i, "elimina $1"],
  [/\b(?:delete|remove|erase|take out|get rid of|take away) (.+?)$/gi, "elimina $1"],
  // v17.3 · Mover con otros verbos y el rumbo antes de la distancia: «shift Repeater 1 2 km north», «move Repeater 1 north 2 km»
  [new RegExp(String.raw`\b(?:move|shift|push|relocate|nudge|slide|drag|send|bring|take|displace) (.+?) ${NUM} ?(${DISTANCIA}) (?:to the |towards? the )?${RUMBO}\b`, "gi"), (_m, x: string, d: string, u: string, r: string) => `mueve ${x} ${d} ${u} al ${rumbo(r)}`],
  [new RegExp(String.raw`\b(?:move|shift|push|relocate|nudge|slide|drag|send|bring|take|displace) (.+?) (?:to the |towards? the )?${RUMBO} (?:by )?${NUM} ?(${DISTANCIA})\b`, "gi"), (_m, x: string, r: string, d: string, u: string) => `mueve ${x} ${d} ${u} al ${rumbo(r)}`],
  [new RegExp(String.raw`^(⟦\d+⟧),? ${NUM} ?(${DISTANCIA}) (?:to the |towards? the )?${RUMBO}$`, "i"), (_m, x: string, d: string, u: string, r: string) => `mueve ${x} ${d} ${u} al ${rumbo(r)}`],
  // v17.3 · El rumbo sin distancia: «move Repeater 1 north» (el intérprete pregunta cuánto, como con «mueve Repetidor 1 al norte»)
  [new RegExp(String.raw`\b(?:move|shift|push|relocate|nudge|slide|drag|displace) (.+?) (?:a (?:bit|little|tad) |slightly )?(?:to the |towards? the )?${RUMBO}$`, "gi"), (_m, x: string, r: string) => `mueve ${x} al ${rumbo(r)}`],
  // «Repeater 1 to 4.25, -73.40», «put Repeater 1 at 4.25, -73.40», «relocate Repeater 1 to Cumaral»: el nodo del mapa se mueve
  // (v17.3: «set Repeater 1 to companion», «put Repeater 1 in repeater mode», «… to 22 dBm», «… to SF10» no son lugares)
  [/^(⟦\d+⟧) (?:to|over to|at) (⟨\d+⟩)$/i, "mueve $1 a $2"],
  [
    /^(?:put|place|set|send|relocate|bring|take|shift|position|locate) (⟦\d+⟧) (?:at|to|in|on|over to|over at|into) (?!-?\d)(?!(?:(?:a|an|the)\s+)?(?:repeaters?|room servers?|companions?|clients?|routers?|omni\w*|yagi|directional|standby|off|on|max\w*|min\w*|full|half|low|high|medium|default|auto\w*|fac\w+|point\w*|simulation|calculation|sf\s*\d+)\b)(?!.*\b(?:mode|role|power|dbm|dbi|mhz|degrees|grados|spreading factor|height|altitude|level|preset|setting|settings)\b)(.+)$/i,
    "mueve $1 a $2",
  ],
  [/\b(?:move|relocate|shift|transfer|displace) (.+?) (?:to|over to|into) (.+?)$/gi, "mueve $1 a $2"],
  [/\bmove\b/gi, "mueve"],
  // «N km north of X», «N km to the south», «N km from X to the east»
  [new RegExp(String.raw`\b${NUM} ?(${DISTANCIA}) (?:to the )?${RUMBO} of\b`, "gi"), (_m, d: string, u: string, r: string) => `a ${d} ${u} al ${rumbo(r)} de`],
  [new RegExp(String.raw`\b${NUM} ?(${DISTANCIA}) from (.+?) (?:to the |towards? the |heading )?${RUMBO}\b`, "gi"), (_m, d: string, u: string, x: string, r: string) => `a ${d} ${u} de ${x} hacia el ${rumbo(r)}`],
  [new RegExp(String.raw`\b${NUM} ?(${DISTANCIA}) (?:to the )?${RUMBO}\b`, "gi"), (_m, d: string, u: string, r: string) => `a ${d} ${u} al ${rumbo(r)}`],
  [new RegExp(String.raw`\b(?:to the |towards? the )${RUMBO}\b`, "gi"), (_m, r: string) => `hacia el ${rumbo(r)}`],
  // v17.3 · «a repeater north of the gateway» (sin distancia), como «un repetidor al norte del gateway»
  [new RegExp(String.raw`(?<!\bthe )\b${RUMBO} of\b`, "gi"), (_m, r: string) => `al ${rumbo(r)} de`],
  // v17.3 · El gateway con otras palabras: «set the gateway in Cumaral», «gateway in Cumaral», «the gateway goes in Cumaral»
  [/^(?:set|place|locate|situate|position|install|plant|stick|drop) (?:the |our |my )?gateway (?:in|at|on|near) (.+)$/i, "pon el gateway en $1"],
  [/^(?:the |our |my )?gateway (?:in|at) (.+)$|^(?:the |our |my )?gateway (?:goes|should go|will go|must go|has to go|needs to go|belongs) (?:in|at|to|on) (.+)$/i, (_m, a: string, b: string) => `pon el gateway en ${a ?? b}`],
  // Llevar el mapa
  [/^(?:take me to|go to|fly to|fly me to|navigate to|head to|move the map to|pan to|zoom (?:in )?(?:to|on|into)|zoom into|center (?:the map )?(?:on|in|at)|centre (?:the map )?(?:on|in|at)|focus on|show me|find me|find|locate|where is|let us go to|bring me to) (.+?)\??$/i, "llévame a $1"],
  // «take me Villavicencio» (sin el «to»)
  [/^take me (?!to\b|on\b|through\b|around\b|back\b|home\b)(.+?)\??$/i, "llévame a $1"],
  // Simular (v17.3: «run a simulation», «start/kick off/redo the simulation», «update the coverage», «simulation»)
  [/^(?:simulate|run (?:the )?simulation|run it|calculate (?:the )?coverage|compute (?:the )?coverage|recalculate|simulate (?:it|again|the network|now))$/i, "simula"],
  [/^(?:(?:run|start|kick off|fire off|fire up|trigger|launch|execute|perform|do|redo|rerun|re-run|refresh|update|recalculate|recompute|make)(?: a| the| another| one more| a new| the whole)? (?:simulation|sim|coverage simulation)(?: again| now| once more)?|(?:update|refresh|recalculate|recompute|calculate|compute|run|simulate|redo) (?:the )?coverage(?: again)?|simulation|(?:the )?simulation please|sim(?: it)?|go simulate|simulate (?:it )?(?:again|once more|one more time)|run it again|simulate everything|simulate the whole (?:network|mesh|thing))$/i, "simula"],
  [/\bsimulate\b/gi, "simula"],
  // Verbos de poner
  [/\b(?:put|place|drop|plant|set up)( me)?\b/gi, (_m, me: string) => (me ? "ponme" : "pon")],
  [/\b(?:add|insert|install|create|register)( me)?\b/gi, (_m, me: string) => (me ? "agrégame" : "agrega")],
  [/\bcover\b/gi, "cubre"],
  [/\bseed (\d+ )?repeaters (?:toward|towards|to) (.+?)$/gi, (_m, n: string, x: string) => `siembra ${n ?? ""}repetidores hacia ${x}`],
  [/\b(?:show|display)( me)?\b/gi, (_m, me: string) => (me ? "muéstrame" : "muestra")],
  [/\b(?:open)\b/gi, "abre"],
  [/\b(?:hide|close)\b/gi, "oculta"],
  [/\buse\b/gi, "usa"],
  [/\b(?:remove|delete)\b/gi, "quita"],
];

// 4. Palabras sueltas que quedan
const PALABRAS: Regla[] = [
  ...TIPO,
  [/\brivers?\b|\bstreams?\b/gi, "ríos"],
  [/\broads?\b|\bhighways?\b|\btracks?\b/gi, "vías"],
  [/\b(?:place )?names\b|\blabels\b/gi, "nombres"],
  [/\blinks\b/gi, "enlaces"],
  [/\b(?:study )?circles\b/gi, "círculos"],
  [/\b3d terrain\b|\bterrain in 3d\b|\b3d\b/gi, "relieve en 3d"],
  [/\b(?:areas?|zones?) (?:with )?no service\b|\bno[- ]service (?:areas?|zones?)\b/gi, "zonas sin servicio"],
  [/\b(?:distance )?rings\b/gi, "anillos"],
  [/\bbeams\b/gi, "haces"],
  [/\b(?:borders|boundaries|municipal limits)\b/gi, "límites"],
  [/\brange\b/gi, "alcance"],
  [/\b(?:called|named)\b/gi, "llamado"],
  [/\b(?:each|every)\b/gi, "cada"],
  [/\ball\b/gi, "todos"],
  [/\bthe gateway\b/gi, "el gateway"],
  [/\bhow is\b/gi, "cómo está"],
  [/\b(?:where are we|where am i)\b/gi, "dónde estamos"],
  [/\bcoverage\b/gi, "cobertura"],
  [/\bsignal\b/gi, "señal"],
  [/\bheight\b/gi, "altura"],
  [/\bbudget\b/gi, "presupuesto"],
  [/\bmillion\b|\bmillions\b/gi, "millones"],
  [/\bbillion\b/gi, "mil millones"],
  [/\bthousand\b/gi, "mil"],
  [/\bpesos\b/gi, "pesos"],
  [/\bpayments\b/gi, "pagos"],
  [/\bpayment\b/gi, "pago"],
  [/\bmessages\b/gi, "mensajes"],
  [/\bmessage\b/gi, "mensaje"],
  [/\bzone\b/gi, "zona"],
  [/\barea\b/gi, "área"],
  [/\bmap\b/gi, "mapa"],
  [/\bresults\b/gi, "resultados"],
  [/\bscenario\b/gi, "escenario"],
  [/\bexample\b/gi, "ejemplo"],
  [/\b(?:with|using)\b/gi, "con"],
  [/\bwithout\b/gi, "sin"],
  [/\bfor\b/gi, "para"],
  [/\bfrom\b/gi, "de"],
  [/\b(?:at|in|on|inside)\b/gi, "en"],
  [/\bto\b/gi, "a"],
  [/\bof\b/gi, "de"],
  [/\band\b/gi, "y"],
  [/\bor\b/gi, "o"],
  [/\b(?:a|an|one)\b(?=\s+(?:repetidor|gateway|nodo|nodo antena|nodo portátil|usuario|mensaje|pago|círculo|cuadrado|radio|presupuesto))/gi, "un"],
  [/\b(?:a|an|one)\b(?=\s+(?:persona|antena|torre|red|malla|casa|billetera|zona|familia))/gi, "una"],
  [/\bthe\b(?=\s+(?:repetidores|nodos|usuarios|mensajes|pagos|gateways|resultados|ríos|nombres|enlaces|círculos|anillos|haces|límites))/gi, "los"],
  [/\bthe\b(?=\s+(?:personas|antenas|torres|familias|billeteras|zonas|vías))/gi, "las"],
  [/\bthe\b(?=\s+(?:alcance|relieve))/gi, "el"],
  [/\bthe\b(?=\s+(?:red|malla|zona|antena|persona|torre|cobertura|señal|altura|simulación|regla|vista|hora|carga|área))/gi, "la"],
  [/\bthe\b/gi, "el"],
  [/\b(?:it|that)\b$/gi, ""],
];

/**
 * v17.3 · Una altura en pies («raise Repeater 1 to 80 feet», «make it 30 ft tall») pasa a metros (24,4 m); las distancias
 * en pies («500 feet north») siguen en pies, que el intérprete ya entiende.
 */
function alturasEnPies(t: string): string {
  if (!/\b(?:raise|lift|lower|increase|decrease|reduce|bump|drop|bring|height|tall|high|mast|set|make|put)\b/i.test(t) || /\b(?:north|south|east|west|from|of|away|around|radius)\b/i.test(t)) return t;
  return t.replace(/\b(\d+(?:\.\d+)?) ?pies\b(?= (?:tall|high|height|above)\b|\s*$)/gi, (_m, n: string) => `${Math.round(Number(n) * 0.3048 * 10) / 10} m`);
}

/**
 * v17.3 · Las preguntas más comunes, por sus palabras y en cualquier orden (así las hace también quien habla inglés con la
 * forma del español: «how much costs the network?», «how many repeaters there are?», «the network is optimal?»).
 */
function preguntaPorPalabras(t: string, esPregunta: boolean): string | null {
  const x = ` ${t.toLowerCase()} `;
  const pregunta = esPregunta || /^ (?:how|what|which|is|are|do|does|did|can|could|should|would|will|the|my|this) /.test(x);
  if (!pregunta) return null;
  const red = /\b(?:network|mesh|it|this|design)\b/.test(x);
  if (/\bhow much\b/.test(x) && /\b(?:cost|costs|price|priced|money|investment)\b/.test(x) && /\b(?:network|mesh)\b/.test(x) && !/\b(?:per|each|every|repeaters?|nodes?|antennas?|gateways?|cover|country|colombia|in|for|month|monthly|year)\b/.test(x))
    return "¿cuánto cuesta la red?";
  // «How many repeaters are there?»: los que hay. Con algo más («… are out of range», «… does Repeater 1 serve», «… should
  // I add», «… are in Cumaral») es otra pregunta, y la contestan las demás reglas o el Modelo Melki (v17.3)
  const cuantos = x.match(/\bhow many (repeaters|people|persons|users|gateways|nodes|antennas|towers)\b/);
  const otraCosa =
    /\b(?:need|needs|needed|required|require|requires|necessary|handle|hold|support|take|can|could|cover|covers|covered|uncovered|coverage|missing|without|with|signal|fail|failing|failed|more|less|fewer|per|each|every|out|offline|online|connected|disconnected|unconnected|range|reach|reached|reachable|unreachable|serve|serves|served|serving|should|must|add|added|adding|left|remaining|red|yellow|green|orange|working|active|inactive|move|moved|moving|does|did|will|would|by|where|which|lost|dead|down|up|problems?)\b|[⟦⟨]|\b(?:in|at|near|around|within|inside|from) (?!(?:the |my |our |this )?(?:map|network|mesh|scenario|design|total)\b)/;
  if (cuantos && !otraCosa.test(x)) {
    const es = { repeaters: "cuántos repetidores", people: "cuántas personas", persons: "cuántas personas", users: "cuántas personas", gateways: "cuántos gateways", nodes: "cuántos nodos", antennas: "cuántas antenas", towers: "cuántas torres" }[cuantos[1]];
    return `¿${es} hay?`;
  }
  // «Is the network optimal?»; «the optimal height for this repeater», «the optimal number of…» son otra pregunta (v17.3)
  if (
    /\b(?:optimal|optimum|optimi[sz]ed|well designed|well-designed|efficient)\b/.test(x) &&
    red &&
    !/\b(?:make|apply|optimi[sz]e|adjust|for the load|cost|height|altitude|position|location|spot|place|placement|frequency|sf|spreading|power|antennas?|repeaters?|gateways?|nodes?|towers?|route|path|number|amount|count|settings?|preset)\b|[⟦⟨]/.test(x)
  )
    return "¿la red es óptima?";
  // «Are there too many repeaters?»; «do I need an extra repeater?», «how much does a spare one cost?» piden lo contrario (v17.3)
  if (
    /\b(?:too many|redundant|unnecessary|extra|spare|surplus|left over|more than (?:i|we) need|not needed)\b/.test(x) &&
    /\b(?:repeaters?|antennas?|nodes?|towers?)\b/.test(x) &&
    !/\b(?:add|put|place|need|needs|buy|purchase|order|cost|costs|price|get|install|another|additional|more|should|must)\b|\b(?:an|a|one) (?:extra|spare)\b/.test(x)
  )
    return "¿sobran antenas?";
  return null;
}

function aplicar(t: string, reglas: Regla[]): string {
  let s = t;
  for (const [re, por] of reglas) {
    re.lastIndex = 0;
    const antes = s;
    s = typeof por === "string" ? s.replace(re, por) : s.replace(re, por as (...m: string[]) => string);
    if (s !== antes) s = s.replace(/\s{2,}/g, " ").trim();
  }
  return s;
}

/** ¿Es una frase entera de las que se traducen tal cual (sí, no, repite, más despacio…)? */
function entera(t: string): string | null {
  const limpio = t.replace(/[.!?¡¿]+$/g, "").trim();
  for (const [re, por] of ENTEROS) {
    re.lastIndex = 0;
    if (re.test(limpio)) return typeof por === "string" ? (por.includes("$") ? limpio.replace(re, por) : por) : limpio.replace(re, por as (...m: string[]) => string);
  }
  return null;
}

/**
 * Lo que se pidió en inglés, dicho en las palabras del español que entiende el intérprete de Melki. Si el texto ya
 * venía en español, sale casi igual (las reglas buscan palabras del inglés).
 */
/* ───────────── v17.3 · El español con palabras del inglés ───────────── */

/** Palabras del inglés que se cuelan en una orden en español («pon un repeater…», «haz el stress test»). */
const MEZCLA: [RegExp, string][] = [
  [/\b(?:el|un) stress[- ]test\b/gi, "la prueba de estrés"],
  [/\bstress[- ]test\b/gi, "prueba de estrés"],
  [/\b(?:el|un) load[- ]test\b/gi, "la prueba de carga"],
  [/\bload[- ]test\b/gi, "prueba de carga"],
  [/\b(?:el )?link budget\b/gi, "informe del enlace"],
  [/\b(?:el )?hop limit\b/gi, "el límite de saltos"],
  [/\brepeaters\b/gi, "repetidores"],
  [/\brepeater\b/gi, "repetidor"],
  [/\bnodes\b/gi, "nodos"],
  [/\bnode\b/gi, "nodo"],
  [/\b(?:people|persons)\b/gi, "personas"],
  [/\bperson\b/gi, "persona"],
  [/\busers\b/gi, "usuarios"],
  [/\buser\b/gi, "usuario"],
  [/\btowers\b/gi, "torres"],
  [/\btower\b/gi, "torre"],
  [/\bantennas\b/gi, "antenas"],
  [/\bantenna\b/gi, "antena"],
  [/\bnetwork\b/gi, "red"],
  [/\bcoverage\b/gi, "cobertura"],
  [/\bsignal\b/gi, "señal"],
  [/\bheight\b/gi, "altura"],
  [/\broads\b/gi, "vías"],
  [/\bresults\b/gi, "resultados"],
  [/\bhops\b/gi, "saltos"],
  [/\bsatellite\b/gi, "satelital"],
  // «… de 4 km in Villavicencio»: «in» o «at» antes de un nombre propio
  [/\b(?:in|at) (?=[A-ZÁÉÍÓÚÑ])/g, "en "],
];

/**
 * v17.3 · Las órdenes con «usted» («simule», «ponga el gateway en…», «súbalo a 20 m»), con el verbo del «tú» que entiende
 * el intérprete («simula», «pon el gateway en…», «súbelo a 20 m»). Solo la primera palabra de la orden.
 */
const USTED: Record<string, string> = {
  simule: "simula", simulelo: "simúlalo", use: "usa", ponga: "pon", pongale: "ponle", pongalo: "ponlo", pongala: "ponla", pongame: "ponme",
  mueva: "mueve", muevalo: "muévelo", muevala: "muévela", suba: "sube", subalo: "súbelo", subala: "súbela", baje: "baja", bajelo: "bájalo",
  bajela: "bájala", muestre: "muestra", muestreme: "muéstrame", oculte: "oculta", quite: "quita", quitelo: "quítalo", quitele: "quítale",
  elimine: "elimina", eliminelo: "elimínalo", borre: "borra", borrelo: "bórralo", cambie: "cambia", cambiele: "cámbiale", haga: "haz",
  hagame: "hazme", hagalo: "hazlo", disene: "diseña", diseneme: "diséñame", arme: "arma", armeme: "ármame", exporte: "exporta",
  descargue: "descarga", guarde: "guarda", cargue: "carga", seleccione: "selecciona", conecte: "conecta", duplique: "duplica",
  aplique: "aplica", apliquela: "aplícala", renombre: "renombra", active: "activa", desactive: "desactiva", apague: "apaga",
  encienda: "enciende", prenda: "prende", mande: "manda", envie: "envía", siembre: "siembra", pueble: "puebla", reparta: "reparte",
  dibuje: "dibuja", suelte: "suelta", marque: "marca", apunte: "apunta", oriente: "orienta", incline: "inclina", llame: "llama",
  sugiera: "sugiere", sugierame: "sugiéreme", recomiende: "recomienda", recomiendeme: "recomiéndame", ubique: "ubica", ubiqueme: "ubícame",
  busque: "busca", encuentre: "encuentra", acerque: "acerca", aleje: "aleja", hable: "habla", hableme: "háblame", repita: "repite",
  mida: "mide", cubra: "cubre", calcule: "calcula", optimice: "optimiza", pruebe: "prueba", abra: "abre", cierre: "cierra",
  deshaga: "deshaz", explique: "explica", expliqueme: "explícame", digame: "dime", deme: "dame", enseneme: "enséñame", lleve: "lleva",
  lleveme: "llévame", ajuste: "ajusta", ajustelo: "ajústalo", ajustemelo: "ajústamelo", ajustela: "ajústala", anada: "añade",
  agregue: "agrega", agreguele: "agrégale", inscriba: "inscribe",
  // v17.4 · También los que se oyen mucho por voz
  deje: "deja", dejelo: "déjalo", anime: "anima", pone: "pon", ponele: "ponle", ensene: "enseña", vuelva: "vuelve", empiece: "empieza",
  cubrame: "cúbreme", calculeme: "calcúlame", pase: "pasa", inscribalo: "inscríbelo",
};
const sinTildes = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function conElTu(t: string): string {
  return t.replace(/^(\s*(?:(?:melki|por favor|porfa|oiga|oye|señor|señora|bueno|listo|ok)[,\s]+)*)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/i, (m, antes: string, v: string) => {
    const tu = USTED[sinTildes(v)];
    if (!tu) return m;
    return antes + (/^[A-ZÁÉÍÓÚÑ]/.test(v) ? tu.charAt(0).toUpperCase() + tu.slice(1) : tu);
  });
}

/**
 * v17.3 · Una orden en español con palabras del inglés, dicha con las del español que entiende el intérprete («pon un
 * repeater cerca del gateway» → «pon un repetidor cerca del gateway»), y los nombres de los nodos a la forma del mapa
 * («sube el Repetidor 1» cuando el mapa tiene «Repeater 1», creado con la pantalla en inglés, y al revés). Lo que no trae
 * nada de eso sale igual.
 */
export function espanolDeMezcla(texto: string, contexto: ContextoTraduccion = {}): string {
  // v17.4 · Lo que el reconocimiento oye mal y es seguro de corregir («gueiguey» → «gateway», «kilo metros»)
  const entrada = texto.normalize("NFC").replace(/[’‘]/g, "'");
  const limpio = corregirOido(entrada, "es", contexto.nombres ?? []);
  const p = proteger(limpio, contexto.nombres ?? []);
  // Un nombre nuevo dicho en español («renombra el Repetidor 1 como North Tower», «llama al escenario Coverage Test», «un
  // repetidor llamado Repeater Hill en…») queda como se dijo: sus palabras no se traducen
  const guardar = (_m: string, a: string, nombre: string, cola = "") => {
    p.piezas.push(nombre);
    return `${a}⟦${p.piezas.length - 1}⟧${cola}`;
  };
  const NOMBRE = String.raw`(?!⟦)([^,.;⟦⟧«»"“”]{2,40}?)`;
  const COLA = String.raw`((?:[\s,]+(?:por favor|porfa|porfavor|gracias|muchas gracias))*[\s.!?]*)`;
  let t = p.texto
    .replace(new RegExp(String.raw`(\b(?:renombr\w*|ren[oó]mbr\w*|c[aá]mbi\w* (?:el )?nombre(?: de)?|ll[aá]mal[ao])\b.*?\s(?:a|por|como)\s+)${NOMBRE}${COLA}$`, "i"), guardar)
    .replace(new RegExp(String.raw`(\bll[aá]ma(?:le)?\s+(?:al|el)\s+escenario\s+(?:como\s+)?)${NOMBRE}${COLA}$`, "i"), guardar)
    .replace(/(\b(?:llamad[oa]|de nombre|con (?:el )?nombre(?: de)?|que se llame)\s+)(?!⟦)(.+?)(?=\s+(?:en|a|con|de|ubicad[oa]|que|y|para|sobre|cerca)\b|[,.;]|$)/i, (m, a: string, nombre: string) => guardar(m, a, nombre));
  t = conElTu(t);
  for (const [re, por] of MEZCLA) {
    re.lastIndex = 0;
    t = t.replace(re, por);
  }
  const r = restaurar(t, p.piezas);
  // Si nada cambió (salvo los espacios), queda tal cual se escribió
  return r.replace(/\s+/g, " ").trim() === entrada.replace(/\s+/g, " ").trim() ? texto : r;
}

/**
 * v17.3 · El inglés de todos los días, a la forma que conocen las reglas: «someone» es una persona, «a relay» un repetidor,
 * «repeater number 2» es «repeater 2», «latitude 4.25 longitude -73.4» una coordenada y «3 mi» son millas.
 */
function normalizarIngles(t: string): string {
  return t
    // «4 point 25», «minus 73 point 4» dictados con cifras
    .replace(/(\d)\s+point\s+(\d)/gi, "$1.$2")
    .replace(/\b(?:someone|somebody)\b/gi, "a person")
    .replace(/\b(a|an|the|one|another|new|\d+) relays\b/gi, "$1 repeaters")
    .replace(/\b(a|an|the|one|another|new) relay\b/gi, "$1 repeater")
    .replace(/\b(repeater|repetidor|person|persona|antenna|antena|tower|torre|support|node) (?:number|num\.?|no\.?|#) ?(\d{1,3})\b/gi, "$1 $2")
    .replace(/\blat(?:itude)?\.?\s*:?\s*(-?\d{1,2}(?:\.\d+)?)\s*,?\s*(?:and\s+)?(?:lon|long|lng|longitude)\.?\s*:?\s*(-?\d{1,3}(?:\.\d+)?)/gi, "$1, $2")
    .replace(/\b(\d+(?:\.\d+)?) ?mi\b(?!\w)/gi, "$1 miles")
    // «a 2-mile mesh», «a 10-km radius»
    .replace(/\b(\d+(?:\.\d+)?)-(km|kms|kilomet(?:er|re)s?|miles?|met(?:er|re)s?|m|feet|foot|ft|yards?|hectares?|ha|acres?)\b/gi, "$1 $2")
    // «s f 9» con el número ya en cifras («use s f nine»)
    .replace(/\b(?:s\s+f|ess\s+eff|es\s+ef|s-f)\s*(\d{1,2})\b/gi, "SF$1")
    .replace(/\bsf\s+(\d{1,2})\b/gi, "SF$1")
    // El inglés con la forma del español: «2 km at north of the gateway», «two kilometers to north» → «2 km north…»
    // (solo antes de «of», de un número o al final: «rename Repeater 1 to North Tower» es un nombre)
    // (v17.3: no en un nombre nuevo: «rename Repeater 1 to North», «call the gateway East»)
    .replace(
      /\b(?:at|to|in|towards?|for) (?:the )?(north|south|east|west|northeast|northwest|southeast|southwest|north-east|north-west|south-east|south-west)\b(?= of\b|\s*$|\s*[,;.]|\s+(?:by\s+)?-?\d)/gi,
      (m: string, r: string, donde: number, todo: string) => (/\b(?:rename|renamed|change the name of|name|call|called|named)\b/i.test(todo.slice(0, donde)) ? m : r),
    )
    // «charge the example» (cargar): cargar el ejemplo o un archivo
    .replace(/\bcharge (?=(?:the |an? )?(?:example|sample|demo|scenario|file)\b)/gi, "load ")
    // «delete every node» es borrarlos todos (pero «fill each repeater…» sigue siendo cada uno)
    .replace(/\b(delete|remove|erase|clear|wipe out) (?:every|each) (node|repeater|antenna|tower|gateway)\b/gi, "$1 all the $2s")
    .replace(/\b(delete|remove|erase|clear|wipe out) (?:every|each) person\b/gi, "$1 all the people");
}

export function traducirPedido(texto: string, contexto: ContextoTraduccion = {}): string {
  let t = texto.normalize("NFC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  // Lo que ya viene en español (una orden de la IA, un botón, alguien que escribe en español) pasa tal cual
  if (detectarIdioma(t).idioma === "es") return t;
  // v17.3 · Lo que el reconocimiento de voz o el tecleo escriben mal («repeat her», «gate way», «simualte», «netwrok»)
  t = corregirIngles(t, contexto.nombres ?? []);
  for (const [re, por] of CONTRACCIONES) t = t.replace(re, por);
  t = numerosEnPalabrasEn(t);
  // v17.4 · Lo que el reconocimiento oye mal con acento y es seguro de corregir («to kilometers» → «2 kilometers», «2 km
  // nort» → «north», «a reporter» → «a repeater», «the get away» → «the gateway», «move Person to…» → «Person 2»)
  t = corregirOido(t, "en", contexto.nombres ?? []);
  t = cifras(t);
  t = normalizarIngles(t);
  // v17.3 · «What happens if I move it 2 km east?», «what if I add a repeater…?», «would it help to raise it?»: es una
  // pregunta, no la orden (en español, «¿qué pasa si lo muevo…?» tampoco la hace); la contestan el cerebro o el Modelo Melki
  if (/^\s*(?:(?:hey|hi|ok(?:ay)?|so|and|melki)\b[\s,]*)*(?:what (?:happens|would happen|will happen|could happen)|what if|would it (?:help|be better|work|improve)|will it (?:help|be better)|is it (?:better|worth(?: it)?) (?:if|to))\b/i.test(t)) return texto.trim();
  // «Can you optimize the network?», «would you add…?»: es un pedido (no una pregunta del intérprete)
  const pregunta = /\?\s*$/.test(t) && !/^\s*(?:(?:hey|hi|hello|ok(?:ay)?|so|melki)\b[\s,]*)*(?:can|could|would|will) you\b/i.test(t);
  const p = proteger(t, contexto.nombres ?? []);
  t = p.texto;
  t = aplicar(t, CORTESIA).replace(/\s{2,}/g, " ").trim();
  // «the Repeater 1», «the Person 2»: el nombre del nodo va sin artículo
  t = t.replace(/\bthe (⟦\d+⟧)/gi, "$1");
  // v17.3 · Sin los signos del final, las reglas de frase entera también valen para «…?» y «…!»
  t = t.replace(/\s*[?!.]+\s*$/, "");
  // v17.4 · «Why doesn't Person 1 have signal?», «what does LoRa mean?», «how much does it cost?»
  for (const [re, por] of SIN_SENAL_EN) if (re.test(t)) return restaurar(t.replace(re, por as string), p.piezas);
  const pp = preguntaPorPalabras(t, pregunta);
  if (pp) return restaurar(pp, p.piezas);
  const e = entera(t);
  if (e) return restaurar(e, p.piezas);
  // v17.3 · «move it 2 km east», «delete that one», «rename the last one…»: el nodo dicho sin su nombre
  const falsos = new Set<number>();
  t = pronombres(t, p.piezas, falsos);
  t = aplicar(t, LONGITUD);
  t = alturasEnPies(t);
  t = aplicar(t, FRASES);
  t = aplicar(t, PALABRAS);
  t = t.replace(/MEDIDA_RADIO/g, "a la redonda");
  t = arreglarFalsos(t, falsos);
  // Contracciones y artículos del español
  t = t
    .replace(/\bde el\b/g, "del")
    .replace(/\ba el\b/g, "al")
    .replace(/\bde de\b/g, "de")
    .replace(/\ben en\b/g, "en")
    .replace(/\ba la redonda de de\b/g, "a la redonda de")
    .replace(/\ba a\b/g, "a")
    .replace(/\b(millones|mil millones|millón) pesos\b/g, "$1 de pesos")
    .replace(/\ben a (?=\d)/g, "a ")
    .replace(/\s+([,.;:?!])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  t = restaurar(t, p.piezas);
  // Las preguntas del intérprete empiezan con «¿»; un pedido («can you…?») queda sin signos
  if (pregunta && t && !t.startsWith("¿")) t = `¿${t.replace(/\?*$/, "")}?`;
  else if (!pregunta) t = t.replace(/\s*\?+\s*$/, "");
  // Si solo había cortesía («Hello Melki», «Thanks!»), queda lo dicho: lo contesta el cerebro
  return t || texto.trim();
}
