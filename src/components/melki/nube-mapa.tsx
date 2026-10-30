// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// La nube de Melki: un letrero que sale de un punto del mapa (o del robot) con una línea que lo señala, y escribe su
// explicación como una máquina de escribir. Dos estilos: «vidrio» (vidrio claro y desenfocado, con el texto oscuro: el
// pitch) y «holo» (holográfico: vidrio ahumado y translúcido que deja ver la simulación detrás, apenas oscurecida para
// que el texto claro se lea sobre cualquier color, con borde de luz, esquinas de visor y datos como telemetría: cuando
// Melki llega volando y en el recorrido). En el computador va al lado libre del punto; en el celular, abajo, como una
// hoja. El texto completo está desde el principio (reservado e invisible), así la nube no cambia de tamaño mientras
// escribe; un toque la termina de escribir. En el recorrido y cuando Melki llega a un lugar escribe al ritmo de lectura
// (se lee a medida que aparece) o, si Melki lo está diciendo en voz alta, a la par de su voz; una barra abajo muestra
// cuánto falta para seguir y, con el puntero encima, espera. Puede traer el botón para encender o apagar la voz.
import { ChevronRight, MessageSquareText, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import type { CifraPitch } from "@/lib/negocio/pitch";

const TONOS: Record<NonNullable<CifraPitch["tono"]>, string> = {
  bien: "text-buena",
  alerta: "text-melki-oscura",
  mal: "text-sin",
};
/** En el holograma (fondo oscuro), los mismos tonos más claros. */
const TONOS_HOLO: Record<NonNullable<CifraPitch["tono"]>, string> = {
  bien: "text-[#8ee59b]",
  alerta: "text-[#ffc08f]",
  mal: "text-[#ff9a8f]",
};

/** Ancho de la nube en el computador (px). */
export const anchoNube = (anchoZona: number) => Math.round(Math.min(410, Math.max(300, anchoZona * 0.3)));
/** Separación entre el punto y la nube (lo que mide la línea que lo señala). */
const SEPARACION = 58;

/** Al ritmo de lectura: unas 1.500 letras por minuto (se lee a medida que aparece), hasta 40 s. */
export const ESCRITURA_LECTURA = { msPorLetra: 40, maxMs: 40000 } as const;

/** La pausa después de escribir, para mirar las cifras y terminar de leer antes de seguir (ms): entre 3,5 y 10 s. */
export const pausaLectura = (parrafos: string[]) => Math.min(10000, Math.max(3500, parrafos.reduce((s, p) => s + p.length, 0) * 8));

/**
 * El trozo que la voz está diciendo, en letras del texto de la nube: de `desde` a `hasta`, desde `inicio`
 * (performance.now()) a unos `msPorLetra`. La nube escribe a la par y no pasa del trozo hasta que empiece el siguiente.
 */
export type TramoVoz = { desde: number; hasta: number; inicio: number; msPorLetra: number };

const reducirMovimiento = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function NubeMapa({
  ancla,
  zona,
  reservaAbajo = 96,
  izquierdaMin = 12,
  paso,
  etiqueta,
  titulo,
  subtitulo,
  parrafos,
  datos = [],
  escribir,
  onEscrito,
  sugerencia,
  onSugerencia,
  msPorLetra = 18,
  maxMs = 9000,
  cuenta = null,
  onSobre,
  onCerrar,
  etiquetaCerrar = "Cerrar",
  estilo = "vidrio",
  voz,
  siguiendoVoz = false,
  tramoVoz = null,
}: {
  /** El punto (px dentro de la zona) del que sale la nube. */
  ancla: { x: number; y: number };
  zona: { ancho: number; alto: number };
  /** Espacio que se deja abajo (los controles). */
  reservaAbajo?: number;
  /** En el computador, la nube no pasa a la izquierda de este borde (la tarjeta del pitch). */
  izquierdaMin?: number;
  /** «Recorrido · 2 de 7». */
  paso?: string;
  etiqueta: string;
  titulo: string;
  subtitulo?: string;
  parrafos: string[];
  datos?: CifraPitch[];
  /** Empieza a escribir (después de que la cámara llegó). */
  escribir: boolean;
  /** Terminó de escribir. */
  onEscrito?: () => void;
  sugerencia?: { texto: string; pedido: string };
  onSugerencia?: (pedido: string) => void;
  /** Ritmo de la máquina de escribir (ms por letra) y su tope (ms). Lo normal: rápido; en el recorrido, el de lectura. */
  msPorLetra?: number;
  maxMs?: number;
  /** La barra que muestra cuánto falta para seguir (ms) y si está en pausa. */
  cuenta?: { ms: number; pausada: boolean } | null;
  /** El puntero entró o salió de la nube (para esperar mientras se lee). */
  onSobre?: (sobre: boolean) => void;
  /** Con él, la nube trae su botón para cerrarla. */
  onCerrar?: () => void;
  etiquetaCerrar?: string;
  /** «vidrio» (claro, el de siempre) u «holo» (holográfico y translúcido). */
  estilo?: "vidrio" | "holo";
  /** Con él, la nube trae el botón «Voz de Melki» (encendida o no, si está hablando y cómo cambiarla). */
  voz?: { activa: boolean; hablando: boolean; onCambiar: (v: boolean) => void };
  /** Melki lo está diciendo en voz alta: escribe a la par de su voz (con `tramoVoz`), no a su propio ritmo. */
  siguiendoVoz?: boolean;
  tramoVoz?: TramoVoz | null;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(0);
  const total = parrafos.reduce((s, p) => s + p.length, 0);
  const [letras, setLetras] = useState(() => (reducirMovimiento() ? total : 0));
  const avisado = useRef(false);
  const celular = zona.ancho < 640;
  const W = celular ? zona.ancho - 24 : anchoNube(zona.ancho);
  const holo = estilo === "holo";
  const idGradiente = `nube-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // La altura real (la nube ya reserva el texto completo): para ubicarla sin que salte
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAlto(el.offsetHeight);
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // La máquina de escribir, medida con el reloj (en un equipo lento escribe a saltos más grandes, pero a tiempo): a su
  // ritmo (termina según lo largo, con su tope) o, mientras Melki lo dice, a la par de su voz (sin pasar del trozo que
  // está diciendo). Si la voz se apaga a mitad, sigue a su ritmo desde donde iba.
  const completo = letras >= total;
  useEffect(() => {
    if (!escribir || completo) return;
    const duracion = Math.min(maxMs, Math.max(1500, total * msPorLetra));
    const porMs = total / duracion;
    let antes = performance.now();
    let fraccion = 0;
    const id = window.setInterval(() => {
      const ahora = performance.now();
      const dt = ahora - antes;
      antes = ahora;
      if (siguiendoVoz) {
        if (!tramoVoz) return;
        const meta = Math.min(tramoVoz.hasta, tramoVoz.desde + (ahora - tramoVoz.inicio) / tramoVoz.msPorLetra);
        setLetras((x) => Math.max(x, Math.min(total, Math.floor(meta))));
        return;
      }
      fraccion += dt * porMs;
      const n = Math.floor(fraccion);
      if (n <= 0) return;
      fraccion -= n;
      setLetras((x) => Math.min(total, x + n));
    }, 40);
    return () => window.clearInterval(id);
  }, [escribir, completo, total, msPorLetra, maxMs, siguiendoVoz, tramoVoz]);

  useEffect(() => {
    if (completo && escribir && !avisado.current) {
      avisado.current = true;
      onEscrito?.();
    }
  }, [completo, escribir, onEscrito]);

  // Lo que se va escribiendo, siempre a la vista: si el texto no cabe (en el celular o en una pantalla baja), la nube
  // baja sola con el cursor, renglón por renglón; al terminar muestra el final (y el botón). Si la persona la mueve con
  // el dedo o la rueda, la deja quieta.
  const manual = useRef(false);
  const siguiendo = useRef(false);
  useEffect(() => {
    const el = caja.current;
    if (!el || !escribir || manual.current || el.scrollHeight <= el.clientHeight + 2) return;
    if (completo) {
      if (siguiendo.current) el.scrollTo({ top: el.scrollHeight, behavior: reducirMovimiento() ? "auto" : "smooth" });
      return;
    }
    siguiendo.current = true;
    const cursor = el.querySelector<HTMLElement>(".nube-cursor");
    if (!cursor) return;
    const sobra = cursor.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom + 30;
    if (sobra > 0) el.scrollTop += sobra;
  }, [letras, completo, escribir]);
  const quieta = () => {
    manual.current = true;
  };

  // Dónde va: en el computador, al lado libre del punto; en el celular, abajo
  const lado: "derecha" | "izquierda" = celular ? "derecha" : ancla.x + SEPARACION + W <= zona.ancho - 12 || ancla.x - SEPARACION - W < izquierdaMin ? "derecha" : "izquierda";
  const maxAlto = celular ? Math.round(zona.alto * 0.44) : zona.alto - reservaAbajo - 24;
  const h = Math.min(alto || 280, maxAlto);
  let left: number;
  let top: number;
  if (celular) {
    left = 12;
    top = zona.alto - reservaAbajo - h - 8;
  } else {
    left = lado === "derecha" ? ancla.x + SEPARACION : ancla.x - SEPARACION - W;
    left = Math.max(izquierdaMin, Math.min(left, zona.ancho - W - 12));
    top = Math.max(12, Math.min(ancla.y - h * 0.32, zona.alto - reservaAbajo - h - 8));
  }
  // La línea va del punto al borde de la nube más cercano
  const fin = celular
    ? { x: Math.max(left + 28, Math.min(ancla.x, left + W - 28)), y: top }
    : { x: lado === "derecha" ? left : left + W, y: Math.max(top + 26, Math.min(ancla.y, top + h - 26)) };
  const medio = { x: (ancla.x + fin.x) / 2, y: celular ? (ancla.y + fin.y) / 2 : ancla.y + (fin.y - ancla.y) * 0.15 };
  const curva = `M ${ancla.x} ${ancla.y} Q ${medio.x} ${medio.y} ${fin.x} ${fin.y}`;
  const listo = alto > 0;
  const origen = `${ancla.x - left}px ${ancla.y - top}px`;

  // Lo escrito hasta ahora, párrafo por párrafo
  const inicios = parrafos.map((_, k) => parrafos.slice(0, k).reduce((s, x) => s + x.length, 0));
  const escritos = parrafos.map((p, k) => p.slice(0, Math.max(0, Math.min(p.length, letras - inicios[k]))));
  const enCurso = escritos.findIndex((x, k) => x.length < parrafos[k].length);
  // Arriba a la derecha, fuera de la parte que se desplaza: la voz (más ancha encendida, con su ecualizador) y la X; el
  // encabezado les deja su lugar
  const anchoVoz = voz?.activa ? 74 : 58;
  const reserva = voz && onCerrar ? (voz.activa ? "pr-[112px]" : "pr-[96px]") : voz ? (voz.activa ? "pr-[84px]" : "pr-[68px]") : onCerrar ? "pr-7" : "";
  const sobreHandlers = onSobre ? { onMouseEnter: () => onSobre(true), onMouseLeave: () => onSobre(false) } : {};

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {listo && !holo && (
          <g className="nube-linea" key={titulo}>
            <path d={curva} fill="none" stroke="rgba(43,47,46,0.38)" strokeWidth="4.5" strokeLinecap="round" pathLength={1} className="nube-trazo" />
            <path d={curva} fill="none" stroke="#fffaf3" strokeWidth="2" strokeLinecap="round" pathLength={1} className="nube-trazo" />
            <circle cx={ancla.x} cy={ancla.y} r="7" fill="#e07a3f" stroke="#fffaf3" strokeWidth="2.5" />
            <circle cx={fin.x} cy={fin.y} r="3.2" fill="#fffaf3" stroke="rgba(43,47,46,0.45)" strokeWidth="1.2" />
          </g>
        )}
        {listo && holo && (
          <g className="nube-linea" key={titulo}>
            <defs>
              <linearGradient id={idGradiente} gradientUnits="userSpaceOnUse" x1={ancla.x} y1={ancla.y} x2={fin.x} y2={fin.y}>
                <stop offset="0" stopColor="#ffb27a" />
                <stop offset="1" stopColor="#5fe0c3" />
              </linearGradient>
            </defs>
            {/* Un trazo oscuro debajo (se ve sobre el mapa claro), la línea de luz y los datos que corren por ella */}
            <path d={curva} fill="none" stroke="rgba(8,12,11,0.42)" strokeWidth="5" strokeLinecap="round" pathLength={1} className="nube-trazo" />
            <path d={curva} fill="none" stroke={`url(#${idGradiente})`} strokeWidth="2.2" strokeLinecap="round" pathLength={1} className="nube-trazo holo-linea" />
            <path d={curva} fill="none" stroke="#fff6ec" strokeWidth="2.2" strokeLinecap="round" pathLength={1} className="holo-flujo" />
            {/* La retícula del visor sobre el punto exacto */}
            <g className="holo-reticula">
              <circle cx={ancla.x} cy={ancla.y} r="11" fill="none" stroke="#ffb27a" strokeWidth="1.4" strokeDasharray="5 4" />
              <path
                d={`M ${ancla.x} ${ancla.y - 17} V ${ancla.y - 13} M ${ancla.x} ${ancla.y + 13} V ${ancla.y + 17} M ${ancla.x - 17} ${ancla.y} H ${ancla.x - 13} M ${ancla.x + 13} ${ancla.y} H ${ancla.x + 17}`}
                stroke="#ffb27a"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </g>
            <circle cx={ancla.x} cy={ancla.y} r="4.2" fill="#ffb27a" stroke="#1a120c" strokeWidth="1.4" className="holo-nucleo" />
            <circle cx={fin.x} cy={fin.y} r="3.4" fill="#5fe0c3" stroke="rgba(8,12,11,0.6)" strokeWidth="1.2" />
          </g>
        )}
      </svg>
      {/* El marco del holograma: borde de luz, esquinas de visor y un barrido de luz al aparecer (no se desplaza) */}
      {listo && holo && (
        <div className="holo-marco nube-emerge" style={{ left, top, width: W, height: h, transformOrigin: origen }} aria-hidden="true">
          <span className="holo-luz">
            <span className="holo-barrido" />
          </span>
          <span className="holo-esquina ai" />
          <span className="holo-esquina ad" />
          <span className="holo-esquina bi" />
          <span className="holo-esquina bd" />
        </div>
      )}
      <div
        ref={caja}
        role="group"
        aria-label={titulo}
        data-nube={lado}
        data-estilo={estilo}
        data-escrito={completo ? "si" : "no"}
        data-a-la-par={siguiendoVoz ? "si" : undefined}
        onClick={() => setLetras(total)}
        onWheel={quieta}
        onTouchMove={quieta}
        {...sobreHandlers}
        className={`nube-mapa ${holo ? "nube-holo" : "text-carbon"} pointer-events-auto absolute overflow-y-auto rounded-[20px] px-4 pt-3 pb-3.5 ${listo ? "nube-emerge" : "opacity-0"}`}
        style={{ left, top, width: W, maxHeight: maxAlto, transformOrigin: origen }}
      >
        <p className={`flex items-start gap-1.5 font-semibold uppercase ${holo ? "text-[10.5px] leading-[14px] tracking-[0.1em] text-[#ffc59c]" : "text-[11px] leading-[14px] tracking-wide text-melki-oscura"} ${reserva}`}>
          {holo ? <span className="holo-led mt-[3.5px]" aria-hidden="true" /> : <MessageSquareText size={13} className="mt-px shrink-0" aria-hidden="true" />}
          <span className="min-w-0">{paso ? `${paso} · ${etiqueta}` : etiqueta}</span>
        </p>
        <h3 className={`mt-0.5 font-cond text-[21px] leading-tight font-semibold ${holo ? "holo-titulo text-white" : "text-carbon"}`}>{titulo}</h3>
        {subtitulo && <p className={`mt-0.5 text-[12.5px] leading-snug ${holo ? "text-[rgba(214,233,225,0.8)]" : "text-carbon-2/80"}`}>{subtitulo}</p>}
        {datos.length > 0 && (
          <dl className="mt-2.5 grid grid-cols-2 gap-1.5">
            {datos.map((c, k) => (
              <div
                key={c.etiqueta}
                className={`nube-dato rounded-xl px-2.5 py-1.5 ${holo ? "holo-dato" : "bg-white/70 ring-1 ring-black/5"} ${datos.length % 2 && k === datos.length - 1 ? "col-span-2" : ""}`}
                style={{ animationDelay: `${180 + k * 80}ms` }}
              >
                <dt className={`text-[10.5px] leading-tight ${holo ? "tracking-wide text-[rgba(150,226,205,0.92)] uppercase" : "text-carbon-2/75"}`}>{c.etiqueta}</dt>
                <dd className={`font-cond text-[17px] leading-tight font-semibold break-words tabular-nums ${c.tono ? (holo ? TONOS_HOLO : TONOS)[c.tono] : holo ? "text-white" : "text-carbon"}`}>{c.valor}</dd>
                {c.detalle && <dd className={`text-[10.5px] leading-tight ${holo ? "text-[rgba(214,233,225,0.74)]" : "text-carbon-2/75"}`}>{c.detalle}</dd>}
              </div>
            ))}
          </dl>
        )}
        <div className="mt-2.5 space-y-2">
          {parrafos.map((p, k) => (
            <p key={k} className={`relative text-[13.5px] leading-relaxed ${holo ? "text-[rgba(240,247,243,0.97)]" : "text-carbon"}`}>
              {/* El texto completo reserva su lugar; encima se va escribiendo */}
              <span className="invisible" aria-hidden="true">
                {p}
              </span>
              <span className="absolute inset-0" aria-hidden="true">
                {escritos[k]}
                {k === enCurso && <span className="nube-cursor" />}
              </span>
              <span className="sr-only">{p}</span>
            </p>
          ))}
        </div>
        {sugerencia && onSugerencia && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSugerencia(sugerencia.pedido);
            }}
            className={
              holo
                ? "holo-boton mt-3 inline-flex items-center gap-1 rounded-full py-1.5 pr-2.5 pl-3.5 text-[12.5px] font-semibold text-[#1d130c]"
                : "mt-3 inline-flex items-center gap-1.5 rounded-full bg-carbon px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-carbon-2"
            }
          >
            {sugerencia.texto}
            {holo && <ChevronRight size={15} aria-hidden="true" />}
          </button>
        )}
      </div>
      {/* Fuera de la parte que se desplaza: la voz y la X arriba, y la barra que cuenta el tiempo, abajo */}
      {listo && voz && (
        <button
          type="button"
          onClick={() => voz.onCambiar(!voz.activa)}
          {...sobreHandlers}
          className={`pointer-events-auto absolute inline-flex h-7 items-center justify-center gap-1.5 rounded-full text-[11.5px] font-semibold ${
            holo ? (voz.activa ? "holo-voz-encendida text-[#ffe0c9]" : "holo-voz text-white/80 hover:text-white") : voz.activa ? "bg-melki-clara text-melki-oscura ring-1 ring-melki/40" : "bg-black/5 text-carbon-2 hover:bg-black/10"
          }`}
          style={{ left: left + W - (onCerrar ? 36 : 8) - anchoVoz, top: top + 7, width: anchoVoz }}
          aria-label="Voz de Melki"
          aria-pressed={voz.activa}
          title={voz.activa ? "Melki lo dice en voz alta (toque para que solo lo escriba)" : "Melki solo lo escribe (toque para que lo diga en voz alta)"}
          data-voz={voz.activa ? "encendida" : "apagada"}
        >
          {voz.activa ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
          <span>Voz</span>
          {voz.activa && (
            <span className={`holo-ecualizador ${voz.hablando ? "activo" : ""}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </button>
      )}
      {listo && onCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          {...sobreHandlers}
          className={`pointer-events-auto absolute rounded-full p-1 ${holo ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-carbon-2/75 hover:bg-black/5 hover:text-carbon"}`}
          style={{ left: left + W - 34, top: top + 8 }}
          aria-label={etiquetaCerrar}
          title={etiquetaCerrar}
        >
          <X size={16} />
        </button>
      )}
      {listo && cuenta && cuenta.ms > 0 && (
        <span
          className={`pointer-events-none absolute h-[3px] overflow-hidden rounded-full ${holo ? "bg-white/15" : "bg-carbon/12"}`}
          style={{ left: left + 16, top: top + h - 6, width: W - 32 }}
          aria-hidden="true"
          data-cuenta={cuenta.pausada ? "pausada" : "corre"}
        >
          <span className={`nube-cuenta block h-full rounded-full ${holo ? "holo-cuenta" : "bg-melki"}`} style={{ animationDuration: `${cuenta.ms}ms`, animationPlayState: cuenta.pausada ? "paused" : "running" }} />
        </span>
      )}
    </>
  );
}
