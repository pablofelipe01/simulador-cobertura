// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Versión HTML: el mismo simulador en una carpeta con «SIMULADOR.html» que se abre con doble clic (sin servidor).
// Los componentes vienen sin cambios de src/; solo el arranque del Web Worker se reemplaza por uno que lo
// arma desde un Blob (los navegadores no cargan workers desde file://). El CSS y las tipografías salen del
// último `next build`.
//
//   npm run html                          → dist/html/SIMULADOR-HTML/
//   node scripts/html/build.mjs <carpeta> → en esa carpeta (requiere un `next build` reciente)
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const aqui = path.join(repo, "scripts", "html");
const ARCHIVOS = "archivos";

// Variables públicas: si existen al compilar se usan; si no, el código usa sus valores por defecto.
const publicas = Object.fromEntries(
  [
    "NEXT_PUBLIC_MAPA_SATELITE_URL",
    "NEXT_PUBLIC_MAPA_ETIQUETAS_URL",
    "NEXT_PUBLIC_MAPA_VIAS_URL",
    "NEXT_PUBLIC_MAPA_TOPOGRAFICO_URL",
    "NEXT_PUBLIC_MAPA_OPENTOPOMAP_URL",
    "NEXT_PUBLIC_MAPA_CALLES_URL",
    "NEXT_PUBLIC_RELIEVE_URL",
    "NEXT_PUBLIC_DICTADO_LIBRERIA_URL",
    "NEXT_PUBLIC_DICTADO_MOTOR_URL",
    "NEXT_PUBLIC_DICTADO_MODELOS_URL",
    "NEXT_PUBLIC_DICTADO_MODELO",
    "NEXT_PUBLIC_IA_LOCAL_LIBRERIA_URL",
    "NEXT_PUBLIC_IA_LOCAL_LIBRERIA_SHA256",
    "NEXT_PUBLIC_IA_LOCAL_MODELO",
  ].map((k) => [
    `process.env.${k}`,
    JSON.stringify(process.env[k] ?? ""),
  ]),
);

const comun = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome111", "edge111", "firefox115", "safari16.4"],
  minify: true,
  legalComments: "none",
  charset: "utf8",
  tsconfig: path.join(repo, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"', ...publicas },
  logLevel: "warning",
};

/** Autoría y licencia (src/lib/autoria.ts), para dejarlas en los archivos que se generan. */
async function leerAutoria() {
  const r = await build({ entryPoints: [path.join(repo, "src", "lib", "autoria.ts")], bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "warning" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
}

/** LICENSE del repositorio como LICENCIA.txt para Windows (con BOM y saltos CRLF, como el instructivo). */
export function licenciaWindows() {
  return "\uFEFF" + readFileSync(path.join(repo, "LICENSE"), "utf8").replace(/\r?\n/g, "\r\n");
}

export async function construirHtml(salida = path.join(repo, "dist", "html", "SIMULADOR-HTML")) {
  const { AVISO_CODIGO, AUTOR, DERECHOS } = await leerAutoria();
  const escapar = (t) => t.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  const next = path.join(repo, ".next");
  const inicio = path.join(next, "server", "app", "index.html");
  if (!existsSync(inicio)) throw new Error("Falta un `next build` reciente (no encuentro .next/server/app/index.html).");
  const html = readFileSync(inicio, "utf8");
  const claseHtml = html.match(/<html[^>]*class="([^"]*)"/)?.[1] ?? "h-full antialiased";
  const claseBody = html.match(/<body[^>]*class="([^"]*)"/)?.[1] ?? "h-full overflow-hidden";
  const hojas = [...new Set([...html.matchAll(/href="\/_next\/static\/chunks\/([^"]+\.css)"/g)].map((m) => m[1]))];

  rmSync(salida, { recursive: true, force: true });
  const archivos = path.join(salida, ARCHIVOS);
  mkdirSync(archivos, { recursive: true });

  // 1) Motor de cálculo (Web Worker) como texto, para crearlo desde un Blob
  const worker = await build({ ...comun, entryPoints: [path.join(repo, "src", "lib", "radio", "motor.worker.ts")], write: false });
  const codigoWorker = worker.outputFiles[0].text;

  // 2) La aplicación
  await build({
    ...comun,
    entryPoints: [path.join(aqui, "main.tsx")],
    outfile: path.join(archivos, "simulador.js"),
    define: { ...comun.define, __MOTOR_WORKER_SRC__: JSON.stringify(codigoWorker) },
    banner: { js: `/*! ${AVISO_CODIGO} Ver LICENCIA.txt. */\nvar process={env:{NODE_ENV:"production"}};` },
    loader: { ".css": "empty" },
    plugins: [
      {
        name: "simulador-shims",
        setup(b) {
          b.onResolve({ filter: /crear-worker$/ }, () => ({ path: path.join(aqui, "shims", "crear-worker.ts") }));
        },
      },
    ],
  });

  // 3) CSS del build de Next (Tailwind, MapLibre y tipografías); «../media/…» apunta a archivos/media
  let css = hojas.map((f) => readFileSync(path.join(next, "static", "chunks", f), "utf8")).join("\n");
  mkdirSync(path.join(archivos, "chunks"), { recursive: true });
  for (const [, fuente] of css.matchAll(/url\(\.\.\/media\/([^)]+)\)/g)) {
    mkdirSync(path.join(archivos, "media"), { recursive: true });
    copyFileSync(path.join(next, "static", "media", fuente), path.join(archivos, "media", fuente));
  }
  css = css.replaceAll("url(/_next/static/media/", "url(../media/");
  writeFileSync(path.join(archivos, "chunks", "simulador.css"), css);

  // Ícono como data: URL (desde file:// el navegador bloquea los íconos externos); el mismo de src/app/icon.svg
  const icono = `data:image/svg+xml,${encodeURIComponent(readFileSync(path.join(repo, "src", "app", "icon.svg"), "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim())}`;

  writeFileSync(
    path.join(salida, "SIMULADOR.html"),
    `<!doctype html>
<!-- ${AVISO_CODIGO.replaceAll("--", "–")} Ver LICENCIA.txt. -->
<html lang="es" class="${claseHtml}">
<head>
<meta charset="utf-8">
<meta name="author" content="${escapar(AUTOR)}">
<meta name="copyright" content="${escapar(DERECHOS)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#F4F2EE">
<meta name="robots" content="noindex, nofollow">
<title>Simulador de cobertura · Red mesh LoRa 915 MHz</title>
<link rel="icon" href="${icono}">
<link rel="stylesheet" href="${ARCHIVOS}/chunks/simulador.css">
</head>
<body class="${claseBody}">
<div id="app" class="h-full"></div>
<noscript>Active JavaScript para usar el simulador.</noscript>
<script src="${ARCHIVOS}/simulador.js" charset="utf-8"></script>
</body>
</html>
`,
  );
  writeFileSync(path.join(salida, "LICENCIA.txt"), licenciaWindows());
  return salida;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const carpeta = await construirHtml(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(`✓ Versión HTML lista: ${path.join(carpeta, "SIMULADOR.html")}`);
}
