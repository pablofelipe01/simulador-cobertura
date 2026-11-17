// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Asistente Melki (por voz, tipo Jarvis): Melki escucha todo el tiempo y se activa con su nombre («Hola Melki», «Oye
// Melki», «Hey Melki», «Hello Melky»…, en las formas en que el reconocimiento lo escribe); ejecuta la orden, deja la
// respuesta escrita (con el trato cortés de un mayordomo; en voz alta solo si se lo piden) y se queda atento unos
// segundos para seguir la conversación sin repetir su nombre. Aquí está lo que no depende de la pantalla: reconocer el llamado, los controles de voz («para»,
// «repite», «más detalle», «sí, hazlo», «la segunda», «deja de escuchar»), limpiar lo dicho, resumir la respuesta para
// leerla y las frases del asistente.
import { idioma, tx, type Idioma } from "@/lib/idioma";

import { normalizarDictado, quitarTartamudeo } from "./dictado";
import { numerosEnPalabras, numerosEnPalabrasEn } from "./numeros";
import { paraHablar } from "./voz";

/** «dormido»: en reposo, solo atento a su nombre (como Siri o el Asistente de Google), sin barra ni paneles ocultos. */
export type EstadoManosLibres = "apagado" | "dormido" | "preparando" | "esperando" | "atento" | "pensando" | "hablando";

const normal = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:«»"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Cómo suele quedar «Melki» en el reconocimiento de voz (una palabra o dos: «mel ki»). */
const NOMBRE = /^(?:melk[iy]e?s?|mel+k[iy]e?|melqu[iy]|melk[ie]y|melkee|melkie|melchi|melgi|melky|malk[iy]|milk[iy]|milk[ie]y|nelk[iy]|belk[iy]|welk[iy]|elk[iy])$/;
const NOMBRE_DOS = /^(?:mel+|mell|meel) (?:k[iy]|qu[iy]|key|kee|kie|ki[eé]|chi|gui)$/;

/** Distancia de edición entre dos palabras cortas (para aceptar «Melkí», «Mekli», «Melkis»…). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/** ¿La palabra es el nombre de Melki tal como lo pudo escribir el reconocimiento? */
export function esNombre(palabra: string): boolean {
  const k = normal(palabra);
  if (NOMBRE.test(k)) return true;
  // Una letra de más, de menos o cambiada («melkis», «mekli», «melka»), solo en palabras del largo del nombre
  return k.length >= 4 && k.length <= 7 && /^[mnbvwe]/.test(k) && distancia(k, "melki") <= 1;
}

/** Saludos con que se llama a Melki, en español y en inglés. */
const SALUDO_ES = /^(?:hola|ola|oye|oiga|oigan|ey|ei|eh|epa|buenas|buenos|dias|tardes|noches|ok|okey|oka|vale|querido|querida|mi)$/;
const SALUDO_EN = /^(?:hey|hei|hello|helo|hellou|jelou|hi|hai|okay)$/;

export type Activacion = { activado: boolean; resto: string; ingles: boolean };

// Quita la puntuación de los bordes, pero deja el «¿» y el «¡» con que empieza el pedido
const sinBordes = (t: string) => t.replace(/^[\s,.;:!?]+/, "").replace(/[\s,.;:]+$/, "");

/**
 * ¿La frase llama a Melki? Devuelve lo que se pide después del nombre, tal como se dijo («Hola Melki, pon el gateway
 * en Cumaral» → «pon el gateway en Cumaral»). Si el nombre va al final («pon el gateway en Cumaral, Melki»), el
 * pedido es lo de antes.
 */
export function detectarActivacion(frase: string): Activacion {
  // Al hablar rápido el reconocimiento pega el saludo y el nombre («heymelki», «holamelki»): se separan
  const partes = frase
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((p) => {
      const m = normal(p).match(/^(hola|ola|oye|ey|ei|hey|hei|hello|helo|jelou|ok|okey)(m\w{3,5})$/);
      return m && esNombre(m[2]) ? [m[1], m[2]] : [p];
    });
  const claves = partes.map(normal);
  let i = -1;
  let largo = 1;
  for (let k = 0; k < claves.length; k++) {
    if (esNombre(claves[k])) {
      i = k;
      break;
    }
    if (k + 1 < claves.length && NOMBRE_DOS.test(`${claves[k]} ${claves[k + 1]}`)) {
      i = k;
      largo = 2;
      break;
    }
  }
  if (i < 0) return { activado: false, resto: "", ingles: false };
  const saludo = i > 0 && (SALUDO_ES.test(claves[i - 1]) || SALUDO_EN.test(claves[i - 1])) ? claves[i - 1] : "";
  const ingles = SALUDO_EN.test(saludo);
  const inicio = saludo ? i - 1 : i;
  let resto = sinBordes(partes.slice(i + largo).join(" "));
  const antes = sinBordes(partes.slice(0, inicio).join(" "));
  if (!resto && antes.split(" ").length >= 2) resto = antes;
  // «Hola Melki, por favor…»
  resto = resto.replace(/^(por favor|porfa|porfavor|please)[\s,]+/i, "").replace(/[\s,]+(por favor|porfa|please)$/i, "");
  return { activado: true, resto: sinBordes(resto), ingles };
}

export type ControlVoz =
  | { tipo: "callar" }
  | { tipo: "repetir" }
  | { tipo: "detalle" }
  /** Dejar de atender (al reposo). `despedida`: «chao», «hasta luego»… (sin su nombre puede ser a otra persona). */
  | { tipo: "apagar"; despedida?: boolean }
  /** Apagar del todo el micrófono (también la escucha en reposo). */
  | { tipo: "microfono" }
  | { tipo: "gracias" }
  | { tipo: "no" }
  | { tipo: "accion"; indice: number | "ultima" }
  | { tipo: "ayuda" };

/** Lo que se dice para manejar la conversación (no son órdenes del simulador). */
export function controlDeVoz(frase: string): ControlVoz | null {
  const t0 = normal(frase).replace(/^(melki|oye|hola)\s+/, "");
  if (!t0) return null;
  const t = respuestaCorta(t0);
  if (/^(para|pare|parale|detente|detengase|silencio|callate|callese|calla|basta|stop|ya basta|suficiente|ya esta bien|ok para|espera)$/.test(t)) return { tipo: "callar" };
  if (/^(repite|repitelo|repitemelo|repiteme|otra vez|de nuevo|que dijiste|no te (entendi|escuche|oi)|no escuche|como dijiste|perdon que dijiste)$/.test(t)) return { tipo: "repetir" };
  if (/^(mas detalles?|dame (mas )?detalles?|con detalle|explicame( mas| mejor)?|explica( mas| mejor)?|leelo todo|leeme todo|lee todo|dime todo|completo|la respuesta completa|amplia|amplialo|cuentame mas|y que mas|sigue)$/.test(t)) return { tipo: "detalle" };
  if (/^(apaga|desactiva|cierra|quita|deten)\w* (el |la )?(microfono|escucha( pasiva| en reposo)?)( del todo)?$|^no me escuches( mas)?$|^ya no me escuches( mas)?$|^deja de escuchar(me)? del todo$|^no escuches mas$/.test(t))
    return { tipo: "microfono" };
  if (
    /^(apaga|desactiva|termina|cierra|sal de|quita|deten)\w* (el )?(modo )?(manos libres|escucha|microfono|jarvis|asistente( melki| de voz)?)$|^deja de escuchar(me)?$|^ya no (me )?escuches$|^no me escuches$/.test(
      t,
    )
  )
    return { tipo: "apagar" };
  if (/^((gracias|muchas gracias|listo|bueno|ok) )?(adios|chao|chau|hasta luego|hasta pronto|hasta manana|nos vemos|nos vemos luego|bye|goodbye)( melki)?$/.test(t)) return { tipo: "apagar", despedida: true };
  if (/^(gracias|muchas gracias|mil gracias|listo gracias|ok gracias|perfecto|perfecto gracias|excelente|genial|muy bien|vale|ok|okey|listo|thank you|thanks)$/.test(t)) return { tipo: "gracias" };
  if (/^(no|no gracias|nada|cancela|cancelalo|cancelar|olvidalo|dejalo|dejalo asi|mejor no|asi esta bien|no hagas nada)$/.test(t)) return { tipo: "no" };
  if (/^(si|claro|dale|hazlo|hagalo|hagale|de una|adelante|confirmo|correcto|exacto|aplicalo|aplica|aplicala|ponlo|ponla|si por favor|si hazlo|si dale|si claro|si adelante|ok hazlo|ok dale|yes|do it|go)( (hazlo|por favor|dale|adelante|porfa))?$/.test(t))
    return { tipo: "accion", indice: 0 };
  const ordinal = t.match(/^(?:(?:la|el|opcion|la opcion|el boton|elige|escoge|usa|quiero|dame) ?)*(primer[oa]?|1|uno|una|segund[oa]|2|dos|tercer[oa]?|3|tres|cuart[oa]|4|cuatro|ultim[oa])$/);
  if (ordinal) {
    const o = ordinal[1];
    if (/^ultim/.test(o)) return { tipo: "accion", indice: "ultima" };
    const i = /^(primer|1|uno|una)/.test(o) ? 0 : /^(segund|2|dos)/.test(o) ? 1 : /^(tercer|3|tres)/.test(o) ? 2 : 3;
    return { tipo: "accion", indice: i };
  }
  if (/^(ayuda|ayudame|que (te )?puedo (decir|pedir)|que (le )?puedo decir|que sabes hacer|que puedes hacer por voz|como (te )?(uso|hablo|funciona esto)|comandos( de voz)?|que te digo)$/.test(t)) return { tipo: "ayuda" };
  return controlEnIngles(respuestaCortaEn(t0.replace(/^(hey|hi|hello|ok|okay)\s+(melki\s+)?/, "")));
}

/**
 * v17.7 · Las respuestas cortas como se dicen en el llano, en la forma que conocen los controles: «sí, hágale», «dele
 * pues», «sí señor», «claro que sí», «listo, hágale», «ajá, sí» → «si»; «no, deje así», «no señor», «ninguna», «déjelo
 * quieto», «no no no» → «no»; «la primerita», «la de arriba» → «la primera»; «la del medio» → «la segunda»; «la de
 * abajo», «la del final», «la ultimita» → «la ultima». Solo frases enteras y cortas (una orden no cambia).
 */
/** Lo que puede acompañar un «sí» o un «no» sin volverlo otra cosa («sí, eso era lo que quería decir», «no, así déjelo»). */
const ACOMPANA_SI_ES = new Set("si eso esa es era lo que queria decir senor claro por favor hagale dele dale de una pues exacto correcto asi listo bueno hazlo hagalo".split(" "));
const ACOMPANA_NO_ES = new Set("no gracias senor espere espera cancele cancela cancelalo cancelelo eso asi dejelo dejalo deje deja ahorita ahora todavia mejor ninguna ninguno de esas fue lo que dije era queria decir por nada quieto haga hagas".split(" "));
const ORDINAL_ES: Record<string, string> = { uno: "primera", una: "primera", "1": "primera", dos: "segunda", "2": "segunda", tres: "tercera", "3": "tercera" };

function respuestaCorta(t0: string): string {
  // (v17.7 · el titubeo al empezar: «eh, la primera opción», «bueno, sí»)
  const t = t0.replace(/^(?:(?:eh+|ah+|uh+|em+|mmm*|este|bueno)\s+)+(?=\S)/, "");
  if (t.split(" ").length > 8) return t0;
  const palabras = t.split(" ");
  if (palabras[0] === "no" && palabras.length > 1 && palabras.every((w) => ACOMPANA_NO_ES.has(w))) return "no";
  if (palabras.length > 2 && palabras.includes("no") && palabras.every((w) => ACOMPANA_NO_ES.has(w))) return "no";
  if (palabras[0] === "si" && palabras.length > 2 && palabras.every((w) => ACOMPANA_SI_ES.has(w))) return "si";
  const numero = t.match(/^(?:la|el)\s+(?:numero|opcion)\s+(uno|una|dos|tres|1|2|3)$/);
  if (numero) return `la ${ORDINAL_ES[numero[1]]}`;
  if (t.split(" ").length > 6) return t0;
  const u = t
    .replace(/\b(primerit[oa]|primeritic[oa])\b/g, "primera")
    .replace(/\b(segundit[oa])\b/g, "segunda")
    .replace(/\b(tercerit[oa])\b/g, "tercera")
    .replace(/\b(ultimit[oa])\b/g, "ultima")
    // (la cortesía y las muletillas de los bordes no cambian la respuesta)
    .replace(/(?:^|\s)(?:pues|mijo|mija|sumerce|senor|senora|mi senor|don|dona|ve|vea|oiga|hombre|mano|parce|porfa|por favor|de una)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!u) return t;
  if (/^(si|aja si|aja|eso si|claro que si|claro|si claro|si esa|si esa es|esa es|asi es|correcto|exacto|listo|ok|okey|dale|dele|hagale|hagale pues|si hagale|si dele|si dale|listo hagale|listo dele|listo dale|hagale de una|dele de una|si si|si si si|como no|de una|hagamosle|hagale entonces|si senor|bueno si|bueno hagale|bueno dale)$/.test(u))
    return u === "listo" || u === "ok" || u === "okey" ? u : "si";
  if (/^(no no|no no no|no deje asi|no dejelo asi|deje asi|dejelo asi|dejelo quieto|deje quieto|dejelo|no lo haga|no haga nada|mejor no|no gracias|no mejor no|ninguna|ninguno|ninguna de esas|no ninguna|no ninguna de esas|no ninguna de las dos|cancele|cancele eso|cancelelo|olvidelo|olvide eso|no senor|nada|no nada|no eso no|eso no|no esa no)$/.test(u)) return "no";
  if (/^(?:la|el|esa|ese)? ?(?:de arriba|primera de arriba|que esta arriba)$/.test(u)) return "la primera";
  if (/^(?:la|el|esa|ese)? ?(?:del medio|de la mitad|del centro)$/.test(u)) return "la segunda";
  if (/^(?:la|el|esa|ese)? ?(?:de abajo|de abajo del todo|del final|del fondo|ultima de abajo|que esta abajo)$/.test(u)) return "la ultima";
  return u.replace(/^(?:esa|ese) /, "la ").replace(/ (?:opcion|pues)$/, "");
}

/** v17.7 · Lo mismo en inglés con acento («jes plis», «sure thing», «nope», «the fur stone», «de one at de bottom»). */
const ACOMPANA_SI_EN = new Set("yes yeah yep sure ok okay please do it that thats what i meant mean why not go ahead thing the one sir exactly right correct of course absolutely".split(" "));
const ACOMPANA_NO_EN = new Set("no nope nah not wait dont do that cancel it now thanks thank you leave like never mind please sir what i said meant mean its thats the one this".split(" "));

function respuestaCortaEn(t0: string): string {
  // (v17.7 · el titubeo al empezar y el «yeah» del final: «uh, sure, why not», «option one, yeah»)
  const t = t0.replace(/'/g, "").replace(/^(?:(?:uh+|um+|er+|ah+|hm+|well|so)\s+)+(?=\S)/, "").replace(/\s+(?:yeah|yes|please)$/, "");
  if (t.split(" ").length > 9) return t0;
  const palabras = t.split(" ");
  if (/^(?:no|nope|nah|not)$/.test(palabras[0]) && palabras.length > 1 && palabras.every((w) => ACOMPANA_NO_EN.has(w))) return "no";
  if (/^(?:yes|yeah|yep|sure|uh)$/.test(palabras[0]) && palabras.length > 1 && palabras.every((w) => ACOMPANA_SI_EN.has(w))) return "yes";
  if (/^the one at the (?:end|very end|bottom)$/.test(t)) return "last";
  if (t.split(" ").length > 7) return t0;
  const u = t
    .replace(/'/g, "")
    .replace(/\bde\b/g, "the")
    .replace(/\bokey\b/g, "okay")
    .replace(/\bdat\b/g, "that")
    .replace(/\b(?:jes|jess|yess|yea)\b/g, "yes")
    .replace(/\b(?:shur|shure)\b/g, "sure")
    .replace(/\b(?:plis|pliz|pleace)\b/g, "please")
    .replace(/\b(?:tanks|tenks)\b/g, "thanks")
    .replace(/\b(?:fur stone|fir stone|furst|firs|fist)\b/g, "first")
    .replace(/\b(?:sec and|secon)\b/g, "second")
    .replace(/\b(?:turd|tird|terd|thirt)\b/g, "third")
    .replace(/\bnumber tree\b/g, "number three")
    .replace(/\b(?:lass|lust)\b/g, "last")
    .replace(/\s+(?:please|sir|mam|maam|buddy|man)$/g, "")
    .trim();
  if (/^(yes|yeah|yep|yup|sure|sure thing|of course|okay go|ok go|okay go ahead|ok go ahead|go|yes go ahead|yeah go ahead|yeah go a head|yes go a head|go a head|yes thats right|thats right|yes sir|yes thats it|thats it|thats the one|yes that one|yeah that one|yeah the one|that one|yes do it please|yes please do|absolutely|definitely|affirmative|do that|yes yes)$/.test(u)) return "yes";
  if (/^(nope|nah|no no|no no no|no dont|dont|no dont do it|dont do it|not that|not that one|no wait|none|none of them|none of those|no thanks|no thank you|no sir|no not that|cancel that|stop that)$/.test(u)) return "no";
  if (/^(?:the )?(?:one )?(?:on top|at the top|top one|first one on top|the top one)$|^the one on top$|^the one at the top$/.test(u)) return "first";
  if (/^(?:the )?(?:middle one|one in the middle|the middle)$|^the one in the middle$/.test(u)) return "second";
  if (/^(?:the )?(?:one at the bottom|bottom one|final one|the final one|last one at the bottom)$|^the one at the bottom$/.test(u)) return "last";
  return u.replace(/^number (one|two|three|four|1|2|3|4)$/, "$1").replace(/ option$/, "");
}

/** Los mismos controles dichos en inglés («stop», «say that again», «tell me more», «yes, do it», «the second one»…). */
function controlEnIngles(t: string): ControlVoz | null {
  if (!t) return null;
  const u = t.replace(/'/g, "");
  if (/^(stop|stop it|stop talking|quiet|be quiet|silence|enough|thats enough|hold on|wait|shut up|pause)$/.test(u)) return { tipo: "callar" };
  if (/^(repeat|repeat that|repeat it|say (that|it) again|again|come again|what did you say|sorry what|pardon|i (did not|didnt) (hear|catch) (that|you)|once more)$/.test(u)) return { tipo: "repetir" };
  if (/^(more details?|give me (more )?details?|in detail|explain( more| it| that)?|read it all|read everything|tell me everything|the full answer|tell me more|go on|keep going|carry on|continue|and what else|what else)$/.test(u)) return { tipo: "detalle" };
  if (/^(turn off|switch off|disable|close) (the )?(microphone|mic)( completely)?$|^(do not|dont) listen to me( anymore)?$|^stop listening (completely|altogether)$/.test(u)) return { tipo: "microfono" };
  if (/^(turn off|switch off|deactivate|disable|close|exit|stop) (the )?(hands ?free( mode)?|assistant|melki assistant|voice assistant|listening)$|^stop listening( to me)?$/.test(u)) return { tipo: "apagar" };
  if (/^((thanks|thank you|ok|okay|alright) )?(goodbye|bye|bye bye|bye for now|goodbye for now|see you|see ya|see you later|see you soon|catch you later|talk to you later|take care|farewell|good night)( melki)?$/.test(u)) return { tipo: "apagar", despedida: true };
  if (/^(thanks|thank you|thank you very much|thanks a lot|many thanks|perfect|perfect thanks|excellent|great|very good|good job|well done|ok thanks|okay thanks|got it|ok|okay)$/.test(u)) return { tipo: "gracias" };
  if (/^(no|no thanks|no thank you|nothing|cancel|cancel it|cancel that|never ?mind|forget it|leave it|leave it like that|better not|do nothing|dont do anything|do not do anything)$/.test(u)) return { tipo: "no" };
  if (/^(yes|yeah|yep|sure|of course|do it|go ahead|go for it|confirm|confirmed|apply it|apply|correct|exactly|please do|yes please|yes do it|ok do it|okay do it|sounds good)( please)?$/.test(u)) return { tipo: "accion", indice: 0 };
  const ordinal = u.match(/^(?:(?:the|option|the option|button|the button|choose|pick|use|i want|give me|number) ?)*(first|1|one|second|2|two|third|3|three|fourth|4|four|last)(?: one| option)?$/);
  if (ordinal) {
    const o = ordinal[1];
    if (o === "last") return { tipo: "accion", indice: "ultima" };
    const i = /^(first|1|one)$/.test(o) ? 0 : /^(second|2|two)$/.test(o) ? 1 : /^(third|3|three)$/.test(o) ? 2 : 3;
    return { tipo: "accion", indice: i };
  }
  if (/^(help|help me|what can i (say|ask)|what can you do|what do you know how to do|how do i (use|talk to) you|commands|voice commands|what should i say)$/.test(u)) return { tipo: "ayuda" };
  return null;
}

/**
 * Lo dicho, listo para Melki: números en cifras, coordenadas y sin muletillas. `lengua`: el idioma en que se oyó (el del
 * reconocimiento; el doble oído también oye en el otro idioma).
 */
export function limpiarComando(frase: string, lengua: Idioma = idioma()): string {
  if (lengua === "en") return limpiarComandoIngles(frase);
  let t = frase.replace(/\s+/g, " ").trim();
  t = numerosEnPalabras(t);
  t = normalizarDictado(t);
  t = hablaLlanera(sinRuidoEnMedio(t));
  // Muletillas al empezar o al terminar («eh», «este», «o sea», «bueno», «mmm»), también repetidas al hablar rápido
  // (v17.5 · también «de una» y «ahorita», que no cambian la orden)
  for (let i = 0; i < 3; i++) t = t.replace(/^(eh+|em+|m+|este|bueno|pues|a ver|mira|oye|o sea|osea|entonces|digamos|ehm+|listo|vale|okey|ok|de una)[, ]+(?=\S)/i, "");
  t = t.replace(/[, ]+(eh+|por favor|porfa|porfavor|gracias|pues|o sea|ya|de una|ahorita|orita)$/i, "");
  // (v17.7 · también «mijo» o «sumercé» al final, salvo en un nombre nuevo: «renombra la Torre 2 como Finca Mijo»)
  if (!/\b(?:renombr|ren[oó]mbr|nombre|ll[aá]m[aeo]|como\s)/i.test(t)) t = t.replace(/[, ]+(mijo|mija|sumerc[eé]|pues)$/i, "");
  t = preguntaIndirecta(t);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * v17.7 · El ruido que el reconocimiento escribe en medio de lo dicho: «uh», «eh», «mmm», los puntos sueltos («show the.
 * legend. please») y la palabra repetida al titubear («envía envía quince pagos», «turn
 * on the the ruler»). No toca «no, no», los números (tampoco «to», que puede ser «two»: «Person to to…») ni lo que va
 * entre comillas.
 */
const NO_SE_REPITE = /^(?:no|si|sí|ya|muy|very|bye|chao|ja|ha|to|too|tu|for|fore|won|tree|free|fife|oh|zero|one|two|three|four|five|six|seven|eight|nine|ten|cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cien|mil|hundred|thousand)$/i;

function sinRuidoEnMedio(texto: string): string {
  if (/["«“]/.test(texto)) return texto;
  let t = texto
    .replace(/(?:^|[\s,.;]+)(?:uh+|um+|eh+|ehm+|hm+|hmm+|ah+|mmm*|erm?)(?=[\s,.;!?]|$)[,.;]?/gi, " ")
    .replace(/(?<=\p{L})\.\s+(?=\p{Ll})/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/(?<![\p{L}\d])(\p{L}{2,})(?:\s*,?\s+\1)+(?![\p{L}\d])/giu, (m, w: string) => (NO_SE_REPITE.test(w) ? m : w));
  return quitarTartamudeo(t);
}

/**
 * v17.7 · El español del llano, como lo entiende el intérprete: la cortesía y las muletillas al empezar («oiga», «vea»,
 * «sumercé», «mijo», «hágale pues», «dele pues», «ahorita»), los diminutivos («un repetidorcito», «al ladito», «cerquita»,
 * «pegadito», «un poquitico») y «el repe 1». «Hágale zoom» o «dele zoom» siguen siendo órdenes (solo se quita con «pues»
 * o con una pausa).
 */
function hablaLlanera(texto: string): string {
  let t = texto;
  for (let i = 0; i < 4; i++)
    t = t.replace(/^(?:oiga|oigan|vea|sumerc[eé]|mijo|mija|mi señor|señor|ahorita|orita|porfa|ay|uy|aj[aá]|h[aá]gale\s+pues|dele\s+pues|listo\s+pues|bueno\s+pues|h[aá]gale(?=\s*,)|dele(?=\s*,))[, ]+(?=\S)/i, "");
  return t
    .replace(/\brepetidorcit[oa]s?\b/gi, (m) => (/s$/i.test(m) ? "repetidores" : "repetidor"))
    .replace(/\bpersonitas?\b/gi, (m) => (/s$/i.test(m) ? "personas" : "persona"))
    .replace(/\b(antenit|torrecit|nodit)(a|o)(s?)\b/gi, (_m, r: string, _v: string, pl: string) => ({ antenit: "antena", torrecit: "torre", nodit: "nodo" })[r.toLowerCase()] + pl)
    .replace(/\bladito\b/gi, "lado")
    .replace(/\bcerquit(?:a|ica)\b/gi, "cerca")
    .replace(/\bpegadit(o|a)\b/gi, "pegad$1")
    .replace(/\b(?:poquitico|poquitito|tantico|tantito)\b/gi, "poquito")
    .replace(/\brepe\b(?=\s+(?:\d|uno|dos|tres|cuatro)\b)/gi, "repetidor")
    .replace(/\bvillavo\b/gi, "Villavicencio")
    .replace(/\bjopal\b/gi, "Yopal")
    .replace(/\bmallitas?\b/gi, (m) => (/s$/i.test(m) ? "mallas" : "malla"))
    .replace(/\bredecitas?\b/gi, (m) => (/s$/i.test(m) ? "redes" : "red"))
    .replace(/\bkilom[eé]trico\b/gi, "kilómetro")
    .replace(/\bce\s+ese\s+ve\b/gi, "CSV")
    .replace(/\bka\s+eme\s+zeta\b/gi, "KMZ")
    .replace(/\bpe\s+de\s+efe\b/gi, "PDF")
    .replace(/(?<![\d.])(\d+)\s+punto\s+(\d+)(?=\s*(?:m|metros|km|kil[oó]metros|%)(?![\p{L}]))/giu, "$1.$2")
    // «un kilómetro doscientos» (1,2 km), «dos kilómetros quinientos» (2,5 km)
    .replace(/(?<![\p{L}\d])(\d+|un|uno)\s+kil[oó]metros?\s+(\d{3})(?!\d)(?!\s*(?:m|metros|mts)(?![\p{L}]))/giu, (_m, a: string, b: string) => `${((/^\d/.test(a) ? Number(a) : 1) + Number(b) / 1000).toString()} km`);
}

/**
 * v17.7 · Una pregunta dicha como pedido («dime por qué el Repetidor 2 no se conecta», «quiero saber cuántas personas
 * aguanta», «muéstrame cuáles nodos quedaron sin señal»): es la pregunta, con sus signos, para que no se tome como la
 * orden de algún verbo de adentro («conecta»).
 */
function preguntaIndirecta(t: string): string {
  const m = t.match(/^(?:(?:melki|oye)[, ]+)?(?:d[ií]me|d[ií]game|cu[eé]ntame|cu[eé]nteme|expl[ií]came|expl[ií]queme|quiero saber|quisiera saber|me gustar[ií]a saber|me dices|me puedes decir|me puede decir|mu[eé]strame|mu[eé]streme)[, ]+(?:si[, ]+)?((?:qu[eé]|cu[aá]nto|cu[aá]ntos|cu[aá]ntas|cu[aá]nta|cu[aá]l|cu[aá]les|d[oó]nde|por qu[eé]|c[oó]mo|hasta d[oó]nde|hasta cu[aá]ntos|hasta cu[aá]ntas|a cu[aá]nto|qui[eé]n)(?=\s).+?)[?.!]*$/i);
  return m ? `¿${m[1]}?` : t;
}

/**
 * v17.7 · Lo mismo en inglés: «tell me how much the network costs» → «how much does the network cost?», «I want to know
 * how many people Repeater 1 can handle» → «how many people can Repeater 1 handle?», «tell me if Person 2 has coverage»
 * → «does Person 2 have coverage?», «explain why Repeater 2 doesn't connect» → «why doesn't Repeater 2 connect?».
 */
function preguntaIndirectaEn(t: string): string {
  const m = t.match(/^(?:(?:melki|hey melki)[, ]+)?(?:(?:can|could) you |please )?(?:tell me|let me know|i want to know|i wanna know|i'?d like to know|i would like to know|i need to know|i wonder|explain(?: to me)?)[, ]+(.+?)[?.!]*$/i);
  if (!m) return t;
  let q = m[1].trim();
  const r: [RegExp, string][] = [
    [/^(?:if|whether) (there) (is|are) (.+)$/i, "$2 $1 $3"],
    [/^(?:if|whether) (i|we) (should|can|could) (.+)$/i, "$2 $1 $3"],
    [/^(?:if|whether) (i|we) (need|have) (.+)$/i, "do $1 $2 $3"],
    [/^(?:if|whether) (.+?) (has|have) (.+)$/i, "does $1 have $3"],
    [/^(?:if|whether) (.+?) (is|are|can|will) (.+)$/i, "$2 $1 $3"],
    [/^why (.+?) (doesn'?t|does not|don'?t|do not|isn'?t|is not|aren'?t|can'?t|cannot|won'?t|didn'?t) (.+)$/i, "why $2 $1 $3"],
    [/^(how far|where|what|which \w+) (.+?) (is|are) (from|to|between|for|in|on|at)\b(.*)$/i, "$1 $3 $2 $4$5"],
    [/^(how many \w+|how much|what|which \w+) (.+?) (can|could|will|would|should) (\w+)(.*)$/i, "$1 $3 $2 $4$5"],
    [/^(how much|what) (it|that|this) (would|will|could) (\w+)(.*)$/i, "$1 $3 $2 $4$5"],
    [/^(how much|what) (the .+?) (costs|covers|needs)\b(.*)$/i, "$1 does $2 $3$4"],
    [/^how many (\w+) (there are|there is)\b(.*)$/i, "how many $1 are there$3"],
    [/^what (.+?) (is|means)$/i, "what $2 $1"],
    [/^(the (?:total )?(?:cost|price|distance|coverage)\b.*)$/i, "what is $1"],
  ];
  for (const [re, por] of r) {
    if (re.test(q)) {
      q = q.replace(re, por).replace(/\bdoes (.+?) (costs|covers|needs)\b/i, (_x, a: string, v: string) => `does ${a} ${v.replace(/s$/, "")}`).replace(/\bwhat means\b/i, "what does").replace(/\bwhat does (.+)$/i, "what does $1 mean");
      return `${q}?`;
    }
  }
  return /^(how|what|why|where|which|who)\b/i.test(q) ? `${q}?` : t;
}

const COSA_A_LA_VISTA =
  /\b(roads?|rods|rows|streets|layers?|liars|coverage|network|mesh|view|panels?|toolbar|legend|terrain|satellite|map|nodes?|labels|towns?|people|persons|repeaters?|antennas?|gateways?|links?|routes?|hops|zones?|areas?|heat ?map|grid|profile|results?|legend|names|signal|elevation|relief|hills|contours?|municipalit(?:y|ies)|villages?|population|houses|everything)\b/i;
const CON_VERBO =
  /\b(is|are|was|were|it'?s|that'?s|there'?s|do|does|did|can|could|will|would|should|have|has|had|works?|looks?|seems?|means?|think|know|need|want|go|goes|went|get|got|make|let'?s?|what|why|how|when|where|who|which|if|then|but|and|or|because|i|you|we|they|he|she|far|good|bad|anyway|basically)\b/i;

/**
 * v17.4 · Con acento, «show» se oye «so»: «so me the roads» y «so the roads please» piden ver algo (sin verbo después,
 * no es la muletilla «so, …»).
 */
function soEsShow(t: string): string {
  const m = t.match(/^so\s+(.+)$/i);
  if (!m) return t;
  if (/^(?:me|us)\b/i.test(m[1])) return `show ${m[1]}`;
  const cosa = m[1].replace(/[,.!?]+$/, "").replace(/\s+please$/i, "");
  // Lo que se muestra: «the roads», «all the nodes», «the whole network» o «roads» (sin artículo, empieza por la cosa);
  // «so add a repeater» o «so the coverage is fine» siguen siendo la muletilla
  const articulo = cosa.match(/^(?:the|all|all the|my|our|every|those|these)\s+(.+)$/i);
  const empiezaPorCosa = cosa.match(COSA_A_LA_VISTA)?.index === 0;
  if (/^[a-z]+(?:\s+[a-z]+){0,3}$/i.test(articulo ? articulo[1] : cosa) && (articulo ? COSA_A_LA_VISTA.test(articulo[1]) : empiezaPorCosa) && !CON_VERBO.test(cosa)) return `show ${m[1]}`;
  return t;
}

/** Lo dicho en inglés, listo para Melki: números en cifras y sin muletillas («um», «so», «okay so»). */
function limpiarComandoIngles(frase: string): string {
  let t = numerosEnPalabrasEn(cifrasOidasEn(sinRuidoEnMedio(frase.replace(/\s+/g, " ").trim())));
  t = soEsShow(t);
  for (let i = 0; i < 3; i++) t = t.replace(/^(um+|uh+|er+|erm|hm+|hmm+|ah+|so|well|like|okay so|ok so|right|alright|now|let me see|you know)[, ]+/i, "");
  for (let i = 0; i < 2; i++) t = t.replace(/[, ]+(um+|uh+|hm+|ah+|er+|please|thanks|thank you)$/i, "");
  t = preguntaIndirectaEn(t);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * v17.7 · Las cifras dichas con acento dentro de un número («four point two tree minus seventy tree point six one», «for
 * point two», «ninety fife percent», «tirty five meters»): «tree», «for», «fife», «to» y «won» solo cuentan como números
 * pegados a otro número o a «point» (fuera de un número son palabras: «a mesh for 100 users», «move it to 4.25»).
 */
function cifrasOidasEn(texto: string): string {
  const MAPA: Record<string, string> = { tree: "three", fife: "five", for: "four", to: "two", too: "two", won: "one", tirty: "thirty", tventy: "twenty", fourty: "forty" };
  let t = texto.replace(/\b(tirty|tventy|fourty)\b/gi, (m) => MAPA[m.toLowerCase()]);
  // Después de las decenas: «seventy tree», «ninety fife» (no «to» ni «for»: «from thirty to forty», «ninety for all»)
  t = t.replace(/(\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+)(tree|fife|won)\b/gi, (_m, a: string, w: string) => a + MAPA[w.toLowerCase()]);
  // Los decimales después de «point» dentro de un número («four point two tree»; «point to the gateway» es otra cosa)
  for (let i = 0; i < 4; i++)
    t = t.replace(new RegExp(String.raw`((?:\d|\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|tree|fife))\s+point(?:\s+(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|\d))*\s+)(tree|fife|for|to|too|won)\b`, "gi"), (_m, a: string, w: string) => a + MAPA[w.toLowerCase()]);
  // Antes de «point»: «for point two», «tree point five»
  t = t.replace(/\b(tree|fife|for|won)(?=\s+point\s+(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|tree|fife|for|to|too|won|\d)\b)/gi, (w) => MAPA[w.toLowerCase()]);
  // «tree» o «fife» delante de una unidad o de «hundred»: «tree meters», «fife hundred»
  t = t.replace(/\b(tree|fife)(?=\s+(?:hundred|thousand|meters?|metres?|kilomet\w*|km|miles?|feet|ft|percent|degrees|d\s*b|dbi|dbm)\b)/gi, (w) => MAPA[w.toLowerCase()]);
  return t;
}

/**
 * La respuesta para leerla en voz alta: corta (las primeras frases y los primeros renglones con viñeta) o completa.
 * Lo demás queda escrito en la conversación.
 */
export function textoParaVoz(texto: string, completo = false): string {
  const renglones = texto
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  if (completo) return renglones.map((r) => r.replace(/^•\s*/, "")).join(". ").replace(/\.\s*\./g, ".");
  const primero = renglones[0] ?? "";
  const frases = primero.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«(0-9])/);
  let dicho = "";
  let n = 0;
  for (const f of frases) {
    if (n >= 3 || (dicho && dicho.length + f.length > 260)) break;
    dicho = dicho ? `${dicho} ${f}` : f;
    n++;
  }
  const vinetas = renglones.slice(1).filter((r) => r.startsWith("•"));
  if (vinetas.length && dicho.length < 200) dicho += ` ${vinetas.slice(0, 2).map((r) => r.replace(/^•\s*/, "")).join(". ")}.`;
  const quedo = dicho.length < texto.replace(/\s+/g, " ").length - 20;
  return quedo ? `${dicho.replace(/[:;,]\s*$/, ".")} ${tx("Le dejé el detalle escrito.", "I've left the details in writing.")}` : dicho;
}

/**
 * ¿Lo que se oyó es la propia voz de Melki que volvió a entrar por el micrófono (parlantes sin audífonos)? Lo es si casi
 * todas sus palabras están en lo que Melki acaba de decir. Así no se responde a sí mismo.
 */
function compararConLoDicho(oido: string, dicho: string) {
  // Los números pueden volver en palabras o en cifras («cuatrocientos nueve» o «409»; «four hundred nine» o «409»)
  const cifras = idioma() === "en" ? numerosEnPalabrasEn : numerosEnPalabras;
  const palabras = normal(cifras(oido))
    .split(" ")
    .filter((w) => w.length > 1);
  const texto = normal(`${paraHablar(dicho)} ${dicho} ${cifras(paraHablar(dicho))}`);
  const voz = new Set(texto.split(" "));
  const dentro = palabras.filter((w) => voz.has(w)).length;
  return { palabras, texto, parte: palabras.length ? dentro / palabras.length : 0 };
}

/** Qué parte (0 a 1) de las palabras oídas están en lo que Melki dijo. */
export function parteDeLoDicho(oido: string, dicho: string): number {
  return compararConLoDicho(oido, dicho).parte;
}

export function pareceEco(oido: string, dicho: string): boolean {
  const { palabras, texto, parte } = compararConLoDicho(oido, dicho);
  if (!palabras.length) return false;
  if (palabras.length === 1) return parte === 1;
  if (parte >= 0.75) return true;
  // Con ruido de por medio: la mitad de las palabras y un trozo seguido de cuatro o más tal como lo dijo
  if (parte < 0.5) return false;
  const seguido = ` ${texto} `;
  for (let i = 0; i + 4 <= palabras.length; i++) if (seguido.includes(` ${palabras.slice(i, i + 4).join(" ")} `)) return true;
  return false;
}

/** ¿La frase empieza llamando a Melki por su nombre («Melki, …», «Hola Melki, …»)? */
export function empiezaConNombre(frase: string): boolean {
  const palabras = normal(frase).split(" ").slice(0, 3);
  return detectarActivacion(palabras.join(" ")).activado;
}

/** Cómo se dirige Melki a la persona. */
export type Trato = "senor" | "senora" | "ninguno";

/**
 * Las frases del Asistente Melki, con el trato cortés y elegante de un mayordomo. `vez` va contando los llamados para
 * no repetir siempre lo mismo.
 */
/** «Buenos días» hasta el mediodía, «Buenas tardes» hasta las 7 de la noche y luego «Buenas noches». */
export const saludoDelDia = (hora: number) =>
  idioma() === "en"
    ? hora < 5
      ? "Good evening"
      : hora < 12
        ? "Good morning"
        : hora < 19
          ? "Good afternoon"
          : "Good evening"
    : hora < 5
      ? "Buenas noches"
      : hora < 12
        ? "Buenos días"
        : hora < 19
          ? "Buenas tardes"
          : "Buenas noches";

/**
 * Las frases del asistente con el trato elegido. Con `hora` (la del equipo) saluda como una persona, según el momento
 * del día («Buenas tardes, señor. Bienvenido.»); sin ella, con «Hola». Con `sinNombre` (v17.2, lo normal) dice que con su
 * barra abierta toma las órdenes sin que lo llamen; sin él, que lo llamen por su nombre.
 */
export function frases(trato: Trato, hora?: number, sinNombre = true) {
  if (idioma() === "en") return frasesIngles(trato, hora, sinNombre);
  const s = trato === "senor" ? "señor" : trato === "senora" ? "señora" : "";
  /** «…, señor» o nada. */
  const coma = (frase: string) => (s ? `${frase}, ${s}` : frase);
  const hola = hora === undefined ? "Hola" : saludoDelDia(hora);
  const bienvenido = trato === "senora" ? "Bienvenida" : trato === "senor" ? "Bienvenido" : "Le doy la bienvenida";
  const llamados = [coma("Dígame") + ".", coma("A sus órdenes") + ".", coma("Le escucho") + ".", `¿En qué le sirvo${s ? `, ${s}` : ""}?`];
  return {
    bienvenida: (primera: boolean) =>
      sinNombre
        ? primera
          ? `${coma(hola)}. ${bienvenido}. Soy Melki, su asistente: estoy atento y presto a seguir sus órdenes. Mientras esta barra esté abierta, dígame lo que necesite sin llamarme; con la barra cerrada, diga «Hola Melki».`
          : `${coma("A su servicio")}. Le escucho: dígame lo que necesite.`
        : primera
          ? `${coma(hola)}. ${bienvenido}. Soy Melki, su asistente: estoy atento y presto a seguir sus órdenes. Cuando me necesite, diga «Hola Melki», aunque esta barra esté cerrada.`
          : `${coma("A su servicio")}. Diga «Hola Melki» cuando me necesite.`,
    llamado: (vez: number, ingles: boolean) =>
      ingles
        ? `Hello${s ? `, ${trato === "senora" ? "madam" : "sir"}` : ""}. Le escucho.`
        : vez === 0
          ? `${hora === undefined ? (s ? `Hola, mi ${s}` : "Hola") : coma(hola)}. Le escucho; estoy atento y presto a seguir sus órdenes.`
          : llamados[(vez - 1) % llamados.length],
    despedida: `Con su permiso${s ? `, ${s}` : ""}, dejo de escuchar. Aquí estaré cuando me necesite.`,
    /** Al apagarlo con la escucha en reposo: sigue atento a su nombre. */
    reposo: `Con su permiso${s ? `, ${s}` : ""}. Quedo en reposo: cuando me necesite, diga «Hola Melki».`,
    microfono: `Como usted diga${s ? `, ${s}` : ""}. Apago el micrófono; para volver a llamarme, toque «Asistente Melki».`,
    gracias: `Es un placer${s ? `, ${s}` : ""}. Aquí sigo; llámeme cuando quiera.`,
    nada: `Como usted diga${s ? `, ${s}` : ""}. No hago nada.`,
    sinPendiente: `No tengo nada pendiente${s ? `, ${s}` : ""}. Dígame qué necesita.`,
    sinOpcion: `No tengo esa opción${s ? `, ${s}` : ""}. Dígame qué necesita.`,
    yaHecho: `Eso ya está hecho${s ? `, ${s}` : ""}. ¿Qué sigue?`,
    yaEscucho: sinNombre ? `Ya le estoy escuchando${s ? `, ${s}` : ""}: dígame su pedido.` : `Ya le estoy escuchando${s ? `, ${s}` : ""}: diga «Hola Melki» y su pedido.`,
    /** Sugerencias cuando los paneles están ocultos (terminan en pregunta: «sí» u «ok» las acepta). */
    verResultados: `Para verlo con más detalle, ¿desea que le muestre el panel de resultados${s ? `, ${s}` : ""}?`,
    verHerramientas: `Para revisar los nodos y los parámetros, ¿le muestro el panel de herramientas${s ? `, ${s}` : ""}?`,
    mostrando: (panel: "resultados" | "herramientas") => `${coma("Con gusto")}. Aquí tiene el panel de ${panel}.`,
    sinPanel: `Como usted diga${s ? `, ${s}` : ""}. Lo dejo oculto; cuando lo necesite, pídamelo o toque el botón de mi barra.`,
    prueba: `${coma(hola)}. Así sonará mi voz. Los sistemas del simulador están listos y quedo a sus órdenes.`,
  };
}

/** Las mismas frases en inglés, con la cortesía serena de un mayordomo («sir», «ma'am»). */
function frasesIngles(trato: Trato, hora?: number, sinNombre = true) {
  const s = trato === "senor" ? "sir" : trato === "senora" ? "ma'am" : "";
  const coma = (frase: string) => (s ? `${frase}, ${s}` : frase);
  const hola = hora === undefined ? "Hello" : saludoDelDia(hora);
  const llamados = [s ? `Yes, ${s}?` : "Yes?", coma("At your service") + ".", coma("I'm listening") + ".", `How may I help you${s ? `, ${s}` : ""}?`];
  return {
    bienvenida: (primera: boolean) =>
      sinNombre
        ? primera
          ? `${coma(hola)}. Welcome. I'm Melki, your assistant: attentive and ready to follow your orders. While this bar is open, just tell me what you need without calling me; with the bar closed, say “Hey Melki”.`
          : `${coma("At your service")}. I'm listening: tell me what you need.`
        : primera
          ? `${coma(hola)}. Welcome. I'm Melki, your assistant: attentive and ready to follow your orders. Whenever you need me, say “Hey Melki”, even if this bar is closed.`
          : `${coma("At your service")}. Say “Hey Melki” whenever you need me.`,
    // Llamado con un saludo («Hello Melki»): se le responde el saludo completo
    llamado: (vez: number, conSaludo?: boolean) => (vez === 0 || conSaludo ? `${coma(hola)}. I'm listening; attentive and ready to follow your orders.` : llamados[(vez - 1) % llamados.length]),
    despedida: `With your permission${s ? `, ${s}` : ""}, I'll stop listening. I'll be here whenever you need me.`,
    reposo: `With your permission${s ? `, ${s}` : ""}. I'm going on standby: whenever you need me, say “Hey Melki”.`,
    microfono: `As you wish${s ? `, ${s}` : ""}. I'm turning off the microphone; to call me again, tap “Melki Assistant”.`,
    gracias: `It's a pleasure${s ? `, ${s}` : ""}. I'm still here; call me whenever you like.`,
    nada: `As you wish${s ? `, ${s}` : ""}. I won't do anything.`,
    sinPendiente: `I have nothing pending${s ? `, ${s}` : ""}. Tell me what you need.`,
    sinOpcion: `I don't have that option${s ? `, ${s}` : ""}. Tell me what you need.`,
    yaHecho: `That's already done${s ? `, ${s}` : ""}. What's next?`,
    yaEscucho: sinNombre ? `I'm already listening${s ? `, ${s}` : ""}: tell me your request.` : `I'm already listening${s ? `, ${s}` : ""}: say “Hey Melki” and your request.`,
    verResultados: `To see it in more detail, shall I show you the results panel${s ? `, ${s}` : ""}?`,
    verHerramientas: `To review the nodes and parameters, shall I show you the tools panel${s ? `, ${s}` : ""}?`,
    mostrando: (panel: "resultados" | "herramientas") => `${coma("With pleasure")}. Here is the ${panel === "resultados" ? "results" : "tools"} panel.`,
    sinPanel: `As you wish${s ? `, ${s}` : ""}. I'll keep it hidden; whenever you need it, ask me or tap the button on my bar.`,
    prueba: `${coma(hola)}. This is how my voice will sound. The simulator's systems are ready and I'm at your service.`,
  };
}
/** Lo que Melki dice al activar el asistente (con el trato por defecto). */
export const SALUDO_MANOS_LIBRES = frases("senor").bienvenida(true);
/** El saludo al activar el asistente en el idioma de la pantalla. */
export const saludoManosLibres = () => frases("senor").bienvenida(true);

export const AYUDA_VOZ =
  "Soy el Asistente Melki: por voz entiendo lo mismo que por escrito. Mientras mi barra esté abierta, dígame su pedido directamente, sin llamarme; por ejemplo: «pon el gateway en Cumaral», «conecta a los que faltan», «puebla la zona con doscientas cincuenta personas», «¿cuántas personas aguanta el Repetidor 1?», «¿cómo dejo la mayor cobertura posible?», «muestra el panel de resultados» o «pantalla limpia». Lo que no sea una orden lo dejo pasar. Con la barra cerrada (en reposo), diga «Hola Melki», «Oye Melki» o «Hey Melki» y su pedido. Si me habla en inglés, mi doble oído lo entiende y cambio de idioma solo. Para usar mis botones diga «sí, hazlo» o «la segunda»; también entiendo «para», «repite», «más detalle», «deshaz», «deja de escuchar» (quedo en reposo, atento a «Hola Melki») y «apaga el micrófono». Mi barra se arrastra a cualquier parte del mapa y se achica sola mientras espero. Entiendo los municipios aunque se oigan mal («ubícame en Barranca de Upía, Meta»); si dudo, le pregunto «¿se refiere a…?», y si no le entiendo, le pido que me lo repita. También: «ármame una red que cubra todo el municipio», «la zona norte del municipio», «¿dónde estamos?», y «explícame la red»: mi robot la recorre punto por punto y le escribo por qué quedó así. No hablo en voz alta: le escucho todo el tiempo, hago lo que me pida y le dejo la respuesta escrita en mi barra y en la conversación. Si quiere oírme, diga «háblame» o toque el parlante de la conversación; «no hables» me vuelve a callar.";

/** La ayuda de la voz en el idioma de la pantalla. */
export const ayudaVoz = () =>
  tx(
    AYUDA_VOZ,
    "I'm the Melki Assistant: by voice I understand the same as in writing. While my bar is open, just tell me your request, without calling me; for example: “put the gateway in Cumaral”, “connect the missing ones”, “populate the zone with two hundred fifty people”, “how many people can Repeater 1 handle?”, “show the results panel” or “clean the screen”. Anything that isn't an order I let pass. With the bar closed (on standby), say “Hey Melki” or “Hello Melki” followed by your request. If you speak to me in Spanish, my second ear understands it and I switch languages on my own. To use my buttons say “yes, do it” or “the second one”; I also understand “stop”, “repeat”, “more details”, “undo”, “stop listening” (I go on standby, attentive to “Hey Melki”) and “turn off the microphone”. My bar can be dragged anywhere on the map and shrinks while I wait. I understand municipalities even when they sound wrong (“take me to Barranca de Upía, Meta”); if I'm not sure, I ask “do you mean…?”, and if I don't understand you, I ask you to repeat it. Also: “build me a network that covers the whole municipality”, “where are we?”, and “walk me through the network”: my robot goes through it point by point and I write why it turned out that way. I don't speak out loud: I listen all the time, do what you ask and leave the answer written on my bar and in the conversation. If you want to hear me, say “talk to me” or tap the speaker in the conversation; “stop talking” silences me again. To switch languages, say “habla en español” or use the gear in the top bar.",
  );

/** Palabras del simulador que ayudan a elegir entre lo que el reconocimiento cree haber oído. */
const TERMINOS =
  /\b(red|redes|malla|mesh|meshcore|gateway|repetidor\w*|nodos?|antenas?|personas?|gente|cobertura|senal|simul\w*|hectareas?|kilometros?|km|metros?|municipio|departamento|zona|pagos?|whatsapp|mensajes?|trama|sostenible|viable|construye|hazme|arma|armame|disena|pon|agrega|mueve|sube|baja|borra|muestra|resultados|herramientas|paneles?|starlink|solar|costo|cuesta|lleva\w*|ubicame|popularidad|aguanta\w*)\b/g;

/** Lo mismo en inglés. */
const TERMINOS_EN =
  /\b(network|mesh|meshcore|gateway|repeaters?|nodes?|antennas?|people|persons?|coverage|signal|simulat\w*|hectares?|kilomet\w*|meters?|municipality|department|zone|payments?|whatsapp|messages?|trama|sustainable|build|design|put|add|move|raise|lower|delete|remove|show|results|tools|panels?|starlink|solar|cost|costs|take me|popularity|handle|hold)\b/g;

/**
 * Elige, entre las versiones que propone el reconocimiento para una frase, la que mejor se entiende en el simulador:
 * la que trae el nombre de Melki y más palabras del simulador, sin olvidar el orden del reconocedor (la primera suele
 * ser la más probable). v17.5 · `conOido`: lo que entendería Melki corrigiendo lo mal oído («at a repeater…» → «add a
 * repeater…»); solo se mira si ninguna versión se entiende tal cual como una orden completa (es más lento).
 */
export function elegirAlternativa(alternativas: string[], entiende?: (pedido: string) => number, conOido?: (pedido: string) => number): string {
  const opciones = alternativas
    .map((t, i) => {
      if (!t.trim()) return null;
      const n = normal(t);
      let p = -i * 0.75;
      const a = detectarActivacion(t);
      if (a.activado) p += 4;
      p += (n.match(TERMINOS)?.length ?? 0) * 1;
      p += (n.match(TERMINOS_EN)?.length ?? 0) * 1;
      if (/\d/.test(n)) p += 0.5;
      // Lo que el simulador entiende como orden (con un lugar que existe) pesa más que las palabras sueltas
      const pedido = entiende || conOido ? limpiarComando(a.activado ? a.resto : t) : "";
      const directo = entiende && pedido ? entiende(pedido) : 0;
      return { t, p, pedido, directo };
    })
    .filter((x): x is { t: string; p: number; pedido: string; directo: number } => x !== null);
  const mirarOido = Boolean(conOido) && !opciones.some((o) => o.directo >= 3);
  let mejor = alternativas[0] ?? "";
  let puntos = -Infinity;
  for (const o of opciones) {
    const corregido = mirarOido && o.pedido && conOido ? conOido(o.pedido) : 0;
    const total = o.p + Math.max(o.directo, corregido);
    if (total > puntos) {
      puntos = total;
      mejor = o.t;
    }
  }
  return mejor;
}

/** Las frases que se le sugieren al reconocimiento, en el idioma de la pantalla. */
export const frasesReconocimiento = (): string[] =>
  idioma() === "en"
    ? [
        "Melki",
        "Hey Melki",
        "Hello Melki",
        "gateway",
        "repeater",
        "MeshCore",
        "Meshtastic",
        "LoRa",
        "mesh network",
        "hectares",
        "Trama",
        "Starlink",
        "WhatsApp",
        "Barranca de Upía",
        "Cumaral",
        "Villavicencio",
        "take me to",
        "the whole municipality",
        "popularity zones",
        "how much can it handle",
        "stable signal",
        "walk me through the network",
        // v17.5 · Lo que más se oía mal con acento
        "Yagi",
        "KMZ",
        "simulate",
        "coverage",
        "populate",
        "stress test",
        "load test",
        "satellite view",
        "northeast",
        "northwest",
        "southeast",
        "southwest",
        "dBi",
        "dBm",
        "Ejemplo",
        "link report",
        "optimization",
        // v17.6 · El mapa y la vista
        "zoom in",
        "zoom out",
        "legend",
        "terrain relief",
        "3D",
        "OpenTopoMap",
        "opacity",
      ]
    : FRASES_RECONOCIMIENTO;

/** Frases que se le sugieren al reconocimiento en el equipo (si el navegador lo permite) para que las entienda mejor. */
export const FRASES_RECONOCIMIENTO = [
  "Melki",
  "Hola Melki",
  "Hey Melki",
  "Hello Melki",
  "Oye Melki",
  "gateway",
  "repetidor",
  "MeshCore",
  "red mesh",
  "hectáreas",
  "Trama",
  "Starlink",
  "WhatsApp",
  "Barranca de Upía",
  "Cumaral",
  "Villavicencio",
  "ubícame en",
  "todo el municipio",
  "zonas de popularidad",
  "hasta dónde aguanta",
  "señal media",
  "señal estable",
  // v17.5 · Lo que más se oía mal al hablar rápido
  "Yagi",
  "KMZ",
  "LoRa",
  "Meshtastic",
  "súbelo",
  "bájalo",
  "ponle",
  "prueba de estrés",
  "hora pico",
  "a la redonda",
  "área objetivo",
  "barra de herramientas",
  "dBm",
  "noreste",
  "noroeste",
  "sureste",
  "suroeste",
  // v17.6 · El mapa y la vista
  "acerca el mapa",
  "aléjalo",
  "zoom",
  "leyenda",
  "relieve",
  "3D",
  "OpenTopoMap",
  "opacidad",
];

