// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Pruebas de lo oído mal (v17.4, sin navegador): las correcciones seguras y las versiones de lo dicho (oido.ts), qué
// versión usa Melki y cuándo pregunta, lo que se limpia de lo dictado, «cerca de…» y las alturas relativas, y los
// corpus de frases dichas con mala pronunciación (inglés con acento y español rápido, como las escribe el
// reconocimiento de voz) que deben dar la misma orden que la frase bien dicha, sin volver órdenes la charla.
// Uso: npm run prueba:melki (corre después de ingles.mjs)
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { simuladorFalso } from "./simulador-falso.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(aqui, "..", "..");
const entrada = `
export * from "./src/lib/idioma";
export { interpretarOrden, ejecutarOrden, esConsulta } from "./src/components/melki/ordenes";
export { traducirPedido, espanolDeMezcla } from "./src/components/melki/ingles";
export { cargarReferencia, buscarLugares, reconocerLugares } from "./src/lib/geo/referencia";
export { estadoRed } from "./src/lib/radio/estado-red";
export { limpiarComando } from "./src/components/melki/manos-libres";
export { responder } from "./src/components/melki/cerebro";
export { corregirOido, variantesOidas, pareceParaMelki, esPregunta, variantesEntendidas, variantesParaUsar, decidirVariante, anclaDelSimulador, pareceOrdenDeMelki, empiezaComoOrden, nombreDictado, ordenConNombreDictado, pareceCharla } from "./src/components/melki/oido";
export { presupuestoEnTexto } from "./src/components/melki/medidas";
`;
const tmp = mkdtempSync(path.join(os.tmpdir(), "melki-oido-"));
const archivo = path.join(tmp, "melki-oido.mjs");
const r = await build({ stdin: { contents: entrada, resolveDir: repo, loader: "ts" }, bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
writeFileSync(archivo, r.outputFiles[0].text);
const m = await import(pathToFileURL(archivo).href);

let fallos = 0;
const caso = (nombre, ok, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle && !ok ? ` (${detalle})` : ""}`);
  if (!ok) fallos++;
};

const { PARAMETROS, crearApi, nodos } = simuladorFalso(m);
await m.cargarReferencia();
/** Los mismos nodos con los nombres que les pone la pantalla en inglés. */
const nodosEn = () => nodos().map((a) => ({ ...a, nombre: a.nombre.replace("Repetidor", "Repeater").replace("Persona", "Person").replace("Torre", "Tower") }));
/** El simulador de mentira con los lugares de verdad (municipios, departamentos y países, con su fonética). */
const apiReal = (antenas) => {
  const a = crearApi(antenas);
  a.buscarLugar = (t) => m.buscarLugares(t, 6);
  a.reconocerLugar = (t) => m.reconocerLugares(t, { max: 6, departamento: "Meta" });
  return a;
};
const contexto = { ultimoNodo: "r1", ultimoLugar: null };
const ctxCerebro = (antenas, lengua) => ({ antenas, parametros: PARAMETROS, resultado: null, desactualizado: false, relieve: "plano", modo: "sembrar", trato: "senor", porVoz: true, vista: "Cumaral (Meta)", modeloMelki: { activo: true, aprendidas: 0 }, lengua });
/** La orden sin lo que solo se muestra (con el nombre: renombrar a otro nombre no es lo mismo). */
const firmaOrden = (o) => JSON.stringify(o, (k, v) => (["nota", "lugarUsado", "descripcion", "clases", "etiqueta", "medida", "pregunta", "texto", "titulo", "desde", "original"].includes(k) ? undefined : v));
const distanciaM = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos((b.lat * Math.PI) / 180));

/* ───────────── Lo que hace Melki con lo dicho (como melki.tsx: atender y evaluarFrase) ───────────── */

const INCOMPLETAS = ["pedir-lugar", "aviso", "coordenada-sola"];
const incompleta = (o) => INCOMPLETAS.includes(o.tipo) || ((o.tipo === "pieza" || o.tipo === "agregar" || o.tipo === "mover") && !o.coord);
const DESTRUCTIVAS = new Set(["eliminar", "eliminar-varios", "nuevo", "ejemplo", "ejemplo-malla", "quitar-pobladas", "quitar-zonas", "borrar-mediciones", "descartar-siembra", "descartar-ajuste"]);
// (como melki.tsx: «deshacer» no es una orden del intérprete, pero Melki la entiende y deshace lo último)
const DESHACER = /\b(deshac\w*|deshaz|revierte|revertir|anula lo [uú]ltimo)\b/i;
const destructiva = (x) => (x.orden ? DESTRUCTIVAS.has(x.orden.tipo) : DESHACER.test(x.frase));
const CHARLA = new Set(["saludo", "gracias", "quien"]);

/**
 * Lo que entiende Melki de lo dicho en `lengua`: `firmas` (la orden, o las opciones si pregunta «¿quiso decir…?» o «¿se
 * refiere a…?», o el tema que contesta), `via` (regla, oído o cerebro) y la decisión con lo oído («hacer», «dudas»,
 * «confirmar»). `porVoz`: lo dicho pasa antes por la limpieza del dictado.
 */
function procesar(dicho0, lengua, porVoz = false) {
  m.fijarIdioma(lengua);
  const antenas = lengua === "en" ? nodosEn() : nodos();
  const api = apiReal(antenas);
  const nombres = antenas.map((a) => a.nombre);
  const dicho = porVoz ? m.limpiarComando(dicho0, lengua) : dicho0;
  const palabras = (t) => (lengua === "en" ? m.traducirPedido(t, { nombres }) : m.espanolDeMezcla(t, { nombres }));
  // (como melki.tsx: por voz, el nombre nuevo va con mayúsculas)
  const ordenDe = (t) => {
    try {
      const o = m.interpretarOrden(palabras(t), api, null, contexto);
      return o && o.tipo !== "coordenada-sola" ? (porVoz ? m.ordenConNombreDictado(o) : o) : null;
    } catch {
      return null;
    }
  };
  const ctx = ctxCerebro(antenas, lengua);
  const sirve = (x) => x && !x.noEntendido && !x.fueraDeTema && !CHARLA.has(x.tema ?? "");
  const tema = (t) => {
    const frase = palabras(t);
    const a = m.responder(t, ctx);
    if (sirve(a)) return a.tema ?? "?";
    if (frase !== t) {
      const b = m.responder(frase, { ...ctx, lengua: "es", traducido: true });
      if (sirve(b)) return b.tema ?? "?";
    }
    return null;
  };
  const evaluar = (t) => {
    const frase = palabras(t);
    const o = ordenDe(t);
    if (o) return { nivel: 2, completa: !incompleta(o), orden: o, frase };
    if (DESHACER.test(frase)) return { nivel: 2, completa: true, frase };
    if (tema(t) !== null) return { nivel: 1, completa: true, frase };
    return { nivel: 0, completa: false, frase };
  };
  const firmasDe = (o) => (o.tipo === "elegir" ? [firmaOrden(o), ...(o.opciones ?? []).filter((x) => x.orden).map((x) => firmaOrden(x.orden))] : [firmaOrden(o)]);
  const o = ordenDe(dicho);
  try {
    if (!o || incompleta(o)) {
      const vs = m.variantesParaUsar(dicho, lengua, { orden: o, incompleta, respuesta: o ? null : m.responder(dicho, ctx), evaluar, nombres, consulta: m.esConsulta });
      const d = m.decidirVariante(vs, { clave: (x) => (x.orden ? firmaOrden(x.orden) : x.frase), destructiva });
      if (d) {
        const elegidas = d.tipo === "dudas" ? d.opciones : [d.variante];
        const firmas = elegidas.flatMap((v) => (v.orden ? firmasDe(v.orden) : [`tema:${tema(v.texto) ?? "?"}`]));
        return { via: "oido", decision: d.tipo, firmas, texto: elegidas[0].texto, dicho };
      }
    }
    if (o) return { via: "regla", firmas: firmasDe(o), dicho };
    const t = tema(dicho);
    return { via: "cerebro", firmas: t === null ? [] : [`tema:${t}`], dicho };
  } finally {
    m.fijarIdioma("es");
  }
}

/* ───────────── 1. Las correcciones seguras (siempre) ───────────── */

{
  const en = ["Gateway", "Repeater 1", "Repeater 2", "Person 1", "Person 2", "Tower 2"];
  const es = ["Gateway", "Repetidor 1", "Repetidor 2", "Persona 1", "Persona 2", "Torre 2"];
  const C = (t, lengua, nombres) => m.corregirOido(t, lengua, nombres);
  const casos = [
    ["add a repeat her to kilometers nort of the gateway", "en", en, "add a repeater 2 kilometers north of the gateway"],
    ["put the get away in Cumaral", "en", en, "put the gateway in Cumaral"],
    ["move Person to 1 km north", "en", en, "move Person 2 1 km north"],
    ["add a repeater 3 km sauce of the gateway", "en", en, "add a repeater 3 km south of the gateway"],
    ["set the liability too high", "en", en, "set the reliability to high"],
    ["spread 300 user across the area", "en", en, "spread 300 users across the area"],
    ["pon el geitwey en Cumaral", "es", es, "pon el gateway en Cumaral"],
    ["agrega un repetidor a 3 kilo metros al norte", "es", es, "agrega un repetidor a 3 kilómetros al norte"],
  ];
  const malos = casos.filter(([t, l, n, e]) => C(t, l, n).toLowerCase() !== e.toLowerCase()).map(([t, l, n, e]) => `«${t}» → «${C(t, l, n)}» (esperado «${e}»)`);
  caso(`v17.4 · Correcciones seguras de lo oído (${casos.length}): «repeat her», «to kilometers nort», «Person to», «geitwey», «kilo metros»…`, malos.length === 0, malos.join(" | "));

  // Lo que no se toca: los nombres de los nodos, lo que va entre comillas, la charla y las frases bien dichas
  const quietas = [
    ["rename Repeater 1 to \"Person to\"", "en", en],
    ["is the antenna too high?", "en", en],
    ["take a screenshot of the map", "en", en],
    ["the weather is nice today", "en", en],
    ["add a repeater 2 km north of the gateway", "en", en],
    ["what's the coverage", "en", en],
    ["renombra Repetidor 1 como «Loma Alta»", "es", es],
    ["¿cómo estás, Melki?", "es", es],
    ["agrega un repetidor a 2 km al norte del gateway", "es", es],
  ];
  const tocadas = quietas.filter(([t, l, n]) => C(t, l, n) !== t).map(([t, l, n]) => `«${t}» → «${C(t, l, n)}»`);
  caso(`v17.4 · Lo que no se corrige (${quietas.length}): nombres de nodos, comillas, charla y frases bien dichas`, tocadas.length === 0, tocadas.join(" | "));
}

/* ───────────── 2. Las versiones de lo dicho (dudosas: solo si no se entendió) ───────────── */

{
  const V = (t, lengua, nombres = []) => m.variantesOidas(t, lengua, { nombres }).map((v) => v.texto.toLowerCase());
  const casos = [
    ["at a repeater 2 km north of the gateway", "en", "add a repeater 2 km north of the gateway"],
    ["mood repeater 1 1 km east", "en", "move repeater 1 1 km east"],
    ["the lead person 2", "en", "delete person 2"],
    ["except the optimization", "en", "accept the optimization"],
    ["por un repetidor a 2 km al norte del gateway", "es", "pon un repetidor a 2 km al norte del gateway"],
    ["sube lo a 9 m", "es", "subelo a 9 m"],
  ];
  const malos = casos.filter(([t, l, e]) => !V(t, l).slice(0, 12).includes(e)).map(([t, l, e]) => `«${t}»: ${JSON.stringify(V(t, l).slice(0, 5))} (esperada «${e}»)`);
  caso(`v17.4 · Versiones de lo oído (${casos.length}): «at a repeater» → «add…», «mood» → «move», «the lead» → «delete», «por un» → «pon un»…`, malos.length === 0, malos.join(" | "));
  const rapido = Date.now();
  for (let i = 0; i < 20; i++) m.variantesOidas("so at a repeat or to kilometers nor by 300 meters of the get away and simulated", "en", { nombres: ["Repeater 1", "Person 2"] });
  const ms = (Date.now() - rapido) / 20;
  caso(`v17.4 · Las versiones salen rápido (${ms.toFixed(1)} ms una frase larga y enredada)`, ms < 60, `${ms} ms`);
}

/* ───────────── 3. Qué versión usa Melki y cuándo pregunta ───────────── */

{
  const v = (texto, costo, nivel, orden, completa = true) => ({ texto, costo, cambios: [], nivel, completa, frase: texto, orden });
  const clave = (x) => (x.orden ? JSON.stringify(x.orden) : x.frase);
  const hacer = m.decidirVariante([v("add a repeater", 0.7, 2, { tipo: "pieza", coord: { lat: 1, lon: 1 } }), v("at a repeater", 1.6, 2, { tipo: "aviso" }, false)], { clave, destructiva });
  const dudas = m.decidirVariante([v("move it north", 0.7, 2, { tipo: "mover", id: "r1" }), v("remove it", 0.8, 2, { tipo: "eliminar", id: "r1" })], { clave, destructiva });
  const confirmar = m.decidirVariante([v("delete Person 2", 0.7, 2, { tipo: "eliminar", id: "p2" })], { clave, destructiva });
  const nada = m.decidirVariante([], { clave, destructiva });
  caso(
    "v17.4 · La versión clara se hace; dos casi iguales que dicen otra cosa: «¿quiso decir…?»; la que borra: «¿lo hago?»",
    hacer?.tipo === "hacer" && hacer.variante.texto === "add a repeater" && dudas?.tipo === "dudas" && dudas.opciones.length === 2 && confirmar?.tipo === "confirmar" && nada === null,
    JSON.stringify([hacer?.tipo, dudas?.tipo, confirmar?.tipo, nada]),
  );
  const P = (t) => m.esPregunta(t);
  caso("v17.4 · Qué es una pregunta: «what is…?», «¿cuántos…?», «how far…»; no «add a repeater»", P("what is LoRa") && P("¿cuántos repetidores hay?") && P("how far is it") && P("cuanto cuesta") && !P("add a repeater") && !P("the note is on the table"));

  // Lo dicho tal cual se respeta: una orden completa no se cambia; la charla que el cerebro reconoce, tampoco
  const r1 = procesar("add a repeater 2 km north of the gateway", "en");
  const r2 = procesar("at a repeater 2 km north of the gateway", "en");
  const r3 = procesar("the lead Person to", "en", true);
  const r4 = procesar("¿cómo estás, Melki?", "es", true);
  const r5 = procesar("por un repetidor a 2 km al norte del gateway", "es", true);
  caso(
    "v17.4 · Bien dicho: tal cual; «at a repeater…»: la orden de «add a repeater…»; «the lead Person to»: borrar Person 2 con «¿lo hago?»; la charla no se toca",
    r1.via === "regla" && r2.via === "oido" && r2.decision === "hacer" && r2.firmas[0] === r1.firmas[0] && r3.via === "oido" && r3.decision === "confirmar" && /"eliminar"/.test(r3.firmas[0]) && /"p2"/.test(r3.firmas[0]) && r4.via !== "oido" && r5.via === "oido" && /"repetidor"/.test(r5.firmas[0]),
    JSON.stringify([r1.via, r2, r3, r4.via, r5]).slice(0, 400),
  );
}

/* ───────────── 4. Lo dictado: muletillas, «so» por «show» y si parece para Melki ───────────── */

{
  const L = (t, l) => m.limpiarComando(t, l);
  const casos = [
    ["so the roads please", "en", "Show the roads"],
    ["so me the coverage", "en", "Show me the coverage"],
    ["so add a repeater", "en", "Add a repeater"],
    ["so roads", "en", "Show roads"],
    ["so the whole network", "en", "Show the whole network"],
    ["so far so good", "en", "Far so good"],
    ["so the coverage is fine", "en", "The coverage is fine"],
    ["um okay so what is LoRa", "en", "What is LoRa"],
    ["eh bueno pon el gateway en Cumaral pues", "es", "Pon el gateway en Cumaral"],
  ];
  const malos = casos.filter(([t, l, e]) => L(t, l) !== e).map(([t, l, e]) => `«${t}» → «${L(t, l)}» (esperado «${e}»)`);
  caso(`v17.4 · Lo dictado (${casos.length}): «so the roads» es «show the roads»; «so, …» con verbo es muletilla`, malos.length === 0, malos.join(" | "));
  const si = ["add a repeat her 2 km north of the gateway", "show me the coverage of the network", "pon un repetidor al norte", "what's the coverage of the network"];
  const no = ["I need to get away from here", "pásame el café", "the note is on the table", "te llamo más tarde", "what time is the meeting"];
  const mal = [...si.filter((t) => !m.pareceParaMelki(t)), ...no.filter((t) => m.pareceParaMelki(t))];
  caso(`v17.4 · Parece un pedido para Melki (${si.length} sí, ${no.length} no): verbo de pedido y algo del simulador`, mal.length === 0, mal.join(" | "));
  // Sin su nombre, lo oído mal solo se vuelve una orden si nombra algo del simulador (una pieza, una capa, una medida…)
  const conAncla = [["at a repeat her 2 km north", "en"], ["Recommend sport gateways", "en"], ["move it to 4.25, -73.40", "en"], ["por un repetidor al norte", "es"], ["sube lo a 9 m", "es"], ["elimina la Persona 2", "es"]];
  const sinAncla = [["I need to get away from here", "en"], ["the simulator in the arcade was fun", "en"], ["turn on the lights please", "en"], ["pásame el café", "es"], ["mueve el carro por favor", "es"]];
  const nombresA = ["Gateway", "Repetidor 1", "Persona 2"];
  const malA = [...conAncla.filter(([t, l]) => !m.anclaDelSimulador(t, l, nombresA)), ...sinAncla.filter(([t, l]) => m.anclaDelSimulador(t, l, nombresA))].map(([t]) => t);
  caso(`v17.4 · Algo del simulador en lo dicho (${conAncla.length} sí, ${sinAncla.length} no): sin eso, la charla no se vuelve orden por parecido`, malA.length === 0, malA.join(" | "));
  const plaus = [m.pareceOrdenDeMelki("fill each repeater to its limit", "en"), !m.pareceOrdenDeMelki("the simulate in the arcade was fun", "en"), m.pareceOrdenDeMelki("rename it to Loma Alta", "en")];
  caso("v17.4 · Lo cambiado por parecido sigue pareciendo una orden de Melki («fill each repeater…» sí; «the simulate in the arcade was fun» no)", plaus.every(Boolean), JSON.stringify(plaus));
}

/* ───────────── 5. «Cerca de…» y las alturas relativas (los pendientes de v17.3) ───────────── */

{
  const ordenEs = (t, ultimo = "r1") => {
    m.fijarIdioma("es");
    const api = apiReal(nodos());
    return { o: m.interpretarOrden(t, api, null, { ultimoNodo: ultimo, ultimoLugar: null }), api };
  };
  const ordenEn = (t, ultimo = "r1") => {
    m.fijarIdioma("en");
    const api = apiReal(nodosEn());
    const o = m.interpretarOrden(m.traducirPedido(t, { nombres: api.antenas().map((a) => a.nombre) }), api, null, { ultimoNodo: ultimo, ultimoLugar: null });
    m.fijarIdioma("es");
    return { o, api };
  };
  const cerca = (res, id, de) => {
    const a = res.api.antenas().find((x) => x.id === de);
    return res.o?.tipo === "mover" && res.o.id === id && res.o.coord && Math.abs(distanciaM(res.o.coord, a) - 200) < 5;
  };
  const c1 = ordenEs("pon el repetidor 1 cerca del gateway");
  const c2 = ordenEs("acerca la Persona 2 al Repetidor 2");
  const c3 = ordenEn("move Repeater 1 close to Person 2");
  const c4 = ordenEn("bring Repeater 2 closer to the gateway");
  const c5 = ordenEs("mueve el gateway cerca del Repetidor 1");
  caso(
    "v17.4 · «Cerca de…»: a 200 m del nodo nombrado, moviendo el que se nombra primero (también en inglés: close to, closer to, next to)",
    cerca(c1, "r1", "g") && cerca(c2, "p2", "r2") && cerca(c3, "r1", "p2") && cerca(c4, "r2", "g") && c5.o?.tipo === "pieza" && c5.o.mover === true && Math.abs(distanciaM(c5.o.coord, c5.api.antenas().find((x) => x.id === "r1")) - 200) < 5,
    JSON.stringify([c1.o, c2.o, c3.o, c4.o, c5.o]).slice(0, 500),
  );
  // La «a» de persona no es el destino («mueve a Persona 1 500 m al oriente» parte de la Persona 1), «muévelo al gateway» lo
  // acerca, y los lugares partidos por el dictado («Kumar al», «via nueva casa nare») se juntan
  const p1 = nodos().find((x) => x.id === "p1");
  const a1 = ordenEs("mueve a Persona 1 500 m al oriente");
  const a2 = ordenEs("muévelo al gateway");
  const l1 = ordenEn("move the gateway to Kumar al");
  const l2 = ordenEn("find me via nueva casa nare");
  caso(
    "v17.4 · «mueve a Persona 1…» parte de ella; «muévelo al gateway» lo acerca; «Kumar al» es Cumaral y «via nueva casa nare», Villanueva (Casanare)",
    a1.o?.tipo === "mover" && a1.o.id === "p1" && Math.abs(distanciaM(a1.o.coord, p1) - 500) < 5 && a2.o?.tipo === "mover" && a2.o.id === "r1" && l1.o?.coord?.lugar?.nombre === "Cumaral" && l2.o?.tipo === "ir" && l2.o.lugar?.nombre === "Villanueva" && l2.o.lugar?.detalle === "Casanare",
    JSON.stringify([a1.o, a2.o?.tipo, l1.o?.coord?.lugar?.nombre ?? l1.o, l2.o?.lugar?.nombre ?? l2.o]).slice(0, 400),
  );
  const altura = (res) => (res.o?.tipo === "editar" ? res.o.cambios?.alturaM : res.o?.tipo === "editar-varios" ? `Δ${res.o.deltaAlturaM}` : null);
  const h = [
    altura(ordenEs("súbelo 5 m más")),
    altura(ordenEs("bájale 3 metros al repetidor 2")),
    altura(ordenEs("sube el repetidor 1 a 25 m")),
    altura(ordenEs("sube el repetidor uno veinticinco metros".replace("uno veinticinco", "1 25"))),
    altura(ordenEn("raise it 5 m")),
    altura(ordenEn("make Repeater 1 3 m shorter")),
    altura(ordenEn("lower Repeater 2 to 10 m")),
    altura(ordenEs("sube todos los repetidores 5 m")),
  ];
  caso(
    "v17.4 · Alturas relativas: «súbelo 5 m más» (15 → 20), «bájale 3 m» (15 → 12); «a 25 m» sigue siendo la altura; en inglés también; a todos: +5 m a cada uno",
    JSON.stringify(h) === JSON.stringify([20, 12, 25, 25, 20, 12, 10, "Δ5"]),
    JSON.stringify(h),
  );
}

/* ───────────── 5b. Lo que no debe pasar: correcciones que cambiaban lo dicho de verdad (revisión de la v17.4) ───────────── */

{
  const nombresEn = nodosEn().map((a) => a.nombre);
  const nombresEs = nodos().map((a) => a.nombre);
  const igualEn = (t) => m.corregirOido(t, "en", nombresEn) === t;
  const igualEs = (t) => m.corregirOido(t, "es", nombresEs) === t;
  const ordenDe = (r) => (r.via === "regla" || r.via === "oido" ? JSON.parse(r.firmas[0] ?? "null") : null);
  // Los números de verdad: «to 100», «for 100 users» no son 200 ni 400; «every one» no son las personas
  const n1 = procesar("raise Repeater 1 to 100 m", "en");
  caso(
    "v17.4 · «raise Repeater 1 to 100 m» sube a 100 m; «a mesh for 100 users» y «set the budget to 100» no se tocan; «delete every one» se confirma",
    igualEn("raise Repeater 1 to 100 m") && igualEn("design a mesh for 100 users") && igualEn("set the budget to 100") && ordenDe(n1)?.cambios?.alturaM === 100 && igualEn("delete every one of the repeaters") && procesar("delete every one", "en").decision === "confirmar",
    JSON.stringify([m.corregirOido("raise Repeater 1 to 100 m", "en", nombresEn), n1, m.corregirOido("delete every one of the repeaters", "en", nombresEn)]).slice(0, 300),
  );
  // «Los repetidos» también son los duplicados: borrarlos se confirma
  const r1 = procesar("borra todos los repetidos", "es");
  caso("v17.4 · «borra todos los repetidos» no se corrige solo: se confirma antes de borrar", igualEs("borra todos los repetidos") && r1.decision === "confirmar", JSON.stringify(r1).slice(0, 200));
  // La charla con un tema del simulador no se vuelve una orden por una palabra cambiada por cómo suena
  const charlaEs = ["el celular no tiene cobertura", "mi celular no tiene señal aquí", "celular sin cobertura", "la sombra de la torre es muy grande", "sombra de la torre", "hay mucha sombra en el repetidor", "el celular está sin señal"];
  const charlaEn = ["similar to the old one", "so the coverage is bad here", "the reporter said the coverage is bad", "it's a great way to test the coverage", "move it 2 km is that ok", "move repeater 1 2 km not more"];
  const ordenes = [...charlaEs.map((t) => [t, procesar(t, "es", true)]), ...charlaEn.map((t) => [t, procesar(t, "en", true)])].filter(([, r]) => r.via === "oido");
  caso("v17.4 · La charla con un tema del simulador («el celular no tiene cobertura», «sombra de la torre», «similar to the old one») no se vuelve una orden", ordenes.length === 0, ordenes.map(([t, r]) => `«${t}» → ${r.firmas[0]}`).join(" | ").slice(0, 400));
  // …pero una orden con el verbo mal oído sí («feel each repeater…», «subo todos los repetidores…», «I'd the rivers…»)
  const v1 = ordenDe(procesar("feel each repeater to its limit", "en", true));
  const v2 = ordenDe(procesar("subo todos los repetidores a 20 m", "es", true));
  const v3 = ordenDe(procesar("I'd the rivers and the names", "en", true));
  caso(
    "v17.4 · Con el verbo mal oído sí es una orden: «feel each repeater to its limit», «subo todos los repetidores a 20 m», «I'd the rivers and the names»",
    v1?.tipo === "limite" && v1.llenar === true && v2?.tipo === "editar-varios" && v2.cambios?.alturaM === 20 && v3?.tipo === "vista" && v3.cambios?.refRios === false,
    JSON.stringify([v1, v2, v3]).slice(0, 300),
  );
  caso(
    "v17.4 · Empieza como una orden: «fill…», «sube…», «puedo quitar…»; no «el celular…», «the shadow…», «can the signal reach…?»",
    m.empiezaComoOrden("fill each repeater to its limit") && m.empiezaComoOrden("sube todos los repetidores") && m.empiezaComoOrden("puedo quitar algunos repetidores") && !m.empiezaComoOrden("el celular no tiene cobertura") && !m.empiezaComoOrden("the shadow of the tower") && !m.empiezaComoOrden("can the signal reach the river?"),
  );
  // Las palabras del simulador no se meten en la charla
  caso(
    "v17.4 · «reporter», «a great way», «a getaway», «the rows» solo se corrigen en una orden («add a reporter…», «show the rows»)",
    igualEn("the reporter said the coverage is bad") && igualEn("it's a great way to test") && igualEn("a getaway to the coast") && igualEn("the rows of the table") && m.corregirOido("add a reporter 2 km north of the gateway", "en", nombresEn) === "add a repeater 2 km north of the gateway" && m.corregirOido("show the rows", "en", nombresEn) === "show the roads",
    JSON.stringify([m.corregirOido("add a reporter 2 km north of the gateway", "en", nombresEn), m.corregirOido("show the rows", "en", nombresEn)]),
  );
  // «simulate on change» sin repetir la palabra; las torres de verdad; la preposición «to»; los rumbos que son palabras
  caso(
    "v17.4 · «simulate and change» → «simulate on change»; «raise the towers 2.5 m» y «sube todas las torres 5 metros» no se tocan; «towers 4.5, -73.2» es «towards»",
    m.corregirOido("simulate and change", "en") === "simulate on change" && m.corregirOido("simulate in chance", "en") === "simulate on change" && igualEn("raise the towers 2.5 m") && igualEs("sube todas las torres 5 metros") && /towards 4\.5, -73\.2/.test(m.corregirOido("point it towers 4.5, -73.2", "en")),
    JSON.stringify([m.corregirOido("simulate and change", "en"), m.corregirOido("point it towers 4.5, -73.2", "en")]),
  );
  const mp = ordenDe(procesar("move person to Cumaral", "en"));
  caso(
    "v17.4 · «move person to Cumaral» lleva a la persona a Cumaral (no es «Person 2 Cumaral»); «move Person to 1 km north» sí es Person 2",
    igualEn("move person to Cumaral") && mp?.tipo === "mover" && mp.coord?.lugar?.nombre === "Cumaral" && m.corregirOido("move Person to 1 km north", "en", nombresEn) === "move Person 2 1 km north",
    JSON.stringify([mp, m.corregirOido("move Person to 1 km north", "en", nombresEn)]).slice(0, 300),
  );
  caso(
    "v17.4 · Después de una distancia, «is», «not», «nor» son rumbo solo antes de «of»/«from» o al final; «nort» siempre",
    igualEn("move it 2 km is that ok") && igualEn("move Repeater 1 2 km not more") && m.corregirOido("move it 2 km is of the gateway", "en", nombresEn) === "move it 2 km east of the gateway" && m.corregirOido("move Repeater 1 2 km nort", "en", nombresEn) === "move Repeater 1 2 km north" && m.variantesOidas("move Repeater 1 2 km nor", "en", { nombres: nombresEn }).some((v) => v.texto === "move Repeater 1 2 km north"),
  );
  // «Mueve toda la red 2 km al norte» no es un diseño; «arma una red 3 km…» sí es «una red de 3 km»
  caso(
    "v17.4 · «red N km» es «red de N km» solo al pedir un diseño («ármame una red 4 km…»), no en «mueve toda la red 2 km al norte»",
    igualEs("mueve toda la red 2 km al norte") && m.corregirOido("ármame una red 4 km en Villavicencio", "es") === "ármame una red de 4 km en Villavicencio" && procesar("mueve toda la red 2 km al norte", "es").via !== "oido",
    m.corregirOido("ármame una red 4 km en Villavicencio", "es"),
  );
  // Deshacer o borrar lo medido por una palabra mal oída se confirma
  const u = procesar("under", "en");
  const dm = m.decidirVariante([{ texto: "delete the measurements", costo: 0.7, cambios: [], nivel: 2, completa: true, frase: "borra las mediciones", orden: { tipo: "borrar-mediciones" } }], { clave: (x) => x.frase, destructiva });
  caso("v17.4 · «under» → «undo» y «borrar las mediciones» salidos de lo mal oído se confirman antes («¿lo hago?»)", u.decision === "confirmar" && dm?.tipo === "confirmar", JSON.stringify([u, dm?.tipo]).slice(0, 200));
  // «Acerca de» es «sobre»: no mueve nada
  m.fijarIdioma("es");
  const ad = m.interpretarOrden("cuéntame acerca del gateway", apiReal(nodos()), null, contexto);
  caso("v17.4 · «cuéntame acerca del gateway» no mueve nada (es «sobre el gateway»)", !ad || !["mover", "pieza"].includes(ad.tipo), JSON.stringify(ad).slice(0, 200));
  // El repetidor de siempre (no el nodo del destino) y la altura con un número de varias cifras
  const mr = ordenDe(procesar("mueve el repetidor al gateway", "es"));
  const me = ordenDe(procesar("move the repeater to the gateway", "en"));
  caso(
    "v17.4 · «mueve el repetidor al gateway» mueve el repetidor (no el gateway); «sube lo 15 metros» es «súbelo 15 metros»",
    mr?.tipo === "mover" && mr.id === "r1" && me?.tipo === "mover" && me.id === "r1" && m.variantesOidas("sube lo 15 metros", "es").some((v) => /^subelo 15 metros$/i.test(v.texto)) && igualEs("muestra los modos"),
    JSON.stringify([mr, me]).slice(0, 300),
  );
  // Lo que el dictado separa del comienzo de un verbo se junta («en vía» → «envía», «a paga» → «apaga»); dos palabras que
  // Melki conoce, no («hasta la» no es «ajústala», «mueve el» no es «muévelo»)
  const textos = (t, l = "es") => m.variantesOidas(t, l).map((v) => v.texto.toLowerCase());
  caso(
    "v17.4 · «en vía 25 pagos…» → «envía…» y «a paga el lápiz» → «apaga…»; «hasta la vista» y «mueve el carro» no se juntan",
    textos("en vía 25 pagos al tiempo").includes("envía 25 pagos al tiempo") && textos("a paga el lápiz").includes("apaga el lápiz") && !textos("hasta la vista").some((t) => /ajústala|ajustala/.test(t)) && !textos("mueve el carro").some((t) => /muévelo|muevelo/.test(t)),
    JSON.stringify([textos("en vía 25 pagos al tiempo").slice(0, 3), textos("hasta la vista").slice(0, 3)]),
  );
  // El presupuesto es la cifra que va con la palabra de la plata
  const pr = m.presupuestoEnTexto("arma una red para 2000000 personas con un presupuesto de 90000000");
  const pr2 = m.presupuestoEnTexto("con un presupuesto de 120000000 arma una red");
  caso("v17.4 · El presupuesto es la cifra junto a «presupuesto» (no los 2000000 de personas)", pr?.cop === 90000000 && pr2?.cop === 120000000, JSON.stringify([pr, pr2]));
  // Con miles de personas pobladas, lo oído sigue siendo rápido; un texto largo pegado no se corrige
  const muchos = [...nombresEn, ...Array.from({ length: 3000 }, (_, i) => `Person ${i + 3}`)];
  const t0 = performance.now();
  for (const f of ["at a repeat her 2 km nort of the gateway", "the lead person to", "please moved repeater 1 2 km nor"]) {
    m.corregirOido(f, "en", muchos);
    m.anclaDelSimulador(f, "en", muchos);
    for (const v of m.variantesOidas(f, "en", { nombres: muchos, max: 40 })) m.pareceOrdenDeMelki(v.texto, "en", muchos);
  }
  const ms = performance.now() - t0;
  const largo = `turn ${"Repeater 1 and ".repeat(60)}the gateway of`;
  caso(`v17.4 · Con 3000 nodos en el mapa, lo oído tarda poco (${ms.toFixed(0)} ms para tres frases); un texto largo pegado no se corrige`, ms < 1500 && m.corregirOido(largo, "en", muchos) === largo, `${ms.toFixed(0)} ms`);
}

/* ───────────── 5c. v17.5 · Los nombres del mapa por cómo suenan, las preguntas, los nombres dictados y la charla ───────────── */

{
  /** ¿Lo oído da lo mismo que la frase bien dicha? (como en los corpus) */
  const igualA = (oido, canonica, lengua) => {
    const c = procesar(canonica, lengua);
    const o = procesar(oido, lengua, true);
    return c.firmas.length > 0 && (o.decision === "dudas" ? o.firmas.some((f) => c.firmas.includes(f)) : o.firmas[0] === c.firmas[0]);
  };
  const distintos = (lista, lengua) => lista.filter(([o, c]) => !igualA(o, c, lengua)).map(([o]) => `«${o}» → ${(procesar(o, lengua, true).firmas[0] ?? "nada").slice(0, 90)}`);
  const C = (t, l) => m.corregirOido(t, l, (l === "en" ? nodosEn() : nodos()).map((a) => a.nombre));

  // Los nombres del mapa dichos de otro modo
  const nombres = distintos(
    [
      ["Delete Tory to", "delete Torre 2"],
      ["point a hemp low northeast", "point Ejemplo northeast"],
      ["how many people can repeat or 2 handle", "how many people can Repeater 2 handle?"],
      ["radio link reports between a hemplo and tore two", "radio link report between Ejemplo and Torre 2"],
      ["show me the links between repeat a 1 and repeater 2", "Show me the link between Repeater 1 and Repeater 2"],
    ],
    "en",
  );
  const borra = procesar("Delete Tory to", "en", true);
  caso("v17.5 · Los nombres del mapa por cómo suenan: «Tory to» → Torre 2 (con «¿lo hago?», porque borra), «a hemp low» → Ejemplo, «repeat or 2» → Repeater 2", nombres.length === 0 && borra.decision === "confirmar", [...nombres, borra.decision].join(" | "));
  // …pero una pieza nueva a una distancia no es el nodo con ese número («a person 1.5 km…» no es «Person 1»)
  const nuevas = [
    ["add a repeater 2 km north of the gateway", "en"],
    ["add a person 1.5 km north of the gateway", "en"],
    ["agrega un repetidor a 2 km al norte del gateway", "es"],
  ].filter(([t, l]) => C(t, l) !== t || !procesar(t, l).firmas[0]?.startsWith('{"tipo":"pieza"'));
  caso("v17.5 · Una pieza nueva a una distancia sigue siendo nueva («add a person 1.5 km north…», «a repeater 2 km…»); «1.5 km south guest» → «southwest»", nuevas.length === 0 && C("add a person 1.5 km south guest of repeater 2", "en") === "add a person 1.5 km southwest of repeater 2", nuevas.map(([t, l]) => `«${t}» → «${C(t, l)}»`).join(" | "));

  // Las preguntas mal oídas que solo consultan se corrigen; las de charla no se vuelven una orden
  const preguntas = distintos(
    [
      ["what's the distant from the get away to repeater 1", "what's the distance from the gateway to Repeater 1?"],
      ["how much con it handle", "how much can it handle?"],
      ["how many people can repeater one Handel", "how many people can Repeater 1 handle?"],
      ["How match does the network cost", "how much does the network cost"],
      ["hey Melki what's mesh core", "hey Melki, what's MeshCore?"],
    ],
    "en",
  );
  const charlaPreguntas = [
    ["how much does your phone cost?", "en"],
    ["what's the distance to the beach?", "en"],
    ["how far is the bakery from here", "en"],
    ["¿cuánto cuesta el celular nuevo?", "es"],
    ["¿qué distancia hay hasta la finca de mi tío?", "es"],
  ].filter(([t, l]) => ["oido", "regla"].includes(procesar(t, l, true).via));
  caso("v17.5 · Las preguntas mal oídas que solo consultan se corrigen por cómo suenan («the distant from…», «how much con it handle»); las de charla no se vuelven una orden", preguntas.length === 0 && charlaPreguntas.length === 0, [...preguntas, ...charlaPreguntas.map(([t]) => t)].join(" | "));

  // Lo que ya viene traducido del inglés no se vuelve a corregir con el español: «I need to get away from here» se
  // traduce «get away de aquí», que no es «gateway» (la charla con la barra abierta pasaba como una pregunta del gateway)
  const ctxEs = ctxCerebro(nodos(), "es");
  const traducidos = [
    ["I need to get away from here", procesar("I need to get away from here", "en", true).firmas.length === 0],
    ["get away de aquí (traducido)", m.responder("get away de aquí", { ...ctxEs, traducido: true }).noEntendido === true],
    ["what's mesh core", (procesar("hey Melki what's mesh core", "en", true).firmas[0] ?? "").startsWith("tema:")],
  ].filter(([, ok]) => !ok);
  caso("v17.5 · Lo traducido del inglés no se vuelve a corregir con el español («I need to get away from here» no es el gateway); lo dicho en inglés sí («what's mesh core»)", traducidos.length === 0, traducidos.map(([t]) => t).join(" | "));

  // Los nombres dictados, con mayúsculas (por escrito, como se escriban)
  const dictados = [
    [m.nombreDictado("loma alta"), "Loma Alta"],
    [m.nombreDictado("cerro de la cruz"), "Cerro de la Cruz"],
    [m.nombreDictado("finca la esperanza"), "Finca La Esperanza"],
    [m.nombreDictado("Finca la Speranza"), "Finca La Speranza"],
    [m.nombreDictado("piloto Granada"), "Piloto Granada"],
    [m.nombreDictado("north tower"), "North Tower"],
    [procesar("renombra repetidor dos como loma alta", "es", true).firmas[0], '{"tipo":"renombrar","id":"r2","nombre":"Loma Alta"}'],
    [procesar("renombra el Repetidor 2 como loma alta", "es").firmas[0], '{"tipo":"renombrar","id":"r2","nombre":"loma alta"}'],
  ].filter(([a, b]) => a !== b);
  caso("v17.5 · Los nombres dictados van con mayúsculas («loma alta» → «Loma Alta», «Cerro de la Cruz»); por escrito, como se escriban", dictados.length === 0, dictados.map(([a, b]) => `${a} (esperado ${b})`).join(" | "));
  caso("v17.5 · El presupuesto dictado en cifras se muestra como se dice («120000000» → «120 millones»)", m.presupuestoEnTexto("con un presupuesto de 120000000")?.dicho === "120 millones" && m.presupuestoEnTexto("con un presupuesto de 80 millones")?.dicho === "80 millones", m.presupuestoEnTexto("con un presupuesto de 120000000")?.dicho);

  // La charla con alguien más pasa (con el asistente sin su nombre); las órdenes no
  const charla = [
    "let's go to Cumaral this weekend",
    "my doctor wants me to do a stress test next week",
    "show me the pictures from the trip",
    "why doesn't my phone have signal in the kitchen",
    "este fin de semana vamos a Cumaral a comer mamona",
    "préstame la regla y un lápiz",
    "le cambiaron el nombre a la calle del colegio",
    "tengo que hacer dos pagos en el banco antes del viernes",
    "ponlo en la mesa",
    "put it on the table",
    "can you pass me the ruler and a pencil",
    "los paneles solares están dando más energía este mes",
    "súbele el volumen a la radio",
    "the repeater on the hill for the radio station is down again",
    "el médico le mandó una prueba de estrés al abuelo",
    "están construyendo la torre nueva del parque principal",
    "my mom wants me to rename the dog",
  ].filter((t) => !m.pareceCharla(t));
  const ordenesNoCharla = [
    "add a repeater 2 km north of the gateway",
    "run the stress test",
    "take me to Cumaral",
    "send 15 payments at once",
    "pon una persona en Cumaral",
    "conecta a las personas que quedaron sin señal",
    "haz la prueba de estrés",
    "activa la regla",
    "simula",
    "simula la hora pico de la mañana",
    // (lo que también es del simulador: el radio, el lápiz y la regla, la tabla, los sitios, los nombres nuevos y lo que
    // pasa en la red)
    "cubre en un radio de 3000 pies alrededor del gateway",
    "ármame una red en un radio de 5 km",
    "¿cuál es el radio de cobertura del gateway?",
    "show the radio link report for the gateway and Repeater 1",
    "change the radio preset to long fast",
    "dame un lápiz",
    "give me a pencil",
    "use a ruler",
    "activa una regla",
    "export the table to CSV",
    "pon un repetidor en la plaza",
    "pon una persona en el parque principal",
    "renombra el Repetidor 2 como La Mesa",
    "re nombra el repetidor 2 como La Mesa",
    "rename Repeater 1 to The Office",
    "name it My House",
    "cambia el nombre del Repetidor 1 a La Sala",
    "¿a cuántas personas les llegaron los pagos?",
    "¿ya llegaron todos los mensajes?",
    "¿a la Persona 2 le llegó el mensaje?",
    "¿qué le pasó al Repetidor 1?",
    "¿qué nodos están fallando?",
    "¿cuántas personas están usando la red?",
    "prueba la hora pico en la mañana",
  ].filter((t) => m.pareceCharla(t));
  caso("v17.5 · La charla con alguien más (planes, la familia, el celular, un paseo) pasa sin hacerse; las órdenes no parecen charla (tampoco con «radio», el lápiz, la tabla, un sitio o un nombre nuevo)", charla.length === 0 && ordenesNoCharla.length === 0, [...charla, ...ordenesNoCharla].join(" | "));

  // Lo que el intérprete no entendía: soltar la regla, apuntar hacia un nodo, sembrar desde el gateway
  const O = (t, l) => procesar(t, l).firmas[0] ?? "nada";
  const interprete = [
    [O("desactiva la regla", "es"), '{"tipo":"herramienta","herramienta":"mover"}'],
    [O("suelta la regla", "es"), '{"tipo":"herramienta","herramienta":"mover"}'],
    [O("turn off the ruler", "en"), '{"tipo":"herramienta","herramienta":"mover"}'],
    [O("activa la regla", "es"), '{"tipo":"herramienta","herramienta":"regla"}'],
    [O("siembra una malla alrededor del gateway", "es"), '{"tipo":"sembrar","destino":"faltantes"}'],
  ].filter(([a, b]) => a !== b);
  const apunta = O("point Ejemplo toward the gateway", "en");
  caso("v17.5 · «Desactiva la regla» y «turn off the ruler» la sueltan (antes la activaban); «point Ejemplo toward the gateway» apunta; «siembra una malla alrededor del gateway» siembra", interprete.length === 0 && apunta.startsWith('{"tipo":"apuntar-omni","id":"e"'), [...interprete.map(([a, b]) => `${a} (esperado ${b})`), apunta].join(" | "));

  // Lo que se oía mal y ahora se entiende (de los lotes ciegos 3 y 4)
  const es = distintos(
    [
      ["pongo una persona en Restrepo", "ponga una persona en Restrepo"],
      ["mueve el gateway 500 metros occidente", "mueve el gateway 500 metros al occidente"],
      ["cuánta persona aguanta el repetidor 2", "¿cuántas personas aguanta el Repetidor 2?"],
      ["manda diez pagos a mismo tiempo", "manda 10 pagos al mismo tiempo"],
      ["des activa la regla", "desactiva la regla"],
      ["actívala regla", "activa la regla"],
      ["debo pone más torre", "¿debo poner más torres?"],
      ["mueve la persona 1 a 4,22 menos 73,4", "mueve la Persona 1 a 4.22, -73.40"],
      ["pon le una yagui a ejemplo apuntando a torre 2", "ponle una Yagi a Ejemplo apuntando a Torre 2"],
      ["y cuánto cuesta cubrir todo país", "¿cuánto cuesta cubrir todo el país?"],
    ],
    "es",
  );
  const en = distintos(
    [
      ["fill the gateway two its limit", "fill the gateway to its limit"],
      ["send 15 what's up messages at once", "send 15 WhatsApp messages at once"],
      ["at a yogi antenna at 4.5 - 73.1 pointing north", "add a yagi antenna at 4.5, -73.1 pointing north"],
      ["add a person 1.5 km south guest of repeater 2", "add a person 1.5 km southwest of Repeater 2"],
      ["what does as F mean", "what does SF mean?"],
      ["take me to Joe Paul", "take me to Yopal"],
      ["at an antenna node at 4.5 1 2 3 minus 73.1 2 3 4", "add an antenna node at 4.5123, -73.1234"],
      ["is which to advanced mode", "switch to advanced mode"],
    ],
    "en",
  );
  caso("v17.5 · Lo que todavía se oía mal ahora se entiende («pongo una persona…», «cuánta persona aguanta…», «two its limit», «what's up messages», «Joe Paul», «4.5 1 2 3»…)", es.length === 0 && en.length === 0, [...es, ...en].join(" | "));
}

/* ───────────── 6. Los corpus: dicho con mala pronunciación, como lo escribe el reconocimiento de voz ───────────── */

{
  const corpus = JSON.parse(readFileSync(path.join(aqui, "frases-pronunciacion.json"), "utf8"));
  const t0 = Date.now();
  for (const [lengua, minimo] of [
    ["en", corpus.minimo.en],
    ["es", corpus.minimo.es],
  ]) {
    const pares = corpus[lengua];
    let bien = 0;
    let contadas = 0;
    const malos = [];
    for (const [oido, canonica] of pares) {
      const c = procesar(canonica, lengua);
      if (!c.firmas.length) continue;
      contadas++;
      const o = procesar(oido, lengua, true);
      const igual = o.decision === "dudas" || c.firmas[0].startsWith('{"tipo":"elegir"') ? o.firmas.some((f) => c.firmas.includes(f)) : o.firmas[0] === c.firmas[0] || (o.firmas[0]?.startsWith('{"tipo":"elegir"') && o.firmas.slice(1).includes(c.firmas[0]));
      if (igual) bien++;
      else malos.push(`«${oido}» → ${(o.firmas[0] ?? "nada").slice(0, 70)} (quería «${canonica}»)`);
    }
    const pct = (100 * bien) / contadas;
    caso(`v17.5 · Lo dicho con mala pronunciación en ${lengua === "en" ? "inglés" : "español"}: ${bien} de ${contadas} (${pct.toFixed(1)} %) dan la orden o el tema de la frase bien dicha (mínimo ${minimo} %)`, pct >= minimo, malos.slice(0, 5).join(" | "));
  }
  for (const lengua of ["en", "es"]) {
    const frases = corpus.charla[lengua];
    // (v17.5 · como el asistente sin su nombre: la charla con alguien más pasa aunque traiga algo que se entienda)
    const vueltas = frases.filter((t) => !m.pareceCharla(t)).map((t) => ({ t, r: procesar(t, lengua, true) })).filter(({ r }) => r.via === "oido" || r.via === "regla");
    const parecen = frases.filter((t) => m.pareceParaMelki(t) && !m.pareceCharla(t));
    caso(`v17.5 · La charla cercana en ${lengua === "en" ? "inglés" : "español"} (${frases.length}) no se vuelve una orden ni parece un pedido`, vueltas.length === 0 && parecen.length === 0, [...vueltas.map(({ t, r }) => `«${t}» → ${r.firmas[0]}`), ...parecen].slice(0, 5).join(" | "));
  }
  // v17.5 · Con el asistente sin su nombre, la charla pasa sin hacerse: ninguna orden de los corpus (dicha bien o mal, ni
  // las del inglés natural) puede parecer charla, o se perdería sin aviso
  const ordenesCorpus = [...new Set([...corpus.en.flat(), ...corpus.es.flat(), ...JSON.parse(readFileSync(path.join(aqui, "frases-ingles.json"), "utf8")).flat()])];
  const pierden = ordenesCorpus.filter((t) => m.pareceCharla(t));
  caso(`v17.5 · Ninguna orden de los corpus (${ordenesCorpus.length} frases, dichas bien y mal) parece charla`, pierden.length === 0, pierden.slice(0, 5).join(" | "));
  console.log(`  (corpus en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

/* ───────────── v17.6 · El zoom, la leyenda y el relieve como los escribe el reconocimiento ───────────── */
{
  const casos = [
    ["su min", "en", "zoom in"], ["some in a little", "en", "zoom in a little"], ["soon out one lever", "en", "zoom out one lever"], ["get close her", "en", "get closer"],
    ["show the lechen", "en", "show the legend"], ["close the the gen", "en", "close the legend"], ["show the tea rain really", "en", "show the terrain relief"],
    ["turn off the tree de", "en", "turn off the 3D"], ["sad a light", "en", "satellite"], ["switch to open top o map", "en", "switch to OpenTopoMap"],
    ["quita la llenda", "es", "quita la leyenda"], ["ale jalo un poquito", "es", "alejalo un poquito"], ["pon el mapa en tres de", "es", "pon el mapa en 3D"],
    ["des pliega la leyenda", "es", "despliega la leyenda"], ["muestrame los serros", "es", "muestrame los cerros"], ["en cuadra toda la red", "es", "encuadra toda la red"],
  ];
  const mal = casos.filter(([t, l, esperado]) => m.corregirOido(t, l, []).toLowerCase() !== esperado.toLowerCase());
  // Lo que se parece pero es charla no se toca
  const quietas = [["the rain is coming", "en"], ["i like three d movies", "en"], ["close her eyes", "en"], ["acércate que no te oigo", "es"], ["la leyenda del silbón", "es"], ["tres de la tarde", "es"]];
  const tocadas = quietas.filter(([t, l]) => m.corregirOido(t, l, []) !== t);
  caso(
    "v17.6 · Lo mal oído del mapa se corrige («su min» → zoom in, «the lechen» → legend, «tea rain really» → terrain relief, «la llenda», «ale jalo», «en tres de» → 3D); la charla parecida no se toca",
    mal.length === 0 && tocadas.length === 0,
    [...mal.map(([t, l]) => `«${t}» → «${m.corregirOido(t, l, [])}»`), ...tocadas.map(([t, l]) => `«${t}» → «${m.corregirOido(t, l, [])}»`)].join(" | "),
  );
}

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodas las pruebas de lo oído pasaron");
process.exit(fallos ? 1 : 0);
