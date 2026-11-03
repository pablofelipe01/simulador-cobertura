// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Pérdidas por el entorno (vegetación o construcciones) para los equipos que quedan por debajo de ellas.
// Vegetación: UIT-R P.833 (terminal dentro del follaje). Construcciones y bosque: UIT-R P.2108 §3.1
// (corrección por altura del terminal dentro del «clutter»). Se suma en cada extremo del trayecto.
import { tx } from "../idioma";
import { difraccion } from "./modelo";
import type { EntornoId } from "./tipos";

type Entorno = {
  id: EntornoId;
  nombre: string;
  descripcion: string;
  /** Método: sin pérdida, follaje (P.833) o altura de los obstáculos (P.2108). */
  metodo: "ninguno" | "follaje" | "obstaculos";
  /** Altura típica de la vegetación o de los edificios (m). */
  alturaM: number;
  /** Recorrido de la señal dentro del follaje (m), solo para el método «follaje». */
  follajeM?: number;
};

/** Entorno con su nombre y su descripción en los dos idiomas (getters: salen en el idioma de la pantalla). */
const nuevoEntorno = (id: EntornoId, nombre: [string, string], descripcion: [string, string], resto: Pick<Entorno, "metodo" | "alturaM" | "follajeM">): Entorno => ({
  id,
  get nombre() {
    return tx(nombre[0], nombre[1]);
  },
  get descripcion() {
    return tx(descripcion[0], descripcion[1]);
  },
  ...resto,
});

export const ENTORNOS: readonly Entorno[] = [
  nuevoEntorno("abierto", ["Campo abierto o sabana", "Open field or savanna"], ["Sin pérdidas adicionales (como en las pruebas de Radio Mobile).", "No additional losses (as in the Radio Mobile tests)."], { metodo: "ninguno", alturaM: 0 }),
  nuevoEntorno("cultivos", ["Cultivos y árboles dispersos", "Crops and scattered trees"], ["Unos 30 m de follaje hasta salir a terreno abierto; vegetación de unos 6 m.", "About 30 m of foliage before reaching open ground; vegetation about 6 m tall."], { metodo: "follaje", alturaM: 6, follajeM: 30 }),
  nuevoEntorno("plantacion", ["Plantación (palma, frutales)", "Plantation (palm, fruit trees)"], ["Unos 60 m de follaje; copas de unos 12 m.", "About 60 m of foliage; canopies about 12 m high."], { metodo: "follaje", alturaM: 12, follajeM: 60 }),
  nuevoEntorno("bosque", ["Bosque o selva", "Forest or jungle"], ["Árboles de unos 15 m alrededor del equipo (UIT-R P.2108).", "Trees about 15 m tall around the device (ITU-R P.2108)."], { metodo: "obstaculos", alturaM: 15 }),
  nuevoEntorno("suburbano", ["Pueblo o zona suburbana", "Town or suburban area"], ["Casas de uno o dos pisos, unos 10 m (UIT-R P.2108).", "One- or two-story houses, about 10 m (ITU-R P.2108)."], { metodo: "obstaculos", alturaM: 10 }),
  nuevoEntorno("urbano", ["Ciudad", "City"], ["Edificios de unos 15 m (UIT-R P.2108).", "Buildings about 15 m tall (ITU-R P.2108)."], { metodo: "obstaculos", alturaM: 15 }),
  nuevoEntorno("urbano-denso", ["Centro urbano denso", "Dense urban center"], ["Edificios de unos 20 m (UIT-R P.2108).", "Buildings about 20 m tall (ITU-R P.2108)."], { metodo: "obstaculos", alturaM: 20 }),
];

export const entornoPorId = (id: EntornoId) => ENTORNOS.find((e) => e.id === id) ?? ENTORNOS[0];

/** Atenuación específica del follaje con hojas cerca de 900 MHz (dB/m), UIT-R P.833. */
const GAMMA_FOLLAJE = 0.25;
/** Ancho típico de calle o claro entre obstáculos (m), UIT-R P.2108. */
const ANCHO_CALLE_M = 27;

/**
 * Pérdida (dB) de un equipo a `alturaM` sobre el suelo dentro del entorno indicado.
 * Es cero si el equipo está por encima de la vegetación o de los edificios.
 */
export function perdidaEntorno(id: EntornoId, alturaM: number, frecuenciaMhz: number): number {
  const e = entornoPorId(id);
  if (e.metodo === "ninguno" || alturaM >= e.alturaM) return 0;
  if (e.metodo === "follaje") {
    // P.833: A = Am·(1 − e^(−d·γ/Am)), Am = 0,18·f^0,752 (f en MHz). Se reduce de forma lineal
    // cuando la antena se acerca a la copa (simplificación: completa hasta la mitad de la altura).
    const am = 0.18 * frecuenciaMhz ** 0.752;
    const a = am * (1 - Math.exp(-((e.follajeM ?? 0) * GAMMA_FOLLAJE) / am));
    const t = Math.min(1, Math.max(0, (e.alturaM - alturaM) / (0.5 * e.alturaM)));
    return a * t;
  }
  // P.2108 ec. 2a: A = J(ν) − 6,03 con ν = Kν·√(Δh·θ), Kν = 0,342·√f(GHz), θ = atan(Δh/ws) en grados
  const fGhz = frecuenciaMhz / 1000;
  const dh = e.alturaM - Math.max(alturaM, 0.5);
  const theta = (Math.atan(dh / ANCHO_CALLE_M) * 180) / Math.PI;
  const nu = 0.342 * Math.sqrt(fGhz) * Math.sqrt(dh * theta);
  return Math.max(0, difraccion(nu) - 6.03);
}
