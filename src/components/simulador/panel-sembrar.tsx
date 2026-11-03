// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Modo «Sembrar la malla» (como en Trama): primero el Gateway + Internet, después los repetidores según la
// distancia y por último la gente. El panel guía paso a paso, muestra el estado de la red, propone repetidores
// automáticamente y deja enviar un mensaje de prueba (un pago, un WhatsApp o una consulta a la IA) para ver cómo viaja
// por la malla MeshCore.
import { BadgeCheck, BookOpenText, Check, ChevronDown, CircleAlert, Flag, LocateFixed, Send, Sparkles, Trash, Undo2, X } from "lucide-react";
import { useEffect, useId, useMemo, useState, type Dispatch, type ReactNode } from "react";

import { numeroLocal, tx } from "@/lib/idioma";
import { alcancePlanoKm } from "@/lib/radio/alcance-plano";
import { consejoRed, type EstadoNodo as EstadoRedNodo, type EstadoRed } from "@/lib/radio/estado-red";
import { INTENTOS, type ViajeMensaje } from "@/lib/radio/mensaje";
import { TERRENOS_TRAMA } from "@/lib/radio/trama";
import type { DestinoSiembra, ResultadoDestino, Siembra } from "@/lib/radio/siembra";
import type { Antena } from "@/lib/radio/tipos";
import { useIdioma } from "@/lib/use-idioma";

import type { Accion, Estado } from "./estado";
import { IconoPieza } from "./icono-torre";
import { ALTURAS_REPETIDOR, AYUDA_PIEZA, NOMBRE_PIEZA, nuevaPieza, piezaDe, PIEZAS, type Pieza } from "./piezas";
import { Boton, CampoNumero, fmt, Interruptor, Segmentado, Titulo } from "./ui";

/** Sembrado automático: buscando, propuesta para aceptar o descartar, o ya puesto (con deshacer). */
export type FaseSiembra =
  | { fase: "nada" }
  | { fase: "buscando"; destinos: DestinoSiembra[]; firma: string }
  | { fase: "propuesta"; destinos: DestinoSiembra[]; siembra: Siembra; alturaM: number; firma: string }
  | { fase: "puesta"; ids: string[]; repetidores: number; persona: boolean }
  | { fase: "error"; texto: string };

export type ViajeVisible = { desde: string; viaje: ViajeMensaje };

const COLOR_RED: Record<EstadoRedNodo, string> = {
  gateway: "#2B2F2E",
  conectado: "#1E7B34",
  lejos: "#F08A2C",
  "sin-cobertura": "#D93A2E",
  aislado: "#F08A2C",
  pendiente: "#9AA19D",
};

const saltosTexto = (n: number | null) => tx(`${n} ${n === 1 ? "salto" : "saltos"}`, `${n} ${n === 1 ? "hop" : "hops"}`);

function textoEstado(e: EstadoRedNodo, saltos: number | null, limite: number): string {
  switch (e) {
    case "gateway":
      return tx("Gateway: aquí entra el internet", "Gateway: the internet comes in here");
    case "conectado":
      return tx(`Conectado · ${saltosTexto(saltos)}`, `Connected · ${saltosTexto(saltos)}`);
    case "lejos":
      return tx(`${saltos} saltos: pasa el límite de ${limite}`, `${saltos} hops: over the limit of ${limite}`);
    case "sin-cobertura":
      return tx("Sin cobertura", "No coverage");
    case "aislado":
      return tx("No alcanza la red", "Can't reach the network");
    case "pendiente":
      return tx("Calculando…", "Calculating…");
  }
}

export const tiempo = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${fmt(ms / 1000, ms < 10000 ? 1 : 0)} s`);
const pct = (p: number) => (p >= 0.999 ? tx("> 99,9 %", "> 99.9%") : tx(`${fmt(p * 100, p >= 0.995 ? 1 : 0)} %`, `${fmt(p * 100, p >= 0.995 ? 1 : 0)}%`));

type Props = {
  estado: Estado;
  despachar: Dispatch<Accion>;
  red: EstadoRed;
  calculando: boolean;
  avance: number | null;
  alturaRepetidor: number;
  onAlturaRepetidor: (m: number) => void;
  siembra: FaseSiembra;
  onConectarFaltantes: () => void;
  onLlevarAPunto: () => void;
  onAceptar: () => void;
  onDescartar: () => void;
  onDeshacer: () => void;
  viaje: ViajeVisible | null;
  onEnviar: (desdeId: string) => void;
  onEjemplo: () => void;
  onVaciar: () => void;
  onCentrar: (lat: number, lon: number) => void;
  /** Al elegir una pieza (en el celular se cierra la hoja para tocar el mapa). */
  onPiezaElegida?: () => void;
  /** Zona de popularidad del gateway o repetidor elegido en la lista. */
  zonaDe?: (a: Antena) => ReactNode;
};

export function PanelSembrar(props: Props) {
  useIdioma();
  const { estado, despachar, red, calculando, avance } = props;
  const antenas = estado.escenario.antenas;
  const limite = estado.escenario.parametros.limiteSaltos;
  const consejo = consejoRed(red, limite, { calculando, autoSimular: estado.autoSimular });
  const armada = estado.herramienta === "agregar" ? estado.pieza : null;

  return (
    <div className="space-y-4">
      <Guia paso={consejo.paso} titulo={consejo.titulo} texto={consejo.texto} tono={consejo.tono} />

      <ComoFunciona abiertoAlInicio={red.gateways.length === 0} />

      <section data-tour="piezas" aria-label={tx("Piezas de la malla", "Mesh pieces")}>
        <Titulo>{tx("Piezas de la malla", "Mesh pieces")}</Titulo>
        <div className="grid grid-cols-3 gap-1.5">
          {PIEZAS.map((p) => {
            const n = p === "gateway" ? red.gateways.length : p === "repetidor" ? red.repetidores.length : red.personas.length;
            const activa = armada === p;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={activa}
                title={AYUDA_PIEZA[p]}
                onClick={() => {
                  despachar(activa ? { tipo: "herramienta", herramienta: "mover" } : { tipo: "pieza", pieza: p });
                  if (!activa) props.onPiezaElegida?.();
                }}
                className={`flex flex-col items-center gap-1 rounded-xl px-1.5 pt-2 pb-1.5 text-center transition-colors ${
                  activa ? "bg-carbon text-white shadow-md" : "bg-white text-carbon ring-1 ring-linea hover:bg-papel-2"
                }`}
              >
                <IconoPieza pieza={p} className="h-8 w-8" />
                <span className="font-cond text-[13.5px] leading-tight font-semibold">{NOMBRE_PIEZA[p]}</span>
                <span className={`text-[11.5px] ${activa ? "text-white/75" : "text-tenue"}`}>{n === 0 ? tx("ninguno", "none") : tx(`${n} ${n === 1 ? "puesto" : "puestos"}`, `${n} placed`)}</span>
              </button>
            );
          })}
        </div>
        {armada ? (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-salvia-clara/70 px-2.5 py-2 text-[13px] leading-snug text-carbon-2" role="status">
            <span className="min-w-0 flex-1">
              <b>{tx("Toque el mapa", "Tap the map")}</b>
              {tx(" para ", " to ")}
              {armada === "gateway" && red.gateways.length
                ? tx("mover el gateway", "move the gateway")
                : tx(
                    `poner ${armada === "persona" ? "una persona" : armada === "gateway" ? "el gateway" : "un repetidor"}`,
                    `place ${armada === "persona" ? "a person" : armada === "gateway" ? "the gateway" : "a repeater"}`,
                  )}
              . {AYUDA_PIEZA[armada]}
            </span>
            <button type="button" onClick={() => despachar({ tipo: "herramienta", herramienta: "mover" })} className="shrink-0 rounded px-1.5 py-0.5 text-[12.5px] font-medium ring-1 ring-linea hover:bg-white">
              {tx("Listo", "Done")}
            </button>
          </p>
        ) : (
          <p className="mt-2 text-[12.5px] leading-snug text-tenue">
            {tx("Toque una pieza y luego el mapa. Las piezas se pueden arrastrar en el mapa para moverlas.", "Tap a piece and then the map. Pieces can be dragged on the map to move them.")}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] text-carbon-2">{tx("Torre de los repetidores nuevos", "Tower for new repeaters")}</span>
          <Segmentado<string>
            etiqueta={tx("Altura de la torre de los repetidores nuevos", "Tower height for new repeaters")}
            valor={String(props.alturaRepetidor)}
            onCambio={(v) => props.onAlturaRepetidor(Number(v))}
            opciones={ALTURAS_REPETIDOR.map((h) => ({ valor: String(h), texto: `${h} m`, titulo: tx(`Torre de ${h} m`, `${h} m tower`) }))}
          />
        </div>
        <AlcanceDeReferencia alturaRepetidor={props.alturaRepetidor} estado={estado} />
      </section>

      <EstadoDeLaRed red={red} limite={limite} calculando={calculando} avance={avance} />
      <div className="-mt-2">
        <Interruptor
          etiqueta={tx("Animar el flujo de la información", "Animate the information flow")}
          detalle={tx("Las líneas avanzan hacia el gateway y cada nodo destella al retransmitir", "The lines move toward the gateway and each node flashes when it retransmits")}
          activo={estado.vista.animarRed}
          onCambio={(v) => despachar({ tipo: "vista", cambios: { animarRed: v } })}
        />
      </div>

      {antenas.length > 0 && <ListaPiezas estado={estado} despachar={despachar} red={red} limite={limite} onCentrar={props.onCentrar} zonaDe={props.zonaDe} />}

      <SembradoAutomatico {...props} />

      <EnviarMensaje red={red} antenas={antenas} viaje={props.viaje} onEnviar={props.onEnviar} limite={limite} />

      <Pie onEjemplo={props.onEjemplo} onVaciar={props.onVaciar} vacio={antenas.length === 0} />
    </div>
  );
}

/** «Cómo funciona»: la guía corta del modo sencillo. */
function ComoFunciona({ abiertoAlInicio }: { abiertoAlInicio: boolean }) {
  useIdioma();
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  return (
    <div className="rounded-xl bg-white ring-1 ring-linea" data-tour="como-funciona">
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex w-full items-center gap-2 px-3 py-2 text-left font-cond text-[14.5px] font-semibold">
        <BookOpenText size={17} className="shrink-0 text-salvia-oscura" />
        <span className="flex-1">{tx("Cómo funciona", "How it works")}</span>
        <ChevronDown size={16} className={`shrink-0 text-tenue transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <div className="space-y-1.5 px-3 pb-3 text-[13px] leading-snug text-carbon-2">
          <p>
            {tx("Ponga el ", "Place the ")}
            <b>Gateway + Internet</b>
            {tx(
              " donde haya luz y señal —la cabecera, una finca—: es la única pieza con conexión (el router va a su lado) y ahí vive la ",
              " where there is power and signal —the town center, a farm—: it is the only piece with a connection (the router goes next to it) and that's where the ",
            )}
            <b>{tx("IA", "AI")}</b>
            {tx(". Ubique ", " lives. Put ")}
            <b>{tx("repetidores", "repeaters")}</b>
            {tx(" en las lomas para llegar lejos y agregue a las ", " on the hills to reach far, and add the ")}
            <b>{tx("personas", "people")}</b>
            {tx(" en el campo. Las que quedan en rojo no tienen cobertura: acérqueles un repetidor.", " in the countryside. Those left in red have no coverage: move a repeater closer to them.")}
          </p>
          <p>
            {tx(
              "Por la red viajan pagos, mensajes de WhatsApp por texto y consultas a la IA, aun donde no hay señal celular. Las líneas turquesa que avanzan muestran por dónde van hacia el gateway: en MeshCore solo los repetidores pasan los paquetes de los demás (las billeteras no retransmiten), normalmente el más cercano con buen enlace. Cada pieza destella al retransmitir y la nube «IA» del gateway se enciende cuando le llega algo.",
              "Payments, WhatsApp text messages and AI queries travel over the network, even where there is no cell signal. The moving turquoise lines show the way they go to the gateway: in MeshCore only repeaters pass on other nodes' packets (wallets don't retransmit), usually the nearest one with a good link. Each piece flashes when it retransmits, and the gateway's “AI” cloud lights up when something reaches it.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/** Alcance de referencia en terreno plano, como el «hasta 10 km» de Trama (el mapa usa el relieve real). */
function AlcanceDeReferencia({ alturaRepetidor, estado }: { alturaRepetidor: number; estado: Estado }) {
  useIdioma();
  const parametros = estado.escenario.parametros;
  const valores = useMemo(() => {
    const gateway = nuevaPieza("gateway", 0, 0, []);
    const repetidor = nuevaPieza("repetidor", 0, 0, [], alturaRepetidor);
    const persona = nuevaPieza("persona", 0, 0, []);
    return {
      gateway: alcancePlanoKm(gateway, persona, parametros, 20),
      repetidor: alcancePlanoKm(repetidor, persona, parametros, 20),
      entreRepetidores: alcancePlanoKm(repetidor, repetidor, parametros, 30),
    };
  }, [alturaRepetidor, parametros]);
  const km = (v: number) => `${v >= 60 ? tx("más de ", "more than ") : "≈ "}${fmt(v, v < 10 ? 1 : 0)} km`;
  return (
    <div className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[12.5px] ring-1 ring-linea" data-tour="alcance-referencia">
      <p className="mb-1 text-[12px] text-tenue">{tx("Alcance en terreno plano y despejado", "Range over flat, open terrain")}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5">
        <dt>{tx("Gateway → gente", "Gateway → people")}</dt>
        <dd className="text-right tabular-nums">{km(valores.gateway)}</dd>
        <dt>{tx(`Repetidor de ${alturaRepetidor} m → gente`, `${alturaRepetidor} m repeater → people`)}</dt>
        <dd className="text-right tabular-nums">{km(valores.repetidor)}</dd>
        <dt>{tx("Repetidor ↔ repetidor (sólido)", "Repeater ↔ repeater (solid)")}</dt>
        <dd className="text-right tabular-nums">{km(valores.entreRepetidores)}</dd>
      </dl>
      <p className="mt-1 text-[11.5px] leading-snug text-tenue">
        {tx(
          `Lomas, árboles y casas lo acortan: el mapa calcula con el relieve real. Trama supone por repetidor ${TERRENOS_TRAMA.plano.radioKm} km en plano, ${TERRENOS_TRAMA.sabana.radioKm} en sabana, ${TERRENOS_TRAMA.montana.radioKm} en montaña o ríos y ${TERRENOS_TRAMA.selva.radioKm} en selva (SF11).`,
          `Hills, trees and houses shorten it: the map calculates with the real terrain. Trama assumes ${TERRENOS_TRAMA.plano.radioKm} km per repeater on flat land, ${TERRENOS_TRAMA.sabana.radioKm} in savanna, ${TERRENOS_TRAMA.montana.radioKm} in mountains or along rivers and ${TERRENOS_TRAMA.selva.radioKm} in jungle (SF11).`,
        )}
      </p>
    </div>
  );
}

function Guia({ paso, titulo, texto, tono }: { paso: number | null; titulo: string; texto: string; tono: "info" | "alerta" | "ok" }) {
  useIdioma();
  const estilo = tono === "ok" ? "bg-[#E3F1E1] ring-[#B9DDB3]" : tono === "alerta" ? "bg-melki-clara ring-[#F2C9AE]" : "bg-white ring-linea";
  return (
    <div className={`rounded-xl p-3 ring-1 ${estilo}`} data-tour="guia-sembrar" role="status" aria-live="polite">
      <p className="flex items-center gap-2 font-cond text-[15.5px] leading-tight font-semibold">
        {paso !== null ? (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-carbon font-sans text-[12.5px] text-white" aria-label={tx(`Paso ${paso}`, `Step ${paso}`)}>
            {paso}
          </span>
        ) : tono === "ok" ? (
          <BadgeCheck size={18} className="shrink-0 text-buena" />
        ) : tono === "alerta" ? (
          <CircleAlert size={18} className="shrink-0 text-melki-oscura" />
        ) : null}
        {titulo}
      </p>
      <p className="mt-1 text-[13.5px] leading-snug text-carbon-2">{texto}</p>
    </div>
  );
}

function Cifra({ valor, etiqueta, color, detalle }: { valor: ReactNode; etiqueta: string; color?: string; detalle?: string }) {
  return (
    <div className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-linea">
      <p className="font-cond text-[20px] leading-tight font-semibold tabular-nums" style={color ? { color } : undefined}>
        {valor}
      </p>
      <p className="text-[11.5px] leading-tight text-tenue">{etiqueta}</p>
      {detalle && <p className="text-[11px] leading-tight text-melki-oscura">{detalle}</p>}
    </div>
  );
}

function EstadoDeLaRed({ red, limite, calculando, avance }: { red: EstadoRed; limite: number; calculando: boolean; avance: number | null }) {
  useIdioma();
  const listo = red.alDia;
  const v = (n: number) => (listo ? n : "—");
  return (
    <section data-tour="estado-red" aria-label={tx("Estado de la red", "Network status")}>
      <Titulo
        accion={
          calculando ? (
            <span className="text-[12.5px] text-tenue tabular-nums">{tx(`Calculando… ${Math.round((avance ?? 0) * 100)} %`, `Calculating… ${Math.round((avance ?? 0) * 100)}%`)}</span>
          ) : null
        }
      >
        {tx("Estado de la red", "Network status")}
      </Titulo>
      <div className="grid grid-cols-3 gap-1.5">
        <Cifra
          valor={v(red.conectadas.length)}
          etiqueta={tx(`conectados de ${red.personas.length}`, `connected out of ${red.personas.length}`)}
          color={listo && red.conectadas.length ? COLOR_RED.conectado : undefined}
        />
        <Cifra
          valor={v(red.sinCobertura.length)}
          etiqueta={tx("sin cobertura", "no coverage")}
          color={listo && red.sinCobertura.length ? COLOR_RED["sin-cobertura"] : undefined}
          detalle={listo && red.lejos.length ? tx(`${red.lejos.length} muy lejos`, `${red.lejos.length} too far`) : undefined}
        />
        <Cifra valor={listo ? fmt(red.areaKm2, red.areaKm2 < 10 ? 1 : 0) : "—"} etiqueta={tx("km² cubiertos", "km² covered")} />
        <Cifra valor={red.repetidores.length} etiqueta={tx("repetidores", "repeaters")} detalle={listo && red.aislados.length ? tx(`${red.aislados.length} sin red`, `${red.aislados.length} off the network`) : undefined} />
        <Cifra valor={v(red.saltosMax)} etiqueta={tx(`saltos máx. (límite ${limite})`, `max. hops (limit ${limite})`)} color={listo && red.saltosMax > limite ? COLOR_RED.lejos : undefined} />
        <Cifra valor={red.gateways.length ? <Check size={20} className="mt-0.5 text-buena" aria-label={tx("Sí", "Yes")} /> : "No"} etiqueta={tx("gateway e internet", "gateway and internet")} />
      </div>
    </section>
  );
}

function ListaPiezas({
  estado,
  despachar,
  red,
  limite,
  onCentrar,
  zonaDe,
}: {
  estado: Estado;
  despachar: Dispatch<Accion>;
  red: EstadoRed;
  limite: number;
  onCentrar: (lat: number, lon: number) => void;
  zonaDe?: (a: Antena) => ReactNode;
}) {
  useIdioma();
  const antenas = estado.escenario.antenas;
  const orden: Record<Pieza, number> = { gateway: 0, repetidor: 1, persona: 2 };
  const [verPobladas, setVerPobladas] = useState(false);
  // Las personas pobladas al azar (pueden ser cientos) van en un solo renglón que se despliega
  const pobladas = antenas.filter((a) => a.poblada);
  const conectadasPobladas = pobladas.filter((a) => red.porNodo.get(a.id)?.estado === "conectado").length;
  const lista = [...antenas].filter((a) => !a.poblada || verPobladas || estado.seleccion === a.id).sort((a, b) => orden[piezaDe(a)] - orden[piezaDe(b)] || Number(Boolean(a.poblada)) - Number(Boolean(b.poblada)));
  return (
    <section data-tour="lista-piezas" aria-label={tx("Lo que ha puesto", "What you've placed")}>
      <Titulo>{tx(`Lo que ha puesto (${antenas.length})`, `What you've placed (${antenas.length})`)}</Titulo>
      {pobladas.length > 0 && (
        <button
          type="button"
          className="mb-1.5 flex w-full items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-left text-[12.5px] ring-1 ring-linea hover:bg-papel-2"
          aria-expanded={verPobladas}
          onClick={() => setVerPobladas((v) => !v)}
        >
          <span>
            <b className="font-cond text-[14px]">{tx(`${numeroLocal(pobladas.length)} personas pobladas al azar`, `${numeroLocal(pobladas.length)} people populated at random`)}</b>
            {red.alDia ? tx(` · ${numeroLocal(conectadasPobladas)} conectadas`, ` · ${numeroLocal(conectadasPobladas)} connected`) : ""}
          </span>
          <span className="shrink-0 text-salvia-oscura">{verPobladas ? tx("Ocultar", "Hide") : tx("Ver", "Show")}</span>
        </button>
      )}
      <ul className="desplazable max-h-64 divide-y divide-linea overflow-y-auto rounded-lg bg-white ring-1 ring-linea">
        {lista.map((a) => {
          const info = red.porNodo.get(a.id);
          const e: EstadoRedNodo = info?.estado ?? (a.pasarela ? "gateway" : "pendiente");
          const sel = estado.seleccion === a.id;
          const pieza = piezaDe(a);
          return (
            <li key={a.id} className={sel ? "bg-salvia-clara/50" : ""}>
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={sel}
                  onClick={() => {
                    despachar({ tipo: "seleccionar", id: sel ? null : a.id });
                    if (!sel) onCentrar(a.lat, a.lon);
                  }}
                >
                  <span className={a.activa ? "" : "opacity-40"} style={{ color: COLOR_RED[e] }}>
                    <IconoPieza pieza={pieza} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-cond text-[14.5px] leading-tight font-semibold">{a.nombre}</span>
                    <span className="block truncate text-[12px] leading-tight" style={{ color: e === "pendiente" ? undefined : COLOR_RED[e] }}>
                      {a.activa ? textoEstado(e, info?.saltos ?? null, limite) : tx("Apagado", "Off")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-tenue hover:bg-sin/10 hover:text-sin"
                  title={tx(`Quitar ${a.nombre}`, `Remove ${a.nombre}`)}
                  aria-label={tx(`Quitar ${a.nombre}`, `Remove ${a.nombre}`)}
                  onClick={() => despachar({ tipo: "eliminar", id: a.id })}
                >
                  <Trash size={15} />
                </button>
              </div>
              {sel && (
                <div className="flex items-end gap-2 border-t border-linea bg-papel/60 px-2.5 pt-2 pb-2.5">
                  <div className="w-28">
                    <CampoNumero
                      etiqueta={pieza === "persona" ? tx("Altura del radio", "Radio height") : tx("Altura de la torre", "Tower height")}
                      unidad="m"
                      valor={a.alturaM}
                      min={0.5}
                      max={300}
                      paso={1}
                      onCambio={(v) => despachar({ tipo: "editar", id: a.id, cambios: { alturaM: v } })}
                    />
                  </div>
                  <Boton variante="fantasma" onClick={() => onCentrar(a.lat, a.lon)}>
                    <LocateFixed size={15} /> {tx("Centrar", "Center")}
                  </Boton>
                </div>
              )}
              {sel && zonaDe && pieza !== "persona" && zonaDe(a) && <div className="bg-papel/60 px-2.5 pb-2.5">{zonaDe(a)}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SembradoAutomatico({ red, siembra, estado, onConectarFaltantes, onLlevarAPunto, onAceptar, onDescartar, onDeshacer }: Props) {
  useIdioma();
  const faltan = red.sinCobertura.length;
  const eligiendo = estado.herramienta === "destino";
  const puede = red.alDia && red.gateways.length > 0;
  return (
    <section data-tour="sembrar-auto" aria-label={tx("Sembrar automático", "Automatic seeding")}>
      <Titulo>{tx("Sembrar automático", "Automatic seeding")}</Titulo>
      <p className="mb-2 text-[13px] leading-snug text-carbon-2">
        {tx(
          "El simulador busca lomas con buen enlace (≥ 30 dB) y propone dónde poner los repetidores. Usted decide si los pone.",
          "The simulator looks for hills with a good link (≥ 30 dB) and proposes where to place the repeaters. You decide whether to place them.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Boton variante="principal" onClick={onConectarFaltantes} deshabilitado={!puede || faltan === 0 || siembra.fase === "buscando"}>
          <Sparkles size={16} /> {tx("Conectar a los que faltan", "Connect the missing ones")}
          {faltan ? ` (${faltan})` : ""}
        </Boton>
        <Boton variante={eligiendo ? "principal" : "secundario"} onClick={onLlevarAPunto} deshabilitado={!puede || siembra.fase === "buscando"}>
          <Flag size={16} /> {eligiendo ? tx("Toque el mapa…", "Tap the map…") : tx("Llevar la red a un punto", "Extend the network to a point")}
        </Boton>
      </div>
      {!red.gateways.length && <p className="mt-1.5 text-[12.5px] text-tenue">{tx("Primero ponga el Gateway + Internet.", "First place the Gateway + Internet.")}</p>}

      {siembra.fase === "buscando" && (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-carbon-2" role="status">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-salvia border-t-transparent" aria-hidden="true" /> {tx("Buscando lomas con buen enlace…", "Looking for hills with a good link…")}
        </p>
      )}
      {siembra.fase === "error" && (
        <p className="mt-2 text-[13px] text-sin" role="alert">
          {siembra.texto}
        </p>
      )}
      {siembra.fase === "propuesta" && <Propuesta siembra={siembra.siembra} destinos={siembra.destinos} alturaM={siembra.alturaM} onAceptar={onAceptar} onDescartar={onDescartar} />}
      {siembra.fase === "puesta" && (
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-[#E3F1E1] px-2.5 py-2 text-[13px] text-carbon-2" role="status">
          <Check size={16} className="shrink-0 text-buena" />
          <span className="min-w-0 flex-1">
            {tx(
              `Se ${siembra.repetidores === 1 ? "puso 1 repetidor" : `pusieron ${siembra.repetidores} repetidores`}`,
              siembra.repetidores === 1 ? "1 repeater was placed" : `${siembra.repetidores} repeaters were placed`,
            )}
            {siembra.persona ? tx(" y una persona en el punto", " and a person at the point") : ""}.
          </span>
          <button type="button" onClick={onDeshacer} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[12.5px] font-medium ring-1 ring-linea hover:bg-white">
            <Undo2 size={13} /> {tx("Deshacer", "Undo")}
          </button>
        </p>
      )}
    </section>
  );
}

function Propuesta({ siembra, destinos, alturaM, onAceptar, onDescartar }: { siembra: Siembra; destinos: DestinoSiembra[]; alturaM: number; onAceptar: () => void; onDescartar: () => void }) {
  useIdioma();
  const n = siembra.puntos.length;
  const llegan = siembra.destinos.filter((d) => d.llega).length;
  const resultado = (d: ResultadoDestino, i: number) => {
    const nombre = destinos[i]?.nombre ?? tx("El punto", "The point");
    const saltos = siembra.saltos?.[i];
    return d.llega
      ? tx(
          `${nombre}: queda con ${fmt(d.margenDb, 0)} dB desde ${d.desde}${saltos ? ` · ${saltos} ${saltos === 1 ? "salto" : "saltos"} al gateway` : ""}`,
          `${nombre}: ends up with ${fmt(d.margenDb, 0)} dB from ${d.desde}${saltos ? ` · ${saltos} ${saltos === 1 ? "hop" : "hops"} to the gateway` : ""}`,
        )
      : `${nombre}: ${d.motivo ?? tx("no se alcanza", "can't be reached")}`;
  };
  const subio = siembra.alturaPedidaM !== undefined && alturaM > siembra.alturaPedidaM;
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-white p-2.5 ring-1 ring-melki/60" data-tour="propuesta">
      <p className="font-cond text-[15px] leading-tight font-semibold">
        {n === 0
          ? tx("No hace falta ningún repetidor", "No repeater is needed")
          : tx(`Propuesta: ${n} ${n === 1 ? "repetidor" : "repetidores"} en torre de ${alturaM} m`, n === 1 ? `Proposal: 1 repeater on a ${alturaM} m tower` : `Proposal: ${n} repeaters on ${alturaM} m towers`)}
      </p>
      {subio && n > 0 && (
        <p className="rounded-md bg-melki-clara px-2 py-1 text-[12px] leading-snug text-carbon">
          {tx(
            `Con torres de ${siembra.alturaPedidaM} m la ruta pasaba del límite de saltos: propongo torres de ${alturaM} m, con pasos más largos.`,
            `With ${siembra.alturaPedidaM} m towers the route went over the hop limit: I propose ${alturaM} m towers, with longer hops.`,
          )}
        </p>
      )}
      {n > 0 && (
        <ol className="space-y-0.5 text-[12.5px] leading-snug text-carbon-2">
          {siembra.puntos.map((q, k) => (
            <li key={q.id}>
              <b>{tx(`Propuesto ${k + 1}`, `Proposed ${k + 1}`)}</b>
              {tx(
                `: suelo a ${Math.round(q.sueloM)} m · ${fmt(q.margenDb, 0)} dB con ${q.desde} a ${fmt(q.distanciaKm, 1)} km`,
                `: ground at ${Math.round(q.sueloM)} m · ${fmt(q.margenDb, 0)} dB with ${q.desde} at ${fmt(q.distanciaKm, 1)} km`,
              )}
            </li>
          ))}
        </ol>
      )}
      <ul className="space-y-0.5 text-[12.5px] leading-snug">
        {siembra.destinos.map((d, i) => (
          <li key={i} className={d.llega ? "text-buena" : "text-sin"}>
            {d.llega ? "✓ " : "✗ "}
            {resultado(d, i)}
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] leading-snug text-tenue">
        {tx(
          "Se ven en el mapa como torres naranjas punteadas. Es una propuesta para revisar en campo: confirme el sitio, el acceso y la línea de vista.",
          "They appear on the map as dotted orange towers. It's a proposal to check in the field: confirm the site, the access and the line of sight.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {n > 0 && (
          <Boton variante="principal" onClick={onAceptar}>
            <Check size={16} /> {tx(`Poner ${n === 1 ? "el repetidor" : `los ${n} repetidores`}`, `Place ${n === 1 ? "the repeater" : `the ${n} repeaters`}`)}
          </Boton>
        )}
        {n === 0 && llegan > 0 && destinos.some((d) => !d.antena) && (
          <Boton variante="principal" onClick={onAceptar}>
            <Check size={16} /> {tx("Poner una persona ahí", "Place a person there")}
          </Boton>
        )}
        <Boton onClick={onDescartar}>
          <X size={16} /> {tx("Descartar", "Discard")}
        </Boton>
      </div>
    </div>
  );
}

function EnviarMensaje({ red, antenas, viaje, onEnviar, limite }: { red: EstadoRed; antenas: Antena[]; viaje: ViajeVisible | null; onEnviar: (id: string) => void; limite: number }) {
  useIdioma();
  const id = useId();
  const candidatos = [...red.personas, ...red.repetidores];
  // Por defecto, la persona conectada más lejana (más saltos); si no hay, la primera persona
  const sugerida = [...red.conectadas, ...red.lejos].sort((a, b) => (red.porNodo.get(b.id)?.saltos ?? 0) - (red.porNodo.get(a.id)?.saltos ?? 0))[0] ?? candidatos[0];
  const [elegida, setElegida] = useState<string | null>(null);
  const desde = candidatos.some((a) => a.id === elegida) ? elegida! : (sugerida?.id ?? "");
  const nombres = new Map(antenas.map((a) => [a.id, a.nombre]));
  const v = viaje?.viaje;
  return (
    <section data-tour="enviar-mensaje" aria-label={tx("Enviar un mensaje de prueba", "Send a test message")}>
      <Titulo>{tx("Enviar un mensaje de prueba", "Send a test message")}</Titulo>
      {candidatos.length === 0 ? (
        <p className="text-[13px] leading-snug text-tenue">{tx("Ponga al menos una persona para enviar un mensaje al gateway.", "Place at least one person to send a message to the gateway.")}</p>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <label htmlFor={id} className="block min-w-0 flex-1">
              <span className="mb-1 block text-[13px] text-carbon-2">{tx("Desde", "From")}</span>
              <select id={id} className="campo" value={desde} onChange={(e) => setElegida(e.target.value)}>
                {candidatos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
            <Boton variante="principal" onClick={() => onEnviar(desde)} deshabilitado={!red.alDia || !desde}>
              <Send size={16} /> {tx("Enviar", "Send")}
            </Boton>
          </div>
          {!red.alDia && <p className="mt-1 text-[12.5px] text-tenue">{tx("Espere a que termine el cálculo de la red.", "Wait for the network calculation to finish.")}</p>}
        </>
      )}
      {v && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-white p-2.5 ring-1 ring-linea" data-tour="viaje-mensaje" role="status">
          <p className={`flex items-center gap-1.5 font-cond text-[15px] font-semibold ${v.llega ? "text-buena" : "text-sin"}`}>
            {v.llega ? <Check size={17} /> : <X size={17} />}
            {v.llega ? tx("El mensaje llega al gateway", "The message reaches the gateway") : tx("El mensaje no llega", "The message doesn't get through")}
          </p>
          {v.motivo && <p className="text-[12.5px] leading-snug text-carbon-2">{v.motivo}</p>}
          {v.ruta.length > 1 && (
            <p className="text-[12.5px] leading-snug text-carbon-2">
              {v.ruta.map((x, i) => (
                <span key={x}>
                  {i > 0 && (
                    <span className="text-tenue">
                      {" "}
                      → <span className="text-[11.5px]">({fmt(v.tramos[i - 1].margenDb, 0)} dB)</span>{" "}
                    </span>
                  )}
                  <b>{nombres.get(x) ?? x}</b>
                </span>
              ))}
            </p>
          )}
          {v.saltos > 0 && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12.5px]">
              <dt className="text-tenue">{tx("Saltos", "Hops")}</dt>
              <dd className="text-right tabular-nums">{tx(`${v.saltos} de ${limite} permitidos`, `${v.saltos} of ${limite} allowed`)}</dd>
              {v.llega && (
                <>
                  <dt className="text-tenue">{tx("Tiempo", "Time")}</dt>
                  <dd className="text-right tabular-nums">
                    ≈ {tiempo(v.totalMs.tipica)}
                    {v.totalMs.max - v.totalMs.min >= 1 ? ` (${tiempo(v.totalMs.min)}–${tiempo(v.totalMs.max)})` : ""}
                  </dd>
                  <dt className="text-tenue">{tx("Llega al primer intento", "Arrives on the first attempt")}</dt>
                  <dd className="text-right tabular-nums">{pct(v.probabilidad)}</dd>
                  <dt className="text-tenue">{tx(`Con los ${INTENTOS} intentos`, `With all ${INTENTOS} attempts`)}</dt>
                  <dd className="text-right tabular-nums">{pct(v.probabilidadReintentos)}</dd>
                  <dt className="text-tenue">{tx("Respuesta", "Reply")}</dt>
                  <dd className="text-right tabular-nums">{tx(`≈ ${tiempo(v.totalMs.tipica)} de vuelta`, `≈ ${tiempo(v.totalMs.tipica)} back`)}</dd>
                </>
              )}
            </dl>
          )}
          <p className="text-[11.5px] leading-snug text-tenue">
            {tx(
              `${v.preset} · ${v.bytes} bytes (el tamaño de una orden de pago) · ${tiempo(v.aireMs)} en el aire por salto. Con la ruta aprendida va directo: cada repetidor espera un turno al azar y la pasa al siguiente; si no vuelve el acuse, se reintenta (el último intento, por inundación).`,
              `${v.preset} · ${v.bytes} bytes (the size of a payment order) · ${tiempo(v.aireMs)} on air per hop. With the learned route it goes direct: each repeater waits a random turn and passes it to the next one; if the acknowledgment doesn't come back, it retries (the last attempt by flooding).`,
            )}
            {v.llega
              ? tx(
                  " El gateway lo pasa por Starlink —el pago se verifica con el banco, el WhatsApp sale a internet y la consulta va a la IA— y la respuesta vuelve por la misma ruta (más lo que tarde el banco o la IA).",
                  " The gateway sends it over Starlink —the payment is verified with the bank, the WhatsApp message goes out to the internet and the query goes to the AI— and the reply comes back along the same route (plus whatever the bank or the AI takes).",
                )
              : ""}
          </p>
        </div>
      )}
    </section>
  );
}

function Pie({ onEjemplo, onVaciar, vacio }: { onEjemplo: () => void; onVaciar: () => void; vacio: boolean }) {
  useIdioma();
  // «Vaciar» pide una segunda confirmación en el mismo botón (sin ventanas emergentes)
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => {
    if (!confirmar) return;
    const t = window.setTimeout(() => setConfirmar(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmar]);
  return (
    <div className="flex flex-wrap gap-2 border-t border-linea pt-3">
      <Boton onClick={onEjemplo}>
        <Sparkles size={16} /> {tx("Ejemplo de malla", "Example mesh")}
      </Boton>
      {!vacio && (
        <Boton
          variante="peligro"
          className={confirmar ? "bg-sin/10" : ""}
          onClick={() => {
            if (confirmar) {
              setConfirmar(false);
              onVaciar();
            } else setConfirmar(true);
          }}
        >
          <Trash size={16} /> {confirmar ? tx("¿Seguro? Vaciar todo", "Sure? Clear everything") : tx("Vaciar", "Clear")}
        </Boton>
      )}
    </div>
  );
}
