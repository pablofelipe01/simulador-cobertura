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
  t = t.replace(/\d{1,3}\s*°\s*\d{1,2}\s*['′]\s*(?:\d{1,2}(?:\.\d+)?\s*["″]?)?\s*[NSEWO]\b/gi, (m) => guardar(m.replace(/W$/i, "O")));
  // Lo que va entre comillas (un nombre nuevo): queda con comillas «…» para el intérprete
  t = t.replace(/["“«']([^"”»']{2,60})["”»']/g, (_m, x: string) => guardar(`«${x.trim()}»`));
  // Coordenadas (decimales con o sin signo): «4.25, -73.30», «4.5123 -73.1234»
  t = t.replace(/-?\d{1,2}\.\d+\s*,?\s+-?\d{1,3}\.\d+/g, (m) => guardar(m));
  // Los nombres de los nodos del mapa, del más largo al más corto
  // «Gateway» a secas no se protege: las reglas lo manejan («the gateway» → «el gateway») y el intérprete lo reconoce
  const lista = [...new Set(nombres.filter((x) => x && x.trim().length >= 2 && !/^gateway$/i.test(x.trim())))].sort((a, b) => b.length - a.length);
  for (const nombre of lista) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${ESCAPAR(nombre)})(?=$|[^\\p{L}\\p{N}])`, "giu");
    t = t.replace(re, (_m, antes: string) => `${antes}${guardar(nombre)}`);
  }
  // Los nombres por defecto que no están en el mapa: en inglés o en español, a la forma del mapa (o la española)
  const existe = (n: string) => lista.find((x) => x.toLowerCase() === n.toLowerCase());
  const cantidad = String.raw`(?!\s*(?:[.,]\d|%|km|kms|m\b|mts?|meters?|metres?|kilomet|mi\b|miles?|millas?|ft\b|feet|foot|yards?|blocks?|ha\b|hectares?|acres?|people|persons|users|families|payments|messages|db|dbm|dbi|degrees?|°))`;
  const referencia = new RegExp(String.raw`\b(repeater|repetidor|person|persona|support|apoyo|antenna|antena|tower|torre)\s+(\d{1,3})\b${cantidad}`, "gi");
  t = t.replace(referencia, (_m, tipo: string, num: string) => {
    const k = tipo.toLowerCase();
    const es = { repeater: "Repetidor", repetidor: "Repetidor", person: "Persona", persona: "Persona", support: "Apoyo", apoyo: "Apoyo", antenna: "Antena", antena: "Antena", tower: "Torre", torre: "Torre" }[k] ?? tipo;
    const en = { repeater: "Repeater", repetidor: "Repeater", person: "Person", persona: "Person", support: "Support", apoyo: "Support", antenna: "Antenna", antena: "Antenna", tower: "Tower", torre: "Tower" }[k] ?? tipo;
    const real = existe(`${en} ${num}`) ?? existe(`${es} ${num}`);
    return guardar(real ?? `${es} ${num}`);
  });
  // Un nombre nuevo, dicho sin comillas: «rename Repeater 1 to North Tower», «call the scenario Finca La Esperanza»,
  // «an antenna node called North Tower at …»
  t = t.replace(/^((?:rename|change the name of)\s+.+?\s+(?:to|as)\s+)(?!⟦)(.+?)\s*$/i, (_m, a: string, nombre: string) => `${a}${guardar(nombre.replace(/[.!?]+$/, ""))}`);
  t = t.replace(/^((?:call|name|rename)\s+(?:the\s+)?scenario\s+(?:to\s+|as\s+)?)(?!⟦)(.+?)\s*$/i, (_m, a: string, nombre: string) => `${a}${guardar(nombre.replace(/[.!?]+$/, ""))}`);
  t = t.replace(/\b((?:called|named)\s+)(?!⟦)(.+?)(?=\s+(?:at|in|on|near|with|to|by)\b|[,;]|$)/i, (_m, a: string, nombre: string) => `${a}${guardar(nombre)}`);
  return { texto: t, piezas };
}

const restaurar = (t: string, piezas: string[]) => t.replace(/⟦(\d+)⟧/g, (_m, k: string) => piezas[Number(k)] ?? "");

/* ───────────── Palabras ───────────── */

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
// Unidades de longitud del inglés → las del intérprete
const LONGITUD: [RegExp, string][] = [
  [/\bnautical miles?\b/gi, "millas náuticas"],
  [/\b(kilomet(?:er|re)s?|kms?)\b/gi, "km"],
  [/\bsquare miles?\b/gi, "millas cuadradas"],
  [/\bsquare (?:kilomet(?:er|re)s?|kms?)\b|\bsq\.? ?km\b/gi, "km²"],
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

/* ───────────── Las reglas ───────────── */

type Regla = [RegExp, string | ((...m: string[]) => string)];

// 1. Muletillas y cortesía (se quitan)
const CORTESIA: Regla[] = [
  [/^\s*(?:(?:hey|hi|hello|ok(?:ay)?|so|well|alright|right|now|um+|uh+|er+|erm|please|melki)\b[\s,]*)+/i, ""],
  [/[\s,]*\b(?:melki|please|thanks|thank you)\s*[.!?]*\s*$/i, ""],
  [/\b(?:please|kindly|if you can|if you could|if possible|for me)\b/gi, ""],
  [/^\s*(?:can|could|would|will) you(?: please)?\s+/i, ""],
  [/^\s*(?:i (?:want|need|would like) you to|i want to|i would like to|i need to|let us|go ahead and|try to|help me)\s+/i, ""],
  [/^\s*(?:i (?:want|need|would like)|give me|get me)\s+(?=(?:a|an)\s+(?:new\s+)?(?:\w+\s+)?(?:network|mesh)\b)/i, "build "],
];

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
  [/^(?:the )?ruler$/i, "regla"],
  [/^(?:the )?(?:mesh )?(?:pencil|brush)$/i, "lápiz"],
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
  [/^(?:clean|clear) (?:the |up the )?screen$|^(?:hide|close) (?:all |both |the )?(?:panels|sidebars)$|^(?:just|only) the map$|^full ?screen(?: map)?$|^map only$/i, "pantalla limpia"],
  [/^(?:show|open|bring back) (?:all |both |the )?(?:panels|sidebars)$/i, "muestra los paneles"],
  [/^(?:show|open|display|bring back) (?:me )?(?:the )?(?:top bar|top toolbar|toolbar|tool bar|menu bar|top menu)$/i, "muestra la barra de arriba"],
  [/^(?:hide|close) (?:the )?(?:top bar|top toolbar|toolbar|tool bar|menu bar|top menu)$/i, "oculta la barra de arriba"],
  [/^(?:show|open|display) (?:me )?(?:the )?results panel$|^open (?:the )?results$/i, "abre el panel de resultados"],
  [/^(?:hide|close) (?:the )?results(?: panel)?$/i, "oculta el panel de resultados"],
  [/^(?:show|open|display) (?:me )?(?:the )?(?:tools(?: panel)?|left panel|side panel|tool panel)$/i, "abre el panel de herramientas"],
  [/^(?:hide|close) (?:the )?(?:tools(?: panel)?|left panel|side panel|tool panel)$/i, "oculta el panel de herramientas"],
  [/^(?:show|give|tell)(?: me)? (?:the )?results$|^results$|^(?:let me see|see|view|check) (?:the )?results$/i, "muéstrame los resultados"],
  // Modo
  [/^(?:switch|go|change) (?:to )?(?:the )?advanced mode$|^advanced mode$/i, "pasa al modo avanzado"],
  [/^(?:switch|go|change) (?:to )?(?:the )?(?:seed(?:ing)?|simple) mode$|^seed (?:the )?mesh again$|^(?:back to )?seed the mesh$/i, "vuelve a sembrar la malla"],
  // Empezar de cero y ejemplos
  [/^(?:start (?:over|again|from scratch)|clear everything|delete everything|reset everything|new scenario|start fresh|wipe everything)$/i, "empieza de cero"],
  [/^load (?:the )?mesh example$|^load (?:the )?example (?:of the )?mesh$/i, "carga el ejemplo de malla"],
  [/^load (?:the )?example$/i, "carga el ejemplo"],
];

// 3. Frases del dominio (se aplican en orden, sobre todo el texto)
const FRASES: Regla[] = [
  [/\b(?:move|take|shift|relocate) the (?:whole )?(?:network|mesh) to\b/gi, "lleva la red a"],
  // Conectores de varias órdenes
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
  // «… and see if it holds»
  [/\b(?:and )?(?:see|check|test|verify) (?:if|whether) (?:it|the network|the mesh) (?:holds(?: up)?|can handle it|handles it|survives|withstands it)\b/gi, "y mira si aguanta"],
  // Exportar
  [/\b(?:export|download|save|generate)\b(?: the| a| an)?(?: coverage)?(?: as| to| in)?(?: a| an)? (?:kmz|kml|google earth(?: file)?)\b(?: file)?/gi, "exporta el KMZ"],
  [/\b(?:export|download|save|generate)\b(?: the| a)?(?: nodes)?(?: as| to| in)?(?: a| an)? (?:csv|excel)\b(?: file)?/gi, "exporta el CSV"],
  [/\b(?:export|download|save)\b(?: the| this)? (?:scenario|json)\b(?: (?:as|to) json)?(?: file)?/gi, "guarda el escenario"],
  [/\b(?:export|download|save|generate)\b(?: it| the network| the map| the report| the coverage)?(?: as| to| in)? (?:a |an )?(pdf|word|docx|image|png|jpg|photo|screenshot|powerpoint|presentation)\b/gi, (_m, f: string) => `exporta un ${f.toLowerCase().replace("image", "imagen").replace("photo", "foto").replace("screenshot", "pantallazo").replace("presentation", "presentacion")}`],
  // Informe del enlace y distancia
  [/\b(?:radio )?link (?:budget )?report (?:between|for|of) (.+?) (?:and|to) (.+?)$/i, (_m, a: string, b: string) => `informe del enlace ${a} y ${b}`],
  [/\b(?:(?:measure|calculate|tell me|what is|what's) )?(?:the )?distance between (.+?) and (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  [/^how far is (.+?) from (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  [/^(?:show (?:me )?)?(?:the )?(?:terrain |elevation )?profile (?:from|between) (.+?) (?:to|and) (.+?)$/i, (_m, a: string, b: string) => `perfil de ${a} a ${b}`],
  [/^(?:measure|calculate|tell me|what is|what's) (?:the )?distance from (.+?) to (.+?)\??$/i, (_m, a: string, b: string) => `distancia entre ${a} y ${b}`],
  // Mapa y capas
  [/\b(?:show|display|turn on|enable) (?:me )?(?:the )?roads\b/gi, "muestra las vías"],
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
  [/\b(?:show|fit|zoom to|frame|see) (?:me )?(?:the )?(?:whole|entire|full) (?:network|mesh)\b|\bfit (?:the )?(?:map|view) to (?:the )?(?:network|mesh)\b|\bzoom to fit\b/gi, "muéstrame toda la red"],
  [/\b(?:turn on|activate|enable|open) (?:the )?ruler\b|\bmeasure with the ruler\b/gi, "activa la regla"],
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
  [/\bis (?:the|my|this) (?:network|mesh) (?:optimal|optimized|optimised|well sized|right-sized)\b/gi, "la red es óptima"],
  [/\bis (?:the|my|this) (?:network|mesh) (?:oversized|over-dimensioned|overbuilt)\b/gi, "la red está sobredimensionada"],
  [/\bis (?:the|my|this) (?:network|mesh) (?:undersized|under-dimensioned)\b/gi, "la red está subdimensionada"],
  [/\b(?:can|could) (?:i|we) (?:remove|take out|drop|get rid of|cut) (?:some |any )?(?:of (?:the|my|these|those) )?(?:antennas|repeaters|nodes|towers)\b/gi, "puedo quitar antenas"],
  [/\bwith fewer (?:antennas|repeaters|towers)\b/gi, "con menos antenas"],
  [/\b(?:turn on|activate|enable) (?:the )?(?:automatic simulation|simulate on change|auto[- ]?simulat(?:e|ion))\b|^(?:simulate on change|auto[- ]?simulate)$/gi, "activa la simulación automática"],
  [/\b(?:turn off|deactivate|disable|stop) (?:the )?(?:automatic simulation|simulate on change|auto[- ]?simulat(?:e|ion))\b/gi, "apaga simular al cambiar"],
  [/\b(?:use|with) (?:the )?real terrain\b|\buse (?:the )?real elevation\b/gi, "usa el relieve real"],
  [/\b(?:simulate )?with flat terrain\b|\b(?:use )?flat terrain\b/gi, "simula con terreno plano"],
  // Parámetros
  [/\b(?:set|put|change) (?:the )?hop limit (?:of|for) (.+?) to (\d+)\b/gi, "pon el límite de saltos del $1 en $2"],
  [/\b(?:set|put|change) (?:the )?hop limit to (\d+)\b|\bhop limit (?:of|to) (\d+)\b/gi, (_m, a: string, b: string) => `pon el límite de saltos en ${a ?? b}`],
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
  [/\b(?:run|do|make) (?:a |the )?stress test\b|\bstress test\b/gi, "haz la prueba de estrés"],
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
  [/^(?:make|set) (.+?) (\d+(?:\.\d+)?) ?m (?:tall|high)$/i, "sube $1 a $2 m"],
  [/\b(?:at|to) (?:a )?(?:height of|height) (\d+(?:\.\d+)?) ?m\b/gi, "a $1 m"],
  [/\bat (?=\d+(?:\.\d+)? ?(?:m|km|millas|milla|millas náuticas|pies|yardas|cuadras)\b)/gi, "a "],
  [/\b(\d+(?:\.\d+)?) ?m (?:high|tall|height|above (?:the )?ground)\b/gi, "a $1 m"],
  [/\b(?:put|set) (.+?) (?:at|to) the (?:maximum|max|highest) height\b/gi, "pon el $1 a la altura máxima"],
  [/\b(?:raise|lift|increase|set|put|make|move up) all (?:the )?repeaters (?:to|at)? ?(\d+(?:\.\d+)?) ?m\b|\b(?:set|make) all (?:the )?repeaters (\d+(?:\.\d+)?) ?m(?: high| tall)?\b/gi, (_m, a: string, b: string) => `sube todos los repetidores a ${a ?? b} m`],
  [/\b(?:make|set) all (?:the )?antennas (?:at|to)? ?(\d+(?:\.\d+)?) ?m\b|\ball (?:the )?antennas (?:at|to) (\d+(?:\.\d+)?) ?m\b/gi, (_m, a: string, b: string) => `que todas las antenas estén a ${a ?? b} m`],
  [/\b(?:set|change|adjust) (?:the )?height of (.+?) to (\d+(?:\.\d+)?) ?m\b|\b(?:set|change|adjust) (.+?)'?s height to (\d+(?:\.\d+)?) ?m\b/gi, (_m, a: string, h: string, b: string, k: string) => `ajusta la altura de ${a ?? b} a ${h ?? k} m`],
  [/\b(?:raise|lift|increase|move up)( it| that one)? to (\d+(?:\.\d+)?) ?m\b/gi, (_m, it: string, h: string) => (it ? `súbelo a ${h} m` : `sube a ${h} m`)],
  [/\b(?:raise|lift|increase|move up) (.+?) to (\d+(?:\.\d+)?) ?m\b/gi, "sube $1 a $2 m"],
  [/\b(?:lower|drop|reduce|bring down) (.+?) to (\d+(?:\.\d+)?) ?m\b/gi, "baja $1 a $2 m"],
  [/^(?:raise|lift) (?:it|that one)$/i, "súbelo"],
  [/^(?:lower) (?:it|that one)$/i, "bájalo"],
  [/\b(?:raise|lift) (.+?)$/gi, "sube $1"],
  [/\blower (.+?)$/gi, "baja $1"],
  // Nombres
  [/^(?:rename|change the name of) (.+?) (?:to|as) (.+)$/i, "renombra $1 como $2"],
  [/^(?:call|name) (?:the )?scenario (.+)$|^(?:rename|call) (?:the )?scenario (?:to |as )?(.+)$/i, (_m, a: string, b: string) => `llama al escenario ${a ?? b}`],
  [/^change (.+?)'?s name to (.+)$/i, "renombra $1 como $2"],
  [/^(?:call|name) (.+?) (.+)$/i, "renombra $1 como $2"],
  // Antenas y roles
  [/\bpoint (.+?) (?:to(?:wards?)? (?:the )?|at (?:the )?)?(north-?east|north-?west|south-?east|south-?west|north|south|east|west)\b/gi, (_m, x: string, r: string) => `apunta ${x} al ${rumbo(r)}`],
  [/\b(?:orient|aim|rotate|turn) (.+?) (?:to|at|toward|towards) (\d+(?:\.\d+)?) ?(?:°|grados)/gi, "orienta $1 a $2 grados"],
  [/\btilt (.+?) (\d+(?:\.\d+)?) ?(?:°|grados) (down|downward|downwards|up|upward|upwards)\b/gi, (_m, x: string, g: string, d: string) => `inclina ${x} ${g}° hacia ${/down/i.test(d) ? "abajo" : "arriba"}`],
  [/\b(?:give|put on|fit) (.+?) (?:an? )?omni(?:directional)?(?: antenna)?\b/gi, "ponle a $1 una antena omnidireccional"],
  [/\b(?:put|give|fit|add) (?:a |an )?yagi(?: antenna)? (?:on|to) (.+?) pointing (?:at|to|toward|towards) (.+?)$/gi, "ponle una antena yagi a $1 apuntando a $2"],
  [/\b(?:set|make|put|configure) (.+?) as (?:a )?(room server|companion|repeater|repetidor|client)\b/gi, (_m, x: string, r: string) => `pon ${x} como ${r.toLowerCase() === "repeater" ? "repetidor" : r.toLowerCase()}`],
  [/^make (.+?) a (repeater|room server|companion)$/i, (_m, x: string, r: string) => `pon a ${x} como ${r.toLowerCase() === "repeater" ? "repetidor" : r.toLowerCase()}`],
  [/\bmark (.+?) as (?:a |the )?gateway\b/gi, "marca $1 como pasarela"],
  [/^(.+?) (?:should not|must not|does not|shall not|won't|will not) (?:retransmit|repeat|relay)$|^(?:stop|keep) (.+?) from (?:retransmitting|repeating|relaying)$|^do not let (.+?) (?:retransmit|repeat|relay)$|^(?:make|have|let) (.+?) stop (?:retransmitting|repeating|relaying)$/i, (_m, a: string, b: string, c: string, d: string) => `que ${a ?? b ?? c ?? d} no retransmita`],
  [/\buse (?:the )?(xiao|t1000|t-1000|sensecap) (?:wallet|card|tracker)? ?(?:on|in|for) (.+?)$/gi, (_m, e: string, x: string) => `usa en ${x} la ${/t-?1000/i.test(e) ? "tarjeta T1000" : `billetera ${e.toLowerCase()}`}`],
  [/\bconnect (?:the )?(?:missing|remaining|disconnected) ones\b|\bconnect (?:the )?(?:missing|remaining|disconnected) (?:nodes|people)\b/gi, "conecta a los que faltan"],
  [/\bconnect (?:everyone|everybody|the rest|all of them|those (?:who are )?missing|the ones (?:that are |who are )?missing|the people (?:that are |who are )?missing)\b/gi, "conecta a los que faltan"],
  [/\b(?:suggest|recommend|propose|give)(?: me)?(?: some)? (?:support|backup) antennas?\b/gi, "sugiéreme antenas de apoyo"],
  [/\bconnect (.+?)$/gi, "conecta a $1"],
  // Nodos: poner, mover, quitar, duplicar, seleccionar
  [/\b(?:duplicate|copy|clone) (.+?)$/gi, "duplica $1"],
  [/\bselect (.+?)$/gi, "selecciona $1"],
  [/\b(?:delete|remove|erase|take out|get rid of) (.+?)$/gi, "elimina $1"],
  [new RegExp(String.raw`\bmove (.+?) ${NUM} ?(${DISTANCIA}) (?:to the )?${RUMBO}\b`, "gi"), (_m, x: string, d: string, u: string, r: string) => `mueve ${x} ${d} ${u} al ${rumbo(r)}`],
  [/\bmove (.+?) (?:to|over to) (.+?)$/gi, "mueve $1 a $2"],
  [/\bmove\b/gi, "mueve"],
  // «N km north of X», «N km to the south», «N km from X to the east»
  [new RegExp(String.raw`\b${NUM} ?(${DISTANCIA}) (?:to the )?${RUMBO} of\b`, "gi"), (_m, d: string, u: string, r: string) => `a ${d} ${u} al ${rumbo(r)} de`],
  [new RegExp(String.raw`\b${NUM} ?(${DISTANCIA}) from (.+?) (?:to the |towards? the |heading )?${RUMBO}\b`, "gi"), (_m, d: string, u: string, x: string, r: string) => `a ${d} ${u} de ${x} hacia el ${rumbo(r)}`],
  [new RegExp(String.raw`\b${NUM} ?(${DISTANCIA}) (?:to the )?${RUMBO}\b`, "gi"), (_m, d: string, u: string, r: string) => `a ${d} ${u} al ${rumbo(r)}`],
  [new RegExp(String.raw`\b(?:to the |towards? the )${RUMBO}\b`, "gi"), (_m, r: string) => `hacia el ${rumbo(r)}`],
  // Llevar el mapa
  [/^(?:take me to|go to|fly to|navigate to|zoom (?:in )?(?:to|on)|center (?:the map )?on|centre (?:the map )?on|show me|find|locate|where is) (.+?)\??$/i, "llévame a $1"],
  // Simular
  [/^(?:simulate|run (?:the )?simulation|run it|calculate (?:the )?coverage|compute (?:the )?coverage|recalculate|simulate (?:it|again|the network|now))$/i, "simula"],
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
export function traducirPedido(texto: string, contexto: ContextoTraduccion = {}): string {
  let t = texto.normalize("NFC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  // Lo que ya viene en español (una orden de la IA, un botón, alguien que escribe en español) pasa tal cual
  if (detectarIdioma(t).idioma === "es") return t;
  for (const [re, por] of CONTRACCIONES) t = t.replace(re, por);
  t = numerosEnPalabrasEn(t);
  t = cifras(t);
  const pregunta = /\?\s*$/.test(t);
  const p = proteger(t, contexto.nombres ?? []);
  t = p.texto;
  t = aplicar(t, CORTESIA).replace(/\s{2,}/g, " ").trim();
  const e = entera(t);
  if (e) return restaurar(e, p.piezas);
  t = aplicar(t, LONGITUD);
  t = aplicar(t, FRASES);
  t = aplicar(t, PALABRAS);
  t = t.replace(/MEDIDA_RADIO/g, "a la redonda");
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
  // Las preguntas del intérprete empiezan con «¿»
  if (pregunta && t && !t.startsWith("¿")) t = `¿${t.replace(/\?*$/, "")}?`;
  // Si solo había cortesía («Hello Melki», «Thanks!»), queda lo dicho: lo contesta el cerebro
  return t || texto.trim();
}
