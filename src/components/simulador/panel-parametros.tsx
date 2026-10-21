"use client";

// Parámetros de radio, del receptor, del área de estudio y del relieve.
import { FolderOpen, RotateCcw, Trash } from "lucide-react";
import { useId, useRef, type Dispatch } from "react";

import { BANDA_LIBRE_MHZ, LIMITE_SALTOS_MAXIMO, PRESETS, presetPorId, RESOLUCIONES, type PresetId, type ResolucionId } from "@/lib/radio/constantes";
import { ENTORNOS, entornoPorId, perdidaEntorno } from "@/lib/radio/entorno";
import type { ClimaItm } from "@/lib/radio/itm";
import { camposVariabilidad, CLIMAS, CONFIABILIDADES, confiabilidadDe, esReferencia, RED_REFERENCIA, SUELOS, VARIABILIDADES, type ConfiabilidadId } from "@/lib/radio/red";
import type { EntornoId, ModeloId, PolarizacionId, SueloId, VariabilidadId } from "@/lib/radio/tipos";

import type { Accion, Estado, TipoRelieve } from "./estado";
import { Boton, CampoNumero, fmt, Segmentado, Titulo } from "./ui";

type Props = {
  estado: Estado;
  despachar: Dispatch<Accion>;
  archivosHgt: string[];
  onCargarHgt: (archivos: File[]) => void;
  onBorrarHgt: () => void;
  avisoHgt: string | null;
};

export function PanelParametros({ estado, despachar, archivosHgt, onCargarHgt, onBorrarHgt, avisoHgt }: Props) {
  const p = estado.escenario.parametros;
  const cambiar = (cambios: Partial<typeof p>) => despachar({ tipo: "parametros", cambios });
  const preset = presetPorId(p.preset);
  const fueraBanda = p.frecuenciaMhz < BANDA_LIBRE_MHZ.min || p.frecuenciaMhz > BANDA_LIBRE_MHZ.max;
  const idPreset = useId();
  const idEntorno = useId();
  const idClima = useId();
  const idSuelo = useId();
  const idVariabilidad = useId();
  const archivo = useRef<HTMLInputElement>(null);
  const confiabilidad = confiabilidadDe(p);
  const comoRadioMobile = esReferencia(p);
  const usa = camposVariabilidad(p.variabilidad);
  const entorno = entornoPorId(p.entorno);
  const perdidaRx = perdidaEntorno(p.entorno, p.alturaRxM, p.frecuenciaMhz);

  return (
    <div className="space-y-5">
      <section data-tour="radio">
        <Titulo>Radio LoRa</Titulo>
        <label htmlFor={idPreset} className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">Preset de Meshtastic</span>
          <select id={idPreset} className="campo" value={p.preset} onChange={(e) => cambiar({ preset: e.target.value as PresetId })}>
            {PRESETS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre} · SF{x.sf} / {x.anchoBandaKhz} kHz
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[12px] text-tenue">
            Sensibilidad {fmt(preset.sensibilidadDbm)} dBm · ≈ {fmt(preset.velocidadKbps, 2)} kbps. Todos los nodos de la red deben usar el mismo preset.
          </span>
        </label>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <CampoNumero etiqueta="Frecuencia" unidad="MHz" valor={p.frecuenciaMhz} min={860} max={960} paso={0.125} onCambio={(v) => cambiar({ frecuenciaMhz: v })} />
          <CampoNumero
            etiqueta="Límite de saltos"
            valor={p.limiteSaltos}
            min={1}
            max={LIMITE_SALTOS_MAXIMO}
            onCambio={(v) => cambiar({ limiteSaltos: Math.round(v) })}
            tour="saltos"
          />
        </div>
        {fueraBanda && (
          <p className="mt-2 rounded-md bg-baja/15 px-2.5 py-1.5 text-[12px] leading-snug text-carbon">
            Fuera de la banda de uso libre 915–928 MHz (ANE, Resolución 000028 de 2026).
          </p>
        )}
      </section>

      <section data-tour="receptor">
        <Titulo>Receptor en campo</Titulo>
        <div className="grid grid-cols-3 gap-2">
          <CampoNumero etiqueta="Altura" unidad="m" valor={p.alturaRxM} min={0.5} max={100} paso={0.5} onCambio={(v) => cambiar({ alturaRxM: v })} />
          <CampoNumero etiqueta="Ganancia" unidad="dBi" valor={p.gananciaRxDbi} min={-5} max={15} paso={0.5} onCambio={(v) => cambiar({ gananciaRxDbi: v })} />
          <CampoNumero etiqueta="Pérdida extra" unidad="dB" valor={p.perdidaExtraDb} min={0} max={40} paso={1} onCambio={(v) => cambiar({ perdidaExtraDb: v })} />
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-tenue">Radio portátil a 1,5–2,5 m. La pérdida extra representa el cuerpo, la cabina de un vehículo u otras pérdidas fijas.</p>
        <label htmlFor={idEntorno} className="mt-2.5 block" data-tour="entorno">
          <span className="mb-1 block text-[13px] text-carbon-2">Entorno de la zona</span>
          <select id={idEntorno} className="campo" value={p.entorno} onChange={(e) => cambiar({ entorno: e.target.value as EntornoId })}>
            {ENTORNOS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[12px] leading-snug text-tenue">
            {entorno.metodo === "ninguno"
              ? entorno.descripcion
              : `${entorno.descripcion} Pérdida ≈ ${fmt(perdidaRx)} dB para el receptor a ${fmt(p.alturaRxM)} m; se aplica también a los nodos y antenas por debajo de ${fmt(entorno.alturaM, 0)} m.`}
          </span>
        </label>
      </section>

      <section data-tour="propagacion">
        <Titulo>Propagación</Titulo>
        <div>
          <span className="mb-1 block text-[13px] text-carbon-2">Modelo</span>
          <Segmentado<ModeloId>
            etiqueta="Modelo de propagación"
            valor={p.modelo}
            onCambio={(v) => cambiar({ modelo: v })}
            opciones={[
              { valor: "calibrado", texto: "Calibrado", titulo: "Ajustado a las simulaciones de Radio Mobile (recomendado)" },
              { valor: "itm", texto: "Longley-Rice", titulo: "Longley-Rice (ITM) puro, el modelo de Radio Mobile" },
            ]}
          />
          <span className="mt-1 block text-[12px] leading-snug text-tenue">
            {p.modelo === "calibrado"
              ? "Recomendado: ajustado a las pruebas de Radio Mobile (se desvía ≈ 3 dB en los enlaces y ≈ 5 dB en el mapa). Si cambia los parámetros de red, se corrige con Longley-Rice."
              : "Longley-Rice (ITM 1.2.2) con el perfil completo de cada trayecto, como Radio Mobile. Tarda un poco más."}
          </span>
        </div>
        <div className="mt-2.5">
          <span className="mb-1 block text-[13px] text-carbon-2">Confiabilidad</span>
          <Segmentado<ConfiabilidadId>
            etiqueta="Confiabilidad de la señal"
            valor={confiabilidad}
            onCambio={(v) => {
              const c = CONFIABILIDADES.find((x) => x.id === v);
              if (c) cambiar({ tiempoPct: c.tiempoPct, ubicacionesPct: c.ubicacionesPct, situacionesPct: c.situacionesPct });
            }}
            opciones={[
              ...CONFIABILIDADES.map((c) => ({ valor: c.id as ConfiabilidadId, texto: c.nombre, titulo: c.descripcion })),
              ...(confiabilidad === "personalizada" ? [{ valor: "personalizada" as ConfiabilidadId, texto: "Propia" }] : []),
            ]}
          />
          <span className="mt-1 block text-[12px] leading-snug text-tenue">
            {confiabilidad === "personalizada"
              ? `Porcentajes propios: ${fmt(p.tiempoPct, 0)} % del tiempo, ${fmt(p.situacionesPct, 0)} % de las situaciones.`
              : CONFIABILIDADES.find((c) => c.id === confiabilidad)?.descripcion}
          </span>
        </div>
        <details className="mt-2.5 rounded-lg bg-white ring-1 ring-linea" data-tour="red-avanzada">
          <summary className="cursor-pointer px-3 py-2 text-[13.5px] font-medium">
            Parámetros como en Radio Mobile
            <span className={`ml-2 rounded px-1.5 py-px text-[11px] font-medium ${comoRadioMobile ? "bg-salvia-clara text-salvia-oscura" : "bg-baja/20 text-carbon"}`}>
              {comoRadioMobile ? "de referencia" : "modificados"}
            </span>
          </summary>
          <div className="space-y-2.5 border-t border-linea px-3 pt-2.5 pb-3">
            <label htmlFor={idClima} className="block">
              <span className="mb-1 block text-[13px] text-carbon-2">Clima de radio</span>
              <select
                id={idClima}
                className="campo"
                value={p.clima}
                onChange={(e) => {
                  const c = CLIMAS.find((x) => x.id === Number(e.target.value));
                  if (c) cambiar({ clima: c.id as ClimaItm, refractividad: c.refractividad });
                }}
              >
                {CLIMAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[12px] text-tenue">Colombia: ecuatorial. Al cambiarlo se propone su refractividad típica.</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-[13px] text-carbon-2">Polarización</span>
                <Segmentado<PolarizacionId>
                  etiqueta="Polarización"
                  valor={p.polarizacion}
                  onCambio={(v) => cambiar({ polarizacion: v })}
                  opciones={[
                    { valor: "vertical", texto: "Vertical" },
                    { valor: "horizontal", texto: "Horizontal" },
                  ]}
                />
              </div>
              <CampoNumero etiqueta="Refractividad" unidad="N" valor={p.refractividad} min={250} max={400} paso={1} onCambio={(v) => cambiar({ refractividad: v })} />
            </div>
            <label htmlFor={idSuelo} className="block">
              <span className="mb-1 block text-[13px] text-carbon-2">Suelo</span>
              <select
                id={idSuelo}
                className="campo"
                value={p.suelo}
                onChange={(e) => {
                  const v = e.target.value as SueloId;
                  const x = SUELOS.find((q) => q.id === v);
                  cambiar(x ? { suelo: v, permitividad: x.permitividad, conductividad: x.conductividad } : { suelo: v });
                }}
              >
                {SUELOS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre} (εr {x.permitividad}, σ {String(x.conductividad).replace(".", ",")} S/m)
                  </option>
                ))}
                <option value="personalizado">Personalizado</option>
              </select>
            </label>
            {p.suelo === "personalizado" && (
              <div className="grid grid-cols-2 gap-2">
                <CampoNumero etiqueta="Permitividad εr" valor={p.permitividad} min={1} max={100} paso={1} onCambio={(v) => cambiar({ permitividad: v })} />
                <CampoNumero etiqueta="Conductividad" unidad="S/m" valor={p.conductividad} min={0.0001} max={10} paso={0.001} onCambio={(v) => cambiar({ conductividad: v })} />
              </div>
            )}
            <label htmlFor={idVariabilidad} className="block">
              <span className="mb-1 block text-[13px] text-carbon-2">Modo estadístico</span>
              <select id={idVariabilidad} className="campo" value={p.variabilidad} onChange={(e) => cambiar({ variabilidad: e.target.value as VariabilidadId })}>
                {VARIABILIDADES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[12px] leading-snug text-tenue">{VARIABILIDADES.find((x) => x.id === p.variabilidad)?.descripcion}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {usa.tiempo && <CampoNumero etiqueta="% tiempo" unidad="%" valor={p.tiempoPct} min={1} max={99} paso={1} onCambio={(v) => cambiar({ tiempoPct: v })} />}
              {usa.ubicaciones && <CampoNumero etiqueta="% ubicaciones" unidad="%" valor={p.ubicacionesPct} min={1} max={99} paso={1} onCambio={(v) => cambiar({ ubicacionesPct: v })} />}
              <CampoNumero etiqueta="% situaciones" unidad="%" valor={p.situacionesPct} min={1} max={99} paso={1} onCambio={(v) => cambiar({ situacionesPct: v })} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] leading-snug text-tenue">Referencia: ecuatorial, vertical, suelo promedio, N = 360, móvil 50 % / 70 %.</p>
              <Boton
                variante="fantasma"
                deshabilitado={comoRadioMobile}
                onClick={() => cambiar({ ...RED_REFERENCIA })}
              >
                <RotateCcw size={15} /> Restablecer
              </Boton>
            </div>
          </div>
        </details>
      </section>

      <section data-tour="area">
        <Titulo>Área de estudio</Titulo>
        <CampoNumero etiqueta="Radio alrededor de cada antena" unidad="km" valor={p.radioKm} min={1} max={40} paso={1} onCambio={(v) => cambiar({ radioKm: v })} />
        <div className="mt-2.5">
          <span className="mb-1 block text-[13px] text-carbon-2">Resolución del cálculo</span>
          <Segmentado<ResolucionId>
            etiqueta="Resolución del cálculo"
            valor={p.resolucion}
            onCambio={(v) => cambiar({ resolucion: v })}
            opciones={(Object.keys(RESOLUCIONES) as ResolucionId[]).map((k) => ({
              valor: k,
              texto: RESOLUCIONES[k].nombre,
              titulo: `Celdas de ≈ ${Math.round((p.radioKm * 1000) / RESOLUCIONES[k].celdasPorRadio)} m`,
            }))}
          />
          <span className="mt-1 block text-[12px] text-tenue">Celdas de ≈ {Math.round((p.radioKm * 1000) / RESOLUCIONES[p.resolucion].celdasPorRadio)} m sobre el terreno.</span>
        </div>
      </section>

      <section data-tour="relieve">
        <Titulo>Relieve</Titulo>
        <Segmentado<TipoRelieve>
          etiqueta="Fuente del relieve"
          valor={estado.relieve}
          onCambio={(v) => {
            if (v === "hgt" && archivosHgt.length === 0) archivo.current?.click();
            else despachar({ tipo: "relieve", relieve: v });
          }}
          opciones={[
            { valor: "teselas", texto: "En línea" },
            { valor: "hgt", texto: "Archivos SRTM" },
            { valor: "plano", texto: "Plano" },
          ]}
        />
        <p className="mt-1.5 text-[12px] leading-snug text-tenue">
          {estado.relieve === "teselas" && "Elevación SRTM abierta (≈ 38 m por píxel). Se descarga solo la zona simulada."}
          {estado.relieve === "hgt" && "Archivos .hgt de su equipo (los mismos de Radio Mobile). No se descarga nada."}
          {estado.relieve === "plano" && "Sin relieve: útil para comparar o trabajar sin conexión."}
        </p>
        <input
          ref={archivo}
          type="file"
          accept=".hgt,.HGT"
          multiple
          className="sr-only"
          aria-label="Cargar archivos de relieve .hgt"
          onChange={(e) => {
            const lista = [...(e.target.files ?? [])];
            if (lista.length) onCargarHgt(lista);
            e.target.value = "";
          }}
        />
        {(estado.relieve === "hgt" || archivosHgt.length > 0) && (
          <div className="mt-2 rounded-lg bg-white p-2.5 ring-1 ring-linea">
            {archivosHgt.length ? (
              <p className="text-[13px]">
                Cargados: <span className="tabular-nums">{archivosHgt.join(", ")}</span>
              </p>
            ) : (
              <p className="text-[13px] text-tenue">Ningún archivo cargado.</p>
            )}
            {avisoHgt && <p className="mt-1 text-[12px] text-sin">{avisoHgt}</p>}
            <div className="mt-2 flex gap-2">
              <Boton onClick={() => archivo.current?.click()}>
                <FolderOpen size={16} /> Cargar .hgt
              </Boton>
              {archivosHgt.length > 0 && (
                <Boton variante="fantasma" onClick={onBorrarHgt}>
                  <Trash size={16} /> Quitar
                </Boton>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
