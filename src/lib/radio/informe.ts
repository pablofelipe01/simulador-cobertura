// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Informe de radioenlace en texto (para copiar, descargar o leer en el chat), al estilo de «Radio Link» de Radio Mobile.
// Sale en el idioma de la pantalla (o con los dos textos marcados, si se arma en el motor).
import { tx } from "../idioma";
import { CLASES } from "./constantes";
import { rumboTexto } from "./geo";
import type { InformeEnlace } from "./tipos";
import { dbmADbuvm, dbmAUv } from "./unidades";

const f = (n: number, d = 1) => {
  if (!Number.isFinite(n)) return "—";
  const s = (Math.abs(n) < 0.5 * 10 ** -d ? 0 : n).toFixed(d);
  return tx(s.replace(".", ","), s);
};
const signo = (n: number, d = 1) => `${n > 0 ? "+" : ""}${f(n, d)}`;

export const MODOS_ITM: Record<InformeEnlace["itm"]["modo"], string> = {
  get "linea-vista"() {
    return tx("línea de vista", "line of sight");
  },
  get difraccion() {
    return tx("difracción", "diffraction");
  },
  get dispersion() {
    return tx("dispersión troposférica", "tropospheric scatter");
  },
};

/** Intensidad de campo en el receptor (dBµV/m), con la ganancia efectiva de su antena hacia el transmisor. */
export function campoInforme(i: InformeEnlace): number {
  const enAntena = i.nivelDbm + i.perdidaCableRxDb + i.perdidaExtraRxDb;
  return dbmADbuvm(enAntena, i.gananciaRxDbi - i.patronRxDb, i.frecuenciaMhz);
}

export function textoFresnel(i: InformeEnlace): string {
  return tx(
    `${f(i.peorFresnel, 1)} F1 a ${f(i.peorFresnelKm, 2)} km (${i.lineaVista ? "despejada" : i.peorFresnel >= 0 ? "parcialmente obstruida" : "obstruida"})`,
    `${f(i.peorFresnel, 1)} F1 at ${f(i.peorFresnelKm, 2)} km (${i.lineaVista ? "clear" : i.peorFresnel >= 0 ? "partially obstructed" : "obstructed"})`,
  );
}

export function textoUv(dbm: number): string {
  const uv = dbmAUv(dbm);
  return `${f(uv, uv < 1 ? 3 : uv < 10 ? 2 : 1)} µV`;
}

export function nombreModelo(i: InformeEnlace): string {
  return i.modelo === "itm"
    ? "Longley-Rice (ITM 1.2.2)"
    : i.ajusteRedDb !== 0
      ? tx("Calibrado contra Radio Mobile, con ajuste Longley-Rice por los parámetros de red", "Calibrated against Radio Mobile, with a Longley-Rice adjustment for the network parameters")
      : tx("Calibrado contra Radio Mobile", "Calibrated against Radio Mobile");
}

/**
 * Informe completo en texto plano. Las etiquetas van en parejas (español, inglés) para alinear la columna con el
 * ancho de cada idioma: así sirve en la interfaz y también con los textos marcados del motor.
 */
export function textoInforme(i: InformeEnlace, fecha = new Date()): string {
  const clase = CLASES.find((c) => c.id === i.clase)?.nombre ?? "";
  const filas: [[string, string] | null, string][] = [];
  const seccion = (es: string, en: string) => filas.push([null, ""], [[es.toUpperCase(), en.toUpperCase()], ""]);
  const fila = (es: string, en: string, b: string) => filas.push([[es, en], b]);
  seccion("Geometría", "Geometry");
  fila("Distancia", "Distance", `${f(i.distanciaKm, 3)} km`);
  fila("Azimut de ida / de vuelta", "Azimuth forward / reverse", `${rumboTexto(i.rumboIdaDeg)} / ${rumboTexto(i.rumboVueltaDeg)}`);
  fila("Ángulo de elevación de ida / de vuelta", "Elevation angle forward / reverse", `${f(i.elevacionIdaDeg, 2)}° / ${f(i.elevacionVueltaDeg, 2)}°`);
  fila("Elevación del suelo (origen / destino)", "Ground elevation (origin / destination)", `${f(i.sueloOrigenM, 0)} m / ${f(i.sueloDestinoM, 0)} m`);
  fila("Altura de antena (origen / destino)", "Antenna height (origin / destination)", `${f(i.alturaOrigenM)} m / ${f(i.alturaDestinoM)} m`);
  fila("Peor despeje de Fresnel", "Worst Fresnel clearance", textoFresnel(i));
  seccion("Potencias y antenas", "Power and antennas");
  fila("Potencia del transmisor", "Transmitter power", `${f(i.potenciaTxDbm)} dBm (${f(10 ** (i.potenciaTxDbm / 10), 1)} mW)`);
  fila("Pérdida de cable en el transmisor", "Transmitter cable loss", `${f(i.perdidaCableTxDb)} dB`);
  fila(
    "Ganancia de antena del transmisor",
    "Transmitter antenna gain",
    `${f(i.gananciaTxDbi)} dBi${i.patronTxDb > 0.05 ? tx(` (${f(-i.patronTxDb)} dB por el patrón hacia el destino)`, ` (${f(-i.patronTxDb)} dB from the pattern toward the destination)`) : ""}`,
  );
  fila("Potencia radiada (PIRE)", "Radiated power (EIRP)", `${f(i.pireDbm)} dBm`);
  fila(
    "Ganancia de antena del receptor",
    "Receiver antenna gain",
    `${f(i.gananciaRxDbi)} dBi${i.patronRxDb > 0.05 ? tx(` (${f(-i.patronRxDb)} dB por el patrón hacia el origen)`, ` (${f(-i.patronRxDb)} dB from the pattern toward the origin)`) : ""}`,
  );
  fila("Pérdida de cable en el receptor", "Receiver cable loss", `${f(i.perdidaCableRxDb)} dB`);
  if (i.perdidaExtraRxDb > 0) fila("Pérdida adicional del receptor", "Additional receiver loss", `${f(i.perdidaExtraRxDb)} dB`);
  seccion("Pérdidas del trayecto", "Path losses");
  fila("Espacio libre", "Free space", `${f(i.espacioLibreDb)} dB`);
  if (i.modelo === "itm") fila("Atenuación por el terreno (ITM)", "Terrain attenuation (ITM)", `${f(i.obstruccionDb)} dB`);
  else fila("Obstrucción del terreno", "Terrain obstruction", `${f(i.obstruccionDb)} dB`);
  if (i.modelo === "itm") fila("Variabilidad estadística (ITM)", "Statistical variability (ITM)", `${f(i.estadisticaDb)} dB`);
  else fila("Pérdida estadística calibrada", "Calibrated statistical loss", `${f(i.estadisticaDb)} dB`);
  if (i.modelo !== "itm") fila("Ajuste por parámetros de red", "Network parameter adjustment", `${signo(i.ajusteRedDb)} dB`);
  fila("Entorno (vegetación o edificios)", "Environment (vegetation or buildings)", `${f(i.entornoDb)} dB`);
  fila("Pérdida total", "Total loss", `${f(i.perdidaTotalDb)} dB`);
  fila(
    "Longley-Rice de referencia",
    "Reference Longley-Rice",
    `${f(i.itm.perdidaDb)} dB, ${MODOS_ITM[i.itm.modo]}${i.itm.aviso > 0 ? tx(` (aviso ${i.itm.aviso}: parámetros fuera del rango recomendado del modelo)`, ` (warning ${i.itm.aviso}: parameters outside the model's recommended range)`) : ""}`,
  );
  seccion("Recepción", "Reception");
  fila("Nivel recibido", "Received level", `${f(i.nivelDbm)} dBm = ${textoUv(i.nivelDbm)} = ${f(campoInforme(i))} dBµV/m`);
  fila("Sensibilidad del receptor", "Receiver sensitivity", `${f(i.sensibilidadDbm)} dBm`);
  fila("Margen", "Margin", `${f(i.margenDb)} dB (${clase})`);
  // El ancho de la columna de etiquetas en cada idioma
  const anchoEs = Math.max(...filas.map(([a]) => (a ? a[0].length : 0)));
  const anchoEn = Math.max(...filas.map(([a]) => (a ? a[1].length : 0)));
  const cuerpo = filas.map(([a, b]) => (!a ? "" : b ? `${tx(a[0].padEnd(anchoEs + 2, " "), a[1].padEnd(anchoEn + 2, " "))}${b}` : tx(a[0], a[1]))).join("\n");
  const opciones: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" };
  const fechaTexto = tx(fecha.toLocaleString("es-CO", opciones), fecha.toLocaleString("en-US", opciones));
  return [
    tx("INFORME DE RADIOENLACE", "RADIO LINK REPORT"),
    `${i.origen} → ${i.destino}`,
    tx(`Fecha: ${fechaTexto}`, `Date: ${fechaTexto}`),
    tx(`Frecuencia: ${f(i.frecuenciaMhz, 3)} MHz`, `Frequency: ${f(i.frecuenciaMhz, 3)} MHz`),
    tx(`Modelo: ${nombreModelo(i)}`, `Model: ${nombreModelo(i)}`),
    tx(`Parámetros de red: ${i.parametrosTexto}`, `Network parameters: ${i.parametrosTexto}`),
    cuerpo,
    "",
    tx("Relieve con curvatura terrestre de radio efectivo 4/3. Nivel de tensión sobre 50 Ω.", "Terrain with Earth curvature for an effective radius factor of 4/3. Voltage level across 50 Ω."),
  ].join("\n");
}
