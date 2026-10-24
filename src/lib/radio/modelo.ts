// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Modelo de propagación calibrado: espacio libre + difracción del filo principal (Deygout, un filo)
// sobre el perfil del terreno con tierra de radio efectivo 4/3, más una pérdida adicional ajustada
// a las simulaciones de Radio Mobile.
import { CLASES, COEFICIENTES, ENLACES, presetPorId, VELOCIDAD_LUZ_M_US, type ClaseId } from "./constantes";
import type { Antena, ClaseEnlace, Parametros } from "./tipos";

/** Pérdida en espacio libre (dB) con f en MHz y d en km. */
export function espacioLibre(frecuenciaMhz: number, distanciaKm: number): number {
  return 32.45 + 20 * Math.log10(frecuenciaMhz) + 20 * Math.log10(distanciaKm);
}

/** Pérdida por difracción de un filo de cuchillo J(v) (dB), aproximación de la UIT-R P.526. */
export function difraccion(v: number): number {
  if (!(v > -0.78)) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
}

export function longitudOnda(frecuenciaMhz: number): number {
  return VELOCIDAD_LUZ_M_US / frecuenciaMhz;
}

/** Pérdida adicional calibrada (dB). */
export function perdidaCalibrada(distanciaKm: number, j: number, alturaTxM: number): number {
  const [c0, c1, c2, c3] = COEFICIENTES;
  return c0 + c1 * Math.log10(distanciaKm) + c2 * j - c3 * Math.log10(Math.max(alturaTxM, 0.5) / 10);
}

/** Presupuesto de enlace (dB) de una antena hacia un receptor genérico. */
export function presupuestoCobertura(antena: Antena, p: Parametros): number {
  const s = presetPorId(p.preset).sensibilidadDbm;
  return antena.potenciaDbm + antena.gananciaDbi - antena.perdidaCableDb + p.gananciaRxDbi - p.perdidaExtraDb - s;
}

/** Presupuesto de enlace (dB) de la antena tx hacia la antena rx. */
export function presupuestoEnlace(tx: Antena, rx: Antena, p: Parametros): number {
  const s = presetPorId(p.preset).sensibilidadDbm;
  return tx.potenciaDbm + tx.gananciaDbi - tx.perdidaCableDb + rx.gananciaDbi - rx.perdidaCableDb - s;
}

/** Margen sobre la sensibilidad (dB). */
export function margen(presupuesto: number, frecuenciaMhz: number, distanciaM: number, j: number, alturaTxM: number): number {
  const dKm = distanciaM / 1000;
  return presupuesto - espacioLibre(frecuenciaMhz, dKm) - perdidaCalibrada(dKm, j, alturaTxM);
}

export function clasePorMargen(m: number): ClaseId {
  for (const c of CLASES) if (m >= c.minimoDb) return c.id;
  return "sin";
}

export function claseEnlace(m: number): ClaseEnlace {
  if (m >= ENLACES.solido.minimoDb) return "solido";
  if (m >= ENLACES.inestable.minimoDb) return "inestable";
  return "sin";
}

/** Índice de clase (0 = buena … 4 = sin servicio) para colorear rápido. */
export function indiceClase(m: number): number {
  if (m >= 45) return 0;
  if (m >= 37) return 1;
  if (m >= 30) return 2;
  if (m >= 20) return 3;
  return 4;
}

/**
 * Distancia (km) a la que el modelo calibrado, sin obstáculos (J = 0), deja el margen indicado.
 * Sirve para comparar con el alcance real sobre el relieve.
 */
export function alcanceSinObstaculosKm(presupuesto: number, frecuenciaMhz: number, alturaTxM: number, margenDb: number): number {
  const [c0, c1, , c3] = COEFICIENTES;
  const libre = presupuesto - margenDb - 32.45 - 20 * Math.log10(frecuenciaMhz) - c0 + c3 * Math.log10(Math.max(alturaTxM, 0.5) / 10);
  return 10 ** (libre / (20 + c1));
}
