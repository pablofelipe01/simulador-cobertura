// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Voz de Melki con la síntesis de voz del navegador (sin servicios externos). Elige sola la voz más natural en
// español que tenga el equipo (las neuronales «Natural» de Edge, como Salomé de Colombia o Dalia de México, o las de
// Google) y habla un poco más pausado, para que no suene robótica. En Ajustes de voz se puede escoger otra.

export function vozDisponible(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Nombres de voces femeninas en español, de tono suave (Edge, Windows, Chrome, macOS, Android). */
const SUAVES = /\b(salom[eé]|dalia|paloma|elvira|ximena|camila|larissa|beatriz|valentina|renata|catalina|marina|lupe|paulina|m[oó]nica|helena|laura|sabina|luc[ií]a|elena|soledad|vera|sof[ií]a|isabela|abril|irene|triana|estrella)\b/i;

/** Qué tan bien suena una voz (más es mejor); las voces en otro idioma no cuentan. */
export function puntajeVoz(v: { name: string; lang: string; localService?: boolean }): number {
  const lang = v.lang.replace("_", "-").toLowerCase();
  if (!lang.startsWith("es")) return -1;
  let p = 10;
  if (/natural|neural|online|premium|enhanced|mejorada/i.test(v.name)) p += 60;
  else if (/google/i.test(v.name)) p += 35;
  if (/espeak|robot|compact/i.test(v.name)) p -= 50;
  if (SUAVES.test(v.name)) p += 12;
  p += lang === "es-co" ? 16 : lang === "es-419" || lang === "es-mx" || lang === "es-us" ? 11 : lang === "es-es" ? 6 : 3;
  return p;
}

let preferida: string | null = null;
/** Voz escogida en Ajustes (por nombre); `null` vuelve a la elección automática. */
export function fijarVozPreferida(nombre: string | null) {
  preferida = nombre;
}

/** Voces en español que tiene el equipo, de la que mejor suena a la que peor. */
export function vocesEspanol(): SpeechSynthesisVoice[] {
  if (!vozDisponible()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => puntajeVoz(v) >= 0)
    .sort((a, b) => puntajeVoz(b) - puntajeVoz(a));
}

function elegirVoz(): SpeechSynthesisVoice | undefined {
  const voces = vocesEspanol();
  return (preferida && voces.find((v) => v.name === preferida)) || voces[0];
}

/** Las voces del navegador llegan tarde la primera vez: avisa cuando estén. */
export function alCargarVoces(fn: () => void): () => void {
  if (!vozDisponible()) return () => {};
  const s = window.speechSynthesis;
  s.addEventListener?.("voiceschanged", fn);
  return () => s.removeEventListener?.("voiceschanged", fn);
}

/** El texto como se debe oír: unidades en palabras y sin los símbolos que la voz deletrea. */
export function paraHablar(texto: string): string {
  return texto
    .replace(/[«»"]/g, "")
    .replace(/(\d),(\d)/g, "$1 coma $2")
    .replace(/(\d)\.(?=\d{3}\b)/g, "$1")
    .replace(/(\d)\.(\d)/g, "$1 punto $2")
    .replace(/[≈~]\s?/g, "unos ")
    .replace(/(\d)\s?%/g, "$1 por ciento")
    .replace(/(\d)\s?°/g, "$1 grados")
    .replace(/×\s?(\d)/g, "por $1")
    .replace(/\bdBm\b/g, "d B m")
    .replace(/\bdBi\b/g, "d B i")
    .replace(/\bdB\b/g, "decibeles")
    .replace(/km²/g, "kilómetros cuadrados")
    .replace(/\bkm\b/g, "kilómetros")
    .replace(/(\d) m\b/g, "$1 metros")
    .replace(/(\d) s\b/g, "$1 segundos")
    .replace(/(\d) min\b/g, "$1 minutos")
    .replace(/(\d) ha\b/g, "$1 hectáreas")
    .replace(/(\d) B\b/g, "$1 bytes")
    .replace(/\bWh\b/g, "vatios hora")
    .replace(/\bkbps\b/g, "kilobits por segundo")
    .replace(/\bbps\b/g, "bits por segundo")
    .replace(/\bMHz\b/g, "megahercios")
    .replace(/\bkHz\b/g, "kilohercios")
    .replace(/\/h\b/g, " por hora")
    .replace(/\bSF ?(\d+)\b/g, "S F $1")
    .replace(/[→·•]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parte el texto en trozos cortos por frases (algunas voces se cortan solas con textos largos). */
function trozos(texto: string): string[] {
  const frases = texto.split(/(?<=[.!?;:])\s+/);
  const salida: string[] = [];
  let actual = "";
  for (const f of frases) {
    if (actual && actual.length + f.length > 200) {
      salida.push(actual);
      actual = f;
    } else actual = actual ? `${actual} ${f}` : f;
  }
  if (actual) salida.push(actual);
  return salida;
}

/**
 * Lee el texto en voz alta; devuelve una función para detenerlo. `alTerminar` se llama una sola vez. `alFallar` recibe
 * el error de la voz (por ejemplo «not-allowed»: el navegador no deja hablar hasta que la persona toque la página).
 */
export function hablar(texto: string, alTerminar?: () => void, alFallar?: (error: string) => void): () => void {
  if (!vozDisponible()) {
    alTerminar?.();
    return () => {};
  }
  const s = window.speechSynthesis;
  s.cancel();
  const limpio = paraHablar(texto);
  const partes = trozos(limpio);
  let terminado = false;
  let guardia = 0;
  const fin = () => {
    if (terminado) return;
    terminado = true;
    window.clearTimeout(guardia);
    alTerminar?.();
  };
  if (!partes.length) {
    fin();
    return () => {};
  }
  const voz = elegirVoz();
  // Las voces neuronales ya suenan naturales a su ritmo; las demás, un poco más pausadas y sin subir el tono
  const natural = voz ? puntajeVoz(voz) >= 70 : false;
  partes.forEach((p, k) => {
    const u = new SpeechSynthesisUtterance(p);
    if (voz) u.voice = voz;
    u.lang = voz?.lang ?? "es-CO";
    u.rate = natural ? 0.98 : 0.94;
    u.pitch = 1;
    u.volume = 1;
    if (k === partes.length - 1) u.onend = fin;
    u.onerror = (e) => {
      const error = (e as SpeechSynthesisErrorEvent).error;
      if (error && error !== "interrupted" && error !== "canceled") alFallar?.(error);
      fin();
    };
    s.speak(u);
  });
  // Si la voz no avisa que terminó (pasa en algunos navegadores), se da por terminada a su tiempo
  guardia = window.setTimeout(fin, 2500 + limpio.length * 85);
  return () => {
    s.cancel();
    fin();
  };
}

export function callar() {
  if (vozDisponible()) window.speechSynthesis.cancel();
}

/** ¿Hay alguna voz sonando (de Melki o de un tour)? */
export const sonando = () => vozDisponible() && window.speechSynthesis.speaking;
