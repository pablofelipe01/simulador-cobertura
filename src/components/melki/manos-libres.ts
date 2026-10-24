// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Asistente Melki (por voz, tipo Jarvis): Melki escucha todo el tiempo y se activa con su nombre («Hola Melki», «Oye
// Melki», «Hey Melki», «Hello Melky»…, en las formas en que el reconocimiento lo escribe); ejecuta la orden, contesta
// en voz alta, con el trato cortés de un mayordomo, y se queda atento unos segundos para seguir la conversación sin
// repetir su nombre. Aquí está lo que no depende de la pantalla: reconocer el llamado, los controles de voz («para»,
// «repite», «más detalle», «sí, hazlo», «la segunda», «deja de escuchar»), limpiar lo dicho, resumir la respuesta para
// leerla y las frases del asistente.
import { normalizarDictado } from "./dictado";
import { numerosEnPalabras } from "./numeros";
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
const NOMBRE = /^(?:melk[iy]e?s?|mel+k[iy]e?|melqu[iy]|melk[ie]y|melkee|melkie|melchi|melgi|melky|malk[iy]|milk[iy]|nelk[iy]|belk[iy]|welk[iy]|elk[iy])$/;
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
  const partes = frase.trim().split(/\s+/).filter(Boolean);
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
  | { tipo: "apagar" }
  /** Apagar del todo el micrófono (también la escucha en reposo). */
  | { tipo: "microfono" }
  | { tipo: "gracias" }
  | { tipo: "no" }
  | { tipo: "accion"; indice: number | "ultima" }
  | { tipo: "ayuda" };

/** Lo que se dice para manejar la conversación (no son órdenes del simulador). */
export function controlDeVoz(frase: string): ControlVoz | null {
  const t = normal(frase).replace(/^(melki|oye|hola)\s+/, "");
  if (!t) return null;
  if (/^(para|pare|parale|detente|detengase|silencio|callate|callese|calla|basta|stop|ya basta|suficiente|ya esta bien|ok para|espera)$/.test(t)) return { tipo: "callar" };
  if (/^(repite|repitelo|repitemelo|repiteme|otra vez|de nuevo|que dijiste|no te (entendi|escuche|oi)|no escuche|como dijiste|perdon que dijiste)$/.test(t)) return { tipo: "repetir" };
  if (/^(mas detalles?|dame (mas )?detalles?|con detalle|explicame( mas| mejor)?|explica( mas| mejor)?|leelo todo|leeme todo|lee todo|dime todo|completo|la respuesta completa|amplia|amplialo|cuentame mas|y que mas|sigue)$/.test(t)) return { tipo: "detalle" };
  if (/^(apaga|desactiva|cierra|quita|deten)\w* (el |la )?(microfono|escucha( pasiva| en reposo)?)( del todo)?$|^no me escuches( mas)?$|^ya no me escuches( mas)?$|^deja de escuchar(me)? del todo$|^no escuches mas$/.test(t))
    return { tipo: "microfono" };
  if (
    /^(apaga|desactiva|termina|cierra|sal de|quita|deten)\w* (el )?(modo )?(manos libres|escucha|microfono|jarvis|asistente( melki| de voz)?)$|^deja de escuchar(me)?$|^ya no (me )?escuches$|^no me escuches$|^(adios|chao|hasta luego|hasta pronto|nos vemos|bye|goodbye)( melki)?$/.test(
      t,
    )
  )
    return { tipo: "apagar" };
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
  return null;
}

/** Lo dicho, listo para Melki: números en cifras, coordenadas y sin muletillas. */
export function limpiarComando(frase: string): string {
  let t = frase.replace(/\s+/g, " ").trim();
  t = numerosEnPalabras(t);
  t = normalizarDictado(t);
  t = t.replace(/^(eh+|em+|este|bueno|pues|a ver|mira|oye)[, ]+/i, "").replace(/[, ]+(eh+|por favor|porfa)$/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
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
  return quedo ? `${dicho.replace(/[:;,]\s*$/, ".")} Le dejé el detalle escrito.` : dicho;
}

/**
 * ¿Lo que se oyó es la propia voz de Melki que volvió a entrar por el micrófono (parlantes sin audífonos)? Lo es si casi
 * todas sus palabras están en lo que Melki acaba de decir. Así no se responde a sí mismo.
 */
export function pareceEco(oido: string, dicho: string): boolean {
  const palabras = normal(oido)
    .split(" ")
    .filter((w) => w.length > 1);
  if (!palabras.length) return false;
  const voz = new Set(normal(`${paraHablar(dicho)} ${dicho}`).split(" "));
  const dentro = palabras.filter((w) => voz.has(w)).length;
  return palabras.length === 1 ? dentro === 1 : dentro / palabras.length >= 0.75;
}

/** Cómo se dirige Melki a la persona. */
export type Trato = "senor" | "senora" | "ninguno";

/**
 * Las frases del Asistente Melki, con el trato cortés y elegante de un mayordomo. `vez` va contando los llamados para
 * no repetir siempre lo mismo.
 */
export function frases(trato: Trato) {
  const s = trato === "senor" ? "señor" : trato === "senora" ? "señora" : "";
  /** «…, señor» o nada. */
  const coma = (frase: string) => (s ? `${frase}, ${s}` : frase);
  const bienvenido = trato === "senora" ? "Bienvenida" : trato === "senor" ? "Bienvenido" : "Le doy la bienvenida";
  const llamados = [coma("Dígame") + ".", coma("A sus órdenes") + ".", coma("Le escucho") + ".", `¿En qué le sirvo${s ? `, ${s}` : ""}?`];
  return {
    bienvenida: (primera: boolean) =>
      primera
        ? `${coma("Hola")}. ${bienvenido}. Soy Melki, su asistente: estoy atento y presto a seguir sus órdenes. Cuando me necesite, diga «Hola Melki», aunque esta barra esté cerrada.`
        : `${coma("A su servicio")}. Diga «Hola Melki» cuando me necesite.`,
    llamado: (vez: number, ingles: boolean) =>
      ingles
        ? `Hello${s ? `, ${trato === "senora" ? "madam" : "sir"}` : ""}. Le escucho.`
        : vez === 0
          ? `${s ? `Hola, mi ${s}` : "Hola"}. Le escucho; estoy atento y presto a seguir sus órdenes.`
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
    yaEscucho: `Ya le estoy escuchando${s ? `, ${s}` : ""}: diga «Hola Melki» y su pedido.`,
    /** Sugerencias cuando los paneles están ocultos (terminan en pregunta: «sí» u «ok» las acepta). */
    verResultados: `Para verlo con más detalle, ¿desea que le muestre el panel de resultados${s ? `, ${s}` : ""}?`,
    verHerramientas: `Para revisar los nodos y los parámetros, ¿le muestro el panel de herramientas${s ? `, ${s}` : ""}?`,
    mostrando: (panel: "resultados" | "herramientas") => `${coma("Con gusto")}. Aquí tiene el panel de ${panel}.`,
    sinPanel: `Como usted diga${s ? `, ${s}` : ""}. Lo dejo oculto; cuando lo necesite, pídamelo o toque el botón de mi barra.`,
    prueba: `${coma("Hola")}. Así sonará mi voz. Estoy a sus órdenes.`,
  };
}

/** Lo que Melki dice al activar el asistente (con el trato por defecto). */
export const SALUDO_MANOS_LIBRES = frases("senor").bienvenida(true);

export const AYUDA_VOZ =
  "Soy el Asistente Melki: por voz entiendo lo mismo que por escrito. Dígame «Hola Melki», «Oye Melki» o «Hey Melki» y su pedido; por ejemplo: «pon el gateway en Cumaral», «conecta a los que faltan», «puebla la zona con doscientas cincuenta personas», «¿cuántas personas aguanta el Repetidor 1?», «¿cómo dejo la mayor cobertura posible?», «muestra el panel de resultados» o «pantalla limpia». Después de responder me quedo atento unos segundos: siga hablando sin repetir mi nombre. Para usar mis botones diga «sí, hazlo» o «la segunda»; también entiendo «para», «repite», «más detalle», «deshaz», «deja de escuchar» (quedo en reposo, atento a «Hola Melki») y «apaga el micrófono». Mi barra se arrastra a cualquier parte del mapa y se achica sola mientras espero.";

/** Palabras del simulador que ayudan a elegir entre lo que el reconocimiento cree haber oído. */
const TERMINOS =
  /\b(red|redes|malla|mesh|meshcore|gateway|repetidor\w*|nodos?|antenas?|personas?|gente|cobertura|senal|simul\w*|hectareas?|kilometros?|km|metros?|municipio|zona|pagos?|whatsapp|mensajes?|trama|sostenible|viable|construye|hazme|arma|disena|pon|agrega|mueve|sube|baja|borra|muestra|resultados|herramientas|paneles?|starlink|solar|costo|cuesta|lleva\w*)\b/g;

/**
 * Elige, entre las versiones que propone el reconocimiento para una frase, la que mejor se entiende en el simulador:
 * la que trae el nombre de Melki y más palabras del simulador, sin olvidar el orden del reconocedor (la primera suele
 * ser la más probable).
 */
export function elegirAlternativa(alternativas: string[]): string {
  let mejor = alternativas[0] ?? "";
  let puntos = -Infinity;
  alternativas.forEach((t, i) => {
    if (!t.trim()) return;
    const n = normal(t);
    let p = -i * 0.75;
    if (detectarActivacion(t).activado) p += 4;
    p += (n.match(TERMINOS)?.length ?? 0) * 1;
    if (/\d/.test(n)) p += 0.5;
    if (p > puntos) {
      puntos = p;
      mejor = t;
    }
  });
  return mejor;
}

/** Frases que se le sugieren al reconocimiento en el equipo (si el navegador lo permite) para que las entienda mejor. */
export const FRASES_RECONOCIMIENTO = ["Melki", "Hola Melki", "Hey Melki", "Hello Melki", "Oye Melki", "gateway", "repetidor", "MeshCore", "red mesh", "hectáreas", "Trama", "Starlink", "WhatsApp", "Barranca de Upía", "Cumaral", "Villavicencio"];

