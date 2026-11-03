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
export { traducirPedido } from "./src/components/melki/ingles";
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

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodas las pruebas del inglés pasaron");
process.exit(fallos ? 1 : 0);
