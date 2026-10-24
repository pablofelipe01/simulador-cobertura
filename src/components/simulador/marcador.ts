// Marcador de antena (torre en celosía) para el mapa. Se arma como HTML porque MapLibre usa elementos del DOM.
import type { EstadoNodo as EstadoRedNodo, Pieza } from "@/lib/radio/estado-red";
import type { Antena, NodoMalla } from "@/lib/radio/tipos";

const TORRE = `
<path d="M16 9 L9.5 38 M16 9 L22.5 38 M11.4 29.5 H20.6 M12.9 22.5 H19.1 M14.3 16 H17.7 M11.4 29.5 L19.1 22.5 M20.6 29.5 L12.9 22.5 M12.9 22.5 L17.7 16 M19.1 22.5 L14.3 16 M7 38 H25"/>
<path d="M10.2 3.2 a8 8 0 0 0 0 10.4 M21.8 3.2 a8 8 0 0 1 0 10.4 M7.4 0.9 a12 12 0 0 0 0 15 M24.6 0.9 a12 12 0 0 1 0 15" class="ondas"/>`;

export type EstadoNodo = "sin-simular" | "solida" | "debil" | "aislada" | "pasarela";

export function estadoNodo(antena: Antena, nodo: NodoMalla | undefined): EstadoNodo {
  if (antena.pasarela) return "pasarela";
  if (!nodo) return "sin-simular";
  if (nodo.saltos === null) return "aislada";
  return nodo.cuelloDb !== null && nodo.cuelloDb >= 30 ? "solida" : "debil";
}

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Equipo de campo (radio, sensor): cuerpo redondeado con antena corta. */
const EQUIPO = `
<path d="M19.5 6 V17"/>
<rect x="10" y="16" width="13" height="20" rx="3.2"/>
<path d="M13.2 22 H19.8 M13.2 26 H19.8 M13.2 30 H17"/>`;

/** Persona (modo «Sembrar la malla»): cabeza y torso; se pinta verde, roja o ámbar según su conexión. */
const PERSONA = `
<circle cx="16" cy="9.6" r="5.4"/>
<path d="M6.6 37 V28.4 a9.4 9.4 0 0 1 18.8 0 V37 Z"/>`;

const GLOBO = `<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2"/><path d="M1.8 6 H10.2 M6 1.8 C3.6 4 3.6 8 6 10.2 M6 1.8 C8.4 4 8.4 8 6 10.2"/></svg>`;

/** Datos extra del modo «Sembrar la malla»: la pieza, su estado frente al gateway y los saltos. */
export type MarcaRed = { pieza: Pieza; estado: EstadoRedNodo; saltos: number | null };

const TEXTO_RED: Record<EstadoRedNodo, string> = {
  gateway: "Gateway + Internet",
  conectado: "Conectado al gateway",
  lejos: "Llega con más saltos que el límite",
  "sin-cobertura": "Sin cobertura",
  aislado: "No alcanza la red",
  pendiente: "Calculando…",
};

export function htmlMarcador(antena: Antena, seleccionada: boolean, estado: EstadoNodo, color?: string, red?: MarcaRed): string {
  const campo = (antena.tipo ?? "antena") === "nodo";
  const persona = red?.pieza === "persona";
  const clases = [
    "torre-marcador",
    campo ? "es-nodo" : "",
    persona ? "es-persona" : "",
    antena.poblada ? "poblada" : "",
    red ? `red-${red.estado}` : `nodo-${estado}`,
    seleccionada ? "sel" : "",
    antena.activa ? "" : "inactiva",
  ]
    .filter(Boolean)
    .join(" ");
  const insignia = antena.pasarela ? `<span class="insignia" title="${red ? "Gateway + Internet" : "Pasarela"}">${GLOBO}</span>` : "";
  const muestra = color ? `<i class="muestra" style="background:${color}"></i>` : "";
  // Saltos hasta el gateway (personas y repetidores conectados)
  const saltos = red && !antena.pasarela && red.saltos !== null ? `<span class="saltos" title="${red.saltos} ${red.saltos === 1 ? "salto" : "saltos"} hasta el gateway">${red.saltos}</span>` : "";
  // Repetidor que no alcanza la red: aro naranja punteado, como en Trama
  const aura = red?.estado === "aislado" ? `<span class="aura" aria-hidden="true"></span>` : "";
  const figura = persona
    ? `<svg class="torre" viewBox="-1 -1 34 41" aria-hidden="true"><g class="halo">${PERSONA}</g><g class="trazo">${PERSONA}</g></svg>`
    : campo
      ? `<svg class="torre" viewBox="-1 -1 34 41" aria-hidden="true"><g class="halo">${EQUIPO}</g><g class="trazo">${EQUIPO}</g><circle class="baliza" cx="19.5" cy="6.2" r="3"/></svg>`
      : `<svg class="torre" viewBox="-1 -1 34 41" aria-hidden="true"><g class="halo">${TORRE}</g><g class="trazo">${TORRE}</g><circle class="baliza" cx="16" cy="8.4" r="3"/></svg>`;
  const titulo = red ? ` title="${escapar(antena.nombre)}: ${TEXTO_RED[red.estado]}"` : "";
  return `<div class="${clases}"${titulo}>${aura}
${figura}
${insignia}${saltos}<span class="nombre">${muestra}${escapar(antena.nombre)}</span></div>`;
}

/** Repetidor propuesto por el sembrado automático (aún no puesto): torre fantasma con su enlace. */
export function htmlPropuesto(nombre: string, margenDb: number): string {
  return `<div class="torre-marcador propuesto" title="${escapar(nombre)}: propuesto, ${Math.round(margenDb)} dB con el nodo anterior">
<svg class="torre" viewBox="-1 -1 34 41" aria-hidden="true"><g class="halo">${TORRE}</g><g class="trazo">${TORRE}</g><circle class="baliza" cx="16" cy="8.4" r="3"/></svg>
<span class="nombre">${escapar(nombre)}</span></div>`;
}

/* ───────────── Modo «Sembrar la malla»: piezas redondas que brillan, laten y parpadean ───────────── */

/** Figuras blancas sobre el disco (24 × 24). */
const GLIFO: Record<Pieza, string> = {
  // Router con antenas y wifi: el gateway va junto al router de internet
  gateway: `<path d="M8.6 8.4 a4.9 4.9 0 0 1 6.8 0 M6.3 6 a8.2 8.2 0 0 1 11.4 0"/><rect x="3.6" y="12.2" width="16.8" height="6.6" rx="1.8"/><path d="M7.4 12.2 L6 9.6 M16.6 12.2 L18 9.6"/><circle cx="7.6" cy="15.5" r=".9" class="lleno"/><circle cx="10.6" cy="15.5" r=".9" class="lleno"/>`,
  // Torre con ondas
  repetidor: `<path d="M12 7.2 L8.3 20.4 M12 7.2 L15.7 20.4 M9.4 16.3 H14.6 M10.3 12.6 H13.7 M6.8 20.4 H17.2"/><path d="M8.9 3.4 a4.6 4.6 0 0 0 0 6.2 M15.1 3.4 a4.6 4.6 0 0 1 0 6.2"/><circle cx="12" cy="6.4" r="1.3" class="lleno"/>`,
  // Persona
  persona: `<circle cx="12" cy="8.2" r="3.4"/><path d="M5.6 20.2 a6.4 6.4 0 0 1 12.8 0"/>`,
};

/** Nube con «IA»: el gateway lleva el cerebro de inteligencia artificial. */
const NUBE_IA = `<svg viewBox="0 0 30 20" aria-hidden="true"><path d="M8.6 18.5 H22.4 a5.4 5.4 0 0 0 .8-10.7 A7.4 7.4 0 0 0 9.2 6.2 a6.2 6.2 0 0 0-.6 12.3 Z"/></svg><b>IA</b>`;

/**
 * Pieza del modo «Sembrar la malla»: disco oscuro con la figura blanca y un aro del color del estado
 * (verde conectado, turquesa el gateway, rojo sin cobertura, naranja sin red). El gateway lleva la nube «IA».
 * Seleccionada, muestra la «×» para quitarla.
 */
export function htmlPieza(antena: Antena, seleccionada: boolean, marca: MarcaRed, conIa: boolean): string {
  const clases = ["pieza", `pieza-${marca.pieza}`, `red-${marca.estado}`, antena.poblada ? "poblada" : "", seleccionada ? "sel" : "", antena.activa ? "" : "inactiva"].filter(Boolean).join(" ");
  const nombre = escapar(antena.nombre);
  const saltos = !antena.pasarela && marca.saltos !== null ? `<span class="saltos" title="${marca.saltos} ${marca.saltos === 1 ? "salto" : "saltos"} hasta el gateway">${marca.saltos}</span>` : "";
  const aura = marca.estado === "aislado" ? `<span class="aura" aria-hidden="true"></span>` : "";
  const ia = conIa && antena.pasarela ? `<span class="pieza-ia" title="El gateway tiene la inteligencia artificial">${NUBE_IA}</span>` : "";
  const quitar = seleccionada ? `<button type="button" class="pieza-quitar" data-quitar title="Quitar ${nombre}" aria-label="Quitar ${nombre}">×</button>` : "";
  return `<div class="${clases}" title="${nombre}: ${TEXTO_RED[marca.estado]}">${aura}<span class="pieza-onda" aria-hidden="true"></span><span class="pieza-disco"><svg viewBox="0 0 24 24" aria-hidden="true">${GLIFO[marca.pieza]}</svg></span>${ia}${saltos}${quitar}<span class="nombre">${nombre}</span></div>`;
}

/** Repetidor propuesto por el sembrado automático, como pieza fantasma. */
export function htmlPiezaPropuesta(nombre: string, margenDb: number): string {
  return `<div class="pieza pieza-repetidor propuesto" title="${escapar(nombre)}: propuesto, ${Math.round(margenDb)} dB con el nodo anterior"><span class="pieza-disco"><svg viewBox="0 0 24 24" aria-hidden="true">${GLIFO.repetidor}</svg></span><span class="nombre">${escapar(nombre)}</span></div>`;
}

/** Radio del disco de las piezas (px): el marcador se corre para que el centro quede en el punto. */
export const RADIO_PIEZA = 16;
