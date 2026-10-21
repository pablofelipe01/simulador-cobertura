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
