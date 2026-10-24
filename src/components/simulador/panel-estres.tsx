"use client";

// Zonas de popularidad y prueba de estrés de la hora pico. Una zona de popularidad pone N personas alrededor de un
// gateway o repetidor (o de todos) para ver cuánto aguanta cada uno; la prueba de estrés hace que todas usen la red a
// su ritmo en la hora pico (pagos, WhatsApp y consultas a la IA) y mide, repetidor por repetidor, mensajes completos,
// espera, canal, ciclo de trabajo, colas,
// alcance con carga y energía; la rampa sube la carga hasta encontrar dónde se revienta cada zona.
import { Activity, BatteryCharging, ChevronDown, Flame, Gauge, MapPinned, Radio, Trash, TrendingUp, Users } from "lucide-react";
import { useState } from "react";

import { presetPorId } from "@/lib/radio/constantes";
import { ENERGIA_P1, PEDIDO_ESTRES_DEFECTO, TOPE_CICLO_PCT, TOPE_PERSONAS_PUNTO, type EstadoZona, type LimitePunto, type LimiteZona, type ResultadoEstres, type ZonaEstres } from "@/lib/radio/estres";
import { CAPACIDAD_TRAMA } from "@/lib/radio/trama";
import type { Parametros } from "@/lib/radio/tipos";

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

const entero = (n: number) => Math.round(n).toLocaleString("es-CO");

function Chips({ valores, valor, onCambio, sufijo = "" }: { valores: readonly number[]; valor: number; onCambio: (v: number) => void; sufijo?: string }) {
  return (
    <>
      {valores.map((v) => (
        <button key={v} type="button" onClick={() => onCambio(v)} aria-pressed={valor === v} className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1 ${valor === v ? "bg-carbon text-white ring-carbon" : "bg-white ring-linea hover:bg-papel-2"}`}>
          {v}
          {sufijo}
        </button>
      ))}
    </>
  );
}

export function textoZonas(x: ResultadoZonas): string {
  if ("error" in x) return x.error;
  const una = x.zonas.length === 1 ? x.zonas[0] : null;
  const donde = una ? `alrededor de ${una.nombre}` : `en ${x.zonas.length} zonas (${entero(x.puestas / Math.max(1, x.zonas.length))} en promedio por zona)`;
  const corto = x.puestas < x.pedidas ? ` de ${entero(x.pedidas)}: ${x.recortado ? `el tope es ${entero(MAX_POBLADAS)} personas pobladas en total` : x.conSenal ? "solo hay señal en parte de la zona" : "no cupieron más sin quedar encimadas"}` : "";
  return `Puse ${entero(x.puestas)} personas${corto} ${donde}, a ${fmt(x.radioKm, x.radioKm % 1 ? 1 : 0)} km${x.conSenal ? ", todas con señal" : ""}.`;
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
          <MapPinned size={16} /> Zonas de popularidad
        </span>
      </Titulo>
      {!centros.length ? (
        <p className="text-[13px] leading-snug text-tenue">Ponga el gateway y los repetidores primero: cada zona de popularidad es gente alrededor de uno de ellos.</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[12.5px] leading-snug text-carbon-2">
            Pone gente alrededor de un repetidor o del gateway (o de cada uno), con la cantidad que quiera, para ver si la red queda estable con todos enviando información en la hora pico: pagos, WhatsApp y consultas a la IA. «¿Cuántas aguanta?» busca el límite de cada punto.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chips valores={[50, 150, 250, 500]} valor={n} onCambio={setN} />
            <label className="flex items-center gap-1 text-[12.5px] text-carbon-2">
              <input
                aria-label="Personas por zona"
                className="campo w-20 py-1 tabular-nums"
                inputMode="numeric"
                value={String(n)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/\D/g, ""));
                  if (Number.isFinite(v)) setN(Math.min(MAX_POR_ZONA, v));
                }}
              />
              por zona
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12.5px] text-carbon-2">A la redonda</span>
            <Segmentado<string> etiqueta="Radio de la zona" valor={String(radioKm)} onCambio={(v) => setRadioKm(Number(v))} opciones={RADIOS_ZONA_KM.map((r) => ({ valor: String(r), texto: `${r} km` }))} />
          </div>
          <label className="block text-[12.5px] text-carbon-2">
            <span className="mb-1 block">Dónde</span>
            <select className="campo" value={elegido?.id ?? "todos"} onChange={(e) => setDonde(e.target.value)} aria-label="Dónde poner la zona de popularidad">
              <option value="todos">En cada gateway y repetidor ({centros.length})</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  Solo alrededor de {c.nombre}
                  {c.personas ? ` (tiene ${entero(c.personas)})` : ""}
                </option>
              ))}
            </select>
          </label>
          <Interruptor etiqueta="Solo donde hay señal" detalle={hayResultado ? "Con servicio (≥ 20 dB) en la última simulación" : "Simule primero para usarlo"} activo={soloConSenal && hayResultado} onCambio={setSoloConSenal} />
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="principal"
              deshabilitado={n < 1 || ocupado}
              tour="boton-zonas"
              onClick={() => onPoner({ centros: elegido ? [elegido.id] : undefined, n, radioKm, soloConSenal: soloConSenal && hayResultado, semilla: Math.floor(Math.random() * 1e6) })}
            >
              <Users size={16} /> {elegido ? `Poner ${entero(n)} alrededor de ${elegido.nombre}` : `Poner ${entero(n)} en cada uno (${entero(total)})`}
            </Boton>
            <Boton deshabilitado={n < 1 || ocupado} tour="boton-zonas-probar" onClick={() => onProbar({ centros: elegido ? [elegido.id] : undefined, n, radioKm, soloConSenal: soloConSenal && hayResultado, semilla: Math.floor(Math.random() * 1e6) })}>
              <Activity size={16} /> Poner y probar
            </Boton>
            <Boton deshabilitado={ocupado} tour="boton-limites" onClick={() => onLimites({ centros: elegido ? [elegido.id] : undefined, n, radioKm })}>
              <Gauge size={16} /> {elegido ? `¿Cuántas aguanta ${elegido.nombre}?` : "¿Cuántas aguanta cada punto?"}
            </Boton>
            {conZona.length > 0 && (
              <Boton onClick={onQuitar}>
                <Trash size={15} /> Quitar las zonas
              </Boton>
            )}
          </div>
          {total > MAX_POBLADAS && <p className="text-[12px] text-tenue">Se ponen hasta {entero(MAX_POBLADAS)} personas pobladas en total; se reparten por igual entre las zonas.</p>}
          {conZona.length > 0 && (
            <p className="text-[12px] leading-snug text-tenue">
              Zonas puestas: {conZona.map((c) => `${c.nombre} ${entero(c.personas)}`).join(" · ")}. Volver a poner una zona la reparte de nuevo.
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

const TEXTO_ESTADO_RED: Record<EstadoZona, string> = { aguanta: "estable", lento: "lenta", revienta: "se revienta", "sin-pagos": "sin mensajes" };

/** El límite de un punto en palabras (pantalla y Melki). */
export function textoLimite(l: LimitePunto, corto = false): string {
  if (l.motivo) return l.motivo;
  const hoy = `hoy tiene ${entero(l.personas)} ${l.personas === 1 ? "persona" : "personas"}${l.deZona ? "" : " que entran a la malla por él"}`;
  if (l.redYaFalla)
    return `Aun con muy poca gente en ${l.nombre}, la red no aguanta sin demora: ${l.falla?.nombres.join(", ") ?? "las otras zonas"} ya ${l.falla && l.falla.nombres.length === 1 ? "llena" : "llenan"} el canal${l.falla?.limites.length ? ` (${l.falla.limites.map((x) => TEXTO_LIMITE[x]).join(", ")})` : ""}. Baje la gente de esas zonas, reparta las 4 frecuencias o ponga otro sitio gateway.`;
  if (l.personasSeguro === null) return `${l.nombre} no aguanta sin demora ni con muy poca gente (${hoy}).`;
  const msj = l.mensajesHoraMax !== null ? ` (${entero(l.mensajesHoraMax)} mensajes por hora en la hora pico)` : "";
  if (l.aguantaTodo) return `${l.nombre} aguanta más de ${entero(l.personasSeguro)} personas sin demora${msj}: es lo máximo que se prueba en un punto${corto ? "" : `; ${hoy}`}.`;
  const rango = l.rango ? ` (entre ~${entero(l.rango[0])} y ~${entero(l.rango[1])} según el sorteo)` : "";
  const tramos = [`${l.nombre} aguanta sin demora hasta ~${entero(l.personasSeguro)} personas${rango}${msj}`];
  if (l.personasLento !== null) tramos.push(`desde ~${entero(l.personasLento)} va lento (la espera pasa de un minuto)`);
  if (l.personasQuiebre !== null) tramos.push(`se revienta desde ~${entero(l.personasQuiebre)}`);
  let falla = "";
  if (l.falla) {
    const porque = l.falla.limites.length ? l.falla.limites.map((x) => TEXTO_LIMITE[x]).join(", ") : l.falla.estado === "lento" ? "la espera pasa de un minuto" : "menos del 90 % recibe respuesta";
    falla = l.falla.quien === "punto" ? ` Lo primero que falla es el propio ${l.nombre} (${porque}).` : ` Lo primero que falla es ${l.falla.nombres.join(", ")} (${porque}): la gente de este punto también ocupa su canal.`;
  }
  return `${tramos.join("; ")}.${falla}${corto ? "" : ` Con el resto de la red como está${l.llenado ? "" : `; ${hoy}`}.`}`;
}

/** Cómo quedó el punto al llenarlo hasta el límite. */
export function textoLlenado(l: LimitePunto): string {
  const x = l.llenado;
  if (!x) return "";
  return `Lo llené con ${entero(x.personas)} personas y simulé la hora pico: el punto ${TEXTO_ESTADO_RED[x.estadoPunto]}, la red ${TEXTO_ESTADO_RED[x.estadoRed]}${x.intentos > 1 ? ` (bajé la cantidad ${x.intentos - 1} ${x.intentos === 2 ? "vez" : "veces"} hasta que quedó estable)` : ""}.`;
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
  const [texto, setTexto] = useState<string>(String(personas || ZONA_DEFECTO.n));
  const [radioKm, setRadioKm] = useState<number>(ZONA_DEFECTO.radioKm);
  const leido = Number(texto.replace(/\D/g, ""));
  const n = Math.min(MAX_POR_ZONA, Math.max(0, Number.isFinite(leido) ? leido : 0));
  const boton = "rounded-md px-2 py-1 text-[12.5px] font-medium disabled:opacity-50";
  const seguro = limite && !limite.motivo && !limite.redYaFalla && limite.personasSeguro !== null ? Math.min(MAX_POR_ZONA, limite.personasSeguro) : null;
  return (
    <div className="space-y-1.5 rounded-lg bg-papel-2/70 p-2" data-tour="zona-rapida">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
        <MapPinned size={14} /> Zona de popularidad{personas ? ` · ${entero(personas)} personas` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <label className="flex items-center gap-1 text-[12.5px] text-carbon-2">
          <input
            aria-label={`Personas alrededor de ${nombre}`}
            className="campo w-[4.6rem] py-0.5 text-[12.5px] tabular-nums"
            inputMode="numeric"
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
          personas
        </label>
        <select className="campo w-auto py-0.5 text-[12.5px]" value={String(radioKm)} onChange={(e) => setRadioKm(Number(e.target.value))} aria-label="Radio de la zona">
          {RADIOS_ZONA_KM.map((r) => (
            <option key={r} value={r}>
              a {r} km
            </option>
          ))}
        </select>
      </div>
      {leido > MAX_POR_ZONA && <p className="text-[11.5px] text-tenue">Hasta {entero(MAX_POR_ZONA)} personas por punto.</p>}
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" disabled={n < 1 || Boolean(ocupado)} onClick={() => onPoner(n, radioKm)} className={`${boton} bg-carbon text-white hover:bg-carbon-2`}>
          {personas ? "Repartir de nuevo" : "Poblar alrededor"}
        </button>
        <button type="button" disabled={n < 1 || Boolean(ocupado)} onClick={() => onPunto("probar", n, radioKm)} className={`${boton} inline-flex items-center gap-1 bg-white ring-1 ring-linea hover:bg-papel-2`} title={`Pone ${entero(n)} personas y simula la hora pico con todos enviando información`}>
          <Activity size={13} /> Poner y probar
        </button>
        <button type="button" disabled={Boolean(ocupado) || (!personas && n < 1)} onClick={() => onPunto("limite", n, radioKm)} className={`${boton} inline-flex items-center gap-1 bg-white ring-1 ring-linea hover:bg-papel-2`} title="Sube la gente de este punto, con el resto de la red como está, hasta encontrar cuántas aguanta">
          <Gauge size={13} /> ¿Cuántas aguanta?
        </button>
        {personas > 0 && (
          <button type="button" disabled={Boolean(ocupado)} onClick={onQuitar} className={`${boton} px-1.5 text-sin hover:bg-sin/10`} aria-label={`Quitar la zona de ${nombre}`}>
            Quitar
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
          Hora pico: {TEXTO_ESTADO[zona.estado].toLowerCase()} · {fmt(zona.completosPct, 0)} % completos · espera {fmt(zona.p95S, 0)} s · canal {fmt(zona.canalPct, 0)} %{red ? ` · red ${TEXTO_ESTADO_RED[red]}` : ""}
          {zona.usuariosMax !== null && zona.usuariosMax !== undefined ? ` · aguanta ${zona.aguantaTodo ? "más de" : "hasta"} ~${entero(zona.usuariosMax)} personas` : ""}
        </p>
      )}
      {limite && (
        <div className="space-y-1" data-tour="limite-punto">
          <p className="text-[12px] leading-snug font-medium text-carbon">{textoLimite(limite, true)}</p>
          {limite.llenado && <p className="text-[12px] leading-snug text-carbon-2">{textoLlenado(limite)}</p>}
          {seguro !== null && seguro !== personas && (
            <button type="button" disabled={Boolean(ocupado)} onClick={() => onPunto("llenar", seguro, radioKm)} className={`${boton} inline-flex items-center gap-1 bg-salvia-oscura text-white hover:opacity-90`}>
              <Users size={13} /> Llenar hasta el límite ({entero(seguro)})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────── Prueba de estrés ───────────── */

export type OpcionesEstres = { pagosPersonaDia: number; horaPicoPct: number; factor: number; rampa: boolean; comparar: boolean; foco?: string | null };

export const ESTRES_DEFECTO: OpcionesEstres = {
  pagosPersonaDia: PEDIDO_ESTRES_DEFECTO.pagosPersonaDia,
  horaPicoPct: PEDIDO_ESTRES_DEFECTO.horaPicoPct,
  factor: 1,
  rampa: false,
  comparar: false,
};

export type FaseEstres =
  | { fase: "nada" }
  | { fase: "probando"; rampa: boolean; avance: number; texto?: string }
  | { fase: "listo"; resultado: ResultadoEstres; firma: string; opciones: OpcionesEstres; limites?: LimitePunto[] }
  | { fase: "error"; texto: string };

export const COLOR_ESTADO: Record<EstadoZona, string> = { aguanta: "#1E7B34", lento: "#F08A2C", revienta: "#D93A2E", "sin-pagos": "#9AA19D" };
export const TEXTO_ESTADO: Record<EstadoZona, string> = { aguanta: "Aguanta", lento: "Aguanta, pero lento", revienta: "Se revienta", "sin-pagos": "Sin mensajes" };

const TEXTO_LIMITE: Record<LimiteZona, string> = {
  canal: "canal lleno",
  ciclo: `al tope del ciclo de trabajo (${TOPE_CICLO_PCT} %)`,
  cola: "cola llena: descarta paquetes",
  choques: "muchos choques",
  alcance: "pierde alcance con la carga",
  energia: "la energía no alcanza",
};

const km = (x: number) => `${fmt(x, x < 10 ? 1 : 0)} km`;

/** Resumen en una línea de una zona. */
export function lineaZona(z: ZonaEstres): string {
  if (z.estado === "sin-pagos") return `${z.nombre}: sin personas que usen la red por él${z.usuariosRuta ? ` (pasan ${entero(z.usuariosRuta)} de otras zonas)` : ""}.`;
  return `${z.nombre} (${entero(z.usuarios)} personas, ${fmt(z.pagosHora, 0)} mensajes/h): ${TEXTO_ESTADO[z.estado].toLowerCase()}, ${fmt(z.completosPct, 0)} % completos, el 95 % en ${fmt(z.p95S, 0)} s, canal ${fmt(z.canalPct, 0)} %${z.limites.length ? `; ${z.limites.map((l) => TEXTO_LIMITE[l]).join(", ")}` : ""}.`;
}

function FilaZona({ z, rampa, onVer }: { z: ZonaEstres; rampa: boolean; onVer: (id: string) => void }) {
  const color = COLOR_ESTADO[z.estado];
  return (
    <li className="px-2.5 py-2">
      <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => onVer(z.id)} title={`Ver ${z.nombre} en el mapa`}>
        <i className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <b className="font-cond text-[14.5px] leading-tight">{z.nombre}</b>
            <span className="text-[12px] font-semibold" style={{ color }}>
              {TEXTO_ESTADO[z.estado]}
            </span>
          </span>
          <span className="block text-[12px] leading-snug text-carbon-2 tabular-nums">
            {entero(z.usuarios)} personas{z.pieza === "repetidor" && z.usuariosRuta > z.usuarios ? ` (+${entero(z.usuariosRuta - z.usuarios)} de paso)` : ""} · {fmt(z.pagosHora, 0)} mensajes/h
            {z.estado !== "sin-pagos" ? ` · ${fmt(z.completosPct, 0)} % completos · el 95 % en ${fmt(z.p95S, 0)} s` : ""}
          </span>
          <span className="block text-[12px] leading-snug text-tenue tabular-nums">
            Canal {fmt(z.canalPct, 0)} % · transmite {fmt(z.txPct, 1)} % (tope {TOPE_CICLO_PCT} %){z.perdidasCola ? ` · ${z.perdidasCola} descartados` : ""}
            {z.usuarios > 0 ? ` · atiende hasta ${km(z.alcanceKm)}${z.limites.includes("alcance") && z.alcanceCargaKm ? `; con la carga completa solo hasta ${km(z.alcanceCargaKm)}` : ""}` : ""}
            {z.energia ? ` · energía ${fmt(z.energia.consumoWhDia, 1)} de ${fmt(z.energia.generaWhDia, 0)} Wh/día` : ""}
          </span>
          {z.limites.length > 0 && <span className="block text-[12px] leading-snug" style={{ color }}>{z.limites.map((l) => TEXTO_LIMITE[l]).join(" · ")}</span>}
          {rampa && z.usuarios > 0 && (
            <span className="block text-[12px] leading-snug font-medium text-carbon">
              {z.usuariosMax !== null && z.usuariosMax !== undefined
                ? `${z.aguantaTodo ? "Aguanta más de" : "Aguanta sin demora hasta"} ~${entero(z.usuariosMax)} personas (${fmt(z.pagosHoraMax ?? 0, 0)} mensajes/h)`
                : z.factorLento
                  ? `Va lenta aun con la carga más baja probada (~${entero(z.usuarios * z.factorLento)} personas)`
                  : "No aguanta ni con la carga más baja probada"}
              {z.factorQuiebre ? `; se revienta con ~${entero(z.usuarios * z.factorQuiebre)}` : ""}.
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** Mensajes pedidos frente a entregados por hora: sube con la carga hasta el máximo del canal y después cae (choques). */
function CurvaRendimiento({ r }: { r: NonNullable<ResultadoEstres["rampa"]> }) {
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
    <figure className="space-y-1" aria-label="Rendimiento de la malla">
      <svg viewBox={`0 0 ${ancho} ${alto + 26}`} className="w-full" role="img" aria-label="Mensajes por hora entregados según los pedidos">
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
            <title>{`${fmt(p.pedidosHora, 0)} mensajes/h pedidos (×${fmt(p.factor, p.factor < 1 ? 2 : 1)}): ${fmt(p.entregadosHora, 0)} entregados, ${fmt(p.completosPct, 0)} % completos, el 95 % en ${fmt(p.p95S, 0)} s`}</title>
          </circle>
        ))}
        <text x={(ancho + 26) / 2} y={alto + 22} textAnchor="middle" fontSize={9} fill="#6F7572">
          mensajes por hora pedidos (abajo) y entregados (al lado)
        </text>
      </svg>
      <figcaption className="text-[12px] leading-snug text-carbon-2">
        La malla entrega como máximo ~{fmt(r.maxEntregadosHora, 0)} mensajes por hora en esta frecuencia; si se le pide más, los choques se comen el canal y entrega menos. La línea punteada es lo ideal (entregar todo).
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
}: {
  parametros: Parametros;
  remitentes: number;
  estres: FaseEstres;
  desactualizado: boolean;
  onProbar: (o: OpcionesEstres) => void;
  onVerZona: (id: string) => void;
}) {
  const [o, setO] = useState<OpcionesEstres>(ESTRES_DEFECTO);
  const [verTodas, setVerTodas] = useState(false);
  const cambiar = (c: Partial<OpcionesEstres>) => setO((x) => ({ ...x, ...c }));
  const preset = presetPorId(parametros.preset);
  const r = estres.fase === "listo" ? estres.resultado : null;
  const pagosHora = remitentes * o.pagosPersonaDia * (o.horaPicoPct / 100) * o.factor;
  const zonas = r ? [...r.zonas].sort((a, b) => Number(b.usuarios > 0) - Number(a.usuarios > 0) || rango(a.estado) - rango(b.estado) || b.usuarios - a.usuarios) : [];
  const visibles = verTodas ? zonas : zonas.slice(0, 6);
  return (
    <section data-tour="prueba-estres" aria-labelledby="titulo-estres">
      <Titulo>
        <span id="titulo-estres" className="inline-flex items-center gap-1.5">
          <Flame size={16} /> Prueba de estrés · hora pico
        </span>
      </Titulo>
      <div className="space-y-2.5">
        <p className="text-[12.5px] leading-snug text-carbon-2">
          Todas las personas usan la red a su ritmo en la hora más cargada del día —pagos, mensajes de WhatsApp y consultas a la IA— y se mide cada gateway y repetidor: mensajes que completan, espera, canal ocupado, cuánto transmite, alcance con carga y energía. Ajuste de radio: {preset.nombre}.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] text-carbon-2">Mensajes por persona al día</span>
          <Chips valores={[1, PEDIDO_ESTRES_DEFECTO.pagosPersonaDia, 5, 10]} valor={o.pagosPersonaDia} onCambio={(pagosPersonaDia) => cambiar({ pagosPersonaDia })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmentado<string>
            etiqueta="Hora pico"
            valor={String(o.horaPicoPct)}
            onCambio={(v) => cambiar({ horaPicoPct: Number(v) })}
            opciones={[
              { valor: String(CAPACIDAD_TRAMA.horaPicoNormalPct), texto: "Día normal", titulo: `El ${CAPACIDAD_TRAMA.horaPicoNormalPct} % de los mensajes del día cae en la hora pico` },
              { valor: String(CAPACIDAD_TRAMA.horaPicoMercadoPct), texto: "Día de mercado", titulo: `El ${CAPACIDAD_TRAMA.horaPicoMercadoPct} % de los mensajes del día cae en la hora pico` },
            ]}
          />
          <Segmentado<string>
            etiqueta="Multiplicar la carga"
            valor={String(o.factor)}
            onCambio={(v) => cambiar({ factor: Number(v) })}
            opciones={[1, 2, 5, 10].map((f) => ({ valor: String(f), texto: `×${f}`, titulo: f === 1 ? "La hora pico tal cual" : `${f} veces la hora pico` }))}
          />
        </div>
        <p className="text-[12px] leading-snug text-tenue">
          {remitentes > 0
            ? `${entero(remitentes)} personas con ruta × ${fmt(o.pagosPersonaDia, 1)} mensajes al día × ${o.horaPicoPct} % en la hora pico${o.factor > 1 ? ` × ${o.factor}` : ""} = ${fmt(pagosHora, 0)} mensajes por hora.`
            : "Sin personas con ruta al gateway todavía."}
        </p>
        <Interruptor etiqueta="Comparar ajustes de radio" detalle="La misma hora pico con más alcance (62,5 kHz) o más capacidad (SF9 · 250 kHz)" activo={o.comparar} onCambio={(comparar) => cambiar({ comparar })} />
        <div className="flex flex-wrap gap-2">
          <Boton variante="principal" onClick={() => onProbar({ ...o, rampa: false })} tour="boton-estres" deshabilitado={estres.fase === "probando"}>
            <Activity size={16} /> Probar la hora pico
          </Boton>
          <Boton onClick={() => onProbar({ ...o, rampa: true })} tour="boton-rampa" deshabilitado={estres.fase === "probando"}>
            <TrendingUp size={16} /> ¿Hasta dónde aguanta cada repetidor?
          </Boton>
        </div>
        {remitentes === 0 && <p className="text-[12.5px] text-sin">No hay personas con ruta al gateway: ponga una zona de popularidad o personas donde haya cobertura y simule.</p>}
        {desactualizado && <p className="text-[12.5px] text-tenue">La red cambió después de esta prueba: pruebe de nuevo para ver la red de ahora.</p>}
        {estres.fase === "probando" && (
          <p className="flex items-center gap-2 text-[13px] text-carbon-2" role="status">
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-salvia border-t-transparent" aria-hidden="true" />
            {estres.texto ?? (estres.rampa ? "Subiendo la carga hasta que cada zona se reviente…" : "Simulando la hora pico paquete por paquete…")} {Math.round(estres.avance * 100)} %
          </p>
        )}
        {estres.fase === "error" && <p className="text-[13px] text-sin">{estres.texto}</p>}
        {r && estres.fase === "listo" && (
          <div className="space-y-2.5 rounded-lg bg-white p-2.5 ring-1 ring-linea" aria-label="Resultado de la prueba de estrés" data-tour="resultado-estres">
            {r.motivo ? (
              <p className="text-[13px] text-sin">{r.motivo}</p>
            ) : (
              <>
                <p className="font-cond text-[16px] leading-tight font-semibold" style={{ color: COLOR_ESTADO[r.estado] }}>
                  {TEXTO_ESTADO[r.estado]}: {fmt(r.completosPct, 0)} % de los mensajes de la hora pico con respuesta
                </p>
                <dl className="grid grid-cols-3 gap-1.5 text-[12px]">
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">Mensajes por hora</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{fmt(r.entregadosHora, 0)}</dd>
                    <dd className="text-[11px] text-tenue">de {fmt(r.pedidosHora, 0)} pedidos</dd>
                  </div>
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">Canal del gateway</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{fmt(r.canalGatewayPct, 0)} %</dd>
                    <dd className="text-[11px] text-tenue" title={`Trama diseña cada frecuencia para no pasar del ${CAPACIDAD_TRAMA.canalPicoPct} % en la hora pico`}>
                      Trama: hasta {CAPACIDAD_TRAMA.canalPicoPct}&nbsp;%
                    </dd>
                  </div>
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">Ancho de banda útil</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{fmt(r.utilBps, 0)} bps</dd>
                    <dd className="text-[11px] text-tenue">de mensajes; el canal da {fmt(r.canalBps / 1000, 2)} kbps</dd>
                  </div>
                </dl>
                <p className="text-[12px] leading-snug text-carbon-2">
                  {entero(r.usuarios)} personas con ruta; el 95 % de los mensajes completa en {fmt(r.p95S, 0)} s (típico {fmt(r.p50S, r.p50S < 10 ? 1 : 0)} s). Cada persona gasta ~{fmt(r.zonas.find((z) => z.usuarios > 0)?.airePersonaS ?? 0, 1)} s de aire en la hora pico; un mensaje sin choques (del tamaño de un pago) ocupa ~{fmt(r.airePorPagoS, 1)} s.
                </p>
                {estres.limites && estres.limites.length > 1 ? <TablaLimites limites={estres.limites} onVer={onVerZona} /> : r.limite ? <BloqueLimite l={r.limite} /> : null}
                {r.rampa && (
                  <div className="space-y-1.5 rounded-md bg-papel-2/60 p-2">
                    <p className="text-[12.5px] leading-snug font-medium text-carbon">
                      {r.rampa.usuariosMax !== null ? `Toda la malla aguanta sin demora hasta ~${entero(r.rampa.usuariosMax)} personas (×${fmt(r.rampa.factorSeguro ?? 0, r.rampa.factorSeguro && r.rampa.factorSeguro < 1 ? 2 : 1)} la carga).` : "Con esta carga la malla no aguanta ni con lo mínimo probado."}
                      {r.rampa.factorQuiebre !== null ? ` Se revienta desde ×${fmt(r.rampa.factorQuiebre, r.rampa.factorQuiebre < 1 ? 2 : 1)} (~${entero(r.usuarios * r.rampa.factorQuiebre)} personas).` : " No se revienta con lo probado."}
                      {r.rampa.primera ? ` La primera zona en reventarse: ${r.rampa.primera}.` : ""}
                    </p>
                    <CurvaRendimiento r={r.rampa} />
                  </div>
                )}
                <div>
                  <p className="mb-1 text-[12.5px] font-semibold text-carbon">Zona por zona</p>
                  <ul className="divide-y divide-linea rounded-md ring-1 ring-linea">
                    {visibles.map((z) => (
                      <FilaZona key={z.id} z={z} rampa={Boolean(r.rampa)} onVer={onVerZona} />
                    ))}
                  </ul>
                  {zonas.length > 6 && (
                    <button type="button" className="mt-1 text-[12.5px] font-medium text-salvia-oscura" onClick={() => setVerTodas((v) => !v)}>
                      {verTodas ? "Ver menos" : `Ver las ${zonas.length} zonas`}
                    </button>
                  )}
                </div>
                {r.ajustes && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
                      <Radio size={14} /> La misma hora pico con otro ajuste de radio
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px] tabular-nums">
                        <thead className="text-left text-tenue">
                          <tr>
                            <th className="py-0.5 pr-1 font-normal">Ajuste</th>
                            <th className="px-1 font-normal">Con ruta</th>
                            <th className="px-1 font-normal">Completos</th>
                            <th className="px-1 font-normal">Espera</th>
                            <th className="pl-1 font-normal">Canal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.ajustes.map((a) => (
                            <tr key={a.preset} className={a.actual ? "font-semibold" : ""}>
                              <td className="py-0.5 pr-1">
                                <i className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLOR_ESTADO[a.estado] }} aria-hidden="true" />
                                {nombreCorto(a.nombre)}
                                {a.actual ? " (el de ahora)" : ""}
                              </td>
                              <td className="px-1">{entero(a.conRuta)}</td>
                              <td className="px-1">{a.conRuta ? `${fmt(a.completosPct, 0)} %` : "—"}</td>
                              <td className="px-1">{a.conRuta ? `${fmt(a.p95S, 0)} s` : "—"}</td>
                              <td className="pl-1">{a.conRuta ? `${fmt(a.canalPct, 0)} %` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug text-tenue">Más ancho de banda o menos SF: cada mensaje dura menos en el aire y caben más, pero el alcance baja (menos personas con ruta). Las rutas se recalculan con cada ajuste sobre los mismos enlaces.</p>
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

const colorPunto = (p: { estadoPunto: EstadoZona; estadoRed: EstadoZona }) =>
  p.estadoPunto === "revienta" || p.estadoRed === "revienta" ? COLOR_ESTADO.revienta : p.estadoPunto === "lento" || p.estadoRed === "lento" ? COLOR_ESTADO.lento : COLOR_ESTADO.aguanta;

/** Personas en el punto frente a lo que completan el punto y la red: hasta dónde aguanta. */
function CurvaLimite({ l }: { l: LimitePunto }) {
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
      <svg viewBox={`0 0 ${ancho} ${alto + 26}`} className="w-full" role="img" aria-label={`Mensajes completos según las personas en ${l.nombre}`}>
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
            <title>{`${entero(p.personas)} personas (${fmt(p.mensajesHora, 0)} mensajes/h): el punto ${fmt(p.completosPct, 0)} % con respuesta, el 95 % en ${fmt(p.p95S, 0)} s; la red ${fmt(p.redCompletosPct, 0)} %; canal ${fmt(p.canalPct, 0)} %`}</title>
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
          personas en el punto · % con respuesta (punteada: toda la red)
        </text>
      </svg>
    </figure>
  );
}

function BloqueLimite({ l }: { l: LimitePunto }) {
  return (
    <div className="space-y-1.5 rounded-md bg-papel-2/60 p-2" data-tour="limite-estres">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
        <Gauge size={14} /> Límite de {l.nombre}
      </p>
      <p className="text-[12.5px] leading-snug text-carbon">{textoLimite(l)}</p>
      {l.llenado && <p className="text-[12.5px] leading-snug font-medium text-carbon-2">{textoLlenado(l)}</p>}
      <CurvaLimite l={l} />
      {!l.motivo && (
        <p className="text-[11.5px] leading-snug text-tenue">
          Se sube solo la gente de este punto (sus mensajes de la hora pico: pagos, WhatsApp y consultas a la IA), con el resto de la red como está. Aguanta: el 90 % del punto y de cada zona recibe respuesta y el 95 % en menos de un minuto. Se prueba hasta {entero(l.tope)} personas.
        </p>
      )}
    </div>
  );
}

/** El límite de cada punto, uno a la vez (los demás como están). */
function TablaLimites({ limites, onVer }: { limites: LimitePunto[]; onVer: (id: string) => void }) {
  const cifra = (x: number | null, mas = false) => (x === null ? "—" : `${mas ? "+" : "~"}${entero(x)}`);
  return (
    <div className="space-y-1.5 rounded-md bg-papel-2/60 p-2" data-tour="limites-estres">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-carbon">
        <Gauge size={14} /> Límite de cada punto
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead className="text-left text-tenue">
            <tr>
              <th className="py-0.5 pr-1 font-normal">Punto</th>
              <th className="px-1 font-normal">Hoy</th>
              <th className="px-1 font-normal">Aguanta</th>
              <th className="px-1 font-normal">Lento</th>
              <th className="pl-1 font-normal">Revienta</th>
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
                  {l.motivo ? "—" : l.redYaFalla ? "red llena" : cifra(l.personasSeguro, l.aguantaTodo)}
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
      <p className="text-[11.5px] leading-snug text-tenue">Cada punto se prueba con los demás como están. Si todos se llenan a la vez comparten el canal y aguantan menos: «¿Hasta dónde aguanta cada repetidor?» lo mide con toda la red subiendo junta.</p>
    </div>
  );
}

const rango = (e: EstadoZona) => ({ revienta: 0, lento: 1, aguanta: 2, "sin-pagos": 3 })[e];
const nombreCorto = (n: string) => n.replace(/^Trama /, "").replace(/ \((alcance|capacidad)\)$/, "");

function Supuestos({ r }: { r: ResultadoEstres }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      <button type="button" className="flex items-center gap-1 text-[12px] font-medium text-salvia-oscura" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <ChevronDown size={14} className={abierto ? "rotate-180" : ""} /> Cómo se mide (supuestos)
      </button>
      {abierto && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] leading-snug text-carbon-2">
          <li>
            Carga: {fmt(r.pagosPersonaDia, 1)} mensajes por persona al día entre pagos, WhatsApp y consultas a la IA (el ritmo de Trama: 55 por hora por frecuencia con 150 usuarios; si la gente escribe o consulta más, súbalo o multiplique la carga), el {r.horaPicoPct} % en la hora pico{r.factor !== 1 ? `, multiplicado ×${r.factor}` : ""}. Se simulan {r.duracionMin} minutos de hora pico, dos sorteos.
          </li>
          <li>Cada mensaje se mide con el tamaño de un pago del documento de Trama: 118 B de ida al gateway (la orden firmada, el WhatsApp o la consulta), 126 B de vuelta (el comprobante, la confirmación o la respuesta de la IA) y un aviso de 126 B a quien recibe, con sus acuses y hasta 3 reintentos (el último por inundación), paquete por paquete como MeshCore. Un WhatsApp largo o una respuesta larga de la IA ocupan más aire.</li>
          <li>Aguanta: el 90 % o más recibe su respuesta y el 95 % en menos de un minuto. Lento: aguanta pero tarda más. Se revienta: menos del 90 %.</li>
          <li>La zona de un nodo son las personas que entran a la malla por él (su primer salto). El canal es el % del tiempo con alguna señal al aire que ese nodo oye; «transmite» es su propio aire (el repetidor se frena al {TOPE_CICLO_PCT} %).</li>
          <li>Alcance con carga: del más cercano al más lejano, hasta dónde completa el 90 % de los mensajes. Los lejanos llegan más débiles y pierden primero cuando dos señales se pisan.</li>
          <li>
            <BatteryCharging size={12} className="inline" /> Energía del repetidor solar P1: {fmt(ENERGIA_P1.txW, 2)} W al transmitir y {fmt(ENERGIA_P1.rxW, 2)} W escuchando; panel de {ENERGIA_P1.panelW} W × {ENERGIA_P1.horasSol} h de sol × {fmt(ENERGIA_P1.eficiencia * 100, 0)} % ≈ {fmt(ENERGIA_P1.panelW * ENERGIA_P1.horasSol * ENERGIA_P1.eficiencia, 0)} Wh/día; batería útil ≈ {fmt(ENERGIA_P1.bateriaWh, 0)} Wh.
          </li>
          <li>Una sola frecuencia: el sitio de Trama lleva 4 radios (4 frecuencias) y reparte los repetidores entre ellas; con 4 frecuencias bien repartidas la capacidad sube hasta 4 veces.</li>
          <li>Son estimaciones para planear; se validan midiendo el canal en una red piloto.</li>
        </ul>
      )}
    </div>
  );
}
