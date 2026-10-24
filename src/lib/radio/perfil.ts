// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Perfil del terreno entre dos puntos y parámetro de difracción del obstáculo principal.
import { DISTANCIA_MINIMA_M, RADIO_EFECTIVO_M } from "./constantes";
import { distanciaM } from "./geo";
import { clasePorMargen, difraccion, espacioLibre, longitudOnda, margen } from "./modelo";
import type { Relieve } from "./relieve";
import type { Perfil, PuntoPerfil } from "./tipos";

const DOS_KR = 2 * RADIO_EFECTIVO_M;

/**
 * Máximo del parámetro de difracción v a lo largo del trayecto (Deygout, filo principal).
 * (ax, ay) y (bx, by) son píxeles globales del relieve; za y zb, alturas absolutas de las antenas (m).
 */
export function vMaximo(
  relieve: Relieve,
  ax: number,
  ay: number,
  za: number,
  bx: number,
  by: number,
  zb: number,
  d: number,
  lambda: number,
  paso: number,
): number {
  const n = Math.max(2, Math.ceil(d / paso));
  const f = Math.sqrt((2 * d) / lambda);
  const dx = (bx - ax) / n;
  const dy = (by - ay) / n;
  const dz = (zb - za) / n;
  const dd = d / n;
  let vmax = -Infinity;
  for (let k = 1; k < n; k++) {
    const x = dd * k;
    const resto = d - x;
    const h = relieve.muestra(ax + dx * k, ay + dy * k) + (x * resto) / DOS_KR - (za + dz * k);
    const v = (h * f) / Math.sqrt(x * resto);
    if (v > vmax) vmax = v;
  }
  return vmax;
}

/** Memoria reutilizable para los perfiles muestreados. */
let memoria = new Float64Array(2048);

/**
 * Muestrea el terreno en n + 1 puntos equidistantes de (ax, ay) a (bx, by) (píxeles globales del relieve).
 * Devuelve un arreglo compartido: se sobrescribe en la siguiente llamada.
 */
export function muestrearPerfil(relieve: Relieve, ax: number, ay: number, bx: number, by: number, n: number): Float64Array {
  if (memoria.length < n + 1) memoria = new Float64Array(n + 512);
  const dx = (bx - ax) / n;
  const dy = (by - ay) / n;
  for (let k = 0; k <= n; k++) memoria[k] = relieve.muestra(ax + dx * k, ay + dy * k);
  return memoria;
}

/** Igual que vMaximo, pero sobre un perfil ya muestreado de n + 1 puntos. */
export function vDePerfil(z: Float64Array, n: number, za: number, zb: number, d: number, lambda: number): number {
  const f = Math.sqrt((2 * d) / lambda);
  const dz = (zb - za) / n;
  const dd = d / n;
  let vmax = -Infinity;
  for (let k = 1; k < n; k++) {
    const x = dd * k;
    const resto = d - x;
    const h = z[k] + (x * resto) / DOS_KR - (za + dz * k);
    const v = (h * f) / Math.sqrt(x * resto);
    if (v > vmax) vmax = v;
  }
  return vmax;
}

/** Número de intervalos del perfil para un trayecto de d metros. */
export const intervalosPerfil = (d: number, paso: number) => Math.max(2, Math.ceil(d / paso));

/**
 * Paso de muestreo del perfil (m): 3/4 del píxel del relieve. Validado contra el modelo de referencia
 * en Python (SRTM 1″): error cuadrático medio ≈ 0,9 dB con teselas de 38 m.
 */
export function pasoPerfil(relieve: Relieve, lat: number): number {
  if (relieve.estado.fuente === "plano") return 250;
  return Math.max(10, relieve.resolucionM(lat) * 0.75);
}

export type ExtremoPerfil = { lat: number; lon: number; alturaM: number };

/** Perfil completo (para graficar) entre una antena y un punto o entre dos antenas. */
export function calcularPerfil(
  relieve: Relieve,
  a: ExtremoPerfil,
  b: ExtremoPerfil,
  frecuenciaMhz: number,
  presupuesto: number,
  alturaTxCalibracion: number,
  maxPuntos = 600,
): Perfil {
  const d = Math.max(distanciaM(a.lat, a.lon, b.lat, b.lon), DISTANCIA_MINIMA_M);
  const lambda = longitudOnda(frecuenciaMhz);
  const [ax, ay] = relieve.pixel(a.lat, a.lon);
  const [bx, by] = relieve.pixel(b.lat, b.lon);
  const za = relieve.muestra(ax, ay) + a.alturaM;
  const zb = relieve.muestra(bx, by) + b.alturaM;
  const paso = pasoPerfil(relieve, a.lat);
  const vMax = vMaximo(relieve, ax, ay, za, bx, by, zb, d, lambda, paso);

  // Puntos para graficar y ubicación del obstáculo principal
  const n = Math.min(maxPuntos, Math.max(2, Math.ceil(d / paso)));
  const puntos: PuntoPerfil[] = [];
  let obstaculoM: number | null = null;
  let vObs = -Infinity;
  const f = Math.sqrt((2 * d) / lambda);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = d * t;
    const terreno = relieve.muestra(ax + (bx - ax) * t, ay + (by - ay) * t);
    puntos.push({ distanciaM: x, terrenoM: terreno });
    if (k > 0 && k < n) {
      const h = terreno + (x * (d - x)) / DOS_KR - (za + (zb - za) * t);
      const v = (h * f) / Math.sqrt(x * (d - x));
      if (v > vObs) {
        vObs = v;
        obstaculoM = x;
      }
    }
  }
  const j = difraccion(vMax);
  const m = margen(presupuesto, frecuenciaMhz, d, j, alturaTxCalibracion);
  return {
    distanciaM: d,
    puntos,
    alturaInicioM: za,
    alturaFinM: zb,
    fresnelMedioM: Math.sqrt((lambda * (d / 2) * (d / 2)) / d),
    vMax,
    obstaculoM: vMax > -0.78 ? obstaculoM : null,
    perdidaEspacioLibreDb: espacioLibre(frecuenciaMhz, d / 1000),
    perdidaDifraccionDb: j,
    margenDb: m,
    clase: clasePorMargen(m),
    lineaVista: vMax <= -0.6 * Math.SQRT2,
  };
}
