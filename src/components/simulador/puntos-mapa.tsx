// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Piezas sobre el mapa: coordenadas bajo el cursor, menú del clic derecho, tarjeta de un punto y tarjeta del nodo seleccionado.
import type { Map as MapaML } from "maplibre-gl";
import { Copy, Crosshair, Eye, MapPin, Ruler, Signal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { textoUbicacion } from "@/lib/geo/referencia";
import { tx } from "@/lib/idioma";
import { aGMS } from "@/lib/radio/geo";
import type { Antena, NodoMalla, ResumenAntena } from "@/lib/radio/tipos";
import { useIdioma } from "@/lib/use-idioma";

import { IconoEquipo, IconoNodo, IconoTorre } from "./icono-torre";
import { fmt } from "./ui";

/** «m s. n. m.» (metros sobre el nivel del mar) en el idioma de la pantalla. */
const sobreElMar = () => tx("m s. n. m.", "m a.s.l.");

export function CoordenadasCursor({ mapa }: { mapa: MapaML | null }) {
  useIdioma();
  const [p, setP] = useState<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    if (!mapa) return;
    let marco = 0;
    const mover = (e: { lngLat: { lat: number; lng: number } }) => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => setP({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
    };
    const salir = () => setP(null);
    mapa.on("mousemove", mover);
    mapa.getCanvasContainer().addEventListener("mouseleave", salir);
    return () => {
      cancelAnimationFrame(marco);
      mapa.off("mousemove", mover);
      mapa.getCanvasContainer().removeEventListener("mouseleave", salir);
    };
  }, [mapa]);
  if (!p) return null;
  const lugar = textoUbicacion(p.lat, p.lon);
  return (
    <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 hidden max-w-[60%] -translate-x-1/2 truncate rounded-md bg-carbon/80 px-2.5 py-1 text-[12px] text-white tabular-nums md:block" aria-hidden="true">
      {p.lat.toFixed(5)}, {p.lon.toFixed(5)} · {aGMS(p.lat, "lat")} {aGMS(p.lon, "lon")}
      {lugar ? ` · ${lugar}` : ""}
    </div>
  );
}

export type AccionPunto = "antena" | "nodo" | "senal" | "medir" | "centrar" | "copiar" | "marcar";

export function MenuContextual({ x, y, lat, lon, onAccion, onCerrar }: { x: number; y: number; lat: number; lon: number; onAccion: (a: AccionPunto) => void; onCerrar: () => void }) {
  useIdioma();
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cerrar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !caja.current?.contains(e.target as Node)) onCerrar();
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", cerrar);
    caja.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, [onCerrar]);
  const item = (a: AccionPunto, icono: React.ReactNode, texto: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onAccion(a);
        onCerrar();
      }}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] hover:bg-papel-2 focus:bg-papel-2 focus:outline-none"
    >
      <span className="text-carbon-2">{icono}</span>
      {texto}
    </button>
  );
  const lugar = textoUbicacion(lat, lon);
  return (
    <div ref={caja} role="menu" aria-label={tx("Acciones en este punto", "Actions at this point")} className="absolute z-40 w-64 rounded-xl bg-white p-1.5 text-carbon shadow-xl ring-1 ring-black/10" style={{ left: x, top: y }}>
      <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] leading-snug text-tenue tabular-nums">
        {aGMS(lat, "lat")} · {aGMS(lon, "lon")}
        {lugar ? <span className="block">{lugar}</span> : null}
      </p>
      {item("antena", <IconoTorre className="h-4 w-4" />, tx("Agregar nodo antena aquí", "Add antenna node here"))}
      {item("nodo", <IconoEquipo className="h-4 w-4" />, tx("Agregar nodo de campo aquí", "Add field node here"))}
      {item("senal", <Signal size={16} />, tx("Señal en este punto", "Signal at this point"))}
      {item("medir", <Ruler size={16} />, tx("Medir desde aquí", "Measure from here"))}
      {item("marcar", <Crosshair size={16} />, tx("Marcar este punto", "Mark this point"))}
      {item("copiar", <Copy size={16} />, tx("Copiar coordenadas", "Copy coordinates"))}
    </div>
  );
}

export function TarjetaPunto({ lat, lon, titulo, onAccion, onCerrar }: { lat: number; lon: number; titulo: string; onAccion: (a: AccionPunto) => void; onCerrar: () => void }) {
  useIdioma();
  const lugar = textoUbicacion(lat, lon);
  const boton = (a: AccionPunto, texto: string) => (
    <button type="button" onClick={() => onAccion(a)} className="rounded-lg px-2.5 py-1 text-[12.5px] font-medium ring-1 ring-linea hover:bg-papel-2">
      {texto}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute top-28 left-1/2 z-20 sm:top-16 w-[min(380px,calc(100%-24px))] -translate-x-1/2 rounded-xl bg-white p-3 text-carbon shadow-lg ring-1 ring-black/10" role="dialog" aria-label={tx("Punto marcado", "Marked point")}>
      <div className="flex items-start gap-2">
        <MapPin size={18} className="mt-0.5 shrink-0 text-melki" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-cond text-[15px] font-semibold">{titulo}</p>
          <p className="text-[12px] text-tenue tabular-nums">
            {lat.toFixed(6)}, {lon.toFixed(6)} · {aGMS(lat, "lat")} {aGMS(lon, "lon")}
          </p>
          {lugar && <p className="text-[12px] text-carbon-2">{lugar}</p>}
        </div>
        <button type="button" onClick={onCerrar} className="rounded p-1 text-tenue hover:bg-black/5" aria-label={tx("Quitar el punto", "Remove the point")}>
          <X size={16} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {boton("antena", tx("Agregar nodo antena", "Add antenna node"))}
        {boton("nodo", tx("Agregar nodo", "Add node"))}
        {boton("senal", tx("Señal aquí", "Signal here"))}
        {boton("medir", tx("Medir desde aquí", "Measure from here"))}
        {boton("copiar", tx("Copiar", "Copy"))}
      </div>
    </div>
  );
}

export function TarjetaNodo({
  antena,
  resumen,
  nodo,
  nombres,
  soloSeleccionada,
  onSolo,
  onCerrar,
  sembrar,
  extra,
}: {
  sembrar?: boolean;
  /** Zona de popularidad del gateway o repetidor (y su resultado en la prueba de estrés). */
  extra?: ReactNode;
  antena: Antena;
  resumen: ResumenAntena | undefined;
  nodo: NodoMalla | undefined;
  nombres: Map<string, string>;
  soloSeleccionada: boolean;
  onSolo: (v: boolean) => void;
  onCerrar: () => void;
}) {
  useIdioma();
  const campo = (antena.tipo ?? "antena") === "nodo";
  const lugar = textoUbicacion(antena.lat, antena.lon);
  // En el modo «Sembrar la malla» se habla de gateway, repetidores y personas
  const clase = sembrar
    ? antena.pasarela
      ? "Gateway + Internet"
      : campo
        ? tx("Persona", "Person")
        : tx("Repetidor", "Repeater")
    : `${campo ? tx("Nodo de campo", "Field node") : tx("Nodo antena", "Antenna node")}${antena.pasarela ? tx(" · pasarela", " · gateway") : ""}`;
  const destino = sembrar ? "del gateway" : "de la pasarela";
  // Ruta hasta el gateway (la pasarela): «A 2 saltos del gateway: Persona 1 → Repetidor 1 → Gateway.»
  const ruta = (n: NodoMalla) => {
    if (n.saltos === null) return tx(`Sin ruta ${sembrar ? "al gateway" : "a la pasarela"}.`, "No route to the gateway.");
    const camino = n.ruta.map((id) => nombres.get(id) ?? id).join(" → ");
    return tx(`A ${n.saltos} ${n.saltos === 1 ? "salto" : "saltos"} ${destino}: ${camino}.`, `${n.saltos} ${n.saltos === 1 ? "hop" : "hops"} from the gateway: ${camino}.`);
  };
  return (
    <div className="pointer-events-auto absolute right-3 bottom-28 z-10 hidden w-72 rounded-xl bg-white/95 p-3 text-carbon shadow-lg ring-1 ring-black/10 xl:block" aria-label={tx(`Información de ${antena.nombre}`, `Information about ${antena.nombre}`)} data-tour="tarjeta-nodo">
      <div className="flex items-start gap-2">
        <span className="text-carbon">
          <IconoNodo tipo={antena.tipo} className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-cond text-[16px] leading-tight font-semibold">{antena.nombre}</p>
          <p className="text-[12px] text-tenue">
            {clase} · {fmt(antena.alturaM, antena.alturaM % 1 ? 1 : 0)} m · {fmt(antena.gananciaDbi)} dBi
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="rounded p-1 text-tenue hover:bg-black/5" aria-label={tx("Cerrar la información", "Close the information")}>
          <X size={15} />
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-carbon-2 tabular-nums">
        {aGMS(antena.lat, "lat")} · {aGMS(antena.lon, "lon")}
        {lugar ? <span className="block text-tenue">{lugar}</span> : null}
      </p>
      {resumen && (
        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[12.5px]">
          <dt className="text-tenue">{tx("Alcance con servicio", "Range with service")}</dt>
          <dd className="text-right tabular-nums">
            {resumen.alcanceLimitado ? "≥ " : ""}
            {fmt(resumen.alcanceKm, 1)} km
          </dd>
          <dt className="text-tenue">{tx("Alcance confiable", "Reliable range")}</dt>
          <dd className="text-right tabular-nums">{fmt(resumen.alcanceConfiableKm, 1)} km</dd>
          <dt className="text-tenue">{tx("Área con servicio", "Area with service")}</dt>
          <dd className="text-right tabular-nums">{fmt(resumen.areaServicioKm2, 1)} km²</dd>
          <dt className="text-tenue">{tx("Terreno", "Terrain")}</dt>
          <dd className="text-right tabular-nums">
            {resumen.elevacionM} {sobreElMar()}
          </dd>
        </dl>
      )}
      {nodo && !antena.pasarela && <p className="mt-1.5 text-[12px] leading-snug text-carbon-2">{ruta(nodo)}</p>}
      {resumen && (
        <button type="button" onClick={() => onSolo(!soloSeleccionada)} className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium ring-1 ring-linea hover:bg-papel-2" aria-pressed={soloSeleccionada}>
          <Eye size={14} /> {soloSeleccionada ? tx("Ver la cobertura de todos", "Show everyone’s coverage") : tx("Ver solo su cobertura", "Show only its coverage")}
        </button>
      )}
      {extra && <div className="mt-2">{extra}</div>}
    </div>
  );
}
