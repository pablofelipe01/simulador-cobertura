// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// v17.2 · Lápiz de malla: lo que se dibuja a mano alzada sobre el mapa se vuelve el área donde Melki arma la malla.
// Una figura cerrada (el final vuelve cerca del comienzo, o el trazo se cruza y encierra un lazo) es una zona; un trazo
// abierto es una franja del ancho elegido a lo largo de la línea (una vía, un río, una cerca). Todo se resuelve en un
// plano local en metros y vuelve a [lon, lat]. La franja se arma sobre una cuadrícula fina alrededor del trazo (la
// unión de círculos a lo largo de la línea) y se le saca el contorno: nunca se cruza a sí misma por muchas curvas que
// tenga el dibujo, y sus puntas quedan redondeadas.
import type { Poligono } from "./area";
import { areaPoligonoM2, metrosPorGrado } from "./geo";

type Xy = [number, number];

export type LecturaTrazo =
  | { tipo: "zona"; poligono: Poligono; areaM2: number; longitudM: number }
  | { tipo: "franja"; poligono: Poligono; areaM2: number; longitudM: number; anchoM: number }
  | { tipo: "corto" };

export type OpcionesTrazo = {
  /** Tolerancia para quitar el pulso de la mano (m); por defecto, el 0,4 % del tamaño del dibujo. */
  toleranciaM?: number;
  /** Distancia (m) entre el final y el comienzo que todavía cuenta como figura cerrada (unos píxeles en pantalla). */
  cierreM?: number;
};

/**
 * Parte del trazo que puede quedar abierta y seguir siendo una figura cerrada (el 15 % de lo dibujado), siempre que el
 * final vaya de vuelta hacia el comienzo: en una U o una V las puntas quedan cerca, pero es un trazo abierto.
 */
export const CIERRE_RELATIVO = 0.15;
/** El final «va hacia el comienzo» si apunta a menos de 60° de él. */
const COSENO_CIERRE = 0.5;
/** Con el final casi encima del comienzo (el 3 % de lo dibujado) la figura está cerrada, vaya hacia donde vaya. */
const CIERRE_JUSTO = 0.03;
/** Qué tan «llena» debe ser una figura para ser una zona (4πA/P²: 1 en un círculo, casi 0 en una ida y vuelta). */
const LLENURA_MINIMA = 0.08;
/** Un lazo (el trazo que se cruza a sí mismo) es la zona si es la mayor parte de lo dibujado. */
const LAZO_MINIMO = 0.6;
/** Celdas de la cuadrícula a lo ancho de la franja, y tope de celdas (dibujos larguísimos y muy angostos). */
const CELDAS_ANCHO = 10;
const MAX_CELDAS = 2_000_000;

const dist = (a: Xy, b: Xy) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function longitud(p: Xy[], cerrada = false): number {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += dist(p[i - 1], p[i]);
  if (cerrada && p.length > 2) d += dist(p[p.length - 1], p[0]);
  return d;
}

/** Área con signo (positiva en sentido antihorario). */
function areaFirmada(p: Xy[]): number {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  return s / 2;
}

/**
 * ¿El final del trazo va de vuelta hacia el comienzo? Al cerrar una figura a mano, el último tramo (el 10 % final de lo
 * dibujado) apunta al punto de partida; en una U o una V, que dejan las puntas cerca, apunta hacia otro lado.
 */
function vaHaciaElComienzo(s: Xy[], largo: number): boolean {
  const fin = s[s.length - 1];
  let desde = s[s.length - 2];
  let recorrido = 0;
  for (let i = s.length - 1; i > 0; i--) {
    recorrido += dist(s[i], s[i - 1]);
    desde = s[i - 1];
    if (recorrido >= 0.1 * largo) break;
  }
  const dx = fin[0] - desde[0];
  const dy = fin[1] - desde[1];
  const gx = s[0][0] - fin[0];
  const gy = s[0][1] - fin[1];
  const n1 = Math.hypot(dx, dy);
  const n2 = Math.hypot(gx, gy);
  if (n1 === 0 || n2 === 0) return true;
  return (dx * gx + dy * gy) / (n1 * n2) >= COSENO_CIERRE;
}

/** Plano local en metros alrededor del centro del dibujo, de ida y de vuelta. */
function plano(puntos: [number, number][]) {
  let oeste = Infinity;
  let este = -Infinity;
  let sur = Infinity;
  let norte = -Infinity;
  for (const [lon, lat] of puntos) {
    oeste = Math.min(oeste, lon);
    este = Math.max(este, lon);
    sur = Math.min(sur, lat);
    norte = Math.max(norte, lat);
  }
  const lon0 = (oeste + este) / 2;
  const lat0 = (sur + norte) / 2;
  const m = metrosPorGrado(lat0);
  return {
    a: ([lon, lat]: [number, number]): Xy => [(lon - lon0) * m.lon, (lat - lat0) * m.lat],
    de: ([x, y]: Xy): [number, number] => [lon0 + x / m.lon, lat0 + y / m.lat],
  };
}

function aSegmento(p: Xy, a: Xy, b: Xy): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas–Peucker: quita los puntos que se apartan menos que la tolerancia (el pulso de la mano). */
function simplificar(p: Xy[], tol: number): Xy[] {
  if (p.length <= 2) return p.slice();
  const queda = new Uint8Array(p.length);
  queda[0] = 1;
  queda[p.length - 1] = 1;
  const pila: [number, number][] = [[0, p.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop()!;
    let max = -1;
    let k = -1;
    for (let n = i + 1; n < j; n++) {
      const d = aSegmento(p[n], p[i], p[j]);
      if (d > max) {
        max = d;
        k = n;
      }
    }
    if (k > 0 && max > tol) {
      queda[k] = 1;
      pila.push([i, k], [k, j]);
    }
  }
  return p.filter((_, n) => queda[n]);
}

/** Douglas–Peucker en un anillo (sin repetir el primer punto): se parte en el punto más lejano del primero. */
function simplificarAnillo(p: Xy[], tol: number): Xy[] {
  if (p.length <= 4) return p.slice();
  let f = 1;
  let max = -1;
  for (let n = 1; n < p.length; n++) {
    const d = dist(p[n], p[0]);
    if (d > max) {
      max = d;
      f = n;
    }
  }
  const ida = simplificar(p.slice(0, f + 1), tol);
  const vuelta = simplificar([...p.slice(f), p[0]], tol);
  return [...ida.slice(0, -1), ...vuelta.slice(0, -1)];
}

/** Dónde se cruzan los segmentos ab y cd (la fracción sobre ab), o null. */
function cruce(a: Xy, b: Xy, c: Xy, d: Xy): number | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) <= 1e-12 * (rx * rx + ry * ry + sx * sx + sy * sy)) return null;
  const qx = c[0] - a[0];
  const qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** ¿El anillo no se cruza ni se toca a sí mismo? */
function esSimple(r: Xy[]): boolean {
  const n = r.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = r[i];
    const b = r[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (cruce(a, b, r[j], r[(j + 1) % n]) !== null) return false;
    }
  }
  return true;
}

/** El lazo más grande que encierra el trazo al cruzarse consigo mismo (el final que se pasa del comienzo). */
function mayorLazo(p: Xy[]): Xy[] | null {
  const acumulado = [0];
  for (let i = 1; i < p.length; i++) acumulado.push(acumulado[i - 1] + dist(p[i - 1], p[i]));
  let mejor: { i: number; j: number; x: Xy } | null = null;
  let mejorPer = 0;
  for (let i = 0; i < p.length - 1; i++)
    for (let j = i + 2; j < p.length - 1; j++) {
      const t = cruce(p[i], p[i + 1], p[j], p[j + 1]);
      if (t === null) continue;
      const x: Xy = [p[i][0] + t * (p[i + 1][0] - p[i][0]), p[i][1] + t * (p[i + 1][1] - p[i][1])];
      const per = dist(x, p[i + 1]) + acumulado[j] - acumulado[i + 1] + dist(p[j], x);
      if (per > mejorPer) {
        mejorPer = per;
        mejor = { i, j, x };
      }
    }
  return mejor ? [mejor.x, ...p.slice(mejor.i + 1, mejor.j + 1)] : null;
}

/* ───────────── Cuadrícula: celdas por clave, relleno y contorno ───────────── */

const DESPLAZO = 2 ** 24;
const FILA = 2 ** 25;
const clave = (i: number, j: number) => (i + DESPLAZO) * FILA + (j + DESPLAZO);
const columnaDe = (k: number) => Math.floor(k / FILA) - DESPLAZO;
const filaDe = (k: number) => (k % FILA) - DESPLAZO;

/** Celdas cuyo centro queda dentro del anillo (regla de giro distinto de cero: un ocho se llena entero). */
function rellenar(r: Xy[], celda: number): Set<number> {
  const celdas = new Set<number>();
  let sur = Infinity;
  let norte = -Infinity;
  for (const q of r) {
    sur = Math.min(sur, q[1]);
    norte = Math.max(norte, q[1]);
  }
  for (let j = Math.floor(sur / celda); j <= Math.floor(norte / celda); j++) {
    const y = (j + 0.5) * celda;
    const cortes: [number, number][] = [];
    for (let k = 0, m = r.length - 1; k < r.length; m = k++) {
      const [x1, y1] = r[m];
      const [x2, y2] = r[k];
      if (y1 <= y !== y2 <= y) cortes.push([x1 + ((y - y1) * (x2 - x1)) / (y2 - y1), y2 > y1 ? 1 : -1]);
    }
    cortes.sort((a, b) => a[0] - b[0]);
    let giro = 0;
    for (let k = 0; k < cortes.length - 1; k++) {
      giro += cortes[k][1];
      if (giro === 0) continue;
      const i0 = Math.ceil(cortes[k][0] / celda - 0.5);
      const i1 = Math.floor(cortes[k + 1][0] / celda - 0.5);
      for (let i = i0; i <= i1; i++) celdas.add(clave(i, j));
    }
  }
  return celdas;
}

/** Celdas a menos de `radio` del trazo: la unión de círculos a lo largo de la línea (puntas redondas). */
function franjaCeldas(p: Xy[], radio: number, celda: number): Set<number> {
  const celdas = new Set<number>();
  const r2 = radio * radio;
  const marcar = (x: number, y: number) => {
    const i0 = Math.floor((x - radio) / celda);
    const i1 = Math.floor((x + radio) / celda);
    const j0 = Math.floor((y - radio) / celda);
    const j1 = Math.floor((y + radio) / celda);
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * celda - y;
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * celda - x;
        if (dx * dx + dy * dy <= r2) celdas.add(clave(i, j));
      }
    }
  };
  marcar(p[0][0], p[0][1]);
  const paso = celda / 2;
  for (let k = 1; k < p.length; k++) {
    const [x1, y1] = p[k - 1];
    const [x2, y2] = p[k];
    const n = Math.max(1, Math.ceil(dist(p[k - 1], p[k]) / paso));
    for (let s = 1; s <= n; s++) marcar(x1 + ((x2 - x1) * s) / n, y1 + ((y2 - y1) * s) / n);
  }
  return celdas;
}

/**
 * El contorno exterior de las celdas (antihorario, en unidades de celda): los bordes entre una celda de adentro y una de
 * afuera, con lo de adentro a la izquierda, encadenados por el punto medio de cada borde (así el escalón de la
 * cuadrícula queda a medias y una diagonal sale recta). En una esquina donde se tocan dos celdas en diagonal se gira a la
 * izquierda (cada parte queda con su propio borde, sin anillos que se toquen); se queda el anillo de mayor área (los
 * huecos van al revés y se descartan: la franja se llena).
 */
function contorno(celdas: Set<number>): Xy[] {
  const xs: number[] = [];
  const ys: number[] = [];
  const dxs: number[] = [];
  const dys: number[] = [];
  const salidas = new Map<number, number[]>();
  const borde = (i: number, j: number, dx: number, dy: number) => {
    const id = xs.length;
    xs.push(i);
    ys.push(j);
    dxs.push(dx);
    dys.push(dy);
    const k = clave(i, j);
    const lista = salidas.get(k);
    if (lista) lista.push(id);
    else salidas.set(k, [id]);
  };
  for (const k of celdas) {
    const i = columnaDe(k);
    const j = filaDe(k);
    if (!celdas.has(clave(i, j - 1))) borde(i, j, 1, 0);
    if (!celdas.has(clave(i + 1, j))) borde(i + 1, j, 0, 1);
    if (!celdas.has(clave(i, j + 1))) borde(i + 1, j + 1, -1, 0);
    if (!celdas.has(clave(i - 1, j))) borde(i, j + 1, 0, -1);
  }
  const sucesor = (e: number) => {
    const opciones = salidas.get(clave(xs[e] + dxs[e], ys[e] + dys[e]));
    if (!opciones) return -1;
    if (opciones.length === 1) return opciones[0];
    for (const o of opciones) if (dxs[e] * dys[o] - dys[e] * dxs[o] > 0) return o;
    return opciones[0];
  };
  const usado = new Uint8Array(xs.length);
  let mejor: Xy[] = [];
  let mejorArea = 0;
  for (let e0 = 0; e0 < xs.length; e0++) {
    if (usado[e0]) continue;
    const anillo: Xy[] = [];
    let e = e0;
    while (e >= 0 && !usado[e]) {
      usado[e] = 1;
      anillo.push([xs[e] + dxs[e] / 2, ys[e] + dys[e] / 2]);
      e = sucesor(e);
    }
    const a = areaFirmada(anillo);
    if (a > mejorArea) {
      mejorArea = a;
      mejor = anillo;
    }
  }
  return quitarAlineados(mejor);
}

/** Quita los puntos intermedios de los tramos rectos (los bordes de la cuadrícula en línea). */
function quitarAlineados(r: Xy[]): Xy[] {
  if (r.length < 4) return r;
  const salida: Xy[] = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[(i - 1 + r.length) % r.length];
    const b = r[i];
    const c = r[(i + 1) % r.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) salida.push(b);
  }
  return salida;
}

/** Puntos que conviene que tenga un área dibujada (el motor la recorre punto por punto muchas veces). */
const MAX_PUNTOS = 400;

/**
 * Anillo de celdas → plano (m), suavizado: lo que queda del escalón de la cuadrícula se vuelve una línea. En una franja
 * larguísima se suaviza un poco más (hasta dos celdas) para no pasar de unos cientos de puntos.
 */
function anilloDeCeldas(celdas: Set<number>, celda: number): Xy[] {
  const borde = contorno(celdas).map(([i, j]): Xy => [i * celda, j * celda]);
  if (borde.length < 3) return [];
  let tol = 0.4 * celda;
  let anillo = simplificarAnillo(borde, tol);
  while (anillo.length > MAX_PUNTOS && tol < 2 * celda) {
    tol = Math.min(2 * celda, tol * 1.4);
    anillo = simplificarAnillo(borde, tol);
  }
  return anillo;
}

/** La zona de un anillo dibujado: tal cual si no se cruza; si se cruza (un ocho), su relleno sobre la cuadrícula. */
function zonaDe(r: Xy[], tol: number): { anillo: Xy[]; area: number } | null {
  if (r.length < 3) return null;
  if (esSimple(r)) {
    const s = simplificarAnillo(r, tol);
    if (s.length >= 3 && esSimple(s)) return { anillo: s, area: Math.abs(areaFirmada(s)) };
  }
  let oeste = Infinity;
  let este = -Infinity;
  let sur = Infinity;
  let norte = -Infinity;
  for (const [x, y] of r) {
    oeste = Math.min(oeste, x);
    este = Math.max(este, x);
    sur = Math.min(sur, y);
    norte = Math.max(norte, y);
  }
  const celda = Math.max(Math.hypot(este - oeste, norte - sur) / 400, tol / 2, 0.01);
  const celdas = rellenar(r, celda);
  if (celdas.size < 4) return null;
  const anillo = anilloDeCeldas(celdas, celda);
  return anillo.length >= 3 ? { anillo, area: celdas.size * celda * celda } : null;
}

const llenura = (area: number, perimetro: number) => (perimetro > 0 ? (4 * Math.PI * area) / (perimetro * perimetro) : 0);

/**
 * Lee un trazo a mano alzada ([lon, lat], en el orden en que se dibujó): una zona (figura cerrada) o una franja de
 * `anchoM` a lo largo de un trazo abierto. «corto» si no alcanza a ser un dibujo (un toque, unos pocos metros).
 */
export function leerTrazo(puntos: [number, number][], anchoM: number, opciones: OpcionesTrazo = {}): LecturaTrazo {
  const limpios = puntos.filter((q, i) => Number.isFinite(q[0]) && Number.isFinite(q[1]) && (i === 0 || q[0] !== puntos[i - 1][0] || q[1] !== puntos[i - 1][1]));
  if (limpios.length < 2) return { tipo: "corto" };
  const pl = plano(limpios);
  const xy = limpios.map(pl.a);
  let oeste = Infinity;
  let este = -Infinity;
  let sur = Infinity;
  let norte = -Infinity;
  for (const [x, y] of xy) {
    oeste = Math.min(oeste, x);
    este = Math.max(este, x);
    sur = Math.min(sur, y);
    norte = Math.max(norte, y);
  }
  const tamano = Math.hypot(este - oeste, norte - sur);
  const tol = opciones.toleranciaM !== undefined && opciones.toleranciaM > 0 ? opciones.toleranciaM : Math.max(tamano * 0.004, 0.5);
  const s = simplificar(xy, tol);
  const largo = longitud(s);
  if (s.length < 2 || largo < Math.max(3 * tol, 5)) return { tipo: "corto" };

  // ¿Figura cerrada? Primero un lazo (el trazo que se cruza y encierra casi todo lo dibujado); si no, el final cerca
  // del comienzo (casi encima, o a menos del 15 % de lo dibujado y volviendo hacia él: una U no se cierra), siempre
  // que la figura encierre algo (una ida y vuelta sobre la misma línea no es una zona)
  let zona: { anillo: Xy[]; area: number } | null = null;
  const lazo = s.length >= 4 ? mayorLazo(s) : null;
  if (lazo) {
    const per = longitud(lazo, true);
    const z = per >= LAZO_MINIMO * largo ? zonaDe(lazo, tol) : null;
    if (z && llenura(z.area, per) >= LLENURA_MINIMA) zona = z;
  }
  if (!zona && s.length >= 3) {
    const hueco = dist(s[0], s[s.length - 1]);
    const justo = Math.max(opciones.cierreM ?? 0, 3 * tol, CIERRE_JUSTO * largo);
    if (hueco <= justo || (hueco <= CIERRE_RELATIVO * largo && vaHaciaElComienzo(s, largo))) {
      const anillo = hueco <= tol ? s.slice(0, -1) : s;
      const z = zonaDe(anillo, tol);
      if (z && llenura(z.area, longitud(anillo, true)) >= LLENURA_MINIMA) zona = z;
    }
  }
  if (zona) {
    const poligono = zona.anillo.map(pl.de);
    return { tipo: "zona", poligono, areaM2: areaPoligonoM2(poligono), longitudM: longitud(zona.anillo, true) };
  }

  // Franja: la unión de círculos de medio ancho a lo largo del trazo, sobre una cuadrícula de un décimo del ancho
  const ancho = Math.max(anchoM, 1);
  let celda = ancho / CELDAS_ANCHO;
  const estimadas = ((largo + ancho) * ancho) / (celda * celda);
  if (estimadas > MAX_CELDAS) celda *= Math.sqrt(estimadas / MAX_CELDAS);
  const celdas = franjaCeldas(s, ancho / 2, celda);
  const anillo = anilloDeCeldas(celdas, celda);
  if (anillo.length < 3) return { tipo: "corto" };
  const poligono = anillo.map(pl.de);
  return { tipo: "franja", poligono, areaM2: areaPoligonoM2(poligono), longitudM: largo, anchoM: ancho };
}
