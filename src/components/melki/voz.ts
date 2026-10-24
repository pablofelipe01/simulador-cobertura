// Voz de Melki con la síntesis de voz del navegador (sin servicios externos).

export function vozDisponible(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function elegirVoz(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices();
  const orden = ["es-CO", "es-419", "es-MX", "es-US", "es-ES"];
  for (const idioma of orden) {
    const v = voces.find((x) => x.lang.replace("_", "-").toLowerCase() === idioma.toLowerCase());
    if (v) return v;
  }
  return voces.find((x) => x.lang.toLowerCase().startsWith("es"));
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

/** Lee el texto en voz alta; devuelve una función para detenerlo. `alTerminar` se llama una sola vez. */
export function hablar(texto: string, alTerminar?: () => void): () => void {
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
  partes.forEach((p, k) => {
    const u = new SpeechSynthesisUtterance(p);
    if (voz) u.voice = voz;
    u.lang = voz?.lang ?? "es-CO";
    u.rate = 1.02;
    u.pitch = 1.08;
    if (k === partes.length - 1) u.onend = fin;
    u.onerror = fin;
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
