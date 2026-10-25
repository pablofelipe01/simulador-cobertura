// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Comparación fonética del español, para entender los nombres que el reconocimiento de voz escribe mal cuando se habla
// rápido («barranco vía» o «arranca de upyía» por «Barranca de Upía»). Primero se lleva cada texto a cómo suena (b y v
// iguales, s, z y c suaves iguales, ll y y iguales, h muda, qu = k…) y luego se cuenta cuánto hay que cambiar para pasar
// de uno al otro, con cambios baratos entre sonidos que se confunden (vocales entre sí, b/p, d/t, g/k, l/r, m/n).

const VOCALES = new Set(["a", "e", "i", "o", "u"]);
const esVocal = (c: string) => VOCALES.has(c);

/** Cómo suena el texto, en un alfabeto reducido y sin espacios («Barranca de Upía» → «barankadeupia»). */
export function claveFonetica(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .replace(/ch/g, "C")
      .replace(/ll/g, "y")
      .replace(/qu(?=[ei])/g, "k")
      .replace(/q/g, "k")
      // «gue» y «gui» suenan con g dura; «ge» y «gi», como j
      .replace(/gu(?=[ei])/g, "G")
      .replace(/g(?=[ei])/g, "j")
      .replace(/G/g, "g")
      .replace(/c(?=[ei])/g, "s")
      .replace(/c/g, "k")
      .replace(/z/g, "s")
      .replace(/x/g, "ks")
      .replace(/v/g, "b")
      .replace(/w/g, "u")
      .replace(/h/g, "")
      // La y al final o antes de consonante suena como i («Upyía» → «upiia» → «upia»)
      .replace(/y(?![aeiou])/g, "i")
      .replace(/yi|iy/g, "i")
      .replace(/(.)\1+/g, "$1")
  );
}

/** Sonidos que el reconocimiento confunde entre sí (cambiar uno por otro cuesta menos que una letra cualquiera). */
const PARECIDOS: Record<string, number> = {};
for (const [a, b, c] of [
  ["b", "p", 0.5],
  ["d", "t", 0.5],
  ["g", "k", 0.5],
  ["g", "j", 0.5],
  ["j", "k", 0.6],
  ["l", "r", 0.5],
  ["m", "n", 0.5],
  ["b", "m", 0.7],
  ["s", "C", 0.6],
  ["y", "i", 0.3],
  ["b", "u", 0.6],
  ["d", "r", 0.7],
  ["f", "j", 0.7],
  ["n", "y", 0.8],
] as [string, string, number][]) {
  PARECIDOS[a + b] = c;
  PARECIDOS[b + a] = c;
}

const cambio = (a: string, b: string) => (a === b ? 0 : esVocal(a) && esVocal(b) ? 0.45 : (PARECIDOS[a + b] ?? 1));
/** Quitar o agregar un sonido: una vocal o la y cuestan menos que una consonante. */
const quitar = (c: string) => (esVocal(c) ? 0.55 : c === "y" ? 0.5 : 0.85);

// Filas reutilizadas para no crear arreglos en cada comparación (se comparan miles de nombres por frase)
let fila0 = new Float64Array(64);
let fila1 = new Float64Array(64);
let fila2 = new Float64Array(64);

/** Distancia de edición ponderada entre dos claves fonéticas (con intercambio de dos letras vecinas). */
export function distanciaFonetica(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (m + 1 > fila0.length) {
    fila0 = new Float64Array(m + 1);
    fila1 = new Float64Array(m + 1);
    fila2 = new Float64Array(m + 1);
  }
  // fila2 = fila i-2, fila0 = fila i-1, fila1 = fila i
  let antes2 = fila2;
  let antes = fila0;
  let ahora = fila1;
  antes[0] = 0;
  for (let j = 1; j <= m; j++) antes[j] = antes[j - 1] + quitar(b[j - 1]);
  for (let i = 1; i <= n; i++) {
    const ai = a[i - 1];
    ahora[0] = antes[0] + quitar(ai);
    for (let j = 1; j <= m; j++) {
      const bj = b[j - 1];
      let v = Math.min(antes[j] + quitar(ai), ahora[j - 1] + quitar(bj), antes[j - 1] + cambio(ai, bj));
      if (i > 1 && j > 1 && ai === b[j - 2] && a[i - 2] === bj && ai !== bj) v = Math.min(v, antes2[j - 2] + 0.6);
      ahora[j] = v;
    }
    const t = antes2;
    antes2 = antes;
    antes = ahora;
    ahora = t;
  }
  return antes[m];
}

/** Parecido entre dos claves fonéticas, de 0 (nada que ver) a 1 (suenan igual). */
export function parecidoFonetico(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return Math.max(0, 1 - distanciaFonetica(a, b) / Math.max(a.length, b.length));
}
