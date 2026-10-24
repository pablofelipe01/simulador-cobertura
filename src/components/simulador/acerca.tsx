// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// «Acerca del simulador»: autoría, titularidad, licencia de uso restringido y su fundamento legal en Colombia.
import { Scale, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { AUTOR, CREDITO, DERECHOS, EMPRESA, INGENIERO, NORMAS, PROGRAMA, PROHIBICION, TERCEROS } from "@/lib/autoria";

export function Acerca({ onCerrar }: { onCerrar: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cerrar.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-carbon/45 p-3" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="acerca-titulo"
        data-tour="acerca"
        className="desplazable flex max-h-[min(640px,calc(100dvh-24px))] w-[min(560px,100%)] flex-col overflow-y-auto rounded-2xl bg-white text-carbon shadow-2xl ring-1 ring-black/10"
      >
        <header className="flex items-start gap-3 border-b border-linea px-4 py-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-salvia-clara text-salvia-oscura" aria-hidden="true">
            <Scale size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="acerca-titulo" className="font-cond text-[18px] leading-tight font-semibold">
              Acerca del simulador
            </h2>
            <p className="text-[12.5px] text-tenue">{PROGRAMA}</p>
          </div>
          <button ref={cerrar} type="button" onClick={onCerrar} className="rounded-md p-1.5 text-carbon-2 hover:bg-black/5" aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="space-y-3 px-4 py-3 text-[13.5px] leading-snug">
          <p className="font-medium">{DERECHOS}</p>
          <p>{CREDITO}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-papel px-3 py-2 text-[13px]">
            <dt className="text-tenue">Autor</dt>
            <dd>{AUTOR}</dd>
            <dt className="text-tenue">Para</dt>
            <dd>
              el Ingeniero {INGENIERO} y {EMPRESA}
            </dd>
            <dt className="text-tenue">Titulares</dt>
            <dd>
              el Ingeniero {INGENIERO}, {EMPRESA} y {AUTOR}, titulares de los derechos patrimoniales según el contrato entre las partes. El autor conserva sus derechos morales.
            </dd>
          </dl>
          <p className="rounded-lg border-l-4 border-sin bg-sin/5 px-3 py-2">{PROHIBICION}</p>
          <details className="rounded-lg ring-1 ring-linea">
            <summary className="cursor-pointer px-3 py-2 font-medium">Fundamento legal en Colombia</summary>
            <ul className="space-y-1.5 px-3 pb-3 text-[12.5px]">
              {NORMAS.map((n) => (
                <li key={n.norma}>
                  <span className="font-medium">{n.norma}.</span> {n.que}
                </li>
              ))}
              <li className="text-tenue">Texto vigente en el Gestor Normativo de Función Pública.</li>
            </ul>
          </details>
          <p className="text-[12px] text-tenue">{TERCEROS}</p>
        </div>
      </section>
    </div>
  );
}
