// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Datos de referencia (departamentos, municipios, ríos, países) cargados bajo demanda y consultas sobre ellos:
// en qué municipio cae un punto, búsqueda de lugares por nombre y reconocimiento de lugares dichos por voz (aunque el
// dictado los escriba mal). Todo local, sin servicios externos.
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { claveFonetica, parecidoFonetico } from "./fonetica";

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

/** El nombre sin espacios ni artículos: «Barranca de Upía» → «barrancaupia» (así lo escribe a veces el dictado). */
export const nombreCompacto = (t: string) => normal(t).replace(/\b(de|del|la|las|los|el|y)\b/g, " ").replace(/\s+/g, "");

/** Distancia de edición (letras de más, de menos o cambiadas) entre dos nombres. */
export function distanciaNombres(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previa = fila;
  }
  return previa[b.length];
}

/** ¿Lo dicho es ese nombre, aunque el dictado lo haya escrito pegado o con una o dos letras distintas? */
export function pareceNombre(dicho: string, nombre: string): boolean {
  const a = nombreCompacto(dicho);
  const b = nombreCompacto(nombre);
  if (a.length < 4 || b.length < 4) return a === b;
  if (a === b) return true;
  const tolerancia = b.length >= 11 ? 2 : b.length >= 6 ? 1 : 0;
  return tolerancia > 0 && distanciaNombres(a, b) <= tolerancia;
}

/**
 * Busca municipios, departamentos y países por nombre (sin tildes, por prefijo o contenido). Si no hay nada así,
 * acepta el nombre pegado o con una o dos letras distintas («barrancaupia», «barranca de opia» → Barranca de Upía).
 */
export function buscarLugares(texto: string, max = 8): Lugar[] {
  if (!datos) return [];
  const q = normal(texto);
  if (q.length < 2) return [];
  const qc = nombreCompacto(texto);
  const resultados: { l: Lugar; p: number }[] = [];
  const puntaje = (nombre: string, extra = "") => {
    const n = normal(nombre);
    const completo = normal(`${nombre} ${extra}`);
    if (n === q) return 100;
    if (n.startsWith(q)) return 80 - n.length / 100;
    if (completo.startsWith(q)) return 70;
    if (n.split(" ").some((w) => w.startsWith(q))) return 60;
    if (completo.includes(q)) return 40;
    if (qc.length >= 5) {
      const nc = nombreCompacto(nombre);
      if (nc === qc) return 90;
      if (qc.length >= 6 && nc.startsWith(qc)) return 50;
      if (pareceNombre(texto, nombre)) return 35;
    }
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
  // Nada escrito así: lo que suena parecido («barranco vía meta» → Barranca de Upía)
  if (!resultados.length && qc.length >= 5) {
    for (const c of reconocerLugares(texto, { max }))
      if (c.puntaje >= 0.7) resultados.push({ l: c.lugar, p: 20 * c.puntaje });
  }
  return resultados
    .sort((a, b) => b.p - a.p || a.l.nombre.localeCompare(b.l.nombre))
    .slice(0, max)
    .map((r) => r.l);
}

/* ───────────── Lugares dichos por voz (aunque el dictado los escriba mal) ───────────── */

/** Nombres que conviene que el reconocimiento de voz entienda bien: los departamentos y los municipios del que se ve. */
export function nombresParaVoz(departamento?: string | null): string[] {
  if (!datos) return [];
  const deps = datos.lugares.departamentos.map((d) => d[0]);
  const muns = departamento ? datos.lugares.municipios.filter((m) => m[1] === departamento).map((m) => m[0]) : [];
  return [...new Set([...deps, ...muns])];
}

/** Un lugar que puede ser el que se dijo, con cuánto se parece (0 a 1) y su puntaje con el contexto. */
export type CandidatoLugar = {
  lugar: Lugar;
  /** Parecido de cómo suena lo dicho con el nombre (1 = igual). */
  parecido: number;
  /** El parecido con el departamento dicho, el exacto y el contexto (para ordenar y decidir). */
  puntaje: number;
  /** Escrito igual (sin tildes ni artículos). */
  exacto: boolean;
  /** El departamento que se dijo con el nombre («…, Meta»), si se dijo. */
  departamentoDicho: string | null;
  /** Queda en el departamento que se está viendo en el mapa. */
  enVista?: boolean;
};

type Entrada = { lugar: Lugar; compacto: string; clave: string; departamento: string };
let indice: Entrada[] | null = null;

/** Otros nombres con que se dice un departamento. */
const ALIAS_DEPARTAMENTO: Record<string, string[]> = {
  "Bogotá, D. C.": ["Bogotá", "Distrito Capital"],
  "San Andrés y Providencia": ["San Andrés"],
};

function indiceLugares(): Entrada[] {
  if (indice) return indice;
  if (!datos) return [];
  const lista: Entrada[] = [];
  const agregar = (lugar: Lugar, nombre: string, departamento: string) => {
    const compacto = nombreCompacto(nombre);
    lista.push({ lugar, compacto, clave: claveFonetica(compacto), departamento });
  };
  for (const [n, lon, lat, o, s, e, nn] of datos.lugares.departamentos) {
    const lugar: Lugar = { tipo: "departamento", nombre: n, detalle: "Departamento", lat, lon, caja: [o, s, e, nn] };
    agregar(lugar, n, n);
    for (const a of ALIAS_DEPARTAMENTO[n] ?? []) agregar(lugar, a, n);
  }
  for (const [n, d, lon, lat, o, s, e, nn] of datos.lugares.municipios) agregar({ tipo: "municipio", nombre: n, detalle: d, lat, lon, caja: [o, s, e, nn] }, n, d);
  indice = lista;
  return lista;
}

const CONECTOR_FINAL = /^(en|el|la|del|de|departamento|depto|dpto|y)$/;

/** El departamento dicho al final («…, Meta», «… del Meta», «… departamento del Casanare») y lo que queda antes. */
function departamentoAlFinal(palabras: string[]): { resto: string[]; departamento: string } | null {
  const deps = indiceLugares().filter((e) => e.lugar.tipo === "departamento");
  for (let k = Math.min(3, palabras.length - 1); k >= 1; k--) {
    const compacto = nombreCompacto(palabras.slice(palabras.length - k).join(" "));
    if (compacto.length < 3) continue;
    const clave = claveFonetica(compacto);
    let mejor: { e: Entrada; p: number } | null = null;
    for (const e of deps) {
      const p = e.compacto === compacto ? 1 : e.clave.length >= 5 ? parecidoFonetico(clave, e.clave) : 0;
      if (p >= 0.86 && (!mejor || p > mejor.p)) mejor = { e, p };
    }
    if (!mejor) continue;
    let resto = palabras.slice(0, palabras.length - k);
    while (resto.length && CONECTOR_FINAL.test(resto[resto.length - 1])) resto = resto.slice(0, -1);
    if (resto.length) return { resto, departamento: mejor.e.departamento };
  }
  return null;
}

/**
 * Los municipios y departamentos que pueden ser lo dicho, del más probable al menos: compara cómo suena (no cómo se
 * escribe) y tiene en cuenta el departamento dicho al final («barranco vía meta») y el departamento que se está
 * viendo en el mapa (`departamento`), para desempatar nombres repetidos («Granada» hay en el Meta, Antioquia y
 * Cundinamarca).
 */
export function reconocerLugares(texto: string, o: { departamento?: string | null; max?: number } = {}): CandidatoLugar[] {
  const lista = indiceLugares();
  if (!lista.length) return [];
  const palabras = normal(texto)
    .replace(/^(el|la|los|las)\s+/, "")
    .replace(/^(municipio|ciudad|pueblo|vereda|corregimiento|departamento)\s+(de|del)?\s*/, "")
    .split(" ")
    .filter(Boolean);
  if (!palabras.length) return [];
  const lecturas: { palabras: string[]; departamento: string | null }[] = [{ palabras, departamento: null }];
  const conDep = departamentoAlFinal(palabras);
  if (conDep) lecturas.push({ palabras: conDep.resto, departamento: conDep.departamento });
  const mejores = new Map<Entrada, CandidatoLugar>();
  for (const lec of lecturas) {
    const compacto = nombreCompacto(lec.palabras.join(" "));
    if (compacto.length < 3) continue;
    const clave = claveFonetica(compacto);
    for (const e of lista) {
      // Con el departamento dicho se busca el municipio
      if (lec.departamento && e.lugar.tipo === "departamento") continue;
      const exacto = e.compacto === compacto;
      let parecido = 1;
      if (!exacto) {
        // Los nombres cortos («Une», «Meta») solo valen escritos igual
        if (e.clave.length < 5 || clave.length < 4) continue;
        if (Math.abs(e.clave.length - clave.length) > Math.max(3, e.clave.length * 0.4)) continue;
        parecido = e.clave === clave ? 0.98 : parecidoFonetico(clave, e.clave);
        if (parecido < 0.6) continue;
      }
      let puntaje = parecido + (exacto ? 0.08 : 0);
      if (lec.departamento) puntaje += e.departamento === lec.departamento ? 0.06 : -0.15;
      if (o.departamento && e.departamento === o.departamento) puntaje += 0.03;
      if (e.lugar.tipo === "departamento") puntaje -= 0.01;
      const previo = mejores.get(e);
      if (!previo || puntaje > previo.puntaje) mejores.set(e, { lugar: e.lugar, parecido, puntaje, exacto, departamentoDicho: lec.departamento, enVista: Boolean(o.departamento && e.departamento === o.departamento) });
    }
  }
  // Un mismo lugar puede entrar por su nombre y por un alias: se deja el mejor
  const unicos = new Map<string, CandidatoLugar>();
  for (const c of mejores.values()) {
    const clave = `${c.lugar.tipo}|${c.lugar.nombre}|${c.lugar.detalle}`;
    const previo = unicos.get(clave);
    if (!previo || c.puntaje > previo.puntaje) unicos.set(clave, c);
  }
  return [...unicos.values()].sort((a, b) => b.puntaje - a.puntaje || a.lugar.nombre.localeCompare(b.lugar.nombre)).slice(0, o.max ?? 5);
}

export type DecisionLugar =
  /** Claro: es ese lugar. */
  | { tipo: "seguro"; candidato: CandidatoLugar; opciones: CandidatoLugar[] }
  /** Puede ser uno de estos: conviene preguntar «¿se refiere a…?». */
  | { tipo: "dudoso"; opciones: CandidatoLugar[] }
  /** Nada se parece lo suficiente (opciones lejanas, por si sirven de pista). */
  | { tipo: "ninguno"; opciones: CandidatoLugar[] };

/**
 * ¿Lo dicho es claramente un lugar, puede ser uno de varios o ninguno? Los nombres largos aceptan más diferencias
 * que los cortos; si dos se parecen casi igual (o el nombre está repetido en varios departamentos), es dudoso.
 */
export function decidirLugar(candidatos: CandidatoLugar[]): DecisionLugar {
  const [a, b] = candidatos;
  if (!a) return { tipo: "ninguno", opciones: [] };
  const largo = claveFonetica(nombreCompacto(a.lugar.nombre)).length;
  const umbral = largo >= 9 ? 0.84 : largo >= 6 ? 0.88 : 0.95;
  const margen = b ? a.puntaje - b.puntaje : 1;
  const separado = margen >= 0.05 || (a.exacto && (!b?.exacto || margen >= 0.02));
  // Un nombre parecido (no igual), sin departamento dicho y lejos de lo que se ve en el mapa, se confirma antes
  const confirmar = !a.exacto && !a.departamentoDicho && !a.enVista && a.parecido < 0.95;
  if (a.puntaje >= umbral && separado && !confirmar) return { tipo: "seguro", candidato: a, opciones: candidatos };
  if (a.puntaje >= umbral - 0.14) return { tipo: "dudoso", opciones: candidatos.filter((x) => x.puntaje >= Math.max(umbral - 0.2, a.puntaje - 0.12)).slice(0, 4) };
  return { tipo: "ninguno", opciones: candidatos.filter((x) => x.puntaje >= 0.62).slice(0, 3) };
}

/** «Barranca de Upía (Meta)», «el Meta». */
export const nombreLugar = (l: Lugar) =>
  l.tipo === "municipio" ? `${l.nombre} (${l.detalle})` : l.tipo === "departamento" ? (l.nombre.startsWith("Bogotá") ? l.nombre : `el departamento de ${l.nombre}`) : l.nombre;

const areaGrados = (r: number[][]) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return Math.abs(s / 2);
};

/**
 * El contorno de un municipio o un departamento ([lon, lat], sin repetir el primer punto), para cubrirlo entero con
 * la malla. Si el lugar tiene varias partes (islas), es la más grande.
 */
export function contornoLugar(l: Lugar): [number, number][] | null {
  if (!datos) return null;
  let g: Polygon | MultiPolygon | undefined;
  if (l.tipo === "municipio") {
    const i = datos.lugares.municipios.findIndex((x) => x[0] === l.nombre && x[1] === l.detalle);
    g = i >= 0 ? datos.municipios.features[i]?.geometry : undefined;
  } else if (l.tipo === "departamento") g = datos.departamentos.features.find((f) => f.properties.n === l.nombre)?.geometry;
  if (!g) return null;
  const anillos = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
  const mayor = anillos.reduce((x, y) => (areaGrados(y) > areaGrados(x) ? y : x));
  const puntos = mayor.map((p) => [p[0], p[1]] as [number, number]);
  const [p0, pn] = [puntos[0], puntos[puntos.length - 1]];
  if (puntos.length > 3 && p0[0] === pn[0] && p0[1] === pn[1]) puntos.pop();
  return puntos.length >= 3 ? puntos : null;
}
