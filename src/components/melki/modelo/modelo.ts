// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El Modelo Melki: una red neuronal pequeña hecha solo para este simulador (del tipo fastText). Cada frase se vuelve
// rasgos (palabras, pares de palabras y pedazos de letras, en rasgos.ts); cada rasgo tiene un vector aprendido; el
// promedio de esos vectores pasa por una capa que da la probabilidad de cada intención. Corre en cualquier navegador,
// en el procesador, en menos de un milisegundo, sin internet ni tarjeta gráfica. Los pesos (enteros de 8 bits) los
// produce `npm run modelo:entrenar` y viven en src/datos/modelo/melki.json.
import { normalizarFrase, rasgos } from "./rasgos";

export type Umbrales = {
  /** Desde esta probabilidad una orden se hace (si no es delicada). */
  hacer: number;
  /** Desde esta, se pregunta «¿quiso decir…?» con botones. */
  aclarar: number;
  /** Desde esta, se contesta el tema (una respuesta equivocada no cambia nada en el mapa). */
  tema: number;
  /** Desde esta, se dice con cortesía que está fuera del simulador. */
  fuera: number;
  /** La primera debe ganarle a la segunda al menos por esto para hacerla sin preguntar. */
  margen: number;
};

export type Evaluacion = {
  frases: number;
  /** La prueba ciega (frases que no se usaron para nada más). */
  ciega?: { frases: number; aciertos: number; top3: number; precisionHacer: number };
  aciertos: number;
  top3: number;
  /** Aciertos entre lo que el modelo haría sin preguntar. */
  precisionHacer: number;
  /** Parte de las órdenes que haría sin preguntar. */
  coberturaHacer: number;
};

/** El modelo como se guarda (src/datos/modelo/melki.json). */
export type ModeloJson = {
  formato: "melki-1";
  version: string;
  dim: number;
  casillas: number;
  intenciones: string[];
  /** Los municipios y departamentos que se vuelven «zlugar» (normalizados, separados por «|»). */
  lugares: string;
  /** Las palabras que el modelo conoce (las vio al aprender), separadas por «|». */
  vocabulario: string;
  /** Casillas con vector, en orden, como diferencias en enteros variables (base64). */
  filas: string;
  /** La escala de cada vector, en octavos de potencia de 2 (base64, un byte por fila). */
  escalas: string;
  /** Los vectores de los rasgos (enteros de 8 bits, base64). */
  vectores: string;
  /** La capa de salida (enteros de 8 bits, base64) y su escala por intención. */
  salida: string;
  salidaEscalas: number[];
  sesgo: number[];
  umbrales: Umbrales;
  evaluacion?: Evaluacion;
  entrenamiento?: Record<string, number | string>;
};

export type Modelo = {
  version: string;
  /** Cuántas frases vio al aprender. */
  frases?: number;
  dim: number;
  casillas: number;
  intenciones: string[];
  lugares: Set<string>;
  vocabulario: Set<string>;
  /** Fila de cada casilla (−1 si no tiene vector). */
  indice: Int32Array;
  vectores: Int8Array;
  escalas: Float32Array;
  salida: Int8Array;
  salidaEscalas: Float32Array;
  sesgo: Float32Array;
  umbrales: Umbrales;
  evaluacion?: Evaluacion;
};

export type Candidato = { id: string; p: number };

/** base64 → bytes (en el navegador y en Node). */
export function deBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Lee los enteros variables (7 bits por byte) de las filas. */
function leerVarint(bytes: Uint8Array): number[] {
  const out: number[] = [];
  let v = 0;
  let desplazar = 0;
  for (const b of bytes) {
    v |= (b & 0x7f) << desplazar;
    if (b & 0x80) desplazar += 7;
    else {
      out.push(v);
      v = 0;
      desplazar = 0;
    }
  }
  return out;
}

/** Deja el modelo listo para usar (unos milisegundos, una sola vez). */
export function cargarModelo(j: ModeloJson): Modelo {
  if (j.formato !== "melki-1") throw new Error(`Formato de modelo desconocido: ${String(j.formato)}`);
  const difs = leerVarint(deBase64(j.filas));
  const indice = new Int32Array(j.casillas).fill(-1);
  let casilla = 0;
  difs.forEach((d, fila) => {
    casilla += d;
    indice[casilla] = fila;
  });
  const esc = deBase64(j.escalas);
  const escalas = new Float32Array(esc.length);
  for (let i = 0; i < esc.length; i++) escalas[i] = Math.pow(2, (esc[i] - 160) / 8);
  const v = deBase64(j.vectores);
  const s = deBase64(j.salida);
  const m: Modelo = {
    version: j.version,
    frases: typeof j.entrenamiento?.frases === "number" ? j.entrenamiento.frases : undefined,
    dim: j.dim,
    casillas: j.casillas,
    intenciones: j.intenciones,
    lugares: new Set(j.lugares ? j.lugares.split("|") : []),
    vocabulario: new Set(j.vocabulario ? j.vocabulario.split("|") : []),
    indice,
    vectores: new Int8Array(v.buffer, v.byteOffset, v.byteLength),
    escalas,
    salida: new Int8Array(s.buffer, s.byteOffset, s.byteLength),
    salidaEscalas: Float32Array.from(j.salidaEscalas),
    sesgo: Float32Array.from(j.sesgo),
    umbrales: j.umbrales,
    evaluacion: j.evaluacion,
  };
  if (m.vectores.length !== difs.length * m.dim || m.salida.length !== m.intenciones.length * m.dim || escalas.length !== difs.length) throw new Error("El modelo está incompleto");
  return m;
}

/** El vector de una frase: el promedio de los vectores de sus rasgos conocidos (null si no conoce ninguno). */
export function vectorFrase(m: Modelo, texto: string): Float32Array | null {
  const h = new Float32Array(m.dim);
  let n = 0;
  for (const c of rasgos(normalizarFrase(texto, m.lugares), m.casillas)) {
    const fila = m.indice[c];
    if (fila < 0) continue;
    const e = m.escalas[fila];
    const base = fila * m.dim;
    for (let k = 0; k < m.dim; k++) h[k] += m.vectores[base + k] * e;
    n++;
  }
  if (!n) return null;
  for (let k = 0; k < m.dim; k++) h[k] /= n;
  return h;
}

/** Las probabilidades de cada intención para un vector de frase. */
export function probabilidades(m: Modelo, h: Float32Array): Float32Array {
  const C = m.intenciones.length;
  const z = new Float32Array(C);
  let max = -Infinity;
  for (let c = 0; c < C; c++) {
    let s = m.sesgo[c];
    const base = c * m.dim;
    const e = m.salidaEscalas[c];
    for (let k = 0; k < m.dim; k++) s += m.salida[base + k] * e * h[k];
    z[c] = s;
    if (s > max) max = s;
  }
  let suma = 0;
  for (let c = 0; c < C; c++) {
    z[c] = Math.exp(z[c] - max);
    suma += z[c];
  }
  for (let c = 0; c < C; c++) z[c] /= suma;
  return z;
}

/** Las intenciones más probables de una frase, de mayor a menor. */
export function predecir(m: Modelo, texto: string, cuantas = 5): Candidato[] {
  const h = vectorFrase(m, texto);
  if (!h) return [];
  const p = probabilidades(m, h);
  return [...p]
    .map((x, i) => ({ id: m.intenciones[i], p: x }))
    .sort((a, b) => b.p - a.p)
    .slice(0, cuantas);
}

/** Palabras que no dicen qué se pide (para saber si el modelo conoce las que sí lo dicen). */
const VACIAS = new Set(
  "como cual cuales cuando donde para pero porque esto esta este esos esas aqui alla ahora entonces bueno listo favor porfa gracias hola quiero puedes puede podrias podria necesito quisiera dime hazme dame tengo tiene tienen sera seria tambien todo toda todos todas algo nada mucho poco solo cada otra otro unos unas zlugar que por con los las del una uno mas muy hay ese esa son fue era les sus mis tus sin asi aca ahi oye mira vea".split(" "),
);

/**
 * Lo que el modelo sabe de una frase: las intenciones más probables y cuántas de sus palabras con contenido conoce.
 * Si casi no conoce ninguna («¿cómo arreglo la nevera?»), su apuesta no vale: Melki no la usa.
 */
export function analizar(m: Modelo, texto: string, cuantas = 5): { candidatos: Candidato[]; contenido: number; conocidas: number; desconocidas: string[] } {
  const norm = normalizarFrase(texto, m.lugares);
  const palabras = norm.split(" ").filter((w) => w.length >= 3 && !VACIAS.has(w) && !/^\d/.test(w));
  const desconocidas = palabras.filter((w) => !m.vocabulario.has(w));
  return { candidatos: predecir(m, texto, cuantas), contenido: palabras.length, conocidas: palabras.length - desconocidas.length, desconocidas };
}

/** Qué tan parecidas son dos frases para el modelo (coseno de sus vectores, de −1 a 1). */
export function parecido(a: Float32Array, b: Float32Array): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let k = 0; k < a.length; k++) {
    ab += a[k] * b[k];
    aa += a[k] * a[k];
    bb += b[k] * b[k];
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}
