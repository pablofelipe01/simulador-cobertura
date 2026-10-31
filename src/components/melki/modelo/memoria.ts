// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El Modelo Melki en el navegador: se carga una sola vez (sus pesos vienen aparte, para no demorar el arranque), se
// puede apagar en Ajustes, y recuerda en este navegador las frases que la persona le aclaró (nada sale del equipo).
import type { Recuerdo } from "./entender";
import { cargarModelo, type Modelo, type ModeloJson } from "./modelo";
import { normalizarFrase } from "./rasgos";

const CLAVE_PREFERENCIA = "simulador-cobertura-melki-modelo";
const CLAVE_MEMORIA = "simulador-cobertura-melki-modelo-memoria";
/** Cuántas frases aprendidas se guardan como máximo (las más viejas se olvidan primero). */
export const MAX_RECUERDOS = 300;

export type PreferenciaModelo = { activo: boolean };

let cargando: Promise<Modelo> | null = null;
let listo: Modelo | null = null;

/** Carga el modelo (una sola vez; unos milisegundos después de bajar sus pesos con la página). */
export function cargarModeloMelki(): Promise<Modelo> {
  cargando ??= import("@/datos/modelo/melki.json").then((j) => {
    listo = cargarModelo(((j as { default?: unknown }).default ?? j) as ModeloJson);
    return listo;
  });
  cargando.catch(() => {
    cargando = null;
  });
  return cargando;
}

export const modeloMelki = (): Modelo | null => listo;

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

export function leerMemoria(): Recuerdo[] {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE_MEMORIA) ?? "[]") as Recuerdo[];
    return Array.isArray(m) ? m.filter((r) => typeof r?.f === "string" && typeof r?.i === "string" && (r.s === 1 || r.s === -1)) : [];
  } catch {
    return [];
  }
}

function guardarMemoria(m: Recuerdo[]) {
  try {
    localStorage.setItem(CLAVE_MEMORIA, JSON.stringify(m.slice(-MAX_RECUERDOS)));
  } catch {
    // Sin almacenamiento: lo aprendido dura esta visita
  }
}

/**
 * Recuerda (o corrige) cómo dice la persona algo: `s` = 1 si confirmó la intención, −1 si deshizo lo que el modelo
 * entendió. La frase se guarda como la ve el modelo (sin tildes, con «0» por cada número y «zlugar» por cada lugar):
 * así «arma 3 millas en Cumaral» también vale para «arma 5 millas en Restrepo».
 */
export function recordar(m: Modelo, frase: string, intencion: string, s: 1 | -1): Recuerdo[] {
  const f = normalizarFrase(frase, m.lugares);
  if (!f) return leerMemoria();
  const memoria = leerMemoria().filter((r) => !(r.f === f && r.i === intencion));
  // Si confirmó otra intención para la misma frase, la anterior ya no vale
  const sin = s > 0 ? memoria.filter((r) => !(r.f === f && r.s > 0)) : memoria;
  const nueva = [...sin, { f, i: intencion, s, t: Date.now() }];
  guardarMemoria(nueva);
  return nueva;
}

export function olvidarMemoria() {
  try {
    localStorage.removeItem(CLAVE_MEMORIA);
  } catch {
    // nada que borrar
  }
}
