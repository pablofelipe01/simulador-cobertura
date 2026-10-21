// Rango de alcance: contorno por dirección (con servicio y confiable) y anillos de distancia.
import type { Feature, FeatureCollection, LineString } from "geojson";

import { desplazar } from "@/lib/radio/geo";
import type { Antena, ResultadoSimulacion } from "@/lib/radio/tipos";

const SECTOR = 360 / 72;

function contorno(a: Antena, porRumbo: number[]): [number, number][] {
  const puntos: [number, number][] = porRumbo.map((km, k) => {
    const p = desplazar(a.lat, a.lon, Math.max(km, 0.03) * 1000, (k + 0.5) * SECTOR);
    return [p.lon, p.lat];
  });
  puntos.push(puntos[0]);
  return puntos;
}

export type EtiquetaAlcance = { clave: string; lon: number; lat: number; texto: string; clase: string };

/** Contornos de alcance de los nodos antena simulados (o solo del seleccionado). */
export function geojsonAlcance(r: ResultadoSimulacion, antenas: Antena[], soloId: string | null): { datos: FeatureCollection<LineString>; etiquetas: EtiquetaAlcance[] } {
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const features: Feature<LineString>[] = [];
  const etiquetas: EtiquetaAlcance[] = [];
  for (const s of r.antenas) {
    const a = porId.get(s.id);
    if (!a || (soloId && s.id !== soloId) || !s.alcancePorRumbo?.length) continue;
    if (s.alcanceKm > 0) {
      features.push({ type: "Feature", properties: { clase: "servicio" }, geometry: { type: "LineString", coordinates: contorno(a, s.alcancePorRumbo) } });
      const k = s.alcancePorRumbo.indexOf(Math.max(...s.alcancePorRumbo));
      const p = desplazar(a.lat, a.lon, s.alcancePorRumbo[k] * 1000, (k + 0.5) * SECTOR);
      etiquetas.push({ clave: `${s.id}:s`, lon: p.lon, lat: p.lat, texto: `${s.alcanceLimitado ? "≥ " : ""}${s.alcanceKm.toFixed(1).replace(".", ",")} km con servicio`, clase: "alcance-servicio" });
    }
    if (s.alcanceConfiableKm > 0) {
      features.push({ type: "Feature", properties: { clase: "confiable" }, geometry: { type: "LineString", coordinates: contorno(a, s.alcanceConfiablePorRumbo) } });
      const k = s.alcanceConfiablePorRumbo.indexOf(Math.max(...s.alcanceConfiablePorRumbo));
      const p = desplazar(a.lat, a.lon, s.alcanceConfiablePorRumbo[k] * 1000, (k + 0.5) * SECTOR);
      etiquetas.push({ clave: `${s.id}:c`, lon: p.lon, lat: p.lat, texto: `${s.alcanceConfiableKm.toFixed(1).replace(".", ",")} km confiable`, clase: "alcance-confiable" });
    }
  }
  return { datos: { type: "FeatureCollection", features }, etiquetas };
}

/** Paso «redondo» entre anillos según el radio de estudio. */
export function pasoAnillos(radioKm: number): number {
  if (radioKm <= 3) return 0.5;
  if (radioKm <= 6) return 1;
  if (radioKm <= 14) return 2;
  if (radioKm <= 30) return 5;
  return 10;
}

/** Anillos de distancia alrededor de un nodo, hasta el radio de estudio. */
export function geojsonAnillos(a: Antena, radioKm: number): { datos: FeatureCollection<LineString>; etiquetas: EtiquetaAlcance[] } {
  const paso = pasoAnillos(radioKm);
  const features: Feature<LineString>[] = [];
  const etiquetas: EtiquetaAlcance[] = [];
  for (let km = paso; km <= radioKm + 1e-9; km += paso) {
    const coords: [number, number][] = [];
    for (let g = 0; g <= 360; g += 4) {
      const p = desplazar(a.lat, a.lon, km * 1000, g);
      coords.push([p.lon, p.lat]);
    }
    features.push({ type: "Feature", properties: { km }, geometry: { type: "LineString", coordinates: coords } });
    const p = desplazar(a.lat, a.lon, km * 1000, 0);
    etiquetas.push({ clave: `anillo:${km}`, lon: p.lon, lat: p.lat, texto: `${String(km).replace(".", ",")} km`, clase: "anillo" });
  }
  return { datos: { type: "FeatureCollection", features }, etiquetas };
}
