// Pruebas de extremo a extremo del simulador. Uso: node tests/e2e/simulador.mjs <carpeta-de-capturas>
// Navegador: Microsoft Edge instalado (Windows) o el ejecutable indicado en CHROME_PATH.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

import { desviarTeselas } from "./teselas-prueba.mjs";

const [, , salida = "dist/e2e"] = process.argv;
fs.mkdirSync(salida, { recursive: true });
const base = process.env.BASE ?? "http://localhost:3000/";
const navegador = await chromium.launch(
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-background-networking"] }
    : { channel: "msedge" },
);
const resultados = [];
const afirmar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};

async function flujo(nombre, fn, { tamano = { width: 1440, height: 900 }, conMelki = false, preparar } = {}) {
  // SOLO=flujo1,flujo2 corre solo esos flujos
  if (process.env.SOLO && !process.env.SOLO.split(",").includes(nombre)) return;
  const context = await navegador.newContext({ viewport: tamano, locale: "es-CO", acceptDownloads: true });
  await desviarTeselas(context);
  const page = await context.newPage();
  const avisos = [];
  page.on("console", (m) => {
    // Teselas que no cargan (sin internet o al recargar la página) no son fallos de la aplicación
    if (m.type() === "error" && !/GL Driver|WebGL|Failed to load resource|AJAXError/.test(m.text())) avisos.push(m.text());
  });
  page.on("pageerror", (e) => avisos.push(`pageerror: ${e.message}`));
  // Estado limpio; sin la bienvenida de Melki salvo en su propia prueba
  await page.addInitScript((melki) => {
    // Solo en la primera carga de la pestaña (window.name sobrevive a las recargas también en file://)
    if (sessionStorage.getItem("e2e") || window.name === "e2e") return;
    sessionStorage.setItem("e2e", "1");
    window.name = "e2e";
    localStorage.clear();
    if (!melki) localStorage.setItem("simulador-cobertura-melki-v1", JSON.stringify({ visto: true, voz: false }));
  }, conMelki);
  let ok = true;
  let error = "";
  try {
    if (preparar) await preparar(page);
    await page.goto(base);
    await fn(page, (etiqueta) => page.screenshot({ path: path.join(salida, `${nombre}_${etiqueta}.png`) }));
  } catch (e) {
    ok = false;
    error = e.message.split("\n")[0];
    await page.screenshot({ path: path.join(salida, `${nombre}_FALLO.png`) }).catch(() => {});
  }
  resultados.push({ nombre, ok, error, avisos });
  await context.close();
}

const esperarSimulacion = async (page) => {
  await page.waitForFunction(() => !document.querySelector("[role=progressbar]"), null, { timeout: 90000 });
  await page.getByRole("heading", { name: /^(Factible|Factible con ajustes|No factible todavía)$/ }).first().waitFor({ timeout: 90000 });
};

const mapaCentro = async (page) => {
  const b = await page.locator("[data-tour=mapa]").boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
};
const nodosEnLista = (page) => page.locator("[data-tour=lista-antenas] > li").count();

await flujo("inicio", async (page, foto) => {
  await esperarSimulacion(page);
  afirmar((await nodosEnLista(page)) === 1, "La demostración debería tener un solo nodo");
  await page.locator("[data-tour=lista-antenas]").getByText("Ejemplo").waitFor();
  await page.getByText("Nivel de señal").first().waitFor();
  await page.getByText("Alcance con servicio (≥ 20 dB)").waitFor();
  await page.getByText("Nodos antena · rango de alcance").waitFor();
  afirmar(await page.getByRole("tab", { name: "Nodos (1)" }).isVisible(), "Falta la pestaña Nodos");
  await page.getByRole("button", { name: "Cómo se calculó" }).click();
  await page.getByText("Potencia radiada (PIRE)").waitFor();
  await page.getByText("Alcance sin obstáculos (modelo)").waitFor();
  await foto("resultado");
});

await flujo("coordenadas", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("button", { name: "Por coordenadas" }).click();
  const formulario = page.locator("[data-tour=formulario-coordenadas]");
  await formulario.getByPlaceholder("4.5123").fill(`4°15'00" N`);
  await formulario.getByPlaceholder("-73.1234").fill(`73°20'00" O`);
  await formulario.getByPlaceholder("Torre norte").fill("Antena de prueba");
  await formulario.getByRole("button", { name: "Agregar nodo antena" }).click();
  await page.locator("[data-tour=lista-antenas]").getByText("Antena de prueba").waitFor();
  afirmar((await nodosEnLista(page)) === 2, "No se agregó el nodo antena");
  await page.waitForTimeout(900);
  await esperarSimulacion(page);
  await page.getByLabel("Resultados").getByText("Antena de prueba").first().waitFor({ timeout: 90000 });
  // Perfil del enlace entre los dos nodos antena
  await page.getByRole("button", { name: /Ver perfil del enlace/ }).first().click();
  await page.getByRole("dialog", { name: /Perfil/ }).getByText(/dB$/).first().waitFor({ timeout: 30000 });
  await foto("agregada");
});

await flujo("nodo-de-campo", async (page, foto) => {
  await esperarSimulacion(page);
  await page.locator("[data-tour=agregar]").getByRole("radio", { name: "Nodo", exact: true }).click();
  await page.getByRole("button", { name: "Por coordenadas" }).click();
  const formulario = page.locator("[data-tour=formulario-coordenadas]");
  await formulario.getByPlaceholder("4.5123").fill("4.215");
  await formulario.getByPlaceholder("-73.1234").fill("-73.355");
  await formulario.getByRole("button", { name: "Agregar nodo" }).click();
  await page.locator("[data-tour=lista-antenas]").getByText("Nodo 1").waitFor();
  await page.waitForTimeout(900);
  await esperarSimulacion(page);
  await page.getByLabel("Resultados").getByText("Nodos de campo").waitFor({ timeout: 90000 });
  await page.getByLabel("Resultados").getByText(/Mejor enlace: Ejemplo/).waitFor();
  await foto("nodo");
});

await flujo("medir-senal", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("radio", { name: /Medir señal/ }).click();
  const c = await mapaCentro(page);
  await page.mouse.click(c.x + 60, c.y + 80);
  await page.getByRole("dialog", { name: "Señal en el punto" }).getByText("Perfil").first().waitFor({ timeout: 30000 });
  await foto("punto");
});

await flujo("melki-ordenes", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("button", { name: /Abrir a Melki/ }).click();
  const pregunta = page.getByLabel("Pregunta para Melki");
  const chat = page.getByRole("region", { name: "Conversación con Melki" });
  // La frase del usuario, tal cual
  await pregunta.fill("Hola Melki ayudame a inscribir una antena en esta cordenada para realizar la simulacion de su alcance porfavor");
  await page.keyboard.press("Enter");
  await chat.getByText(/Escríbame la coordenada del nodo antena/).waitFor();
  await pregunta.fill(`4°13'30" N 73°21'00" O`);
  await page.keyboard.press("Enter");
  await chat.getByText(/Listo: inscribí el nodo antena «Antena 2»/).waitFor();
  await chat.getByText(/Simulación lista para «Antena 2»/).waitFor({ timeout: 90000 });
  afirmar((await nodosEnLista(page)) === 2, "Melki no inscribió el nodo");
  await pregunta.fill("distancia entre Ejemplo y Antena 2");
  await page.keyboard.press("Enter");
  await chat.getByText(/De Ejemplo a Antena 2 hay .* en línea recta/).waitFor();
  await pregunta.fill("sube Antena 2 a 18 m");
  await page.keyboard.press("Enter");
  await chat.getByText(/«Antena 2», altura 18 m/).waitFor();
  await foto("conversacion");
  await pregunta.fill("deshaz");
  await page.keyboard.press("Enter");
  await chat.getByText("Listo, deshice ese cambio.").waitFor();
  await pregunta.fill("¿Qué es un nodo antena?");
  await page.keyboard.press("Enter");
  await chat.getByText(/el nodo antena es infraestructura fija/).waitFor();
  // Funciones de Radio Mobile por chat
  await pregunta.fill("muestra la señal en microvoltios");
  await page.keyboard.press("Enter");
  await chat.getByText(/el mapa de señal se ve en microvoltios/).waitFor();
  await page.locator("[data-tour=leyenda]").getByText("Tensión en la entrada del receptor (50 Ω)").waitFor();
  await pregunta.fill("simula con una confiabilidad del 90 %");
  await page.keyboard.press("Enter");
  await chat.getByText(/Cambié la confiabilidad al 90 %/).waitFor();
  await pregunta.fill("informe del enlace Ejemplo y Antena 2");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: /Perfil/ }).getByText("Potencias y antenas").waitFor({ timeout: 30000 });
  await foto("informe");
});

// Reconocimiento de voz de mentira (el navegador de pruebas no tiene micrófono ni servicio de voz)
const vozDeMentira = () => {
  class Falso {
    constructor() {
      this.lang = "";
      this.processLocally = false;
    }
    start() {
      window.__dictado = { lang: this.lang, local: Boolean(this.processLocally), veces: (window.__dictado?.veces ?? 0) + 1 };
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "inscribe un nodo antena" } }] }), 250);
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "inscribe un nodo antena en 4 punto 25 menos 73 punto 30" } }] }), 800);
    }
    stop() {
      setTimeout(() => this.onend?.(), 50);
    }
    abort() {
      this.onend?.();
    }
  }
  Falso.available = async ({ langs, processLocally }) => (!processLocally || langs[0] === "es-ES" ? "available" : "unavailable");
  Falso.install = async () => true;
  window.SpeechRecognition = Falso;
  window.webkitSpeechRecognition = Falso;
};

await flujo(
  "melki-dictado",
  async (page, foto) => {
    await esperarSimulacion(page);
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    const caja = page.getByLabel("Pregunta para Melki");
    const mensajesUsuario = () => chat.locator(".bg-carbon.text-white.rounded-br-md").count();
    const antes = await mensajesUsuario();
    await chat.getByRole("button", { name: "Dictar por voz" }).click();
    const elegir = chat.getByRole("dialog", { name: "¿Cómo quiere dictar?" });
    await elegir.getByRole("button", { name: /Con el navegador/ }).click();
    await chat.getByText(/Escuchando… Revise el texto/).waitFor();
    await page.waitForFunction(() => document.querySelector("[aria-label='Pregunta para Melki']")?.value === "Inscribe un nodo antena en 4.25 -73.30", null, { timeout: 10000 });
    await foto("dictando");
    afirmar((await mensajesUsuario()) === antes, "El dictado no debe enviar el mensaje solo");
    await chat.getByRole("button", { name: "Terminar el dictado" }).click();
    await chat.getByText(/Escuchando…/).waitFor({ state: "detached" });
    // Corregir el texto dictado y enviarlo
    await caja.fill((await caja.inputValue()) + " a 20 m");
    await page.keyboard.press("Enter");
    await chat.getByText(/Listo: inscribí el nodo antena «Antena 2»/).waitFor();
    afirmar((await nodosEnLista(page)) === 2, "Melki no inscribió el nodo dictado");
    // Dictado privado: usa el reconocimiento en el equipo
    await chat.getByRole("button", { name: "Ajustes de voz" }).click();
    await chat.getByRole("radio", { name: /Privado, sin internet/ }).click();
    await chat.getByRole("button", { name: "Ajustes de voz" }).click();
    await chat.getByRole("button", { name: "Dictar por voz" }).click();
    await chat.getByText(/Escuchando en este equipo/).waitFor();
    const usado = await page.evaluate(() => window.__dictado);
    afirmar(usado.local === true && usado.lang === "es-ES", `El dictado privado no usó el reconocimiento en el equipo (${JSON.stringify(usado)})`);
    await page.waitForFunction(() => document.querySelector("[aria-label='Pregunta para Melki']")?.value.includes("4.25 -73.30"), null, { timeout: 10000 });
    // Escribir mientras dicta detiene el dictado y conserva lo escrito
    await caja.fill("hola");
    await chat.getByText(/Escuchando/).waitFor({ state: "detached" });
    afirmar((await caja.inputValue()) === "hola", "Lo escrito a mano se perdió");
    const pref = await page.evaluate(() => JSON.parse(localStorage.getItem("simulador-cobertura-melki-v1") ?? "{}").dictado);
    afirmar(pref === "privado", "No se recordó el modo de dictado");
    await foto("privado");
  },
  { preparar: (page) => page.addInitScript(vozDeMentira) },
);

await flujo("regla", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("radio", { name: /Regla/ }).click();
  const panel = page.getByRole("region", { name: "Regla de medición" });
  await panel.getByRole("radio", { name: "Trayecto" }).click();
  const c = await mapaCentro(page);
  await page.mouse.click(c.x + 40, c.y - 120);
  await page.mouse.click(c.x + 200, c.y - 40);
  await page.mouse.click(c.x + 120, c.y + 120);
  await page.keyboard.press("Enter");
  await panel.getByText("Mediciones (1)").waitFor();
  await panel.getByText("Trayecto 1").first().waitFor();
  await panel.getByRole("button", { name: "Perfil del terreno de Trayecto 1" }).click();
  await page.getByRole("dialog", { name: /Perfil del terreno Trayecto 1/ }).getByText(/sube \d+ m/).waitFor({ timeout: 30000 });
  await foto("trayecto");
  await page.getByRole("button", { name: "Cerrar perfil del terreno" }).click();
  // Área
  await panel.getByRole("radio", { name: "Área" }).click();
  await page.mouse.click(c.x + 60, c.y + 60);
  await page.mouse.click(c.x + 220, c.y + 70);
  await page.mouse.click(c.x + 180, c.y + 200);
  await page.keyboard.press("Enter");
  await panel.getByText("Mediciones (2)").waitFor();
  await panel.getByText(/ha|km²/).first().waitFor();
  // Renombrar y borrar
  await panel.getByRole("textbox").first().fill("Lote norte");
  await panel.getByText("Lote norte").first().waitFor();
  await panel.getByRole("button", { name: "Borrar Lote norte" }).click();
  await panel.getByText("Mediciones (1)").waitFor();
  await foto("area");
});

await flujo("buscador", async (page, foto) => {
  await esperarSimulacion(page);
  const q = page.getByPlaceholder("Coordenadas, municipio o nodo…");
  await q.fill("Barranca de Up");
  await page.getByRole("option", { name: /Barranca de Upía/ }).waitFor();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Punto marcado" }).getByText("Barranca de Upía, Meta").waitFor();
  await q.fill("4.25, -73.30");
  await page.getByRole("option", { name: /Ir a la coordenada/ }).click();
  const tarjeta = page.getByRole("dialog", { name: "Punto marcado" });
  await tarjeta.getByText("Coordenada buscada").waitFor();
  await tarjeta.getByRole("button", { name: "Agregar nodo antena" }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-tour=lista-antenas] > li").length === 2);
  await foto("lugar");
});

await flujo("menu-contextual", async (page, foto) => {
  await esperarSimulacion(page);
  const c = await mapaCentro(page);
  await page.mouse.click(c.x + 90, c.y + 60, { button: "right" });
  const menu = page.getByRole("menu", { name: "Acciones en este punto" });
  await menu.waitFor();
  await foto("menu");
  await menu.getByRole("menuitem", { name: "Agregar nodo de campo aquí" }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-tour=lista-antenas] > li").length === 2);
  await page.mouse.click(c.x - 90, c.y - 60, { button: "right" });
  await menu.getByRole("menuitem", { name: "Medir desde aquí" }).click();
  await page.getByRole("region", { name: "Regla de medición" }).waitFor();
});

await flujo("capas", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("button", { name: "Capas" }).click();
  await page.getByRole("radio", { name: /OpenTopoMap/ }).check();
  await page.waitForFunction(() => document.documentElement.dataset.fondoMapa === "opentopomap");
  afirmar(await page.getByRole("checkbox", { name: /Departamentos y municipios/ }).isChecked(), "Los límites deberían estar activos");
  await foto("menu");
  await page.getByRole("checkbox", { name: /Rango de alcance/ }).uncheck({ force: true });
  await page.getByText("Alcance con servicio (≥ 20 dB)").waitFor({ state: "detached" });
  await page.keyboard.press("Escape");
});

await flujo("radio-mobile", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("tab", { name: "Parámetros" }).click();
  const prop = page.locator("[data-tour=propagacion]");
  await prop.getByRole("radio", { name: "Alta", exact: true }).click();
  await prop.getByText(/90 % del tiempo y de las situaciones/).waitFor();
  await page.waitForTimeout(900);
  await esperarSimulacion(page);
  await prop.getByText("Parámetros como en Radio Mobile").click();
  await prop.getByText("modificados").waitFor();
  await prop.getByLabel("Clima de radio").selectOption("5");
  afirmar((await prop.getByLabel(/^Refractividad/).inputValue()) === "301", "El clima no propuso su refractividad");
  await foto("parametros");
  await prop.getByRole("button", { name: "Restablecer" }).click();
  await prop.getByText("de referencia").waitFor();
  await prop.getByRole("radio", { name: "Longley-Rice" }).click();
  await page.waitForTimeout(900);
  await esperarSimulacion(page);
  await page.getByLabel("Entorno de la zona").selectOption("plantacion");
  await page.getByText(/Pérdida ≈ 11,8 dB para el receptor/).waitFor();
  await page.waitForTimeout(900);
  await esperarSimulacion(page);
  await page.getByRole("button", { name: "Cómo se calculó" }).click();
  await page.getByText("Longley-Rice (ITM)", { exact: true }).waitFor();
});

await flujo("direccional", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("button", { name: "Por coordenadas" }).click();
  const formulario = page.locator("[data-tour=formulario-coordenadas]");
  await formulario.getByPlaceholder("4.5123").fill("4.26");
  await formulario.getByPlaceholder("-73.1234").fill("-73.30");
  await formulario.getByPlaceholder("Torre norte").fill("Torre NE");
  await formulario.getByRole("button", { name: "Agregar nodo antena" }).click();
  await page.waitForTimeout(900);
  await esperarSimulacion(page);
  await page.locator("[data-tour=lista-antenas]").getByRole("button", { name: /^Ejemplo Antena/ }).click();
  const editor = page.locator("[data-tour=editor-antena]");
  await editor.getByLabel("Tipo de antena").selectOption("yagi");
  await editor.getByLabel("Apuntar hacia").selectOption({ index: 1 });
  await page.locator("[data-tour=lista-antenas]").getByText(/yagi a \d+°/).waitFor();
  await page.waitForTimeout(900);
  await esperarSimulacion(page);
  await foto("yagi");
  await editor.getByRole("button", { name: "Radioenlace" }).click();
  const dialogo = page.getByRole("dialog", { name: /Perfil/ });
  await dialogo.getByText("Potencias y antenas").waitFor({ timeout: 30000 });
  await dialogo.getByText("PIRE", { exact: true }).waitFor();
  await dialogo.getByText(/dBµV\/m/).first().waitFor();
  await foto("informe");
  const [txt] = await Promise.all([page.waitForEvent("download"), dialogo.getByRole("button", { name: "Descargar" }).click()]);
  const texto = fs.readFileSync(await txt.path(), "utf8");
  afirmar(/INFORME DE RADIOENLACE/.test(texto) && /Peor despeje de Fresnel/.test(texto) && /Yagi|PIRE/.test(texto), "El informe descargado está incompleto");
});

await flujo("escala", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("button", { name: "Capas" }).click();
  const escala = page.locator("[data-tour=escala]");
  await escala.getByLabel("Unidad de la señal").selectOption("dbm");
  await escala.getByRole("radio", { name: "Arcoíris" }).click();
  await page.keyboard.press("Escape");
  const leyenda = page.locator("[data-tour=leyenda]");
  await leyenda.getByText("Potencia que llega al receptor").waitFor();
  await leyenda.getByText("-121 dBm").waitFor();
  await foto("arcoiris");
});

await flujo("zoom-maximo", async (page, foto) => {
  await esperarSimulacion(page);
  // Al llegar al acercamiento máximo el botón «+» se desactiva (no se piden imágenes que no existen)
  const acercar = page.locator(".maplibregl-ctrl-zoom-in");
  for (let i = 0; i < 40; i++) {
    if (await acercar.isDisabled()) break;
    await acercar.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => document.querySelector(".maplibregl-ctrl-zoom-in")?.hasAttribute("disabled"), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  // Con el tope, la barra de escala no baja de 50 m (≈ 0,6 m por píxel)
  const escala = (await page.locator(".maplibregl-ctrl-scale").innerText()).trim();
  afirmar(/km$/.test(escala) || Number.parseInt(escala) >= 50, `Acercamiento excesivo (escala ${escala})`);
  await foto("maximo");
});

/** Recorre el tour abierto hasta el final: «Hágalo por mí» en los pasos prácticos y «Siguiente» en los demás. */
async function recorrerTour(page, nombre, foto) {
  const tour = page.getByRole("dialog", { name: `Tour: ${nombre}` });
  await tour.waitFor();
  const titulo = () => tour.locator("p.font-cond").first().innerText();
  for (let paso = 0; paso < 30; paso++) {
    await page.waitForTimeout(250);
    const t = await titulo();
    if (t === "¡Terminó el tour!") break;
    const hagalo = tour.getByRole("button", { name: "Hágalo por mí" });
    const siguiente = tour.getByRole("button", { name: /^(Empezar|Siguiente|Terminar)$/ });
    if (await hagalo.isVisible()) {
      await hagalo.click();
      await tour.getByText(/Listo, lo hice por usted\.|¡Bien hecho!|Listo: /).waitFor({ timeout: 60000 }).catch(() => {
        throw new Error(`«${nombre}»: el paso «${t}» no se detectó después de «Hágalo por mí»`);
      });
    } else if (await siguiente.isVisible()) await siguiente.click();
    // Paso hecho solo (por ejemplo, el cálculo automático): se pasa solo al siguiente
    await page.waitForFunction((x) => document.querySelector('[role=dialog][aria-label^="Tour:"] p.font-cond')?.textContent !== x, t, { timeout: 15000 });
  }
  if (foto) await foto("final");
  await tour.getByRole("button", { name: "Cerrar" }).click();
  await tour.waitFor({ state: "detached" });
}

/** El escenario del usuario volvió tal cual (la demostración con un solo nodo «Ejemplo») y no quedó respaldo. */
async function escenarioIntacto(page, mensaje) {
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("simulador-cobertura-v1") ?? "{}").escenario?.nombre === "Demostración: nodo antena Ejemplo", null, { timeout: 5000 }).catch(() => {});
  const g = await page.evaluate(() => ({
    e: JSON.parse(localStorage.getItem("simulador-cobertura-v1") ?? "{}").escenario,
    respaldo: localStorage.getItem("simulador-cobertura-respaldo-tour"),
  }));
  afirmar(g.e?.nombre === "Demostración: nodo antena Ejemplo" && g.e.antenas.length === 1 && g.e.antenas[0].nombre === "Ejemplo" && !g.respaldo, `${mensaje}: el escenario no volvió tal cual (${g.e?.nombre}, ${g.e?.antenas?.length} nodos)`);
  afirmar((await page.getByLabel("Nombre del escenario").inputValue()) === "Demostración: nodo antena Ejemplo", `${mensaje}: el nombre en pantalla no volvió`);
}

await flujo(
  "tour-pantalla",
  async (page, foto) => {
    await esperarSimulacion(page);
    // Primera visita: Melki ofrece los tours y muestra el menú
    await page.getByRole("button", { name: "Sí, muéstreme" }).click();
    const menu = page.getByRole("region", { name: "Conversación con Melki" }).getByRole("group", { name: "Tours guiados" });
    await menu.waitFor();
    afirmar((await menu.getByRole("button").count()) === 6, "El menú debería tener 6 tours");
    afirmar(/^Tutorial básico \(recomendado\)/.test(await menu.getByRole("button").first().innerText()), "El tutorial básico debería ir primero");
    await foto("menu");
    await menu.getByRole("button", { name: /^Conocer la pantalla/ }).click();
    await recorrerTour(page, "Conocer la pantalla", foto);
    await escenarioIntacto(page, "Conocer la pantalla");
  },
  { conMelki: true },
);

await flujo("tutorial-basico", async (page, foto) => {
  await esperarSimulacion(page);
  const antes = await page.getByRole("heading", { name: /^(Factible|Factible con ajustes|No factible todavía)$/ }).first().innerText();
  await page.getByRole("button", { name: "Tours guiados" }).click();
  await page.getByRole("group", { name: "Tours guiados" }).last().getByRole("button", { name: /^Tutorial básico \(recomendado\)/ }).click();
  const tour = page.getByRole("dialog", { name: "Tour: Tutorial básico" });
  await tour.getByRole("button", { name: "Empezar" }).click();
  // Escenario de práctica vacío
  await page.waitForFunction(() => document.querySelector("[aria-label='Nombre del escenario']")?.value === "Práctica: tutorial básico", null, { timeout: 8000 });
  afirmar((await nodosEnLista(page)) === 0, "La práctica debería empezar sin nodos");
  // 1) A mano: Agregar y clic en el mapa
  await tour.getByText("Hágalo en la pantalla; le aviso cuando esté.").waitFor();
  await page.getByRole("radio", { name: /Agregar/ }).click();
  const c = await mapaCentro(page);
  await page.mouse.click(c.x + 60, c.y + 80);
  await tour.getByText("¡Bien hecho!").waitFor({ timeout: 8000 });
  await foto("bien-hecho");
  // 2) Con «Hágalo por mí»
  await tour.getByText("Súbale la altura").waitFor({ timeout: 8000 });
  await tour.getByRole("button", { name: "Hágalo por mí" }).click();
  await tour.getByText("Listo, lo hice por usted.").waitFor();
  // 3) A mano: Simular (la práctica tiene «Simular al cambiar» apagado)
  await tour.getByText("Simule", { exact: true }).waitFor({ timeout: 8000 });
  await page.locator("[data-tour=simular]").getByRole("button", { name: /^Simular/ }).first().click();
  await tour.getByText("Lea los colores").waitFor({ timeout: 90000 });
  await tour.getByRole("button", { name: "Siguiente" }).click();
  // 5) Omitir
  await tour.getByText("Mida la señal en un punto").waitFor();
  await tour.getByRole("button", { name: "Omitir paso" }).click();
  await tour.getByText("¿Es factible?").waitFor();
  await tour.getByRole("button", { name: "Siguiente" }).click();
  await tour.getByText("Guarde o exporte").waitFor();
  await tour.getByRole("button", { name: "Terminar" }).click();
  await tour.getByText("¡Terminó el tour!").waitFor();
  afirmar((await page.evaluate(() => localStorage.getItem("simulador-cobertura-respaldo-tour"))) !== null, "Durante la práctica debería existir el respaldo");
  await tour.getByRole("button", { name: "Cerrar" }).click();
  await escenarioIntacto(page, "Tutorial básico");
  const despues = await page.getByRole("heading", { name: /^(Factible|Factible con ajustes|No factible todavía)$/ }).first().innerText();
  afirmar(antes === despues, `El resultado no volvió (${antes} → ${despues})`);
  // Si se cierra la página a mitad del tour, al volver está el escenario del usuario
  await page.getByRole("button", { name: "Tours guiados" }).click();
  await page.getByRole("group", { name: "Tours guiados" }).last().getByRole("button", { name: /^Tutorial básico \(recomendado\)/ }).click();
  await page.getByRole("dialog", { name: "Tour: Tutorial básico" }).getByRole("button", { name: "Empezar" }).click();
  await page.getByRole("dialog", { name: "Tour: Tutorial básico" }).getByRole("button", { name: "Hágalo por mí" }).click();
  await page.waitForFunction(() => (localStorage.getItem("simulador-cobertura-v1") ?? "").includes("Práctica: tutorial básico"), null, { timeout: 10000 });
  await page.reload();
  await esperarSimulacion(page);
  await escenarioIntacto(page, "Recarga a mitad del tour");
});

await flujo("tours-practicos", async (page, foto) => {
  await esperarSimulacion(page);
  for (const nombre of ["Red mesh completa", "Como Radio Mobile", "Medir y exportar", "Hablar con Melki"]) {
    await page.getByRole("button", { name: "Tours guiados" }).click();
    await page.getByRole("group", { name: "Tours guiados" }).last().getByRole("button", { name: new RegExp(`^${nombre}`) }).click();
    await recorrerTour(page, nombre, nombre === "Como Radio Mobile" ? foto : undefined);
    await escenarioIntacto(page, nombre);
  }
  // Pedido por nombre en el chat
  const chat = page.getByRole("region", { name: "Conversación con Melki" });
  if (!(await chat.isVisible())) await page.getByRole("button", { name: /Abrir a Melki/ }).click();
  await chat.getByLabel("Pregunta para Melki").fill("hazme el tour de Radio Mobile");
  await page.keyboard.press("Enter");
  await chat.getByRole("button", { name: "Empezar «Como Radio Mobile»" }).click();
  await page.getByRole("dialog", { name: "Tour: Como Radio Mobile" }).getByRole("button", { name: "Salir" }).click();
  await escenarioIntacto(page, "Salir del tour");
});

await flujo(
  "tour-movil",
  async (page, foto) => {
    await esperarSimulacion(page).catch(() => {});
    await page.getByRole("button", { name: "Tours guiados" }).click();
    await page.getByRole("group", { name: "Tours guiados" }).last().getByRole("button", { name: /^Tutorial básico \(recomendado\)/ }).click();
    await recorrerTour(page, "Tutorial básico", foto);
    await escenarioIntacto(page, "Tutorial en el celular");
  },
  { tamano: { width: 390, height: 844 } },
);

await flujo("exportar", async (page) => {
  await esperarSimulacion(page);
  await page.getByRole("radio", { name: /Regla/ }).click();
  const c = await mapaCentro(page);
  await page.getByRole("region", { name: "Regla de medición" }).getByRole("radio", { name: "Línea" }).click();
  await page.mouse.click(c.x + 40, c.y - 100);
  await page.mouse.click(c.x + 200, c.y + 40);
  await page.getByText("Mediciones (1)").waitFor();
  await page.getByRole("button", { name: "Archivo" }).click();
  const [json] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /Guardar escenario/ }).click()]);
  const escenario = JSON.parse(fs.readFileSync(await json.path(), "utf8"));
  afirmar(escenario.antenas?.length === 1 && escenario.antenas[0].tipo === "antena", "El .json exportado no tiene el nodo antena");
  afirmar(escenario.mediciones?.length === 1, "El .json exportado no tiene la medición");
  await page.getByRole("button", { name: "Archivo" }).click();
  const [kmz] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /Google Earth/ }).click()]);
  const bytes = fs.readFileSync(await kmz.path());
  afirmar(bytes[0] === 0x50 && bytes[1] === 0x4b && kmz.suggestedFilename().endsWith(".kmz"), "El .kmz no es un ZIP válido");
  afirmar(bytes.includes(Buffer.from("doc.kml")) && bytes.includes(Buffer.from("cobertura.png")), "Al .kmz le faltan archivos");
  afirmar(bytes.includes(Buffer.from("Rango de alcance")) && bytes.includes(Buffer.from("<name>Mediciones</name>")), "Al .kmz le falta el rango de alcance o las mediciones");
});

await flujo("guardado", async (page) => {
  await esperarSimulacion(page);
  const nombre = page.getByLabel("Nombre del escenario");
  await nombre.fill("Escenario guardado");
  // Espera a que el guardado automático (300 ms) quede escrito antes de recargar
  await page.waitForFunction(() => (localStorage.getItem("simulador-cobertura-v1") ?? "").includes("Escenario guardado"), null, { timeout: 10000 });
  await page.reload();
  await page.getByLabel("Nombre del escenario").waitFor();
  afirmar((await page.getByLabel("Nombre del escenario").inputValue()) === "Escenario guardado", "El escenario no se conservó al recargar");
});

await flujo(
  "movil",
  async (page, foto) => {
    await esperarSimulacion(page).catch(() => {});
    await page.getByRole("button", { name: "Buscar coordenadas, municipio o nodo" }).click();
    await page.getByPlaceholder("Coordenadas, municipio o nodo…").filter({ visible: true }).fill("Cumaral");
    await page.getByRole("option", { name: /Cumaral/ }).click();
    await page.getByRole("dialog", { name: "Punto marcado" }).waitFor();
    await page.getByRole("button", { name: "Resultado" }).click();
    await page.getByRole("heading", { name: /Factible|No factible/ }).first().waitFor({ timeout: 90000 });
    await foto("resultado");
  },
  { tamano: { width: 390, height: 844 } },
);

let fallos = 0;
for (const r of resultados) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.nombre}${r.ok ? "" : ` — ${r.error}`}`);
  for (const a of r.avisos.slice(0, 5)) console.log(`    aviso: ${a}`);
  if (!r.ok) fallos++;
}
await navegador.close();
process.exit(fallos ? 1 : 0);
