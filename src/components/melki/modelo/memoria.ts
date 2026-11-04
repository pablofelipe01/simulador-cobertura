// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El Modelo Melki en el navegador: se carga una sola vez (sus pesos vienen aparte, para no demorar el arranque), se
// puede apagar en Ajustes, y recuerda en este navegador las frases que la persona le aclaró (nada sale del equipo).
// Hay un modelo por idioma: el de español (src/datos/modelo/melki.json) y el de inglés (melki-en.json, que se baja
// solo si se usa el inglés: la pantalla en inglés o, v17.3, un mensaje en inglés). Los dos entienden las mismas
// intenciones; lo aprendido se guarda por idioma, porque cada modelo recuerda las frases como las ve él.
import { idioma, type Idioma } from "@/lib/idioma";
import type { Recuerdo } from "./entender";
import { cargarModelo, type Modelo, type ModeloJson } from "./modelo";
import { normalizarFrase } from "./rasgos";

const CLAVE_PREFERENCIA = "simulador-cobertura-melki-modelo";
const CLAVE_MEMORIA = "simulador-cobertura-melki-modelo-memoria";
/** Lo aprendido en inglés va aparte (la clave de español es la de siempre). */
const CLAVE_MEMORIA_EN = "simulador-cobertura-melki-modelo-memoria-en";
const claveMemoria = (i: Idioma) => (i === "en" ? CLAVE_MEMORIA_EN : CLAVE_MEMORIA);
/** Cuántas frases aprendidas se guardan como máximo (las más viejas se olvidan primero). */
export const MAX_RECUERDOS = 300;

export type PreferenciaModelo = { activo: boolean };

/** Los pesos de cada idioma: cada uno en su propio pedazo, que se baja la primera vez que se pide. */
const PESOS: Record<Idioma, () => Promise<unknown>> = {
  es: () => import("@/datos/modelo/melki.json"),
  en: () => import("@/datos/modelo/melki-en.json"),
};

const cargando: Record<Idioma, Promise<Modelo> | null> = { es: null, en: null };
const listo: Record<Idioma, Modelo | null> = { es: null, en: null };
const idiomaDe = new WeakMap<Modelo, Idioma>();
/** Los idiomas cuyo modelo ya se pidió (para traer el del otro idioma cuando la pantalla cambia). */
const pedidos = new Set<Idioma>();

/**
 * Carga el modelo del idioma de la pantalla (o del que se pida): una sola vez por idioma, unos milisegundos después de
 * bajar sus pesos.
 */
export function cargarModeloMelki(i: Idioma = idioma()): Promise<Modelo> {
  pedidos.add(i);
  const p =
    cargando[i] ??
    PESOS[i]().then((j) => {
      const m = cargarModelo(((j as { default?: unknown }).default ?? j) as ModeloJson);
      idiomaDe.set(m, i);
      listo[i] = m;
      return m;
    });
  cargando[i] = p;
  p.catch(() => {
    if (cargando[i] === p) cargando[i] = null;
  });
  return p;
}

/**
 * El modelo del idioma de la pantalla, si ya está cargado. Si la pantalla cambió de idioma después de cargar el otro,
 * empieza a traer el de este (mientras llega, null: Melki sigue como sin modelo).
 */
export const modeloMelki = (i: Idioma = idioma()): Modelo | null => {
  if (!listo[i] && !pedidos.has(i) && pedidos.size) cargarModeloMelki(i).catch(() => undefined);
  return listo[i];
};

/** El idioma de un modelo cargado. */
export const idiomaDelModelo = (m: Modelo): Idioma => idiomaDe.get(m) ?? (/-en$/.test(m.version) ? "en" : "es");

export function leerPreferenciaModelo(): PreferenciaModelo {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_PREFERENCIA) ?? "null") as Partial<PreferenciaModelo> | null;
    return { activo: p?.activo !== false };
  } catch {
    return { activo: true };
  }
}

export function guardarPreferenciaModelo(p: PreferenciaModelo) {
  try {
    localStorage.setItem(CLAVE_PREFERENCIA, JSON.stringify(p));
  } catch {
    // Sin almacenamiento (ventana privada): vale para esta visita
  }
}

/** Lo aprendido de la persona en un idioma (por defecto, el de la pantalla). */
export function leerMemoria(i: Idioma = idioma()): Recuerdo[] {
  try {
    const m = JSON.parse(localStorage.getItem(claveMemoria(i)) ?? "[]") as Recuerdo[];
    return Array.isArray(m) ? m.filter((r) => typeof r?.f === "string" && typeof r?.i === "string" && (r.s === 1 || r.s === -1)) : [];
  } catch {
    return [];
  }
}

function guardarMemoria(m: Recuerdo[], i: Idioma) {
  try {
    localStorage.setItem(claveMemoria(i), JSON.stringify(m.slice(-MAX_RECUERDOS)));
  } catch {
    // Sin almacenamiento: lo aprendido dura esta visita
  }
}

/**
 * Recuerda (o corrige) cómo dice la persona algo: `s` = 1 si confirmó la intención, −1 si deshizo lo que el modelo
 * entendió. La frase se guarda como la ve el modelo (sin tildes, con «0» por cada número y «zlugar» por cada lugar):
 * así «arma 3 millas en Cumaral» también vale para «arma 5 millas en Restrepo». Se guarda en la memoria del idioma
 * del modelo que la entendió (y devuelve esa memoria).
 */
export function recordar(m: Modelo, frase: string, intencion: string, s: 1 | -1): Recuerdo[] {
  const i = idiomaDelModelo(m);
  const f = normalizarFrase(frase, m.lugares);
  if (!f) return leerMemoria(i);
  const memoria = leerMemoria(i).filter((r) => !(r.f === f && r.i === intencion));
  // Si confirmó otra intención para la misma frase, la anterior ya no vale
  const sin = s > 0 ? memoria.filter((r) => !(r.f === f && r.s > 0)) : memoria;
  const nueva = [...sin, { f, i: intencion, s, t: Date.now() }];
  guardarMemoria(nueva, i);
  return nueva;
}

/** Olvida lo aprendido de la persona: en un idioma, o (sin decir cuál) en los dos. */
export function olvidarMemoria(i?: Idioma) {
  for (const clave of i ? [claveMemoria(i)] : [CLAVE_MEMORIA, CLAVE_MEMORIA_EN]) {
    try {
      localStorage.removeItem(clave);
    } catch {
      // nada que borrar
    }
  }
}
