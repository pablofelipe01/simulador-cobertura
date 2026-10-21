// Código del trabajador (Web Worker clásico, que importa la biblioteca con import()) del dictado privado: reconocimiento de voz Whisper
// dentro del navegador con transformers.js. El audio nunca sale del equipo; solo se descargan, una vez,
// la biblioteca, el motor ONNX y el modelo, que quedan guardados en IndexedDB para usarlos sin internet.
// Se guarda como texto para crearlo desde un Blob (funciona igual en el servidor y en la versión HTML).

export const CODIGO_TRABAJADOR = String.raw`
const BASE = "melki-dictado-v1";
const ALMACEN = "archivos";
let transcriptor = null;
let cargando = null;

function abrir() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
let db = null;
async function base() {
  if (db) return db;
  try { db = await abrir(); } catch (e) { db = false; }
  return db;
}
async function leer(clave) {
  const d = await base();
  if (!d) return undefined;
  return new Promise((ok) => {
    const t = d.transaction(ALMACEN, "readonly").objectStore(ALMACEN).get(clave);
    t.onsuccess = () => ok(t.result || undefined);
    t.onerror = () => ok(undefined);
  });
}
async function escribir(clave, valor) {
  const d = await base();
  if (!d) return;
  await new Promise((ok) => {
    const tx = d.transaction(ALMACEN, "readwrite");
    tx.objectStore(ALMACEN).put(valor, clave);
    tx.oncomplete = () => ok();
    tx.onerror = () => ok();
    tx.onabort = () => ok();
  });
}

// Descarga con avance, leyendo el cuerpo por partes
async function descargar(respuesta, avance) {
  const total = Number(respuesta.headers.get("content-length")) || 0;
  if (!respuesta.body || !avance) return await respuesta.blob();
  const lector = respuesta.body.getReader();
  const partes = [];
  let cargado = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    partes.push(value);
    cargado += value.byteLength;
    avance({ loaded: cargado, total, progress: total ? (100 * cargado) / total : 0 });
  }
  return new Blob(partes);
}

// Caché propia para transformers.js (modelo y motor WASM) sobre IndexedDB
const cache = {
  async match(clave) {
    const b = await leer(String(clave));
    return b ? new Response(b, { headers: { "content-length": String(b.size) } }) : undefined;
  },
  async put(clave, respuesta, avance) {
    const b = await descargar(respuesta, avance);
    await escribir(String(clave), b);
  },
};

const archivos = new Map();
function avisar(datos) {
  if (datos.status === "progress" && datos.file) {
    archivos.set(datos.file, { cargado: datos.loaded || 0, total: datos.total || 0 });
    let c = 0;
    let t = 0;
    for (const a of archivos.values()) { c += a.cargado; t += a.total; }
    self.postMessage({ tipo: "progreso", cargado: c, total: t, archivo: datos.file });
  }
}

async function cargar(m) {
  // La biblioteca se guarda también, para no depender de internet la próxima vez
  let lib = await leer("lib:" + m.libreria);
  if (!lib) {
    self.postMessage({ tipo: "progreso", cargado: 0, total: 0, archivo: "biblioteca" });
    const r = await fetch(m.libreria);
    if (!r.ok) throw new Error("No se pudo descargar la biblioteca de dictado (" + r.status + ").");
    lib = await r.blob();
    await escribir("lib:" + m.libreria, lib);
  }
  const url = URL.createObjectURL(new Blob([lib], { type: "text/javascript" }));
  const T = await import(url);
  const env = T.env;
  env.allowLocalModels = false;
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useCustomCache = true;
  env.customCache = cache;
  env.useWasmCache = true;
  if (m.modelosUrl) env.remoteHost = m.modelosUrl;
  if (m.motorUrl && env.backends && env.backends.onnx && env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = { mjs: m.motorUrl + "ort-wasm-simd-threaded.asyncify.mjs", wasm: m.motorUrl + "ort-wasm-simd-threaded.asyncify.wasm" };
  }
  // Optimización «basic»: las optimizaciones extendidas de ONNX Runtime fallan con algunos modelos cuantizados
  transcriptor = await T.pipeline("automatic-speech-recognition", m.modelo, {
    dtype: "q8",
    device: "wasm",
    session_options: { graphOptimizationLevel: "basic" },
    progress_callback: avisar,
  });
  await escribir("listo:" + m.modelo, Date.now());
  self.postMessage({ tipo: "listo" });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.tipo === "cargar") {
      cargando = cargando || cargar(m);
      await cargando;
    } else if (m.tipo === "transcribir") {
      if (cargando) await cargando;
      if (!transcriptor) throw new Error("El reconocedor no está listo.");
      // Tope de palabras según la duración y sin repetir frases (evita los bucles típicos de Whisper)
      const segundos = m.audio.length / 16000;
      const salida = await transcriptor(m.audio, {
        language: "spanish",
        task: "transcribe",
        max_new_tokens: Math.max(16, Math.min(200, Math.ceil(segundos * 9) + 10)),
        no_repeat_ngram_size: 4,
      });
      const texto = Array.isArray(salida) ? salida.map((x) => x.text).join(" ") : salida.text;
      self.postMessage({ tipo: "texto", id: m.id, texto: texto || "" });
    }
  } catch (err) {
    cargando = null;
    self.postMessage({ tipo: "error", id: m.id, mensaje: String((err && err.message) || err) });
  }
};
`;
