// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Parámetros de red como en Radio Mobile: clima, polarización, suelo, refractividad y confiabilidad estadística.
// El modelo calibrado se ajustó con los valores de referencia de las pruebas de Radio Mobile; cuando el usuario
// cambia alguno, la diferencia que predice Longley-Rice (ITM) entre sus valores y los de referencia se suma
// al modelo calibrado, trayecto por trayecto. Con los valores de referencia el resultado no cambia.
import { porTexto, tx } from "../idioma";
import { CLIMAS, itmDosEstadisticas, itmPuntoAPunto, type ClimaItm, type ModoVariabilidad, type SalidaItm } from "./itm";
import type { ModeloId, Parametros, PolarizacionId, SueloId, VariabilidadId } from "./tipos";

export { CLIMAS };

/** Suelo con su nombre en los dos idiomas (getter: sale en el idioma de la pantalla). */
const nuevoSuelo = (id: Exclude<SueloId, "personalizado">, es: string, en: string, permitividad: number, conductividad: number) => ({
  id,
  get nombre() {
    return tx(es, en);
  },
  permitividad,
  conductividad,
});
export const SUELOS: readonly { id: Exclude<SueloId, "personalizado">; nombre: string; permitividad: number; conductividad: number }[] = [
  nuevoSuelo("promedio", "Promedio", "Average", 15, 0.005),
  nuevoSuelo("pobre", "Seco o arenoso", "Dry or sandy", 4, 0.001),
  nuevoSuelo("bueno", "Húmedo o fértil", "Wet or fertile", 25, 0.02),
  nuevoSuelo("agua-dulce", "Agua dulce", "Fresh water", 80, 0.01),
  nuevoSuelo("mar", "Agua de mar", "Sea water", 80, 5),
];

/** Modo estadístico con su nombre y su descripción en los dos idiomas. */
const nuevaVariabilidad = (id: VariabilidadId, nombre: [string, string], codigo: ModoVariabilidad, descripcion: [string, string]) => ({
  id,
  get nombre() {
    return tx(nombre[0], nombre[1]);
  },
  codigo,
  get descripcion() {
    return tx(descripcion[0], descripcion[1]);
  },
});
export const VARIABILIDADES: readonly { id: VariabilidadId; nombre: string; codigo: ModoVariabilidad; descripcion: string }[] = [
  nuevaVariabilidad("puntual", ["Puntual (spot)", "Spot"], 0, ["Un mensaje de prueba: tiempo, ubicación y situación se combinan en un solo porcentaje.", "A test message: time, location and situation are combined into a single percentage."]),
  nuevaVariabilidad("accidental", ["Accidental", "Accidental"], 1, ["Señales que interesan solo a ratos (interferencias).", "Signals that matter only now and then (interference)."]),
  nuevaVariabilidad("movil", ["Móvil", "Mobile"], 2, ["Equipos que se desplazan: tiempo y ubicación van juntos. Es el modo de las pruebas de Radio Mobile.", "Devices on the move: time and location go together. This is the mode used in the Radio Mobile tests."]),
  nuevaVariabilidad("difusion", ["Difusión (broadcast)", "Broadcast"], 3, ["Receptores fijos en muchos lugares: tiempo, ubicación y situación por separado.", "Fixed receivers in many places: time, location and situation taken separately."]),
];

/** Niveles de confiabilidad sencillos (los porcentajes se pueden ajustar uno por uno). */
export const CONFIABILIDADES = [
  {
    id: "normal",
    get nombre() {
      return tx("Normal", "Normal");
    },
    tiempoPct: 50,
    ubicacionesPct: 50,
    situacionesPct: 70,
    get descripcion() {
      return tx("La de las pruebas de Radio Mobile (50 % del tiempo, 70 % de las situaciones).", "The one used in the Radio Mobile tests (50% of the time, 70% of situations).");
    },
  },
  {
    id: "alta",
    get nombre() {
      return tx("Alta", "High");
    },
    tiempoPct: 90,
    ubicacionesPct: 90,
    situacionesPct: 90,
    get descripcion() {
      return tx("La señal se cumple el 90 % del tiempo y de las situaciones.", "The signal holds 90% of the time and in 90% of situations.");
    },
  },
  {
    id: "muy-alta",
    get nombre() {
      return tx("Muy alta", "Very high");
    },
    tiempoPct: 99,
    ubicacionesPct: 99,
    situacionesPct: 99,
    get descripcion() {
      return tx("Para alarmas o telemetría crítica: 99 %.", "For alarms or critical telemetry: 99%.");
    },
  },
] as const;
export type ConfiabilidadId = (typeof CONFIABILIDADES)[number]["id"] | "personalizada";

/** Parámetros de las simulaciones de Radio Mobile con las que se calibró el modelo. */
export const RED_REFERENCIA = {
  polarizacion: "vertical" as PolarizacionId,
  clima: 1 as ClimaItm,
  refractividad: 360,
  suelo: "promedio" as SueloId,
  permitividad: 15,
  conductividad: 0.005,
  variabilidad: "movil" as VariabilidadId,
  tiempoPct: 50,
  ubicacionesPct: 50,
  situacionesPct: 70,
};

/** Completa los parámetros de red que falten (escenarios de versiones anteriores) con los de referencia. */
export function completarParametros(p: Parametros): Parametros {
  const q = { modelo: "calibrado" as ModeloId, ...RED_REFERENCIA, entorno: "abierto" as const } as Partial<Parametros>;
  for (const [k, v] of Object.entries(p)) if (v !== undefined) (q as Record<string, unknown>)[k] = v;
  return q as Parametros;
}

export type ParametrosRed = Pick<
  Parametros,
  "polarizacion" | "clima" | "refractividad" | "permitividad" | "conductividad" | "variabilidad" | "tiempoPct" | "ubicacionesPct" | "situacionesPct"
>;

const casi = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** True si los parámetros de red son los de la referencia (el modelo calibrado se usa sin ajuste). */
export function esReferencia(p: ParametrosRed): boolean {
  const r = RED_REFERENCIA;
  return (
    p.polarizacion === r.polarizacion &&
    p.clima === r.clima &&
    casi(p.refractividad, r.refractividad) &&
    casi(p.permitividad, r.permitividad) &&
    casi(p.conductividad, r.conductividad) &&
    p.variabilidad === r.variabilidad &&
    casi(p.tiempoPct, r.tiempoPct) &&
    casi(p.situacionesPct, r.situacionesPct) &&
    // En modo móvil el ITM usa el porcentaje de tiempo también para las ubicaciones
    (p.variabilidad === "movil" || casi(p.ubicacionesPct, r.ubicacionesPct))
  );
}

export function confiabilidadDe(p: Pick<Parametros, "tiempoPct" | "ubicacionesPct" | "situacionesPct" | "variabilidad">): ConfiabilidadId {
  const usa = camposVariabilidad(p.variabilidad);
  for (const c of CONFIABILIDADES) {
    if ((!usa.tiempo || casi(p.tiempoPct, c.tiempoPct)) && casi(p.situacionesPct, c.situacionesPct) && (!usa.ubicaciones || casi(p.ubicacionesPct, c.ubicacionesPct))) return c.id;
  }
  return "personalizada";
}

/** Porcentajes que intervienen en cada modo (el ITM combina los demás). */
export function camposVariabilidad(id: VariabilidadId): { tiempo: boolean; ubicaciones: boolean; situaciones: boolean } {
  return { tiempo: id !== "puntual", ubicaciones: id === "difusion", situaciones: true };
}

export const codigoVariabilidad = (id: VariabilidadId): ModoVariabilidad => VARIABILIDADES.find((v) => v.id === id)?.codigo ?? 2;

/** Texto corto con los parámetros de red (para informes y para Melki). */
export function resumenRed(p: Parametros): string {
  const minuscula = (t: string) => porTexto(t, (x) => x.toLowerCase());
  const clima = CLIMAS.find((c) => c.id === p.clima)?.nombre ?? "—";
  const nombreSuelo = SUELOS.find((s) => s.id === p.suelo)?.nombre;
  const sueloMin = nombreSuelo === undefined ? undefined : minuscula(nombreSuelo);
  const suelo =
    p.suelo === "personalizado"
      ? tx(`suelo εr ${fmt(p.permitividad)} / σ ${fmt(p.conductividad, 3)} S/m`, `ground: εr ${fmt(p.permitividad)} / σ ${fmt(p.conductividad, 3)} S/m`)
      : tx(`suelo ${sueloMin}`, `ground: ${sueloMin}`);
  const nombreV = VARIABILIDADES.find((x) => x.id === p.variabilidad)?.nombre;
  const v = nombreV === undefined ? "" : minuscula(nombreV);
  const usa = camposVariabilidad(p.variabilidad);
  const pct = [
    usa.tiempo ? tx(`${fmt(p.tiempoPct)} % del tiempo`, `${fmt(p.tiempoPct)}% of the time`) : "",
    usa.ubicaciones ? tx(`${fmt(p.ubicacionesPct)} % de las ubicaciones`, `${fmt(p.ubicacionesPct)}% of locations`) : "",
    tx(`${fmt(p.situacionesPct)} % de las situaciones`, `${fmt(p.situacionesPct)}% of situations`),
  ]
    .filter(Boolean)
    .join(", ");
  return tx(
    `Clima ${minuscula(clima)}, polarización ${p.polarizacion}, ${suelo}, N = ${fmt(p.refractividad)}, modo ${v} (${pct})`,
    `Climate: ${minuscula(clima)}, ${p.polarizacion} polarization, ${suelo}, N = ${fmt(p.refractividad)}, ${v} mode (${pct})`,
  );
}

/** Número con hasta `d` decimales y el separador decimal del idioma. */
function fmt(n: number, d = 1) {
  const s = Number(n.toFixed(d)).toString();
  return tx(s.replace(".", ","), s);
}

/** Recorta un porcentaje al rango que admite el ITM. */
const pct = (x: number) => Math.min(99.9, Math.max(0.1, x));

export type CalculoRed = {
  /** Hay que muestrear el perfil completo del trayecto (Longley-Rice puro o parámetros distintos de la referencia). */
  necesitaPerfil: boolean;
  modelo: ModeloId;
  /** Predicción ITM con los parámetros de la red sobre un perfil de `n` puntos. */
  itm: (elev: ArrayLike<number>, n: number, distanciaM: number, alturaTxM: number, alturaRxM: number) => SalidaItm;
  /** Diferencia ITM(parámetros) − ITM(referencia) en dB; 0 con los valores de referencia. */
  ajuste: (elev: ArrayLike<number>, n: number, distanciaM: number, alturaTxM: number, alturaRxM: number) => number;
};

export function calculoRed(p: Parametros): CalculoRed {
  const referencia = esReferencia(p);
  const base = (q: ParametrosRed) => ({
    frecuenciaMhz: p.frecuenciaMhz,
    polarizacion: (q.polarizacion === "vertical" ? 1 : 0) as 0 | 1,
    permitividad: q.permitividad,
    conductividad: q.conductividad,
    refractividad: q.refractividad,
    clima: q.clima,
    modo: codigoVariabilidad(q.variabilidad),
    tiempo: pct(q.tiempoPct),
    ubicaciones: pct(q.ubicacionesPct),
    situaciones: pct(q.situacionesPct),
  });
  const propios = base(p);
  const deReferencia = base(RED_REFERENCIA);
  const itm = (elev: ArrayLike<number>, n: number, distanciaM: number, alturaTxM: number, alturaRxM: number) =>
    itmPuntoAPunto({ ...propios, elev, n, distanciaM, alturaTxM, alturaRxM });
  // Si solo cambia la estadística (clima, modo, porcentajes), la parte determinística se comparte
  const mismaElectrica =
    propios.polarizacion === deReferencia.polarizacion &&
    casi(propios.permitividad, deReferencia.permitividad) &&
    casi(propios.conductividad, deReferencia.conductividad) &&
    casi(propios.refractividad, deReferencia.refractividad);
  const ajuste: CalculoRed["ajuste"] = referencia
    ? () => 0
    : mismaElectrica
      ? (elev, n, distanciaM, alturaTxM, alturaRxM) => {
          const [a, b] = itmDosEstadisticas({ ...propios, elev, n, distanciaM, alturaTxM, alturaRxM }, deReferencia);
          return a - b;
        }
      : (elev, n, distanciaM, alturaTxM, alturaRxM) =>
          itm(elev, n, distanciaM, alturaTxM, alturaRxM).perdidaDb - itmPuntoAPunto({ ...deReferencia, elev, n, distanciaM, alturaTxM, alturaRxM }).perdidaDb;
  return { necesitaPerfil: p.modelo === "itm" || !referencia, modelo: p.modelo, itm, ajuste };
}
