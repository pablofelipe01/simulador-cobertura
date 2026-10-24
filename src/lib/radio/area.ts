// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Áreas objetivo: polígonos (círculo, cuadrado, rectángulo o el área medida con la regla), puntos de muestra
// dentro del área y la cobertura que da la simulación dentro de ella, por clase de señal.
import { CLASES, type ClaseId } from "./constantes";
import { areaPoligonoM2, desplazar, latAMercator, lonAMercator, mercatorALat, mercatorALon, metrosPorGrado } from "./geo";
import type { Caja, ResultadoSimulacion } from "./tipos";

/** Polígono en [lon, lat] (sin repetir el primer punto al final). */
export type Poligono = [number, number][];

/** ¿El punto está dentro del polígono? (rayo horizontal). */
export function dentroPoligono(lon: number, lat: number, poligono: Poligono): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function cajaPoligono(poligono: Poligono): Caja {
  let caja: Caja = { oeste: Infinity, sur: Infinity, este: -Infinity, norte: -Infinity };
  for (const [lon, lat] of poligono) caja = { oeste: Math.min(caja.oeste, lon), este: Math.max(caja.este, lon), sur: Math.min(caja.sur, lat), norte: Math.max(caja.norte, lat) };
  return caja;
}

export function centroPoligono(poligono: Poligono): { lat: number; lon: number } {
  const c = cajaPoligono(poligono);
  return { lat: (c.sur + c.norte) / 2, lon: (c.oeste + c.este) / 2 };
}

/** Círculo de radio dado (m) como polígono de muchos lados. */
export function poligonoCirculo(lat: number, lon: number, radioM: number, lados = 72): Poligono {
  const puntos: Poligono = [];
  for (let k = 0; k < lados; k++) {
    const q = desplazar(lat, lon, radioM, (360 * k) / lados);
    puntos.push([q.lon, q.lat]);
  }
  return puntos;
}

/** Rectángulo de ancho (este-oeste) y alto (norte-sur) en metros, centrado en el punto. */
export function poligonoRectangulo(lat: number, lon: number, anchoM: number, altoM: number): Poligono {
  const m = metrosPorGrado(lat);
  const dx = anchoM / 2 / m.lon;
  const dy = altoM / 2 / m.lat;
  return [
    [lon - dx, lat + dy],
    [lon + dx, lat + dy],
    [lon + dx, lat - dy],
    [lon - dx, lat - dy],
  ];
}

/** Escala el polígono (alrededor de su centro) para que mida exactamente esa área, como la mide la regla. */
export function conArea(poligono: Poligono, objetivoM2: number): Poligono {
  const actual = areaPoligonoM2(poligono);
  if (!(actual > 0)) return poligono;
  const f = Math.sqrt(objetivoM2 / actual);
  const c = centroPoligono(poligono);
  return poligono.map(([lon, lat]) => [c.lon + (lon - c.lon) * f, c.lat + (lat - c.lat) * f]);
}

/** Radio (m) de un círculo con esa área (m²). */
export const radioDeArea = (areaM2: number) => Math.sqrt(areaM2 / Math.PI);

export const areaM2 = (poligono: Poligono) => areaPoligonoM2(poligono);

/** Puntos de una cuadrícula regular dentro del polígono (unos `objetivo`), con su separación en metros. */
export function muestrasEnPoligono(poligono: Poligono, objetivo: number): { lats: Float64Array; lons: Float64Array; separacionM: number } {
  const area = Math.max(areaPoligonoM2(poligono), 1);
  const caja = cajaPoligono(poligono);
  const m = metrosPorGrado((caja.sur + caja.norte) / 2);
  let separacion = Math.max(5, Math.sqrt(area / Math.max(1, objetivo)));
  for (;;) {
    const lats: number[] = [];
    const lons: number[] = [];
    const dLat = separacion / m.lat;
    const dLon = separacion / m.lon;
    for (let lat = caja.norte - dLat / 2; lat > caja.sur; lat -= dLat)
      for (let lon = caja.oeste + dLon / 2; lon < caja.este; lon += dLon)
        if (dentroPoligono(lon, lat, poligono)) {
          lats.push(lat);
          lons.push(lon);
        }
    // Áreas muy delgadas: se afina la cuadrícula hasta tener puntos suficientes
    if (lats.length >= Math.min(objetivo / 3, 50) || separacion <= 5) return { lats: Float64Array.from(lats), lons: Float64Array.from(lons), separacionM: separacion };
    separacion /= 2;
  }
}

export type CoberturaArea = {
  /** Área del polígono (km²). */
  areaKm2: number;
  /** Celdas del mapa cuyo centro cae dentro del área. */
  celdas: number;
  /** % del área por clase de señal (buena, estable, media, baja, sin servicio); suma 100. */
  porClase: Record<ClaseId, number>;
  /** Margen (dB; NaN donde la simulación no llega) y área (km²) de cada celda dentro del área. */
  margenes: Float32Array;
  areas: Float32Array;
  /** Parte del área que queda por fuera del mapa calculado (km²): cuenta como sin servicio. */
  fueraKm2: number;
};

/** Celdas de la malla del mapa (en Mercator) cuyo centro cae dentro del polígono. */
export function celdasEnPoligono(malla: { caja: Caja; ancho: number; alto: number }, poligono: Poligono, max = Infinity): { lats: Float64Array; lons: Float64Array; indices: Int32Array; areas: Float64Array } {
  const { caja, ancho, alto } = malla;
  const x0 = lonAMercator(caja.oeste);
  const celda = (lonAMercator(caja.este) - x0) / ancho;
  const y1 = latAMercator(caja.norte);
  const b = cajaPoligono(poligono);
  const iIni = Math.max(0, Math.floor((lonAMercator(b.oeste) - x0) / celda));
  const iFin = Math.min(ancho - 1, Math.ceil((lonAMercator(b.este) - x0) / celda));
  const jIni = Math.max(0, Math.floor((y1 - latAMercator(b.norte)) / celda));
  const jFin = Math.min(alto - 1, Math.ceil((y1 - latAMercator(b.sur)) / celda));
  const lats: number[] = [];
  const lons: number[] = [];
  const indices: number[] = [];
  const areas: number[] = [];
  for (let j = jIni; j <= jFin; j++) {
    const lat = mercatorALat(y1 - (j + 0.5) * celda);
    const lado = celda * Math.cos((lat * Math.PI) / 180);
    for (let i = iIni; i <= iFin; i++) {
      const lon = mercatorALon(x0 + (i + 0.5) * celda);
      if (!dentroPoligono(lon, lat, poligono)) continue;
      lats.push(lat);
      lons.push(lon);
      indices.push(j * ancho + i);
      areas.push((lado * lado) / 1e6);
    }
  }
  // Áreas enormes: se toma una de cada k celdas (repartidas de manera uniforme)
  if (lats.length > max) {
    const k = lats.length / max;
    const sel = Array.from({ length: Math.floor(max) }, (_, n) => Math.floor(n * k));
    return {
      lats: Float64Array.from(sel, (n) => lats[n]),
      lons: Float64Array.from(sel, (n) => lons[n]),
      indices: Int32Array.from(sel, (n) => indices[n]),
      areas: Float64Array.from(sel, (n) => areas[n] * k),
    };
  }
  return { lats: Float64Array.from(lats), lons: Float64Array.from(lons), indices: Int32Array.from(indices), areas: Float64Array.from(areas) };
}

/** Cobertura de la simulación dentro del área, celda por celda del mapa (ponderada por su área). Con «segundo», la de respaldo. */
export function coberturaEnArea(r: ResultadoSimulacion, poligono: Poligono, campo: "mejor" | "segundo" = "mejor"): CoberturaArea {
  const areaKm2 = areaPoligonoM2(poligono) / 1e6;
  const c = celdasEnPoligono(r.malla, poligono);
  const fuente = campo === "segundo" ? r.segundo : r.mejor;
  const margenes = Float32Array.from(c.indices, (i) => fuente[i]);
  const areas = Float32Array.from(c.areas);
  const suma: Record<ClaseId, number> = { buena: 0, estable: 0, media: 0, baja: 0, sin: 0 };
  let dentro = 0;
  for (let k = 0; k < margenes.length; k++) {
    suma[claseDe(margenes[k])] += areas[k];
    dentro += areas[k];
  }
  // Parte del área por fuera del mapa calculado (sin servicio): se estima con una muestra del polígono
  const caja = r.malla.caja;
  const b = cajaPoligono(poligono);
  let fraccionFuera = 0;
  if (b.oeste < caja.oeste || b.este > caja.este || b.sur < caja.sur || b.norte > caja.norte) {
    const m = muestrasEnPoligono(poligono, 4000);
    let fuera = 0;
    for (let k = 0; k < m.lats.length; k++) if (m.lats[k] < caja.sur || m.lats[k] > caja.norte || m.lons[k] < caja.oeste || m.lons[k] > caja.este) fuera++;
    fraccionFuera = m.lats.length ? fuera / m.lats.length : 0;
  }
  const fueraKm2 = fraccionFuera * areaKm2;
  const escala = dentro > 0 ? (1 - fraccionFuera) / dentro : 0;
  const porClase = Object.fromEntries(Object.entries(suma).map(([k, v]) => [k, 100 * v * escala + (k === "sin" ? 100 * fraccionFuera : 0)])) as Record<ClaseId, number>;
  // Las celdas representan la parte del área que sí está en el mapa
  if (dentro > 0) for (let k = 0; k < areas.length; k++) areas[k] *= (areaKm2 - fueraKm2) / dentro;
  return { areaKm2, celdas: margenes.length, porClase, margenes, areas, fueraKm2 };
}

function claseDe(mg: number): ClaseId {
  if (!(mg >= CLASES[3].minimoDb)) return "sin";
  for (const c of CLASES) if (mg >= c.minimoDb) return c.id;
  return "sin";
}

/** % del área con margen igual o mayor que el umbral (dB). */
export function porcentajeSobre(c: CoberturaArea, umbralDb: number): number {
  let si = 0;
  let total = c.fueraKm2;
  for (let k = 0; k < c.margenes.length; k++) {
    total += c.areas[k];
    if (c.margenes[k] >= umbralDb) si += c.areas[k];
  }
  return total > 0 ? (100 * si) / total : 0;
}

/** Margen del mejor nodo (dB) en un punto, con la celda del mapa calculado (NaN si cae por fuera). */
export function margenEnPunto(r: Pick<ResultadoSimulacion, "malla" | "mejor">, lat: number, lon: number): number {
  const { caja, ancho, alto } = r.malla;
  const x0 = lonAMercator(caja.oeste);
  const celda = (lonAMercator(caja.este) - x0) / ancho;
  const i = Math.floor((lonAMercator(lon) - x0) / celda);
  const j = Math.floor((latAMercator(caja.norte) - latAMercator(lat)) / celda);
  if (i < 0 || j < 0 || i >= ancho || j >= alto) return NaN;
  return r.mejor[j * ancho + i];
}
