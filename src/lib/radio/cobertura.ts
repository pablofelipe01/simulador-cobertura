// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Cálculo de la cobertura de varias antenas sobre una malla común (Web Mercator).
import { DISTANCIA_MINIMA_M, RESOLUCIONES, UMBRAL_CONFIABLE_DB, UMBRAL_SERVICIO_DB } from "./constantes";
import { latAMercator, lonAMercator, mercatorALat, mercatorALon, MERCATOR_MAX, metrosPorGrado } from "./geo";
import { perdidaEntorno } from "./entorno";
import { difraccion, indiceClase, longitudOnda, margen, presupuestoCobertura } from "./modelo";
import { anguloElevacion, atenuacionPatron, esDireccional, rumboLocal } from "./patron";
import { intervalosPerfil, muestrearPerfil, pasoPerfil, vDePerfil, vMaximo } from "./perfil";
import { calculoRed } from "./red";
import type { Relieve } from "./relieve";
import type { Antena, AreaPorClase, Caja, MallaCalculo, Parametros, ResumenAntena } from "./tipos";

const MAX_CELDAS = 4_500_000;

/** Caja que contiene los círculos de estudio de todas las antenas. */
export function cajaDeEstudio(antenas: Antena[], radioKm: number, bordeKm = 0.5): Caja {
  let caja: Caja = { oeste: Infinity, sur: Infinity, este: -Infinity, norte: -Infinity };
  for (const a of antenas) {
    const m = metrosPorGrado(a.lat);
    const r = (radioKm + bordeKm) * 1000;
    caja = {
      oeste: Math.min(caja.oeste, a.lon - r / m.lon),
      este: Math.max(caja.este, a.lon + r / m.lon),
      sur: Math.min(caja.sur, a.lat - r / m.lat),
      norte: Math.max(caja.norte, a.lat + r / m.lat),
    };
  }
  return caja;
}

export type MallaInterna = MallaCalculo & {
  /** Tamaño de celda en metros Mercator. */
  celdaMerc: number;
  x0: number;
  y1: number;
  lats: Float64Array;
  lons: Float64Array;
  /** Área de cada celda por fila (km²). */
  areaFila: Float64Array;
};

export function crearMalla(antenas: Antena[], p: Parametros): MallaInterna {
  const caja0 = cajaDeEstudio(antenas, p.radioKm);
  const latMedia = (caja0.norte + caja0.sur) / 2;
  const coseno = Math.cos((latMedia * Math.PI) / 180);
  let celdaM = Math.max(10, (p.radioKm * 1000) / RESOLUCIONES[p.resolucion].celdasPorRadio);
  const x0 = lonAMercator(caja0.oeste);
  const x1 = lonAMercator(caja0.este);
  const y0 = latAMercator(caja0.sur);
  const y1 = latAMercator(caja0.norte);
  let celdaMerc = celdaM / coseno;
  let ancho = Math.ceil((x1 - x0) / celdaMerc);
  let alto = Math.ceil((y1 - y0) / celdaMerc);
  if (ancho * alto > MAX_CELDAS) {
    const factor = Math.sqrt((ancho * alto) / MAX_CELDAS);
    celdaM *= factor;
    celdaMerc = celdaM / coseno;
    ancho = Math.ceil((x1 - x0) / celdaMerc);
    alto = Math.ceil((y1 - y0) / celdaMerc);
  }
  const caja: Caja = {
    oeste: caja0.oeste,
    norte: caja0.norte,
    este: mercatorALon(x0 + ancho * celdaMerc),
    sur: mercatorALat(y1 - alto * celdaMerc),
  };
  const lats = new Float64Array(alto);
  const areaFila = new Float64Array(alto);
  for (let j = 0; j < alto; j++) {
    lats[j] = mercatorALat(y1 - (j + 0.5) * celdaMerc);
    const lado = celdaMerc * Math.cos((lats[j] * Math.PI) / 180);
    areaFila[j] = (lado * lado) / 1e6;
  }
  const lons = new Float64Array(ancho);
  for (let i = 0; i < ancho; i++) lons[i] = mercatorALon(x0 + (i + 0.5) * celdaMerc);
  return { caja, ancho, alto, celdaM, celdaMerc, x0, y1, lats, lons, areaFila };
}

export type Cobertura = {
  mejor: Float32Array;
  segundo: Float32Array;
  servidor: Int16Array;
  servidores: Uint8Array;
  porAntena: Int8Array;
  antenas: ResumenAntena[];
  areaEstudioKm2: number;
  areaPorClase: AreaPorClase;
  porcentajeServicio: number;
  porcentajeConfiable: number;
  porcentajeRespaldo: number;
};

type Avisar = (avance: number) => void | Promise<void>;

/**
 * Margen de una antena hacia receptores en puntos sueltos (a la altura del receptor configurado), con el mismo
 * cálculo que cada celda del mapa de cobertura. Lo usa el diseño de la malla por área.
 */
export function evaluadorMargen(ant: Antena, p: Parametros, relieve: Relieve): (lat: number, lon: number) => number {
  const lambda = longitudOnda(p.frecuenciaMhz);
  const red = calculoRed(p);
  const conPerfil = red.necesitaPerfil;
  const itmPuro = red.modelo === "itm";
  const presupuesto = presupuestoCobertura(ant, p);
  const [ax, ay] = relieve.pixel(ant.lat, ant.lon);
  const za = relieve.muestra(ax, ay) + ant.alturaM;
  const paso = pasoPerfil(relieve, ant.lat);
  const m = metrosPorGrado(ant.lat);
  const fijo = perdidaEntorno(p.entorno, p.alturaRxM, p.frecuenciaMhz) + perdidaEntorno(p.entorno, ant.alturaM, p.frecuenciaMhz);
  const direccional = esDireccional(ant);
  return (lat, lon) => {
    const dLat = (lat - ant.lat) * m.lat;
    const dLon = (lon - ant.lon) * m.lon;
    let d = Math.sqrt(dLat * dLat + dLon * dLon);
    if (d < DISTANCIA_MINIMA_M) d = DISTANCIA_MINIMA_M;
    const [bx, by] = relieve.pixel(lat, lon);
    const zb = relieve.muestra(bx, by) + p.alturaRxM;
    let mg: number;
    if (!conPerfil) {
      const v = vMaximo(relieve, ax, ay, za, bx, by, zb, d, lambda, paso);
      mg = margen(presupuesto, p.frecuenciaMhz, d, difraccion(v), ant.alturaM);
    } else {
      const n = intervalosPerfil(d, paso);
      const z = muestrearPerfil(relieve, ax, ay, bx, by, n);
      if (itmPuro) mg = presupuesto - red.itm(z, n + 1, d, ant.alturaM, p.alturaRxM).perdidaDb;
      else {
        const v = vDePerfil(z, n, za, zb, d, lambda);
        mg = margen(presupuesto, p.frecuenciaMhz, d, difraccion(v), ant.alturaM) - red.ajuste(z, n + 1, d, ant.alturaM, p.alturaRxM);
      }
    }
    if (fijo) mg -= fijo;
    if (direccional) mg -= atenuacionPatron(ant, rumboLocal(dLon, dLat), anguloElevacion(za, zb, d));
    return mg;
  };
}

/** Número de sectores para el alcance por dirección (5° cada uno, desde el norte en sentido horario). */
export const SECTORES = 72;
function sectorDe(este: number, norte: number) {
  const ang = Math.atan2(este, norte);
  const s = Math.floor(((ang < 0 ? ang + 2 * Math.PI : ang) / (2 * Math.PI)) * SECTORES);
  return s >= SECTORES ? 0 : s;
}

/**
 * Calcula el margen de cada celda desde cada antena activa y combina los resultados.
 * `ceder` se llama periódicamente para permitir cancelar (devuelve true para detener).
 */
export async function calcularCobertura(
  antenas: Antena[],
  p: Parametros,
  relieve: Relieve,
  malla: MallaInterna,
  avisar?: Avisar,
  ceder?: () => Promise<boolean>,
): Promise<Cobertura | null> {
  const { ancho, alto, lats, lons, areaFila } = malla;
  const total = ancho * alto;
  const mejor = new Float32Array(total).fill(-Infinity);
  const segundo = new Float32Array(total).fill(-Infinity);
  const servidor = new Int16Array(total).fill(-1);
  const servidores = new Uint8Array(total);
  // Margen de cada antena por celda en 1 byte (−128 = fuera de su radio), para ver una antena sola
  const porAntena = new Int8Array(total * antenas.length).fill(-128);
  const lambda = longitudOnda(p.frecuenciaMhz);
  const radioM = p.radioKm * 1000;
  const escala = 256 * 2 ** relieve.zoom;
  // Píxel global del relieve para cada columna y fila (lineal en Mercator)
  const px = new Float64Array(ancho);
  for (let i = 0; i < ancho; i++) px[i] = ((malla.x0 + (i + 0.5) * malla.celdaMerc + MERCATOR_MAX) / (2 * MERCATOR_MAX)) * escala;
  const py = new Float64Array(alto);
  for (let j = 0; j < alto; j++) py[j] = ((MERCATOR_MAX - (malla.y1 - (j + 0.5) * malla.celdaMerc)) / (2 * MERCATOR_MAX)) * escala;

  const resumen: ResumenAntena[] = [];
  const filasTotales = antenas.length * alto;
  // Parámetros de red (Longley-Rice) y entorno: con los valores de referencia no cambian el modelo calibrado
  const red = calculoRed(p);
  const conPerfil = red.necesitaPerfil;
  const itmPuro = red.modelo === "itm";
  const entornoRx = perdidaEntorno(p.entorno, p.alturaRxM, p.frecuenciaMhz);
  let filasHechas = 0;

  for (let a = 0; a < antenas.length; a++) {
    const ant = antenas[a];
    const presupuesto = presupuestoCobertura(ant, p);
    const [ax, ay] = relieve.pixel(ant.lat, ant.lon);
    const suelo = relieve.muestra(ax, ay);
    const za = suelo + ant.alturaM;
    const paso = pasoPerfil(relieve, ant.lat);
    const m = metrosPorGrado(ant.lat);
    const fijo = entornoRx + perdidaEntorno(p.entorno, ant.alturaM, p.frecuenciaMhz);
    const direccional = esDireccional(ant);
    let jIni = 0;
    while (jIni < alto && (lats[jIni] - ant.lat) * m.lat > radioM) jIni++;
    let areaServicio = 0;
    let areaConfiable = 0;
    let alcance = 0;
    let alcanceConfiable = 0;
    const rumbo = new Float64Array(SECTORES);
    const rumboConfiable = new Float64Array(SECTORES);
    const base = a * total;
    for (let j = jIni; j < alto; j++) {
      const dLat = (lats[j] - ant.lat) * m.lat;
      if (dLat < -radioM) break;
      if (Math.abs(dLat) <= radioM) {
        const fila = j * ancho;
        const pyj = py[j];
        for (let i = 0; i < ancho; i++) {
          const dLon = (lons[i] - ant.lon) * m.lon;
          if (dLon < -radioM || dLon > radioM) continue;
          let d = Math.sqrt(dLat * dLat + dLon * dLon);
          if (d > radioM) continue;
          if (d < DISTANCIA_MINIMA_M) d = DISTANCIA_MINIMA_M;
          const zb = relieve.muestra(px[i], pyj) + p.alturaRxM;
          let mg: number;
          if (!conPerfil) {
            const v = vMaximo(relieve, ax, ay, za, px[i], pyj, zb, d, lambda, paso);
            mg = margen(presupuesto, p.frecuenciaMhz, d, difraccion(v), ant.alturaM);
          } else {
            const n = intervalosPerfil(d, paso);
            const z = muestrearPerfil(relieve, ax, ay, px[i], pyj, n);
            if (itmPuro) mg = presupuesto - red.itm(z, n + 1, d, ant.alturaM, p.alturaRxM).perdidaDb;
            else {
              const v = vDePerfil(z, n, za, zb, d, lambda);
              mg = margen(presupuesto, p.frecuenciaMhz, d, difraccion(v), ant.alturaM) - red.ajuste(z, n + 1, d, ant.alturaM, p.alturaRxM);
            }
          }
          if (fijo) mg -= fijo;
          if (direccional) mg -= atenuacionPatron(ant, rumboLocal(dLon, dLat), anguloElevacion(za, zb, d));
          const c = fila + i;
          porAntena[base + c] = mg > 127 ? 127 : mg < -127 ? -127 : Math.round(mg);
          if (mg > mejor[c]) {
            segundo[c] = mejor[c];
            mejor[c] = mg;
            servidor[c] = a;
          } else if (mg > segundo[c]) segundo[c] = mg;
          if (mg >= UMBRAL_SERVICIO_DB) {
            if (servidores[c] < 255) servidores[c]++;
            areaServicio += areaFila[j];
            if (d > alcance) alcance = d;
            const sector = sectorDe(dLon, dLat);
            if (d > rumbo[sector]) rumbo[sector] = d;
            if (mg >= UMBRAL_CONFIABLE_DB) {
              areaConfiable += areaFila[j];
              if (d > alcanceConfiable) alcanceConfiable = d;
              if (d > rumboConfiable[sector]) rumboConfiable[sector] = d;
            }
          }
        }
      }
      filasHechas++;
      if ((j & 15) === 0) {
        await avisar?.(filasHechas / filasTotales);
        if (ceder && (await ceder())) return null;
      }
    }
    filasHechas = (a + 1) * alto;
    resumen.push({
      id: ant.id,
      nombre: ant.nombre,
      elevacionM: Math.round(suelo),
      areaServicioKm2: areaServicio,
      areaConfiableKm2: areaConfiable,
      alcanceKm: alcance / 1000,
      alcanceConfiableKm: alcanceConfiable / 1000,
      alcanceLimitado: alcance >= radioM - 1.5 * malla.celdaM,
      porcentajeCirculo: (100 * areaServicio) / (Math.PI * p.radioKm * p.radioKm),
      porcentajeMejorServidor: 0,
      presupuestoDb: presupuesto,
      pireDbm: ant.potenciaDbm + ant.gananciaDbi - ant.perdidaCableDb,
      alcancePorRumbo: Array.from(rumbo, (x) => Math.round(x) / 1000),
      alcanceConfiablePorRumbo: Array.from(rumboConfiable, (x) => Math.round(x) / 1000),
    });
  }

  // Estadísticas combinadas
  const areaPorClase: AreaPorClase = { buena: 0, estable: 0, media: 0, baja: 0, sin: 0 };
  const claves = ["buena", "estable", "media", "baja", "sin"] as const;
  const mejorServidor = new Float64Array(antenas.length);
  let areaEstudio = 0;
  let areaRespaldo = 0;
  for (let j = 0; j < alto; j++) {
    const fila = j * ancho;
    const ac = areaFila[j];
    for (let i = 0; i < ancho; i++) {
      const c = fila + i;
      const mg = mejor[c];
      if (mg === -Infinity) {
        mejor[c] = Number.NaN;
        segundo[c] = Number.NaN;
        continue;
      }
      if (segundo[c] === -Infinity) segundo[c] = Number.NaN;
      areaEstudio += ac;
      areaPorClase[claves[indiceClase(mg)]] += ac;
      if (segundo[c] >= UMBRAL_CONFIABLE_DB) areaRespaldo += ac;
      if (mg >= UMBRAL_SERVICIO_DB) mejorServidor[servidor[c]] += ac;
    }
  }
  resumen.forEach((r, k) => (r.porcentajeMejorServidor = areaEstudio > 0 ? (100 * mejorServidor[k]) / areaEstudio : 0));
  const pct = (x: number) => (areaEstudio > 0 ? (100 * x) / areaEstudio : 0);
  return {
    mejor,
    segundo,
    servidor,
    servidores,
    porAntena,
    antenas: resumen,
    areaEstudioKm2: areaEstudio,
    areaPorClase,
    porcentajeServicio: pct(areaPorClase.buena + areaPorClase.estable + areaPorClase.media + areaPorClase.baja),
    porcentajeConfiable: pct(areaPorClase.buena + areaPorClase.estable),
    porcentajeRespaldo: pct(areaRespaldo),
  };
}
