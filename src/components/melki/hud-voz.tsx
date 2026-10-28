// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Barra del Asistente Melki sobre el mapa: el orbe animado según lo que hace (esperando su nombre, escuchando,
// pensando, hablando), lo que va oyendo, lo que está diciendo (subtítulos) y las sugerencias del momento. Para no
// estorbar: se arrastra a cualquier parte del mapa (y recuerda dónde quedó; doble clic la devuelve a su sitio), se
// encoge sola a una píldora mientras espera su nombre y crece cuando lo llaman; también se puede dejar siempre pequeña.
// En reposo («dormido») no se muestra: Melki solo escucha su nombre.
import { CircleHelp, Maximize2, Minimize2, PanelLeft, PanelRight, Sparkles, Square, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as EventoRaton, type PointerEvent as EventoPuntero, type ReactNode } from "react";

import type { EstadoManosLibres } from "./manos-libres";

/** Lo que muestra la etiqueta de estado. */
const ESTADO: Record<EstadoManosLibres, string> = {
  apagado: "Apagado",
  dormido: "En reposo",
  preparando: "Preparando el micrófono",
  esperando: "Diga «Hola Melki»",
  atento: "Le escucho",
  pensando: "Pensando",
  hablando: "Hablando",
};

/** Colores del orbe por estado: tres tonos para el anillo y el del centro. */
const COLORES: Record<EstadoManosLibres, [string, string, string]> = {
  apagado: ["#6e8f78", "#8fb39b", "#4f6d59"],
  dormido: ["#6e8f78", "#8fb39b", "#4f6d59"],
  preparando: ["#6e8f78", "#a9c4b0", "#4f6d59"],
  esperando: ["#6e8f78", "#9cc7b0", "#e07a3f"],
  atento: ["#e07a3f", "#ffb27a", "#f5d33b"],
  pensando: ["#8fb3ff", "#c3a6ff", "#4fd1b5"],
  hablando: ["#4fd1b5", "#8fb3ff", "#e07a3f"],
};

export type SugerenciaHud = "resultados" | "herramientas" | "que-hago" | "ayuda";

/** Dónde quedó la barra y si se dejó pequeña (por persona, en este navegador). */
const CLAVE_HUD = "simulador-cobertura-melki-hud";
type Posicion = { x: number; y: number } | null;
function leerHud(): { pos: Posicion; mini: boolean } {
  try {
    const t = window.localStorage.getItem(CLAVE_HUD);
    if (t) {
      const v = JSON.parse(t) as { pos?: Posicion; mini?: boolean };
      return { pos: v.pos && Number.isFinite(v.pos.x) && Number.isFinite(v.pos.y) ? v.pos : null, mini: Boolean(v.mini) };
    }
  } catch {
    // Sin almacenamiento: la barra vuelve a su sitio
  }
  return { pos: null, mini: false };
}
function guardarHud(v: { pos: Posicion; mini: boolean }) {
  try {
    window.localStorage.setItem(CLAVE_HUD, JSON.stringify(v));
  } catch {
    // Sin almacenamiento: se recuerda solo mientras la página esté abierta
  }
}

/** Cuánto sube cada barrita con la voz (la del centro, más). */
const FORMA_BARRAS = [0.55, 0.85, 1, 0.8, 0.6];

/**
 * El orbe del asistente. Mientras escucha (esperando su nombre o atento al pedido), si el micrófono da su nivel, las
 * barritas siguen la voz de verdad: así se ve que oye, sin que el micrófono se prenda y se apague.
 */
function Orbe({ estado, pequeno, nivel }: { estado: EstadoManosLibres; pequeno?: boolean; nivel?: () => number | null }) {
  const [a, b, c] = COLORES[estado];
  const estilo = { "--orbe-a": a, "--orbe-b": b, "--orbe-c": c } as CSSProperties;
  const escucha = estado === "esperando" || estado === "atento";
  const raiz = useRef<HTMLSpanElement>(null);
  const [vivo, setVivo] = useState(false);
  useEffect(() => {
    const el = raiz.current;
    if (!el || !nivel || !escucha) {
      setVivo(false);
      return;
    }
    let suave = 0;
    let conMedida = false;
    // Unas doce veces por segundo basta (la transición de las barritas lo suaviza)
    const id = window.setInterval(() => {
      const v = nivel();
      if ((v !== null) !== conMedida) {
        conMedida = v !== null;
        setVivo(conMedida);
      }
      if (!conMedida) return;
      suave = suave * 0.5 + (v ?? 0) * 0.5;
      el.style.setProperty("--nivel", Math.min(1, Math.sqrt(suave) * 1.6).toFixed(3));
    }, 80);
    return () => window.clearInterval(id);
  }, [nivel, escucha]);
  const barras = estado === "hablando" || (estado === "atento" && !vivo);
  return (
    <span
      ref={raiz}
      className={`orbe-voz relative grid shrink-0 place-items-center ${pequeno ? "h-8 w-8" : "h-10 w-10"}`}
      data-estado={estado}
      data-nivel={vivo && escucha ? "vivo" : undefined}
      style={estilo}
      aria-hidden="true"
    >
      <span className="orbe-aura absolute -inset-1 rounded-full blur-md" />
      <span className="orbe-anillo absolute inset-0 rounded-full" />
      <span className={`orbe-centro absolute inset-[3px] flex items-center justify-center rounded-full ${pequeno ? "gap-[2px]" : "gap-[3px]"}`}>
        {[0, 1, 2, 3, 4].slice(0, pequeno ? 3 : 5).map((k) => (
          <i key={k} className={`barra-voz block w-[3px] rounded-full bg-white/95 ${barras ? "activa" : ""}`} style={{ animationDelay: `${k * 0.11}s`, "--k": FORMA_BARRAS[k] } as CSSProperties} />
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors ${
        resaltado ? "chip-resaltado bg-[#ffd68c] text-carbon hover:bg-[#ffe2a8]" : "bg-white/10 text-white/90 ring-1 ring-white/10 hover:bg-white/20"
      }`}
    >
      {icono}
      {texto}
    </button>
  );
}

function Boton({ etiqueta, titulo, onClick, children, fondo }: { etiqueta: string; titulo?: string; onClick: () => void; children: ReactNode; fondo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${fondo ? "bg-white/10 hover:bg-white/20" : "text-white/80 hover:bg-white/15 hover:text-white"}`}
      aria-label={etiqueta}
      title={titulo ?? etiqueta}
    >
      {children}
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
  nivel,
  ia = false,
  voz = false,
  parlantes = false,
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
  /** Nivel de la voz que oye el micrófono (0 a 1), o `null` si no hay medida. */
  nivel?: () => number | null;
  /** Conversa con la IA (Gemini Live): lo dice con una insignia. */
  ia?: boolean;
  /**
   * Melki habla en voz alta (solo si se lo piden). Lo normal es que no: escucha, hace lo que se le pide y la respuesta
   * queda escrita en la barra (no hay nada que callar).
   */
  voz?: boolean;
  /** Con parlantes no escucha mientras habla (para no oírse a sí mismo): se le calla con el botón. */
  parlantes?: boolean;
}) {
  const [pos, setPos] = useState<Posicion>(() => leerHud().pos);
  const [mini, setMini] = useState(() => leerHud().mini);
  /** Esperando su nombre desde hace unos segundos: la barra se encoge sola. */
  const [reposo, setReposo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ dx: number; dy: number; px: number; py: number; pw: number; ph: number; w: number; h: number; movio: boolean } | null>(null);
  const ultima = useRef<Posicion>(pos);

  const quieto = estado === "esperando" && !aviso && !bloqueada && !resaltado;
  useEffect(() => {
    const t = window.setTimeout(() => setReposo(quieto), quieto ? 5000 : 0);
    return () => window.clearTimeout(t);
  }, [quieto, estado]);

  // Si la ventana se achica, la barra no queda por fuera del mapa
  useEffect(() => {
    const ajustar = () => {
      const el = caja.current;
      const padre = el?.offsetParent as HTMLElement | null;
      if (!el || !padre || !ultima.current) return;
      const x = Math.max(4, Math.min(ultima.current.x, padre.clientWidth - el.offsetWidth - 4));
      const y = Math.max(4, Math.min(ultima.current.y, padre.clientHeight - el.offsetHeight - 4));
      if (x !== ultima.current.x || y !== ultima.current.y) {
        ultima.current = { x, y };
        setPos({ x, y });
      }
    };
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  if (estado === "apagado" || estado === "dormido") return null;

  const pequena = mini || (reposo && quieto);
  const tituloCallar = parlantes ? "Callar (con parlantes no le oigo mientras hablo: use este botón)" : "Callar (o diga «Melki, para»)";
  /** Callar solo tiene sentido si suena su voz; sin voz la respuesta queda escrita y se va sola. */
  const callable = estado === "hablando" && voz;
  const nombreEstado = estado === "hablando" && !voz ? "Le respondo por escrito" : ESTADO[estado];
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
  const etiquetaPequena = aviso ?? (estado === "esperando" ? "Diga «Hola Melki»" : estado === "hablando" ? subtitulo || nombreEstado : estado === "atento" ? (escuchado ? `«${escuchado}»` : "Le escucho…") : nombreEstado);

  const empezar = (e: EventoPuntero<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") || e.button !== 0) return;
    const el = caja.current;
    const padre = el?.offsetParent as HTMLElement | null;
    if (!el || !padre) return;
    const r = el.getBoundingClientRect();
    const p = padre.getBoundingClientRect();
    arrastre.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, px: p.left, py: p.top, pw: p.width, ph: p.height, w: r.width, h: r.height, movio: false };
    el.setPointerCapture?.(e.pointerId);
  };
  const mover = (e: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a) return;
    const x = Math.max(4, Math.min(e.clientX - a.px - a.dx, a.pw - a.w - 4));
    const y = Math.max(4, Math.min(e.clientY - a.py - a.dy, a.ph - a.h - 4));
    if (!a.movio && ultima.current && Math.abs(x - ultima.current.x) + Math.abs(y - ultima.current.y) < 3) return;
    a.movio = true;
    ultima.current = { x: Math.round(x), y: Math.round(y) };
    setPos(ultima.current);
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    if (a?.movio) guardarHud({ pos: ultima.current, mini });
  };
  const volver = (e: EventoRaton) => {
    if ((e.target as HTMLElement).closest("button")) return;
    ultima.current = null;
    setPos(null);
    guardarHud({ pos: null, mini });
  };
  const fijarMini = (v: boolean) => {
    setMini(v);
    setReposo(false);
    guardarHud({ pos: ultima.current, mini: v });
  };

  const lugar = pos ? "" : "top-[88px] left-1/2 -translate-x-1/2 lg:top-16";
  const comunes = {
    ref: caja,
    role: "status",
    "aria-live": "polite" as const,
    "aria-label": "Asistente Melki",
    "data-tour": "hud-voz",
    "data-estado": estado,
    "data-forma": pequena ? "pequena" : "completa",
    "data-ia": ia ? "si" : undefined,
    style: pos ? { left: pos.x, top: pos.y } : undefined,
    onPointerDown: empezar,
    onPointerMove: mover,
    onPointerUp: soltar,
    onPointerCancel: soltar,
    onDoubleClick: volver,
    title: "Arrastre para moverla; doble clic la devuelve a su sitio",
  };

  if (pequena)
    return (
      <div
        {...comunes}
        className={`hud-asistente pointer-events-auto absolute z-20 flex max-w-[calc(100%-24px)] cursor-grab touch-none items-center gap-2 rounded-full py-1 pr-1 pl-1 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/15 backdrop-blur-xl select-none active:cursor-grabbing ${lugar}`}
      >
        <Orbe estado={estado} pequeno nivel={nivel} />
        <span className="max-w-[240px] min-w-0 truncate pr-1 text-[12.5px] text-white/90">{etiquetaPequena}</span>
        {callable && (
          <Boton etiqueta="Callar a Melki" titulo={tituloCallar} onClick={onCallar} fondo>
            <Square size={12} fill="currentColor" />
          </Boton>
        )}
        <Boton etiqueta="Agrandar la barra del asistente" onClick={() => fijarMini(false)}>
          <Maximize2 size={14} />
        </Boton>
        <Boton etiqueta="Apagar el Asistente Melki" titulo="Apagar el asistente (o diga «Melki, deja de escuchar»)" onClick={onApagar}>
          <X size={16} />
        </Boton>
      </div>
    );

  const hayPaneles = paneles && (!paneles.derecho || !paneles.izquierdo);
  return (
    <div
      {...comunes}
      className={`hud-asistente pointer-events-auto absolute z-20 w-[min(500px,calc(100%-24px))] cursor-grab touch-none overflow-hidden rounded-[20px] text-white shadow-[0_18px_48px_-14px_rgba(0,0,0,0.6)] ring-1 ring-white/15 backdrop-blur-xl select-none active:cursor-grabbing ${lugar}`}
    >
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-2">
        <Orbe estado={estado} nivel={nivel} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-cond text-[14.5px] leading-none font-semibold tracking-wide">Asistente Melki</span>
            {ia && (
              <span className="hud-ia inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#e07a3f] to-[#8fb3ff] px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-white" title={`Conversando ${motor}`}>
                <Sparkles size={11} aria-hidden="true" /> IA en vivo
              </span>
            )}
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${estado === "atento" ? "bg-melki/25 text-[#ffd2b8]" : "bg-white/10 text-white/75"}`}
              title={motor ? `Escucho ${motor}` : undefined}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${estado === "atento" ? "animate-pulse bg-melki" : estado === "hablando" ? "bg-[#4fd1b5]" : estado === "pensando" ? "animate-pulse bg-[#8fb3ff]" : "bg-salvia"}`} />
              <span>{nombreEstado}</span>
            </span>
          </p>
          <p className={`mt-1 line-clamp-2 text-[13.5px] leading-snug ${aviso ? "text-[#ffd2b8]" : estado === "atento" || estado === "pensando" ? "text-white italic" : "text-white/95"}`}>{linea}</p>
        </div>
        {callable && (
          <Boton etiqueta="Callar a Melki" titulo={tituloCallar} onClick={onCallar} fondo>
            <Square size={12} fill="currentColor" />
          </Boton>
        )}
        <Boton etiqueta="¿Qué hago ahora?" onClick={() => onSugerencia("que-hago")}>
          <Sparkles size={15} />
        </Boton>
        <Boton etiqueta="¿Qué puedo decir?" onClick={() => onSugerencia("ayuda")}>
          <CircleHelp size={16} />
        </Boton>
        <Boton etiqueta="Achicar la barra del asistente" titulo="Dejarla pequeña" onClick={() => fijarMini(true)}>
          <Minimize2 size={14} />
        </Boton>
        <Boton etiqueta="Apagar el Asistente Melki" titulo="Apagar el asistente (o diga «Melki, deja de escuchar»)" onClick={onApagar}>
          <X size={16} />
        </Boton>
      </div>
      {bloqueada && (
        <button type="button" onClick={onOirme} className="mx-3 mb-2 flex w-[calc(100%-24px)] items-center justify-center gap-2 rounded-xl bg-[#ffd68c] px-3 py-1.5 text-[13px] font-medium text-carbon hover:bg-[#ffe2a8]">
          <Volume2 size={15} aria-hidden="true" /> Toque aquí para oír mi voz
        </button>
      )}
      {hayPaneles && (
        <div className="desplazable flex gap-1.5 overflow-x-auto px-3 pb-2.5 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Sugerencias del asistente" data-tour="hud-sugerencias">
          {!paneles.derecho && <Chip icono={<PanelRight size={13} aria-hidden="true" />} texto="Mostrar resultados" resaltado={resaltado === "derecho"} onClick={() => onSugerencia("resultados")} />}
          {!paneles.izquierdo && <Chip icono={<PanelLeft size={13} aria-hidden="true" />} texto="Mostrar herramientas" resaltado={resaltado === "izquierdo"} onClick={() => onSugerencia("herramientas")} />}
        </div>
      )}
    </div>
  );
}
