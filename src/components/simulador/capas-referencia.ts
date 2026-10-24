// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Capas de referencia: países, departamentos, municipios, ríos y lagos (datos locales) con nombres.
// Los nombres se dibujan como marcadores HTML (no requieren tipografías de un servidor externo).
import maplibregl, { type GeoJSONSource, type Map as MapaML, type Marker } from "maplibre-gl";

import { cargarReferencia, type DatosReferencia } from "@/lib/geo/referencia";

import type { FondoMapa, Vista } from "./estado";

const VACIO = { type: "FeatureCollection" as const, features: [] };

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

type Etiqueta = { clave: string; texto: string; lon: number; lat: number; clase: string; minZ: number; maxZ: number; capa: "division" | "rios" | "paises"; prioridad: number };

/** Gestor de nombres: crea solo los que caen en pantalla y corresponden al zoom actual. */
export class EtiquetasReferencia {
  private datos: DatosReferencia | null = null;
  private todas: Etiqueta[] = [];
  private vivas = new Map<string, Marker>();
  private vista: Vista | null = null;
  private alMover = () => this.actualizar();

  constructor(private m: MapaML) {
    m.on("moveend", this.alMover);
  }

  async cargar() {
    const d = await cargarReferencia();
    this.datos = d;
    (this.m.getSource("ref-departamentos") as GeoJSONSource | undefined)?.setData(d.departamentos);
    (this.m.getSource("ref-municipios") as GeoJSONSource | undefined)?.setData(d.municipios);
    (this.m.getSource("ref-hidrografia") as GeoJSONSource | undefined)?.setData(d.hidrografia);
    (this.m.getSource("ref-paises") as GeoJSONSource | undefined)?.setData(d.paises);
    const et: Etiqueta[] = [];
    for (const [n, lon, lat] of d.lugares.paises) et.push({ clave: `p:${n}`, texto: n, lon, lat, clase: "et-pais", minZ: 3, maxZ: 7.5, capa: "paises", prioridad: 3 });
    for (const [n, lon, lat] of d.lugares.departamentos) et.push({ clave: `d:${n}`, texto: n, lon, lat, clase: "et-departamento", minZ: 5.3, maxZ: 9.3, capa: "division", prioridad: 2 });
    d.lugares.municipios.forEach(([n, , lon, lat], i) =>
      et.push({ clave: `m:${i}`, texto: n, lon, lat, clase: "et-municipio", minZ: 8.6, maxZ: 22, capa: "division", prioridad: 1 }),
    );
    // Ríos: hasta tres nombres por río, repartidos a lo largo de su trazado
    d.hidrografia.features.forEach((f, i) => {
      const nombre = (f.properties as { n?: string } | null)?.n;
      if (!nombre || f.geometry.type === "Point") return;
      const lineas =
        f.geometry.type === "LineString"
          ? [f.geometry.coordinates]
          : f.geometry.type === "MultiLineString"
            ? f.geometry.coordinates
            : f.geometry.type === "Polygon"
              ? [f.geometry.coordinates[0]]
              : f.geometry.type === "MultiPolygon"
                ? f.geometry.coordinates.map((p) => p[0])
                : [];
      const larga = lineas.sort((a, b) => b.length - a.length)[0];
      if (!larga?.length) return;
      const lago = Boolean((f.properties as { lago?: number })?.lago);
      const posiciones = lago ? [0.5] : larga.length > 60 ? [0.2, 0.5, 0.8] : [0.5];
      posiciones.forEach((t, k) => {
        const [lon, lat] = larga[Math.floor(t * (larga.length - 1))];
        et.push({ clave: `r:${i}:${k}`, texto: nombre, lon, lat, clase: "et-rio", minZ: lago ? 6 : 5, maxZ: 22, capa: "rios", prioridad: 2 });
      });
    });
    this.todas = et;
    this.actualizar();
    return d;
  }

  aplicarVista(v: Vista) {
    this.vista = v;
    this.actualizar();
  }

  actualizar() {
    if (!this.datos || !this.vista) return;
    const z = this.m.getZoom();
    const b = this.m.getBounds();
    const v = this.vista;
    const activa = { division: v.refDivision, rios: v.refRios, paises: v.refPaises };
    const visibles = this.todas
      .filter((e) => activa[e.capa] && z >= e.minZ && z < e.maxZ && b.contains([e.lon, e.lat]))
      .sort((a, c) => c.prioridad - a.prioridad)
      .slice(0, 260);
    const claves = new Set(visibles.map((e) => e.clave));
    for (const [k, mk] of this.vivas) {
      if (!claves.has(k)) {
        mk.remove();
        this.vivas.delete(k);
      }
    }
    for (const e of visibles) {
      if (this.vivas.has(e.clave)) continue;
      const el = document.createElement("div");
      el.className = `etiqueta-ref ${e.clase}`;
      el.textContent = e.texto;
      this.vivas.set(e.clave, new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([e.lon, e.lat]).addTo(this.m));
    }
  }

  destruir() {
    this.m.off("moveend", this.alMover);
    for (const mk of this.vivas.values()) mk.remove();
    this.vivas.clear();
  }
}
