// Cliente del motor: envía trabajos al Web Worker y devuelve promesas.
import { crearWorker } from "./crear-worker";
import type { Entrada, Fase, PuntoDestino, Salida } from "./protocolo";
import type { PedidoSiembra, Siembra } from "./siembra";
import type { Inspeccion } from "./simulacion";
import type { Antena, FuenteRelieve, Parametros, Perfil, PerfilTerreno, ResultadoSimulacion } from "./tipos";

type Pendiente = {
  resolver: (valor: unknown) => void;
  rechazar: (e: Error) => void;
  progreso?: (fase: Fase, avance: number) => void;
};

// Las distribuciones de Entrada no admiten Omit directo; se omite el id en cada variante.
type SinId<T> = T extends unknown ? Omit<T, "id"> : never;

export class MotorCobertura {
  private worker: Worker;
  private siguiente = 1;
  private pendientes = new Map<number, Pendiente>();

  constructor() {
    this.worker = crearWorker();
    this.worker.onmessage = (e: MessageEvent<Salida>) => this.recibir(e.data);
    this.worker.onerror = (e) => {
      const error = new Error(e.message || "El motor de cálculo se detuvo.");
      for (const p of this.pendientes.values()) p.rechazar(error);
      this.pendientes.clear();
    };
  }

  private recibir(m: Salida) {
    const p = this.pendientes.get(m.id);
    if (!p) return;
    switch (m.tipo) {
      case "progreso":
        p.progreso?.(m.fase, m.avance);
        return;
      case "resultado":
        p.resolver(m.resultado);
        break;
      case "cancelado":
        p.resolver(null);
        break;
      case "inspeccion":
        p.resolver(m.inspeccion);
        break;
      case "perfil":
      case "perfil-terreno":
        p.resolver(m.perfil);
        break;
      case "siembra":
        p.resolver(m.siembra);
        break;
      case "hgt":
        p.resolver({ archivos: m.archivos, errores: m.errores });
        break;
      case "error":
        p.rechazar(new Error(m.mensaje));
        break;
    }
    this.pendientes.delete(m.id);
  }

  private enviar<T>(mensaje: SinId<Entrada>, transferir: Transferable[] = [], progreso?: Pendiente["progreso"]): Promise<T> {
    const id = this.siguiente++;
    return new Promise<T>((resolver, rechazar) => {
      this.pendientes.set(id, { resolver: resolver as (v: unknown) => void, rechazar, progreso });
      this.worker.postMessage({ ...mensaje, id } as Entrada, transferir);
    });
  }

  /** Simula la cobertura; devuelve null si otra simulación la reemplazó. */
  simular(antenas: Antena[], parametros: Parametros, relieve: FuenteRelieve, progreso?: Pendiente["progreso"]) {
    return this.enviar<ResultadoSimulacion | null>({ tipo: "simular", antenas, parametros, relieve }, [], progreso);
  }

  inspeccionar(lat: number, lon: number, antenas: Antena[], parametros: Parametros, relieve: FuenteRelieve) {
    return this.enviar<Inspeccion>({ tipo: "inspeccionar", lat, lon, antenas, parametros, relieve });
  }

  perfil(tx: Antena, destino: Antena | PuntoDestino, parametros: Parametros, relieve: FuenteRelieve) {
    return this.enviar<Perfil>({ tipo: "perfil", tx, destino, parametros, relieve });
  }

  perfilTerreno(puntos: [number, number][], relieve: FuenteRelieve) {
    return this.enviar<PerfilTerreno>({ tipo: "perfil-terreno", puntos, relieve });
  }

  /** Propone repetidores desde la red conectada hacia los destinos (sembrado automático). */
  sembrar(pedido: PedidoSiembra, relieve: FuenteRelieve) {
    return this.enviar<Siembra>({ tipo: "sembrar", pedido, relieve });
  }

  async cargarHgt(archivos: File[]) {
    const datos = await Promise.all(archivos.map(async (f) => ({ nombre: f.name, datos: await f.arrayBuffer() })));
    return this.enviar<{ archivos: string[]; errores: string[] }>(
      { tipo: "cargar-hgt", archivos: datos },
      datos.map((d) => d.datos),
    );
  }

  borrarHgt() {
    return this.enviar<{ archivos: string[]; errores: string[] }>({ tipo: "borrar-hgt" });
  }

  cancelar() {
    this.worker.postMessage({ tipo: "cancelar" } satisfies Entrada);
  }

  destruir() {
    this.worker.terminate();
    for (const p of this.pendientes.values()) p.rechazar(new Error("Motor detenido."));
    this.pendientes.clear();
  }
}
