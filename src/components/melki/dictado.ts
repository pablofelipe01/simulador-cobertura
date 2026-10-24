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

export type EventosDictado = {
  /** Texto dictado en esta sesión: lo confirmado y lo que aún se está reconociendo. */
  onTexto: (final: string, parcial: string) => void;
  onEstado: (estado: EstadoDictado, detalle?: string) => void;
  onError: (mensaje: string) => void;
  /** Empezó a oírse una frase nueva (lo usa manos libres para no confundir la voz de Melki con la del usuario). */
  onInicioFrase?: () => void;
  /** Elige entre las versiones que propone el reconocimiento para cada frase (el Asistente Melki lo usa). */
  elegir?: (alternativas: string[]) => string;
  /** Palabras que conviene entender bien (si el reconocimiento en el equipo admite sugerencias). */
  frases?: string[];
};

export type Dictado = {
  /** Termina de escuchar; el texto que falte por transcribir todavía llega. */
  detener: () => void;
  /** Corta todo sin esperar. */
  cancelar: () => void;
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
    .replace(/\b(red|redes|malla|mallas)\s+(mes|mech|mesch|mesc)\b/gi, "$1 mesh")
    .replace(/\b(mes|mesh|mech)\s*(core|cor|kor|cord)\b/gi, "MeshCore")
    .replace(/\b(gate\s+way|geit\s*wey|geit\s*wei|gueit\s*wey|gueit\s*wei|getwey|getway|geiwey|geitway|gate\s*guey|gay\s*way)\b/gi, "gateway")
    .replace(/\b(e?ctarias|e?ctareas|hectarias|ectaria)\b/gi, "hectáreas")
    .replace(/\bhectaria\b/gi, "hectárea")
    .replace(/\b(?:ese\s+efe|s\s+f)\s*(\d{1,2})\b/gi, "SF$1")
    .replace(/\b(estar\s*link|star\s+link|starling|estarlin)\b/gi, "Starlink")
    .replace(/\b(guasap|wasap|whats\s+app|guatsap)\b/gi, "WhatsApp")
    .replace(/\blo\s+ra\b/gi, "LoRa");
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

/* ───────────── Modo navegador (y en el dispositivo, si el navegador lo trae) ───────────── */

const IDIOMAS = ["es-CO", "es-419", "es-US", "es-MX", "es-ES"];

const ERRORES: Record<string, string> = {
  "not-allowed": "No tengo permiso para usar el micrófono. Permítalo en el candado de la barra de direcciones y vuelva a tocar el micrófono.",
  "service-not-allowed": "El navegador no permite el dictado en esta página. Pruebe el dictado privado (en Ajustes de voz).",
  "audio-capture": "No encuentro un micrófono. Revise que esté conectado y que Windows le dé permiso al navegador.",
  network: "El dictado del navegador necesita internet. Sin conexión, use el dictado privado (en Ajustes de voz).",
  "language-not-supported": "El reconocimiento no admite español en este equipo.",
};

function conReconocedor(Clase: ClaseReconocedor, idioma: string, local: boolean, eventos: EventosDictado): Dictado {
  const r = new Clase();
  r.lang = idioma;
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = eventos.elegir ? 4 : 1;
  if (local) r.processLocally = true;
  // Sugerencias de palabras («Melki», «gateway»…): solo en el equipo, donde el navegador las admite
  const Frase = (window as unknown as { SpeechRecognitionPhrase?: new (frase: string, peso: number) => unknown }).SpeechRecognitionPhrase;
  if (local && Frase && eventos.frases?.length && "phrases" in r) {
    try {
      r.phrases = eventos.frases.map((f) => new Frase(f, 3));
    } catch {
      // Sin sugerencias: sigue igual
    }
  }
  /** La frase dicha: la primera versión o la que mejor se entiende en el simulador. */
  const texto = (x: Resultado) => {
    const n = eventos.elegir ? Math.max(1, x.length ?? 1) : 1;
    const opciones = Array.from({ length: n }, (_, k) => x[k]?.transcript?.trim() ?? "").filter(Boolean);
    return opciones.length > 1 && eventos.elegir ? eventos.elegir(opciones) : (opciones[0] ?? "");
  };
  let final = "";
  let terminado = false;
  let vistos = 0;
  r.onresult = (e) => {
    if (e.results.length > vistos) {
      vistos = e.results.length;
      eventos.onInicioFrase?.();
    }
    let confirmado = "";
    let parcial = "";
    for (let i = 0; i < e.results.length; i++) {
      const x = e.results[i];
      if (x.isFinal) confirmado = unir(confirmado, texto(x));
      else parcial = unir(parcial, x[0].transcript.trim());
    }
    final = confirmado;
    eventos.onTexto(final, parcial);
  };
  r.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    eventos.onError(ERRORES[e.error] ?? `El dictado se detuvo (${e.error}).`);
  };
  r.onend = () => {
    if (terminado) return;
    terminado = true;
    eventos.onTexto(final, "");
    eventos.onEstado("inactivo");
  };
  r.start();
  eventos.onEstado("escuchando", local ? "en este equipo" : undefined);
  return {
    motor: local ? "dispositivo" : "navegador",
    detener: () => r.stop(),
    cancelar: () => {
      terminado = true;
      r.abort();
      eventos.onEstado("inactivo");
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

  const terminarSiCorresponde = () => {
    if (detenido && pendientes === 0 && !cancelado) {
      eventos.onTexto(final, "");
      eventos.onEstado("inactivo");
    }
  };

  const enviarFrase = () => {
    const partes = frase;
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
        final = unir(final, limpiarWhisper(t));
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
    const x = new Float32Array(e.inputBuffer.getChannelData(0));
    let suma = 0;
    for (let i = 0; i < x.length; i++) suma += x[i] * x[i];
    const rms = Math.sqrt(suma / x.length);
    const umbral = Math.max(0.012, fondo * 3);
    if (!hablando) {
      fondo = fondo * 0.95 + Math.min(rms, 0.05) * 0.05;
      previo.push(x);
      if (previo.length > Math.ceil(0.3 / bloque)) previo.shift();
      if (rms > umbral) {
        hablando = true;
        eventos.onInicioFrase?.();
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

export async function iniciarDictado(modo: ModoDictado, eventos: EventosDictado, control: ControlDictado = {}): Promise<Dictado> {
  const Clase = claseReconocedor();
  if (modo === "navegador") {
    if (!Clase) throw new Error("Este navegador no trae dictado por voz. Use Edge o Chrome, o el dictado privado (en Ajustes de voz).");
    return conReconocedor(Clase, "es-CO", false, eventos);
  }
  eventos.onEstado("preparando", "Preparando el dictado privado…");
  const enDispositivo = await idiomaEnDispositivo(Clase, eventos);
  if (control.cancelado) throw new DictadoCancelado();
  if (enDispositivo && Clase) return conReconocedor(Clase, enDispositivo, true, eventos);
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
