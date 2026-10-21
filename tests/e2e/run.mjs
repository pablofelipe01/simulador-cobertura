// Ejecuta las pruebas de extremo a extremo (capturas en dist/e2e).
//   npm run e2e                                         → contra http://localhost:3000 (npm run dev o npm start)
//   $env:BASE="file:///C:/…/SIMULADOR.html"; npm run e2e  → contra la versión HTML
//   CHROME_PATH=/ruta/a/chrome npm run e2e               → con otro navegador basado en Chromium
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const salida = path.resolve(aqui, "..", "..", "dist", "e2e");
console.log(`Pruebas E2E contra ${process.env.BASE ?? "http://localhost:3000/"}\n`);
const r = spawnSync(process.execPath, [path.join(aqui, "simulador.mjs"), salida], { stdio: "inherit" });
console.log(r.status === 0 ? "\n✓ Todas las pruebas pasaron" : "\n✗ Hay pruebas con fallos (ver capturas en dist/e2e)");
process.exit(r.status ?? 1);
