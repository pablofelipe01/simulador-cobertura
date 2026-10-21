// Datos de referencia (departamentos, municipios, ríos, países) cargados bajo demanda y consultas sobre ellos:
// en qué municipio cae un punto y búsqueda de lugares por nombre. Todo local, sin servicios externos.
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type PropsMunicipio = { n: string; d: string };
export type Lugares = {
  /** [nombre, lon, lat, oeste, sur, este, norte] */
  departamentos: [string, number, number, number, number, number, number][];
  /** [nombre, departamento, lon, lat, oeste, sur, este, norte] */
  municipios: [string, string, number, number, number, number, number, number][];
  /** [nombre, lon, lat] */
  paises: [string, number, number][];
};

export type DatosReferencia = {
  departamentos: FeatureCollection<Polygon | MultiPolygon, { n: string }>;
  municipios: FeatureCollection<Polygon | MultiPolygon, PropsMunicipio>;
  hidrografia: FeatureCollection;
  paises: FeatureCollection;
  lugares: Lugares;
};

let cargando: Promise<DatosReferencia> | null = null;
let datos: DatosReferencia | null = null;

/** Carga (una sola vez) los datos de referencia; se empaquetan aparte para no demorar el arranque. */
export function cargarReferencia(): Promise<DatosReferencia> {
  cargando ??= Promise.all([
    import("@/datos/geo/departamentos.json"),
    import("@/datos/geo/municipios.json"),
    import("@/datos/geo/hidrografia.json"),
    import("@/datos/geo/paises.json"),
    import("@/datos/geo/lugares.json"),
  ]).then(([dep, mun, hid, pai, lug]) => {
    datos = {
      departamentos: (dep.default ?? dep) as unknown as DatosReferencia["departamentos"],
      municipios: (mun.default ?? mun) as unknown as DatosReferencia["municipios"],
      hidrografia: (hid.default ?? hid) as unknown as FeatureCollection,
      paises: (pai.default ?? pai) as unknown as FeatureCollection,
      lugares: (lug.default ?? lug) as unknown as Lugares,
    };
    return datos;
  });
  return cargando;
}

export function referenciaCargada(): DatosReferencia | null {
  return datos;
}

function enAnillo(lon: number, lat: number, anillo: number[][]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function enPoligono(lon: number, lat: number, g: Polygon | MultiPolygon): boolean {
  const poligonos = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return poligonos.some((p) => enAnillo(lon, lat, p[0]) && !p.slice(1).some((h) => enAnillo(lon, lat, h)));
}

/** Municipio y departamento que contienen el punto (null fuera de Colombia o si aún no se cargan los datos). */
export function ubicarMunicipio(lat: number, lon: number): { municipio: string; departamento: string } | null {
  if (!datos) return null;
  const { municipios, lugares } = datos;
  for (let i = 0; i < lugares.municipios.length; i++) {
    const [, , , , o, s, e, n] = lugares.municipios[i];
    if (lon < o || lon > e || lat < s || lat > n) continue;
    const f = municipios.features[i];
    if (f && enPoligono(lon, lat, f.geometry)) return { municipio: f.properties.n, departamento: f.properties.d };
  }
  return null;
}

export function textoUbicacion(lat: number, lon: number): string | null {
  const u = ubicarMunicipio(lat, lon);
  if (!u) return null;
  return u.municipio === u.departamento || u.departamento.startsWith("Bogotá") ? u.departamento : `${u.municipio} (${u.departamento})`;
}

const normal = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type Lugar = {
  tipo: "municipio" | "departamento" | "pais";
  nombre: string;
  detalle: string;
  lat: number;
  lon: number;
  caja?: [number, number, number, number];
};

/** Busca municipios, departamentos y países por nombre (sin tildes, por prefijo o contenido). */
export function buscarLugares(texto: string, max = 8): Lugar[] {
  if (!datos) return [];
  const q = normal(texto);
  if (q.length < 2) return [];
  const resultados: { l: Lugar; p: number }[] = [];
  const puntaje = (nombre: string, extra = "") => {
    const n = normal(nombre);
    const completo = normal(`${nombre} ${extra}`);
    if (n === q) return 100;
    if (n.startsWith(q)) return 80 - n.length / 100;
    if (completo.startsWith(q)) return 70;
    if (n.split(" ").some((w) => w.startsWith(q))) return 60;
    if (completo.includes(q)) return 40;
    return 0;
  };
  for (const [n, lon, lat, o, s, e, nn] of datos.lugares.departamentos) {
    const p = puntaje(n, "departamento");
    if (p) resultados.push({ l: { tipo: "departamento", nombre: n, detalle: "Departamento", lat, lon, caja: [o, s, e, nn] }, p: p + 5 });
  }
  for (const [n, d, lon, lat, o, s, e, nn] of datos.lugares.municipios) {
    const p = puntaje(n, d);
    if (p) resultados.push({ l: { tipo: "municipio", nombre: n, detalle: d, lat, lon, caja: [o, s, e, nn] }, p });
  }
  for (const [n, lon, lat] of datos.lugares.paises) {
    const p = puntaje(n, "pais");
    if (p) resultados.push({ l: { tipo: "pais", nombre: n, detalle: "País", lat, lon }, p: p - 5 });
  }
  return resultados
    .sort((a, b) => b.p - a.p || a.l.nombre.localeCompare(b.l.nombre))
    .slice(0, max)
    .map((r) => r.l);
}
