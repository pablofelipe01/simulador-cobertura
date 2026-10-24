// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Patrones de radiación de antenas omnidireccionales y direccionales.
// Modelo paramétrico (como el de 3GPP TR 36.814): la ganancia cae 12·(ángulo/ancho del haz)² dB
// en horizontal y en vertical, hasta la relación frente/espalda. El ancho del haz se deduce de la
// ganancia (G ≈ 27 000 / (θh·θv), en grados), así que una antena de más ganancia es más angosta.
// La omnidireccional no tiene atenuación: es la misma de las pruebas de Radio Mobile que calibraron el modelo.
import { RADIO_EFECTIVO_M } from "./constantes";
import type { Antena, PatronId } from "./tipos";

type Patron = {
  id: PatronId;
  nombre: string;
  descripcion: string;
  /** Ganancia típica a 915 MHz (dBi), se propone al elegir el tipo. */
  gananciaTipica: number;
  /** Ancho fijo del haz horizontal (°) para las sectoriales; null = se deduce de la ganancia. */
  anchoH: number | null;
  /** Relación frente/espalda (dB): atenuación máxima fuera del haz. */
  frenteEspaldaDb: number;
};

export const PATRONES: readonly Patron[] = [
  { id: "omni", nombre: "Omnidireccional", descripcion: "Igual en todas las direcciones (fibra de vidrio o látigo).", gananciaTipica: 5.8, anchoH: null, frenteEspaldaDb: 0 },
  { id: "yagi", nombre: "Yagi", descripcion: "Direccional, para enlaces punto a punto o llegar lejos en una dirección.", gananciaTipica: 11, anchoH: null, frenteEspaldaDb: 16 },
  { id: "panel", nombre: "Panel", descripcion: "Plana y direccional, haz amplio.", gananciaTipica: 9, anchoH: null, frenteEspaldaDb: 20 },
  { id: "sectorial-90", nombre: "Sectorial 90°", descripcion: "Cubre un cuarto del horizonte con haz vertical angosto.", gananciaTipica: 13, anchoH: 90, frenteEspaldaDb: 25 },
  { id: "sectorial-120", nombre: "Sectorial 120°", descripcion: "Cubre un tercio del horizonte con haz vertical angosto.", gananciaTipica: 12, anchoH: 120, frenteEspaldaDb: 25 },
  { id: "parabolica", nombre: "Parabólica (rejilla)", descripcion: "Haz muy angosto para enlaces largos punto a punto.", gananciaTipica: 22, anchoH: null, frenteEspaldaDb: 28 },
];

export const patronPorId = (id: PatronId | undefined) => PATRONES.find((p) => p.id === (id ?? "omni")) ?? PATRONES[0];

export const esDireccional = (a: Pick<Antena, "patron">) => (a.patron ?? "omni") !== "omni";

const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Anchos del haz a −3 dB (horizontal y vertical, en grados) según el tipo y la ganancia. */
export function anchosHaz(patron: PatronId | undefined, gananciaDbi: number): { h: number; v: number } {
  const p = patronPorId(patron);
  if (p.id === "omni") return { h: 360, v: limitar(27000 / (10 ** (gananciaDbi / 10) * 360), 3, 180) };
  const g = 10 ** (Math.max(gananciaDbi, 2) / 10);
  if (p.anchoH !== null) return { h: p.anchoH, v: limitar(27000 / (g * p.anchoH), 3, 90) };
  const theta = limitar(Math.sqrt(27000 / g), 3, 120);
  return { h: theta, v: theta };
}

/** Diferencia angular en (−180°, 180°]. */
export function diferenciaAngulo(a: number, b: number): number {
  let d = (((a - b) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/**
 * Atenuación (dB, ≥ 0) respecto a la ganancia máxima en la dirección indicada: rumbo desde el norte
 * y ángulo de elevación (positivo hacia arriba), ambos en grados.
 */
export function atenuacionPatron(a: Pick<Antena, "patron" | "gananciaDbi" | "azimutDeg" | "elevacionDeg">, rumboDeg: number, elevacionDeg: number): number {
  const p = patronPorId(a.patron);
  if (p.id === "omni") return 0;
  const { h, v } = anchosHaz(p.id, a.gananciaDbi);
  const am = p.frenteEspaldaDb;
  const dh = diferenciaAngulo(rumboDeg, a.azimutDeg ?? 0);
  const dv = elevacionDeg - (a.elevacionDeg ?? 0);
  const ah = Math.min(12 * (dh / h) ** 2, am);
  const av = Math.min(12 * (dv / v) ** 2, am);
  return Math.min(ah + av, am);
}

/**
 * Ángulo de elevación (grados) del rayo directo desde un extremo a `za` m hacia otro a `zb` m (alturas
 * sobre el nivel del mar) separados `d` m, con la curvatura de la Tierra de radio efectivo 4/3.
 */
export function anguloElevacion(za: number, zb: number, d: number): number {
  return ((Math.atan2(zb - za, d) - d / (2 * RADIO_EFECTIVO_M)) * 180) / Math.PI;
}

/** Rumbo (grados desde el norte) a partir de desplazamientos locales este y norte en metros. */
export function rumboLocal(este: number, norte: number): number {
  const g = (Math.atan2(este, norte) * 180) / Math.PI;
  return g < 0 ? g + 360 : g;
}
