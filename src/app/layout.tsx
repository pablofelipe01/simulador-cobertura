import type { Metadata, Viewport } from "next";

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
  description: "Simula la cobertura de la red de pagos por radio de Trama (MeshCore, LoRa 915–928 MHz) sobre el relieve real: repetidores, gateway, cuántos pagos aguanta cada frecuencia y la factibilidad de la red.",
  robots: { index: false, follow: false },
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
