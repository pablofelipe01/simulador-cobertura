// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El audio de la conversación con la IA: el micrófono a PCM de 16 bits y 16 kHz en trozos de 100 ms (con cancelación
// de eco, supresión de ruido y control de ganancia del navegador), y la voz del modelo (PCM a 24 kHz) en cola, sin
// cortes entre trozos (con un colchón al empezar, por si la red trae los trozos a saltos), con la posibilidad de
// callarla de golpe cuando la persona habla encima. Si el micrófono se desconecta o el navegador pausa el audio (la
// pestaña en segundo plano, el celular), se avisa o se reanuda solo.

const TASA_ENTRADA = 16000;
const TROZO = 1600; // 100 ms a 16 kHz

/** Baja el audio a 16 kHz promediando (sirve de filtro contra el aliasing) y lo pasa a enteros de 16 bits. */
export function aPcm16k(entrada: Float32Array, tasa: number, resto: { fase: number }): Int16Array {
  const paso = tasa / TASA_ENTRADA;
  const n = Math.floor((entrada.length - resto.fase) / paso);
  const out = new Int16Array(Math.max(0, n));
  let pos = resto.fase;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(pos);
    const b = Math.min(entrada.length, Math.floor(pos + paso));
    let s = 0;
    for (let k = a; k < b; k++) s += entrada[k];
    const v = b > a ? s / (b - a) : entrada[a] ?? 0;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
    pos += paso;
  }
  resto.fase = pos - entrada.length;
  if (resto.fase < 0) resto.fase = 0;
  return out;
}

export type MicrofonoIA = {
  cerrar(): void;
  /** Silencia el envío (sin soltar el micrófono): mientras el modelo habla por parlantes, si se quiere. */
  pausar(v: boolean): void;
};

/** Reanuda un contexto de audio pausado (la pestaña volvió, o el primer toque de la persona). */
function reanudarAlVolver(ctx: AudioContext): () => void {
  const reanudar = () => {
    if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") void ctx.resume().catch(() => {});
  };
  const alVer = () => document.visibilityState === "visible" && reanudar();
  document.addEventListener("visibilitychange", alVer);
  window.addEventListener("pointerdown", reanudar);
  window.addEventListener("keydown", reanudar);
  ctx.onstatechange = () => document.visibilityState === "visible" && reanudar();
  return () => {
    document.removeEventListener("visibilitychange", alVer);
    window.removeEventListener("pointerdown", reanudar);
    window.removeEventListener("keydown", reanudar);
    ctx.onstatechange = null;
  };
}

/** Código del procesador de audio (va en un Blob: así funciona también desde el archivo HTML, sin servidor). */
const CODIGO_WORKLET = `
class MelkiCaptura extends AudioWorkletProcessor {
  process(inputs) {
    const canal = inputs[0] && inputs[0][0];
    if (canal) this.port.postMessage(canal.slice(0));
    return true;
  }
}
registerProcessor("melki-captura", MelkiCaptura);
`;

/**
 * Abre el micrófono y entrega trozos de 100 ms en PCM de 16 kHz. `onNivel` recibe el volumen (0 a 1) para las
 * barritas; `onFin`, si el micrófono se desconecta (para volver a abrirlo). Lanza un error con un texto claro si no hay
 * permiso.
 */
export async function abrirMicrofonoIA(onPcm: (pcm: Int16Array) => void, onNivel?: (nivel: number) => void, onFin?: () => void): Promise<MicrofonoIA> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no deja usar el micrófono.");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    const n = (e as DOMException)?.name;
    throw new Error(n === "NotAllowedError" ? "El navegador no tiene permiso para usar el micrófono." : n === "NotFoundError" ? "No encontré un micrófono en este equipo." : "No pude abrir el micrófono.");
  }
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const fuente = ctx.createMediaStreamSource(stream);
  const resto = { fase: 0 };
  let cola = new Int16Array(0);
  let pausado = false;
  const recibir = (f: Float32Array) => {
    if (onNivel) {
      let s = 0;
      for (let i = 0; i < f.length; i++) s += f[i] * f[i];
      onNivel(Math.min(1, Math.sqrt(s / Math.max(1, f.length)) * 6));
    }
    const pcm = aPcm16k(f, ctx.sampleRate, resto);
    const junto = new Int16Array(cola.length + pcm.length);
    junto.set(cola);
    junto.set(pcm, cola.length);
    let i = 0;
    while (junto.length - i >= TROZO) {
      if (!pausado) onPcm(junto.slice(i, i + TROZO));
      i += TROZO;
    }
    cola = junto.slice(i);
  };
  let nodo: AudioNode;
  let url: string | null = null;
  try {
    url = URL.createObjectURL(new Blob([CODIGO_WORKLET], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    const w = new AudioWorkletNode(ctx, "melki-captura");
    w.port.onmessage = (e) => recibir(e.data as Float32Array);
    nodo = w;
  } catch {
    // Navegadores sin AudioWorklet: el procesador viejo
    const p = ctx.createScriptProcessor(2048, 1, 1);
    p.onaudioprocess = (e) => recibir(e.inputBuffer.getChannelData(0));
    nodo = p;
  }
  // Un destino mudo para que el grafo corra
  const mudo = ctx.createGain();
  mudo.gain.value = 0;
  fuente.connect(nodo);
  nodo.connect(mudo);
  mudo.connect(ctx.destination);
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  const soltar = reanudarAlVolver(ctx);
  let cerrado = false;
  // El micrófono se desconectó (audífonos que se quitan, otra app que lo toma): se avisa para abrirlo de nuevo
  for (const t of stream.getAudioTracks()) t.onended = () => !cerrado && onFin?.();
  return {
    cerrar() {
      cerrado = true;
      soltar();
      try {
        fuente.disconnect();
        nodo.disconnect();
      } catch {
        // ya estaba
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
      if (url) URL.revokeObjectURL(url);
    },
    pausar(v: boolean) {
      pausado = v;
    },
  };
}

/** Colchón al empezar a sonar (o si la red se atrasó): absorbe los trozos que llegan a saltos. */
const COLCHON_INICIO_S = 0.22;
const COLCHON_CORTE_S = 0.12;

/** La voz del modelo: los trozos de PCM a 24 kHz suenan en orden, sin huecos; `callar` corta todo de una vez. */
export class ReproductorIA {
  private ctx: AudioContext | null = null;
  private siguiente = 0;
  private fuentes = new Set<AudioBufferSourceNode>();
  private analizador: AnalyserNode | null = null;
  private datos: Uint8Array<ArrayBuffer> | null = null;
  private alTerminar: (() => void) | null = null;
  private volumen = 1;
  private soltar: (() => void) | null = null;
  /** Cuándo terminó de sonar lo último (reloj de la página). */
  private finSonido = 0;

  constructor(private readonly tasa = 24000) {}

  private asegurar(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      // A la frecuencia del equipo (la más estable); los trozos a 24 kHz se convierten solos al sonar
      this.ctx = new Ctx();
      this.soltar = reanudarAlVolver(this.ctx);
      this.analizador = this.ctx.createAnalyser();
      this.analizador.fftSize = 256;
      this.datos = new Uint8Array(new ArrayBuffer(this.analizador.frequencyBinCount));
      this.analizador.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Despierta el audio con un toque de la persona (los navegadores lo piden). */
  preparar() {
    this.asegurar();
  }

  /** El navegador no deja sonar todavía (falta un toque de la persona en la página). */
  get bloqueado(): boolean {
    return this.ctx?.state === "suspended";
  }

  /** Cuánto hace que terminó de sonar (ms); 0 si está sonando. */
  silencioMs(): number {
    if (this.fuentes.size) return 0;
    return this.finSonido ? Date.now() - this.finSonido : Number.POSITIVE_INFINITY;
  }

  fijarVolumen(v: number) {
    this.volumen = v;
  }

  /** Avisa una vez cuando termina de sonar todo lo que hay en cola. */
  alVaciarse(fn: (() => void) | null) {
    this.alTerminar = fn;
  }

  encolar(pcm: Int16Array) {
    if (!pcm.length) return;
    const ctx = this.asegurar();
    const buf = ctx.createBuffer(1, pcm.length, this.tasa);
    const canal = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) canal[i] = (pcm[i] / 32768) * this.volumen;
    const f = ctx.createBufferSource();
    f.buffer = buf;
    f.connect(this.analizador!);
    const ahora = ctx.currentTime;
    // Al empezar (o si la red se atrasó y la cola se vació) se deja un colchón: así los trozos que llegan a saltos no
    // dejan huecos (la voz no suena entrecortada)
    const inicio = this.siguiente > ahora + 0.01 ? this.siguiente : ahora + (this.fuentes.size ? COLCHON_CORTE_S : COLCHON_INICIO_S);
    f.start(inicio);
    this.siguiente = inicio + buf.duration;
    this.fuentes.add(f);
    f.onended = () => {
      this.fuentes.delete(f);
      if (!this.fuentes.size) {
        this.finSonido = Date.now();
        if (this.alTerminar) {
          const fn = this.alTerminar;
          fn();
        }
      }
    };
  }

  /** Cuánto falta por sonar de lo que hay en cola (ms). */
  restanteMs(): number {
    if (!this.ctx || !this.fuentes.size) return 0;
    return Math.max(0, (this.siguiente - this.ctx.currentTime) * 1000);
  }

  /** ¿Está sonando (o tiene algo en cola)? */
  get sonando(): boolean {
    return this.fuentes.size > 0;
  }

  /** Volumen de lo que suena ahora (0 a 1), para las barritas. */
  nivel(): number {
    if (!this.analizador || !this.datos || !this.fuentes.size) return 0;
    this.analizador.getByteTimeDomainData(this.datos);
    let s = 0;
    for (let i = 0; i < this.datos.length; i++) {
      const v = (this.datos[i] - 128) / 128;
      s += v * v;
    }
    return Math.min(1, Math.sqrt(s / this.datos.length) * 4);
  }

  /** Corta la voz de inmediato (la persona habló encima). */
  callar() {
    const sonaba = this.fuentes.size > 0;
    for (const f of this.fuentes) {
      f.onended = null;
      try {
        f.stop();
      } catch {
        // ya paró
      }
    }
    this.fuentes.clear();
    this.siguiente = 0;
    if (sonaba) this.finSonido = Date.now();
  }

  cerrar() {
    this.callar();
    this.soltar?.();
    this.soltar = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
