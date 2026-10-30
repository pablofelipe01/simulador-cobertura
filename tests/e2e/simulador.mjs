// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Pruebas de extremo a extremo del simulador. Uso: node tests/e2e/simulador.mjs <carpeta-de-capturas>
// Navegador: Microsoft Edge instalado (Windows) o el ejecutable indicado en CHROME_PATH.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

import { desviarTeselas } from "./teselas-prueba.mjs";
import { iniciarIADeMentira } from "./ia-de-mentira.mjs";

const [, , salida = "dist/e2e"] = process.argv;
fs.mkdirSync(salida, { recursive: true });
const base = process.env.BASE ?? "http://localhost:3000/";
const navegador = await chromium.launch(
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-background-networking", "--autoplay-policy=no-user-gesture-required"] }
    : { channel: "msedge" },
);
const resultados = [];
const afirmar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};

// `hablar`: la voz de Melki encendida desde el principio (lo normal es que no hable: escucha, hace lo que se le pide y
// responde por escrito); las pruebas de la voz, del eco y de la IA con voz la encienden así.
async function flujo(nombre, fn, { tamano = { width: 1440, height: 900 }, conMelki = false, sembrar = false, hablar = false, preparar } = {}) {
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
  if (hablar)
    await page.addInitScript(() => {
      window.__melkiPruebas = { voz: true };
    });
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
/** Con parlantes el micrófono queda en pausa mientras Melki habla: espera a que calle y vuelva a escuchar. */
const escuchaTrasHablar = async (page, timeout = 20000) => {
  await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout });
  await page.waitForFunction(() => Boolean(window.__voz.activo), null, { timeout: 5000 }).catch(() => {});
  return page.evaluate(() => Boolean(window.__voz.activo));
};

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
  // Autoría y licencia: metadatos de la página y «Archivo → Acerca del simulador y licencia»
  afirmar((await page.locator('meta[name="author"]').getAttribute("content")) === "Giancarlo González Guerrero", "Falta el autor en los metadatos");
  afirmar(/Todos los derechos reservados/.test((await page.locator('meta[name="copyright"]').getAttribute("content")) ?? ""), "Falta el copyright en los metadatos");
  await page.getByRole("button", { name: /^Archivo/ }).click();
  await page.getByRole("menuitem", { name: /Acerca del simulador y licencia/ }).click();
  const acerca = page.getByRole("dialog", { name: "Acerca del simulador" });
  await acerca.waitFor();
  const aviso = await acerca.innerText();
  afirmar(
    /© 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero/.test(aviso) && /Creado por Giancarlo González Guerrero para el Ingeniero Pablo Felipe Acevedo y la empresa Melki, con ayuda de inteligencia artificial/.test(aviso) && /titulares de los derechos patrimoniales/.test(aviso) && /Prohibido usar, copiar/.test(aviso),
    `El aviso de autoría no está completo: ${aviso.slice(0, 300)}`,
  );
  await acerca.getByText("Fundamento legal en Colombia").click();
  await acerca.getByText(/Decisión Andina 351 de 1993/).waitFor();
  await foto("acerca");
  await page.keyboard.press("Escape");
  await acerca.waitFor({ state: "detached" });
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
/**
 * v13.4: ¿la nube es holográfica? Translúcida (ningún tono de su fondo pasa del 60 % de opacidad), con lo de atrás
 * desenfocado y oscurecido un poco (se ve la simulación, pero el texto se lee) y el texto claro.
 */
const estiloHolo = (nube) =>
  nube.evaluate((el) => {
    const s = getComputedStyle(el);
    const filtro = s.backdropFilter || s.webkitBackdropFilter || "";
    const alfas = [...s.backgroundImage.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((x) => Number(x[1]));
    const [r, g, b] = (s.color.match(/[\d.]+/g) ?? []).map(Number);
    const luz = Math.round(((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100) / 100;
    const alfaMax = alfas.length ? Math.max(...alfas) : 1;
    const clase = el.classList.contains("nube-holo");
    return { filtro, alfaMax, color: s.color, luz, clase, ok: clase && /blur/.test(filtro) && /brightness/.test(filtro) && alfaMax <= 0.6 && luz > 0.8 };
  });
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
    await chat.getByText(/fui diseñado y creado para cumplir órdenes y procesos dentro de este simulador/).waitFor({ timeout: 10000 });
    await decir("agrega un dron a la malla");
    await chat.getByText(/no logré convertirlo en una orden/).waitFor({ timeout: 10000 });
    // Una red sostenible y viable en un municipio, con su costo (los precios de Trama)
    await decir("hazme una red sostenible económica y técnicamente viable en Barranca de Upía de 3.000 hectáreas");
    await chat.getByText(/^Diseño la malla para 3\.000 ha \(30 km²\) en Barranca de Upía/).waitFor({ timeout: 20000 });
    await chat.getByText(/Viabilidad de la red:/).waitFor({ timeout: 240000 });
    const sostenible = await chat.locator("[data-mensaje]").last().innerText();
    // La red que ya había (11.226 ha en otro sitio) no entra: la de Barranca de Upía lleva su propio gateway
    afirmar(
      /^Listo: la malla cubre el [\d,]+ % de las 3\.000 ha/.test(sostenible) && /Puse el gateway «[^»]+» en [\d.,-]+, [\d.,-]+, en Barranca de Upía/.test(sostenible) && /Técnica: /.test(sostenible) && /Inversión: unos \$[^:]*: el sitio del gateway /.test(sostenible) && /energía solar/.test(sostenible),
      `Red sostenible: ${sostenible.slice(0, 400)}`,
    );
    await decir("¿cuánto cuesta la red?");
    await chat.getByText(/^La red del mapa \(/).waitFor({ timeout: 10000 });
    await foto("sostenible");
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

// v12.9: el protocolo en los parámetros (MeshCore o Meshtastic, con los clientes que repiten o mudos)
await flujo("protocolo", async (page, foto) => {
  await esperarSimulacion(page);
  await page.getByRole("tab", { name: "Parámetros" }).click();
  const radio = page.locator("[data-tour=radio]");
  const proto = radio.getByRole("radiogroup", { name: "Protocolo de la malla" });
  afirmar((await proto.getByRole("radio", { name: "MeshCore" }).getAttribute("aria-checked")) === "true", "Debería abrir en MeshCore");
  await proto.getByRole("radio", { name: "Meshtastic" }).click();
  await radio.getByText("Ajuste de radio Meshtastic").waitFor();
  const opciones = await radio.locator("select").first().locator("option").allInnerTexts();
  afirmar(opciones.length === 6 && opciones.every((o) => /^Meshtastic /.test(o)) && (await radio.locator("select").first().inputValue()) === "MT_LONG_FAST", `Los ajustes deberían ser los de Meshtastic: ${opciones.join(" | ")}`);
  await radio.getByText(/Inundación administrada/).first().waitFor();
  await radio.getByText("Los equipos de las personas repiten (CLIENT)").waitFor();
  const saltos = radio.getByLabel("Límite de saltos");
  await saltos.fill("9");
  afirmar((await saltos.getAttribute("aria-invalid")) === "true", "En Meshtastic el límite de saltos no pasa de 7");
  await saltos.fill("3");
  await saltos.blur();
  await page.waitForTimeout(900);
  await esperarSimulacion(page);
  await foto("meshtastic");
  await proto.getByRole("radio", { name: "MeshCore" }).click();
  await radio.getByText("Ajuste de radio MeshCore").waitFor();
  afirmar((await radio.locator("select").first().inputValue()) === "SF11_250", "Al volver a MeshCore queda el SF11 de Trama");
  afirmar(!(await radio.getByText("Los equipos de las personas repiten (CLIENT)").count()), "En MeshCore no se ofrece el rol de los clientes");
});

// v12.9: persona por persona (contorno de color en el mapa), lo medido en el gateway y optimizar la red para la carga
await flujo(
  "usuarios-y-optimizar",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    const resultados = page.locator("aside[aria-label=Resultados]");
    const zonas = resultados.locator("[data-tour=zonas-popularidad]");
    await zonas.getByRole("button", { name: "150", exact: true }).click();
    await zonas.getByRole("button", { name: /^Poner 150 en cada uno \(300\)/ }).click();
    await zonas.getByText(/Puse \d+ personas/).waitFor({ timeout: 20000 });
    await esperarRed(page);
    const estres = resultados.locator("[data-tour=prueba-estres]");
    // Diez veces la hora pico: la red se carga y hay a quién no le funciona
    await estres.getByRole("radiogroup", { name: "Multiplicar la carga" }).getByRole("radio", { name: "×10" }).click();
    await estres.getByRole("button", { name: /^Probar la hora pico/ }).click();
    const res = estres.locator("[data-tour=resultado-estres]");
    await res.getByText(/% de los mensajes de la hora pico con respuesta/).waitFor({ timeout: 120000 });
    const bloque = res.locator("[data-tour=usuarios-estres]");
    await bloque.waitFor();
    const tb = await bloque.innerText();
    afirmar(/Persona por persona: a [\d.]+ de [\d.]+ les funciona \(\d+ %\)/.test(tb) && /Por qué:/.test(tb), `Falta persona por persona: ${tb.slice(0, 300)}`);
    // En el mapa, cada persona con el color de su estado en el contorno, y la leyenda con los estados
    await page.waitForFunction(() => document.querySelectorAll(".marcador-raiz.con-usuario").length > 100, null, { timeout: 15000 });
    const colores = await page.evaluate(() => [...new Set([...document.querySelectorAll(".marcador-raiz.con-usuario")].map((e) => e.style.getPropertyValue("--usuario")))]);
    afirmar(colores.length >= 1 && colores.every((c) => /^#[0-9A-F]{6}$/i.test(c)), `Los contornos no tienen color: ${colores.join(", ")}`);
    const leyenda = page.locator("[data-tour=leyenda-usuarios]");
    await leyenda.waitFor();
    afirmar(/Le funciona bien/.test(await leyenda.innerText()) && /No le funciona/.test(await leyenda.innerText()), "Falta la leyenda de los estados de las personas");
    await bloque.scrollIntoViewIfNeeded();
    await foto("persona-por-persona");
    // Optimizar para esta carga: propuestas con su antes y después, aplicar y deshacer
    const opt = res.locator("[data-tour=optimizar]");
    await opt.getByRole("button", { name: /^Optimizar$/ }).click();
    await opt.getByText(/Con esta carga le funciona a/).waitFor({ timeout: 180000 });
    const to = await opt.innerText();
    afirmar(/atendidas/.test(to) && /Antes: .* Después: /.test(to), `La optimización no trae propuestas con antes y después: ${to.slice(0, 500)}`);
    await opt.scrollIntoViewIfNeeded();
    await foto("optimizar");
    const aplicar = opt.getByRole("button", { name: /^Aplicar (al mapa|todo junto)$/ }).first();
    if (await aplicar.count()) {
      const antes = await page.locator(".marcador-raiz").count();
      await aplicar.click();
      await opt.getByText(/Apliqué «/).waitFor({ timeout: 30000 });
      await res.getByText(/% de los mensajes de la hora pico con respuesta/).waitFor({ timeout: 180000 });
      await opt.getByRole("button", { name: "Deshacer" }).waitFor();
      await foto("optimizar-aplicada");
      await opt.getByRole("button", { name: "Deshacer" }).click();
      await page.waitForFunction((n) => document.querySelectorAll(".marcador-raiz").length === n, antes, { timeout: 15000 });
    }
    // Lo medido en el gateway: atiende de a uno
    await estres.getByRole("radiogroup", { name: "Tráfico de la prueba" }).getByRole("radio", { name: /^Medido en / }).click();
    await estres.getByRole("radiogroup", { name: "Multiplicar la carga" }).getByRole("radio", { name: "×1", exact: true }).click();
    afirmar((await estres.getByRole("radiogroup", { name: "Curva de entrega por enlace" }).getByRole("radio", { name: "Medidos en campo" }).getAttribute("aria-checked")) === "true", "Con lo medido, los enlaces son los medidos en campo");
    await estres.getByRole("button", { name: /^Probar la hora pico/ }).click();
    await res.getByText(/El gateway atiende de a uno/).waitFor({ timeout: 120000 });
    await foto("medido");
    // Por chat: a quién no le funciona, y Meshtastic
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByLabel("Pregunta para Melki").fill("¿qué usuarios no funcionan?");
    await page.keyboard.press("Enter");
    await chat.getByText(/les funciona \(\d+ %\)/).first().waitFor({ timeout: 60000 });
    await chat.getByLabel("Pregunta para Melki").fill("cambia a Meshtastic");
    await page.keyboard.press("Enter");
    await chat.getByText(/Cambié el protocolo a Meshtastic/).first().waitFor({ timeout: 30000 });
    await esperarRed(page);
    await estres.getByRole("button", { name: /^Probar la hora pico/ }).click();
    await res.getByText(/Protocolo Meshtastic|Meshtastic paquete por paquete|inundación administrada/).first().waitFor({ timeout: 180000 });
    await foto("meshtastic-estres");
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
// y luego el final, en un resultado nuevo); lo que Melki dice queda en window.__voz.dicho. Para probar lo que pasa con
// parlantes y navegadores de verdad: `eco` hace que el reconocedor oiga lo que Melki dice («durante»: empieza a oírlo
// mientras habla; «tarde»: lo oye 1,3 s después; «muy-tarde»: 3,2 s después), `duplicar` manda dos veces cada frase y
// `cortarTrasSilencio` (ms) corta la escucha tras ese silencio, como Edge.
const manosLibresDeMentira = () => {
  const voz = { dicho: [], activo: null, inicios: 0, cortes: 0, eco: null, duplicar: false, cortarTrasSilencio: 0, ultimoSonido: Date.now() };
  window.__voz = voz;
  class Reconocedor {
    constructor() {
      this.lang = "";
      this.resultados = [];
    }
    start() {
      voz.activo = this;
      voz.inicios++;
      voz.ultimoSonido = Date.now();
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
  const empezar = (r, texto) => {
    const i = r.resultados.length;
    r.resultados.push({ isFinal: false, 0: { transcript: texto } });
    r.onresult?.({ resultIndex: i, results: [...r.resultados] });
    return i;
  };
  const confirmar = (r, i, texto) => {
    r.resultados[i] = { isFinal: true, 0: { transcript: texto } };
    r.onresult?.({ resultIndex: i, results: [...r.resultados] });
  };
  voz.decir = (texto) => {
    const r = voz.activo;
    if (!r) return false;
    voz.ultimoSonido = Date.now();
    const i = empezar(r, texto.split(" ").slice(0, 2).join(" "));
    setTimeout(() => {
      confirmar(r, i, texto);
      // Algunos navegadores mandan la misma frase otra vez, en un resultado nuevo
      if (voz.duplicar) setTimeout(() => voz.activo === r && confirmar(r, r.resultados.length, texto), 120);
    }, 150);
    return true;
  };
  // Con parlantes, el micrófono oye a Melki: empieza a oírlo mientras habla, o lo oye tarde
  const ecoDe = (u) => u.text.replace(/[«»"]/g, "");
  const empiezaEco = (u) => {
    if (voz.eco !== "durante") return;
    setTimeout(() => {
      const r = voz.activo;
      if (!r || !sonando) return;
      voz.ultimoSonido = Date.now();
      u.eco = { r, i: empezar(r, ecoDe(u).split(" ").slice(0, 3).join(" ")) };
    }, 60);
  };
  const terminaEco = (u) => {
    if (!voz.eco) return;
    setTimeout(
      () => {
        const r = voz.activo;
        if (!r) return;
        voz.ultimoSonido = Date.now();
        if (u.eco?.r === r) confirmar(r, u.eco.i, ecoDe(u));
        else confirmar(r, empezar(r, ecoDe(u)), ecoDe(u));
      },
      voz.eco === "durante" ? 400 : voz.eco === "tarde" ? 1300 : 3200,
    );
  };
  // Como Edge: tras unos segundos sin oír nada, deja de escuchar por su cuenta
  setInterval(() => {
    const r = voz.activo;
    if (!voz.cortarTrasSilencio || !r || Date.now() - voz.ultimoSonido < voz.cortarTrasSilencio) return;
    voz.activo = null;
    voz.cortes++;
    r.onend?.();
  }, 100);
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
    voz.alSonar?.();
    empiezaEco(u);
    setTimeout(() => {
      if (cola[0] !== u) return;
      voz.alSonar?.();
      cola.shift();
      terminaEco(u);
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

    // Activar: saluda como un mayordomo, deja el mapa libre (oculta los dos paneles) y espera su nombre
    const resultados = page.locator("aside[aria-label=Resultados]");
    const sinProgreso = () => page.waitForFunction(() => !document.querySelector("[role=progressbar]"), null, { timeout: 90000 });
    await page.getByRole("button", { name: "Activar el Asistente Melki" }).first().click();
    await hud.waitFor();
    await esperarEstado(/^esperando$/);
    await callado();
    afirmar(/Hola, señor\. Bienvenido\./.test(await dicho()) && /presto a seguir sus órdenes/.test(await dicho()), `No saludó en voz alta: ${await dicho()}`);
    afirmar((await page.getByRole("button", { name: "Apagar el Asistente Melki" }).first().getAttribute("aria-pressed")) === "true", "El botón de la barra debería quedar encendido");
    await panel.waitFor({ state: "hidden", timeout: 5000 });
    await resultados.waitFor({ state: "hidden", timeout: 5000 });
    afirmar(/Asistente Melki/.test(await hud.innerText()), "La barra debería llamarse «Asistente Melki»");
    for (const s of ["Mostrar resultados", "Mostrar herramientas", "¿Qué hago ahora?", "¿Qué puedo decir?"])
      afirmar(await hud.getByRole("button", { name: s }).isVisible(), `Falta la sugerencia «${s}» en la barra`);
    await foto("activo");

    // Sin su nombre no hace nada
    const nodos = await nodosEnLista(page);
    await decir("inscribe un nodo antena en 4.3, -73.4");
    await page.waitForTimeout(1500);
    afirmar((await nodosEnLista(page)) === nodos && (await estadoHud()) === "esperando", "Sin «Melki» no debería hacer nada");

    // Solo su nombre: contesta como un mayordomo y queda atento (también «Hello Melky», como lo escribe el reconocimiento)
    await decir("Hola Melki");
    await page.waitForFunction(() => /Hola, mi señor\. Le escucho; estoy atento y presto a seguir sus órdenes\./.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    await esperarEstado(/^atento$/);
    await callado();
    await decir("Hello Melky");
    await page.waitForFunction(() => /Hello, sir\. Le escucho/.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    await callado();

    // Con su nombre y los números en palabras: lo hace, lo dice y, con el panel oculto, ofrece mostrar las herramientas
    await decir("Hola Melki, inscribe un nodo antena en cuatro punto dos cinco, menos setenta y tres punto tres cero");
    await page.waitForFunction((n) => document.querySelectorAll("[data-tour=lista-antenas] > li").length === n + 1, nodos, { timeout: 20000 });
    await page.waitForFunction(() => /inscribí el nodo antena/.test(window.__voz.dicho.join(" ")), null, { timeout: 20000 });
    await page.waitForFunction(() => /le muestro el panel de herramientas, señor\?/.test(window.__voz.dicho.join(" ")), null, { timeout: 20000 });
    await foto("orden-por-voz");
    await sinProgreso();
    await esperarEstado(/^(atento|esperando)$/);
    await callado();

    // Con parlantes (lo de siempre), mientras Melki habla el micrófono queda en pausa: lo que suena es su propia voz y no
    // lo toma como pedido. Vuelve a escuchar un instante después de callar.
    await decir("Hola Melki, ¿qué puedes hacer?");
    await esperarEstado(/^hablando$/);
    await page.waitForFunction(() => !window.__voz.activo, null, { timeout: 3000 });
    afirmar(!(await page.evaluate(() => window.__voz.decir("Hola Melki, inscribe un nodo antena en 4.3, -73.4"))), "Con parlantes no debería escuchar mientras habla");
    afirmar(/con parlantes no le oigo/i.test((await hud.getByRole("button", { name: "Callar a Melki" }).first().getAttribute("title")) ?? ""), "El botón ■ debería explicar que con parlantes se calla con él");
    await esperarEstado(/^(atento|esperando)$/);
    await callado();
    await page.waitForFunction(() => Boolean(window.__voz.activo), null, { timeout: 3000 });
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

    // Mientras espera su nombre la barra se achica sola: se agranda con su botón
    const agrandar = hud.getByRole("button", { name: "Agrandar la barra del asistente" });
    if (await agrandar.count()) await agrandar.click();
    // La sugerencia de la barra muestra el panel de resultados y lo confirma
    await hud.getByRole("button", { name: "Mostrar resultados" }).click();
    await resultados.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => /Aquí tiene el panel de resultados/.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    afirmar((await hud.getByRole("button", { name: "Mostrar resultados" }).count()) === 0, "Con el panel abierto ya no se sugiere");
    await callado();

    // Pantalla limpia por voz y de vuelta
    await decir("Oye Melki, pantalla limpia");
    await panel.waitFor({ state: "hidden", timeout: 15000 });
    await resultados.waitFor({ state: "hidden", timeout: 15000 });
    await callado();
    await foto("pantalla-limpia");
    // El navegador corta la escucha: se vuelve a encender sola
    const inicios = await page.evaluate(() => window.__voz.inicios);
    await page.evaluate(() => window.__voz.cortar());
    await page.waitForFunction((n) => window.__voz.inicios > n && window.__voz.activo, inicios, { timeout: 10000 });
    await esperarEstado(/^(atento|esperando)$/);
    await decir("Hey Melki, muestra los paneles");
    await panel.waitFor({ state: "visible", timeout: 15000 });
    await resultados.waitFor({ state: "visible", timeout: 15000 });
    await callado();
    await decir("Oye Melki, pantalla limpia");
    await resultados.waitFor({ state: "hidden", timeout: 15000 });
    await callado();

    // «Deja de escuchar»: se despide, queda en reposo (atento solo a su nombre) y devuelve los paneles que estaban abiertos
    await decir("Melki, deja de escuchar");
    await hud.waitFor({ state: "detached", timeout: 15000 });
    afirmar(/Con su permiso, señor\. Quedo en reposo/.test(await dicho()), "Debería despedirse y quedar en reposo");
    afirmar((await page.getByRole("button", { name: "Activar el Asistente Melki" }).first().getAttribute("aria-pressed")) === "false", "El botón de la barra debería quedar apagado");
    afirmar(await escuchaTrasHablar(page), "En reposo el micrófono sigue escuchando su nombre");
    await page.locator("[data-tour=melki-reposo]").waitFor({ timeout: 5000 });
    await panel.waitFor({ state: "visible", timeout: 5000 });
    await resultados.waitFor({ state: "visible", timeout: 5000 });
    // «Apaga el micrófono»: deja de escuchar del todo
    await page.waitForTimeout(1200);
    await decir("Melki, apaga el micrófono");
    await page.waitForFunction(() => /Apago el micrófono/.test(window.__voz.dicho.join(" ")) && !window.__voz.activo, null, { timeout: 15000 });
    await page.locator("[data-tour=melki-reposo]").waitFor({ state: "detached", timeout: 5000 });
    await hud.waitFor({ state: "detached", timeout: 15000 });
  },
  { hablar: true, preparar: (page) => page.addInitScript(manosLibresDeMentira) },
);

await flujo(
  "manos-libres-celular",
  async (page, foto) => {
    await page.locator("[data-tour=mapa]").waitFor();
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !document.querySelector("[role=progressbar]"), null, { timeout: 90000 });
    await page.getByRole("button", { name: "Activar el Asistente Melki" }).first().click();
    const hud = page.locator("[data-tour=hud-voz]");
    await hud.waitFor();
    await page.waitForFunction(() => document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") === "esperando", null, { timeout: 20000 });
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    afirmar(ancho <= 390, `La página no debe desbordarse a lo ancho (${ancho})`);
    const b = await hud.boundingBox();
    afirmar(b.x >= 0 && b.x + b.width <= 390, "La barra de voz debe caber en la pantalla");
    await foto("hud");
    // En el celular no hay paneles a los lados: la barra solo sugiere «¿Qué hago ahora?» y la ayuda
    afirmar((await hud.getByRole("button", { name: "Mostrar resultados" }).count()) === 0, "En el celular no se sugieren paneles");
    await page.getByRole("button", { name: "Apagar el Asistente Melki" }).first().click();
    await hud.waitFor({ state: "detached" });
  },
  { tamano: { width: 390, height: 844 }, hablar: true, preparar: (page) => page.addInitScript(manosLibresDeMentira) },
);

// Escucha en reposo, como Siri: con el micrófono ya permitido, Melki oye su nombre sin tocar el botón; la barra se mueve
// y se achica; lo que se sale del simulador lo dice con respeto; «deja de escuchar» vuelve al reposo.
await flujo(
  "asistente-en-reposo",
  async (page, foto) => {
    await esperarSimulacion(page);
    const hud = page.locator("[data-tour=hud-voz]");
    const panel = page.locator("[data-tour=panel-izquierdo]");
    const decir = async (texto) => afirmar(await page.evaluate((x) => window.__voz.decir(x), texto), `El micrófono no estaba escuchando al decir «${texto}»`);
    const dicho = () => page.evaluate(() => window.__voz.dicho.join(" | "));
    const callado = async () => {
      await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 20000 });
      await page.waitForTimeout(900);
    };
    // Al abrir queda en reposo: escucha, sin barra y con los paneles como estaban
    await page.locator("[data-tour=melki-reposo]").waitFor({ timeout: 15000 });
    afirmar(await page.evaluate(() => Boolean(window.__voz.activo)), "En reposo debería estar escuchando");
    afirmar((await hud.count()) === 0 && (await panel.isVisible()), "En reposo no hay barra y los paneles siguen igual");
    // Sin su nombre no pasa nada
    await decir("pon un repetidor en el norte");
    await page.waitForTimeout(1500);
    afirmar((await hud.count()) === 0, "Sin su nombre no se activa");
    // «Hey Melki, …»: se activa solo (sin tocar el botón) y hace el pedido
    await decir("Hey Melki, llévame a Villavicencio");
    await hud.waitFor({ timeout: 10000 });
    await page.waitForFunction(() => /Villavicencio/.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    afirmar((await page.getByRole("button", { name: "Apagar el Asistente Melki" }).first().getAttribute("aria-pressed")) === "true", "El botón de arriba debería quedar encendido");
    await panel.waitFor({ state: "hidden", timeout: 5000 });
    await callado();
    await foto("despierto");
    // (v13.4: con la voz encendida Melki lo dice al llegar volando; Esc lo devuelve a su esquina, así su nube no tapa la
    // barra que se va a mover; si la barra ya se achicó sola esperando su nombre, se agranda)
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await page.keyboard.press("Escape");
    await page.locator("[data-tour=llegada-melki]").waitFor({ state: "detached", timeout: 15000 });
    const agrandarAntes = hud.getByRole("button", { name: "Agrandar la barra del asistente" });
    if (await agrandarAntes.count()) await agrandarAntes.click();
    // La barra se arrastra a otra parte del mapa, se achica y se agranda
    const antes = await hud.boundingBox();
    await page.mouse.move(antes.x + 70, antes.y + 16);
    await page.mouse.down();
    await page.mouse.move(antes.x - 200, antes.y + 260, { steps: 8 });
    await page.mouse.up();
    const despues = await hud.boundingBox();
    afirmar(Math.abs(despues.x - (antes.x - 270)) < 12 && Math.abs(despues.y - (antes.y + 244)) < 12, `La barra debería moverse (de ${Math.round(antes.x)},${Math.round(antes.y)} a ${Math.round(despues.x)},${Math.round(despues.y)})`);
    afirmar(await page.evaluate(() => Boolean(JSON.parse(localStorage.getItem("simulador-cobertura-melki-hud") ?? "{}").pos)), "Debería recordar dónde quedó");
    await hud.getByRole("button", { name: "Achicar la barra del asistente" }).click();
    afirmar((await hud.getAttribute("data-forma")) === "pequena", "Debería quedar pequeña");
    await foto("pequena");
    await hud.getByRole("button", { name: "Agrandar la barra del asistente" }).click();
    afirmar((await hud.getAttribute("data-forma")) === "completa", "Debería volver a su tamaño");
    // Lo que se sale del simulador lo dice con respeto y retoma el trabajo
    await decir("Melki, ¿quién ganó el partido de fútbol?");
    await page.waitForFunction(() => /fui diseñado y creado para cumplir órdenes y procesos dentro de este simulador/.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    await callado();
    // «Deja de escuchar»: vuelve al reposo, devuelve los paneles y sigue atento a su nombre
    await decir("Melki, deja de escuchar");
    await hud.waitFor({ state: "detached", timeout: 15000 });
    await panel.waitFor({ state: "visible", timeout: 5000 });
    afirmar(/Quedo en reposo/.test(await dicho()) && (await escuchaTrasHablar(page)), "Debería quedar en reposo escuchando");
    await page.waitForTimeout(1500);
    // Solo su nombre: se activa y contesta como un mayordomo
    await decir("Hola Melki");
    await hud.waitFor({ timeout: 10000 });
    await page.waitForFunction(() => /Hola, mi señor\. Le escucho; estoy atento y presto a seguir sus órdenes/.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    await callado();
    await foto("llamado");
    await hud.getByRole("button", { name: "Apagar el Asistente Melki" }).first().click();
    await hud.waitFor({ state: "detached", timeout: 10000 });
    afirmar(await escuchaTrasHablar(page), "La X lo deja en reposo");
  },
  {
    hablar: true,
    preparar: async (page) => {
      await page.addInitScript(manosLibresDeMentira);
      await page.addInitScript(() => {
        const consultar = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) => (d.name === "microphone" ? Promise.resolve({ state: "granted" }) : consultar(d));
      });
    },
  },
);

// v12.7: entiende lugares mal dichos («barranca de UPA meta»), pregunta «¿se refiere a…?» cuando duda, pide repetir lo
// que no entendió, recuerda el lugar de la conversación y arma la red de todo el municipio.
await flujo(
  "asistente-conversacion",
  async (page, foto) => {
    await esperarSimulacion(page);
    const hud = page.locator("[data-tour=hud-voz]");
    const decir = async (texto) => afirmar(await page.evaluate((x) => window.__voz.decir(x), texto), `El micrófono no estaba escuchando al decir «${texto}»`);
    const oido = async (re, timeout = 20000) => {
      try {
        await page.waitForFunction((r) => new RegExp(r).test(window.__voz.dicho.join(" ")), re.source, { timeout });
      } catch {
        throw new Error(`No dijo ${re} · dijo: ${(await page.evaluate(() => window.__voz.dicho.slice(-3).join(" | "))).slice(0, 500)}`);
      }
    };
    const callado = async () => {
      await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 30000 });
      await page.waitForTimeout(900);
    };
    await page.locator("[data-tour=melki-reposo]").waitFor({ timeout: 15000 });
    // Un lugar mal escrito por el dictado: lo entiende, lo lleva y ofrece la red de todo el municipio
    await decir("Hey Melki, ubícame en barranca de UPA meta");
    await hud.waitFor({ timeout: 10000 });
    // (lo dicho en voz alta: «40919 hectáreas», sin las comillas). v13.4: con la voz encendida lo dice Melki al llegar
    // volando, a la par de su nube (y no la respuesta de la conversación antes)
    await oido(/¡Hola, señor! Esto es Barranca de Upía \(Meta\): un municipio de 409\d\d hectáreas/);
    await callado();
    afirmar(!/Lo llevé a Barranca/.test(await page.evaluate(() => window.__voz.dicho.join(" "))), "La respuesta no debería decirse dos veces (antes de llegar y al llegar)");
    await foto("lugar");
    // Si duda, pregunta; «sí» elige la primera opción
    await decir("Melki, ubícame en barranco vía");
    await oido(/No estoy seguro de haber entendido barranco via\. ¿Se refiere a Barranca de Upía \(Meta\)/);
    await callado();
    await decir("Melki, sí");
    await page.waitForFunction(() => window.__voz.dicho.filter((x) => /Esto es Barranca de Upía/.test(x)).length >= 2, null, { timeout: 20000 });
    await callado();
    // Lo que no entiende lo pide de nuevo, con lo que oyó
    await decir("Melki, barranco loco pla xyz");
    await oido(/Discúlpeme, señor, no le entendí bien\. ¿Me lo repite, por favor\?/);
    await callado();
    // «¿Dónde estamos?»: el municipio que se ve
    await decir("Melki, ¿dónde estamos?");
    await oido(/Estamos viendo Barranca de Upía \(Meta\)/);
    await callado();
    // La red de todo el municipio de la conversación (sin repetir el nombre)
    await decir("Melki, ármame una red que cubra todo el municipio");
    await oido(/Diseño la malla para 409\d\d hectáreas \(409 coma \d kilómetros cuadrados\) en todo el municipio de Barranca de Upía \(Meta\)/);
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await page.getByRole("button", { name: /^Abrir a Melki/ }).click();
    await chat.getByText(/^(Listo: la malla cubre|Llegué al)/).waitFor({ timeout: 420000 });
    const final = await chat.locator("[data-mensaje]").filter({ hasText: /Listo: la malla cubre|Llegué al/ }).last().innerText();
    afirmar(/de las 40\.9\d\d ha/.test(final), `Diseño del municipio: ${final.slice(0, 200)}`);
    // El área del diseño lleva el nombre del municipio
    afirmar(await page.evaluate(() => JSON.stringify(localStorage)).then((t) => /Área objetivo · Barranca de Upía \(Meta\)/.test(t)), "El área objetivo debería llamarse como el municipio");
    await foto("municipio");
  },
  {
    hablar: true,
    preparar: async (page) => {
      await page.addInitScript(manosLibresDeMentira);
      await page.addInitScript(() => {
        const consultar = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) => (d.name === "microphone" ? Promise.resolve({ state: "granted" }) : consultar(d));
      });
    },
  },
);

// v12.8: Melki se oye a sí mismo, Edge deja de escuchar tras unos segundos de silencio y el navegador a veces manda dos
// veces la misma frase. Melki no se responde a sí mismo, no entra en bucles, no hace dos veces el mismo pedido y el
// micrófono no se prende y apaga a la vista; el dictado de la caja tampoco se corta solo. (v13.1: con «Uso audífonos»
// escucha mientras habla, así que aquí se prueban los filtros del eco en el caso más difícil; con parlantes, ver
// «voz-con-parlantes».)
await flujo(
  "voz-sin-eco",
  async (page, foto) => {
    await esperarSimulacion(page);
    const hud = page.locator("[data-tour=hud-voz]");
    // Como una persona: habla cuando el micrófono escucha (entre un corte del navegador y la escucha siguiente hay un instante)
    const decir = async (texto) => {
      await page.waitForFunction(() => Boolean(window.__voz.activo), null, { timeout: 3000 }).catch(() => {});
      afirmar(await page.evaluate((x) => window.__voz.decir(x), texto), `El micrófono no estaba escuchando al decir «${texto}»`);
    };
    const veces = (re) => page.evaluate((r) => window.__voz.dicho.filter((x) => new RegExp(r).test(x)).length, re.source);
    const oido = async (re, timeout = 20000) => {
      try {
        await page.waitForFunction((r) => new RegExp(r).test(window.__voz.dicho.join(" ")), re.source, { timeout });
      } catch {
        throw new Error(`No dijo ${re} · dijo: ${(await page.evaluate(() => window.__voz.dicho.slice(-3).join(" | "))).slice(0, 500)}`);
      }
    };
    const callado = async () => {
      await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 30000 });
      await page.waitForTimeout(900);
    };
    // Espera a que pase el eco (el más tardío llega 3,2 s después) y a lo que Melki respondería si lo tomara como pedido
    const sinBucle = async () => {
      await callado();
      await page.waitForTimeout(4500);
      await callado();
    };
    await page.locator("[data-tour=melki-reposo]").waitFor({ timeout: 15000 });
    // Los estados de la barra, para ver que no parpadea
    await page.evaluate(() => {
      window.__estados = [];
      const leer = () => {
        const e = document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") ?? "sin barra";
        if (window.__estados.at(-1) !== e) window.__estados.push(e);
      };
      new MutationObserver(leer).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-estado"] });
    });
    await page.evaluate(() => Object.assign(window.__voz, { eco: "durante", duplicar: true, cortarTrasSilencio: 2500, ultimoSonido: Date.now() }));

    // Con parlantes y frases duplicadas: un solo pedido, una sola respuesta, y no se responde a sí mismo
    await decir("Hey Melki, llévame a Villavicencio");
    await hud.waitFor({ timeout: 10000 });
    // (v13.4: lo dice al llegar volando, a la par de su nube)
    await oido(/Esto es Villavicencio/);
    await sinBucle();
    afirmar((await veces(/Esto es Villavicencio/)) === 1 && (await veces(/Lo llevé a Villavicencio/)) === 0, `Respondió más de una vez (eco o pedido duplicado): ${await veces(/Esto es Villavicencio/)}`);
    afirmar((await veces(/Diseño la malla/)) === 0, "No debe tomar su propia sugerencia («¿le armo una red…?») como pedido");
    await foto("sin-eco");

    // Lo que no entiende: se disculpa una vez, sin repetir en voz lo que oyó, aunque oiga su propia disculpa
    await decir("Melki, barranco loco pla xyz");
    await oido(/no le entendí bien\. ¿Me lo repite, por favor\?/);
    await sinBucle();
    afirmar((await veces(/no le entendí bien/)) === 1, `Se disculpó ${await veces(/no le entendí bien/)} veces (bucle con su eco)`);
    afirmar((await veces(/Escuché/)) === 0, "La disculpa no debe repetir en voz lo que oyó");

    // El eco que llega tarde (sin oírse mientras hablaba) se reconoce por lo que dice
    await page.evaluate(() => (window.__voz.eco = "tarde"));
    await decir("Melki, ¿dónde estamos?");
    await oido(/Estamos viendo Villavicencio/);
    await sinBucle();
    afirmar((await veces(/Estamos viendo/)) === 1, `Respondió a su propio eco tardío: ${await veces(/Estamos viendo/)}`);

    // Y el que llega muy tarde: tampoco hay bucle
    await page.evaluate(() => (window.__voz.eco = "muy-tarde"));
    await decir("Melki, ¿me escuchas?");
    await oido(/le escucho perfectamente/);
    await sinBucle();
    afirmar((await veces(/le escucho perfectamente/)) === 1, `Repitió la respuesta con su eco muy tardío: ${await veces(/le escucho perfectamente/)}`);
    afirmar((await veces(/no le entendí bien/)) <= 2, `Entró en un bucle de disculpas: ${await veces(/no le entendí bien/)}`);

    // Edge corta la escucha cada 2,5 s de silencio: se vuelve a encender sola, sin que la barra parpadee ni avise
    await page.evaluate(() => (window.__voz.eco = "durante"));
    const cortes = await page.evaluate(() => window.__voz.cortes);
    await page.waitForTimeout(8000);
    const tras = await page.evaluate(() => ({ cortes: window.__voz.cortes, activo: Boolean(window.__voz.activo), estados: window.__estados.join(" → ") }));
    afirmar(tras.cortes - cortes >= 2 && tras.activo, `La escucha debería volver sola tras los cortes (${tras.cortes - cortes} cortes)`);
    afirmar(!/preparando/.test(tras.estados), `La barra no debe volver a «preparando» por los cortes: ${tras.estados}`);
    afirmar(!(await hud.innerText()).match(/apaga a cada rato|No logro escuchar|deja de escuchar a cada/), "No debe avisar que el micrófono se apaga");
    await decir("Melki, muestra los paneles");
    await page.locator("[data-tour=panel-izquierdo]").waitFor({ state: "visible", timeout: 15000 });
    await sinBucle();

    // Lo dicho por voz quedó una sola vez en la conversación
    await page.getByRole("button", { name: /^Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    const pedidos = await chat.locator("[title='Dicho por voz']").evaluateAll((xs) => xs.map((x) => (x.parentElement?.textContent ?? "").replace(/^\s*Por voz:\s*/, "").trim()));
    afirmar(pedidos.length === 5, `Los pedidos por voz deberían ser 5, sin duplicados ni eco: ${pedidos.join(" | ")}`);
    afirmar(/^Llévame a Villavicencio$/.test(pedidos[0]), `El pedido quedó repetido: «${pedidos[0]}»`);
    await foto("conversacion");

    // El dictado de la caja: sigue escuchando aunque Edge corte tras el silencio, sin repetir lo dicho
    await page.evaluate(() => Object.assign(window.__voz, { eco: null }));
    await page.getByRole("button", { name: "Apagar el Asistente Melki" }).first().click();
    await hud.waitFor({ state: "detached", timeout: 10000 });
    await chat.getByRole("button", { name: "Dictar por voz" }).click();
    await chat.getByRole("dialog", { name: "¿Cómo quiere dictar?" }).getByRole("button", { name: /Con el navegador/ }).click();
    await chat.getByText(/Escuchando… Revise el texto/).waitFor();
    await decir("pon un repetidor");
    await page.waitForTimeout(3500);
    afirmar(await chat.getByText(/Escuchando/).isVisible(), "El dictado no debe apagarse solo tras unos segundos de silencio");
    await decir("en el norte del mapa");
    await page.waitForFunction(() => document.querySelector("[aria-label='Pregunta para Melki']")?.value === "Pon un repetidor en el norte del mapa", null, { timeout: 10000 });
    await foto("dictado-sin-cortes");
    await chat.getByRole("button", { name: "Terminar el dictado" }).click();
    await chat.getByText(/Escuchando…/).waitFor({ state: "detached" });
  },
  {
    hablar: true,
    preparar: async (page) => {
      await page.addInitScript(manosLibresDeMentira);
      await page.addInitScript(() => {
        const consultar = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) => (d.name === "microphone" ? Promise.resolve({ state: "granted" }) : consultar(d));
        // Con audífonos: escucha mientras habla (el eco que se cuele lo filtran las reglas de siempre)
        const clave = "simulador-cobertura-melki-v1";
        const p = JSON.parse(localStorage.getItem(clave) ?? "{}");
        localStorage.setItem(clave, JSON.stringify({ ...p, manos: { ...p.manos, audifonos: true } }));
      });
    },
  },
);

// v13.1: con parlantes (sin audífonos), mientras Melki habla el micrófono queda en pausa y vuelve un instante después:
// no se oye a sí mismo aunque el eco suene fuerte, no se corta su voz y se le calla con el botón ■. Con «Uso audífonos»
// en los Ajustes escucha mientras habla (se le puede hablar encima).
await flujo(
  "voz-con-parlantes",
  async (page, foto) => {
    await esperarSimulacion(page);
    const hud = page.locator("[data-tour=hud-voz]");
    const decir = async (texto) => {
      await page.waitForFunction(() => Boolean(window.__voz.activo), null, { timeout: 5000 }).catch(() => {});
      afirmar(await page.evaluate((x) => window.__voz.decir(x), texto), `El micrófono no estaba escuchando al decir «${texto}»`);
    };
    const veces = (re) => page.evaluate((r) => window.__voz.dicho.filter((x) => new RegExp(r).test(x)).length, re.source);
    const oido = async (re, timeout = 20000) => {
      try {
        await page.waitForFunction((r) => new RegExp(r).test(window.__voz.dicho.join(" ")), re.source, { timeout });
      } catch {
        throw new Error(`No dijo ${re} · dijo: ${(await page.evaluate(() => window.__voz.dicho.slice(-3).join(" | "))).slice(0, 500)}`);
      }
    };
    const callado = async () => {
      await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 30000 });
      await page.waitForTimeout(900);
    };
    const esperarEstado = (re, timeout = 20000) =>
      page.waitForFunction((s) => new RegExp(s).test(document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") ?? ""), re.source, { timeout });
    await page.locator("[data-tour=melki-reposo]").waitFor({ timeout: 15000 });
    // El eco más fuerte: empieza a oírse mientras habla y el navegador duplica las frases
    await page.evaluate(() => Object.assign(window.__voz, { eco: "durante", duplicar: true }));
    // Mientras habla, ¿el micrófono escucha? Se mide al empezar y al terminar cada trozo de voz, y cada 50 ms mientras
    // suena (en un equipo lento los relojes se atrasan y una frase corta casi no alcanza a medirse)
    await page.evaluate(() => {
      window.__oyeHablando = 0;
      window.__pausaHablando = 0;
      const medir = () => {
        if (window.__voz.activo) window.__oyeHablando++;
        else window.__pausaHablando++;
      };
      window.__voz.alSonar = medir;
      setInterval(() => {
        if (window.speechSynthesis.speaking) medir();
      }, 50);
    });

    await decir("Hey Melki, llévame a Villavicencio");
    await hud.waitFor({ timeout: 10000 });
    // (v13.4: lo dice al llegar volando, a la par de su nube)
    await oido(/Esto es Villavicencio/);
    await callado();
    await page.waitForFunction(() => Boolean(window.__voz.activo), null, { timeout: 3000 });
    await page.waitForTimeout(4000);
    await callado();
    afirmar((await veces(/Esto es Villavicencio/)) === 1 && (await veces(/Lo llevé a Villavicencio/)) === 0, `Respondió más de una vez: ${await veces(/Esto es Villavicencio/)}`);
    const medida = await page.evaluate(() => ({ oye: window.__oyeHablando, pausa: window.__pausaHablando }));
    afirmar(medida.pausa >= 2 && medida.oye <= 3, `Con parlantes no debería escuchar mientras habla (escuchando ${medida.oye}, en pausa ${medida.pausa})`);
    await foto("pausa-al-hablar");

    // Una respuesta larga se dice en trozos cortos (las voces del navegador se cortan solas en frases muy largas); el
    // botón ■ la calla del todo y Melki vuelve a escuchar
    await decir("Melki, ¿qué puedo decir?");
    await esperarEstado(/^hablando$/);
    const inicioAyuda = await page
      .waitForFunction(() => {
        const i = window.__voz.dicho.findIndex((x) => /^Soy el Asistente Melki/.test(x));
        return i >= 0 && window.__voz.dicho.length > i + 1 ? i : false;
      }, null, { timeout: 15000 })
      .then((h) => h.jsonValue());
    const trozos = await page.evaluate((i) => window.__voz.dicho.slice(i), inicioAyuda);
    afirmar(trozos.every((x) => x.length <= 150), `Cada trozo de voz debería ser corto: ${trozos.map((x) => x.length).join(", ")}`);
    await hud.getByRole("button", { name: "Callar a Melki" }).first().click();
    await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 5000 });
    const tras = await page.evaluate(() => window.__voz.dicho.length);
    await page.waitForFunction(() => Boolean(window.__voz.activo), null, { timeout: 3000 });
    await esperarEstado(/^(atento|esperando)$/);
    await page.waitForTimeout(1500);
    afirmar((await page.evaluate(() => window.__voz.dicho.length)) === tras, "Callado con ■ no debería seguir diciendo el resto");

    // Con audífonos (en Ajustes de voz) escucha mientras habla
    await page.getByRole("button", { name: /^Abrir a Melki/ }).click();
    await page.getByRole("button", { name: "Ajustes de voz" }).click();
    const ajustes = page.getByRole("group", { name: "Ajustes de voz" });
    const audifonos = ajustes.getByRole("switch", { name: /Uso audífonos/ });
    afirmar((await audifonos.getAttribute("aria-checked")) === "false", "Sin audífonos debería ser lo de siempre");
    await audifonos.click();
    afirmar((await audifonos.getAttribute("aria-checked")) === "true", "El interruptor de audífonos debería encenderse");
    await foto("ajuste-audifonos");
    await page.getByRole("button", { name: "Ajustes de voz" }).click();
    await page.evaluate(() => Object.assign(window.__voz, { eco: null, duplicar: false }));
    await callado();
    await page.evaluate(() => {
      window.__oyeHablando = 0;
      window.__pausaHablando = 0;
    });
    await decir("Melki, ¿dónde estamos?");
    await oido(/Estamos viendo Villavicencio/);
    await callado();
    const conAudifonos = await page.evaluate(() => ({ oye: window.__oyeHablando, pausa: window.__pausaHablando }));
    afirmar(conAudifonos.oye >= 3 && conAudifonos.pausa <= 2, `Con audífonos debería escuchar mientras habla (escuchando ${conAudifonos.oye}, en pausa ${conAudifonos.pausa})`);
    // Con audífonos se le puede callar también de palabra
    await decir("Melki, ¿qué puedo decir?");
    await esperarEstado(/^hablando$/);
    afirmar(/o diga «Melki, para»/.test((await hud.getByRole("button", { name: "Callar a Melki" }).first().getAttribute("title")) ?? ""), "Con audífonos el botón ■ debería decir que también se le calla de palabra");
    await page.waitForTimeout(300);
    await decir("Melki, silencio");
    await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 5000 });
    await esperarEstado(/^(atento|esperando)$/);
  },
  {
    hablar: true,
    preparar: async (page) => {
      await page.addInitScript(manosLibresDeMentira);
      await page.addInitScript(() => {
        const consultar = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) => (d.name === "microphone" ? Promise.resolve({ state: "granted" }) : consultar(d));
      });
    },
  },
);

// «Activarme al abrir el simulador»: con el micrófono permitido se activa solo; el navegador no deja hablar hasta el
// primer toque, y entonces saluda «Hola, señor. Bienvenido».
await flujo(
  "asistente-al-abrir",
  async (page, foto) => {
    const hud = page.locator("[data-tour=hud-voz]");
    await hud.waitFor({ timeout: 30000 });
    await page.waitForFunction(() => document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") === "esperando", null, { timeout: 20000 });
    afirmar((await page.getByRole("button", { name: "Apagar el Asistente Melki" }).first().getAttribute("aria-pressed")) === "true", "Debería activarse solo al abrir");
    const oirme = hud.getByRole("button", { name: "Toque aquí para oír mi voz" });
    await oirme.waitFor({ timeout: 10000 });
    afirmar(!(await page.evaluate(() => window.__voz.dicho.join(" "))).includes("Bienvenido"), "Sin un toque el navegador no deja hablar");
    await foto("sin-tocar");
    await oirme.click();
    await page.waitForFunction(() => /Hola, señor\. Bienvenido\./.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    await oirme.waitFor({ state: "detached", timeout: 5000 });
    afirmar(await escuchaTrasHablar(page), "Debería quedar escuchando");
    // Ajustes del asistente: trato, voz, activarse al abrir y el permiso del micrófono
    await page.getByRole("button", { name: /^Abrir a Melki/ }).click();
    await page.getByRole("button", { name: "Ajustes de voz" }).click();
    const ajustes = page.getByRole("group", { name: "Ajustes de voz" });
    await ajustes.getByRole("radio", { name: "Señora" }).click();
    afirmar((await ajustes.getByRole("switch", { name: /Activarme al abrir el simulador/ }).getAttribute("aria-checked")) === "true", "El interruptor de activarse al abrir debería estar encendido");
    afirmar(/Micrófono permitido/.test(await ajustes.innerText()), "Debería decir que el micrófono está permitido");
    // (exacto: en los mismos ajustes está «Probar conexión» de la IA)
    await ajustes.getByRole("button", { name: "Probar", exact: true }).click();
    await page.waitForFunction(() => /Hola, señora\. Así sonará mi voz/.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    await foto("ajustes");
    await page.getByRole("button", { name: "Apagar el Asistente Melki" }).first().click();
    await hud.waitFor({ state: "detached" });
  },
  {
    hablar: true,
    preparar: async (page) => {
      await page.addInitScript(manosLibresDeMentira);
      await page.addInitScript(() => {
        localStorage.setItem("simulador-cobertura-melki-v1", JSON.stringify({ visto: true, voz: false, manos: { siempre: true } }));
        const consultar = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) => (d.name === "microphone" ? Promise.resolve({ state: "granted" }) : consultar(d));
        // Como un navegador recién abierto: sin un toque de la persona, la página no ha sido «activada»
        let tocado = false;
        window.addEventListener("pointerup", () => (tocado = true), { capture: true });
        window.addEventListener("keydown", () => (tocado = true), { capture: true });
        Object.defineProperty(navigator, "userActivation", { configurable: true, value: { get hasBeenActive() { return tocado; }, get isActive() { return tocado; } } });
      });
    },
  },
);

// v13.2: Melki no habla (lo normal). Escucha todo el tiempo, hace lo que se le pide y deja la respuesta escrita en su
// barra y en la conversación; solo habla si se lo piden («háblame» o el parlante) y «no hables» lo vuelve a callar.
await flujo(
  "solo-escucha",
  async (page, foto) => {
    await esperarSimulacion(page);
    const hud = page.locator("[data-tour=hud-voz]");
    const decir = async (texto) => afirmar(await page.evaluate((x) => window.__voz.decir(x), texto), `El micrófono no estaba escuchando al decir «${texto}»`);
    const dichos = () => page.evaluate(() => window.__voz.dicho.length);
    const lo = () => page.evaluate(() => window.__voz.dicho.join(" | ").slice(0, 200));
    // ¿Escucha mientras muestra la respuesta? (se mide cada 50 ms mientras la barra responde)
    await page.evaluate(() => {
      window.__oyeRespondiendo = 0;
      window.__sordoRespondiendo = 0;
      setInterval(() => {
        if (document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") !== "hablando") return;
        if (window.__voz.activo) window.__oyeRespondiendo++;
        else window.__sordoRespondiendo++;
      }, 50);
    });
    await page.locator("[data-tour=melki-reposo]").waitFor({ timeout: 15000 });
    // «Hey Melki, …»: se activa, hace el pedido y lo deja escrito en su barra, sin hablar
    await decir("Hey Melki, llévame a Villavicencio");
    await hud.waitFor({ timeout: 10000 });
    await page.waitForFunction(
      () => {
        const h = document.querySelector("[data-tour=hud-voz]");
        return h?.getAttribute("data-estado") === "hablando" && /Lo llevé a Villavicencio/.test(h.textContent ?? "");
      },
      null,
      { timeout: 15000 },
    );
    afirmar(/Le respondo por escrito/.test(await hud.textContent()), "La barra debería decir que responde por escrito");
    // v13.4: la barra trae el botón «Voz de Melki» para encenderla a mano (apagada, lo normal)
    afirmar((await hud.getByRole("button", { name: "Voz de Melki" }).getAttribute("aria-pressed")) === "false", "La barra debería traer el botón de la voz, apagado");
    afirmar((await hud.getByRole("button", { name: "Callar a Melki" }).count()) === 0, "Sin voz no hay nada que callar");
    afirmar((await hud.getByRole("button", { name: "Toque aquí para oír mi voz" }).count()) === 0, "Sin voz no pide un toque para hablar");
    afirmar(await page.evaluate(() => Boolean(window.__voz.activo)), "Mientras responde por escrito debería seguir escuchando");
    await foto("respuesta-escrita");
    // Ya escucha la siguiente orden y la hace
    await decir("Melki, muéstrame los resultados");
    await page.locator("aside[aria-label=Resultados]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1500);
    afirmar((await dichos()) === 0, `Melki no debería hablar: ${await lo()}`);
    const oido = await page.evaluate(() => ({ oye: window.__oyeRespondiendo, sordo: window.__sordoRespondiendo }));
    afirmar(oido.oye >= 3 && oido.sordo <= 2, `Mientras responde por escrito el micrófono debería seguir escuchando (escuchando ${oido.oye}, sin escuchar ${oido.sordo})`);
    // Lo respondido queda escrito en la conversación; el parlante está apagado y «Hablar en voz alta» también
    await page.getByRole("button", { name: /^Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByText(/Lo llevé a Villavicencio/).first().waitFor({ timeout: 10000 });
    afirmar((await chat.getByRole("button", { name: "Escuchar las respuestas" }).getAttribute("aria-pressed")) === "false", "El parlante de la conversación debería estar apagado");
    await chat.getByRole("button", { name: "Ajustes de voz" }).click();
    const ajustes = page.getByRole("group", { name: "Ajustes de voz" });
    afirmar((await ajustes.getByRole("switch", { name: /Hablar en voz alta/ }).getAttribute("aria-checked")) === "false", "«Hablar en voz alta» debería estar apagado");
    afirmar((await ajustes.getByRole("button", { name: "Probar", exact: true }).count()) === 0 && (await ajustes.getByRole("switch", { name: /Uso audífonos/ }).count()) === 0, "Sin voz no se muestran los ajustes de la voz");
    await foto("ajustes");
    await chat.getByRole("button", { name: "Ajustes de voz" }).click();
    // «Háblame» la enciende (lo siguiente se oye) y «no hables» la vuelve a apagar (ni su confirmación suena)
    await chat.getByRole("textbox").fill("háblame");
    await chat.getByRole("textbox").press("Enter");
    await chat.getByText(/ahora le leo en voz alta/).waitFor({ timeout: 10000 });
    await chat.getByRole("textbox").fill("¿dónde estamos?");
    await chat.getByRole("textbox").press("Enter");
    await page.waitForFunction(() => /Estamos viendo Villavicencio/.test(window.__voz.dicho.join(" ")), null, { timeout: 15000 });
    await chat.getByRole("textbox").fill("no hables");
    await chat.getByRole("textbox").press("Enter");
    await chat.getByText(/ya no hablo en voz alta/).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    afirmar(!/ya no hablo en voz alta/.test(await page.evaluate(() => window.__voz.dicho.join(" "))), "La confirmación de «no hables» no debería sonar");
    const conVoz = await dichos();
    await chat.getByRole("textbox").fill("¿dónde estamos?");
    await chat.getByRole("textbox").press("Enter");
    await chat.getByText(/Estamos viendo Villavicencio/).nth(1).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    afirmar((await dichos()) === conVoz, `Después de «no hables» no debería volver a hablar: ${await lo()}`);
    // v13.4: el botón «Voz de Melki» de la barra la enciende a mano (lo siguiente se oye) y la vuelve a apagar
    const vozBarra = hud.getByRole("button", { name: "Voz de Melki" });
    await vozBarra.click();
    afirmar((await vozBarra.getAttribute("aria-pressed")) === "true" && (await chat.getByRole("button", { name: "Silenciar a Melki" }).getAttribute("aria-pressed")) === "true", "El botón de la barra debería encender la voz (la misma de la conversación)");
    await chat.getByRole("textbox").fill("¿dónde estamos?");
    await chat.getByRole("textbox").press("Enter");
    await page.waitForFunction((n) => window.__voz.dicho.slice(n).some((x) => /Estamos viendo Villavicencio/.test(x)), conVoz, { timeout: 15000 });
    await foto("voz-a-mano");
    await vozBarra.click();
    await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 5000 });
    afirmar((await vozBarra.getAttribute("aria-pressed")) === "false" && (await chat.getByRole("button", { name: "Escuchar las respuestas" }).getAttribute("aria-pressed")) === "false", "El botón de la barra debería volver a apagar la voz");
  },
  {
    preparar: async (page) => {
      await page.addInitScript(manosLibresDeMentira);
      await page.addInitScript(() => {
        const consultar = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) => (d.name === "microphone" ? Promise.resolve({ state: "granted" }) : consultar(d));
      });
    },
  },
);

// v13: el pitch del modelo de negocio (el robot de Melki recorre el mapa) y la conversación con IA (Gemini Live de
// mentira: el mismo protocolo, sin internet)
/** Un micrófono de mentira (un tono) para la IA: sin dispositivo real en el navegador de pruebas. */
const microfonoDeMentira = () => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 180;
    const d = ctx.createMediaStreamDestination();
    o.connect(d);
    o.start();
    return d.stream;
  };
};

await flujo(
  "pitch",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    await page.getByRole("button", { name: "Presentar el modelo de negocio (pitch)" }).click();
    const pitch = page.locator("[data-tour=pitch]");
    await pitch.waitFor({ timeout: 10000 });
    const tarjeta = () => pitch.innerText();
    await pitch.getByText(/^Pitch · 1 de \d+$/).waitFor();
    await pitch.getByRole("heading", { name: /Trama: pagos, WhatsApp e IA/ }).waitFor();
    // A mano (sin avanzar solo), para revisar cada capítulo desde la portada
    await pitch.getByRole("button", { name: /^Avanza solo/ }).click();
    await pitch.getByRole("button", { name: /^Capítulo 1: / }).click();
    await pitch.getByText(/^Pitch · 1 de \d+$/).waitFor();
    // El robot está en el mapa y saluda; lo que cuenta queda escrito en la tarjeta. Melki no habla (lo normal)
    await pitch.locator("[data-robot]").waitFor();
    await pitch.getByText(/soy Melki, el asistente del simulador/).waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    afirmar((await page.evaluate(() => window.__voz.dicho.length)) === 0, `Sin encender la voz, la presentación no debería hablar: ${await page.evaluate(() => window.__voz.dicho.join(" | ").slice(0, 200))}`);
    afirmar(/Gateways/.test(await tarjeta()) && /Repetidores/.test(await tarjeta()), "La portada no trae las cifras de la red");
    // Los paneles se ocultan para dejar el mapa libre
    afirmar(!(await page.locator("aside[aria-label=Resultados]").isVisible()), "El panel de resultados debería ocultarse en el pitch");
    await foto("portada");
    // Flechas: el problema, la solución y cada antena (con su altura y su ubicación)
    await page.keyboard.press("ArrowRight");
    await pitch.getByRole("heading", { name: /El problema/ }).waitFor();
    await page.keyboard.press("ArrowRight");
    await pitch.getByRole("heading", { name: /La solución/ }).waitFor();
    await page.keyboard.press("ArrowRight");
    await pitch.getByRole("heading", { name: "Gateway", exact: true }).first().waitFor();
    await page.waitForTimeout(2900);
    afirmar(/Altura de la antena/.test(await tarjeta()) && /Ubicación/.test(await tarjeta()), "El capítulo de la antena no dice altura y ubicación");
    // Lo que cuenta de la antena sale escrito en una nube desde su punto
    const nubePitch = pitch.locator(".nube-mapa");
    await nubePitch.waitFor({ timeout: 10000 });
    afirmar(/Pitch · 4 de \d+/.test(await nubePitch.textContent()) && /aquí entra internet por Starlink/.test(await nubePitch.textContent()), `La nube de la antena no trae lo que se cuenta: ${(await nubePitch.textContent()).slice(0, 160)}`);
    afirmar(await pitch.locator("[data-robot=senalando], [data-robot=volando], [data-robot=flotando]").count() === 1, "El robot debería señalar la antena");
    await foto("antena");
    // Pausa con el espacio y sigue
    await page.keyboard.press(" ");
    await pitch.getByRole("button", { name: "Seguir (espacio)" }).waitFor();
    await page.keyboard.press(" ");
    await pitch.getByRole("button", { name: "Pausar (espacio)" }).waitFor();
    // Por Melki: probar una comisión (va al punto de equilibrio y dice en cuánto se recupera)
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByRole("textbox").fill("prueba una comisión de 300 pesos");
    await chat.getByRole("textbox").press("Enter");
    await pitch.getByRole("heading", { name: "Punto de equilibrio" }).waitFor({ timeout: 10000 });
    await pitch.getByText("Con una comisión de $300 por pago").waitFor();
    afirmar(/Recupera la inversión/.test(await tarjeta()) && /Comisión de equilibrio/.test(await tarjeta()), "El equilibrio no trae la recuperación");
    // La comisión también se escribe en la tarjeta
    await pitch.getByRole("textbox", { name: "Comisión por pago en pesos" }).fill("800");
    await pitch.getByRole("button", { name: "Calcular" }).click();
    await pitch.getByText("Con una comisión de $800 por pago").waitFor();
    await foto("equilibrio");
    // Por voz con su nombre: «Melki, siguiente» (aunque esté narrando)
    await chat.getByRole("textbox").fill("siguiente");
    await chat.getByRole("textbox").press("Enter");
    await pitch.getByRole("heading", { name: "Cómo escala" }).waitFor({ timeout: 10000 });
    afirmar(/País: inversión/.test(await tarjeta()), "La escala no trae el país");
    // Esc termina y devuelve los paneles (con el foco fuera de la caja de texto)
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await page.keyboard.press("Escape");
    await pitch.waitFor({ state: "detached" });
    // El cerebro explica el pitch y ofrece empezarlo
    await chat.getByRole("textbox").fill("¿qué es el pitch?");
    await chat.getByRole("textbox").press("Enter");
    await chat.getByText(/En el pitch recorro el mapa con mi robot/).waitFor();
    await chat.getByRole("button", { name: "Empezar el pitch" }).click();
    await pitch.waitFor({ timeout: 10000 });
    await pitch.getByRole("button", { name: "Salir de la presentación (Esc)" }).click();
    await pitch.waitFor({ state: "detached" });
  },
  { sembrar: true, preparar: (page) => page.addInitScript(manosLibresDeMentira) },
);

// v13.1: el recorrido de la red. El robot va punto por punto y de cada uno sale una nube que escribe qué se instaló, por
// qué ahí y su papel; se maneja con las flechas o pidiéndoselo a Melki; al salir, queda por escrito en la conversación.
await flujo(
  "recorrido-red",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    await page.getByRole("button", { name: "Recorrido de la red con Melki" }).click();
    const rec = page.locator("[data-tour=recorrido-red]");
    await rec.waitFor({ timeout: 10000 });
    const nube = rec.locator(".nube-mapa");
    // La nube escribe al ritmo de lectura; un toque la termina de escribir (así la prueba no espera cada texto entero)
    const escrita = async () => {
      await nube.waitFor({ timeout: 15000 });
      await nube.click({ position: { x: 24, y: 12 } });
      await rec.locator(".nube-mapa[data-escrito=si]").waitFor({ timeout: 10000 });
    };
    // 1 · El panorama: la nube sale del robot y escribe al ritmo de lectura (no de golpe); los paneles se ocultan
    await nube.waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    afirmar((await nube.getAttribute("data-escrito")) === "no", "La nube debería escribir al ritmo de lectura, no de golpe");
    await escrita();
    // Escrita: la barra cuenta unos segundos para seguir solo al próximo punto; con el puntero encima (quedó ahí con el
    // toque), espera; al quitarlo, sigue contando
    await rec.locator("[data-cuenta=pausada]").waitFor({ timeout: 5000 });
    await page.waitForTimeout(6000);
    afirmar((await page.locator("[data-tour=recorrido-red][data-parada=panorama]").count()) === 1, "Con el puntero encima no debería haber seguido al próximo punto");
    await page.mouse.move(4, 300);
    await rec.locator("[data-cuenta=corre]").waitFor({ timeout: 3000 });
    // A mano, para revisar cada punto (enseguida: en un equipo lento la barra no alcanza a terminar mientras se toca)
    await rec.getByRole("button", { name: /^Avanza solo/ }).evaluate((b) => b.click());
    afirmar((await page.locator("[data-tour=recorrido-red][data-parada=panorama]").count()) === 1 && (await rec.locator("[data-cuenta]").count()) === 0, "A mano no cuenta el tiempo ni sigue solo");
    afirmar(/Recorrido · 1 de 8/.test(await nube.textContent()), `El panorama no dice el paso: ${(await nube.textContent()).slice(0, 80)}`);
    afirmar(/El recorrido sigue el camino de la señal/.test(await nube.textContent()), "El panorama no explica el recorrido");
    afirmar(!(await page.locator("aside[aria-label=Resultados]").isVisible()), "El panel de resultados debería ocultarse");
    // Melki no habla (lo normal): todo va escrito en la nube
    afirmar((await page.evaluate(() => window.__voz.dicho.length)) === 0, `Sin encender la voz, el recorrido no debería hablar: ${await page.evaluate(() => window.__voz.dicho.join(" | ").slice(0, 200))}`);
    await foto("panorama");
    // 2 · Cómo lo calcula el simulador: el relieve, la pérdida, el margen y sus cortes, la malla y la hora pico
    await page.keyboard.press("ArrowRight");
    await page.locator("[data-tour=recorrido-red][data-parada=metodo]").waitFor({ timeout: 10000 });
    await escrita();
    const tMetodo = await nube.textContent();
    afirmar(/Cómo lo calcula el simulador/.test(tMetodo) && /perfil del terreno/.test(tMetodo) && /Con 20 dB ya hay servicio/.test(tMetodo) && /Radio Mobile/.test(tMetodo), `La nube del método no lo explica: ${tMetodo.slice(0, 200)}`);
    await foto("metodo");
    // 3 · El gateway: la nube sale de su punto, con la línea que lo señala, y escribe qué se instaló, por qué ahí y su papel
    await page.keyboard.press("ArrowRight");
    await page.locator("[data-tour=recorrido-red][data-parada^=gateway]").waitFor({ timeout: 10000 });
    await escrita();
    const tGw = await nube.textContent();
    afirmar(/Se instaló el sitio gateway/.test(tGw) && /Starlink/.test(tGw) && /Altura de la antena/.test(tGw) && /enlaza directo con/.test(tGw), `La nube del gateway no está completa: ${tGw.slice(0, 200)}`);
    afirmar((await rec.locator(".nube-linea path").count()) >= 1, "Falta la línea que señala el punto");
    afirmar((await rec.locator("[data-robot]").count()) === 1, "Falta el robot junto al gateway");
    // v13.4: la nube es holográfica: translúcida (se ve la simulación detrás, apenas oscurecida) y con el texto claro
    const holo = await estiloHolo(nube);
    afirmar(holo.ok, `La nube debería ser holográfica y translúcida, con el texto claro: ${JSON.stringify(holo)}`);
    afirmar((await rec.locator(".holo-marco").count()) === 1, "Falta el marco de luz del holograma");
    const mapa = await page.locator("[data-tour=mapa]").boundingBox();
    const caja = await nube.boundingBox();
    afirmar(caja.x >= mapa.x - 1 && caja.x + caja.width <= mapa.x + mapa.width + 1 && caja.y >= mapa.y - 1 && caja.y + caja.height <= mapa.y + mapa.height + 1, "La nube debería quedar dentro del mapa");
    afirmar((await page.evaluate(() => window.__voz.dicho.length)) === 0, "Sin encender la voz, el gateway tampoco se dice en voz alta");
    await foto("gateway");
    // 3 · El repetidor: su enlace con el gateway y su papel. Con el parlante del recorrido, además dice lo breve
    await rec.getByRole("button", { name: "Oír la voz" }).click();
    await page.keyboard.press("ArrowRight");
    await page.locator("[data-tour=recorrido-red][data-parada^=repetidor]").waitFor({ timeout: 10000 });
    await escrita();
    afirmar(/Se instaló un repetidor solar/.test(await nube.textContent()) && /dB de margen/.test(await nube.textContent()), "La nube del repetidor no dice su enlace");
    await page.waitForFunction(() => window.__voz.dicho.length > 0, null, { timeout: 15000 });
    await rec.getByRole("button", { name: "Silenciar la voz" }).click();
    await foto("repetidor");
    // Por Melki: «ve a lo que falta» y «¿por qué la red quedó así?»
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByRole("textbox").fill("ve a lo que falta");
    await chat.getByRole("textbox").press("Enter");
    await page.locator("[data-tour=recorrido-red][data-parada=pendiente]").waitFor({ timeout: 10000 });
    await escrita();
    afirmar(/no llega al gateway/.test(await nube.textContent()) && (await nube.getByRole("button", { name: "Conecta a los que faltan" }).isVisible()), "«Lo que falta» debería señalar a la persona sin cobertura y ofrecer conectarla");
    await foto("lo-que-falta");
    // Los refuerzos: qué le falta para el 100 % (los repetidores de apoyo, estimados) y para el 99,9 % (el segundo gateway)
    await chat.getByRole("textbox").fill("ve a los refuerzos");
    await chat.getByRole("textbox").press("Enter");
    await page.locator("[data-tour=recorrido-red][data-parada=refuerzos]").waitFor({ timeout: 10000 });
    await escrita();
    const tRef = await nube.textContent();
    afirmar(/Para que funcione al 100 % y al 99,9 %/.test(tRef) && /hacen falta unos \d+ repetidore?s? de apoyo/.test(tRef) && /segundo gateway/.test(tRef) && /de inversión/.test(tRef) && (await nube.getByRole("button", { name: "Conecta a los que faltan" }).isVisible()), `Los refuerzos no dicen qué falta: ${tRef.slice(0, 240)}`);
    await foto("refuerzos");
    await chat.getByRole("textbox").fill("¿por qué la red quedó así?");
    await chat.getByRole("textbox").press("Enter");
    await page.locator("[data-tour=recorrido-red][data-parada=cierre]").waitFor({ timeout: 10000 });
    await escrita();
    const tCierre = await nube.textContent();
    afirmar(/Es una malla de 1 gateway y 1 repetidor/.test(tCierre) && /Montar esta infraestructura/.test(tCierre), `La conclusión no explica la red: ${tCierre.slice(0, 200)}`);
    await foto("conclusion");
    // Al salir queda todo por escrito en la conversación y vuelven los paneles
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await page.keyboard.press("Escape");
    await rec.waitFor({ state: "detached", timeout: 5000 });
    // (la conversación quedó abierta: con ella se le pidió «ve a lo que falta»)
    await chat.getByText(/Le dejo por escrito el recorrido de la red \(8 paradas\)/).waitFor({ timeout: 10000 });
    await page.locator("aside[aria-label=Resultados]").waitFor({ state: "visible", timeout: 5000 });
    // Desde una nube: «Conecta a los que faltan» cierra el recorrido y se lo pide a Melki
    await chat.getByRole("textbox").fill("explícame la red");
    await chat.getByRole("textbox").press("Enter");
    await rec.waitFor({ timeout: 10000 });
    await rec.getByRole("button", { name: "Punto 6: Lo que falta" }).click();
    await escrita();
    await nube.getByRole("button", { name: "Conecta a los que faltan" }).click();
    await rec.waitFor({ state: "detached", timeout: 5000 });
    await chat.getByText(/conecta a los que faltan/i).first().waitFor({ timeout: 10000 });
  },
  { sembrar: true, preparar: (page) => page.addInitScript(manosLibresDeMentira) },
);

await flujo(
  "recorrido-movil",
  async (page, foto) => {
    // En el celular el panel va en una hoja que sube desde abajo: ahí está el ejemplo de malla
    const hoja = page.getByRole("region", { name: "Panel" });
    await page.getByRole("navigation", { name: "Paneles" }).getByRole("button", { name: "Sembrar" }).click();
    await hoja.locator("[data-tour=guia-sembrar]").waitFor();
    await esperarRed(page);
    await hoja.getByRole("button", { name: "Ejemplo de malla" }).click();
    await page.waitForTimeout(400);
    await esperarRed(page);
    await page.getByRole("button", { name: "Recorrido de la red con Melki" }).click();
    const rec = page.locator("[data-tour=recorrido-red]");
    await rec.waitFor({ timeout: 10000 });
    await rec.getByRole("button", { name: /^Avanza solo/ }).click();
    await page.getByRole("button", { name: "Siguiente (→)" }).click();
    await page.locator("[data-tour=recorrido-red][data-parada=metodo]").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Siguiente (→)" }).click();
    await page.locator("[data-tour=recorrido-red][data-parada^=gateway]").waitFor({ timeout: 10000 });
    const nube = rec.locator(".nube-mapa");
    // Escribe al ritmo de lectura (la nube sigue lo que escribe); un toque la termina
    await nube.waitFor({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await nube.click({ position: { x: 24, y: 12 } });
    await rec.locator(".nube-mapa[data-escrito=si]").waitFor({ timeout: 10000 });
    const b = await nube.boundingBox();
    afirmar(b.x >= 0 && b.x + b.width <= 390 && b.height <= 844 * 0.5, `En el celular la nube debería caber abajo (${Math.round(b.x)}, ${Math.round(b.width)} × ${Math.round(b.height)})`);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    afirmar(ancho <= 390, `La página no debe desbordarse a lo ancho (${ancho})`);
    // Si el texto no cabe, la nube baja sola con lo que va escribiendo hasta el final (el botón queda a la vista)
    await page.waitForTimeout(900);
    const sc = await nube.evaluate((el) => ({ alto: el.scrollHeight, visible: el.clientHeight, arriba: Math.round(el.scrollTop) }));
    afirmar(sc.alto <= sc.visible + 2 || sc.arriba + sc.visible >= sc.alto - 6, `En el celular la nube debería seguir lo que escribe hasta el final (${JSON.stringify(sc)})`);
    await foto("gateway");
    await page.getByRole("button", { name: "Salir del recorrido (Esc)" }).click();
    await rec.waitFor({ state: "detached", timeout: 5000 });
  },
  { sembrar: true, tamano: { width: 390, height: 844 }, preparar: (page) => page.addInitScript(manosLibresDeMentira) },
);

// v13.3: Melki llega volando. «Ubícame en Barranca de Upía»: en vez del punto rojo, su robot sale de su esquina, vuela al
// lugar y saluda, con una nube que escribe al ritmo de lectura qué hay ahí y la sugerencia; en una coordenada la señala y
// el botón de la nube inscribe el nodo ahí (igual que el de la conversación, que queda usado).
await flujo(
  "llegada",
  async (page, foto) => {
    await esperarSimulacion(page);
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByRole("textbox").fill("ubícame en Barranca de Upía");
    await chat.getByRole("textbox").press("Enter");
    const lleg = page.locator("[data-tour=llegada-melki]");
    await lleg.waitFor({ timeout: 10000 });
    await page.locator("[data-tour=llegada-melki][data-fase=llego]").waitFor({ timeout: 15000 });
    afirmar((await page.locator(".pin-punto").count()) === 0, "Con Melki volando no debería quedar el punto rojo");
    afirmar((await lleg.getAttribute("data-gesto")) === "saludando", `Al llegar a un lugar debería saludar (${await lleg.getAttribute("data-gesto")})`);
    const nube = lleg.locator(".nube-mapa");
    await nube.waitFor({ timeout: 5000 });
    const t = await nube.textContent();
    afirmar(/¡Hola, señor! Esto es Barranca de Upía \(Meta\)/.test(t) && /¿Le armo una red sostenible/.test(t), `La nube de la llegada no saluda ni dice dónde está: ${t.slice(0, 200)}`);
    afirmar(await nube.getByRole("button", { name: "Sí, la red de todo el municipio" }).isVisible(), "La nube debería traer la sugerencia");
    await page.waitForTimeout(1200);
    afirmar((await nube.getAttribute("data-escrito")) === "no", "La nube debería escribir al ritmo de lectura, no de golpe");
    // v13.4: holográfica y translúcida (se ve la simulación detrás), con su marco de luz y los datos del municipio
    const holo = await estiloHolo(nube);
    afirmar(holo.ok, `La nube de la llegada debería ser holográfica y translúcida, con el texto claro: ${JSON.stringify(holo)}`);
    afirmar((await lleg.locator(".holo-marco").count()) === 1 && (await lleg.locator(".llegada-halo").count()) === 1, "Faltan el marco de luz de la nube o el halo donde se posa el robot");
    afirmar(/Área/.test(t) && /40\.9\d\d ha/.test(t) && /Departamento/.test(t) && /Nodos en el municipio/.test(t), `La nube debería traer los datos del municipio: ${t.slice(0, 240)}`);
    // Con la conversación abierta, la nube no la tapa
    const cajaNube = await nube.boundingBox();
    const cajaChat = await chat.boundingBox();
    afirmar(cajaNube.x + cajaNube.width <= cajaChat.x + 2, `La nube no debería tapar la conversación (${Math.round(cajaNube.x + cajaNube.width)} > ${Math.round(cajaChat.x)})`);
    await foto("saludo");
    // La voz, a mano: apagada (lo normal) no dice nada; el botón «Voz» de la nube la enciende y Melki lo dice en voz
    // alta (la nube lo escribe a la par); vuelve a apagarla y calla. Es la misma voz de la conversación
    const botonVoz = lleg.getByRole("button", { name: "Voz de Melki" });
    afirmar((await botonVoz.getAttribute("aria-pressed")) === "false" && (await page.evaluate(() => window.__voz.dicho.length)) === 0, "Sin encender la voz, Melki no debería hablar al llegar");
    await botonVoz.click();
    await page.waitForFunction(() => /¡Hola, señor! Esto es Barranca de Upía \(Meta\): un municipio de 409\d\d hectáreas/.test(window.__voz.dicho.join(" ")), null, { timeout: 10000 });
    afirmar((await botonVoz.getAttribute("aria-pressed")) === "true" && (await lleg.getAttribute("data-voz")) === "si", "El botón de la voz debería quedar encendido");
    afirmar((await chat.getByRole("button", { name: "Silenciar a Melki" }).getAttribute("aria-pressed")) === "true", "Es la misma voz: el parlante de la conversación también se enciende");
    afirmar(!/Lo llevé a/.test(await page.evaluate(() => window.__voz.dicho.join(" "))), "Dice lo de la nube, no la respuesta de la conversación");
    await foto("voz");
    await botonVoz.click();
    await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 5000 });
    afirmar((await botonVoz.getAttribute("aria-pressed")) === "false" && (await lleg.getAttribute("data-hablando")) === "no", "Al apagar la voz, Melki calla");
    // Un toque la termina de escribir; la barra cuenta el tiempo para volver. Esc lo manda de vuelta a su esquina
    await nube.click({ position: { x: 24, y: 12 } });
    await lleg.locator(".nube-mapa[data-escrito=si]").waitFor({ timeout: 10000 });
    await lleg.locator("[data-cuenta]").waitFor({ timeout: 5000 });
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await page.keyboard.press("Escape");
    await page.locator("[data-tour=llegada-melki][data-fase=vuelve]").waitFor({ timeout: 5000 });
    await lleg.waitFor({ state: "detached", timeout: 8000 });
    // Una coordenada: la señala (el sitio late), sin punto rojo ni tarjeta; el botón de la nube inscribe el nodo ahí
    const antes = await page.locator("[data-tour=lista-antenas] > li").count();
    await chat.getByRole("textbox").fill("llévame a 4.25, -73.30");
    await chat.getByRole("textbox").press("Enter");
    await page.locator("[data-tour=llegada-melki][data-fase=llego]").waitFor({ timeout: 15000 });
    await page.waitForTimeout(2900);
    afirmar((await lleg.getAttribute("data-gesto")) === "senalando" && (await lleg.locator(".pitch-anillo").count()) === 1, `En una coordenada debería señalar el sitio (${await lleg.getAttribute("data-gesto")})`);
    afirmar((await page.locator(".pin-punto").count()) === 0 && (await page.getByRole("dialog", { name: "Punto marcado" }).count()) === 0, "Sin punto rojo ni tarjeta: lo señala Melki");
    // Sus datos reales: el nodo más cercano (con la red del ejemplo); la voz sigue apagada
    afirmar(/Nodo más cercano/.test(await lleg.locator(".nube-mapa").textContent()), "En una coordenada la nube debería decir cuál es el nodo más cercano");
    afirmar((await lleg.getAttribute("data-voz")) === "no" && !(await page.evaluate(() => window.speechSynthesis.speaking)), "Con la voz apagada no debería hablar");
    await foto("coordenada");
    await lleg.locator(".nube-mapa").getByRole("button", { name: "Inscribir un nodo antena ahí" }).click();
    await page.waitForFunction((n) => document.querySelectorAll("[data-tour=lista-antenas] > li").length === n + 1, antes, { timeout: 10000 });
    await lleg.waitFor({ state: "detached", timeout: 8000 });
    afirmar(await chat.getByRole("button", { name: "Inscribir un nodo antena ahí" }).last().isDisabled(), "El botón de la conversación debería quedar usado");
    // (que termine la simulación del nodo nuevo y su resultado quede escrito)
    await page.waitForFunction(() => !document.querySelector("[role=progressbar]"), null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    // Con la voz encendida desde la conversación, al llegar Melki lo dice en voz alta (y no antes): una sola vez
    await chat.getByRole("button", { name: "Escuchar las respuestas" }).click();
    const antesVoz = await page.evaluate(() => window.__voz.dicho.length);
    await chat.getByRole("textbox").fill("ubícame en Cumaral");
    await chat.getByRole("textbox").press("Enter");
    await page.locator("[data-tour=llegada-melki][data-fase=llego]").waitFor({ timeout: 15000 });
    await page.waitForFunction((n) => /Esto es Cumaral \(Meta\)/.test(window.__voz.dicho.slice(n).join(" ")), antesVoz, { timeout: 15000 });
    await page.waitForFunction(() => !window.speechSynthesis.speaking, null, { timeout: 20000 });
    const dicho = await page.evaluate((n) => window.__voz.dicho.slice(n), antesVoz);
    afirmar(!dicho.some((x) => /Lo llevé a Cumaral/.test(x)) && dicho.filter((x) => /Esto es Cumaral/.test(x)).length === 1, `Al llegar debería decirlo una sola vez (sin la respuesta de la conversación): ${dicho.join(" | ").slice(0, 300)}`);
    await lleg.locator(".nube-mapa[data-escrito=si]").waitFor({ timeout: 15000 });
    await lleg.locator("[data-cuenta]").waitFor({ timeout: 5000 });
    await foto("voz-al-llegar");
    await lleg.getByRole("button", { name: "Cerrar (Melki vuelve a su lugar)" }).click();
    await lleg.waitFor({ state: "detached", timeout: 8000 });
  },
  { tamano: { width: 1920, height: 1080 }, preparar: (page) => page.addInitScript(manosLibresDeMentira) },
);

await flujo(
  "llegada-movil",
  async (page, foto) => {
    await esperarSimulacion(page).catch(() => {});
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByRole("textbox").fill("ubícame en Cumaral");
    await chat.getByRole("textbox").press("Enter");
    // En el celular la conversación se recoge para ver llegar a Melki (lo que responde va en su nube)
    await chat.waitFor({ state: "detached", timeout: 10000 });
    await page.locator("[data-tour=llegada-melki][data-fase=llego]").waitFor({ timeout: 15000 });
    const nube = page.locator("[data-tour=llegada-melki] .nube-mapa");
    await nube.waitFor({ timeout: 5000 });
    const b = await nube.boundingBox();
    afirmar(b.x >= 0 && b.x + b.width <= 390 && b.y + b.height <= 844, `En el celular la nube debería caber (${Math.round(b.x)}, ${Math.round(b.width)} × ${Math.round(b.height)})`);
    afirmar(/Cumaral/.test(await nube.textContent()), "La nube debería decir dónde llegó");
    await foto("saludo");
    await page.locator("[data-tour=llegada-melki]").getByRole("button", { name: "Cerrar (Melki vuelve a su lugar)" }).click();
    await page.locator("[data-tour=llegada-melki]").waitFor({ state: "detached", timeout: 8000 });
  },
  { tamano: { width: 390, height: 844 } },
);

const ia = await iniciarIADeMentira();
await flujo(
  "ia-en-vivo",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    const estado = ia.estado;
    // Ajustes → Conversar con IA: la clave queda solo en el navegador; probar la conexión
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByRole("button", { name: "Ajustes de voz" }).click();
    const sec = chat.locator("[data-tour=ajustes-ia]");
    await sec.waitFor();
    await sec.getByLabel("Clave de Google AI Studio").fill("clave-de-prueba-e2e");
    await sec.getByRole("button", { name: "Guardar" }).click();
    afirmar((await page.evaluate(() => localStorage.getItem("simulador-cobertura-melki-ia-clave"))) === "clave-de-prueba-e2e", "La clave no quedó en el navegador");
    afirmar((await sec.getByRole("switch", { name: /Usar la IA en el Asistente Melki/ }).getAttribute("aria-checked")) === "true", "Al guardar la clave se enciende la IA");
    await sec.getByRole("button", { name: /Probar conexión/ }).click();
    await sec.getByText(/Conectado con Gemini 3\.8 Live/).waitFor({ timeout: 15000 });
    afirmar(estado.claves.at(-1) === "clave-de-prueba-e2e" && estado.setups.at(-1)?.model === "models/gemini-3.8-live", `La conexión no lleva la clave o el modelo: ${JSON.stringify(estado.setups.at(-1)?.model)}`);
    await foto("ajustes-ia");
    await chat.getByRole("button", { name: "Cerrar conversación" }).click();
    // Activar el asistente: conversa con la IA (oye el audio del micrófono y contesta con voz)
    await page.getByRole("button", { name: "Activar el Asistente Melki" }).first().click();
    const hud = page.locator("[data-tour=hud-voz]");
    await hud.waitFor({ timeout: 15000 });
    await page.locator("[data-tour=hud-voz][data-ia=si]").waitFor({ timeout: 15000 });
    await hud.getByText("IA en vivo").waitFor();
    for (let k = 0; k < 60 && !estado.textos.some((t) => /^\(El usuario te acaba de llamar/.test(t)); k++) await page.waitForTimeout(250);
    afirmar(estado.textos.some((t) => /^\(El usuario te acaba de llamar/.test(t)), "La IA no recibió el saludo");
    const s = estado.setups.at(-1);
    const nombres = (s.tools?.[0]?.functionDeclarations ?? []).map((f) => f.name);
    afirmar(["ejecutar_orden", "estado_simulador", "consultar_melki", "presentacion", "terminar_conversacion"].every((n) => nombres.includes(n)), `Faltan herramientas: ${nombres}`);
    afirmar(/Eres Melki/.test(s.systemInstruction.parts[0].text) && /Estado del simulador al empezar/.test(s.systemInstruction.parts[0].text), "Las instrucciones no traen quién es Melki ni el estado");
    afirmar(s.generationConfig.responseModalities[0] === "AUDIO" && s.inputAudioTranscription && s.outputAudioTranscription, "La sesión no pide voz y subtítulos");
    // Con parlantes (lo de siempre) la IA no se deja interrumpir por lo que oye: sería su propia voz
    afirmar(s.realtimeInputConfig?.activityHandling === "NO_INTERRUPTION", `Con parlantes la IA no debería interrumpirse con su eco: ${JSON.stringify(s.realtimeInputConfig)}`);
    await page.waitForFunction(() => document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") === "atento", null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    afirmar(estado.audios >= 5, `El micrófono no manda audio a la IA (${estado.audios} trozos)`);
    // Mientras sonaba su saludo, el micrófono mandó silencio; ahora que calla, manda la voz de la persona
    afirmar(estado.silencios >= 2, `Mientras habla la IA, el micrófono debería mandar silencio (${estado.silencios} de ${estado.audios})`);
    const silenciosAntes = estado.silencios;
    const audiosAntes = estado.audios;
    await page.waitForTimeout(800);
    afirmar(estado.audios - audiosAntes >= 3 && estado.silencios === silenciosAntes, `Callada la IA, el micrófono debería mandar la voz (${estado.audios - audiosAntes} trozos, ${estado.silencios - silenciosAntes} en silencio)`);
    // La voz local no suena encima de la IA
    afirmar(!/Soy Melki con inteligencia artificial/.test(await page.evaluate(() => window.__voz.dicho.join(" "))), "La voz del equipo no debería repetir lo que dice la IA");
    await foto("conversando");
    // Una orden: la IA llama a ejecutar_orden y el simulador la hace (con el intérprete de Melki)
    const antes = await page.locator("[data-tour=lista-piezas] li").count();
    afirmar(ia.decir("pon un repetidor en 4.235, -73.335"), "No había conversación abierta");
    await page.waitForFunction((n) => document.querySelectorAll("[data-tour=lista-piezas] li").length > n, antes, { timeout: 30000 });
    await page.waitForFunction(() => /Listo, señor/.test(document.querySelector("[data-tour=hud-voz]")?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
    afirmar(estado.respuestas.some((r) => r.name === "ejecutar_orden" && /repetidor|nodo|pieza/i.test(String(r.response?.resultado))), `La orden no devolvió el resultado: ${JSON.stringify(estado.respuestas.at(-1))}`);
    // Una pregunta con números: los toma del estado del simulador (no los inventa)
    ia.decir("¿cuánto cuesta la red?");
    await page.waitForFunction(() => /pesos de inversión/.test(document.querySelector("[data-tour=hud-voz]")?.textContent ?? ""), null, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => true, null);
    for (let k = 0; k < 40 && !estado.respuestas.some((r) => r.name === "estado_simulador"); k++) await page.waitForTimeout(250);
    const est = estado.respuestas.find((r) => r.name === "estado_simulador")?.response?.estado;
    afirmar(est?.costos?.inversionTotal > 0 && est.repetidores >= 2 && est.infraestructura?.length >= 3, `El estado no trae la red y sus costos: ${JSON.stringify(est?.costos)}`);
    // Lo conversado queda escrito
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    await chat.getByText("¿cuánto cuesta la red?").waitFor({ timeout: 10000 });
    await chat.getByText(/Soy Melki con inteligencia artificial/).waitFor();
    await chat.getByText(/pesos de inversión/).waitFor({ timeout: 10000 });
    await chat.getByRole("button", { name: "Cerrar conversación" }).click();
    // Google cierra cada conexión a los 10 minutos (avisa antes): Melki sigue la misma conversación en otra
    // (cuenta las configuraciones: la conexión ya abrió y mandó con qué manija reanuda)
    const esperarConexion = async (n, que) => {
      for (let k = 0; k < 60 && estado.setups.length < n; k++) await page.waitForTimeout(250);
      afirmar(estado.setups.length >= n, `No se abrió la conexión nueva (${que})`);
      afirmar(/^manija-\d+$/.test(estado.setups.at(-1)?.sessionResumption?.handle ?? ""), `La conexión nueva no reanuda la conversación (${que}): ${JSON.stringify(estado.setups.at(-1)?.sessionResumption)}`);
      for (let k = 0; k < 40 && !estado.abierta; k++) await page.waitForTimeout(100);
    };
    afirmar(estado.setups.at(-1)?.sessionResumption && !estado.setups.at(-1).sessionResumption.handle, "La primera conexión pide manijas para reanudar");
    let conexiones = estado.setups.length;
    ia.adios();
    await esperarConexion(conexiones + 1, "aviso de Google");
    await page.locator("[data-tour=hud-voz][data-ia=si]").waitFor();
    let r0 = estado.respuestas.length;
    ia.decir("¿cuánto cuesta la red?");
    for (let k = 0; k < 60 && estado.respuestas.length === r0; k++) await page.waitForTimeout(250);
    afirmar(estado.respuestas.length > r0, "Tras reanudar, la IA no siguió usando el simulador");
    // Si la red se cae de golpe, también reanuda
    await page.waitForFunction(() => document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") === "atento", null, { timeout: 15000 });
    conexiones = estado.setups.length;
    ia.cortar();
    await esperarConexion(conexiones + 1, "corte de la red");
    await page.locator("[data-tour=hud-voz][data-ia=si]").waitFor();
    r0 = estado.respuestas.length;
    ia.decir("¿cuánto cuesta la red?");
    for (let k = 0; k < 60 && estado.respuestas.length === r0; k++) await page.waitForTimeout(250);
    afirmar(estado.respuestas.length > r0, "Tras el corte, la IA no siguió usando el simulador");
    await page.waitForFunction(() => document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") === "atento", null, { timeout: 15000 });
    // El pitch narrado por la IA: avanza cuando la IA termina cada capítulo
    ia.decir("preséntame el modelo de negocio");
    const pitch = page.locator("[data-tour=pitch]");
    try {
      await pitch.waitFor({ timeout: 15000 });
    } catch {
      throw new Error(`No se abrió el pitch: ${JSON.stringify(estado.respuestas.slice(-2)).slice(0, 400)} · textos ${JSON.stringify(estado.textos.slice(-3))}`);
    }
    await page.waitForFunction(() => /Pitch · 2 de/.test(document.querySelector("[data-tour=pitch]")?.textContent ?? ""), null, { timeout: 40000 });
    afirmar(estado.narrados >= 1, "La IA no narró el capítulo");
    afirmar(!(await pitch.getByRole("button", { name: /Silenciar la voz|Oír la voz/ }).count()), "Con la IA narrando no se usa la voz del equipo");
    await foto("pitch-ia");
    // Si la conexión se cae a mitad de un capítulo: reanuda, le pide el capítulo otra vez y la presentación sigue
    const capitulo = async () => Number((await pitch.textContent())?.match(/Pitch · (\d+) de/)?.[1] ?? 0);
    estado.pausaNarrar = 6000;
    const n0 = estado.narrados;
    for (let k = 0; k < 80 && estado.narrados === n0; k++) await page.waitForTimeout(150);
    afirmar(estado.narrados > n0, "La IA no empezó a narrar el capítulo siguiente");
    await page.waitForTimeout(400);
    const enCorte = await capitulo();
    conexiones = estado.setups.length;
    const n1 = estado.narrados;
    estado.pausaNarrar = 0;
    ia.cortar();
    await esperarConexion(conexiones + 1, "corte a mitad del pitch");
    for (let k = 0; k < 60 && estado.narrados === n1; k++) await page.waitForTimeout(250);
    afirmar(estado.narrados > n1, "Tras el corte no pidió de nuevo el capítulo que narraba");
    await page.waitForFunction((c) => Number(document.querySelector("[data-tour=pitch]")?.textContent?.match(/Pitch · (\d+) de/)?.[1] ?? 0) > c, enCorte, { timeout: 20000 });
    await page.keyboard.press("Escape");
    await pitch.waitFor({ state: "detached" });
    // El recorrido de la red por la IA: lo abre con su herramienta y dice lo breve de cada punto con su voz
    const puntos0 = estado.puntos;
    ia.decir("explícame la red");
    const rec = page.locator("[data-tour=recorrido-red]");
    await rec.waitFor({ timeout: 15000 });
    afirmar(estado.respuestas.some((r) => r.name === "recorrido_red" && /recorrido/i.test(String(r.response?.resultado))), `La IA no abrió el recorrido: ${JSON.stringify(estado.respuestas.at(-1))}`);
    for (let k = 0; k < 80 && estado.puntos === puntos0; k++) await page.waitForTimeout(150);
    afirmar(estado.puntos > puntos0, "La IA no dijo el primer punto del recorrido");
    afirmar(!(await rec.getByRole("button", { name: /Silenciar la voz|Oír la voz/ }).count()), "Con la IA no se usa la voz del equipo");
    await page.keyboard.press("Escape");
    await rec.waitFor({ state: "detached" });
    // Se despide: cierra la conversación y vuelve a esperar su nombre
    ia.decir("adiós, eso es todo");
    await page.locator("[data-tour=hud-voz][data-ia=si]").waitFor({ state: "detached", timeout: 20000 });
    await page.waitForFunction(() => ["dormido", "apagado", null].includes(document.querySelector("[data-tour=hud-voz]")?.getAttribute("data-estado") ?? null), null, { timeout: 20000 });
    // Si la clave no sirve, lo dice y sigue con su cerebro local
    estado.rechazar = "API key not valid. Please pass a valid API key.";
    await page.getByRole("button", { name: /Activar el Asistente Melki|Apagar el Asistente Melki/ }).first().click();
    await page.waitForFunction(() => /No pude conectar con la IA/.test(document.body.innerText), null, { timeout: 20000 });
    afirmar(/no es válida/.test(await page.evaluate(() => document.body.innerText)), "El aviso no explica que la clave no es válida");
    await page.waitForFunction(() => /Bienvenido|Hola, señor/.test(window.__voz.dicho.join(" ")), null, { timeout: 20000 });
    await foto("sin-ia");
    estado.rechazar = null;
  },
  {
    sembrar: true,
    hablar: true,
    preparar: async (page) => {
      await page.addInitScript(manosLibresDeMentira);
      await page.addInitScript(microfonoDeMentira);
      await page.addInitScript((url) => {
        window.__melkiIA = { url };
        const consultar = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) => (d.name === "microphone" ? Promise.resolve({ state: "granted" }) : consultar(d));
      }, ia.url);
    },
  },
);

// v13.2: con la IA y sin voz (lo normal), la IA oye, hace las órdenes y su respuesta queda escrita; su audio no suena,
// el micrófono no se calla nunca y se le puede hablar encima.
await flujo(
  "ia-por-escrito",
  async (page, foto) => {
    await esperarRed(page);
    await cargarMalla(page);
    const estado = ia.estado;
    const setups0 = estado.setups.length;
    const silencios0 = estado.silencios;
    const audios0 = estado.audios;
    await page.getByRole("button", { name: "Activar el Asistente Melki" }).first().click();
    const hud = page.locator("[data-tour=hud-voz][data-ia=si]");
    await hud.waitFor({ timeout: 15000 });
    for (let k = 0; k < 60 && estado.setups.length === setups0; k++) await page.waitForTimeout(250);
    const s = estado.setups.at(-1);
    afirmar(estado.setups.length > setups0 && /NO oye tu voz/.test(s.systemInstruction.parts[0].text), "Sin voz, la IA debería saber que su respuesta va escrita");
    afirmar(!s.realtimeInputConfig, `Sin voz no hay eco: la IA debería dejarse interrumpir (${JSON.stringify(s.realtimeInputConfig)})`);
    // Su saludo queda escrito en la barra (el tiempo de leerlo)
    await page.waitForFunction(() => /Soy Melki con inteligencia artificial/.test(document.querySelector("[data-tour=hud-voz]")?.textContent ?? ""), null, { timeout: 15000 });
    // Una orden: la hace y lo confirma por escrito
    const antes = await page.locator("[data-tour=lista-piezas] li").count();
    afirmar(ia.decir("pon un repetidor en 4.235, -73.335"), "No había conversación abierta");
    await page.waitForFunction((n) => document.querySelectorAll("[data-tour=lista-piezas] li").length > n, antes, { timeout: 30000 });
    await page.waitForFunction(() => /Listo, señor/.test(document.querySelector("[data-tour=hud-voz]")?.textContent ?? ""), null, { timeout: 30000 });
    afirmar(/Le respondo por escrito/.test(await hud.textContent()), "La barra debería decir que responde por escrito");
    await foto("orden");
    await page.waitForTimeout(1500);
    const fuentes = await page.evaluate(() => window.__fuentesAudio ?? 0);
    afirmar(fuentes === 0, `Sin voz, el audio de la IA no debería sonar (${fuentes} trozos)`);
    afirmar(estado.audios - audios0 >= 5 && estado.silencios === silencios0, `Sin voz, el micrófono manda siempre la voz de la persona (${estado.audios - audios0} trozos, ${estado.silencios - silencios0} en silencio)`);
    afirmar((await page.evaluate(() => window.__voz.dicho.length)) === 0, "La voz del equipo tampoco debería hablar");
    // Queda escrito en la conversación
    await page.getByRole("button", { name: /Abrir a Melki/ }).click();
    const chat = page.getByRole("region", { name: "Conversación con Melki" });
    await chat.getByText(/Soy Melki con inteligencia artificial/).waitFor({ timeout: 10000 });
    await chat.getByText(/Listo, señor/).first().waitFor({ timeout: 10000 });
    await chat.getByRole("button", { name: "Cerrar conversación" }).click();
    // Se despide: cierra la conversación con la IA
    ia.decir("adiós, eso es todo");
    await hud.waitFor({ state: "detached", timeout: 20000 });
  },
  {
    sembrar: true,
    preparar: async (page) => {
      await page.addInitScript(manosLibresDeMentira);
      await page.addInitScript(microfonoDeMentira);
      await page.addInitScript((url) => {
        window.__melkiIA = { url };
        // La clave ya guardada y la IA encendida
        localStorage.setItem("simulador-cobertura-melki-ia-clave", "clave-de-prueba-e2e");
        const k = "simulador-cobertura-melki-v1";
        const p = JSON.parse(localStorage.getItem(k) ?? "{}");
        localStorage.setItem(k, JSON.stringify({ ...p, visto: true, ia: { ...(p.ia ?? {}), activa: true } }));
        const consultar = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (d) => (d.name === "microphone" ? Promise.resolve({ state: "granted" }) : consultar(d));
        // Cuenta los trozos de audio que suenan (la voz de la IA)
        window.__fuentesAudio = 0;
        const empezar = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...a) {
          window.__fuentesAudio++;
          return empezar.apply(this, a);
        };
      }, ia.url);
    },
  },
);
await ia.cerrar();


let fallos = 0;
for (const r of resultados) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.nombre}${r.ok ? "" : ` — ${r.error}`}`);
  for (const a of r.avisos.slice(0, 5)) console.log(`    aviso: ${a}`);
  if (!r.ok) fallos++;
}
await navegador.close();
process.exit(fallos ? 1 : 0);
