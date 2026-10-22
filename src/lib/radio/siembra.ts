// Sembrado automático de la malla: desde la red ya conectada al gateway, propone una cadena de repetidores
// hacia uno o varios destinos. Cada repetidor se busca en un abanico hacia el destino y se elige, entre los
// que avanzan casi lo máximo con un enlace sólido (≥ 30 dB) con el relieve real, el de suelo más alto (la loma).
import { distanciaM, desplazar, metrosPorGrado, rumbo } from "./geo";
import { enlaceEntre } from "./malla";
import { longitudOnda } from "./modelo";
import { calculoRed, completarParametros } from "./red";
import type { Relieve } from "./relieve";
import type { Antena, Caja, Parametros } from "./tipos";

/** Punto al que se quiere llevar la red; si es una persona ya puesta, se evalúa con su propio equipo. */
export type DestinoSiembra = { lat: number; lon: number; nombre?: string; antena?: Antena };

export type PedidoSiembra = {
  /** Nodos de infraestructura conectados al gateway (gateway y repetidores): de ahí arranca la cadena. */
  origenes: Antena[];
  destinos: DestinoSiembra[];
  /** Plantillas del repetidor que se propone y de la persona que debe quedar con servicio en el destino. */
  repetidor: Antena;
  persona: Antena;
  parametros: Parametros;
  maxRepetidores?: number;
  margenObjetivoDb?: number;
};

export type PuntoSiembra = {
  /** Identificador provisional («propuesto-N») y nodo del que cuelga en la cadena. */
  id: string;
  desdeId: string;
  lat: number;
  lon: number;
  sueloM: number;
  /** Margen del enlace con el nodo anterior de la cadena (dB) y distancia (km). */
  margenDb: number;
  distanciaKm: number;
  desde: string;
  destino: number;
};

export type ResultadoDestino = { llega: boolean; margenDb: number; desde: string | null; desdeId: string | null; motivo: string | null };

export type Siembra = { puntos: PuntoSiembra[]; destinos: ResultadoDestino[]; margenObjetivoDb: number };

/** Paso máximo entre repetidores (km) y apertura del abanico de búsqueda (grados a cada lado). */
const PASO_MAX_KM = 14;
const APERTURA_DEG = 45;
const SERVICIO_DB = 20;

/** Caja que contiene los orígenes y los destinos, con un borde para el abanico de búsqueda. */
export function cajaSiembra(origenes: { lat: number; lon: number }[], destinos: { lat: number; lon: number }[], bordeKm = 4): Caja {
  const todos = [...origenes, ...destinos];
  let caja: Caja = { oeste: Infinity, sur: Infinity, este: -Infinity, norte: -Infinity };
  for (const q of todos) caja = { oeste: Math.min(caja.oeste, q.lon), este: Math.max(caja.este, q.lon), sur: Math.min(caja.sur, q.lat), norte: Math.max(caja.norte, q.lat) };
  const m = metrosPorGrado((caja.norte + caja.sur) / 2);
  const b = bordeKm * 1000;
  return { oeste: caja.oeste - b / m.lon, este: caja.este + b / m.lon, sur: caja.sur - b / m.lat, norte: caja.norte + b / m.lat };
}

const dentro = (c: Caja, lat: number, lon: number) => lat >= c.sur && lat <= c.norte && lon >= c.oeste && lon <= c.este;

export function sembrar(pedido: PedidoSiembra, relieve: Relieve, caja: Caja): Siembra {
  const p = completarParametros(pedido.parametros);
  const red = calculoRed(p);
  const lambda = longitudOnda(p.frecuenciaMhz);
  const objetivo = pedido.margenObjetivoDb ?? 30;
  const maximo = pedido.maxRepetidores ?? 10;
  const origenes: Antena[] = pedido.origenes.map((a) => ({ ...a }));
  const puntos: PuntoSiembra[] = [];
  const enlace = (a: Antena, b: Antena) => enlaceEntre(a, b, p, relieve, red, lambda);
  const persona = (d: DestinoSiembra): Antena => ({ ...(d.antena ?? pedido.persona), id: "destino", lat: d.lat, lon: d.lon, pasarela: false });
  const nuevo = (lat: number, lon: number): Antena => ({ ...pedido.repetidor, id: `propuesto-${puntos.length + 1}`, nombre: `Propuesto ${puntos.length + 1}`, lat, lon });

  /** Mejor origen para dar servicio a una persona en el destino. */
  const servicio = (d: DestinoSiembra) => {
    const rx = persona(d);
    let mejor: { margen: number; desde: Antena } | null = null;
    for (const o of origenes) {
      if (distanciaM(o.lat, o.lon, d.lat, d.lon) > PASO_MAX_KM * 1500) continue;
      const m = enlace(o, rx).margen;
      if (!mejor || m > mejor.margen) mejor = { margen: m, desde: o };
    }
    return mejor;
  };

  // Primero los destinos más cercanos a la red: los siguientes pueden aprovechar esos repetidores
  const orden = pedido.destinos
    .map((d, i) => ({ d, i, dist: Math.min(...origenes.map((o) => distanciaM(o.lat, o.lon, d.lat, d.lon))) }))
    .sort((x, y) => x.dist - y.dist);
  const resultados: ResultadoDestino[] = pedido.destinos.map(() => ({ llega: false, margenDb: -Infinity, desde: null, desdeId: null, motivo: null }));

  for (const { d, i } of orden) {
    if (!origenes.length) {
      resultados[i] = { llega: false, margenDb: -Infinity, desde: null, desdeId: null, motivo: "Primero ponga el Gateway + Internet." };
      continue;
    }
    for (;;) {
      const s = servicio(d);
      if (s && s.margen >= SERVICIO_DB) {
        resultados[i] = { llega: true, margenDb: s.margen, desde: s.desde.nombre, desdeId: s.desde.id, motivo: null };
        break;
      }
      if (puntos.length >= maximo) {
        resultados[i] = { llega: false, margenDb: s?.margen ?? -Infinity, desde: s?.desde.nombre ?? null, desdeId: s?.desde.id ?? null, motivo: `Se alcanzó el máximo de ${maximo} repetidores propuestos.` };
        break;
      }
      // Avanzar desde el nodo de la red más cercano al destino
      const actual = origenes.reduce((x, y) => (distanciaM(y.lat, y.lon, d.lat, d.lon) < distanciaM(x.lat, x.lon, d.lat, d.lon) ? y : x));
      const D = distanciaM(actual.lat, actual.lon, d.lat, d.lon);
      const rumboBase = rumbo(actual.lat, actual.lon, d.lat, d.lon);
      const alcance = Math.min(D, PASO_MAX_KM * 1000);
      const pasoRadial = Math.max(350, alcance / 24);
      type Candidato = { lat: number; lon: number; suelo: number; margen: number; progreso: number; distancia: number };
      const candidatos: Candidato[] = [];
      for (let r = Math.min(600, alcance); r <= alcance + 1; r += pasoRadial) {
        for (let off = -APERTURA_DEG; off <= APERTURA_DEG; off += 9) {
          const q = desplazar(actual.lat, actual.lon, r, rumboBase + off);
          if (!dentro(caja, q.lat, q.lon)) continue;
          const rep = nuevo(q.lat, q.lon);
          const e = enlace(actual, rep);
          candidatos.push({ lat: q.lat, lon: q.lon, suelo: relieve.elevacion(q.lat, q.lon), margen: e.margen, progreso: D - distanciaM(q.lat, q.lon, d.lat, d.lon), distancia: e.distanciaKm });
        }
      }
      const elegir = (umbral: number) => {
        const validos = candidatos.filter((c) => c.margen >= umbral && c.progreso > 300);
        if (!validos.length) return null;
        const mejorProgreso = Math.max(...validos.map((c) => c.progreso));
        // Entre los que avanzan casi lo máximo, la loma más alta (y, a igual altura, el enlace más holgado)
        return validos.filter((c) => c.progreso >= 0.8 * mejorProgreso).sort((x, y) => y.suelo + y.margen / 2 - (x.suelo + x.margen / 2))[0];
      };
      const elegido = elegir(objetivo) ?? elegir(SERVICIO_DB + 2);
      if (!elegido) {
        resultados[i] = {
          llega: false,
          margenDb: s?.margen ?? -Infinity,
          desde: s?.desde.nombre ?? null,
          desdeId: s?.desde.id ?? null,
          motivo: `Desde ${actual.nombre} el terreno no deja avanzar hacia el destino con un enlace útil. Suba ese nodo o ponga un repetidor más alto a mano.`,
        };
        break;
      }
      const rep = nuevo(elegido.lat, elegido.lon);
      origenes.push(rep);
      puntos.push({ id: rep.id, desdeId: actual.id, lat: elegido.lat, lon: elegido.lon, sueloM: elegido.suelo, margenDb: elegido.margen, distanciaKm: elegido.distancia, desde: actual.nombre, destino: i });
    }
  }
  return { puntos, destinos: resultados, margenObjetivoDb: objetivo };
}
