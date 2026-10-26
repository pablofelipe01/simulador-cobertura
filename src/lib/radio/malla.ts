// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Enlaces entre nodos, comportamiento de la red mesh (saltos, puntos críticos) y factibilidad.
import { BANDA_LIBRE_MHZ, DISTANCIA_MINIMA_M, ENLACES, META_UTIL_ESTUDIO_PCT, presetPorId, presetsDe, UMBRAL_CONFIABLE_DB, UMBRAL_UTIL_DB } from "./constantes";
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
const fmtMeta = (n: number) => (Number.isInteger(n) ? String(n) : n >= 99.95 && n < 100 ? "99,9" : n.toFixed(1).replace(".", ","));

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

/** En MeshCore solo los repetidores reenvían paquetes de otros; las billeteras y la radio del gateway no. */
export function retransmite(a: Antena): boolean {
  return a.rol === "REPETIDOR";
}

/**
 * Enlaces entre nodos. Se calcula cada pareja en la que al menos uno retransmite o es el gateway: dos billeteras
 * nunca se pasan los mensajes entre sí, así que con cientos de personas no se calculan sus parejas.
 */
export function calcularEnlaces(antenas: Antena[], p: Parametros, relieve: Relieve): Enlace[] {
  const lambda = longitudOnda(p.frecuenciaMhz);
  const red = calculoRed(p);
  const enlaces: Enlace[] = [];
  const util = antenas.map((a) => retransmite(a) || a.pasarela);
  for (let i = 0; i < antenas.length; i++)
    for (let k = i + 1; k < antenas.length; k++) {
      if (!util[i] && !util[k]) continue;
      enlaces.push(enlaceEntre(antenas[i], antenas[k], p, relieve, red, lambda));
    }
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

/** Saltos (enlaces) desde la pasarela más cercana. Solo retransmiten los repetidores (MeshCore). */
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
    // Un nodo que no retransmite recibe, pero no reenvía (salvo que sea la pasarela, donde empieza la búsqueda).
    if (!nodo.pasarela && !retransmite(nodo)) continue;
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
 * Ruta más robusta hacia una pasarela con un máximo de `limite` saltos: maximiza el margen del enlace más débil
 * (cuello de botella). En MeshCore el primer mensaje se inunda y la ruta que gana queda guardada para los demás.
 */
function rutasRobustas(antenas: Antena[], g: Grafo, limite: number) {
  const porId = new Map(antenas.map((a) => [a.id, a]));
  let actual = new Map<string, { cuello: number; ruta: string[] }>();
  for (const a of antenas) if (a.pasarela) actual.set(a.id, { cuello: Infinity, ruta: [a.id] });
  // Una ruta solo pasa por repetidores: nunca tiene más saltos que repetidores + 1. Si una vuelta no mejora nada,
  // las siguientes tampoco (con cientos de personas pobladas, esto evita cientos de vueltas inútiles).
  const reenvian = antenas.filter((a) => a.pasarela || retransmite(a)).length;
  const vueltas = Math.min(limite, reenvian + 1);
  for (let k = 1; k <= vueltas; k++) {
    const nuevo = new Map(actual);
    let cambio = false;
    for (const [u, info] of actual) {
      const nodo = porId.get(u)!;
      if (!nodo.pasarela && !retransmite(nodo)) continue;
      for (const w of g.get(u) ?? []) {
        if (porId.get(w.id)?.pasarela || info.ruta.includes(w.id)) continue;
        const cuello = Math.min(info.cuello, w.margen);
        const previo = nuevo.get(w.id);
        if (!previo || cuello > previo.cuello) {
          nuevo.set(w.id, { cuello, ruta: [w.id, ...info.ruta] });
          cambio = true;
        }
      }
    }
    actual = nuevo;
    if (!cambio) break;
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
    if (!a.pasarela && saltos.has(a.id) && retransmite(a)) {
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

/** Cobertura dentro del área objetivo (si la hay), con su meta. */
export type CoberturaObjetivo = { nombre: string; metaPct: number; margenDb: number; utilPct: number; confiablePct: number; servicioPct: number };

type DatosFactibilidad = {
  antenas: Antena[];
  parametros: Parametros;
  enlaces: Enlace[];
  analisis: AnalisisMalla;
  porcentajeServicio: number;
  porcentajeConfiable: number;
  porcentajeRespaldo: number;
  /** % del área de estudio con señal media o mejor (≥ 30 dB). */
  porcentajeUtil: number;
  /** Con un área objetivo, la cobertura se evalúa ahí y contra su meta. */
  objetivo?: CoberturaObjetivo | null;
};

const nombreSenal = (margenDb: number) => (margenDb >= 45 ? "señal buena" : margenDb >= UMBRAL_CONFIABLE_DB ? "señal estable o mejor" : margenDb >= UMBRAL_UTIL_DB ? "señal media o mejor" : "servicio");

export function evaluarFactibilidad(d: DatosFactibilidad): Factibilidad {
  const { parametros: p, enlaces, analisis } = d;
  // Las personas de «Poblar personas» son una prueba de densidad: se cuentan aparte, no en la infraestructura
  const antenas = d.antenas.filter((a) => !a.poblada);
  // Cobertura útil (señal media o mejor) en el área objetivo, si la hay, o en el área de estudio
  const obj = d.objetivo ?? null;
  const util = obj ? obj.utilPct : d.porcentajeUtil;
  const confiable = obj ? obj.confiablePct : d.porcentajeConfiable;
  const servicio = obj ? obj.servicioPct : d.porcentajeServicio;
  const meta = obj ? obj.metaPct : META_UTIL_ESTUDIO_PCT;
  const margenUtil = obj ? obj.margenDb : UMBRAL_UTIL_DB;
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
      nombre: obj ? `Cobertura útil ≥ ${fmtMeta(meta)} % del área objetivo` : `Cobertura útil ≥ ${META_UTIL_ESTUDIO_PCT} % del área de estudio`,
      ok: util >= meta - 1e-9,
      detalle: `${fmt(util)} %${obj ? ` de «${obj.nombre}»` : ""} con ${nombreSenal(margenUtil)} (≥ ${margenUtil} dB) · ${fmt(confiable)} % confiable (≥ ${UMBRAL_CONFIABLE_DB} dB) · ${fmt(servicio)} % con servicio.`,
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
      `${a.nombre} está a ${nodo.get(a.id)?.saltos} saltos del gateway y el diseño pide ${p.limiteSaltos} como máximo. ${preset.protocolo === "meshtastic" ? "Meshtastic admite hasta 7 (el límite viaja en cada paquete y por encima no llega)" : "MeshCore admite hasta 64"}, pero cada salto suma tiempo en el aire a cada mensaje y le quita capacidad a la frecuencia: acerque un repetidor o ponga otro sitio gateway.`,
    );
  }
  for (const a of criticos) {
    recomendaciones.push(`${a.nombre} es un punto único de falla: si se apaga, otros nodos pierden la pasarela. Agregue un enlace alterno que la rodee.`);
  }
  if (util < meta - 1e-9) {
    const masLento = presetsDe(preset.protocolo).filter((x) => x.sensibilidadDbm < preset.sensibilidadDbm - 0.5).sort((x, y) => y.sensibilidadDbm - x.sensibilidadDbm)[0];
    const sugerencia = masLento
      ? `Agregue repetidores en las zonas naranja y roja o eleve los existentes; ${masLento.nombre} da ${fmt(preset.sensibilidadDbm - masLento.sensibilidadDbm)} dB más de margen que ${preset.nombre}, a cambio de capacidad`
      : "Agregue repetidores en las zonas naranja y roja o eleve los existentes";
    recomendaciones.push(`La cobertura útil (${nombreSenal(margenUtil)}) es ${fmt(util)} % ${obj ? `de «${obj.nombre}»` : "del área de estudio"} y la meta es ${fmtMeta(meta)} %. ${sugerencia}, o use «Ajústamelo automáticamente».`);
  }
  if (pasarelas.length === 1 && antenas.length > 3) recomendaciones.push("Hay una sola pasarela: una segunda pasarela da respaldo si la primera falla.");
  if (p.frecuenciaMhz < BANDA_LIBRE_MHZ.min || p.frecuenciaMhz > BANDA_LIBRE_MHZ.max) {
    recomendaciones.push(`La frecuencia ${fmt(p.frecuenciaMhz, 3)} MHz está fuera de la banda de uso libre 915–928 MHz (ANE, Resolución 000028 de 2026). Configure el canal dentro de esa banda.`);
  }

  const puntaje = Math.round(
    (conectada ? 30 : desconectadas.length < antenas.length ? 10 : 0) +
      (criterios[2].ok ? 15 : 5) +
      (criterios[3].ok ? 20 : 10) +
      Math.min(25, (util / meta) * 25) +
      (criterios[5].ok ? 10 : 4),
  );
  let nivel: Factibilidad["nivel"];
  if (!conectada || servicio < 30) nivel = "no-factible";
  else if (criterios.slice(0, 5).every((c) => c.ok)) nivel = "factible";
  else nivel = "ajustes";
  const titulo = { factible: "Factible", ajustes: "Factible con ajustes", "no-factible": "No factible todavía" }[nivel];
  if (nivel === "factible" && recomendaciones.length === 0) recomendaciones.push("La red cumple los criterios. Valide en campo: un mensaje de prueba desde cada zona y un recorrido con la billetera mirando la SNR de los repetidores.");
  return { nivel, titulo, puntaje: Math.min(100, Math.max(0, puntaje)), criterios, recomendaciones };
}

export const COLORES_ENLACE = ENLACES;
