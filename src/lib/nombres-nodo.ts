// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// v17.3 · Los nombres por defecto de los nodos van en el idioma de la pantalla («Repetidor 3» o «Repeater 3»), y Melki
// entiende los dos. Para que no se confundan, un número no se repite entre los dos idiomas: si ya hay un «Repetidor 1»,
// el repetidor nuevo con la pantalla en inglés se llama «Repeater 2».

/** Las parejas de nombres por defecto: español e inglés. */
const PAREJAS: [string, string][] = [
  ["Repetidor", "Repeater"],
  ["Persona", "Person"],
  ["Antena", "Antenna"],
  ["Apoyo", "Support"],
  ["Torre", "Tower"],
  ["Nodo", "Node"],
];

/** El mismo nombre por defecto en el otro idioma («Repetidor 3» → «Repeater 3»), o null si no es un nombre por defecto. */
export function nombreEnElOtroIdioma(nombre: string): string | null {
  const m = nombre.match(/^(\S+) (\d+)$/);
  if (!m) return null;
  for (const [es, en] of PAREJAS) {
    if (m[1] === es) return `${en} ${m[2]}`;
    if (m[1] === en) return `${es} ${m[2]}`;
  }
  return null;
}

/** ¿El nombre ya está usado, también en el otro idioma? */
export function nombreOcupado(nombre: string, usados: Set<string>): boolean {
  if (usados.has(nombre)) return true;
  const otro = nombreEnElOtroIdioma(nombre);
  return otro !== null && usados.has(otro);
}
