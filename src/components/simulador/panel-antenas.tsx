// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Lista de nodos (nodos antena y nodos de campo), alta por coordenadas o en el mapa, y edición de cada uno.
import { Copy, Crosshair, Eye, EyeOff, LocateFixed, Navigation, Plus, Route, Trash, X } from "lucide-react";
import { useId, useState, type Dispatch } from "react";

import { tx } from "@/lib/idioma";
import { EQUIPOS } from "@/lib/radio/constantes";
import { aDecimal, aGMS, leerCoordenada, leerPar, puntoCardinal, rumbo } from "@/lib/radio/geo";
import { anchosHaz, esDireccional, PATRONES, patronPorId } from "@/lib/radio/patron";
import type { Antena, PatronId, ResultadoSimulacion, Rol, TipoNodo } from "@/lib/radio/tipos";
import { useIdioma } from "@/lib/use-idioma";

import { NOMBRE_TIPO, type Accion, type Estado } from "./estado";
import { IconoEquipo, IconoNodo, IconoTorre } from "./icono-torre";
import { estadoNodo } from "./marcador";
import { Boton, CampoNumero, fmt, Interruptor, Segmentado } from "./ui";

// Los textos son getters: se leen en el idioma de ese momento
const AYUDA_TIPO: Record<TipoNodo, string> = {
  get antena() {
    return tx("Infraestructura en mástil o torre: genera el mapa de cobertura y su rango de alcance.", "Infrastructure on a mast or tower: produces the coverage map and its range.");
  },
  get nodo() {
    return tx("Equipo de campo (portátil, sensor o poste bajo): no pinta cobertura; se evalúa su enlace con la malla.", "Field device (handheld, sensor or low pole): draws no coverage; its link with the mesh is evaluated.");
  },
};

const COLOR_ESTADO = { "sin-simular": "#9AA19D", solida: "#1E7B34", debil: "#F08A2C", aislada: "#D93A2E", pasarela: "#2B2F2E" } as const;
const TEXTO_ESTADO = {
  get "sin-simular"() {
    return tx("Sin simular", "Not simulated");
  },
  get solida() {
    return tx("Ruta sólida a la pasarela", "Solid route to the gateway");
  },
  get debil() {
    return tx("Ruta débil a la pasarela", "Weak route to the gateway");
  },
  get aislada() {
    return tx("Sin ruta a la pasarela", "No route to the gateway");
  },
  get pasarela() {
    return tx("Pasarela", "Gateway");
  },
} as const;

const ROLES: { valor: Rol; texto: string; ayuda: string }[] = [
  {
    valor: "REPETIDOR",
    get texto() {
      return tx("Repetidor", "Repeater");
    },
    get ayuda() {
      return tx("Pasa los paquetes de los demás: el repetidor solar en su mástil.", "Relays everyone else's packets: the solar repeater on its mast.");
    },
  },
  {
    valor: "COMPANION",
    texto: "Companion",
    get ayuda() {
      return tx("Envía y recibe lo suyo, sin retransmitir: la billetera o la radio del gateway.", "Sends and receives its own traffic without retransmitting: the wallet or the gateway radio.");
    },
  },
  {
    valor: "ROOM_SERVER",
    texto: "Room server",
    get ayuda() {
      return tx("Guarda los mensajes para quien vuelva a conectarse; no retransmite.", "Stores messages for whoever reconnects; doesn't retransmit.");
    },
  },
];

const saltosTexto = (n: number) => tx(`${n} ${n === 1 ? "salto" : "saltos"}`, `${n} ${n === 1 ? "hop" : "hops"}`);

type Props = {
  estado: Estado;
  despachar: Dispatch<Accion>;
  resultado: ResultadoSimulacion | null;
  onCentrar: (lat: number, lon: number) => void;
  onPerfil: (tx: Antena, destino: Antena, informe?: boolean) => void;
};

export function PanelAntenas({ estado, despachar, resultado, onCentrar, onPerfil }: Props) {
  useIdioma();
  const antenas = estado.escenario.antenas;
  const [formulario, setFormulario] = useState(false);
  const nodos = new Map((resultado?.nodos ?? []).map((n) => [n.id, n]));
  const nAntenas = antenas.filter((a) => (a.tipo ?? "antena") === "antena").length;

  return (
    <div className="space-y-3">
      <div className="space-y-2" data-tour="agregar">
        <Segmentado<TipoNodo>
          etiqueta={tx("Tipo de nodo que se agrega", "Type of node to add")}
          valor={estado.tipoNuevo}
          onCambio={(v) => despachar({ tipo: "tipo-nuevo", valor: v })}
          opciones={[
            { valor: "antena", texto: <><IconoTorre className="h-4 w-4" /> {tx("Nodo antena", "Antenna node")}</>, titulo: AYUDA_TIPO.antena },
            { valor: "nodo", texto: <><IconoEquipo className="h-4 w-4" /> {tx("Nodo", "Node")}</>, titulo: AYUDA_TIPO.nodo },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Boton
            variante={estado.herramienta === "agregar" ? "principal" : "secundario"}
            onClick={() => despachar({ tipo: "herramienta", herramienta: estado.herramienta === "agregar" ? "mover" : "agregar" })}
            titulo={tx(`Haga clic en el mapa para ubicar el ${NOMBRE_TIPO[estado.tipoNuevo].toLowerCase()}`, `Click on the map to place the ${NOMBRE_TIPO[estado.tipoNuevo].toLowerCase()}`)}
          >
            <Crosshair size={16} /> {estado.herramienta === "agregar" ? tx("Clic en el mapa…", "Click on the map…") : tx("Ubicar en el mapa", "Place on the map")}
          </Boton>
          <Boton variante={formulario ? "principal" : "secundario"} onClick={() => setFormulario((v) => !v)}>
            <Plus size={16} /> {tx("Por coordenadas", "By coordinates")}
          </Boton>
        </div>
      </div>

      {formulario && (
        <FormularioCoordenadas
          key={estado.tipoNuevo}
          tipo={estado.tipoNuevo}
          onAgregar={(lat, lon, nombre, alturaM) => {
            despachar({ tipo: "agregar", lat, lon, datos: { ...(nombre ? { nombre } : {}), alturaM } });
            onCentrar(lat, lon);
            setFormulario(false);
          }}
          onCerrar={() => setFormulario(false)}
        />
      )}

      {antenas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linea p-4 text-[14px] leading-relaxed text-carbon-2">
          {tx("Agregue el primer nodo antena: haga clic en ", "Add the first antenna node: click ")}
          <b>{tx("Ubicar en el mapa", "Place on the map")}</b>
          {tx(
            ", escriba sus coordenadas o pídaselo a Melki, por ejemplo «inscribe un nodo antena en 4.5123, -73.1234». El primer nodo antena queda como pasarela.",
            ", type its coordinates or ask Melki, for example “add an antenna node at 4.5123, -73.1234”. The first antenna node becomes the gateway.",
          )}
        </p>
      ) : (
        <>
        {nAntenas === 0 && (
          <p className="rounded-lg bg-melki-clara/60 px-3 py-2 text-[13px] leading-snug text-carbon-2">
            {tx(
              "Aún no hay nodos antena: los nodos de campo no generan cobertura. Agregue al menos un nodo antena para ver el mapa de señal.",
              "There are no antenna nodes yet: field nodes don't produce coverage. Add at least one antenna node to see the signal map.",
            )}
          </p>
        )}
        <ul className="divide-y divide-linea rounded-lg bg-white ring-1 ring-linea" data-tour="lista-antenas">
          {antenas.map((a) => {
            const st = estadoNodo(a, nodos.get(a.id));
            const sel = estado.seleccion === a.id;
            return (
              <li key={a.id} className={sel ? "bg-salvia-clara/50" : ""}>
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => {
                      despachar({ tipo: "seleccionar", id: sel ? null : a.id });
                      if (!sel) onCentrar(a.lat, a.lon);
                    }}
                    aria-expanded={sel}
                  >
                    <span className={a.activa ? "text-carbon" : "text-tenue"} title={TEXTO_ESTADO[st]}>
                      <IconoNodo tipo={a.tipo} className="h-7 w-7" baliza={COLOR_ESTADO[st]} />
                    </span>
                    <span className="min-w-0">
                      <span className={`flex items-center gap-1.5 font-cond text-[15px] font-semibold ${a.activa ? "" : "text-tenue line-through"}`}>
                        <span className="truncate">{a.nombre}</span>
                        <span className={`shrink-0 rounded px-1.5 py-px font-sans text-[10.5px] font-medium tracking-wide uppercase no-underline ${(a.tipo ?? "antena") === "nodo" ? "bg-[#E1EAF0] text-[#2F5168]" : "bg-salvia-clara text-salvia-oscura"}`}>
                          {(a.tipo ?? "antena") === "nodo" ? tx("Nodo", "Node") : tx("Antena", "Antenna")}
                        </span>
                      </span>
                      <span className="block truncate text-[12px] text-tenue">
                        {fmt(a.alturaM, a.alturaM % 1 ? 1 : 0)} m · {fmt(a.gananciaDbi)} dBi
                        {esDireccional(a)
                          ? tx(` ${patronPorId(a.patron).nombre.toLowerCase()} a ${Math.round(a.azimutDeg ?? 0)}°`, ` ${patronPorId(a.patron).nombre.toLowerCase()} at ${Math.round(a.azimutDeg ?? 0)}°`)
                          : ""} ·{" "}
                        {a.pasarela ? "gateway" : a.rol === "REPETIDOR" ? tx("retransmite", "retransmits") : tx("no retransmite", "doesn't retransmit")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-carbon-2 hover:bg-black/5"
                    title={a.activa ? tx("Excluir de la simulación", "Exclude from the simulation") : tx("Incluir en la simulación", "Include in the simulation")}
                    aria-label={a.activa ? tx(`Excluir ${a.nombre} de la simulación`, `Exclude ${a.nombre} from the simulation`) : tx(`Incluir ${a.nombre} en la simulación`, `Include ${a.nombre} in the simulation`)}
                    onClick={() => despachar({ tipo: "editar", id: a.id, cambios: { activa: !a.activa } })}
                  >
                    {a.activa ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                {sel && <EditorAntena antena={a} todas={antenas} despachar={despachar} resultado={resultado} onCentrar={onCentrar} onPerfil={onPerfil} />}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
}

function CampoCoordenada({ eje, valor, onCambio, onPar }: { eje: "lat" | "lon"; valor: number; onCambio: (v: number) => void; onPar?: (lat: number, lon: number) => void }) {
  useIdioma();
  const id = useId();
  const [borrador, setBorrador] = useState<string | null>(null);
  const texto = borrador ?? aDecimal(valor);
  const leido = leerCoordenada(texto, eje);
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-[13px] text-carbon-2">{eje === "lat" ? tx("Latitud", "Latitude") : tx("Longitud", "Longitude")}</span>
      <input
        id={id}
        className="campo tabular-nums"
        value={texto}
        aria-invalid={leido === null}
        spellCheck={false}
        onFocus={() => setBorrador(aDecimal(valor))}
        onBlur={() => setBorrador(null)}
        onChange={(e) => {
          const t = e.target.value;
          const par = onPar ? leerPar(t) : null;
          if (par && onPar) {
            onPar(par.lat, par.lon);
            setBorrador(aDecimal(eje === "lat" ? par.lat : par.lon));
            return;
          }
          setBorrador(t);
          const v = leerCoordenada(t, eje);
          if (v !== null) onCambio(v);
        }}
      />
      <span className="mt-1 block text-[12px] text-tenue tabular-nums">{leido !== null ? aGMS(leido, eje) : tx("Formato no reconocido", "Format not recognized")}</span>
    </label>
  );
}

function FormularioCoordenadas({ tipo, onAgregar, onCerrar }: { tipo: TipoNodo; onAgregar: (lat: number, lon: number, nombre: string, alturaM: number) => void; onCerrar: () => void }) {
  useIdioma();
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [nombre, setNombre] = useState("");
  const [altura, setAltura] = useState(tipo === "antena" ? 10 : 1.5);
  const vLat = leerCoordenada(lat, "lat");
  const vLon = leerCoordenada(lon, "lon");
  const listo = vLat !== null && vLon !== null;
  const pegar = (t: string, setter: (s: string) => void) => {
    const par = leerPar(t);
    if (par) {
      setLat(aDecimal(par.lat));
      setLon(aDecimal(par.lon));
    } else setter(t);
  };
  const tipoTexto = NOMBRE_TIPO[tipo].toLowerCase();
  return (
    <form
      className="space-y-2.5 rounded-lg bg-white p-3 ring-1 ring-linea"
      data-tour="formulario-coordenadas"
      onSubmit={(e) => {
        e.preventDefault();
        if (listo) onAgregar(vLat, vLon, nombre.trim(), altura);
      }}
    >
      <div className="flex items-center justify-between">
        <p className="font-cond text-[15px] font-semibold">{tx(`Nuevo ${tipoTexto} por coordenadas`, `New ${tipoTexto} by coordinates`)}</p>
        <button type="button" className="rounded p-1 text-tenue hover:bg-black/5" onClick={onCerrar} aria-label={tx("Cerrar formulario", "Close form")}>
          <X size={16} />
        </button>
      </div>
      <p className="text-[12px] leading-snug text-tenue">
        {tx(
          `Grados decimales (4.5123, -73.1234) o grados, minutos y segundos (4°30'44" N, 73°07'24" O). Puede pegar el par completo en cualquiera de los dos campos.`,
          `Decimal degrees (4.5123, -73.1234) or degrees, minutes and seconds (4°30'44" N, 73°07'24" W). You can paste the full pair into either field.`,
        )}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">{tx("Latitud", "Latitude")}</span>
          <input className="campo tabular-nums" value={lat} onChange={(e) => pegar(e.target.value, setLat)} aria-invalid={lat !== "" && vLat === null} placeholder="4.5123" spellCheck={false} />
          <span className="mt-1 block text-[12px] text-tenue tabular-nums">{vLat !== null ? aGMS(vLat, "lat") : " "}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">{tx("Longitud", "Longitude")}</span>
          <input className="campo tabular-nums" value={lon} onChange={(e) => pegar(e.target.value, setLon)} aria-invalid={lon !== "" && vLon === null} placeholder="-73.1234" spellCheck={false} />
          <span className="mt-1 block text-[12px] text-tenue tabular-nums">{vLon !== null ? aGMS(vLon, "lon") : " "}</span>
        </label>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <label className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">{tx("Nombre (opcional)", "Name (optional)")}</span>
          <input className="campo" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === "antena" ? tx("Torre norte", "North tower") : tx("Portátil 1", "Handheld 1")} />
        </label>
        <CampoNumero etiqueta={tx("Altura", "Height")} unidad="m" valor={altura} min={0.5} max={300} onCambio={setAltura} />
      </div>
      <button type="submit" disabled={!listo} className="w-full rounded-lg bg-carbon py-2 text-[14px] font-medium text-white disabled:bg-carbon/40">
        {tx(`Agregar ${tipoTexto}`, `Add ${tipoTexto}`)}
      </button>
    </form>
  );
}

function EditorAntena({
  antena: a,
  todas,
  despachar,
  resultado,
  onCentrar,
  onPerfil,
}: {
  antena: Antena;
  todas: Antena[];
  despachar: Dispatch<Accion>;
  resultado: ResultadoSimulacion | null;
  onCentrar: (lat: number, lon: number) => void;
  onPerfil: (tx: Antena, destino: Antena, informe?: boolean) => void;
}) {
  useIdioma();
  const editar = (cambios: Partial<Antena>) => despachar({ tipo: "editar", id: a.id, cambios });
  const personal = (cambios: Partial<Antena>) => editar({ ...cambios, equipo: "personalizado" });
  const resumen = resultado?.antenas.find((x) => x.id === a.id);
  const nodo = resultado?.nodos.find((x) => x.id === a.id);
  const nombres = new Map(todas.map((x) => [x.id, x.nombre]));
  const otras = todas.filter((x) => x.id !== a.id);
  const [destino, setDestino] = useState(otras[0]?.id ?? "");
  const idNombre = useId();
  const idEquipo = useId();
  const idRol = useId();
  const idDestino = useId();
  const idPatron = useId();
  const idApuntar = useId();
  const direccional = esDireccional(a);
  const haz = anchosHaz(a.patron, a.gananciaDbi);
  const patron = patronPorId(a.patron);

  return (
    <div className="space-y-3 border-t border-linea bg-papel/60 px-3 pt-3 pb-3.5" data-tour="editor-antena">
      <label htmlFor={idNombre} className="block">
        <span className="mb-1 block text-[13px] text-carbon-2">{tx("Nombre", "Name")}</span>
        <input id={idNombre} className="campo" value={a.nombre} maxLength={60} onChange={(e) => editar({ nombre: e.target.value })} />
      </label>
      <div>
        <span className="mb-1 block text-[13px] text-carbon-2">{tx("Tipo de nodo", "Node type")}</span>
        <Segmentado<TipoNodo>
          etiqueta={tx("Tipo de nodo", "Node type")}
          valor={a.tipo ?? "antena"}
          onCambio={(v) => editar({ tipo: v })}
          opciones={[
            { valor: "antena", texto: <><IconoTorre className="h-4 w-4" /> {tx("Nodo antena", "Antenna node")}</> },
            { valor: "nodo", texto: <><IconoEquipo className="h-4 w-4" /> {tx("Nodo", "Node")}</> },
          ]}
        />
        <span className="mt-1 block text-[12px] leading-snug text-tenue">{AYUDA_TIPO[a.tipo ?? "antena"]}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CampoCoordenada eje="lat" valor={a.lat} onCambio={(v) => editar({ lat: v })} onPar={(lat, lon) => editar({ lat, lon })} />
        <CampoCoordenada eje="lon" valor={a.lon} onCambio={(v) => editar({ lon: v })} onPar={(lat, lon) => editar({ lat, lon })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CampoNumero etiqueta={tx("Altura sobre el suelo", "Height above ground")} tour="altura" unidad="m" valor={a.alturaM} min={0.5} max={300} paso={1} onCambio={(v) => editar({ alturaM: v })} />
        <label htmlFor={idRol} className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">{tx("Rol en la malla", "Role in the mesh")}</span>
          <select id={idRol} className="campo" value={a.rol} onChange={(e) => editar({ rol: e.target.value as Rol })}>
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.texto}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[12px] leading-snug text-tenue">{ROLES.find((r) => r.valor === a.rol)?.ayuda}</span>
        </label>
      </div>
      <label htmlFor={idEquipo} className="block">
        <span className="mb-1 block text-[13px] text-carbon-2">{tx("Equipo y antena", "Device and antenna")}</span>
        <select id={idEquipo} className="campo" value={a.equipo} onChange={(e) => despachar({ tipo: "equipo", id: a.id, equipo: e.target.value as Antena["equipo"] })}>
          {EQUIPOS.map((q) => (
            <option key={q.id} value={q.id}>
              {q.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <CampoNumero etiqueta={tx("Potencia", "Power")} unidad="dBm" valor={a.potenciaDbm} min={0} max={36} onCambio={(v) => personal({ potenciaDbm: v })} />
        <CampoNumero etiqueta={tx("Ganancia", "Gain")} unidad="dBi" valor={a.gananciaDbi} min={-5} max={20} paso={0.5} onCambio={(v) => personal({ gananciaDbi: v })} />
        <CampoNumero etiqueta="Cable" unidad="dB" valor={a.perdidaCableDb} min={0} max={20} paso={0.5} onCambio={(v) => personal({ perdidaCableDb: v })} />
      </div>
      <div className="space-y-2" data-tour="patron">
        <label htmlFor={idPatron} className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">{tx("Tipo de antena", "Antenna type")}</span>
          <select
            id={idPatron}
            className="campo"
            value={a.patron ?? "omni"}
            onChange={(e) => {
              const id = e.target.value as PatronId;
              const nuevo = patronPorId(id);
              // Al pasar a direccional se propone su ganancia típica (se puede cambiar)
              if (id === "omni") editar({ patron: undefined, azimutDeg: undefined, elevacionDeg: undefined });
              else personal({ patron: id, gananciaDbi: nuevo.gananciaTipica, azimutDeg: a.azimutDeg ?? 0, elevacionDeg: a.elevacionDeg ?? 0 });
            }}
          >
            {PATRONES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
                {x.id !== "omni" ? ` (≈ ${tx(String(x.gananciaTipica).replace(".", ","), String(x.gananciaTipica))} dBi)` : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[12px] leading-snug text-tenue">
            {patron.descripcion}
            {direccional &&
              tx(
                ` Haz de ≈ ${Math.round(haz.h)}° en horizontal y ${Math.round(haz.v)}° en vertical; fuera del haz cae hasta ${patron.frenteEspaldaDb} dB.`,
                ` Beam of ≈ ${Math.round(haz.h)}° horizontal and ${Math.round(haz.v)}° vertical; outside the beam it drops up to ${patron.frenteEspaldaDb} dB.`,
              )}
          </span>
        </label>
        {direccional && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <CampoNumero
                etiqueta={tx("Azimut", "Azimuth")}
                unidad="°"
                valor={Math.round((a.azimutDeg ?? 0) * 10) / 10}
                min={0}
                max={360}
                paso={5}
                ayuda={tx(`Desde el norte, hacia el ${puntoCardinal(a.azimutDeg ?? 0)}`, `From north, toward the ${puntoCardinal(a.azimutDeg ?? 0)}`)}
                onCambio={(v) => editar({ azimutDeg: v % 360 })}
              />
              <CampoNumero
                etiqueta={tx("Elevación del haz", "Beam elevation")}
                unidad="°"
                valor={a.elevacionDeg ?? 0}
                min={-45}
                max={45}
                paso={1}
                ayuda={tx("0 = horizontal; negativo, hacia abajo", "0 = horizontal; negative, downward")}
                onCambio={(v) => editar({ elevacionDeg: v })}
              />
            </div>
            {otras.length > 0 && (
              <label htmlFor={idApuntar} className="flex items-center gap-2 text-[13px] text-carbon-2">
                <Navigation size={15} className="shrink-0" style={{ transform: `rotate(${(a.azimutDeg ?? 0) - 45}deg)` }} />
                <span className="shrink-0">{tx("Apuntar hacia", "Point toward")}</span>
                <select
                  id={idApuntar}
                  className="campo py-1"
                  value=""
                  onChange={(e) => {
                    const o = otras.find((x) => x.id === e.target.value);
                    if (o) editar({ azimutDeg: Math.round(rumbo(a.lat, a.lon, o.lat, o.lon) * 10) / 10 });
                  }}
                >
                  <option value="">{tx("Elegir nodo…", "Choose node…")}</option>
                  {otras.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre} ({Math.round(rumbo(a.lat, a.lon, o.lat, o.lon))}°)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>
      <div>
        <Interruptor
          etiqueta={tx("Pasarela", "Gateway")}
          detalle={tx("Conectada a internet o al servidor de la red", "Connected to the internet or to the network server")}
          activo={a.pasarela}
          onCambio={(v) => editar({ pasarela: v })}
        />
        <Interruptor etiqueta={tx("Incluir en la simulación", "Include in the simulation")} activo={a.activa} onCambio={(v) => editar({ activa: v })} />
      </div>

      {(resumen || nodo) && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-white p-2.5 text-[13px] ring-1 ring-linea">
          {resumen && (
            <>
              <dt className="text-tenue">{tx("Elevación del terreno", "Terrain elevation")}</dt>
              <dd className="text-right tabular-nums">{resumen.elevacionM} m</dd>
              <dt className="text-tenue">{tx("Alcance con servicio", "Range with service")}</dt>
              <dd className="text-right tabular-nums">
                {resumen.alcanceLimitado ? "≥ " : ""}
                {fmt(resumen.alcanceKm, 2)} km
              </dd>
              <dt className="text-tenue">{tx("Alcance confiable", "Reliable range")}</dt>
              <dd className="text-right tabular-nums">{fmt(resumen.alcanceConfiableKm, 2)} km</dd>
              <dt className="text-tenue">{tx("Área con servicio", "Area with service")}</dt>
              <dd className="text-right tabular-nums">{fmt(resumen.areaServicioKm2)} km²</dd>
            </>
          )}
          {nodo && !a.pasarela && (
            <>
              <dt className="text-tenue">{tx("Ruta a la pasarela", "Route to the gateway")}</dt>
              <dd className="text-right">{nodo.saltos === null ? tx("Sin ruta", "No route") : saltosTexto(nodo.saltos)}</dd>
              {nodo.ruta.length > 1 && (
                <dd className="col-span-2 text-[12px] text-carbon-2">
                  {nodo.ruta.map((id) => nombres.get(id)).join(" → ")}
                  {nodo.cuelloDb !== null && tx(` · enlace más débil ${fmt(nodo.cuelloDb)} dB`, ` · weakest link ${fmt(nodo.cuelloDb)} dB`)}
                </dd>
              )}
            </>
          )}
        </dl>
      )}

      {otras.length > 0 && (
        <div className="flex items-end gap-2" data-tour="radioenlace">
          <label htmlFor={idDestino} className="block min-w-0 flex-1">
            <span className="mb-1 block text-[13px] text-carbon-2">{tx("Perfil e informe del enlace hacia", "Link profile and report to")}</span>
            <select id={idDestino} className="campo" value={otras.some((o) => o.id === destino) ? destino : otras[0].id} onChange={(e) => setDestino(e.target.value)}>
              {otras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
          <Boton
            onClick={() => {
              const d = otras.find((o) => o.id === destino) ?? otras[0];
              onPerfil(a, d, true);
            }}
          >
            <Route size={16} /> {tx("Radioenlace", "Radio link")}
          </Boton>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Boton variante="fantasma" onClick={() => onCentrar(a.lat, a.lon)}>
          <LocateFixed size={16} /> {tx("Centrar", "Center")}
        </Boton>
        <Boton variante="fantasma" onClick={() => despachar({ tipo: "duplicar", id: a.id })}>
          <Copy size={16} /> {tx("Duplicar", "Duplicate")}
        </Boton>
        <Boton variante="peligro" onClick={() => despachar({ tipo: "eliminar", id: a.id })} className="ml-auto">
          <Trash size={16} /> {tx("Eliminar", "Delete")}
        </Boton>
      </div>
    </div>
  );
}

