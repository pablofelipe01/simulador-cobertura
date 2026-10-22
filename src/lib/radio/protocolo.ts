// Mensajes entre la interfaz y el motor de cálculo (Web Worker).
import type { Diseno, PedidoDiseno } from "./diseno";
import type { PedidoSiembra, Siembra } from "./siembra";
import type { Inspeccion } from "./simulacion";
import type { Antena, FuenteRelieve, Parametros, Perfil, PerfilTerreno, ResultadoSimulacion } from "./tipos";

export type PuntoDestino = { lat: number; lon: number; alturaM?: number };

export type Entrada =
  | { tipo: "simular"; id: number; antenas: Antena[]; parametros: Parametros; relieve: FuenteRelieve }
  | { tipo: "inspeccionar"; id: number; lat: number; lon: number; antenas: Antena[]; parametros: Parametros; relieve: FuenteRelieve }
  | { tipo: "perfil"; id: number; tx: Antena; destino: Antena | PuntoDestino; parametros: Parametros; relieve: FuenteRelieve }
  | { tipo: "perfil-terreno"; id: number; puntos: [number, number][]; relieve: FuenteRelieve }
  | { tipo: "sembrar"; id: number; pedido: PedidoSiembra; relieve: FuenteRelieve }
  | { tipo: "disenar"; id: number; pedido: PedidoDiseno; relieve: FuenteRelieve }
  | { tipo: "cargar-hgt"; id: number; archivos: { nombre: string; datos: ArrayBuffer }[] }
  | { tipo: "borrar-hgt"; id: number }
  | { tipo: "cancelar" };

export type Fase = "relieve" | "cobertura" | "enlaces";

export type Salida =
  | { tipo: "progreso"; id: number; fase: Fase; avance: number }
  | { tipo: "resultado"; id: number; resultado: ResultadoSimulacion }
  | { tipo: "cancelado"; id: number }
  | { tipo: "inspeccion"; id: number; inspeccion: Inspeccion }
  | { tipo: "perfil"; id: number; perfil: Perfil }
  | { tipo: "perfil-terreno"; id: number; perfil: PerfilTerreno }
  | { tipo: "siembra"; id: number; siembra: Siembra }
  | { tipo: "diseno"; id: number; diseno: Diseno }
  | { tipo: "hgt"; id: number; archivos: string[]; errores: string[] }
  | { tipo: "error"; id: number; mensaje: string };
