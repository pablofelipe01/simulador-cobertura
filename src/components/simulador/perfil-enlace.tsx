// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Perfil del terreno entre dos puntos (relieve con curvatura 4/3, línea de vista y zona de Fresnel)
// e informe de radioenlace al estilo de «Radio Link» de Radio Mobile.
import { Check, Copy, Download, FileText, X } from "lucide-react";
import { useState } from "react";

import { CLASES, RADIO_EFECTIVO_M } from "@/lib/radio/constantes";
import { rumboTexto } from "@/lib/radio/geo";
import { tx } from "@/lib/idioma";
import { campoInforme, MODOS_ITM, nombreModelo, textoInforme, textoUv } from "@/lib/radio/informe";
import { longitudOnda } from "@/lib/radio/modelo";
import type { InformeEnlace, Perfil } from "@/lib/radio/tipos";
import { useIdioma } from "@/lib/use-idioma";

import { fmt } from "./ui";

function descargarTexto(nombre: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto.replace(/\n/g, "\r\n")], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Fila({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linea/60 py-[3px] last:border-0">
      <dt className="text-tenue">{k}</dt>
      <dd className={`text-right whitespace-nowrap tabular-nums ${fuerte ? "font-semibold text-carbon" : ""}`}>{v}</dd>
    </div>
  );
}

function Informe({ i }: { i: InformeEnlace }) {
  useIdioma();
  const [copiado, setCopiado] = useState(false);
  const texto = () => textoInforme(i);
  const nombre = `radioenlace_${i.origen}_${i.destino}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_") + ".txt";
  return (
    <div className="mt-2 border-t border-linea pt-2" data-tour="informe">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-[12px] text-tenue">
          {nombreModelo(i)} · {i.parametrosTexto}
        </p>
        <span className="flex gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-carbon-2 ring-1 ring-linea hover:bg-papel-2"
            onClick={() => {
              void navigator.clipboard?.writeText(texto()).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              });
            }}
          >
            {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? tx("Copiado", "Copied") : tx("Copiar", "Copy")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-carbon-2 ring-1 ring-linea hover:bg-papel-2"
            onClick={() => descargarTexto(nombre, texto())}
          >
            <Download size={14} /> {tx("Descargar", "Download")}
          </button>
        </span>
      </div>
      <div className="@container">
      <div className="grid gap-x-5 gap-y-2 text-[12.5px] @lg:grid-cols-2 @4xl:grid-cols-3">
        <dl>
          <p className="font-cond text-[13.5px] font-semibold">{tx("Geometría", "Geometry")}</p>
          <Fila k={tx("Distancia", "Distance")} v={`${fmt(i.distanciaKm, 3)} km`} />
          <Fila k={tx("Azimut ida", "Azimuth (forward)")} v={rumboTexto(i.rumboIdaDeg)} />
          <Fila k={tx("Azimut vuelta", "Azimuth (reverse)")} v={rumboTexto(i.rumboVueltaDeg)} />
          <Fila k={tx("Elevación ida / vuelta", "Elevation forward / reverse")} v={`${fmt(i.elevacionIdaDeg, 2)}° / ${fmt(i.elevacionVueltaDeg, 2)}°`} />
          <Fila k={tx("Suelo (origen / destino)", "Ground (origin / destination)")} v={`${fmt(i.sueloOrigenM, 0)} / ${fmt(i.sueloDestinoM, 0)} m`} />
          <Fila k={tx("Antenas (origen / destino)", "Antennas (origin / destination)")} v={`${fmt(i.alturaOrigenM)} / ${fmt(i.alturaDestinoM)} m`} />
          <Fila k={tx("Peor Fresnel", "Worst Fresnel")} v={tx(`${fmt(i.peorFresnel, 1)} F1 a ${fmt(i.peorFresnelKm, 2)} km`, `${fmt(i.peorFresnel, 1)} F1 at ${fmt(i.peorFresnelKm, 2)} km`)} />
          <Fila
            k={tx("Línea de vista", "Line of sight")}
            v={i.lineaVista ? tx("despejada", "clear") : i.peorFresnel >= 0 ? tx("parcialmente obstruida", "partially obstructed") : tx("obstruida", "obstructed")}
          />
        </dl>
        <dl>
          <p className="font-cond text-[13.5px] font-semibold">{tx("Potencias y antenas", "Power and antennas")}</p>
          <Fila k={tx("Potencia Tx", "Tx power")} v={`${fmt(i.potenciaTxDbm)} dBm`} />
          <Fila k={tx("Cable Tx", "Tx cable")} v={`${fmt(i.perdidaCableTxDb)} dB`} />
          <Fila k={tx("Ganancia Tx", "Tx gain")} v={`${fmt(i.gananciaTxDbi)} dBi${i.patronTxDb > 0.05 ? ` − ${fmt(i.patronTxDb)}` : ""}`} />
          <Fila k={tx("PIRE", "EIRP")} v={`${fmt(i.pireDbm)} dBm`} fuerte />
          <Fila k={tx("Ganancia Rx", "Rx gain")} v={`${fmt(i.gananciaRxDbi)} dBi${i.patronRxDb > 0.05 ? ` − ${fmt(i.patronRxDb)}` : ""}`} />
          <Fila k={tx("Cable Rx", "Rx cable")} v={`${fmt(i.perdidaCableRxDb)} dB`} />
          {i.perdidaExtraRxDb > 0 && <Fila k={tx("Pérdida extra Rx", "Rx extra loss")} v={`${fmt(i.perdidaExtraRxDb)} dB`} />}
        </dl>
        <dl>
          <p className="font-cond text-[13.5px] font-semibold">{tx("Pérdidas y recepción", "Losses and reception")}</p>
          <Fila k={tx("Espacio libre", "Free space")} v={`${fmt(i.espacioLibreDb)} dB`} />
          <Fila k={i.modelo === "itm" ? tx("Terreno (ITM)", "Terrain (ITM)") : tx("Obstrucción", "Obstruction")} v={`${fmt(i.obstruccionDb)} dB`} />
          <Fila k={i.modelo === "itm" ? tx("Variabilidad", "Variability") : tx("Estadística", "Statistics")} v={`${fmt(i.estadisticaDb)} dB`} />
          {i.modelo !== "itm" && Math.abs(i.ajusteRedDb) > 0.005 && <Fila k={tx("Ajuste de red", "Network adjustment")} v={`${i.ajusteRedDb > 0 ? "+" : ""}${fmt(i.ajusteRedDb)} dB`} />}
          {i.entornoDb > 0.005 && <Fila k={tx("Entorno", "Environment")} v={`${fmt(i.entornoDb)} dB`} />}
          <Fila k={tx("Pérdida total", "Total loss")} v={`${fmt(i.perdidaTotalDb)} dB`} fuerte />
          <Fila k="Longley-Rice" v={`${fmt(i.itm.perdidaDb)} dB (${MODOS_ITM[i.itm.modo]})`} />
          <Fila k={tx("Nivel recibido", "Received level")} v={`${fmt(i.nivelDbm)} dBm`} fuerte />
          <Fila k={tx("Tensión", "Voltage")} v={textoUv(i.nivelDbm)} />
          <Fila k={tx("Campo", "Field strength")} v={`${fmt(campoInforme(i))} dBµV/m`} />
          <Fila k={tx("Sensibilidad / margen", "Sensitivity / margin")} v={`${fmt(i.sensibilidadDbm)} dBm / ${fmt(i.margenDb)} dB`} />
        </dl>
      </div>
      </div>
    </div>
  );
}

const W = 820;
const H = 230;
const M = { izq: 52, der: 16, arr: 14, aba: 30 };

function ticks(min: number, max: number, n: number) {
  const paso0 = (max - min) / n;
  const p10 = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((k) => k >= paso0) ?? paso0;
  const out: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(Number(v.toFixed(6)));
  return out;
}

export function PerfilEnlace({
  perfil: p,
  titulo,
  frecuenciaMhz,
  informe = false,
  onCerrar,
}: {
  perfil: Perfil | null;
  titulo: string;
  frecuenciaMhz: number;
  /** Abrir con el informe de radioenlace desplegado. */
  informe?: boolean;
  onCerrar: () => void;
}) {
  useIdioma();
  const [verInforme, setVerInforme] = useState(informe);
  if (!p) {
    return (
      <div className="pointer-events-auto absolute right-3 bottom-10 left-3 z-20 rounded-xl bg-white p-4 shadow-lg sm:right-24 ring-1 ring-black/10">
        <p className="text-[14px] text-tenue">{tx("Calculando el perfil…", "Calculating the profile…")}</p>
      </div>
    );
  }
  const d = p.distanciaM;
  const lambda = longitudOnda(frecuenciaMhz);
  const bulto = (x: number) => (x * (d - x)) / (2 * RADIO_EFECTIVO_M);
  const terreno = p.puntos.map((q) => ({ x: q.distanciaM, z: q.terrenoM + bulto(q.distanciaM) }));
  const los = (x: number) => p.alturaInicioM + ((p.alturaFinM - p.alturaInicioM) * x) / d;
  const fresnel = (x: number) => Math.sqrt((lambda * x * (d - x)) / d);
  const zMin = Math.min(...terreno.map((t) => t.z));
  const zMax = Math.max(...terreno.map((t) => t.z), p.alturaInicioM, p.alturaFinM, los(d / 2) + fresnel(d / 2));
  const rango = Math.max(20, zMax - zMin);
  const y0 = zMin - rango * 0.08;
  const y1 = zMax + rango * 0.12;
  const sx = (x: number) => M.izq + (x / d) * (W - M.izq - M.der);
  const sy = (z: number) => M.arr + (1 - (z - y0) / (y1 - y0)) * (H - M.arr - M.aba);
  const base = sy(y0);
  const poligono = `M${sx(0)},${base} ${terreno.map((t) => `L${sx(t.x).toFixed(1)},${sy(t.z).toFixed(1)}`).join(" ")} L${sx(d)},${base} Z`;
  const muestras = Array.from({ length: 81 }, (_, i) => (i / 80) * d);
  const curva = (f: (x: number) => number) => muestras.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(f(x)).toFixed(1)}`).join(" ");
  const clase = CLASES.find((c) => c.id === p.clase)!;
  const xs = ticks(0, d / 1000, 6);
  const ys = ticks(y0, y1, 4);
  const sueloInicio = terreno[0].z;
  const sueloFin = terreno[terreno.length - 1].z;

  return (
    <div
      className="desplazable pointer-events-auto absolute right-3 bottom-10 left-3 z-20 max-h-[calc(100%-9.5rem)] overflow-y-auto rounded-xl bg-white p-3 pb-16 text-carbon shadow-lg ring-1 ring-black/10 sm:right-24 sm:max-h-[calc(100%-6.5rem)] sm:pb-3"
      role="dialog"
      aria-label={tx(`Perfil ${titulo}`, `Profile ${titulo}`)}
      data-tour="perfil"
    >
      <div className="flex flex-wrap items-start gap-x-5 gap-y-1">
        <div className="min-w-[min(100%,18rem)] flex-1">
          <p className="truncate font-cond text-[16px] font-semibold">{titulo}</p>
          <p className="text-[12px] text-tenue">
            {fmt(d / 1000, 2)} km
            {p.informe && tx(` · azimut ${rumboTexto(p.informe.rumboIdaDeg)}`, ` · azimuth ${rumboTexto(p.informe.rumboIdaDeg)}`)}
            {p.informe
              ? tx(
                  ` · nivel ${fmt(p.informe.nivelDbm)} dBm (${textoUv(p.informe.nivelDbm)}) · pérdida ${fmt(p.informe.perdidaTotalDb)} dB`,
                  ` · level ${fmt(p.informe.nivelDbm)} dBm (${textoUv(p.informe.nivelDbm)}) · loss ${fmt(p.informe.perdidaTotalDb)} dB`,
                )
              : tx(` · espacio libre ${fmt(p.perdidaEspacioLibreDb, 1)} dB · difracción ${fmt(p.perdidaDifraccionDb, 1)} dB`, ` · free space ${fmt(p.perdidaEspacioLibreDb, 1)} dB · diffraction ${fmt(p.perdidaDifraccionDb, 1)} dB`)} ·{" "}
            {p.lineaVista
              ? tx("línea de vista despejada (60 % de Fresnel)", "clear line of sight (60% of Fresnel)")
              : p.obstaculoM !== null
                ? tx(`obstáculo principal a ${fmt(p.obstaculoM / 1000, 2)} km`, `main obstacle at ${fmt(p.obstaculoM / 1000, 2)} km`)
                : tx("Fresnel parcialmente obstruida", "Fresnel zone partially obstructed")}
          </p>
        </div>
        <span className="flex items-center gap-2">
          <span className="rounded-md px-2 py-0.5 text-[13px] font-semibold" style={{ background: clase.color, color: p.clase === "media" || p.clase === "estable" ? "#2B2F2E" : "#fff" }}>
            {clase.nombre}
          </span>
          <span className="font-cond text-[22px] leading-none font-semibold tabular-nums">{fmt(p.margenDb, 1)} dB</span>
        </span>
        {p.informe && (
          <button
            type="button"
            onClick={() => setVerInforme((v) => !v)}
            aria-expanded={verInforme}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium ring-1 ${verInforme ? "bg-carbon text-white ring-carbon" : "text-carbon ring-linea hover:bg-papel-2"}`}
          >
            <FileText size={15} /> {tx("Informe", "Report")}
          </button>
        )}
        <button type="button" onClick={onCerrar} className="rounded p-1 text-tenue hover:bg-black/5" aria-label={tx("Cerrar perfil", "Close profile")}>
          <X size={18} />
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img" aria-label={tx("Perfil del terreno con línea de vista y zona de Fresnel", "Terrain profile with line of sight and Fresnel zone")}>
        {ys.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.izq} x2={W - M.der} y1={sy(v)} y2={sy(v)} stroke="#E8E4DC" />
            <text x={M.izq - 6} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="#6F7572">
              {Math.round(v)} m
            </text>
          </g>
        ))}
        {xs.map((v) => (
          <text key={`x${v}`} x={sx(v * 1000)} y={H - 10} textAnchor="middle" fontSize="11" fill="#6F7572">
            {fmt(v, v % 1 ? 1 : 0)} km
          </text>
        ))}
        <path d={curva((x) => los(x) + fresnel(x))} fill="none" stroke="#6E8F78" strokeWidth="1" strokeDasharray="3 3" />
        <path d={curva((x) => los(x) - fresnel(x))} fill="none" stroke="#6E8F78" strokeWidth="1" strokeDasharray="3 3" />
        <path d={curva((x) => los(x) - 0.6 * fresnel(x))} fill="none" stroke="#4F6D59" strokeWidth="1.2" strokeDasharray="6 3" opacity="0.8" />
        <path d={poligono} fill="#B7A98A" fillOpacity="0.55" stroke="#7D6E52" strokeWidth="1.2" />
        <line x1={sx(0)} y1={sy(sueloInicio)} x2={sx(0)} y2={sy(p.alturaInicioM)} stroke="#2B2F2E" strokeWidth="3" />
        <line x1={sx(d)} y1={sy(sueloFin)} x2={sx(d)} y2={sy(p.alturaFinM)} stroke="#2B2F2E" strokeWidth="3" />
        <line x1={sx(0)} y1={sy(p.alturaInicioM)} x2={sx(d)} y2={sy(p.alturaFinM)} stroke={p.lineaVista ? "#1E7B34" : "#D93A2E"} strokeWidth="2" />
        <circle cx={sx(0)} cy={sy(p.alturaInicioM)} r="4" fill="#2B2F2E" />
        <circle cx={sx(d)} cy={sy(p.alturaFinM)} r="4" fill="#2B2F2E" />
        {p.obstaculoM !== null && (
          <g>
            <line x1={sx(p.obstaculoM)} x2={sx(p.obstaculoM)} y1={M.arr} y2={base} stroke="#D93A2E" strokeWidth="1" strokeDasharray="2 3" />
            <text x={sx(p.obstaculoM) + 4} y={M.arr + 10} fontSize="11" fill="#D93A2E">
              {tx("obstáculo principal", "main obstacle")}
            </text>
          </g>
        )}
      </svg>
      <p className="mt-0.5 text-[11px] text-tenue">
        {tx(
          "Relieve con curvatura terrestre (k = 4/3). Línea punteada: primera zona de Fresnel; trazo largo: 60 % de Fresnel, que debe quedar libre para una línea de vista plena.",
          "Terrain with Earth curvature (k = 4/3). Dotted line: first Fresnel zone; long dashes: 60% of the Fresnel zone, which must stay clear for full line of sight.",
        )}
      </p>
      {verInforme && p.informe && <Informe i={p.informe} />}
    </div>
  );
}
