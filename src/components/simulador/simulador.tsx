"use client";

// Pantalla principal del simulador: estado, motor de cálculo, mapa, paneles, regla, buscador y Melki.
import type { Map as MapaML } from "maplibre-gl";
import { Play, RadioTower, SlidersHorizontal, Square, Waypoints } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { Melki } from "@/components/melki/melki";
import { Recorrido } from "@/components/melki/recorrido";
import type { AccionMelki } from "@/components/melki/cerebro";
import type { Api } from "@/components/melki/ordenes";
import { avisarMelki, tourPorId, type ApiTour, type IdTour, type Preparacion } from "@/components/melki/tours";
import { CONFIG } from "@/lib/config";
import { buscarLugares, cargarReferencia, textoUbicacion } from "@/lib/geo/referencia";
import { EQUIPOS } from "@/lib/radio/constantes";
import { metrosPorGrado } from "@/lib/radio/geo";
import { MotorCobertura } from "@/lib/radio/cliente";
import type { Fase } from "@/lib/radio/protocolo";
import type { Inspeccion } from "@/lib/radio/simulacion";
import type { Antena, Escenario, FuenteRelieve, Medicion, Perfil, PerfilTerreno, ResultadoSimulacion, TipoNodo } from "@/lib/radio/tipos";

import { BarraSuperior } from "./barra-superior";
import { Buscador, type Destino } from "./buscador";
import { BarraMapa, Inspector, Leyenda } from "./controles-mapa";
import {
  escenarioEjemplo,
  escenarioVacio,
  estadoInicial,
  guardar,
  guardarRespaldo,
  leerGuardado,
  nuevaAntena,
  quitarRespaldo,
  reductor,
  validarEscenario,
  VISTA_DEFECTO,
  type Guardado,
  type TipoRelieve,
} from "./estado";
import { exportarCsv, exportarJson, exportarKmz } from "./exportar";
import { Mapa, type PuntoMapa, type SolicitudVista } from "./mapa";
import { PanelAntenas } from "./panel-antenas";
import { PanelParametros } from "./panel-parametros";
import { PanelResultados } from "./panel-resultados";
import { PerfilEnlace } from "./perfil-enlace";
import { PerfilTerrenoPanel } from "./perfil-terreno";
import { CoordenadasCursor, MenuContextual, TarjetaNodo, TarjetaPunto, type AccionPunto } from "./puntos-mapa";
import { Regla } from "./regla";
import { Interruptor } from "./ui";

type Pestana = "antenas" | "parametros";
type Hoja = Pestana | "resultado" | null;

const TEXTO_FASE: Record<Fase, string> = { relieve: "Obteniendo el relieve", cobertura: "Calculando la cobertura", enlaces: "Analizando la malla" };

function fuenteDe(relieve: TipoRelieve, hgt: string[]): FuenteRelieve {
  if (relieve === "plano") return { tipo: "plano" };
  if (relieve === "hgt" && hgt.length) return { tipo: "hgt" };
  return { tipo: "teselas", url: CONFIG.relieve };
}

const esEscritorio = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

/** Caja [oeste, sur, este, norte] de un radio alrededor de un punto. */
function cajaRadio(lat: number, lon: number, radioM: number): [number, number, number, number] {
  const g = metrosPorGrado(lat);
  return [lon - radioM / g.lon, lat - radioM / g.lat, lon + radioM / g.lon, lat + radioM / g.lat];
}

type PuntoMarcado = { lat: number; lon: number; titulo: string };

export function Simulador() {
  const [estado, despachar] = useReducer(reductor, undefined, () => ({ ...estadoInicial(), ...(leerGuardado() ?? {}) }));
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [firmaResultado, setFirmaResultado] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{ fase: Fase; avance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspeccion, setInspeccion] = useState<Inspeccion | null>(null);
  const [inspeccionando, setInspeccionando] = useState(false);
  const [perfil, setPerfil] = useState<{ titulo: string; perfil: Perfil | null; informe?: boolean; n?: number } | null>(null);
  const [hgt, setHgt] = useState<string[]>([]);
  const [avisoHgt, setAvisoHgt] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("antenas");
  const [resultadosAbiertos, setResultadosAbiertos] = useState(true);
  const [hoja, setHoja] = useState<Hoja>(null);
  const [tour, setTour] = useState<IdTour | null>(null);
  const [voz, setVoz] = useState(false);
  const [solicitud, setSolicitud] = useState<SolicitudVista | null>({ n: 0, tipo: "encuadrar" });
  const [mapa, setMapa] = useState<MapaML | null>(null);
  const [punto, setPunto] = useState<PuntoMarcado | null>(null);
  const [menu, setMenu] = useState<PuntoMapa | null>(null);
  const [perfilTerreno, setPerfilTerreno] = useState<{ titulo: string; perfil: PerfilTerreno | null } | null>(null);
  const [semillaRegla, setSemillaRegla] = useState<{ n: number; punto: [number, number] } | null>(null);
  const [nPedido, setNPedido] = useState(0);

  const motor = useRef<MotorCobertura | null>(null);
  const idSimulacion = useRef(0);
  const nSolicitud = useRef(1);
  const zonaMapa = useRef<HTMLElement>(null);
  /** Quien espera el próximo resultado al día (Melki). */
  const oyentes = useRef(new Set<(r: ResultadoSimulacion) => void>());
  const pedido = useRef(false);
  /** Escenario del usuario guardado mientras hace un tour en el escenario de práctica. */
  const practica = useRef<{ guardado: Guardado; resultado: ResultadoSimulacion | null; firmaResultado: string | null } | null>(null);

  const { escenario } = estado;
  const fuente = useMemo(() => fuenteDe(estado.relieve, hgt), [estado.relieve, hgt]);
  // La firma resume lo que afecta el cálculo (el nombre de las antenas no cuenta)
  const firma = useMemo(
    () =>
      JSON.stringify({
        a: escenario.antenas.filter((a) => a.activa).map((a) => ({ ...a, nombre: "" })),
        p: escenario.parametros,
        f: fuente,
        h: hgt,
      }),
    [escenario.antenas, escenario.parametros, fuente, hgt],
  );
  const activas = escenario.antenas.filter((a) => a.activa).length;
  const seleccionada = escenario.antenas.find((a) => a.id === estado.seleccion) ?? null;
  const desactualizado = resultado !== null && firma !== firmaResultado;
  const calculando = progreso !== null;

  // Valores actuales para las funciones estables
  const ultimo = useRef({ estado, fuente, firma, resultado, firmaResultado, inspeccion, perfil, perfilTerreno });
  useEffect(() => {
    ultimo.current = { estado, fuente, firma, resultado, firmaResultado, inspeccion, perfil, perfilTerreno };
  });

  // Los datos de referencia (municipios) sirven al buscador, a Melki y a las tarjetas
  useEffect(() => {
    void cargarReferencia();
  }, []);

  useEffect(() => {
    const m = new MotorCobertura();
    motor.current = m;
    return () => {
      m.destruir();
      motor.current = null;
    };
  }, []);

  const simular = useCallback(() => {
    const m = motor.current;
    if (!m) return;
    const { estado: e, fuente: f, firma: fi } = ultimo.current;
    const id = ++idSimulacion.current;
    if (!e.escenario.antenas.some((a) => a.activa)) {
      m.cancelar();
      setResultado(null);
      setFirmaResultado(fi);
      setProgreso(null);
      return;
    }
    setError(null);
    setProgreso({ fase: "relieve", avance: 0 });
    m.simular(e.escenario.antenas, e.escenario.parametros, f, (fase, avance) => {
      if (id === idSimulacion.current) setProgreso({ fase, avance });
    })
      .then((r) => {
        if (r && id === idSimulacion.current) {
          setResultado(r);
          setFirmaResultado(fi);
          // Solo se anuncia si el resultado corresponde a lo que hay en pantalla
          if (fi === ultimo.current.firma) for (const f of oyentes.current) f(r);
        }
      })
      .catch((err: Error) => {
        if (id === idSimulacion.current) setError(err.message);
      })
      .finally(() => {
        if (id === idSimulacion.current) setProgreso(null);
      });
  }, []);

  const detener = () => {
    idSimulacion.current++;
    motor.current?.cancelar();
    setProgreso(null);
  };

  // Simular automáticamente cuando cambia algo que afecta el cálculo
  useEffect(() => {
    if (!estado.autoSimular || firma === firmaResultado) return;
    const t = window.setTimeout(simular, firmaResultado === null ? 30 : 650);
    return () => window.clearTimeout(t);
  }, [firma, firmaResultado, estado.autoSimular, simular]);

  // Pedido de simulación desde Melki: si ya está al día se anuncia de una vez; si no, simula
  // (con «Simular al cambiar» activo, el cálculo automático se encarga).
  const pedirSimulacion = useCallback(() => {
    pedido.current = true;
    setNPedido((n) => n + 1);
  }, []);
  useEffect(() => {
    if (!pedido.current) return;
    pedido.current = false;
    const { estado: e, firma: fi, resultado: r, firmaResultado: fr } = ultimo.current;
    if (r && fi === fr) for (const f of oyentes.current) f(r);
    else if (!e.autoSimular) simular();
  }, [nPedido, simular]);

  const suscribir = useCallback((f: (r: ResultadoSimulacion) => void) => {
    oyentes.current.add(f);
    return () => {
      oyentes.current.delete(f);
    };
  }, []);

  // Guardar en este navegador
  useEffect(() => {
    const t = window.setTimeout(() => guardar(estado), 300);
    return () => window.clearTimeout(t);
  }, [estado]);

  const centrar = useCallback((lat: number, lon: number, zoom?: number) => setSolicitud({ n: nSolicitud.current++, tipo: "centrar", lat, lon, zoom }), []);
  const encuadrar = useCallback(() => setSolicitud({ n: nSolicitud.current++, tipo: "encuadrar" }), []);
  const encuadrarCaja = useCallback((caja: [number, number, number, number]) => setSolicitud({ n: nSolicitud.current++, tipo: "caja", caja }), []);

  const inspeccionar = useCallback((lat: number, lon: number) => {
    const m = motor.current;
    if (!m) return;
    const { estado: e, fuente: f } = ultimo.current;
    setInspeccionando(true);
    setInspeccion({ lat, lon, elevacionM: Number.NaN, margenes: [], sensibilidadDbm: Number.NaN, gananciaRxDbi: 0, frecuenciaMhz: 915 });
    m.inspeccionar(lat, lon, e.escenario.antenas, e.escenario.parametros, f)
      .then(setInspeccion)
      .catch((err: Error) => {
        setInspeccion(null);
        setError(err.message);
      })
      .finally(() => setInspeccionando(false));
  }, []);

  const nPerfil = useRef(0);
  const abrirPerfil = useCallback((tx: Antena, destino: Antena | { lat: number; lon: number }, titulo: string, informe = false) => {
    const m = motor.current;
    if (!m) return;
    const { estado: e, fuente: f } = ultimo.current;
    const n = ++nPerfil.current;
    setPerfilTerreno(null);
    setPerfil({ titulo, perfil: null, informe, n });
    m.perfil(tx, destino, e.escenario.parametros, f)
      .then((p) => setPerfil({ titulo, perfil: p, informe, n }))
      .catch((err: Error) => {
        setPerfil(null);
        setError(err.message);
      });
  }, []);

  const perfilEntreAntenas = useCallback((a: Antena, b: Antena, informe?: boolean) => abrirPerfil(a, b, `${a.nombre} → ${b.nombre}`, informe), [abrirPerfil]);

  const abrirPerfilTerreno = useCallback((med: Medicion) => {
    const m = motor.current;
    if (!m || med.puntos.length < 2) return;
    setPerfil(null);
    setPerfilTerreno({ titulo: med.nombre, perfil: null });
    m.perfilTerreno(med.puntos, ultimo.current.fuente)
      .then((p) => setPerfilTerreno((v) => (v && v.titulo === med.nombre ? { titulo: med.nombre, perfil: p } : v)))
      .catch((err: Error) => {
        setPerfilTerreno(null);
        setError(err.message);
      });
  }, []);

  /** Inscribe un nodo (desde Melki, el menú del clic derecho o la tarjeta de un punto) y encuadra su zona de estudio. */
  const inscribirNodo = useCallback(
    (lat: number, lon: number, datos: Partial<Antena> & { tipo: TipoNodo }) => {
      const { estado: e } = ultimo.current;
      const limpio = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)) as Partial<Antena>;
      const a = nuevaAntena(Number(lat.toFixed(6)), Number(lon.toFixed(6)), e.escenario.antenas, limpio);
      const eq = EQUIPOS.find((q) => q.id === a.equipo);
      if (eq && (eq.gananciaDbi !== a.gananciaDbi || eq.potenciaDbm !== a.potenciaDbm)) a.equipo = "personalizado";
      despachar({ tipo: "insertar", antena: a });
      despachar({ tipo: "herramienta", herramienta: "mover" });
      encuadrarCaja(cajaRadio(a.lat, a.lon, e.escenario.parametros.radioKm * 1000 * (a.tipo === "nodo" ? 0.4 : 0.85)));
      setPunto(null);
      setHoja(null);
      return a;
    },
    [encuadrarCaja],
  );

  const cargarHgt = (archivos: File[]) => {
    motor.current
      ?.cargarHgt(archivos)
      .then(({ archivos: lista, errores }) => {
        setHgt(lista);
        setAvisoHgt(errores.length ? errores.join(" ") : null);
        if (lista.length) despachar({ tipo: "relieve", relieve: "hgt" });
      })
      .catch((err: Error) => setAvisoHgt(err.message));
  };

  const borrarHgt = () => {
    motor.current?.borrarHgt().then(() => {
      setHgt([]);
      setAvisoHgt(null);
      despachar({ tipo: "relieve", relieve: "teselas" });
    });
  };

  const importar = async (f: File) => {
    try {
      const e = validarEscenario(JSON.parse(await f.text()));
      if (!e) throw new Error();
      fueraDelTour();
      despachar({ tipo: "cargar", escenario: e });
      encuadrar();
    } catch {
      setError(`«${f.name}» no es un escenario válido. Use un archivo .json guardado desde este simulador.`);
    }
  };

  const kmz = resultado && !desactualizado ? () => void exportarKmz(escenario, resultado, escenario.antenas, estado.vista).catch((e: Error) => setError(e.message)) : null;

  // Lo que Melki puede hacer en el simulador
  const api = useMemo<Api>(
    () => ({
      antenas: () => ultimo.current.estado.escenario.antenas,
      parametros: () => ultimo.current.estado.escenario.parametros,
      seleccion: () => ultimo.current.estado.seleccion,
      resultado: () => ultimo.current.resultado,
      instantanea: () => ultimo.current.estado.escenario,
      agregar: (d) => {
        const { lat, lon, ...datos } = d;
        const a = inscribirNodo(lat, lon, { ...datos, tipo: datos.tipo ?? "antena" });
        pedirSimulacion();
        return a;
      },
      editar: (id, cambios) => {
        despachar({ tipo: "editar", id, cambios });
        if (Object.keys(cambios).some((k) => k !== "nombre")) pedirSimulacion();
      },
      eliminar: (id) => despachar({ tipo: "eliminar", id }),
      parametrosCambiar: (cambios) => {
        despachar({ tipo: "parametros", cambios });
        pedirSimulacion();
      },
      simular,
      centrar,
      encuadrarCaja,
      marcar: (lat, lon, titulo) => setPunto({ lat, lon, titulo }),
      medir: (m) => {
        despachar({ tipo: "medicion-agregar", medicion: m });
        const lons = m.puntos.map((q) => q[0]);
        const lats = m.puntos.map((q) => q[1]);
        encuadrarCaja([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);
      },
      perfil: (a, b, informe) => abrirPerfil(a, b, `${a.nombre} → ${"nombre" in b ? b.nombre : "punto"}`, informe),
      vista: (cambios) => despachar({ tipo: "vista", cambios }),
      senal: (lat, lon) => {
        inspeccionar(lat, lon);
        setHoja(null);
      },
      herramienta: (h) => {
        despachar({ tipo: "herramienta", herramienta: h });
        setHoja(null);
      },
      ejemplo: () => {
        despachar({ tipo: "cargar", escenario: escenarioEjemplo() });
        encuadrar();
        pedirSimulacion();
      },
      nuevo: () => {
        despachar({ tipo: "cargar", escenario: escenarioVacio() });
        setInspeccion(null);
        setPerfil(null);
        setPerfilTerreno(null);
      },
      exportar: (f) => {
        const { estado: e, resultado: r, firma: fi, firmaResultado: fr } = ultimo.current;
        if (f === "json") exportarJson(e.escenario);
        else if (f === "csv") exportarCsv(e.escenario, r);
        else {
          if (!r || fi !== fr) return false;
          void exportarKmz(e.escenario, r, e.escenario.antenas, e.vista).catch((err: Error) => setError(err.message));
        }
        return true;
      },
      borrarMediciones: () => despachar({ tipo: "mediciones-borrar" }),
      ubicacion: textoUbicacion,
      buscarLugar: (t) => buscarLugares(t, 5),
    }),
    [inscribirNodo, pedirSimulacion, simular, centrar, encuadrar, encuadrarCaja, abrirPerfil, inspeccionar],
  );

  const restaurar = useCallback((e: Escenario) => despachar({ tipo: "cargar", escenario: e }), []);

  /* ───────────── Tours guiados ───────────── */

  const apiTour = useMemo<ApiTour>(
    () => ({
      foto: () => {
        const u = ultimo.current;
        return { estado: u.estado, inspeccion: u.inspeccion, perfil: u.perfil ? { informe: Boolean(u.perfil.informe) } : null, perfilTerreno: u.perfilTerreno !== null };
      },
      alDia: () => ultimo.current.resultado !== null && ultimo.current.firma === ultimo.current.firmaResultado,
      despachar,
      melki: api,
      perfilTerreno: abrirPerfilTerreno,
    }),
    [api, abrirPerfilTerreno],
  );

  const limpiarPantalla = () => {
    setMenu(null);
    setPunto(null);
    setInspeccion(null);
    setPerfil(null);
    setPerfilTerreno(null);
    setHoja(null);
  };

  const cancelarCalculo = () => {
    idSimulacion.current++;
    motor.current?.cancelar();
    setProgreso(null);
  };

  /** Devuelve el escenario del usuario (con su resultado) al terminar un tour práctico. */
  const devolverEscenario = () => {
    const p = practica.current;
    if (!p) return;
    practica.current = null;
    cancelarCalculo();
    limpiarPantalla();
    despachar({ tipo: "restaurar", ...p.guardado });
    setResultado(p.resultado);
    setFirmaResultado(p.firmaResultado);
    // Se guarda de una vez (sin esperar el guardado automático) antes de soltar el respaldo
    guardar({ ...ultimo.current.estado, ...p.guardado });
    quitarRespaldo();
    // Los «Deshacer» de Melki de la práctica ya no aplican al escenario del usuario
    window.dispatchEvent(new CustomEvent("melki:escenario-cambiado"));
    encuadrar();
  };

  const empezarTour = (id: IdTour) => {
    const def = tourPorId(id);
    devolverEscenario();
    limpiarPantalla();
    if (def.practica) {
      const { estado: e, resultado: r, firmaResultado: fr } = ultimo.current;
      const guardado: Guardado = { escenario: e.escenario, vista: e.vista, relieve: e.relieve, autoSimular: e.autoSimular };
      practica.current = { guardado, resultado: r, firmaResultado: fr };
      guardarRespaldo(guardado);
      cancelarCalculo();
      setResultado(null);
      setFirmaResultado(null);
      despachar({ tipo: "restaurar", escenario: def.practica.escenario(), vista: { ...VISTA_DEFECTO, fondo: e.vista.fondo, ...def.practica.vista }, autoSimular: def.practica.autoSimular });
      window.dispatchEvent(new CustomEvent("melki:escenario-cambiado"));
      const c = def.practica.centro;
      if (c) centrar(c[0], c[1], c[2]);
      else encuadrar();
    }
    setTour(id);
  };

  const terminarTour = (otro?: boolean) => {
    setTour(null);
    setHoja(null);
    devolverEscenario();
    if (otro) avisarMelki("tours");
  };

  /** Las acciones de «Archivo» que cambian de escenario terminan antes el tour (y devuelven el del usuario). */
  const fueraDelTour = () => {
    if (tour) terminarTour();
  };

  /** Acciones sobre un punto del mapa (clic derecho o punto marcado). */
  const accionPunto = (a: AccionPunto, lat: number, lon: number) => {
    switch (a) {
      case "antena":
      case "nodo":
        inscribirNodo(lat, lon, { tipo: a });
        break;
      case "senal":
        inspeccionar(lat, lon);
        break;
      case "medir":
        despachar({ tipo: "herramienta", herramienta: "regla" });
        setSemillaRegla((s) => ({ n: (s?.n ?? 0) + 1, punto: [lon, lat] }));
        setPunto(null);
        break;
      case "marcar":
        setPunto({ lat, lon, titulo: "Punto marcado" });
        break;
      case "centrar":
        centrar(lat, lon);
        break;
      case "copiar":
        void navigator.clipboard?.writeText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`).catch(() => undefined);
        break;
    }
  };

  const irA = (d: Destino) => {
    if (d.tipo === "coordenada") {
      centrar(d.lat, d.lon, 13);
      setPunto({ lat: d.lat, lon: d.lon, titulo: "Coordenada buscada" });
    } else if (d.tipo === "nodo") {
      centrar(d.antena.lat, d.antena.lon, 13);
      despachar({ tipo: "seleccionar", id: d.antena.id });
    } else {
      const l = d.lugar;
      if (l.caja) encuadrarCaja(l.caja);
      else centrar(l.lat, l.lon, l.tipo === "municipio" ? 12 : 7);
      if (l.tipo === "municipio") setPunto({ lat: l.lat, lon: l.lon, titulo: `${l.nombre}, ${l.detalle}` });
    }
  };

  const nombres = useMemo(() => new Map(escenario.antenas.map((a) => [a.id, a.nombre])), [escenario.antenas]);

  const prepararTour = useCallback((p: Preparacion) => {
    if (!p) return;
    if (p === "mapa") {
      if (!esEscritorio()) setHoja(null);
      return;
    }
    if (esEscritorio()) {
      if (p === "resultados") setResultadosAbiertos(true);
      else setPestana(p);
    } else setHoja(p === "resultados" ? "resultado" : p);
  }, []);

  const accionMelki = (a: AccionMelki) => {
    switch (a) {
      case "recorrido":
        empezarTour("basico");
        break;
      case "tours":
        avisarMelki("tours");
        break;
      case "simular":
        simular();
        break;
      case "ejemplo":
        despachar({ tipo: "cargar", escenario: escenarioEjemplo() });
        encuadrar();
        break;
      case "agregar":
        despachar({ tipo: "herramienta", herramienta: "agregar" });
        setHoja(null);
        break;
      case "regla":
        despachar({ tipo: "herramienta", herramienta: "regla" });
        setHoja(null);
        break;
      case "inspeccionar":
        despachar({ tipo: "herramienta", herramienta: "inspeccionar" });
        setHoja(null);
        break;
      case "parametros":
        if (esEscritorio()) setPestana("parametros");
        else setHoja("parametros");
        break;
      case "resultados":
        if (esEscritorio()) setResultadosAbiertos(true);
        else setHoja("resultado");
        break;
      case "kmz":
        if (kmz) kmz();
        else simular();
        break;
    }
  };

  const pestanas = (
    <div className="flex gap-1 border-b border-linea px-3 pt-2" role="tablist" aria-label="Panel">
      {(
        [
          ["antenas", `Nodos (${escenario.antenas.length})`, <RadioTower key="i" size={16} />],
          ["parametros", "Parámetros", <SlidersHorizontal key="i" size={16} />],
        ] as const
      ).map(([id, texto, icono]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={pestana === id}
          onClick={() => setPestana(id)}
          data-tour={`tab-${id}`}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[14px] font-medium ${pestana === id ? "border-carbon text-carbon" : "border-transparent text-tenue hover:text-carbon"}`}
        >
          {icono}
          {texto}
        </button>
      ))}
    </div>
  );

  const contenidoPestana = (p: Pestana) =>
    p === "antenas" ? (
      <PanelAntenas estado={estado} despachar={despachar} resultado={resultado} onCentrar={centrar} onPerfil={perfilEntreAntenas} />
    ) : (
      <PanelParametros estado={estado} despachar={despachar} archivosHgt={hgt} onCargarHgt={cargarHgt} onBorrarHgt={borrarHgt} avisoHgt={avisoHgt} />
    );

  const pieSimular = (
    <div className="border-t border-linea bg-papel px-3 py-3" data-tour="simular">
      {calculando ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[13px]">
            <span>{TEXTO_FASE[progreso.fase]}…</span>
            <span className="text-tenue tabular-nums">{Math.round(progreso.avance * 100)} %</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-linea" role="progressbar" aria-valuenow={Math.round(progreso.avance * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-salvia transition-[width]" style={{ width: `${Math.max(4, progreso.avance * 100)}%` }} />
          </div>
          <button type="button" onClick={detener} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[14px] font-medium ring-1 ring-linea hover:bg-papel-2">
            <Square size={14} /> Detener
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={simular}
          disabled={activas === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-carbon py-2.5 text-[15px] font-semibold text-white hover:bg-carbon-2 disabled:bg-carbon/40"
        >
          <Play size={16} /> {resultado && !desactualizado ? "Simular de nuevo" : "Simular"}
          {activas > 0 && <span className="font-normal text-white/70">· {activas} {activas === 1 ? "nodo" : "nodos"}</span>}
        </button>
      )}
      <div className="mt-2">
        <Interruptor etiqueta="Simular al cambiar" activo={estado.autoSimular} onCambio={(v) => despachar({ tipo: "auto", valor: v })} />
      </div>
      {error && (
        <p className="mt-1.5 text-[13px] leading-snug text-sin" role="alert">
          {error}
        </p>
      )}
    </div>
  );

  const resultados = <PanelResultados resultado={resultado} antenas={escenario.antenas} parametros={escenario.parametros} desactualizado={desactualizado} calculando={calculando} onPerfil={perfilEntreAntenas} />;

  return (
    <div className="flex h-dvh flex-col">
      <BarraSuperior
        nombre={escenario.nombre}
        onRenombrar={(n) => despachar({ tipo: "renombrar-escenario", nombre: n })}
        onNuevo={() => {
          fueraDelTour();
          despachar({ tipo: "cargar", escenario: escenarioVacio() });
          setInspeccion(null);
          setPerfil(null);
          setPerfilTerreno(null);
        }}
        onEjemplo={() => {
          fueraDelTour();
          despachar({ tipo: "cargar", escenario: escenarioEjemplo() });
          encuadrar();
        }}
        buscador={(alElegir) => (
          <Buscador
            antenas={escenario.antenas}
            onIr={(d) => {
              irA(d);
              alElegir?.();
            }}
          />
        )}
        onImportar={importar}
        onExportarJson={() => exportarJson(escenario)}
        onExportarCsv={() => exportarCsv(escenario, resultado)}
        onExportarKmz={kmz}
        onRecorrido={() => avisarMelki("tours")}
        resultadosAbiertos={resultadosAbiertos}
        onResultados={() => setResultadosAbiertos((v) => !v)}
      />

      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-[340px] shrink-0 flex-col border-r border-linea bg-papel lg:flex" aria-label="Nodos y parámetros">
          {pestanas}
          <div className="desplazable min-h-0 flex-1 overflow-y-auto p-3">{contenidoPestana(pestana)}</div>
          {pieSimular}
        </aside>

        <main ref={zonaMapa} className="relative min-w-0 flex-1 bg-[#DDE3DC]">
          <Mapa
            estado={estado}
            despachar={despachar}
            resultado={resultado}
            inspeccion={inspeccion}
            onInspeccionar={inspeccionar}
            solicitud={solicitud}
            punto={punto}
            onMenu={(p) => {
              const caja = zonaMapa.current;
              const x = caja ? Math.max(8, Math.min(p.x, caja.clientWidth - 264)) : p.x;
              const y = caja ? Math.max(8, Math.min(p.y, caja.clientHeight - 300)) : p.y;
              setMenu({ ...p, x, y });
            }}
            onListo={setMapa}
          />
          <BarraMapa estado={estado} despachar={despachar} />
          <Regla mapa={mapa} estado={estado} despachar={despachar} onPerfil={abrirPerfilTerreno} onCentrar={encuadrarCaja} semilla={semillaRegla} />
          <CoordenadasCursor mapa={mapa} />
          {seleccionada && estado.herramienta !== "regla" && (
            <TarjetaNodo
              antena={seleccionada}
              resumen={desactualizado ? undefined : resultado?.antenas.find((x) => x.id === seleccionada.id)}
              nodo={desactualizado ? undefined : resultado?.nodos.find((x) => x.id === seleccionada.id)}
              nombres={nombres}
              soloSeleccionada={estado.vista.soloSeleccionada}
              onSolo={(v) => despachar({ tipo: "vista", cambios: { soloSeleccionada: v } })}
              onCerrar={() => despachar({ tipo: "seleccionar", id: null })}
            />
          )}
          {punto && (
            <TarjetaPunto
              lat={punto.lat}
              lon={punto.lon}
              titulo={punto.titulo}
              onAccion={(a) => {
                accionPunto(a, punto.lat, punto.lon);
                if (a === "antena" || a === "nodo") setPunto(null);
              }}
              onCerrar={() => setPunto(null)}
            />
          )}
          {menu && <MenuContextual x={menu.x} y={menu.y} lat={menu.lat} lon={menu.lon} onAccion={(a) => accionPunto(a, menu.lat, menu.lon)} onCerrar={() => setMenu(null)} />}
          {calculando && (
            <div className="pointer-events-none absolute top-14 left-1/2 z-10 -translate-x-1/2 rounded-full bg-carbon/90 px-3 py-1 text-[13px] text-white shadow lg:hidden">
              {TEXTO_FASE[progreso.fase]}… {Math.round(progreso.avance * 100)} %
            </div>
          )}
          <Inspector
            inspeccion={estado.herramienta === "regla" ? null : inspeccion && Number.isFinite(inspeccion.elevacionM) ? inspeccion : null}
            cargando={inspeccionando && estado.herramienta !== "regla"}
            unidad={estado.vista.unidad}
            onCerrar={() => setInspeccion(null)}
            onPerfil={(id) => {
              const a = escenario.antenas.find((x) => x.id === id);
              if (a && inspeccion) abrirPerfil(a, { lat: inspeccion.lat, lon: inspeccion.lon }, `${a.nombre} → punto medido`);
            }}
          />
          <Leyenda estado={estado} resultado={resultado} antenas={escenario.antenas} />
          {perfil && (
            <PerfilEnlace key={perfil.n} perfil={perfil.perfil} titulo={perfil.titulo} frecuenciaMhz={escenario.parametros.frecuenciaMhz} informe={perfil.informe} onCerrar={() => setPerfil(null)} />
          )}
          {perfilTerreno && <PerfilTerrenoPanel perfil={perfilTerreno.perfil} titulo={perfilTerreno.titulo} onCerrar={() => setPerfilTerreno(null)} />}
          <Melki
            contexto={{ antenas: escenario.antenas, parametros: escenario.parametros, resultado, desactualizado, relieve: estado.relieve }}
            api={api}
            suscribir={suscribir}
            restaurar={restaurar}
            onAccion={accionMelki}
            onTour={empezarTour}
            vozActiva={voz}
            onVoz={setVoz}
          />

          {hoja && (
            <section className="absolute inset-x-0 bottom-0 z-40 flex max-h-[72%] flex-col rounded-t-2xl bg-papel shadow-2xl ring-1 ring-black/10 lg:hidden" aria-label="Panel">
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <p className="font-cond text-[17px] font-semibold">{hoja === "antenas" ? "Nodos" : hoja === "parametros" ? "Parámetros" : "Resultado"}</p>
                <button type="button" onClick={() => setHoja(null)} className="rounded-md px-2 py-1 text-[14px] text-carbon-2 hover:bg-black/5">
                  Cerrar
                </button>
              </div>
              <div className="desplazable min-h-0 flex-1 overflow-y-auto px-3 pb-3">{hoja === "resultado" ? resultados : contenidoPestana(hoja)}</div>
              {hoja !== "resultado" && pieSimular}
            </section>
          )}
        </main>

        {resultadosAbiertos && (
          <aside className="hidden w-[360px] shrink-0 flex-col border-l border-linea bg-papel lg:flex" aria-label="Resultados">
            <div className="flex items-center gap-2 border-b border-linea px-4 py-2.5">
              <Waypoints size={17} className="text-salvia-oscura" />
              <h2 className="font-cond text-[17px] font-semibold">Resultado</h2>
            </div>
            <div className="desplazable min-h-0 flex-1 overflow-y-auto p-4">{resultados}</div>
          </aside>
        )}
      </div>

      <nav className="flex shrink-0 border-t border-linea bg-papel lg:hidden" aria-label="Paneles">
        {(
          [
            ["antenas", "Nodos", <RadioTower key="i" size={18} />],
            ["parametros", "Parámetros", <SlidersHorizontal key="i" size={18} />],
            ["resultado", "Resultado", <Waypoints key="i" size={18} />],
          ] as const
        ).map(([id, texto, icono]) => (
          <button
            key={id}
            type="button"
            onClick={() => setHoja((h) => (h === id ? null : id))}
            aria-pressed={hoja === id}
            data-tour={id === "parametros" ? "tab-parametros" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[12px] font-medium ${hoja === id ? "text-carbon" : "text-tenue"}`}
          >
            {icono}
            {texto}
          </button>
        ))}
      </nav>

      {tour && <Recorrido key={tour} tour={tourPorId(tour)} t={apiTour} preparar={prepararTour} voz={voz} onTerminar={terminarTour} />}
    </div>
  );
}
