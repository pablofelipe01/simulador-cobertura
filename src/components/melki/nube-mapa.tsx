// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// La nube del recorrido: un letrero de vidrio que sale de un punto del mapa (o del robot) con una línea que lo
// señala, y escribe su explicación como una máquina de escribir. Translúcida, pero con el texto oscuro sobre un vidrio
// claro y desenfocado, para que se lea sobre cualquier color del mapa. En el computador va al lado libre del punto;
// en el celular, abajo, como una hoja. El texto completo está desde el principio (reservado e invisible), así la nube
// no cambia de tamaño mientras escribe; un toque la termina de escribir.
import { MessageSquareText } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { CifraPitch } from "@/lib/negocio/pitch";

const TONOS: Record<NonNullable<CifraPitch["tono"]>, string> = {
  bien: "text-buena",
  alerta: "text-melki-oscura",
  mal: "text-sin",
};

/** Ancho de la nube en el computador (px). */
export const anchoNube = (anchoZona: number) => Math.round(Math.min(410, Math.max(300, anchoZona * 0.3)));
/** Separación entre el punto y la nube (lo que mide la línea que lo señala). */
const SEPARACION = 58;

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
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(0);
  const total = parrafos.reduce((s, p) => s + p.length, 0);
  const [letras, setLetras] = useState(() => (reducirMovimiento() ? total : 0));
  const avisado = useRef(false);
  const celular = zona.ancho < 640;
  const W = celular ? zona.ancho - 24 : anchoNube(zona.ancho);

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

  // La máquina de escribir: termina en unos segundos según lo largo (máximo 9 s), medido con el reloj (en un equipo
  // lento escribe a saltos más grandes, pero termina a tiempo)
  const completo = letras >= total;
  const inicio = useRef<number | null>(null);
  useEffect(() => {
    if (!escribir || completo) return;
    if (inicio.current === null) inicio.current = performance.now();
    const desde = inicio.current;
    const duracion = Math.min(9000, Math.max(1500, total * 18));
    const id = window.setInterval(() => {
      const n = Math.min(total, Math.ceil((total * (performance.now() - desde)) / duracion));
      setLetras((x) => Math.max(x, n));
    }, 40);
    return () => window.clearInterval(id);
  }, [escribir, completo, total]);

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
  const listo = alto > 0;

  // Lo escrito hasta ahora, párrafo por párrafo
  const inicios = parrafos.map((_, k) => parrafos.slice(0, k).reduce((s, x) => s + x.length, 0));
  const escritos = parrafos.map((p, k) => p.slice(0, Math.max(0, Math.min(p.length, letras - inicios[k]))));
  const enCurso = escritos.findIndex((x, k) => x.length < parrafos[k].length);

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {listo && (
          <g className="nube-linea" key={titulo}>
            <path d={`M ${ancla.x} ${ancla.y} Q ${medio.x} ${medio.y} ${fin.x} ${fin.y}`} fill="none" stroke="rgba(43,47,46,0.38)" strokeWidth="4.5" strokeLinecap="round" pathLength={1} className="nube-trazo" />
            <path d={`M ${ancla.x} ${ancla.y} Q ${medio.x} ${medio.y} ${fin.x} ${fin.y}`} fill="none" stroke="#fffaf3" strokeWidth="2" strokeLinecap="round" pathLength={1} className="nube-trazo" />
            <circle cx={ancla.x} cy={ancla.y} r="7" fill="#e07a3f" stroke="#fffaf3" strokeWidth="2.5" />
            <circle cx={fin.x} cy={fin.y} r="3.2" fill="#fffaf3" stroke="rgba(43,47,46,0.45)" strokeWidth="1.2" />
          </g>
        )}
      </svg>
      <div
        ref={caja}
        role="group"
        aria-label={titulo}
        data-nube={lado}
        data-escrito={completo ? "si" : "no"}
        onClick={() => setLetras(total)}
        onWheel={quieta}
        onTouchMove={quieta}
        className={`nube-mapa pointer-events-auto absolute overflow-y-auto rounded-[20px] px-4 pt-3 pb-3.5 text-carbon ${listo ? "nube-emerge" : "opacity-0"}`}
        style={{ left, top, width: W, maxHeight: maxAlto, transformOrigin: `${ancla.x - left}px ${ancla.y - top}px` }}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-melki-oscura uppercase">
          <MessageSquareText size={13} aria-hidden="true" />
          <span className="min-w-0 truncate">{paso ? `${paso} · ${etiqueta}` : etiqueta}</span>
        </p>
        <h3 className="mt-0.5 font-cond text-[21px] leading-tight font-semibold text-carbon">{titulo}</h3>
        {subtitulo && <p className="mt-0.5 text-[12.5px] leading-snug text-carbon-2/80">{subtitulo}</p>}
        {datos.length > 0 && (
          <dl className="mt-2.5 grid grid-cols-2 gap-1.5">
            {datos.map((c, k) => (
              <div key={c.etiqueta} className="nube-dato rounded-xl bg-white/70 px-2.5 py-1.5 ring-1 ring-black/5" style={{ animationDelay: `${180 + k * 80}ms` }}>
                <dt className="text-[10.5px] leading-tight text-carbon-2/75">{c.etiqueta}</dt>
                <dd className={`font-cond text-[17px] leading-tight font-semibold tabular-nums ${c.tono ? TONOS[c.tono] : "text-carbon"}`}>{c.valor}</dd>
                {c.detalle && <dd className="text-[10.5px] leading-tight text-carbon-2/75">{c.detalle}</dd>}
              </div>
            ))}
          </dl>
        )}
        <div className="mt-2.5 space-y-2">
          {parrafos.map((p, k) => (
            <p key={k} className="relative text-[13.5px] leading-relaxed text-carbon">
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
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-carbon px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-carbon-2"
          >
            {sugerencia.texto}
          </button>
        )}
      </div>
    </>
  );
}
