// «Poblar personas»: reparte N personas (billeteras) al azar dentro de un área para probar la red con la densidad real
// de una zona (Trama: 0,2 usuarios/km² disperso, 1 medio, 5 denso). El reparto es uniforme sobre el terreno y
// repetible con la misma semilla.
import { areaM2, cajaPoligono, dentroPoligono, type Poligono } from "./area";

/** Generador pseudoaleatorio pequeño y repetible (mulberry32). */
export function generador(semilla: number): () => number {
  let a = semilla >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type OpcionesPoblar = {
  /** Cuántas personas. */
  n: number;
  /** Semilla del reparto (el mismo número da el mismo reparto). */
  semilla?: number;
  /** Solo acepta puntos que cumplan esta condición (por ejemplo, con señal ≥ 20 dB). */
  acepta?: (lat: number, lon: number) => boolean;
  /** Distancia mínima entre personas (m), para que no queden encimadas. */
  separacionM?: number;
};

/**
 * Puntos al azar, uniformes sobre el terreno, dentro del polígono ([lon, lat]). Si la condición deja pocos puntos
 * válidos, devuelve los que alcanzó a encontrar.
 */
export function puntosAlAzar(poligono: Poligono, o: OpcionesPoblar): { lat: number; lon: number }[] {
  const n = Math.max(0, Math.min(5000, Math.round(o.n)));
  if (!n || poligono.length < 3) return [];
  const azar = generador(o.semilla ?? 1);
  const caja = cajaPoligono(poligono);
  // Uniforme en área: la latitud se sortea en seno (las celdas de un grado se angostan hacia los polos)
  const s0 = Math.sin((caja.sur * Math.PI) / 180);
  const s1 = Math.sin((caja.norte * Math.PI) / 180);
  const sep = o.separacionM ?? Math.min(150, Math.sqrt(areaM2(poligono) / n) / 4);
  const celda = new Map<string, { lat: number; lon: number }[]>();
  const gradoLat = 111_320;
  const clave = (lat: number, lon: number) => `${Math.floor((lat * gradoLat) / Math.max(sep, 1))}|${Math.floor((lon * gradoLat * Math.cos((lat * Math.PI) / 180)) / Math.max(sep, 1))}`;
  const cerca = (lat: number, lon: number) => {
    if (sep <= 0) return false;
    const [fy, fx] = clave(lat, lon).split("|").map(Number);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const q of celda.get(`${fy + dy}|${fx + dx}`) ?? []) {
          const dlat = (q.lat - lat) * gradoLat;
          const dlon = (q.lon - lon) * gradoLat * Math.cos((lat * Math.PI) / 180);
          if (dlat * dlat + dlon * dlon < sep * sep) return true;
        }
    return false;
  };
  const salida: { lat: number; lon: number }[] = [];
  const intentos = n * 400;
  for (let k = 0; k < intentos && salida.length < n; k++) {
    const lat = (Math.asin(s0 + azar() * (s1 - s0)) * 180) / Math.PI;
    const lon = caja.oeste + azar() * (caja.este - caja.oeste);
    if (!dentroPoligono(lon, lat, poligono)) continue;
    if (o.acepta && !o.acepta(lat, lon)) continue;
    if (cerca(lat, lon)) continue;
    const p = { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
    salida.push(p);
    const c = clave(p.lat, p.lon);
    celda.set(c, [...(celda.get(c) ?? []), p]);
  }
  return salida;
}

/** Personas para una densidad (usuarios/km²) en el área, redondeado. */
export function personasPorDensidad(poligono: Poligono, densidadKm2: number): number {
  return Math.round((areaM2(poligono) / 1e6) * Math.max(0, densidadKm2));
}
