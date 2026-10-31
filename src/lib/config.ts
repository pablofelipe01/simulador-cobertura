// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Fuentes de mapas y relieve. Todas son abiertas y sin costo; se pueden reemplazar con variables
// de entorno (ver «Variables de entorno» en la documentación del proyecto) para usar un servidor propio.

export const CONFIG = {
  mapas: {
    satelite:
      process.env.NEXT_PUBLIC_MAPA_SATELITE_URL ||
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    /** Ciudades, poblados y límites (capa transparente sobre el satélite). */
    etiquetas:
      process.env.NEXT_PUBLIC_MAPA_ETIQUETAS_URL ||
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    /** Vías principales (capa transparente). */
    vias:
      process.env.NEXT_PUBLIC_MAPA_VIAS_URL ||
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    topografico:
      process.env.NEXT_PUBLIC_MAPA_TOPOGRAFICO_URL ||
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    /** OpenTopoMap: curvas de nivel, ríos, quebradas y nombres (datos de OpenStreetMap). */
    opentopomap: process.env.NEXT_PUBLIC_MAPA_OPENTOPOMAP_URL || "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    calles: process.env.NEXT_PUBLIC_MAPA_CALLES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  /** Teselas de elevación en formato Terrarium (PNG): altura = R·256 + G + B/256 − 32768. */
  relieve: process.env.NEXT_PUBLIC_RELIEVE_URL || "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
  /**
   * Dictado privado de Melki (reconocimiento de voz dentro del navegador). Se descargan una vez y quedan
   * guardados en el equipo: la biblioteca transformers.js, el motor ONNX (WASM) y el modelo Whisper.
   */
  dictado: {
    libreria: process.env.NEXT_PUBLIC_DICTADO_LIBRERIA_URL || "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js",
    /** Carpeta con ort-wasm-simd-threaded.asyncify.mjs y .wasm; vacío = la que trae la biblioteca. */
    motor: process.env.NEXT_PUBLIC_DICTADO_MOTOR_URL || "",
    modelos: process.env.NEXT_PUBLIC_DICTADO_MODELOS_URL || "https://huggingface.co/",
    modelo: process.env.NEXT_PUBLIC_DICTADO_MODELO || "Xenova/whisper-base",
  },
  /**
   * IA local de Melki (un modelo de lenguaje abierto que corre en la tarjeta gráfica del equipo con WebGPU, sin
   * instalar nada y sin mandar nada a internet). Se descarga una vez, cuando la persona la activa, y queda guardada en
   * el navegador. La biblioteca (WebLLM) va fijada en su versión y se verifica con su huella SHA-256 antes de usarla.
   * Va la 0.2.82: desde la 0.2.83, WebLLM bloquea la tarjeta gráfica en equipos con Windows y gráficos AMD integrados
   * (DXGI_ERROR_DEVICE_HUNG con pedidos largos; mlc-ai/web-llm#844), y así pasó con la 0.2.86 en una prueba real.
   */
  iaLocal: {
    libreria: process.env.NEXT_PUBLIC_IA_LOCAL_LIBRERIA_URL || "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/lib/index.js",
    /** Huella de la biblioteca de arriba; con otra URL, la suya (vacía = sin verificar). */
    huella: process.env.NEXT_PUBLIC_IA_LOCAL_LIBRERIA_URL ? process.env.NEXT_PUBLIC_IA_LOCAL_LIBRERIA_SHA256 || "" : "4c89beb3ed13946e6f1ca9376f33062b5c64765c26f3ddaba045df6a13dda858",
    /** Modelo por defecto (uno de MODELOS_LOCALES); vacío = el recomendado. */
    modelo: process.env.NEXT_PUBLIC_IA_LOCAL_MODELO || "",
  },
  atribucion: {
    esri: "Imágenes y referencias © Esri, Maxar, Earthstar Geographics y la comunidad de usuarios SIG",
    osm: "© colaboradores de OpenStreetMap",
    opentopomap: "© OpenStreetMap, SRTM · estilo © OpenTopoMap (CC BY-SA)",
    relieve: "Relieve: Mapzen Terrain Tiles (SRTM, NASA)",
    division: "Límites: DANE, Marco Geoestadístico Nacional (CC BY 4.0) · Ríos y países: Natural Earth",
  },
} as const;

/** Expande «{s}» en varias URL (subdominios a, b, c). */
export function urlsTeselas(plantilla: string): string[] {
  return plantilla.includes("{s}") ? ["a", "b", "c"].map((s) => plantilla.replace("{s}", s)) : [plantilla];
}
