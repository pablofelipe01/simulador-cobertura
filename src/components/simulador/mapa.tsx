"use client";

// Mapa base (MapLibre, fuentes abiertas), referencias (países, departamentos, municipios, ríos), nodos arrastrables,
// capa de cobertura, rango de alcance, anillos de distancia y enlaces de la malla.
import maplibregl, { type GeoJSONSource, type ImageSource, type Map as MapaML, type Marker } from "maplibre-gl";
import { useEffect, useRef, useState, type Dispatch } from "react";

import { CONFIG, urlsTeselas } from "@/lib/config";
import type { CambioAjuste } from "@/lib/radio/ajuste";
import type { EstadoRed } from "@/lib/radio/estado-red";
import { metrosPorGrado } from "@/lib/radio/geo";
import { anchosHaz, esDireccional } from "@/lib/radio/patron";
import type { DestinoSiembra, PuntoSiembra } from "@/lib/radio/siembra";
import type { Inspeccion } from "@/lib/radio/simulacion";
import type { Antena, ResultadoSimulacion } from "@/lib/radio/tipos";

import { geojsonAlcance, geojsonAnillos, type EtiquetaAlcance } from "./capa-alcance";
import { COLORES_ANTENA, esquinas, opcionesEscala, pintarCobertura } from "./capa-cobertura";
import { colorearReferencia, crearCapasReferencia, EtiquetasReferencia, visibilidadReferencia } from "./capas-referencia";
import type { Accion, Estado, FondoMapa } from "./estado";
import { AnimadorMalla, COLOR_FLUJO, COLOR_MENSAJE, type RutaViva } from "./animacion-malla";
import { estadoNodo, htmlMarcador, htmlPieza, htmlPiezaPropuesta, RADIO_PIEZA } from "./marcador";
import { piezaDe } from "./piezas";

export type SolicitudVista =
  | { n: number; tipo: "encuadrar" }
  | { n: number; tipo: "centrar"; lat: number; lon: number; zoom?: number }
  | { n: number; tipo: "caja"; caja: [number, number, number, number] };

export type PuntoMapa = { lat: number; lon: number; x: number; y: number };

/**
 * Mensaje que se anima por la malla: ids y puntos de la ruta (lon, lat), duración de cada salto, dónde se pierde,
 * quiénes escuchan cada transmisión (la inundación de Meshtastic) y si la IA del gateway responde de vuelta.
 */
export type AnimacionMensaje = {
  n: number;
  ids: string[];
  puntos: [number, number][];
  duracionesMs: number[];
  corteEn: number | null;
  vecinos: string[][];
  respuesta: boolean;
};

/** Lo que el modo «Sembrar la malla» dibuja además de los nodos. */
export type CapaSembrar = {
  red: EstadoRed;
  propuesta: { puntos: PuntoSiembra[]; destinos: DestinoSiembra[] } | null;
  mensaje: AnimacionMensaje | null;
};

type Props = {
  estado: Estado;
  despachar: Dispatch<Accion>;
  resultado: ResultadoSimulacion | null;
  inspeccion: Inspeccion | null;
  onInspeccionar: (lat: number, lon: number) => void;
  solicitud: SolicitudVista | null;
  /** Punto marcado (búsqueda o menú contextual). */
  punto: { lat: number; lon: number } | null;
  onMenu: (p: PuntoMapa) => void;
  onListo: (m: MapaML) => void;
  /** Modo «Sembrar la malla» (null en el modo avanzado). */
  sembrar?: CapaSembrar | null;
  /** Clic con la herramienta Agregar en el modo «Sembrar»: pone la pieza elegida. */
  onPieza?: (lat: number, lon: number) => void;
  /** Clic con la herramienta «destino»: punto hacia el que se siembra la malla. */
  onDestino?: (lat: number, lon: number) => void;
  /** Propuesta del ajuste automático: antenas de apoyo, nodos que se corren y cambios de torre o antena. */
  ajuste?: CambioAjuste[] | null;
};

const VACIO: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const SOBRE = `<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="1.6" y="3.2" width="10.8" height="7.6" rx="1.2"/><path d="M1.9 3.8 L7 7.6 L12.1 3.8"/></svg>`;

const FONDOS: Record<FondoMapa, string> = {
  satelite: "fondo-satelite",
  topografico: "fondo-topografico",
  opentopomap: "fondo-opentopomap",
  calles: "fondo-calles",
};

/**
 * Acercamiento máximo del mapa (zoom de MapLibre, ≈ 0,6 m por píxel en Colombia). Más cerca, las imágenes
 * satelitales de zonas rurales no existen y el servidor devuelve cuadros grises de «Map data not yet available»;
 * además el relieve SRTM (≈ 30 m) no da más detalle para la simulación.
 */
export const ZOOM_MAXIMO = 17;
/**
 * Nivel de tesela (256 px) más alto que se le pide a cada servicio; por encima, MapLibre amplía la última imagen.
 * Esri tiene nivel 17 en toda Colombia, pero el 18 falta en zonas rurales (p. ej. Vichada) y el 19 en casi todo el campo.
 */
const ZOOM_IMAGENES = { esri: 17, opentopomap: 17, osm: 19 } as const;

function estilo(): maplibregl.StyleSpecification {
  const raster = (url: string, attribution: string, maxzoom: number): maplibregl.RasterSourceSpecification => ({
    type: "raster",
    tiles: urlsTeselas(url),
    tileSize: 256,
    maxzoom,
    attribution,
  });
  const dem: maplibregl.RasterDEMSourceSpecification = {
    type: "raster-dem",
    tiles: [CONFIG.relieve],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 14,
    attribution: CONFIG.atribucion.relieve,
  };
  return {
    version: 8,
    sources: {
      satelite: raster(CONFIG.mapas.satelite, CONFIG.atribucion.esri, ZOOM_IMAGENES.esri),
      etiquetas: raster(CONFIG.mapas.etiquetas, CONFIG.atribucion.esri, ZOOM_IMAGENES.esri),
      vias: raster(CONFIG.mapas.vias, CONFIG.atribucion.esri, ZOOM_IMAGENES.esri),
      topografico: raster(CONFIG.mapas.topografico, CONFIG.atribucion.esri, ZOOM_IMAGENES.esri),
      opentopomap: raster(CONFIG.mapas.opentopomap, CONFIG.atribucion.opentopomap, ZOOM_IMAGENES.opentopomap),
      calles: raster(CONFIG.mapas.calles, CONFIG.atribucion.osm, ZOOM_IMAGENES.osm),
      "dem-terreno": dem,
      "dem-sombra": dem,
    },
    layers: [
      { id: "fondo-color", type: "background", paint: { "background-color": "#DDE3DC" } },
      { id: "fondo-satelite", type: "raster", source: "satelite", layout: { visibility: "visible" } },
      { id: "fondo-topografico", type: "raster", source: "topografico", layout: { visibility: "none" } },
      { id: "fondo-opentopomap", type: "raster", source: "opentopomap", layout: { visibility: "none" } },
      { id: "fondo-calles", type: "raster", source: "calles", layout: { visibility: "none" } },
      { id: "sombras", type: "hillshade", source: "dem-sombra", layout: { visibility: "none" }, paint: { "hillshade-exaggeration": 0.35 } },
      { id: "capa-vias", type: "raster", source: "vias", layout: { visibility: "none" } },
    ],
  };
}

function circulo(lat: number, lon: number, radioM: number, n = 96): [number, number][] {
  const m = metrosPorGrado(lat);
  const puntos: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    puntos.push([lon + (radioM * Math.sin(a)) / m.lon, lat + (radioM * Math.cos(a)) / m.lat]);
  }
  return puntos;
}

/** Abanico (ancho del haz) y eje de apuntamiento de cada antena direccional activa. */
function geojsonHaces(antenas: Antena[], radioKm: number) {
  const features: GeoJSON.Feature[] = [];
  const largo = Math.max(800, Math.min(radioKm * 350, 4000));
  for (const a of antenas) {
    if (!a.activa || !esDireccional(a)) continue;
    const m = metrosPorGrado(a.lat);
    const punto = (rumbo: number, d: number): [number, number] => {
      const r = (rumbo * Math.PI) / 180;
      return [a.lon + (d * Math.sin(r)) / m.lon, a.lat + (d * Math.cos(r)) / m.lat];
    };
    const az = a.azimutDeg ?? 0;
    const ancho = Math.min(anchosHaz(a.patron, a.gananciaDbi).h, 150);
    const arco: [number, number][] = [];
    for (let i = 0; i <= 24; i++) arco.push(punto(az - ancho / 2 + (ancho * i) / 24, largo));
    features.push({ type: "Feature", properties: { parte: "abanico" }, geometry: { type: "Polygon", coordinates: [[[a.lon, a.lat], ...arco, [a.lon, a.lat]]] } });
    const punta = punto(az, largo * 1.18);
    features.push({
      type: "Feature",
      properties: { parte: "eje" },
      geometry: { type: "LineString", coordinates: [[a.lon, a.lat], punta, punto(az - 4, largo * 1.08), punta, punto(az + 4, largo * 1.08)] },
    });
  }
  return { type: "FeatureCollection" as const, features };
}

/** Sincroniza un conjunto de marcadores HTML de texto (etiquetas) con una lista. */
function sincronizarEtiquetas(m: MapaML, vivas: Map<string, Marker>, lista: EtiquetaAlcance[]) {
  const claves = new Set(lista.map((e) => e.clave));
  for (const [k, mk] of vivas) {
    if (!claves.has(k)) {
      mk.remove();
      vivas.delete(k);
    }
  }
  for (const e of lista) {
    const existente = vivas.get(e.clave);
    if (existente) {
      existente.setLngLat([e.lon, e.lat]);
      existente.getElement().textContent = e.texto;
      continue;
    }
    const el = document.createElement("div");
    el.className = `etiqueta-mapa ${e.clase}`;
    el.textContent = e.texto;
    vivas.set(e.clave, new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([e.lon, e.lat]).addTo(m));
  }
}

export function Mapa({ estado, despachar, resultado, inspeccion, onInspeccionar, solicitud, punto, onMenu, onListo, sembrar, onPieza, onDestino, ajuste }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaML | null>(null);
  const marcadores = useRef(new Map<string, Marker>());
  const etiquetasEnlace = useRef<Marker[]>([]);
  const etiquetasAlcance = useRef(new Map<string, Marker>());
  const etiquetasAnillos = useRef(new Map<string, Marker>());
  const referencias = useRef<EtiquetasReferencia | null>(null);
  const pin = useRef<Marker | null>(null);
  const pinPunto = useRef<Marker | null>(null);
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const propuestos = useRef<Marker[]>([]);
  const animador = useRef<AnimadorMalla | null>(null);
  const [listo, setListo] = useState(false);
  // Valores actuales para los manejadores registrados una sola vez
  const actual = useRef({ estado, onInspeccionar, despachar, onMenu, onListo, onPieza, onDestino });
  useEffect(() => {
    actual.current = { estado, onInspeccionar, despachar, onMenu, onListo, onPieza, onDestino };
  });

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!contenedor.current) return;
    const antenas = actual.current.estado.escenario.antenas;
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: estilo(),
      center: antenas.length ? [antenas[0].lon, antenas[0].lat] : [-74.08, 4.6],
      zoom: antenas.length ? 10 : 5.5,
      minZoom: 3,
      maxZoom: ZOOM_MAXIMO,
      attributionControl: false,
      maxPitch: 70,
      fadeDuration: 0,
    });
    m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: CONFIG.atribucion.division }), "bottom-right");
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-left");
    m.on("load", () => {
      crearCapasReferencia(m);
      m.addLayer({ id: "capa-etiquetas", type: "raster", source: "etiquetas", layout: { visibility: "none" } });
      for (const id of ["circulos", "anillos", "alcance", "enlaces", "haces", "propuesta", "ajuste", "ruta-mensaje"]) m.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "haces-relleno", type: "fill", source: "haces", filter: ["==", ["get", "parte"], "abanico"], paint: { "fill-color": "#FFFFFF", "fill-opacity": 0.16 } });
      m.addLayer({
        id: "haces-borde",
        type: "line",
        source: "haces",
        filter: ["==", ["get", "parte"], "abanico"],
        paint: { "line-color": "#FFFFFF", "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": 0.85 },
      });
      m.addLayer({ id: "haces-eje-halo", type: "line", source: "haces", filter: ["==", ["get", "parte"], "eje"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1E2120", "line-width": 4.5, "line-opacity": 0.4 } });
      m.addLayer({ id: "haces-eje", type: "line", source: "haces", filter: ["==", ["get", "parte"], "eje"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFFFF", "line-width": 2.2 } });
      m.addLayer({
        id: "circulos",
        type: "line",
        source: "circulos",
        paint: { "line-color": "#F4F2EE", "line-width": 1.2, "line-dasharray": [3, 3], "line-opacity": 0.85 },
      });
      m.addLayer({ id: "anillos-halo", type: "line", source: "anillos", paint: { "line-color": "#1E2120", "line-width": 3, "line-opacity": 0.25 } });
      m.addLayer({ id: "anillos", type: "line", source: "anillos", paint: { "line-color": "#FFFFFF", "line-width": 1.1, "line-dasharray": [1.5, 2.5], "line-opacity": 0.9 } });
      m.addLayer({ id: "alcance-halo", type: "line", source: "alcance", paint: { "line-color": "#1E2120", "line-width": 4.5, "line-opacity": 0.45 } });
      m.addLayer({
        id: "alcance",
        type: "line",
        source: "alcance",
        layout: { "line-join": "round" },
        paint: {
          "line-color": ["match", ["get", "clase"], "confiable", "#8BD17C", "#FFB25B"],
          "line-width": 2.2,
        },
      });
      m.addLayer({
        id: "enlaces-halo",
        type: "line",
        source: "enlaces",
        layout: { "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-opacity": 0.75, "line-width": ["case", ["get", "troncal"], 6.5, 4.5] },
      });
      for (const [clase, color, dash] of [
        ["solido", "#1E7B34", null],
        ["inestable", "#F08A2C", [2, 1.4]],
        ["sin", "#D93A2E", [0.6, 1.6]],
      ] as const) {
        m.addLayer({
          id: `enlaces-${clase}`,
          type: "line",
          source: "enlaces",
          filter: ["==", ["get", "clase"], clase],
          layout: { "line-cap": dash ? "butt" : "round" },
          paint: {
            "line-color": color,
            "line-width": ["case", ["get", "troncal"], 4, 2.4],
            ...(dash ? { "line-dasharray": [...dash] } : {}),
          },
        });
      }
      // Sembrado propuesto (cadena de repetidores) y ruta del mensaje
      m.addLayer({ id: "propuesta-halo", type: "line", source: "propuesta", layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 5, "line-opacity": 0.8 } });
      m.addLayer({ id: "propuesta", type: "line", source: "propuesta", paint: { "line-color": "#A94F1B", "line-width": 2.6, "line-dasharray": [2, 1.5] } });
      // Ajuste automático: enlaces de las antenas de apoyo y nodos que se corren a una loma
      m.addLayer({ id: "ajuste-halo", type: "line", source: "ajuste", layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 5, "line-opacity": 0.8 } });
      m.addLayer({ id: "ajuste", type: "line", source: "ajuste", paint: { "line-color": "#A94F1B", "line-width": 2.6, "line-dasharray": [2, 1.5] } });
      m.addLayer({ id: "ruta-mensaje-halo", type: "line", source: "ruta-mensaje", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.85 } });
      m.addLayer({ id: "ruta-mensaje", type: "line", source: "ruta-mensaje", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#E07A3F", "line-width": 4.5 } });
      // Flujo animado de la malla (modo «Sembrar»): por encima de los enlaces y de la ruta del mensaje
      animador.current = new AnimadorMalla(
        m,
        (id) => marcadores.current.get(id)?.getElement().querySelector<HTMLElement>(".pieza") ?? null,
        (rutas, vivo) => {
          const raiz = contenedor.current?.parentElement;
          if (raiz) {
            raiz.dataset.rutasVivas = String(rutas);
            raiz.dataset.animacion = vivo ? "si" : "no";
          }
        },
      );
      referencias.current = new EtiquetasReferencia(m);
      // Créditos plegados en un botón «i» para que no tapen la leyenda (se pliegan la primera vez que aparecen)
      const plegarCreditos = () => {
        const creditos = contenedor.current?.querySelector(".maplibregl-ctrl-attrib");
        if (!creditos?.classList.contains("maplibregl-compact")) return;
        creditos.classList.remove("maplibregl-compact-show");
        creditos.removeAttribute("open");
        m.off("sourcedata", plegarCreditos);
        m.off("styledata", plegarCreditos);
      };
      m.on("sourcedata", plegarCreditos);
      m.on("styledata", plegarCreditos);
      plegarCreditos();
      setListo(true);
      actual.current.onListo(m);
    });
    m.on("click", (e) => {
      const { estado: est, onInspeccionar: inspeccionar, despachar: d, onPieza: pieza, onDestino: destino } = actual.current;
      if (est.herramienta === "agregar" && est.modo === "sembrar" && pieza) pieza(e.lngLat.lat, e.lngLat.lng);
      else if (est.herramienta === "agregar") d({ tipo: "agregar", lat: e.lngLat.lat, lon: e.lngLat.lng });
      else if (est.herramienta === "destino") destino?.(e.lngLat.lat, e.lngLat.lng);
      else if (est.herramienta === "inspeccionar") inspeccionar(e.lngLat.lat, e.lngLat.lng);
      else if (est.herramienta === "mover") d({ tipo: "seleccionar", id: null });
    });
    m.on("contextmenu", (e) => {
      e.preventDefault();
      actual.current.onMenu({ lat: e.lngLat.lat, lon: e.lngLat.lng, x: e.point.x, y: e.point.y });
    });
    mapa.current = m;
    const marcas = marcadores.current;
    return () => {
      animador.current?.destruir();
      animador.current = null;
      referencias.current?.destruir();
      marcas.clear();
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Cursor según la herramienta
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    m.getCanvas().style.cursor = estado.herramienta === "mover" ? "" : "crosshair";
  }, [estado.herramienta]);

  // Mapa base, capas de referencia y relieve 3D
  const v = estado.vista;
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    for (const [fondo, id] of Object.entries(FONDOS)) m.setLayoutProperty(id, "visibility", fondo === v.fondo ? "visible" : "none");
    m.setLayoutProperty("capa-etiquetas", "visibility", v.refNombres ? "visible" : "none");
    m.setLayoutProperty("capa-vias", "visibility", v.refVias ? "visible" : "none");
    colorearReferencia(m, v.fondo);
    visibilidadReferencia(m, v);
    referencias.current?.aplicarVista(v);
    document.documentElement.dataset.fondoMapa = v.fondo;
  }, [v, listo]);

  // Cargar los datos de referencia apenas el mapa esté listo
  useEffect(() => {
    if (listo) void referencias.current?.cargar().catch(() => undefined);
  }, [listo]);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    if (estado.vista.relieve3d) {
      m.setTerrain({ source: "dem-terreno", exaggeration: 1.4 });
      m.setLayoutProperty("sombras", "visibility", "visible");
      if (m.getPitch() < 30) m.easeTo({ pitch: 55, duration: 700 });
    } else {
      m.setTerrain(null);
      m.setLayoutProperty("sombras", "visibility", "none");
      if (m.getPitch() > 0) m.easeTo({ pitch: 0, duration: 500 });
    }
  }, [estado.vista.relieve3d, listo]);

  // Capa de cobertura (todas o solo la del nodo seleccionado)
  const indiceSolo = estado.vista.soloSeleccionada && estado.seleccion && resultado ? resultado.antenas.findIndex((a) => a.id === estado.seleccion) : -1;
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    if (!resultado) {
      if (m.getLayer("cobertura")) m.removeLayer("cobertura");
      if (m.getSource("cobertura")) m.removeSource("cobertura");
      return;
    }
    lienzo.current ??= document.createElement("canvas");
    const imagen = pintarCobertura(resultado, estado.vista.modo, estado.vista.mostrarSinServicio, lienzo.current, indiceSolo >= 0 ? indiceSolo : undefined, opcionesEscala(estado.vista));
    const url = imagen.toDataURL("image/png");
    const coordinates = esquinas(resultado);
    const fuente = m.getSource("cobertura") as ImageSource | undefined;
    if (fuente) fuente.updateImage({ url, coordinates });
    else {
      m.addSource("cobertura", { type: "image", url, coordinates });
      m.addLayer(
        {
          id: "cobertura",
          type: "raster",
          source: "cobertura",
          paint: { "raster-opacity": estado.vista.opacidad, "raster-resampling": "nearest", "raster-fade-duration": 0 },
        },
        "ref-lagos",
      );
    }
  }, [resultado, estado.vista.modo, estado.vista.mostrarSinServicio, indiceSolo, listo, estado.vista.escala, estado.vista.escalaMinDbm, estado.vista.escalaMaxDbm, estado.vista.umbralDbm, estado.vista.colorUmbral]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo || !m.getLayer("cobertura")) return;
    m.setPaintProperty("cobertura", "raster-opacity", estado.vista.opacidad);
  }, [estado.vista.opacidad, listo, resultado]);

  // Círculos de estudio
  const antenas = estado.escenario.antenas;
  const radioKm = estado.escenario.parametros.radioKm;
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    (m.getSource("circulos") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: estado.vista.mostrarCirculos
        ? antenas
            .filter((a) => a.activa && (a.tipo ?? "antena") === "antena")
            .map((a) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: circulo(a.lat, a.lon, radioKm * 1000) } }))
        : [],
    });
  }, [antenas, radioKm, estado.vista.mostrarCirculos, listo]);

  // Dirección de las antenas direccionales
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    (m.getSource("haces") as GeoJSONSource | undefined)?.setData(estado.vista.mostrarHaces ? geojsonHaces(antenas, radioKm) : { type: "FeatureCollection", features: [] });
  }, [antenas, radioKm, estado.vista.mostrarHaces, listo]);

  const redMapa = sembrar?.red ?? null;

  // Rango de alcance (contornos) y anillos de distancia
  const seleccionada = antenas.find((a) => a.id === estado.seleccion) ?? null;
  const unicaAntena = antenas.filter((a) => a.activa && (a.tipo ?? "antena") === "antena");
  const centroAnillos = seleccionada ?? (unicaAntena.length === 1 ? unicaAntena[0] : null);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    const alcance =
      resultado && estado.vista.mostrarAlcance ? geojsonAlcance(resultado, antenas, estado.vista.soloSeleccionada ? estado.seleccion : null) : { datos: { type: "FeatureCollection" as const, features: [] }, etiquetas: [] };
    // En «Sembrar la malla» el alcance con servicio se ve como el círculo de Trama, pero siguiendo el relieve:
    // turquesa si el nodo está conectado al gateway y naranja si no alcanza la red
    if (redMapa) {
      alcance.datos.features = alcance.datos.features.filter((f) => f.properties?.clase === "servicio");
      for (const f of alcance.datos.features) f.properties = { ...f.properties, estado: redMapa.porNodo.get(String(f.properties?.id))?.estado ?? "pendiente" };
      alcance.etiquetas = alcance.etiquetas.filter((e) => e.clase === "alcance-servicio");
    }
    (m.getSource("alcance") as GeoJSONSource | undefined)?.setData(alcance.datos);
    sincronizarEtiquetas(m, etiquetasAlcance.current, alcance.etiquetas);
    const anillos =
      estado.vista.mostrarAnillos && centroAnillos ? geojsonAnillos(centroAnillos, radioKm) : { datos: { type: "FeatureCollection" as const, features: [] }, etiquetas: [] };
    (m.getSource("anillos") as GeoJSONSource | undefined)?.setData(anillos.datos);
    sincronizarEtiquetas(m, etiquetasAnillos.current, anillos.etiquetas);
  }, [resultado, antenas, estado.vista.mostrarAlcance, estado.vista.mostrarAnillos, estado.vista.soloSeleccionada, estado.seleccion, centroAnillos, radioKm, listo, redMapa]);

  // Estilo del alcance según el modo
  const modoSembrar = Boolean(sembrar);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo || !m.getLayer("alcance")) return;
    if (modoSembrar) {
      m.setPaintProperty("alcance", "line-color", ["match", ["get", "estado"], "aislado", "#FF9F43", COLOR_FLUJO]);
      m.setPaintProperty("alcance", "line-width", 2);
      m.setPaintProperty("alcance-halo", "line-color", ["match", ["get", "estado"], "aislado", "#FF9F43", COLOR_FLUJO]);
      m.setPaintProperty("alcance-halo", "line-width", 7);
      m.setPaintProperty("alcance-halo", "line-opacity", 0.22);
      m.setPaintProperty("alcance-halo", "line-blur", 4);
      // Los enlaces quedan de fondo: resalta el flujo turquesa por donde viaja la información
      for (const id of ["enlaces-solido", "enlaces-inestable", "enlaces-sin"]) m.setPaintProperty(id, "line-opacity", 0.5);
      m.setPaintProperty("enlaces-halo", "line-opacity", 0.35);
    } else {
      for (const id of ["enlaces-solido", "enlaces-inestable", "enlaces-sin"]) m.setPaintProperty(id, "line-opacity", 1);
      m.setPaintProperty("enlaces-halo", "line-opacity", 0.75);
      m.setPaintProperty("alcance", "line-color", ["match", ["get", "clase"], "confiable", "#8BD17C", "#FFB25B"]);
      m.setPaintProperty("alcance", "line-width", 2.2);
      m.setPaintProperty("alcance-halo", "line-color", "#1E2120");
      m.setPaintProperty("alcance-halo", "line-width", 4.5);
      m.setPaintProperty("alcance-halo", "line-opacity", 0.45);
      m.setPaintProperty("alcance-halo", "line-blur", 0);
    }
  }, [modoSembrar, listo]);

  // Enlaces entre nodos
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    const porId = new Map(antenas.map((a) => [a.id, a]));
    const troncales = new Set<string>();
    for (const n of resultado?.nodos ?? []) for (let i = 0; i + 1 < n.ruta.length; i++) troncales.add([n.ruta[i], n.ruta[i + 1]].sort().join("|"));
    const visibles = (resultado?.enlaces ?? []).filter(
      (e) => estado.vista.mostrarEnlaces && porId.has(e.a) && porId.has(e.b) && (e.clase !== "sin" || estado.vista.mostrarSinEnlace),
    );
    (m.getSource("enlaces") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: visibles.map((e) => {
        const a = porId.get(e.a)!;
        const b = porId.get(e.b)!;
        return {
          type: "Feature",
          properties: { clase: e.clase, troncal: troncales.has([e.a, e.b].sort().join("|")) },
          geometry: { type: "LineString", coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
        };
      }),
    });
    for (const mk of etiquetasEnlace.current) mk.remove();
    etiquetasEnlace.current = visibles.map((e) => {
      const a = porId.get(e.a)!;
      const b = porId.get(e.b)!;
      const el = document.createElement("div");
      el.className = `etiqueta-enlace enlace-${e.clase}`;
      el.textContent = `${e.margen.toFixed(0)} dB`;
      el.title = `${a.nombre} – ${b.nombre}: ${e.margen.toFixed(1).replace(".", ",")} dB a ${e.distanciaKm.toFixed(2).replace(".", ",")} km`;
      return new maplibregl.Marker({ element: el }).setLngLat([(a.lon + b.lon) / 2, (a.lat + b.lat) / 2]).addTo(m);
    });
  }, [resultado, antenas, estado.vista.mostrarEnlaces, estado.vista.mostrarSinEnlace, listo]);

  // Marcadores de nodos
  const red = redMapa;
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const vivos = marcadores.current;
    const nodos = new Map((resultado?.nodos ?? []).map((n) => [n.id, n]));
    const indices = new Map((resultado?.antenas ?? []).map((a, i) => [a.id, i]));
    const ids = new Set(antenas.map((a) => a.id));
    for (const [id, mk] of vivos) {
      if (!ids.has(id)) {
        mk.remove();
        vivos.delete(id);
      }
    }
    antenas.forEach((a: Antena) => {
      const indice = indices.get(a.id);
      const color = estado.vista.modo === "servidor" && indice !== undefined ? COLORES_ANTENA[indice % COLORES_ANTENA.length] : undefined;
      const info = red?.porNodo.get(a.id);
      const marca = red ? { pieza: piezaDe(a), estado: info?.estado ?? (a.pasarela ? "gateway" : "pendiente"), saltos: info?.saltos ?? null } as const : undefined;
      // En «Sembrar la malla», piezas redondas centradas en el punto; en el modo avanzado, la torre de siempre
      const html = marca ? htmlPieza(a, estado.seleccion === a.id, marca, true) : htmlMarcador(a, estado.seleccion === a.id, estadoNodo(a, nodos.get(a.id)), color);
      let mk = vivos.get(a.id);
      if (!mk) {
        const el = document.createElement("div");
        el.className = "marcador-raiz";
        el.dataset.antena = a.id;
        el.addEventListener("click", (ev) => {
          if (actual.current.estado.herramienta === "regla") return;
          ev.stopPropagation();
          // «×» de la pieza seleccionada: la quita
          if ((ev.target as HTMLElement).closest("[data-quitar]")) {
            actual.current.despachar({ tipo: "eliminar", id: a.id });
            return;
          }
          actual.current.despachar({ tipo: "seleccionar", id: a.id });
        });
        mk = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true }).setLngLat([a.lon, a.lat]).addTo(m);
        mk.on("dragend", () => {
          const p = mk!.getLngLat();
          actual.current.despachar({ tipo: "editar", id: a.id, cambios: { lat: Number(p.lat.toFixed(6)), lon: Number(p.lng.toFixed(6)) } });
        });
        vivos.set(a.id, mk);
      }
      const el = mk.getElement();
      if (el.dataset.html !== html) {
        el.innerHTML = html;
        el.dataset.html = html;
      }
      el.style.zIndex = estado.seleccion === a.id ? "5" : "1";
      mk.setOffset(marca ? [0, RADIO_PIEZA] : [0, 0]);
      el.setAttribute("aria-label", red ? `${{ gateway: "Gateway", repetidor: "Repetidor", persona: "Persona" }[piezaDe(a)]} ${a.nombre}` : `${(a.tipo ?? "antena") === "nodo" ? "Nodo" : "Nodo antena"} ${a.nombre}`);
      const p = mk.getLngLat();
      if (Math.abs(p.lat - a.lat) > 1e-7 || Math.abs(p.lng - a.lon) > 1e-7) mk.setLngLat([a.lon, a.lat]);
    });
  }, [antenas, estado.seleccion, resultado, estado.vista.modo, red]);

  // Repetidores propuestos por el sembrado automático: torres fantasma y la cadena hasta cada destino
  const propuesta = sembrar?.propuesta ?? null;
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    for (const mk of propuestos.current) mk.remove();
    propuestos.current = [];
    const fuente = m.getSource("propuesta") as GeoJSONSource | undefined;
    if (!propuesta) {
      fuente?.setData(VACIO);
      return;
    }
    const posicion = new Map<string, [number, number]>(antenas.map((a) => [a.id, [a.lon, a.lat]]));
    for (const q of propuesta.puntos) posicion.set(q.id, [q.lon, q.lat]);
    const features: GeoJSON.Feature[] = [];
    for (const q of propuesta.puntos) {
      const desde = posicion.get(q.desdeId);
      if (desde) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [desde, [q.lon, q.lat]] } });
      const el = document.createElement("div");
      el.className = "marcador-raiz";
      el.innerHTML = htmlPiezaPropuesta(q.id.replace("propuesto-", "Propuesto "), q.margenDb);
      propuestos.current.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([q.lon, q.lat]).addTo(m));
    }
    for (const d of propuesta.destinos) {
      if (!d.antena) {
        const el = document.createElement("div");
        el.className = "destino-siembra";
        el.title = d.nombre ?? "Destino";
        propuestos.current.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([d.lon, d.lat]).addTo(m));
      }
    }
    fuente?.setData({ type: "FeatureCollection", features });
  }, [propuesta, antenas, listo]);

  // Propuesta del ajuste automático: apoyos como torres punteadas, flecha a la loma y etiquetas de cada cambio
  const ajustados = useRef<Marker[]>([]);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    for (const mk of ajustados.current) mk.remove();
    ajustados.current = [];
    const fuente = m.getSource("ajuste") as GeoJSONSource | undefined;
    if (!ajuste?.length) {
      fuente?.setData(VACIO);
      return;
    }
    const porNombre = new Map<string, [number, number]>(antenas.map((a) => [a.nombre, [a.lon, a.lat]]));
    const porId = new Map(antenas.map((a) => [a.id, a]));
    for (const c of ajuste) if (c.tipo === "apoyo") porNombre.set(c.nombre, [c.lon, c.lat]);
    for (const c of ajuste) if (c.tipo === "mover") porNombre.set(c.nombre, [c.lon, c.lat]);
    const features: GeoJSON.Feature[] = [];
    const etiquetas = new Map<string, string[]>();
    const etiquetar = (id: string, t: string) => etiquetas.set(id, [...(etiquetas.get(id) ?? []), t]);
    const poner = (el: HTMLElement, lngLat: [number, number], anchor: "center" | "bottom" = "center", offset: [number, number] = [0, 0]) =>
      ajustados.current.push(new maplibregl.Marker({ element: el, anchor, offset }).setLngLat(lngLat).addTo(m));
    for (const c of ajuste) {
      if (c.tipo === "apoyo") {
        const desde = c.enlazaCon ? porNombre.get(c.enlazaCon) : undefined;
        if (desde) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [desde, [c.lon, c.lat]] } });
        const el = document.createElement("div");
        el.className = "marcador-raiz";
        el.innerHTML = htmlPiezaPropuesta(`${c.nombre} · ${c.alturaM} m`, c.enlaceDb ?? 0);
        poner(el, [c.lon, c.lat]);
      } else if (c.tipo === "mover") {
        const a = porId.get(c.id);
        if (a) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[a.lon, a.lat], [c.lon, c.lat]] } });
        const el = document.createElement("div");
        el.className = "marcador-raiz";
        el.innerHTML = htmlPiezaPropuesta(`${c.nombre} (nuevo sitio)`, 0);
        poner(el, [c.lon, c.lat]);
      } else if (c.tipo === "altura") etiquetar(c.id, `${c.aM > c.deM ? "↑" : "↓"} ${c.aM} m`);
      else if (c.tipo === "antena") etiquetar(c.id, c.patron === "omni" ? "omni" : `${c.patron === "sectorial-90" ? "sector 90°" : c.patron === "sectorial-120" ? "sector 120°" : c.patron} → ${Math.round(c.azimutDeg)}°`);
      else if (c.tipo === "quitar") etiquetar(c.id, "quitar");
    }
    for (const [id, textos] of etiquetas) {
      const a = porId.get(id);
      if (!a) continue;
      const movido = ajuste.find((c): c is Extract<CambioAjuste, { tipo: "mover" }> => c.tipo === "mover" && c.id === id);
      const el = document.createElement("div");
      el.className = "ajuste-etiqueta";
      el.textContent = textos.join(" · ");
      poner(el, movido ? [movido.lon, movido.lat] : [a.lon, a.lat], "bottom", [0, -24]);
    }
    fuente?.setData({ type: "FeatureCollection", features });
  }, [ajuste, antenas, listo]);

  // Flujo vivo de la malla: rutas de la gente conectada hasta el gateway (y de los repetidores, para la troncal)
  const animarRed = estado.vista.animarRed;
  useEffect(() => {
    const anim = animador.current;
    if (!anim || !listo) return;
    if (!redMapa || !redMapa.alDia || !resultado) {
      anim.configurar({ tramos: [], rutas: [], gateways: [], animar: false, visible: false });
      return;
    }
    const pos = new Map(antenas.map((a) => [a.id, [a.lon, a.lat] as [number, number]]));
    const nodos = new Map(resultado.nodos.map((n) => [n.id, n]));
    const conectado = (id: string) => redMapa.porNodo.get(id)?.estado === "conectado";
    const rutaDe = (id: string): RutaViva | null => {
      const ids = nodos.get(id)?.ruta ?? [];
      const puntos = ids.map((x) => pos.get(x));
      return ids.length > 1 && puntos.every(Boolean) ? { ids, puntos: puntos as [number, number][] } : null;
    };
    const personas = redMapa.personas.filter((a) => conectado(a.id)).map((a) => rutaDe(a.id)).filter((r): r is RutaViva => r !== null);
    const repetidores = redMapa.repetidores.filter((a) => conectado(a.id)).map((a) => rutaDe(a.id)).filter((r): r is RutaViva => r !== null);
    // Cada tramo una vez, del nodo hacia el gateway (las líneas avanzan en ese sentido)
    const vistos = new Set<string>();
    const tramos: [number, number][][] = [];
    for (const r of [...personas, ...repetidores]) {
      for (let i = 0; i + 1 < r.ids.length; i++) {
        const clave = [r.ids[i], r.ids[i + 1]].sort().join("|");
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        tramos.push([r.puntos[i], r.puntos[i + 1]]);
      }
    }
    anim.configurar({ tramos, rutas: personas.length ? personas : repetidores, gateways: redMapa.gateways.map((g) => g.id), animar: animarRed, visible: true });
  }, [redMapa, resultado, antenas, animarRed, listo]);

  const mensaje = sembrar?.mensaje ?? null;

  // Mensaje de «Enviar un mensaje»: salta de nodo en nodo (cada salto dura su tiempo real, dentro de lo legible).
  // En cada transmisión se abre una onda y destellan los vecinos que lo escuchan (Meshtastic inunda la red); el
  // que sigue en la ruta lo retransmite. Al llegar, la IA del gateway «piensa» y la respuesta vuelve por la ruta.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    const fuente = m.getSource("ruta-mensaje") as GeoJSONSource | undefined;
    if (!mensaje || mensaje.puntos.length < 2) {
      fuente?.setData(VACIO);
      return;
    }
    const anim = animador.current;
    const { puntos, duracionesMs, corteEn, ids, vecinos } = mensaje;
    const hasta = corteEn === null ? puntos.length - 1 : corteEn + 1;
    fuente?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: puntos.slice(0, hasta + 1) } });
    const el = document.createElement("div");
    el.className = "paquete-mensaje";
    el.innerHTML = SOBRE;
    const paquete = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(puntos[0]).addTo(m);
    const tiempos: number[] = [];
    if (anim) anim.pausado = true;
    const transmite = (k: number, color: string) => {
      const [lon, lat] = puntos[k];
      anim?.onda(lon, lat, color, 58, 1200);
      if (k > 0) anim?.destello(ids[k], "transmite");
      for (const v of vecinos[k] ?? []) if (v !== ids[k + 1]) anim?.destello(v, "oye", 700);
    };
    // Ida (hacia el gateway) y, si llega, la respuesta de la IA de vuelta
    let tramo: { de: number; a: number; t0: number }[] = [];
    let k = 0;
    let vuelta = false;
    let inicio = performance.now();
    let cuadro = 0;
    const suave = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    tramo = [{ de: 0, a: 1, t0: inicio }];
    transmite(0, COLOR_MENSAJE);
    const avanzar = (ahora: number) => {
      const actualTramo = tramo[0];
      const salto = vuelta ? actualTramo.a : actualTramo.de; // índice del tramo en duracionesMs
      const d = duracionesMs[Math.min(salto, duracionesMs.length - 1)] ?? 900;
      const f = Math.min(1, (ahora - inicio) / d);
      const [a, b] = [puntos[actualTramo.de], puntos[actualTramo.a]];
      // Si este salto no tiene enlace, el paquete se pierde a mitad de camino
      const tope = !vuelta && corteEn === k ? 0.55 : 1;
      const t = suave(Math.min(f, tope));
      paquete.setLngLat([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      if (f >= tope && tope < 1) {
        el.classList.add("perdido");
        el.innerHTML = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"/></svg>`;
        if (anim) anim.pausado = false;
        return;
      }
      if (f >= 1) {
        inicio = ahora;
        if (!vuelta) {
          k++;
          if (k >= puntos.length - 1) {
            // En el gateway: la IA lo recibe, «piensa» y responde por la misma ruta
            const [lon, lat] = puntos[k];
            anim?.onda(lon, lat, COLOR_FLUJO, 60, 1300);
            if (!mensaje.respuesta) {
              el.classList.add("entregado");
              el.innerHTML = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.4 L6 10.2 L11.2 4"/></svg>`;
              if (anim) anim.pausado = false;
              return;
            }
            anim?.destello(ids[k], "piensa", 1800);
            el.style.opacity = "0";
            tiempos.push(
              window.setTimeout(() => {
                vuelta = true;
                el.style.opacity = "";
                el.classList.add("respuesta");
                el.innerHTML = "<b>IA</b>";
                k = puntos.length - 1;
                tramo = [{ de: k, a: k - 1, t0: performance.now() }];
                inicio = performance.now();
                transmite(k, COLOR_FLUJO);
                cuadro = requestAnimationFrame(avanzar);
              }, 1500),
            );
            return;
          }
          transmite(k, COLOR_MENSAJE);
          tramo = [{ de: k, a: k + 1, t0: ahora }];
        } else {
          k--;
          if (k <= 0) {
            // La respuesta llegó a quien preguntó
            anim?.onda(puntos[0][0], puntos[0][1], COLOR_FLUJO, 46, 1100);
            anim?.destello(ids[0], "transmite", 900);
            el.classList.add("entregado");
            el.innerHTML = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.4 L6 10.2 L11.2 4"/></svg>`;
            if (anim) anim.pausado = false;
            return;
          }
          const [lon, lat] = puntos[k];
          anim?.onda(lon, lat, COLOR_FLUJO, 46, 1000);
          anim?.destello(ids[k], "transmite");
          tramo = [{ de: k, a: k - 1, t0: ahora }];
        }
      }
      cuadro = requestAnimationFrame(avanzar);
    };
    cuadro = requestAnimationFrame(avanzar);
    return () => {
      cancelAnimationFrame(cuadro);
      for (const t of tiempos) window.clearTimeout(t);
      paquete.remove();
      if (anim) anim.pausado = false;
    };
  }, [mensaje, listo]);

  // Punto inspeccionado y punto marcado (búsqueda / menú contextual)
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    pin.current?.remove();
    pin.current = null;
    if (!inspeccion) return;
    const el = document.createElement("div");
    el.className = "pin-inspeccion";
    pin.current = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([inspeccion.lon, inspeccion.lat]).addTo(m);
  }, [inspeccion]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    pinPunto.current?.remove();
    pinPunto.current = null;
    if (!punto) return;
    const el = document.createElement("div");
    el.className = "pin-punto";
    pinPunto.current = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([punto.lon, punto.lat]).addTo(m);
  }, [punto]);

  // Encuadrar o centrar a pedido de la interfaz
  useEffect(() => {
    const m = mapa.current;
    if (!m || !solicitud) return;
    if (solicitud.tipo === "centrar") {
      m.easeTo({ center: [solicitud.lon, solicitud.lat], zoom: solicitud.zoom ?? Math.max(m.getZoom(), 12), duration: 700 });
      return;
    }
    if (solicitud.tipo === "caja") {
      const [o, s, e, n] = solicitud.caja;
      m.fitBounds([o, s, e, n], { padding: 60, duration: 800, maxZoom: 13 });
      return;
    }
    const activas = actual.current.estado.escenario.antenas;
    if (activas.length === 0) return;
    const r = actual.current.estado.escenario.parametros.radioKm * 1000 * 0.75;
    const caja = new maplibregl.LngLatBounds();
    for (const a of activas) {
      const g = metrosPorGrado(a.lat);
      caja.extend([a.lon - r / g.lon, a.lat - r / g.lat]);
      caja.extend([a.lon + r / g.lon, a.lat + r / g.lat]);
    }
    m.fitBounds(caja, { padding: 48, duration: 700, maxZoom: 14 });
  }, [solicitud]);

  // El contenedor de MapLibre recibe «position: relative» de su hoja de estilos: se envuelve para ocupar todo el espacio.
  return (
    <div className="absolute inset-0" data-tour="mapa">
      <div ref={contenedor} className="h-full w-full" />
    </div>
  );
}
