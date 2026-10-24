// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Modelo digital de elevación en una malla de píxeles Web Mercator (como las teselas XYZ).
// Fuentes: teselas Terrarium (abiertas, en línea), archivos SRTM .hgt cargados por el usuario, o terreno plano.
import { latAPixel, lonAPixel } from "./geo";
import type { Caja, EstadoRelieve } from "./tipos";

const TAM = 256;

export class Relieve {
  constructor(
    readonly zoom: number,
    /** Píxel global (en el zoom) de la esquina superior izquierda de la malla. */
    readonly x0: number,
    readonly y0: number,
    readonly ancho: number,
    readonly alto: number,
    readonly datos: Float32Array,
    readonly estado: EstadoRelieve,
  ) {}

  /** Elevación bilineal en coordenadas de píxel globales (el valor de cada píxel está en su centro). */
  muestra(px: number, py: number): number {
    let x = px - this.x0 - 0.5;
    let y = py - this.y0 - 0.5;
    const maxX = this.ancho - 1;
    const maxY = this.alto - 1;
    if (x < 0) x = 0;
    else if (x > maxX) x = maxX;
    if (y < 0) y = 0;
    else if (y > maxY) y = maxY;
    const c = x | 0;
    const r = y | 0;
    const fx = x - c;
    const fy = y - r;
    const c1 = c < maxX ? c + 1 : c;
    const r1 = r < maxY ? r + 1 : r;
    const d = this.datos;
    const i0 = r * this.ancho;
    const i1 = r1 * this.ancho;
    const a = d[i0 + c] + (d[i0 + c1] - d[i0 + c]) * fx;
    const b = d[i1 + c] + (d[i1 + c1] - d[i1 + c]) * fx;
    return a + (b - a) * fy;
  }

  pixel(lat: number, lon: number): [number, number] {
    return [lonAPixel(lon, this.zoom), latAPixel(lat, this.zoom)];
  }

  elevacion(lat: number, lon: number): number {
    const [x, y] = this.pixel(lat, lon);
    return this.muestra(x, y);
  }

  /** Tamaño del píxel sobre el terreno (m) a una latitud. */
  resolucionM(lat: number): number {
    return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** this.zoom;
  }

  /** ¿La caja está dentro de la malla? (para reutilizarla en consultas puntuales). */
  contiene(caja: Caja): boolean {
    const [xa, ya] = this.pixel(caja.norte, caja.oeste);
    const [xb, yb] = this.pixel(caja.sur, caja.este);
    return xa >= this.x0 && ya >= this.y0 && xb <= this.x0 + this.ancho && yb <= this.y0 + this.alto;
  }
}

/** Extensión en píxeles de una caja geográfica, con un borde de seguridad. */
function extension(caja: Caja, zoom: number, borde = 2) {
  const x0 = Math.floor(lonAPixel(caja.oeste, zoom)) - borde;
  const x1 = Math.ceil(lonAPixel(caja.este, zoom)) + borde;
  const y0 = Math.floor(latAPixel(caja.norte, zoom)) - borde;
  const y1 = Math.ceil(latAPixel(caja.sur, zoom)) + borde;
  return { x0, y0, ancho: x1 - x0, alto: y1 - y0 };
}

/** Reduce el zoom hasta que la malla quepa en el número máximo de píxeles. */
export function zoomParaCaja(caja: Caja, zoomMax: number, maxPixeles = 12_000_000): number {
  let z = zoomMax;
  while (z > 6) {
    const e = extension(caja, z);
    if (e.ancho * e.alto <= maxPixeles) break;
    z--;
  }
  return z;
}

export function relievePlano(caja: Caja, mensaje?: string): Relieve {
  const zoom = 8;
  const e = extension(caja, zoom);
  return new Relieve(zoom, e.x0, e.y0, 2, 2, new Float32Array(4), {
    fuente: "plano",
    solicitadas: 0,
    fallidas: 0,
    resolucionM: 0,
    mensaje: mensaje ?? "Terreno plano: no se considera el relieve.",
  });
}

/** Decodifica un píxel Terrarium: altura = R·256 + G + B/256 − 32768. */
export function decodificarTerrarium(rgba: Uint8ClampedArray | Uint8Array): Float32Array {
  const n = rgba.length / 4;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    out[i] = r * 256 + g + b / 256 - 32768;
  }
  return out;
}

export type CargarTesela = (z: number, x: number, y: number) => Promise<Float32Array | null>;

/** Arma la malla de elevación descargando (o leyendo de la caché) las teselas Terrarium necesarias. */
export async function relieveDesdeTeselas(
  caja: Caja,
  zoomMax: number,
  cargar: CargarTesela,
  progreso?: (avance: number) => void,
  paralelo = 6,
): Promise<Relieve> {
  const zoom = zoomParaCaja(caja, zoomMax);
  const e = extension(caja, zoom);
  const datos = new Float32Array(e.ancho * e.alto).fill(Number.NaN);
  const tx0 = Math.floor(e.x0 / TAM);
  const ty0 = Math.floor(e.y0 / TAM);
  const tx1 = Math.floor((e.x0 + e.ancho - 1) / TAM);
  const ty1 = Math.floor((e.y0 + e.alto - 1) / TAM);
  const lista: [number, number][] = [];
  const n = 2 ** zoom;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (ty >= 0 && ty < n) lista.push([tx, ty]);

  let fallidas = 0;
  let hechas = 0;
  let suma = 0;
  let cuenta = 0;
  const cola = [...lista];
  const trabajar = async () => {
    for (let item = cola.shift(); item; item = cola.shift()) {
      const [tx, ty] = item;
      const xw = ((tx % n) + n) % n;
      let tesela: Float32Array | null = null;
      try {
        tesela = await cargar(zoom, xw, ty);
      } catch {
        tesela = null;
      }
      if (!tesela) fallidas++;
      else {
        // Copiar la parte de la tesela que cae dentro de la malla
        const ox = tx * TAM - e.x0;
        const oy = ty * TAM - e.y0;
        for (let j = Math.max(0, -oy); j < TAM && oy + j < e.alto; j++) {
          const fila = (oy + j) * e.ancho;
          for (let i = Math.max(0, -ox); i < TAM && ox + i < e.ancho; i++) {
            const v = tesela[j * TAM + i];
            datos[fila + ox + i] = v;
            suma += v;
            cuenta++;
          }
        }
      }
      hechas++;
      progreso?.(hechas / lista.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(paralelo, lista.length) }, trabajar));

  if (cuenta === 0) return relievePlano(caja, "No se pudo descargar el relieve (sin conexión o servicio no disponible). Se simuló en terreno plano.");
  rellenarVacios(datos, suma / cuenta);
  const latMedia = (caja.norte + caja.sur) / 2;
  const relieve = new Relieve(zoom, e.x0, e.y0, e.ancho, e.alto, datos, {
    fuente: "teselas",
    solicitadas: lista.length,
    fallidas,
    resolucionM: 0,
    mensaje:
      fallidas > 0
        ? `No se descargaron ${fallidas} de ${lista.length} teselas de relieve; esas zonas se rellenaron con la elevación media.`
        : undefined,
  });
  relieve.estado.resolucionM = Math.round(relieve.resolucionM(latMedia));
  return relieve;
}

function rellenarVacios(datos: Float32Array, valor: number) {
  for (let i = 0; i < datos.length; i++) if (!Number.isFinite(datos[i]) || datos[i] < -500) datos[i] = valor;
}

/* ───────────── Archivos SRTM .hgt (1″ = 3601², 3″ = 1201²) ───────────── */

export type Hgt = { nombre: string; lat: number; lon: number; n: number; datos: Int16Array };

/** Interpreta un archivo .hgt (nombre tipo N04W073.hgt; enteros de 16 bits big-endian). */
export function leerHgt(nombre: string, buffer: ArrayBuffer): Hgt {
  const m = nombre.toUpperCase().match(/([NS])(\d{2})([EW])(\d{3})/);
  if (!m) throw new Error(`El nombre «${nombre}» no tiene el formato SRTM (por ejemplo N04W073.hgt).`);
  const lat = Number(m[2]) * (m[1] === "S" ? -1 : 1);
  const lon = Number(m[4]) * (m[3] === "W" ? -1 : 1);
  const muestras = buffer.byteLength / 2;
  const n = Math.round(Math.sqrt(muestras));
  if (n * n !== muestras || (n !== 3601 && n !== 1201)) throw new Error(`«${nombre}» no tiene un tamaño SRTM válido (1″ o 3″).`);
  const vista = new DataView(buffer);
  const datos = new Int16Array(muestras);
  for (let i = 0; i < muestras; i++) datos[i] = vista.getInt16(i * 2, false);
  return { nombre: `${m[1]}${m[2]}${m[3]}${m[4]}`, lat, lon, n, datos };
}

export class ColeccionHgt {
  private mapa = new Map<string, Hgt>();
  agregar(h: Hgt) {
    this.mapa.set(`${h.lat},${h.lon}`, h);
  }
  vaciar() {
    this.mapa.clear();
  }
  get lista() {
    return [...this.mapa.values()];
  }
  get tamano() {
    return this.mapa.size;
  }
  /** Elevación bilineal; NaN si ningún archivo cubre el punto o hay vacío de datos. */
  elevacion(lat: number, lon: number): number {
    const la = Math.floor(lat);
    const lo = Math.floor(lon);
    const h = this.mapa.get(`${la},${lo}`);
    if (!h) return Number.NaN;
    const k = h.n - 1;
    const r = (la + 1 - lat) * k;
    const c = (lon - lo) * k;
    const r0 = Math.min(Math.floor(r), k - 1);
    const c0 = Math.min(Math.floor(c), k - 1);
    const fr = r - r0;
    const fc = c - c0;
    const d = h.datos;
    const v00 = d[r0 * h.n + c0];
    const v01 = d[r0 * h.n + c0 + 1];
    const v10 = d[(r0 + 1) * h.n + c0];
    const v11 = d[(r0 + 1) * h.n + c0 + 1];
    if (v00 < -1000 || v01 < -1000 || v10 < -1000 || v11 < -1000) return Number.NaN;
    return v00 * (1 - fr) * (1 - fc) + v01 * (1 - fr) * fc + v10 * fr * (1 - fc) + v11 * fr * fc;
  }
  /** Resolución en segundos de arco del archivo más fino. */
  get segundos(): number {
    return this.lista.some((h) => h.n === 3601) ? 1 : 3;
  }
}

/** Remuestrea los .hgt a una malla Web Mercator (zoom 13 para 1″, 12 para 3″). */
export function relieveDesdeHgt(caja: Caja, coleccion: ColeccionHgt, progreso?: (avance: number) => void): Relieve {
  if (coleccion.tamano === 0) return relievePlano(caja, "No hay archivos de relieve local cargados. Se simuló en terreno plano.");
  const zoom = zoomParaCaja(caja, coleccion.segundos === 1 ? 13 : 12);
  const e = extension(caja, zoom);
  const datos = new Float32Array(e.ancho * e.alto);
  const escala = 256 * 2 ** zoom;
  const lons = new Float64Array(e.ancho);
  for (let i = 0; i < e.ancho; i++) lons[i] = ((e.x0 + i + 0.5) / escala) * 360 - 180;
  let vacios = 0;
  let suma = 0;
  let cuenta = 0;
  for (let j = 0; j < e.alto; j++) {
    const yn = Math.PI * (1 - (2 * (e.y0 + j + 0.5)) / escala);
    const lat = (Math.atan(Math.sinh(yn)) * 180) / Math.PI;
    const fila = j * e.ancho;
    for (let i = 0; i < e.ancho; i++) {
      const v = coleccion.elevacion(lat, lons[i]);
      datos[fila + i] = v;
      if (Number.isFinite(v)) {
        suma += v;
        cuenta++;
      } else vacios++;
    }
    if (progreso && j % 64 === 0) progreso(j / e.alto);
  }
  if (cuenta === 0) return relievePlano(caja, "Los archivos de relieve cargados no cubren el área simulada. Se simuló en terreno plano.");
  rellenarVacios(datos, suma / cuenta);
  const total = e.ancho * e.alto;
  const relieve = new Relieve(zoom, e.x0, e.y0, e.ancho, e.alto, datos, {
    fuente: "hgt",
    solicitadas: total,
    fallidas: vacios,
    resolucionM: 0,
    mensaje:
      vacios > total * 0.001
        ? `El relieve local no cubre el ${((100 * vacios) / total).toFixed(1).replace(".", ",")} % del área; esa parte se rellenó con la elevación media.`
        : undefined,
  });
  relieve.estado.resolucionM = Math.round(relieve.resolucionM((caja.norte + caja.sur) / 2));
  return relieve;
}
