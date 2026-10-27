// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Cliente del motor: envía trabajos al Web Worker y devuelve promesas.
import { crearWorker } from "./crear-worker";
import type { Entrada, Fase, PuntoDestino, Salida } from "./protocolo";
import type { Ajuste, PedidoAjuste } from "./ajuste";
import type { CurvaCargaResultado, PedidoCarga, ResultadoCarga } from "./carga";
import type { PedidoEstres, ResultadoEstres } from "./estres";
import type { PedidoOptimizar, ResultadoOptimizar } from "./optimizar";
import type { Diseno, PedidoDiseno } from "./diseno";
import type { PedidoSiembra, Siembra } from "./siembra";
import type { Inspeccion } from "./simulacion";
import type { Antena, AreaObjetivo, FuenteRelieve, Parametros, Perfil, PerfilTerreno, ResultadoSimulacion } from "./tipos";

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
      case "diseno":
        p.resolver(m.diseno);
        break;
      case "ajuste":
        p.resolver(m.ajuste);
        break;
      case "carga":
        p.resolver({ carga: m.carga, curva: m.curva });
        break;
      case "estres":
        p.resolver(m.estres);
        break;
      case "optimizacion":
        p.resolver(m.optimizacion);
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
  simular(antenas: Antena[], parametros: Parametros, relieve: FuenteRelieve, progreso?: Pendiente["progreso"], area: AreaObjetivo | null = null) {
    return this.enviar<ResultadoSimulacion | null>({ tipo: "simular", antenas, parametros, relieve, area }, [], progreso);
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

  /** Ajuste inteligente: opciones para dejar la red factible con la mejor relación cobertura–costo. */
  ajustar(pedido: PedidoAjuste, relieve: FuenteRelieve) {
    return this.enviar<Ajuste>({ tipo: "ajustar", pedido, relieve });
  }

  /** Prueba de carga: N pagos o mensajes al tiempo y, si se pide, la curva hasta que la red se revienta. */
  carga(pedido: PedidoCarga, curva = false) {
    return this.enviar<{ carga: ResultadoCarga; curva: CurvaCargaResultado | null }>({ tipo: "carga", pedido, curva });
  }

  /** Prueba de estrés de la hora pico, repetidor por repetidor (y la rampa hasta que cada zona se revienta). */
  estres(pedido: PedidoEstres, progreso?: (avance: number) => void) {
    return this.enviar<ResultadoEstres>({ tipo: "estres", pedido }, [], progreso ? (_f, a) => progreso(a) : undefined);
  }

  /** Optimiza una red sobrecargada para la carga de la prueba de estrés: gateways y antenas de apoyo, y ajustes. */
  optimizar(pedido: PedidoOptimizar, relieve: FuenteRelieve, progreso?: (avance: number) => void) {
    return this.enviar<ResultadoOptimizar>({ tipo: "optimizar", pedido, relieve }, [], progreso ? (_f, a) => progreso(a) : undefined);
  }

  /** Diseña la malla para cubrir un área (gateway y repetidores) con el relieve real. */
  disenar(pedido: PedidoDiseno, relieve: FuenteRelieve) {
    return this.enviar<Diseno>({ tipo: "disenar", pedido, relieve });
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
