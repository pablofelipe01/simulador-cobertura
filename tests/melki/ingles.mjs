// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Pruebas del inglés (sin navegador): el idioma de la pantalla y del motor, la detección del idioma de lo que se
// escribe o se dice, el traductor de pedidos (cada pedido en inglés debe dar la misma orden que en español), la voz
// en inglés y lo que Melki responde en inglés; y que el español siga igual.
// Uso: npm run prueba:melki (corre después de ordenes.mjs)
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(aqui, "..", "..");
const entrada = `
export * from "./src/lib/idioma";
export { interpretarOrden } from "./src/components/melki/ordenes";
export { traducirPedido, espanolDeMezcla } from "./src/components/melki/ingles";
export { corregirIngles } from "./src/components/melki/ortografia-en";
export { nombreLibre } from "./src/components/simulador/piezas";
export { nombreEnElOtroIdioma } from "./src/lib/nombres-nodo";
export { cargarReferencia, buscarLugares, reconocerLugares } from "./src/lib/geo/referencia";
export { cambioDeIdioma, sinNombres, avisoCambio } from "./src/components/melki/idioma-melki";
export { estadoRed } from "./src/lib/radio/estado-red";
export { numerosEnPalabrasEn, numeroDePalabrasEn } from "./src/components/melki/numeros";
export { puntajeVoz, generoDeVoz, paraHablar } from "./src/components/melki/voz";
export { hablaNatural, plataHabladaEn } from "./src/components/melki/habla";
export { frases, controlDeVoz, limpiarComando, textoParaVoz, ayudaVoz } from "./src/components/melki/manos-libres";
export { responder, menuTours, sugerencias, SUGERENCIAS, pedidoDeTour, horaHablada } from "./src/components/melki/cerebro";
export { TOURS, tourPorId } from "./src/components/melki/tours";
export { pedidoPitch, pesosHablados } from "./src/lib/negocio/pitch";
export { pedidoRecorrido } from "./src/lib/negocio/recorrido-red";
export { ejecutarOrden } from "./src/components/melki/ordenes";
export { herramientasIA, HERRAMIENTAS_IA, instruccionesMelki } from "./src/components/melki/herramientas-ia";
export { textoTarjeta, textoTarjetaChat, textoTarjetaBloqueada, TEXTO_TARJETA, TEXTO_TARJETA_CHAT, TEXTO_TARJETA_BLOQUEADA } from "./src/components/melki/ia-local";
export { numerosDe } from "./src/components/melki/pensar";
`;
const tmp = mkdtempSync(path.join(os.tmpdir(), "melki-en-"));
const archivo = path.join(tmp, "melki-en.mjs");
const r = await build({ stdin: { contents: entrada, resolveDir: repo, loader: "ts" }, bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
writeFileSync(archivo, r.outputFiles[0].text);
const m = await import(pathToFileURL(archivo).href);

let fallos = 0;
const caso = (nombre, ok, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle && !ok ? ` (${detalle})` : ""}`);
  if (!ok) fallos++;
};

/* ───────────── Simulador de mentira (el mismo de ordenes.mjs) ───────────── */

const PARAMETROS = {
  preset: "LONG_FAST",
  frecuenciaMhz: 915,
  alturaRxM: 2.5,
  gananciaRxDbi: 2,
  perdidaExtraDb: 0,
  radioKm: 10,
  resolucion: "normal",
  limiteSaltos: 3,
  modelo: "calibrado",
  polarizacion: "vertical",
  clima: 1,
  refractividad: 360,
  suelo: "promedio",
  permitividad: 15,
  conductividad: 0.005,
  variabilidad: "movil",
  tiempoPct: 50,
  ubicacionesPct: 50,
  situacionesPct: 70,
  entorno: "abierto",
};
const base = (id, nombre, lat, lon, extra = {}) => ({ id, nombre, tipo: "antena", lat, lon, alturaM: 15, potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1, equipo: "nodo-solar-58", rol: "ROUTER", pasarela: false, activa: true, ...extra });

/** Simulador de mentira: registra lo que Melki pide. */

function crearApi(antenas) {
  const llamadas = [];
  let n = 0;
  const api = {
    llamadas,
    antenas: () => antenas,
    parametros: () => PARAMETROS,
    seleccion: () => null,
    resultado: () => null,
    instantanea: () => ({ version: 1, nombre: "x", antenas: [...antenas], parametros: PARAMETROS, mediciones: [] }),
    agregar: (d) => {
      const a = base(`n${++n}`, d.nombre ?? (d.tipo === "nodo" ? `Nodo ${n}` : `Antena ${n}`), d.lat, d.lon, { ...d, alturaM: d.alturaM ?? (d.tipo === "nodo" ? 1.5 : 10) });
      antenas.push(a);
      llamadas.push(["agregar", d]);
      return a;
    },
    editar: (id, c) => llamadas.push(["editar", id, c]),
    eliminar: (id) => llamadas.push(["eliminar", id]),
    parametrosCambiar: (c) => llamadas.push(["parametros", c]),
    simular: () => llamadas.push(["simular"]),
    centrar: (lat, lon) => llamadas.push(["centrar", lat, lon]),
    encuadrarCaja: (c) => llamadas.push(["caja", c]),
    marcar: (lat, lon) => llamadas.push(["marcar", lat, lon]),
    medir: (med) => llamadas.push(["medir", med]),
    perfil: (a, b, informe) => llamadas.push(["perfil", a.id, b, Boolean(informe)]),
    vista: (c) => llamadas.push(["vista", c]),
    senal: (lat, lon) => llamadas.push(["senal", lat, lon]),
    herramienta: (h) => llamadas.push(["herramienta", h]),
    ejemplo: () => llamadas.push(["ejemplo"]),
    nuevo: () => llamadas.push(["nuevo"]),
    exportar: (f) => (llamadas.push(["exportar", f]), true),
    borrarMediciones: () => llamadas.push(["borrar-mediciones"]),
    ubicacion: () => "Cumaral (Meta)",
    buscarLugar: (t) =>
      /villavicencio/.test(t)
        ? [{ tipo: "municipio", nombre: "Villavicencio", detalle: "Meta", lat: 4.14, lon: -73.63, caja: [-73.8, 3.9, -73.3, 4.3] }]
        : /paratebueno/.test(t)
          ? [{ tipo: "municipio", nombre: "Paratebueno", detalle: "Cundinamarca", lat: 4.37, lon: -73.21 }]
          : [],
    // Modo «Sembrar la malla»
    modoActual: "sembrar",
    propuestaActual: null,
    redActual: null,
    modo: () => api.modoActual,
    cambiarModo: (v) => {
      api.modoActual = v;
      llamadas.push(["modo", v]);
    },
    ponerPieza: (pieza, lat, lon, datos = {}) => {
      const nombre = { gateway: "Gateway", repetidor: `Repetidor ${++n}`, persona: `Persona ${++n}` }[pieza];
      const a = base(`p${++n}`, nombre, lat, lon, { tipo: pieza === "persona" ? "nodo" : "antena", alturaM: pieza === "persona" ? 1.5 : pieza === "gateway" ? 8 : 15, pasarela: pieza === "gateway", ...datos });
      antenas.push(a);
      llamadas.push(["pieza", pieza, lat, lon, datos]);
      return a;
    },
    armarPieza: (p) => llamadas.push(["armar", p]),
    red: () => api.redActual ?? m.estadoRed(antenas, null, 3, false),
    sembrar: (d) => {
      llamadas.push(["sembrar", d]);
      api.propuestaActual = { puntos: [{ id: "propuesto-1", desdeId: "g", lat: 4.25, lon: -73.2, sueloM: 300, margenDb: 34, distanciaKm: 12, desde: "Gateway", destino: 0 }], destinos: d.map(() => ({ llega: true, margenDb: 27, desde: "Propuesto 1", desdeId: "propuesto-1", motivo: null })), margenObjetivoDb: 30 };
      return Promise.resolve(api.propuestaActual);
    },
    propuesta: () => api.propuestaActual,
    aceptarSiembra: () => {
      if (!api.propuestaActual) return 0;
      llamadas.push(["aceptar"]);
      api.propuestaActual = null;
      return 1;
    },
    descartarSiembra: () => {
      api.propuestaActual = null;
      llamadas.push(["descartar"]);
    },
    enviarMensaje: (id) => {
      llamadas.push(["mensaje", id]);
      return { llega: true, motivo: null, ruta: [id, "g"], saltos: 1, limiteSaltos: 3, tramos: [], bytes: 62, aireMs: 722.9, totalMs: { min: 722.9, tipica: 722.9, max: 722.9 }, probabilidad: 0.95, probabilidadReintentos: 0.9999, preset: "Long Fast" };
    },
    ejemploMalla: () => llamadas.push(["ejemplo-malla"]),
    // Agente (v10)
    medicionesActuales: [],
    centro: { lat: 4.15, lon: -73.6 },
    mediciones: () => api.medicionesActuales,
    centroMapa: () => api.centro,
    seleccionar: (id) => llamadas.push(["seleccionar", id]),
    eliminarVarias: (ids) => llamadas.push(["eliminar-varias", ids]),
    restaurar: (e) => llamadas.push(["restaurar", e]),
    encuadrarTodo: () => llamadas.push(["encuadrar"]),
    autoSimular: () => true,
    fijarAutoSimular: (v) => llamadas.push(["auto", v]),
    fijarRelieve: (v) => llamadas.push(["relieve", v]),
    renombrarEscenario: (nombre) => llamadas.push(["nombre", nombre]),
    duplicar: (id) => llamadas.push(["duplicar", id]),
    pantalla: "escritorio",
    paneles: (c) => (llamadas.push(["paneles", c]), api.pantalla),
    disenoFalso: null,
    disenarArea: (o) => {
      llamadas.push(["disenar", o]);
      return Promise.resolve(api.disenoFalso);
    },
    aplicarDiseno: (d, h) => {
      llamadas.push(["aplicar", d, h]);
      return d.nodos.map((q, k) => {
        const a = base(`d${k}`, q.pieza === "gateway" ? "Gateway" : `Repetidor ${k}`, q.lat, q.lon, { pasarela: q.pieza === "gateway", alturaM: q.pieza === "gateway" ? 8 : h });
        antenas.push(a);
        return a;
      });
    },
    resultadoFalso: null,
    esperarResultado: () => Promise.resolve(api.resultadoFalso),
    // Ajuste inteligente (v11)
    objetivo: null,
    areaObjetivo: () => api.objetivo,
    fijarAreaObjetivo: (id, o) => {
      llamadas.push(["area-objetivo", id, o]);
      const med = api.medicionesActuales.find((x) => x.id === id);
      api.objetivo = id && med ? { ...o, nombre: med.nombre, puntos: med.puntos } : null;
    },
    ajusteFalso: null,
    ajustarRed: (o) => {
      llamadas.push(["ajustar", o]);
      return Promise.resolve(api.ajusteFalso);
    },
    aplicarAjuste: (a, i, b) => {
      llamadas.push(["aplicar-ajuste", i, b]);
      return [];
    },
    mostrarAjuste: (a, i) => llamadas.push(["mostrar-ajuste", i]),
    descartarAjuste: () => llamadas.push(["descartar-ajuste"]),
    // Gente y capacidad (v12)
    areasPoblar: () => [
      ...api.medicionesActuales.filter((x) => x.tipo === "area").map((x) => ({ id: x.id, nombre: x.objetivo ? `Área objetivo «${x.nombre}»` : `Área «${x.nombre}»`, km2: 40, poligono: x.puntos, objetivo: Boolean(x.objetivo) })),
      { id: "zona-red", nombre: "Alrededor de la red (3 km)", km2: 56.5, poligono: [], objetivo: false },
      { id: "zona-estudio", nombre: "Área de estudio (10 km)", km2: 314, poligono: [], objetivo: false },
    ],
    poblar: (o) => {
      llamadas.push(["poblar", o]);
      const n = Math.round(o.densidadKm2 !== undefined ? 56.5 * o.densidadKm2 : (o.n ?? 250));
      return { puestas: n, pedidas: n, area: "Alrededor de la red (3 km)", km2: 56.5, conSenal: Boolean(o.soloConSenal), quitadas: 0 };
    },
    quitarPobladas: () => (llamadas.push(["quitar-pobladas"]), 3),
    cargaFalsa: null,
    probarCarga: (o, curva) => {
      llamadas.push(["carga", o, Boolean(curva)]);
      return Promise.resolve(api.cargaFalsa);
    },
    // Zonas de popularidad y prueba de estrés (v12.1)
    centrosZona: () => antenas.filter((a) => a.activa && !a.poblada && (a.rol === "REPETIDOR" || a.pasarela)).map((a) => ({ id: a.id, nombre: a.nombre, pieza: a.pasarela ? "gateway" : "repetidor", personas: 0 })),
    poblarZonas: (o) => {
      llamadas.push(["zonas", o]);
      const centros = api.centrosZona().filter((c) => !o.centros?.length || o.centros.includes(c.id));
      const n = o.n ?? 250;
      return { zonas: centros.map((c) => ({ id: c.id, nombre: c.nombre, puestas: n, pedidas: n })), puestas: n * centros.length, pedidas: n * centros.length, radioKm: o.radioKm ?? 2, conSenal: true, recortado: false, quitadas: 0 };
    },
    quitarZonas: (c) => (llamadas.push(["quitar-zonas", c]), 500),
    estresFalso: null,
    probarEstres: (o) => {
      llamadas.push(["estres", o]);
      return Promise.resolve(api.estresFalso);
    },
    // Límite de un punto (v12.2)
    limiteFalso: null,
    evaluarPunto: (o) => {
      llamadas.push(["punto", o]);
      const c = api.centrosZona().find((x) => x.id === o.centro);
      return Promise.resolve({ nombre: c?.nombre ?? o.centro, zonas: null, estres: api.estresFalso, limite: api.limiteFalso ? { ...api.limiteFalso, id: o.centro, nombre: c?.nombre ?? o.centro, llenado: o.accion === "llenar" ? { personas: 320, estadoPunto: "aguanta", estadoRed: "aguanta", intentos: 1 } : null } : null, error: null });
    },
    evaluarPuntos: (o) => {
      llamadas.push(["puntos", o]);
      const lista = api.centrosZona().filter((c) => !o.centros?.length || o.centros.includes(c.id));
      return Promise.resolve({ limites: api.limiteFalso ? lista.map((c) => ({ ...api.limiteFalso, id: c.id, nombre: c.nombre })) : [], zonas: null, error: null });
    },
  };
  return api;
}


const nodos = () => [
  base("g", "Gateway", 4.2, -73.4, { pasarela: true, rol: "COMPANION" }),
  base("r1", "Repetidor 1", 4.25, -73.3, { rol: "REPETIDOR" }),
  base("r2", "Repetidor 2", 4.3, -73.25, { rol: "REPETIDOR" }),
  base("p1", "Persona 1", 4.22, -73.35, { tipo: "nodo", rol: "COMPANION" }),
  base("p2", "Persona 2", 4.21, -73.33, { tipo: "nodo", rol: "COMPANION" }),
  base("e", "Ejemplo", 4.2, -73.37),
  base("t2", "Torre 2", 4.3, -73.3),
];
/** La orden sin lo que solo se muestra o se escribe distinto en cada idioma (textos, nombres nuevos, lo dicho). */
const orden = (o) => (o ? JSON.stringify(o, (k, v) => (["nota", "lugarUsado", "descripcion", "clases", "etiqueta", "nombre", "medida", "pregunta", "texto", "titulo", "desde", "original"].includes(k) ? undefined : v)) : "null");
const contexto = { ultimoNodo: "r1", ultimoLugar: null };

/* ───────────── 1. El idioma: textos, marcas del motor, números y detección ───────────── */

caso("Idioma: español por defecto", m.idioma() === "es" && m.tx("Simular", "Simulate") === "Simular");
m.fijarIdioma("en");
caso("Idioma: inglés", m.tx("Simular", "Simulate") === "Simulate" && m.numeroLocal(1234.5, { maximumFractionDigits: 1 }) === "1,234.5" && m.decimalLocal(2.5, 1) === "2.5");
m.fijarIdioma("es");
caso("Idioma: números del español iguales a los de siempre", m.numeroLocal(1234.5, { maximumFractionDigits: 1 }) === (1234.5).toLocaleString("es-CO", { maximumFractionDigits: 1 }) && m.decimalLocal(2.5, 1) === "2,5");
m.modoBilingue(true);
const t = m.tx(`Hay ${m.tx("un nodo", "one node")} a ${m.decimalLocal(2.5, 1)} km`, `There is ${m.tx("un nodo", "one node")} at ${m.decimalLocal(2.5, 1)} km`);
const may = m.conMayuscula(m.tx("la red", "the network"));
const obj = { a: t, b: [may, { c: m.numeroLocal(1234.5, { maximumFractionDigits: 1 }) }], d: new Map([["k", m.tx("sí", "yes")]]), e: new Float32Array(2) };
m.modoBilingue(false);
caso("Motor bilingüe: un texto trae los dos idiomas", m.resolver(t, "es") === "Hay un nodo a 2,5 km" && m.resolver(t, "en") === "There is one node at 2.5 km", `${m.resolver(t, "es")} | ${m.resolver(t, "en")}`);
caso("Motor bilingüe: mayúscula en cada idioma", m.resolver(may, "es") === "La red" && m.resolver(may, "en") === "The network");
const r1 = m.recibirDelMotor(obj, "es");
caso("Motor bilingüe: lo que llega del motor se resuelve completo (listas, mapas) sin tocar los datos", r1.a === "Hay un nodo a 2,5 km" && r1.b[1].c === "1.234,5" && r1.d.get("k") === "sí" && r1.e === obj.e);
const estado = { fase: "listo", resultado: r1, otra: { x: 1 } };
const e2 = m.retraducir(estado, "en");
caso("Motor bilingüe: al cambiar de idioma, lo calculado cambia sin volver a calcular", e2.resultado.a === "There is one node at 2.5 km" && e2.resultado.b[1].c === "1,234.5" && e2.otra === estado.otra && m.retraducir(e2, "es").resultado.a === "Hay un nodo a 2,5 km");
const D = (s) => m.detectarIdioma(s).idioma;
const detecciones = [
  ["Add a repeater at 15 meters near the gateway", "en"], ["agrega un repetidor a 15 metros cerca del gateway", "es"], ["Pon el gateway en Cumaral", "es"],
  ["simula", null], ["Simulate", null], ["Hello Melki", null], ["Hello Melki, how are you?", "en"], ["¿Cómo está el gateway?", "es"], ["Take me to Bogotá", "en"],
  ["What's the coverage?", "en"], ["How many repeaters are there?", "en"], ["¿Cuántos repetidores hay?", "es"], ["show the results", "en"], ["muestra los resultados", "es"],
  ["Design a network for 500 hectares at 95%", "en"], ["diseña una red para 500 hectáreas al 95 %", "es"], ["ok", null], ["gracias", null], ["thank you so much", "en"],
];
const malDetectadas = detecciones.filter(([s, e]) => D(s) !== e).map(([s]) => `${s} → ${D(s)}`);
caso(`Detección del idioma (${detecciones.length} frases; las cortas o ambiguas no deciden)`, malDetectadas.length === 0, malDetectadas.join("; "));
const P = m.pedidoDeIdioma;
caso("Pedidos de idioma: «speak English», «habla en español»…", P("speak English") === "en" && P("Switch to English please") === "en" && P("habla en inglés") === "en" && P("en español") === "es" && P("Spanish please") === "es" && P("Melki, habla en español") === "es" && P("respond in spanish") === "es" && P("agrega un repetidor") === null && P("¿qué es el inglés?") === null);

/* ───────────── 2. Cambiar de idioma por lo que se escribe o se dice ───────────── */

{
  const nombres = ["Gateway", "Repetidor 1", "Repetidor 2", "Persona 1", "Ejemplo"];
  const malos = [];
  const C = (texto, esperado, lengua = "es") => {
    m.fijarIdioma(lengua);
    const c = m.cambioDeIdioma(texto, nombres);
    if ((c?.idioma ?? null) !== esperado) malos.push(`${lengua}: ${texto} → ${c?.idioma ?? null}`);
  };
  m.fijarCambioAutomatico(true);
  for (const x of ["How much does the network cost?", "add a repeater 5 km north of the gateway", "Take me to Barranca de Upía", "move Repetidor 1 two km north", "What is LoRa?", "Hello Melki, how are you?", "speak English", "please switch to English", "show me the results"]) C(x, "en");
  for (const x of ["¿Cuánto cuesta la red?", "simula", "ok", "Hello", "Hola Melki", "pon el gateway en Barranca de Upía", "gateway", "LoRa", "mueve el Repetidor 1 al norte", "WhatsApp", "Starlink", "sube Repetidor 1 a 20 m"]) C(x, null);
  for (const x of ["¿Cuántos repetidores hay en la red?", "pon el gateway en Cumaral por favor", "habla en español", "en español", "¿Qué es LoRa?", "muéstrame los resultados"]) C(x, "es", "en");
  for (const x of ["simulate", "ok", "Hola", "gateway", "go to Villavicencio", "What is LoRa?", "Barranca de Upía"]) C(x, null, "en");
  caso("Cambio automático: cambia con frases claras del otro idioma; los nombres de nodos y lugares no cuentan", malos.length === 0, malos.join("; "));
  m.fijarIdioma("es");
  m.fijarCambioAutomatico(false);
  caso("Con el cambio automático apagado, solo cambia si se lo piden", m.cambioDeIdioma("How much does the network cost?", nombres) === null && m.cambioDeIdioma("speak English", nombres)?.idioma === "en");
  m.fijarCambioAutomatico(true);
  const a = m.avisoCambio("en", false, "senor", true), b = m.avisoCambio("es", true, "senora");
  caso("El aviso del cambio, en el idioma nuevo y con botón para volver", /^I noticed you're speaking in English, sir/.test(a.texto) && a.volver === "Volver al español" && /^Con gusto, señora\. Desde ahora/.test(b.texto) && b.volver === "Switch back to English");
}

/* ───────────── 3. El traductor de pedidos: cada pedido en inglés da la misma orden que en español ───────────── */

{
  const pares = JSON.parse(readFileSync(path.join(aqui, "pares-ingles.json"), "utf8"));
  const malos = [];
  for (const [en, es] of pares) {
    const a1 = crearApi(nodos()), a2 = crearApi(nodos());
    let o1, o2, tr;
    try {
      o1 = m.interpretarOrden(es, a1, null, contexto);
    } catch (e) {
      o1 = `ERR ${e.message}`;
    }
    try {
      tr = m.traducirPedido(en, { nombres: a2.antenas().map((x) => x.nombre) });
      o2 = m.interpretarOrden(tr, a2, null, contexto);
    } catch (e) {
      o2 = `ERR ${e.message}`;
    }
    if (!o1 || orden(o1) !== orden(o2)) malos.push(`«${en}» → «${tr}» (esperado «${es}»)`);
  }
  caso(`Traductor: ${pares.length} pedidos en inglés dan la misma orden que en español`, malos.length === 0, malos.slice(0, 6).join(" | "));
  // Lo que ya viene en español (las órdenes de la IA, los tours, los botones) pasa igual estando en inglés
  m.fijarIdioma("en");
  const espanol = [...new Set([...pares.map((p) => p[1]), "ármame una red de 5 millas a la redonda de Barranca de Upía, Meta", "ármame una red que cubra 11.226 hectáreas con señal media o mejor en el 95 %", "pon 250 personas alrededor de cada repetidor y haz la prueba de estrés", "¿cuánto cuesta la red?", "ajústamelo sin pasar de 20 m", "llévame a Villavicencio", "muestra las vías", "explícame la red punto por punto", "deshaz lo último", "Inscribe un nodo antena en 4.23 -73.33", "Deshaz", "ve a Cumaral", "usa mesh tastic", "sube el Repetidor 1 a 20 m"])];
  const cambiadas = [];
  for (const es of espanol) {
    const a1 = crearApi(nodos()), a2 = crearApi(nodos());
    const tr = m.traducirPedido(es, { nombres: a2.antenas().map((x) => x.nombre) });
    if (orden(m.interpretarOrden(es, a1, null, contexto)) !== orden(m.interpretarOrden(tr, a2, null, contexto))) cambiadas.push(`«${es}» → «${tr}»`);
  }
  caso(`Traductor: ${espanol.length} pedidos en español dan la misma orden estando la pantalla en inglés`, cambiadas.length === 0, cambiadas.slice(0, 6).join(" | "));
  m.fijarIdioma("es");
}

/* ───────────── 4. Los mandos de la voz y las frases enteras en inglés ───────────── */

{
  const ACTIVAR_ASISTENTE = /\b(activa|enciende|prende|pon|inicia|abre|llama)\w* (el |al )?(modo )?(manos libres|jarvis|escucha|asistente( melki| de voz| por voz)?)\b|^escuchame$|^modo jarvis$|^(el )?asistente melki$|\bquiero hablarte\b/;
  const DESACTIVAR_ASISTENTE = /\b(desactiva|apaga|quita|termina|cierra)\w* (el )?(modo )?(manos libres|jarvis|escucha|asistente( melki| de voz| por voz)?)\b|\bdeja de escuchar\b/;
  const ACTIVAR_VOZ = /\b(activa|enciende|prende|pon)\w* (tu |la )?voz\b|\bhablame\b|\blee(me)? en voz alta\b/;
  const CALLAR_VOZ = /\b(desactiva|apaga|quita|silencia)\w* (tu |la )?voz\b|\bcallate\b|\bsilencio\b|\bno hables\b/;
  const VOZ_LENTA = /\b(habla|hablame|lee|leeme|dilo|dimelo)\w*\s+(un poco\s+)?(mas\s+)?(despacio|lento|lentamente|pausado|calmado|tranquilo)\b|^(mas despacio|mas lento)( por favor)?$/;
  const VOZ_RAPIDA = /\b(habla|hablame|lee|leeme|dilo|dimelo)\w*\s+(un poco\s+)?(mas\s+)?(rapido|deprisa|aprisa|ligero)\b|^(mas rapido)( por favor)?$/;
  const VOZ_NORMAL = /\b(habla|hablame)\w*\s+(normal|a ritmo normal|como antes|a tu ritmo)\b/;
  const REPETIR = /^(repite|repitelo|repiteme|repitemelo|me lo repites|me repites|puedes repetir|podrias repetir|repetir|otra vez)( lo que (dijiste|me dijiste|acabas de decir|dijo))?( eso)?( por favor)?( melki)?$/;
  const DESHACER = /\b(deshac\w*|deshaz|revierte|revertir|anula lo [uú]ltimo)\b/i;
  const RESULTADOS = /^(muestra\w*|abre|ensena\w*|ver|quiero ver|dejame ver)( me)? (los |el )?resultados?$/;
  const sin = (x) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const RX = { A: ACTIVAR_ASISTENTE, D: DESACTIVAR_ASISTENTE, V: ACTIVAR_VOZ, C: CALLAR_VOZ, L: VOZ_LENTA, R: VOZ_RAPIDA, N: VOZ_NORMAL, P: REPETIR, U: DESHACER, S: RESULTADOS };
  const casos = [
    ["turn on the assistant", "A"], ["activate the assistant", "A"], ["start the voice assistant", "A"], ["listen to me", "A"], ["jarvis mode", "A"], ["hands-free mode", "A"], ["i want to talk to you", "A"],
    ["turn off the assistant", "D"], ["stop listening", "D"], ["deactivate the assistant", "D"],
    ["talk to me", "V"], ["turn on your voice", "V"], ["read it aloud", "V"], ["speak out loud", "V"], ["read your answers aloud", "V"],
    ["stop talking", "C"], ["be quiet", "C"], ["turn off your voice", "C"], ["mute your voice", "C"], ["don't speak", "C"],
    ["speak slower", "L"], ["speak more slowly", "L"], ["slower", "L"], ["slow down", "L"],
    ["speak faster", "R"], ["faster please", "R"], ["speed up", "R"],
    ["speak normally", "N"], ["normal speed", "N"], ["back to normal speed", "N"],
    ["repeat that", "P"], ["say that again", "P"], ["again", "P"], ["could you repeat that please", "P"],
    ["undo", "U"], ["undo the last change", "U"], ["revert", "U"],
    ["show me the results", "S"], ["let me see the results", "S"], ["i want to see the results", "S"],
  ];
  const malos = [];
  for (const [en, k] of casos) {
    const es = m.traducirPedido(en, { nombres: ["Gateway"] });
    const s = sin(es);
    const o = s.replace(/[¿?¡!.,;:«»"]/g, " ").replace(/\s+/g, " ").trim();
    const ok = k === "S" ? RX.S.test(s.replace(/[¿?¡!.,]/g, "").trim()) : k === "U" ? RX.U.test(es) : ["L", "R", "N", "P"].includes(k) ? RX[k].test(o) : RX[k].test(s);
    if (!ok) malos.push(`${en} → ${es}`);
  }
  caso(`Mandos de la voz en inglés (${casos.length}): encender el asistente, la voz, el ritmo, repetir, deshacer, resultados`, malos.length === 0, malos.join("; "));
  const T = (x) => m.traducirPedido(x, {});
  caso("Frases enteras: sí, no, ninguna, la segunda, ¿qué hago ahora?", T("yes") === "sí" && T("no thanks") === "no" && T("none of them") === "ninguna" && T("the second one") === "la segunda" && T("What should I do next?") === "¿qué hago ahora?");
}

/* ───────────── 5. La voz en inglés ───────────── */

{
  const N = (x) => m.numerosEnPalabrasEn(x);
  const numeros = [
    ["two hundred fifty people", "250 people"], ["four point two five", "4.25"], ["minus seventy three point three seven", "-73.37"],
    ["eleven thousand two hundred and twenty-six hectares", "11226 hectares"], ["ninety nine point nine percent", "99.9 %"],
    ["two and a half km", "2.5 km"], ["half a mile", "0.5 mile"], ["a mile and a half", "1.5 mile"], ["a repeater", "a repeater"],
    ["Repeater one", "Repeater 1"], ["one of them", "one of them"], ["a hundred people", "100 people"], ["two million pesos", "2 million pesos"],
    ["120 million", "120 million"], ["twenty-five meters", "25 meters"], ["one hundred and fifty", "150"], ["3 thousand", "3000"],
  ];
  const malos = numeros.filter(([a, b]) => N(a) !== b).map(([a]) => `${a} → ${N(a)}`);
  caso(`Números dichos en inglés (${numeros.length})`, malos.length === 0, malos.join("; "));
  m.fijarIdioma("en");
  const voces = [
    { name: "Microsoft Gonzalo Online (Natural) - Spanish (Colombia)", lang: "es-CO" },
    { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US" },
    { name: "Microsoft Guy Online (Natural) - English (United States)", lang: "en-US" },
    { name: "Microsoft Sonia Online (Natural) - English (United Kingdom)", lang: "en-GB" },
    { name: "Microsoft Ryan Online (Natural) - English (United Kingdom)", lang: "en-GB" },
    { name: "Microsoft David - English (United States)", lang: "en-US" },
    { name: "Google UK English Male", lang: "en-GB" },
    { name: "Google UK English Female", lang: "en-GB" },
  ];
  const ordenVoces = (g) => [...voces].filter((v) => m.puntajeVoz(v, g) >= 0).sort((a, b) => m.puntajeVoz(b, g) - m.puntajeVoz(a, g)).map((v) => v.name.split(" ")[1]);
  caso("Voz en inglés: la británica serena (Ryan) primero, sin voces en español", ordenVoces("masculina")[0] === "Ryan" && !ordenVoces("masculina").includes("Gonzalo"), ordenVoces("masculina").join(","));
  caso("Voz en inglés femenina: Sonia primero", ordenVoces("femenina")[0] === "Sonia", ordenVoces("femenina").join(","));
  caso("Voz en inglés: las unidades se dicen en palabras", m.paraHablar("10 km at 20 m, 25 dB, 915 MHz") === "10 kilometers at 20 meters, 25 decibels, 915 megahertz", m.paraHablar("10 km at 20 m, 25 dB, 915 MHz"));
  const h = m.hablaNatural("Done: I placed Repeater 4 at 4.25, -73.30 (≥ 30 dB). The useful coverage is 45.1%.", { trato: "senor", vez: 0 });
  caso("Habla natural en inglés: «Done, sir.», sin coordenadas ni paréntesis, cifras redondeadas", h === "Done, sir. I placed Repeater 4 at that point. The useful coverage is 45%.", h);
  caso("Habla natural en inglés: varía cómo empieza", m.hablaNatural("Done: I simulated.", { trato: "senor", vez: 1 }).startsWith("Very well, sir.") && m.hablaNatural("Done: I simulated.", { trato: "senora", vez: 2 }).startsWith("All set, ma'am."));
  caso("La plata dicha en inglés: «COP 150,000,000» → «150 million pesos»", m.plataHabladaEn("It costs COP 150,000,000.") === "It costs 150 million pesos.");
  const f = m.frases("senor", 15);
  caso("Asistente en inglés: saludo según la hora y bienvenida", f.llamado(0, false) === "Good afternoon, sir. I'm listening; attentive and ready to follow your orders." && /^Good afternoon, sir\. Welcome\. I'm Melki/.test(f.bienvenida(true)) && /ma'am/.test(m.frases("senora", 9).llamado(0, false)));
  const c = m.controlDeVoz;
  caso("Controles de la voz en inglés", c("stop")?.tipo === "callar" && c("say that again")?.tipo === "repetir" && c("tell me more")?.tipo === "detalle" && c("yes, do it")?.tipo === "accion" && c("the second one")?.indice === 1 && c("thank you")?.tipo === "gracias" && c("never mind")?.tipo === "no" && c("stop listening")?.tipo === "apagar" && c("turn off the microphone")?.tipo === "microfono" && c("what can I say")?.tipo === "ayuda");
  caso("Lo dicho en inglés, listo para Melki: números y muletillas", m.limpiarComando("um so add five hundred people please") === "Add 500 people");
  caso("La voz deja el detalle escrito (en inglés)", /I've left the details in writing\.$/.test(m.textoParaVoz("First. Second. Third. Fourth sentence that is long enough to be cut off from what is said out loud, with plenty of extra words here.")));
  caso("La ayuda de la voz en inglés", /^I'm the Melki Assistant/.test(m.ayudaVoz()));
  m.fijarIdioma("es");
  caso("Español sin cambios: frases y controles del asistente", m.frases("senor").llamado(0, false) === "Hola, mi señor. Le escucho; estoy atento y presto a seguir sus órdenes." && /^Hello, sir\. Le escucho/.test(m.frases("senor").llamado(0, true)) && c("para")?.tipo === "callar" && c("la segunda")?.indice === 1);
  caso("Español sin cambios: la voz en español (Gonzalo, sin voces en inglés)", [...voces].filter((v) => m.puntajeVoz(v, "masculina") >= 0).map((v) => v.name.split(" ")[1]).join(",") === "Gonzalo");
}



/* ───────────── 6. Lo que Melki sabe, los tours, el recorrido y el pitch, en inglés ───────────── */

/** Palabras del español que no deberían quedar en una respuesta en inglés (fuera de los nombres propios). */
const RASTRO = /[¿¡«»ñ]|\b(el|los|las|del|para|que|usted|señor|señora|aquí|también|cuando|cómo|qué|está|están|listo|puse|quité|repetidor(?:es)?|personas?|cobertura|señal|simulación)\b/i;
const sinNombres = (t) => t.replace(/“[^”]*”|Barranca de Upía|Cumaral \(Meta\)|Villavicencio|Repetidor \d+|Persona \d+|Ejemplo|Torre \d+|Gonzalo|Salomé|Hola Melki|Oye Melki/g, "");
const enIngles = (t) => !RASTRO.test(sinNombres(t));
{
  m.fijarIdioma("en");
  const c = { antenas: nodos(), parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "plano", modo: "sembrar", trato: "senor", porVoz: false, vista: "Cumaral (Meta)", modeloMelki: { activo: true, aprendidas: 0 } };
  const preguntas = [
    ["What is LoRa?", "lora", /^LoRa is the long-range/],
    ["What is a repeater?", "repetidor", /^Trama's repeater/],
    ["How does a message travel?", "mensaje", /^This is how a payment travels/],
    ["How many payments can it handle?", "capacidad", null],
    ["Who made you?", "autoria", /^Created by Giancarlo González Guerrero/],
    ["What can you do?", "capacidades", null],
    ["Thank you very much", "gracias", null],
    ["Hello", "saludo", /^Hello! I'm Melki/],
    ["Where is the toolbar?", "barra", /little arrow in the top right corner/],
    ["How does the pencil work?", "lapiz", /^The mesh pencil is on the map bar/],
    ["How do I use the pencil?", "lapiz", /^The mesh pencil is on the map bar/],
    ["What is an optimal network?", "analista", /Optimal isn't the network with the most antennas/],
  ];
  const malas = [];
  for (const [q, tema, texto] of preguntas) {
    const r = m.responder(q, c);
    if (r.tema !== tema || (texto && !texto.test(r.texto)) || !enIngles(r.texto)) malas.push(`${q} → ${r.tema}: ${r.texto.slice(0, 90)}`);
  }
  caso(`El cerebro contesta en inglés (${preguntas.length} preguntas)`, malas.length === 0, malas.join(" | "));
  caso("La hora en inglés", m.horaHablada(new Date(2026, 0, 1, 15, 5)) === "It's 3:05 in the afternoon");
  const menu = m.menuTours();
  caso("El menú de tours y las sugerencias, en inglés", /^Which tour would you like to take\?/.test(menu.texto) && menu.acciones.every((a) => enIngles(a.texto)) && m.sugerencias()[0] === "Give me a tour" && m.SUGERENCIAS[0] === "Hazme un tour");
  caso("Los tours en inglés (los mismos objetos)", m.TOURS[0].nombre === "Basic tutorial" && m.pedidoDeTour("teach me to measure")?.acciones?.[0]?.tour === "medir");
  caso("El recorrido y el pitch se piden en inglés", m.pedidoRecorrido("walk me through the network", false)?.accion === "empezar" && m.pedidoPitch("present the business model", false)?.accion === "empezar" && m.pedidoRecorrido("next", true)?.accion === "siguiente" && m.pedidoPitch("pause", true)?.accion === "pausar", JSON.stringify([m.pedidoRecorrido("next", true), m.pedidoPitch("pause", true)]));
  caso("La plata dicha en el pitch, en inglés", m.pesosHablados(6.4e6) === "6.4 million pesos" && m.pesosHablados(1.5e9) === "1.5 billion pesos" && m.pesosHablados(178000) === "178 thousand pesos");
  m.fijarIdioma("es");
  caso("Español sin cambios: cerebro, tours, sugerencias, recorrido y pitch", m.responder("¿qué es lora?", { ...c }).texto.startsWith("LoRa es la forma de radio") && m.TOURS[0].nombre === "Tutorial básico" && m.sugerencias()[0] === "Hazme un tour" && m.pedidoRecorrido("hazme un recorrido por la red", false)?.accion === "empezar" && m.pesosHablados(6.4e6) === "6,4 millones de pesos");
}

/* ───────────── 7. Las órdenes hechas en inglés responden en inglés ───────────── */

{
  m.fijarIdioma("en");
  const ordenes = ["add a repeater 5 km north of the gateway", "raise Repeater 1 to 25 m", "simulate", "take me to Villavicencio", "show the roads", "use SF10", "move Person 1 2 km east", "delete Repeater 2", "set the frequency to 921.5 MHz", "90% reliability", "how much does the network cost?", "rename Repeater 1 to North Hill", "show the toolbar", "hide the top bar"];
  const malas = [];
  for (const en of ordenes) {
    const api = crearApi(nodos());
    const o = m.interpretarOrden(m.traducirPedido(en, { nombres: api.antenas().map((x) => x.nombre) }), api, null, contexto);
    if (!o) {
      malas.push(`${en}: sin orden`);
      continue;
    }
    const r = m.ejecutarOrden(o, api);
    const textos = [r.texto, r.voz ?? "", ...(r.acciones ?? []).map((a) => a.texto)].join(" ");
    if (!enIngles(textos)) malas.push(`${en}: ${textos.slice(0, 160)}`);
  }
  caso(`Órdenes en inglés: Melki contesta en inglés (${ordenes.length})`, malas.length === 0, malas.join(" | "));
  {
    const api = crearApi(nodos());
    const o = m.interpretarOrden(m.traducirPedido("show the toolbar", { nombres: [] }), api, null, contexto);
    const r = o ? m.ejecutarOrden(o, api) : null;
    caso("v17.1: «show the toolbar» explica la flechita, en inglés, sin abrir paneles", o?.tipo === "paneles" && o.barra === true && /little arrow in the top right corner/.test(r?.texto ?? "") && !api.llamadas.some((l) => l[0] === "paneles"), r?.texto);
  }
  m.fijarIdioma("es");
  const api = crearApi(nodos());
  const r = m.ejecutarOrden(m.interpretarOrden("sube el Repetidor 1 a 25 m", api, null), api);
  caso("Español sin cambios: la respuesta a una orden", !enIngles(r.texto) && /Repetidor 1/.test(r.texto), r.texto);
}

/* ───────────── 8. La IA (Gemini y la local) en inglés ───────────── */

{
  m.fijarIdioma("en");
  const h = m.herramientasIA();
  caso("Herramientas de la IA en inglés: mismos nombres y parámetros, descripciones en inglés", h.length === m.HERRAMIENTAS_IA.length && h.every((x, i) => x.name === m.HERRAMIENTAS_IA[i].name && JSON.stringify(Object.keys(x.parameters?.properties ?? {})) === JSON.stringify(Object.keys(m.HERRAMIENTAS_IA[i].parameters?.properties ?? {}))) && /Spanish/.test(h[0].description));
  const ins = m.instruccionesMelki("senor");
  caso("Instrucciones de la IA en inglés (mayordomo, «sir», órdenes en español)", /\bEnglish\b/.test(ins) && /\bsir\b/.test(ins) && /Spanish/.test(ins), ins.slice(0, 160));
  caso("Avisos de la IA local en inglés", m.textoTarjeta() !== m.TEXTO_TARJETA && m.textoTarjetaChat() !== m.TEXTO_TARJETA_CHAT && m.textoTarjetaBloqueada() !== m.TEXTO_TARJETA_BLOQUEADA && enIngles(m.textoTarjetaChat()));
  caso("Las cifras de la IA en inglés: «11,226» y «1,234.5»", JSON.stringify(m.numerosDe("11,226 ha and 1,234.5 m")) === JSON.stringify([11226, 1234.5]), JSON.stringify(m.numerosDe("11,226 ha and 1,234.5 m")));
  m.fijarIdioma("es");
  caso("Español sin cambios: herramientas, instrucciones y avisos de la IA", m.herramientasIA() === m.HERRAMIENTAS_IA && !/\bEnglish\b/.test(m.instruccionesMelki("senor")) && m.textoTarjetaChat() === m.TEXTO_TARJETA_CHAT);
}

/* ───────────── 9. v17.3 · El inglés con la misma facilidad que el español ───────────── */

{
  await m.cargarReferencia();
  /** El simulador de mentira con los lugares de verdad (municipios, departamentos y países, con su fonética). */
  const apiReal = () => {
    const a = crearApi(nodos());
    a.buscarLugar = (t) => m.buscarLugares(t, 6);
    a.reconocerLugar = (t) => m.reconocerLugares(t, { max: 6, departamento: "Meta" });
    return a;
  };
  const sinDicho = (o) => (o ? JSON.stringify(JSON.parse(orden(o)), (k, v) => (k === "dicho" ? undefined : v)) : "null");

  // El inglés natural: cortesía, contracciones, errores de tecleo y de dictado, números en palabras, millas y pies, el
  // inglés con la forma del español y frases de dos pruebas ciegas
  const frases = JSON.parse(readFileSync(path.join(aqui, "frases-ingles.json"), "utf8"));
  const malos = [];
  for (const [en, es] of frases) {
    m.fijarIdioma("es");
    const o1 = m.interpretarOrden(es, apiReal(), null, contexto);
    m.fijarIdioma("en");
    const a2 = apiReal();
    const tr = m.traducirPedido(en, { nombres: a2.antenas().map((x) => x.nombre) });
    const o2 = m.interpretarOrden(tr, a2, null, contexto);
    if (!o1 || sinDicho(o1) !== sinDicho(o2)) malos.push(`«${en}» → «${tr}» (esperado «${es}»)`);
  }
  m.fijarIdioma("es");
  caso(`v17.3 · Inglés natural: ${frases.length} pedidos dan la misma orden que en español`, malos.length === 0, malos.slice(0, 6).join(" | "));

  // Lo que se escribió en inglés, Melki lo contesta en inglés (con la pantalla ya en inglés)
  const rastros = [];
  for (const [en] of frases) {
    m.fijarIdioma("en");
    const a = apiReal();
    const o = m.interpretarOrden(m.traducirPedido(en, { nombres: a.antenas().map((x) => x.nombre) }), a, null, contexto);
    if (!o || o.tipo === "coordenada-sola") continue;
    const r = await m.ejecutarOrden(o, a);
    const textos = [r?.texto ?? "", r?.voz ?? "", ...(r?.acciones ?? []).map((x) => x.texto)].join(" ").replace(/Restrepo|Puerto López|Bogotá, D\. C\.|Bogotá|Cerro Azul|Loma Alta|\(Meta\)|Cundinamarca/g, "");
    if (!enIngles(textos)) rastros.push(`${en}: ${textos.slice(0, 120)}`);
  }
  m.fijarIdioma("es");
  caso(`v17.3 · Esas ${frases.length} órdenes, contestadas en inglés`, rastros.length === 0, rastros.slice(0, 4).join(" | "));

  // El idioma de una orden corta: el verbo con que empieza; los préstamos no deciden
  const P = (t) => m.idiomaProbable(t);
  const cortas = [
    ["Simulate", "en"], ["Optimize", "en"], ["optimise it", "en"], ["load the example", "en"], ["apply the optimization", "en"], ["set SF to 10", "en"], ["use SF10", null], ["Undo", "en"], ["accept the optimization", "en"], ["What is LoRa?", "en"],
    ["simula", "es"], ["optimiza", "es"], ["carga el ejemplo", "es"], ["usa SF10", "es"], ["deshaz", "es"], ["simule", "es"],
    ["ok", null], ["zoom", null], ["reset", null], ["stop", null], ["test", null], ["gateway", null], ["LoRa", null], ["hello", null], ["hola", null], ["gracias", null], ["thanks", null], ["Cumaral", null], ["SF10", null], ["MeshCore", null], ["check", null], ["play", null],
  ];
  const malasCortas = cortas.filter(([t, e]) => P(t) !== e).map(([t, e]) => `${t} → ${P(t)} (esperado ${e})`);
  caso(`v17.3 · El idioma de una orden corta (${cortas.length}): «Simulate» es inglés, «simula» español, «ok», «zoom» o «gateway» no deciden`, malasCortas.length === 0, malasCortas.join("; "));
  const nombres = ["Gateway", "Repetidor 1", "Persona 1"];
  m.fijarCambioAutomatico(true);
  m.fijarIdioma("es");
  const a1 = m.cambioDeIdioma("Simulate", nombres)?.idioma, a2 = m.cambioDeIdioma("Optimize the network", nombres)?.idioma, a3 = m.cambioDeIdioma("zoom", nombres), a4 = m.cambioDeIdioma("ok", nombres), a5 = m.cambioDeIdioma("Repetidor 1", nombres);
  m.fijarIdioma("en");
  const b1 = m.cambioDeIdioma("simula", nombres)?.idioma, b2 = m.cambioDeIdioma("carga el ejemplo", nombres)?.idioma, b3 = m.cambioDeIdioma("Hola", nombres), b4 = m.cambioDeIdioma("gracias", nombres);
  m.fijarIdioma("es");
  caso("v17.3 · Cambio automático también con órdenes cortas («Simulate», «simula»), no con préstamos ni nombres", a1 === "en" && a2 === "en" && a3 === null && a4 === null && a5 === null && b1 === "es" && b2 === "es" && b3 === null && b4 === null, JSON.stringify([a1, a2, a3, a4, a5, b1, b2, b3, b4]));

  // El español con palabras del inglés y los nombres de los nodos en el otro idioma
  const mezcla = [
    ["pon un repeater a 2 km al norte del gateway", "pon un repetidor a 2 km al norte del gateway"],
    ["haz el stress test", "haz la prueba de estrés"],
    ["agrega 3 repeaters", "agrega 3 repetidores"],
    ["ármame una red de 4 km in Villavicencio", "ármame una red de 4 km en Villavicencio"],
    ["muestra los results", "muestra los resultados"],
    // Con «usted»: el verbo del «tú» que entiende el intérprete
    ["Simule", "Simula"],
    ["ponga el gateway en Cumaral", "pon el gateway en Cumaral"],
    ["súbalo a 20 m", "súbelo a 20 m"],
    ["Use SF10", "Usa SF10"],
    ["Melki, muéstreme los resultados", "Melki, muéstrame los resultados"],
  ];
  const malasMezcla = mezcla.filter(([a, b]) => m.espanolDeMezcla(a, { nombres }) !== b).map(([a, b]) => `${a} → ${m.espanolDeMezcla(a, { nombres })} (esperado ${b})`);
  const ingleses = ["Gateway", "Repeater 1", "Person 1"];
  const alias = m.espanolDeMezcla("sube el Repetidor 1 a 20 m", { nombres: ingleses }) === "sube el Repeater 1 a 20 m" && m.espanolDeMezcla("elimina la Persona 1", { nombres: ingleses }) === "elimina la Person 1" && m.espanolDeMezcla("mueve el repeater 1 2 km al norte", { nombres }) === "mueve el Repetidor 1 2 km al norte";
  const igual = ["pon el gateway en Cumaral", "sube la torre 2 metros más", "¿cuánto cuesta la red?", "simula"].every((t) => m.espanolDeMezcla(t, { nombres: [...nombres, "Torre 2"] }) === t);
  const apiM = crearApi(nodos());
  const om = m.interpretarOrden(m.espanolDeMezcla("pon un repeater a 2 km al norte del gateway", { nombres: apiM.antenas().map((x) => x.nombre) }), apiM, null, contexto);
  // Los nombres por defecto no repiten número entre los dos idiomas
  const hay = [{ nombre: "Repetidor 1" }, { nombre: "Persona 1" }, { nombre: "Person 2" }];
  caso("v17.3 · Un nodo nuevo no repite el número del otro idioma («Repeater 2» si ya hay un «Repetidor 1»)", m.nombreLibre("Repeater", hay) === "Repeater 2" && m.nombreLibre("Repetidor", hay) === "Repetidor 2" && m.nombreLibre("Persona", hay) === "Persona 3" && m.nombreEnElOtroIdioma("Tower 4") === "Torre 4" && m.nombreEnElOtroIdioma("Loma Alta") === null, `${m.nombreLibre("Repeater", hay)} ${m.nombreLibre("Persona", hay)}`);
  // Un nodo llamado «Ejemplo»: «pon un repetidor al norte de Ejemplo» no carga el ejemplo (que borraría el mapa)
  const apiE = crearApi(nodos());
  const oe1 = m.interpretarOrden("pon un repetidor a 3 km al norte de Ejemplo", apiE, null, contexto);
  const oe2 = m.interpretarOrden("carga el ejemplo", apiE, null, contexto);
  const oe3 = m.interpretarOrden("pon el ejemplo de malla", apiE, null, contexto);
  caso("v17.3 · Con un nodo «Ejemplo» en el mapa, «pon un repetidor al norte de Ejemplo» no carga el ejemplo", oe1?.tipo === "pieza" && oe1.pieza === "repetidor" && oe2?.tipo === "ejemplo" && oe3?.tipo === "ejemplo-malla", JSON.stringify([oe1?.tipo, oe2?.tipo, oe3?.tipo]));
  caso("v17.3 · El español con palabras del inglés («pon un repeater…», «haz el stress test») y los nombres en el otro idioma", malasMezcla.length === 0 && alias && igual && om?.tipo === "pieza" && om.pieza === "repetidor", `${malasMezcla.join("; ")} ${alias} ${igual} ${JSON.stringify(om)}`);

  // Errores de tecleo y de dictado en inglés, sin tocar palabras que existen
  const corrige = [
    ["simualte the netwrok", "simulate the network"], ["add a repeat her 2 km north of the gate way", "add a repeater 2 km north of the gateway"], ["delte Repeater 2", "delete Repeater 2"], ["expotr the KMZ", "export the KMZ"],
    ["use mesh tastic", "use Meshtastic"], ["use s f 10", "use SF10"], ["Optmize", "Optimize"], ["shwo the roads", "show the roads"],
  ];
  const quedan = ["remote", "expert", "eight", "weight", "rise", "reads", "altitude", "lease", "tress", "rods", "antena", "loads", "minuets", "crate"];
  const malasOrto = [...corrige.filter(([a, b]) => m.corregirIngles(a) !== b).map(([a, b]) => `${a} → ${m.corregirIngles(a)} (esperado ${b})`), ...quedan.filter((p) => m.corregirIngles(p) !== p).map((p) => `${p} → ${m.corregirIngles(p)}`)];
  const respetaNombre = m.corregirIngles("move Rods 1 north", ["Rods 1"]) === "move Rods 1 north" && m.corregirIngles('call it "Netwrok"') === 'call it "Netwrok"';
  caso("v17.3 · Errores de tecleo y de dictado del inglés (sin tocar las palabras que existen ni los nombres)", malasOrto.length === 0 && respetaNombre, malasOrto.join("; "));

  // Números en palabras y medidas del inglés
  const N = m.numerosEnPalabrasEn;
  const numeros = [["add a repeater a kilometer north", "add a repeater 1 kilometer north"], ["a couple of repeaters", "2 repeaters"], ["a dozen people", "12 people"], ["10k people", "10000 people"], ["move it a quarter mile east", "move it 0.25 mile east"], ["three quarters of a mile", "0.75 mile"]];
  const malasNum = numeros.filter(([a, b]) => N(a) !== b).map(([a, b]) => `${a} → ${N(a)} (esperado ${b})`);
  m.fijarIdioma("en");
  const apiP = crearApi(nodos());
  const pies = m.interpretarOrden(m.traducirPedido("raise Repeater 1 to 80 feet", { nombres: apiP.antenas().map((x) => x.nombre) }), apiP, null, contexto);
  m.fijarIdioma("es");
  caso("v17.3 · Números en palabras del inglés («a kilometer», «a couple», «a dozen», «10k») y alturas en pies (80 ft → 24,4 m)", malasNum.length === 0 && pies?.tipo === "editar" && pies.cambios?.alturaM === 24.4, `${malasNum.join("; ")} ${JSON.stringify(pies)}`);

  // «¿Cuántos repetidores hay?» en los dos idiomas: la lista de los que hay (no cómo se diseña)
  const apiL = crearApi(nodos());
  const ol = m.interpretarOrden("¿cuántos repetidores hay?", apiL, null, contexto);
  const rl = ol ? m.ejecutarOrden(ol, apiL) : null;
  m.fijarIdioma("en");
  const ol2 = m.interpretarOrden(m.traducirPedido("how many repeaters are there?", { nombres: apiL.antenas().map((x) => x.nombre) }), apiL, null, contexto);
  const rl2 = ol2 ? m.ejecutarOrden(ol2, apiL) : null;
  m.fijarIdioma("es");
  const necesito = m.interpretarOrden("¿cuántos repetidores necesito para cubrir Cumaral?", crearApi(nodos()), null, contexto);
  caso("v17.3 · «¿Cuántos repetidores hay?» / «how many repeaters are there?»: los que hay en el mapa", ol?.tipo === "listar" && ol.filtro === "repetidores" && /^Hay 2 repetidores: Repetidor 1 \(15 m\), Repetidor 2 \(15 m\)\.$/.test(rl?.texto ?? "") && ol2?.filtro === "repetidores" && /^There are 2 repeaters:/.test(rl2?.texto ?? "") && necesito?.tipo !== "listar", `${rl?.texto} | ${rl2?.texto} | ${necesito?.tipo}`);

  // El cerebro entiende los dos idiomas con cualquier pantalla (y contesta en el de la pantalla)
  const ctx = { antenas: nodos(), parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "plano", modo: "sembrar", trato: "senor", porVoz: false, vista: "Cumaral (Meta)", modeloMelki: { activo: true, aprendidas: 0 } };
  m.fijarIdioma("es");
  const c1 = m.responder("What is LoRa?", ctx);
  m.fijarIdioma("en");
  const c2 = m.responder("¿qué es lora?", { ...ctx, lengua: "es" });
  const c3 = m.responder("hi Melki", ctx);
  m.fijarIdioma("es");
  caso("v17.3 · El cerebro entiende inglés con la pantalla en español (y al revés) y contesta en el de la pantalla", c1.tema === "lora" && /^LoRa es la forma de radio/.test(c1.texto) && c2.tema === "lora" && /^LoRa is the long-range/.test(c2.texto) && c3.tema === "saludo", `${c1.tema} ${c2.tema} ${c3.tema}`);

  // La voz: despedidas, «continue» y lo dicho en inglés con la pantalla en español (el doble oído)
  const v = m.controlDeVoz;
  caso("v17.3 · Mandos de voz: «thanks, bye», «gracias, chao», «see ya», «continue»", v("thanks, bye")?.despedida === true && v("gracias, chao")?.despedida === true && v("see ya")?.despedida === true && v("continue")?.tipo === "detalle" && m.limpiarComando("um so add five hundred people please", "en") === "Add 500 people", JSON.stringify([v("thanks, bye"), v("gracias, chao"), v("see ya"), v("continue"), m.limpiarComando("um so add five hundred people please", "en")]));

  // «it» es el último nodo que se tocó (como «muévelo»); «that one», el seleccionado si hay uno (como «mueve ese nodo»)
  const apiS = crearApi(nodos());
  apiS.seleccion = () => "r2";
  const nomS = apiS.antenas().map((x) => x.nombre);
  m.fijarIdioma("en");
  const oIt = m.interpretarOrden(m.traducirPedido("move it 1 km north", { nombres: nomS }), apiS, null, contexto);
  const oEse = m.interpretarOrden(m.traducirPedido("move that one 1 km north", { nombres: nomS }), apiS, null, contexto);
  const oUlt = m.interpretarOrden(m.traducirPedido("delete the last one", { nombres: nomS }), apiS, null, contexto);
  const tSimula = m.traducirPedido("simulate it", { nombres: nomS });
  const tOptimiza = m.traducirPedido("optimize it", { nombres: nomS });
  const tVoz = m.traducirPedido("turn it off", { nombres: nomS });
  m.fijarIdioma("es");
  caso(
    "v17.3 · «it», «that one» y «the last one»: el último nodo tocado, el seleccionado y el último puesto (y «simulate it» sigue igual)",
    oIt?.tipo === "mover" && oIt.id === "r1" && oEse?.tipo === "mover" && oEse.id === "r2" && oUlt?.tipo === "eliminar" && oUlt.id === "t2" && tSimula === "simula" && tOptimiza === "optimiza la red" && !/ese equipo/.test(tVoz),
    JSON.stringify([oIt?.id, oEse?.id, oUlt?.id, tSimula, tOptimiza, tVoz]),
  );

  // Los nombres nuevos quedan como se dijeron: con cortesía, con «call X …», hacia un rumbo, y escritos en español
  const nombreDe = (txt, lengua) => {
    const a = crearApi(nodos());
    const nombres = a.antenas().map((x) => x.nombre);
    m.fijarIdioma(lengua);
    const frase = lengua === "en" ? m.traducirPedido(txt, { nombres }) : m.espanolDeMezcla(txt, { nombres });
    const o = m.interpretarOrden(frase, a, null, contexto);
    m.fijarIdioma("es");
    return o?.tipo === "renombrar" ? `${o.id}:${o.nombre}` : `(${o?.tipo ?? "nada"}) ${frase}`;
  };
  const nombresNuevos = [
    ["please rename Repeater 1 to North Tower", "en", "r1:North Tower"],
    ["rename Repeater 1 to North Tower please", "en", "r1:North Tower"],
    ["can you rename Repeater 1 to Hill Tower?", "en", "r1:Hill Tower"],
    ["call Repeater 1 Hill Tower", "en", "r1:Hill Tower"],
    ["change Repeater 1's name to Hill Tower", "en", "r1:Hill Tower"],
    ["please call it Hill Tower, thanks", "en", "r1:Hill Tower"],
    ["rename Repeater 1 to North", "en", "r1:North"],
    ["renombra el Repetidor 1 como North Tower", "es", "r1:North Tower"],
    ["renombra el Repetidor 1 como Main Node", "es", "r1:Main Node"],
    ["renombra Repetidor 1 a Torre Norte por favor", "es", "r1:Torre Norte"],
    ["renómbralo a Loma Alta", "es", "r1:Loma Alta"],
  ];
  const malosNombres = nombresNuevos.map(([txt, l, esperado]) => [txt, nombreDe(txt, l), esperado]).filter(([, r, e]) => r !== e);
  const mezclaLlamado = m.espanolDeMezcla("agrega un repetidor llamado Repeater Hill en 4.5, -73.1", { nombres: nodos().map((x) => x.nombre) });
  caso(
    "v17.3 · Los nombres nuevos no se traducen ni se llevan la cortesía («North Tower», no «North torre» ni «… please»)",
    malosNombres.length === 0 && /llamado Repeater Hill en/.test(mezclaLlamado),
    `${malosNombres.map((x) => x.join(" → ")).join("; ")} | ${mezclaLlamado}`,
  );

  // Preguntas con algo más no son la pregunta corta («how many people are out of range?» no es la lista de todos)
  const tr = (x) => {
    m.fijarIdioma("en");
    const r = m.traducirPedido(x, { nombres: nodos().map((n) => n.nombre) });
    m.fijarIdioma("es");
    return r;
  };
  const noSon = [
    ["do I need an extra repeater?", "¿sobran antenas?"],
    ["how much does an extra repeater cost?", "¿sobran antenas?"],
    ["should I buy a spare repeater?", "¿sobran antenas?"],
    ["what is the optimal height for this repeater?", "¿la red es óptima?"],
    ["how many people are out of range?", "¿cuántas personas hay?"],
    ["how many people are connected?", "¿cuántas personas hay?"],
    ["how many people does Repeater 1 serve?", "¿cuántas personas hay?"],
    ["how many repeaters should I add?", "¿cuántos repetidores hay?"],
    ["how many people are in Cumaral?", "¿cuántas personas hay?"],
  ].filter(([x, mal]) => tr(x) === mal);
  const siSon = [
    ["how many repeaters do we have?", "¿cuántos repetidores hay?"],
    ["how many repeaters are on the map right now?", "¿cuántos repetidores hay?"],
    ["is this network optimal?", "¿la red es óptima?"],
    ["are there too many repeaters?", "¿sobran antenas?"],
    ["do I need all these repeaters?", "¿sobran antenas?"],
  ].filter(([x, bien]) => tr(x) !== bien);
  caso("v17.3 · Las preguntas cortas en inglés no se tragan las largas («do I need an extra repeater?» no es «¿sobran antenas?»)", noSon.length === 0 && siSon.length === 0, JSON.stringify([noSon, siSon.map(([x]) => `${x} → ${tr(x)}`)]));

  // En español, «¿cuántas personas hay conectadas?» tampoco es la lista; y la lista larga se corta
  const apiLq = crearApi(nodos());
  const listan = [
    "¿cuántas personas hay con señal?",
    "¿cuántas personas hay conectadas?",
    "¿cuántas personas tengo sin conexión?",
    "¿cuántas personas quedan por conectar?",
    "¿qué repetidores hay en rojo?",
    "¿cuántos usuarios hay por repetidor?",
    "¿qué repetidores tengo que mover?",
  ].filter((x) => m.interpretarOrden(x, apiLq, null, contexto)?.tipo === "listar");
  const muchas = [...nodos(), ...Array.from({ length: 40 }, (_, k) => base(`px${k}`, `Persona ${k + 3}`, 4.2 + k / 1000, -73.3, { tipo: "nodo", rol: "COMPANION" }))];
  const apiMuchas = crearApi(muchas);
  const oM = m.interpretarOrden("¿cuántas personas hay?", apiMuchas, null, contexto);
  const rM = oM ? m.ejecutarOrden(oM, apiMuchas) : null;
  caso(
    "v17.3 · «¿cuántas personas hay conectadas?» no es la lista de todas; con 42 personas, la lista dice 15 «y 27 más»",
    listan.length === 0 && oM?.tipo === "listar" && /^Hay 42 personas: .* y 27 más\.$/.test(rM?.texto ?? "") && (rM?.texto.match(/\(15 m\)/g) ?? []).length === 15,
    `${listan.join("; ")} | ${rM?.texto.slice(0, 80)}…${rM?.texto.slice(-30)}`,
  );

  // Lo que no debe hacer: cargar el ejemplo sin pedirlo, mover un nodo a «22 dBm», tragarse «just the map»
  const tEj = tr("give me an example");
  const tCarga = tr("load the example");
  const apiD = crearApi(nodos());
  m.fijarIdioma("en");
  const oDbm = m.interpretarOrden(m.traducirPedido("set Repeater 1 to 22 dBm", { nombres: apiD.antenas().map((x) => x.nombre) }), apiD, null, contexto);
  const oSf = m.interpretarOrden(m.traducirPedido("set Repeater 1 to SF10", { nombres: apiD.antenas().map((x) => x.nombre) }), apiD, null, contexto);
  m.fijarIdioma("es");
  const tMapa = tr("just the map");
  caso(
    "v17.3 · «give me an example» no carga el ejemplo; «set Repeater 1 to 22 dBm» no lo mueve; «just the map» es la pantalla limpia",
    tEj !== "carga el ejemplo" && tCarga === "carga el ejemplo" && oDbm?.tipo !== "mover" && oSf?.tipo !== "mover" && tMapa === "pantalla limpia",
    JSON.stringify([tEj, tCarga, oDbm?.tipo, oSf?.tipo, tMapa]),
  );

  // Una pregunta («what happens if I move it…?») no es la orden, como «¿qué pasa si lo muevo…?»; «next to» es «cerca de»
  const apiH = crearApi(nodos());
  m.fijarIdioma("en");
  const hipoteticas = ["what happens if I move it 2 km east?", "what if I add a repeater 2 km north of the gateway?", "would it help to raise Repeater 1 to 30 m?"]
    .map((x) => [x, m.interpretarOrden(m.traducirPedido(x, { nombres: apiH.antenas().map((n) => n.nombre) }), apiH, null, contexto)?.tipo ?? null])
    .filter(([, t]) => t && t !== "coordenada-sola");
  const junto = m.traducirPedido("move Repeater 1 next to the gateway", { nombres: apiH.antenas().map((n) => n.nombre) });
  const oJunto = m.interpretarOrden(junto, apiH, null, contexto);
  m.fijarIdioma("es");
  // v17.4 · «next to the gateway» acerca el Repetidor 1 al gateway (a 200 m), no mueve el gateway
  const gJ = apiH.antenas().find((x) => x.id === "g");
  const dJ = oJunto?.coord ? Math.hypot((oJunto.coord.lat - gJ.lat) * 111320, (oJunto.coord.lon - gJ.lon) * 111320 * Math.cos((gJ.lat * Math.PI) / 180)) : -1;
  caso("v17.3 · «what happens if I move it…?» pregunta (no mueve nada); «next to the gateway» es junto al gateway", hipoteticas.length === 0 && /cerca del gateway|acerca .* al gateway/.test(junto) && !/luego/.test(junto) && oJunto?.tipo === "mover" && oJunto.id === "r1" && Math.abs(dJ - 200) < 5, JSON.stringify([hipoteticas, junto, oJunto, Math.round(dJ)]));

  // Palabras de los dos idiomas que no deciden el idioma, y el corrector del inglés no toca las palabras con tilde
  const pIncline = m.idiomaProbable("incline Repeater 1 5 degrees down");
  const pHas = m.idiomaProbable("has simulado");
  const conTilde = m.corregirIngles("conectó El Cantón y mírenme");
  caso(
    "v17.3 · «incline…» no es español, «has simulado» no es inglés; «conectó», «El Cantón» quedan iguales",
    pIncline !== "es" && pHas !== "en" && conTilde === "conectó El Cantón y mírenme",
    JSON.stringify([pIncline, pHas, conTilde]),
  );

  // «Gracias, Melki» y «thanks Melki» son las gracias (no «¿quién eres?»); «Melki» solo sigue siendo quién es
  m.fijarIdioma("es");
  const g1 = m.responder("gracias melki", ctx);
  const g3 = m.responder("melki", ctx);
  m.fijarIdioma("en");
  const g2 = m.responder("thanks melki", ctx);
  m.fijarIdioma("es");
  caso("v17.3 · «gracias, Melki» / «thanks Melki»: las gracias; «Melki» solo: quién es", g1.tema === "gracias" && g2.tema === "gracias" && g3.tema === "quien", JSON.stringify([g1.tema, g2.tema, g3.tema]));
}

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodas las pruebas del inglés pasaron");
process.exit(fallos ? 1 : 0);
