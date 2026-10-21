// Informe de radioenlace en texto (para copiar, descargar o leer en el chat), al estilo de «Radio Link» de Radio Mobile.
import { CLASES } from "./constantes";
import { rumboTexto } from "./geo";
import type { InformeEnlace } from "./tipos";
import { dbmADbuvm, dbmAUv } from "./unidades";

const f = (n: number, d = 1) => (Number.isFinite(n) ? (Math.abs(n) < 0.5 * 10 ** -d ? 0 : n).toFixed(d).replace(".", ",") : "—");
const signo = (n: number, d = 1) => `${n > 0 ? "+" : ""}${f(n, d)}`;

export const MODOS_ITM: Record<InformeEnlace["itm"]["modo"], string> = { "linea-vista": "línea de vista", difraccion: "difracción", dispersion: "dispersión troposférica" };

/** Intensidad de campo en el receptor (dBµV/m), con la ganancia efectiva de su antena hacia el transmisor. */
export function campoInforme(i: InformeEnlace): number {
  const enAntena = i.nivelDbm + i.perdidaCableRxDb + i.perdidaExtraRxDb;
  return dbmADbuvm(enAntena, i.gananciaRxDbi - i.patronRxDb, i.frecuenciaMhz);
}

export function textoFresnel(i: InformeEnlace): string {
  return `${f(i.peorFresnel, 1)} F1 a ${f(i.peorFresnelKm, 2)} km (${i.lineaVista ? "despejada" : i.peorFresnel >= 0 ? "parcialmente obstruida" : "obstruida"})`;
}

export function textoUv(dbm: number): string {
  const uv = dbmAUv(dbm);
  return `${f(uv, uv < 1 ? 3 : uv < 10 ? 2 : 1)} µV`;
}

export function nombreModelo(i: InformeEnlace): string {
  return i.modelo === "itm" ? "Longley-Rice (ITM 1.2.2)" : i.ajusteRedDb !== 0 ? "Calibrado contra Radio Mobile, con ajuste Longley-Rice por los parámetros de red" : "Calibrado contra Radio Mobile";
}

/** Informe completo en texto plano. */
export function textoInforme(i: InformeEnlace, fecha = new Date()): string {
  const clase = CLASES.find((c) => c.id === i.clase)?.nombre ?? "";
  const filas: [string, string][] = [];
  const seccion = (t: string) => filas.push(["", ""], [t.toUpperCase(), ""]);
  const fila = (a: string, b: string) => filas.push([a, b]);
  seccion("Geometría");
  fila("Distancia", `${f(i.distanciaKm, 3)} km`);
  fila("Azimut de ida / de vuelta", `${rumboTexto(i.rumboIdaDeg)} / ${rumboTexto(i.rumboVueltaDeg)}`);
  fila("Ángulo de elevación de ida / de vuelta", `${f(i.elevacionIdaDeg, 2)}° / ${f(i.elevacionVueltaDeg, 2)}°`);
  fila("Elevación del suelo (origen / destino)", `${f(i.sueloOrigenM, 0)} m / ${f(i.sueloDestinoM, 0)} m`);
  fila("Altura de antena (origen / destino)", `${f(i.alturaOrigenM)} m / ${f(i.alturaDestinoM)} m`);
  fila("Peor despeje de Fresnel", textoFresnel(i));
  seccion("Potencias y antenas");
  fila("Potencia del transmisor", `${f(i.potenciaTxDbm)} dBm (${f(10 ** (i.potenciaTxDbm / 10), 1)} mW)`);
  fila("Pérdida de cable en el transmisor", `${f(i.perdidaCableTxDb)} dB`);
  fila("Ganancia de antena del transmisor", `${f(i.gananciaTxDbi)} dBi${i.patronTxDb > 0.05 ? ` (${f(-i.patronTxDb)} dB por el patrón hacia el destino)` : ""}`);
  fila("Potencia radiada (PIRE)", `${f(i.pireDbm)} dBm`);
  fila("Ganancia de antena del receptor", `${f(i.gananciaRxDbi)} dBi${i.patronRxDb > 0.05 ? ` (${f(-i.patronRxDb)} dB por el patrón hacia el origen)` : ""}`);
  fila("Pérdida de cable en el receptor", `${f(i.perdidaCableRxDb)} dB`);
  if (i.perdidaExtraRxDb > 0) fila("Pérdida adicional del receptor", `${f(i.perdidaExtraRxDb)} dB`);
  seccion("Pérdidas del trayecto");
  fila("Espacio libre", `${f(i.espacioLibreDb)} dB`);
  fila(i.modelo === "itm" ? "Atenuación por el terreno (ITM)" : "Obstrucción del terreno", `${f(i.obstruccionDb)} dB`);
  fila(i.modelo === "itm" ? "Variabilidad estadística (ITM)" : "Pérdida estadística calibrada", `${f(i.estadisticaDb)} dB`);
  if (i.modelo !== "itm") fila("Ajuste por parámetros de red", `${signo(i.ajusteRedDb)} dB`);
  fila("Entorno (vegetación o edificios)", `${f(i.entornoDb)} dB`);
  fila("Pérdida total", `${f(i.perdidaTotalDb)} dB`);
  fila("Longley-Rice de referencia", `${f(i.itm.perdidaDb)} dB, ${MODOS_ITM[i.itm.modo]}${i.itm.aviso > 0 ? ` (aviso ${i.itm.aviso}: parámetros fuera del rango recomendado del modelo)` : ""}`);
  seccion("Recepción");
  fila("Nivel recibido", `${f(i.nivelDbm)} dBm = ${textoUv(i.nivelDbm)} = ${f(campoInforme(i))} dBµV/m`);
  fila("Sensibilidad del receptor", `${f(i.sensibilidadDbm)} dBm`);
  fila("Margen", `${f(i.margenDb)} dB (${clase})`);
  const ancho = Math.max(...filas.map(([a]) => a.length));
  const cuerpo = filas.map(([a, b]) => (b ? `${a.padEnd(ancho + 2, " ")}${b}` : a)).join("\n");
  const fechaTexto = fecha.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
  return [
    "INFORME DE RADIOENLACE",
    `${i.origen} → ${i.destino}`,
    `Fecha: ${fechaTexto}`,
    `Frecuencia: ${f(i.frecuenciaMhz, 3)} MHz`,
    `Modelo: ${nombreModelo(i)}`,
    `Parámetros de red: ${i.parametrosTexto}`,
    cuerpo,
    "",
    "Relieve con curvatura terrestre de radio efectivo 4/3. Nivel de tensión sobre 50 Ω.",
  ].join("\n");
}
