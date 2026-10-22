// Enlaces entre nodos, comportamiento de la red mesh (saltos, puntos críticos) y factibilidad.
import { BANDA_LIBRE_MHZ, DISTANCIA_MINIMA_M, ENLACES, presetPorId, UMBRAL_CONFIABLE_DB } from "./constantes";
import { perdidaEntorno } from "./entorno";
import { distanciaM, rumbo } from "./geo";
import { claseEnlace, longitudOnda, presupuestoEnlace } from "./modelo";
import { anguloElevacion, atenuacionPatron } from "./patron";
import { pasoPerfil } from "./perfil";
import { calculoRed } from "./red";
import type { Relieve } from "./relieve";
import { geometriaTrayecto, perdidasTrayecto } from "./trayecto";
import type { Antena, Enlace, Factibilidad, NodoMalla, Parametros } from "./tipos";

const fmt = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

/** Enlace entre dos nodos con el relieve real: margen de cada sentido y el mínimo de ambos (dB). */
export function enlaceEntre(a: Antena, b: Antena, p: Parametros, relieve: Relieve, red = calculoRed(p), lambda = longitudOnda(p.frecuenciaMhz)): Enlace {
  const d = Math.max(distanciaM(a.lat, a.lon, b.lat, b.lon), DISTANCIA_MINIMA_M);
  const [ax, ay] = relieve.pixel(a.lat, a.lon);
  const [bx, by] = relieve.pixel(b.lat, b.lon);
  const ea = { px: ax, py: ay, suelo: relieve.muestra(ax, ay), alturaM: a.alturaM };
  const eb = { px: bx, py: by, suelo: relieve.muestra(bx, by), alturaM: b.alturaM };
  // La geometría es simétrica: el obstáculo principal es el mismo en ambos sentidos.
  const g = geometriaTrayecto(relieve, red, ea, eb, d, lambda, pasoPerfil(relieve, a.lat));
  const v = g.vMax;
  // Pérdidas comunes a ambos sentidos: entorno de cada extremo y patrón de cada antena hacia la otra
  const za = ea.suelo + a.alturaM;
  const zb = eb.suelo + b.alturaM;
  const comunes =
    perdidaEntorno(p.entorno, a.alturaM, p.frecuenciaMhz) +
    perdidaEntorno(p.entorno, b.alturaM, p.frecuenciaMhz) +
    atenuacionPatron(a, rumbo(a.lat, a.lon, b.lat, b.lon), anguloElevacion(za, zb, d)) +
    atenuacionPatron(b, rumbo(b.lat, b.lon, a.lat, a.lon), anguloElevacion(zb, za, d));
  const margenAB = presupuestoEnlace(a, b, p) - perdidasTrayecto(g, red, p.frecuenciaMhz, a.alturaM).totalDb - comunes;
  const margenBA = presupuestoEnlace(b, a, p) - perdidasTrayecto(g, red, p.frecuenciaMhz, b.alturaM).totalDb - comunes;
  const m = Math.min(margenAB, margenBA);
  return {
    a: a.id,
    b: b.id,
    distanciaKm: d / 1000,
    margenAB,
    margenBA,
    margen: m,
    clase: claseEnlace(m),
    vMax: v,
    lineaVista: v <= -0.6 * Math.SQRT2,
  };
}

export function calcularEnlaces(antenas: Antena[], p: Parametros, relieve: Relieve): Enlace[] {
  const lambda = longitudOnda(p.frecuenciaMhz);
  const red = calculoRed(p);
  const enlaces: Enlace[] = [];
  for (let i = 0; i < antenas.length; i++) for (let k = i + 1; k < antenas.length; k++) enlaces.push(enlaceEntre(antenas[i], antenas[k], p, relieve, red, lambda));
  return enlaces.sort((x, y) => y.margen - x.margen);
}

type Grafo = Map<string, { id: string; margen: number }[]>;

function grafo(antenas: Antena[], enlaces: Enlace[]): Grafo {
  const g: Grafo = new Map(antenas.map((a) => [a.id, []]));
  for (const e of enlaces) {
    if (e.clase === "sin") continue;
    g.get(e.a)?.push({ id: e.b, margen: e.margen });
    g.get(e.b)?.push({ id: e.a, margen: e.margen });
  }
  return g;
}

/** Saltos (enlaces) desde la pasarela más cercana. Solo retransmiten las antenas que no son CLIENT_MUTE. */
function saltosDesdePasarelas(antenas: Antena[], g: Grafo, excluir?: string) {
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const saltos = new Map<string, number>();
  const padre = new Map<string, string>();
  const cola: string[] = [];
  for (const a of antenas) {
    if (a.pasarela && a.id !== excluir) {
      saltos.set(a.id, 0);
      cola.push(a.id);
    }
  }
  while (cola.length) {
    const id = cola.shift()!;
    const nodo = porId.get(id)!;
    // Un nodo que no retransmite recibe, pero no reenvía (salvo que sea la pasarela).
    if (!nodo.pasarela && nodo.rol === "CLIENT_MUTE") continue;
    for (const v of g.get(id) ?? []) {
      if (v.id === excluir || saltos.has(v.id)) continue;
      saltos.set(v.id, saltos.get(id)! + 1);
      padre.set(v.id, id);
      cola.push(v.id);
    }
  }
  return { saltos, padre };
}

function componentes(antenas: Antena[], g: Grafo) {
  const comp = new Map<string, number>();
  let n = 0;
  for (const a of antenas) {
    if (comp.has(a.id)) continue;
    const pila = [a.id];
    comp.set(a.id, n);
    while (pila.length) {
      const id = pila.pop()!;
      for (const v of g.get(id) ?? []) {
        if (!comp.has(v.id)) {
          comp.set(v.id, n);
          pila.push(v.id);
        }
      }
    }
    n++;
  }
  return comp;
}

/**
 * Ruta más robusta hacia una pasarela con un máximo de `limite` saltos: maximiza el margen del
 * enlace más débil (cuello de botella). Meshtastic inunda la red, así que basta con que exista una ruta buena.
 */
function rutasRobustas(antenas: Antena[], g: Grafo, limite: number) {
  const porId = new Map(antenas.map((a) => [a.id, a]));
  let actual = new Map<string, { cuello: number; ruta: string[] }>();
  for (const a of antenas) if (a.pasarela) actual.set(a.id, { cuello: Infinity, ruta: [a.id] });
  for (let k = 1; k <= limite; k++) {
    const nuevo = new Map(actual);
    for (const [u, info] of actual) {
      const nodo = porId.get(u)!;
      if (!nodo.pasarela && nodo.rol === "CLIENT_MUTE") continue;
      for (const w of g.get(u) ?? []) {
        if (porId.get(w.id)?.pasarela || info.ruta.includes(w.id)) continue;
        const cuello = Math.min(info.cuello, w.margen);
        const previo = nuevo.get(w.id);
        if (!previo || cuello > previo.cuello) nuevo.set(w.id, { cuello, ruta: [w.id, ...info.ruta] });
      }
    }
    actual = nuevo;
  }
  return actual;
}

export type AnalisisMalla = { nodos: NodoMalla[]; troncales: Enlace[] };

export function analizarMalla(antenas: Antena[], enlaces: Enlace[], limiteSaltos: number): AnalisisMalla {
  const g = grafo(antenas, enlaces);
  const { saltos } = saltosDesdePasarelas(antenas, g);
  const comp = componentes(antenas, g);
  const dentro = rutasRobustas(antenas, g, limiteSaltos);
  const cualquiera = rutasRobustas(antenas, g, Math.max(limiteSaltos, antenas.length - 1));
  const alcanzados = saltos.size;
  const nodos: NodoMalla[] = antenas.map((a) => {
    let critico = false;
    if (!a.pasarela && saltos.has(a.id) && a.rol !== "CLIENT_MUTE") {
      const sin = saltosDesdePasarelas(antenas, g, a.id).saltos;
      critico = sin.size < alcanzados - 1;
    }
    const robusta = dentro.get(a.id) ?? cualquiera.get(a.id);
    return {
      id: a.id,
      saltos: saltos.get(a.id) ?? null,
      vecinos: g.get(a.id)?.length ?? 0,
      componente: comp.get(a.id) ?? 0,
      critico,
      cuelloDb: a.pasarela ? null : (dentro.get(a.id)?.cuello ?? null),
      ruta: robusta?.ruta ?? [],
    };
  });
  const clave = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const porPar = new Map(enlaces.map((e) => [clave(e.a, e.b), e]));
  const usados = new Map<string, Enlace>();
  for (const n of nodos) {
    for (let i = 0; i + 1 < n.ruta.length; i++) {
      const e = porPar.get(clave(n.ruta[i], n.ruta[i + 1]));
      if (e) usados.set(clave(e.a, e.b), e);
    }
  }
  return { nodos, troncales: [...usados.values()] };
}

type DatosFactibilidad = {
  antenas: Antena[];
  parametros: Parametros;
  enlaces: Enlace[];
  analisis: AnalisisMalla;
  porcentajeServicio: number;
  porcentajeConfiable: number;
  porcentajeRespaldo: number;
};

export function evaluarFactibilidad(d: DatosFactibilidad): Factibilidad {
  const { antenas, parametros: p, enlaces, analisis, porcentajeConfiable, porcentajeServicio } = d;
  const nombre = new Map(antenas.map((a) => [a.id, a.nombre]));
  const nodo = new Map(analisis.nodos.map((n) => [n.id, n]));
  const pasarelas = antenas.filter((a) => a.pasarela);
  const desconectadas = antenas.filter((a) => nodo.get(a.id)?.saltos === null);
  const maxSaltos = Math.max(0, ...analisis.nodos.map((n) => n.saltos ?? 0));
  const lejanas = antenas.filter((a) => (nodo.get(a.id)?.saltos ?? 0) > p.limiteSaltos);
  const debiles = antenas.filter((a) => {
    const c = nodo.get(a.id)?.cuelloDb;
    return c !== null && c !== undefined && c < 30;
  });
  const criticos = antenas.filter((a) => nodo.get(a.id)?.critico);
  const preset = presetPorId(p.preset);
  const varias = antenas.length > 1;

  const conectada = pasarelas.length > 0 && desconectadas.length === 0;
  const criterios: Factibilidad["criterios"] = [
    {
      nombre: "Pasarela definida",
      ok: pasarelas.length > 0,
      detalle: pasarelas.length ? pasarelas.map((a) => a.nombre).join(", ") : "Marque al menos un nodo como pasarela (conexión a internet o al servidor).",
    },
    {
      nombre: "Todos los nodos llegan a la pasarela",
      ok: conectada,
      detalle: desconectadas.length
        ? `Sin ruta: ${desconectadas.map((a) => a.nombre).join(", ")}`
        : varias
          ? "Todas tienen ruta hacia una pasarela."
          : "Red de un solo nodo.",
    },
    {
      nombre: `Saltos dentro del límite (${p.limiteSaltos})`,
      ok: conectada && lejanas.length === 0,
      detalle: !conectada
        ? "Se evalúa cuando todos los nodos llegan a la pasarela."
        : lejanas.length
          ? `Fuera del límite: ${lejanas.map((a) => a.nombre).join(", ")}`
          : `Máximo ${maxSaltos} ${maxSaltos === 1 ? "salto" : "saltos"} hasta la pasarela.`,
    },
    {
      nombre: "Rutas sólidas hacia la pasarela (≥ 30 dB)",
      ok: conectada && debiles.length === 0,
      detalle: !conectada
        ? "Se evalúa cuando todos los nodos llegan a la pasarela."
        : debiles.length
          ? `Ruta débil: ${debiles.map((a) => `${a.nombre} (${fmt(nodo.get(a.id)!.cuelloDb!)} dB)`).join(", ")}`
          : varias
            ? "Cada nodo tiene una ruta con todos sus enlaces ≥ 30 dB."
            : "No aplica (un solo nodo).",
    },
    {
      nombre: "Cobertura confiable ≥ 60 % del área",
      ok: porcentajeConfiable >= 60,
      detalle: `${fmt(porcentajeConfiable)} % confiable (≥ ${UMBRAL_CONFIABLE_DB} dB) · ${fmt(porcentajeServicio)} % con servicio.`,
    },
    {
      nombre: "Sin puntos únicos de falla",
      ok: conectada && criticos.length === 0,
      detalle: !conectada
        ? "Se evalúa cuando todos los nodos llegan a la pasarela."
        : criticos.length
          ? `Críticas: ${criticos.map((a) => a.nombre).join(", ")}`
          : "Ningún nodo intermedio aísla a otros si falla.",
    },
  ];

  const recomendaciones: string[] = [];
  if (pasarelas.length && desconectadas.length) {
    // Agrupar las antenas aisladas por grupo (componente) y proponer el mejor puente hacia la red conectada.
    const conectadas = new Set(antenas.filter((a) => nodo.get(a.id)?.saltos !== null).map((a) => a.id));
    const grupos = new Map<number, Antena[]>();
    for (const a of desconectadas) {
      const c = nodo.get(a.id)?.componente ?? -1;
      grupos.set(c, [...(grupos.get(c) ?? []), a]);
    }
    for (const grupo of grupos.values()) {
      const ids = new Set(grupo.map((a) => a.id));
      const puente = enlaces
        .filter((e) => (ids.has(e.a) && conectadas.has(e.b)) || (ids.has(e.b) && conectadas.has(e.a)))
        .sort((x, y) => y.margen - x.margen)[0];
      const quien = grupo.length === 1 ? `${grupo[0].nombre} no llega a la pasarela.` : `${grupo.map((a) => a.nombre).join(", ")} forman un grupo aislado de la pasarela.`;
      if (puente) {
        const obstruido = puente.vMax > -0.78 ? " El terreno obstruye la línea de vista." : "";
        recomendaciones.push(
          `${quien} El mejor puente posible es ${nombre.get(puente.a)}–${nombre.get(puente.b)} (${fmt(puente.margen)} dB a ${fmt(puente.distanciaKm, 2)} km; se necesitan 20 dB).${obstruido} Eleve uno de esos nodos, use antenas de mayor ganancia o agregue un nodo antena repetidor entre ellos.`,
        );
      } else recomendaciones.push(`${quien} Agregue un repetidor entre ese sector y la red.`);
    }
  }
  // Enlaces débiles en las rutas (cada enlace se menciona una vez)
  const clave = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const porPar = new Map(enlaces.map((e) => [clave(e.a, e.b), e]));
  const mencionados = new Set<string>();
  for (const a of debiles) {
    const ruta = nodo.get(a.id)!.ruta;
    for (let i = 0; i + 1 < ruta.length; i++) {
      const e = porPar.get(clave(ruta[i], ruta[i + 1]));
      if (!e || e.margen >= 30 || mencionados.has(clave(e.a, e.b))) continue;
      mencionados.add(clave(e.a, e.b));
      recomendaciones.push(
        `El enlace ${nombre.get(e.a)}–${nombre.get(e.b)} es inestable (${fmt(e.margen)} dB a ${fmt(e.distanciaKm, 2)} km). ${
          e.lineaVista
            ? "Tiene línea de vista: use antenas de mayor ganancia o reduzca la pérdida del cable."
            : "El terreno invade la zona de Fresnel: ganar altura en alguno de los extremos lo mejora."
        }`,
      );
    }
  }
  for (const a of lejanas) {
    recomendaciones.push(
      `${a.nombre} está a ${nodo.get(a.id)?.saltos} saltos de la pasarela y el límite es ${p.limiteSaltos}. Agregue una pasarela más cercana o suba el hop_limit (máximo 7; más saltos aumentan la congestión).`,
    );
  }
  for (const a of criticos) {
    recomendaciones.push(`${a.nombre} es un punto único de falla: si se apaga, otros nodos pierden la pasarela. Agregue un enlace alterno que la rodee.`);
  }
  if (porcentajeConfiable < 60) {
    const sugerencia =
      preset.id === "LONG_FAST" || preset.id === "LONG_MODERATE" || preset.id === "LONG_SLOW"
        ? "Agregue nodos antena en las zonas naranja y roja o eleve los existentes."
        : `Agregue nodos antena o eleve los existentes; el preset Long Fast da ${fmt(presetPorId(p.preset).sensibilidadDbm - presetPorId("LONG_FAST").sensibilidadDbm)} dB más de margen que ${preset.nombre}.`;
    recomendaciones.push(`La cobertura confiable es ${fmt(porcentajeConfiable)} % del área de estudio. ${sugerencia}`);
  }
  if (pasarelas.length === 1 && antenas.length > 3) recomendaciones.push("Hay una sola pasarela: una segunda pasarela da respaldo si la primera falla.");
  if (p.frecuenciaMhz < BANDA_LIBRE_MHZ.min || p.frecuenciaMhz > BANDA_LIBRE_MHZ.max) {
    recomendaciones.push(`La frecuencia ${fmt(p.frecuenciaMhz, 3)} MHz está fuera de la banda de uso libre 915–928 MHz (ANE, Resolución 000028 de 2026). Configure el canal dentro de esa banda.`);
  }

  const puntaje = Math.round(
    (conectada ? 30 : desconectadas.length < antenas.length ? 10 : 0) +
      (criterios[2].ok ? 15 : 5) +
      (criterios[3].ok ? 20 : 10) +
      Math.min(25, (porcentajeConfiable / 60) * 25) +
      (criterios[5].ok ? 10 : 4),
  );
  let nivel: Factibilidad["nivel"];
  if (!conectada || porcentajeServicio < 30) nivel = "no-factible";
  else if (criterios.slice(0, 5).every((c) => c.ok)) nivel = "factible";
  else nivel = "ajustes";
  const titulo = { factible: "Factible", ajustes: "Factible con ajustes", "no-factible": "No factible todavía" }[nivel];
  if (nivel === "factible" && recomendaciones.length === 0) recomendaciones.push("La red cumple los criterios. Valide en campo con una prueba de alcance (Range Test de Meshtastic).");
  return { nivel, titulo, puntaje: Math.min(100, Math.max(0, puntaje)), criterios, recomendaciones };
}

export const COLORES_ENLACE = ENLACES;
