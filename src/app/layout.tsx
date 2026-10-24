// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

import type { Metadata, Viewport } from "next";

import { AUTOR, DERECHOS, EMPRESA } from "@/lib/autoria";

// Tipografías alojadas en el proyecto (sin solicitudes a servicios externos)
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-semi-condensed/latin-500.css";
import "@fontsource/barlow-semi-condensed/latin-600.css";
import "@fontsource/barlow-semi-condensed/latin-700.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulador de cobertura · Red mesh LoRa 915 MHz",
  description: "Simula la cobertura de la red por radio de Trama (MeshCore, LoRa 915–928 MHz), que lleva pagos, mensajes de WhatsApp y consultas a la inteligencia artificial a donde no hay señal: repetidores, gateway, cuánto tráfico aguanta cada frecuencia y la factibilidad de la red.",
  robots: { index: false, follow: false },
  authors: [{ name: AUTOR }],
  creator: AUTOR,
  publisher: EMPRESA,
  other: { copyright: DERECHOS },
};

export const viewport: Viewport = {
  themeColor: "#F4F2EE",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
