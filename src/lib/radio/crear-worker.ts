// Crea el Web Worker del motor. La versión HTML (sin servidor) reemplaza este módulo por uno
// que arma el worker desde un Blob (ver scripts/html/shims/crear-worker.ts).
export function crearWorker(): Worker {
  return new Worker(new URL("./motor.worker.ts", import.meta.url), { type: "module", name: "motor-cobertura" });
}
