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

async function flujo(nombre, fn, { tamano = { width: 1440, height: 900 }, conMelki = false, sembrar = false, preparar } = {}) {
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
  // Estado limpio; sin la bienvenida de Melki salvo en su propia prueba. Las pruebas de siempre usan el modo
  // avanzado; las de «Sembrar la malla», el modo con que abre el simulador.
  await page.addInitScript(
    ({ melki, sembrar: modoSembrar }) => {
      // Solo en la primera carga de la pestaña (window.name sobrevive a las recargas también en file://)
      if (sessionStorage.getItem("e2e") || window.name === "e2e") return;
      sessionStorage.setItem("e2e", "1");
      window.name = "e2e";
      localStorage.clear();
      if (!melki) localStorage.setItem("simulador-cobertura-melki-v1", JSON.stringify({ visto: true, voz: false }));
      if (!modoSembrar) localStorage.setItem("simulador-cobertura-modo", "avanzado");
    },
    { melki: conMelki, sembrar },
  );
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
  await page.getByLabel("Resultados").getByText("Antena de prueba").filter({ visible: true }).first().waitFor({ timeout: 90000 });
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
      // Si el paso se cumple solo justo antes (el cálculo automático), el botón desaparece: se sigue sin esperarlo
      // Con WebGL por software el hilo principal puede tardar unos segundos en atender el clic
      const pulsado = await hagalo.click({ timeout: 10000 }).then(
        () => true,
        () => false,
      );
      if (pulsado)
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
    afirmar((await menu.getByRole("button").count()) === 9, "El menú debería tener 9 tours");
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

/* ───────────── Modo «Sembrar la malla» ───────────── */

/** Espera a que la red sembrada quede calculada (sin «Calculando» en la guía ni en el estado). */
const esperarRed = async (page) => {
  await page.waitForFunction(() => !document.querySelector("[role=progressbar]"), null, { timeout: 90000 });
  await page.waitForFunction(
    () => {
      const g = document.querySelector("[data-tour=guia-sembrar]")?.textContent ?? "";
      const e = document.querySelector("[data-tour=estado-red]")?.textContent ?? "";
      return g !== "" && !/Calculando/.test(g + e);
    },
    null,
    { timeout: 90000 },
  );
};
const cargarMalla = async (page) => {
  await page.getByRole("button", { name: "Ejemplo de malla" }).click();
  await page.waitForTimeout(400);
  await esperarRed(page);
};
/** Número de una cifra del «Estado de la red». */
const cifra = async (page, etiqueta) => (await page.locator("[data-tour=estado-red] > div > div").filter({ hasText: etiqueta }).locator("p").first().innerText()).trim();
const guia = (page) => page.locator("[data-tour=guia-sembrar]").innerText();
const piezasEnLista = (page) => page.locator("[data-tour=lista-piezas] li").count();

await flujo(
  "sembrar-inicio",
  async (page, foto) => {
    await page.getByRole("complementary", { name: "Sembrar la malla" }).waitFor();
    await esperarRed(page);
    afirmar(/Ponga los repetidores/.test(await guia(page)), `Con solo el gateway, la guía debería pedir repetidores: ${await guia(page)}`);
    afirmar(!(await page.getByRole("tab", { name: /^Nodos/ }).isVisible()), "En el modo «Sembrar» no van las pestañas del modo avanzado");
    await cargarMalla(page);
    afirmar((await cifra(page, "conectados de 3")) === "2", `Deberían quedar 2 personas conectadas (${await cifra(page, "conectados de 3")})`);
    afirmar((await cifra(page, "sin cobertura")) === "1", "Debería quedar 1 persona sin cobertura");
    afirmar(/Una persona sin cobertura/.test(await guia(page)), "La guía debería señalar a la persona sin cobertura");
    afirmar((await page.locator(".pieza.red-sin-cobertura").count()) === 1, "Falta la persona en rojo en el mapa");
    afirmar((await page.locator(".pieza .saltos").count()) >= 3, "Faltan los saltos sobre las piezas conectadas");
    afirmar((await page.locator(".pieza-gateway .pieza-ia").count()) === 1, "Falta la nube «IA» sobre el gateway");
    // Flujo animado: rutas vivas hacia el gateway y piezas que destellan al retransmitir
    await page.waitForFunction(() => Number(document.querySelector("[data-rutas-vivas]")?.dataset.rutasVivas) >= 2 && document.querySelector("[data-animacion]")?.dataset.animacion === "si", null, { timeout: 15000 });
    await page.waitForSelector(".pieza.transmite, .pieza-ia.piensa", { state: "attached", timeout: 15000 });
    await page.locator("[data-tour=alcance-referencia]").getByText(/Repetidor de 6 m → gente/).waitFor();
    await page.getByRole("button", { name: "Cómo funciona" }).waitFor();
    await page.locator('[aria-label="Persona Persona 3"]').waitFor();
    await page.getByText("Cómo leer el mapa").waitFor();
    await foto("malla");
  },
  { sembrar: true },
);

await flujo(
  "sembrar-manual",
  async (page, foto) => {
    await esperarRed(page);
    await page.getByRole("button", { name: "Vaciar" }).click();
    await page.getByRole("button", { name: "¿Seguro? Vaciar todo" }).click();
    afirmar(/Ponga el Gateway \+ Internet/.test(await guia(page)), "Sin nada, el primer paso es el gateway");
    afirmar((await page.locator("[data-tour=piezas]").getByRole("button", { name: /Gateway \+ Internet/ }).getAttribute("aria-pressed")) === "true", "Después de vaciar queda armado el gateway");
    const c = await mapaCentro(page);
    await page.mouse.click(c.x - 150, c.y + 60);
    await page.waitForTimeout(250);
    // Después del gateway queda armado el repetidor
    afirmar((await page.locator("[data-tour=piezas]").getByRole("button", { name: /Repetidor/ }).getAttribute("aria-pressed")) === "true", "Tras el gateway debería quedar armado el repetidor");
    await page.mouse.click(c.x + 60, c.y - 20);
    await page.locator("[data-tour=piezas]").getByRole("button", { name: /Persona/ }).click();
    await page.mouse.click(c.x + 200, c.y + 40);
    await page.mouse.click(c.x - 60, c.y + 160);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    await esperarRed(page);
    afirmar((await piezasEnLista(page)) === 4, `Deberían quedar 4 piezas (${await piezasEnLista(page)})`);
    await page.locator('[aria-label="Gateway Gateway"]').waitFor();
    await page.locator('[aria-label="Repetidor Repetidor 1"]').waitFor();
    // El gateway es uno: ponerlo otra vez lo mueve
    await page.locator("[data-tour=piezas]").getByRole("button", { name: /Gateway \+ Internet/ }).click();
    await page.mouse.click(c.x - 200, c.y - 120);
    await page.keyboard.press("Escape");
    afirmar((await piezasEnLista(page)) === 4, "Poner el gateway otra vez debería moverlo, no duplicarlo");
    // Al seleccionar una pieza en el mapa aparece su «×» para quitarla; también se quitan desde la lista
    await page.locator('[aria-label="Persona Persona 2"] .pieza-disco').click();
    await page.locator('[aria-label="Persona Persona 2"] .pieza-quitar').click();
    afirmar((await piezasEnLista(page)) === 3, "La «×» del mapa no quitó la pieza");
    await page.locator("[data-tour=lista-piezas]").getByRole("button", { name: "Quitar Persona 1" }).click();
    afirmar((await piezasEnLista(page)) === 2, "No se quitó la persona desde la lista");
    await esperarRed(page);
    await foto("manual");
  },
  { sembrar: true },
);

await flujo(
  "sembrar-automatico",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    await page.getByRole("button", { name: "Conectar a los que faltan (1)" }).click();
    const propuesta = page.locator("[data-tour=propuesta]");
    await propuesta.waitFor({ timeout: 60000 });
    afirmar(/Propuesta: \d repetidor/.test(await propuesta.innerText()) && /✓ Persona 3/.test(await propuesta.innerText()), `Propuesta inesperada: ${await propuesta.innerText()}`);
    afirmar((await page.locator(".pieza.propuesto").count()) >= 1, "Faltan los repetidores propuestos en el mapa");
    await foto("propuesta");
    await propuesta.getByRole("button", { name: /^Poner/ }).click();
    await page.waitForTimeout(900);
    await esperarRed(page);
    afirmar(/Toda la gente está conectada/.test(await guia(page)), `Después de sembrar deberían quedar todos conectados: ${await guia(page)}`);
    afirmar((await cifra(page, "sin cobertura")) === "0", "Aún hay personas sin cobertura");
    await page.locator("[data-tour=sembrar-auto]").getByRole("button", { name: "Deshacer" }).click();
    await page.waitForTimeout(900);
    await esperarRed(page);
    afirmar((await cifra(page, "sin cobertura")) === "1", "Deshacer debería quitar los repetidores sembrados");
    // Llevar la red a un punto del mapa
    const antes = await piezasEnLista(page);
    await page.getByRole("button", { name: "Llevar la red a un punto" }).click();
    await page.getByText("Toque el punto al que quiere llevar la red").waitFor();
    const c = await mapaCentro(page);
    await page.mouse.click(c.x - 220, c.y - 180);
    await propuesta.waitFor({ timeout: 60000 });
    await propuesta.getByRole("button", { name: /^Poner/ }).click();
    await page.waitForTimeout(600);
    afirmar((await piezasEnLista(page)) > antes, "No se pusieron las piezas hacia el punto");
    await esperarRed(page);
    await foto("punto");
  },
  { sembrar: true },
);

await flujo(
  "sembrar-mensaje",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    const envio = page.locator("[data-tour=enviar-mensaje]");
    await envio.getByRole("button", { name: "Enviar" }).click();
    const viaje = page.locator("[data-tour=viaje-mensaje]");
    await viaje.getByText("El mensaje llega al gateway").waitFor();
    afirmar(/de 3 permitidos/.test(await viaje.innerText()) && /Con los 4 intentos/.test(await viaje.innerText()) && /13\d bytes \(el tamaño de una orden de pago\)/.test(await viaje.innerText()), `Faltan datos del viaje: ${await viaje.innerText()}`);
    await page.locator(".paquete-mensaje").waitFor({ state: "attached" });
    await foto("viajando");
    // Llega al gateway, la IA «piensa» y la respuesta vuelve por la misma ruta
    await page.waitForSelector(".pieza-ia.piensa", { state: "attached", timeout: 20000 });
    await page.waitForSelector(".paquete-mensaje.respuesta", { state: "attached", timeout: 20000 });
    await page.waitForSelector(".paquete-mensaje.entregado", { state: "attached", timeout: 25000 });
    afirmar(/Respuesta/.test(await viaje.innerText()) && /WhatsApp/.test(await viaje.innerText()), "Falta la respuesta (pago, WhatsApp o IA) en el viaje");
    // Desde la persona sin cobertura no llega
    await envio.getByLabel("Desde").selectOption({ label: "Persona 3" });
    await envio.getByRole("button", { name: "Enviar" }).click();
    await viaje.getByText("El mensaje no llega").waitFor();
    afirmar(/No tiene ruta/.test(await viaje.innerText()), "Debería decir que no tiene ruta");
    await foto("no-llega");
  },
  { sembrar: true },
);

await flujo(
  "modo",
  async (page, foto) => {
    await esperarRed(page);
    await page.getByRole("radio", { name: /Modo avanzado/ }).click();
    await page.getByRole("tab", { name: "Nodos (1)" }).waitFor();
    await page.reload();
    await page.getByRole("tab", { name: "Nodos (1)" }).waitFor({ timeout: 30000 });
    await page.getByRole("radio", { name: /Sembrar la malla/ }).click();
    await page.locator("[data-tour=guia-sembrar]").waitFor();
    // El flujo animado se apaga y se enciende con su interruptor
    await page.waitForFunction(() => document.querySelector("[data-animacion]")?.dataset.animacion === "si", null, { timeout: 30000 });
    await page.getByText("Animar el flujo de la información").click();
    await page.waitForFunction(() => document.querySelector("[data-animacion]")?.dataset.animacion === "no", null, { timeout: 5000 });
    await page.getByText("Animar el flujo de la información").click();
    await page.waitForFunction(() => document.querySelector("[data-animacion]")?.dataset.animacion === "si", null, { timeout: 5000 });
    // Un tour del modo avanzado lo usa mientras dura y luego vuelve a «Sembrar la malla»
    await page.getByRole("button", { name: "Tours guiados" }).click();
    await page.getByRole("group", { name: "Tours guiados" }).last().getByRole("button", { name: /^Tutorial básico/ }).click();
    await page.getByRole("dialog", { name: "Tour: Tutorial básico" }).waitFor();
    await page.getByRole("tab", { name: /^Nodos/ }).waitFor();
    await foto("tour-avanzado");
    await page.getByRole("dialog", { name: "Tour: Tutorial básico" }).getByRole("button", { name: "Salir" }).click();
    await page.locator("[data-tour=guia-sembrar]").waitFor();
    await escenarioIntacto(page, "Tour desde «Sembrar la malla»");
  },
  { sembrar: true },
);

await flujo(
  "melki-sembrar",
  async (page, foto) => {
    await esperarRed(page);
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    const decir = async (t) => {
      await chat.getByLabel("Pregunta para Melki").fill(t);
      await page.keyboard.press("Enter");
    };
    await decir("carga el ejemplo de malla");
    await chat.getByText(/Cargué el ejemplo de malla/).waitFor();
    await chat.getByText(/Red calculada\. La red: 2 de 3 personas conectadas/).waitFor({ timeout: 90000 });
    await decir("conecta a los que faltan");
    await chat.getByText(/Busco lomas/).waitFor();
    await chat.getByText(/^Propongo/).waitFor({ timeout: 60000 });
    await chat.getByRole("button", { name: /^Poner (el repetidor|los \d repetidores)/ }).click();
    await chat.getByText(/Listo: puse/).waitFor();
    await chat.getByText(/3 de 3 personas conectadas/).waitFor({ timeout: 90000 });
    await decir("envía un pago desde Persona 3");
    await chat.getByText(/Envié un mensaje de prueba desde «Persona 3» del tamaño de un pago \(la orden firmada, \d+ bytes\): llega al gateway/).waitFor();
    await decir("¿cómo viaja un pago?");
    await chat.getByText(/Así viaja un pago en MeshCore/).waitFor();
    await decir("pon una persona en 4.35, -72.9");
    await chat.getByText(/puse la persona/).waitFor();
    await chat.getByText(/no alcanza la red/).waitFor({ timeout: 90000 });
    await foto("chat");
  },
  { sembrar: true },
);

await flujo(
  "melki-agente",
  async (page, foto) => {
    await esperarRed(page);
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    const decir = async (t) => {
      await chat.getByLabel("Pregunta para Melki").fill(t);
      await page.keyboard.press("Enter");
    };
    // La orden de Giancarlo, tal cual: diseño de la malla para 11.226 ha al 99,9 % con señal media o mejor
    await decir(
      "Hola corazón puedes ayudarme con algo viene siendo algo muy sencillo necesito que me armes una red que cubra un área de 11.000 hectáreas bueno al hacer exactos 11.226 una malla completa que cubre esa área con repetidores queden para que el 99.9% de esa área que una señal entre buena estable y media",
    );
    await chat.getByText(/^Diseño la malla para 11\.226 ha/).waitFor({ timeout: 20000 });
    await chat.getByText(/^(Listo: la malla cubre|Llegué al)/).waitFor({ timeout: 240000 });
    const final = await chat.locator("[data-mensaje]").last().innerText();
    afirmar(/^Listo: la malla cubre el (99,9|100) %/.test(final) && /Meta cumplida \(99,9 %\)/.test(final) && /Dentro del área: buena/.test(final), `Diseño: ${final.slice(0, 200)}`);
    await foto("diseno");
    // Varias órdenes en un mensaje, con posiciones relativas y referencias («la persona»)
    await decir("pon una persona a 3 km al sur del gateway y envía un mensaje desde la persona");
    await chat.getByText(/^Paso 1 de 2: Listo: puse la persona/).waitFor({ timeout: 30000 });
    await chat.getByText(/^Paso 2 de 2: Envié un mensaje de prueba desde «Persona 1»/).waitFor({ timeout: 120000 });
    await chat.getByText(/^Listo, hice los 2 pasos/).waitFor({ timeout: 30000 });
    await decir("muestra las vías y quita los ríos");
    await chat.getByText(/^Paso 2 de 2: Listo: el mapa ya no muestra los ríos/).waitFor({ timeout: 30000 });
    await decir("borra todas las personas");
    await chat.getByText(/^Borré 1 nodo \(todas las personas\): Persona 1/).waitFor({ timeout: 30000 });
    await decir("hazme el café por favor");
    await chat.getByText(/no logré convertirlo en una orden/).waitFor({ timeout: 10000 });
    await foto("chat");
  },
  { sembrar: true },
);

await flujo(
  "tour-sembrar",
  async (page, foto) => {
    await esperarRed(page);
    await page.getByRole("button", { name: "Tours guiados" }).click();
    await page.getByRole("group", { name: "Tours guiados" }).last().getByRole("button", { name: /^Sembrar la malla/ }).click();
    await recorrerTour(page, "Sembrar la malla", async (etiqueta) => {
      // Las piezas puestas seguidas («Hágalo por mí» pone dos personas) no repiten nombre
      const nombres = await page.locator("[data-tour=lista-piezas] li .font-cond").allInnerTexts();
      afirmar(nombres.length >= 5 && new Set(nombres).size === nombres.length, `Nombres repetidos en la práctica: ${nombres.join(", ")}`);
      await foto(etiqueta);
    });
    await escenarioIntacto(page, "Sembrar la malla");
    await page.locator("[data-tour=guia-sembrar]").waitFor();
  },
  { sembrar: true },
);

await flujo(
  "sembrar-movil",
  async (page, foto) => {
    // En el celular el panel va en una hoja que sube desde abajo
    const hoja = page.getByRole("region", { name: "Panel" });
    await page.getByRole("navigation", { name: "Paneles" }).getByRole("button", { name: "Sembrar" }).click();
    await hoja.locator("[data-tour=guia-sembrar]").waitFor();
    await esperarRed(page);
    await hoja.locator("[data-tour=piezas]").getByRole("button", { name: /Persona/ }).click();
    // Al elegir la pieza se cierra la hoja para tocar el mapa
    await hoja.waitFor({ state: "detached" });
    const c = await mapaCentro(page);
    await page.mouse.click(c.x + 40, c.y + 60);
    await page.waitForTimeout(300);
    await page.locator('[aria-label="Persona Persona 1"]').waitFor();
    await page.getByRole("navigation", { name: "Paneles" }).getByRole("button", { name: "Sembrar" }).click();
    await esperarRed(page);
    afirmar((await hoja.locator("[data-tour=lista-piezas] li").count()) === 2, "En el celular no se puso la persona");
    await foto("movil");
  },
  { sembrar: true, tamano: { width: 390, height: 844 } },
);

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

await flujo("ajuste-automatico", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("button", { name: /Abrir a Melki/ }).click();
  const pregunta = page.getByLabel("Pregunta para Melki");
  const chat = page.getByRole("region", { name: "Conversación con Melki" });
  // Un nodo lejano y bajo: la red queda sin ruta al gateway
  await pregunta.fill("inscribe un nodo antena llamado Lejano en 4.2, -73.2 a 9 m");
  await page.keyboard.press("Enter");
  await chat.getByText(/Listo: inscribí el nodo antena «Lejano»/).waitFor();
  await esperarSimulacion(page);
  await page.waitForTimeout(600);
  await esperarSimulacion(page);
  await page.getByRole("button", { name: "Cerrar a Melki" }).click().catch(() => {});
  const resultado = page.locator("aside[aria-label=Resultados]");
  // El botón del Inge: «Ajústamelo automáticamente»
  const boton = resultado.getByRole("button", { name: /Ajústamelo automáticamente|Optimizar la red/ });
  await boton.waitFor({ timeout: 30000 });
  await boton.click();
  const propuesta = resultado.getByLabel("Propuesta de ajuste");
  await propuesta.waitFor({ timeout: 120000 });
  await propuesta.getByText("Lo que necesita").waitFor();
  afirmar((await propuesta.locator("li").count()) >= 1, "La propuesta no dice lo que necesita");
  afirmar(!/\$|millones|pesos/.test(await propuesta.innerText()), "La propuesta no debe mostrar precios");
  afirmar((await page.locator(".ajuste-etiqueta, .pieza.propuesto").count()) >= 1, "El mapa no muestra la propuesta");
  await foto("propuesta");
  const antes = await nodosEnLista(page);
  await propuesta.getByRole("button", { name: "Aplicar y simular" }).click();
  await resultado.getByText(/Se aplicó «/).waitFor({ timeout: 30000 });
  await esperarSimulacion(page);
  await page.getByText(/Cobertura del área objetivo/).first().waitFor({ timeout: 30000 });
  await foto("aplicada");
  await resultado.getByRole("button", { name: "Deshacer" }).click();
  await page.waitForFunction((n) => document.querySelectorAll("[data-tour=lista-antenas] > li").length === n, antes, { timeout: 10000 });
  await esperarSimulacion(page);

  // Por chat: «¿qué necesito para que sea factible?» → propuesta con sus opciones
  await page.getByRole("button", { name: /Abrir a Melki/ }).click();
  await pregunta.fill("¿qué necesito para que sea factible sin pasar de 20 m?");
  await page.keyboard.press("Enter");
  await chat.getByText(/Analizo la red como lo haría un planeador/).waitFor();
  await chat.getByText(/¿La aplico\?/).waitFor({ timeout: 120000 });
  afirmar(!/Torre más alta[\s\S]{0,40}\b(2[1-9]|30) m/.test(await resultado.innerText()), "Con «sin pasar de 20 m» no debe proponer torres más altas");
  await chat.getByRole("button", { name: /^Aplicar «.*» \(recomendada\)$/ }).last().click();
  await chat.getByText(/Listo: apliqué la opción/).waitFor({ timeout: 120000 });
  await foto("chat");
});

// v12: «Poblar personas» y la prueba de carga (pagos al tiempo hasta que la frecuencia se revienta)
await flujo(
  "poblar-y-carga",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    const resultados = page.locator("aside[aria-label=Resultados]");
    const poblar = resultados.locator("[data-tour=poblar]");
    await poblar.getByRole("button", { name: "250", exact: true }).click();
    const t0 = Date.now();
    await poblar.getByRole("button", { name: /^Poblar 250 personas/ }).click();
    await poblar.getByText(/Puse 250 personas en alrededor de la red/).waitFor({ timeout: 15000 });
    await page.locator("[data-tour=lista-piezas]").getByText("250 personas pobladas al azar").waitFor();
    afirmar((await page.locator("[data-tour=lista-piezas] li").count()) < 20, "La lista de piezas no debe mostrar las 250 pobladas de una vez");
    await esperarRed(page);
    await page.waitForFunction(() => document.querySelectorAll(".pieza.poblada").length === 250, null, { timeout: 30000 });
    await resultados.locator("[data-tour=resumen-pobladas]").getByText(/250 personas pobladas/).waitFor({ timeout: 90000 });
    const segPoblar = (Date.now() - t0) / 1000;
    afirmar(segPoblar < 60, `Poblar y simular 250 personas tardó ${segPoblar.toFixed(1)} s`);
    afirmar((await page.locator(".pieza.poblada .nombre").first().isVisible()) === false, "Las pobladas no deben mostrar su nombre en el mapa");
    afirmar((await page.locator(".etiqueta-enlace").count()) < 40, `Demasiadas etiquetas de enlace en el mapa: ${await page.locator(".etiqueta-enlace").count()}`);
    await foto("pobladas");

    // Prueba de carga: 15 pagos al tiempo
    const carga = resultados.locator("[data-tour=prueba-carga]");
    await carga.getByRole("button", { name: "15", exact: true }).click();
    await carga.getByRole("button", { name: /^Probar 15 al tiempo/ }).click();
    const res = carga.locator("[data-tour=resultado-carga]");
    await res.getByText(/% de los 15 pagos con comprobante/).waitFor({ timeout: 60000 });
    afirmar(/Canal del gateway/.test(await res.innerText()) && /Choques/.test(await res.innerText()), `Faltan cifras de la prueba: ${await res.innerText()}`);
    afirmar(/Trama con SF11/.test(await carga.innerText()), "Falta la referencia de capacidad de Trama");
    await res.scrollIntoViewIfNeeded();
    await foto("carga-15");

    // ¿Hasta cuántos aguanta?
    await carga.getByRole("button", { name: /Hasta cuántos aguanta/ }).click();
    await res.getByRole("img", { name: /Completos según cuántos salen al tiempo/ }).waitFor({ timeout: 120000 });
    afirmar(/Se revienta desde \d+/.test(await res.innerText()) || /No se revienta/.test(await res.innerText()), `La curva no dice dónde se revienta: ${await res.innerText()}`);
    await res.scrollIntoViewIfNeeded();
    await foto("curva");

    // Por chat: Melki manda 25 pagos al tiempo y explica el resultado
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByLabel("Pregunta para Melki").fill("envía 25 pagos al tiempo");
    await page.keyboard.press("Enter");
    await chat.getByText(/paquete por paquete como MeshCore/).first().waitFor();
    await chat.getByText(/Probé 25 pagos al tiempo/).waitFor({ timeout: 120000 });
    await foto("melki-carga");

    // Quitar las pobladas
    await poblar.getByRole("button", { name: /^Quitar las 250/ }).click();
    await page.waitForFunction(() => document.querySelectorAll(".pieza.poblada").length === 0, null, { timeout: 15000 });
    await esperarRed(page);
    afirmar((await cifra(page, "conectados de 3")) === "2", "Al quitar las pobladas vuelve la red del ejemplo");
  },
  { sembrar: true },
);

await flujo(
  "zonas-y-estres",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    const resultados = page.locator("aside[aria-label=Resultados]");
    // Zonas de popularidad: 150 personas en el gateway y en el repetidor (2 zonas)
    const zonas = resultados.locator("[data-tour=zonas-popularidad]");
    await zonas.getByRole("button", { name: "150", exact: true }).click();
    const t0 = Date.now();
    await zonas.getByRole("button", { name: /^Poner 150 en cada uno \(300\)/ }).click();
    await zonas.getByText(/Puse \d+ personas/).waitFor({ timeout: 20000 });
    const puestas = Number((await zonas.getByText(/Puse \d+ personas/).innerText()).match(/Puse (\d+)/)[1]);
    afirmar(puestas > 150 && puestas <= 300, `Deberían quedar entre 150 y 300 personas en las zonas (${puestas})`);
    await page.waitForFunction((n) => document.querySelectorAll(".pieza.poblada").length === n, puestas, { timeout: 30000 });
    await esperarRed(page);
    afirmar(/Zonas puestas: Gateway \d+ · Repetidor 1 \d+/.test(await zonas.innerText()), `Faltan las zonas puestas: ${await zonas.innerText()}`);
    const segZonas = (Date.now() - t0) / 1000;
    await foto("zonas");

    // Prueba de estrés de la hora pico
    const estres = resultados.locator("[data-tour=prueba-estres]");
    await estres.getByRole("button", { name: /^Probar la hora pico/ }).click();
    const res = estres.locator("[data-tour=resultado-estres]");
    await res.getByText(/% de los mensajes de la hora pico con respuesta/).waitFor({ timeout: 90000 });
    const texto = await res.innerText();
    afirmar(/Mensajes por hora/.test(texto) && /Canal del gateway/.test(texto) && /Ancho de banda útil/.test(texto) && /Zona por zona/.test(texto), `Faltan cifras del estrés: ${texto.slice(0, 300)}`);
    afirmar(/Gateway/.test(texto) && /Repetidor 1/.test(texto) && /atiende hasta \d/.test(texto) && /energía [\d,]+ de \d+ Wh\/día/.test(texto), `Falta el detalle por zona: ${texto.slice(0, 500)}`);
    await page.locator(".etiqueta-estres").first().waitFor({ timeout: 10000 });
    afirmar((await page.locator(".etiqueta-estres").count()) >= 1, "Faltan las zonas pintadas en el mapa");
    await res.scrollIntoViewIfNeeded();
    await foto("estres");

    // ¿Hasta dónde aguanta cada repetidor?, comparando ajustes de radio
    await estres.getByText("Comparar ajustes de radio").click();
    await estres.getByRole("button", { name: /Hasta dónde aguanta cada repetidor/ }).click();
    await res.getByRole("img", { name: /Mensajes por hora entregados según los pedidos/ }).waitFor({ timeout: 120000 });
    const rampa = await res.innerText();
    afirmar(/Toda la malla aguanta sin demora hasta ~[\d.]+ personas|no aguanta ni con lo mínimo/.test(rampa) && /(Aguanta sin demora hasta|Aguanta más de) ~[\d.]+ personas/.test(rampa), `La rampa no dice cuánto aguanta: ${rampa.slice(0, 400)}`);
    afirmar(/La misma hora pico con otro ajuste de radio/.test(rampa) && /SF9 · 250 kHz/.test(rampa), "Falta la comparación de ajustes de radio");
    await res.scrollIntoViewIfNeeded();
    await foto("rampa");

    // Al tocar el repetidor: su zona de popularidad y su resultado
    await page.locator("[data-tour=lista-piezas]").getByRole("button", { name: /Repetidor 1/ }).first().click();
    const rapida = page.locator("[data-tour=lista-piezas] [data-tour=zona-rapida]");
    await rapida.waitFor();
    afirmar(/Zona de popularidad · \d+ personas/.test(await rapida.innerText()) && /Hora pico:/.test(await rapida.innerText()), `La ficha del repetidor no muestra su zona: ${await rapida.innerText()}`);
    await page.locator("[data-tour=tarjeta-nodo] [data-tour=zona-rapida]").waitFor();
    await foto("ficha-repetidor");
    // Repartir de nuevo solo la del repetidor (500 personas a 3 km)
    await rapida.getByLabel(/Personas alrededor de Repetidor 1/).fill("500");
    await rapida.getByLabel("Radio de la zona").selectOption("3");
    await rapida.getByRole("button", { name: "Repartir de nuevo" }).click();
    await zonas.getByText(/alrededor de Repetidor 1, a 3 km/).waitFor({ timeout: 20000 });
    await esperarRed(page);

    // El punto: la cantidad que se quiera, «Poner y probar», «¿Cuántas aguanta?» y «Llenar hasta el límite» (v12.2)
    if (!(await rapida.count())) await page.locator("[data-tour=lista-piezas]").getByRole("button", { name: /Repetidor 1/ }).first().click();
    await rapida.waitFor();
    await rapida.getByLabel(/Personas alrededor de Repetidor 1/).fill("220");
    await rapida.getByRole("button", { name: /Poner y probar/ }).click();
    await rapida.getByText(/Hora pico: .* · red (estable|lenta|se revienta)/).waitFor({ timeout: 120000 });
    afirmar(/Zona de popularidad · \d{2,3} personas/.test(await rapida.innerText()), `La zona no quedó con ~220 personas: ${await rapida.innerText()}`);
    await rapida.getByRole("button", { name: /¿Cuántas aguanta\?/ }).click();
    const limite = rapida.locator("[data-tour=limite-punto]");
    await limite.waitFor({ timeout: 120000 });
    const tLimite = await limite.innerText();
    afirmar(/Repetidor 1 (aguanta sin demora hasta ~[\d.]+ personas|aguanta más de [\d.]+ personas|no aguanta)|la red no aguanta/.test(tLimite), `El punto no dice cuántas aguanta: ${tLimite}`);
    const bloque = estres.locator("[data-tour=limite-estres]");
    await bloque.waitFor({ timeout: 10000 });
    afirmar(/Límite de Repetidor 1/.test(await bloque.innerText()) && /con el resto de la red como está/.test(await bloque.innerText()), "Falta el límite del punto en la prueba de estrés");
    await bloque.getByRole("img", { name: /Mensajes completos según las personas en Repetidor 1/ }).waitFor({ timeout: 10000 });
    await foto("limite-punto");
    const llenar = rapida.getByRole("button", { name: /Llenar hasta el límite \(/ });
    if (await llenar.count()) {
      await llenar.click();
      await rapida.getByText(/Lo llené con [\d.]+ personas y simulé la hora pico/).waitFor({ timeout: 180000 });
      afirmar(/el punto (estable|lento|se revienta), la red (estable|lenta|se revienta)/.test(await rapida.innerText()), `No cuenta cómo quedó al llenarlo: ${await rapida.innerText()}`);
      await esperarRed(page);
      await foto("llenar-limite");
    }

    // Por chat, como lo pidió el Inge
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByLabel("Pregunta para Melki").fill("Agrégale por cada punto una popularidad de 100 personas y verifica qué tan colapsada estaría la red");
    await page.keyboard.press("Enter");
    await chat.getByText(/puse \d+ personas en 2 zonas/).first().waitFor({ timeout: 30000 });
    await chat.getByText(/Prueba de estrés de la hora pico/).waitFor({ timeout: 150000 });
    await foto("melki-estres");
    await chat.getByLabel("Pregunta para Melki").fill("¿Cuántas personas aguanta el Repetidor 1?");
    await page.keyboard.press("Enter");
    await chat.getByText(/Busco cuántas personas aguanta Repetidor 1/).waitFor({ timeout: 30000 });
    await chat.getByText(/Repetidor 1 (aguanta sin demora hasta ~[\d.]+ personas|aguanta más de|no aguanta)|la red no aguanta/).first().waitFor({ timeout: 150000 });
    await foto("melki-limite");

    // Quitar las zonas
    await zonas.getByRole("button", { name: "Quitar las zonas" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".pieza.poblada").length === 0, null, { timeout: 15000 });
    await esperarRed(page);
    afirmar((await cifra(page, "conectados de 3")) === "2", "Al quitar las zonas vuelve la red del ejemplo");
    afirmar(segZonas < 60, `Poner y simular las zonas tardó ${segZonas.toFixed(1)} s`);
  },
  { sembrar: true },
);

// Manos libres: micrófono y voz de mentira. window.__voz.decir(texto) «habla» al reconocedor (como Chrome: un parcial
// y luego el final, en un resultado nuevo); lo que Melki dice queda en window.__voz.dicho.
const manosLibresDeMentira = () => {
  const voz = { dicho: [], activo: null, inicios: 0 };
  window.__voz = voz;
  class Reconocedor {
    constructor() {
      this.lang = "";
      this.resultados = [];
    }
    start() {
      voz.activo = this;
      voz.inicios++;
    }
    stop() {
      if (voz.activo === this) voz.activo = null;
      setTimeout(() => this.onend?.(), 30);
    }
    abort() {
      if (voz.activo === this) voz.activo = null;
      this.onend?.();
    }
  }
  Reconocedor.available = async () => "unavailable";
  window.SpeechRecognition = Reconocedor;
  window.webkitSpeechRecognition = Reconocedor;
  voz.decir = (texto) => {
    const r = voz.activo;
    if (!r) return false;
    const i = r.resultados.length;
    r.resultados.push({ isFinal: false, 0: { transcript: texto.split(" ").slice(0, 2).join(" ") } });
    r.onresult?.({ resultIndex: i, results: [...r.resultados] });
    setTimeout(() => {
      r.resultados[i] = { isFinal: true, 0: { transcript: texto } };
      r.onresult?.({ resultIndex: i, results: [...r.resultados] });
    }, 150);
    return true;
  };
  // El navegador corta la escucha de vez en cuando
  voz.cortar = () => {
    const r = voz.activo;
    voz.activo = null;
    r?.onend?.();
  };
  let cola = [];
  let sonando = false;
  const siguiente = () => {
    const u = cola[0];
    if (!u) {
      sonando = false;
      return;
    }
    sonando = true;
    setTimeout(() => {
      if (cola[0] !== u) return;
      cola.shift();
      u.onend?.();
      siguiente();
    }, 120 + u.text.length * 2);
  };
  const sintesis = {
    get speaking() {
      return sonando;
    },
    getVoices: () => [],
    speak(u) {
      voz.dicho.push(u.text);
      cola.push(u);
      if (!sonando) siguiente();
    },
    cancel() {
      const c = cola;
      cola = [];
      sonando = false;
      c.forEach((u) => u.onerror?.({ error: "interrupted" }));
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: sintesis, configurable: true });
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
};

await flujo(
  "manos-libres",
  async (page, foto) => {
    await esperarSimulacion(page);
    const panel = page.locator("[data-tour=panel-izquierdo]");
    // Panel izquierdo plegable: el botón junto a «Modo avanzado» lo oculta y el de la barra de arriba lo devuelve
    await page.getByRole("button", { name: "Ocultar el panel izquierdo" }).click();
    await panel.waitFor({ state: "hidden" });
    await foto("panel-plegado");
    await page.getByRole("button", { name: "Mostrar el panel izquierdo" }).click();
    await panel.waitFor({ state: "visible" });

    const hud = page.locator("[data-tour=hud-voz]");
    const estadoHud = () => hud.getAttribute("data-estado");
    const esperarEstado = (re, timeout = 20000) =>
      page.waitForFunction((s) => new RegExp(s).test(document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") ?? ""), re.source, { timeout });
    const decir = async (texto) => afirmar(await page.evaluate((x) => window.__voz.decir(x), texto), `El micrófono no estaba escuchando al decir «${texto}»`);
    const dicho = () => page.evaluate(() => window.__voz.dicho.join(" | "));
    // Como una persona: deja una pausa después de que Melki termina de hablar (lo que llega enseguida se toma como eco)
    const callado = async () => {
      await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 20000 });
      await page.waitForTimeout(900);
    };

    // Activar: saluda (en voz alta) y espera su nombre
    await page.getByRole("button", { name: "Activar manos libres" }).click();
    await hud.waitFor();
    await esperarEstado(/^esperando$/);
    await callado();
    afirmar(/Modo manos libres activo/.test(await dicho()), `No saludó en voz alta: ${await dicho()}`);
    afirmar((await page.getByRole("button", { name: "Apagar manos libres" }).first().getAttribute("aria-pressed")) === "true", "El botón de la barra debería quedar encendido");
    await foto("activo");

    // Sin su nombre no hace nada
    const nodos = await nodosEnLista(page);
    await decir("inscribe un nodo antena en 4.3, -73.4");
    await page.waitForTimeout(1500);
    afirmar((await nodosEnLista(page)) === nodos && (await estadoHud()) === "esperando", "Sin «Melki» no debería hacer nada");

    // Con su nombre y los números en palabras: lo hace y lo dice
    await decir("Hola Melki, inscribe un nodo antena en cuatro punto dos cinco, menos setenta y tres punto tres cero");
    await page.waitForFunction((n) => document.querySelectorAll("[data-tour=lista-antenas] > li").length === n + 1, nodos, { timeout: 20000 });
    await page.waitForFunction(() => /inscribí el nodo antena/.test(window.__voz.dicho.join(" ")), null, { timeout: 20000 });
    await foto("orden-por-voz");
    await esperarSimulacion(page);
    await esperarEstado(/^(atento|esperando)$/);
    await callado();

    // Lo que empieza a oírse mientras Melki habla es su propia voz (eco): no lo toma como pedido
    await decir("Hola Melki, ¿qué puedes hacer?");
    await esperarEstado(/^hablando$/);
    await decir("Hola Melki, inscribe un nodo antena en 4.3, -73.4");
    await esperarEstado(/^(atento|esperando)$/);
    await callado();
    afirmar((await nodosEnLista(page)) === nodos + 1, "No debería tomar como pedido lo que se oyó mientras hablaba");
    afirmar(/Le dejé el detalle escrito/.test(await dicho()), "La respuesta larga debería ir resumida en voz");

    // Seguir la conversación sin repetir el nombre: «más detalle» y «sí, hazlo» (el botón «Ver los tours guiados»)
    await decir("más detalle");
    await page.waitForFunction(() => /para el Chocó/.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    await esperarEstado(/^atento$/);
    await callado();
    await decir("sí, hazlo");
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByText("¿Qué tour quiere hacer?", { exact: false }).last().waitFor({ timeout: 15000 });
    afirmar((await chat.locator("[title='Dicho por voz']").count()) >= 3, "Los pedidos por voz deberían quedar marcados en la conversación");
    await foto("conversacion");
    await page.getByRole("button", { name: "Cerrar conversación" }).click();
    await esperarEstado(/^(atento|esperando)$/);
    await callado();

    // Pantalla limpia por voz y de vuelta
    await decir("Oye Melki, pantalla limpia");
    await panel.waitFor({ state: "hidden", timeout: 15000 });
    await page.locator("aside[aria-label=Resultados]").waitFor({ state: "hidden", timeout: 15000 });
    await callado();
    await foto("pantalla-limpia");
    // El navegador corta la escucha: se vuelve a encender sola
    const inicios = await page.evaluate(() => window.__voz.inicios);
    await page.evaluate(() => window.__voz.cortar());
    await page.waitForFunction((n) => window.__voz.inicios > n && window.__voz.activo, inicios, { timeout: 10000 });
    await esperarEstado(/^(atento|esperando)$/);
    await decir("Hey Melki, muestra los paneles");
    await panel.waitFor({ state: "visible", timeout: 15000 });
    await page.locator("aside[aria-label=Resultados]").waitFor({ state: "visible", timeout: 15000 });
    await callado();

    // «Deja de escuchar»: se despide y se apaga
    await decir("Melki, deja de escuchar");
    await hud.waitFor({ state: "detached", timeout: 15000 });
    afirmar(/dejo de escuchar/.test(await dicho()), "Debería despedirse");
    afirmar((await page.getByRole("button", { name: "Activar manos libres" }).first().getAttribute("aria-pressed")) === "false", "El botón de la barra debería quedar apagado");
    afirmar(!(await page.evaluate(() => window.__voz.activo)), "El micrófono debería quedar apagado");
  },
  { preparar: (page) => page.addInitScript(manosLibresDeMentira) },
);

await flujo(
  "manos-libres-celular",
  async (page, foto) => {
    await page.locator("[data-tour=mapa]").waitFor();
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !document.querySelector("[role=progressbar]"), null, { timeout: 90000 });
    await page.getByRole("button", { name: "Activar manos libres" }).click();
    const hud = page.locator("[data-tour=hud-voz]");
    await hud.waitFor();
    await page.waitForFunction(() => document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") === "esperando", null, { timeout: 20000 });
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    afirmar(ancho <= 390, `La página no debe desbordarse a lo ancho (${ancho})`);
    const b = await hud.boundingBox();
    afirmar(b.x >= 0 && b.x + b.width <= 390, "La barra de voz debe caber en la pantalla");
    await foto("hud");
    await page.getByRole("button", { name: "Apagar manos libres" }).first().click();
    await hud.waitFor({ state: "detached" });
  },
  { tamano: { width: 390, height: 844 }, preparar: (page) => page.addInitScript(manosLibresDeMentira) },
);

let fallos = 0;
for (const r of resultados) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.nombre}${r.ok ? "" : ` — ${r.error}`}`);
  for (const a of r.avisos.slice(0, 5)) console.log(`    aviso: ${a}`);
  if (!r.ok) fallos++;
}
await navegador.close();
process.exit(fallos ? 1 : 0);
