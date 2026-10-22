"use client";

// «Ajústamelo automáticamente» en el resultado: con un clic busca la red factible con la mejor relación
// cobertura–costo (alturas hasta 30 m, lomas cercanas, tipo de antena y antenas de apoyo), muestra las opciones
// con lo que necesita cada una y la deja aplicar o descartar. Si ya es factible, ofrece optimizarla.
import { Check, ChevronDown, Sparkles, Star, Undo2, X } from "lucide-react";
import { useState } from "react";

import { textoCambio, type Ajuste } from "@/lib/radio/ajuste";
import type { Antena, Nivel } from "@/lib/radio/tipos";

import { Boton, fmt } from "./ui";

export type FaseAjuste =
  | { fase: "nada" }
  | { fase: "buscando"; firma: string }
  | { fase: "propuesta"; firma: string; ajuste: Ajuste; elegida: number }
  /** Se ve mientras los nodos sean los que dejó el ajuste. */
  | { fase: "aplicada"; titulo: string; antenas: Antena[] }
  | { fase: "error"; texto: string };

const fp = (v: number) => {
  if (v >= 99.95 && v < 100) return "99,9";
  const t = Math.floor(v * 10) / 10;
  return Number.isInteger(t) ? String(t) : fmt(t, 1);
};

type Props = {
  nivel: Nivel;
  ajuste: FaseAjuste;
  onAjustar: () => void;
  onElegir: (i: number) => void;
  onAplicar: () => void;
  onDescartar: () => void;
  onDeshacer: () => void;
};

export function AjusteAutomatico({ nivel, ajuste, onAjustar, onElegir, onAplicar, onDescartar, onDeshacer }: Props) {
  const factible = nivel === "factible";
  return (
    <div className="mt-3" data-tour="ajuste">
      {(ajuste.fase === "nada" || ajuste.fase === "error" || ajuste.fase === "aplicada") && (
        <div>
          <Boton variante={factible ? "secundario" : "principal"} onClick={onAjustar} tour="boton-ajustar">
            <Sparkles size={16} /> {factible ? "Optimizar la red" : "Ajústamelo automáticamente"}
          </Boton>
          <p className="mt-1.5 text-[12px] leading-snug text-tenue">
            {factible
              ? "Busca la misma cobertura con menos infraestructura: torres más bajas, nodos que sobran."
              : "Busca la red factible con la mejor relación cobertura–costo: alturas hasta 30 m, lomas cercanas, tipo de antena y antenas de apoyo."}
          </p>
        </div>
      )}
      {ajuste.fase === "buscando" && (
        <p className="flex items-center gap-2 text-[13px] text-carbon-2" role="status">
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-salvia border-t-transparent" aria-hidden="true" />
          Analizando alturas, lomas cercanas, tipo de antena y antenas de apoyo con el relieve real… (unos segundos)
        </p>
      )}
      {ajuste.fase === "error" && (
        <p className="mt-2 text-[13px] text-sin" role="alert">
          {ajuste.texto}
        </p>
      )}
      {ajuste.fase === "aplicada" && (
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-[#E3F1E1] px-2.5 py-2 text-[13px] text-carbon-2" role="status">
          <Check size={16} className="shrink-0 text-buena" />
          <span className="min-w-0 flex-1">Se aplicó «{ajuste.titulo}». El resultado de arriba ya es el de la red ajustada.</span>
          <button type="button" onClick={onDeshacer} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[12.5px] font-medium ring-1 ring-linea hover:bg-white">
            <Undo2 size={13} /> Deshacer
          </button>
        </p>
      )}
      {ajuste.fase === "propuesta" && <Propuesta ajuste={ajuste.ajuste} elegida={ajuste.elegida} onElegir={onElegir} onAplicar={onAplicar} onDescartar={onDescartar} />}
    </div>
  );
}

function Propuesta({ ajuste: a, elegida, onElegir, onAplicar, onDescartar }: { ajuste: Ajuste; elegida: number; onElegir: (i: number) => void; onAplicar: () => void; onDescartar: () => void }) {
  const [verAnalisis, setVerAnalisis] = useState(false);
  const o = a.opciones[elegida] ?? a.opciones[a.recomendada];
  const senal = a.margenDb >= 45 ? "señal buena" : a.margenDb >= 37 ? "señal estable o mejor" : "señal media o mejor";
  const zona = a.area.tipo === "objetivo" ? `«${a.area.nombre}»` : "la zona de la red";
  return (
    <div className="space-y-2.5 rounded-lg bg-white p-2.5 ring-1 ring-melki/60" data-tour="propuesta-ajuste" aria-label="Propuesta de ajuste">
      <div>
        <p className="font-cond text-[16px] leading-tight font-semibold">{a.modo === "optimizar" ? "Optimización de la red" : "Propuesta de ajuste"}</p>
        <p className="text-[12px] leading-snug text-tenue">
          Meta: {fp(a.metaPct)} % de {zona} con {senal} (≥ {a.margenDb} dB), todos los nodos llegando al gateway por enlaces de 30 dB o más. Torres de hasta {fmt(a.alturaMaxM, 0)} m.
        </p>
      </div>

      {a.opciones.length > 1 && (
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Opciones">
          {a.opciones.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={i === elegida}
              onClick={() => onElegir(i)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1 transition-colors ${i === elegida ? "bg-carbon text-white ring-carbon" : "bg-white text-carbon ring-linea hover:bg-papel-2"}`}
            >
              {i === a.recomendada && <Star size={12} className={i === elegida ? "fill-white" : "fill-melki text-melki"} aria-label="Recomendada" />}
              {x.titulo}
            </button>
          ))}
        </div>
      )}

      {!o ? (
        <p className="text-[13px] leading-snug text-sin">{a.motivo ?? "No encontré cambios que mejoren la red."}</p>
      ) : (
        <>
          <p className="font-cond text-[15px] leading-tight font-semibold">
            {a.opciones.length === 1 && elegida === a.recomendada && <Star size={13} className="mr-1 inline fill-melki text-melki align-[-1px]" aria-hidden="true" />}
            {o.titulo}
            <span className={`ml-2 rounded px-1.5 py-0.5 align-[1px] font-sans text-[11px] font-semibold ${o.resumen.factible ? "bg-buena/15 text-buena" : "bg-sin/10 text-sin"}`}>{o.resumen.factible ? "Factible" : "No alcanza la meta"}</span>
          </p>
          <dl className="grid grid-cols-3 gap-1.5 text-[12px]">
            <div className="rounded-md bg-papel-2 px-2 py-1.5">
              <dt className="text-tenue">Cobertura útil</dt>
              <dd className="font-cond text-[17px] leading-tight font-semibold tabular-nums">{fp(o.resumen.utilPct)} %</dd>
              <dd className="text-[11px] text-tenue">antes {fp(a.inicial.utilPct)} %</dd>
            </div>
            <div className="rounded-md bg-papel-2 px-2 py-1.5">
              <dt className="text-tenue">Nodos antena</dt>
              <dd className="font-cond text-[17px] leading-tight font-semibold tabular-nums">{o.resumen.nodosAntena}</dd>
              <dd className="text-[11px] text-tenue">antes {a.inicial.nodosAntena}</dd>
            </div>
            <div className="rounded-md bg-papel-2 px-2 py-1.5">
              <dt className="text-tenue">Torre más alta</dt>
              <dd className="font-cond text-[17px] leading-tight font-semibold tabular-nums">{fmt(o.resumen.alturaMaxM, 0)} m</dd>
              <dd className="text-[11px] text-tenue">{fp(o.resumen.confiablePct)} % confiable</dd>
            </div>
          </dl>
          {o.cambios.length > 0 && (
            <div>
              <p className="mb-0.5 text-[12px] font-semibold text-carbon-2">Lo que necesita</p>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto pr-1 text-[12.5px] leading-snug text-carbon-2">
                {o.cambios.map((c, k) => (
                  <li key={k} className="flex gap-1.5">
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-melki" aria-hidden="true" />
                    <span>{textoCambio(c)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[12.5px] leading-snug text-carbon">{o.porQue}</p>
        </>
      )}

      <div>
        <button type="button" onClick={() => setVerAnalisis((v) => !v)} className="flex items-center gap-1 text-[12.5px] font-medium text-carbon-2 hover:text-carbon" aria-expanded={verAnalisis}>
          <ChevronDown size={14} className={`transition-transform ${verAnalisis ? "rotate-180" : ""}`} /> {verAnalisis ? "Ocultar el análisis" : "Ver el análisis"}
        </button>
        {verAnalisis && (
          <ul className="mt-1 space-y-1 text-[12px] leading-snug text-carbon-2">
            {a.analisis.map((t, k) => (
              <li key={k}>{t}</li>
            ))}
          </ul>
        )}
      </div>
      {o && o.cambios.some((c) => c.tipo === "apoyo") && (
        <p className="text-[11.5px] leading-snug text-tenue">Las antenas de apoyo son sugerencias: puntos (con coordenadas) donde conviene poner un nodo. Se ven en el mapa como torres punteadas. Revise en campo el acceso, la energía y la línea de vista.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {o && o.cambios.length > 0 && (
          <Boton variante="principal" onClick={onAplicar} tour="aplicar-ajuste">
            <Check size={16} /> Aplicar y simular
          </Boton>
        )}
        <Boton onClick={onDescartar}>
          <X size={16} /> {o && o.cambios.length ? "Descartar" : "Cerrar"}
        </Boton>
      </div>
    </div>
  );
}
