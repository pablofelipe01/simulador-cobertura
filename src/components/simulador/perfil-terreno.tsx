"use client";

// Perfil del terreno de una medición (sin cálculo de radio): alturas, puntos de quiebre, subida y bajada.
import { X } from "lucide-react";

import { formatoDistancia } from "@/lib/radio/geo";
import type { PerfilTerreno } from "@/lib/radio/tipos";

import { fmt } from "./ui";

const W = 820;
const H = 210;
const M = { izq: 52, der: 14, arr: 12, aba: 28 };

function ticks(min: number, max: number, n: number) {
  const paso0 = (max - min) / n || 1;
  const p10 = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((k) => k >= paso0) ?? paso0;
  const out: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(Number(v.toFixed(6)));
  return out;
}

export function PerfilTerrenoPanel({ perfil: p, titulo, onCerrar }: { perfil: PerfilTerreno | null; titulo: string; onCerrar: () => void }) {
  if (!p) {
    return (
      <div className="pointer-events-auto absolute right-3 bottom-10 left-3 z-20 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/10 sm:right-24">
        <p className="text-[14px] text-tenue">Calculando el perfil del terreno…</p>
      </div>
    );
  }
  const d = Math.max(p.distanciaM, 1);
  const rango = Math.max(10, p.maximoM - p.minimoM);
  const y0 = p.minimoM - rango * 0.1;
  const y1 = p.maximoM + rango * 0.15;
  const sx = (x: number) => M.izq + (x / d) * (W - M.izq - M.der);
  const sy = (z: number) => M.arr + (1 - (z - y0) / (y1 - y0)) * (H - M.arr - M.aba);
  const base = sy(y0);
  const linea = p.puntos.map((q, i) => `${i ? "L" : "M"}${sx(q.distanciaM).toFixed(1)},${sy(q.terrenoM).toFixed(1)}`).join(" ");
  const relleno = `${linea} L${sx(d)},${base} L${sx(0)},${base} Z`;
  const xs = ticks(0, d / 1000, 6);
  const ys = ticks(y0, y1, 4);
  const pendiente = p.puntos.length > 1 ? Math.max(...p.puntos.slice(1).map((q, i) => Math.abs(q.terrenoM - p.puntos[i].terrenoM) / Math.max(1, q.distanciaM - p.puntos[i].distanciaM))) : 0;
  return (
    <div className="pointer-events-auto absolute right-3 bottom-10 left-3 z-20 rounded-xl bg-white p-3 text-carbon shadow-lg ring-1 ring-black/10 sm:right-24" role="dialog" aria-label={`Perfil del terreno ${titulo}`}>
      <div className="flex flex-wrap items-start gap-x-5 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="truncate font-cond text-[16px] font-semibold">Perfil del terreno · {titulo}</p>
          <p className="text-[12px] text-tenue">
            {formatoDistancia(p.distanciaM)} · altura {Math.round(p.minimoM)}–{Math.round(p.maximoM)} m s. n. m. · sube {Math.round(p.subidaM)} m · baja {Math.round(p.bajadaM)} m · pendiente máx. ≈ {fmt(pendiente * 100, 0)} %
            {p.fuente === "plano" ? " · sin datos de relieve (terreno plano)" : ""}
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="rounded p-1 text-tenue hover:bg-black/5" aria-label="Cerrar perfil del terreno">
          <X size={18} />
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img" aria-label="Perfil del terreno">
        {ys.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.izq} x2={W - M.der} y1={sy(v)} y2={sy(v)} stroke="#E8E4DC" />
            <text x={M.izq - 6} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="#6F7572">
              {Math.round(v)} m
            </text>
          </g>
        ))}
        {xs.map((v) => (
          <text key={`x${v}`} x={sx(v * 1000)} y={H - 9} textAnchor="middle" fontSize="11" fill="#6F7572">
            {fmt(v, v % 1 ? 1 : 0)} km
          </text>
        ))}
        <path d={relleno} fill="#B7A98A" fillOpacity="0.5" />
        <path d={linea} fill="none" stroke="#7D6E52" strokeWidth="1.4" />
        {p.vertices.slice(1, -1).map((x, i) => (
          <line key={i} x1={sx(x)} x2={sx(x)} y1={M.arr} y2={base} stroke="#1FC8F0" strokeDasharray="3 3" />
        ))}
      </svg>
    </div>
  );
}
