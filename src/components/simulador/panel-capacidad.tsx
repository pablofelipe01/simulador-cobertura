// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Población y capacidad: «Poblar personas» reparte N billeteras al azar dentro de la red (o con la densidad de la
// zona, como en el documento de Trama) y la prueba de carga manda 5, 15, 25… pagos o mensajes de texto (WhatsApp,
// consultas a la IA) al tiempo para ver hasta dónde aguanta la frecuencia antes de reventarse.
import { Activity, Gauge, Trash, Users } from "lucide-react";
import { useState } from "react";

import { numeroLocal, tx } from "@/lib/idioma";
import { ESPERA_MAXIMA_S, UMBRAL_COMPLETOS_PCT, type CurvaCargaResultado, type PuntoCurva, type ResultadoCarga, type TipoCarga } from "@/lib/radio/carga";
import { presetPorId } from "@/lib/radio/constantes";
import { CAPACIDAD_TRAMA, SF_TRAMA, type SfTrama } from "@/lib/radio/trama";
import type { Parametros } from "@/lib/radio/tipos";
import { useIdioma } from "@/lib/use-idioma";

import { Boton, fmt, Interruptor, Segmentado, Titulo } from "./ui";

export type AreaPoblar = {
  id: string;
  /** En español siempre: Melki lo compara con lo que escribe el usuario. */
  nombre: string;
  km2: number;
  poligono: [number, number][];
  objetivo: boolean;
  /** El nombre para mostrar, en el idioma de la pantalla (sin valor: el `nombre`). */
  etiqueta?: string;
};

/** Pedido de «Poblar personas»: cuántas (o la densidad), dónde y si solo donde hay señal. */
export type PedidoPoblar = {
  n?: number;
  /** Usuarios por km² (0,2 disperso, 1 medio, 5 denso); manda sobre `n`. */
  densidadKm2?: number;
  /** Área (id de `areasPoblar`); por defecto el área objetivo o la zona alrededor de la red. */
  areaId?: string;
  soloConSenal?: boolean;
  semilla?: number;
  /** Quita antes las personas pobladas (por defecto sí: volver a poblar reparte de nuevo). */
  reemplazar?: boolean;
};

export type ResultadoPoblar = { puestas: number; pedidas: number; area: string; km2: number; conSenal: boolean; quitadas: number } | { error: string };

/** Máximo de personas por reparto (el mapa y el cálculo de enlaces siguen ágiles). */
export const MAX_POBLAR = 1000;

export type OpcionesCarga = {
  tipo: TipoCarga;
  mensajes: number;
  modo: "rafaga" | "continua";
  ventanaS: number;
  rutaConocida: boolean;
  conAviso: boolean;
};

export type CurvaCarga = CurvaCargaResultado;

export type FaseCarga =
  | { fase: "nada" }
  | { fase: "probando"; curva: boolean }
  | { fase: "listo"; resultado: ResultadoCarga; curva: CurvaCarga | null; firma: string; opciones: OpcionesCarga }
  | { fase: "error"; texto: string };

export const CARGA_DEFECTO: OpcionesCarga = { tipo: "pago", mensajes: 15, modo: "rafaga", ventanaS: 10, rutaConocida: true, conAviso: true };

const entero = (n: number) => numeroLocal(Math.round(n));
/** Un porcentaje ya escrito: «45 %» en español, «45%» en inglés. */
const conPct = (v: string | number) => tx(`${v} %`, `${v}%`);

/** Referencia de capacidad de Trama para el ajuste de radio actual (solo los de 250 kHz). */
export function referenciaTrama(p: Parametros) {
  const preset = presetPorId(p.preset);
  if (preset.anchoBandaKhz !== 250 || preset.sf < 9 || preset.sf > 11) return null;
  return { sf: preset.sf as SfTrama, ...SF_TRAMA[preset.sf as SfTrama] };
}

/* ───────────── Poblar personas ───────────── */

export function PoblarPersonas({
  areas,
  pobladas,
  hayResultado,
  ultimo,
  onPoblar,
  onQuitar,
}: {
  areas: AreaPoblar[];
  pobladas: number;
  hayResultado: boolean;
  ultimo: ResultadoPoblar | null;
  onPoblar: (o: PedidoPoblar) => void;
  onQuitar: () => void;
}) {
  useIdioma();
  const [n, setN] = useState(250);
  const [porDensidad, setPorDensidad] = useState<"cantidad" | "densidad">("cantidad");
  const [densidad, setDensidad] = useState(1);
  const [areaId, setAreaId] = useState<string>("");
  const [soloConSenal, setSoloConSenal] = useState(false);
  const area = areas.find((a) => a.id === areaId) ?? areas[0];
  const cantidad = Math.min(MAX_POBLAR, porDensidad === "densidad" && area ? Math.round(area.km2 * densidad) : n);
  const recortada = porDensidad === "densidad" && area ? Math.round(area.km2 * densidad) > MAX_POBLAR : false;
  const nombreArea = area ? (area.etiqueta ?? area.nombre) : "";
  return (
    <section data-tour="poblar" aria-labelledby="titulo-poblar">
      <Titulo>
        <span id="titulo-poblar" className="inline-flex items-center gap-1.5">
          <Users size={16} /> {tx("Poblar personas", "Populate people")}
        </span>
      </Titulo>
      {!areas.length ? (
        <p className="text-[13px] leading-snug text-tenue">
          {tx("Ponga el gateway y los repetidores primero: las personas se reparten dentro de la zona de la red.", "Place the gateway and the repeaters first: people are spread within the network area.")}
        </p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[12.5px] leading-snug text-carbon-2">
            {tx(
              "Reparte billeteras al azar en la zona para probar la red con la gente de verdad. En el documento de Trama: 0,2 usuarios/km² disperso, 1 medio y 5 denso.",
              "Spreads wallets at random over the area to test the network with real people. In the Trama document: 0.2 users/km² sparse, 1 medium and 5 dense.",
            )}
          </p>
          <Segmentado
            etiqueta={tx("Cuántas personas", "How many people")}
            valor={porDensidad}
            onCambio={setPorDensidad}
            opciones={[
              { valor: "cantidad", texto: tx("Cantidad", "Number") },
              { valor: "densidad", texto: tx("Por densidad", "By density") },
            ]}
          />
          {porDensidad === "cantidad" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {[50, 150, 250, 600].map((v) => (
                <button key={v} type="button" onClick={() => setN(v)} className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1 ${n === v ? "bg-carbon text-white ring-carbon" : "bg-white ring-linea hover:bg-papel-2"}`}>
                  {v}
                </button>
              ))}
              <label className="flex items-center gap-1 text-[12.5px] text-carbon-2">
                <input
                  aria-label={tx("Número de personas", "Number of people")}
                  className="campo w-20 py-1 tabular-nums"
                  inputMode="numeric"
                  value={String(n)}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, ""));
                    if (Number.isFinite(v)) setN(Math.min(MAX_POBLAR, v));
                  }}
                />
                {tx("personas", "people")}
              </label>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {CAPACIDAD_TRAMA.densidades.map((d) => (
                <button key={d.valor} type="button" onClick={() => setDensidad(d.valor)} className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1 ${densidad === d.valor ? "bg-carbon text-white ring-carbon" : "bg-white ring-linea hover:bg-papel-2"}`}>
                  {fmt(d.valor, d.valor < 1 ? 1 : 0)} /km² · {d.nombre}
                </button>
              ))}
            </div>
          )}
          <label className="block text-[12.5px] text-carbon-2">
            <span className="mb-1 block">{tx("Dónde", "Where")}</span>
            <select className="campo" value={area?.id ?? ""} onChange={(e) => setAreaId(e.target.value)} aria-label={tx("Área donde poblar", "Area to populate")}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.etiqueta ?? a.nombre} · {fmt(a.km2, a.km2 < 10 ? 1 : 0)} km²
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
              deshabilitado={cantidad < 1}
              onClick={() => area && onPoblar({ n: cantidad, areaId: area.id, soloConSenal: soloConSenal && hayResultado, semilla: Math.floor(Math.random() * 1e6), reemplazar: true })}
              tour="boton-poblar"
            >
              <Users size={16} /> {tx(`Poblar ${entero(cantidad)} ${cantidad === 1 ? "persona" : "personas"}`, `Populate ${entero(cantidad)} ${cantidad === 1 ? "person" : "people"}`)}
            </Boton>
            {pobladas > 0 && (
              <Boton onClick={onQuitar}>
                <Trash size={15} /> {tx(`Quitar las ${entero(pobladas)}`, pobladas === 1 ? "Remove the 1 person" : `Remove all ${entero(pobladas)}`)}
              </Boton>
            )}
          </div>
          {area && cantidad > 0 && (
            <p className="text-[12px] text-tenue">
              {tx(
                `≈ ${fmt(cantidad / Math.max(area.km2, 0.01), 2)} personas por km² en ${nombreArea.charAt(0).toLowerCase() + nombreArea.slice(1)}.`,
                `≈ ${fmt(cantidad / Math.max(area.km2, 0.01), 2)} people per km² in the selected area.`,
              )}
              {recortada ? tx(` Se reparten hasta ${entero(MAX_POBLAR)} a la vez.`, ` Up to ${entero(MAX_POBLAR)} are spread at a time.`) : ""}
              {pobladas > 0 ? tx(" Volver a poblar reparte de nuevo (quita las anteriores).", " Populating again spreads them anew (removes the previous ones).") : ""}
            </p>
          )}
          {ultimo && (
            <p className={`text-[12.5px] leading-snug ${"error" in ultimo ? "text-sin" : "text-carbon-2"}`} role="status">
              {"error" in ultimo
                ? ultimo.error
                : ultimo.puestas < ultimo.pedidas
                  ? tx(
                      `Puse ${entero(ultimo.puestas)} de ${entero(ultimo.pedidas)}: ${ultimo.conSenal ? "solo hay señal en parte del área" : "no cupieron más sin quedar encimadas"}.`,
                      `I placed ${entero(ultimo.puestas)} of ${entero(ultimo.pedidas)}: ${ultimo.conSenal ? "there is signal in only part of the area" : "no more fit without overlapping"}.`,
                    )
                  : tx(
                      `Puse ${entero(ultimo.puestas)} personas en ${ultimo.area.charAt(0).toLowerCase() + ultimo.area.slice(1)}${ultimo.conSenal ? ", todas con señal" : ""}. En «Nodos de campo» ve cuántas quedaron conectadas.`,
                      `I placed ${entero(ultimo.puestas)} people in “${ultimo.area}”${ultimo.conSenal ? ", all with signal" : ""}. “Field nodes” shows how many ended up connected.`,
                    )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ───────────── Prueba de carga ───────────── */

/** Verde aguanta; naranja aguanta pero lento; rojo se revienta. */
const COLOR_AGUANTA = "#1E7B34";
const COLOR_LENTO = "#F08A2C";
const COLOR_REVIENTA = "#D93A2E";
const colorPunto = (q: Pick<PuntoCurva, "completosPct" | "p95S">) => (q.completosPct < UMBRAL_COMPLETOS_PCT ? COLOR_REVIENTA : q.p95S > ESPERA_MAXIMA_S ? COLOR_LENTO : COLOR_AGUANTA);

function Curva({ curva }: { curva: CurvaCarga }) {
  useIdioma();
  const pts = curva.puntos;
  if (!pts.length) return null;
  const ancho = 300;
  const alto = 120;
  const paso = ancho / pts.length;
  return (
    <figure className="space-y-1" aria-label={tx("Curva de carga", "Load curve")}>
      <svg viewBox={`0 0 ${ancho} ${alto + 28}`} className="w-full" role="img" aria-label={tx("Completos según cuántos salen al tiempo", "Completed vs. how many are sent at once")}>
        {[0, 50, 90, 100].map((v) => (
          <g key={v}>
            <line x1={0} x2={ancho} y1={alto - (v / 100) * alto} y2={alto - (v / 100) * alto} stroke={v === 90 ? "#2B2F2E" : "#D9D5CC"} strokeDasharray={v === 90 ? "4 3" : undefined} strokeWidth={1} />
            <text x={ancho} y={alto - (v / 100) * alto - 2} textAnchor="end" fontSize={9} fill="#6F7572">
              {conPct(v)}
            </text>
          </g>
        ))}
        {pts.map((q, k) => {
          const h = (Math.max(0, Math.min(100, q.completosPct)) / 100) * alto;
          return (
            <g key={q.n}>
              <rect x={k * paso + 3} y={alto - h} width={paso - 6} height={h} rx={2} fill={colorPunto(q)}>
                <title>{tx(`${q.n} al tiempo: ${fmt(q.completosPct, 0)} % completos; el 95 % en ${fmt(q.p95S, 0)} s`, `${q.n} at once: ${fmt(q.completosPct, 0)}% completed; 95% within ${fmt(q.p95S, 0)} s`)}</title>
              </rect>
              <text x={k * paso + paso / 2} y={alto + 12} textAnchor="middle" fontSize={9.5} fill="#2B2F2E">
                {q.n}
              </text>
            </g>
          );
        })}
        <text x={ancho / 2} y={alto + 25} textAnchor="middle" fontSize={9} fill="#6F7572">
          {tx("cuántos salen al tiempo", "how many are sent at once")}
        </text>
      </svg>
      <figcaption className="space-y-1 text-[12px] leading-snug text-carbon-2">
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-tenue" aria-hidden="true">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_AGUANTA }} /> {tx("aguanta", "holds up")}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_LENTO }} /> {tx("lento (+1 min)", "slow (+1 min)")}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_REVIENTA }} /> {tx("se revienta", "gets overloaded")}</span>
        </span>
        <span className="block">
          {[
            curva.seguro !== null ? tx(`Aguanta sin demora hasta ${curva.seguro} al tiempo.`, `Holds up without delay up to ${curva.seguro} at once.`) : "",
            curva.lento !== null ? tx(`Desde ${curva.lento}, lento: el 95 % tarda más de un minuto.`, `From ${curva.lento}, slow: 95% take more than a minute.`) : "",
            curva.quiebre !== null
              ? tx(`Se revienta desde ${curva.quiebre}: menos del 90 % recibe su respuesta.`, `Gets overloaded from ${curva.quiebre}: fewer than 90% get their reply.`)
              : tx(`No se revienta con lo probado (hasta ${pts[pts.length - 1].n}).`, `Doesn't get overloaded with what was tested (up to ${pts[pts.length - 1].n}).`),
          ]
            .filter(Boolean)
            .join(" ")}
        </span>
      </figcaption>
    </figure>
  );
}

export function PruebaCarga({
  parametros,
  remitentes,
  carga,
  desactualizado,
  onProbar,
}: {
  parametros: Parametros;
  remitentes: number;
  carga: FaseCarga;
  desactualizado: boolean;
  onProbar: (o: OpcionesCarga, curva: boolean) => void;
}) {
  useIdioma();
  const [o, setO] = useState<OpcionesCarga>(CARGA_DEFECTO);
  const ref = referenciaTrama(parametros);
  const preset = presetPorId(parametros.preset);
  const cambiar = (c: Partial<OpcionesCarga>) => setO((x) => ({ ...x, ...c }));
  const r = carga.fase === "listo" ? carga.resultado : null;
  const unidad = o.tipo === "pago" ? tx("pagos", "payments") : tx("mensajes", "messages");
  return (
    <section data-tour="prueba-carga" aria-labelledby="titulo-carga">
      <Titulo>
        <span id="titulo-carga" className="inline-flex items-center gap-1.5">
          <Gauge size={16} /> {tx("Prueba de carga", "Load test")}
        </span>
      </Titulo>
      <div className="space-y-2.5">
        <p className="text-[12.5px] leading-snug text-carbon-2">
          {tx(
            `Por la red van pagos, mensajes de WhatsApp y consultas a la IA, y todos comparten el mismo canal. Manda varios ${unidad} al tiempo desde las personas conectadas y mira cuántos completan el viaje, cuánto tardan y cuándo se revienta la frecuencia. Ajuste de radio: ${preset.nombre}.`,
            `Payments, WhatsApp messages and AI queries travel over the network, and they all share the same channel. Send several ${unidad} at once from the connected people and see how many complete the trip, how long they take and when the frequency gets overloaded. Radio setting: ${preset.nombre}.`,
          )}
        </p>
        {ref && (
          <p className="rounded-md bg-papel-2 px-2.5 py-1.5 text-[12px] leading-snug text-carbon-2">
            {tx(
              `Trama con SF${ref.sf}: un pago ocupa el aire ~${fmt(ref.segPago, ref.segPago % 1 ? 1 : 0)} s; con el canal al ${CAPACIDAD_TRAMA.canalPicoPct} % en la hora pico caben ~${ref.pagosHora} pagos por hora por frecuencia (${ref.usuariosFrecuencia} usuarios; ${ref.usuariosFrecuencia * CAPACIDAD_TRAMA.radiosPorSitio} por sitio de 4 radios), y esa capacidad la comparten con los WhatsApp y las consultas a la IA.`,
              `Trama with SF${ref.sf}: a payment takes ~${fmt(ref.segPago, ref.segPago % 1 ? 1 : 0)} s of airtime; with the channel at ${CAPACIDAD_TRAMA.canalPicoPct}% in the peak hour, ~${ref.pagosHora} payments per hour fit per frequency (${ref.usuariosFrecuencia} users; ${ref.usuariosFrecuencia * CAPACIDAD_TRAMA.radiosPorSitio} per 4-radio site), and that capacity is shared with WhatsApp messages and AI queries.`,
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Segmentado
            etiqueta={tx("Qué se manda", "What is sent")}
            valor={o.tipo}
            onCambio={(tipo) => cambiar({ tipo })}
            opciones={[
              {
                valor: "pago",
                texto: tx("Pagos", "Payments"),
                titulo: tx("Orden (118 B), comprobante (126 B) y aviso a quien recibe, con sus acuses", "Order (118 B), receipt (126 B) and notice to the recipient, with their acknowledgments"),
              },
              {
                valor: "texto",
                texto: tx("WhatsApp o IA", "WhatsApp or AI"),
                titulo: tx("Un mensaje de texto (un WhatsApp o una consulta a la IA) al gateway y su respuesta", "A text message (a WhatsApp message or an AI query) to the gateway and its reply"),
              },
            ]}
          />
          <Segmentado
            etiqueta={tx("Cómo salen", "How they're sent")}
            valor={o.modo}
            onCambio={(modo) => cambiar({ modo, mensajes: modo === "continua" ? 55 : 15 })}
            opciones={[
              { valor: "rafaga", texto: tx("Al tiempo", "At once") },
              { valor: "continua", texto: tx("Por hora", "Per hour") },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(o.modo === "rafaga" ? [5, 15, 25, 50] : [55, 105, 185, 300]).map((v) => (
            <button key={v} type="button" onClick={() => cambiar({ mensajes: v })} className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1 ${o.mensajes === v ? "bg-carbon text-white ring-carbon" : "bg-white ring-linea hover:bg-papel-2"}`}>
              {v}
            </button>
          ))}
          <label className="flex items-center gap-1 text-[12.5px] text-carbon-2">
            <input
              aria-label={tx(`Número de ${unidad}`, `Number of ${unidad}`)}
              className="campo w-16 py-1 tabular-nums"
              inputMode="numeric"
              value={String(o.mensajes)}
              onChange={(e) => {
                const v = Number(e.target.value.replace(/\D/g, ""));
                if (Number.isFinite(v)) cambiar({ mensajes: Math.min(2000, v) });
              }}
            />
            {o.modo === "rafaga" ? unidad : tx(`${unidad} por hora`, `${unidad} per hour`)}
          </label>
        </div>
        {o.modo === "rafaga" && (
          <Segmentado
            etiqueta={tx("En cuánto tiempo", "Over how long")}
            valor={String(o.ventanaS)}
            onCambio={(v) => cambiar({ ventanaS: Number(v) })}
            opciones={[
              { valor: "1", texto: tx("en 1 s", "in 1 s") },
              { valor: "10", texto: tx("en 10 s", "in 10 s") },
              { valor: "60", texto: tx("en 1 min", "in 1 min") },
            ]}
          />
        )}
        <Interruptor
          etiqueta={tx("Rutas ya aprendidas", "Routes already learned")}
          detalle={o.rutaConocida ? tx("Van directo por los repetidores de su ruta", "They go straight through the repeaters on their route") : tx("El primer intento se inunda por todos los repetidores", "The first attempt floods through all the repeaters")}
          activo={o.rutaConocida}
          onCambio={(rutaConocida) => cambiar({ rutaConocida })}
        />
        {o.tipo === "pago" && (
          <Interruptor
            etiqueta={tx("Aviso a quien recibe", "Notice to the recipient")}
            detalle={tx("Un comercio de la red recibe su aviso", "A merchant on the network receives its notice")}
            activo={o.conAviso}
            onCambio={(conAviso) => cambiar({ conAviso })}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Boton variante="principal" onClick={() => onProbar(o, false)} tour="boton-carga">
            <Activity size={16} /> {tx(`Probar ${o.mensajes} ${o.modo === "rafaga" ? "al tiempo" : "por hora"}`, `Test ${o.mensajes} ${o.modo === "rafaga" ? "at once" : "per hour"}`)}
          </Boton>
          {o.modo === "rafaga" && (
            <Boton onClick={() => onProbar(o, true)}>
              <Gauge size={16} /> {tx("¿Hasta cuántos aguanta?", "How many can it handle?")}
            </Boton>
          )}
        </div>
        {remitentes === 0 && (
          <p className="text-[12.5px] text-sin">
            {tx(
              "No hay personas con ruta al gateway: use «Poblar personas» o ponga personas donde haya cobertura y simule.",
              "No people have a route to the gateway: use “Populate people” or place people where there is coverage and simulate.",
            )}
          </p>
        )}
        {desactualizado && <p className="text-[12.5px] text-tenue">{tx("La red cambió después de esta prueba: pruebe de nuevo para ver la red de ahora.", "The network changed after this test: test again to see the current network.")}</p>}
        {carga.fase === "probando" && (
          <p className="flex items-center gap-2 text-[13px] text-carbon-2" role="status">
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-salvia border-t-transparent" aria-hidden="true" />
            {carga.curva ? tx("Probando con más y más al tiempo…", "Testing with more and more at once…") : tx("Simulando el canal paquete por paquete…", "Simulating the channel packet by packet…")}
          </p>
        )}
        {carga.fase === "error" && <p className="text-[13px] text-sin">{carga.texto}</p>}
        {r && carga.fase === "listo" && (
          <div className="space-y-2 rounded-lg bg-white p-2.5 ring-1 ring-linea" aria-label={tx("Resultado de la prueba de carga", "Load test result")} data-tour="resultado-carga">
            {r.motivo ? (
              <p className="text-[13px] text-sin">{r.motivo}</p>
            ) : (
              <>
                <p className="font-cond text-[16px] leading-tight font-semibold" style={{ color: r.saturada ? COLOR_REVIENTA : r.lenta ? COLOR_LENTO : COLOR_AGUANTA }}>
                  {tx(
                    `${r.saturada ? "Se revienta" : r.lenta ? "Aguanta, pero lento" : "Aguanta"}: ${fmt(r.completosPct, 0)} % de los ${r.mensajes} ${r.tipo === "pago" ? "pagos" : "mensajes"} ${r.tipo === "pago" ? "con comprobante" : "con respuesta"}`,
                    `${r.saturada ? "Gets overloaded" : r.lenta ? "Holds up, but slow" : "Holds up"}: ${fmt(r.completosPct, 0)}% of the ${r.mensajes} ${r.tipo === "pago" ? "payments" : "messages"} ${r.tipo === "pago" ? "with a receipt" : "with a reply"}`,
                  )}
                </p>
                <dl className="grid grid-cols-3 gap-1.5 text-[12px]">
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">{tx("Espera típica", "Typical wait")}</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{fmt(r.latenciaS.p50, r.latenciaS.p50 < 10 ? 1 : 0)} s</dd>
                    <dd className="text-[11px] text-tenue">{tx(`el 95 %: ${fmt(r.latenciaS.p95, 0)} s`, `95%: ${fmt(r.latenciaS.p95, 0)} s`)}</dd>
                  </div>
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">{tx("Canal del gateway", "Gateway channel")}</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{conPct(fmt(r.canalGatewayPct, 0))}</dd>
                    <dd className="text-[11px] text-tenue">{tx("ocupado", "busy")}</dd>
                  </div>
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">{tx("Choques", "Collisions")}</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{r.colisiones}</dd>
                    <dd className="text-[11px] text-tenue">{tx(`${r.reintentos} reintentos`, `${r.reintentos} retries`)}</dd>
                  </div>
                </dl>
                <p className="text-[12px] leading-snug text-carbon-2">
                  {tx(`${r.entregados} de ${r.mensajes} llegaron al gateway; ${fmt(r.primerIntentoPct, 0)} % al primer intento.`, `${r.entregados} of ${r.mensajes} reached the gateway; ${fmt(r.primerIntentoPct, 0)}% on the first attempt.`)}
                  {r.tipo === "pago" && r.avisosPedidos > 0 ? tx(` Avisos entregados: ${r.avisos} de ${r.avisosPedidos}.`, ` Notices delivered: ${r.avisos} of ${r.avisosPedidos}.`) : ""}{" "}
                  {tx(`${r.transmisiones} transmisiones de radio en ${fmt(r.duracionS, 0)} s`, `${r.transmisiones} radio transmissions in ${fmt(r.duracionS, 0)} s`)}
                  {r.sordos ? tx(`; ${r.sordos} paquetes perdidos porque el nodo estaba transmitiendo`, `; ${r.sordos} packets lost because the node was transmitting`) : ""}
                  {r.perdidasCola ? tx(`; ${r.perdidasCola} descartados por cola llena`, `; ${r.perdidasCola} dropped because of a full queue`) : ""}.
                  {r.tipo === "pago" ? tx(` Un pago limpio por esta red ocupa ~${fmt(r.airePorPagoS, 1)} s de aire.`, ` A clean payment over this network takes ~${fmt(r.airePorPagoS, 1)} s of airtime.`) : ""}
                </p>
                {r.ocupacion.length > 0 && (
                  <p className="text-[12px] leading-snug text-tenue">
                    {tx("Más ocupados: ", "Busiest: ")}
                    {r.ocupacion
                      .slice(0, 3)
                      .map((x) => `${x.nombre} ${conPct(fmt(x.pct, 0))}`)
                      .join(" · ")}
                  </p>
                )}
              </>
            )}
            {carga.curva && <Curva curva={carga.curva} />}
          </div>
        )}
      </div>
    </section>
  );
}
