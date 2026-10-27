// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Pruebas de Melki (sin navegador): interpreta pedidos en español y los ejecuta sobre un simulador de mentira.
// Uso: npm run prueba:melki
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const entrada = `
export { interpretarOrden, ejecutarOrden, extraerCoordenadas, extraerVariasCoordenadas, dividirEnPasos, leerNumero, areaEnTexto } from "./src/components/melki/ordenes";
export { responder, noEntendiOrden, respuestaNoEntendi } from "./src/components/melki/cerebro";
export { areaM2, poligonoCirculo, recortarPoligono } from "./src/lib/radio/area";
export { claveFonetica, parecidoFonetico } from "./src/lib/geo/fonetica";
export { normalizarDictado, componerTexto, quitarRepeticiones, corregirPalabras, clavePalabras, quitarTartamudeo, loNuevo, iniciarDictado } from "./src/components/melki/dictado";
export { TOURS } from "./src/components/melki/tours";
export { pedidoDeTour } from "./src/components/melki/cerebro";
export { numerosEnPalabras } from "./src/components/melki/numeros";
export { detectarActivacion, controlDeVoz, limpiarComando, textoParaVoz, pareceEco, empiezaConNombre, AYUDA_VOZ, SALUDO_MANOS_LIBRES, esNombre, frases, elegirAlternativa } from "./src/components/melki/manos-libres";
export { buscarLugares, cargarReferencia, pareceNombre, reconocerLugares, decidirLugar, contornoLugar, nombresParaVoz, textoUbicacion } from "./src/lib/geo/referencia";
export { costoRedTrama } from "./src/lib/radio/trama";
export { paraHablar, puntajeVoz } from "./src/components/melki/voz";
export { estadoInicial, reductor } from "./src/components/simulador/estado";
export { estadoRed } from "./src/lib/radio/estado-red";
export { FICHA_GATEWAY } from "./src/lib/radio/protocolos";
export { pedidoPitch } from "./src/lib/negocio/pitch";
export { SesionLive, mensajeSetup, motivoCierre, cierreRecuperable, aBase64, deBase64, pcmDeBytes, bytesDePcm, MODELO_IA_DEFECTO } from "./src/components/melki/ia-live";
export { aPcm16k } from "./src/components/melki/audio-ia";
export { HERRAMIENTAS_IA, instruccionesMelki, estadoParaIA } from "./src/components/melki/herramientas-ia";
`;
const tmp = mkdtempSync(path.join(os.tmpdir(), "melki-"));
const archivo = path.join(tmp, "melki.mjs");
const r = await build({ stdin: { contents: entrada, resolveDir: repo, loader: "ts" }, bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
writeFileSync(archivo, r.outputFiles[0].text);
const m = await import(pathToFileURL(archivo).href);

let fallos = 0;
const caso = (nombre, ok, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` (${detalle})` : ""}`);
  if (!ok) fallos++;
};
const cerca = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;

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

// 1) La frase exacta del usuario (sin coordenada): Melki pide la coordenada y la recuerda
{
  const api = crearApi([base("e", "Ejemplo", 4.2, -73.37, { pasarela: true })]);
  const frase = "Hola Melki ayudame a inscribir una antena en esta cordenada para realizar la simulacion de su alcance porfavor";
  const o = m.interpretarOrden(frase, api, null);
  caso("Frase del usuario → inscribir (no un saludo)", o?.tipo === "agregar" && !o.coord, JSON.stringify(o));
  const res = m.ejecutarOrden(o, api);
  caso("Pide la coordenada y queda pendiente", res.pendiente?.tipo === "agregar" && /coordenada/.test(res.texto));
  const o2 = m.interpretarOrden("4°30'44.3\" N 73°07'24\" O", api, res.pendiente);
  caso("La coordenada siguiente completa el pedido", o2?.tipo === "agregar" && cerca(o2.coord.lat, 4.512306) && cerca(o2.coord.lon, -73.123333), JSON.stringify(o2?.coord));
  const res2 = m.ejecutarOrden(o2, api);
  caso("Inscribe el nodo antena y espera la simulación", api.llamadas.some((l) => l[0] === "agregar") && res2.esperar === "n1" && res2.deshacer && /inscrib/i.test(res2.texto));
  caso("No edita el nodo Ejemplo que ya existía", !api.llamadas.some((l) => l[0] === "editar"));
}

// 2) Con coordenada, nombre y altura en la misma frase
{
  const api = crearApi([]);
  const o = m.interpretarOrden("Inscribe un nodo antena llamado Torre Norte en 4.5123, -73.1234 a 20 m", api, null);
  caso("Nombre, altura y coordenada", o?.tipo === "agregar" && o.datos.nombre === "Torre Norte" && o.datos.alturaM === 20 && o.datos.tipo === "antena" && cerca(o.coord.lon, -73.1234), JSON.stringify(o));
}

// 3) Nodo de campo con longitud sin signo (se toma al oeste) y «nodoantena» pegado
{
  const api = crearApi([]);
  const o = m.interpretarOrden("agrega un nodo portátil en 4.31, 73.42", api, null);
  caso("Nodo de campo, longitud al oeste", o?.tipo === "agregar" && o.datos.tipo === "nodo" && cerca(o.coord.lon, -73.42) && o.coord.corregido === true, JSON.stringify(o));
  const o2 = m.interpretarOrden("registra un nodoantena en 4.1, -73.2", api, null);
  caso("«nodoantena» se entiende como nodo antena", o2?.tipo === "agregar" && o2.datos.tipo === "antena", JSON.stringify(o2?.datos));
}

// 4) Órdenes sobre un nodo existente
{
  const antenas = [base("e", "Ejemplo", 4.2, -73.37, { pasarela: true }), base("t", "Torre 2", 4.25, -73.3)];
  const api = crearApi(antenas);
  const mover = m.interpretarOrden("mueve Ejemplo a 4.25, -73.40", api, null);
  caso("Mover", mover?.tipo === "mover" && mover.id === "e" && cerca(mover.coord.lat, 4.25));
  const subir = m.interpretarOrden("sube Torre 2 a 25 m", api, null);
  caso("Cambiar altura", subir?.tipo === "editar" && subir.id === "t" && subir.cambios.alturaM === 25);
  const pas = m.interpretarOrden("marca Torre 2 como pasarela", api, null);
  caso("Marcar pasarela", pas?.tipo === "editar" && pas.cambios.pasarela === true);
  const del = m.interpretarOrden("elimina Torre 2", api, null);
  caso("Eliminar", del?.tipo === "eliminar" && del.id === "t");
  const dist = m.interpretarOrden("distancia entre Ejemplo y Torre 2", api, null);
  caso("Distancia entre nodos", dist?.tipo === "distancia" && dist.a.id === "e" && dist.b.id === "t");
  const res = m.ejecutarOrden(dist, api);
  caso("La distancia queda como medición de la regla", api.llamadas.some((l) => l[0] === "medir") && /km|m en línea recta/.test(res.texto), res.texto);
  const pon = m.interpretarOrden("ponle a la antena Ejemplo 30 m", api, null);
  caso("«ponle a la antena Ejemplo 30 m» edita, no inscribe", pon?.tipo === "editar" && pon.cambios.alturaM === 30, JSON.stringify(pon));
}

// 5) Mapa, herramientas y parámetros
{
  const api = crearApi([base("e", "Ejemplo", 4.2, -73.37, { pasarela: true })]);
  const ir = m.interpretarOrden("llévame a Villavicencio", api, null);
  caso("Ir a un municipio", ir?.tipo === "ir" && ir.lugar?.nombre === "Villavicencio");
  caso("Activar la regla", m.interpretarOrden("activa la regla", api, null)?.tipo === "herramienta");
  caso("Simular", m.interpretarOrden("simula por favor", api, null)?.tipo === "simular");
  const radio = m.interpretarOrden("radio de 12 km", api, null);
  caso("Radio de estudio", radio?.tipo === "parametros" && radio.cambios.radioKm === 12);
  caso("Ajuste de radio: «usa SF10»", m.interpretarOrden("usa SF10", api, null)?.cambios?.preset === "SF10_250");
  caso("Ajuste de radio: «usa el de capacidad»", m.interpretarOrden("usa el preset de capacidad", api, null)?.cambios?.preset === "SF9_250");
  caso("Límite de saltos de MeshCore hasta 64", m.interpretarOrden("pon el límite de saltos en 12", api, null)?.cambios?.limiteSaltos === 12);
  caso("Señal en un punto", m.interpretarOrden("¿llega señal a 4.21, -73.35?", api, null)?.tipo === "senal");
  caso("Coordenada sola → opciones", m.interpretarOrden("4.51, -73.12", api, null)?.tipo === "coordenada-sola");
  caso("Pregunta general → la contesta el cerebro", m.interpretarOrden("¿qué es la pasarela?", api, null) === null);
}

// 6) Cerebro: términos «nodo» y «nodo antena», saludo largo
{
  const c = { antenas: [], parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas" };
  caso("¿Qué es un nodo antena?", /nodo antena es infraestructura/.test(m.responder("¿Qué es un nodoantena?", c).texto));
  caso("Saludo largo no responde con el saludo genérico", !/Pídamelo con sus palabras o le muestro/.test(m.responder("hola melki como mido una distancia en el mapa", c).texto));
}

// 7) Funciones de Radio Mobile: parámetros de red, antenas direccionales, entorno, unidades e informe
{
  const ej = base("e", "Ejemplo", 4.2, -73.37, { pasarela: true });
  const t2 = base("t", "Torre 2", 4.25, -73.3);
  const api = crearApi([ej, t2]);
  const orden = (t) => m.interpretarOrden(t, api, null);
  const c90 = orden("simula con una confiabilidad del 90 %");
  caso("Confiabilidad del 90 %", c90?.tipo === "parametros" && c90.cambios.tiempoPct === 90 && c90.cambios.situacionesPct === 90, JSON.stringify(c90?.cambios));
  caso("Confiabilidad alta", orden("pon la confiabilidad alta")?.cambios?.situacionesPct === 90);
  caso("95 % del tiempo", orden("usa 95 % del tiempo")?.cambios?.tiempoPct === 95);
  caso("Polarización horizontal", orden("cambia la polarización a horizontal")?.cambios?.polarizacion === "horizontal");
  const clima = orden("usa clima continental templado");
  caso("Clima con su refractividad", clima?.cambios?.clima === 5 && clima.cambios.refractividad === 301, JSON.stringify(clima?.cambios));
  caso("Suelo húmedo", orden("el suelo es húmedo")?.cambios?.suelo === "bueno");
  caso("Modo accidental", orden("modo accidental")?.cambios?.variabilidad === "accidental");
  caso("Usar Longley-Rice", orden("usa Longley-Rice como Radio Mobile")?.cambios?.modelo === "itm");
  caso("¿Qué es Longley-Rice? → cerebro", orden("¿qué es Longley-Rice?") === null);
  caso("Restablecer Radio Mobile", orden("restablece los parámetros de Radio Mobile")?.cambios?.clima === 1);
  const yagi = orden("ponle una antena yagi a Ejemplo apuntando a Torre 2");
  caso("Yagi apuntando a otro nodo", yagi?.tipo === "editar" && yagi.cambios.patron === "yagi" && yagi.cambios.gananciaDbi === 11 && Math.abs(yagi.cambios.azimutDeg - 54) < 2, JSON.stringify(yagi?.cambios));
  const largo = crearApi([base("e", "Ejemplo", 4.2, -73.37), base("n", "Torre Norte Grande", 4.26, -73.3)]);
  const sujeto = m.interpretarOrden("ponle una yagi a Ejemplo apuntando a Torre Norte Grande", largo, null);
  caso("La Yagi va al primer nodo nombrado, no al de nombre más largo", sujeto?.tipo === "editar" && sujeto.id === "e", JSON.stringify(sujeto));
  const omni = orden("apunta Ejemplo al noreste");
  caso("Apuntar una omnidireccional ofrece direccionales", omni?.tipo === "apuntar-omni" && omni.azimutDeg === 45 && m.ejecutarOrden(omni, api).acciones?.length === 3);
  ej.patron = "yagi";
  ej.azimutDeg = 10;
  caso("Apuntar una Yagi al noreste", orden("apunta Ejemplo al noreste")?.cambios?.azimutDeg === 45);
  caso("Apuntar a 120°", orden("orienta Ejemplo a 120 grados")?.cambios?.azimutDeg === 120);
  caso("Inclinar 5° hacia abajo", orden("inclina Ejemplo 5° hacia abajo")?.cambios?.elevacionDeg === -5);
  caso("Volver a omnidireccional", orden("ponle a Ejemplo una antena omnidireccional")?.cambios?.patron === undefined);
  caso("Vegetación densa → bosque", orden("simula con vegetación densa")?.cambios?.entorno === "bosque");
  caso("Plantación de palma", orden("la zona es una plantación de palma")?.cambios?.entorno === "plantacion");
  caso("Campo abierto", orden("considera campo abierto")?.cambios?.entorno === "abierto");
  const dbm = orden("muestra la señal en dBm");
  caso("Mostrar en dBm", dbm?.tipo === "vista" && dbm.cambios.unidad === "dbm");
  caso("Mostrar en microvoltios", orden("muéstrame la cobertura en µV")?.cambios?.unidad === "uv");
  const arco = orden("colores arcoíris de -120 a -70 dBm");
  caso("Arcoíris con niveles", arco?.cambios?.escala === "arcoiris" && arco.cambios.escalaMinDbm === -120 && arco.cambios.escalaMaxDbm === -70, JSON.stringify(arco?.cambios));
  caso("Umbral de -105 dBm", orden("pinta solo con umbral de -105 dBm")?.cambios?.umbralDbm === -105);
  const inf = orden("informe del enlace Ejemplo y Torre 2");
  caso("Informe del radioenlace", inf?.tipo === "informe" && inf.a === "e");
  m.ejecutarOrden(inf, api);
  caso("Abre el perfil con el informe desplegado", api.llamadas.some((l) => l[0] === "perfil" && l[3] === true));
  const nuevo = orden("inscribe una antena yagi en 4.5, -73.1 apuntando al norte");
  caso("Inscribir una Yagi", nuevo?.tipo === "agregar" && nuevo.datos.patron === "yagi" && nuevo.datos.gananciaDbi === 11 && nuevo.datos.azimutDeg === 0, JSON.stringify(nuevo?.datos));
  const c = { antenas: [ej, t2], parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas" };
  caso("¿Qué es una antena Yagi? → direccionales", /Concentran la señal/.test(m.responder("¿qué es una antena yagi?", c).texto));
  caso("¿Qué es la confiabilidad?", /qué tan seguido/.test(m.responder("¿qué es la confiabilidad?", c).texto));
  caso("¿Qué unidades hay?", /µV/.test(m.responder("¿en qué unidades puedo ver la señal?", c).texto));
}

// 8) Dictado por voz: el texto dictado se ajusta para las órdenes y se junta con lo ya escrito
{
  caso("«4 punto 25 menos 73 punto 30» → «4.25 -73.30»", m.normalizarDictado("inscribe un nodo antena en 4 punto 25 menos 73 punto 30") === "inscribe un nodo antena en 4.25 -73.30");
  caso("Grados, minutos y segundos dictados", m.normalizarDictado("4 grados 13 minutos 30 segundos norte") === `4°13'30" norte`);
  caso("Mayúscula inicial con la caja vacía", m.componerTexto("", "sube ejemplo a 25 metros") === "Sube ejemplo a 25 m");
  caso("Se agrega a lo que ya estaba escrito", m.componerTexto("Inscribe un nodo", "en 4 coma 5 menos 73 coma 1") === "Inscribe un nodo en 4.5 -73.1");
  caso("Los números dictados en palabras quedan en cifras", m.componerTexto("", "puebla la zona con doscientas cincuenta personas") === "Puebla la zona con 250 personas" && m.componerTexto("", "sube el repetidor uno a veinte metros") === "Sube el repetidor 1 a 20 m");
  caso("Se quitan las frases repetidas del reconocedor privado", m.quitarRepeticiones("no podemos decir que no podemos decir que no podemos decir que") === "no podemos decir que", m.quitarRepeticiones("no podemos decir que no podemos decir que no podemos decir que"));
  caso("No se tocan las palabras repetidas normales", m.quitarRepeticiones("sube la antena a la torre") === "sube la antena a la torre");
  const c = { antenas: [], parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas" };
  caso("¿Cómo te dicto por voz? → explica el micrófono", /micrófono/.test(m.responder("¿cómo te dicto por voz?", c).texto));
  const api = crearApi([]);
  const o = m.interpretarOrden(m.componerTexto("", "inscribe un nodo antena en 4 punto 25 menos 73 punto 30"), api, null);
  caso("La orden dictada se entiende", o?.tipo === "agregar" && cerca(o.coord.lat, 4.25) && cerca(o.coord.lon, -73.3), JSON.stringify(o?.coord));
}

// 9) Tours guiados: Melki pregunta qué tour, atiende pedidos por nombre y cada paso práctico se puede hacer «por mí»
{
  const c = { antenas: [], parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas" };
  const menu = m.responder("Hazme un tour", c);
  caso(
    "«Hazme un tour» → menú con los 9 tours, el básico primero",
    menu.acciones?.length === 9 && menu.acciones[0].tour === "basico" && /recomendado/.test(menu.acciones[0].texto) && menu.acciones.every((a) => a.accion === "recorrido" && a.detalle),
    menu.acciones?.map((a) => a.tour).join(","),
  );
  caso("«Ayuda» → menú de tours", m.responder("ayuda", c).acciones?.length === 9);
  const pedido = (q) => m.responder(q, c).acciones?.[0]?.tour;
  for (const [q, id] of [
    ["quiero el tutorial", "basico"],
    ["hazme el tutorial básico", "basico"],
    ["un tour por la pantalla", "pantalla"],
    ["hazme el tour de Radio Mobile", "radiomobile"],
    ["enséñame a medir distancias y exportar a Google Earth", "medir"],
    ["tour de la red mesh con varios nodos", "mesh"],
    ["guíame para hablar con Melki y dictarle", "melki"],
    ["hazme el tour de sembrar la malla", "sembrar"],
    ["enséñame a poner el gateway y los repetidores", "sembrar"],
  ])
    caso(`«${q}» → tour ${id}`, pedido(q) === id, pedido(q));
  caso("Una pregunta sin pedir tour no abre el menú", !m.responder("¿qué es la confiabilidad?", c).acciones?.some((a) => a.detalle));
  caso("«¿Qué puedes hacer?» ofrece los tours", m.responder("¿qué puedes hacer?", c).acciones?.some((a) => a.accion === "tours"));

  const ids = m.TOURS.map((x) => x.id);
  caso("Nueve tours con nombre, detalle e introducción", ids.length === 9 && new Set(ids).size === 9 && m.TOURS.every((x) => x.nombre && x.detalle && x.pasos.length >= 4 && !x.pasos[0].objetivo && !x.pasos[0].tarea));
  caso("El tutorial básico tiene 7 pasos", m.TOURS[0].id === "basico" && m.TOURS[0].pasos.length === 8);

  // Cada paso práctico: no está hecho al entrar, «Hágalo por mí» lo hace y se detecta (con un simulador de mentira)
  const SOLO_PANTALLA = new Set(["medir:A Google Earth", "voz:Active el asistente"]); // dependen de botones en pantalla
  for (const tour of m.TOURS.filter((x) => x.practica && x.id !== "melki")) {
    let estado = { ...m.estadoInicial(), escenario: tour.practica.escenario(), autoSimular: tour.practica.autoSimular };
    let alDia = false;
    let inspeccion = null;
    let perfil = null;
    let perfilTerreno = false;
    let siembra = "nada";
    let propuesta = null;
    let mensaje = 0;
    let carga = "nada";
    let estres = "nada";
    const despachar = (a) => {
      estado = m.reductor(estado, a);
      if (["insertar", "editar", "parametros", "eliminar", "insertar-varias"].includes(a.tipo)) alDia = false;
    };
    // Red de mentira: la última persona queda sin cobertura hasta que se pone la propuesta
    const red = () => {
      const r = m.estadoRed(estado.escenario.antenas, null, 3, false);
      const sin = siembra === "puesta" ? [] : r.personas.slice(-1);
      const con = r.personas.filter((a) => !sin.includes(a));
      return { ...r, alDia: true, conectadas: con, sinCobertura: sin, porNodo: new Map(con.map((a) => [a.id, { estado: "conectado", saltos: 2 }])) };
    };
    const encuadres = [];
    const t = {
      foto: () => ({ estado, inspeccion, perfil, perfilTerreno, siembra, mensaje, carga, estres }),
      alDia: () => alDia,
      despachar,
      perfilTerreno: () => (perfilTerreno = true),
      melki: {
        agregar: (d) => despachar({ tipo: "insertar", antena: { id: `x${Math.random()}`, nombre: "X", alturaM: 10, ...d } }),
        editar: (id, cambios) => despachar({ tipo: "editar", id, cambios }),
        parametrosCambiar: (cambios) => despachar({ tipo: "parametros", cambios }),
        vista: (cambios) => despachar({ tipo: "vista", cambios }),
        herramienta: (h) => despachar({ tipo: "herramienta", herramienta: h }),
        senal: (lat, lon) => (inspeccion = { lat, lon, elevacionM: 300, margenes: [] }),
        perfil: (a, b, informe) => (perfil = { informe: Boolean(informe) }),
        medir: (med) => despachar({ tipo: "medicion-agregar", medicion: med }),
        simular: () => (alDia = estado.escenario.antenas.length > 0),
        ponerPieza: (pieza, lat, lon) => {
          const a = { id: `p${Math.random()}`, nombre: pieza, tipo: pieza === "persona" ? "nodo" : "antena", lat, lon, alturaM: 10, pasarela: pieza === "gateway", activa: true, rol: "ROUTER" };
          despachar({ tipo: "insertar", antena: a });
          return a;
        },
        red,
        sembrar: (d) => {
          propuesta = { puntos: [{ id: "propuesto-1", lat: 4.3, lon: -73.2 }], destinos: d.map(() => ({ llega: true })) };
          siembra = "propuesta";
          return Promise.resolve(propuesta);
        },
        propuesta: () => (siembra === "propuesta" ? propuesta : null),
        aceptarSiembra: () => {
          despachar({ tipo: "insertar-varias", antenas: [{ id: "r-prop", nombre: "Repetidor", tipo: "antena", lat: 4.3, lon: -73.2, alturaM: 15, activa: true, pasarela: false }] });
          siembra = "puesta";
          return 1;
        },
        enviarMensaje: () => {
          mensaje++;
          return {};
        },
        encuadrarCaja: (c) => encuadres.push(c),
        poblar: (o) => {
          const nuevas = Array.from({ length: o.n ?? 250 }, (_, k) => ({ id: `pob${k}`, nombre: `Persona ${k + 1}`, tipo: "nodo", lat: 4.2 + k * 1e-4, lon: -73.37, alturaM: 1.5, activa: true, pasarela: false, rol: "COMPANION", poblada: true }));
          despachar({ tipo: "insertar-varias", antenas: nuevas });
          return { puestas: nuevas.length, pedidas: nuevas.length, area: "Alrededor de la red (3 km)", km2: 56, conSenal: false, quitadas: 0 };
        },
        probarCarga: (o, curva) => {
          carga = curva ? "curva" : "listo";
          return Promise.resolve(null);
        },
        poblarZonas: (o) => {
          const nuevas = Array.from({ length: o.n ?? 250 }, (_, k) => ({ id: `zon${k}`, nombre: `Persona Z${k + 1}`, tipo: "nodo", lat: 4.21 + k * 1e-4, lon: -73.36, alturaM: 1.5, activa: true, pasarela: false, rol: "COMPANION", poblada: true, zona: "g" }));
          despachar({ tipo: "insertar-varias", antenas: nuevas });
          return { zonas: [], puestas: nuevas.length, pedidas: nuevas.length, radioKm: 2, conSenal: true, recortado: false, quitadas: 0 };
        },
        probarEstres: (o) => {
          estres = o.rampa ? "rampa" : "listo";
          return Promise.resolve(null);
        },
      },
    };
    let ok = true;
    const malos = [];
    for (const paso of tour.pasos) {
      paso.asegurar?.(t);
      if (!paso.tarea) continue;
      const clave = `${tour.id}:${paso.titulo}`;
      if (SOLO_PANTALLA.has(clave)) continue;
      // Un paso de «Simule» puede quedar hecho por el cálculo automático; los demás no deben estar hechos al entrar
      const base = t.foto();
      const antes = paso.tarea.hecho(t, base);
      paso.tarea.hacer(t);
      const despues = paso.tarea.hecho(t, base);
      if ((antes && !/Simule|malla/i.test(paso.titulo)) || !despues) {
        ok = false;
        malos.push(`${paso.titulo} (antes ${antes}, después ${despues})`);
      }
    }
    // «El flujo de la malla» encuadra todas las piezas (para ver el flujo completo)
    if (tour.id === "sembrar") {
      const caja = encuadres.at(-1);
      const piezas = estado.escenario.antenas;
      const dentro = caja && piezas.every((q) => q.lon >= caja[0] && q.lat >= caja[1] && q.lon <= caja[2] && q.lat <= caja[3]);
      if (!dentro) {
        ok = false;
        malos.push("El flujo de la malla no encuadró toda la red");
      }
    }
    caso(`Tour «${tour.nombre}»: cada paso práctico se detecta y «Hágalo por mí» lo cumple`, ok, malos.join("; "));
  }
  const sembrar = m.TOURS.find((x) => x.id === "sembrar");
  caso("«Sembrar la malla» corre en su modo, sobre un escenario vacío", sembrar.modo === "sembrar" && sembrar.practica.escenario().antenas.length === 0 && sembrar.practica.autoSimular);
  const basico = m.TOURS[0].practica;
  caso("El tutorial básico practica sin nodos y sin simular solo", basico.escenario().antenas.length === 0 && basico.autoSimular === false);
  caso("«Como Radio Mobile» practica con dos nodos antena y una pasarela", m.TOURS.find((x) => x.id === "radiomobile").practica.escenario().antenas.filter((a) => a.pasarela).length === 1);
}

// 10) Sembrar la malla: piezas, sembrado automático, mensajes, modo y conocimiento de Trama
{
  const g = base("g", "Gateway", 4.2, -73.37, { pasarela: true, alturaM: 8 });
  const r1 = base("r1", "Repetidor 1", 4.21, -73.26);
  const p1 = base("p1", "Persona 1", 4.19, -73.39, { tipo: "nodo", alturaM: 1.5, gananciaDbi: 2, rol: "CLIENT" });
  const p2 = base("p2", "Persona 2", 4.3, -73.1, { tipo: "nodo", alturaM: 1.5, gananciaDbi: 2, rol: "CLIENT" });
  const antenas = [g, r1, p1, p2];
  const api = crearApi(antenas);
  const orden = (t, pend = null) => m.interpretarOrden(t, api, pend);
  const gw = orden("pon el gateway en 4.22, -73.36");
  caso("«Pon el gateway en…» → pieza gateway", gw?.tipo === "pieza" && gw.pieza === "gateway" && cerca(gw.coord.lat, 4.22), JSON.stringify(gw));
  const resGw = m.ejecutarOrden(gw, api);
  caso("En el modo «Sembrar» el gateway es uno: se mueve", api.llamadas.some((l) => l[0] === "editar" && l[1] === "g") && !api.llamadas.some((l) => l[0] === "pieza") && resGw.deshacer && /Moví el gateway/.test(resGw.texto), resGw.texto);
  const rep = orden("agrega un repetidor en 4.25, -73.30 a 20 m");
  caso("«Agrega un repetidor en… a 20 m» → pieza repetidor con altura", rep?.tipo === "pieza" && rep.pieza === "repetidor" && rep.datos.alturaM === 20, JSON.stringify(rep));
  const resRep = m.ejecutarOrden(rep, api);
  caso("Pone el repetidor y espera el cálculo", api.llamadas.some((l) => l[0] === "pieza" && l[1] === "repetidor") && resRep.esperar && /repetidor/.test(resRep.texto));
  const per = orden("pon una persona en 4.31, -73.22");
  caso("«Pon una persona en…» → pieza persona", per?.tipo === "pieza" && per.pieza === "persona");
  const casa = orden("agrega una casa en 4.31, -73.22");
  caso("«Agrega una casa en…» → persona", casa?.tipo === "pieza" && casa.pieza === "persona");
  const antenaCasa = orden("inscribe un nodo antena en mi casa en 4.31, -73.22");
  caso("«Inscribe un nodo antena en mi casa» sigue siendo un nodo antena", antenaCasa?.tipo === "agregar" && antenaCasa.datos.tipo === "antena", JSON.stringify(antenaCasa));
  const sinCoord = orden("pon un repetidor");
  const resSin = m.ejecutarOrden(sinCoord, api);
  caso("Sin coordenada: arma la herramienta y queda pendiente", sinCoord?.tipo === "pieza" && api.llamadas.some((l) => l[0] === "armar" && l[1] === "repetidor") && resSin.pendiente?.tipo === "pieza");
  const completa = orden("4.28, -73.25", resSin.pendiente);
  caso("La coordenada siguiente completa la pieza", completa?.tipo === "pieza" && completa.pieza === "repetidor" && cerca(completa.coord.lat, 4.28));
  caso("«Sube Repetidor 1 a 25 m» edita ese nodo", orden("sube Repetidor 1 a 25 m")?.tipo === "editar");
  caso("«Elimina Persona 2» elimina ese nodo", orden("elimina Persona 2")?.tipo === "eliminar");

  const falt = orden("conecta a los que faltan");
  caso("«Conecta a los que faltan» → sembrado hacia los faltantes", falt?.tipo === "sembrar" && falt.destino === "faltantes");
  const hacia = orden("siembra repetidores hacia 4.4, -73.0");
  caso("«Siembra repetidores hacia…» → sembrado hacia la coordenada", hacia?.tipo === "sembrar" && cerca(hacia.destino.coord.lat, 4.4));
  const lugar = orden("lleva la red a Paratebueno");
  caso("«Lleva la red a Paratebueno» → sembrado hacia el municipio", lugar?.tipo === "sembrar" && lugar.destino.nombre === "Paratebueno", JSON.stringify(lugar));
  caso("«Llévame a Villavicencio» sigue siendo ir al mapa", orden("llévame a Villavicencio")?.tipo === "ir");
  const aPersona = orden("conecta a Persona 2");
  caso("«Conecta a Persona 2» → sembrado hacia esa persona", aPersona?.tipo === "sembrar" && aPersona.destino.id === "p2");
  caso("«¿Está conectada Persona 2?» no siembra", orden("¿está conectada Persona 2?")?.tipo !== "sembrar");

  // Con la red calculada: Persona 2 sin cobertura
  api.redActual = { ...m.estadoRed(antenas, null, 3, false), alDia: true, conectadas: [p1], sinCobertura: [p2], aislados: [], lejos: [], saltosMax: 2, areaKm2: 300, porNodo: new Map([["g", { estado: "gateway", saltos: 0 }], ["p1", { estado: "conectado", saltos: 2 }], ["p2", { estado: "sin-cobertura", saltos: null }]]) };
  const resSiembra = m.ejecutarOrden(falt, api);
  caso("El sembrado responde de una vez y la propuesta llega después", /Busco lomas/.test(resSiembra.texto) && resSiembra.luego instanceof Promise && api.llamadas.some((l) => l[0] === "sembrar" && l[1][0].antena?.id === "p2"));
  const propuesta = await resSiembra.luego;
  caso("La propuesta trae «Poner» y «Descartar»", /Propongo un repetidor/.test(propuesta.texto) && propuesta.acciones?.[0]?.orden?.tipo === "aceptar-siembra" && propuesta.acciones?.[1]?.orden?.tipo === "descartar-siembra", propuesta.texto);
  caso("Con propuesta pendiente, «ponlos» la acepta", orden("ponlos")?.tipo === "aceptar-siembra");
  const resAcepta = m.ejecutarOrden({ tipo: "aceptar-siembra" }, api);
  caso("Aceptar pone los nodos con deshacer y recalcula", /puse 1 nodo/.test(resAcepta.texto) && resAcepta.deshacer && resAcepta.esperar === "*");

  const msg = orden("envía un mensaje desde Persona 1");
  caso("«Envía un mensaje desde Persona 1» → mensaje", msg?.tipo === "mensaje" && msg.id === "p1");
  const resMsg = m.ejecutarOrden(msg, api);
  caso("El mensaje cuenta saltos, tiempo y probabilidad", /llega al gateway en 1 salto/.test(resMsg.texto) && /intentos/.test(resMsg.texto) && api.llamadas.some((l) => l[0] === "mensaje" && l[1] === "p1"), resMsg.texto);
  caso("Sin decir desde dónde, sale de la persona conectada más lejana", m.ejecutarOrden(orden("manda un mensaje de prueba"), api) && api.llamadas.filter((l) => l[0] === "mensaje").at(-1)[1] === "p1");

  caso("«Modo avanzado» cambia el modo", orden("pasa al modo avanzado")?.modo === "avanzado");
  caso("«Vuelve a sembrar la malla» cambia el modo", orden("vuelve a sembrar la malla")?.modo === "sembrar");
  caso("«Modo accidental» sigue siendo un parámetro de Radio Mobile", orden("modo accidental")?.tipo === "parametros");
  caso("«Carga el ejemplo de malla» → ejemplo de malla", orden("carga el ejemplo de malla")?.tipo === "ejemplo-malla");
  caso("«Carga el ejemplo» → el de siempre", orden("carga el ejemplo")?.tipo === "ejemplo");

  // Conocimiento: Trama, repetidores, personas, mensajes y por qué alguien está en rojo
  const c = { antenas, parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar", red: api.redActual };
  caso("¿Qué es Trama? → gateway, repetidores y gente", /Gateway \+ Internet/.test(m.responder("¿qué es trama?", c).texto) && /repetidores/.test(m.responder("¿cómo siembro la red?", c).texto));
  caso("¿Cómo viaja un mensaje? → MeshCore: inundación la primera vez, ruta directa por los repetidores y tiempo en el aire", /inunda/.test(m.responder("¿cómo viaja un mensaje?", c).texto) && /repetidor/.test(m.responder("¿cómo viaja un mensaje?", c).texto) && /MeshCore/.test(m.responder("¿cómo viaja un mensaje?", c).texto) && /en el aire/.test(m.responder("¿cuánto tarda un mensaje?", c).texto));
  caso("¿Dónde pongo los repetidores? → lomas y distancias", /loma/.test(m.responder("¿dónde pongo los repetidores?", c).texto));
  caso("¿Qué hago ahora? → el siguiente paso de la red", /sin cobertura|Persona 2/.test(m.responder("¿qué hago ahora?", c).texto), m.responder("¿qué hago ahora?", c).texto);
  caso("¿Cómo está la red? → conectadas y sin cobertura", /1 de 2 personas conectadas/.test(m.responder("¿cómo está la red?", c).texto), m.responder("¿cómo está la red?", c).texto);
  caso("Los colores en el modo «Sembrar» hablan de las piezas", /verde = conectada/.test(m.responder("¿qué significa el rojo?", c).texto));
  caso("La pasarela se explica como gateway con internet", /Starlink/.test(m.responder("¿qué es el gateway?", c).texto));
  caso("El gateway lleva la IA que contesta", /inteligencia artificial/.test(m.responder("¿qué es el gateway?", c).texto));

  // v9: animación del flujo y respuesta de la IA
  const quita = orden("quita la animación");
  caso("«Quita la animación» apaga el flujo animado", quita?.tipo === "vista" && quita.cambios.animarRed === false, JSON.stringify(quita));
  const anima = orden("anima la red");
  caso("«Anima la red» enciende el flujo animado", anima?.tipo === "vista" && anima.cambios.animarRed === true);
  caso("Responde qué es la animación (flujo, destellos e IA)", /turquesa/.test(m.responder("¿por qué parpadean y brillan los nodos?", c).texto) && /IA/.test(m.responder("¿qué son las líneas que se mueven?", c).texto));
  caso("El mensaje de prueba cuenta la respuesta de vuelta (comprobante, WhatsApp o IA)", ((x) => /respuesta vuelve por la misma ruta/.test(x) && /comprobante/.test(x) && /WhatsApp/.test(x) && /IA/.test(x))(m.ejecutarOrden({ tipo: "mensaje", id: "p1" }, api).texto));
}

// 11) Melki agente (v10): diseño por área, varias órdenes, posiciones relativas, lugares, lotes y vista
{
  const g = base("g", "Gateway", 4.2, -73.37, { pasarela: true, alturaM: 8 });
  const r1 = base("r1", "Repetidor 1", 4.25, -73.3);
  const p1 = base("p1", "Persona 1", 4.21, -73.4, { tipo: "nodo", alturaM: 1.5, gananciaDbi: 2, rol: "CLIENT" });
  const antenas = [g, r1, p1];
  const api = crearApi(antenas);
  const orden = (t, ctx = {}) => m.interpretarOrden(t, api, null, ctx);

  // La frase exacta de Giancarlo
  const frase =
    "Hola corazón puedes ayudarme con algo viene siendo algo muy sencillo necesito que me armes una red que cubra un área de 11.000 hectáreas bueno al hacer exactos 11.226 una malla completa que cubre esa área con repetidores queden para que el 99.9% de esa área que una señal entre buena estable y media";
  const d = orden(frase);
  caso("La frase de las 11.226 ha → diseño por área", d?.tipo === "disenar" && d.area.forma === "circulo" && cerca(d.area.areaM2, 112260000, 1) && d.porcentaje === 99.9 && d.margenDb === 30, JSON.stringify(d).slice(0, 200));
  caso("Sin decir dónde, el área va alrededor del gateway", d?.area.centro?.tipo === "gateway");
  const sinGw = m.interpretarOrden(frase, crearApi([r1]), null);
  caso("Sin gateway, el área va en el centro del mapa", sinGw?.area.centro?.tipo === "mapa");
  caso("Números: «11.226», «1.500», «99.9», «1.234,5», «11 mil», «2,5»", [m.leerNumero("11.226"), m.leerNumero("1.500"), m.leerNumero("99.9"), m.leerNumero("1.234,5"), m.leerNumero("11 mil"), m.leerNumero("2,5")].join("|") === "11226|1500|99.9|1234.5|11000|2.5");
  const areas = ["11 mil hectáreas", "2,5 km²", "300 fanegadas", "4.500 m2", "1.500 ha"].map((t) => Math.round(m.areaEnTexto(t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())?.m2 ?? 0));
  caso("Áreas en hectáreas, km², fanegadas y m²", areas.join("|") === "110000000|2500000|1920000|4500|15000000", areas.join("|"));
  const lugar = orden("cubre 500 ha alrededor de Villavicencio con repetidores de 20 m");
  caso("«Cubre 500 ha alrededor de Villavicencio con repetidores de 20 m»", lugar?.tipo === "disenar" && lugar.area.centro.tipo === "coord" && cerca(lugar.area.centro.coord.lat, 4.14) && lugar.alturaM === 20 && lugar.porcentaje === 95);
  const redonda = orden("cubre 5 km a la redonda del gateway con señal buena en el 95 %");
  caso("«5 km a la redonda… señal buena» → círculo de 5 km y 45 dB", redonda?.area.forma === "circulo" && cerca(redonda.area.areaM2, Math.PI * 25e6, 1) && redonda.margenDb === 45);
  const cuadrada = orden("ármame una red para un área cuadrada de 2.000 hectáreas con respaldo y máximo 15 repetidores");
  caso("Área cuadrada, respaldo y máximo de repetidores", cuadrada?.area.forma === "cuadrado" && cuadrada.respaldo && cuadrada.maxRepetidores === 15 && cerca(cuadrada.area.anchoM, Math.sqrt(2e7), 0.01));
  const rect = orden("cubre un área de 10 por 12 km con señal estable al 99 %");
  caso("«10 por 12 km… señal estable al 99 %»", rect?.area.forma === "rectangulo" && rect.area.anchoM === 10000 && rect.area.altoM === 12000 && rect.margenDb === 37 && rect.porcentaje === 99);
  const pregunta = orden("¿cuántos repetidores necesito para cubrir 1.500 ha?");
  caso("«¿Cuántos repetidores necesito para cubrir 1.500 ha?» → diseño", pregunta?.tipo === "disenar" && cerca(pregunta.area.areaM2, 1.5e7, 1));
  api.medicionesActuales = [{ id: "m1", nombre: "Lote", tipo: "area", puntos: [[-73.4, 4.2], [-73.35, 4.2], [-73.35, 4.25], [-73.4, 4.25]], visible: true }];
  const medida = orden("cubre el área que medí al 99 %");
  caso("«Cubre el área que medí» → el área de la regla", medida?.tipo === "disenar" && medida.area.forma === "medicion" && medida.area.id === "m1" && medida.porcentaje === 99);
  const cuanto = orden("¿cuánto cubre el área?");
  caso("«¿Cuánto cubre el área?» → cobertura del área medida", cuanto?.tipo === "cobertura-area" && cuanto.id === "m1");
  const radioEstudio = orden("radio de estudio de 12 km");
  caso("«Radio de estudio de 12 km» sigue siendo un parámetro", radioEstudio?.tipo === "parametros" && radioEstudio.cambios.radioKm === 12);

  // Ejecutar el diseño con un motor de mentira: dibuja el área, diseña, pone los nodos y cuenta el resultado
  api.disenoFalso = {
    nodos: [{ id: "diseno-1", pieza: "repetidor", lat: 4.22, lon: -73.35, sueloM: 300, desdeId: "g", enlaceDb: 41, saltos: 1, coberturaPct: 99.95 }],
    areaKm2: 112.26, muestras: 1000, inicialPct: 90, coberturaPct: 99.95, objetivoPct: 99.9, margenObjetivoDb: 30, respaldo: false, alcanzado: true, motivo: null, huecos: [],
  };
  const poligono = m.poligonoCirculo(4.2, -73.37, 6000);
  const lons = poligono.map((q) => q[0]);
  const lats = poligono.map((q) => q[1]);
  const caja = { oeste: Math.min(...lons) - 0.05, este: Math.max(...lons) + 0.05, sur: Math.min(...lats) - 0.05, norte: Math.max(...lats) + 0.05 };
  api.resultadoFalso = { malla: { caja, ancho: 60, alto: 60, celdaM: 300 }, mejor: new Float32Array(3600).fill(40), segundo: new Float32Array(3600).fill(25), nodos: [{ id: "d0", saltos: 1 }] };
  const res = m.ejecutarOrden(d, api);
  caso("El diseño dibuja el área y avisa que está calculando", /Diseño la malla para 11\.226 ha/.test(res.texto) && api.llamadas.some((l) => l[0] === "medir" && /Área objetivo/.test(l[1].nombre)) && res.deshacer && res.luego);
  const final = await res.luego;
  caso("Al terminar cuenta la cobertura real dentro del área y los repetidores", /^Listo: la malla cubre el 100 %/.test(final.texto) && /Sembré 1 repetidor de 6 m/.test(final.texto) && /buena 0 %, estable 100 %/.test(final.texto), final.texto.slice(0, 160).replace(/\n/g, " "));
  caso("Ofrece deshacer y agregar respaldo", final.acciones?.some((a) => a.accion === "deshacer") && final.acciones?.some((a) => /respaldo/.test(a.texto) && a.orden?.respaldo === true));
  caso("El área del diseño queda como área objetivo con la meta pedida", api.llamadas.some((l) => l[0] === "area-objetivo" && l[1] && l[2]?.metaPct === 99.9 && l[2]?.margenDb === 30));
  caso("Con la meta cumplida ofrece optimizar el costo", final.acciones?.some((a) => a.orden?.tipo === "ajustar"));
  api.disenoFalso = { ...api.disenoFalso, alcanzado: false, coberturaPct: 80, motivo: "Llegué al máximo de 3 repetidores.", huecos: [[-73.3, 4.2]] };
  api.resultadoFalso = { ...api.resultadoFalso, mejor: new Float32Array(3600).fill(10) };
  const corto = await m.ejecutarOrden({ ...d, maxRepetidores: 3 }, api).luego;
  caso("Si no llega, lo dice y ofrece más repetidores, torres más altas y ver un hueco", /^Llegué al/.test(corto.texto) && corto.acciones.some((a) => /hasta 60 repetidores/.test(a.texto)) && corto.acciones.some((a) => /torres de 20 m/.test(a.texto)) && corto.acciones.some((a) => a.orden?.tipo === "ir"));

  // Varias órdenes en un mensaje
  const pasos = m.dividirEnPasos("pon el gateway en 4.2, -73.37, luego un repetidor a 10 km al este, una persona a 3 km al sur del repetidor y envía un mensaje desde la persona");
  caso("Divide un mensaje con varias órdenes", pasos.length === 4 && pasos[1] === "un repetidor a 10 km al este" && /^envía un mensaje/.test(pasos[3]), JSON.stringify(pasos));
  caso("No divide coordenadas, comillas ni «distancia entre X y Y»", m.dividirEnPasos('inscribe una antena llamada "Loma, alta" en 4.2, -73.3').length === 1 && m.dividirEnPasos("distancia entre Ejemplo y Torre 2").length === 1);
  caso("Los verbos con tilde también separan («y súbela a 20 m»)", m.dividirEnPasos("pon un repetidor en 4.2, -73.3 y súbela a 20 m").length === 2);

  // Posiciones relativas y lugares
  const norte = orden("agrega un repetidor a 8 km al norte del gateway");
  caso("«Un repetidor a 8 km al norte del gateway»", norte?.tipo === "pieza" && norte.pieza === "repetidor" && cerca(norte.coord.lat, 4.2 + 8000 / 110580, 0.002) && cerca(norte.coord.lon, -73.37), JSON.stringify(norte));
  const oriente = orden("pon una persona a 2 km del gateway hacia el oriente");
  caso("«A 2 km del gateway hacia el oriente»", oriente?.pieza === "persona" && oriente.coord.lon > -73.37 && cerca(oriente.coord.lat, 4.2, 0.001));
  const sinBase = orden("pon un repetidor a 5 km al sur", { ultimoNodo: "r1" });
  caso("Sin punto de partida, desde el último nodo que se tocó", sinBase?.pieza === "repetidor" && sinBase.coord.lat < 4.25 && cerca(sinBase.coord.lon, -73.3));
  const mover = orden("mueve Repetidor 1 2 km al sur");
  caso("«Mueve Repetidor 1 2 km al sur» se cuenta desde ese nodo", mover?.tipo === "mover" && mover.id === "r1" && mover.coord.lat < 4.25 && cerca(mover.coord.lon, -73.3));
  const enLugar = orden("pon el gateway en Villavicencio");
  caso("«Pon el gateway en Villavicencio» → en el municipio", enLugar?.tipo === "pieza" && enLugar.pieza === "gateway" && cerca(enLugar.coord.lat, 4.14));
  const inscribir = orden("inscribe un nodo antena en Villavicencio a 20 m");
  caso("«Inscribe un nodo antena en Villavicencio a 20 m»", inscribir?.tipo === "agregar" && cerca(inscribir.coord.lon, -73.63) && inscribir.datos.alturaM === 20);
  caso("«Súbelo a 25 m» se aplica al último nodo que se tocó", (() => {
    const o = orden("súbelo a 25 m", { ultimoNodo: "r1" });
    return o?.tipo === "editar" && o.id === "r1" && o.cambios.alturaM === 25;
  })());
  const msj = m.interpretarOrden("envía un mensaje desde la persona", api, null, {});
  caso("«Envía un mensaje desde la persona» → la persona", msj?.tipo === "mensaje" && msj.id === "p1");

  // Órdenes en lote, rol, equipo y otras de la pantalla
  const subir = orden("sube todos los repetidores a 20 m");
  caso("«Sube todos los repetidores a 20 m»", subir?.tipo === "editar-varios" && subir.ids.includes("r1") && !subir.ids.includes("g") && !subir.ids.includes("p1") && subir.cambios.alturaM === 20);
  const borrar = orden("borra todas las personas");
  caso("«Borra todas las personas»", borrar?.tipo === "eliminar-varios" && borrar.ids.join() === "p1");
  const menos = orden("elimina todo menos el gateway");
  caso("«Elimina todo menos el gateway»", menos?.tipo === "eliminar-varios" && menos.ids.includes("r1") && menos.ids.includes("p1") && !menos.ids.includes("g"));
  m.ejecutarOrden(borrar, api);
  caso("Ejecuta el borrado en lote", api.llamadas.some((l) => l[0] === "eliminar-varias" && l[1].join() === "p1"));
  caso("«Pon a Repetidor 1 como companion» → COMPANION", orden("pon a Repetidor 1 como companion")?.cambios?.rol === "COMPANION");
  caso("«Que Repetidor 1 no retransmita» → COMPANION", orden("que Repetidor 1 no retransmita")?.cambios?.rol === "COMPANION");
  caso("«Pon a Persona 1 como repetidor» → REPETIDOR", orden("pon a Persona 1 como repetidor")?.cambios?.rol === "REPETIDOR");
  caso("«Repetidor 1 como room server» → ROOM_SERVER", orden("pon Repetidor 1 como room server")?.cambios?.rol === "ROOM_SERVER");
  caso("«Usa en Persona 1 la tarjeta T1000»", orden("usa en Persona 1 la tarjeta T1000")?.cambios?.equipo === "t1000");
  caso("«Usa en Persona 1 la billetera XIAO»", orden("usa en Persona 1 la billetera xiao")?.cambios?.equipo === "xiao");
  const vias = orden("muestra las vías");
  caso("«Muestra las vías» / «quita los ríos y los nombres»", vias?.cambios?.refVias === true && orden("quita los ríos y los nombres")?.cambios?.refRios === false && orden("quita los ríos y los nombres")?.cambios?.refNombres === false);
  caso("«Pon el mapa topográfico»", orden("pon el mapa topográfico")?.cambios?.fondo === "topografico");
  caso("«Muestra el respaldo» y «muestra la mejor antena»", orden("muestra el respaldo")?.cambios?.modo === "redundancia" && orden("muestra la mejor antena")?.cambios?.modo === "servidor");
  caso("«Muéstrame toda la red» → encuadrar", orden("muéstrame toda la red")?.tipo === "encuadrar");
  caso("«Apaga simular al cambiar»", orden("apaga simular al cambiar")?.valor === false && orden("activa la simulación automática")?.valor === true);
  caso("«Simula con terreno plano» / «usa el relieve real»", orden("simula con terreno plano")?.valor === "plano" && orden("usa el relieve real")?.valor === "teselas");
  caso("«Llama al escenario Finca La Esperanza»", orden("llama al escenario Finca La Esperanza")?.nombre === "Finca La Esperanza");
  caso("«Duplica Repetidor 1» y «selecciona Persona 1»", orden("duplica Repetidor 1")?.tipo === "duplicar" && orden("selecciona Persona 1")?.tipo === "seleccionar");
  caso("«Ganancia del receptor de 3 dBi»", orden("ganancia del receptor de 3 dBi")?.cambios?.gananciaRxDbi === 3);
  caso("«Empieza de cero» → escenario nuevo", orden("empieza de cero")?.tipo === "nuevo");

  // Cerebro: el tema del diseño, las capacidades y un pedido que no se entiende
  const c = { antenas, parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  caso("Explica cómo pedir el diseño por área", /cubra 11\.226 hectáreas/.test(m.responder("¿cómo diseño la red para cubrir un área?", c).texto));
  caso("«¿Qué puedes hacer?» incluye diseñar y varias órdenes", /Diseñar una red/.test(m.responder("¿qué puedes hacer?", c).texto) && /Varias órdenes/.test(m.responder("¿qué puedes hacer?", c).texto));
  caso("Un pedido del simulador que no entiende no se responde con un tema al azar", /no logré convertirlo en una orden/.test(m.responder("agrega un dron a la malla", c).texto));
  caso("Un pedido fuera del simulador («hazme el café») se responde con respeto y retoma el trabajo", /fui diseñado y creado para cumplir órdenes/.test(m.responder("hazme el café por favor", c).texto));
}

// 12) Ajuste inteligente (v11): «ajústamelo», límites, sitios dados, área objetivo y la propuesta con sus opciones
{
  const g = base("g", "Gateway", 4.2, -73.37, { pasarela: true, alturaM: 8 });
  const r1 = base("r1", "Repetidor 1", 4.25, -73.3);
  const p1 = base("p1", "Persona 1", 4.21, -73.4, { tipo: "nodo", alturaM: 1.5, gananciaDbi: 2, rol: "CLIENT" });
  const antenas = [g, r1, p1];
  const api = crearApi(antenas);
  const orden = (t) => m.interpretarOrden(t, api, null, {});

  const aj = orden("ajústamelo automáticamente");
  caso("«Ajústamelo automáticamente» → ajuste aplicado con la recomendada", aj?.tipo === "ajustar" && aj.aplicar && aj.opcion === "recomendada", JSON.stringify(aj));
  const que = orden("¿qué necesito para que sea factible?");
  caso("«¿Qué necesito para que sea factible?» → propuesta sin aplicar", que?.tipo === "ajustar" && !que.aplicar);
  const alto = orden("hazla factible sin pasar de 20 m");
  caso("«Hazla factible sin pasar de 20 m» → torres de hasta 20 m", alto?.tipo === "ajustar" && alto.opciones.alturaMaxM === 20);
  const muy = orden("ajústala con torres hasta 40 metros");
  caso("Más de 30 m no: lo limita a 30 m y avisa", muy?.tipo === "ajustar" && muy.opciones.alturaMaxM === 30 && muy.avisos.length === 1);
  const lim = orden("optimiza la red con máximo 2 antenas de apoyo y no muevas los nodos");
  caso("«Máximo 2 antenas de apoyo y no muevas los nodos»", lim?.tipo === "ajustar" && lim.opciones.maxApoyos === 2 && lim.opciones.permisos?.mover === false, JSON.stringify(lim?.opciones));
  const solo = orden("ajústala solo con alturas");
  caso("«Solo con alturas» → sin apoyos, sin mover ni cambiar antenas", solo?.tipo === "ajustar" && solo.opciones.permisos?.alturas === true && solo.opciones.permisos?.apoyos === false && solo.opciones.permisos?.mover === false && solo.opciones.permisos?.antenas === false);
  const sitios = orden("ajústamelo, las antenas de apoyo pueden ir en 4.51, -73.12; 4.60, -73.05");
  caso("Sitios dados para las antenas de apoyo", sitios?.tipo === "ajustar" && sitios.opciones.sitios?.length === 2 && cerca(sitios.opciones.sitios[1].lat, 4.6) && cerca(sitios.opciones.sitios[1].lon, -73.05), JSON.stringify(sitios?.opciones));
  const gms = m.extraerVariasCoordenadas(`4°30'44" N 73°07'24" O y 4°35'00" N 73°10'00" O`);
  caso("Varias coordenadas en grados, minutos y segundos", gms.length === 2 && cerca(gms[0].lat, 4.5122, 1e-3) && cerca(gms[1].lon, -73.1667, 1e-3), JSON.stringify(gms));
  caso("«La más económica para que sea factible» → opción económica", orden("dame la opción más económica para que sea factible")?.opcion === "economica");
  caso("«Optimiza el costo» → ajuste", orden("optimiza el costo de la red")?.tipo === "ajustar");
  caso("«Ajusta la vista a toda la red» no es el ajuste", orden("ajusta la vista a toda la red")?.tipo !== "ajustar");
  const altura = orden("ajusta la altura de Repetidor 1 a 20 m");
  caso("«Ajusta la altura de Repetidor 1 a 20 m» edita ese nodo", altura?.tipo !== "ajustar", JSON.stringify(altura));
  caso("«Sube todos los repetidores a 20 m» sigue siendo un lote", orden("sube todos los repetidores a 20 m")?.tipo === "editar-varios");

  api.medicionesActuales = [{ id: "m1", nombre: "Lote 3", tipo: "area", puntos: [[-73.4, 4.2], [-73.35, 4.2], [-73.35, 4.25], [-73.4, 4.25]], visible: true }];
  const obj = orden("usa el área que medí como área objetivo con el 95 %");
  caso("«Usa el área que medí como área objetivo con el 95 %»", obj?.tipo === "area-objetivo" && !obj.quitar && obj.id === "m1" && obj.metaPct === 95, JSON.stringify(obj));
  const rObj = m.ejecutarOrden(obj, api);
  caso("Fija el área objetivo y lo cuenta", api.objetivo?.nombre === "Lote 3" && /«Lote 3» es el área objetivo/.test(rObj.texto) && /95 %/.test(rObj.texto));
  const quitar = orden("quita el área objetivo");
  caso("«Quita el área objetivo»", quitar?.tipo === "area-objetivo" && quitar.quitar);
  m.ejecutarOrden(quitar, api);
  caso("Quita el área objetivo", api.objetivo === null);

  // Ejecutar con un motor de mentira
  const resumen = (u) => ({ utilPct: u, confiablePct: u - 10, servicioPct: u + 10, conectada: true, saltosOk: true, solidas: true, coberturaOk: u >= 60, factible: u >= 60, nodosAntena: 3, apoyos: 1, alturaMaxM: 21 });
  const cambios = [
    { tipo: "altura", id: "r1", nombre: "Repetidor 1", deM: 15, aM: 21 },
    { tipo: "apoyo", id: "nuevo-apoyo-1", nombre: "Apoyo 1", lat: 4.3, lon: -73.25, alturaM: 15, sueloM: 420, enlazaCon: "Repetidor 1", enlaceDb: 38 },
  ];
  api.ajusteFalso = {
    modo: "ajustar",
    area: { nombre: "Zona de la red", tipo: "zona", poligono: [[-73.4, 4.2], [-73.3, 4.2], [-73.3, 4.3]], areaKm2: 50 },
    metaPct: 60, margenDb: 30, alturaMaxM: 30,
    inicial: { ...resumen(42), coberturaOk: false, factible: false, problemas: ["Cobertura útil de 42 % (meta 60 %)"] },
    opciones: [
      { id: "economica", titulo: "Económica", porQue: "Lo mínimo", cambios: cambios.slice(0, 1), antenas: [], resumen: resumen(61), costoRelativo: 1 },
      { id: "recomendada", titulo: "Recomendada", porQue: "La mejor relación", cambios, antenas: [], resumen: resumen(78), costoRelativo: 1.6 },
    ],
    recomendada: 1,
    analisis: ["La red no es factible: la cobertura útil es 42 % y la meta es 60 %.", "Si basta con cumplir, la económica llega al 61 %."],
    motivo: null,
  };
  const rProp = m.ejecutarOrden(que, api);
  caso("Avisa que analiza sin decir precios", /Analizo la red/.test(rProp.texto) && !/\$|millones|pesos/.test(rProp.texto) && rProp.luego);
  const prop = await rProp.luego;
  caso("Propuesta: diagnóstico, lo que necesita y la pregunta", /no es factible/.test(prop.texto) && /Subir Repetidor 1 de 15 a 21 m/.test(prop.texto) && /Antena de apoyo «Apoyo 1»/.test(prop.texto) && /¿La aplico\?/.test(prop.texto), prop.texto.replace(/\n/g, " ").slice(0, 200));
  caso("Muestra la propuesta en el panel y ofrece aplicar cada opción y descartar", api.llamadas.some((l) => l[0] === "mostrar-ajuste" && l[1] === 1) && prop.acciones.filter((a) => a.orden?.tipo === "aplicar-ajuste").length === 2 && prop.acciones.some((a) => a.orden?.tipo === "descartar-ajuste"));
  caso("Sin aplicar no toca la red", !api.llamadas.some((l) => l[0] === "aplicar-ajuste"));

  api.resultadoFalso = { porcentajeUtil: 78, areaObjetivo: null, factibilidad: { nivel: "factible", titulo: "Factible", puntaje: 92, recomendaciones: [] } };
  const rAp = m.ejecutarOrden(aj, api);
  const ap = await rAp.luego;
  caso("«Ajústamelo» aplica la recomendada sobre la red de antes", api.llamadas.some((l) => l[0] === "aplicar-ajuste" && l[1] === 1 && l[2]?.antenas));
  caso("Cuenta cómo quedó, lo que cambió y que las de apoyo son sugerencias", /^Listo: apliqué la opción «Recomendada» y la red quedó factible \(92\/100\): cobertura útil del 78 %/.test(ap.texto) && /Lo que cambié: Subir Repetidor 1/.test(ap.texto) && /puntos sugeridos/.test(ap.texto), ap.texto.replace(/\n/g, " ").slice(0, 220));
  caso("Ofrece deshacer y usar la otra opción", ap.acciones.some((a) => a.accion === "deshacer") && ap.acciones.some((a) => a.orden?.tipo === "aplicar-ajuste" && a.orden.indice === 0));

  const sinGw = crearApi([base("r9", "Repetidor 9", 4.2, -73.3)]);
  caso("Sin gateway pide ponerlo primero", /Primero ponga el Gateway/.test(m.ejecutarOrden({ tipo: "ajustar", aplicar: true, opcion: "recomendada", opciones: {}, avisos: [] }, sinGw).texto));

  // Cerebro: costos sin precios y el área objetivo
  const c = { antenas, parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  const costos = m.responder("¿cuánto cuesta una torre de 30 metros?", c).texto;
  caso("Explica cómo pesa el costo en el ajuste (con los precios de Trama)", /30 m/.test(costos) && /precios del documento de Trama/.test(costos));
  caso("Explica la cobertura útil y el área objetivo", /60 %/.test(m.responder("¿qué es el área objetivo?", c).texto));
  caso("«¿Qué puedes hacer?» incluye ajustar la red", /Ajustar la red/.test(m.responder("¿qué puedes hacer?", c).texto));
}

// 14) Gente y capacidad (v12): poblar personas, prueba de carga y dimensionamiento de Trama
{
  const g = base("g", "Gateway", 4.2, -73.37, { pasarela: true, rol: "COMPANION" });
  const r1 = base("r1", "Repetidor 1", 4.25, -73.3, { rol: "REPETIDOR" });
  const api = crearApi([g, r1]);
  const orden = (t) => m.interpretarOrden(t, api, null);
  const p1 = orden("puebla la zona con 250 personas");
  caso("«Puebla la zona con 250 personas»", p1?.tipo === "poblar" && p1.pedido.n === 250, JSON.stringify(p1));
  caso("«Popular personas» (como lo dictó el Inge) → 250", orden("popular personas")?.pedido?.n === 250);
  const p2 = orden("en esta zona son 250 usuarios, repártelos por la malla");
  caso("«Son 250 usuarios, repártelos por la malla» → alrededor de la red", p2?.tipo === "poblar" && p2.pedido.n === 250 && p2.pedido.areaId === "zona-red", JSON.stringify(p2));
  const p3 = orden("reparte 1 persona por km2 solo donde haya señal");
  caso("Densidad por km² y solo con señal", p3?.pedido?.densidadKm2 === 1 && p3.pedido.soloConSenal === true, JSON.stringify(p3));
  caso("«Puebla con densidad dispersa» → 0,2 por km²", orden("puebla la zona con densidad dispersa")?.pedido?.densidadKm2 === 0.2);
  caso("«Quita las pobladas»", orden("quita las pobladas")?.tipo === "quitar-pobladas");
  const rp = m.ejecutarOrden(p1, api);
  caso("Poblar reparte, explica y simula", api.llamadas.some((l) => l[0] === "poblar" && l[1].n === 250) && /repartí 250 personas al azar/.test(rp.texto) && rp.luego && rp.deshacer, rp.texto.slice(0, 160));
  api.resultadoFalso = { nodos: [], enlaces: [] };
  const despues = await rp.luego;
  caso("Después de poblar ofrece la prueba de carga", despues.acciones?.some((a) => a.orden?.tipo === "carga" && a.orden.curva === false) && despues.acciones?.some((a) => a.orden?.tipo === "carga" && a.orden.curva === true));

  const c1 = orden("envía 25 pagos al tiempo");
  caso("«Envía 25 pagos al tiempo» → ráfaga de 25 pagos", c1?.tipo === "carga" && c1.opciones.mensajes === 25 && c1.opciones.tipo === "pago" && c1.opciones.modo === "rafaga" && !c1.curva, JSON.stringify(c1));
  const c2 = orden("manda 5 mensajes al tiempo en 1 segundo");
  caso("«5 mensajes al tiempo en 1 segundo» → texto, ventana de 1 s", c2?.opciones?.tipo === "texto" && c2.opciones.mensajes === 5 && c2.opciones.ventanaS === 1, JSON.stringify(c2));
  caso("«¿Hasta cuántos pagos aguanta?» → curva", orden("¿hasta cuántos pagos aguanta?")?.curva === true);
  caso("«Ver hasta que se revienta» → curva", orden("mandemos pagos hasta que se reviente")?.curva === true);
  const c3 = orden("simula 55 pagos por hora");
  caso("«55 pagos por hora» → continua", c3?.opciones?.modo === "continua" && c3.opciones.mensajes === 55);
  caso("«Envía un pago desde Repetidor 1» sigue siendo el pago de prueba", orden("envía un pago desde Repetidor 1")?.tipo === "mensaje");
  api.cargaFalsa = {
    carga: { tipo: "pago", modo: "rafaga", mensajes: 25, remitentes: 240, entregados: 20, completos: 10, avisos: 8, avisosPedidos: 25, completosPct: 40, primerIntentoPct: 30, latenciaS: { p50: 48, p95: 140, max: 180 }, transmisiones: 400, reintentos: 60, inundaciones: 5, colisiones: 33, sordos: 4, perdidasCola: 0, esperasCanal: 80, canalGatewayPct: 92, ocupacion: [], duracionS: 200, ventanaS: 10, airePorPagoS: 9.4, saturada: true, lenta: false, motivo: null },
    curva: { puntos: [{ n: 5, completosPct: 100, p95S: 50, canalPct: 40, colisiones: 0 }, { n: 10, completosPct: 95, p95S: 75, canalPct: 60, colisiones: 1 }, { n: 15, completosPct: 80, p95S: 90, canalPct: 70, colisiones: 3 }], quiebre: 15, seguro: 5, lento: 10 },
  };
  const rc = m.ejecutarOrden(orden("¿hasta cuántos pagos aguanta?"), api);
  caso("La prueba de carga avisa que tarda y luego cuenta el resultado", /paquete por paquete como MeshCore/.test(rc.texto) && rc.luego);
  const tc = (await rc.luego).texto;
  caso("Resultado: se revienta, comprobantes, canal y referencia de Trama", /se revienta/.test(tc) && /40 % recibieron su comprobante/.test(tc) && /aguanta sin demora hasta 5/.test(tc) && /desde 10 aguanta pero lento/.test(tc) && /se revienta desde 15/.test(tc) && /55 pagos por hora/.test(tc) && /4 frecuencias/.test(tc), tc.slice(0, 240));

  const d1 = orden("¿cuánto cuesta la red para el Chocó?");
  caso("«¿Cuánto cuesta la red para el Chocó?» → departamento", d1?.tipo === "trama-departamento" && d1.id === "choco" && d1.adopcionPct === 30 && d1.sf === 11);
  const td = m.ejecutarOrden(d1, api).texto;
  caso("Chocó como en el documento: 35.880 usuarios, 240 repetidores, 60 sitios", /35\.880 usuarios/.test(td) && /240 repetidores/.test(td) && /60 sitios/.test(td) && /\$6,4 mil M/.test(td), td.slice(0, 260));
  caso("«Norte de Santander con SF10» no se confunde con Santander", orden("¿cuánto cuesta la red en Norte de Santander con SF10?")?.id === "nsantander" && orden("¿cuánto cuesta la red en Norte de Santander con SF10?")?.sf === 10);
  caso("«La meta del 99 % al menor costo» no es el departamento del Meta", orden("ajusta la red para llegar a la meta con el menor costo")?.tipo === "ajustar");
  const col = orden("cuánto costaría cubrir todo el país con 50% de adopción");
  caso("Todo el país con 50 % de adopción", col?.id === "colombia" && col.adopcionPct === 50);
  const tCol = m.ejecutarOrden(orden("¿cuánto cuesta cubrir todo el país?"), api).texto;
  caso("Colombia al 30 %: 950.655 usuarios, 7.017 repetidores, 1.602 sitios", /950\.655 usuarios/.test(tCol) && /7\.017 repetidores/.test(tCol) && /1\.602 sitios/.test(tCol), tCol.slice(0, 200));
  const dim = orden("dimensiona 5.000 usuarios en 800 km2 de sabana");
  caso("Dimensionar usuarios y área", dim?.tipo === "trama-dimensionar" && dim.usuarios === 5000 && dim.areaKm2 === 800 && dim.terreno === "sabana");

  // Cerebro: conocimiento de Trama y MeshCore
  const c = { antenas: [g, r1], parametros: { ...PARAMETROS, preset: "SF11_250" }, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  const t = (q) => m.responder(q, c).texto;
  caso("«¿Cuánto cuesta un repetidor?» → precios de Trama", /repetidor completo en su tubo de 6 m ≈ \$1\.035\.000/.test(t("¿cuánto cuesta un repetidor?")), t("¿cuánto cuesta un repetidor?").slice(0, 300));
  caso("«¿Qué lleva cada persona?» → billeteras XIAO y T1000-E", /XIAO ESP32S3/.test(t("¿qué lleva cada persona?")) && /T1000-E/.test(t("¿qué lleva cada persona?")));
  caso("«¿Cuántos usuarios por frecuencia?» → 150 / 280 / 500", /150 usuarios/.test(t("¿cuántos usuarios por frecuencia?")) && /500 usuarios/.test(t("¿cuántos usuarios por frecuencia?")));
  caso("«¿Cómo viaja un pago?» → MeshCore, acuses y comprobante", /MeshCore/.test(t("¿cómo viaja un pago?")) && /comprobante/.test(t("¿cómo viaja un pago?")) && /acuse/.test(t("¿cómo viaja un pago?")));
  caso("«¿Qué roles hay?» → Repetidor, Companion y Room server", /Companion/.test(t("¿qué roles hay?")) && /Room server/.test(t("¿qué roles hay?")));
  caso("Frecuencias de Trama y la banda de la ANE", /921,5/.test(t("¿qué frecuencia uso?")) && /915 a 928/.test(t("¿qué frecuencia uso?")));
  caso("El gateway de Trama: torre de 12 m, mini PC y 4 radios", /12 m/.test(t("¿qué es el gateway?")) && /N100/.test(t("¿qué es el gateway?")) && /Starlink/.test(t("¿qué es el gateway?")));
  caso("Ningún tema habla de Meshtastic", !["¿qué es esto?", "¿qué es un nodo?", "¿qué es el preset?", "¿cómo viaja un mensaje?", "¿qué roles hay?", "¿qué es la malla?", "¿qué es el límite de saltos?"].some((q) => /meshtastic/i.test(t(q))));
  caso("Tour de capacidad por su tema", m.responder("hazme el tour de capacidad", c).acciones?.[0]?.tour === "capacidad");
}

// 15) Zonas de popularidad y prueba de estrés de la hora pico (v12.1): lo que pidió el Inge
{
  const g = base("g", "Gateway", 4.2, -73.37, { pasarela: true, rol: "COMPANION" });
  const r1 = base("r1", "Repetidor 1", 4.25, -73.3, { rol: "REPETIDOR" });
  const r12 = base("r12", "Repetidor 12", 4.15, -73.3, { rol: "REPETIDOR" });
  const api = crearApi([g, r1, r12]);
  const orden = (t) => m.interpretarOrden(t, api, null);
  const inge1 = orden("Agrégale lo que viene siendo por cada punto una popularidad de 250 personas y verificar qué tan colapsada estaría la red para transferir información");
  caso("«Por cada punto una popularidad de 250 personas y verificar qué tan colapsada» → zonas en todos + estrés con rampa", inge1?.tipo === "zonas" && inge1.pedido.n === 250 && !inge1.pedido.centros && inge1.estres?.rampa === true, JSON.stringify(inge1));
  const inge2 = orden("Ayúdame de la siguiente manera quiero agregarle vuélveme a hacerlo de las 11226 hectáreas de manera estable y quiero agregarle por cada nodo o por cada antena 250 personas en los que sería como las zonas de popularidad para ver si se colapsa si se queda la red se disminuye el ancho de banda bueno para evaluar todas esas circunstancias");
  caso(
    "Diseño de 11.226 ha estable + 250 personas por nodo + estrés comparando ajustes",
    inge2?.tipo === "disenar" && cerca(inge2.area.areaM2, 112260000, 1) && inge2.margenDb === 37 && inge2.despues?.zonas?.n === 250 && inge2.despues?.estres?.rampa === true && inge2.despues?.estres?.comparar === true,
    JSON.stringify(inge2).slice(0, 240),
  );
  const rehacer = orden("vuélveme a hacerlo de las 11226 hectáreas de manera estable");
  caso("«Vuélveme a hacerlo de las 11.226 ha de manera estable» → diseño estable", rehacer?.tipo === "disenar" && rehacer.margenDb === 37 && !rehacer.despues);
  const uno = orden("pon 300 personas alrededor del Repetidor 1 a 3 km");
  caso("«300 personas alrededor del Repetidor 1 a 3 km» → solo esa zona", uno?.tipo === "zonas" && uno.pedido.n === 300 && uno.pedido.radioKm === 3 && JSON.stringify(uno.pedido.centros) === '["r1"]' && uno.estres === null, JSON.stringify(uno));
  caso("«Repetidor 12» no se confunde con «Repetidor 1»", JSON.stringify(orden("zona de popularidad de 100 personas en el Repetidor 12")?.pedido?.centros) === '["r12"]');
  caso("«Zona de popularidad en el gateway» → 250 en el gateway", JSON.stringify(orden("zona de popularidad en el gateway")?.pedido) === '{"n":250,"centros":["g"]}');
  caso("«En cada repetidor 150 personas a 1 km»", orden("en cada repetidor 150 personas a 1 km")?.pedido?.radioKm === 1 && orden("en cada repetidor 150 personas a 1 km")?.pedido?.n === 150);
  caso("«Quita las zonas de popularidad»", orden("quita las zonas de popularidad")?.tipo === "quitar-zonas");
  const e1 = orden("¿hasta cuántos usuarios aguanta cada repetidor?");
  caso("«¿Hasta cuántos usuarios aguanta cada repetidor?» → estrés con rampa", e1?.tipo === "estres" && e1.opciones.rampa === true, JSON.stringify(e1));
  caso("«Prueba de estrés en día de mercado» → 25 % en la hora pico", orden("haz la prueba de estrés en día de mercado")?.opciones?.horaPicoPct === 25);
  caso("«¿Qué tan colapsada está la red?» → estrés", orden("¿qué tan colapsada está la red?")?.tipo === "estres");
  caso("«Hora pico con 5 pagos por persona al día»", orden("prueba la hora pico con 5 pagos por persona al día")?.opciones?.pagosPersonaDia === 5);
  caso("«¿Se disminuye el ancho de banda?» compara ajustes", orden("¿se disminuye el ancho de banda con la hora pico?")?.opciones?.comparar === true);
  caso("La ráfaga y la curva de pagos siguen siendo la prueba de carga", orden("envía 25 pagos al tiempo")?.tipo === "carga" && orden("¿hasta cuántos pagos aguanta?")?.tipo === "carga" && orden("mandemos pagos hasta que se reviente")?.tipo === "carga");
  caso("«Puebla la zona con 250 personas» sigue siendo poblar", orden("puebla la zona con 250 personas")?.tipo === "poblar");

  // Ejecutar: zonas y luego la prueba de estrés, contada en palabras
  const zona = (id, nombre, extra) => ({ id, nombre, pieza: id === "g" ? "gateway" : "repetidor", usuarios: 250, usuariosRuta: 250, pagosHora: 91, pagos: 45, completos: 9, completosPct: 20, p50S: 60, p95S: 240, canalPct: 98, txPct: 12.5, colisiones: 500, sordos: 200, perdidasCola: 0, alcanceKm: 2, alcanceCargaKm: 0.6, radioZonaKm: 1.8, airePersonaS: 3.4, canalPersonaPct: 0.09, energia: id === "g" ? null : { consumoWhDia: 1.1, generaWhDia: 14, bateriaWh: 34.6, autonomiaDias: 31, alcanza: true }, estado: "revienta", limites: ["canal", "choques", "alcance"], factorLento: null, factorQuiebre: 0.5, usuariosMax: 63, pagosHoraMax: 23, aguantaTodo: false, ...extra });
  api.resultadoFalso = { nodos: [], enlaces: [] };
  api.estresFalso = {
    pagosPersonaDia: 2.4, horaPicoPct: 15, factor: 1, duracionMin: 30, preset: { id: "SF11_250", nombre: "Trama SF11 · 250 kHz (alcance)", velocidadKbps: 1.074 },
    usuarios: 750, pedidosHora: 270, entregadosHora: 80, pagos: 135, completosPct: 24, p50S: 70, p95S: 240, canalGatewayPct: 98, utilBps: 66, canalBps: 1074, airePorPagoS: 9.4, estado: "revienta",
    zonas: [zona("g", "Gateway"), zona("r1", "Repetidor 1", { completosPct: 18 }), zona("r12", "Repetidor 12", { completosPct: 30 })],
    rampa: { puntos: [], factorSeguro: 0.25, factorLento: null, factorQuiebre: 0.5, usuariosMax: 188, maxEntregadosHora: 181, primera: "Repetidor 1" },
    ajustes: [{ preset: "SF9_250", nombre: "Trama SF9 · 250 kHz (capacidad)", actual: false, conRuta: 700, completosPct: 82, p95S: 90, canalPct: 80, estado: "revienta", velocidadKbps: 3.5 }, { preset: "SF11_250", nombre: "Trama SF11 · 250 kHz (alcance)", actual: true, conRuta: 750, completosPct: 24, p95S: 240, canalPct: 98, estado: "revienta", velocidadKbps: 1.074 }],
    motivo: null,
  };
  const rz = m.ejecutarOrden(inge1, api);
  caso("Pone las zonas, avisa que prueba la hora pico y se puede deshacer", api.llamadas.some((l) => l[0] === "zonas" && l[1].n === 250) && /puse 750 personas en 3 zonas/.test(rz.texto) && /hora pico/.test(rz.texto) && rz.deshacer && rz.luego, rz.texto.slice(0, 200));
  const tz = (await rz.luego).texto;
  caso(
    "Cuenta la hora pico: se revienta, zona por zona, alcance con carga, energía, rampa, ajustes y qué hacer",
    /Resultado: se revienta/.test(tz) && /Zona por zona/.test(tz) && /• Repetidor 1 \(250 personas, 91 mensajes\/h\): se revienta, 18 %/.test(tz) && /completa solo hasta 0,6 km \(atiende gente hasta 2,0 km\)/.test(tz) && /La energía no es el límite/.test(tz) && /aguanta sin demora hasta ~188 personas/.test(tz) && /como máximo ~181 mensajes por hora/.test(tz) && /SF9 · 250 kHz: 82 %/.test(tz) && /4 frecuencias/.test(tz) && /aguanta hasta ~63 personas sin demora/.test(tz),
    tz.slice(0, 300).replace(/\n/g, " "),
  );
  caso("El estrés va después de simular las zonas", api.llamadas.findIndex((l) => l[0] === "estres") > api.llamadas.findIndex((l) => l[0] === "zonas"));
  const re = m.ejecutarOrden(e1, api);
  caso("La prueba de estrés sola avisa qué mide y luego cuenta", /Subo la carga de la hora pico/.test(re.texto) && /Resultado: se revienta/.test((await re.luego).texto));
  const qz = m.ejecutarOrden(orden("quita las zonas de popularidad"), api);
  caso("Quitar las zonas dice cuántas personas y deja deshacer", /quité las zonas de popularidad \(500 personas\)/.test(qz.texto) && qz.deshacer);
  // El diseño compuesto avisa que después pone las zonas
  api.disenoFalso = { nodos: [], areaKm2: 112.26, muestras: 1000, inicialPct: 90, coberturaPct: 99, objetivoPct: 95, margenObjetivoDb: 37, respaldo: false, alcanzado: true, motivo: null, huecos: [] };
  api.resultadoFalso = null;
  const rd = m.ejecutarOrden(inge2, api);
  caso("El diseño compuesto anuncia las zonas y la prueba de estrés", /Después pongo 250 personas alrededor de cada gateway y repetidor/.test(rd.texto) && /prueba de estrés/.test(rd.texto), rd.texto.slice(0, 240));
  const fd = await rd.luego;
  caso("Al terminar el diseño, pone las zonas y cuenta la prueba de estrés", api.llamadas.filter((l) => l[0] === "zonas").length === 2 && /Prueba de estrés de la hora pico/.test(fd.texto), fd.texto.slice(0, 120).replace(/\n/g, " "));

  // Cerebro
  const c = { antenas: [g, r1], parametros: { ...PARAMETROS, preset: "SF11_250" }, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  caso("«¿Qué es una zona de popularidad?» → explica zonas y estrés", /zonas de popularidad ponen gente alrededor/.test(m.responder("¿qué es una zona de popularidad?", c).texto));
  caso("«¿Cuánto consume cada usuario?» → aire por persona", /segundos de aire en la hora pico/.test(m.responder("¿cuánto consume cada usuario de la red?", c).texto));
}

// 16) El límite de cada punto (v12.2): la cantidad que se quiera, cuántas aguanta y llenarlo hasta el límite
{
  const g = base("g", "Gateway", 4.2, -73.37, { pasarela: true, rol: "COMPANION" });
  const r1 = base("r1", "Repetidor 1", 4.25, -73.3, { rol: "REPETIDOR" });
  const r2 = base("r2", "Repetidor 2", 4.15, -73.3, { rol: "REPETIDOR" });
  const api = crearApi([g, r1, r2]);
  const orden = (t) => m.interpretarOrden(t, api, null);
  const l1 = orden("¿cuántas personas aguanta el Repetidor 1?");
  caso("«¿Cuántas personas aguanta el Repetidor 1?» → límite de ese punto", l1?.tipo === "limite" && JSON.stringify(l1.centros) === '["r1"]' && !l1.llenar, JSON.stringify(l1));
  const l2 = orden("llena el gateway hasta su límite");
  caso("«Llena el gateway hasta su límite» → llenar", l2?.tipo === "limite" && JSON.stringify(l2.centros) === '["g"]' && l2.llenar, JSON.stringify(l2));
  caso("«Pon en el Repetidor 2 la cantidad máxima de personas que soporte» → llenar", ((x) => x?.tipo === "limite" && x.llenar && JSON.stringify(x.centros) === '["r2"]')(orden("pon en el Repetidor 2 la cantidad máxima de personas que soporte")));
  caso("«Evalúa hasta qué punto soporta el Repetidor 1 con 400 personas a 3 km» → límite con muestra y radio", ((x) => x?.tipo === "limite" && x.n === 400 && x.radioKm === 3 && !x.llenar)(orden("evalúa hasta qué punto soporta el Repetidor 1 con 400 personas a 3 km")));
  caso("«¿Cuál es el límite de cada punto?» → todos los puntos", ((x) => x?.tipo === "limite" && x.centros === undefined && !x.llenar)(orden("¿cuál es el límite de personas de cada punto?")));
  caso("«Llena cada repetidor hasta su límite» → todos y llenar", ((x) => x?.tipo === "limite" && x.centros === undefined && x.llenar)(orden("llena cada repetidor hasta su límite de personas")));
  const z7 = orden("pon 700 personas en el Repetidor 1 y mira la estabilidad de la red");
  caso("«Pon 700 personas en el Repetidor 1 y mira la estabilidad» → zona de 700 + estrés", z7?.tipo === "zonas" && z7.pedido.n === 700 && JSON.stringify(z7.pedido.centros) === '["r1"]' && z7.estres !== null, JSON.stringify(z7));
  caso("Hasta 2.000 personas por punto", orden("pon 1.800 personas en el Repetidor 2")?.pedido?.n === 1800 && orden("pon 5000 personas en el Repetidor 2")?.pedido?.n === 2000);
  caso("«El límite de saltos» sigue siendo el límite de saltos", m.interpretarOrden("pon el límite de saltos del Repetidor 1 en 4", api, null)?.tipo !== "limite");
  caso("«La altura máxima» no es un límite de personas", orden("pon el Repetidor 1 a la altura máxima")?.tipo !== "limite");
  caso("«¿Hasta cuántos usuarios aguanta cada repetidor?» sigue siendo el estrés de toda la malla", orden("¿hasta cuántos usuarios aguanta cada repetidor?")?.tipo === "estres");

  // Ejecutar: busca el límite y lo cuenta; el botón lo llena
  api.limiteFalso = { pieza: "repetidor", personas: 100, deZona: true, puntos: [], personasSeguro: 320, rango: null, personasLento: 350, personasQuiebre: 640, aguantaTodo: false, tope: 2000, mensajesHoraMax: 115, falla: { quien: "punto", nombres: ["Repetidor 1"], limites: ["canal"], estado: "lento" }, redYaFalla: false, motivo: null };
  api.estresFalso = null;
  const r = m.ejecutarOrden(l1, api);
  caso("Avisa qué hace (sube la gente de ese punto con el resto como está) y deja deshacer", /Busco cuántas personas aguanta Repetidor 1/.test(r.texto) && /con el resto de la red como está/.test(r.texto) && /WhatsApp/.test(r.texto) && r.deshacer && r.luego, r.texto.slice(0, 160));
  const tr = await r.luego;
  caso(
    "Cuenta el límite: sin demora, lento, se revienta, qué falla primero y ofrece llenarlo",
    /aguanta sin demora hasta ~320 personas \(115 mensajes por hora/.test(tr.texto) && /desde ~350 va lento/.test(tr.texto) && /se revienta desde ~640/.test(tr.texto) && /Lo primero que falla es el propio Repetidor 1 \(canal lleno\)/.test(tr.texto) && tr.acciones?.some((a) => a.orden?.tipo === "limite" && a.orden.llenar && a.orden.n === 320),
    tr.texto.slice(0, 260),
  );
  caso("Pide el límite del punto (no de toda la red)", api.llamadas.some((l) => l[0] === "punto" && l[1].centro === "r1" && l[1].accion === "limite"));
  const tl = await m.ejecutarOrden(l2, api).luego;
  caso("Llenar: lo llena y cuenta cómo quedó", /Lo llené con 320 personas y simulé la hora pico: el punto estable, la red estable/.test(tl.texto) && api.llamadas.some((l) => l[0] === "punto" && l[1].accion === "llenar"), tl.texto.slice(0, 200));
  const tc = await m.ejecutarOrden(orden("¿cuál es el límite de personas de cada punto?"), api).luego;
  caso("Cada punto: un renglón por punto y la advertencia de que juntos comparten el canal", (tc.texto.match(/^• /gm) ?? []).length === 3 && /comparten el canal/.test(tc.texto) && tc.acciones?.some((a) => a.orden?.tipo === "limite" && a.orden.llenar), tc.texto.slice(0, 200));
  api.limiteFalso = { ...api.limiteFalso, personasSeguro: null, personasLento: null, personasQuiebre: null, mensajesHoraMax: null, redYaFalla: true, falla: { quien: "red", nombres: ["Repetidor 2"], limites: ["canal", "choques"], estado: "revienta" } };
  const ty = await m.ejecutarOrden(l1, api).luego;
  caso("Si la red ya está llena por otras zonas, lo dice y no ofrece llenar", /la red no aguanta sin demora: Repetidor 2 ya llena el canal/.test(ty.texto) && !ty.acciones?.some((a) => a.orden?.tipo === "limite"), ty.texto.slice(0, 200));
  const c = { antenas: [g, r1, r2], parametros: { ...PARAMETROS, preset: "SF11_250" }, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  caso("El tema de estrés explica «¿Cuántas aguanta?» y «Llenar hasta el límite»", /¿Cuántas aguanta\?/.test(m.responder("¿qué es una zona de popularidad?", c).texto) && /Llenar hasta el límite/.test(m.responder("¿qué es una zona de popularidad?", c).texto));
}

// ─── 17. Asistente Melki (tipo Jarvis): llamado, controles, números, eco, paneles, trato, voz y la mayor cobertura ───
{
  console.log("\n17. Asistente Melki");
  const act = (f) => m.detectarActivacion(f);
  for (const [frase, resto, ingles] of [
    ["Hola Melki, pon el gateway en Cumaral", "pon el gateway en Cumaral", false],
    ["oye melki cuántas personas aguanta el Repetidor 1", "cuántas personas aguanta el Repetidor 1", false],
    ["Hey Melki, simula", "simula", true],
    ["hello melky what's up", "what's up", true],
    ["Hola, Mel ki, ¿qué hago ahora?", "¿qué hago ahora?", false],
    ["Melki por favor conecta a los que faltan", "conecta a los que faltan", false],
    ["conecta a los que faltan, Melki", "conecta a los que faltan", false],
    ["Oye Melqui", "", false],
    ["Hello Melky, ¿cómo está la red?", "¿cómo está la red?", true],
    ["hola melkis simula", "simula", false],
    ["Hola Melkie, conecta a los que faltan", "conecta a los que faltan", false],
    ["oye mekli pantalla limpia", "pantalla limpia", false],
    ["Hola mel qui, ¿qué hago ahora?", "¿qué hago ahora?", false],
  ])
    caso(`Llamado: «${frase}»`, ((a) => a.activado && a.resto === resto && a.ingles === ingles)(act(frase)), JSON.stringify(act(frase)));
  caso("Sin el nombre no se activa", !act("pon el gateway en Cumaral").activado && !act("hola, ¿cómo estás?").activado && !act("el melón está maduro").activado);
  caso("Las formas del nombre: Melki, Melky, Melqui, Melkis, Mekli, Melkie", ["Melki", "Melky", "melqui", "Melkis", "mekli", "Melkie", "Melkí", "MELKY"].every((w) => m.esNombre(w)), ["Melki", "Melky", "melqui", "Melkis", "mekli", "Melkie", "Melkí", "MELKY"].filter((w) => !m.esNombre(w)).join(","));
  caso("Palabras parecidas no son el nombre", ["mejor", "melón", "menos", "milk", "mapa", "medir", "nodo", "valle", "melodía", "helicóptero"].every((w) => !m.esNombre(w)), ["mejor", "melón", "menos", "milk", "mapa", "medir", "nodo", "valle", "melodía", "helicóptero"].filter((w) => m.esNombre(w)).join(","));

  const ctl = (f) => m.controlDeVoz(f)?.tipo ?? null;
  caso("Controles: para, repite, más detalle, deja de escuchar, gracias, no, ayuda", ctl("para") === "callar" && ctl("Melki, silencio") === "callar" && ctl("repite") === "repetir" && ctl("¿qué dijiste?") === "repetir" && ctl("más detalle") === "detalle" && ctl("léelo todo") === "detalle" && ctl("deja de escuchar") === "apagar" && ctl("apaga el modo manos libres") === "apagar" && ctl("apaga el asistente") === "apagar" && ctl("desactiva el asistente Melki") === "apagar" && ctl("adiós") === "apagar" && ctl("gracias") === "gracias" && ctl("no, gracias") === "no" && ctl("¿qué te puedo decir?") === "ayuda");
  caso("«Sí, hazlo», «dale», «la segunda», «la última» usan los botones", m.controlDeVoz("sí, hazlo")?.indice === 0 && m.controlDeVoz("dale")?.indice === 0 && m.controlDeVoz("la segunda")?.indice === 1 && m.controlDeVoz("el tercero")?.indice === 2 && m.controlDeVoz("la última")?.indice === "ultima");
  caso("Una orden no es un control", ctl("pon el gateway en Cumaral") === null && ctl("no conectes a nadie más") === null && ctl("para el Repetidor 1 usa 12 m") === null);

  const num = (f) => m.numerosEnPalabras(f);
  for (const [dicho, esperado] of [
    ["puebla la zona con doscientas cincuenta personas", "puebla la zona con 250 personas"],
    ["pon el gateway en cuatro punto dos, menos setenta y tres punto tres siete", "pon el gateway en 4.2, -73.37"],
    ["cubre once mil doscientas veintiséis hectáreas al noventa y nueve punto nueve por ciento", "cubre 11226 hectáreas al 99.9 %"],
    ["sube el repetidor uno a veinte y cinco metros", "sube el repetidor 1 a 25 metros"],
    ["envía quince pagos al tiempo", "envía 15 pagos al tiempo"],
    ["agrega un repetidor y una persona", "agrega un repetidor y una persona"],
    ["mil quinientas personas", "1500 personas"],
  ])
    caso(`Números: «${dicho}»`, num(dicho) === esperado, num(dicho));

  const lim = m.limpiarComando("eh, pon el gateway en cuatro punto dos menos setenta y tres punto tres siete por favor");
  caso("Lo dicho queda listo para Melki (cifras, sin muletillas, con mayúscula)", lim.startsWith("Pon el gateway en 4.2") && /-73\.37/.test(lim) && !/por favor/.test(lim), lim);
  {
    const api = crearApi([]);
    const o = m.interpretarOrden(m.limpiarComando("pon el gateway en cuatro punto dos, menos setenta y tres punto tres siete"), api, null);
    caso("Un pedido dicho en palabras se vuelve orden", o?.tipo === "pieza" && o.pieza === "gateway" && cerca(o.coord?.lat, 4.2) && cerca(o.coord?.lon, -73.37), JSON.stringify(o));
  }

  const largo = "La red cubre el 82 % del área. Llegan 40 de 45 personas. Falta un repetidor al norte. Además conviene subir el gateway.\n• Repetidor 1: 3 saltos.\n• Repetidor 2: sin red.\n• Repetidor 3: bien.";
  const corto = m.textoParaVoz(largo);
  caso("La respuesta en voz va resumida y avisa que el detalle quedó escrito", corto.includes("82 %") && !corto.includes("Además conviene") && corto.includes("Repetidor 1") && !corto.includes("Repetidor 3") && /Le dejé el detalle escrito\.$/.test(corto), corto);
  const completo = m.textoParaVoz(largo, true);
  caso("Con «más detalle» la lee completa", completo.includes("Además conviene") && completo.includes("Repetidor 3") && !completo.includes("•"));
  caso("Una respuesta corta se lee tal cual", m.textoParaVoz("Listo, simulé la red.") === "Listo, simulé la red.");

  const voz = m.paraHablar("El enlace tiene 12,5 dB a 3,2 km con SF11; ≈ 1.035.000 pesos y 99,9 % · 250 B");
  caso("La voz dice unidades y números sin deletrear símbolos", /12 coma 5 decibeles/.test(voz) && /3 coma 2 kilómetros/.test(voz) && /S F 11/.test(voz) && /unos 1035000/.test(voz) && /99 coma 9 por ciento/.test(voz) && /250 bytes/.test(voz) && !/[≈·%]/.test(voz), voz);

  caso("Reconoce el eco de su propia voz", m.pareceEco("diga hola Melki y su pedido", m.SALUDO_MANOS_LIBRES) && m.pareceEco("le dejé el detalle escrito", "La red cubre el 82 %. Le dejé el detalle escrito."));
  caso("Lo que dice el usuario no es eco", !m.pareceEco("pon el gateway en Cumaral", m.SALUDO_MANOS_LIBRES) && !m.pareceEco("conecta a los que faltan", "Listo, simulé la red: llegan 40 de 45 personas."));

  // Trato de mayordomo: el saludo, el llamado y las sugerencias de paneles
  const fs = m.frases("senor");
  caso("Al activarse: «Hola, señor. Bienvenido» y queda presto a sus órdenes", /^Hola, señor\. Bienvenido\./.test(fs.bienvenida(true)) && /presto a seguir sus órdenes/.test(fs.bienvenida(true)) && /Hola Melki/.test(fs.bienvenida(true)), fs.bienvenida(true));
  caso("Al llamarlo por su nombre: «Hola, mi señor. Le escucho; estoy atento y presto a seguir sus órdenes»", fs.llamado(0, false) === "Hola, mi señor. Le escucho; estoy atento y presto a seguir sus órdenes." && fs.llamado(1, false) !== fs.llamado(2, false) && /^Hello, sir/.test(fs.llamado(0, true)));
  caso("Con «señora» y sin tratamiento", /^Hola, señora\. Bienvenida\./.test(m.frases("senora").bienvenida(true)) && /mi señora/.test(m.frases("senora").llamado(0, false)) && !/señor/.test(m.frases("ninguno").bienvenida(true) + m.frases("ninguno").llamado(0, false) + m.frases("ninguno").despedida));
  caso("Las sugerencias de paneles terminan en pregunta («sí» u «ok» las aceptan)", /panel de resultados, señor\?$/.test(fs.verResultados) && /panel de herramientas, señor\?$/.test(fs.verHerramientas) && /panel de resultados/.test(fs.mostrando("resultados")));
  caso("El saludo de bienvenida es el de siempre", m.SALUDO_MANOS_LIBRES === fs.bienvenida(true));
  // La voz más natural primero
  const voces = [
    { name: "Microsoft Sabina - Spanish (Mexico)", lang: "es-MX" },
    { name: "Google español de Estados Unidos", lang: "es-US" },
    { name: "Microsoft Salome Online (Natural) - Spanish (Colombia)", lang: "es-CO" },
    { name: "Microsoft Dalia Online (Natural) - Spanish (Mexico)", lang: "es-MX" },
    { name: "eSpeak Spanish", lang: "es" },
    { name: "Google US English", lang: "en-US" },
  ].sort((a, b) => m.puntajeVoz(b) - m.puntajeVoz(a));
  caso("Elige la voz neuronal colombiana, luego las naturales y Google; las robóticas al final", voces[0].name.includes("Salome") && voces[1].name.includes("Dalia") && voces[2].name.startsWith("Google español") && m.puntajeVoz({ name: "eSpeak Spanish", lang: "es" }) < m.puntajeVoz({ name: "Microsoft Sabina - Spanish (Mexico)", lang: "es-MX" }) && m.puntajeVoz({ name: "Google US English", lang: "en-US" }) < 0, voces.map((v) => v.name.split(" ")[1]).join(" > "));

  // Pantalla limpia: los paneles de los lados
  const api = crearApi([base("g", "Gateway", 4.2, -73.37, { pasarela: true })]);
  const pan = (t) => m.interpretarOrden(t, api, null);
  caso("«Pantalla limpia» oculta los dos paneles", ((o) => o?.tipo === "paneles" && o.izquierdo === false && o.derecho === false)(pan("pantalla limpia")) && pan("Deja solo el mapa")?.tipo === "paneles" && pan("oculta los paneles")?.izquierdo === false);
  caso("«Muestra los paneles» los vuelve a abrir", ((o) => o?.tipo === "paneles" && o.izquierdo === true && o.derecho === true)(pan("muestra los paneles")));
  caso("«Cierra el panel izquierdo» y «oculta los resultados» van por separado", ((o) => o?.izquierdo === false && o.derecho === undefined)(pan("cierra el panel izquierdo")) && ((o) => o?.derecho === false && o.izquierdo === undefined)(pan("oculta los resultados")) && pan("abre el panel de resultados")?.derecho === true);
  caso("«Muestra los resultados» (sin panel) no es una orden de paneles", pan("muestra los resultados")?.tipo !== "paneles" && pan("limpia el mapa")?.tipo === "nuevo");
  caso("«Muéstrame las herramientas» abre el panel de la izquierda", ((o) => o?.tipo === "paneles" && o.izquierdo === true && o.derecho === undefined)(pan("muéstrame las herramientas")) && pan("abre el panel de herramientas")?.izquierdo === true);
  const rp = m.ejecutarOrden(pan("pantalla limpia"), api);
  caso("Ejecuta la pantalla limpia y lo cuenta", /pantalla limpia, solo el mapa/.test(rp.texto) && api.llamadas.some((l) => l[0] === "paneles" && l[1].izquierdo === false && l[1].derecho === false), rp.texto);
  api.pantalla = "celular";
  caso("En el celular explica los botones de abajo", /botones de abajo/.test(m.ejecutarOrden(pan("pantalla limpia"), api).texto));

  // La mayor cobertura posible
  const pide = pan("dame la mayor cobertura posible");
  caso("«Dame la mayor cobertura posible» → ajuste con la opción de máxima cobertura", pide?.tipo === "ajustar" && pide.opcion === "maxima" && pide.aplicar, JSON.stringify(pide));
  caso("«Ajústamelo para la mayor cobertura posible» → máxima", ((o) => o?.tipo === "ajustar" && o.opcion === "maxima")(pan("ajústamelo para la mayor cobertura posible")));
  caso("«¿Cómo dejo la mayor cobertura posible?» no es una orden: pide consejos", pan("¿cómo dejo la mayor cobertura posible?") === null && pan("qué me recomiendas para la mayor cobertura posible") === null);
  const c = { antenas: api.antenas(), parametros: { ...PARAMETROS, preset: "SF11_250" }, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  const rc = m.responder("¿cómo dejo la mayor cobertura posible?", c);
  caso("Melki recomienda cómo dejar la mayor cobertura posible", /mayor cobertura posible/.test(rc.texto) && /loma/.test(rc.texto) && /línea de vista/i.test(rc.texto) && /respaldo/.test(rc.texto) && /SF11/.test(rc.texto) && /ajústamelo para la mayor cobertura posible/.test(rc.texto), rc.texto.slice(0, 120));
  caso("Con nodos sin simular ofrece simular", rc.acciones?.some((a) => a.accion === "simular"));

  // El tema de manos libres, el tour y el menú
  const rm = m.responder("¿cómo funciona el modo manos libres?", c);
  caso("Explica manos libres y ofrece activarlo y el tour", /Hola Melki/.test(rm.texto) && /deja de escuchar/.test(rm.texto) && rm.acciones?.some((a) => a.accion === "manos-libres") && rm.acciones?.some((a) => a.tour === "voz"), rm.texto.slice(0, 100));
  caso("«Modo Jarvis» y «comandos de voz» llevan al mismo tema", m.responder("modo jarvis", c).acciones?.some((a) => a.accion === "manos-libres") && m.responder("¿qué comandos de voz entiendes?", c).acciones?.some((a) => a.accion === "manos-libres"));
  caso("Un «Hola Melki» escrito sigue siendo un saludo", !m.responder("Hola Melki", c).acciones?.some((a) => a.accion === "manos-libres"));
  // Autoría y licencia
  for (const q of ["¿Quién creó el simulador?", "¿quién te creó?", "¿Cuál es la licencia de uso?", "¿quién es el autor?", "derechos de autor", "¿se puede patentar?"]) {
    const r = m.responder(q, c);
    caso(`«${q}» → autoría y licencia`, /Creado por Giancarlo González Guerrero para el Ingeniero Pablo Felipe Acevedo y la empresa Melki/.test(r.texto) && /© 2026/.test(r.texto) && r.acciones?.some((a) => a.accion === "acerca"), r.texto.slice(0, 80));
  }
  caso("La licencia de la banda de radio no es la del programa", !/Giancarlo/.test(m.responder("¿necesito licencia para usar la banda de 915 MHz?", c).texto));
  caso("«¿Qué puedes hacer?» menciona el Asistente Melki", /Asistente Melki/.test(m.responder("¿qué puedes hacer?", c).texto));
  caso("«¿Qué es el Asistente Melki?» explica el trato, los paneles y la activación al abrir", ((r) => /mayordomo/.test(r.texto) && /oculto el panel de herramientas y el de resultados/.test(r.texto) && /al abrir el simulador/.test(r.texto) && r.acciones?.some((a) => a.accion === "manos-libres"))(m.responder("¿qué es el asistente Melki?", c)));
  const tv = m.TOURS.find((x) => x.id === "voz");
  caso("Tour «Asistente Melki por voz»: activa, llama por el nombre, el mapa libre con sugerencias y la mayor cobertura", tv && tv.nombre === "Asistente Melki por voz" && tv.pasos.some((p) => p.objetivo === "manos-libres" && p.tarea) && tv.pasos.some((p) => [].concat(p.objetivo).includes("hud-sugerencias")) && tv.pasos.some((p) => /mayor cobertura posible/.test(p.texto)));
  caso("«Hazme el tour de manos libres» → tour voz", m.pedidoDeTour("hazme el tour de manos libres")?.acciones?.[0]?.tour === "voz" && m.pedidoDeTour("guíame para hablar con Melki y dictarle")?.acciones?.[0]?.tour === "melki");
  caso("La ayuda por voz trae ejemplos y los controles", /Hola Melki/.test(m.AYUDA_VOZ) && /sí, hazlo/.test(m.AYUDA_VOZ) && /pantalla limpia/.test(m.AYUDA_VOZ) && /mayor cobertura posible/.test(m.AYUDA_VOZ));
}

// ─── 18. v12.6: entender mejor, fuera del simulador, la red sostenible y viable, su costo y la escucha en reposo ───
{
  console.log("\n18. Red sostenible, lugares, fuera de tema y reposo");
  // Lo que el dictado escribe mal
  const cp = m.corregirPalabras;
  caso("Correcciones del dictado: mesh, gateway, hectáreas, SF, Starlink, WhatsApp", cp("construye una red mes") === "construye una red mesh" && cp("pon el geitwey") === "pon el gateway" && cp("11226 hectarias") === "11226 hectáreas" && cp("usa ese efe 11") === "usa SF11" && cp("con estar link") === "con Starlink" && cp("manda un guasap") === "manda un WhatsApp" && cp("mes core") === "MeshCore");
  caso("Las correcciones no tocan lo demás («el mes de octubre»)", cp("el mes de octubre") === "el mes de octubre" && cp("la red de Trama") === "la red de Trama");
  caso("Entre las versiones del reconocimiento elige la que trae el nombre y palabras del simulador", m.elegirAlternativa(["hola mel quien pon el gateway", "hola melki pon el gateway"]) === "hola melki pon el gateway" && m.elegirAlternativa(["pon el gateway en Cumaral", "pon el get way en Cumaral"]) === "pon el gateway en Cumaral");
  caso("Por voz, «red mes… once mil… hectarias» llega bien", m.limpiarComando("construye una red mes en barranca de upia de once mil doscientas veintiseis hectarias") === "Construye una red mesh en barranca de upia de 11226 hectáreas");

  // Lugares con el nombre pegado o una letra distinta (datos reales del DANE)
  await m.cargarReferencia();
  const lugar = (t) => m.buscarLugares(t, 3)[0]?.nombre;
  caso("Encuentra «Barranca de Upía» escrito de varias formas", ["barrancaupia", "barranca de upia", "Barranca de Opia", "barranca upía", "Barranca de Upía"].every((t) => lugar(t) === "Barranca de Upía"), ["barrancaupia", "barranca de opia", "barranca upía"].map(lugar).join(" | "));
  caso("Y no confunde lugares con palabras comunes", m.buscarLugares("mejor", 3).every((l) => l.nombre !== "Barranca de Upía") && !m.pareceNombre("barranca", "Barrancabermeja") && m.pareceNombre("villavicensio", "Villavicencio"));

  const antenasR = [];
  const apiR = crearApi(antenasR);
  apiR.buscarLugar = (t) => m.buscarLugares(t, 5);
  const ord = (t, p = null) => m.interpretarOrden(t, apiR, p);
  const pedido = ord("hazme una red que sea sostenible tanto económica como viable técnicamente en Barranca de Upía en un rango de 11226 hectáreas");
  caso("«Una red sostenible… en Barranca de Upía en un rango de 11.226 ha» → diseño sostenible centrado en el municipio", pedido?.tipo === "disenar" && pedido.sostenible === true && pedido.area.centro?.tipo === "coord" && /Barranca de Upía/.test(pedido.area.centro.nombre) && cerca(pedido.area.areaM2, 112260000, 1) && pedido.porcentaje === 95 && pedido.margenDb === 30, JSON.stringify(pedido).slice(0, 160));
  const pegado = ord("hazme una red sostenible en barrancaupía de 11226 hectáreas");
  caso("«…en barrancaupía…» también", pegado?.tipo === "disenar" && /Barranca de Upía/.test(pegado.area.centro?.nombre ?? ""));
  const sinLugar = ord("Construye una red mesh que cumpla con todos los parámetros establecidos dentro del marco de sostenibilidad y viabilidad técnica");
  caso("Sin lugar ni tamaño: pregunta dónde y de qué tamaño", sinLugar?.tipo === "pedir-diseno" && sinLugar.sostenible && !sinLugar.lugar);
  const rp = m.ejecutarOrden(sinLugar, apiR);
  caso("…con un ejemplo listo (Barranca de Upía, 11.226 ha) y queda esperando la respuesta", /¿Dónde y de qué tamaño\?/.test(rp.texto) && rp.pendiente?.tipo === "disenar" && rp.acciones?.some((a) => a.orden?.tipo === "disenar" && a.orden.sostenible));
  const completa = ord("en Barranca de Upía, 11.226 hectáreas", rp.pendiente);
  caso("La respuesta «en Barranca de Upía, 11.226 hectáreas» completa el diseño sostenible", completa?.tipo === "disenar" && completa.sostenible && /Barranca de Upía/.test(completa.area.centro?.nombre ?? "") && cerca(completa.area.areaM2, 112260000, 1), JSON.stringify(completa).slice(0, 120));
  const soloLugar = ord("hazme una red en barranca de opia");
  caso("Con el lugar pero sin tamaño: pregunta el área y recuerda el lugar", soloLugar?.tipo === "pedir-diseno" && /Barranca de Upía/.test(soloLugar.lugar?.nombre ?? "") && /¿Qué área cubro\?/.test(m.ejecutarOrden(soloLugar, apiR).texto));
  const conTamano = ord("de 11.226 hectáreas", m.ejecutarOrden(soloLugar, apiR).pendiente);
  caso("…y «de 11.226 hectáreas» la arma ahí", conTamano?.tipo === "disenar" && cerca(conTamano.area.centro?.coord?.lat ?? 0, 4.5149, 1e-3));

  // El diseño sostenible cuenta su viabilidad técnica y su costo
  apiR.disenoFalso = {
    nodos: [
      { id: "diseno-g", pieza: "gateway", lat: 4.51, lon: -73.0, sueloM: 260, desdeId: null, enlaceDb: null, saltos: 0, coberturaPct: 70 },
      { id: "diseno-1", pieza: "repetidor", lat: 4.55, lon: -73.03, sueloM: 300, desdeId: "diseno-g", enlaceDb: 36, saltos: 1, coberturaPct: 96 },
    ],
    areaKm2: 112.26, muestras: 1000, inicialPct: 70, coberturaPct: 96, objetivoPct: 95, margenObjetivoDb: 30, respaldo: false, alcanzado: true, motivo: null, huecos: [],
  };
  apiR.ubicacion = () => "Barranca de Upía (Meta)";
  const poli = m.poligonoCirculo(4.5149, -73.0024, 6000);
  const lo = poli.map((q) => q[0]);
  const la = poli.map((q) => q[1]);
  apiR.resultadoFalso = {
    malla: { caja: { oeste: Math.min(...lo) - 0.05, este: Math.max(...lo) + 0.05, sur: Math.min(...la) - 0.05, norte: Math.max(...la) + 0.05 }, ancho: 60, alto: 60, celdaM: 300 },
    mejor: new Float32Array(3600).fill(40),
    segundo: new Float32Array(3600).fill(25),
    nodos: [{ id: "d0", saltos: 0 }, { id: "d1", saltos: 1 }],
    factibilidad: { titulo: "Factible", puntaje: 92, nivel: "factible", recomendaciones: [] },
  };
  // Una red de otro municipio en el mapa (cerca de Villavicencio, a ~50 km) no entra ni al diseño ni al presupuesto
  antenasR.push(base("lejos-g", "Gateway Villavicencio", 4.2, -73.37, { pasarela: true }), base("lejos-1", "Repetidor V1", 4.25, -73.3), base("lejos-2", "Repetidor V2", 4.3, -73.25));
  const inicioSostenible = m.ejecutarOrden(pedido, apiR);
  caso("Con otra red lejos en el mapa, la de Barranca de Upía lleva su propio gateway", /Busco con el relieve real dónde va el gateway y cada repetidor/.test(inicioSostenible.texto), inicioSostenible.texto.slice(0, 200));
  const fin = await inicioSostenible.luego;
  caso("…y su presupuesto cuenta solo la red de esa área (1 gateway y 1 repetidor)", /Inversión: unos \$[^:]*: el sitio del gateway [^;]*; 1 repetidor solar/.test(fin.texto), (fin.texto.match(/• Inversión[^\n]*/) ?? [""])[0].slice(0, 200));
  caso("La red sostenible dice su viabilidad técnica, la inversión, la operación y que es solar", /Viabilidad de la red:/.test(fin.texto) && /Técnica: factible \(92\/100\)/.test(fin.texto) && /enlaces de al menos 36 dB \(firmes\)/.test(fin.texto) && /Inversión: unos \$/.test(fin.texto) && /al mes/.test(fin.texto) && /logística de Meta/.test(fin.texto) && /energía solar/.test(fin.texto), fin.texto.split("Viabilidad")[1]?.slice(0, 200).replace(/\n/g, " "));
  caso("…y ofrece probar la hora pico con 250 personas por punto", fin.acciones?.some((a) => a.orden?.tipo === "zonas" && a.orden.pedido?.n === 250 && a.orden.estres));

  // El costo de la red del mapa
  const conRed = [base("g", "Gateway", 4.2, -73.37, { pasarela: true }), base("r1", "Repetidor 1", 4.25, -73.3), base("r2", "Repetidor 2", 4.3, -73.25), base("p1", "Persona 1", 4.27, -73.28, { tipo: "nodo", alturaM: 1.5 })];
  const apiC = crearApi(conRed);
  caso("«¿Cuánto cuesta la red?» con nodos → el costo de la red del mapa", m.interpretarOrden("¿cuánto cuesta la red?", apiC, null)?.tipo === "costo-red" && m.interpretarOrden("¿cuál es el presupuesto de la malla?", apiC, null)?.tipo === "costo-red");
  caso("«¿Cuánto cuesta la red para el Chocó?» sigue siendo el departamento", m.interpretarOrden("¿cuánto cuesta la red para el Chocó?", apiC, null)?.tipo === "trama-departamento");
  const costo = m.ejecutarOrden({ tipo: "costo-red" }, apiC);
  caso("Cuenta gateway, repetidores y personas con su inversión y su operación", /1 gateway, 2 repetidores y 1 persona/.test(costo.texto) && /Inversión: unos \$/.test(costo.texto) && /Operación: unos \$/.test(costo.texto) && /5 años/.test(costo.texto), costo.texto.slice(0, 160).replace(/\n/g, " "));
  const c5 = m.costoRedTrama(1, 5);
  const c10 = m.costoRedTrama(1, 10);
  caso("Más repetidores cuestan más; el Starlink del gateway es $300.000 al mes", c10.inversion.total > c5.inversion.total && c5.mensual.internet === 300000 && c5.totalMes > c5.mensual.total && m.costoRedTrama(1, 5, 0, "xiao", 1.3).inversion.instalacion > c5.inversion.instalacion);

  // Fuera del simulador: con respeto, y retoma el trabajo
  const cR = { antenas: [], parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  for (const q of ["¿quién ganó el partido de ayer?", "cuéntame un chiste", "¿qué hora es?", "¿cómo está el clima hoy?", "¿cuál es la capital de Francia?", "escríbeme un poema"]) {
    const r = m.responder(q, cR);
    caso(`Fuera del simulador: «${q}»`, /^Mi señor, fui diseñado y creado para cumplir órdenes y procesos dentro de este simulador/.test(r.texto) && /Barranca de Upía/.test(r.texto), r.texto.slice(0, 70));
  }
  caso("Con «señora» y sin tratamiento", /^Mi señora, fui/.test(m.responder("cuéntame un chiste", { ...cR, trato: "senora" }).texto) && /^Fui diseñado/.test(m.responder("cuéntame un chiste", { ...cR, trato: "ninguno" }).texto));
  caso("Lo del simulador no es fuera de tema («el clima en Radio Mobile», «¿cómo está la red?»)", !/fui diseñado/.test(m.responder("¿qué es el clima en Radio Mobile?", cR).texto) && !/fui diseñado/.test(m.responder("¿cómo está la red?", cR).texto) && !/fui diseñado/.test(m.responder("¿qué es la malla?", cR).texto));
  caso("«¿Cómo estás, Melki?» → cortesía y a sus órdenes (no el estado de la red)", /^Muy bien, señor, gracias por preguntar/.test(m.responder("¿Cómo estás, Melki?", cR).texto) && /^Muy bien/.test(m.responder("hola, ¿qué tal?", cR).texto));

  // Reposo y micrófono
  const ctl = (f) => m.controlDeVoz(f)?.tipo ?? null;
  caso("«Apaga el micrófono» apaga del todo; «deja de escuchar» vuelve al reposo", ctl("apaga el micrófono") === "microfono" && ctl("no me escuches más") === "microfono" && ctl("deja de escucharme del todo") === "microfono" && ctl("deja de escuchar") === "apagar" && ctl("apaga el asistente") === "apagar");
  const fz = m.frases("senor");
  caso("Las frases del reposo y del micrófono", /Quedo en reposo: cuando me necesite, diga «Hola Melki»/.test(fz.reposo) && /Apago el micrófono/.test(fz.microfono) && /aunque esta barra esté cerrada/.test(fz.bienvenida(true)));
  caso("La ayuda por voz cuenta el reposo y el micrófono", /reposo/.test(m.AYUDA_VOZ) && /apaga el micrófono/.test(m.AYUDA_VOZ));
  caso("«¿Qué es el Asistente Melki?» cuenta el reposo tipo Siri y la barra que se mueve", ((r) => /como Siri/.test(r.texto) && /se arrastra/.test(r.texto) && /fuera del simulador|se sale del simulador/.test(r.texto))(m.responder("¿qué es el asistente Melki?", cR)));
}

// ─── 19. v12.7: entender lugares mal dichos, preguntar con criterio, la red de todo un municipio y hasta dónde aguanta ───
{
  await m.cargarReferencia();
  // Cómo suena: los errores del dictado al hablar rápido siguen sonando como Barranca de Upía
  const suena = (a, b) => m.parecidoFonetico(m.claveFonetica(a.replace(/\b(de|del|la)\b/g, "")), m.claveFonetica(b.replace(/\b(de|del|la)\b/g, "")));
  caso("Fonética del español: b y v, s y z, ll y y, h muda suenan igual", m.claveFonetica("Villavicencio") === m.claveFonetica("biyabisensio") && m.claveFonetica("Yopal") === m.claveFonetica("Llopal") && m.claveFonetica("Acacías") === m.claveFonetica("acasias") && m.claveFonetica("Guerra") !== m.claveFonetica("jerra"));
  caso("«barranca de UPA», «barranco vía», «arranca de upyía» suenan como Barranca de Upía (≥ 0,86)", ["barranca de upa", "barranco via", "arranca de upyia"].every((t) => suena(t, "Barranca de Upia") >= 0.86), ["barranca de upa", "barranco via", "arranca de upyia"].map((t) => suena(t, "Barranca de Upia").toFixed(2)).join(" "));
  caso("…y las palabras comunes no suenan como municipios", suena("cumaral", "cumaribo") < 0.8 && suena("la loma", "la jagua") < 0.6);

  const reconoce = (t, departamento = null) => m.decidirLugar(m.reconocerLugares(t, { departamento }));
  const seguro = (t, nombre, dep = null) => ((d) => d.tipo === "seguro" && d.candidato.lugar.nombre === nombre)(reconoce(t, dep));
  caso("Con el departamento dicho al final, los tres errores del dictado son Barranca de Upía (Meta)", ["barranca de upa meta", "barranco vía meta", "arranca de upyía meta", "barranca de UPA, Meta"].every((t) => seguro(t, "Barranca de Upía")));
  const sinDep = reconoce("barranco vía");
  caso("Sin el departamento, «barranco vía» queda en duda, con Barranca de Upía primero", sinDep.tipo === "dudoso" && sinDep.opciones[0].lugar.nombre === "Barranca de Upía" && sinDep.opciones.length >= 2, sinDep.opciones.map((c) => c.lugar.nombre).join(", "));
  const granada = reconoce("granada");
  caso("Un nombre repetido (Granada: Meta, Antioquia, Cundinamarca) queda en duda…", granada.tipo === "dudoso" && granada.opciones.filter((c) => c.lugar.nombre === "Granada").length === 3);
  caso("…salvo que se diga el departamento o se esté viendo el Meta", seguro("granada meta", "Granada") && reconoce("granada meta").candidato.lugar.detalle === "Meta" && seguro("granada", "Granada", "Meta") && reconoce("granada", "Meta").candidato.lugar.detalle === "Meta");
  caso("«Puerto Boyacá» es el municipio (no «Puerto» en Boyacá); «el Meta» es el departamento", seguro("puerto boyaca", "Puerto Boyacá") && ((d) => d.tipo === "seguro" && d.candidato.lugar.tipo === "departamento")(reconoce("el meta")));
  caso("Lo que no es un lugar no se confunde («señal media», «la loma», «mejor»)", ["senal media", "la loma", "mejor"].every((t) => reconoce(t).tipo === "ninguno"));
  caso("Un nombre parecido lejos del departamento que se ve se confirma antes («barrancoloco» → ¿Barranco de Loba?)", reconoce("barrancoloco", "Meta").tipo === "dudoso");
  const contorno = m.contornoLugar({ tipo: "municipio", nombre: "Barranca de Upía", detalle: "Meta", lat: 4.5149, lon: -73.0024 });
  caso("El contorno de Barranca de Upía mide unos 409 km²", contorno && cerca(m.areaM2(contorno) / 1e6, 409, 5), contorno ? (m.areaM2(contorno) / 1e6).toFixed(1) : "sin contorno");
  const norte = m.recortarPoligono(contorno, "norte");
  const noreste = m.recortarPoligono(contorno, "noreste");
  caso("La zona norte es una parte del municipio, y el cuarto noreste es menor", m.areaM2(norte) > 0.2 * m.areaM2(contorno) && m.areaM2(norte) < 0.8 * m.areaM2(contorno) && m.areaM2(noreste) < m.areaM2(norte) && norte.every(([, la]) => la >= 4.5534 - 1e-6), `${(m.areaM2(norte) / 1e6).toFixed(0)} y ${(m.areaM2(noreste) / 1e6).toFixed(0)} km²`);
  caso("El reconocimiento de voz recibe los departamentos y los municipios del que se ve", ((x) => x.includes("Meta") && x.includes("Barranca de Upía") && x.includes("Puerto Gaitán") && !x.includes("Medellín"))(m.nombresParaVoz("Meta")));

  // Órdenes con el reconocimiento de lugares del simulador
  const crear = (dep = "Meta") => {
    const a = crearApi([]);
    a.buscarLugar = (t) => m.buscarLugares(t, 5);
    a.reconocerLugar = (t) => m.reconocerLugares(t, { departamento: dep });
    a.contornoLugar = (l) => m.contornoLugar(l);
    a.ubicacion = (lat, lon) => m.textoUbicacion(lat, lon);
    a.centro = { lat: 4.2, lon: -73.37 };
    a.cajaMapa = () => [-73.5, 4.1, -73.2, 4.3];
    return a;
  };
  const apiL = crear();
  let pend = null;
  let ultimoLugar = null;
  const hablar = (t, a = apiL) => {
    const o = m.interpretarOrden(t, a, pend, { ultimoLugar });
    const r = o ? m.ejecutarOrden(o, a) : null;
    pend = r?.pendiente ?? null;
    if (r?.lugar) ultimoLugar = r.lugar;
    return { o, r };
  };
  let x = hablar("ubícame en barranca de UPA meta");
  caso("«Ubícame en barranca de UPA meta» → lo lleva a Barranca de Upía (Meta), marca el municipio y dice su tamaño", x.o?.tipo === "ir" && x.o.lugar?.nombre === "Barranca de Upía" && /^Lo llevé a Barranca de Upía \(Meta\), un municipio de 40\.9\d\d ha/.test(x.r.texto) && apiL.llamadas.some((l) => l[0] === "marcar"), x.r?.texto.slice(0, 90));
  const red = x.r.acciones?.find((a) => /todo el municipio/.test(a.texto))?.orden;
  caso("…y ofrece la red sostenible de todo el municipio (y probar hasta dónde aguanta)", red?.tipo === "disenar" && red.area.forma === "poligono" && red.sostenible && cerca(m.areaM2(red.area.puntos) / 1e6, 409, 5) && x.r.acciones.some((a) => a.orden?.despues?.estres?.rampa));
  for (const t of ["llévame a barranco vía meta", "ubícame en arranca de upyía meta"]) caso(`«${t}» también`, ((y) => y.o?.tipo === "ir" && y.o.lugar?.nombre === "Barranca de Upía")(hablar(t)));
  x = hablar("ubícame en barranco vía");
  caso("«Ubícame en barranco vía» → «¿Se refiere a Barranca de Upía (Meta), …?» con un botón por lugar", x.o?.tipo === "elegir" && /^No estoy seguro de haber entendido «barranco via»\. ¿Se refiere a Barranca de Upía \(Meta\)/.test(x.r.texto) && x.r.acciones[0].orden?.tipo === "ir" && x.r.acciones.at(-1).texto === "Ninguno de esos" && pend?.tipo === "elegir", x.r?.texto.slice(0, 120));
  x = hablar("sí");
  caso("…«sí» lo lleva a la primera", x.o?.tipo === "ir" && x.o.lugar?.nombre === "Barranca de Upía");
  const apiSin = crear(null);
  x = hablar("llévame a granada", apiSin);
  caso("«Llévame a Granada» sin contexto → «Hay 3 lugares llamados Granada. ¿Cuál…?»", x.o?.tipo === "elegir" && /^Hay 3 lugares llamados Granada\. ¿Cuál: /.test(x.r.texto), x.r?.texto);
  x = hablar("el del meta", apiSin);
  caso("…«el del Meta» elige Granada (Meta)", x.o?.tipo === "ir" && x.o.lugar?.detalle === "Meta");
  hablar("llévame a granada", apiSin);
  x = hablar("la segunda", apiSin);
  caso("…«la segunda» elige la segunda opción", x.o?.tipo === "ir" && x.o.lugar?.nombre === "Granada");
  hablar("llévame a granada", apiSin);
  x = hablar("ninguno de esos", apiSin);
  caso("…«ninguno de esos» → «Entendido. ¿Me dice entonces el municipio y el departamento…?»", /^Entendido\. ¿Me dice entonces el municipio y el departamento/.test(x.r?.texto ?? "") && pend?.tipo === "lugar");
  x = hablar("Barranca de Upía, Meta", apiSin);
  caso("…y la respuesta «Barranca de Upía, Meta» completa la orden", x.o?.tipo === "ir" && x.o.lugar?.nombre === "Barranca de Upía");
  x = hablar("ubícame en xyzabc");
  caso("Un lugar que no existe → «Discúlpeme, no reconocí el lugar… ¿Me repite el municipio y el departamento?»", x.o?.tipo === "pedir-lugar" && /^Discúlpeme, no reconocí el lugar «xyzabc»\. ¿Me repite el municipio y el departamento, por favor\?/.test(x.r.texto) && pend?.tipo === "lugar");
  x = hablar("es barranca de upía en el meta, por favor");
  caso("…y la respuesta, aunque traiga más palabras, completa la orden", x.o?.tipo === "ir" && x.o.lugar?.nombre === "Barranca de Upía");

  // La red de todo un municipio, de una zona, de lo que se ve o «ahí»
  pend = null;
  ultimoLugar = null;
  x = hablar("ármame una red media estable que cubra todo el municipio de barranca de upía meta");
  caso("«Una red media estable que cubra todo el municipio de Barranca de Upía, Meta» → el contorno del municipio, señal media o mejor", x.o?.tipo === "disenar" && x.o.area.forma === "poligono" && x.o.area.nombre === "en todo el municipio de Barranca de Upía (Meta)" && x.o.margenDb === 30 && /^Diseño la malla para 40\.9\d\d ha \(409,\d km²\) en todo el municipio de Barranca de Upía \(Meta\)/.test(x.r.texto), x.r?.texto.slice(0, 120));
  caso("…dibuja el área con el nombre del municipio", apiL.llamadas.some((l) => l[0] === "medir" && /Área objetivo · Barranca de Upía \(Meta\)/.test(l[1].nombre)));
  x = hablar(
    "ármame una red que cubra todo el municipio teniendo en cuenta calidad, economía y cobertura, y con puntos de popularidad mira hasta qué punto aguantaría la red antes de quebrarse",
  );
  caso("«…todo el municipio (el de la conversación), calidad, economía y cobertura, puntos de popularidad y hasta qué punto aguantaría antes de quebrarse» → diseño sostenible, 250 personas por punto y la rampa", x.o?.tipo === "disenar" && x.o.area.forma === "poligono" && /Barranca de Upía/.test(x.o.area.nombre) && x.o.sostenible && x.o.despues?.zonas?.n === 250 && x.o.despues?.estres?.rampa === true && /subiendo la carga hasta ver dónde se quiebra cada uno/.test(x.r.texto), JSON.stringify(x.o?.despues));
  x = hablar("ármame una red que cubra la zona norte del municipio");
  caso("«La zona norte del municipio» → la mitad norte de Barranca de Upía", x.o?.tipo === "disenar" && x.o.area.forma === "poligono" && x.o.area.nombre === "en la zona norte del municipio de Barranca de Upía (Meta)" && m.areaM2(x.o.area.puntos) < 0.8 * 409e6);
  x = hablar("ármame una red estable de 3000 hectáreas ahí");
  caso("«Una red estable de 3.000 hectáreas ahí» → en el último lugar, con señal estable", x.o?.tipo === "disenar" && x.o.area.centro?.coord && cerca(x.o.area.centro.coord.lat, 4.5149, 1e-3) && x.o.margenDb === 37 && cerca(x.o.area.areaM2, 3e7, 1));
  x = hablar("ármame una red en lo que estoy viendo");
  caso("«Una red en lo que estoy viendo» → el rectángulo del mapa", x.o?.tipo === "disenar" && x.o.area.forma === "poligono" && x.o.area.puntos.length === 4 && x.o.area.nombre === "en la zona que está viendo en el mapa");
  x = hablar("ármame una red que cubra todo el departamento del Meta");
  caso("«Todo el departamento del Meta» es demasiado: lo dice y propone partes", x.o?.tipo === "aviso" && /mide 8\.\d{3}\.\d{3} ha \(85\.\d{3} km²\): es demasiado/.test(x.r.texto), x.r?.texto.slice(0, 120));
  x = hablar("arma una red mesh en 4.5149, -73.0024");
  caso("«Arma una red mesh en 4.5149, -73.0024» → pregunta el área y ofrece todo el municipio de Barranca de Upía", x.o?.tipo === "pedir-diseno" && x.r.acciones?.[0]?.texto === "Todo el municipio de Barranca de Upía" && x.r.acciones[0].orden?.area?.forma === "poligono" && /o «todo el municipio»/.test(x.r.texto));
  x = hablar("todo el municipio");
  caso("…«todo el municipio» lo arma sobre el contorno", x.o?.tipo === "disenar" && x.o.area.forma === "poligono" && /Barranca de Upía/.test(x.o.area.nombre));
  pend = null;
  x = hablar("ármame una red de 3.000 hectáreas en barranco via meta");
  caso("Al diseñar dice lo que entendió de un lugar mal dicho («Entendí «Barranca de Upía (Meta)».»)", x.o?.tipo === "disenar" && /^Entendí «Barranca de Upía \(Meta\)»\. Diseño la malla para 3\.000 ha/.test(x.r.texto), x.r?.texto.slice(0, 80));
  x = hablar("ármame una red de 3.000 hectáreas en barrancoloco");
  caso("…y si se parece a uno lejano, lo confirma («¿Se refiere a Barranco de Loba (Bolívar)?»)", x.o?.tipo === "elegir" && /¿Se refiere a Barranco de Loba \(Bolívar\)\?/.test(x.r.texto) && x.r.acciones[0].texto === "Sí, Barranco de Loba (Bolívar)");
  pend = null;
  caso("Una red «estable» (dicho justo después de «red») pide 37 dB", m.interpretarOrden("ármame una red estable que dé cobertura a 3000 hectáreas en Cumaral", apiL, null)?.margenDb === 37);

  // Hablar rápido
  caso("Correcciones al hablar rápido: «red mechen tal punto», «mediantales», «ubícameen»", m.corregirPalabras("arma una red mechen tal punto") === "arma una red mesh en tal punto" && m.corregirPalabras("una red mediantales coordenadas") === "una red mesh en tales coordenadas" && m.corregirPalabras("ubícameen Barranca") === "ubícame en Barranca");
  caso("«Heymelki» pegado también lo llama", ((a) => a.activado && a.resto === "ubícame en Cumaral")(m.detectarActivacion("heymelki ubícame en Cumaral")));
  caso("Las muletillas del comienzo se quitan («o sea, eh, ubícame…»)", m.limpiarComando("o sea, eh, ubícame en Cumaral") === "Ubícame en Cumaral");
  caso("Entre las versiones del reconocimiento gana la que el simulador entiende como orden", m.elegirAlternativa(["ubícame en barranco loco xyz", "ubícame en Barranca de Upía Meta"], (p) => (/Barranca de Upía/.test(p) ? 3 : 0)) === "ubícame en Barranca de Upía Meta");

  // Conversación
  const cV = { antenas: [], parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar", porVoz: true, vista: "Cumaral (Meta)" };
  const ruido = m.responder("barranco loco xyz pla", cV);
  caso("Por voz, lo que no se entiende → «Discúlpeme, señor, no le entendí bien. ¿Me lo repite, por favor? Escuché: «…»»", /^Discúlpeme, señor, no le entendí bien\. ¿Me lo repite, por favor\? Escuché: «barranco loco xyz pla»/.test(ruido.texto), ruido.texto.slice(0, 100));
  caso("…por escrito, lo que no es del simulador sigue con el mayordomo", /fui diseñado/.test(m.responder("barranco loco xyz pla", { ...cV, porVoz: false }).texto));
  caso("…y un pedido por voz que no se pudo convertir en orden también se disculpa", /^Discúlpeme, señor, no le entendí bien: entendí que quiere que haga algo/.test(m.responder("arma una red rarísima de gatos", cV).texto));
  caso("«¿Me escuchas?» → «Sí, señor, le escucho perfectamente»", /^Sí, señor, le escucho perfectamente/.test(m.responder("¿me escuchas?", cV).texto) && /^Sí, señor/.test(m.responder("Melki, ¿estás ahí?", cV).texto));
  caso("«¿Dónde estamos?» → el municipio que se ve", /^Estamos viendo Cumaral \(Meta\)/.test(m.responder("¿dónde estamos?", cV).texto) && /^Estamos viendo/.test(m.responder("¿qué municipio es este?", cV).texto));
  caso("«Excelente, Melki» → agradece y sigue", /^Muchas gracias, señor/.test(m.responder("excelente melki", cV).texto));
}


// ─── 20. v12.8: la voz sin duplicados, sin eco ni bucles, y sin prender y apagar el micrófono ───
{
  // Lo que el navegador repite
  caso("«ubícame en ubícame en Barranca» → «ubícame en Barranca» (grupos repetidos al hablar rápido)", m.quitarTartamudeo("ubícame en ubícame en Barranca de Upía") === "ubícame en Barranca de Upía" && m.quitarTartamudeo("hola Melki hola Melki pon el gateway") === "hola Melki pon el gateway");
  caso("…pero no toca lo que se repite a propósito ni los números («no, no», «cuatro punto cuatro cuatro»)", m.quitarTartamudeo("no, no, así no") === "no, no, así no" && m.quitarTartamudeo("cuatro punto cuatro cuatro") === "cuatro punto cuatro cuatro");
  caso("Android y Safari repiten lo dicho antes («uno», «uno dos»…): solo se toma lo nuevo", m.loNuevo("uno dos", "uno dos tres", { acumula: true, reciente: true }) === "tres" && m.loNuevo("Hola Melki,", "hola melki ubícame en Cumaral", { acumula: true, reciente: false }) === "ubícame en Cumaral");
  caso("La misma frase dos veces seguidas se toma una vez; dicha otra vez más tarde, sí cuenta", m.loNuevo("sí", "Sí.", { acumula: false, reciente: true }) === "" && m.loNuevo("sí", "sí", { acumula: false, reciente: false }) === "sí");
  caso("En el computador una frase que empieza como la anterior es una frase nueva", m.loNuevo("hola Melki", "hola Melki pon el gateway", { acumula: false, reciente: true }) === "hola Melki pon el gateway");

  // El eco: la propia voz de Melki que vuelve por el micrófono
  caso("El eco se reconoce aunque los números vuelvan en palabras", m.pareceEco("un municipio de cuatrocientos nueve coma dos kilómetros cuadrados", "Lo llevé a Barranca de Upía (Meta), un municipio de 40.919 ha (409,2 km²)."));
  caso("…y con ruido de por medio, si trae un trozo seguido de lo que dijo", m.pareceEco("eh no le entendí bien me lo repite por favor", "Discúlpeme, señor, no le entendí bien. ¿Me lo repite, por favor?"));
  caso("…pero el pedido de la persona no es eco", !m.pareceEco("ubícame en Cumaral", "Discúlpeme, señor, no le entendí bien. ¿Me lo repite, por favor?") && !m.pareceEco("ármame una red en Villavicencio", "Lo llevé a Barranca de Upía (Meta), un municipio de 40.919 ha (409,2 km²)."));
  caso("Empieza con su nombre: «Melki, …» y «Hola Melki, …» sí; «…, Melki» al final no", m.empiezaConNombre("Melki, ármame una red") && m.empiezaConNombre("Hola Melki, ubícame en Cumaral") && !m.empiezaConNombre("ármame una red que cubra todo, Melki"));
  const cD = { antenas: [], parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar", porVoz: true, trato: "senor" };
  const disc = m.respuestaNoEntendi(cD, "barranco loco pla xyz");
  caso("«¿Por qué el micrófono se prende y se apaga?» → explica la escucha sin eco ni cortes", /Con parlantes no me respondo a mí mismo/.test(m.responder("¿por qué el micrófono se prende y se apaga?", { ...cD, porVoz: false }).texto) && !/Con parlantes/.test(m.responder("hazme una red sostenible económica en Cumaral", { ...cD, porVoz: false }).texto));
  caso("La disculpa por voz no repite en voz lo que oyó (haría eco); lo deja escrito", disc.voz === "Discúlpeme, señor, no le entendí bien. ¿Me lo repite, por favor?" && /Escuché: «barranco loco pla xyz»/.test(disc.texto));

  // La escucha seguida, con un reconocimiento de mentira que se porta como Edge, Chrome y Android
  const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const sesiones = [];
  class Falso {
    constructor() {
      this.lista = [];
      sesiones.push(this);
    }
    start() {
      if (Falso.fallar) throw new Error("InvalidStateError");
    }
    stop() {
      setTimeout(() => this.onend?.(), 5);
    }
    abort() {
      this.onend?.();
    }
    enviar(i) {
      this.onresult?.({ resultIndex: i, results: this.lista.map((x) => ({ isFinal: x.f, length: 1, 0: { transcript: x.t } })) });
    }
    parcial(t) {
      const i = this.lista.findIndex((x) => !x.f);
      const k = i < 0 ? this.lista.push({ t, f: false }) - 1 : i;
      this.lista[k].t = t;
      this.enviar(k);
    }
    final(t) {
      const i = this.lista.findIndex((x) => !x.f);
      const k = i < 0 ? this.lista.push({ t, f: true }) - 1 : i;
      this.lista[k] = { t, f: true };
      this.enviar(k);
    }
    cortar(error) {
      if (error) this.onerror?.({ error });
      this.onend?.();
    }
  }
  globalThis.window = globalThis;
  globalThis.SpeechRecognition = Falso;
  const fijarAgente = (ua) => Object.defineProperty(globalThis, "navigator", { value: { userAgent: ua }, configurable: true, writable: true });
  const navOriginal = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  fijarAgente("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/141.0");
  const escuchar = async (opciones = { continuo: true }) => {
    const r = { frases: [], infos: [], estados: [], errores: [], textos: [], parciales: [] };
    const s = await m.iniciarDictado(
      "navegador",
      {
        onTexto: (f, p) => r.textos.push([f, p]),
        onEstado: (e) => r.estados.push(e),
        onError: (e) => r.errores.push(e),
        onFrase: (f, info) => {
          r.frases.push(f);
          r.infos.push(info);
        },
        onParcial: (p) => r.parciales.push(p),
      },
      {},
      opciones,
    );
    r.s = s;
    return r;
  };
  const ultima = () => sesiones.at(-1);

  let e = await escuchar();
  const antesDeOir = Date.now();
  ultima().parcial("hola");
  await dormir(30);
  ultima().final("hola Melki");
  ultima().final("hola Melki");
  ultima().parcial("ubícame en");
  ultima().final("ubícame en Cumaral");
  caso("Cada frase sale una sola vez, aunque el navegador la mande dos veces", e.frases.join(" | ") === "hola Melki | ubícame en Cumaral", e.frases.join(" | "));
  caso("…con la hora en que empezó a oírse (para reconocer el eco)", e.infos[0].inicio >= antesDeOir && e.infos[0].inicio <= antesDeOir + 25, `${e.infos[0]?.inicio - antesDeOir} ms`);
  // Edge corta la escucha a los pocos segundos de silencio: se vuelve a encender sola, sin avisar
  const n = sesiones.length;
  ultima().cortar();
  await dormir(150);
  caso("Si el navegador corta la escucha, se vuelve a encender sola y la pantalla sigue «escuchando»", sesiones.length === n + 1 && e.estados.join(",") === "escuchando", `${sesiones.length - n} · ${e.estados.join(",")}`);
  ultima().final("¿dónde estamos?");
  caso("…y lo dicho después sigue llegando, sin perder ni repetir lo anterior", e.frases.at(-1) === "¿dónde estamos?" && e.textos.at(-1)[0] === "hola Melki ubícame en Cumaral ¿dónde estamos?", e.textos.at(-1)?.[0]);
  // Lista que vuelve a empezar (algunos navegadores): la frase nueva llega completa
  ultima().lista = [];
  ultima().final("muestra los paneles");
  caso("Si el navegador empieza la lista de nuevo, la frase llega completa", e.frases.at(-1) === "muestra los paneles", e.frases.at(-1));
  const m0 = sesiones.length;
  e.s.detener();
  await dormir(150);
  caso("Al detenerla termina de verdad (no se vuelve a encender)", e.estados.at(-1) === "inactivo" && sesiones.length === m0, e.estados.join(","));

  // Sin internet: reintenta con espera creciente y, tras varios fallos seguidos, avisa y se detiene
  e = await escuchar();
  const reales = globalThis.setTimeout;
  globalThis.setTimeout = (f, ms, ...a) => reales(f, Math.min(ms ?? 0, 5), ...a);
  for (let k = 0; k < 8 && e.estados.at(-1) !== "inactivo"; k++) {
    ultima().cortar("network");
    await dormir(20);
  }
  globalThis.setTimeout = reales;
  caso("Sin internet reintenta varias veces y luego avisa una vez y se detiene (sin bucle)", e.errores.length === 1 && /internet/.test(e.errores[0]) && e.estados.at(-1) === "inactivo", `${e.errores.length} · ${e.estados.join(",")}`);
  // Sin permiso: se detiene enseguida, sin reintentar
  e = await escuchar();
  const m1 = sesiones.length;
  ultima().cortar("not-allowed");
  await dormir(100);
  caso("Sin permiso del micrófono se detiene enseguida (no lo prende y apaga)", sesiones.length === m1 && e.estados.at(-1) === "inactivo" && /permiso/.test(e.errores[0] ?? ""), e.errores.join(" "));
  // El dictado de la caja se detiene solo tras un silencio largo
  e = await escuchar({ continuo: true, silencioMax: 40 });
  await dormir(80);
  const m2 = sesiones.length;
  ultima().cortar();
  await dormir(100);
  caso("El dictado de la caja sigue tras los cortes y se detiene solo tras un silencio largo", sesiones.length === m2 && e.estados.at(-1) === "inactivo");
  // Cancelar no deja nada escuchando
  e = await escuchar();
  const m3 = sesiones.length;
  e.s.cancelar();
  ultima().cortar();
  await dormir(100);
  caso("Al apagarlo no queda nada escuchando", sesiones.length === m3 && e.estados.at(-1) === "inactivo");

  // Chrome en Android: cada resultado repite lo dicho antes («1 1 2 1 2 3…»)
  fijarAgente("Mozilla/5.0 (Linux; Android 14; SM-A546E) Chrome/141.0 Mobile");
  e = await escuchar();
  for (const t of ["uno", "uno dos", "uno dos tres", "uno dos tres"]) ultima().final(t);
  ultima().parcial("uno dos tres cuatro");
  caso("En Android no se repite: «uno», «uno dos», «uno dos tres» → «uno dos tres»", e.textos.at(-1)[0] === "uno dos tres" && e.parciales.at(-1) === "cuatro", `${e.textos.at(-1)?.[0]} · ${e.parciales.at(-1)}`);
  e.s.cancelar();
  // Safari: un solo resultado que va creciendo
  fijarAgente("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1");
  e = await escuchar();
  ultima().lista = [{ t: "hola Melki", f: true }];
  ultima().enviar(0);
  ultima().lista = [{ t: "hola Melki pon", f: false }];
  ultima().enviar(0);
  ultima().lista = [{ t: "hola Melki pon el gateway", f: true }];
  ultima().enviar(0);
  caso("En Safari, el resultado que crece no se repite: «hola Melki» + «pon el gateway»", e.frases.join(" | ") === "hola Melki | pon el gateway", e.frases.join(" | "));
  e.s.cancelar();
  if (navOriginal) Object.defineProperty(globalThis, "navigator", navOriginal);
  else delete globalThis.navigator;
  delete globalThis.SpeechRecognition;
  delete globalThis.window;
}

// ─── 21. v12.9: MeshCore o Meshtastic, persona por persona y optimizar la red para la carga ───
{
  const g = base("g", "Gateway", 4.2, -73.37, { pasarela: true, rol: "COMPANION" });
  const r1 = base("r1", "Repetidor 1", 4.25, -73.3, { rol: "REPETIDOR" });
  const api = crearApi([g, r1]);
  const orden = (t) => m.interpretarOrden(t, api, null);
  const mt = orden("cambia a Meshtastic");
  caso("«Cambia a Meshtastic» → LongFast con el límite de saltos de Meshtastic", mt?.tipo === "parametros" && mt.cambios.preset === "MT_LONG_FAST" && mt.cambios.limiteSaltos === 3, JSON.stringify(mt));
  caso("«Usa mesh tastic» (como lo oye el dictado) también", orden("usa mesh tastic")?.cambios?.preset === "MT_LONG_FAST");
  caso("«Usa MeshCore» en una red MeshCore avisa que ya lo está", orden("usa MeshCore")?.tipo === "aviso");
  caso("«¿Qué es Meshtastic?» no cambia nada (lo explica el cerebro)", orden("¿qué es Meshtastic?")?.tipo !== "parametros");
  caso("«Usa LongFast» → el preset de Meshtastic", orden("usa LongFast")?.cambios?.preset === "MT_LONG_FAST");
  const apiMt = crearApi([g, r1]);
  apiMt.parametros = () => ({ ...PARAMETROS, preset: "MT_LONG_FAST" });
  const omt = (t) => m.interpretarOrden(t, apiMt, null);
  caso("En Meshtastic, «usa SF9» es su MediumFast", omt("usa SF9")?.cambios?.preset === "MT_MEDIUM_FAST", JSON.stringify(omt("usa SF9")));
  caso("«Pon que los clientes no repitan» → CLIENT_MUTE", omt("pon que los clientes no repitan")?.cambios?.usuariosRepiten === false, JSON.stringify(omt("pon que los clientes no repitan")));
  caso("«Cambia a MeshCore» desde Meshtastic → SF11 de Trama", omt("cambia a MeshCore")?.cambios?.preset === "SF11_250");
  caso("«Optimiza la red para la carga» → optimizar", orden("optimiza la red para la carga")?.tipo === "optimizar");
  caso("«Recomiéndame gateways de apoyo» → optimizar", orden("recomiéndame gateways de apoyo")?.tipo === "optimizar");
  caso("«Getways de pollo» (como lo oye el dictado) → optimizar", orden("recomiéndame los getways de pollo")?.tipo === "optimizar");
  caso("«Optimiza la red» sola sigue siendo el ajuste de cobertura", orden("optimiza la red")?.tipo === "ajustar");
  caso("«¿Qué usuarios no funcionan?» → persona por persona", orden("¿qué usuarios no funcionan?")?.tipo === "usuarios-estres");
  caso("«¿A quiénes no les funciona?» → persona por persona", orden("¿a quiénes no les funciona la red?")?.tipo === "usuarios-estres");
  const med = orden("prueba la hora pico con lo medido en el gateway");
  caso("«Prueba la hora pico con lo medido en el gateway» → perfil medido", med?.tipo === "estres" && med.opciones.perfil === "medido" && med.opciones.pagosPersonaDia > 5 && med.opciones.horaPicoPct === 24, JSON.stringify(med));
  caso("«Aplica la optimización» → aplicar", orden("aplica la optimización")?.tipo === "aplicar-optimizacion");

  // Ejecutar con un simulador de mentira
  const medida = (atendidas, funcionan) => ({ atendidas, funcionan, total: 200, funcionanPct: funcionan / 2, completosPct: 60 + funcionan / 10, p95S: 90, canalPct: 80, estado: "revienta" });
  const prop = { id: "gateway-zona-r1", tipo: "gateway-zona", titulo: "Gateway de apoyo en Repetidor 1", que: "Convierta Repetidor 1 en gateway de apoyo.", porque: "Se revienta.", agregar: [], editar: [{ id: "r1", cambios: { pasarela: true } }], parametros: null, opciones: null, lat: 4.25, lon: -73.3, aplicable: true, antes: medida(80, 40), despues: medida(150, 120), ganancia: 80, gananciaAtendidas: 70 };
  const frec = { ...prop, id: "otra-frecuencia-r1", tipo: "otra-frecuencia", titulo: "Gateway de apoyo en 921,5 MHz en Repetidor 1", aplicable: false, editar: [], gananciaAtendidas: 40, ganancia: 30 };
  const opt = { antes: medida(80, 40), diagnostico: ["Con esta carga le funciona a 40 de 200 personas (20 %); canal del gateway 80 %."], propuestas: [prop, frec], combinada: null, descartadas: [], motivo: null };
  const usuarios = [
    { id: "p1", nombre: "Persona 1", lat: 4.2, lon: -73.3, zona: "r1", zonaNombre: "Repetidor 1", saltos: 2, margenDb: 8, snrDb: -9.5, exitoPct: 35, fisicaPct: 60, esperaS: 40, esperaP95S: 120, mensajes: 2, completos: 0, estado: "no", causa: "canal", porque: "El canal en Repetidor 1 está ocupado el 80 % del tiempo." },
    { id: "p2", nombre: "Persona 2", lat: 4.2, lon: -73.3, zona: "g", zonaNombre: "Gateway", saltos: 1, margenDb: 40, snrDb: 22.5, exitoPct: 98, fisicaPct: 100, esperaS: 5, esperaP95S: 10, mensajes: 1, completos: 1, estado: "bien", causa: null, porque: "" },
  ];
  const estres = { motivo: null, resumenUsuarios: { total: 2, porEstado: { bien: 1, funciona: 0, medias: 0, dificultad: 0, no: 1 }, funcionan: 1, funcionanPct: 50, porCausa: { canal: 1 } }, porUsuario: usuarios };
  apiMt.optimizarRed = async () => opt;
  apiMt.optimizacion = () => opt;
  let aplicada = null;
  apiMt.aplicarOptimizacion = async (p) => ((aplicada = p), true);
  apiMt.estres = () => estres;
  const ro = m.ejecutarOrden(omt("optimiza la red para la carga"), apiMt);
  caso("Optimizar avisa qué prueba (Meshtastic, gateways y antenas de apoyo)", /Busco cómo hacer que la red aguante esta carga \(Meshtastic\)/.test(ro.texto) && /gateways de apoyo, antenas de apoyo/.test(ro.texto) && ro.luego, ro.texto.slice(0, 160));
  const to = await ro.luego;
  caso("Cuenta lo que más ayuda y ofrece aplicarlo", /Gateway de apoyo en Repetidor 1: atiende a ~70 personas más/.test(to.texto) && /921,5 MHz/.test(to.texto) && to.acciones?.some((a) => a.orden?.tipo === "aplicar-optimizacion" && a.orden.indice === 0), to.texto.slice(0, 240).replace(/\n/g, " "));
  const ra = m.ejecutarOrden({ tipo: "aplicar-optimizacion", indice: 0, combinada: false }, apiMt);
  const ta = await ra.luego;
  caso("Aplicar la propuesta: la aplica, vuelve a probar y deja deshacer", aplicada?.id === "gateway-zona-r1" && /apliqué «Gateway de apoyo en Repetidor 1»/.test(ta.texto) && /De 2 personas, a 1 les funciona/.test(ta.texto) && ra.deshacer);
  const rf = m.ejecutarOrden({ tipo: "aplicar-optimizacion", indice: 1, combinada: false }, apiMt);
  caso("La otra frecuencia se hace en campo, no en el mapa", /se hace en campo/.test(rf.texto) && !rf.luego);
  const ru = m.ejecutarOrden(omt("¿qué usuarios no funcionan?"), apiMt);
  caso("Persona por persona: cuántas les funciona, las que peor la pasan y por qué", /a 1 les funciona \(50 %\)/.test(ru.texto) && /Persona 1: no le funciona, le vuelve el 35 %/.test(ru.texto) && /canal ocupado/.test(ru.texto) && /contorno/.test(ru.texto) && ru.acciones?.some((a) => a.orden?.tipo === "optimizar"), ru.texto.slice(0, 240).replace(/\n/g, " "));

  // Cerebro
  const c = { antenas: [g, r1], parametros: { ...PARAMETROS, preset: "SF11_250" }, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  const rm = m.responder("¿qué es Meshtastic?", c);
  caso("«¿Qué es Meshtastic?» explica los dos protocolos y ofrece cambiar", /Meshtastic:/.test(rm.texto) && /MeshCore:/.test(rm.texto) && rm.acciones?.some((a) => a.orden?.tipo === "parametros" && a.orden.cambios.preset === "MT_LONG_FAST"), rm.texto.slice(0, 160));
  const rg = m.responder("¿qué se midió en el gateway?", c);
  caso("«¿Qué se midió en el gateway?» da los valores de la ficha, antena por antena", m.FICHA_GATEWAY.antenas.every((a) => rg.texto.includes(`${a.nombre} (`)) && /185 mensajes al día/.test(rg.texto) && /responde el 64 %/.test(rg.texto) && /responde el 0 %/.test(rg.texto), rg.texto.slice(0, 200));
  const gw = m.FICHA_GATEWAY.claves[0];
  if (gw) caso(`«Lo medido en ${gw}» también es el perfil medido`, orden(`prueba la hora pico con lo de ${gw}`)?.opciones?.perfil === "medido");
  caso("«¿Qué son los gateways de apoyo?» explica la optimización", /Gateways de apoyo/.test(m.responder("¿qué son los gateways de apoyo?", c).texto));
}

// v13 · El pitch por voz o por escrito: empezar, avanzar, ir a un capítulo, probar una comisión
{
  const pp = (t, enCurso = false) => m.pedidoPitch(t, enCurso);
  caso("«Preséntame el modelo de negocio» y «Melki, haz el pitch» empiezan la presentación", pp("preséntame el modelo de negocio")?.accion === "empezar" && pp("Melki, haz el pitch")?.accion === "empezar" && pp("inicia la presentación")?.accion === "empezar");
  caso("Las preguntas sobre el pitch las contesta el cerebro (no lo abren)", pp("¿qué es el pitch?") === null && pp("¿cómo funciona la presentación?") === null);
  caso("Las órdenes cortas solo con la presentación abierta", pp("siguiente") === null && pp("siguiente", true)?.accion === "siguiente" && pp("anterior", true)?.accion === "anterior" && pp("pausa", true)?.accion === "pausar" && pp("sigue", true)?.accion === "seguir" && pp("repite", true)?.accion === "repetir");
  const c300 = pp("prueba una comisión de 300 pesos", true);
  const c1500 = pp("¿y con una comisión de 1.500 pesos?", true);
  caso("Probar una comisión lleva al punto de equilibrio con ese valor", c300?.accion === "ir" && c300.capitulo === "equilibrio" && c300.comision === 300 && c1500?.comision === 1500, JSON.stringify(c1500));
  caso("Ir a un capítulo y terminar", pp("ve a la inversión", true)?.capitulo === "inversion" && pp("vamos a la cobertura", true)?.capitulo === "cobertura" && pp("termina la presentación", true)?.accion === "terminar" && pp("termina la presentación") === null);
}

// v13 · Conversar con la IA (Gemini Live): la conexión, el audio, las herramientas y la reanudación
{
  const tick = (ms = 5) => new Promise((ok) => setTimeout(ok, ms));
  class WsFalso {
    static ultimo = null;
    constructor(url) {
      this.url = url;
      this.enviados = [];
      this.readyState = 0;
      WsFalso.ultimo = this;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.();
      }, 0);
    }
    send(d) {
      this.enviados.push(JSON.parse(d));
    }
    close(code = 1000, reason = "") {
      if (this.readyState === 3) return;
      this.readyState = 3;
      setTimeout(() => this.onclose?.({ code, reason }), 0);
    }
    /** Lo que manda el servidor. */
    llega(msj) {
      this.onmessage?.({ data: JSON.stringify(msj) });
    }
    /** El servidor cierra (o se cae la red). */
    cae(code, reason = "") {
      this.readyState = 3;
      this.onclose?.({ code, reason });
    }
  }
  const setup = m.mensajeSetup({ clave: "k", instrucciones: "Eres Melki", herramientas: m.HERRAMIENTAS_IA, voz: "Charon" }).setup;
  caso(
    "La configuración pide voz, subtítulos, herramientas, conversaciones largas y manijas para reanudar",
    setup.model === `models/${m.MODELO_IA_DEFECTO}` && setup.generationConfig.responseModalities.join() === "AUDIO" && setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === "Charon" && setup.tools[0].functionDeclarations.length === 5 && setup.inputAudioTranscription && setup.outputAudioTranscription && setup.contextWindowCompression.slidingWindow && setup.sessionResumption && !setup.sessionResumption.handle && setup.systemInstruction.parts[0].text === "Eres Melki",
  );
  const sinVoz = m.mensajeSetup({ clave: "k", instrucciones: "x", modelo: "models/otro", reanudar: "h-1" }).setup;
  caso("Sin voz elegida usa la del modelo; con manija, reanuda", sinVoz.model === "models/otro" && !sinVoz.generationConfig.speechConfig && !sinVoz.tools && sinVoz.sessionResumption.handle === "h-1");

  const ev = { audios: [], usuario: "", modelo: "", turnos: 0, interr: 0, herr: [], adios: [], cerradas: [] };
  const s = new m.SesionLive(
    { clave: "k-1", instrucciones: "Eres Melki", herramientas: m.HERRAMIENTAS_IA, url: "ws://x/ws", WebSocketImpl: WsFalso },
    {
      onAudio: (p) => ev.audios.push(p),
      onTextoUsuario: (t) => (ev.usuario += t),
      onTextoModelo: (t) => (ev.modelo += t),
      onTurnoCompleto: () => ev.turnos++,
      onInterrumpido: () => ev.interr++,
      onHerramientas: (l) => ev.herr.push(...l),
      onAdios: (ms) => ev.adios.push(ms),
      onCerrada: (t, c, r) => ev.cerradas.push({ t, c, r }),
    },
  );
  const p = s.conectar(2000);
  s.enviarTexto("antes de abrir");
  await tick();
  const ws = WsFalso.ultimo;
  caso("Conecta con la clave en la dirección y lo primero que manda es la configuración", ws.url === "ws://x/ws?key=k-1" && ws.enviados.length === 1 && ws.enviados[0].setup?.model);
  ws.llega({ setupComplete: {} });
  await p;
  caso("Lo pedido mientras abría sale apenas abre", s.lista && ws.enviados[1]?.realtimeInput?.text === "antes de abrir");
  const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
  ws.llega({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: m.aBase64(m.bytesDePcm(pcm)) } }] } } });
  caso("La voz del modelo llega como PCM de 16 bits", ev.audios.length === 1 && [...ev.audios[0]].join() === [...pcm].join());
  ws.llega({ serverContent: { inputTranscription: { text: "pon un " } } });
  ws.llega({ serverContent: { inputTranscription: { text: "repetidor" } } });
  ws.llega({ serverContent: { outputTranscription: { text: "Listo." }, turnComplete: true } });
  caso("Lo que oyó, lo que dice y el fin del turno", ev.usuario === "pon un repetidor" && ev.modelo === "Listo." && ev.turnos === 1);
  ws.llega({ toolCall: { functionCalls: [{ id: "f1", name: "estado_simulador", args: {} }] } });
  s.responder([{ id: "f1", name: "estado_simulador", response: { ok: true } }]);
  caso("Pide una herramienta y recibe su respuesta", ev.herr[0]?.name === "estado_simulador" && ws.enviados.at(-1)?.toolResponse?.functionResponses?.[0]?.id === "f1");
  s.enviarAudio(new Int16Array(1600));
  const audio = ws.enviados.at(-1)?.realtimeInput?.audio;
  caso("El micrófono va en PCM de 16 kHz (100 ms = 3.200 bytes)", audio?.mimeType === "audio/pcm;rate=16000" && m.deBase64(audio.data).length === 3200);
  ws.llega({ serverContent: { interrupted: true } });
  ws.llega({ sessionResumptionUpdate: { newHandle: "h-9", resumable: true } });
  ws.llega({ sessionResumptionUpdate: { newHandle: "", resumable: false } });
  ws.llega({ goAway: { timeLeft: "4.5s" } });
  caso("Interrupción, la última manija buena para reanudar y el aviso de cierre de Google", ev.interr === 1 && s.manija === "h-9" && ev.adios[0] === 4500);
  ws.cae(1011, "Internal error");
  caso("Si la conexión se cae sola, avisa y dice que vale reanudar", ev.cerradas.length === 1 && ev.cerradas[0].c === 1011 && ev.cerradas[0].r === true && !s.lista);

  let caidas = 0;
  const s2 = new m.SesionLive({ clave: "k-1", instrucciones: "x", reanudar: s.manija, WebSocketImpl: WsFalso }, { onCerrada: () => caidas++ });
  const p2 = s2.conectar(2000);
  await tick();
  const ws2 = WsFalso.ultimo;
  caso("La conexión nueva sigue la misma conversación (con la manija)", ws2.enviados[0].setup.sessionResumption.handle === "h-9" && s2.manija === "h-9");
  ws2.llega({ setupComplete: {} });
  await p2;
  s2.cerrar();
  await tick();
  caso("Cerrarla a propósito no cuenta como caída", caidas === 0 && !s2.lista);

  const s3 = new m.SesionLive({ clave: "mala", instrucciones: "x", WebSocketImpl: WsFalso });
  const p3 = s3.conectar(2000).then(() => "", (e) => e.message);
  await tick();
  WsFalso.ultimo.cae(1008, "API key not valid. Please pass a valid API key.");
  caso("Clave mala: lo explica en español", /no es válida/.test(await p3));
  const s4 = new m.SesionLive({ clave: "k", instrucciones: "x", WebSocketImpl: WsFalso });
  caso("Si Google no responde, avisa a tiempo", /no respondió a tiempo/.test(await s4.conectar(40).then(() => "", (e) => e.message)));
  caso(
    "Por qué se cerró y si vale reanudar (no con la clave, el cupo o el modelo)",
    /cupo gratuito/.test(m.motivoCierre(1011, "RESOURCE_EXHAUSTED: quota exceeded")) && /sin internet/.test(m.motivoCierre(1006, "")) && m.cierreRecuperable(1006, "") && m.cierreRecuperable(1011, "deadline expired") && !m.cierreRecuperable(1011, "quota exceeded") && !m.cierreRecuperable(1008, "") && !m.cierreRecuperable(1007, "Request contains an invalid argument"),
  );

  // El audio del micrófono a 16 kHz: promedia (filtro), recorta y no pierde muestras entre trozos
  const r48 = m.aPcm16k(new Float32Array(4800).fill(0.5), 48000, { fase: 0 });
  caso("48 kHz a 16 kHz: 4.800 muestras dan 1.600, con el valor de 16 bits", r48.length === 1600 && r48.every((v) => Math.abs(v - 16384) <= 1));
  const resto = { fase: 0 };
  let n = 0;
  for (let k = 0; k < 10; k++) n += m.aPcm16k(new Float32Array(4410), 44100, resto).length;
  caso("44,1 kHz en trozos: un segundo da 16.000 muestras (±1)", Math.abs(n - 16000) <= 1, String(n));
  caso("Lo que se pasa de 1 se recorta (sin dar la vuelta)", m.aPcm16k(new Float32Array(30).fill(2), 48000, { fase: 0 }).every((v) => v === 32767));
  const grande = new Uint8Array(100000).map((_, k) => (k * 37) % 256);
  caso("Base64 por trozos (audios largos) ida y vuelta", m.deBase64(m.aBase64(grande)).every((v, k) => v === grande[k]));

  // Quién es Melki para la IA y qué puede hacer en el simulador
  const nombres = m.HERRAMIENTAS_IA.map((h) => h.name);
  caso("Las herramientas de la IA: órdenes, estado, conocimiento, presentación y despedida", nombres.join() === "ejecutar_orden,estado_simulador,consultar_melki,presentacion,terminar_conversacion" && m.HERRAMIENTAS_IA.every((h) => h.description.length > 40) && m.HERRAMIENTAS_IA.find((h) => h.name === "presentacion").parameters.properties.accion.enum.includes("empezar"));
  const ins = m.instruccionesMelki("senor", "Estado: {}");
  caso("Las instrucciones: trato, no inventar cifras, usar las herramientas y el estado al final", /«señor»/.test(ins) && /Nunca inventes cifras/.test(ins) && /estado_simulador/.test(ins) && ins.endsWith("Estado: {}") && /«señora»/.test(m.instruccionesMelki("senora")) && /de usted/.test(m.instruccionesMelki("neutro")));
  const gw = base("g", "Gateway", 4.2, -73.37, { pasarela: true, rol: "COMPANION" });
  const rep = base("r1", "Repetidor 1", 4.25, -73.3, { rol: "REPETIDOR" });
  const est = m.estadoParaIA({ antenas: [gw, rep], parametros: { ...PARAMETROS, preset: "SF11_250" }, resultado: null, desactualizado: false, estres: null, optimizacion: null, ubicacion: () => "Cumaral (Meta)", centro: { lat: 4.2, lon: -73.3 } });
  caso(
    "El estado para la IA: la red, que falta simular y los costos de Trama (sin inventar)",
    est.gateways === 1 && est.repetidores === 1 && est.simulado === false && /Falta simular/.test(est.cobertura) && est.infraestructura.length === 2 && est.infraestructura[0].lugar === "Cumaral (Meta)" && est.costos.inversionTotal === Math.round(m.costoRedTrama(1, 1, 0).inversion.total) && est.mapaCentro.lugar === "Cumaral (Meta)",
    JSON.stringify(est.costos).slice(0, 160),
  );

  // El cerebro local explica el pitch y la IA, y ofrece abrirlos
  const c = { antenas: [gw, rep], parametros: { ...PARAMETROS, preset: "SF11_250" }, resultado: null, desactualizado: false, relieve: "teselas", modo: "sembrar" };
  const rp = m.responder("¿qué es el pitch?", c);
  caso("«¿Qué es el pitch?» lo explica y ofrece empezarlo", /En el pitch recorro el mapa con mi robot/.test(rp.texto) && rp.acciones?.some((a) => a.accion === "pitch"));
  const ri = m.responder("¿puedes hablar como chat gpt con gemini live?", c);
  caso("Hablar como una IA: Gemini Live gratis con la clave, y ofrece abrir los ajustes", /Gemini Live de Google/.test(ri.texto) && /gratis/.test(ri.texto) && ri.acciones?.some((a) => a.accion === "ajustes-ia"), ri.texto.slice(0, 120));
}

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron` : "\n✓ Melki verificado");
process.exit(fallos ? 1 : 0);
