// Marcador de antena (torre en celosía) para el mapa. Se arma como HTML porque MapLibre usa elementos del DOM.
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

export function htmlMarcador(antena: Antena, seleccionada: boolean, estado: EstadoNodo, color?: string): string {
  const campo = (antena.tipo ?? "antena") === "nodo";
  const clases = ["torre-marcador", campo ? "es-nodo" : "", `nodo-${estado}`, seleccionada ? "sel" : "", antena.activa ? "" : "inactiva"].filter(Boolean).join(" ");
  const insignia = antena.pasarela
    ? `<span class="insignia" title="Pasarela"><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2"/><path d="M1.8 6 H10.2 M6 1.8 C3.6 4 3.6 8 6 10.2 M6 1.8 C8.4 4 8.4 8 6 10.2"/></svg></span>`
    : "";
  const muestra = color ? `<i class="muestra" style="background:${color}"></i>` : "";
  return `<div class="${clases}">
${
    campo
      ? `<svg class="torre" viewBox="-1 -1 34 41" aria-hidden="true"><g class="halo">${EQUIPO}</g><g class="trazo">${EQUIPO}</g><circle class="baliza" cx="19.5" cy="6.2" r="3"/></svg>`
      : `<svg class="torre" viewBox="-1 -1 34 41" aria-hidden="true"><g class="halo">${TORRE}</g><g class="trazo">${TORRE}</g><circle class="baliza" cx="16" cy="8.4" r="3"/></svg>`
  }
${insignia}<span class="nombre">${muestra}${escapar(antena.nombre)}</span></div>`;
}
