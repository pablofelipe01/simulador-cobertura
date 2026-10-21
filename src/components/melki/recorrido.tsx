"use client";

// Tours guiados: Melki resalta una parte de la pantalla y explica para qué sirve. En los pasos prácticos pide
// hacer algo, detecta solo cuando quedó hecho y ofrece «Hágalo por mí» y «Omitir paso». En los tours prácticos
// la pantalla sigue disponible (no hay velo que bloquee los clics) y se puede salir en cualquier momento.
import { Check } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { MelkiAvatar } from "./avatar";
import type { ApiTour, FotoTour, Preparacion, Tour } from "./tours";
import { callar, hablar } from "./voz";

export type { Preparacion } from "./tours";

type Rect = { top: number; left: number; width: number; height: number };

/** Ubica el elemento del paso. Solo al entrar al paso se desplaza su panel para mostrarlo (después no se pelea con el usuario). */
function buscar(objetivo: string | string[] | null | undefined, mostrar = false): Rect | null {
  if (!objetivo) return null;
  const nombres = Array.isArray(objetivo) ? objetivo : [objetivo];
  const candidatos = nombres.flatMap((n) => [...document.querySelectorAll<HTMLElement>(`[data-tour="${n}"]`)]);
  const el = candidatos.find((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!el) return null;
  if (mostrar) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  const r = el.getBoundingClientRect();
  const pad = 6;
  return { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

const igual = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1);

/** ¿El foco está en un campo donde se escribe? Ahí las teclas no mueven el tour. */
const escribiendo = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

type Props = {
  tour: Tour;
  t: ApiTour;
  preparar: (p: Preparacion) => void;
  voz: boolean;
  /** Termina el tour; con «otro», Melki muestra el menú de tours. */
  onTerminar: (otro?: boolean) => void;
};

export function Recorrido({ tour, t, preparar, voz, onTerminar }: Props) {
  const pasos = tour.pasos;
  const practico = Boolean(tour.practica);
  const [i, setI] = useState(0);
  const [final, setFinal] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ventana, setVentana] = useState({ w: 0, h: 0 });
  const [hecho, setHecho] = useState<"usted" | "melki" | null>(null);
  /** Se volvió a un paso práctico con «Anterior»: no se vuelve a pedir. */
  const [revisando, setRevisando] = useState(false);
  const [altoTarjeta, setAltoTarjeta] = useState(210);
  /** La tarjeta se muestra cuando ya está en su lugar (evita que salte, o que un clic caiga en ella mientras se mueve). */
  const [ubicada, setUbicada] = useState(false);
  const base = useRef<FotoTour | null>(null);
  const porMelki = useRef(false);
  const direccion = useRef(1);
  const tarjeta = useRef<HTMLDivElement>(null);
  const paso = pasos[i];
  const tarea = paso.tarea && !revisando ? paso.tarea : undefined;

  const ir = useCallback(
    (n: number, atras = false) => {
      if (n < 0) return;
      direccion.current = atras ? -1 : 1;
      base.current = null;
      porMelki.current = false;
      setHecho(null);
      setUbicada(false);
      setRevisando(atras && Boolean(pasos[n]?.tarea));
      if (n >= pasos.length) setFinal(true);
      else setI(n);
    },
    [pasos],
  );

  // Al entrar a un paso: abrir el panel que corresponde, dejar lo necesario y tomar la foto de partida
  useLayoutEffect(() => {
    if (final) return;
    // La foto de partida se toma de una vez: lo que el usuario haga desde ahora cuenta
    base.current = t.foto();
    preparar(paso.preparar ?? null);
    paso.asegurar?.(t);
    let cancelado = false;
    const espera = window.setTimeout(() => {
      if (cancelado || !base.current) return;
      // Si al entrar ya está hecho (por ejemplo, el cálculo automático terminó), no se pide: se sigue con «Siguiente»
      if (paso.tarea?.hecho(t, base.current)) setRevisando(true);
      const r = buscar(paso.objetivo, true);
      // Un paso de explicación cuyo elemento no está en pantalla se salta; uno práctico se queda (la tarjeta va al centro)
      if (paso.objetivo && !r && !paso.tarea) {
        const n = i + direccion.current;
        if (n >= 0 && n < pasos.length) setI(n);
        else if (n >= pasos.length) setFinal(true);
        return;
      }
      setRect(r);
      setVentana({ w: window.innerWidth, h: window.innerHeight });
      setUbicada(true);
    }, 80);
    return () => {
      cancelado = true;
      window.clearTimeout(espera);
    };
  }, [i, final]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vigilancia: ¿ya lo hizo? y el elemento resaltado se movió (paneles que se abren, el mapa que se acomoda)
  useEffect(() => {
    if (final) return;
    const vigilar = window.setInterval(() => {
      const r = buscar(paso.objetivo);
      setRect((v) => (igual(v, r) ? v : r));
      setVentana((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      if (tarea && !hecho && base.current && tarea.hecho(t, base.current)) setHecho(porMelki.current ? "melki" : "usted");
    }, 300);
    return () => window.clearInterval(vigilar);
  }, [i, final, tarea, hecho, paso.objetivo, t]);

  // Hecho: se celebra un momento y se pasa solo al siguiente
  useEffect(() => {
    if (!hecho) return;
    if (voz) hablar(hecho === "usted" ? (paso.tarea?.aviso ?? "¡Bien hecho!") : "Listo.");
    const s = window.setTimeout(() => ir(i + 1), 1300);
    return () => window.clearTimeout(s);
  }, [hecho]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!voz) return;
    const detener = final ? hablar(`${tour.final}`) : hablar(`${paso.titulo}. ${paso.texto}`);
    return detener;
  }, [i, final, voz]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (escribiendo(e)) return;
      // En los tours prácticos Escape sigue cerrando menús del simulador; se sale con «Salir»
      if (e.key === "Escape" && !practico) onTerminar();
      else if (final || tarea) return;
      else if (e.key === "ArrowRight") ir(i + 1);
      else if (e.key === "ArrowLeft") ir(i - 1, true);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [i, final, tarea, practico, ir, onTerminar]);

  useEffect(() => () => callar(), []);

  // Alto real de la tarjeta, para ubicarla sin tapar el elemento resaltado
  useEffect(() => {
    const el = tarjeta.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(() => setAltoTarjeta((v) => (Math.abs(el.offsetHeight - v) > 4 ? el.offsetHeight : v)));
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const hacerPorMi = () => {
    if (!tarea) return;
    porMelki.current = true;
    tarea.hacer(t);
  };

  // Tarjeta: debajo del elemento si cabe; si no, encima o a la izquierda; centrada si no hay elemento
  const ancho = Math.min(350, (ventana.w || 360) - 24);
  const alto = altoTarjeta;
  let estilo: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: ancho };
  if (rect && ventana.w && !final) {
    const abajo = rect.top + rect.height + 12;
    const arriba = rect.top - alto - 12;
    const centrada = Math.min(Math.max(12, rect.left + rect.width / 2 - ancho / 2), ventana.w - ancho - 12);
    const izquierda = rect.left - ancho - 12;
    const altoVisible = (top: number) => Math.min(Math.max(12, top), Math.max(12, ventana.h - alto - 12));
    const derecha = rect.left + rect.width + 12;
    if (rect.height > ventana.h * 0.6 && !paso.lado) {
      // Elementos altos: al lado si cabe (los paneles); si no, adentro (el mapa)
      if (derecha + ancho <= ventana.w - 12) estilo = { left: derecha, top: altoVisible(rect.top + 40), width: ancho };
      else if (izquierda >= 12) estilo = { left: izquierda, top: altoVisible(rect.top + 40), width: ancho };
      else estilo = { left: Math.max(12, rect.left + 24), top: Math.max(12, rect.top + 70), width: ancho };
    } else if (paso.lado === "izquierda" && izquierda >= 12) {
      estilo = { left: izquierda, top: altoVisible(rect.top + rect.height - alto), width: ancho };
    } else if (abajo + alto < ventana.h) {
      estilo = { left: centrada, top: abajo, width: ancho };
    } else if (arriba >= 12) {
      estilo = { left: centrada, top: arriba, width: ancho };
    } else if (izquierda >= 12) {
      estilo = { left: izquierda, top: altoVisible(rect.top), width: ancho };
    } else {
      estilo = { left: centrada, top: 12, width: ancho };
    }
  }

  if (typeof estilo.top === "number" && ventana.h) estilo.top = Math.min(Math.max(12, estilo.top), Math.max(12, ventana.h - alto - 12));
  if (typeof estilo.left === "number" && ventana.w) estilo.left = Math.min(Math.max(12, estilo.left), Math.max(12, ventana.w - ancho - 12));

  const ultimo = i === pasos.length - 1;
  const etiqueta = i === 0 ? "Introducción" : `Paso ${i} de ${pasos.length - 1}`;
  const boton = "rounded-lg px-2.5 py-1.5 text-[13px] font-medium";
  const principal = `${boton} bg-carbon text-white hover:bg-carbon-2`;
  const secundario = `${boton} ring-1 ring-linea hover:bg-papel-2`;
  // En los pasos prácticos solo se marca el elemento; en los de explicación se oscurece el resto
  const velo = !practico || !(tarea || hecho);

  return (
    <div className={`fixed inset-0 z-[70] ${practico ? "pointer-events-none" : ""}`} role="dialog" aria-modal={!practico} aria-label={`Tour: ${tour.nombre}`}>
      {!final && rect ? (
        <div className={velo ? "tour-foco" : "tour-anillo"} style={rect} />
      ) : (
        <div className={`fixed inset-0 ${practico && !final && i > 0 ? "" : "bg-[rgb(30_33_32/0.55)]"}`} />
      )}
      <div
        ref={tarjeta}
        className={`fixed rounded-2xl bg-white p-4 text-carbon shadow-2xl ring-1 ring-black/10 transition-opacity duration-150 ${ubicada || final ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        style={estilo}
      >
        <div className="flex items-start gap-3">
          <MelkiAvatar className="h-12 w-12 shrink-0" hablando={voz} />
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium tracking-wide text-melki-oscura uppercase">
              {tour.nombre}
              {!final && <span className="font-normal text-tenue normal-case"> · {etiqueta}</span>}
            </p>
            <p className="font-cond text-[18px] leading-tight font-semibold">{final ? "¡Terminó el tour!" : paso.titulo}</p>
            <p className="mt-1 text-[14px] leading-snug text-carbon-2">
              {final ? `${tour.final}${practico ? " Al cerrar, su escenario vuelve tal cual." : ""}` : paso.texto}
            </p>
          </div>
        </div>

        {!final && paso.tarea && (
          <div className={`mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug ${hecho ? "bg-salvia-clara/70 text-carbon" : "bg-papel text-carbon-2"}`} role="status">
            {hecho ? (
              <>
                <Check size={15} className="shrink-0 text-salvia-oscura" /> {hecho === "usted" ? (paso.tarea.aviso ?? "¡Bien hecho!") : "Listo, lo hice por usted."}
              </>
            ) : revisando ? (
              <>
                <Check size={15} className="shrink-0 text-salvia-oscura" /> Ya está listo; siga cuando quiera.
              </>
            ) : (
              <>
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-melki" aria-hidden="true" /> Hágalo en la pantalla; le aviso cuando esté.
              </>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {final ? (
            <>
              <button type="button" onClick={() => onTerminar(true)} className={secundario}>
                Otro tour
              </button>
              <button type="button" autoFocus onClick={() => onTerminar()} className={principal}>
                Cerrar
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onTerminar()} className={`${boton} mr-auto font-normal text-carbon-2 hover:bg-black/5`}>
                Salir
              </button>
              {i > 0 && !tarea && !hecho && (
                <button type="button" onClick={() => ir(i - 1, true)} className={secundario}>
                  Anterior
                </button>
              )}
              {tarea && !hecho ? (
                <>
                  <button type="button" onClick={() => ir(i + 1)} className={secundario}>
                    Omitir paso
                  </button>
                  <button type="button" autoFocus onClick={hacerPorMi} className={principal}>
                    Hágalo por mí
                  </button>
                </>
              ) : (
                !hecho && (
                  <button type="button" autoFocus onClick={() => ir(i + 1)} className={principal}>
                    {i === 0 ? "Empezar" : ultimo ? "Terminar" : "Siguiente"}
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
