// Motor de cálculo en segundo plano: descarga y decodifica el relieve, y simula sin bloquear la interfaz.
import { curvaCarga, simularCarga } from "./carga";
import { estresMalla } from "./estres";
import type { Entrada, Salida } from "./protocolo";
import { ColeccionHgt, decodificarTerrarium, leerHgt } from "./relieve";
import { ajustarRed, disenarMallaArea, inspeccionar, olvidarRelieve, perfil, perfilTerreno, sembrarMalla, simular, type Contexto } from "./simulacion";
import type { FuenteRelieve } from "./tipos";

const alcance = self as unknown as {
  postMessage(m: Salida, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<Entrada>) => void) | null;
};

const hgt = new ColeccionHgt();
const MAX_TESELAS = 320;
const cache = new Map<string, Promise<Float32Array | null>>();
let urlRelieve = "";
let simulacionActual = 0;

async function descargar(url: string): Promise<Float32Array | null> {
  try {
    const r = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!r.ok) return null;
    const blob = await r.blob();
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    const lienzo = new OffscreenCanvas(256, 256);
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, 256, 256);
    bmp.close();
    return decodificarTerrarium(ctx.getImageData(0, 0, 256, 256).data);
  } catch {
    return null;
  }
}

function cargarTesela(z: number, x: number, y: number): Promise<Float32Array | null> {
  const url = urlRelieve.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  let p = cache.get(url);
  if (!p) {
    p = descargar(url);
    cache.set(url, p);
    // Las fallidas no se guardan, para reintentar en la siguiente simulación
    void p.then((t) => {
      if (!t) cache.delete(url);
    });
    if (cache.size > MAX_TESELAS) cache.delete(cache.keys().next().value!);
  }
  return p;
}

// Ceder el turno sin la demora mínima de setTimeout, para poder recibir «cancelar».
const canal = new MessageChannel();
const pendientes: (() => void)[] = [];
canal.port1.onmessage = () => pendientes.shift()?.();
const cederTurno = () =>
  new Promise<void>((r) => {
    pendientes.push(r);
    canal.port2.postMessage(0);
  });

function contexto(id: number, fuente: FuenteRelieve, conProgreso: boolean): Contexto {
  if (fuente.tipo === "teselas") urlRelieve = fuente.url;
  let ultimoAviso = 0;
  return {
    cargarTesela,
    hgt,
    progreso: conProgreso
      ? (fase, avance) => {
          const ahora = performance.now();
          if (avance < 1 && ahora - ultimoAviso < 80) return;
          ultimoAviso = ahora;
          alcance.postMessage({ tipo: "progreso", id, fase, avance });
        }
      : undefined,
    ceder: async () => {
      await cederTurno();
      return simulacionActual !== id;
    },
  };
}

alcance.onmessage = async (e) => {
  const m = e.data;
  if (m.tipo === "cancelar") {
    simulacionActual = -1;
    return;
  }
  try {
    switch (m.tipo) {
      case "simular": {
        simulacionActual = m.id;
        const r = await simular(m.id, m.antenas, m.parametros, m.relieve, contexto(m.id, m.relieve, true), m.area ?? null);
        if (!r) {
          alcance.postMessage({ tipo: "cancelado", id: m.id });
          return;
        }
        alcance.postMessage({ tipo: "resultado", id: m.id, resultado: r }, [r.mejor.buffer, r.segundo.buffer, r.servidor.buffer, r.servidores.buffer, r.porAntena.buffer]);
        return;
      }
      case "inspeccionar": {
        const r = await inspeccionar(m.lat, m.lon, m.antenas, m.parametros, m.relieve, contexto(m.id, m.relieve, false));
        alcance.postMessage({ tipo: "inspeccion", id: m.id, inspeccion: r });
        return;
      }
      case "perfil": {
        const r = await perfil(m.tx, m.destino, m.parametros, m.relieve, contexto(m.id, m.relieve, false));
        alcance.postMessage({ tipo: "perfil", id: m.id, perfil: r });
        return;
      }
      case "perfil-terreno": {
        const r = await perfilTerreno(m.puntos, m.relieve, contexto(m.id, m.relieve, false));
        alcance.postMessage({ tipo: "perfil-terreno", id: m.id, perfil: r });
        return;
      }
      case "sembrar": {
        const r = await sembrarMalla(m.pedido, m.relieve, contexto(m.id, m.relieve, false));
        alcance.postMessage({ tipo: "siembra", id: m.id, siembra: r });
        return;
      }
      case "ajustar": {
        const r = await ajustarRed(m.pedido, m.relieve, contexto(m.id, m.relieve, false));
        alcance.postMessage({ tipo: "ajuste", id: m.id, ajuste: r });
        return;
      }
      case "carga": {
        const carga = simularCarga(m.pedido);
        const curva = m.curva && !carga.motivo ? curvaCarga(m.pedido) : null;
        alcance.postMessage({ tipo: "carga", id: m.id, carga, curva });
        return;
      }
      case "estres": {
        const r = estresMalla(m.pedido, (avance) => alcance.postMessage({ tipo: "progreso", id: m.id, fase: "estres", avance }));
        alcance.postMessage({ tipo: "estres", id: m.id, estres: r });
        return;
      }
      case "disenar": {
        const r = await disenarMallaArea(m.pedido, m.relieve, contexto(m.id, m.relieve, false));
        alcance.postMessage({ tipo: "diseno", id: m.id, diseno: r });
        return;
      }
      case "cargar-hgt": {
        const errores: string[] = [];
        for (const a of m.archivos) {
          try {
            hgt.agregar(leerHgt(a.nombre, a.datos));
          } catch (err) {
            errores.push(err instanceof Error ? err.message : String(err));
          }
        }
        olvidarRelieve();
        alcance.postMessage({ tipo: "hgt", id: m.id, archivos: hgt.lista.map((h) => h.nombre), errores });
        return;
      }
      case "borrar-hgt": {
        hgt.vaciar();
        olvidarRelieve();
        alcance.postMessage({ tipo: "hgt", id: m.id, archivos: [], errores: [] });
        return;
      }
    }
  } catch (err) {
    alcance.postMessage({ tipo: "error", id: "id" in m ? m.id : 0, mensaje: err instanceof Error ? err.message : String(err) });
  }
};
