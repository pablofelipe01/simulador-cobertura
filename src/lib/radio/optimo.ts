// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// v17.2 · El criterio de óptimo de Melki: óptimo no es la red con más antenas sino el punto entre la estabilidad de la
// señal y el costo. Para cada nodo antena se mide, con la simulación, lo que aporta por sí solo (el área que se quedaría
// sin señal media o mejor si se quitara), cuánto de lo suyo ya lo cubren otros nodos y quién depende de él para llegar
// al gateway; y para la red, si cumple su meta y qué repetidores se pueden quitar juntos sin bajar de ella. Con eso
// Melki cuestiona las antenas que sobran y responde «¿necesito más antenas?». Las cifras salen del cálculo.
import { celdasEnPoligono, coberturaEnArea, porcentajeSobre, type Poligono } from "./area";
import { areaPoligonoM2, latAMercator, lonAMercator, mercatorALat } from "./geo";
import type { ResultadoSimulacion } from "./tipos";

/** Señal media o mejor: la cobertura útil (dB de margen). */
export const UMBRAL_UTIL_DB = 30;
/** Un nodo que suma menos que esto (% del área) no justifica su costo cuando la red ya cumple sin él. */
export const APORTE_MINIMO_PCT = 2;
/** Un nodo con al menos esta parte de su cobertura ya cubierta por otros casi no suma (%). */
export const SOLAPE_ALTO_PCT = 90;
/** Sin área objetivo: un repetidor sobra si, quitándolo, se pierde menos que esto de lo que él cubre (%). */
const PERDIDA_PROPIA_MAX_PCT = 10;

/** Dónde se mide el óptimo: el área objetivo (con su meta) o, sin ella, el área de estudio de la simulación. */
export type ZonaOptimo = { poligono: Poligono; metaPct: number; margenDb: number; respaldo?: boolean } | null;

export type AporteNodo = {
  id: string;
  nombre: string;
  gateway: boolean;
  /** Área con señal media o mejor de este nodo dentro de la zona medida (km²). */
  propiaKm2: number;
  /** Lo que se perdería sin él (km² y % de la zona). */
  unicaKm2: number;
  unicaPct: number;
  /** Parte de su cobertura que ya cubren otros nodos con la misma señal (%). */
  solapePct: number;
  /** Nodos que se quedarían sin salida al gateway sin él (es paso obligado: «crítico» en la malla). */
  dependientes: number;
};

export type AnalisisOptimo = {
  donde: "objetivo" | "estudio";
  areaKm2: number;
  margenDb: number;
  /** % de la zona con la señal pedida (media o mejor, salvo que el área objetivo pida otra). */
  utilPct: number;
  /** La meta del área objetivo (null sin área objetivo) y si se cumple. */
  metaPct: number | null;
  cumple: boolean | null;
  respaldo: boolean;
  aportes: AporteNodo[];
  /** Repetidores que se pueden quitar juntos sin bajar de la meta (o, sin área objetivo, sin perder casi nada). */
  sobran: { ids: string[]; utilSinEllosPct: number };
};

type Infra = { id: string; nombre: string; pasarela?: boolean; tipo?: string; activa?: boolean; rol?: string };

/**
 * Los nodos de la simulación que llegan a un gateway sin los `quitados` (como en la malla: desde los gateways, y solo
 * los repetidores reenvían). Sirve para no quitar juntos dos repetidores que, cada uno por su lado, no eran paso
 * obligado, pero entre los dos sí (el nodo de más allá se quedaría sin salida).
 */
function alcanzables(r: ResultadoSimulacion, porId: Map<string, Infra>, quitados: Set<string>): Set<string> {
  const vecinos = new Map<string, string[]>();
  const unir = (a: string, b: string) => {
    const l = vecinos.get(a);
    if (l) l.push(b);
    else vecinos.set(a, [b]);
  };
  for (const e of r.enlaces) {
    if (e.clase === "sin" || quitados.has(e.a) || quitados.has(e.b)) continue;
    unir(e.a, e.b);
    unir(e.b, e.a);
  }
  const vistos = new Set<string>();
  const cola: string[] = [];
  for (const nd of r.nodos)
    if (porId.get(nd.id)?.pasarela && !quitados.has(nd.id)) {
      vistos.add(nd.id);
      cola.push(nd.id);
    }
  for (let k = 0; k < cola.length; k++) {
    const x = porId.get(cola[k]);
    if (!x?.pasarela && x?.rol !== "REPETIDOR") continue;
    for (const v of vecinos.get(cola[k]) ?? [])
      if (!vistos.has(v)) {
        vistos.add(v);
        cola.push(v);
      }
  }
  return vistos;
}

/** Las celdas del área de estudio (con su área en km²), cuando no hay área objetivo. */
function celdasDeEstudio(r: ResultadoSimulacion): { indices: Int32Array; areas: Float64Array } {
  const { caja, ancho, alto } = r.malla;
  const x0 = lonAMercator(caja.oeste);
  const celda = (lonAMercator(caja.este) - x0) / ancho;
  const y1 = latAMercator(caja.norte);
  const indices: number[] = [];
  const areas: number[] = [];
  for (let j = 0; j < alto; j++) {
    const lat = mercatorALat(y1 - (j + 0.5) * celda);
    const lado = celda * Math.cos((lat * Math.PI) / 180);
    const area = (lado * lado) / 1e6;
    for (let i = 0; i < ancho; i++) {
      const c = j * ancho + i;
      if (Number.isNaN(r.mejor[c])) continue;
      indices.push(c);
      areas.push(area);
    }
  }
  return { indices: Int32Array.from(indices), areas: Float64Array.from(areas) };
}

/**
 * El óptimo de la red simulada: el aporte de cada nodo antena, la meta y los repetidores que sobran. `infra` son los
 * nodos del escenario (para saber cuáles son gateways y los nombres); los que no están en la simulación no cuentan.
 */
export function analizarOptimo(r: ResultadoSimulacion, infra: Infra[], zona: ZonaOptimo): AnalisisOptimo {
  const total = r.malla.ancho * r.malla.alto;
  const margenDb = zona?.margenDb ?? UMBRAL_UTIL_DB;
  const porId = new Map(infra.map((a) => [a.id, a]));
  let indices: Int32Array;
  let areas: Float64Array;
  let areaKm2: number;
  let utilPct: number;
  if (zona && zona.poligono.length >= 3) {
    const c = celdasEnPoligono(r.malla, zona.poligono);
    indices = c.indices;
    areas = c.areas;
    // La cobertura frente a la meta es la misma del panel de resultados: con respaldo pedido, la del segundo mejor nodo
    // (dos nodos por punto). Si la simulación ya la midió para esta misma área, se usa esa (no se recorre otra vez)
    const ao = r.areaObjetivo;
    const area = areaPoligonoM2(zona.poligono) / 1e6;
    if (ao && ao.metaPct === zona.metaPct && ao.margenDb === margenDb && Boolean(ao.respaldo) === Boolean(zona.respaldo) && Math.abs(ao.areaKm2 - area) <= 1e-9 * Math.max(1, area)) {
      areaKm2 = ao.areaKm2;
      utilPct = ao.utilPct;
    } else {
      const cob = coberturaEnArea(r, zona.poligono, zona.respaldo ? "segundo" : "mejor");
      areaKm2 = cob.areaKm2;
      utilPct = porcentajeSobre(cob, margenDb);
    }
  } else {
    const c = celdasDeEstudio(r);
    indices = c.indices;
    areas = c.areas;
    areaKm2 = r.areaEstudioKm2;
    let si = 0;
    for (let k = 0; k < indices.length; k++) if (r.mejor[indices[k]] >= margenDb) si += areas[k];
    utilPct = areaKm2 > 0 ? (100 * si) / areaKm2 : 0;
  }
  const n = r.antenas.length;
  // Cuántos nodos dan la señal pedida en cada celda de la zona
  const cuenta = new Uint8Array(indices.length);
  for (let a = 0; a < n; a++) {
    const base = a * total;
    for (let k = 0; k < indices.length; k++) if (r.porAntena[base + indices[k]] >= margenDb && cuenta[k] < 255) cuenta[k]++;
  }
  const rutas = r.nodos;
  const aportes: AporteNodo[] = r.antenas.map((ra, a) => {
    const base = a * total;
    let propia = 0;
    let unica = 0;
    for (let k = 0; k < indices.length; k++) {
      if (r.porAntena[base + indices[k]] < margenDb) continue;
      propia += areas[k];
      if (cuenta[k] === 1) unica += areas[k];
    }
    // Solo cuenta como paso obligado si es crítico (sin él otros pierden el gateway); si hay otra ruta, no
    const critico = rutas.find((x) => x.id === ra.id)?.critico ?? false;
    const dependientes = critico ? Math.max(1, rutas.filter((x) => x.id !== ra.id && x.ruta.includes(ra.id)).length) : 0;
    return {
      id: ra.id,
      nombre: porId.get(ra.id)?.nombre ?? ra.nombre,
      gateway: Boolean(porId.get(ra.id)?.pasarela),
      propiaKm2: propia,
      unicaKm2: unica,
      unicaPct: areaKm2 > 0 ? (100 * unica) / areaKm2 : 0,
      solapePct: propia > 0 ? (100 * (propia - unica)) / propia : 0,
      dependientes,
    };
  });
  const metaPct = zona ? zona.metaPct : null;
  const cumple = metaPct === null ? null : utilPct >= metaPct - 1e-6;
  const respaldo = Boolean(zona?.respaldo);

  // Los que sobran, juntos: se quitan de menor a mayor aporte mientras la red siga en la meta (o, sin área objetivo,
  // mientras cada uno pierda menos del 10 % de lo que cubre); nunca un gateway ni un paso obligado de otros nodos, ni
  // dos que juntos dejarían a otro nodo sin salida al gateway
  const sobran: string[] = [];
  let perdida = 0;
  if (!respaldo) {
    const restante = Uint8Array.from(cuenta);
    const indice = new Map(r.antenas.map((x, a) => [x.id, a]));
    const llegan = alcanzables(r, porId, new Set());
    const candidatos = aportes.filter((x) => !x.gateway && x.dependientes === 0 && (x.propiaKm2 > 0 || metaPct !== null)).sort((p, q) => p.unicaKm2 - q.unicaKm2);
    for (const c of candidatos) {
      const a = indice.get(c.id)!;
      const base = a * total;
      let nueva = 0;
      for (let k = 0; k < indices.length; k++) if (r.porAntena[base + indices[k]] >= margenDb && restante[k] === 1) nueva += areas[k];
      const sinEl = utilPct - (100 * (perdida + nueva)) / Math.max(areaKm2, 1e-9);
      const vale = metaPct !== null ? sinEl >= metaPct - 1e-6 && (100 * nueva) / Math.max(areaKm2, 1e-9) < APORTE_MINIMO_PCT : (100 * nueva) / c.propiaKm2 < PERDIDA_PROPIA_MAX_PCT;
      if (!vale) continue;
      const quitados = new Set([...sobran, c.id]);
      const siguen = alcanzables(r, porId, quitados);
      if ([...llegan].some((id) => !quitados.has(id) && !siguen.has(id))) continue;
      sobran.push(c.id);
      perdida += nueva;
      for (let k = 0; k < indices.length; k++) if (r.porAntena[base + indices[k]] >= margenDb) restante[k]--;
    }
  }
  return {
    donde: zona ? "objetivo" : "estudio",
    areaKm2,
    margenDb,
    utilPct,
    metaPct,
    cumple,
    respaldo,
    aportes,
    sobran: { ids: sobran, utilSinEllosPct: utilPct - (100 * perdida) / Math.max(areaKm2, 1e-9) },
  };
}

/** ¿La red cumple la meta del área objetivo sin este nodo (sin lo que solo él cubre)? */
export function cumpleSinNodo(o: AnalisisOptimo, x: AporteNodo): boolean {
  return o.metaPct !== null && o.utilPct - x.unicaPct >= o.metaPct - 1e-6;
}

/**
 * ¿Hay que cuestionar este nodo recién puesto? Solo un repetidor que nadie necesita para llegar al gateway y que casi no
 * suma: la red ya cumple su meta sin él (y aporta menos del 2 % del área objetivo); o, si la red no llega a su meta ni
 * con él, el 90 % o más de lo que cubre ya lo cubren otros (no está donde falta). Si es él quien deja la red en la meta,
 * hace falta. Sin área objetivo, sobra el que repite el 90 % o más. Con respaldo pedido, cubrir lo mismo dos veces es
 * justamente la idea: no se cuestiona.
 */
export function sobraNodo(o: AnalisisOptimo, id: string): AporteNodo | null {
  const x = o.aportes.find((a) => a.id === id);
  if (!x || x.gateway || x.dependientes > 0 || o.respaldo) return null;
  if (o.metaPct !== null) {
    if (cumpleSinNodo(o, x)) return x.unicaPct < APORTE_MINIMO_PCT ? x : null;
    if (o.cumple) return null;
    return x.propiaKm2 > 0 && x.solapePct >= SOLAPE_ALTO_PCT && x.unicaPct < 0.5 ? x : null;
  }
  // Sin área objetivo no hay meta: sobra si casi todo lo que cubre ya lo cubren otros
  return x.propiaKm2 > 0 && x.solapePct >= SOLAPE_ALTO_PCT ? x : null;
}
