// Convierte el resultado de la simulación en una imagen RGBA para superponer en el mapa.
import { CLASES } from "@/lib/radio/constantes";
import type { ResultadoSimulacion } from "@/lib/radio/tipos";
import type { EscalaSenal, ModoMapa, Vista } from "./estado";

/** Arcoíris de Radio Mobile: de violeta (señal débil) a rojo (señal fuerte). */
export const ARCOIRIS = ["#5B2C83", "#2F6DB5", "#1F9C99", "#57B65A", "#F5D33B", "#F08A2C", "#D93A2E"];
/** Color de las zonas por debajo del nivel mínimo en el arcoíris (el rojo ahí significa señal fuerte). */
export const COLOR_BAJO_ESCALA = "#5F6B6D";
export const COLORES_UMBRAL = [
  { color: "#1E7B34", nombre: "Verde" },
  { color: "#2F6DB5", nombre: "Azul" },
  { color: "#8E57B8", nombre: "Morado" },
  { color: "#F08A2C", nombre: "Naranja" },
];

export type OpcionesEscala = Pick<Vista, "escala" | "escalaMinDbm" | "escalaMaxDbm" | "umbralDbm" | "colorUmbral">;
export const opcionesEscala = (v: Vista): OpcionesEscala => ({ escala: v.escala, escalaMinDbm: v.escalaMinDbm, escalaMaxDbm: v.escalaMaxDbm, umbralDbm: v.umbralDbm, colorUmbral: v.colorUmbral });

/** Colores para distinguir antenas en el modo «mejor antena» (fuera de la paleta de señal). */
export const COLORES_ANTENA = ["#2F6DB5", "#8E57B8", "#1F9C99", "#C04F7C", "#5A6FD8", "#A8792A", "#3D8F5A", "#D0662F", "#6B7686", "#B23A48"];

export const COLORES_REDUNDANCIA = [
  { n: 0, nombre: "Sin servicio", color: "#D93A2E" },
  { n: 1, nombre: "1 antena", color: "#F5D33B" },
  { n: 2, nombre: "2 antenas", color: "#8BD17C" },
  { n: 3, nombre: "3 o más", color: "#1E7B34" },
];

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const PALETA_CLASES = CLASES.map((c) => rgb(c.color));
const PALETA_ARCOIRIS = ARCOIRIS.map(rgb);
const BAJO_ESCALA = rgb(COLOR_BAJO_ESCALA);

/** Color del arcoíris para t entre 0 (débil) y 1 (fuerte), interpolado. */
export function colorArcoiris(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (PALETA_ARCOIRIS.length - 1);
  const i = Math.min(PALETA_ARCOIRIS.length - 2, Math.floor(x));
  const f = x - i;
  const a = PALETA_ARCOIRIS[i];
  const b = PALETA_ARCOIRIS[i + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}
/** Tabla de 256 colores del arcoíris (evita interpolar en cada celda). */
const TABLA_ARCOIRIS = Array.from({ length: 256 }, (_, i) => colorArcoiris(i / 255));
const PALETA_ANTENAS = COLORES_ANTENA.map(rgb);
const PALETA_REDUNDANCIA = COLORES_REDUNDANCIA.map((c) => rgb(c.color));

/**
 * Pinta la cobertura. Con `soloIndice` se pinta únicamente la antena de ese índice (en el orden de
 * `r.antenas`) a partir de su margen propio por celda.
 */
export function pintarCobertura(
  r: ResultadoSimulacion,
  modo: ModoMapa,
  mostrarSinServicio: boolean,
  lienzo?: HTMLCanvasElement,
  soloIndice?: number,
  opciones?: OpcionesEscala,
): HTMLCanvasElement {
  const { ancho, alto } = r.malla;
  const c = lienzo ?? document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const img = ctx.createImageData(ancho, alto);
  const px = img.data;
  const total = ancho * alto;
  const solo = soloIndice !== undefined && soloIndice >= 0 && r.porAntena?.length >= (soloIndice + 1) * total ? soloIndice * total : -1;
  // Escala del modo «Señal»: los niveles en dBm se pasan a margen con la sensibilidad de la simulación
  const escala: EscalaSenal = modo === "senal" && opciones && Number.isFinite(r.sensibilidadDbm) ? opciones.escala : "clases";
  const s = r.sensibilidadDbm;
  const minimo = escala === "arcoiris" ? (opciones?.escalaMinDbm ?? -121) - s : escala === "umbral" ? (opciones?.umbralDbm ?? -111) - s : 20;
  const rango = escala === "arcoiris" ? Math.max(1, (opciones?.escalaMaxDbm ?? -71) - s - minimo) : 1;
  const colorUmbral = rgb(opciones?.colorUmbral ?? "#1E7B34");
  for (let k = 0; k < total; k++) {
    let m: number;
    if (solo >= 0) {
      const v = r.porAntena[solo + k];
      if (v === -128) continue; // fuera del radio de esa antena
      m = v;
    } else {
      m = r.mejor[k];
      if (m !== m) continue; // NaN: fuera del área de estudio
    }
    let color: [number, number, number];
    let alfa = 255;
    const sinServicio = m < (modo === "senal" ? minimo : 20);
    if (sinServicio) {
      if (!mostrarSinServicio) continue;
      color = escala === "arcoiris" ? BAJO_ESCALA : PALETA_CLASES[4];
      alfa = 120;
    } else if (modo === "senal") color = escala === "clases" ? PALETA_CLASES[m >= 45 ? 0 : m >= 37 ? 1 : m >= 30 ? 2 : 3] : escala === "umbral" ? colorUmbral : TABLA_ARCOIRIS[Math.min(255, Math.round(((m - minimo) / rango) * 255))];
    else if (modo === "servidor") color = PALETA_ANTENAS[(solo >= 0 ? (soloIndice ?? 0) : r.servidor[k]) % PALETA_ANTENAS.length];
    else color = PALETA_REDUNDANCIA[solo >= 0 ? 1 : Math.min(3, r.servidores[k])];
    const o = k * 4;
    px[o] = color[0];
    px[o + 1] = color[1];
    px[o + 2] = color[2];
    px[o + 3] = alfa;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Esquinas de la imagen para la fuente «image» de MapLibre (NO, NE, SE, SO). */
export function esquinas(r: ResultadoSimulacion): [[number, number], [number, number], [number, number], [number, number]] {
  const { oeste, este, norte, sur } = r.malla.caja;
  return [
    [oeste, norte],
    [este, norte],
    [este, sur],
    [oeste, sur],
  ];
}
