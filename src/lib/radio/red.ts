// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Parámetros de red como en Radio Mobile: clima, polarización, suelo, refractividad y confiabilidad estadística.
// El modelo calibrado se ajustó con los valores de referencia de las pruebas de Radio Mobile; cuando el usuario
// cambia alguno, la diferencia que predice Longley-Rice (ITM) entre sus valores y los de referencia se suma
// al modelo calibrado, trayecto por trayecto. Con los valores de referencia el resultado no cambia.
import { CLIMAS, itmDosEstadisticas, itmPuntoAPunto, type ClimaItm, type ModoVariabilidad, type SalidaItm } from "./itm";
import type { ModeloId, Parametros, PolarizacionId, SueloId, VariabilidadId } from "./tipos";

export { CLIMAS };

export const SUELOS: readonly { id: Exclude<SueloId, "personalizado">; nombre: string; permitividad: number; conductividad: number }[] = [
  { id: "promedio", nombre: "Promedio", permitividad: 15, conductividad: 0.005 },
  { id: "pobre", nombre: "Seco o arenoso", permitividad: 4, conductividad: 0.001 },
  { id: "bueno", nombre: "Húmedo o fértil", permitividad: 25, conductividad: 0.02 },
  { id: "agua-dulce", nombre: "Agua dulce", permitividad: 80, conductividad: 0.01 },
  { id: "mar", nombre: "Agua de mar", permitividad: 80, conductividad: 5 },
];

export const VARIABILIDADES: readonly { id: VariabilidadId; nombre: string; codigo: ModoVariabilidad; descripcion: string }[] = [
  { id: "puntual", nombre: "Puntual (spot)", codigo: 0, descripcion: "Un mensaje de prueba: tiempo, ubicación y situación se combinan en un solo porcentaje." },
  { id: "accidental", nombre: "Accidental", codigo: 1, descripcion: "Señales que interesan solo a ratos (interferencias)." },
  { id: "movil", nombre: "Móvil", codigo: 2, descripcion: "Equipos que se desplazan: tiempo y ubicación van juntos. Es el modo de las pruebas de Radio Mobile." },
  { id: "difusion", nombre: "Difusión (broadcast)", codigo: 3, descripcion: "Receptores fijos en muchos lugares: tiempo, ubicación y situación por separado." },
];

/** Niveles de confiabilidad sencillos (los porcentajes se pueden ajustar uno por uno). */
export const CONFIABILIDADES = [
  { id: "normal", nombre: "Normal", tiempoPct: 50, ubicacionesPct: 50, situacionesPct: 70, descripcion: "La de las pruebas de Radio Mobile (50 % del tiempo, 70 % de las situaciones)." },
  { id: "alta", nombre: "Alta", tiempoPct: 90, ubicacionesPct: 90, situacionesPct: 90, descripcion: "La señal se cumple el 90 % del tiempo y de las situaciones." },
  { id: "muy-alta", nombre: "Muy alta", tiempoPct: 99, ubicacionesPct: 99, situacionesPct: 99, descripcion: "Para alarmas o telemetría crítica: 99 %." },
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
  const clima = CLIMAS.find((c) => c.id === p.clima)?.nombre ?? "—";
  const suelo = p.suelo === "personalizado" ? `suelo εr ${fmt(p.permitividad)} / σ ${fmt(p.conductividad, 3)} S/m` : `suelo ${SUELOS.find((s) => s.id === p.suelo)?.nombre.toLowerCase()}`;
  const v = VARIABILIDADES.find((x) => x.id === p.variabilidad)?.nombre.toLowerCase() ?? "";
  const usa = camposVariabilidad(p.variabilidad);
  const pct = [
    usa.tiempo ? `${fmt(p.tiempoPct)} % del tiempo` : "",
    usa.ubicaciones ? `${fmt(p.ubicacionesPct)} % de las ubicaciones` : "",
    `${fmt(p.situacionesPct)} % de las situaciones`,
  ]
    .filter(Boolean)
    .join(", ");
  return `Clima ${clima.toLowerCase()}, polarización ${p.polarizacion}, ${suelo}, N = ${fmt(p.refractividad)}, modo ${v} (${pct})`;
}

function fmt(n: number, d = 1) {
  return Number(n.toFixed(d)).toString().replace(".", ",");
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
