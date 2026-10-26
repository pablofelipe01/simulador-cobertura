// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Cómo se llaman el gateway medido y sus antenas. Los valores técnicos de la ficha están en `protocolos.ts`; aquí
// solo van los nombres, con los que el simulador y Melki los muestran. En esta copia van genéricos: sin el nombre del
// sitio, sin los IDs de los nodos y sin las distancias.

export type IdentidadAntena = {
  nombre: string;
  /** ID del nodo en la malla, si se puede mostrar. */
  nodo: string | null;
  /** Distancia al gateway (km), si se puede mostrar. */
  distanciaKm: number | null;
};

export const IDENTIDAD_GATEWAY = {
  /** Nombre del gateway. */
  nombre: "Gateway medido",
  /** Texto del botón del perfil de tráfico medido. */
  medidoEn: "Medido en el gateway",
  /** Cómo se nombra dentro de una frase («lo medido en …»). */
  enFrase: "un gateway real",
  equipo: "Raspberry Pi 5 con un radio Heltec V3 por USB serial (CP2102)",
  servicio: "Servicio del gateway (systemd, reinicio automático); valida y registra en una base de datos por HTTPS",
  /** Palabras con que Melki reconoce que se habla de este gateway, además de «lo medido» o «ficha técnica». */
  claves: [] as string[],
  /** Las antenas de la ficha, en el mismo orden que sus medidas. */
  antenas: [
    { nombre: "Antena A (router solar)", nodo: null, distanciaKm: null },
    { nombre: "Antena B", nodo: null, distanciaKm: null },
    { nombre: "Antena C", nodo: null, distanciaKm: null },
    { nombre: "Antena D", nodo: null, distanciaKm: null },
    { nombre: "Antena E", nodo: null, distanciaKm: null },
  ] as IdentidadAntena[],
};
