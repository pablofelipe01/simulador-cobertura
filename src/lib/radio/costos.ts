// Costo interno de la infraestructura, solo para que el ajuste automático compare opciones (cobertura frente a
// costo). No se muestra en la interfaz. Son precios de referencia en Colombia (pesos, consultados en octubre de
// 2026 en distribuidores de torres, electrónica y energía solar); lo que importa es la proporción entre opciones:
// del mástil liviano (hasta 12 m) a la torre riendada de celosía hay un salto de tecnología, y por encima de 30 m hace falta una torre
// autosoportada que cuesta unas 8 veces una riendada de 30 m.
import { patronPorId } from "./patron";
import type { Antena } from "./tipos";

/** Alturas de torre que considera el ajuste (m): mástil de 6 m y torre riendada en tramos de 3 m. */
export const ALTURAS_TORRE = [6, 9, 12, 15, 18, 21, 24, 27, 30] as const;
/** Por encima de 30 m hace falta una torre autosoportada: el ajuste nunca la propone. */
export const ALTURA_MAXIMA_M = 30;

/** Mástil o torre instalada según la altura (m → pesos): estructura, riendas, concreto, puesta a tierra, montaje y transporte. */
const TORRE: [number, number][] = [
  [0, 0],
  [3, 600_000],
  // Mástil de tubo galvanizado o telescópico riendado (sirve para un nodo liviano con antena omnidireccional)
  [6, 1_500_000],
  [9, 2_600_000],
  [12, 3_800_000],
  // Torre riendada de celosía (tramos de 3 m)
  [15, 10_400_000],
  [18, 12_000_000],
  [21, 13_600_000],
  [24, 15_200_000],
  [27, 16_800_000],
  [30, 18_400_000],
];
/** Torre autosoportada de más de 30 m, instalada (referencia: por qué no se propone). */
const TORRE_AUTOSOPORTADA = 150_000_000;

/** Nodo de infraestructura: radio en caja exterior, antena omnidireccional con cable y conectores, y kit solar. */
const NODO_INFRA = 1_600_000;
/** Montaje del nodo y la antena. */
const INSTALACION = 600_000;
/**
 * Sitio y operación durante 3 años: permiso o arriendo del predio, visitas de mantenimiento, transporte y cambio de
 * batería. Hace que, a igual cobertura, se prefieran menos antenas (cada sitio más es un punto que mantener).
 */
const OPERACION = 3_000_000;
/** El gateway lleva además el equipo de internet (una vez). */
const INTERNET_GATEWAY = 1_600_000;
/** Diferencia de cada tipo de antena frente a la omnidireccional (con su cable). */
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
  return NODO_INFRA + INSTALACION + OPERACION + (a.pasarela ? INTERNET_GATEWAY : 0) + costoTorre(a.alturaM) + antena;
}

/** Costo de referencia de un nodo de apoyo típico (torre de 15 m): escala para comparar mejoras. */
export const COSTO_APOYO_TIPICO = NODO_INFRA + INSTALACION + OPERACION + costoTorre(15);
