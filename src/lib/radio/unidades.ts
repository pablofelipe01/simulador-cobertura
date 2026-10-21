// Conversión del nivel de señal entre unidades, como en Radio Mobile.
// El margen es la señal sobre la sensibilidad: nivel (dBm) = margen + sensibilidad.
// Tensión sobre 50 Ω: dBµV = dBm + 107 y µV = 10^(dBµV/20).
// Campo eléctrico: E (dBµV/m) = P (dBm) − G (dBi) + 20·log10 f (MHz) + 77,2.

export type UnidadId = "margen" | "dbm" | "uv" | "dbuvm";

export const UNIDADES: readonly { id: UnidadId; nombre: string; corto: string; descripcion: string }[] = [
  { id: "margen", nombre: "Margen (dB)", corto: "dB", descripcion: "Cuánto sobra sobre la sensibilidad del receptor." },
  { id: "dbm", nombre: "Potencia (dBm)", corto: "dBm", descripcion: "Potencia que llega al receptor." },
  { id: "uv", nombre: "Tensión (µV)", corto: "µV", descripcion: "Tensión en la entrada del receptor (50 Ω)." },
  { id: "dbuvm", nombre: "Campo (dBµV/m)", corto: "dBµV/m", descripcion: "Intensidad de campo eléctrico en el lugar." },
];

export type Receptor = { sensibilidadDbm: number; gananciaRxDbi: number; frecuenciaMhz: number };

export const dbmAUv = (dbm: number) => 10 ** ((dbm + 107) / 20);
export const uvADbm = (uv: number) => 20 * Math.log10(Math.max(uv, 1e-9)) - 107;
export const dbmADbuvm = (dbm: number, gananciaDbi: number, frecuenciaMhz: number) => dbm - gananciaDbi + 20 * Math.log10(frecuenciaMhz) + 77.2;

/** Valor en la unidad pedida a partir del nivel en dBm. */
export function desdeDbm(dbm: number, unidad: UnidadId, r: Receptor): number {
  switch (unidad) {
    case "margen":
      return dbm - r.sensibilidadDbm;
    case "dbm":
      return dbm;
    case "uv":
      return dbmAUv(dbm);
    case "dbuvm":
      return dbmADbuvm(dbm, r.gananciaRxDbi, r.frecuenciaMhz);
  }
}

/** Nivel en dBm a partir de un valor en la unidad indicada. */
export function aDbm(valor: number, unidad: UnidadId, r: Receptor): number {
  switch (unidad) {
    case "margen":
      return valor + r.sensibilidadDbm;
    case "dbm":
      return valor;
    case "uv":
      return uvADbm(valor);
    case "dbuvm":
      return valor + r.gananciaRxDbi - 20 * Math.log10(r.frecuenciaMhz) - 77.2;
  }
}

/** Decimales razonables para mostrar un valor en la unidad indicada. */
export function decimalesUnidad(v: number, unidad: UnidadId, decimales = 1): number {
  if (unidad !== "uv") return decimales;
  const a = Math.abs(v);
  return a < 1 ? 3 : a < 10 ? 2 : a < 100 ? 1 : 0;
}

/** Texto del valor con su unidad, con coma decimal (−0 se muestra como 0). */
export function textoNivel(dbm: number, unidad: UnidadId, r: Receptor, decimales = 1): string {
  const v = desdeDbm(dbm, unidad, r);
  const u = UNIDADES.find((x) => x.id === unidad)!.corto;
  const t = v.toFixed(decimalesUnidad(v, unidad, decimales));
  return `${(Number(t) === 0 ? t.replace("-", "") : t).replace(".", ",")} ${u}`;
}
