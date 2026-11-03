// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Zonas de popularidad y prueba de estrés de la hora pico. Una zona de popularidad pone N personas alrededor de un
// gateway o repetidor (o de todos) para ver cuánto aguanta cada uno; la prueba de estrés hace que todas usen la red a
// su ritmo en la hora pico (pagos, WhatsApp y consultas a la IA) y mide, repetidor por repetidor, mensajes completos,
// espera, canal, ciclo de trabajo, colas,
// alcance con carga y energía; la rampa sube la carga hasta encontrar dónde se revienta cada zona.
import { Activity, BatteryCharging, ChevronDown, Flame, Gauge, MapPin, MapPinned, Radio, Sparkles, Trash, TrendingUp, Undo2, UserCheck, Users, Wrench } from "lucide-react";
import { useState } from "react";

import { numeroLocal, tx } from "@/lib/idioma";
import { presetPorId } from "@/lib/radio/constantes";
import {
  CAUSAS_USUARIO,
  curvaDe,
  ENERGIA_P1,
  ESTADOS_USUARIO,
  ESTRES_MEDIDO,
  ORDEN_ESTADOS_USUARIO,
  PEDIDO_ESTRES_DEFECTO,
  TOPE_CICLO_PCT,
  TOPE_PERSONAS_PUNTO,
  type CausaUsuario,
  type EstadoUsuario,
  type EstadoZona,
  type LimitePunto,
  type LimiteZona,
  type ResultadoEstres,
  type ZonaEstres,
} from "@/lib/radio/estres";
import type { MedidaRed, PropuestaOptimizar, ResultadoOptimizar } from "@/lib/radio/optimizar";
import { FICHA_GATEWAY, FONDO_MT, PROTOCOLOS, TRAFICO_MEDIDO, type CurvaEnlace, type PerfilTrafico } from "@/lib/radio/protocolos";
import { CAPACIDAD_TRAMA } from "@/lib/radio/trama";
import type { Parametros } from "@/lib/radio/tipos";
import { useIdioma } from "@/lib/use-idioma";

import { Boton, fmt, Interruptor, Segmentado, Titulo } from "./ui";

/* ───────────── Zonas de popularidad ───────────── */

/** Gateway o repetidor alrededor del cual se puede poner una zona, con las personas que ya tiene. */
export type CentroZona = { id: string; nombre: string; pieza: "gateway" | "repetidor"; personas: number };

export type PedidoZonas = {
  /** Ids de los centros; vacío o sin valor = todos los gateways y repetidores. */
  centros?: string[];
  /** Personas por zona. */
  n?: number;
  /** Radio de la zona (km). */
  radioKm?: number;
  soloConSenal?: boolean;
  semilla?: number;
};

export type ResultadoZonas =
  | { zonas: { id: string; nombre: string; puestas: number; pedidas: number }[]; puestas: number; pedidas: number; radioKm: number; conSenal: boolean; recortado: boolean; quitadas: number }
  | { error: string };

/** Máximo de personas por zona y de personas pobladas en total (el mapa y el cálculo siguen ágiles). */
export const MAX_POR_ZONA = TOPE_PERSONAS_PUNTO;
export const MAX_POBLADAS = 4000;
export const RADIOS_ZONA_KM = [1, 2, 3, 5] as const;
export const ZONA_DEFECTO = { n: 250, radioKm: 2 } as const;
/** Gente de muestra que se pone en un punto vacío antes de buscar su límite. */
export const MUESTRA_PUNTO = 100;

const entero = (n: number) => numeroLocal(Math.round(n));
/** Un porcentaje ya escrito: «45 %» en español, «45%» en inglés. */
const conPct = (v: string | number) => tx(`${v} %`, `${v}%`);
const saltosTexto = (n: number) => tx(`${n} ${n === 1 ? "salto" : "saltos"}`, `${n} ${n === 1 ? "hop" : "hops"}`);

function Chips({ valores, valor, onCambio, sufijo = "" }: { valores: readonly number[]; valor: number; onCambio: (v: number) => void; sufijo?: string }) {
  useIdioma();
  return (
    <>
      {valores.map((v) => (
        <button key={v} type="button" onClick={() => onCambio(v)} aria-pressed={valor === v} className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1 ${valor === v ? "bg-carbon text-white ring-carbon" : "bg-white ring-linea hover:bg-papel-2"}`}>
          {tx(String(v).replace(".", ","), String(v))}
          {sufijo}
        </button>
      ))}
    </>
  );
}

export function textoZonas(x: ResultadoZonas): string {
  if ("error" in x) return x.error;
  const una = x.zonas.length === 1 ? x.zonas[0] : null;
  const donde = una
    ? tx(`alrededor de ${una.nombre}`, `around ${una.nombre}`)
    : tx(`en ${x.zonas.length} zonas (${entero(x.puestas / Math.max(1, x.zonas.length))} en promedio por zona)`, `in ${x.zonas.length} zones (${entero(x.puestas / Math.max(1, x.zonas.length))} per zone on average)`);
  const faltan = x.puestas < x.pedidas;
  const radio = fmt(x.radioKm, x.radioKm % 1 ? 1 : 0);
  // En inglés el motivo va al final: «I placed 960 of 1,000 people in 4 zones…, within 2 km: no more fit…»
  return tx(
    `Puse ${entero(x.puestas)} personas${faltan ? ` de ${entero(x.pedidas)}: ${x.recortado ? `el tope es ${entero(MAX_POBLADAS)} personas pobladas en total` : x.conSenal ? "solo hay señal en parte de la zona" : "no cupieron más sin quedar encimadas"}` : ""} ${donde}, a ${radio} km${x.conSenal ? ", todas con señal" : ""}.`,
    `I placed ${entero(x.puestas)}${faltan ? ` of ${entero(x.pedidas)}` : ""} people ${donde}, within ${radio} km${x.conSenal ? ", all with signal" : ""}${faltan ? `: ${x.recortado ? `the cap is ${entero(MAX_POBLADAS)} populated people in total` : x.conSenal ? "there is signal in only part of the zone" : "no more fit without overlapping"}` : ""}.`,
  );
}

export function ZonasPopularidad({
  centros,
  seleccion,
  hayResultado,
  ultimo,
  ocupado,
  onPoner,
  onProbar,
  onLimites,
  onQuitar,
}: {
  centros: CentroZona[];
  /** Pieza seleccionada en el mapa (si es un gateway o repetidor, la zona va ahí por defecto). */
  seleccion: string | null;
  hayResultado: boolean;
  ultimo: ResultadoZonas | null;
  ocupado: boolean;
  onPoner: (o: PedidoZonas) => void;
  /** Poner y simular de una vez la hora pico. */
  onProbar: (o: PedidoZonas) => void;
  /** Buscar el límite del punto elegido (o de cada uno). */
  onLimites: (o: PedidoZonas) => void;
  onQuitar: () => void;
}) {
  useIdioma();
  const [n, setN] = useState<number>(ZONA_DEFECTO.n);
  const [radioKm, setRadioKm] = useState<number>(ZONA_DEFECTO.radioKm);
  const [donde, setDonde] = useState<string>("");
  const [soloConSenal, setSoloConSenal] = useState(true);
  const elegido = donde === "todos" ? null : (centros.find((c) => c.id === (donde || seleccion)) ?? null);
  const cuantos = elegido ? 1 : centros.length;
  const total = n * cuantos;
  const conZona = centros.filter((c) => c.personas > 0);
  return (
    <section data-tour="zonas-popularidad" aria-labelledby="titulo-zonas">
      <Titulo>
        <span id="titulo-zonas" className="inline-flex items-center gap-1.5">
          <MapPinned size={16} /> {tx("Zonas de popularidad", "Popularity zones")}
        </span>
      </Titulo>
      {!centros.length ? (
        <p className="text-[13px] leading-snug text-tenue">
          {tx(
            "Ponga el gateway y los repetidores primero: cada zona de popularidad es gente alrededor de uno de ellos.",
            "Place the gateway and the repeaters first: each popularity zone is people around one of them.",
          )}
        </p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[12.5px] leading-snug text-carbon-2">
            {tx(
              "Pone gente alrededor de un repetidor o del gateway (o de cada uno), con la cantidad que quiera, para ver si la red queda estable con todos enviando información en la hora pico: pagos, WhatsApp y consultas a la IA. «¿Cuántas aguanta?» busca el límite de cada punto.",
              "Places people around a repeater or the gateway (or around each one), as many as you want, to see whether the network stays stable with everyone sending information in the peak hour: payments, WhatsApp and AI queries. “How many can it handle?” finds the limit of each point.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chips valores={[50, 150, 250, 500]} valor={n} onCambio={setN} />
            <label className="flex items-center gap-1 text-[12.5px] text-carbon-2">
              <input
                aria-label={tx("Personas por zona", "People per zone")}
                className="campo w-20 py-1 tabular-nums"
                inputMode="numeric"
                value={String(n)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/\D/g, ""));
                  if (Number.isFinite(v)) setN(Math.min(MAX_POR_ZONA, v));
                }}
              />
              {tx("por zona", "per zone")}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12.5px] text-carbon-2">{tx("A la redonda", "Radius")}</span>
            <Segmentado<string> etiqueta={tx("Radio de la zona", "Zone radius")} valor={String(radioKm)} onCambio={(v) => setRadioKm(Number(v))} opciones={RADIOS_ZONA_KM.map((r) => ({ valor: String(r), texto: `${r} km` }))} />
          </div>
          <label className="block text-[12.5px] text-carbon-2">
            <span className="mb-1 block">{tx("Dónde", "Where")}</span>
            <select className="campo" value={elegido?.id ?? "todos"} onChange={(e) => setDonde(e.target.value)} aria-label={tx("Dónde poner la zona de popularidad", "Where to place the popularity zone")}>
              <option value="todos">{tx(`En cada gateway y repetidor (${centros.length})`, `At each gateway and repeater (${centros.length})`)}</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {tx(`Solo alrededor de ${c.nombre}`, `Only around ${c.nombre}`)}
                  {c.personas ? tx(` (tiene ${entero(c.personas)})`, ` (has ${entero(c.personas)})`) : ""}
                </option>
              ))}
            </select>
          </label>
          <Interruptor
            etiqueta={tx("Solo donde hay señal", "Only where there is signal")}
            detalle={hayResultado ? tx("Con servicio (≥ 20 dB) en la última simulación", "With service (≥ 20 dB) in the last simulation") : tx("Simule primero para usarlo", "Simulate first to use it")}
            activo={soloConSenal && hayResultado}
            onCambio={setSoloConSenal}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="principal"
              deshabilitado={n < 1 || ocupado}
              tour="boton-zonas"
              onClick={() => onPoner({ centros: elegido ? [elegido.id] : undefined, n, radioKm, soloConSenal: soloConSenal && hayResultado, semilla: Math.floor(Math.random() * 1e6) })}
            >
              <Users size={16} />{" "}
              {elegido
                ? tx(`Poner ${entero(n)} alrededor de ${elegido.nombre}`, `Place ${entero(n)} around ${elegido.nombre}`)
                : tx(`Poner ${entero(n)} en cada uno (${entero(total)})`, `Place ${entero(n)} at each one (${entero(total)})`)}
            </Boton>
            <Boton deshabilitado={n < 1 || ocupado} tour="boton-zonas-probar" onClick={() => onProbar({ centros: elegido ? [elegido.id] : undefined, n, radioKm, soloConSenal: soloConSenal && hayResultado, semilla: Math.floor(Math.random() * 1e6) })}>
              <Activity size={16} /> {tx("Poner y probar", "Place and test")}
            </Boton>
            <Boton deshabilitado={ocupado} tour="boton-limites" onClick={() => onLimites({ centros: elegido ? [elegido.id] : undefined, n, radioKm })}>
              <Gauge size={16} /> {elegido ? tx(`¿Cuántas aguanta ${elegido.nombre}?`, `How many can ${elegido.nombre} handle?`) : tx("¿Cuántas aguanta cada punto?", "How many can each point handle?")}
            </Boton>
            {conZona.length > 0 && (
              <Boton onClick={onQuitar}>
                <Trash size={15} /> {tx("Quitar las zonas", "Remove the zones")}
              </Boton>
            )}
          </div>
          {total > MAX_POBLADAS && (
            <p className="text-[12px] text-tenue">
              {tx(
                `Se ponen hasta ${entero(MAX_POBLADAS)} personas pobladas en total; se reparten por igual entre las zonas.`,
                `Up to ${entero(MAX_POBLADAS)} populated people are placed in total; they're split evenly among the zones.`,
              )}
            </p>
          )}
          {conZona.length > 0 && (
            <p className="text-[12px] leading-snug text-tenue">
              {tx(
                `Zonas puestas: ${conZona.map((c) => `${c.nombre} ${entero(c.personas)}`).join(" · ")}. Volver a poner una zona la reparte de nuevo.`,
                `Zones placed: ${conZona.map((c) => `${c.nombre} ${entero(c.personas)}`).join(" · ")}. Placing a zone again spreads it anew.`,
              )}
            </p>
          )}
          {ultimo && (
            <p className={`text-[12.5px] leading-snug ${"error" in ultimo ? "text-sin" : "text-carbon-2"}`} role="status">
              {textoZonas(ultimo)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Lo que se le pide a un punto: poner la gente y probar la hora pico, buscar su límite o llenarlo hasta el límite. */
export type AccionPunto = "probar" | "limite" | "llenar";
export type PedidoPunto = { centro: string; accion: AccionPunto; n?: number; radioKm?: number; opciones?: Partial<OpcionesEstres> };
export type ResultadoPunto = { nombre: string; zonas: ResultadoZonas | null; estres: ResultadoEstres | null; limite: LimitePunto | null; error: string | null };

// Los textos son getters: se leen en el idioma de ese momento
const TEXTO_ESTADO_RED: Record<EstadoZona, string> = {
  get aguanta() {
    return tx("estable", "stable");
  },
  get lento() {
    return tx("lenta", "slow");
  },
  get revienta() {
    return tx("se revienta", "overloaded");
  },
  get "sin-pagos"() {
    return tx("sin mensajes", "no messages");
  },
};

/** El límite de un punto en palabras (pantalla y Melki). */
export function textoLimite(l: LimitePunto, corto = false): string {
  if (l.motivo) return l.motivo;
  const hoy = tx(
    `hoy tiene ${entero(l.personas)} ${l.personas === 1 ? "persona" : "personas"}${l.deZona ? "" : " que entran a la malla por él"}`,
    `today it has ${entero(l.personas)} ${l.personas === 1 ? "person" : "people"}${l.deZona ? "" : ` who ${l.personas === 1 ? "enters" : "enter"} the mesh through it`}`,
  );
  if (l.redYaFalla) {
    const limites = l.falla?.limites.length ? ` (${l.falla.limites.map((x) => TEXTO_LIMITE[x]).join(", ")})` : "";
    return tx(
      `Aun con muy poca gente en ${l.nombre}, la red no aguanta sin demora: ${l.falla?.nombres.join(", ") ?? "las otras zonas"} ya ${l.falla && l.falla.nombres.length === 1 ? "llena" : "llenan"} el canal${limites}. Baje la gente de esas zonas, reparta las 4 frecuencias o ponga otro sitio gateway.`,
      `Even with very few people at ${l.nombre}, the network can't keep up without delay: ${l.falla?.nombres.join(", ") ?? "the other zones"} already ${l.falla && l.falla.nombres.length === 1 ? "fills" : "fill"} the channel${limites}. Reduce the people in those zones, spread the 4 frequencies or add another gateway site.`,
    );
  }
  if (l.personasSeguro === null) return tx(`${l.nombre} no aguanta sin demora ni con muy poca gente (${hoy}).`, `${l.nombre} can't keep up without delay even with very few people (${hoy}).`);
  const msj = l.mensajesHoraMax !== null ? tx(` (${entero(l.mensajesHoraMax)} mensajes por hora en la hora pico)`, ` (${entero(l.mensajesHoraMax)} messages per hour in the peak hour)`) : "";
  if (l.aguantaTodo)
    return tx(
      `${l.nombre} aguanta más de ${entero(l.personasSeguro)} personas sin demora${msj}: es lo máximo que se prueba en un punto${corto ? "" : `; ${hoy}`}.`,
      `${l.nombre} handles more than ${entero(l.personasSeguro)} people without delay${msj}: that's the maximum tested at one point${corto ? "" : `; ${hoy}`}.`,
    );
  const rango = l.rango ? tx(` (entre ~${entero(l.rango[0])} y ~${entero(l.rango[1])} según el sorteo)`, ` (between ~${entero(l.rango[0])} and ~${entero(l.rango[1])} depending on the draw)`) : "";
  const tramos = [tx(`${l.nombre} aguanta sin demora hasta ~${entero(l.personasSeguro)} personas${rango}${msj}`, `${l.nombre} handles up to ~${entero(l.personasSeguro)} people without delay${rango}${msj}`)];
  if (l.personasLento !== null) tramos.push(tx(`desde ~${entero(l.personasLento)} va lento (la espera pasa de un minuto)`, `from ~${entero(l.personasLento)} it gets slow (the wait goes over a minute)`));
  if (l.personasQuiebre !== null) tramos.push(tx(`se revienta desde ~${entero(l.personasQuiebre)}`, `it gets overloaded from ~${entero(l.personasQuiebre)}`));
  let falla = "";
  if (l.falla) {
    const porque = l.falla.limites.length
      ? l.falla.limites.map((x) => TEXTO_LIMITE[x]).join(", ")
      : l.falla.estado === "lento"
        ? tx("la espera pasa de un minuto", "the wait goes over a minute")
        : tx("menos del 90 % recibe respuesta", "fewer than 90% get a reply");
    falla =
      l.falla.quien === "punto"
        ? tx(` Lo primero que falla es el propio ${l.nombre} (${porque}).`, ` The first thing to fail is ${l.nombre} itself (${porque}).`)
        : tx(
            ` Lo primero que falla es ${l.falla.nombres.join(", ")} (${porque}): la gente de este punto también ocupa su canal.`,
            ` The first thing to fail is ${l.falla.nombres.join(", ")} (${porque}): the people at this point also use its channel.`,
          );
  }
  const resto = corto ? "" : tx(` Con el resto de la red como está${l.llenado ? "" : `; ${hoy}`}.`, ` With the rest of the network as it is${l.llenado ? "" : `; ${hoy}`}.`);
  return `${tramos.join("; ")}.${falla}${resto}`;
}

/** Cómo quedó el punto al llenarlo hasta el límite. */
export function textoLlenado(l: LimitePunto): string {
  const x = l.llenado;
  if (!x) return "";
  return tx(
    `Lo llené con ${entero(x.personas)} personas y simulé la hora pico: el punto ${TEXTO_ESTADO_RED[x.estadoPunto]}, la red ${TEXTO_ESTADO_RED[x.estadoRed]}${x.intentos > 1 ? ` (bajé la cantidad ${x.intentos - 1} ${x.intentos === 2 ? "vez" : "veces"} hasta que quedó estable)` : ""}.`,
    `I filled it with ${entero(x.personas)} people and simulated the peak hour: point ${TEXTO_ESTADO_RED[x.estadoPunto]}, network ${TEXTO_ESTADO_RED[x.estadoRed]}${x.intentos > 1 ? ` (I lowered the number ${x.intentos === 2 ? "once" : `${x.intentos - 1} times`} until it was stable)` : ""}.`,
  );
}

/** Control de la zona de un nodo (en la tarjeta del mapa y en la lista de piezas): la gente, probarla y su límite. */
export function ZonaRapida({
  nombre,
  personas,
  zona,
  red,
  limite,
  ocupado,
  onPoner,
  onPunto,
  onQuitar,
}: {
  nombre: string;
  personas: number;
  zona: ZonaEstres | null;
  /** Cómo quedó toda la red en la última prueba (al día). */
  red: EstadoZona | null;
  limite: LimitePunto | null;
  /** Hay una prueba corriendo (texto de lo que hace) o nada. */
  ocupado: string | null;
  onPoner: (n: number, radioKm: number) => void;
  onPunto: (accion: AccionPunto, n: number, radioKm: number) => void;
  onQuitar: () => void;
}) {
  useIdioma();
  const [texto, setTexto] = useState<string>(String(personas || ZONA_DEFECTO.n));
  const [radioKm, setRadioKm] = useState<number>(ZONA_DEFECTO.radioKm);
  const leido = Number(texto.replace(/\D/g, ""));
  const n = Math.min(MAX_POR_ZONA, Math.max(0, Number.isFinite(leido) ? leido : 0));
  const boton = "rounded-md px-2 py-1 text-[12.5px] font-medium disabled:opacity-50";
  const seguro = limite && !limite.motivo && !limite.redYaFalla && limite.personasSeguro !== null ? Math.min(MAX_POR_ZONA, limite.personasSeguro) : null;
  return (
    <div className="space-y-1.5 rounded-lg bg-papel-2/70 p-2" data-tour="zona-rapida">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
        <MapPinned size={14} /> {tx("Zona de popularidad", "Popularity zone")}
        {personas ? tx(` · ${entero(personas)} personas`, ` · ${entero(personas)} people`) : ""}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <label className="flex items-center gap-1 text-[12.5px] text-carbon-2">
          <input
            aria-label={tx(`Personas alrededor de ${nombre}`, `People around ${nombre}`)}
            className="campo w-[4.6rem] py-0.5 text-[12.5px] tabular-nums"
            inputMode="numeric"
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
          {tx("personas", "people")}
        </label>
        <select className="campo w-auto py-0.5 text-[12.5px]" value={String(radioKm)} onChange={(e) => setRadioKm(Number(e.target.value))} aria-label={tx("Radio de la zona", "Zone radius")}>
          {RADIOS_ZONA_KM.map((r) => (
            <option key={r} value={r}>
              {tx(`a ${r} km`, `within ${r} km`)}
            </option>
          ))}
        </select>
      </div>
      {leido > MAX_POR_ZONA && <p className="text-[11.5px] text-tenue">{tx(`Hasta ${entero(MAX_POR_ZONA)} personas por punto.`, `Up to ${entero(MAX_POR_ZONA)} people per point.`)}</p>}
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" disabled={n < 1 || Boolean(ocupado)} onClick={() => onPoner(n, radioKm)} className={`${boton} bg-carbon text-white hover:bg-carbon-2`}>
          {personas ? tx("Repartir de nuevo", "Spread again") : tx("Poblar alrededor", "Populate around")}
        </button>
        <button
          type="button"
          disabled={n < 1 || Boolean(ocupado)}
          onClick={() => onPunto("probar", n, radioKm)}
          className={`${boton} inline-flex items-center gap-1 bg-white ring-1 ring-linea hover:bg-papel-2`}
          title={tx(`Pone ${entero(n)} personas y simula la hora pico con todos enviando información`, `Places ${entero(n)} people and simulates the peak hour with everyone sending information`)}
        >
          <Activity size={13} /> {tx("Poner y probar", "Place and test")}
        </button>
        <button
          type="button"
          disabled={Boolean(ocupado) || (!personas && n < 1)}
          onClick={() => onPunto("limite", n, radioKm)}
          className={`${boton} inline-flex items-center gap-1 bg-white ring-1 ring-linea hover:bg-papel-2`}
          title={tx(
            "Sube la gente de este punto, con el resto de la red como está, hasta encontrar cuántas aguanta",
            "Raises the people at this point, with the rest of the network as it is, until it finds how many it can handle",
          )}
        >
          <Gauge size={13} /> {tx("¿Cuántas aguanta?", "How many can it handle?")}
        </button>
        {personas > 0 && (
          <button type="button" disabled={Boolean(ocupado)} onClick={onQuitar} className={`${boton} px-1.5 text-sin hover:bg-sin/10`} aria-label={tx(`Quitar la zona de ${nombre}`, `Remove the zone around ${nombre}`)}>
            {tx("Quitar", "Remove")}
          </button>
        )}
      </div>
      {ocupado && (
        <p className="flex items-center gap-1.5 text-[12px] text-carbon-2" role="status">
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-salvia border-t-transparent" aria-hidden="true" />
          {ocupado}
        </p>
      )}
      {zona && zona.estado !== "sin-pagos" && (
        <p className="text-[12px] leading-snug" style={{ color: COLOR_ESTADO[zona.estado] }}>
          {tx(
            `Hora pico: ${TEXTO_ESTADO[zona.estado].toLowerCase()} · ${fmt(zona.completosPct, 0)} % completos · espera ${fmt(zona.p95S, 0)} s · canal ${fmt(zona.canalPct, 0)} %${red ? ` · red ${TEXTO_ESTADO_RED[red]}` : ""}`,
            `Peak hour: ${TEXTO_ESTADO[zona.estado].toLowerCase()} · ${fmt(zona.completosPct, 0)}% completed · wait ${fmt(zona.p95S, 0)} s · channel ${fmt(zona.canalPct, 0)}%${red ? ` · network ${TEXTO_ESTADO_RED[red]}` : ""}`,
          )}
          {zona.usuariosMax !== null && zona.usuariosMax !== undefined
            ? tx(` · aguanta ${zona.aguantaTodo ? "más de" : "hasta"} ~${entero(zona.usuariosMax)} personas`, ` · handles ${zona.aguantaTodo ? "more than" : "up to"} ~${entero(zona.usuariosMax)} people`)
            : ""}
        </p>
      )}
      {limite && (
        <div className="space-y-1" data-tour="limite-punto">
          <p className="text-[12px] leading-snug font-medium text-carbon">{textoLimite(limite, true)}</p>
          {limite.llenado && <p className="text-[12px] leading-snug text-carbon-2">{textoLlenado(limite)}</p>}
          {seguro !== null && seguro !== personas && (
            <button type="button" disabled={Boolean(ocupado)} onClick={() => onPunto("llenar", seguro, radioKm)} className={`${boton} inline-flex items-center gap-1 bg-salvia-oscura text-white hover:opacity-90`}>
              <Users size={13} /> {tx(`Llenar hasta el límite (${entero(seguro)})`, `Fill up to the limit (${entero(seguro)})`)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────── Prueba de estrés ───────────── */

export type OpcionesEstres = {
  pagosPersonaDia: number;
  horaPicoPct: number;
  factor: number;
  rampa: boolean;
  comparar: boolean;
  foco?: string | null;
  /** Pagos de Trama o lo medido en un gateway real. */
  perfil?: PerfilTrafico;
  /** Curva de entrega por enlace (sin valor: la del perfil). */
  curva?: CurvaEnlace;
  /** Meshtastic: contar la telemetría y el NodeInfo de cada equipo. */
  fondo?: boolean;
};

export const ESTRES_DEFECTO: OpcionesEstres = {
  pagosPersonaDia: PEDIDO_ESTRES_DEFECTO.pagosPersonaDia,
  horaPicoPct: PEDIDO_ESTRES_DEFECTO.horaPicoPct,
  factor: 1,
  rampa: false,
  comparar: false,
  perfil: "trama",
};

/** Opciones del perfil de tráfico: el ritmo de Trama o el medido en un gateway real. */
export function opcionesPerfil(perfil: PerfilTrafico): Partial<OpcionesEstres> {
  return perfil === "medido"
    ? { perfil, pagosPersonaDia: ESTRES_MEDIDO.pagosPersonaDia, horaPicoPct: ESTRES_MEDIDO.horaPicoPct, curva: undefined }
    : { perfil, pagosPersonaDia: PEDIDO_ESTRES_DEFECTO.pagosPersonaDia, horaPicoPct: PEDIDO_ESTRES_DEFECTO.horaPicoPct, curva: undefined };
}

export type FaseOptimizar =
  | { fase: "nada" }
  | { fase: "buscando"; avance: number; texto?: string }
  | { fase: "listo"; resultado: ResultadoOptimizar; firma: string; opciones: OpcionesEstres }
  | { fase: "aplicada"; titulo: string; antes: MedidaRed; esperado: MedidaRed }
  | { fase: "error"; texto: string };

export type FaseEstres =
  | { fase: "nada" }
  | { fase: "probando"; rampa: boolean; avance: number; texto?: string }
  | { fase: "listo"; resultado: ResultadoEstres; firma: string; opciones: OpcionesEstres; limites?: LimitePunto[] }
  | { fase: "error"; texto: string };

export const COLOR_ESTADO: Record<EstadoZona, string> = { aguanta: "#1E7B34", lento: "#F08A2C", revienta: "#D93A2E", "sin-pagos": "#9AA19D" };
/** Cómo quedó una zona, en el idioma de ese momento (cada clave es un getter). */
export const TEXTO_ESTADO: Record<EstadoZona, string> = {
  get aguanta() {
    return tx("Aguanta", "Holds up");
  },
  get lento() {
    return tx("Aguanta, pero lento", "Holds up, but slow");
  },
  get revienta() {
    return tx("Se revienta", "Gets overloaded");
  },
  get "sin-pagos"() {
    return tx("Sin mensajes", "No messages");
  },
};

const TEXTO_LIMITE: Record<LimiteZona, string> = {
  get canal() {
    return tx("canal lleno", "channel full");
  },
  get ciclo() {
    return tx(`al tope del ciclo de trabajo (${TOPE_CICLO_PCT} %)`, `at the duty-cycle cap (${TOPE_CICLO_PCT}%)`);
  },
  get recorte() {
    return tx("canal sobre el 25 %: Meshtastic recorta posiciones y telemetría", "channel above 25%: Meshtastic cuts back positions and telemetry");
  },
  get cola() {
    return tx("cola llena: descarta paquetes", "queue full: drops packets");
  },
  get choques() {
    return tx("muchos choques", "many collisions");
  },
  get alcance() {
    return tx("pierde alcance con la carga", "loses range under load");
  },
  get energia() {
    return tx("la energía no alcanza", "not enough energy");
  },
};

const km = (x: number) => `${fmt(x, x < 10 ? 1 : 0)} km`;

/** Resumen en una línea de una zona. */
export function lineaZona(z: ZonaEstres): string {
  if (z.estado === "sin-pagos")
    return tx(
      `${z.nombre}: sin personas que usen la red por él${z.usuariosRuta ? ` (pasan ${entero(z.usuariosRuta)} de otras zonas)` : ""}.`,
      `${z.nombre}: no people use the network through it${z.usuariosRuta ? ` (${entero(z.usuariosRuta)} pass through from other zones)` : ""}.`,
    );
  const limites = z.limites.length ? `; ${z.limites.map((l) => TEXTO_LIMITE[l]).join(", ")}` : "";
  return tx(
    `${z.nombre} (${entero(z.usuarios)} personas, ${fmt(z.pagosHora, 0)} mensajes/h): ${TEXTO_ESTADO[z.estado].toLowerCase()}, ${fmt(z.completosPct, 0)} % completos, el 95 % en ${fmt(z.p95S, 0)} s, canal ${fmt(z.canalPct, 0)} %${limites}.`,
    `${z.nombre} (${entero(z.usuarios)} people, ${fmt(z.pagosHora, 0)} messages/h): ${TEXTO_ESTADO[z.estado].toLowerCase()}, ${fmt(z.completosPct, 0)}% completed, 95% within ${fmt(z.p95S, 0)} s, channel ${fmt(z.canalPct, 0)}%${limites}.`,
  );
}

function FilaZona({ z, rampa, onVer }: { z: ZonaEstres; rampa: boolean; onVer: (id: string) => void }) {
  useIdioma();
  const color = COLOR_ESTADO[z.estado];
  return (
    <li className="px-2.5 py-2">
      <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => onVer(z.id)} title={tx(`Ver ${z.nombre} en el mapa`, `Show ${z.nombre} on the map`)}>
        <i className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <b className="font-cond text-[14.5px] leading-tight">{z.nombre}</b>
            <span className="text-[12px] font-semibold" style={{ color }}>
              {TEXTO_ESTADO[z.estado]}
            </span>
          </span>
          <span className="block text-[12px] leading-snug text-carbon-2 tabular-nums">
            {tx(
              `${entero(z.usuarios)} personas${z.pieza === "repetidor" && z.usuariosRuta > z.usuarios ? ` (+${entero(z.usuariosRuta - z.usuarios)} de paso)` : ""} · ${fmt(z.pagosHora, 0)} mensajes/h`,
              `${entero(z.usuarios)} people${z.pieza === "repetidor" && z.usuariosRuta > z.usuarios ? ` (+${entero(z.usuariosRuta - z.usuarios)} passing through)` : ""} · ${fmt(z.pagosHora, 0)} messages/h`,
            )}
            {z.estado !== "sin-pagos" ? tx(` · ${fmt(z.completosPct, 0)} % completos · el 95 % en ${fmt(z.p95S, 0)} s`, ` · ${fmt(z.completosPct, 0)}% completed · 95% within ${fmt(z.p95S, 0)} s`) : ""}
          </span>
          <span className="block text-[12px] leading-snug text-tenue tabular-nums">
            {tx(
              `Canal ${fmt(z.canalPct, 0)} % · transmite ${fmt(z.txPct, 1)} % (tope ${TOPE_CICLO_PCT} %)${z.perdidasCola ? ` · ${z.perdidasCola} descartados` : ""}`,
              `Channel ${fmt(z.canalPct, 0)}% · transmits ${fmt(z.txPct, 1)}% (cap ${TOPE_CICLO_PCT}%)${z.perdidasCola ? ` · ${z.perdidasCola} dropped` : ""}`,
            )}
            {z.usuarios > 0
              ? tx(
                  ` · atiende hasta ${km(z.alcanceKm)}${z.limites.includes("alcance") && z.alcanceCargaKm ? `; con la carga completa solo hasta ${km(z.alcanceCargaKm)}` : ""}`,
                  ` · serves up to ${km(z.alcanceKm)}${z.limites.includes("alcance") && z.alcanceCargaKm ? `; with the full load only up to ${km(z.alcanceCargaKm)}` : ""}`,
                )
              : ""}
            {z.energia ? tx(` · energía ${fmt(z.energia.consumoWhDia, 1)} de ${fmt(z.energia.generaWhDia, 0)} Wh/día`, ` · energy ${fmt(z.energia.consumoWhDia, 1)} of ${fmt(z.energia.generaWhDia, 0)} Wh/day`) : ""}
          </span>
          {z.limites.length > 0 && <span className="block text-[12px] leading-snug" style={{ color }}>{z.limites.map((l) => TEXTO_LIMITE[l]).join(" · ")}</span>}
          {rampa && z.usuarios > 0 && (
            <span className="block text-[12px] leading-snug font-medium text-carbon">
              {z.usuariosMax !== null && z.usuariosMax !== undefined
                ? tx(
                    `${z.aguantaTodo ? "Aguanta más de" : "Aguanta sin demora hasta"} ~${entero(z.usuariosMax)} personas (${fmt(z.pagosHoraMax ?? 0, 0)} mensajes/h)`,
                    `${z.aguantaTodo ? "Handles more than" : "Handles without delay up to"} ~${entero(z.usuariosMax)} people (${fmt(z.pagosHoraMax ?? 0, 0)} messages/h)`,
                  )
                : z.factorLento
                  ? tx(`Va lenta aun con la carga más baja probada (~${entero(z.usuarios * z.factorLento)} personas)`, `Slow even with the lowest load tested (~${entero(z.usuarios * z.factorLento)} people)`)
                  : tx("No aguanta ni con la carga más baja probada", "Can't keep up even with the lowest load tested")}
              {z.factorQuiebre ? tx(`; se revienta con ~${entero(z.usuarios * z.factorQuiebre)}`, `; gets overloaded with ~${entero(z.usuarios * z.factorQuiebre)}`) : ""}.
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** Mensajes pedidos frente a entregados por hora: sube con la carga hasta el máximo del canal y después cae (choques). */
function CurvaRendimiento({ r }: { r: NonNullable<ResultadoEstres["rampa"]> }) {
  useIdioma();
  const pts = r.puntos;
  if (pts.length < 2) return null;
  const ancho = 300;
  const alto = 130;
  const maxX = Math.max(...pts.map((p) => p.pedidosHora)) * 1.05;
  const maxY = Math.max(maxX * 0.25, ...pts.map((p) => p.entregadosHora)) * 1.15;
  const x = (v: number) => 26 + (v / maxX) * (ancho - 32);
  const y = (v: number) => alto - (v / maxY) * (alto - 8);
  const color = (p: (typeof pts)[number]) => (p.completosPct < 90 ? COLOR_ESTADO.revienta : p.p95S > 60 ? COLOR_ESTADO.lento : COLOR_ESTADO.aguanta);
  const marcas = [0, 0.5, 1].map((k) => Math.round((maxY / 1.15) * k));
  return (
    <figure className="space-y-1" aria-label={tx("Rendimiento de la malla", "Mesh throughput")}>
      <svg viewBox={`0 0 ${ancho} ${alto + 26}`} className="w-full" role="img" aria-label={tx("Mensajes por hora entregados según los pedidos", "Messages per hour delivered vs. requested")}>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={26} x2={ancho} y1={y(v)} y2={y(v)} stroke="#D9D5CC" strokeWidth={1} />
            <text x={22} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#6F7572">
              {v}
            </text>
          </g>
        ))}
        {/* Lo ideal: entrega todo lo que se pide */}
        <line x1={x(0)} y1={y(0)} x2={x(Math.min(maxX, maxY))} y2={y(Math.min(maxX, maxY))} stroke="#9AA19D" strokeDasharray="3 3" strokeWidth={1} />
        {[0, 0.5, 1].map((k) => {
          const v = Math.round((maxX / 1.05) * k);
          return (
            <text key={k} x={x(v)} y={alto + 10} textAnchor={k === 0 ? "start" : k === 1 ? "end" : "middle"} fontSize={9} fill="#6F7572">
              {v}
            </text>
          );
        })}
        <polyline fill="none" stroke="#2B2F2E" strokeWidth={1.6} points={pts.map((p) => `${x(p.pedidosHora)},${y(p.entregadosHora)}`).join(" ")} />
        {pts.map((p) => (
          <circle key={p.factor} cx={x(p.pedidosHora)} cy={y(p.entregadosHora)} r={3.6} fill={color(p)}>
            <title>
              {tx(
                `${fmt(p.pedidosHora, 0)} mensajes/h pedidos (×${fmt(p.factor, p.factor < 1 ? 2 : 1)}): ${fmt(p.entregadosHora, 0)} entregados, ${fmt(p.completosPct, 0)} % completos, el 95 % en ${fmt(p.p95S, 0)} s`,
                `${fmt(p.pedidosHora, 0)} messages/h requested (×${fmt(p.factor, p.factor < 1 ? 2 : 1)}): ${fmt(p.entregadosHora, 0)} delivered, ${fmt(p.completosPct, 0)}% completed, 95% within ${fmt(p.p95S, 0)} s`,
              )}
            </title>
          </circle>
        ))}
        <text x={(ancho + 26) / 2} y={alto + 22} textAnchor="middle" fontSize={9} fill="#6F7572">
          {tx("mensajes por hora pedidos (abajo) y entregados (al lado)", "messages per hour requested (bottom) and delivered (side)")}
        </text>
      </svg>
      <figcaption className="text-[12px] leading-snug text-carbon-2">
        {tx(
          `La malla entrega como máximo ~${fmt(r.maxEntregadosHora, 0)} mensajes por hora en esta frecuencia; si se le pide más, los choques se comen el canal y entrega menos. La línea punteada es lo ideal (entregar todo).`,
          `The mesh delivers at most ~${fmt(r.maxEntregadosHora, 0)} messages per hour on this frequency; if more is requested, collisions eat up the channel and it delivers less. The dotted line is the ideal (delivering everything).`,
        )}
      </figcaption>
    </figure>
  );
}

export function PruebaEstres({
  parametros,
  remitentes,
  estres,
  desactualizado,
  onProbar,
  onVerZona,
  optimizacion = { fase: "nada" },
  onOptimizar,
  onAplicar,
  onDeshacer,
  onVerPunto,
}: {
  parametros: Parametros;
  remitentes: number;
  estres: FaseEstres;
  desactualizado: boolean;
  onProbar: (o: OpcionesEstres) => void;
  onVerZona: (id: string) => void;
  optimizacion?: FaseOptimizar;
  onOptimizar?: (o: Partial<OpcionesEstres>) => void;
  onAplicar?: (p: PropuestaOptimizar) => void;
  onDeshacer?: () => void;
  onVerPunto?: (lat: number, lon: number) => void;
}) {
  useIdioma();
  const [o, setO] = useState<OpcionesEstres>(ESTRES_DEFECTO);
  const [verTodas, setVerTodas] = useState(false);
  const cambiar = (c: Partial<OpcionesEstres>) => setO((x) => ({ ...x, ...c }));
  const preset = presetPorId(parametros.preset);
  const protocolo = preset.protocolo;
  const perfil = o.perfil ?? "trama";
  const curva = curvaDe(o);
  const r = estres.fase === "listo" ? estres.resultado : null;
  const pagosHora = remitentes * o.pagosPersonaDia * (o.horaPicoPct / 100) * o.factor;
  const zonas = r ? [...r.zonas].sort((a, b) => Number(b.usuarios > 0) - Number(a.usuarios > 0) || rango(a.estado) - rango(b.estado) || b.usuarios - a.usuarios) : [];
  const visibles = verTodas ? zonas : zonas.slice(0, 6);
  return (
    <section data-tour="prueba-estres" aria-labelledby="titulo-estres">
      <Titulo>
        <span id="titulo-estres" className="inline-flex items-center gap-1.5">
          <Flame size={16} /> {tx("Prueba de estrés · hora pico", "Stress test · peak hour")}
        </span>
      </Titulo>
      <div className="space-y-2.5">
        <p className="text-[12.5px] leading-snug text-carbon-2">
          {tx(
            `Todas las personas usan la red a su ritmo en la hora más cargada del día —pagos, mensajes de WhatsApp y consultas a la IA— y se mide cada gateway y repetidor, y a cada persona: si le funciona, a medias o no, y por qué. Protocolo ${PROTOCOLOS[protocolo].nombre}, ajuste ${preset.nombre}.`,
            `Everyone uses the network at their own pace in the busiest hour of the day —payments, WhatsApp messages and AI queries— and each gateway and repeater is measured, as well as each person: whether it works for them, partly or not at all, and why. Protocol ${PROTOCOLOS[protocolo].nombre}, setting ${preset.nombre}.`,
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-tour="perfil-trafico">
          <span className="text-[12.5px] text-carbon-2">{tx("Tráfico", "Traffic")}</span>
          <Segmentado<PerfilTrafico>
            etiqueta={tx("Tráfico de la prueba", "Test traffic")}
            valor={perfil}
            onCambio={(x) => cambiar(opcionesPerfil(x))}
            opciones={[
              {
                valor: "trama",
                texto: tx("Pagos de Trama", "Trama payments"),
                titulo: tx(
                  "Orden firmada de 118 B, comprobante y aviso de 126 B; el servidor contesta en paralelo; 2,4 por persona al día",
                  "Signed 118 B order, 126 B receipt and notice; the server replies in parallel; 2.4 per person per day",
                ),
              },
              {
                valor: "medido",
                texto: FICHA_GATEWAY.medidoEn,
                titulo: tx(
                  `Comandos de ${FICHA_GATEWAY.mensaje.minimo} a ${FICHA_GATEWAY.mensaje.maximo} caracteres (mediana ${FICHA_GATEWAY.mensaje.mediana}), respuestas de hasta ${FICHA_GATEWAY.respuestaParte} B por parte; el gateway atiende de a uno (~${FICHA_GATEWAY.proceso.porMensajeS} s, hasta ${FICHA_GATEWAY.proceso.peorS} s); ${FICHA_GATEWAY.picos.dia} mensajes al día entre ${FICHA_GATEWAY.nodos.conocidos} equipos`,
                  `Commands of ${FICHA_GATEWAY.mensaje.minimo} to ${FICHA_GATEWAY.mensaje.maximo} characters (median ${FICHA_GATEWAY.mensaje.mediana}), replies of up to ${FICHA_GATEWAY.respuestaParte} B per part; the gateway handles one at a time (~${FICHA_GATEWAY.proceso.porMensajeS} s, up to ${FICHA_GATEWAY.proceso.peorS} s); ${FICHA_GATEWAY.picos.dia} messages a day among ${FICHA_GATEWAY.nodos.conocidos} devices`,
                ),
              },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] text-carbon-2">{tx("Mensajes por persona al día", "Messages per person per day")}</span>
          <Chips valores={[1, PEDIDO_ESTRES_DEFECTO.pagosPersonaDia, ESTRES_MEDIDO.pagosPersonaDia, 10]} valor={o.pagosPersonaDia} onCambio={(pagosPersonaDia) => cambiar({ pagosPersonaDia })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmentado<string>
            etiqueta={tx("Hora pico", "Peak hour")}
            valor={String(o.horaPicoPct)}
            onCambio={(v) => cambiar({ horaPicoPct: Number(v) })}
            opciones={[
              {
                valor: String(CAPACIDAD_TRAMA.horaPicoNormalPct),
                texto: tx("Día normal", "Normal day"),
                titulo: tx(`El ${CAPACIDAD_TRAMA.horaPicoNormalPct} % de los mensajes del día cae en la hora pico`, `${CAPACIDAD_TRAMA.horaPicoNormalPct}% of the day's messages fall in the peak hour`),
              },
              {
                valor: String(CAPACIDAD_TRAMA.horaPicoMercadoPct),
                texto: tx("Día de mercado", "Market day"),
                titulo: tx(`El ${CAPACIDAD_TRAMA.horaPicoMercadoPct} % de los mensajes del día cae en la hora pico`, `${CAPACIDAD_TRAMA.horaPicoMercadoPct}% of the day's messages fall in the peak hour`),
              },
              ...(perfil === "medido"
                ? [
                    {
                      valor: String(ESTRES_MEDIDO.horaPicoPct),
                      texto: tx("Medido", "Measured"),
                      titulo: tx(
                        `En el gateway: ${FICHA_GATEWAY.picos.hora} de ${FICHA_GATEWAY.picos.dia} mensajes del día en la hora pico (${ESTRES_MEDIDO.horaPicoPct} %)`,
                        `At the gateway: ${FICHA_GATEWAY.picos.hora} of the day's ${FICHA_GATEWAY.picos.dia} messages in the peak hour (${ESTRES_MEDIDO.horaPicoPct}%)`,
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <Segmentado<string>
            etiqueta={tx("Multiplicar la carga", "Multiply the load")}
            valor={String(o.factor)}
            onCambio={(v) => cambiar({ factor: Number(v) })}
            opciones={[1, 2, 5, 10].map((f) => ({ valor: String(f), texto: `×${f}`, titulo: f === 1 ? tx("La hora pico tal cual", "The peak hour as is") : tx(`${f} veces la hora pico`, `${f} times the peak hour`) }))}
          />
        </div>
        <p className="text-[12px] leading-snug text-tenue">
          {remitentes > 0
            ? tx(
                `${entero(remitentes)} personas con ruta × ${fmt(o.pagosPersonaDia, 1)} mensajes al día × ${o.horaPicoPct} % en la hora pico${o.factor > 1 ? ` × ${o.factor}` : ""} = ${fmt(pagosHora, 0)} mensajes por hora.`,
                `${entero(remitentes)} people with a route × ${fmt(o.pagosPersonaDia, 1)} messages a day × ${o.horaPicoPct}% in the peak hour${o.factor > 1 ? ` × ${o.factor}` : ""} = ${fmt(pagosHora, 0)} messages per hour.`,
              )
            : tx("Sin personas con ruta al gateway todavía.", "No people with a route to the gateway yet.")}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[12.5px] text-carbon-2">{tx("Enlaces", "Links")}</span>
          <Segmentado<CurvaEnlace>
            etiqueta={tx("Curva de entrega por enlace", "Delivery curve per link")}
            valor={curva}
            onCambio={(x) => cambiar({ curva: x })}
            opciones={[
              {
                valor: "diseno",
                texto: tx("Del diseño", "Design"),
                titulo: tx(
                  "Conservadora: 20 dB de margen ≈ 70 % de los paquetes, 30 dB ≈ 98 % (cubre el error del modelo)",
                  "Conservative: 20 dB of margin ≈ 70% of packets, 30 dB ≈ 98% (covers the model error)",
                ),
              },
              {
                valor: "campo",
                texto: tx("Medidos en campo", "Measured in the field"),
                titulo: tx(
                  `La de ${FICHA_GATEWAY.enFrase}: ${fmt(FICHA_GATEWAY.erroresPct, 1)} % de paquetes con error y cerca de la mitad de los paquetes pasa con SNR de −12 dB`,
                  `The one from ${FICHA_GATEWAY.enFrase}: ${fmt(FICHA_GATEWAY.erroresPct, 1)}% of packets with errors, and about half of the packets get through at an SNR of −12 dB`,
                ),
              },
            ]}
          />
        </div>
        {protocolo === "meshtastic" && (
          <Interruptor
            etiqueta={tx("Telemetría y NodeInfo de cada equipo", "Telemetry and NodeInfo from each device")}
            detalle={tx(
              `Meshtastic: cada equipo difunde su telemetría cada ${FONDO_MT.telemetriaS / 60} min y su NodeInfo cada ${FONDO_MT.nodeInfoS / 3600} h, inundadas por la malla; con el canal sobre el ${FONDO_MT.recortePct} % las recorta`,
              `Meshtastic: each device broadcasts its telemetry every ${FONDO_MT.telemetriaS / 60} min and its NodeInfo every ${FONDO_MT.nodeInfoS / 3600} h, flooded through the mesh; with the channel above ${FONDO_MT.recortePct}% it cuts them back`,
            )}
            activo={o.fondo !== false}
            onCambio={(fondo) => cambiar({ fondo })}
          />
        )}
        <Interruptor
          etiqueta={tx("Comparar ajustes de radio", "Compare radio settings")}
          detalle={
            protocolo === "meshtastic"
              ? tx("La misma hora pico con los otros presets de Meshtastic (LongSlow … ShortFast)", "The same peak hour with the other Meshtastic presets (LongSlow … ShortFast)")
              : tx("La misma hora pico con más alcance (62,5 kHz) o más capacidad (SF9 · 250 kHz)", "The same peak hour with more range (62.5 kHz) or more capacity (SF9 · 250 kHz)")
          }
          activo={o.comparar}
          onCambio={(comparar) => cambiar({ comparar })}
        />
        <div className="flex flex-wrap gap-2">
          <Boton variante="principal" onClick={() => onProbar({ ...o, rampa: false })} tour="boton-estres" deshabilitado={estres.fase === "probando"}>
            <Activity size={16} /> {tx("Probar la hora pico", "Test the peak hour")}
          </Boton>
          <Boton onClick={() => onProbar({ ...o, rampa: true })} tour="boton-rampa" deshabilitado={estres.fase === "probando"}>
            <TrendingUp size={16} /> {tx("¿Hasta dónde aguanta cada repetidor?", "How much can each repeater handle?")}
          </Boton>
        </div>
        {remitentes === 0 && (
          <p className="text-[12.5px] text-sin">
            {tx(
              "No hay personas con ruta al gateway: ponga una zona de popularidad o personas donde haya cobertura y simule.",
              "No people have a route to the gateway: add a popularity zone or place people where there is coverage and simulate.",
            )}
          </p>
        )}
        {desactualizado && <p className="text-[12.5px] text-tenue">{tx("La red cambió después de esta prueba: pruebe de nuevo para ver la red de ahora.", "The network changed after this test: test again to see the current network.")}</p>}
        {estres.fase === "probando" && (
          <p className="flex items-center gap-2 text-[13px] text-carbon-2" role="status">
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-salvia border-t-transparent" aria-hidden="true" />
            {estres.texto ?? (estres.rampa ? tx("Subiendo la carga hasta que cada zona se reviente…", "Raising the load until each zone gets overloaded…") : tx("Simulando la hora pico paquete por paquete…", "Simulating the peak hour packet by packet…"))}{" "}
            {conPct(Math.round(estres.avance * 100))}
          </p>
        )}
        {estres.fase === "error" && <p className="text-[13px] text-sin">{estres.texto}</p>}
        {r && estres.fase === "listo" && (
          <div className="space-y-2.5 rounded-lg bg-white p-2.5 ring-1 ring-linea" aria-label={tx("Resultado de la prueba de estrés", "Stress test result")} data-tour="resultado-estres">
            {r.motivo ? (
              <p className="text-[13px] text-sin">{r.motivo}</p>
            ) : (
              <>
                <p className="font-cond text-[16px] leading-tight font-semibold" style={{ color: COLOR_ESTADO[r.estado] }}>
                  {tx(
                    `${TEXTO_ESTADO[r.estado]}: ${fmt(r.completosPct, 0)} % de los mensajes de la hora pico con respuesta`,
                    `${TEXTO_ESTADO[r.estado]}: ${fmt(r.completosPct, 0)}% of the peak-hour messages with a reply`,
                  )}
                </p>
                <dl className="grid grid-cols-3 gap-1.5 text-[12px]">
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">{tx("Mensajes por hora", "Messages per hour")}</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{fmt(r.entregadosHora, 0)}</dd>
                    <dd className="text-[11px] text-tenue">{tx(`de ${fmt(r.pedidosHora, 0)} pedidos`, `of ${fmt(r.pedidosHora, 0)} requested`)}</dd>
                  </div>
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">{tx("Canal del gateway", "Gateway channel")}</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{conPct(fmt(r.canalGatewayPct, 0))}</dd>
                    <dd
                      className="text-[11px] text-tenue"
                      title={tx(`Trama diseña cada frecuencia para no pasar del ${CAPACIDAD_TRAMA.canalPicoPct} % en la hora pico`, `Trama designs each frequency to stay under ${CAPACIDAD_TRAMA.canalPicoPct}% in the peak hour`)}
                    >
                      {tx(`Trama: hasta ${CAPACIDAD_TRAMA.canalPicoPct} %`, `Trama: up to ${CAPACIDAD_TRAMA.canalPicoPct}%`)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">{tx("Ancho de banda útil", "Useful bandwidth")}</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{fmt(r.utilBps, 0)} bps</dd>
                    <dd className="text-[11px] text-tenue">{tx(`de mensajes; el canal da ${fmt(r.canalBps / 1000, 2)} kbps`, `of messages; the channel gives ${fmt(r.canalBps / 1000, 2)} kbps`)}</dd>
                  </div>
                </dl>
                <p className="text-[12px] leading-snug text-carbon-2">
                  {entero(r.usuarios)} {r.protocolo === "meshtastic" ? tx("personas enviando", "people sending") : tx("personas con ruta", "people with a route")}
                  {r.personas > r.usuarios ? tx(` (de ${entero(r.personas)})`, ` (of ${entero(r.personas)})`) : ""}
                  {tx(
                    `; el 95 % de los mensajes completa en ${fmt(r.p95S, 0)} s (típico ${fmt(r.p50S, r.p50S < 10 ? 1 : 0)} s). Cada persona gasta ~${fmt(r.zonas.find((z) => z.usuarios > 0)?.airePersonaS ?? 0, 1)} s de aire en la hora pico; un mensaje sin choques ${r.perfil === "medido" ? "(un comando con su respuesta)" : "(del tamaño de un pago)"} ocupa ~${fmt(r.airePorPagoS, 1)} s.`,
                    `; 95% of messages complete within ${fmt(r.p95S, 0)} s (typical ${fmt(r.p50S, r.p50S < 10 ? 1 : 0)} s). Each person uses ~${fmt(r.zonas.find((z) => z.usuarios > 0)?.airePersonaS ?? 0, 1)} s of airtime in the peak hour; a collision-free message ${r.perfil === "medido" ? "(a command with its reply)" : "(the size of a payment)"} takes ~${fmt(r.airePorPagoS, 1)} s.`,
                  )}
                  {r.gateway.modo === "secuencial"
                    ? tx(
                        ` El gateway atiende de a uno: la espera en su fila es de ${fmt(r.gateway.esperaP50S, 1)} s típica y ${fmt(r.gateway.esperaP95S, 0)} s para el 95 % (máximo ${fmt(r.gateway.esperaMaxS, 0)} s); está ocupado el ${fmt(r.gateway.ocupadoPct, 0)} % del tiempo.`,
                        ` The gateway handles one at a time: the wait in its queue is ${fmt(r.gateway.esperaP50S, 1)} s typical and ${fmt(r.gateway.esperaP95S, 0)} s for 95% (maximum ${fmt(r.gateway.esperaMaxS, 0)} s); it is busy ${fmt(r.gateway.ocupadoPct, 0)}% of the time.`,
                      )
                    : ""}
                  {r.protocolo === "meshtastic" && r.cancelados > 0
                    ? tx(
                        ` La inundación administrada evitó ~${entero(r.cancelados)} retransmisiones (el nodo oyó que otro ya lo había repetido).`,
                        ` Managed flooding avoided ~${entero(r.cancelados)} retransmissions (the node heard that another one had already repeated it).`,
                      )
                    : ""}
                </p>
                <PersonaPorPersona r={r} onVer={onVerZona} />
                {onOptimizar && <Optimizacion fase={optimizacion} onOptimizar={() => onOptimizar({})} onAplicar={onAplicar} onDeshacer={onDeshacer} onVerPunto={onVerPunto} />}
                {estres.limites && estres.limites.length > 1 ? <TablaLimites limites={estres.limites} onVer={onVerZona} /> : r.limite ? <BloqueLimite l={r.limite} /> : null}
                {r.rampa && (
                  <div className="space-y-1.5 rounded-md bg-papel-2/60 p-2">
                    <p className="text-[12.5px] leading-snug font-medium text-carbon">
                      {r.rampa.usuariosMax !== null
                        ? tx(
                            `Toda la malla aguanta sin demora hasta ~${entero(r.rampa.usuariosMax)} personas (×${fmt(r.rampa.factorSeguro ?? 0, r.rampa.factorSeguro && r.rampa.factorSeguro < 1 ? 2 : 1)} la carga).`,
                            `The whole mesh handles up to ~${entero(r.rampa.usuariosMax)} people without delay (×${fmt(r.rampa.factorSeguro ?? 0, r.rampa.factorSeguro && r.rampa.factorSeguro < 1 ? 2 : 1)} the load).`,
                          )
                        : tx("Con esta carga la malla no aguanta ni con lo mínimo probado.", "With this load the mesh can't keep up even with the minimum tested.")}
                      {r.rampa.factorQuiebre !== null
                        ? tx(
                            ` Se revienta desde ×${fmt(r.rampa.factorQuiebre, r.rampa.factorQuiebre < 1 ? 2 : 1)} (~${entero(r.usuarios * r.rampa.factorQuiebre)} personas).`,
                            ` It gets overloaded from ×${fmt(r.rampa.factorQuiebre, r.rampa.factorQuiebre < 1 ? 2 : 1)} (~${entero(r.usuarios * r.rampa.factorQuiebre)} people).`,
                          )
                        : tx(" No se revienta con lo probado.", " It doesn't get overloaded with what was tested.")}
                      {r.rampa.primera ? tx(` La primera zona en reventarse: ${r.rampa.primera}.`, ` The first zone to get overloaded: ${r.rampa.primera}.`) : ""}
                    </p>
                    {r.rampa.capacidadReal && (
                      <p className="text-[12.5px] leading-snug font-semibold text-carbon" data-tour="capacidad-real">
                        {tx(
                          `Capacidad real: ~${entero(r.rampa.capacidadReal.personas)} personas atendidas (a las que les funciona), con ×${fmt(r.rampa.capacidadReal.factor, r.rampa.capacidadReal.factor < 1 ? 2 : 1)} la carga (${fmt(r.rampa.capacidadReal.funcionanPct, 0)} % de las personas).`,
                          `Real capacity: ~${entero(r.rampa.capacidadReal.personas)} people served (those it works for), at ×${fmt(r.rampa.capacidadReal.factor, r.rampa.capacidadReal.factor < 1 ? 2 : 1)} the load (${fmt(r.rampa.capacidadReal.funcionanPct, 0)}% of the people).`,
                        )}
                      </p>
                    )}
                    <CurvaRendimiento r={r.rampa} />
                  </div>
                )}
                <div>
                  <p className="mb-1 text-[12.5px] font-semibold text-carbon">{tx("Zona por zona", "Zone by zone")}</p>
                  <ul className="divide-y divide-linea rounded-md ring-1 ring-linea">
                    {visibles.map((z) => (
                      <FilaZona key={z.id} z={z} rampa={Boolean(r.rampa)} onVer={onVerZona} />
                    ))}
                  </ul>
                  {zonas.length > 6 && (
                    <button type="button" className="mt-1 text-[12.5px] font-medium text-salvia-oscura" onClick={() => setVerTodas((v) => !v)}>
                      {verTodas ? tx("Ver menos", "Show fewer") : tx(`Ver las ${zonas.length} zonas`, `Show all ${zonas.length} zones`)}
                    </button>
                  )}
                </div>
                {r.ajustes && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
                      <Radio size={14} /> {tx("La misma hora pico con otro ajuste de radio", "The same peak hour with another radio setting")}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px] tabular-nums">
                        <thead className="text-left text-tenue">
                          <tr>
                            <th className="py-0.5 pr-1 font-normal">{tx("Ajuste", "Setting")}</th>
                            <th className="px-1 font-normal">{tx("Con ruta", "With route")}</th>
                            <th className="px-1 font-normal">{tx("Completos", "Completed")}</th>
                            <th className="px-1 font-normal">{tx("Espera", "Wait")}</th>
                            <th className="pl-1 font-normal">{tx("Canal", "Channel")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.ajustes.map((a) => (
                            <tr key={a.preset} className={a.actual ? "font-semibold" : ""}>
                              <td className="py-0.5 pr-1">
                                <i className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLOR_ESTADO[a.estado] }} aria-hidden="true" />
                                {nombreCorto(a.nombre)}
                                {a.actual ? tx(" (el de ahora)", " (current)") : ""}
                              </td>
                              <td className="px-1">{entero(a.conRuta)}</td>
                              <td className="px-1">{a.conRuta ? conPct(fmt(a.completosPct, 0)) : "—"}</td>
                              <td className="px-1">{a.conRuta ? `${fmt(a.p95S, 0)} s` : "—"}</td>
                              <td className="pl-1">{a.conRuta ? conPct(fmt(a.canalPct, 0)) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug text-tenue">
                      {tx(
                        "Más ancho de banda o menos SF: cada mensaje dura menos en el aire y caben más, pero el alcance baja (menos personas con ruta). Las rutas se recalculan con cada ajuste sobre los mismos enlaces.",
                        "More bandwidth or a lower SF: each message spends less time on air and more of them fit, but the range drops (fewer people with a route). Routes are recalculated for each setting over the same links.",
                      )}
                    </p>
                  </div>
                )}
                <Supuestos r={r} />
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const medida = (m: MedidaRed) =>
  tx(
    `${entero(m.atendidas)} personas atendidas · ${fmt(m.completosPct, 0)} % completos · canal ${fmt(m.canalPct, 0)} %`,
    `${entero(m.atendidas)} people served · ${fmt(m.completosPct, 0)}% completed · channel ${fmt(m.canalPct, 0)}%`,
  );

/** Una propuesta en palabras (pantalla y Melki). */
export function textoPropuesta(pr: PropuestaOptimizar): string {
  const mas = pr.gananciaAtendidas;
  return tx(
    `${pr.titulo}: atiende a ~${entero(Math.max(0, mas))} ${Math.round(mas) === 1 ? "persona" : "personas"} más (de ~${entero(pr.antes.atendidas)} a ~${entero(pr.despues.atendidas)}${pr.ganancia > 0 ? `; les funciona a ${entero(pr.ganancia)} más` : ""}). ${pr.que}`,
    `${pr.titulo}: serves ~${entero(Math.max(0, mas))} more ${Math.round(mas) === 1 ? "person" : "people"} (from ~${entero(pr.antes.atendidas)} to ~${entero(pr.despues.atendidas)}${pr.ganancia > 0 ? `; it works for ${entero(pr.ganancia)} more` : ""}). ${pr.que}`,
  );
}

/** La optimización en palabras (pantalla y Melki). */
export function textoOptimizacion(x: ResultadoOptimizar): string {
  if (x.motivo) return x.motivo;
  if (!x.propuestas.length) return x.diagnostico.join(" ");
  const mejor = x.combinada ?? x.propuestas[0];
  return tx(
    `${x.diagnostico[0] ?? ""} Lo que más ayuda: ${textoPropuesta(mejor)}${x.propuestas.length > 1 ? ` Probé ${x.propuestas.length + x.descartadas.length} arreglos; ${x.propuestas.length} ayudan.` : ""}`,
    `${x.diagnostico[0] ?? ""} What helps most: ${textoPropuesta(mejor)}${x.propuestas.length > 1 ? ` I tried ${x.propuestas.length + x.descartadas.length} fixes; ${x.propuestas.length} help.` : ""}`,
  );
}

/** Optimizar la red para la carga de la prueba: diagnóstico, propuestas con su antes y después, aplicar y deshacer. */
function Optimizacion({
  fase,
  onOptimizar,
  onAplicar,
  onDeshacer,
  onVerPunto,
}: {
  fase: FaseOptimizar;
  onOptimizar: () => void;
  onAplicar?: (p: PropuestaOptimizar) => void;
  onDeshacer?: () => void;
  onVerPunto?: (lat: number, lon: number) => void;
}) {
  useIdioma();
  const x = fase.fase === "listo" ? fase.resultado : null;
  const lista = x ? [...(x.combinada ? [x.combinada] : []), ...x.propuestas] : [];
  return (
    <div className="space-y-1.5 rounded-md bg-salvia/10 p-2 ring-1 ring-salvia/30" data-tour="optimizar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
          <Wrench size={14} /> {tx("Optimizar la red para esta carga", "Optimize the network for this load")}
        </p>
        <Boton onClick={onOptimizar} deshabilitado={fase.fase === "buscando"} tour="boton-optimizar">
          <Sparkles size={15} /> {x ? tx("Volver a optimizar", "Optimize again") : tx("Optimizar", "Optimize")}
        </Boton>
      </div>
      {fase.fase === "nada" && (
        <p className="text-[11.5px] leading-snug text-carbon-2">
          {tx(
            "Busca gateways de apoyo, antenas de apoyo y ajustes del protocolo que hagan que les funcione a más personas, y los prueba uno por uno con la misma carga.",
            "Looks for support gateways, support antennas and protocol settings that make it work for more people, and tests them one by one with the same load.",
          )}
        </p>
      )}
      {fase.fase === "buscando" && (
        <p className="flex items-center gap-2 text-[12.5px] text-carbon-2" role="status">
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-salvia border-t-transparent" aria-hidden="true" />
          {fase.texto ?? tx("Probando gateways de apoyo, antenas de apoyo y ajustes con la misma carga…", "Testing support gateways, support antennas and settings with the same load…")} {conPct(Math.round(fase.avance * 100))}
        </p>
      )}
      {fase.fase === "error" && <p className="text-[12.5px] text-sin">{fase.texto}</p>}
      {fase.fase === "aplicada" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] leading-snug text-carbon" role="status">
            {tx(
              `Apliqué «${fase.titulo}». Se esperaba pasar de ${medida(fase.antes)} a ${medida(fase.esperado)}; la prueba de la hora pico de arriba ya es con la red nueva.`,
              `I applied “${fase.titulo}”. It was expected to go from ${medida(fase.antes)} to ${medida(fase.esperado)}; the peak-hour test above already uses the new network.`,
            )}
          </p>
          {onDeshacer && (
            <Boton onClick={onDeshacer}>
              <Undo2 size={15} /> {tx("Deshacer", "Undo")}
            </Boton>
          )}
        </div>
      )}
      {x && (
        <>
          <ul className="list-disc space-y-0.5 pl-4 text-[12px] leading-snug text-carbon-2">
            {x.diagnostico.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          {lista.length > 0 && (
            <ul className="space-y-1.5" aria-label={tx("Propuestas de optimización", "Optimization proposals")}>
              {lista.map((pr) => (
                <li key={pr.id} className={`rounded-md bg-white p-2 ring-1 ${pr.id === "combinada" ? "ring-salvia" : "ring-linea"}`}>
                  <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <b className="font-cond text-[14px] leading-tight">{pr.titulo}</b>
                    <span className="text-[12px] font-semibold tabular-nums text-salvia-oscura">{tx(`+${entero(pr.gananciaAtendidas)} atendidas`, `+${entero(pr.gananciaAtendidas)} served`)}</span>
                  </p>
                  <p className="text-[12px] leading-snug text-carbon">{pr.que}</p>
                  <p className="text-[11.5px] leading-snug text-carbon-2">{pr.porque}</p>
                  <p className="text-[11.5px] leading-snug text-tenue tabular-nums">
                    {tx(
                      `Antes: ${medida(pr.antes)}. Después: ${medida(pr.despues)}${pr.ganancia !== 0 ? `; les funciona a ${entero(pr.antes.funcionan)} → ${entero(pr.despues.funcionan)}` : ""}.`,
                      `Before: ${medida(pr.antes)}. After: ${medida(pr.despues)}${pr.ganancia !== 0 ? `; it works for ${entero(pr.antes.funcionan)} → ${entero(pr.despues.funcionan)}` : ""}.`,
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {pr.aplicable && onAplicar ? (
                      <Boton variante="principal" onClick={() => onAplicar(pr)}>
                        {pr.id === "combinada" ? tx("Aplicar todo junto", "Apply all together") : tx("Aplicar al mapa", "Apply to the map")}
                      </Boton>
                    ) : (
                      <span className="rounded-full bg-papel-2 px-2 py-0.5 text-[11.5px] text-carbon-2">{tx("Se hace en campo", "Done in the field")}</span>
                    )}
                    {pr.lat !== null && pr.lon !== null && onVerPunto && (
                      <Boton onClick={() => onVerPunto(pr.lat!, pr.lon!)}>
                        <MapPin size={14} /> {tx("Ver dónde", "Show where")}
                      </Boton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {x.descartadas.length > 0 && (
            <p className="text-[11px] leading-snug text-tenue">
              {tx(
                `Probados sin mejora: ${x.descartadas.map((d) => d.titulo.charAt(0).toLowerCase() + d.titulo.slice(1)).join("; ")}.`,
                `Tested without improvement: ${x.descartadas.map((d) => d.titulo.charAt(0).toLowerCase() + d.titulo.slice(1)).join("; ")}.`,
              )}
            </p>
          )}
          <p className="text-[11px] leading-snug text-tenue">
            {tx(
              "Personas atendidas: la suma de la parte de los mensajes de cada persona que vuelve, rebajada si tarda más de 30 s. Cada propuesta se prueba con la misma carga y la misma semilla; las de «en campo» (otra frecuencia, el servicio del gateway, la telemetría) no cambian el mapa.",
              "People served: the sum of the share of each person's messages that comes back, reduced if it takes more than 30 s. Each proposal is tested with the same load and the same seed; the “in the field” ones (another frequency, the gateway service, telemetry) don't change the map.",
            )}
          </p>
        </>
      )}
    </div>
  );
}

/** Resumen de las personas en palabras (pantalla y Melki). */
export function textoUsuarios(r: ResultadoEstres): string {
  const u = r.resumenUsuarios;
  if (!u || !u.total) return "";
  const partes = ORDEN_ESTADOS_USUARIO.filter((e) => u.porEstado[e] > 0).map((e) => `${entero(u.porEstado[e])} ${ESTADOS_USUARIO[e].nombre.toLowerCase()}`);
  const causas = (Object.entries(u.porCausa) as [CausaUsuario, number][]).sort((a, b) => b[1] - a[1]);
  const lista = causas
    .slice(0, 3)
    .map(([c, n]) => `${CAUSAS_USUARIO[c]} (${entero(n)})`)
    .join(", ");
  return tx(
    `De ${entero(u.total)} personas, a ${entero(u.funcionan)} les funciona (${fmt(u.funcionanPct, 0)} %): ${partes.join(", ")}.${causas.length ? ` Lo que más pesa: ${lista}.` : ""}`,
    `Of ${entero(u.total)} people, it works for ${entero(u.funcionan)} (${fmt(u.funcionanPct, 0)}%): ${partes.join(", ")}.${causas.length ? ` What weighs most: ${lista}.` : ""}`,
  );
}

/** Persona por persona: cuántas les funciona, la barra de colores y las que más sufren, con su causa. */
function PersonaPorPersona({ r, onVer }: { r: ResultadoEstres; onVer: (id: string) => void }) {
  useIdioma();
  const u = r.resumenUsuarios;
  const peores = ORDEN_ESTADOS_USUARIO.slice().reverse().find((e) => u?.porEstado[e] && e !== "bien" && e !== "funciona") ?? null;
  const [ver, setVer] = useState<EstadoUsuario | null>(null);
  if (!u || !u.total) return null;
  const filtro = ver ?? peores;
  const lista = filtro ? r.porUsuario.filter((x) => x.estado === filtro).sort((a, b) => a.exitoPct - b.exitoPct) : [];
  const causas = (Object.entries(u.porCausa) as [CausaUsuario, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-1.5 rounded-md bg-papel-2/60 p-2" data-tour="usuarios-estres">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
        <UserCheck size={14} />{" "}
        {tx(
          `Persona por persona: a ${entero(u.funcionan)} de ${entero(u.total)} les funciona (${fmt(u.funcionanPct, 0)} %)`,
          `Person by person: it works for ${entero(u.funcionan)} of ${entero(u.total)} (${fmt(u.funcionanPct, 0)}%)`,
        )}
      </p>
      <div className="flex h-3 overflow-hidden rounded-[3px] ring-1 ring-black/10" role="img" aria-label={textoUsuarios(r)}>
        {ORDEN_ESTADOS_USUARIO.map((e) =>
          u.porEstado[e] ? <span key={e} style={{ width: `${(100 * u.porEstado[e]) / u.total}%`, background: ESTADOS_USUARIO[e].color }} title={`${ESTADOS_USUARIO[e].nombre}: ${entero(u.porEstado[e])}`} /> : null,
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {ORDEN_ESTADOS_USUARIO.map((e) => (
          <button
            key={e}
            type="button"
            disabled={!u.porEstado[e]}
            aria-pressed={filtro === e}
            onClick={() => setVer(e)}
            title={ESTADOS_USUARIO[e].descripcion}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] ring-1 disabled:opacity-40 ${filtro === e ? "bg-carbon text-white ring-carbon" : "bg-white ring-linea hover:bg-papel-2"}`}
          >
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: ESTADOS_USUARIO[e].color }} aria-hidden="true" />
            {ESTADOS_USUARIO[e].nombre} {entero(u.porEstado[e])}
          </button>
        ))}
      </div>
      {causas.length > 0 && (
        <p className="text-[12px] leading-snug text-carbon-2">
          {tx(`Por qué: ${causas.map(([c, n]) => `${CAUSAS_USUARIO[c]} ${entero(n)}`).join(" · ")}.`, `Why: ${causas.map(([c, n]) => `${CAUSAS_USUARIO[c]} ${entero(n)}`).join(" · ")}.`)}
        </p>
      )}
      {lista.length > 0 && (
        <ul className="divide-y divide-linea rounded-md bg-white ring-1 ring-linea">
          {lista.slice(0, 8).map((x) => (
            <li key={x.id}>
              <button type="button" className="flex w-full items-start gap-2 px-2 py-1.5 text-left" onClick={() => onVer(x.id)} title={tx(`Ver ${x.nombre} en el mapa`, `Show ${x.nombre} on the map`)}>
                <i className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2" style={{ background: `${ESTADOS_USUARIO[x.estado].color}66`, ["--tw-ring-color" as string]: ESTADOS_USUARIO[x.estado].color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <b className="text-[12.5px] font-semibold">{x.nombre}</b>
                    <span className="text-[11.5px] text-tenue tabular-nums">
                      {tx(`vuelve ${fmt(x.exitoPct, 0)} % · hasta ${fmt(x.esperaP95S, 0)} s`, `${fmt(x.exitoPct, 0)}% come back · up to ${fmt(x.esperaP95S, 0)} s`)}
                      {x.saltos !== null ? ` · ${saltosTexto(x.saltos)}` : ""}
                      {x.snrDb !== null ? ` · SNR ${fmt(x.snrDb, 1)} dB` : ""}
                    </span>
                  </span>
                  {x.porque && <span className="block text-[11.5px] leading-snug text-carbon-2">{x.porque}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {lista.length > 8 && (
        <p className="text-[11.5px] text-tenue">
          {tx(
            `Y ${entero(lista.length - 8)} más; en el mapa cada persona lleva el color de su estado en el contorno.`,
            `And ${entero(lista.length - 8)} more; on the map each person carries the color of their status on the outline.`,
          )}
        </p>
      )}
      <p className="text-[11px] leading-snug text-tenue">
        {tx(
          "Para cada persona: la física de su ruta (el margen de cada enlace, ida y vuelta, con los reintentos del protocolo) por lo que se perdió en cada nodo de su ruta (choques, transmitiendo, cola llena), ajustado con lo que completó su zona y con sus propios mensajes simulados.",
          "For each person: the physics of their route (the margin of each link, there and back, with the protocol's retries) times what was lost at each node on their route (collisions, transmitting, full queue), adjusted by what their zone completed and by their own simulated messages.",
        )}
      </p>
    </div>
  );
}

const colorPunto = (p: { estadoPunto: EstadoZona; estadoRed: EstadoZona }) =>
  p.estadoPunto === "revienta" || p.estadoRed === "revienta" ? COLOR_ESTADO.revienta : p.estadoPunto === "lento" || p.estadoRed === "lento" ? COLOR_ESTADO.lento : COLOR_ESTADO.aguanta;

/** Personas en el punto frente a lo que completan el punto y la red: hasta dónde aguanta. */
function CurvaLimite({ l }: { l: LimitePunto }) {
  useIdioma();
  const pts = l.puntos;
  if (pts.length < 2) return null;
  const ancho = 300;
  const alto = 110;
  const maxX = Math.max(...pts.map((p) => p.personas)) * 1.04;
  const x = (v: number) => 26 + (v / maxX) * (ancho - 32);
  const y = (v: number) => alto - (Math.max(0, Math.min(100, v)) / 100) * (alto - 8);
  const linea = (f: (p: (typeof pts)[number]) => number) => pts.map((p) => `${x(p.personas)},${y(f(p))}`).join(" ");
  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${ancho} ${alto + 26}`} className="w-full" role="img" aria-label={tx(`Mensajes completos según las personas en ${l.nombre}`, `Completed messages vs. people at ${l.nombre}`)}>
        {[0, 50, 90, 100].map((v) => (
          <g key={v}>
            <line x1={26} x2={ancho} y1={y(v)} y2={y(v)} stroke={v === 90 ? "#2B2F2E" : "#D9D5CC"} strokeDasharray={v === 90 ? "4 3" : undefined} strokeWidth={1} />
            <text x={22} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#6F7572">
              {v}
            </text>
          </g>
        ))}
        {l.personasSeguro !== null && l.personasSeguro <= maxX && <line x1={x(l.personasSeguro)} x2={x(l.personasSeguro)} y1={4} y2={alto} stroke={COLOR_ESTADO.aguanta} strokeDasharray="2 3" strokeWidth={1.2} />}
        <polyline fill="none" stroke="#9AA19D" strokeDasharray="3 3" strokeWidth={1.2} points={linea((p) => p.redCompletosPct)} />
        <polyline fill="none" stroke="#2B2F2E" strokeWidth={1.6} points={linea((p) => p.completosPct)} />
        {pts.map((p) => (
          <circle key={p.factor} cx={x(p.personas)} cy={y(p.completosPct)} r={3.6} fill={colorPunto(p)}>
            <title>
              {tx(
                `${entero(p.personas)} personas (${fmt(p.mensajesHora, 0)} mensajes/h): el punto ${fmt(p.completosPct, 0)} % con respuesta, el 95 % en ${fmt(p.p95S, 0)} s; la red ${fmt(p.redCompletosPct, 0)} %; canal ${fmt(p.canalPct, 0)} %`,
                `${entero(p.personas)} people (${fmt(p.mensajesHora, 0)} messages/h): the point ${fmt(p.completosPct, 0)}% with a reply, 95% within ${fmt(p.p95S, 0)} s; the network ${fmt(p.redCompletosPct, 0)}%; channel ${fmt(p.canalPct, 0)}%`,
              )}
            </title>
          </circle>
        ))}
        {[0, 0.5, 1].map((k) => {
          const v = Math.round((maxX / 1.04) * k);
          return (
            <text key={k} x={x(v)} y={alto + 10} textAnchor={k === 0 ? "start" : k === 1 ? "end" : "middle"} fontSize={9} fill="#6F7572">
              {entero(v)}
            </text>
          );
        })}
        <text x={(ancho + 26) / 2} y={alto + 22} textAnchor="middle" fontSize={9} fill="#6F7572">
          {tx("personas en el punto · % con respuesta (punteada: toda la red)", "people at the point · % with a reply (dotted: whole network)")}
        </text>
      </svg>
    </figure>
  );
}

function BloqueLimite({ l }: { l: LimitePunto }) {
  useIdioma();
  return (
    <div className="space-y-1.5 rounded-md bg-papel-2/60 p-2" data-tour="limite-estres">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
        <Gauge size={14} /> {tx(`Límite de ${l.nombre}`, `Limit of ${l.nombre}`)}
      </p>
      <p className="text-[12.5px] leading-snug text-carbon">{textoLimite(l)}</p>
      {l.llenado && <p className="text-[12.5px] leading-snug font-medium text-carbon-2">{textoLlenado(l)}</p>}
      <CurvaLimite l={l} />
      {!l.motivo && (
        <p className="text-[11.5px] leading-snug text-tenue">
          {tx(
            `Se sube solo la gente de este punto (sus mensajes de la hora pico: pagos, WhatsApp y consultas a la IA), con el resto de la red como está. Aguanta: el 90 % del punto y de cada zona recibe respuesta y el 95 % en menos de un minuto. Se prueba hasta ${entero(l.tope)} personas.`,
            `Only the people at this point are raised (their peak-hour messages: payments, WhatsApp and AI queries), with the rest of the network as it is. Holds up: 90% of the point and of each zone get a reply, and 95% within a minute. It's tested up to ${entero(l.tope)} people.`,
          )}
        </p>
      )}
    </div>
  );
}

/** El límite de cada punto, uno a la vez (los demás como están). */
function TablaLimites({ limites, onVer }: { limites: LimitePunto[]; onVer: (id: string) => void }) {
  useIdioma();
  const cifra = (x: number | null, mas = false) => (x === null ? "—" : `${mas ? "+" : "~"}${entero(x)}`);
  return (
    <div className="space-y-1.5 rounded-md bg-papel-2/60 p-2" data-tour="limites-estres">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
        <Gauge size={14} /> {tx("Límite de cada punto", "Limit of each point")}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead className="text-left text-tenue">
            <tr>
              <th className="py-0.5 pr-1 font-normal">{tx("Punto", "Point")}</th>
              <th className="px-1 font-normal">{tx("Hoy", "Today")}</th>
              <th className="px-1 font-normal">{tx("Aguanta", "Holds up")}</th>
              <th className="px-1 font-normal">{tx("Lento", "Slow")}</th>
              <th className="pl-1 font-normal">{tx("Revienta", "Overloaded")}</th>
            </tr>
          </thead>
          <tbody>
            {limites.map((l) => (
              <tr key={l.id}>
                <td className="py-0.5 pr-1">
                  <button type="button" className="text-left font-medium text-salvia-oscura" onClick={() => onVer(l.id)}>
                    {l.nombre}
                  </button>
                </td>
                <td className="px-1">{entero(l.personas)}</td>
                <td className="px-1 font-semibold" style={{ color: l.personasSeguro !== null && !l.redYaFalla ? COLOR_ESTADO.aguanta : COLOR_ESTADO.revienta }}>
                  {l.motivo ? "—" : l.redYaFalla ? tx("red llena", "network full") : cifra(l.personasSeguro, l.aguantaTodo)}
                </td>
                <td className="px-1">{cifra(l.personasLento)}</td>
                <td className="pl-1">{cifra(l.personasQuiebre)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] leading-snug text-carbon-2">
        {limites.map((l) => (
          <li key={l.id}>{textoLimite(l, true)}</li>
        ))}
      </ul>
      <p className="text-[11.5px] leading-snug text-tenue">
        {tx(
          "Cada punto se prueba con los demás como están. Si todos se llenan a la vez comparten el canal y aguantan menos: «¿Hasta dónde aguanta cada repetidor?» lo mide con toda la red subiendo junta.",
          "Each point is tested with the others as they are. If they all fill up at once they share the channel and handle less: “How much can each repeater handle?” measures it with the whole network rising together.",
        )}
      </p>
    </div>
  );
}

const rango = (e: EstadoZona) => ({ revienta: 0, lento: 1, aguanta: 2, "sin-pagos": 3 })[e];
// Quita «Trama » y la nota del final, en español o en inglés: «(alcance)», «(capacidad)», «(range)», «(capacity)»
const nombreCorto = (n: string) => n.replace(/^Trama /, "").replace(/ \((alcance|capacidad|range|capacity)\)$/, "");

function Supuestos({ r }: { r: ResultadoEstres }) {
  useIdioma();
  const [abierto, setAbierto] = useState(false);
  const partesIa = Math.ceil(TRAFICO_MEDIDO.respuestaIaBytes / PROTOCOLOS[r.protocolo].textoMaximo);
  return (
    <div>
      <button type="button" className="flex items-center gap-1 text-[12px] font-medium text-salvia-oscura" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <ChevronDown size={14} className={abierto ? "rotate-180" : ""} /> {tx("Cómo se mide (supuestos)", "How it's measured (assumptions)")}
      </button>
      {abierto && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] leading-snug text-carbon-2">
          <li>
            {tx(
              `Carga: ${fmt(r.pagosPersonaDia, 1)} mensajes por persona al día entre pagos, WhatsApp y consultas a la IA (el ritmo de Trama: 55 por hora por frecuencia con 150 usuarios; si la gente escribe o consulta más, súbalo o multiplique la carga), el ${r.horaPicoPct} % en la hora pico${r.factor !== 1 ? `, multiplicado ×${r.factor}` : ""}. Se simulan ${r.duracionMin} minutos de hora pico, dos sorteos.`,
              `Load: ${fmt(r.pagosPersonaDia, 1)} messages per person per day across payments, WhatsApp and AI queries (Trama's pace: 55 per hour per frequency with 150 users; if people write or query more, raise it or multiply the load), ${r.horaPicoPct}% of them in the peak hour${r.factor !== 1 ? `, multiplied ×${r.factor}` : ""}. ${r.duracionMin} minutes of peak hour are simulated, two draws.`,
            )}
          </li>
          {r.perfil === "medido" ? (
            <li>
              {tx(
                `Tráfico medido en ${FICHA_GATEWAY.enFrase} (${FICHA_GATEWAY.semana}): comandos de ${FICHA_GATEWAY.mensaje.minimo} a ${FICHA_GATEWAY.mensaje.maximo} caracteres (mediana ${FICHA_GATEWAY.mensaje.mediana}) con una respuesta de ~${TRAFICO_MEDIDO.respuestaBytes} B; el ${TRAFICO_MEDIDO.iaPct} % son consultas a la IA (${FICHA_GATEWAY.ia.tokens} tokens, en paralelo, respuesta en ${partesIa} partes de hasta ${PROTOCOLOS[r.protocolo].textoMaximo} B). El gateway atiende de a uno (~${FICHA_GATEWAY.proceso.porMensajeS} s por mensaje; a veces hasta ${FICHA_GATEWAY.proceso.peorS} s si la base de datos tarda).`,
                `Traffic measured at ${FICHA_GATEWAY.enFrase} (${FICHA_GATEWAY.semana}): commands of ${FICHA_GATEWAY.mensaje.minimo} to ${FICHA_GATEWAY.mensaje.maximo} characters (median ${FICHA_GATEWAY.mensaje.mediana}) with a reply of ~${TRAFICO_MEDIDO.respuestaBytes} B; ${TRAFICO_MEDIDO.iaPct}% are AI queries (${FICHA_GATEWAY.ia.tokens} tokens, in parallel, reply in ${partesIa} parts of up to ${PROTOCOLOS[r.protocolo].textoMaximo} B). The gateway handles one at a time (~${FICHA_GATEWAY.proceso.porMensajeS} s per message; sometimes up to ${FICHA_GATEWAY.proceso.peorS} s if the database is slow).`,
              )}
            </li>
          ) : (
            <li>
              {tx(
                "Cada mensaje se mide con el tamaño de un pago del documento de Trama: 118 B de ida al gateway (la orden firmada, el WhatsApp o la consulta), 126 B de vuelta (el comprobante, la confirmación o la respuesta de la IA) y un aviso de 126 B a quien recibe, con sus acuses y los reintentos del protocolo. Un WhatsApp largo o una respuesta larga de la IA ocupan más aire.",
                "Each message is measured with the size of a payment from the Trama document: 118 B out to the gateway (the signed order, the WhatsApp message or the query), 126 B back (the receipt, the confirmation or the AI's reply) and a 126 B notice to the recipient, with their acknowledgments and the protocol's retries. A long WhatsApp message or a long AI reply takes more airtime.",
              )}
            </li>
          )}
          <li>
            {r.protocolo === "meshtastic"
              ? tx(
                  `Meshtastic paquete por paquete: inundación administrada (cada nodo espera según la SNR y cancela si oye que otro ya lo repitió; los ROUTER no cancelan), límite de saltos, siguiente salto aprendido, acuse del destino y hasta ${PROTOCOLOS.meshtastic.envios} envíos (el último por inundación), cabecera de 16 B y cola de ${PROTOCOLOS.meshtastic.colaRadio} paquetes, sin tope de ciclo en 915 MHz.`,
                  `Meshtastic packet by packet: managed flooding (each node waits according to the SNR and cancels if it hears that another one already repeated it; ROUTER nodes don't cancel), hop limit, learned next hop, acknowledgment from the destination and up to ${PROTOCOLOS.meshtastic.envios} sends (the last one by flooding), a 16 B header and a ${PROTOCOLOS.meshtastic.colaRadio}-packet queue, with no duty-cycle cap at 915 MHz.`,
                )
              : tx(
                  `MeshCore paquete por paquete: solo los repetidores retransmiten, ruta aprendida o inundación, acuses y 3 reintentos (el último por inundación), ciclo de trabajo del ${TOPE_CICLO_PCT} % y colas de 32 (repetidor) y 16 (billetera).`,
                  `MeshCore packet by packet: only repeaters retransmit, learned route or flooding, acknowledgments and 3 retries (the last one by flooding), a ${TOPE_CICLO_PCT}% duty cycle and queues of 32 (repeater) and 16 (wallet).`,
                )}
          </li>
          <li>
            {tx("Enlaces: ", "Links: ")}
            {r.curva === "campo"
              ? tx(
                  `la curva medida en campo (con ${fmt(FICHA_GATEWAY.erroresPct, 1)} % de paquetes con error y cerca de la mitad pasando con SNR de −12 dB)`,
                  `the curve measured in the field (with ${fmt(FICHA_GATEWAY.erroresPct, 1)}% of packets with errors and about half getting through at an SNR of −12 dB)`,
                )
              : tx(
                  "la curva del diseño (20 dB de margen ≈ 70 % de los paquetes, 30 dB ≈ 98 %), conservadora porque cubre el error del modelo",
                  "the design curve (20 dB of margin ≈ 70% of packets, 30 dB ≈ 98%), conservative because it covers the model error",
                )}
            .
          </li>
          <li>
            {tx(
              "Aguanta: el 90 % o más recibe su respuesta y el 95 % en menos de un minuto. Lento: aguanta pero tarda más. Se revienta: menos del 90 %.",
              "Holds up: 90% or more get their reply, and 95% within a minute. Slow: holds up but takes longer. Gets overloaded: fewer than 90%.",
            )}
          </li>
          <li>
            {tx(
              "La zona de un nodo son las personas que entran a la malla por él (su primer salto). El canal es el % del tiempo con alguna señal al aire que ese nodo oye; «transmite» es su propio aire",
              "A node's zone is the people who enter the mesh through it (their first hop). The channel is the % of time with some signal on air that the node hears; “transmits” is its own airtime",
            )}
            {r.protocolo === "meshtastic"
              ? tx(` (Meshtastic recorta posiciones y telemetría desde el ${PROTOCOLOS.meshtastic.canalAlertaPct} % de canal)`, ` (Meshtastic cuts back positions and telemetry from ${PROTOCOLOS.meshtastic.canalAlertaPct}% channel use)`)
              : tx(` (el repetidor se frena al ${TOPE_CICLO_PCT} %)`, ` (the repeater throttles itself at ${TOPE_CICLO_PCT}%)`)}
            .
          </li>
          <li>
            {tx(
              "Cada persona: le funciona bien con el 95 % o más de sus mensajes de vuelta en menos de 30 s; le funciona con el 90 % en menos de un minuto; a medias del 75 al 90 % (o más lento); con dificultades del 40 al 75 %; no le funciona por debajo o sin ruta.",
              "Each person: it works well with 95% or more of their messages back within 30 s; it works with 90% within a minute; partly from 75 to 90% (or slower); with difficulties from 40 to 75%; it doesn't work below that or with no route.",
            )}
          </li>
          <li>
            {tx(
              "Alcance con carga: del más cercano al más lejano, hasta dónde completa el 90 % de los mensajes. Los lejanos llegan más débiles y pierden primero cuando dos señales se pisan.",
              "Range under load: from nearest to farthest, how far out 90% of the messages complete. Distant ones arrive weaker and lose first when two signals overlap.",
            )}
          </li>
          <li>
            <BatteryCharging size={12} className="inline" />{" "}
            {tx(
              `Energía del repetidor solar P1: ${fmt(ENERGIA_P1.txW, 2)} W al transmitir y ${fmt(ENERGIA_P1.rxW, 2)} W escuchando; panel de ${ENERGIA_P1.panelW} W × ${ENERGIA_P1.horasSol} h de sol × ${fmt(ENERGIA_P1.eficiencia * 100, 0)} % ≈ ${fmt(ENERGIA_P1.panelW * ENERGIA_P1.horasSol * ENERGIA_P1.eficiencia, 0)} Wh/día; batería útil ≈ ${fmt(ENERGIA_P1.bateriaWh, 0)} Wh.`,
              `Energy of the P1 solar repeater: ${fmt(ENERGIA_P1.txW, 2)} W when transmitting and ${fmt(ENERGIA_P1.rxW, 2)} W listening; ${ENERGIA_P1.panelW} W panel × ${ENERGIA_P1.horasSol} h of sun × ${fmt(ENERGIA_P1.eficiencia * 100, 0)}% ≈ ${fmt(ENERGIA_P1.panelW * ENERGIA_P1.horasSol * ENERGIA_P1.eficiencia, 0)} Wh/day; usable battery ≈ ${fmt(ENERGIA_P1.bateriaWh, 0)} Wh.`,
            )}
          </li>
          <li>
            {tx(
              "Una sola frecuencia: el sitio de Trama lleva 4 radios (4 frecuencias) y reparte los repetidores entre ellas; con 4 frecuencias bien repartidas la capacidad sube hasta 4 veces.",
              "A single frequency: the Trama site carries 4 radios (4 frequencies) and spreads the repeaters among them; with 4 well-distributed frequencies, capacity rises up to 4 times.",
            )}
          </li>
          <li>{tx("Son estimaciones para planear; se validan midiendo el canal en una red piloto.", "These are planning estimates; they're validated by measuring the channel in a pilot network.")}</li>
        </ul>
      )}
    </div>
  );
}
