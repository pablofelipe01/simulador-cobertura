// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Dictado por voz para Melki: convierte la voz en texto dentro de la caja de mensaje, para revisarlo y
// corregirlo antes de enviarlo (nunca se envía solo). Dos modos:
//  • «navegador»: reconocimiento del navegador (Edge o Chrome lo procesan en sus servidores; necesita internet).
//  • «privado»: el audio no sale del equipo. Usa el reconocimiento en el dispositivo del navegador si existe
//    (Chrome; Edge en versiones nuevas) y, si no, Whisper dentro de la página (ver dictado-trabajador.ts).
import { CONFIG } from "@/lib/config";

import { CODIGO_TRABAJADOR } from "./dictado-trabajador";
import { numerosEnPalabras } from "./numeros";

export type ModoDictado = "navegador" | "privado";
export type EstadoDictado = "preparando" | "escuchando" | "transcribiendo" | "inactivo";

/** Cuándo empezó a oírse una frase (reloj de la página, en ms): sirve para saber si era la voz de Melki (eco). */
export type InfoFrase = { inicio: number };

export type EventosDictado = {
  /** Texto dictado en esta sesión: lo confirmado (solo crece, sin repeticiones) y lo que aún se está reconociendo. */
  onTexto: (final: string, parcial: string) => void;
  onEstado: (estado: EstadoDictado, detalle?: string) => void;
  onError: (mensaje: string) => void;
  /** Cada frase confirmada, una sola vez y sin lo que el navegador repite (lo usa el Asistente Melki). */
  onFrase?: (frase: string, info: InfoFrase) => void;
  /** Lo que se está oyendo de la frase en curso («» cuando no hay nada). */
  onParcial?: (parcial: string, info: InfoFrase) => void;
  /** Nivel del micrófono (0 a 1) y si parece voz; en el computador, con el micrófono ya permitido. */
  onNivel?: (nivel: number, voz: boolean) => void;
  /** Elige entre las versiones que propone el reconocimiento para cada frase (el Asistente Melki lo usa). */
  elegir?: (alternativas: string[]) => string;
  /** Palabras que conviene entender bien (si el reconocimiento en el equipo admite sugerencias). */
  frases?: string[];
};

export type OpcionesDictado = {
  /**
   * Escucha seguida: si el navegador deja de escuchar por su cuenta (Edge lo hace a los pocos segundos de silencio,
   * Chrome al minuto), se vuelve a encender sola, sin que se note y sin perder ni repetir lo dicho.
   */
  continuo?: boolean;
  /** Con `continuo`: se detiene sola después de este silencio (ms). Sin él, escucha hasta que la detengan. */
  silencioMax?: number;
};

export type Dictado = {
  /** Termina de escuchar; el texto que falte por transcribir todavía llega. */
  detener: () => void;
  /** Corta todo sin esperar. */
  cancelar: () => void;
  /**
   * Deja de oír un rato sin soltar la escucha (con parlantes, mientras Melki habla: así no se oye a sí mismo). Lo que
   * se estaba oyendo se descarta; al reanudar vuelve a escuchar enseguida.
   */
  pausar?: (pausado: boolean) => void;
  /** Motor usado en esta sesión (para mostrarlo). */
  motor: "navegador" | "dispositivo" | "whisper";
};

/* ───────────── Tipos mínimos del reconocimiento de voz del navegador ───────────── */

type Alternativa = { transcript: string; confidence?: number };
type Resultado = { isFinal: boolean; length?: number; [i: number]: Alternativa };
type EventoResultado = { resultIndex: number; results: ArrayLike<Resultado> };
type Reconocedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  phrases?: unknown[];
  onresult: ((e: EventoResultado) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type ClaseReconocedor = {
  new (): Reconocedor;
  available?: (o: { langs: string[]; processLocally?: boolean; quality?: string }) => Promise<string>;
  install?: (o: { langs: string[]; processLocally?: boolean; quality?: string }) => Promise<boolean>;
};

function claseReconocedor(): ClaseReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ClaseReconocedor; webkitSpeechRecognition?: ClaseReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** ¿El navegador trae reconocimiento de voz propio? */
export const hayReconocimientoNavegador = () => claseReconocedor() !== null;
/** ¿Se puede grabar el micrófono (para el dictado privado con Whisper)? */
export const hayMicrofono = () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

/* ───────────── Texto dictado → texto que Melki entiende ───────────── */

/**
 * Lo que el reconocimiento suele escribir mal en el simulador: «red mes» → «red mesh», «geitwey» → «gateway»,
 * «hectarias» → «hectáreas», «ese efe 11» → «SF11», «estar link» → «Starlink», «guasap» → «WhatsApp».
 */
export function corregirPalabras(texto: string): string {
  return texto
    // «Mesh» al hablar rápido: «red mechen tal punto», «red meshen», «mediantales coordenadas»
    .replace(/\b(mechen|meshen|meshe en|mechén)\b/gi, "mesh en")
    .replace(/\bmedian\s*tales\b/gi, "mesh en tales")
    .replace(/\b(red|redes|malla|mallas)\s+(mes|mech|mesch|mesc|meche|mecha)\b/gi, "$1 mesh")
    .replace(/\b(mes|mesh|mech)\s*(core|cor|kor|cord)\b/gi, "MeshCore")
    .replace(/\b(gate\s+way|geit\s*wey|geit\s*wei|gueit\s*wey|gueit\s*wei|getwey|getway|geiwey|geitway|gate\s*guey|gay\s*way)\b/gi, "gateway")
    .replace(/\b(e?ctarias|e?ctareas|hectarias|ectaria)\b/gi, "hectáreas")
    .replace(/\bhectaria\b/gi, "hectárea")
    .replace(/\b(?:ese\s+efe|s\s+f)\s*(\d{1,2})\b/gi, "SF$1")
    .replace(/\b(estar\s*link|star\s+link|starling|estarlin)\b/gi, "Starlink")
    .replace(/\b(guasap|wasap|whats\s+app|guatsap)\b/gi, "WhatsApp")
    .replace(/\blo\s+ra\b/gi, "LoRa")
    // Palabras pegadas al hablar rápido: «ubícameen Barranca» → «ubícame en Barranca»
    .replace(/\b(ub[ií]came|ll[eé]vame|mu[eé]strame)(en|a|al)\b/gi, "$1 $2");
}

/**
 * Ajusta lo dictado para las órdenes: «4 punto 25» → «4.25», «menos 73» → «-73», «4 grados 30 minutos» → «4°30'».
 */
export function normalizarDictado(texto: string): string {
  let t = corregirPalabras(texto.replace(/\s+/g, " ").trim());
  t = t.replace(/(\d)\s+(?:punto|coma)\s+(\d)/gi, "$1.$2");
  t = t.replace(/\bmenos\s+(\d)/gi, "-$1");
  t = t.replace(/(\d)\s*grados?\b/gi, "$1°");
  t = t.replace(/(\d)\s*minutos?\b/gi, "$1'");
  t = t.replace(/(\d)\s*segundos?\b/gi, '$1"');
  t = t.replace(/([°'])\s+(\d)/g, "$1$2");
  t = t.replace(/(\d)\s+(m|metros)\b/gi, "$1 m");
  return t;
}

/** Junta lo que ya estaba escrito con lo dictado (números en cifras y mayúscula inicial si la caja estaba vacía). */
export function componerTexto(base: string, dictado: string): string {
  const d = normalizarDictado(numerosEnPalabras(dictado));
  if (!base.trim()) return d.charAt(0).toUpperCase() + d.slice(1);
  return d ? `${base.replace(/\s+$/, "")} ${d}` : base;
}

/** Frases que Whisper suele inventar con silencio o ruido. */
const ALUCINACIONES = /^(¡?gracias( por (ver|mirar|su atenci[oó]n))?[.!]*|subt[ií]tulos?.*|.*amara\.org.*|suscr[ií]bete.*|\[.*\]|\(.*\)|\.+|…)$/i;
/** Quita frases repetidas seguidas («no podemos decir que no podemos decir que…»). */
export function quitarRepeticiones(t: string): string {
  let x = t;
  for (let i = 0; i < 3; i++) x = x.replace(/(\S(?:.{2,60}?\S)?)(?:[\s,.]+\1){2,}/gi, "$1");
  return x;
}
const limpiarWhisper = (t: string) => {
  const x = quitarRepeticiones(t.replace(/\s+/g, " ").trim());
  return ALUCINACIONES.test(x) ? "" : x;
};

const unir = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);

/* ───────────── Lo que el navegador repite ───────────── */

const reloj = () => Date.now();
/** Celular o tableta: Chrome en Android y Safari repiten en cada resultado todo lo dicho antes. */
const esMovil = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Las palabras de un texto para compararlas (minúsculas, sin tildes ni signos). */
export function clavePalabras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const iguales = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => w === b[i]);
const empiezaCon = (a: string[], b: string[]) => b.length > 0 && a.length > b.length && b.every((w, i) => w === a[i]);

/** Quita las primeras `n` palabras (contadas como en `clavePalabras`) y deja el resto tal como se escribió. */
function quitarPalabras(texto: string, n: number): string {
  const trozos = texto.trim().split(/\s+/).filter(Boolean);
  let k = 0;
  let i = 0;
  while (i < trozos.length && k < n) k += clavePalabras(trozos[i++]).length;
  return trozos.slice(i).join(" ");
}

/**
 * Quita lo que se repite pegado al hablar rápido o cuando el reconocimiento duda: «ubícame en ubícame en Barranca» →
 * «ubícame en Barranca». Solo grupos de dos a seis palabras (una palabra repetida puede ser a propósito: «no, no»).
 */
export function quitarTartamudeo(texto: string): string {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const claves = palabras.map((w) => clavePalabras(w).join(""));
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    let cambio = false;
    for (let n = Math.min(6, Math.floor(palabras.length / 2)); n >= 2 && !cambio; n--)
      for (let i = 0; i + 2 * n <= palabras.length && !cambio; i++) {
        let igual = true;
        for (let k = 0; k < n && igual; k++) igual = claves[i + k] !== "" && claves[i + k] === claves[i + n + k];
        if (igual) {
          palabras.splice(i + n, n);
          claves.splice(i + n, n);
          cambio = true;
        }
      }
    if (!cambio) break;
  }
  return palabras.join(" ");
}

/**
 * Lo nuevo de una frase confirmada frente a la anterior. Devuelve «» si es la misma frase que el navegador mandó dos
 * veces seguidas; si la frase trae al comienzo la anterior completa (`acumula`: Chrome en Android y Safari repiten
 * «uno», «uno dos», «uno dos tres»…, o el mismo resultado que va creciendo), solo lo que sigue.
 */
export function loNuevo(anterior: string, frase: string, { acumula, reciente }: { acumula: boolean; reciente: boolean }): string {
  const t = quitarTartamudeo(frase);
  const a = clavePalabras(anterior);
  const b = clavePalabras(t);
  if (!b.length) return "";
  if (reciente && iguales(a, b)) return "";
  if (acumula && empiezaCon(b, a)) return quitarPalabras(t, a.length);
  return t;
}

/* ───────────── Micrófono abierto y nivel de la voz (en el computador) ───────────── */

/**
 * Deja el micrófono abierto mientras se escucha: entre una escucha del navegador y la siguiente no se apaga ni se
 * prende (ni el aviso del navegador ni el de Windows parpadean) y se mide el nivel de la voz, para que la barra muestre
 * que oye y para no cortar a quien sigue hablando. No pide permiso: solo si el micrófono ya está permitido. En el
 * celular no se usa (allí el micrófono no se puede abrir dos veces). Devuelve con qué cerrarlo.
 */
async function abrirMicrofono(onNivel?: (nivel: number, voz: boolean) => void): Promise<(() => void) | null> {
  if (esMovil() || !hayMicrofono()) return null;
  try {
    const p = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    if (p?.state !== "granted") return null;
  } catch {
    return null;
  }
  let flujo: MediaStream;
  try {
    // Sin procesar el audio: no cambia el sonido del equipo ni el de la escucha del navegador
    flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch {
    return null;
  }
  const soltarFlujo = () => flujo.getTracks().forEach((t) => t.stop());
  if (!onNivel) return soltarFlujo;
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return soltarFlujo;
  }
  const fuente = ctx.createMediaStreamSource(flujo);
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 1024;
  fuente.connect(analizador);
  // Sin un toque en la página el audio queda en pausa: arranca con el primer toque o tecla
  const reanudar = () => void ctx.resume().catch(() => {});
  reanudar();
  window.addEventListener("pointerdown", reanudar);
  window.addEventListener("keydown", reanudar);
  const muestras = new Float32Array(analizador.fftSize);
  let fondo = 0.004;
  let ultimaVoz = 0;
  const id = window.setInterval(() => {
    if (ctx.state !== "running") return;
    analizador.getFloatTimeDomainData(muestras);
    let suma = 0;
    for (let i = 0; i < muestras.length; i++) suma += muestras[i] * muestras[i];
    const rms = Math.sqrt(suma / muestras.length);
    // El ruido de fondo se aprende solo; la voz es lo que pasa claramente por encima
    const voz = rms > Math.max(0.012, fondo * 3);
    if (voz) ultimaVoz = reloj();
    else fondo = fondo * 0.97 + Math.min(rms, 0.05) * 0.03;
    onNivel(Math.min(1, rms / 0.12), reloj() - ultimaVoz < 300);
  }, 70);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("pointerdown", reanudar);
    window.removeEventListener("keydown", reanudar);
    fuente.disconnect();
    soltarFlujo();
    if (ctx.state !== "closed") ctx.close().catch(() => {});
  };
}

/* ───────────── Modo navegador (y en el dispositivo, si el navegador lo trae) ───────────── */

const IDIOMAS = ["es-CO", "es-419", "es-US", "es-MX", "es-ES"];

const ERRORES: Record<string, string> = {
  "not-allowed": "No tengo permiso para usar el micrófono. Permítalo en el candado de la barra de direcciones y vuelva a tocar el micrófono.",
  "service-not-allowed": "El navegador no permite el dictado en esta página. Pruebe el dictado privado (en Ajustes de voz).",
  "audio-capture": "No encuentro un micrófono. Revise que esté conectado y que Windows le dé permiso al navegador.",
  network: "El dictado del navegador necesita internet. Sin conexión, use el dictado privado (en Ajustes de voz).",
  "language-not-supported": "El reconocimiento no admite español en este equipo.",
};

/** Errores tras los que no tiene sentido volver a escuchar (falta permiso o el idioma). */
const FATALES = new Set(["not-allowed", "service-not-allowed", "language-not-supported", "bad-grammar"]);
/** El micrófono ocupado o desconectado un momento (otra app, el celular cambiando de audio): se reintenta unas veces. */
const CAPTURAS_MAX = 5;
/** Aviso cuando la escucha se cae seguido (sigue intentando sola, más despacio). */
const AVISO_RED = "Sin conexión con el servicio de voz: sigo intentando cada pocos segundos. Sin internet, use el dictado privado (en Ajustes de voz).";
const AVISO_MIC = "El micrófono deja de escuchar a cada momento: sigo intentando. Revise que esté conectado y que otra aplicación no lo esté usando.";

/**
 * Escucha con el reconocimiento del navegador. Lo que el navegador hace distinto se arregla aquí, una sola vez:
 *  • Cada frase confirmada sale una sola vez (`onFrase`), con la hora en que empezó a oírse, sin lo que Chrome en
 *    Android y Safari repiten («uno», «uno dos», «uno dos tres»), sin el resultado que llega dos veces y sin
 *    «ubícame en ubícame en».
 *  • Con `continuo`, si el navegador deja de escuchar por su cuenta, se vuelve a encender enseguida y sin avisar (la
 *    pantalla sigue «escuchando»). Si falla seguido, espera cada vez un poco más; solo se rinde tras varios fallos.
 *  • En el computador deja el micrófono abierto entre una escucha y otra (sin parpadeos) y mide el nivel de la voz.
 */
function conReconocedor(Clase: ClaseReconocedor, idioma: string, local: boolean, eventos: EventosDictado, opciones: OpcionesDictado = {}): Dictado {
  const acumula = esMovil();
  const Frase = (window as unknown as { SpeechRecognitionPhrase?: new (frase: string, peso: number) => unknown }).SpeechRecognitionPhrase;
  /** Todo lo confirmado (solo crece). */
  let final = "";
  /** La última frase confirmada completa (para reconocer lo que el navegador repite). */
  let ultima = { texto: "", hora: 0 };
  let actual: Reconocedor | null = null;
  let detenido = false;
  let cancelado = false;
  let terminado = false;
  let empezo = false;
  let fallos = 0;
  let capturas = 0;
  let avisado = false;
  let pausado = false;
  let reintento = 0;
  let ultimoSonido = reloj();
  let cerrarMic: (() => void) | null = null;
  let abriendoMic = false;

  /** Al volver a la pestaña, al recuperar el internet o el foco: si no estaba escuchando, vuelve enseguida. */
  const alVolver = () => {
    if (terminado || cancelado || detenido || pausado || actual) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    window.clearTimeout(reintento);
    fallos = 0;
    reintento = window.setTimeout(arrancar, 120);
  };
  const alCambiarVisibilidad = () => document.visibilityState === "visible" && alVolver();
  const conOyentes = Boolean(opciones.continuo) && typeof document !== "undefined" && typeof window.addEventListener === "function";
  if (conOyentes) {
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("online", alVolver);
    window.addEventListener("focus", alVolver);
  }
  const soltarOyentes = () => {
    if (!conOyentes) return;
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    window.removeEventListener("online", alVolver);
    window.removeEventListener("focus", alVolver);
  };

  const terminar = () => {
    if (terminado) return;
    terminado = true;
    window.clearTimeout(reintento);
    soltarOyentes();
    cerrarMic?.();
    cerrarMic = null;
    eventos.onParcial?.("", { inicio: 0 });
    eventos.onTexto(final, "");
    eventos.onEstado("inactivo");
  };

  /** Con escucha seguida, el micrófono queda abierto entre una escucha y otra (y da el nivel de la voz). */
  const mantenerMicrofono = () => {
    if (!opciones.continuo || cerrarMic || abriendoMic || terminado) return;
    abriendoMic = true;
    void abrirMicrofono(eventos.onNivel).then((cerrar) => {
      abriendoMic = false;
      if (!cerrar) return;
      if (terminado || cancelado) cerrar();
      else cerrarMic = cerrar;
    });
  };

  /** La frase dicha: la primera versión o la que mejor se entiende en el simulador. */
  const elegir = (x: Resultado) => {
    const n = eventos.elegir ? Math.max(1, x.length ?? 1) : 1;
    const opcionesTexto = Array.from({ length: n }, (_, k) => x[k]?.transcript?.trim() ?? "").filter(Boolean);
    return opcionesTexto.length > 1 && eventos.elegir ? eventos.elegir(opcionesTexto) : (opcionesTexto[0] ?? "");
  };

  /** Entrega una frase confirmada: sin repetir lo anterior. `crecio`: lo que ya se había entregado de ese mismo resultado. */
  const entregar = (frase: string, inicio: number, crecio: string | undefined) => {
    const ahora = reloj();
    const anterior = crecio ?? ultima.texto;
    const t = loNuevo(anterior, frase, { acumula: acumula || crecio !== undefined, reciente: crecio !== undefined || ahora - ultima.hora < 3000 });
    if (crecio === undefined || t) ultima = { texto: quitarTartamudeo(frase), hora: ahora };
    if (!t) return;
    final = unir(final, t);
    eventos.onFrase?.(t, { inicio });
  };

  const arrancar = () => {
    if (cancelado || terminado) return;
    if (detenido) return terminar();
    if (pausado || actual) return;
    const r = new Clase();
    r.lang = idioma;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = eventos.elegir ? 4 : 1;
    if (local) r.processLocally = true;
    // Sugerencias de palabras («Melki», «gateway»…): solo en el equipo, donde el navegador las admite
    if (local && Frase && eventos.frases?.length && "phrases" in r) {
      try {
        r.phrases = eventos.frases.map((f) => new Frase(f, 3));
      } catch {
        // Sin sugerencias: sigue igual
      }
    }
    actual = r;
    const desde = reloj();
    let oyo = false;
    let red = false;
    let fatal: string | null = null;
    /** Por resultado: cuándo empezó a oírse, el texto ya entregado y, si el resultado vuelve a crecer, lo entregado antes. */
    const inicios = new Map<number, number>();
    const entregados = new Map<number, string>();
    const previos = new Map<number, string>();
    let largo = 0;
    r.onresult = (e) => {
      if (actual !== r) return;
      oyo = true;
      ultimoSonido = reloj();
      // Si el navegador empezó la lista de nuevo, lo anterior ya no cuenta (lo entregado sigue en `ultima`)
      if (e.results.length < largo) {
        inicios.clear();
        entregados.clear();
        previos.clear();
      }
      largo = e.results.length;
      const partes: string[] = [];
      let inicioParcial = 0;
      for (let i = 0; i < e.results.length; i++) {
        const x = e.results[i];
        const crudo = (x[0]?.transcript ?? "").trim();
        if (!inicios.has(i)) inicios.set(i, reloj());
        const ya = entregados.get(i);
        if (x.isFinal) {
          if (ya === crudo || !crudo) continue;
          entregados.set(i, crudo);
          const antes = previos.get(i);
          previos.delete(i);
          entregar(elegir(x), inicios.get(i) ?? reloj(), antes);
        } else {
          // El mismo resultado vuelve a oírse después de confirmado: sigue creciendo (Safari) o es una frase nueva
          if (ya !== undefined) {
            entregados.delete(i);
            previos.set(i, ya);
            inicios.set(i, reloj());
          }
          if (crudo) {
            partes.push(crudo);
            if (!inicioParcial) inicioParcial = inicios.get(i) ?? reloj();
          }
        }
      }
      let parcial = quitarTartamudeo(partes.join(" "));
      // Lo que el celular repite de la frase anterior no se vuelve a mostrar
      if (parcial && acumula && empiezaCon(clavePalabras(parcial), clavePalabras(ultima.texto))) parcial = quitarPalabras(parcial, clavePalabras(ultima.texto).length);
      eventos.onParcial?.(parcial, { inicio: inicioParcial });
      eventos.onTexto(final, parcial);
    };
    r.onerror = (e) => {
      if (actual !== r) return;
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "network") red = true;
      else if (e.error === "audio-capture") {
        // Un momento sin micrófono (otra app lo tomó, el celular cambió de audio): se reintenta; solo seguido es fatal
        capturas++;
        if (capturas > CAPTURAS_MAX || !opciones.continuo) fatal = ERRORES["audio-capture"];
      } else if (FATALES.has(e.error)) fatal = ERRORES[e.error] ?? `El dictado se detuvo (${e.error}).`;
      else red = true;
    };
    r.onend = () => {
      if (actual !== r) return;
      actual = null;
      if (cancelado) return;
      if (fatal) {
        eventos.onError(fatal);
        return terminar();
      }
      if (detenido || !opciones.continuo) return terminar();
      if (opciones.silencioMax && reloj() - ultimoSonido > opciones.silencioMax) return terminar();
      if (pausado) return;
      // El navegador dejó de escuchar por su cuenta: se vuelve a encender sin avisar. Si se corta enseguida sin oír
      // nada o sin internet, cada vez espera un poco más; tras varios fallos seguidos avisa una vez y sigue intentando,
      // más despacio (no se rinde: al volver el internet o a la pestaña, vuelve enseguida).
      const fallo = red || (!oyo && reloj() - desde < 1500);
      fallos = fallo ? fallos + 1 : 0;
      if (!fallo) {
        capturas = 0;
        if (avisado) {
          avisado = false;
          eventos.onEstado("escuchando", local ? "en este equipo" : undefined);
        }
      }
      if (fallos >= 6 && !avisado) {
        avisado = true;
        eventos.onEstado("preparando", red ? AVISO_RED : AVISO_MIC);
      }
      reintento = window.setTimeout(arrancar, fallos >= 6 ? 8000 : fallos ? Math.min(4000, 250 * 2 ** (fallos - 1)) : 60);
    };
    try {
      r.start();
    } catch {
      // El navegador no lo dejó empezar todavía: se intenta de nuevo en un momento (con escucha seguida, sin rendirse)
      actual = null;
      fallos++;
      if (fallos >= 6 && !opciones.continuo) {
        eventos.onError("No pude encender el micrófono. Revise que esté conectado y que el navegador tenga permiso.");
        return terminar();
      }
      if (fallos >= 6 && !avisado) {
        avisado = true;
        eventos.onEstado("preparando", AVISO_MIC);
      }
      reintento = window.setTimeout(arrancar, fallos >= 6 ? 8000 : Math.min(4000, 250 * 2 ** (fallos - 1)));
      return;
    }
    if (!empezo) {
      empezo = true;
      eventos.onEstado("escuchando", local ? "en este equipo" : undefined);
    }
    mantenerMicrofono();
  };

  arrancar();
  return {
    motor: local ? "dispositivo" : "navegador",
    detener: () => {
      if (detenido || cancelado) return;
      detenido = true;
      window.clearTimeout(reintento);
      // Lo que falte por confirmar todavía llega; si estaba entre una escucha y otra, termina ya
      if (actual) actual.stop();
      else terminar();
    },
    cancelar: () => {
      if (cancelado) return;
      cancelado = true;
      detenido = true;
      terminado = true;
      window.clearTimeout(reintento);
      soltarOyentes();
      cerrarMic?.();
      cerrarMic = null;
      const r = actual;
      actual = null;
      r?.abort();
      eventos.onEstado("inactivo");
    },
    pausar: (v: boolean) => {
      if (cancelado || terminado || detenido || v === pausado) return;
      pausado = v;
      window.clearTimeout(reintento);
      if (v) {
        // Lo que estaba oyendo (su propia voz) no se entrega
        const r = actual;
        actual = null;
        r?.abort();
        eventos.onParcial?.("", { inicio: 0 });
      } else {
        fallos = 0;
        reintento = window.setTimeout(arrancar, 120);
      }
    },
  };
}

/** Reconocimiento en el dispositivo del navegador, si existe para español (lo instala si hace falta). */
async function idiomaEnDispositivo(Clase: ClaseReconocedor | null, eventos: EventosDictado): Promise<string | null> {
  if (!Clase?.available) return null;
  for (const lang of IDIOMAS) {
    let estado = "unavailable";
    try {
      estado = await Clase.available({ langs: [lang], processLocally: true });
    } catch {
      return null;
    }
    if (estado === "available") return lang;
    if ((estado === "downloadable" || estado === "downloading") && Clase.install) {
      eventos.onEstado("preparando", "Descargando el español del navegador para dictar sin internet…");
      try {
        if (await Clase.install({ langs: [lang], processLocally: true })) return lang;
      } catch {
        // Sigue con el siguiente idioma o con Whisper
      }
    }
  }
  return null;
}

/* ───────────── Modo privado con Whisper dentro de la página ───────────── */

type Mensaje = { tipo: "progreso"; cargado: number; total: number } | { tipo: "listo" } | { tipo: "texto"; id: number; texto: string } | { tipo: "error"; id?: number; mensaje: string };

let trabajador: Worker | null = null;
let listo: Promise<void> | null = null;
const oyentes = new Set<(m: Mensaje) => void>();

function obtenerTrabajador(): Worker {
  if (trabajador) return trabajador;
  const url = URL.createObjectURL(new Blob([CODIGO_TRABAJADOR], { type: "text/javascript" }));
  // Trabajador clásico (no de módulo): desde un Blob, los de módulo no arrancan en la versión HTML (file://)
  trabajador = new Worker(url, { name: "dictado-privado" });
  trabajador.onmessage = (e: MessageEvent<Mensaje>) => oyentes.forEach((f) => f(e.data));
  return trabajador;
}

const mb = (b: number) => (b / 1e6).toFixed(0);

/** Descarga (la primera vez) y carga el reconocedor privado. */
function prepararWhisper(eventos: EventosDictado): Promise<void> {
  if (listo) return listo;
  const w = obtenerTrabajador();
  // Si ya se descargó antes, solo se carga desde este equipo (sin internet)
  let guardado = false;
  void reconocedorDescargado().then((x) => (guardado = x));
  listo = new Promise<void>((ok, mal) => {
    const oir = (m: Mensaje) => {
      if (m.tipo === "progreso") {
        eventos.onEstado(
          "preparando",
          guardado
            ? "Cargando el reconocedor privado guardado en este equipo…"
            : m.total > 0
              ? `Descargando el reconocedor privado: ${mb(m.cargado)} de ${mb(m.total)} MB (solo la primera vez)…`
              : "Preparando el reconocedor privado…",
        );
      } else if (m.tipo === "listo") {
        oyentes.delete(oir);
        ok();
      } else if (m.tipo === "error" && m.id === undefined) {
        oyentes.delete(oir);
        listo = null;
        mal(new Error(m.mensaje));
      }
    };
    oyentes.add(oir);
    w.postMessage({ tipo: "cargar", libreria: CONFIG.dictado.libreria, motorUrl: CONFIG.dictado.motor, modelosUrl: CONFIG.dictado.modelos, modelo: CONFIG.dictado.modelo });
  });
  return listo;
}

let siguienteId = 1;
function transcribir(audio: Float32Array): Promise<string> {
  const w = obtenerTrabajador();
  const id = siguienteId++;
  return new Promise((ok, mal) => {
    const oir = (m: Mensaje) => {
      if ((m.tipo === "texto" || m.tipo === "error") && m.id === id) {
        oyentes.delete(oir);
        if (m.tipo === "texto") ok(m.texto);
        else mal(new Error(m.mensaje));
      }
    };
    oyentes.add(oir);
    w.postMessage({ tipo: "transcribir", id, audio }, [audio.buffer]);
  });
}

/** Lineal: pasa el audio a 16 kHz si el navegador no aceptó esa frecuencia. */
function a16k(x: Float32Array, frecuencia: number): Float32Array {
  if (frecuencia === 16000) return x;
  const n = Math.floor((x.length * 16000) / frecuencia);
  const y = new Float32Array(n);
  const paso = frecuencia / 16000;
  for (let i = 0; i < n; i++) {
    const p = i * paso;
    const k = Math.floor(p);
    const f = p - k;
    y[i] = (x[k] ?? 0) * (1 - f) + (x[k + 1] ?? x[k] ?? 0) * f;
  }
  return y;
}

/**
 * Graba el micrófono y separa frases por silencios (detector de voz por energía); cada frase se transcribe
 * en el trabajador y se agrega al texto.
 */
async function conWhisper(eventos: EventosDictado, control: ControlDictado): Promise<Dictado> {
  eventos.onEstado("preparando", "Preparando el reconocedor privado…");
  // Primero el reconocedor (la primera vez se descarga) y después el micrófono, para no dejarlo abierto
  await prepararWhisper(eventos);
  if (control.cancelado) throw new DictadoCancelado();
  const flujo = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const cerrarMic = () => flujo.getTracks().forEach((t) => t.stop());
  if (control.cancelado) {
    cerrarMic();
    throw new DictadoCancelado();
  }
  let detenido = false;
  let cancelado = false;
  let pausado = false;
  let final = "";
  let pendientes = 0;

  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: 16000 });
  } catch {
    ctx = new AudioContext();
  }
  const fuente = ctx.createMediaStreamSource(flujo);
  const proc = ctx.createScriptProcessor(1024, 1, 1);
  const silencio = ctx.createGain();
  silencio.gain.value = 0;
  fuente.connect(proc);
  proc.connect(silencio);
  silencio.connect(ctx.destination);
  const fs = ctx.sampleRate;
  const bloque = 1024 / fs;

  let fondo = 0.004;
  let hablando = false;
  let frase: Float32Array[] = [];
  let previo: Float32Array[] = [];
  let silencioS = 0;
  let vozS = 0;
  /** Cuándo empezó a oírse la frase en curso (para reconocer la voz de Melki). */
  let inicioFrase = 0;
  let ultimoNivel = 0;

  const terminarSiCorresponde = () => {
    if (detenido && pendientes === 0 && !cancelado) {
      eventos.onTexto(final, "");
      eventos.onEstado("inactivo");
    }
  };

  const enviarFrase = () => {
    const partes = frase;
    const inicio = inicioFrase;
    frase = [];
    hablando = false;
    if (vozS < 0.3) return;
    let n = 0;
    for (const p of partes) n += p.length;
    const audio = new Float32Array(n);
    let o = 0;
    for (const p of partes) {
      audio.set(p, o);
      o += p.length;
    }
    pendientes++;
    eventos.onEstado("transcribiendo");
    eventos.onTexto(final, "…");
    transcribir(a16k(audio, fs))
      .then((t) => {
        if (cancelado) return;
        const x = quitarTartamudeo(limpiarWhisper(t));
        final = unir(final, x);
        if (x) eventos.onFrase?.(x, { inicio });
        eventos.onTexto(final, "");
      })
      .catch((e: Error) => !cancelado && eventos.onError(`No pude transcribir: ${e.message}`))
      .finally(() => {
        pendientes--;
        if (!detenido && !cancelado) eventos.onEstado("escuchando", "en este equipo");
        terminarSiCorresponde();
      });
  };

  proc.onaudioprocess = (e) => {
    if (detenido) return;
    // En pausa (Melki habla por parlantes): lo que entra es su voz y se descarta
    if (pausado) {
      hablando = false;
      frase = [];
      previo = [];
      return;
    }
    const x = new Float32Array(e.inputBuffer.getChannelData(0));
    let suma = 0;
    for (let i = 0; i < x.length; i++) suma += x[i] * x[i];
    const rms = Math.sqrt(suma / x.length);
    const umbral = Math.max(0.012, fondo * 3);
    if (eventos.onNivel && reloj() - ultimoNivel > 70) {
      ultimoNivel = reloj();
      eventos.onNivel(Math.min(1, rms / 0.12), rms > umbral);
    }
    if (!hablando) {
      fondo = fondo * 0.95 + Math.min(rms, 0.05) * 0.05;
      previo.push(x);
      if (previo.length > Math.ceil(0.3 / bloque)) previo.shift();
      if (rms > umbral) {
        hablando = true;
        inicioFrase = reloj() - 300;
        frase = previo;
        previo = [];
        silencioS = 0;
        vozS = 0;
      }
      return;
    }
    frase.push(x);
    if (rms > umbral * 0.7) {
      vozS += bloque;
      silencioS = 0;
    } else silencioS += bloque;
    const duracion = frase.length * bloque;
    if (silencioS > 0.8 || duracion > 20) enviarFrase();
  };

  eventos.onEstado("escuchando", "en este equipo");
  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    proc.onaudioprocess = null;
    proc.disconnect();
    fuente.disconnect();
    cerrarMic();
    if (ctx.state !== "closed") ctx.close().catch(() => {});
  };
  return {
    motor: "whisper",
    detener: () => {
      if (detenido) return;
      detenido = true;
      if (hablando) enviarFrase();
      cerrar();
      if (pendientes > 0) eventos.onEstado("transcribiendo");
      terminarSiCorresponde();
    },
    cancelar: () => {
      cancelado = true;
      detenido = true;
      cerrar();
      eventos.onEstado("inactivo");
    },
    pausar: (v: boolean) => {
      pausado = v;
    },
  };
}

/* ───────────── Entrada ───────────── */

/** Permite cancelar mientras se prepara (por ejemplo, durante la primera descarga). */
export type ControlDictado = { cancelado?: boolean };
export class DictadoCancelado extends Error {
  constructor() {
    super("cancelado");
  }
}

export async function iniciarDictado(modo: ModoDictado, eventos: EventosDictado, control: ControlDictado = {}, opciones: OpcionesDictado = {}): Promise<Dictado> {
  const Clase = claseReconocedor();
  if (modo === "navegador") {
    if (!Clase) throw new Error("Este navegador no trae dictado por voz. Use Edge o Chrome, o el dictado privado (en Ajustes de voz).");
    return conReconocedor(Clase, "es-CO", false, eventos, opciones);
  }
  eventos.onEstado("preparando", "Preparando el dictado privado…");
  const enDispositivo = await idiomaEnDispositivo(Clase, eventos);
  if (control.cancelado) throw new DictadoCancelado();
  if (enDispositivo && Clase) return conReconocedor(Clase, enDispositivo, true, eventos, opciones);
  if (!hayMicrofono()) throw new Error("Este navegador no permite usar el micrófono en esta página.");
  try {
    return await conWhisper(eventos, control);
  } catch (e) {
    if (e instanceof DictadoCancelado) throw e;
    const nombre = e instanceof Error ? `${e.name} ${e.message}` : String(e);
    if (/NotAllowed|Permission|denied|SecurityError/i.test(nombre)) throw new Error(ERRORES["not-allowed"]);
    if (/NotFound|DevicesNotFound|NotReadable/i.test(nombre)) throw new Error(ERRORES["audio-capture"]);
    throw new Error(`No pude preparar el dictado privado (${e instanceof Error ? e.message : String(e)}). La primera vez necesita internet para descargar el reconocedor.`);
  }
}

/** ¿Ya está descargado el reconocedor privado (Whisper) en este equipo? */
export async function reconocedorDescargado(): Promise<boolean> {
  try {
    return await new Promise((ok) => {
      const r = indexedDB.open("melki-dictado-v1", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("archivos");
      r.onerror = () => ok(false);
      r.onsuccess = () => {
        const d = r.result;
        const t = d.transaction("archivos", "readonly").objectStore("archivos").get(`listo:${CONFIG.dictado.modelo}`);
        t.onsuccess = () => {
          ok(Boolean(t.result));
          d.close();
        };
        t.onerror = () => ok(false);
      };
    });
  } catch {
    return false;
  }
}

/** Borra el reconocedor privado descargado (libera unos 100 MB). */
export async function borrarReconocedor(): Promise<void> {
  trabajador?.terminate();
  trabajador = null;
  listo = null;
  await new Promise<void>((ok) => {
    try {
      const r = indexedDB.deleteDatabase("melki-dictado-v1");
      r.onsuccess = () => ok();
      r.onerror = () => ok();
      r.onblocked = () => ok();
    } catch {
      ok();
    }
  });
}
