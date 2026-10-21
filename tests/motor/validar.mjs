// Pruebas del motor de propagación (sin navegador). Uso: npm run prueba:motor
// Comprueba casos con resultado conocido: espacio libre, difracción, lectura de coordenadas, malla y factibilidad.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const entrada = `
export * from "./src/lib/radio/modelo";
export * from "./src/lib/radio/geo";
export * from "./src/lib/radio/simulacion";
export { relievePlano, decodificarTerrarium } from "./src/lib/radio/relieve";
export { itmPuntoAPunto, itmDosEstadisticas, qerfi } from "./src/lib/radio/itm";
export { calculoRed, esReferencia, RED_REFERENCIA, completarParametros } from "./src/lib/radio/red";
export { atenuacionPatron, anchosHaz } from "./src/lib/radio/patron";
export { perdidaEntorno } from "./src/lib/radio/entorno";
export { dbmAUv, dbmADbuvm, desdeDbm, aDbm } from "./src/lib/radio/unidades";
export { textoInforme } from "./src/lib/radio/informe";
`;
const tmp = mkdtempSync(path.join(os.tmpdir(), "motor-"));
const archivo = path.join(tmp, "motor.mjs");
const r = await build({ stdin: { contents: entrada, resolveDir: repo, loader: "ts" }, bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
writeFileSync(archivo, r.outputFiles[0].text);
const m = await import(pathToFileURL(archivo).href);

let fallos = 0;
const caso = (nombre, ok, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? ` (${detalle})` : ""}`);
  if (!ok) fallos++;
};
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;

// Fórmulas
caso("Espacio libre a 1 km y 915 MHz ≈ 91,7 dB", cerca(m.espacioLibre(915, 1), 91.68, 0.05), m.espacioLibre(915, 1).toFixed(2));
caso("J(v = 0) ≈ 6 dB", cerca(m.difraccion(0), 6.02, 0.1), m.difraccion(0).toFixed(2));
caso("J(v ≤ −0,78) = 0 dB", m.difraccion(-1) === 0);
caso("J(v = 2,4) ≈ 20,6 dB", cerca(m.difraccion(2.4), 20.6, 0.3), m.difraccion(2.4).toFixed(2));
caso("Clases por margen", m.clasePorMargen(50) === "buena" && m.clasePorMargen(40) === "estable" && m.clasePorMargen(31) === "media" && m.clasePorMargen(25) === "baja" && m.clasePorMargen(5) === "sin");

// Coordenadas
caso("GMS con O", cerca(m.leerCoordenada(`73°07'24,2" O`, "lon"), -73.123389, 1e-5));
caso("GMS con N", cerca(m.leerCoordenada(`4°30'44.3" N`, "lat"), 4.512306, 1e-5));
caso("Decimal con coma", cerca(m.leerCoordenada("-72,98", "lon"), -72.98, 1e-9));
caso("Par decimal", JSON.stringify(m.leerPar("4.5, -73.1")) === JSON.stringify({ lat: 4.5, lon: -73.1 }));
caso("Par GMS", (() => {
  const p = m.leerPar(`4°30'00" N 73°06'00" W`);
  return p && cerca(p.lat, 4.5, 1e-9) && cerca(p.lon, -73.1, 1e-9);
})());
caso("Latitud fuera de rango", m.leerCoordenada("95", "lat") === null);
caso("Ida y vuelta GMS", cerca(m.leerCoordenada(m.aGMS(-73.123456, "lon"), "lon"), -73.123456, 2e-5));
caso("Distancia de 1° de latitud ≈ 111,2 km", cerca(m.distanciaM(4, -73, 5, -73) / 1000, 111.2, 0.6));
caso("Terrarium: (128, 0, 0) = 0 m", m.decodificarTerrarium(new Uint8Array([128, 0, 0, 255]))[0] === 0);

// Longley-Rice (ITM 1.2.2): perfiles sintéticos con la pérdida de la implementación de referencia de la NTIA
{
  const perfilSintetico = (n, base, rug, cerro) => {
    const e = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      e.push(Math.round((base + rug * Math.sin(x * 11) * Math.cos(x * 4.1) + cerro * Math.exp(-(((x - 0.45) / 0.06) ** 2))) * 10) / 10);
    }
    return e;
  };
  const casosItm = [
    [101, 200, 0, 0, 5000, 15, 2.5, 915, 1, 15, 0.005, 360, 1, 2, 50, 50, 70, 120.262],
    [201, 300, 20, 0, 12000, 30, 2.5, 915, 1, 15, 0.005, 360, 1, 2, 50, 50, 70, 120.084],
    [301, 250, 10, 120, 18000, 20, 2.5, 915, 1, 15, 0.005, 360, 1, 2, 50, 50, 70, 167.117],
    [301, 250, 10, 120, 18000, 20, 2.5, 915, 1, 15, 0.005, 360, 1, 2, 90, 50, 90, 185.728],
    [151, 500, 60, 0, 30000, 10, 10, 915, 0, 4, 0.001, 301, 5, 1, 50, 50, 50, 161.247],
    [401, 150, 5, 0, 60000, 30, 10, 915, 1, 81, 5, 350, 7, 3, 99, 90, 95, 197.354],
    [61, 1000, 200, 300, 8000, 3, 1.5, 433, 1, 25, 0.02, 320, 2, 0, 10, 10, 50, 158.586],
  ];
  let peor = 0;
  for (const [n, base, rug, cerro, dist, htx, hrx, f, pol, eps, sgm, N, clima, modo, t, l, s, esperado] of casosItm) {
    const o = m.itmPuntoAPunto({ elev: perfilSintetico(n, base, rug, cerro), distanciaM: dist, alturaTxM: htx, alturaRxM: hrx, frecuenciaMhz: f, polarizacion: pol, permitividad: eps, conductividad: sgm, refractividad: N, clima, modo, tiempo: t, ubicaciones: l, situaciones: s });
    peor = Math.max(peor, Math.abs(o.perdidaDb - esperado));
  }
  caso("ITM igual a la referencia de la NTIA en 7 perfiles", peor < 0.01, `diferencia máxima ${peor.toFixed(4)} dB`);
  caso("qerfi(0,9) ≈ −1,2816", cerca(m.qerfi(0.9), -1.2816, 0.001), m.qerfi(0.9).toFixed(4));
}

// Simulación completa en terreno plano (sin descargas)
const base = { potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1, equipo: "nodo-solar-58", rol: "ROUTER", activa: true };
const antenas = [
  { ...base, id: "a", nombre: "A", lat: 4.0, lon: -73.0, alturaM: 15, pasarela: true },
  { ...base, id: "b", nombre: "B", lat: 4.03, lon: -73.0, alturaM: 15, pasarela: false },
  { ...base, id: "c", nombre: "C", lat: 4.06, lon: -73.0, alturaM: 15, pasarela: false },
  { ...base, id: "d", nombre: "D", lat: 4.6, lon: -73.0, alturaM: 10, pasarela: false },
];
const p = { preset: "LONG_FAST", frecuenciaMhz: 915, alturaRxM: 2.5, gananciaRxDbi: 2, perdidaExtraDb: 0, radioKm: 4, resolucion: "rapida", limiteSaltos: 3 };
const ctx = { cargarTesela: async () => null, hgt: { lista: [], tamano: 0 } };
const res = await m.simular(1, antenas, p, { tipo: "plano" }, ctx);
caso("Simulación en terreno plano", res !== null && res.areaEstudioKm2 > 0, res ? `${res.duracionMs} ms` : "");
const nodo = (id) => res.nodos.find((n) => n.id === id);
caso("B y C llegan a la pasarela A", nodo("b").saltos !== null && nodo("c").saltos !== null);
caso("D (66 km) queda aislada", nodo("d").saltos === null);
caso("Factibilidad: no factible por la antena aislada", res.factibilidad.nivel === "no-factible");
caso("Recomienda un puente para D", res.factibilidad.recomendaciones.some((t) => t.startsWith("D no llega")));
const sinD = await m.simular(2, antenas.slice(0, 3), p, { tipo: "plano" }, ctx);
caso("Sin D, todas conectadas", sinD.nodos.every((n) => n.saltos !== null));
{
  const amplio = { ...p, radioKm: 25 };
  const alta = await m.simular(3, [{ ...antenas[0], alturaM: 40 }], amplio, { tipo: "plano" }, ctx);
  const baja = await m.simular(4, [{ ...antenas[0], alturaM: 5 }], amplio, { tipo: "plano" }, ctx);
  caso("Más altura, más alcance confiable", alta.antenas[0].alcanceConfiableKm > baja.antenas[0].alcanceConfiableKm, `${alta.antenas[0].alcanceConfiableKm.toFixed(1)} km frente a ${baja.antenas[0].alcanceConfiableKm.toFixed(1)} km`);
}

// Parámetros de red como Radio Mobile: con los de referencia no cambia nada
{
  const pRef = m.completarParametros(p);
  caso("Parámetros por defecto = referencia de Radio Mobile", m.esReferencia(pRef) && !m.calculoRed(pRef).necesitaPerfil);
  const elev = Array.from({ length: 201 }, (_, i) => 200 + 30 * Math.sin(i / 9));
  caso("Sin cambios de red, ajuste = 0 dB", m.calculoRed(pRef).ajuste(elev, 201, 12000, 15, 2.5) === 0);
  const p90 = { ...pRef, tiempoPct: 90, ubicacionesPct: 90, situacionesPct: 90 };
  const r90 = m.calculoRed(p90);
  const aj = r90.ajuste(elev, 201, 12000, 15, 2.5);
  const directo = r90.itm(elev, 201, 12000, 15, 2.5).perdidaDb - m.itmPuntoAPunto({ elev, distanciaM: 12000, alturaTxM: 15, alturaRxM: 2.5, frecuenciaMhz: 915, polarizacion: 1, permitividad: 15, conductividad: 0.005, refractividad: 360, clima: 1, modo: 2, tiempo: 50, ubicaciones: 50, situaciones: 70 }).perdidaDb;
  caso("Confiabilidad 90 %: más pérdida, igual al cálculo directo", aj > 5 && Math.abs(aj - directo) < 1e-9, `${aj.toFixed(2)} dB`);
  const simRef = await m.simular(10, antenas.slice(0, 1), { ...pRef, radioKm: 25 }, { tipo: "plano" }, ctx);
  const sim90 = await m.simular(11, antenas.slice(0, 1), { ...p90, radioKm: 25 }, { tipo: "plano" }, ctx);
  caso(
    "Con 90 % de confiabilidad el alcance confiable baja",
    sim90.antenas[0].alcanceConfiableKm < simRef.antenas[0].alcanceConfiableKm * 0.8,
    `${simRef.antenas[0].alcanceConfiableKm.toFixed(1)} km → ${sim90.antenas[0].alcanceConfiableKm.toFixed(1)} km`,
  );
  const simItm = await m.simular(12, antenas.slice(0, 2), { ...pRef, modelo: "itm" }, { tipo: "plano" }, ctx);
  caso("Longley-Rice puro simula", simItm.porcentajeServicio > 0 && simItm.enlaces.length === 1, `${simItm.porcentajeServicio.toFixed(1)} % con servicio`);
}

// Antenas direccionales
{
  const omni = { gananciaDbi: 5.8 };
  const yagi = { patron: "yagi", gananciaDbi: 11, azimutDeg: 90, elevacionDeg: 0 };
  const sector = { patron: "sectorial-90", gananciaDbi: 13, azimutDeg: 0, elevacionDeg: 0 };
  caso("Omnidireccional sin atenuación", m.atenuacionPatron(omni, 200, -3) === 0);
  caso("Yagi: 0 dB al frente y la relación frente/espalda atrás", m.atenuacionPatron(yagi, 90, 0) === 0 && m.atenuacionPatron(yagi, 270, 0) === 16);
  caso("Sectorial 90°: 3 dB en el borde del haz", cerca(m.atenuacionPatron(sector, 45, 0), 3, 1e-9) && m.anchosHaz("sectorial-90", 13).h === 90);
  caso("Haz vertical: inclinar hacia abajo atenúa el horizonte", m.atenuacionPatron({ ...sector, elevacionDeg: -8 }, 0, 0) > 2);
  const amplio = { ...p, radioKm: 25 };
  const dir = await m.simular(20, [{ ...antenas[0], patron: "yagi", gananciaDbi: 11, azimutDeg: 0, elevacionDeg: 0 }], amplio, { tipo: "plano" }, ctx);
  const rumbo = dir.antenas[0].alcanceConfiablePorRumbo;
  caso("Yagi al norte llega más lejos al norte que al sur", rumbo[0] > rumbo[36] * 1.5, `confiable ${rumbo[0].toFixed(1)} km al norte frente a ${rumbo[36].toFixed(1)} km al sur`);
}

// Entorno, unidades e informe
{
  caso("Campo abierto sin pérdida", m.perdidaEntorno("abierto", 1.5, 915) === 0);
  caso("Plantación: ≈ 11,8 dB a 2,5 m y 0 dB sobre la copa", cerca(m.perdidaEntorno("plantacion", 2.5, 915), 11.8, 0.2) && m.perdidaEntorno("plantacion", 14, 915) === 0);
  caso("Ciudad (UIT-R P.2108): ≈ 22 dB a 2,5 m", cerca(m.perdidaEntorno("urbano", 2.5, 915), 22.0, 0.3), m.perdidaEntorno("urbano", 2.5, 915).toFixed(2));
  caso("-107 dBm = 1 µV en 50 Ω", cerca(m.dbmAUv(-107), 1, 1e-9));
  caso("Campo: -100 dBm, 2 dBi, 915 MHz ≈ 34,4 dBµV/m", cerca(m.dbmADbuvm(-100, 2, 915), 34.43, 0.02));
  const rx = { sensibilidadDbm: -131, gananciaRxDbi: 2, frecuenciaMhz: 915 };
  caso("Ida y vuelta de unidades", ["margen", "dbm", "uv", "dbuvm"].every((u) => cerca(m.aDbm(m.desdeDbm(-97.3, u, rx), u, rx), -97.3, 1e-9)));
  const a = { ...antenas[0], patron: "yagi", gananciaDbi: 11, azimutDeg: 0, elevacionDeg: 0 };
  const b = antenas[1];
  const sim = await m.simular(30, [a, b], { ...p, entorno: "plantacion" }, { tipo: "plano" }, ctx);
  const pf = await m.perfil(a, b, { ...p, entorno: "plantacion" }, { tipo: "plano" }, ctx);
  const i = pf.informe;
  caso("El informe da el mismo margen que el enlace de la malla", i && cerca(i.margenDb, sim.enlaces[0].margenAB, 1e-6), `${i?.margenDb.toFixed(3)} frente a ${sim.enlaces[0].margenAB.toFixed(3)} dB`);
  caso("Nivel = PIRE − pérdidas + ganancia de recepción", i && cerca(i.nivelDbm, i.pireDbm - i.perdidaTotalDb + i.gananciaRxDbi - i.patronRxDb - i.perdidaCableRxDb - i.perdidaExtraRxDb, 1e-9));
  caso("Informe en texto", /INFORME DE RADIOENLACE/.test(m.textoInforme(i)) && /Longley-Rice de referencia/.test(m.textoInforme(i)));
}

console.log(fallos ? `\n✗ ${fallos} caso(s) con fallo` : "\n✓ Motor verificado");
process.exit(fallos ? 1 : 0);
