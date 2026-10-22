// Pruebas de Melki (sin navegador): interpreta pedidos en español y los ejecuta sobre un simulador de mentira.
// Uso: npm run prueba:melki
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const entrada = `
export { interpretarOrden, ejecutarOrden, extraerCoordenadas } from "./src/components/melki/ordenes";
export { responder } from "./src/components/melki/cerebro";
export { normalizarDictado, componerTexto, quitarRepeticiones } from "./src/components/melki/dictado";
export { TOURS } from "./src/components/melki/tours";
export { estadoInicial, reductor } from "./src/components/simulador/estado";
export { estadoRed } from "./src/lib/radio/estado-red";
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
  caso("Preset", m.interpretarOrden("usa Long Moderate", api, null)?.cambios?.preset === "LONG_MODERATE");
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
    "«Hazme un tour» → menú con los 7 tours, el básico primero",
    menu.acciones?.length === 7 && menu.acciones[0].tour === "basico" && /recomendado/.test(menu.acciones[0].texto) && menu.acciones.every((a) => a.accion === "recorrido" && a.detalle),
    menu.acciones?.map((a) => a.tour).join(","),
  );
  caso("«Ayuda» → menú de tours", m.responder("ayuda", c).acciones?.length === 7);
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
  caso("Siete tours con nombre, detalle e introducción", ids.length === 7 && new Set(ids).size === 7 && m.TOURS.every((x) => x.nombre && x.detalle && x.pasos.length >= 4 && !x.pasos[0].objetivo && !x.pasos[0].tarea));
  caso("El tutorial básico tiene 7 pasos", m.TOURS[0].id === "basico" && m.TOURS[0].pasos.length === 8);

  // Cada paso práctico: no está hecho al entrar, «Hágalo por mí» lo hace y se detecta (con un simulador de mentira)
  const SOLO_PANTALLA = new Set(["medir:A Google Earth"]); // depende del menú «Archivo» en pantalla
  for (const tour of m.TOURS.filter((x) => x.practica && x.id !== "melki")) {
    let estado = { ...m.estadoInicial(), escenario: tour.practica.escenario(), autoSimular: tour.practica.autoSimular };
    let alDia = false;
    let inspeccion = null;
    let perfil = null;
    let perfilTerreno = false;
    let siembra = "nada";
    let propuesta = null;
    let mensaje = 0;
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
      foto: () => ({ estado, inspeccion, perfil, perfilTerreno, siembra, mensaje }),
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
  caso("¿Cómo viaja un mensaje? → inundación, ROUTER y tiempo en el aire", /inundación/.test(m.responder("¿cómo viaja un mensaje?", c).texto) && /ROUTER/.test(m.responder("¿cómo viaja un mensaje?", c).texto) && /en el aire/.test(m.responder("¿cuánto tarda un mensaje?", c).texto));
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
  caso("El mensaje cuenta la respuesta de la IA", /IA del gateway le contesta/.test(m.ejecutarOrden({ tipo: "mensaje", id: "p1" }, api).texto));
}

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron` : "\n✓ Melki verificado");
process.exit(fallos ? 1 : 0);
