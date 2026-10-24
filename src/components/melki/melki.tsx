// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// Melki: botón flotante, conversación con el cerebro local, órdenes sobre el simulador (con deshacer),
// aviso del resultado cuando termina la simulación, voz, dictado, el Asistente Melki por voz (tipo Jarvis: escucha
// todo el tiempo, se activa con «Hola Melki», ejecuta y contesta en voz alta con trato de mayordomo; al activarse deja
// el mapa libre y sugiere los paneles cuando hacen falta) y menú de tours guiados (también en la primera visita).
// Escucha avisos de la ventana: «melki:abrir», «melki:tours» y «melki:pedir» (los usan los tours y la barra superior).
import { AudioLines, Compass, Globe, LoaderCircle, Mic, Play, Send, Settings2, ShieldCheck, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { consejoRed, estadoRed, piezaDe } from "@/lib/radio/estado-red";
import type { Escenario, ResultadoSimulacion } from "@/lib/radio/tipos";

import { MelkiAvatar } from "./avatar";
import { HudVoz, type SugerenciaHud } from "./hud-voz";
import { AYUDA_VOZ, controlDeVoz, detectarActivacion, frases, limpiarComando, pareceEco, textoParaVoz, type EstadoManosLibres, type Trato } from "./manos-libres";
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
import { alCargarVoces, callar, fijarVozPreferida, hablar, puntajeVoz, sonando, vocesEspanol, vozDisponible } from "./voz";

type Mensaje = { id: number; de: "melki" | "usuario"; texto: string; acciones?: AccionRespuesta[]; voz?: boolean };

const CLAVE = "simulador-cobertura-melki-v1";
const f1 = (x: number, d = 1) => x.toFixed(d).replace(".", ",");

/**
 * Asistente Melki: seguir la conversación sin repetir «Melki», leer las respuestas completas, el sonido al activarse,
 * ocultar los paneles al activarse, activarse al abrir el simulador, el trato (señor, señora o ninguno) y la voz.
 */
type PreferenciasManos = { seguir: boolean; completo: boolean; sonido: boolean; ocultar: boolean; siempre: boolean; trato: Trato; voz: string | null };
const MANOS_DEFECTO: PreferenciasManos = { seguir: true, completo: false, sonido: true, ocultar: true, siempre: false, trato: "senor", voz: null };

type Lado = "izquierdo" | "derecho";
type Paneles = { izquierdo: boolean; derecho: boolean };

/** Órdenes cuyo resultado se ve mejor en el panel de resultados (con los paneles ocultos, Melki ofrece mostrarlo). */
const VER_RESULTADOS = new Set<Orden["tipo"]>([
  "simular",
  "estres",
  "carga",
  "limite",
  "zonas",
  "poblar",
  "ajustar",
  "aplicar-ajuste",
  "disenar",
  "cobertura-area",
  "area-objetivo",
  "sembrar",
  "aceptar-siembra",
  "mensaje",
]);
/** Órdenes que se revisan mejor en el panel de herramientas (los nodos y los parámetros). */
const VER_HERRAMIENTAS = new Set<Orden["tipo"]>(["agregar", "pieza", "editar", "editar-varios", "renombrar", "duplicar", "parametros"]);

/** ¿Pantalla de computador (con paneles a los lados del mapa)? */
const ANCHO = "(min-width: 1024px)";
const esEscritorio = () => typeof window !== "undefined" && window.matchMedia?.(ANCHO).matches === true;
const suscribirAncho = (fn: () => void) => {
  const q = window.matchMedia?.(ANCHO);
  q?.addEventListener("change", fn);
  return () => q?.removeEventListener("change", fn);
};

/** Permiso del micrófono para este sitio («granted»: no vuelve a preguntar). */
async function permisoMicrofono(): Promise<PermissionState | "desconocido"> {
  try {
    return (await navigator.permissions.query({ name: "microphone" as PermissionName })).state;
  } catch {
    return "desconocido";
  }
}

type Preferencias = { visto: boolean; voz: boolean; dictado?: ModoDictado; manos?: PreferenciasManos };

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
  else if (red.conectadas.length) acciones.push({ texto: "Enviar un mensaje de prueba", accion: "orden", orden: { tipo: "mensaje" } });
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
  /** Asistente Melki: escucha y se activa con su nombre. */
  manosLibres: boolean;
  onManosLibres: (v: boolean) => void;
  /** Qué paneles de los lados están abiertos en el computador. */
  paneles: Paneles;
};

/** Reloj del asistente (milisegundos). */
const reloj = () => Date.now();

/** Dos notas cortas al oír su nombre (o al dejar de escuchar). */
let contextoTono: AudioContext | null = null;
function tono(subir: boolean) {
  try {
    contextoTono ??= new AudioContext();
    const c = contextoTono;
    if (c.state === "suspended") void c.resume();
    const t0 = c.currentTime;
    (subir ? [740, 1110] : [880, 587]).forEach((f, k) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, t0 + k * 0.09);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + k * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + k * 0.09 + 0.12);
      o.connect(g).connect(c.destination);
      o.start(t0 + k * 0.09);
      o.stop(t0 + k * 0.09 + 0.14);
    });
  } catch {
    // Sin audio: solo se ve en la barra
  }
}

export function Melki({ contexto, api, suscribir, restaurar, onAccion, onTour, vozActiva, onVoz, manosLibres, onManosLibres, paneles }: Props) {
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
  // Asistente Melki
  const [estadoVoz, setEstadoVoz] = useState<EstadoManosLibres>("apagado");
  const [escuchado, setEscuchado] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);
  const [motorVoz, setMotorVoz] = useState("");
  const [manos, setManos] = useState<PreferenciasManos>(() => ({ ...MANOS_DEFECTO, ...leerPreferencias().manos }));
  /** El panel que Melki acaba de sugerir (brilla en su barra). */
  const [resaltado, setResaltado] = useState<Lado | null>(null);
  /** El navegador no deja hablar hasta que la persona toque la página (al activarse solo, al abrir). */
  const [vozBloqueada, setVozBloqueada] = useState(false);
  const [voces, setVoces] = useState<{ nombre: string; idioma: string; natural: boolean }[]>([]);
  const [permiso, setPermiso] = useState<PermissionState | "desconocido">("desconocido");
  const escritorio = useSyncExternalStore(suscribirAncho, esEscritorio, () => false);
  const ml = useRef({
    activo: false,
    estado: "apagado" as EstadoManosLibres,
    sesion: null as Dictado | null,
    control: null as ControlDictado | null,
    consumido: 0,
    cola: [] as string[],
    hablandoHasta: 0,
    /** Hay voz sonando de verdad (con los subtítulos solos no hay eco que evitar). */
    conVoz: false,
    /** La frase que se está oyendo empezó mientras Melki hablaba: es su propia voz. */
    inicioDuranteVoz: false,
    /** Lo dicho en voz alta hace poco, para reconocer el eco. */
    recientes: [] as { texto: string; hasta: number }[],
    /** Después de hablar: quedarse atento (seguir la conversación) o volver a esperar su nombre. */
    trasHablar: "atento" as "atento" | "esperando",
    /** Al apagar con una despedida, no se corta lo que está diciendo. */
    despedida: false,
    /** Manos libres encendió la voz de Melki y la pantalla todavía no se enteró. */
    encendioVoz: false,
    ultimoDicho: "",
    ultimoCompleto: "",
    comando: "",
    atento: 0,
    espera: 0,
    pensando: 0,
    reinicios: [] as number[],
    saludado: false,
    /** Cuántas veces lo han llamado solo por su nombre (para no contestar siempre igual). */
    llamados: 0,
    /** Cuándo lo despertó su nombre en lo que se iba oyendo (para no sonar dos veces). */
    desperto: 0,
    /** Paneles abiertos antes de activarse: se devuelven al apagarlo. */
    panelesAntes: null as Paneles | null,
    /** Cuándo sugirió cada panel, si dijeron que no y cuándo hizo la última sugerencia. */
    sugerido: { izquierdo: 0, derecho: 0 },
    rechazado: { izquierdo: false, derecho: false },
    ultimaSugerencia: 0,
    /** El mensaje de la última sugerencia (si le dicen «no» justo después, no la repite). */
    sugerencia: null as { id: number; lado: Lado } | null,
    /** Lo que no pudo decir porque el navegador no dejaba hablar todavía. */
    bloqueada: "",
  });
  const actual = useRef({ abierto, vozActiva, api, mensajes, manos, usados, paneles });
  useEffect(() => {
    actual.current = { abierto, vozActiva, api, mensajes, manos, usados, paneles };
  });
  /** Las frases del asistente con el trato elegido. */
  const fr = () => frases(actual.current.manos.trato);
  useEffect(() => {
    fijarVozPreferida(manos.voz);
  }, [manos.voz]);
  // Desde que la pantalla sabe si la voz está encendida, manda ella (si el usuario la silencia, se respeta)
  useEffect(() => {
    ml.current.encendioVoz = false;
  }, [vozActiva]);

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
      const m = ml.current;
      m.activo = false;
      if (m.control) m.control.cancelado = true;
      m.sesion?.cancelar();
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
    if (!ajustes) return;
    void reconocedorDescargado().then(setDescargado);
    void permisoMicrofono().then(setPermiso);
    // Las voces del equipo (llegan tarde la primera vez)
    const leer = () => setVoces(vocesEspanol().map((v) => ({ nombre: v.name, idioma: v.lang, natural: puntajeVoz(v) >= 70 })));
    const t = window.setTimeout(leer, 0);
    const quitar = alCargarVoces(leer);
    return () => {
      window.clearTimeout(t);
      quitar();
    };
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
    // El dictado en la caja y el modo manos libres usan el mismo micrófono
    if (ml.current.activo) onManosLibres(false);
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
    if (ml.current.activo) {
      encolarVoz(t);
      return;
    }
    if (!actual.current.vozActiva) return;
    setHablando(true);
    hablar(t, () => setHablando(false));
  };

  const agregarMelki = (r: Respuesta) => {
    setMensajes((m) => [...m, { id: siguiente.current++, de: "melki", texto: r.texto, acciones: r.acciones }]);
    if (!actual.current.abierto) setNoLeido(true);
    decir(r.texto);
  };

  /* ───────────── Asistente Melki (por voz) ───────────── */

  const fijarEstadoVoz = (e: EstadoManosLibres) => {
    ml.current.estado = e;
    setEstadoVoz(e);
  };

  /** Después de hablar (o de oír solo su nombre) se queda atento unos segundos; luego vuelve a esperar su nombre. */
  const quedarAtento = () => {
    const m = ml.current;
    window.clearTimeout(m.atento);
    if (!m.activo) return;
    if (!actual.current.manos.seguir) {
      fijarEstadoVoz("esperando");
      return;
    }
    fijarEstadoVoz("atento");
    m.atento = window.setTimeout(() => {
      if (m.activo && m.estado === "atento" && !m.comando) {
        fijarEstadoVoz("esperando");
        setEscuchado("");
      }
    }, 9000);
  };

  /**
   * Lee en voz alta, en orden, lo que Melki va respondiendo (resumido, salvo que se pida completo). Con `guardar` en
   * falso no cambia lo que se lee con «más detalle» (los saludos y las sugerencias).
   */
  const encolarVoz = (texto: string, completo = actual.current.manos.completo, despues: "atento" | "esperando" = "atento", guardar = true) => {
    const m = ml.current;
    m.trasHablar = despues;
    if (guardar) m.ultimoCompleto = texto;
    m.cola.push(textoParaVoz(texto, completo));
    window.clearTimeout(m.pensando);
    if (m.estado !== "hablando") siguienteVoz();
  };

  const siguienteVoz = () => {
    const m = ml.current;
    const t = m.cola.shift();
    if (!m.activo) {
      m.cola = [];
      return;
    }
    if (t === undefined) {
      setHablando(false);
      if (m.conVoz) m.hablandoHasta = reloj();
      m.conVoz = false;
      if (m.trasHablar === "esperando") {
        m.trasHablar = "atento";
        fijarEstadoVoz("esperando");
        setEscuchado("");
      } else quedarAtento();
      return;
    }
    fijarEstadoVoz("hablando");
    setSubtitulo(t);
    m.ultimoDicho = t;
    if (!(actual.current.vozActiva || m.encendioVoz) || !vozDisponible()) {
      // Sin voz: solo subtítulos, el tiempo de leerlos
      m.conVoz = false;
      window.setTimeout(() => ml.current.estado === "hablando" && siguienteVoz(), Math.min(6000, 1200 + t.length * 45));
      return;
    }
    // Si se activó solo (al abrir el simulador), el navegador no deja hablar hasta que la persona toque la página
    const activacion = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activacion && !activacion.hasBeenActive) {
      vozRef.current.bloqueoVoz(t);
      m.conVoz = false;
      window.setTimeout(() => ml.current.estado === "hablando" && siguienteVoz(), Math.min(6000, 1200 + t.length * 45));
      return;
    }
    m.conVoz = true;
    setHablando(true);
    hablar(
      t,
      () => {
        const x = ml.current;
        x.hablandoHasta = reloj();
        x.recientes = [...x.recientes.filter((r) => x.hablandoHasta - r.hasta < 8000), { texto: t, hasta: x.hablandoHasta }];
        if (x.estado === "hablando") siguienteVoz();
      },
      (error) => error === "not-allowed" && vozRef.current.bloqueoVoz(t),
    );
  };

  /** Guarda lo que no pudo decir y muestra «Toque aquí para oír mi voz». */
  const bloqueoVoz = (t: string) => {
    const m = ml.current;
    if (!m.bloqueada) m.bloqueada = t;
    setVozBloqueada(true);
  };

  /** Con el primer toque de la persona ya puede hablar: dice lo que tenía pendiente (el saludo). */
  const desbloquearVoz = () => {
    const m = ml.current;
    const t = m.bloqueada;
    m.bloqueada = "";
    setVozBloqueada(false);
    if (t && m.activo && (m.estado === "esperando" || m.estado === "atento")) encolarVoz(t, true, m.estado === "esperando" ? "esperando" : "atento", false);
  };

  const callarYa = () => {
    const m = ml.current;
    m.cola = [];
    callar();
    setHablando(false);
    if (m.conVoz) m.hablandoHasta = reloj();
    m.conVoz = false;
    if (m.activo) quedarAtento();
  };

  /**
   * Una frase nueva empieza a oírse: si Melki está hablando (o acaba de terminar: el reconocimiento avisa unas décimas
   * después de que empieza la voz), es su propia voz que entra por el micrófono.
   */
  const inicioFrase = () => {
    const m = ml.current;
    m.inicioDuranteVoz = (m.estado === "hablando" && m.conVoz) || sonando() || reloj() - m.hablandoHasta < 800;
  };

  /**
   * ¿Lo que llegó es eco del final de lo último que Melki dijo? Solo enseguida de terminar y comparando con sus últimas
   * palabras: si el usuario repite un ejemplo que Melki dio («pantalla limpia»), es un pedido.
   */
  const esEco = (frase: string) => {
    const m = ml.current;
    const desde = reloj() - m.hablandoHasta;
    const ultimo = m.recientes.at(-1);
    if (!ultimo || desde > 2000) return false;
    const cola = ultimo.texto.split(/\s+/).slice(-25).join(" ");
    return pareceEco(frase, cola) && (frase.trim().split(/\s+/).length > 1 || desde < 1200);
  };

  /** Lo que llega del reconocimiento: busca el llamado («Hola Melki») y arma el pedido. */
  const oirTexto = (final: string, parcial: string) => {
    const m = ml.current;
    if (!m.activo) return;
    if (final.length < m.consumido) m.consumido = 0;
    const nuevo = final.slice(m.consumido).trim();
    // Mientras suena una voz (la de Melki o la de un tour) no se le hace caso a lo que se oye, salvo «Melki, para»;
    // tampoco a lo que empezó a oírse mientras sonaba ni a lo que repite lo que Melki acaba de decir (el eco).
    const sonandoAhora = (m.estado === "hablando" && m.conVoz) || sonando() || reloj() - m.hablandoHasta < 600;
    const ocupado = sonandoAhora || m.inicioDuranteVoz;
    if (nuevo) {
      m.consumido = final.length;
      const duranteVoz = m.inicioDuranteVoz;
      m.inicioDuranteVoz = false;
      if (sonandoAhora || duranteVoz || esEco(nuevo)) {
        const a = detectarActivacion(nuevo);
        if (a.activado && controlDeVoz(a.resto)?.tipo === "callar" && !esEco(nuevo)) callarYa();
      } else procesarFrase(nuevo);
    }
    if (!ocupado && parcial) {
      if (m.estado === "atento" || m.comando) setEscuchado(`${m.comando ? `${m.comando} ` : ""}${parcial}`.trim());
      else if (m.estado === "esperando" && detectarActivacion(parcial).activado) {
        // Ya se oyó su nombre: responde enseguida, sin esperar a que termine la frase
        if (actual.current.manos.sonido) tono(true);
        m.desperto = reloj();
        window.clearTimeout(m.atento);
        fijarEstadoVoz("atento");
        setEscuchado(detectarActivacion(parcial).resto);
      }
    }
  };

  const procesarFrase = (frase: string) => {
    const m = ml.current;
    const a = detectarActivacion(frase);
    if (m.estado === "pensando") {
      if (a.activado && controlDeVoz(a.resto)?.tipo === "apagar") onManosLibres(false);
      return;
    }
    if (m.estado === "esperando" || m.estado === "preparando") {
      if (!a.activado) {
        // Sin su nombre no hace nada (por si alguien habla cerca)
        if (m.estado === "esperando") setEscuchado("");
        return;
      }
      if (actual.current.manos.sonido) tono(true);
      if (!a.resto) {
        // Solo su nombre: contesta como un mayordomo y se queda atento al pedido
        setEscuchado("");
        encolarVoz(fr().llamado(m.llamados++, a.ingles), true, "atento", false);
        return;
      }
      acumular(a.resto);
      return;
    }
    // Atento: lo que diga es el pedido (si repite su nombre, se quita). Solo su nombre: contesta como un mayordomo
    // (el sonido ya lo dio si lo despertó lo que se iba oyendo de esta misma frase)
    if (a.activado && !a.resto) {
      if (actual.current.manos.sonido && reloj() - m.desperto > 3000) tono(true);
      setEscuchado("");
      encolarVoz(fr().llamado(m.llamados++, a.ingles), true, "atento", false);
      return;
    }
    acumular(a.activado ? a.resto : frase);
  };

  /** Junta lo que se dice seguido (una pausa corta no corta el pedido) y lo ejecuta. */
  const acumular = (t: string) => {
    const m = ml.current;
    // Si habla encima de los subtítulos, lo que faltaba por mostrar ya no importa
    if (m.estado === "hablando") m.cola = [];
    m.comando = m.comando ? `${m.comando} ${t}` : t;
    setEscuchado(m.comando);
    window.clearTimeout(m.atento);
    window.clearTimeout(m.espera);
    fijarEstadoVoz("atento");
    m.espera = window.setTimeout(() => vozRef.current.ejecutarVoz(), 700);
  };

  const ejecutarVoz = () => {
    const m = ml.current;
    const dicho = m.comando.trim();
    m.comando = "";
    if (!dicho || !m.activo) return;
    const c = controlDeVoz(dicho);
    if (c) {
      if (c.tipo === "callar") return callarYa();
      if (c.tipo === "repetir") {
        m.cola.push(m.ultimoDicho || "Todavía no he dicho nada.");
        return siguienteVoz();
      }
      if (c.tipo === "detalle") return encolarVoz(m.ultimoCompleto || "No tengo una respuesta anterior.", true);
      if (c.tipo === "apagar") {
        m.cola = [];
        m.despedida = true;
        setSubtitulo(fr().despedida);
        if (actual.current.vozActiva || m.encendioVoz) hablar(fr().despedida);
        onManosLibres(false);
        return;
      }
      if (c.tipo === "gracias") {
        // «Ok», «vale» o «listo» después de una pregunta de Melki con un botón es un sí
        const previo = [...actual.current.mensajes].reverse().find((x) => x.de === "melki");
        const conBoton = previo?.acciones?.some((x) => x.accion !== "deshacer") && /¿[^?]*\?\s*$/.test(previo.texto.split("\n")[0] ?? "");
        if (conBoton && /^(ok|okey|vale|listo|perfecto|de acuerdo)$/i.test(dicho.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,!¡]/g, "").trim()))
          return ejecutarVozComo("sí");
        return encolarVoz(fr().gracias, false, "esperando", false);
      }
      if (c.tipo === "no") {
        // «No» a una sugerencia de panel: no la vuelve a ofrecer mientras esté activo
        const previo = [...actual.current.mensajes].reverse().find((x) => x.de === "melki");
        if (m.sugerencia && previo?.id === m.sugerencia.id) {
          m.rechazado[m.sugerencia.lado] = true;
          setResaltado(null);
          return encolarVoz(fr().sinPanel, false, "esperando", false);
        }
        return encolarVoz(fr().nada, false, "esperando", false);
      }
      if (c.tipo === "ayuda") {
        setMensajes((x) => [...x, { id: siguiente.current++, de: "usuario", texto: dicho, voz: true }]);
        setMensajes((x) => [...x, { id: siguiente.current++, de: "melki", texto: AYUDA_VOZ }]);
        return encolarVoz(AYUDA_VOZ, true);
      }
      if (c.tipo === "accion") {
        // Los botones de la última respuesta de Melki; «sí, hazlo» nunca es «Deshacer»
        const ultimo = [...actual.current.mensajes].reverse().find((x) => x.de === "melki");
        const lista = ultimo?.acciones ?? [];
        const afirmativo = c.indice === 0 && !/\b(primer[oa]?|uno|una|1)\b/.test(dicho.toLowerCase());
        const i = c.indice === "ultima" ? lista.length - 1 : afirmativo ? lista.findIndex((x) => x.accion !== "deshacer") : c.indice;
        const a = lista[i];
        if (!ultimo || !a) return encolarVoz(afirmativo ? fr().sinPendiente : fr().sinOpcion, true, "atento", false);
        if (actual.current.usados.has(`${ultimo.id}:${i}`)) return encolarVoz(fr().yaHecho, true, "atento", false);
        setMensajes((x) => [...x, { id: siguiente.current++, de: "usuario", texto: dicho, voz: true }]);
        fijarEstadoVoz("pensando");
        // Algunos botones no responden con un mensaje (abrir un panel, empezar un tour): vuelve a escuchar
        window.clearTimeout(m.pensando);
        m.pensando = window.setTimeout(() => ml.current.estado === "pensando" && quedarAtento(), 2500);
        vozRef.current.pulsarAccion(a, `${ultimo.id}:${i}`);
        return;
      }
    }
    const texto = limpiarComando(dicho);
    fijarEstadoVoz("pensando");
    setEscuchado(texto);
    // Si nada responde (no debería pasar), vuelve a escuchar
    window.clearTimeout(m.pensando);
    m.pensando = window.setTimeout(() => ml.current.estado === "pensando" && quedarAtento(), 15000);
    vozRef.current.preguntar(texto, true);
  };

  const ejecutarVozComo = (dicho: string) => {
    ml.current.comando = dicho;
    ejecutarVoz();
  };

  const arrancarEscucha = async (modo: ModoDictado) => {
    const m = ml.current;
    if (!m.activo) return;
    const c: ControlDictado = {};
    m.control = c;
    m.consumido = 0;
    try {
      const s = await iniciarDictado(
        modo,
        {
          onTexto: (final, parcial) => !c.cancelado && vozRef.current.oirTexto(final, parcial),
          onInicioFrase: () => !c.cancelado && vozRef.current.inicioFrase(),
          onEstado: (e, detalle) => {
            if (c.cancelado) return;
            if (e === "preparando" && detalle) setAvisoVoz(detalle);
            if (e === "escuchando") {
              setAvisoVoz(null);
              if (ml.current.estado === "preparando") vozRef.current.listoParaEscuchar();
            }
            // El reconocimiento del navegador se apaga solo de vez en cuando: se vuelve a encender
            if (e === "inactivo" && ml.current.activo && ml.current.control === c) vozRef.current.reanudar(modo);
          },
          onError: (mensaje) => {
            if (c.cancelado) return;
            setAvisoVoz(mensaje);
            if (/permiso|micr[oó]fono|no permite/i.test(mensaje)) {
              ml.current.activo = false;
              window.setTimeout(() => onManosLibres(false), 4000);
            }
          },
        },
        c,
      );
      if (c.cancelado) s.cancelar();
      else {
        m.sesion = s;
        setMotorVoz(s.motor === "navegador" ? "con el navegador" : "en este equipo");
      }
    } catch (e) {
      if (c.cancelado || e instanceof DictadoCancelado) return;
      setAvisoVoz(e instanceof Error ? e.message : String(e));
      m.activo = false;
      window.setTimeout(() => onManosLibres(false), 5000);
    }
  };

  const reanudar = (modo: ModoDictado) => {
    const m = ml.current;
    const ahora = reloj();
    m.reinicios = [...m.reinicios.filter((t) => ahora - t < 20000), ahora];
    if (m.reinicios.length > 8) {
      setAvisoVoz("El micrófono se apaga a cada rato. Revise la conexión o el permiso del micrófono y vuelva a activar el asistente.");
      m.activo = false;
      window.setTimeout(() => onManosLibres(false), 5000);
      return;
    }
    m.sesion = null;
    window.setTimeout(() => void vozRef.current.arrancarEscucha(modo), 250);
  };

  const listoParaEscuchar = () => {
    const m = ml.current;
    fijarEstadoVoz("esperando");
    // Al saludar vuelve a esperar su nombre (no toma como pedido lo que se diga cerca)
    const texto = fr().bienvenida(!m.saludado);
    m.saludado = true;
    setMensajes((x) => [...x, { id: siguiente.current++, de: "melki", texto }]);
    if (!actual.current.abierto) setNoLeido(true);
    encolarVoz(texto, true, "esperando", false);
  };

  const iniciarManosLibres = () => {
    const m = ml.current;
    if (m.activo) return;
    if (!hayReconocimientoNavegador() && !hayMicrofono()) {
      setAvisoVoz("Este navegador no puede escucharme. Use Edge o Chrome actualizados.");
      fijarEstadoVoz("preparando");
      window.setTimeout(() => onManosLibres(false), 4000);
      return;
    }
    cortarDictado();
    m.activo = true;
    m.comando = "";
    m.cola = [];
    m.reinicios = [];
    m.llamados = 0;
    m.sugerido = { izquierdo: 0, derecho: 0 };
    m.rechazado = { izquierdo: false, derecho: false };
    m.ultimaSugerencia = 0;
    m.sugerencia = null;
    m.bloqueada = "";
    setResaltado(null);
    setVozBloqueada(false);
    // Deja el mapa libre (en el celular cierra la hoja abierta); al apagarlo vuelven los paneles que estaban
    m.panelesAntes = null;
    if (actual.current.manos.ocultar) {
      const p = actual.current.paneles;
      if (esEscritorio()) m.panelesAntes = { ...p };
      // Uno por uno: los dos a la vez es «pantalla limpia», que además quita la selección del nodo
      if (p.izquierdo) actual.current.api.paneles({ izquierdo: false });
      if (p.derecho || !esEscritorio()) actual.current.api.paneles({ derecho: false });
    }
    setAvisoVoz(null);
    setEscuchado("");
    setSubtitulo("");
    if (!actual.current.vozActiva && vozDisponible()) {
      m.encendioVoz = true;
      onVoz(true);
    }
    fijarEstadoVoz("preparando");
    void arrancarEscucha(modoDictado ?? (hayReconocimientoNavegador() ? "navegador" : "privado"));
  };

  const detenerManosLibres = () => {
    const m = ml.current;
    const estaba = m.activo || m.estado !== "apagado";
    m.activo = false;
    window.clearTimeout(m.atento);
    window.clearTimeout(m.espera);
    window.clearTimeout(m.pensando);
    if (m.control) m.control.cancelado = true;
    m.sesion?.cancelar();
    m.sesion = null;
    m.control = null;
    m.cola = [];
    m.comando = "";
    if (estaba && m.estado === "hablando" && !m.despedida) callar();
    m.despedida = false;
    m.conVoz = false;
    setHablando(false);
    if (estaba && actual.current.manos.sonido && m.estado !== "apagado") tono(false);
    fijarEstadoVoz("apagado");
    setEscuchado("");
    setSubtitulo("");
    setAvisoVoz(null);
    setResaltado(null);
    setVozBloqueada(false);
    m.bloqueada = "";
    // Devuelve los paneles que estaban abiertos antes de activarse
    const antes = m.panelesAntes;
    m.panelesAntes = null;
    if (antes && esEscritorio()) {
      const p = actual.current.paneles;
      if (antes.izquierdo && !p.izquierdo) actual.current.api.paneles({ izquierdo: true });
      if (antes.derecho && !p.derecho) actual.current.api.paneles({ derecho: true });
    }
  };

  /**
   * Con los paneles ocultos, después de una orden cuyo resultado se ve mejor en un panel, ofrece mostrarlo: con una
   * pregunta (que «sí» u «ok» acepta) a lo sumo cada 3 minutos por panel, y solo una sugerencia por minuto. La barra
   * del asistente resalta el botón del panel aunque no lo diga.
   */
  const sugerirPanel = (tipo: Orden["tipo"] | "resultado") => {
    const m = ml.current;
    if (!m.activo || !esEscritorio()) return;
    const p = actual.current.paneles;
    const lado: Lado | null =
      tipo === "resultado" || VER_RESULTADOS.has(tipo) ? (p.derecho ? null : "derecho") : VER_HERRAMIENTAS.has(tipo) && !p.izquierdo ? "izquierdo" : null;
    if (!lado || m.rechazado[lado]) return;
    setResaltado(lado);
    const ahora = reloj();
    if (ahora - m.sugerido[lado] < 180000 || ahora - m.ultimaSugerencia < 60000) return;
    m.sugerido[lado] = ahora;
    m.ultimaSugerencia = ahora;
    const texto = lado === "derecho" ? fr().verResultados : fr().verHerramientas;
    const id = siguiente.current++;
    m.sugerencia = { id, lado };
    setMensajes((x) => [
      ...x,
      { id, de: "melki", texto, acciones: [lado === "derecho" ? { texto: "Mostrar resultados", accion: "resultados" } : { texto: "Mostrar herramientas", accion: "herramientas" }] },
    ]);
    encolarVoz(texto, true, "atento", false);
  };

  /** Muestra el panel de resultados o el de herramientas y, si el asistente está activo, lo confirma de palabra. */
  const mostrarPanel = (panel: "resultados" | "herramientas", confirmar = true) => {
    onAccion(panel);
    setResaltado(null);
    const m = ml.current;
    if (m.activo && confirmar) encolarVoz(fr().mostrando(panel), true, "atento", false);
  };

  /** Botones de la barra del asistente. */
  const sugerenciaHud = (s: SugerenciaHud) => {
    // Si está hablando, el panel se abre sin interrumpirlo
    const ocupado = ml.current.estado === "hablando";
    if (s === "resultados" || s === "herramientas") mostrarPanel(s, !ocupado);
    else if (s === "que-hago") preguntar("¿Qué hago ahora?");
    else ayudaVoz();
  };

  /** Pide el micrófono una vez para que el navegador lo recuerde (con «Permitir» no vuelve a preguntar). */
  const permitirMicrofono = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      // Lo negó o no hay micrófono: el estado lo dice
    }
    setPermiso(await permisoMicrofono());
  };

  /** Prueba de la voz elegida. */
  const probarVoz = () => {
    const t = fr().prueba;
    if (ml.current.activo) {
      encolarVoz(t, true, ml.current.estado === "esperando" ? "esperando" : "atento", false);
      return;
    }
    setHablando(true);
    hablar(t, () => setHablando(false));
  };

  const fijarManos = (c: Partial<PreferenciasManos>) => {
    setManos((x) => {
      const n = { ...x, ...c };
      guardarPreferencias({ manos: n });
      return n;
    });
  };

  // Cuando termina una simulación que Melki pidió, cuenta el resultado
  useEffect(
    () =>
      suscribir((r) => {
        const id = esperando.current;
        if (!id) return;
        esperando.current = null;
        agregarMelki(resumenResultado(r, actual.current.api, id));
        sugerirPanel("resultado");
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
    // Con los paneles ocultos, ofrece el que sirve (el resultado de una simulación lo ofrece cuando termine)
    if (!res.luego && !(res.esperar && VER_RESULTADOS.has(orden.tipo))) sugerirPanel(orden.tipo);
    // Órdenes que tardan (el sembrado automático, el diseño por área): la respuesta llega cuando el motor termina
    if (res.luego)
      void res.luego
        .then((r) => {
          agregarMelki(r);
          sugerirPanel(orden.tipo);
        })
        .catch(() => agregarMelki({ texto: "No pude terminar ese cálculo. Intente de nuevo." }));
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
    let ultimoTipo: Orden["tipo"] | null = null;
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
      ultimoTipo = orden.tipo;
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
    if (ultimoTipo && !esperando.current) sugerirPanel(ultimoTipo);
  };

  const preguntar = (q: string, deVoz = false) => {
    const pregunta = q.trim();
    if (!pregunta) return;
    if (sesion.current || control.current) cortarDictado();
    setMensajes((m) => [...m, { id: siguiente.current++, de: "usuario", texto: pregunta, voz: deVoz || undefined }]);
    if (!deVoz) setTexto("");
    // La voz de Melki
    const sinAcentos = pregunta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // El asistente por escrito: «activa el asistente», «asistente Melki», «activa manos libres», «modo Jarvis», «escúchame»
    if (
      /\b(activa|enciende|prende|pon|inicia|abre|llama)\w* (el |al )?(modo )?(manos libres|jarvis|escucha|asistente( melki| de voz| por voz)?)\b|^escuchame$|^modo jarvis$|^(el )?asistente melki$|\bquiero hablarte\b/.test(
        sinAcentos,
      )
    ) {
      if (!hayReconocimientoNavegador() && !hayMicrofono()) {
        agregarMelki({ texto: "Este navegador no puede escucharme. Use Edge o Chrome actualizados para el Asistente Melki." });
        return;
      }
      // El saludo llega cuando el micrófono esté listo
      if (ml.current.activo) agregarMelki({ texto: fr().yaEscucho });
      else onManosLibres(true);
      return;
    }
    if (/\b(desactiva|apaga|quita|termina|cierra)\w* (el )?(modo )?(manos libres|jarvis|escucha|asistente( melki| de voz| por voz)?)\b|\bdeja de escuchar\b/.test(sinAcentos)) {
      if (ml.current.activo) {
        // Se despide sin cortarse
        ml.current.activo = false;
        ml.current.despedida = true;
      }
      onManosLibres(false);
      agregarMelki({ texto: "Listo, ya no escucho. Cuando quiera, toque «Asistente Melki» o dígame «activa el asistente»." });
      return;
    }
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
    // Con el asistente activo y los resultados ocultos, «muéstrame los resultados» abre el panel
    if (ml.current.activo && esEscritorio() && !actual.current.paneles.derecho && /^(muestra\w*|abre|ensena\w*|ver|quiero ver|dejame ver)( me)? (los |el )?resultados?$/.test(sinAcentos.replace(/[¿?¡!.,]/g, "").trim())) {
      onAccion("resultados");
      setResaltado(null);
      agregarMelki({ texto: fr().mostrando("resultados") });
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
    if (a.accion === "manos-libres") {
      setUsados((u) => new Set(u).add(clave));
      onManosLibres(true);
      return;
    }
    if (a.accion === "resultados" || a.accion === "herramientas") {
      setUsados((u) => new Set(u).add(clave));
      mostrarPanel(a.accion);
      return;
    }
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
  // Lo que llama el reconocimiento de voz siempre usa la versión de ahora (con el escenario de ahora)
  const vozRef = useRef({ oirTexto, inicioFrase, ejecutarVoz, preguntar, pulsarAccion, arrancarEscucha, reanudar, listoParaEscuchar, bloqueoVoz, desbloquearVoz });
  useEffect(() => {
    vozRef.current = { oirTexto, inicioFrase, ejecutarVoz, preguntar, pulsarAccion, arrancarEscucha, reanudar, listoParaEscuchar, bloqueoVoz, desbloquearVoz };
  });
  // Encender y apagar el asistente
  const manosRef = useRef({ iniciarManosLibres, detenerManosLibres });
  useEffect(() => {
    manosRef.current = { iniciarManosLibres, detenerManosLibres };
  });
  useEffect(() => {
    if (manosLibres) manosRef.current.iniciarManosLibres();
    else manosRef.current.detenerManosLibres();
  }, [manosLibres]);
  // «Activarme al abrir el simulador»: si el micrófono no está bloqueado, se activa solo y saluda
  useEffect(() => {
    if (!leerPreferencias().manos?.siempre || (!hayReconocimientoNavegador() && !hayMicrofono())) return;
    let vigente = true;
    const t = window.setTimeout(() => {
      void permisoMicrofono().then((p) => vigente && p !== "denied" && !ml.current.activo && onManosLibres(true));
    }, 1200);
    return () => {
      vigente = false;
      window.clearTimeout(t);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Con el primer toque o tecla, el navegador ya deja hablar
  useEffect(() => {
    if (!vozBloqueada) return;
    const soltar = () => vozRef.current.desbloquearVoz();
    window.addEventListener("pointerup", soltar, { once: true });
    window.addEventListener("keydown", soltar, { once: true });
    return () => {
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("keydown", soltar);
    };
  }, [vozBloqueada]);
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

  const ayudaVoz = () => {
    setMensajes((x) => [...x, { id: siguiente.current++, de: "melki", texto: AYUDA_VOZ }]);
    if (!actual.current.abierto) setNoLeido(true);
    encolarVoz(AYUDA_VOZ, true);
  };

  return (
    <>
    <HudVoz
      estado={estadoVoz}
      escuchado={escuchado}
      subtitulo={subtitulo}
      aviso={avisoVoz}
      motor={motorVoz}
      paneles={escritorio ? paneles : null}
      resaltado={resaltado}
      bloqueada={vozBloqueada}
      onCallar={callarYa}
      onSugerencia={sugerenciaHud}
      onOirme={desbloquearVoz}
      onApagar={() => onManosLibres(false)}
    />
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
                onClick={() => onManosLibres(!manosLibres)}
                className={`rounded-md p-1.5 ${manosLibres ? "bg-carbon text-white hover:bg-carbon-2" : "text-carbon-2 hover:bg-black/5"}`}
                aria-pressed={manosLibres}
                title={manosLibres ? "Apagar el Asistente Melki" : "Asistente Melki: le escucho todo el tiempo y me activo con «Hola Melki»"}
                aria-label={manosLibres ? "Apagar el Asistente Melki" : "Activar el Asistente Melki"}
                data-tour="manos-libres-chat"
              >
                <AudioLines size={18} />
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
            <div className="desplazable max-h-[58%] shrink-0 overflow-y-auto border-b border-linea bg-white px-3.5 py-3 text-[13px]" role="group" aria-label="Ajustes de voz">
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
              <p className="mt-3 mb-1 flex items-center gap-1.5 font-cond text-[14px] font-semibold">
                <AudioLines size={15} className="text-salvia-oscura" aria-hidden="true" /> Asistente Melki
              </p>
              <p className="mb-2 text-[12px] leading-snug text-tenue">
                Le escucho todo el tiempo y me activo con «Hola Melki», «Oye Melki», «Hey Melki» o «Hello Melki» (también si el micrófono me entiende «Melky» o «Melqui»). Al activarme dejo el
                mapa libre y le sugiero los paneles cuando hagan falta. Usa el modo de dictado de arriba.
              </p>
              <p className="mb-1 text-[12.5px] font-medium text-carbon">Cómo le hablo</p>
              <div className="mb-2 flex gap-1" role="radiogroup" aria-label="Trato del asistente">
                {(
                  [
                    ["senor", "Señor"],
                    ["senora", "Señora"],
                    ["ninguno", "Sin tratamiento"],
                  ] as const
                ).map(([t, nombre]) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={manos.trato === t}
                    onClick={() => fijarManos({ trato: t })}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium ring-1 transition-colors ${manos.trato === t ? "bg-salvia-clara/70 text-carbon ring-salvia" : "bg-white text-carbon-2 ring-linea hover:bg-papel-2"}`}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
              {vozDisponible() && (
                <>
                  <label className="mb-1 block text-[12.5px] font-medium text-carbon" htmlFor="voz-asistente">
                    Voz
                  </label>
                  <div className="mb-1 flex gap-1.5">
                    <select
                      id="voz-asistente"
                      className="campo min-w-0 flex-1 py-1.5 text-[12.5px]"
                      value={manos.voz ?? ""}
                      onChange={(e) => fijarManos({ voz: e.target.value || null })}
                    >
                      <option value="">Automática: la más natural{voces[0] ? ` (${voces[0].nombre.replace(/^Microsoft |^Google /, "").split(/ - |\(/)[0].trim()})` : ""}</option>
                      {voces.map((v) => (
                        <option key={v.nombre} value={v.nombre}>
                          {v.nombre}
                          {v.natural ? " · natural" : ""}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={probarVoz} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-[12.5px] font-medium text-carbon ring-1 ring-linea hover:bg-papel-2">
                      <Play size={13} aria-hidden="true" /> Probar
                    </button>
                  </div>
                  {!voces.some((v) => v.natural) && (
                    <p className="mb-2 text-[12px] leading-snug text-tenue">Para una voz más natural, abra el simulador en Microsoft Edge: trae voces neuronales en español, como Salomé (Colombia) o Dalia (México).</p>
                  )}
                </>
              )}
              <div className="space-y-1" role="group" aria-label="Opciones del Asistente Melki">
                <Interruptor
                  activo={manos.ocultar}
                  onCambiar={(v) => fijarManos({ ocultar: v })}
                  titulo="Dejar el mapa libre al activarme"
                  detalle="Oculto el panel de herramientas y el de resultados; se los ofrezco cuando hagan falta y vuelven al apagarme."
                />
                <Interruptor
                  activo={manos.siempre}
                  onCambiar={(v) => {
                    fijarManos({ siempre: v });
                    // Al encenderlo, pide el micrófono de una vez para que el navegador no vuelva a preguntar
                    if (v && permiso !== "granted") void permitirMicrofono();
                  }}
                  titulo="Activarme al abrir el simulador"
                  detalle={`Al entrar le saludo («${frases(manos.trato).bienvenida(true).split(/(?<=\.) /).slice(0, 2).join(" ")}») y quedo atento a «Hola Melki», sin tocar nada.`}
                />
                <Interruptor activo={manos.seguir} onCambiar={(v) => fijarManos({ seguir: v })} titulo="Seguir la conversación" detalle="Después de responder me quedo atento unos segundos: no hace falta repetir mi nombre." />
                <Interruptor activo={manos.completo} onCambiar={(v) => fijarManos({ completo: v })} titulo="Leer las respuestas completas" detalle="Si está apagado, digo lo principal y dejo el detalle escrito (diga «más detalle» para oírlo)." />
                <Interruptor activo={manos.sonido} onCambiar={(v) => fijarManos({ sonido: v })} titulo="Sonido al activarme" detalle="Dos notas cortas cuando oigo mi nombre." />
              </div>
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-papel px-2.5 py-2 text-[12px] leading-snug" data-permiso={permiso}>
                <Mic size={14} className={`mt-0.5 shrink-0 ${permiso === "granted" ? "text-buena" : permiso === "denied" ? "text-sin" : "text-carbon-2"}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-carbon-2">
                  {permiso === "granted"
                    ? "Micrófono permitido en este sitio: puedo activarme sin preguntarle."
                    : permiso === "denied"
                      ? "El micrófono está bloqueado. Actívelo en el candado de la barra de direcciones («Micrófono: Permitir») y recargue la página."
                      : "Dé acceso al micrófono una vez y elija «Permitir» (o «Permitir siempre»): así el navegador no le vuelve a preguntar. En la versión HTML el navegador puede preguntar al abrir el archivo."}
                </span>
                {permiso !== "granted" && permiso !== "denied" && hayMicrofono() && (
                  <button type="button" onClick={() => void permitirMicrofono()} className="shrink-0 rounded-md bg-carbon px-2 py-1 text-[12px] font-medium text-white hover:bg-carbon-2">
                    Dar acceso
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
                  {m.voz && (
                    <span className="mr-1 inline-flex translate-y-[2px] text-white/70" title="Dicho por voz">
                      <Mic size={13} aria-hidden="true" />
                      <span className="sr-only">Por voz: </span>
                    </span>
                  )}
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
        {manosLibres && estadoVoz !== "apagado" && (
          <span className="absolute -bottom-0.5 -left-0.5 grid h-6 w-6 place-items-center rounded-full bg-carbon text-white ring-2 ring-white" title="Asistente Melki activo" aria-hidden="true">
            <AudioLines size={13} />
          </span>
        )}
      </button>
    </div>
    </>
  );
}

function Interruptor({ activo, onCambiar, titulo, detalle }: { activo: boolean; onCambiar: (v: boolean) => void; titulo: string; detalle: string }) {
  return (
    <button type="button" role="switch" aria-checked={activo} onClick={() => onCambiar(!activo)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-papel-2">
      <span className={`mt-0.5 flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${activo ? "bg-salvia" : "bg-linea"}`} aria-hidden="true">
        <span className={`h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${activo ? "translate-x-[14px]" : ""}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-carbon">{titulo}</span>
        <span className="block text-[12px] leading-snug text-tenue">{detalle}</span>
      </span>
    </button>
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
