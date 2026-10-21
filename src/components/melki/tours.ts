// Tours guiados de Melki. Cada tour es una lista de pasos: los de explicación resaltan una parte de la pantalla;
// los prácticos piden hacer algo (inscribir un nodo, simular, medir…), detectan solos cuando quedó hecho y traen
// «Hágalo por mí». Los tours prácticos corren sobre un escenario de práctica: al salir, el del usuario vuelve tal cual.
import { escenarioEjemplo, escenarioVacio, nuevaAntena, type Accion, type Estado, type Vista } from "@/components/simulador/estado";
import { desplazar, rumbo } from "@/lib/radio/geo";
import type { Inspeccion } from "@/lib/radio/simulacion";
import type { Antena, Escenario, Medicion } from "@/lib/radio/tipos";

import type { Api } from "./ordenes";

export type IdTour = "basico" | "pantalla" | "mesh" | "radiomobile" | "medir" | "melki";

/** Panel que se abre antes de un paso («mapa» cierra la hoja en el celular para dejar ver el mapa). */
export type Preparacion = "antenas" | "parametros" | "resultados" | "mapa" | null;

/** Lo que el tour puede ver del simulador en un momento dado. */
export type FotoTour = {
  estado: Estado;
  inspeccion: Inspeccion | null;
  /** Perfil del enlace abierto y si muestra el informe de radioenlace. */
  perfil: { informe: boolean } | null;
  perfilTerreno: boolean;
};

/** Lo que el tour puede hacer en el simulador. */
export type ApiTour = {
  foto: () => FotoTour;
  /** Hay resultado y corresponde a lo que está en pantalla. */
  alDia: () => boolean;
  despachar: (a: Accion) => void;
  melki: Api;
  perfilTerreno: (m: Medicion) => void;
};

export type Tarea = {
  /** ¿Ya quedó hecho? Se compara con la foto tomada al entrar al paso. */
  hecho: (t: ApiTour, base: FotoTour) => boolean;
  /** «Hágalo por mí». */
  hacer: (t: ApiTour) => void;
  /** Lo que se dice cuando queda hecho sin «Hágalo por mí» (por defecto, «¡Bien hecho!»). */
  aviso?: string;
};

export type Paso = {
  titulo: string;
  texto: string;
  /** Elemento resaltado (atributo data-tour; con varios, el primero que esté en pantalla). Sin objetivo, la tarjeta va al centro. */
  objetivo?: string | string[] | null;
  preparar?: Preparacion;
  /** Lado preferido de la tarjeta respecto al elemento. */
  lado?: "izquierda";
  /** Deja lo necesario para el paso aunque se haya omitido el anterior (por ejemplo, un nodo antena). */
  asegurar?: (t: ApiTour) => void;
  tarea?: Tarea;
};

export type Practica = {
  escenario: () => Escenario;
  autoSimular: boolean;
  /** Centro y zoom iniciales; si no hay, se encuadran los nodos. */
  centro?: [number, number, number];
  vista?: Partial<Vista>;
};

export type Tour = {
  id: IdTour;
  nombre: string;
  /** Una línea para el menú de Melki. */
  detalle: string;
  minutos: number;
  practica?: Practica;
  pasos: Paso[];
  final: string;
};

/* ───────────── Ayudas ───────────── */

/** Punto genérico de la llanura donde está el nodo antena «Ejemplo». */
const CENTRO = { lat: 4.2, lon: -73.37 };

const elemento = (selector: string) => (typeof document === "undefined" ? null : document.querySelector<HTMLElement>(selector));

/** Avisos a Melki: abrir la conversación, enviarle un pedido o mostrar el menú de tours. */
export function avisarMelki(tipo: "abrir" | "pedir" | "tours", texto?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(`melki:${tipo}`, { detail: texto }));
}

const antenas = (f: FotoTour) => f.estado.escenario.antenas;
const deTipo = (f: FotoTour, tipo: "antena" | "nodo") => antenas(f).filter((a) => (a.tipo ?? "antena") === tipo);
const primera = (t: ApiTour): Antena | undefined => deTipo(t.foto(), "antena")[0];

/** Inscribe un nodo como lo haría el usuario con la herramienta Agregar (sin pedir una simulación aparte). */
function inscribir(t: ApiTour, lat: number, lon: number, datos: Partial<Antena> = {}) {
  const a = nuevaAntena(Number(lat.toFixed(6)), Number(lon.toFixed(6)), antenas(t.foto()), datos);
  t.despachar({ tipo: "insertar", antena: a });
  t.despachar({ tipo: "herramienta", herramienta: "mover" });
  return a;
}

/** Si no hay ningún nodo antena (porque se omitió el paso), lo inscribe. */
function asegurarAntena(t: ApiTour) {
  if (!primera(t)) inscribir(t, CENTRO.lat, CENTRO.lon);
}

const simularSiHaceFalta = (t: ApiTour) => {
  if (!t.alDia()) t.melki.simular();
};

function medirSenal(t: ApiTour) {
  const a = primera(t);
  const p = desplazar(a?.lat ?? CENTRO.lat, a?.lon ?? CENTRO.lon, 3200, 45);
  t.melki.herramienta("inspeccionar");
  t.melki.senal(p.lat, p.lon);
}

const senalMedida = (t: ApiTour, base: FotoTour) => {
  const i = t.foto().inspeccion;
  return i !== null && i !== base.inspeccion && Number.isFinite(i.elevacionM);
};

function practicaConDos(): Escenario {
  const e = escenarioEjemplo();
  const ejemplo = e.antenas[0];
  const p = desplazar(ejemplo.lat, ejemplo.lon, 5600, 50);
  const otra = nuevaAntena(Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6)), e.antenas, { nombre: "Antena 2", alturaM: 15 });
  return { ...e, nombre: "Práctica: como Radio Mobile", antenas: [ejemplo, otra] };
}

const renombrado = (e: Escenario, nombre: string): Escenario => ({ ...e, nombre });

/* ───────────── Pasos de la pantalla (el recorrido de siempre) ───────────── */

const PASOS_PANTALLA: Paso[] = [
  {
    titulo: "¡Hola! Soy Melki",
    texto: "Le muestro en un minuto para qué sirve cada parte de la pantalla: el mapa, los nodos, las herramientas, los parámetros, los resultados y cómo guardar.",
  },
  { objetivo: "mapa", titulo: "El mapa", texto: "Aquí se ven los nodos y la cobertura sobre imágenes satelitales, con departamentos, municipios y ríos. Arrastre para moverse, use la rueda para acercarse, arrastre un nodo para reubicarlo y haga clic derecho para ver más opciones en ese punto." },
  { objetivo: "buscador", titulo: "Buscar un lugar", texto: "Escriba un municipio, un departamento, el nombre de un nodo o unas coordenadas para ir directo al sitio." },
  { objetivo: "agregar", titulo: "Agregar nodos", texto: "Elija nodo antena (infraestructura que genera cobertura) o nodo de campo, y ubíquelo con un clic en el mapa o por coordenadas, en grados decimales o en grados, minutos y segundos.", preparar: "antenas" },
  { objetivo: "lista-antenas", titulo: "Sus nodos", texto: "Haga clic en un nodo para editar su tipo, altura, equipo, rol y si es pasarela. También puede ponerle una antena direccional (Yagi, panel, sectorial o parabólica) y apuntarla, y abrir el informe de radioenlace hacia otro nodo. El ojo lo saca de la simulación sin borrarlo.", preparar: "antenas" },
  { objetivo: "herramientas", titulo: "Herramientas del mapa", texto: "Mover para navegar y arrastrar nodos, Agregar para ubicarlos, Medir señal para consultar cualquier punto y Regla para medir distancias, trayectos y áreas como en Google Earth.", preparar: "mapa" },
  { objetivo: "modos", titulo: "Tres maneras de ver la cobertura", texto: "Señal muestra el nivel del mejor nodo antena; Mejor antena, cuál atiende cada zona; Respaldo, cuántos nodos antena llegan a cada punto.", preparar: "mapa" },
  { objetivo: "capas", titulo: "Capas", texto: "Cambie el mapa base (OpenTopoMap muestra quebradas y ríos pequeños con su nombre), active límites, ríos, poblados y vías, el rango de alcance y los anillos de distancia. Al final, en «Escala de la señal», elija dBm, µV o dBµV/m y colores por clases, arcoíris o umbral, como en Radio Mobile.", preparar: "mapa" },
  { objetivo: "tab-parametros", titulo: "Parámetros", texto: "Aquí están el preset de Meshtastic, la frecuencia, el límite de saltos, el receptor y el entorno (vegetación o edificios), el radio de estudio y la fuente del relieve.", preparar: "parametros" },
  {
    objetivo: "propagacion",
    titulo: "Propagación como Radio Mobile",
    texto: "El modelo calibrado es el recomendado; también puede usar Longley-Rice puro. Elija la confiabilidad (normal, alta o muy alta) y, en «Parámetros como en Radio Mobile», el clima, la polarización, el suelo, la refractividad y el modo estadístico. Si tiene dudas, pídamelo con sus palabras.",
    preparar: "parametros",
  },
  { objetivo: "simular", titulo: "Simular", texto: "Calcula la cobertura de todos los nodos antena a la vez. Con «Simular al cambiar» activo, recalculo cada vez que usted ajusta algo.", preparar: "parametros" },
  { objetivo: "leyenda", titulo: "La leyenda", texto: "Los colores son el margen sobre la sensibilidad, con la paleta de Radio Mobile: verde oscuro es señal buena y rojo es sin servicio. La línea naranja marca el alcance con servicio y la verde, el confiable.", preparar: "mapa" },
  { objetivo: "factibilidad", titulo: "¿Es factible?", texto: "Reviso que todos los nodos lleguen a la pasarela, los saltos, la calidad de los enlaces, la cobertura confiable y los puntos únicos de falla.", preparar: "resultados" },
  { objetivo: "enlaces", titulo: "La malla", texto: "Cada pareja de nodos con su margen. El botón de ruta abre el perfil del terreno con la línea de vista y la zona de Fresnel. Más abajo, «Cómo se calculó» explica los números.", preparar: "resultados" },
  { objetivo: "archivo", titulo: "Guardar y exportar", texto: "Guarde el escenario en .json, los nodos en Excel o la cobertura en .kmz para abrirla en Google Earth, con el rango de alcance y las mediciones.", preparar: "mapa" },
  { objetivo: "melki", titulo: "Pregúnteme", texto: "Escríbame aquí con sus palabras, o toque el micrófono y dícteme: el texto aparece en la caja para revisarlo antes de enviarlo. Inscribo nodos en una coordenada, los muevo, mido distancias, lo llevo a un municipio y le explico los resultados. Todo lo que hago se puede deshacer. Y si quiere otro tour, pídamelo." },
];

/* ───────────── Los tours ───────────── */

export const TOURS: Tour[] = [
  {
    id: "basico",
    nombre: "Tutorial básico",
    detalle: "Su primera simulación en 7 pasos, haciéndola usted mismo.",
    minutos: 3,
    practica: { escenario: () => renombrado(escenarioVacio(), "Práctica: tutorial básico"), autoSimular: false, centro: [CENTRO.lat, CENTRO.lon, 12] },
    pasos: [
      {
        titulo: "Tutorial básico",
        texto: "Vamos a hacer juntos su primera simulación en 7 pasos. Usted hace cada uno en la pantalla y yo le confirmo; si prefiere, toque «Hágalo por mí». Puede omitir cualquier paso o salir cuando quiera. Estamos en un escenario de práctica: al terminar, el suyo vuelve tal cual.",
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        titulo: "Inscriba un nodo antena",
        texto: "Toque «Agregar» en la barra del mapa y haga clic en cualquier punto del mapa. El nodo antena es la infraestructura en mástil que da cobertura. (También se puede por coordenadas, en el panel Nodos).",
        tarea: {
          hecho: (t, base) => deTipo(t.foto(), "antena").length > deTipo(base, "antena").length,
          hacer: (t) => inscribir(t, CENTRO.lat, CENTRO.lon),
        },
      },
      {
        objetivo: ["altura", "lista-antenas"],
        preparar: "antenas",
        titulo: "Súbale la altura",
        texto: "Abra la ficha del nodo con un clic en él (en la lista o en el mapa) y ponga la altura en 20 m. Entre más alto, más lejos llega. Ahí mismo se elige el equipo.",
        asegurar: asegurarAntena,
        tarea: {
          hecho: (t) => deTipo(t.foto(), "antena").some((a) => a.alturaM >= 20),
          hacer: (t) => {
            const a = primera(t);
            if (a) {
              t.despachar({ tipo: "seleccionar", id: a.id });
              t.despachar({ tipo: "editar", id: a.id, cambios: { alturaM: 20 } });
            }
          },
        },
      },
      {
        objetivo: "simular",
        preparar: "antenas",
        titulo: "Simule",
        texto: "Toque «Simular»: calculo la cobertura sobre el relieve real. Para la práctica apagué «Simular al cambiar»; encendido, recalculo solo cada vez que usted cambia algo.",
        asegurar: asegurarAntena,
        tarea: { hecho: (t) => antenas(t.foto()).length > 0 && t.alDia(), hacer: (t) => t.melki.simular() },
      },
      {
        objetivo: "leyenda",
        preparar: "mapa",
        titulo: "Lea los colores",
        texto: "Cada color es el margen de la señal sobre lo mínimo que necesita el receptor: verde oscuro es buena, amarillo es media, naranja es baja y rojo es sin servicio. La línea naranja marca hasta dónde llega con servicio y la verde, el alcance confiable.",
        asegurar: (t) => {
          t.despachar({ tipo: "auto", valor: true });
          asegurarAntena(t);
          simularSiHaceFalta(t);
        },
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        titulo: "Mida la señal en un punto",
        texto: "Toque «Medir señal» y haga clic en el mapa, por ejemplo en una zona amarilla. Le digo la señal que llega a ese punto desde cada nodo antena.",
        asegurar: asegurarAntena,
        tarea: { hecho: senalMedida, hacer: medirSenal },
      },
      {
        objetivo: "factibilidad",
        preparar: "resultados",
        titulo: "¿Es factible?",
        texto: "Aquí le digo si la red funciona: que todos los nodos lleguen a la pasarela, los saltos, la calidad de los enlaces y la cobertura confiable, con recomendaciones. Con un solo nodo antena cuenta la cobertura; para una red, sume más nodos (hay un tour para eso).",
        asegurar: simularSiHaceFalta,
      },
      {
        objetivo: "archivo",
        preparar: "mapa",
        titulo: "Guarde o exporte",
        texto: "En «Archivo» guarda el escenario (.json) para retomarlo, los nodos en Excel (.csv) o la cobertura para Google Earth (.kmz). Como esto es una práctica, no hace falta guardar nada ahora; el simulador además guarda su trabajo solo en este navegador.",
      },
    ],
    final: "Ya sabe lo básico: inscribir un nodo, ajustarlo, simular, leer los colores, medir la señal y ver si es factible.",
  },
  {
    id: "pantalla",
    nombre: "Conocer la pantalla",
    detalle: "Para qué sirve cada parte, sin tocar nada.",
    minutos: 2,
    pasos: PASOS_PANTALLA,
    final: "Esa es la pantalla completa. Cuando quiera, practique con el tutorial básico.",
  },
  {
    id: "mesh",
    nombre: "Red mesh completa",
    detalle: "Varios nodos, pasarela, saltos y si la red funciona.",
    minutos: 4,
    practica: { escenario: () => renombrado(escenarioEjemplo(), "Práctica: red mesh"), autoSimular: true },
    pasos: [
      {
        titulo: "Red mesh completa",
        texto: "En una red mesh los mensajes saltan de nodo en nodo hasta la pasarela, la que conecta con internet. Partimos del nodo antena «Ejemplo», que ya es la pasarela; vamos a sumar nodos y ver si la red funciona. Estamos en un escenario de práctica.",
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        titulo: "Un segundo nodo antena",
        texto: "Toque «Agregar», deje «Nodo antena» y haga clic a unos 6 km del Ejemplo (los anillos marcan las distancias). Así la red cubre más terreno.",
        tarea: {
          hecho: (t, base) => deTipo(t.foto(), "antena").length > deTipo(base, "antena").length,
          hacer: (t) => {
            const p = desplazar(CENTRO.lat, CENTRO.lon, 6000, 60);
            inscribir(t, p.lat, p.lon, { alturaM: 15 });
          },
        },
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        titulo: "Un nodo de campo",
        texto: "Ahora el radio que lleva una persona o un sensor: toque «Agregar», cambie a «Nodo» y haga clic en el mapa, dentro de la zona con color.",
        tarea: {
          hecho: (t, base) => deTipo(t.foto(), "nodo").length > deTipo(base, "nodo").length,
          hacer: (t) => {
            const p = desplazar(CENTRO.lat, CENTRO.lon, 3500, 200);
            inscribir(t, p.lat, p.lon, { tipo: "nodo" });
          },
        },
      },
      {
        objetivo: "lista-antenas",
        preparar: "antenas",
        titulo: "La pasarela",
        texto: "La pasarela, marcada en la lista, es la puerta de salida de la red. Cualquier nodo antena puede serlo: se elige en su ficha. Los demás nodos deben llegar a ella, directo o saltando por otros.",
      },
      {
        objetivo: "enlaces",
        preparar: "resultados",
        titulo: "La malla",
        texto: "Cada línea es un enlace entre dos nodos con su margen en dB; desde 20 dB hay servicio. Con «Simular al cambiar» encendido la red se recalcula sola; si no, toque «Simular».",
        tarea: { hecho: (t) => t.alDia(), hacer: (t) => t.melki.simular(), aviso: "Listo: la red ya está calculada." },
      },
      {
        objetivo: "modos",
        preparar: "mapa",
        titulo: "Vea el respaldo",
        texto: "Cambie el color del mapa a «Respaldo»: muestra cuántos nodos antena llegan a cada punto. Donde llegan dos o más, la red aguanta aunque uno falle.",
        tarea: { hecho: (t) => t.foto().estado.vista.modo === "redundancia", hacer: (t) => t.melki.vista({ modo: "redundancia" }) },
      },
      {
        objetivo: "factibilidad",
        preparar: "resultados",
        titulo: "Saltos y factibilidad",
        texto: "Aquí reviso que cada nodo llegue a la pasarela sin pasar el límite de saltos, que los enlaces sean sólidos y que no haya puntos únicos de falla (un nodo que, si se cae, deja aislados a otros). Si algo falla, le doy recomendaciones.",
        asegurar: simularSiHaceFalta,
      },
      {
        objetivo: "melki",
        titulo: "Pregúnteme por la red",
        texto: "Si un nodo no llega, pregúnteme «¿por qué Nodo 1 no llega?» y le digo con quién tiene su mejor enlace y qué hacer: acercarlo, subirlo o poner un repetidor.",
      },
    ],
    final: "Ya sabe armar una red mesh: nodos antena, nodos de campo, la pasarela, los enlaces, el respaldo y la factibilidad.",
  },
  {
    id: "radiomobile",
    nombre: "Como Radio Mobile",
    detalle: "Confiabilidad, antena direccional, escala en dBm e informe de radioenlace.",
    minutos: 4,
    practica: { escenario: practicaConDos, autoSimular: true },
    pasos: [
      {
        titulo: "Como Radio Mobile",
        texto: "Le muestro las funciones que se parecen a Radio Mobile, con dos nodos antena de práctica: la confiabilidad y los parámetros de propagación, una antena direccional, la escala de la señal en dBm y el informe del radioenlace.",
      },
      {
        objetivo: "propagacion",
        preparar: "parametros",
        titulo: "Confiabilidad",
        texto: "En Parámetros, en «Propagación», elija la confiabilidad «Alta»: exijo que la señal se cumpla el 90 % del tiempo y de las situaciones, como al subir esos porcentajes en Radio Mobile. El área con servicio se reduce.",
        tarea: {
          hecho: (t) => t.foto().estado.escenario.parametros.tiempoPct >= 90,
          hacer: (t) => t.melki.parametrosCambiar({ tiempoPct: 90, ubicacionesPct: 90, situacionesPct: 90 }),
        },
      },
      {
        objetivo: "propagacion",
        preparar: "parametros",
        titulo: "Modelo y parámetros",
        texto: "El modelo calibrado con las pruebas de campo es el recomendado; también puede usar Longley-Rice puro. En «Parámetros como en Radio Mobile» están el clima, la polarización, el suelo, la refractividad y el modo estadístico.",
      },
      {
        objetivo: ["patron", "lista-antenas"],
        preparar: "antenas",
        titulo: "Antena direccional",
        texto: "Abra la ficha de «Antena 2», cambie la antena a Yagi y apúntela hacia el Ejemplo con el azimut. La cobertura se vuelve un haz en esa dirección.",
        tarea: {
          hecho: (t) => antenas(t.foto()).some((a) => (a.patron ?? "omni") !== "omni"),
          hacer: (t) => {
            const [a, b] = deTipo(t.foto(), "antena");
            const destino = b ?? a;
            if (!destino) return;
            const az = a && b ? Math.round(rumbo(b.lat, b.lon, a.lat, a.lon)) : 0;
            t.despachar({ tipo: "seleccionar", id: destino.id });
            t.melki.editar(destino.id, { patron: "yagi", gananciaDbi: 11, azimutDeg: az, elevacionDeg: 0, equipo: "personalizado" });
          },
        },
      },
      {
        objetivo: ["escala", "capas"],
        preparar: "mapa",
        titulo: "Escala en dBm",
        texto: "Abra «Capas» y, al final, en «Escala de la señal», elija dBm. Ahí también están los colores arcoíris y el umbral, como en Radio Mobile.",
        tarea: {
          hecho: (t) => t.foto().estado.vista.unidad === "dbm",
          hacer: (t) => t.melki.vista({ unidad: "dbm", escala: "arcoiris" }),
        },
      },
      {
        objetivo: ["radioenlace", "lista-antenas"],
        preparar: "antenas",
        titulo: "Informe de radioenlace",
        texto: "En la ficha de un nodo, en «Perfil e informe del enlace hacia», elija el otro y toque «Radioenlace». Verá el perfil con la zona de Fresnel y el balance del enlace, como el Radio Link.",
        tarea: {
          hecho: (t) => t.foto().perfil?.informe === true,
          hacer: (t) => {
            const [a, b] = deTipo(t.foto(), "antena");
            if (a && b) t.melki.perfil(a, b, true);
          },
        },
      },
    ],
    final: "Ya conoce las funciones tipo Radio Mobile: confiabilidad, parámetros de propagación, antenas direccionales, escala en dBm e informe de radioenlace.",
  },
  {
    id: "medir",
    nombre: "Medir y exportar",
    detalle: "Señal en un punto, regla, perfil del terreno y Google Earth.",
    minutos: 3,
    practica: { escenario: () => renombrado(escenarioEjemplo(), "Práctica: medir y exportar"), autoSimular: true },
    pasos: [
      {
        titulo: "Medir y exportar",
        texto: "Le muestro cómo consultar la señal en cualquier punto, medir distancias como en Google Earth, ver el relieve de un trayecto y llevar todo a Google Earth. Estamos en un escenario de práctica.",
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        titulo: "Señal en un punto",
        texto: "Toque «Medir señal» y haga clic en cualquier punto del mapa: le digo cuánta señal llega desde cada nodo antena y si hay servicio.",
        asegurar: simularSiHaceFalta,
        tarea: { hecho: senalMedida, hacer: medirSenal },
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        titulo: "La regla",
        texto: "Toque «Regla» y haga clic en dos o más puntos del mapa; doble clic para terminar. Mide distancias, trayectos y áreas, y las guarda en la lista de mediciones.",
        tarea: {
          hecho: (t, base) => t.foto().estado.escenario.mediciones.length > base.estado.escenario.mediciones.length,
          hacer: (t) => {
            const a = primera(t);
            const ini = desplazar(a?.lat ?? CENTRO.lat, a?.lon ?? CENTRO.lon, 1500, 250);
            const fin = desplazar(a?.lat ?? CENTRO.lat, a?.lon ?? CENTRO.lon, 4500, 70);
            t.melki.herramienta("regla");
            t.melki.medir({ id: `m${Date.now().toString(36)}`, nombre: "Trayecto de práctica", tipo: "trayecto", puntos: [[ini.lon, ini.lat], [fin.lon, fin.lat]], visible: true });
          },
        },
      },
      {
        objetivo: "regla",
        titulo: "Perfil del terreno",
        texto: "En la lista de mediciones toque el ícono de perfil: ve el relieve a lo largo del trayecto, con la distancia y las alturas.",
        tarea: {
          hecho: (t) => t.foto().perfilTerreno,
          hacer: (t) => {
            const m = t.foto().estado.escenario.mediciones.at(-1);
            if (m) t.perfilTerreno(m);
          },
        },
      },
      {
        objetivo: "archivo",
        preparar: "mapa",
        titulo: "A Google Earth",
        texto: "Abra «Archivo»: «Cobertura para Google Earth (.kmz)» lleva la señal, los nodos, los enlaces, el alcance y sus mediciones; «Nodos en Excel» saca la tabla. No hace falta descargar nada ahora.",
        tarea: {
          hecho: () => elemento('[data-tour="archivo"][aria-expanded="true"]') !== null,
          hacer: () => elemento('[data-tour="archivo"]')?.click(),
        },
      },
    ],
    final: "Ya sabe medir la señal en un punto, usar la regla, ver el perfil del terreno y exportar a Google Earth.",
  },
  {
    id: "melki",
    nombre: "Hablar con Melki",
    detalle: "Pedirme cosas con sus palabras, dictarme por voz y deshacer.",
    minutos: 2,
    practica: { escenario: () => renombrado(escenarioEjemplo(), "Práctica: hablar con Melki"), autoSimular: true },
    pasos: [
      {
        titulo: "Hablar con Melki",
        texto: "Puedo hacer cosas por usted si me las pide con sus palabras, escritas o dictadas: inscribir nodos, moverlos, medir, cambiar parámetros y explicarle los resultados. Estamos en un escenario de práctica.",
      },
      {
        objetivo: "melki",
        lado: "izquierda",
        titulo: "Ábrame",
        texto: "Toque mi botón, abajo a la derecha, para abrir la conversación.",
        tarea: { hecho: () => elemento('[aria-label="Conversación con Melki"]') !== null, hacer: () => avisarMelki("abrir") },
      },
      {
        objetivo: "melki-entrada",
        lado: "izquierda",
        titulo: "Pídame un nodo",
        texto: "Escriba «inscribe un nodo antena en 4.23 -73.33» y envíelo con Enter. Acepto coordenadas en grados decimales o en grados, minutos y segundos.",
        asegurar: () => avisarMelki("abrir"),
        tarea: {
          hecho: (t, base) => antenas(t.foto()).length > antenas(base).length,
          hacer: () => avisarMelki("pedir", "Inscribe un nodo antena en 4.23 -73.33"),
        },
      },
      {
        objetivo: "microfono",
        lado: "izquierda",
        titulo: "Dícteme",
        texto: "También puede tocar el micrófono y hablarme: lo que dice aparece en la caja para revisarlo y corregirlo, y solo se envía cuando usted quiera. Puede dictar con el navegador o en modo privado, sin internet.",
        asegurar: () => avisarMelki("abrir"),
      },
      {
        objetivo: "melki-chat",
        lado: "izquierda",
        titulo: "Deshaga",
        texto: "Todo lo que hago se puede deshacer: toque «Deshacer» en mi respuesta o escríbame «deshaz».",
        asegurar: () => avisarMelki("abrir"),
        tarea: {
          hecho: (t, base) => antenas(t.foto()).length < antenas(base).length,
          hacer: () => avisarMelki("pedir", "Deshaz"),
        },
      },
      {
        objetivo: "melki-chat",
        lado: "izquierda",
        titulo: "Pregúnteme lo que quiera",
        texto: "Por ejemplo: «¿es factible la red?», «¿qué significa el amarillo?», «llévame a Villavicencio», «mide la distancia entre Ejemplo y Antena 2» o «pon la confiabilidad alta».",
        asegurar: () => avisarMelki("abrir"),
      },
    ],
    final: "Ya sabe pedirme cosas por escrito o por voz y deshacerlas. Aquí sigo cuando me necesite.",
  },
];

export const tourPorId = (id: IdTour) => TOURS.find((t) => t.id === id) ?? TOURS[0];

/** Pasos con tarea de un tour (para contarlos en el menú y en las pruebas). */
export const pasosPracticos = (t: Tour) => t.pasos.filter((p) => p.tarea).length;
