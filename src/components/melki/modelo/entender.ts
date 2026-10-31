// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Cómo usa Melki su modelo: con lo que el modelo cree que se pidió, los datos del pedido y lo aprendido de la persona,
// decide si lo hace (seguro), lo ofrece con un botón (si borra o reemplaza algo), contesta el tema, pregunta
// «¿quiso decir…?», dice que está fuera del simulador o no hace nada (y Melki sigue como antes). Nada aquí toca el mapa:
// la orden se arma en palabras que el intérprete verifica y hace.
import type { Api, Orden } from "../ordenes";
import { INTENCION, type Intencion } from "./intenciones";
import { analizar, parecido, vectorFrase, type Candidato, type Modelo } from "./modelo";
import { extraerRanuras, type Ranuras } from "./ranuras";
import { normalizarFrase } from "./rasgos";

/** Una frase que la persona confirmó (+1, tocó el botón) o deshizo (−1) para una intención. */
export type Recuerdo = { f: string; i: string; s: 1 | -1; t: number };

/** Lo que se puede hacer con una intención: la frase de la orden, la orden directa o el tema. */
export type Opcion = { id: string; p: number; texto: string; frase?: string; orden?: Orden; tema?: string; delicada: boolean };

export type Decision =
  | { tipo: "hacer"; opcion: Opcion; aprendida: boolean }
  | { tipo: "confirmar"; opcion: Opcion; aprendida: boolean }
  | { tipo: "tema"; opcion: Opcion; aprendida: boolean }
  | { tipo: "aclarar"; opciones: Opcion[] }
  /** Entendió qué se pide pero falta un dato que no se puede suponer («borra el repetidor» sin decir cuál). */
  | { tipo: "falta"; intencion: Intencion; p: number }
  | { tipo: "fuera"; p: number }
  | { tipo: "nada"; motivo: "desconocidas" | "ruido" | "dudoso" | "vacio" };

/** Qué tan parecida debe ser una frase a una aprendida para usar lo aprendido. */
export const PARECIDO_APRENDIDO = 0.93;

const vectores = new Map<string, Float32Array | null>();
const vectorDe = (m: Modelo, f: string) => {
  const k = `${m.version}|${f}`;
  if (!vectores.has(k)) vectores.set(k, vectorFrase(m, f));
  return vectores.get(k) ?? null;
};

/** Aplica lo aprendido de la persona: lo que confirmó sube al primer lugar; lo que deshizo, sale. */
export function conMemoria(m: Modelo, texto: string, candidatos: Candidato[], memoria: Recuerdo[]): { candidatos: Candidato[]; aprendida: string | null } {
  if (!memoria.length) return { candidatos, aprendida: null };
  const norm = normalizarFrase(texto, m.lugares);
  const v = vectorDe(m, norm);
  let si: { id: string; s: number } | null = null;
  const no = new Set<string>();
  for (const r of memoria) {
    const sim = r.f === norm ? 1 : v ? parecido(v, vectorDe(m, r.f) ?? v.map(() => 0)) : 0;
    if (sim < PARECIDO_APRENDIDO) continue;
    if (r.s < 0) no.add(r.i);
    else if (!si || sim > si.s) si = { id: r.i, s: sim };
  }
  let lista = candidatos.filter((c) => !no.has(c.id));
  let aprendida: string | null = null;
  if (si && !no.has(si.id) && INTENCION.has(si.id)) {
    aprendida = si.id;
    const p = Math.max(0.99, lista.find((c) => c.id === si.id)?.p ?? 0);
    lista = [{ id: si.id, p }, ...lista.filter((c) => c.id !== si.id)];
  }
  return { candidatos: lista, aprendida };
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** La opción que da una intención con los datos del pedido (null si no se puede: faltan datos o no se entiende). */
export function opcionDe(c: Candidato, r: Ranuras, verificar?: (frase: string) => boolean): Opcion | null {
  const it = INTENCION.get(c.id);
  if (!it || it.grupo === "fuera") return null;
  const base = { id: it.id, p: c.p, delicada: Boolean(it.delicada) };
  if (it.frase) {
    const frase = it.frase(r);
    if (!frase || (verificar && !verificar(frase))) return null;
    return { ...base, texto: mayuscula(frase), frase };
  }
  if (it.directa) {
    const orden = it.directa(r);
    return orden ? { ...base, texto: it.nombre, orden } : null;
  }
  if (it.tema) return { ...base, texto: it.nombre, tema: it.tema };
  return null;
}

export type OpcionesEntender = {
  /** El simulador (para los nodos y los lugares del pedido). */
  api?: Api | null;
  /** Lo aprendido de la persona en este navegador. */
  memoria?: Recuerdo[];
  /** ¿Melki entiende esta frase? (el intérprete u otra parte de Melki la toma). */
  verificar?: (frase: string) => boolean;
};

/** Lo que Melki hace con una frase que ni el intérprete ni el cerebro entendieron. */
export function entender(m: Modelo, texto: string, o: OpcionesEntender = {}): Decision {
  if (!texto.trim()) return { tipo: "nada", motivo: "vacio" };
  const a = analizar(m, texto, 6);
  if (!a.candidatos.length) return { tipo: "nada", motivo: "desconocidas" };
  const { candidatos, aprendida } = conMemoria(m, texto, a.candidatos, o.memoria ?? []);
  // Sin palabras con contenido («y el», «¿y ahora?») o casi todas desconocidas («¿cómo arreglo la nevera?»): su apuesta no vale
  if (!aprendida && !a.contenido) return { tipo: "nada", motivo: "ruido" };
  if (!aprendida && a.conocidas / a.contenido < 0.5) return { tipo: "nada", motivo: "desconocidas" };
  const u = m.umbrales;
  const [top, segundo] = candidatos;
  if (!top) return { tipo: "nada", motivo: "dudoso" };
  if (top.id === "ruido" && !aprendida) return { tipo: "nada", motivo: "ruido" };
  const r = extraerRanuras(texto, o.api ?? null);
  // Las opciones se arman (y se verifican) solo cuando hacen falta, de la más probable a la menos
  const hechas = new Map<string, Opcion | null>();
  const opcion = (c: Candidato) => {
    if (!hechas.has(c.id)) hechas.set(c.id, opcionDe(c, r, o.verificar));
    return hechas.get(c.id) ?? null;
  };
  const dudas = () =>
    candidatos
      .filter((c) => c.p >= 0.08 && c.id !== "fuera" && c.id !== "ruido")
      .slice(0, 4)
      .map(opcion)
      .filter((x): x is Opcion => Boolean(x))
      .slice(0, 3);
  if (top.id === "fuera") {
    if (top.p >= u.fuera) return { tipo: "fuera", p: top.p };
    const d = top.p < 0.6 ? dudas() : [];
    return d.length && d[0].p >= u.aclarar ? { tipo: "aclarar", opciones: d } : { tipo: "nada", motivo: "dudoso" };
  }
  const it = INTENCION.get(top.id);
  const op = opcion(top);
  const seguro = Boolean(aprendida === top.id) || (top.p >= u.hacer && top.p - (segundo?.p ?? 0) >= u.margen);
  if (op) {
    if (op.tema) {
      if (aprendida === top.id || top.p >= u.tema) return { tipo: "tema", opcion: op, aprendida: aprendida === top.id };
    } else if (seguro) return { tipo: op.delicada ? "confirmar" : "hacer", opcion: op, aprendida: aprendida === top.id };
  } else if (it && (it.frase || it.directa)) {
    // Entendió una orden que no se puede armar: si falta un dato, lo pide; si no, solo ofrece otras órdenes que sí
    // se pueden (no un tema: «agrega un dron a la malla» no pregunta cómo funciona la malla)
    if (seguro && it.ejemplo) return { tipo: "falta", intencion: it, p: top.p };
    const otras = candidatos
      .filter((c) => c.p >= 0.15 && c.id !== top.id && INTENCION.get(c.id)?.grupo !== "pregunta" && !INTENCION.get(c.id)?.tema)
      .slice(0, 3)
      .map(opcion)
      .filter((x): x is Opcion => Boolean(x));
    return otras.length ? { tipo: "aclarar", opciones: otras } : { tipo: "nada", motivo: "dudoso" };
  }
  const d = dudas();
  if (top.p >= u.aclarar && d.length) return { tipo: "aclarar", opciones: d };
  return { tipo: "nada", motivo: "dudoso" };
}
