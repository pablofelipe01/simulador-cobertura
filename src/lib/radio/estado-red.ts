// Estado de la red para el modo «Sembrar la malla»: quién está conectado al gateway, quién no y cuánto
// territorio cubre la infraestructura conectada. Todo sale de la simulación con el relieve real.
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
  return n.length <= 3 ? n.join(", ").replace(/, ([^,]*)$/, " y $1") : `${n.slice(0, 3).join(", ")} y ${n.length - 3} más`;
};

/** Qué hacer ahora, paso a paso, como en Trama: gateway → repetidores → personas → conectar a los que faltan. */
export function consejoRed(red: EstadoRed, limiteSaltos: number, opciones: { calculando?: boolean; autoSimular?: boolean } = {}): Consejo {
  if (!red.gateways.length)
    return {
      paso: 1,
      titulo: "Ponga el Gateway + Internet",
      texto: "Toque «Gateway + Internet» y luego, en el mapa, un sitio donde haya luz y señal —la cabecera, una finca con Starlink—: es la única pieza con conexión (el router va a su lado) y lleva la IA. De ahí sale la malla.",
      tono: "info",
    };
  if (!red.repetidores.length && !red.personas.length)
    return {
      paso: 2,
      titulo: "Ponga los repetidores",
      texto: "Toque «Repetidor» y ubíquelos en las lomas para llegar lejos, a una distancia que alcance el gateway (empiece a 5–10 km). Cada repetidor debe alcanzar al gateway o a otro repetidor conectado.",
      tono: "info",
    };
  if (!red.alDia)
    return opciones.calculando || opciones.autoSimular !== false
      ? { paso: null, titulo: "Calculando la red", texto: "Mirando con el relieve real quién alcanza a quién…", tono: "info" }
      : { paso: null, titulo: "Falta calcular", texto: "Toque «Simular» para ver quién queda conectado al gateway.", tono: "info" };
  if (red.aislados.length)
    return {
      paso: 2,
      titulo: red.aislados.length === 1 ? "Un repetidor no alcanza la red" : `${red.aislados.length} repetidores no alcanzan la red`,
      texto: `${lista(red.aislados)} ${red.aislados.length === 1 ? "queda" : "quedan"} en naranja: no llega${red.aislados.length === 1 ? "" : "n"} al gateway ni a un repetidor conectado. Acérquelo, súbalo a una loma o ponga otro repetidor en medio.`,
      tono: "alerta",
    };
  if (!red.personas.length)
    return {
      paso: 3,
      titulo: "Ponga a la gente",
      texto: "Toque «Persona» y ubíquelas en el campo, en las casas o fincas de la gente. Verde = conectada al gateway; rojo = sin cobertura.",
      tono: "info",
    };
  if (red.sinCobertura.length)
    return {
      paso: 4,
      titulo: red.sinCobertura.length === 1 ? "Una persona sin cobertura" : `${red.sinCobertura.length} personas sin cobertura`,
      texto: `${lista(red.sinCobertura)} ${red.sinCobertura.length === 1 ? "está" : "están"} en rojo: no tiene${red.sinCobertura.length === 1 ? "" : "n"} cobertura. Acérquele${red.sinCobertura.length === 1 ? "" : "s"} un repetidor, en una loma, o toque «Conectar a los que faltan» y el simulador lo propone.`,
      tono: "alerta",
    };
  if (red.lejos.length)
    return {
      paso: 4,
      titulo: "Hay rutas demasiado largas",
      texto: `${lista(red.lejos)} ${red.lejos.length === 1 ? "llega" : "llegan"} con más saltos que el límite del diseño (${limiteSaltos}): cada mensaje tardaría más y le quitaría capacidad a la frecuencia. Ponga un repetidor más alto que acorte la ruta o suba el límite de saltos en el modo avanzado (MeshCore deja hasta 64).`,
      tono: "alerta",
    };
  return {
    paso: null,
    titulo: "¡Toda la gente está conectada!",
    texto: `${red.conectadas.length} ${red.conectadas.length === 1 ? "persona" : "personas"} con ruta al gateway, máximo ${red.saltosMax} ${red.saltosMax === 1 ? "salto" : "saltos"}. Mire el flujo turquesa hacia el gateway y pruebe «Enviar un mensaje de prueba»: la respuesta vuelve por la misma ruta. Con «Poblar personas» y la «Prueba de carga» (en Resultados) ve cuántos pagos, WhatsApp y consultas a la IA aguanta la frecuencia.`,
    tono: "ok",
  };
}
