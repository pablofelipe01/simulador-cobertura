"use client";

// Buscador: coordenadas (decimal o GMS), municipios, departamentos, países y nodos del escenario. Sin servicios externos.
import { MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { buscarLugares, cargarReferencia, referenciaCargada, type Lugar } from "@/lib/geo/referencia";
import { aGMS, leerPar } from "@/lib/radio/geo";
import type { Antena } from "@/lib/radio/tipos";

export type Destino =
  | { tipo: "coordenada"; lat: number; lon: number; titulo: string }
  | { tipo: "lugar"; lugar: Lugar }
  | { tipo: "nodo"; antena: Antena };

/** Lee coordenadas escritas de muchas formas; si la longitud viene sin signo y cae en Colombia, la toma al oeste. */
export function leerCoordenadasLibres(texto: string): { lat: number; lon: number; corregido: boolean } | null {
  const par = leerPar(texto.replace(/\s+y\s+/i, ", "));
  if (!par) return null;
  let { lat, lon } = par;
  let corregido = false;
  const conHemisferio = /[NSEOW]\b|norte|sur|oeste|occidente|este/i.test(texto);
  // Orden invertido (longitud primero) en Colombia
  if (Math.abs(lat) > 20 && Math.abs(lat) <= 82 && Math.abs(lon) <= 14) [lat, lon] = [lon, lat];
  if (!conHemisferio && lon >= 66 && lon <= 82 && lat >= -5 && lat <= 14) {
    lon = -lon;
    corregido = true;
  }
  return Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { lat, lon, corregido } : null;
}

export function Buscador({ antenas, onIr }: { antenas: Antena[]; onIr: (d: Destino) => void }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [listo, setListo] = useState(() => referenciaCargada() !== null);
  const caja = useRef<HTMLDivElement>(null);
  const idLista = useId();

  useEffect(() => {
    if (!abierto || listo) return;
    let vivo = true;
    void cargarReferencia().then(() => vivo && setListo(true));
    return () => {
      vivo = false;
    };
  }, [abierto, listo]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  const resultados: Destino[] = useMemo(() => {
    const t = texto.trim();
    if (t.length < 2) return [];
    const salida: Destino[] = [];
    const c = leerCoordenadasLibres(t);
    if (c) salida.push({ tipo: "coordenada", lat: c.lat, lon: c.lon, titulo: `${aGMS(c.lat, "lat")} · ${aGMS(c.lon, "lon")}${c.corregido ? " (longitud oeste)" : ""}` });
    const q = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const a of antenas) {
      const n = a.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (n.includes(q)) salida.push({ tipo: "nodo", antena: a });
    }
    // Los lugares aparecen en cuanto terminan de cargar los datos de referencia
    if (listo) for (const l of buscarLugares(t, 7)) salida.push({ tipo: "lugar", lugar: l });
    return salida.slice(0, 9);
  }, [texto, antenas, listo]);

  const elegir = (d: Destino) => {
    onIr(d);
    setAbierto(false);
    setTexto(d.tipo === "lugar" ? `${d.lugar.nombre}${d.lugar.tipo === "municipio" ? `, ${d.lugar.detalle}` : ""}` : d.tipo === "nodo" ? d.antena.nombre : texto);
  };

  return (
    <div ref={caja} className="relative w-full md:max-w-xs" data-tour="buscador">
      <label htmlFor={`${idLista}-q`} className="sr-only">
        Buscar coordenadas, municipio o nodo
      </label>
      <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-tenue" />
      <input
        id={`${idLista}-q`}
        className="campo py-1.5 pr-7 pl-8"
        placeholder="Coordenadas, municipio o nodo…"
        value={texto}
        role="combobox"
        aria-expanded={abierto && resultados.length > 0}
        aria-controls={idLista}
        aria-autocomplete="list"
        spellCheck={false}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          setActivo(0);
          setAbierto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActivo((a) => Math.min(a + 1, resultados.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActivo((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && resultados[activo]) {
            e.preventDefault();
            elegir(resultados[activo]);
          } else if (e.key === "Escape") setAbierto(false);
        }}
      />
      {texto && (
        <button type="button" className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-tenue hover:bg-black/5" aria-label="Borrar búsqueda" onClick={() => setTexto("")}>
          <X size={14} />
        </button>
      )}
      {abierto && texto.trim().length >= 2 && (
        <ul id={idLista} role="listbox" className="absolute top-full right-0 left-0 z-40 mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/10">
          {resultados.length === 0 ? (
            <li className="px-2.5 py-2 text-[13px] text-tenue">Sin resultados. Escriba un municipio o coordenadas como 4.5123, -73.1234.</li>
          ) : (
            resultados.map((d, i) => (
              <li
                key={i}
                role="option"
                aria-selected={i === activo}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(d);
                }}
                className={`flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] ${i === activo ? "bg-papel-2" : ""}`}
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-salvia-oscura" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.tipo === "coordenada" ? "Ir a la coordenada" : d.tipo === "nodo" ? d.antena.nombre : d.lugar.nombre}</span>
                  <span className="block truncate text-[12px] text-tenue">
                    {d.tipo === "coordenada" ? d.titulo : d.tipo === "nodo" ? ((d.antena.tipo ?? "antena") === "nodo" ? "Nodo del escenario" : "Nodo antena del escenario") : d.lugar.detalle}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
