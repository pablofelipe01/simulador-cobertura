// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Piezas de interfaz compartidas por los paneles.
import { useId, useState, type ReactNode } from "react";

export const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace(".", ",") : "—");

type CampoNumeroProps = {
  etiqueta: string;
  valor: number;
  unidad?: string;
  min?: number;
  max?: number;
  paso?: number;
  ayuda?: string;
  onCambio: (v: number) => void;
  tour?: string;
};

/** Campo numérico que acepta coma decimal y solo confirma valores válidos. */
export function CampoNumero({ etiqueta, valor, unidad, min, max, paso = 1, ayuda, onCambio, tour }: CampoNumeroProps) {
  const id = useId();
  // Mientras se edita se conserva el texto escrito; fuera de la edición se muestra el valor del estado.
  const [borrador, setTexto] = useState<string | null>(null);
  const texto = borrador ?? String(valor).replace(".", ",");
  const n = Number(texto.replace(",", "."));
  const invalido = texto.trim() === "" || !Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max);
  return (
    <label htmlFor={id} className="block" data-tour={tour}>
      <span className="mb-1 block text-[13px] text-carbon-2">{etiqueta}</span>
      <span className="relative block">
        <input
          id={id}
          className="campo pr-12 tabular-nums"
          inputMode="decimal"
          value={texto}
          aria-invalid={invalido}
          title={ayuda}
          onFocus={() => setTexto(String(valor).replace(".", ","))}
          onBlur={() => setTexto(null)}
          onChange={(e) => {
            setTexto(e.target.value);
            const v = Number(e.target.value.replace(",", "."));
            if (e.target.value.trim() !== "" && Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) onCambio(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const v = Math.round(((Number.isFinite(n) ? n : valor) + (e.key === "ArrowUp" ? paso : -paso)) * 1000) / 1000;
              const lim = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
              setTexto(String(lim).replace(".", ","));
              onCambio(lim);
            }
          }}
        />
        {unidad && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[13px] text-tenue">{unidad}</span>}
      </span>
      {ayuda && <span className="mt-1 block text-[12px] leading-snug text-tenue">{ayuda}</span>}
    </label>
  );
}

export function Interruptor({ etiqueta, activo, onCambio, detalle }: { etiqueta: ReactNode; activo: boolean; onCambio: (v: boolean) => void; detalle?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1 text-[14px]">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={activo} onChange={(e) => onCambio(e.target.checked)} />
        <span className="h-[18px] w-8 rounded-full bg-linea transition-colors peer-checked:bg-salvia peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-salvia-oscura" />
        <span className="absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
      </span>
      <span className="leading-snug">
        {etiqueta}
        {detalle && <span className="block text-[12px] text-tenue">{detalle}</span>}
      </span>
    </label>
  );
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
  claro,
}: {
  opciones: { valor: T; texto: ReactNode; titulo?: string }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
  claro?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={`inline-flex rounded-lg p-0.5 ${claro ? "bg-white/90 shadow-sm ring-1 ring-black/10" : "bg-papel-2"}`}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          title={o.titulo}
          onClick={() => onCambio(o.valor)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium whitespace-nowrap transition-colors ${
            valor === o.valor ? "bg-carbon text-white" : "text-carbon-2 hover:bg-black/5"
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="font-cond text-[15px] font-semibold text-carbon">{children}</h2>
      {accion}
    </div>
  );
}

export function Boton({
  children,
  onClick,
  variante = "secundario",
  titulo,
  deshabilitado,
  tour,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: "principal" | "secundario" | "fantasma" | "peligro";
  titulo?: string;
  deshabilitado?: boolean;
  tour?: string;
  className?: string;
}) {
  const estilos = {
    principal: "bg-carbon text-white hover:bg-carbon-2 disabled:bg-carbon/40",
    secundario: "bg-white text-carbon ring-1 ring-linea hover:bg-papel-2 disabled:text-tenue",
    fantasma: "text-carbon-2 hover:bg-black/5 disabled:text-tenue",
    peligro: "text-sin hover:bg-sin/10",
  }[variante];
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo && typeof children !== "string" ? titulo : undefined}
      disabled={deshabilitado}
      data-tour={tour}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors disabled:cursor-not-allowed ${estilos} ${className}`}
    >
      {children}
    </button>
  );
}
