"use client";

// Lista de nodos (nodos antena y nodos de campo), alta por coordenadas o en el mapa, y edición de cada uno.
import { Copy, Crosshair, Eye, EyeOff, LocateFixed, Navigation, Plus, Route, Trash, X } from "lucide-react";
import { useId, useState, type Dispatch } from "react";

import { EQUIPOS } from "@/lib/radio/constantes";
import { aDecimal, aGMS, leerCoordenada, leerPar, puntoCardinal, rumbo } from "@/lib/radio/geo";
import { anchosHaz, esDireccional, PATRONES, patronPorId } from "@/lib/radio/patron";
import type { Antena, PatronId, ResultadoSimulacion, Rol, TipoNodo } from "@/lib/radio/tipos";

import { NOMBRE_TIPO, type Accion, type Estado } from "./estado";
import { IconoEquipo, IconoNodo, IconoTorre } from "./icono-torre";
import { estadoNodo } from "./marcador";
import { Boton, CampoNumero, fmt, Interruptor, Segmentado } from "./ui";

const AYUDA_TIPO: Record<TipoNodo, string> = {
  antena: "Infraestructura en mástil o torre: genera el mapa de cobertura y su rango de alcance.",
  nodo: "Equipo de campo (portátil, sensor o poste bajo): no pinta cobertura; se evalúa su enlace con la malla.",
};

const COLOR_ESTADO = { "sin-simular": "#9AA19D", solida: "#1E7B34", debil: "#F08A2C", aislada: "#D93A2E", pasarela: "#2B2F2E" } as const;
const TEXTO_ESTADO = {
  "sin-simular": "Sin simular",
  solida: "Ruta sólida a la pasarela",
  debil: "Ruta débil a la pasarela",
  aislada: "Sin ruta a la pasarela",
  pasarela: "Pasarela",
} as const;

const ROLES: { valor: Rol; texto: string; ayuda: string }[] = [
  { valor: "REPETIDOR", texto: "Repetidor", ayuda: "Pasa los paquetes de los demás: el repetidor solar en su mástil." },
  { valor: "COMPANION", texto: "Companion", ayuda: "Envía y recibe lo suyo, sin retransmitir: la billetera o la radio del gateway." },
  { valor: "ROOM_SERVER", texto: "Room server", ayuda: "Guarda los mensajes para quien vuelva a conectarse; no retransmite." },
];

type Props = {
  estado: Estado;
  despachar: Dispatch<Accion>;
  resultado: ResultadoSimulacion | null;
  onCentrar: (lat: number, lon: number) => void;
  onPerfil: (tx: Antena, destino: Antena, informe?: boolean) => void;
};

export function PanelAntenas({ estado, despachar, resultado, onCentrar, onPerfil }: Props) {
  const antenas = estado.escenario.antenas;
  const [formulario, setFormulario] = useState(false);
  const nodos = new Map((resultado?.nodos ?? []).map((n) => [n.id, n]));
  const nAntenas = antenas.filter((a) => (a.tipo ?? "antena") === "antena").length;

  return (
    <div className="space-y-3">
      <div className="space-y-2" data-tour="agregar">
        <Segmentado<TipoNodo>
          etiqueta="Tipo de nodo que se agrega"
          valor={estado.tipoNuevo}
          onCambio={(v) => despachar({ tipo: "tipo-nuevo", valor: v })}
          opciones={[
            { valor: "antena", texto: <><IconoTorre className="h-4 w-4" /> Nodo antena</>, titulo: AYUDA_TIPO.antena },
            { valor: "nodo", texto: <><IconoEquipo className="h-4 w-4" /> Nodo</>, titulo: AYUDA_TIPO.nodo },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Boton
            variante={estado.herramienta === "agregar" ? "principal" : "secundario"}
            onClick={() => despachar({ tipo: "herramienta", herramienta: estado.herramienta === "agregar" ? "mover" : "agregar" })}
            titulo={`Haga clic en el mapa para ubicar el ${NOMBRE_TIPO[estado.tipoNuevo].toLowerCase()}`}
          >
            <Crosshair size={16} /> {estado.herramienta === "agregar" ? "Clic en el mapa…" : "Ubicar en el mapa"}
          </Boton>
          <Boton variante={formulario ? "principal" : "secundario"} onClick={() => setFormulario((v) => !v)}>
            <Plus size={16} /> Por coordenadas
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
          Agregue el primer nodo antena: haga clic en <b>Ubicar en el mapa</b>, escriba sus coordenadas o pídaselo a Melki, por ejemplo «inscribe un nodo antena en 4.5123, -73.1234». El primer nodo antena queda como pasarela.
        </p>
      ) : (
        <>
        {nAntenas === 0 && (
          <p className="rounded-lg bg-melki-clara/60 px-3 py-2 text-[13px] leading-snug text-carbon-2">Aún no hay nodos antena: los nodos de campo no generan cobertura. Agregue al menos un nodo antena para ver el mapa de señal.</p>
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
                          {(a.tipo ?? "antena") === "nodo" ? "Nodo" : "Antena"}
                        </span>
                      </span>
                      <span className="block truncate text-[12px] text-tenue">
                        {fmt(a.alturaM, a.alturaM % 1 ? 1 : 0)} m · {fmt(a.gananciaDbi)} dBi
                        {esDireccional(a) ? ` ${patronPorId(a.patron).nombre.toLowerCase()} a ${Math.round(a.azimutDeg ?? 0)}°` : ""} ·{" "}
                        {a.pasarela ? "gateway" : a.rol === "REPETIDOR" ? "retransmite" : "no retransmite"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-carbon-2 hover:bg-black/5"
                    title={a.activa ? "Excluir de la simulación" : "Incluir en la simulación"}
                    aria-label={a.activa ? `Excluir ${a.nombre} de la simulación` : `Incluir ${a.nombre} en la simulación`}
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
  const id = useId();
  const [borrador, setBorrador] = useState<string | null>(null);
  const texto = borrador ?? aDecimal(valor);
  const leido = leerCoordenada(texto, eje);
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-[13px] text-carbon-2">{eje === "lat" ? "Latitud" : "Longitud"}</span>
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
      <span className="mt-1 block text-[12px] text-tenue tabular-nums">{leido !== null ? aGMS(leido, eje) : "Formato no reconocido"}</span>
    </label>
  );
}

function FormularioCoordenadas({ tipo, onAgregar, onCerrar }: { tipo: TipoNodo; onAgregar: (lat: number, lon: number, nombre: string, alturaM: number) => void; onCerrar: () => void }) {
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
        <p className="font-cond text-[15px] font-semibold">Nuevo {NOMBRE_TIPO[tipo].toLowerCase()} por coordenadas</p>
        <button type="button" className="rounded p-1 text-tenue hover:bg-black/5" onClick={onCerrar} aria-label="Cerrar formulario">
          <X size={16} />
        </button>
      </div>
      <p className="text-[12px] leading-snug text-tenue">Grados decimales (4.5123, -73.1234) o grados, minutos y segundos (4°30&apos;44&quot; N, 73°07&apos;24&quot; O). Puede pegar el par completo en cualquiera de los dos campos.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">Latitud</span>
          <input className="campo tabular-nums" value={lat} onChange={(e) => pegar(e.target.value, setLat)} aria-invalid={lat !== "" && vLat === null} placeholder="4.5123" spellCheck={false} />
          <span className="mt-1 block text-[12px] text-tenue tabular-nums">{vLat !== null ? aGMS(vLat, "lat") : " "}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">Longitud</span>
          <input className="campo tabular-nums" value={lon} onChange={(e) => pegar(e.target.value, setLon)} aria-invalid={lon !== "" && vLon === null} placeholder="-73.1234" spellCheck={false} />
          <span className="mt-1 block text-[12px] text-tenue tabular-nums">{vLon !== null ? aGMS(vLon, "lon") : " "}</span>
        </label>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <label className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">Nombre (opcional)</span>
          <input className="campo" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === "antena" ? "Torre norte" : "Portátil 1"} />
        </label>
        <CampoNumero etiqueta="Altura" unidad="m" valor={altura} min={0.5} max={300} onCambio={setAltura} />
      </div>
      <button type="submit" disabled={!listo} className="w-full rounded-lg bg-carbon py-2 text-[14px] font-medium text-white disabled:bg-carbon/40">
        Agregar {NOMBRE_TIPO[tipo].toLowerCase()}
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
        <span className="mb-1 block text-[13px] text-carbon-2">Nombre</span>
        <input id={idNombre} className="campo" value={a.nombre} maxLength={60} onChange={(e) => editar({ nombre: e.target.value })} />
      </label>
      <div>
        <span className="mb-1 block text-[13px] text-carbon-2">Tipo de nodo</span>
        <Segmentado<TipoNodo>
          etiqueta="Tipo de nodo"
          valor={a.tipo ?? "antena"}
          onCambio={(v) => editar({ tipo: v })}
          opciones={[
            { valor: "antena", texto: <><IconoTorre className="h-4 w-4" /> Nodo antena</> },
            { valor: "nodo", texto: <><IconoEquipo className="h-4 w-4" /> Nodo</> },
          ]}
        />
        <span className="mt-1 block text-[12px] leading-snug text-tenue">{AYUDA_TIPO[a.tipo ?? "antena"]}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CampoCoordenada eje="lat" valor={a.lat} onCambio={(v) => editar({ lat: v })} onPar={(lat, lon) => editar({ lat, lon })} />
        <CampoCoordenada eje="lon" valor={a.lon} onCambio={(v) => editar({ lon: v })} onPar={(lat, lon) => editar({ lat, lon })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CampoNumero etiqueta="Altura sobre el suelo" tour="altura" unidad="m" valor={a.alturaM} min={0.5} max={300} paso={1} onCambio={(v) => editar({ alturaM: v })} />
        <label htmlFor={idRol} className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">Rol en la malla</span>
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
        <span className="mb-1 block text-[13px] text-carbon-2">Equipo y antena</span>
        <select id={idEquipo} className="campo" value={a.equipo} onChange={(e) => despachar({ tipo: "equipo", id: a.id, equipo: e.target.value as Antena["equipo"] })}>
          {EQUIPOS.map((q) => (
            <option key={q.id} value={q.id}>
              {q.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <CampoNumero etiqueta="Potencia" unidad="dBm" valor={a.potenciaDbm} min={0} max={36} onCambio={(v) => personal({ potenciaDbm: v })} />
        <CampoNumero etiqueta="Ganancia" unidad="dBi" valor={a.gananciaDbi} min={-5} max={20} paso={0.5} onCambio={(v) => personal({ gananciaDbi: v })} />
        <CampoNumero etiqueta="Cable" unidad="dB" valor={a.perdidaCableDb} min={0} max={20} paso={0.5} onCambio={(v) => personal({ perdidaCableDb: v })} />
      </div>
      <div className="space-y-2" data-tour="patron">
        <label htmlFor={idPatron} className="block">
          <span className="mb-1 block text-[13px] text-carbon-2">Tipo de antena</span>
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
                {x.id !== "omni" ? ` (≈ ${String(x.gananciaTipica).replace(".", ",")} dBi)` : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[12px] leading-snug text-tenue">
            {patron.descripcion}
            {direccional && ` Haz de ≈ ${Math.round(haz.h)}° en horizontal y ${Math.round(haz.v)}° en vertical; fuera del haz cae hasta ${patron.frenteEspaldaDb} dB.`}
          </span>
        </label>
        {direccional && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <CampoNumero
                etiqueta="Azimut"
                unidad="°"
                valor={Math.round((a.azimutDeg ?? 0) * 10) / 10}
                min={0}
                max={360}
                paso={5}
                ayuda={`Desde el norte, hacia el ${puntoCardinal(a.azimutDeg ?? 0)}`}
                onCambio={(v) => editar({ azimutDeg: v % 360 })}
              />
              <CampoNumero
                etiqueta="Elevación del haz"
                unidad="°"
                valor={a.elevacionDeg ?? 0}
                min={-45}
                max={45}
                paso={1}
                ayuda="0 = horizontal; negativo, hacia abajo"
                onCambio={(v) => editar({ elevacionDeg: v })}
              />
            </div>
            {otras.length > 0 && (
              <label htmlFor={idApuntar} className="flex items-center gap-2 text-[13px] text-carbon-2">
                <Navigation size={15} className="shrink-0" style={{ transform: `rotate(${(a.azimutDeg ?? 0) - 45}deg)` }} />
                <span className="shrink-0">Apuntar hacia</span>
                <select
                  id={idApuntar}
                  className="campo py-1"
                  value=""
                  onChange={(e) => {
                    const o = otras.find((x) => x.id === e.target.value);
                    if (o) editar({ azimutDeg: Math.round(rumbo(a.lat, a.lon, o.lat, o.lon) * 10) / 10 });
                  }}
                >
                  <option value="">Elegir nodo…</option>
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
        <Interruptor etiqueta="Pasarela" detalle="Conectada a internet o al servidor de la red" activo={a.pasarela} onCambio={(v) => editar({ pasarela: v })} />
        <Interruptor etiqueta="Incluir en la simulación" activo={a.activa} onCambio={(v) => editar({ activa: v })} />
      </div>

      {(resumen || nodo) && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-white p-2.5 text-[13px] ring-1 ring-linea">
          {resumen && (
            <>
              <dt className="text-tenue">Elevación del terreno</dt>
              <dd className="text-right tabular-nums">{resumen.elevacionM} m</dd>
              <dt className="text-tenue">Alcance con servicio</dt>
              <dd className="text-right tabular-nums">
                {resumen.alcanceLimitado ? "≥ " : ""}
                {fmt(resumen.alcanceKm, 2)} km
              </dd>
              <dt className="text-tenue">Alcance confiable</dt>
              <dd className="text-right tabular-nums">{fmt(resumen.alcanceConfiableKm, 2)} km</dd>
              <dt className="text-tenue">Área con servicio</dt>
              <dd className="text-right tabular-nums">{fmt(resumen.areaServicioKm2)} km²</dd>
            </>
          )}
          {nodo && !a.pasarela && (
            <>
              <dt className="text-tenue">Ruta a la pasarela</dt>
              <dd className="text-right">{nodo.saltos === null ? "Sin ruta" : `${nodo.saltos} ${nodo.saltos === 1 ? "salto" : "saltos"}`}</dd>
              {nodo.ruta.length > 1 && (
                <dd className="col-span-2 text-[12px] text-carbon-2">
                  {nodo.ruta.map((id) => nombres.get(id)).join(" → ")}
                  {nodo.cuelloDb !== null && ` · enlace más débil ${fmt(nodo.cuelloDb)} dB`}
                </dd>
              )}
            </>
          )}
        </dl>
      )}

      {otras.length > 0 && (
        <div className="flex items-end gap-2" data-tour="radioenlace">
          <label htmlFor={idDestino} className="block min-w-0 flex-1">
            <span className="mb-1 block text-[13px] text-carbon-2">Perfil e informe del enlace hacia</span>
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
            <Route size={16} /> Radioenlace
          </Boton>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Boton variante="fantasma" onClick={() => onCentrar(a.lat, a.lon)}>
          <LocateFixed size={16} /> Centrar
        </Boton>
        <Boton variante="fantasma" onClick={() => despachar({ tipo: "duplicar", id: a.id })}>
          <Copy size={16} /> Duplicar
        </Boton>
        <Boton variante="peligro" onClick={() => despachar({ tipo: "eliminar", id: a.id })} className="ml-auto">
          <Trash size={16} /> Eliminar
        </Boton>
      </div>
    </div>
  );
}

