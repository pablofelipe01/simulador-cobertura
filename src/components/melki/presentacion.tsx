// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// La presentación del modelo de negocio: el robot de Melki vuela por el mapa de capítulo en capítulo (la cámara lo
// sigue), señala cada antena, cuenta el guion en voz alta (con la voz del equipo o la de la IA) y muestra las cifras en
// una tarjeta. Se controla con los botones, el teclado (← → espacio Esc) o la voz («siguiente», «pausa»…).
import { ChevronLeft, ChevronRight, Pause, Play, Repeat, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CapituloPitch, IdCapitulo, MapaPitch, PedidoPitch } from "@/lib/negocio/pitch";

import { RobotMelki, type GestoRobot } from "./robot";

/** Cómo se narra un capítulo: devuelve cómo cortarlo. `alTerminar` se llama una vez al acabar. */
export type Narrador = (texto: string, alTerminar: () => void) => () => void;

export type ControlPitch = { pedir: (p: PedidoPitch) => string };

const TONOS: Record<NonNullable<CapituloPitch["cifras"][number]["tono"]>, string> = {
  bien: "text-buena",
  alerta: "text-melki-oscura",
  mal: "text-sin",
};

const frasesDe = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);
/** Tiempo de lectura en voz alta estimado (ms). */
const duracionLectura = (t: string) => Math.max(2500, t.length * 68);

export function PresentacionPitch({
  armar,
  mapa,
  narrar,
  voz,
  onVoz,
  onSalir,
  control,
  narradorIA = false,
}: {
  /** Arma los capítulos (con la comisión que se esté probando). */
  armar: (comision: number | null) => CapituloPitch[];
  mapa: MapaPitch | null;
  narrar: Narrador;
  voz: boolean;
  onVoz: (v: boolean) => void;
  onSalir: () => void;
  /** Para que Melki (por voz o desde la IA) maneje la presentación. */
  control: React.MutableRefObject<ControlPitch | null>;
  /** La narra la IA (Gemini) con su voz. */
  narradorIA?: boolean;
}) {
  const [comision, setComision] = useState<number | null>(null);
  const capitulos = useMemo(() => armar(comision), [armar, comision]);
  const [i, setI] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(true);
  const [auto, setAuto] = useState(true);
  const [narrando, setNarrando] = useState(false);
  const [volando, setVolando] = useState(false);
  const [frase, setFrase] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number; mirando: "derecha" | "izquierda" } | null>(null);
  const [anillo, setAnillo] = useState<{ x: number; y: number } | null>(null);
  const [repeticion, setRepeticion] = useState(0);
  const [textoComision, setTextoComision] = useState("");
  const zona = useRef<HTMLDivElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const cortar = useRef<(() => void) | null>(null);
  const cap = capitulos[Math.min(i, capitulos.length - 1)];
  const frases = useMemo(() => frasesDe(cap?.guion ?? ""), [cap]);
  // Al terminar de narrar se mira lo de ese momento (si la persona cambió «avanza solo» mientras hablaba)
  const vigentes = useRef({ auto, i, total: capitulos.length });
  useEffect(() => {
    vigentes.current = { auto, i, total: capitulos.length };
  }, [auto, i, capitulos.length]);

  /** Dónde se pone el robot: junto a la antena de la que habla o al lado de la tarjeta. */
  const anclar = useCallback(() => {
    const c = cap;
    const z = zona.current;
    if (!c || !z) return;
    const ancho = z.clientWidth;
    const alto = z.clientHeight;
    const celular = ancho < 640;
    const t = tarjeta.current;
    const bordeTarjeta = t && !celular ? t.offsetLeft + t.offsetWidth : 0;
    if (c.foco.tipo === "punto" && mapa) {
      const p = mapa.proyectar(c.foco.lat, c.foco.lon);
      if (p) {
        const izquierda = p.x - (celular ? 70 : 130) < bordeTarjeta;
        setAnillo(p);
        setPos({ x: izquierda ? p.x + (celular ? 14 : 30) : p.x - (celular ? 84 : 150), y: p.y - (celular ? 120 : 170), mirando: izquierda ? "izquierda" : "derecha" });
        return;
      }
    }
    setAnillo(null);
    setPos(celular ? { x: ancho - 110, y: 70, mirando: "izquierda" } : { x: Math.min(ancho - 170, bordeTarjeta + 24), y: alto * 0.34, mirando: "derecha" });
  }, [cap, mapa]);

  // Cada capítulo: la cámara vuela al foco y el robot con ella; luego narra
  useEffect(() => {
    if (!cap) return;
    cortar.current?.();
    cortar.current = null;
    const z = zona.current;
    const celular = (z?.clientWidth ?? 1200) < 640;
    const t = tarjeta.current;
    const margen = celular
      ? { izquierda: 20, derecha: 20, arriba: 60, abajo: Math.min(360, (z?.clientHeight ?? 800) * 0.5) }
      : { izquierda: (t ? t.offsetLeft + t.offsetWidth : 460) + 60, derecha: 60, arriba: 70, abajo: 110 };
    const ms = mapa ? mapa.volar(cap.foco, margen) : 0;
    let vigente = true;
    const fin = window.setTimeout(
      () => {
        if (!vigente) return;
        setVolando(false);
        anclar();
      },
      Math.max(60, ms + 80),
    );
    // Mientras vuela, el robot va hacia donde quedará su destino
    const r = window.requestAnimationFrame(() => {
      setNarrando(false);
      setFrase(0);
      setVolando(ms > 0);
      anclar();
    });
    return () => {
      vigente = false;
      window.clearTimeout(fin);
      window.cancelAnimationFrame(r);
    };
  }, [cap?.clave, repeticion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si la persona mueve el mapa, el robot sigue a su antena
  useEffect(() => {
    if (!mapa) return;
    return mapa.alMover(() => {
      if (!volando) anclar();
    });
  }, [mapa, volando, anclar]);
  useEffect(() => {
    const fn = () => anclar();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [anclar]);

  // La narración (cuando terminó de volar y si está en reproducción)
  useEffect(() => {
    if (!cap || volando || !reproduciendo) return;
    let vigente = true;
    const inicio = performance.now();
    const empezar = window.requestAnimationFrame(() => vigente && setNarrando(true));
    const total = duracionLectura(cap.guion);
    const largo = frases.map((f) => f.length);
    const suma = largo.reduce((s, x) => s + x, 0) || 1;
    // La frase que va diciendo (estimada por el tiempo, para resaltarla). La IA lo cuenta con sus palabras: ahí no
    // se resalta frase por frase (no coincidiría)
    const reloj = narradorIA
      ? 0
      : window.setInterval(() => {
          const t = (performance.now() - inicio) / total;
          let acum = 0;
          let k = 0;
          for (; k < largo.length - 1; k++) {
            acum += largo[k] / suma;
            if (t < acum) break;
          }
          setFrase(k);
        }, 250);
    const terminar = () => {
      if (!vigente) return;
      window.clearInterval(reloj);
      setNarrando(false);
      setFrase(frases.length);
      const v = vigentes.current;
      if (v.auto) {
        if (v.i < v.total - 1) window.setTimeout(() => vigente && setI((x) => Math.min(x + 1, vigentes.current.total - 1)), 1100);
        else setReproduciendo(false);
      }
    };
    const parar = voz || narradorIA ? narrar(cap.guion, terminar) : (() => {
      const t = window.setTimeout(terminar, total);
      return () => window.clearTimeout(t);
    })();
    cortar.current = parar;
    return () => {
      vigente = false;
      window.cancelAnimationFrame(empezar);
      window.clearInterval(reloj);
      parar();
    };
  }, [cap?.clave, volando, reproduciendo, repeticion]); // eslint-disable-line react-hooks/exhaustive-deps

  const ir = useCallback(
    (n: number) => {
      const k = Math.max(0, Math.min(capitulos.length - 1, n));
      setI(k);
      setReproduciendo(true);
      if (k === i) setRepeticion((x) => x + 1);
    },
    [capitulos.length, i],
  );

  const salir = useCallback(() => {
    cortar.current?.();
    cortar.current = null;
    onSalir();
  }, [onSalir]);

  // Melki (por voz o la IA) también la maneja
  useEffect(() => {
    control.current = {
      pedir: (p) => {
        if (p.comision !== undefined && Number.isFinite(p.comision)) {
          setComision(p.comision > 0 ? p.comision : null);
          setTextoComision(p.comision > 0 ? String(p.comision) : "");
        }
        const buscar = (id: IdCapitulo) => capitulos.findIndex((c) => c.id === id);
        switch (p.accion) {
          case "empezar":
            ir(0);
            return "Empiezo la presentación.";
          case "siguiente":
            if (i >= capitulos.length - 1) return "Ya es el último capítulo.";
            ir(i + 1);
            return `Capítulo ${i + 2} de ${capitulos.length}: ${capitulos[i + 1].titulo}.`;
          case "anterior":
            ir(i - 1);
            return `Capítulo ${Math.max(1, i)} de ${capitulos.length}: ${capitulos[Math.max(0, i - 1)].titulo}.`;
          case "pausar":
            cortar.current?.();
            setReproduciendo(false);
            return "Pausé la presentación.";
          case "seguir":
            setReproduciendo(true);
            setRepeticion((x) => x + 1);
            return "Sigo con la presentación.";
          case "repetir":
            ir(i);
            return "Repito este capítulo.";
          case "terminar":
            salir();
            return "Terminé la presentación.";
          case "ir": {
            const k = p.capitulo ? buscar(p.capitulo) : -1;
            if (k < 0) return "No encontré ese capítulo.";
            ir(k);
            return `Voy a «${capitulos[k].titulo}».`;
          }
        }
      },
    };
    return () => {
      control.current = null;
    };
  }, [capitulos, i, ir, salir, control]);

  // Teclado: ← → espacio Esc
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        ir(i + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        ir(i - 1);
      } else if (e.key === " ") {
        e.preventDefault();
        if (reproduciendo) {
          cortar.current?.();
          setReproduciendo(false);
        } else {
          setReproduciendo(true);
          setRepeticion((x) => x + 1);
        }
      } else if (e.key === "Escape") salir();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [i, ir, reproduciendo, salir]);

  if (!cap) return null;
  const gesto: GestoRobot = volando ? "volando" : narrando ? (cap.id === "portada" ? "saludando" : cap.foco.tipo === "punto" ? "senalando" : "hablando") : "flotando";

  return (
    <div ref={zona} className="pointer-events-none absolute inset-0 z-[35]" role="region" aria-label="Presentación del modelo de negocio" data-tour="pitch">
      {/* La antena de la que se habla late en el mapa */}
      {anillo && !volando && (
        <span className="pitch-anillo absolute h-16 w-16 rounded-full border-4 border-melki" style={{ left: anillo.x, top: anillo.y }} aria-hidden="true" />
      )}
      {/* El robot */}
      {pos && (
        <div className="pitch-robot absolute top-0 left-0" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }} data-robot={gesto}>
          <RobotMelki gesto={gesto} hablando={narrando} mirando={pos.mirando} className="h-32 w-[6.4rem] sm:h-44 sm:w-36" titulo={`Melki ${narrando ? "presentando" : "en la presentación"}`} />
        </div>
      )}
      {/* La tarjeta del capítulo */}
      <div
        ref={tarjeta}
        key={cap.clave}
        className="pitch-tarjeta pointer-events-auto absolute inset-x-3 bottom-[76px] max-h-[46%] overflow-y-auto rounded-2xl bg-papel/95 p-4 shadow-2xl ring-1 ring-black/10 backdrop-blur sm:inset-x-auto sm:top-4 sm:bottom-auto sm:left-4 sm:max-h-[calc(100%-110px)] sm:w-[min(440px,42%)]"
        aria-live="polite"
      >
        <p className="text-[11.5px] font-semibold tracking-wide text-melki-oscura uppercase">
          Pitch · {i + 1} de {capitulos.length}
        </p>
        <h2 className="mt-0.5 font-cond text-[23px] leading-tight font-semibold text-carbon">{cap.titulo}</h2>
        <p className="mt-0.5 text-[13px] text-tenue">{cap.subtitulo}</p>
        {cap.cifras.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {cap.cifras.map((c, k) => (
              <div key={c.etiqueta} className="pitch-cifra rounded-xl bg-white px-3 py-2 ring-1 ring-linea" style={{ animationDelay: `${120 + k * 90}ms` }}>
                <dt className="text-[11.5px] leading-tight text-tenue">{c.etiqueta}</dt>
                <dd className={`font-cond text-[20px] leading-tight font-semibold tabular-nums ${c.tono ? TONOS[c.tono] : "text-carbon"}`}>{c.valor}</dd>
                {c.detalle && <dd className="text-[11px] leading-tight text-tenue">{c.detalle}</dd>}
              </div>
            ))}
          </dl>
        )}
        <p className="mt-3 text-[14px] leading-relaxed text-carbon-2">
          {frases.map((f, k) => (
            <span key={k} className={narradorIA || !narrando ? "" : k === frase ? "rounded bg-melki-clara text-carbon" : k < frase ? "" : "text-tenue"}>
              {f}{" "}
            </span>
          ))}
        </p>
        {cap.id === "equilibrio" && (
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(textoComision.replace(/[^\d]/g, ""));
              setComision(v > 0 ? v : null);
              setRepeticion((x) => x + 1);
            }}
          >
            <label className="flex-1 text-[12.5px] text-carbon-2">
              Probar una comisión por pago (pesos)
              <input
                inputMode="numeric"
                value={textoComision}
                onChange={(e) => setTextoComision(e.target.value)}
                placeholder={`De equilibrio: ${cap.cifras.find((c) => /equilibrio/i.test(c.etiqueta))?.valor ?? ""}`}
                className="mt-1 w-full rounded-lg border border-linea bg-white px-3 py-1.5 text-[14px] text-carbon"
                aria-label="Comisión por pago en pesos"
              />
            </label>
            <button type="submit" className="rounded-lg bg-carbon px-3 py-1.5 text-[13.5px] font-medium text-white hover:bg-carbon-2">
              Calcular
            </button>
          </form>
        )}
      </div>
      {/* Controles */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-3 flex justify-center px-3">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-carbon/92 px-2 py-1.5 text-white shadow-xl ring-1 ring-white/10" role="toolbar" aria-label="Controles de la presentación">
          <BotonCtl titulo="Anterior (←)" onClick={() => ir(i - 1)} deshabilitado={i === 0}>
            <ChevronLeft size={19} />
          </BotonCtl>
          <BotonCtl
            titulo={reproduciendo ? "Pausar (espacio)" : "Seguir (espacio)"}
            onClick={() => {
              if (reproduciendo) {
                cortar.current?.();
                setReproduciendo(false);
              } else {
                setReproduciendo(true);
                setRepeticion((x) => x + 1);
              }
            }}
          >
            {reproduciendo ? <Pause size={18} /> : <Play size={18} />}
          </BotonCtl>
          <BotonCtl titulo="Siguiente (→)" onClick={() => ir(i + 1)} deshabilitado={i >= capitulos.length - 1}>
            <ChevronRight size={19} />
          </BotonCtl>
          <span className="mx-1 hidden items-center gap-1 sm:flex" aria-label="Capítulos">
            {capitulos.map((c, k) => (
              <button
                key={c.clave}
                type="button"
                onClick={() => ir(k)}
                title={c.titulo}
                aria-label={`Capítulo ${k + 1}: ${c.titulo}`}
                aria-current={k === i ? "step" : undefined}
                className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-melki" : k < i ? "w-2 bg-white/70" : "w-2 bg-white/30 hover:bg-white/60"}`}
              />
            ))}
          </span>
          <BotonCtl titulo={auto ? "Avanza solo (toque para avanzar a mano)" : "Avanzar a mano (toque para que avance solo)"} onClick={() => setAuto((v) => !v)} activo={auto}>
            <Repeat size={16} />
          </BotonCtl>
          {!narradorIA && (
            <BotonCtl titulo={voz ? "Silenciar la voz" : "Oír la voz"} onClick={() => onVoz(!voz)} activo={voz}>
              {voz ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </BotonCtl>
          )}
          <BotonCtl titulo="Salir de la presentación (Esc)" onClick={salir}>
            <X size={18} />
          </BotonCtl>
        </div>
      </div>
    </div>
  );
}

function BotonCtl({ titulo, onClick, children, deshabilitado = false, activo }: { titulo: string; onClick: () => void; children: React.ReactNode; deshabilitado?: boolean; activo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-35 ${activo ? "bg-white/15 text-melki-clara" : "hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}
