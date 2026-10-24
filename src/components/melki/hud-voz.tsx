"use client";

// Barra de Melki manos libres sobre el mapa: en qué está (esperando su nombre, escuchando, pensando, hablando), lo que
// va oyendo, lo que está diciendo (subtítulos) y los botones para callarlo, pedir ayuda y apagar el modo.
import { CircleHelp, Square, X } from "lucide-react";

import type { EstadoManosLibres } from "./manos-libres";

const TITULO: Record<EstadoManosLibres, string> = {
  apagado: "Manos libres apagado",
  preparando: "Preparando el micrófono…",
  esperando: "Manos libres · diga «Hola Melki»",
  atento: "Le escucho…",
  pensando: "Pensando…",
  hablando: "Melki",
};

function Orbe({ estado }: { estado: EstadoManosLibres }) {
  const color = estado === "atento" ? "bg-melki" : estado === "hablando" ? "bg-[#4fd1b5]" : estado === "pensando" ? "bg-[#8fb3ff]" : "bg-salvia";
  return (
    <span className={`orbe-voz orbe-${estado} relative grid h-11 w-11 shrink-0 place-items-center`} aria-hidden="true">
      <span className={`absolute inset-0 rounded-full opacity-30 ${color} ${estado === "esperando" ? "animate-pulse" : estado === "atento" ? "animate-ping" : ""}`} />
      {estado === "pensando" && <span className="absolute inset-0.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />}
      <span className={`relative flex h-7 w-7 items-center justify-center gap-[3px] rounded-full ${color}`}>
        {[0, 1, 2, 3].map((k) => (
          <i key={k} className={`barra-voz block w-[3px] rounded-full bg-white/90 ${estado === "hablando" || estado === "atento" ? "activa" : ""}`} style={{ animationDelay: `${k * 0.12}s` }} />
        ))}
      </span>
    </span>
  );
}

export function HudVoz({
  estado,
  escuchado,
  subtitulo,
  aviso,
  motor,
  onCallar,
  onAyuda,
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
  onCallar: () => void;
  onAyuda: () => void;
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
          : "Dígame su pedido…"
        : estado === "esperando"
          ? subtitulo || "Por ejemplo: «Hola Melki, ¿qué hago ahora?»"
          : "Un momento…");
  return (
    <div
      className="pointer-events-auto absolute top-[88px] left-1/2 z-20 flex w-[min(540px,calc(100%-24px))] -translate-x-1/2 items-center gap-3 rounded-2xl bg-carbon/90 px-3 py-2.5 text-white shadow-xl ring-1 ring-white/15 backdrop-blur-sm lg:top-16"
      role="status"
      aria-live="polite"
      aria-label="Melki manos libres"
      data-tour="hud-voz"
      data-estado={estado}
    >
      <Orbe estado={estado} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-[11.5px] font-semibold tracking-wide text-white/70 uppercase">
          <span className="truncate">{TITULO[estado]}</span>
          <span className="hidden shrink-0 font-normal tracking-normal normal-case text-white/45 sm:inline">{motor}</span>
        </p>
        <p className={`line-clamp-2 text-[14px] leading-snug ${aviso ? "text-[#ffd2b8]" : estado === "atento" || estado === "pensando" ? "italic text-white" : "text-white/95"}`}>{linea}</p>
      </div>
      {estado === "hablando" && (
        <button type="button" onClick={onCallar} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Callar a Melki" title="Callar (o diga «Melki, para»)">
          <Square size={13} fill="currentColor" />
        </button>
      )}
      <button type="button" onClick={onAyuda} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/15" aria-label="¿Qué le puedo decir a Melki?" title="¿Qué le puedo decir?">
        <CircleHelp size={17} />
      </button>
      <button type="button" onClick={onApagar} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/15" aria-label="Apagar manos libres" title="Apagar manos libres (o diga «Melki, deja de escuchar»)">
        <X size={17} />
      </button>
    </div>
  );
}
