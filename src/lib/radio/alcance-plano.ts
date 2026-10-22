// Alcance de referencia en terreno plano y despejado: hasta qué distancia un enlace entre dos equipos conserva
// un margen dado. Sirve para orientar al sembrar («con torre de 15 m llega a ≈ 14 km»), como el alcance que
// muestra Trama para cada pieza; la simulación del mapa usa siempre el relieve real.
import { desplazar } from "./geo";
import { enlaceEntre } from "./malla";
import { longitudOnda } from "./modelo";
import { calculoRed, completarParametros } from "./red";
import { relievePlano } from "./relieve";
import type { Antena, Parametros } from "./tipos";

const ORIGEN = { lat: 4.2, lon: -73.37 };
const cache = new Map<string, number>();

/** Distancia máxima (km) en la que el enlace `tx` → `rx` tiene al menos `margenDb` sobre terreno plano. */
export function alcancePlanoKm(tx: Antena, rx: Antena, parametros: Parametros, margenDb = 20, maxKm = 60): number {
  const clave = JSON.stringify([tx.alturaM, tx.potenciaDbm, tx.gananciaDbi, tx.perdidaCableDb, tx.patron ?? "omni", rx.alturaM, rx.gananciaDbi, rx.perdidaCableDb, parametros, margenDb, maxKm]);
  const guardado = cache.get(clave);
  if (guardado !== undefined) return guardado;
  const p = completarParametros(parametros);
  const red = calculoRed(p);
  const lambda = longitudOnda(p.frecuenciaMhz);
  const fin = desplazar(ORIGEN.lat, ORIGEN.lon, maxKm * 1000, 90);
  const caja = { oeste: ORIGEN.lon - 0.05, este: fin.lon + 0.05, sur: ORIGEN.lat - 0.05, norte: ORIGEN.lat + 0.05 };
  const relieve = relievePlano(caja);
  const a = { ...tx, id: "tx", lat: ORIGEN.lat, lon: ORIGEN.lon, patron: undefined };
  const margen = (km: number) => {
    const q = desplazar(ORIGEN.lat, ORIGEN.lon, km * 1000, 90);
    return enlaceEntre(a, { ...rx, id: "rx", lat: q.lat, lon: q.lon, patron: undefined }, p, relieve, red, lambda).margen;
  };
  let resultado: number;
  if (margen(maxKm) >= margenDb) resultado = maxKm;
  else if (margen(0.1) < margenDb) resultado = 0;
  else {
    // En terreno plano el margen baja con la distancia: búsqueda binaria hasta ~50 m
    let lo = 0.1;
    let hi = maxKm;
    while (hi - lo > 0.05) {
      const mid = (lo + hi) / 2;
      if (margen(mid) >= margenDb) lo = mid;
      else hi = mid;
    }
    resultado = Math.round(lo * 10) / 10;
  }
  if (cache.size > 200) cache.clear();
  cache.set(clave, resultado);
  return resultado;
}
