// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Cerebro local de Melki: temas con palabras clave y respuestas que usan el estado actual del simulador.
// No envía nada a internet. Más adelante se puede conectar a un modelo de IA (ver variables de entorno).
// Bilingüe: responde en el idioma de la pantalla. Con la pantalla en inglés entiende las preguntas en inglés
// (palabras clave «clavesEn» y frases propias del inglés); si le escriben en español, las entiende como siempre.
import { conMayuscula, decimalLocal, detectarIdioma, fechaLocal, idioma, numeroLocal, porIdioma, tx, type Idioma } from "@/lib/idioma";
import { CLASES, presetEquivalente, presetPorId } from "@/lib/radio/constantes";
import { entornoPorId, ENTORNOS, perdidaEntorno } from "@/lib/radio/entorno";
import { anchosHaz, esDireccional, PATRONES, patronPorId } from "@/lib/radio/patron";
import { consejoRed, type EstadoRed } from "@/lib/radio/estado-red";
import { airePagoMs, bytesDatos, esperaRetransmision, INTENTOS, tiempoEnAireMs } from "@/lib/radio/mensaje";
import { ENERGIA_P1, ESTADOS_USUARIO, ESTRES_MEDIDO, ORDEN_ESTADOS_USUARIO, PAGOS_PERSONA_DIA_TRAMA, TOPE_CICLO_PCT } from "@/lib/radio/estres";
import { FICHA_GATEWAY, PROTOCOLOS } from "@/lib/radio/protocolos";
import { CAPACIDAD_TRAMA, CATALOGO, COTIZADOR, DEPARTAMENTOS_TRAMA, OPERACION_TRAMA, PRECIOS, SF_TRAMA, TERRENOS_TRAMA, unitarioCop, type SfTrama } from "@/lib/radio/trama";
import { esReferencia, resumenRed as resumenParametros } from "@/lib/radio/red";
import { DERECHOS, CREDITO, TITULARIDAD, credito, derechos, titularidad } from "@/lib/autoria";
import type { Antena, Escenario, Parametros, ResultadoSimulacion } from "@/lib/radio/tipos";

import type { ModoApp } from "../simulador/estado";

import { accionAjuste, textoCoberturaUtil, textoRed, type Orden } from "./ordenes";
import { TOURS, type IdTour } from "./tours";

/** «recorrido» empieza el tour indicado; «tours» muestra el menú de tours; «manos-libres» activa la escucha por voz; «acerca» abre la autoría y la licencia. */
export type AccionMelki =
  | "recorrido"
  | "tours"
  | "simular"
  | "ejemplo"
  | "agregar"
  | "inspeccionar"
  | "parametros"
  | "resultados"
  | "kmz"
  | "regla"
  | "orden"
  | "deshacer"
  | "manos-libres"
  | "acerca"
  | "herramientas"
  | "pitch"
  | "recorrido-red"
  | "ajustes-ia"
  | "ajustes-ia-local"
  /* Modelo Melki: decir una orden con las palabras de Melki, contestar un tema, sus ajustes y olvidar lo aprendido */
  | "decir"
  | "tema"
  | "ajustes-modelo"
  | "olvidar-modelo"
  | "corregir-modelo"
  | "descartar"
  /* Cambiar el idioma de la pantalla (el botón para volver al idioma de antes) */
  | "idioma";

/**
 * Con «detalle», la acción se muestra como una opción de menú (título y una línea). Con «parada», el recorrido de la red
 * empieza en ese punto. «frase» es la orden que se dice (acción «decir»), «tema» el tema que se contesta, y «aprende»
 * la frase de la persona que el Modelo Melki recuerda si toca el botón. «idioma»: el idioma que pone la acción «idioma».
 */
export type AccionRespuesta = {
  texto: string;
  accion: AccionMelki;
  orden?: Orden;
  escenario?: Escenario;
  tour?: IdTour;
  detalle?: string;
  parada?: string;
  frase?: string;
  tema?: string;
  aprende?: { frase: string; intencion: string };
  idioma?: Idioma;
};

export type Respuesta = {
  texto: string;
  acciones?: AccionRespuesta[];
  /** Lo que se dice en voz alta, si es distinto de lo escrito (la disculpa no repite en voz lo que oyó: haría eco). */
  voz?: string;
  /** No lo entendió (ni como orden ni como pregunta): la IA local, si está activa, puede intentarlo. */
  noEntendido?: boolean;
  /**
   * Algo fuera del simulador (chistes, el clima, la hora, los saludos y la charla): sin su nombre, el Asistente lo deja
   * pasar (v17.2); con su nombre o por escrito, contesta como siempre.
   */
  fueraDeTema?: boolean;
  /** El tema que contestó y con cuántos puntos (con pocos, el Modelo Melki puede dar una segunda opinión). */
  tema?: string;
  puntos?: number;
};

export type ContextoMelki = {
  antenas: Antena[];
  parametros: Parametros;
  resultado: ResultadoSimulacion | null;
  desactualizado: boolean;
  relieve: "teselas" | "hgt" | "plano";
  /** Modo de la pantalla y estado de la red frente al gateway (modo «Sembrar la malla»). */
  modo?: ModoApp;
  red?: EstadoRed;
  /** Cómo trata Melki a la persona (lo elige en Ajustes del Asistente Melki): «señor», «señora» o sin tratamiento. */
  trato?: "senor" | "senora" | "ninguno";
  /** El pedido llegó por voz (Asistente Melki): si no lo entiende, pide que se lo repitan. */
  porVoz?: boolean;
  /** El municipio que se ve en el centro del mapa («Cumaral (Meta)»), para «¿dónde estamos?». */
  vista?: string | null;
  /** El Modelo Melki: si está activo, cómo le fue en su prueba y cuántas frases aprendió de la persona. */
  modeloMelki?: { activo: boolean; frases?: number; aciertos?: number; ciega?: number; aprendidas: number; intenciones?: number };
  /** v17.3 · El idioma en que vino el mensaje, si ya se sabe (la respuesta sale en el idioma de la pantalla). */
  lengua?: Idioma;
};

/** «señor», «señora» o nada, según el trato elegido (por defecto, señor). En inglés, «sir» o «ma'am». */
const tratoDe = (c: ContextoMelki) => (c.trato === "ninguno" ? "" : c.trato === "senora" ? tx("señora", "ma'am") : tx("señor", "sir"));

/** Ejemplos de lo que sí hace, para retomar el trabajo cuando le piden algo fuera del simulador. */
const EJEMPLOS_RETOMAR = "«hazme una red sostenible en Barranca de Upía de 11.226 hectáreas», «¿cómo está la red?», «¿cuánto cuesta la red?» o «puebla la zona con 250 personas»";
const EJEMPLOS_RETOMAR_EN = "“build me a sustainable network in Barranca de Upía covering 11,226 hectares”, “how is the network doing?”, “how much does the network cost?” or “populate the area with 250 people”";

/**
 * Lo que se sale del simulador (el clima, el fútbol, un chiste, la hora, noticias, recetas…): Melki lo dice con
 * cortesía y retoma el trabajo.
 */
const FUERA_DE_TEMA =
  /\b(chistes?|cuentame algo|cancion\w*|cantame|musica|pelicula\w*|netflix|recetas?|cocinar|cocina\w*|noticias|politic\w*|presidente|elecciones|horoscopo|signo zodiacal|futbol|partido de futbol|el partido|goles?|mundial|seleccion colombia|deportes?|como esta el clima|el clima (de|en|hoy|para)|que tiempo hace|va a llover|pronostico del tiempo|que hora es|la hora actual|que dia es hoy|la fecha de hoy|capital de|traduce\w*|traducir|poema|poesia|novia|novio|amor|enamorad\w*|bitcoin|criptomoneda\w*|dolar hoy|bolsa de valores|tarea de|matematicas|chatgpt|gemini|alexa|siri|youtube|tiktok|instagram|facebook)\b/;

/** Conversar con una IA (Gemini Live, «como ChatGPT»): es del simulador desde la v13, aunque nombre a otros. */
const SOBRE_IA_VOZ = /\b(gemini live|gemini|gpt live|gpt-live|chat ?gpt|vapi|whisper|ai studio|clave de (la )?api|modelo de voz|hablar como (una )?ia|conectar(te)? (a|con) (una|la) ia)\b/;

/** Palabras del simulador: si aparecen, el pedido es de aquí aunque no se haya entendido. */
const DEL_SIMULADOR =
  /\b(red|redes|malla|lapiz|lapicito|pincel|nodos?|antenas?|gateway|repetidor\w*|personas?|gente|cobertura|senal|simul\w*|mapa|enlaces?|saltos?|pagos?|whatsapp|mensajes?|trama|meshcore|mesh|lora|frecuencia\w*|sf\d*|altura|torres?|area|hectareas?|km|kilometros?|municipio|departamento|relieve|terreno|potencia|ganancia|factib\w*|viab\w*|sostenib\w*|costos?|precios?|cuesta|starlink|bateria\w*|solar|paneles?|resultados?|tours?|recorrido|zonas?|estres|carga|capacidad|usuarios?|billeteras?|regla|medir|exporta\w*|kmz|google earth|radio mobile|melki)\b/;

/** Charla corta («¿cómo estás?», «¿qué tal?»): responde con cortesía y vuelve al trabajo. */
const CHARLA = /^(?:(?:hola|oye|hey|buenas|buenos dias|buenas tardes|buenas noches)\s+)?(?:melki\s+)?(?:como (?:estas|te va|te encuentras|amaneciste|has estado|vas)|que tal(?: estas| vas| te va)?|todo bien|como andas)(?:\s+melki)?$/;

/** «¿Me escuchas?», «¿estás ahí?»: confirma que escucha y queda a la orden. */
const ME_ESCUCHAS = /^(?:(?:hola|oye|hey)\s+)?(?:melki\s+)?(?:me (?:escuchas|oyes|entiendes|copias|estas escuchando|estas oyendo)|estas ahi|sigues ahi|hay alguien|estas despierto|funcionas|me lees)(?:\s+melki)?$/;
/** «¿Dónde estamos?», «¿qué municipio es este?»: el municipio que se ve en el mapa. */
const DONDE_ESTAMOS = /\b(?:donde (?:estamos|estoy|queda esto|es esto)|en que (?:municipio|departamento|lugar|parte|zona) (?:estamos|estoy|esta el mapa|queda esto|es esto)|que (?:lugar|municipio|zona|pueblo) es (?:este|esta|esto)|que estoy viendo|que estamos viendo)\b/;
/** «Muy bien», «excelente trabajo», «eres el mejor»: agradece con cortesía y sigue. */
const ELOGIO = /^(?:(?:gracias|muchas gracias)\s+)?(?:melki\s+)?(?:muy bien|excelente|buen trabajo|buenisimo|que bien|lo hiciste bien|bien hecho|eres (?:el|la) mejor|eres genial|me gusta|me encanta|increible|espectacular|asi me gusta|te luciste)(?:\s+(?:melki|trabajo|hecho))*$/;
/** «Buenas tardes, Melki» (solo el saludo): se responde igual, como una persona. */
const SALUDO_DEL_DIA = /^(?:(?:hola|hey|oye)\s+)?(buenos dias|buenas tardes|buenas noches)(?:\s+melki)?$/;
const PIDE_HORA = /^(?:melki\s+)?(?:que hora es|que horas son|me dices la hora|me das la hora|dime la hora|la hora)(?:\s+(?:por favor|melki))*$/;
const PIDE_FECHA = /^(?:melki\s+)?(?:que dia es hoy|que fecha es hoy|a que estamos hoy|que dia es|que fecha es|en que fecha estamos)(?:\s+(?:por favor|melki))*$/;

/* ───────────── Lo mismo en inglés (la pantalla en inglés y la pregunta en inglés) ───────────── */
// Se comparan con el texto pasado por normalizarIngles (minúsculas, sin signos, «what's» → «what is»).

const FUERA_DE_TEMA_EN =
  /\b(jokes?|tell me something|tell me a story|songs?|sing|sing me|music|movies?|films?|netflix|recipes?|cook|cooking|news|politics|political|president|elections?|horoscope|zodiac sign|football|soccer|world cup|sports?|how is the weather|what is the weather|what about the weather|the weather (?:in|today|for|like|tomorrow|this)|weather forecast|is it going to rain|will it rain|what time is it|current time|what day is today|today date|capital of|translate\w*|poem|poetry|girlfriend|boyfriend|in love|love you|marry me|dating|bitcoin|crypto\w*|dollar today|stock market|homework|math|maths|mathematics|chatgpt|gemini|alexa|siri|youtube|tiktok|instagram|facebook)\b/;
/** Con estas palabras, «el clima» o «las noticias» sí son del simulador («does the weather affect the signal?»). */
const ES_DEL_SIMULADOR_EN = /\b(network|mesh|nodes?|antennas?|gateway|repeaters?|coverage|signal|simulat\w*|trama|meshcore|lora|payments?|radio mobile|itm|longley|propagation|links?)\b/;
const SOBRE_IA_VOZ_EN = /\b(gemini live|gemini|gpt live|chat ?gpt|vapi|whisper|ai studio|api key|voice model|talk like an ai|speak like an ai|connect (?:you )?(?:to|with) (?:an|the) ai)\b/;
const DEL_SIMULADOR_EN =
  /\b(network|networks|mesh|pencil|brush|freehand|nodes?|antennas?|gateways?|repeaters?|people|persons?|coverage|signal|simulat\w*|map|links?|hops?|payments?|whatsapp|messages?|trama|meshcore|mesh|lora|frequenc\w*|sf\d*|height|towers?|area|hectares?|km|kilometers?|kilometres?|municipalit\w*|department|terrain|relief|power|gain|feasib\w*|viab\w*|sustainab\w*|costs?|prices?|starlink|batter\w*|solar|panels?|results?|tours?|walkthrough|zones?|stress|load|capacity|users?|wallets?|ruler|measure\w*|export\w*|kmz|google earth|radio mobile|melki)\b/;
const CHARLA_EN =
  /^(?:(?:hi|hello|hey|hola|good morning|good afternoon|good evening)\s+)?(?:melki\s+)?(?:how are you(?: doing| today| doing today| feeling)?|how is it going|how are things|how have you been|how do you do|what is up|whats up|sup|are you ok|are you okay|are you well|you ok|you okay|all good|how is your day(?: going)?|how is everything)(?:\s+melki)?$/;
const ME_ESCUCHAS_EN =
  /^(?:(?:hi|hello|hey)\s+)?(?:melki\s+)?(?:can you hear me|do you hear me|can you understand me|do you understand me|are you listening(?: to me)?|are you there|you there|are you still there|still there|is anyone there|is anybody there|anybody there|anyone there|are you awake|are you working|do you copy|can you read me|do you read me)(?:\s+melki)?$/;
const DONDE_ESTAMOS_EN =
  /\b(?:where are we|where am i|where is this|what place is this|which place is this|what town is this|which town is this|what municipality is this|which municipality is this|(?:what|which) (?:municipality|department|place|part|area|town) (?:are we|am i) in|what area is this|what am i looking at|what are we looking at|what am i seeing|what are we seeing)\b/;
const ELOGIO_EN =
  /^(?:(?:thanks|thank you|thank you so much|thanks a lot)\s+)?(?:melki\s+)?(?:very good|very well done|excellent|excellent work|good job|great job|great work|nice work|nice job|good work|well done|nicely done|you are the best|you are great|you are amazing|you are awesome|you rock|awesome|amazing|brilliant|fantastic|impressive|wonderful|superb|i like it|i love it|love it|that is great|that is awesome|that is amazing|i am impressed)(?:\s+(?:melki|job|work|done))*$/;
const SALUDO_DEL_DIA_EN = /^(?:(?:hi|hello|hey)\s+)?(good morning|good afternoon|good evening|good night|morning|evening)(?:\s+melki)?$/;
/** El saludo del día dicho en inglés (de lo que se dijo en español o en inglés). */
const SALUDOS_EN: Record<string, string> = {
  "buenos dias": "Good morning",
  "buenas tardes": "Good afternoon",
  "buenas noches": "Good evening",
  "good morning": "Good morning",
  morning: "Good morning",
  "good afternoon": "Good afternoon",
  "good evening": "Good evening",
  evening: "Good evening",
};
const PIDE_HORA_EN =
  /^(?:melki\s+)?(?:what time is it(?: now| right now)?|what is the time(?: now)?|what is the current time|do you have the time|do you know the time|do you know what time it is|can you tell me the time|could you tell me the time|tell me the time|the time|current time|time)(?:\s+(?:please|melki))*$/;
const PIDE_FECHA_EN =
  /^(?:melki\s+)?(?:what day is it(?: today)?|what day is today|which day is today|what is the date(?: today)?|what is today date|what date is it(?: today)?|what is today|today date|what is the day today|tell me the date|do you know the date|do you know what day it is|the date)(?:\s+(?:please|melki))*$/;
/** ¿Pide hacer algo? («build me…», «put…», «I want you to…»). */
const PIDE_ACCION_EN = /\b(build|design|create|make|put|place|add|cover|move|delete|remove|erase|raise|lower|change|configure|install|set up|i need you to|i want you to|help me|can you help me)\b/;
/** Lo que se pregunta de un nodo nombrado («how is Repeater 3 doing?», «why doesn't Person 1 have signal?»). */
const SOBRE_NODO_EN = /\b(range|route|reach\w*|cover\w*|hops?|area|how is|doing|signal|connect\w*|status|why|path|links?|where is)\b/;

/**
 * El texto en inglés listo para comparar: minúsculas, sin tildes ni signos, con las contracciones abiertas («what's» →
 * «what is», «doesn't» → «does not», también sin apóstrofo, como las escribe el dictado: «whats», «dont») y los
 * guiones entre palabras como espacios («hands-free» → «hands free»). Conserva los puntos de los números y el signo
 * de las coordenadas.
 */
export function normalizarIngles(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/\b(what|how|where|who|when|why|that|there|here|it|he|she)'s\b/g, "$1 is")
    .replace(/\blet's\b/g, "let us")
    .replace(/\bcan't\b|\bcannot\b/g, "can not")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bshan't\b/g, "shall not")
    .replace(/\bain't\b/g, "is not")
    .replace(/\b([a-z]+)n't\b/g, "$1 not")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\b([a-z]+)'re\b/g, "$1 are")
    .replace(/\b([a-z]+)'ve\b/g, "$1 have")
    .replace(/\b([a-z]+)'ll\b/g, "$1 will")
    .replace(/\b([a-z]+)'d\b/g, "$1 would")
    .replace(/\b([a-z0-9]+)'s\b/g, "$1")
    .replace(/\b(what|how|where|who|that|there)s\b/g, "$1 is")
    .replace(/\b(do|does|did|is|are|was|were|have|has|had|could|would|should)nt\b/g, "$1 not")
    .replace(/\bcant\b/g, "can not")
    .replace(/\bwont\b/g, "will not")
    .replace(/\bim\b/g, "i am")
    .replace(/\bive\b/g, "i have")
    .replace(/\byoure\b/g, "you are")
    .replace(/(?<=[a-z])-(?=[a-z])/g, " ")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Lo que escribió está claramente en español? (con la pantalla en inglés, se entiende con las reglas de siempre). */
const pareceEspanol = (t: string) => detectarIdioma(t).idioma === "es";
/**
 * ¿Se entiende como inglés? Con la pantalla en inglés, salvo que esté claramente en español; con la pantalla en español,
 * si está claramente en inglés (v17.3: Melki entiende los dos idiomas siempre). `lengua`: el idioma en que ya se sabe que
 * vino el mensaje (por sus palabras o porque solo así se entiende).
 */
const entenderEnIngles = (t: string, lengua?: Idioma) => ((lengua ?? idioma()) === "en" ? !pareceEspanol(t) : detectarIdioma(t).idioma === "en");

/** «Son las 3:05 de la tarde», como lo diría una persona (con la hora del equipo). En inglés, «It's 3:05 in the afternoon». */
export function horaHablada(d: Date): string {
  const h = d.getHours();
  const h12 = h % 12 || 12;
  if (idioma() === "en") {
    const parteEn = h < 12 ? "in the morning" : h < 18 ? "in the afternoon" : h < 21 ? "in the evening" : "at night";
    return `It's ${h12}:${String(d.getMinutes()).padStart(2, "0")} ${parteEn}`;
  }
  const parte = h < 5 ? "de la madrugada" : h < 12 ? "de la mañana" : h < 19 ? "de la tarde" : "de la noche";
  return `${h12 === 1 ? "Es la" : "Son las"} ${h12}:${String(d.getMinutes()).padStart(2, "0")} ${parte}`;
}

/**
 * No se entendió lo que dijo (sobre todo por voz, cuando el dictado escribe algo sin sentido): se disculpa, dice lo que
 * oyó y pide que se lo repitan, con ejemplos.
 */
export function respuestaNoEntendi(c: ContextoMelki, pregunta: string): Respuesta {
  const s = tratoDe(c);
  const oido = pregunta.trim().replace(/\s+/g, " ").slice(0, 120);
  return {
    noEntendido: true,
    texto: tx(`Discúlpeme${s ? `, ${s}` : ""}, no le entendí bien. ¿Me lo repite, por favor? ${c.porVoz ? `Escuché: «${oido}». ` : ""}Puede decirme, por ejemplo, «ubícame en Barranca de Upía, Meta», «ármame una red que cubra todo el municipio» o «¿cuánto cuesta la red?».`, `I beg your pardon${s ? `, ${s}` : ""}; I didn't quite catch that. Could you repeat it, please? ${c.porVoz ? `I heard: “${oido}”. ` : ""}You can say, for example, “take me to Barranca de Upía, Meta”, “build me a network that covers the whole municipality” or “how much does the network cost?”.`),
    // En voz, solo la disculpa: repetir lo que oyó o los ejemplos haría que el micrófono los volviera a oír
    voz: tx(`Discúlpeme${s ? `, ${s}` : ""}, no le entendí bien. ¿Me lo repite, por favor?`, `I beg your pardon${s ? `, ${s}` : ""}; I didn't quite catch that. Could you repeat it, please?`),
    acciones: [
      { texto: tx("¿Qué puedo decir?", "What can I say?"), accion: "orden", orden: { tipo: "que-hago" } },
      { texto: tx("Ver los tours guiados", "See the tours"), accion: "tours" },
    ],
  };
}

export function respuestaFueraDeTema(c: ContextoMelki): Respuesta {
  const s = tratoDe(c);
  return {
    fueraDeTema: true,
    texto: tx(`${s ? `Mi ${s}, f` : "F"}ui diseñado y creado para cumplir órdenes y procesos dentro de este simulador: diseñar y simular la red MeshCore de Trama, sus nodos, su cobertura, su capacidad y su costo. Eso se sale de lo que puedo hacer, pero con gusto seguimos con la red. Por ejemplo: ${EJEMPLOS_RETOMAR}.`, `${s ? `${conMayuscula(s)}, I` : "I"} was designed and built to carry out orders and processes within this simulator: designing and simulating Trama's MeshCore network, its nodes, its coverage, its capacity and its cost. That falls outside what I can do, but I'll gladly carry on with the network. For example: ${EJEMPLOS_RETOMAR_EN}.`),
    acciones: [
      { texto: tx("¿Qué hago ahora?", "What should I do next?"), accion: "orden", orden: { tipo: "que-hago" } },
      { texto: tx("Ver los tours guiados", "See the tours"), accion: "tours" },
    ],
  };
}

const f = (n: number, d = 1) => decimalLocal(n, d);
/** Pesos redondeados a la manera del documento: «$1.035.000», «$9,4 M» (en inglés, «COP 1,035,000», «9.4 million pesos»). */
const pesos = (v: number) =>
  v >= 2e6
    ? tx(`$${f(v / 1e6, v >= 1e8 ? 0 : 1)} M`, `${f(v / 1e6, v >= 1e8 ? 0 : 1)} million pesos`)
    : tx(`$${(Math.round(v / 1000) * 1000).toLocaleString("es-CO")}`, `COP ${(Math.round(v / 1000) * 1000).toLocaleString("en-US")}`);
const precioDe = (id: string) => {
  const it = CATALOGO.find((x) => x.id === id);
  return it ? unitarioCop(it) : 0;
};

export function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s.-]/g, " ")
    .replace(/\bnodo\s*-?\s*antena(s?)\b/g, "nodo antena$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** «claves» para entender en español; «clavesEn», en inglés (minúsculas y sin tildes, como las deja normalizarIngles). */
type Tema = { id: string; claves: string[]; clavesEn: string[]; responder: (c: ContextoMelki) => Respuesta };

/** Estado de la malla sembrada: personas conectadas, sin cobertura y qué sigue. */
function resumenMalla(c: ContextoMelki): Respuesta | null {
  const red = c.red;
  if (c.modo !== "sembrar" || !red) return null;
  const consejo = consejoRed(red, c.parametros.limiteSaltos);
  const acciones: AccionRespuesta[] = [];
  if (red.alDia && red.sinCobertura.length) acciones.push({ texto: tx("Conectar a los que faltan", "Connect the missing ones"), accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } });
  if (red.alDia && red.conectadas.length) acciones.push({ texto: tx("Enviar un mensaje de prueba", "Send a test message"), accion: "orden", orden: { tipo: "mensaje" } });
  return { texto: tx(`${textoRed(red, c.parametros.limiteSaltos)} ${consejo.paso ? `Paso ${consejo.paso}: ` : ""}${consejo.titulo}. ${consejo.texto}`, `${textoRed(red, c.parametros.limiteSaltos)} ${consejo.paso ? `Step ${consejo.paso}: ` : ""}${consejo.titulo}. ${consejo.texto}`), acciones: acciones.length ? acciones : undefined };
}

function resumenRed(c: ContextoMelki): Respuesta {
  const malla = resumenMalla(c);
  if (malla) return malla;
  const r = c.resultado;
  if (!r) {
    return c.antenas.length
      ? { texto: tx("Todavía no hay una simulación. Pulse Simular y le cuento cómo queda la red.", "There's no simulation yet. Press Simulate and I'll tell you how the network turns out."), acciones: [{ texto: tx("Simular ahora", "Simulate now"), accion: "simular" }] }
      : { texto: tx("Aún no hay antenas en el escenario. Puede ubicarlas en el mapa o cargar el ejemplo para ver cómo funciona.", "There are no antennas in the scenario yet. You can place them on the map or load the example to see how it works."), acciones: [{ texto: tx("Cargar el ejemplo", "Load the example"), accion: "ejemplo" }, { texto: tx("Agregar antena", "Add antenna"), accion: "agregar" }] };
  }
  const fac = r.factibilidad;
  const fallan = fac.criterios.filter((k) => !k.ok).map((k) => k.nombre.charAt(0).toLowerCase() + k.nombre.slice(1));
  let texto = tx(`Resultado: ${fac.titulo.toLowerCase()} (${fac.puntaje}/100). ${textoCoberturaUtil(r)}.`, `Result: ${fac.titulo.toLowerCase()} (${fac.puntaje}/100). ${textoCoberturaUtil(r)}.`);
  if (fallan.length) texto += tx(` Falta cumplir: ${fallan.join("; ")}.`, ` Still to be met: ${fallan.join("; ")}.`);
  if (fac.recomendaciones[0]) texto += tx(` Mi primera sugerencia: ${fac.recomendaciones[0]}`, ` My first suggestion: ${fac.recomendaciones[0]}`);
  if (c.desactualizado) texto += tx(" Ojo: cambió algo después de simular; conviene simular de nuevo.", " Note: something changed after the simulation; it's worth simulating again.");
  const ajuste = c.desactualizado ? null : accionAjuste(r);
  return { texto, acciones: [{ texto: tx("Ver resultados", "See results"), accion: "resultados" }, ...(ajuste ? [ajuste] : [])] };
}

const TEMAS: Tema[] = [
  {
    id: "saludo",
    claves: ["hola", "buenos dias", "buenas tardes", "buenas noches", "buenas", "hey", "saludos", "que tal"],
    clavesEn: ["hello", "hi", "hey", "hi there", "hello there", "greetings", "good morning", "good afternoon", "good evening", "howdy", "hola", "hi melki", "hello melki", "hey melki", "hey there melki", "hola melki"],
    responder: () => ({
      texto: tx("¡Hola! Soy Melki. Siembro con usted la red de Trama, que lleva pagos, mensajes de WhatsApp y consultas a la inteligencia artificial a donde no hay señal (gateway, repetidores y gente), simulo su cobertura sobre el relieve real, pueblo la zona con personas y pruebo cuánto tráfico aguanta cada frecuencia. Pídamelo con sus palabras o le muestro el simulador paso a paso.", "Hello! I'm Melki. Together with you I seed Trama's network, which carries payments, WhatsApp messages and questions to artificial intelligence to places with no signal (gateway, repeaters and people); I simulate its coverage over the real terrain, populate the area with people and test how much traffic each frequency can handle. Ask me in your own words, or I'll show you the simulator step by step."),
      acciones: [{ texto: tx("Ver los tours guiados", "See the tours"), accion: "tours" }],
    }),
  },
  {
    id: "quien",
    claves: ["quien eres", "como te llamas", "que eres", "melki"],
    clavesEn: ["who are you", "what is your name", "your name", "what are you", "melki", "introduce yourself", "tell me about yourself"],
    responder: () => ({
      texto: tx("Soy Melki, el asistente del simulador. Funciono aquí mismo, sin enviar sus datos a ningún servidor. Conozco el modelo de propagación, la red MeshCore de Trama —equipos, precios, capacidad por frecuencia y dimensionamiento por departamento— y cada parte de la pantalla.", "I'm Melki, the simulator's assistant. I run right here, without sending your data to any server. I know the propagation model, Trama's MeshCore network —equipment, prices, capacity per frequency and sizing by department— and every part of the screen."),
    }),
  },
  {
    id: "que-es",
    claves: ["para que sirve", "que hace", "que es esto", "simulador", "como funciona", "como se usa", "como empiezo", "empezar"],
    clavesEn: ["what is it for", "what is this for", "what does it do", "what does this do", "what is this", "simulator", "how does it work", "how does this work", "how do i use it", "how do i use this", "how do i start", "where do i start", "get started", "getting started"],
    responder: () => ({
      texto:
        tx("El simulador planea la red por radio de Trama (MeshCore, LoRa en la banda libre de 915 a 928 MHz) sobre el relieve real: por ella van pagos, mensajes de WhatsApp por texto y consultas a la inteligencia artificial en los lugares sin señal. Tiene dos modos: «Sembrar la malla», el sencillo, donde pone el Gateway + Internet, los repetidores y la gente y le guío paso a paso; y el modo avanzado, con todos los paneles. Al simular ve el nivel de señal con los colores de Radio Mobile, el alcance de cada repetidor, los enlaces de la malla, los saltos hasta el gateway y un veredicto de factibilidad con recomendaciones. Con «Poblar personas» reparte la gente de la zona y con la «Prueba de carga» ve cuántos pagos y mensajes aguanta la frecuencia antes de reventarse. También le dimensiono la red de un departamento con los precios del documento de Trama.", "The simulator plans Trama's radio network (MeshCore, LoRa in the license-free 915 to 928 MHz band) over the real terrain: it carries payments, WhatsApp text messages and questions to artificial intelligence in places with no signal. It has two modes: “Seed the mesh”, the simple one, where you place the Gateway + Internet, the repeaters and the people while I guide you step by step; and Advanced mode, with all the panels. When you simulate, you see the signal level with Radio Mobile's colors, each repeater's range, the mesh links, the hops to the gateway and a feasibility verdict with recommendations. With “Populate people” you spread the area's people around, and with the “Load test” you see how many payments and messages the frequency can handle before it gets overloaded. I can also size the network for a department with the prices from Trama's document."),
      acciones: [{ texto: tx("Ver los tours guiados", "See the tours"), accion: "tours" }],
    }),
  },
  {
    id: "agregar",
    claves: ["agregar antena", "anadir antena", "nueva antena", "poner antena", "ubicar antena", "crear antena", "agregar", "anadir", "ubicar", "como inscribo", "como agrego"],
    clavesEn: ["add antenna", "add an antenna", "new antenna", "put an antenna", "place an antenna", "place antenna", "create antenna", "create an antenna", "add", "place", "how do i add", "how to add", "add a node", "add node", "register a node"],
    responder: () => ({
      texto:
        tx("Yo lo hago por usted: escríbame, por ejemplo, «inscribe un nodo antena llamado Torre Norte en 4.5123, -73.1234 a 15 m». También puede pulsar «Ubicar en el mapa» y hacer clic donde va, o usar «Por coordenadas». El primer nodo antena queda como pasarela.", "I'll do it for you: write to me, for example, “add an antenna node called North Tower at 4.5123, -73.1234 at 15 m”. You can also press “Place on the map” and click where it goes, or use “By coordinates”. The first antenna node becomes the gateway."),
      acciones: [{ texto: tx("Agregar en el mapa", "Add on the map"), accion: "agregar" }],
    }),
  },
  {
    id: "capacidades",
    claves: ["que puedes hacer", "que sabes hacer", "que haces", "comandos", "ordenes", "en que me ayudas", "como me ayudas", "que me puedes ayudar"],
    clavesEn: ["what can you do", "what do you know how to do", "what do you do", "commands", "orders", "how can you help", "how can you help me", "what can you help me with", "what can i ask", "what can i ask you", "what can i say", "what can i tell you", "capabilities", "your capabilities", "what are you capable of", "what are your abilities", "what are you able to do", "what else can you do", "what all can you do", "what do you know how to do", "what can you do for me"],
    responder: () => ({
      texto: [
        tx("Manejo el simulador con sus palabras; puede pedirme varias cosas en un mismo mensaje y todo se puede deshacer. Por ejemplo:", "I run the simulator with your words; you can ask me for several things in one message, and everything can be undone. For example:"),
        tx("• Sembrar la malla: «pon el gateway en Cumaral», «agrega un repetidor a 8 km al norte del gateway», «pon una persona en 4.31, -73.22», «conecta a los que faltan», «envía un pago desde Persona 1», «¿qué hago ahora?».", "• Seed the mesh: “put the gateway in Cumaral”, “add a repeater 8 km north of the gateway”, “put a person at 4.31, -73.22”, “connect the missing ones”, “send a payment from Person 1”, “what should I do next?”."),
        tx("• Gente y capacidad: «puebla la zona con 250 personas», «reparte 1 persona por km² en el área objetivo», «solo donde haya señal», «envía 25 pagos al tiempo», «manda 15 mensajes de WhatsApp en 10 segundos», «¿hasta cuántos pagos aguanta?», «quita las pobladas».", "• People and capacity: “populate the area with 250 people”, “spread 1 person per km² over the target area”, “only where there is signal”, “send 25 payments at once”, “send 15 WhatsApp messages in 10 seconds”, “how many payments can it handle?”, “remove the populated ones”."),
        tx("• Trama: «¿cuánto cuesta la red para el Chocó?», «¿y para todo el país con el 50 % de adopción?», «dimensiona 5.000 usuarios en 800 km² de sabana», «¿cuánto cuesta un repetidor?», «¿qué lleva cada persona?», «¿cuántos usuarios por frecuencia?».", "• Trama: “how much does the network cost for Chocó?”, “and for the whole country with 50% adoption?”, “size 5,000 users over 800 km² of savanna”, “how much does a repeater cost?”, “what does each person carry?”, “how many users per frequency?”."),
        tx("• Diseñar una red: «ármame una malla que cubra 11.226 hectáreas con señal media o mejor en el 99,9 %», «ármame una red de 5 millas a la redonda de Cumaral para 400 familias con un presupuesto de 80 millones», «cubre el área que medí con respaldo». Entiendo km, metros, millas, yardas, pies y cuadras, podo lo que sobra y le doy el veredicto con su costo.", "• Design a network: “build me a mesh that covers 11,226 hectares with fair signal or better over 99.9%”, “build me a network 5 miles around Cumaral for 400 families with a budget of 80 million”, “cover the area I measured with backup”. I understand km, meters, miles, yards, feet and blocks, I prune whatever is left over and I give you the verdict with its cost."),
        tx("• Ajustar la red al mejor costo: «ajústamelo», «hazla factible sin pasar de 20 m», «optimiza el costo», «máximo 2 antenas de apoyo», «no muevas los nodos», «usa el área que medí como área objetivo con el 95 %».", "• Adjust the network for the best cost: “adjust it for me”, “make it feasible without going over 20 m”, “optimize the cost”, “at most 2 support antennas”, “don't move the nodes”, “use the area I measured as the target area at 95%”."),
        tx(
          "• Dibujar la malla y ni una antena de más: «activa el lápiz» y dibuje en el mapa la zona o la línea (la armo ahí con el mejor equilibrio entre señal y costo); «¿necesito más antenas?», «¿sobran antenas?», «¿por qué no pongo más?».",
          "• Draw the mesh, and not one antenna too many: “turn on the pencil” and draw the zone or the line on the map (I build it there with the best balance between signal and cost); “do I need more antennas?”, “are there too many antennas?”, “why not add more?”.",
        ),
        tx("• Varias órdenes seguidas: «pon el gateway en 4.2, -73.37, luego un repetidor a 10 km al este y simula».", "• Several orders in a row: “put the gateway at 4.2, -73.37, then a repeater 10 km to the east and simulate”."),
        tx("• Nodos: «inscribe un nodo antena en 4°30'44\" N 73°07'24\" O a 12 m», «mueve Ejemplo 2 km al sur», «súbelo a 9 m», «sube todos los repetidores a 12 m», «borra todas las personas», «que Repetidor 2 no retransmita», «marca Torre 2 como pasarela».", "• Nodes: “add an antenna node at 4°30'44\" N 73°07'24\" W at 12 m”, “move Example 2 km south”, “raise it to 9 m”, “raise all the repeaters to 12 m”, “delete all the people”, “make Repeater 2 stop retransmitting”, “mark Tower 2 as the gateway”."),
        tx("• Radio: «usa SF10», «la frecuencia a 921,5 MHz», «confiabilidad del 90 %», «usa Longley-Rice», «simula con vegetación densa», «informe del enlace Ejemplo y Torre 2».", "• Radio: “use SF10”, “set the frequency to 921.5 MHz”, “90% reliability”, “use Longley-Rice”, “simulate with dense vegetation”, “link report for Example and Tower 2”."),
        tx("• Mapa, medir y exportar: «muestra las vías», «llévame a Villavicencio», «distancia entre Ejemplo y Torre 2», «perfil de Ejemplo a Torre 2», «¿cuánto cubre el área?», «exporta a Google Earth».", "• Map, measuring and exporting: “show the roads”, “take me to Villavicencio”, “distance between Example and Tower 2”, “profile from Example to Tower 2”, “how big is the area?”, “export to Google Earth”."),
        tx("• Por voz, sin tocar nada: con el «Asistente Melki» (el micrófono junto a mi robot) dígame «pon el gateway en Cumaral»; con mi barra abierta no hace falta llamarme (en reposo, diga «Hola Melki»). Le dejo el mapa libre y le ofrezco los paneles cuando hagan falta.", "• By voice, hands-free: with the “Melki Assistant” (the microphone next to my robot) tell me “put the gateway in Cumaral”; while my bar is open you don't need to call me (on standby, say “Hey Melki”). I leave the map clear for you and offer the panels when they're needed."),
        tx("• Con sus propias palabras: si no lo dice como en estos ejemplos, mi Modelo Melki entiende lo que quiere («móntame una malla que abarque tres millas alrededor de la finca», «métele 400 usuarios al repetidor 2») y, si dudo, le pregunto con botones.", "• In your own words: if you don't say it like these examples, my Melki Model understands what you want (“set me up a mesh that spans three miles around the farm”, “throw 400 users onto repeater 2”) and, if I'm unsure, I ask you with buttons."),
        tx("Si prefiere dictar, toque el micrófono y revise el texto antes de enviarlo. Y si quiere aprender paso a paso, pídame un tour guiado.", "If you'd rather dictate, tap the microphone and review the text before sending it. And if you want to learn step by step, ask me for a guided tour."),
      ].join("\n"),
      acciones: [{ texto: tx("Ver los tours guiados", "See the tours"), accion: "tours" }],
    }),
  },
  {
    id: "diseno",
    claves: ["disenar la red", "disena la red", "cubrir un area", "cubrir el area", "hectareas", "cuantos repetidores necesito", "cuantos repetidores", "planificar la red", "diseno por area", "red para un area"],
    clavesEn: ["design the network", "design a network", "design the mesh", "design a mesh", "cover an area", "cover the area", "hectares", "how many repeaters do i need", "how many repeaters", "plan the network", "design by area", "network for an area", "network design"],
    responder: () => ({
      texto: [
        tx("Puedo diseñar la malla para un área: elijo dónde va el gateway (si aún no hay) y siembro repetidores, uno a uno, donde más área nueva cubren, siempre enlazados a la red (≥ 30 dB) y dentro del límite de saltos, con el relieve real. Al final simulo y le digo cuánto quedó cubierto por clase de señal.", "I can design the mesh for an area: I choose where the gateway goes (if there isn't one yet) and seed repeaters, one by one, where they cover the most new area, always linked to the network (≥ 30 dB) and within the hop limit, over the real terrain. At the end I simulate and tell you how much was covered in each signal class."),
        tx("Dígame el tamaño, la señal y la meta: «ármame una malla que cubra 11.226 hectáreas con señal media o mejor en el 99,9 %». También entiendo «cubre 5 km a la redonda de Cumaral», «un área cuadrada de 2.000 ha», «10 por 12 km», «cubre el área que medí», «con repetidores de 20 m», «máximo 15 repetidores» y «con respaldo» (cada punto con dos nodos).", "Tell me the size, the signal and the goal: “build me a mesh that covers 11,226 hectares with fair signal or better over 99.9%”. I also understand “cover 5 km around Cumaral”, “a square area of 2,000 ha”, “10 by 12 km”, “cover the area I measured”, “with 20 m repeaters”, “at most 15 repeaters” and “with backup” (every point covered by two nodes)."),
        tx("Señal: buena ≥ 45 dB, estable ≥ 37 dB, media ≥ 30 dB, baja ≥ 20 dB; «entre buena, estable y media» es media o mejor. Si no dice dónde, uso el gateway o el centro del mapa que está viendo.", "Signal: good ≥ 45 dB, stable ≥ 37 dB, fair ≥ 30 dB, weak ≥ 20 dB; “between good, stable and fair” means fair or better. If you don't say where, I use the gateway or the center of the map you're looking at."),
      ].join("\n"),
    }),
  },
  {
    id: "nodos",
    claves: ["nodo", "nodos", "nodo antena", "tipo de nodo", "nodo de campo", "diferencia entre nodo y antena", "que es un nodo"],
    clavesEn: ["node", "nodes", "antenna node", "type of node", "node type", "field node", "difference between node and antenna", "what is a node"],
    responder: () => ({
      texto:
        tx("En MeshCore cada equipo de la red es un nodo y su rol dice si retransmite. Aquí hay dos tipos: el nodo antena es infraestructura fija —el repetidor de Trama (SenseCAP Solar Node P1 con antena de 8 dBi en un tubo de 6 m) o el gateway (radios Heltec T114 con antena de 8 dBi en la torre de 12 m)—; pinta la capa de cobertura y forma la malla. El nodo de campo es la billetera de la persona (XIAO ESP32S3 + Wio-SX1262 o T1000-E, a 1,5 m): no pinta cobertura ni retransmite, pero reviso si llega al gateway y en cuántos saltos.", "In MeshCore every device in the network is a node, and its role says whether it retransmits. Here there are two types: the antenna node is fixed infrastructure —Trama's repeater (SenseCAP Solar Node P1 with an 8 dBi antenna on a 6 m pole) or the gateway (Heltec T114 radios with 8 dBi antennas on the 12 m tower)—; it paints the coverage layer and forms the mesh. The field node is the person's wallet (XIAO ESP32S3 + Wio-SX1262 or T1000-E, at 1.5 m): it doesn't paint coverage or retransmit, but I check whether it reaches the gateway and in how many hops."),
    }),
  },
  {
    id: "regla",
    claves: ["regla", "medir distancia", "medir distancias", "medidas", "tomar medidas", "medir area", "area", "trayecto", "hectareas", "perimetro"],
    clavesEn: ["ruler", "measure distance", "measure distances", "measure a distance", "measurements", "take measurements", "measure area", "measure an area", "area", "path", "hectares", "perimeter"],
    responder: () => ({
      texto:
        tx("La regla funciona como en Google Earth: elija Línea (distancia y rumbo), Trayecto (varios puntos) o Área (área y perímetro) y haga clic en el mapa; doble clic o Enter para terminar. Las mediciones quedan guardadas con el escenario: arrastre un punto para moverlo, arrastre el punto medio de un tramo para agregar uno y use clic derecho para borrar un punto. También le muestro el perfil del terreno de cada medición.", "The ruler works like the one in Google Earth: choose Line (distance and bearing), Path (several points) or Area (area and perimeter) and click on the map; double-click or press Enter to finish. The measurements are saved with the scenario: drag a point to move it, drag the midpoint of a segment to add one, and right-click to delete a point. I also show you the terrain profile of each measurement."),
      acciones: [{ texto: tx("Activar la regla", "Turn on the ruler"), accion: "regla" }],
    }),
  },
  {
    id: "lapiz",
    claves: ["lapiz", "lapiz de malla", "lapicito", "pincel", "pincel de malla", "dibujar la malla", "dibujar a mano", "dibujar la zona", "como funciona el lapiz", "como se usa el lapiz", "como uso el lapiz", "para que sirve el lapiz", "para que sirve el pincel", "que es el lapiz", "que hace el lapiz", "como funciona el pincel"],
    clavesEn: ["pencil", "mesh pencil", "brush", "draw the mesh", "draw by hand", "freehand", "draw the zone", "how does the pencil work", "how do i use the pencil", "what is the pencil", "what is the pencil for", "what does the pencil do", "how does the mesh pencil work"],
    responder: () => ({
      texto: tx(
        "El lápiz de malla está en la barra del mapa, junto a la Regla. Actívelo y dibuje sobre el mapa como en Paint, manteniendo presionado: si cierra la figura la tomo como una zona; si traza una línea (una vía, un río, una cerca), como una franja a lo largo de ella del ancho que elija (0,5, 1, 2 o 5 km). Al soltar armo ahí la malla óptima, que no es la de más antenas sino el punto de equilibrio entre la estabilidad de la señal y el costo: señal media o mejor en el 95 % de lo dibujado, enlaces sólidos entre los nodos, sin repetidores que casi no aporten y con lo que cuesta. Si no le gusta, la deshace con un clic.",
        "The mesh pencil is on the map bar, next to the Ruler. Turn it on and draw on the map as in Paint, holding the button down: if you close the shape I take it as a zone; if you trace a line (a road, a river, a fence), as a strip along it as wide as you choose (0.5, 1, 2 or 5 km). When you let go I build the optimal mesh there, which isn't the one with the most antennas but the balance point between signal stability and cost: fair or better signal in 95% of what you drew, solid links between the nodes, no repeaters that barely add anything, and what it costs. If you don't like it, one click undoes it.",
      ),
      acciones: [{ texto: tx("Activar el lápiz", "Turn on the pencil"), accion: "orden", orden: { tipo: "herramienta", herramienta: "lapiz" } }],
    }),
  },
  {
    id: "referencia",
    claves: ["municipios", "departamentos", "rios", "limites", "division", "divisiones", "fuentes hidricas", "quebradas", "cuerpos de agua", "nombres en el mapa", "vias", "carreteras"],
    clavesEn: ["municipalities", "departments", "rivers", "boundaries", "borders", "limits", "division", "divisions", "water sources", "streams", "creeks", "bodies of water", "names on the map", "roads", "highways", "lakes"],
    responder: () => ({
      texto:
        tx("En Capas puede activar los límites y nombres de departamentos y municipios de Colombia (DANE), los ríos y lagos principales, los límites de países, las ciudades y poblados, y las vías. Para quebradas, caños y ríos pequeños con su nombre, cambie el mapa base a OpenTopoMap o Topográfico. Pase el cursor por el mapa y abajo verá las coordenadas y el municipio.", "In Layers you can turn on the boundaries and names of Colombia's departments and municipalities (DANE), the main rivers and lakes, country borders, cities and towns, and roads. For streams, creeks and small rivers with their names, switch the base map to OpenTopoMap or Topographic. Move the cursor over the map and you'll see the coordinates and the municipality at the bottom."),
    }),
  },
  {
    id: "buscar",
    claves: ["buscar", "buscador", "encontrar", "ubicar una coordenada", "ir a una coordenada", "donde queda"],
    clavesEn: ["search", "search box", "find", "find a place", "find a town", "locate a coordinate", "go to a coordinate", "search for a place", "look up"],
    responder: () => ({
      texto:
        tx("Use el buscador de arriba: escriba un municipio, un departamento, el nombre de un nodo o unas coordenadas (decimales o en grados, minutos y segundos). También puede pedírmelo: «llévame a Barranca de Upía» o «ve a 4.5, -73.1». Con clic derecho en el mapa tiene un menú para agregar nodos, medir o ver la señal en ese punto.", "Use the search box at the top: type a municipality, a department, a node name or some coordinates (decimal, or in degrees, minutes and seconds). You can also ask me: “take me to Barranca de Upía” or “go to 4.5, -73.1”. Right-clicking on the map gives you a menu to add nodes, measure or see the signal at that point."),
    }),
  },
  {
    id: "alcance",
    claves: ["rango de alcance", "rango", "contorno", "anillos", "hasta donde llega", "hasta donde alcanza"],
    clavesEn: ["range", "coverage range", "contour", "outline", "rings", "how far does it reach", "how far does it go", "how far can it reach", "how far does the signal reach", "reach"],
    responder: () => ({
      texto:
        tx("Después de simular dibujo el rango de alcance de cada nodo antena: la línea naranja es hasta dónde hay servicio (≥ 20 dB) en cada dirección y la verde, hasta dónde es confiable (≥ 37 dB). Los anillos blancos marcan distancias alrededor del nodo seleccionado. Se activan o desactivan en Capas.", "After simulating I draw the range of each antenna node: the orange line is how far there is service (≥ 20 dB) in each direction, and the green one how far it is reliable (≥ 37 dB). The white rings mark distances around the selected node. You turn them on or off in Layers."),
    }),
  },
  {
    id: "coordenadas",
    claves: ["coordenadas", "gms", "grados minutos", "minutos segundos", "decimal", "latitud", "longitud", "formato", "wgs84"],
    clavesEn: ["coordinates", "coordinate", "dms", "degrees minutes", "minutes seconds", "decimal", "decimal degrees", "latitude", "longitude", "format", "wgs84", "gps"],
    responder: () => ({
      texto:
        tx("Acepto grados decimales (4.5123, -73.1234) y grados, minutos y segundos (4°30'44,3\" N, 73°07'24,2\" O). Use O o W para el oeste y S para el sur. Si pega el par completo en un campo, lleno los dos. Debajo de cada campo muestro la conversión para que la verifique. Todo está en WGS84, el mismo sistema del GPS y de Google Earth.", "I accept decimal degrees (4.5123, -73.1234) and degrees, minutes and seconds (4°30'44.3\" N, 73°07'24.2\" W). Use W (or O) for west and S for south. If you paste the whole pair into one field, I fill in both. Under each field I show the conversion so you can check it. Everything is in WGS84, the same system used by GPS and Google Earth."),
    }),
  },
  {
    id: "mover",
    claves: ["mover", "arrastrar", "editar antena", "cambiar antena", "modificar", "reubicar"],
    clavesEn: ["move", "drag", "edit antenna", "edit an antenna", "change antenna", "change an antenna", "modify", "relocate", "reposition"],
    responder: () => ({
      texto:
        tx("Con la herramienta Mover puede arrastrar cualquier torre en el mapa. Para editar nombre, altura, equipo o rol, haga clic en la antena (en el mapa o en la lista) y se abre su ficha. El ojo de la lista la saca de la simulación sin borrarla.", "With the Pan tool you can drag any tower on the map. To edit the name, height, equipment or role, click on the antenna (on the map or in the list) and its card opens. The eye icon in the list takes it out of the simulation without deleting it."),
    }),
  },
  {
    id: "eliminar",
    claves: ["eliminar", "borrar", "quitar antena", "suprimir"],
    clavesEn: ["delete", "remove", "remove antenna", "remove an antenna", "erase", "get rid of"],
    responder: () => ({ texto: tx("Abra la ficha de la antena (clic sobre ella) y pulse Eliminar al final. Si solo quiere probar sin ella, use el ojo de la lista para excluirla.", "Open the antenna's card (click on it) and press Delete at the bottom. If you just want to try without it, use the eye icon in the list to exclude it.") }),
  },
  {
    id: "simular",
    claves: ["simular", "calcular", "correr", "ejecutar", "actualizar", "recalcular", "procesar"],
    clavesEn: ["simulate", "simulation", "calculate", "run", "execute", "update", "recalculate", "process", "compute"],
    responder: (c) => ({
      texto: tx(`Pulse Simular en la parte baja del panel izquierdo. Con «Simular al cambiar» activo, recalculo solo cuando usted mueve o edita algo. ${c.antenas.length > 6 ? "Con muchas antenas, la resolución Rápida responde mejor mientras ajusta." : ""}`, `Press Simulate at the bottom of the left panel. With “Simulate on change” on, I recalculate automatically whenever you move or edit something. ${c.antenas.length > 6 ? "With many antennas, the Fast resolution responds better while you adjust." : ""}`).trim(),
      acciones: [{ texto: tx("Simular ahora", "Simulate now"), accion: "simular" }],
    }),
  },
  {
    id: "colores",
    claves: ["colores", "leyenda", "verde", "amarillo", "naranja", "rojo", "que significa", "significado"],
    clavesEn: ["colors", "colours", "color", "legend", "green", "yellow", "orange", "red", "what does it mean", "what does that mean", "meaning"],
    responder: (c) =>
      c.modo === "sembrar"
        ? {
            texto: tx("En «Sembrar la malla» cada pieza tiene un aro del color de su conexión con el gateway: turquesa el gateway (con la nube «IA»), verde = conectada (el número es cuántos saltos hasta el gateway), rojo que parpadea = persona sin cobertura, naranja con aro punteado = repetidor que no alcanza la red, ámbar = llega con más saltos que el límite. Las líneas turquesa que avanzan son el flujo de la información hacia el gateway, y el contorno turquesa es hasta dónde llega cada nodo con servicio. Debajo, el color del terreno es la señal: verde oscuro buena, amarillo media, naranja baja y rojo sin servicio.", "In “Seed the mesh” each piece has a ring in the color of its connection to the gateway: turquoise for the gateway (with the “AI” cloud), green = connected (the number is how many hops to the gateway), flashing red = person without coverage, orange with a dotted ring = repeater that doesn't reach the network, amber = reaches it with more hops than the limit. The moving turquoise lines are the flow of information toward the gateway, and the turquoise outline shows how far each node reaches with service. Underneath, the color of the terrain is the signal: dark green good, yellow fair, orange weak and red no service."),
          }
        : {
      texto: tx(`Los colores son el margen de señal sobre la sensibilidad del receptor, con la misma paleta de las simulaciones de Radio Mobile: ${CLASES.map((k) => `${k.nombre.toLowerCase()} ${k.id === "sin" ? "por debajo de 20 dB" : `desde ${k.minimoDb} dB`}`).join(", ")}. Verde oscuro tolera follaje y movimiento; naranja funciona a ratos; rojo no tiene servicio. En Capas → Escala de la señal puede cambiar a dBm, µV o dBµV/m y usar colores arcoíris entre dos niveles o un solo umbral, como en Radio Mobile.`, `The colors are the signal margin over the receiver's sensitivity, with the same palette as the Radio Mobile simulations: ${CLASES.map((k) => `${k.nombre.toLowerCase()} ${k.id === "sin" ? "below 20 dB" : `from ${k.minimoDb} dB`}`).join(", ")}. Dark green tolerates foliage and movement; orange works on and off; red has no service. In Layers → Signal scale you can switch to dBm, µV or dBµV/m and use rainbow colors between two levels or a single threshold, as in Radio Mobile.`),
          },
  },
  {
    id: "margen",
    claves: ["margen", "db", "decibel", "sensibilidad", "dbm", "rssi", "snr"],
    clavesEn: ["margin", "db", "decibel", "decibels", "sensitivity", "dbm", "rssi", "snr", "fade margin"],
    responder: (c) => ({
      texto: tx(`El margen es cuántos dB llega la señal por encima de la sensibilidad del receptor. Con el preset ${presetPorId(c.parametros.preset).nombre} la sensibilidad es ${f(presetPorId(c.parametros.preset).sensibilidadDbm)} dBm. Pedimos al menos 20 dB para servicio y 37 dB para servicio confiable, porque el modelo tiene un error típico de ±5 dB y el follaje, la lluvia y el cuerpo restan señal.`, `The margin is how many dB the signal arrives above the receiver's sensitivity. With the ${presetPorId(c.parametros.preset).nombre} preset the sensitivity is ${f(presetPorId(c.parametros.preset).sensibilidadDbm)} dBm. We ask for at least 20 dB for service and 37 dB for reliable service, because the model has a typical error of ±5 dB, and foliage, rain and the body take signal away.`),
    }),
  },
  {
    id: "presupuesto",
    claves: ["presupuesto", "link budget", "potencia", "ganancia", "cable", "dbi", "perdida del cable"],
    clavesEn: ["budget", "link budget", "power", "gain", "cable", "dbi", "cable loss", "transmit power", "tx power"],
    responder: (c) => {
      const a = c.antenas[0];
      const s = presetPorId(c.parametros.preset).sensibilidadDbm;
      const ej = a ? tx(` Por ejemplo, ${a.nombre}: ${f(a.potenciaDbm, 0)} + ${f(a.gananciaDbi)} − ${f(a.perdidaCableDb)} + ${f(c.parametros.gananciaRxDbi)} − (${f(s)}) = ${f(a.potenciaDbm + a.gananciaDbi - a.perdidaCableDb + c.parametros.gananciaRxDbi - s - c.parametros.perdidaExtraDb)} dB.`, ` For example, ${a.nombre}: ${f(a.potenciaDbm, 0)} + ${f(a.gananciaDbi)} − ${f(a.perdidaCableDb)} + ${f(c.parametros.gananciaRxDbi)} − (${f(s)}) = ${f(a.potenciaDbm + a.gananciaDbi - a.perdidaCableDb + c.parametros.gananciaRxDbi - s - c.parametros.perdidaExtraDb)} dB.`) : "";
      return { texto: tx(`El presupuesto de enlace suma potencia del transmisor y ganancias de las antenas, y resta la pérdida del cable, la pérdida extra y la sensibilidad. Al restarle la pérdida del trayecto queda el margen.${ej}`, `The link budget adds the transmitter power and the antenna gains, and subtracts the cable loss, the extra loss and the sensitivity. Subtracting the path loss from it leaves the margin.${ej}`) };
    },
  },
  {
    id: "presets",
    claves: ["preset", "ajuste de radio", "meshcore", "spreading", "sf", "sf11", "sf10", "sf9", "250 khz", "62,5", "ancho de banda", "velocidad", "modem"],
    clavesEn: ["preset", "radio preset", "radio setting", "meshcore", "spreading", "sf", "sf11", "sf10", "sf9", "250 khz", "62.5", "bandwidth", "speed", "data rate", "modem"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      const trama = ([11, 10, 9] as SfTrama[]).map((sf) => tx(`SF${sf}: un pago ocupa ~${f(SF_TRAMA[sf].segPago, SF_TRAMA[sf].segPago % 1 ? 1 : 0)} s de aire, ${SF_TRAMA[sf].usuariosFrecuencia} usuarios por frecuencia y ${Math.round(SF_TRAMA[sf].factorRadio * 100)} % del alcance`, `SF${sf}: a payment takes ~${f(SF_TRAMA[sf].segPago, SF_TRAMA[sf].segPago % 1 ? 1 : 0)} s of airtime, ${SF_TRAMA[sf].usuariosFrecuencia} users per frequency and ${Math.round(SF_TRAMA[sf].factorRadio * 100)}% of the range`)).join("; ");
      return {
        texto: tx(`El ajuste de radio fija el factor de dispersión (SF) y el ancho de banda: más SF, más alcance pero cada paquete ocupa el aire más tiempo y caben menos pagos y mensajes. Trama usa 250 kHz — ${trama}. La comunidad MeshCore usa canales de 62,5 kHz (más sensibles y más lentos; el de EE. UU. va en 910,525 MHz, fuera de la banda colombiana). Ahora: ${p.nombre}, ${f(p.sensibilidadDbm)} dBm de sensibilidad y ≈ ${f(airePagoMs(p) / 1000)} s de aire por pago a 2 saltos. Todos los nodos de una frecuencia usan el mismo ajuste.`, `The radio preset sets the spreading factor (SF) and the bandwidth: a higher SF means more range, but each packet occupies the air longer and fewer payments and messages fit. Trama uses 250 kHz — ${trama}. The MeshCore community uses 62.5 kHz channels (more sensitive and slower; the US one is at 910.525 MHz, outside the Colombian band). Now: ${p.nombre}, ${f(p.sensibilidadDbm)} dBm of sensitivity and ≈ ${f(airePagoMs(p) / 1000)} s of airtime per payment at 2 hops. All the nodes on a frequency use the same preset.`),
        acciones: [{ texto: tx("Ir a parámetros", "Go to parameters"), accion: "parametros" }],
      };
    },
  },
  {
    id: "frecuencia",
    claves: ["frecuencia", "frecuencias", "915", "920", "928", "902", "ane", "banda", "legal", "regulacion", "resolucion 28", "espectro", "canal", "canales", "slot"],
    clavesEn: ["frequency", "frequencies", "915", "920", "928", "902", "ane", "band", "legal", "regulation", "resolution 28", "spectrum", "channel", "channels", "slot", "ism band", "unlicensed"],
    responder: (c) => ({
      texto: tx(`En Colombia, la ANE (Resolución 000028 de 2026) reconoce el uso libre de 915 a 928 MHz. Trama usa cuatro frecuencias por sitio —${CAPACIDAD_TRAMA.frecuenciasMhz.map((x) => f(x, x % 1 ? 1 : 0)).join(", ")} MHz—, una por cada radio del gateway, para atender cuatro veces más gente en el mismo lugar. Ojo: el documento habla de 902–928 MHz y ~8 canales; las antenas son de 902–928, pero aquí solo vale de 915 a 928 MHz (conviene confirmarlo con el Inge). El ajuste de EE. UU. de MeshCore (910,525 MHz) queda por fuera. La simulación usa ${f(c.parametros.frecuenciaMhz, 3)} MHz; entre 915 y 928 MHz el alcance casi no cambia.`, `In Colombia, the ANE (Resolution 000028 of 2026) recognizes free use from 915 to 928 MHz. Trama uses four frequencies per site —${CAPACIDAD_TRAMA.frecuenciasMhz.map((x) => f(x, x % 1 ? 1 : 0)).join(", ")} MHz—, one for each gateway radio, to serve four times as many people in the same place. Note: the document mentions 902–928 MHz and ~8 channels; the antennas are rated for 902–928, but here only 915 to 928 MHz is allowed (worth confirming with the Inge). MeshCore's US preset (910.525 MHz) is left out. The simulation uses ${f(c.parametros.frecuenciaMhz, 3)} MHz; between 915 and 928 MHz the range hardly changes.`),
      acciones: [{ texto: tx("Ir a parámetros", "Go to parameters"), accion: "parametros" }],
    }),
  },
  {
    id: "lora",
    claves: ["lora", "que es lora", "modulacion lora", "modulacion", "chirp", "espectro ensanchado", "spread spectrum", "factor de dispersion", "spreading factor", "largo alcance"],
    clavesEn: ["lora", "what is lora", "lora modulation", "modulation", "chirp", "spread spectrum", "spreading factor", "long range", "lorawan"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      return {
        texto: tx(`LoRa es la forma de radio de largo alcance y bajo consumo que usan MeshCore y Meshtastic: manda pocos datos (de unos cientos de bits por segundo a unos pocos kb/s, según el factor de dispersión, de SF7 a SF12) pero llega lejos —varios kilómetros con línea de vista— gastando muy poca energía, por eso los repetidores funcionan con un panel solar pequeño. Trama la usa en la banda libre de 915 a 928 MHz. Aquí el preset fija el factor de dispersión, el ancho de banda y la sensibilidad: ahora ${p.nombre}, con SF${p.sf}. A más SF, más alcance y menos velocidad.`, `LoRa is the long-range, low-power radio technique used by MeshCore and Meshtastic: it sends little data (from a few hundred bits per second to a few kb/s, depending on the spreading factor, from SF7 to SF12) but it reaches far —several kilometers with line of sight— using very little energy, which is why the repeaters run on a small solar panel. Trama uses it in the license-free 915 to 928 MHz band. Here the preset sets the spreading factor, the bandwidth and the sensitivity: right now ${p.nombre}, with SF${p.sf}. A higher SF means more range and less speed.`),
        acciones: [{ texto: tx("Ir a parámetros", "Go to parameters"), accion: "parametros" }],
      };
    },
  },
  {
    id: "lluvia",
    claves: ["lluvia", "llueve", "llover", "cuando llueve", "si llueve", "con lluvia", "aguacero", "tormenta", "neblina", "niebla", "humedad", "invierno", "temporada de lluvias"],
    clavesEn: ["rain", "rains", "raining", "rainy", "when it rains", "if it rains", "in the rain", "with rain", "downpour", "storm", "storms", "thunderstorm", "fog", "mist", "humidity", "rainy season", "weather"],
    responder: () => ({
      texto: tx("Sí funciona con lluvia: a 915 MHz el agua del aire casi no atenúa (menos de 0,01 dB por kilómetro aun en un aguacero), así que el alcance no cambia por el clima del día. Lo que sí pesa es el relieve, la vegetación (mojada atenúa un poco más) y la altura de las antenas; y el clima de la región cambia algo la refractividad del aire, que se ajusta en «Clima» (parámetros de Radio Mobile). Las tormentas eléctricas sí son un riesgo para los equipos: las torres llevan polo a tierra.", "Yes, it works in the rain: at 915 MHz the water in the air barely attenuates the signal (less than 0.01 dB per kilometer even in a downpour), so the range doesn't change with the day's weather. What does matter is the terrain, the vegetation (when wet it attenuates a little more) and the height of the antennas; and the region's climate slightly changes the refractivity of the air, which is set in “Climate” (Radio Mobile parameters). Thunderstorms, though, are a risk for the equipment: the towers are grounded."),
    }),
  },
  {
    id: "energia",
    claves: ["energia", "de noche", "por la noche", "en la noche", "noche", "paneles solares", "panel solar", "solar", "sol", "nublado", "sin sol", "bateria", "baterias", "pilas", "autonomia", "electricidad", "luz electrica", "consumo", "dura la bateria", "duran las pilas", "cuanto dura la bateria"],
    clavesEn: ["energy", "power supply", "at night", "during the night", "night", "nighttime", "solar panels", "solar panel", "solar", "sun", "cloudy", "no sun", "without sun", "battery", "batteries", "autonomy", "electricity", "power grid", "consumption", "battery life", "how long does the battery last", "how long do the batteries last", "charging"],
    responder: () => ({
      texto: tx(`Los repetidores son solares: el SenseCAP P1 carga de día sus pilas (cuatro 18650 de unos 3.000 mAh) y de noche funciona con ellas; como un repetidor LoRa gasta muy poco, una noche no le pesa y aguanta varios días nublados seguidos. Las pilas se cambian cada cierto tiempo (≈ ${pesos(60_000)} el juego) y eso ya está en la operación de la red. El gateway, si no hay red eléctrica, lleva un kit solar para el Starlink (≈ 400 W de panel y una batería de ≈ 2 kWh, porque el Starlink gasta 75 a 100 W).`, `The repeaters are solar: the SenseCAP P1 charges its batteries by day (four 18650 cells of about 3,000 mAh) and runs on them at night; since a LoRa repeater uses very little power, one night is no burden and it lasts through several cloudy days in a row. The batteries are replaced every so often (≈ ${pesos(60_000)} per set) and that's already included in the network's operating costs. If there's no power grid, the gateway has a solar kit for the Starlink (≈ 400 W of panels and a ≈ 2 kWh battery, because the Starlink draws 75 to 100 W).`),
    }),
  },
  {
    id: "altura",
    claves: ["altura", "mastil", "elevar", "subir antena", "mas alto", "torre", "metros de altura", "tubo"],
    clavesEn: ["height", "mast", "raise", "raise the antenna", "higher", "taller", "tower", "meters high", "metres high", "pole", "how high"],
    responder: () => ({
      texto: tx(`La altura es lo que más mejora el alcance: despeja la zona de Fresnel sobre el follaje y el relieve. Trama pone el repetidor en un tubo de hierro de 6 m (con herrajes y base, ≈ ${pesos(precioDe("tubo") + precioDe("herrajes") + precioDe("base"))}) y el gateway en una torre arriostrada de 12 m (≈ ${pesos(precioDe("torre"))}), que además separa en vertical las antenas de sus 4 radios. Pruebe subir en pasos de 3 m y compare la cobertura útil; por encima de 30 m hace falta una torre autosoportada, muy costosa: casi siempre sale mejor una loma cercana o un repetidor de apoyo. Pídame «ajústamelo» y comparo esas opciones con el relieve real.`, `Height is what improves range the most: it clears the Fresnel zone above the foliage and the terrain. Trama puts the repeater on a 6 m iron pole (with hardware and base, ≈ ${pesos(precioDe("tubo") + precioDe("herrajes") + precioDe("base"))}) and the gateway on a 12 m guyed tower (≈ ${pesos(precioDe("torre"))}), which also separates the antennas of its 4 radios vertically. Try raising it in 3 m steps and compare the useful coverage; above 30 m you need a self-supporting tower, which is very expensive: a nearby hill or a support repeater almost always works out better. Ask me to “adjust it for me” and I'll compare those options over the real terrain.`),
    }),
  },
  {
    id: "malla",
    claves: ["malla", "mesh", "enlace", "enlaces", "entre antenas", "retransmite", "retransmitir", "red mesh"],
    clavesEn: ["mesh", "link", "links", "between antennas", "retransmit", "retransmits", "relay", "relays", "mesh network", "network links"],
    responder: (c) => {
      const r = c.resultado;
      const base =
        tx("En MeshCore solo los repetidores retransmiten: las billeteras y las radios del gateway (companion) envían y reciben lo suyo. El primer paquete hacia un destino se inunda por los repetidores; el destino devuelve la ruta y desde ahí cada pago o mensaje va directo por ese camino: solo el siguiente repetidor de la ruta lo pasa. Evalúo cada pareja con al menos un repetidor o el gateway: enlace sólido desde 30 dB, inestable entre 20 y 30 dB y sin enlace por debajo de 20 dB (el peor de los dos sentidos).", "In MeshCore only the repeaters retransmit: the wallets and the gateway radios (companions) send and receive their own traffic. The first packet toward a destination is flooded through the repeaters; the destination returns the route, and from then on each payment or message goes directly along that path: only the next repeater on the route passes it on. I evaluate every pair that includes at least one repeater or the gateway: solid link from 30 dB, unstable between 20 and 30 dB and no link below 20 dB (the worse of the two directions).");
      if (!r) return { texto: base };
      const s = r.enlaces.filter((e) => e.clase === "solido").length;
      const i = r.enlaces.filter((e) => e.clase === "inestable").length;
      return { texto: tx(`${base} En este escenario hay ${s} enlaces sólidos y ${i} inestables de ${r.enlaces.length} parejas.`, `${base} In this scenario there are ${s} solid and ${i} unstable links out of ${r.enlaces.length} pairs.`) };
    },
  },
  {
    id: "saltos",
    claves: ["saltos", "hop", "hop limit", "hop_limit", "limite de saltos", "brincos", "flood max"],
    clavesEn: ["hops", "hop", "hop limit", "hop_limit", "hop count", "max hops", "bounces", "flood max", "how many hops", "jumps"],
    responder: (c) => ({
      texto: tx(`En MeshCore la ruta va escrita en el paquete y un mensaje puede pasar hasta por 64 repetidores; el límite de saltos de aquí (${c.parametros.limiteSaltos}) es el del diseño. Trama calcula los pagos a 2 saltos: cada salto más vuelve a ocupar el aire con cada mensaje y su respuesta (en un pago, la orden, el comprobante y el aviso) y sus acuses, así que alarga la espera y le quita capacidad a la frecuencia. Reviso que cada persona y cada repetidor lleguen al gateway dentro de ese límite.`, `In MeshCore the route is written in the packet and a message can go through up to 64 repeaters; the hop limit here (${c.parametros.limiteSaltos}) is the design limit. Trama calculates payments at 2 hops: each extra hop occupies the air again with every message and its reply (for a payment: the order, the receipt and the notice) and their acknowledgments, so it lengthens the wait and takes capacity away from the frequency. I check that every person and every repeater reaches the gateway within that limit.`),
    }),
  },
  {
    id: "pasarela",
    claves: ["pasarela", "gateway", "internet", "starlink", "enlace wifi", "punto a punto", "ubiquiti", "mini pc", "servidor", "nodo principal", "sitio"],
    clavesEn: ["gateway", "internet", "starlink", "wifi link", "point to point", "ubiquiti", "mini pc", "server", "main node", "site", "uplink", "backhaul"],
    responder: (c) => {
      const p = c.antenas.filter((a) => a.pasarela).map((a) => a.nombre);
      return {
        texto: tx(`El gateway (la pasarela) es el sitio con internet; todo pago, WhatsApp o consulta a la IA del campo debe llegar a él. En Trama es una torre arriostrada de 12 m con un mini PC sin ventilador (Intel N100, Linux), un hub USB, una UPS, polo a tierra y hasta 4 radios Heltec T114 —una por frecuencia, como companion por USB— con antena de 8 dBi: ≈ ${pesos(PRECIOS.sitioBase + 4 * PRECIOS.radio)} con su kit solar. El internet entra por Starlink (kit con energía solar ≈ ${pesos(PRECIOS.starlink)} y ${pesos(PRECIOS.starlinkMes)} al mes; el plan comercial de la operación es ${pesos(OPERACION_TRAMA.starlinkMesComercial)}) o por un enlace WiFi punto a punto de 5 GHz (≈ ${pesos(PRECIOS.enlace)} el par) desde un sitio que lo tenga; un Starlink alimenta hasta ${TERRENOS_TRAMA.plano.sitiosPorStarlink} sitios en plano y 1 en selva. El gateway verifica cada pago con el banco, pasa los WhatsApp a internet y lleva la nube «IA», el cerebro de inteligencia artificial que contesta las consultas de la gente; la respuesta (el comprobante, la confirmación o lo que contesta la IA) vuelve por la misma ruta. ${p.length ? `Ahora ${p.length === 1 ? "es" : "son"} gateway: ${p.join(", ")}.` : "Todavía no hay ninguno: póngalo primero."}`, `The gateway is the site with internet; every payment, WhatsApp message or AI question from the field must reach it. In Trama it's a 12 m guyed tower with a fanless mini PC (Intel N100, Linux), a USB hub, a UPS, grounding and up to 4 Heltec T114 radios —one per frequency, as companions over USB— with 8 dBi antennas: ≈ ${pesos(PRECIOS.sitioBase + 4 * PRECIOS.radio)} with its solar kit. Internet comes in through Starlink (kit with solar power ≈ ${pesos(PRECIOS.starlink)} and ${pesos(PRECIOS.starlinkMes)} per month; the operation's business plan is ${pesos(OPERACION_TRAMA.starlinkMesComercial)}) or through a 5 GHz point-to-point WiFi link (≈ ${pesos(PRECIOS.enlace)} per pair) from a site that has it; one Starlink feeds up to ${TERRENOS_TRAMA.plano.sitiosPorStarlink} sites on flat land and 1 in the jungle. The gateway verifies each payment with the bank, passes WhatsApp messages on to the internet and carries the “AI” cloud, the artificial intelligence brain that answers people's questions; the reply (the receipt, the confirmation or the AI's answer) comes back along the same route. ${p.length ? `Current gateway${p.length === 1 ? "" : "s"}: ${p.join(", ")}.` : "There isn't one yet: place it first."}`),
      };
    },
  },
  {
    id: "protocolos",
    claves: ["meshtastic", "mesh tastic", "mestastic", "meshcore o meshtastic", "diferencia entre meshcore", "protocolo", "protocolos", "inundacion administrada", "managed flooding", "client mute", "hop limit", "longfast", "long fast"],
    clavesEn: ["meshtastic", "mesh tastic", "meshtastik", "what is meshcore", "what is meshtastic", "meshcore protocol", "meshcore or meshtastic", "difference between meshcore", "protocol", "protocols", "managed flooding", "client mute", "hop limit", "longfast", "long fast"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      const mc = PROTOCOLOS.meshcore;
      const mt = PROTOCOLOS.meshtastic;
      return {
        texto: [
          tx(`El simulador trabaja con los dos protocolos de malla sobre LoRa; ahora está en ${PROTOCOLOS[p.protocolo].nombre} (${p.nombre}). Se cambia en Parámetros → Radio LoRa, o pídamelo: «cambia a Meshtastic», «usa MeshCore».`, `The simulator works with both mesh protocols over LoRa; right now it's on ${PROTOCOLOS[p.protocolo].nombre} (${p.nombre}). You change it in Parameters → LoRa radio, or ask me: “switch to Meshtastic”, “use MeshCore”.`),
          tx(`MeshCore: ${mc.quienRetransmite.toLowerCase()}. ${mc.ruteo} Cabecera de 2 bytes, carga útil de ${mc.cargaMaxima} B, texto de ${mc.textoMaximo} B (las tildes ocupan 2), acuses de 4 B, hasta ${mc.saltosMax} saltos y 3 reintentos (el último por inundación).`, `MeshCore: ${mc.quienRetransmite.toLowerCase()}. ${mc.ruteo} 2-byte header, ${mc.cargaMaxima} B payload, ${mc.textoMaximo} B of text (accented letters take 2), 4 B acknowledgments, up to ${mc.saltosMax} hops and 3 retries (the last one by flooding).`),
          tx(`Meshtastic: ${mt.quienRetransmite.toLowerCase()}. ${mt.ruteo} Cabecera de 16 bytes, carga útil de ~${mt.cargaMaxima} B, hasta ${mt.saltosMax} saltos (3 por defecto), ${mt.envios} envíos por mensaje directo, y con el canal sobre el ${mt.canalAlertaPct} % recorta posiciones y telemetría.`, `Meshtastic: ${mt.quienRetransmite.toLowerCase()}. ${mt.ruteo} 16-byte header, ~${mt.cargaMaxima} B payload, up to ${mt.saltosMax} hops (3 by default), ${mt.envios} transmissions per direct message, and with the channel above ${mt.canalAlertaPct}% it cuts back positions and telemetry.`),
          tx("En la prueba de popularidad la diferencia pesa: en Meshtastic cada mensaje que se inunda lo repiten muchos equipos (aunque cancelan cuando oyen a otro), así que en zonas con mucha gente el canal se llena antes; con los equipos en CLIENT_MUTE solo repiten los ROUTER y se parece más a MeshCore.", "In the popularity test the difference matters: in Meshtastic every flooded message is repeated by many devices (though they cancel when they hear another one), so in crowded areas the channel fills up sooner; with the devices on CLIENT_MUTE only the ROUTERs repeat and it behaves more like MeshCore."),
        ].join("\n"),
        acciones: [{ texto: p.protocolo === "meshtastic" ? tx("Cambiar a MeshCore", "Switch to MeshCore") : tx("Cambiar a Meshtastic", "Switch to Meshtastic"), accion: "orden", orden: { tipo: "parametros", cambios: { preset: presetEquivalente(c.parametros.preset, p.protocolo === "meshtastic" ? "meshcore" : "meshtastic"), limiteSaltos: Math.min(c.parametros.limiteSaltos, p.protocolo === "meshtastic" ? mc.saltosMax : mt.saltosMax) }, descripcion: tx(`el protocolo a ${p.protocolo === "meshtastic" ? "MeshCore" : "Meshtastic"}`, `the protocol to ${p.protocolo === "meshtastic" ? "MeshCore" : "Meshtastic"}`) } }],
      };
    },
  },
  {
    id: "gateway-medido",
    claves: ["se midio", "midio", "ficha tecnica", "gateway medido", "lo medido", "valores medidos", "datos medidos", "gateway real", "router solar", ...FICHA_GATEWAY.claves],
    clavesEn: ["what was measured", "was measured", "data sheet", "spec sheet", "datasheet", "measured gateway", "measured at the gateway", "measured values", "measured data", "real gateway", "solar router", "field data", ...FICHA_GATEWAY.claves],
    responder: () => {
      const g = FICHA_GATEWAY;
      const ant = g.antenas.map((a) => tx(`${a.nombre} (${a.nodo ? `${a.nodo}, ` : ""}${a.radio}${a.distanciaKm ? `, ${f(a.distanciaKm, 1)} km` : ""}${a.snrDb !== null ? `, SNR ${f(a.snrDb, 1)} dB` : ""}): responde el ${a.respuestaPct} %`, `${a.nombre} (${a.nodo ? `${a.nodo}, ` : ""}${a.radio}${a.distanciaKm ? `, ${f(a.distanciaKm, 1)} km` : ""}${a.snrDb !== null ? `, SNR ${f(a.snrDb, 1)} dB` : ""}): responds ${a.respuestaPct}% of the time`)).join("; ");
      return {
        texto: [
          tx(`La prueba de popularidad puede usar lo medido en ${g.enFrase} (${g.semana}): ${g.equipo}, Meshtastic. Atiende de a uno (~${g.proceso.porMensajeS} s por mensaje; hasta ${g.proceso.peorS} s si la base de datos no responde), con respuestas de hasta ${g.respuestaParte} B por parte.`, `The popularity test can use what was measured at ${g.enFrase} (${g.semana}): ${g.equipo}, Meshtastic. It serves one message at a time (~${g.proceso.porMensajeS} s per message; up to ${g.proceso.peorS} s if the database doesn't respond), with replies of up to ${g.respuestaParte} B per part.`),
          tx(`Tráfico: ${g.picos.dia} mensajes al día entre ${g.nodos.conocidos} equipos (${g.nodos.activos} activos), picos de ${g.picos.minuto} por minuto y ${g.picos.hora} por hora; mensajes de ${g.mensaje.minimo} a ${g.mensaje.maximo} caracteres (mediana ${g.mensaje.mediana}). Canal ocupado del ${g.canalPct.min} al ${g.canalPct.max} % y ${f(g.erroresPct, 1)} % de paquetes con error.`, `Traffic: ${g.picos.dia} messages a day among ${g.nodos.conocidos} devices (${g.nodos.activos} active), peaks of ${g.picos.minuto} per minute and ${g.picos.hora} per hour; messages from ${g.mensaje.minimo} to ${g.mensaje.maximo} characters (median ${g.mensaje.mediana}). Channel busy from ${g.canalPct.min}% to ${g.canalPct.max}% and ${f(g.erroresPct, 1)}% of packets with errors.`),
          tx(`Antenas (últimos 100 sondeos): ${ant}.`, `Antennas (last 100 probes): ${ant}.`),
          tx(`Con eso calibro la curva de entrega por enlace «medida en campo» (cerca de la mitad de los paquetes pasa con SNR de −12 dB) y el perfil de tráfico «${g.medidoEn}». Pídame «prueba la hora pico con lo medido».`, `With that I calibrate the “field-measured” per-link delivery curve (about half of the packets get through at an SNR of −12 dB) and the “${g.medidoEn}” traffic profile. Ask me to “test the peak hour with the measured data”.`),
        ].join("\n"),
        acciones: [{ texto: tx("Probar la hora pico con lo medido", "Test the peak hour with the measured data"), accion: "orden", orden: { tipo: "estres", opciones: { perfil: "medido", pagosPersonaDia: ESTRES_MEDIDO.pagosPersonaDia, horaPicoPct: ESTRES_MEDIDO.horaPicoPct } } }],
      };
    },
  },
  {
    id: "usuarios-prueba",
    claves: ["contorno", "colores de las personas", "persona por persona", "usuario por usuario", "le funciona", "a medias", "con dificultades", "capacidad real", "capacidad maxima real"],
    clavesEn: ["outline", "colors of the people", "person by person", "user by user", "does it work for", "works for them", "partially", "with difficulties", "real capacity", "actual capacity", "maximum real capacity", "who is it not working for", "who does it not work for"],
    responder: () => ({
      texto: [
        tx("En la prueba de estrés evalúo a cada persona: para cada enlace de su ruta (ida y vuelta) la probabilidad de que el paquete pase con su margen, por lo que se perdió en cada nodo de su ruta (choques, mientras transmitía o por cola llena), con los reintentos del protocolo; lo ajusto con lo que completó su zona y con sus propios mensajes simulados.", "In the stress test I evaluate each person: for each link on their route (there and back), the probability that the packet gets through with its margin, combined with what was lost at each node on the route (collisions, while it was transmitting or because of a full queue), with the protocol's retries; I adjust it with what their zone completed and with their own simulated messages."),
        tx(`En el mapa el contorno de cada persona toma el color de su estado, con la paleta de los rangos de señal: ${ORDEN_ESTADOS_USUARIO.map((e) => `${ESTADOS_USUARIO[e].nombre.toLowerCase()} (${ESTADOS_USUARIO[e].descripcion.charAt(0).toLowerCase()}${ESTADOS_USUARIO[e].descripcion.slice(1, -1)})`).join("; ")}.`, `On the map, each person's outline takes the color of their status, with the palette of the signal ranges: ${ORDEN_ESTADOS_USUARIO.map((e) => `${ESTADOS_USUARIO[e].nombre.toLowerCase()} (${ESTADOS_USUARIO[e].descripcion.charAt(0).toLowerCase()}${ESTADOS_USUARIO[e].descripcion.slice(1, -1)})`).join("; ")}.`),
        tx("Y le digo por qué: sin cobertura, más saltos que el límite, señal débil, canal ocupado, choques, cola llena en un nodo, la fila del gateway o espera larga. Con «¿hasta dónde aguanta cada repetidor?» sale la capacidad real: el máximo de personas atendidas (a las que les funciona) al subir la carga.", "And I tell you why: no coverage, more hops than the limit, weak signal, busy channel, collisions, a full queue at a node, the gateway's queue or a long wait. With “how far can each repeater hold up?” you get the real capacity: the maximum number of people served (the ones it works for) as the load goes up."),
      ].join("\n"),
      acciones: [{ texto: tx("¿A quiénes no les funciona?", "Who is it not working for?"), accion: "orden", orden: { tipo: "usuarios-estres", opciones: {} } }],
    }),
  },
  {
    id: "optimizar-carga",
    claves: ["gateway de apoyo", "gateways de apoyo", "getway de apoyo", "optimizar la carga", "red sobrecargada", "sobrecarga", "red estresada", "boton de optimizacion"],
    clavesEn: ["support gateway", "support gateways", "optimize the load", "optimise the load", "overloaded network", "overload", "stressed network", "optimization button", "optimize button", "optimize for this load"],
    responder: () => ({
      texto: [
        tx("Con «Optimizar» (en el resultado de la prueba de estrés, o pidiéndomelo) miro a quién no le funciona y por qué, y pruebo arreglos con la misma carga, paquete por paquete:", "With “Optimize” (in the stress test result, or by asking me) I look at who it isn't working for and why, and I try fixes with the same load, packet by packet:"),
        tx("• Gateways de apoyo: convertir el repetidor de una zona cargada en gateway (con internet), un segundo gateway cerca de la gente que más sufre, o uno en otra frecuencia que se lleva a la gente de esa zona (dos canales que no se estorban).", "• Support gateways: turning the repeater of a loaded zone into a gateway (with internet), a second gateway near the people who struggle the most, or one on another frequency that takes over the people in that zone (two channels that don't get in each other's way)."),
        tx("• Antenas de apoyo para la gente sin cobertura o con señal débil (busco la cadena con el relieve real).", "• Support antennas for people without coverage or with weak signal (I look for the chain over the real terrain)."),
        tx("• Ajustes del protocolo: un ajuste de radio más rápido, en Meshtastic los equipos en CLIENT_MUTE y sin telemetría a la malla, y atender en paralelo en el gateway.", "• Protocol settings: a faster radio preset, in Meshtastic the devices on CLIENT_MUTE and without telemetry to the mesh, and handling messages in parallel at the gateway."),
        tx("Cada propuesta trae el antes y el después (personas atendidas, mensajes completos, canal) y la que combina las que suman; las aplico al mapa con un botón y se pueden deshacer.", "Each proposal shows the before and after (people served, completed messages, channel), plus one that combines those that add up; I apply them to the map with a button and they can be undone."),
      ].join("\n"),
      acciones: [{ texto: tx("Optimizar la red para esta carga", "Optimize the network for this load"), accion: "orden", orden: { tipo: "optimizar", opciones: {} } }],
    }),
  },
  {
    id: "pitch",
    claves: ["pitch", "presentacion", "modelo de negocio", "punto de equilibrio", "capex", "opex", "inversion y operacion", "se paga sola", "comision por pago"],
    clavesEn: ["pitch", "presentation", "business model", "break even", "break even point", "capex", "opex", "investment and operation", "pays for itself", "fee per payment", "commission per payment"],
    responder: () => ({
      texto: [
        tx("En el pitch recorro el mapa con mi robot y presento el modelo de negocio con la red que tenga puesta:", "In the pitch I go around the map with my robot and present the business model with the network you have set up:"),
        tx("• El problema (adultos rurales sin canal digital en el departamento y en el país) y la solución de Trama.", "• The problem (rural adults without a digital channel in the department and in the country) and Trama's solution."),
        tx("• Cada antena: dónde está, a qué altura va y por qué (su enlace, la línea de vista, el área que cubre y la gente que entra por ella).", "• Each antenna: where it is, how high it goes and why (its link, the line of sight, the area it covers and the people who connect through it)."),
        tx("• La cobertura con el relieve real y la capacidad real, persona por persona.", "• The coverage over the real terrain and the real capacity, person by person."),
        tx("• La inversión (CAPEX), la operación al mes (OPEX), el costo por usuario y el punto de equilibrio: la comisión por pago que cubre la red; puede probar la suya y le digo en cuántos meses se recupera.", "• The investment (CAPEX), the monthly operation (OPEX), the cost per user and the break-even point: the fee per payment that pays for the network; you can try your own and I'll tell you in how many months it pays back."),
        tx("• Cómo escala al departamento y al país.", "• How it scales to the department and the country."),
        tx("Se maneja con las flechas, el espacio y Esc, o diciéndome «siguiente», «pausa», «ve a la inversión» o «termina la presentación». Con la IA conectada lo narro con mi voz de IA y respondo preguntas en medio.", "You control it with the arrow keys, the space bar and Esc, or by telling me “next”, “pause”, “go to the investment” or “end the presentation”. With the AI connected, I narrate it with my AI voice and answer questions along the way."),
      ].join("\n"),
      acciones: [{ texto: tx("Empezar el pitch", "Start the pitch"), accion: "pitch" }],
    }),
  },
  {
    id: "recorrido-red",
    claves: ["recorrido", "el recorrido", "recorrido de la red", "recorrido por la red", "explicame la red", "explica la red", "nube", "nubes", "nubecitas", "letrero", "letreros", "punto por punto", "antena por antena", "por que quedo asi"],
    clavesEn: ["walkthrough", "the walkthrough", "network walkthrough", "walk me through the network", "walkthrough of the network", "explain the network", "explain the network to me", "cloud", "clouds", "speech bubble", "bubbles", "sign", "signs", "point by point", "antenna by antenna", "why did it turn out like this", "why did it end up like this"],
    responder: () => ({
      texto: [
        tx("En el recorrido de la red mi robot va por el mapa punto por punto, siguiendo el camino de la señal, y en cada uno sale una nube con lo que escribo:", "In the network walkthrough my robot goes around the map point by point, following the signal's path, and at each point a cloud appears with what I write:"),
        tx("• El gateway: qué se instaló, por qué quedó ahí (en la red, en el terreno y por sus enlaces) y cuántas personas salen por él a internet.", "• The gateway: what was installed, why it ended up there (in the network, on the terrain and because of its links) and how many people reach the internet through it."),
        tx("• Cada repetidor, rama por rama: su equipo y su altura, el suelo frente al resto de la red, el enlace con el que se une (distancia, línea de vista y margen), a quién atiende y si es troncal, de acceso o un punto crítico.", "• Each repeater, branch by branch: its equipment and height, its ground elevation compared with the rest of the network, the link that joins it (distance, line of sight and margin), whom it serves and whether it's a trunk, an access point or a critical point."),
        tx("• Las personas: cuántas llegan, en cuántos saltos y por cuál repetidor.", "• The people: how many get through, in how many hops and through which repeater."),
        tx("• Lo que falta, con el pedido que lo resuelve, y al final por qué la red quedó así: la estructura, el reparto de la carga, la solidez de los enlaces, la cobertura y el costo de la infraestructura.", "• What's missing, with the request that solves it, and at the end why the network turned out this way: the structure, the load distribution, the strength of the links, the coverage and the cost of the infrastructure."),
        tx("Va un punto a la vez y en voz digo solo lo breve; al terminar le dejo todo escrito aquí. Se maneja con las flechas, el espacio y Esc, o diciéndome «siguiente», «ve al gateway», «¿por qué pusiste el Repetidor 2 ahí?» o «termina el recorrido».", "It goes one point at a time, and by voice I only say the short version; when it ends I leave everything written here. You control it with the arrow keys, the space bar and Esc, or by telling me “next”, “go to the gateway”, “why did you put Repeater 2 there?” or “end the walkthrough”."),
      ].join("\n"),
      acciones: [{ texto: tx("Empezar el recorrido", "Start the walkthrough"), accion: "recorrido-red" }],
    }),
  },
  {
    id: "analista",
    claves: ["como decides", "como disenas", "cuantos repetidores pones", "por que tantos repetidores", "red optima", "sobredimensionada", "freno de rendimiento", "opcion economica", "veredicto", "analisis de la red", "que medidas entiendes", "en millas", "en yardas", "capacidad del gateway", "red economica", "optimo", "optimidad", "mas antenas es mejor", "mas antenas", "antenas de mas", "criterio de optimo"],
    clavesEn: ["how do you decide", "how do you design", "how many repeaters do you put", "why so many repeaters", "optimal network", "oversized", "performance brake", "diminishing returns", "economical option", "cheap option", "verdict", "network analysis", "what units do you understand", "what measurements do you understand", "in miles", "in yards", "gateway capacity", "capacity of the gateway", "economical network", "optimal", "optimality", "more antennas is better", "more antennas", "extra antennas"],
    responder: () => ({
      texto: [
        tx("Diseño como un ingeniero de radio, con el relieve real y el documento de Trama:", "I design like a radio engineer, with the real terrain and Trama's document:"),
        tx("• Entiendo el tamaño en km, metros, millas (terrestres y náuticas), yardas, pies, cuadras (≈ 100 m), hectáreas, acres o millas cuadradas: «ármame una red de 5 millas a la redonda de Cumaral», «10 km de diámetro», «2 × 1 millas», «un cuadrado de 3 km de lado».", "• I understand the size in km, meters, miles (statute and nautical), yards, feet, blocks (≈ 100 m), hectares, acres or square miles: “build me a network 5 miles around Cumaral”, “10 km in diameter”, “2 × 1 miles”, “a square 3 km on each side”."),
        tx("• Siembro cada repetidor donde más área nueva cubre, siempre enlazado a la red; al final podo los que sobran (su área ya la cubren otros) sin bajar de la meta ni debilitar un enlace.", "• I seed each repeater where it covers the most new area, always linked to the network; at the end I prune the extra ones (others already cover their area) without falling below the goal or weakening a link."),
        tx("• Con el freno de rendimiento no pongo un repetidor que cubra casi nada (menos del 0,3 % del área, o menos si pidió una meta muy alta): así la red no crece sin medida por huecos diminutos. Si de verdad necesita la meta, dígame «aunque cueste más».", "• With the diminishing-returns brake I don't place a repeater that covers almost nothing (less than 0.3% of the area, or less if you asked for a very high goal): that way the network doesn't grow out of all proportion because of tiny gaps. If you really need the goal, tell me “even if it costs more”."),
        tx("• Con «para 400 familias» reviso la capacidad del gateway (una radio por cada 150 con SF11, hasta 4 por sitio) y con «con un presupuesto de 80 millones» limito los repetidores a lo que alcanza.", "• With “for 400 families” I check the gateway's capacity (one radio per 150 with SF11, up to 4 per site), and with “with a budget of 80 million” I limit the repeaters to what the budget allows."),
        tx("• Al terminar le doy el veredicto (óptima, viable con reservas o insuficiente), el costo por km² cubierto y recomendaciones acotadas, como la opción económica: menos repetidores por unos puntos de cobertura, con su ahorro.", "• When I finish I give you the verdict (optimal, viable with reservations or insufficient), the cost per km² covered and focused recommendations, such as the economical option: fewer repeaters for a few points less coverage, with its savings."),
        tx(
          "• Óptimo no es la red con más antenas: es el punto entre la estabilidad de la señal y el costo, la meta con la menor cantidad de equipos. Si usted pone un repetidor que casi no suma (lo que cubre ya lo cubren otros y nadie depende de él), se lo digo con números —lo que aporta, lo que cuesta— y le ofrezco quitarlo. Pregúnteme «¿necesito más antenas?» o «¿sobran antenas?» y reviso la red nodo por nodo.",
          "• Optimal isn't the network with the most antennas: it's the balance point between signal stability and cost, the target with the fewest devices. If you place a repeater that barely adds anything (others already cover what it covers and nobody depends on it), I tell you with numbers —what it adds, what it costs— and offer to remove it. Ask me “do I need more antennas?” or “are there too many antennas?” and I'll review the network node by node.",
        ),
      ].join("\n"),
    }),
  },
  {
    id: "modelo-melki",
    claves: ["modelo melki", "red neuronal", "como me entiendes", "como entiendes", "como aprendes", "aprendes de mi", "lo que aprendiste", "olvidar lo aprendido", "tu propio modelo", "tu inteligencia artificial", "tu propia inteligencia"],
    clavesEn: ["melki model", "neural network", "how do you understand me", "how do you understand", "how do you learn", "do you learn from me", "you learn from me", "what you learned", "what have you learned", "forget what you learned", "your own model", "your artificial intelligence", "your own intelligence", "machine learning"],
    responder: (c) => {
      const mm = c.modeloMelki;
      const pct = (x?: number) => (x ? tx(`${(100 * x).toFixed(1).replace(".", ",")} %`, `${(100 * x).toFixed(1)}%`) : "");
      return {
        texto: [
          tx(`Tengo mi propio modelo: el Modelo Melki, una red neuronal pequeña hecha solo para este simulador.${mm?.frases ? ` Aprendió de ${mm.frases.toLocaleString("es-CO")} frases` : " Aprendió de unas cien mil frases"} de cómo se piden las cosas aquí (diseñar la red, poner piezas, probar la carga, mover el mapa, preguntar…), con errores de tecleo, sin tildes y como las escribe el dictado. Tengo uno en español y otro en inglés, y cada mensaje lo entiendo con el del idioma en que me hablan. Corre en el procesador de este equipo en menos de un milisegundo: sin internet, sin tarjeta gráfica y sin descargar nada aparte.`, `I have my own model: the Melki Model, a small neural network built just for this simulator.${mm?.frases ? ` It learned from ${numeroLocal(mm.frases)} English phrases` : " It learned from about a hundred thousand English phrases"} of how things are asked for here (designing the network, placing pieces, testing the load, moving the map, asking questions…), with typos, without apostrophes and the way dictation writes them. I have one in English and another in Spanish, and I understand each message with the one for the language you speak to me in. It runs on this computer's processor in under a millisecond: no internet, no graphics card and nothing extra to download.`),
          tx("Lo uso cuando mis reglas no entienden un pedido: el modelo dice qué se pide, yo saco los datos de sus palabras (la medida, el lugar, el nodo, la plata) y armo la orden, que mi intérprete verifica antes de hacerla. Nunca inventa una cifra ni un lugar. Si no estoy seguro, le pregunto con botones; lo que borra algo siempre se lo confirmo; y lo que no es del simulador, se lo digo.", "I use it when my rules don't understand a request: the model says what is being asked for, I take the data from your words (the measurement, the place, the node, the money) and build the order, which my interpreter checks before carrying it out. It never makes up a figure or a place. If I'm not sure, I ask you with buttons; anything that deletes something, I always confirm with you; and anything outside the simulator, I tell you so."),
          tx(`${mm?.aciertos ? `En su prueba con frases escritas a mano que nunca vio acertó ${pct(mm.ciega ?? mm.aciertos)}. ` : ""}Aprendo de usted: cuando me aclara con un botón, recuerdo esa forma de decirlo en este navegador, y si deshace algo que entendí así, no lo vuelvo a entender de esa manera.${mm?.aprendidas ? ` Llevo ${mm.aprendidas === 1 ? "1 frase aprendida" : `${mm.aprendidas} frases aprendidas`}.` : ""}${mm && !mm.activo ? " Ahora está apagado (se enciende en Ajustes)." : ""}`, `${mm?.aciertos ? `In its test with hand-written phrases it had never seen, it got ${pct(mm.ciega ?? mm.aciertos)} right. ` : ""}I learn from you: when you clarify something with a button, I remember that way of saying it in this browser, and if you undo something I understood that way, I won't understand it like that again.${mm?.aprendidas ? ` I've learned ${mm.aprendidas === 1 ? "1 phrase" : `${mm.aprendidas} phrases`} from you so far.` : ""}${mm && !mm.activo ? " It's switched off right now (you turn it on in Settings)." : ""}`),
        ].join("\n"),
        acciones: [{ texto: tx("Abrir los ajustes del Modelo Melki", "Open the Melki Model settings"), accion: "ajustes-modelo" }, ...(mm?.aprendidas ? [{ texto: tx("Olvidar lo aprendido", "Forget what I learned"), accion: "olvidar-modelo" as const }] : [])],
      };
    },
  },
  {
    id: "ia-local",
    claves: ["ia local", "inteligencia artificial local", "modelo local", "qwen", "webgpu", "sin internet", "offline", "deepseek", "fable", "opus", "claude", "llama", "modelo de lenguaje"],
    clavesEn: ["local ai", "local artificial intelligence", "local model", "qwen", "webgpu", "without internet", "offline", "deepseek", "fable", "opus", "claude", "llama", "language model", "llm", "webllm"],
    responder: () => ({
      texto: [
        tx("Siempre tengo mi propio Modelo Melki, una red neuronal hecha solo para este simulador que corre en el procesador, sin internet ni tarjeta gráfica (pregúnteme «¿cómo me entiendes?»). Además tengo una IA local opcional: Qwen3 (de Alibaba), un modelo de lenguaje abierto que corre en la tarjeta gráfica de este equipo con WebGPU, sin instalar nada y sin mandar nada a internet. Se descarga una vez (unos 2,3 GB el recomendado) cuando la activa en Ajustes y queda guardado en el navegador.", "I always have my own Melki Model, a neural network built just for this simulator that runs on the processor, with no internet or graphics card (ask me “how do you understand me?”). I also have an optional local AI: Qwen3 (from Alibaba), an open language model that runs on this computer's graphics card with WebGPU, without installing anything and without sending anything to the internet. It downloads once (about 2.3 GB for the recommended one) when you turn it on in Settings, and stays stored in the browser."),
        tx("La uso cuando ni mi intérprete ni mi Modelo Melki entienden un pedido: Qwen3 lo pasa a órdenes que yo verifico antes de hacerlas, y si inventa una cifra que usted no dijo, no la uso. El diseño, los costos y la cobertura siempre salen del cálculo, no del modelo.", "I use it when neither my interpreter nor my Melki Model understands a request: Qwen3 turns it into orders that I check before carrying them out, and if it makes up a figure you didn't say, I don't use it. The design, the costs and the coverage always come from the calculation, not from the model."),
        tx("Corre con WebLLM 0.2.82: las versiones más nuevas de esa biblioteca bloquearon la tarjeta gráfica en un equipo con Windows y gráficos AMD integrados. Si la tarjeta deja de responder, apago la IA local sola, se lo digo y no lo vuelvo a intentar hasta que usted la active.", "It runs on WebLLM 0.2.82: newer versions of that library froze the graphics card on a Windows computer with integrated AMD graphics. If the card stops responding, I turn the local AI off by myself, let you know and don't try again until you turn it on."),
        tx("Claude (Fable u Opus) no se puede instalar en un equipo: funciona solo por internet. DeepSeek V4 es demasiado grande para un PC, y sus versiones locales razonan en voz alta antes de responder, lo que en una tarjeta integrada las hace mucho más lentas que Qwen3 para esto.", "Claude (Fable or Opus) can't be installed on a computer: it only works over the internet. DeepSeek V4 is too big for a PC, and its local versions reason out loud before answering, which on an integrated graphics card makes them much slower than Qwen3 for this."),
      ].join("\n"),
      acciones: [{ texto: tx("Abrir los ajustes de la IA local", "Open the local AI settings"), accion: "ajustes-ia-local" }],
    }),
  },
  {
    id: "ia-voz",
    claves: ["gemini", "gemini live", "inteligencia artificial de verdad", "chatgpt", "chat gpt", "como chatgpt", "como chat gpt", "gpt live", "gpt-live", "vapi", "whisper", "conectar la ia", "conectarte a una ia", "clave de api", "ai studio", "modelo de voz", "hablar como una ia"],
    clavesEn: ["gemini", "gemini live", "real artificial intelligence", "chatgpt", "chat gpt", "like chatgpt", "like chat gpt", "gpt live", "vapi", "whisper", "connect the ai", "connect to an ai", "connect you to an ai", "api key", "ai studio", "voice model", "talk like an ai", "speak like an ai"],
    responder: () => ({
      texto: [
        tx("Puedo conversar como un modelo de inteligencia artificial con Gemini Live de Google: oigo su voz directamente (el audio, no un texto), hago en el simulador lo que me pida y le respondo por escrito (con voz natural solo si me pide «háblame»), sin inventar cifras (las tomo del simulador).", "I can converse like an artificial intelligence model with Google's Gemini Live: I hear your voice directly (the audio, not a text), I do in the simulator whatever you ask and I answer you in writing (with a natural voice only if you ask me to “talk to me”), without making up figures (I take them from the simulator)."),
        tx("Es gratis con una clave de Google AI Studio (capa gratuita, con límites por día). La pega una vez en Ajustes → «Conversar con IA» y queda solo en este navegador. Mientras conversamos, su voz y un resumen del escenario van a Google; en la capa gratuita Google puede usarlos para mejorar sus productos.", "It's free with a Google AI Studio key (free tier, with daily limits). You paste it once in Settings → “Talk with AI” and it stays only in this browser. While we talk, your voice and a summary of the scenario go to Google; on the free tier Google may use them to improve its products."),
        tx("Otras opciones: GPT-Live-1 de OpenAI (la voz de ChatGPT) cuesta unos US$0,05 por minuto y no tiene capa gratuita; Vapi cobra US$0,05 por minuto más cada servicio; Whisper solo pasa la voz a texto (ya lo uso en el dictado privado). Sin clave o sin internet sigo con mi cerebro local.", "Other options: OpenAI's GPT-Live-1 (ChatGPT's voice) costs about US$0.05 per minute and has no free tier; Vapi charges US$0.05 per minute plus each service; Whisper only turns voice into text (I already use it for private dictation). Without a key or without internet, I carry on with my local brain."),
      ].join("\n"),
      acciones: [{ texto: tx("Abrir los ajustes de la IA", "Open the AI settings"), accion: "ajustes-ia" }],
    }),
  },
  {
    id: "roles",
    claves: ["rol", "roles", "repeater", "companion", "room server", "router", "client", "cliente", "silencioso", "no retransmite"],
    clavesEn: ["role", "roles", "repeater role", "companion", "room server", "router", "client", "silent", "does not retransmit"],
    responder: (c) => ({
      texto:
        presetPorId(c.parametros.preset).protocolo === "meshtastic"
          ? tx("En Meshtastic los roles que importan aquí son ROUTER (siempre repite y no cancela: los repetidores de la red), CLIENT (el de fábrica: repite lo que oye, pero si oye que otro ya lo repitió, cancela el suyo) y CLIENT_MUTE (no repite nunca). Con mucha gente, dejar las personas en CLIENT_MUTE evita que cada mensaje se repita decenas de veces.", "In Meshtastic the roles that matter here are ROUTER (always repeats and never cancels: the network's repeaters), CLIENT (the factory default: it repeats what it hears, but if it hears that another device already repeated it, it cancels its own) and CLIENT_MUTE (never repeats). With lots of people, leaving the people on CLIENT_MUTE keeps every message from being repeated dozens of times.")
          : tx("MeshCore tiene tres roles: Repetidor (pasa los paquetes de los demás; son los P1 de Trama en sus tubos), Companion (la billetera de la persona o la radio del gateway por USB: envía y recibe lo suyo y no retransmite) y Room server (guarda los mensajes de un grupo; por defecto no retransmite). Solo los repetidores sirven de puente: si una persona queda entre dos repetidores, no ayuda a pasar los mensajes de otros.", "MeshCore has three roles: Repeater (passes on other nodes' packets; these are Trama's P1s on their poles), Companion (the person's wallet or the gateway's radio over USB: it sends and receives its own traffic and doesn't retransmit) and Room server (stores a group's messages; by default it doesn't retransmit). Only the repeaters act as bridges: if a person sits between two repeaters, they don't help pass on other people's messages."),
    }),
  },
  {
    id: "factibilidad",
    claves: ["factible", "factibilidad", "viable", "viabilidad", "funciona", "sirve la red", "criterios", "puntaje", "veredicto", "funcionalidad"],
    clavesEn: ["feasible", "feasibility", "viable", "viability", "does it work", "will it work", "does the network work", "criteria", "score", "verdict", "functionality", "is it feasible"],
    responder: resumenRed,
  },
  {
    id: "estado",
    claves: ["como esta", "como va", "como quedo", "resumen", "resultado", "resultados", "estado de la red", "diagnostico", "cobertura total"],
    clavesEn: ["how is it", "how is it doing", "coverage", "how much coverage", "network coverage", "coverage of the network", "how did it turn out", "how did it go", "summary", "result", "results", "network status", "status of the network", "state of the network", "diagnosis", "total coverage", "how is the network", "how is the network doing", "how is the mesh"],
    responder: resumenRed,
  },
  {
    id: "respaldo",
    claves: ["respaldo", "redundancia", "redundante", "dos antenas", "falla", "punto unico", "critica", "critico"],
    clavesEn: ["backup", "redundancy", "redundant", "two antennas", "failure", "fails", "single point", "single point of failure", "critical", "failover"],
    responder: (c) => {
      const r = c.resultado;
      const base = tx("Hay respaldo donde dos o más antenas dan servicio confiable: si una se apaga, la otra cubre. El modo «Respaldo» del mapa muestra cuántas antenas llegan a cada punto. También marco como críticas las antenas intermedias que, si fallan, dejan a otras sin pasarela.", "There's backup where two or more antennas give reliable service: if one goes down, the other covers. The map's “Backup” mode shows how many antennas reach each point. I also mark as critical the intermediate antennas that, if they fail, leave others without a gateway.");
      if (!r) return { texto: base };
      const criticas = r.nodos.filter((n) => n.critico).map((n) => c.antenas.find((a) => a.id === n.id)?.nombre ?? n.id);
      return { texto: tx(`${base} Ahora ${f(r.porcentajeRespaldo, 0)} % del área tiene respaldo${criticas.length ? ` y son críticas: ${criticas.join(", ")}` : " y no hay antenas críticas"}.`, `${base} Right now ${f(r.porcentajeRespaldo, 0)}% of the area has backup${criticas.length ? ` and these are critical: ${criticas.join(", ")}` : " and there are no critical antennas"}.`) };
    },
  },
  {
    id: "modos",
    claves: ["mejor antena", "modo", "servidor", "quien cubre", "que antena cubre"],
    clavesEn: ["best antenna", "mode", "modes", "best server", "who covers", "which antenna covers", "color mode", "map mode"],
    responder: () => ({
      texto: tx("Arriba del mapa hay tres modos de color: Señal (nivel de la mejor antena), Mejor antena (qué antena atiende cada punto) y Respaldo (cuántas antenas dan servicio). La leyenda cambia con el modo.", "Above the map there are three color modes: Signal (level of the best antenna), Best antenna (which antenna serves each point) and Backup (how many antennas give service). The legend changes with the mode."),
    }),
  },
  {
    id: "medir",
    claves: ["medir", "punto", "inspeccionar", "señal en", "senal en", "aqui llega", "llega senal", "consultar punto", "mi finca", "mi casa"],
    clavesEn: ["measure", "measure signal", "measure the signal", "point", "inspect", "signal at", "signal here", "is there signal", "does the signal reach", "check a point", "my farm", "my house", "my home"],
    responder: () => ({
      texto: tx("Active la herramienta «Medir señal» y haga clic en cualquier punto del mapa: le muestro el margen desde cada antena, la distancia y si hay línea de vista. Desde ahí puede abrir el perfil del trayecto.", "Turn on the “Measure signal” tool and click any point on the map: I show you the margin from each antenna, the distance and whether there is line of sight. From there you can open the path profile."),
      acciones: [{ texto: tx("Activar Medir señal", "Turn on Measure signal"), accion: "inspeccionar" }],
    }),
  },
  {
    id: "perfil",
    claves: ["perfil", "fresnel", "linea de vista", "obstaculo", "obstruccion", "cerro", "montana", "loma"],
    clavesEn: ["profile", "fresnel", "line of sight", "obstacle", "obstruction", "hill", "mountain", "terrain profile", "elevation profile"],
    responder: () => ({
      texto:
        tx("El perfil dibuja el terreno entre dos puntos con la curvatura de la Tierra (k = 4/3), la línea de vista y la primera zona de Fresnel. Si el 60 % de Fresnel queda libre hay línea de vista plena; si un cerro la corta, marco el obstáculo principal y sumo su pérdida por difracción. Ábralo desde la ficha de una antena, desde la lista de enlaces o al medir un punto.", "The profile draws the terrain between two points with the Earth's curvature (k = 4/3), the line of sight and the first Fresnel zone. If 60% of the Fresnel zone is clear there's full line of sight; if a hill cuts it, I mark the main obstacle and add its diffraction loss. Open it from an antenna's card, from the list of links or when you measure a point."),
    }),
  },
  {
    id: "modelo",
    claves: ["modelo", "calibracion", "calibrado", "precision", "exacto", "confiable el modelo", "error", "radio mobile", "difraccion", "deygout", "itm", "longley"],
    clavesEn: ["model", "propagation model", "calibration", "calibrated", "accuracy", "precision", "accurate", "exact", "how reliable is the model", "error", "radio mobile", "diffraction", "deygout", "itm", "longley", "longley rice"],
    responder: () => ({
      texto:
        tx("Hay dos modelos. El calibrado (recomendado) suma la pérdida en espacio libre, la difracción del obstáculo principal del perfil (filo de cuchillo, Deygout) sobre tierra 4/3 y una pérdida adicional ajustada con las simulaciones de Radio Mobile del proyecto; en los enlaces de prueba se desvía unos 3 dB de Radio Mobile. El otro es Longley-Rice (ITM 1.2.2), el mismo modelo de Radio Mobile, calculado con el perfil completo de cada trayecto; lo validé contra la implementación de referencia de la NTIA (diferencias menores a 0,001 dB). Si cambia clima, polarización, suelo, refractividad o confiabilidad, el modelo calibrado se corrige con lo que Longley-Rice predice para ese cambio. Es una herramienta de planeación: confirme en campo antes de instalar (un ping o un trace de MeshCore entre los dos equipos, y el SNR que reporta la app).", "There are two models. The calibrated one (recommended) adds the free-space loss, the diffraction from the profile's main obstacle (knife-edge, Deygout) over a 4/3 Earth and an additional loss fitted to the project's Radio Mobile simulations; on the test links it deviates about 3 dB from Radio Mobile. The other is Longley-Rice (ITM 1.2.2), the same model Radio Mobile uses, calculated with the full profile of each path; I validated it against the NTIA reference implementation (differences under 0.001 dB). If you change the climate, polarization, ground, refractivity or reliability, the calibrated model is corrected with what Longley-Rice predicts for that change. It's a planning tool: confirm in the field before installing (a MeshCore ping or trace between the two devices, and the SNR the app reports)."),
    }),
  },
  {
    id: "relieve",
    claves: ["relieve", "terreno", "elevacion", "srtm", "hgt", "dem", "3d", "topografia", "plano", "sin conexion", "offline"],
    clavesEn: ["terrain", "relief", "elevation", "srtm", "hgt", "dem", "3d", "topography", "flat", "no connection", "offline", "elevation data", "digital elevation model"],
    responder: (c) => ({
      texto: tx(`Tengo tres fuentes de relieve: En línea (teselas SRTM abiertas, se descarga solo la zona simulada), Archivos SRTM (.hgt de su equipo, los mismos que usa Radio Mobile, sin descargar nada) y Plano (sin relieve). Ahora uso ${c.relieve === "teselas" ? "la fuente en línea" : c.relieve === "hgt" ? "archivos SRTM locales" : "terreno plano"}. En Capas puede activar el relieve 3D para ver el terreno inclinado.`, `I have three terrain sources: Online (open SRTM tiles; only the simulated area is downloaded), SRTM files (.hgt files from your computer, the same ones Radio Mobile uses, with nothing to download) and Flat (no terrain). Right now I'm using ${c.relieve === "teselas" ? "the online source" : c.relieve === "hgt" ? "local SRTM files" : "flat terrain"}. In Layers you can turn on 3D terrain to see the terrain in relief.`),
      acciones: [{ texto: tx("Ir a parámetros", "Go to parameters"), accion: "parametros" }],
    }),
  },
  {
    id: "privacidad",
    claves: ["privacidad", "datos", "se envia", "seguro", "google", "nube", "confidencial", "donde se guarda"],
    clavesEn: ["privacy", "private", "data", "my data", "is it sent", "sent anywhere", "secure", "safe", "google", "cloud", "confidential", "where is it stored", "where is it saved", "where is my data"],
    responder: () => ({
      texto:
        tx("Sus antenas y escenarios se quedan en este navegador (almacenamiento local) y en los archivos que usted exporte. El mapa base y el relieve en línea solo piden imágenes de la zona que se ve; no envían coordenadas de antenas ni resultados. Si prefiere no descargar nada, use relieve Plano o sus archivos .hgt.", "Your antennas and scenarios stay in this browser (local storage) and in the files you export. The base map and the online terrain only request images of the area in view; they don't send antenna coordinates or results. If you'd rather not download anything, use Flat terrain or your .hgt files."),
    }),
  },
  {
    id: "capas",
    claves: ["capas", "mapa base", "satelite", "topografico", "calles", "opacidad", "transparencia", "nombres"],
    clavesEn: ["layers", "layer", "base map", "basemap", "satellite", "topographic", "streets", "opacity", "transparency", "names"],
    responder: () => ({
      texto: tx("En el botón Capas elige el mapa base (satélite, satélite con nombres, topográfico o calles), la opacidad de la cobertura, el relieve 3D, los enlaces, las parejas sin enlace, las zonas sin servicio y el círculo de estudio de cada antena.", "With the Layers button you choose the base map (satellite, satellite with names, topographic or streets), the coverage opacity, the 3D terrain, the links, the pairs without a link, the areas with no service and each antenna's study circle."),
    }),
  },
  {
    id: "exportar",
    claves: ["guardar", "exportar", "importar", "abrir", "kmz", "kml", "google earth", "csv", "excel", "json", "descargar", "compartir"],
    clavesEn: ["save", "export", "import", "open", "kmz", "kml", "google earth", "csv", "excel", "json", "download", "share"],
    responder: () => ({
      texto:
        tx("El escenario se guarda solo en este navegador. En Archivo (en la barra de arriba, que despliega la flechita de la esquina superior derecha) puede guardarlo como .json para compartirlo o retomarlo, exportar las antenas a Excel (.csv) y llevar la cobertura a Google Earth (.kmz) con la capa de señal, las antenas, los enlaces y la leyenda, como en los informes de Radio Mobile.", "The scenario is saved automatically in this browser. In File (in the top bar, which the little arrow in the top right corner opens) you can save it as .json to share it or pick it up later, export the antennas to Excel (.csv) and take the coverage to Google Earth (.kmz) with the signal layer, the antennas, the links and the legend, as in Radio Mobile reports."),
      acciones: [{ texto: tx("Exportar KMZ", "Export KMZ"), accion: "kmz" }],
    }),
  },
  {
    id: "barra",
    claves: ["barra de arriba", "barra superior", "barra de herramientas de arriba", "flechita", "no veo la barra", "donde esta la barra", "donde estan los botones", "no veo los botones", "donde esta archivo", "donde esta el menu"],
    clavesEn: ["top bar", "toolbar", "top toolbar", "little arrow", "where is the toolbar", "where is the top bar", "where are the buttons", "where is file", "where is the menu"],
    responder: () => ({
      texto: tx(
        "La barra de herramientas de arriba (Archivo, el buscador, Asistente Melki, Tours, Recorrido, Pitch y Configuración) empieza oculta para dejarle el mapa completo. Se despliega con la flechita de la esquina superior derecha del mapa, y con la misma flechita se vuelve a ocultar.",
        "The toolbar at the top (File, the search box, Melki Assistant, Tours, Walkthrough, Pitch and Settings) starts hidden to leave you the whole map. It opens with the little arrow in the top right corner of the map, and the same arrow hides it again.",
      ),
    }),
  },
  {
    id: "receptor",
    claves: ["receptor", "radio portatil", "handheld", "vehiculo", "perdida extra", "cuerpo"],
    clavesEn: ["receiver", "handheld", "handheld radio", "portable radio", "vehicle", "car", "extra loss", "body", "body loss", "receiver height"],
    responder: (c) => ({
      texto: tx(`El receptor representa la billetera de la persona en campo (XIAO o T1000-E). Ahora está a ${f(c.parametros.alturaRxM)} m, con ${f(c.parametros.gananciaRxDbi)} dBi y ${f(c.parametros.perdidaExtraDb, 0)} dB de pérdida extra. Si el equipo va dentro de un vehículo o pegado al cuerpo, sume entre 5 y 15 dB de pérdida extra. Para follaje o edificios elija el entorno de la zona (por ejemplo «simula con vegetación densa»).`, `The receiver represents the person's wallet in the field (XIAO or T1000-E). It's now at ${f(c.parametros.alturaRxM)} m, with ${f(c.parametros.gananciaRxDbi)} dBi and ${f(c.parametros.perdidaExtraDb, 0)} dB of extra loss. If the device is inside a vehicle or against the body, add between 5 and 15 dB of extra loss. For foliage or buildings, choose the area's environment (for example “simulate with dense vegetation”).`),
      acciones: [{ texto: tx("Ir a parámetros", "Go to parameters"), accion: "parametros" }],
    }),
  },
  {
    id: "confiabilidad",
    claves: ["confiabilidad", "porcentaje de tiempo", "situaciones", "ubicaciones", "variabilidad", "modo movil", "modo estadistico", "estadistica", "spot", "accidental", "broadcast", "difusion", "90 %"],
    clavesEn: ["reliability", "percentage of time", "time percentage", "situations", "locations", "variability", "mobile mode", "statistical mode", "statistics", "spot", "accidental", "broadcast", "90 percent"],
    responder: (c) => ({
      texto: tx(`La confiabilidad dice qué tan seguido se cumple la señal calculada, como en Radio Mobile. Ahora uso el modo ${c.parametros.variabilidad} con ${f(c.parametros.tiempoPct, 0)} % del tiempo y ${f(c.parametros.situacionesPct, 0)} % de las situaciones${esReferencia(c.parametros) ? ", los mismos valores de las pruebas de Radio Mobile" : ""}. Con «confiabilidad alta» (90 %) la señal se exige más y el mapa se achica: es el escenario prudente para telemetría o alarmas. Pídamelo así: «confiabilidad del 90 %» o «95 % del tiempo».`, `Reliability says how often the calculated signal is achieved, as in Radio Mobile. I'm now using ${({ puntual: "spot", accidental: "accidental", movil: "mobile", difusion: "broadcast" } as Record<string, string>)[c.parametros.variabilidad] ?? c.parametros.variabilidad} mode with ${f(c.parametros.tiempoPct, 0)}% of the time and ${f(c.parametros.situacionesPct, 0)}% of the situations${esReferencia(c.parametros) ? ", the same values as the Radio Mobile tests" : ""}. With “high reliability” (90%) more is demanded of the signal and the map shrinks: it's the prudent scenario for telemetry or alarms. Ask me like this: “90% reliability” or “95% of the time”.`),
      acciones: [{ texto: tx("Ir a parámetros", "Go to parameters"), accion: "parametros" }],
    }),
  },
  {
    id: "red-radio-mobile",
    claves: ["clima", "polarizacion", "horizontal", "vertical", "suelo", "conductividad", "permitividad", "refractividad", "parametros de red", "parametros de radio mobile", "ecuatorial", "propagacion"],
    clavesEn: ["climate", "polarization", "polarisation", "horizontal", "vertical", "ground", "soil", "conductivity", "permittivity", "refractivity", "network parameters", "radio mobile parameters", "equatorial", "propagation"],
    responder: (c) => ({
      texto: tx(`Los parámetros de red son los mismos de Radio Mobile. Ahora: ${resumenParametros(c.parametros)}. Colombia es clima ecuatorial; las antenas de 8 dBi de Trama son verticales (polarización vertical); el suelo promedio (εr 15, σ 0,005 S/m) sirve para la llanura, el húmedo para zonas encharcadas y agua dulce para ríos o ciénagas. Puedo cambiarlos, por ejemplo «clima continental templado», «polarización horizontal», «suelo húmedo», o volver a los de referencia con «restablece los parámetros de Radio Mobile».`, `The network parameters are the same as in Radio Mobile. Now: ${resumenParametros(c.parametros)}. Colombia has an equatorial climate; Trama's 8 dBi antennas are vertical (vertical polarization); average ground (εr 15, σ 0.005 S/m) suits the plains, wet ground suits waterlogged areas, and fresh water suits rivers or marshes. I can change them, for example “continental temperate climate”, “horizontal polarization”, “wet ground”, or go back to the reference values with “reset the Radio Mobile parameters”.`),
      acciones: [{ texto: tx("Ir a parámetros", "Go to parameters"), accion: "parametros" }],
    }),
  },
  {
    id: "direccionales",
    claves: ["yagi", "sectorial", "panel", "parabolica", "direccional", "direccionales", "omnidireccional", "omni", "azimut", "apuntar", "orientar", "inclinacion", "patron de radiacion", "haz", "tilt"],
    clavesEn: ["yagi", "sector", "sectorial", "panel", "dish", "parabolic", "directional", "directional antenna", "directional antennas", "omnidirectional", "omni", "azimuth", "point the antenna", "aim", "aim the antenna", "orient", "tilt", "radiation pattern", "beam", "beamwidth"],
    responder: (c) => {
      const dir = c.antenas.filter(esDireccional);
      return {
        texto: tx(`Además de la omnidireccional, puede usar ${PATRONES.filter((p) => p.id !== "omni")
          .map((p) => `${p.nombre.toLowerCase()} (≈ ${f(p.gananciaTipica, 0)} dBi)`)
          .join(", ")}. Concentran la señal en una dirección: llegan más lejos al frente y casi nada atrás. Elija el tipo en la ficha del nodo, el azimut (0° = norte) y la elevación del haz (negativa = hacia abajo); en el mapa se dibuja hacia dónde apunta. Pídamelo así: «ponle una Yagi a Ejemplo apuntando a Torre 2» o «apunta Ejemplo al noreste».${
          dir.length ? ` Ahora hay ${dir.length === 1 ? "una direccional" : `${dir.length} direccionales`}: ${dir.map((a) => `${a.nombre} (${patronPorId(a.patron).nombre.toLowerCase()} a ${Math.round(a.azimutDeg ?? 0)}°, haz de ${Math.round(anchosHaz(a.patron, a.gananciaDbi).h)}°)`).join("; ")}.` : ""
        }`, `Besides the omnidirectional antenna, you can use ${PATRONES.filter((p) => p.id !== "omni")
          .map((p) => `${p.nombre.toLowerCase()} (≈ ${f(p.gananciaTipica, 0)} dBi)`)
          .join(", ")}. They concentrate the signal in one direction: they reach farther in front and almost nothing behind. Choose the type in the node's card, the azimuth (0° = north) and the beam elevation (negative = downward); the map shows where it points. Ask me like this: “put a Yagi on Example pointing at Tower 2” or “point Example to the northeast”.${
          dir.length ? ` Right now there ${dir.length === 1 ? "is one directional antenna" : `are ${dir.length} directional antennas`}: ${dir.map((a) => `${a.nombre} (${patronPorId(a.patron).nombre.toLowerCase()} at ${Math.round(a.azimutDeg ?? 0)}°, ${Math.round(anchosHaz(a.patron, a.gananciaDbi).h)}° beam)`).join("; ")}.` : ""
        }`),
      };
    },
  },
  {
    id: "entorno",
    claves: ["entorno", "vegetacion", "follaje", "bosque", "selva", "plantacion", "palma", "arboles", "cultivos", "ciudad", "pueblo", "edificios", "urbano", "clutter"],
    clavesEn: ["environment", "clutter", "vegetation", "foliage", "forest", "jungle", "plantation", "palm", "oil palm", "trees", "crops", "city", "town", "buildings", "urban"],
    responder: (c) => {
      const e = entornoPorId(c.parametros.entorno);
      return {
        texto: tx(`El entorno agrega la pérdida de la vegetación o de los edificios a los equipos que quedan por debajo de ellos (UIT-R P.833 para follaje y P.2108 para construcciones y bosque). Ahora: ${e.nombre.toLowerCase()}${e.metodo === "ninguno" ? ", sin pérdidas adicionales" : `, ≈ ${f(perdidaEntorno(e.id, c.parametros.alturaRxM, c.parametros.frecuenciaMhz))} dB para el receptor a ${f(c.parametros.alturaRxM)} m`}. Opciones: ${ENTORNOS.map((x) => x.nombre.toLowerCase()).join(", ")}. Si la antena está por encima de los árboles o techos, no pierde nada. Pídamelo así: «simula con vegetación densa» o «la zona es una plantación de palma».`, `The environment adds the loss from vegetation or buildings to the devices that sit below them (ITU-R P.833 for foliage and P.2108 for buildings and forest). Now: ${e.nombre.toLowerCase()}${e.metodo === "ninguno" ? ", with no additional losses" : `, ≈ ${f(perdidaEntorno(e.id, c.parametros.alturaRxM, c.parametros.frecuenciaMhz))} dB for the receiver at ${f(c.parametros.alturaRxM)} m`}. Options: ${ENTORNOS.map((x) => x.nombre.toLowerCase()).join(", ")}. If the antenna is above the trees or roofs, it loses nothing. Ask me like this: “simulate with dense vegetation” or “the area is an oil palm plantation”.`),
        acciones: [{ texto: tx("Ir a parámetros", "Go to parameters"), accion: "parametros" }],
      };
    },
  },
  {
    id: "unidades",
    claves: ["dbm", "microvoltios", "uv", "dbuv", "campo electrico", "intensidad de campo", "unidades", "unidad", "arcoiris", "umbral", "escala de colores"],
    clavesEn: ["dbm", "microvolts", "uv", "dbuv", "electric field", "field strength", "units", "unit", "rainbow", "threshold", "color scale", "signal scale", "received power"],
    responder: (c) => {
      const s = presetPorId(c.parametros.preset).sensibilidadDbm;
      return {
        texto: tx(`Puedo mostrar la señal como margen (dB sobre la sensibilidad), potencia recibida (dBm), tensión en el receptor (µV, sobre 50 Ω) o intensidad de campo (dBµV/m), como en Radio Mobile. Con ${presetPorId(c.parametros.preset).nombre} la sensibilidad es ${f(s)} dBm: 20 dB de margen son ${f(s + 20)} dBm. Los colores pueden ser las clases de Radio Mobile, un arcoíris entre dos niveles o un solo umbral. Pídamelo así: «muestra la señal en dBm», «en microvoltios», «colores arcoíris de -120 a -70 dBm» o «umbral de -105 dBm».`, `I can show the signal as margin (dB above the sensitivity), received power (dBm), voltage at the receiver (µV, across 50 Ω) or field strength (dBµV/m), as in Radio Mobile. With ${presetPorId(c.parametros.preset).nombre} the sensitivity is ${f(s)} dBm: a 20 dB margin is ${f(s + 20)} dBm. The colors can be the Radio Mobile classes, a rainbow between two levels or a single threshold. Ask me like this: “show the signal in dBm”, “in microvolts”, “rainbow colors from -120 to -70 dBm” or “-105 dBm threshold”.`),
      };
    },
  },
  {
    id: "informe",
    claves: ["informe", "radioenlace", "radio enlace", "radio link", "reporte del enlace", "pire", "eirp", "angulo de elevacion", "azimut del enlace", "balance del enlace"],
    clavesEn: ["report", "radio link report", "radio link", "radiolink", "link report", "eirp", "elevation angle", "link azimuth", "link balance"],
    responder: () => ({
      texto:
        tx("El informe de radioenlace es como «Radio Link» de Radio Mobile: distancia, azimut de ida y vuelta, ángulo de elevación, peor despeje de Fresnel, potencia, PIRE, ganancias con el patrón de cada antena, pérdidas desglosadas (espacio libre, obstrucción, estadística, ajuste de red y entorno), la predicción de Longley-Rice y el nivel recibido en dBm, µV y dBµV/m con su margen. Ábralo con el botón Informe del perfil, desde la ficha de un nodo («Radioenlace») o pidiéndomelo: «informe del enlace Ejemplo y Torre 2». Se puede copiar o descargar en texto.", "The radio link report is like Radio Mobile's “Radio Link”: distance, azimuth in both directions, elevation angle, worst Fresnel clearance, power, EIRP, gains with each antenna's pattern, broken-down losses (free space, obstruction, statistics, network adjustment and environment), the Longley-Rice prediction and the received level in dBm, µV and dBµV/m with its margin. Open it with the profile's Report button, from a node's card (“Radio link”) or by asking me: “link report for Example and Tower 2”. It can be copied or downloaded as text."),
    }),
  },
  {
    id: "dictado",
    claves: ["dictar", "dictado", "microfono", "voz a texto", "hablarte", "hablarle", "por voz", "audio", "reconocimiento de voz", "me escuchas", "escucharme", "leer en voz alta", "voz de melki"],
    clavesEn: ["dictate", "dictation", "microphone", "mic", "speech to text", "voice to text", "talk to you", "speak to you", "by voice", "audio", "speech recognition", "voice recognition", "hear me", "listen to me", "read aloud", "read out loud", "melki voice", "your voice"],
    responder: () => ({
      texto:
        tx("Toque el micrófono junto al botón de enviar y hable: lo que dice aparece en la caja de texto, lo revisa o corrige, y lo envía cuando quiera (nunca se envía solo). Toque el micrófono otra vez para terminar. En Ajustes de voz (el ícono junto al parlante) elige el modo: «Con el navegador», más preciso pero el audio lo procesa Edge o Chrome por internet, o «Privado, sin internet», donde el audio no sale de su equipo (la primera vez puede descargar unos 100 MB). Yo no hablo en voz alta: respondo por escrito (si quiere oírme, toque el parlante o dígame «háblame»). Y si quiere darme órdenes sin tocar nada, active el «Asistente Melki»: le escucho todo el tiempo y me activo cuando dice «Hola Melki».", "Tap the microphone next to the send button and speak: what you say appears in the text box; you review or correct it and send it whenever you like (it's never sent on its own). Tap the microphone again to finish. In Voice settings (the icon next to the speaker) you choose the mode: “With the browser”, more accurate but the audio is processed by Edge or Chrome over the internet, or “Private, no internet”, where the audio never leaves your computer (the first time it may download about 100 MB). I don't speak out loud: I answer in writing (if you want to hear me, tap the speaker or tell me “talk to me”). And if you want to give me orders without touching anything, turn on the “Melki Assistant”: I listen all the time and wake up when you say “Hey Melki”."),
      acciones: [{ texto: tx("Activar el Asistente Melki", "Turn on the Melki Assistant"), accion: "manos-libres" }],
    }),
  },
  {
    id: "autoria",
    // Sin «licencia» sola: «¿necesito licencia para la banda de 915?» es una pregunta de radio
    claves: [
      "quien te creo",
      "quien creo el simulador",
      "quien creo esto",
      "quien creo este programa",
      "quien hizo el simulador",
      "quien hizo esto",
      "quien hizo este programa",
      "quien desarrollo",
      "quien programo",
      "quien es el autor",
      "quien es el inge",
      "el inge",
      "pablo felipe",
      "ingeniero pablo",
      "autor del simulador",
      "autor",
      "autoria",
      "creador",
      "creditos",
      "derechos de autor",
      "propiedad intelectual",
      "licencia del simulador",
      "licencia de uso",
      "licencia del programa",
      "licencia del software",
      "copyright",
      "acerca del simulador",
      "puedo copiar el codigo",
      "puedo usar el codigo",
      "titulares",
      "patente",
      "patentar",
      "patentarlo",
      "registro de software",
      "registrar el software",
    ],
    clavesEn: ["who made you", "who created you", "who built you", "who developed you", "who programmed you", "who designed you", "who wrote you", "who made the simulator", "who created the simulator", "who built the simulator", "who made this", "who created this", "who built this", "who made this program", "who made this app", "who developed", "who developed it", "who programmed", "who programmed it", "who is the author", "who is the inge", "the inge", "inge", "pablo felipe", "engineer pablo", "author of the simulator", "author", "authorship", "creator", "credits", "copyright", "intellectual property", "simulator license", "license of the simulator", "license to use", "usage license", "program license", "software license", "about the simulator", "can i copy the code", "can i use the code", "rights holders", "patent", "patent it", "software registration", "register the software"],
    responder: () => ({
      texto: [
        tx(`${CREDITO} ${DERECHOS}`, `${credito()} ${derechos()}`),
        tx(`• ${TITULARIDAD}`, `• ${titularidad()}`),
        tx("• Usarlo, copiarlo, modificarlo o distribuirlo sin licencia escrita de los titulares está prohibido: los programas de computador se protegen como obras literarias (Decisión Andina 351 de 1993 y Ley 23 de 1982), y el Código Penal castiga la violación del derecho de autor sobre el soporte lógico (artículos 270 a 272).", "• Using, copying, modifying or distributing it without the written license of the rights holders is prohibited: computer programs are protected as literary works (Andean Decision 351 of 1993 and Law 23 of 1982), and the Criminal Code punishes copyright infringement on software (articles 270 to 272)."),
        tx("• Que el código se vea en un repositorio no da permiso de usarlo. El aviso completo está en «Archivo → Acerca del simulador y licencia».", "• Being able to see the code in a repository doesn't grant permission to use it. The full notice is in “File → About the simulator and license”."),
        tx("• El software, como tal, no se patenta en la Comunidad Andina (Decisión 486 de 2000, art. 15): se protege por derecho de autor desde que se crea, y se puede inscribir en el Registro Nacional del Derecho de Autor (Dirección Nacional de Derecho de Autor) como prueba de la autoría y la titularidad.", "• Software as such can't be patented in the Andean Community (Decision 486 of 2000, art. 15): it is protected by copyright from the moment it's created, and it can be registered in the National Copyright Registry (National Copyright Directorate) as proof of authorship and ownership."),
      ].join("\n"),
      acciones: [{ texto: tx("Ver la licencia", "See the license"), accion: "acerca" }],
    }),
  },
  {
    id: "manos-libres",
    claves: [
      "asistente melki",
      "no me entiende",
      "no me entiendes",
      "hablo rapido",
      "hablar rapido",
      "entiende mal",
      "se prende y se apaga",
      "se apaga el microfono",
      "se apaga solo",
      "se responde solo",
      "se repite",
      "texto duplicado",
      "eco",
      "bucle",
      "asistente por voz",
      "asistente inteligente",
      "en reposo",
      "escucha pasiva",
      "como siri",
      "manos libres",
      "modo manos libres",
      "jarvis",
      "modo jarvis",
      "tipo jarvis",
      "comandos de voz",
      "comandos por voz",
      "ordenes por voz",
      "ordenes de voz",
      "control por voz",
      "controlar por voz",
      "manejar por voz",
      "hablar con melki",
      "asistente de voz",
      "palabra de activacion",
      "escucha todo el tiempo",
      "escuchar todo el tiempo",
      "sin tocar nada",
      "por voz sin escribir",
    ],
    clavesEn: ["melki assistant", "does not understand me", "you do not understand me", "i speak fast", "speak fast", "talk fast", "misunderstands", "understands wrong", "turns on and off", "microphone turns off", "turns off by itself", "answers itself", "answers by itself", "repeats itself", "duplicated text", "echo", "loop", "voice assistant", "smart assistant", "standby", "passive listening", "like siri", "hands free", "hands free mode", "jarvis", "jarvis mode", "like jarvis", "voice commands", "voice orders", "voice control", "control by voice", "control with my voice", "talk to melki", "wake word", "listens all the time", "listen all the time", "without touching anything", "by voice without typing"],
    responder: () => ({
      texto: [
        tx("Con el «Asistente Melki» le escucho todo el tiempo, como un asistente de voz: mientras mi barra esté abierta, dígame su pedido directamente, sin llamarme, y lo hago enseguida; lo que no sea una orden ni una pregunta del simulador lo dejo pasar sin interrumpir. Le dejo la respuesta escrita en mi barra (no hablo en voz alta, salvo que me diga «háblame»), con el trato de un mayordomo. Con la barra cerrada, en reposo, diga «Hola Melki», «Oye Melki», «Hey Melki» o «Hello Melki» y su pedido, de corrido (también le entiendo si el micrófono escribe «Melky» o «Melqui»); si solo dice «Hola Melki», le respondo «Hola, mi señor. Le escucho; estoy atento y presto a seguir sus órdenes». Con mi doble oído también le entiendo si me habla en inglés: cambio de idioma solo.", "With the “Melki Assistant” I listen to you all the time, like a voice assistant: while my bar is open, just tell me your request, without calling me, and I do it right away; anything that isn't an order or a question about the simulator I let pass without interrupting. I leave you the answer written in my bar (I don't speak out loud unless you tell me “talk to me”), with a butler's manners. With the bar closed, on standby, say “Hey Melki”, “Hello Melki”, “Hola Melki” or “Oye Melki” followed by your request, in one go (I also understand you if the microphone writes “Melky” or “Melqui”); if you only say “Hey Melki”, I answer “Hello, sir. I'm listening; attentive and ready to follow your orders”. With my second ear I also understand you if you speak to me in Spanish: I switch languages on my own."),
        tx("• Entiendo lo mismo que por escrito: varias órdenes seguidas, números dichos en palabras («doscientas cincuenta personas») y coordenadas («cuatro punto dos, menos setenta y tres punto tres siete»).", "• I understand the same things as in writing: several orders in a row, numbers said in words (“two hundred fifty people”) and coordinates (“four point two, minus seventy-three point three seven”)."),
        tx("• Para conversar: «para» (o «Melki, para» mientras hablo), «repite», «más detalle», «sí, hazlo» o «la segunda» para usar mis botones, «deshaz», «pantalla limpia» y «deja de escuchar».", "• To converse: “stop” (or “Melki, stop” while I'm speaking), “repeat”, “more detail”, “yes, do it” or “the second one” to use my buttons, “undo”, “clear screen” and “stop listening”."),
        tx("• Se activa con el micrófono junto a mi robot (abajo a la derecha), con el botón «Asistente Melki» de la barra de arriba (la despliega la flechita de la esquina superior derecha), con el ícono de ondas de esta conversación o diciéndome por escrito «activa el asistente». Al activarme oculto el panel de herramientas y el de resultados para dejarle el mapa libre; cuando un resultado se vea mejor en un panel, le pregunto si se lo muestro, y vuelven al apagarme. Arriba del mapa ve lo que le entiendo, lo que le respondo y mis sugerencias.", "• It's turned on with the microphone next to my robot (bottom right), with the “Melki Assistant” button in the top bar (the little arrow in the top right corner shows it), with the waves icon in this conversation or by writing to me “turn on the assistant”. When I turn on, I hide the tools panel and the results panel to leave the map clear for you; when a result looks better in a panel, I ask whether to show it to you, and they come back when I turn off. Above the map you see what I understand, what I answer and my suggestions."),
        tx("• En reposo, como Siri o el Asistente de Google: con el micrófono permitido me quedo escuchando solo mi nombre aunque la barra esté cerrada; diga «Hey Melki», «Hola Melki» o «Hello Melki» y me activo sin tocar ningún botón. «Deja de escuchar» me devuelve al reposo y «apaga el micrófono» me apaga del todo.", "• On standby, like Siri or Google Assistant: with the microphone allowed, I keep listening only for my name even when the bar is closed; say “Hey Melki”, “Hello Melki” or “Hola Melki” and I wake up without you touching any button. “Stop listening” puts me back on standby and “turn off the microphone” switches me off completely."),
        tx("• Mi barra se arrastra a cualquier parte del mapa (doble clic la devuelve a su sitio), se achica sola mientras espero y crece cuando me hablan; también puede dejarla siempre pequeña.", "• My bar can be dragged anywhere on the map (double-click puts it back in place); it shrinks by itself while I wait and grows when you speak to me; you can also keep it small all the time."),
        tx("• No hablo en voz alta: le escucho todo el tiempo, sin pausas, hago lo que me pida y le dejo la respuesta escrita. Si quiere oírme, diga «háblame» o active «Hablar en voz alta» en Ajustes de voz («no hables» me vuelve a callar); entonces, con parlantes, mientras hablo dejo de escuchar (así mi voz no entra por el micrófono) y me calla con el cuadrito ■ de mi barra, y con «Uso audífonos» puede hablarme encima. Lo que se cuele de mi voz justo después tampoco lo tomo como pedido, y no repito la misma respuesta ni me disculpo dos veces seguidas por mi eco. Cada frase la tomo una sola vez, aunque el navegador la mande repetida. Si el navegador deja de escuchar tras un silencio o se va el internet, vuelvo a escuchar solo, sin prender y apagar el micrófono; las barritas de mi orbe siguen su voz.", "• I don't speak out loud: I listen to you all the time, without pauses, do what you ask and leave you the answer in writing. If you want to hear me, say “talk to me” or turn on “Speak out loud” in Voice settings (“don't talk” silences me again); then, with speakers, I stop listening while I speak (so my voice doesn't get into the microphone) and you can silence me with the little ■ square on my bar, and with “I use headphones” you can talk over me. Whatever slips in from my voice right afterwards isn't taken as a request either, and I don't repeat the same answer or apologize twice in a row because of my echo. I take each phrase only once, even if the browser sends it repeated. If the browser stops listening after a silence or the internet drops, I start listening again by myself, without turning the microphone on and off; the little bars of my orb follow your voice."),
        tx("• En Ajustes de voz elige cómo le trato (señor, señora o sin tratamiento), si además le hablo en voz alta, con qué tipo de voz (masculina serena, al estilo de JARVIS, o femenina) y con cuál (la más natural que tenga su equipo; en Edge hay voces neuronales como Gonzalo y Salomé de Colombia), si le escucho siempre en reposo y si me activo solo al abrir el simulador, con el micrófono permitido.", "• In Voice settings you choose how I address you (sir, ma'am or no title), whether I also speak to you out loud, with what kind of voice (a calm male one, JARVIS style, or a female one) and which one (the most natural one your computer has; Edge has neural voices), whether I always listen on standby and whether I turn on by myself when the simulator opens, with the microphone allowed."),
        tx("• Si me pide algo que se sale del simulador, se lo digo con respeto y retomamos la red; y si me pide «una red sostenible y viable en Barranca de Upía de 11.226 hectáreas», la diseño y le cuento su viabilidad técnica y su costo con los precios de Trama.", "• If you ask me for something outside the simulator, I tell you so respectfully and we get back to the network; and if you ask me for “a sustainable and viable network in Barranca de Upía covering 11,226 hectares”, I design it and tell you its technical viability and its cost at Trama's prices."),
        tx("• Entiendo los municipios aunque el dictado los escriba mal al hablar rápido («barranca de UPA meta», «barranco vía meta» → Barranca de Upía, Meta): comparo cómo suenan y uso el departamento que se dice o el que se ve en el mapa. Si dudo entre varios, le pregunto «¿se refiere a…?» («sí», «la segunda» o el nombre); si no le entiendo, le pido con gusto que me lo repita.", "• I understand municipalities even if dictation misspells them when you speak fast (“barranca de UPA meta”, “barranco vía meta” → Barranca de Upía, Meta): I compare how they sound and use the department you mention or the one shown on the map. If I'm torn between several, I ask you “do you mean…?” (“yes”, “the second one” or the name); if I don't understand you, I'll gladly ask you to repeat it."),
        tx("• Recuerdo el lugar del que hablamos: «ubícame en Barranca de Upía, Meta» y luego «ármame una red que cubra todo el municipio», «la zona norte del municipio», «3.000 hectáreas ahí» o «lo que estoy viendo»; y con «puntos de popularidad… hasta dónde aguanta antes de quebrarse», después del diseño pongo la gente y hago la prueba de estrés subiendo la carga.", "• I remember the place we're talking about: “take me to Barranca de Upía, Meta” and then “build me a network that covers the whole municipality”, “the northern part of the municipality”, “3,000 hectares there” or “what I'm looking at”; and with “popularity points… how far it holds up before breaking”, after the design I place the people and run the stress test, raising the load."),
        tx("• Sin mi nombre no hago nada, por si alguien habla cerca. Funciona mejor en Edge o Chrome, con un micrófono cerca o audífonos; en Ajustes de voz elige si el audio lo procesa el navegador o se queda en su equipo.", "• Without my name I do nothing, in case someone is talking nearby. It works best in Edge or Chrome, with a microphone close by or headphones; in Voice settings you choose whether the audio is processed by the browser or stays on your computer."),
      ].join("\n"),
      acciones: [
        { texto: tx("Activar el Asistente Melki", "Turn on the Melki Assistant"), accion: "manos-libres" },
        { texto: tx("Tour «Melki por voz»", "“Melki by voice” tour"), accion: "recorrido", tour: "voz" },
      ],
    }),
  },
  {
    id: "cobertura-maxima",
    claves: [
      "mayor cobertura",
      "mayor cobertura posible",
      "la mayor cobertura",
      "maxima cobertura",
      "cobertura maxima",
      "mejor cobertura",
      "mas cobertura posible",
      "toda la cobertura posible",
      "cubrir mas",
      "cubra mas",
      "llegar mas lejos",
      "llegue mas lejos",
      "mas alcance",
      "mayor alcance",
      "maximo alcance",
      "aumentar el alcance",
      "ampliar la cobertura",
      "recomendaciones de cobertura",
    ],
    clavesEn: ["most coverage", "the most coverage", "maximum coverage", "most coverage possible", "the most coverage possible", "greatest coverage", "the greatest coverage", "greatest possible coverage", "best coverage", "as much coverage as possible", "all the coverage possible", "cover more", "covers more", "reach farther", "reach further", "go farther", "more range", "greater range", "maximum range", "increase the range", "extend the range", "expand the coverage", "extend the coverage", "coverage recommendations", "maximize coverage", "maximise coverage"],
    responder: (c) => coberturaMaxima(c),
  },
  {
    id: "rendimiento",
    claves: ["lento", "demora", "tarda", "resolucion", "radio de estudio", "rapido", "rendimiento", "celda", "celdas"],
    clavesEn: ["slow", "delay", "takes long", "takes a long time", "resolution", "study radius", "fast", "faster", "performance", "cell", "cells", "lag", "laggy", "speed up"],
    responder: (c) => ({
      texto: tx(`El cálculo recorre el perfil del terreno desde cada antena hasta cada celda. Con un radio de ${f(c.parametros.radioKm, 0)} km y resolución ${c.parametros.resolucion}, las celdas miden unos ${Math.round((c.parametros.radioKm * 1000) / ({ rapida: 90, normal: 160, fina: 260 } as const)[c.parametros.resolucion])} m. Use Rápida mientras ajusta y Fina para el informe final. El cálculo corre en segundo plano, así que puede seguir usando la pantalla.`, `The calculation follows the terrain profile from each antenna to each cell. With a radius of ${f(c.parametros.radioKm, 0)} km and ${({ rapida: "Fast", normal: "Normal", fina: "Fine" } as Record<string, string>)[c.parametros.resolucion] ?? c.parametros.resolucion} resolution, the cells are about ${Math.round((c.parametros.radioKm * 1000) / ({ rapida: 90, normal: 160, fina: 260 } as const)[c.parametros.resolucion])} m. Use Fast while you adjust and Fine for the final report. The calculation runs in the background, so you can keep using the screen.`),
    }),
  },
  {
    id: "mejorar",
    claves: ["mejorar", "recomendacion", "recomendaciones", "que hago", "sugerencia", "sugerencias", "optimizar", "aumentar cobertura", "mas cobertura", "como arreglo"],
    clavesEn: ["improve", "improvement", "improve coverage", "improve the coverage", "better coverage", "recommendation", "recommendations", "what should i do", "what do i do", "suggestion", "suggestions", "optimize", "optimise", "increase coverage", "more coverage", "how do i fix", "how can i fix", "fix it"],
    responder: (c) => {
      const malla = resumenMalla(c);
      if (malla) return malla;
      const r = c.resultado;
      if (!r) return { texto: tx("Simule primero y le doy recomendaciones concretas para este escenario.", "Simulate first and I'll give you concrete recommendations for this scenario."), acciones: [{ texto: tx("Simular ahora", "Simulate now"), accion: "simular" }] };
      const recs = r.factibilidad.recomendaciones.slice(0, 3);
      const ajuste = c.desactualizado ? null : accionAjuste(r);
      const texto = recs.length ? tx(`Esto es lo que haría: ${recs.map((x, i) => `${i + 1}) ${x}`).join(" ")}`, `This is what I would do: ${recs.map((x, i) => `${i + 1}) ${x}`).join(" ")}`) : tx("La red cumple los criterios. Valide en campo con una prueba de alcance.", "The network meets the criteria. Validate it in the field with a range test.");
      return {
        texto: tx(`${texto} ${r.factibilidad.nivel === "factible" ? "Si quiere, busco la misma cobertura con menos infraestructura." : "O pídame «ajústamelo»: comparo alturas, lomas cercanas, tipo de antena y antenas de apoyo, y le propongo la red factible con la mejor relación cobertura–costo."}`, `${texto} ${r.factibilidad.nivel === "factible" ? "If you like, I'll look for the same coverage with less infrastructure." : "Or ask me to “adjust it for me”: I compare heights, nearby hills, antenna type and support antennas, and propose the feasible network with the best coverage-to-cost ratio."}`),
        acciones: ajuste ? [ajuste] : undefined,
      };
    },
  },
  {
    id: "ajuste",
    claves: ["ajustamelo", "ajuste automatico", "ajustar automaticamente", "costo beneficio", "economico", "mas barato", "antenas de apoyo", "antena de apoyo", "cobertura costo", "menos antenas", "torre de 30", "mas de 30 metros", "optimizar el costo"],
    clavesEn: ["adjust it for me", "adjust it", "automatic adjustment", "auto adjust", "adjust automatically", "cost benefit", "economical", "cheaper", "cheapest", "support antennas", "support antenna", "coverage cost", "fewer antennas", "30 m tower", "30 meter tower", "more than 30 meters", "optimize the cost", "optimise the cost", "reduce the cost"],
    responder: (c) => {
      const ajuste = c.desactualizado ? null : accionAjuste(c.resultado);
      return {
        texto: [
          tx("Con «Ajústamelo automáticamente» (en el Resultado, o pidiéndomelo) analizo la red como un planeador: busco que todos los nodos lleguen al gateway por enlaces sólidos y cubrir la meta con la menor infraestructura posible.", "With “Adjust it for me” (in the Result, or by asking me) I analyze the network like a planner: I look for every node to reach the gateway through solid links and for the goal to be covered with as little infrastructure as possible."),
          tx("Comparo, con el relieve real: correr un nodo a una loma cercana (lo más barato), subir o bajar torres en tramos de 3 m hasta 30 m, cambiar a una antena sectorial hacia donde falta cobertura y sugerir repetidores de apoyo. Para comparar uso los precios del documento de Trama: un repetidor P1 en su tubo de 6 m con instalación y tres años de operación, la torre arriostrada de 12 m del gateway y, para otras alturas, valores extrapolados de esos dos.", "Over the real terrain, I compare: moving a node to a nearby hill (the cheapest), raising or lowering towers in 3 m steps up to 30 m, switching to a sector antenna toward where coverage is missing, and suggesting support repeaters. To compare I use the prices from Trama's document: a P1 repeater on its 6 m pole with installation and three years of operation, the gateway's 12 m guyed tower and, for other heights, values extrapolated from those two."),
          tx("Los repetidores de apoyo son puntos sugeridos, con coordenadas, donde conviene poner uno. Si usted me da sitios posibles («pueden ir en 4.51, -73.12; 4.60, -73.05»), solo uso esos. Las personas pobladas al azar no entran en el ajuste.", "Support repeaters are suggested points, with coordinates, where it's worth placing one. If you give me possible sites (“they can go at 4.51, -73.12; 4.60, -73.05”), I only use those. People populated at random don't count in the adjustment."),
          tx("Le doy hasta tres opciones: la más económica que cumple, la recomendada (donde cada repetidor más ya rinde poco) y la de máxima cobertura.", "I give you up to three options: the most economical one that meets the goal, the recommended one (where each extra repeater no longer adds much) and the maximum coverage one."),
        ].join("\n"),
        acciones: ajuste ? [ajuste] : undefined,
      };
    },
  },
  {
    id: "area-objetivo",
    claves: ["area objetivo", "cobertura util", "senal util", "meta de cobertura", "60 %", "60 por ciento", "zona de la red", "area de estudio"],
    clavesEn: ["target area", "useful coverage", "useful signal", "coverage goal", "coverage target", "60 percent", "network zone", "study area"],
    responder: (c) => {
      const o = c.resultado?.areaObjetivo;
      return {
        texto: [
          tx("La red es factible cuando todos los nodos llegan al gateway por enlaces sólidos (≥ 30 dB) dentro del límite de saltos y la cobertura útil —señal media o mejor, ≥ 30 dB— alcanza la meta.", "The network is feasible when every node reaches the gateway through solid links (≥ 30 dB) within the hop limit and the useful coverage —fair signal or better, ≥ 30 dB— reaches the goal."),
          tx("Sin área objetivo, la meta es el 60 % del área de estudio (los círculos alrededor de los nodos antena). Si mide un área con la regla y me dice «usa el área que medí como área objetivo con el 95 %», la factibilidad se mide ahí, con esa meta y esa señal.", "Without a target area, the goal is 60% of the study area (the circles around the antenna nodes). If you measure an area with the ruler and tell me “use the area I measured as the target area at 95%”, feasibility is measured there, with that goal and that signal."),
          o ? tx(`Ahora el área objetivo es «${o.nombre}»: ${f(o.utilPct, 1)} % cubierto de una meta del ${f(o.metaPct, 1)} %.`, `The target area is now “${o.nombre}”: ${f(o.utilPct, 1)}% covered out of a ${f(o.metaPct, 1)}% goal.`) : tx("Ahora no hay área objetivo.", "There's no target area right now."),
        ].join("\n"),
      };
    },
  },
  {
    id: "equipos",
    claves: ["equipo", "equipos", "sensecap", "p1", "solar node", "heltec", "t114", "xiao", "t1000", "wio", "fibra de vidrio", "rf explorer", "hardware", "nodo solar"],
    clavesEn: ["equipment", "device", "devices", "hardware", "sensecap", "p1", "solar node", "heltec", "t114", "xiao", "t1000", "wio", "fiberglass", "fibreglass", "rf explorer", "what equipment", "which devices"],
    responder: () => ({
      texto: tx(`Los equipos son los del catálogo de Trama, puestos en Colombia (TRM ${COTIZADOR.trm.toLocaleString("es-CO")} con envío, arancel e IVA): el repetidor es un SenseCAP Solar Node P1 (panel de 5 W, nRF52840 + SX1262, MeshCore oficial; ${pesos(precioDe("p1"))} más 4 pilas 18650 por ${pesos(precioDe("pilas18650"))}) con antena RF Explorer de 8 dBi de fibra de vidrio (${pesos(precioDe("antena8"))}) y cable CFD400 de 3 m (${pesos(precioDe("coax"))}): ≈ ${pesos(PRECIOS.repetidor)} instalado en su tubo. Cada radio del gateway es un Heltec Mesh Node T114 (${pesos(precioDe("t114"))}) con la misma antena. La billetera económica es el kit XIAO ESP32S3 + Wio-SX1262 con batería y carcasa (≈ ${pesos(PRECIOS.nodo.xiao)}); la tarjeta T1000-E, sellada y con GPS, cuesta ≈ ${pesos(PRECIOS.nodo.t1000)}. En la ficha de cada nodo elige el equipo y lleno potencia (22 dBm), ganancia y pérdida del cable; si cambia un valor a mano, pasa a Personalizado.`, `The equipment comes from Trama's catalog, landed in Colombia (TRM exchange rate ${numeroLocal(COTIZADOR.trm)}, with shipping, tariff and VAT): the repeater is a SenseCAP Solar Node P1 (5 W panel, nRF52840 + SX1262, official MeshCore; ${pesos(precioDe("p1"))} plus 4 18650 batteries for ${pesos(precioDe("pilas18650"))}) with an 8 dBi fiberglass RF Explorer antenna (${pesos(precioDe("antena8"))}) and a 3 m CFD400 cable (${pesos(precioDe("coax"))}): ≈ ${pesos(PRECIOS.repetidor)} installed on its pole. Each gateway radio is a Heltec Mesh Node T114 (${pesos(precioDe("t114"))}) with the same antenna. The budget wallet is the XIAO ESP32S3 + Wio-SX1262 kit with battery and case (≈ ${pesos(PRECIOS.nodo.xiao)}); the sealed T1000-E card with GPS costs ≈ ${pesos(PRECIOS.nodo.t1000)}. In each node's card you choose the equipment and I fill in the power (22 dBm), the gain and the cable loss; if you change a value by hand, it becomes Custom.`),
    }),
  },
  {
    id: "trama",
    claves: ["trama", "red de pagos", "pagos por radio", "whatsapp", "mensajeria", "inteligencia artificial", "consultas a la ia", "que trafica", "trafico de la red", "que pasa por la red", "red de comunicacion", "sembrar", "sembrar la malla", "siembra", "sembrado", "modo sembrar", "como siembro", "como armo la red", "armar la red", "planear la red", "como hago la red", "el problema", "territorios sin conectividad"],
    clavesEn: ["trama", "payment network", "payments by radio", "radio payments", "whatsapp", "messaging", "artificial intelligence", "ai questions", "questions to the ai", "what does it carry", "network traffic", "what goes through the network", "communication network", "seed", "seed the mesh", "seeding", "seeded", "seed mode", "how do i seed", "how do i build the network", "build the network", "plan the network", "how do i make the network", "the problem", "areas without connectivity", "territories without connectivity", "no connectivity"],
    responder: () => ({
      texto:
        tx("Trama es una red de comunicación por radio para llevar la conexión a donde normalmente no llega: por ella van pagos, mensajes de WhatsApp por texto y consultas a la inteligencia artificial. La persona usa su billetera (un radio pequeño enlazado al celular por Bluetooth): firma un pago, escribe un WhatsApp o le pregunta a la IA; el mensaje salta por repetidores solares MeshCore hasta un gateway con Starlink, que verifica el pago con el banco, pasa el WhatsApp a internet o le lleva la consulta a la IA, y la respuesta vuelve por la misma ruta; quien recibe un pago recibe un aviso. «Sembrar la malla» es el modo sencillo para planearla: 1) el Gateway + Internet, en el sitio donde entra el internet (torre de 12 m con mini PC y 4 radios); 2) los repetidores, en tubos de 6 m o en lo alto de las lomas, cada uno al alcance del gateway o de otro conectado; 3) la gente, con su billetera a 1,5 m. Yo calculo con el relieve real quién queda conectado (verde), quién no (rojo) y cuántos saltos hay, propongo dónde poner repetidores, pueblo la zona con personas y pruebo cuánto tráfico aguanta.", "Trama is a radio communication network that takes connectivity where it normally doesn't reach: it carries payments, WhatsApp text messages and questions to artificial intelligence. Each person uses their wallet (a small radio paired with their cell phone over Bluetooth): they sign a payment, write a WhatsApp message or ask the AI; the message hops through solar MeshCore repeaters to a gateway with Starlink, which verifies the payment with the bank, passes the WhatsApp message on to the internet or takes the question to the AI, and the reply comes back along the same route; whoever receives a payment gets a notice. “Seed the mesh” is the simple mode for planning it: 1) the Gateway + Internet, at the site where the internet comes in (12 m tower with a mini PC and 4 radios); 2) the repeaters, on 6 m poles or on hilltops, each within reach of the gateway or of another connected one; 3) the people, with their wallets at 1.5 m. Over the real terrain I calculate who is connected (green), who isn't (red) and how many hops there are, propose where to put repeaters, populate the area with people and test how much traffic it can handle."),
      acciones: [
        { texto: tx("Cargar el ejemplo de malla", "Load the mesh example"), accion: "orden", orden: { tipo: "ejemplo-malla" } },
        { texto: tx("Tour «Sembrar la malla»", "“Seed the mesh” tour"), accion: "recorrido", tour: "sembrar" },
        { texto: tx("Tour «¿Cuánto tráfico aguanta?»", "“How much traffic can it handle?” tour"), accion: "recorrido", tour: "capacidad" },
      ],
    }),
  },
  {
    id: "animacion",
    claves: ["animacion", "animaciones", "parpadea", "parpadean", "brilla", "brillan", "destella", "destellan", "lineas que se mueven", "puntos que se mueven", "flujo", "turquesa", "nube", "nube ia", "ia del gateway", "inteligencia artificial"],
    clavesEn: ["animation", "animations", "blink", "blinks", "blinking", "flash", "flashes", "flashing", "glow", "glows", "shine", "shines", "lines that move", "moving lines", "dots that move", "moving dots", "flow", "turquoise", "cloud", "ai cloud", "gateway ai", "artificial intelligence", "pulse", "pulses"],
    responder: (c) => ({
      texto: tx(`La animación muestra cómo trabaja la malla. Las líneas turquesa avanzan por las rutas hacia el gateway: es por donde viajan los pagos, los WhatsApp y las consultas a la IA. Cada pulso sale de una persona y lo pasan los repetidores (casi siempre el más cercano con buen enlace), que destellan al retransmitir; al llegar, la nube «IA» del gateway se enciende. Las piezas conectadas laten en verde; las que están sin cobertura parpadean en rojo y los repetidores sin red, en naranja. Con «Enviar un mensaje de prueba» se ve además quién oye cada transmisión (se abre una onda y destellan los vecinos), aunque solo el repetidor siguiente de la ruta la pasa; luego la respuesta vuelve por la misma ruta.${c.modo === "sembrar" ? " Se apaga con el interruptor «Animar el flujo de la información» o diciéndome «quita la animación»." : " Se ve en el modo «Sembrar la malla»."}`, `The animation shows how the mesh works. The turquoise lines move along the routes toward the gateway: that's where the payments, WhatsApp messages and AI questions travel. Each pulse leaves from a person and is passed on by the repeaters (almost always the nearest one with a good link), which flash when they retransmit; when it arrives, the gateway's “AI” cloud lights up. Connected pieces pulse in green; those without coverage blink in red, and repeaters without a network, in orange. With “Send a test message” you also see who hears each transmission (a wave spreads out and the neighbors flash), although only the next repeater on the route passes it on; then the reply comes back along the same route.${c.modo === "sembrar" ? " You turn it off with the “Animate the information flow” switch or by telling me “remove the animation”." : " It's shown in the “Seed the mesh” mode."}`),
      acciones: c.red?.alDia && c.red.conectadas.length ? [{ texto: tx("Enviar un mensaje de prueba", "Send a test message"), accion: "orden", orden: { tipo: "mensaje" } }] : undefined,
    }),
  },
  {
    id: "repetidor",
    claves: ["repetidor", "repetidores", "donde pongo el repetidor", "donde pongo", "distancia entre repetidores", "cada cuanto", "cada cuantos km", "torre del repetidor", "lomas"],
    clavesEn: ["repeater", "repeaters", "where do i put the repeater", "where do i put", "where should i put", "where to put", "distance between repeaters", "how often", "every how many km", "how far apart", "repeater tower", "hills", "relay node"],
    responder: (c) => {
      const red = c.red;
      const ahora = red?.repetidores.length
        ? tx(` Ahora hay ${red.repetidores.length} ${red.repetidores.length === 1 ? "repetidor" : "repetidores"}${red.alDia && red.aislados.length ? ` y ${red.aislados.length === 1 ? "uno no alcanza" : `${red.aislados.length} no alcanzan`} la red (${red.aislados.map((a) => a.nombre).join(", ")})` : ""}.`, ` Right now there ${red.repetidores.length === 1 ? "is 1 repeater" : `are ${red.repetidores.length} repeaters`}${red.alDia && red.aislados.length ? ` and ${red.aislados.length === 1 ? "one doesn't reach" : `${red.aislados.length} don't reach`} the network (${red.aislados.map((a) => a.nombre).join(", ")})` : ""}.`)
        : "";
      const radios = (Object.keys(TERRENOS_TRAMA) as (keyof typeof TERRENOS_TRAMA)[]).map((k) => `${TERRENOS_TRAMA[k].nombre.toLowerCase()} ${TERRENOS_TRAMA[k].radioKm} km`).join(", ");
      return {
        texto: tx(`El repetidor de Trama es un SenseCAP Solar Node P1 con antena de 8 dBi en un tubo de 6 m (≈ ${pesos(PRECIOS.repetidor)}), con rol Repetidor: es el único que pasa los pagos y mensajes de los demás. Para que sirva debe alcanzar al gateway o a otro repetidor conectado; si no, queda en naranja. El documento supone este alcance por repetidor con SF11: ${radios} (con SF10 baja a ~80 % y con SF9 a ~65 %); aquí el relieve real lo confirma o lo corrige. Póngalos en lo alto y mire si quedan en verde; o pídame «conecta a los que faltan» y busco las lomas por usted.${ahora}`, `Trama's repeater is a SenseCAP Solar Node P1 with an 8 dBi antenna on a 6 m pole (≈ ${pesos(PRECIOS.repetidor)}), with the Repeater role: it's the only one that passes on other people's payments and messages. To be useful it must reach the gateway or another connected repeater; if not, it stays orange. The document assumes this range per repeater with SF11: ${radios} (with SF10 it drops to ~80% and with SF9 to ~65%); here the real terrain confirms or corrects it. Put them up high and check whether they turn green; or ask me to “connect the missing ones” and I'll find the hills for you.${ahora}`),
        acciones: red?.alDia && red.sinCobertura.length ? [{ texto: tx("Conectar a los que faltan", "Connect the missing ones"), accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } }] : undefined,
      };
    },
  },
  {
    id: "persona",
    claves: ["persona", "personas", "gente", "usuario", "radio de mano", "billetera", "billeteras", "aplicacion", "app", "bluetooth", "familias", "que lleva cada persona", "lo que lleva cada persona", "celular"],
    clavesEn: ["person", "people", "user", "users", "handheld radio", "wallet", "wallets", "app", "application", "bluetooth", "families", "what does each person carry", "what each person carries", "what does a person carry", "cell phone", "cellphone", "phone", "mobile phone"],
    responder: (c) => {
      const red = c.red;
      const ahora = red?.personas.length && red.alDia ? tx(` Ahora: ${red.conectadas.length} de ${red.personas.length} conectadas${red.sinCobertura.length ? `, ${red.sinCobertura.length} sin cobertura` : ""}.`, ` Right now: ${red.conectadas.length} of ${red.personas.length} connected${red.sinCobertura.length ? `, ${red.sinCobertura.length} without coverage` : ""}.`) : "";
      return {
        texto: tx(`Cada persona lleva su billetera: el kit XIAO ESP32S3 + Wio-SX1262 con batería y carcasa (≈ ${pesos(PRECIOS.nodo.xiao)}) o la tarjeta SenseCAP T1000-E, sellada y con GPS (≈ ${pesos(PRECIOS.nodo.t1000)}), enlazada por Bluetooth a la aplicación del celular. Ahí firma sus pagos, escribe por WhatsApp o le consulta a la IA, y lo manda por radio, sin señal celular; es companion: no retransmite los mensajes de otros. Inscribirla cuesta ${pesos(OPERACION_TRAMA.inscripcionUsuario)}. En el mapa la pongo a 1,5 m con antena de 2 dBi. Verde = llega al gateway (el número es cuántos saltos); rojo = no alcanza ningún repetidor; ámbar = llega con más saltos que el límite. Con «Poblar personas» reparto cientos al azar.${ahora}`, `Each person carries their wallet: the XIAO ESP32S3 + Wio-SX1262 kit with battery and case (≈ ${pesos(PRECIOS.nodo.xiao)}) or the sealed SenseCAP T1000-E card with GPS (≈ ${pesos(PRECIOS.nodo.t1000)}), paired over Bluetooth with the app on their cell phone. There they sign their payments, write on WhatsApp or ask the AI, and send it by radio, with no cell signal; it's a companion: it doesn't retransmit other people's messages. Registering a person costs ${pesos(OPERACION_TRAMA.inscripcionUsuario)}. On the map I place them at 1.5 m with a 2 dBi antenna. Green = reaches the gateway (the number is how many hops); red = doesn't reach any repeater; amber = reaches it with more hops than the limit. With “Populate people” I spread hundreds of them at random.${ahora}`),
        acciones: [{ texto: tx("Poblar 250 personas", "Populate 250 people"), accion: "orden", orden: { tipo: "poblar", pedido: { n: 250 } } }],
      };
    },
  },
  {
    id: "mensaje",
    claves: ["como viaja", "como viaja un pago", "como viaja un mensaje", "como viaja un whatsapp", "como viaja una consulta", "viaja el pago", "viaja el mensaje", "pago", "pagos", "comprobante", "acuse", "ack", "mensaje", "mensajes", "inundacion", "flooding", "tiempo en el aire", "airtime", "cuanto tarda", "cuanto demora", "latencia", "retransmision", "colision", "colisiones", "llega el mensaje", "reintentos"],
    clavesEn: ["how does it travel", "how does a payment travel", "how does a message travel", "how does a whatsapp travel", "how does a question travel", "how do messages travel", "how do payments travel", "payment travel", "message travel", "payment", "payments", "receipt", "acknowledgment", "acknowledgement", "ack", "message", "messages", "flooding", "airtime", "time on air", "how long does it take", "how long does a message take", "latency", "retransmission", "collision", "collisions", "does the message arrive", "retries"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      const t = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${f(ms / 1000)} s`);
      const orden = tiempoEnAireMs(bytesDatos(CAPACIDAD_TRAMA.ordenBytes, 1), p);
      const espera = esperaRetransmision(orden, "directa");
      const red = c.red;
      return {
        texto: tx(`Así viaja un pago en MeshCore: la persona firma la orden (${CAPACIDAD_TRAMA.ordenBytes} B) y la transmite; la primera vez se inunda por los repetidores y el gateway le devuelve la ruta, y desde ahí va directo: cada repetidor de la ruta espera un turno al azar (de 0 a ${t(espera.max)}) y la pasa al siguiente. Antes de hablar, cada radio escucha el canal y, si está ocupado, espera. Se confirma con un acuse; si no vuelve, reintenta ${INTENTOS - 1} veces por la ruta y la última por inundación. El gateway verifica el pago con el banco por Starlink, devuelve el comprobante (${CAPACIDAD_TRAMA.comprobanteBytes} B) y quien recibe el pago recibe un aviso. Con ${p.nombre}, la orden ocupa ${t(orden)} en el aire por salto y el pago completo a 2 saltos ≈ ${t(airePagoMs(p))}. Un WhatsApp o una consulta a la IA viajan igual: suben al gateway, salen por Starlink y la respuesta vuelve por la misma ruta (una respuesta larga ocupa más aire). Si dos radios transmiten a la vez donde alguien escucha, chocan: por eso la capacidad de una frecuencia tiene techo.${red?.alDia && red.conectadas.length ? " Pídame «envía un pago desde» una persona y lo verá viajar en el mapa, o «envía 15 pagos al tiempo»." : ""}`, `This is how a payment travels in MeshCore: the person signs the order (${CAPACIDAD_TRAMA.ordenBytes} B) and transmits it; the first time it's flooded through the repeaters and the gateway returns the route, and from then on it goes direct: each repeater on the route waits a random turn (from 0 to ${t(espera.max)}) and passes it to the next one. Before talking, each radio listens to the channel and, if it's busy, waits. It's confirmed with an acknowledgment; if that doesn't come back, it retries ${INTENTOS - 1} times along the route and the last time by flooding. The gateway verifies the payment with the bank over Starlink, returns the receipt (${CAPACIDAD_TRAMA.comprobanteBytes} B), and whoever receives the payment gets a notice. With ${p.nombre}, the order takes ${t(orden)} of airtime per hop and the full payment at 2 hops ≈ ${t(airePagoMs(p))}. A WhatsApp message or an AI question travels the same way: it goes up to the gateway, out over Starlink, and the reply comes back along the same route (a long reply takes more airtime). If two radios transmit at the same time where someone is listening, they collide: that's why a frequency's capacity has a ceiling.${red?.alDia && red.conectadas.length ? " Ask me to “send a payment from” a person and you'll see it travel on the map, or “send 15 payments at once”." : ""}`),
        acciones: red?.alDia && red.conectadas.length ? [{ texto: tx("Enviar un mensaje de prueba", "Send a test message"), accion: "orden", orden: { tipo: "mensaje" } }] : undefined,
      };
    },
  },
  {
    id: "capacidad",
    claves: ["capacidad", "cuantos pagos", "cuantos mensajes", "cuanto trafico", "trafico", "pagos al tiempo", "mensajes al tiempo", "al mismo tiempo", "a la vez", "se revienta", "reventar", "saturacion", "saturar", "satura", "prueba de carga", "carga", "usuarios por frecuencia", "usuarios por sitio", "aguanta", "soporta"],
    clavesEn: ["capacity", "how many payments", "how many messages", "how much traffic", "traffic", "payments at once", "messages at once", "at the same time", "simultaneous", "simultaneously", "gets overloaded", "saturation", "saturate", "saturates", "load test", "load", "users per frequency", "users per site", "handle", "can it handle", "withstand", "supports", "how many users", "how many can it handle"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      const sf = (p.anchoBandaKhz === 250 && p.sf >= 9 && p.sf <= 11 ? p.sf : 11) as SfTrama;
      const ref = SF_TRAMA[sf];
      return {
        texto: tx(`Trama dimensiona cada frecuencia para que el canal no pase del ${CAPACIDAD_TRAMA.canalPicoPct} % en la hora pico: con SF11 un pago ocupa ~9,5 s de aire y caben ~55 por hora (150 usuarios); con SF10, ~105 (280 usuarios); con SF9, ~185 (500 usuarios). Esa capacidad la comparten los pagos, los WhatsApp y las consultas a la IA. Un sitio tiene 4 frecuencias, así que atiende ${SF_TRAMA[11].usuariosFrecuencia * CAPACIDAD_TRAMA.radiosPorSitio} usuarios con SF11. La hora pico se lleva el ${CAPACIDAD_TRAMA.horaPicoNormalPct} % de los mensajes del día (el ${CAPACIDAD_TRAMA.horaPicoMercadoPct} % el día de mercado). Con ${p.nombre} la referencia es ~${ref.pagosHora} pagos por hora por frecuencia. Para verlo con su red: «Poblar personas» y luego «Prueba de carga» en Resultados (5, 15, 25… pagos o mensajes al tiempo) o «¿Hasta cuántos aguanta?», que sube la cantidad hasta que menos del 90 % recibe su respuesta (y le marca desde cuándo la espera pasa de un minuto). En una ráfaga, más de 5 a 10 mensajes en 10 s con SF11 ya hacen fila un minuto. Para la hora pico repetidor por repetidor, use las zonas de popularidad y la «Prueba de estrés».`, `Trama sizes each frequency so that the channel doesn't go over ${CAPACIDAD_TRAMA.canalPicoPct}% at peak hour: with SF11 a payment takes ~9.5 s of airtime and ~55 fit per hour (150 users); with SF10, ~105 (280 users); with SF9, ~185 (500 users). Payments, WhatsApp messages and AI questions share that capacity. A site has 4 frequencies, so it serves ${SF_TRAMA[11].usuariosFrecuencia * CAPACIDAD_TRAMA.radiosPorSitio} users with SF11. Peak hour takes ${CAPACIDAD_TRAMA.horaPicoNormalPct}% of the day's messages (${CAPACIDAD_TRAMA.horaPicoMercadoPct}% on market day). With ${p.nombre} the reference is ~${ref.pagosHora} payments per hour per frequency. To see it with your network: “Populate people” and then “Load test” in Results (5, 15, 25… payments or messages at once) or “How many can it handle?”, which raises the amount until fewer than 90% get their reply (and marks where the wait goes over a minute). In a burst, more than 5 to 10 messages within 10 s with SF11 already queue up for a minute. For peak hour repeater by repeater, use the popularity zones and the “Stress test”.`),
        acciones: [
          { texto: tx("15 pagos al tiempo", "15 payments at once"), accion: "orden", orden: { tipo: "carga", opciones: { mensajes: 15 }, curva: false } },
          { texto: tx("¿Hasta cuántos aguanta?", "How many can it handle?"), accion: "orden", orden: { tipo: "carga", opciones: {}, curva: true } },
          { texto: tx("Tour de capacidad", "Capacity tour"), accion: "recorrido", tour: "capacidad" },
        ],
      };
    },
  },
  {
    id: "estres",
    claves: ["zona de popularidad", "zonas de popularidad", "popularidad", "punto de popularidad", "limite de un punto", "limite del repetidor", "limite de cada punto", "llenar hasta el limite", "cuantas personas soporta", "estabilidad de la red", "prueba de estres", "estres", "estresar", "colapso", "colapsa", "colapsar", "colapsada", "ancho de banda", "hora pico", "dia de mercado", "cuantos usuarios aguanta", "cuantas personas aguanta", "cada repetidor", "consumo por usuario", "cuanto consume", "ciclo de trabajo", "energia del repetidor", "alcance con carga", "hasta donde aguanta"],
    clavesEn: ["popularity zone", "popularity zones", "popularity", "popularity point", "limit of a point", "repeater limit", "limit of the repeater", "limit of each point", "fill to the limit", "fill up to the limit", "how many people can it handle", "how many people can it support", "network stability", "stress test", "stress", "stress the network", "collapse", "collapses", "collapsed", "bandwidth", "peak hour", "rush hour", "market day", "how many users can it handle", "each repeater", "consumption per user", "how much does it consume", "how much does each user consume", "duty cycle", "repeater energy", "range under load", "range with load", "how far can it hold up", "how far does it hold up"],
    responder: () => ({
      texto: tx(`Las zonas de popularidad ponen gente alrededor de un repetidor o del gateway (o de cada uno): por ejemplo 250 personas a 2 km. Se ponen tocando el repetidor (en su tarjeta o en la lista hay «Zona de popularidad»), en Resultados o pidiéndomelo: «por cada antena 250 personas». Ahí escribe la cantidad que quiera y tiene «Poner y probar» (pone la gente y simula la hora pico con todos enviando información), «¿Cuántas aguanta?» (sube solo la gente de ese punto, con el resto de la red como está, hasta encontrar cuántas aguanta sin demora, desde cuántas va lento, desde cuántas se revienta y qué falla primero) y «Llenar hasta el límite», que lo llena y lo confirma. También: «¿cuántas personas aguanta el Repetidor 1?», «llena el gateway hasta su límite» o «el límite de cada punto». La «Prueba de estrés» hace que todas usen la red a su ritmo en la hora pico: ${f(PAGOS_PERSONA_DIA_TRAMA, 1)} mensajes por persona al día entre pagos, WhatsApp y consultas a la IA (el ritmo que supone Trama: 55 por hora con 150 usuarios; si la gente escribe o consulta más, se sube) y el ${CAPACIDAD_TRAMA.horaPicoNormalPct} % en esa hora (${CAPACIDAD_TRAMA.horaPicoMercadoPct} % un día de mercado). Simulo el canal paquete por paquete y mido en cada gateway y repetidor: las personas que entran por él, los mensajes que completan, la espera, qué tanto del canal oye ocupado, cuánto transmite (el tope es el ${TOPE_CICLO_PCT} %), los paquetes que pierde, hasta dónde completa con esa carga frente a su alcance sin carga, y la energía del repetidor solar (${f(ENERGIA_P1.txW, 2)} W al transmitir; el panel de 5 W repone ~${f(ENERGIA_P1.panelW * ENERGIA_P1.horasSol * ENERGIA_P1.eficiencia, 0)} Wh al día). Cada persona gasta unos segundos de aire en la hora pico (~0,1 % del canal con SF11); así 150 personas son el 15 % que diseña Trama. «¿Hasta dónde aguanta cada repetidor?» sube la carga hasta que cada zona se revienta y le dice cuántas personas aguanta; con «comparar ajustes» ve la misma hora pico con más ancho de banda o menos SF (más capacidad, menos alcance).`, `Popularity zones place people around a repeater or the gateway (or around each one): for example 250 people within 2 km. You place them by tapping the repeater (its card or the list has “Popularity zone”), in Results or by asking me: “250 people around each antenna”. There you type the amount you want and you have “Place and test” (places the people and simulates peak hour with everyone sending information), “How many can it handle?” (raises only the people at that point, with the rest of the network as it is, until it finds how many it handles without delay, from how many it gets slow, from how many it gets overloaded and what fails first) and “Fill to the limit”, which fills it and confirms it. Also: “how many people can Repeater 1 handle?”, “fill the gateway to its limit” or “the limit of each point”. The “Stress test” has everyone use the network at their own pace during peak hour: ${f(PAGOS_PERSONA_DIA_TRAMA, 1)} messages per person per day between payments, WhatsApp and AI questions (the pace Trama assumes: 55 per hour with 150 users; if people write or ask more, it goes up) and ${CAPACIDAD_TRAMA.horaPicoNormalPct}% of them in that hour (${CAPACIDAD_TRAMA.horaPicoMercadoPct}% on a market day). I simulate the channel packet by packet and measure at each gateway and repeater: the people who connect through it, the messages they complete, the wait, how busy it hears the channel, how much it transmits (the cap is ${TOPE_CICLO_PCT}%), the packets it loses, how far it completes messages with that load compared with its range without load, and the solar repeater's energy (${f(ENERGIA_P1.txW, 2)} W while transmitting; the 5 W panel puts back ~${f(ENERGIA_P1.panelW * ENERGIA_P1.horasSol * ENERGIA_P1.eficiencia, 0)} Wh a day). Each person uses a few seconds of airtime during peak hour (~0.1% of the channel with SF11); so 150 people are the 15% Trama designs for. “How far can each repeater hold up?” raises the load until each zone gets overloaded and tells you how many people it can handle; with “compare settings” you see the same peak hour with more bandwidth or a lower SF (more capacity, less range).`),
      acciones: [
        { texto: tx("250 personas en cada repetidor", "250 people at each repeater"), accion: "orden", orden: { tipo: "zonas", pedido: { n: 250 }, estres: { rampa: true } } },
        { texto: tx("¿Cuántas aguanta cada punto?", "How many can each point handle?"), accion: "orden", orden: { tipo: "limite", llenar: false, opciones: {} } },
        { texto: tx("Probar la hora pico", "Test the peak hour"), accion: "orden", orden: { tipo: "estres", opciones: {} } },
        { texto: tx("¿Hasta dónde aguanta cada repetidor?", "How far can each repeater hold up?"), accion: "orden", orden: { tipo: "estres", opciones: { rampa: true } } },
      ],
    }),
  },
  {
    id: "poblar",
    claves: ["poblar", "poblar personas", "popular personas", "poblacion", "repartir personas", "personas al azar", "densidad", "disperso", "dispersa", "denso", "densa", "usuarios por km2"],
    clavesEn: ["populate", "populate people", "population", "spread people", "distribute people", "people at random", "random people", "density", "sparse", "dispersed", "dense", "users per km2", "users per square kilometer"],
    responder: () => ({
      texto: tx(`«Poblar personas» (en Resultados, o pidiéndomelo) reparte billeteras al azar, uniformes sobre el terreno, en el área objetivo, en otra área de la regla, alrededor de la red (3 km de cada repetidor) o en toda el área de estudio. Puede dar la cantidad («puebla con 250 personas») o la densidad del documento de Trama: ${CAPACIDAD_TRAMA.densidades.map((d) => `${f(d.valor, d.valor < 1 ? 1 : 0)} usuarios por km² ${d.nombre}`).join(", ")}. Con «solo donde hay señal» las pongo donde la última simulación da servicio. Volver a poblar reparte de nuevo; «quita las pobladas» las borra sin tocar las que puso a mano. En el mapa son puntos pequeños y no entran en el ajuste automático.`, `“Populate people” (in Results, or by asking me) spreads wallets at random, evenly over the terrain, in the target area, in another ruler area, around the network (3 km from each repeater) or over the whole study area. You can give the amount (“populate with 250 people”) or the density from Trama's document: ${CAPACIDAD_TRAMA.densidades.map((d) => `${f(d.valor, d.valor < 1 ? 1 : 0)} users per km² (${d.nombre})`).join(", ")}. With “only where there is signal” I place them where the last simulation gives service. Populating again redistributes them; “remove the populated ones” deletes them without touching the ones you placed by hand. On the map they're small dots and they don't count in the automatic adjustment.`),
      acciones: [{ texto: tx("Poblar 250 personas", "Populate 250 people"), accion: "orden", orden: { tipo: "poblar", pedido: { n: 250 } } }],
    }),
  },
  {
    id: "precios",
    claves: ["precio", "precios", "cuanto cuesta un repetidor", "cuanto cuesta el gateway", "cuanto vale", "cuanto cuesta", "catalogo", "cotizacion", "cotizador", "trm", "presupuesto de equipos", "inversion"],
    clavesEn: ["price", "prices", "how much does a repeater cost", "how much does the gateway cost", "how much is", "how much does it cost", "cost", "costs", "catalog", "catalogue", "quote", "quotation", "trm", "exchange rate", "equipment budget", "investment", "pricing"],
    responder: () => ({
      texto: tx(`Precios del documento de Trama, puestos en Colombia (TRM ${COTIZADOR.trm.toLocaleString("es-CO")} con ${COTIZADOR.colchonPct} % de colchón; lo importado suma ${COTIZADOR.envioPct} % de envío, ${COTIZADOR.arancelPct} % de arancel y ${COTIZADOR.ivaImportPct} % de IVA): repetidor completo en su tubo de 6 m ≈ ${pesos(PRECIOS.repetidor)}; sitio gateway con torre de 12 m, mini PC, hub, UPS, tierra, kit solar y 4 radios ≈ ${pesos(PRECIOS.sitioBase + 4 * PRECIOS.radio)}; Starlink con su kit solar ≈ ${pesos(PRECIOS.starlink)} más ${pesos(PRECIOS.starlinkMes)} al mes (plan comercial ${pesos(OPERACION_TRAMA.starlinkMesComercial)}); enlace WiFi punto a punto ≈ ${pesos(PRECIOS.enlace)}; billetera XIAO ≈ ${pesos(PRECIOS.nodo.xiao)} o T1000-E ≈ ${pesos(PRECIOS.nodo.t1000)}. Instalar un sitio cuesta ${pesos(OPERACION_TRAMA.instalacionSitio)}, un repetidor ${pesos(OPERACION_TRAMA.instalacionRepetidor)} e inscribir a una persona ${pesos(OPERACION_TRAMA.inscripcionUsuario)}; mantener un sitio, ${pesos(OPERACION_TRAMA.mantenimientoSitioMes)} al mes. Pregúnteme «¿cuánto cuesta la red para el Meta?» y lo dimensiono.`, `Prices from Trama's document, landed in Colombia (TRM exchange rate ${numeroLocal(COTIZADOR.trm)} with a ${COTIZADOR.colchonPct}% cushion; imports add ${COTIZADOR.envioPct}% shipping, ${COTIZADOR.arancelPct}% tariff and ${COTIZADOR.ivaImportPct}% VAT): complete repeater on its 6 m pole ≈ ${pesos(PRECIOS.repetidor)}; gateway site with 12 m tower, mini PC, hub, UPS, grounding, solar kit and 4 radios ≈ ${pesos(PRECIOS.sitioBase + 4 * PRECIOS.radio)}; Starlink with its solar kit ≈ ${pesos(PRECIOS.starlink)} plus ${pesos(PRECIOS.starlinkMes)} per month (business plan ${pesos(OPERACION_TRAMA.starlinkMesComercial)}); point-to-point WiFi link ≈ ${pesos(PRECIOS.enlace)}; XIAO wallet ≈ ${pesos(PRECIOS.nodo.xiao)} or T1000-E ≈ ${pesos(PRECIOS.nodo.t1000)}. Installing a site costs ${pesos(OPERACION_TRAMA.instalacionSitio)}, a repeater ${pesos(OPERACION_TRAMA.instalacionRepetidor)} and registering a person ${pesos(OPERACION_TRAMA.inscripcionUsuario)}; maintaining a site, ${pesos(OPERACION_TRAMA.mantenimientoSitioMes)} per month. Ask me “how much does the network cost for Meta?” and I'll size it.`),
    }),
  },
  {
    id: "dimensionamiento",
    claves: ["dimensionar", "dimensionamiento", "por departamento", "cuanto cuesta la red", "cobertura y escala", "escala", "vision de conjunto", "todo el pais", "cuantos sitios", "cuantos starlink", "adopcion", "adultos sin canal"],
    clavesEn: ["size the network", "sizing", "dimensioning", "by department", "per department", "how much does the network cost", "how much would the network cost", "how much is the network", "network cost", "cost of the network", "coverage and scale", "scale", "scaling", "overview", "the whole country", "whole country", "all of colombia", "how many sites", "how many starlinks", "how many starlink", "adoption", "adults without a channel"],
    responder: () => {
      const top = DEPARTAMENTOS_TRAMA.slice(0, 5).map((d) => d.nombre).join(", ");
      return {
        texto: tx(`Dimensiono como el documento de Trama: cada repetidor cubre un hexágono (2,598 × r², con r según el terreno y el SF), hace falta una radio cada 150 usuarios con SF11, un sitio reúne hasta 4 radios y 19 celdas, y cada Starlink alimenta 4 sitios en plano o sabana, 2 en montaña y 1 en ríos o selva; manda la cobertura o la capacidad, la que pida más. Por departamento uso los adultos rurales sin canal digital (DANE) con una adopción del 30 % y la parte habitada del territorio. Los que más gente sin canal tienen: ${top}. Pregúnteme «¿cuánto cuesta la red para el Chocó?», «¿y con 50 % de adopción y SF10?», «¿para todo el país?» o «dimensiona 5.000 usuarios en 800 km² de sabana».`, `I size it the way Trama's document does: each repeater covers a hexagon (2.598 × r², with r depending on the terrain and the SF), you need one radio per 150 users with SF11, a site holds up to 4 radios and 19 cells, and each Starlink feeds 4 sites on flat land or savanna, 2 in the mountains and 1 in rivers or jungle; whichever demands more, coverage or capacity, decides. By department I use the rural adults without a digital channel (DANE) with 30% adoption and the inhabited part of the territory. Those with the most people without a channel: ${top}. Ask me “how much does the network cost for Chocó?”, “and with 50% adoption and SF10?”, “for the whole country?” or “size 5,000 users over 800 km² of savanna”.`),
        acciones: [{ texto: tx("La red para el Chocó", "The network for Chocó"), accion: "orden", orden: { tipo: "trama-departamento", id: "choco", adopcionPct: 30, sf: 11, nodo: "xiao" } }],
      };
    },
  },
  {
    id: "letra-pequena",
    claves: ["letra pequena", "supuestos", "limitaciones", "advertencias", "riesgos", "que tan confiables", "son exactos los numeros", "estimaciones"],
    clavesEn: ["fine print", "small print", "assumptions", "limitations", "warnings", "caveats", "risks", "how reliable are", "how reliable are the numbers", "are the numbers exact", "are the numbers accurate", "estimates", "disclaimer"],
    responder: () => ({
      texto: tx("La letra pequeña: las cifras de Trama son estimaciones de planeación. La capacidad (9,5 s por pago con SF11, el canal al 15 % en la hora pico) se debe medir en una red piloto; el alcance por terreno es un supuesto que aquí se corrige con el relieve real; los precios son de referencia (TRM del día, envío, arancel e IVA) y cambian con el proveedor; los datos de los departamentos son del DANE y pueden diferir de otras fuentes. En el simulador, el modelo de propagación se desvía unos 3 dB de Radio Mobile en los enlaces de prueba, la prueba de carga supone un aviso de 126 B y 1,5 s del banco y mide cada mensaje con el tamaño de un pago (un WhatsApp largo o una respuesta larga de la IA ocupan más aire), y el ancho de banda de 250 kHz se dedujo de los tiempos del documento (conviene confirmarlo con el Inge, igual que la banda: aquí vale de 915 a 928 MHz).", "The fine print: Trama's figures are planning estimates. The capacity (9.5 s per payment with SF11, the channel at 15% at peak hour) must be measured on a pilot network; the range per terrain type is an assumption that is corrected here with the real terrain; the prices are for reference (the day's TRM exchange rate, shipping, tariff and VAT) and change with the supplier; the department data come from DANE and may differ from other sources. In the simulator, the propagation model deviates about 3 dB from Radio Mobile on the test links, the load test assumes a 126 B notice and 1.5 s at the bank and measures each message at the size of a payment (a long WhatsApp message or a long AI reply takes more airtime), and the 250 kHz bandwidth was inferred from the document's timings (worth confirming with the Inge, as is the band: here it's 915 to 928 MHz)."),
    }),
  },
  {
    id: "sin-cobertura",
    claves: ["sin cobertura", "por que esta en rojo", "esta en rojo", "estan en rojo", "no se conecta", "no se conectan", "no alcanza", "desconectada", "desconectado", "aislado", "aislada", "por que no llega", "no llegan"],
    clavesEn: ["no coverage", "without coverage", "why is it red", "it is red", "they are red", "why are they red", "is red", "not connected", "does not connect", "do not connect", "can not connect", "not connect", "does not reach", "do not reach", "not reach", "disconnected", "isolated", "no signal", "not have signal", "not have coverage", "without signal", "out of range", "why is it orange"],
    responder: (c) => {
      const red = c.red;
      const r = c.resultado;
      if (!red?.alDia || !r) return { texto: tx("Una persona queda en rojo cuando ningún nodo de la red le llega con al menos 20 dB, y un repetidor queda en naranja cuando no alcanza al gateway ni a otro repetidor conectado. Las causas: la distancia, una loma en medio, árboles o poca altura. Simule y le digo cuál es el caso.", "A person turns red when no node in the network reaches them with at least 20 dB, and a repeater turns orange when it doesn't reach the gateway or another connected repeater. The causes: distance, a hill in between, trees or too little height. Simulate and I'll tell you which case it is.") };
      const nombres = new Map(c.antenas.map((a) => [a.id, a.nombre]));
      const detalle = [...red.sinCobertura, ...red.aislados].slice(0, 4).map((a) => {
        const mejor = r.enlaces.filter((e) => e.a === a.id || e.b === a.id).sort((x, y) => y.margen - x.margen)[0];
        return mejor ? tx(`${a.nombre}: su mejor enlace es con ${nombres.get(mejor.a === a.id ? mejor.b : mejor.a)} (${f(mejor.margen)} dB a ${f(mejor.distanciaKm)} km; se necesitan 20 dB)`, `${a.nombre}: its best link is with ${nombres.get(mejor.a === a.id ? mejor.b : mejor.a)} (${f(mejor.margen)} dB at ${f(mejor.distanciaKm)} km; 20 dB are needed)`) : tx(`${a.nombre}: no tiene ningún nodo cerca`, `${a.nombre}: has no node nearby`);
      });
      if (!detalle.length) return { texto: tx("Ahora no hay nadie sin cobertura: todas las piezas llegan al gateway. 🙂", "Right now nobody is without coverage: every piece reaches the gateway. 🙂") };
      return {
        texto: tx(`${detalle.join("; ")}. Para arreglarlo: ponga un repetidor en una loma entre los dos, suba el repetidor más cercano o acérquelo. También puedo proponerlo yo con el relieve real.`, `${detalle.join("; ")}. To fix it: put a repeater on a hill between the two, raise the nearest repeater or move it closer. I can also propose it myself over the real terrain.`),
        acciones: red.sinCobertura.length ? [{ texto: tx("Conectar a los que faltan", "Connect the missing ones"), accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } }] : undefined,
      };
    },
  },
  {
    id: "recorrido",
    claves: ["recorrido guiado", "tour", "tours", "guia", "guiame", "muestrame", "ensename", "tutorial", "ayuda", "paso a paso", "aprender"],
    clavesEn: ["guided tour", "tour", "tours", "guide", "guide me", "show me", "teach me", "tutorial", "help", "step by step", "learn"],
    responder: () => menuTours(),
  },
  {
    id: "gracias",
    claves: ["gracias", "muchas gracias", "listo", "perfecto", "excelente", "genial", "buen trabajo", "bien hecho", "excelente trabajo", "te luciste", "muy bien"],
    clavesEn: ["thanks", "thank you", "thanks a lot", "thank you very much", "many thanks", "thx", "ok thanks", "okay thanks", "perfect", "excellent", "great", "awesome", "good job", "well done", "great job", "excellent work", "nice work", "nice job", "very good", "cheers", "got it", "cool"],
    responder: () => ({ texto: tx("Con gusto. Aquí sigo si necesita algo más.", "You're welcome. I'm here if you need anything else.") }),
  },
];

/** Recomendaciones para dejar la mayor cobertura posible, con lo que hay ahora en el escenario. */
function coberturaMaxima(c: ContextoMelki): Respuesta {
  const r = c.resultado;
  const red = c.red;
  const p = presetPorId(c.parametros.preset);
  let ahora = "";
  if (c.modo === "sembrar" && red?.alDia && red.personas.length) ahora = tx(` Ahora llegan al gateway ${red.conectadas.length} de ${red.personas.length} personas${red.aislados.length ? ` y ${red.aislados.length === 1 ? "un repetidor no alcanza" : `${red.aislados.length} repetidores no alcanzan`} la red` : ""}.`, ` Right now ${red.conectadas.length} of ${red.personas.length} people reach the gateway${red.aislados.length ? ` and ${red.aislados.length === 1 ? "one repeater doesn't reach" : `${red.aislados.length} repeaters don't reach`} the network` : ""}.`);
  else if (r && !c.desactualizado) ahora = tx(` Ahora: ${textoCoberturaUtil(r)}.`, ` Right now: ${textoCoberturaUtil(r)}.`);
  const texto = [
    tx(`Para la mayor cobertura posible, lo que más rinde es la altura del sitio: un repetidor en una loma suele cubrir más que una torre más alta en el plano.${ahora} Después, que cada repetidor quede enlazado con un margen sólido y bien repartido, y luego la antena y la radio.`, `For the greatest possible coverage, what pays off most is the height of the site: a repeater on a hill usually covers more than a taller tower on flat ground.${ahora} Next, each repeater should be linked with a solid margin and well spread out, and after that come the antenna and the radio.`),
    tx("• Lo alto primero: ponga el gateway y los repetidores en lomas o puntos despejados, por encima de los árboles y los techos; si un equipo queda debajo de la vegetación, pierde mucha señal.", "• High ground first: put the gateway and the repeaters on hills or open spots, above the trees and the roofs; if a device ends up under the vegetation, it loses a lot of signal."),
    tx("• Línea de vista: entre dos nodos no debe haber lomas en medio; mire el perfil del enlace y que la zona de Fresnel quede despejada. Si una loma tapa, un repetidor encima de ella resuelve dos enlaces.", "• Line of sight: there shouldn't be hills between two nodes; check the link profile and make sure the Fresnel zone is clear. If a hill is in the way, a repeater on top of it solves two links."),
    tx("• Repartir la malla: cada repetidor al alcance del gateway o de otro conectado (mínimo 30 dB para un enlace sólido), sin amontonarlos, y con dos caminos donde se pueda («con respaldo»), para que un equipo caído no deje gente sin red.", "• Spread the mesh: each repeater within reach of the gateway or of another connected one (at least 30 dB for a solid link), without bunching them up, and with two paths wherever possible (“with backup”), so that one device going down doesn't leave people without a network."),
    tx("• El gateway al centro de la zona: así hay menos saltos y nadie pasa el límite; con zonas muy lejanas, un segundo gateway rinde más que muchos saltos.", "• The gateway in the middle of the area: that way there are fewer hops and nobody goes over the limit; for very distant areas, a second gateway pays off more than many hops."),
    tx(`• Radio y antena: un SF más alto llega más lejos (SF11 más que SF10 o SF9) a cambio de menos capacidad; ahora usa ${p.nombre}. La antena de 8 dBi omnidireccional cubre alrededor; una sectorial o una Yagi llevan la señal más lejos hacia donde falta, y casi nada hacia atrás.`, `• Radio and antenna: a higher SF reaches farther (SF11 more than SF10 or SF9) in exchange for less capacity; you're now using ${p.nombre}. The 8 dBi omnidirectional antenna covers all around; a sector antenna or a Yagi takes the signal farther toward where it's missing, and almost nothing backward.`),
    tx("• La gente: la billetera va a 1,5 m; en campo, subirla un poco o salir de debajo de los árboles mejora mucho la señal.", "• The people: the wallet sits at 1.5 m; in the field, raising it a little or stepping out from under the trees improves the signal a lot."),
    tx("Yo lo hago por usted: «ajústamelo para la mayor cobertura posible» compara lomas cercanas, alturas hasta 30 m, antenas sectoriales y repetidores de apoyo, y le da la opción de máxima cobertura con su costo; «conecta a los que faltan» siembra repetidores donde hay gente sin señal; y «cubre 5 km a la redonda con respaldo» diseña una malla nueva.", "I'll do it for you: “adjust it for the greatest possible coverage” compares nearby hills, heights up to 30 m, sector antennas and support repeaters, and gives you the maximum coverage option with its cost; “connect the missing ones” seeds repeaters where there are people without signal; and “cover 5 km around with backup” designs a new mesh."),
  ].join("\n");
  const acciones: AccionRespuesta[] = [];
  if (r && !c.desactualizado) acciones.push({ texto: tx("Proponer la máxima cobertura", "Propose maximum coverage"), accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "maxima", opciones: {}, avisos: [] } });
  if (c.modo === "sembrar" && red?.alDia && red.sinCobertura.length) acciones.push({ texto: tx("Conectar a los que faltan", "Connect the missing ones"), accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } });
  if (!r && c.antenas.length) acciones.push({ texto: tx("Simular ahora", "Simulate now"), accion: "simular" });
  if (!c.antenas.length) acciones.push({ texto: tx("Cargar el ejemplo de malla", "Load the mesh example"), accion: "orden", orden: { tipo: "ejemplo-malla" } });
  return { texto, acciones: acciones.length ? acciones : undefined };
}

/* ───────────── Tours guiados ───────────── */

const opcionTour = (id: IdTour, recomendado = false): AccionRespuesta => {
  const x = TOURS.find((q) => q.id === id)!;
  return { texto: tx(`${x.nombre}${recomendado ? " (recomendado)" : ""} · ${x.minutos} min`, `${x.nombre}${recomendado ? " (recommended)" : ""} · ${x.minutos} min`), detalle: x.detalle, accion: "recorrido", tour: id };
};

/** Melki pregunta qué tour quiere hacer; el tutorial básico va primero. */
export function menuTours(): Respuesta {
  return {
    texto:
      tx("¿Qué tour quiere hacer? En los prácticos usted hace cada paso en la pantalla (o me dice «Hágalo por mí»), puede omitir pasos o salir cuando quiera, y su escenario queda tal cual.", "Which tour would you like to take? In the hands-on ones you do each step on the screen (or tell me “Do it for me”), you can skip steps or leave whenever you like, and your scenario stays exactly as it is."),
    acciones: TOURS.map((x) => opcionTour(x.id, x.id === "basico")),
  };
}

/** Palabras que dicen «quiero un tour»; sin ellas no se interrumpe una pregunta normal. */
const PIDE_TOUR = /\b(tour|tours|recorrido|tutorial|guia|guiame|guiado|paso a paso|ensename|ensenar|ensenarme|aprender)\b|\bmuestrame como\b/;

/** Tema de cada tour, para atender «hazme el tour de Radio Mobile» o «tutorial básico». */
const TEMA_TOUR: [IdTour, RegExp][] = [
  ["capacidad", /\b(capacidad|carga|poblar|poblacion|pagos|trafico|aguanta|revienta|satura\w*|estres|popularidad|colaps\w*|hora pico)\b/],
  ["sembrar", /\b(sembrar|siembra|sembrado|trama|gateway|repetidor\w*|personas|gente)\b/],
  ["basico", /\b(basico|basica|primera simulacion|principiante|desde cero|lo basico|empezar)\b/],
  ["pantalla", /\b(pantalla|partes|botones|interfaz|cada parte)\b/],
  ["radiomobile", /\b(radio ?mobile|propagacion|longley|confiabilidad|direccional|yagi|dbm|radioenlace|radio enlace|informe)\b/],
  ["medir", /\b(medir|mido|medicion|regla|exportar|kmz|google earth|distancias?|perfil)\b/],
  ["mesh", /\b(mesh|malla|red|saltos|pasarela|varios nodos)\b/],
  ["voz", /\b(asistente melki|manos libres|jarvis|por voz|de voz|comandos de voz|hablando|escuchar\w*)\b/],
  ["melki", /\b(melki|hablar|hablarte|chat|dictar|dictado|voz|microfono|ordenes|pedirte)\b/],
];

/**
 * Lo mismo en inglés: «give me a tour», «teach me to measure», «show me how to seed the mesh», «basic tutorial». Sin
 * «walkthrough» ni «walk me through»: eso es el recorrido de la red (el robot), no un tour. «How do I use the ruler?»
 * tampoco pide un tour (como «¿cómo uso la regla?»): lo contesta el tema de la regla.
 */
const PIDE_TOUR_EN = /\b(tours?|tutorials?|guide|guide me|guided|step by step|teach me|i want to learn|i would like to learn|learn how|learn to|show me how)\b/;
const TEMA_TOUR_EN: [IdTour, RegExp][] = [
  ["capacidad", /\b(capacity|load|populat\w*|payments|traffic|handle|withstand|overload\w*|saturat\w*|stress|popularity|collaps\w*|peak hour)\b/],
  ["sembrar", /\b(seed|seeding|sow|sowing|trama|gateway|repeaters?|people|persons?)\b/],
  ["basico", /\b(basic|basics|first simulation|beginners?|from scratch|getting started|get started|start)\b/],
  ["pantalla", /\b(screen|parts|buttons|interface|each part|layout)\b/],
  ["radiomobile", /\b(radio ?mobile|propagation|longley|reliability|directional|yagi|dbm|radio link|link report|report)\b/],
  ["medir", /\b(measur\w*|ruler|export\w*|kmz|google earth|distances?|profile)\b/],
  ["mesh", /\b(mesh|network|hops|several nodes|multiple nodes|many nodes)\b/],
  ["voz", /\b(melki assistant|hands free|jarvis|by voice|voice commands|voice assistant|talking|listen\w*)\b/],
  ["melki", /\b(melki|talk|talk to you|chat|dictate|dictation|voice|microphone|commands|orders|ask you)\b/],
];

/** Si la frase pide un tour, responde con ese tour (o con el menú si no dice cuál). */
export function pedidoDeTour(pregunta: string, lengua?: Idioma): Respuesta | null {
  let tema: IdTour | null;
  if (entenderEnIngles(pregunta, lengua)) {
    const t = ` ${normalizarIngles(pregunta)} `;
    if (!PIDE_TOUR_EN.test(t)) return null;
    tema = TEMA_TOUR_EN.find(([, re]) => re.test(t))?.[0] ?? (/\btutorials?\b/.test(t) ? "basico" : null);
  } else {
    const t = ` ${normalizar(pregunta)} `;
    if (!PIDE_TOUR.test(t)) return null;
    // «El recorrido de la red» no es un tour: es el robot explicando cada punto (salvo «recorrido guiado», «tutorial»…)
    if (/\brecorr\w*\b/.test(t) && !/\b(tour|tours|tutorial|guia|guiame|guiado|guiados|ensename|ensenar|ensenarme|aprender)\b/.test(t)) return null;
    tema = TEMA_TOUR.find(([, re]) => re.test(t))?.[0] ?? (/\btutorial\b/.test(t) ? "basico" : null);
  }
  if (!tema) return menuTours();
  const x = TOURS.find((q) => q.id === tema)!;
  return {
    texto: tx(`Con gusto: «${x.nombre}» (${x.minutos} min). ${x.detalle}${x.practica ? " Lo hacemos en un escenario de práctica; el suyo queda tal cual." : ""}`, `Gladly: “${x.nombre}” (${x.minutos} min). ${x.detalle}${x.practica ? " We'll do it in a practice scenario; yours stays exactly as it is." : ""}`),
    acciones: [
      { texto: tx(`Empezar «${x.nombre}»`, `Start “${x.nombre}”`), accion: "recorrido", tour: x.id },
      { texto: tx("Ver todos los tours", "See all the tours"), accion: "tours" },
    ],
  };
}

/**
 * Cómo se puede nombrar un nodo en una pregunta en inglés: su nombre y, si es un nombre por defecto del español, el
 * mismo en inglés («Repetidor 3» → «repeater 3», «Persona 1» → «person 1», «Ejemplo» → «example»).
 */
function nombresEnIngles(nombre: string): string[] {
  const n = normalizarIngles(nombre);
  const alias = n
    .replace(/^repetidor\b/, "repeater")
    .replace(/^persona\b/, "person")
    .replace(/^apoyo\b/, "support")
    .replace(/^antena\b/, "antenna")
    .replace(/^nodo\b/, "node")
    .replace(/^torre\b/, "tower")
    .replace(/^ejemplo$/, "example");
  return alias === n ? [n] : [n, alias];
}

/** Respuesta sobre una antena nombrada en la pregunta (alcance, ruta, área). «ingles»: la pregunta viene en inglés. */
function sobreAntena(t: string, c: ContextoMelki, ingles = false): Respuesta | null {
  const antena = ingles
    ? [...c.antenas].sort((a, b) => b.nombre.length - a.nombre.length).find((a) => a.nombre.length > 2 && nombresEnIngles(a.nombre).some((n) => t.includes(` ${n} `)))
    : [...c.antenas].sort((a, b) => b.nombre.length - a.nombre.length).find((a) => a.nombre.length > 2 && t.includes(normalizar(a.nombre)));
  if (!antena) return null;
  const r = c.resultado;
  const s = r?.antenas.find((x) => x.id === antena.id);
  const n = r?.nodos.find((x) => x.id === antena.id);
  const nombres = new Map(c.antenas.map((a) => [a.id, a.nombre]));
  const destino = c.modo === "sembrar" ? "al gateway" : "a la pasarela";
  // Nodos de campo (personas): no tienen alcance propio; importa si llegan a la red
  if (r && !s && n && !c.desactualizado) {
    if (n.saltos === null) {
      const mejor = r.enlaces.filter((e) => e.a === antena.id || e.b === antena.id).sort((x, y) => y.margen - x.margen)[0];
      const otro = mejor ? nombres.get(mejor.a === antena.id ? mejor.b : mejor.a) : null;
      return {
        texto: tx(`${antena.nombre} no llega ${destino}${mejor && otro ? `: su mejor enlace es con ${otro} (${f(mejor.margen)} dB a ${f(mejor.distanciaKm)} km; se necesitan 20 dB)` : ""}. Acérquelo, súbalo o ponga un repetidor en una loma entre los dos.`, `${antena.nombre} doesn't reach the gateway${mejor && otro ? `: its best link is with ${otro} (${f(mejor.margen)} dB at ${f(mejor.distanciaKm)} km; 20 dB are needed)` : ""}. Move it closer, raise it or put a repeater on a hill between the two.`),
        acciones: c.modo === "sembrar" ? [{ texto: tx(`Conectar a ${antena.nombre}`, `Connect ${antena.nombre}`), accion: "orden", orden: { tipo: "sembrar", destino: { id: antena.id } } }] : undefined,
      };
    }
    return { texto: tx(`${antena.nombre} llega ${destino} en ${n.saltos} ${n.saltos === 1 ? "salto" : "saltos"} (${n.ruta.map((id) => nombres.get(id)).join(" → ")})${n.cuelloDb !== null ? `, con ${f(n.cuelloDb)} dB en su enlace más débil` : ""}${n.saltos > c.parametros.limiteSaltos ? `; pasa el límite de ${c.parametros.limiteSaltos} saltos` : ""}.`, `${antena.nombre} reaches the gateway in ${n.saltos} ${n.saltos === 1 ? "hop" : "hops"} (${n.ruta.map((id) => nombres.get(id)).join(" → ")})${n.cuelloDb !== null ? `, with ${f(n.cuelloDb)} dB on its weakest link` : ""}${n.saltos > c.parametros.limiteSaltos ? `; it goes over the limit of ${c.parametros.limiteSaltos} hops` : ""}.`) };
  }
  if (!r || !s) {
    return { texto: tx(`${antena.nombre} está a ${f(antena.alturaM)} m con ${f(antena.gananciaDbi)} dBi. ${antena.activa ? "Simule para conocer su alcance." : "Está excluida de la simulación."}`, `${antena.nombre} is at ${f(antena.alturaM)} m with ${f(antena.gananciaDbi)} dBi. ${antena.activa ? "Simulate to find out its range." : "It's excluded from the simulation."}`), acciones: antena.activa ? [{ texto: tx("Simular ahora", "Simulate now"), accion: "simular" }] : undefined };
  }
  let texto = tx(`${antena.nombre}: terreno a ${s.elevacionM} m, alcance con servicio ${s.alcanceLimitado ? "de al menos " : ""}${f(s.alcanceKm, 2)} km y ${f(s.areaServicioKm2)} km² servidos; da la mejor señal en ${f(s.porcentajeMejorServidor, 0)} % del área.`, `${antena.nombre}: ground at ${s.elevacionM} m, range with service of ${s.alcanceLimitado ? "at least " : ""}${f(s.alcanceKm, 2)} km and ${f(s.areaServicioKm2)} km² served; it gives the best signal over ${f(s.porcentajeMejorServidor, 0)}% of the area.`);
  if (antena.pasarela) texto += tx(" Es pasarela.", " It's a gateway.");
  else if (!n || n.saltos === null) texto += tx(" No tiene ruta hacia la pasarela.", " It has no route to the gateway.");
  else texto += tx(` Llega a la pasarela en ${n.saltos} ${n.saltos === 1 ? "salto" : "saltos"} (${n.ruta.map((id) => nombres.get(id)).join(" → ")})${n.cuelloDb !== null ? `, con ${f(n.cuelloDb)} dB en su enlace más débil` : ""}.`, ` It reaches the gateway in ${n.saltos} ${n.saltos === 1 ? "hop" : "hops"} (${n.ruta.map((id) => nombres.get(id)).join(" → ")})${n.cuelloDb !== null ? `, with ${f(n.cuelloDb)} dB on its weakest link` : ""}.`);
  return { texto };
}

/** La respuesta de un tema por su nombre (la usa el Modelo Melki cuando entendió de qué se pregunta). */
export function responderTema(id: string, c: ContextoMelki): Respuesta | null {
  const tema = TEMAS.find((t) => t.id === id);
  return tema ? tema.responder(c) : null;
}

/**
 * Responde una pregunta o una charla. Con la pantalla en español, como siempre (y si está claramente en inglés, o se sabe
 * que vino en inglés, la entiende en inglés). Con la pantalla en inglés, entiende la pregunta en inglés (y si está
 * claramente en español, en español); si en inglés no la entiende y trae palabras del español («gracias», «hola Melki»),
 * la intenta en español. La respuesta sale en el idioma de la pantalla.
 */
export function responder(pregunta: string, c: ContextoMelki): Respuesta {
  if (!entenderEnIngles(pregunta, c.lengua)) return responderCon(pregunta, c, KIT_ES);
  const r = responderCon(pregunta, c, KIT_EN);
  if (!r.noEntendido || detectarIdioma(pregunta).es === 0) return r;
  const enEspanol = responderCon(pregunta, c, KIT_ES);
  return enEspanol.noEntendido ? r : enEspanol;
}

/** Temas que son charla, no del simulador (con su nombre o por escrito se contestan; sin él, por voz, pasan). */
export const TEMAS_DE_CHARLA = new Set(["saludo", "gracias"]);

function responderCon(pregunta: string, c: ContextoMelki, kit: Kit): Respuesta {
  const t = ` ${kit.normalizar(pregunta)} `;
  if (!t.trim()) return { texto: tx("Escríbame su pregunta.", "Write me your question.") };
  const tour = pedidoDeTour(pregunta);
  if (tour) return tour;
  const limpio = t.trim().replace(/[.!?]+$/g, "").trim();
  if (kit.charla.test(limpio)) {
    const s = tratoDe(c);
    return { texto: tx(`Muy bien${s ? `, ${s}` : ""}, gracias por preguntar. Estoy listo y a sus órdenes: ¿qué construimos hoy en el simulador? Por ejemplo, ${EJEMPLOS_RETOMAR}.`, `Very well${s ? `, ${s}` : ""}, thank you for asking. I'm ready and at your service: what shall we build in the simulator today? For example, ${EJEMPLOS_RETOMAR_EN}.`), fueraDeTema: true };
  }
  if (kit.meEscuchas.test(limpio)) {
    const s = tratoDe(c);
    return { texto: tx(`Sí${s ? `, ${s}` : ""}, le escucho perfectamente. ¿Qué hacemos? Por ejemplo, ${EJEMPLOS_RETOMAR}.`, `Yes${s ? `, ${s}` : ""}, I hear you perfectly. What shall we do? For example, ${EJEMPLOS_RETOMAR_EN}.`), fueraDeTema: true };
  }
  if (kit.elogio.test(limpio)) {
    const s = tratoDe(c);
    return { texto: tx(`Muchas gracias${s ? `, ${s}` : ""}; es un gusto ayudarle. ¿Qué más hacemos?`, `Thank you very much${s ? `, ${s}` : ""}; it's a pleasure to help. What else shall we do?`), fueraDeTema: true };
  }
  const saludoDia = limpio.match(kit.saludoDelDia);
  if (saludoDia) {
    const s = tratoDe(c);
    if (saludoDia[1] === "good night") return { texto: tx(`Buenas noches${s ? `, ${s}` : ""}. Que descanse; aquí sigo cuando me necesite.`, `Good night${s ? `, ${s}` : ""}. Rest well; I'll be here whenever you need me.`), fueraDeTema: true };
    const dicho = saludoDia[1].replace("dias", "días");
    return { texto: tx(`${dicho.charAt(0).toUpperCase()}${dicho.slice(1)}${s ? `, ${s}` : ""}. Es un gusto saludarle. ¿En qué le sirvo hoy?`, `${SALUDOS_EN[saludoDia[1]] ?? "Hello"}${s ? `, ${s}` : ""}. A pleasure to greet you. How may I help you today?`), fueraDeTema: true };
  }
  // Como una persona: la hora y la fecha del equipo
  if (kit.pideHora.test(limpio)) {
    const s = tratoDe(c);
    return { texto: `${horaHablada(new Date())}${s ? `, ${s}` : ""}.`, fueraDeTema: true };
  }
  if (kit.pideFecha.test(limpio)) {
    const s = tratoDe(c);
    return { texto: tx(`Hoy es ${new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${s ? `, ${s}` : ""}.`, `Today is ${fechaLocal(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${s ? `, ${s}` : ""}.`), fueraDeTema: true };
  }
  if (kit.dondeEstamos.test(t) && !kit.palabrasDeNodo.test(t))
    return c.vista
      ? { texto: tx(`Estamos viendo ${c.vista}. ¿Le armo una red sostenible que cubra todo el municipio?`, `We're looking at ${c.vista}. Shall I build you a sustainable network that covers the whole municipality?`), acciones: [{ texto: tx("Sí, la red de todo el municipio", "Yes, the network for the whole municipality"), accion: "orden", orden: { tipo: "red-municipio", sostenible: true } }] }
      : { texto: tx("El centro del mapa está fuera de Colombia o los límites aún no cargan. Dígame un municipio y lo llevo: «ubícame en Barranca de Upía, Meta».", "The center of the map is outside Colombia, or the boundaries haven't loaded yet. Tell me a municipality and I'll take you there: “take me to Barranca de Upía, Meta”.") };
  // Fuera del simulador (aunque alguna palabra coincida con un tema, como «¿cómo está el clima?»)
  if (kit.fueraDeTema.test(t) && !kit.sobreIaVoz.test(t) && !kit.delSimuladorEstricto.test(t)) return respuestaFueraDeTema(c);
  const especifica = sobreAntena(t, c, kit.ingles);
  const palabras = new Set(t.trim().split(" "));
  let mejor: { tema: Tema; puntos: number } | null = null;
  // v17.3 · «Gracias, Melki», «thanks Melki», «LoRa, Melki»: su nombre es a quién se le habla; empatado, gana lo otro
  const gana = (puntos: number, antes: { tema: Tema; puntos: number } | null) =>
    puntos > (antes?.puntos ?? 0) || (antes !== null && puntos > 0 && puntos === antes.puntos && antes.tema.id === "quien");
  const saludoLargo = palabras.size > 4;
  for (const tema of TEMAS) {
    // En frases largas el saludo no compite: importa lo que se pide después del «hola»
    if (tema.id === "saludo" && saludoLargo) continue;
    let puntos = 0;
    for (const clave of kit.claves(tema)) {
      const k = kit.normalizar(clave);
      if (k.includes(" ")) {
        if (t.includes(` ${k} `) || t.includes(` ${k}`)) puntos += 2 + k.split(" ").length;
      } else if (palabras.has(k)) puntos += 2;
      else if (k.length >= 5 && [...palabras].some((p) => p.length >= 5 && (p.startsWith(k.slice(0, 5)) || k.startsWith(p.slice(0, 5))))) puntos += 1;
    }
    if (gana(puntos, mejor)) mejor = { tema, puntos };
  }
  if (especifica && (!mejor || ["saludo", "gracias", "malla", "altura"].includes(mejor.tema.id) || kit.sobreNodo.test(t))) return especifica;
  // Un pedido de acción que no se entendió no se responde con un tema tomado al azar
  if (!especifica && (!mejor || mejor.puntos < 4)) {
    // Un pedido que no es del simulador («hazme el café»): con respeto, y retoma el trabajo (la IA local, si está
    // activa, lo revisa antes: «conecta las veredas» sí es del simulador aunque no lo diga con sus palabras)
    if (kit.pideAccion.test(t) && !kit.delSimulador.test(t)) return { ...respuestaFueraDeTema(c), noEntendido: true };
    const ne = noEntendiOrden(pregunta);
    if (ne) return c.porVoz ? { ...ne, texto: tx(`Discúlpeme${tratoDe(c) ? `, ${tratoDe(c)}` : ""}, no le entendí bien: ${ne.texto.charAt(0).toLowerCase()}${ne.texto.slice(1)}`, `I beg your pardon${tratoDe(c) ? `, ${tratoDe(c)}` : ""}; I didn't quite catch that. ${ne.texto}`) } : ne;
  }
  // El saludo y el agradecimiento son charla: sin su nombre, el Asistente los deja pasar (v17.2)
  if (mejor && mejor.puntos >= 2) return { ...mejor.tema.responder(c), tema: mejor.tema.id, puntos: mejor.puntos, ...(TEMAS_DE_CHARLA.has(mejor.tema.id) ? { fueraDeTema: true } : {}) };
  if (kit.saludo.test(t)) {
    const r = TEMAS.find((x) => x.id === "capacidades")!.responder(c);
    return { ...r, texto: tx(`¡Hola! ${r.texto}`, `Hello! ${r.texto}`), fueraDeTema: true };
  }
  // Por voz, lo que no tiene ni pregunta ni pedido claro casi siempre es el dictado que escribió mal: se pide repetir
  const pregunta_ = /^\s*¿|\?\s*$/.test(pregunta) || kit.interrogativo.test(t);
  if (c.porVoz && !pregunta_ && !kit.fueraDeTema.test(t)) return respuestaNoEntendi(c, pregunta);
  // Nada del simulador en lo que pidió: se lo dice con cortesía y retoma el trabajo (con la IA local activa, ella lo revisa)
  if (!kit.delSimulador.test(t)) return { ...respuestaFueraDeTema(c), noEntendido: true };
  if (c.porVoz) return respuestaNoEntendi(c, pregunta);
  return {
    noEntendido: true,
    texto:
      tx("No estoy seguro de haber entendido. Puedo sembrar la red (gateway, repetidores y gente), poblar la zona y probar cuántos pagos, WhatsApp y consultas a la IA aguanta, dimensionar la red de un departamento, medir distancias, llevarlo a un municipio, explicar los colores, los enlaces y los saltos, o decirle por qué un nodo no llega al gateway. Pruebe: «¿qué puedes hacer?».", "I'm not sure I understood. I can seed the network (gateway, repeaters and people), populate the area and test how many payments, WhatsApp messages and AI questions it can handle, size the network for a department, measure distances, take you to a municipality, explain the colors, the links and the hops, or tell you why a node doesn't reach the gateway. Try: “what can you do?”."),
    acciones: [{ texto: tx("Ver los tours guiados", "See the tours"), accion: "tours" }],
  };
}

/** ¿El mensaje pide hacer algo (aunque no se haya podido convertir en una orden)? */
const PIDE_ACCION =
  /\b(armame|arma|armar|disename|disena|disenar|creame|crea|crear|hazme|haz|ponme|pon|poner|cubreme|cubre|cubrir|agrega\w*|anade|mueve|borra|elimina|quita|sube|baja|cambia|configura|instala|necesito que|quiero que|me ayudas a|ayudame a)\b/;

/** Lo que cambia entre entender en español y en inglés: cómo se normaliza, las frases propias y las palabras clave. */
type Kit = {
  ingles: boolean;
  normalizar: (t: string) => string;
  claves: (tema: Tema) => string[];
  charla: RegExp;
  meEscuchas: RegExp;
  elogio: RegExp;
  saludoDelDia: RegExp;
  pideHora: RegExp;
  pideFecha: RegExp;
  dondeEstamos: RegExp;
  /** Si la pregunta nombra una pieza, «¿cómo está…?» o «¿dónde…?» es de esa pieza, no del lugar. */
  palabrasDeNodo: RegExp;
  fueraDeTema: RegExp;
  sobreIaVoz: RegExp;
  /** Con estas palabras, lo que parece fuera de tema sí es del simulador. */
  delSimuladorEstricto: RegExp;
  /** Lo que se pregunta de un nodo nombrado (alcance, ruta, cómo está). */
  sobreNodo: RegExp;
  pideAccion: RegExp;
  delSimulador: RegExp;
  saludo: RegExp;
  interrogativo: RegExp;
};

const KIT_ES: Kit = {
  ingles: false,
  normalizar,
  claves: (tema) => tema.claves,
  charla: CHARLA,
  meEscuchas: ME_ESCUCHAS,
  elogio: ELOGIO,
  saludoDelDia: SALUDO_DEL_DIA,
  pideHora: PIDE_HORA,
  pideFecha: PIDE_FECHA,
  dondeEstamos: DONDE_ESTAMOS,
  palabrasDeNodo: /\b(nodo|antena|gateway|repetidor\w*|persona|torre)\b/,
  fueraDeTema: FUERA_DE_TEMA,
  sobreIaVoz: SOBRE_IA_VOZ,
  delSimuladorEstricto: /\b(red|malla|nodo|antena|gateway|repetidor\w*|cobertura|senal|simul\w*|trama|meshcore|lora|pagos?|radio mobile|itm|longley|propagacion|enlace)\b/,
  sobreNodo: /alcance|ruta|llega|cubre|salto|area|como esta/,
  pideAccion: PIDE_ACCION,
  delSimulador: DEL_SIMULADOR,
  saludo: /\b(hola|buenas|buenos dias|saludos)\b/,
  interrogativo: /^ (que|quien|quienes|como|cual|cuales|cuando|donde|por que|cuanto|cuanta|cuantos|cuantas)\b/,
};

const KIT_EN: Kit = {
  ingles: true,
  normalizar: normalizarIngles,
  claves: (tema) => tema.clavesEn,
  charla: CHARLA_EN,
  meEscuchas: ME_ESCUCHAS_EN,
  elogio: ELOGIO_EN,
  saludoDelDia: SALUDO_DEL_DIA_EN,
  pideHora: PIDE_HORA_EN,
  pideFecha: PIDE_FECHA_EN,
  dondeEstamos: DONDE_ESTAMOS_EN,
  palabrasDeNodo: /\b(node|antenna|gateway|repeater\w*|person|tower)\b/,
  fueraDeTema: FUERA_DE_TEMA_EN,
  sobreIaVoz: SOBRE_IA_VOZ_EN,
  delSimuladorEstricto: ES_DEL_SIMULADOR_EN,
  sobreNodo: SOBRE_NODO_EN,
  pideAccion: PIDE_ACCION_EN,
  delSimulador: DEL_SIMULADOR_EN,
  saludo: /\b(hello|hi|hey|hola|greetings|good morning|good afternoon|good evening)\b/,
  interrogativo: /^ (what|who|whom|whose|how|which|when|where|why)\b/,
};

/** Respuesta cuando el mensaje parece una orden que no se pudo interpretar: en vez de un tema al azar, ejemplos útiles. */
export function noEntendiOrden(pregunta: string, lengua?: Idioma): Respuesta | null {
  if (entenderEnIngles(pregunta, lengua)) {
    if (!PIDE_ACCION_EN.test(` ${normalizarIngles(pregunta)} `)) return null;
  } else {
    const t = ` ${normalizar(pregunta)} `;
    if (!PIDE_ACCION.test(t)) return null;
  }
  return {
    noEntendido: true,
    texto: [
      tx("Entendí que quiere que haga algo en el simulador, pero no logré convertirlo en una orden. Estas sí las hago de una:", "I understood that you want me to do something in the simulator, but I couldn't turn it into an order. These I can do right away:"),
      tx("• «ármame una malla que cubra 11.226 hectáreas con señal media o mejor en el 99,9 %»", "• “build me a mesh that covers 11,226 hectares with fair signal or better over 99.9%”"),
      tx("• «pon el gateway en Cumaral» o «agrega un repetidor a 8 km al norte del gateway»", "• “put the gateway in Cumaral” or “add a repeater 8 km north of the gateway”"),
      tx("• «sube todos los repetidores a 12 m», «borra todas las personas»", "• “raise all the repeaters to 12 m”, “delete all the people”"),
      tx("• «puebla la zona con 250 personas», «envía 25 pagos al tiempo», «manda 15 mensajes de WhatsApp al tiempo», «¿hasta cuántos pagos aguanta?»", "• “populate the area with 250 people”, “send 25 payments at once”, “send 15 WhatsApp messages at once”, “how many payments can it handle?”"),
      tx("• «¿cuánto cuesta la red para el Chocó?»", "• “how much does the network cost for Chocó?”"),
      tx("• «muestra las vías», «llévame a Villavicencio», «simula»", "• “show the roads”, “take me to Villavicencio”, “simulate”"),
      tx("Dígamelo con una de esas formas, o pregúnteme «¿qué puedes hacer?».", "Tell me in one of those ways, or ask me “what can you do?”."),
    ].join("\n"),
    acciones: [{ texto: tx("Ver los tours guiados", "See the tours"), accion: "tours" }],
  };
}

export const SUGERENCIAS = ["Hazme un tour", "¿Qué hago ahora?", "¿Cómo viaja un mensaje?", "¿Cuántos pagos aguanta?"];

/** Las sugerencias en el idioma de la pantalla (SUGERENCIAS queda en español para quien la siga usando). */
export const sugerencias = porIdioma((): string[] => [
  tx("Hazme un tour", "Give me a tour"),
  tx("¿Qué hago ahora?", "What should I do next?"),
  tx("¿Cómo viaja un mensaje?", "How does a message travel?"),
  tx("¿Cuántos pagos aguanta?", "How many payments can it handle?"),
]);
