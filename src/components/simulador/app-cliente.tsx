// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// El simulador usa el mapa, Web Workers y el almacenamiento del navegador: se carga solo en el cliente.
import dynamic from "next/dynamic";

const Simulador = dynamic(() => import("./simulador").then((m) => m.Simulador), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-papel">
      <p className="font-cond text-lg text-tenue">Preparando el simulador…</p>
    </div>
  ),
});

export function AppCliente() {
  return <Simulador />;
}
