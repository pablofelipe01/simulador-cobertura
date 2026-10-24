// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Ajuste inteligente de la red («Ajústamelo automáticamente»). Con el relieve real busca la red factible con la
// mejor relación cobertura–costo. Parte de la red que hay y prueba, paso a paso, cada mejora posible: subir o
// bajar torres (de 6 a 30 m, nunca más), correr un nodo a una loma cercana, cambiar el tipo de antena o sugerir
// una antena de apoyo (un punto con coordenadas, o uno de los sitios que dio el usuario). Primero conecta a quien
// no llega al gateway o llega débil; después gana cobertura útil (señal media o mejor) eligiendo siempre lo que
// más cubre por peso invertido. Con esa curva cobertura–costo arma tres opciones: la económica (lo mínimo para
// ser factible), la recomendada (hasta donde cada peso extra todavía rinde) y la de máxima cobertura. Después poda
// lo que sobra y verifica cada opción con las celdas del mapa. Los precios son internos (costos.ts).
//
// La cobertura se mide en una zona fija: el área objetivo (la del diseño por área o un área medida) o, si no hay,
// la zona de la red (los círculos de estudio alrededor de los nodos antena actuales). Así una antena de apoyo no
// agranda la zona que hay que cubrir.
import { celdasEnPoligono, conArea, muestrasEnPoligono, poligonoCirculo, type Poligono } from "./area";
import { crearMalla, evaluadorMargen } from "./cobertura";
import { UMBRAL_CONFIABLE_DB, UMBRAL_SERVICIO_DB, UMBRAL_UTIL_DB } from "./constantes";
import { ALTURA_MAXIMA_M, ALTURAS_TORRE, COSTO_APOYO_TIPICO, costoNodo, COSTO_REUBICAR } from "./costos";
import { cajaDiseno, disenar } from "./diseno";
import { areaPoligonoM2, desplazar, distanciaM, metrosPorGrado, rumbo } from "./geo";
import { analizarMalla, enlaceEntre } from "./malla";
import { claseEnlace, longitudOnda } from "./modelo";
import { patronPorId } from "./patron";
import { calculoRed, completarParametros } from "./red";
import type { Relieve } from "./relieve";
import type { Antena, Caja, Enlace, NodoMalla, Parametros, PatronId } from "./tipos";

/** Qué puede cambiar el ajuste. */
export type PermisosAjuste = {
  /** Sugerir antenas de apoyo (puntos nuevos). */
  apoyos: boolean;
  /** Subir o bajar torres (6–30 m). */
  alturas: boolean;
  /** Correr nodos a una loma cercana (el gateway nunca se mueve). */
  mover: boolean;
  /** Cambiar el tipo de antena (omnidireccional o sectorial). */
  antenas: boolean;
  /** Quitar nodos antena que sobran (solo al optimizar una red que ya es factible). */
  quitar: boolean;
};
export const PERMISOS_AJUSTE: PermisosAjuste = { apoyos: true, alturas: true, mover: true, antenas: true, quitar: true };

/** Área objetivo con su meta (la del diseño por área o un área medida). */
export type AreaAjuste = { puntos: Poligono; nombre: string; metaPct: number; margenDb: number; respaldo?: boolean };

export type SitioAjuste = { lat: number; lon: number; nombre?: string };

export type PedidoAjuste = {
  /** Nodos de la red (se usan los activos): gateway, repetidores, nodos antena y personas o nodos de campo. */
  antenas: Antena[];
  parametros: Parametros;
  /** Área objetivo; sin ella se evalúa la zona de la red (los círculos de estudio de los nodos antena). */
  area: AreaAjuste | null;
  /** Meta de cobertura útil de la zona de la red (%), cuando no hay área objetivo. */
  metaPct: number;
  permisos: PermisosAjuste;
  /** Altura máxima de torre (m, hasta 30). */
  alturaMaxM: number;
  maxApoyos: number;
  /** Sitios posibles para las antenas de apoyo (si el usuario los dio, solo se usan esos). */
  sitios?: SitioAjuste[];
  /** Nodos que no se mueven ni se quitan. */
  fijos?: string[];
  /** Plantilla de la antena de apoyo (equipo de un repetidor). */
  plantillaApoyo: Antena;
};

export type CambioAjuste =
  | { tipo: "altura"; id: string; nombre: string; deM: number; aM: number }
  | { tipo: "mover"; id: string; nombre: string; lat: number; lon: number; distanciaM: number; rumboDeg: number; subeM: number }
  | { tipo: "antena"; id: string; nombre: string; patron: PatronId; azimutDeg: number }
  | { tipo: "apoyo"; id: string; nombre: string; lat: number; lon: number; alturaM: number; sueloM: number; sitio?: string; enlazaCon: string | null; enlaceDb: number | null }
  | { tipo: "quitar"; id: string; nombre: string };

export type ResumenRed = {
  utilPct: number;
  confiablePct: number;
  servicioPct: number;
  conectada: boolean;
  saltosOk: boolean;
  solidas: boolean;
  coberturaOk: boolean;
  factible: boolean;
  /** Nodos antena (infraestructura) y cuántos son de apoyo. */
  nodosAntena: number;
  apoyos: number;
  alturaMaxM: number;
};

export type OpcionAjuste = {
  id: "economica" | "recomendada" | "maxima";
  titulo: string;
  porQue: string;
  cambios: CambioAjuste[];
  /** Red completa resultante (los apoyos nuevos con id «nuevo-apoyo-N»). */
  antenas: Antena[];
  resumen: ResumenRed;
  /** Costo relativo frente a la red actual (1 = igual): solo para comparar, no se muestra en pesos. */
  costoRelativo: number;
};

export type Ajuste = {
  /** «ajustar»: dejarla factible al menor costo; «optimizar»: ya era factible, la misma cobertura más barata. */
  modo: "ajustar" | "optimizar";
  /** Zona donde se midió la cobertura: el área objetivo o la zona de la red (con su contorno). */
  area: { nombre: string; tipo: "objetivo" | "zona"; poligono: Poligono; areaKm2: number };
  metaPct: number;
  margenDb: number;
  alturaMaxM: number;
  inicial: ResumenRed & { problemas: string[] };
  opciones: OpcionAjuste[];
  /** Índice de la opción recomendada. */
  recomendada: number;
  /** Frases del análisis (sin precios). */
  analisis: string[];
  motivo: string | null;
};

const MUESTRAS = 3000;
const MUESTRAS_FINAS = 40000;
const MAX_SITIOS = 220;
const RADIOS_LOMA = [150, 300, 500];
const ENLACE_SOLIDO_DB = 30;
const PASOS_REPARAR = 24;
const PASOS_COBERTURA = 30;

type Nodo = { a: Antena; origen: "existente" | "apoyo"; cubre: boolean; sitio?: string };
type Muestra = { lats: Float64Array; lons: Float64Array; pesos: Float64Array; filas: Map<string, Int8Array> };
type Cob = { mejor: Int16Array; segundo: Int16Array };
type Medida = { utilPct: number; confiablePct: number; servicioPct: number };
type Analisis = { nodos: NodoMalla[]; D: number; conectada: boolean; saltosOk: boolean; solidas: boolean };
type Estado = { cfg: Nodo[]; med: Medida; an: Analisis; costo: number };
type Cambio =
  | { t: "altura"; i: number; h: number }
  | { t: "mover"; i: number; lat: number; lon: number }
  | { t: "patron"; i: number; patron: PatronId; az: number }
  | { t: "apoyo"; s: number; h: number }
  | { t: "par"; r: number; hr: number; s: number; hs: number }
  | { t: "quitar"; i: number };

const firma = (a: Antena) =>
  `${a.lat.toFixed(6)},${a.lon.toFixed(6)},${a.alturaM},${a.patron ?? "omni"},${a.azimutDeg ?? 0},${a.elevacionDeg ?? 0},${a.potenciaDbm},${a.gananciaDbi},${a.perdidaCableDb},${a.tipo ?? "antena"}`;

const cubreCobertura = (a: Antena) => (a.tipo ?? "antena") === "antena";

/** Zona de la red: el contorno de los círculos de estudio alrededor de los nodos antena activos. */
export function zonaDeRed(antenas: Antena[], radioKm: number): Poligono | null {
  const centros = antenas.filter((a) => a.activa && cubreCobertura(a));
  return centros.length ? contornoCirculos(centros, radioKm * 1000) : null;
}

/** Caja del relieve que necesita el ajuste: los nodos, la zona y los sitios, más el radio de estudio. */
export function cajaAjuste(pedido: Pick<PedidoAjuste, "antenas" | "parametros" | "area" | "sitios">): Caja {
  const activas = pedido.antenas.filter((a) => a.activa);
  const poligono = pedido.area?.puntos ?? zonaDeRed(activas, pedido.parametros.radioKm ?? 10);
  const caja = cajaSitios(activas, poligono, pedido.sitios ?? []);
  return ampliar(caja, (pedido.parametros.radioKm ?? 10) * 1000 + 800);
}

function ampliar(c: Caja, m: number): Caja {
  const g = metrosPorGrado((c.sur + c.norte) / 2);
  return { oeste: c.oeste - m / g.lon, este: c.este + m / g.lon, sur: c.sur - m / g.lat, norte: c.norte + m / g.lat };
}

/** Zona donde se buscan sitios de apoyo: la zona a cubrir con su borde, los nodos y los sitios dados. */
function cajaSitios(nodos: { lat: number; lon: number }[], poligono: Poligono | null, sitios: SitioAjuste[]): Caja {
  const puntos = [...nodos, ...sitios];
  if (poligono) return cajaDiseno(poligono, puntos);
  let c: Caja = { oeste: Infinity, sur: Infinity, este: -Infinity, norte: -Infinity };
  for (const q of puntos) c = { oeste: Math.min(c.oeste, q.lon), este: Math.max(c.este, q.lon), sur: Math.min(c.sur, q.lat), norte: Math.max(c.norte, q.lat) };
  return ampliar(c, 2500);
}

export function ajustar(pedido: PedidoAjuste, relieve: Relieve): Ajuste {
  const p = completarParametros(pedido.parametros);
  const red = calculoRed(p);
  const lambda = longitudOnda(p.frecuenciaMhz);
  const radioM = p.radioKm * 1000;
  const limite = p.limiteSaltos;
  const activas = pedido.antenas.filter((a) => a.activa);
  const zonaPol = pedido.area?.puntos ?? zonaDeRed(activas, p.radioKm);
  const area: AreaAjuste | null = pedido.area ?? (zonaPol ? { puntos: zonaPol, nombre: "la zona de la red", metaPct: pedido.metaPct, margenDb: UMBRAL_UTIL_DB } : null);
  const tipoZona: Ajuste["area"]["tipo"] = pedido.area ? "objetivo" : "zona";
  const margenDb = area?.margenDb ?? UMBRAL_UTIL_DB;
  const meta = Math.min(100, Math.max(1, area?.metaPct ?? pedido.metaPct));
  const respaldo = Boolean(area?.respaldo);
  const alturaMax = Math.min(ALTURA_MAXIMA_M, Math.max(6, pedido.alturaMaxM));
  const alturas = ALTURAS_TORRE.filter((h) => h <= alturaMax);
  const permisos = pedido.permisos;
  const fijos = new Set(pedido.fijos ?? []);
  const suelo = (lat: number, lon: number) => relieve.elevacion(lat, lon);
  const originales = new Map(activas.map((a) => [a.id, a]));

  // ---------- Filas de margen (cada nodo hacia cada punto de una muestra) ----------
  const fila = (a: Antena, M: Muestra): Int8Array => {
    const clave = firma(a);
    const previa = M.filas.get(clave);
    if (previa) return previa;
    const ev = evaluadorMargen(a, p, relieve);
    const g = metrosPorGrado(a.lat);
    const salida = new Int8Array(M.lats.length);
    for (let k = 0; k < M.lats.length; k++) {
      const dy = (M.lats[k] - a.lat) * g.lat;
      const dx = (M.lons[k] - a.lon) * g.lon;
      if (dx * dx + dy * dy > radioM * radioM) salida[k] = -128;
      else {
        // Hacia abajo, como en el diseño: «≥ 30» en entero equivale a «≥ 30» en el margen del mapa
        const v = Math.floor(ev(M.lats[k], M.lons[k]));
        salida[k] = v > 127 ? 127 : v < -127 ? -127 : v;
      }
    }
    M.filas.set(clave, salida);
    return salida;
  };
  const sumar = (c: Cob, f: Int8Array) => {
    for (let k = 0; k < f.length; k++) {
      const v = f[k];
      if (v > c.mejor[k]) {
        c.segundo[k] = c.mejor[k];
        c.mejor[k] = v;
      } else if (v > c.segundo[k]) c.segundo[k] = v;
    }
  };
  const cobDe = (cfg: Nodo[], M: Muestra, excluir = -1): Cob => {
    const P = M.lats.length;
    const c: Cob = { mejor: new Int16Array(P).fill(-128), segundo: new Int16Array(P).fill(-128) };
    cfg.forEach((n, i) => {
      if (i !== excluir && n.cubre) sumar(c, fila(n.a, M));
    });
    return c;
  };
  const medir = (c: Cob, M: Muestra, extras: Int8Array[] = []): Medida => {
    let tot = 0;
    let util = 0;
    let conf = 0;
    let serv = 0;
    const n = M.lats.length;
    for (let k = 0; k < n; k++) {
      let m1 = c.mejor[k];
      let m2 = c.segundo[k];
      for (const f of extras) {
        const v = f[k];
        if (v > m1) {
          m2 = m1;
          m1 = v;
        } else if (v > m2) m2 = v;
      }
      const w = M.pesos[k];
      tot += w;
      if ((respaldo ? m2 : m1) >= margenDb) util += w;
      if (m1 >= UMBRAL_CONFIABLE_DB) conf += w;
      if (m1 >= UMBRAL_SERVICIO_DB) serv += w;
    }
    return tot > 0 ? { utilPct: (100 * util) / tot, confiablePct: (100 * conf) / tot, servicioPct: (100 * serv) / tot } : { utilPct: 0, confiablePct: 0, servicioPct: 0 };
  };

  // ---------- Enlaces y malla ----------
  const margenes = new Map<string, number>();
  const margenEnlace = (a: Antena, b: Antena) => {
    const fa = firma(a);
    const fb = firma(b);
    const clave = fa < fb ? `${fa}|${fb}` : `${fb}|${fa}`;
    let m = margenes.get(clave);
    if (m === undefined) {
      m = enlaceEntre(a, b, p, relieve, red, lambda).margen;
      margenes.set(clave, m);
    }
    return m;
  };
  const analizar = (cfg: Nodo[]): Analisis => {
    const ants = cfg.map((n) => n.a);
    const enlaces: Enlace[] = [];
    for (let i = 0; i < ants.length; i++)
      for (let j = i + 1; j < ants.length; j++) {
        const m = margenEnlace(ants[i], ants[j]);
        if (m >= UMBRAL_SERVICIO_DB) enlaces.push({ a: ants[i].id, b: ants[j].id, distanciaKm: 0, margenAB: m, margenBA: m, margen: m, clase: claseEnlace(m), vMax: 0, lineaVista: false });
      }
    const { nodos } = analizarMalla(ants, enlaces, limite);
    if (!ants.some((a) => a.pasarela)) return { nodos, D: 1e9, conectada: false, saltosOk: false, solidas: false };
    const porId = new Map(nodos.map((x) => [x.id, x]));
    let D = 0;
    let conectada = true;
    let saltosOk = true;
    let solidas = true;
    const conectados = ants.filter((a) => porId.get(a.id)?.saltos !== null);
    for (const a of ants) {
      if (a.pasarela) continue;
      const nm = porId.get(a.id)!;
      if (nm.saltos === null) {
        conectada = false;
        // Quien no llega suma mucho; cuanto más cerca está de enlazar, menos (así se ve el avance de un relevo)
        let mejor = -60;
        for (const b of conectados) mejor = Math.max(mejor, margenEnlace(a, b));
        D += 1000 + 8 * Math.min(60, Math.max(0, UMBRAL_SERVICIO_DB - mejor));
      } else if (nm.saltos > limite) {
        saltosOk = false;
        D += 300 + 100 * (nm.saltos - limite);
      } else if (nm.cuelloDb !== null && nm.cuelloDb < ENLACE_SOLIDO_DB) {
        solidas = false;
        D += ENLACE_SOLIDO_DB - nm.cuelloDb;
      }
    }
    return { nodos, D, conectada, saltosOk: conectada && saltosOk, solidas: conectada && solidas };
  };

  // ---------- Costo (interno) ----------
  const costo = (cfg: Nodo[]) => {
    let c = 0;
    for (const n of cfg) {
      c += costoNodo(n.a);
      if (n.origen === "existente") {
        const o = originales.get(n.a.id);
        if (o && (Math.abs(o.lat - n.a.lat) > 1e-7 || Math.abs(o.lon - n.a.lon) > 1e-7)) c += COSTO_REUBICAR;
      }
    }
    return c;
  };

  // ---------- Red inicial y muestra de la zona ----------
  const cfg0: Nodo[] = activas.map((a) => ({ a: { ...a }, origen: "existente", cubre: cubreCobertura(a) }));
  const sinGateway = !cfg0.some((n) => n.a.pasarela);
  const G: Muestra = area ? muestraArea(area.puntos, MUESTRAS) : { lats: new Float64Array(0), lons: new Float64Array(0), pesos: new Float64Array(0), filas: new Map() };

  // ---------- Sitios para antenas de apoyo ----------
  const zona = cajaSitios(
    activas,
    area?.puntos ?? null,
    pedido.sitios ?? [],
  );
  const sitios: { lat: number; lon: number; suelo: number; nombre?: string }[] = [];
  if (pedido.sitios?.length) for (const s of pedido.sitios) sitios.push({ ...s, suelo: suelo(s.lat, s.lon) });
  else {
    const g = metrosPorGrado((zona.sur + zona.norte) / 2);
    const ancho = (zona.este - zona.oeste) * g.lon;
    const alto = (zona.norte - zona.sur) * g.lat;
    const sep = Math.max(200, Math.sqrt((ancho * alto) / MAX_SITIOS));
    const infra = cfg0.filter((n) => n.cubre).map((n) => n.a);
    for (let y = sep / 2; y < alto; y += sep)
      for (let x = sep / 2; x < ancho; x += sep) {
        let lat = zona.norte - y / g.lat;
        let lon = zona.oeste + x / g.lon;
        // La loma más alta cerca del punto de la cuadrícula
        let mejor = suelo(lat, lon);
        for (let s = 0; s < 8; s++) {
          const q = desplazar(lat, lon, sep / 3, s * 45);
          const z = suelo(q.lat, q.lon);
          if (z > mejor + 0.5) {
            mejor = z;
            lat = q.lat;
            lon = q.lon;
          }
        }
        if (infra.some((a) => distanciaM(a.lat, a.lon, lat, lon) < 250)) continue;
        sitios.push({ lat, lon, suelo: mejor });
      }
  }

  let nApoyo = 0;
  const apoyoEn = (s: number, h: number, id: string): Nodo => {
    const q = sitios[s];
    return {
      a: { ...pedido.plantillaApoyo, id, nombre: "Apoyo", lat: Number(q.lat.toFixed(6)), lon: Number(q.lon.toFixed(6)), alturaM: h, tipo: "antena", pasarela: false, activa: true },
      origen: "apoyo",
      cubre: true,
      sitio: q.nombre,
    };
  };
  const apoyo = (s: number, h: number) => apoyoEn(s, h, `nuevo-apoyo-${++nApoyo}`);
  const apoyoPrueba = (s: number, h: number) => apoyoEn(s, h, `prueba-${s}-${h}`);
  const conPatron = (a: Antena, patron: PatronId, az: number): Antena =>
    patron === "omni"
      ? { ...a, patron: undefined, azimutDeg: undefined, elevacionDeg: undefined, gananciaDbi: patronPorId("omni").gananciaTipica }
      : { ...a, patron, azimutDeg: Math.round(((az % 360) + 360) % 360), elevacionDeg: 0, gananciaDbi: patronPorId(patron).gananciaTipica };

  const aplicarCambio = (cfg: Nodo[], c: Cambio, prueba = false): Nodo[] => {
    switch (c.t) {
      case "altura":
        return cfg.map((n, i) => (i === c.i ? { ...n, a: { ...n.a, alturaM: c.h } } : n));
      case "mover":
        return cfg.map((n, i) => (i === c.i ? { ...n, a: { ...n.a, lat: Number(c.lat.toFixed(6)), lon: Number(c.lon.toFixed(6)) } } : n));
      case "patron":
        return cfg.map((n, i) => (i === c.i ? { ...n, a: conPatron(n.a, c.patron, c.az) } : n));
      case "apoyo":
        return [...cfg, prueba ? apoyoPrueba(c.s, c.h) : apoyo(c.s, c.h)];
      case "par":
        return [...cfg, prueba ? apoyoPrueba(c.r, c.hr) : apoyo(c.r, c.hr), prueba ? apoyoPrueba(c.s, c.hs) : apoyo(c.s, c.hs)];
      case "quitar":
        return cfg.filter((_, i) => i !== c.i);
    }
  };

  const estadoDe = (cfg: Nodo[]): Estado => ({ cfg, med: medir(cobDe(cfg, G), G), an: analizar(cfg), costo: costo(cfg) });

  // ---------- Candidatos ----------
  /** Lomas cercanas a un nodo (más altas que su sitio), de la más alta a la más baja. */
  const lomas = (a: Antena) => {
    const z0 = suelo(a.lat, a.lon);
    const lista: { lat: number; lon: number; z: number }[] = [];
    for (const r of RADIOS_LOMA)
      for (let s = 0; s < 8; s++) {
        const q = desplazar(a.lat, a.lon, r, s * 45 + (r === 300 ? 22.5 : 0));
        const z = suelo(q.lat, q.lon);
        if (z >= z0 + 3) lista.push({ ...q, z });
      }
    return lista.sort((x, y) => y.z - x.z).slice(0, 5);
  };
  /** Rumbo hacia lo que le falta cubrir alrededor de un nodo (los puntos sin cobertura útil en su radio). */
  const rumboFaltante = (a: Antena, c: Cob): number | null => {
    const g = metrosPorGrado(a.lat);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let k = 0; k < G.lats.length; k++) {
      if ((respaldo ? c.segundo[k] : c.mejor[k]) >= margenDb) continue;
      const dy = (G.lats[k] - a.lat) * g.lat;
      const dx = (G.lons[k] - a.lon) * g.lon;
      const d2 = dx * dx + dy * dy;
      if (d2 > radioM * radioM || d2 < 1) continue;
      const d = Math.sqrt(d2);
      sx += dx / d;
      sy += dy / d;
      n++;
    }
    if (n < 10 || Math.hypot(sx, sy) < n * 0.25) return null;
    return ((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360;
  };

  const candidatos = (e: Estado, fase: "reparar" | "cobertura", c: Cob): Cambio[] => {
    const lista: Cambio[] = [];
    const apoyos = e.cfg.filter((n) => n.origen === "apoyo").length;
    e.cfg.forEach((n, i) => {
      if (!n.cubre) return;
      if (permisos.alturas) for (const h of alturas) if (h !== n.a.alturaM && (fase === "reparar" || h > n.a.alturaM)) lista.push({ t: "altura", i, h });
      if (permisos.mover && !n.a.pasarela && !fijos.has(n.a.id) && n.origen === "existente") for (const q of lomas(n.a)) lista.push({ t: "mover", i, lat: q.lat, lon: q.lon });
      if (permisos.antenas && !n.a.pasarela && n.origen === "existente") {
        if ((n.a.patron ?? "omni") === "omni") {
          const az = rumboFaltante(n.a, c);
          if (az !== null) {
            for (const d of [-30, 0, 30]) lista.push({ t: "patron", i, patron: "sectorial-120", az: az + d });
            lista.push({ t: "patron", i, patron: "sectorial-90", az });
          }
        } else lista.push({ t: "patron", i, patron: "omni", az: 0 });
      }
    });
    if (permisos.apoyos && apoyos < pedido.maxApoyos) {
      const usados = e.cfg.filter((n) => n.origen === "apoyo").map((n) => n.a);
      sitios.forEach((q, s) => {
        if (usados.some((a) => Math.abs(a.lat - q.lat) < 1e-6 && Math.abs(a.lon - q.lon) < 1e-6)) return;
        const hs = fase === "reparar" ? [6, 15, alturaMax] : [15];
        for (const h of new Set(hs.filter((x) => x <= alturaMax))) lista.push({ t: "apoyo", s, h });
      });
    }
    return lista;
  };

  /** Base de cobertura sin el nodo i (para evaluar cambios de ese nodo); se calcula una vez por paso. */
  const basesSin = new Map<number, Cob>();
  const baseSin = (e: Estado, i: number) => {
    let b = basesSin.get(i);
    if (!b) basesSin.set(i, (b = cobDe(e.cfg, G, i)));
    return b;
  };
  const medirCambio = (e: Estado, base: Cob, ch: Cambio, cfg2: Nodo[]): Medida => {
    switch (ch.t) {
      case "apoyo":
        return medir(base, G, [fila(cfg2[cfg2.length - 1].a, G)]);
      case "par":
        return medir(base, G, [fila(cfg2[cfg2.length - 2].a, G), fila(cfg2[cfg2.length - 1].a, G)]);
      case "quitar":
        return medir(baseSin(e, ch.i), G);
      default:
        return e.cfg[ch.i].cubre ? medir(baseSin(e, ch.i), G, [fila(cfg2[ch.i].a, G)]) : medir(baseSin(e, ch.i), G);
    }
  };

  // ---------- 1) Reparar: que todos lleguen al gateway, dentro del límite de saltos y con enlaces ≥ 30 dB ----------
  const camino: Estado[] = [];
  let actual = estadoDe(cfg0);
  camino.push(actual);
  const inicial = actual;
  let motivo: string | null = null;
  if (sinGateway) motivo = "No hay gateway: ponga el Gateway + Internet (la pasarela) y vuelva a pedir el ajuste.";
  // Lo decide la red: si ya es factible se optimiza (la misma cobertura con menos infraestructura); si no, se ajusta
  const modo: Ajuste["modo"] = !sinGateway && inicial.an.D === 0 && inicial.med.utilPct >= meta ? "optimizar" : "ajustar";

  if (!sinGateway && modo === "ajustar") {
    for (let paso = 0; paso < PASOS_REPARAR && actual.an.D > 0; paso++) {
      basesSin.clear();
      const base = cobDe(actual.cfg, G);
      let mejor: { cfg: Nodo[]; an: Analisis; puntaje: number; util: number; ch: Cambio } | null = null;
      for (const ch of candidatos(actual, "reparar", base)) {
        const cfg2 = aplicarCambio(actual.cfg, ch, true);
        const an2 = analizar(cfg2);
        if (an2.D >= actual.an.D - 1e-9) continue;
        const dC = costo(cfg2) - actual.costo;
        // Lo que más repara por peso; a igualdad, lo que más cubre
        const puntaje = (actual.an.D - an2.D) / Math.max(dC, 0.12 * COSTO_APOYO_TIPICO);
        if (mejor && puntaje < mejor.puntaje * 0.9999) continue;
        const util = medirCambio(actual, base, ch, cfg2).utilPct;
        if (!mejor || puntaje > mejor.puntaje * 1.0001 || util > mejor.util) mejor = { cfg: cfg2, an: an2, puntaje, util, ch };
      }
      if (!mejor) break;
      // Para una antena de apoyo se busca la torre justa: la más baja que repara lo mismo
      let ch = mejor.ch;
      if (ch.t === "apoyo") {
        const { s, h: hMejor } = ch;
        for (const h of alturas.filter((x) => x < hMejor)) {
          if (analizar(aplicarCambio(actual.cfg, { t: "apoyo", s, h }, true)).D <= mejor.an.D + 1e-9) {
            ch = { t: "apoyo", s, h };
            break;
          }
        }
      }
      actual = estadoDe(aplicarCambio(actual.cfg, ch));
      camino.push(actual);
    }
    if (actual.an.D > 0) motivo = textoNoRepara(actual);
  }

  // ---------- 2) Cobertura: lo que más cubre por peso, sin dañar la red ----------
  const crecer = (desde: Estado, pasos: number, registrar: Estado[]) => {
    let e = desde;
    // Gana cobertura sin empeorar la red (si un nodo no se pudo conectar, se mejora lo demás)
    for (let paso = 0; paso < pasos && e.med.utilPct < 99.95; paso++) {
      basesSin.clear();
      const base = cobDe(e.cfg, G);
      type Prueba = { ch: Cambio; cfg: Nodo[]; dv: number; puntaje: number };
      const pruebas: Prueba[] = [];
      const probar = (ch: Cambio) => {
        const cfg2 = aplicarCambio(e.cfg, ch, true);
        const dv = medirCambio(e, base, ch, cfg2).utilPct - e.med.utilPct;
        if (dv < 0.05) return;
        const dc = costo(cfg2) - e.costo;
        pruebas.push({ ch, cfg: cfg2, dv, puntaje: dc <= 0 ? 1e12 + dv : dv / dc });
      };
      for (const ch of candidatos(e, "cobertura", base)) probar(ch);
      // Los sitios de apoyo que más cubren se prueban también con otras torres
      const mejoresSitios = [...new Set(pruebas.filter((x) => x.ch.t === "apoyo").sort((x, y) => y.dv - x.dv).slice(0, 12).map((x) => (x.ch as { s: number }).s))];
      for (const s of mejoresSitios) for (const h of alturas.filter((x) => x !== 15)) probar({ t: "apoyo", s, h });
      pruebas.sort((x, y) => y.puntaje - x.puntaje);
      let elegido: Prueba | null = null;
      const sinEnlace: number[] = [];
      for (const pr of pruebas.slice(0, 40)) {
        if (analizar(pr.cfg).D <= e.an.D + 1e-9) {
          elegido = pr;
          break;
        }
        if (pr.ch.t === "apoyo" && sinEnlace.length < 5 && !sinEnlace.includes(pr.ch.s)) sinEnlace.push(pr.ch.s);
      }
      // Un buen sitio que no alcanza la red: se prueba con un relevo enlazado hacia él
      if (sinEnlace.length && permisos.apoyos && e.cfg.filter((n) => n.origen === "apoyo").length + 2 <= pedido.maxApoyos) {
        for (const s of sinEnlace) {
          const objetivo = apoyoPrueba(s, 15).a;
          const relevos = sitios
            .map((_, r) => r)
            .filter((r) => r !== s && distanciaM(sitios[r].lat, sitios[r].lon, objetivo.lat, objetivo.lon) < 15000)
            .sort((x, y) => distanciaM(sitios[x].lat, sitios[x].lon, objetivo.lat, objetivo.lon) - distanciaM(sitios[y].lat, sitios[y].lon, objetivo.lat, objetivo.lon))
            .slice(0, 25);
          for (const r of relevos) {
            if (margenEnlace(apoyoPrueba(r, 15).a, objetivo) < ENLACE_SOLIDO_DB) continue;
            const ch: Cambio = { t: "par", r, hr: 15, s, hs: 15 };
            const cfg2 = aplicarCambio(e.cfg, ch, true);
            const dv = medirCambio(e, base, ch, cfg2).utilPct - e.med.utilPct;
            if (dv < 0.05 || analizar(cfg2).D > e.an.D + 1e-9) continue;
            const puntaje = dv / (costo(cfg2) - e.costo);
            if (!elegido || puntaje > elegido.puntaje) elegido = { ch, cfg: cfg2, dv, puntaje };
            break;
          }
        }
      }
      if (!elegido) break;
      e = estadoDe(aplicarCambio(e.cfg, elegido.ch));
      registrar.push(e);
    }
    return e;
  };

  // ---------- 3) Poda: quitar lo que sobra sin bajar de la cobertura pedida ni dañar la red ----------
  /** Devuelve la secuencia de estados podados (el primero es el de partida). */
  const podar = (desde: Estado, utilMin: number, quitarExistentes: boolean): Estado[] => {
    const secuencia = [desde];
    let e = desde;
    for (let iter = 0; iter < 40; iter++) {
      basesSin.clear();
      const base = cobDe(e.cfg, G);
      let mejor: { cfg: Nodo[]; ahorro: number; util: number } | null = null;
      for (let i = 0; i < e.cfg.length; i++) {
        const n = e.cfg[i];
        if (!n.cubre) continue;
        const opciones: Cambio[] = [];
        if (permisos.alturas) {
          const menores = alturas.filter((h) => h < n.a.alturaM);
          if (menores.length) opciones.push({ t: "altura", i, h: menores[menores.length - 1] });
          if (menores.length > 1) opciones.push({ t: "altura", i, h: menores[menores.length - 2] });
        }
        if (!n.a.pasarela && (n.origen === "apoyo" || (quitarExistentes && !fijos.has(n.a.id)))) opciones.push({ t: "quitar", i });
        if (n.origen === "existente") {
          const o = originales.get(n.a.id);
          if (o && (o.lat !== n.a.lat || o.lon !== n.a.lon)) opciones.push({ t: "mover", i, lat: o.lat, lon: o.lon });
          if (o && (n.a.patron ?? "omni") !== (o.patron ?? "omni")) opciones.push({ t: "patron", i, patron: o.patron ?? "omni", az: o.azimutDeg ?? 0 });
        }
        for (const ch of opciones) {
          const cfg2 = aplicarCambio(e.cfg, ch, true);
          const ahorro = e.costo - costo(cfg2);
          if (ahorro <= 0 || (mejor && ahorro < mejor.ahorro)) continue;
          const m2 = medirCambio(e, base, ch, cfg2);
          if (m2.utilPct < utilMin - 1e-9) continue;
          if (analizar(cfg2).D > e.an.D) continue;
          if (!mejor || ahorro > mejor.ahorro || m2.utilPct > mejor.util) mejor = { cfg: cfg2, ahorro, util: m2.utilPct };
        }
      }
      if (!mejor) break;
      e = estadoDe(mejor.cfg);
      secuencia.push(e);
    }
    return secuencia;
  };

  // ---------- Opciones ----------
  type Elegida = { id: OpcionAjuste["id"]; secuencia: Estado[]; utilMin: number };
  const elegidas: Elegida[] = [];
  if (!sinGateway && area) {
    if (modo === "optimizar") {
      const misma = podar(inicial, Math.max(meta, inicial.med.utilPct - 0.5), permisos.quitar);
      const finMisma = misma[misma.length - 1];
      const minima = podar(finMisma, meta, permisos.quitar);
      const mas: Estado[] = [finMisma];
      crecer(finMisma, PASOS_COBERTURA, mas);
      const iRodilla = rodilla(mas, 0);
      elegidas.push({ id: "economica", secuencia: [...misma, ...minima.slice(1)], utilMin: meta });
      elegidas.push({ id: "recomendada", secuencia: misma, utilMin: Math.max(meta, inicial.med.utilPct - 0.5) });
      if (iRodilla > 0) {
        const tope = mas[iRodilla].med.utilPct - 0.3;
        elegidas.push({ id: "maxima", secuencia: podar(mas[iRodilla], tope, false), utilMin: tope });
      }
    } else {
      crecer(actual, PASOS_COBERTURA, camino);
      const iEcon = camino.findIndex((e) => e.an.D === 0 && e.med.utilPct >= meta);
      if (iEcon >= 0) {
        const iRec = iEcon + rodilla(camino.slice(iEcon), 0);
        const ultimo = camino.length - 1;
        const minRec = Math.max(meta, camino[iRec].med.utilPct - 0.3);
        const minMax = Math.max(meta, camino[ultimo].med.utilPct - 0.2);
        elegidas.push({ id: "economica", secuencia: podar(camino[iEcon], meta, false), utilMin: meta });
        elegidas.push({ id: "recomendada", secuencia: podar(camino[iRec], minRec, false), utilMin: minRec });
        elegidas.push({ id: "maxima", secuencia: podar(camino[ultimo], minMax, false), utilMin: minMax });
      } else {
        // No se alcanza la meta: desde la red mejor conectada que se logró, hasta donde la inversión rinde
        const dMin = Math.min(...camino.map((e) => e.an.D));
        const iBase = camino.findIndex((e) => e.an.D === dMin);
        // La recomendada es la más cercana a la meta; la económica, hasta donde la inversión rinde
        const iRodilla = iBase + rodilla(camino.slice(iBase), 0);
        const ultimo = camino.length - 1;
        const mejor = camino[ultimo];
        if (iRodilla > 0 && iRodilla < ultimo && camino[ultimo].med.utilPct > camino[iRodilla].med.utilPct + 1)
          elegidas.push({ id: "economica", secuencia: podar(camino[iRodilla], camino[iRodilla].med.utilPct - 0.3, false), utilMin: camino[iRodilla].med.utilPct - 0.3 });
        elegidas.push({ id: "recomendada", secuencia: podar(mejor, mejor.med.utilPct - 0.2, false), utilMin: mejor.med.utilPct - 0.2 });
        if (!motivo) {
          const falta = meta - camino[ultimo].med.utilPct;
          motivo =
            mejor.an.D > 0
              ? textoNoRepara(mejor)
              : `Con torres de hasta ${fm(alturaMax)} m${permisos.apoyos ? ` y ${pedido.maxApoyos} antenas de apoyo como máximo` : ""} la cobertura útil llega a ${fp(camino[ultimo].med.utilPct)} % y la meta es ${fp(meta)} % (${falta < 0.1 ? "falta menos de 0,1 punto" : `faltan ${fp(falta)} puntos`}): el relieve tapa esas zonas o quedan lejos de la red.`;
          if (pedido.sitios?.length) motivo += " Solo usé los sitios que me dio: si me deja buscar otros, puede mejorar.";
        }
      }
    }
  }

  // ---------- Verificación con las celdas del mapa ----------
  const finas = new Map<string, { F: Muestra; fuera: number }>();
  const verificar = (cfg: Nodo[]): Medida => {
    const cubren = cfg.filter((n) => n.cubre).map((n) => n.a);
    if (!cubren.length || !area) return { utilPct: 0, confiablePct: 0, servicioPct: 0 };
    const malla = crearMalla(cubren, p);
    const clave = `${malla.caja.oeste}|${malla.caja.norte}|${malla.ancho}|${malla.alto}`;
    let fina = finas.get(clave);
    if (!fina) {
      const c = celdasEnPoligono(malla, area.puntos, MUESTRAS_FINAS);
      // Parte de la zona fuera del mapa calculado: sin servicio (igual que el panel)
      let n = 0;
      for (let k = 0; k < G.lats.length; k++) if (G.lats[k] < malla.caja.sur || G.lats[k] > malla.caja.norte || G.lons[k] < malla.caja.oeste || G.lons[k] > malla.caja.este) n++;
      fina = { F: { lats: c.lats, lons: c.lons, pesos: c.areas, filas: new Map() }, fuera: G.lats.length ? n / G.lats.length : 0 };
      finas.set(clave, fina);
    }
    const med = medir(cobDe(cfg, fina.F), fina.F);
    const f = 1 - fina.fuera;
    return { utilPct: med.utilPct * f, confiablePct: med.confiablePct * f, servicioPct: med.servicioPct * f };
  };
  const resumir = (cfg: Nodo[], med: Medida, an: Analisis): ResumenRed => {
    const coberturaOk = med.utilPct >= meta - 1e-9;
    const infra = cfg.filter((n) => n.cubre);
    return {
      utilPct: med.utilPct,
      confiablePct: med.confiablePct,
      servicioPct: med.servicioPct,
      conectada: an.conectada,
      saltosOk: an.saltosOk,
      solidas: an.solidas,
      coberturaOk,
      factible: an.D === 0 && coberturaOk,
      nodosAntena: infra.length,
      apoyos: infra.filter((n) => n.origen === "apoyo").length,
      alturaMaxM: Math.max(0, ...infra.map((n) => n.a.alturaM)),
    };
  };

  const resumenInicial = resumir(inicial.cfg, verificar(inicial.cfg), inicial.an);
  const problemas = problemasDe(inicial, resumenInicial);

  const opciones: OpcionAjuste[] = [];
  const vistas = new Set<string>();
  for (const el0 of elegidas) {
    // Al optimizar, «la misma cobertura» se mide contra la red de hoy con las celdas del mapa (no con la muestra gruesa)
    const ahorra = modo === "optimizar" && el0.id !== "maxima";
    const el = ahorra ? { ...el0, utilMin: Math.min(el0.utilMin, Math.max(meta, resumenInicial.utilPct - 0.5)) } : el0;
    // La poda se hizo con la muestra gruesa: se confirma con las celdas del mapa y, si se pasó, se retrocede
    const sec = el.secuencia;
    let k = sec.length - 1;
    let med = verificar(sec[k].cfg);
    if (med.utilPct < el.utilMin - 1e-6 && k > 0) {
      let lo = 0;
      let hi = k - 1;
      let mejorK = -1;
      let mejorMed = med;
      const m0 = verificar(sec[0].cfg);
      if (m0.utilPct >= el.utilMin - 1e-6) {
        mejorK = 0;
        mejorMed = m0;
        lo = 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const mm = verificar(sec[mid].cfg);
          if (mm.utilPct >= el.utilMin - 1e-6) {
            mejorK = mid;
            mejorMed = mm;
            lo = mid + 1;
          } else hi = mid - 1;
        }
      }
      if (mejorK >= 0) {
        k = mejorK;
        med = mejorMed;
      } else {
        k = 0;
        med = m0;
      }
    }
    let cfg = sec[k].cfg;
    // Huecos pequeños que la muestra gruesa no vio: se tapan con el diseño por área (celda por celda)
    if (med.utilPct < el.utilMin - 1e-6 && area && permisos.apoyos && analizar(cfg).D === 0 && !ahorra) {
      const usados = cfg.filter((n) => n.origen === "apoyo").length;
      if (usados < pedido.maxApoyos) {
        // Apoyos como los repetidores de la red (Trama: tubo de 6 m), sin pasar la altura permitida
        const h = Math.min(Math.max(pedido.plantillaApoyo.alturaM, 6), alturaMax);
        const d = disenar(
          {
            area: area.puntos,
            margenObjetivoDb: margenDb,
            porcentajeObjetivo: el.utilMin,
            respaldo,
            existentes: cfg.filter((n) => n.cubre).map((n) => n.a),
            gateway: null,
            repetidor: { ...pedido.plantillaApoyo, alturaM: h },
            parametros: p,
            maxRepetidores: pedido.maxApoyos - usados,
          },
          relieve,
          cajaDiseno(
            area.puntos,
            cfg.map((n) => n.a),
          ),
        );
        const extra: Nodo[] = d.nodos
          .filter((q) => q.pieza === "repetidor")
          .map((q) => ({ a: { ...pedido.plantillaApoyo, id: `nuevo-apoyo-${++nApoyo}`, nombre: "Apoyo", lat: Number(q.lat.toFixed(6)), lon: Number(q.lon.toFixed(6)), alturaM: h, tipo: "antena", pasarela: false, activa: true }, origen: "apoyo", cubre: true }));
        if (extra.length) {
          cfg = [...cfg, ...extra];
          med = verificar(cfg);
        }
      }
    }
    const an = analizar(cfg);
    const resumen = resumir(cfg, med, an);
    const { cambios, antenas } = cambiosDe(cfg, an);
    if (!cambios.length && modo === "ajustar") continue;
    // Una opción para ahorrar que no ahorra no se ofrece
    if (ahorra && costo(cfg) >= inicial.costo - 1e-6) continue;
    const clave = JSON.stringify(cambios);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    opciones.push({ id: el.id, titulo: tituloOpcion(el.id, modo), porQue: "", cambios, antenas, resumen, costoRelativo: inicial.costo > 0 ? costo(cfg) / inicial.costo : 1 });
  }
  // Fuera las opciones dominadas: otra cuesta lo mismo o menos y cubre lo mismo o más (con la verificación fina
  // una opción «económica» puede terminar costando más que otra)
  for (let i = opciones.length - 1; i >= 0; i--) {
    const o = opciones[i];
    const dominada = opciones.some(
      (x) => x !== o && x.costoRelativo <= o.costoRelativo + 1e-9 && x.resumen.utilPct >= o.resumen.utilPct - 0.05 && (x.resumen.factible || !o.resumen.factible) && (x.costoRelativo < o.costoRelativo - 1e-9 || x.resumen.utilPct > o.resumen.utilPct + 0.05),
    );
    if (dominada) opciones.splice(i, 1);
  }
  if (opciones.length === 1 && (modo === "ajustar" || opciones[0].resumen.utilPct >= resumenInicial.utilPct - 0.6)) {
    opciones[0].id = "recomendada";
    opciones[0].titulo = tituloOpcion("recomendada", modo);
  }
  // La recomendada: la de mejor relación entre lo que cubre y lo que cuesta, entre las factibles
  let recomendada = Math.max(
    0,
    opciones.findIndex((o) => o.id === "recomendada"),
  );
  if (opciones[recomendada] && !opciones[recomendada].resumen.factible) {
    const f = opciones.findIndex((o) => o.resumen.factible);
    if (f >= 0) recomendada = f;
  }
  for (const o of opciones) o.porQue = porQueOpcion(o, opciones, modo, resumenInicial);

  const poligono = area?.puntos ?? [];
  const ajuste: Ajuste = {
    modo,
    area: { nombre: area?.nombre ?? "la zona de la red", tipo: tipoZona, poligono, areaKm2: poligono.length ? areaPoligonoM2(poligono) / 1e6 : 0 },
    metaPct: meta,
    margenDb,
    alturaMaxM: alturaMax,
    inicial: { ...resumenInicial, problemas },
    opciones,
    recomendada,
    analisis: [],
    motivo: opciones.some((o) => o.resumen.factible) ? null : (motivo ?? (sinGateway ? "No hay gateway." : null)),
  };
  ajuste.analisis = analisisAjuste(ajuste, p.radioKm);
  return ajuste;

  // ---------- Auxiliares ----------
  function textoNoRepara(e: Estado): string {
    const porId = new Map(e.an.nodos.map((x) => [x.id, x]));
    const sin = e.cfg.filter((n) => !n.a.pasarela && porId.get(n.a.id)?.saltos === null).map((n) => n.a.nombre);
    const lejos = e.cfg.filter((n) => (porId.get(n.a.id)?.saltos ?? 0) > limite).map((n) => n.a.nombre);
    const debiles = e.cfg.filter((n) => {
      const c = porId.get(n.a.id)?.cuelloDb;
      return !n.a.pasarela && c !== null && c !== undefined && c < ENLACE_SOLIDO_DB;
    });
    const partes: string[] = [];
    if (sin.length) partes.push(`${lista(sin)} no ${sin.length === 1 ? "logra" : "logran"} llegar al gateway`);
    if (lejos.length) partes.push(`${lista(lejos)} ${lejos.length === 1 ? "queda" : "quedan"} a más de ${limite} saltos`);
    if (debiles.length) partes.push(`${lista(debiles.map((n) => n.a.nombre))} ${debiles.length === 1 ? "sigue" : "siguen"} con enlace débil (menos de 30 dB)`);
    return `${partes.join("; ")} ni con torres de ${fm(alturaMax)} m${permisos.apoyos ? ` ni con ${pedido.sitios?.length ? "los sitios de apoyo que me dio" : `${pedido.maxApoyos} antenas de apoyo`}` : ""}${permisos.mover ? " ni moviendo nodos a lomas cercanas" : ""}. Revise si está demasiado lejos o detrás de una serranía, o suba el límite de saltos (hoy ${limite}).`;
  }

  function problemasDe(e: Estado, r: ResumenRed): string[] {
    const porId = new Map(e.an.nodos.map((x) => [x.id, x]));
    const salida: string[] = [];
    if (sinGateway) salida.push("no hay gateway (pasarela)");
    for (const n of e.cfg) {
      if (n.a.pasarela) continue;
      const nm = porId.get(n.a.id);
      if (!nm) continue;
      if (nm.saltos === null) salida.push(`${n.a.nombre} no llega al gateway`);
      else if (nm.saltos > limite) salida.push(`${n.a.nombre} está a ${nm.saltos} saltos (límite ${limite})`);
      else if (nm.cuelloDb !== null && nm.cuelloDb < ENLACE_SOLIDO_DB) salida.push(`${n.a.nombre} llega con un enlace de ${Math.round(nm.cuelloDb)} dB (se piden 30)`);
    }
    if (!r.coberturaOk) salida.push(`la cobertura útil es ${fp(r.utilPct)} % (meta ${fp(meta)} %)`);
    return salida;
  }

  /** Cambios frente a la red original y la red completa resultante (apoyos con nombres libres). */
  function cambiosDe(cfg: Nodo[], an: Analisis): { cambios: CambioAjuste[]; antenas: Antena[] } {
    const cambios: CambioAjuste[] = [];
    const porId = new Map(an.nodos.map((x) => [x.id, x]));
    const usados = new Set(pedido.antenas.map((a) => a.nombre));
    const renombre = new Map<string, { id: string; nombre: string }>();
    let k = 0;
    let n = 0;
    for (const x of cfg)
      if (x.origen === "apoyo") {
        do k++;
        while (usados.has(`Apoyo ${k}`));
        renombre.set(x.a.id, { id: `nuevo-apoyo-${++n}`, nombre: `Apoyo ${k}` });
      }
    const nombreDe = (id: string) => renombre.get(id)?.nombre ?? cfg.find((x) => x.a.id === id)?.a.nombre ?? id;
    for (const o of activas) {
      const x = cfg.find((y) => y.a.id === o.id);
      if (!x) {
        if (cubreCobertura(o)) cambios.push({ tipo: "quitar", id: o.id, nombre: o.nombre });
        continue;
      }
      const a = x.a;
      if (Math.abs(a.lat - o.lat) > 1e-7 || Math.abs(a.lon - o.lon) > 1e-7)
        cambios.push({ tipo: "mover", id: o.id, nombre: o.nombre, lat: a.lat, lon: a.lon, distanciaM: distanciaM(o.lat, o.lon, a.lat, a.lon), rumboDeg: rumbo(o.lat, o.lon, a.lat, a.lon), subeM: suelo(a.lat, a.lon) - suelo(o.lat, o.lon) });
      if (a.alturaM !== o.alturaM) cambios.push({ tipo: "altura", id: o.id, nombre: o.nombre, deM: o.alturaM, aM: a.alturaM });
      if ((a.patron ?? "omni") !== (o.patron ?? "omni") || ((a.patron ?? "omni") !== "omni" && (a.azimutDeg ?? 0) !== (o.azimutDeg ?? 0)))
        cambios.push({ tipo: "antena", id: o.id, nombre: o.nombre, patron: a.patron ?? "omni", azimutDeg: a.azimutDeg ?? 0 });
    }
    for (const x of cfg) {
      if (x.origen !== "apoyo") continue;
      const r = renombre.get(x.a.id)!;
      const nm = porId.get(x.a.id);
      const siguiente = nm && nm.ruta.length > 1 ? nm.ruta[1] : null;
      const otro = siguiente ? cfg.find((y) => y.a.id === siguiente)?.a : undefined;
      cambios.push({
        tipo: "apoyo",
        id: r.id,
        nombre: r.nombre,
        lat: x.a.lat,
        lon: x.a.lon,
        alturaM: x.a.alturaM,
        sueloM: Math.round(suelo(x.a.lat, x.a.lon)),
        sitio: x.sitio,
        enlazaCon: siguiente ? nombreDe(siguiente) : null,
        enlaceDb: otro ? margenEnlace(x.a, otro) : null,
      });
    }
    const antenas = cfg.map((x) => (renombre.has(x.a.id) ? { ...x.a, ...renombre.get(x.a.id)! } : x.a));
    return { cambios, antenas };
  }
}

/** Índice del punto de la curva hasta donde cada peso extra todavía rinde (la «rodilla»). */
function rodilla(camino: { med: Medida; costo: number }[], desde: number): number {
  if (camino.length <= desde + 1) return desde;
  const e = (i: number) => {
    const dv = camino[i].med.utilPct - camino[i - 1].med.utilPct;
    const dc = camino[i].costo - camino[i - 1].costo;
    return dc > 0 ? dv / dc : dv > 0 ? Infinity : 0;
  };
  // Eficiencia de referencia: la de los primeros pasos (cobertura útil por costo)
  let ref = 0;
  for (let i = desde + 1; i <= Math.min(camino.length - 1, desde + 2); i++) ref = Math.max(ref, Number.isFinite(e(i)) ? e(i) : 0);
  if (!(ref > 0)) return desde;
  let k = desde;
  for (let i = desde + 1; i < camino.length; i++) {
    if (e(i) >= 0.5 * ref) k = i;
    else break;
  }
  // Si lo que se gana desde la económica es muy poco, no vale la pena
  return camino[k].med.utilPct - camino[desde].med.utilPct < 1 ? desde : k;
}

function muestraArea(area: Poligono, n: number): Muestra {
  const m = muestrasEnPoligono(area, n);
  return { lats: m.lats, lons: m.lons, pesos: new Float64Array(m.lats.length).fill(1), filas: new Map() };
}

/**
 * Contorno de la unión de círculos (los de estudio de los nodos antena) como un polígono: se pinta la unión en una
 * cuadrícula, se recorre su borde y se ajusta para que mida lo mismo que la unión. Si los círculos forman grupos
 * separados, se usa la envolvente convexa de todos.
 */
export function contornoCirculos(centros: { lat: number; lon: number }[], radioM: number): Poligono {
  const lat0 = centros.reduce((s, c) => s + c.lat, 0) / centros.length;
  const g = metrosPorGrado(lat0);
  // Coordenadas locales en metros
  const xs = centros.map((c) => (c.lon - centros[0].lon) * g.lon);
  const ys = centros.map((c) => (c.lat - centros[0].lat) * g.lat);
  const minX = Math.min(...xs) - radioM;
  const maxX = Math.max(...xs) + radioM;
  const minY = Math.min(...ys) - radioM;
  const maxY = Math.max(...ys) + radioM;
  const s = Math.max(maxX - minX, maxY - minY) / 180;
  const nx = Math.ceil((maxX - minX) / s) + 2;
  const ny = Math.ceil((maxY - minY) / s) + 2;
  const xDe = (i: number) => minX + (i - 0.5) * s;
  const yDe = (j: number) => maxY - (j - 0.5) * s;
  const mascara = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = xDe(i);
      const y = yDe(j);
      for (let c = 0; c < xs.length; c++)
        if ((x - xs[c]) ** 2 + (y - ys[c]) ** 2 <= radioM * radioM) {
          mascara[j * nx + i] = 1;
          break;
        }
    }
  // Componentes (4 vecinos)
  const etiqueta = new Int32Array(nx * ny).fill(-1);
  let nComp = 0;
  let mayor = -1;
  let tamMayor = 0;
  for (let q = 0; q < nx * ny; q++) {
    if (!mascara[q] || etiqueta[q] >= 0) continue;
    const pila = [q];
    etiqueta[q] = nComp;
    let tam = 0;
    while (pila.length) {
      const v = pila.pop()!;
      tam++;
      const i = v % nx;
      const j = (v - i) / nx;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const w = jj * nx + ii;
        if (mascara[w] && etiqueta[w] < 0) {
          etiqueta[w] = nComp;
          pila.push(w);
        }
      }
    }
    if (tam > tamMayor) {
      tamMayor = tam;
      mayor = nComp;
    }
    nComp++;
  }
  const aLonLat = (x: number, y: number): [number, number] => [centros[0].lon + x / g.lon, centros[0].lat + y / g.lat];
  const areaUnion = (() => {
    let n = 0;
    for (let q = 0; q < nx * ny; q++) if (mascara[q]) n++;
    return n * s * s;
  })();
  if (nComp !== 1) {
    // Grupos separados: envolvente convexa de todos los círculos
    const puntos: [number, number][] = [];
    for (let c = 0; c < xs.length; c++) for (let k = 0; k < 36; k++) puntos.push([xs[c] + radioM * Math.sin((k * Math.PI) / 18), ys[c] + radioM * Math.cos((k * Math.PI) / 18)]);
    return envolvente(puntos).map(([x, y]) => aLonLat(x, y));
  }
  // Recorrido del borde (vecindad de Moore, sentido horario en pantalla: E, SE, S, SO, O, NO, N, NE)
  const DX = [1, 1, 0, -1, -1, -1, 0, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];
  const dentro = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && etiqueta[j * nx + i] === mayor;
  let inicio = -1;
  for (let q = 0; q < nx * ny && inicio < 0; q++) if (etiqueta[q] === mayor) inicio = q;
  const si = inicio % nx;
  const sj = (inicio - si) / nx;
  const borde: [number, number][] = [[si, sj]];
  let ci = si;
  let cj = sj;
  let dir = 4; // se llegó desde el oeste (fondo)
  for (let paso = 0; paso < nx * ny * 4; paso++) {
    let movido = false;
    for (let k = 1; k <= 8; k++) {
      const d = (dir + k) % 8;
      const ii = ci + DX[d];
      const jj = cj + DY[d];
      if (dentro(ii, jj)) {
        ci = ii;
        cj = jj;
        dir = d % 2 === 0 ? (d + 6) % 8 : (d + 5) % 8;
        movido = true;
        break;
      }
    }
    if (!movido || (ci === si && cj === sj)) break;
    borde.push([ci, cj]);
  }
  const simple = douglasPeucker(
    borde.map(([i, j]) => [xDe(i), yDe(j)] as [number, number]),
    s * 0.9,
  );
  if (simple.length < 3) return poligonoCirculo(centros[0].lat, centros[0].lon, radioM);
  return conArea(
    simple.map(([x, y]) => aLonLat(x, y)),
    areaUnion,
  );
}

function envolvente(puntos: [number, number][]): [number, number][] {
  const p = [...puntos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const abajo: [number, number][] = [];
  for (const q of p) {
    while (abajo.length >= 2 && cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], q) <= 0) abajo.pop();
    abajo.push(q);
  }
  const arriba: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (arriba.length >= 2 && cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], q) <= 0) arriba.pop();
    arriba.push(q);
  }
  return [...abajo.slice(0, -1), ...arriba.slice(0, -1)];
}

function douglasPeucker(puntos: [number, number][], tol: number): [number, number][] {
  if (puntos.length < 4) return puntos;
  const marca = new Uint8Array(puntos.length);
  marca[0] = 1;
  marca[puntos.length - 1] = 1;
  const pila: [number, number][] = [[0, puntos.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop()!;
    let maxD = 0;
    let idx = -1;
    const [x1, y1] = puntos[a];
    const [x2, y2] = puntos[b];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((x2 - x1) * (y1 - puntos[i][1]) - (x1 - puntos[i][0]) * (y2 - y1)) / L;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tol) {
      marca[idx] = 1;
      pila.push([a, idx], [idx, b]);
    }
  }
  return puntos.filter((_, i) => marca[i]);
}

// ---------- Textos (sin precios) ----------
const fp = (v: number) => (v >= 99.95 && v < 100 ? "99,9" : String(Math.floor(v * 10) / 10).replace(".", ","));
const lista = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const PUNTOS = ["norte", "nororiente", "oriente", "suroriente", "sur", "suroccidente", "occidente", "noroccidente"];
const haciaDonde = (g: number) => `al ${PUNTOS[Math.round((((g % 360) + 360) % 360) / 45) % 8]}`;
const fc = (v: number) => v.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
const fm = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ","));

export function nombrePatron(id: PatronId): string {
  return { omni: "omnidireccional", yagi: "Yagi", panel: "panel", "sectorial-90": "sectorial de 90°", "sectorial-120": "sectorial de 120°", parabolica: "parabólica" }[id];
}

/** Un cambio en palabras («Subir Gateway de 8 a 15 m»). */
export function textoCambio(c: CambioAjuste): string {
  switch (c.tipo) {
    case "altura":
      return `${c.aM > c.deM ? "Subir" : "Bajar"} ${c.nombre} de ${fm(c.deM)} a ${fm(c.aM)} m`;
    case "mover":
      return `Correr ${c.nombre} ${Math.round(c.distanciaM / 10) * 10} m ${haciaDonde(c.rumboDeg)}, a una loma ${Math.max(1, Math.round(c.subeM))} m más alta (${fc(c.lat)}, ${fc(c.lon)})`;
    case "antena":
      return c.patron === "omni" ? `Volver ${c.nombre} a antena omnidireccional` : `Poner en ${c.nombre} una antena ${nombrePatron(c.patron)} apuntando a ${Math.round(c.azimutDeg)}° (${haciaDonde(c.azimutDeg).replace("al ", "")})`;
    case "apoyo":
      return `Antena de apoyo «${c.nombre}»${c.sitio ? ` en ${c.sitio}` : ""} en ${fc(c.lat)}, ${fc(c.lon)}, torre de ${fm(c.alturaM)} m${c.enlazaCon && c.enlaceDb !== null ? ` (enlaza con ${c.enlazaCon} a ${Math.round(c.enlaceDb)} dB)` : ""}`;
    case "quitar":
      return `Quitar ${c.nombre} (no hace falta)`;
  }
}

function tituloOpcion(id: OpcionAjuste["id"], modo: Ajuste["modo"]): string {
  if (modo === "optimizar") return { economica: "Mínima factible", recomendada: "Misma cobertura, menos costo", maxima: "Más cobertura" }[id];
  return { economica: "Económica", recomendada: "Recomendada", maxima: "Máxima cobertura" }[id];
}

function porQueOpcion(o: OpcionAjuste, todas: OpcionAjuste[], modo: Ajuste["modo"], inicial: ResumenRed): string {
  const r = o.resumen;
  if (!o.cambios.length) return modo === "optimizar" ? "La red ya está bien dimensionada: no encontré cómo ahorrar sin perder cobertura." : "No encontré cambios que mejoren la red.";
  if (modo === "optimizar") {
    if (o.id === "recomendada") return `La misma cobertura útil (${fp(r.utilPct)} %) con menos infraestructura.`;
    if (o.id === "economica") return `Lo mínimo que sigue siendo factible: cobertura útil de ${fp(r.utilPct)} %.`;
    return `Gana cobertura (${fp(r.utilPct)} %) hasta donde cada antena extra todavía rinde.`;
  }
  if (!r.factible) return `Lo mejor que se logra: cobertura útil de ${fp(r.utilPct)} %${r.conectada ? "" : ", pero algún nodo sigue sin llegar al gateway"}.`;
  if (o.id === "economica") return `Lo mínimo para dejarla factible: cobertura útil de ${fp(r.utilPct)} % (antes ${fp(inicial.utilPct)} %).`;
  if (o.id === "recomendada") {
    const max = todas.find((x) => x.id === "maxima");
    return `La mejor relación cobertura–costo: ${fp(r.utilPct)} % útil.${max && max.resumen.utilPct > r.utilPct + 0.5 ? " Más allá, cada antena extra aporta poco." : ""}`;
  }
  return `La mayor cobertura útil que se logra con torres de hasta 30 m: ${fp(r.utilPct)} %.`;
}

/** Resumen corto de lo que pide una opción («subir Gateway a 15 m y una antena de apoyo»). */
export function resumenCambios(o: Pick<OpcionAjuste, "cambios">): string {
  const partes: string[] = [];
  const apoyos = o.cambios.filter((c) => c.tipo === "apoyo").length;
  const alturas = o.cambios.filter((c): c is Extract<CambioAjuste, { tipo: "altura" }> => c.tipo === "altura");
  const mov = o.cambios.filter((c) => c.tipo === "mover").length;
  const ant = o.cambios.filter((c) => c.tipo === "antena").length;
  const quitar = o.cambios.filter((c) => c.tipo === "quitar").length;
  if (alturas.length) {
    const suben = alturas.filter((c) => c.aM > c.deM);
    const bajan = alturas.filter((c) => c.aM < c.deM);
    if (suben.length === 1) partes.push(`subir ${suben[0].nombre} a ${fm(suben[0].aM)} m`);
    else if (suben.length) partes.push(`subir ${suben.length} torres`);
    if (bajan.length === 1) partes.push(`bajar ${bajan[0].nombre} a ${fm(bajan[0].aM)} m`);
    else if (bajan.length) partes.push(`bajar ${bajan.length} torres`);
  }
  if (mov) partes.push(mov === 1 ? "correr un nodo a una loma cercana" : `correr ${mov} nodos a lomas cercanas`);
  if (ant) partes.push(ant === 1 ? "cambiar una antena" : `cambiar ${ant} antenas`);
  if (apoyos) partes.push(apoyos === 1 ? "una antena de apoyo" : `${apoyos} antenas de apoyo`);
  if (quitar) partes.push(quitar === 1 ? "quitar un nodo que sobra" : `quitar ${quitar} nodos que sobran`);
  return lista(partes);
}

/** Frases del análisis para el panel y para Melki (sin precios). */
export function analisisAjuste(a: Ajuste, radioKm?: number): string[] {
  const salida: string[] = [];
  const i = a.inicial;
  const zona = a.area.tipo === "objetivo" ? `«${a.area.nombre}»` : "la zona de la red";
  const senal = a.margenDb >= 45 ? "buena" : a.margenDb >= 37 ? "estable o mejor" : "media o mejor";
  const meta = `${fp(a.metaPct)} % de ${zona} con señal ${senal} (≥ ${a.margenDb} dB)`;
  if (a.area.tipo === "zona") salida.push(`Como no hay un área pedida, evalué la zona de la red: los círculos de ${radioKm ? `${fm(radioKm)} km` : "estudio"} alrededor de sus nodos antena (${fm(Math.round(a.area.areaKm2))} km²). Al aplicar el ajuste la dejo como área objetivo, para que la factibilidad se mida siempre en la misma zona.`);
  if (i.factible) salida.push(`Hoy ya es factible: cobertura útil de ${fp(i.utilPct)} % (meta ${meta}).`);
  else salida.push(`Hoy no es factible: ${lista(i.problemas)}. La meta es ${meta}, con todos los nodos llegando al gateway por enlaces de 30 dB o más.`);
  const rec = a.opciones[a.recomendada];
  const eco = a.opciones.find((o) => o.id === "economica");
  const max = a.opciones.find((o) => o.id === "maxima");
  if (a.modo === "optimizar") {
    if (rec && rec.cambios.length && rec.costoRelativo < 1) salida.push(`Para la misma cobertura basta con ${resumenCambios(rec)}: ${Math.round((1 - rec.costoRelativo) * 100)} % menos de inversión en infraestructura.`);
    else salida.push("No encontré cómo ahorrar sin perder cobertura: la red ya está bien dimensionada.");
    if (eco && eco !== rec && eco.cambios.length) salida.push(`Si basta con la meta (${fp(a.metaPct)} %), lo mínimo es ${resumenCambios(eco)} (${fp(eco.resumen.utilPct)} % útil).`);
    if (max && rec && max.resumen.utilPct > rec.resumen.utilPct + 0.5) salida.push(`Si quiere más cobertura, ${resumenCambios(max)} la lleva a ${fp(max.resumen.utilPct)} % sin que la inversión deje de rendir.`);
  } else {
    if (eco && eco.resumen.factible) salida.push(`Lo mínimo para dejarla factible: ${resumenCambios(eco)} → ${fp(eco.resumen.utilPct)} % útil.`);
    if (rec && rec !== eco && rec.resumen.factible) salida.push(`Recomiendo ${resumenCambios(rec)} → ${fp(rec.resumen.utilPct)} % útil: es hasta donde cada peso invertido todavía rinde.`);
    if (max && rec && max !== rec && max.resumen.utilPct > rec.resumen.utilPct + 0.5) {
      const extra = max.resumen.nodosAntena - rec.resumen.nodosAntena;
      salida.push(
        `La de máxima cobertura llega a ${fp(max.resumen.utilPct)} % (+${fp(max.resumen.utilPct - rec.resumen.utilPct)} puntos)${extra > 0 ? ` con ${extra === 1 ? "una antena más" : `${extra} antenas más`}` : ""}: ${max.costoRelativo > rec.costoRelativo * 1.4 ? "cuesta bastante más por lo que agrega" : "agrega poco por lo que cuesta"}, salvo que esa zona sea crítica.`,
      );
    }
  }
  salida.push(`Ninguna torre pasa de ${fm(a.alturaMaxM)} m: más alto exige torres autosoportadas, mucho más costosas.`);
  if (a.motivo) salida.push(a.motivo);
  return salida;
}

