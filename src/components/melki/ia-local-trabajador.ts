// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Código del trabajador (Web Worker clásico, que importa la biblioteca con import()) de la IA local de Melki: un
// modelo de lenguaje abierto (Qwen3) que corre en la tarjeta gráfica del equipo con WebGPU, por medio de WebLLM.
// Nada sale del equipo: solo se descargan, una vez, la biblioteca (verificada con su huella SHA-256), el programa del
// modelo y sus pesos, que quedan guardados en el navegador (IndexedDB) para usarlos sin internet. Se guarda como texto
// para crearlo desde un Blob (funciona igual en el servidor y en la versión HTML). Si la tarjeta gráfica deja de
// responder (WebLLM lo avisa por la consola: «Device was lost…»), el motor se suelta y la página se entera.

export const CODIGO_IA_LOCAL = String.raw`
const BASE = "melki-ia-local-v1";
const ALMACEN = "archivos";
let W = null;
let motor = null;
let modeloCargado = null;
let cargando = null;
let perdida = null;

// La tarjeta gráfica se bloqueó o se reinició: WebLLM descarga el modelo por su cuenta y lo dice por la consola
const TARJETA = /device (was )?lost|DEVICE_HUNG|DEVICE_REMOVED|DEVICE_RESET|DXGI_ERROR|Model not loaded|has already been disposed|Instance\.dispose|GPU (process|device) (was )?(lost|crashed)|context lost/i;
function tarjetaPerdida(texto) {
  if (perdida) return;
  perdida = String(texto).slice(0, 300);
  motor = null;
  modeloCargado = null;
  self.postMessage({ tipo: "perdida", mensaje: perdida });
}
// Antes de importar la biblioteca: su registro (loglevel) toma console.error al cargarse
const errorDeConsola = console.error.bind(console);
console.error = function () {
  try {
    const t = Array.prototype.map.call(arguments, (x) => String(x && x.message ? x.message : x)).join(" ");
    if (TARJETA.test(t)) tarjetaPerdida(t);
  } catch (e) {}
  return errorDeConsola.apply(null, arguments);
};

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

async function huella(blob) {
  const h = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// La biblioteca (WebLLM) se guarda también, para no depender de internet la próxima vez
async function biblioteca(m) {
  if (W) return W;
  let lib = await leer("lib:" + m.libreria);
  if (!lib) {
    self.postMessage({ tipo: "progreso", fase: "biblioteca", avance: 0, texto: "Descargando el motor de la IA local (unos 6,5 MB)…" });
    const r = await fetch(m.libreria);
    if (!r.ok) throw new Error("No pude descargar el motor de la IA local (" + r.status + "). Revise la conexión a internet.");
    lib = await r.blob();
    if (m.huella) {
      const h = await huella(lib);
      if (h !== m.huella) throw new Error("El motor de la IA local que llegó no es el esperado (su huella SHA-256 no coincide): no lo uso.");
    }
    await escribir("lib:" + m.libreria, lib);
  }
  const url = URL.createObjectURL(new Blob([lib], { type: "text/javascript" }));
  W = await import(url);
  return W;
}

// La caché en IndexedDB (useIndexedDBCache en WebLLM 0.2.82; cacheBackend desde la 0.2.85)
function configuracion() {
  return Object.assign({}, W.prebuiltAppConfig, { useIndexedDBCache: true, cacheBackend: "indexeddb" });
}

async function cargar(m) {
  await biblioteca(m);
  // Tras una tarjeta perdida, la persona la activó de nuevo: un motor nuevo (el anterior quedó sin dispositivo)
  if (perdida) {
    perdida = null;
    motor = null;
    modeloCargado = null;
  }
  if (motor && modeloCargado === m.modelo) {
    self.postMessage({ tipo: "listo", modelo: m.modelo });
    return;
  }
  if (!navigator.gpu) throw new Error("Este navegador no tiene WebGPU: use Chrome o Edge actualizados en un equipo con tarjeta gráfica.");
  const avance = (p) => self.postMessage({ tipo: "progreso", fase: "modelo", avance: typeof p.progress === "number" ? p.progress : 0, texto: String(p.text || "") });
  if (motor) {
    motor.setInitProgressCallback && motor.setInitProgressCallback(avance);
    await motor.reload(m.modelo);
  } else {
    motor = await W.CreateMLCEngine(m.modelo, { appConfig: configuracion(), initProgressCallback: avance });
  }
  modeloCargado = m.modelo;
  self.postMessage({ tipo: "listo", modelo: m.modelo });
}

async function completar(m) {
  if (cargando) await cargando;
  if (perdida) throw new Error("Device was lost: " + perdida);
  if (!motor) throw new Error("La IA local no está lista.");
  const pedido = {
    messages: m.mensajes,
    temperature: typeof m.temperatura === "number" ? m.temperatura : 0.2,
    max_tokens: m.maxTokens || 400,
    extra_body: { enable_thinking: false },
  };
  if (m.esquema) pedido.response_format = { type: "json_object", schema: JSON.stringify(m.esquema) };
  const r = await motor.chat.completions.create(pedido);
  const texto = (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || "";
  self.postMessage({ tipo: "respuesta", id: m.id, texto });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.tipo === "cargar") {
      cargando = cargar(m);
      try { await cargando; } finally { cargando = null; }
    } else if (m.tipo === "completar") {
      await completar(m);
    } else if (m.tipo === "descargado") {
      // Sin la biblioteca guardada, el modelo tampoco puede estar
      const lib = W || (await leer("lib:" + m.libreria));
      let si = false;
      if (lib) {
        await biblioteca(m);
        si = await W.hasModelInCache(m.modelo, configuracion());
      }
      self.postMessage({ tipo: "descargado", id: m.id, si });
    } else if (m.tipo === "borrar") {
      if (motor && modeloCargado === m.modelo) {
        await motor.unload();
        motor = null;
        modeloCargado = null;
      }
      if (W || (await leer("lib:" + m.libreria))) {
        await biblioteca(m);
        await W.deleteModelAllInfoInCache(m.modelo, configuracion());
      }
      self.postMessage({ tipo: "borrado", id: m.id });
    } else if (m.tipo === "descargar") {
      if (motor) await motor.unload();
      motor = null;
      modeloCargado = null;
      self.postMessage({ tipo: "descargada", id: m.id });
    }
  } catch (err) {
    const mensaje = String((err && err.message) || err);
    const gpu = TARJETA.test(mensaje);
    if (gpu) {
      // Sin modelo en la tarjeta: el motor no sirve más (se crea otro si la persona la activa de nuevo)
      if (!perdida) perdida = mensaje.slice(0, 300);
      motor = null;
      modeloCargado = null;
    }
    self.postMessage({ tipo: "error", id: m.id, mensaje, gpu });
  }
};
`;
