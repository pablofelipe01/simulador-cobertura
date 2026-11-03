// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Barra superior: nombre del escenario, buscador, archivo (nuevo, ejemplo, importar, exportar), Asistente Melki, tours
// guiados (abre el menú de Melki), el recorrido de la red, el pitch, la configuración (idioma) y los botones para
// mostrar u ocultar los paneles de los lados.
import { AudioLines, ChevronDown, CircleQuestionMark, FileDown, FileUp, FolderOpen, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Presentation, RotateCcw, Route, Scale, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { derechos } from "@/lib/autoria";
import { numeroLocal, tx } from "@/lib/idioma";
import { useIdioma } from "@/lib/use-idioma";

import { Configuracion } from "./configuracion";

type Props = {
  nombre: string;
  onRenombrar: (n: string) => void;
  onNuevo: () => void;
  onEjemplo: () => void;
  onImportar: (f: File) => void;
  onExportarJson: () => void;
  onExportarCsv: () => void;
  onExportarKmz: (() => void) | null;
  onRecorrido: () => void;
  /** La presentación del modelo de negocio (el pitch con el robot de Melki). */
  onPitch?: () => void;
  /** El recorrido de la red: el robot de Melki explica cada punto en una nube. */
  onRecorridoRed?: () => void;
  /** «Acerca del simulador»: autoría, titularidad y licencia. */
  onAcerca: () => void;
  resultadosAbiertos: boolean;
  /** Hay un resultado nuevo con el panel cerrado: el botón lo avisa con un puntico. */
  resultadoNuevo?: boolean;
  onResultados: () => void;
  /** Panel izquierdo (en el escritorio): cuando está oculto aparece aquí el botón para volver a abrirlo. */
  panelIzquierdo: boolean;
  onPanelIzquierdo: () => void;
  /** Asistente Melki: escucha todo el tiempo y se activa con «Hola Melki». */
  manosLibres: boolean;
  onManosLibres: () => void;
  /** Buscador; recibe una función para cerrarlo (en pantallas angostas se abre en una fila aparte). */
  buscador?: (alElegir?: () => void) => React.ReactNode;
  /** Protocolo de la malla (MeshCore o Meshtastic) y frecuencia, para el subtítulo. */
  protocolo?: string;
  frecuenciaMhz?: number;
};

export function BarraSuperior(p: Props) {
  useIdioma();
  const [menu, setMenu] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const idArchivo = useId();
  useEffect(() => {
    if (!menu) return;
    const cerrar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !caja.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, [menu]);
  const item = (icono: React.ReactNode, texto: string, accion: (() => void) | null, detalle?: string) => (
    <button
      type="button"
      role="menuitem"
      disabled={!accion}
      onClick={() => {
        setMenu(false);
        accion?.();
      }}
      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] hover:bg-papel-2 disabled:cursor-not-allowed disabled:text-tenue disabled:hover:bg-transparent"
    >
      <span className="mt-0.5 text-carbon-2">{icono}</span>
      <span>
        {texto}
        {detalle && <span className="block text-[12px] text-tenue">{detalle}</span>}
      </span>
    </button>
  );

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-linea bg-papel px-3 sm:gap-3 sm:px-4">
      {!p.panelIzquierdo && (
        <button
          type="button"
          onClick={p.onPanelIzquierdo}
          className="-mr-1 hidden rounded-lg p-2 hover:bg-papel-2 lg:inline-flex"
          title={tx("Mostrar el panel", "Show the panel")}
          aria-label={tx("Mostrar el panel izquierdo", "Show the left panel")}
          aria-expanded={false}
          data-tour="alternar-panel"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-cond text-[22px] leading-none font-bold tracking-[0.06em] text-salvia-oscura">MELKI</span>
        <span className="hidden h-6 w-px bg-linea sm:block" />
        <div className="hidden min-w-0 sm:block">
          <h1 className="font-cond text-[17px] leading-tight font-semibold">{tx("Simulador de cobertura", "Coverage Simulator")}</h1>
          <p className="text-[12px] leading-tight text-tenue">
            {tx("Pagos, WhatsApp e IA por", "Payments, WhatsApp and AI over")} {p.protocolo ?? "MeshCore"} · LoRa {numeroLocal(p.frecuenciaMhz ?? 920, { maximumFractionDigits: 3 })} MHz
          </p>
        </div>
      </div>

      <input
        aria-label={tx("Nombre del escenario", "Scenario name")}
        className="ml-1 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[15px] font-medium hover:border-linea focus:border-salvia focus:bg-white focus:outline-none md:max-w-xs"
        value={p.nombre}
        maxLength={80}
        onChange={(e) => p.onRenombrar(e.target.value)}
        data-tour="escenario"
      />

      {p.buscador && <div className="hidden min-w-0 flex-1 justify-center md:flex">{p.buscador()}</div>}
      {p.buscador && buscando && <div className="absolute inset-x-0 top-full z-40 border-b border-linea bg-papel px-3 py-2 shadow-md md:hidden">{p.buscador(() => setBuscando(false))}</div>}

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
        {p.buscador && (
          <button
            type="button"
            onClick={() => setBuscando((v) => !v)}
            aria-expanded={buscando}
            className={`rounded-lg p-2 md:hidden ${buscando ? "bg-carbon text-white" : "hover:bg-papel-2"}`}
            aria-label={tx("Buscar coordenadas, municipio o nodo", "Search coordinates, municipality or node")}
          >
            <Search size={18} />
          </button>
        )}
        <div ref={caja} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[14px] font-medium ring-1 ring-linea hover:bg-papel-2 sm:px-3"
            data-tour="archivo"
          >
            {tx("Archivo", "File")} <ChevronDown size={15} />
          </button>
          {menu && (
            <div role="menu" className="absolute top-full right-0 mt-2 w-72 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/10">
              {item(<Plus size={16} />, tx("Nuevo escenario", "New scenario"), p.onNuevo, tx("Empieza sin nodos", "Start with no nodes"))}
              {item(<RotateCcw size={16} />, tx("Cargar el ejemplo", "Load the example"), p.onEjemplo, tx("Un nodo antena llamado «Ejemplo»", "An antenna node called “Example”"))}
              {item(<FolderOpen size={16} />, tx("Abrir escenario (.json)", "Open scenario (.json)"), () => document.getElementById(idArchivo)?.click())}
              <div className="my-1 h-px bg-linea" />
              {item(<FileDown size={16} />, tx("Guardar escenario (.json)", "Save scenario (.json)"), p.onExportarJson, tx("Nodos, parámetros y mediciones, para compartir o retomar", "Nodes, parameters and measurements, to share or pick up later"))}
              {item(<FileDown size={16} />, tx("Nodos en Excel (.csv)", "Nodes in Excel (.csv)"), p.onExportarCsv)}
              {item(<FileUp size={16} />, tx("Cobertura para Google Earth (.kmz)", "Coverage for Google Earth (.kmz)"), p.onExportarKmz, p.onExportarKmz ? tx("Señal, nodos, enlaces, alcance y mediciones", "Signal, nodes, links, range and measurements") : tx("Disponible después de simular", "Available after simulating"))}
              <div className="my-1 h-px bg-linea" />
              {item(<Scale size={16} />, tx("Acerca del simulador y licencia", "About the simulator and license"), p.onAcerca, tx("Autoría, titulares y uso permitido", "Authorship, rights holders and permitted use"))}
              <p className="px-2.5 pt-1 pb-1.5 text-[11px] leading-snug text-tenue">{derechos()}</p>
            </div>
          )}
          <input
            id={idArchivo}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label={tx("Abrir escenario", "Open scenario")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) p.onImportar(f);
              e.target.value = "";
            }}
          />
        </div>
        <button
          type="button"
          onClick={p.onManosLibres}
          aria-pressed={p.manosLibres}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-medium transition-colors sm:px-2.5 ${p.manosLibres ? "bg-carbon text-white hover:bg-carbon-2" : "hover:bg-papel-2"}`}
          data-tour="manos-libres"
          title={
            p.manosLibres
              ? tx("Apagar el Asistente Melki (o diga «Melki, deja de escuchar»)", "Turn off the Melki Assistant (or say “Melki, stop listening”)")
              : tx("Asistente Melki: le escucha todo el tiempo y se activa cuando dice «Hola Melki»", "Melki Assistant: listens all the time and wakes up when you say “Hey Melki”")
          }
          aria-label={p.manosLibres ? tx("Apagar el Asistente Melki", "Turn off the Melki Assistant") : tx("Activar el Asistente Melki", "Turn on the Melki Assistant")}
        >
          <span className="relative grid place-items-center">
            <AudioLines size={17} />
            {p.manosLibres && <span className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full bg-melki ring-1 ring-carbon" aria-hidden="true" />}
          </span>
          <span className="hidden xl:inline">{tx("Asistente Melki", "Melki Assistant")}</span>
        </button>
        <button
          type="button"
          onClick={p.onRecorrido}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-medium hover:bg-papel-2 sm:px-2.5"
          data-tour="ayuda"
          title={tx("Tours guiados con Melki: tutorial básico y más", "Guided tours with Melki: basic tutorial and more")}
          aria-label={tx("Tours guiados", "Guided tours")}
        >
          <CircleQuestionMark size={17} /> <span className="hidden md:inline">Tours</span>
        </button>
        {p.onRecorridoRed && (
          <button
            type="button"
            onClick={p.onRecorridoRed}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-medium hover:bg-papel-2 sm:px-2.5"
            data-tour="boton-recorrido-red"
            title={tx(
              "Recorrido: Melki recorre la red punto por punto y explica en una nube qué se instaló, por qué ahí y por qué la red quedó así",
              "Walkthrough: Melki goes through the network point by point and explains in a cloud what was installed, why there and why the network turned out this way",
            )}
            aria-label={tx("Recorrido de la red con Melki", "Network walkthrough with Melki")}
          >
            <Route size={17} /> <span className="hidden md:inline">{tx("Recorrido", "Walkthrough")}</span>
          </button>
        )}
        {p.onPitch && (
          <button
            type="button"
            onClick={p.onPitch}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-medium hover:bg-papel-2 sm:px-2.5"
            data-tour="boton-pitch"
            title={tx(
              "Pitch: Melki presenta el modelo de negocio recorriendo el mapa (antenas, cobertura, capacidad, inversión, operación y equilibrio)",
              "Pitch: Melki presents the business model across the map (antennas, coverage, capacity, investment, operation and break-even)",
            )}
            aria-label={tx("Presentar el modelo de negocio (pitch)", "Present the business model (pitch)")}
          >
            <Presentation size={17} /> <span className="hidden md:inline">Pitch</span>
          </button>
        )}
        <Configuracion />
        <button
          type="button"
          onClick={p.onResultados}
          className="relative hidden rounded-lg p-2 hover:bg-papel-2 lg:inline-flex"
          aria-expanded={p.resultadosAbiertos}
          data-tour="alternar-resultados"
          data-nuevo={p.resultadoNuevo ? "" : undefined}
          title={p.resultadosAbiertos ? tx("Ocultar resultados", "Hide results") : p.resultadoNuevo ? tx("Mostrar resultados (hay un resultado nuevo)", "Show results (there is a new result)") : tx("Mostrar resultados", "Show results")}
          aria-label={p.resultadosAbiertos ? tx("Ocultar resultados", "Hide results") : tx("Mostrar resultados", "Show results")}
        >
          {p.resultadosAbiertos ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          {p.resultadoNuevo && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-melki ring-2 ring-papel" aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
