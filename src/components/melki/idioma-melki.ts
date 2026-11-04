// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Melki y el idioma: si le escriben o le hablan en el otro idioma, cambia todo el simulador a ese idioma (si el cambio
// automático está encendido) y lo avisa con un botón para volver; «speak English» o «habla en español» lo cambian
// siempre. Los nombres de los nodos y de los lugares no cuentan para decidir («go to Barranca de Upía» es inglés).
import { cambioAutomatico, idioma, idiomaProbable, pedidoDeIdioma, type Idioma } from "@/lib/idioma";

/** Palabras que unen un nombre de lugar («Barranca de Upía», «San José del Guaviare», «La Primavera»). */
const UNION = String.raw`(?:de|del|la|las|los|el|y|de la|de los|de las)`;
/** Una palabra con mayúscula (un nombre propio), con letras del español. */
const PROPIA = String.raw`[A-ZÁÉÍÓÚÑ][\p{L}'-]*`;
const NOMBRE_COMPUESTO = new RegExp(String.raw`${PROPIA}(?:\s+(?:${UNION}\s+)?${PROPIA})+`, "gu");

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Quita lo que no cuenta para saber el idioma: los nombres de los nodos del mapa, las coordenadas y los nombres propios
 * compuestos (un municipio como «Barranca de Upía»). La primera palabra de la frase se queda (es el verbo o la pregunta).
 */
export function sinNombres(texto: string, nombres: string[] = []): string {
  let t = ` ${texto} `;
  for (const n of [...nombres].filter((x) => x && x.length >= 2).sort((a, b) => b.length - a.length)) t = t.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escapar(n)}(?=$|[^\\p{L}\\p{N}])`, "giu"), "$1 ");
  t = t.replace(/-?\d+(?:[.,]\d+)?/g, " ");
  // Los nombres compuestos, menos su primera palabra si es la que empieza la frase
  t = t.replace(NOMBRE_COMPUESTO, (m, i: number) => (t.slice(0, i).trim() === "" ? m.split(/\s+/)[0] : " "));
  return t.replace(/\s+/g, " ").trim();
}

export type CambioIdioma = { idioma: Idioma; pedido: boolean };

/**
 * ¿Este mensaje cambia el idioma? Un pedido («speak English», «en español por favor») siempre; si no, con el cambio
 * automático encendido, cuando está en el otro idioma: por la ventaja de sus palabras o, en una orden corta, por el verbo
 * con que empieza (v17.3: «Simulate», «optimize it», «carga el ejemplo»). Las palabras que se usan en los dos idiomas
 * («ok», «hello», «gateway», «LoRa», «zoom») no cambian nada.
 */
export function cambioDeIdioma(texto: string, nombres: string[] = []): CambioIdioma | null {
  const pedido = pedidoDeIdioma(texto);
  if (pedido) return pedido === idioma() ? null : { idioma: pedido, pedido: true };
  if (!cambioAutomatico()) return null;
  const d = idiomaProbable(sinNombres(texto, nombres));
  if (!d || d === idioma()) return null;
  return { idioma: d, pedido: false };
}

/** ¿El mensaje no trae nada más que el pedido de cambiar de idioma? (entonces no hay nada más que hacer con él) */
export const soloPideIdioma = (texto: string): boolean => pedidoDeIdioma(texto) !== null;

/** Lo que Melki escribe al cambiar de idioma (ya en el idioma nuevo) y el botón para volver al anterior. */
export function avisoCambio(nuevo: Idioma, pedido: boolean, trato: "senor" | "senora" | "ninguno", porVoz = false): { texto: string; volver: string } {
  if (nuevo === "en") {
    const s = trato === "senor" ? ", sir" : trato === "senora" ? ", ma'am" : "";
    return {
      texto: pedido ? `Of course${s}. From now on the simulator and I are in English.` : `I noticed you're ${porVoz ? "speaking" : "writing"} in English${s}, so I've switched the simulator to English.`,
      volver: "Volver al español",
    };
  }
  const s = trato === "senor" ? ", señor" : trato === "senora" ? ", señora" : "";
  return {
    texto: pedido ? `Con gusto${s}. Desde ahora el simulador y yo estamos en español.` : `Noté que me ${porVoz ? "habla" : "escribe"} en español${s}, así que pasé el simulador al español.`,
    volver: "Switch back to English",
  };
}
