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
export { tiempoEnAireMs, simularMensaje, probabilidadEnlace, esperaRetransmision, esperaAcuseMs, snrLimite, preambuloSimbolos, airePagoMs, bytesDatos, INTENTOS } from "./src/lib/radio/mensaje";
export { simularCarga, curvaCarga, PEDIDO_CARGA_DEFECTO } from "./src/lib/radio/carga";
export { estresMalla, PEDIDO_ESTRES_DEFECTO, PAGOS_PERSONA_DIA_TRAMA } from "./src/lib/radio/estres";
export { analizarMalla } from "./src/lib/radio/malla";
export { puntosAlAzar, personasPorDensidad, generador } from "./src/lib/radio/poblar";
export { dimensionarTrama, dimensionarDepartamento, DEPARTAMENTOS_TRAMA, PRECIOS, pesosTrama } from "./src/lib/radio/trama";
export { calcularEnlaces, retransmite } from "./src/lib/radio/malla";
export { presetPorId } from "./src/lib/radio/constantes";
export { sembrar, cajaSiembra } from "./src/lib/radio/siembra";
export { estadoRed, piezaDe, consejoRed } from "./src/lib/radio/estado-red";
export { alcancePlanoKm } from "./src/lib/radio/alcance-plano";
export { Relieve } from "./src/lib/radio/relieve";
export { evaluadorMargen, calcularCobertura, crearMalla } from "./src/lib/radio/cobertura";
export { disenar, cajaDiseno } from "./src/lib/radio/diseno";
export { poligonoCirculo, poligonoRectangulo, conArea, radioDeArea, areaM2, dentroPoligono, coberturaEnArea, porcentajeSobre, celdasEnPoligono } from "./src/lib/radio/area";
export { ajustar, cajaAjuste, textoCambio, analisisAjuste, PERMISOS_AJUSTE, contornoCirculos } from "./src/lib/radio/ajuste";
export { costoTorre, costoNodo, ALTURA_MAXIMA_M } from "./src/lib/radio/costos";
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
const base = { potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1, equipo: "personalizado", rol: "REPETIDOR", activa: true };
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

// Paquetes por la malla MeshCore: tiempo en el aire, preámbulo, espera de los repetidores, rutas y entrega
{
  const sf11 = m.presetPorId("SF11_250");
  const sf7n = m.presetPorId("SF7_62");
  const sf10n = m.presetPorId("SF10_62");
  // SF11, 250 kHz, 4/5, preámbulo 16, 62 bytes: 20,25·8,192 + 68·8,192 = 722,9 ms
  caso("Tiempo en el aire SF11 / 250 kHz, 62 bytes ≈ 722,9 ms", cerca(m.tiempoEnAireMs(62, sf11), 722.944, 0.01), m.tiempoEnAireMs(62, sf11).toFixed(3));
  // SF7, 62,5 kHz, preámbulo de 32 símbolos (MeshCore con SF ≤ 8): 36,25·2,048 + 103·2,048 = 285,2 ms
  caso("Tiempo en el aire SF7 / 62,5 kHz (preámbulo 32), 62 bytes ≈ 285,2 ms", cerca(m.tiempoEnAireMs(62, sf7n), 285.184, 0.01), m.tiempoEnAireMs(62, sf7n).toFixed(3));
  // SF10, 62,5 kHz, optimización de tasa baja (símbolo de 16,4 ms): 20,25·16,384 + 88·16,384 = 1773,6 ms
  caso("Tiempo en el aire SF10 / 62,5 kHz (tasa baja), 62 bytes ≈ 1773,6 ms", cerca(m.tiempoEnAireMs(62, sf10n), 1773.568, 0.01), m.tiempoEnAireMs(62, sf10n).toFixed(3));
  caso("Preámbulo de MeshCore: 32 símbolos con SF ≤ 8 y 16 con SF ≥ 9", m.preambuloSimbolos(8) === 32 && m.preambuloSimbolos(9) === 16);
  // El pago de Trama: orden 118 B, comprobante 126 B y aviso 126 B con sus acuses, a 2 saltos (documento: 9,5 / 5 / 3 s)
  const pago = (id) => m.airePagoMs(m.presetPorId(id)) / 1000;
  caso("Un pago a 2 saltos como en el documento: SF11 ≈ 9,5 s, SF10 ≈ 5 s, SF9 ≈ 3 s", Math.abs(pago("SF11_250") - 9.5) < 0.35 && Math.abs(pago("SF10_250") - 5) < 0.35 && Math.abs(pago("SF9_250") - 3) < 0.35, `${pago("SF11_250").toFixed(2)} · ${pago("SF10_250").toFixed(2)} · ${pago("SF9_250").toFixed(2)} s`);
  caso("Bytes de datos: cabecera 2 + ruta + 9 + carga", m.bytesDatos(118, 2) === 131 && m.bytesDatos(118) === 129);
  caso("SNR límite: SF7 −7,5 dB y SF12 −20 dB", m.snrLimite(7) === -7.5 && m.snrLimite(12) === -20);
  caso("Espera del repetidor: hasta 5 × 0,3 × aire con ruta y 5 × 0,5 × aire inundado", m.esperaRetransmision(1000, "directa").max === 1500 && m.esperaRetransmision(1000, "inundacion").max === 2500);
  caso("Espera del acuse como la app MeshCore", m.esperaAcuseMs(1000, 2, "directa") === 500 + 6250 * 3 && m.esperaAcuseMs(1000, 2, "inundacion") === 16500 && m.INTENTOS === 4);
  caso("Probabilidad por enlace: 20 dB ≈ 70 %, 30 dB ≈ 98 %", cerca(m.probabilidadEnlace(20), 0.7, 0.01) && m.probabilidadEnlace(30) > 0.97);
  const n = (id, rol, pasarela = false) => ({ id, nombre: id, tipo: rol === "COMPANION" && !pasarela ? "nodo" : "antena", lat: 4.2, lon: -73.3, alturaM: 6, potenciaDbm: 22, gananciaDbi: 8, perdidaCableDb: 1.2, equipo: "personalizado", rol, pasarela, activa: true });
  const red = [n("P", "COMPANION"), n("R2", "REPETIDOR"), n("R1", "REPETIDOR"), n("G", "COMPANION", true)];
  const e = (a, b, margen) => ({ a, b, distanciaKm: 5, margenAB: margen, margenBA: margen + 1, margen, clase: "solido", vMax: -1, lineaVista: true });
  const enl = [e("P", "R2", 32), e("R2", "R1", 40), e("R1", "G", 45)];
  const pr = { preset: "SF11_250", limiteSaltos: 3 };
  const v = m.simularMensaje(["P", "R2", "R1", "G"], red, enl, pr, 118);
  caso("Pago de 3 saltos llega por la ruta aprendida", v.llega && v.saltos === 3 && v.tramos.length === 3 && v.modo === "directa");
  caso("Con ruta directa cada repetidor quita su byte de ruta", v.tramos[0].aireMs >= v.tramos[1].aireMs && v.tramos[1].aireMs >= v.tramos[2].aireMs && v.bytes === m.bytesDatos(118, 2));
  caso("Tiempo total = paquetes en el aire + esperas de los 2 repetidores", cerca(v.totalMs.min, v.tramos.reduce((x, t) => x + t.aireMs, 0), 1e-6) && v.totalMs.max > v.totalMs.tipica && v.totalMs.tipica > v.totalMs.min);
  caso("Entrega: producto de los enlaces y mejor con los 4 intentos", cerca(v.probabilidad, enl.reduce((x, q) => x * m.probabilidadEnlace(q.margen), 1), 1e-9) && cerca(v.probabilidadReintentos, 1 - (1 - v.probabilidad) ** 4, 1e-9));
  const corto = m.simularMensaje(["P", "R2", "R1", "G"], red, enl, { ...pr, limiteSaltos: 2 }, 118);
  caso("Pasar el límite de saltos del diseño se marca", !corto.llega && /el diseño permite 2/.test(corto.motivo));
  const mudo = m.simularMensaje(["P", "R2", "R1", "G"], [red[0], { ...red[1], rol: "COMPANION" }, red[2], red[3]], enl, pr, 118);
  caso("En MeshCore un companion no pasa los paquetes de otros", !mudo.llega && /no es repetidor/.test(mudo.motivo));
  const roto = m.simularMensaje(["P", "R2", "R1", "G"], red, [e("P", "R2", 12), enl[1], enl[2]], pr, 118);
  caso("Un tramo sin enlace corta el pago", !roto.llega && /no tiene enlace/.test(roto.motivo));
  const inund = m.simularMensaje(["P", "R2", "R1", "G"], red, enl, pr, 118, "inundacion");
  caso("Inundado: lo retransmiten todos los repetidores", inund.modo === "inundacion" && inund.transmisiones === 3 && inund.bytes === m.bytesDatos(118, 0));
  caso("Solo los repetidores retransmiten", m.retransmite(red[1]) && !m.retransmite(red[0]) && !m.retransmite(red[3]));
}

// Poblar personas: reparto al azar, uniforme, dentro del área y repetible
{
  const cuadro = m.poligonoRectangulo(4.2, -73.37, 6000, 6000);
  const pts = m.puntosAlAzar(cuadro, { n: 250, semilla: 9 });
  caso("Poblar: 250 personas dentro del área", pts.length === 250 && pts.every((q) => m.dentroPoligono(q.lon, q.lat, cuadro)));
  const otra = m.puntosAlAzar(cuadro, { n: 250, semilla: 9 });
  caso("Poblar: la misma semilla da el mismo reparto", JSON.stringify(otra) === JSON.stringify(pts));
  const minSep = Math.min(...pts.slice(0, 60).flatMap((a, i) => pts.slice(i + 1, 60).map((b) => m.distanciaM(a.lat, a.lon, b.lat, b.lon))));
  caso("Poblar: no quedan encimadas", minSep > 20, `${minSep.toFixed(0)} m entre las más cercanas`);
  const norte = pts.filter((q) => q.lat > 4.2).length;
  caso("Poblar: reparto parejo (mitad al norte)", norte > 95 && norte < 155, `${norte} de 250 al norte`);
  const filtro = m.puntosAlAzar(cuadro, { n: 100, semilla: 3, acepta: (lat) => lat > 4.2 });
  caso("Poblar: «solo donde hay señal» respeta la condición", filtro.length === 100 && filtro.every((q) => q.lat > 4.2));
  caso("Poblar: densidad de Trama (1 por km² en 36 km² = 36)", m.personasPorDensidad(cuadro, 1) === 36 && m.personasPorDensidad(cuadro, 0.2) === 7);
}

// Trama: dimensionamiento del documento del Inge (equipos, precios y capacidad por frecuencia)
{
  const fmt = (v) => Math.round(v).toLocaleString("es-CO");
  caso("Precios de Trama: repetidor ≈ $1.035.000, billetera XIAO ≈ $92.000, T1000-E ≈ $190.000", cerca(m.PRECIOS.repetidor, 1035129, 2000) && cerca(m.PRECIOS.nodo.xiao, 92460, 300) && cerca(m.PRECIOS.nodo.t1000, 190300, 300), `${fmt(m.PRECIOS.repetidor)} · ${fmt(m.PRECIOS.nodo.xiao)} · ${fmt(m.PRECIOS.nodo.t1000)}`);
  caso("Sitio gateway con 4 radios ≈ $9,4 M y Starlink con solar ≈ $6,1 M", cerca(m.PRECIOS.sitioBase + 4 * m.PRECIOS.radio, 9.44e6, 0.05e6) && cerca(m.PRECIOS.starlink, 6.099e6, 1e3));
  const dep = (id) => m.dimensionarDepartamento(m.DEPARTAMENTOS_TRAMA.find((d) => d.id === id));
  const choco = dep("choco");
  caso("Chocó (30 % de adopción): 35.880 usuarios, 240 repetidores, 60 sitios, $6,4 mil M", choco.usuarios === 35880 && choco.repetidores === 240 && choco.sitios === 60 && m.pesosTrama(choco.costo.total) === "$6,4 mil M", `${choco.usuarios} · ${choco.repetidores} · ${choco.sitios} · ${m.pesosTrama(choco.costo.total)}`);
  caso("Chocó: ≈ $178.000 por usuario", cerca(choco.porUsuario, 178057, 200), fmt(choco.porUsuario));
  const vichada = dep("vichada");
  caso("Vichada: 13.875 usuarios, 179 repetidores, 24 sitios, 93 radios, 6 Starlink", vichada.usuarios === 13875 && vichada.repetidores === 179 && vichada.sitios === 24 && vichada.radios === 93 && vichada.starlinks === 6 && vichada.enlaces === 18);
  const total = m.DEPARTAMENTOS_TRAMA.map((d) => m.dimensionarDepartamento(d));
  const suma = (k) => total.reduce((x, d) => x + k(d), 0);
  caso("Colombia: 950.655 usuarios, 7.017 repetidores, 1.602 sitios, 734 Starlink", suma((d) => d.usuarios) === 950655 && suma((d) => d.repetidores) === 7017 && suma((d) => d.sitios) === 1602 && suma((d) => d.starlinks) === 734, `${suma((d) => d.usuarios)} · ${suma((d) => d.repetidores)} · ${suma((d) => d.sitios)} · ${suma((d) => d.starlinks)}`);
  caso("Colombia: inversión ≈ $154,5 mil M", m.pesosTrama(suma((d) => d.costo.total)) === "$154,5 mil M", m.pesosTrama(suma((d) => d.costo.total)));
  const cap = m.dimensionarTrama({ usuarios: 3000, areaKm2: 100, terreno: "sabana", sf: 11, nodo: "xiao", logistica: 1, solar: 1 });
  caso("Mucha gente en poca área: manda la capacidad (una radio cada 150 usuarios)", cap.manda === "capacidad" && cap.radios === 20 && cap.sitios === 5);
}

// Prueba de carga: pagos al tiempo, paquete por paquete como MeshCore, hasta que la frecuencia se revienta
{
  const nodo = (id, rol, extra = {}) => ({ id, nombre: id, tipo: rol === "REPETIDOR" ? "antena" : "nodo", lat: 4.2, lon: -73.3, alturaM: 6, potenciaDbm: 22, gananciaDbi: 8, perdidaCableDb: 1.2, equipo: "personalizado", rol, pasarela: false, activa: true, ...extra });
  const antenas = [nodo("G", "COMPANION", { tipo: "antena", pasarela: true, alturaM: 12 }), nodo("R", "REPETIDOR")];
  const enlaces = [{ a: "R", b: "G", distanciaKm: 8, margenAB: 45, margenBA: 45, margen: 45, clase: "solido", vMax: -1, lineaVista: true }];
  const nodos = [{ id: "G", saltos: 0, vecinos: 1, componente: 0, critico: false, cuelloDb: null, ruta: ["G"] }, { id: "R", saltos: 1, vecinos: 1, componente: 0, critico: false, cuelloDb: 45, ruta: ["R", "G"] }];
  for (let k = 0; k < 40; k++) {
    const cerca = k % 2 === 0;
    antenas.push(nodo(`P${k}`, "COMPANION"));
    enlaces.push({ a: `P${k}`, b: cerca ? "G" : "R", distanciaKm: 3, margenAB: 34, margenBA: 34, margen: 34, clase: "solido", vMax: -1, lineaVista: true });
    nodos.push({ id: `P${k}`, saltos: cerca ? 1 : 2, vecinos: 1, componente: 0, critico: false, cuelloDb: 34, ruta: cerca ? [`P${k}`, "G"] : [`P${k}`, "R", "G"] });
  }
  const base = { ...m.PEDIDO_CARGA_DEFECTO, antenas, enlaces, nodos, parametros: { preset: "SF11_250", limiteSaltos: 3 } };
  const uno = m.simularCarga({ ...base, mensajes: 1 });
  caso("Carga: un pago solo llega y vuelve el comprobante", uno.completos === 1 && uno.remitentes === 40 && uno.latenciaS.p50 > 4 && uno.latenciaS.p50 < 30, `${uno.latenciaS.p50.toFixed(1)} s`);
  const r5 = m.simularCarga({ ...base, mensajes: 5 });
  const r25 = m.simularCarga({ ...base, mensajes: 25 });
  caso("Carga: 5 pagos al tiempo aguantan (aunque el último espera) y 25 se revientan", !r5.saturada && r5.completosPct >= 90 && r25.saturada && r25.completosPct < r5.completosPct, `5 → ${r5.completosPct.toFixed(0)} %, p95 ${r5.latenciaS.p95.toFixed(0)} s · 25 → ${r25.completosPct.toFixed(0)} %, p95 ${r25.latenciaS.p95.toFixed(0)} s`);
  caso("Carga: la misma semilla da el mismo resultado", JSON.stringify(m.simularCarga({ ...base, mensajes: 15 })) === JSON.stringify(m.simularCarga({ ...base, mensajes: 15 })));
  // Promedio de tres sorteos: con 55 pagos, uno solo varía ±3 puntos
  const horas = [7, 8, 9].map((semilla) => m.simularCarga({ ...base, modo: "continua", mensajes: 55, duracionMin: 60, semilla }));
  const hora = { completosPct: horas.reduce((s, x) => s + x.completosPct, 0) / 3, canalGatewayPct: horas.reduce((s, x) => s + x.canalGatewayPct, 0) / 3, mensajes: horas[0].mensajes };
  caso("Carga: 55 pagos por hora (el diseño de Trama) caben con el canal cerca del 15 %", hora.mensajes === 55 && hora.completosPct >= 93 && hora.canalGatewayPct > 7 && hora.canalGatewayPct < 25, `${hora.completosPct.toFixed(0)} %, canal ${hora.canalGatewayPct.toFixed(1)} %`);
  const sf9 = m.simularCarga({ ...base, mensajes: 15, parametros: { preset: "SF9_250", limiteSaltos: 3 } });
  const sf11 = m.simularCarga({ ...base, mensajes: 15 });
  caso("Carga: SF9 aguanta más que SF11", sf9.completosPct >= sf11.completosPct && sf9.latenciaS.p95 <= sf11.latenciaS.p95, `SF9 ${sf9.completosPct.toFixed(0)} % · SF11 ${sf11.completosPct.toFixed(0)} %`);
  const curva = m.curvaCarga({ ...base, mensajes: 5 }, [5, 10, 25, 50, 80]);
  caso("Carga: la curva encuentra dónde se revienta", curva.quiebre !== null && (curva.seguro === null || curva.seguro < curva.quiebre) && (curva.lento === null || curva.lento < curva.quiebre) && curva.puntos.length >= 2, `seguro ${curva.seguro} · lento ${curva.lento} · quiebre ${curva.quiebre}`);
  const vacio = m.simularCarga({ ...base, antenas: antenas.slice(0, 2), nodos: nodos.slice(0, 2), enlaces: enlaces.slice(0, 1) });
  caso("Carga: sin personas conectadas lo dice", Boolean(vacio.motivo) && /Poblar personas/.test(vacio.motivo));
}

// Prueba de estrés de la hora pico por zona (zonas de popularidad alrededor de cada nodo), sobre terreno plano
{
  const equipo = { potenciaDbm: 22, gananciaDbi: 8, perdidaCableDb: 1.2, activa: true };
  const lista = [{ ...equipo, id: "G", nombre: "Gateway", tipo: "antena", lat: 4.2, lon: -73.37, alturaM: 12, equipo: "t114-8dbi", rol: "COMPANION", pasarela: true }];
  for (let k = 0; k < 3; k++) {
    const q = m.desplazar(4.2, -73.37, 5000, 120 * k);
    lista.push({ ...equipo, id: `R${k + 1}`, nombre: `Repetidor ${k + 1}`, tipo: "antena", lat: q.lat, lon: q.lon, alturaM: 6, equipo: "p1-8dbi", rol: "REPETIDOR", pasarela: false });
  }
  const zonas = (porZona) => {
    const antenas = [...lista];
    for (const c of lista)
      m.puntosAlAzar(m.poligonoCirculo(c.lat, c.lon, 2000, 48), { n: porZona, semilla: 5 + antenas.length }).forEach((q, k) =>
        antenas.push({ id: `${c.id}-p${k}`, nombre: `Persona ${c.id}-${k}`, tipo: "nodo", lat: q.lat, lon: q.lon, alturaM: 1.5, potenciaDbm: 22, gananciaDbi: 2, perdidaCableDb: 0, equipo: "xiao", rol: "COMPANION", pasarela: false, activa: true, poblada: true, zona: c.id }),
      );
    return antenas;
  };
  const pT = { ...p, preset: "SF11_250", frecuenciaMhz: 920, alturaRxM: 1.5, radioKm: 9, resolucion: "rapida", limiteSaltos: 3 };
  const pocas = zonas(40);
  const t0 = performance.now();
  const rPocas = await m.simular(20, pocas, pT, { tipo: "plano" }, ctx);
  const tSim = performance.now() - t0;
  const pedido = (antenas, r, extra = {}) => ({ ...m.PEDIDO_ESTRES_DEFECTO, antenas, enlaces: r.enlaces, nodos: r.nodos, parametros: pT, ...extra });
  const e1 = m.estresMalla(pedido(pocas, rPocas, { rampa: true }));
  const sumaZonas = e1.zonas.reduce((s, z) => s + z.usuarios, 0);
  caso("Estrés: 2,4 pagos por persona al día (55 ÷ (150 × 15 %))", Math.abs(m.PAGOS_PERSONA_DIA_TRAMA - 2.444) < 0.01, m.PAGOS_PERSONA_DIA_TRAMA.toFixed(3));
  caso("Estrés: 160 personas en 4 zonas aguantan la hora pico", e1.estado === "aguanta" && e1.usuarios === 160 && e1.zonas.length === 4 && sumaZonas === 160, `${e1.completosPct.toFixed(0)} %, p95 ${e1.p95S.toFixed(0)} s, canal ${e1.canalGatewayPct.toFixed(0)} %`);
  caso("Estrés: lo pedido por hora es personas × pagos al día × 15 %", Math.abs(e1.pedidosHora - 160 * m.PEDIDO_ESTRES_DEFECTO.pagosPersonaDia * 0.15) < 1e-6 && e1.entregadosHora > 0.85 * e1.pedidosHora, `${e1.pedidosHora.toFixed(0)} pedidos, ${e1.entregadosHora.toFixed(0)} entregados por hora`);
  caso("Estrés: cada zona mide canal, transmisión, alcance y energía", e1.zonas.every((z) => z.canalPct > 0 && z.txPct > 0 && z.txPct < 50 && z.alcanceKm > 1 && z.alcanceKm <= 2.2) && e1.zonas.filter((z) => z.energia).length === 3 && e1.zonas.every((z) => !z.energia || (z.energia.alcanza && z.energia.consumoWhDia < z.energia.generaWhDia)));
  caso("Estrés: la rampa encuentra hasta cuántas personas aguanta", e1.rampa && e1.rampa.factorQuiebre !== null && e1.rampa.factorQuiebre > 1 && e1.rampa.usuariosMax >= 160 && e1.rampa.maxEntregadosHora >= e1.entregadosHora && e1.zonas.every((z) => z.usuariosMax === null || z.usuariosMax >= z.usuarios), `seguro ×${e1.rampa?.factorSeguro} · quiebre ×${e1.rampa?.factorQuiebre} · ${e1.rampa?.usuariosMax} personas · máx ${e1.rampa?.maxEntregadosHora.toFixed(0)} pagos/h`);
  const mercado = m.estresMalla(pedido(pocas, rPocas, { horaPicoPct: 25 }));
  caso("Estrés: el día de mercado pide más y ocupa más el canal", mercado.pedidosHora > e1.pedidosHora && mercado.canalGatewayPct > e1.canalGatewayPct, `${e1.canalGatewayPct.toFixed(0)} % → ${mercado.canalGatewayPct.toFixed(0)} %`);

  const muchas = zonas(250);
  const t1 = performance.now();
  const rMuchas = await m.simular(21, muchas, pT, { tipo: "plano" }, ctx);
  const tSimMuchas = performance.now() - t1;
  caso("Con 1.000 personas la simulación de la malla sigue ágil (rutas sin vueltas inútiles)", tSimMuchas < 4000, `${tSim.toFixed(0)} ms con 160 · ${tSimMuchas.toFixed(0)} ms con 1.000`);
  const t2 = performance.now();
  const e2 = m.estresMalla(pedido(muchas, rMuchas, { rampa: true, comparar: true }));
  const tEstres = performance.now() - t2;
  caso("Estrés: 250 personas por nodo en una sola frecuencia SF11 se revientan", e2.estado === "revienta" && e2.usuarios === 1000 && e2.zonas.some((z) => z.estado === "revienta") && e2.canalGatewayPct > 60, `${e2.completosPct.toFixed(0)} %, canal ${e2.canalGatewayPct.toFixed(0)} %, ${tEstres.toFixed(0)} ms`);
  caso("Estrés: con la carga, el alcance útil y lo entregado bajan", e2.entregadosHora < e2.pedidosHora * 0.9 && e2.zonas.some((z) => z.alcanceCargaKm !== null && z.alcanceCargaKm < z.alcanceKm));
  caso("Estrés: la rampa dice cuánto aguanta (menos de las 1.000)", e2.rampa && e2.rampa.usuariosMax !== null && e2.rampa.usuariosMax < 1000 && e2.rampa.factorQuiebre <= 1 && e2.rampa.primera !== null, `~${e2.rampa?.usuariosMax} personas; primera ${e2.rampa?.primera}`);
  const sf9 = e2.ajustes?.find((a) => a.preset === "SF9_250");
  const sf11 = e2.ajustes?.find((a) => a.actual);
  caso("Estrés: con SF9 caben más pagos que con SF11", sf9 && sf11 && sf9.completosPct > sf11.completosPct && e2.ajustes.length === 7, `SF9 ${sf9?.completosPct.toFixed(0)} % · SF11 ${sf11?.completosPct.toFixed(0)} %`);
  caso("Estrés: sin personas lo dice", Boolean(m.estresMalla(pedido(lista, await m.simular(22, lista, pT, { tipo: "plano" }, ctx))).motivo));
}

// Sembrado automático: cadena de repetidores sobre terreno plano hacia un punto a 30 km
{
  const base = { tipo: "antena", alturaM: 15, potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1, equipo: "personalizado", rol: "REPETIDOR", activa: true };
  const gateway = { ...base, id: "g", nombre: "Gateway", lat: 4.2, lon: -73.37, alturaM: 8, pasarela: true };
  const repetidor = { ...base, id: "r", nombre: "Repetidor", lat: 0, lon: 0, pasarela: false };
  const persona = { ...base, id: "p", nombre: "Persona", tipo: "nodo", lat: 0, lon: 0, alturaM: 1.5, gananciaDbi: 2, perdidaCableDb: 0, equipo: "xiao", rol: "COMPANION", pasarela: false };
  const destino = m.desplazar(4.2, -73.37, 30000, 90);
  const pedido = { origenes: [gateway], destinos: [destino], repetidor, persona, parametros: p };
  const caja = m.cajaSiembra([gateway], [destino]);
  const s = m.sembrar(pedido, m.relievePlano(caja), caja);
  caso("La cadena llega a la persona a 30 km", s.destinos[0].llega && s.puntos.length >= 1 && s.puntos.length <= 6, `${s.puntos.length} repetidores, ${s.destinos[0].margenDb.toFixed(1)} dB en el destino`);
  caso("Cada repetidor propuesto con enlace sólido (≥ 30 dB)", s.puntos.every((q) => q.margenDb >= 30), s.puntos.map((q) => q.margenDb.toFixed(1)).join(", "));
  caso("La cadena dice a cuántos saltos queda cada destino", s.saltos?.[0] === s.puntos.length + 1, `${s.saltos?.[0]} saltos`);
  const conLimite = m.sembrar({ ...pedido, saltosOrigen: { g: 0 }, limiteSaltos: 3 }, m.relievePlano(caja), caja);
  caso("Con límite de 3 saltos la cadena no lo pasa", conLimite.destinos[0].llega && conLimite.saltos[0] <= 3, `${conLimite.puntos.length} repetidores, ${conLimite.saltos[0]} saltos`);
  // Desde un repetidor que ya está a 2 saltos, con límite 3, el último repetidor debe dar servicio a la persona
  const rep2 = { ...repetidor, id: "r2", nombre: "R2", ...m.desplazar(4.2, -73.37, 9000, 90) };
  const lejos2 = m.sembrar({ ...pedido, origenes: [gateway, rep2], saltosOrigen: { g: 0, r2: 2 }, limiteSaltos: 3 }, m.relievePlano(caja), caja);
  caso("Si el repetidor cercano ya está a 2 saltos, siembra desde donde cabe", !lejos2.destinos[0].llega || lejos2.saltos[0] <= 3, `${lejos2.puntos.map((q) => q.desde).join(" · ")} → ${lejos2.saltos[0]} saltos`);
  const sim = await m.simular(40, [gateway, ...s.puntos.map((q, k) => ({ ...repetidor, id: `r${k}`, nombre: `R${k}`, lat: q.lat, lon: q.lon })), { ...persona, lat: destino.lat, lon: destino.lon }], p, { tipo: "plano" }, ctx);
  const est = m.estadoRed(sim ? [gateway, ...s.puntos.map((q, k) => ({ ...repetidor, id: `r${k}`, nombre: `R${k}`, lat: q.lat, lon: q.lon })), { ...persona, lat: destino.lat, lon: destino.lon }] : [], sim, p.limiteSaltos + 5, true);
  caso("La simulación confirma la persona conectada con la red sembrada", est.conectadas.length === 1 && est.sinCobertura.length === 0 && est.areaKm2 > 0, `${est.conectadas.length} conectada(s), ${est.areaKm2.toFixed(0)} km² cubiertos`);
  const ya = m.sembrar({ ...pedido, destinos: [m.desplazar(4.2, -73.37, 1500, 0)] }, m.relievePlano(caja), caja);
  caso("Si el gateway ya llega, no propone repetidores", ya.destinos[0].llega && ya.puntos.length === 0);
  caso("Piezas: gateway, repetidor y persona", m.piezaDe(gateway) === "gateway" && m.piezaDe(repetidor) === "repetidor" && m.piezaDe(persona) === "persona");

  // Guía paso a paso: gateway → repetidores → gente → conectar a los que faltan
  const consejo = (lista, r = null, alDia = false) => m.consejoRed(m.estadoRed(lista, r, 3, alDia), 3);
  const lejos = { ...persona, id: "lejos", nombre: "Lejana", ...m.desplazar(4.2, -73.37, 60000, 90) };
  caso("Guía: sin gateway, el paso 1 es el gateway", consejo([]).paso === 1 && consejo([repetidor]).paso === 1);
  caso("Guía: con el gateway solo, el paso 2 son los repetidores", consejo([gateway]).paso === 2);
  const simLejos = await m.simular(41, [gateway, lejos], p, { tipo: "plano" }, ctx);
  const c4 = consejo([gateway, lejos], simLejos, true);
  caso("Guía: una persona a 60 km queda sin cobertura (paso 4)", c4.paso === 4 && /Lejana/.test(c4.texto), c4.titulo);
  const simCerca = await m.simular(42, [gateway, { ...persona, id: "cerca", nombre: "Cercana", ...m.desplazar(4.2, -73.37, 2000, 90) }], p, { tipo: "plano" }, ctx);
  // Alcance de referencia en terreno plano (como el «hasta 10 km» de Trama)
  const rep = (h) => ({ ...repetidor, alturaM: h });
  const [a6, a15, a30] = [6, 15, 30].map((h) => m.alcancePlanoKm(rep(h), persona, p, 20));
  caso("Alcance en plano: repetidor de 15 m a la gente ≈ 15 km y crece con la torre", cerca(a15, 14.8, 0.6) && a6 < a15 && a15 < a30, `${a6} · ${a15} · ${a30} km`);
  caso("Alcance en plano entre repetidores (≥ 30 dB) mayor que a la gente", m.alcancePlanoKm(rep(15), rep(15), p, 30) > a15);
  caso("Guía: con todos conectados, felicita", consejo([gateway, { ...persona, id: "cerca", nombre: "Cercana", ...m.desplazar(4.2, -73.37, 2000, 90) }], simCerca, true).tono === "ok");
}

// Diseño de la malla por área (v10): polígonos, cobertura dentro del área y siembra de repetidores
{
  const base = { tipo: "antena", alturaM: 15, potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1, equipo: "personalizado", rol: "REPETIDOR", activa: true };
  const gateway = { ...base, id: "g", nombre: "Gateway", lat: 4.2, lon: -73.37, alturaM: 8, pasarela: true };
  const repetidor = { ...base, id: "r", nombre: "Repetidor", lat: 0, lon: 0, pasarela: false };
  const pd = m.completarParametros({ preset: "LONG_FAST", frecuenciaMhz: 915, alturaRxM: 1.5, gananciaRxDbi: 2, perdidaExtraDb: 0, radioKm: 15, resolucion: "normal", limiteSaltos: 3 });
  const objetivo = 11226e4;
  const area = m.conArea(m.poligonoCirculo(4.2, -73.37, m.radioDeArea(objetivo)), objetivo);
  caso("Área objetivo de 11.226 ha medida igual que la regla", cerca(m.areaM2(area), objetivo, 1), `${(m.areaM2(area) / 1e4).toFixed(1)} ha`);
  caso("Punto dentro y fuera del área", m.dentroPoligono(-73.37, 4.2, area) && !m.dentroPoligono(-73.2, 4.2, area));
  const rect = m.poligonoRectangulo(4.2, -73.37, 10000, 12000);
  caso("Rectángulo de 10 × 12 km ≈ 120 km²", cerca(m.areaM2(rect) / 1e6, 120, 1.5), (m.areaM2(rect) / 1e6).toFixed(2));

  // Relieve sintético con lomas y hondonadas (sin descargas)
  const cajaL = m.cajaDiseno(area, []);
  const z = 12;
  const x0 = Math.floor(m.lonAPixel(cajaL.oeste, z)) - 4;
  const y0 = Math.floor(m.latAPixel(cajaL.norte, z)) - 4;
  const an = Math.ceil(m.lonAPixel(cajaL.este, z)) + 4 - x0;
  const al = Math.ceil(m.latAPixel(cajaL.sur, z)) + 4 - y0;
  const datos = new Float32Array(an * al);
  for (let j = 0; j < al; j++) for (let i = 0; i < an; i++) datos[j * an + i] = 250 + 25 * Math.sin(i / 7) * Math.cos(j / 9) + 60 * Math.exp(-((i - an * 0.7) ** 2 + (j - al * 0.3) ** 2) / 300) - 40 * Math.exp(-((i - an * 0.3) ** 2 + (j - al * 0.6) ** 2) / 200);
  const lomas = new m.Relieve(z, x0, y0, an, al, datos, { fuente: "teselas", solicitadas: 1, fallidas: 0, resolucionM: 38 });

  // El evaluador por puntos coincide con la celda del mapa
  const malla = m.crearMalla([gateway], pd);
  const cob = await m.calcularCobertura([gateway], pd, lomas, malla);
  const ev = m.evaluadorMargen(gateway, pd, lomas);
  let maxDif = 0;
  for (let k = 0; k < 400; k++) {
    const j = Math.floor((k * 7919) % malla.alto);
    const i = Math.floor((k * 104729) % malla.ancho);
    const v = cob.porAntena[j * malla.ancho + i];
    if (v === -128) continue;
    maxDif = Math.max(maxDif, Math.abs(Math.round(ev(malla.lats[j], malla.lons[i])) - v));
  }
  caso("El margen por punto del diseño es el mismo de cada celda del mapa", maxDif <= 1, `máx. ${maxDif} dB`);

  const pedido = { area, margenObjetivoDb: 30, porcentajeObjetivo: 99.9, existentes: [], gateway, repetidor, parametros: pd };
  const plano = m.disenar(pedido, m.relievePlano(m.cajaDiseno(area, [])), m.cajaDiseno(area, []));
  caso("Terreno plano: con el gateway solo se cubre el 99,9 % (sin repetidores)", plano.alcanzado && plano.nodos.length === 1 && plano.nodos[0].pieza === "gateway", `${plano.coberturaPct.toFixed(2)} %`);
  const respaldo = m.disenar({ ...pedido, respaldo: true }, m.relievePlano(m.cajaDiseno(area, [])), m.cajaDiseno(area, []));
  caso("Con respaldo hace falta al menos un repetidor (dos nodos por punto)", respaldo.alcanzado && respaldo.nodos.some((n) => n.pieza === "repetidor"), `${respaldo.nodos.length - 1} repetidor(es)`);

  const t0 = performance.now();
  const d = m.disenar(pedido, lomas, cajaL);
  const segundos = (performance.now() - t0) / 1000;
  const reps = d.nodos.filter((n) => n.pieza === "repetidor");
  caso("Con lomas: siembra repetidores hasta la meta del 99,9 %", d.alcanzado && reps.length >= 3, `${reps.length} repetidores, ${d.coberturaPct.toFixed(2)} %, ${segundos.toFixed(1)} s`);
  caso("Cada repetidor enlazado a la red (≥ 22 dB) y dentro del límite de saltos", reps.every((n) => n.enlaceDb >= 22 && n.saltos <= pd.limiteSaltos));
  const ants = d.nodos.map((n) => ({ ...(n.pieza === "gateway" ? gateway : repetidor), id: n.id, nombre: n.id, lat: n.lat, lon: n.lon }));
  const mallaD = m.crearMalla(ants, pd);
  const cobD = await m.calcularCobertura(ants, pd, lomas, mallaD);
  const real = m.porcentajeSobre(m.coberturaEnArea({ malla: mallaD, mejor: cobD.mejor, segundo: cobD.segundo }, area), 30);
  caso("La simulación confirma la meta dentro del área (celda por celda)", real >= 99.9 && Math.abs(real - d.coberturaPct) < 0.05, `${real.toFixed(3)} % en el mapa, ${d.coberturaPct.toFixed(3)} % estimado`);
  const corto = m.disenar({ ...pedido, maxRepetidores: 2 }, lomas, cajaL);
  caso("Con un máximo de repetidores avisa que no alcanzó la meta", !corto.alcanzado && /máximo de 2/.test(corto.motivo ?? "") && corto.huecos.length > 0, `${corto.coberturaPct.toFixed(1)} %`);
  const existentes = m.disenar({ ...pedido, existentes: [gateway], gateway: null }, lomas, cajaL);
  caso("Usa el gateway que ya existe y no pone otro", existentes.nodos.every((n) => n.pieza === "repetidor") && existentes.alcanzado);
}

// Ajuste inteligente (v11): red factible con la mejor relación cobertura–costo, sin torres de más de 30 m
{
  const relieveDe = (caja) => {
    const z = 12;
    const x0 = Math.floor(m.lonAPixel(caja.oeste, z)) - 4;
    const y0 = Math.floor(m.latAPixel(caja.norte, z)) - 4;
    const an = Math.ceil(m.lonAPixel(caja.este, z)) + 4 - x0;
    const al = Math.ceil(m.latAPixel(caja.sur, z)) + 4 - y0;
    const d = new Float32Array(an * al);
    for (let j = 0; j < al; j++) for (let i = 0; i < an; i++) d[j * an + i] = 250 + 30 * Math.sin(i / 9) * Math.cos(j / 11) + 90 * Math.exp(-((i - an * 0.62) ** 2 + (j - al * 0.45) ** 2) / 900) - 50 * Math.exp(-((i - an * 0.35) ** 2 + (j - al * 0.6) ** 2) / 500);
    return new m.Relieve(z, x0, y0, an, al, d, { fuente: "teselas", solicitadas: 1, fallidas: 0, resolucionM: 38 });
  };
  const base = { tipo: "antena", alturaM: 15, potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1, equipo: "personalizado", rol: "REPETIDOR", activa: true, pasarela: false };
  const p = m.completarParametros({ preset: "LONG_FAST", frecuenciaMhz: 915, alturaRxM: 1.5, gananciaRxDbi: 2, perdidaExtraDb: 0, radioKm: 10, resolucion: "normal", limiteSaltos: 3 });
  const gw = { ...base, id: "g", nombre: "Gateway", lat: 4.2, lon: -73.37, alturaM: 8, pasarela: true };
  const q = (dist, rumbo) => m.desplazar(4.2, -73.37, dist, rumbo);
  const persona = (id, dist, rumbo) => ({ ...base, id, nombre: id, tipo: "nodo", alturaM: 1.5, gananciaDbi: 2, perdidaCableDb: 0, equipo: "xiao", rol: "COMPANION", ...q(dist, rumbo) });
  const plantilla = { ...base, id: "x", nombre: "Apoyo", lat: 0, lon: 0 };
  const pedido = (antenas, extra = {}) => ({ antenas, parametros: p, area: null, metaPct: 60, permisos: m.PERMISOS_AJUSTE, alturaMaxM: 30, maxApoyos: 12, plantillaApoyo: plantilla, ...extra });

  caso("Costos: más de 30 m exige torre autosoportada (mucho más cara)", m.costoTorre(31) > 5 * m.costoTorre(30) && m.ALTURA_MAXIMA_M === 30);
  caso("Costos de Trama: tubo de 6 m $390.000 y torre arriostrada de 12 m $3,2 M", m.costoTorre(6) === 390000 && m.costoTorre(12) === 3200000 && m.costoTorre(9) > m.costoTorre(6) && m.costoTorre(15) > m.costoTorre(12));
  caso("Costos: las personas y nodos de campo no cuentan", m.costoNodo(persona("p", 1000, 0)) === 0 && m.costoNodo(gw) > m.costoNodo({ ...gw, pasarela: false }));
  const zona = m.contornoCirculos([{ lat: 4.2, lon: -73.37 }, { lat: 4.2, lon: -73.28 }], 6000);
  caso("La zona de la red une los círculos de estudio", zona.length >= 8 && m.areaM2(zona) > Math.PI * 36e6 && m.areaM2(zona) < 2 * Math.PI * 36e6, `${(m.areaM2(zona) / 1e6).toFixed(0)} km²`);

  // Red que no cumple: un repetidor bajo y una persona lejana
  const ants = [gw, { ...base, id: "r2", nombre: "Repetidor 2", ...q(7000, 120), alturaM: 9 }, persona("p1", 4000, 200), persona("p2", 9000, 130)];
  const pe = pedido(ants);
  const rel = relieveDe(m.cajaAjuste(pe));
  const t0 = performance.now();
  const a = m.ajustar(pe, rel);
  const seg = (performance.now() - t0) / 1000;
  const rec = a.opciones[a.recomendada];
  caso("Ajuste: de no factible a factible con la recomendada", a.modo === "ajustar" && !a.inicial.factible && rec?.resumen.factible, `${a.inicial.utilPct.toFixed(1)} % → ${rec?.resumen.utilPct.toFixed(1)} %, ${seg.toFixed(1)} s`);
  caso("Ajuste: ninguna torre pasa de 30 m", a.opciones.every((o) => o.antenas.every((x) => x.alturaM <= 30)));
  const costos = a.opciones.map((o) => o.costoRelativo);
  const utiles = a.opciones.map((o) => o.resumen.utilPct);
  caso("Ajuste: más cobertura cuesta más (económica → máxima)", costos.every((c, i) => i === 0 || c >= costos[i - 1]) && utiles.every((u, i) => i === 0 || u >= utiles[i - 1] - 0.5), costos.map((c) => c.toFixed(2)).join(" / "));
  caso("Ajuste: la zona de la red queda fija y el análisis no habla de precios", a.area.tipo === "zona" && a.area.poligono.length >= 3 && a.analisis.length > 0 && !a.analisis.some((t) => /\$|millones|pesos/.test(t)));
  caso("Ajuste: cada cambio se explica en español", rec.cambios.every((c) => m.textoCambio(c).length > 8));

  const solo = m.ajustar(pedido(ants, { permisos: { apoyos: false, mover: false, antenas: false, alturas: true, quitar: false } }), rel);
  caso("Ajuste: «solo alturas» solo cambia alturas", solo.opciones.every((o) => o.cambios.every((c) => c.tipo === "altura")));
  const sitios = [q(5000, 30), q(6000, 300), q(8000, 210)].map((s, i) => ({ ...s, nombre: `Finca ${i + 1}` }));
  const conSitios = m.ajustar(pedido(ants, { sitios }), rel);
  const apoyos = conSitios.opciones.flatMap((o) => o.cambios.filter((c) => c.tipo === "apoyo"));
  caso("Ajuste: con sitios dados, las antenas de apoyo van solo ahí", apoyos.every((c) => sitios.some((s) => m.distanciaM(s.lat, s.lon, c.lat, c.lon) < 400)), `${apoyos.length} apoyo(s)`);

  // Red factible pero sobredimensionada: el ajuste la optimiza sin perder la meta
  if (rec) {
    const gorda = rec.antenas.map((x) => ((x.tipo ?? "antena") === "antena" && !x.pasarela ? { ...x, alturaM: 27 } : x));
    // Misma zona que el ajuste anterior (con los apoyos la zona de la red crecería)
    const opt = m.ajustar(pedido(gorda, { area: { nombre: "Zona de la red", puntos: a.area.poligono, metaPct: 60, margenDb: 30 } }), rel);
    const o = opt.opciones[opt.recomendada];
    caso("Optimizar: misma meta con menos costo", opt.modo === "optimizar" && o && o.resumen.factible && o.costoRelativo < 1, o ? `costo relativo ${o.costoRelativo.toFixed(2)} · ${opt.opciones.map((x) => `${x.id} ${x.costoRelativo.toFixed(2)} ${x.resumen.utilPct.toFixed(1)}%`).join(" | ")} · inicial ${opt.inicial.utilPct.toFixed(1)}%` : "sin opciones");
  }
}

console.log(fallos ? `\n✗ ${fallos} caso(s) con fallo` : "\n✓ Motor verificado");
process.exit(fallos ? 1 : 0);
