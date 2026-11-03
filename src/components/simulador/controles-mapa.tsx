// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Controles sobre el mapa: herramienta (incluida la regla), tipo de nodo, modo de color, capas, leyenda e inspector de puntos.
import { Crosshair, Flag, Hand, Layers, MapPin, Ruler, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch } from "react";

import { numeroLocal, tx } from "@/lib/idioma";
import { CLASES, ENLACES, presetPorId } from "@/lib/radio/constantes";
import { ESTADOS_USUARIO, ORDEN_ESTADOS_USUARIO, type ResumenUsuarios } from "@/lib/radio/estres";
import { aGMS } from "@/lib/radio/geo";
import type { Inspeccion } from "@/lib/radio/simulacion";
import type { Antena, ResultadoSimulacion, TipoNodo } from "@/lib/radio/tipos";
import { aDbm, decimalesUnidad, desdeDbm, textoNivel, UNIDADES, type Receptor, type UnidadId } from "@/lib/radio/unidades";
import { useIdioma } from "@/lib/use-idioma";

import { ARCOIRIS, COLOR_BAJO_ESCALA, COLORES_ANTENA, COLORES_REDUNDANCIA, COLORES_UMBRAL } from "./capa-cobertura";
import type { Accion, EscalaSenal, Estado, FondoMapa, Herramienta, ModoMapa } from "./estado";
import { IconoPieza, IconoTorre } from "./icono-torre";
import { NOMBRE_PIEZA, PIEZAS, type Pieza } from "./piezas";
import { CampoNumero, fmt, Interruptor, Segmentado } from "./ui";

const SUBTITULO_UNIDAD: Record<UnidadId, string> = {
  get margen() {
    return tx("Margen sobre la sensibilidad del receptor", "Margin over the receiver sensitivity");
  },
  get dbm() {
    return tx("Potencia que llega al receptor", "Power reaching the receiver");
  },
  get uv() {
    return tx("Tensión en la entrada del receptor (50 Ω)", "Voltage at the receiver input (50 Ω)");
  },
  get dbuvm() {
    return tx("Intensidad de campo eléctrico", "Electric field strength");
  },
};

/** Un porcentaje: «65 %» en español, «65%» en inglés. */
const porcentaje = (n: number) => tx(`${n} %`, `${n}%`);

/** «Plegar la leyenda» (el botón que la cierra). */
const plegarLeyenda = () => tx("Plegar la leyenda", "Collapse the legend");

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
  useIdioma();
  const v = estado.vista;
  const p = estado.escenario.parametros;
  const rx: Receptor = { sensibilidadDbm: presetPorId(p.preset).sensibilidadDbm, gananciaRxDbi: p.gananciaRxDbi, frecuenciaMhz: p.frecuenciaMhz };
  const cambiar = (cambios: Partial<typeof v>) => despachar({ tipo: "vista", cambios });
  return (
    <div className="space-y-2" data-tour="escala">
      <label className="block">
        <span className="mb-1 block text-[13px] text-carbon-2">{tx("Unidad de la señal", "Signal unit")}</span>
        <select className="campo" value={v.unidad} onChange={(e) => cambiar({ unidad: e.target.value as UnidadId })}>
          {UNIDADES.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="mb-1 block text-[13px] text-carbon-2">{tx("Colores", "Colors")}</span>
        <Segmentado<EscalaSenal>
          etiqueta={tx("Escala de colores de la señal", "Signal color scale")}
          valor={v.escala}
          onCambio={(x) => cambiar({ escala: x, ...(x !== "clases" && v.modo !== "senal" ? { modo: "senal" as const } : {}) })}
          opciones={[
            { valor: "clases", texto: tx("Clases", "Classes"), titulo: tx("Cinco clases de señal, como en las pruebas de Radio Mobile", "Five signal classes, as in the Radio Mobile tests") },
            { valor: "arcoiris", texto: tx("Arcoíris", "Rainbow"), titulo: tx("Degradado entre un nivel mínimo y uno máximo", "Gradient between a minimum and a maximum level") },
            { valor: "umbral", texto: tx("Umbral", "Threshold"), titulo: tx("Un solo color donde la señal supera el umbral", "A single color where the signal exceeds the threshold") },
          ]}
        />
      </div>
      {v.escala === "arcoiris" && (
        <div className="grid grid-cols-2 gap-2">
          <CampoNivel etiqueta={tx("Mínimo", "Minimum")} dbm={v.escalaMinDbm} unidad={v.unidad} rx={rx} onCambio={(x) => cambiar({ escalaMinDbm: x, ...(x >= v.escalaMaxDbm ? { escalaMaxDbm: x + 10 } : {}) })} />
          <CampoNivel etiqueta={tx("Máximo", "Maximum")} dbm={v.escalaMaxDbm} unidad={v.unidad} rx={rx} onCambio={(x) => cambiar({ escalaMaxDbm: x, ...(x <= v.escalaMinDbm ? { escalaMinDbm: x - 10 } : {}) })} />
        </div>
      )}
      {v.escala === "umbral" && (
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <CampoNivel etiqueta={tx("Umbral", "Threshold")} dbm={v.umbralDbm} unidad={v.unidad} rx={rx} onCambio={(x) => cambiar({ umbralDbm: x })} />
          <div role="radiogroup" aria-label={tx("Color del umbral", "Threshold color")} className="flex gap-1 pb-1.5">
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
          ? tx(`Clases por margen: servicio desde 20 dB (${textoNivel(20 + rx.sensibilidadDbm, v.unidad, rx, 0)}).`, `Classes by margin: service from 20 dB (${textoNivel(20 + rx.sensibilidadDbm, v.unidad, rx, 0)}).`)
          : v.escala === "arcoiris"
            ? tx("Violeta = señal débil, rojo = señal fuerte. Por debajo del mínimo se marca en gris.", "Violet = weak signal, red = strong signal. Anything below the minimum is shown in gray.")
            : tx("Solo se pinta donde la señal llega al umbral; el resto queda como sin servicio.", "Only areas where the signal reaches the threshold are painted; the rest is shown as no service.")}
      </p>
    </div>
  );
}

/** En pantallas angostas las herramientas muestran solo el ícono (el nombre sigue disponible para lectores de pantalla). */
const corto = "sr-only sm:not-sr-only";

export function BarraMapa({ estado, despachar }: { estado: Estado; despachar: Dispatch<Accion> }) {
  useIdioma();
  const sembrar = estado.modo === "sembrar";
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-[25] flex max-w-[calc(100%-70px)] flex-wrap gap-2">
      <div className="pointer-events-auto" data-tour="herramientas">
        <Segmentado<Herramienta>
          claro
          etiqueta={tx("Herramienta del mapa", "Map tool")}
          valor={estado.herramienta}
          onCambio={(v) => despachar({ tipo: "herramienta", herramienta: v })}
          opciones={[
            { valor: "mover", texto: <><Hand size={15} /> <span className={corto}>{tx("Mover", "Pan")}</span></>, titulo: tx("Mover el mapa y arrastrar los nodos", "Pan the map and drag the nodes") },
            sembrar
              ? { valor: "agregar", texto: <><Crosshair size={15} /> <span className={corto}>{tx("Poner", "Place")}</span></>, titulo: tx("Clic en el mapa para poner un gateway, un repetidor o una persona", "Click the map to place a gateway, a repeater or a person") }
              : { valor: "agregar", texto: <><Crosshair size={15} /> <span className={corto}>{tx("Agregar", "Add")}</span></>, titulo: tx("Clic en el mapa para agregar un nodo", "Click the map to add a node") },
            { valor: "inspeccionar", texto: <><MapPin size={15} /> <span className={corto}>{tx("Medir señal", "Measure signal")}</span></>, titulo: tx("Clic en el mapa para ver la señal de cada nodo antena en ese punto", "Click the map to see the signal of each antenna node at that point") },
            { valor: "regla", texto: <><Ruler size={15} /> <span className={corto}>{tx("Regla", "Ruler")}</span></>, titulo: tx("Medir distancias, trayectos y áreas, como en Google Earth", "Measure distances, paths and areas, as in Google Earth") },
          ]}
        />
      </div>
      {estado.herramienta === "agregar" && sembrar && (
        <div className="pointer-events-auto" data-tour="pieza-mapa">
          <Segmentado<Pieza>
            claro
            etiqueta={tx("Pieza que se pone", "Piece to place")}
            valor={estado.pieza}
            onCambio={(v) => despachar({ tipo: "pieza", pieza: v })}
            opciones={PIEZAS.map((p) => ({ valor: p, texto: <><IconoPieza pieza={p} className="h-4 w-4" /> <span className={corto}>{NOMBRE_PIEZA[p]}</span></>, titulo: NOMBRE_PIEZA[p] }))}
          />
        </div>
      )}
      {estado.herramienta === "destino" && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-melki px-3 py-1.5 text-[13px] font-medium text-white shadow-sm" role="status">
          <Flag size={15} /> {tx("Toque el punto al que quiere llevar la red", "Tap the point you want the network to reach")}
          <button type="button" onClick={() => despachar({ tipo: "herramienta", herramienta: "mover" })} className="-mr-1 rounded p-0.5 hover:bg-white/20" aria-label={tx("Cancelar", "Cancel")}>
            <X size={15} />
          </button>
        </div>
      )}
      {estado.herramienta === "agregar" && !sembrar && (
        <div className="pointer-events-auto" data-tour="tipo-nuevo">
          <Segmentado<TipoNodo>
            claro
            etiqueta={tx("Tipo de nodo que se agrega", "Type of node to add")}
            valor={estado.tipoNuevo}
            onCambio={(v) => despachar({ tipo: "tipo-nuevo", valor: v })}
            opciones={[
              { valor: "antena", texto: <><IconoTorre className="h-4 w-4" /> {tx("Nodo antena", "Antenna node")}</>, titulo: tx("Infraestructura en mástil: genera cobertura", "Mast-mounted infrastructure: generates coverage") },
              { valor: "nodo", texto: <><Smartphone size={15} /> {tx("Nodo", "Node")}</>, titulo: tx("Equipo de campo (portátil o en un poste bajo): participa en la malla", "Field device (handheld or on a low pole): takes part in the mesh") },
            ]}
          />
        </div>
      )}
      <div className={`pointer-events-auto ${sembrar ? "hidden" : ""}`} data-tour="modos">
        <Segmentado<ModoMapa>
          claro
          etiqueta={tx("Color de la cobertura", "Coverage color")}
          valor={estado.vista.modo}
          onCambio={(v) => despachar({ tipo: "vista", cambios: { modo: v } })}
          opciones={[
            { valor: "senal", texto: tx("Señal", "Signal"), titulo: tx("Nivel de señal del mejor nodo antena", "Signal level of the best antenna node") },
            { valor: "servidor", texto: tx("Mejor antena", "Best antenna"), titulo: tx("Qué nodo antena da la mejor señal en cada punto", "Which antenna node gives the best signal at each point") },
            { valor: "redundancia", texto: tx("Respaldo", "Backup"), titulo: tx("Cuántos nodos antena dan servicio en cada punto", "How many antenna nodes provide service at each point") },
          ]}
        />
      </div>
      <MenuCapas estado={estado} despachar={despachar} />
    </div>
  );
}

function MenuCapas({ estado, despachar }: { estado: Estado; despachar: Dispatch<Accion> }) {
  useIdioma();
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
    { valor: "satelite", texto: tx("Satélite", "Satellite") },
    { valor: "topografico", texto: tx("Topográfico", "Topographic"), detalle: tx("Relieve, poblados y vías", "Terrain, towns and roads") },
    { valor: "opentopomap", texto: "OpenTopoMap", detalle: tx("Curvas de nivel, ríos y quebradas con nombre", "Contour lines and named rivers and streams") },
    { valor: "calles", texto: tx("Calles (OpenStreetMap)", "Streets (OpenStreetMap)") },
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
        <Layers size={15} /> {tx("Capas", "Layers")}
      </button>
      {abierto && (
        <div className={`desplazable absolute top-full ${aLaDerecha ? "right-0" : "left-0"} mt-2 max-h-[calc(100dvh-170px)] w-[min(300px,calc(100vw-24px))] space-y-3 overflow-y-auto rounded-xl bg-white p-3.5 text-carbon shadow-lg ring-1 ring-black/10`}>
          <fieldset>
            <legend className="mb-1 font-cond text-[14px] font-semibold">{tx("Mapa base", "Base map")}</legend>
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
            {titulo(tx("Referencia", "Reference"))}
            <Interruptor etiqueta={tx("Departamentos y municipios", "Departments and municipalities")} detalle={tx("Límites y nombres (DANE)", "Boundaries and names (DANE)")} activo={v.refDivision} onCambio={(x) => cambiar({ refDivision: x })} />
            <Interruptor etiqueta={tx("Ríos y lagos principales", "Main rivers and lakes")} activo={v.refRios} onCambio={(x) => cambiar({ refRios: x })} />
            <Interruptor etiqueta={tx("Países", "Countries")} activo={v.refPaises} onCambio={(x) => cambiar({ refPaises: x })} />
            <Interruptor etiqueta={tx("Poblados y lugares", "Towns and places")} detalle={tx("Nombres de Esri sobre el mapa", "Esri place names on the map")} activo={v.refNombres} onCambio={(x) => cambiar({ refNombres: x })} />
            <Interruptor etiqueta={tx("Vías", "Roads")} activo={v.refVias} onCambio={(x) => cambiar({ refVias: x })} />
          </div>
          <div>
            {titulo(tx("Simulación", "Simulation"))}
            <label className="block py-1">
              <span className="mb-1 flex justify-between text-[14px]">
                {tx("Opacidad de la cobertura", "Coverage opacity")} <span className="text-tenue tabular-nums">{porcentaje(Math.round(v.opacidad * 100))}</span>
              </span>
              <input type="range" min={0.1} max={1} step={0.05} value={v.opacidad} onChange={(e) => cambiar({ opacidad: Number(e.target.value) })} className="w-full accent-salvia" />
            </label>
            <Interruptor etiqueta={tx("Rango de alcance", "Range")} detalle={tx("Contorno con servicio y confiable de cada nodo antena", "Service and reliable contours of each antenna node")} activo={v.mostrarAlcance} onCambio={(x) => cambiar({ mostrarAlcance: x })} />
            <Interruptor etiqueta={tx("Anillos de distancia", "Distance rings")} detalle={tx("Alrededor del nodo seleccionado", "Around the selected node")} activo={v.mostrarAnillos} onCambio={(x) => cambiar({ mostrarAnillos: x })} />
            <Interruptor etiqueta={tx("Solo el nodo seleccionado", "Selected node only")} detalle={tx("Pinta únicamente su cobertura y alcance", "Paints only its coverage and range")} activo={v.soloSeleccionada} onCambio={(x) => cambiar({ soloSeleccionada: x })} />
            <Interruptor etiqueta={tx("Zonas sin servicio", "Areas with no service")} activo={v.mostrarSinServicio} onCambio={(x) => cambiar({ mostrarSinServicio: x })} />
            <Interruptor etiqueta={tx("Enlaces de la malla", "Mesh links")} activo={v.mostrarEnlaces} onCambio={(x) => cambiar({ mostrarEnlaces: x })} />
            <Interruptor etiqueta={tx("Parejas sin enlace", "Pairs with no link")} activo={v.mostrarSinEnlace} onCambio={(x) => cambiar({ mostrarSinEnlace: x })} />
            <Interruptor etiqueta={tx("Círculo de estudio", "Study circle")} activo={v.mostrarCirculos} onCambio={(x) => cambiar({ mostrarCirculos: x })} />
            <Interruptor etiqueta={tx("Dirección de las antenas", "Antenna direction")} detalle={tx("Haz de las antenas direccionales", "Beam of the directional antennas")} activo={v.mostrarHaces} onCambio={(x) => cambiar({ mostrarHaces: x })} />
            <Interruptor etiqueta={tx("Relieve 3D", "3D terrain")} detalle={tx("Incline el mapa con Ctrl + arrastrar", "Tilt the map with Ctrl + drag")} activo={v.relieve3d} onCambio={(x) => cambiar({ relieve3d: x })} />
          </div>
          <div>
            {titulo(tx("Escala de la señal", "Signal scale"))}
            <EscalaSenalCampos estado={estado} despachar={despachar} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Personas en la prueba de estrés: el color del contorno de cada una y cuántas hay en cada estado. */
function BloqueUsuarios({ r }: { r: ResumenUsuarios }) {
  useIdioma();
  return (
    <div className="mt-2 border-t border-linea pt-1.5" data-tour="leyenda-usuarios">
      <p className="text-[11.5px] text-tenue">{tx("Personas en la prueba de estrés (contorno)", "People in the stress test (outline)")}</p>
      <ul className="mt-1 space-y-0.5 text-[12px] leading-tight">
        {ORDEN_ESTADOS_USUARIO.map((e) => (
          <li key={e} className="flex items-center gap-2" title={ESTADOS_USUARIO[e].descripcion}>
            <span className="h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: ESTADOS_USUARIO[e].color, background: `${ESTADOS_USUARIO[e].color}55` }} />
            <span className="min-w-0 flex-1 truncate">{ESTADOS_USUARIO[e].nombre}</span>
            <span className="text-tenue tabular-nums">{numeroLocal(r.porEstado[e])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Leyenda({ estado, resultado, antenas, usuarios }: { estado: Estado; resultado: ResultadoSimulacion | null; antenas: Antena[]; usuarios?: ResumenUsuarios | null }) {
  useIdioma();
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
            { color: v.colorUmbral, texto: tx("Con señal", "With signal"), rango: `≥ ${nivelDbm(v.umbralDbm)}` },
            { color: CLASES[4].color, texto: tx("Por debajo", "Below"), rango: `< ${nivelDbm(v.umbralDbm)}` },
          ]
        : escala === "arcoiris"
          ? []
          : CLASES.map((c) => ({ color: c.color, texto: c.nombre, rango: c.id === "sin" ? `< ${nivel(20)}` : `≥ ${nivel(c.minimoDb)}` }))
      : modo === "servidor"
        ? resultado.antenas.map((a, i) => ({ color: COLORES_ANTENA[i % COLORES_ANTENA.length], texto: antenas.find((x) => x.id === a.id)?.nombre ?? a.nombre, rango: "" }))
        : COLORES_REDUNDANCIA.map((c) => ({ color: c.color, texto: c.nombre, rango: "" }));
  const titulo = modo === "senal" ? tx("Nivel de señal", "Signal level") : modo === "servidor" ? tx("Nodo antena con mejor señal", "Antenna node with the best signal") : tx("Nodos antena con servicio", "Antenna nodes with service");
  if (estado.modo === "sembrar") return <LeyendaSembrar abierta={abierta} onAbrir={setAbierta} filas={escala === "clases" ? filas : CLASES.map((c) => ({ color: c.color, texto: c.nombre, rango: "" }))} usuarios={usuarios} />;
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
        {tx("Leyenda", "Legend")}
      </button>
    );
  }
  return (
    <div className="pointer-events-auto absolute bottom-10 left-3 z-10 w-52 rounded-lg bg-white/95 p-3 text-carbon shadow-md ring-1 ring-black/10" data-tour="leyenda">
      <div className="flex items-start justify-between gap-2">
        <p className="font-cond text-[15px] leading-tight font-semibold">{titulo}</p>
        <button type="button" onClick={() => setAbierta(false)} className="-mt-1 -mr-1 rounded p-1 text-tenue hover:bg-black/5" aria-label={plegarLeyenda()} aria-expanded={true}>
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
              {tx("Por debajo del mínimo", "Below the minimum")}
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
              ["#FFB25B", tx("Alcance con servicio (≥ 20 dB)", "Range with service (≥ 20 dB)")],
              ["#8BD17C", tx("Alcance confiable (≥ 37 dB)", "Reliable range (≥ 37 dB)")],
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
      {usuarios && usuarios.total > 0 && <BloqueUsuarios r={usuarios} />}
    </div>
  );
}

/** Leyenda corta del modo «Sembrar la malla»: qué significa cada color de las piezas y del mapa. */
function LeyendaSembrar({ abierta, onAbrir, filas, usuarios }: { abierta: boolean; onAbrir: (v: boolean) => void; filas: { color: string; texto: string }[]; usuarios?: ResumenUsuarios | null }) {
  useIdioma();
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
        {punto("#FF9F43")} {tx("Leyenda", "Legend")}
      </button>
    );
  return (
    <div className="pointer-events-auto absolute bottom-10 left-3 z-10 w-48 rounded-lg bg-white/95 p-2.5 text-carbon shadow-md ring-1 ring-black/10" data-tour="leyenda">
      <div className="flex items-start justify-between gap-2">
        <p className="font-cond text-[14.5px] leading-tight font-semibold">{tx("Cómo leer el mapa", "How to read the map")}</p>
        <button type="button" onClick={() => onAbrir(false)} className="-mt-1 -mr-1 rounded p-1 text-tenue hover:bg-black/5" aria-label={plegarLeyenda()} aria-expanded={true}>
          <X size={14} />
        </button>
      </div>
      <ul className="mt-1.5 space-y-1 text-[12.5px] leading-tight">
        <li className="flex items-center gap-2">
          {punto("#3EE6C8")} {tx("Gateway + Internet con IA", "Gateway + Internet with AI")}
        </li>
        <li className="flex items-center gap-2">
          {punto("#3FD68B")} {tx("Conectado al gateway", "Connected to the gateway")}
        </li>
        <li className="flex items-center gap-2">
          {punto("#FF5A4E")} {tx("Sin cobertura (parpadea)", "No coverage (blinking)")}
        </li>
        <li className="flex items-center gap-2">
          {punto("#FF9F43")} {tx("No alcanza la red", "Cannot reach the network")}
        </li>
        <li className="flex items-center gap-2">
          <svg width="14" height="8" className="shrink-0" aria-hidden="true">
            <line x1="0" y1="4" x2="14" y2="4" stroke="#3EE6C8" strokeWidth="5" strokeOpacity=".35" />
            <line x1="0" y1="4" x2="14" y2="4" stroke="#0F1F1C" strokeWidth="2.2" strokeDasharray="3 2" />
          </svg>
          {tx("Flujo hacia el gateway", "Flow toward the gateway")}
        </li>
        <li className="flex items-center gap-2">
          <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-carbon px-1 font-cond text-[10.5px] font-bold text-white">2</span> {tx("Saltos hasta el gateway", "Hops to the gateway")}
        </li>
      </ul>
      <div className="mt-2 border-t border-linea pt-1.5">
        <p className="text-[11.5px] text-tenue">{tx("Señal en el terreno", "Signal on the ground")}</p>
        <div className="mt-1 flex h-2.5 overflow-hidden rounded-[3px] ring-1 ring-black/10" aria-hidden="true">
          {filas.map((f) => (
            <span key={f.texto} className="flex-1" style={{ background: f.color }} />
          ))}
        </div>
        <div className="mt-0.5 flex justify-between text-[11px] text-tenue">
          <span>{tx("Buena", "Good")}</span>
          <span>{tx("Sin servicio", "No service")}</span>
        </div>
      </div>
      {usuarios && usuarios.total > 0 && <BloqueUsuarios r={usuarios} />}
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
  useIdioma();
  if (!inspeccion && !cargando) return null;
  const rx: Receptor | null = inspeccion && Number.isFinite(inspeccion.sensibilidadDbm) ? inspeccion : null;
  const color = (id: string) => CLASES.find((c) => c.id === id)?.color ?? "#999";
  return (
    <div className="pointer-events-auto absolute top-28 left-3 z-10 w-72 sm:top-16 rounded-xl bg-white/95 p-3 text-carbon shadow-lg ring-1 ring-black/10" role="dialog" aria-label={tx("Señal en el punto", "Signal at the point")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-cond text-[15px] font-semibold">{tx("Señal en este punto", "Signal at this point")}</p>
          {inspeccion && (
            <p className="text-[12px] text-tenue tabular-nums">
              {aGMS(inspeccion.lat, "lat")} · {aGMS(inspeccion.lon, "lon")} · {Math.round(inspeccion.elevacionM)} {tx("m s. n. m.", "m a.s.l.")}
            </p>
          )}
        </div>
        <button type="button" onClick={onCerrar} className="rounded p-1 text-tenue hover:bg-black/5" aria-label={tx("Cerrar", "Close")}>
          <X size={16} />
        </button>
      </div>
      {cargando && !inspeccion ? (
        <p className="mt-2 text-[13px] text-tenue">{tx("Calculando…", "Calculating…")}</p>
      ) : inspeccion && inspeccion.margenes.length === 0 ? (
        <p className="mt-2 text-[13px] text-tenue">{tx("No hay nodos antena activos.", "There are no active antenna nodes.")}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {inspeccion?.margenes.slice(0, 8).map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[13px]">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: color(m.clase) }} />
              <span className="min-w-0 flex-1 truncate">{m.nombre}</span>
              <span className="text-[12px] text-tenue tabular-nums">{fmt(m.distanciaKm, 2)} km</span>
              <span
                className="text-right font-medium whitespace-nowrap tabular-nums"
                title={rx ? tx(`Margen ${fmt(m.margenDb, 1)} dB · ${textoNivel(m.margenDb + rx.sensibilidadDbm, "dbm", rx)}`, `Margin ${fmt(m.margenDb, 1)} dB · ${textoNivel(m.margenDb + rx.sensibilidadDbm, "dbm", rx)}`) : undefined}
              >
                {rx && unidad !== "margen" ? textoNivel(m.margenDb + rx.sensibilidadDbm, unidad, rx, unidad === "dbm" || unidad === "dbuvm" ? 0 : 1) : `${fmt(m.margenDb, 0)} dB`}
              </span>
              <button type="button" className="text-[12px] text-salvia-oscura hover:underline" onClick={() => onPerfil(m.id)} title={tx("Perfil e informe del radioenlace", "Radio link profile and report")}>
                {tx("Perfil", "Profile")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
