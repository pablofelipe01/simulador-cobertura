// Evaluación de un trayecto entre dos extremos: difracción, ajuste de red (Longley-Rice) y pérdidas desglosadas.
// La usan los enlaces, la inspección de un punto y el informe de radioenlace; la cobertura repite el mismo
// cálculo en línea para no crear objetos por celda.
import { COEFICIENTES } from "./constantes";
import type { SalidaItm } from "./itm";
import { difraccion, espacioLibre } from "./modelo";
import { intervalosPerfil, muestrearPerfil, vDePerfil, vMaximo } from "./perfil";
import type { CalculoRed } from "./red";
import type { Relieve } from "./relieve";

/** Extremo en píxeles globales del relieve, con la elevación del suelo y la altura de la antena (m). */
export type Extremo = { px: number; py: number; suelo: number; alturaM: number };

export type Geometria = {
  distanciaM: number;
  /** Parámetro de difracción del obstáculo principal y su pérdida J(v). */
  vMax: number;
  j: number;
  /** Diferencia de Longley-Rice entre los parámetros de red y los de referencia (modelo calibrado). */
  ajusteRedDb: number;
  /** Predicción Longley-Rice con los parámetros de la red (si se calculó). */
  itm: SalidaItm | null;
};

/**
 * Geometría del trayecto de `a` a `b`. Con `conItm` siempre calcula Longley-Rice (para informes);
 * si no, solo cuando el modelo o los parámetros de red lo requieren.
 */
export function geometriaTrayecto(relieve: Relieve, red: CalculoRed, a: Extremo, b: Extremo, d: number, lambda: number, paso: number, conItm = false): Geometria {
  const za = a.suelo + a.alturaM;
  const zb = b.suelo + b.alturaM;
  if (!red.necesitaPerfil && !conItm) {
    const vMax = vMaximo(relieve, a.px, a.py, za, b.px, b.py, zb, d, lambda, paso);
    return { distanciaM: d, vMax, j: difraccion(vMax), ajusteRedDb: 0, itm: null };
  }
  const n = intervalosPerfil(d, paso);
  const z = muestrearPerfil(relieve, a.px, a.py, b.px, b.py, n);
  const vMax = vDePerfil(z, n, za, zb, d, lambda);
  const itm = red.itm(z, n + 1, d, a.alturaM, b.alturaM);
  const ajusteRedDb = red.modelo === "calibrado" && red.necesitaPerfil ? red.ajuste(z, n + 1, d, a.alturaM, b.alturaM) : 0;
  return { distanciaM: d, vMax, j: difraccion(vMax), ajusteRedDb, itm };
}

export type Perdidas = {
  espacioLibreDb: number;
  /** Obstrucción del terreno: difracción calibrada (o atenuación de referencia de Longley-Rice). */
  obstruccionDb: number;
  /** Pérdida estadística: término calibrado por distancia y altura (o variabilidad de Longley-Rice). */
  estadisticaDb: number;
  ajusteRedDb: number;
  totalDb: number;
};

/** Pérdidas del trayecto según el modelo elegido. `alturaCalibracionM` es la altura del transmisor. */
export function perdidasTrayecto(g: Geometria, red: CalculoRed, frecuenciaMhz: number, alturaCalibracionM: number): Perdidas {
  const dKm = g.distanciaM / 1000;
  const fs = espacioLibre(frecuenciaMhz, dKm);
  if (red.modelo === "itm" && g.itm) {
    const variabilidad = g.itm.perdidaDb - g.itm.espacioLibreDb - g.itm.referenciaDb;
    return { espacioLibreDb: fs, obstruccionDb: g.itm.referenciaDb, estadisticaDb: variabilidad, ajusteRedDb: 0, totalDb: g.itm.perdidaDb - g.itm.espacioLibreDb + fs };
  }
  const [c0, c1, c2, c3] = COEFICIENTES;
  const obstruccion = c2 * g.j;
  const estadistica = c0 + c1 * Math.log10(dKm) - c3 * Math.log10(Math.max(alturaCalibracionM, 0.5) / 10);
  return { espacioLibreDb: fs, obstruccionDb: obstruccion, estadisticaDb: estadistica, ajusteRedDb: g.ajusteRedDb, totalDb: fs + obstruccion + estadistica + g.ajusteRedDb };
}
