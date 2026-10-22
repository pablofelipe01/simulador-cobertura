"use client";

// Resultado de la simulación: factibilidad, cobertura por clase, nodos antena (rango de alcance), nodos de campo,
// enlaces, recomendaciones y cómo se calculó.
import { Check, ChevronDown, Route, Target, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import { CLASES, ENLACES, ERROR_MODELO_DB, META_UTIL_ESTUDIO_PCT, presetPorId, UMBRAL_CONFIABLE_DB, UMBRAL_SERVICIO_DB, UMBRAL_UTIL_DB } from "@/lib/radio/constantes";
import { entornoPorId, perdidaEntorno } from "@/lib/radio/entorno";
import { esDireccional } from "@/lib/radio/patron";
import { CLIMAS, esReferencia } from "@/lib/radio/red";
import { alcanceSinObstaculosKm, espacioLibre } from "@/lib/radio/modelo";
import type { Antena, Parametros, ResultadoSimulacion } from "@/lib/radio/tipos";

import { COLORES_ANTENA } from "./capa-cobertura";
import { AjusteAutomatico, type FaseAjuste } from "./panel-ajuste";
import { IconoEquipo, IconoTorre } from "./icono-torre";
import { fmt, Titulo } from "./ui";

type Props = {
  resultado: ResultadoSimulacion | null;
  antenas: Antena[];
  parametros: Parametros;
  desactualizado: boolean;
  calculando: boolean;
  onPerfil: (tx: Antena, destino: Antena) => void;
  /** Ajuste automático («Ajústamelo automáticamente» / «Optimizar la red»). */
  ajuste: FaseAjuste;
  onAjustar: () => void;
  onElegirAjuste: (i: number) => void;
  onAplicarAjuste: () => void;
  onDescartarAjuste: () => void;
  onDeshacerAjuste: () => void;
  /** Quitar el área objetivo (volver a medir en el área de estudio). */
  onQuitarObjetivo: () => void;
};

/** Porcentaje como lo lee la gente: 99,9 sin redondear a 100 y sin decimales cuando sobran. */
const fmtPct = (v: number) => (v >= 99.95 && v < 100 ? "99,9" : v >= 99.5 ? fmt(Math.floor(v * 10) / 10, 1) : fmt(v, 0));
const fmtMeta = (v: number) => (Number.isInteger(v) ? String(v) : v >= 99.95 && v < 100 ? "99,9" : fmt(v, 1));

const NIVELES = [
  { id: "no-factible", texto: "No factible", color: "#D93A2E" },
  { id: "ajustes", texto: "Con ajustes", color: "#F08A2C" },
  { id: "factible", texto: "Factible", color: "#1E7B34" },
] as const;

export function PanelResultados({ resultado: r, antenas, parametros, desactualizado, calculando, onPerfil, ajuste, onAjustar, onElegirAjuste, onAplicarAjuste, onDescartarAjuste, onDeshacerAjuste, onQuitarObjetivo }: Props) {
  const [verTodos, setVerTodos] = useState(false);
  if (!r) {
    return (
      <div className="rounded-lg border border-dashed border-linea p-4 text-[14px] leading-relaxed text-carbon-2">
        {calculando ? "Calculando la primera simulación…" : "Agregue un nodo antena y pulse Simular para ver la cobertura, el rango de alcance, los enlaces de la malla y la factibilidad."}
      </div>
    );
  }
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const cobertura = new Set(r.antenas.map((a) => a.id));
  const deCampo = r.nodos.filter((n) => !cobertura.has(n.id) && porId.has(n.id));
  const f = r.factibilidad;
  const nivel = NIVELES.find((n) => n.id === f.nivel)!;
  const enlacesVisibles = verTodos ? r.enlaces : r.enlaces.filter((e) => e.clase !== "sin").slice(0, 12);
  const obj = r.areaObjetivo ?? null;
  const porClase = (id: (typeof CLASES)[number]["id"]) => (obj ? obj.porClase[id] : r.areaEstudioKm2 > 0 ? (100 * r.areaPorClase[id]) / r.areaEstudioKm2 : 0);

  return (
    <div className={`space-y-5 transition-opacity ${desactualizado ? "opacity-60" : ""}`}>
      {desactualizado && (
        <p className="rounded-md bg-media/30 px-2.5 py-1.5 text-[13px] text-carbon">Hubo cambios después de esta simulación. Simule de nuevo para actualizar.</p>
      )}

      <section data-tour="factibilidad" aria-labelledby="titulo-factibilidad">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titulo-factibilidad" className="font-cond text-[26px] leading-none font-bold" style={{ color: nivel.color }}>
            {f.titulo}
          </h2>
          <span className="font-cond text-[15px] text-carbon-2 tabular-nums" title="Puntaje de factibilidad">
            {f.puntaje}/100
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1" aria-hidden="true">
          {NIVELES.map((n) => (
            <div key={n.id}>
              <div className="h-1.5 rounded-full" style={{ background: n.id === f.nivel ? n.color : "#D9D5CC" }} />
              <span className={`mt-1 block text-[11px] ${n.id === f.nivel ? "font-semibold text-carbon" : "text-tenue"}`}>{n.texto}</span>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1.5">
          {f.criterios.map((c) => (
            <li key={c.nombre} className="flex gap-2 text-[13px] leading-snug">
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${c.ok ? "bg-buena text-white" : "bg-sin/15 text-sin"}`}>
                {c.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
              </span>
              <span>
                <span className="font-medium">{c.nombre}</span>
                <span className="block text-[12px] text-tenue">{c.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
        <AjusteAutomatico nivel={f.nivel} ajuste={ajuste} onAjustar={onAjustar} onElegir={onElegirAjuste} onAplicar={onAplicarAjuste} onDescartar={onDescartarAjuste} onDeshacer={onDeshacerAjuste} />
      </section>

      <section data-tour="cobertura">
        {obj ? (
          <>
            <Titulo>Cobertura del área objetivo</Titulo>
            <p className="-mt-1 mb-2 flex items-start gap-1.5 text-[12.5px] leading-snug text-carbon-2">
              <Target size={14} className="mt-0.5 shrink-0 text-melki" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                «{obj.nombre}» · {fmt(obj.areaKm2, obj.areaKm2 < 10 ? 2 : 1)} km² · meta {fmtMeta(obj.metaPct)} % con {obj.margenDb >= 45 ? "señal buena" : obj.margenDb >= UMBRAL_CONFIABLE_DB ? "señal estable o mejor" : "señal media o mejor"}
                {obj.respaldo ? " desde dos nodos" : ""}
              </span>
              <button type="button" onClick={onQuitarObjetivo} className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-medium text-tenue ring-1 ring-linea hover:bg-white hover:text-carbon" title="Medir la factibilidad en el área de estudio">
                Quitar
              </button>
            </p>
          </>
        ) : (
          <Titulo>Cobertura del área de estudio</Titulo>
        )}
        <dl className="grid grid-cols-2 gap-2">
          {(obj
            ? [
                { t: "Útil", v: obj.utilPct, d: `≥ ${obj.margenDb} dB${obj.respaldo ? " · 2 nodos" : ""} · meta ${fmtMeta(obj.metaPct)} %`, destacado: true },
                { t: "Confiable", v: obj.confiablePct, d: `≥ ${UMBRAL_CONFIABLE_DB} dB` },
                { t: "Con servicio", v: obj.servicioPct, d: `≥ ${UMBRAL_SERVICIO_DB} dB` },
                { t: "Área de estudio", v: r.porcentajeUtil, d: `útil en los ${fmt(r.areaEstudioKm2, 0)} km² alrededor de los nodos` },
              ]
            : [
                { t: "Útil", v: r.porcentajeUtil, d: `≥ ${UMBRAL_UTIL_DB} dB (media o mejor) · meta ${META_UTIL_ESTUDIO_PCT} %`, destacado: true },
                { t: "Confiable", v: r.porcentajeConfiable, d: `≥ ${UMBRAL_CONFIABLE_DB} dB` },
                { t: "Con servicio", v: r.porcentajeServicio, d: `≥ ${UMBRAL_SERVICIO_DB} dB` },
                { t: "Con respaldo", v: r.porcentajeRespaldo, d: "2 nodos antena ≥ 37 dB" },
              ]
          ).map((k) => (
            <div key={k.t} className={`rounded-lg bg-white px-2.5 py-2 ring-1 ${"destacado" in k && k.destacado ? "ring-salvia" : "ring-linea"}`}>
              <dt className="text-[12px] text-carbon-2">{k.t}</dt>
              <dd className="font-cond text-[24px] leading-tight font-semibold tabular-nums">{fmtPct(k.v)} %</dd>
              <dd className="text-[11px] leading-snug text-tenue">{k.d}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full ring-1 ring-black/5" role="img" aria-label="Distribución del área por nivel de señal">
          {CLASES.map((c) => {
            const pct = porClase(c.id);
            return pct > 0 ? <div key={c.id} style={{ width: `${pct}%`, background: c.color }} title={`${c.nombre}: ${fmt(pct)} %`} /> : null;
          })}
        </div>
        <table className="mt-2 w-full text-[13px]">
          <tbody>
            {CLASES.map((c) => {
              const pct = porClase(c.id);
              const area = obj ? (pct / 100) * obj.areaKm2 : r.areaPorClase[c.id];
              return (
                <tr key={c.id}>
                  <td className="py-0.5">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: c.color }} />
                    {c.nombre}
                  </td>
                  <td className="text-right text-tenue tabular-nums">{fmt(area)} km²</td>
                  <td className="w-14 text-right tabular-nums">{fmt(pct)} %</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1.5 text-[12px] text-tenue">
          {obj ? `Área objetivo ${fmt(obj.areaKm2, 1)} km² · área de estudio ${fmt(r.areaEstudioKm2, 0)} km²` : `Área de estudio ${fmt(r.areaEstudioKm2, 0)} km²`} · celdas de {fmt(r.malla.celdaM, 0)} m · {fmt(r.duracionMs / 1000, 1)} s de cálculo.
        </p>
      </section>

      <section data-tour="antenas-resultado">
        <Titulo>Nodos antena · rango de alcance</Titulo>
        <ul className="space-y-1.5">
          {r.antenas.map((a, i) => {
            const nodo = r.nodos.find((n) => n.id === a.id);
            const ant = porId.get(a.id);
            return (
              <li key={a.id} className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-linea">
                <div className="flex items-center gap-2">
                  <span style={{ color: COLORES_ANTENA[i % COLORES_ANTENA.length] }}>
                    <IconoTorre className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-cond text-[15px] font-semibold">{a.nombre}</span>
                  <span className="text-[12px] text-tenue">
                    {ant?.pasarela ? "Pasarela" : nodo?.saltos === null || nodo === undefined ? "Sin ruta" : `${nodo.saltos} ${nodo.saltos === 1 ? "salto" : "saltos"}`}
                  </span>
                </div>
                <dl className="mt-1 grid grid-cols-3 gap-1 text-[12px]">
                  <div>
                    <dt className="text-tenue">Con servicio</dt>
                    <dd className="tabular-nums">
                      {a.alcanceLimitado ? "≥ " : ""}
                      {fmt(a.alcanceKm, 1)} km
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tenue">Confiable</dt>
                    <dd className="tabular-nums">{fmt(a.alcanceConfiableKm, 1)} km</dd>
                  </div>
                  <div>
                    <dt className="text-tenue">Área servida</dt>
                    <dd className="tabular-nums">{fmt(a.areaServicioKm2, 1)} km²</dd>
                  </div>
                </dl>
                {a.alcanceLimitado && <p className="mt-1 text-[11.5px] leading-snug text-tenue">El alcance llega al borde del radio de estudio ({fmt(parametros.radioKm, 0)} km); auméntelo en Parámetros para ver hasta dónde llega.</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {deCampo.length > 0 && (
        <section data-tour="nodos-campo">
          <Titulo>Nodos de campo</Titulo>
          <ul className="space-y-1.5">
            {deCampo.map((n) => {
              const a = porId.get(n.id)!;
              const mejor = r.enlaces.filter((e) => e.a === n.id || e.b === n.id).sort((x, y) => y.margen - x.margen)[0];
              const otro = mejor ? porId.get(mejor.a === n.id ? mejor.b : mejor.a) : undefined;
              return (
                <li key={n.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-[13px] ring-1 ring-linea">
                  <IconoEquipo className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-cond text-[15px] font-semibold">{a.nombre}</span>
                    <span className="block truncate text-[12px] text-tenue">
                      {mejor && otro ? `Mejor enlace: ${otro.nombre} · ${fmt(mejor.distanciaKm, 2)} km · ${fmt(mejor.margen, 0)} dB` : "Sin enlaces evaluados"}
                    </span>
                  </span>
                  <span className={`text-[12px] font-medium ${n.saltos === null ? "text-sin" : "text-carbon-2"}`}>
                    {a.pasarela ? "Pasarela" : n.saltos === null ? "Sin ruta" : `${n.saltos} ${n.saltos === 1 ? "salto" : "saltos"}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section data-tour="enlaces">
        <Titulo
          accion={
            r.enlaces.some((e) => e.clase === "sin") || r.enlaces.length > 12 ? (
              <button type="button" className="text-[13px] text-salvia-oscura underline-offset-2 hover:underline" onClick={() => setVerTodos((v) => !v)}>
                {verTodos ? "Ver solo enlaces útiles" : `Ver los ${r.enlaces.length}`}
              </button>
            ) : undefined
          }
        >
          Enlaces entre nodos
        </Titulo>
        {r.enlaces.length === 0 ? (
          <p className="text-[13px] text-tenue">Con un solo nodo no hay enlaces que evaluar.</p>
        ) : enlacesVisibles.length === 0 ? (
          <p className="text-[13px] text-tenue">Ninguna pareja de nodos logra enlace (≥ 20 dB).</p>
        ) : (
          <ul className="divide-y divide-linea rounded-lg bg-white ring-1 ring-linea">
            {enlacesVisibles.map((e) => {
              const a = porId.get(e.a);
              const b = porId.get(e.b);
              if (!a || !b) return null;
              const c = ENLACES[e.clase];
              return (
                <li key={`${e.a}-${e.b}`} className="flex items-center gap-2 px-2.5 py-1.5 text-[13px]">
                  <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: c.color }} title={c.nombre} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {a.nombre} – {b.nombre}
                    </span>
                    <span className="block text-[12px] text-tenue">
                      {fmt(e.distanciaKm, 2)} km · {e.lineaVista ? "línea de vista" : e.vMax > -0.78 ? "obstruido por el terreno" : "Fresnel parcial"}
                    </span>
                  </span>
                  <span className="font-cond text-[16px] font-semibold tabular-nums">{fmt(e.margen, 0)} dB</span>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-carbon-2 hover:bg-black/5"
                    title="Ver perfil del enlace"
                    aria-label={`Ver perfil del enlace ${a.nombre} – ${b.nombre}`}
                    onClick={() => onPerfil(a, b)}
                  >
                    <Route size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {f.recomendaciones.length > 0 && (
        <section data-tour="recomendaciones">
          <Titulo>Recomendaciones</Titulo>
          <ul className="space-y-2">
            {f.recomendaciones.map((t) => (
              <li key={t} className="flex gap-2 text-[13px] leading-snug">
                <TriangleAlert size={15} className="mt-0.5 shrink-0 text-baja" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ComoSeCalculo r={r} antenas={porId} parametros={parametros} />

      <section className="space-y-1.5 border-t border-linea pt-3 text-[12px] leading-snug text-tenue">
        {r.relieve.mensaje && <p className="text-carbon">{r.relieve.mensaje}</p>}
        <p>
          Relieve: {r.relieve.fuente === "teselas" ? `teselas SRTM en línea (≈ ${r.relieve.resolucionM} m)` : r.relieve.fuente === "hgt" ? `archivos SRTM locales (≈ ${r.relieve.resolucionM} m)` : "terreno plano"}.
        </p>
        <p>
          Modelo: espacio libre + difracción del obstáculo principal sobre tierra 4/3, calibrado con simulaciones de Radio Mobile (error típico ± {ERROR_MODELO_DB} dB). Confirme en campo con una
          prueba de alcance antes de instalar.
        </p>
      </section>
    </div>
  );
}

/** Explicación paso a paso del cálculo, con los números de esta simulación. */
function ComoSeCalculo({ r, antenas, parametros: p }: { r: ResultadoSimulacion; antenas: Map<string, Antena>; parametros: Parametros }) {
  const [abierto, setAbierto] = useState(false);
  const preset = presetPorId(p.preset);
  const fila = (t: string, v: string) => (
    <>
      <dt className="text-tenue">{t}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </>
  );
  return (
    <section data-tour="como-se-calculo">
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="font-cond text-[16px] font-semibold">Cómo se calculó</span>
        <ChevronDown size={17} className={`text-tenue transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <div className="mt-2 space-y-3 text-[13px] leading-snug">
          <ol className="list-decimal space-y-1.5 pl-5 text-carbon-2">
            <li>
              Se toma el relieve ({r.relieve.fuente === "plano" ? "terreno plano" : `SRTM ≈ ${r.relieve.resolucionM} m`}) en un círculo de {fmt(p.radioKm, 0)} km alrededor de cada nodo antena y se divide en celdas de {fmt(r.malla.celdaM, 0)} m.
            </li>
            <li>
              Para cada celda se traza el perfil del terreno desde la antena hasta un receptor a {fmt(p.alturaRxM, 1)} m del suelo, con la curvatura de la Tierra (radio efectivo 4/3).
            </li>
            {p.modelo === "itm" ? (
              <li>Se calcula la pérdida con Longley-Rice (ITM 1.2.2), el modelo de Radio Mobile, sobre el perfil completo y con los parámetros de red elegidos.</li>
            ) : (
              <li>
                Se suma la pérdida en espacio libre, la difracción del obstáculo más fuerte del perfil y una pérdida adicional calibrada con simulaciones de Radio Mobile
                {esReferencia(p) ? "." : "; como los parámetros de red difieren de los de esas pruebas, se suma la diferencia que predice Longley-Rice entre ambos."}
              </li>
            )}
            {(p.entorno !== "abierto" || [...antenas.values()].some(esDireccional)) && (
              <li>
                {p.entorno !== "abierto" ? `Se agrega la pérdida del entorno (${entornoPorId(p.entorno).nombre.toLowerCase()}) a los equipos por debajo de ${fmt(entornoPorId(p.entorno).alturaM, 0)} m. ` : ""}
                {[...antenas.values()].some(esDireccional) ? "Las antenas direccionales restan su patrón de radiación según la dirección y el ángulo hacia cada celda." : ""}
              </li>
            )}
            <li>
              El margen es el presupuesto del enlace menos esas pérdidas. Con servicio: margen ≥ {UMBRAL_SERVICIO_DB} dB; confiable: ≥ {UMBRAL_CONFIABLE_DB} dB.
            </li>
            <li>El rango de alcance de cada dirección (72 sectores de 5°) es la celda más lejana con servicio en ese sector.</li>
          </ol>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg bg-white p-2.5 ring-1 ring-linea">
            {fila("Modulación", `${preset.nombre} (SF${preset.sf}, ${preset.anchoBandaKhz} kHz)`)}
            {fila("Sensibilidad del receptor", `${fmt(preset.sensibilidadDbm, 1)} dBm`)}
            {fila("Frecuencia", `${fmt(p.frecuenciaMhz, 0)} MHz`)}
            {fila("Receptor", `${fmt(p.alturaRxM, 1)} m · ${fmt(p.gananciaRxDbi, 1)} dBi`)}
            {p.perdidaExtraDb > 0 && fila("Pérdida extra (cuerpo, vehículo)", `${fmt(p.perdidaExtraDb, 1)} dB`)}
            {p.entorno !== "abierto" && fila("Entorno", `${entornoPorId(p.entorno).nombre} · ${fmt(perdidaEntorno(p.entorno, p.alturaRxM, p.frecuenciaMhz), 1)} dB en el receptor`)}
            {fila("Modelo", p.modelo === "itm" ? "Longley-Rice (ITM)" : esReferencia(p) ? "Calibrado (Radio Mobile)" : "Calibrado + ajuste Longley-Rice")}
            {fila("Clima y polarización", `${CLIMAS.find((c) => c.id === p.clima)?.nombre ?? ""} · ${p.polarizacion}`)}
            {fila("Confiabilidad", `${fmt(p.tiempoPct, 0)} % tiempo · ${fmt(p.situacionesPct, 0)} % situaciones`)}
          </dl>
          {r.antenas.map((s) => {
            const a = antenas.get(s.id);
            if (!a) return null;
            const libre = alcanceSinObstaculosKm(s.presupuestoDb, p.frecuenciaMhz, a.alturaM, UMBRAL_SERVICIO_DB);
            const fsplAlcance = s.alcanceKm > 0 ? espacioLibre(p.frecuenciaMhz, s.alcanceKm) : null;
            return (
              <div key={s.id} className="rounded-lg bg-white p-2.5 ring-1 ring-linea">
                <p className="flex items-center gap-1.5 font-cond text-[15px] font-semibold">
                  <IconoTorre className="h-4 w-4" /> {s.nombre}
                </p>
                <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                  {fila("Potencia radiada (PIRE)", `${fmt(a.potenciaDbm, 0)} + ${fmt(a.gananciaDbi, 1)} − ${fmt(a.perdidaCableDb, 1)} = ${fmt(s.pireDbm, 1)} dBm`)}
                  {fila("Presupuesto hasta la sensibilidad", `${fmt(s.presupuestoDb, 1)} dB`)}
                  {fila("Altura de la antena", `${fmt(a.alturaM, 1)} m sobre ${s.elevacionM} m s. n. m.`)}
                  {fila("Alcance sin obstáculos (modelo)", `${fmt(libre, 1)} km`)}
                  {fila("Alcance con el relieve", `${s.alcanceLimitado ? "≥ " : ""}${fmt(s.alcanceKm, 1)} km`)}
                  {fsplAlcance !== null && fila("Espacio libre a esa distancia", `${fmt(fsplAlcance, 1)} dB`)}
                </dl>
                <p className="mt-1.5 text-[12px] text-tenue">
                  {s.alcanceLimitado
                    ? "El alcance real llega al borde del estudio: amplíe el radio para medirlo completo."
                    : s.alcanceKm < libre * 0.8
                      ? "El relieve recorta el alcance frente al caso sin obstáculos: subir la antena o moverla a un punto alto ayuda."
                      : "El relieve casi no recorta el alcance en este sitio."}
                </p>
              </div>
            );
          })}
          <p className="text-[12px] text-tenue">
            {fmt(r.duracionMs / 1000, 1)} s de cálculo en este equipo; nada sale a internet salvo las teselas de mapa y relieve.
          </p>
        </div>
      )}
    </section>
  );
}
