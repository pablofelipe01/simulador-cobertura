// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Melki llega volando: cuando se le pide ir a un lugar («ubícame en Barranca de Upía»), a una coordenada o a una
// antena, en vez del punto rojo el robot sale de su esquina cuando la cámara llega, vuela hasta el sitio y saluda (en
// un lugar) o lo señala (en una coordenada o una antena). De ahí sale su nube, que escribe al ritmo de lectura qué hay
// ahí y qué se puede hacer (con el botón de la sugerencia). Al terminar de escribir, una barra cuenta unos segundos
// (con el puntero encima, espera) y Melki vuelve a su esquina. La X de la nube o Esc lo mandan de vuelta antes; si el
// mapa se mueve, el robot y la nube siguen al sitio. Si la conversación abierta deja muy poco mapa libre, la nube no
// cabe: Melki llega, saluda y vuelve (lo que responde ya está escrito en la conversación).
import { useCallback, useEffect, useRef, useState } from "react";

import type { MapaPitch } from "@/lib/negocio/pitch";

import { anchoNube, ESCRITURA_LECTURA, NubeMapa, pausaLectura } from "./nube-mapa";
import type { LlegadaMelki } from "./ordenes";
import { RobotMelki, type GestoRobot } from "./robot";

type Fase = "espera" | "vuela" | "llego" | "vuelve";
type Pos = { x: number; y: number; mirando: "derecha" | "izquierda" };

/** Lo que tarda el vuelo (el mismo de `.pitch-robot` en globals.css). */
const VUELO_MS = 1900;
/** Cuánto saluda con la mano antes de señalar el sitio. */
const SALUDO_MS = 2600;
/** Sin nube (no cabe junto a la conversación): cuánto se queda en el sitio. */
const SIN_NUBE_MS = 5200;
/** El ancho libre mínimo (px) para la nube (300) con su línea y un margen. */
const ANCHO_CON_NUBE = 372;

const reducirMovimiento = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function LlegadaRobot({
  llegada,
  mapa,
  saludo,
  reservaDerecha = 0,
  sugerencia,
  onSugerencia,
  onFin,
}: {
  llegada: LlegadaMelki & { n: number };
  mapa: MapaPitch | null;
  /** «¡Hola, señor!»: va delante de lo que escribe cuando saluda (en un lugar). */
  saludo: string;
  /** Lo que se deja libre a la derecha en el computador (la conversación abierta). */
  reservaDerecha?: number;
  /** El botón de la nube (la primera opción de la respuesta). */
  sugerencia?: string;
  onSugerencia?: () => void;
  /** Ya volvió a su esquina. */
  onFin: () => void;
}) {
  const zona = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<Fase>("espera");
  const [tam, setTam] = useState<{ ancho: number; alto: number } | null>(null);
  const [punto, setPunto] = useState<{ x: number; y: number } | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [saluda, setSaluda] = useState(llegada.gesto === "saludando");
  const [escrito, setEscrito] = useState(false);
  const [sobre, setSobre] = useState(false);
  /** Lo que falta de la pausa de lectura (se conserva con el puntero encima). */
  const restante = useRef<number | null>(null);

  /** El área libre: en el computador, sin lo que ocupa la conversación a la derecha. */
  const util = useCallback(
    (ancho: number, alto: number) => ({ ancho: ancho < 640 ? ancho : Math.max(200, ancho - reservaDerecha), alto }),
    [reservaDerecha],
  );
  /** ¿Cabe la nube? En el celular siempre (va abajo); en el computador, si queda mapa libre junto a la conversación. */
  const cabeNube = (ancho: number, alto: number) => ancho < 640 || util(ancho, alto).ancho >= ANCHO_CON_NUBE;

  /** Su esquina: abajo a la derecha del área libre (de ahí sale y ahí vuelve). */
  const casa = useCallback(
    (ancho: number, alto: number): Pos => {
      const u = util(ancho, alto);
      return ancho < 640 ? { x: ancho - 116, y: alto - 250, mirando: "izquierda" } : { x: u.ancho - 168, y: alto - 262, mirando: "izquierda" };
    },
    [util],
  );

  /** Junto al sitio, del lado contrario a la nube (la nube va al lado libre). */
  const junto = useCallback(
    (p: { x: number; y: number }, ancho: number, alto: number): Pos => {
      const u = util(ancho, alto);
      if (ancho < 640) return { x: Math.max(4, Math.min(ancho - 108, p.x - 112)), y: Math.max(6, p.y - 132), mirando: "derecha" };
      const W = anchoNube(u.ancho);
      // Sin nube, a la izquierda del sitio (lejos de la conversación), mirándolo
      if (u.ancho < ANCHO_CON_NUBE) return { x: p.x - 150, y: p.y - 170, mirando: "derecha" };
      return p.x + 58 + W <= u.ancho - 12 ? { x: p.x - 150, y: p.y - 170, mirando: "derecha" } : { x: p.x + 30, y: p.y - 170, mirando: "izquierda" };
    },
    [util],
  );

  /** Mide la zona y proyecta el sitio; con `seguir`, el robot va junto a él. Devuelve si el sitio está a la vista. */
  const medir = useCallback(
    (seguir: boolean): boolean => {
      const z = zona.current;
      if (!z) return false;
      const ancho = z.clientWidth;
      const alto = z.clientHeight;
      setTam((t) => (t && t.ancho === ancho && t.alto === alto ? t : { ancho, alto }));
      const p = mapa?.proyectar(llegada.lat, llegada.lon) ?? null;
      const u = util(ancho, alto);
      const visible = !!p && p.x >= -30 && p.y >= -30 && p.x <= u.ancho + 30 && p.y <= alto + 30;
      setPunto(p);
      if (seguir && p) setPos(junto(p, ancho, alto));
      return visible;
    },
    [mapa, llegada.lat, llegada.lon, util, junto],
  );

  // Al empezar: el robot espera en su esquina (aún invisible) a que la cámara llegue al sitio; cuando el mapa se
  // queda quieto, despega
  useEffect(() => {
    const z = zona.current;
    if (z) setPos(casa(z.clientWidth, z.clientHeight));
    let vigente = true;
    let hecho = false;
    let quieto = 0;
    const despegar = () => {
      if (!vigente || hecho) return;
      hecho = true;
      setFase("vuela");
    };
    const revisar = () => {
      window.clearTimeout(quieto);
      quieto = window.setTimeout(despegar, 280);
    };
    const quitar = mapa?.alMover(revisar);
    const minimo = window.setTimeout(revisar, 850);
    const maximo = window.setTimeout(despegar, 2600);
    return () => {
      vigente = false;
      window.clearTimeout(quieto);
      window.clearTimeout(minimo);
      window.clearTimeout(maximo);
      quitar?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // El vuelo al sitio (si el sitio no está a la vista, vuelve)
  useEffect(() => {
    if (fase !== "vuela") return;
    const ver = medir(true);
    const t = window.setTimeout(() => setFase(ver ? "llego" : "vuelve"), ver ? (reducirMovimiento() ? 300 : VUELO_MS + 60) : 0);
    return () => window.clearTimeout(t);
  }, [fase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saluda con la mano y luego señala el sitio
  useEffect(() => {
    if (fase !== "llego" || !saluda) return;
    const t = window.setTimeout(() => setSaluda(false), SALUDO_MS);
    return () => window.clearTimeout(t);
  }, [fase, saluda]);

  // Escrita: unos segundos para terminar de leer (la barra los cuenta; con el puntero encima, espera) y vuelve
  const parrafos = llegada.gesto === "saludando" && saludo ? [`${saludo} ${llegada.parrafos[0] ?? ""}`.trim(), ...llegada.parrafos.slice(1)] : llegada.parrafos;
  const pausa = pausaLectura(parrafos);
  const conNube = !tam || cabeNube(tam.ancho, tam.alto);
  useEffect(() => {
    if (fase !== "llego" || conNube) return;
    const t = window.setTimeout(() => setFase("vuelve"), SIN_NUBE_MS);
    return () => window.clearTimeout(t);
  }, [fase, conNube]);
  useEffect(() => {
    if (fase !== "llego" || !escrito || sobre) return;
    const ms = restante.current ?? pausa;
    const desde = performance.now();
    const t = window.setTimeout(() => setFase("vuelve"), Math.max(250, ms));
    return () => {
      window.clearTimeout(t);
      restante.current = Math.max(0, ms - (performance.now() - desde));
    };
  }, [fase, escrito, sobre, pausa]);

  // La vuelta a su esquina; al llegar, se va
  useEffect(() => {
    if (fase !== "vuelve") return;
    const z = zona.current;
    if (z) setPos(casa(z.clientWidth, z.clientHeight));
    const t = window.setTimeout(onFin, reducirMovimiento() ? 350 : VUELO_MS + 100);
    return () => window.clearTimeout(t);
  }, [fase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si la persona mueve el mapa o cambia la ventana, el robot y la nube siguen al sitio; si el sitio sale de la
  // pantalla, Melki vuelve a su esquina
  useEffect(() => {
    if (fase !== "vuela" && fase !== "llego") return;
    const seguir = () => {
      if (!medir(true) && fase === "llego") setFase("vuelve");
    };
    const quitar = mapa?.alMover(seguir);
    window.addEventListener("resize", seguir);
    return () => {
      quitar?.();
      window.removeEventListener("resize", seguir);
    };
  }, [fase, mapa, medir]);

  // Esc lo manda de vuelta (salvo escribiendo en una caja de texto)
  useEffect(() => {
    if (fase === "vuelve") return;
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "Escape" || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      setFase("vuelve");
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [fase]);

  const visible = fase === "vuela" || fase === "llego";
  const gesto: GestoRobot = fase === "llego" ? (saluda ? "saludando" : "senalando") : "volando";
  const celular = (tam?.ancho ?? 1200) < 640;
  const area = tam ? util(tam.ancho, tam.alto) : null;

  return (
    <div ref={zona} className="pointer-events-none absolute inset-0 z-[34]" role="region" aria-label={`Melki en ${llegada.titulo}`} data-tour="llegada-melki" data-fase={fase} data-gesto={gesto} data-con-nube={conNube ? "si" : "no"}>
      {/* El sitio exacto late en el mapa (una coordenada o una antena) */}
      {punto && fase === "llego" && llegada.gesto === "senalando" && <span className="pitch-anillo absolute h-16 w-16 rounded-full border-4 border-melki" style={{ left: punto.x, top: punto.y }} aria-hidden="true" />}
      {pos && (
        <div
          className="pitch-robot absolute top-0 left-0"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, opacity: visible ? 1 : 0, transitionDelay: fase === "vuelve" ? "0s, 1.4s" : undefined }}
          data-robot={gesto}
        >
          <RobotMelki gesto={gesto} mirando={pos.mirando} className="h-32 w-[6.4rem] sm:h-44 sm:w-36" titulo={fase === "llego" ? `Melki ${saluda ? "saludando" : "señalando"} en ${llegada.titulo}` : "Melki volando"} />
        </div>
      )}
      {fase === "llego" && area && punto && conNube && (
        <NubeMapa
          key={llegada.n}
          ancla={punto}
          zona={area}
          reservaAbajo={celular ? 96 : 40}
          etiqueta={llegada.etiqueta}
          titulo={llegada.titulo}
          subtitulo={llegada.subtitulo}
          parrafos={parrafos}
          escribir
          onEscrito={() => setEscrito(true)}
          sugerencia={sugerencia && onSugerencia ? { texto: sugerencia, pedido: sugerencia } : undefined}
          onSugerencia={onSugerencia ? () => onSugerencia() : undefined}
          msPorLetra={ESCRITURA_LECTURA.msPorLetra}
          maxMs={ESCRITURA_LECTURA.maxMs}
          cuenta={escrito ? { ms: pausa, pausada: sobre } : null}
          onSobre={setSobre}
          onCerrar={() => setFase("vuelve")}
          etiquetaCerrar="Cerrar (Melki vuelve a su lugar)"
        />
      )}
    </div>
  );
}
