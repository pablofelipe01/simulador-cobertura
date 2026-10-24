// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Animación de la malla en el modo «Sembrar la malla»: la información fluye por las rutas hacia el gateway
// (líneas turquesa que avanzan), pulsos que salen de la gente y saltan de nodo en nodo, ondas cuando un nodo
// transmite y destellos en las piezas que retransmiten. Así se ve cómo trabaja una red mesh: cada mensaje lo
// repiten los nodos del camino, normalmente el repetidor más cercano con buen enlace, hasta el gateway y su IA.
import type { GeoJSONSource, Map as MapaML } from "maplibre-gl";

export const COLOR_FLUJO = "#3EE6C8";
export const COLOR_MENSAJE = "#E07A3F";

/** Ruta viva: ids desde un nodo hasta el gateway y sus posiciones [lon, lat]. */
export type RutaViva = { ids: string[]; puntos: [number, number][] };

type Pulso = { ruta: RutaViva; salto: number; t0: number };
type Onda = { lon: number; lat: number; t0: number; dur: number; max: number; color: string };

/** Secuencia de guiones que avanzan (técnica «ant path» de MapLibre). */
const GUIONES: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

const VACIO: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const DURACION_SALTO_MS = 950;
const CADA_PULSO_MS = 1250;
const MAX_PULSOS = 7;

const movimientoReducido = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const suave = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class AnimadorMalla {
  private cuadro = 0;
  private vivo = false;
  private rutas: RutaViva[] = [];
  private gateways = new Set<string>();
  private pulsos: Pulso[] = [];
  private ondas: Onda[] = [];
  private proximoPulso = 0;
  private indice = 0;
  private ultimoGuion = 0;
  private paso = 0;
  private hayOndas = false;
  private hayPulsos = false;
  /** Mientras viaja un mensaje de «Enviar un mensaje» no salen pulsos nuevos. */
  pausado = false;

  constructor(
    private m: MapaML,
    /** Elemento `.pieza` de un nodo (para los destellos). */
    private pieza: (id: string) => HTMLElement | null,
    /** Avisa cuántas rutas se animan (para las pruebas y la accesibilidad). */
    private alCambiar?: (rutas: number, vivo: boolean) => void,
  ) {
    for (const id of ["flujo", "pulsos", "ondas"]) if (!m.getSource(id)) m.addSource(id, { type: "geojson", data: VACIO });
    m.addLayer({ id: "flujo-brillo", type: "line", source: "flujo", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": COLOR_FLUJO, "line-width": 11, "line-blur": 6, "line-opacity": 0.5 } });
    m.addLayer({ id: "flujo-base", type: "line", source: "flujo", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0F1F1C", "line-width": 4.6, "line-opacity": 0.55 } });
    m.addLayer({ id: "flujo-trazo", type: "line", source: "flujo", layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": COLOR_FLUJO, "line-width": 3, "line-dasharray": GUIONES[0] } });
    m.addLayer({
      id: "ondas",
      type: "circle",
      source: "ondas",
      paint: {
        "circle-radius": ["get", "r"],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2.2,
        "circle-stroke-color": ["get", "c"],
        "circle-stroke-opacity": ["get", "o"],
        "circle-pitch-alignment": "map",
      },
    });
    m.addLayer({ id: "pulsos-brillo", type: "circle", source: "pulsos", paint: { "circle-radius": 11, "circle-color": COLOR_FLUJO, "circle-blur": 0.9, "circle-opacity": 0.75 } });
    m.addLayer({ id: "pulsos-nucleo", type: "circle", source: "pulsos", paint: { "circle-radius": 3.6, "circle-color": "#FFFFFF", "circle-stroke-width": 1.2, "circle-stroke-color": COLOR_FLUJO } });
  }

  /** Rutas y tramos que se animan; `animar` = falso deja el flujo quieto (y sin pulsos). */
  configurar(o: { tramos: [number, number][][]; rutas: RutaViva[]; gateways: string[]; animar: boolean; visible: boolean }) {
    const fuente = this.m.getSource("flujo") as GeoJSONSource | undefined;
    fuente?.setData(o.visible ? { type: "FeatureCollection", features: o.tramos.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })) } : VACIO);
    this.rutas = o.visible ? o.rutas.filter((r) => r.puntos.length > 1) : [];
    this.gateways = new Set(o.gateways);
    this.vivo = o.visible && o.animar && !movimientoReducido();
    if (!this.vivo) {
      this.pulsos = [];
      (this.m.getSource("pulsos") as GeoJSONSource | undefined)?.setData(VACIO);
      if (this.m.getLayer("flujo-trazo")) this.m.setPaintProperty("flujo-trazo", "line-dasharray", [3, 2]);
    }
    this.alCambiar?.(this.rutas.length, this.vivo);
    this.asegurarBucle();
  }

  /** Onda que se abre desde un punto (un nodo que transmite). */
  onda(lon: number, lat: number, color = COLOR_FLUJO, max = 46, dur = 1100) {
    if (movimientoReducido()) return;
    this.ondas.push({ lon, lat, t0: performance.now(), dur, max, color });
    this.asegurarBucle();
  }

  /** Destello en una pieza: «transmite» (retransmite), «oye» (escuchó) o «piensa» (la IA del gateway). */
  destello(id: string, clase: "transmite" | "oye" | "piensa", ms = 800) {
    const p = this.pieza(id);
    if (!p) return;
    const el = clase === "piensa" ? p.querySelector<HTMLElement>(".pieza-ia") : p;
    if (!el) return;
    el.classList.remove(clase);
    void el.offsetWidth; // reinicia la animación
    el.classList.add(clase);
    window.setTimeout(() => el.classList.remove(clase), ms);
  }

  private asegurarBucle() {
    if (!this.cuadro && (this.vivo || this.ondas.length || this.pulsos.length)) this.cuadro = requestAnimationFrame(this.bucle);
  }

  private bucle = (ahora: number) => {
    this.cuadro = 0;
    // Líneas que avanzan hacia el gateway
    if (this.vivo && ahora - this.ultimoGuion > 70 && this.m.getLayer("flujo-trazo")) {
      this.ultimoGuion = ahora;
      this.paso = (this.paso + 1) % GUIONES.length;
      this.m.setPaintProperty("flujo-trazo", "line-dasharray", GUIONES[this.paso]);
    }
    // Pulsos: salen de la gente, saltan de nodo en nodo y destellan en cada uno
    if (this.vivo && !this.pausado && this.rutas.length && ahora >= this.proximoPulso && this.pulsos.length < MAX_PULSOS) {
      const ruta = this.rutas[this.indice++ % this.rutas.length];
      this.pulsos.push({ ruta, salto: 0, t0: ahora });
      this.proximoPulso = ahora + CADA_PULSO_MS;
      this.onda(ruta.puntos[0][0], ruta.puntos[0][1], COLOR_FLUJO, 30, 900);
    }
    const puntos: GeoJSON.Feature[] = [];
    this.pulsos = this.pulsos.filter((p) => {
      let f = (ahora - p.t0) / DURACION_SALTO_MS;
      while (f >= 1) {
        // Llegó al siguiente nodo: lo retransmite (o lo recibe el gateway y su IA)
        p.salto++;
        p.t0 += DURACION_SALTO_MS;
        f -= 1;
        const id = p.ruta.ids[p.salto];
        const [lon, lat] = p.ruta.puntos[p.salto];
        if (this.gateways.has(id)) {
          this.destello(id, "piensa", 1700);
          this.onda(lon, lat, COLOR_FLUJO, 40, 1000);
        } else {
          this.destello(id, "transmite");
          this.onda(lon, lat, COLOR_FLUJO, 34, 900);
        }
        if (p.salto >= p.ruta.puntos.length - 1) return false;
      }
      const a = p.ruta.puntos[p.salto];
      const b = p.ruta.puntos[p.salto + 1];
      const t = suave(f);
      puntos.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] } });
      return true;
    });
    if (puntos.length || this.hayPulsos) (this.m.getSource("pulsos") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: puntos });
    this.hayPulsos = puntos.length > 0;
    // Ondas que se abren y se apagan
    const ondas: GeoJSON.Feature[] = [];
    this.ondas = this.ondas.filter((o) => {
      const f = (ahora - o.t0) / o.dur;
      if (f >= 1) return false;
      ondas.push({ type: "Feature", properties: { r: 6 + (o.max - 6) * Math.sqrt(f), o: 0.9 * (1 - f), c: o.color }, geometry: { type: "Point", coordinates: [o.lon, o.lat] } });
      return true;
    });
    if (ondas.length || this.hayOndas) (this.m.getSource("ondas") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: ondas });
    this.hayOndas = ondas.length > 0;
    this.asegurarBucle();
  };

  destruir() {
    cancelAnimationFrame(this.cuadro);
    this.cuadro = 0;
    this.vivo = false;
  }
}
