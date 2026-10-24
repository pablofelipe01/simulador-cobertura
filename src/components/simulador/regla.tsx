// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Regla de medición (como en Google Earth): línea, trayecto o área; distancias por tramo, rumbo, total y área.
// Las mediciones se guardan con el escenario y se editan en el mapa: arrastrar un punto lo mueve, arrastrar
// el punto medio de un tramo agrega uno nuevo y el clic derecho (o doble clic) sobre un punto lo borra.
import maplibregl, { type GeoJSONSource, type Map as MapaML, type MapMouseEvent, type Marker } from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import { Eye, EyeOff, LocateFixed, Mountain, Ruler, Trash, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";

import { areaPoligonoM2, distanciaM, formatoArea, formatoDistancia, longitudRutaM, rumbo, rumboTexto } from "@/lib/radio/geo";
import type { Medicion, TipoMedicion } from "@/lib/radio/tipos";

import type { Accion, Estado } from "./estado";
import { nuevoId } from "./estado";
import { Segmentado } from "./ui";

type Punto = [number, number];
const COLOR = "#1FC8F0";
const NOMBRES: Record<TipoMedicion, string> = { linea: "Línea", trayecto: "Trayecto", area: "Área" };
const VACIO: FeatureCollection = { type: "FeatureCollection", features: [] };

export function resumenMedicion(m: { tipo: TipoMedicion; puntos: Punto[] }) {
  const area = m.tipo === "area";
  const longitud = longitudRutaM(m.puntos, area);
  const tramos = m.puntos.slice(1).map((b, i) => ({
    distancia: distanciaM(m.puntos[i][1], m.puntos[i][0], b[1], b[0]),
    rumbo: rumbo(m.puntos[i][1], m.puntos[i][0], b[1], b[0]),
  }));
  return { longitud, area: area ? areaPoligonoM2(m.puntos) : 0, tramos };
}

export function textoMedicion(m: { tipo: TipoMedicion; puntos: Punto[] }) {
  const r = resumenMedicion(m);
  if (m.tipo === "area") return m.puntos.length >= 3 ? `${formatoArea(r.area)} · perímetro ${formatoDistancia(r.longitud)}` : formatoDistancia(r.longitud);
  if (m.tipo === "linea" && r.tramos[0]) return `${formatoDistancia(r.longitud)} · rumbo ${rumboTexto(r.tramos[0].rumbo)}`;
  return formatoDistancia(r.longitud);
}

function geometria(m: { tipo: TipoMedicion; puntos: Punto[] }, props: Record<string, unknown>): Feature[] {
  const f: Feature[] = [];
  if (m.tipo === "area" && m.puntos.length >= 3) {
    f.push({ type: "Feature", properties: { ...props, relleno: true }, geometry: { type: "Polygon", coordinates: [[...m.puntos, m.puntos[0]]] } });
    f.push({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: [...m.puntos, m.puntos[0]] } });
  } else if (m.puntos.length >= 2) f.push({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: m.puntos } });
  return f;
}

function nuevoNombre(tipo: TipoMedicion, existentes: Medicion[]) {
  let n = existentes.filter((m) => m.tipo === tipo).length + 1;
  while (existentes.some((m) => m.nombre === `${NOMBRES[tipo]} ${n}`)) n++;
  return `${NOMBRES[tipo]} ${n}`;
}

const esCampoDeTexto = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

type Props = {
  mapa: MapaML | null;
  estado: Estado;
  despachar: Dispatch<Accion>;
  onPerfil: (m: Medicion) => void;
  onCentrar: (caja: [number, number, number, number]) => void;
  /** Primer punto puesto desde fuera (menú «Medir desde aquí»); «n» cambia en cada pedido. */
  semilla?: { n: number; punto: Punto } | null;
};

export function Regla({ mapa, estado, despachar, onPerfil, onCentrar, semilla }: Props) {
  const activa = estado.herramienta === "regla";
  const tipo = estado.reglaTipo;
  const mediciones = estado.escenario.mediciones;
  const seleccion = mediciones.find((m) => m.id === estado.medicionSel) ?? null;
  const [borrador, setBorrador] = useState<Punto[]>([]);
  const [cursor, setCursor] = useState<Punto | null>(null);
  // Un pedido nuevo de «Medir desde aquí» arranca el borrador en ese punto
  const [semillaVista, setSemillaVista] = useState(0);
  if (semilla && semilla.n !== semillaVista) {
    setSemillaVista(semilla.n);
    setBorrador([semilla.punto]);
  }
  const etiquetas = useRef(new Map<string, Marker>());
  const manijas = useRef<Marker[]>([]);
  const actual = useRef({ borrador, tipo, activa, mediciones, despachar });
  useEffect(() => {
    actual.current = { borrador, tipo, activa, mediciones, despachar };
  });

  const terminar = (puntos: Punto[] = actual.current.borrador) => {
    const { tipo: t, mediciones: ms, despachar: d } = actual.current;
    // El doble clic agrega dos veces el último punto: se quitan los repetidos
    const limpios = puntos.filter((q, i) => i === 0 || distanciaM(q[1], q[0], puntos[i - 1][1], puntos[i - 1][0]) > 0.5);
    if (limpios.length >= (t === "area" ? 3 : 2)) {
      d({ tipo: "medicion-agregar", medicion: { id: nuevoId("m"), nombre: nuevoNombre(t, ms), tipo: t, puntos: limpios, visible: true } });
    }
    setBorrador([]);
  };

  // Capas propias de la regla
  useEffect(() => {
    if (!mapa) return;
    const crear = () => {
      if (mapa.getSource("mediciones")) return;
      mapa.addSource("mediciones", { type: "geojson", data: VACIO });
      mapa.addSource("regla-borrador", { type: "geojson", data: VACIO });
      mapa.addLayer({ id: "mediciones-relleno", type: "fill", source: "mediciones", filter: ["has", "relleno"], paint: { "fill-color": COLOR, "fill-opacity": 0.14 } });
      mapa.addLayer({
        id: "mediciones-halo",
        type: "line",
        source: "mediciones",
        filter: ["!", ["has", "relleno"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0E2A33", "line-width": ["case", ["get", "sel"], 7, 5], "line-opacity": 0.55 },
      });
      mapa.addLayer({
        id: "mediciones-linea",
        type: "line",
        source: "mediciones",
        filter: ["!", ["has", "relleno"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLOR, "line-width": ["case", ["get", "sel"], 3.6, 2.4] },
      });
      mapa.addLayer({
        id: "regla-borrador",
        type: "line",
        source: "regla-borrador",
        layout: { "line-cap": "round" },
        paint: { "line-color": "#FFFFFF", "line-width": 2.4, "line-dasharray": [2, 1.5] },
      });
    };
    const intentar = () => {
      try {
        crear();
        return true;
      } catch {
        return false;
      }
    };
    if (!intentar()) mapa.once("styledata", intentar);
    const alClicLinea = (e: MapMouseEvent & { features?: { properties: Record<string, unknown> }[] }) => {
      if (actual.current.activa) return;
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") actual.current.despachar({ tipo: "medicion-seleccionar", id });
    };
    mapa.on("click", "mediciones-linea", alClicLinea);
    return () => {
      mapa.off("click", "mediciones-linea", alClicLinea);
    };
  }, [mapa]);

  // Interacción mientras la herramienta está activa
  useEffect(() => {
    if (!mapa || !activa) return;
    mapa.doubleClickZoom.disable();
    let marco = 0;
    const clic = (e: MapMouseEvent) => {
      const p: Punto = [e.lngLat.lng, e.lngLat.lat];
      const siguiente = [...actual.current.borrador, p];
      if (actual.current.tipo === "linea" && siguiente.length === 2) terminar(siguiente);
      else setBorrador(siguiente);
    };
    const mover = (e: MapMouseEvent) => {
      cancelAnimationFrame(marco);
      const p: Punto = [e.lngLat.lng, e.lngLat.lat];
      marco = requestAnimationFrame(() => setCursor(p));
    };
    const doble = (e: MapMouseEvent) => {
      e.preventDefault();
      terminar();
    };
    const teclas = (e: KeyboardEvent) => {
      if (esCampoDeTexto(e.target)) return;
      if (e.key === "Enter") terminar();
      else if (e.key === "Escape") setBorrador([]);
      else if (e.key === "Backspace" && actual.current.borrador.length) {
        e.preventDefault();
        setBorrador((b) => b.slice(0, -1));
      }
    };
    mapa.on("click", clic);
    mapa.on("mousemove", mover);
    mapa.on("dblclick", doble);
    window.addEventListener("keydown", teclas);
    return () => {
      cancelAnimationFrame(marco);
      mapa.off("click", clic);
      mapa.off("mousemove", mover);
      mapa.off("dblclick", doble);
      window.removeEventListener("keydown", teclas);
      mapa.doubleClickZoom.enable();
    };
  }, [mapa, activa]);

  // Al salir de la regla, se guarda el dibujo si está completo
  const previaActiva = useRef(activa);
  useEffect(() => {
    if (previaActiva.current && !activa && actual.current.borrador.length) terminar();
    previaActiva.current = activa;
  }, [activa]);

  // Dibujar mediciones guardadas y borrador
  const vistaPrevia = useMemo(() => (activa && cursor && borrador.length ? [...borrador, cursor] : borrador), [activa, cursor, borrador]);
  useEffect(() => {
    if (!mapa || !mapa.getSource("mediciones")) return;
    const fs: Feature[] = [];
    for (const m of mediciones) if (m.visible || m.id === estado.medicionSel) fs.push(...geometria(m, { id: m.id, sel: m.id === estado.medicionSel }));
    (mapa.getSource("mediciones") as GeoJSONSource).setData({ type: "FeatureCollection", features: fs });
    const borradorFs = vistaPrevia.length >= 2 ? geometria({ tipo, puntos: vistaPrevia }, {}).filter((f) => f.geometry.type === "LineString") : [];
    (mapa.getSource("regla-borrador") as GeoJSONSource).setData({ type: "FeatureCollection", features: borradorFs });

    // Etiquetas: total de cada medición visible, tramos de la seleccionada y del borrador
    const lista: { clave: string; lonlat: Punto; texto: string; clase: string }[] = [];
    for (const m of mediciones) {
      if (!m.visible && m.id !== estado.medicionSel) continue;
      const ult = m.tipo === "area" ? centroide(m.puntos) : m.puntos[m.puntos.length - 1];
      lista.push({ clave: `t:${m.id}`, lonlat: ult, texto: `${m.nombre} · ${textoMedicion(m).split(" · ")[0]}`, clase: "regla-total" });
    }
    const conTramos = (puntos: Punto[], prefijo: string, cerrada: boolean) => {
      const ps = cerrada && puntos.length >= 3 ? [...puntos, puntos[0]] : puntos;
      for (let i = 1; i < ps.length; i++) {
        const d = distanciaM(ps[i - 1][1], ps[i - 1][0], ps[i][1], ps[i][0]);
        if (d < 1) continue;
        lista.push({ clave: `${prefijo}:${i}`, lonlat: [(ps[i - 1][0] + ps[i][0]) / 2, (ps[i - 1][1] + ps[i][1]) / 2], texto: formatoDistancia(d), clase: "regla-tramo" });
      }
    };
    if (seleccion && seleccion.puntos.length > 2) conTramos(seleccion.puntos, `s:${seleccion.id}`, seleccion.tipo === "area");
    if (vistaPrevia.length >= 2) {
      conTramos(vistaPrevia, "b", false);
      const r = resumenMedicion({ tipo, puntos: vistaPrevia });
      const total = tipo === "area" && vistaPrevia.length >= 3 ? formatoArea(r.area) : formatoDistancia(r.longitud);
      lista.push({ clave: "b:total", lonlat: vistaPrevia[vistaPrevia.length - 1], texto: total, clase: "regla-total regla-vivo" });
    }
    const vivas = etiquetas.current;
    const claves = new Set(lista.map((e) => e.clave));
    for (const [k, mk] of vivas) {
      if (!claves.has(k)) {
        mk.remove();
        vivas.delete(k);
      }
    }
    for (const e of lista) {
      const mk = vivas.get(e.clave);
      if (mk) {
        mk.setLngLat(e.lonlat);
        const el = mk.getElement();
        if (el.textContent !== e.texto) el.textContent = e.texto;
        continue;
      }
      const el = document.createElement("div");
      el.className = `etiqueta-mapa ${e.clase}`;
      el.textContent = e.texto;
      vivas.set(e.clave, new maplibregl.Marker({ element: el, anchor: e.clase.startsWith("regla-total") ? "bottom-left" : "center", offset: e.clase.startsWith("regla-total") ? [8, -6] : [0, 0] }).setLngLat(e.lonlat).addTo(mapa));
    }
  }, [mapa, mediciones, estado.medicionSel, vistaPrevia, tipo, seleccion]);

  // Manijas para editar la medición seleccionada
  useEffect(() => {
    for (const mk of manijas.current) mk.remove();
    manijas.current = [];
    if (!mapa || !seleccion) return;
    const puntos = seleccion.puntos;
    const minimo = seleccion.tipo === "area" ? 3 : 2;
    const guardar = (nuevos: Punto[]) => despachar({ tipo: "medicion-editar", id: seleccion.id, cambios: { puntos: nuevos } });
    puntos.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "manija-regla";
      el.title = "Arrastre para mover · clic derecho o doble clic para borrar";
      const borrar = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (puntos.length > minimo) guardar(puntos.filter((_, k) => k !== i));
      };
      el.addEventListener("contextmenu", borrar);
      el.addEventListener("dblclick", borrar);
      const mk = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(p).addTo(mapa);
      mk.on("dragend", () => {
        const q = mk.getLngLat();
        guardar(puntos.map((x, k) => (k === i ? [q.lng, q.lat] : x)));
      });
      manijas.current.push(mk);
    });
    const tramos = seleccion.tipo === "area" ? puntos.length : puntos.length - 1;
    for (let i = 0; i < tramos; i++) {
      const a = puntos[i];
      const b = puntos[(i + 1) % puntos.length];
      const el = document.createElement("div");
      el.className = "manija-regla media";
      el.title = "Arrastre para agregar un punto";
      const mk = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]).addTo(mapa);
      mk.on("dragend", () => {
        const q = mk.getLngLat();
        const nuevos = [...puntos];
        nuevos.splice(i + 1, 0, [q.lng, q.lat]);
        guardar(nuevos);
      });
      manijas.current.push(mk);
    }
    return () => {
      for (const mk of manijas.current) mk.remove();
      manijas.current = [];
    };
  }, [mapa, seleccion, despachar]);

  if (!activa && !seleccion) return null;

  const enCurso = vistaPrevia.length >= 2 ? resumenMedicion({ tipo, puntos: vistaPrevia }) : null;
  const lista = mediciones;

  return (
    <section
      className="pointer-events-auto absolute top-28 left-3 z-20 flex max-h-[calc(100%-190px)] sm:top-16 sm:max-h-[calc(100%-150px)] w-[min(330px,calc(100%-24px))] flex-col overflow-hidden rounded-xl bg-white text-carbon shadow-lg ring-1 ring-black/10"
      aria-label="Regla de medición"
      data-tour="regla"
    >
      <header className="flex items-center gap-2 border-b border-linea px-3 py-2">
        <Ruler size={17} className="text-salvia-oscura" />
        <h2 className="flex-1 font-cond text-[16px] font-semibold">Regla</h2>
        <button
          type="button"
          className="rounded p-1 text-tenue hover:bg-black/5"
          aria-label="Cerrar la regla"
          onClick={() => {
            despachar({ tipo: "medicion-seleccionar", id: null });
            if (activa) despachar({ tipo: "herramienta", herramienta: "mover" });
          }}
        >
          <X size={16} />
        </button>
      </header>

      <div className="desplazable space-y-3 overflow-y-auto p-3">
        {activa ? (
          <div className="space-y-2">
            <Segmentado<TipoMedicion>
              etiqueta="Tipo de medición"
              valor={tipo}
              onCambio={(t) => {
                despachar({ tipo: "regla-tipo", valor: t });
                setBorrador([]);
              }}
              opciones={[
                { valor: "linea", texto: "Línea", titulo: "Dos puntos: distancia y rumbo" },
                { valor: "trayecto", texto: "Trayecto", titulo: "Varios puntos: distancia total" },
                { valor: "area", texto: "Área", titulo: "Polígono: área y perímetro" },
              ]}
            />
            <div className="rounded-lg bg-papel px-2.5 py-2">
              {enCurso ? (
                <>
                  <p className="font-cond text-[22px] leading-tight font-semibold tabular-nums">
                    {tipo === "area" && vistaPrevia.length >= 3 ? formatoArea(enCurso.area) : formatoDistancia(enCurso.longitud)}
                  </p>
                  <p className="text-[12px] text-tenue">
                    {tipo === "linea" && enCurso.tramos[0]
                      ? `Rumbo ${rumboTexto(enCurso.tramos[0].rumbo)}`
                      : tipo === "area"
                        ? `Perímetro ${formatoDistancia(longitudRutaM(vistaPrevia, true))} · ${vistaPrevia.length} puntos`
                        : `${vistaPrevia.length} puntos · ${enCurso.tramos.length} tramos`}
                  </p>
                </>
              ) : (
                <p className="text-[13px] leading-snug text-carbon-2">
                  {tipo === "linea" ? "Haga clic en el punto de inicio y luego en el de llegada." : "Haga clic para agregar puntos; doble clic o Enter para terminar."}
                </p>
              )}
              <p className="mt-1 text-[11.5px] leading-snug text-tenue">Esc cancela · Retroceso borra el último punto</p>
            </div>
            {borrador.length > 0 && (
              <div className="flex gap-1.5">
                {tipo !== "linea" && (
                  <button type="button" onClick={() => terminar()} className="rounded-lg bg-carbon px-3 py-1.5 text-[13px] font-medium text-white hover:bg-carbon-2">
                    Terminar
                  </button>
                )}
                <button type="button" onClick={() => setBorrador((b) => b.slice(0, -1))} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] ring-1 ring-linea hover:bg-papel-2">
                  <Undo2 size={14} /> Quitar punto
                </button>
                <button type="button" onClick={() => setBorrador([])} className="rounded-lg px-2.5 py-1.5 text-[13px] text-carbon-2 hover:bg-black/5">
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => despachar({ tipo: "herramienta", herramienta: "regla" })} className="w-full rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 ring-linea hover:bg-papel-2">
            Medir otra distancia
          </button>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-cond text-[14px] font-semibold">Mediciones ({lista.length})</p>
            {lista.length > 1 && (
              <button type="button" className="text-[12px] text-sin hover:underline" onClick={() => despachar({ tipo: "mediciones-borrar" })}>
                Borrar todas
              </button>
            )}
          </div>
          {lista.length === 0 ? (
            <p className="text-[12.5px] text-tenue">Aún no hay mediciones guardadas.</p>
          ) : (
            <ul className="space-y-1.5">
              {lista.map((m) => {
                const sel = m.id === estado.medicionSel;
                const r = resumenMedicion(m);
                return (
                  <li key={m.id} className={`rounded-lg ring-1 ${sel ? "bg-salvia-clara/50 ring-salvia" : "ring-linea"}`}>
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => despachar({ tipo: "medicion-seleccionar", id: sel ? null : m.id })}
                        aria-expanded={sel}
                      >
                        <span className="block truncate text-[13.5px] font-medium">{m.nombre}</span>
                        <span className="block truncate text-[12px] text-tenue tabular-nums">{textoMedicion(m)}</span>
                      </button>
                      <button type="button" className="rounded p-1 text-carbon-2 hover:bg-black/5" title={m.visible ? "Ocultar" : "Mostrar"} aria-label={m.visible ? `Ocultar ${m.nombre}` : `Mostrar ${m.nombre}`} onClick={() => despachar({ tipo: "medicion-editar", id: m.id, cambios: { visible: !m.visible } })}>
                        {m.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-carbon-2 hover:bg-black/5"
                        title="Ver en el mapa"
                        aria-label={`Ver ${m.nombre} en el mapa`}
                        onClick={() => {
                          const lons = m.puntos.map((q) => q[0]);
                          const lats = m.puntos.map((q) => q[1]);
                          onCentrar([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);
                        }}
                      >
                        <LocateFixed size={15} />
                      </button>
                      {m.tipo !== "area" && (
                        <button type="button" className="rounded p-1 text-carbon-2 hover:bg-black/5" title="Perfil del terreno" aria-label={`Perfil del terreno de ${m.nombre}`} onClick={() => onPerfil(m)}>
                          <Mountain size={15} />
                        </button>
                      )}
                      <button type="button" className="rounded p-1 text-sin hover:bg-sin/10" title="Borrar" aria-label={`Borrar ${m.nombre}`} onClick={() => despachar({ tipo: "medicion-eliminar", id: m.id })}>
                        <Trash size={15} />
                      </button>
                    </div>
                    {sel && (
                      <div className="space-y-1.5 border-t border-linea px-2 pt-1.5 pb-2">
                        <label className="block">
                          <span className="mb-0.5 block text-[12px] text-carbon-2">Nombre</span>
                          <input
                            className="campo"
                            value={m.nombre}
                            maxLength={60}
                            onChange={(e) => despachar({ tipo: "medicion-editar", id: m.id, cambios: { nombre: e.target.value } })}
                          />
                        </label>
                        <ol className="space-y-0.5 text-[12px] tabular-nums">
                          {r.tramos.map((t, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span className="text-tenue">Tramo {i + 1}</span>
                              <span>
                                {formatoDistancia(t.distancia)} · {rumboTexto(t.rumbo)}
                              </span>
                            </li>
                          ))}
                          {m.tipo === "area" && m.puntos.length >= 3 && (
                            <li className="flex justify-between gap-2 border-t border-linea pt-0.5">
                              <span className="text-tenue">Área</span>
                              <span>{formatoArea(r.area)}</span>
                            </li>
                          )}
                        </ol>
                        <p className="text-[11.5px] leading-snug text-tenue">Arrastre un punto para moverlo, el punto medio de un tramo para agregar uno, y clic derecho o doble clic sobre un punto para borrarlo.</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function centroide(puntos: Punto[]): Punto {
  const n = puntos.length || 1;
  return [puntos.reduce((s, p) => s + p[0], 0) / n, puntos.reduce((s, p) => s + p[1], 0) / n];
}

/** Crea una medición de línea entre dos puntos (la usa Melki). */
export function medicionLinea(a: Punto, b: Punto, nombre: string): Medicion {
  return { id: nuevoId("m"), nombre, tipo: "linea", puntos: [a, b], visible: true };
}
