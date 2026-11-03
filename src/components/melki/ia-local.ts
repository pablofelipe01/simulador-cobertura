// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// La IA local de Melki: un modelo de lenguaje abierto (Qwen3, de Alibaba) que corre en la tarjeta gráfica de este
// equipo con WebGPU. No se instala nada en el sistema: el modelo se descarga una vez, solo cuando la persona lo activa,
// y queda guardado en el navegador para usarlo sin internet. Melki la usa para entender lo que se le pide con palabras
// libres (lo pasa a órdenes que su intérprete verifica) y para responder con los datos del simulador; las cifras del
// diseño siempre salen del cálculo, nunca del modelo. Si la tarjeta gráfica deja de responder, la IA local se apaga
// sola, lo dice y no lo vuelve a intentar hasta que la persona la active de nuevo. Lo que se muestra sale en el idioma
// de la pantalla (también lo que avisa el trabajador: manda una clave y aquí se dice en el idioma de ese momento).
import { CONFIG } from "@/lib/config";
import { numeroLocal, tx } from "@/lib/idioma";

import { CODIGO_IA_LOCAL } from "./ia-local-trabajador";

export type ModeloLocal = { id: string; id32: string; nombre: string; detalle: string; descargaGb: number; memoriaGb: number };

/**
 * Los modelos que se pueden usar (q4f16; si la tarjeta no tiene shader-f16, la variante q4f32). Qwen3 y no Qwen3.5: los
 * modelos Qwen3.5 solo están desde WebLLM 0.2.83, y esas versiones bloquean la tarjeta gráfica en equipos con Windows y
 * gráficos AMD integrados (ver config.ts). Descarga: lo que pesan los archivos del modelo en Hugging Face. El nombre y
 * el detalle, en el idioma de la pantalla.
 */
export const MODELOS_LOCALES: readonly ModeloLocal[] = [
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    id32: "Qwen3-4B-q4f32_1-MLC",
    get nombre() {
      return tx("Qwen3 4B (recomendado)", "Qwen3 4B (recommended)");
    },
    get detalle() {
      return tx("Entiende muy bien el español y es estable en una tarjeta gráfica integrada", "Understands English and Spanish very well and is stable on an integrated graphics card");
    },
    descargaGb: 2.3,
    memoriaGb: 3.4,
  },
  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    id32: "Qwen3-1.7B-q4f32_1-MLC",
    get nombre() {
      return tx("Qwen3 1.7B (liviano)", "Qwen3 1.7B (light)");
    },
    get detalle() {
      return tx("Para equipos modestos: más rápido, entiende un poco menos", "For modest computers: faster, understands a little less");
    },
    descargaGb: 1,
    memoriaGb: 2,
  },
  {
    id: "Qwen3-8B-q4f16_1-MLC",
    id32: "Qwen3-8B-q4f32_1-MLC",
    get nombre() {
      return tx("Qwen3 8B (máximo)", "Qwen3 8B (maximum)");
    },
    get detalle() {
      return tx("El más capaz; pide una tarjeta gráfica con 8 GB o más", "The most capable; needs a graphics card with 8 GB or more");
    },
    descargaGb: 4.6,
    memoriaGb: 5.7,
  },
];

export const MODELO_LOCAL_DEFECTO = MODELOS_LOCALES.some((m) => m.id === CONFIG.iaLocal.modelo) ? CONFIG.iaLocal.modelo : MODELOS_LOCALES[0].id;

export const modeloLocal = (id: string) => MODELOS_LOCALES.find((m) => m.id === id) ?? MODELOS_LOCALES[0];

/** «2,4 GB» (en inglés, «2.4 GB»). */
export const gb = (x: number) => `${numeroLocal(x, { maximumFractionDigits: 1 })} GB`;

/* ───────────── Preferencias (en este navegador) ───────────── */

const CLAVE = "simulador-cobertura-melki-ia-local";

/** `falla`: cuándo dejó de responder la tarjeta gráfica con la IA local por última vez (ISO), si pasó. */
export type PreferenciaIALocal = { activa: boolean; modelo: string; falla?: string };

export function leerPreferenciaIALocal(): PreferenciaIALocal {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Partial<PreferenciaIALocal> | null;
    // Un modelo que ya no está en la lista (los Qwen3.5 de la v14) pasa al recomendado
    const modelo = v?.modelo && MODELOS_LOCALES.some((m) => m.id === v.modelo) ? v.modelo : MODELO_LOCAL_DEFECTO;
    return { activa: Boolean(v?.activa), modelo, ...(typeof v?.falla === "string" ? { falla: v.falla } : {}) };
  } catch {
    return { activa: false, modelo: MODELO_LOCAL_DEFECTO };
  }
}

export function guardarPreferenciaIALocal(p: PreferenciaIALocal) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    // Sin almacenamiento: vale solo por esta sesión
  }
}

/* ───────────── Estado (para la interfaz) ───────────── */

export type FaseIALocal = "apagada" | "sin-webgpu" | "descargando" | "cargando" | "lista" | "pensando" | "error";

/**
 * `tarjeta`: la tarjeta gráfica dejó de responder y la IA local quedó apagada (hasta que vuelva a cargar bien);
 * `fallas`: cuántas veces pasó en esta visita (la interfaz se pone al día con cada una).
 */
export type EstadoIALocal = { fase: FaseIALocal; modelo: string; avance: number; texto: string; tarjeta?: boolean; fallas?: number };

/** El texto del estado: fijo, o armado cada vez que se lee (así sale en el idioma que tenga la pantalla al mostrarlo). */
type TextoEstado = string | (() => string);

let datos: Omit<EstadoIALocal, "texto"> = { fase: "apagada", modelo: MODELO_LOCAL_DEFECTO, avance: 0 };
let textoEstado: TextoEstado = "";
let estado: EstadoIALocal = armarEstado();
const oyentes = new Set<() => void>();

/** El estado con su texto como getter: si la pantalla cambia de idioma, el mismo estado se lee en el idioma nuevo. */
function armarEstado(): EstadoIALocal {
  const t = textoEstado;
  return Object.defineProperty({ ...datos }, "texto", { enumerable: true, get: () => (typeof t === "function" ? t() : t) }) as EstadoIALocal;
}

export const estadoIALocal = () => estado;

export function suscribirIALocal(f: () => void): () => void {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

function fijar(c: Partial<Omit<EstadoIALocal, "texto">> & { texto?: TextoEstado }) {
  const { texto, ...resto } = c;
  datos = { ...datos, ...resto };
  if (texto !== undefined) textoEstado = texto;
  estado = armarEstado();
  for (const f of oyentes) f();
}

/* ───────────── Si la tarjeta gráfica deja de responder ───────────── */

/**
 * Lo que dicen WebLLM, WebGPU y Windows cuando la tarjeta gráfica se bloquea o se reinicia (y lo que queda después: el
 * motor sin el modelo, o una tarjeta que ya no entrega dispositivos hasta reiniciar el navegador).
 */
const FALLA_TARJETA = /device (was )?lost|DEVICE_HUNG|DEVICE_REMOVED|DEVICE_RESET|DXGI_ERROR|Model not loaded|has already been disposed|Instance\.dispose|GPU (process|device) (was )?(lost|crashed)|context lost/i;

export const esFallaTarjeta = (texto: string) => FALLA_TARJETA.test(texto);

/** Lo que se le dice a la persona cuando la tarjeta gráfica dejó de responder. */
export const TEXTO_TARJETA =
  "La tarjeta gráfica de este equipo dejó de responder mientras usaba la IA local (se quedó sin memoria o se bloqueó). Apagué la IA local para que no vuelva a pasar. Para que el navegador recupere la tarjeta gráfica, ciérrelo por completo y vuelva a abrirlo; sus diseños no se pierden. Si la vuelve a activar, hágalo con el navegador recién abierto y, si se repite, con el modelo liviano.";

/** Lo mismo, en la conversación (cuando la tarjeta falló pensando un pedido). */
export const TEXTO_TARJETA_CHAT =
  "Intenté pensarlo con la IA local, pero la tarjeta gráfica de este equipo dejó de responder (se quedó sin memoria o se bloqueó). Apagué la IA local para que no vuelva a pasar. Para que el navegador recupere la tarjeta gráfica, ciérrelo por completo y vuelva a abrirlo; sus diseños no se pierden.";

/** La tarjeta quedó bloqueada desde antes (no entrega dispositivos): hay que reiniciar el navegador. */
export const TEXTO_TARJETA_BLOQUEADA =
  "La tarjeta gráfica de este navegador quedó bloqueada desde un fallo anterior. Cierre el navegador por completo y vuelva a abrirlo antes de usar la IA local; sus diseños no se pierden.";

/** TEXTO_TARJETA en el idioma de la pantalla. */
export const textoTarjeta = (): string =>
  tx(
    TEXTO_TARJETA,
    "This computer's graphics card stopped responding while the local AI was running (it ran out of memory or froze). I turned the local AI off so it doesn't happen again. For the browser to recover the graphics card, close it completely and open it again; your designs won't be lost. If you turn it on again, do so with a freshly opened browser and, if it happens again, with the light model.",
  );

/** TEXTO_TARJETA_CHAT en el idioma de la pantalla. */
export const textoTarjetaChat = (): string =>
  tx(
    TEXTO_TARJETA_CHAT,
    "I tried to think it through with the local AI, but this computer's graphics card stopped responding (it ran out of memory or froze). I turned the local AI off so it doesn't happen again. For the browser to recover the graphics card, close it completely and open it again; your designs won't be lost.",
  );

/** TEXTO_TARJETA_BLOQUEADA en el idioma de la pantalla. */
export const textoTarjetaBloqueada = (): string =>
  tx(TEXTO_TARJETA_BLOQUEADA, "This browser's graphics card has been locked since an earlier failure. Close the browser completely and open it again before using the local AI; your designs won't be lost.");

/**
 * La tarjeta gráfica dejó de responder: la IA local se apaga y queda anotado (en este navegador) para avisarlo en los
 * ajustes; no se vuelve a intentar sola. Lo usa también el modelo de mentira de las pruebas.
 */
function perderTarjeta() {
  cargado = null;
  if (estado.tarjeta) {
    fijar({ fase: "error", avance: 0, texto: textoTarjeta });
    return;
  }
  const p = leerPreferenciaIALocal();
  guardarPreferenciaIALocal({ ...p, activa: false, falla: new Date().toISOString() });
  fijar({ fase: "error", avance: 0, tarjeta: true, fallas: (estado.fallas ?? 0) + 1, texto: textoTarjeta });
}

/* ───────────── Errores propios (también los que avisa el trabajador) ───────────── */

/** Un error propio: el mensaje en español (como siempre) y una clave para decirlo en el idioma de la pantalla. */
type ErrorIALocal = Error & { clave?: string; dato?: string | number };

function errorConClave(mensaje: string, clave?: string, dato?: string | number): ErrorIALocal {
  const e: ErrorIALocal = new Error(mensaje);
  if (clave) e.clave = clave;
  if (dato !== undefined) e.dato = dato;
  return e;
}

/** Lo que dice en inglés un error propio (los de la biblioteca y los del navegador ya vienen en inglés). */
function errorEnIngles(e: unknown, t: string): string {
  const x = e instanceof Error ? (e as ErrorIALocal) : null;
  switch (x?.clave) {
    case "descarga-motor":
      return `I couldn't download the local AI engine (${x?.dato ?? "?"}). Check your internet connection.`;
    case "huella":
      return "The local AI engine that arrived isn't the expected one (its SHA-256 fingerprint doesn't match): I won't use it.";
    case "sin-webgpu":
      return "This browser doesn't have WebGPU: use an up-to-date Chrome or Edge on a computer with a graphics card.";
    case "no-lista":
      return "The local AI isn't ready.";
    case "trabajador":
      return "The local AI worker stopped.";
  }
  // Sin clave, los avisos propios se reconocen por su texto
  const motor = t.match(/^No pude descargar el motor de la IA local \((\d+)\)/);
  if (motor) return errorEnIngles(errorConClave(t, "descarga-motor", Number(motor[1])), t);
  const clave = /huella SHA-256/.test(t) ? "huella" : /no tiene WebGPU/.test(t) ? "sin-webgpu" : /^La IA local no está lista/.test(t) ? "no-lista" : /^El trabajador de la IA local se detuvo/.test(t) ? "trabajador" : null;
  return clave ? errorEnIngles(errorConClave(t, clave), t) : t;
}

/* ───────────── WebGPU ───────────── */

type AdaptadorGpu = { features: { has(f: string): boolean }; requestDevice(): Promise<{ destroy(): void }> };
type Gpu = { requestAdapter(o?: { powerPreference?: string }): Promise<AdaptadorGpu | null> };

let soporte: Promise<{ ok: boolean; f16: boolean; motivo?: string }> | null = null;

const sinWebGPU = () => tx("Este navegador no tiene WebGPU. Use Chrome o Edge actualizados.", "This browser doesn't have WebGPU. Use an up-to-date Chrome or Edge.");

/** Un «no se puede» con su motivo como getter: el resultado queda guardado, pero se lee en el idioma de la pantalla. */
const noSoporta = (motivo: () => string): { ok: boolean; f16: boolean; motivo?: string } => ({
  ok: false,
  f16: false,
  get motivo() {
    return motivo();
  },
});

/** ¿Este navegador y esta tarjeta gráfica pueden correr el modelo? (WebGPU y, si hay, números de 16 bits en la tarjeta) */
export function soporteWebGPU(): Promise<{ ok: boolean; f16: boolean; motivo?: string }> {
  // Con el modelo de mentira de las pruebas no hace falta tarjeta gráfica
  if (dePrueba()) return Promise.resolve({ ok: true, f16: true });
  soporte ??= (async () => {
    const gpu = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { gpu?: Gpu }).gpu;
    if (!gpu) return noSoporta(sinWebGPU);
    try {
      const a = await gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!a) return noSoporta(() => tx("No encontré una tarjeta gráfica compatible con WebGPU en este equipo.", "I couldn't find a WebGPU-compatible graphics card on this computer."));
      return { ok: true, f16: a.features.has("shader-f16") };
    } catch {
      return noSoporta(() => tx("La tarjeta gráfica no respondió a WebGPU.", "The graphics card didn't respond to WebGPU."));
    }
  })();
  return soporte;
}

/**
 * ¿La tarjeta gráfica entrega un dispositivo ahora? (se pide uno y se suelta enseguida). Tras un bloqueo, Chrome deja
 * WebGPU sin dispositivos hasta reiniciarlo: así se avisa antes de cargar el modelo en vez de fallar a medias.
 * `bloqueada`: quedó bloqueada desde antes; `motivo`, en el idioma de la pantalla cuando se lea.
 */
async function tarjetaSana(): Promise<{ ok: boolean; bloqueada?: boolean; motivo?: () => string }> {
  const gpu = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { gpu?: Gpu }).gpu;
  if (!gpu) return { ok: false, motivo: sinWebGPU };
  try {
    const a = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!a) return { ok: false, bloqueada: true, motivo: textoTarjetaBloqueada };
    (await a.requestDevice()).destroy();
    return { ok: true };
  } catch (e) {
    const t = e instanceof Error ? e.message : String(e);
    return esFallaTarjeta(t)
      ? { ok: false, bloqueada: true, motivo: textoTarjetaBloqueada }
      : { ok: false, motivo: () => tx(`La tarjeta gráfica no respondió a WebGPU: ${t.slice(0, 160)}`, `The graphics card didn't respond to WebGPU: ${t.slice(0, 160)}`) };
  }
}

/** El id del modelo que de verdad se carga (la variante q4f32 si la tarjeta no maneja 16 bits). */
async function idReal(modelo: string): Promise<string> {
  const m = modeloLocal(modelo);
  return (await soporteWebGPU()).f16 ? m.id : m.id32;
}

/* ───────────── El trabajador ───────────── */

/** `clave` (en el avance y en los errores propios del trabajador): para decirlos aquí en el idioma de la pantalla. */
type Mensaje =
  | { tipo: "progreso"; fase: "biblioteca" | "modelo"; avance: number; texto: string; clave?: string }
  | { tipo: "listo"; modelo: string }
  | { tipo: "respuesta"; id: number; texto: string }
  | { tipo: "descargado"; id: number; si: boolean }
  | { tipo: "borrado"; id: number }
  | { tipo: "descargada"; id: number }
  /** La tarjeta gráfica dejó de responder (lo avisa WebLLM en cualquier momento, no solo al pedir algo). */
  | { tipo: "perdida"; mensaje: string }
  | { tipo: "error"; id?: number; mensaje: string; gpu?: boolean; clave?: string; dato?: string | number };

let trabajador: Worker | null = null;
let siguienteId = 1;
const esperas = new Map<number, { ok: (m: Mensaje) => void; mal: (e: Error) => void }>();
let alCargar: { ok: () => void; mal: (e: Error) => void } | null = null;

function obtenerTrabajador(): Worker {
  if (trabajador) return trabajador;
  const url = URL.createObjectURL(new Blob([CODIGO_IA_LOCAL], { type: "text/javascript" }));
  // Trabajador clásico (no de módulo): desde un Blob, los de módulo no arrancan en la versión HTML (file://)
  trabajador = new Worker(url, { name: "melki-ia-local" });
  trabajador.onmessage = (e: MessageEvent<Mensaje>) => {
    const m = e.data;
    if (m.tipo === "perdida" || (m.tipo === "error" && (m.gpu || esFallaTarjeta(m.mensaje)))) perderTarjeta();
    if (m.tipo === "perdida") {
      // Lo que estaba esperando a la tarjeta no va a llegar: se suelta ya (nada queda colgado)
      const falla = new Error(`Device was lost: ${m.mensaje}`);
      for (const [id, e] of esperas) {
        esperas.delete(id);
        e.mal(falla);
      }
      alCargar?.mal(falla);
      alCargar = null;
      return;
    }
    if (m.tipo === "progreso") {
      const descarga = /fetch|download|descarg/i.test(m.texto) || m.fase === "biblioteca";
      fijar({ fase: descarga ? "descargando" : "cargando", avance: Math.max(0, Math.min(1, m.avance)), texto: () => textoAvance(m) });
      return;
    }
    if (m.tipo === "listo") {
      alCargar?.ok();
      alCargar = null;
      return;
    }
    if (m.tipo === "error" && m.id === undefined) {
      alCargar?.mal(errorConClave(m.mensaje, m.clave, m.dato));
      alCargar = null;
      return;
    }
    const id = "id" in m ? m.id : undefined;
    if (id === undefined) return;
    const espera = esperas.get(id);
    if (!espera) return;
    esperas.delete(id);
    if (m.tipo === "error") espera.mal(errorConClave(m.mensaje, m.clave, m.dato));
    else espera.ok(m);
  };
  trabajador.onerror = () => {
    alCargar?.mal(errorConClave("El trabajador de la IA local se detuvo.", "trabajador"));
    alCargar = null;
  };
  return trabajador;
}

/** El avance en palabras («Descargando el modelo: 38 %…», «Cargando el modelo en la tarjeta gráfica…»). */
function textoAvance(m: Extract<Mensaje, { tipo: "progreso" }>): string {
  if (m.fase === "biblioteca") return m.clave === "motor" ? tx(m.texto, "Downloading the local AI engine (about 6.5 MB)…") : m.texto;
  const pct = Math.round(Math.max(0, Math.min(1, m.avance)) * 100);
  if (/fetch|download/i.test(m.texto)) return tx(`Descargando el modelo (solo la primera vez): ${pct} %…`, `Downloading the model (first time only): ${pct}%…`);
  if (/cache|load|loading|shader|gpu|init/i.test(m.texto)) return tx(`Cargando el modelo en la tarjeta gráfica: ${pct} %…`, `Loading the model onto the graphics card: ${pct}%…`);
  return tx(`Preparando la IA local: ${pct} %…`, `Preparing the local AI: ${pct}%…`);
}

function pedir(m: Record<string, unknown>): Promise<Mensaje> {
  const id = siguienteId++;
  return new Promise((ok, mal) => {
    esperas.set(id, { ok, mal });
    obtenerTrabajador().postMessage({ ...m, id, libreria: CONFIG.iaLocal.libreria, huella: CONFIG.iaLocal.huella });
  });
}

/* ───────────── Motor de mentira (pruebas) ───────────── */

/** Para las pruebas sin tarjeta gráfica: `window.__melkiIALocalDePrueba` responde en vez del modelo. */
type MotorDePrueba = { completar(mensajes: MensajeChat[], opciones: OpcionesCompletar): Promise<string> };
const dePrueba = (): MotorDePrueba | null => (typeof window === "undefined" ? null : ((window as Window & { __melkiIALocalDePrueba?: MotorDePrueba }).__melkiIALocalDePrueba ?? null));

/* ───────────── Lo que se usa desde Melki ───────────── */

export type MensajeChat = { role: "system" | "user" | "assistant"; content: string };
export type OpcionesCompletar = { esquema?: Record<string, unknown>; maxTokens?: number; temperatura?: number };

let cargado: string | null = null;
let preparando: Promise<boolean> | null = null;

/** ¿Está cargada y lista para pensar? */
export const iaLocalLista = () => (dePrueba() ? true : cargado !== null && (estado.fase === "lista" || estado.fase === "pensando"));

/**
 * Descarga (la primera vez) y carga el modelo en la tarjeta gráfica. Devuelve si quedó lista; el avance y los errores
 * van al estado (la interfaz los muestra).
 */
export function prepararIALocal(modelo = leerPreferenciaIALocal().modelo): Promise<boolean> {
  if (dePrueba()) {
    fijar({ fase: "lista", modelo, avance: 1, tarjeta: false, texto: () => tx("IA local de prueba lista.", "Test local AI ready.") });
    return Promise.resolve(true);
  }
  if (cargado === modelo && iaLocalLista()) return Promise.resolve(true);
  if (preparando) return preparando;
  preparando = (async () => {
    const s = await soporteWebGPU();
    if (!s.ok) {
      fijar({ fase: "sin-webgpu", modelo, avance: 0, texto: () => s.motivo ?? tx("Sin WebGPU.", "No WebGPU.") });
      preparando = null;
      return false;
    }
    fijar({ fase: "cargando", modelo, avance: 0, texto: () => tx("Preparando la IA local…", "Preparing the local AI…") });
    // Una tarjeta que quedó bloqueada no entrega dispositivos: se avisa antes de cargar nada, y la IA local se apaga
    // (no tiene caso intentarlo a cada pedido hasta que se reinicie el navegador)
    const sana = await tarjetaSana();
    if (!sana.ok) {
      cargado = null;
      preparando = null;
      if (sana.bloqueada) {
        guardarPreferenciaIALocal({ ...leerPreferenciaIALocal(), activa: false });
        fijar({ fase: "error", modelo, avance: 0, tarjeta: true, fallas: (estado.fallas ?? 0) + 1, texto: textoTarjetaBloqueada });
      } else fijar({ fase: "error", modelo, avance: 0, texto: sana.motivo ?? textoTarjetaBloqueada });
      return false;
    }
    try {
      const real = await idReal(modelo);
      await new Promise<void>((ok, mal) => {
        alCargar = { ok, mal };
        obtenerTrabajador().postMessage({ tipo: "cargar", modelo: real, libreria: CONFIG.iaLocal.libreria, huella: CONFIG.iaLocal.huella });
      });
      cargado = modelo;
      fijar({
        fase: "lista",
        modelo,
        avance: 1,
        tarjeta: false,
        texto: () => {
          const nombre = modeloLocal(modelo).nombre.replace(/ \(.*\)$/, "");
          return tx(`${nombre} lista en este equipo.`, `${nombre} ready on this computer.`);
        },
      });
      return true;
    } catch (e) {
      cargado = null;
      fijar({ fase: "error", modelo, avance: 0, texto: () => textoError(e) });
      return false;
    } finally {
      preparando = null;
    }
  })();
  return preparando;
}

/** Lo que falló, en palabras y en el idioma de la pantalla (la biblioteca y el navegador avisan en inglés). */
export function textoError(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  if (/huella|WebGPU: use/.test(t)) return tx(t, errorEnIngles(e, t));
  if (/quota|QuotaExceeded|storage is full|no space/i.test(t))
    return tx("No hay espacio suficiente en el navegador para guardar el modelo: libere espacio o elija el modelo liviano (1.7B).", "There isn't enough space in the browser to save the model: free up some space or choose the light model (1.7B).");
  if (/Failed to fetch|NetworkError|network|ERR_|Failed to store|Load failed/i.test(t))
    return tx(
      "No pude descargar el modelo (se baja de Hugging Face y jsDelivr): revise la conexión a internet e intente de nuevo; lo que ya bajó queda guardado.",
      "I couldn't download the model (it comes from Hugging Face and jsDelivr): check your internet connection and try again; whatever has already downloaded stays saved.",
    );
  // La tarjeta se bloqueó o se reinició (DXGI_ERROR_DEVICE_HUNG, «Device was lost», el motor quedó sin el modelo)
  if (esFallaTarjeta(t)) return textoTarjeta();
  if (/adapter|gpu|out of memory|OOM|maxStorageBuffer|maxBufferSize/i.test(t))
    return tx(
      "La tarjeta gráfica no pudo cargar el modelo (memoria insuficiente o WebGPU ocupada): pruebe con el modelo liviano (1.7B) o cierre otras pestañas pesadas.",
      "The graphics card couldn't load the model (not enough memory, or WebGPU is busy): try the light model (1.7B) or close other heavy tabs.",
    );
  return tx(`No pude preparar la IA local: ${t}`, `I couldn't prepare the local AI: ${errorEnIngles(e, t)}`);
}

/** ¿El modelo ya está guardado en este navegador? (sin descargar nada) */
export async function modeloLocalDescargado(modelo: string): Promise<boolean> {
  if (dePrueba()) return true;
  if (!(await soporteWebGPU()).ok) return false;
  try {
    const r = await pedir({ tipo: "descargado", modelo: await idReal(modelo) });
    return r.tipo === "descargado" && r.si;
  } catch {
    return false;
  }
}

/** Borra el modelo de este navegador (libera el espacio). */
export async function borrarModeloLocal(modelo: string): Promise<void> {
  if (dePrueba()) return;
  await pedir({ tipo: "borrar", modelo: await idReal(modelo) });
  if (cargado === modelo) cargado = null;
  fijar({ fase: "apagada", modelo, avance: 0, texto: () => tx("Borré el modelo de este equipo.", "I deleted the model from this computer.") });
}

/** Saca el modelo de la tarjeta gráfica (al apagar la IA local); queda guardado para la próxima vez. */
export async function apagarIALocal(): Promise<void> {
  if (!dePrueba() && trabajador && cargado) await pedir({ tipo: "descargar" }).catch(() => undefined);
  cargado = null;
  fijar({ fase: "apagada", avance: 0, texto: "" });
}

/** Lo más que se espera una respuesta del modelo (un pedido corto tarda segundos, aun en una tarjeta integrada). */
const LIMITE_RESPUESTA_MS = 90000;

/** Le pide al modelo una respuesta (con `esquema`, un JSON con esa forma). */
export async function completarLocal(mensajes: MensajeChat[], opciones: OpcionesCompletar = {}): Promise<string> {
  const p = dePrueba();
  if (p) {
    // El modelo de mentira también puede «bloquear la tarjeta» (así se prueba la red de seguridad)
    try {
      return await p.completar(mensajes, opciones);
    } catch (e) {
      if (esFallaTarjeta(e instanceof Error ? e.message : String(e))) perderTarjeta();
      throw e;
    }
  }
  if (!iaLocalLista()) throw errorConClave(tx("La IA local no está lista.", "The local AI isn't ready."), "no-lista");
  fijar({ fase: "pensando" });
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    // Con un límite: si la tarjeta se queda pensando sin responder, Melki no queda esperando para siempre
    const r = await Promise.race([
      pedir({ tipo: "completar", mensajes, esquema: opciones.esquema, maxTokens: opciones.maxTokens, temperatura: opciones.temperatura }),
      new Promise<never>((_, mal) => {
        reloj = setTimeout(() => mal(new Error(tx("La IA local tardó demasiado en responder.", "The local AI took too long to answer."))), LIMITE_RESPUESTA_MS);
      }),
    ]);
    return r.tipo === "respuesta" ? r.texto : "";
  } finally {
    clearTimeout(reloj);
    if (estado.fase === "pensando") fijar({ fase: "lista" });
  }
}
