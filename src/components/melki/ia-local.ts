// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// La IA local de Melki: un modelo de lenguaje abierto (Qwen3.5, de Alibaba) que corre en la tarjeta gráfica de este
// equipo con WebGPU. No se instala nada en el sistema: el modelo se descarga una vez, solo cuando la persona lo activa,
// y queda guardado en el navegador para usarlo sin internet. Melki la usa para entender lo que se le pide con palabras
// libres (lo pasa a órdenes que su intérprete verifica) y para responder con los datos del simulador; las cifras del
// diseño siempre salen del cálculo, nunca del modelo.
import { CONFIG } from "@/lib/config";

import { CODIGO_IA_LOCAL } from "./ia-local-trabajador";

export type ModeloLocal = { id: string; id32: string; nombre: string; detalle: string; descargaGb: number; memoriaGb: number };

/** Los modelos que se pueden usar (q4f16; si la tarjeta no tiene shader-f16, la variante q4f32). */
export const MODELOS_LOCALES: readonly ModeloLocal[] = [
  { id: "Qwen3.5-4B-q4f16_1-MLC", id32: "Qwen3.5-4B-q4f32_1-MLC", nombre: "Qwen3.5 4B (recomendado)", detalle: "Entiende muy bien el español y responde rápido en una tarjeta gráfica integrada", descargaGb: 2.4, memoriaGb: 3.9 },
  { id: "Qwen3.5-2B-q4f16_1-MLC", id32: "Qwen3.5-2B-q4f32_1-MLC", nombre: "Qwen3.5 2B (liviano)", detalle: "Para equipos modestos: más rápido, entiende un poco menos", descargaGb: 1.1, memoriaGb: 2.3 },
  { id: "Qwen3.5-9B-q4f16_1-MLC", id32: "Qwen3.5-9B-q4f32_1-MLC", nombre: "Qwen3.5 9B (máximo)", detalle: "El más capaz; pide una tarjeta gráfica con 8 GB o más", descargaGb: 5, memoriaGb: 6.5 },
];

export const MODELO_LOCAL_DEFECTO = MODELOS_LOCALES.some((m) => m.id === CONFIG.iaLocal.modelo) ? CONFIG.iaLocal.modelo : MODELOS_LOCALES[0].id;

export const modeloLocal = (id: string) => MODELOS_LOCALES.find((m) => m.id === id) ?? MODELOS_LOCALES[0];

/** «2,4 GB». */
export const gb = (x: number) => `${x.toLocaleString("es-CO", { maximumFractionDigits: 1 })} GB`;

/* ───────────── Preferencias (en este navegador) ───────────── */

const CLAVE = "simulador-cobertura-melki-ia-local";

export type PreferenciaIALocal = { activa: boolean; modelo: string };

export function leerPreferenciaIALocal(): PreferenciaIALocal {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Partial<PreferenciaIALocal> | null;
    const modelo = v?.modelo && MODELOS_LOCALES.some((m) => m.id === v.modelo) ? v.modelo : MODELO_LOCAL_DEFECTO;
    return { activa: Boolean(v?.activa), modelo };
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

export type EstadoIALocal = { fase: FaseIALocal; modelo: string; avance: number; texto: string };

let estado: EstadoIALocal = { fase: "apagada", modelo: MODELO_LOCAL_DEFECTO, avance: 0, texto: "" };
const oyentes = new Set<() => void>();

export const estadoIALocal = () => estado;

export function suscribirIALocal(f: () => void): () => void {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

function fijar(c: Partial<EstadoIALocal>) {
  estado = { ...estado, ...c };
  for (const f of oyentes) f();
}

/* ───────────── WebGPU ───────────── */

type AdaptadorGpu = { features: { has(f: string): boolean } };
type Gpu = { requestAdapter(o?: { powerPreference?: string }): Promise<AdaptadorGpu | null> };

let soporte: Promise<{ ok: boolean; f16: boolean; motivo?: string }> | null = null;

/** ¿Este navegador y esta tarjeta gráfica pueden correr el modelo? (WebGPU y, si hay, números de 16 bits en la tarjeta) */
export function soporteWebGPU(): Promise<{ ok: boolean; f16: boolean; motivo?: string }> {
  // Con el modelo de mentira de las pruebas no hace falta tarjeta gráfica
  if (dePrueba()) return Promise.resolve({ ok: true, f16: true });
  soporte ??= (async () => {
    const gpu = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { gpu?: Gpu }).gpu;
    if (!gpu) return { ok: false, f16: false, motivo: "Este navegador no tiene WebGPU. Use Chrome o Edge actualizados." };
    try {
      const a = await gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!a) return { ok: false, f16: false, motivo: "No encontré una tarjeta gráfica compatible con WebGPU en este equipo." };
      return { ok: true, f16: a.features.has("shader-f16") };
    } catch {
      return { ok: false, f16: false, motivo: "La tarjeta gráfica no respondió a WebGPU." };
    }
  })();
  return soporte;
}

/** El id del modelo que de verdad se carga (la variante q4f32 si la tarjeta no maneja 16 bits). */
async function idReal(modelo: string): Promise<string> {
  const m = modeloLocal(modelo);
  return (await soporteWebGPU()).f16 ? m.id : m.id32;
}

/* ───────────── El trabajador ───────────── */

type Mensaje =
  | { tipo: "progreso"; fase: "biblioteca" | "modelo"; avance: number; texto: string }
  | { tipo: "listo"; modelo: string }
  | { tipo: "respuesta"; id: number; texto: string }
  | { tipo: "descargado"; id: number; si: boolean }
  | { tipo: "borrado"; id: number }
  | { tipo: "descargada"; id: number }
  | { tipo: "error"; id?: number; mensaje: string };

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
    if (m.tipo === "progreso") {
      const descarga = /fetch|download|descarg/i.test(m.texto) || m.fase === "biblioteca";
      fijar({ fase: descarga ? "descargando" : "cargando", avance: Math.max(0, Math.min(1, m.avance)), texto: textoAvance(m) });
      return;
    }
    if (m.tipo === "listo") {
      alCargar?.ok();
      alCargar = null;
      return;
    }
    if (m.tipo === "error" && m.id === undefined) {
      alCargar?.mal(new Error(m.mensaje));
      alCargar = null;
      return;
    }
    const id = "id" in m ? m.id : undefined;
    if (id === undefined) return;
    const espera = esperas.get(id);
    if (!espera) return;
    esperas.delete(id);
    if (m.tipo === "error") espera.mal(new Error(m.mensaje));
    else espera.ok(m);
  };
  trabajador.onerror = () => {
    alCargar?.mal(new Error("El trabajador de la IA local se detuvo."));
    alCargar = null;
  };
  return trabajador;
}

/** El avance en palabras («Descargando el modelo: 38 %…», «Cargando el modelo en la tarjeta gráfica…»). */
function textoAvance(m: Extract<Mensaje, { tipo: "progreso" }>): string {
  if (m.fase === "biblioteca") return m.texto;
  const pct = Math.round(Math.max(0, Math.min(1, m.avance)) * 100);
  if (/fetch|download/i.test(m.texto)) return `Descargando el modelo (solo la primera vez): ${pct} %…`;
  if (/cache|load|loading|shader|gpu|init/i.test(m.texto)) return `Cargando el modelo en la tarjeta gráfica: ${pct} %…`;
  return `Preparando la IA local: ${pct} %…`;
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
    fijar({ fase: "lista", modelo, avance: 1, texto: "IA local de prueba lista." });
    return Promise.resolve(true);
  }
  if (cargado === modelo && iaLocalLista()) return Promise.resolve(true);
  if (preparando) return preparando;
  preparando = (async () => {
    const s = await soporteWebGPU();
    if (!s.ok) {
      fijar({ fase: "sin-webgpu", modelo, avance: 0, texto: s.motivo ?? "Sin WebGPU." });
      return false;
    }
    fijar({ fase: "cargando", modelo, avance: 0, texto: "Preparando la IA local…" });
    try {
      const real = await idReal(modelo);
      await new Promise<void>((ok, mal) => {
        alCargar = { ok, mal };
        obtenerTrabajador().postMessage({ tipo: "cargar", modelo: real, libreria: CONFIG.iaLocal.libreria, huella: CONFIG.iaLocal.huella });
      });
      cargado = modelo;
      fijar({ fase: "lista", modelo, avance: 1, texto: `${modeloLocal(modelo).nombre.replace(/ \(.*\)$/, "")} lista en este equipo.` });
      return true;
    } catch (e) {
      cargado = null;
      fijar({ fase: "error", modelo, avance: 0, texto: textoError(e) });
      return false;
    } finally {
      preparando = null;
    }
  })();
  return preparando;
}

/** Lo que falló, en palabras (la biblioteca y el navegador avisan en inglés). */
export function textoError(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  if (/huella|WebGPU: use/.test(t)) return t;
  if (/quota|QuotaExceeded|storage is full|no space/i.test(t)) return "No hay espacio suficiente en el navegador para guardar el modelo: libere espacio o elija el modelo liviano (2B).";
  if (/Failed to fetch|NetworkError|network|ERR_|Failed to store|Load failed/i.test(t)) return "No pude descargar el modelo (se baja de Hugging Face y jsDelivr): revise la conexión a internet e intente de nuevo; lo que ya bajó queda guardado.";
  if (/adapter|gpu|device (was )?lost|out of memory|OOM|maxStorageBuffer|maxBufferSize/i.test(t)) return "La tarjeta gráfica no pudo cargar el modelo (memoria insuficiente o WebGPU ocupada): pruebe con el modelo liviano (2B) o cierre otras pestañas pesadas.";
  return `No pude preparar la IA local: ${t}`;
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
  fijar({ fase: "apagada", modelo, avance: 0, texto: "Borré el modelo de este equipo." });
}

/** Saca el modelo de la tarjeta gráfica (al apagar la IA local); queda guardado para la próxima vez. */
export async function apagarIALocal(): Promise<void> {
  if (!dePrueba() && trabajador && cargado) await pedir({ tipo: "descargar" }).catch(() => undefined);
  cargado = null;
  fijar({ fase: "apagada", avance: 0, texto: "" });
}

/** Le pide al modelo una respuesta (con `esquema`, un JSON con esa forma). */
export async function completarLocal(mensajes: MensajeChat[], opciones: OpcionesCompletar = {}): Promise<string> {
  const p = dePrueba();
  if (p) return p.completar(mensajes, opciones);
  if (!iaLocalLista()) throw new Error("La IA local no está lista.");
  fijar({ fase: "pensando" });
  try {
    const r = await pedir({ tipo: "completar", mensajes, esquema: opciones.esquema, maxTokens: opciones.maxTokens, temperatura: opciones.temperatura });
    return r.tipo === "respuesta" ? r.texto : "";
  } finally {
    if (estado.fase === "pensando") fijar({ fase: "lista" });
  }
}
