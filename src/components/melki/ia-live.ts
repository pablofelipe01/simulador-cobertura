// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Conexión de Melki con un modelo de voz en vivo (Gemini Live de Google): una sola conexión WebSocket por la que va el
// audio del micrófono (PCM de 16 bits a 16 kHz) y vuelve la voz del modelo (PCM a 24 kHz). El modelo oye el audio
// directo, sin pasarlo a texto, y puede pedirle al simulador que haga cosas (herramientas). La clave la pone la persona
// en Ajustes y queda solo en su navegador; nunca va en el código ni en el repositorio.

/** Modelos de voz en vivo con capa gratuita (Google AI Studio). */
export const MODELOS_IA = [
  { id: "gemini-3.8-live", nombre: "Gemini 3.8 Live" },
  { id: "gemini-3.1-flash-live-preview", nombre: "Gemini 3.1 Flash Live (vista previa)" },
] as const;
export const MODELO_IA_DEFECTO = MODELOS_IA[0].id;

/** Voces del modelo (las del Live API). */
export const VOCES_IA = ["Charon", "Puck", "Orus", "Fenrir", "Kore", "Aoede", "Leda", "Zephyr"] as const;
export const VOZ_IA_DEFECTO = "Charon";

export const URL_LIVE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/** Una herramienta que el modelo puede llamar (declaración de función, esquema OpenAPI en mayúsculas). */
export type DeclaracionFuncion = {
  name: string;
  description: string;
  parameters?: { type: "OBJECT"; properties: Record<string, { type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN"; description: string; enum?: string[] }>; required?: string[] };
};

export type LlamadaFuncion = { id: string; name: string; args: Record<string, unknown> };

export type OpcionesLive = {
  clave: string;
  modelo?: string;
  voz?: string | null;
  instrucciones: string;
  herramientas?: DeclaracionFuncion[];
  /** Otra dirección (pruebas con un servidor de mentira). */
  url?: string;
  /** Para pruebas: otro WebSocket. */
  WebSocketImpl?: typeof WebSocket;
  /** Para seguir la misma conversación en una conexión nueva (la manija que dio la anterior). */
  reanudar?: string | null;
};

export type EventosLive = {
  onListo?: () => void;
  /** Voz del modelo: PCM de 16 bits, 24 kHz, mono. */
  onAudio?: (pcm: Int16Array) => void;
  /** Lo que el modelo va diciendo, en texto (subtítulos). */
  onTextoModelo?: (trozo: string) => void;
  /** Lo que el modelo entendió de la persona. */
  onTextoUsuario?: (trozo: string) => void;
  onTurnoCompleto?: () => void;
  /** La persona habló encima: se corta la voz que estaba sonando. */
  onInterrumpido?: () => void;
  onHerramientas?: (llamadas: LlamadaFuncion[]) => void;
  onCancelarHerramientas?: (ids: string[]) => void;
  /** El servidor avisa que va a cerrar la conexión pronto. */
  onAdios?: (restanteMs: number | null) => void;
  onError?: (mensaje: string) => void;
  /** Se cerró sin pedirlo. `recuperable`: vale la pena reanudar (no es la clave, el cupo ni el modelo). */
  onCerrada?: (motivo: string, codigo: number, recuperable: boolean) => void;
};

/** Convierte bytes a base64 por trozos (btoa con textos largos se ahoga). */
export function aBase64(bytes: Uint8Array): string {
  let s = "";
  const N = 0x8000;
  for (let i = 0; i < bytes.length; i += N) s += String.fromCharCode(...bytes.subarray(i, i + N));
  return btoa(s);
}

export function deBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** PCM de 16 bits little-endian a Int16Array (copia alineada). */
export function pcmDeBytes(bytes: Uint8Array): Int16Array {
  const n = Math.floor(bytes.length / 2);
  const out = new Int16Array(n);
  const v = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  for (let i = 0; i < n; i++) out[i] = v.getInt16(i * 2, true);
  return out;
}

export function bytesDePcm(pcm: Int16Array): Uint8Array {
  const out = new Uint8Array(pcm.length * 2);
  const v = new DataView(out.buffer);
  for (let i = 0; i < pcm.length; i++) v.setInt16(i * 2, pcm[i], true);
  return out;
}

/** El mensaje de configuración que abre la sesión. */
export function mensajeSetup(o: OpcionesLive): Record<string, unknown> {
  const modelo = o.modelo || MODELO_IA_DEFECTO;
  return {
    setup: {
      model: modelo.startsWith("models/") ? modelo : `models/${modelo}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        ...(o.voz ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: o.voz } } } } : {}),
      },
      systemInstruction: { parts: [{ text: o.instrucciones }] },
      ...(o.herramientas?.length ? { tools: [{ functionDeclarations: o.herramientas }] } : {}),
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Conversaciones largas (un pitch entero): el modelo resume lo viejo en vez de cortar la sesión
      contextWindowCompression: { slidingWindow: {} },
      // Cada conexión dura unos 10 minutos: con la manija se sigue la misma conversación en otra
      sessionResumption: o.reanudar ? { handle: o.reanudar } : {},
    },
  };
}

const CLAVE_MALA = /api key|API_KEY|permission|unauthori[sz]ed|PERMISSION_DENIED|invalid.*key/i;
const SIN_CUPO = /quota|RESOURCE_EXHAUSTED|rate/i;
const SIN_MODELO = /not found|NOT_FOUND|model/i;

/** Explica en español por qué se cerró la conexión. */
export function motivoCierre(codigo: number, motivo: string): string {
  const m = motivo || "";
  if (CLAVE_MALA.test(m)) return "La clave de Google AI Studio no es válida o no tiene permiso para este modelo.";
  if (SIN_CUPO.test(m)) return "Se acabó el cupo gratuito de hoy (o de este minuto). Vuelva a intentar más tarde.";
  if (SIN_MODELO.test(m) && codigo !== 1000) return `El modelo no está disponible para esta clave (${m.slice(0, 120)}).`;
  if (codigo === 1006) return "No se pudo conectar con Google (sin internet o la red lo bloquea).";
  if (codigo === 1000) return "La conversación terminó.";
  return m ? `Se cerró la conexión: ${m.slice(0, 160)}` : `Se cerró la conexión (código ${codigo}).`;
}

/** ¿Sirve reanudar la conversación en otra conexión? No, si el problema es la clave, el cupo o el modelo. */
export function cierreRecuperable(codigo: number, motivo: string): boolean {
  const m = motivo || "";
  if (CLAVE_MALA.test(m) || SIN_CUPO.test(m) || (SIN_MODELO.test(m) && codigo !== 1000)) return false;
  // 1008: política (clave o permiso); 1003/1007: lo que se mandó no sirve (reintentar daría lo mismo)
  return codigo !== 1008 && codigo !== 1003 && codigo !== 1007;
}

/**
 * Una sesión de voz en vivo. `conectar` abre el WebSocket, manda la configuración y espera `setupComplete`.
 * Después: `enviarAudio` (trozos de ~100 ms), `enviarTexto`, `responder` (a las herramientas) y `cerrar`.
 */
export class SesionLive {
  private ws: WebSocket | null = null;
  private abierta = false;
  private cerrando = false;
  /** Textos que llegaron antes de que la conexión estuviera lista (se mandan al abrir). */
  private cola: Record<string, unknown>[] = [];
  private ultimaManija: string | null = null;

  constructor(
    private readonly o: OpcionesLive,
    private readonly ev: EventosLive = {},
  ) {}

  get lista() {
    return this.abierta;
  }

  /** La manija para reanudar esta conversación en otra conexión (la última que el servidor dio por buena). */
  get manija(): string | null {
    return this.ultimaManija ?? this.o.reanudar ?? null;
  }

  conectar(limiteMs = 15000): Promise<void> {
    const WS = this.o.WebSocketImpl ?? WebSocket;
    const url = `${this.o.url ?? URL_LIVE}?key=${encodeURIComponent(this.o.clave)}`;
    return new Promise((ok, mal) => {
      let resuelta = false;
      const fallar = (m: string) => {
        if (resuelta) return;
        resuelta = true;
        mal(new Error(m));
      };
      const t = setTimeout(() => {
        fallar("Google no respondió a tiempo. Revise el internet e intente de nuevo.");
        this.cerrar();
      }, limiteMs);
      let ws: WebSocket;
      try {
        ws = new WS(url);
      } catch (e) {
        clearTimeout(t);
        fallar(e instanceof Error ? e.message : String(e));
        return;
      }
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify(mensajeSetup(this.o)));
      ws.onerror = () => {
        // El motivo llega en onclose
      };
      ws.onclose = (e) => {
        clearTimeout(t);
        const antes = this.abierta;
        this.abierta = false;
        const texto = motivoCierre(e.code, e.reason);
        if (!resuelta) fallar(texto);
        else if (!this.cerrando && antes) this.ev.onCerrada?.(texto, e.code, cierreRecuperable(e.code, e.reason));
      };
      ws.onmessage = async (e) => {
        let datos: string;
        if (typeof e.data === "string") datos = e.data;
        else if (e.data instanceof ArrayBuffer) datos = new TextDecoder().decode(e.data);
        else if (typeof Blob !== "undefined" && e.data instanceof Blob) datos = await e.data.text();
        else return;
        let m: Record<string, unknown>;
        try {
          m = JSON.parse(datos);
        } catch {
          return;
        }
        if ("setupComplete" in m) {
          clearTimeout(t);
          this.abierta = true;
          const pendientes = this.cola;
          this.cola = [];
          for (const x of pendientes) this.enviar(x);
          if (!resuelta) {
            resuelta = true;
            ok();
          }
          this.ev.onListo?.();
          return;
        }
        this.procesar(m);
      };
    });
  }

  private procesar(m: Record<string, unknown>) {
    const sc = m.serverContent as
      | {
          modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string }; text?: string }[] };
          turnComplete?: boolean;
          interrupted?: boolean;
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
        }
      | undefined;
    if (sc) {
      if (sc.interrupted) this.ev.onInterrumpido?.();
      for (const p of sc.modelTurn?.parts ?? []) {
        if (p.inlineData?.data && /audio/.test(p.inlineData.mimeType ?? "audio/pcm")) this.ev.onAudio?.(pcmDeBytes(deBase64(p.inlineData.data)));
      }
      if (sc.inputTranscription?.text) this.ev.onTextoUsuario?.(sc.inputTranscription.text);
      if (sc.outputTranscription?.text) this.ev.onTextoModelo?.(sc.outputTranscription.text);
      if (sc.turnComplete) this.ev.onTurnoCompleto?.();
    }
    const tc = m.toolCall as { functionCalls?: { id?: string; name: string; args?: Record<string, unknown> }[] } | undefined;
    if (tc?.functionCalls?.length) this.ev.onHerramientas?.(tc.functionCalls.map((f, i) => ({ id: f.id ?? `f${i}`, name: f.name, args: f.args ?? {} })));
    const cancel = m.toolCallCancellation as { ids?: string[] } | undefined;
    if (cancel?.ids?.length) this.ev.onCancelarHerramientas?.(cancel.ids);
    const adios = m.goAway as { timeLeft?: string } | undefined;
    if (adios) {
      const s = adios.timeLeft ? parseFloat(adios.timeLeft) : NaN;
      this.ev.onAdios?.(Number.isFinite(s) ? s * 1000 : null);
    }
    const reanudar = m.sessionResumptionUpdate as { newHandle?: string; resumable?: boolean } | undefined;
    if (reanudar?.resumable && reanudar.newHandle) this.ultimaManija = reanudar.newHandle;
    const error = m.error as { message?: string } | undefined;
    if (error?.message) this.ev.onError?.(error.message);
  }

  /** Manda un mensaje; con `guardar`, si la conexión todavía se está abriendo, lo manda apenas abra. */
  private enviar(m: Record<string, unknown>, guardar = false) {
    if (this.ws && this.abierta && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
    else if (guardar && !this.cerrando && this.cola.length < 20) this.cola.push(m);
  }

  /** Audio del micrófono: PCM de 16 bits, 16 kHz, mono. */
  enviarAudio(pcm: Int16Array) {
    if (!pcm.length) return;
    this.enviar({ realtimeInput: { audio: { data: aBase64(bytesDePcm(pcm)), mimeType: "audio/pcm;rate=16000" } } });
  }

  /** La persona dejó de hablar por un rato (pausa del micrófono): el modelo cierra lo que oyó. */
  finAudio() {
    this.enviar({ realtimeInput: { audioStreamEnd: true } });
  }

  /** Texto como si la persona lo dijera (el pedido que vino con «Hey Melki…» o un capítulo del pitch para narrar). */
  enviarTexto(texto: string) {
    if (!texto.trim()) return;
    this.enviar({ realtimeInput: { text: texto } }, true);
  }

  /** Respuesta a las herramientas que pidió el modelo. */
  responder(respuestas: { id: string; name: string; response: Record<string, unknown> }[]) {
    this.enviar({ toolResponse: { functionResponses: respuestas } }, true);
  }

  cerrar() {
    this.cerrando = true;
    this.abierta = false;
    this.cola = [];
    try {
      this.ws?.close(1000, "fin");
    } catch {
      // Ya estaba cerrada
    }
    this.ws = null;
  }
}
