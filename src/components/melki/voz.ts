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
    .replace(/[«»"■]/g, "")
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

/** Largo máximo de cada trozo: Chrome corta las voces en línea que hablan más de ~15 s seguidos. */
const MAX_TROZO = 150;

/** Junta piezas seguidas mientras quepan en un trozo. */
function juntar(piezas: string[], max: number): string[] {
  const salida: string[] = [];
  let actual = "";
  for (const p of piezas) {
    if (actual && actual.length + p.length + 1 > max) {
      salida.push(actual);
      actual = p;
    } else actual = actual ? `${actual} ${p}` : p;
  }
  if (actual) salida.push(actual);
  return salida;
}

/**
 * Parte el texto en trozos cortos (algunas voces se cortan solas con textos largos): por frases y, si una frase es
 * larga, por comas y, si hace falta, por palabras. Las frases cortas seguidas van juntas (menos pausas).
 */
export function trozosVoz(texto: string, max = MAX_TROZO): string[] {
  const piezas: string[] = [];
  for (const f of texto.split(/(?<=[.!?;:])\s+/).filter(Boolean)) {
    if (f.length <= max) {
      piezas.push(f);
      continue;
    }
    for (const c of f.split(/(?<=,)\s+/).filter(Boolean)) {
      if (c.length <= max) piezas.push(c);
      else piezas.push(...juntar(c.split(/\s+/), max));
    }
  }
  return juntar(piezas, max);
}

/** Las frases en curso: si el recolector de basura se las lleva, Chrome deja de avisar que terminaron. */
const vivas = new Set<SpeechSynthesisUtterance>();

/** Una voz en español del propio equipo (no en línea): para seguir si la voz en línea falla por la red. */
function vozDelEquipo(): SpeechSynthesisVoice | undefined {
  return vocesEspanol().find((v) => v.localService);
}

/**
 * Lo que está diciendo ahora: `callar()` lo da por terminado (quien esperaba el final, como la narración de la llegada
 * o del recorrido o la cola del asistente, sigue); si empieza otra voz, queda interrumpido (avisa un fallo
 * «interrupted» y ya no corta nada: detenerlo después no calla a la voz nueva).
 */
type Sesion = { fin: () => void; interrumpir: () => void };
const enCurso = new Set<Sesion>();

/**
 * Lee el texto en voz alta; devuelve una función para detenerlo. `alTerminar` se llama una sola vez (también si se la
 * calla con `callar()`). `alFallar` recibe el error de la voz (por ejemplo «not-allowed»: el navegador no deja hablar
 * hasta que la persona toque la página; o «interrupted»: empezó otra voz y esta ya no sigue).
 *
 * Dice un trozo a la vez (cada uno empieza cuando termina el anterior): así ninguno pasa de unos 10 s, si uno no avisa
 * que terminó se sigue con el siguiente a su tiempo y, si la voz en línea falla (la red), se repite ese trozo con una
 * voz del equipo en vez de quedarse a medias. `alTrozo` avisa cuándo empieza cada trozo (dónde empieza y cuánto mide,
 * en letras de lo que se dice), para escribir el texto a medida que Melki lo va diciendo.
 */
export function hablar(texto: string, alTerminar?: () => void, alFallar?: (error: string) => void, alTrozo?: (desde: number, largo: number, total: number) => void): () => void {
  if (!vozDisponible()) {
    alTerminar?.();
    return () => {};
  }
  const s = window.speechSynthesis;
  const ocupada = s.speaking || s.pending;
  // Lo que sonaba queda interrumpido por esta voz: se le avisa (sin darlo por terminado)
  const antes = [...enCurso];
  enCurso.clear();
  s.cancel();
  for (const x of antes) x.interrumpir();
  const partes = trozosVoz(paraHablar(texto));
  const total = partes.reduce((n, p) => n + p.length, 0);
  const inicios = partes.map((_, i) => partes.slice(0, i).reduce((n, p) => n + p.length, 0));
  let terminado = false;
  let k = 0;
  let guardia = 0;
  let espera = 0;
  let voz = elegirVoz();
  let cambioVoz = false;
  const cerrar = () => {
    terminado = true;
    enCurso.delete(sesion);
    window.clearTimeout(guardia);
    window.clearTimeout(espera);
  };
  const fin = () => {
    if (terminado) return;
    cerrar();
    alTerminar?.();
  };
  const sesion: Sesion = {
    fin,
    interrumpir: () => {
      if (terminado) return;
      cerrar();
      alFallar?.("interrupted");
    },
  };
  if (!partes.length) {
    fin();
    return () => {};
  }
  enCurso.add(sesion);
  const decirTrozo = () => {
    if (terminado) return;
    if (k >= partes.length) return fin();
    const trozo = partes[k];
    const u = new SpeechSynthesisUtterance(trozo);
    // Las voces neuronales ya suenan naturales a su ritmo; las demás, un poco más pausadas y sin subir el tono
    const natural = voz ? puntajeVoz(voz) >= 70 : false;
    if (voz) u.voice = voz;
    u.lang = voz?.lang ?? "es-CO";
    u.rate = natural ? 0.98 : 0.94;
    u.pitch = 1;
    u.volume = 1;
    let listo = false;
    const avanzar = () => {
      if (listo) return;
      listo = true;
      vivas.delete(u);
      window.clearTimeout(guardia);
      k++;
      decirTrozo();
    };
    u.onend = avanzar;
    u.onerror = (e) => {
      if (listo) return;
      listo = true;
      vivas.delete(u);
      window.clearTimeout(guardia);
      const error = (e as SpeechSynthesisErrorEvent).error;
      if (terminado || error === "interrupted" || error === "canceled") return;
      // La voz en línea falló (sin red o el servicio no respondió): este trozo y los que siguen, con una del equipo
      if (!cambioVoz && error !== "not-allowed" && voz && !voz.localService) {
        const otra = vozDelEquipo();
        if (otra) {
          cambioVoz = true;
          voz = otra;
          decirTrozo();
          return;
        }
      }
      if (error) alFallar?.(error);
      fin();
    };
    vivas.add(u);
    // Si el trozo no avisa que terminó (pasa en algunos navegadores), se sigue con el siguiente a su tiempo
    guardia = window.setTimeout(avanzar, 2500 + trozo.length * 95);
    // Cuándo empieza a sonar este trozo (al pedirlo y, si la voz lo avisa, al sonar de verdad)
    const i = k;
    if (alTrozo) u.onstart = () => alTrozo(inicios[i], trozo.length, total);
    alTrozo?.(inicios[i], trozo.length, total);
    s.speak(u);
  };
  // Justo después de cancelar otra voz, Chrome a veces se salta lo siguiente: se espera un instante
  if (ocupada) espera = window.setTimeout(decirTrozo, 120);
  else decirTrozo();
  return () => {
    if (terminado) return;
    s.cancel();
    fin();
  };
}

/** Calla a Melki ya. Lo que estaba diciendo se da por terminado: quien esperaba el final (el recorrido, la llegada) sigue. */
export function callar() {
  if (!vozDisponible()) return;
  const sonaban = [...enCurso];
  enCurso.clear();
  window.speechSynthesis.cancel();
  for (const x of sonaban) x.fin();
}

/** ¿Hay alguna voz sonando (de Melki o de un tour)? */
export const sonando = () => vozDisponible() && window.speechSynthesis.speaking;
