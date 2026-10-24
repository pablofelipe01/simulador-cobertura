// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Arranque de la versión HTML: monta el mismo componente del simulador, sin servidor.
import { createRoot } from "react-dom/client";

import { Simulador } from "@/components/simulador/simulador";

const contenedor = document.getElementById("app");
if (contenedor) {
  try {
    createRoot(contenedor).render(<Simulador />);
  } catch (error) {
    console.error(error);
    contenedor.textContent = "El simulador no pudo iniciar. Recargue la página.";
  }
}
