// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Configuración (la tuerca de la barra superior): el idioma del simulador y de Melki (español o inglés) y si cambia
// solo cuando le hablan o le escriben en el otro idioma. Cada idioma se nombra en su propia lengua, para que lo
// encuentre quien no entiende el que está en pantalla.
import { Check, Languages, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { elegirIdioma, fijarCambioAutomatico, tx, type Idioma } from "@/lib/idioma";
import { useCambioAutomatico, useIdioma } from "@/lib/use-idioma";

import { Interruptor } from "./ui";

const IDIOMAS: { id: Idioma; nombre: string; detalle: string }[] = [
  { id: "es", nombre: "Español", detalle: "La pantalla y Melki en español" },
  { id: "en", nombre: "English", detalle: "Screen and Melki in English" },
];

export function Configuracion() {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const lengua = useIdioma();
  const auto = useCambioAutomatico();
  useEffect(() => {
    if (!abierta) return;
    const cerrar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !caja.current?.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, [abierta]);
  const titulo = tx("Configuración", "Settings");

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={abierta}
        className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${abierta ? "bg-carbon text-white" : "hover:bg-papel-2"}`}
        data-tour="configuracion"
        title={tx("Configuración: idioma del simulador y de Melki", "Settings: language of the simulator and Melki")}
        aria-label={titulo}
      >
        <Settings size={17} />
      </button>
      {abierta && (
        <div role="dialog" aria-label={titulo} className="absolute top-full right-0 z-50 mt-2 w-[19rem] rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/10">
          <p className="font-cond text-[17px] font-semibold">{titulo}</p>
          <p className="mt-2 mb-1 flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-tenue uppercase">
            <Languages size={14} /> {tx("Idioma", "Language")}
          </p>
          <div role="radiogroup" aria-label={tx("Idioma", "Language")} className="space-y-1">
            {IDIOMAS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={lengua === o.id}
                lang={o.id}
                onClick={() => elegirIdioma(o.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ring-1 transition-colors ${lengua === o.id ? "bg-papel-2 ring-salvia" : "ring-linea hover:bg-papel-2"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{o.nombre}</span>
                  <span className="block text-[12px] text-tenue">{o.detalle}</span>
                </span>
                {lengua === o.id && <Check size={16} className="shrink-0 text-salvia-oscura" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-linea pt-2">
            <Interruptor
              etiqueta={tx("Cambiar de idioma automáticamente", "Switch language automatically")}
              detalle={tx(
                "Si le escribe o le habla a Melki en inglés, todo pasa a inglés; si lo hace en español, vuelve al español.",
                "If you write or speak to Melki in Spanish, everything switches to Spanish; in English, it switches back to English.",
              )}
              activo={auto}
              onCambio={fijarCambioAutomatico}
            />
          </div>
        </div>
      )}
    </div>
  );
}
