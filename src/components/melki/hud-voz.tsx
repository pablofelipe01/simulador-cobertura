// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Barra del Asistente Melki sobre el mapa: el orbe animado según lo que hace (esperando su nombre, escuchando,
// pensando, hablando), lo que va oyendo, lo que está diciendo (subtítulos), las sugerencias del momento (mostrar los
// paneles que ocultó al activarse, «¿Qué hago ahora?») y los botones para callarlo y apagarlo.
import { CircleHelp, PanelLeft, PanelRight, Sparkles, Square, Volume2, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import type { EstadoManosLibres } from "./manos-libres";

/** Lo que muestra la etiqueta de estado. */
const ESTADO: Record<EstadoManosLibres, string> = {
  apagado: "Apagado",
  preparando: "Preparando el micrófono",
  esperando: "Diga «Hola Melki»",
  atento: "Le escucho",
  pensando: "Pensando",
  hablando: "Hablando",
};

/** Colores del orbe por estado: tres tonos para el anillo y el del centro. */
const COLORES: Record<EstadoManosLibres, [string, string, string]> = {
  apagado: ["#6e8f78", "#8fb39b", "#4f6d59"],
  preparando: ["#6e8f78", "#a9c4b0", "#4f6d59"],
  esperando: ["#6e8f78", "#9cc7b0", "#e07a3f"],
  atento: ["#e07a3f", "#ffb27a", "#f5d33b"],
  pensando: ["#8fb3ff", "#c3a6ff", "#4fd1b5"],
  hablando: ["#4fd1b5", "#8fb3ff", "#e07a3f"],
};

export type SugerenciaHud = "resultados" | "herramientas" | "que-hago" | "ayuda";

function Orbe({ estado }: { estado: EstadoManosLibres }) {
  const [a, b, c] = COLORES[estado];
  const estilo = { "--orbe-a": a, "--orbe-b": b, "--orbe-c": c } as CSSProperties;
  const barras = estado === "hablando" || estado === "atento";
  return (
    <span className="orbe-voz relative grid h-12 w-12 shrink-0 place-items-center" data-estado={estado} style={estilo} aria-hidden="true">
      <span className="orbe-aura absolute -inset-1 rounded-full blur-md" />
      <span className="orbe-anillo absolute inset-0 rounded-full" />
      <span className="orbe-centro absolute inset-[3px] flex items-center justify-center gap-[3px] rounded-full">
        {[0, 1, 2, 3, 4].map((k) => (
          <i key={k} className={`barra-voz block w-[3px] rounded-full bg-white/95 ${barras ? "activa" : ""}`} style={{ animationDelay: `${k * 0.11}s` }} />
        ))}
      </span>
    </span>
  );
}

function Chip({ icono, texto, resaltado, onClick }: { icono: ReactNode; texto: string; resaltado?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap transition-colors ${
        resaltado ? "chip-resaltado bg-[#ffd68c] text-carbon hover:bg-[#ffe2a8]" : "bg-white/10 text-white/90 ring-1 ring-white/10 hover:bg-white/20"
      }`}
    >
      {icono}
      {texto}
    </button>
  );
}

export function HudVoz({
  estado,
  escuchado,
  subtitulo,
  aviso,
  motor,
  paneles,
  resaltado,
  bloqueada,
  onCallar,
  onSugerencia,
  onOirme,
  onApagar,
}: {
  estado: EstadoManosLibres;
  /** Lo que va reconociendo (en vivo). */
  escuchado: string;
  /** Lo que Melki está diciendo (o lo último que dijo). */
  subtitulo: string;
  aviso: string | null;
  /** Con qué se escucha: el navegador o en este equipo. */
  motor: string;
  /** Paneles de los lados en el computador (en el celular no hay: `null`). */
  paneles: { izquierdo: boolean; derecho: boolean } | null;
  /** El panel que Melki acaba de sugerir mostrar. */
  resaltado: "izquierdo" | "derecho" | null;
  /** El navegador no deja hablar hasta que la persona toque la página. */
  bloqueada: boolean;
  onCallar: () => void;
  onSugerencia: (s: SugerenciaHud) => void;
  onOirme: () => void;
  onApagar: () => void;
}) {
  if (estado === "apagado") return null;
  const linea =
    aviso ??
    (estado === "hablando"
      ? subtitulo
      : estado === "atento" || estado === "pensando"
        ? escuchado
          ? `«${escuchado}»`
          : "Dígame, le escucho…"
        : estado === "esperando"
          ? subtitulo || "Por ejemplo: «Hola Melki, ¿qué hago ahora?»"
          : "Un momento, por favor…");
  return (
    <div
      className="hud-asistente pointer-events-auto absolute top-[88px] left-1/2 z-20 w-[min(600px,calc(100%-24px))] -translate-x-1/2 overflow-hidden rounded-[22px] text-white shadow-[0_18px_48px_-14px_rgba(0,0,0,0.6)] ring-1 ring-white/15 backdrop-blur-xl lg:top-16"
      role="status"
      aria-live="polite"
      aria-label="Asistente Melki"
      data-tour="hud-voz"
      data-estado={estado}
    >
      <div className="flex items-center gap-3 px-3.5 pt-3 pb-2">
        <Orbe estado={estado} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-cond text-[15.5px] leading-none font-semibold tracking-wide">Asistente Melki</span>
            <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${estado === "atento" ? "bg-melki/25 text-[#ffd2b8]" : "bg-white/10 text-white/75"}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${estado === "atento" ? "animate-pulse bg-melki" : estado === "hablando" ? "bg-[#4fd1b5]" : estado === "pensando" ? "animate-pulse bg-[#8fb3ff]" : "bg-salvia"}`} />
              <span className="truncate">{ESTADO[estado]}</span>
            </span>
            <span className="hidden shrink-0 text-[11px] text-white/40 sm:inline">{motor}</span>
          </p>
          <p className={`mt-1 line-clamp-2 text-[14.5px] leading-snug ${aviso ? "text-[#ffd2b8]" : estado === "atento" || estado === "pensando" ? "text-white italic" : "text-white/95"}`}>{linea}</p>
        </div>
        {estado === "hablando" && (
          <button type="button" onClick={onCallar} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Callar a Melki" title="Callar (o diga «Melki, para»)">
            <Square size={13} fill="currentColor" />
          </button>
        )}
        <button
          type="button"
          onClick={onApagar}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/15"
          aria-label="Apagar el Asistente Melki"
          title="Apagar el asistente (o diga «Melki, deja de escuchar»)"
        >
          <X size={18} />
        </button>
      </div>
      {bloqueada && (
        <button type="button" onClick={onOirme} className="mx-3.5 mb-2 flex w-[calc(100%-28px)] items-center justify-center gap-2 rounded-xl bg-[#ffd68c] px-3 py-1.5 text-[13px] font-medium text-carbon hover:bg-[#ffe2a8]">
          <Volume2 size={15} aria-hidden="true" /> Toque aquí para oír mi voz
        </button>
      )}
      <div className="desplazable flex gap-1.5 overflow-x-auto px-3.5 pb-3 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Sugerencias del asistente" data-tour="hud-sugerencias">
        {paneles && !paneles.derecho && <Chip icono={<PanelRight size={14} aria-hidden="true" />} texto="Mostrar resultados" resaltado={resaltado === "derecho"} onClick={() => onSugerencia("resultados")} />}
        {paneles && !paneles.izquierdo && <Chip icono={<PanelLeft size={14} aria-hidden="true" />} texto="Mostrar herramientas" resaltado={resaltado === "izquierdo"} onClick={() => onSugerencia("herramientas")} />}
        <Chip icono={<Sparkles size={14} aria-hidden="true" />} texto="¿Qué hago ahora?" onClick={() => onSugerencia("que-hago")} />
        <Chip icono={<CircleHelp size={14} aria-hidden="true" />} texto="¿Qué puedo decir?" onClick={() => onSugerencia("ayuda")} />
      </div>
    </div>
  );
}
