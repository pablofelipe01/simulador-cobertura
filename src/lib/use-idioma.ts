// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

"use client";

// El idioma en los componentes: el que lo usa se vuelve a dibujar cuando cambia (aparte de idioma.ts para que el
// motor de cálculo no cargue React).
import { useSyncExternalStore } from "react";

import { cambioAutomatico, idioma, suscribirIdioma, type Idioma } from "./idioma";

/** El idioma actual; el componente se vuelve a dibujar al cambiarlo. */
export function useIdioma(): Idioma {
  return useSyncExternalStore(suscribirIdioma, idioma, () => "es" as Idioma);
}

/** ¿Está encendido el cambio automático de idioma? */
export function useCambioAutomatico(): boolean {
  return useSyncExternalStore(suscribirIdioma, cambioAutomatico, () => true);
}
