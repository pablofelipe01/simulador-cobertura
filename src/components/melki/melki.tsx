"use client";

// Melki: botón flotante, conversación con el cerebro local, órdenes sobre el simulador (con deshacer),
// aviso del resultado cuando termina la simulación, voz, dictado y menú de tours guiados (también en la primera visita).
// Escucha avisos de la ventana: «melki:abrir», «melki:tours» y «melki:pedir» (los usan los tours y la barra superior).
import { Compass, Globe, LoaderCircle, Mic, Send, Settings2, ShieldCheck, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { consejoRed, estadoRed, piezaDe } from "@/lib/radio/estado-red";
import type { Escenario, ResultadoSimulacion } from "@/lib/radio/tipos";

import { MelkiAvatar } from "./avatar";
import { menuTours, pedidoDeTour, responder, SUGERENCIAS, type AccionMelki, type AccionRespuesta, type ContextoMelki, type Respuesta } from "./cerebro";
import {
  borrarReconocedor,
  componerTexto,
  DictadoCancelado,
  hayMicrofono,
  hayReconocimientoNavegador,
  iniciarDictado,
  reconocedorDescargado,
  type ControlDictado,
  type Dictado,
  type EstadoDictado,
  type ModoDictado,
} from "./dictado";
import { accionAjuste, dividirEnPasos, ejecutarOrden, interpretarOrden, textoCoberturaUtil, textoRed, type Api, type Orden, type Pendiente } from "./ordenes";
import type { IdTour } from "./tours";
import { callar, hablar, vozDisponible } from "./voz";

type Mensaje = { id: number; de: "melki" | "usuario"; texto: string; acciones?: AccionRespuesta[] };

const CLAVE = "simulador-cobertura-melki-v1";
const f1 = (x: number, d = 1) => x.toFixed(d).replace(".", ",");

type Preferencias = { visto: boolean; voz: boolean; dictado?: ModoDictado };

function leerPreferencias(): Preferencias {
  try {
    const t = window.localStorage.getItem(CLAVE);
    return t ? { visto: true, voz: false, ...JSON.parse(t) } : { visto: false, voz: false };
  } catch {
    return { visto: false, voz: false };
  }
}

/** Guarda solo lo indicado y conserva el resto de las preferencias. */
function guardarPreferencias(cambios: Partial<Preferencias>) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify({ ...leerPreferencias(), visto: true, ...cambios }));
  } catch {
    // Sin almacenamiento: la preferencia dura hasta cerrar la página.
  }
}

/** En el modo «Sembrar la malla»: quién quedó conectado al gateway y qué sigue. */
function resumenMalla(r: ResultadoSimulacion, api: Api, id: string): Respuesta {
  const limite = api.parametros().limiteSaltos;
  const antenas = api.antenas();
  const red = estadoRed(antenas, r, limite, true);
  const general = textoRed(red, limite);
  const acciones: AccionRespuesta[] = [];
  if (red.sinCobertura.length) acciones.push({ texto: "Conectar a los que faltan", accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } });
  else if (red.conectadas.length) acciones.push({ texto: "Enviar un pago de prueba", accion: "orden", orden: { tipo: "mensaje" } });
  const a = id !== "*" ? antenas.find((x) => x.id === id) : undefined;
  const info = a ? red.porNodo.get(a.id) : undefined;
  if (a && info) {
    const nombres = new Map(antenas.map((x) => [x.id, x.nombre]));
    const persona = piezaDe(a) === "persona";
    let t = "";
    if (info.estado === "gateway") t = `El gateway «${a.nombre}» está listo: ahí entra el internet y de ahí sale la malla.`;
    else if (info.estado === "conectado") {
      const n = r.nodos.find((x) => x.id === a.id);
      t = `«${a.nombre}» quedó conectad${persona ? "a" : "o"} al gateway en ${info.saltos} ${info.saltos === 1 ? "salto" : "saltos"}${n && n.ruta.length > 1 ? ` (${n.ruta.map((x) => nombres.get(x) ?? x).join(" → ")})` : ""}${n?.cuelloDb != null ? `, con ${f1(n.cuelloDb)} dB en su enlace más débil` : ""}.`;
    } else if (info.estado === "lejos") t = `«${a.nombre}» llega al gateway, pero con ${info.saltos} saltos, más que el límite de ${limite}: el mensaje se perdería en el camino.`;
    else {
      const mejor = r.enlaces.filter((e) => e.a === a.id || e.b === a.id).sort((x, y) => y.margen - x.margen)[0];
      const otro = mejor ? nombres.get(mejor.a === a.id ? mejor.b : mejor.a) : null;
      t = `«${a.nombre}» no alcanza la red${mejor && otro ? `: su mejor enlace es con ${otro} (${f1(mejor.margen)} dB; se necesitan 20 dB)` : ""}. ${info.estado === "aislado" ? "Acérquelo a un repetidor conectado, súbalo a una loma o ponga otro repetidor en medio." : "Póngale un repetidor cerca, en una loma, o pídame que lo siembre."}`;
      if (info.estado === "sin-cobertura") acciones.splice(0, acciones.length, { texto: `Conectar a ${a.nombre}`, accion: "orden", orden: { tipo: "sembrar", destino: { id: a.id } } });
    }
    return { texto: `${t} ${general}`, acciones };
  }
  const c = consejoRed(red, limite);
  return { texto: `Red calculada. ${general}${c.tono === "ok" ? " ¡Toda la gente está conectada!" : ` Siguiente: ${c.texto}`}`, acciones };
}

/** Resumen que Melki da cuando termina la simulación que él mismo pidió. */
/** Órdenes que necesitan la red calculada: dentro de varias órdenes seguidas, esperan la simulación. */
const NECESITA_RED = new Set<Orden["tipo"]>(["sembrar", "mensaje", "que-hago", "exportar", "informe"]);

function resumenResultado(r: ResultadoSimulacion, api: Api, id: string): Respuesta {
  if (api.modo() === "sembrar") return resumenMalla(r, api, id);
  const nombres = new Map(api.antenas().map((a) => [a.id, a]));
  const red = `La red queda: ${r.factibilidad.titulo.toLowerCase()} (${r.factibilidad.puntaje}/100).`;
  if (id !== "*") {
    const a = nombres.get(id);
    const s = r.antenas.find((x) => x.id === id);
    const nodo = r.nodos.find((x) => x.id === id);
    if (a && s) {
      const ruta = !a.pasarela && nodo ? (nodo.saltos === null ? " No tiene ruta hacia la pasarela." : ` Llega a la pasarela en ${nodo.saltos} ${nodo.saltos === 1 ? "salto" : "saltos"}.`) : "";
      return {
        texto: `Simulación lista para «${a.nombre}»: alcance con servicio ${s.alcanceLimitado ? "de al menos " : ""}${f1(s.alcanceKm)} km y confiable de ${f1(s.alcanceConfiableKm)} km; ${f1(s.areaServicioKm2)} km² con servicio.${ruta} ${red} En el mapa dibujé su rango de alcance.`,
        acciones: [{ texto: "Ver resultados", accion: "resultados" }],
      };
    }
    if (a && nodo) {
      if (nodo.saltos === null) {
        const mejor = r.enlaces.filter((e) => e.a === id || e.b === id).sort((x, y) => y.margen - x.margen)[0];
        const otro = mejor ? nombres.get(mejor.a === id ? mejor.b : mejor.a)?.nombre : null;
        return {
          texto: `«${a.nombre}» no se conecta a la red${mejor && otro ? `: su mejor enlace es con ${otro} (${f1(mejor.margen)} dB; se necesitan 20 dB)` : ""}. Acérquelo a un nodo antena, súbalo o agregue un repetidor. ${red}`,
          acciones: [{ texto: "Ver resultados", accion: "resultados" }],
        };
      }
      return {
        texto: `«${a.nombre}» se conecta a la pasarela en ${nodo.saltos} ${nodo.saltos === 1 ? "salto" : "saltos"}${nodo.cuelloDb !== null ? `, con ${f1(nodo.cuelloDb)} dB en su enlace más débil` : ""}. ${red}`,
        acciones: [{ texto: "Ver resultados", accion: "resultados" }],
      };
    }
  }
  return {
    texto: `Simulación lista: ${textoCoberturaUtil(r)}. ${red}${r.factibilidad.recomendaciones[0] ? ` Sugerencia: ${r.factibilidad.recomendaciones[0]}` : ""}`,
    acciones: [{ texto: "Ver resultados", accion: "resultados" }, ...(r.factibilidad.nivel !== "factible" && accionAjuste(r) ? [accionAjuste(r)!] : [])],
  };
}

type Props = {
  contexto: ContextoMelki;
  api: Api;
  suscribir: (fn: (r: ResultadoSimulacion) => void) => () => void;
  restaurar: (e: Escenario) => void;
  onAccion: (a: AccionMelki) => void;
  /** Empieza un tour guiado. */
  onTour: (id: IdTour) => void;
  vozActiva: boolean;
  onVoz: (v: boolean) => void;
};

export function Melki({ contexto, api, suscribir, restaurar, onAccion, onTour, vozActiva, onVoz }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [oferta, setOferta] = useState(() => !leerPreferencias().visto);
  const [hablando, setHablando] = useState(false);
  const [noLeido, setNoLeido] = useState(false);
  const [texto, setTexto] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: 0,
      de: "melki",
      texto: "¡Hola! Soy Melki. Puedo inscribir nodos en una coordenada, moverlos, medir distancias, llevarlo a un municipio y explicarle la cobertura. Escríbame lo que necesite.",
    },
  ]);
  const [usados, setUsados] = useState<Set<string>>(new Set());
  /** Los «Deshacer» de mensajes anteriores a este no aplican (se cambió de escenario por un tour). */
  const [corte, setCorte] = useState(0);
  // Dictado por voz: el texto aparece en la caja para revisarlo antes de enviarlo
  const [dictado, setDictado] = useState<EstadoDictado>("inactivo");
  const [detalleDictado, setDetalleDictado] = useState<string | undefined>();
  const [errorDictado, setErrorDictado] = useState<string | null>(null);
  const [modoDictado, setModoDictado] = useState<ModoDictado | null>(() => leerPreferencias().dictado ?? null);
  const [elegirModo, setElegirModo] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [descargado, setDescargado] = useState<boolean | null>(null);
  const sesion = useRef<Dictado | null>(null);
  const control = useRef<ControlDictado | null>(null);
  const baseTexto = useRef("");
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const siguiente = useRef(1);
  const pendiente = useRef<Pendiente>(null);
  const esperando = useRef<string | null>(null);
  /** Último nodo que Melki puso o cambió: «súbelo a 20 m», «muévelo 2 km al norte». */
  const ultimoNodo = useRef<string | null>(null);
  const ultimoDeshacer = useRef<Escenario | null>(null);
  const actual = useRef({ abierto, vozActiva, api, mensajes });
  useEffect(() => {
    actual.current = { abierto, vozActiva, api, mensajes };
  });

  useEffect(() => {
    const l = lista.current;
    if (!l) return;
    // Un menú largo (los tours) se muestra desde su primera opción
    const ultimo = mensajes.at(-1);
    const el = ultimo?.acciones?.some((a) => a.detalle) ? l.querySelector<HTMLElement>(`[data-mensaje="${ultimo.id}"]`) : null;
    l.scrollTo({ top: el ? Math.max(0, el.offsetTop - l.offsetTop - 8) : l.scrollHeight, behavior: "smooth" });
  }, [mensajes, abierto]);

  useEffect(() => {
    if (abierto) entrada.current?.focus();
  }, [abierto]);

  useEffect(
    () => () => {
      callar();
      if (control.current) control.current.cancelado = true;
      sesion.current?.cancelar();
    },
    [],
  );

  // La caja crece con el texto (hasta unas cinco líneas)
  useEffect(() => {
    const e = entrada.current;
    if (!e) return;
    e.style.height = "auto";
    e.style.height = `${Math.min(e.scrollHeight, 132)}px`;
  }, [texto, abierto]);

  useEffect(() => {
    if (ajustes) void reconocedorDescargado().then(setDescargado);
  }, [ajustes]);

  const cortarDictado = () => {
    if (control.current) control.current.cancelado = true;
    control.current = null;
    sesion.current?.cancelar();
    sesion.current = null;
    setDictado("inactivo");
  };

  const enfocarAlFinal = () => {
    const e = entrada.current;
    if (!e) return;
    e.focus();
    const n = e.value.length;
    e.setSelectionRange(n, n);
  };

  const empezarDictado = async (modo: ModoDictado) => {
    setErrorDictado(null);
    setElegirModo(false);
    callar();
    setHablando(false);
    baseTexto.current = texto;
    const c: ControlDictado = {};
    control.current = c;
    setDictado("preparando");
    setDetalleDictado(undefined);
    try {
      const s = await iniciarDictado(
        modo,
        {
          onTexto: (final, parcial) => {
            if (c.cancelado) return;
            setTexto(componerTexto(baseTexto.current, [final, parcial].filter(Boolean).join(" ")));
          },
          onEstado: (estado, detalle) => {
            if (c.cancelado) return;
            setDictado(estado);
            setDetalleDictado(detalle);
            if (estado === "inactivo") {
              sesion.current = null;
              control.current = null;
              requestAnimationFrame(enfocarAlFinal);
            }
          },
          onError: (m) => !c.cancelado && setErrorDictado(m),
        },
        c,
      );
      if (c.cancelado) s.cancelar();
      else sesion.current = s;
    } catch (e) {
      if (c.cancelado || e instanceof DictadoCancelado) return;
      setErrorDictado(e instanceof Error ? e.message : String(e));
      setDictado("inactivo");
      control.current = null;
    }
  };

  const pulsarMicrofono = () => {
    if (dictado === "preparando") {
      cortarDictado();
      return;
    }
    if (dictado !== "inactivo") {
      sesion.current?.detener();
      return;
    }
    if (!modoDictado) {
      setElegirModo((v) => !v);
      return;
    }
    void empezarDictado(modoDictado);
  };

  const fijarModo = (m: ModoDictado, empezar: boolean) => {
    setModoDictado(m);
    guardarPreferencias({ dictado: m });
    if (empezar) void empezarDictado(m);
  };

  const decir = (t: string) => {
    if (!actual.current.vozActiva) return;
    setHablando(true);
    hablar(t, () => setHablando(false));
  };

  const agregarMelki = (r: Respuesta) => {
    setMensajes((m) => [...m, { id: siguiente.current++, de: "melki", texto: r.texto, acciones: r.acciones }]);
    if (!actual.current.abierto) setNoLeido(true);
    decir(r.texto);
  };

  // Cuando termina una simulación que Melki pidió, cuenta el resultado
  useEffect(
    () =>
      suscribir((r) => {
        const id = esperando.current;
        if (!id) return;
        esperando.current = null;
        agregarMelki(resumenResultado(r, actual.current.api, id));
      }),
    [suscribir], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const deshacer = (e: Escenario | null | undefined, clave?: string) => {
    if (!e) {
      agregarMelki({ texto: "No tengo cambios recientes para deshacer." });
      return;
    }
    restaurar(e);
    if (clave) setUsados((u) => new Set(u).add(clave));
    ultimoDeshacer.current = null;
    esperando.current = null;
    agregarMelki({ texto: "Listo, deshice ese cambio." });
  };

  const ejecutar = (orden: Orden) => {
    const res = ejecutarOrden(orden, api);
    pendiente.current = res.pendiente ?? null;
    if (res.nodo) ultimoNodo.current = res.nodo;
    if (res.deshacer) ultimoDeshacer.current = res.deshacer;
    if (res.esperar) esperando.current = res.esperar;
    agregarMelki(res);
    // Órdenes que tardan (el sembrado automático, el diseño por área): la respuesta llega cuando el motor termina
    if (res.luego) void res.luego.then((r) => agregarMelki(r)).catch(() => agregarMelki({ texto: "No pude terminar ese cálculo. Intente de nuevo." }));
  };

  /**
   * Varias órdenes en un mensaje: se interpretan y ejecutan una tras otra (cada una ve lo que hizo la anterior).
   * Las que necesitan la red calculada esperan la simulación; al final se puede deshacer todo junto.
   */
  const ejecutarPlan = async (pasos: string[], primera: Orden) => {
    const antesPlan = api.instantanea();
    const total = pasos.length;
    let hechos = 0;
    let conCambios = false;
    let verboPlan = "";
    for (let i = 0; i < total; i++) {
      // «Pon el gateway en X, un repetidor a 10 km al este»: el paso que empieza sin verbo usa el del anterior
      const sinVerbo = /^(un|una|otro|otra|el|la|los|las|\d)/i.test(pasos[i].trim());
      if (i > 0 && sinVerbo && verboPlan) pasos[i] = `${verboPlan} ${pasos[i]}`;
      let orden = i === 0 ? primera : interpretarOrden(pasos[i], api, pendiente.current, { ultimoNodo: ultimoNodo.current });
      if (!orden && i > 0 && verboPlan && !pasos[i].startsWith(verboPlan)) orden = interpretarOrden(`${verboPlan} ${pasos[i]}`, api, pendiente.current, { ultimoNodo: ultimoNodo.current });
      if (!sinVerbo) verboPlan = pasos[i].trim().split(/\s+/)[0];
      if (!orden) {
        agregarMelki({ texto: `Paso ${i + 1} de ${total}: no entendí «${pasos[i]}». ${hechos ? "Hice los anteriores; d" : "D"}ígamelo de otra forma.` });
        break;
      }
      if (NECESITA_RED.has(orden.tipo)) await api.esperarResultado();
      const res = ejecutarOrden(orden, api);
      pendiente.current = res.pendiente ?? null;
      if (res.nodo) ultimoNodo.current = res.nodo;
      if (res.deshacer) conCambios = true;
      // Solo el último paso cuenta el resultado de la simulación
      if (res.esperar && i === total - 1) esperando.current = res.esperar;
      agregarMelki({ ...res, texto: `Paso ${i + 1} de ${total}: ${res.texto}`, acciones: res.acciones?.filter((a) => a.accion !== "deshacer") });
      if (res.luego) {
        const r: Respuesta = await res.luego.catch(() => ({ texto: "No pude terminar ese cálculo." }));
        agregarMelki({ ...r, acciones: r.acciones?.filter((a) => a.accion !== "deshacer") });
      }
      hechos++;
      if (res.pendiente) break;
      // Deja que la pantalla se actualice antes del siguiente paso
      await new Promise((ok) => window.setTimeout(ok, 80));
    }
    if (hechos > 1) {
      const resumen = `Listo, hice ${hechos === total ? `los ${total} pasos` : `${hechos} de los ${total} pasos`}.`;
      if (conCambios) {
        ultimoDeshacer.current = antesPlan;
        agregarMelki({ texto: `${resumen} Si algo no le gustó, puedo deshacerlo todo de una vez.`, acciones: [{ texto: "Deshacer todo", accion: "deshacer", escenario: antesPlan }] });
      } else agregarMelki({ texto: resumen });
    }
  };

  const preguntar = (q: string) => {
    const pregunta = q.trim();
    if (!pregunta) return;
    if (sesion.current || control.current) cortarDictado();
    setMensajes((m) => [...m, { id: siguiente.current++, de: "usuario", texto: pregunta }]);
    setTexto("");
    // La voz de Melki
    const sinAcentos = pregunta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/\b(activa|enciende|prende|pon)\w* (tu |la )?voz\b|\bhablame\b|\blee(me)? en voz alta\b/.test(sinAcentos) && vozDisponible()) {
      onVoz(true);
      guardarPreferencias({ voz: true });
      agregarMelki({ texto: "Listo, ahora le leo en voz alta lo que respondo." });
      return;
    }
    if (/\b(desactiva|apaga|quita|silencia)\w* (tu |la )?voz\b|\bcallate\b|\bsilencio\b|\bno hables\b/.test(sinAcentos)) {
      callar();
      setHablando(false);
      onVoz(false);
      guardarPreferencias({ voz: false });
      agregarMelki({ texto: "Listo, ya no hablo en voz alta; sigo respondiendo por escrito." });
      return;
    }
    if (/\b(deshac\w*|deshaz|revierte|revertir|anula lo [uú]ltimo)\b/i.test(pregunta)) {
      deshacer(ultimoDeshacer.current);
      return;
    }
    // «Enséñame a medir», «hazme un tour»: se ofrece el tour antes de tomarlo como orden (salvo que traiga coordenadas o números)
    const tour = /\d/.test(pregunta) ? null : pedidoDeTour(pregunta);
    if (tour) {
      agregarMelki(tour);
      return;
    }
    // Varias órdenes en un mismo mensaje
    const pasos = dividirEnPasos(pregunta);
    if (pasos.length > 1 && interpretarOrden(pregunta, api, pendiente.current, { ultimoNodo: ultimoNodo.current })?.tipo !== "disenar") {
      const primera = interpretarOrden(pasos[0], api, pendiente.current, { ultimoNodo: ultimoNodo.current });
      if (primera) {
        void ejecutarPlan(pasos, primera);
        return;
      }
    }
    const orden = interpretarOrden(pregunta, api, pendiente.current, { ultimoNodo: ultimoNodo.current });
    if (orden) {
      ejecutar(orden);
      return;
    }
    agregarMelki(responder(pregunta, contexto));
  };

  /** Muestra el menú de tours (sin repetirlo si es lo último que dijo). */
  const mostrarTours = () => {
    setAbierto(true);
    setNoLeido(false);
    if (actual.current.mensajes.at(-1)?.acciones?.some((x) => x.detalle)) return;
    agregarMelki(menuTours());
    setNoLeido(false);
  };

  const pulsarAccion = (a: AccionRespuesta, clave: string) => {
    if (a.accion === "deshacer") deshacer(a.escenario, clave);
    else if (a.accion === "orden" && a.orden) {
      setUsados((u) => new Set(u).add(clave));
      ejecutar(a.orden);
    } else if (a.accion === "tours") mostrarTours();
    else if (a.accion === "recorrido") {
      // En «Hablar con Melki» la conversación se usa durante el tour
      if (a.tour !== "melki") setAbierto(false);
      onTour(a.tour ?? "basico");
    } else onAccion(a.accion);
  };

  const cerrarOferta = (tours: boolean) => {
    setOferta(false);
    guardarPreferencias({ voz: vozActiva });
    if (tours) mostrarTours();
  };

  // Avisos de los tours y de la barra superior
  const avisos = useRef({ preguntar, mostrarTours, cerrarOferta, oferta });
  useEffect(() => {
    avisos.current = { preguntar, mostrarTours, cerrarOferta, oferta };
  });
  useEffect(() => {
    const abrir = () => {
      setAbierto(true);
      setNoLeido(false);
      if (avisos.current.oferta) avisos.current.cerrarOferta(false);
    };
    const tours = () => {
      if (avisos.current.oferta) avisos.current.cerrarOferta(false);
      avisos.current.mostrarTours();
    };
    const pedir = (e: Event) => {
      abrir();
      const texto = (e as CustomEvent<string>).detail;
      if (texto) avisos.current.preguntar(texto);
      setNoLeido(false);
    };
    const cambio = () => {
      ultimoDeshacer.current = null;
      pendiente.current = null;
      esperando.current = null;
      setCorte(siguiente.current);
    };
    window.addEventListener("melki:abrir", abrir);
    window.addEventListener("melki:tours", tours);
    window.addEventListener("melki:pedir", pedir);
    window.addEventListener("melki:escenario-cambiado", cambio);
    return () => {
      window.removeEventListener("melki:abrir", abrir);
      window.removeEventListener("melki:tours", tours);
      window.removeEventListener("melki:pedir", pedir);
      window.removeEventListener("melki:escenario-cambiado", cambio);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute right-3 bottom-8 z-30 flex flex-col items-end gap-3">
      {abierto && (
        <section
          className="pointer-events-auto flex h-[min(560px,calc(100dvh-170px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl bg-white text-carbon shadow-2xl ring-1 ring-black/10"
          aria-label="Conversación con Melki"
          data-tour="melki-chat"
        >
          <header className="flex items-center gap-3 border-b border-linea bg-melki-clara/60 px-3.5 py-2.5">
            <MelkiAvatar className="h-10 w-10" hablando={hablando} />
            <div className="min-w-0 flex-1">
              <p className="font-cond text-[17px] leading-tight font-semibold">Melki</p>
              <p className="text-[12px] text-tenue">Asistente del simulador</p>
            </div>
            {vozDisponible() && (
              <button
                type="button"
                onClick={() => {
                  const v = !vozActiva;
                  onVoz(v);
                  guardarPreferencias({ voz: v });
                  if (!v) {
                    callar();
                    setHablando(false);
                  }
                }}
                className="rounded-md p-1.5 text-carbon-2 hover:bg-black/5"
                aria-pressed={vozActiva}
                title={vozActiva ? "Silenciar a Melki" : "Escuchar las respuestas"}
                aria-label={vozActiva ? "Silenciar a Melki" : "Escuchar las respuestas"}
              >
                {vozActiva ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            )}
            {(hayReconocimientoNavegador() || hayMicrofono()) && (
              <button
                type="button"
                onClick={() => setAjustes((v) => !v)}
                className={`rounded-md p-1.5 hover:bg-black/5 ${ajustes ? "bg-black/5 text-carbon" : "text-carbon-2"}`}
                aria-expanded={ajustes}
                title="Ajustes de voz"
                aria-label="Ajustes de voz"
              >
                <Settings2 size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                cortarDictado();
                setAbierto(false);
              }}
              className="rounded-md p-1.5 text-carbon-2 hover:bg-black/5"
              aria-label="Cerrar conversación"
            >
              <X size={18} />
            </button>
          </header>
          {ajustes && (
            <div className="border-b border-linea bg-white px-3.5 py-3 text-[13px]" role="group" aria-label="Ajustes de voz">
              <p className="mb-1.5 font-cond text-[14px] font-semibold">Dictado por voz</p>
              <div className="space-y-1.5" role="radiogroup" aria-label="Modo de dictado">
                <OpcionDictado
                  activo={modoDictado === "navegador"}
                  deshabilitado={!hayReconocimientoNavegador()}
                  icono={<Globe size={16} />}
                  titulo="Con el navegador"
                  detalle={hayReconocimientoNavegador() ? "Más preciso y el texto aparece mientras habla. Usa internet: Edge o Chrome procesan el audio en sus servidores." : "Este navegador no lo trae."}
                  onElegir={() => fijarModo("navegador", false)}
                />
                <OpcionDictado
                  activo={modoDictado === "privado"}
                  deshabilitado={!hayMicrofono()}
                  icono={<ShieldCheck size={16} />}
                  titulo="Privado, sin internet"
                  detalle="El audio no sale de este equipo. La primera vez puede descargar el reconocedor (unos 100 MB); después funciona sin conexión."
                  onElegir={() => fijarModo("privado", false)}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-tenue">
                <span>{descargado ? "Reconocedor privado descargado en este equipo." : "En los dos casos usted revisa el texto antes de enviarlo."}</span>
                {descargado && (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-sin hover:bg-sin/10"
                    onClick={() => {
                      cortarDictado();
                      void borrarReconocedor().then(() => setDescargado(false));
                    }}
                  >
                    <Trash2 size={13} /> Borrarlo
                  </button>
                )}
              </div>
            </div>
          )}
          <div ref={lista} className="desplazable flex-1 space-y-3 overflow-y-auto px-3.5 py-3" aria-live="polite">
            {mensajes.map((m) => (
              <div key={m.id} data-mensaje={m.id} className={m.de === "usuario" ? "flex justify-end" : "flex gap-2"}>
                {m.de === "melki" && <MelkiAvatar className="mt-0.5 h-7 w-7 shrink-0" />}
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-snug whitespace-pre-line ${m.de === "usuario" ? "rounded-br-md bg-carbon text-white" : "rounded-tl-md bg-papel"}`}>
                  {m.texto}
                  {m.acciones?.some((a) => a.detalle) && (
                    <div className="mt-2 space-y-1.5" role="group" aria-label="Tours guiados">
                      {m.acciones.map((a, i) => {
                        const clave = `${m.id}:${i}`;
                        return (
                          <button
                            key={clave}
                            type="button"
                            onClick={() => pulsarAccion(a, clave)}
                            className="flex w-full items-start gap-2 rounded-xl bg-white px-2.5 py-2 text-left ring-1 ring-melki/50 hover:bg-melki-clara"
                          >
                            <Compass size={16} className="mt-0.5 shrink-0 text-melki-oscura" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block text-[13.5px] font-medium text-carbon">{a.texto}</span>
                              {a.detalle && <span className="block text-[12px] leading-snug text-tenue">{a.detalle}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {m.acciones && !m.acciones.some((a) => a.detalle) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.acciones.map((a, i) => {
                        const clave = `${m.id}:${i}`;
                        const usado = usados.has(clave) || (a.accion === "deshacer" && m.id < corte);
                        return (
                          <button
                            key={clave}
                            type="button"
                            disabled={usado}
                            onClick={() => pulsarAccion(a, clave)}
                            className="rounded-full bg-white px-2.5 py-1 text-[13px] font-medium text-carbon ring-1 ring-melki/60 hover:bg-melki-clara disabled:cursor-default disabled:opacity-50 disabled:hover:bg-white"
                          >
                            {a.texto}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" onClick={() => preguntar(s)} className="rounded-full bg-papel px-2.5 py-1 text-[12px] text-carbon-2 hover:bg-papel-2">
                {s}
              </button>
            ))}
          </div>
          {elegirModo && (
            <div className="mx-2.5 mb-2 rounded-xl bg-papel p-2.5 text-[13px] ring-1 ring-linea" role="dialog" aria-label="¿Cómo quiere dictar?">
              <p className="mb-1.5 font-cond text-[14px] font-semibold">¿Cómo quiere dictar?</p>
              <div className="space-y-1.5">
                <OpcionDictado
                  deshabilitado={!hayReconocimientoNavegador()}
                  icono={<Globe size={16} />}
                  titulo="Con el navegador"
                  detalle={hayReconocimientoNavegador() ? "Más preciso; el texto aparece mientras habla. Usa internet (Edge o Chrome procesan el audio)." : "Este navegador no lo trae."}
                  onElegir={() => fijarModo("navegador", true)}
                />
                <OpcionDictado
                  deshabilitado={!hayMicrofono()}
                  icono={<ShieldCheck size={16} />}
                  titulo="Privado, sin internet"
                  detalle="El audio no sale del equipo. La primera vez puede descargar unos 100 MB."
                  onElegir={() => fijarModo("privado", true)}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-tenue">Lo puede cambiar después en Ajustes de voz.</p>
            </div>
          )}
          {(dictado !== "inactivo" || errorDictado) && (
            <div className={`mx-2.5 mb-1.5 flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug ${errorDictado ? "bg-sin/10 text-carbon" : "bg-melki-clara/60 text-carbon-2"}`} role="status">
              {errorDictado ? null : dictado === "escuchando" ? (
                <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-sin" aria-hidden="true" />
              ) : (
                <LoaderCircle size={14} className="mt-0.5 shrink-0 animate-spin" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                {errorDictado ??
                  (dictado === "escuchando"
                    ? `Escuchando${detalleDictado ? ` ${detalleDictado}` : ""}… Revise el texto y envíelo cuando quiera. Toque el micrófono para terminar.`
                    : dictado === "transcribiendo"
                      ? "Transcribiendo…"
                      : (detalleDictado ?? "Preparando el dictado…"))}
              </span>
              {errorDictado && (
                <button type="button" onClick={() => setErrorDictado(null)} className="-mt-0.5 rounded p-0.5 text-tenue hover:bg-black/5" aria-label="Cerrar aviso">
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          <form
            className="flex items-end gap-2 border-t border-linea p-2.5"
            data-tour="melki-entrada"
            onSubmit={(e) => {
              e.preventDefault();
              preguntar(texto);
            }}
          >
            <textarea
              ref={entrada}
              rows={1}
              className="campo desplazable flex-1 resize-none py-2 leading-snug"
              placeholder="Pregunte o pida algo, o toque el micrófono para dictar"
              value={texto}
              onChange={(e) => {
                // Si escribe mientras dicta, el dictado se detiene y queda lo que usted escribió
                if (sesion.current || control.current) cortarDictado();
                setTexto(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  preguntar(texto);
                }
              }}
              aria-label="Pregunta para Melki"
              maxLength={600}
            />
            {(hayReconocimientoNavegador() || hayMicrofono()) && (
              <button
                type="button"
                onClick={pulsarMicrofono}
                className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg ring-1 transition-colors ${
                  dictado === "escuchando" ? "bg-sin text-white ring-sin" : dictado === "inactivo" ? "bg-white text-carbon ring-linea hover:bg-papel-2" : "bg-melki-clara text-carbon ring-melki/60"
                }`}
                aria-pressed={dictado !== "inactivo"}
                data-tour="microfono"
                aria-label={dictado === "inactivo" ? "Dictar por voz" : dictado === "preparando" ? "Cancelar el dictado" : "Terminar el dictado"}
                title={dictado === "inactivo" ? "Dictar por voz: el texto aparece en la caja para revisarlo antes de enviar" : "Terminar el dictado"}
              >
                {dictado === "inactivo" ? <Mic size={17} /> : dictado === "escuchando" ? <Square size={14} fill="currentColor" /> : <LoaderCircle size={17} className="animate-spin" />}
              </button>
            )}
            <button type="submit" className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-carbon text-white hover:bg-carbon-2 disabled:bg-carbon/40" disabled={!texto.trim()} aria-label="Enviar">
              <Send size={16} />
            </button>
          </form>
        </section>
      )}

      {oferta && !abierto && (
        <div className="pointer-events-auto w-64 rounded-2xl rounded-br-md bg-white p-3.5 text-carbon shadow-xl ring-1 ring-black/10" role="dialog" aria-label="Bienvenida de Melki">
          <p className="text-[14px] leading-snug">Soy Melki. ¿Le enseño a usar el simulador? Tengo un tutorial básico de 3 minutos y otros tours guiados.</p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => cerrarOferta(true)} className="rounded-lg bg-carbon px-3 py-1.5 text-[13px] font-medium text-white hover:bg-carbon-2">
              Sí, muéstreme
            </button>
            <button type="button" onClick={() => cerrarOferta(false)} className="rounded-lg px-3 py-1.5 text-[13px] text-carbon-2 hover:bg-black/5">
              Ahora no
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setAbierto((v) => !v);
          setNoLeido(false);
          if (oferta) cerrarOferta(false);
        }}
        className="pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full bg-white shadow-lg ring-2 ring-melki/70 transition-transform hover:scale-105"
        aria-label={abierto ? "Cerrar a Melki" : noLeido ? "Abrir a Melki: tiene un mensaje nuevo" : "Abrir a Melki, el asistente"}
        aria-expanded={abierto}
        data-tour="melki"
      >
        <MelkiAvatar className="h-12 w-12" hablando={hablando} />
        {noLeido && !abierto && <span className="absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-melki ring-2 ring-white" aria-hidden="true" />}
      </button>
    </div>
  );
}

function OpcionDictado({
  activo,
  deshabilitado,
  icono,
  titulo,
  detalle,
  onElegir,
}: {
  activo?: boolean;
  deshabilitado?: boolean;
  icono: ReactNode;
  titulo: string;
  detalle: string;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      role={activo === undefined ? undefined : "radio"}
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={onElegir}
      className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        activo ? "bg-salvia-clara/60 ring-salvia" : "bg-white ring-linea hover:bg-papel-2"
      }`}
    >
      <span className="mt-0.5 shrink-0 text-salvia-oscura">{icono}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-carbon">{titulo}</span>
        <span className="block text-[12px] leading-snug text-tenue">{detalle}</span>
      </span>
    </button>
  );
}
