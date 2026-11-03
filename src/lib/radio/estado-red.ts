// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Estado de la red para el modo «Sembrar la malla»: quién está conectado al gateway, quién no y cuánto
// territorio cubre la infraestructura conectada. Todo sale de la simulación con el relieve real.
import { tx } from "../idioma";
import { UMBRAL_SERVICIO_DB } from "./constantes";
import type { Antena, ResultadoSimulacion } from "./tipos";

/** Pieza de la malla: el gateway (pasarela con internet), los repetidores (nodos antena) y las personas (nodos de campo). */
export type Pieza = "gateway" | "repetidor" | "persona";

export function piezaDe(a: Antena): Pieza {
  if (a.pasarela) return "gateway";
  return (a.tipo ?? "antena") === "antena" ? "repetidor" : "persona";
}

/**
 * conectado: llega al gateway dentro del límite de saltos · lejos: llega, pero con más saltos que el límite ·
 * sin-cobertura: persona sin ruta · aislado: repetidor sin ruta · gateway · pendiente: falta simular.
 */
export type EstadoNodo = "gateway" | "conectado" | "lejos" | "sin-cobertura" | "aislado" | "pendiente";

export type EstadoRed = {
  gateways: Antena[];
  repetidores: Antena[];
  personas: Antena[];
  conectadas: Antena[];
  sinCobertura: Antena[];
  lejos: Antena[];
  aislados: Antena[];
  saltosMax: number;
  /** Territorio con servicio de la infraestructura conectada (km²) y área de estudio (km²). */
  areaKm2: number;
  areaEstudioKm2: number;
  porNodo: Map<string, { estado: EstadoNodo; saltos: number | null }>;
  alDia: boolean;
};

export function estadoRed(antenas: Antena[], resultado: ResultadoSimulacion | null, limiteSaltos: number, alDia: boolean): EstadoRed {
  const activas = antenas.filter((a) => a.activa);
  const gateways = activas.filter((a) => piezaDe(a) === "gateway");
  const repetidores = activas.filter((a) => piezaDe(a) === "repetidor");
  const personas = activas.filter((a) => piezaDe(a) === "persona");
  const porNodo = new Map<string, { estado: EstadoNodo; saltos: number | null }>();
  const nodos = alDia && resultado ? new Map(resultado.nodos.map((n) => [n.id, n])) : null;
  for (const a of activas) {
    const n = nodos?.get(a.id);
    if (!nodos || !n) {
      porNodo.set(a.id, { estado: a.pasarela ? "gateway" : "pendiente", saltos: a.pasarela ? 0 : null });
      continue;
    }
    if (a.pasarela) porNodo.set(a.id, { estado: "gateway", saltos: 0 });
    else if (n.saltos === null) porNodo.set(a.id, { estado: piezaDe(a) === "persona" ? "sin-cobertura" : "aislado", saltos: null });
    else porNodo.set(a.id, { estado: n.saltos > limiteSaltos ? "lejos" : "conectado", saltos: n.saltos });
  }
  const conEstado = (lista: Antena[], e: EstadoNodo) => lista.filter((a) => porNodo.get(a.id)?.estado === e);
  const saltosMax = Math.max(0, ...[...porNodo.values()].map((v) => v.saltos ?? 0));
  const area = resultado && alDia ? areaConectada(resultado, new Set(activas.filter((a) => a.pasarela || porNodo.get(a.id)?.estado === "conectado" || porNodo.get(a.id)?.estado === "lejos").map((a) => a.id))) : 0;
  return {
    gateways,
    repetidores,
    personas,
    conectadas: [...conEstado(personas, "conectado")],
    sinCobertura: conEstado(personas, "sin-cobertura"),
    lejos: conEstado(personas, "lejos"),
    aislados: conEstado(repetidores, "aislado"),
    saltosMax,
    areaKm2: area,
    areaEstudioKm2: resultado && alDia ? resultado.areaEstudioKm2 : 0,
    porNodo,
    alDia,
  };
}

/** Área con servicio (≥ 20 dB) de los nodos antena conectados al gateway, en km². */
export function areaConectada(r: ResultadoSimulacion, conectados: Set<string>): number {
  const total = r.malla.ancho * r.malla.alto;
  const indices = r.antenas.map((a, k) => (conectados.has(a.id) ? k : -1)).filter((k) => k >= 0);
  if (!indices.length || r.areaEstudioKm2 <= 0) return 0;
  let enEstudio = 0;
  let cubiertas = 0;
  for (let c = 0; c < total; c++) {
    if (Number.isNaN(r.mejor[c])) continue;
    enEstudio++;
    for (const k of indices) {
      if (r.porAntena[k * total + c] >= UMBRAL_SERVICIO_DB) {
        cubiertas++;
        break;
      }
    }
  }
  return enEstudio ? (r.areaEstudioKm2 * cubiertas) / enEstudio : 0;
}

export type Consejo = { paso: number | null; titulo: string; texto: string; tono: "info" | "alerta" | "ok" };

const lista = (xs: Antena[]) => {
  const n = xs.map((a) => `«${a.nombre}»`);
  const en = xs.map((a) => `“${a.nombre}”`);
  return tx(
    n.length <= 3 ? n.join(", ").replace(/, ([^,]*)$/, " y $1") : `${n.slice(0, 3).join(", ")} y ${n.length - 3} más`,
    en.length <= 1 ? (en[0] ?? "") : en.length <= 3 ? `${en.slice(0, -1).join(", ")} and ${en[en.length - 1]}` : `${en.slice(0, 3).join(", ")} and ${en.length - 3} more`,
  );
};

/** Qué hacer ahora, paso a paso, como en Trama: gateway → repetidores → personas → conectar a los que faltan. */
export function consejoRed(red: EstadoRed, limiteSaltos: number, opciones: { calculando?: boolean; autoSimular?: boolean } = {}): Consejo {
  if (!red.gateways.length)
    return {
      paso: 1,
      titulo: tx("Ponga el Gateway + Internet", "Place the Gateway + Internet"),
      texto: tx(
        "Toque «Gateway + Internet» y luego, en el mapa, un sitio donde haya luz y señal —la cabecera, una finca con Starlink—: es la única pieza con conexión (el router va a su lado) y lleva la IA. De ahí sale la malla.",
        "Tap “Gateway + Internet” and then, on the map, a site with power and signal —the town center, a farm with Starlink—: it is the only piece with a connection (the router goes next to it) and it carries the AI. The mesh starts from there.",
      ),
      tono: "info",
    };
  if (!red.repetidores.length && !red.personas.length)
    return {
      paso: 2,
      titulo: tx("Ponga los repetidores", "Place the repeaters"),
      texto: tx(
        "Toque «Repetidor» y ubíquelos en las lomas para llegar lejos, a una distancia que alcance el gateway (empiece a 5–10 km). Cada repetidor debe alcanzar al gateway o a otro repetidor conectado.",
        "Tap “Repeater” and place them on hilltops to reach far, at a distance the gateway can reach (start at 5–10 km). Each repeater must reach the gateway or another connected repeater.",
      ),
      tono: "info",
    };
  if (!red.alDia)
    return opciones.calculando || opciones.autoSimular !== false
      ? { paso: null, titulo: tx("Calculando la red", "Calculating the network"), texto: tx("Mirando con el relieve real quién alcanza a quién…", "Checking with the real terrain who reaches whom…"), tono: "info" }
      : { paso: null, titulo: tx("Falta calcular", "Not calculated yet"), texto: tx("Toque «Simular» para ver quién queda conectado al gateway.", "Tap “Simulate” to see who is connected to the gateway."), tono: "info" };
  if (red.aislados.length)
    return {
      paso: 2,
      titulo: red.aislados.length === 1 ? tx("Un repetidor no alcanza la red", "A repeater can't reach the network") : tx(`${red.aislados.length} repetidores no alcanzan la red`, `${red.aislados.length} repeaters can't reach the network`),
      texto: tx(
        `${lista(red.aislados)} ${red.aislados.length === 1 ? "queda" : "quedan"} en naranja: no llega${red.aislados.length === 1 ? "" : "n"} al gateway ni a un repetidor conectado. Acérquelo, súbalo a una loma o ponga otro repetidor en medio.`,
        `${lista(red.aislados)} ${red.aislados.length === 1 ? "is" : "are"} shown in orange: ${red.aislados.length === 1 ? "it doesn't" : "they don't"} reach the gateway or a connected repeater. ${red.aislados.length === 1 ? "Move it closer, put it on a hilltop" : "Move them closer, put them on hilltops"} or place another repeater in between.`,
      ),
      tono: "alerta",
    };
  if (!red.personas.length)
    return {
      paso: 3,
      titulo: tx("Ponga a la gente", "Place the people"),
      texto: tx(
        "Toque «Persona» y ubíquelas en el campo, en las casas o fincas de la gente. Verde = conectada al gateway; rojo = sin cobertura.",
        "Tap “Person” and place them in the field, at people's homes or farms. Green = connected to the gateway; red = no coverage.",
      ),
      tono: "info",
    };
  if (red.sinCobertura.length)
    return {
      paso: 4,
      titulo: red.sinCobertura.length === 1 ? tx("Una persona sin cobertura", "One person without coverage") : tx(`${red.sinCobertura.length} personas sin cobertura`, `${red.sinCobertura.length} people without coverage`),
      texto: tx(
        `${lista(red.sinCobertura)} ${red.sinCobertura.length === 1 ? "está" : "están"} en rojo: no tiene${red.sinCobertura.length === 1 ? "" : "n"} cobertura. Acérquele${red.sinCobertura.length === 1 ? "" : "s"} un repetidor, en una loma, o toque «Conectar a los que faltan» y el simulador lo propone.`,
        `${lista(red.sinCobertura)} ${red.sinCobertura.length === 1 ? "is" : "are"} shown in red: no coverage. Bring a repeater closer to ${red.sinCobertura.length === 1 ? "that person" : "them"}, on a hilltop, or tap “Connect the missing ones” and the simulator will propose one.`,
      ),
      tono: "alerta",
    };
  if (red.lejos.length)
    return {
      paso: 4,
      titulo: tx("Hay rutas demasiado largas", "Some routes are too long"),
      texto: tx(
        `${lista(red.lejos)} ${red.lejos.length === 1 ? "llega" : "llegan"} con más saltos que el límite del diseño (${limiteSaltos}): cada mensaje tardaría más y le quitaría capacidad a la frecuencia. Ponga un repetidor más alto que acorte la ruta o suba el límite de saltos en el modo avanzado (MeshCore deja hasta 64).`,
        `${lista(red.lejos)} ${red.lejos.length === 1 ? "arrives" : "arrive"} with more hops than the design limit (${limiteSaltos}): each message would take longer and eat into the frequency's capacity. Place a taller repeater to shorten the route or raise the hop limit in Advanced mode (MeshCore allows up to 64).`,
      ),
      tono: "alerta",
    };
  return {
    paso: null,
    titulo: tx("¡Toda la gente está conectada!", "Everyone is connected!"),
    texto: tx(
      `${red.conectadas.length} ${red.conectadas.length === 1 ? "persona" : "personas"} con ruta al gateway, máximo ${red.saltosMax} ${red.saltosMax === 1 ? "salto" : "saltos"}. Mire el flujo turquesa hacia el gateway y pruebe «Enviar un mensaje de prueba»: la respuesta vuelve por la misma ruta. Con «Poblar personas» y la «Prueba de carga» (en Resultados) ve cuántos pagos, WhatsApp y consultas a la IA aguanta la frecuencia.`,
      `${red.conectadas.length} ${red.conectadas.length === 1 ? "person" : "people"} with a route to the gateway, at most ${red.saltosMax} ${red.saltosMax === 1 ? "hop" : "hops"}. Watch the turquoise flow toward the gateway and try “Send a test message”: the reply comes back along the same route. With “Populate people” and the “Load test” (in Results) you can see how many payments, WhatsApp messages and AI queries the frequency can handle.`,
    ),
    tono: "ok",
  };
}
