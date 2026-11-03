// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Tours guiados de Melki. Cada tour es una lista de pasos: los de explicación resaltan una parte de la pantalla;
// los prácticos piden hacer algo (inscribir un nodo, simular, medir…), detectan solos cuando quedó hecho y traen
// «Hágalo por mí». Los tours prácticos corren sobre un escenario de práctica: al salir, el del usuario vuelve tal cual.
// Bilingües: los textos de cada tour y de cada paso son getters (se leen en el idioma de ese momento) y TOURS conserva
// su forma; los nombres que quedan en el escenario (la práctica, «Antena 2», el trayecto) se fijan al crearlos.
import { escenarioEjemplo, escenarioVacio, nuevaAntena, type Accion, type Estado, type ModoApp, type Vista } from "@/components/simulador/estado";
import { escenarioMalla } from "@/components/simulador/piezas";
import { tx } from "@/lib/idioma";
import { desplazar, rumbo } from "@/lib/radio/geo";
import type { Inspeccion } from "@/lib/radio/simulacion";
import type { Antena, Escenario, Medicion } from "@/lib/radio/tipos";

import type { Api } from "./ordenes";

export type IdTour = "basico" | "sembrar" | "capacidad" | "pantalla" | "mesh" | "radiomobile" | "medir" | "melki" | "voz";

/** Panel que se abre antes de un paso («mapa» cierra la hoja en el celular para dejar ver el mapa). */
export type Preparacion = "antenas" | "parametros" | "resultados" | "mapa" | "sembrar" | null;

/** Lo que el tour puede ver del simulador en un momento dado. */
export type FotoTour = {
  estado: Estado;
  inspeccion: Inspeccion | null;
  /** Perfil del enlace abierto y si muestra el informe de radioenlace. */
  perfil: { informe: boolean } | null;
  perfilTerreno: boolean;
  /** Sembrado automático (modo «Sembrar la malla») y número del último mensaje enviado (0 si ninguno). */
  siembra: "nada" | "buscando" | "propuesta" | "puesta" | "error";
  mensaje: number;
  /** Prueba de carga: «curva» cuando ya está la curva de «¿hasta cuántos aguanta?». */
  carga: "nada" | "probando" | "listo" | "curva" | "error";
  /** Prueba de estrés de la hora pico: «rampa» cuando ya subió la carga hasta reventar cada zona. */
  estres: "nada" | "probando" | "listo" | "rampa" | "error";
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
  /** Modo de la pantalla durante el tour (por defecto, el avanzado, con sus pestañas). */
  modo?: ModoApp;
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
  const otra = nuevaAntena(Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6)), e.antenas, { nombre: tx("Antena 2", "Antenna 2"), alturaM: 15 });
  return { ...e, nombre: tx("Práctica: como Radio Mobile", "Practice: like Radio Mobile"), antenas: [ejemplo, otra] };
}

const renombrado = (e: Escenario, nombre: string): Escenario => ({ ...e, nombre });

/* ───────────── Sembrar la malla ───────────── */

const piezas = (f: FotoTour, p: "gateway" | "repetidor" | "persona") => antenas(f).filter((a) => (p === "gateway" ? a.pasarela : p === "repetidor" ? !a.pasarela && (a.tipo ?? "antena") === "antena" : (a.tipo ?? "antena") === "nodo"));

const gatewayDe = (t: ApiTour) => piezas(t.foto(), "gateway")[0];
const pobladas = (f: FotoTour) => antenas(f).filter((a) => a.poblada).length;
const enZonas = (f: FotoTour) => antenas(f).filter((a) => a.poblada && a.zona).length;

/** Encuadra todas las piezas para que se vea el flujo completo de la malla. */
function encuadrarMalla(t: ApiTour) {
  const a = antenas(t.foto());
  if (!a.length) return;
  const lons = a.map((x) => x.lon);
  const lats = a.map((x) => x.lat);
  t.melki.encuadrarCaja([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);
}

function asegurarGateway(t: ApiTour) {
  if (!gatewayDe(t)) t.melki.ponerPieza("gateway", CENTRO.lat, CENTRO.lon);
}

/** Repite una acción hasta que se pueda (la red calculada, la propuesta lista), sin pasar de unos segundos. */
function cuandoSePueda(listo: () => boolean, hacer: () => void, intentos = 40) {
  if (listo()) {
    hacer();
    return;
  }
  if (intentos > 0) globalThis.setTimeout(() => cuandoSePueda(listo, hacer, intentos - 1), 400);
}

function sembrarFaltantes(t: ApiTour) {
  cuandoSePueda(
    () => t.melki.red().alDia,
    () => {
      const r = t.melki.red();
      const g = r.gateways[0] ?? CENTRO;
      const destinos = r.sinCobertura.length ? r.sinCobertura.map((a) => ({ lat: a.lat, lon: a.lon, nombre: a.nombre, antena: a })) : [{ ...desplazar(g.lat, g.lon, 28000, 70), nombre: tx("El punto de práctica", "The practice point") }];
      void t.melki.sembrar(destinos);
    },
  );
}

function enviarDePrueba(t: ApiTour) {
  cuandoSePueda(
    () => t.melki.red().alDia,
    () => {
      const r = t.melki.red();
      const desde = [...r.conectadas, ...r.lejos].sort((a, b) => (r.porNodo.get(b.id)?.saltos ?? 0) - (r.porNodo.get(a.id)?.saltos ?? 0))[0] ?? r.personas[0] ?? r.repetidores[0];
      if (desde) t.melki.enviarMensaje(desde.id);
    },
  );
}

/* ───────────── Pasos de la pantalla (el recorrido de siempre) ───────────── */

const PASOS_PANTALLA: Paso[] = [
  {
    get titulo() {
      return tx("¡Hola! Soy Melki", "Hello! I'm Melki");
    },
    get texto() {
      return tx("Le muestro en un minuto para qué sirve cada parte de la pantalla: el mapa, los nodos, las herramientas, los parámetros, los resultados y cómo guardar.", "In one minute I'll show you what each part of the screen is for: the map, the nodes, the tools, the parameters, the results and how to save.");
    },
  },
  { objetivo: "mapa", get titulo() { return tx("El mapa", "The map"); }, get texto() { return tx("Aquí se ven los nodos y la cobertura sobre imágenes satelitales, con departamentos, municipios y ríos. Arrastre para moverse, use la rueda para acercarse, arrastre un nodo para reubicarlo y haga clic derecho para ver más opciones en ese punto.", "Here you see the nodes and the coverage over satellite imagery, with departments, municipalities and rivers. Drag to move around, use the wheel to zoom in, drag a node to relocate it and right-click to see more options at that point."); } },
  { objetivo: "buscador", get titulo() { return tx("Buscar un lugar", "Find a place"); }, get texto() { return tx("Escriba un municipio, un departamento, el nombre de un nodo o unas coordenadas para ir directo al sitio.", "Type a municipality, a department, a node name or some coordinates to go straight to the spot."); } },
  { objetivo: "agregar", get titulo() { return tx("Agregar nodos", "Add nodes"); }, get texto() { return tx("Elija nodo antena (infraestructura que genera cobertura) o nodo de campo, y ubíquelo con un clic en el mapa o por coordenadas, en grados decimales o en grados, minutos y segundos.", "Choose antenna node (infrastructure that provides coverage) or field node, and place it with a click on the map or by coordinates, in decimal degrees or in degrees, minutes and seconds."); }, preparar: "antenas" },
  { objetivo: "lista-antenas", get titulo() { return tx("Sus nodos", "Your nodes"); }, get texto() { return tx("Haga clic en un nodo para editar su tipo, altura, equipo, rol y si es pasarela. También puede ponerle una antena direccional (Yagi, panel, sectorial o parabólica) y apuntarla, y abrir el informe de radioenlace hacia otro nodo. El ojo lo saca de la simulación sin borrarlo.", "Click a node to edit its type, height, equipment, role and whether it's the gateway. You can also give it a directional antenna (Yagi, panel, sector or dish) and aim it, and open the radio link report toward another node. The eye icon takes it out of the simulation without deleting it."); }, preparar: "antenas" },
  { objetivo: "herramientas", get titulo() { return tx("Herramientas del mapa", "Map tools"); }, get texto() { return tx("Mover para navegar y arrastrar nodos, Agregar para ubicarlos, Medir señal para consultar cualquier punto y Regla para medir distancias, trayectos y áreas como en Google Earth.", "Pan to navigate and drag nodes, Add to place them, Measure signal to check any point and Ruler to measure distances, paths and areas as in Google Earth."); }, preparar: "mapa" },
  { objetivo: "modos", get titulo() { return tx("Tres maneras de ver la cobertura", "Three ways to see the coverage"); }, get texto() { return tx("Señal muestra el nivel del mejor nodo antena; Mejor antena, cuál atiende cada zona; Respaldo, cuántos nodos antena llegan a cada punto.", "Signal shows the level from the best antenna node; Best antenna, which one serves each area; Backup, how many antenna nodes reach each point."); }, preparar: "mapa" },
  { objetivo: "capas", get titulo() { return tx("Capas", "Layers"); }, get texto() { return tx("Cambie el mapa base (OpenTopoMap muestra quebradas y ríos pequeños con su nombre), active límites, ríos, poblados y vías, el rango de alcance y los anillos de distancia. Al final, en «Escala de la señal», elija dBm, µV o dBµV/m y colores por clases, arcoíris o umbral, como en Radio Mobile.", "Change the base map (OpenTopoMap shows streams and small rivers with their names), turn on boundaries, rivers, towns and roads, the range and the distance rings. At the bottom, in “Signal scale”, choose dBm, µV or dBµV/m and colors by class, rainbow or threshold, as in Radio Mobile."); }, preparar: "mapa" },
  { objetivo: "tab-parametros", get titulo() { return tx("Parámetros", "Parameters"); }, get texto() { return tx("Aquí están el ajuste de radio MeshCore (SF11 de Trama por defecto), la frecuencia (las 4 de Trama), el límite de saltos, el receptor y el entorno (vegetación o edificios), el radio de estudio y la fuente del relieve.", "Here you have the MeshCore radio preset (Trama's SF11 by default), the frequency (Trama's 4), the hop limit, the receiver and the environment (vegetation or buildings), the study radius and the terrain source."); }, preparar: "parametros" },
  {
    objetivo: "propagacion",
    get titulo() {
      return tx("Propagación como Radio Mobile", "Propagation like Radio Mobile");
    },
    get texto() {
      return tx("El modelo calibrado es el recomendado; también puede usar Longley-Rice puro. Elija la confiabilidad (normal, alta o muy alta) y, en «Parámetros como en Radio Mobile», el clima, la polarización, el suelo, la refractividad y el modo estadístico. Si tiene dudas, pídamelo con sus palabras.", "The calibrated model is the recommended one; you can also use pure Longley-Rice. Choose the reliability (normal, high or very high) and, in “Parameters as in Radio Mobile”, the climate, polarization, ground, refractivity and statistical mode. If in doubt, just ask me in your own words.");
    },
    preparar: "parametros",
  },
  { objetivo: "simular", get titulo() { return tx("Simular", "Simulate"); }, get texto() { return tx("Calcula la cobertura de todos los nodos antena a la vez. Con «Simular al cambiar» activo, recalculo cada vez que usted ajusta algo.", "It calculates the coverage of all the antenna nodes at once. With “Simulate on change” on, I recalculate every time you adjust something."); }, preparar: "parametros" },
  { objetivo: "leyenda", get titulo() { return tx("La leyenda", "The legend"); }, get texto() { return tx("Los colores son el margen sobre la sensibilidad, con la paleta de Radio Mobile: verde oscuro es señal buena y rojo es sin servicio. La línea naranja marca el alcance con servicio y la verde, el confiable.", "The colors are the margin over the sensitivity, with Radio Mobile's palette: dark green is good signal and red is no service. The orange line marks the range with service and the green one, the reliable range."); }, preparar: "mapa" },
  { objetivo: "factibilidad", get titulo() { return tx("¿Es factible?", "Is it feasible?"); }, get texto() { return tx("Reviso que todos los nodos lleguen a la pasarela, los saltos, la calidad de los enlaces, la cobertura confiable y los puntos únicos de falla.", "I check that every node reaches the gateway, the hops, the quality of the links, the reliable coverage and the single points of failure."); }, preparar: "resultados" },
  { objetivo: "enlaces", get titulo() { return tx("La malla", "The mesh"); }, get texto() { return tx("Cada pareja de nodos con su margen. El botón de ruta abre el perfil del terreno con la línea de vista y la zona de Fresnel. Más abajo, «Cómo se calculó» explica los números.", "Each pair of nodes with its margin. The route button opens the terrain profile with the line of sight and the Fresnel zone. Further down, “How it was calculated” explains the numbers."); }, preparar: "resultados" },
  { objetivo: "archivo", get titulo() { return tx("Guardar y exportar", "Save and export"); }, get texto() { return tx("Guarde el escenario en .json, los nodos en Excel o la cobertura en .kmz para abrirla en Google Earth, con el rango de alcance y las mediciones.", "Save the scenario as .json, the nodes in Excel or the coverage as .kmz to open it in Google Earth, with the range and the measurements."); }, preparar: "mapa" },
  { objetivo: "melki", get titulo() { return tx("Pregúnteme", "Ask me"); }, get texto() { return tx("Escríbame aquí con sus palabras, o toque el micrófono y dícteme: el texto aparece en la caja para revisarlo antes de enviarlo. Inscribo nodos en una coordenada, los muevo, mido distancias, lo llevo a un municipio y le explico los resultados. Todo lo que hago se puede deshacer. Y si quiere otro tour, pídamelo.", "Write to me here in your own words, or tap the microphone and dictate: the text appears in the box so you can review it before sending. I add nodes at a coordinate, move them, measure distances, take you to a municipality and explain the results. Everything I do can be undone. And if you want another tour, just ask."); } },
];

/* ───────────── Los tours ───────────── */

export const TOURS: Tour[] = [
  {
    id: "basico",
    get nombre() {
      return tx("Tutorial básico", "Basic tutorial");
    },
    get detalle() {
      return tx("Su primera simulación en 7 pasos, haciéndola usted mismo.", "Your first simulation in 7 steps, doing it yourself.");
    },
    minutos: 3,
    practica: { escenario: () => renombrado(escenarioVacio(), tx("Práctica: tutorial básico", "Practice: basic tutorial")), autoSimular: false, centro: [CENTRO.lat, CENTRO.lon, 12] },
    pasos: [
      {
        get titulo() {
          return tx("Tutorial básico", "Basic tutorial");
        },
        get texto() {
          return tx("Vamos a hacer juntos su primera simulación en 7 pasos. Usted hace cada uno en la pantalla y yo le confirmo; si prefiere, toque «Hágalo por mí». Puede omitir cualquier paso o salir cuando quiera. Estamos en un escenario de práctica: al terminar, el suyo vuelve tal cual.", "Let's do your first simulation together in 7 steps. You do each one on the screen and I confirm it; if you prefer, tap “Do it for me”. You can skip any step or leave whenever you like. We're in a practice scenario: when we finish, yours comes back exactly as it was.");
        },
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        get titulo() {
          return tx("Inscriba un nodo antena", "Add an antenna node");
        },
        get texto() {
          return tx("Toque «Agregar» en la barra del mapa y haga clic en cualquier punto del mapa. El nodo antena es la infraestructura en mástil que da cobertura. (También se puede por coordenadas, en el panel Nodos).", "Tap “Add” on the map bar and click anywhere on the map. The antenna node is the mast-mounted infrastructure that provides coverage. (You can also do it by coordinates, in the Nodes panel.)");
        },
        tarea: {
          hecho: (t, base) => deTipo(t.foto(), "antena").length > deTipo(base, "antena").length,
          hacer: (t) => inscribir(t, CENTRO.lat, CENTRO.lon),
        },
      },
      {
        objetivo: ["altura", "lista-antenas"],
        preparar: "antenas",
        get titulo() {
          return tx("Súbale la altura", "Raise its height");
        },
        get texto() {
          return tx("Abra la ficha del nodo con un clic en él (en la lista o en el mapa) y ponga la altura en 20 m. Entre más alto, más lejos llega. Ahí mismo se elige el equipo.", "Open the node's card by clicking it (in the list or on the map) and set the height to 20 m. The higher it is, the farther it reaches. The equipment is chosen right there too.");
        },
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
        get titulo() {
          return tx("Simule", "Simulate");
        },
        get texto() {
          return tx("Toque «Simular»: calculo la cobertura sobre el relieve real. Para la práctica apagué «Simular al cambiar»; encendido, recalculo solo cada vez que usted cambia algo.", "Tap “Simulate”: I calculate the coverage over the real terrain. For the practice I turned off “Simulate on change”; when it's on, I recalculate automatically every time you change something.");
        },
        asegurar: asegurarAntena,
        tarea: { hecho: (t) => antenas(t.foto()).length > 0 && t.alDia(), hacer: (t) => t.melki.simular() },
      },
      {
        objetivo: "leyenda",
        preparar: "mapa",
        get titulo() {
          return tx("Lea los colores", "Read the colors");
        },
        get texto() {
          return tx("Cada color es el margen de la señal sobre lo mínimo que necesita el receptor: verde oscuro es buena, amarillo es media, naranja es baja y rojo es sin servicio. La línea naranja marca hasta dónde llega con servicio y la verde, el alcance confiable.", "Each color is the signal margin over the minimum the receiver needs: dark green is good, yellow is fair, orange is weak and red is no service. The orange line marks how far it reaches with service and the green one, the reliable range.");
        },
        asegurar: (t) => {
          t.despachar({ tipo: "auto", valor: true });
          asegurarAntena(t);
          simularSiHaceFalta(t);
        },
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        get titulo() {
          return tx("Mida la señal en un punto", "Measure the signal at a point");
        },
        get texto() {
          return tx("Toque «Medir señal» y haga clic en el mapa, por ejemplo en una zona amarilla. Le digo la señal que llega a ese punto desde cada nodo antena.", "Tap “Measure signal” and click on the map, for example on a yellow area. I tell you the signal that reaches that point from each antenna node.");
        },
        asegurar: asegurarAntena,
        tarea: { hecho: senalMedida, hacer: medirSenal },
      },
      {
        objetivo: "factibilidad",
        preparar: "resultados",
        get titulo() {
          return tx("¿Es factible?", "Is it feasible?");
        },
        get texto() {
          return tx("Aquí le digo si la red funciona: que todos los nodos lleguen a la pasarela, los saltos, la calidad de los enlaces y la cobertura confiable, con recomendaciones. Con un solo nodo antena cuenta la cobertura; para una red, sume más nodos (hay un tour para eso).", "Here I tell you whether the network works: that every node reaches the gateway, the hops, the quality of the links and the reliable coverage, with recommendations. With a single antenna node, what counts is the coverage; for a network, add more nodes (there's a tour for that).");
        },
        asegurar: simularSiHaceFalta,
      },
      {
        objetivo: "archivo",
        preparar: "mapa",
        get titulo() {
          return tx("Guarde o exporte", "Save or export");
        },
        get texto() {
          return tx("En «Archivo» guarda el escenario (.json) para retomarlo, los nodos en Excel (.csv) o la cobertura para Google Earth (.kmz). Como esto es una práctica, no hace falta guardar nada ahora; el simulador además guarda su trabajo solo en este navegador.", "In “File” you save the scenario (.json) to pick it up later, the nodes in Excel (.csv) or the coverage for Google Earth (.kmz). Since this is practice, there's no need to save anything now; the simulator also saves your work automatically in this browser.");
        },
      },
    ],
    get final() {
      return tx("Ya sabe lo básico: inscribir un nodo, ajustarlo, simular, leer los colores, medir la señal y ver si es factible.", "Now you know the basics: adding a node, adjusting it, simulating, reading the colors, measuring the signal and seeing whether it's feasible.");
    },
  },
  {
    id: "sembrar",
    get nombre() {
      return tx("Sembrar la malla", "Seed the mesh");
    },
    get detalle() {
      return tx("Gateway, repetidores y gente, como en Trama, y un mensaje de prueba.", "Gateway, repeaters and people, as in Trama, and a test message.");
    },
    minutos: 4,
    modo: "sembrar",
    practica: { escenario: () => renombrado(escenarioVacio(), tx("Práctica: sembrar la malla", "Practice: seed the mesh")), autoSimular: true, centro: [CENTRO.lat, CENTRO.lon + 0.12, 10] },
    pasos: [
      {
        get titulo() {
          return tx("Sembrar la malla", "Seed the mesh");
        },
        get texto() {
          return tx("Vamos a armar una red como en Trama: primero el Gateway + Internet, después los repetidores según la distancia y al final la gente. Yo calculo con el relieve real quién queda conectado. Estamos en un escenario de práctica: al terminar, el suyo vuelve tal cual.", "Let's build a network as in Trama: first the Gateway + Internet, then the repeaters according to the distance, and finally the people. Over the real terrain I calculate who ends up connected. We're in a practice scenario: when we finish, yours comes back exactly as it was.");
        },
      },
      {
        objetivo: "modo",
        get titulo() {
          return tx("Dos modos", "Two modes");
        },
        get texto() {
          return tx("Aquí cambia entre «Sembrar la malla», el modo sencillo y guiado, y el «Modo avanzado», con la lista de nodos, todos los parámetros y las herramientas. En el celular, use la pestaña «Sembrar» de abajo.", "Here you switch between “Seed the mesh”, the simple guided mode, and “Advanced mode”, with the list of nodes, all the parameters and the tools. On a phone, use the “Seed” tab at the bottom.");
        },
      },
      {
        objetivo: ["piezas", "pieza-mapa"],
        preparar: "sembrar",
        get titulo() {
          return tx("1 · El Gateway + Internet", "1 · The Gateway + Internet");
        },
        get texto() {
          return tx("Toque «Gateway + Internet» y luego el mapa, en el sitio donde entra el internet: la casa o la finca con Starlink. De ahí sale la malla.", "Tap “Gateway + Internet” and then the map, at the site where the internet comes in: the house or the farm with Starlink. The mesh grows from there.");
        },
        tarea: {
          hecho: (t, base) => piezas(t.foto(), "gateway").length > piezas(base, "gateway").length,
          hacer: (t) => t.melki.ponerPieza("gateway", CENTRO.lat, CENTRO.lon),
        },
      },
      {
        objetivo: ["piezas", "pieza-mapa"],
        preparar: "sembrar",
        get titulo() {
          return tx("2 · Un repetidor", "2 · A repeater");
        },
        get texto() {
          return tx("Toque «Repetidor» y póngalo a unos 8 a 10 km del gateway, por ejemplo hacia el oriente (los anillos blancos marcan las distancias). Debe alcanzar al gateway: si queda en naranja, acérquelo.", "Tap “Repeater” and place it about 8 to 10 km from the gateway, for example to the east (the white rings mark the distances). It must reach the gateway: if it turns orange, move it closer.");
        },
        asegurar: asegurarGateway,
        tarea: {
          hecho: (t, base) => piezas(t.foto(), "repetidor").length > piezas(base, "repetidor").length,
          hacer: (t) => {
            const g = gatewayDe(t) ?? CENTRO;
            const p = desplazar(g.lat, g.lon, 9000, 80);
            t.melki.ponerPieza("repetidor", p.lat, p.lon);
          },
        },
      },
      {
        objetivo: ["piezas", "pieza-mapa"],
        preparar: "sembrar",
        get titulo() {
          return tx("3 · La gente", "3 · The people");
        },
        get texto() {
          return tx("Toque «Persona» y ponga dos: una cerca del repetidor y otra lejos, a unos 25 a 30 km del gateway. Verde es conectada al gateway (el número son los saltos); rojo, sin cobertura.", "Tap “Person” and place two: one near the repeater and another far away, about 25 to 30 km from the gateway. Green means connected to the gateway (the number is the hops); red, no coverage.");
        },
        asegurar: asegurarGateway,
        tarea: {
          hecho: (t, base) => piezas(t.foto(), "persona").length >= piezas(base, "persona").length + 2,
          hacer: (t) => {
            const g = gatewayDe(t) ?? CENTRO;
            const cerca = desplazar(g.lat, g.lon, 11500, 95);
            const lejos = desplazar(g.lat, g.lon, 30000, 70);
            t.melki.ponerPieza("persona", cerca.lat, cerca.lon);
            t.melki.ponerPieza("persona", lejos.lat, lejos.lon);
          },
        },
      },
      {
        objetivo: "estado-red",
        preparar: "sembrar",
        get titulo() {
          return tx("Estado de la red", "Network status");
        },
        get texto() {
          return tx("Aquí ve cuántas personas quedan conectadas, cuántas sin cobertura, los km² cubiertos por la red conectada y los saltos. Arriba, el recuadro le dice qué hacer a continuación.", "Here you see how many people are connected, how many have no coverage, the km² covered by the connected network and the hops. Above, the box tells you what to do next.");
        },
        tarea: { hecho: (t) => t.alDia(), hacer: (t) => t.melki.simular(), get aviso() { return tx("Listo: la red ya está calculada.", "Done: the network is calculated."); } },
      },
      {
        objetivo: "sembrar-auto",
        preparar: "sembrar",
        get titulo() {
          return tx("Conectar a los que faltan", "Connect the missing ones");
        },
        get texto() {
          return tx("Toque «Conectar a los que faltan»: busco con el relieve real las lomas donde un repetidor alcanza a la persona en rojo y se las propongo en el mapa como torres naranjas punteadas.", "Tap “Connect the missing ones”: over the real terrain I look for the hills where a repeater reaches the person in red and propose them to you on the map as dotted orange towers.");
        },
        tarea: {
          hecho: (t) => ["propuesta", "puesta"].includes(t.foto().siembra),
          hacer: sembrarFaltantes,
          get aviso() {
            return tx("Ahí está la propuesta.", "There's the proposal.");
          },
        },
      },
      {
        objetivo: ["propuesta", "sembrar-auto"],
        preparar: "sembrar",
        get titulo() {
          return tx("Póngalos", "Place them");
        },
        get texto() {
          return tx("Revise la propuesta (dónde queda cada repetidor y con cuántos dB) y toque «Poner». La red se recalcula sola; si se arrepiente, «Deshacer» los quita.", "Review the proposal (where each repeater goes and with how many dB) and tap “Place”. The network recalculates by itself; if you change your mind, “Undo” removes them.");
        },
        tarea: {
          hecho: (t) => t.foto().siembra === "puesta",
          hacer: (t) => cuandoSePueda(() => t.melki.propuesta() !== null, () => t.melki.aceptarSiembra()),
        },
      },
      {
        objetivo: "mapa",
        preparar: "mapa",
        get titulo() {
          return tx("El flujo de la malla", "The mesh flow");
        },
        get texto() {
          return tx("Mire el mapa: la información viaja por las líneas turquesa hacia el gateway. Cada pulso sale de una persona y salta de nodo en nodo; el que lo retransmite destella (casi siempre el repetidor más cercano con buen enlace) y la nube «IA» del gateway se enciende al recibirlo. En rojo y parpadeando, quien no tiene cobertura.", "Look at the map: the information travels along the turquoise lines toward the gateway. Each pulse leaves from a person and hops from node to node; the one that retransmits it flashes (almost always the nearest repeater with a good link) and the gateway's “AI” cloud lights up when it receives it. Blinking in red: whoever has no coverage.");
        },
        asegurar: encuadrarMalla,
      },
      {
        objetivo: "enviar-mensaje",
        preparar: "sembrar",
        get titulo() {
          return tx("Envíe un mensaje de prueba", "Send a test message");
        },
        get texto() {
          return tx("Toque «Enviar»: un mensaje del tamaño de un pago (la orden firmada, 118 bytes) sale de la persona más lejana y lo pasan los repetidores hasta el gateway, como en MeshCore; un WhatsApp o una consulta a la IA viajan igual. Le digo los saltos, el tiempo y qué tan seguro llega; la respuesta vuelve por la misma ruta.", "Tap “Send”: a message the size of a payment (the signed order, 118 bytes) leaves from the farthest person and the repeaters pass it on to the gateway, as in MeshCore; a WhatsApp message or an AI question travels the same way. I tell you the hops, the time and how reliably it arrives; the reply comes back along the same route.");
        },
        tarea: { hecho: (t, base) => t.foto().mensaje > base.mensaje, hacer: enviarDePrueba },
      },
      {
        objetivo: "melki",
        get titulo() {
          return tx("Pregúnteme", "Ask me");
        },
        get texto() {
          return tx("Pregúnteme «¿cómo viaja un mensaje?», «¿por qué Persona 2 está en rojo?» o «¿qué hago ahora?», o pídame «pon un repetidor en 4.25, -73.30 a 12 m», «lleva la red a Paratebueno» o «puebla la zona con 250 personas».", "Ask me “how does a message travel?”, “why is Person 2 red?” or “what should I do next?”, or ask me to “put a repeater at 4.25, -73.30 at 12 m”, “take the network to Paratebueno” or “populate the area with 250 people”.");
        },
      },
    ],
    get final() {
      return tx("Ya sabe sembrar la malla: el gateway, los repetidores, la gente, conectar a los que faltan y probar un mensaje.", "Now you know how to seed the mesh: the gateway, the repeaters, the people, connecting the missing ones and testing a message.");
    },
  },
  {
    id: "capacidad",
    get nombre() {
      return tx("¿Cuánto tráfico aguanta?", "How much traffic can it handle?");
    },
    get detalle() {
      return tx("Poblar personas, pagos y mensajes al tiempo, zonas de popularidad y la hora pico hasta que la red se reviente.", "Populate people, payments and messages at once, popularity zones and peak hour until the network gets overloaded.");
    },
    minutos: 4,
    modo: "sembrar",
    practica: { escenario: () => renombrado(escenarioMalla(), tx("Práctica: capacidad de la red", "Practice: network capacity")), autoSimular: true },
    pasos: [
      {
        get titulo() {
          return tx("La red con la gente de verdad", "The network with real people");
        },
        get texto() {
          return tx("Una red puede cubrir todo y aun así no aguantar la hora pico del mercado. Por ella van pagos, mensajes de WhatsApp y consultas a la IA, y todos comparten el mismo canal. Vamos a llenar la zona de gente y a mandar mensajes al tiempo, paquete por paquete como lo hace MeshCore, hasta ver dónde se revienta. Estamos en un escenario de práctica.", "A network can cover everything and still not handle the market's peak hour. It carries payments, WhatsApp messages and AI questions, and they all share the same channel. We're going to fill the area with people and send messages at once, packet by packet as MeshCore does, until we see where it gets overloaded. We're in a practice scenario.");
        },
      },
      {
        objetivo: "poblar",
        preparar: "resultados",
        get titulo() {
          return tx("1 · Poblar personas", "1 · Populate people");
        },
        get texto() {
          return tx("Elija cuántas (o la densidad de la zona: 0,2 por km² dispersa, 1 media, 5 densa, como en el documento de Trama) y toque «Poblar». Las reparto al azar sobre el terreno, cada una con su billetera a 1,5 m.", "Choose how many (or the area's density: 0.2 per km² sparse, 1 medium, 5 dense, as in Trama's document) and tap “Populate”. I spread them at random over the terrain, each with their wallet at 1.5 m.");
        },
        tarea: {
          hecho: (t, base) => pobladas(t.foto()) > pobladas(base),
          hacer: (t) => void t.melki.poblar({ n: 250, semilla: 7 }),
          get aviso() {
            return tx("Listo: ya están repartidas.", "Done: they're spread out.");
          },
        },
      },
      {
        objetivo: ["resumen-pobladas", "nodos-campo"],
        preparar: "resultados",
        get titulo() {
          return tx("¿Cuántas quedaron conectadas?", "How many ended up connected?");
        },
        get texto() {
          return tx("Al simular le digo cuántas llegan al gateway, a cuántos saltos y cuántas quedan sin cobertura (en rojo en el mapa). En el mapa son puntos pequeños: tóquelos para ver su nombre.", "When simulating I tell you how many reach the gateway, at how many hops and how many are left without coverage (red on the map). On the map they're small dots: tap them to see their names.");
        },
        tarea: { hecho: (t) => t.alDia() && pobladas(t.foto()) > 0, hacer: (t) => t.melki.simular(), get aviso() { return tx("Listo: ya calculé quién queda conectado.", "Done: I've worked out who's connected."); } },
      },
      {
        objetivo: "prueba-carga",
        preparar: "resultados",
        get titulo() {
          return tx("2 · Mensajes al tiempo", "2 · Messages at once");
        },
        get texto() {
          return tx("Elija qué se manda —pagos, o mensajes de texto de WhatsApp y consultas a la IA— y cuántos salen al tiempo (5, 15, 25…), y toque «Probar». Cada pago es la orden (118 B), el comprobante (126 B) y el aviso a quien recibe (126 B), con sus acuses: con SF11 ocupa ~9,5 s de aire.", "Choose what's sent —payments, or WhatsApp text messages and AI questions— and how many go out at once (5, 15, 25…), and tap “Test”. Each payment is the order (118 B), the receipt (126 B) and the notice to the recipient (126 B), with their acknowledgments: with SF11 it takes ~9.5 s of airtime.");
        },
        tarea: {
          hecho: (t, base) => ["listo", "curva"].includes(t.foto().carga) && t.foto().carga !== base.carga,
          hacer: (t) => void t.melki.probarCarga({ mensajes: 15 }),
          get aviso() {
            return tx("Ahí está el resultado.", "There's the result.");
          },
        },
      },
      {
        objetivo: ["resultado-carga", "prueba-carga"],
        preparar: "resultados",
        get titulo() {
          return tx("3 · ¿Hasta cuántos aguanta?", "3 · How many can it handle?");
        },
        get texto() {
          return tx("Toque «¿Hasta cuántos aguanta?»: subo la cantidad hasta que menos del 90 % recibe su respuesta. Verde aguanta sin demora, naranja aguanta pero lento (el 95 % tarda más de un minuto) y rojo ya se reventó.", "Tap “How many can it handle?”: I raise the amount until fewer than 90% get their reply. Green handles it without delay, orange handles it but slowly (95% take more than a minute) and red is already overloaded.");
        },
        tarea: {
          hecho: (t) => t.foto().carga === "curva",
          hacer: (t) => void t.melki.probarCarga({}, true),
          get aviso() {
            return tx("Ahí está la curva.", "There's the curve.");
          },
        },
      },
      {
        objetivo: "zonas-popularidad",
        preparar: "resultados",
        get titulo() {
          return tx("4 · Zonas de popularidad", "4 · Popularity zones");
        },
        get texto() {
          return tx("Ahora gente alrededor de cada repetidor y del gateway (o solo de uno: también sale al tocar el repetidor en el mapa). Escriba cuántas personas quiera por zona y a cuántos km, y toque «Poner». En cada punto, «Poner y probar» simula de una vez la hora pico y «¿Cuántas aguanta?» busca su límite.", "Now people around each repeater and the gateway (or just one: it also appears when you tap the repeater on the map). Type how many people you want per zone and within how many km, and tap “Place”. At each point, “Place and test” simulates peak hour right away and “How many can it handle?” looks for its limit.");
        },
        tarea: {
          hecho: (t, base) => enZonas(t.foto()) > enZonas(base),
          hacer: (t) => void t.melki.poblarZonas({ n: 150, radioKm: 2, semilla: 7 }),
          get aviso() {
            return tx("Listo: ya está la gente en cada zona.", "Done: the people are in each zone.");
          },
        },
      },
      {
        objetivo: "prueba-estres",
        preparar: "resultados",
        get titulo() {
          return tx("5 · La hora pico, zona por zona", "5 · Peak hour, zone by zone");
        },
        get texto() {
          return tx("Toque «¿Hasta dónde aguanta cada repetidor?»: cada persona manda sus mensajes del día (pagos, WhatsApp y consultas a la IA) y una parte cae en la hora pico. Mido cada zona (mensajes completos, espera, canal, cuánto transmite, alcance con carga y energía) y subo la carga hasta que cada una se revienta.", "Tap “How far can each repeater hold up?”: each person sends their messages for the day (payments, WhatsApp and AI questions) and part of them falls in the peak hour. I measure each zone (completed messages, wait, channel, how much it transmits, range under load and energy) and raise the load until each one gets overloaded.");
        },
        tarea: {
          hecho: (t) => t.foto().estres === "rampa",
          hacer: (t) => void t.melki.probarEstres({ rampa: true }),
          get aviso() {
            return tx("Ahí está: zona por zona y hasta dónde aguanta.", "There it is: zone by zone, and how far it holds up.");
          },
        },
      },
      {
        objetivo: ["resultado-estres", "prueba-estres"],
        preparar: "resultados",
        get titulo() {
          return tx("Cómo leerlo", "How to read it");
        },
        get texto() {
          return tx("Trama diseña cada frecuencia para 55 pagos por hora con SF11 (el canal al 15 % en la hora pico): 150 usuarios por frecuencia y 600 por sitio de 4 radios, y esa capacidad la comparten con los WhatsApp y las consultas a la IA. En el mapa cada zona queda verde (aguanta), naranja (lenta) o roja (se revienta). La curva muestra cuántos mensajes por hora entrega la red: sube hasta el máximo del canal y después cae. Si se revienta, reparta los repetidores en las 4 frecuencias, baje a SF10 o SF9 (más mensajes, menos alcance) o ponga más sitios gateway.", "Trama designs each frequency for 55 payments per hour with SF11 (the channel at 15% at peak hour): 150 users per frequency and 600 per 4-radio site, and that capacity is shared with the WhatsApp messages and AI questions. On the map each zone turns green (holds up), orange (slow) or red (overloaded). The curve shows how many messages per hour the network delivers: it rises to the channel's maximum and then drops. If it gets overloaded, spread the repeaters over the 4 frequencies, go down to SF10 or SF9 (more messages, less range) or add more gateway sites.");
        },
      },
    ],
    get final() {
      return tx("Ya sabe probar la capacidad: poblar la zona, mandar pagos y mensajes al tiempo, poner zonas de popularidad y ver hasta dónde aguanta cada repetidor en la hora pico.", "Now you know how to test the capacity: populate the area, send payments and messages at once, place popularity zones and see how far each repeater holds up at peak hour.");
    },
  },
  {
    id: "pantalla",
    get nombre() {
      return tx("Conocer la pantalla", "Get to know the screen");
    },
    get detalle() {
      return tx("Para qué sirve cada parte, sin tocar nada.", "What each part is for, without touching anything.");
    },
    minutos: 2,
    pasos: PASOS_PANTALLA,
    get final() {
      return tx("Esa es la pantalla completa. Cuando quiera, practique con el tutorial básico.", "That's the whole screen. Whenever you like, practice with the basic tutorial.");
    },
  },
  {
    id: "mesh",
    get nombre() {
      return tx("Red mesh completa", "Complete mesh network");
    },
    get detalle() {
      return tx("Varios nodos, pasarela, saltos y si la red funciona.", "Several nodes, gateway, hops and whether the network works.");
    },
    minutos: 4,
    practica: { escenario: () => renombrado(escenarioEjemplo(), tx("Práctica: red mesh", "Practice: mesh network")), autoSimular: true },
    pasos: [
      {
        get titulo() {
          return tx("Red mesh completa", "Complete mesh network");
        },
        get texto() {
          return tx("En una red mesh los mensajes saltan de nodo en nodo hasta la pasarela, la que conecta con internet. Partimos del nodo antena «Ejemplo», que ya es la pasarela; vamos a sumar nodos y ver si la red funciona. Estamos en un escenario de práctica.", "In a mesh network, messages hop from node to node up to the gateway, the one that connects to the internet. We start from the example antenna node, which is already the gateway; we'll add nodes and see whether the network works. We're in a practice scenario.");
        },
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        get titulo() {
          return tx("Un segundo nodo antena", "A second antenna node");
        },
        get texto() {
          return tx("Toque «Agregar», deje «Nodo antena» y haga clic a unos 6 km del Ejemplo (los anillos marcan las distancias). Así la red cubre más terreno.", "Tap “Add”, keep “Antenna node” and click about 6 km from the example node (the rings mark the distances). That way the network covers more ground.");
        },
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
        get titulo() {
          return tx("Un nodo de campo", "A field node");
        },
        get texto() {
          return tx("Ahora el radio que lleva una persona o un sensor: toque «Agregar», cambie a «Nodo» y haga clic en el mapa, dentro de la zona con color.", "Now the radio a person or a sensor carries: tap “Add”, switch to “Node” and click on the map, inside the colored area.");
        },
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
        get titulo() {
          return tx("La pasarela", "The gateway");
        },
        get texto() {
          return tx("La pasarela, marcada en la lista, es la puerta de salida de la red. Cualquier nodo antena puede serlo: se elige en su ficha. Los demás nodos deben llegar a ella, directo o saltando por otros.", "The gateway, marked in the list, is the network's way out. Any antenna node can be it: you choose it in its card. The other nodes must reach it, directly or by hopping through others.");
        },
      },
      {
        objetivo: "enlaces",
        preparar: "resultados",
        get titulo() {
          return tx("La malla", "The mesh");
        },
        get texto() {
          return tx("Cada línea es un enlace entre dos nodos con su margen en dB; desde 20 dB hay servicio. Con «Simular al cambiar» encendido la red se recalcula sola; si no, toque «Simular».", "Each line is a link between two nodes with its margin in dB; from 20 dB there's service. With “Simulate on change” on, the network recalculates by itself; if not, tap “Simulate”.");
        },
        tarea: { hecho: (t) => t.alDia(), hacer: (t) => t.melki.simular(), get aviso() { return tx("Listo: la red ya está calculada.", "Done: the network is calculated."); } },
      },
      {
        objetivo: "modos",
        preparar: "mapa",
        get titulo() {
          return tx("Vea el respaldo", "See the backup");
        },
        get texto() {
          return tx("Cambie el color del mapa a «Respaldo»: muestra cuántos nodos antena llegan a cada punto. Donde llegan dos o más, la red aguanta aunque uno falle.", "Switch the map color to “Backup”: it shows how many antenna nodes reach each point. Where two or more reach, the network holds up even if one fails.");
        },
        tarea: { hecho: (t) => t.foto().estado.vista.modo === "redundancia", hacer: (t) => t.melki.vista({ modo: "redundancia" }) },
      },
      {
        objetivo: "factibilidad",
        preparar: "resultados",
        get titulo() {
          return tx("Saltos y factibilidad", "Hops and feasibility");
        },
        get texto() {
          return tx("Aquí reviso que cada nodo llegue a la pasarela sin pasar el límite de saltos, que los enlaces sean sólidos y que no haya puntos únicos de falla (un nodo que, si se cae, deja aislados a otros). Si algo falla, le doy recomendaciones.", "Here I check that every node reaches the gateway without going over the hop limit, that the links are solid and that there are no single points of failure (a node that, if it goes down, leaves others isolated). If something fails, I give you recommendations.");
        },
        asegurar: simularSiHaceFalta,
      },
      {
        objetivo: "melki",
        get titulo() {
          return tx("Pregúnteme por la red", "Ask me about the network");
        },
        get texto() {
          return tx("Si un nodo no llega, pregúnteme «¿por qué Nodo 1 no llega?» y le digo con quién tiene su mejor enlace y qué hacer: acercarlo, subirlo o poner un repetidor.", "If a node doesn't get through, ask me “why doesn't Node 1 reach the gateway?” and I'll tell you which node it has its best link with and what to do: move it closer, raise it or add a repeater.");
        },
      },
    ],
    get final() {
      return tx("Ya sabe armar una red mesh: nodos antena, nodos de campo, la pasarela, los enlaces, el respaldo y la factibilidad.", "Now you know how to build a mesh network: antenna nodes, field nodes, the gateway, the links, the backup and the feasibility.");
    },
  },
  {
    id: "radiomobile",
    get nombre() {
      return tx("Como Radio Mobile", "Like Radio Mobile");
    },
    get detalle() {
      return tx("Confiabilidad, antena direccional, escala en dBm e informe de radioenlace.", "Reliability, directional antenna, dBm scale and radio link report.");
    },
    minutos: 4,
    practica: { escenario: practicaConDos, autoSimular: true },
    pasos: [
      {
        get titulo() {
          return tx("Como Radio Mobile", "Like Radio Mobile");
        },
        get texto() {
          return tx("Le muestro las funciones que se parecen a Radio Mobile, con dos nodos antena de práctica: la confiabilidad y los parámetros de propagación, una antena direccional, la escala de la señal en dBm y el informe del radioenlace.", "I'll show you the features that resemble Radio Mobile, with two practice antenna nodes: reliability and the propagation parameters, a directional antenna, the signal scale in dBm and the radio link report.");
        },
      },
      {
        objetivo: "propagacion",
        preparar: "parametros",
        get titulo() {
          return tx("Confiabilidad", "Reliability");
        },
        get texto() {
          return tx("En Parámetros, en «Propagación», elija la confiabilidad «Alta»: exijo que la señal se cumpla el 90 % del tiempo y de las situaciones, como al subir esos porcentajes en Radio Mobile. El área con servicio se reduce.", "In Parameters, under “Propagation”, choose “High” reliability: I require the signal to hold 90% of the time and of the situations, like raising those percentages in Radio Mobile. The area with service shrinks.");
        },
        tarea: {
          hecho: (t) => t.foto().estado.escenario.parametros.tiempoPct >= 90,
          hacer: (t) => t.melki.parametrosCambiar({ tiempoPct: 90, ubicacionesPct: 90, situacionesPct: 90 }),
        },
      },
      {
        objetivo: "propagacion",
        preparar: "parametros",
        get titulo() {
          return tx("Modelo y parámetros", "Model and parameters");
        },
        get texto() {
          return tx("El modelo calibrado con las pruebas de campo es el recomendado; también puede usar Longley-Rice puro. En «Parámetros como en Radio Mobile» están el clima, la polarización, el suelo, la refractividad y el modo estadístico.", "The model calibrated with the field tests is the recommended one; you can also use pure Longley-Rice. In “Parameters as in Radio Mobile” you'll find the climate, polarization, ground, refractivity and statistical mode.");
        },
      },
      {
        objetivo: ["patron", "lista-antenas"],
        preparar: "antenas",
        get titulo() {
          return tx("Antena direccional", "Directional antenna");
        },
        get texto() {
          return tx("Abra la ficha de «Antena 2», cambie la antena a Yagi y apúntela hacia el Ejemplo con el azimut. La cobertura se vuelve un haz en esa dirección.", "Open the card for “Antenna 2”, switch the antenna to Yagi and aim it at the example node with the azimuth. The coverage becomes a beam in that direction.");
        },
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
        get titulo() {
          return tx("Escala en dBm", "Scale in dBm");
        },
        get texto() {
          return tx("Abra «Capas» y, al final, en «Escala de la señal», elija dBm. Ahí también están los colores arcoíris y el umbral, como en Radio Mobile.", "Open “Layers” and, at the bottom, in “Signal scale”, choose dBm. The rainbow colors and the threshold are there too, as in Radio Mobile.");
        },
        tarea: {
          hecho: (t) => t.foto().estado.vista.unidad === "dbm",
          hacer: (t) => t.melki.vista({ unidad: "dbm", escala: "arcoiris" }),
        },
      },
      {
        objetivo: ["radioenlace", "lista-antenas"],
        preparar: "antenas",
        get titulo() {
          return tx("Informe de radioenlace", "Radio link report");
        },
        get texto() {
          return tx("En la ficha de un nodo, en «Perfil e informe del enlace hacia», elija el otro y toque «Radioenlace». Verá el perfil con la zona de Fresnel y el balance del enlace, como el Radio Link.", "In a node's card, under “Link profile and report to”, choose the other node and tap “Radio link”. You'll see the profile with the Fresnel zone and the link budget, like Radio Mobile's Radio Link.");
        },
        tarea: {
          hecho: (t) => t.foto().perfil?.informe === true,
          hacer: (t) => {
            const [a, b] = deTipo(t.foto(), "antena");
            if (a && b) t.melki.perfil(a, b, true);
          },
        },
      },
    ],
    get final() {
      return tx("Ya conoce las funciones tipo Radio Mobile: confiabilidad, parámetros de propagación, antenas direccionales, escala en dBm e informe de radioenlace.", "Now you know the Radio Mobile-style features: reliability, propagation parameters, directional antennas, dBm scale and radio link report.");
    },
  },
  {
    id: "medir",
    get nombre() {
      return tx("Medir y exportar", "Measure and export");
    },
    get detalle() {
      return tx("Señal en un punto, regla, perfil del terreno y Google Earth.", "Signal at a point, ruler, terrain profile and Google Earth.");
    },
    minutos: 3,
    practica: { escenario: () => renombrado(escenarioEjemplo(), tx("Práctica: medir y exportar", "Practice: measure and export")), autoSimular: true },
    pasos: [
      {
        get titulo() {
          return tx("Medir y exportar", "Measure and export");
        },
        get texto() {
          return tx("Le muestro cómo consultar la señal en cualquier punto, medir distancias como en Google Earth, ver el relieve de un trayecto y llevar todo a Google Earth. Estamos en un escenario de práctica.", "I'll show you how to check the signal at any point, measure distances as in Google Earth, see the terrain along a path and take everything to Google Earth. We're in a practice scenario.");
        },
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        get titulo() {
          return tx("Señal en un punto", "Signal at a point");
        },
        get texto() {
          return tx("Toque «Medir señal» y haga clic en cualquier punto del mapa: le digo cuánta señal llega desde cada nodo antena y si hay servicio.", "Tap “Measure signal” and click any point on the map: I tell you how much signal arrives from each antenna node and whether there's service.");
        },
        asegurar: simularSiHaceFalta,
        tarea: { hecho: senalMedida, hacer: medirSenal },
      },
      {
        objetivo: "herramientas",
        preparar: "mapa",
        get titulo() {
          return tx("La regla", "The ruler");
        },
        get texto() {
          return tx("Toque «Regla» y haga clic en dos o más puntos del mapa; doble clic para terminar. Mide distancias, trayectos y áreas, y las guarda en la lista de mediciones.", "Tap “Ruler” and click two or more points on the map; double-click to finish. It measures distances, paths and areas, and saves them in the list of measurements.");
        },
        tarea: {
          hecho: (t, base) => t.foto().estado.escenario.mediciones.length > base.estado.escenario.mediciones.length,
          hacer: (t) => {
            const a = primera(t);
            const ini = desplazar(a?.lat ?? CENTRO.lat, a?.lon ?? CENTRO.lon, 1500, 250);
            const fin = desplazar(a?.lat ?? CENTRO.lat, a?.lon ?? CENTRO.lon, 4500, 70);
            t.melki.herramienta("regla");
            t.melki.medir({ id: `m${Date.now().toString(36)}`, nombre: tx("Trayecto de práctica", "Practice path"), tipo: "trayecto", puntos: [[ini.lon, ini.lat], [fin.lon, fin.lat]], visible: true });
          },
        },
      },
      {
        objetivo: "regla",
        get titulo() {
          return tx("Perfil del terreno", "Terrain profile");
        },
        get texto() {
          return tx("En la lista de mediciones toque el ícono de perfil: ve el relieve a lo largo del trayecto, con la distancia y las alturas.", "In the list of measurements, tap the profile icon: you see the terrain along the path, with the distance and the elevations.");
        },
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
        get titulo() {
          return tx("A Google Earth", "To Google Earth");
        },
        get texto() {
          return tx("Abra «Archivo»: «Cobertura para Google Earth (.kmz)» lleva la señal, los nodos, los enlaces, el alcance y sus mediciones; «Nodos en Excel» saca la tabla. No hace falta descargar nada ahora.", "Open “File”: “Coverage for Google Earth (.kmz)” takes the signal, the nodes, the links, the range and your measurements; “Nodes in Excel” exports the table. There's no need to download anything now.");
        },
        tarea: {
          hecho: () => elemento('[data-tour="archivo"][aria-expanded="true"]') !== null,
          hacer: () => elemento('[data-tour="archivo"]')?.click(),
        },
      },
    ],
    get final() {
      return tx("Ya sabe medir la señal en un punto, usar la regla, ver el perfil del terreno y exportar a Google Earth.", "Now you know how to measure the signal at a point, use the ruler, see the terrain profile and export to Google Earth.");
    },
  },
  {
    id: "melki",
    get nombre() {
      return tx("Hablar con Melki", "Talk to Melki");
    },
    get detalle() {
      return tx("Pedirme cosas con sus palabras (hasta una red completa), dictarme por voz y deshacer.", "Ask me for things in your own words (even a whole network), dictate to me by voice and undo.");
    },
    minutos: 2,
    practica: { escenario: () => renombrado(escenarioEjemplo(), tx("Práctica: hablar con Melki", "Practice: talk to Melki")), autoSimular: true },
    pasos: [
      {
        get titulo() {
          return tx("Hablar con Melki", "Talk to Melki");
        },
        get texto() {
          return tx("Puedo hacer cosas por usted si me las pide con sus palabras, escritas o dictadas: inscribir nodos, moverlos, medir, cambiar parámetros y explicarle los resultados. Estamos en un escenario de práctica.", "I can do things for you if you ask me in your own words, written or dictated: add nodes, move them, measure, change parameters and explain the results to you. We're in a practice scenario.");
        },
      },
      {
        objetivo: "melki",
        lado: "izquierda",
        get titulo() {
          return tx("Ábrame", "Open me");
        },
        get texto() {
          return tx("Toque mi botón, abajo a la derecha, para abrir la conversación.", "Tap my button, at the bottom right, to open the conversation.");
        },
        // La conversación abierta: por su etiqueta de siempre o por su data-tour (la etiqueta cambia con el idioma)
        tarea: { hecho: () => elemento('[aria-label="Conversación con Melki"], [data-tour="melki-chat"]') !== null, hacer: () => avisarMelki("abrir") },
      },
      {
        objetivo: "melki-entrada",
        lado: "izquierda",
        get titulo() {
          return tx("Pídame un nodo", "Ask me for a node");
        },
        get texto() {
          return tx("Escriba «inscribe un nodo antena en 4.23 -73.33» y envíelo con Enter. Acepto coordenadas en grados decimales o en grados, minutos y segundos.", "Type “add an antenna node at 4.23 -73.33” and send it with Enter. I accept coordinates in decimal degrees or in degrees, minutes and seconds.");
        },
        asegurar: () => avisarMelki("abrir"),
        tarea: {
          hecho: (t, base) => antenas(t.foto()).length > antenas(base).length,
          hacer: () => avisarMelki("pedir", tx("Inscribe un nodo antena en 4.23 -73.33", "Add an antenna node at 4.23 -73.33")),
        },
      },
      {
        objetivo: "microfono",
        lado: "izquierda",
        get titulo() {
          return tx("Dícteme", "Dictate to me");
        },
        get texto() {
          return tx("También puede tocar el micrófono y hablarme: lo que dice aparece en la caja para revisarlo y corregirlo, y solo se envía cuando usted quiera. Puede dictar con el navegador o en modo privado, sin internet. Y con el «Asistente Melki» le escucho sin tocar nada: diga «Hola Melki» y su pedido (lo enseño en el tour «Asistente Melki por voz»).", "You can also tap the microphone and talk to me: what you say appears in the box so you can review and correct it, and it's only sent when you want. You can dictate with the browser or in private mode, without internet. And with the “Melki Assistant” I listen to you without you touching anything: say “Hey Melki” and your request (I teach it in the “Melki Assistant by voice” tour).");
        },
        asegurar: () => avisarMelki("abrir"),
      },
      {
        objetivo: "melki-chat",
        lado: "izquierda",
        get titulo() {
          return tx("Deshaga", "Undo");
        },
        get texto() {
          return tx("Todo lo que hago se puede deshacer: toque «Deshacer» en mi respuesta o escríbame «deshaz».", "Everything I do can be undone: tap “Undo” in my answer or write “undo” to me.");
        },
        asegurar: () => avisarMelki("abrir"),
        tarea: {
          hecho: (t, base) => antenas(t.foto()).length < antenas(base).length,
          hacer: () => avisarMelki("pedir", tx("Deshaz", "Undo")),
        },
      },
      {
        objetivo: "melki-chat",
        lado: "izquierda",
        get titulo() {
          return tx("Pregúnteme lo que quiera", "Ask me anything");
        },
        get texto() {
          return tx("Por ejemplo: «¿es factible la red?», «¿qué significa el amarillo?», «llévame a Villavicencio», «mide la distancia entre Ejemplo y Antena 2» o «pon la confiabilidad alta».", "For example: “is the network feasible?”, “what does yellow mean?”, “take me to Villavicencio”, “measure the distance between Example and Antenna 2” or “set high reliability”.");
        },
        asegurar: () => avisarMelki("abrir"),
      },
      {
        objetivo: "melki-chat",
        lado: "izquierda",
        get titulo() {
          return tx("Pídame una red completa", "Ask me for a whole network");
        },
        get texto() {
          return tx("Dígame el área y la meta, y la diseño yo con el relieve real: «ármame una malla que cubra 1.000 hectáreas con señal media o mejor en el 99 %». También entiendo varias órdenes en un mensaje («pon un repetidor a 5 km al norte de Ejemplo y simula»), lugares («en Cumaral») y órdenes en lote («sube todos los repetidores a 20 m»).", "Tell me the area and the goal, and I'll design it over the real terrain: “build me a mesh that covers 1,000 hectares with fair signal or better over 99%”. I also understand several orders in one message (“put a repeater 5 km north of Example and simulate”), places (“in Cumaral”) and batch orders (“raise all the repeaters to 20 m”).");
        },
        asegurar: () => avisarMelki("abrir"),
      },
    ],
    get final() {
      return tx("Ya sabe pedirme cosas por escrito o por voz, hasta una red completa, y deshacerlas. Aquí sigo cuando me necesite.", "Now you know how to ask me for things in writing or by voice, even a whole network, and how to undo them. I'm here whenever you need me.");
    },
  },
  {
    id: "voz",
    get nombre() {
      return tx("Asistente Melki por voz", "Melki Assistant by voice");
    },
    get detalle() {
      return tx("Hablarme sin tocar nada: «Hola Melki» y su pedido, conversar, el mapa libre con mis sugerencias y la mayor cobertura posible.", "Talk to me without touching anything: “Hey Melki” and your request, conversing, the clear map with my suggestions and the greatest possible coverage.");
    },
    minutos: 3,
    modo: "sembrar",
    practica: { escenario: () => renombrado(escenarioMalla(), tx("Práctica: Asistente Melki", "Practice: Melki Assistant")), autoSimular: true },
    pasos: [
      {
        get titulo() {
          return tx("El Asistente Melki", "The Melki Assistant");
        },
        get texto() {
          return tx("Puedo escucharle todo el tiempo, como un asistente de voz: usted me llama por mi nombre y me da la orden, yo la hago y le dejo la respuesta escrita, a su servicio (no hablo en voz alta, salvo que me diga «háblame»). Así puede trabajar con las manos libres y solo el mapa. Estamos en un escenario de práctica.", "I can listen to you all the time, like a voice assistant: you call me by my name and give me the order, I carry it out and leave you the answer in writing, at your service (I don't speak out loud unless you tell me “talk to me”). That way you can work hands-free, with just the map. We're in a practice scenario.");
        },
      },
      {
        objetivo: "manos-libres",
        get titulo() {
          return tx("Active el asistente", "Turn on the assistant");
        },
        get texto() {
          return tx("Toque «Asistente Melki» en la barra de arriba (o escríbame «activa el asistente»). La primera vez el navegador le pide permiso para usar el micrófono: permítalo. Funciona mejor en Edge o Chrome.", "Tap “Melki Assistant” in the top bar (or write to me “turn on the assistant”). The first time, the browser asks your permission to use the microphone: allow it. It works best in Edge or Chrome.");
        },
        tarea: {
          hecho: () => elemento('[data-tour="manos-libres"][aria-pressed="true"]') !== null,
          hacer: () => elemento('[data-tour="manos-libres"][aria-pressed="false"]')?.click(),
          get aviso() {
            return tx("¡Listo! Ya le escucho.", "Done! I'm listening.");
          },
        },
      },
      {
        objetivo: ["hud-voz", "manos-libres"],
        get titulo() {
          return tx("Llámeme por mi nombre", "Call me by my name");
        },
        get texto() {
          return tx("Diga «Hola Melki» y su pedido, de corrido: «Hola Melki, ¿cómo está la red?» o «Oye Melki, conecta a los que faltan». También entiendo «Hey Melki» y «Hello Melki», y si solo dice «Hola Melki» le contesto «Hola, mi señor. Le escucho». Sin mi nombre no hago nada, por si alguien habla cerca. En esta barra ve lo que le entiendo y lo que le contesto.", "Say “Hey Melki” and your request, in one go: “Hey Melki, how is the network doing?” or “Hello Melki, connect the missing ones”. I also understand “Hola Melki” and “Oye Melki”, and if you only say “Hey Melki” I answer “Hello, sir. I'm listening”. Without my name I do nothing, in case someone is talking nearby. In this bar you see what I understand and what I answer.");
        },
      },
      {
        objetivo: ["hud-voz", "manos-libres"],
        get titulo() {
          return tx("Converse sin repetir mi nombre", "Converse without repeating my name");
        },
        get texto() {
          return tx("Después de responder me quedo atento unos segundos: siga hablando sin decir «Melki». Para usar mis botones diga «sí, hazlo» o «la segunda»; «repite» y «más detalle» para ver todo; «para» quita lo que estoy mostrando y «deshaz» revierte lo último. Los números y las coordenadas se pueden decir en palabras.", "After answering I stay alert for a few seconds: keep talking without saying “Melki”. To use my buttons say “yes, do it” or “the second one”; “repeat” and “more detail” to see everything; “stop” removes what I'm showing and “undo” reverts the last thing. Numbers and coordinates can be said in words.");
        },
      },
      {
        objetivo: ["hud-sugerencias", "hud-voz"],
        get titulo() {
          return tx("El mapa libre y mis sugerencias", "The clear map and my suggestions");
        },
        get texto() {
          return tx("Al activarme oculto el panel de herramientas y el de resultados para dejarle el mapa libre. Cuando un resultado se vea mejor en un panel, le pregunto si se lo muestro («sí» lo abre); también están estos botones y «muestra los resultados», «muestra los paneles» o «pantalla limpia». Al apagarme, los paneles vuelven.", "When I turn on, I hide the tools panel and the results panel to leave the map clear for you. When a result looks better in a panel, I ask whether to show it to you (“yes” opens it); you also have these buttons and “show the results”, “show the panels” or “clear screen”. When I turn off, the panels come back.");
        },
      },
      {
        objetivo: ["hud-voz", "manos-libres"],
        get titulo() {
          return tx("La mayor cobertura posible", "The greatest possible coverage");
        },
        get texto() {
          return tx("Pregúnteme «¿cómo dejo la mayor cobertura posible?» y le doy las recomendaciones para esta red: los sitios altos primero, la línea de vista, repartir la malla con respaldo, el gateway al centro y la radio. Si me dice «ajústamelo para la mayor cobertura posible», comparo lomas, alturas, antenas y repetidores de apoyo y le propongo la opción de máxima cobertura con su costo.", "Ask me “how do I get the greatest possible coverage?” and I'll give you the recommendations for this network: high sites first, line of sight, spreading the mesh with backup, the gateway in the middle and the radio. If you tell me “adjust it for the greatest possible coverage”, I compare hills, heights, antennas and support repeaters and propose the maximum coverage option with its cost.");
        },
      },
      {
        objetivo: ["hud-voz", "manos-libres"],
        get titulo() {
          return tx("Para terminar", "To finish");
        },
        get texto() {
          return tx("Diga «Melki, deja de escuchar» o toque la X de esta barra: quedo en reposo, atento solo a mi nombre, y con «Hey Melki» vuelvo sin tocar nada; «apaga el micrófono» me apaga del todo. La barra se arrastra a donde no estorbe y se achica sola mientras espero. En Ajustes de voz elige cómo le hablo, la voz, si le escucho siempre en reposo y si me activo solo al abrir el simulador. Consejos: hable de corrido justo después de mi nombre, con el micrófono cerca; con parlantes a todo volumen, baje un poco el volumen o use audífonos para que no me oiga a mí mismo.", "Say “Melki, stop listening” or tap the X on this bar: I go on standby, alert only to my name, and with “Hey Melki” I come back without you touching anything; “turn off the microphone” switches me off completely. The bar can be dragged to wherever it's not in the way and it shrinks by itself while I wait. In Voice settings you choose how I address you, the voice, whether I always listen on standby and whether I turn on by myself when the simulator opens. Tips: speak in one go right after my name, with the microphone close; with speakers at full volume, turn the volume down a little or use headphones so I don't hear myself.");
        },
      },
    ],
    get final() {
      return tx("Ya sabe trabajar conmigo por voz: llamarme por mi nombre, conversar sin repetirlo, usar mis botones con «sí, hazlo», trabajar con el mapa libre y pedirme la mayor cobertura posible. A su servicio.", "Now you know how to work with me by voice: call me by my name, converse without repeating it, use my buttons with “yes, do it”, work with a clear map and ask me for the greatest possible coverage. At your service.");
    },
  },
];

export const tourPorId = (id: IdTour) => TOURS.find((t) => t.id === id) ?? TOURS[0];

/** Pasos con tarea de un tour (para contarlos en el menú y en las pruebas). */
export const pasosPracticos = (t: Tour) => t.pasos.filter((p) => p.tarea).length;
