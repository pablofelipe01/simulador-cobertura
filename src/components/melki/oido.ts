// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// v17.4 · Lo que se oyó mal. Con una pronunciación floja o con acento (el inglés dicho por quien habla español, sobre
// todo), el reconocimiento de voz no escribe palabras raras sino otras palabras que existen: «repeat her» por
// «repeater», «get away» por «gateway», «Person to» por «Person 2», «two kilometers not of the gateway» por «… north of
// the gateway», «at a repeater» por «add a repeater»; en español, «sube lo» por «súbelo», «modo antena» por «nodo
// antena», «por un repetidor» por «pon un repetidor». Aquí salen las versiones de lo dicho con esas palabras cambiadas
// (de la más probable a la menos): Melki las prueba solo cuando no entendió lo dicho tal cual, y se queda con la que
// entiende como una orden o una pregunta del simulador.

import { claveFonetica, distanciaFonetica } from "@/lib/geo/fonetica";
import { PALABRAS_EN, PALABRAS_ES, PARES_EN, PARES_ES } from "./vocabulario-oido";

export type LenguaOido = "es" | "en";

/**
 * Lo dicho con algunas palabras cambiadas, lo que costó (más cambios o más raros, más caro) y qué se cambió. `generica`:
 * algo se cambió sin una regla (por parecido o una palabra corta); `porParecido`: lo cambiado por cómo suena, con lo que
 * se dijo y lo que se puso («feel» → «fill», «celular» → «simular»).
 */
export type Variante = { texto: string; costo: number; cambios: string[]; generica?: boolean; porParecido?: [string, string][] };

/**
 * Una regla de lo oído. Las seguras se aplican siempre (nadie dice «two kilometers not of the gateway» ni «a reporter
 * 3 km south» queriendo decir eso en el simulador); las dudosas, solo como variantes cuando lo dicho no se entendió.
 */
type Regla = { re: RegExp; por: string | ((...m: string[]) => string); costo: number; segura: boolean; corta?: boolean };
const regla = (re: RegExp, por: Regla["por"], costo = 1): Regla => ({ re, por, costo, segura: false });
const segura = (re: RegExp, por: Regla["por"], costo = 0.5): Regla => ({ re, por, costo, segura: true });

/* ───────────── Inglés ───────────── */

/** Lo que va antes de la orden y no cuenta («hey», «okay so», «please», «can you», «Melki»). */
const INICIO_EN = String.raw`^((?:(?:hey|hi|ok|okay|so|now|and|then|please|melki|can you|could you|would you|will you|i want you to|i need you to|go ahead and)[\s,]+)*)`;
/** Lo que sigue a un verbo que pone o mueve algo: un artículo, un número o la pieza. */
const OBJETO_EN = String.raw`(?=\s+(?:a|an|another|one|two|three|four|five|six|seven|eight|nine|ten|\d+|the|some|more|new|it|that|this|repeat\w*|reporter\w*|person|people|node\w*|note\w*|antenna\w*|tower\w*|gateway\w*|get)\b)`;
/**
 * Cuando «to» o «for» después de una pieza es la preposición y no el número: le sigue otra palabra que no es lo que va
 * después del nombre de un nodo (el final, una cifra, un rumbo, una medida, «by», «close to…», un artículo, otro «to»):
 * «move person to Cumaral». Al renombrar sí es el número («call Repeater too Cerro Azul»).
 */
const DESPUES_DE_NOMBRE_NO = String.raw`(?<!\b(?:call|name|rename|label)\b.*)(?!\s*(?:$|[.,;:!?)]|-?\d|(?:north|south|east|west|northeast|northwest|southeast|southwest|norte|sur|este|oeste|oriente|occidente|km|kms|kilomet\w*|meters?|metres?|m|ft|feet|miles?|metros?|by|up|down|higher|lower|'s|close|closer|near|nearer|next|beside|toward|towards|at|in|on|onto|into|from|over|under|above|below|and|or|is|was|has|its|handle|hold|holds|support|serve|cover|covers|reach|reaches|connect|see|hear|signal|coverage|height|antenna|the|a|an|their|this|that|my|our|your|to|too)\b|(?:to|too|two)\s+-?\d))\s+\S`;
/** Lo que va antes de una pieza en una orden: el verbo, con su artículo o su número («add a…», «move the…», «delete 2…»). */
const ANTES_DE_PIEZA_EN = String.raw`(?<=\b(?:add|put|place|move|delete|remove|erase|raise|lower|select|rename|connect|duplicate|copy|drop|insert|install|mount|point|tilt|turn|hide|show)\s+(?:(?:a|an|the|another|one|two|three|four|five|new|\d+)\s+)?)`;
/** Sin otro verbo en la frase: «so the coverage is bad» es charla, «so the coverage» es «show the coverage». */
const SIN_VERBO_EN = String.raw`(?!.*\b(?:is|are|was|were|isn't|aren't|wasn't|weren't|has|have|had|hasn't|haven't|looks?|seems?|sounds?|feels?|works?|worked|doesn't|don't|didn't|won't|can't|will|would|should|could|might|must|gets?|got|goes|went|keeps?|stays?|needs?|i'm|it's|that's|there's)\b)`;

/** Números dichos que se oyen como otras palabras («to» por «two», «for» por «four», «tree» por «three»). */
const NUMERO_EN: Record<string, string> = {
  won: "1",
  wan: "1",
  to: "2",
  too: "2",
  tu: "2",
  tree: "3",
  free: "3",
  sri: "3",
  tri: "3",
  for: "4",
  fore: "4",
  fife: "5",
  faiv: "5",
  sex: "6",
  seeks: "6",
  sicks: "6",
  sick: "6",
  seben: "7",
  ate: "8",
  eat: "8",
  ait: "8",
  nein: "9",
  nain: "9",
  then: "10",
  tin: "10",
};
const NUMEROS_OIDOS_EN = Object.keys(NUMERO_EN).join("|");
const UNIDAD_EN = String.raw`(?:km|kms|kilomet(?:er|re)s?|meters?|metres?|m|miles?|feet|foot|ft|blocks?|yards?)`;
/**
 * Rumbos oídos como otras palabras (sin la «h» o la «t» del final, con la «v» por la «w»…): los que no son nada más
 * después de una distancia, y los que también son palabras de una frase («2 km is that ok», «2 km not more», «2 km nor 3»,
 * «north is…»), que solo se cambian seguros antes de «of» o «from».
 */
const RUMBO_EN: [string, string, string][] = [
  [String.raw`nor\s*east|north\s+yeast|north\s+east|norties`, String.raw`north\s+is`, "northeast"],
  [String.raw`nor\s*west|north\s+vest|north\s+guest|north\s+west|north\s+best`, "", "northwest"],
  [String.raw`south\s+yeast|sauce\s+east|south\s+east|sout\s+east`, String.raw`south\s+is`, "southeast"],
  [String.raw`south\s+vest|south\s+guest|sauce\s+west|south\s+west|sout\s+west`, "", "southwest"],
  [String.raw`nort|norte|nord|noth|knot|naught|norths?|north's`, String.raw`not|nor`, "north"],
  [String.raw`sout|sauce|souse|sour|soul|sow|soth|souths?|south's|salt|mouth`, "", "south"],
  [String.raw`ease|yeast|eest|ist|eas|east's|iced|east`, String.raw`is|its|eats`, "east"],
  [String.raw`wes|vest|guest|waste|whist|wist|quest|west's|wets|west`, String.raw`best`, "west"],
];
const DISTANCIA_EN = String.raw`(\b(?:\d+(?:\.\d+)?|a|one|half a|a half)\s*${UNIDAD_EN}\s+(?:to the\s+|due\s+|towards?(?: the)?\s+|in the\s+|more\s+)?)`;

const REGLAS_EN: Regla[] = [
  // Las piezas del simulador
  segura(/\b(?:repeat\s+hers|repeat\s+ers|rip\s+eaters|re\s+peters|repeaters')\b/gi, "repeaters", 0.6),
  segura(/\b(?:repeat\s+err|rip\s+eater|re\s+peter|rapid\s+her|rip\s+it\s+her|rip\s+ether|repeater's)\b/gi, "repeater", 0.6),
  // «reporter» y «repeat her» existen («the reporter said…», «repeat her name»): seguras solo después del verbo de una
  // orden o antes del número del nodo; si no, dudosas
  segura(new RegExp(String.raw`${ANTES_DE_PIEZA_EN}reporters\b|\breporters(?=\s+\d)`, "gi"), "repeaters", 0.6),
  segura(new RegExp(String.raw`${ANTES_DE_PIEZA_EN}(?:reporter|repeat\s+her)\b|\b(?:reporter|repeat\s+her)(?=\s+\d)`, "gi"), "repeater", 0.6),
  regla(/\breporters\b/gi, "repeaters", 0.7),
  regla(/\b(?:reporter|repeat\s+her)\b/gi, "repeater", 0.7),
  regla(/\b(?:repeat\s+or|repeat\s+a|repeat\s+there|repetir|repetidor)\b/gi, "repeater", 0.8),
  segura(/\b(?:gay\s+ways|kate\s+ways|gate\s+aways)\b/gi, "gateways", 0.6),
  regla(/\b(?:get\s+aways|getaways)\b/gi, "gateways", 0.7),
  segura(/\b(?:gay\s+way|kate\s+way|gate\s+away|gate\s+wait|gate\s+weigh|gait\s+way|gate\s+way|gateway's)\b/gi, "gateway", 0.6),
  // «a getaway» (un paseo) y «a great way» existen: seguras solo con el verbo de una orden o un lugar antes («2 km north of
  // the get away»); si no, dudosas (abajo)
  segura(/(?<=\b(?:of the|to the|from the|near the|next to the|around the|toward the|towards the|new|(?:into|onto|in to|on to|as)\s+(?:a|an|the)|(?:add|put|place|move|delete|remove|select|connect|raise|lower|rename)\s+(?:a|an|the|another|new))\s+)(?:get\s+away|getaway|get\s+way|guide\s+way)\b|\bguide\s+way\b/gi, "gateway", 0.6),
  regla(/\b(?:get\s+away|getaway|get\s+way|great\s+way)\b/gi, "gateway", 0.7),
  segura(/\b(?:and\s+tenna|an\s+tena|anthena|antenna's|and\s+tanna)\b/gi, "antenna", 0.6),
  regla(/\b(?:antonia|antonio|antena)\b/gi, "antenna", 0.8),
  segura(/\b(?:parson|pearson|per\s+son|purse\s+on)\b(?=\s+(?:\d|to\b|too\b|won\b|one\b|two\b|for\b|tree\b|free\b|juan\b))/gi, "person", 0.5),
  regla(/\bprison\b(?=\s+\d)/gi, "person", 0.8),
  regla(/\b(?:parson|pearson|per\s+son)\b/gi, "person", 0.9),
  regla(/\b(?:pupils?|peoples|pebbles?|pipol|pipel|people's)\b/gi, "people", 0.8),
  regla(/(?<=\b(?:a|an|the|this|that|each|every|one|new|another|field|antenna|which)\s+)(?:note|nod|know)\b/gi, "node", 0.8),
  regla(/\b(?:note|nod|know)(?=\s+\d)/gi, "node", 0.7),
  regla(/\bnotes\b(?=\s|$)/gi, "nodes", 1.1),
  segura(/\b(?:net\s+work|neck\s+work|net\s+walk|nat\s+work|net\s+word)\b/gi, "network", 0.6),
  regla(/\b(?:mash|mess|match|mush)\b(?=\s+(?:network|net|core|map|nodes?))/gi, "mesh", 0.7),
  segura(/\b(?:cover\s+age|cover\s+edge|cover\s+rich|cover\s+itch|coverage's)\b/gi, "coverage", 0.6),
  regla(/\b(?:cover\s+each|carbage)\b/gi, "coverage", 0.8),
  regla(/(?<=\b(?:the|its|it's|his|a|antenna|tower|repeater|gateway|node|person)\s+)(?:hide|hight|hate|high|eight|heights|hi)\b/gi, "height", 0.8),
  regla(/\b(?:stimulation|emulation)\b/gi, "simulation", 0.7),
  regla(/\b(?:liars|players|lawyers|layer's)\b/gi, "layers", 1),
  regla(/(?<=\b(?:the|show|hide|no|without)\s+)(?:rhodes|rose|rows|roots|road's)\b/gi, "roads", 0.9),
  regla(/\b(?:municipal\s+it|municipal\s+at|municipal\s+tea|municipality's)\b/gi, "municipality", 0.8),
  regla(/(?<=\b(?:the|an|load|show|open)\s+)(?:sample|exam\s+pull|egg\s+sample)\b/gi, "example", 1.1),
  segura(/\b(?:mel\s+key|mel\s+kee|malky|mel\s+ki|mel\s+quee)\b/gi, "Melki", 0.5),
  regla(/\bmilky\b/gi, "Melki", 0.6),
  // Lo escrito como suena por quien habla español («simuleit», «optimais», «geitwey», «nétguork»)
  segura(/\b(?:simuleit|simuleid|simiuleit|simuleyt|simuleitio)\b/gi, "simulate", 0.4),
  segura(/\b(?:optimais|optimaiz|optimaisa)\b/gi, "optimize", 0.4),
  segura(/\b(?:geitwey|geitwei|geitguey|gueitwey|gueitguey|geitgüey)\b/gi, "gateway", 0.4),
  segura(/\b(?:netguork|n[eé]tguork|netuork|netwerk)\b/gi, "network", 0.4),
  segura(/\b(?:kaverech|k[aá]berech|caverech|coberech)\b/gi, "coverage", 0.4),
  // Siglas deletreadas y coordenadas dichas («k m z», «4 point 25 minus 73 point 4»)
  segura(/\bk\.?\s+m\.?\s+z\b|\bkay\s+em\s+zee\b/gi, "KMZ", 0.4),
  segura(/\bc\.?\s+s\.?\s+v\b|\bsee\s+ess\s+vee\b/gi, "CSV", 0.4),
  segura(/(\d)\s+point\s+(\d)/gi, "$1.$2", 0.3),
  segura(/(^|[\s,])(?:minus|negative|less)\s+(\d)/gi, "$1-$2", 0.4),
  // «turn Repeater 1 of» (la «f» final se pierde): «off»
  // (lo de adelante primero: así lo de atrás, que recorre la frase, solo se mira donde de verdad termina en «of»)
  segura(/(?=\s+of\s*$)(?<=^(?:(?:please|melki|okay|ok)[\s,]+)*(?:turn|switch|shut|power)\s+.+?)\s+of\s*$/i, " off", 0.5),
  segura(/^((?:(?:please|melki|okay|ok)[\s,]+)*(?:turn|switch|shut|power))\s+of\s+(?=\S)/i, "$1 off ", 0.5),
  segura(/\b(?:stress)\s+(?:taste|text|chest)\b|\b(?:dress|stretch)\s+test\b/gi, "stress test", 0.6),
  // Las unidades después de un número
  segura(new RegExp(String.raw`(\b(?:\d+(?:\.\d+)?|${NUMEROS_OIDOS_EN})\s+)(?:kilo\s+meters|killer\s+meters|kill\s+a\s+meters|kilo\s+metres|kilometer's|clicks|k's|kay\s+ems|k\s+m|kilo\s+meter|killometers)\b`, "gi"), "$1kilometers", 0.6),
  segura(new RegExp(String.raw`(\b(?:\d+(?:\.\d+)?|${NUMEROS_OIDOS_EN})\s+)(?:matters|meter's|mitres|mirrors|meet\s+hers|meat\s+hers|meaters|meeters|mitters|meteors)\b`, "gi"), "$1meters", 0.7),
  segura(new RegExp(String.raw`(\b(?:\d+(?:\.\d+)?|${NUMEROS_OIDOS_EN})\s+)(?:mails|males|mile's|mills)\b`, "gi"), "$1miles", 0.8),
  // Los números oídos como otras palabras: antes de una unidad o después de la pieza que nombran
  segura(new RegExp(String.raw`\b(${NUMEROS_OIDOS_EN})(?=\s+${UNIDAD_EN}\b)`, "gi"), (n: string) => NUMERO_EN[n.toLowerCase()] ?? n, 0.6),
  // («to» y «for» seguidos de otra palabra son la preposición: «move person to Cumaral»)
  regla(new RegExp(String.raw`(\b(?:repeaters?|persons?|nodes?|towers?|antennas?|gateways?|repetidor|persona|nodo|torre|antena)\s+)(${NUMEROS_OIDOS_EN})\b(?!(?<=\b(?:to|too|tu|for|fore))${DESPUES_DE_NOMBRE_NO})`, "gi"), (_m: string, a: string, n: string) => `${a}${NUMERO_EN[n.toLowerCase()] ?? n}`, 0.7),
  // Los rumbos: después de una distancia, después de «to the» y antes de «of the…»
  ...RUMBO_EN.flatMap(([oido, dudoso, bien]) => {
    const todos = dudoso ? `${oido}|${dudoso}` : oido;
    return [
      segura(new RegExp(String.raw`${DISTANCIA_EN}(?:${oido})\b`, "gi"), `$1${bien}`, 0.6),
      ...(dudoso
        ? [
            segura(new RegExp(String.raw`${DISTANCIA_EN}(?:${dudoso})\b(?=\s+(?:of|from)\b)`, "gi"), `$1${bien}`, 0.6),
            // (al final de lo dicho; «move it 2 km is that ok?», «2 km not more» siguen siendo frases)
            regla(new RegExp(String.raw`${DISTANCIA_EN}(?:${dudoso})\b(?=\s*[.!?]?\s*$)`, "gi"), `$1${bien}`, 0.8),
          ]
        : []),
      regla(new RegExp(String.raw`(\b(?:to|towards|toward|facing|point(?:ing)?(?: it)?|aim(?:ed)?(?: it)?)\s+the\s+)(?:${todos})\b`, "gi"), `$1${bien}`, 0.7),
      regla(new RegExp(String.raw`\b(?:${todos})(?=\s+of\s+(?:the|a|an|repeater|person|node|tower|antenna|gateway|\d)\b)`, "gi"), bien, 0.8),
    ];
  }),
  // Los verbos al empezar la orden
  regla(new RegExp(`${INICIO_EN}(?:at|had|and|ad|art|odd|aunt|edd|after)\\b${OBJETO_EN}`, "i"), "$1add", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:but|pot|putt|pat|pud|foot|pool)\\b${OBJETO_EN}`, "i"), "$1put", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:plays|plaice|plate|blaze|plays\\s+a)\\b${OBJETO_EN}`, "i"), "$1place", 0.9),
  regla(new RegExp(`${INICIO_EN}(?:mood|moo|moved|moves|mov|moon|mob|moob|muff|moose|movie|mu)\\b${OBJETO_EN}`, "i"), "$1move", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:the\\s+lead|they\\s+lead|daily|delight|dilate|the\\s+lit|the\\s+leet|delhi|dilute|to\\s+lead|deleted|the\\s+light|believe)\\b`, "i"), "$1delete", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:remote|removed|removes|remo|re\\s+move|remus|remove\\s+it's)\\b`, "i"), "$1remove", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:rice|race|rays|rise|raised|ray's|res|raids|raze)\\b`, "i"), "$1raise", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:lover|loader|lore|law\\s+were|lowered|loser|lure|lowers)\\b`, "i"), "$1lower", 0.7),
  // («so me and John…» y «so the coverage is bad» son charla)
  regla(new RegExp(`${INICIO_EN}(?:so|chow|shoe|sow|shove|shout|shell)\\b(?=\\s+(?:me|us)\\b(?!\\s+and\\b))`, "i"), "$1show", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:so|chow|shoe|sow|shove|shout|shell)\\b(?=\\s+(?:the|all|my)\\b)${SIN_VERBO_EN}`, "i"), "$1show", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:height|hi|high|hyde|hid)\\b(?=\\s+(?:the|all|my)\\b)`, "i"), "$1hide", 0.9),
  regla(new RegExp(`${INICIO_EN}(?:fine|fan|fined|fight|fond|find|fight)\\s+(?:me|my|mi|mee)\\b`, "i"), "$1find me", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:tag|tick|tech|tank|tape|take|tech)\\s+(?:me|my|mi)\\s+(?:to|too|two|through|tu)\\b`, "i"), "$1take me to", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:go|goal|gold)\\s+(?:too|two|tu)\\b`, "i"), "$1go to", 0.7),
  // (con lo que se simula después, o sola: «similar to the old one» es charla)
  regla(new RegExp(`${INICIO_EN}(?:similar|stimulate|emulate|simulated|simulator|simulates|see\\s+me\\s+late|sim\\s+you\\s+late|simple\\s+late|seem\\s+you\\s+late|simulant|samuel\\s+late)\\b(?=\\s+(?:a|an|the|it|this|that|again|now|everything|all|coverage|signal|network|mesh|terrain|repeat\\w*|gateway\\w*|nodes?|people|(?:on|and|in|own|an)\\s+chan(?:ge|ce))\\b|\\s*[.!]?\\s*$)`, "i"), "$1simulate", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:optimise|optimized|optimizer|up\\s+to\\s+mice|up\\s+to\\s+mize|optima\\s+is|optimum\\s+is|optimizing)\\b`, "i"), "$1optimize", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:pop\\s+you\\s+late|popular|pop\\s+your\\s+late|popula|populated|pop\\s+you\\s+lay)\\b`, "i"), "$1populate", 0.8),
  regla(/^(?:and\s+do|on\s+do|in\s+do|undue|under|on\s+to|and\s+due)$/i, "undo", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:expert|expo|exports)\\b`, "i"), "$1export", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:soon|zoo|zone|sum|zoomed|zoom)\\b(?=\\s+(?:in|out|to|into|on)\\b)`, "i"), "$1zoom", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:bill|built|beal|bild)\\b(?=\\s+(?:a|me|the|my|us)\\b)`, "i"), "$1build", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:the\\s+sign|this\\s+sign|designed|desire)\\b`, "i"), "$1design", 0.9),
  regla(new RegExp(`${INICIO_EN}(?:send\\s+her|sender|enter|centre)\\b(?=\\s+(?:the|it|on|map)\\b)`, "i"), "$1center", 0.9),
  regla(new RegExp(`${INICIO_EN}(?:sand|sent|cent)\\b(?=\\s+(?:a|the)\\s+(?:message|payment|test))`, "i"), "$1send", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:lord|lot|loud|lowed|low)\\b(?=\\s+the\\s+(?:example|sample|demo))`, "i"), "$1load", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:re\\s+name|renamed|we\\s+name)\\b`, "i"), "$1rename", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:so\\s+like|selected|select\\s+it's)\\b`, "i"), "$1select", 0.9),

  // ── Lo que el acento del español cambia en inglés (medido con frases dictadas por quien habla español) ──
  // Palabras partidas por el reconocimiento: «every thing», «pro file», «with in», «a round», «the rain», «pen seal»
  // («every one» es «everyone» solo al conectar a la gente; «delete every one of the repeaters» no son las personas: ahí,
  // solo una variante, y como borra, Melki la confirma)
  segura(/\bevery\s+(thing|body|where)\b/gi, "every$1", 0.3),
  segura(/(?<=\b(?:connect|reach|cover|serve|link)\s+)every\s+one\b(?!\s+of\b)/gi, "everyone", 0.3),
  regla(/\bevery\s+one\b(?!\s+of\b)/gi, "everyone", 0.6),
  segura(/\bpro\s+file\b/gi, "profile", 0.3),
  segura(/\bproto\s+(?:call|col|cole)\b/gi, "protocol", 0.4),
  segura(/(?<=\d\s*(?:km|kms|kilomet\w*|meters?|metres?|m|miles?)\s+)with\s+in\b|\bwith\s+in(?=\s+\d)/gi, "within", 0.3),
  segura(/(?<=\b(?:\d+\s*(?:km|kms|kilomet\w*|meters?|metres?|m|miles?)|people|persons|users|nodes)\s+)a\s+round\b|\ba\s+round(?=\s+(?:the\s+)?(?:repeater|gateway|person|node|tower|antenna|each|every|it|here)\b)/gi, "around", 0.3),
  segura(/(?<=\b(?:actual|real|flat|plain|on|use|the|with|without|no)\s+)(?:the\s+rain|terrane|ter\s+rain|tear\s+rain|train)\b/gi, "terrain", 0.5),
  segura(/\b(?:pen\s+seal|pen\s+sill|pencil's|pen\s+sell)\b/gi, "pencil", 0.4),
  segura(/\b(?:rule\s+her|ruler's|rule\s+or)\b/gi, "ruler", 0.4),
  segura(/\bgoogle\s+(?:art|earth|her|erth|ert|earth's)\b/gi, "Google Earth", 0.3),
  segura(/\b(?:hope|up|hub|hob|hop)\s+limit\b/gi, "hop limit", 0.4),
  segura(/\bliability\b/gi, "reliability", 0.6),
  segura(/\boptimi[sz]ations\b/gi, "optimization", 0.3),
  segura(/(?<=\b(?:the|apply|accept|use|go with)\s+)optimi[sz]e\s+network\b/gi, "optimized network", 0.5),
  segura(/\blot\s+test\b/gi, "load test", 0.4),
  segura(/\b(?:link|leak|lick|lake|leek)\s+(?:bucket|budge|budged|budgets|bucket's)\b|\b(?:leak|lick|lake|leek)\s+budget\b/gi, "link budget", 0.4),
  segura(/\b(?:pat|pad|pass|bath|pads|paths|pet)\s+(?=profile\b)/gi, "path ", 0.4),
  segura(/(?<=\b(?:all|all the|every|the|those|these)\s+)nose\b/gi, "nodes", 0.5),
  // (después de lo que muestra u oculta una capa: «the rows of the table» es otra cosa)
  segura(/(?<=\b(?:show|hide|no|without|disable|enable|toggle|display)\s+(?:the\s+)?)(?:rods|rows)\b/gi, "roads", 0.6),
  segura(/(?<=\b(?:erase|delete|remove|connect|clear|wipe)\s+)hall\b|\bhall\b(?=\s+(?:the\s+)?(?:nodes|repeaters|people|antennas|towers|the\s+nodes)\b)/gi, "all", 0.4),
  segura(/(?<=\b(?:test|a|send|sent)\s+)massages?\b|\bmassages?(?=\s+(?:from|to)\b)/gi, (m: string) => (/s$/i.test(m) ? "messages" : "message"), 0.4),
  segura(/(?<=\bthe\s+)(?:8|eight)(?=\s+of\b)/gi, "height", 0.4),
  segura(/(?<=\b(?:set|use|change|switch)(?:\s+(?:the|to))?\s+)as\s+if\b(?=\s+(?:to|2|\d))/gi, "SF", 0.5),
  segura(/(?<=\bexport(?:\s+(?:to|2|the|a|as|in))?\s+)kms\b/gi, "KMZ", 0.4),
  segura(/(?<=\bexport\s+)2(?=\s+(?:kmz|kms|csv|google)\b)/gi, "to", 0.4),
  segura(/\bstar\s+(?=again|over)\b/gi, "start ", 0.4),
  segura(/(?<=\bstart(?:\s+(?:again|over))?\s+from\s+)0\b/gi, "zero", 0.3),
  segura(/(?<=\b(?:make|run|do)\s+)this\s+stress\s+tests?\b/gi, "the stress test", 0.4),
  // «three hundred» oído «tree 100», «two hundred» oído «to 100»: dudosas, y «to» y «for» solo donde va una cantidad (nunca
  // donde son de verdad: «raise Repeater 1 to 100 m», «set the budget to 100», «a mesh for 100 users»)
  segura(/(?<![\d.,]\s*)\b(?:tree|free)\s+100\b/gi, "300", 0.4),
  regla(/(?<=\b(?:add|put|place|populate|scatter|spread|seed|insert|create|with|of|about|around|approximately|roughly|nearly|almost|size)\s+)(?:to|too)\s+100\b/gi, "200", 0.8),
  regla(/(?<=\b(?:add|put|place|populate|scatter|spread|seed|insert|create|with|of|about|around|approximately|roughly|nearly|almost|size)\s+)(?:for|fore)\s+100\b/gi, "400", 0.8),
  regla(/(?<![\d.,]\s*)\bfife\s+100\b/gi, "500", 0.6),
  // «Repeater 1 2 25 meters» (el «to» oído como «two»), también antes de una coordenada
  segura(/(?<=\b(?:repeater|person|node|tower|antenna|gateway)s?\s+\d+\s+)(?:2|two|too)(?=\s+(?:-?\d+(?:\.\d+)?\s*(?:m|meters?|metres?|km|kilomet\w*|ft|feet)\b|-?\d+\.\d+))/gi, "to", 0.5),
  segura(/(?=(?:2|two|too)\s+\S)(?<=\brename\b.*?\b(?:repeater|person|node|tower|antenna|gateway)\s+\d+\s+)(?:2|two|too)(?=\s+\S)/gi, "to", 0.5),
  // Coordenadas con el menos suelto: «4.25 - 73.4»
  segura(/(\d+\.\d+)\s+-\s+(\d+\.\d+)/g, "$1, -$2", 0.4),
  // «Juan» por «one» después de la pieza (repeater Juan)
  segura(/(?<=\b(?:repeater|person|node|tower|antenna)\s+)juan\b/gi, "1", 0.5),
  // «it» dicho como «eat» después de un verbo («point eat north», «can eat handle…»)
  regla(/(?<=\b(?:point|raise|move|lower|delete|rename|select|turn|can|does|will|would|make|put|take|bring|aim)\s+)(?:eat|eet|hit)\b/gi, "it", 0.6),
  // Los verbos en pasado o en otra forma al empezar la orden («connected Person 2…», «applied…», «pointed north»)
  regla(new RegExp(`${INICIO_EN}pointed\\b`, "i"), "$1point it", 0.7),
  regla(new RegExp(`${INICIO_EN}(connect|apply|disable|enable|delete|remove|load|use|export|save|select|simulate|optimi[sz]e|move|raise|lower|rename|add|place|populate|design|show|hide|send|choose|pick|erase|wipe|trash|scatter|measure|zoom)(?:ed|d|s|es|ing)\\b`, "i"), (_m: string, a: string, v: string) => `${a}${v.toLowerCase()}`, 0.7),
  regla(new RegExp(`${INICIO_EN}applied\\b`, "i"), "$1apply", 0.7),
  // Los verbos que el acento convierte en otras palabras al empezar
  regla(new RegExp(`${INICIO_EN}(?:a\\s+just|adjusted|a\\s+jest)\\b`, "i"), "$1adjust", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:a\\s+play|a\\s+ply|applies|apple)\\b`, "i"), "$1apply", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:a\\s+set|except|accepted|a\\s+sept)\\b(?=\\s+(?:the|it|this|that)\\b)`, "i"), "$1accept", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:a\\s+race|a\\s+raise|a\\s+rays|a\\s+rice)\\b`, "i"), "$1erase", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:this\\s+able|this\\s+sable|the\\s+sable)\\b`, "i"), "$1disable", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:this\\s+dance|these\\s+dance|the\\s+stance)\\b`, "i"), "$1distance", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:is\\s+cutter|a\\s+scatter|its\\s+cutter|is\\s+catter)\\b`, "i"), "$1scatter", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:shoes|chews|choose|shoos)\\b(?=\\s+\\S)`, "i"), "$1choose", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:peek|pig|peak)\\b(?=\\s+\\S)`, "i"), "$1pick", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:major|measurer|meter)\\b(?=\\s+the\\b)`, "i"), "$1measure", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:safe|saves|safe\\s+the)\\b(?=\\s+(?:the|it|this|my|our)\\b)`, "i"), "$1save", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:trust|thrash|crash)\\b(?=\\s+\\S)`, "i"), "$1trash", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:whip|weep|wife)\\b(?=\\s+\\S)`, "i"), "$1wipe", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:flight|fight|flies|fry)\\b(?=\\s+(?:to|me|over)\\b)`, "i"), "$1fly", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:juice|jus|yous|use\\s+the\\s+use)\\b(?=\\s+\\S)`, "i"), "$1use", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:kinect|connected|connects|kinnect|connector)\\b`, "i"), "$1connect", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:sender)\\b(?=\\s+(?:test|a|the))`, "i"), "$1send a", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:sent|sand|cent)\\b(?=\\s+\\S)`, "i"), "$1send", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:chance|chain|changed|changes)\\b(?=\\s+(?:the|it|to)\\b)`, "i"), "$1change", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:optimist|optimism|optimus)\\b`, "i"), "$1optimize", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:cole|coal|col|cool)\\b(?=\\s+(?:repeater|person|node|tower|antenna|gateway|it|the)\\b)`, "i"), "$1call", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:it's\\s+start|its\\s+start|estart|start\\s+it)\\b`, "i"), "$1start", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:loaded|lowered\\s+the\\s+sample)\\b`, "i"), "$1load", 0.8),
  regla(new RegExp(`${INICIO_EN}(?:so|sew|sow)\\b(?=\\s+(?:the\\s+)?(?:roads|rods|rows|layers|results|coverage|map|signal|network|panel|people|repeaters|nodes|path|profile|pad|pat)\\b)${SIN_VERBO_EN}`, "i"), "$1show", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:sue\\s+be|super|sube)\\b(?=\\s+(?:repeater|person|node|tower|antenna|gateway|el|la|it)\\b)`, "i"), "$1sube", 0.8),
  regla(/\bwanna\b(?=\s+(?:a\s+)?(?:repeater|person|node|gateway|antenna|tower|network))/gi, "want a", 0.6),
  regla(/\ba\s+very\b(?=\s+(?:node|repeater|person|antenna|tower|one))/gi, "every", 0.6),
  regla(/(?<=\b(?:could|can|would|will|please|to)\s+(?:you\s+)?)ran\b/gi, "run", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:ran|rum|rung)\\b(?=\\s+(?:the|a|an|another)\\b)`, "i"), "$1run", 0.6),
  regla(/\bpolice\s*[.!?]*$/gi, "please", 0.6),
  regla(/(?<=\bwould\s+you\s+)mine\b/gi, "mind", 0.5),
  regla(/\bstimulating\b/gi, "simulating", 0.6),
  regla(/\bmessage\s+for\b/gi, "message from", 0.7),
  regla(/(?<=\bthe\s+)(?:rule|roller|rula|rooler)\b/gi, "ruler", 0.7),
  regla(/^(?:(?:okay|ok|so|um)[\s,]+)*(?:roller|rula|rooler|rule\s+her)$/i, "ruler", 0.6),
  regla(/\blinks\b(?=\s+between\b)/gi, "link", 0.6),
  // Más palabras que el acento cambia (de la segunda tanda de frases dictadas)
  segura(/(?<=\b(?:a|an|on|the|another|one|new|each|every)\s+)repeat\s+(?:or|it\s+or|err|a\s+door|it\s+a\s+door)\b/gi, "repeater", 0.5),
  segura(/(?<=\badd\s+)on\s+(?=(?:repeater|person|node|tower|antenna)\b(?!\s+\d))/gi, "a ", 0.4),
  segura(/(?<=\b(?:[2-9]|[1-9]\d+)\s+)user\b/gi, "users", 0.3),
  segura(/\boptimized\s+networks\b/gi, "optimized network", 0.3),
  segura(/\b(sf|spreading factor)\s+2(7|8|9|10|11|12)\b/gi, "$1 to $2", 0.5),
  segura(/\b(?:leak|lick|leek)\b(?=\s+(?:from|between|report|budget|of)\b)/gi, "link", 0.4),
  segura(/\blake\b(?=\s+(?:between|report|budget)\b)/gi, "link", 0.4),
  segura(/\blinked\s+(?=report\b)/gi, "link ", 0.4),
  segura(/\b(save|export|load|open)\s+the\s+(project|scenario|file)s\b/gi, "$1 the $2", 0.4),
  segura(/\bstress\s+tests\b/gi, "stress test", 0.3),
  segura(/(?<=\bthe\s+)aria\b/gi, "area", 0.4),
  segura(/\bsat\s*light\b|\bsattelite\b/gi, "satellite", 0.4),
  segura(/\bme\s+too\b(?=\s+[A-Za-z])/gi, "me to", 0.4),
  segura(/\bkmc\b/gi, "KMZ", 0.4),
  segura(/(?<=\bexport\s+)at\s+(?=kmz|csv|a\b)/gi, "a ", 0.4),
  segura(/(?<=\b(?:set|put|change|switch|turn)\s+(?:the\s+)?(?:reliability|liability|confidence|availability|quality|precision|accuracy|mode|level|margin)\s+)too\s+(?=(?:high|low|medium|normal|max|maximum|minimum)\b)/gi, "to ", 0.4),
  segura(/\breal\s+ability\b/gi, "reliability", 0.4),
  segura(/\bgimme\b/gi, "give me", 0.3),
  segura(/(?<=\b(?:repeater|person|tower|node|antenna|gateway)(?:\s+\d+)?\s+)(?:hide|high|hight|eight|hate|height's)\b(?=\s+(?:to\s+|of\s+|at\s+)?\d)/gi, "height", 0.4),
  segura(/\b(?:nor|nort|not)\b(?=\s+(?:by|buy)\s+\d)/gi, "north", 0.5),
  segura(/\b(?:sout|sauce)\b(?=\s+(?:by|buy)\s+\d)/gi, "south", 0.5),
  segura(/\b(?:wes|vest|guest)\b(?=\s+(?:by|buy)\s+\d)/gi, "west", 0.5),
  segura(/(?<=\b(?:north|south|east|west)\s+)buy\b(?=\s+\d)/gi, "by", 0.4),
  segura(/\bof\s+the\s+(?:mop|mob|nap|mup)\b/gi, "off the map", 0.4),
  segura(/(?<=\b(?:take|get|remove)\s+(?:it|them|this|that|those|these|everything|all|(?:the\s+)?(?:repeater|person|node|tower|antenna|gateway)s?(?:\s+\d+)?)\s+)of\s+the\s+map\b/gi, "off the map", 0.5),
  segura(/(?<=\b(?:delete|erase|remove|wipe|clear)\s+)al\b/gi, "all", 0.4),
  segura(/(?<=\b(?:repeater|person|tower|node|antenna)\s+)(?:ones|one's|won's)\b(?=\s+(?:hate|height|hide|hight|eight|high|antenna|signal|coverage|range|position|name)\b)/gi, "1's", 0.5),
  segura(/(?<=\b(?:(?:repeater|person|node|tower|antenna|gateway)(?:\s+\d+)?'s|its)\s+)(?:hate|hide|hight|eight|high)\b(?=\s+(?:to|by|at|\d)|\s*[?.!]?\s*$)/gi, "height", 0.4),
  segura(/(?<=\b(?:a|the|my|our|of|with)\s+)bucket\b(?=\s+of\b)/gi, "budget", 0.4),
  segura(/\baround\s+ear\b/gi, "around here", 0.4),
  segura(/\bback\s+up\s+(?=antennas?|sites?|nodes?)/gi, "backup ", 0.3),
  segura(/\band\s+tennis\b/gi, "antennas", 0.4),
  segura(/\broad\s+(?:player|liar|lawyer|layer's|later)\b/gi, "road layer", 0.4),
  regla(new RegExp(`${INICIO_EN}(?:star)\\b(?=\\s+(?:the|a)\\s+(?:stress|load|simulation|test|tour))`, "i"), "$1start", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:a\\s+spread|is\\s+spread|spreads)\\b`, "i"), "$1spread", 0.7),
  regla(new RegExp(`${INICIO_EN}flame\\s+to\\b`, "i"), "$1fly me to", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:half|have\\s+a|hab)\\b(?=\\s+(?:person|repeater|the|node|tower)\\b)`, "i"), "$1have", 0.7),
  regla(/(?=sent\b)(?<=\b(?:have|make|let|get)\s+.+?\s)sent\b/gi, "send", 0.6),
  regla(/(?=\s+connect\s*$)(?<=^(?:get|have|make)\s+.+?)\s+connect\s*$/gi, " connected", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:was|what\\s+was|wants)\\b(?=\\s+the\\s+(?:distance|height|coverage|signal|cost|status|range|link))`, "i"), "$1what's", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:wears|wear's|wares|where\\s+as)\\b(?=\\s+[A-Za-z])`, "i"), "$1where's", 0.7),
  regla(/(?<=\badd\s+)on\b(?=\s+repeat)/gi, "a", 0.6),
  regla(/(?<=\b(?:can|could|will|would)\s+(?:it|the network|the mesh|this|we|you)\s+)(?:and\s+all|hand\s+all|and\s+hold|and\s+el|handel|hand\s+el)\b/gi, "handle", 0.6),
  // Más del acento (tercera tanda): «to» oído como «2», unidades y palabras del simulador
  segura(/(?<=\ball\s+(?:the\s+)?)(repeater|person|node|antenna|tower|gateway)\b(?!s)/gi, "$1s", 0.3),
  segura(/(?<!\b(?:repeater|person|tower|torre|node|antenna|repetidor|persona|nodo|antena|gateway)\s+)\b2\s+(?=\d+(?:[.,]\d+)?\s*(?:m|meters?|metres?|ft|feet|km|%|percent)\b)/gi, "to ", 0.4),
  segura(/(?<!\b(?:repeater|person|tower|torre|node|antenna|repetidor|persona|nodo|antena|gateway)\s+)\b2\s+(?=(?:its?|the|their)\b)/gi, "to ", 0.4),
  segura(/\b2\s+(?=(?:repeater|person|tower|node)\s+\d)/gi, "to ", 0.4),
  segura(/(?<=\d\s*)(?:fee|fit|feat|fet|fief)\b/gi, "ft", 0.4),
  segura(/\bspare\s+density\b/gi, "sparse density", 0.4),
  // «simulate on change» (simular al cambiar algo): «… and chance», «… in change»
  segura(/(?<=\b(?:simulat\w*|auto(?:matically)?|mode)\s+)(?:on|own|and|an|in)\s+chance\b/gi, "on change", 0.4),
  segura(/(?<=\bsimulat\w*\s+)(?:and|an|in|own)\s+(?=change\b)/gi, "on ", 0.4),
  segura(/(?<=\b(?:everything|all)\s+)accept\b/gi, "except", 0.4),
  segura(/\bmark\s+it\s+day\b|\bmarket\s+(?:they|the|de)\b(?=\s*$|\s*[.?!])/gi, "market day", 0.4),
  segura(/(?<=\bfor\s+the\s+)(?:lot|low|loud|lord)\b/gi, "load", 0.5),
  segura(/\b(?:loud|lot|low|lord|lol)\s+(?=tests?\b)/gi, "load ", 0.5),
  segura(/\bbdf\b|\bp\s+d\s+f\b/gi, "PDF", 0.4),
  segura(/\bdetail\s+(?=budget|report|cost)/gi, "detailed ", 0.4),
  segura(/(?<=\d+\s*%\s+)(?:option|adaptation|adoptation|adopted|adapting)\b/gi, "adoption", 0.5),
  segura(/\b(?:kilomet(?:er|re)s?|kms?)\s+(?:is\s+)?(?:scared|squared|square)\b/gi, "km²", 0.5),
  segura(/(?<=\b\d[\d,.]*\s+)(?:uses|juicers|losers|youzers)\b/gi, "users", 0.5),
  segura(/(?<=\bwith\s+)tours\b(?=\s+(?:up\s+to|of|\d))/gi, "towers", 0.5),
  // (antes de una coordenada entera: «raise the towers 2.5 m» son las torres)
  segura(/\btowers\b(?=\s+-?\d{1,2}[.,]\d+\s*,?\s*-\d{2,3}(?:[.,]\d+)?\b)/gi, "towards", 0.5),
  segura(/(?<=\d\s+)the\s+grease\b|(?<=\d\s+)degree\b/gi, "degrees", 0.4),
  regla(new RegExp(`${INICIO_EN}(?:seat|sit|see|seek|sid|cede|said)\\b(?=\\s+(?:the\\s+|a\\s+)?(?:mesh|mess|match|network|repeaters?|re\\s+peters))`, "i"), "$1seed", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:safe|safes|saves)\\b(?=\\s+(?:as|the|it|this|my|a|an)\\b)`, "i"), "$1save", 0.6),
  regla(new RegExp(`${INICIO_EN}said\\b(?=\\s+(?:all|the|its?|repeater|sf|reliability))`, "i"), "$1set", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:lot|low|lord|loud)\\b(?=\\s+(?:an?|the|my)\\s+(?:example|demo|scenario|file|project|mesh))`, "i"), "$1load", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:till|teal|tilled|tilde)\\b(?=\\s+(?!me\\b|us\\b)\\S+)`, "i"), "$1tilt", 0.6),
  regla(new RegExp(`${INICIO_EN}(?:pointer|pointing)\\b`, "i"), "$1point", 0.6),
  regla(/\b(?:peter|pita|beater|reader)\s+(?=\d)/gi, "Repeater ", 0.7),
  regla(new RegExp(`${INICIO_EN}his\\b(?=\\s+(?:my|the|it|this)\\b)`, "i"), "$1is", 0.6),
  regla(new RegExp(`${INICIO_EN}adjusted\\b`, "i"), "$1adjust it", 0.7),
  regla(new RegExp(`${INICIO_EN}(?:removed|deleted)\\b(?=\\s+from\\b)`, "i"), "$1remove it", 0.7),
  regla(new RegExp(`${INICIO_EN}(open|update|export|load|save|select)d?(?:ed)?\\b`, "i"), "$1$2", 0.7),
  regla(/(?<=\busers?\s+(?:are|is)\s+)(?:feeling|filling|felling|fading|feeding)\b/gi, "failing", 0.6),
  regla(/(?<=\b(?:doesn't|does not|not|it)\s+)walk\b/gi, "work", 0.6),
  regla(/\btour\s+(?=\d|two\b|to\b|too\b)/gi, "tower ", 0.8),
];

/**
 * Las palabras cortas que el acento cambia por otras («load and example», «clear them up», «make a copy off it», «set
 * all their repeaters», «set all repeaters too 25 m», «Size 5000 users of her 800 km²»). Dudosas y como las de parecido:
 * solo valen si lo que queda sigue pareciendo una orden de Melki.
 */
const CORTAS_EN: Regla[] = [
  ["and", "an", 0.8],
  ["and", "in", 0.9],
  ["them", "the", 0.8],
  ["their", "the", 0.8],
  ["there", "the", 0.9],
  ["these", "the", 0.9],
  ["this", "the", 0.9],
  ["off", "of", 0.8],
  ["of", "off", 0.9],
  ["as", "a", 0.9],
  ["has", "as", 0.8],
  ["too", "to", 0.7],
  ["wit", "with", 0.7],
  ["no", "not", 0.9],
  ["eat", "it", 0.7],
  ["eats", "its", 0.7],
  ["up", "a", 1],

  ["of her", "over", 0.8],
  ["a", "", 1.1],
].map(([dicho, por, costo]) => ({ re: new RegExp(`\\b${String(dicho).replace(" ", "\\s+")}\\b`, "gi"), por: String(por), costo: Number(costo), segura: false, corta: true }) as Regla);
// «apply to optimization»: «to» por «the» solo después del verbo de una orden
CORTAS_EN.push({ re: /(?<=\b(?:apply|use|accept|load|open|show|export|save|run|start|clear|delete|remove|move|raise|lower|select|rename|duplicate|copy)\s+)to\b(?=\s+[a-z])/gi, por: "the", costo: 1, segura: false, corta: true });

/* ───────────── Español ───────────── */

/** Verbos con su pronombre pegado («sube lo» → «súbelo»), sin la tilde: el intérprete las quita. */
const VERBOS_CLITICO_ES = "sube|baja|mueve|borra|pon|quita|lleva|acerca|elimina|renombra|selecciona|duplica|apaga|activa|desactiva|corre|ubica|coloca|llama|cambia|deja|arrima";

const REGLAS_ES: Regla[] = [
  // (también antes de un número de varias cifras: «sube lo 15 metros»)
  regla(new RegExp(String.raw`\b(${VERBOS_CLITICO_ES})\s+(lo|la|los|las)\b(?=\s+(?:(?:a|al|en|cerca|junto|hacia|como|mas|menos)\b|\d)|$)`, "gi"), "$1$2", 0.4),
  // «Agrega un repetido…», «otro repetido», «el repetido 1»: es el repetidor (seguro). «Borra el repetido», «borra los
  // repetidos» también pueden ser los duplicados: solo una variante (y lo que borra, Melki lo confirma antes)
  segura(/(?<=\b(?:un|otro|cada|del|al|nuevo)\s+)repetido\b(?!\s+(?:veces|dias|días))/gi, "repetidor", 0.5),
  segura(/\brepetido(?=\s+\d)(?!\s+\d+\s+(?:veces|dias|días)\b)/gi, "repetidor", 0.5),
  regla(/(?<=\b(?:el|este|ese)\s+)repetido\b(?!\s+(?:veces|dias|días))/gi, "repetidor", 0.5),
  regla(/(?<=\b(?:los|unos|dos|tres|cuatro|cinco|\d+)\s+)repetidos\b(?!\s+(?:veces|dias|días))/gi, "repetidores", 0.5),
  regla(/\b(?:repetidos|repartidores|receptores|repetidoras|repetidores)\b/gi, "repetidores", 0.8),
  regla(/\b(?:repetido|repartidor|repetida|receptor|repetitor|repetidora|repetir)\b/gi, "repetidor", 0.8),
  // El gateway como lo escribe el reconocimiento en español, «llévame» partido y las siglas dichas
  segura(/\b(?:getwey|getway|geitway|geitwey|gatwey|guetwey|gueitwey|getweis|getwei)\b/gi, "gateway", 0.5),
  segura(/\b(lleva|muestra|ubica|acerca|busca|ensena|enseña|pon|dale|haz|explica)\s+(me|nos)\b/gi, "$1$2", 0.4),
  // Lo que el reconocimiento escribe con otras palabras al hablar rápido (de la segunda tanda de frases dictadas)
  segura(/\bde\s+tallad([oa]s?)\b/gi, "detallad$1", 0.4),
  segura(/\bal\s+rededor\b/gi, "alrededor", 0.3),
  segura(/\bget\s*away\b|\bg(?:u)?ei(?:gu|g|w)ei\b|\bgate\s+way\b/gi, "gateway", 0.4),
  segura(/\bgate\s+ways\b/gi, "gateways", 0.4),
  segura(/(?<=\b(?:la|una|de|esta|esa|mi|tu|su|nueva)\s+)maya\b/gi, "malla", 0.4),
  segura(/^asta\b|\basta\s+(?=d[oó]nde|cu[aá]ndo|qu[eé]|cu[aá]nt|el\b|la\b|los\b|las\b|\d)/gi, "hasta ", 0.4),
  segura(/\b(de|la|el|en|a|que|los|las|un|una|del|al)\s+\1\b/gi, "$1", 0.3),
  segura(/\bmodo\s+avanzando\b/gi, "modo avanzado", 0.4),
  segura(/(?<=\b(?:la|de|para la|en la|prueba de)\s+)carta\b/gi, "carga", 0.5),
  segura(/^pueblo\s+(?=con\s+\d)/gi, "puebla ", 0.5),
  segura(/\bterreno\s+llano\b/gi, "terreno plano", 0.4),
  segura(/\b(a|de|para)\s+qui[eé]n\s+es\b(?=\s+(?:no|les|le|se)\b)/gi, "$1 quiénes", 0.4),
  segura(/\banima\s+a\s+la\s+(red|malla)\b/gi, "anima la $1", 0.4),
  segura(/\b[aá]rea\s+de\s+objetivo\b/gi, "área objetivo", 0.4),
  segura(/\b(?:similar|simula)\s+al\s+cambiar\b/gi, "simular al cambiar", 0.5),
  segura(/(?<=\b(?:ajusta|centra|cambia|mueve)\s+la\s+)lista\b(?=\s+(?:a|al|en|sobre|hacia)\b)/gi, "vista", 0.5),
  segura(/\bvegetaci[oó]n\s+tensa\b/gi, "vegetación densa", 0.4),
  segura(/\b(sembrar|simular|cargar|mostrar|ajustar|borrar)la\s+(malla|red)\b/gi, "$1 la $2", 0.4),
  segura(/\bvuelve\s+(?=sembrar|simular|cargar|poner|calcular|empezar|hacer)/gi, "vuelve a ", 0.4),
  segura(/\bconectarlos\s+que\b/gi, "conecta a los que", 0.4),
  segura(/\bpapel\s+de\s+(resultados|herramientas|capas|la\s+izquierda|la\s+derecha)/gi, "panel de $1", 0.4),
  segura(/^(?:y\s+)?escribe\b(?=\s+(?:un|una)\s+(?:nodo|modo|antena))/gi, "inscribe", 0.5),
  segura(/^has\s+(me|nos|la|lo)\b/gi, "haz$1", 0.4),
  segura(/^has\b(?=\s+(?:una|un|la|el)\s)/gi, "haz", 0.5),
  segura(/^llamar?\s+(?:al\s+|el\s+)?escenario\b/gi, "llama al escenario", 0.4),
  regla(/\b(muestr|ense[nñ]|indic|explic)ale\b/gi, "$1ame", 0.7),
  regla(/\bd[aá]mele\b/gi, "dame el", 0.6),
  regla(/(?<=\b(?:una|la|esta|mi|tu|su)\s+)res\b/gi, "red", 0.7),
  regla(/\blaura\b/gi, "LoRa", 0.6),
  regla(/\bprobadas\b/gi, "pobladas", 0.6),
  regla(/\batenas\b/gi, "antenas", 0.6),
  regla(/\bvara\b/gi, "barra", 0.6),
  regla(/\bcontabilidad\b/gi, "confiabilidad", 0.6),
  regla(/\bpublica\b(?=\s+(?:el\s+|la\s+)?(?:repetidor|persona|nodo|torre|antena|gateway))/gi, "duplica", 0.6),
  segura(/\bpersonal(?=\s+\d)/gi, "persona", 0.5),
  // La b por la v: «muestra las bías» → «las vías»
  segura(/(?<=\b(?:las|sin|con|de|muestra|quita|oculta)\s+)b[ií]as\b/gi, "vías", 0.5),
  segura(/\b(?:ese\s+efe|ese\s+f|s\s+f|es\s+efe)\s*(\d{1,2})\b/gi, "SF$1", 0.4),
  segura(/\b(?:estar\s*link|star\s+link|starling|estarlin)\b/gi, "Starlink", 0.4),
  segura(/\b(?:guasap|wasap|whats\s+app|guatsap)\b/gi, "WhatsApp", 0.4),
  segura(/\b(?:guei\s*guey|guei\s*wey|gay\s+way|gay\s+g[uü]ey|kate\s+g[uü]ey|keit\s*wey|geit\s*g[uü]ey|geteway|gatewey|gate\s+g[uü]ey|gueit\s*g[uü]ey|gate\s+way|ge[ií]t\s*wey)\b/gi, "gateway", 0.6),
  regla(/\bget\s*away\b/gi, "gateway", 0.7),
  regla(/\bmodo\b(?=\s+(?:antena|de campo|\d))/gi, "nodo", 0.8),
  regla(/\b(un|el|este|ese|cada|otro|nuevo)\s+modo\b(?!\s+(?:avanzado|sembrar|siembra|oscuro|claro|completo|experto|sencillo|facil|fácil|simple|trama|privado|navegador|manos|jarvis|nocturno|diurno))/gi, "$1 nodo", 0.9),
  regla(/^(?:s[ií]\s+mula|simular|estimula|simul[aá]|simulo|simul[eé])\b/i, "simula", 0.6),
  regla(/^(?:por|pan|son|bon)\s+(?=(?:un|una|el|la|otro|otra|dos|tres|cuatro|cinco|\d+)\b)/i, "pon ", 0.7),
  regla(/^(?:a\s+grega|agreda|agregue)\b/i, "agrega", 0.6),
  regla(/^(?:ilumina|elimine|elimin[eé])\b/i, "elimina", 0.7),
  regla(/^(?:vaya|baje|bajá)\s+(?=(?:el|la|lo|los|las|a|todos|todas)\b)/i, "baja ", 0.8),
  regla(/^(?:sobre|suba|sub[ií]|sub)\s+(?=(?:el|la|lo|los|las|a|todos|todas)\b)/i, "sube ", 0.8),
  regla(/^(?:muebe|mueva|muere|nueve)\s+(?=(?:el|la|lo|los|las|a|todos|todas)\b)/i, "mueve ", 0.8),
  segura(/\b(?:kilo\s+metros|quil[oó]metros)\b/gi, "kilómetros", 0.5),

  segura(/\b(?:melqui|mel\s+qui|melky|mel\s+ki|melqu[ií])\b/gi, "Melki", 0.5),
  regla(/\b(?:es\s+tr[eé]s|extr[eé]s)\b/gi, "estrés", 0.7),
  // ── Lo que el reconocimiento escribe mal del español dicho rápido (medido con frases dictadas) ──
  segura(/\bstress\b(?!\s+tests?\b)/gi, "estrés", 0.4),
  // «Mueve el Repetidor 1 un kilómetro al norte» (después del número del nombre, «un» no se pasa a cifra)
  segura(/(?<=\d\s+)una?\s+(?=(?:km|kil[oó]metros?|metros?|millas?)\b)/gi, "1 ", 0.3),
  segura(/\bala\s+redonda\b/gi, "a la redonda", 0.3),
  segura(/\b(arma|dise[nñ]a|dame|crea|calcula|muestra)\s+(me|nos)\b(?=\s+(?:una?|el|la|los|las|\d)\b)/gi, "$1$2", 0.4),
  segura(/\ba\s+la\s+redonda\s+(?!de\b|del\b|con\b|y\b|para\b|en\b|sin\b|que\b|a\b|al\b|por\b)(?=[A-ZÁÉÍÓÚÑ])/g, "a la redonda de ", 0.4),
  segura(/(?<=\b(?:usa|pon|cambia a|cambia al|con|en)\s+)efe\s*(\d{1,2})\b/gi, "SF$1", 0.4),
  segura(/\bdistancias\s+entre\b/gi, "distancia entre", 0.3),
  segura(/^pueblo\s+(?=(?:la|el|esa|esta|toda|todo)\s+(?:zona|area|área|red|malla|municipio)\b)/i, "puebla ", 0.4),
  // («muestra los modos» también existe: solo una variante)
  regla(/(?<=\b(?:los|todos los|unos|dos|tres|cuatro|cinco|\d+)\s+)modos\b/gi, "nodos", 0.5),
  segura(/\btodo\s+los\b/gi, "todos los", 0.3),
  segura(/\btoda\s+las\b/gi, "todas las", 0.3),
  segura(/\b(?:get\s+way|geiwey|geitguey|gueitguey|geit\s+way|guey\s+way)\b/gi, "gateway", 0.5),
  segura(/\bre\s+nombra\b/gi, "renombra", 0.3),
  segura(/\bcomo\s+repetidora\b/gi, "como repetidor", 0.4),
  // «arma una red 3 km…» es «una red de 3 km»; «mueve toda la red 2 km al norte» no (fuera de un diseño, solo una variante)
  segura(/(?<=(?<![\p{L}])(?:arma|armame|ármame|disena|diseña|disename|diseñame|diséñame|crea|creame|créame|dame|hazme|haz|construye|constrúyeme|construyeme|genera|planea|propon|propón|calcula|calculame|calcúlame)\s+(?:una|la|me\s+una)\s+)(red|malla)\s+(?=\d+(?:[.,]\d+)?\s*(?:km|kil[oó]metros?|metros|m|millas?|hect[aá]reas|ha)\b)/giu, "$1 de ", 0.4),
  regla(/(?<=\b(?:una|otra|nueva)\s+)(red|malla)\s+(?=\d+(?:[.,]\d+)?\s*(?:km|kil[oó]metros?|metros|m|millas?|hect[aá]reas|ha)\b)/gi, "$1 de ", 0.6),
  segura(/\b(quita|muestra|oculta|pon|activa|desactiva|ensena|enseña)\s+la\s+v[ií]a\b/gi, "$1 las vías", 0.4),
  segura(/\bcsb\b/gi, "CSV", 0.4),
  segura(/\bl[ií]mite\s+de\s+salto\b/gi, "límite de saltos", 0.3),
  segura(/\b(?:lonely|longli|longly|long\s*lee|longley|longle)\s*[-\s]?\s*(?:rice|rais|rays|raise|reis|rais)\b/gi, "Longley-Rice", 0.4),
  segura(/(?<=\b(?:al|el|hacia el|del)\s+)accidente\b/gi, "occidente", 0.4),
  segura(/(?<=\d\s*(?:km|kil[oó]metros?|metros|m|millas?)\s+)a\s+(?=(?:norte|sur|este|oeste|oriente|occidente|noreste|noroeste|sureste|suroeste|nororiente|noroccidente|suroriente|suroccidente)\b)/gi, "al ", 0.4),
  segura(/\b(sur|nor)\s+(este|oeste|oriente|occidente)\b/gi, "$1$2", 0.3),
  // («sube todas las torres 5 metros» son todas: solo una variante)
  regla(/\btorres\s+(?=\d)/gi, "torre ", 0.5),
  segura(/(?<=\b(?:empieza|empezar|empecemos|empezamos|arranca|comienza|comencemos)\s+(?:de|desde)\s+)0\b/gi, "cero", 0.3),
  // Los verbos que el reconocimiento cambia al empezar la orden
  regla(/^(?:pueblo|pueble)\s+(?=(?:la|el|esa|esta|toda|todo|una)\b)/i, "puebla ", 0.7),
  regla(/^(?:nuestra|nuestras)\s+(?=(?:la|las|el|los|me)\b)/i, "muestra ", 0.7),
  regla(/^(?:con|son)\s+(?=(?:el|la|los|las)\s+(?:mapa|capa|capas|vias|vías|relieve|satelital|topografico|topográfico)\b)/i, "pon ", 0.7),
  regla(/^(?:pone|ponga|poner)\s+(?=(?:el|la|los|las|un|una|\d)\b)/i, "pon ", 0.6),
  regla(/^ponle\s+(?=(?:gateway|repetidor|persona|antena|nodo|torre)\b)/i, "pon el ", 0.7),
  regla(/^(?:informa|informes)\s+(?=del?\s+enlace\b)/i, "informe ", 0.6),
  regla(/^(?:conect[oó]|conecto|conectar)\s+(?=(?:a|al|la|el|todos|todas|persona)\b)/i, "conecta ", 0.7),
  regla(/^selecci[oó]n\s+(?=a\b|al\b|la\b|el\b)/i, "selecciona ", 0.7),
  regla(/^(?:muevo|movi|moví)\s+(?=(?:el|la|a|al)\b)/i, "mueve ", 0.7),
  regla(/(?=\s+con\s+\S)(?<=\bren[oó]?mbr\w*\b.*?)\s+con\s+(?=\S)/gi, " como ", 0.7),
  // Siglas deletreadas y coordenadas dichas («k m z», «4 punto 25 menos 73 punto 4»)
  segura(/\bk\.?\s+m\.?\s+z\b|\bka\s+eme\s+(?:zeta|seta)\b/gi, "KMZ", 0.4),
  segura(/\bc\.?\s+s\.?\s+v\b|\bce\s+ese\s+uve\b/gi, "CSV", 0.4),
  segura(/\b(?:mes|mesh|mech)\s+(?:tastic|tástic|tastik)\b/gi, "Meshtastic", 0.4),
];

/* ───────────── Parecido por cómo suena (lo que no está en las listas) ───────────── */

/** Cómo suena una palabra del inglés, en el mismo alfabeto reducido de la del español («repeater» → «repiter»). */
export function claveIngles(texto: string): string {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  return t
    .replace(/tion/g, "Con")
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/qu/g, "ku")
    .replace(/x/g, "ks")
    .replace(/wh/g, "u")
    .replace(/^wr/, "r")
    .replace(/^kn/, "n")
    .replace(/igh/g, "ai")
    .replace(/gh/g, "")
    .replace(/th/g, "t")
    .replace(/sh|ch/g, "C")
    .replace(/g(?=[eiy])/g, "y")
    .replace(/j/g, "y")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/z/g, "s")
    .replace(/v/g, "b")
    .replace(/ee|ea|ie/g, "i")
    .replace(/oa/g, "o")
    .replace(/oo|ou/g, "u")
    .replace(/ay|ai|ey|ei/g, "ei")
    .replace(/w/g, "u")
    .replace(/y(?![aeiou])/g, "i")
    .replace(/(?<=[^aeiou])e$/, "")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * Cuánto cuesta pasar de una clave del inglés a otra, con el oído de quien habla español: las vocales se confunden
 * fácil («fill» y «feel», «it» y «eat»), también b/p/f, d/t, g/k, s/sh/ch, l/r, m/n, y las consonantes del final se
 * pierden («nort», «wes»; la «s» del plural, casi siempre). Tabla por código de letra (rápida: se compara mucho).
 */
const COSTO_EN = new Float64Array(128 * 128).fill(1);
const QUITAR_EN = new Float64Array(128).fill(0.8);
const VOCAL = new Uint8Array(128);
for (const v of "aeiou") VOCAL[v.charCodeAt(0)] = 1;
for (let a = 0; a < 128; a++) {
  COSTO_EN[a * 128 + a] = 0;
  if (VOCAL[a]) QUITAR_EN[a] = 0.45;
  for (let b = 0; b < 128; b++) if (a !== b && VOCAL[a] && VOCAL[b]) COSTO_EN[a * 128 + b] = 0.35;
}
for (const [a, b, c] of [
  ["b", "p", 0.5],
  ["b", "f", 0.6],
  ["p", "f", 0.6],
  ["d", "t", 0.4],
  ["g", "k", 0.5],
  ["s", "C", 0.5],
  ["t", "C", 0.7],
  ["y", "C", 0.6],
  ["l", "r", 0.6],
  ["m", "n", 0.5],
  ["k", "C", 0.7],
  ["d", "r", 0.7],
  ["s", "t", 0.8],
  ["n", "l", 0.8],
  ["y", "i", 0.3],
  ["u", "y", 0.6],
] as [string, string, number][]) {
  COSTO_EN[a.charCodeAt(0) * 128 + b.charCodeAt(0)] = c;
  COSTO_EN[b.charCodeAt(0) * 128 + a.charCodeAt(0)] = c;
}
const quitarEn = (c: number, alFinal: boolean) => (VOCAL[c] ? 0.45 : alFinal ? (c === 115 ? 0.3 : 0.5) : QUITAR_EN[c]);
let filaA = new Float64Array(32);
let filaB = new Float64Array(32);
let filaC = new Float64Array(32);
/** Distancia de edición ponderada entre dos claves del inglés (con intercambio de dos letras vecinas). */
export function distanciaIngles(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (m + 1 > filaA.length) {
    filaA = new Float64Array(m + 1);
    filaB = new Float64Array(m + 1);
    filaC = new Float64Array(m + 1);
  }
  let antes2 = filaA;
  let antes = filaB;
  let ahora = filaC;
  antes[0] = 0;
  for (let j = 1; j <= m; j++) antes[j] = antes[j - 1] + quitarEn(b.charCodeAt(j - 1) & 127, j === m);
  for (let i = 1; i <= n; i++) {
    const ca = a.charCodeAt(i - 1) & 127;
    const quitaA = quitarEn(ca, i === n);
    ahora[0] = antes[0] + quitaA;
    for (let j = 1; j <= m; j++) {
      const cb = b.charCodeAt(j - 1) & 127;
      let v = antes[j - 1] + COSTO_EN[ca * 128 + cb];
      const x = antes[j] + quitaA;
      if (x < v) v = x;
      const y = ahora[j - 1] + quitarEn(cb, j === m);
      if (y < v) v = y;
      if (i > 1 && j > 1 && ca === (b.charCodeAt(j - 2) & 127) && (a.charCodeAt(i - 2) & 127) === cb && antes2[j - 2] + 0.5 < v) v = antes2[j - 2] + 0.5;
      ahora[j] = v;
    }
    const t = antes2;
    antes2 = antes;
    antes = ahora;
    ahora = t;
  }
  return antes[m];
}

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const claveDe = (t: string, lengua: LenguaOido) => (lengua === "en" ? claveIngles(t) : claveFonetica(t));

/**
 * Las palabras cortas que arman la frase («the», «to», «de», «la», «casi», «here»): no se cambian por cómo suenan (para
 * ellas están las reglas de arriba); sí pueden juntarse con la que sigue («be twin» → «between», «a gain» → «again»).
 */
const FUNCION: Record<LenguaOido, Set<string>> = {
  en: new Set(
    "a an the to of in on at by for from with and or but if so as is are be was were been it its me my mine i you your we our us they them their he she his her him this that these those there here what which who whom how when where why do does did done can could would should will may might must not no yes up all very more less much many some any just only also too still now then today tomorrow yesterday always never ever well really maybe please thanks okay ok oh hey".split(" "),
  ),
  es: new Set(
    "a al de del el la los las lo le les un una unos unas y o u e en con por para sin que se me mi mis te tu tus su sus nos es son ser fue era como cuando donde cual quien ya no si sí muy mas más menos bien mal casi nuevo nueva nuevos nuevas aqui aquí ahi ahí alla allá asi así tambien también tampoco solo sólo todo toda todos todas nada algo hoy ayer ahora despues después antes luego siempre nunca mucho mucha muchos poco pues bueno este esta esto ese esa eso".split(" "),
  ),
};

/**
 * Palabras comunes que suenan casi como una orden y casi nunca son una mal oída («similar» no es «simulate», «celular» no
 * es «simular», «sombra» no es «siembra»): el parecido no las cambia (las reglas de arriba sí, con lo que va alrededor).
 */
const NUNCA_POR_PARECIDO: Record<LenguaOido, Set<string>> = {
  en: new Set(["similar", "similarly", "cellular", "simple", "simply"]),
  es: new Set(["similar", "similares", "celular", "celulares", "sombra", "sombras", "simple", "simples"]),
};

/** Lo que el dictado separa del comienzo de un verbo («en vía» → «envía», «a paga» → «apaga», «re name» → «rename»). */
const PEDAZO_DEL_VERBO: Record<LenguaOido, RegExp> = {
  es: /^(?:a|e|en|em|o|re|de|des|con|in|im|ex)$/,
  en: /^(?:a|an|re|de|un|in|en|em|be|ex|dis|im)$/,
};

/** El vocabulario de lo que Melki entiende (vocabulario-oido.ts), por largo de la clave: se arma una vez. */
type Entrada = { texto: string; clave: string; primera: number; rango: number };
type Indice = { palabras: Map<number, Entrada[]>; pares: Map<number, Entrada[]>; todas: Set<string> };
const INDICE: Partial<Record<LenguaOido, Indice>> = {};
function indiceDe(lengua: LenguaOido): Indice {
  const ya = INDICE[lengua];
  if (ya) return ya;
  const indice: Indice = { palabras: new Map(), pares: new Map(), todas: new Set() };
  const poner = (mapa: Map<number, Entrada[]>, texto: string, rango: number) => {
    const clave = claveDe(texto.replace(/\s+/g, ""), lengua);
    if (clave.length < 2) return;
    const lista = mapa.get(clave.length) ?? [];
    lista.push({ texto, clave, primera: clave.charCodeAt(0) & 127, rango });
    mapa.set(clave.length, lista);
  };
  const palabras = (lengua === "en" ? PALABRAS_EN : PALABRAS_ES).split(" ");
  palabras.forEach((w, i) => {
    indice.todas.add(sinTildes(w));
    poner(indice.palabras, w, i);
  });
  for (const p of (lengua === "en" ? PARES_EN : PARES_ES).split("|")) if (p) poner(indice.pares, p, palabras.length);
  INDICE[lengua] = indice;
  return indice;
}
/** ¿Melki conoce esa palabra (está en el vocabulario de sus órdenes)? */
const enVocabulario = (w: string, lengua: LenguaOido) => indiceDe(lengua).todas.has(sinTildes(w));
/** ¿Dos claves pueden ser la misma palabra por cómo empiezan? (mismo sonido, sonidos que se confunden, o una vocal) */
const mismoComienzo = (a: number, b: number, lengua: LenguaOido) =>
  a === b || VOCAL[a] === 1 || VOCAL[b] === 1 || a === 121 || b === 121 || (lengua === "en" ? COSTO_EN[a * 128 + b] <= 0.7 : distanciaFonetica(String.fromCharCode(a), String.fromCharCode(b)) <= 0.7);

/**
 * Lo del vocabulario de Melki que más se parece por cómo suena a lo dicho (hasta tres), con su parecido (0 a 1). Las
 * palabras cortas solo valen si suenan igual; las largas aceptan más diferencias. `conPares`: también dos palabras
 * seguidas («road slayer» → «roads layer»); `estricto`: lo dicho ya es una palabra que Melki conoce («see» → «seed»).
 */
function parecidas(dicho: string, lengua: LenguaOido, conPares: boolean, estricto: boolean): { texto: string; parecido: number; rango: number }[] {
  const k = claveDe(dicho.replace(/\s+/g, ""), lengua);
  const n = k.length;
  if (n < 2 || (n === 2 && estricto)) return [];
  // Dos palabras juntas o partidas de otro modo solo si suenan casi igual («be twin» → «between», «road slayer» →
  // «roads layer»; no «arcade was» → «area does»); una palabra corta, con un solo sonido confundido («mess» → «mesh»,
  // «safe» → «save»)
  const umbral = estricto ? 0.86 : Math.max(conPares ? 0.85 : 0, (n === 2 ? 0.83 : n === 3 ? 0.79 : n === 4 ? 0.8 : n <= 6 ? 0.78 : 0.74) + (lengua === "es" ? 0.04 : 0));
  const primera = k.charCodeAt(0) & 127;
  const salida: { texto: string; parecido: number; rango: number }[] = [];
  const indice = indiceDe(lengua);
  const distancia = lengua === "en" ? distanciaIngles : distanciaFonetica;
  for (const mapa of conPares ? [indice.palabras, indice.pares] : [indice.palabras]) {
    for (let largo = Math.max(2, n - (estricto ? 1 : 2)); largo <= n + (estricto ? 1 : 2); largo++) {
      const tope = (1 - umbral) * Math.max(n, largo);
      // Cada letra de más o de menos cuesta al menos 0,3
      if (Math.abs(largo - n) * 0.3 > tope) continue;
      for (const e of mapa.get(largo) ?? []) {
        if (!mismoComienzo(primera, e.primera, lengua) || e.texto === dicho) continue;
        const d = distancia(k, e.clave);
        if (d <= tope) salida.push({ texto: e.texto, parecido: 1 - d / Math.max(n, largo), rango: e.rango });
      }
    }
  }
  // Entre las que suenan parecido, primero las más usadas en las órdenes («mess» → «mesh» antes que «homes»)
  return salida.sort((a, b) => puntaje(b) - puntaje(a)).slice(0, 3);
}
const puntaje = (x: { parecido: number; rango: number }) => x.parecido - 0.03 * Math.log2(1 + x.rango / 50);

/** Dos palabras de la misma familia («simulator» y «simulate», «lower» y «lowest»): cambiar una por otra no es oír mal. */
const mismaRaiz = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 5 || (i >= 4 && Math.min(a.length, b.length) <= 6);
};

/**
 * ¿La versión sigue pareciendo una orden de Melki? Si quedan varias palabras que Melki no conoce («the simulate in the
 * arcade was fun»), cambiar una palabra por cómo suena no la volvió una orden: es charla. Los nombres de los nodos, lo
 * que va entre comillas y los nombres nuevos («rename it to Loma Alta») no cuentan.
 */
export function pareceOrdenDeMelki(texto: string, lengua: LenguaOido, nombres: string[] = []): boolean {
  if (/\b(?:rename|name|named|call|called|renombr\w*|nombre|llama\w*|llamad[oa])\b/i.test(texto)) return true;
  const zonas = zonasIntocables(texto, nombres);
  let contenido = 0;
  let desconocidas = 0;
  for (const m of texto.matchAll(/\p{L}+(?:'\p{L}+)?/gu)) {
    const i = m.index ?? 0;
    const w = sinTildes(m[0]);
    if (w.length < 3 || FUNCION[lengua].has(w) || zonas.some(([a, b]) => i >= a && i < b)) continue;
    contenido++;
    if (!enVocabulario(w, lengua)) desconocidas++;
  }
  return desconocidas < 2 || desconocidas / contenido <= 0.34;
}

/* ───────────── Las variantes ───────────── */

type Cambio = { inicio: number; fin: number; por: string; costo: number; dicho: string; generico?: boolean; parecido?: boolean };

/**
 * Los nombres de los nodos en minúsculas y sin tildes, una vez por lista (con miles de personas pobladas, normalizarlos en
 * cada versión que se prueba tardaría segundos).
 */
const NOMBRES_NORMALIZADOS = new WeakMap<string[], string[]>();
function nombresNormalizados(nombres: string[]): string[] {
  let n = NOMBRES_NORMALIZADOS.get(nombres);
  if (!n) {
    n = nombres.map((x) => sinTildes(x).trim());
    NOMBRES_NORMALIZADOS.set(nombres, n);
  }
  return n;
}

/** Lo que no se toca: lo que va entre comillas y los nombres de los nodos del mapa. */
function zonasIntocables(texto: string, nombres: string[]): [number, number][] {
  const zonas: [number, number][] = [];
  for (const m of texto.matchAll(/["“«][^"”»]*["”»]/g)) zonas.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  const bajo = sinTildes(texto);
  for (const n of nombresNormalizados(nombres)) {
    // (solo los que están en lo dicho: con miles de nodos, armar una expresión por cada uno sería lento)
    if (n.length < 2 || !bajo.includes(n)) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^\\p{L}\\p{N}])`, "gu");
    for (const m of bajo.matchAll(re)) {
      const i = (m.index ?? 0) + m[1].length;
      // «add a repeater 2 km north» no nombra al «Repeater 2»: el número es de la distancia
      if (/\d$/.test(n) && /^\s*(?:km|kms|kilomet|kil[oó]met|met(?:er|re|ro)s?\b|m\b|mts?\b|miles?\b|millas?\b|mi\b|feet\b|foot\b|ft\b|pies\b|yards?\b|yardas?\b|blocks?\b|cuadras?\b)/.test(bajo.slice(i + m[2].length))) continue;
      zonas.push([i, i + m[2].length]);
    }
  }
  return zonas;
}

/** Los cambios posibles en lo dicho (cada uno por su cuenta; después se combinan). */
function cambiosPosibles(texto: string, lengua: LenguaOido, nombres: string[], seguras: boolean): Cambio[] {
  const zonas = zonasIntocables(texto, nombres);
  const libre = (i: number, f: number) => !zonas.some(([a, b]) => i < b && f > a);
  const cambios: Cambio[] = [];
  const agregar = (c: Cambio) => {
    if (c.por.trim().toLowerCase() === c.dicho.trim().toLowerCase() || !libre(c.inicio, c.fin)) return;
    const igual = cambios.find((x) => x.inicio === c.inicio && x.fin === c.fin && x.por.toLowerCase() === c.por.toLowerCase());
    if (igual) igual.costo = Math.min(igual.costo, c.costo);
    else cambios.push(c);
  };
  for (const r of lengua === "en" ? [...REGLAS_EN, ...CORTAS_EN] : REGLAS_ES) {
    if (r.segura !== seguras) continue;
    const global = r.re.flags.includes("g");
    const re = new RegExp(r.re.source, global ? r.re.flags : `${r.re.flags}g`);
    for (const m of texto.matchAll(re)) {
      const inicio = m.index ?? 0;
      const fin = inicio + m[0].length;
      // Con los grupos de la coincidencia («$1add»): lo que mira antes o después no está en m[0]
      const grupos = [...m] as string[];
      const por = typeof r.por === "string" ? r.por.replace(/\$(\d)/g, (_x, k: string) => grupos[Number(k)] ?? "") : r.por(...grupos);
      agregar({ inicio, fin, por, costo: r.costo, dicho: m[0], generico: r.corta });
      if (!global) break;
    }
  }
  // «Person to», «Repeater won»: el número de un nodo que existe (sin artículo antes: «add a person to the map» es otra cosa)
  // («each repeater to its limit», «send Person 1 to the gateway»: con «to» de preposición sigue un artículo o un pronombre)
  const DESPUES_PREPOSICION = String.raw`(?!\s+(?:the|its|his|her|a|an|my|our|their|your|this|that|these|those|every|each|all|some|any|no|it|them|him|me|us|el|la|los|las|su)\b)`;
  for (const m of texto.matchAll(new RegExp(String.raw`(^|[^\p{L}])((?:repeater|person|pearson|parson|node|tower|antenna|gateway|repetidor|persona|nodo|torre|antena)\s+)(${NUMEROS_OIDOS_EN}|juan|one|two|three|four|five)\b${DESPUES_PREPOSICION}`, "giu"))) {
    const inicio = (m.index ?? 0) + m[1].length;
    const antes = texto.slice(0, inicio).trimEnd().toLowerCase();
    const pieza = m[2].trim().toLowerCase().replace(/^(?:pearson|parson)$/, "person");
    const numero = NUMERO_EN[m[3].toLowerCase()] ?? { juan: "1", one: "1", two: "2", three: "3", four: "4", five: "5" }[m[3].toLowerCase()] ?? m[3];
    const nombre = `${pieza} ${numero}`;
    const existe = nombresNormalizados(nombres).includes(sinTildes(nombre));
    // «the» sí va con un nombre («delete the Person 1»); con «a», «each», «another»… es otra cosa («add a person to the map»)
    const conArticulo = /\b(?:a|an|another|one|some|each|every|any|all|my|your|our|their|this|that|which|no|per|first|last|new|nearest|closest|second|third|un|una|otro|otra|cada|todo|todos)$/.test(antes);
    const dicho = `${m[2]}${m[3]}`;
    const fin = inicio + m[2].length + m[3].length;
    // Seguro solo si después viene lo que sigue al nombre de un nodo (el final, una cifra, un rumbo, una medida, «by», «to
    // 25»): «move person to Cumaral» es llevar a una persona a Cumaral, no «Person 2 Cumaral» (eso, solo una variante)
    const claroDespues =
      /^\s*(?:$|[.,;:!?)]|-?\d|(?:to|too)\s+(?:the|a|an|its|it)\b|(?:north|south|east|west|northeast|northwest|southeast|southwest|norte|sur|este|oeste|oriente|occidente|km|kms|kilomet\w*|meters?|metres?|m|ft|feet|miles?|metros?|kil[oó]metros?|by|up|down|higher|lower|'s|close|closer|near|nearer|next|beside|toward|towards|at|in|on|onto|into|from|over|under|above|below|and|or|is|was|has|its|handle|hold|holds|support|serve|cover|covers|reach|reaches|connect|see|hear|signal|coverage|height|antenna|a|al|en|con|y|cerca|junto)\b|(?:to|too|two)\s+-?\d)/i.test(texto.slice(fin));
    // («to», «for»… seguidos de otra palabra son la preposición: «move person to Cumaral» no es «Person 2 Cumaral»; con otro
    // «to» o al nombrar, sí es el número: «connect person to to the network», «call repeater to Loma Alta». «Rename
    // repeater to Loma Alta» puede ser el repetidor de siempre: solo una variante)
    const nombrar = /\b(?:call|name|label)\b/i.test(texto.slice(0, inicio));
    const renombrar = nombrar || /\b(?:rename|re\s+name)\b/i.test(texto.slice(0, inicio));
    const segura = !conArticulo && (claroDespues || nombrar || (renombrar && /^\s+(?:to|too|as)\b/i.test(texto.slice(fin))));
    const preposicion = !claroDespues && !renombrar && /^(?:to|too|tu|two|for|fore)$/i.test(m[3]) && /^\s+(?!(?:to|too|into)\b)\p{L}/iu.test(texto.slice(fin));
    if (existe && !preposicion && segura === seguras && nombre !== sinTildes(dicho).replace(/\s+/g, " ").trim()) agregar({ inicio, fin, por: `${m[2].replace(/(?:pearson|parson)/i, "person")}${numero}`, costo: segura ? 0.6 : 0.8, dicho });
  }
  if (seguras) return cambios;
  // Por cómo suena, contra todo lo que Melki entiende: una palabra (o dos seguidas, que el dictado partió o juntó mal) que
  // suena casi como una del vocabulario de sus órdenes («feel» → «fill», «coast» → «cost», «be twin» → «between», «maya» →
  // «malla»). Cuesta más que una regla, y más si lo dicho ya era una palabra que Melki conoce («see» → «seed»: entonces
  // tiene que sonar casi igual y no ser de la misma familia); dos palabras se juntan solo si alguna no la conoce
  // («hasta la» no es «ajústala»)
  const palabras = [...texto.matchAll(/\p{L}+(?:'\p{L}+)?/gu)].map((m) => ({ w: m[0], i: m.index ?? 0, norm: sinTildes(m[0]) }));
  const conocida = palabras.map((p) => FUNCION[lengua].has(p.norm) || enVocabulario(p.norm, lengua));
  for (let k = 0; k < palabras.length; k++) {
    for (let largo = 1; largo <= 2 && k + largo <= palabras.length; largo++) {
      const inicio = palabras[k].i;
      const ultima = palabras[k + largo - 1];
      const fin = ultima.i + ultima.w.length;
      const dicho = texto.slice(inicio, fin);
      // Dos palabras que Melki conoce se juntan solo si la primera es un pedazo que el dictado separa del verbo («en vía» →
      // «envía», «a paga» → «apaga») y lo que queda es ese verbo, casi igual
      const partido = largo === 2 && conocida[k] && conocida[k + 1];
      if ((largo === 2 && (!/^\S+ \S+$/.test(dicho) || (partido && !PEDAZO_DEL_VERBO[lengua].test(palabras[k].norm)))) || !libre(inicio, fin)) continue;
      // (donde una regla ya cambia esas palabras, el parecido no compite: «borra el repetido» es «repetidor», no «repartida»)
      if (cambios.some((c) => !c.generico && c.inicio <= inicio && c.fin >= fin)) continue;
      const norm = sinTildes(dicho);
      if (largo === 1 && FUNCION[lengua].has(norm)) continue;
      if (norm.split(" ").some((w) => NUNCA_POR_PARECIDO[lengua].has(w))) continue;
      const estricto = largo === 1 && conocida[k];
      for (const p of parecidas(norm, lengua, largo === 2, estricto)) {
        const por = sinTildes(p.texto);
        if (por === norm || (estricto && mismaRaiz(norm, por)) || (partido && (p.parecido < 0.95 || !esVerboDeOrden(por, lengua)))) continue;
        const costo = (estricto ? 1.25 : 0.85) + (largo === 2 ? 0.15 : 0) + (1 - puntaje(p)) * 2.5;
        agregar({ inicio, fin, por: p.texto, costo: Math.round(costo * 100) / 100, dicho, generico: true, parecido: true });
      }
    }
  }
  return cambios;
}

/**
 * Las versiones de lo dicho con lo que pudo oírse mal cambiado, de la más probable a la menos (sin la original): hasta
 * tres cambios a la vez, sin tocar los nombres de los nodos ni lo que va entre comillas.
 */
export function variantesOidas(texto: string, lengua: LenguaOido, opciones: { nombres?: string[]; max?: number; maxCambios?: number } = {}): Variante[] {
  const t = texto.replace(/\s+/g, " ").trim();
  if (!t || t.length > 240) return [];
  const cambios = cambiosPosibles(t, lengua, opciones.nombres ?? [], false).sort((a, b) => a.costo - b.costo || a.inicio - b.inicio);
  if (!cambios.length) return [];
  const maxCambios = opciones.maxCambios ?? 3;
  const salida = new Map<string, Variante>();
  // Combinaciones sin cambios que se pisen, de las más baratas a las más caras
  const combinar = (desde: number, elegidos: Cambio[]) => {
    if (elegidos.length) {
      const ordenados = [...elegidos].sort((a, b) => a.inicio - b.inicio);
      let nuevo = "";
      let i = 0;
      for (const c of ordenados) {
        nuevo += t.slice(i, c.inicio) + c.por;
        i = c.fin;
      }
      nuevo = (nuevo + t.slice(i)).replace(/\s+/g, " ").trim();
      const costo = elegidos.reduce((s, c) => s + c.costo, 0) + (elegidos.length - 1) * 0.2;
      const previa = salida.get(nuevo.toLowerCase());
      if (nuevo.toLowerCase() !== t.toLowerCase() && (!previa || previa.costo > costo))
        salida.set(nuevo.toLowerCase(), { texto: nuevo, costo: Math.round(costo * 100) / 100, cambios: ordenados.map((c) => `${c.dicho} → ${c.por}`), generica: ordenados.some((c) => c.generico), porParecido: ordenados.filter((c) => c.parecido).map((c) => [c.dicho, c.por] as [string, string]) });
    }
    if (elegidos.length >= maxCambios) return;
    for (let k = desde; k < cambios.length; k++) {
      const c = cambios[k];
      if (elegidos.some((x) => c.inicio < x.fin && c.fin > x.inicio)) continue;
      combinar(k + 1, [...elegidos, c]);
      if (salida.size > 400) return;
    }
  };
  combinar(0, []);
  return [...salida.values()].sort((a, b) => a.costo - b.costo || a.cambios.length - b.cambios.length).slice(0, opciones.max ?? 48);
}

/**
 * Lo oído con las correcciones seguras hechas (siempre): las unidades y los números junto a una medida («to kilometers»
 * → «2 kilometers», «5 matters» → «5 meters»), el rumbo después de una distancia («2 km nort», «3 km sauce»), las piezas
 * que no se confunden con nada en el simulador («repeat her», «reporter», «the get away», «net work», «cover age») y el
 * número de un nodo que existe («move Person to 1 km north» → «Person 2»). En español, el gateway mal escrito y «kilo
 * metros». Los nombres de los nodos y lo que va entre comillas no se tocan.
 */
export function corregirOido(texto: string, lengua: LenguaOido, nombres: string[] = []): string {
  // Lo dictado es corto: un texto largo pegado en la barra no se corrige (las reglas recorren la frase)
  if (texto.length > 600) return texto;
  let t = texto;
  // Dos pasadas: una corrección puede dejar lista otra («to kilo meters nort» → «2 kilometers north»)
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const cambios = cambiosPosibles(t, lengua, nombres, true).sort((a, b) => a.inicio - b.inicio || b.fin - b.inicio - (a.fin - a.inicio) || a.costo - b.costo);
    if (!cambios.length) break;
    let nuevo = "";
    let i = 0;
    for (const c of cambios) {
      if (c.inicio < i) continue;
      nuevo += t.slice(i, c.inicio) + c.por;
      i = c.fin;
    }
    const siguiente = (nuevo + t.slice(i)).replace(/[ \t]+/g, " ");
    if (siguiente === t) break;
    t = siguiente;
  }
  return t;
}

/* ───────────── ¿Es para Melki? ───────────── */

const ANCLA_EN =
  /\b(?:repeaters?|gateways?|nodes?|antennas?|towers?|mesh|network|coverage|simulat(?:e|es|ed|ion|ions|ing)|signal|terrain|relief|satellite|roads?|layers?|ruler|pencil|kmz|csv|pdf|budget|scenario|example|stress|payments?|whatsapp|lora|meshcore|meshtastic|hops?|links?|sf\s?\d+|melki|optimi[sz]\w*|populat\w*|panels?|heat\s?map|height|elevation|coordinates?|hectares?|kilomet\w*|km|meters?|miles?|feet|ft)\b/i;
const ANCLA_ES =
  /\b(?:repetidor\w*|gateways?|nodos?|antenas?|torres?|malla|red|cobertura|simul\w*|senal|relieve|satelite|vias|capas?|regla|lapiz|kmz|csv|pdf|presupuesto|escenario|ejemplo|estres|pagos?|whatsapp|lora|meshcore|meshtastic|saltos?|enlaces?|sf\s?\d+|melki|optimi\w*|pobla\w*|paneles?|altura|coordenadas?|hectareas?|kilometros?|km|metros?|millas?|pies)\b/i;

/**
 * ¿Lo dicho nombra algo del simulador (una pieza, una capa, una medida, una coordenada, un nodo del mapa)? Sin eso, una
 * frase no se vuelve una orden por cambiar palabras por cómo suenan (la charla cercana, con la barra del asistente
 * abierta, no nombra repetidores ni gateways).
 */
export function anclaDelSimulador(texto: string, lengua: LenguaOido, nombres: string[] = []): boolean {
  const t = sinTildes(corregirOido(texto, lengua, nombres));
  if ((lengua === "en" ? ANCLA_EN : ANCLA_ES).test(t)) return true;
  // Una coordenada o una medida («a 9 m», «2 km», «20 ft», «5°»)
  if (/-?\d{1,2}(?:[.,]\d+)?\s*,?\s*-\d{2,3}(?:[.,]\d+)?/.test(t) || /\b\d+(?:[.,]\d+)?\s*(?:m|km|mts?|ft|mi)(?![a-z])|\d\s*°/.test(t)) return true;
  return nombresNormalizados(nombres).some((n) => n.length >= 3 && t.includes(n));
}

const VERBO_PEDIDO_EN =
  /^(?:(?:hey|hi|ok|okay|so|now|and|please|melki|can you|could you|would you|will you|i want(?: you)? to|i need(?: you)? to|i'd like to|let's)[\s,]+)*(?:add|put|place|move|delete|remove|raise|lower|show|hide|find|take|go|zoom|simulate|run|build|design|make|create|load|open|close|export|save|undo|populate|test|send|rename|select|set|change|turn|switch|give|tell|explain|what|how|where|why|which|is|are|does|do|can|could|bring|drop|lift|optimi[sz]e|calculate|measure|center|connect|seed)\b/i;
const VERBO_PEDIDO_ES =
  /^(?:(?:oye|hola|ok|bueno|ahora|y|por favor|melki|puedes|podrias|quiero|necesito|me gustaria)[\s,]+)*(?:agrega|pon|ponme|ponle|mueve|muevelo|borra|elimina|quita|sube|subelo|baja|bajalo|muestra|muestrame|oculta|busca|llevame|ve|acerca|simula|calcula|arma|disena|crea|carga|abre|cierra|exporta|guarda|deshaz|puebla|prueba|envia|manda|renombra|selecciona|cambia|activa|desactiva|apaga|dime|explica|que|como|cuanto|cuantos|cuantas|donde|por que|cual|optimiza|mide|centra|conecta|siembra|lleva|dale|haz|hazme)\b/;
const PIEZA_EN = /\b(?:repeaters?|gateways?|nodes?|antennas?|towers?|persons?|people|network|mesh|coverage|signal|map|simulation|kilomet\w*|met(?:er|re)s?|miles?|north|south|east|west|height|municipality|department|hectares|area|roads|layers|satellite|terrain|example|budget|cost|lora|meshcore|meshtastic|payments?|messages?|stress)\b/i;
const PIEZA_ES = /\b(?:repetidor\w*|gateways?|nodos?|antenas?|torres?|personas?|gente|red|malla|cobertura|senal|mapa|simulacion|kilometros?|metros?|millas?|norte|sur|este|oeste|oriente|occidente|altura|municipio|departamento|hectareas|area|vias|capas|satelite|relieve|ejemplo|presupuesto|costo|lora|meshcore|meshtastic|pagos?|mensajes?|estres)\b/;

/**
 * ¿Lo dicho parece un pedido para el simulador aunque no se haya entendido? Empieza como un pedido o una pregunta y
 * nombra algo del simulador (en inglés o en español). Así, con la barra abierta, Melki contesta «no le entendí…» o
 * pregunta «¿quiso decir…?» en vez de dejarlo pasar callado (una charla cercana no nombra repetidores ni gateways).
 */
export function pareceParaMelki(texto: string): boolean {
  const t = sinTildes(texto).replace(/[¿?¡!.,;:«»"]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return false;
  const conVerbo = VERBO_PEDIDO_EN.test(t) || VERBO_PEDIDO_ES.test(t);
  const conPieza = PIEZA_EN.test(t) || PIEZA_ES.test(t);
  return conVerbo && conPieza;
}

/** Los verbos de las órdenes en inglés: con ellos empieza una orden, y el parecido no debe crearlos en una charla. */
const VERBO_ORDEN_EN = String.raw`add|put|place|move|delete|remove|raise|lower|show|hide|find|take|go|zoom|simulate|run|build|design|make|create|load|open|close|export|save|undo|populate|test|send|rename|select|set|change|turn|switch|give|tell|explain|bring|drop|lift|optimi[sz]e|calculate|measure|center|centre|connect|seed|start|apply|accept|use|clear|erase|wipe|scatter|spread|point|tilt|aim|fly|duplicate|copy|pick|choose|plan|cover|fill|trash|analy[sz]e|recommend|throw|shift|clone|grab|size|orient|download|kill|ditch|scrap|shut|activate|deactivate|enable|disable|draw|check|reset|restart|stop|cancel|discard|keep|toggle|display|list|count|locate|search|navigate|focus|rotate|swap|replace|attach|link|install|mount|upload|import|print|share|refresh|update|dimension|increase|decrease|reduce|boost|extend|shrink|relocate|drag|push|pull|lay|spin|light|power`;
/** Y en español (sin tildes): el imperativo, el infinitivo y el de «usted», con o sin pronombre pegado. */
const VERBO_ORDEN_ES = String.raw`(?:agrega|agregar|agregue|anade|anadir|anada|pon|poner|ponga|mueve|mover|mueva|borra|borrar|borre|elimina|eliminar|elimine|quita|quitar|quite|sube|subir|suba|baja|bajar|baje|muestra|mostrar|muestre|ensena|ensenar|ensene|oculta|ocultar|oculte|busca|buscar|busque|lleva|llevar|lleve|acerca|acercar|acerque|aleja|alejar|aleje|simula|simular|simule|calcula|calcular|calcule|arma|armar|arme|disena|disenar|disene|crea|crear|carga|cargar|cargue|abre|abrir|abra|cierra|cerrar|cierre|exporta|exportar|exporte|guarda|guardar|guarde|deshaz|deshacer|deshaga|puebla|poblar|pueble|prueba|probar|pruebe|envia|enviar|envie|manda|mandar|mande|renombra|renombrar|renombre|selecciona|seleccionar|seleccione|cambia|cambiar|cambie|activa|activar|active|desactiva|desactivar|desactive|apaga|apagar|apague|enciende|encender|encienda|di|dime|explica|explicar|explique|optimiza|optimizar|optimice|mide|medir|mida|centra|centrar|centre|conecta|conectar|conecte|siembra|sembrar|siembre|da|dale|dar|haz|hacer|haga|empieza|empezar|empiece|arranca|arrancar|arranque|inscribe|inscribir|inscriba|coloca|colocar|coloque|ubica|ubicar|ubique|duplica|duplicar|duplique|apunta|apuntar|apunte|inclina|inclinar|incline|usa|usar|use|aplica|aplicar|aplique|acepta|aceptar|acepte|limpia|limpiar|limpie|dibuja|dibujar|dibuje|cubre|cubrir|cubra|planea|planear|planee|dimensiona|dimensionar|dimensione|gira|girar|gire|rota|rotar|rote|vuelve|volver|vuelva|ve|ir|vaya|vamos|corre|correr|corra|traslada|trasladar|traslade|reubica|reubicar|reubique|llena|llenar|llene|tira|tirar|tire|carga|cargar|ajusta|ajustar|ajuste|analiza|analizar|analice|recomienda|recomendar|recomiende|clona|clonar|clone|copia|copiar|copie|orienta|orientar|oriente|descarga|descargar|descargue|reinicia|reiniciar|reinicie|deten|detener|parar|pare|cancela|cancelar|cancele|descarta|descartar|descarte|cuenta|contar|localiza|localizar|localice|enfoca|enfocar|enfoque|reemplaza|reemplazar|reemplace|instala|instalar|instale|sumale|suma|sumar|aumenta|aumentar|aumente|reduce|reducir|reduzca|extiende|extender|extienda)(?:me|te|le|lo|la|los|las|nos|les|melo|mela|selo|sela|noslo)?`;
const ORDEN_EN = new RegExp(String.raw`^(?:(?:hey|hi|ok|okay|so|now|and|then|please|melki|can you|could you|would you|will you|i want(?: you)? to|i need(?: you)? to|i'd like(?: you)? to|let's|let me|go ahead and|help me)[\s,]+)*(?:${VERBO_ORDEN_EN})\b|^(?:can i|could i|should i|may i|i want to|i need to|i'd like to|we need to|we have to|i have to|i'm going to|we're going to)\s+(?:${VERBO_ORDEN_EN})\b`);
const ORDEN_ES = new RegExp(String.raw`^(?:(?:oye|hola|ok|okey|bueno|listo|vale|ahora|y|entonces|por favor|melki|puedes|podrias|quiero que|necesito que|me gustaria que|ayudame a)[\s,]+)*${VERBO_ORDEN_ES}\b|^(?:(?:oye|hola|ok|okey|bueno|listo|vale|ahora|y|entonces|melki)[\s,]+)*(?:puedo|podemos|podria|podriamos|quiero|queremos|necesito|necesitamos|hay que|tengo que|tenemos que|voy a|vamos a|me gustaria|quisiera|deberia|debo|debemos)\s+${VERBO_ORDEN_ES}\b`);
/** Lo que va antes y no cuenta para ver cómo empieza lo dicho («so», «and», «oye», «bueno», «Melki»…). */
const RELLENO_INICIO = /^(?:(?:hey|hi|ok|okay|so|now|and|then|please|melki|oh|well|um|uh|y|bueno|oye|hola|pues|entonces|listo|vale|ah|eh|mira|fijate)[\s,]+)*/;
/**
 * Lo dicho que empieza como algo que se cuenta (un artículo, un posesivo, un pronombre): «el celular…», «my phone…».
 * («I'd the rivers» no: es «hide the rivers» mal oído.)
 */
const EMPIEZA_CONTANDO: Record<LenguaOido, RegExp> = {
  en: /^(?:the|a|an|my|your|his|her|our|their|its|this|that|these|those|i(?!'d\s+(?:the|all|my|a|an)\b)|you|he|she|we|they|it|there|here|some|no|every|each|both)\b/,
  es: /^(?:el|la|los|las|un|una|unos|unas|mi|mis|tu|tus|su|sus|nuestro|nuestra|nuestros|nuestras|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|yo|ella|ellos|ellas|nosotros|usted|ustedes|eso|esto|hay|aqui|alli|ahi)\b/,
};
/**
 * Un verbo conjugado (lo dicho es una oración: «el celular no tiene cobertura», «celular está sin señal», «the shadow is
 * long»). Con las tildes: «esta torre» no es «está».
 */
const VERBO_CONJUGADO =
  /(?<![\p{L}'])(?:is|are|was|were|isn't|aren't|wasn't|weren't|has|have|had|hasn't|haven't|looks|seems|sounds|feels|works|worked|doesn't|don't|didn't|won't|can't|will|would|should|could|might|must|gets|got|goes|went|keeps|kept|stays|needs|i'm|it's|that's|there's|es|son|era|eran|fue|fueron|será|sería|está|están|estaba|estaban|estuvo|estoy|estamos|tiene|tienen|tenía|tenían|tengo|tenemos|hay|había|hubo|queda|quedó|quedan|quedaron|anda|andan|funciona|funcionan|funcionó|sirve|sirven|llega|llegan|llegó|pasa|pasó|veo|vi|ves|creo|crees|parece|parecen|dice|dijo|dicen|puede|pueden|debe|deben|va|van|iba|voy|vas|soy|somos|gusta|gustan|necesita|necesitan|cae|cayó|sale|salió|salen|viene|vienen|vino|tuvo|hizo|hace|hacen|dio|dan|se)(?![\p{L}'])/u;

const limpioParaVer = (texto: string) => sinTildes(texto).replace(/[¿?¡!.,;:«»"]/g, " ").replace(/\s+/g, " ").trim();

/**
 * ¿Lo dicho empieza como una orden (con el verbo de lo que se pide, en inglés o en español: «add…», «fill…», «sube…»,
 * «puedo quitar…»)? «El celular no tiene cobertura», «the shadow of the tower» o «can the signal reach…?» no: son
 * charla o preguntas.
 */
export function empiezaComoOrden(texto: string): boolean {
  const t = limpioParaVer(texto);
  return Boolean(t) && !esPregunta(texto) && (ORDEN_EN.test(t) || ORDEN_ES.test(t));
}

const ES_VERBO_DE_ORDEN: Record<LenguaOido, RegExp> = { en: new RegExp(`^(?:${VERBO_ORDEN_EN})$`), es: new RegExp(`^${VERBO_ORDEN_ES}$`) };

/** ¿Es el verbo de una orden («fill», «simular», «siembra», «súbelo»)? */
const esVerboDeOrden = (palabra: string, lengua: LenguaOido) => ES_VERBO_DE_ORDEN[lengua].test(limpioParaVer(palabra));

/**
 * ¿Una versión cambiada por cómo suena sirve contra lo que ya se entendía como un tema o como charla? Si lo puesto por
 * parecido es una cosa («palm» por «balm», «gain» por «game», «KMZ»), sí. Si es el verbo de una orden («simular» por
 * «celular», «siembra» por «sombra»), solo si lo dicho ya empezaba como una orden, o si era una orden con el verbo mal
 * oído: no empieza contando algo («el celular…», «la sombra…», «my phone…») ni trae otro verbo conjugado («… no tiene
 * cobertura»), y la versión sí empieza como una orden («feel each repeater to its limit» → «fill…», «subo todos los
 * repetidores a 20 m» → «sube…»).
 */
function parecidaContraTema(v: Variante, dicho: string, lengua: LenguaOido): boolean {
  // (de la misma familia no crea un verbo: «tests» → «test»)
  const creaVerbo = (v.porParecido ?? []).some(([de, por]) => esVerboDeOrden(por, lengua) && !mismaRaiz(sinTildes(de), sinTildes(por)));
  if (!creaVerbo || empiezaComoOrden(dicho)) return true;
  const t = limpioParaVer(dicho).replace(RELLENO_INICIO, "");
  // (lo de después de la primera palabra, con sus tildes; si sigue «de», «sin», «of»…, la primera era una cosa: «sombra
  // de la torre», «celular sin cobertura»)
  const resto = dicho.toLowerCase().replace(/[¿?¡!.,;:«»"]/g, " ").replace(/\s+/g, " ").trim().replace(RELLENO_INICIO, "").replace(/^\S+\s*/, "");
  if (/^(?:de|del|sin|que|y|o|es|son|of|and|or|that|is|are)(?:\s|$)/.test(resto)) return false;
  return !EMPIEZA_CONTANDO[lengua].test(t) && !VERBO_CONJUGADO.test(resto) && empiezaComoOrden(v.texto);
}

/* ───────────── Cuál versión usar ───────────── */

/** Cuánto entiende Melki una frase: 2 una orden (completa o no), 1 una pregunta o un tema del simulador, 0 nada. */
export type Evaluacion<O> = { nivel: 0 | 1 | 2; completa: boolean; orden?: O; frase: string };

/** Una versión de lo dicho que Melki sí entiende, con lo que entendió (la orden y la frase en el español de Melki). */
export type VarianteEntendida<O> = Variante & { nivel: 1 | 2; completa: boolean; frase: string; orden?: O };

/** Se pregunta algo («what is…?», «¿cuántos…?», «how far…»): eso lo contesta el cerebro tal cual. */
export const esPregunta = (t: string) =>
  /\?\s*$|^\s*¿/.test(t) ||
  /^\s*(?:(?:hey|hi|ok|okay|so|melki|oye|bueno)[\s,]+)*(?:what|how|where|why|which|who|whose|is|are|does|do|did|que|qué|como|cómo|cuanto|cuánto|cuantos|cuántos|cuantas|cuántas|donde|dónde|por que|por qué|cual|cuál|quien|quién)\b/i.test(t);

/** Lo que vale una versión: 3 una orden completa, 1.5 una a medias, 1 una pregunta o un tema, 0 nada. */
const valor = <O>(e: Pick<Evaluacion<O>, "nivel" | "completa">) => (e.nivel === 2 ? (e.completa ? 3 : 1.5) : e.nivel);

/**
 * Las versiones de lo dicho (con lo que pudo oírse mal cambiado) que Melki entiende mejor que lo dicho tal cual, de la
 * más probable a la menos: una orden completa gana a una a medias y a una pregunta. `evaluar` dice cuánto entiende
 * Melki una frase; `base`, lo que vale lo dicho tal cual (por defecto, su nivel). Vacío si no hay ninguna.
 */
export function variantesEntendidas<O>(
  texto: string,
  lengua: LenguaOido,
  evaluar: (t: string) => Evaluacion<O>,
  opciones: { nombres?: string[]; base?: number; sirve?: (v: VarianteEntendida<O>) => boolean } = {},
): VarianteEntendida<O>[] {
  const t = texto.trim();
  if (!t || t.length > 200) return [];
  const base = opciones.base ?? evaluar(t).nivel;
  if (base >= 3) return [];
  const salida: VarianteEntendida<O>[] = [];
  let tope = 3.2;
  for (const v of variantesOidas(t, lengua, { nombres: opciones.nombres ?? [], max: 40 })) {
    // Las que cuestan bastante más que la mejor ya no cambian la elección; si la mejor es una orden a medias o una
    // pregunta, se busca un poco más una completa («move repeater 1 2 km nor»: «move…» a medias, «… 2 km north» completa)
    if (v.costo > tope) break;
    // Lo cambiado solo por cómo suena tiene que seguir pareciendo una orden de Melki
    if (v.generica && !pareceOrdenDeMelki(v.texto, lengua, opciones.nombres ?? [])) continue;
    const e = evaluar(v.texto);
    // …y no contesta preguntas: una palabra cambiada por parecido siempre halla algún tema. Tampoco da lo que no es una
    // orden del intérprete (un tour, la voz, el idioma): «turn on the lights» no es «tour on the lights»
    if (e.nivel === 0 || valor(e) <= base || (v.generica && (e.nivel === 1 || e.orden === undefined))) continue;
    // Se muestra («Le entendí: …») con las correcciones seguras hechas, como la entendió Melki («add a repeater», no
    // «add a repeat her»)
    const entendida: VarianteEntendida<O> = { ...v, texto: corregirOido(v.texto, lengua, opciones.nombres ?? []), nivel: e.nivel, completa: e.completa, frase: e.frase, orden: e.orden };
    // (lo que no sirve donde se usa no cuenta para dejar de buscar)
    if (opciones.sirve && !opciones.sirve(entendida)) continue;
    salida.push(entendida);
    tope = Math.min(tope, v.costo + (valor(e) >= 3 ? 0.6 : 1.1));
  }
  return salida.sort((a, b) => valor(b) - valor(a) || a.costo - b.costo);
}

/**
 * Las versiones que conviene usar en vez de lo dicho tal cual. `orden`: la que da lo dicho tal cual (solo se buscan
 * versiones si no hay o está a medias); `respuesta`: lo que contesta el cerebro a lo dicho (si no hay orden). La charla
 * o lo de fuera del simulador que el cerebro reconoce («¿cómo estás, Melki?», «cuéntame un chiste») no se toca; contra
 * una orden a medias o un tema hallado por una palabra suelta («repeater» en «and a repeater 2 km north…») solo gana una
 * orden completa; si no se entendió nada, también una pregunta del simulador, pero solo si lo dicho también era una
 * pregunta («the note is on the table» no es «¿qué es un nodo?»).
 */
export function variantesParaUsar<O>(
  dicho: string,
  lengua: LenguaOido,
  o: { orden: O | null; incompleta: (orden: O) => boolean; respuesta: { noEntendido?: boolean; fueraDeTema?: boolean } | null; evaluar: (t: string) => Evaluacion<O>; nombres?: string[] },
): VarianteEntendida<O>[] {
  if (o.orden && !o.incompleta(o.orden)) return [];
  const r = o.orden ? null : o.respuesta;
  const tema = r !== null && !r.noEntendido && !r.fueraDeTema;
  // La charla que reconoce el cerebro no se toca… salvo que nombre algo del simulador: «recommend sport gateways» no es
  // de deportes (entonces solo vale una orden completa)
  const charla = r !== null && r.fueraDeTema === true && !r.noEntendido;
  if (charla && !anclaDelSimulador(dicho, lengua, o.nombres ?? [])) return [];
  const base = o.orden ? 1.5 : undefined;
  // Lo que ya se entendía como un tema o como charla no se vuelve una orden por una palabra cambiada sin una regla: ni
  // una pregunta («¿está conectada Persona 2?» → «conecta») ni una charla con el verbo de una orden puesto por parecido
  // («el celular no tiene cobertura» → «simular», «la sombra de la torre» → «siembra»). Las reglas sí valen
  const enCharla = tema || charla;
  const pregunta = esPregunta(dicho);
  const sirve = (v: VarianteEntendida<O>) =>
    (!(o.orden || enCharla) || (v.nivel === 2 && v.orden !== undefined && v.completa)) &&
    (v.nivel === 2 || pregunta) &&
    !(enCharla && v.generica && (pregunta || !parecidaContraTema(v, dicho, lengua)));
  return variantesEntendidas(dicho, lengua, o.evaluar, { nombres: o.nombres, base, sirve });
}

/** Qué hacer con las versiones entendidas: preguntar «¿quiso decir…?», confirmar lo que borra, o hacerla. */
export type DecisionOido<O> = { tipo: "dudas"; opciones: VarianteEntendida<O>[] } | { tipo: "confirmar"; variante: VarianteEntendida<O> } | { tipo: "hacer"; variante: VarianteEntendida<O> };

/**
 * Si dos versiones casi igual de probables dicen cosas distintas, se pregunta («¿quiso decir…?»); si la entendida borra
 * o reemplaza algo, se confirma antes («¿lo hago?»); si no, se hace. `clave`: lo que dice una versión (para ver si dos
 * dicen lo mismo con otras palabras); `destructiva`: si una versión borra, reemplaza o deshace algo (con su orden, o sin
 * ella: «under» → «undo»).
 */
export function decidirVariante<O>(vs: VarianteEntendida<O>[], o: { clave: (v: VarianteEntendida<O>) => string; destructiva: (v: VarianteEntendida<O>) => boolean }): DecisionOido<O> | null {
  const v = vs[0];
  if (!v) return null;
  const dudosas = vs.filter((x) => x !== v && x.nivel === v.nivel && x.costo <= v.costo + 0.25 && o.clave(x) !== o.clave(v)).slice(0, 2);
  if (dudosas.length) return { tipo: "dudas", opciones: [v, ...dudosas] };
  if (o.destructiva(v)) return { tipo: "confirmar", variante: v };
  return { tipo: "hacer", variante: v };
}
