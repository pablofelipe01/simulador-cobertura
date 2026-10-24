// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Crea el Web Worker del motor. La versión HTML (sin servidor) reemplaza este módulo por uno
// que arma el worker desde un Blob (ver scripts/html/shims/crear-worker.ts).
export function crearWorker(): Worker {
  return new Worker(new URL("./motor.worker.ts", import.meta.url), { type: "module", name: "motor-cobertura" });
}
