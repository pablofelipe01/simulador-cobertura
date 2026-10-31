// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Los rasgos del Modelo Melki: cómo se convierte una frase en los números que mira la red neuronal. Los usan igual el
// entrenamiento (scripts/modelo-melki) y el navegador, así el modelo ve en el simulador exactamente lo que vio al
// aprender. La frase se normaliza (minúsculas, sin tildes, los números en palabras pasan a cifras y toda cifra vale
// lo mismo) y se parte en palabras, pares de palabras y pedazos de 3 a 5 letras de cada palabra; cada rasgo cae en una
// de las casillas de la tabla por su huella (FNV-1a), sin guardar un diccionario.
import { medidasEnCifras } from "../medidas";
import { numerosEnPalabras } from "../numeros";

/** Casillas de la tabla de rasgos (2^17). */
export const CASILLAS = 131072;

/** El nombre de Melki y las muletillas del dictado no dicen qué se pide. */
const NOMBRE = /\b(melki|melky|melqui|melquy|mel ki|melkí|melkis|melkin|merki|melk)\b/g;

/**
 * Los municipios y departamentos dichos se vuelven «zlugar»: al modelo le importa que se nombró un lugar, no cuál
 * (así entiende «llévame a Cabuyaro» aunque no haya visto Cabuyaro al aprender). `lugares` trae los nombres ya
 * normalizados (sin los que también son palabras comunes, como «toca» o «la plata»).
 */
export function marcarLugares(normalizada: string, lugares: Set<string>, maxPalabras = 6): string {
  const p = normalizada.split(" ");
  const out: string[] = [];
  for (let i = 0; i < p.length; ) {
    let k = Math.min(maxPalabras, p.length - i);
    for (; k >= 1; k--) if (lugares.has(p.slice(i, i + k).join(" "))) break;
    if (k >= 1) {
      out.push("zlugar");
      i += k;
    } else out.push(p[i++]);
  }
  return out.join(" ");
}

/** La frase lista para el modelo: «Oye Melki, ¿me armas una red de tres millas?» → «oye me armas una red de 0 millas». */
export function normalizarFrase(texto: string, lugares?: Set<string> | null): string {
  let t = texto;
  try {
    t = numerosEnPalabras(medidasEnCifras(texto));
  } catch {
    // Si algo raro no se deja convertir, se sigue con la frase tal cual
  }
  t = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(NOMBRE, " ")
    // «80 millones» llega como «80000000» y «95 por ciento» como «95 por 100»: se conserva que era plata o un porcentaje
    .replace(/\b\d{7,}\b|\b\d{1,3}(?:\.\d{3}){2,}\b/g, " 0 millones ")
    .replace(/(\d)\s*por 100\b/g, "$1 %")
    .replace(/\d+(?:[.,]\d+)*/g, " 0 ")
    .replace(/[^a-z0-9%²]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return lugares?.size ? marcarLugares(t, lugares) : t;
}

/** Huella FNV-1a de 32 bits (igual en el entrenamiento y aquí). */
export function huella(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Los rasgos de una frase ya normalizada, como casillas de la tabla (con repeticiones: pesan más). */
export function rasgos(normalizada: string, casillas = CASILLAS): number[] {
  const palabras = normalizada.split(" ").filter(Boolean);
  const salida: number[] = [];
  const poner = (r: string) => salida.push(huella(r) % casillas);
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i];
    poner(`u ${p}`);
    if (i + 1 < palabras.length) poner(`b ${p} ${palabras[i + 1]}`);
    // Pedazos de letras: aguantan errores de tecleo y de dictado («repetdor», «sevilla» por «cevilla»)
    if (p.length >= 3 && p !== "0") {
      const w = `<${p}>`;
      for (let n = 3; n <= 5; n++) for (let k = 0; k + n <= w.length; k++) poner(`c ${w.slice(k, k + n)}`);
    }
  }
  if (!salida.length) poner("u <vacio>");
  return salida;
}
