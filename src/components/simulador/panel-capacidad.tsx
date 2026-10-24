"use client";

// Población y capacidad: «Poblar personas» reparte N billeteras al azar dentro de la red (o con la densidad de la
// zona, como en el documento de Trama) y la prueba de carga manda 5, 15, 25… pagos al tiempo para ver hasta dónde
// aguanta la frecuencia antes de reventarse.
import { Activity, Gauge, Trash, Users } from "lucide-react";
import { useState } from "react";

import { ESPERA_MAXIMA_S, UMBRAL_COMPLETOS_PCT, type CurvaCargaResultado, type PuntoCurva, type ResultadoCarga, type TipoCarga } from "@/lib/radio/carga";
import { presetPorId } from "@/lib/radio/constantes";
import { CAPACIDAD_TRAMA, SF_TRAMA, type SfTrama } from "@/lib/radio/trama";
import type { Parametros } from "@/lib/radio/tipos";

import { Boton, fmt, Interruptor, Segmentado, Titulo } from "./ui";

export type AreaPoblar = { id: string; nombre: string; km2: number; poligono: [number, number][]; objetivo: boolean };

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

const entero = (n: number) => Math.round(n).toLocaleString("es-CO");

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
  const [n, setN] = useState(250);
  const [porDensidad, setPorDensidad] = useState<"cantidad" | "densidad">("cantidad");
  const [densidad, setDensidad] = useState(1);
  const [areaId, setAreaId] = useState<string>("");
  const [soloConSenal, setSoloConSenal] = useState(false);
  const area = areas.find((a) => a.id === areaId) ?? areas[0];
  const cantidad = Math.min(MAX_POBLAR, porDensidad === "densidad" && area ? Math.round(area.km2 * densidad) : n);
  const recortada = porDensidad === "densidad" && area ? Math.round(area.km2 * densidad) > MAX_POBLAR : false;
  return (
    <section data-tour="poblar" aria-labelledby="titulo-poblar">
      <Titulo>
        <span id="titulo-poblar" className="inline-flex items-center gap-1.5">
          <Users size={16} /> Poblar personas
        </span>
      </Titulo>
      {!areas.length ? (
        <p className="text-[13px] leading-snug text-tenue">Ponga el gateway y los repetidores primero: las personas se reparten dentro de la zona de la red.</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[12.5px] leading-snug text-carbon-2">Reparte billeteras al azar en la zona para probar la red con la gente de verdad. En el documento de Trama: 0,2 usuarios/km² disperso, 1 medio y 5 denso.</p>
          <Segmentado
            etiqueta="Cuántas personas"
            valor={porDensidad}
            onCambio={setPorDensidad}
            opciones={[
              { valor: "cantidad", texto: "Cantidad" },
              { valor: "densidad", texto: "Por densidad" },
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
                  aria-label="Número de personas"
                  className="campo w-20 py-1 tabular-nums"
                  inputMode="numeric"
                  value={String(n)}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, ""));
                    if (Number.isFinite(v)) setN(Math.min(MAX_POBLAR, v));
                  }}
                />
                personas
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
            <span className="mb-1 block">Dónde</span>
            <select className="campo" value={area?.id ?? ""} onChange={(e) => setAreaId(e.target.value)} aria-label="Área donde poblar">
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} · {fmt(a.km2, a.km2 < 10 ? 1 : 0)} km²
                </option>
              ))}
            </select>
          </label>
          <Interruptor etiqueta="Solo donde hay señal" detalle={hayResultado ? "Con servicio (≥ 20 dB) en la última simulación" : "Simule primero para usarlo"} activo={soloConSenal && hayResultado} onCambio={setSoloConSenal} />
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="principal"
              deshabilitado={cantidad < 1}
              onClick={() => area && onPoblar({ n: cantidad, areaId: area.id, soloConSenal: soloConSenal && hayResultado, semilla: Math.floor(Math.random() * 1e6), reemplazar: true })}
              tour="boton-poblar"
            >
              <Users size={16} /> Poblar {entero(cantidad)} {cantidad === 1 ? "persona" : "personas"}
            </Boton>
            {pobladas > 0 && (
              <Boton onClick={onQuitar}>
                <Trash size={15} /> Quitar las {entero(pobladas)}
              </Boton>
            )}
          </div>
          {area && cantidad > 0 && (
            <p className="text-[12px] text-tenue">
              ≈ {fmt(cantidad / Math.max(area.km2, 0.01), 2)} personas por km² en {area.nombre.charAt(0).toLowerCase() + area.nombre.slice(1)}.
              {recortada ? ` Se reparten hasta ${entero(MAX_POBLAR)} a la vez.` : ""}
              {pobladas > 0 ? " Volver a poblar reparte de nuevo (quita las anteriores)." : ""}
            </p>
          )}
          {ultimo && (
            <p className={`text-[12.5px] leading-snug ${"error" in ultimo ? "text-sin" : "text-carbon-2"}`} role="status">
              {"error" in ultimo
                ? ultimo.error
                : ultimo.puestas < ultimo.pedidas
                  ? `Puse ${entero(ultimo.puestas)} de ${entero(ultimo.pedidas)}: ${ultimo.conSenal ? "solo hay señal en parte del área" : "no cupieron más sin quedar encimadas"}.`
                  : `Puse ${entero(ultimo.puestas)} personas en ${ultimo.area.charAt(0).toLowerCase() + ultimo.area.slice(1)}${ultimo.conSenal ? ", todas con señal" : ""}. En «Nodos de campo» ve cuántas quedaron conectadas.`}
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
  const pts = curva.puntos;
  if (!pts.length) return null;
  const ancho = 300;
  const alto = 120;
  const paso = ancho / pts.length;
  return (
    <figure className="space-y-1" aria-label="Curva de carga">
      <svg viewBox={`0 0 ${ancho} ${alto + 28}`} className="w-full" role="img" aria-label="Pagos completos según cuántos salen al tiempo">
        {[0, 50, 90, 100].map((v) => (
          <g key={v}>
            <line x1={0} x2={ancho} y1={alto - (v / 100) * alto} y2={alto - (v / 100) * alto} stroke={v === 90 ? "#2B2F2E" : "#D9D5CC"} strokeDasharray={v === 90 ? "4 3" : undefined} strokeWidth={1} />
            <text x={ancho} y={alto - (v / 100) * alto - 2} textAnchor="end" fontSize={9} fill="#6F7572">
              {v} %
            </text>
          </g>
        ))}
        {pts.map((q, k) => {
          const h = (Math.max(0, Math.min(100, q.completosPct)) / 100) * alto;
          return (
            <g key={q.n}>
              <rect x={k * paso + 3} y={alto - h} width={paso - 6} height={h} rx={2} fill={colorPunto(q)}>
                <title>{`${q.n} al tiempo: ${fmt(q.completosPct, 0)} % completos; el 95 % en ${fmt(q.p95S, 0)} s`}</title>
              </rect>
              <text x={k * paso + paso / 2} y={alto + 12} textAnchor="middle" fontSize={9.5} fill="#2B2F2E">
                {q.n}
              </text>
            </g>
          );
        })}
        <text x={ancho / 2} y={alto + 25} textAnchor="middle" fontSize={9} fill="#6F7572">
          pagos al tiempo
        </text>
      </svg>
      <figcaption className="space-y-1 text-[12px] leading-snug text-carbon-2">
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-tenue" aria-hidden="true">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_AGUANTA }} /> aguanta</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_LENTO }} /> lento (+1 min)</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_REVIENTA }} /> se revienta</span>
        </span>
        <span className="block">
          {[
            curva.seguro !== null ? `Aguanta sin demora hasta ${curva.seguro} al tiempo.` : "",
            curva.lento !== null ? `Desde ${curva.lento}, lento: el 95 % tarda más de un minuto.` : "",
            curva.quiebre !== null ? `Se revienta desde ${curva.quiebre}: menos del 90 % recibe su comprobante.` : `No se revienta con lo probado (hasta ${pts[pts.length - 1].n}).`,
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
  const [o, setO] = useState<OpcionesCarga>(CARGA_DEFECTO);
  const ref = referenciaTrama(parametros);
  const preset = presetPorId(parametros.preset);
  const cambiar = (c: Partial<OpcionesCarga>) => setO((x) => ({ ...x, ...c }));
  const r = carga.fase === "listo" ? carga.resultado : null;
  const unidad = o.tipo === "pago" ? "pagos" : "mensajes";
  return (
    <section data-tour="prueba-carga" aria-labelledby="titulo-carga">
      <Titulo>
        <span id="titulo-carga" className="inline-flex items-center gap-1.5">
          <Gauge size={16} /> Prueba de carga
        </span>
      </Titulo>
      <div className="space-y-2.5">
        <p className="text-[12.5px] leading-snug text-carbon-2">
          Manda varios {unidad} al tiempo desde las personas conectadas y mira cuántos completan el viaje, cuánto tardan y cuándo se revienta la frecuencia. Ajuste de radio: {preset.nombre}.
        </p>
        {ref && (
          <p className="rounded-md bg-papel-2 px-2.5 py-1.5 text-[12px] leading-snug text-carbon-2">
            Trama con SF{ref.sf}: un pago ocupa el aire ~{fmt(ref.segPago, ref.segPago % 1 ? 1 : 0)} s; con el canal al {CAPACIDAD_TRAMA.canalPicoPct} % en la hora pico caben ~{ref.pagosHora} pagos por hora por frecuencia ({ref.usuariosFrecuencia} usuarios; {ref.usuariosFrecuencia * CAPACIDAD_TRAMA.radiosPorSitio} por sitio de 4 radios).
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Segmentado
            etiqueta="Qué se manda"
            valor={o.tipo}
            onCambio={(tipo) => cambiar({ tipo })}
            opciones={[
              { valor: "pago", texto: "Pagos", titulo: "Orden (118 B), comprobante (126 B) y aviso a quien recibe, con sus acuses" },
              { valor: "texto", texto: "Mensajes", titulo: "Un mensaje de texto al gateway y su respuesta" },
            ]}
          />
          <Segmentado
            etiqueta="Cómo salen"
            valor={o.modo}
            onCambio={(modo) => cambiar({ modo, mensajes: modo === "continua" ? 55 : 15 })}
            opciones={[
              { valor: "rafaga", texto: "Al tiempo" },
              { valor: "continua", texto: "Por hora" },
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
              aria-label={`Número de ${unidad}`}
              className="campo w-16 py-1 tabular-nums"
              inputMode="numeric"
              value={String(o.mensajes)}
              onChange={(e) => {
                const v = Number(e.target.value.replace(/\D/g, ""));
                if (Number.isFinite(v)) cambiar({ mensajes: Math.min(2000, v) });
              }}
            />
            {o.modo === "rafaga" ? unidad : `${unidad} por hora`}
          </label>
        </div>
        {o.modo === "rafaga" && (
          <Segmentado
            etiqueta="En cuánto tiempo"
            valor={String(o.ventanaS)}
            onCambio={(v) => cambiar({ ventanaS: Number(v) })}
            opciones={[
              { valor: "1", texto: "en 1 s" },
              { valor: "10", texto: "en 10 s" },
              { valor: "60", texto: "en 1 min" },
            ]}
          />
        )}
        <Interruptor etiqueta="Rutas ya aprendidas" detalle={o.rutaConocida ? "Van directo por los repetidores de su ruta" : "El primer intento se inunda por todos los repetidores"} activo={o.rutaConocida} onCambio={(rutaConocida) => cambiar({ rutaConocida })} />
        {o.tipo === "pago" && <Interruptor etiqueta="Aviso a quien recibe" detalle="Un comercio de la red recibe su aviso" activo={o.conAviso} onCambio={(conAviso) => cambiar({ conAviso })} />}
        <div className="flex flex-wrap gap-2">
          <Boton variante="principal" onClick={() => onProbar(o, false)} tour="boton-carga">
            <Activity size={16} /> Probar {o.mensajes} {o.modo === "rafaga" ? "al tiempo" : "por hora"}
          </Boton>
          {o.modo === "rafaga" && (
            <Boton onClick={() => onProbar(o, true)}>
              <Gauge size={16} /> ¿Hasta cuántos aguanta?
            </Boton>
          )}
        </div>
        {remitentes === 0 && <p className="text-[12.5px] text-sin">No hay personas con ruta al gateway: use «Poblar personas» o ponga personas donde haya cobertura y simule.</p>}
        {desactualizado && <p className="text-[12.5px] text-tenue">La red cambió después de esta prueba: pruebe de nuevo para ver la red de ahora.</p>}
        {carga.fase === "probando" && (
          <p className="flex items-center gap-2 text-[13px] text-carbon-2" role="status">
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-salvia border-t-transparent" aria-hidden="true" />
            {carga.curva ? "Probando con más y más pagos al tiempo…" : "Simulando el canal paquete por paquete…"}
          </p>
        )}
        {carga.fase === "error" && <p className="text-[13px] text-sin">{carga.texto}</p>}
        {r && carga.fase === "listo" && (
          <div className="space-y-2 rounded-lg bg-white p-2.5 ring-1 ring-linea" aria-label="Resultado de la prueba de carga" data-tour="resultado-carga">
            {r.motivo ? (
              <p className="text-[13px] text-sin">{r.motivo}</p>
            ) : (
              <>
                <p className="font-cond text-[16px] leading-tight font-semibold" style={{ color: r.saturada ? COLOR_REVIENTA : r.lenta ? COLOR_LENTO : COLOR_AGUANTA }}>
                  {r.saturada ? "Se revienta" : r.lenta ? "Aguanta, pero lento" : "Aguanta"}: {fmt(r.completosPct, 0)} % de los {r.mensajes} {r.tipo === "pago" ? "pagos" : "mensajes"} {r.tipo === "pago" ? "con comprobante" : "con respuesta"}
                </p>
                <dl className="grid grid-cols-3 gap-1.5 text-[12px]">
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">Espera típica</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{fmt(r.latenciaS.p50, r.latenciaS.p50 < 10 ? 1 : 0)} s</dd>
                    <dd className="text-[11px] text-tenue">el 95 %: {fmt(r.latenciaS.p95, 0)} s</dd>
                  </div>
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">Canal del gateway</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{fmt(r.canalGatewayPct, 0)} %</dd>
                    <dd className="text-[11px] text-tenue">ocupado</dd>
                  </div>
                  <div className="rounded-md bg-papel-2 px-2 py-1.5">
                    <dt className="text-tenue">Choques</dt>
                    <dd className="font-cond text-[16px] font-semibold tabular-nums">{r.colisiones}</dd>
                    <dd className="text-[11px] text-tenue">{r.reintentos} reintentos</dd>
                  </div>
                </dl>
                <p className="text-[12px] leading-snug text-carbon-2">
                  {r.entregados} de {r.mensajes} llegaron al gateway; {fmt(r.primerIntentoPct, 0)} % al primer intento.
                  {r.tipo === "pago" && r.avisosPedidos > 0 ? ` Avisos entregados: ${r.avisos} de ${r.avisosPedidos}.` : ""} {r.transmisiones} transmisiones de radio en {fmt(r.duracionS, 0)} s
                  {r.sordos ? `; ${r.sordos} paquetes perdidos porque el nodo estaba transmitiendo` : ""}
                  {r.perdidasCola ? `; ${r.perdidasCola} descartados por cola llena` : ""}.
                  {r.tipo === "pago" ? ` Un pago limpio por esta red ocupa ~${fmt(r.airePorPagoS, 1)} s de aire.` : ""}
                </p>
                {r.ocupacion.length > 0 && (
                  <p className="text-[12px] leading-snug text-tenue">
                    Más ocupados: {r.ocupacion.slice(0, 3).map((x) => `${x.nombre} ${fmt(x.pct, 0)} %`).join(" · ")}
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
