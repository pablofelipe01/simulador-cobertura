// Estado de la aplicación: escenario (nodos + parámetros + mediciones), vista del mapa y preferencias.
import { EQUIPOS, LIMITE_SALTOS_DEFECTO, LIMITE_SALTOS_MAXIMO, PRESETS, type EquipoId } from "@/lib/radio/constantes";
import { ENTORNOS } from "@/lib/radio/entorno";
import type { Pieza } from "@/lib/radio/estado-red";
import type { ClimaItm } from "@/lib/radio/itm";
import { UNIDADES, type UnidadId } from "@/lib/radio/unidades";
import { PATRONES } from "@/lib/radio/patron";
import { RED_REFERENCIA, SUELOS, VARIABILIDADES } from "@/lib/radio/red";
import type { Antena, Escenario, Medicion, ObjetivoArea, Parametros, PatronId, Rol, SueloId, TipoMedicion, TipoNodo } from "@/lib/radio/tipos";

export type ModoMapa = "senal" | "servidor" | "redundancia";
/** Escala de colores del mapa de señal: clases fijas, arcoíris entre dos niveles o un solo umbral. */
export type EscalaSenal = "clases" | "arcoiris" | "umbral";
/** «destino»: el próximo clic en el mapa elige el punto hacia el que se siembra la malla. */
export type Herramienta = "mover" | "agregar" | "inspeccionar" | "regla" | "destino";
/** Modo de la pantalla: «Sembrar la malla» (sencillo, por piezas) o el modo avanzado con todos los paneles. */
export type ModoApp = "sembrar" | "avanzado";
export type FondoMapa = "satelite" | "topografico" | "opentopomap" | "calles";
export type TipoRelieve = "teselas" | "hgt" | "plano";

export type Vista = {
  fondo: FondoMapa;
  relieve3d: boolean;
  opacidad: number;
  modo: ModoMapa;
  mostrarSinServicio: boolean;
  mostrarEnlaces: boolean;
  mostrarSinEnlace: boolean;
  mostrarCirculos: boolean;
  /** Contorno del rango de alcance de cada nodo antena. */
  mostrarAlcance: boolean;
  /** Anillos de distancia alrededor del nodo seleccionado. */
  mostrarAnillos: boolean;
  /** Pintar solo la cobertura del nodo seleccionado. */
  soloSeleccionada: boolean;
  /** Capas de referencia. */
  refDivision: boolean;
  refRios: boolean;
  refPaises: boolean;
  refNombres: boolean;
  refVias: boolean;
  /** Unidad de la señal (leyenda, inspector) y escala de colores del modo «Señal». Niveles en dBm. */
  unidad: UnidadId;
  escala: EscalaSenal;
  escalaMinDbm: number;
  escalaMaxDbm: number;
  umbralDbm: number;
  colorUmbral: string;
  /** Dirección de las antenas direccionales sobre el mapa. */
  mostrarHaces: boolean;
  /** Modo «Sembrar la malla»: animar el flujo de la información hacia el gateway (pulsos, destellos y ondas). */
  animarRed: boolean;
};

export type Estado = {
  escenario: Escenario;
  seleccion: string | null;
  vista: Vista;
  herramienta: Herramienta;
  /** Tipo de nodo que se agrega con la herramienta Agregar. */
  tipoNuevo: TipoNodo;
  /** Tipo de medición de la regla y medición seleccionada. */
  reglaTipo: TipoMedicion;
  medicionSel: string | null;
  relieve: TipoRelieve;
  autoSimular: boolean;
  modo: ModoApp;
  /** Pieza que se pone con un clic en el modo «Sembrar la malla». */
  pieza: Pieza;
};

export const PARAMETROS_DEFECTO: Parametros = {
  preset: "SF11_250",
  // Primera de las cuatro frecuencias de un sitio Trama (920 / 921,5 / 924 / 925,5 MHz)
  frecuenciaMhz: 920,
  // La persona lleva su nodo (billetera) a la altura de la mano
  alturaRxM: 1.5,
  gananciaRxDbi: 2,
  perdidaExtraDb: 0,
  radioKm: 10,
  resolucion: "normal",
  limiteSaltos: LIMITE_SALTOS_DEFECTO,
  modelo: "calibrado",
  ...RED_REFERENCIA,
  entorno: "abierto",
};

export const VISTA_DEFECTO: Vista = {
  fondo: "satelite",
  relieve3d: false,
  opacidad: 0.65,
  modo: "senal",
  mostrarSinServicio: true,
  mostrarEnlaces: true,
  mostrarSinEnlace: false,
  mostrarCirculos: false,
  mostrarAlcance: true,
  mostrarAnillos: true,
  soloSeleccionada: false,
  refDivision: true,
  refRios: true,
  refPaises: true,
  refNombres: true,
  refVias: false,
  unidad: "margen",
  escala: "clases",
  escalaMinDbm: -121,
  escalaMaxDbm: -71,
  umbralDbm: -111,
  colorUmbral: "#1E7B34",
  mostrarHaces: true,
  animarRed: true,
};

export const NOMBRE_TIPO: Record<TipoNodo, string> = { antena: "Nodo antena", nodo: "Nodo" };

export function nuevoId(prefijo = "a"): string {
  return `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Valores por defecto según el tipo: el nodo antena va en mástil; el nodo de campo, en mano o en un poste bajo. */
export function nuevaAntena(lat: number, lon: number, existentes: Antena[], datos: Partial<Antena> = {}): Antena {
  const tipo: TipoNodo = datos.tipo ?? "antena";
  // Nodo antena = repetidor solar P1 con antena de 8 dBi; nodo de campo = billetera XIAO
  const equipo = tipo === "antena" ? EQUIPOS[0] : EQUIPOS[2];
  const base = tipo === "antena" ? "Antena" : "Nodo";
  let n = existentes.filter((a) => (a.tipo ?? "antena") === tipo).length + 1;
  while (existentes.some((a) => a.nombre === `${base} ${n}`)) n++;
  const rol: Rol = tipo === "antena" ? "REPETIDOR" : "COMPANION";
  return {
    id: nuevoId(),
    nombre: `${base} ${n}`,
    tipo,
    lat,
    lon,
    alturaM: tipo === "antena" ? 10 : 1.5,
    potenciaDbm: equipo.potenciaDbm,
    gananciaDbi: equipo.gananciaDbi,
    perdidaCableDb: equipo.perdidaCableDb,
    equipo: equipo.id,
    rol,
    pasarela: tipo === "antena" && !existentes.some((a) => a.pasarela),
    activa: true,
    ...datos,
  };
}

export function escenarioVacio(): Escenario {
  return { version: 1, nombre: "Escenario sin título", antenas: [], parametros: { ...PARAMETROS_DEFECTO }, mediciones: [] };
}

/** Escenario de demostración: un solo nodo antena llamado «Ejemplo» en un punto genérico de la llanura. */
export function escenarioEjemplo(): Escenario {
  const ejemplo = nuevaAntena(4.2, -73.37, [], { nombre: "Ejemplo", alturaM: 15, pasarela: true });
  return { version: 1, nombre: "Demostración: nodo antena Ejemplo", antenas: [ejemplo], parametros: { ...PARAMETROS_DEFECTO }, mediciones: [] };
}

export type Accion =
  | { tipo: "cargar"; escenario: Escenario }
  | { tipo: "renombrar-escenario"; nombre: string }
  | { tipo: "agregar"; lat: number; lon: number; datos?: Partial<Antena> }
  | { tipo: "insertar"; antena: Antena }
  | { tipo: "editar"; id: string; cambios: Partial<Antena> }
  | { tipo: "equipo"; id: string; equipo: EquipoId }
  | { tipo: "eliminar"; id: string }
  | { tipo: "duplicar"; id: string }
  | { tipo: "seleccionar"; id: string | null }
  | { tipo: "parametros"; cambios: Partial<Parametros> }
  | { tipo: "vista"; cambios: Partial<Vista> }
  | { tipo: "herramienta"; herramienta: Herramienta }
  | { tipo: "tipo-nuevo"; valor: TipoNodo }
  | { tipo: "regla-tipo"; valor: TipoMedicion }
  | { tipo: "medicion-agregar"; medicion: Medicion }
  | { tipo: "medicion-editar"; id: string; cambios: Partial<Medicion> }
  | { tipo: "medicion-eliminar"; id: string }
  | { tipo: "medicion-seleccionar"; id: string | null }
  | { tipo: "mediciones-borrar" }
  | { tipo: "relieve"; relieve: TipoRelieve }
  | { tipo: "auto"; valor: boolean }
  | { tipo: "modo"; modo: ModoApp }
  /** Elige la pieza y arma la herramienta para ponerla con un clic en el mapa. */
  | { tipo: "pieza"; pieza: Pieza }
  /** Agrega varios nodos de una vez (repetidores propuestos por el sembrado automático). */
  | { tipo: "insertar-varias"; antenas: Antena[] }
  /** Quita varios nodos de una vez (deshacer un sembrado). */
  | { tipo: "eliminar-varias"; ids: string[] }
  /** Reemplaza los nodos de una vez (el ajuste automático), sin tocar lo demás. */
  | { tipo: "antenas"; antenas: Antena[] }
  /** Marca un área de la regla como área objetivo (o la quita con id null): solo puede haber una. */
  | { tipo: "area-objetivo"; id: string | null; objetivo?: ObjetivoArea }
  /** Reemplaza el escenario, la vista y las preferencias de cálculo (escenario de práctica de los tours y su restauración). */
  | { tipo: "restaurar"; escenario: Escenario; vista: Vista; relieve?: TipoRelieve; autoSimular: boolean };

const conAntenas = (e: Estado, antenas: Antena[]): Estado => ({ ...e, escenario: { ...e.escenario, antenas } });
const conMediciones = (e: Estado, mediciones: Medicion[]): Estado => ({ ...e, escenario: { ...e.escenario, mediciones } });

export function reductor(e: Estado, a: Accion): Estado {
  const antenas = e.escenario.antenas;
  const mediciones = e.escenario.mediciones;
  switch (a.tipo) {
    case "cargar":
      return { ...e, escenario: { ...a.escenario, mediciones: a.escenario.mediciones ?? [] }, seleccion: null, medicionSel: null };
    case "antenas":
      return { ...conAntenas(e, a.antenas), seleccion: a.antenas.some((x) => x.id === e.seleccion) ? e.seleccion : null };
    case "area-objetivo":
      return conMediciones(
        e,
        mediciones.map((m) => (m.id === a.id && m.tipo === "area" && a.objetivo ? { ...m, objetivo: a.objetivo } : m.objetivo ? { ...m, objetivo: undefined } : m)),
      );
    case "renombrar-escenario":
      return { ...e, escenario: { ...e.escenario, nombre: a.nombre } };
    case "agregar": {
      const nueva = nuevaAntena(a.lat, a.lon, antenas, { tipo: e.tipoNuevo, ...a.datos });
      return { ...conAntenas(e, [...antenas, nueva]), seleccion: nueva.id, herramienta: "mover" };
    }
    case "insertar":
      return { ...conAntenas(e, [...antenas, a.antena]), seleccion: a.antena.id };
    case "insertar-varias":
      return { ...conAntenas(e, [...antenas, ...a.antenas]), seleccion: null };
    case "eliminar-varias": {
      const quitar = new Set(a.ids);
      const resto = antenas.filter((x) => !quitar.has(x.id));
      return { ...conAntenas(e, resto), seleccion: e.seleccion && quitar.has(e.seleccion) ? null : e.seleccion };
    }
    case "editar":
      return conAntenas(
        e,
        antenas.map((x) => (x.id === a.id ? { ...x, ...a.cambios } : x)),
      );
    case "equipo": {
      const eq = EQUIPOS.find((q) => q.id === a.equipo);
      if (!eq) return e;
      const cambios = eq.id === "personalizado" ? { equipo: eq.id } : { equipo: eq.id, potenciaDbm: eq.potenciaDbm, gananciaDbi: eq.gananciaDbi, perdidaCableDb: eq.perdidaCableDb };
      return conAntenas(
        e,
        antenas.map((x) => (x.id === a.id ? { ...x, ...cambios } : x)),
      );
    }
    case "eliminar": {
      const resto = antenas.filter((x) => x.id !== a.id);
      // Si se elimina la única pasarela, el primer nodo antena restante pasa a serlo
      if (resto.length && !resto.some((x) => x.pasarela)) {
        const i = Math.max(0, resto.findIndex((x) => (x.tipo ?? "antena") === "antena"));
        resto[i] = { ...resto[i], pasarela: true };
      }
      return { ...conAntenas(e, resto), seleccion: e.seleccion === a.id ? null : e.seleccion };
    }
    case "duplicar": {
      const o = antenas.find((x) => x.id === a.id);
      if (!o) return e;
      const copia = { ...o, id: nuevoId(), nombre: `${o.nombre} (copia)`, lat: o.lat + 0.004, lon: o.lon + 0.004, pasarela: false };
      return { ...conAntenas(e, [...antenas, copia]), seleccion: copia.id };
    }
    case "seleccionar":
      return { ...e, seleccion: a.id };
    case "parametros":
      return { ...e, escenario: { ...e.escenario, parametros: { ...e.escenario.parametros, ...a.cambios } } };
    case "vista":
      return { ...e, vista: { ...e.vista, ...a.cambios } };
    case "herramienta":
      return { ...e, herramienta: a.herramienta };
    case "tipo-nuevo":
      return { ...e, tipoNuevo: a.valor };
    case "regla-tipo":
      return { ...e, reglaTipo: a.valor };
    case "medicion-agregar":
      return { ...conMediciones(e, [...mediciones, a.medicion]), medicionSel: a.medicion.id };
    case "medicion-editar":
      return conMediciones(
        e,
        mediciones.map((m) => (m.id === a.id ? { ...m, ...a.cambios } : m)),
      );
    case "medicion-eliminar":
      return { ...conMediciones(e, mediciones.filter((m) => m.id !== a.id)), medicionSel: e.medicionSel === a.id ? null : e.medicionSel };
    case "medicion-seleccionar":
      return { ...e, medicionSel: a.id };
    case "mediciones-borrar":
      return { ...conMediciones(e, []), medicionSel: null };
    case "relieve":
      return { ...e, relieve: a.relieve };
    case "auto":
      return { ...e, autoSimular: a.valor };
    case "modo":
      return { ...e, modo: a.modo, herramienta: e.herramienta === "destino" || e.herramienta === "agregar" ? "mover" : e.herramienta };
    case "pieza":
      return { ...e, pieza: a.pieza, herramienta: "agregar", tipoNuevo: a.pieza === "persona" ? "nodo" : "antena" };
    case "restaurar":
      return {
        ...e,
        escenario: { ...a.escenario, mediciones: a.escenario.mediciones ?? [] },
        vista: a.vista,
        relieve: a.relieve ?? e.relieve,
        autoSimular: a.autoSimular,
        seleccion: null,
        medicionSel: null,
        herramienta: "mover",
      };
  }
}

/* ───────────── Guardado local (solo en este navegador) ───────────── */

export const CLAVE_ALMACEN = "simulador-cobertura-v1";

export type Guardado = { escenario: Escenario; vista: Vista; relieve: TipoRelieve; autoSimular: boolean };

/** Copia del escenario del usuario mientras hace un tour en el escenario de práctica. Si la página se cierra
 *  a mitad del tour, al volver a abrirla se recupera esta copia en lugar de la práctica. */
export const CLAVE_RESPALDO = "simulador-cobertura-respaldo-tour";

export function guardarRespaldo(g: Guardado) {
  try {
    window.localStorage.setItem(CLAVE_RESPALDO, JSON.stringify(g));
  } catch {
    // Sin almacenamiento: la copia queda solo en memoria.
  }
}

export function quitarRespaldo() {
  try {
    window.localStorage.removeItem(CLAVE_RESPALDO);
  } catch {
    // Nada que quitar.
  }
}

export function estadoInicial(): Estado {
  return {
    escenario: escenarioEjemplo(),
    seleccion: null,
    vista: { ...VISTA_DEFECTO },
    herramienta: "mover",
    tipoNuevo: "antena",
    reglaTipo: "trayecto",
    medicionSel: null,
    relieve: "teselas",
    autoSimular: true,
    modo: leerModo(),
    pieza: "repetidor",
  };
}

/* ───────────── Modo de la pantalla (preferencia aparte del escenario) ───────────── */

export const CLAVE_MODO = "simulador-cobertura-modo";

/** Al abrir, el modo «Sembrar la malla» salvo que el usuario haya elegido el avanzado. */
export function leerModo(): ModoApp {
  try {
    return window.localStorage.getItem(CLAVE_MODO) === "avanzado" ? "avanzado" : "sembrar";
  } catch {
    return "sembrar";
  }
}

export function guardarModo(m: ModoApp) {
  try {
    window.localStorage.setItem(CLAVE_MODO, m);
  } catch {
    // Sin almacenamiento: el modo vale solo para esta visita.
  }
}

/** Lee lo guardado; null si no hay nada o el navegador no permite almacenamiento. */
export function leerGuardado(): Partial<Estado> | null {
  try {
    // Un tour quedó a medias: se recupera el escenario del usuario
    const respaldo = window.localStorage.getItem(CLAVE_RESPALDO);
    if (respaldo) {
      window.localStorage.setItem(CLAVE_ALMACEN, respaldo);
      window.localStorage.removeItem(CLAVE_RESPALDO);
    }
    const t = window.localStorage.getItem(CLAVE_ALMACEN);
    if (!t) return null;
    const g = JSON.parse(t) as Partial<Guardado>;
    const escenario = validarEscenario(g.escenario);
    if (!escenario) return null;
    const vista: Vista = { ...VISTA_DEFECTO, ...(g.vista ?? {}) };
    const fondo: string = vista.fondo;
    // Versiones anteriores: «satélite con nombres» pasa a satélite + capa de nombres
    if (fondo === "satelite-nombres" || fondo === "hibrido") vista.refNombres = true;
    if (!["satelite", "topografico", "opentopomap", "calles"].includes(fondo)) vista.fondo = "satelite";
    if (!UNIDADES.some((u) => u.id === vista.unidad)) vista.unidad = "margen";
    if (!["clases", "arcoiris", "umbral"].includes(vista.escala)) vista.escala = "clases";
    for (const k of ["escalaMinDbm", "escalaMaxDbm", "umbralDbm"] as const) if (!Number.isFinite(vista[k])) vista[k] = VISTA_DEFECTO[k];
    if (vista.escalaMaxDbm <= vista.escalaMinDbm) vista.escalaMaxDbm = vista.escalaMinDbm + 10;
    if (!/^#[0-9a-f]{6}$/i.test(vista.colorUmbral)) vista.colorUmbral = VISTA_DEFECTO.colorUmbral;
    return {
      escenario,
      vista,
      relieve: g.relieve === "plano" ? "plano" : "teselas",
      autoSimular: g.autoSimular ?? true,
    };
  } catch {
    return null;
  }
}

export function guardar(e: Estado) {
  try {
    const g: Guardado = { escenario: e.escenario, vista: e.vista, relieve: e.relieve, autoSimular: e.autoSimular };
    window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(g));
  } catch {
    // Sin almacenamiento disponible (modo privado o bloqueado): el escenario sigue en memoria.
  }
}

const numero = (v: unknown, defecto: number, min = -Infinity, max = Infinity) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defecto;

const ROLES: Rol[] = ["REPETIDOR", "COMPANION", "ROOM_SERVER"];

/** Rol de un escenario guardado: los nombres viejos (v1–v11) pasan a los roles de MeshCore. */
function rolLeido(raw: unknown, tipo: TipoNodo, defecto: Rol): Rol {
  if (ROLES.includes(raw as Rol)) return raw as Rol;
  if (raw === "ROUTER") return "REPETIDOR";
  if (raw === "CLIENT") return tipo === "antena" ? "REPETIDOR" : "COMPANION";
  if (raw === "CLIENT_MUTE") return "COMPANION";
  return defecto;
}

/** Valida y completa un escenario leído de un archivo o del almacenamiento. */
export function validarEscenario(x: unknown): Escenario | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Partial<Escenario>;
  if (!Array.isArray(o.antenas)) return null;
  const antenas: Antena[] = [];
  for (const raw of o.antenas as Partial<Antena>[]) {
    if (typeof raw?.lat !== "number" || typeof raw?.lon !== "number" || Math.abs(raw.lat) > 85 || Math.abs(raw.lon) > 180) continue;
    const tipo: TipoNodo = raw.tipo === "nodo" ? "nodo" : "antena";
    const base = nuevaAntena(raw.lat, raw.lon, antenas, { tipo });
    antenas.push({
      ...base,
      id: typeof raw.id === "string" && raw.id ? raw.id : base.id,
      nombre: typeof raw.nombre === "string" && raw.nombre.trim() ? raw.nombre.trim().slice(0, 60) : base.nombre,
      alturaM: numero(raw.alturaM, base.alturaM, 0.5, 300),
      potenciaDbm: numero(raw.potenciaDbm, base.potenciaDbm, 0, 36),
      gananciaDbi: numero(raw.gananciaDbi, base.gananciaDbi, -5, 20),
      perdidaCableDb: numero(raw.perdidaCableDb, base.perdidaCableDb, 0, 20),
      equipo: EQUIPOS.some((q) => q.id === raw.equipo) ? (raw.equipo as EquipoId) : "personalizado",
      rol: rolLeido(raw.rol, tipo, base.rol),
      pasarela: Boolean(raw.pasarela),
      ...(raw.poblada ? { poblada: true } : {}),
      ...(raw.poblada && typeof raw.zona === "string" && raw.zona ? { zona: raw.zona } : {}),
      activa: raw.activa !== false,
      ...(raw.patron && raw.patron !== "omni" && PATRONES.some((x) => x.id === raw.patron)
        ? { patron: raw.patron as PatronId, azimutDeg: ((numero(raw.azimutDeg, 0) % 360) + 360) % 360, elevacionDeg: numero(raw.elevacionDeg, 0, -45, 45) }
        : {}),
    });
  }
  const p = (o.parametros ?? {}) as Partial<Parametros>;
  const d = PARAMETROS_DEFECTO;
  const parametros: Parametros = {
    preset: PRESETS.some((x) => x.id === p.preset) ? (p.preset as Parametros["preset"]) : d.preset,
    frecuenciaMhz: numero(p.frecuenciaMhz, d.frecuenciaMhz, 860, 960),
    alturaRxM: numero(p.alturaRxM, d.alturaRxM, 0.5, 100),
    gananciaRxDbi: numero(p.gananciaRxDbi, d.gananciaRxDbi, -5, 15),
    perdidaExtraDb: numero(p.perdidaExtraDb, d.perdidaExtraDb, 0, 40),
    radioKm: numero(p.radioKm, d.radioKm, 1, 40),
    resolucion: p.resolucion === "rapida" || p.resolucion === "fina" ? p.resolucion : "normal",
    limiteSaltos: Math.round(numero(p.limiteSaltos, d.limiteSaltos, 1, LIMITE_SALTOS_MAXIMO)),
    modelo: p.modelo === "itm" ? "itm" : "calibrado",
    polarizacion: p.polarizacion === "horizontal" ? "horizontal" : "vertical",
    clima: ([1, 2, 3, 4, 5, 6, 7].includes(p.clima as number) ? p.clima : d.clima) as ClimaItm,
    refractividad: numero(p.refractividad, d.refractividad, 250, 400),
    suelo: p.suelo === "personalizado" || SUELOS.some((x) => x.id === p.suelo) ? (p.suelo as SueloId) : d.suelo,
    permitividad: numero(p.permitividad, d.permitividad, 1, 100),
    conductividad: numero(p.conductividad, d.conductividad, 0.0001, 10),
    variabilidad: VARIABILIDADES.some((x) => x.id === p.variabilidad) ? (p.variabilidad as Parametros["variabilidad"]) : d.variabilidad,
    tiempoPct: numero(p.tiempoPct, d.tiempoPct, 1, 99),
    ubicacionesPct: numero(p.ubicacionesPct, d.ubicacionesPct, 1, 99),
    situacionesPct: numero(p.situacionesPct, d.situacionesPct, 1, 99),
    entorno: ENTORNOS.some((x) => x.id === p.entorno) ? (p.entorno as Parametros["entorno"]) : d.entorno,
  };
  // El suelo con nombre fija sus constantes eléctricas
  const suelo = SUELOS.find((x) => x.id === parametros.suelo);
  if (suelo) {
    parametros.permitividad = suelo.permitividad;
    parametros.conductividad = suelo.conductividad;
  }
  const mediciones: Medicion[] = [];
  for (const raw of (Array.isArray(o.mediciones) ? o.mediciones : []) as Partial<Medicion>[]) {
    const puntos = (Array.isArray(raw?.puntos) ? raw.puntos : []).filter(
      (q): q is [number, number] => Array.isArray(q) && q.length === 2 && q.every((v) => typeof v === "number" && Number.isFinite(v)) && Math.abs(q[0]) <= 180 && Math.abs(q[1]) <= 85,
    );
    if (puntos.length < 2) continue;
    const tipo: TipoMedicion = raw.tipo === "linea" || raw.tipo === "area" ? raw.tipo : "trayecto";
    mediciones.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : nuevoId("m"),
      nombre: typeof raw.nombre === "string" && raw.nombre.trim() ? raw.nombre.trim().slice(0, 60) : `Medición ${mediciones.length + 1}`,
      tipo,
      puntos: puntos.slice(0, 500),
      visible: raw.visible !== false,
      ...(tipo === "area" && objetivoValido(raw.objetivo) ? { objetivo: objetivoValido(raw.objetivo)! } : {}),
    });
  }
  // Una sola área objetivo: la última que venga marcada
  const conObjetivo = mediciones.filter((m) => m.objetivo);
  for (const m of conObjetivo.slice(0, -1)) delete m.objetivo;
  return { version: 1, nombre: typeof o.nombre === "string" && o.nombre.trim() ? o.nombre.trim().slice(0, 80) : "Escenario importado", antenas, parametros, mediciones };
}

/** Meta de un área objetivo leída de un archivo (o null si no es válida). */
function objetivoValido(x: unknown): ObjetivoArea | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Partial<ObjetivoArea>;
  if (typeof o.metaPct !== "number" || typeof o.margenDb !== "number" || !Number.isFinite(o.metaPct) || !Number.isFinite(o.margenDb)) return null;
  return { metaPct: Math.min(100, Math.max(1, o.metaPct)), margenDb: Math.min(60, Math.max(10, o.margenDb)), ...(o.respaldo ? { respaldo: true } : {}) };
}
