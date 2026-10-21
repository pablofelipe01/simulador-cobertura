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
