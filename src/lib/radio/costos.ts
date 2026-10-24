// Costo interno de la infraestructura, solo para que el ajuste automático compare opciones (cobertura frente a
// costo). No se muestra como cotización. Parte de los precios del documento de Trama (catálogo del cotizador, TRM
// 3.158 con envío, arancel e IVA): el repetidor es el SenseCAP Solar Node P1 con antena de 8 dBi en un tubo de 6 m y
// el gateway va en una torre arriostrada de 12 m con su mini PC, radios y Starlink. Las alturas que el documento no
// trae se extrapolan de esos dos puntos (tramos de 3 m de torre arriostrada); por encima de 30 m hace falta una torre
// autosoportada, que el ajuste nunca propone.
import { patronPorId } from "./patron";
import type { Antena } from "./tipos";
import { CATALOGO, OPERACION_TRAMA, PRECIOS, unitarioCop } from "./trama";

/** Alturas de torre que considera el ajuste (m): el tubo de 6 m de Trama y torre arriostrada en tramos de 3 m. */
export const ALTURAS_TORRE = [6, 9, 12, 15, 18, 21, 24, 27, 30] as const;
/** Por encima de 30 m hace falta una torre autosoportada: el ajuste nunca la propone. */
export const ALTURA_MAXIMA_M = 30;

const precio = (id: string) => {
  const it = CATALOGO.find((x) => x.id === id);
  return it ? unitarioCop(it) : 0;
};
/** Mástil de Trama: tubo de hierro de 6 m, herrajes y base en concreto. */
const MASTIL_6 = precio("tubo") + precio("herrajes") + precio("base");
/** Torre arriostrada de 12 m del documento (secciones, templetes y base). */
const TORRE_12 = precio("torre");

/** Estructura instalada según la altura (m → pesos): 6 m y 12 m del documento; el resto, extrapolado. */
const TORRE: [number, number][] = [
  [0, 0],
  [3, Math.round(MASTIL_6 * 0.6)],
  [6, MASTIL_6],
  // Dos tubos empalmados con doble juego de templetes
  [9, Math.round((MASTIL_6 + TORRE_12) / 2)],
  [12, TORRE_12],
  // Torre arriostrada: cada tramo de 3 m suma sección, templetes y un poco más de base
  [15, Math.round(TORRE_12 * 1.32)],
  [18, Math.round(TORRE_12 * 1.68)],
  [21, Math.round(TORRE_12 * 2.08)],
  [24, Math.round(TORRE_12 * 2.52)],
  [27, Math.round(TORRE_12 * 3)],
  [30, Math.round(TORRE_12 * 3.55)],
];
/** Torre autosoportada de más de 30 m, instalada (referencia: por qué no se propone). */
const TORRE_AUTOSOPORTADA = 150_000_000;

/** Meses de operación que entran en la comparación (3 años). */
const MESES = 36;
/** Repetidor sin el mástil: P1, pilas, antena de 8 dBi y cable CFD400. */
const REPETIDOR_SIN_MASTIL = PRECIOS.repetidor - MASTIL_6;
/** Repetidor: instalación y operación (pila y visita cada 3 años). */
const OPERACION_REPETIDOR = OPERACION_TRAMA.instalacionRepetidor + MESES * ((OPERACION_TRAMA.bateriaRepetidor + OPERACION_TRAMA.visitaRepetidor) / OPERACION_TRAMA.vidaBateriaMeses);
/** Sitio gateway sin la torre: mini PC, hub, UPS, caja, tierra, kit solar, una radio y el Starlink con su kit solar. */
const GATEWAY_SIN_TORRE = PRECIOS.sitioBase - TORRE_12 + PRECIOS.radio + PRECIOS.starlink;
/** Gateway: instalación del sitio, mantenimiento y Starlink comercial. */
const OPERACION_GATEWAY = OPERACION_TRAMA.instalacionSitio + MESES * (OPERACION_TRAMA.mantenimientoSitioMes + OPERACION_TRAMA.starlinkMesComercial);
/** Diferencia de cada tipo de antena frente a la omnidireccional de 8 dBi (con su cable). */
const ANTENA: Record<string, number> = { omni: 0, yagi: 50_000, panel: 600_000, "sectorial-90": 850_000, "sectorial-120": 850_000, parabolica: 1_100_000 };
/** Correr un nodo a otro sitio cercano: visita, acceso y permiso del predio. */
export const COSTO_REUBICAR = 350_000;

export function costoTorre(alturaM: number): number {
  if (alturaM > ALTURA_MAXIMA_M) return TORRE_AUTOSOPORTADA + (alturaM - ALTURA_MAXIMA_M) * 3_000_000;
  for (let i = 1; i < TORRE.length; i++) {
    const [h1, c1] = TORRE[i];
    if (alturaM <= h1) {
      const [h0, c0] = TORRE[i - 1];
      return c0 + ((c1 - c0) * (alturaM - h0)) / (h1 - h0);
    }
  }
  return TORRE[TORRE.length - 1][1];
}

/** Costo de un nodo antena de infraestructura (las personas y nodos de campo no cuentan: son de los usuarios). */
export function costoNodo(a: Antena): number {
  if ((a.tipo ?? "antena") !== "antena") return 0;
  const antena = ANTENA[patronPorId(a.patron).id] ?? 0;
  const base = a.pasarela ? GATEWAY_SIN_TORRE + OPERACION_GATEWAY : REPETIDOR_SIN_MASTIL + OPERACION_REPETIDOR;
  return base + costoTorre(a.alturaM) + antena;
}

/** Costo de referencia de un repetidor de apoyo típico (P1 en tubo de 6 m): escala para comparar mejoras. */
export const COSTO_APOYO_TIPICO = REPETIDOR_SIN_MASTIL + OPERACION_REPETIDOR + costoTorre(6);
