// Cerebro local de Melki: temas con palabras clave y respuestas que usan el estado actual del simulador.
// No envía nada a internet. Más adelante se puede conectar a un modelo de IA (ver variables de entorno).
import { CLASES, presetPorId, PRESETS } from "@/lib/radio/constantes";
import { entornoPorId, ENTORNOS, perdidaEntorno } from "@/lib/radio/entorno";
import { anchosHaz, esDireccional, PATRONES, patronPorId } from "@/lib/radio/patron";
import { esReferencia, resumenRed as resumenParametros } from "@/lib/radio/red";
import type { Antena, Escenario, Parametros, ResultadoSimulacion } from "@/lib/radio/tipos";

import type { Orden } from "./ordenes";
import { TOURS, type IdTour } from "./tours";

/** «recorrido» empieza el tour indicado; «tours» muestra el menú de tours. */
export type AccionMelki = "recorrido" | "tours" | "simular" | "ejemplo" | "agregar" | "inspeccionar" | "parametros" | "resultados" | "kmz" | "regla" | "orden" | "deshacer";

/** Con «detalle», la acción se muestra como una opción de menú (título y una línea). */
export type AccionRespuesta = { texto: string; accion: AccionMelki; orden?: Orden; escenario?: Escenario; tour?: IdTour; detalle?: string };

export type Respuesta = { texto: string; acciones?: AccionRespuesta[] };

export type ContextoMelki = {
  antenas: Antena[];
  parametros: Parametros;
  resultado: ResultadoSimulacion | null;
  desactualizado: boolean;
  relieve: "teselas" | "hgt" | "plano";
};

const f = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

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

function resumenRed(c: ContextoMelki): Respuesta {
  const r = c.resultado;
  if (!r) {
    return c.antenas.length
      ? { texto: "Todavía no hay una simulación. Pulse Simular y le cuento cómo queda la red.", acciones: [{ texto: "Simular ahora", accion: "simular" }] }
      : { texto: "Aún no hay antenas en el escenario. Puede ubicarlas en el mapa o cargar el ejemplo para ver cómo funciona.", acciones: [{ texto: "Cargar el ejemplo", accion: "ejemplo" }, { texto: "Agregar antena", accion: "agregar" }] };
  }
  const fac = r.factibilidad;
  const fallan = fac.criterios.filter((k) => !k.ok).map((k) => k.nombre.charAt(0).toLowerCase() + k.nombre.slice(1));
  let texto = `Resultado: ${fac.titulo.toLowerCase()} (${fac.puntaje}/100). ${f(r.porcentajeServicio, 0)} % del área tiene servicio y ${f(r.porcentajeConfiable, 0)} % es confiable.`;
  if (fallan.length) texto += ` Falta cumplir: ${fallan.join("; ")}.`;
  if (fac.recomendaciones[0]) texto += ` Mi primera sugerencia: ${fac.recomendaciones[0]}`;
  if (c.desactualizado) texto += " Ojo: cambió algo después de simular; conviene simular de nuevo.";
  return { texto, acciones: [{ texto: "Ver resultados", accion: "resultados" }] };
}

const TEMAS: Tema[] = [
  {
    id: "saludo",
    claves: ["hola", "buenos dias", "buenas tardes", "buenas noches", "buenas", "hey", "saludos", "que tal"],
    responder: () => ({
      texto: "¡Hola! Soy Melki. Inscribo nodos antena en la coordenada que me diga, simulo su alcance, mido distancias y le explico la cobertura y la factibilidad de la red. Pídamelo con sus palabras o le muestro el simulador paso a paso.",
      acciones: [{ texto: "Ver los tours guiados", accion: "tours" }],
    }),
  },
  {
    id: "quien",
    claves: ["quien eres", "como te llamas", "que eres", "melki"],
    responder: () => ({
      texto: "Soy Melki, el asistente del simulador. Funciono aquí mismo, sin enviar sus datos a ningún servidor. Conozco el modelo de propagación, la red Meshtastic y cada parte de la pantalla.",
    }),
  },
  {
    id: "que-es",
    claves: ["para que sirve", "que hace", "que es esto", "simulador", "como funciona", "como se usa", "como empiezo", "empezar"],
    responder: () => ({
      texto:
        "El simulador estima la cobertura de nodos antena Meshtastic (LoRa 915 MHz) sobre el relieve real. Usted ubica nodos por coordenadas, en el mapa o pidiéndomelo; ajusta altura, potencia y ganancia, y al simular ve el nivel de señal con los colores de Radio Mobile, el rango de alcance de cada nodo antena, los enlaces de la malla, los saltos hasta la pasarela y un veredicto de factibilidad con recomendaciones. La regla mide distancias y áreas como en Google Earth.",
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
      texto:
        "Puedo hacer cosas en el simulador si me lo pide con sus palabras. Por ejemplo: «inscribe un nodo antena en 4°30'44\" N 73°07'24\" O a 20 m», «mueve Ejemplo a 4.25, -73.40», «sube Ejemplo a 25 m», «marca Torre 2 como pasarela», «elimina Nodo 1», «usa Long Moderate», «radio de 12 km», «distancia entre Ejemplo y Torre 2», «perfil de Ejemplo a Torre 2», «señal en 4.21, -73.35», «llévame a Villavicencio», «¿en qué municipio está Ejemplo?», «activa la regla», «simula» o «exporta a Google Earth». También manejo las funciones de Radio Mobile: «confiabilidad del 90 %», «clima continental templado», «polarización horizontal», «suelo húmedo», «usa Longley-Rice», «ponle una Yagi a Ejemplo apuntando a Torre 2», «inclina Ejemplo 3° hacia abajo», «simula con vegetación densa», «muestra la señal en dBm» o «en µV», «colores arcoíris de -120 a -70 dBm» e «informe del enlace Ejemplo y Torre 2». Si prefiere hablar, toque el micrófono y revise el texto antes de enviarlo. Todo lo que hago se puede deshacer. Y si quiere aprender paso a paso, pídame un tour guiado.",
      acciones: [{ texto: "Ver los tours guiados", accion: "tours" }],
    }),
  },
  {
    id: "nodos",
    claves: ["nodo", "nodos", "nodo antena", "tipo de nodo", "nodo de campo", "diferencia entre nodo y antena", "que es un nodo"],
    responder: () => ({
      texto:
        "En Meshtastic cada equipo de la red es un nodo. Aquí hay dos tipos: el nodo antena es infraestructura fija en mástil o torre (por defecto 10 m y antena de 5,8 dBi); genera la capa de cobertura y forma la malla. El nodo de campo es un radio portátil, sensor o rastreador (por defecto 1,5 m y 2 dBi); no pinta cobertura, pero reviso si se conecta a la red y en cuántos saltos llega a la pasarela.",
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
    responder: () => ({
      texto: `Los colores son el margen de señal sobre la sensibilidad del receptor, con la misma paleta de las simulaciones de Radio Mobile: ${CLASES.map((k) => `${k.nombre.toLowerCase()} ${k.id === "sin" ? "por debajo de 20 dB" : `desde ${k.minimoDb} dB`}`).join(", ")}. Verde oscuro tolera follaje y movimiento; naranja funciona a ratos; rojo no tiene servicio. En Capas → Escala de la señal puede cambiar a dBm, µV o dBµV/m y usar colores arcoíris entre dos niveles o un solo umbral, como en Radio Mobile.`,
    }),
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
    claves: ["preset", "long fast", "longfast", "medium", "short", "long slow", "moderate", "spreading", "sf", "ancho de banda", "velocidad", "modem"],
    responder: (c) => ({
      texto: `El preset fija el factor de dispersión y el ancho de banda. Más lento = más alcance. ${PRESETS.map((p) => `${p.nombre}: ${f(p.sensibilidadDbm)} dBm, ≈ ${f(p.velocidadKbps, 2)} kbps`).join("; ")}. Ahora usa ${presetPorId(c.parametros.preset).nombre}. Todos los nodos deben tener el mismo preset para hablar entre sí.`,
      acciones: [{ texto: "Ir a parámetros", accion: "parametros" }],
    }),
  },
  {
    id: "frecuencia",
    claves: ["frecuencia", "915", "928", "902", "ane", "banda", "legal", "regulacion", "resolucion 28", "espectro", "canal", "slot"],
    responder: (c) => ({
      texto: `En Colombia, la ANE (Resolución 000028 de 2026) reconoce el uso libre de 915 a 928 MHz. Configure el canal de Meshtastic dentro de esa banda; el canal por defecto de la región US (906,875 MHz) queda por fuera. La simulación usa ${f(c.parametros.frecuenciaMhz, 3)} MHz, y entre 915 y 928 MHz el cambio de alcance es mínimo.`,
    }),
  },
  {
    id: "altura",
    claves: ["altura", "mastil", "elevar", "subir antena", "mas alto", "torre", "metros de altura"],
    responder: () => ({
      texto:
        "La altura es lo que más mejora el alcance: despeja la zona de Fresnel sobre el follaje y el relieve. Pruebe subir la antena en pasos de 3 a 5 m y compare el porcentaje confiable. Un enlace entre dos mástiles altos suele ser mucho mejor que hacia un radio en la mano a 2,5 m.",
    }),
  },
  {
    id: "malla",
    claves: ["malla", "mesh", "enlace", "enlaces", "entre antenas", "retransmite", "retransmitir", "repetidor", "red mesh"],
    responder: (c) => {
      const r = c.resultado;
      const base =
        "En Meshtastic cada nodo retransmite lo que escucha, así un mensaje salta de antena en antena hasta la pasarela. Evalúo cada pareja de antenas: enlace sólido desde 30 dB, inestable entre 20 y 30 dB y sin enlace por debajo de 20 dB (tomando el peor de los dos sentidos).";
      if (!r) return { texto: base };
      const s = r.enlaces.filter((e) => e.clase === "solido").length;
      const i = r.enlaces.filter((e) => e.clase === "inestable").length;
      return { texto: `${base} En este escenario hay ${s} enlaces sólidos y ${i} inestables de ${r.enlaces.length} parejas.` };
    },
  },
  {
    id: "saltos",
    claves: ["saltos", "hop", "hop limit", "hop_limit", "limite de saltos", "brincos"],
    responder: (c) => ({
      texto: `El hop_limit es cuántas veces se puede retransmitir un mensaje; Meshtastic usa 3 por defecto y permite hasta 7. Aquí está en ${c.parametros.limiteSaltos}. Reviso que cada antena esté a esa cantidad de saltos o menos de una pasarela, para que un equipo en campo conectado a ella llegue al servidor. Subirlo da más alcance, pero aumenta el tráfico y las colisiones.`,
    }),
  },
  {
    id: "pasarela",
    claves: ["pasarela", "gateway", "internet", "mqtt", "servidor", "nodo principal"],
    responder: (c) => {
      const p = c.antenas.filter((a) => a.pasarela).map((a) => a.nombre);
      return {
        texto: `La pasarela es el nodo conectado a internet o al servidor (por ejemplo con MQTT). Todo mensaje del campo debe llegar a ella. ${p.length ? `Ahora son pasarela: ${p.join(", ")}.` : "No hay ninguna marcada: abra una antena y active «Pasarela»."} Con más de tres antenas conviene una segunda pasarela de respaldo.`,
      };
    },
  },
  {
    id: "roles",
    claves: ["rol", "roles", "router", "client", "cliente", "client mute", "silencioso", "no retransmite"],
    responder: () => ({
      texto:
        "Uso tres roles: Router y Cliente retransmiten mensajes de otros; Cliente silencioso (CLIENT_MUTE) recibe y envía lo suyo, pero no retransmite, así que no sirve de puente. Para antenas fijas en mástil, Router es lo habitual.",
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
        "Hay dos modelos. El calibrado (recomendado) suma la pérdida en espacio libre, la difracción del obstáculo principal del perfil (filo de cuchillo, Deygout) sobre tierra 4/3 y una pérdida adicional ajustada con las simulaciones de Radio Mobile del proyecto; en los enlaces de prueba se desvía unos 3 dB de Radio Mobile. El otro es Longley-Rice (ITM 1.2.2), el mismo modelo de Radio Mobile, calculado con el perfil completo de cada trayecto; lo validé contra la implementación de referencia de la NTIA (diferencias menores a 0,001 dB). Si cambia clima, polarización, suelo, refractividad o confiabilidad, el modelo calibrado se corrige con lo que Longley-Rice predice para ese cambio. Es una herramienta de planeación: confirme en campo con la prueba de alcance de Meshtastic antes de instalar.",
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
    claves: ["receptor", "radio portatil", "handheld", "celular", "vehiculo", "perdida extra", "cuerpo"],
    responder: (c) => ({
      texto: `El receptor representa el equipo en campo. Ahora está a ${f(c.parametros.alturaRxM)} m, con ${f(c.parametros.gananciaRxDbi)} dBi y ${f(c.parametros.perdidaExtraDb, 0)} dB de pérdida extra. Si el equipo va dentro de un vehículo o pegado al cuerpo, sume entre 5 y 15 dB de pérdida extra. Para follaje o edificios elija el entorno de la zona (por ejemplo «simula con vegetación densa»).`,
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
      texto: `Los parámetros de red son los mismos de Radio Mobile. Ahora: ${resumenParametros(c.parametros)}. Colombia es clima ecuatorial; Meshtastic usa antenas verticales (polarización vertical); el suelo promedio (εr 15, σ 0,005 S/m) sirve para la llanura, el húmedo para zonas encharcadas y agua dulce para ríos o ciénagas. Puedo cambiarlos, por ejemplo «clima continental templado», «polarización horizontal», «suelo húmedo», o volver a los de referencia con «restablece los parámetros de Radio Mobile».`,
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
        "Toque el micrófono junto al botón de enviar y hable: lo que dice aparece en la caja de texto, lo revisa o corrige, y lo envía cuando quiera (nunca se envía solo). Toque el micrófono otra vez para terminar. En Ajustes de voz (el ícono junto al parlante) elige el modo: «Con el navegador», más preciso pero el audio lo procesa Edge o Chrome por internet, o «Privado, sin internet», donde el audio no sale de su equipo (la primera vez puede descargar unos 100 MB). Con el parlante yo leo mis respuestas en voz alta.",
    }),
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
      const r = c.resultado;
      if (!r) return { texto: "Simule primero y le doy recomendaciones concretas para este escenario.", acciones: [{ texto: "Simular ahora", accion: "simular" }] };
      const recs = r.factibilidad.recomendaciones.slice(0, 3);
      return { texto: recs.length ? `Esto es lo que haría: ${recs.map((x, i) => `${i + 1}) ${x}`).join(" ")}` : "La red cumple los criterios. Valide en campo con una prueba de alcance." };
    },
  },
  {
    id: "equipos",
    claves: ["equipo", "equipos", "sensecap", "nodo solar", "fibra de vidrio", "antena de fibra", "heltec", "rak", "t-beam", "hardware"],
    responder: () => ({
      texto:
        "En la ficha de cada antena elige el equipo: nodo solar con antena de fibra de 5,8 dBi, nodo con antena de 3 dBi, radio portátil de 2 dBi o Personalizado. Al elegirlo lleno potencia, ganancia y pérdida del cable; si cambia un valor a mano, el equipo pasa a Personalizado.",
    }),
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
  ["basico", /\b(basico|basica|primera simulacion|principiante|desde cero|lo basico|empezar)\b/],
  ["pantalla", /\b(pantalla|partes|botones|interfaz|cada parte)\b/],
  ["radiomobile", /\b(radio ?mobile|propagacion|longley|confiabilidad|direccional|yagi|dbm|radioenlace|radio enlace|informe)\b/],
  ["medir", /\b(medir|mido|medicion|regla|exportar|kmz|google earth|distancias?|perfil)\b/],
  ["mesh", /\b(mesh|malla|red|saltos|pasarela|varios nodos)\b/],
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
  if (!r || !s) {
    return { texto: `${antena.nombre} está a ${f(antena.alturaM)} m con ${f(antena.gananciaDbi)} dBi. ${antena.activa ? "Simule para conocer su alcance." : "Está excluida de la simulación."}`, acciones: antena.activa ? [{ texto: "Simular ahora", accion: "simular" }] : undefined };
  }
  const nombres = new Map(c.antenas.map((a) => [a.id, a.nombre]));
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
  if (mejor && mejor.puntos >= 2) return mejor.tema.responder(c);
  if (/\b(hola|buenas|buenos dias|saludos)\b/.test(t)) {
    const r = TEMAS.find((x) => x.id === "capacidades")!.responder(c);
    return { ...r, texto: `¡Hola! ${r.texto}` };
  }
  return {
    texto:
      "No estoy seguro de haber entendido. Puedo inscribir, mover o editar nodos con coordenadas, medir distancias, llevarlo a un municipio, explicar los colores, los enlaces y los saltos, o decirle por qué un nodo no llega a la pasarela. Pruebe: «¿qué puedes hacer?».",
    acciones: [{ texto: "Hacer el recorrido", accion: "recorrido" }],
  };
}

export const SUGERENCIAS = ["Hazme un tour", "¿Qué puedes hacer?", "Inscribe un nodo antena", "¿Es factible la red?"];
