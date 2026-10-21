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

/** Lee el texto en voz alta; devuelve una función para detenerlo. */
export function hablar(texto: string, alTerminar?: () => void): () => void {
  if (!vozDisponible()) {
    alTerminar?.();
    return () => {};
  }
  const s = window.speechSynthesis;
  s.cancel();
  // Leer «dB» como «decibeles» y quitar símbolos que la voz deletrea
  const limpio = texto
    .replace(/(\d),(\d)/g, "$1 coma $2")
    .replace(/\bdBm\b/g, "dBm")
    .replace(/\bdBi\b/g, "d B i")
    .replace(/\bdB\b/g, "decibeles")
    .replace(/km²/g, "kilómetros cuadrados")
    .replace(/\bkm\b/g, "kilómetros")
    .replace(/[→·]/g, ",");
  const u = new SpeechSynthesisUtterance(limpio);
  const voz = elegirVoz();
  if (voz) u.voice = voz;
  u.lang = voz?.lang ?? "es-CO";
  u.rate = 1.02;
  u.pitch = 1.08;
  u.onend = () => alTerminar?.();
  u.onerror = () => alTerminar?.();
  s.speak(u);
  return () => s.cancel();
}

export function callar() {
  if (vozDisponible()) window.speechSynthesis.cancel();
}
