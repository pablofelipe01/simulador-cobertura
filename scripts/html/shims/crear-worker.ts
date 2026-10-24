// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Versión HTML: el código del motor viene incrustado como texto (lo inserta scripts/html/build.mjs)
// y el worker se crea desde un Blob, porque los navegadores no cargan workers desde file://.
declare const __MOTOR_WORKER_SRC__: string;

export function crearWorker(): Worker {
  const url = URL.createObjectURL(new Blob([__MOTOR_WORKER_SRC__], { type: "text/javascript" }));
  return new Worker(url, { name: "motor-cobertura" });
}
