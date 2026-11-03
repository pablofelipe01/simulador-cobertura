// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// El simulador usa el mapa, Web Workers y el almacenamiento del navegador: se carga solo en el cliente.
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

import { leerPreferenciaIdioma, type Idioma } from "@/lib/idioma";

// La preferencia de idioma no cambia mientras se carga el simulador: no hay nada que escuchar
const sinCambios = () => () => {};

/**
 * Aviso mientras se carga el simulador, en el idioma del usuario (el guardado o el del navegador). Aún no se ha
 * iniciado el idioma del simulador: se lee la preferencia directamente. En el servidor (y al hidratar) va en español,
 * y luego React lo cambia sin desajustes de hidratación.
 */
function Preparando() {
  const lengua = useSyncExternalStore(sinCambios, () => leerPreferenciaIdioma().idioma, (): Idioma => "es");
  return (
    <div className="grid h-full place-items-center bg-papel">
      <p className="font-cond text-lg text-tenue">{lengua === "en" ? "Preparing the simulator…" : "Preparando el simulador…"}</p>
    </div>
  );
}

const Simulador = dynamic(() => import("./simulador").then((m) => m.Simulador), {
  ssr: false,
  loading: () => <Preparando />,
});

export function AppCliente() {
  return <Simulador />;
}
