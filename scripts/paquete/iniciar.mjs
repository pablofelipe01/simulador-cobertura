// Lanzador del paquete con servidor (lo llama «Iniciar SIMULADOR.bat»).
// Busca un puerto libre, arranca el servidor autónomo de Next.js y abre el navegador.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servidor = path.join(raiz, "app", "server.js");
// Mismo puerto del instructivo: el navegador guarda los escenarios por dirección.
const PRIMER_PUERTO = Number(process.env.PORT) || 3200;

if (!existsSync(servidor)) {
  console.error("\n  No se encuentra app/server.js. Descomprima el ZIP completo y vuelva a intentarlo.\n");
  process.exit(1);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const direccion = (puerto) => `http://localhost:${puerto}`;
const libre = (puerto) =>
  new Promise((resolve) => {
    const prueba = net.createServer();
    prueba.once("error", () => resolve(false));
    prueba.listen(puerto, "localhost", () => prueba.close(() => resolve(true)));
  });

async function yaAbierto(puerto) {
  try {
    const r = await fetch(direccion(puerto), { signal: AbortSignal.timeout(2000) });
    return r.ok && (await r.text()).includes("Simulador de cobertura");
  } catch {
    return false;
  }
}

function abrirNavegador(url) {
  const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { stdio: "ignore", windowsHide: true }).on("error", () => {}).unref();
  } catch {
    // Sin navegador: la dirección queda en la consola.
  }
}

console.log("\n  Simulador de cobertura\n  ======================\n  Iniciando... (unos segundos)\n");

if (await yaAbierto(PRIMER_PUERTO)) {
  console.log(`  El simulador ya está en marcha en ${direccion(PRIMER_PUERTO)}: se abre el navegador.\n`);
  abrirNavegador(direccion(PRIMER_PUERTO));
  await esperar(4000);
  process.exit(0);
}

let puerto = PRIMER_PUERTO;
while (!(await libre(puerto))) {
  if (puerto >= PRIMER_PUERTO + 20) {
    console.error(`  Los puertos ${PRIMER_PUERTO}-${puerto} están ocupados. Cierre otros programas y vuelva a intentarlo.\n`);
    process.exit(1);
  }
  puerto++;
}

const url = direccion(puerto);
Object.assign(process.env, { PORT: String(puerto), HOSTNAME: "localhost", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" });
process.title = "Simulador de cobertura";
await import(pathToFileURL(servidor).href);

let listo = false;
for (let i = 0; i < 120 && !listo; i++) {
  try {
    listo = (await fetch(url, { signal: AbortSignal.timeout(5000) })).status < 500;
  } catch {
    // El servidor aún arranca.
  }
  if (!listo) await esperar(500);
}
if (!listo) console.error("\n  El simulador no respondió. Revise los mensajes de arriba o vuelva a intentarlo.\n");
else {
  console.log(`\n  Listo: ${url}\n${puerto !== PRIMER_PUERTO ? `  (el puerto ${PRIMER_PUERTO} estaba ocupado)\n` : ""}\n  Deje esta ventana abierta mientras usa el simulador. Para terminar, ciérrela.\n`);
  abrirNavegador(url);
}
