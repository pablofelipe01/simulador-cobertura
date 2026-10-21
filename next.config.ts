import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Sin la insignia de Next.js en modo desarrollo (para presentaciones)
  devIndicators: false,
  poweredByHeader: false,
  // `npm run paquete` en Windows: servidor autónomo para el paquete sin instalación
  output: process.env.SIMULADOR_STANDALONE === "1" ? "standalone" : undefined,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
