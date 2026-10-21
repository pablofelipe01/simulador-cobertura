// Orquesta una simulación completa: relieve → cobertura → enlaces → malla → factibilidad.
import { presetPorId, RADIO_EFECTIVO_M, ZOOM_RELIEVE } from "./constantes";
import { calcularCobertura, cajaDeEstudio, crearMalla } from "./cobertura";
import { perdidaEntorno } from "./entorno";
import { distanciaM, metrosPorGrado, rumbo } from "./geo";
import { analizarMalla, calcularEnlaces, evaluarFactibilidad } from "./malla";
import { clasePorMargen, longitudOnda, presupuestoCobertura, presupuestoEnlace } from "./modelo";
import { anguloElevacion, atenuacionPatron } from "./patron";
import { calcularPerfil, pasoPerfil, type ExtremoPerfil } from "./perfil";
import { calculoRed, completarParametros, resumenRed } from "./red";
import { relieveDesdeHgt, relieveDesdeTeselas, relievePlano, type CargarTesela, type ColeccionHgt, type Relieve } from "./relieve";
import type { Antena, Caja, FuenteRelieve, InformeEnlace, Parametros, Perfil, PerfilTerreno, PuntoPerfil, ResultadoSimulacion } from "./tipos";
import { geometriaTrayecto, perdidasTrayecto } from "./trayecto";

export type Contexto = {
  cargarTesela: CargarTesela;
  hgt: ColeccionHgt;
  progreso?: (fase: "relieve" | "cobertura" | "enlaces", avance: number) => void;
  ceder?: () => Promise<boolean>;
};

let ultimo: { clave: string; relieve: Relieve } | null = null;

function claveFuente(fuente: FuenteRelieve, ctx: Contexto) {
  return fuente.tipo === "teselas" ? `t:${fuente.url}` : fuente.tipo === "hgt" ? `h:${ctx.hgt.lista.map((h) => h.nombre).join(",")}` : "p";
}

/** Relieve para una caja; reutiliza el último si la cubre y la fuente no cambió. */
export async function obtenerRelieve(caja: Caja, fuente: FuenteRelieve, ctx: Contexto): Promise<Relieve> {
  const clave = claveFuente(fuente, ctx);
  if (ultimo && ultimo.clave === clave && ultimo.relieve.contiene(caja) && ultimo.relieve.estado.fuente !== "plano") return ultimo.relieve;
  let relieve: Relieve;
  if (fuente.tipo === "teselas") relieve = await relieveDesdeTeselas(caja, ZOOM_RELIEVE, ctx.cargarTesela, (a) => ctx.progreso?.("relieve", a));
  else if (fuente.tipo === "hgt") relieve = relieveDesdeHgt(caja, ctx.hgt, (a) => ctx.progreso?.("relieve", a));
  else relieve = relievePlano(caja);
  ultimo = { clave, relieve };
  return relieve;
}

export function olvidarRelieve() {
  ultimo = null;
}

export async function simular(id: number, todas: Antena[], parametros: Parametros, fuente: FuenteRelieve, ctx: Contexto): Promise<ResultadoSimulacion | null> {
  const inicio = performance.now();
  const p = completarParametros(parametros);
  const activas = todas.filter((a) => a.activa);
  if (activas.length === 0) throw new Error("No hay nodos activos para simular.");
  // Los nodos antena generan la cobertura; los nodos de campo solo participan en la malla.
  const conCobertura = activas.filter((a) => (a.tipo ?? "antena") === "antena");
  const antenas = conCobertura.length ? conCobertura : activas;
  const malla = crearMalla(antenas, p);
  // El relieve cubre la malla de cobertura y también los nodos de campo (para sus enlaces)
  const todosNodos = cajaDeEstudio(activas, 0, 1);
  const cajaRelieve = {
    oeste: Math.min(malla.caja.oeste, todosNodos.oeste),
    este: Math.max(malla.caja.este, todosNodos.este),
    sur: Math.min(malla.caja.sur, todosNodos.sur),
    norte: Math.max(malla.caja.norte, todosNodos.norte),
  };
  ctx.progreso?.("relieve", 0);
  const relieve = await obtenerRelieve(cajaRelieve, fuente, ctx);
  if (ctx.ceder && (await ctx.ceder())) return null;
  const cobertura = await calcularCobertura(antenas, p, relieve, malla, (a) => ctx.progreso?.("cobertura", a), ctx.ceder);
  if (!cobertura) return null;
  ctx.progreso?.("enlaces", 0);
  const enlaces = calcularEnlaces(activas, p, relieve);
  const analisis = analizarMalla(activas, enlaces, p.limiteSaltos);
  const factibilidad = evaluarFactibilidad({
    antenas: activas,
    parametros: p,
    enlaces,
    analisis,
    porcentajeServicio: cobertura.porcentajeServicio,
    porcentajeConfiable: cobertura.porcentajeConfiable,
    porcentajeRespaldo: cobertura.porcentajeRespaldo,
  });
  ctx.progreso?.("enlaces", 1);
  const presupuestos = antenas.map((a) => presupuestoCobertura(a, p));
  return {
    id,
    malla: { caja: malla.caja, ancho: malla.ancho, alto: malla.alto, celdaM: malla.celdaM },
    mejor: cobertura.mejor,
    segundo: cobertura.segundo,
    servidor: cobertura.servidor,
    servidores: cobertura.servidores,
    porAntena: cobertura.porAntena,
    antenas: cobertura.antenas,
    areaEstudioKm2: cobertura.areaEstudioKm2,
    areaPorClase: cobertura.areaPorClase,
    porcentajeServicio: cobertura.porcentajeServicio,
    porcentajeConfiable: cobertura.porcentajeConfiable,
    porcentajeRespaldo: cobertura.porcentajeRespaldo,
    enlaces,
    nodos: analisis.nodos,
    factibilidad,
    relieve: relieve.estado,
    presupuestoDb: Math.max(...presupuestos),
    sensibilidadDbm: presetPorId(p.preset).sensibilidadDbm,
    gananciaRxDbi: p.gananciaRxDbi,
    frecuenciaMhz: p.frecuenciaMhz,
    duracionMs: Math.round(performance.now() - inicio),
  };
}

export type MargenPunto = { id: string; nombre: string; distanciaKm: number; margenDb: number; clase: ReturnType<typeof clasePorMargen>; lineaVista: boolean };
export type Inspeccion = { lat: number; lon: number; elevacionM: number; margenes: MargenPunto[]; sensibilidadDbm: number; gananciaRxDbi: number; frecuenciaMhz: number };

/** Margen de cada antena activa hacia un punto del mapa (receptor a la altura configurada). */
export async function inspeccionar(lat: number, lon: number, todas: Antena[], parametros: Parametros, fuente: FuenteRelieve, ctx: Contexto): Promise<Inspeccion> {
  const p = completarParametros(parametros);
  const antenas = todas.filter((a) => a.activa);
  const m = metrosPorGrado(lat);
  const r = 1000;
  let caja = { oeste: lon - r / m.lon, este: lon + r / m.lon, sur: lat - r / m.lat, norte: lat + r / m.lat };
  if (antenas.length) {
    const c = cajaDeEstudio(antenas, 0, 1);
    caja = { oeste: Math.min(caja.oeste, c.oeste), este: Math.max(caja.este, c.este), sur: Math.min(caja.sur, c.sur), norte: Math.max(caja.norte, c.norte) };
  }
  const relieve = await obtenerRelieve(caja, fuente, ctx);
  const lambda = longitudOnda(p.frecuenciaMhz);
  const red = calculoRed(p);
  const [bx, by] = relieve.pixel(lat, lon);
  const suelo = relieve.muestra(bx, by);
  const entornoRx = perdidaEntorno(p.entorno, p.alturaRxM, p.frecuenciaMhz);
  const margenes = antenas.map((a) => {
    const [ax, ay] = relieve.pixel(a.lat, a.lon);
    const ea = { px: ax, py: ay, suelo: relieve.muestra(ax, ay), alturaM: a.alturaM };
    const d = Math.max(distanciaM(a.lat, a.lon, lat, lon), 30);
    const g = geometriaTrayecto(relieve, red, ea, { px: bx, py: by, suelo, alturaM: p.alturaRxM }, d, lambda, pasoPerfil(relieve, a.lat));
    const extra =
      entornoRx + perdidaEntorno(p.entorno, a.alturaM, p.frecuenciaMhz) + atenuacionPatron(a, rumbo(a.lat, a.lon, lat, lon), anguloElevacion(ea.suelo + a.alturaM, suelo + p.alturaRxM, d));
    const mg = presupuestoCobertura(a, p) - perdidasTrayecto(g, red, p.frecuenciaMhz, a.alturaM).totalDb - extra;
    return { id: a.id, nombre: a.nombre, distanciaKm: d / 1000, margenDb: mg, clase: clasePorMargen(mg), lineaVista: g.vMax <= -0.6 * Math.SQRT2 };
  });
  margenes.sort((x, y) => y.margenDb - x.margenDb);
  return { lat, lon, elevacionM: suelo, margenes, sensibilidadDbm: presetPorId(p.preset).sensibilidadDbm, gananciaRxDbi: p.gananciaRxDbi, frecuenciaMhz: p.frecuenciaMhz };
}

/** Perfil de una antena hacia otra antena o hacia un punto (receptor genérico). */
export async function perfil(
  tx: Antena,
  destino: Antena | { lat: number; lon: number; alturaM?: number },
  parametros: Parametros,
  fuente: FuenteRelieve,
  ctx: Contexto,
): Promise<Perfil> {
  const p = completarParametros(parametros);
  const esAntena = "id" in destino;
  const b: ExtremoPerfil = { lat: destino.lat, lon: destino.lon, alturaM: destino.alturaM ?? p.alturaRxM };
  const m = metrosPorGrado((tx.lat + b.lat) / 2);
  const borde = 500;
  const caja = {
    oeste: Math.min(tx.lon, b.lon) - borde / m.lon,
    este: Math.max(tx.lon, b.lon) + borde / m.lon,
    sur: Math.min(tx.lat, b.lat) - borde / m.lat,
    norte: Math.max(tx.lat, b.lat) + borde / m.lat,
  };
  const relieve = await obtenerRelieve(caja, fuente, ctx);
  const rx = esAntena ? (destino as Antena) : null;
  const presupuesto = rx ? presupuestoEnlace(tx, rx, p) : presupuestoCobertura(tx, p);
  const base = calcularPerfil(relieve, { lat: tx.lat, lon: tx.lon, alturaM: tx.alturaM }, b, p.frecuenciaMhz, presupuesto, tx.alturaM);
  const informe = informeEnlace(relieve, tx, rx, b, p, base);
  // El margen del perfil es el del informe (incluye red, entorno y patrón de las antenas)
  return { ...base, margenDb: informe.margenDb, clase: informe.clase, informe };
}

/** Informe de radioenlace de `tx` hacia otro nodo (`rx`) o hacia un receptor genérico en `b`. */
function informeEnlace(relieve: Relieve, tx: Antena, rx: Antena | null, b: ExtremoPerfil, p: Parametros, perfilBase: Perfil): InformeEnlace {
  const red = calculoRed(p);
  const lambda = longitudOnda(p.frecuenciaMhz);
  const d = perfilBase.distanciaM;
  const [ax, ay] = relieve.pixel(tx.lat, tx.lon);
  const [bx, by] = relieve.pixel(b.lat, b.lon);
  const ea = { px: ax, py: ay, suelo: relieve.muestra(ax, ay), alturaM: tx.alturaM };
  const eb = { px: bx, py: by, suelo: relieve.muestra(bx, by), alturaM: b.alturaM };
  const za = ea.suelo + ea.alturaM;
  const zb = eb.suelo + eb.alturaM;
  const g = geometriaTrayecto(relieve, red, ea, eb, d, lambda, pasoPerfil(relieve, tx.lat), true);
  const perdidas = perdidasTrayecto(g, red, p.frecuenciaMhz, tx.alturaM);
  const rumboIda = rumbo(tx.lat, tx.lon, b.lat, b.lon);
  const rumboVuelta = rumbo(b.lat, b.lon, tx.lat, tx.lon);
  const elevIda = anguloElevacion(za, zb, d);
  const elevVuelta = anguloElevacion(zb, za, d);
  const patronTx = atenuacionPatron(tx, rumboIda, elevIda);
  const patronRx = rx ? atenuacionPatron(rx, rumboVuelta, elevVuelta) : 0;
  const entorno = perdidaEntorno(p.entorno, tx.alturaM, p.frecuenciaMhz) + perdidaEntorno(p.entorno, b.alturaM, p.frecuenciaMhz);
  const sensibilidad = presetPorId(p.preset).sensibilidadDbm;
  const gananciaRx = rx ? rx.gananciaDbi : p.gananciaRxDbi;
  const cableRx = rx ? rx.perdidaCableDb : 0;
  const extraRx = rx ? 0 : p.perdidaExtraDb;
  const pire = tx.potenciaDbm - tx.perdidaCableDb + tx.gananciaDbi - patronTx;
  const nivel = pire - perdidas.totalDb - entorno + gananciaRx - patronRx - cableRx - extraRx;
  const margenDb = nivel - sensibilidad;
  return {
    origen: tx.nombre,
    destino: rx ? rx.nombre : "Receptor en el punto",
    entreNodos: Boolean(rx),
    modelo: p.modelo,
    frecuenciaMhz: p.frecuenciaMhz,
    distanciaKm: d / 1000,
    rumboIdaDeg: rumboIda,
    rumboVueltaDeg: rumboVuelta,
    elevacionIdaDeg: elevIda,
    elevacionVueltaDeg: elevVuelta,
    sueloOrigenM: ea.suelo,
    sueloDestinoM: eb.suelo,
    alturaOrigenM: tx.alturaM,
    alturaDestinoM: b.alturaM,
    // v = −√2 · despeje/F1: el peor despeje es el del obstáculo principal
    peorFresnel: -g.vMax / Math.SQRT2,
    peorFresnelKm: (perfilBase.obstaculoM ?? peorPunto(perfilBase, lambda)) / 1000,
    lineaVista: g.vMax <= -0.6 * Math.SQRT2,
    potenciaTxDbm: tx.potenciaDbm,
    perdidaCableTxDb: tx.perdidaCableDb,
    gananciaTxDbi: tx.gananciaDbi,
    patronTxDb: patronTx,
    pireDbm: pire,
    gananciaRxDbi: gananciaRx,
    patronRxDb: patronRx,
    perdidaCableRxDb: cableRx,
    perdidaExtraRxDb: extraRx,
    espacioLibreDb: perdidas.espacioLibreDb,
    obstruccionDb: perdidas.obstruccionDb,
    estadisticaDb: perdidas.estadisticaDb,
    ajusteRedDb: perdidas.ajusteRedDb,
    entornoDb: entorno,
    perdidaTotalDb: perdidas.totalDb + entorno,
    itm: g.itm ? { perdidaDb: g.itm.perdidaDb, referenciaDb: g.itm.referenciaDb, modo: g.itm.modo, aviso: g.itm.aviso } : { perdidaDb: NaN, referenciaDb: NaN, modo: "linea-vista", aviso: 4 },
    nivelDbm: nivel,
    sensibilidadDbm: sensibilidad,
    margenDb,
    clase: clasePorMargen(margenDb),
    parametrosTexto: resumenRed(p),
  };
}

/** Distancia (m) del punto con menor despeje de Fresnel en el perfil graficado. */
function peorPunto(pf: Perfil, lambda: number): number {
  const d = pf.distanciaM;
  let peor = d / 2;
  let minimo = Infinity;
  for (const q of pf.puntos) {
    const x = q.distanciaM;
    if (x <= 0 || x >= d) continue;
    const linea = pf.alturaInicioM + ((pf.alturaFinM - pf.alturaInicioM) * x) / d;
    const despeje = (linea - q.terrenoM - (x * (d - x)) / (2 * RADIO_EFECTIVO_M)) / Math.sqrt((lambda * x * (d - x)) / d);
    if (despeje < minimo) {
      minimo = despeje;
      peor = x;
    }
  }
  return peor;
}

/** Perfil del terreno a lo largo de una ruta de puntos [lon, lat] (para la regla de medición). */
export async function perfilTerreno(puntos: [number, number][], fuente: FuenteRelieve, ctx: Contexto, maxMuestras = 700): Promise<PerfilTerreno> {
  if (puntos.length < 2) throw new Error("La medición necesita al menos dos puntos.");
  let caja = { oeste: Infinity, sur: Infinity, este: -Infinity, norte: -Infinity };
  for (const [lon, lat] of puntos) caja = { oeste: Math.min(caja.oeste, lon), este: Math.max(caja.este, lon), sur: Math.min(caja.sur, lat), norte: Math.max(caja.norte, lat) };
  const m = metrosPorGrado((caja.norte + caja.sur) / 2);
  const borde = 300;
  caja = { oeste: caja.oeste - borde / m.lon, este: caja.este + borde / m.lon, sur: caja.sur - borde / m.lat, norte: caja.norte + borde / m.lat };
  const relieve = await obtenerRelieve(caja, fuente, ctx);
  const tramos = puntos.slice(1).map((b, i) => distanciaM(puntos[i][1], puntos[i][0], b[1], b[0]));
  const total = tramos.reduce((s, d) => s + d, 0);
  const paso = Math.max(total / maxMuestras, relieve.estado.fuente === "plano" ? total / 50 : relieve.resolucionM(caja.sur) * 0.5);
  const salida: PuntoPerfil[] = [];
  const vertices: number[] = [0];
  let acumulado = 0;
  tramos.forEach((d, i) => {
    const [ax, ay] = relieve.pixel(puntos[i][1], puntos[i][0]);
    const [bx, by] = relieve.pixel(puntos[i + 1][1], puntos[i + 1][0]);
    const n = Math.max(1, Math.ceil(d / paso));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      salida.push({ distanciaM: acumulado + d * t, terrenoM: relieve.muestra(ax + (bx - ax) * t, ay + (by - ay) * t) });
    }
    acumulado += d;
    vertices.push(acumulado);
  });
  let subida = 0;
  let bajada = 0;
  for (let k = 1; k < salida.length; k++) {
    const dz = salida[k].terrenoM - salida[k - 1].terrenoM;
    if (dz > 0) subida += dz;
    else bajada -= dz;
  }
  const alturas = salida.map((q) => q.terrenoM);
  return {
    distanciaM: total,
    puntos: salida,
    vertices,
    minimoM: Math.min(...alturas),
    maximoM: Math.max(...alturas),
    subidaM: subida,
    bajadaM: bajada,
    fuente: relieve.estado.fuente,
  };
}
