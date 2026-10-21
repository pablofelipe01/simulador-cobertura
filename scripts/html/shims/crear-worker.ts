// Versión HTML: el código del motor viene incrustado como texto (lo inserta scripts/html/build.mjs)
// y el worker se crea desde un Blob, porque los navegadores no cargan workers desde file://.
declare const __MOTOR_WORKER_SRC__: string;

export function crearWorker(): Worker {
  const url = URL.createObjectURL(new Blob([__MOTOR_WORKER_SRC__], { type: "text/javascript" }));
  return new Worker(url, { name: "motor-cobertura" });
}
