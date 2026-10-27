// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Cerebro local de Melki: temas con palabras clave y respuestas que usan el estado actual del simulador.
// No envía nada a internet. Más adelante se puede conectar a un modelo de IA (ver variables de entorno).
import { CLASES, presetEquivalente, presetPorId } from "@/lib/radio/constantes";
import { entornoPorId, ENTORNOS, perdidaEntorno } from "@/lib/radio/entorno";
import { anchosHaz, esDireccional, PATRONES, patronPorId } from "@/lib/radio/patron";
import { consejoRed, type EstadoRed } from "@/lib/radio/estado-red";
import { airePagoMs, bytesDatos, esperaRetransmision, INTENTOS, tiempoEnAireMs } from "@/lib/radio/mensaje";
import { ENERGIA_P1, ESTADOS_USUARIO, ESTRES_MEDIDO, ORDEN_ESTADOS_USUARIO, PAGOS_PERSONA_DIA_TRAMA, TOPE_CICLO_PCT } from "@/lib/radio/estres";
import { FICHA_GATEWAY, PROTOCOLOS } from "@/lib/radio/protocolos";
import { CAPACIDAD_TRAMA, CATALOGO, COTIZADOR, DEPARTAMENTOS_TRAMA, OPERACION_TRAMA, PRECIOS, SF_TRAMA, TERRENOS_TRAMA, unitarioCop, type SfTrama } from "@/lib/radio/trama";
import { esReferencia, resumenRed as resumenParametros } from "@/lib/radio/red";
import { DERECHOS, CREDITO, TITULARIDAD } from "@/lib/autoria";
import type { Antena, Escenario, Parametros, ResultadoSimulacion } from "@/lib/radio/tipos";

import type { ModoApp } from "../simulador/estado";

import { accionAjuste, textoCoberturaUtil, textoRed, type Orden } from "./ordenes";
import { TOURS, type IdTour } from "./tours";

/** «recorrido» empieza el tour indicado; «tours» muestra el menú de tours; «manos-libres» activa la escucha por voz; «acerca» abre la autoría y la licencia. */
export type AccionMelki = "recorrido" | "tours" | "simular" | "ejemplo" | "agregar" | "inspeccionar" | "parametros" | "resultados" | "kmz" | "regla" | "orden" | "deshacer" | "manos-libres" | "acerca" | "herramientas" | "pitch" | "ajustes-ia";

/** Con «detalle», la acción se muestra como una opción de menú (título y una línea). */
export type AccionRespuesta = { texto: string; accion: AccionMelki; orden?: Orden; escenario?: Escenario; tour?: IdTour; detalle?: string };

export type Respuesta = {
  texto: string;
  acciones?: AccionRespuesta[];
  /** Lo que se dice en voz alta, si es distinto de lo escrito (la disculpa no repite en voz lo que oyó: haría eco). */
  voz?: string;
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
};

/** «señor», «señora» o nada, según el trato elegido (por defecto, señor). */
const tratoDe = (c: ContextoMelki) => (c.trato === "ninguno" ? "" : c.trato === "senora" ? "señora" : "señor");

/** Ejemplos de lo que sí hace, para retomar el trabajo cuando le piden algo fuera del simulador. */
const EJEMPLOS_RETOMAR = "«hazme una red sostenible en Barranca de Upía de 11.226 hectáreas», «¿cómo está la red?», «¿cuánto cuesta la red?» o «puebla la zona con 250 personas»";

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
  /\b(red|redes|malla|nodos?|antenas?|gateway|repetidor\w*|personas?|gente|cobertura|senal|simul\w*|mapa|enlaces?|saltos?|pagos?|whatsapp|mensajes?|trama|meshcore|mesh|lora|frecuencia\w*|sf\d*|altura|torres?|area|hectareas?|km|kilometros?|municipio|departamento|relieve|terreno|potencia|ganancia|factib\w*|viab\w*|sostenib\w*|costos?|precios?|cuesta|starlink|bateria\w*|solar|paneles?|resultados?|tours?|recorrido|zonas?|estres|carga|capacidad|usuarios?|billeteras?|regla|medir|exporta\w*|kmz|google earth|radio mobile|melki)\b/;

/** Charla corta («¿cómo estás?», «¿qué tal?»): responde con cortesía y vuelve al trabajo. */
const CHARLA = /^(?:(?:hola|oye|hey|buenas|buenos dias|buenas tardes|buenas noches)\s+)?(?:melki\s+)?(?:como (?:estas|te va|te encuentras|amaneciste|has estado|vas)|que tal(?: estas| vas| te va)?|todo bien|como andas)(?:\s+melki)?$/;

/** «¿Me escuchas?», «¿estás ahí?»: confirma que escucha y queda a la orden. */
const ME_ESCUCHAS = /^(?:(?:hola|oye|hey)\s+)?(?:melki\s+)?(?:me (?:escuchas|oyes|entiendes|copias|estas escuchando|estas oyendo)|estas ahi|sigues ahi|hay alguien|estas despierto|funcionas|me lees)(?:\s+melki)?$/;
/** «¿Dónde estamos?», «¿qué municipio es este?»: el municipio que se ve en el mapa. */
const DONDE_ESTAMOS = /\b(?:donde (?:estamos|estoy|queda esto|es esto)|en que (?:municipio|departamento|lugar|parte|zona) (?:estamos|estoy|esta el mapa|queda esto|es esto)|que (?:lugar|municipio|zona|pueblo) es (?:este|esta|esto)|que estoy viendo|que estamos viendo)\b/;
/** «Muy bien», «excelente trabajo», «eres el mejor»: agradece con cortesía y sigue. */
const ELOGIO = /^(?:muy bien|excelente|buen trabajo|buenisimo|que bien|lo hiciste bien|bien hecho|eres (?:el|la) mejor|eres genial|me gusta|me encanta|increible|espectacular|asi me gusta)(?:\s+(?:melki|trabajo|hecho))*$/;

/**
 * No se entendió lo que dijo (sobre todo por voz, cuando el dictado escribe algo sin sentido): se disculpa, dice lo que
 * oyó y pide que se lo repitan, con ejemplos.
 */
export function respuestaNoEntendi(c: ContextoMelki, pregunta: string): Respuesta {
  const s = tratoDe(c);
  const oido = pregunta.trim().replace(/\s+/g, " ").slice(0, 120);
  return {
    texto: `Discúlpeme${s ? `, ${s}` : ""}, no le entendí bien. ¿Me lo repite, por favor? ${c.porVoz ? `Escuché: «${oido}». ` : ""}Puede decirme, por ejemplo, «ubícame en Barranca de Upía, Meta», «ármame una red que cubra todo el municipio» o «¿cuánto cuesta la red?».`,
    // En voz, solo la disculpa: repetir lo que oyó o los ejemplos haría que el micrófono los volviera a oír
    voz: `Discúlpeme${s ? `, ${s}` : ""}, no le entendí bien. ¿Me lo repite, por favor?`,
    acciones: [
      { texto: "¿Qué puedo decir?", accion: "orden", orden: { tipo: "que-hago" } },
      { texto: "Ver los tours guiados", accion: "tours" },
    ],
  };
}

export function respuestaFueraDeTema(c: ContextoMelki): Respuesta {
  const s = tratoDe(c);
  return {
    texto: `${s ? `Mi ${s}, f` : "F"}ui diseñado y creado para cumplir órdenes y procesos dentro de este simulador: diseñar y simular la red MeshCore de Trama, sus nodos, su cobertura, su capacidad y su costo. Eso se sale de lo que puedo hacer, pero con gusto seguimos con la red. Por ejemplo: ${EJEMPLOS_RETOMAR}.`,
    acciones: [
      { texto: "¿Qué hago ahora?", accion: "orden", orden: { tipo: "que-hago" } },
      { texto: "Ver los tours guiados", accion: "tours" },
    ],
  };
}

const f = (n: number, d = 1) => n.toFixed(d).replace(".", ",");
/** Pesos redondeados a la manera del documento: «$1.035.000», «$9,4 M». */
const pesos = (v: number) => (v >= 2e6 ? `$${f(v / 1e6, v >= 1e8 ? 0 : 1)} M` : `$${(Math.round(v / 1000) * 1000).toLocaleString("es-CO")}`);
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

type Tema = { id: string; claves: string[]; responder: (c: ContextoMelki) => Respuesta };

/** Estado de la malla sembrada: personas conectadas, sin cobertura y qué sigue. */
function resumenMalla(c: ContextoMelki): Respuesta | null {
  const red = c.red;
  if (c.modo !== "sembrar" || !red) return null;
  const consejo = consejoRed(red, c.parametros.limiteSaltos);
  const acciones: AccionRespuesta[] = [];
  if (red.alDia && red.sinCobertura.length) acciones.push({ texto: "Conectar a los que faltan", accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } });
  if (red.alDia && red.conectadas.length) acciones.push({ texto: "Enviar un mensaje de prueba", accion: "orden", orden: { tipo: "mensaje" } });
  return { texto: `${textoRed(red, c.parametros.limiteSaltos)} ${consejo.paso ? `Paso ${consejo.paso}: ` : ""}${consejo.titulo}. ${consejo.texto}`, acciones: acciones.length ? acciones : undefined };
}

function resumenRed(c: ContextoMelki): Respuesta {
  const malla = resumenMalla(c);
  if (malla) return malla;
  const r = c.resultado;
  if (!r) {
    return c.antenas.length
      ? { texto: "Todavía no hay una simulación. Pulse Simular y le cuento cómo queda la red.", acciones: [{ texto: "Simular ahora", accion: "simular" }] }
      : { texto: "Aún no hay antenas en el escenario. Puede ubicarlas en el mapa o cargar el ejemplo para ver cómo funciona.", acciones: [{ texto: "Cargar el ejemplo", accion: "ejemplo" }, { texto: "Agregar antena", accion: "agregar" }] };
  }
  const fac = r.factibilidad;
  const fallan = fac.criterios.filter((k) => !k.ok).map((k) => k.nombre.charAt(0).toLowerCase() + k.nombre.slice(1));
  let texto = `Resultado: ${fac.titulo.toLowerCase()} (${fac.puntaje}/100). ${textoCoberturaUtil(r)}.`;
  if (fallan.length) texto += ` Falta cumplir: ${fallan.join("; ")}.`;
  if (fac.recomendaciones[0]) texto += ` Mi primera sugerencia: ${fac.recomendaciones[0]}`;
  if (c.desactualizado) texto += " Ojo: cambió algo después de simular; conviene simular de nuevo.";
  const ajuste = c.desactualizado ? null : accionAjuste(r);
  return { texto, acciones: [{ texto: "Ver resultados", accion: "resultados" }, ...(ajuste ? [ajuste] : [])] };
}

const TEMAS: Tema[] = [
  {
    id: "saludo",
    claves: ["hola", "buenos dias", "buenas tardes", "buenas noches", "buenas", "hey", "saludos", "que tal"],
    responder: () => ({
      texto: "¡Hola! Soy Melki. Siembro con usted la red de Trama, que lleva pagos, mensajes de WhatsApp y consultas a la inteligencia artificial a donde no hay señal (gateway, repetidores y gente), simulo su cobertura sobre el relieve real, pueblo la zona con personas y pruebo cuánto tráfico aguanta cada frecuencia. Pídamelo con sus palabras o le muestro el simulador paso a paso.",
      acciones: [{ texto: "Ver los tours guiados", accion: "tours" }],
    }),
  },
  {
    id: "quien",
    claves: ["quien eres", "como te llamas", "que eres", "melki"],
    responder: () => ({
      texto: "Soy Melki, el asistente del simulador. Funciono aquí mismo, sin enviar sus datos a ningún servidor. Conozco el modelo de propagación, la red MeshCore de Trama —equipos, precios, capacidad por frecuencia y dimensionamiento por departamento— y cada parte de la pantalla.",
    }),
  },
  {
    id: "que-es",
    claves: ["para que sirve", "que hace", "que es esto", "simulador", "como funciona", "como se usa", "como empiezo", "empezar"],
    responder: () => ({
      texto:
        "El simulador planea la red por radio de Trama (MeshCore, LoRa en la banda libre de 915 a 928 MHz) sobre el relieve real: por ella van pagos, mensajes de WhatsApp por texto y consultas a la inteligencia artificial en los lugares sin señal. Tiene dos modos: «Sembrar la malla», el sencillo, donde pone el Gateway + Internet, los repetidores y la gente y le guío paso a paso; y el modo avanzado, con todos los paneles. Al simular ve el nivel de señal con los colores de Radio Mobile, el alcance de cada repetidor, los enlaces de la malla, los saltos hasta el gateway y un veredicto de factibilidad con recomendaciones. Con «Poblar personas» reparte la gente de la zona y con la «Prueba de carga» ve cuántos pagos y mensajes aguanta la frecuencia antes de reventarse. También le dimensiono la red de un departamento con los precios del documento de Trama.",
      acciones: [{ texto: "Ver los tours guiados", accion: "tours" }],
    }),
  },
  {
    id: "agregar",
    claves: ["agregar antena", "anadir antena", "nueva antena", "poner antena", "ubicar antena", "crear antena", "agregar", "anadir", "ubicar", "como inscribo", "como agrego"],
    responder: () => ({
      texto:
        "Yo lo hago por usted: escríbame, por ejemplo, «inscribe un nodo antena llamado Torre Norte en 4.5123, -73.1234 a 15 m». También puede pulsar «Ubicar en el mapa» y hacer clic donde va, o usar «Por coordenadas». El primer nodo antena queda como pasarela.",
      acciones: [{ texto: "Agregar en el mapa", accion: "agregar" }],
    }),
  },
  {
    id: "capacidades",
    claves: ["que puedes hacer", "que sabes hacer", "que haces", "comandos", "ordenes", "en que me ayudas", "como me ayudas", "que me puedes ayudar"],
    responder: () => ({
      texto: [
        "Manejo el simulador con sus palabras; puede pedirme varias cosas en un mismo mensaje y todo se puede deshacer. Por ejemplo:",
        "• Sembrar la malla: «pon el gateway en Cumaral», «agrega un repetidor a 8 km al norte del gateway», «pon una persona en 4.31, -73.22», «conecta a los que faltan», «envía un pago desde Persona 1», «¿qué hago ahora?».",
        "• Gente y capacidad: «puebla la zona con 250 personas», «reparte 1 persona por km² en el área objetivo», «solo donde haya señal», «envía 25 pagos al tiempo», «manda 15 mensajes de WhatsApp en 10 segundos», «¿hasta cuántos pagos aguanta?», «quita las pobladas».",
        "• Trama: «¿cuánto cuesta la red para el Chocó?», «¿y para todo el país con el 50 % de adopción?», «dimensiona 5.000 usuarios en 800 km² de sabana», «¿cuánto cuesta un repetidor?», «¿qué lleva cada persona?», «¿cuántos usuarios por frecuencia?».",
        "• Diseñar una red: «ármame una malla que cubra 11.226 hectáreas con señal media o mejor en el 99,9 %», «cubre 500 ha alrededor de Cumaral con repetidores de 12 m», «cubre el área que medí con respaldo».",
        "• Ajustar la red al mejor costo: «ajústamelo», «hazla factible sin pasar de 20 m», «optimiza el costo», «máximo 2 antenas de apoyo», «no muevas los nodos», «usa el área que medí como área objetivo con el 95 %».",
        "• Varias órdenes seguidas: «pon el gateway en 4.2, -73.37, luego un repetidor a 10 km al este y simula».",
        "• Nodos: «inscribe un nodo antena en 4°30'44\" N 73°07'24\" O a 12 m», «mueve Ejemplo 2 km al sur», «súbelo a 9 m», «sube todos los repetidores a 12 m», «borra todas las personas», «que Repetidor 2 no retransmita», «marca Torre 2 como pasarela».",
        "• Radio: «usa SF10», «la frecuencia a 921,5 MHz», «confiabilidad del 90 %», «usa Longley-Rice», «simula con vegetación densa», «informe del enlace Ejemplo y Torre 2».",
        "• Mapa, medir y exportar: «muestra las vías», «llévame a Villavicencio», «distancia entre Ejemplo y Torre 2», «perfil de Ejemplo a Torre 2», «¿cuánto cubre el área?», «exporta a Google Earth».",
        "• Por voz, sin tocar nada: active el «Asistente Melki» y diga «Hola Melki, pon el gateway en Cumaral»; le dejo el mapa libre y le ofrezco los paneles cuando hagan falta.",
        "Si prefiere dictar, toque el micrófono y revise el texto antes de enviarlo. Y si quiere aprender paso a paso, pídame un tour guiado.",
      ].join("\n"),
      acciones: [{ texto: "Ver los tours guiados", accion: "tours" }],
    }),
  },
  {
    id: "diseno",
    claves: ["disenar la red", "disena la red", "cubrir un area", "cubrir el area", "hectareas", "cuantos repetidores necesito", "cuantos repetidores", "planificar la red", "diseno por area", "red para un area"],
    responder: () => ({
      texto: [
        "Puedo diseñar la malla para un área: elijo dónde va el gateway (si aún no hay) y siembro repetidores, uno a uno, donde más área nueva cubren, siempre enlazados a la red (≥ 30 dB) y dentro del límite de saltos, con el relieve real. Al final simulo y le digo cuánto quedó cubierto por clase de señal.",
        "Dígame el tamaño, la señal y la meta: «ármame una malla que cubra 11.226 hectáreas con señal media o mejor en el 99,9 %». También entiendo «cubre 5 km a la redonda de Cumaral», «un área cuadrada de 2.000 ha», «10 por 12 km», «cubre el área que medí», «con repetidores de 20 m», «máximo 15 repetidores» y «con respaldo» (cada punto con dos nodos).",
        "Señal: buena ≥ 45 dB, estable ≥ 37 dB, media ≥ 30 dB, baja ≥ 20 dB; «entre buena, estable y media» es media o mejor. Si no dice dónde, uso el gateway o el centro del mapa que está viendo.",
      ].join("\n"),
    }),
  },
  {
    id: "nodos",
    claves: ["nodo", "nodos", "nodo antena", "tipo de nodo", "nodo de campo", "diferencia entre nodo y antena", "que es un nodo"],
    responder: () => ({
      texto:
        "En MeshCore cada equipo de la red es un nodo y su rol dice si retransmite. Aquí hay dos tipos: el nodo antena es infraestructura fija —el repetidor de Trama (SenseCAP Solar Node P1 con antena de 8 dBi en un tubo de 6 m) o el gateway (radios Heltec T114 con antena de 8 dBi en la torre de 12 m)—; pinta la capa de cobertura y forma la malla. El nodo de campo es la billetera de la persona (XIAO ESP32S3 + Wio-SX1262 o T1000-E, a 1,5 m): no pinta cobertura ni retransmite, pero reviso si llega al gateway y en cuántos saltos.",
    }),
  },
  {
    id: "regla",
    claves: ["regla", "medir distancia", "medir distancias", "medidas", "tomar medidas", "medir area", "area", "trayecto", "hectareas", "perimetro"],
    responder: () => ({
      texto:
        "La regla funciona como en Google Earth: elija Línea (distancia y rumbo), Trayecto (varios puntos) o Área (área y perímetro) y haga clic en el mapa; doble clic o Enter para terminar. Las mediciones quedan guardadas con el escenario: arrastre un punto para moverlo, arrastre el punto medio de un tramo para agregar uno y use clic derecho para borrar un punto. También le muestro el perfil del terreno de cada medición.",
      acciones: [{ texto: "Activar la regla", accion: "regla" }],
    }),
  },
  {
    id: "referencia",
    claves: ["municipios", "departamentos", "rios", "limites", "division", "divisiones", "fuentes hidricas", "quebradas", "cuerpos de agua", "nombres en el mapa", "vias", "carreteras"],
    responder: () => ({
      texto:
        "En Capas puede activar los límites y nombres de departamentos y municipios de Colombia (DANE), los ríos y lagos principales, los límites de países, las ciudades y poblados, y las vías. Para quebradas, caños y ríos pequeños con su nombre, cambie el mapa base a OpenTopoMap o Topográfico. Pase el cursor por el mapa y abajo verá las coordenadas y el municipio.",
    }),
  },
  {
    id: "buscar",
    claves: ["buscar", "buscador", "encontrar", "ubicar una coordenada", "ir a una coordenada", "donde queda"],
    responder: () => ({
      texto:
        "Use el buscador de arriba: escriba un municipio, un departamento, el nombre de un nodo o unas coordenadas (decimales o en grados, minutos y segundos). También puede pedírmelo: «llévame a Barranca de Upía» o «ve a 4.5, -73.1». Con clic derecho en el mapa tiene un menú para agregar nodos, medir o ver la señal en ese punto.",
    }),
  },
  {
    id: "alcance",
    claves: ["rango de alcance", "rango", "contorno", "anillos", "hasta donde llega", "hasta donde alcanza"],
    responder: () => ({
      texto:
        "Después de simular dibujo el rango de alcance de cada nodo antena: la línea naranja es hasta dónde hay servicio (≥ 20 dB) en cada dirección y la verde, hasta dónde es confiable (≥ 37 dB). Los anillos blancos marcan distancias alrededor del nodo seleccionado. Se activan o desactivan en Capas.",
    }),
  },
  {
    id: "coordenadas",
    claves: ["coordenadas", "gms", "grados minutos", "minutos segundos", "decimal", "latitud", "longitud", "formato", "wgs84"],
    responder: () => ({
      texto:
        "Acepto grados decimales (4.5123, -73.1234) y grados, minutos y segundos (4°30'44,3\" N, 73°07'24,2\" O). Use O o W para el oeste y S para el sur. Si pega el par completo en un campo, lleno los dos. Debajo de cada campo muestro la conversión para que la verifique. Todo está en WGS84, el mismo sistema del GPS y de Google Earth.",
    }),
  },
  {
    id: "mover",
    claves: ["mover", "arrastrar", "editar antena", "cambiar antena", "modificar", "reubicar"],
    responder: () => ({
      texto:
        "Con la herramienta Mover puede arrastrar cualquier torre en el mapa. Para editar nombre, altura, equipo o rol, haga clic en la antena (en el mapa o en la lista) y se abre su ficha. El ojo de la lista la saca de la simulación sin borrarla.",
    }),
  },
  {
    id: "eliminar",
    claves: ["eliminar", "borrar", "quitar antena", "suprimir"],
    responder: () => ({ texto: "Abra la ficha de la antena (clic sobre ella) y pulse Eliminar al final. Si solo quiere probar sin ella, use el ojo de la lista para excluirla." }),
  },
  {
    id: "simular",
    claves: ["simular", "calcular", "correr", "ejecutar", "actualizar", "recalcular", "procesar"],
    responder: (c) => ({
      texto: `Pulse Simular en la parte baja del panel izquierdo. Con «Simular al cambiar» activo, recalculo solo cuando usted mueve o edita algo. ${c.antenas.length > 6 ? "Con muchas antenas, la resolución Rápida responde mejor mientras ajusta." : ""}`.trim(),
      acciones: [{ texto: "Simular ahora", accion: "simular" }],
    }),
  },
  {
    id: "colores",
    claves: ["colores", "leyenda", "verde", "amarillo", "naranja", "rojo", "que significa", "significado"],
    responder: (c) =>
      c.modo === "sembrar"
        ? {
            texto: "En «Sembrar la malla» cada pieza tiene un aro del color de su conexión con el gateway: turquesa el gateway (con la nube «IA»), verde = conectada (el número es cuántos saltos hasta el gateway), rojo que parpadea = persona sin cobertura, naranja con aro punteado = repetidor que no alcanza la red, ámbar = llega con más saltos que el límite. Las líneas turquesa que avanzan son el flujo de la información hacia el gateway, y el contorno turquesa es hasta dónde llega cada nodo con servicio. Debajo, el color del terreno es la señal: verde oscuro buena, amarillo media, naranja baja y rojo sin servicio.",
          }
        : {
      texto: `Los colores son el margen de señal sobre la sensibilidad del receptor, con la misma paleta de las simulaciones de Radio Mobile: ${CLASES.map((k) => `${k.nombre.toLowerCase()} ${k.id === "sin" ? "por debajo de 20 dB" : `desde ${k.minimoDb} dB`}`).join(", ")}. Verde oscuro tolera follaje y movimiento; naranja funciona a ratos; rojo no tiene servicio. En Capas → Escala de la señal puede cambiar a dBm, µV o dBµV/m y usar colores arcoíris entre dos niveles o un solo umbral, como en Radio Mobile.`,
          },
  },
  {
    id: "margen",
    claves: ["margen", "db", "decibel", "sensibilidad", "dbm", "rssi", "snr"],
    responder: (c) => ({
      texto: `El margen es cuántos dB llega la señal por encima de la sensibilidad del receptor. Con el preset ${presetPorId(c.parametros.preset).nombre} la sensibilidad es ${f(presetPorId(c.parametros.preset).sensibilidadDbm)} dBm. Pedimos al menos 20 dB para servicio y 37 dB para servicio confiable, porque el modelo tiene un error típico de ±5 dB y el follaje, la lluvia y el cuerpo restan señal.`,
    }),
  },
  {
    id: "presupuesto",
    claves: ["presupuesto", "link budget", "potencia", "ganancia", "cable", "dbi", "perdida del cable"],
    responder: (c) => {
      const a = c.antenas[0];
      const s = presetPorId(c.parametros.preset).sensibilidadDbm;
      const ej = a ? ` Por ejemplo, ${a.nombre}: ${f(a.potenciaDbm, 0)} + ${f(a.gananciaDbi)} − ${f(a.perdidaCableDb)} + ${f(c.parametros.gananciaRxDbi)} − (${f(s)}) = ${f(a.potenciaDbm + a.gananciaDbi - a.perdidaCableDb + c.parametros.gananciaRxDbi - s - c.parametros.perdidaExtraDb)} dB.` : "";
      return { texto: `El presupuesto de enlace suma potencia del transmisor y ganancias de las antenas, y resta la pérdida del cable, la pérdida extra y la sensibilidad. Al restarle la pérdida del trayecto queda el margen.${ej}` };
    },
  },
  {
    id: "presets",
    claves: ["preset", "ajuste de radio", "meshcore", "spreading", "sf", "sf11", "sf10", "sf9", "250 khz", "62,5", "ancho de banda", "velocidad", "modem"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      const trama = ([11, 10, 9] as SfTrama[]).map((sf) => `SF${sf}: un pago ocupa ~${f(SF_TRAMA[sf].segPago, SF_TRAMA[sf].segPago % 1 ? 1 : 0)} s de aire, ${SF_TRAMA[sf].usuariosFrecuencia} usuarios por frecuencia y ${Math.round(SF_TRAMA[sf].factorRadio * 100)} % del alcance`).join("; ");
      return {
        texto: `El ajuste de radio fija el factor de dispersión (SF) y el ancho de banda: más SF, más alcance pero cada paquete ocupa el aire más tiempo y caben menos pagos y mensajes. Trama usa 250 kHz — ${trama}. La comunidad MeshCore usa canales de 62,5 kHz (más sensibles y más lentos; el de EE. UU. va en 910,525 MHz, fuera de la banda colombiana). Ahora: ${p.nombre}, ${f(p.sensibilidadDbm)} dBm de sensibilidad y ≈ ${f(airePagoMs(p) / 1000)} s de aire por pago a 2 saltos. Todos los nodos de una frecuencia usan el mismo ajuste.`,
        acciones: [{ texto: "Ir a parámetros", accion: "parametros" }],
      };
    },
  },
  {
    id: "frecuencia",
    claves: ["frecuencia", "frecuencias", "915", "920", "928", "902", "ane", "banda", "legal", "regulacion", "resolucion 28", "espectro", "canal", "canales", "slot"],
    responder: (c) => ({
      texto: `En Colombia, la ANE (Resolución 000028 de 2026) reconoce el uso libre de 915 a 928 MHz. Trama usa cuatro frecuencias por sitio —${CAPACIDAD_TRAMA.frecuenciasMhz.map((x) => f(x, x % 1 ? 1 : 0)).join(", ")} MHz—, una por cada radio del gateway, para atender cuatro veces más gente en el mismo lugar. Ojo: el documento habla de 902–928 MHz y ~8 canales; las antenas son de 902–928, pero aquí solo vale de 915 a 928 MHz (conviene confirmarlo con el Inge). El ajuste de EE. UU. de MeshCore (910,525 MHz) queda por fuera. La simulación usa ${f(c.parametros.frecuenciaMhz, 3)} MHz; entre 915 y 928 MHz el alcance casi no cambia.`,
      acciones: [{ texto: "Ir a parámetros", accion: "parametros" }],
    }),
  },
  {
    id: "altura",
    claves: ["altura", "mastil", "elevar", "subir antena", "mas alto", "torre", "metros de altura", "tubo"],
    responder: () => ({
      texto: `La altura es lo que más mejora el alcance: despeja la zona de Fresnel sobre el follaje y el relieve. Trama pone el repetidor en un tubo de hierro de 6 m (con herrajes y base, ≈ ${pesos(precioDe("tubo") + precioDe("herrajes") + precioDe("base"))}) y el gateway en una torre arriostrada de 12 m (≈ ${pesos(precioDe("torre"))}), que además separa en vertical las antenas de sus 4 radios. Pruebe subir en pasos de 3 m y compare la cobertura útil; por encima de 30 m hace falta una torre autosoportada, muy costosa: casi siempre sale mejor una loma cercana o un repetidor de apoyo. Pídame «ajústamelo» y comparo esas opciones con el relieve real.`,
    }),
  },
  {
    id: "malla",
    claves: ["malla", "mesh", "enlace", "enlaces", "entre antenas", "retransmite", "retransmitir", "red mesh"],
    responder: (c) => {
      const r = c.resultado;
      const base =
        "En MeshCore solo los repetidores retransmiten: las billeteras y las radios del gateway (companion) envían y reciben lo suyo. El primer paquete hacia un destino se inunda por los repetidores; el destino devuelve la ruta y desde ahí cada pago o mensaje va directo por ese camino: solo el siguiente repetidor de la ruta lo pasa. Evalúo cada pareja con al menos un repetidor o el gateway: enlace sólido desde 30 dB, inestable entre 20 y 30 dB y sin enlace por debajo de 20 dB (el peor de los dos sentidos).";
      if (!r) return { texto: base };
      const s = r.enlaces.filter((e) => e.clase === "solido").length;
      const i = r.enlaces.filter((e) => e.clase === "inestable").length;
      return { texto: `${base} En este escenario hay ${s} enlaces sólidos y ${i} inestables de ${r.enlaces.length} parejas.` };
    },
  },
  {
    id: "saltos",
    claves: ["saltos", "hop", "hop limit", "hop_limit", "limite de saltos", "brincos", "flood max"],
    responder: (c) => ({
      texto: `En MeshCore la ruta va escrita en el paquete y un mensaje puede pasar hasta por 64 repetidores; el límite de saltos de aquí (${c.parametros.limiteSaltos}) es el del diseño. Trama calcula los pagos a 2 saltos: cada salto más vuelve a ocupar el aire con cada mensaje y su respuesta (en un pago, la orden, el comprobante y el aviso) y sus acuses, así que alarga la espera y le quita capacidad a la frecuencia. Reviso que cada persona y cada repetidor lleguen al gateway dentro de ese límite.`,
    }),
  },
  {
    id: "pasarela",
    claves: ["pasarela", "gateway", "internet", "starlink", "enlace wifi", "punto a punto", "ubiquiti", "mini pc", "servidor", "nodo principal", "sitio"],
    responder: (c) => {
      const p = c.antenas.filter((a) => a.pasarela).map((a) => a.nombre);
      return {
        texto: `El gateway (la pasarela) es el sitio con internet; todo pago, WhatsApp o consulta a la IA del campo debe llegar a él. En Trama es una torre arriostrada de 12 m con un mini PC sin ventilador (Intel N100, Linux), un hub USB, una UPS, polo a tierra y hasta 4 radios Heltec T114 —una por frecuencia, como companion por USB— con antena de 8 dBi: ≈ ${pesos(PRECIOS.sitioBase + 4 * PRECIOS.radio)} con su kit solar. El internet entra por Starlink (kit con energía solar ≈ ${pesos(PRECIOS.starlink)} y ${pesos(PRECIOS.starlinkMes)} al mes; el plan comercial de la operación es ${pesos(OPERACION_TRAMA.starlinkMesComercial)}) o por un enlace WiFi punto a punto de 5 GHz (≈ ${pesos(PRECIOS.enlace)} el par) desde un sitio que lo tenga; un Starlink alimenta hasta ${TERRENOS_TRAMA.plano.sitiosPorStarlink} sitios en plano y 1 en selva. El gateway verifica cada pago con el banco, pasa los WhatsApp a internet y lleva la nube «IA», el cerebro de inteligencia artificial que contesta las consultas de la gente; la respuesta (el comprobante, la confirmación o lo que contesta la IA) vuelve por la misma ruta. ${p.length ? `Ahora ${p.length === 1 ? "es" : "son"} gateway: ${p.join(", ")}.` : "Todavía no hay ninguno: póngalo primero."}`,
      };
    },
  },
  {
    id: "protocolos",
    claves: ["meshtastic", "mesh tastic", "mestastic", "meshcore o meshtastic", "diferencia entre meshcore", "protocolo", "protocolos", "inundacion administrada", "managed flooding", "client mute", "hop limit", "longfast", "long fast"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      const mc = PROTOCOLOS.meshcore;
      const mt = PROTOCOLOS.meshtastic;
      return {
        texto: [
          `El simulador trabaja con los dos protocolos de malla sobre LoRa; ahora está en ${PROTOCOLOS[p.protocolo].nombre} (${p.nombre}). Se cambia en Parámetros → Radio LoRa, o pídamelo: «cambia a Meshtastic», «usa MeshCore».`,
          `MeshCore: ${mc.quienRetransmite.toLowerCase()}. ${mc.ruteo} Cabecera de 2 bytes, carga útil de ${mc.cargaMaxima} B, texto de ${mc.textoMaximo} B (las tildes ocupan 2), acuses de 4 B, hasta ${mc.saltosMax} saltos y 3 reintentos (el último por inundación).`,
          `Meshtastic: ${mt.quienRetransmite.toLowerCase()}. ${mt.ruteo} Cabecera de 16 bytes, carga útil de ~${mt.cargaMaxima} B, hasta ${mt.saltosMax} saltos (3 por defecto), ${mt.envios} envíos por mensaje directo, y con el canal sobre el ${mt.canalAlertaPct} % recorta posiciones y telemetría.`,
          "En la prueba de popularidad la diferencia pesa: en Meshtastic cada mensaje que se inunda lo repiten muchos equipos (aunque cancelan cuando oyen a otro), así que en zonas con mucha gente el canal se llena antes; con los equipos en CLIENT_MUTE solo repiten los ROUTER y se parece más a MeshCore.",
        ].join("\n"),
        acciones: [{ texto: p.protocolo === "meshtastic" ? "Cambiar a MeshCore" : "Cambiar a Meshtastic", accion: "orden", orden: { tipo: "parametros", cambios: { preset: presetEquivalente(c.parametros.preset, p.protocolo === "meshtastic" ? "meshcore" : "meshtastic"), limiteSaltos: Math.min(c.parametros.limiteSaltos, p.protocolo === "meshtastic" ? mc.saltosMax : mt.saltosMax) }, descripcion: `el protocolo a ${p.protocolo === "meshtastic" ? "MeshCore" : "Meshtastic"}` } }],
      };
    },
  },
  {
    id: "gateway-medido",
    claves: ["se midio", "midio", "ficha tecnica", "gateway medido", "lo medido", "valores medidos", "datos medidos", "gateway real", "router solar", ...FICHA_GATEWAY.claves],
    responder: () => {
      const g = FICHA_GATEWAY;
      const ant = g.antenas.map((a) => `${a.nombre} (${a.nodo ? `${a.nodo}, ` : ""}${a.radio}${a.distanciaKm ? `, ${f(a.distanciaKm, 1)} km` : ""}${a.snrDb !== null ? `, SNR ${f(a.snrDb, 1)} dB` : ""}): responde el ${a.respuestaPct} %`).join("; ");
      return {
        texto: [
          `La prueba de popularidad puede usar lo medido en ${g.enFrase} (${g.semana}): ${g.equipo}, Meshtastic. Atiende de a uno (~${g.proceso.porMensajeS} s por mensaje; hasta ${g.proceso.peorS} s si la base de datos no responde), con respuestas de hasta ${g.respuestaParte} B por parte.`,
          `Tráfico: ${g.picos.dia} mensajes al día entre ${g.nodos.conocidos} equipos (${g.nodos.activos} activos), picos de ${g.picos.minuto} por minuto y ${g.picos.hora} por hora; mensajes de ${g.mensaje.minimo} a ${g.mensaje.maximo} caracteres (mediana ${g.mensaje.mediana}). Canal ocupado del ${g.canalPct.min} al ${g.canalPct.max} % y ${f(g.erroresPct, 1)} % de paquetes con error.`,
          `Antenas (últimos 100 sondeos): ${ant}.`,
          `Con eso calibro la curva de entrega por enlace «medida en campo» (cerca de la mitad de los paquetes pasa con SNR de −12 dB) y el perfil de tráfico «${g.medidoEn}». Pídame «prueba la hora pico con lo medido».`,
        ].join("\n"),
        acciones: [{ texto: "Probar la hora pico con lo medido", accion: "orden", orden: { tipo: "estres", opciones: { perfil: "medido", pagosPersonaDia: ESTRES_MEDIDO.pagosPersonaDia, horaPicoPct: ESTRES_MEDIDO.horaPicoPct } } }],
      };
    },
  },
  {
    id: "usuarios-prueba",
    claves: ["contorno", "colores de las personas", "persona por persona", "usuario por usuario", "le funciona", "a medias", "con dificultades", "capacidad real", "capacidad maxima real"],
    responder: () => ({
      texto: [
        "En la prueba de estrés evalúo a cada persona: para cada enlace de su ruta (ida y vuelta) la probabilidad de que el paquete pase con su margen, por lo que se perdió en cada nodo de su ruta (choques, mientras transmitía o por cola llena), con los reintentos del protocolo; lo ajusto con lo que completó su zona y con sus propios mensajes simulados.",
        `En el mapa el contorno de cada persona toma el color de su estado, con la paleta de los rangos de señal: ${ORDEN_ESTADOS_USUARIO.map((e) => `${ESTADOS_USUARIO[e].nombre.toLowerCase()} (${ESTADOS_USUARIO[e].descripcion.charAt(0).toLowerCase()}${ESTADOS_USUARIO[e].descripcion.slice(1, -1)})`).join("; ")}.`,
        "Y le digo por qué: sin cobertura, más saltos que el límite, señal débil, canal ocupado, choques, cola llena en un nodo, la fila del gateway o espera larga. Con «¿hasta dónde aguanta cada repetidor?» sale la capacidad real: el máximo de personas atendidas (a las que les funciona) al subir la carga.",
      ].join("\n"),
      acciones: [{ texto: "¿A quiénes no les funciona?", accion: "orden", orden: { tipo: "usuarios-estres", opciones: {} } }],
    }),
  },
  {
    id: "optimizar-carga",
    claves: ["gateway de apoyo", "gateways de apoyo", "getway de apoyo", "optimizar la carga", "red sobrecargada", "sobrecarga", "red estresada", "boton de optimizacion"],
    responder: () => ({
      texto: [
        "Con «Optimizar» (en el resultado de la prueba de estrés, o pidiéndomelo) miro a quién no le funciona y por qué, y pruebo arreglos con la misma carga, paquete por paquete:",
        "• Gateways de apoyo: convertir el repetidor de una zona cargada en gateway (con internet), un segundo gateway cerca de la gente que más sufre, o uno en otra frecuencia que se lleva a la gente de esa zona (dos canales que no se estorban).",
        "• Antenas de apoyo para la gente sin cobertura o con señal débil (busco la cadena con el relieve real).",
        "• Ajustes del protocolo: un ajuste de radio más rápido, en Meshtastic los equipos en CLIENT_MUTE y sin telemetría a la malla, y atender en paralelo en el gateway.",
        "Cada propuesta trae el antes y el después (personas atendidas, mensajes completos, canal) y la que combina las que suman; las aplico al mapa con un botón y se pueden deshacer.",
      ].join("\n"),
      acciones: [{ texto: "Optimizar la red para esta carga", accion: "orden", orden: { tipo: "optimizar", opciones: {} } }],
    }),
  },
  {
    id: "pitch",
    claves: ["pitch", "presentacion", "modelo de negocio", "punto de equilibrio", "capex", "opex", "inversion y operacion", "se paga sola", "comision por pago"],
    responder: () => ({
      texto: [
        "En el pitch recorro el mapa con mi robot y presento el modelo de negocio con la red que tenga puesta:",
        "• El problema (adultos rurales sin canal digital en el departamento y en el país) y la solución de Trama.",
        "• Cada antena: dónde está, a qué altura va y por qué (su enlace, la línea de vista, el área que cubre y la gente que entra por ella).",
        "• La cobertura con el relieve real y la capacidad real, persona por persona.",
        "• La inversión (CAPEX), la operación al mes (OPEX), el costo por usuario y el punto de equilibrio: la comisión por pago que cubre la red; puede probar la suya y le digo en cuántos meses se recupera.",
        "• Cómo escala al departamento y al país.",
        "Se maneja con las flechas, el espacio y Esc, o diciéndome «siguiente», «pausa», «ve a la inversión» o «termina la presentación». Con la IA conectada lo narro con mi voz de IA y respondo preguntas en medio.",
      ].join("\n"),
      acciones: [{ texto: "Empezar el pitch", accion: "pitch" }],
    }),
  },
  {
    id: "ia-voz",
    claves: ["gemini", "gemini live", "inteligencia artificial de verdad", "chatgpt", "chat gpt", "como chatgpt", "como chat gpt", "gpt live", "gpt-live", "vapi", "whisper", "conectar la ia", "conectarte a una ia", "clave de api", "ai studio", "modelo de voz", "hablar como una ia"],
    responder: () => ({
      texto: [
        "Puedo conversar como un modelo de inteligencia artificial con Gemini Live de Google: oigo su voz directamente (el audio, no un texto), le contesto con voz natural y hago en el simulador lo que me pida, sin inventar cifras (las tomo del simulador).",
        "Es gratis con una clave de Google AI Studio (capa gratuita, con límites por día). La pega una vez en Ajustes → «Conversar con IA» y queda solo en este navegador. Mientras conversamos, su voz y un resumen del escenario van a Google; en la capa gratuita Google puede usarlos para mejorar sus productos.",
        "Otras opciones: GPT-Live-1 de OpenAI (la voz de ChatGPT) cuesta unos US$0,05 por minuto y no tiene capa gratuita; Vapi cobra US$0,05 por minuto más cada servicio; Whisper solo pasa la voz a texto (ya lo uso en el dictado privado). Sin clave o sin internet sigo con mi cerebro local.",
      ].join("\n"),
      acciones: [{ texto: "Abrir los ajustes de la IA", accion: "ajustes-ia" }],
    }),
  },
  {
    id: "roles",
    claves: ["rol", "roles", "repeater", "companion", "room server", "router", "client", "cliente", "silencioso", "no retransmite"],
    responder: (c) => ({
      texto:
        presetPorId(c.parametros.preset).protocolo === "meshtastic"
          ? "En Meshtastic los roles que importan aquí son ROUTER (siempre repite y no cancela: los repetidores de la red), CLIENT (el de fábrica: repite lo que oye, pero si oye que otro ya lo repitió, cancela el suyo) y CLIENT_MUTE (no repite nunca). Con mucha gente, dejar las personas en CLIENT_MUTE evita que cada mensaje se repita decenas de veces."
          : "MeshCore tiene tres roles: Repetidor (pasa los paquetes de los demás; son los P1 de Trama en sus tubos), Companion (la billetera de la persona o la radio del gateway por USB: envía y recibe lo suyo y no retransmite) y Room server (guarda los mensajes de un grupo; por defecto no retransmite). Solo los repetidores sirven de puente: si una persona queda entre dos repetidores, no ayuda a pasar los mensajes de otros.",
    }),
  },
  {
    id: "factibilidad",
    claves: ["factible", "factibilidad", "viable", "viabilidad", "funciona", "sirve la red", "criterios", "puntaje", "veredicto", "funcionalidad"],
    responder: resumenRed,
  },
  {
    id: "estado",
    claves: ["como esta", "como va", "como quedo", "resumen", "resultado", "resultados", "estado de la red", "diagnostico", "cobertura total"],
    responder: resumenRed,
  },
  {
    id: "respaldo",
    claves: ["respaldo", "redundancia", "redundante", "dos antenas", "falla", "punto unico", "critica", "critico"],
    responder: (c) => {
      const r = c.resultado;
      const base = "Hay respaldo donde dos o más antenas dan servicio confiable: si una se apaga, la otra cubre. El modo «Respaldo» del mapa muestra cuántas antenas llegan a cada punto. También marco como críticas las antenas intermedias que, si fallan, dejan a otras sin pasarela.";
      if (!r) return { texto: base };
      const criticas = r.nodos.filter((n) => n.critico).map((n) => c.antenas.find((a) => a.id === n.id)?.nombre ?? n.id);
      return { texto: `${base} Ahora ${f(r.porcentajeRespaldo, 0)} % del área tiene respaldo${criticas.length ? ` y son críticas: ${criticas.join(", ")}` : " y no hay antenas críticas"}.` };
    },
  },
  {
    id: "modos",
    claves: ["mejor antena", "modo", "servidor", "quien cubre", "que antena cubre"],
    responder: () => ({
      texto: "Arriba del mapa hay tres modos de color: Señal (nivel de la mejor antena), Mejor antena (qué antena atiende cada punto) y Respaldo (cuántas antenas dan servicio). La leyenda cambia con el modo.",
    }),
  },
  {
    id: "medir",
    claves: ["medir", "punto", "inspeccionar", "señal en", "senal en", "aqui llega", "llega senal", "consultar punto", "mi finca", "mi casa"],
    responder: () => ({
      texto: "Active la herramienta «Medir señal» y haga clic en cualquier punto del mapa: le muestro el margen desde cada antena, la distancia y si hay línea de vista. Desde ahí puede abrir el perfil del trayecto.",
      acciones: [{ texto: "Activar Medir señal", accion: "inspeccionar" }],
    }),
  },
  {
    id: "perfil",
    claves: ["perfil", "fresnel", "linea de vista", "obstaculo", "obstruccion", "cerro", "montana", "loma"],
    responder: () => ({
      texto:
        "El perfil dibuja el terreno entre dos puntos con la curvatura de la Tierra (k = 4/3), la línea de vista y la primera zona de Fresnel. Si el 60 % de Fresnel queda libre hay línea de vista plena; si un cerro la corta, marco el obstáculo principal y sumo su pérdida por difracción. Ábralo desde la ficha de una antena, desde la lista de enlaces o al medir un punto.",
    }),
  },
  {
    id: "modelo",
    claves: ["modelo", "calibracion", "calibrado", "precision", "exacto", "confiable el modelo", "error", "radio mobile", "difraccion", "deygout", "itm", "longley"],
    responder: () => ({
      texto:
        "Hay dos modelos. El calibrado (recomendado) suma la pérdida en espacio libre, la difracción del obstáculo principal del perfil (filo de cuchillo, Deygout) sobre tierra 4/3 y una pérdida adicional ajustada con las simulaciones de Radio Mobile del proyecto; en los enlaces de prueba se desvía unos 3 dB de Radio Mobile. El otro es Longley-Rice (ITM 1.2.2), el mismo modelo de Radio Mobile, calculado con el perfil completo de cada trayecto; lo validé contra la implementación de referencia de la NTIA (diferencias menores a 0,001 dB). Si cambia clima, polarización, suelo, refractividad o confiabilidad, el modelo calibrado se corrige con lo que Longley-Rice predice para ese cambio. Es una herramienta de planeación: confirme en campo antes de instalar (un ping o un trace de MeshCore entre los dos equipos, y el SNR que reporta la app).",
    }),
  },
  {
    id: "relieve",
    claves: ["relieve", "terreno", "elevacion", "srtm", "hgt", "dem", "3d", "topografia", "plano", "sin conexion", "offline"],
    responder: (c) => ({
      texto: `Tengo tres fuentes de relieve: En línea (teselas SRTM abiertas, se descarga solo la zona simulada), Archivos SRTM (.hgt de su equipo, los mismos que usa Radio Mobile, sin descargar nada) y Plano (sin relieve). Ahora uso ${c.relieve === "teselas" ? "la fuente en línea" : c.relieve === "hgt" ? "archivos SRTM locales" : "terreno plano"}. En Capas puede activar el relieve 3D para ver el terreno inclinado.`,
      acciones: [{ texto: "Ir a parámetros", accion: "parametros" }],
    }),
  },
  {
    id: "privacidad",
    claves: ["privacidad", "datos", "se envia", "seguro", "google", "nube", "confidencial", "donde se guarda"],
    responder: () => ({
      texto:
        "Sus antenas y escenarios se quedan en este navegador (almacenamiento local) y en los archivos que usted exporte. El mapa base y el relieve en línea solo piden imágenes de la zona que se ve; no envían coordenadas de antenas ni resultados. Si prefiere no descargar nada, use relieve Plano o sus archivos .hgt.",
    }),
  },
  {
    id: "capas",
    claves: ["capas", "mapa base", "satelite", "topografico", "calles", "opacidad", "transparencia", "nombres"],
    responder: () => ({
      texto: "En el botón Capas elige el mapa base (satélite, satélite con nombres, topográfico o calles), la opacidad de la cobertura, el relieve 3D, los enlaces, las parejas sin enlace, las zonas sin servicio y el círculo de estudio de cada antena.",
    }),
  },
  {
    id: "exportar",
    claves: ["guardar", "exportar", "importar", "abrir", "kmz", "kml", "google earth", "csv", "excel", "json", "descargar", "compartir"],
    responder: () => ({
      texto:
        "El escenario se guarda solo en este navegador. En Archivo puede guardarlo como .json para compartirlo o retomarlo, exportar las antenas a Excel (.csv) y llevar la cobertura a Google Earth (.kmz) con la capa de señal, las antenas, los enlaces y la leyenda, como en los informes de Radio Mobile.",
      acciones: [{ texto: "Exportar KMZ", accion: "kmz" }],
    }),
  },
  {
    id: "receptor",
    claves: ["receptor", "radio portatil", "handheld", "vehiculo", "perdida extra", "cuerpo"],
    responder: (c) => ({
      texto: `El receptor representa la billetera de la persona en campo (XIAO o T1000-E). Ahora está a ${f(c.parametros.alturaRxM)} m, con ${f(c.parametros.gananciaRxDbi)} dBi y ${f(c.parametros.perdidaExtraDb, 0)} dB de pérdida extra. Si el equipo va dentro de un vehículo o pegado al cuerpo, sume entre 5 y 15 dB de pérdida extra. Para follaje o edificios elija el entorno de la zona (por ejemplo «simula con vegetación densa»).`,
      acciones: [{ texto: "Ir a parámetros", accion: "parametros" }],
    }),
  },
  {
    id: "confiabilidad",
    claves: ["confiabilidad", "porcentaje de tiempo", "situaciones", "ubicaciones", "variabilidad", "modo movil", "modo estadistico", "estadistica", "spot", "accidental", "broadcast", "difusion", "90 %"],
    responder: (c) => ({
      texto: `La confiabilidad dice qué tan seguido se cumple la señal calculada, como en Radio Mobile. Ahora uso el modo ${c.parametros.variabilidad} con ${f(c.parametros.tiempoPct, 0)} % del tiempo y ${f(c.parametros.situacionesPct, 0)} % de las situaciones${esReferencia(c.parametros) ? ", los mismos valores de las pruebas de Radio Mobile" : ""}. Con «confiabilidad alta» (90 %) la señal se exige más y el mapa se achica: es el escenario prudente para telemetría o alarmas. Pídamelo así: «confiabilidad del 90 %» o «95 % del tiempo».`,
      acciones: [{ texto: "Ir a parámetros", accion: "parametros" }],
    }),
  },
  {
    id: "red-radio-mobile",
    claves: ["clima", "polarizacion", "horizontal", "vertical", "suelo", "conductividad", "permitividad", "refractividad", "parametros de red", "parametros de radio mobile", "ecuatorial", "propagacion"],
    responder: (c) => ({
      texto: `Los parámetros de red son los mismos de Radio Mobile. Ahora: ${resumenParametros(c.parametros)}. Colombia es clima ecuatorial; las antenas de 8 dBi de Trama son verticales (polarización vertical); el suelo promedio (εr 15, σ 0,005 S/m) sirve para la llanura, el húmedo para zonas encharcadas y agua dulce para ríos o ciénagas. Puedo cambiarlos, por ejemplo «clima continental templado», «polarización horizontal», «suelo húmedo», o volver a los de referencia con «restablece los parámetros de Radio Mobile».`,
      acciones: [{ texto: "Ir a parámetros", accion: "parametros" }],
    }),
  },
  {
    id: "direccionales",
    claves: ["yagi", "sectorial", "panel", "parabolica", "direccional", "direccionales", "omnidireccional", "omni", "azimut", "apuntar", "orientar", "inclinacion", "patron de radiacion", "haz", "tilt"],
    responder: (c) => {
      const dir = c.antenas.filter(esDireccional);
      return {
        texto: `Además de la omnidireccional, puede usar ${PATRONES.filter((p) => p.id !== "omni")
          .map((p) => `${p.nombre.toLowerCase()} (≈ ${f(p.gananciaTipica, 0)} dBi)`)
          .join(", ")}. Concentran la señal en una dirección: llegan más lejos al frente y casi nada atrás. Elija el tipo en la ficha del nodo, el azimut (0° = norte) y la elevación del haz (negativa = hacia abajo); en el mapa se dibuja hacia dónde apunta. Pídamelo así: «ponle una Yagi a Ejemplo apuntando a Torre 2» o «apunta Ejemplo al noreste».${
          dir.length ? ` Ahora hay ${dir.length === 1 ? "una direccional" : `${dir.length} direccionales`}: ${dir.map((a) => `${a.nombre} (${patronPorId(a.patron).nombre.toLowerCase()} a ${Math.round(a.azimutDeg ?? 0)}°, haz de ${Math.round(anchosHaz(a.patron, a.gananciaDbi).h)}°)`).join("; ")}.` : ""
        }`,
      };
    },
  },
  {
    id: "entorno",
    claves: ["entorno", "vegetacion", "follaje", "bosque", "selva", "plantacion", "palma", "arboles", "cultivos", "ciudad", "pueblo", "edificios", "urbano", "clutter"],
    responder: (c) => {
      const e = entornoPorId(c.parametros.entorno);
      return {
        texto: `El entorno agrega la pérdida de la vegetación o de los edificios a los equipos que quedan por debajo de ellos (UIT-R P.833 para follaje y P.2108 para construcciones y bosque). Ahora: ${e.nombre.toLowerCase()}${e.metodo === "ninguno" ? ", sin pérdidas adicionales" : `, ≈ ${f(perdidaEntorno(e.id, c.parametros.alturaRxM, c.parametros.frecuenciaMhz))} dB para el receptor a ${f(c.parametros.alturaRxM)} m`}. Opciones: ${ENTORNOS.map((x) => x.nombre.toLowerCase()).join(", ")}. Si la antena está por encima de los árboles o techos, no pierde nada. Pídamelo así: «simula con vegetación densa» o «la zona es una plantación de palma».`,
        acciones: [{ texto: "Ir a parámetros", accion: "parametros" }],
      };
    },
  },
  {
    id: "unidades",
    claves: ["dbm", "microvoltios", "uv", "dbuv", "campo electrico", "intensidad de campo", "unidades", "unidad", "arcoiris", "umbral", "escala de colores"],
    responder: (c) => {
      const s = presetPorId(c.parametros.preset).sensibilidadDbm;
      return {
        texto: `Puedo mostrar la señal como margen (dB sobre la sensibilidad), potencia recibida (dBm), tensión en el receptor (µV, sobre 50 Ω) o intensidad de campo (dBµV/m), como en Radio Mobile. Con ${presetPorId(c.parametros.preset).nombre} la sensibilidad es ${f(s)} dBm: 20 dB de margen son ${f(s + 20)} dBm. Los colores pueden ser las clases de Radio Mobile, un arcoíris entre dos niveles o un solo umbral. Pídamelo así: «muestra la señal en dBm», «en microvoltios», «colores arcoíris de -120 a -70 dBm» o «umbral de -105 dBm».`,
      };
    },
  },
  {
    id: "informe",
    claves: ["informe", "radioenlace", "radio enlace", "radio link", "reporte del enlace", "pire", "eirp", "angulo de elevacion", "azimut del enlace", "balance del enlace"],
    responder: () => ({
      texto:
        "El informe de radioenlace es como «Radio Link» de Radio Mobile: distancia, azimut de ida y vuelta, ángulo de elevación, peor despeje de Fresnel, potencia, PIRE, ganancias con el patrón de cada antena, pérdidas desglosadas (espacio libre, obstrucción, estadística, ajuste de red y entorno), la predicción de Longley-Rice y el nivel recibido en dBm, µV y dBµV/m con su margen. Ábralo con el botón Informe del perfil, desde la ficha de un nodo («Radioenlace») o pidiéndomelo: «informe del enlace Ejemplo y Torre 2». Se puede copiar o descargar en texto.",
    }),
  },
  {
    id: "dictado",
    claves: ["dictar", "dictado", "microfono", "voz a texto", "hablarte", "hablarle", "por voz", "audio", "reconocimiento de voz", "me escuchas", "escucharme", "leer en voz alta", "voz de melki"],
    responder: () => ({
      texto:
        "Toque el micrófono junto al botón de enviar y hable: lo que dice aparece en la caja de texto, lo revisa o corrige, y lo envía cuando quiera (nunca se envía solo). Toque el micrófono otra vez para terminar. En Ajustes de voz (el ícono junto al parlante) elige el modo: «Con el navegador», más preciso pero el audio lo procesa Edge o Chrome por internet, o «Privado, sin internet», donde el audio no sale de su equipo (la primera vez puede descargar unos 100 MB). Con el parlante yo leo mis respuestas en voz alta. Y si quiere hablarme sin tocar nada, active el «Asistente Melki»: le escucho todo el tiempo y me activo cuando dice «Hola Melki».",
      acciones: [{ texto: "Activar el Asistente Melki", accion: "manos-libres" }],
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
    responder: () => ({
      texto: [
        `${CREDITO} ${DERECHOS}`,
        `• ${TITULARIDAD}`,
        "• Usarlo, copiarlo, modificarlo o distribuirlo sin licencia escrita de los titulares está prohibido: los programas de computador se protegen como obras literarias (Decisión Andina 351 de 1993 y Ley 23 de 1982), y el Código Penal castiga la violación del derecho de autor sobre el soporte lógico (artículos 270 a 272).",
        "• Que el código se vea en un repositorio no da permiso de usarlo. El aviso completo está en «Archivo → Acerca del simulador y licencia».",
        "• El software, como tal, no se patenta en la Comunidad Andina (Decisión 486 de 2000, art. 15): se protege por derecho de autor desde que se crea, y se puede inscribir en el Registro Nacional del Derecho de Autor (Dirección Nacional de Derecho de Autor) como prueba de la autoría y la titularidad.",
      ].join("\n"),
      acciones: [{ texto: "Ver la licencia", accion: "acerca" }],
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
    responder: () => ({
      texto: [
        "Con el «Asistente Melki» le escucho todo el tiempo, como un asistente de voz: diga «Hola Melki», «Oye Melki», «Hey Melki» o «Hello Melki» y su pedido, de corrido (también le entiendo si el micrófono escribe «Melky» o «Melqui»); lo hago, le contesto en voz alta, con el trato de un mayordomo, y me quedo atento unos segundos para que siga sin repetir mi nombre. Si solo dice «Hola Melki», le respondo «Hola, mi señor. Le escucho; estoy atento y presto a seguir sus órdenes».",
        "• Entiendo lo mismo que por escrito: varias órdenes seguidas, números dichos en palabras («doscientas cincuenta personas») y coordenadas («cuatro punto dos, menos setenta y tres punto tres siete»).",
        "• Para conversar: «para» (o «Melki, para» mientras hablo), «repite», «más detalle», «sí, hazlo» o «la segunda» para usar mis botones, «deshaz», «pantalla limpia» y «deja de escuchar».",
        "• Se activa con el botón «Asistente Melki» de la barra de arriba, con el ícono de ondas de esta conversación o diciéndome por escrito «activa el asistente». Al activarme oculto el panel de herramientas y el de resultados para dejarle el mapa libre; cuando un resultado se vea mejor en un panel, le pregunto si se lo muestro, y vuelven al apagarme. Arriba del mapa ve lo que le entiendo, lo que le digo y mis sugerencias.",
        "• En reposo, como Siri o el Asistente de Google: con el micrófono permitido me quedo escuchando solo mi nombre aunque la barra esté cerrada; diga «Hey Melki», «Hola Melki» o «Hello Melki» y me activo sin tocar ningún botón. «Deja de escuchar» me devuelve al reposo y «apaga el micrófono» me apaga del todo.",
        "• Mi barra se arrastra a cualquier parte del mapa (doble clic la devuelve a su sitio), se achica sola mientras espero mi nombre y crece cuando me hablan; también puede dejarla siempre pequeña.",
        "• Con parlantes no me respondo a mí mismo: lo que oigo de mi propia voz, mientras hablo o justo después, no lo tomo como pedido, y no repito la misma respuesta ni me disculpo dos veces seguidas por mi eco. Cada frase la tomo una sola vez, aunque el navegador la mande repetida. Si el navegador deja de escuchar tras un silencio, vuelvo a escuchar solo, sin prender y apagar el micrófono; las barritas de mi orbe siguen su voz.",
        "• En Ajustes de voz elige cómo le hablo (señor, señora o sin tratamiento), la voz (la más natural que tenga su equipo; en Edge hay voces neuronales como Salomé de Colombia), si le escucho siempre en reposo y si me activo solo al abrir el simulador, con el micrófono permitido.",
        "• Si me pide algo que se sale del simulador, se lo digo con respeto y retomamos la red; y si me pide «una red sostenible y viable en Barranca de Upía de 11.226 hectáreas», la diseño y le cuento su viabilidad técnica y su costo con los precios de Trama.",
        "• Entiendo los municipios aunque el dictado los escriba mal al hablar rápido («barranca de UPA meta», «barranco vía meta» → Barranca de Upía, Meta): comparo cómo suenan y uso el departamento que se dice o el que se ve en el mapa. Si dudo entre varios, le pregunto «¿se refiere a…?» («sí», «la segunda» o el nombre); si no le entiendo, le pido con gusto que me lo repita.",
        "• Recuerdo el lugar del que hablamos: «ubícame en Barranca de Upía, Meta» y luego «ármame una red que cubra todo el municipio», «la zona norte del municipio», «3.000 hectáreas ahí» o «lo que estoy viendo»; y con «puntos de popularidad… hasta dónde aguanta antes de quebrarse», después del diseño pongo la gente y hago la prueba de estrés subiendo la carga.",
        "• Sin mi nombre no hago nada, por si alguien habla cerca. Funciona mejor en Edge o Chrome, con un micrófono cerca o audífonos; en Ajustes de voz elige si el audio lo procesa el navegador o se queda en su equipo.",
      ].join("\n"),
      acciones: [
        { texto: "Activar el Asistente Melki", accion: "manos-libres" },
        { texto: "Tour «Melki por voz»", accion: "recorrido", tour: "voz" },
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
    responder: (c) => coberturaMaxima(c),
  },
  {
    id: "rendimiento",
    claves: ["lento", "demora", "tarda", "resolucion", "radio de estudio", "rapido", "rendimiento", "celda", "celdas"],
    responder: (c) => ({
      texto: `El cálculo recorre el perfil del terreno desde cada antena hasta cada celda. Con un radio de ${f(c.parametros.radioKm, 0)} km y resolución ${c.parametros.resolucion}, las celdas miden unos ${Math.round((c.parametros.radioKm * 1000) / ({ rapida: 90, normal: 160, fina: 260 } as const)[c.parametros.resolucion])} m. Use Rápida mientras ajusta y Fina para el informe final. El cálculo corre en segundo plano, así que puede seguir usando la pantalla.`,
    }),
  },
  {
    id: "mejorar",
    claves: ["mejorar", "recomendacion", "recomendaciones", "que hago", "sugerencia", "sugerencias", "optimizar", "aumentar cobertura", "mas cobertura", "como arreglo"],
    responder: (c) => {
      const malla = resumenMalla(c);
      if (malla) return malla;
      const r = c.resultado;
      if (!r) return { texto: "Simule primero y le doy recomendaciones concretas para este escenario.", acciones: [{ texto: "Simular ahora", accion: "simular" }] };
      const recs = r.factibilidad.recomendaciones.slice(0, 3);
      const ajuste = c.desactualizado ? null : accionAjuste(r);
      const texto = recs.length ? `Esto es lo que haría: ${recs.map((x, i) => `${i + 1}) ${x}`).join(" ")}` : "La red cumple los criterios. Valide en campo con una prueba de alcance.";
      return {
        texto: `${texto} ${r.factibilidad.nivel === "factible" ? "Si quiere, busco la misma cobertura con menos infraestructura." : "O pídame «ajústamelo»: comparo alturas, lomas cercanas, tipo de antena y antenas de apoyo, y le propongo la red factible con la mejor relación cobertura–costo."}`,
        acciones: ajuste ? [ajuste] : undefined,
      };
    },
  },
  {
    id: "ajuste",
    claves: ["ajustamelo", "ajuste automatico", "ajustar automaticamente", "costo beneficio", "economico", "mas barato", "antenas de apoyo", "antena de apoyo", "cobertura costo", "menos antenas", "torre de 30", "mas de 30 metros", "optimizar el costo"],
    responder: (c) => {
      const ajuste = c.desactualizado ? null : accionAjuste(c.resultado);
      return {
        texto: [
          "Con «Ajústamelo automáticamente» (en el Resultado, o pidiéndomelo) analizo la red como un planeador: busco que todos los nodos lleguen al gateway por enlaces sólidos y cubrir la meta con la menor infraestructura posible.",
          "Comparo, con el relieve real: correr un nodo a una loma cercana (lo más barato), subir o bajar torres en tramos de 3 m hasta 30 m, cambiar a una antena sectorial hacia donde falta cobertura y sugerir repetidores de apoyo. Para comparar uso los precios del documento de Trama: un repetidor P1 en su tubo de 6 m con instalación y tres años de operación, la torre arriostrada de 12 m del gateway y, para otras alturas, valores extrapolados de esos dos.",
          "Los repetidores de apoyo son puntos sugeridos, con coordenadas, donde conviene poner uno. Si usted me da sitios posibles («pueden ir en 4.51, -73.12; 4.60, -73.05»), solo uso esos. Las personas pobladas al azar no entran en el ajuste.",
          "Le doy hasta tres opciones: la más económica que cumple, la recomendada (donde cada repetidor más ya rinde poco) y la de máxima cobertura.",
        ].join("\n"),
        acciones: ajuste ? [ajuste] : undefined,
      };
    },
  },
  {
    id: "area-objetivo",
    claves: ["area objetivo", "cobertura util", "senal util", "meta de cobertura", "60 %", "60 por ciento", "zona de la red", "area de estudio"],
    responder: (c) => {
      const o = c.resultado?.areaObjetivo;
      return {
        texto: [
          "La red es factible cuando todos los nodos llegan al gateway por enlaces sólidos (≥ 30 dB) dentro del límite de saltos y la cobertura útil —señal media o mejor, ≥ 30 dB— alcanza la meta.",
          "Sin área objetivo, la meta es el 60 % del área de estudio (los círculos alrededor de los nodos antena). Si mide un área con la regla y me dice «usa el área que medí como área objetivo con el 95 %», la factibilidad se mide ahí, con esa meta y esa señal.",
          o ? `Ahora el área objetivo es «${o.nombre}»: ${f(o.utilPct, 1)} % cubierto de una meta del ${f(o.metaPct, 1)} %.` : "Ahora no hay área objetivo.",
        ].join("\n"),
      };
    },
  },
  {
    id: "equipos",
    claves: ["equipo", "equipos", "sensecap", "p1", "solar node", "heltec", "t114", "xiao", "t1000", "wio", "fibra de vidrio", "rf explorer", "hardware", "nodo solar"],
    responder: () => ({
      texto: `Los equipos son los del catálogo de Trama, puestos en Colombia (TRM ${COTIZADOR.trm.toLocaleString("es-CO")} con envío, arancel e IVA): el repetidor es un SenseCAP Solar Node P1 (panel de 5 W, nRF52840 + SX1262, MeshCore oficial; ${pesos(precioDe("p1"))} más 4 pilas 18650 por ${pesos(precioDe("pilas18650"))}) con antena RF Explorer de 8 dBi de fibra de vidrio (${pesos(precioDe("antena8"))}) y cable CFD400 de 3 m (${pesos(precioDe("coax"))}): ≈ ${pesos(PRECIOS.repetidor)} instalado en su tubo. Cada radio del gateway es un Heltec Mesh Node T114 (${pesos(precioDe("t114"))}) con la misma antena. La billetera económica es el kit XIAO ESP32S3 + Wio-SX1262 con batería y carcasa (≈ ${pesos(PRECIOS.nodo.xiao)}); la tarjeta T1000-E, sellada y con GPS, cuesta ≈ ${pesos(PRECIOS.nodo.t1000)}. En la ficha de cada nodo elige el equipo y lleno potencia (22 dBm), ganancia y pérdida del cable; si cambia un valor a mano, pasa a Personalizado.`,
    }),
  },
  {
    id: "trama",
    claves: ["trama", "red de pagos", "pagos por radio", "whatsapp", "mensajeria", "inteligencia artificial", "consultas a la ia", "que trafica", "trafico de la red", "que pasa por la red", "red de comunicacion", "sembrar", "sembrar la malla", "siembra", "sembrado", "modo sembrar", "como siembro", "como armo la red", "armar la red", "planear la red", "como hago la red", "el problema", "territorios sin conectividad"],
    responder: () => ({
      texto:
        "Trama es una red de comunicación por radio para llevar la conexión a donde normalmente no llega: por ella van pagos, mensajes de WhatsApp por texto y consultas a la inteligencia artificial. La persona usa su billetera (un radio pequeño enlazado al celular por Bluetooth): firma un pago, escribe un WhatsApp o le pregunta a la IA; el mensaje salta por repetidores solares MeshCore hasta un gateway con Starlink, que verifica el pago con el banco, pasa el WhatsApp a internet o le lleva la consulta a la IA, y la respuesta vuelve por la misma ruta; quien recibe un pago recibe un aviso. «Sembrar la malla» es el modo sencillo para planearla: 1) el Gateway + Internet, en el sitio donde entra el internet (torre de 12 m con mini PC y 4 radios); 2) los repetidores, en tubos de 6 m o en lo alto de las lomas, cada uno al alcance del gateway o de otro conectado; 3) la gente, con su billetera a 1,5 m. Yo calculo con el relieve real quién queda conectado (verde), quién no (rojo) y cuántos saltos hay, propongo dónde poner repetidores, pueblo la zona con personas y pruebo cuánto tráfico aguanta.",
      acciones: [
        { texto: "Cargar el ejemplo de malla", accion: "orden", orden: { tipo: "ejemplo-malla" } },
        { texto: "Tour «Sembrar la malla»", accion: "recorrido", tour: "sembrar" },
        { texto: "Tour «¿Cuánto tráfico aguanta?»", accion: "recorrido", tour: "capacidad" },
      ],
    }),
  },
  {
    id: "animacion",
    claves: ["animacion", "animaciones", "parpadea", "parpadean", "brilla", "brillan", "destella", "destellan", "lineas que se mueven", "puntos que se mueven", "flujo", "turquesa", "nube", "nube ia", "ia del gateway", "inteligencia artificial"],
    responder: (c) => ({
      texto: `La animación muestra cómo trabaja la malla. Las líneas turquesa avanzan por las rutas hacia el gateway: es por donde viajan los pagos, los WhatsApp y las consultas a la IA. Cada pulso sale de una persona y lo pasan los repetidores (casi siempre el más cercano con buen enlace), que destellan al retransmitir; al llegar, la nube «IA» del gateway se enciende. Las piezas conectadas laten en verde; las que están sin cobertura parpadean en rojo y los repetidores sin red, en naranja. Con «Enviar un mensaje de prueba» se ve además quién oye cada transmisión (se abre una onda y destellan los vecinos), aunque solo el repetidor siguiente de la ruta la pasa; luego la respuesta vuelve por la misma ruta.${c.modo === "sembrar" ? " Se apaga con el interruptor «Animar el flujo de la información» o diciéndome «quita la animación»." : " Se ve en el modo «Sembrar la malla»."}`,
      acciones: c.red?.alDia && c.red.conectadas.length ? [{ texto: "Enviar un mensaje de prueba", accion: "orden", orden: { tipo: "mensaje" } }] : undefined,
    }),
  },
  {
    id: "repetidor",
    claves: ["repetidor", "repetidores", "donde pongo el repetidor", "donde pongo", "distancia entre repetidores", "cada cuanto", "cada cuantos km", "torre del repetidor", "lomas"],
    responder: (c) => {
      const red = c.red;
      const ahora = red?.repetidores.length
        ? ` Ahora hay ${red.repetidores.length} ${red.repetidores.length === 1 ? "repetidor" : "repetidores"}${red.alDia && red.aislados.length ? ` y ${red.aislados.length === 1 ? "uno no alcanza" : `${red.aislados.length} no alcanzan`} la red (${red.aislados.map((a) => a.nombre).join(", ")})` : ""}.`
        : "";
      const radios = (Object.keys(TERRENOS_TRAMA) as (keyof typeof TERRENOS_TRAMA)[]).map((k) => `${TERRENOS_TRAMA[k].nombre.toLowerCase()} ${TERRENOS_TRAMA[k].radioKm} km`).join(", ");
      return {
        texto: `El repetidor de Trama es un SenseCAP Solar Node P1 con antena de 8 dBi en un tubo de 6 m (≈ ${pesos(PRECIOS.repetidor)}), con rol Repetidor: es el único que pasa los pagos y mensajes de los demás. Para que sirva debe alcanzar al gateway o a otro repetidor conectado; si no, queda en naranja. El documento supone este alcance por repetidor con SF11: ${radios} (con SF10 baja a ~80 % y con SF9 a ~65 %); aquí el relieve real lo confirma o lo corrige. Póngalos en lo alto y mire si quedan en verde; o pídame «conecta a los que faltan» y busco las lomas por usted.${ahora}`,
        acciones: red?.alDia && red.sinCobertura.length ? [{ texto: "Conectar a los que faltan", accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } }] : undefined,
      };
    },
  },
  {
    id: "persona",
    claves: ["persona", "personas", "gente", "usuario", "radio de mano", "billetera", "billeteras", "aplicacion", "app", "bluetooth", "familias", "que lleva cada persona", "lo que lleva cada persona", "celular"],
    responder: (c) => {
      const red = c.red;
      const ahora = red?.personas.length && red.alDia ? ` Ahora: ${red.conectadas.length} de ${red.personas.length} conectadas${red.sinCobertura.length ? `, ${red.sinCobertura.length} sin cobertura` : ""}.` : "";
      return {
        texto: `Cada persona lleva su billetera: el kit XIAO ESP32S3 + Wio-SX1262 con batería y carcasa (≈ ${pesos(PRECIOS.nodo.xiao)}) o la tarjeta SenseCAP T1000-E, sellada y con GPS (≈ ${pesos(PRECIOS.nodo.t1000)}), enlazada por Bluetooth a la aplicación del celular. Ahí firma sus pagos, escribe por WhatsApp o le consulta a la IA, y lo manda por radio, sin señal celular; es companion: no retransmite los mensajes de otros. Inscribirla cuesta ${pesos(OPERACION_TRAMA.inscripcionUsuario)}. En el mapa la pongo a 1,5 m con antena de 2 dBi. Verde = llega al gateway (el número es cuántos saltos); rojo = no alcanza ningún repetidor; ámbar = llega con más saltos que el límite. Con «Poblar personas» reparto cientos al azar.${ahora}`,
        acciones: [{ texto: "Poblar 250 personas", accion: "orden", orden: { tipo: "poblar", pedido: { n: 250 } } }],
      };
    },
  },
  {
    id: "mensaje",
    claves: ["como viaja", "como viaja un pago", "como viaja un mensaje", "como viaja un whatsapp", "como viaja una consulta", "viaja el pago", "viaja el mensaje", "pago", "pagos", "comprobante", "acuse", "ack", "mensaje", "mensajes", "inundacion", "flooding", "tiempo en el aire", "airtime", "cuanto tarda", "cuanto demora", "latencia", "retransmision", "colision", "colisiones", "llega el mensaje", "reintentos"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      const t = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${f(ms / 1000)} s`);
      const orden = tiempoEnAireMs(bytesDatos(CAPACIDAD_TRAMA.ordenBytes, 1), p);
      const espera = esperaRetransmision(orden, "directa");
      const red = c.red;
      return {
        texto: `Así viaja un pago en MeshCore: la persona firma la orden (${CAPACIDAD_TRAMA.ordenBytes} B) y la transmite; la primera vez se inunda por los repetidores y el gateway le devuelve la ruta, y desde ahí va directo: cada repetidor de la ruta espera un turno al azar (de 0 a ${t(espera.max)}) y la pasa al siguiente. Antes de hablar, cada radio escucha el canal y, si está ocupado, espera. Se confirma con un acuse; si no vuelve, reintenta ${INTENTOS - 1} veces por la ruta y la última por inundación. El gateway verifica el pago con el banco por Starlink, devuelve el comprobante (${CAPACIDAD_TRAMA.comprobanteBytes} B) y quien recibe el pago recibe un aviso. Con ${p.nombre}, la orden ocupa ${t(orden)} en el aire por salto y el pago completo a 2 saltos ≈ ${t(airePagoMs(p))}. Un WhatsApp o una consulta a la IA viajan igual: suben al gateway, salen por Starlink y la respuesta vuelve por la misma ruta (una respuesta larga ocupa más aire). Si dos radios transmiten a la vez donde alguien escucha, chocan: por eso la capacidad de una frecuencia tiene techo.${red?.alDia && red.conectadas.length ? " Pídame «envía un pago desde» una persona y lo verá viajar en el mapa, o «envía 15 pagos al tiempo»." : ""}`,
        acciones: red?.alDia && red.conectadas.length ? [{ texto: "Enviar un mensaje de prueba", accion: "orden", orden: { tipo: "mensaje" } }] : undefined,
      };
    },
  },
  {
    id: "capacidad",
    claves: ["capacidad", "cuantos pagos", "cuantos mensajes", "cuanto trafico", "trafico", "pagos al tiempo", "mensajes al tiempo", "al mismo tiempo", "a la vez", "se revienta", "reventar", "saturacion", "saturar", "satura", "prueba de carga", "carga", "usuarios por frecuencia", "usuarios por sitio", "aguanta", "soporta"],
    responder: (c) => {
      const p = presetPorId(c.parametros.preset);
      const sf = (p.anchoBandaKhz === 250 && p.sf >= 9 && p.sf <= 11 ? p.sf : 11) as SfTrama;
      const ref = SF_TRAMA[sf];
      return {
        texto: `Trama dimensiona cada frecuencia para que el canal no pase del ${CAPACIDAD_TRAMA.canalPicoPct} % en la hora pico: con SF11 un pago ocupa ~9,5 s de aire y caben ~55 por hora (150 usuarios); con SF10, ~105 (280 usuarios); con SF9, ~185 (500 usuarios). Esa capacidad la comparten los pagos, los WhatsApp y las consultas a la IA. Un sitio tiene 4 frecuencias, así que atiende ${SF_TRAMA[11].usuariosFrecuencia * CAPACIDAD_TRAMA.radiosPorSitio} usuarios con SF11. La hora pico se lleva el ${CAPACIDAD_TRAMA.horaPicoNormalPct} % de los mensajes del día (el ${CAPACIDAD_TRAMA.horaPicoMercadoPct} % el día de mercado). Con ${p.nombre} la referencia es ~${ref.pagosHora} pagos por hora por frecuencia. Para verlo con su red: «Poblar personas» y luego «Prueba de carga» en Resultados (5, 15, 25… pagos o mensajes al tiempo) o «¿Hasta cuántos aguanta?», que sube la cantidad hasta que menos del 90 % recibe su respuesta (y le marca desde cuándo la espera pasa de un minuto). En una ráfaga, más de 5 a 10 mensajes en 10 s con SF11 ya hacen fila un minuto. Para la hora pico repetidor por repetidor, use las zonas de popularidad y la «Prueba de estrés».`,
        acciones: [
          { texto: "15 pagos al tiempo", accion: "orden", orden: { tipo: "carga", opciones: { mensajes: 15 }, curva: false } },
          { texto: "¿Hasta cuántos aguanta?", accion: "orden", orden: { tipo: "carga", opciones: {}, curva: true } },
          { texto: "Tour de capacidad", accion: "recorrido", tour: "capacidad" },
        ],
      };
    },
  },
  {
    id: "estres",
    claves: ["zona de popularidad", "zonas de popularidad", "popularidad", "punto de popularidad", "limite de un punto", "limite del repetidor", "limite de cada punto", "llenar hasta el limite", "cuantas personas soporta", "estabilidad de la red", "prueba de estres", "estres", "estresar", "colapso", "colapsa", "colapsar", "colapsada", "ancho de banda", "hora pico", "dia de mercado", "cuantos usuarios aguanta", "cuantas personas aguanta", "cada repetidor", "consumo por usuario", "cuanto consume", "ciclo de trabajo", "energia del repetidor", "alcance con carga", "hasta donde aguanta"],
    responder: () => ({
      texto: `Las zonas de popularidad ponen gente alrededor de un repetidor o del gateway (o de cada uno): por ejemplo 250 personas a 2 km. Se ponen tocando el repetidor (en su tarjeta o en la lista hay «Zona de popularidad»), en Resultados o pidiéndomelo: «por cada antena 250 personas». Ahí escribe la cantidad que quiera y tiene «Poner y probar» (pone la gente y simula la hora pico con todos enviando información), «¿Cuántas aguanta?» (sube solo la gente de ese punto, con el resto de la red como está, hasta encontrar cuántas aguanta sin demora, desde cuántas va lento, desde cuántas se revienta y qué falla primero) y «Llenar hasta el límite», que lo llena y lo confirma. También: «¿cuántas personas aguanta el Repetidor 1?», «llena el gateway hasta su límite» o «el límite de cada punto». La «Prueba de estrés» hace que todas usen la red a su ritmo en la hora pico: ${f(PAGOS_PERSONA_DIA_TRAMA, 1)} mensajes por persona al día entre pagos, WhatsApp y consultas a la IA (el ritmo que supone Trama: 55 por hora con 150 usuarios; si la gente escribe o consulta más, se sube) y el ${CAPACIDAD_TRAMA.horaPicoNormalPct} % en esa hora (${CAPACIDAD_TRAMA.horaPicoMercadoPct} % un día de mercado). Simulo el canal paquete por paquete y mido en cada gateway y repetidor: las personas que entran por él, los mensajes que completan, la espera, qué tanto del canal oye ocupado, cuánto transmite (el tope es el ${TOPE_CICLO_PCT} %), los paquetes que pierde, hasta dónde completa con esa carga frente a su alcance sin carga, y la energía del repetidor solar (${f(ENERGIA_P1.txW, 2)} W al transmitir; el panel de 5 W repone ~${f(ENERGIA_P1.panelW * ENERGIA_P1.horasSol * ENERGIA_P1.eficiencia, 0)} Wh al día). Cada persona gasta unos segundos de aire en la hora pico (~0,1 % del canal con SF11); así 150 personas son el 15 % que diseña Trama. «¿Hasta dónde aguanta cada repetidor?» sube la carga hasta que cada zona se revienta y le dice cuántas personas aguanta; con «comparar ajustes» ve la misma hora pico con más ancho de banda o menos SF (más capacidad, menos alcance).`,
      acciones: [
        { texto: "250 personas en cada repetidor", accion: "orden", orden: { tipo: "zonas", pedido: { n: 250 }, estres: { rampa: true } } },
        { texto: "¿Cuántas aguanta cada punto?", accion: "orden", orden: { tipo: "limite", llenar: false, opciones: {} } },
        { texto: "Probar la hora pico", accion: "orden", orden: { tipo: "estres", opciones: {} } },
        { texto: "¿Hasta dónde aguanta cada repetidor?", accion: "orden", orden: { tipo: "estres", opciones: { rampa: true } } },
      ],
    }),
  },
  {
    id: "poblar",
    claves: ["poblar", "poblar personas", "popular personas", "poblacion", "repartir personas", "personas al azar", "densidad", "disperso", "dispersa", "denso", "densa", "usuarios por km2"],
    responder: () => ({
      texto: `«Poblar personas» (en Resultados, o pidiéndomelo) reparte billeteras al azar, uniformes sobre el terreno, en el área objetivo, en otra área de la regla, alrededor de la red (3 km de cada repetidor) o en toda el área de estudio. Puede dar la cantidad («puebla con 250 personas») o la densidad del documento de Trama: ${CAPACIDAD_TRAMA.densidades.map((d) => `${f(d.valor, d.valor < 1 ? 1 : 0)} usuarios por km² ${d.nombre}`).join(", ")}. Con «solo donde hay señal» las pongo donde la última simulación da servicio. Volver a poblar reparte de nuevo; «quita las pobladas» las borra sin tocar las que puso a mano. En el mapa son puntos pequeños y no entran en el ajuste automático.`,
      acciones: [{ texto: "Poblar 250 personas", accion: "orden", orden: { tipo: "poblar", pedido: { n: 250 } } }],
    }),
  },
  {
    id: "precios",
    claves: ["precio", "precios", "cuanto cuesta un repetidor", "cuanto cuesta el gateway", "cuanto vale", "cuanto cuesta", "catalogo", "cotizacion", "cotizador", "trm", "presupuesto de equipos", "inversion"],
    responder: () => ({
      texto: `Precios del documento de Trama, puestos en Colombia (TRM ${COTIZADOR.trm.toLocaleString("es-CO")} con ${COTIZADOR.colchonPct} % de colchón; lo importado suma ${COTIZADOR.envioPct} % de envío, ${COTIZADOR.arancelPct} % de arancel y ${COTIZADOR.ivaImportPct} % de IVA): repetidor completo en su tubo de 6 m ≈ ${pesos(PRECIOS.repetidor)}; sitio gateway con torre de 12 m, mini PC, hub, UPS, tierra, kit solar y 4 radios ≈ ${pesos(PRECIOS.sitioBase + 4 * PRECIOS.radio)}; Starlink con su kit solar ≈ ${pesos(PRECIOS.starlink)} más ${pesos(PRECIOS.starlinkMes)} al mes (plan comercial ${pesos(OPERACION_TRAMA.starlinkMesComercial)}); enlace WiFi punto a punto ≈ ${pesos(PRECIOS.enlace)}; billetera XIAO ≈ ${pesos(PRECIOS.nodo.xiao)} o T1000-E ≈ ${pesos(PRECIOS.nodo.t1000)}. Instalar un sitio cuesta ${pesos(OPERACION_TRAMA.instalacionSitio)}, un repetidor ${pesos(OPERACION_TRAMA.instalacionRepetidor)} e inscribir a una persona ${pesos(OPERACION_TRAMA.inscripcionUsuario)}; mantener un sitio, ${pesos(OPERACION_TRAMA.mantenimientoSitioMes)} al mes. Pregúnteme «¿cuánto cuesta la red para el Meta?» y lo dimensiono.`,
    }),
  },
  {
    id: "dimensionamiento",
    claves: ["dimensionar", "dimensionamiento", "por departamento", "cuanto cuesta la red", "cobertura y escala", "escala", "vision de conjunto", "todo el pais", "cuantos sitios", "cuantos starlink", "adopcion", "adultos sin canal"],
    responder: () => {
      const top = DEPARTAMENTOS_TRAMA.slice(0, 5).map((d) => d.nombre).join(", ");
      return {
        texto: `Dimensiono como el documento de Trama: cada repetidor cubre un hexágono (2,598 × r², con r según el terreno y el SF), hace falta una radio cada 150 usuarios con SF11, un sitio reúne hasta 4 radios y 19 celdas, y cada Starlink alimenta 4 sitios en plano o sabana, 2 en montaña y 1 en ríos o selva; manda la cobertura o la capacidad, la que pida más. Por departamento uso los adultos rurales sin canal digital (DANE) con una adopción del 30 % y la parte habitada del territorio. Los que más gente sin canal tienen: ${top}. Pregúnteme «¿cuánto cuesta la red para el Chocó?», «¿y con 50 % de adopción y SF10?», «¿para todo el país?» o «dimensiona 5.000 usuarios en 800 km² de sabana».`,
        acciones: [{ texto: "La red para el Chocó", accion: "orden", orden: { tipo: "trama-departamento", id: "choco", adopcionPct: 30, sf: 11, nodo: "xiao" } }],
      };
    },
  },
  {
    id: "letra-pequena",
    claves: ["letra pequena", "supuestos", "limitaciones", "advertencias", "riesgos", "que tan confiables", "son exactos los numeros", "estimaciones"],
    responder: () => ({
      texto: "La letra pequeña: las cifras de Trama son estimaciones de planeación. La capacidad (9,5 s por pago con SF11, el canal al 15 % en la hora pico) se debe medir en una red piloto; el alcance por terreno es un supuesto que aquí se corrige con el relieve real; los precios son de referencia (TRM del día, envío, arancel e IVA) y cambian con el proveedor; los datos de los departamentos son del DANE y pueden diferir de otras fuentes. En el simulador, el modelo de propagación se desvía unos 3 dB de Radio Mobile en los enlaces de prueba, la prueba de carga supone un aviso de 126 B y 1,5 s del banco y mide cada mensaje con el tamaño de un pago (un WhatsApp largo o una respuesta larga de la IA ocupan más aire), y el ancho de banda de 250 kHz se dedujo de los tiempos del documento (conviene confirmarlo con el Inge, igual que la banda: aquí vale de 915 a 928 MHz).",
    }),
  },
  {
    id: "sin-cobertura",
    claves: ["sin cobertura", "por que esta en rojo", "esta en rojo", "estan en rojo", "no se conecta", "no se conectan", "no alcanza", "desconectada", "desconectado", "aislado", "aislada", "por que no llega", "no llegan"],
    responder: (c) => {
      const red = c.red;
      const r = c.resultado;
      if (!red?.alDia || !r) return { texto: "Una persona queda en rojo cuando ningún nodo de la red le llega con al menos 20 dB, y un repetidor queda en naranja cuando no alcanza al gateway ni a otro repetidor conectado. Las causas: la distancia, una loma en medio, árboles o poca altura. Simule y le digo cuál es el caso." };
      const nombres = new Map(c.antenas.map((a) => [a.id, a.nombre]));
      const detalle = [...red.sinCobertura, ...red.aislados].slice(0, 4).map((a) => {
        const mejor = r.enlaces.filter((e) => e.a === a.id || e.b === a.id).sort((x, y) => y.margen - x.margen)[0];
        return mejor ? `${a.nombre}: su mejor enlace es con ${nombres.get(mejor.a === a.id ? mejor.b : mejor.a)} (${f(mejor.margen)} dB a ${f(mejor.distanciaKm)} km; se necesitan 20 dB)` : `${a.nombre}: no tiene ningún nodo cerca`;
      });
      if (!detalle.length) return { texto: "Ahora no hay nadie sin cobertura: todas las piezas llegan al gateway. 🙂" };
      return {
        texto: `${detalle.join("; ")}. Para arreglarlo: ponga un repetidor en una loma entre los dos, suba el repetidor más cercano o acérquelo. También puedo proponerlo yo con el relieve real.`,
        acciones: red.sinCobertura.length ? [{ texto: "Conectar a los que faltan", accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } }] : undefined,
      };
    },
  },
  {
    id: "recorrido",
    claves: ["recorrido", "tour", "tours", "guia", "guiame", "muestrame", "ensename", "tutorial", "ayuda", "paso a paso", "aprender"],
    responder: () => menuTours(),
  },
  {
    id: "gracias",
    claves: ["gracias", "muchas gracias", "listo", "perfecto", "excelente", "genial"],
    responder: () => ({ texto: "Con gusto. Aquí sigo si necesita algo más." }),
  },
];

/** Recomendaciones para dejar la mayor cobertura posible, con lo que hay ahora en el escenario. */
function coberturaMaxima(c: ContextoMelki): Respuesta {
  const r = c.resultado;
  const red = c.red;
  const p = presetPorId(c.parametros.preset);
  let ahora = "";
  if (c.modo === "sembrar" && red?.alDia && red.personas.length) ahora = ` Ahora llegan al gateway ${red.conectadas.length} de ${red.personas.length} personas${red.aislados.length ? ` y ${red.aislados.length === 1 ? "un repetidor no alcanza" : `${red.aislados.length} repetidores no alcanzan`} la red` : ""}.`;
  else if (r && !c.desactualizado) ahora = ` Ahora: ${textoCoberturaUtil(r)}.`;
  const texto = [
    `Para la mayor cobertura posible, lo que más rinde es la altura del sitio: un repetidor en una loma suele cubrir más que una torre más alta en el plano.${ahora} Después, que cada repetidor quede enlazado con un margen sólido y bien repartido, y luego la antena y la radio.`,
    "• Lo alto primero: ponga el gateway y los repetidores en lomas o puntos despejados, por encima de los árboles y los techos; si un equipo queda debajo de la vegetación, pierde mucha señal.",
    "• Línea de vista: entre dos nodos no debe haber lomas en medio; mire el perfil del enlace y que la zona de Fresnel quede despejada. Si una loma tapa, un repetidor encima de ella resuelve dos enlaces.",
    "• Repartir la malla: cada repetidor al alcance del gateway o de otro conectado (mínimo 30 dB para un enlace sólido), sin amontonarlos, y con dos caminos donde se pueda («con respaldo»), para que un equipo caído no deje gente sin red.",
    "• El gateway al centro de la zona: así hay menos saltos y nadie pasa el límite; con zonas muy lejanas, un segundo gateway rinde más que muchos saltos.",
    `• Radio y antena: un SF más alto llega más lejos (SF11 más que SF10 o SF9) a cambio de menos capacidad; ahora usa ${p.nombre}. La antena de 8 dBi omnidireccional cubre alrededor; una sectorial o una Yagi llevan la señal más lejos hacia donde falta, y casi nada hacia atrás.`,
    "• La gente: la billetera va a 1,5 m; en campo, subirla un poco o salir de debajo de los árboles mejora mucho la señal.",
    "Yo lo hago por usted: «ajústamelo para la mayor cobertura posible» compara lomas cercanas, alturas hasta 30 m, antenas sectoriales y repetidores de apoyo, y le da la opción de máxima cobertura con su costo; «conecta a los que faltan» siembra repetidores donde hay gente sin señal; y «cubre 5 km a la redonda con respaldo» diseña una malla nueva.",
  ].join("\n");
  const acciones: AccionRespuesta[] = [];
  if (r && !c.desactualizado) acciones.push({ texto: "Proponer la máxima cobertura", accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "maxima", opciones: {}, avisos: [] } });
  if (c.modo === "sembrar" && red?.alDia && red.sinCobertura.length) acciones.push({ texto: "Conectar a los que faltan", accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } });
  if (!r && c.antenas.length) acciones.push({ texto: "Simular ahora", accion: "simular" });
  if (!c.antenas.length) acciones.push({ texto: "Cargar el ejemplo de malla", accion: "orden", orden: { tipo: "ejemplo-malla" } });
  return { texto, acciones: acciones.length ? acciones : undefined };
}

/* ───────────── Tours guiados ───────────── */

const opcionTour = (id: IdTour, recomendado = false): AccionRespuesta => {
  const x = TOURS.find((q) => q.id === id)!;
  return { texto: `${x.nombre}${recomendado ? " (recomendado)" : ""} · ${x.minutos} min`, detalle: x.detalle, accion: "recorrido", tour: id };
};

/** Melki pregunta qué tour quiere hacer; el tutorial básico va primero. */
export function menuTours(): Respuesta {
  return {
    texto:
      "¿Qué tour quiere hacer? En los prácticos usted hace cada paso en la pantalla (o me dice «Hágalo por mí»), puede omitir pasos o salir cuando quiera, y su escenario queda tal cual.",
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

/** Si la frase pide un tour, responde con ese tour (o con el menú si no dice cuál). */
export function pedidoDeTour(pregunta: string): Respuesta | null {
  const t = ` ${normalizar(pregunta)} `;
  if (!PIDE_TOUR.test(t)) return null;
  const tema = TEMA_TOUR.find(([, re]) => re.test(t))?.[0] ?? (/\btutorial\b/.test(t) ? "basico" : null);
  if (!tema) return menuTours();
  const x = TOURS.find((q) => q.id === tema)!;
  return {
    texto: `Con gusto: «${x.nombre}» (${x.minutos} min). ${x.detalle}${x.practica ? " Lo hacemos en un escenario de práctica; el suyo queda tal cual." : ""}`,
    acciones: [
      { texto: `Empezar «${x.nombre}»`, accion: "recorrido", tour: x.id },
      { texto: "Ver todos los tours", accion: "tours" },
    ],
  };
}

/** Respuesta sobre una antena nombrada en la pregunta (alcance, ruta, área). */
function sobreAntena(t: string, c: ContextoMelki): Respuesta | null {
  const antena = [...c.antenas].sort((a, b) => b.nombre.length - a.nombre.length).find((a) => a.nombre.length > 2 && t.includes(normalizar(a.nombre)));
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
        texto: `${antena.nombre} no llega ${destino}${mejor && otro ? `: su mejor enlace es con ${otro} (${f(mejor.margen)} dB a ${f(mejor.distanciaKm)} km; se necesitan 20 dB)` : ""}. Acérquelo, súbalo o ponga un repetidor en una loma entre los dos.`,
        acciones: c.modo === "sembrar" ? [{ texto: `Conectar a ${antena.nombre}`, accion: "orden", orden: { tipo: "sembrar", destino: { id: antena.id } } }] : undefined,
      };
    }
    return { texto: `${antena.nombre} llega ${destino} en ${n.saltos} ${n.saltos === 1 ? "salto" : "saltos"} (${n.ruta.map((id) => nombres.get(id)).join(" → ")})${n.cuelloDb !== null ? `, con ${f(n.cuelloDb)} dB en su enlace más débil` : ""}${n.saltos > c.parametros.limiteSaltos ? `; pasa el límite de ${c.parametros.limiteSaltos} saltos` : ""}.` };
  }
  if (!r || !s) {
    return { texto: `${antena.nombre} está a ${f(antena.alturaM)} m con ${f(antena.gananciaDbi)} dBi. ${antena.activa ? "Simule para conocer su alcance." : "Está excluida de la simulación."}`, acciones: antena.activa ? [{ texto: "Simular ahora", accion: "simular" }] : undefined };
  }
  let texto = `${antena.nombre}: terreno a ${s.elevacionM} m, alcance con servicio ${s.alcanceLimitado ? "de al menos " : ""}${f(s.alcanceKm, 2)} km y ${f(s.areaServicioKm2)} km² servidos; da la mejor señal en ${f(s.porcentajeMejorServidor, 0)} % del área.`;
  if (antena.pasarela) texto += " Es pasarela.";
  else if (!n || n.saltos === null) texto += " No tiene ruta hacia la pasarela.";
  else texto += ` Llega a la pasarela en ${n.saltos} ${n.saltos === 1 ? "salto" : "saltos"} (${n.ruta.map((id) => nombres.get(id)).join(" → ")})${n.cuelloDb !== null ? `, con ${f(n.cuelloDb)} dB en su enlace más débil` : ""}.`;
  return { texto };
}

export function responder(pregunta: string, c: ContextoMelki): Respuesta {
  const t = ` ${normalizar(pregunta)} `;
  if (!t.trim()) return { texto: "Escríbame su pregunta." };
  const tour = pedidoDeTour(pregunta);
  if (tour) return tour;
  const limpio = t.trim().replace(/[.!?]+$/g, "").trim();
  if (CHARLA.test(limpio)) {
    const s = tratoDe(c);
    return { texto: `Muy bien${s ? `, ${s}` : ""}, gracias por preguntar. Estoy listo y a sus órdenes: ¿qué construimos hoy en el simulador? Por ejemplo, ${EJEMPLOS_RETOMAR}.` };
  }
  if (ME_ESCUCHAS.test(limpio)) {
    const s = tratoDe(c);
    return { texto: `Sí${s ? `, ${s}` : ""}, le escucho perfectamente. ¿Qué hacemos? Por ejemplo, ${EJEMPLOS_RETOMAR}.` };
  }
  if (ELOGIO.test(limpio)) {
    const s = tratoDe(c);
    return { texto: `Muchas gracias${s ? `, ${s}` : ""}; es un gusto ayudarle. ¿Qué más hacemos?` };
  }
  if (DONDE_ESTAMOS.test(t) && !/\b(nodo|antena|gateway|repetidor\w*|persona|torre)\b/.test(t))
    return c.vista
      ? { texto: `Estamos viendo ${c.vista}. ¿Le armo una red sostenible que cubra todo el municipio?`, acciones: [{ texto: "Sí, la red de todo el municipio", accion: "orden", orden: { tipo: "red-municipio", sostenible: true } }] }
      : { texto: "El centro del mapa está fuera de Colombia o los límites aún no cargan. Dígame un municipio y lo llevo: «ubícame en Barranca de Upía, Meta»." };
  // Fuera del simulador (aunque alguna palabra coincida con un tema, como «¿cómo está el clima?»)
  if (FUERA_DE_TEMA.test(t) && !SOBRE_IA_VOZ.test(t) && !/\b(red|malla|nodo|antena|gateway|repetidor\w*|cobertura|senal|simul\w*|trama|meshcore|lora|pagos?|radio mobile|itm|longley|propagacion|enlace)\b/.test(t)) return respuestaFueraDeTema(c);
  const especifica = sobreAntena(t, c);
  const palabras = new Set(t.trim().split(" "));
  let mejor: { tema: Tema; puntos: number } | null = null;
  const saludoLargo = palabras.size > 4;
  for (const tema of TEMAS) {
    // En frases largas el saludo no compite: importa lo que se pide después del «hola»
    if (tema.id === "saludo" && saludoLargo) continue;
    let puntos = 0;
    for (const clave of tema.claves) {
      const k = normalizar(clave);
      if (k.includes(" ")) {
        if (t.includes(` ${k} `) || t.includes(` ${k}`)) puntos += 2 + k.split(" ").length;
      } else if (palabras.has(k)) puntos += 2;
      else if (k.length >= 5 && [...palabras].some((p) => p.length >= 5 && (p.startsWith(k.slice(0, 5)) || k.startsWith(p.slice(0, 5))))) puntos += 1;
    }
    if (puntos > (mejor?.puntos ?? 0)) mejor = { tema, puntos };
  }
  if (especifica && (!mejor || ["saludo", "gracias", "malla", "altura"].includes(mejor.tema.id) || /alcance|ruta|llega|cubre|salto|area|como esta/.test(t))) return especifica;
  // Un pedido de acción que no se entendió no se responde con un tema tomado al azar
  if (!especifica && (!mejor || mejor.puntos < 4)) {
    // Un pedido que no es del simulador («hazme el café»): con respeto, y retoma el trabajo
    if (PIDE_ACCION.test(t) && !DEL_SIMULADOR.test(t)) return respuestaFueraDeTema(c);
    const ne = noEntendiOrden(pregunta);
    if (ne) return c.porVoz ? { ...ne, texto: `Discúlpeme${tratoDe(c) ? `, ${tratoDe(c)}` : ""}, no le entendí bien: ${ne.texto.charAt(0).toLowerCase()}${ne.texto.slice(1)}` } : ne;
  }
  if (mejor && mejor.puntos >= 2) return mejor.tema.responder(c);
  if (/\b(hola|buenas|buenos dias|saludos)\b/.test(t)) {
    const r = TEMAS.find((x) => x.id === "capacidades")!.responder(c);
    return { ...r, texto: `¡Hola! ${r.texto}` };
  }
  // Por voz, lo que no tiene ni pregunta ni pedido claro casi siempre es el dictado que escribió mal: se pide repetir
  const pregunta_ = /^\s*¿|\?\s*$/.test(pregunta) || /^ (que|quien|quienes|como|cual|cuales|cuando|donde|por que|cuanto|cuanta|cuantos|cuantas)\b/.test(t);
  if (c.porVoz && !pregunta_ && !FUERA_DE_TEMA.test(t)) return respuestaNoEntendi(c, pregunta);
  // Nada del simulador en lo que pidió: se lo dice con cortesía y retoma el trabajo
  if (!DEL_SIMULADOR.test(t)) return respuestaFueraDeTema(c);
  if (c.porVoz) return respuestaNoEntendi(c, pregunta);
  return {
    texto:
      "No estoy seguro de haber entendido. Puedo sembrar la red (gateway, repetidores y gente), poblar la zona y probar cuántos pagos, WhatsApp y consultas a la IA aguanta, dimensionar la red de un departamento, medir distancias, llevarlo a un municipio, explicar los colores, los enlaces y los saltos, o decirle por qué un nodo no llega al gateway. Pruebe: «¿qué puedes hacer?».",
    acciones: [{ texto: "Hacer el recorrido", accion: "recorrido" }],
  };
}

/** ¿El mensaje pide hacer algo (aunque no se haya podido convertir en una orden)? */
const PIDE_ACCION =
  /\b(armame|arma|armar|disename|disena|disenar|creame|crea|crear|hazme|haz|ponme|pon|poner|cubreme|cubre|cubrir|agrega\w*|anade|mueve|borra|elimina|quita|sube|baja|cambia|configura|instala|necesito que|quiero que|me ayudas a|ayudame a)\b/;

/** Respuesta cuando el mensaje parece una orden que no se pudo interpretar: en vez de un tema al azar, ejemplos útiles. */
export function noEntendiOrden(pregunta: string): Respuesta | null {
  const t = ` ${normalizar(pregunta)} `;
  if (!PIDE_ACCION.test(t)) return null;
  return {
    texto: [
      "Entendí que quiere que haga algo en el simulador, pero no logré convertirlo en una orden. Estas sí las hago de una:",
      "• «ármame una malla que cubra 11.226 hectáreas con señal media o mejor en el 99,9 %»",
      "• «pon el gateway en Cumaral» o «agrega un repetidor a 8 km al norte del gateway»",
      "• «sube todos los repetidores a 12 m», «borra todas las personas»",
      "• «puebla la zona con 250 personas», «envía 25 pagos al tiempo», «manda 15 mensajes de WhatsApp al tiempo», «¿hasta cuántos pagos aguanta?»",
      "• «¿cuánto cuesta la red para el Chocó?»",
      "• «muestra las vías», «llévame a Villavicencio», «simula»",
      "Dígamelo con una de esas formas, o pregúnteme «¿qué puedes hacer?».",
    ].join("\n"),
    acciones: [{ texto: "Ver los tours guiados", accion: "tours" }],
  };
}

export const SUGERENCIAS = ["Hazme un tour", "¿Qué hago ahora?", "¿Cómo viaja un mensaje?", "¿Cuántos pagos aguanta?"];
