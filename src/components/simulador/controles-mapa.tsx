// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Controles sobre el mapa: herramienta (incluida la regla), tipo de nodo, modo de color, capas, leyenda e inspector de puntos.
import { Crosshair, Flag, Hand, Layers, MapPin, Ruler, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch } from "react";

import { CLASES, ENLACES, presetPorId } from "@/lib/radio/constantes";
import { aGMS } from "@/lib/radio/geo";
import type { Inspeccion } from "@/lib/radio/simulacion";
import type { Antena, ResultadoSimulacion, TipoNodo } from "@/lib/radio/tipos";
import { aDbm, decimalesUnidad, desdeDbm, textoNivel, UNIDADES, type Receptor, type UnidadId } from "@/lib/radio/unidades";

import { ARCOIRIS, COLOR_BAJO_ESCALA, COLORES_ANTENA, COLORES_REDUNDANCIA, COLORES_UMBRAL } from "./capa-cobertura";
import type { Accion, EscalaSenal, Estado, FondoMapa, Herramienta, ModoMapa } from "./estado";
import { IconoPieza, IconoTorre } from "./icono-torre";
import { NOMBRE_PIEZA, PIEZAS, type Pieza } from "./piezas";
import { CampoNumero, fmt, Interruptor, Segmentado } from "./ui";

const SUBTITULO_UNIDAD: Record<UnidadId, string> = {
  margen: "Margen sobre la sensibilidad del receptor",
  dbm: "Potencia que llega al receptor",
  uv: "Tensión en la entrada del receptor (50 Ω)",
  dbuvm: "Intensidad de campo eléctrico",
};

/** Campo numérico para un nivel guardado en dBm que se muestra y edita en la unidad elegida. */
function CampoNivel({ etiqueta, dbm, unidad, rx, onCambio }: { etiqueta: string; dbm: number; unidad: UnidadId; rx: Receptor; onCambio: (dbm: number) => void }) {
  const v = desdeDbm(dbm, unidad, rx);
  const d = decimalesUnidad(v, unidad, 0);
  const u = UNIDADES.find((x) => x.id === unidad)!;
  return (
    <CampoNumero
      etiqueta={etiqueta}
      unidad={u.corto}
      valor={Number(v.toFixed(d))}
      min={unidad === "uv" ? 0.001 : -200}
      max={unidad === "uv" ? 1e7 : 250}
      paso={unidad === "uv" ? Math.max(0.01, 10 ** Math.floor(Math.log10(Math.max(v, 0.001)))) : 1}
      onCambio={(x) => onCambio(aDbm(x, unidad, rx))}
    />
  );
}

/** Unidad y escala de colores del mapa de señal (como en Radio Mobile: clases, arcoíris o un umbral). */
function EscalaSenalCampos({ estado, despachar }: { estado: Estado; despachar: Dispatch<Accion> }) {
  const v = estado.vista;
  const p = estado.escenario.parametros;
  const rx: Receptor = { sensibilidadDbm: presetPorId(p.preset).sensibilidadDbm, gananciaRxDbi: p.gananciaRxDbi, frecuenciaMhz: p.frecuenciaMhz };
  const cambiar = (cambios: Partial<typeof v>) => despachar({ tipo: "vista", cambios });
  return (
    <div className="space-y-2" data-tour="escala">
      <label className="block">
        <span className="mb-1 block text-[13px] text-carbon-2">Unidad de la señal</span>
        <select className="campo" value={v.unidad} onChange={(e) => cambiar({ unidad: e.target.value as UnidadId })}>
          {UNIDADES.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="mb-1 block text-[13px] text-carbon-2">Colores</span>
        <Segmentado<EscalaSenal>
          etiqueta="Escala de colores de la señal"
          valor={v.escala}
          onCambio={(x) => cambiar({ escala: x, ...(x !== "clases" && v.modo !== "senal" ? { modo: "senal" as const } : {}) })}
          opciones={[
            { valor: "clases", texto: "Clases", titulo: "Cinco clases de señal, como en las pruebas de Radio Mobile" },
            { valor: "arcoiris", texto: "Arcoíris", titulo: "Degradado entre un nivel mínimo y uno máximo" },
            { valor: "umbral", texto: "Umbral", titulo: "Un solo color donde la señal supera el umbral" },
          ]}
        />
      </div>
      {v.escala === "arcoiris" && (
        <div className="grid grid-cols-2 gap-2">
          <CampoNivel etiqueta="Mínimo" dbm={v.escalaMinDbm} unidad={v.unidad} rx={rx} onCambio={(x) => cambiar({ escalaMinDbm: x, ...(x >= v.escalaMaxDbm ? { escalaMaxDbm: x + 10 } : {}) })} />
          <CampoNivel etiqueta="Máximo" dbm={v.escalaMaxDbm} unidad={v.unidad} rx={rx} onCambio={(x) => cambiar({ escalaMaxDbm: x, ...(x <= v.escalaMinDbm ? { escalaMinDbm: x - 10 } : {}) })} />
        </div>
      )}
      {v.escala === "umbral" && (
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <CampoNivel etiqueta="Umbral" dbm={v.umbralDbm} unidad={v.unidad} rx={rx} onCambio={(x) => cambiar({ umbralDbm: x })} />
          <div role="radiogroup" aria-label="Color del umbral" className="flex gap-1 pb-1.5">
            {COLORES_UMBRAL.map((c) => (
              <button
                key={c.color}
                type="button"
                role="radio"
                aria-checked={v.colorUmbral === c.color}
                aria-label={c.nombre}
                title={c.nombre}
                onClick={() => cambiar({ colorUmbral: c.color })}
                className={`h-6 w-6 rounded-full ring-offset-1 ${v.colorUmbral === c.color ? "ring-2 ring-carbon" : "ring-1 ring-black/15"}`}
                style={{ background: c.color }}
              />
            ))}
          </div>
        </div>
      )}
      <p className="text-[12px] leading-snug text-tenue">
        {v.escala === "clases"
          ? `Clases por margen: servicio desde 20 dB (${textoNivel(20 + rx.sensibilidadDbm, v.unidad, rx, 0)}).`
          : v.escala === "arcoiris"
            ? "Violeta = señal débil, rojo = señal fuerte. Por debajo del mínimo se marca en gris."
            : "Solo se pinta donde la señal llega al umbral; el resto queda como sin servicio."}
      </p>
    </div>
  );
}

/** En pantallas angostas las herramientas muestran solo el ícono (el nombre sigue disponible para lectores de pantalla). */
const corto = "sr-only sm:not-sr-only";

export function BarraMapa({ estado, despachar }: { estado: Estado; despachar: Dispatch<Accion> }) {
  const sembrar = estado.modo === "sembrar";
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-[25] flex max-w-[calc(100%-70px)] flex-wrap gap-2">
      <div className="pointer-events-auto" data-tour="herramientas">
        <Segmentado<Herramienta>
          claro
          etiqueta="Herramienta del mapa"
          valor={estado.herramienta}
          onCambio={(v) => despachar({ tipo: "herramienta", herramienta: v })}
          opciones={[
            { valor: "mover", texto: <><Hand size={15} /> <span className={corto}>Mover</span></>, titulo: "Mover el mapa y arrastrar los nodos" },
            sembrar
              ? { valor: "agregar", texto: <><Crosshair size={15} /> <span className={corto}>Poner</span></>, titulo: "Clic en el mapa para poner un gateway, un repetidor o una persona" }
              : { valor: "agregar", texto: <><Crosshair size={15} /> <span className={corto}>Agregar</span></>, titulo: "Clic en el mapa para agregar un nodo" },
            { valor: "inspeccionar", texto: <><MapPin size={15} /> <span className={corto}>Medir señal</span></>, titulo: "Clic en el mapa para ver la señal de cada nodo antena en ese punto" },
            { valor: "regla", texto: <><Ruler size={15} /> <span className={corto}>Regla</span></>, titulo: "Medir distancias, trayectos y áreas, como en Google Earth" },
          ]}
        />
      </div>
      {estado.herramienta === "agregar" && sembrar && (
        <div className="pointer-events-auto" data-tour="pieza-mapa">
          <Segmentado<Pieza>
            claro
            etiqueta="Pieza que se pone"
            valor={estado.pieza}
            onCambio={(v) => despachar({ tipo: "pieza", pieza: v })}
            opciones={PIEZAS.map((p) => ({ valor: p, texto: <><IconoPieza pieza={p} className="h-4 w-4" /> <span className={corto}>{NOMBRE_PIEZA[p]}</span></>, titulo: NOMBRE_PIEZA[p] }))}
          />
        </div>
      )}
      {estado.herramienta === "destino" && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-melki px-3 py-1.5 text-[13px] font-medium text-white shadow-sm" role="status">
          <Flag size={15} /> Toque el punto al que quiere llevar la red
          <button type="button" onClick={() => despachar({ tipo: "herramienta", herramienta: "mover" })} className="-mr-1 rounded p-0.5 hover:bg-white/20" aria-label="Cancelar">
            <X size={15} />
          </button>
        </div>
      )}
      {estado.herramienta === "agregar" && !sembrar && (
        <div className="pointer-events-auto" data-tour="tipo-nuevo">
          <Segmentado<TipoNodo>
            claro
            etiqueta="Tipo de nodo que se agrega"
            valor={estado.tipoNuevo}
            onCambio={(v) => despachar({ tipo: "tipo-nuevo", valor: v })}
            opciones={[
              { valor: "antena", texto: <><IconoTorre className="h-4 w-4" /> Nodo antena</>, titulo: "Infraestructura en mástil: genera cobertura" },
              { valor: "nodo", texto: <><Smartphone size={15} /> Nodo</>, titulo: "Equipo de campo (portátil o en un poste bajo): participa en la malla" },
            ]}
          />
        </div>
      )}
      <div className={`pointer-events-auto ${sembrar ? "hidden" : ""}`} data-tour="modos">
        <Segmentado<ModoMapa>
          claro
          etiqueta="Color de la cobertura"
          valor={estado.vista.modo}
          onCambio={(v) => despachar({ tipo: "vista", cambios: { modo: v } })}
          opciones={[
            { valor: "senal", texto: "Señal", titulo: "Nivel de señal del mejor nodo antena" },
            { valor: "servidor", texto: "Mejor antena", titulo: "Qué nodo antena da la mejor señal en cada punto" },
            { valor: "redundancia", texto: "Respaldo", titulo: "Cuántos nodos antena dan servicio en cada punto" },
          ]}
        />
      </div>
      <MenuCapas estado={estado} despachar={despachar} />
    </div>
  );
}

function MenuCapas({ estado, despachar }: { estado: Estado; despachar: Dispatch<Accion> }) {
  const [abierto, setAbierto] = useState(false);
  // El menú se abre hacia la izquierda si no cabe a la derecha dentro del mapa
  const [aLaDerecha, setALaDerecha] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const v = estado.vista;
  const cambiar = (cambios: Partial<typeof v>) => despachar({ tipo: "vista", cambios });
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, [abierto]);
  const fondos: { valor: FondoMapa; texto: string; detalle?: string }[] = [
    { valor: "satelite", texto: "Satélite" },
    { valor: "topografico", texto: "Topográfico", detalle: "Relieve, poblados y vías" },
    { valor: "opentopomap", texto: "OpenTopoMap", detalle: "Curvas de nivel, ríos y quebradas con nombre" },
    { valor: "calles", texto: "Calles (OpenStreetMap)" },
  ];
  const titulo = (t: string) => <p className="mb-0.5 font-cond text-[14px] font-semibold">{t}</p>;
  return (
    <div ref={caja} className="pointer-events-auto relative" data-tour="capas">
      <button
        type="button"
        onClick={() => {
          const r = caja.current?.getBoundingClientRect();
          const zona = caja.current?.closest("main")?.getBoundingClientRect();
          if (r && zona) setALaDerecha(r.left + 308 > zona.right && r.right - 308 >= zona.left);
          setAbierto((x) => !x);
        }}
        aria-expanded={abierto}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium shadow-sm ring-1 ring-black/10 ${abierto ? "bg-carbon text-white" : "bg-white/90 text-carbon hover:bg-white"}`}
      >
        <Layers size={15} /> Capas
      </button>
      {abierto && (
        <div className={`desplazable absolute top-full ${aLaDerecha ? "right-0" : "left-0"} mt-2 max-h-[calc(100dvh-170px)] w-[min(300px,calc(100vw-24px))] space-y-3 overflow-y-auto rounded-xl bg-white p-3.5 text-carbon shadow-lg ring-1 ring-black/10`}>
          <fieldset>
            <legend className="mb-1 font-cond text-[14px] font-semibold">Mapa base</legend>
            {fondos.map((f) => (
              <label key={f.valor} className="flex cursor-pointer items-start gap-2 py-0.5 text-[14px]">
                <input type="radio" name="fondo" className="mt-1 accent-salvia" checked={v.fondo === f.valor} onChange={() => cambiar({ fondo: f.valor })} />
                <span>
                  {f.texto}
                  {f.detalle && <span className="block text-[12px] leading-tight text-tenue">{f.detalle}</span>}
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            {titulo("Referencia")}
            <Interruptor etiqueta="Departamentos y municipios" detalle="Límites y nombres (DANE)" activo={v.refDivision} onCambio={(x) => cambiar({ refDivision: x })} />
            <Interruptor etiqueta="Ríos y lagos principales" activo={v.refRios} onCambio={(x) => cambiar({ refRios: x })} />
            <Interruptor etiqueta="Países" activo={v.refPaises} onCambio={(x) => cambiar({ refPaises: x })} />
            <Interruptor etiqueta="Poblados y lugares" detalle="Nombres de Esri sobre el mapa" activo={v.refNombres} onCambio={(x) => cambiar({ refNombres: x })} />
            <Interruptor etiqueta="Vías" activo={v.refVias} onCambio={(x) => cambiar({ refVias: x })} />
          </div>
          <div>
            {titulo("Simulación")}
            <label className="block py-1">
              <span className="mb-1 flex justify-between text-[14px]">
                Opacidad de la cobertura <span className="text-tenue tabular-nums">{Math.round(v.opacidad * 100)} %</span>
              </span>
              <input type="range" min={0.1} max={1} step={0.05} value={v.opacidad} onChange={(e) => cambiar({ opacidad: Number(e.target.value) })} className="w-full accent-salvia" />
            </label>
            <Interruptor etiqueta="Rango de alcance" detalle="Contorno con servicio y confiable de cada nodo antena" activo={v.mostrarAlcance} onCambio={(x) => cambiar({ mostrarAlcance: x })} />
            <Interruptor etiqueta="Anillos de distancia" detalle="Alrededor del nodo seleccionado" activo={v.mostrarAnillos} onCambio={(x) => cambiar({ mostrarAnillos: x })} />
            <Interruptor etiqueta="Solo el nodo seleccionado" detalle="Pinta únicamente su cobertura y alcance" activo={v.soloSeleccionada} onCambio={(x) => cambiar({ soloSeleccionada: x })} />
            <Interruptor etiqueta="Zonas sin servicio" activo={v.mostrarSinServicio} onCambio={(x) => cambiar({ mostrarSinServicio: x })} />
            <Interruptor etiqueta="Enlaces de la malla" activo={v.mostrarEnlaces} onCambio={(x) => cambiar({ mostrarEnlaces: x })} />
            <Interruptor etiqueta="Parejas sin enlace" activo={v.mostrarSinEnlace} onCambio={(x) => cambiar({ mostrarSinEnlace: x })} />
            <Interruptor etiqueta="Círculo de estudio" activo={v.mostrarCirculos} onCambio={(x) => cambiar({ mostrarCirculos: x })} />
            <Interruptor etiqueta="Dirección de las antenas" detalle="Haz de las antenas direccionales" activo={v.mostrarHaces} onCambio={(x) => cambiar({ mostrarHaces: x })} />
            <Interruptor etiqueta="Relieve 3D" detalle="Incline el mapa con Ctrl + arrastrar" activo={v.relieve3d} onCambio={(x) => cambiar({ relieve3d: x })} />
          </div>
          <div>
            {titulo("Escala de la señal")}
            <EscalaSenalCampos estado={estado} despachar={despachar} />
          </div>
        </div>
      )}
    </div>
  );
}

export function Leyenda({ estado, resultado, antenas }: { estado: Estado; resultado: ResultadoSimulacion | null; antenas: Antena[] }) {
  // En pantallas pequeñas la leyenda empieza plegada para no tapar el mapa
  const [abierta, setAbierta] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches);
  if (!resultado) return null;
  const modo = estado.vista.modo;
  const v = estado.vista;
  const rx: Receptor = { sensibilidadDbm: resultado.sensibilidadDbm ?? -131, gananciaRxDbi: resultado.gananciaRxDbi ?? 2, frecuenciaMhz: resultado.frecuenciaMhz ?? 915 };
  const nivel = (margen: number) => textoNivel(margen + rx.sensibilidadDbm, v.unidad, rx, 0);
  const nivelDbm = (dbm: number) => textoNivel(dbm, v.unidad, rx, 0);
  const escala = modo === "senal" ? v.escala : "clases";
  const filas =
    modo === "senal"
      ? escala === "umbral"
        ? [
            { color: v.colorUmbral, texto: "Con señal", rango: `≥ ${nivelDbm(v.umbralDbm)}` },
            { color: CLASES[4].color, texto: "Por debajo", rango: `< ${nivelDbm(v.umbralDbm)}` },
          ]
        : escala === "arcoiris"
          ? []
          : CLASES.map((c) => ({ color: c.color, texto: c.nombre, rango: c.id === "sin" ? `< ${nivel(20)}` : `≥ ${nivel(c.minimoDb)}` }))
      : modo === "servidor"
        ? resultado.antenas.map((a, i) => ({ color: COLORES_ANTENA[i % COLORES_ANTENA.length], texto: antenas.find((x) => x.id === a.id)?.nombre ?? a.nombre, rango: "" }))
        : COLORES_REDUNDANCIA.map((c) => ({ color: c.color, texto: c.nombre, rango: "" }));
  const titulo = modo === "senal" ? "Nivel de señal" : modo === "servidor" ? "Nodo antena con mejor señal" : "Nodos antena con servicio";
  if (estado.modo === "sembrar") return <LeyendaSembrar abierta={abierta} onAbrir={setAbierta} filas={escala === "clases" ? filas : CLASES.map((c) => ({ color: c.color, texto: c.nombre, rango: "" }))} />;
  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="pointer-events-auto absolute bottom-10 left-3 z-10 flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-[13px] font-medium text-carbon shadow-md ring-1 ring-black/10"
        data-tour="leyenda"
        aria-expanded={false}
      >
        <span className="flex overflow-hidden rounded-[3px] ring-1 ring-black/10" aria-hidden="true">
          {(escala === "arcoiris" ? ARCOIRIS.map((color) => ({ color, texto: color })) : filas).slice(0, 7).map((f) => (
            <span key={f.texto} className="h-3 w-3" style={{ background: f.color }} />
          ))}
        </span>
        Leyenda
      </button>
    );
  }
  return (
    <div className="pointer-events-auto absolute bottom-10 left-3 z-10 w-52 rounded-lg bg-white/95 p-3 text-carbon shadow-md ring-1 ring-black/10" data-tour="leyenda">
      <div className="flex items-start justify-between gap-2">
        <p className="font-cond text-[15px] leading-tight font-semibold">{titulo}</p>
        <button type="button" onClick={() => setAbierta(false)} className="-mt-1 -mr-1 rounded p-1 text-tenue hover:bg-black/5" aria-label="Plegar la leyenda" aria-expanded={true}>
          <X size={14} />
        </button>
      </div>
      {modo === "senal" && <p className="mb-1.5 text-[11px] text-tenue">{SUBTITULO_UNIDAD[v.unidad]}</p>}
      {escala === "arcoiris" && (
        <div className="text-[12px]">
          <div className="h-3.5 rounded-[3px] ring-1 ring-black/10" style={{ background: `linear-gradient(to right, ${ARCOIRIS.join(", ")})` }} />
          <div className="mt-0.5 flex justify-between text-tenue tabular-nums">
            <span>{nivelDbm(v.escalaMinDbm)}</span>
            <span>{nivelDbm((v.escalaMinDbm + v.escalaMaxDbm) / 2)}</span>
            <span>{nivelDbm(v.escalaMaxDbm)}</span>
          </div>
          {v.mostrarSinServicio && (
            <p className="mt-1 flex items-center gap-2">
              <span className="h-3.5 w-5 shrink-0 rounded-[3px] opacity-60 ring-1 ring-black/10" style={{ background: COLOR_BAJO_ESCALA }} />
              Por debajo del mínimo
            </p>
          )}
        </div>
      )}
      <ul className={`space-y-0.5 text-[13px] ${modo === "senal" ? "" : "mt-1.5"}`}>
        {filas.map((f) => (
          <li key={f.texto} className="flex items-center gap-2">
            <span className="h-3.5 w-5 shrink-0 rounded-[3px] ring-1 ring-black/10" style={{ background: f.color }} />
            <span className="min-w-0 flex-1 truncate">{f.texto}</span>
            {f.rango && <span className="text-[12px] text-tenue tabular-nums">{f.rango}</span>}
          </li>
        ))}
      </ul>
      {estado.vista.mostrarAlcance && resultado.antenas.some((x) => x.alcanceKm > 0) && (
        <ul className="mt-2 space-y-0.5 border-t border-linea pt-2 text-[12px]">
          {(
            [
              ["#FFB25B", "Alcance con servicio (≥ 20 dB)"],
              ["#8BD17C", "Alcance confiable (≥ 37 dB)"],
            ] as const
          ).map(([color, texto]) => (
            <li key={texto} className="flex items-center gap-2">
              <svg width="20" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="20" y2="3" stroke="#1B1F1E" strokeWidth="4.5" strokeOpacity="0.5" />
                <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2.4" />
              </svg>
              {texto}
            </li>
          ))}
        </ul>
      )}
      {estado.vista.mostrarEnlaces && resultado.enlaces.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-linea pt-2 text-[12px]">
          {(["solido", "inestable"] as const).map((k) => (
            <li key={k} className="flex items-center gap-2">
              <svg width="20" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="20" y2="3" stroke={ENLACES[k].color} strokeWidth="3" strokeDasharray={k === "inestable" ? "5 3" : undefined} />
              </svg>
              {ENLACES[k].nombre} ({k === "solido" ? "≥ 30 dB" : "20–30 dB"})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Leyenda corta del modo «Sembrar la malla»: qué significa cada color de las piezas y del mapa. */
function LeyendaSembrar({ abierta, onAbrir, filas }: { abierta: boolean; onAbrir: (v: boolean) => void; filas: { color: string; texto: string }[] }) {
  const punto = (color: string) => <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 bg-[#10201d]" style={{ borderColor: color, boxShadow: `0 0 6px ${color}` }} />;
  if (!abierta)
    return (
      <button
        type="button"
        onClick={() => onAbrir(true)}
        className="pointer-events-auto absolute bottom-10 left-3 z-10 flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-[13px] font-medium text-carbon shadow-md ring-1 ring-black/10"
        data-tour="leyenda"
        aria-expanded={false}
      >
        {punto("#3FD68B")}
        {punto("#FF5A4E")}
        {punto("#FF9F43")} Leyenda
      </button>
    );
  return (
    <div className="pointer-events-auto absolute bottom-10 left-3 z-10 w-48 rounded-lg bg-white/95 p-2.5 text-carbon shadow-md ring-1 ring-black/10" data-tour="leyenda">
      <div className="flex items-start justify-between gap-2">
        <p className="font-cond text-[14.5px] leading-tight font-semibold">Cómo leer el mapa</p>
        <button type="button" onClick={() => onAbrir(false)} className="-mt-1 -mr-1 rounded p-1 text-tenue hover:bg-black/5" aria-label="Plegar la leyenda" aria-expanded={true}>
          <X size={14} />
        </button>
      </div>
      <ul className="mt-1.5 space-y-1 text-[12.5px] leading-tight">
        <li className="flex items-center gap-2">{punto("#3EE6C8")} Gateway + Internet con IA</li>
        <li className="flex items-center gap-2">{punto("#3FD68B")} Conectado al gateway</li>
        <li className="flex items-center gap-2">{punto("#FF5A4E")} Sin cobertura (parpadea)</li>
        <li className="flex items-center gap-2">{punto("#FF9F43")} No alcanza la red</li>
        <li className="flex items-center gap-2">
          <svg width="14" height="8" className="shrink-0" aria-hidden="true">
            <line x1="0" y1="4" x2="14" y2="4" stroke="#3EE6C8" strokeWidth="5" strokeOpacity=".35" />
            <line x1="0" y1="4" x2="14" y2="4" stroke="#0F1F1C" strokeWidth="2.2" strokeDasharray="3 2" />
          </svg>
          Flujo hacia el gateway
        </li>
        <li className="flex items-center gap-2">
          <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-carbon px-1 font-cond text-[10.5px] font-bold text-white">2</span> Saltos hasta el gateway
        </li>
      </ul>
      <div className="mt-2 border-t border-linea pt-1.5">
        <p className="text-[11.5px] text-tenue">Señal en el terreno</p>
        <div className="mt-1 flex h-2.5 overflow-hidden rounded-[3px] ring-1 ring-black/10" aria-hidden="true">
          {filas.map((f) => (
            <span key={f.texto} className="flex-1" style={{ background: f.color }} />
          ))}
        </div>
        <div className="mt-0.5 flex justify-between text-[11px] text-tenue">
          <span>Buena</span>
          <span>Sin servicio</span>
        </div>
      </div>
    </div>
  );
}

export function Inspector({
  inspeccion,
  cargando,
  onCerrar,
  onPerfil,
  unidad = "margen",
}: {
  inspeccion: Inspeccion | null;
  cargando: boolean;
  onCerrar: () => void;
  onPerfil: (idAntena: string) => void;
  unidad?: UnidadId;
}) {
  if (!inspeccion && !cargando) return null;
  const rx: Receptor | null = inspeccion && Number.isFinite(inspeccion.sensibilidadDbm) ? inspeccion : null;
  const color = (id: string) => CLASES.find((c) => c.id === id)?.color ?? "#999";
  return (
    <div className="pointer-events-auto absolute top-28 left-3 z-10 w-72 sm:top-16 rounded-xl bg-white/95 p-3 text-carbon shadow-lg ring-1 ring-black/10" role="dialog" aria-label="Señal en el punto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-cond text-[15px] font-semibold">Señal en este punto</p>
          {inspeccion && (
            <p className="text-[12px] text-tenue tabular-nums">
              {aGMS(inspeccion.lat, "lat")} · {aGMS(inspeccion.lon, "lon")} · {Math.round(inspeccion.elevacionM)} m s. n. m.
            </p>
          )}
        </div>
        <button type="button" onClick={onCerrar} className="rounded p-1 text-tenue hover:bg-black/5" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>
      {cargando && !inspeccion ? (
        <p className="mt-2 text-[13px] text-tenue">Calculando…</p>
      ) : inspeccion && inspeccion.margenes.length === 0 ? (
        <p className="mt-2 text-[13px] text-tenue">No hay nodos antena activos.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {inspeccion?.margenes.slice(0, 8).map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[13px]">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: color(m.clase) }} />
              <span className="min-w-0 flex-1 truncate">{m.nombre}</span>
              <span className="text-[12px] text-tenue tabular-nums">{fmt(m.distanciaKm, 2)} km</span>
              <span className="text-right font-medium whitespace-nowrap tabular-nums" title={rx ? `Margen ${fmt(m.margenDb, 1)} dB · ${textoNivel(m.margenDb + rx.sensibilidadDbm, "dbm", rx)}` : undefined}>
                {rx && unidad !== "margen" ? textoNivel(m.margenDb + rx.sensibilidadDbm, unidad, rx, unidad === "dbm" || unidad === "dbuvm" ? 0 : 1) : `${fmt(m.margenDb, 0)} dB`}
              </span>
              <button type="button" className="text-[12px] text-salvia-oscura hover:underline" onClick={() => onPerfil(m.id)} title="Perfil e informe del radioenlace">
                Perfil
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
