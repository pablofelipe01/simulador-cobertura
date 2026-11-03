// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Resultado de la simulación: factibilidad, cobertura por clase, nodos antena (rango de alcance), nodos de campo,
// enlaces, recomendaciones y cómo se calculó.
import { Check, ChevronDown, Route, Target, TriangleAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { numeroLocal, tx } from "@/lib/idioma";
import { CLASES, ENLACES, ERROR_MODELO_DB, META_UTIL_ESTUDIO_PCT, presetPorId, UMBRAL_CONFIABLE_DB, UMBRAL_SERVICIO_DB, UMBRAL_UTIL_DB } from "@/lib/radio/constantes";
import { entornoPorId, perdidaEntorno } from "@/lib/radio/entorno";
import { esDireccional } from "@/lib/radio/patron";
import { CLIMAS, esReferencia } from "@/lib/radio/red";
import { alcanceSinObstaculosKm, espacioLibre } from "@/lib/radio/modelo";
import type { Antena, Parametros, ResultadoSimulacion } from "@/lib/radio/tipos";
import { useIdioma } from "@/lib/use-idioma";

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
  /** «Poblar personas» y «Prueba de carga» (van después de la cobertura, también antes de simular). */
  capacidad?: ReactNode;
};

/** Porcentaje como lo lee la gente: 99,9 sin redondear a 100 y sin decimales cuando sobran. */
const fmtPct = (v: number) => (v >= 99.95 && v < 100 ? tx("99,9", "99.9") : v >= 99.5 ? fmt(Math.floor(v * 10) / 10, 1) : fmt(v, 0));
const fmtMeta = (v: number) => (Number.isInteger(v) ? String(v) : v >= 99.95 && v < 100 ? tx("99,9", "99.9") : fmt(v, 1));
/** Un porcentaje ya escrito: «45 %» en español, «45%» en inglés. */
const conPct = (v: string | number) => tx(`${v} %`, `${v}%`);
const saltosTexto = (n: number) => tx(`${n} ${n === 1 ? "salto" : "saltos"}`, `${n} ${n === 1 ? "hop" : "hops"}`);

const NIVELES = [
  {
    id: "no-factible",
    get texto() {
      return tx("No factible", "Not feasible");
    },
    color: "#D93A2E",
  },
  {
    id: "ajustes",
    get texto() {
      return tx("Con ajustes", "With adjustments");
    },
    color: "#F08A2C",
  },
  {
    id: "factible",
    get texto() {
      return tx("Factible", "Feasible");
    },
    color: "#1E7B34",
  },
] as const;

export function PanelResultados({ resultado: r, antenas, parametros, desactualizado, calculando, onPerfil, ajuste, onAjustar, onElegirAjuste, onAplicarAjuste, onDescartarAjuste, onDeshacerAjuste, onQuitarObjetivo, capacidad }: Props) {
  useIdioma();
  const [verTodos, setVerTodos] = useState(false);
  if (!r) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-linea p-4 text-[14px] leading-relaxed text-carbon-2">
          {calculando
            ? tx("Calculando la primera simulación…", "Calculating the first simulation…")
            : tx(
                "Agregue un nodo antena y pulse Simular para ver la cobertura, el rango de alcance, los enlaces de la malla y la factibilidad.",
                "Add an antenna node and press Simulate to see the coverage, the range, the mesh links and the feasibility.",
              )}
        </div>
        {capacidad}
      </div>
    );
  }
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const cobertura = new Set(r.antenas.map((a) => a.id));
  const deCampoTodos = r.nodos.filter((n) => !cobertura.has(n.id) && porId.has(n.id));
  // Las personas pobladas al azar se resumen (pueden ser cientos); las puestas a mano se listan una por una
  const deCampo = deCampoTodos.filter((n) => !porId.get(n.id)?.poblada);
  const pobladas = deCampoTodos.filter((n) => porId.get(n.id)?.poblada);
  const conectadasPobladas = pobladas.filter((n) => n.saltos !== null && n.saltos <= parametros.limiteSaltos);
  const lejosPobladas = pobladas.filter((n) => n.saltos !== null && n.saltos > parametros.limiteSaltos).length;
  const saltosPromedio = conectadasPobladas.length ? conectadasPobladas.reduce((s, n) => s + (n.saltos ?? 0), 0) / conectadasPobladas.length : 0;
  const f = r.factibilidad;
  const nivel = NIVELES.find((n) => n.id === f.nivel)!;
  const tocaPoblada = (e: { a: string; b: string }) => Boolean(porId.get(e.a)?.poblada || porId.get(e.b)?.poblada);
  const enlacesLista = r.enlaces.filter((e) => !tocaPoblada(e));
  const enlacesPoblados = r.enlaces.length - enlacesLista.length;
  const enlacesVisibles = verTodos ? enlacesLista : enlacesLista.filter((e) => e.clase !== "sin").slice(0, 12);
  const obj = r.areaObjetivo ?? null;
  const porClase = (id: (typeof CLASES)[number]["id"]) => (obj ? obj.porClase[id] : r.areaEstudioKm2 > 0 ? (100 * r.areaPorClase[id]) / r.areaEstudioKm2 : 0);
  const sinRuta = pobladas.length - conectadasPobladas.length - lejosPobladas;

  return (
    <div className={`space-y-5 transition-opacity ${desactualizado ? "opacity-60" : ""}`}>
      {desactualizado && (
        <p className="rounded-md bg-media/30 px-2.5 py-1.5 text-[13px] text-carbon">
          {tx("Hubo cambios después de esta simulación. Simule de nuevo para actualizar.", "There were changes after this simulation. Simulate again to update.")}
        </p>
      )}

      <section data-tour="factibilidad" aria-labelledby="titulo-factibilidad">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titulo-factibilidad" className="font-cond text-[26px] leading-none font-bold" style={{ color: nivel.color }}>
            {f.titulo}
          </h2>
          <span className="font-cond text-[15px] text-carbon-2 tabular-nums" title={tx("Puntaje de factibilidad", "Feasibility score")}>
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
            <Titulo>{tx("Cobertura del área objetivo", "Target area coverage")}</Titulo>
            <p className="-mt-1 mb-2 flex items-start gap-1.5 text-[12.5px] leading-snug text-carbon-2">
              <Target size={14} className="mt-0.5 shrink-0 text-melki" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                {tx(
                  `«${obj.nombre}» · ${fmt(obj.areaKm2, obj.areaKm2 < 10 ? 2 : 1)} km² · meta ${fmtMeta(obj.metaPct)} % con ${obj.margenDb >= 45 ? "señal buena" : obj.margenDb >= UMBRAL_CONFIABLE_DB ? "señal estable o mejor" : "señal media o mejor"}`,
                  `“${obj.nombre}” · ${fmt(obj.areaKm2, obj.areaKm2 < 10 ? 2 : 1)} km² · target ${fmtMeta(obj.metaPct)}% with ${obj.margenDb >= 45 ? "good signal" : obj.margenDb >= UMBRAL_CONFIABLE_DB ? "stable signal or better" : "fair signal or better"}`,
                )}
                {obj.respaldo ? tx(" desde dos nodos", " from two nodes") : ""}
              </span>
              <button
                type="button"
                onClick={onQuitarObjetivo}
                className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-medium text-tenue ring-1 ring-linea hover:bg-white hover:text-carbon"
                title={tx("Medir la factibilidad en el área de estudio", "Measure feasibility over the study area")}
              >
                {tx("Quitar", "Remove")}
              </button>
            </p>
          </>
        ) : (
          <Titulo>{tx("Cobertura del área de estudio", "Study area coverage")}</Titulo>
        )}
        <dl className="grid grid-cols-2 gap-2">
          {(obj
            ? [
                {
                  t: tx("Útil", "Useful"),
                  v: obj.utilPct,
                  d: tx(`≥ ${obj.margenDb} dB${obj.respaldo ? " · 2 nodos" : ""} · meta ${fmtMeta(obj.metaPct)} %`, `≥ ${obj.margenDb} dB${obj.respaldo ? " · 2 nodes" : ""} · target ${fmtMeta(obj.metaPct)}%`),
                  destacado: true,
                },
                { t: tx("Confiable", "Reliable"), v: obj.confiablePct, d: `≥ ${UMBRAL_CONFIABLE_DB} dB` },
                { t: tx("Con servicio", "With service"), v: obj.servicioPct, d: `≥ ${UMBRAL_SERVICIO_DB} dB` },
                { t: tx("Área de estudio", "Study area"), v: r.porcentajeUtil, d: tx(`útil en los ${fmt(r.areaEstudioKm2, 0)} km² alrededor de los nodos`, `useful over the ${fmt(r.areaEstudioKm2, 0)} km² around the nodes`) },
              ]
            : [
                {
                  t: tx("Útil", "Useful"),
                  v: r.porcentajeUtil,
                  d: tx(`≥ ${UMBRAL_UTIL_DB} dB (media o mejor) · meta ${META_UTIL_ESTUDIO_PCT} %`, `≥ ${UMBRAL_UTIL_DB} dB (fair or better) · target ${META_UTIL_ESTUDIO_PCT}%`),
                  destacado: true,
                },
                { t: tx("Confiable", "Reliable"), v: r.porcentajeConfiable, d: `≥ ${UMBRAL_CONFIABLE_DB} dB` },
                { t: tx("Con servicio", "With service"), v: r.porcentajeServicio, d: `≥ ${UMBRAL_SERVICIO_DB} dB` },
                { t: tx("Con respaldo", "With backup"), v: r.porcentajeRespaldo, d: tx("2 nodos antena ≥ 37 dB", "2 antenna nodes ≥ 37 dB") },
              ]
          ).map((k) => (
            <div key={k.t} className={`rounded-lg bg-white px-2.5 py-2 ring-1 ${"destacado" in k && k.destacado ? "ring-salvia" : "ring-linea"}`}>
              <dt className="text-[12px] text-carbon-2">{k.t}</dt>
              <dd className="font-cond text-[24px] leading-tight font-semibold tabular-nums">{conPct(fmtPct(k.v))}</dd>
              <dd className="text-[11px] leading-snug text-tenue">{k.d}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full ring-1 ring-black/5" role="img" aria-label={tx("Distribución del área por nivel de señal", "Area distribution by signal level")}>
          {CLASES.map((c) => {
            const pct = porClase(c.id);
            return pct > 0 ? <div key={c.id} style={{ width: `${pct}%`, background: c.color }} title={`${c.nombre}: ${conPct(fmt(pct))}`} /> : null;
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
                  <td className="w-14 text-right tabular-nums">{conPct(fmt(pct))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1.5 text-[12px] text-tenue">
          {obj
            ? tx(`Área objetivo ${fmt(obj.areaKm2, 1)} km² · área de estudio ${fmt(r.areaEstudioKm2, 0)} km²`, `Target area ${fmt(obj.areaKm2, 1)} km² · study area ${fmt(r.areaEstudioKm2, 0)} km²`)
            : tx(`Área de estudio ${fmt(r.areaEstudioKm2, 0)} km²`, `Study area ${fmt(r.areaEstudioKm2, 0)} km²`)}
          {tx(` · celdas de ${fmt(r.malla.celdaM, 0)} m · ${fmt(r.duracionMs / 1000, 1)} s de cálculo.`, ` · ${fmt(r.malla.celdaM, 0)} m cells · ${fmt(r.duracionMs / 1000, 1)} s of computation.`)}
        </p>
      </section>

      {capacidad}

      <section data-tour="antenas-resultado">
        <Titulo>{tx("Nodos antena · rango de alcance", "Antenna nodes · range")}</Titulo>
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
                    {ant?.pasarela ? tx("Pasarela", "Gateway") : nodo?.saltos === null || nodo === undefined ? tx("Sin ruta", "No route") : saltosTexto(nodo.saltos)}
                  </span>
                </div>
                <dl className="mt-1 grid grid-cols-3 gap-1 text-[12px]">
                  <div>
                    <dt className="text-tenue">{tx("Con servicio", "With service")}</dt>
                    <dd className="tabular-nums">
                      {a.alcanceLimitado ? "≥ " : ""}
                      {fmt(a.alcanceKm, 1)} km
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tenue">{tx("Confiable", "Reliable")}</dt>
                    <dd className="tabular-nums">{fmt(a.alcanceConfiableKm, 1)} km</dd>
                  </div>
                  <div>
                    <dt className="text-tenue">{tx("Área servida", "Area served")}</dt>
                    <dd className="tabular-nums">{fmt(a.areaServicioKm2, 1)} km²</dd>
                  </div>
                </dl>
                {a.alcanceLimitado && (
                  <p className="mt-1 text-[11.5px] leading-snug text-tenue">
                    {tx(
                      `El alcance llega al borde del radio de estudio (${fmt(parametros.radioKm, 0)} km); auméntelo en Parámetros para ver hasta dónde llega.`,
                      `The range reaches the edge of the study radius (${fmt(parametros.radioKm, 0)} km); increase it in Parameters to see how far it goes.`,
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {deCampoTodos.length > 0 && (
        <section data-tour="nodos-campo">
          <Titulo>{tx("Nodos de campo", "Field nodes")}</Titulo>
          {pobladas.length > 0 && (
            <div className="mb-1.5 rounded-lg bg-white px-2.5 py-2 text-[13px] ring-1 ring-linea" data-tour="resumen-pobladas">
              <p className="font-cond text-[15px] font-semibold">
                {tx(
                  `${numeroLocal(pobladas.length)} personas pobladas: ${numeroLocal(conectadasPobladas.length)} conectadas (${fmtPct((100 * conectadasPobladas.length) / pobladas.length)} %)`,
                  `${numeroLocal(pobladas.length)} populated people: ${numeroLocal(conectadasPobladas.length)} connected (${fmtPct((100 * conectadasPobladas.length) / pobladas.length)}%)`,
                )}
              </p>
              <p className="text-[12px] leading-snug text-tenue">
                {conectadasPobladas.length ? tx(`En promedio a ${fmt(saltosPromedio, 1)} saltos del gateway. `, `On average ${fmt(saltosPromedio, 1)} hops from the gateway. `) : ""}
                {lejosPobladas ? tx(`${lejosPobladas} llegan con más de ${parametros.limiteSaltos} saltos. `, `${lejosPobladas} arrive with more than ${parametros.limiteSaltos} hops. `) : ""}
                {sinRuta > 0 ? tx(`${sinRuta} sin ruta al gateway.`, `${sinRuta} with no route to the gateway.`) : ""}
              </p>
            </div>
          )}
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
                      {mejor && otro
                        ? tx(`Mejor enlace: ${otro.nombre} · ${fmt(mejor.distanciaKm, 2)} km · ${fmt(mejor.margen, 0)} dB`, `Best link: ${otro.nombre} · ${fmt(mejor.distanciaKm, 2)} km · ${fmt(mejor.margen, 0)} dB`)
                        : tx("Sin enlaces evaluados", "No links evaluated")}
                    </span>
                  </span>
                  <span className={`text-[12px] font-medium ${n.saltos === null ? "text-sin" : "text-carbon-2"}`}>
                    {a.pasarela ? tx("Pasarela", "Gateway") : n.saltos === null ? tx("Sin ruta", "No route") : saltosTexto(n.saltos)}
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
            enlacesLista.some((e) => e.clase === "sin") || enlacesLista.length > 12 ? (
              <button type="button" className="text-[13px] text-salvia-oscura underline-offset-2 hover:underline" onClick={() => setVerTodos((v) => !v)}>
                {verTodos ? tx("Ver solo enlaces útiles", "Show only useful links") : tx(`Ver los ${enlacesLista.length}`, `Show all ${enlacesLista.length}`)}
              </button>
            ) : undefined
          }
        >
          {tx("Enlaces entre nodos", "Links between nodes")}
        </Titulo>
        {enlacesPoblados > 0 && (
          <p className="mb-1.5 text-[12px] text-tenue">
            {tx(
              `${numeroLocal(enlacesPoblados)} enlaces de las personas pobladas no se listan; en el mapa se ve el de su ruta.`,
              `${numeroLocal(enlacesPoblados)} links of the populated people aren't listed; the map shows the one on their route.`,
            )}
          </p>
        )}
        {enlacesLista.length === 0 && enlacesPoblados > 0 ? null : r.enlaces.length === 0 ? (
          <p className="text-[13px] text-tenue">{tx("Con un solo nodo no hay enlaces que evaluar.", "With a single node there are no links to evaluate.")}</p>
        ) : enlacesVisibles.length === 0 ? (
          <p className="text-[13px] text-tenue">{tx("Ninguna pareja de nodos logra enlace (≥ 20 dB).", "No pair of nodes achieves a link (≥ 20 dB).")}</p>
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
                      {fmt(e.distanciaKm, 2)} km · {e.lineaVista ? tx("línea de vista", "line of sight") : e.vMax > -0.78 ? tx("obstruido por el terreno", "obstructed by terrain") : tx("Fresnel parcial", "partial Fresnel")}
                    </span>
                  </span>
                  <span className="font-cond text-[16px] font-semibold tabular-nums">{fmt(e.margen, 0)} dB</span>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-carbon-2 hover:bg-black/5"
                    title={tx("Ver perfil del enlace", "Show link profile")}
                    aria-label={tx(`Ver perfil del enlace ${a.nombre} – ${b.nombre}`, `Show link profile ${a.nombre} – ${b.nombre}`)}
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
          <Titulo>{tx("Recomendaciones", "Recommendations")}</Titulo>
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
          {tx("Relieve: ", "Terrain: ")}
          {r.relieve.fuente === "teselas"
            ? tx(`teselas SRTM en línea (≈ ${r.relieve.resolucionM} m)`, `online SRTM tiles (≈ ${r.relieve.resolucionM} m)`)
            : r.relieve.fuente === "hgt"
              ? tx(`archivos SRTM locales (≈ ${r.relieve.resolucionM} m)`, `local SRTM files (≈ ${r.relieve.resolucionM} m)`)
              : tx("terreno plano", "flat terrain")}
          .
        </p>
        <p>
          {tx(
            `Modelo: espacio libre + difracción del obstáculo principal sobre tierra 4/3, calibrado con simulaciones de Radio Mobile (error típico ± ${ERROR_MODELO_DB} dB). Confirme en campo con una prueba de alcance antes de instalar.`,
            `Model: free space + diffraction from the main obstacle over a 4/3 Earth, calibrated with Radio Mobile simulations (typical error ± ${ERROR_MODELO_DB} dB). Confirm in the field with a range test before installing.`,
          )}
        </p>
      </section>
    </div>
  );
}

/** Explicación paso a paso del cálculo, con los números de esta simulación. */
function ComoSeCalculo({ r, antenas, parametros: p }: { r: ResultadoSimulacion; antenas: Map<string, Antena>; parametros: Parametros }) {
  useIdioma();
  const [abierto, setAbierto] = useState(false);
  const preset = presetPorId(p.preset);
  const fila = (t: string, v: string) => (
    <>
      <dt className="text-tenue">{t}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </>
  );
  const direccionales = [...antenas.values()].some(esDireccional);
  return (
    <section data-tour="como-se-calculo">
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="font-cond text-[16px] font-semibold">{tx("Cómo se calculó", "How it was calculated")}</span>
        <ChevronDown size={17} className={`text-tenue transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <div className="mt-2 space-y-3 text-[13px] leading-snug">
          <ol className="list-decimal space-y-1.5 pl-5 text-carbon-2">
            <li>
              {tx(
                `Se toma el relieve (${r.relieve.fuente === "plano" ? "terreno plano" : `SRTM ≈ ${r.relieve.resolucionM} m`}) en un círculo de ${fmt(p.radioKm, 0)} km alrededor de cada nodo antena y se divide en celdas de ${fmt(r.malla.celdaM, 0)} m.`,
                `The terrain (${r.relieve.fuente === "plano" ? "flat terrain" : `SRTM ≈ ${r.relieve.resolucionM} m`}) is taken in a ${fmt(p.radioKm, 0)} km circle around each antenna node and split into ${fmt(r.malla.celdaM, 0)} m cells.`,
              )}
            </li>
            <li>
              {tx(
                `Para cada celda se traza el perfil del terreno desde la antena hasta un receptor a ${fmt(p.alturaRxM, 1)} m del suelo, con la curvatura de la Tierra (radio efectivo 4/3).`,
                `For each cell, the terrain profile is traced from the antenna to a receiver ${fmt(p.alturaRxM, 1)} m above the ground, with the Earth's curvature (4/3 effective radius).`,
              )}
            </li>
            {p.modelo === "itm" ? (
              <li>
                {tx(
                  "Se calcula la pérdida con Longley-Rice (ITM 1.2.2), el modelo de Radio Mobile, sobre el perfil completo y con los parámetros de red elegidos.",
                  "The loss is calculated with Longley-Rice (ITM 1.2.2), the Radio Mobile model, over the full profile and with the chosen network parameters.",
                )}
              </li>
            ) : (
              <li>
                {tx(
                  "Se suma la pérdida en espacio libre, la difracción del obstáculo más fuerte del perfil y una pérdida adicional calibrada con simulaciones de Radio Mobile",
                  "It adds the free-space loss, the diffraction from the strongest obstacle in the profile and an extra loss calibrated with Radio Mobile simulations",
                )}
                {esReferencia(p)
                  ? "."
                  : tx(
                      "; como los parámetros de red difieren de los de esas pruebas, se suma la diferencia que predice Longley-Rice entre ambos.",
                      "; since the network parameters differ from the ones in those tests, it also adds the difference Longley-Rice predicts between the two.",
                    )}
              </li>
            )}
            {(p.entorno !== "abierto" || direccionales) && (
              <li>
                {p.entorno !== "abierto"
                  ? tx(
                      `Se agrega la pérdida del entorno (${entornoPorId(p.entorno).nombre.toLowerCase()}) a los equipos por debajo de ${fmt(entornoPorId(p.entorno).alturaM, 0)} m. `,
                      `The environment loss (${entornoPorId(p.entorno).nombre.toLowerCase()}) is added to devices below ${fmt(entornoPorId(p.entorno).alturaM, 0)} m. `,
                    )
                  : ""}
                {direccionales
                  ? tx(
                      "Las antenas direccionales restan su patrón de radiación según la dirección y el ángulo hacia cada celda.",
                      "Directional antennas subtract their radiation pattern according to the direction and angle toward each cell.",
                    )
                  : ""}
              </li>
            )}
            <li>
              {tx(
                `El margen es el presupuesto del enlace menos esas pérdidas. Con servicio: margen ≥ ${UMBRAL_SERVICIO_DB} dB; confiable: ≥ ${UMBRAL_CONFIABLE_DB} dB.`,
                `The margin is the link budget minus those losses. With service: margin ≥ ${UMBRAL_SERVICIO_DB} dB; reliable: ≥ ${UMBRAL_CONFIABLE_DB} dB.`,
              )}
            </li>
            <li>
              {tx(
                "El rango de alcance de cada dirección (72 sectores de 5°) es la celda más lejana con servicio en ese sector.",
                "The range in each direction (72 sectors of 5°) is the farthest cell with service in that sector.",
              )}
            </li>
          </ol>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg bg-white p-2.5 ring-1 ring-linea">
            {fila(tx("Modulación", "Modulation"), `${preset.nombre} (SF${preset.sf}, ${preset.anchoBandaKhz} kHz)`)}
            {fila(tx("Sensibilidad del receptor", "Receiver sensitivity"), `${fmt(preset.sensibilidadDbm, 1)} dBm`)}
            {fila(tx("Frecuencia", "Frequency"), `${fmt(p.frecuenciaMhz, 0)} MHz`)}
            {fila(tx("Receptor", "Receiver"), `${fmt(p.alturaRxM, 1)} m · ${fmt(p.gananciaRxDbi, 1)} dBi`)}
            {p.perdidaExtraDb > 0 && fila(tx("Pérdida extra (cuerpo, vehículo)", "Extra loss (body, vehicle)"), `${fmt(p.perdidaExtraDb, 1)} dB`)}
            {p.entorno !== "abierto" &&
              fila(
                tx("Entorno", "Environment"),
                tx(
                  `${entornoPorId(p.entorno).nombre} · ${fmt(perdidaEntorno(p.entorno, p.alturaRxM, p.frecuenciaMhz), 1)} dB en el receptor`,
                  `${entornoPorId(p.entorno).nombre} · ${fmt(perdidaEntorno(p.entorno, p.alturaRxM, p.frecuenciaMhz), 1)} dB at the receiver`,
                ),
              )}
            {fila(
              tx("Modelo", "Model"),
              p.modelo === "itm" ? "Longley-Rice (ITM)" : esReferencia(p) ? tx("Calibrado (Radio Mobile)", "Calibrated (Radio Mobile)") : tx("Calibrado + ajuste Longley-Rice", "Calibrated + Longley-Rice adjustment"),
            )}
            {fila(tx("Clima y polarización", "Climate and polarization"), `${CLIMAS.find((c) => c.id === p.clima)?.nombre ?? ""} · ${p.polarizacion}`)}
            {fila(tx("Confiabilidad", "Reliability"), tx(`${fmt(p.tiempoPct, 0)} % tiempo · ${fmt(p.situacionesPct, 0)} % situaciones`, `${fmt(p.tiempoPct, 0)}% time · ${fmt(p.situacionesPct, 0)}% situations`))}
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
                  {fila(tx("Potencia radiada (PIRE)", "Radiated power (EIRP)"), `${fmt(a.potenciaDbm, 0)} + ${fmt(a.gananciaDbi, 1)} − ${fmt(a.perdidaCableDb, 1)} = ${fmt(s.pireDbm, 1)} dBm`)}
                  {fila(tx("Presupuesto hasta la sensibilidad", "Budget down to the sensitivity"), `${fmt(s.presupuestoDb, 1)} dB`)}
                  {fila(tx("Altura de la antena", "Antenna height"), tx(`${fmt(a.alturaM, 1)} m sobre ${s.elevacionM} m s. n. m.`, `${fmt(a.alturaM, 1)} m above ${s.elevacionM} m a.s.l.`))}
                  {fila(tx("Alcance sin obstáculos (modelo)", "Range without obstacles (model)"), `${fmt(libre, 1)} km`)}
                  {fila(tx("Alcance con el relieve", "Range with the terrain"), `${s.alcanceLimitado ? "≥ " : ""}${fmt(s.alcanceKm, 1)} km`)}
                  {fsplAlcance !== null && fila(tx("Espacio libre a esa distancia", "Free space at that distance"), `${fmt(fsplAlcance, 1)} dB`)}
                </dl>
                <p className="mt-1.5 text-[12px] text-tenue">
                  {s.alcanceLimitado
                    ? tx("El alcance real llega al borde del estudio: amplíe el radio para medirlo completo.", "The real range reaches the edge of the study: widen the radius to measure it fully.")
                    : s.alcanceKm < libre * 0.8
                      ? tx(
                          "El relieve recorta el alcance frente al caso sin obstáculos: subir la antena o moverla a un punto alto ayuda.",
                          "The terrain cuts the range compared with the obstacle-free case: raising the antenna or moving it to a high point helps.",
                        )
                      : tx("El relieve casi no recorta el alcance en este sitio.", "The terrain barely cuts the range at this site.")}
                </p>
              </div>
            );
          })}
          <p className="text-[12px] text-tenue">
            {tx(
              `${fmt(r.duracionMs / 1000, 1)} s de cálculo en este equipo; nada sale a internet salvo las teselas de mapa y relieve.`,
              `${fmt(r.duracionMs / 1000, 1)} s of computation on this device; nothing goes out to the internet except the map and terrain tiles.`,
            )}
          </p>
        </div>
      )}
    </section>
  );
}
