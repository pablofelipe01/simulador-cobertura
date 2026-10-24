// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Piezas del modo «Sembrar la malla», como en Trama: el Gateway + Internet (donde entra el internet), los
// repetidores (nodos en torres o lomas) y las personas (radio de mano con el celular). Por dentro siguen siendo
// los nodos del simulador: el gateway es un nodo antena pasarela, el repetidor un nodo antena y la persona un nodo.
import { EQUIPOS, type EquipoId } from "@/lib/radio/constantes";
import { piezaDe, type Pieza } from "@/lib/radio/estado-red";
import { desplazar } from "@/lib/radio/geo";
import type { Antena, Escenario, TipoNodo } from "@/lib/radio/tipos";

import { nuevaAntena, PARAMETROS_DEFECTO } from "./estado";

export type { Pieza };
export { piezaDe };

export const PIEZAS: Pieza[] = ["gateway", "repetidor", "persona"];

export const NOMBRE_PIEZA: Record<Pieza, string> = { gateway: "Gateway + Internet", repetidor: "Repetidor", persona: "Persona" };

export const AYUDA_PIEZA: Record<Pieza, string> = {
  gateway: "Donde haya luz y señal —la cabecera, una finca—: es la única pieza con conexión a internet (el router va a su lado) y lleva la IA. Desde ahí sale la malla.",
  repetidor: "Ubíquelos en las lomas para llegar lejos: pasan los mensajes de los demás y deben alcanzar al gateway o a otro repetidor conectado.",
  persona: "Ubíquelas en el campo: cada una lleva un radio enlazado al celular para pagar, escribir por WhatsApp o consultar a la IA. Se conectan al repetidor más cercano; en rojo, no tienen cobertura.",
};

/** Alturas que se ofrecen para los repetidores nuevos (m): el de Trama va en un tubo de hierro de 6 m. */
export const ALTURAS_REPETIDOR = [6, 9, 12, 15, 20, 30] as const;
export const ALTURA_REPETIDOR_DEFECTO = 6;
/** El sitio gateway de Trama: torre arriostrada de 12 m con las cuatro antenas separadas en vertical. */
export const ALTURA_GATEWAY_M = 12;
export const ALTURA_PERSONA_M = 1.5;

function equipo(id: EquipoId) {
  const q = EQUIPOS.find((x) => x.id === id) ?? EQUIPOS[0];
  return { equipo: q.id, potenciaDbm: q.potenciaDbm, gananciaDbi: q.gananciaDbi, perdidaCableDb: q.perdidaCableDb };
}

/** Siguiente nombre libre: «Gateway», «Gateway 2»… o «Repetidor 1», «Repetidor 2»… */
export function nombreLibre(base: string, existentes: Antena[], primeroSinNumero = false): string {
  const usados = new Set(existentes.map((a) => a.nombre));
  if (primeroSinNumero && !usados.has(base)) return base;
  let n = primeroSinNumero ? 2 : 1;
  while (usados.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Datos de una pieza nueva (se completan con `nuevaAntena`). */
export function plantillaPieza(pieza: Pieza, existentes: Antena[], alturaRepetidorM = ALTURA_REPETIDOR_DEFECTO): Partial<Antena> & { tipo: TipoNodo } {
  switch (pieza) {
    case "gateway":
      // La radio del gateway (pagos, WhatsApp y consultas a la IA) es un companion USB del mini PC: recibe, pero no retransmite
      return { tipo: "antena", nombre: nombreLibre("Gateway", existentes, true), alturaM: ALTURA_GATEWAY_M, ...equipo("t114-8dbi"), rol: "COMPANION", pasarela: true };
    case "repetidor":
      return { tipo: "antena", nombre: nombreLibre("Repetidor", existentes), alturaM: alturaRepetidorM, ...equipo("p1-8dbi"), rol: "REPETIDOR", pasarela: false };
    case "persona":
      return { tipo: "nodo", nombre: nombreLibre("Persona", existentes), alturaM: ALTURA_PERSONA_M, ...equipo("xiao"), rol: "COMPANION", pasarela: false };
  }
}

/** Pieza completa en un punto. */
export function nuevaPieza(pieza: Pieza, lat: number, lon: number, existentes: Antena[], alturaRepetidorM?: number): Antena {
  return nuevaAntena(Number(lat.toFixed(6)), Number(lon.toFixed(6)), existentes, plantillaPieza(pieza, existentes, alturaRepetidorM));
}

/**
 * Ejemplo de malla en un punto genérico de la llanura (sin datos de ningún cliente): el gateway en la casa,
 * un repetidor en torre hacia el oriente y tres personas; la más lejana queda sin cobertura para practicar.
 */
export function escenarioMalla(): Escenario {
  const lat0 = 4.2;
  const lon0 = -73.37;
  const lista: Antena[] = [];
  const poner = (pieza: Pieza, distanciaM: number, rumboDeg: number, datos: Partial<Antena> = {}) => {
    const q = distanciaM ? desplazar(lat0, lon0, distanciaM, rumboDeg) : { lat: lat0, lon: lon0 };
    const a = { ...nuevaPieza(pieza, q.lat, q.lon, lista), ...datos };
    lista.push(a);
    return a;
  };
  poner("gateway", 0, 0);
  poner("repetidor", 12000, 85);
  poner("persona", 5500, 205);
  poner("persona", 17500, 95);
  poner("persona", 31000, 72);
  return { version: 1, nombre: "Ejemplo de malla: gateway, repetidor y personas", antenas: lista, parametros: { ...PARAMETROS_DEFECTO, radioKm: 15 }, mediciones: [] };
}
