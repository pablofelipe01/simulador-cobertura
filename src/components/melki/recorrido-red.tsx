// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// El recorrido de la red con el robot de Melki: vuela de punto en punto (la cámara lo sigue), señala cada antena y de
// ella sale una nube que escribe qué se instaló, por qué ahí y qué papel cumple; la voz dice solo lo breve. Un punto a
// la vez, sin llenar el mapa. Se maneja con los botones, el teclado (← → espacio Esc) o pidiéndoselo a Melki
// («siguiente», «ve al gateway», «¿por qué la red quedó así?», «termina el recorrido»).
import { ChevronLeft, ChevronRight, Pause, Play, Repeat, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MapaPitch } from "@/lib/negocio/pitch";
import { buscarParada, type ParadaRecorrido, type PedidoRecorrido } from "@/lib/negocio/recorrido-red";

import { anchoNube, NubeMapa } from "./nube-mapa";
import { BotonCtl, type Narrador } from "./presentacion";
import { RobotMelki, type GestoRobot } from "./robot";

export type ControlRecorrido = { pedir: (p: PedidoRecorrido) => string };

/** El tiempo para leer una nube (ms): unas 1.400 letras por minuto, entre 6 y 45 s. */
const tiempoLectura = (p: ParadaRecorrido) => Math.min(45000, Math.max(6000, p.nube.parrafos.reduce((s, x) => s + x.length, 0) * 42));

export function RecorridoRed({
  armar,
  mapa,
  narrar,
  voz,
  onVoz,
  onSalir,
  onTerminado,
  onPedir,
  controlRef,
  narradorIA = false,
  desde,
}: {
  /** Arma las paradas con la red de ahora. */
  armar: () => ParadaRecorrido[];
  mapa: MapaPitch | null;
  /** Dice en voz alta lo breve de cada parada (con la voz del equipo o la de la IA). */
  narrar: Narrador;
  voz: boolean;
  onVoz: (v: boolean) => void;
  onSalir: () => void;
  /** Llegó al último punto (para dejar el resumen escrito en la conversación). */
  onTerminado?: (paradas: ParadaRecorrido[]) => void;
  /** Un pedido para Melki desde una nube («conecta a los que faltan»). */
  onPedir?: (pedido: string) => void;
  /** Para que Melki (por voz, por escrito o desde la IA) maneje el recorrido. */
  controlRef: React.MutableRefObject<ControlRecorrido | null>;
  /** Lo narra la IA (Gemini) con su voz. */
  narradorIA?: boolean;
  /** Por dónde empezar («el Repetidor 2», «por qué quedó así»). */
  desde?: string;
}) {
  const paradas = useMemo(() => armar(), [armar]);
  const [i, setI] = useState(() => {
    const k = desde ? buscarParada(paradas, desde) : 0;
    return k > 0 ? k : 0;
  });
  const [reproduciendo, setReproduciendo] = useState(true);
  const [auto, setAuto] = useState(true);
  const [narrando, setNarrando] = useState(false);
  const [repeticion, setRepeticion] = useState(0);
  /** La vuelta (parada y repetición) a la que ya llegó la cámara: mientras no, el robot vuela y no hay nube. */
  const [llego, setLlego] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; mirando: "derecha" | "izquierda" } | null>(null);
  const [punto, setPunto] = useState<{ x: number; y: number } | null>(null);
  const [zonaTam, setZonaTam] = useState<{ ancho: number; alto: number } | null>(null);
  /** La vuelta (parada y repetición) que ya terminó de escribirse y de decirse. */
  const [escrito, setEscrito] = useState<string | null>(null);
  const [narrado, setNarrado] = useState<string | null>(null);
  const zona = useRef<HTMLDivElement>(null);
  const cortar = useRef<(() => void) | null>(null);
  const aparecio = useRef(0);
  const terminado = useRef(false);
  /** El primer vuelo espera a que el mapa termine de agrandarse (se acaban de ocultar los paneles). */
  const primerVuelo = useRef(true);
  const k = Math.max(0, Math.min(i, paradas.length - 1));
  const parada = paradas[k];
  const vuelta = `${parada?.clave ?? ""}-${repeticion}`;
  const volando = llego !== vuelta;

  /** Dónde va el robot: junto al punto, del lado contrario a la nube; sin punto, la nube sale de él. */
  const anclar = useCallback(() => {
    const z = zona.current;
    if (!parada || !z) return;
    const ancho = z.clientWidth;
    const alto = z.clientHeight;
    setZonaTam((t) => (t && t.ancho === ancho && t.alto === alto ? t : { ancho, alto }));
    const celular = ancho < 640;
    const W = anchoNube(ancho);
    const p = parada.ancla && mapa ? mapa.proyectar(parada.ancla.lat, parada.ancla.lon) : null;
    if (p) {
      setPunto(p);
      if (celular) setPos({ x: Math.max(4, Math.min(ancho - 108, p.x - 112)), y: Math.max(6, p.y - 132), mirando: "derecha" });
      else setPos(p.x + 58 + W <= ancho - 12 ? { x: p.x - 150, y: p.y - 170, mirando: "derecha" } : { x: p.x + 30, y: p.y - 170, mirando: "izquierda" });
      return;
    }
    setPunto(null);
    setPos(celular ? { x: ancho - 112, y: 56, mirando: "izquierda" } : { x: Math.max(16, ancho - W - 232), y: Math.max(20, alto * 0.28), mirando: "derecha" });
  }, [parada, mapa]);

  // Cada parada: la cámara vuela dejando libre el lado de la nube; el robot va con ella
  useEffect(() => {
    if (!parada) return;
    cortar.current?.();
    cortar.current = null;
    const esta = vuelta;
    let vigente = true;
    let fin = 0;
    const volar = () => {
      if (!vigente) return;
      const z = zona.current;
      const ancho = z?.clientWidth ?? 1200;
      const alto = z?.clientHeight ?? 800;
      const W = anchoNube(ancho);
      const margen =
        ancho < 640
          ? { izquierda: 24, derecha: 24, arriba: 70, abajo: Math.min(440, alto * 0.52) }
          : parada.ancla
            ? { izquierda: 180, derecha: W + 90, arriba: 80, abajo: 110 }
            : { izquierda: 70, derecha: W + 262, arriba: 80, abajo: 110 };
      const ms = mapa ? mapa.volar(parada.foco, margen) : 0;
      fin = window.setTimeout(
        () => {
          if (!vigente) return;
          aparecio.current = performance.now();
          setLlego(esta);
          anclar();
        },
        Math.max(60, ms + 80),
      );
    };
    const espera = window.setTimeout(volar, primerVuelo.current ? 350 : 0);
    primerVuelo.current = false;
    // Mientras vuela, el robot va hacia donde quedará su destino
    const r = window.requestAnimationFrame(() => {
      setNarrando(false);
      anclar();
    });
    return () => {
      vigente = false;
      window.clearTimeout(espera);
      window.clearTimeout(fin);
      window.cancelAnimationFrame(r);
    };
  }, [parada?.clave, repeticion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si la persona mueve el mapa o cambia la ventana, el robot y la nube siguen a su punto
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

  // La voz: lo breve de la parada, cuando la cámara llegó (si está en reproducción)
  useEffect(() => {
    if (!parada || volando || !reproduciendo) return;
    let vigente = true;
    const esta = vuelta;
    const empezar = window.requestAnimationFrame(() => vigente && setNarrando(true));
    const terminar = () => {
      if (!vigente) return;
      setNarrando(false);
      setNarrado(esta);
    };
    const parar =
      voz || narradorIA
        ? narrar(parada.voz, terminar)
        : (() => {
            const t = window.setTimeout(terminar, 300);
            return () => window.clearTimeout(t);
          })();
    cortar.current = parar;
    return () => {
      vigente = false;
      window.cancelAnimationFrame(empezar);
      parar();
    };
  }, [parada?.clave, volando, reproduciendo, repeticion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escrita y dicha: deja leerla y sigue con la próxima (avanza solo); en la última, deja el resumen escrito
  const ultima = k >= paradas.length - 1;
  const lista = !volando && escrito === vuelta && narrado === vuelta;
  useEffect(() => {
    if (!parada || !lista || (!(reproduciendo && auto) && !ultima)) return;
    const espera = Math.max(1200, aparecio.current + tiempoLectura(parada) - performance.now());
    const t = window.setTimeout(() => {
      if (!ultima) {
        if (reproduciendo && auto) setI(k + 1);
        return;
      }
      setReproduciendo(false);
      if (!terminado.current) {
        terminado.current = true;
        onTerminado?.(paradas);
      }
    }, espera);
    return () => window.clearTimeout(t);
  }, [lista, reproduciendo, auto, ultima, k]); // eslint-disable-line react-hooks/exhaustive-deps

  const ir = useCallback(
    (n: number) => {
      const j = Math.max(0, Math.min(paradas.length - 1, n));
      setI(j);
      setReproduciendo(true);
      if (j === k) setRepeticion((x) => x + 1);
    },
    [paradas.length, k],
  );

  const salir = useCallback(() => {
    cortar.current?.();
    cortar.current = null;
    onSalir();
  }, [onSalir]);

  // Pausa y sigue sin volver a escribir la nube (al seguir, repite solo lo breve en voz)
  const alternar = useCallback(() => {
    if (reproduciendo) cortar.current?.();
    setReproduciendo(!reproduciendo);
  }, [reproduciendo]);

  // Melki (por voz, por escrito o la IA) también lo maneja
  useEffect(() => {
    controlRef.current = {
      pedir: (p) => {
        switch (p.accion) {
          case "empezar": {
            const j = p.parada ? buscarParada(paradas, p.parada) : 0;
            ir(j > 0 ? j : 0);
            return j > 0 ? `Voy a «${paradas[j].titulo}».` : "Empiezo el recorrido de la red.";
          }
          case "siguiente":
            if (k >= paradas.length - 1) return "Ya es el último punto del recorrido.";
            ir(k + 1);
            return `Punto ${k + 2} de ${paradas.length}: ${paradas[k + 1].titulo}.`;
          case "anterior":
            ir(k - 1);
            return `Punto ${Math.max(1, k)} de ${paradas.length}: ${paradas[Math.max(0, k - 1)].titulo}.`;
          case "pausar":
            cortar.current?.();
            setReproduciendo(false);
            return "Pausé el recorrido.";
          case "seguir":
            setReproduciendo(true);
            return "Sigo con el recorrido.";
          case "repetir":
            ir(k);
            return "Repito este punto.";
          case "terminar":
            salir();
            return "Terminé el recorrido de la red.";
          case "ir": {
            const j = buscarParada(paradas, p.parada ?? "");
            if (j < 0) return `No encontré ese punto. Las paradas son: ${paradas.map((x) => x.titulo).join(", ")}.`;
            ir(j);
            return `Voy a «${paradas[j].titulo}».`;
          }
        }
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [paradas, k, ir, salir, controlRef]);

  // Teclado: ← → espacio Esc
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        ir(k + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        ir(k - 1);
      } else if (e.key === " ") {
        e.preventDefault();
        alternar();
      } else if (e.key === "Escape") salir();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [k, ir, alternar, salir]);

  if (!parada) return null;
  const gesto: GestoRobot = volando ? "volando" : narrando ? (parada.id === "panorama" ? "saludando" : punto ? "senalando" : "hablando") : "flotando";
  const celular = (zonaTam?.ancho ?? 1200) < 640;
  // Sin punto, la nube sale del robot (de su cabeza en el computador; de abajo en el celular)
  const anclaNube = punto ?? (pos ? (celular ? { x: pos.x + 51, y: pos.y + 118 } : { x: pos.x + 116, y: pos.y + 58 }) : null);

  return (
    <div ref={zona} className="pointer-events-none absolute inset-0 z-[35]" role="region" aria-label="Recorrido de la red" data-tour="recorrido-red" data-parada={parada.clave}>
      {/* El punto del que se habla late en el mapa */}
      {punto && !volando && <span className="pitch-anillo absolute h-16 w-16 rounded-full border-4 border-melki" style={{ left: punto.x, top: punto.y }} aria-hidden="true" />}
      {pos && (
        <div className="pitch-robot absolute top-0 left-0" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }} data-robot={gesto}>
          <RobotMelki gesto={gesto} hablando={narrando} mirando={pos.mirando} className="h-32 w-[6.4rem] sm:h-44 sm:w-36" titulo={`Melki ${narrando ? "explicando la red" : "en el recorrido de la red"}`} />
        </div>
      )}
      {!volando && zonaTam && anclaNube && (
        <NubeMapa
          key={vuelta}
          ancla={anclaNube}
          zona={zonaTam}
          reservaAbajo={celular ? 122 : 96}
          paso={`Recorrido · ${k + 1} de ${paradas.length}`}
          etiqueta={parada.nube.etiqueta}
          titulo={parada.nube.titulo}
          subtitulo={parada.nube.subtitulo}
          parrafos={parada.nube.parrafos}
          datos={parada.nube.datos}
          escribir
          onEscrito={() => setEscrito(vuelta)}
          sugerencia={parada.nube.sugerencia}
          onSugerencia={onPedir}
        />
      )}
      {/* Controles */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-3 flex justify-center px-3">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-carbon/92 px-2 py-1.5 text-white shadow-xl ring-1 ring-white/10" role="toolbar" aria-label="Controles del recorrido">
          <BotonCtl titulo="Anterior (←)" onClick={() => ir(k - 1)} deshabilitado={k === 0}>
            <ChevronLeft size={19} />
          </BotonCtl>
          <BotonCtl titulo={reproduciendo ? "Pausar (espacio)" : "Seguir (espacio)"} onClick={alternar}>
            {reproduciendo ? <Pause size={18} /> : <Play size={18} />}
          </BotonCtl>
          <BotonCtl titulo="Siguiente (→)" onClick={() => ir(k + 1)} deshabilitado={k >= paradas.length - 1}>
            <ChevronRight size={19} />
          </BotonCtl>
          <span className="mx-1 hidden items-center gap-1 sm:flex" aria-label="Puntos del recorrido">
            {paradas.map((p, j) => (
              <button
                key={p.clave}
                type="button"
                onClick={() => ir(j)}
                title={p.titulo}
                aria-label={`Punto ${j + 1}: ${p.titulo}`}
                aria-current={j === k ? "step" : undefined}
                className={`h-2 rounded-full transition-all ${j === k ? "w-6 bg-melki" : j < k ? "w-2 bg-white/70" : "w-2 bg-white/30 hover:bg-white/60"}`}
              />
            ))}
          </span>
          <span className="hidden max-w-[230px] truncate px-1.5 text-[12.5px] text-white/85 lg:inline">
            {k + 1} de {paradas.length} · {parada.titulo}
          </span>
          <BotonCtl titulo={auto ? "Avanza solo (toque para avanzar a mano)" : "Avanzar a mano (toque para que avance solo)"} onClick={() => setAuto((v) => !v)} activo={auto}>
            <Repeat size={16} />
          </BotonCtl>
          {!narradorIA && (
            <BotonCtl titulo={voz ? "Silenciar la voz" : "Oír la voz"} onClick={() => onVoz(!voz)} activo={voz}>
              {voz ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </BotonCtl>
          )}
          <BotonCtl titulo="Salir del recorrido (Esc)" onClick={salir}>
            <X size={18} />
          </BotonCtl>
        </div>
      </div>
    </div>
  );
}
