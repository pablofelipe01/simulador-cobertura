// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Utilidades geográficas: distancias, Web Mercator y coordenadas en grados-minutos-segundos.
import { RADIO_TIERRA_M } from "./constantes";

const RAD = Math.PI / 180;
/** Semiperímetro de Web Mercator (m). */
export const MERCATOR_MAX = Math.PI * 6378137;

export function distanciaM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rumbo inicial de 1 a 2 (grados, 0 = norte, sentido horario). */
export function rumbo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin((lon2 - lon1) * RAD) * Math.cos(lat2 * RAD);
  const x = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) - Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

export function lonAMercator(lon: number): number {
  return (lon / 180) * MERCATOR_MAX;
}
export function latAMercator(lat: number): number {
  const l = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return Math.log(Math.tan(Math.PI / 4 + (l * RAD) / 2)) * 6378137;
}
export function mercatorALon(x: number): number {
  return (x / MERCATOR_MAX) * 180;
}
export function mercatorALat(y: number): number {
  return (2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) / RAD;
}

/** Coordenadas de píxel globales de una tesela XYZ de 256 px en el zoom dado. */
export function lonAPixel(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * 256 * 2 ** zoom;
}
export function latAPixel(lat: number, zoom: number): number {
  const l = Math.max(-85.05112878, Math.min(85.05112878, lat)) * RAD;
  return ((1 - Math.log(Math.tan(l) + 1 / Math.cos(l)) / Math.PI) / 2) * 256 * 2 ** zoom;
}

/** Metros por grado de latitud y de longitud a una latitud dada (aprox. local). */
export function metrosPorGrado(lat: number): { lat: number; lon: number } {
  return { lat: 111132.954 - 559.822 * Math.cos(2 * lat * RAD), lon: 111319.49 * Math.cos(lat * RAD) };
}

/** Punto a una distancia y rumbo dados (aprox. local, válido para decenas de km). */
export function desplazar(lat: number, lon: number, distancia: number, rumboGrados: number) {
  const m = metrosPorGrado(lat);
  return {
    lat: lat + (distancia * Math.cos(rumboGrados * RAD)) / m.lat,
    lon: lon + (distancia * Math.sin(rumboGrados * RAD)) / m.lon,
  };
}

const numero = (s: string) => Number(s.replace(",", "."));

/**
 * Lee una coordenada en grados decimales o en grados-minutos-segundos.
 * Acepta: "4.4567", "-72,98", "4°27'36.2\" N", "72 58 12,1 O", "W72°58.2'".
 */
export function leerCoordenada(texto: string, eje: "lat" | "lon"): number | null {
  const t = texto.trim().toUpperCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"').replace(/''/g, '"');
  if (!t) return null;
  const hemisferio = t.match(/[NSEOW]/)?.[0];
  const partes = t.match(/-?\d+(?:[.,]\d+)?/g);
  if (!partes || partes.length > 3) return null;
  const [g, m = "0", s = "0"] = partes;
  const grados = numero(g);
  const minutos = numero(m);
  const segundos = numero(s);
  if ([grados, minutos, segundos].some((n) => !Number.isFinite(n))) return null;
  if (minutos < 0 || minutos >= 60 || segundos < 0 || segundos >= 60) return null;
  let valor = Math.abs(grados) + minutos / 60 + segundos / 3600;
  const negativo = grados < 0 || g.startsWith("-") || hemisferio === "S" || hemisferio === "W" || hemisferio === "O";
  if (hemisferio && ((eje === "lat" && !"NS".includes(hemisferio)) || (eje === "lon" && "NS".includes(hemisferio)))) return null;
  if (negativo) valor = -valor;
  const limite = eje === "lat" ? 90 : 180;
  return Math.abs(valor) <= limite ? valor : null;
}

/** Lee un par "lat, lon" en una sola cadena (decimal o GMS). */
export function leerPar(texto: string): { lat: number; lon: number } | null {
  const t = texto.trim();
  // GMS con hemisferios: separar por la letra de latitud
  const gms = t.toUpperCase().match(/^(.*?[NS])\s*[,;]?\s*(.*[EOW])$/);
  if (gms) {
    const lat = leerCoordenada(gms[1], "lat");
    const lon = leerCoordenada(gms[2], "lon");
    return lat !== null && lon !== null ? { lat, lon } : null;
  }
  const decimal = t.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/) ?? t.match(/^\s*(-?\d+(?:,\d+)?)\s*[;\s]\s*(-?\d+(?:,\d+)?)\s*$/);
  if (!decimal) return null;
  const lat = leerCoordenada(decimal[1], "lat");
  const lon = leerCoordenada(decimal[2], "lon");
  return lat !== null && lon !== null ? { lat, lon } : null;
}

/** Formato GMS en español: 4°27'36,2" N · 72°58'12,1" O */
export function aGMS(valor: number, eje: "lat" | "lon"): string {
  const hemisferio = eje === "lat" ? (valor >= 0 ? "N" : "S") : valor >= 0 ? "E" : "O";
  let abs = Math.abs(valor);
  let g = Math.floor(abs);
  abs = (abs - g) * 60;
  let m = Math.floor(abs);
  let s = Math.round((abs - m) * 60 * 10) / 10;
  if (s >= 60) {
    s = 0;
    m += 1;
  }
  if (m >= 60) {
    m = 0;
    g += 1;
  }
  return `${g}°${String(m).padStart(2, "0")}'${s.toFixed(1).replace(".", ",").padStart(4, "0")}" ${hemisferio}`;
}

export function aDecimal(valor: number): string {
  return valor.toFixed(6);
}

/** Área de un polígono [lon, lat] sobre la esfera (m²), como en geojson-area. */
export function areaPoligonoM2(puntos: [number, number][]): number {
  if (puntos.length < 3) return 0;
  const R = 6378137;
  let total = 0;
  for (let i = 0; i < puntos.length; i++) {
    const [lon1, lat1] = puntos[i];
    const [lon2, lat2] = puntos[(i + 1) % puntos.length];
    total += (lon2 - lon1) * RAD * (2 + Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD));
  }
  return Math.abs((total * R * R) / 2);
}

/** Longitud de una ruta [lon, lat] (m). */
export function longitudRutaM(puntos: [number, number][], cerrada = false): number {
  let d = 0;
  for (let i = 1; i < puntos.length; i++) d += distanciaM(puntos[i - 1][1], puntos[i - 1][0], puntos[i][1], puntos[i][0]);
  if (cerrada && puntos.length > 2) d += distanciaM(puntos[puntos.length - 1][1], puntos[puntos.length - 1][0], puntos[0][1], puntos[0][0]);
  return d;
}

const ROSA = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];

/** Rumbo con su punto cardinal: «34° (NE)». */
export function rumboTexto(grados: number): string {
  const g = ((grados % 360) + 360) % 360;
  return `${Math.round(g)}° (${ROSA[Math.round(g / 22.5) % 16]})`;
}

export function puntoCardinal(grados: number): string {
  const g = ((grados % 360) + 360) % 360;
  return ROSA[Math.round(g / 22.5) % 16];
}

/** «850 m», «3,42 km». */
export function formatoDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1).replace(".", ",")} km`;
}

/** «4.500 m²», «12,3 ha», «45,6 km²». */
export function formatoArea(m2: number): string {
  if (m2 < 10000) return `${Math.round(m2).toLocaleString("es-CO")} m²`;
  if (m2 < 1e6) return `${(m2 / 10000).toFixed(2).replace(".", ",")} ha`;
  return `${(m2 / 1e6).toFixed(2).replace(".", ",")} km² (${Math.round(m2 / 10000).toLocaleString("es-CO")} ha)`;
}
