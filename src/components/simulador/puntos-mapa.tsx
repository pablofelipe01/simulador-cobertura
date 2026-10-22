"use client";

// Piezas sobre el mapa: coordenadas bajo el cursor, menú del clic derecho, tarjeta de un punto y tarjeta del nodo seleccionado.
import type { Map as MapaML } from "maplibre-gl";
import { Copy, Crosshair, Eye, MapPin, Ruler, Signal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { textoUbicacion } from "@/lib/geo/referencia";
import { aGMS } from "@/lib/radio/geo";
import type { Antena, NodoMalla, ResumenAntena } from "@/lib/radio/tipos";

import { IconoEquipo, IconoNodo, IconoTorre } from "./icono-torre";
import { fmt } from "./ui";

export function CoordenadasCursor({ mapa }: { mapa: MapaML | null }) {
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
    <div ref={caja} role="menu" aria-label="Acciones en este punto" className="absolute z-40 w-64 rounded-xl bg-white p-1.5 text-carbon shadow-xl ring-1 ring-black/10" style={{ left: x, top: y }}>
      <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] leading-snug text-tenue tabular-nums">
        {aGMS(lat, "lat")} · {aGMS(lon, "lon")}
        {lugar ? <span className="block">{lugar}</span> : null}
      </p>
      {item("antena", <IconoTorre className="h-4 w-4" />, "Agregar nodo antena aquí")}
      {item("nodo", <IconoEquipo className="h-4 w-4" />, "Agregar nodo de campo aquí")}
      {item("senal", <Signal size={16} />, "Señal en este punto")}
      {item("medir", <Ruler size={16} />, "Medir desde aquí")}
      {item("marcar", <Crosshair size={16} />, "Marcar este punto")}
      {item("copiar", <Copy size={16} />, "Copiar coordenadas")}
    </div>
  );
}

export function TarjetaPunto({ lat, lon, titulo, onAccion, onCerrar }: { lat: number; lon: number; titulo: string; onAccion: (a: AccionPunto) => void; onCerrar: () => void }) {
  const lugar = textoUbicacion(lat, lon);
  const boton = (a: AccionPunto, texto: string) => (
    <button type="button" onClick={() => onAccion(a)} className="rounded-lg px-2.5 py-1 text-[12.5px] font-medium ring-1 ring-linea hover:bg-papel-2">
      {texto}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute top-28 left-1/2 z-20 sm:top-16 w-[min(380px,calc(100%-24px))] -translate-x-1/2 rounded-xl bg-white p-3 text-carbon shadow-lg ring-1 ring-black/10" role="dialog" aria-label="Punto marcado">
      <div className="flex items-start gap-2">
        <MapPin size={18} className="mt-0.5 shrink-0 text-melki" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-cond text-[15px] font-semibold">{titulo}</p>
          <p className="text-[12px] text-tenue tabular-nums">
            {lat.toFixed(6)}, {lon.toFixed(6)} · {aGMS(lat, "lat")} {aGMS(lon, "lon")}
          </p>
          {lugar && <p className="text-[12px] text-carbon-2">{lugar}</p>}
        </div>
        <button type="button" onClick={onCerrar} className="rounded p-1 text-tenue hover:bg-black/5" aria-label="Quitar el punto">
          <X size={16} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {boton("antena", "Agregar nodo antena")}
        {boton("nodo", "Agregar nodo")}
        {boton("senal", "Señal aquí")}
        {boton("medir", "Medir desde aquí")}
        {boton("copiar", "Copiar")}
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
}: {
  sembrar?: boolean;
  antena: Antena;
  resumen: ResumenAntena | undefined;
  nodo: NodoMalla | undefined;
  nombres: Map<string, string>;
  soloSeleccionada: boolean;
  onSolo: (v: boolean) => void;
  onCerrar: () => void;
}) {
  const campo = (antena.tipo ?? "antena") === "nodo";
  const lugar = textoUbicacion(antena.lat, antena.lon);
  // En el modo «Sembrar la malla» se habla de gateway, repetidores y personas
  const clase = sembrar ? (antena.pasarela ? "Gateway + Internet" : campo ? "Persona" : "Repetidor") : `${campo ? "Nodo de campo" : "Nodo antena"}${antena.pasarela ? " · pasarela" : ""}`;
  const destino = sembrar ? "del gateway" : "de la pasarela";
  return (
    <div className="pointer-events-auto absolute right-3 bottom-28 z-10 hidden w-72 rounded-xl bg-white/95 p-3 text-carbon shadow-lg ring-1 ring-black/10 xl:block" aria-label={`Información de ${antena.nombre}`} data-tour="tarjeta-nodo">
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
        <button type="button" onClick={onCerrar} className="rounded p-1 text-tenue hover:bg-black/5" aria-label="Cerrar la información">
          <X size={15} />
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-carbon-2 tabular-nums">
        {aGMS(antena.lat, "lat")} · {aGMS(antena.lon, "lon")}
        {lugar ? <span className="block text-tenue">{lugar}</span> : null}
      </p>
      {resumen && (
        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[12.5px]">
          <dt className="text-tenue">Alcance con servicio</dt>
          <dd className="text-right tabular-nums">
            {resumen.alcanceLimitado ? "≥ " : ""}
            {fmt(resumen.alcanceKm, 1)} km
          </dd>
          <dt className="text-tenue">Alcance confiable</dt>
          <dd className="text-right tabular-nums">{fmt(resumen.alcanceConfiableKm, 1)} km</dd>
          <dt className="text-tenue">Área con servicio</dt>
          <dd className="text-right tabular-nums">{fmt(resumen.areaServicioKm2, 1)} km²</dd>
          <dt className="text-tenue">Terreno</dt>
          <dd className="text-right tabular-nums">{resumen.elevacionM} m s. n. m.</dd>
        </dl>
      )}
      {nodo && !antena.pasarela && (
        <p className="mt-1.5 text-[12px] leading-snug text-carbon-2">
          {nodo.saltos === null ? `Sin ruta ${sembrar ? "al gateway" : "a la pasarela"}.` : `A ${nodo.saltos} ${nodo.saltos === 1 ? "salto" : "saltos"} ${destino}: ${nodo.ruta.map((id) => nombres.get(id) ?? id).join(" → ")}.`}
        </p>
      )}
      {resumen && (
        <button type="button" onClick={() => onSolo(!soloSeleccionada)} className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium ring-1 ring-linea hover:bg-papel-2" aria-pressed={soloSeleccionada}>
          <Eye size={14} /> {soloSeleccionada ? "Ver la cobertura de todos" : "Ver solo su cobertura"}
        </button>
      )}
    </div>
  );
}
