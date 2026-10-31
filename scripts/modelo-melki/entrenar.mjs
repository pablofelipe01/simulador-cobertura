// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Entrena el Modelo Melki y lo guarda en src/datos/modelo/melki.json (con su informe en scripts/modelo-melki/INFORME.md).
//   npm run modelo:entrenar               entrena con la semilla fija (sale siempre el mismo modelo)
//   npm run modelo:entrenar -- --muestras  solo muestra frases de entrenamiento de cada intención
// Opciones: --dim 32 --epocas 14 --tasa 0.35 --por 650 --casillas 131072 --minimo 8 --semilla 20261031
// Todo es JavaScript puro (sin bibliotecas de IA): las frases salen de las plantillas, la red se entrena con descenso
// por gradiente, se poda, se cuantiza a enteros de 8 bits y se evalúa con el mismo código que usa el navegador.
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { azar, compilarTodas, ensuciar, expandir, pulir } from "./gramatica.mjs";
import { MACROS, ORDENES, ranurasBase } from "./plantillas.mjs";
import { FUERA, plantillasDeTemas, RANURAS_FUERA, RUIDO } from "./preguntas.mjs";
import { PRUEBA } from "./prueba.mjs";
import { PRUEBA_CIEGA } from "./prueba-ciega.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (nombre, defecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? Number(process.argv[i + 1]) : defecto;
};
const OPC = {
  dim: arg("dim", 32),
  epocas: arg("epocas", 14),
  tasa: arg("tasa", 0.35),
  por: arg("por", 650),
  casillas: arg("casillas", 131072),
  minimo: arg("minimo", 8),
  semilla: arg("semilla", 20261031),
  caida: 0.1,
};
const soloMuestras = process.argv.includes("--muestras");
// Para probar configuraciones sin tocar el modelo del simulador: --salida otra/carpeta
const iSalida = process.argv.indexOf("--salida");
const carpetaSalida = iSalida >= 0 ? path.resolve(process.argv[iSalida + 1]) : null;
const t0 = Date.now();
const log = (...x) => console.log(...x);

/* ───────────── El código del simulador (el mismo que corre en el navegador) ───────────── */

const entrada = `
export { normalizarFrase, rasgos } from "./src/components/melki/modelo/rasgos";
export { INTENCIONES } from "./src/components/melki/modelo/intenciones";
export { cargarModelo, predecir } from "./src/components/melki/modelo/modelo";
`;
const paquete = await build({ stdin: { contents: entrada, resolveDir: raiz, loader: "ts" }, bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
const tmp = mkdtempSync(path.join(os.tmpdir(), "modelo-melki-"));
writeFileSync(path.join(tmp, "m.mjs"), paquete.outputFiles[0].text);
const M = await import(pathToFileURL(path.join(tmp, "m.mjs")).href);

/* ───────────── Las frases ───────────── */

const lugares = JSON.parse(readFileSync(path.join(raiz, "src/datos/geo/lugares.json"), "utf8"));
const limpio = (s) => s.replace(/\s*\(.*$/, "").replace(/,.*$/, "").replace(/[[\]{}<>|@?]/g, "").trim();
const municipios = [...new Set(lugares.municipios.map((m) => limpio(m[0])))].filter((x) => x.length >= 3);
const departamentos = [...new Set(lugares.departamentos.map((d) => limpio(d[0])))];
const ranuras = compilarTodas({ ...ranurasBase({ municipios, departamentos }), ...RANURAS_FUERA });
// Los nombres de lugar que el modelo ve como «zlugar» (menos los que también son palabras de todos los días)
const COMUNES = new Set([
  "toca", "une", "meta", "bello", "pasto", "cota", "hato", "campamento", "colombia", "gigante", "paramo", "cerrito",
  "pesca", "honda", "manta", "piedras", "prado", "retiro", "socorro", "plato", "agrado", "gama", "aguada", "arenal",
  "palmar", "florida", "victoria", "trinidad", "soledad", "dolores", "remedios", "concordia", "fundacion",
  "distraccion", "convencion", "contratacion", "purificacion", "matanza", "la palma", "la playa", "la vega",
  "la cumbre", "la sierra", "la mesa", "la plata", "la union", "la paz", "la cruz", "la victoria", "la gloria",
  "la esperanza", "la estrella", "la primavera", "la salina", "la merced", "la pena", "la capilla", "la ceja",
  "la chorrera", "la llanada", "la montanita", "la pedrera", "la florida", "la dorada", "la apartada", "la belleza",
  "la calera", "la celia", "la pintada", "la tola", "la uvita", "la virginia", "la argentina", "el banco", "el paso",
  "el retorno", "el colegio", "el castillo", "el charco", "el encanto", "el roble", "el rosal", "el molino",
  "el espino", "el reten", "el playon", "el aguila", "el carmen", "el cairo", "el calvario", "el penon", "el pinon",
  "el rosario", "los andes", "los patios", "los santos", "los palmitos", "los cordobas"
]);
const lugaresModelo = new Set([...municipios, ...departamentos].map((x) => M.normalizarFrase(x)).filter((x) => x.length >= 4 && !COMUNES.has(x)));
const macros = compilarTodas(MACROS);
const plantillas = compilarTodas({ ...ORDENES, ...plantillasDeTemas(), fuera: FUERA, ruido: RUIDO });

const ids = M.INTENCIONES.map((i) => i.id);
const faltan = ids.filter((id) => !plantillas[id]);
const sobran = Object.keys(plantillas).filter((id) => !ids.includes(id));
if (faltan.length || sobran.length) throw new Error(`Intenciones sin plantillas: ${faltan.join(", ") || "-"}; plantillas sin intención: ${sobran.join(", ") || "-"}`);
const faltanPrueba = ids.filter((id) => !PRUEBA[id]?.length);
if (faltanPrueba.length) throw new Error(`Intenciones sin frases de prueba: ${faltanPrueba.join(", ")}`);

const r = azar(OPC.semilla);
/** Cuántas frases distintas se buscan de cada intención. */
const cuantas = (id) => (id === "fuera" ? OPC.por * 2 : id === "ruido" ? Math.round(OPC.por * 0.8) : OPC.por);

if (soloMuestras) {
  for (const id of ids) {
    log(`\n[${id}]`);
    for (let k = 0; k < 8; k++) log(`  ${ensuciar(pulir(expandir(r.elegir(plantillas[id]), r, ranuras, macros)), r)}`);
  }
  process.exit(0);
}

// Frases distintas (como las ve el modelo) de cada intención; las que salen igual en dos intenciones no se usan
const porFrase = new Map();
for (const id of ids) {
  const meta = cuantas(id);
  const vistas = new Set();
  for (let intento = 0; intento < meta * 4 && vistas.size < meta; intento++) {
    const frase = ensuciar(pulir(expandir(r.elegir(plantillas[id]), r, ranuras, macros)), r);
    const norm = M.normalizarFrase(frase, lugaresModelo);
    if (!norm || vistas.has(norm)) continue;
    vistas.add(norm);
    const e = porFrase.get(norm);
    if (e) e.ids.add(id);
    else porFrase.set(norm, { frase, ids: new Set([id]) });
  }
}
const choques = [...porFrase.entries()].filter(([, e]) => e.ids.size > 1);
const datos = [...porFrase.entries()].filter(([, e]) => e.ids.size === 1).map(([norm, e]) => ({ norm, frase: e.frase, y: ids.indexOf([...e.ids][0]) }));
// Mezcla con semilla y aparte un 5 % para validar
for (let i = datos.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [datos[i], datos[j]] = [datos[j], datos[i]];
}
const nVal = Math.round(datos.length * 0.05);
const validacion = datos.slice(0, nVal);
const entreno = datos.slice(nVal);
for (const d of datos) d.x = Int32Array.from(M.rasgos(d.norm, OPC.casillas));
log(`Frases: ${datos.length} (${entreno.length} para aprender, ${validacion.length} para validar), ${choques.length} repetidas entre intenciones (no se usan), ${ids.length} intenciones`);
if (choques.length) log(`  Ejemplos repetidos: ${choques.slice(0, 12).map(([n, e]) => `«${n}» (${[...e.ids].join(" / ")})`).join("; ")}`);

/* ───────────── La red: vectores de rasgos → promedio → capa de salida → softmax ───────────── */

const D = OPC.dim;
const B = OPC.casillas;
const C = ids.length;
const E = new Float32Array(B * D);
for (let i = 0; i < E.length; i++) E[i] = (r() * 2 - 1) / D;
const W = new Float32Array(C * D);
const sesgo = new Float32Array(C);
const h = new Float32Array(D);
const dh = new Float32Array(D);
const z = new Float32Array(C);

function adelante(x, usar) {
  h.fill(0);
  let n = 0;
  for (let i = 0; i < x.length; i++) {
    if (usar && !usar(i)) continue;
    const base = x[i] * D;
    for (let k = 0; k < D; k++) h[k] += E[base + k];
    n++;
  }
  if (n) for (let k = 0; k < D; k++) h[k] /= n;
  let max = -Infinity;
  for (let c = 0; c < C; c++) {
    let s = sesgo[c];
    const base = c * D;
    for (let k = 0; k < D; k++) s += W[base + k] * h[k];
    z[c] = s;
    if (s > max) max = s;
  }
  let suma = 0;
  for (let c = 0; c < C; c++) {
    z[c] = Math.exp(z[c] - max);
    suma += z[c];
  }
  for (let c = 0; c < C; c++) z[c] /= suma;
  return n;
}

function epocas(lista, nEpocas, tasa0, filtro) {
  const total = nEpocas * lista.length;
  let paso = 0;
  const orden = Int32Array.from(lista.keys());
  const elegidos = new Uint8Array(4096);
  for (let ep = 0; ep < nEpocas; ep++) {
    for (let i = orden.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    let perdida = 0;
    for (const o of orden) {
      const d = lista[o];
      const tasa = tasa0 * Math.max(0.0001, 1 - paso / total);
      paso++;
      // Se apagan algunos rasgos al azar (aprende a entender aunque falten palabras)
      let vivos = 0;
      for (let i = 0; i < d.x.length; i++) {
        elegidos[i] = (!filtro || filtro(d.x[i])) && r() >= OPC.caida ? 1 : 0;
        vivos += elegidos[i];
      }
      if (!vivos) for (let i = 0; i < d.x.length; i++) elegidos[i] = !filtro || filtro(d.x[i]) ? 1 : 0;
      const n = adelante(d.x, (i) => elegidos[i] === 1);
      if (!n) continue;
      perdida -= Math.log(Math.max(1e-9, z[d.y]));
      dh.fill(0);
      for (let c = 0; c < C; c++) {
        const g = z[c] - (c === d.y ? 1 : 0);
        if (Math.abs(g) < 1e-7) continue;
        const base = c * D;
        for (let k = 0; k < D; k++) {
          dh[k] += g * W[base + k];
          W[base + k] -= tasa * g * h[k];
        }
        sesgo[c] -= tasa * g;
      }
      for (let i = 0; i < d.x.length; i++) {
        if (elegidos[i] !== 1) continue;
        const base = d.x[i] * D;
        for (let k = 0; k < D; k++) E[base + k] -= (tasa * dh[k]) / n;
      }
    }
    log(`  época ${ep + 1}/${nEpocas}: pérdida ${(perdida / lista.length).toFixed(4)} · validación ${(100 * exactitud(validacion, filtro)).toFixed(2)} %`);
  }
}

function exactitud(lista, filtro) {
  let bien = 0;
  for (const d of lista) {
    adelante(d.x, filtro ? (i) => filtro(d.x[i]) : null);
    let mejor = 0;
    for (let c = 1; c < C; c++) if (z[c] > z[mejor]) mejor = c;
    if (mejor === d.y) bien++;
  }
  return bien / lista.length;
}

log(`Entrenando: ${D} dimensiones, ${OPC.epocas} épocas, tasa ${OPC.tasa}, ${B} casillas`);
epocas(entreno, OPC.epocas, OPC.tasa, null);

// Poda: solo quedan los rasgos que se vieron al menos `minimo` veces; un par de épocas suaves para acomodarse sin ellos
const vistas = new Uint32Array(B);
for (const d of entreno) for (const c of d.x) vistas[c]++;
const queda = (c) => vistas[c] >= OPC.minimo;
log(`Poda: quedan ${vistas.reduce((s, v) => s + (v >= OPC.minimo ? 1 : 0), 0)} de ${vistas.reduce((s, v) => s + (v > 0 ? 1 : 0), 0)} casillas usadas`);
epocas(entreno, 2, OPC.tasa * 0.15, queda);

/* ───────────── Cuantización a enteros de 8 bits ───────────── */

// Las palabras que el modelo conoce: las que vio al menos `minimo` veces (para no apostar con palabras desconocidas)
const cuentaPalabras = new Map();
for (const d of entreno) for (const w of d.norm.split(" ")) cuentaPalabras.set(w, (cuentaPalabras.get(w) ?? 0) + 1);
const vocabulario = [...cuentaPalabras.entries()].filter(([w, n]) => n >= OPC.minimo && w.length >= 3 && /^[a-z0-9%²]+$/.test(w)).map(([w]) => w).sort();
log(`Vocabulario: ${vocabulario.length} palabras`);
const filas = [];
for (let c = 0; c < B; c++) if (queda(c)) filas.push(c);
const vectores = new Int8Array(filas.length * D);
const escalas = new Uint8Array(filas.length);
filas.forEach((c, f) => {
  let max = 0;
  for (let k = 0; k < D; k++) max = Math.max(max, Math.abs(E[c * D + k]));
  // La escala se guarda en octavos de potencia de 2, redondeada hacia arriba (ningún valor pasa de 127)
  const e = Math.min(255, Math.max(0, Math.ceil(8 * Math.log2(Math.max(max, 1e-9) / 127)) + 160));
  escalas[f] = e;
  const s = Math.pow(2, (e - 160) / 8);
  for (let k = 0; k < D; k++) vectores[f * D + k] = Math.max(-127, Math.min(127, Math.round(E[c * D + k] / s)));
});
const salida = new Int8Array(C * D);
const salidaEscalas = [];
for (let c = 0; c < C; c++) {
  let max = 0;
  for (let k = 0; k < D; k++) max = Math.max(max, Math.abs(W[c * D + k]));
  const s = max / 127 || 1;
  salidaEscalas.push(Number(s.toPrecision(6)));
  for (let k = 0; k < D; k++) salida[c * D + k] = Math.max(-127, Math.min(127, Math.round(W[c * D + k] / salidaEscalas[c])));
}
const varint = [];
let previa = 0;
for (const c of filas) {
  let v = c - previa;
  previa = c;
  while (v >= 0x80) {
    varint.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  varint.push(v);
}
const b64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString("base64");

/* ───────────── Evaluación con el código del navegador y umbrales de confianza ───────────── */

const grupo = Object.fromEntries(M.INTENCIONES.map((i) => [i.id, i.grupo]));
const esOrden = (id) => !["pregunta", "fuera"].includes(grupo[id]) && !["capacidades", "saludo", "gracias", "quien", "modelo-melki", "estado-red"].includes(id);
const esTema = (id) => grupo[id] === "pregunta" || ["capacidades", "saludo", "gracias", "quien", "modelo-melki", "estado-red"].includes(id);

function modeloCon(umbrales, evaluacion) {
  return {
    formato: "melki-1",
    version: "1.0",
    dim: D,
    casillas: B,
    intenciones: ids,
    lugares: [...lugaresModelo].sort().join("|"),
    vocabulario: vocabulario.join("|"),
    filas: b64(Uint8Array.from(varint)),
    escalas: b64(escalas),
    vectores: b64(new Uint8Array(vectores.buffer)),
    salida: b64(new Uint8Array(salida.buffer)),
    salidaEscalas,
    sesgo: [...sesgo].map((x) => Number(x.toFixed(5))),
    umbrales,
    ...(evaluacion ? { evaluacion } : {}),
    entrenamiento: { frases: datos.length, intenciones: C, dimensiones: D, epocas: OPC.epocas, tasa: OPC.tasa, casillas: B, minimo: OPC.minimo, semilla: OPC.semilla },
  };
}

const provisional = M.cargarModelo(modeloCon({ hacer: 0.5, aclarar: 0.2, tema: 0.4, fuera: 0.5, margen: 0.2 }));
const juzgar = (lista) =>
  lista.map(({ frase, id }) => {
    const top = M.predecir(provisional, frase, 3);
    return { frase, id, top, p1: top[0]?.p ?? 0, p2: top[1]?.p ?? 0, pred: top[0]?.id ?? "ruido" };
  });
const prueba = juzgar(Object.entries(PRUEBA).flatMap(([id, frases]) => frases.map((frase) => ({ frase, id }))));
const val = juzgar(validacion.map((d) => ({ frase: d.frase, id: ids[d.y] })));

/** Precisión y cobertura de «hacer sin preguntar» con un umbral y un margen. */
function hacerCon(lista, t, margen) {
  const hechas = lista.filter((x) => esOrden(x.pred) && x.p1 >= t && x.p1 - x.p2 >= margen);
  const ordenes = lista.filter((x) => esOrden(x.id));
  const bien = hechas.filter((x) => x.pred === x.id).length;
  return { precision: hechas.length ? bien / hechas.length : 1, cobertura: ordenes.length ? hechas.filter((x) => x.pred === x.id).length / ordenes.length : 0, n: hechas.length };
}
let umbralHacer = { t: 0.9, margen: 0.3, ...hacerCon(prueba, 0.9, 0.3) };
// Con pisos prudentes (0,55 y 0,25): la prueba aparte es pequeña y no debe bajar el umbral por suerte
for (const margen of [0.25, 0.3, 0.4])
  for (let t = 0.55; t <= 0.951; t += 0.01) {
    const a = hacerCon(prueba, t, margen);
    const b = hacerCon(val, t, margen);
    if (a.precision >= 0.97 && b.precision >= 0.995 && a.cobertura > umbralHacer.cobertura + 1e-9) umbralHacer = { t: Number(t.toFixed(2)), margen, ...a };
  }
const umbralCon = (pred, objetivo, minimo) => {
  for (let t = 0.2; t <= 0.951; t += 0.01) {
    const hechas = prueba.filter((x) => pred(x.pred) && x.p1 >= t);
    const bien = hechas.filter((x) => x.pred === x.id).length;
    if (!hechas.length || bien / hechas.length >= objetivo) return Math.max(minimo, Number(t.toFixed(2)));
  }
  return 0.95;
};
const umbrales = {
  hacer: umbralHacer.t,
  margen: umbralHacer.margen,
  aclarar: 0.2,
  tema: umbralCon(esTema, 0.95, 0.6),
  fuera: umbralCon((id) => id === "fuera", 0.97, 0.6),
};
const acierto = (lista) => lista.filter((x) => x.pred === x.id).length / lista.length;
const top3 = (lista) => lista.filter((x) => x.top.some((c) => c.id === x.id)).length / lista.length;
const evaluacion = {
  frases: prueba.length,
  aciertos: Number(acierto(prueba).toFixed(4)),
  top3: Number(top3(prueba).toFixed(4)),
  precisionHacer: Number(umbralHacer.precision.toFixed(4)),
  coberturaHacer: Number(umbralHacer.cobertura.toFixed(4)),
};
const json = modeloCon(umbrales, evaluacion);
// La versión final se vuelve a leer igual que en el navegador
const final = M.cargarModelo(json);
const comprobar = Object.entries(PRUEBA).flatMap(([id, frases]) => frases.map((frase) => ({ frase, id, pred: M.predecir(final, frase, 1)[0]?.id })));
if (Math.abs(comprobar.filter((x) => x.pred === x.id).length / comprobar.length - acierto(prueba)) > 1e-9) throw new Error("La evaluación del modelo guardado no coincide");

// La prueba ciega: no se usa para nada más que para medir
const ciega = Object.entries(PRUEBA_CIEGA).flatMap(([id, frases]) =>
  frases.map((frase) => {
    const top = M.predecir(final, frase, 3);
    return { frase, id, top, p1: top[0]?.p ?? 0, p2: top[1]?.p ?? 0, pred: top[0]?.id ?? "ruido" };
  }),
);
const desconocidas = Object.keys(PRUEBA_CIEGA).filter((id) => !ids.includes(id));
if (desconocidas.length) throw new Error(`La prueba ciega tiene intenciones que no existen: ${desconocidas.join(", ")}`);
const hacerCiega = hacerCon(ciega, umbrales.hacer, umbrales.margen);
json.evaluacion.ciega = { frases: ciega.length, aciertos: Number(acierto(ciega).toFixed(4)), top3: Number(top3(ciega).toFixed(4)), precisionHacer: Number(hacerCiega.precision.toFixed(4)) };
const destinoModelo = carpetaSalida ?? path.join(raiz, "src/datos/modelo");
mkdirSync(destinoModelo, { recursive: true });
const texto = `${JSON.stringify(json)}\n`;
writeFileSync(path.join(destinoModelo, "melki.json"), texto);

/* ───────────── El informe ───────────── */

const errores = prueba.filter((x) => x.pred !== x.id);
const confusiones = new Map();
for (const x of errores) confusiones.set(`${x.id} → ${x.pred}`, (confusiones.get(`${x.id} → ${x.pred}`) ?? 0) + 1);
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;
const informe = [
  "# Modelo Melki · informe del entrenamiento",
  "",
  `Versión ${json.version}. Generado con \`npm run modelo:entrenar\` (semilla ${OPC.semilla}; con la misma semilla sale el mismo modelo).`,
  "",
  "## Lo que es",
  "",
  `Una red neuronal del tipo fastText hecha solo para este simulador: ${C} intenciones (órdenes, preguntas, «fuera del simulador» y «ruido del dictado»), rasgos de palabras, pares de palabras y pedazos de 3 a 5 letras en ${B.toLocaleString("es-CO")} casillas, vectores de ${D} dimensiones y una capa de salida con softmax. Pesa ${(texto.length / 1024 / 1024).toFixed(2).replace(".", ",")} MB (enteros de 8 bits en base64) y corre en el procesador del navegador.`,
  "",
  "## Datos",
  "",
  `- ${datos.length.toLocaleString("es-CO")} frases distintas generadas con plantillas (scripts/modelo-melki/plantillas.mjs y preguntas.mjs), con saludos, «por favor», errores de tecleo y de dictado, sin tildes y con números en palabras.`,
  `- ${entreno.length.toLocaleString("es-CO")} para aprender y ${validacion.length.toLocaleString("es-CO")} para validar; ${choques.length} frases que salían igual en dos intenciones no se usaron.`,
  `- La prueba aparte: ${prueba.length} frases escritas a mano (scripts/modelo-melki/prueba.mjs), que el modelo nunca vio.`,
  "",
  "## Resultados (con el modelo cuantizado, el mismo del navegador)",
  "",
  `- Validación (frases generadas que no vio): ${pct(acierto(val))} de aciertos.`,
  `- Prueba aparte (escritas a mano): ${pct(evaluacion.aciertos)} de aciertos; la correcta está entre las 3 primeras en ${pct(evaluacion.top3)}.`,
  `- Hacer sin preguntar (probabilidad ≥ ${umbrales.hacer} y ${umbrales.margen} por encima de la segunda): acierta ${pct(evaluacion.precisionHacer)} de las veces y cubre ${pct(evaluacion.coberturaHacer)} de las órdenes; el resto se pregunta con botones («¿quiso decir…?») o se deja a Melki.`,
  `- Umbrales: hacer ${umbrales.hacer}, margen ${umbrales.margen}, aclarar ${umbrales.aclarar}, tema ${umbrales.tema}, fuera ${umbrales.fuera}.`,
  "",
  `- Prueba ciega (otras ${ciega.length} frases a mano que no se usaron para nada más): ${pct(acierto(ciega))} de aciertos, top 3 ${pct(top3(ciega))}; lo que haría sin preguntar acierta ${pct(hacerCiega.precision)}.`,
  "",
  "## Errores en la prueba ciega",
  "",
  ...(ciega.some((x) => x.pred !== x.id) ? ciega.filter((x) => x.pred !== x.id).map((x) => `- «${x.frase}»: era ${x.id}, dijo ${x.pred} (${pct(x.p1)})`) : ["- Ninguno."]),
  "",
  "## Errores en la prueba aparte",
  "",
  ...(errores.length ? errores.map((x) => `- «${x.frase}»: era ${x.id}, dijo ${x.pred} (${pct(x.p1)})`) : ["- Ninguno."]),
  "",
  "## Confusiones más comunes",
  "",
  ...(confusiones.size ? [...confusiones.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `- ${k}: ${v}`) : ["- Ninguna."]),
  "",
];
writeFileSync(carpetaSalida ? path.join(carpetaSalida, "INFORME.md") : path.join(raiz, "scripts/modelo-melki/INFORME.md"), informe.join("\n"));
log(`\nGuardado ${path.relative(raiz, path.join(destinoModelo, "melki.json"))} (${(texto.length / 1024).toFixed(0)} KB, ${filas.length} filas) en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
log(`Prueba ciega ${pct(acierto(ciega))} (top 3: ${pct(top3(ciega))}, hacer: ${pct(hacerCiega.precision)})${ciega.some((x) => x.pred !== x.id) ? `:\n${ciega.filter((x) => x.pred !== x.id).map((x) => `  «${x.frase}» ${x.id} → ${x.pred} ${x.p1.toFixed(2)}`).join("\n")}` : ""}`);
log(`Validación ${pct(acierto(val))} · prueba aparte ${pct(evaluacion.aciertos)} (top 3: ${pct(evaluacion.top3)}) · hacer: precisión ${pct(evaluacion.precisionHacer)}, cobertura ${pct(evaluacion.coberturaHacer)}`);
log(`Umbrales ${JSON.stringify(umbrales)}`);
if (errores.length) log(`Errores (${errores.length}):\n${errores.map((x) => `  «${x.frase}» ${x.id} → ${x.pred} ${x.p1.toFixed(2)}`).join("\n")}`);
