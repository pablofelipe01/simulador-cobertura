// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Capas de referencia: países, departamentos, municipios, ríos y lagos (datos locales) con nombres.
// Los nombres se dibujan como marcadores HTML (no requieren tipografías de un servidor externo) y se acomodan como en
// un mapa profesional: cada lugar sale una sola vez, ningún nombre tapa a otro, el tamaño va con la distancia (el zoom)
// y cada clase de nombre tiene su franja de zoom. Lejos se ven los países, los mares, las ciudades principales y los
// departamentos; de cerca, los poblados de Esri (o, sin ellos, los municipios). Los ríos llevan su nombre a lo largo
// del cauce, uno por tramo, más seguido a medida que se acerca. Los mapas base que ya traen nombres (topográfico,
// OpenTopoMap y calles) usan los suyos, para no repetirlos.
import maplibregl, { type GeoJSONSource, type Map as MapaML, type Marker } from "maplibre-gl";

import { idioma } from "@/lib/idioma";
import { cargarReferencia, type DatosReferencia } from "@/lib/geo/referencia";
import { AGUAS, AGUAS_DATOS, CIUDADES, PAISES_EN } from "@/lib/geo/rotulos";

import type { FondoMapa, Vista } from "./estado";

const VACIO = { type: "FeatureCollection" as const, features: [] };

/**
 * Desde este zoom se ven los nombres de Esri («Poblados y lugares») sobre el satélite: sus teselas de ese nivel ya solo
 * traen poblados y los departamentos escritos sobre sus límites. Más lejos, Esri repite los países, los departamentos
 * y las ciudades que pinta el simulador (y en inglés), así que ahí se muestran solo los nombres propios.
 */
export const ZOOM_NOMBRES_ESRI = 7.5;

/** Crea las fuentes y capas vacías (el orden de la pila se fija desde el inicio). */
export function crearCapasReferencia(m: MapaML) {
  for (const id of ["ref-paises", "ref-departamentos", "ref-municipios", "ref-hidrografia"]) m.addSource(id, { type: "geojson", data: VACIO });
  m.addLayer({ id: "ref-lagos", type: "fill", source: "ref-hidrografia", filter: ["has", "lago"], paint: { "fill-color": "#4FB3E8", "fill-opacity": 0.45 } });
  m.addLayer({
    id: "ref-rios",
    type: "line",
    source: "ref-hidrografia",
    filter: ["!", ["has", "lago"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#4FB3E8", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 8, 1.8, 12, 3], "line-opacity": 0.9 },
  });
  m.addLayer({
    id: "ref-municipios",
    type: "line",
    source: "ref-municipios",
    minzoom: 7,
    paint: { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 12, 1.4], "line-dasharray": [3, 2], "line-opacity": 0.75 },
  });
  m.addLayer({
    id: "ref-departamentos-halo",
    type: "line",
    source: "ref-departamentos",
    paint: { "line-color": "#1E2120", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 10, 4], "line-opacity": 0.35 },
  });
  m.addLayer({
    id: "ref-departamentos",
    type: "line",
    source: "ref-departamentos",
    paint: { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 10, 2], "line-opacity": 0.9 },
  });
  m.addLayer({
    id: "ref-paises-halo",
    type: "line",
    source: "ref-paises",
    paint: { "line-color": "#1E2120", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 10, 6], "line-opacity": 0.35 },
  });
  m.addLayer({
    id: "ref-paises",
    type: "line",
    source: "ref-paises",
    paint: { "line-color": "#FFE9A8", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 10, 3], "line-dasharray": [4, 2] },
  });
}

/** Colores según el mapa base: claros sobre el satélite, oscuros sobre los mapas claros. */
export function colorearReferencia(m: MapaML, fondo: FondoMapa) {
  const satelite = fondo === "satelite";
  m.setPaintProperty("ref-municipios", "line-color", satelite ? "#FFFFFF" : "#7A5C8E");
  m.setPaintProperty("ref-departamentos", "line-color", satelite ? "#FFFFFF" : "#5B3F73");
  m.setPaintProperty("ref-departamentos-halo", "line-opacity", satelite ? 0.35 : 0.08);
  m.setPaintProperty("ref-paises", "line-color", satelite ? "#FFE9A8" : "#3D2A52");
  m.setPaintProperty("ref-rios", "line-color", satelite ? "#62C6F2" : "#2F86C9");
}

export function visibilidadReferencia(m: MapaML, v: Vista) {
  const pon = (ids: string[], si: boolean) => ids.forEach((id) => m.getLayer(id) && m.setLayoutProperty(id, "visibility", si ? "visible" : "none"));
  pon(["ref-municipios", "ref-departamentos", "ref-departamentos-halo"], v.refDivision);
  pon(["ref-rios", "ref-lagos"], v.refRios);
  pon(["ref-paises", "ref-paises-halo"], v.refPaises);
}

/** ¿Se ven los nombres de Esri? Solo sobre el satélite (los otros mapas base traen los suyos) y si están activos. */
export const nombresEsriVisibles = (v: Vista) => v.refNombres && v.fondo === "satelite";

type Clase = "pais" | "oceano" | "mar" | "golfo" | "lago" | "ciudad" | "departamento" | "municipio" | "rio";
type Capa = "division" | "rios" | "paises";

/** Un nombre que va en un punto (países, aguas, ciudades, departamentos, municipios, lagos). */
type Punto = {
  clave: string;
  clase: Clase;
  es: string;
  en: string;
  lon: number;
  lat: number;
  minZ: number;
  /** Zoom desde el que ya no se pinta: [con los nombres de Esri, sin ellos]. */
  maxZ: [number, number];
  prioridad: number;
  capa: Capa;
  /** Nombres repartidos en varios puntos (los océanos): no se repiten cerca. */
  grupo?: string;
  /** «municipio|departamento»: si su ciudad está a la vista, el municipio no se repite. */
  municipio?: string;
  /** Rango de la ciudad (1, 2 o 3): el tamaño y el punto. */
  rango?: 1 | 2 | 3;
};

/** Un río: su nombre va a lo largo del cauce, un nombre por tramo visible. */
type Rio = {
  clave: string;
  es: string;
  en: string;
  /** Las líneas del río (las de un mismo nombre van juntas) y su caja, para descartar rápido las que no se ven. */
  lineas: { puntos: [number, number][]; caja: [number, number, number, number] }[];
  minZ: number;
  prioridad: number;
};

type Caja = { x0: number; y0: number; x1: number; y1: number };

/** Lo que quedó en pantalla en esta pasada. */
type Colocada = {
  clave: string;
  clase: Clase;
  texto: string;
  lon: number;
  lat: number;
  tam: number;
  angulo: number;
  opacidad: number;
  rango?: 1 | 2 | 3;
  /** Corrimiento del nombre respecto a su punto (px), cuando en el punto exacto no cabía. */
  dx: number;
  dy: number;
  /** Ciudades: el nombre a la derecha del punto o, si ahí no cabe, a la izquierda. */
  lado?: "der" | "izq";
};

const FAMILIA = '"Barlow Semi Condensed", "Barlow", system-ui, sans-serif';

/** Interpolación lineal por tramos del tamaño de letra según el zoom ([zoom, px] en orden). */
function porZoom(z: number, tramos: [number, number][]): number {
  if (z <= tramos[0][0]) return tramos[0][1];
  for (let i = 1; i < tramos.length; i++) {
    const [z1, v1] = tramos[i];
    if (z <= z1) {
      const [z0, v0] = tramos[i - 1];
      return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
    }
  }
  return tramos[tramos.length - 1][1];
}

/** Tipografía de cada clase: tamaño según el zoom, peso, cursiva, mayúsculas y espaciado (en em). */
function estiloDe(clase: Clase, z: number, rango?: 1 | 2 | 3) {
  switch (clase) {
    case "pais":
      return { tam: porZoom(z, [[3, 11], [5, 14], [7.5, 17.5]]), peso: 700, cursiva: false, mayus: true, espacio: 0.14 };
    case "oceano":
      return { tam: porZoom(z, [[3, 12], [6, 15]]), peso: 600, cursiva: true, mayus: false, espacio: 0.2 };
    case "mar":
      return { tam: porZoom(z, [[3.5, 12], [6, 15]]), peso: 600, cursiva: true, mayus: false, espacio: 0.16 };
    case "golfo":
    case "lago":
      return { tam: porZoom(z, [[5, 11], [9, 13.5]]), peso: 500, cursiva: true, mayus: false, espacio: 0.04 };
    case "ciudad":
      return { tam: porZoom(z, rango === 1 ? [[3.5, 11.5], [7.5, 14.5]] : [[4.5, 10.5], [8.6, 13.5]]), peso: rango === 1 ? 700 : 600, cursiva: false, mayus: false, espacio: 0.01 };
    case "departamento":
      return { tam: porZoom(z, [[5.3, 10.5], [9.3, 14]]), peso: 600, cursiva: false, mayus: true, espacio: 0.07 };
    case "municipio":
      return { tam: porZoom(z, [[8.6, 11], [12, 13.5]]), peso: 500, cursiva: false, mayus: false, espacio: 0 };
    case "rio":
      return { tam: porZoom(z, [[4, 10.5], [9, 12.5], [13, 13.5]]), peso: 500, cursiva: true, mayus: false, espacio: 0.02 };
  }
}

/** Radio del punto de las ciudades (px). */
const RADIO_CIUDAD = 3;
/** Separación entre el punto y el nombre de la ciudad (px). */
const HUECO_CIUDAD = 4;
/** Margen alrededor de cada nombre para que el halo no toque al vecino (px). */
const MARGEN = 3;
/** Distancia mínima en pantalla entre dos nombres del mismo río (px): más cerca, se ven repetidos. */
const ESPACIO_RIO = 420;
/** Distancia mínima entre dos nombres de un mismo océano o mar (px). */
const ESPACIO_GRUPO = 700;
/** Cuántos nombres como máximo a la vez. */
const MAXIMO = 220;

/**
 * Lo que va encima del mapa y los nombres no deben tapar: herramientas, capas, leyenda, controles, coordenadas, Melki,
 * la flecha de la barra y los marcadores del escenario (nodos con su nombre, alcances, enlaces, el robot…).
 */
const TAPAS = "[data-tapa-mapa], [data-tour=herramientas], [data-tour=pieza-mapa], [data-tour=capas], [data-tour=leyenda], [data-tour=melki], .maplibregl-ctrl";
/** Los marcadores del escenario: su caja y la de lo que llevan dentro (el nombre del nodo sale de la caja de la torre). */
const MARCADORES = ".maplibregl-marker:not(.etiqueta-ref)";

const cruza = (a: Caja, b: Caja) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * El nombre para comparar si dos se repiten: sin tildes, sin mayúsculas y sin el «D. C.» del distrito capital
 * («BOGOTÁ, D. C.» y «Bogotá» son el mismo nombre; también «ARAUCA», el departamento, y «Arauca», su capital).
 */
function nombreBase(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/,?\s*d\.?\s*c\.?$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Gestor de nombres: pinta solo los que caben en pantalla y corresponden al zoom actual, sin repetir ni encimar. */
export class EtiquetasReferencia {
  private datos: DatosReferencia | null = null;
  private puntos: Punto[] = [];
  private rios: Rio[] = [];
  private vivas = new Map<string, { mk: Marker; el: HTMLDivElement; texto: HTMLSpanElement; lon: number; lat: number; dx: number; dy: number }>();
  private vista: Vista | null = null;
  private lienzo: CanvasRenderingContext2D | null = null;
  private medidas = new Map<string, number>();
  private ultimo = 0;
  private pendiente = 0;
  /** Mientras el zoom se mueve, los nombres que entran o salen de su franja se desvanecen; quieto, todos van enteros. */
  private enZoom = false;
  private alMover = () => {
    this.enZoom = false;
    this.actualizar();
  };
  private alZoom = () => {
    this.enZoom = true;
    this.programar();
  };

  constructor(private m: MapaML) {
    m.on("moveend", this.alMover);
    m.on("zoom", this.alZoom);
    m.on("resize", this.alMover);
    // Con las tipografías ya cargadas las medidas cambian: se vuelve a acomodar
    if (typeof document !== "undefined" && document.fonts?.ready)
      void document.fonts.ready.then(() => {
        this.medidas.clear();
        this.actualizar();
      });
  }

  async cargar() {
    const d = await cargarReferencia();
    this.datos = d;
    (this.m.getSource("ref-departamentos") as GeoJSONSource | undefined)?.setData(d.departamentos);
    (this.m.getSource("ref-municipios") as GeoJSONSource | undefined)?.setData(d.municipios);
    (this.m.getSource("ref-hidrografia") as GeoJSONSource | undefined)?.setData(d.hidrografia);
    (this.m.getSource("ref-paises") as GeoJSONSource | undefined)?.setData(d.paises);
    this.puntos = puntosDe(d);
    this.rios = riosDe(d);
    this.actualizar();
    return d;
  }

  aplicarVista(v: Vista) {
    this.vista = v;
    this.actualizar();
  }

  /** Al cambiar de idioma: los nombres que cambian (países, aguas, algunas ciudades) se reescriben. */
  retitular() {
    this.medidas.clear();
    this.actualizar();
  }

  /** Mientras el zoom se mueve, se reacomoda a lo sumo cada 80 ms (el tamaño acompaña la distancia). */
  private programar() {
    if (this.pendiente) return;
    const espera = Math.max(0, 80 - (performance.now() - this.ultimo));
    this.pendiente = window.setTimeout(() => {
      this.pendiente = 0;
      requestAnimationFrame(() => this.actualizar());
    }, espera);
  }

  /** Ancho del texto en px: se mide una vez a 100 px y se escala (el ancho es proporcional al tamaño de la letra). */
  private ancho(texto: string, e: ReturnType<typeof estiloDe>): number {
    const clave = `${e.cursiva ? "i" : "n"}${e.peso}|${texto}`;
    let w = this.medidas.get(clave);
    if (w === undefined) {
      if (!this.lienzo) this.lienzo = document.createElement("canvas").getContext("2d");
      if (this.lienzo) {
        this.lienzo.font = `${e.cursiva ? "italic " : ""}${e.peso} 100px ${FAMILIA}`;
        w = this.lienzo.measureText(texto).width;
      } else w = texto.length * 52;
      this.medidas.set(clave, w);
    }
    return (w * e.tam) / 100 + e.espacio * e.tam * Math.max(0, texto.length - 1);
  }

  /** Lo que tapa el mapa (las herramientas, los controles, la flecha de la barra…): ahí no se ponen nombres. */
  private tapas(): Caja[] {
    const base = this.m.getContainer().getBoundingClientRect();
    const cajas: Caja[] = [];
    const sumar = (el: Element) => {
      // Lo que está escondido (las etiquetas del alcance que lejos no se muestran) no tapa nada
      if ((el as HTMLElement).style?.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.right < base.left || r.left > base.right || r.bottom < base.top || r.top > base.bottom) return;
      cajas.push({ x0: r.left - base.left - 2, y0: r.top - base.top - 2, x1: r.right - base.left + 2, y1: r.bottom - base.top + 2 });
    };
    for (const el of document.querySelectorAll(TAPAS)) sumar(el);
    for (const el of this.m.getContainer().querySelectorAll(MARCADORES)) {
      sumar(el);
      for (const hijo of el.querySelectorAll(":scope > *, :scope > * > span")) sumar(hijo);
    }
    return cajas;
  }

  actualizar() {
    this.ultimo = performance.now();
    if (!this.datos || !this.vista) return;
    const v = this.vista;
    const m = this.m;
    // Los mapas base con nombres propios ya los traen: no se repiten encima
    if (v.fondo !== "satelite") {
      this.aplicar([]);
      return;
    }
    const z = m.getZoom();
    const esri = nombresEsriVisibles(v);
    const ingles = idioma() === "en";
    const cont = m.getContainer();
    const W = cont.clientWidth;
    const H = cont.clientHeight;
    if (W < 10 || H < 10) return;
    const activa: Record<Capa, boolean> = { division: v.refDivision, rios: v.refRios, paises: v.refPaises };
    const ocupadas = this.tapas();
    const colocadas: Colocada[] = [];
    const porNombre = new Map<string, { x: number; y: number }[]>();
    const municipiosVistos = new Set<string>();
    // Un mismo nombre no sale dos veces a la vez, aunque sea de otra clase (la ciudad y su departamento o su municipio)
    const nombresVistos = new Set<string>();
    const dentro = (c: Caja) => c.x0 >= 2 && c.y0 >= 2 && c.x1 <= W - 2 && c.y1 <= H - 2;
    const libre = (c: Caja) => dentro(c) && !ocupadas.some((o) => cruza(o, c));
    const lejosDeSuNombre = (grupo: string, x: number, y: number, minimo: number) => !(porNombre.get(grupo) ?? []).some((p) => Math.hypot(p.x - x, p.y - y) < minimo);
    const anotar = (grupo: string, x: number, y: number) => {
      const l = porNombre.get(grupo) ?? [];
      l.push({ x, y });
      porNombre.set(grupo, l);
    };
    // Con el mapa quieto ningún nombre queda a medias (el zoom inicial, 5,5, es justo donde empiezan las capitales de
    // departamento): el desvanecido es solo para la transición mientras se acerca o se aleja
    const quieto = !this.enZoom;
    const opacidad = (minZ: number, maxZ: number) =>
      quieto ? 1 : Math.max(0, Math.min(1, minZ <= m.getMinZoom() + 0.01 ? 1 : (z - minZ) / 0.35 + 0.15, maxZ >= 22 ? 1 : (maxZ - z) / 0.35 + 0.15));

    // Candidatos en orden de importancia: primero los países y las aguas grandes; los ríos entran por su prioridad
    type Turno = { prioridad: number; punto?: Punto; rio?: Rio };
    const turnos: Turno[] = [];
    for (const p of this.puntos) {
      if (!activa[p.capa]) continue;
      const maxZ = esri ? p.maxZ[0] : p.maxZ[1];
      if (z < p.minZ || z >= maxZ) continue;
      turnos.push({ prioridad: p.prioridad, punto: p });
    }
    if (activa.rios) for (const r of this.rios) if (z >= r.minZ) turnos.push({ prioridad: r.prioridad, rio: r });
    turnos.sort((a, b) => b.prioridad - a.prioridad);

    const b = m.getBounds();
    const oeste = b.getWest();
    const este = b.getEast();
    const sur = b.getSouth();
    const norte = b.getNorth();

    for (const t of turnos) {
      if (colocadas.length >= MAXIMO) break;
      if (t.punto) {
        const p = t.punto;
        if (p.lon < oeste || p.lon > este || p.lat < sur || p.lat > norte) continue;
        if (p.municipio && p.clase === "municipio" && municipiosVistos.has(p.municipio)) continue;
        const e = estiloDe(p.clase, z, p.rango);
        const texto = ingles ? p.en : p.es;
        const base = nombreBase(texto);
        if (!p.grupo && nombresVistos.has(base)) continue;
        const visible = e.mayus ? texto.toLocaleUpperCase(ingles ? "en" : "es") : texto;
        const w = this.ancho(visible, e);
        const h = e.tam * 1.2;
        const s = m.project([p.lon, p.lat]);
        if (p.grupo && !lejosDeSuNombre(p.grupo, s.x, s.y, ESPACIO_GRUPO)) continue;
        // Dónde puede ir: la ciudad a la derecha de su punto o a la izquierda; las áreas (países, departamentos, aguas,
        // municipios) en su punto o un poco más arriba o más abajo si ahí lo tapa otra cosa
        const lugar: { caja: Caja; dx: number; dy: number; lado?: "der" | "izq" } | undefined =
          p.clase === "ciudad"
            ? [
                { caja: { x0: s.x - RADIO_CIUDAD - MARGEN, y0: s.y - h / 2 - MARGEN, x1: s.x + RADIO_CIUDAD + HUECO_CIUDAD + w + MARGEN, y1: s.y + h / 2 + MARGEN }, dx: 0, dy: 0, lado: "der" as const },
                { caja: { x0: s.x - RADIO_CIUDAD - HUECO_CIUDAD - w - MARGEN, y0: s.y - h / 2 - MARGEN, x1: s.x + RADIO_CIUDAD + MARGEN, y1: s.y + h / 2 + MARGEN }, dx: 0, dy: 0, lado: "izq" as const },
              ].find((o) => libre(o.caja))
            : [0, -1, 1, -2, 2]
                .map((k) => ({ dx: 0, dy: k * h * 1.25 }))
                .map(({ dx, dy }) => ({ caja: { x0: s.x + dx - w / 2 - MARGEN, y0: s.y + dy - h / 2 - MARGEN, x1: s.x + dx + w / 2 + MARGEN, y1: s.y + dy + h / 2 + MARGEN }, dx, dy }))
                .find((o) => libre(o.caja));
        if (!lugar) continue;
        ocupadas.push(lugar.caja);
        if (p.grupo) anotar(p.grupo, s.x, s.y);
        else nombresVistos.add(base);
        if (p.municipio && p.clase === "ciudad") municipiosVistos.add(p.municipio);
        const maxZ = esri ? p.maxZ[0] : p.maxZ[1];
        colocadas.push({
          clave: lugar.lado === "izq" ? `${p.clave}:izq` : p.clave,
          clase: p.clase,
          texto: visible,
          lon: p.lon,
          lat: p.lat,
          tam: e.tam,
          angulo: 0,
          opacidad: opacidad(p.minZ, maxZ),
          rango: p.rango,
          dx: lugar.dx,
          dy: lugar.dy,
          lado: lugar.lado,
        });
      } else if (t.rio) {
        this.colocarRio(t.rio, z, ingles, W, H, { oeste, este, sur, norte }, libre, ocupadas, colocadas, lejosDeSuNombre, anotar, opacidad);
      }
    }
    this.aplicar(colocadas);
  }

  /** El nombre de un río a lo largo de su cauce: un nombre cada ESPACIO_RIO px, siguiendo la dirección del agua. */
  private colocarRio(
    r: Rio,
    z: number,
    ingles: boolean,
    W: number,
    H: number,
    vista: { oeste: number; este: number; sur: number; norte: number },
    libre: (c: Caja) => boolean,
    ocupadas: Caja[],
    colocadas: Colocada[],
    lejos: (grupo: string, x: number, y: number, minimo: number) => boolean,
    anotar: (grupo: string, x: number, y: number) => void,
    opacidad: (minZ: number, maxZ: number) => number,
  ) {
    const e = estiloDe("rio", z);
    const texto = ingles ? r.en : r.es;
    const w = this.ancho(texto, e);
    const h = e.tam * 1.2;
    r.lineas.forEach((linea, li) => {
      if (colocadas.length >= MAXIMO) return;
      const [o, s, es, n] = linea.caja;
      if (es < vista.oeste || o > vista.este || n < vista.sur || s > vista.norte) return;
      // El cauce en pantalla (también lo que queda fuera: así los nombres no saltan al mover el mapa)
      const pts = linea.puntos.map(([lon, lat]) => this.m.project([lon, lat]));
      const acum = [0];
      for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      const largo = acum[acum.length - 1];
      // Un tramo más corto que el nombre no lo lleva
      if (largo < w * 1.4) return;
      const enLargo = (d: number) => {
        let i = 1;
        while (i < acum.length - 1 && acum[i] < d) i++;
        const t = (d - acum[i - 1]) / Math.max(1e-6, acum[i] - acum[i - 1]);
        return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t, i };
      };
      const cantidad = Math.max(1, Math.floor(largo / ESPACIO_RIO));
      const paso = largo / cantidad;
      for (let j = 0; j < cantidad; j++) {
        // Si justo ahí el río da una curva cerrada, se prueba un poco antes o un poco después
        for (const corrimiento of [0, -0.25, 0.25]) {
          const d = paso * (j + 0.5 + corrimiento);
          if (d - w / 2 < 0 || d + w / 2 > largo) continue;
          const c = enLargo(d);
          if (c.x < 0 || c.y < 0 || c.x > W || c.y > H) continue;
          const a = enLargo(d - w / 2);
          const f = enLargo(d + w / 2);
          let ang = Math.atan2(f.y - a.y, f.x - a.x);
          // Que se pueda leer: nunca de cabeza
          if (ang > Math.PI / 2) ang -= Math.PI;
          if (ang < -Math.PI / 2) ang += Math.PI;
          // ¿El cauce se aparta mucho de la línea del nombre? (curva): no se pone ahí
          const dx = f.x - a.x;
          const dy = f.y - a.y;
          const l = Math.hypot(dx, dy) || 1;
          // Si el río se dobla sobre sí mismo, el nombre no cabe en ese trecho
          if (l < w * 0.75) continue;
          let desvio = 0;
          for (let i = a.i; i < f.i && i < pts.length; i++) desvio = Math.max(desvio, Math.abs((pts[i].x - a.x) * dy - (pts[i].y - a.y) * dx) / l);
          if (desvio > h * 0.8) continue;
          const cos = Math.abs(Math.cos(ang));
          const sen = Math.abs(Math.sin(ang));
          const aw = w * cos + h * sen;
          const ah = w * sen + h * cos;
          const caja = { x0: c.x - aw / 2 - MARGEN, y0: c.y - ah / 2 - MARGEN, x1: c.x + aw / 2 + MARGEN, y1: c.y + ah / 2 + MARGEN };
          if (!libre(caja) || !lejos(r.clave, c.x, c.y, ESPACIO_RIO)) continue;
          ocupadas.push(caja);
          anotar(r.clave, c.x, c.y);
          const ll = this.m.unproject([c.x, c.y]);
          colocadas.push({ clave: `${r.clave}:${li}:${j}`, clase: "rio", texto, lon: ll.lng, lat: ll.lat, tam: e.tam, angulo: (ang * 180) / Math.PI, opacidad: opacidad(r.minZ, 22), dx: 0, dy: 0 });
          break;
        }
        if (colocadas.length >= MAXIMO) return;
      }
    });
  }

  /** Crea, actualiza o quita los marcadores para que el mapa muestre exactamente lo colocado. */
  private aplicar(colocadas: Colocada[]) {
    // Los nombres de los ríos se ubican de nuevo en cada pasada (siguen el cauce a cada zoom): se reusa el marcador
    // si el lugar casi no cambió, para que no parpadee
    const claves = new Set(colocadas.map((c) => c.clave));
    for (const [k, viva] of this.vivas) {
      if (!claves.has(k)) {
        viva.mk.remove();
        this.vivas.delete(k);
      }
    }
    for (const c of colocadas) {
      let viva = this.vivas.get(c.clave);
      if (!viva) {
        const el = document.createElement("div");
        el.className = `etiqueta-ref et-${c.clase}${c.rango ? ` et-rango-${c.rango}` : ""}${c.lado === "izq" ? " et-izq" : ""}`;
        const texto = document.createElement("span");
        el.appendChild(texto);
        // Las ciudades se anclan en su punto (el nombre a un lado); lo demás, centrado en su lugar
        const ciudad = c.clase === "ciudad";
        const anchor = ciudad ? (c.lado === "izq" ? "right" : "left") : "center";
        const offset: [number, number] = ciudad ? [c.lado === "izq" ? RADIO_CIUDAD : -RADIO_CIUDAD, 0] : [c.dx, c.dy];
        const mk = new maplibregl.Marker({ element: el, anchor, offset }).setLngLat([c.lon, c.lat]).addTo(this.m);
        viva = { mk, el, texto, lon: c.lon, lat: c.lat, dx: c.dx, dy: c.dy };
        this.vivas.set(c.clave, viva);
      } else {
        if (Math.abs(viva.lon - c.lon) > 1e-9 || Math.abs(viva.lat - c.lat) > 1e-9) {
          viva.mk.setLngLat([c.lon, c.lat]);
          viva.lon = c.lon;
          viva.lat = c.lat;
        }
        if (c.clase !== "ciudad" && (Math.abs(viva.dx - c.dx) > 0.5 || Math.abs(viva.dy - c.dy) > 0.5)) {
          viva.mk.setOffset([c.dx, c.dy]);
          viva.dx = c.dx;
          viva.dy = c.dy;
        }
      }
      if (viva.texto.textContent !== c.texto) viva.texto.textContent = c.texto;
      const tam = `${c.tam.toFixed(1)}px`;
      if (viva.el.style.fontSize !== tam) viva.el.style.fontSize = tam;
      const giro = c.angulo ? `rotate(${c.angulo.toFixed(1)}deg)` : "";
      if (viva.texto.style.transform !== giro) viva.texto.style.transform = giro;
      // El desvanecido va en el texto (MapLibre usa la opacidad del marcador para lo que tapa el relieve 3D)
      const op = c.opacidad >= 0.999 ? "" : c.opacidad.toFixed(2);
      if (viva.texto.style.opacity !== op) viva.texto.style.opacity = op;
    }
  }

  destruir() {
    this.m.off("moveend", this.alMover);
    this.m.off("zoom", this.alZoom);
    this.m.off("resize", this.alMover);
    if (this.pendiente) window.clearTimeout(this.pendiente);
    for (const viva of this.vivas.values()) viva.mk.remove();
    this.vivas.clear();
  }
}

/** Área aproximada de una caja [oeste, sur, este, norte] en grados² (para ordenar de mayor a menor). */
const area = (o: number, s: number, e: number, n: number) => Math.max(0, e - o) * Math.max(0, n - s);

/** Los nombres que van en un punto, con su franja de zoom y su prioridad. */
function puntosDe(d: DatosReferencia): Punto[] {
  const p: Punto[] = [];
  for (const [n, lon, lat] of d.lugares.paises) p.push({ clave: `p:${n}`, clase: "pais", es: n, en: PAISES_EN[n] ?? n, lon, lat, minZ: 3, maxZ: [7.5, 7.5], prioridad: 100, capa: "paises" });
  AGUAS.forEach((a, i) => {
    const franja: { minZ: number; maxZ: [number, number]; prioridad: number } =
      a.tipo === "oceano" ? { minZ: 3, maxZ: [7, 7], prioridad: 96 } : a.tipo === "mar" ? { minZ: 3.5, maxZ: [7.5, 7.5], prioridad: 94 } : { minZ: 5, maxZ: [ZOOM_NOMBRES_ESRI, 9.5], prioridad: 58 };
    a.puntos.forEach(([lat, lon], k) =>
      p.push({ clave: `a:${i}:${k}`, clase: a.tipo, es: a.es, en: a.en, lon, lat, ...franja, capa: a.tipo === "lago" ? "rios" : "paises", grupo: a.puntos.length > 1 ? `a:${i}` : undefined }),
    );
  });
  // Las ciudades llegan hasta los poblados de Esri o, sin ellos, hasta los nombres de los municipios
  for (const c of CIUDADES) {
    const minZ = c.rango === 1 ? 3.6 : c.rango === 2 ? 4.7 : 5.5;
    p.push({
      clave: `c:${c.es}`,
      clase: "ciudad",
      es: c.es,
      en: c.en ?? c.es,
      lon: c.lon,
      lat: c.lat,
      minZ,
      maxZ: [ZOOM_NOMBRES_ESRI, 8.6],
      prioridad: c.rango === 1 ? 90 : c.rango === 2 ? 82 : 64,
      capa: "division",
      municipio: c.municipio ? `${c.municipio}|${c.departamento}` : undefined,
      rango: c.rango,
    });
  }
  // Departamentos: los grandes primero; con los nombres de Esri, hasta donde Esri los escribe sobre sus límites. El que
  // se llama como su capital (Arauca, Bogotá) va después de las ciudades: si la capital está a la vista, sale solo ella
  const ciudades = new Set(CIUDADES.map((c) => nombreBase(c.es)));
  [...d.lugares.departamentos]
    .sort((a, b) => area(b[3], b[4], b[5], b[6]) - area(a[3], a[4], a[5], a[6]))
    .forEach(([n, lon, lat], i) =>
      p.push({ clave: `d:${n}`, clase: "departamento", es: n, en: n, lon, lat, minZ: 5.3, maxZ: [ZOOM_NOMBRES_ESRI, 9.3], prioridad: (ciudades.has(nombreBase(n)) ? 63 : 76) - i * 0.01, capa: "division" }),
    );
  // Municipios: solo sin los nombres de Esri (Esri ya escribe sus cabeceras); los grandes primero
  d.lugares.municipios
    .map((x, i) => ({ x, i }))
    .sort((a, b) => area(b.x[4], b.x[5], b.x[6], b.x[7]) - area(a.x[4], a.x[5], a.x[6], a.x[7]))
    .forEach(({ x: [n, dep, lon, lat], i }, orden) =>
      p.push({ clave: `m:${i}`, clase: "municipio", es: n, en: n, lon, lat, minZ: 8.6, maxZ: [0, 22], prioridad: 30 - orden * 0.0001, capa: "division", municipio: `${n}|${dep}` }),
    );
  // Lagos y embalses: en su centro
  d.hidrografia.features.forEach((f, i) => {
    const nombre = (f.properties as { n?: string } | null)?.n;
    if (!nombre || !(f.properties as { lago?: number })?.lago) return;
    const anillos = f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.map((x) => x[0]) : [];
    const anillo = anillos.sort((a, b) => b.length - a.length)[0];
    if (!anillo?.length) return;
    let lon = 0;
    let lat = 0;
    for (const [x, y] of anillo) {
      lon += x;
      lat += y;
    }
    const t = AGUAS_DATOS[nombre] ?? { es: nombre, en: nombre };
    p.push({ clave: `l:${i}`, clase: "lago", es: t.es, en: t.en, lon: lon / anillo.length, lat: lat / anillo.length, minZ: 6, maxZ: [22, 22], prioridad: 45, capa: "rios" });
  });
  return p;
}

/**
 * El nombre con que se pinta un río: «Río Meta» / «Meta River», como en los mapas de siempre (así no se confunde con
 * el departamento del mismo nombre, «META»). Los canales y los que ya dicen «Río» quedan como están.
 */
function nombreRio(n: string): { es: string; en: string } {
  const propio = AGUAS_DATOS[n];
  if (/^(Río|Canal) /.test(n)) return propio ?? { es: n, en: n };
  if (propio) return { es: `Río ${propio.es}`, en: `${propio.en} River` };
  return { es: `Río ${n}`, en: `${n} River` };
}

/** Los ríos con nombre, agrupados por nombre (un río partido en varias líneas es uno solo). */
function riosDe(d: DatosReferencia): Rio[] {
  const grupos = new Map<string, Rio>();
  for (const f of d.hidrografia.features) {
    const props = (f.properties ?? {}) as { n?: string; r?: number; lago?: number };
    if (!props.n || props.lago) continue;
    const lineas = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [];
    const rango = props.r ?? 9;
    // Los ríos grandes se nombran desde más lejos
    const minZ = rango <= 3 ? 3.6 : rango <= 5 ? 4.5 : rango <= 6 ? 5 : rango <= 7 ? 5.5 : rango <= 8 ? 6 : 6.5;
    const t = nombreRio(props.n);
    const g = grupos.get(props.n) ?? { clave: `r:${props.n}`, es: t.es, en: t.en, lineas: [], minZ, prioridad: 50 - rango };
    g.minZ = Math.min(g.minZ, minZ);
    for (const l of lineas) {
      const puntos = l as [number, number][];
      if (puntos.length < 2) continue;
      let o = Infinity;
      let s = Infinity;
      let e = -Infinity;
      let n = -Infinity;
      for (const [x, y] of puntos) {
        o = Math.min(o, x);
        s = Math.min(s, y);
        e = Math.max(e, x);
        n = Math.max(n, y);
      }
      g.lineas.push({ puntos, caja: [o, s, e, n] });
    }
    grupos.set(props.n, g);
  }
  return [...grupos.values()].filter((r) => r.lineas.length);
}
