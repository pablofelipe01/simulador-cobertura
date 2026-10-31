// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Cómo dice Melki las cosas en voz alta: como las diría una persona (un mayordomo atento, al estilo de JARVIS), no
// como se leen en pantalla. Lo escrito queda completo en la conversación; en voz dice lo esencial, con las cifras
// redondeadas («45,1 %» → «45 %», «10,00 km» → «10 km», «$150.000.000» → «150 millones de pesos»), sin los
// paréntesis técnicos ni las coordenadas («en ese punto»), y empieza variando como lo haría alguien de verdad («Hecho,
// señor.», «Muy bien, señor.») en vez de repetir siempre «Listo:».
import { textoParaVoz, type Trato } from "./manos-libres";

export type OpcionesHabla = {
  /** Cómo trata a la persona (de fábrica, «señor»). */
  trato?: Trato;
  /** Leer la respuesta completa (si no, lo esencial: hasta tres frases). */
  completo?: boolean;
  /** Para variar el comienzo (si no se da, varía solo). */
  vez?: number;
};

/** Cómo empieza una confirmación (en vez de «Listo:» siempre). */
const APERTURAS = ["Hecho", "Muy bien", "Listo", "Ya está"];
let vecesDicho = 0;

const quitarCeros = (t: string) => t.replace(/,0+$/, "").replace(/(,\d*?)0+$/, "$1");

/**
 * Las cifras como las diría una persona: los decimales que no hacen falta se redondean (de 10 en adelante, sin
 * decimales; por debajo, con uno), salvo los porcentajes casi completos («99,9 %» se dice así).
 */
export function suavizarCifras(texto: string): string {
  return texto.replace(/(\d+),(\d+)(\s?%)?/g, (todo, entero: string, dec: string, pct: string | undefined, i: number, s: string) => {
    // «4,35, -72,9» u horas como «12,30 h» no se tocan si vienen pegadas a otra cifra
    if (s[i - 1] === "." || /^\d/.test(s.slice(i + todo.length, i + todo.length + 1))) return todo;
    const v = Number(`${entero}.${dec}`);
    if (!Number.isFinite(v)) return todo;
    if (pct && v >= 99 && v < 100) return `${quitarCeros(v.toFixed(1).replace(".", ","))}${pct}`;
    if (v >= 10) return `${Math.round(v)}${pct ?? ""}`;
    return `${quitarCeros(v.toFixed(1).replace(".", ","))}${pct ?? ""}`;
  });
}

/** «$150.000.000» → «150 millones de pesos»; «$1.250.000» → «1,3 millones de pesos»; «$350.000» → «350 mil pesos». */
export function plataHablada(texto: string): string {
  return texto.replace(/\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?![\d.,]*\d)/g, (_todo, cifra: string) => {
    const v = Number(cifra.replace(/\./g, ""));
    if (!Number.isFinite(v)) return cifra;
    if (v >= 1e6) {
      const m = v / 1e6;
      const dicho = m >= 10 ? String(Math.round(m)) : quitarCeros(m.toFixed(1).replace(".", ","));
      return `${dicho} ${dicho === "1" ? "millón" : "millones"} de pesos`;
    }
    if (v >= 1000) return `${Math.round(v / 1000)} mil pesos`;
    return `${v} pesos`;
  });
}

/** Las coordenadas no se leen en voz alta: «en 4.35, -72.9» → «en ese punto». */
export function sinCoordenadas(texto: string): string {
  return texto
    .replace(/\b(en|a|de|desde|hasta|hacia|cerca de)\s+\(?-?\d{1,2}\.\d{1,7}\s*,\s*-?\d{1,3}\.\d{1,7}\)?/gi, "$1 ese punto")
    .replace(/\(?-?\d{1,2}\.\d{1,7}\s*,\s*-?\d{1,3}\.\d{1,7}\)?/g, "ese punto");
}

/**
 * Los paréntesis no se leen: lo técnico de adentro se calla («(≥ 30 dB)», «(Persona 1 → Gateway)») y un nombre propio
 * se dice como aposición («Barranca de Upía (Meta)» → «Barranca de Upía, Meta»).
 */
export function sinParentesis(texto: string): string {
  return texto.replace(/\s*\(([^()]{1,140})\)/g, (_todo, dentro: string) => (/^[A-ZÁÉÍÓÚÑ][\p{L} ]{1,30}$/u.test(dentro.trim()) ? `, ${dentro.trim()}` : ""));
}

/** «Listo: puse el repetidor…» → «Hecho, señor. Puse el repetidor…» (variando cómo empieza). */
function apertura(texto: string, trato: Trato, vez: number): string {
  const m = texto.match(/^Listo[:,.]\s*/);
  if (!m) return texto;
  const resto = texto.slice(m[0].length);
  if (!resto) return texto;
  const s = trato === "senor" ? "señor" : trato === "senora" ? "señora" : "";
  // Si la frase ya trata a la persona, no se repite
  const conTrato = s && !/\b(señor|señora)\b/i.test(resto.split(/[.!?]/)[0] ?? "");
  const inicio = APERTURAS[vez % APERTURAS.length];
  return `${inicio}${conTrato ? `, ${s}` : ""}. ${resto.charAt(0).toUpperCase()}${resto.slice(1)}`;
}

/**
 * Lo que Melki dice en voz alta de una respuesta escrita: lo esencial (o completo, si así se pidió en Ajustes), dicho
 * como lo diría una persona. El texto escrito no cambia.
 */
export function hablaNatural(texto: string, o: OpcionesHabla = {}): string {
  const vez = o.vez ?? vecesDicho++;
  const base = textoParaVoz(texto, o.completo ?? false);
  let t = sinCoordenadas(base);
  if (!o.completo) t = sinParentesis(t);
  t = plataHablada(suavizarCifras(t));
  // «el repetidor «Repetidor 4»» se dice «el Repetidor 4»
  t = t.replace(/\b(el|la|al|del) (repetidor|gateway|persona|antena|nodo) «([^»]+)»/gi, (todo, art: string, tipo: string, nombre: string) =>
    nombre.toLowerCase().startsWith(tipo.toLowerCase()) ? `${art} ${nombre}` : todo,
  );
  t = apertura(t, o.trato ?? "senor", vez);
  return t
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/([,;:])\s*\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}
