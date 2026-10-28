// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Tours guiados de Melki. Cada tour es una lista de pasos: los de explicación resaltan una parte de la pantalla;
// los prácticos piden hacer algo (inscribir un nodo, simular, medir…), detectan solos cuando quedó hecho y traen
// «Hágalo por mí». Los tours prácticos corren sobre un escenario de práctica: al salir, el del usuario vuelve tal cual.
import { escenarioEjemplo, escenarioVacio, nuevaAntena, type Accion, type Estado, type ModoApp, type Vista } from "@/components/simulador/estado";
import { escenarioMalla } from "@/components/simulador/piezas";
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
  const otra = nuevaAntena(Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6)), e.antenas, { nombre: "Antena 2", alturaM: 15 });
  return { ...e, nombre: "Práctica: como Radio Mobile", antenas: [ejemplo, otra] };
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
      const destinos = r.sinCobertura.length ? r.sinCobertura.map((a) => ({ lat: a.lat, lon: a.lon, nombre: a.nombre, antena: a })) : [{ ...desplazar(g.lat, g.lon, 28000, 70), nombre: "El punto de práctica" }];
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
  { objetivo: "tab-parametros", titulo: "Parámetros", texto: "Aquí están el ajuste de radio MeshCore (SF11 de Trama por defecto), la frecuencia (las 4 de Trama), el límite de saltos, el receptor y el entorno (vegetación o edificios), el radio de estudio y la fuente del relieve.", preparar: "parametros" },
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
    id: "sembrar",
    nombre: "Sembrar la malla",
    detalle: "Gateway, repetidores y gente, como en Trama, y un mensaje de prueba.",
    minutos: 4,
    modo: "sembrar",
    practica: { escenario: () => renombrado(escenarioVacio(), "Práctica: sembrar la malla"), autoSimular: true, centro: [CENTRO.lat, CENTRO.lon + 0.12, 10] },
    pasos: [
      {
        titulo: "Sembrar la malla",
        texto: "Vamos a armar una red como en Trama: primero el Gateway + Internet, después los repetidores según la distancia y al final la gente. Yo calculo con el relieve real quién queda conectado. Estamos en un escenario de práctica: al terminar, el suyo vuelve tal cual.",
      },
      {
        objetivo: "modo",
        titulo: "Dos modos",
        texto: "Aquí cambia entre «Sembrar la malla», el modo sencillo y guiado, y el «Modo avanzado», con la lista de nodos, todos los parámetros y las herramientas. En el celular, use la pestaña «Sembrar» de abajo.",
      },
      {
        objetivo: ["piezas", "pieza-mapa"],
        preparar: "sembrar",
        titulo: "1 · El Gateway + Internet",
        texto: "Toque «Gateway + Internet» y luego el mapa, en el sitio donde entra el internet: la casa o la finca con Starlink. De ahí sale la malla.",
        tarea: {
          hecho: (t, base) => piezas(t.foto(), "gateway").length > piezas(base, "gateway").length,
          hacer: (t) => t.melki.ponerPieza("gateway", CENTRO.lat, CENTRO.lon),
        },
      },
      {
        objetivo: ["piezas", "pieza-mapa"],
        preparar: "sembrar",
        titulo: "2 · Un repetidor",
        texto: "Toque «Repetidor» y póngalo a unos 8 a 10 km del gateway, por ejemplo hacia el oriente (los anillos blancos marcan las distancias). Debe alcanzar al gateway: si queda en naranja, acérquelo.",
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
        titulo: "3 · La gente",
        texto: "Toque «Persona» y ponga dos: una cerca del repetidor y otra lejos, a unos 25 a 30 km del gateway. Verde es conectada al gateway (el número son los saltos); rojo, sin cobertura.",
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
        titulo: "Estado de la red",
        texto: "Aquí ve cuántas personas quedan conectadas, cuántas sin cobertura, los km² cubiertos por la red conectada y los saltos. Arriba, el recuadro le dice qué hacer a continuación.",
        tarea: { hecho: (t) => t.alDia(), hacer: (t) => t.melki.simular(), aviso: "Listo: la red ya está calculada." },
      },
      {
        objetivo: "sembrar-auto",
        preparar: "sembrar",
        titulo: "Conectar a los que faltan",
        texto: "Toque «Conectar a los que faltan»: busco con el relieve real las lomas donde un repetidor alcanza a la persona en rojo y se las propongo en el mapa como torres naranjas punteadas.",
        tarea: {
          hecho: (t) => ["propuesta", "puesta"].includes(t.foto().siembra),
          hacer: sembrarFaltantes,
          aviso: "Ahí está la propuesta.",
        },
      },
      {
        objetivo: ["propuesta", "sembrar-auto"],
        preparar: "sembrar",
        titulo: "Póngalos",
        texto: "Revise la propuesta (dónde queda cada repetidor y con cuántos dB) y toque «Poner». La red se recalcula sola; si se arrepiente, «Deshacer» los quita.",
        tarea: {
          hecho: (t) => t.foto().siembra === "puesta",
          hacer: (t) => cuandoSePueda(() => t.melki.propuesta() !== null, () => t.melki.aceptarSiembra()),
        },
      },
      {
        objetivo: "mapa",
        preparar: "mapa",
        titulo: "El flujo de la malla",
        texto: "Mire el mapa: la información viaja por las líneas turquesa hacia el gateway. Cada pulso sale de una persona y salta de nodo en nodo; el que lo retransmite destella (casi siempre el repetidor más cercano con buen enlace) y la nube «IA» del gateway se enciende al recibirlo. En rojo y parpadeando, quien no tiene cobertura.",
        asegurar: encuadrarMalla,
      },
      {
        objetivo: "enviar-mensaje",
        preparar: "sembrar",
        titulo: "Envíe un mensaje de prueba",
        texto: "Toque «Enviar»: un mensaje del tamaño de un pago (la orden firmada, 118 bytes) sale de la persona más lejana y lo pasan los repetidores hasta el gateway, como en MeshCore; un WhatsApp o una consulta a la IA viajan igual. Le digo los saltos, el tiempo y qué tan seguro llega; la respuesta vuelve por la misma ruta.",
        tarea: { hecho: (t, base) => t.foto().mensaje > base.mensaje, hacer: enviarDePrueba },
      },
      {
        objetivo: "melki",
        titulo: "Pregúnteme",
        texto: "Pregúnteme «¿cómo viaja un mensaje?», «¿por qué Persona 2 está en rojo?» o «¿qué hago ahora?», o pídame «pon un repetidor en 4.25, -73.30 a 12 m», «lleva la red a Paratebueno» o «puebla la zona con 250 personas».",
      },
    ],
    final: "Ya sabe sembrar la malla: el gateway, los repetidores, la gente, conectar a los que faltan y probar un mensaje.",
  },
  {
    id: "capacidad",
    nombre: "¿Cuánto tráfico aguanta?",
    detalle: "Poblar personas, pagos y mensajes al tiempo, zonas de popularidad y la hora pico hasta que la red se reviente.",
    minutos: 4,
    modo: "sembrar",
    practica: { escenario: () => renombrado(escenarioMalla(), "Práctica: capacidad de la red"), autoSimular: true },
    pasos: [
      {
        titulo: "La red con la gente de verdad",
        texto: "Una red puede cubrir todo y aun así no aguantar la hora pico del mercado. Por ella van pagos, mensajes de WhatsApp y consultas a la IA, y todos comparten el mismo canal. Vamos a llenar la zona de gente y a mandar mensajes al tiempo, paquete por paquete como lo hace MeshCore, hasta ver dónde se revienta. Estamos en un escenario de práctica.",
      },
      {
        objetivo: "poblar",
        preparar: "resultados",
        titulo: "1 · Poblar personas",
        texto: "Elija cuántas (o la densidad de la zona: 0,2 por km² dispersa, 1 media, 5 densa, como en el documento de Trama) y toque «Poblar». Las reparto al azar sobre el terreno, cada una con su billetera a 1,5 m.",
        tarea: {
          hecho: (t, base) => pobladas(t.foto()) > pobladas(base),
          hacer: (t) => void t.melki.poblar({ n: 250, semilla: 7 }),
          aviso: "Listo: ya están repartidas.",
        },
      },
      {
        objetivo: ["resumen-pobladas", "nodos-campo"],
        preparar: "resultados",
        titulo: "¿Cuántas quedaron conectadas?",
        texto: "Al simular le digo cuántas llegan al gateway, a cuántos saltos y cuántas quedan sin cobertura (en rojo en el mapa). En el mapa son puntos pequeños: tóquelos para ver su nombre.",
        tarea: { hecho: (t) => t.alDia() && pobladas(t.foto()) > 0, hacer: (t) => t.melki.simular(), aviso: "Listo: ya calculé quién queda conectado." },
      },
      {
        objetivo: "prueba-carga",
        preparar: "resultados",
        titulo: "2 · Mensajes al tiempo",
        texto: "Elija qué se manda —pagos, o mensajes de texto de WhatsApp y consultas a la IA— y cuántos salen al tiempo (5, 15, 25…), y toque «Probar». Cada pago es la orden (118 B), el comprobante (126 B) y el aviso a quien recibe (126 B), con sus acuses: con SF11 ocupa ~9,5 s de aire.",
        tarea: {
          hecho: (t, base) => ["listo", "curva"].includes(t.foto().carga) && t.foto().carga !== base.carga,
          hacer: (t) => void t.melki.probarCarga({ mensajes: 15 }),
          aviso: "Ahí está el resultado.",
        },
      },
      {
        objetivo: ["resultado-carga", "prueba-carga"],
        preparar: "resultados",
        titulo: "3 · ¿Hasta cuántos aguanta?",
        texto: "Toque «¿Hasta cuántos aguanta?»: subo la cantidad hasta que menos del 90 % recibe su respuesta. Verde aguanta sin demora, naranja aguanta pero lento (el 95 % tarda más de un minuto) y rojo ya se reventó.",
        tarea: {
          hecho: (t) => t.foto().carga === "curva",
          hacer: (t) => void t.melki.probarCarga({}, true),
          aviso: "Ahí está la curva.",
        },
      },
      {
        objetivo: "zonas-popularidad",
        preparar: "resultados",
        titulo: "4 · Zonas de popularidad",
        texto: "Ahora gente alrededor de cada repetidor y del gateway (o solo de uno: también sale al tocar el repetidor en el mapa). Escriba cuántas personas quiera por zona y a cuántos km, y toque «Poner». En cada punto, «Poner y probar» simula de una vez la hora pico y «¿Cuántas aguanta?» busca su límite.",
        tarea: {
          hecho: (t, base) => enZonas(t.foto()) > enZonas(base),
          hacer: (t) => void t.melki.poblarZonas({ n: 150, radioKm: 2, semilla: 7 }),
          aviso: "Listo: ya está la gente en cada zona.",
        },
      },
      {
        objetivo: "prueba-estres",
        preparar: "resultados",
        titulo: "5 · La hora pico, zona por zona",
        texto: "Toque «¿Hasta dónde aguanta cada repetidor?»: cada persona manda sus mensajes del día (pagos, WhatsApp y consultas a la IA) y una parte cae en la hora pico. Mido cada zona (mensajes completos, espera, canal, cuánto transmite, alcance con carga y energía) y subo la carga hasta que cada una se revienta.",
        tarea: {
          hecho: (t) => t.foto().estres === "rampa",
          hacer: (t) => void t.melki.probarEstres({ rampa: true }),
          aviso: "Ahí está: zona por zona y hasta dónde aguanta.",
        },
      },
      {
        objetivo: ["resultado-estres", "prueba-estres"],
        preparar: "resultados",
        titulo: "Cómo leerlo",
        texto: "Trama diseña cada frecuencia para 55 pagos por hora con SF11 (el canal al 15 % en la hora pico): 150 usuarios por frecuencia y 600 por sitio de 4 radios, y esa capacidad la comparten con los WhatsApp y las consultas a la IA. En el mapa cada zona queda verde (aguanta), naranja (lenta) o roja (se revienta). La curva muestra cuántos mensajes por hora entrega la red: sube hasta el máximo del canal y después cae. Si se revienta, reparta los repetidores en las 4 frecuencias, baje a SF10 o SF9 (más mensajes, menos alcance) o ponga más sitios gateway.",
      },
    ],
    final: "Ya sabe probar la capacidad: poblar la zona, mandar pagos y mensajes al tiempo, poner zonas de popularidad y ver hasta dónde aguanta cada repetidor en la hora pico.",
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
    detalle: "Pedirme cosas con sus palabras (hasta una red completa), dictarme por voz y deshacer.",
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
        texto: "También puede tocar el micrófono y hablarme: lo que dice aparece en la caja para revisarlo y corregirlo, y solo se envía cuando usted quiera. Puede dictar con el navegador o en modo privado, sin internet. Y con el «Asistente Melki» le escucho sin tocar nada: diga «Hola Melki» y su pedido (lo enseño en el tour «Asistente Melki por voz»).",
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
      {
        objetivo: "melki-chat",
        lado: "izquierda",
        titulo: "Pídame una red completa",
        texto: "Dígame el área y la meta, y la diseño yo con el relieve real: «ármame una malla que cubra 1.000 hectáreas con señal media o mejor en el 99 %». También entiendo varias órdenes en un mensaje («pon un repetidor a 5 km al norte de Ejemplo y simula»), lugares («en Cumaral») y órdenes en lote («sube todos los repetidores a 20 m»).",
        asegurar: () => avisarMelki("abrir"),
      },
    ],
    final: "Ya sabe pedirme cosas por escrito o por voz, hasta una red completa, y deshacerlas. Aquí sigo cuando me necesite.",
  },
  {
    id: "voz",
    nombre: "Asistente Melki por voz",
    detalle: "Hablarme sin tocar nada: «Hola Melki» y su pedido, conversar, el mapa libre con mis sugerencias y la mayor cobertura posible.",
    minutos: 3,
    modo: "sembrar",
    practica: { escenario: () => renombrado(escenarioMalla(), "Práctica: Asistente Melki"), autoSimular: true },
    pasos: [
      {
        titulo: "El Asistente Melki",
        texto: "Puedo escucharle todo el tiempo, como un asistente de voz: usted me llama por mi nombre y me da la orden, yo la hago y le dejo la respuesta escrita, a su servicio (no hablo en voz alta, salvo que me diga «háblame»). Así puede trabajar con las manos libres y solo el mapa. Estamos en un escenario de práctica.",
      },
      {
        objetivo: "manos-libres",
        titulo: "Active el asistente",
        texto: "Toque «Asistente Melki» en la barra de arriba (o escríbame «activa el asistente»). La primera vez el navegador le pide permiso para usar el micrófono: permítalo. Funciona mejor en Edge o Chrome.",
        tarea: {
          hecho: () => elemento('[data-tour="manos-libres"][aria-pressed="true"]') !== null,
          hacer: () => elemento('[data-tour="manos-libres"][aria-pressed="false"]')?.click(),
          aviso: "¡Listo! Ya le escucho.",
        },
      },
      {
        objetivo: ["hud-voz", "manos-libres"],
        titulo: "Llámeme por mi nombre",
        texto: "Diga «Hola Melki» y su pedido, de corrido: «Hola Melki, ¿cómo está la red?» o «Oye Melki, conecta a los que faltan». También entiendo «Hey Melki» y «Hello Melki», y si solo dice «Hola Melki» le contesto «Hola, mi señor. Le escucho». Sin mi nombre no hago nada, por si alguien habla cerca. En esta barra ve lo que le entiendo y lo que le contesto.",
      },
      {
        objetivo: ["hud-voz", "manos-libres"],
        titulo: "Converse sin repetir mi nombre",
        texto: "Después de responder me quedo atento unos segundos: siga hablando sin decir «Melki». Para usar mis botones diga «sí, hazlo» o «la segunda»; «repite» y «más detalle» para ver todo; «para» quita lo que estoy mostrando y «deshaz» revierte lo último. Los números y las coordenadas se pueden decir en palabras.",
      },
      {
        objetivo: ["hud-sugerencias", "hud-voz"],
        titulo: "El mapa libre y mis sugerencias",
        texto: "Al activarme oculto el panel de herramientas y el de resultados para dejarle el mapa libre. Cuando un resultado se vea mejor en un panel, le pregunto si se lo muestro («sí» lo abre); también están estos botones y «muestra los resultados», «muestra los paneles» o «pantalla limpia». Al apagarme, los paneles vuelven.",
      },
      {
        objetivo: ["hud-voz", "manos-libres"],
        titulo: "La mayor cobertura posible",
        texto: "Pregúnteme «¿cómo dejo la mayor cobertura posible?» y le doy las recomendaciones para esta red: los sitios altos primero, la línea de vista, repartir la malla con respaldo, el gateway al centro y la radio. Si me dice «ajústamelo para la mayor cobertura posible», comparo lomas, alturas, antenas y repetidores de apoyo y le propongo la opción de máxima cobertura con su costo.",
      },
      {
        objetivo: ["hud-voz", "manos-libres"],
        titulo: "Para terminar",
        texto: "Diga «Melki, deja de escuchar» o toque la X de esta barra: quedo en reposo, atento solo a mi nombre, y con «Hey Melki» vuelvo sin tocar nada; «apaga el micrófono» me apaga del todo. La barra se arrastra a donde no estorbe y se achica sola mientras espero. En Ajustes de voz elige cómo le hablo, la voz, si le escucho siempre en reposo y si me activo solo al abrir el simulador. Consejos: hable de corrido justo después de mi nombre, con el micrófono cerca; con parlantes a todo volumen, baje un poco el volumen o use audífonos para que no me oiga a mí mismo.",
      },
    ],
    final: "Ya sabe trabajar conmigo por voz: llamarme por mi nombre, conversar sin repetirlo, usar mis botones con «sí, hazlo», trabajar con el mapa libre y pedirme la mayor cobertura posible. A su servicio.",
  },
];

export const tourPorId = (id: IdTour) => TOURS.find((t) => t.id === id) ?? TOURS[0];

/** Pasos con tarea de un tour (para contarlos en el menú y en las pruebas). */
export const pasosPracticos = (t: Tour) => t.pasos.filter((p) => p.tarea).length;
