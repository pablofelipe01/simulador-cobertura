// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// v17.2 · Lápiz de malla: se dibuja a mano alzada sobre el mapa, como con el lápiz de Paint, y Melki arma ahí la malla
// óptima, el equilibrio entre la estabilidad de la señal y el costo (señal media o mejor en el 95 % de lo dibujado,
// enlaces sólidos y sin repetidores de más). Una figura cerrada es una zona; un trazo abierto, una franja del ancho
// elegido a lo largo de la línea. Mientras el lápiz está armado el mapa no se arrastra (se dibuja): una capa
// transparente encima del mapa recibe el trazo; la rueda del ratón sigue acercando y alejando, y en el celular el mapa
// se mueve con dos dedos.
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapaML } from "maplibre-gl";
import { useEffect, useRef, useState, type Dispatch } from "react";

import { disenoDibujado, textoArea } from "@/components/melki/ordenes";
import { numeroLocal, tx } from "@/lib/idioma";
import { distanciaM, formatoDistancia } from "@/lib/radio/geo";
import { leerTrazo } from "@/lib/radio/trazo";
import { useIdioma } from "@/lib/use-idioma";

import type { Accion, Estado } from "./estado";

const VACIO: FeatureCollection = { type: "FeatureCollection", features: [] };
/** El naranja de Melki. */
const COLOR = "#e07a3f";
/** Separación mínima entre puntos del trazo y largo mínimo de un dibujo (píxeles de pantalla). */
const PASO_PX = 3;
const MINIMO_PX = 18;
/** Hasta cuántos píxeles entre el final y el comienzo la figura cuenta como cerrada. */
const CIERRE_PX = 28;
/** El pulso de la mano que se quita del dibujo (píxeles). */
const PULSO_PX = 1.2;
/** Área mínima que vale la pena diseñar: media hectárea (como los diseños por tamaño). */
const AREA_MINIMA_M2 = 5000;

/** Cursor con la forma del lápiz (la punta abajo a la izquierda marca el punto). */
const CURSOR = (() => {
  const trazo = "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${trazo}" stroke="#ffffff" stroke-width="4"/><path d="${trazo}" fill="${COLOR}" stroke="#2b2f2e" stroke-width="1.6"/><path d="m15 5 4 4" stroke="#2b2f2e" stroke-width="1.6"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 23, crosshair`;
})();

type Props = { mapa: MapaML | null; estado: Estado; despachar: Dispatch<Accion> };

export function Lapiz({ mapa, estado, despachar }: Props) {
  useIdioma();
  const activo = estado.herramienta === "lapiz";
  const [aviso, setAviso] = useState<string | null>(null);
  const actual = useRef({ ancho: estado.lapizAnchoM, despachar });
  useEffect(() => {
    actual.current = { ancho: estado.lapizAnchoM, despachar };
  });

  // El aviso se va solo
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (!mapa || !activo) return;
    const crear = () => {
      if (mapa.getSource("lapiz-trazo")) return;
      mapa.addSource("lapiz-trazo", { type: "geojson", data: VACIO });
      mapa.addLayer({ id: "lapiz-halo", type: "line", source: "lapiz-trazo", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 } });
      mapa.addLayer({ id: "lapiz-linea", type: "line", source: "lapiz-trazo", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": COLOR, "line-width": 3.4 } });
    };
    const fuente = () => {
      try {
        crear();
        return mapa.getSource("lapiz-trazo") as GeoJSONSource | undefined;
      } catch {
        // El estilo todavía no terminó de cargar: el trazo se ve en cuanto cargue
        return undefined;
      }
    };
    fuente();

    // La capa que recibe el dibujo, encima del mapa y de los marcadores (los controles y paneles quedan por fuera)
    const capa = document.createElement("div");
    capa.className = "lapiz-capa";
    capa.dataset.lapiz = "";
    capa.setAttribute("aria-hidden", "true");
    capa.style.cssText = `position:absolute;inset:0;z-index:6;touch-action:none;cursor:${CURSOR}`;
    mapa.getCanvasContainer().appendChild(capa);

    let trazo: [number, number][] = [];
    let pantalla: [number, number][] = [];
    let largoPx = 0;
    let puntero: number | null = null;
    // Dos dedos en la pantalla: se mueve o acerca el mapa, no se dibuja
    let gesto = false;
    let marco = 0;

    const pintar = () => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => {
        fuente()?.setData(trazo.length >= 2 ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trazo } }] } : VACIO);
      });
    };
    const enCapa = (e: { clientX: number; clientY: number }): [number, number] => {
      const caja = capa.getBoundingClientRect();
      return [e.clientX - caja.left, e.clientY - caja.top];
    };
    const agregar = (xy: [number, number], siempre = false) => {
      const ultimo = pantalla[pantalla.length - 1];
      const d = ultimo ? Math.hypot(xy[0] - ultimo[0], xy[1] - ultimo[1]) : 0;
      if (ultimo && (d < PASO_PX && !(siempre && d > 0.5))) return;
      largoPx += d;
      pantalla.push(xy);
      const ll = mapa.unproject(xy);
      trazo.push([ll.lng, ll.lat]);
    };
    const limpiar = () => {
      if (puntero !== null)
        try {
          capa.releasePointerCapture(puntero);
        } catch {
          // ya estaba suelto
        }
      trazo = [];
      pantalla = [];
      largoPx = 0;
      puntero = null;
      pintar();
    };

    const terminar = () => {
      const puntos = trazo;
      const px = pantalla;
      const largo = largoPx;
      limpiar();
      if (largo < MINIMO_PX || puntos.length < 2) {
        setAviso(tx("Mantenga presionado y arrastre para dibujar la zona o la línea de la malla.", "Press, hold and drag to draw the zone or the line for the mesh."));
        return;
      }
      // Metros por píxel donde se dibujó: el pulso de la mano y el cierre de la figura se miden en pantalla
      const medio = px[Math.floor(px.length / 2)];
      const a = mapa.unproject(medio);
      const b = mapa.unproject([medio[0] + 100, medio[1]]);
      const mpp = distanciaM(a.lat, a.lng, b.lat, b.lng) / 100;
      const { ancho, despachar: d } = actual.current;
      const l = leerTrazo(puntos, ancho, { toleranciaM: PULSO_PX * mpp, cierreM: CIERRE_PX * mpp });
      if (l.tipo === "corto") {
        setAviso(tx("Mantenga presionado y arrastre para dibujar la zona o la línea de la malla.", "Press, hold and drag to draw the zone or the line for the mesh."));
        return;
      }
      if (l.areaM2 < AREA_MINIMA_M2) {
        setAviso(tx("Esa zona es muy pequeña (menos de media hectárea): con un solo nodo basta. Dibújela más grande.", "That zone is very small (less than half a hectare): a single node is enough. Draw it bigger."));
        return;
      }
      const texto =
        l.tipo === "zona"
          ? tx(`Lápiz de malla: arme la malla óptima en la zona que dibujé (${textoArea(l.areaM2)}).`, `Mesh pencil: build the optimal mesh in the zone I drew (${textoArea(l.areaM2)}).`)
          : tx(
              `Lápiz de malla: arme la malla óptima a lo largo del trazo que dibujé (${formatoDistancia(l.longitudM)}, franja de ${numeroLocal(l.anchoM / 1000)} km de ancho).`,
              `Mesh pencil: build the optimal mesh along the line I drew (${formatoDistancia(l.longitudM)}, a strip ${numeroLocal(l.anchoM / 1000)} km wide).`,
            );
      d({ tipo: "herramienta", herramienta: "mover" });
      window.dispatchEvent(new CustomEvent("melki:orden", { detail: { orden: disenoDibujado(l.poligono, l.tipo, l.tipo === "franja" ? l.anchoM : undefined), texto } }));
    };

    const bajar = (e: PointerEvent) => {
      if (gesto || puntero !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      setAviso(null);
      puntero = e.pointerId;
      try {
        capa.setPointerCapture(e.pointerId);
      } catch {
        // sin captura también se dibuja (el trazo termina si el puntero sale del mapa)
      }
      trazo = [];
      pantalla = [];
      largoPx = 0;
      agregar(enCapa(e));
      pintar();
    };
    const mover = (e: PointerEvent) => {
      if (e.pointerId !== puntero) return;
      const juntos = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      for (const ev of juntos.length ? juntos : [e]) agregar(enCapa(ev));
      pintar();
    };
    const subir = (e: PointerEvent) => {
      if (e.pointerId !== puntero) return;
      agregar(enCapa(e), true);
      terminar();
    };
    const cancelar = (e: PointerEvent) => {
      if (e.pointerId === puntero) limpiar();
    };
    // Con dos dedos el mapa se mueve y se acerca como siempre (MapLibre recibe esos toques); con uno se dibuja
    const tocar = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        gesto = true;
        if (puntero !== null) limpiar();
        return;
      }
      if (!gesto) e.stopPropagation();
    };
    const arrastrarToque = (e: TouchEvent) => {
      if (!gesto) e.stopPropagation();
    };
    const soltarToque = (e: TouchEvent) => {
      if (gesto) {
        if (e.touches.length === 0) gesto = false;
        return;
      }
      e.stopPropagation();
    };
    // El clic, el doble clic y el arrastre con el ratón no llegan al mapa (no lo mueven ni ponen nodos)
    const parar = (e: Event) => e.stopPropagation();
    const menu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (puntero !== null) limpiar();
    };
    capa.addEventListener("pointerdown", bajar);
    capa.addEventListener("pointermove", mover);
    capa.addEventListener("pointerup", subir);
    capa.addEventListener("pointercancel", cancelar);
    capa.addEventListener("touchstart", tocar, { passive: true });
    capa.addEventListener("touchmove", arrastrarToque, { passive: true });
    capa.addEventListener("touchend", soltarToque);
    capa.addEventListener("touchcancel", soltarToque);
    for (const tipo of ["mousedown", "mouseup", "click", "dblclick"]) capa.addEventListener(tipo, parar);
    capa.addEventListener("contextmenu", menu);
    return () => {
      cancelAnimationFrame(marco);
      capa.remove();
      fuente()?.setData(VACIO);
    };
  }, [mapa, activo]);

  if (!aviso) return null;
  return (
    <div className="pointer-events-none absolute top-20 left-1/2 z-30 max-w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-xl bg-carbon/90 px-3 py-2 text-center text-[13px] leading-snug text-white shadow-lg" role="status">
      {aviso}
    </div>
  );
}
