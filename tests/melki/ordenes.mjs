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
export { responder, noEntendiOrden } from "./src/components/melki/cerebro";
export { areaM2, poligonoCirculo } from "./src/lib/radio/area";
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
  caso("Al terminar cuenta la cobertura real dentro del área y los repetidores", /^Listo: la malla cubre el 100 %/.test(final.texto) && /Sembré 1 repetidor de 15 m/.test(final.texto) && /buena 0 %, estable 100 %/.test(final.texto), final.texto.slice(0, 160).replace(/\n/g, " "));
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
  caso("«Pon a Repetidor 1 como cliente» → rol CLIENT", orden("pon a Repetidor 1 como cliente")?.cambios?.rol === "CLIENT");
  caso("«Repetidor 1 en modo mudo» → CLIENT_MUTE", orden("pon Repetidor 1 en modo mudo")?.cambios?.rol === "CLIENT_MUTE");
  caso("«Usa en Persona 1 el equipo radio portátil»", orden("usa en Persona 1 el equipo radio portátil")?.cambios?.equipo === "portatil-2dbi");
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
  caso("Un pedido que no entiende no se responde con un tema al azar", /no logré convertirlo en una orden/.test(m.responder("hazme el café por favor", c).texto));
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
  caso("Explica cómo pesa el costo sin dar precios", /30 m/.test(costos) && /no los muestro/.test(costos) && !/\$|millones|\d{3}\.\d{3}/.test(costos));
  caso("Explica la cobertura útil y el área objetivo", /60 %/.test(m.responder("¿qué es el área objetivo?", c).texto));
  caso("«¿Qué puedes hacer?» incluye ajustar la red", /Ajustar la red/.test(m.responder("¿qué puedes hacer?", c).texto));
}

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron` : "\n✓ Melki verificado");
process.exit(fallos ? 1 : 0);
