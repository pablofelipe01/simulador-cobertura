// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Arma los paquetes de avance para probar sin instalar nada (con INSTRUCTIVO.txt):
//  • SIMULADOR_avance_<fecha>_HTML.zip – «SIMULADOR.html» con doble clic (siempre)
//  • SIMULADOR_avance_<fecha>.zip      – servidor autónomo + Node.js portátil + lanzador .bat (solo al ejecutarlo en Windows)
//
//   npm run paquete                               → dist/
//   npm run paquete -- --destino "C:\…\avances"   → en esa carpeta
// Si ya hay un paquete del mismo día en el destino, el nuevo se nombra _v2, _v3… (o se fuerza con --version 2).
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { construirHtml, licenciaWindows } from "./html/build.mjs";
import { comprimirCarpeta } from "./zip.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plantillas = path.join(repo, "scripts", "paquete");
const iDestino = process.argv.indexOf("--destino");
const destino = path.resolve(iDestino > 1 && process.argv[iDestino + 1] ? process.argv[iDestino + 1] : path.join(repo, "dist"));
const conServidor = process.platform === "win32";

const CARPETA_HTML = "SIMULADOR-HTML";
const CARPETA = "SIMULADOR-Servidor";
const PUERTO = 3200; // igual que scripts/paquete/iniciar.mjs
const hoy = new Date();
const dos = (n) => String(n).padStart(2, "0");
const fechaIso = `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
const fecha = `${dos(hoy.getDate())}/${dos(hoy.getMonth() + 1)}/${hoy.getFullYear()}`;
const iVersion = process.argv.indexOf("--version");
let version = iVersion > 1 && Number(process.argv[iVersion + 1]) > 1 ? `_v${Number(process.argv[iVersion + 1])}` : "";
for (let v = 2; !version && existsSync(path.join(destino, `SIMULADOR_avance_${fechaIso}_HTML.zip`)); v++) {
  if (!existsSync(path.join(destino, `SIMULADOR_avance_${fechaIso}_v${v}_HTML.zip`))) version = `_v${v}`;
}
const zipHtml = `SIMULADOR_avance_${fechaIso}${version}_HTML.zip`;
const zipServidor = `SIMULADOR_avance_${fechaIso}${version}.zip`;
const staging = path.join(repo, "dist", ".paquete");
const paso = (t) => console.log(`\n▸ ${t}`);

let commit = "sin commit";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  if (execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" }).trim()) commit += " + cambios locales sin commit";
} catch {
  // Repositorio sin commits o sin git
}

// 1. Compilar
paso(`Compilando la app (next build${conServidor ? ", servidor autónomo" : ""})…`);
const build = spawnSync(process.execPath, [path.join(repo, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: repo,
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...(conServidor ? { SIMULADOR_STANDALONE: "1" } : {}) },
});
if (build.status !== 0) process.exit(build.status ?? 1);
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

// 2. Versión HTML
paso("Generando la versión HTML…");
const html = await construirHtml(path.join(staging, CARPETA_HTML));

// 3. Versión con servidor (solo en Windows: copia el node.exe de este equipo)
const raiz = path.join(staging, CARPETA);
if (conServidor) {
  paso("Armando la versión con servidor…");
  const standalone = path.join(repo, ".next", "standalone");
  if (!existsSync(path.join(standalone, "server.js"))) throw new Error("Falta .next/standalone/server.js (revise `output` en next.config.ts).");
  const app = path.join(raiz, "app");
  cpSync(standalone, app, { recursive: true, dereference: true });
  cpSync(path.join(repo, ".next", "static"), path.join(app, ".next", "static"), { recursive: true });
  cpSync(path.join(repo, "public"), path.join(app, "public"), { recursive: true, dereference: true });
  const runtime = path.join(raiz, "runtime");
  mkdirSync(runtime, { recursive: true });
  copyFileSync(process.execPath, path.join(runtime, path.basename(process.execPath)));
  copyFileSync(path.join(plantillas, "iniciar.mjs"), path.join(runtime, "iniciar.mjs"));
  writeFileSync(path.join(runtime, "LICENSE-node.txt"), `Node.js ${process.version} (licencia MIT): https://github.com/nodejs/node/blob/${process.version}/LICENSE\n`);
  // .bat sin tildes: cmd.exe lee el archivo con la página de códigos del sistema
  const bat = [
    "@echo off",
    "title Simulador de cobertura",
    'pushd "%~dp0"',
    'if not exist "runtime\\node.exe" goto sinextraer',
    'if not exist "app\\server.js" goto sinextraer',
    '"runtime\\node.exe" "runtime\\iniciar.mjs"',
    "if errorlevel 1 pause",
    "exit /b",
    "",
    ":sinextraer",
    "echo.",
    "echo   Primero hay que descomprimir el ZIP completo:",
    'echo   clic derecho sobre el ZIP ^> "Extraer todo..." ^> Extraer.',
    "echo   Luego abra la carpeta extraida y vuelva a hacer doble clic en este archivo.",
    "echo.",
    "pause",
  ];
  writeFileSync(path.join(raiz, "Iniciar SIMULADOR.bat"), bat.join("\r\n") + "\r\n");
}

// 4. Instructivo (UTF-8 con BOM y CRLF para el Bloc de notas de Windows)
const opcionServidor = conServidor
  ? `
OPCIÓN B · Con servidor local   (${zipServidor})
1) Extraiga el ZIP y, en la carpeta "${CARPETA}", haga doble clic en
   "Iniciar SIMULADOR.bat". Si Windows muestra un aviso, pulse
   "Más información" > "Ejecutar de todas formas".
2) Se abre una ventana negra y luego el navegador en
   http://localhost:${PUERTO}. Deje la ventana abierta mientras prueba.
`
  : "";
const contenidoServidor = conServidor
  ? `  ${zipServidor}
    Iniciar SIMULADOR.bat  arranca el simulador con servidor (Windows)
    LICENCIA.txt           autoría, titulares y licencia de uso
    app\\                   la aplicación compilada (Next.js)
    runtime\\               Node.js portátil y el lanzador
`
  : "";
const instructivo =
  "\uFEFF" +
  readFileSync(path.join(plantillas, "INSTRUCTIVO.txt"), "utf8")
    .replaceAll("{{FECHA}}", fecha)
    .replaceAll("{{COMMIT}}", commit)
    .replaceAll("{{ZIP_HTML}}", zipHtml)
    .replaceAll("{{OPCION_SERVIDOR}}", opcionServidor)
    .replaceAll("{{CONTENIDO_SERVIDOR}}", contenidoServidor)
    .replace(/\r?\n/g, "\r\n");
writeFileSync(path.join(html, "INSTRUCTIVO.txt"), instructivo);
if (conServidor) {
  writeFileSync(path.join(raiz, "INSTRUCTIVO.txt"), instructivo);
  writeFileSync(path.join(raiz, "LICENCIA.txt"), licenciaWindows());
}

// 5. Comprimir
paso("Comprimiendo…");
mkdirSync(destino, { recursive: true });
const mb = (f) => (statSync(f).size / 1024 / 1024).toFixed(1);
comprimirCarpeta(html, path.join(destino, zipHtml));
if (conServidor) comprimirCarpeta(raiz, path.join(destino, zipServidor));
writeFileSync(path.join(destino, "INSTRUCTIVO.txt"), instructivo);
rmSync(staging, { recursive: true, force: true });

console.log(`
✓ Paquetes listos en ${destino}
  ${zipHtml} (${mb(path.join(destino, zipHtml))} MB) – doble clic en SIMULADOR.html${
    conServidor ? `\n  ${zipServidor} (${mb(path.join(destino, zipServidor))} MB) – Iniciar SIMULADOR.bat` : "\n  (La versión con servidor se arma al ejecutar este comando en Windows.)"
  }
  INSTRUCTIVO.txt
`);
