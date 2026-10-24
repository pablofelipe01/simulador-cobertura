// Órdenes para Melki: entiende pedidos en español con coordenadas (decimales o en grados, minutos y segundos)
// y los ejecuta en el simulador: inscribir, mover, editar o borrar nodos, cambiar parámetros, simular, ir a un lugar,
// medir distancias, ver perfiles y la señal en un punto. Todo se procesa aquí mismo, sin servicios externos.
import { EQUIPOS, LIMITE_SALTOS_MAXIMO, META_UTIL_ESTUDIO_PCT, PRESETS, presetPorId, type EquipoId, type PresetId } from "@/lib/radio/constantes";
import { entornoPorId, perdidaEntorno } from "@/lib/radio/entorno";
import { consejoRed, piezaDe, type EstadoRed, type Pieza } from "@/lib/radio/estado-red";
import { INTENTOS, type ViajeMensaje } from "@/lib/radio/mensaje";
import type { DestinoSiembra, Siembra } from "@/lib/radio/siembra";
import type { Diseno } from "@/lib/radio/diseno";
import { resumenCambios, textoCambio, type Ajuste, type PermisosAjuste, type SitioAjuste } from "@/lib/radio/ajuste";
import { areaM2, cajaPoligono, conArea, coberturaEnArea, poligonoCirculo, poligonoRectangulo, porcentajeSobre, radioDeArea, type Poligono } from "@/lib/radio/area";
import { aDecimal, aGMS, desplazar, distanciaM, formatoDistancia, leerCoordenada, puntoCardinal, rumbo, rumboTexto } from "@/lib/radio/geo";
import type { ClimaItm } from "@/lib/radio/itm";
import { anchosHaz, esDireccional, patronPorId } from "@/lib/radio/patron";
import { CLIMAS, CONFIABILIDADES, RED_REFERENCIA, SUELOS, VARIABILIDADES } from "@/lib/radio/red";
import type { Antena, AreaObjetivo, EntornoId, Escenario, Medicion, ObjetivoArea, Parametros, PatronId, ResultadoSimulacion, Rol, SueloId, TipoNodo, VariabilidadId } from "@/lib/radio/tipos";
import { textoNivel, uvADbm, type UnidadId } from "@/lib/radio/unidades";
import type { Lugar } from "@/lib/geo/referencia";

import type { CurvaCargaResultado, ResultadoCarga } from "@/lib/radio/carga";
import type { ResultadoEstres, LimitePunto } from "@/lib/radio/estres";
import type { NodoUsuario, SfTrama, TerrenoTrama } from "@/lib/radio/trama";

import type { EscalaSenal, ModoApp, Vista } from "../simulador/estado";
import { ALTURA_REPETIDOR_DEFECTO } from "../simulador/piezas";
import type { AreaPoblar, OpcionesCarga, PedidoPoblar, ResultadoPoblar } from "../simulador/panel-capacidad";
import type { CentroZona, OpcionesEstres, PedidoPunto, PedidoZonas, ResultadoPunto, ResultadoZonas } from "../simulador/panel-estres";
import { ejecutarCapacidad, interpretarCapacidad, seguirConZonas } from "./capacidad";
import type { AccionRespuesta, Respuesta } from "./cerebro";

/** Cambios de la vista que Melki puede pedir (unidad y escala de colores del mapa de señal). */
export type CambiosVista = Partial<
  Pick<
    Vista,
    | "unidad"
    | "escala"
    | "escalaMinDbm"
    | "escalaMaxDbm"
    | "umbralDbm"
    | "modo"
    | "animarRed"
    | "fondo"
    | "refDivision"
    | "refRios"
    | "refNombres"
    | "refVias"
    | "mostrarEnlaces"
    | "mostrarAlcance"
    | "mostrarCirculos"
    | "relieve3d"
    | "opacidad"
    | "mostrarSinServicio"
    | "mostrarAnillos"
    | "mostrarHaces"
  >
>;

/** Dónde va el área del diseño: un punto, el gateway o el centro del mapa que está viendo el usuario. */
export type CentroArea = { tipo: "coord"; coord: Coordenada; nombre?: string } | { tipo: "gateway" } | { tipo: "mapa" };

/** Área pedida para el diseño: una forma alrededor de un centro, o un área medida con la regla. */
export type AreaPedida =
  | { forma: "circulo" | "cuadrado" | "rectangulo"; areaM2: number; anchoM?: number; altoM?: number; centro: CentroArea }
  | { forma: "medicion"; id: string }
  /** Un polígono ya conocido (para rehacer o ampliar un diseño); `dibujar` lo vuelve a poner como medición. */
  | { forma: "poligono"; puntos: Poligono; nombre: string; dibujar: boolean };

export type Coordenada = { lat: number; lon: number; corregido?: boolean };

type DatosNodo = Partial<Pick<Antena, "nombre" | "alturaM" | "gananciaDbi" | "potenciaDbm" | "pasarela" | "tipo" | "patron" | "azimutDeg" | "elevacionDeg" | "equipo">>;

export type Orden =
  | { tipo: "agregar"; coord?: Coordenada; datos: DatosNodo }
  | { tipo: "mover"; id: string; coord?: Coordenada }
  | { tipo: "eliminar"; id: string }
  | { tipo: "renombrar"; id: string; nombre: string }
  | { tipo: "editar"; id: string; cambios: Partial<Antena>; descripcion: string }
  | { tipo: "parametros"; cambios: Partial<Parametros>; descripcion: string }
  | { tipo: "vista"; cambios: CambiosVista; descripcion: string }
  | { tipo: "informe"; a: string; b: Referencia }
  | { tipo: "apuntar-omni"; id: string; azimutDeg: number; destino?: string }
  | { tipo: "simular" }
  | { tipo: "ir"; coord?: Coordenada; lugar?: Lugar; id?: string; consulta?: string }
  | { tipo: "distancia"; a: Referencia; b: Referencia }
  | { tipo: "perfil"; a: string; b: Referencia }
  | { tipo: "senal"; coord: Coordenada }
  | { tipo: "donde"; ref: Referencia }
  | { tipo: "listar" }
  | { tipo: "herramienta"; herramienta: "regla" | "inspeccionar" | "agregar" }
  | { tipo: "ejemplo" }
  | { tipo: "nuevo"; confirmado?: boolean }
  | { tipo: "exportar"; formato: "kmz" | "json" | "csv" }
  | { tipo: "borrar-mediciones" }
  | { tipo: "coordenada-sola"; coord: Coordenada }
  /* Modo «Sembrar la malla» */
  | { tipo: "pieza"; pieza: Pieza; coord?: Coordenada; datos: DatosNodo; mover?: boolean }
  | { tipo: "sembrar"; destino: "faltantes" | { coord: Coordenada; nombre: string } | { id: string } }
  | { tipo: "aceptar-siembra" }
  | { tipo: "descartar-siembra" }
  | { tipo: "mensaje"; id?: string }
  | { tipo: "modo"; modo: ModoApp }
  | { tipo: "ejemplo-malla" }
  | { tipo: "que-hago" }
  /* Agente: diseño por área, órdenes en lote y vista */
  | {
      tipo: "disenar";
      area: AreaPedida;
      margenDb: number;
      clases: string;
      porcentaje: number;
      respaldo: boolean;
      alturaM: number;
      gateway: Coordenada | null;
      maxRepetidores: number;
      /** Escenario al que se vuelve antes de diseñar de nuevo (rehacer con otras torres o meta). */
      reemplazar?: Escenario;
      /** Después del diseño: zonas de popularidad en cada nodo y, si se pidió, la prueba de estrés. */
      despues?: { zonas: PedidoZonas; estres: Partial<OpcionesEstres> | null };
    }
  | { tipo: "eliminar-varios"; ids: string[]; descripcion: string }
  | { tipo: "editar-varios"; ids: string[]; cambios: Partial<Antena>; descripcion: string }
  | { tipo: "auto"; valor: boolean }
  | { tipo: "encuadrar" }
  | { tipo: "cobertura-area"; id: string; margenDb: number }
  | { tipo: "relieve"; valor: "teselas" | "plano" }
  | { tipo: "nombre-escenario"; nombre: string }
  | { tipo: "duplicar"; id: string }
  | { tipo: "seleccionar"; id: string }
  /** Paneles a los lados del mapa: «pantalla limpia» los oculta para trabajar por voz con solo el mapa. */
  | { tipo: "paneles"; izquierdo?: boolean; derecho?: boolean }
  /* Ajuste inteligente (cobertura–costo) y área objetivo */
  | { tipo: "ajustar"; aplicar: boolean; opcion: OpcionAjusteId; opciones: OpcionesAjuste; avisos: string[] }
  | { tipo: "aplicar-ajuste"; ajuste: Ajuste; indice: number; base: Escenario }
  | { tipo: "descartar-ajuste" }
  | { tipo: "area-objetivo"; quitar: boolean; id?: string; metaPct?: number; margenDb?: number }
  /* Gente, capacidad y Trama */
  | { tipo: "poblar"; pedido: PedidoPoblar }
  | { tipo: "quitar-pobladas" }
  | { tipo: "carga"; opciones: Partial<OpcionesCarga>; curva: boolean }
  /** Zonas de popularidad (N personas a la redonda de cada nodo o de los nombrados) y, si se pidió, la prueba de estrés. */
  | { tipo: "zonas"; pedido: PedidoZonas; estres: Partial<OpcionesEstres> | null }
  | { tipo: "quitar-zonas"; centros?: string[] }
  | { tipo: "estres"; opciones: Partial<OpcionesEstres> }
  /** Límite de un punto (o de cada uno, sin `centros`) y, con `llenar`, ponerle esa gente y confirmarlo. */
  | { tipo: "limite"; centros?: string[]; n?: number; radioKm?: number; llenar: boolean; opciones: Partial<OpcionesEstres> }
  | { tipo: "trama-departamento"; id: string; adopcionPct: number; sf: SfTrama; nodo: NodoUsuario }
  | { tipo: "trama-dimensionar"; usuarios: number; areaKm2: number | null; terreno: TerrenoTrama; sf: SfTrama; nodo: NodoUsuario };

export type OpcionAjusteId = "economica" | "recomendada" | "maxima";

export type Referencia = { tipo: "nodo"; id: string } | { tipo: "coord"; coord: Coordenada };

export type Pendiente = { tipo: "agregar"; datos: DatosNodo } | { tipo: "mover"; id: string } | { tipo: "pieza"; pieza: Pieza; datos: DatosNodo } | null;

export type Api = {
  antenas(): Antena[];
  parametros(): Parametros;
  seleccion(): string | null;
  resultado(): ResultadoSimulacion | null;
  instantanea(): Escenario;
  agregar(datos: DatosNodo & { lat: number; lon: number }): Antena;
  editar(id: string, cambios: Partial<Antena>): void;
  eliminar(id: string): void;
  parametrosCambiar(cambios: Partial<Parametros>): void;
  simular(): void;
  centrar(lat: number, lon: number, zoom?: number): void;
  encuadrarCaja(caja: [number, number, number, number]): void;
  marcar(lat: number, lon: number, titulo: string): void;
  /** Dibuja una medición; con `seleccionar` = false no abre el panel de la regla (el área de un diseño). */
  medir(m: Medicion, seleccionar?: boolean): void;
  perfil(a: Antena, b: Antena | { lat: number; lon: number }, informe?: boolean): void;
  vista(cambios: CambiosVista): void;
  senal(lat: number, lon: number): void;
  herramienta(h: "regla" | "inspeccionar" | "agregar"): void;
  ejemplo(): void;
  nuevo(): void;
  exportar(f: "kmz" | "json" | "csv"): boolean;
  borrarMediciones(): void;
  ubicacion(lat: number, lon: number): string | null;
  buscarLugar(texto: string): Lugar[];
  /* Modo «Sembrar la malla» */
  modo(): ModoApp;
  cambiarModo(m: ModoApp): void;
  /** Pone una pieza (gateway, repetidor o persona) con sus valores de Trama. */
  ponerPieza(pieza: Pieza, lat: number, lon: number, datos?: DatosNodo): Antena;
  /** Arma la herramienta para poner la pieza con un clic en el mapa. */
  armarPieza(pieza: Pieza): void;
  /** Estado de la red frente al gateway (con la última simulación). */
  red(): EstadoRed;
  /** Propone repetidores hacia los destinos (sembrado automático). */
  sembrar(destinos: DestinoSiembra[]): Promise<Siembra | null>;
  propuesta(): Siembra | null;
  /** Pone los repetidores propuestos; devuelve cuántos nodos puso. */
  aceptarSiembra(): number;
  descartarSiembra(): void;
  /** Envía un mensaje desde ese nodo hasta el gateway y lo anima en el mapa (null si falta simular). */
  enviarMensaje(desdeId: string): ViajeMensaje | null;
  ejemploMalla(): void;
  /* Agente: varias órdenes, lotes, vista y diseño por área */
  seleccionar(id: string | null): void;
  eliminarVarias(ids: string[]): void;
  restaurar(e: Escenario): void;
  encuadrarTodo(): void;
  autoSimular(): boolean;
  fijarAutoSimular(v: boolean): void;
  /** Centro del mapa que está viendo el usuario. */
  centroMapa(): { lat: number; lon: number } | null;
  mediciones(): Medicion[];
  /** Diseña la malla para cubrir el área (gateway y repetidores) con el relieve real; no cambia el escenario. */
  disenarArea(o: OpcionesDiseno): Promise<Diseno | null>;
  /** Pone los nodos del diseño; devuelve los nodos puestos. */
  aplicarDiseno(d: Diseno, alturaRepetidorM: number): Antena[];
  /** Simula (si hace falta) y entrega el próximo resultado al día. */
  esperarResultado(): Promise<ResultadoSimulacion | null>;
  /** Ajuste inteligente (cobertura–costo): calcula las opciones y las muestra en el panel y el mapa. */
  ajustarRed(o?: OpcionesAjuste): Promise<Ajuste | null>;
  /** Aplica una opción del ajuste (sobre la base, si se da: «usar la económica» después de otra); devuelve los apoyos puestos. */
  aplicarAjuste(a: Ajuste, i: number, base?: Escenario): Antena[] | null;
  mostrarAjuste(a: Ajuste, i?: number): void;
  descartarAjuste(): void;
  areaObjetivo(): AreaObjetivo | null;
  /** Marca un área de la regla como área objetivo (o la quita con id null). */
  fijarAreaObjetivo(id: string | null, objetivo?: ObjetivoArea): void;
  fijarRelieve(v: "teselas" | "plano"): void;
  renombrarEscenario(nombre: string): void;
  duplicar(id: string): void;
  /** Muestra u oculta los paneles de los lados (en el celular cierra la hoja abierta); dice en qué pantalla está. */
  paneles(c: { izquierdo?: boolean; derecho?: boolean }): "escritorio" | "celular";
  /* Gente y capacidad */
  /** Áreas donde se pueden poblar personas (área objetivo, áreas de la regla, zona de la red, área de estudio). */
  areasPoblar(): AreaPoblar[];
  /** Reparte personas al azar en un área y simula su conexión. */
  poblar(o: PedidoPoblar): ResultadoPoblar;
  /** Quita las personas pobladas al azar; devuelve cuántas. */
  quitarPobladas(): number;
  /** Prueba de carga (pagos o mensajes de texto —WhatsApp, consultas a la IA— al tiempo) y, con `curva`, hasta cuántos aguanta la frecuencia. */
  probarCarga(o: Partial<OpcionesCarga>, curva?: boolean): Promise<{ carga: ResultadoCarga; curva: CurvaCargaResultado | null } | null>;
  /** Gateways y repetidores donde se puede poner una zona de popularidad, con las personas que ya tienen. */
  centrosZona(): CentroZona[];
  /** Zonas de popularidad: N personas a la redonda de los nodos pedidos (o de todos). */
  poblarZonas(o: PedidoZonas): ResultadoZonas;
  /** Quita las zonas de popularidad (de esos nodos o todas); devuelve cuántas personas. */
  quitarZonas(centros?: string[]): number;
  /** Prueba de estrés de la hora pico por repetidor y, con `rampa`, hasta dónde aguanta cada uno. */
  probarEstres(o: Partial<OpcionesEstres>): Promise<ResultadoEstres | null>;
  /** Un punto: poner N personas y probar la hora pico, buscar su límite o llenarlo hasta el límite. */
  evaluarPunto(o: PedidoPunto): Promise<ResultadoPunto>;
  /** El límite de cada punto (o de los pedidos), uno a la vez con los demás como están. */
  evaluarPuntos(o: { centros?: string[]; n?: number; radioKm?: number; opciones?: Partial<OpcionesEstres> }): Promise<{ limites: LimitePunto[]; zonas: ResultadoZonas | null; error: string | null }>;
};

/** Pedido de ajuste automático que arma Melki (qué puede cambiar, límites y sitios dados). */
export type OpcionesAjuste = {
  permisos?: Partial<PermisosAjuste>;
  alturaMaxM?: number;
  maxApoyos?: number;
  sitios?: SitioAjuste[];
  fijos?: string[];
};

/** Pedido de diseño por área que arma Melki. */
export type OpcionesDiseno = {
  area: Poligono;
  margenDb: number;
  porcentaje: number;
  respaldo: boolean;
  alturaRepetidorM: number;
  gateway: Coordenada | null;
  maxRepetidores: number;
};

const n = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,\-°'"\s]/g, " ")
    .replace(/\bnodo\s*-?\s*antena(s?)\b/g, "nodo antena$1")
    .replace(/\s+/g, " ")
    .trim();
const num = (s: string) => Number(s.replace(",", "."));
const f1 = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
/** Número sin decimales si es entero (20 m), con uno si no (1,5 m). */
const fn = (x: number) => (Number.isInteger(x) ? String(x) : f1(x));

/* ───────────── Coordenadas en texto libre ───────────── */

function ajustarColombia(lat: number, lon: number, conHemisferio: boolean): Coordenada | null {
  let corregido = false;
  // Longitud primero: «-73,12, 4,51»
  if (Math.abs(lat) > 20 && Math.abs(lat) <= 82 && Math.abs(lon) <= 14) [lat, lon] = [lon, lat];
  // Longitud sin signo en Colombia: se toma al oeste
  if (!conHemisferio && lon >= 66 && lon <= 82 && lat >= -5 && lat <= 14) {
    lon = -lon;
    corregido = true;
  }
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return { lat, lon, corregido };
}

/** Busca una coordenada (latitud y longitud) dentro de un texto. */
export function extraerCoordenadas(texto: string): Coordenada | null {
  const t = texto.replace(/[’′´`]/g, "'").replace(/[”″“]/g, '"').replace(/''/g, '"').replace(/º/g, "°");
  // 1) Grados, minutos y segundos: 4°30'44,3" N 73°07'24" O
  const gms = /(-?\d{1,3})\s*°\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*'\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*"\s*)?\s*(norte|sur|oeste|occidente|este|[NSEOW](?![a-zA-Z]))?/gi;
  const partes = [...t.matchAll(gms)];
  if (partes.length >= 2) {
    const valores = partes.slice(0, 2).map((m) => {
      const h = (m[4] ?? "").toUpperCase();
      const hem = h.startsWith("NORTE") ? "N" : h.startsWith("SUR") ? "S" : h.startsWith("OESTE") || h.startsWith("OCC") ? "O" : h.startsWith("ESTE") ? "E" : h;
      const texto = `${m[1]}°${m[2] ? `${m[2]}'` : ""}${m[3] ? `${m[3]}"` : ""} ${hem}`.trim();
      return { hem, texto };
    });
    let lat: number | null = null;
    let lon: number | null = null;
    for (const v of valores) {
      if ("NS".includes(v.hem) && v.hem) lat = leerCoordenada(v.texto, "lat");
      else if ("EOW".includes(v.hem) && v.hem) lon = leerCoordenada(v.texto, "lon");
    }
    if (lat === null && lon === null) {
      lat = leerCoordenada(valores[0].texto, "lat");
      lon = leerCoordenada(valores[1].texto, "lon");
    } else if (lat === null) lat = leerCoordenada(valores.find((v) => !"EOW".includes(v.hem) || !v.hem)?.texto ?? "", "lat");
    else if (lon === null) lon = leerCoordenada(valores.find((v) => !"NS".includes(v.hem) || !v.hem)?.texto ?? "", "lon");
    if (lat !== null && lon !== null) return ajustarColombia(lat, lon, valores.some((v) => v.hem));
  }
  // 2) Decimales: «4.5123, -73.1234», «4,5123; -73,1234», «lat 4.51 lon -73.12»
  const limpio = t.replace(/\b(latitud|lat|longitud|long|lon|lng)\b\s*:?/gi, " ");
  const dec = /(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([NS](?![a-zA-Z]))?\s*(?:[,;/]|\sy\s|\s)\s*(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([EOW](?![a-zA-Z]))?/i;
  const m = limpio.match(dec);
  if (m) {
    let lat = num(m[1]);
    let lon = num(m[3]);
    if (m[2]?.toUpperCase() === "S") lat = -Math.abs(lat);
    if (m[4] && "OW".includes(m[4].toUpperCase())) lon = -Math.abs(lon);
    return ajustarColombia(lat, lon, Boolean(m[2] || m[4]));
  }
  return null;
}

/** Todas las coordenadas de un texto («en 4.51, -73.12; 4.60, -73.05 y 4°30' N 73°10' O»). */
export function extraerVariasCoordenadas(texto: string): Coordenada[] {
  const t = texto.replace(/[’′´`]/g, "'").replace(/[”″“]/g, '"').replace(/''/g, '"').replace(/º/g, "°");
  const salida: Coordenada[] = [];
  const gms = [...t.matchAll(/(-?\d{1,3})\s*°\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*'\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*"\s*)?\s*(norte|sur|oeste|occidente|este|[NSEOW](?![a-zA-Z]))?/gi)];
  if (gms.length >= 4) {
    for (let i = 0; i + 1 < gms.length; i += 2) {
      const c = extraerCoordenadas(`${gms[i][0]} ${gms[i + 1][0]}`);
      if (c) salida.push(c);
    }
    return salida;
  }
  const limpio = t.replace(/\b(latitud|lat|longitud|long|lon|lng)\b\s*:?/gi, " ");
  for (const m of limpio.matchAll(/(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([NS](?![a-zA-Z]))?\s*(?:[,;/]|\sy\s|\s)\s*(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([EOW](?![a-zA-Z]))?/gi)) {
    const c = extraerCoordenadas(m[0]);
    if (c) salida.push(c);
  }
  return salida;
}

/* ───────────── Nodos y datos en el texto ───────────── */

function buscarNodo(tn: string, antenas: Antena[], seleccion: string | null, excluir?: string): Antena | null {
  const candidatos = [...antenas].filter((a) => a.id !== excluir).sort((a, b) => b.nombre.length - a.nombre.length);
  for (const a of candidatos) {
    const nombre = n(a.nombre);
    if (nombre.length >= 2 && new RegExp(`(^|[^a-z0-9])${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(tn)) return a;
  }
  if (/\b(la|el) (ultima|ultimo)\b/.test(tn) && antenas.length) return antenas[antenas.length - 1];
  if (/\b(seleccionad[ao]|esta antena|este nodo|esa antena|ese nodo)\b/.test(tn) && seleccion) return antenas.find((a) => a.id === seleccion) ?? null;
  if (antenas.length === 1 && /\b(antena|nodo|torre)\b/.test(tn)) return antenas[0];
  return null;
}

function nodosMencionados(tn: string, antenas: Antena[]): Antena[] {
  const encontrados: { a: Antena; pos: number }[] = [];
  for (const a of [...antenas].sort((x, y) => y.nombre.length - x.nombre.length)) {
    const nombre = n(a.nombre);
    const pos = tn.search(new RegExp(`(^|[^a-z0-9])${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`));
    if (pos >= 0 && !encontrados.some((e) => Math.abs(e.pos - pos) < 2)) encontrados.push({ a, pos });
  }
  return encontrados.sort((x, y) => x.pos - y.pos).map((e) => e.a);
}

function nombreNuevo(texto: string): string | undefined {
  const comillas = texto.match(/["“«']([^"”»']{2,40})["”»']/);
  if (comillas) return comillas[1].trim();
  const m = texto.match(
    /(?:llamad[oa]|de nombre|con (?:el )?nombre(?: de)?|nombre:?|que se llame)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][\wÁÉÍÓÚÑáéíóúñ .-]{0,38}?)(?=\s+(?:en|a|con|de|ubicad[oa]|que|y|para|sobre)\b|[,.;]|$)/i,
  );
  return m ? m[1].trim() : undefined;
}

function datosNodo(texto: string, tn: string): DatosNodo {
  const d: DatosNodo = {};
  const nombre = nombreNuevo(texto);
  if (nombre) d.nombre = nombre;
  const altura = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
  if (altura) d.alturaM = Math.min(300, Math.max(0.5, num(altura[1])));
  const ganancia = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
  if (ganancia) d.gananciaDbi = num(ganancia[1]);
  const potencia = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbm\b/i);
  if (potencia) d.potenciaDbm = num(potencia[1]);
  if (/\b(pasarela|gateway)\b/.test(tn)) d.pasarela = true;
  const tipo = tipoNodo(tn);
  if (tipo) d.tipo = tipo;
  const patron = patronEnTexto(tn);
  if (patron && patron !== "omni") {
    d.patron = patron;
    d.equipo = "personalizado";
    if (d.gananciaDbi === undefined) d.gananciaDbi = patronPorId(patron).gananciaTipica;
    const az = /\b(apunt\w*|orient\w*|azimut|hacia|mirando)\b/.test(tn) ? azimutEnTexto(texto.replace(/\d+(?:[.,]\d+)?\s*°\s*\d/g, ""), tn) : null;
    d.azimutDeg = az ?? 0;
    d.elevacionDeg = 0;
  }
  return d;
}

function tipoNodo(tn: string): TipoNodo | null {
  if (/\bnodo antena\b|\bantena\b|\btorre\b|\brepetidor\b|\brouter\b/.test(tn)) return "antena";
  if (/\bnodo\b|\bsensor\b|\bportatil\b|\brastreador\b|\btracker\b|equipo de campo|nodo de campo/.test(tn)) return "nodo";
  return null;
}

/**
 * Ajuste de radio en el texto: «SF9», «SF10 a 250 kHz», «SF9 de 62,5», «el de capacidad», «el de alcance»,
 * «el de EE. UU.». Sin ancho de banda se entiende el de Trama (250 kHz).
 */
function presetEnTexto(tn: string): PresetId | null {
  if (/\b(de|el|modo|ajuste|radio|preset|velocidad) (de )?(capacidad|mas capacidad)\b/.test(tn)) return "SF9_250";
  if (/\b(de|el|modo|ajuste|radio|preset) (de )?(alcance|mas alcance|largo alcance)\b/.test(tn)) return "SF11_250";
  // «usa» es el verbo: Estados Unidos se nombra completo («el ajuste de Estados Unidos», «el de EE. UU.»)
  if (/\b(estados unidos|ee ?uu|norteamerica\w*)\b/.test(tn) && /\b(preset|ajuste|radio|config\w*|el de)\b/.test(tn)) return "SF7_62";
  const m = tn.match(/\bsf ?(7|8|9|10|11)\b/);
  if (!m) return null;
  const sf = Number(m[1]);
  const angosto = /\b62(?:[.,]5)?\b|\bangost\w*|\bestrech\w*|\bcomunidad\b/.test(tn);
  const id = `SF${sf}_${angosto ? "62" : "250"}` as PresetId;
  return PRESETS.some((p) => p.id === id) ? id : sf >= 9 && sf <= 11 ? (`SF${sf}_250` as PresetId) : (`SF${sf}_62` as PresetId);
}

/* ───────────── Antenas direccionales, red y vista ───────────── */

/** Tipo de antena mencionado en el texto. */
function patronEnTexto(tn: string): PatronId | null {
  if (/\byagi\b/.test(tn)) return "yagi";
  if (/\bparabolic\w*|\bplato\b|\brejilla\b/.test(tn)) return "parabolica";
  if (/\bsector\w*/.test(tn)) return /\b120\b/.test(tn) ? "sectorial-120" : "sectorial-90";
  if (/\bpanel\b/.test(tn)) return "panel";
  if (/\bomni\w*/.test(tn)) return "omni";
  return null;
}

const CARDINALES: [RegExp, number][] = [
  [/\b(noreste|nororiente|nor ?este)\b/, 45],
  [/\b(noroeste|noroccidente|nor ?oeste)\b/, 315],
  [/\b(sureste|suroriente|sur ?este|sudeste)\b/, 135],
  [/\b(suroeste|suroccidente|sur ?oeste|sudoeste)\b/, 225],
  [/\b(norte)\b/, 0],
  [/\b(sur)\b/, 180],
  [/\b(este|oriente)\b/, 90],
  [/\b(oeste|occidente)\b/, 270],
];

/** Azimut pedido: «45°», «a 120 grados», «al noreste»; null si no se menciona. */
function azimutEnTexto(texto: string, tn: string): number | null {
  const g = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:°|º|grados?\b)/i);
  if (g) return ((num(g[1]) % 360) + 360) % 360;
  const resto = tn.replace(/.*\b(apunt\w*|orient\w*|dirig\w*|gir\w*|hacia|mirando)\b/, "");
  for (const [re, grados] of CARDINALES) if (re.test(resto)) return grados;
  return null;
}

const PREGUNTA = /^(que|como|cual|cuales|por que|porque|para que|explica\w*|dime|cuentame)\b|\b(que es|que son|que significa|para que sirve|como funciona)\b/;

function climaEnTexto(tn: string): ClimaItm | null {
  if (/\becuatorial\b/.test(tn)) return 1;
  if (/\bdesert\w*|\bdesierto\b|\barido\b/.test(tn)) return 4;
  if (/\bmaritimo templado\b.*\bmar\b|\bsobre el mar\b|\bsobre mar\b/.test(tn)) return 7;
  if (/\bmaritimo templado\b|\bmaritimo\b.*\btierra\b/.test(tn)) return 6;
  if (/\bmaritimo subtropical\b|\bmaritimo\b/.test(tn)) return 3;
  if (/\bcontinental templado\b|\btemplado\b/.test(tn)) return 5;
  if (/\bcontinental subtropical\b|\bsubtropical\b|\bcontinental\b/.test(tn)) return 2;
  return null;
}

function sueloEnTexto(tn: string): SueloId | null {
  if (/\bagua de mar\b|\bmar\b|\bsalad\w*/.test(tn)) return "mar";
  if (/\bagua dulce\b|\brio\b|\blago\b|\bcienaga\b|\bagua\b/.test(tn)) return "agua-dulce";
  if (/\bpobre\b|\bseco\b|\barenos\w*|\bdesert\w*/.test(tn)) return "pobre";
  if (/\bbueno\b|\bhumed\w*|\bfertil\b|\bpantanos\w*/.test(tn)) return "bueno";
  if (/\bpromedio\b|\bmedio\b|\bnormal\b|\bcomun\b/.test(tn)) return "promedio";
  return null;
}

function entornoEnTexto(tn: string): EntornoId | null {
  if (/\b(centro urbano|ciudad densa|edificios altos|urbano denso)\b/.test(tn)) return "urbano-denso";
  if (/\b(vegetacion densa|bosque|selva|monte|montes|arboles altos|bosques)\b/.test(tn)) return "bosque";
  if (/\b(plantacion\w*|palma\w*|palmeras|palmares|frutales|cultivo alto|cultivos altos)\b/.test(tn)) return "plantacion";
  if (/\b(cultivos?|arboles dispersos|vegetacion ligera|vegetacion|potreros? con arboles|arboles)\b/.test(tn)) return "cultivos";
  if (/\b(pueblo|suburban\w*|caserio|casas)\b/.test(tn)) return "suburbano";
  if (/\b(ciudad|urbano|urbana|edificios)\b/.test(tn)) return "urbano";
  if (/\b(campo abierto|sabana|sin vegetacion|sin obstaculos|despejad\w*|zona abierta|terreno abierto|llanura abierta|sin entorno|sin perdidas? (de|por) entorno)\b/.test(tn)) return "abierto";
  return null;
}

/** Nivel con unidad en el texto («-100 dBm», «5 µV», «20 dB»), convertido a dBm. */
function nivelesEnTexto(texto: string, sensibilidad: number): number[] {
  const t = texto.replace(/−/g, "-");
  const aDbmU = (v: number, unidad: string) => {
    const u = unidad.toLowerCase();
    return u === "dbm" ? v : u === "db" ? v + sensibilidad : uvADbm(v);
  };
  const UNIDAD = "(dbm|µ\\s?v|uv|microvolt\\w*|db)\\b";
  // Rango con una sola unidad al final: «de -120 a -70 dBm»
  const rango = t.match(new RegExp(`(-?\\d{1,3}(?:[.,]\\d+)?)\\s*(?:dbm|db|µv|uv)?\\s*(?:a|y|hasta|–)\\s*(-?\\d{1,3}(?:[.,]\\d+)?)\\s*${UNIDAD}`, "i"));
  if (rango) return [aDbmU(num(rango[1]), rango[3]), aDbmU(num(rango[2]), rango[3])];
  return [...t.matchAll(new RegExp(`(-?\\d{1,3}(?:[.,]\\d+)?)\\s*${UNIDAD}`, "gi"))].map((m) => aDbmU(num(m[1]), m[2]));
}

function unidadEnTexto(texto: string, tn: string): UnidadId | null {
  if (/db\s*[µu]\s*v\s*\/\s*m|campo el[eé]ctrico|intensidad de campo/i.test(texto)) return "dbuvm";
  if (/[µ]\s?v\b|\buv\b|microvolt/i.test(texto)) return "uv";
  if (/\bdbm\b/.test(tn)) return "dbm";
  if (/\bmargen\b|\ben db\b|\bdecibel\w*/.test(tn)) return "margen";
  return null;
}

/* ───────────── Números, áreas, lugares y posiciones relativas ───────────── */

/** Minúsculas y sin tildes, conservando símbolos como «²» y «%». */
const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Número escrito en español: «11.226» y «1.500» (miles con punto), «1.234,5», «99,9», «99.9», «11 mil».
 * Un punto seguido de exactamente tres cifras es separador de miles, como se escribe en Colombia.
 */
export function leerNumero(s: string): number {
  const t = s.trim().replace(/\s+/g, " ");
  const mil = /\s*mil(es)?$/.test(t);
  const base = t.replace(/\s*mil(es)?$/, "");
  let v: number;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(base)) v = Number(base.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(,\d{3}){2,}(\.\d+)?$/.test(base)) v = Number(base.replace(/,/g, ""));
  else v = Number(base.replace(",", "."));
  return mil ? v * 1000 : v;
}

const NUMERO = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?:\s*(mil(?:es)?)\b)?`;
const UNIDAD_AREA = String.raw`(hectareas?|hectarias?|has?(?![a-z])|km\s?2(?![0-9])|km²|kms?\s+cuadrados?|kilometros?\s+cuadrados?|metros?\s+cuadrados?|m\s?2(?![0-9])|m²|fanegadas?|acres?)`;

function factorArea(unidad: string): number {
  const u = unidad.replace(/\s+/g, " ");
  if (/^h/.test(u)) return 1e4;
  if (/^(km|kms|kilometro)/.test(u)) return 1e6;
  if (/^fanegada/.test(u)) return 6400;
  if (/^acre/.test(u)) return 4046.86;
  return 1;
}

/** Área pedida en el texto (m²). Si después se corrige («11.000 ha… exactos 11.226»), vale la corrección. */
export function areaEnTexto(bajo: string): { m2: number; unidad: string } | null {
  const lista = [...bajo.matchAll(new RegExp(`${NUMERO}\\s*${UNIDAD_AREA}`, "g"))];
  if (!lista.length) return null;
  const ultimo = lista[lista.length - 1];
  const unidad = ultimo[3];
  let m2 = leerNumero(`${ultimo[1]}${ultimo[2] ? " mil" : ""}`) * factorArea(unidad);
  const resto = bajo.slice((ultimo.index ?? 0) + ultimo[0].length);
  const correccion = resto.match(new RegExp(`\\b(?:exact\\w*|en realidad|mejor dicho|o sea|perdon|corrijo|correccion|siendo precis\\w*|precisamente|en total)\\b[^0-9]{0,24}${NUMERO}(?!\\s*(?:%|por ciento|m\\b|metros|km\\b|kilometros|db|dbi|dbm|repetidor))`));
  if (correccion) m2 = leerNumero(`${correccion[1]}${correccion[2] ? " mil" : ""}`) * factorArea(unidad);
  return m2 > 0 ? { m2, unidad } : null;
}

/** «11.226 ha (112,26 km²)», «850 ha», «3,5 ha». */
export function textoArea(m2: number): string {
  const ha = m2 / 1e4;
  const haTxt = ha >= 100 ? Math.round(ha).toLocaleString("es-CO") : f1(ha, ha < 10 ? 1 : 0);
  const km2 = m2 / 1e6;
  return m2 >= 1e6 ? `${haTxt} ha (${f1(km2, km2 >= 100 ? 1 : 2).replace(/,0+$/, "")} km²)` : `${haTxt} ha`;
}

/** Lugar de Colombia nombrado en el texto («en Cumaral», «cerca de Puerto López», «en el Meta»). */
function lugarEnTexto(tn: string, api: Api): Lugar | null {
  const re = /\b(?:en|alrededor de|cerca de|junto a|sobre|por|del municipio de|municipio de|de)\s+(?:el municipio de |el pueblo de |la ciudad de |el departamento del? |el )?([a-z][a-z ]{2,48})/g;
  for (const m of tn.matchAll(re)) {
    const frase = m[1].split(/\s+(?:a|con|que|y|para|al|hacia|cubr\w*|con)\s+|\s+\d/)[0].trim();
    if (frase.length < 3 || /^(la|las|los|un|una|mi|su|este|esta|ese|esa|area|zona|mapa|campo|loma|lomas|casa|finca|punto|centro|red|malla|torre|altura|metros|km)\b/.test(frase)) continue;
    for (const l of api.buscarLugar(frase).slice(0, 6)) {
      const nombre = n(l.nombre);
      if (nombre.length >= 4 && new RegExp(`(^|[^a-z])${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z])`).test(tn)) return l;
    }
  }
  return null;
}

const RUMBOS = "norte|sur|este|oeste|oriente|occidente|noreste|noroeste|sureste|suroeste|nororiente|noroccidente|suroriente|suroccidente|sudeste|sudoeste";

/**
 * Posición relativa: «a 10 km al norte del gateway», «2 km al noreste de Repetidor 1», «a 500 m al sur de
 * 4.2, -73.37», «a 8 km del gateway hacia el oriente», «5 km al este de Cumaral».
 */
function relativaEnTexto(texto: string, tn: string, api: Api, antenas: Antena[], ultimo?: Antena): (Coordenada & { desde: string }) | null {
  const dist = String.raw`(\d+(?:[.,]\d+)?)\s*(km|kms|kilometros?|m|mts?|metros?)`;
  const a = tn.match(new RegExp(`${dist}\\s+(?:mas\\s+)?(?:al|hacia el|hacia|rumbo al?|en direccion al?)?\\s*(${RUMBOS})\\s+(?:de|del|desde)\\s+(.{2,60})`));
  const b = a ? null : tn.match(new RegExp(`${dist}\\s+(?:de|del|desde)\\s+(.{2,40}?)\\s+(?:al|hacia el|hacia|rumbo al?)\\s+(${RUMBOS})\\b`));
  // Sin punto de partida («un repetidor a 10 km al este»): desde el último nodo que se tocó o desde el gateway
  if (!a && !b) {
    const c = tn.match(new RegExp(`${dist}\\s+(?:mas\\s+)?(?:al|hacia el|hacia|rumbo al?|en direccion al?)\\s*(${RUMBOS})\\b(?!\\s+(?:de|del|desde)\\b)`));
    const desde = ultimo ?? antenas.find((x) => x.pasarela && x.activa);
    if (!c || !desde) return null;
    const metrosC = num(c[1]) * (/^k/.test(c[2]) ? 1000 : 1);
    const g = CARDINALES.find(([re]) => re.test(c[3]))?.[1];
    if (g === undefined || !(metrosC > 0) || metrosC > 200000) return null;
    const q = desplazar(desde.lat, desde.lon, metrosC, g);
    return { lat: q.lat, lon: q.lon, desde: `a ${formatoDistancia(metrosC)} al ${c[3]} de ${desde.nombre}` };
  }
  const metros = num((a ?? b)![1]) * (/^k/.test((a ?? b)![2]) ? 1000 : 1);
  const rumboTxt = a ? a[3] : b![4];
  const frase = ` ${a ? a[4] : b![3]} `;
  const grados = CARDINALES.find(([re]) => re.test(rumboTxt))?.[1];
  if (grados === undefined || !(metros > 0) || metros > 200000) return null;
  let base: { lat: number; lon: number; nombre: string } | null = null;
  const nodo = nodosMencionados(frase, antenas)[0] ?? piezaGenerica(frase, antenas, ultimo);
  if (nodo) base = { lat: nodo.lat, lon: nodo.lon, nombre: nodo.nombre };
  if (!base) {
    const c = extraerCoordenadas(texto);
    if (c) base = { lat: c.lat, lon: c.lon, nombre: "ese punto" };
  }
  if (!base) {
    const l = lugarEnTexto(`en${frase}`, api);
    if (l) base = { lat: l.lat, lon: l.lon, nombre: l.nombre };
  }
  if (!base) return null;
  const q = desplazar(base.lat, base.lon, metros, grados);
  return { lat: q.lat, lon: q.lon, desde: `a ${formatoDistancia(metros)} al ${rumboTxt} de ${base.nombre}` };
}

/**
 * «El repetidor», «la persona», «el gateway» sin nombre: el último que se tocó si es de ese tipo,
 * si no el último de ese tipo en la lista.
 */
function piezaGenerica(frase: string, antenas: Antena[], ultimo?: Antena): Antena | undefined {
  const tipo: Pieza | null = /\b(gateway|getway|internet|pasarela)\b/.test(frase)
    ? "gateway"
    : /^\s*(?:(?:desde|de|del|al)\s+)?(?:el\s+|ese\s+|este\s+)?(repetidor|router)\b(?!\s*\d)/.test(frase)
      ? "repetidor"
      : /^\s*(?:(?:desde|de|del)\s+)?(?:la\s+|esa\s+|esta\s+)?persona\b(?!\s*\d)/.test(frase)
        ? "persona"
        : null;
  if (!tipo) return undefined;
  if (ultimo && piezaDe(ultimo) === tipo) return ultimo;
  return [...antenas].reverse().find((a) => a.activa && piezaDe(a) === tipo);
}

/** Coordenada del pedido: relativa («a 10 km al norte del gateway»), escrita, o el centro de un lugar nombrado. */
function ubicacionEnTexto(texto: string, tn: string, api: Api, antenas: Antena[], conLugar: boolean): (Coordenada & { desde?: string }) | null {
  const rel = relativaEnTexto(texto, tn, api, antenas);
  if (rel) return rel;
  const c = extraerCoordenadas(texto);
  if (c) return c;
  if (!conLugar) return null;
  const l = lugarEnTexto(tn, api);
  return l ? { lat: l.lat, lon: l.lon, desde: `en ${l.nombre}${l.tipo === "municipio" ? ` (${l.detalle})` : ""}` } : null;
}

/* ───────────── Diseño de la malla por área ───────────── */

const UMBRALES_SENAL: [RegExp, number][] = [
  [/\bbuenas?\b/, 45],
  [/\bestables?\b/, 37],
  [/\bconfiables?\b/, 37],
  [/\bmedias?\b/, 30],
  [/\bbajas?\b/, 20],
  [/\b(con servicio|servicio minimo|cualquier senal|minima)\b/, 20],
];

/** Calidad de señal pedida: el mínimo de las clases nombradas («entre buena, estable y media» → media, 30 dB). */
function margenPedido(tn: string): { margenDb: number; clases: string } {
  const i = tn.search(/\b(senal|calidad|nivel|clase|cobertura|margen)\b/);
  const zona = i >= 0 ? tn.slice(i) : tn;
  const db = zona.match(/\b(\d{1,2})\s*db\b/);
  if (db && /\b(margen|al menos|minimo|sobre|mayor|mas de)\b/.test(zona)) {
    const v = Math.min(60, Math.max(10, Number(db[1])));
    return { margenDb: v, clases: `margen de al menos ${v} dB` };
  }
  const halladas = UMBRALES_SENAL.filter(([re]) => re.test(zona)).map(([, v]) => v);
  const m = halladas.length ? Math.min(...halladas) : 30;
  const clases = m >= 45 ? "señal buena (≥ 45 dB)" : m >= 37 ? "señal estable o mejor (≥ 37 dB)" : m >= 30 ? "señal media o mejor (buena, estable o media; ≥ 30 dB)" : "servicio (≥ 20 dB)";
  return { margenDb: m, clases };
}

/**
 * Ajuste inteligente: «ajústamelo», «optimiza la red», «hazla factible», «mejora la cobertura al menor costo»,
 * «¿qué necesito para que sea factible?», con límites («sin pasar de 20 m», «máximo 3 antenas de apoyo», «no muevas
 * los nodos», «solo alturas») y sitios dados («las antenas de apoyo pueden ir en 4.51, -73.12; 4.6, -73.05»).
 */
function interpretarAjuste(texto: string, tn: string, antenas: Antena[]): Orden | null {
  const verbo =
    /\b(ajust(a|ala|alo|ame|amela|amelo|ar|arla|arlo|en|e)|reajust\w*|optimiz\w*|hazla factible|hacerla factible|volverla factible|vuelvela factible|dejala factible|dejarla factible|(que|para que) (sea|quede) (factible|viable)|mejor(a|ar|e|ame|amela|ala) (la |mi )?(red|malla|cobertura)|mejor relacion|relacion (costo|cobertura)|costo[- ]?beneficio|(al|con el) menor costo|menos costo|mas economic\w*|(que|lo que) (le )?falta para (ser|que sea|quedar) (factible|viable)|que necesit\w* para (ser|que sea|hacerla|dejarla|que quede) (factible|viable)|como (la )?(hago|dejo|vuelvo|pongo) (factible|viable)|antenas? de apoyo|apoyos?\b.*\b(sugi\w*|propon\w*|donde)|(sugi\w*|propon\w*|recomiend\w*) (antenas|puntos|sitios|apoyos|donde poner))\b/;
  // «Dame la mayor cobertura posible» es pedir la opción de máxima cobertura; «¿cómo dejo la mayor cobertura posible?»
  // pide consejos (los da el cerebro, con el botón para proponerla)
  const pideMaxima =
    /\b(dame|dejame|dejala|dejamela|pon\w*|hazme|hazla|busca\w*|consigue\w*|logra\w*|saca\w*|quiero|lleva\w*) (la red (a|con) )?(la )?(mayor|maxima|mejor) cobertura( posible)?\b/.test(tn) &&
    !/\b(como|recomiend\w*|recomendacion\w*|consejos?|que hago|que necesito|que debo)\b/.test(tn) &&
    !texto.includes("?");
  if (!verbo.test(tn) && !pideMaxima) return null;
  // No es el ajuste de la red: la vista, un parámetro o un nodo con su altura
  if (/\b(vista|pantalla|zoom|encuadr\w*|centra\w*|muestrame toda|ver toda)\b/.test(tn)) return null;
  if (/\b(radio de estudio|confiabilidad|preset|frecuencia|limite de saltos|hop|potencia|ganancia|altura del receptor|escala|unidad|opacidad|capa)\b/.test(tn)) return null;
  const nombrado = nodosMencionados(tn, antenas)[0];
  if (nombrado && /\b\d{1,2}(?:[.,]\d+)?\s*(m|mts?|metros?|dbi|dbm)\b/.test(tn) && !/\b(sin pasar de|maximo|max|hasta|no mas de|como mucho)\b/.test(tn)) return null;

  const pregunta = /\b(que necesit\w*|que (le )?falta|como (la )?(hago|dejo|vuelvo|pongo)|propon\w*|sugi\w*|recomiend\w*|muestr\w*|ensen\w*|que opciones|cuales opciones|como quedaria|que harias|que me recomiendas|donde (pongo|pondria|irian|van))\b/.test(tn) || texto.trim().startsWith("¿") || /\?\s*$/.test(texto);
  const opcion: OpcionAjusteId = /\b(mas economic\w*|la economica|lo minimo|lo mas barato|mas barat\w*|minimo indispensable)\b/.test(tn)
    ? "economica"
    : /\b(maxima cobertura|cobertura maxima|mayor cobertura|la maxima|cubr\w* (todo|lo maximo|al maximo|lo mas posible)|la mejor cobertura|toda la cobertura posible|lo maximo posible)\b/.test(tn)
      ? "maxima"
      : "recomendada";
  const avisos: string[] = [];
  const opciones: OpcionesAjuste = {};
  const alto = tn.match(/\b(?:sin pasar de|maximo|max|hasta|no mas de|como mucho|menos de|de maximo)\s+(?:de\s+)?(\d{1,3})\s*(?:m|mts?|metros?)\b/);
  if (alto) {
    const h = Number(alto[1]);
    if (h > 30) avisos.push(`Más de 30 m no lo propongo: exige torres autosoportadas, mucho más costosas; trabajo con hasta 30 m.`);
    opciones.alturaMaxM = Math.max(6, Math.min(30, h));
  }
  const cuantas = tn.match(/\b(?:maximo|max|no mas de|hasta|como mucho|con)\s+(?:de\s+)?(\d{1,2}|una|un|dos|tres|cuatro|cinco)\s+(?:antenas?|apoyos?|repetidor\w*|nodos?)(?: de apoyo)?\b/);
  if (cuantas) {
    const v = { una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 }[cuantas[1] as "una"] ?? Number(cuantas[1]);
    opciones.maxApoyos = Math.max(0, Math.min(40, v));
  }
  const permisos: OpcionesAjuste["permisos"] = {};
  if (/\b(no (muevas|mueva|movamos|corras|cambies de sitio)|sin mover|dejalos (donde estan|en su sitio)|en el mismo sitio)\b/.test(tn)) permisos.mover = false;
  if (/\b(sin (antenas de )?apoyos?|sin agregar|no agregues|no pongas (mas|nuevas)|sin (mas|nuevas) antenas|sin nodos nuevos|con lo que (hay|tengo))\b/.test(tn)) permisos.apoyos = false;
  if (/\b(no (cambies|toques) (las |el tipo de |los tipos de )?antenas?|sin (antenas )?sectoriales|solo omni\w*)\b/.test(tn)) permisos.antenas = false;
  if (/\b(sin subir|no subas|no cambies las alturas|sin cambiar (las )?alturas|misma altura)\b/.test(tn)) permisos.alturas = false;
  if (/\bsolo (con |subiendo |cambiando )?(las )?(alturas?|torres)\b/.test(tn)) Object.assign(permisos, { apoyos: false, mover: false, antenas: false, alturas: true });
  if (/\bsolo (con )?(antenas de )?apoyos?\b/.test(tn)) Object.assign(permisos, { apoyos: true, mover: false, antenas: false, alturas: false });
  if (Object.keys(permisos).length) opciones.permisos = permisos;
  // Sitios dados: coordenadas en el pedido («las antenas de apoyo pueden ir en …», «usa estos puntos …»)
  const coords = extraerVariasCoordenadas(texto);
  if (coords.length && /\b(apoyo|sitios?|puntos?|fincas?|coordenadas|lugares|ubicaciones|pueden ir|podrian ir|disponibles|posibles)\b/.test(tn)) {
    opciones.sitios = coords.map((c, i) => ({ lat: c.lat, lon: c.lon, nombre: `el sitio ${i + 1}` }));
  }
  return { tipo: "ajustar", aplicar: !pregunta, opcion, opciones, avisos };
}

/** «Usa el área que medí como área objetivo», «mide la factibilidad en esa área», «quita el área objetivo». */
function interpretarAreaObjetivo(texto: string, tn: string, api: Api): Orden | null {
  if (/\b(quita\w*|borra\w*|elimina\w*|sin)\b.*\barea objetivo\b|\b(evalua|mide|medir) (la factibilidad )?en (toda )?el area de estudio\b/.test(tn)) return { tipo: "area-objetivo", quitar: true };
  const fijar =
    /\barea objetivo\b/.test(tn) && /\b(usa|usar|pon|poner|marca|marcar|toma|tomar|deja|dejar|es|sea|como)\b/.test(tn) ||
    /\b(mide|medir|evalua|evaluar|calcula) (la )?(factibilidad|cobertura) (en|sobre|dentro de) (el|esta|esa|la) (area|zona|poligono)\b/.test(tn);
  if (!fijar) return null;
  const m = [...api.mediciones()].reverse().find((x) => x.tipo === "area");
  const pct = texto.toLowerCase().match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:%|por ciento)/);
  const { margenDb } = margenPedido(tn);
  return { tipo: "area-objetivo", quitar: false, id: m?.id, metaPct: pct ? Math.min(100, Math.max(1, leerNumero(pct[1]))) : undefined, margenDb };
}

/** «Vuélveme a hacerlo», «rehazlo», «hazlo de nuevo», «otra vez»: repetir el diseño (con otra meta o área). */
const REHACER = /\b(vuelve\w* a hacer\w*|volver a hacer\w*|rehac\w*|rehaz\w*|haz\w* de nuevo|hacerlo de nuevo|de nuevo el diseno|otra vez el diseno)\b/;

function interpretarDiseno(texto: string, tn: string, api: Api, antenas: Antena[]): Orden | null {
  const rehacer = REHACER.test(tn);
  if (!rehacer && !/\b(cubr\w*|cobertura|abarc\w*|red|malla|repetidor\w*|senal|disen\w*|arm\w*|planific\w*|cuant\w* (repetidores|nodos|antenas))\b/.test(tn)) return null;
  const bajo = sinTildes(texto);
  const area = areaEnTexto(bajo);
  const verboFuerte = /\b(cubr\w*|abarc\w*|cobertura|disen\w*|arm\w*|planific\w*)\b/.test(tn);
  const radio = verboFuerte ? bajo.match(/\b(?:radio de|en un radio de)\s*(\d+(?:[.,]\d+)?)\s*(km|kilometros?|m|metros?)\b|(\d+(?:[.,]\d+)?)\s*(km|kilometros?|m|metros?)\s*(?:de radio|a la redonda)/) : null;
  const rect = bajo.match(/(\d+(?:[.,]\d+)?)\s*(km|kilometros?|m|metros?)?\s*(?:por|x)\s*(\d+(?:[.,]\d+)?)\s*(km|kilometros?|m|metros?)\b/);
  const lado = bajo.match(/cuadrad\w*\s+de\s+(\d+(?:[.,]\d+)?)\s*(km|kilometros?|m|metros?)\s+(?:de lado|por lado)/);
  const medida = (/\b(area|zona|poligono)\b.{0,30}\b(medi|medida|medido|dibuj\w*|marq\w*|traz\w*)\b|\b(area|zona|poligono)\b.{0,20}\bregla\b/.test(tn) || /\bcubr\w* (esta|esa|el|la) (area|zona|poligono)\b(?! de)/.test(tn));
  if (!area && !radio && !(rect && verboFuerte) && !lado && !medida) return null;
  if (!verboFuerte && !rehacer && !/\b(red|malla|repetidor\w*|cuant\w* (repetidores|nodos|antenas))\b/.test(tn)) return null;

  const metros = (v: string, u?: string) => num(v) * (u && /^k/.test(u) ? 1000 : 1);
  let pedida: AreaPedida | null = null;
  const pcts = [...bajo.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*(?:%|por ciento)/g)].map((m) => leerNumero(m[1])).filter((v) => v > 0 && v <= 100);
  const porcentaje = pcts.length ? pcts[pcts.length - 1] : 95;
  const { margenDb, clases } = margenPedido(tn);
  const respaldo = /\b(respaldo|redundan\w*|doble cobertura|dos nodos|dos repetidores por punto)\b/.test(tn);
  const altura = tn.match(/\b(?:repetidor\w*|torres?|mastiles?)\s+(?:de|a|con|en)\s+(\d{1,2}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b/) ?? tn.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\s+de altura\b/);
  // Como en Trama: el repetidor va en un tubo de 6 m salvo que se pida otra altura
  const alturaM = altura ? Math.min(60, Math.max(3, num(altura[1]))) : ALTURA_REPETIDOR_DEFECTO;
  const maxTxt = tn.match(/\b(?:maximo|max|no mas de|hasta|como mucho)\s+(?:de\s+)?(\d{1,3})\s+(?:repetidores|repetidoras|torres|nodos)\b/);
  const maxRepetidores = maxTxt ? Math.min(200, Math.max(1, Number(maxTxt[1]))) : 60;

  // Gateway en un punto pedido («con el gateway en 4.2, -73.37»)
  let gateway: Coordenada | null = null;
  const tramoGw = tn.match(/\b(?:gateway|getway|internet|starlink)\s+(?:en|ubicad[oa] en|queda en|esta en|sobre)\b/);
  if (tramoGw) gateway = extraerCoordenadas(texto.slice(Math.max(0, (tramoGw.index ?? 0) - 2)));

  // Rehacer sobre el área objetivo que ya está (del mismo tamaño): se diseña sobre ella, no sobre un círculo nuevo
  const objetivoIgual = rehacer && area ? [...api.mediciones()].reverse().find((x) => x.tipo === "area" && x.objetivo && Math.abs(areaM2(x.puntos) / area.m2 - 1) < 0.08) : undefined;
  if (objetivoIgual) pedida = { forma: "medicion", id: objetivoIgual.id };
  else if (medida && !area && !radio && !rect && !lado) {
    const m = [...api.mediciones()].reverse().find((x) => x.tipo === "area");
    if (m) pedida = { forma: "medicion", id: m.id };
    else return { tipo: "disenar", area: { forma: "medicion", id: "" }, margenDb, clases, porcentaje, respaldo, alturaM, gateway, maxRepetidores };
  } else {
    // Centro del área
    let centro: CentroArea;
    const u: (Coordenada & { desde?: string }) | null = gateway ? { ...gateway, desde: "alrededor del gateway" } : ubicacionEnTexto(texto, tn, api, antenas, true);
    if (u) centro = { tipo: "coord", coord: { lat: u.lat, lon: u.lon }, nombre: u.desde };
    else if (antenas.some((a) => a.pasarela && a.activa)) centro = { tipo: "gateway" };
    else centro = { tipo: "mapa" };
    if (lado) {
      const l = metros(lado[1], lado[2]);
      pedida = { forma: "cuadrado", areaM2: l * l, anchoM: l, altoM: l, centro };
    } else if (rect && !area) {
      const a1 = metros(rect[1], rect[2] ?? rect[4]);
      const a2 = metros(rect[3], rect[4]);
      pedida = { forma: "rectangulo", areaM2: a1 * a2, anchoM: a1, altoM: a2, centro };
    } else if (radio && !area) {
      const r = metros(radio[1] ?? radio[3], radio[2] ?? radio[4]);
      pedida = { forma: "circulo", areaM2: Math.PI * r * r, centro };
    } else if (area) {
      const cuadrado = /\bcuadrad\w*/.test(tn);
      pedida = cuadrado ? { forma: "cuadrado", areaM2: area.m2, anchoM: Math.sqrt(area.m2), altoM: Math.sqrt(area.m2), centro } : { forma: "circulo", areaM2: area.m2, centro };
    }
  }
  if (!pedida) return null;
  return { tipo: "disenar", area: pedida, margenDb, clases, porcentaje, respaldo, alturaM, gateway, maxRepetidores };
}

/* ───────────── Órdenes en lote, capas del mapa y otras de la pantalla ───────────── */

function interpretarLote(texto: string, tn: string, antenas: Antena[]): Orden | null {
  const g = tn.match(/\btod[oa]s\s+(?:l[oa]s\s+)?(repetidores|repetidoras|personas|gente|nodos de campo|nodos antena|antenas|nodos|torres|gateways|piezas)\b/);
  const menosGateway = /\btodo menos (el|los) gateways?\b|\btodos? (los nodos )?(excepto|menos) (el|los) gateways?\b/.test(tn);
  if (!g && !menosGateway) return null;
  const grupo = g?.[1] ?? "menos-gateway";
  const activas = antenas;
  const ids = activas
    .filter((a) => {
      const p = piezaDe(a);
      if (grupo === "menos-gateway") return p !== "gateway";
      if (/^(repetidor|torres)/.test(grupo)) return p === "repetidor";
      if (/^(personas|gente|nodos de campo)$/.test(grupo)) return (a.tipo ?? "antena") === "nodo";
      if (/^(antenas|nodos antena)$/.test(grupo)) return (a.tipo ?? "antena") === "antena";
      if (grupo === "gateways") return a.pasarela;
      return true;
    })
    .map((a) => a.id);
  const nombre = grupo === "menos-gateway" ? "todos los nodos menos el gateway" : `${/^(personas|gente|antenas|torres|piezas)$/.test(grupo) ? "todas las" : "todos los"} ${grupo === "gente" ? "personas" : grupo}`;
  if (/\b(borra\w*|elimina\w*|quita\w*|saca\w*|suprim\w*)\b/.test(tn) && !/\bpasarela\b/.test(tn)) return { tipo: "eliminar-varios", ids, descripcion: nombre };
  const alturaTxt = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b/i);
  if (alturaTxt && /\b(sube|subir|subelos|baja|bajar|bajalos|pon\w*|cambia\w*|deja\w*|altura)\b/.test(tn)) {
    const h = Math.min(300, Math.max(0.5, num(alturaTxt[1])));
    return { tipo: "editar-varios", ids, cambios: { alturaM: h }, descripcion: `${nombre} quedan a ${fn(h)} m` };
  }
  if (/\b(desactiv\w*|exclu\w*|apaga\w*)\b/.test(tn)) return { tipo: "editar-varios", ids, cambios: { activa: false }, descripcion: `${nombre} quedan fuera de la simulación` };
  if (/\b(activ\w*|inclu\w*|enciend\w*|prende\w*)\b/.test(tn)) return { tipo: "editar-varios", ids, cambios: { activa: true }, descripcion: `${nombre} vuelven a la simulación` };
  const rol = rolEnTexto(tn);
  if (rol) return { tipo: "editar-varios", ids, cambios: { rol }, descripcion: `${nombre} quedan como ${rol === "REPETIDOR" ? "repetidores" : rol === "ROOM_SERVER" ? "room server" : "companion (no retransmiten)"}` };
  return null;
}

/** Rol MeshCore en el texto («como repetidor», «que no retransmita», «room server»); acepta también los nombres viejos. */
function rolEnTexto(tn: string): Rol | null {
  if (!/\b(rol|como|modo|sea|sean|retransmit\w*)\b/.test(tn)) return null;
  if (/\b(room ?server|servidor de sala|sala de mensajes|tablero)\b/.test(tn)) return "ROOM_SERVER";
  if (/\b(companion|compania|billetera|client ?mute|cliente mudo|mudo|mudos|silencios\w*|no retransmit\w*|cliente|clientes|client)\b/.test(tn)) return "COMPANION";
  if (/\b(repetidor|repeater|router|enrutador|retransmisor|retransmit\w*)\b/.test(tn)) return "REPETIDOR";
  return null;
}

function equipoEnTexto(tn: string): EquipoId | null {
  if (!/\bequipo\b|\bradio portatil\b|\bnodo solar\b|\bp1\b|\bt1000\b|\bt114\b|\bxiao\b|\bbilletera\b|\btarjeta\b/.test(tn)) return null;
  if (/\b(t1000|tarjeta|sensecap t1000)\b/.test(tn)) return "t1000";
  if (/\b(xiao|billetera|portatil|de mano|handy)\b/.test(tn)) return "xiao";
  if (/\b(t114|heltec|radio del gateway)\b/.test(tn)) return "t114-8dbi";
  if (/\b(p1|solar|fibra|8 ?dbi|repetidor solar)\b/.test(tn)) return "p1-8dbi";
  return null;
}

/**
 * «Pantalla limpia», «deja solo el mapa», «oculta los paneles», «cierra el panel izquierdo», «oculta los resultados»,
 * «muestra los paneles», «abre el panel de resultados».
 */
export function interpretarPaneles(tn: string): Orden | null {
  const ocultar = /\b(oculta\w*|esconde\w*|quita\w*|cierra\w*|pliega\w*|recoge\w*|minimiza\w*|colapsa\w*|sin)\b/.test(tn);
  const mostrar = /\b(muestra\w*|mostrar|abre|abrir|despliega\w*|vuelve\w*|pon\w*|devuelve\w*|quiero ver|ver)\b/.test(tn);
  if (/\b(pantalla limpia|limpia la pantalla|limpiar la pantalla|despeja\w* (la pantalla|el mapa)|solo el mapa|solamente el mapa|mapa (completo|a pantalla completa|grande)|pantalla completa|modo limpio|sin paneles)\b/.test(tn) && !/\b(muestra|abre|vuelve)\w* (los )?paneles\b/.test(tn))
    return { tipo: "paneles", izquierdo: false, derecho: false };
  const izquierdo = /\b(panel (izquierdo|de la izquierda|lateral|de herramientas)|barra (izquierda|de la izquierda|lateral|de herramientas)|herramientas de la izquierda)\b/.test(tn);
  const derecho = /\b(panel (derecho|de la derecha|de resultados?)|barra (derecha|de la derecha)|(el|los) resultados?)\b/.test(tn);
  const ambos = /\b(los paneles|ambos paneles|los dos paneles|paneles|las barras)\b/.test(tn);
  if (!izquierdo && !derecho && !ambos) return null;
  // «muestra los resultados» sin la palabra panel es pedir el resumen, no el panel
  if (!izquierdo && !ambos && derecho && !/\bpanel\b/.test(tn) && !ocultar) return null;
  if (!ocultar && !mostrar) return null;
  const valor = !ocultar;
  if (ambos && !izquierdo && !derecho) return { tipo: "paneles", izquierdo: valor, derecho: valor };
  return { tipo: "paneles", ...(izquierdo ? { izquierdo: valor } : {}), ...(derecho ? { derecho: valor } : {}) };
}

function interpretarPantalla(tn: string): Orden | null {
  if (PREGUNTA.test(tn) && !/\b(puedes|podrias)\b/.test(tn)) return null;
  // Simular al cambiar
  if (/\b(simular al cambiar|simulacion automatica|calculo automatico|simule solo|calcule solo|simula sol[oa]|calcula sol[oa])\b/.test(tn)) {
    if (/\b(desactiva\w*|apaga\w*|quita\w*|no|deten\w*|para)\b/.test(tn)) return { tipo: "auto", valor: false };
    return { tipo: "auto", valor: true };
  }
  // Relieve: real (teselas de elevación) o terreno plano
  if (/\b(terreno plano|sin relieve|relieve plano|tierra plana)\b/.test(tn) && !/\b(alcance|referencia)\b/.test(tn)) return { tipo: "relieve", valor: "plano" };
  if (/\b(relieve real|con relieve|terreno real|elevacion real|usa el relieve|usa la elevacion)\b/.test(tn)) return { tipo: "relieve", valor: "teselas" };
  // Ver toda la red
  if (/\b(muestrame|ensename|ver|veo|encuadra\w*|ajusta\w*|centra\w*|zoom)\b.*\b(toda la (red|malla)|todos los nodos|todas las antenas|todo)\b/.test(tn) && !/\b(antena|nodo|repetidor|persona) \d/.test(tn))
    return { tipo: "encuadrar" };
  const on = /\b(muestra\w*|mostrar|activa\w*|enciende|prende|pon\w*|quiero ver|ver|ensena\w*|agrega\w*)\b/.test(tn);
  const off = /\b(quita\w*|oculta\w*|apaga\w*|esconde\w*|desactiva\w*|sin|no quiero ver)\b/.test(tn);
  // Fondo del mapa
  if (/\b(mapa|fondo|vista|capa|base)\b/.test(tn) && (on || /\b(cambia\w*|usa\w*)\b/.test(tn))) {
    const fondo = /\b(satelit\w*|imagenes satelitales|satelite)\b/.test(tn)
      ? "satelite"
      : /\bopentopomap|curvas de nivel\b/.test(tn)
        ? "opentopomap"
        : /\btopografic\w*/.test(tn)
          ? "topografico"
          : /\b(calles|callejero|openstreetmap|osm|carreteras)\b/.test(tn) && /\bmapa de\b/.test(tn)
            ? "calles"
            : null;
    if (fondo) return { tipo: "vista", cambios: { fondo }, descripcion: { satelite: "se ve con imágenes satelitales", topografico: "se ve con el mapa topográfico", opentopomap: "se ve con OpenTopoMap (curvas de nivel, ríos y quebradas)", calles: "se ve con el mapa de calles" }[fondo] };
  }
  if (!on && !off) return null;
  // Con cantidades («radio de 12 km», «20 m», «-100 dBm») es un parámetro o un nodo, no una capa
  if (/\d\s*(km|kilometros?|m|metros?|db|dbm|dbi|mhz)\b/.test(tn)) return null;
  const valor = !off;
  const capas: [RegExp, keyof CambiosVista, string][] = [
    [/\b(vias|carreteras|caminos|trochas)\b/, "refVias", "las vías"],
    [/\b(rios|quebradas|cauces)\b/, "refRios", "los ríos"],
    [/\b(limites|division politica|municipios|departamentos|fronteras)\b/, "refDivision", "los límites de municipios y departamentos"],
    [/\b(nombres|etiquetas|poblados|pueblos|veredas)\b/, "refNombres", "los nombres de poblados y lugares"],
    [/\benlaces\b/, "mostrarEnlaces", "los enlaces entre nodos"],
    [/\b(alcance|rango de alcance|contorno\w*)\b/, "mostrarAlcance", "el rango de alcance"],
    [/\b(circulos|circulos de estudio)\b/, "mostrarCirculos", "los círculos de estudio"],
    [/\b(3d|tres dimensiones|relieve en 3d|relieve 3d)\b/, "relieve3d", "el relieve en 3D"],
    [/\b(zonas? sin servicio|areas? sin servicio|lo rojo)\b/, "mostrarSinServicio", "las zonas sin servicio"],
    [/\banillos\b/, "mostrarAnillos", "los anillos de distancia"],
    [/\b(haces|direccion de las antenas)\b/, "mostrarHaces", "la dirección de las antenas direccionales"],
  ];
  const cambios: CambiosVista = {};
  const partes: string[] = [];
  for (const [re, clave, nombre] of capas) {
    if (!re.test(tn)) continue;
    (cambios as Record<string, unknown>)[clave] = valor;
    partes.push(nombre);
  }
  // Modo del mapa de cobertura
  if (valor && /\b(mejor antena|mejor servidor|quien atiende|que antena atiende|servidor)\b/.test(tn)) {
    cambios.modo = "servidor";
    partes.push("cuál nodo antena atiende cada zona");
  } else if (valor && /\b(mapa|modo|ver|muestra\w*)\b.*\b(respaldo|redundancia)\b/.test(tn)) {
    cambios.modo = "redundancia";
    partes.push("el respaldo (cuántos nodos antena llegan a cada punto)");
  } else if (valor && /\b(mapa|modo) de (la )?senal\b/.test(tn)) {
    cambios.modo = "senal";
    partes.push("el mapa de señal");
  }
  const op = tn.match(/\b(opacidad|transparencia)\b\D{0,14}(\d{1,3})\s*%?/);
  if (op) {
    const v = Math.min(100, Math.max(5, Number(op[2]))) / 100;
    cambios.opacidad = op[1] === "transparencia" ? Math.max(0.05, 1 - v) : v;
    partes.push(`la cobertura con ${Math.round((cambios.opacidad ?? 0) * 100)} % de opacidad`);
  }
  if (!partes.length) return null;
  return { tipo: "vista", cambios, descripcion: `${valor ? "ahora muestra" : "ya no muestra"} ${partes.join(", ")}` };
}

/* ───────────── Varias órdenes en un mensaje ───────────── */

const VERBO_PASO =
  "pon|ponme|ponle|agrega|agregale|anade|crea|creame|inscribe|registra|instala|mueve|muevelo|muevela|borra|borralo|elimina|quita|quitale|sube|subelo|subela|baja|bajalo|bajala|cambia|cambiale|renombra|llama|llamalo|simula|calcula|envia|manda|conecta|siembra|lleva|muestra|muestrame|activa|desactiva|exporta|descarga|usa|marca|apunta|dale|haz|abre|ve|llevame|mide|cubre|arma|armame|disena|ponlo|ponla";

/** Divide un mensaje con varias órdenes: «pon el gateway en X, luego un repetidor a 10 km al norte y simula». */
/** Los verbos se reconocen con o sin tilde («súbela», «envía»). */
const VERBOS_PASO = VERBO_PASO.replace(/[aeiou]/g, (v) => `[${v}${{ a: "á", e: "é", i: "í", o: "ó", u: "ú" }[v]}]`);

export function dividirEnPasos(texto: string): string[] {
  const t = texto.replace(/\s+/g, " ").trim();
  // No se corta dentro de comillas
  const protegido = t.replace(/["“«][^"”»]*["”»]/g, (m) => m.replace(/[,;.]/g, (c) => ({ ",": "\u0001", ";": "\u0002", ".": "\u0003" })[c]!));
  const corte = new RegExp(
    String.raw`\s*;\s*|\.\s+(?=\S)|,?\s+(?:y\s+)?(?:luego|despues|después|a continuacion|a continuación|enseguida|por ultimo|por último|finalmente|al final)\s*,?\s+|,?\s+y\s+(?:tambien\s+|además\s+|ademas\s+)?(?=(?:${VERBOS_PASO})\b)|,\s+(?=(?:${VERBOS_PASO})\b)|(?:,\s*|\s+y\s+)(?=(?:un|una|otro|otra)\s+(?:repetidor|repetidora|persona|gateway|nodo|antena)\b)`,
    "giu",
  );
  const pasos = protegido
    .split(corte)
    .map((p) => p.replace(/[\u0001]/g, ",").replace(/[\u0002]/g, ";").replace(/[\u0003]/g, ".").replace(/^[,.;\s]+|[,.;\s]+$/g, "").trim())
    .filter((p) => p.length >= 3);
  return pasos.length ? pasos : [t];
}

/* ───────────── Interpretación ───────────── */

const VERBO_AGREGAR = /\b(inscrib\w*|registr\w*|agreg\w*|anad\w*|adicion\w*|ingres\w*|instal\w*|coloc\w*|crea|crear|creame|crealo|pon|poner|ponme|monta\w*|ubica (?:una|un|otra|otro)|ubicar (?:una|un|otra|otro)|nuev[oa]|mete|meter|incorpor\w*)\b/;
const OBJETO = /\b(antena|antenas|nodo|nodos|torre|repetidor|pasarela|router|sensor|equipo)\b/;

/** Contexto de la conversación: el último nodo que Melki puso o cambió («súbelo a 20 m»). */
export type ContextoOrden = { ultimoNodo?: string | null };

const CLITICO =
  /\b(subelo|subela|bajalo|bajala|muevelo|muevela|borralo|borrala|eliminalo|eliminala|quitalo|quitala|renombralo|renombrala|llamalo|llamala|apuntalo|apuntala|conviertelo|conviertela|activalo|activala|desactivalo|desactivala|ponle|dale|cambiale|subele|bajale|quitale|agregale|dejalo|dejala|elevalo|elevala|trasladalo|trasladala|reubicalo|reubicala|giralo|girala|inclinalo|inclinala|ese (nodo|repetidor|gateway|equipo)|este (nodo|repetidor|gateway|equipo)|esa (persona|antena|torre)|esta (persona|antena|torre))\b/;

export function interpretarOrden(texto: string, api: Api, pendiente: Pendiente, contexto: ContextoOrden = {}): Orden | null {
  const tn = n(texto);
  if (!tn) return null;
  const antenas = api.antenas();
  const ultimo = contexto.ultimoNodo ? antenas.find((x) => x.id === contexto.ultimoNodo) : undefined;
  // «Mueve Repetidor 1 2 km al sur»: la distancia se cuenta desde ese mismo nodo
  const movido = /\b(mueve|mover|muevelo|muevela|traslad\w*|reubic\w*|desplaz\w*|corre|correlo)\b/.test(tn) ? nodosMencionados(tn, antenas)[0] : undefined;
  const coord: Coordenada | null = relativaEnTexto(texto, tn, api, antenas, movido ?? ultimo) ?? extraerCoordenadas(texto);
  const sel = api.seleccion();

  if (/\b(deshace\w*|deshaz|revierte|revertir|anula lo ultimo)\b/.test(tn)) return null; // lo maneja Melki (necesita la instantánea)
  const paneles = interpretarPaneles(tn);
  if (paneles) return paneles;

  // Completar un pedido que esperaba coordenadas
  if (pendiente && coord && !OBJETO.test(tn.replace(/\b(en|a)\b/g, ""))) {
    if (pendiente.tipo === "agregar") return { tipo: "agregar", datos: pendiente.datos, coord };
    if (pendiente.tipo === "mover") return { tipo: "mover", id: pendiente.id, coord };
    if (pendiente.tipo === "pieza") return { tipo: "pieza", pieza: pendiente.pieza, datos: pendiente.datos, coord };
  }
  if (pendiente && coord) {
    if (pendiente.tipo === "agregar" && !VERBO_AGREGAR.test(tn)) return { tipo: "agregar", datos: { ...pendiente.datos, ...datosNodo(texto, tn) }, coord };
  }

  if (/\b(borra|borrar|elimina|eliminar|quita|quitar)\b.*\b(medicion|mediciones|regla|medidas)\b/.test(tn)) return { tipo: "borrar-mediciones" };
  if (/\b(nuevo escenario|escenario nuevo|empezar de cero|empieza de cero|empecemos de cero|empezamos de cero|desde cero|borra todo|borrar todo|limpia todo|limpiar todo|limpia el mapa|quita todo|vacia el mapa|vaciar el mapa|vacia todo)\b/.test(tn)) return { tipo: "nuevo" };
  if (/\b(carga\w*|muestra\w*|abre|abrir|ver|pon)\b.*\b(ejemplo|demostracion|demo)\b/.test(tn)) return /\b(malla|sembr\w*|siembra|trama|gateway|repetidor\w*|personas?|gente)\b/.test(tn) ? { tipo: "ejemplo-malla" } : { tipo: "ejemplo" };

  const nombreEsc = texto.match(/(?:(?:ll[aá]ma|nombra|renombra|ponle (?:de )?nombre|nombre)\s+(?:al|el)\s+escenario|escenario\s+(?:se llama|llamado))\s*(?:como|a|:)?\s*["“«]?([^"”»]{2,60}?)["”»]?\s*$/i);
  if (nombreEsc) return { tipo: "nombre-escenario", nombre: nombreEsc[1].trim() };
  const recep = texto.match(/(?:ganancia del? receptor|receptor (?:con|de))\D{0,14}(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
  if (recep) return { tipo: "parametros", cambios: { gananciaRxDbi: num(recep[1]) }, descripcion: `la ganancia del receptor a ${recep[1]} dBi` };

  // Agente: cobertura del área medida, diseño por área, órdenes en lote y vista del mapa
  if (/\b(cuanto|que porcentaje|que %|como (queda|esta|va)|que tanto)\b.*\b(cubr\w*|cobertura|senal)\b.*\b(area|zona|poligono)\b/.test(tn)) {
    const m = [...api.mediciones()].reverse().find((x) => x.tipo === "area");
    if (m) return { tipo: "cobertura-area", id: m.id, margenDb: margenPedido(tn).margenDb };
  }
  const capacidad = interpretarCapacidad(texto, tn, api);
  // «Rehaz el diseño de las 11.226 ha de manera estable y por cada antena 250 personas»: primero el diseño y
  // después las zonas de popularidad (y la prueba de estrés, si se pidió)
  if (capacidad?.tipo === "zonas" && areaEnTexto(sinTildes(texto))) {
    const d = interpretarDiseno(texto, tn, api, antenas);
    if (d?.tipo === "disenar") return { ...d, despues: { zonas: capacidad.pedido, estres: capacidad.estres } };
  }
  if (capacidad) return capacidad;
  const diseno = interpretarDiseno(texto, tn, api, antenas);
  if (diseno) return diseno;
  const objetivo = interpretarAreaObjetivo(texto, tn, api);
  if (objetivo) return objetivo;
  const ajuste = interpretarAjuste(texto, tn, antenas);
  if (ajuste) return ajuste;
  const lote = interpretarLote(texto, tn, antenas);
  if (lote) return lote;
  const pantalla = interpretarPantalla(tn);
  if (pantalla) return pantalla;

  // Las piezas también se ponen en un lugar nombrado («pon el gateway en Cumaral»)
  const enLugar = !coord && VERBO_AGREGAR.test(tn) && /\b(gateway|getway|repetidor\w*|persona|gente)\b/.test(tn) ? ubicacionEnTexto(texto, tn, api, antenas, true) : null;
  const malla = interpretarMalla(texto, tn, api, coord ?? enLugar, ultimo);
  if (malla) return malla;

  // Órdenes sobre un nodo existente. «Inscribe una antena…» pide un nodo nuevo aunque ya exista uno solo,
  // salvo que se nombre uno existente o se diga «la antena», «este nodo»…
  const nombrado = nodosMencionados(tn, antenas)[0];
  const pideNuevo = VERBO_AGREGAR.test(tn) && OBJETO.test(tn) && !nombrado && !/\b(la|el|esta|este|esa|ese|su)\s+(antena|nodo|torre)\b/.test(tn);
  // El nodo del pedido es el primero que se nombra («ponle una Yagi a Ejemplo apuntando a Torre NE» → Ejemplo)
  const nodo = pideNuevo ? null : (nombrado ?? buscarNodo(tn, antenas, sel) ?? (ultimo && CLITICO.test(tn) ? ultimo : null));
  if (nodo) {
    if (/\b(elimina\w*|borra\w*|quita\w*|suprim\w*|saca\w*)\b/.test(tn) && !/\bpasarela\b/.test(tn)) return { tipo: "eliminar", id: nodo.id };
    if (/\b(duplic\w*|copia\w*|clona\w*)\b/.test(tn)) return { tipo: "duplicar", id: nodo.id };
    if (/^(selecciona\w*|elige|escoge|abre|muestrame|ver|enfoca\w*)\b/.test(tn) && !/\b(perfil|informe|senal|distancia)\b/.test(tn)) return { tipo: "seleccionar", id: nodo.id };
    if (/\b(mueve|mover|muevela|muevelo|traslad\w*|reubic\w*|desplaz\w*|cambia la ubicacion|cambiar la ubicacion|cambia las coordenadas|cambiar las coordenadas)\b/.test(tn))
      return { tipo: "mover", id: nodo.id, coord: coord ?? undefined };
    const ren = texto.match(/(?:renombr\w*|cambi\w* (?:el )?nombre(?: de)?|ll[aá]mal[ao])\b.*?\b(?:a|por|como)\s+["“«]?([^"”»,.;]{2,40})["”»]?\s*$/i);
    if (ren) return { tipo: "renombrar", id: nodo.id, nombre: ren[1].trim() };
    if (/\b(como pasarela|sea (la )?pasarela|es la pasarela|hazla pasarela|hazlo pasarela|marca\w* .*pasarela|pon\w* .*pasarela)\b/.test(tn) && !/\b(quita|ya no|no es)\b/.test(tn))
      return { tipo: "editar", id: nodo.id, cambios: { pasarela: true }, descripcion: "ahora es pasarela" };
    if (/\b(quita\w* .*pasarela|ya no (es|sea) pasarela|no es pasarela|sin pasarela)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { pasarela: false }, descripcion: "ya no es pasarela" };
    if (/\b(desactiv\w*|exclu\w*|apag\w*|oculta\w*|saca de la simulacion)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { activa: false }, descripcion: "quedó fuera de la simulación" };
    if (/\b(activ\w*|inclu\w*|enciend\w*|prend\w*)\b/.test(tn) && !/\b(no )?activa la regla\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { activa: true }, descripcion: "volvió a la simulación" };
    if (/\b(convier\w*|cambi\w* .*tipo|vuelve\w*|hazl[ao])\b.*\b(nodo de campo|nodo|antena|nodo antena)\b/.test(tn)) {
      const t = /nodo antena|\bantena\b/.test(tn.split(/convier\w*|cambi\w*|vuelve\w*|hazl[ao]/).pop() ?? "") ? "antena" : "nodo";
      return { tipo: "editar", id: nodo.id, cambios: { tipo: t }, descripcion: t === "antena" ? "ahora es un nodo antena" : "ahora es un nodo de campo" };
    }
    if (!PREGUNTA.test(tn) && !/\b(informe|reporte|radioenlace|radio enlace|perfil)\b/.test(tn)) {
      // Tipo de antena: «ponle una Yagi a Ejemplo», «Ejemplo con antena sectorial de 120»
      const patron = patronEnTexto(tn);
      const apuntar = /\b(apunt\w*|orient\w*|dirig\w*|gira\w*|azimut)\b/.test(tn);
      const otro = nodosMencionados(tn, antenas).find((x) => x.id !== nodo.id);
      const azimut = otro && apuntar ? Math.round(rumbo(nodo.lat, nodo.lon, otro.lat, otro.lon) * 10) / 10 : azimutEnTexto(texto, tn);
      if (patron && patron !== (nodo.patron ?? "omni")) {
        if (patron === "omni") return { tipo: "editar", id: nodo.id, cambios: { patron: undefined, azimutDeg: undefined, elevacionDeg: undefined }, descripcion: "ahora tiene antena omnidireccional" };
        const g = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
        const ganancia = g ? num(g[1]) : patronPorId(patron).gananciaTipica;
        const az = azimut ?? nodo.azimutDeg ?? 0;
        const haz = anchosHaz(patron, ganancia);
        return {
          tipo: "editar",
          id: nodo.id,
          cambios: { patron, gananciaDbi: ganancia, equipo: "personalizado", azimutDeg: az, elevacionDeg: nodo.elevacionDeg ?? 0 },
          descripcion: `ahora tiene antena ${patronPorId(patron).nombre.toLowerCase()} de ${fn(ganancia)} dBi apuntando a ${rumboTexto(az)}${otro && apuntar ? `, hacia ${otro.nombre}` : ""} (haz de ≈ ${Math.round(haz.h)}°)`,
        };
      }
      if (apuntar && azimut !== null) {
        if (!esDireccional(nodo)) return { tipo: "apuntar-omni", id: nodo.id, azimutDeg: azimut, destino: otro?.nombre };
        return { tipo: "editar", id: nodo.id, cambios: { azimutDeg: azimut }, descripcion: `apunta a ${rumboTexto(azimut)}${otro ? `, hacia ${otro.nombre}` : ""}` };
      }
      // Inclinación del haz: «inclina Ejemplo 5° hacia abajo»
      const incl = texto.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*(?:°|º|grados?)/i);
      if (incl && /\b(inclin\w*|tilt|elevacion del haz|baja el haz|sube el haz)\b/.test(tn)) {
        let e = num(incl[1]);
        if (/\b(abajo|baja)\b/.test(tn)) e = -Math.abs(e);
        else if (/\b(arriba|sube)\b/.test(tn)) e = Math.abs(e);
        e = Math.min(45, Math.max(-45, e));
        if (!esDireccional(nodo)) return { tipo: "apuntar-omni", id: nodo.id, azimutDeg: nodo.azimutDeg ?? 0 };
        return { tipo: "editar", id: nodo.id, cambios: { elevacionDeg: e }, descripcion: `el haz queda ${e === 0 ? "horizontal" : `${fn(Math.abs(e))}° hacia ${e < 0 ? "abajo" : "arriba"}`}` };
      }
    }
    const rol = rolEnTexto(tn);
    if (rol)
      return {
        tipo: "editar",
        id: nodo.id,
        cambios: { rol },
        descripcion: rol === "REPETIDOR" ? "queda como repetidor (pasa los paquetes de los demás)" : rol === "ROOM_SERVER" ? "queda como room server (guarda mensajes; no retransmite)" : "queda como companion (envía y recibe lo suyo; no retransmite)",
      };
    const eq = equipoEnTexto(tn);
    if (eq) {
      const q = EQUIPOS.find((x) => x.id === eq)!;
      return { tipo: "editar", id: nodo.id, cambios: { equipo: q.id, potenciaDbm: q.potenciaDbm, gananciaDbi: q.gananciaDbi, perdidaCableDb: q.perdidaCableDb }, descripcion: `ahora usa el equipo «${q.nombre}»` };
    }
    const alturaTxt = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
    if (alturaTxt && /\b(altura|sube|subir|subela|subelo|eleva\w*|baja|bajar|bajala|bajalo|pon\w*|cambi\w*|deja\w*)\b/.test(tn) && !/\breceptor\b/.test(tn))
      return { tipo: "editar", id: nodo.id, cambios: { alturaM: Math.min(300, Math.max(0.5, num(alturaTxt[1]))) }, descripcion: `altura ${fn(num(alturaTxt[1]))} m` };
    const pot = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbm\b/i);
    if (pot && /\b(potencia|pon\w*|cambi\w*|sube|baja)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { potenciaDbm: num(pot[1]), equipo: "personalizado" }, descripcion: `potencia ${f1(num(pot[1]))} dBm` };
    const gan = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
    if (gan && /\b(ganancia|antena de|pon\w*|cambi\w*)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { gananciaDbi: num(gan[1]), equipo: "personalizado" }, descripcion: `ganancia ${f1(num(gan[1]))} dBi` };
  }

  // Inscribir un nodo nuevo
  if (VERBO_AGREGAR.test(tn) && OBJETO.test(tn) && !/\b(mide|medir|distancia|perfil)\b/.test(tn)) {
    return { tipo: "agregar", datos: datosNodo(texto, tn), coord: coord ?? ubicacionEnTexto(texto, tn, api, antenas, true) ?? undefined };
  }

  // Parámetros de la simulación
  const preset = presetEnTexto(tn);
  if (preset && /\b(usa|usar|cambia\w*|pon\w*|configura\w*|preset|modo|simula con|prueba con)\b/.test(tn))
    return { tipo: "parametros", cambios: { preset }, descripcion: `el preset a ${presetPorId(preset).nombre}` };
  const radio = tn.match(/\bradio(?: de estudio)?\s*(?:de|a|en)?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:km|kilometros?)\b/);
  if (radio) return { tipo: "parametros", cambios: { radioKm: Math.min(40, Math.max(1, num(radio[1]))) }, descripcion: `el radio de estudio a ${f1(num(radio[1]), 0)} km` };
  const resol = tn.match(/\bresolucion\s*(?:a|en)?\s*(rapida|normal|fina)\b/);
  if (resol) return { tipo: "parametros", cambios: { resolucion: resol[1] as Parametros["resolucion"] }, descripcion: `la resolución a ${resol[1]}` };
  const saltos = tn.match(/\b(?:limite de saltos|hop ?limit|flood ?max|saltos)\s*(?:a|de|en)?\s*(\d{1,2})\b/);
  if (saltos && /\b(cambia\w*|pon\w*|sube|baja|usa|configura\w*|limite)\b/.test(tn)) {
    const v = Math.min(LIMITE_SALTOS_MAXIMO, Math.max(1, Number(saltos[1])));
    return { tipo: "parametros", cambios: { limiteSaltos: v }, descripcion: `el límite de saltos del diseño a ${v}` };
  }
  const frec = texto.match(/(\d{3}(?:[.,]\d+)?)\s*mhz\b/i);
  if (frec && /\b(frecuencia|canal|cambia\w*|pon\w*|usa)\b/.test(tn)) return { tipo: "parametros", cambios: { frecuenciaMhz: num(frec[1]) }, descripcion: `la frecuencia a ${frec[1]} MHz` };
  const rx = texto.match(/receptor.*?(\d{1,2}(?:[.,]\d+)?)\s*(?:m|metros?)\b/i);
  if (rx) return { tipo: "parametros", cambios: { alturaRxM: num(rx[1]) }, descripcion: `la altura del receptor a ${rx[1]} m` };
  const extra = texto.match(/p[eé]rdida (?:extra|adicional).*?(\d{1,2}(?:[.,]\d+)?)\s*db\b/i);
  if (extra) return { tipo: "parametros", cambios: { perdidaExtraDb: num(extra[1]) }, descripcion: `la pérdida extra a ${extra[1]} dB` };
  const ordenRed = interpretarRed(texto, tn, api);
  if (ordenRed) return ordenRed;

  // Distancias, perfiles, señal y ubicación
  const mencionados = nodosMencionados(tn, antenas);
  const ref = (a: Antena): Referencia => ({ tipo: "nodo", id: a.id });
  if (/\b(distancia|cuanto hay|que tan lejos|a cuant\w* (?:km|kilometros|metros)|mide|medir|medi)\b/.test(tn) && !/\b(regla|herramienta)\b/.test(tn)) {
    if (mencionados.length >= 2) return { tipo: "distancia", a: ref(mencionados[0]), b: ref(mencionados[1]) };
    if (mencionados.length === 1 && coord) return { tipo: "distancia", a: ref(mencionados[0]), b: { tipo: "coord", coord } };
  }
  if (/\b(informe|reporte|radioenlace|radio enlace|radio link|calculo del enlace|balance del enlace|presupuesto del enlace)\b/.test(tn) && mencionados.length >= 1) {
    if (mencionados.length >= 2) return { tipo: "informe", a: mencionados[0].id, b: ref(mencionados[1]) };
    if (coord) return { tipo: "informe", a: mencionados[0].id, b: { tipo: "coord", coord } };
  }
  if (/\bperfil\b/.test(tn) && mencionados.length >= 1) {
    if (mencionados.length >= 2) return { tipo: "perfil", a: mencionados[0].id, b: ref(mencionados[1]) };
    if (coord) return { tipo: "perfil", a: mencionados[0].id, b: { tipo: "coord", coord } };
  }
  if (coord && /\b(senal|cobertura|llega|alcanza|margen|recibe|recepcion)\b/.test(tn)) return { tipo: "senal", coord };
  if (/\b(municipio|departamento|en que (lugar|parte|municipio|departamento)|donde (esta|queda|se encuentra))\b/.test(tn)) {
    if (mencionados[0] && !coord) return { tipo: "donde", ref: ref(mencionados[0]) };
    if (coord) return { tipo: "donde", ref: { tipo: "coord", coord } };
  }
  if (/\b(ve a|ir a|vamos a|llevame|lleva el mapa|muestrame|mostrar|ubicame|centra\w*|acerca\w*|zoom|busca\w*|encuentra|localiza\w*)\b/.test(tn)) {
    if (coord) return { tipo: "ir", coord };
    if (mencionados[0]) return { tipo: "ir", id: mencionados[0].id };
    const consulta = tn
      .replace(/.*\b(ve a|ir a|vamos a|llevame a|llevame|muestrame|mostrar|ubicame en|ubicame|centra el mapa en|centra en|centrar en|acercate a|busca|buscar|encuentra|localiza)\b/, "")
      .replace(/\b(el|la|los|las|municipio de|departamento de|por favor|porfa|porfavor|en el mapa|mapa)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (consulta.length >= 3) {
      const lugar = api.buscarLugar(consulta)[0];
      return lugar ? { tipo: "ir", lugar } : { tipo: "ir", consulta };
    }
  }

  if (/\b(simula|simular|simulalo|simulala|calcula|calcular|recalcula\w*|corre la simulacion|ejecuta la simulacion|actualiza la simulacion|haz la simulacion|realiza la simulacion)\b/.test(tn)) return { tipo: "simular" };
  if (/\b(que|cuales|cuantos|cuantas) (antenas|nodos)\b|\blista\w* (de )?(las |los )?(antenas|nodos)\b|\b(mis|las|los) (antenas|nodos)\b.*\b(hay|tengo)\b/.test(tn)) return { tipo: "listar" };
  if (/\b(regla|medir distancias?|medir areas?|tomar medidas|medidas)\b/.test(tn)) return { tipo: "herramienta", herramienta: "regla" };
  if (/\b(exporta\w*|descarga\w*|guarda\w*|genera\w*)\b/.test(tn)) {
    if (/\b(kmz|kml|google earth)\b/.test(tn)) return { tipo: "exportar", formato: "kmz" };
    if (/\b(csv|excel)\b/.test(tn)) return { tipo: "exportar", formato: "csv" };
    if (/\b(json|escenario)\b/.test(tn)) return { tipo: "exportar", formato: "json" };
  }
  if (coord) return { tipo: "coordenada-sola", coord };
  return null;
}

/* ───────────── Modo «Sembrar la malla» (como en Trama) ───────────── */

const PALABRA_PIEZA: [Pieza, RegExp][] = [
  ["gateway", /\b(gateway|gateways|getway|geteway|internet|starlink)\b/],
  ["repetidor", /\b(repetidor|repetidores|repetidora|repetidoras)\b/],
  ["persona", /\b(persona|personas|gente|familia|familias|casa|casas|vivienda|viviendas|usuario|usuarios|vecino|vecinos|habitante|habitantes|finca)\b/],
];

/** Gateway, repetidor o persona mencionados como pieza nueva (no «Repetidor 2», que es el nombre de un nodo). */
function piezaEnTexto(tn: string, antenas: Antena[]): Pieza | null {
  const otroEquipo = /\b(antena|antenas|nodo|nodos|torre|sensor|equipo|router|pasarela)\b/.test(tn);
  // La pieza que se nombra primero es la que se pone («agrega un repetidor a 8 km al norte del gateway»)
  const orden = PALABRA_PIEZA.map(([pieza, re]) => ({ pieza, re, i: tn.search(re) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  for (const { pieza, re } of orden) {
    const m = tn.match(re);
    if (!m) continue;
    // «Inscribe un nodo antena en mi casa» o «antena con internet» siguen siendo nodos del modo avanzado
    if (otroEquipo && (pieza === "persona" || m[0] === "internet")) continue;
    // «Repetidor 2» o «Persona 3» seguidos de su número son nodos que ya existen
    const resto = tn.slice((m.index ?? 0) + m[0].length);
    if (/^\s*\d/.test(resto) && antenas.some((a) => n(a.nombre) === `${m[0]} ${resto.trim().split(" ")[0]}`)) continue;
    return pieza;
  }
  return null;
}

function interpretarMalla(texto: string, tn: string, api: Api, coord: Coordenada | null, ultimo?: Antena): Orden | null {
  if (PREGUNTA.test(tn) && !/\b(puedes|podrias|me ayudas)\b/.test(tn)) return null;
  const antenas = api.antenas();
  // Modo de la pantalla
  if (/\bmodo (avanzado|completo|experto)\b/.test(tn) && !/\bque es\b/.test(tn)) return { tipo: "modo", modo: "avanzado" };
  if (/\b(modo (sembrar|siembra|sencillo|facil|simple|trama)|sembrar la malla|vuelve a sembrar|volver a sembrar)\b/.test(tn) && !/\b(repetidor\w*|hacia|conecta\w*)\b/.test(tn)) return { tipo: "modo", modo: "sembrar" };
  // Animación del flujo de la información
  if (/\b(quita\w*|apaga\w*|desactiva\w*|deten\w*|para|pausa\w*|sin|no quiero)\b.*\b(animacion|animaciones|flujo|parpadeo|destellos)\b/.test(tn)) return { tipo: "vista", cambios: { animarRed: false }, descripcion: "quieta, sin la animación del flujo" };
  if (/\b(anima\w*|activa\w*|enciende|prende|muestra\w*|pon\w*)\b.*\b(animacion|animaciones|flujo|destellos)\b/.test(tn) || /\banima la (red|malla)\b/.test(tn)) return { tipo: "vista", cambios: { animarRed: true }, descripcion: "con el flujo animado hacia el gateway" };
  // Aceptar o descartar la propuesta del sembrado
  if (api.propuesta()) {
    if (/\b(descart\w*|no los pongas|no la quiero|cancela\w*|olvidalo)\b/.test(tn)) return { tipo: "descartar-siembra" };
    if (/\b(acept\w*|ponlos|ponla|ponlo|ponerlos|instalalos|pon los propuestos|confirm\w*|dale|hazlo|si,? pon\w*)\b/.test(tn) || (/\bpropuest\w*/.test(tn) && /\b(pon\w*|instal\w*|deja\w*|usa\w*)\b/.test(tn))) return { tipo: "aceptar-siembra" };
  }
  // Enviar un mensaje de prueba (un pago, un WhatsApp o una consulta a la IA) por la malla
  if (/\b(envi\w*|mand\w*|prueb\w*|simul\w*|haz|hace\w*)\b.*\b(mensaje|mensajes|sms|texto|sos|alerta|chat|whatsapp|pago|pagos|transaccion|transferencia|giro)\b/.test(tn)) {
    const desde = nodosMencionados(tn, antenas)[0] ?? piezaGenerica(tn.replace(/.*\b(desde|de)\b/, " $1 "), antenas, ultimo);
    return { tipo: "mensaje", id: desde?.id };
  }
  // Sembrado automático: «conecta a los que faltan», «siembra repetidores hacia…», «lleva la red a…»
  const sembrar = /\b(siembra|siembrame|siembre|sembrar|conecta|conectame|conectalos|conectalas|conectala|conectalo|conectar|conecte|conectelos|conectelas|conectela|conectelo|lleva\w* la (red|malla|senal|cobertura)|llevar la (red|malla|senal|cobertura)|extiend\w* la (red|malla)|ampli\w* la (red|malla))\b/.test(tn);
  if (sembrar && !/\b(internet|starlink|pc|computador|celular)\b.*\bconecta/.test(tn)) {
    if (/\b(faltan|falta|sin cobertura|sin senal|rojas?|rojos?|desconectad\w*|aislad\w*|todas? las personas|todos|toda la gente)\b/.test(tn)) return { tipo: "sembrar", destino: "faltantes" };
    if (coord) return { tipo: "sembrar", destino: { coord, nombre: "El punto pedido" } };
    const persona = nodosMencionados(tn, antenas).find((a) => !a.pasarela);
    if (persona) return { tipo: "sembrar", destino: { id: persona.id } };
    const consulta = tn.replace(/.*\b(hacia|hasta|a)\b\s+/, "").replace(/\b(el|la|los|las|municipio de|por favor|porfa)\b/g, " ").replace(/\s+/g, " ").trim();
    if (consulta.length >= 3) {
      const lugar = api.buscarLugar(consulta)[0];
      if (lugar) return { tipo: "sembrar", destino: { coord: { lat: lugar.lat, lon: lugar.lon }, nombre: lugar.nombre } };
    }
    if (/\b(siembra|siembrame|siembre|sembrar)\b/.test(tn)) return { tipo: "sembrar", destino: "faltantes" };
  }
  // «Pon a Persona 1 como repetidor» cambia el rol de un nodo que ya existe: no pone una pieza nueva
  if (/\bcomo (un |una )?(repetidor\w*|companion|room server|cliente|billetera)\b|\b(rol|retransmit\w*)\b/.test(tn) && nodosMencionados(tn, antenas).length) return null;
  // Poner una pieza: «pon el gateway en…», «agrega un repetidor en… a 20 m», «pon una persona en…»
  const pieza = piezaEnTexto(tn, antenas);
  const moverGateway = pieza === "gateway" && /\b(mueve|mover|muevelo|traslad\w*|cambia\w* .*(sitio|lugar|ubicacion))\b/.test(tn);
  if (pieza && (VERBO_AGREGAR.test(tn) || moverGateway) && !/\b(mide|medir|distancia|perfil|senal en)\b/.test(tn)) {
    const datos: DatosNodo = {};
    const nombre = nombreNuevo(texto);
    if (nombre) datos.nombre = nombre;
    const altura = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
    if (altura) datos.alturaM = Math.min(300, Math.max(0.5, num(altura[1])));
    return { tipo: "pieza", pieza, coord: coord ?? undefined, datos, mover: moverGateway };
  }
  // «¿Qué hago ahora?» con la red sembrada
  if (/\b(que hago ahora|que sigue|siguiente paso|que me falta|que falta)\b/.test(tn)) return { tipo: "que-hago" };
  return null;
}

/** Texto de la propuesta del sembrado automático, con los botones para ponerla o descartarla. */
function textoSiembra(s: Siembra, destinos: DestinoSiembra[]): Respuesta {
  const n = s.puntos.length;
  const resultado = s.destinos
    .map((d, i) => {
      const saltos = s.saltos?.[i];
      return `${destinos[i]?.nombre ?? "El punto"} ${d.llega ? `quedaría con ${f1(d.margenDb, 0)} dB desde ${d.desde}${saltos ? `, a ${saltos} ${saltos === 1 ? "salto" : "saltos"} del gateway` : ""}` : `no se alcanza: ${d.motivo}`}`;
    })
    .join("; ");
  const subio = s.alturaM !== undefined && s.alturaPedidaM !== undefined && s.alturaM > s.alturaPedidaM;
  if (!n) {
    const algun = s.destinos.some((d) => d.llega);
    return {
      texto: algun ? `No hace falta ningún repetidor: ${resultado}.` : `No encontré cómo llegar: ${resultado}`,
      acciones: algun && destinos.some((d) => !d.antena) ? [{ texto: "Poner una persona ahí", accion: "orden", orden: { tipo: "aceptar-siembra" } }] : undefined,
    };
  }
  const lista = s.puntos.map((q, k) => `Propuesto ${k + 1} a ${f1(q.distanciaKm)} km de ${q.desde} (${f1(q.margenDb, 0)} dB, suelo a ${Math.round(q.sueloM)} m)`).join("; ");
  return {
    texto: `Propongo ${n === 1 ? "un repetidor" : `${n} repetidores`}${s.alturaM ? ` en torre de ${fn(s.alturaM)} m` : ""}: ${lista}. ${resultado}.${subio ? ` Con torres de ${fn(s.alturaPedidaM!)} m la ruta pasaba del límite de saltos, así que subí a ${fn(s.alturaM!)} m para dar pasos más largos.` : ""} Los ve en el mapa como torres naranjas punteadas; busqué las lomas con enlace sólido (≥ 30 dB). Revise el sitio y el acceso en campo antes de instalar.`,
    acciones: [
      { texto: `Poner ${n === 1 ? "el repetidor" : `los ${n} repetidores`}`, accion: "orden", orden: { tipo: "aceptar-siembra" } },
      { texto: "Descartar", accion: "orden", orden: { tipo: "descartar-siembra" } },
    ],
  };
}

/** Resumen corto de la red sembrada: personas conectadas, sin cobertura y territorio cubierto. */
export function textoRed(r: EstadoRed, limiteSaltos: number): string {
  if (!r.gateways.length) return "Aún no hay gateway: es el primer paso, el sitio donde entra el internet.";
  if (!r.alDia) return "La red se está calculando.";
  const partes = [`${r.conectadas.length} de ${r.personas.length} ${r.personas.length === 1 ? "persona conectada" : "personas conectadas"}`];
  if (r.sinCobertura.length) partes.push(`${r.sinCobertura.length} sin cobertura (${r.sinCobertura.map((a) => a.nombre).join(", ")})`);
  if (r.lejos.length) partes.push(`${r.lejos.length} con más de ${limiteSaltos} saltos`);
  if (r.aislados.length) partes.push(`${r.aislados.length === 1 ? "un repetidor" : `${r.aislados.length} repetidores`} sin red (${r.aislados.map((a) => a.nombre).join(", ")})`);
  partes.push(`${f1(r.areaKm2, r.areaKm2 < 10 ? 1 : 0)} km² cubiertos`);
  return `La red: ${partes.join(", ")}.`;
}

/** Parámetros de red (como en Radio Mobile), entorno, modelo y vista del mapa de señal. */
function interpretarRed(texto: string, tn: string, api: Api): Orden | null {
  if (PREGUNTA.test(tn)) return null;
  const p = api.parametros();
  const verbo = /\b(usa\w*|cambia\w*|pon\w*|configura\w*|simula\w*|prueba\w*|calcula\w*|activa\w*|selecciona\w*|elige|escoge|aplica\w*|considera\w*|toma\w*|agrega\w*|suma\w*|quiero|necesito|deja\w*|con|en|a)\b/;
  // Restablecer los parámetros de Radio Mobile
  if (/\b(restablec\w*|reinici\w*|vuelve\w*|devuelve\w*|regresa\w*|resetea\w*|valores? (de|por) (defecto|referencia)|como (estaba|en las pruebas))\b/.test(tn) && /\b(parametro\w*|radio mobile|red|propagacion|referencia)\b/.test(tn))
    return { tipo: "parametros", cambios: { ...RED_REFERENCIA }, descripcion: "los parámetros de red a los de Radio Mobile (ecuatorial, vertical, suelo promedio, N = 360, móvil 50 % / 70 %)" };
  // Modelo
  if (/\b(longley\w*|itm|irregular terrain)\b/.test(tn) && verbo.test(tn) && p.modelo !== "itm") return { tipo: "parametros", cambios: { modelo: "itm" }, descripcion: "el modelo a Longley-Rice (ITM), como Radio Mobile" };
  if (/\b(modelo calibrado|calibrado)\b/.test(tn) && verbo.test(tn) && p.modelo !== "calibrado") return { tipo: "parametros", cambios: { modelo: "calibrado" }, descripcion: "el modelo al calibrado (recomendado)" };
  // Polarización
  if (/\bpolariz\w*/.test(tn)) {
    const pol = /\bhorizontal\w*/.test(tn) ? "horizontal" : /\bvertical\w*/.test(tn) ? "vertical" : null;
    if (pol) return { tipo: "parametros", cambios: { polarizacion: pol }, descripcion: `la polarización a ${pol}` };
  }
  // Clima
  if (/\bclima\b/.test(tn)) {
    const c = climaEnTexto(tn);
    const datos = CLIMAS.find((x) => x.id === c);
    if (datos) return { tipo: "parametros", cambios: { clima: datos.id, refractividad: datos.refractividad }, descripcion: `el clima a ${datos.nombre.toLowerCase()} (refractividad N = ${datos.refractividad})` };
  }
  // Refractividad
  const nref = tn.match(/\brefractividad\b\D{0,12}(\d{3})\b/);
  if (nref) return { tipo: "parametros", cambios: { refractividad: Math.min(400, Math.max(250, Number(nref[1]))) }, descripcion: `la refractividad a N = ${nref[1]}` };
  // Suelo
  if (/\b(suelo|terreno|tierra)\b/.test(tn) && /\b(suelo|conductividad|permitividad)\b|\bterreno (humedo|seco|arenoso|pobre|bueno|promedio)\b/.test(tn)) {
    const sid = sueloEnTexto(tn.replace(/.*\b(suelo|terreno|tierra)\b/, ""));
    const x = SUELOS.find((q) => q.id === sid);
    if (x) return { tipo: "parametros", cambios: { suelo: x.id, permitividad: x.permitividad, conductividad: x.conductividad }, descripcion: `el suelo a ${x.nombre.toLowerCase()} (εr ${x.permitividad}, σ ${String(x.conductividad).replace(".", ",")} S/m)` };
  }
  // Modo estadístico
  const modo = tn.match(/\bmodo (?:estadistico |de variabilidad )?(movil|accidental|puntual|spot|difusion|broadcast)\b/);
  if (modo) {
    const id: VariabilidadId = modo[1] === "spot" ? "puntual" : modo[1] === "broadcast" ? "difusion" : (modo[1] as VariabilidadId);
    return { tipo: "parametros", cambios: { variabilidad: id }, descripcion: `el modo estadístico a ${VARIABILIDADES.find((v) => v.id === id)?.nombre.toLowerCase()}` };
  }
  // Confiabilidad: «confiabilidad alta», «confiabilidad del 90 %», «95 % del tiempo», «80 % de las situaciones»
  const pctTiempo = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:del|de el)? ?tiempo\b/);
  const pctSit = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:de (?:las )?)?situaciones\b/);
  const pctUbi = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:de (?:las |los )?)?(?:ubicaciones|lugares|sitios)\b/);
  if (pctTiempo || pctSit || pctUbi) {
    const cambios: Partial<Parametros> = {};
    const partes: string[] = [];
    const lim = (x: string) => Math.min(99, Math.max(1, num(x)));
    if (pctTiempo) {
      cambios.tiempoPct = lim(pctTiempo[1]);
      partes.push(`${fn(cambios.tiempoPct)} % del tiempo`);
    }
    if (pctUbi) {
      cambios.ubicacionesPct = lim(pctUbi[1]);
      partes.push(`${fn(cambios.ubicacionesPct)} % de las ubicaciones`);
    }
    if (pctSit) {
      cambios.situacionesPct = lim(pctSit[1]);
      partes.push(`${fn(cambios.situacionesPct)} % de las situaciones`);
    }
    return { tipo: "parametros", cambios, descripcion: `la confiabilidad a ${partes.join(", ")}` };
  }
  if (/\bconfiabilidad\b|\bconfiable al\b/.test(tn)) {
    const pct = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:%|por ciento)/i) ?? tn.match(/\bconfiab\w*\s+(?:del?|al?)\s+(\d{1,2}(?:[.,]\d+)?)\b/);
    const nivel = /\bmuy alta\b/.test(tn) ? CONFIABILIDADES[2] : /\balta\b/.test(tn) ? CONFIABILIDADES[1] : /\b(normal|baja|estandar|de radio mobile)\b/.test(tn) ? CONFIABILIDADES[0] : null;
    if (pct) {
      const v = Math.min(99, Math.max(1, num(pct[1])));
      return { tipo: "parametros", cambios: { tiempoPct: v, ubicacionesPct: v, situacionesPct: v }, descripcion: `la confiabilidad al ${fn(v)} % (tiempo, ubicaciones y situaciones)` };
    }
    if (nivel) return { tipo: "parametros", cambios: { tiempoPct: nivel.tiempoPct, ubicacionesPct: nivel.ubicacionesPct, situacionesPct: nivel.situacionesPct }, descripcion: `la confiabilidad a ${nivel.nombre.toLowerCase()}: ${nivel.descripcion.charAt(0).toLowerCase()}${nivel.descripcion.slice(1).replace(/\.$/, "")}` };
  }
  // Entorno (vegetación o construcciones)
  const ent = entornoEnTexto(tn);
  if (ent && (/\b(entorno|zona|area|region|simula\w*|considera\w*|hay|con|pon\w*|cambia\w*|agrega\w*|suma\w*|incluye|usa\w*|esta en|estan en|dentro de|bajo|entre)\b/.test(tn)) && !/\b(ve a|ir a|llevame|busca\w*)\b/.test(tn)) {
    const e = entornoPorId(ent);
    const perdida = perdidaEntorno(ent, p.alturaRxM, p.frecuenciaMhz);
    return {
      tipo: "parametros",
      cambios: { entorno: ent },
      descripcion: ent === "abierto" ? "el entorno a campo abierto (sin pérdidas por vegetación ni edificios)" : `el entorno a ${e.nombre.toLowerCase()}: ≈ ${f1(perdida)} dB menos para el receptor a ${fn(p.alturaRxM)} m y para los equipos por debajo de ${fn(e.alturaM)} m`,
    };
  }
  // Vista del mapa de señal: unidades y escala de colores
  const mostrar = /\b(muestra\w*|mostrar|ver|veo|pinta\w*|expresa\w*|unidad\w*|cambia\w*|pon\w*|usa\w*|quiero|dame|en|colores?|escala)\b/.test(tn);
  const unidad = unidadEnTexto(texto, tn);
  const cambios: CambiosVista = {};
  const partes: string[] = [];
  if (unidad && mostrar && /\b(en|a|unidad\w*|muestra\w*|ver|pinta\w*|expresa\w*)\b/.test(tn)) {
    cambios.unidad = unidad;
    partes.push({ margen: "como margen en dB", dbm: "en dBm", uv: "en microvoltios (µV)", dbuvm: "como campo en dBµV/m" }[unidad]);
  }
  const s = presetPorId(p.preset).sensibilidadDbm;
  let escala: EscalaSenal | null = /\barco ?iris\b|\brainbow\b|\bdegradado\b/.test(tn) ? "arcoiris" : /\bumbral\b/.test(tn) && !/\bservicio\b/.test(tn) ? "umbral" : /\b(por clases|en clases|clases|colores de radio mobile|colores normales)\b/.test(tn) ? "clases" : null;
  const niveles = nivelesEnTexto(texto, s);
  if (escala === "arcoiris") {
    cambios.escala = "arcoiris";
    if (niveles.length >= 2) {
      cambios.escalaMinDbm = Math.min(niveles[0], niveles[1]);
      cambios.escalaMaxDbm = Math.max(niveles[0], niveles[1]);
    }
    partes.push("con colores arcoíris");
  } else if (escala === "umbral") {
    cambios.escala = "umbral";
    if (niveles.length) cambios.umbralDbm = niveles[0];
    partes.push(`solo donde la señal supera el umbral${niveles.length ? ` de ${textoNivel(niveles[0], unidad ?? "dbm", { sensibilidadDbm: s, gananciaRxDbi: p.gananciaRxDbi, frecuenciaMhz: p.frecuenciaMhz }, 1)}` : ""}`);
  } else if (escala === "clases") {
    cambios.escala = "clases";
    partes.push("con las clases de Radio Mobile");
  } else escala = null;
  if (Object.keys(cambios).length) {
    cambios.modo = "senal";
    return { tipo: "vista", cambios, descripcion: partes.join(" ") };
  }
  return null;
}

/* ───────────── Ejecución ───────────── */

export type ResultadoOrden = Respuesta & {
  deshacer?: Escenario;
  esperar?: string;
  pendiente?: Pendiente;
  luego?: Promise<Respuesta>;
  /** Nodo que puso o cambió la orden (para «súbelo», «muévelo»… en la siguiente). */
  nodo?: string;
};

function textoCoord(c: { lat: number; lon: number }) {
  return `${aGMS(c.lat, "lat")}, ${aGMS(c.lon, "lon")} (${aDecimal(c.lat)}, ${aDecimal(c.lon)})`;
}

const EJEMPLO_COORD = "4.5123, -73.1234 o 4°30'44\" N, 73°07'24\" O";

export function ejecutarOrden(o: Orden, api: Api): ResultadoOrden {
  const antenas = api.antenas();
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const antes = api.instantanea();
  const puntoDe = (r: Referencia) => (r.tipo === "nodo" ? porId.get(r.id) : r.coord);
  const nombreDe = (r: Referencia) => (r.tipo === "nodo" ? (porId.get(r.id)?.nombre ?? "el nodo") : `${aGMS(r.coord.lat, "lat")} ${aGMS(r.coord.lon, "lon")}`);

  switch (o.tipo) {
    case "agregar": {
      const clase = o.datos.tipo === "nodo" ? "nodo" : "nodo antena";
      if (!o.coord) {
        const datos = o.datos;
        return {
          texto: `Con gusto. Escríbame la coordenada del ${clase}, por ejemplo ${EJEMPLO_COORD}. También puede ubicarlo con un clic en el mapa.`,
          acciones: [{ texto: "Ubicar en el mapa", accion: "agregar" }],
          pendiente: { tipo: "agregar", datos },
        };
      }
      const { lat, lon } = o.coord;
      const nueva = api.agregar({ ...o.datos, lat, lon });
      const lugar = api.ubicacion(lat, lon);
      const tipoTxt = (nueva.tipo ?? "antena") === "nodo" ? "el nodo" : "el nodo antena";
      const extras = [`${fn(nueva.alturaM)} m de altura`, `${fn(nueva.gananciaDbi)} dBi`, `${fn(nueva.potenciaDbm)} dBm`].join(", ");
      return {
        texto: `Listo: inscribí ${tipoTxt} «${nueva.nombre}» en ${textoCoord({ lat, lon })}${lugar ? `, en ${lugar}` : ""}, con ${extras}${nueva.pasarela ? "; es la pasarela" : ""}.${o.coord.corregido ? " Tomé la longitud como oeste (negativa), como corresponde en Colombia." : ""} Ya estoy simulando su alcance; en un momento le cuento el resultado.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: nueva.id,
        nodo: nueva.id,
      };
    }
    case "mover": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      if (!o.coord) return { texto: `¿A qué coordenada muevo «${a.nombre}»? Por ejemplo ${EJEMPLO_COORD}.`, pendiente: { tipo: "mover", id: a.id } };
      api.editar(a.id, { lat: Number(o.coord.lat.toFixed(6)), lon: Number(o.coord.lon.toFixed(6)) });
      api.centrar(o.coord.lat, o.coord.lon);
      const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
      return {
        texto: `Moví «${a.nombre}» a ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}. Recalculo la simulación.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: a.id,
        nodo: a.id,
      };
    }
    case "eliminar": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      api.eliminar(a.id);
      return { texto: `Eliminé «${a.nombre}».`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes };
    }
    case "renombrar": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      api.editar(a.id, { nombre: o.nombre.slice(0, 60) });
      return { texto: `Ahora «${a.nombre}» se llama «${o.nombre}».`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes, nodo: a.id };
    }
    case "editar": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      api.editar(a.id, o.cambios);
      return { texto: `Hecho: «${a.nombre}», ${o.descripcion}. Recalculo la simulación.`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes, esperar: a.id, nodo: a.id };
    }
    case "parametros": {
      api.parametrosCambiar(o.cambios);
      return { texto: `Cambié ${o.descripcion}. Recalculo la simulación.`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes, esperar: "*" };
    }
    case "vista":
      api.vista(o.cambios);
      if (o.cambios.animarRed !== undefined)
        return {
          texto: o.cambios.animarRed
            ? "Listo: la malla se ve con el flujo animado. Las líneas turquesa avanzan hacia el gateway, los pulsos saltan de nodo en nodo, cada pieza destella al retransmitir y la nube «IA» del gateway se enciende cuando le llega algo."
            : "Listo: la malla queda quieta, sin la animación del flujo. Para volver a verla, dígame «anima la red» o use el interruptor del panel.",
        };
      if (o.cambios.unidad || o.cambios.escala) return { texto: `Listo: el mapa de señal se ve ${o.descripcion}. Lo puede ajustar en Capas → Escala de la señal.` };
      return { texto: `Listo: el mapa ${o.descripcion}. Todo esto también está en «Capas».` };
    case "informe": {
      const a = porId.get(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: "No encontré alguno de los dos extremos." };
      api.perfil(a, o.b.tipo === "nodo" ? (b as Antena) : { lat: b.lat, lon: b.lon }, true);
      const r = api.resultado();
      const idB = o.b.tipo === "nodo" ? o.b.id : null;
      const e = idB ? r?.enlaces.find((x) => (x.a === a.id && x.b === idB) || (x.b === a.id && x.a === idB)) : undefined;
      const s = presetPorId(api.parametros().preset).sensibilidadDbm;
      const resumen = e
        ? ` En la última simulación el enlace tiene ${f1(e.margen)} dB de margen (≈ ${f1(e.margen + s)} dBm recibidos) a ${f1(e.distanciaKm, 2)} km${e.lineaVista ? ", con línea de vista despejada" : ""}.`
        : "";
      return {
        texto: `Abrí el informe del radioenlace de ${a.nombre} a ${nombreDe(o.b)}, como «Radio Link» de Radio Mobile: distancia, azimut y ángulo de elevación, peor despeje de Fresnel, PIRE, pérdidas desglosadas y el nivel recibido en dBm, µV y dBµV/m.${resumen} Desde ahí puede copiarlo o descargarlo.`,
      };
    }
    case "apuntar-omni": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      return {
        texto: `«${a.nombre}» tiene antena omnidireccional: irradia igual hacia todos lados y no se puede apuntar. Si quiere concentrar la señal ${o.destino ? `hacia ${o.destino}` : `hacia el ${puntoCardinal(o.azimutDeg)}`}, le pongo una antena direccional:`,
        acciones: (["yagi", "sectorial-90", "panel"] as const).map((pt) => ({
          texto: `${patronPorId(pt).nombre} a ${Math.round(o.azimutDeg)}°`,
          accion: "orden" as const,
          orden: {
            tipo: "editar" as const,
            id: a.id,
            cambios: { patron: pt, gananciaDbi: patronPorId(pt).gananciaTipica, equipo: "personalizado" as const, azimutDeg: o.azimutDeg, elevacionDeg: 0 },
            descripcion: `ahora tiene antena ${patronPorId(pt).nombre.toLowerCase()} de ${fn(patronPorId(pt).gananciaTipica)} dBi apuntando a ${rumboTexto(o.azimutDeg)}`,
          },
        })),
      };
    }
    case "simular":
      if (!antenas.some((a) => a.activa)) return { texto: "No hay nodos activos. Inscriba uno con una coordenada o cargue el ejemplo.", acciones: [{ texto: "Cargar el ejemplo", accion: "ejemplo" }] };
      api.simular();
      return { texto: "Simulando… en un momento le cuento el resultado.", esperar: "*" };
    case "ir": {
      if (o.coord) {
        api.centrar(o.coord.lat, o.coord.lon, 13);
        api.marcar(o.coord.lat, o.coord.lon, "Coordenada");
        const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
        return {
          texto: `Lo llevé a ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}. Dejé el punto marcado: desde la tarjeta puede inscribir un nodo ahí.`,
          acciones: [{ texto: "Inscribir un nodo antena ahí", accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "antena" } } }],
        };
      }
      if (o.id) {
        const a = porId.get(o.id);
        if (a) {
          api.centrar(a.lat, a.lon, 13);
          return { texto: `Aquí está «${a.nombre}».` };
        }
      }
      if (o.lugar) {
        if (o.lugar.caja) api.encuadrarCaja(o.lugar.caja);
        else api.centrar(o.lugar.lat, o.lugar.lon, 8);
        return { texto: `Lo llevé a ${o.lugar.nombre}${o.lugar.tipo === "municipio" ? ` (${o.lugar.detalle})` : ""}.` };
      }
      return { texto: `No encontré «${o.consulta}». Pruebe con el nombre de un municipio o departamento de Colombia, o con coordenadas como ${EJEMPLO_COORD}.` };
    }
    case "distancia": {
      const a = puntoDe(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: "No encontré alguno de los dos puntos." };
      const d = distanciaM(a.lat, a.lon, b.lat, b.lon);
      const r = rumbo(a.lat, a.lon, b.lat, b.lon);
      api.medir({ id: `m${Date.now().toString(36)}`, nombre: `${nombreDe(o.a)} – ${nombreDe(o.b)}`.slice(0, 60), tipo: "linea", puntos: [[a.lon, a.lat], [b.lon, b.lat]], visible: true });
      return {
        texto: `De ${nombreDe(o.a)} a ${nombreDe(o.b)} hay ${formatoDistancia(d)} en línea recta, con rumbo ${rumboTexto(r)}. La dejé dibujada como medición en la regla.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
      };
    }
    case "perfil": {
      const a = porId.get(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: "No encontré alguno de los dos extremos." };
      api.perfil(a, o.b.tipo === "nodo" ? (b as Antena) : { lat: b.lat, lon: b.lon });
      return { texto: `Abrí el perfil del terreno de ${a.nombre} a ${nombreDe(o.b)}: muestra la línea de vista, la zona de Fresnel y el margen.` };
    }
    case "senal":
      if (!antenas.some((a) => a.activa)) return { texto: "Primero inscriba al menos un nodo antena para calcular la señal." };
      api.senal(o.coord.lat, o.coord.lon);
      api.centrar(o.coord.lat, o.coord.lon);
      return { texto: `Calculé la señal en ${textoCoord(o.coord)}: está en la tarjeta «Señal en este punto», con el margen desde cada nodo.` };
    case "donde": {
      const p = puntoDe(o.ref);
      if (!p) return { texto: "No encontré ese punto." };
      const lugar = api.ubicacion(p.lat, p.lon);
      return { texto: lugar ? `${o.ref.tipo === "nodo" ? `«${nombreDe(o.ref)}»` : "Ese punto"} queda en ${lugar}.` : `${o.ref.tipo === "nodo" ? `«${nombreDe(o.ref)}»` : "Ese punto"} queda fuera de los municipios de Colombia que tengo cargados.` };
    }
    case "listar":
      if (!antenas.length) return { texto: "Aún no hay nodos. Escríbame, por ejemplo: «inscribe un nodo antena en 4.5123, -73.1234».", acciones: [{ texto: "Cargar el ejemplo", accion: "ejemplo" }] };
      return {
        texto: `Hay ${antenas.length} ${antenas.length === 1 ? "nodo" : "nodos"}: ${antenas
          .map((a) => `${a.nombre} (${(a.tipo ?? "antena") === "nodo" ? "nodo" : "nodo antena"}, ${fn(a.alturaM)} m, ${aDecimal(a.lat)}, ${aDecimal(a.lon)}${a.pasarela ? ", pasarela" : ""}${a.activa ? "" : ", excluido"})`)
          .join("; ")}.`,
      };
    case "herramienta":
      api.herramienta(o.herramienta);
      return {
        texto:
          o.herramienta === "regla"
            ? "Activé la regla. Elija Línea, Trayecto o Área y haga clic en el mapa; doble clic o Enter para terminar. Cada medición queda guardada y se puede editar o borrar."
            : o.herramienta === "inspeccionar"
              ? "Activé «Medir señal»: haga clic en el mapa para ver el margen desde cada nodo."
              : "Haga clic en el mapa donde va el nodo.",
      };
    case "ejemplo":
      api.ejemplo();
      return { texto: "Cargué la demostración: un nodo antena llamado «Ejemplo». En un momento le cuento su alcance.", acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes, esperar: "*" };
    case "nuevo":
      if (!o.confirmado)
        return { texto: "¿Seguro? Se quitarán todos los nodos y mediciones del escenario actual (puede deshacerlo).", acciones: [{ texto: "Sí, empezar de cero", accion: "orden", orden: { tipo: "nuevo", confirmado: true } }] };
      api.nuevo();
      return { texto: "Listo, escenario en blanco. Escríbame una coordenada para inscribir el primer nodo antena.", acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes };
    case "exportar":
      return api.exportar(o.formato)
        ? { texto: `Descargué el archivo ${o.formato.toUpperCase()}.` }
        : { texto: "Para exportar a Google Earth primero necesito una simulación al día.", acciones: [{ texto: "Simular ahora", accion: "simular" }] };
    case "borrar-mediciones":
      api.borrarMediciones();
      return { texto: "Borré todas las mediciones de la regla.", acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes };
    case "pieza": {
      const nombrePieza = { gateway: "el gateway", repetidor: "el repetidor", persona: "la persona" }[o.pieza];
      if (!o.coord) {
        api.armarPieza(o.pieza);
        return {
          texto: `Con gusto. Toque el mapa donde va ${nombrePieza}, o escríbame la coordenada, por ejemplo ${EJEMPLO_COORD}.${o.pieza === "repetidor" ? " Busque una loma o una torre que alcance al gateway o a otro repetidor conectado." : ""}`,
          pendiente: { tipo: "pieza", pieza: o.pieza, datos: o.datos },
        };
      }
      const { lat, lon } = o.coord;
      const lugar = api.ubicacion(lat, lon);
      const gw = antenas.find((a) => a.pasarela);
      if (o.pieza === "gateway" && gw && (o.mover || api.modo() === "sembrar")) {
        api.editar(gw.id, { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)), activa: true });
        api.centrar(lat, lon);
        return {
          texto: `Moví el gateway «${gw.nombre}» a ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}: ahí entra el internet. Calculo de nuevo quién queda conectado.`,
          acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
          deshacer: antes,
          esperar: gw.id,
          nodo: gw.id,
        };
      }
      const nueva = api.ponerPieza(o.pieza, lat, lon, o.datos);
      const que = { gateway: "el gateway (Gateway + Internet)", repetidor: "el repetidor", persona: "la persona" }[o.pieza];
      return {
        texto: `Listo: puse ${que} «${nueva.nombre}» en ${textoCoord({ lat, lon })}${lugar ? `, en ${lugar}` : ""}, a ${fn(nueva.alturaM)} m.${o.coord.corregido ? " Tomé la longitud como oeste (negativa), como corresponde en Colombia." : ""} Ya calculo con el relieve real si queda conectad${o.pieza === "persona" ? "a" : "o"} al gateway.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: nueva.id,
        nodo: nueva.id,
      };
    }
    case "sembrar": {
      const r = api.red();
      if (!r.gateways.length) return { texto: "Primero hace falta el Gateway + Internet: es el punto de partida de la malla. Dígame dónde va, por ejemplo «pon el gateway en 4.2, -73.37».", acciones: [] };
      if (!r.alDia) {
        api.simular();
        return { texto: "Primero termino de calcular la red con el relieve real; pídamelo de nuevo en un momento.", esperar: "*" };
      }
      let destinos: DestinoSiembra[];
      if (o.destino === "faltantes") {
        if (!r.sinCobertura.length) return { texto: r.personas.length ? "Todas las personas ya están conectadas al gateway. 🙂 Si quiere llevar la red más lejos, dígame «lleva la red a» y una coordenada o un municipio." : "Todavía no hay personas en el mapa. Póngalas primero, por ejemplo «pon una persona en 4.25, -73.30»." };
        destinos = r.sinCobertura.map((a) => ({ lat: a.lat, lon: a.lon, nombre: a.nombre, antena: a }));
      } else if ("id" in o.destino) {
        const a = porId.get(o.destino.id);
        if (!a) return { texto: "No encontré ese nodo." };
        destinos = [{ lat: a.lat, lon: a.lon, nombre: a.nombre, antena: a }];
      } else destinos = [{ lat: o.destino.coord.lat, lon: o.destino.coord.lon, nombre: o.destino.nombre }];
      api.cambiarModo("sembrar");
      const luego = api.sembrar(destinos).then((s) => (s ? textoSiembra(s, destinos) : { texto: "No pude calcular la propuesta. Revise que el gateway esté puesto y la red calculada." }));
      return {
        texto: `Busco lomas con buen enlace desde la red conectada hacia ${destinos.length === 1 ? (destinos[0].nombre ?? "ese punto") : `${destinos.length} personas`}. En un momento le muestro la propuesta en el mapa.`,
        luego,
      };
    }
    case "aceptar-siembra": {
      const puestos = api.aceptarSiembra();
      if (!puestos) return { texto: "No tengo una propuesta pendiente. Pídame, por ejemplo, «conecta a los que faltan»." };
      return {
        texto: `Listo: puse ${puestos === 1 ? "1 nodo" : `${puestos} nodos`}. Calculo la red de nuevo y le cuento quién queda conectado.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: "*",
      };
    }
    case "descartar-siembra":
      api.descartarSiembra();
      return { texto: "Descarté la propuesta. Puede poner los repetidores a mano con la pieza «Repetidor»." };
    case "mensaje": {
      const r = api.red();
      if (!r.alDia) {
        api.simular();
        return { texto: "Primero calculo la red; pídame el mensaje otra vez en un momento.", esperar: "*" };
      }
      const desde =
        (o.id ? porId.get(o.id) : undefined) ??
        [...r.conectadas, ...r.lejos].sort((a, b) => (r.porNodo.get(b.id)?.saltos ?? 0) - (r.porNodo.get(a.id)?.saltos ?? 0))[0] ??
        r.personas[0] ??
        r.repetidores[0];
      if (!desde) return { texto: "Ponga al menos una persona para enviar un mensaje al gateway." };
      if (desde.pasarela) return { texto: `«${desde.nombre}» es el gateway: lo que mande ya está en internet. Elija una persona o un repetidor.` };
      api.cambiarModo("sembrar");
      const v = api.enviarMensaje(desde.id);
      if (!v) return { texto: "Primero calculo la red; pídame el mensaje otra vez en un momento." };
      const nombres = new Map(antenas.map((a) => [a.id, a.nombre]));
      const ruta = v.ruta.map((id) => nombres.get(id) ?? id).join(" → ");
      const tiempoTxt = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${f1(ms / 1000)} s`);
      if (!v.llega)
        return {
          texto: `Envié un mensaje de prueba desde «${desde.nombre}» y no llega: ${v.motivo ?? "no tiene ruta"}${v.ruta.length > 1 ? ` (ruta: ${ruta})` : ""}.${r.porNodo.get(desde.id)?.estado === "sin-cobertura" ? " ¿Quiere que siembre un repetidor hacia esa persona?" : ""}`,
          acciones: r.porNodo.get(desde.id)?.estado === "sin-cobertura" ? [{ texto: `Conectar a ${desde.nombre}`, accion: "orden", orden: { tipo: "sembrar", destino: { id: desde.id } } }] : undefined,
        };
      const pct = (p: number) => (p >= 0.999 ? "más de 99,9 %" : `${f1(p * 100, 0)} %`);
      return {
        texto: `Envié un mensaje de prueba desde «${desde.nombre}» del tamaño de un pago (la orden firmada, ${v.bytes} bytes): llega al gateway en ${v.saltos} ${v.saltos === 1 ? "salto" : "saltos"} (${ruta}), en ≈ ${tiempoTxt(v.totalMs.tipica)}${v.totalMs.max - v.totalMs.min >= 1 ? ` (entre ${tiempoTxt(v.totalMs.min)} y ${tiempoTxt(v.totalMs.max)})` : ""}. Llega al primer intento ${pct(v.probabilidad)} de las veces y ${pct(v.probabilidadReintentos)} con los ${INTENTOS} intentos de MeshCore (3 por la ruta y el último por inundación). Con ${v.preset} cada salto ocupa ${tiempoTxt(v.aireMs)} en el aire; va directo por la ruta aprendida y solo los repetidores la pasan, cada uno después de un turno al azar. El gateway lo pasa por Starlink (el pago se verifica con el banco, el WhatsApp sale a internet y la consulta va a la IA) y la respuesta vuelve por la misma ruta —en un pago, el comprobante—: ≈ ${tiempoTxt(v.totalMs.tipica)} de radio más lo que tarde el banco o la IA. Lo puede ver en el mapa. Para ver muchos a la vez: «envía 15 pagos al tiempo» o «manda 15 mensajes de WhatsApp al tiempo».`,
        acciones: [{ texto: "15 pagos al tiempo", accion: "orden", orden: { tipo: "carga", opciones: { mensajes: 15 }, curva: false } }],
      };
    }
    case "modo":
      api.cambiarModo(o.modo);
      return {
        texto:
          o.modo === "sembrar"
            ? "Listo, modo «Sembrar la malla»: primero el Gateway + Internet, luego los repetidores y al final la gente. Le voy guiando paso a paso en el panel de la izquierda."
            : "Listo, modo avanzado: tiene la lista de nodos, todos los parámetros y las herramientas del simulador. Para volver, toque «Sembrar la malla» arriba del panel.",
      };
    case "ejemplo-malla":
      api.ejemploMalla();
      return {
        texto: "Cargué el ejemplo de malla: el gateway donde entra el internet, un repetidor en torre hacia el oriente y tres personas; la más lejana queda sin cobertura para que practique «Conectar a los que faltan». En un momento le cuento cómo quedó.",
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: "*",
      };
    case "que-hago": {
      const r = api.red();
      const c = consejoRed(r, api.parametros().limiteSaltos);
      const acciones: Respuesta["acciones"] = [];
      if (r.alDia && r.sinCobertura.length) acciones.push({ texto: "Conectar a los que faltan", accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } });
      if (r.alDia && r.conectadas.length) acciones.push({ texto: "Enviar un mensaje de prueba", accion: "orden", orden: { tipo: "mensaje" } });
      return { texto: `${c.paso ? `Paso ${c.paso}: ` : ""}${c.titulo}. ${c.texto}`, acciones: acciones.length ? acciones : undefined };
    }
    case "coordenada-sola": {
      const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
      return {
        texto: `Entendí la coordenada ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}${o.coord.corregido ? " (tomé la longitud como oeste)" : ""}. ¿Qué hago con ella?`,
        acciones: [
          { texto: "Inscribir un nodo antena", accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "antena" } } },
          { texto: "Inscribir un nodo de campo", accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "nodo" } } },
          { texto: "Ir a ese punto", accion: "orden", orden: { tipo: "ir", coord: o.coord } },
          { texto: "Señal en ese punto", accion: "orden", orden: { tipo: "senal", coord: o.coord } },
        ],
      };
    }
    case "disenar":
      return ejecutarDiseno(o, api, antes);
    case "poblar":
    case "quitar-pobladas":
    case "carga":
    case "zonas":
    case "quitar-zonas":
    case "estres":
    case "limite":
    case "trama-departamento":
    case "trama-dimensionar":
      return ejecutarCapacidad(o, api);
    case "ajustar":
      return ejecutarAjuste(o, api, antes);
    case "aplicar-ajuste": {
      const op = o.ajuste.opciones[o.indice];
      if (!op) return { texto: "Esa opción ya no está disponible. Pídame el ajuste de nuevo." };
      api.aplicarAjuste(o.ajuste, o.indice, o.base);
      return {
        texto: `Aplico la opción «${op.titulo}» y simulo…`,
        deshacer: o.base,
        luego: api.esperarResultado().then((r) => textoAjusteAplicado(o.ajuste, o.indice, r, o.base)),
      };
    }
    case "descartar-ajuste":
      api.descartarAjuste();
      return { texto: "Listo, descarté la propuesta de ajuste. La red quedó como estaba." };
    case "area-objetivo": {
      if (o.quitar) {
        if (!api.areaObjetivo()) return { texto: "No hay área objetivo: la factibilidad ya se mide en el área de estudio (los círculos alrededor de los nodos antena)." };
        api.fijarAreaObjetivo(null);
        return { texto: "Listo: quité el área objetivo. La factibilidad vuelve a medirse en el área de estudio (60 % con señal media o mejor).", esperar: antenas.some((a) => a.activa) ? "*" : undefined };
      }
      const m = o.id ? api.mediciones().find((x) => x.id === o.id) : undefined;
      if (!m)
        return {
          texto: "No encuentro un área medida. Dibújela con la regla (Área) y pídamelo de nuevo: «usa el área que medí como área objetivo con el 95 %».",
          acciones: [{ texto: "Activar la regla", accion: "orden", orden: { tipo: "herramienta", herramienta: "regla" } }],
        };
      const meta = o.metaPct ?? 90;
      const margen = o.margenDb ?? 30;
      api.fijarAreaObjetivo(m.id, { metaPct: meta, margenDb: margen });
      return {
        texto: `Listo: «${m.nombre}» es el área objetivo. La factibilidad ahora pide el ${fp(meta)} % de esa área con ${margen >= 45 ? "señal buena" : margen >= 37 ? "señal estable o mejor" : "señal media o mejor"} (≥ ${margen} dB)${o.metaPct === undefined ? " (meta por defecto; dígame otra: «con el 99 %»)" : ""}.`,
        esperar: antenas.some((a) => a.activa) ? "*" : undefined,
      };
    }
    case "relieve":
      api.fijarRelieve(o.valor);
      return {
        texto:
          o.valor === "plano"
            ? "Listo: simulo sobre terreno plano (sin lomas ni valles). Sirve para comparar; para planear en serio vuelva al relieve real con «usa el relieve real»."
            : "Listo: simulo con el relieve real (teselas de elevación abiertas, sin costo).",
        esperar: antenas.some((a) => a.activa) ? "*" : undefined,
      };
    case "nombre-escenario":
      api.renombrarEscenario(o.nombre.slice(0, 80));
      return { texto: `Listo: el escenario se llama «${o.nombre.slice(0, 80)}». Así sale en los archivos que exporte.`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes };
    case "duplicar": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      api.duplicar(a.id);
      return { texto: `Dupliqué «${a.nombre}»: la copia quedó al lado, con los mismos datos. Arrástrela o dígame a dónde la muevo.`, acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }], deshacer: antes, esperar: "*" };
    }
    case "seleccionar": {
      const a = porId.get(o.id);
      if (!a) return { texto: "No encontré ese nodo." };
      api.seleccionar(a.id);
      api.centrar(a.lat, a.lon, 13);
      return { texto: `Aquí está «${a.nombre}»: lo dejé seleccionado para editarlo.`, nodo: a.id };
    }
    case "eliminar-varios": {
      const quitar = antenas.filter((a) => o.ids.includes(a.id));
      if (!quitar.length) return { texto: `No hay ${o.descripcion.replace(/^tod[oa]s (l[oa]s )?/, "")} para borrar.` };
      api.eliminarVarias(quitar.map((a) => a.id));
      return {
        texto: `Borré ${quitar.length === 1 ? "1 nodo" : `${quitar.length} nodos`} (${o.descripcion}): ${quitar.map((a) => a.nombre).join(", ")}.${antenas.length > quitar.length ? " Recalculo la red." : ""}`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: antenas.length > quitar.length ? "*" : undefined,
      };
    }
    case "editar-varios": {
      const cambiar = antenas.filter((a) => o.ids.includes(a.id));
      if (!cambiar.length) return { texto: "No encontré nodos de ese tipo." };
      for (const a of cambiar) api.editar(a.id, o.cambios);
      return {
        texto: `Hecho: ${o.descripcion} (${cambiar.map((a) => a.nombre).join(", ")}). Recalculo la simulación.`,
        acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: antes }],
        deshacer: antes,
        esperar: "*",
      };
    }
    case "auto":
      api.fijarAutoSimular(o.valor);
      if (o.valor) api.simular();
      return {
        texto: o.valor
          ? "Listo: «Simular al cambiar» quedó encendido. Cada vez que cambie algo, recalculo la cobertura solo."
          : "Listo: «Simular al cambiar» quedó apagado. Cuando quiera ver el resultado, dígame «simula» o toque «Simular».",
      };
    case "paneles": {
      const donde = api.paneles({ izquierdo: o.izquierdo, derecho: o.derecho });
      const ocultos = o.izquierdo === false || o.derecho === false;
      if (donde === "celular")
        return {
          texto: ocultos
            ? "Listo, dejé solo el mapa. En el celular los paneles se abren con los botones de abajo («Sembrar», «Nodos», «Parámetros», «Resultado»)."
            : "En el celular los paneles se abren con los botones de abajo: toque «Sembrar», «Nodos», «Parámetros» o «Resultado».",
        };
      const cual = o.izquierdo !== undefined && o.derecho !== undefined ? "los paneles" : o.izquierdo !== undefined ? "el panel izquierdo" : "el panel de resultados";
      if (o.izquierdo === false && o.derecho === false)
        return { texto: "Listo: pantalla limpia, solo el mapa. Sigo trabajando igual; cuando quiera verlos, diga «muestra los paneles» o use los botones de la barra de arriba." };
      return { texto: ocultos ? `Listo, oculté ${cual}. Para volver a verlo, dígamelo o use el botón de la barra de arriba.` : `Listo, ${cual === "los paneles" ? "ya están los paneles" : `ya está ${cual}`} a la vista.` };
    }
    case "encuadrar":
      if (!antenas.length) return { texto: "Aún no hay nodos en el mapa." };
      api.encuadrarTodo();
      return { texto: `Le muestro toda la red: ${antenas.length} ${antenas.length === 1 ? "nodo" : "nodos"}.` };
    case "cobertura-area": {
      const m = api.mediciones().find((x) => x.id === o.id);
      if (!m) return { texto: "No encuentro esa área medida." };
      const r = api.resultado();
      if (!r || !api.red().alDia) {
        if (!antenas.some((a) => a.activa)) return { texto: "Todavía no hay nodos que den cobertura en esa área." };
        return {
          texto: `Calculo la cobertura dentro de «${m.nombre}»…`,
          luego: api.esperarResultado().then((x) => (x ? textoCoberturaArea(x, m, o.margenDb) : { texto: "No pude terminar la simulación." })),
        };
      }
      return textoCoberturaArea(r, m, o.margenDb);
    }
  }
}

/* ───────────── Diseño por área: ejecución y respuesta ───────────── */

/** «99,9», «95», «100». */
const fp = (v: number) => (v >= 99.95 && v < 100 ? "99,9" : Number.isInteger(Math.round(v * 10) / 10) ? String(Math.round(v)) : f1(Math.floor(v * 10) / 10));

const resumenClases = (c: { porClase: Record<string, number> }) =>
  `buena ${fp(c.porClase.buena)} %, estable ${fp(c.porClase.estable)} %, media ${fp(c.porClase.media)} %, baja ${fp(c.porClase.baja)} % y sin servicio ${fp(c.porClase.sin)} %`;

function textoCoberturaArea(r: ResultadoSimulacion, m: Medicion, margenDb: number): Respuesta {
  const c = coberturaEnArea(r, m.puntos);
  const pct = porcentajeSobre(c, margenDb);
  return {
    texto: `En «${m.nombre}» (${textoArea(c.areaKm2 * 1e6)}) el ${fp(pct)} % tiene margen de al menos ${margenDb} dB${margenDb === 30 ? " (señal media o mejor)" : ""}. Por clase: ${resumenClases(c)}.${c.fueraKm2 > 0.01 ? ` Una parte (${f1(c.fueraKm2, 2)} km²) queda fuera del radio de estudio: súbalo para verla.` : ""}`,
  };
}

/* ───────────── Ajuste inteligente ───────────── */

/** «62 % del área de estudio con señal útil (media o mejor)» o, con área objetivo, «88 % de «Lote 3» con señal media o mejor (meta 95 %)». */
export function textoCoberturaUtil(r: ResultadoSimulacion): string {
  const o = r.areaObjetivo;
  if (o) {
    const senal = o.margenDb >= 45 ? "señal buena" : o.margenDb >= 37 ? "señal estable o mejor" : "señal media o mejor";
    return `${fp(o.utilPct)} % de «${o.nombre}» con ${senal} (meta ${fp(o.metaPct)} %)`;
  }
  return `${fp(r.porcentajeUtil)} % del área de estudio con cobertura útil, señal media o mejor (meta ${META_UTIL_ESTUDIO_PCT} %)`;
}

/** El botón «Ajústamelo automáticamente» (u «Optimizar la red») para las respuestas de Melki. */
export function accionAjuste(r: ResultadoSimulacion | null): AccionRespuesta | null {
  if (!r) return null;
  const orden: Orden = { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] };
  return { texto: r.factibilidad.nivel === "factible" ? "Optimizar el costo" : "Ajústamelo automáticamente", accion: "orden", orden };
}

const indiceOpcion = (a: Ajuste, id: OpcionAjusteId) => {
  const i = a.opciones.findIndex((x) => x.id === id);
  return i >= 0 ? i : a.recomendada;
};

function ejecutarAjuste(o: Extract<Orden, { tipo: "ajustar" }>, api: Api, antes: Escenario): ResultadoOrden {
  const activas = api.antenas().filter((a) => a.activa);
  if (!activas.length)
    return {
      texto: "Todavía no hay red que ajustar. Ponga el gateway y los nodos, o pídame una red completa para un área: «ármame una malla que cubra 500 hectáreas alrededor de Cumaral con señal media en el 99 %».",
    };
  if (!activas.some((a) => a.pasarela))
    return {
      texto: "Primero ponga el Gateway + Internet (la pasarela): el ajuste parte de él. Dígame dónde entra el internet: «pon el gateway en 4.2, -73.37».",
      acciones: [{ texto: "Poner el gateway", accion: "orden", orden: { tipo: "pieza", pieza: "gateway", datos: {} } }],
    };
  const area = api.areaObjetivo();
  const limites: string[] = [];
  if (o.opciones.alturaMaxM !== undefined && o.opciones.alturaMaxM < 30) limites.push(`torres de hasta ${fn(o.opciones.alturaMaxM)} m`);
  if (o.opciones.maxApoyos !== undefined) limites.push(o.opciones.maxApoyos === 0 ? "sin antenas de apoyo" : `máximo ${o.opciones.maxApoyos} ${o.opciones.maxApoyos === 1 ? "antena" : "antenas"} de apoyo`);
  if (o.opciones.permisos?.mover === false) limites.push("sin mover nodos");
  if (o.opciones.permisos?.apoyos === false && o.opciones.maxApoyos === undefined) limites.push("sin antenas de apoyo");
  if (o.opciones.permisos?.antenas === false) limites.push("sin cambiar antenas");
  if (o.opciones.permisos?.alturas === false) limites.push("sin cambiar alturas");
  if (o.opciones.sitios?.length) limites.push(`apoyos solo en ${o.opciones.sitios.length === 1 ? "el sitio que me dio" : `los ${o.opciones.sitios.length} sitios que me dio`}`);
  const luego = (async (): Promise<Respuesta> => {
    const a = await api.ajustarRed(o.opciones);
    if (!a) return { texto: "No pude calcular el ajuste (el relieve no cargó o el motor se detuvo). Intente de nuevo en un momento." };
    const i = indiceOpcion(a, o.opcion);
    const op = a.opciones[i];
    if (o.aplicar && op && op.cambios.length) {
      api.aplicarAjuste(a, i, antes);
      const r = await api.esperarResultado();
      return textoAjusteAplicado(a, i, r, antes);
    }
    api.mostrarAjuste(a, i);
    return textoAjustePropuesta(a, i, antes);
  })();
  return {
    texto: `${o.avisos.length ? `${o.avisos.join(" ")} ` : ""}Analizo la red como lo haría un planeador, con el relieve real: pruebo subir o bajar cada torre (hasta ${fn(o.opciones.alturaMaxM ?? 30)} m), correr nodos a lomas cercanas, cambiar el tipo de antena y sugerir antenas de apoyo, y comparo cuánto cubre cada opción contra lo que cuesta${area ? ` en «${area.nombre}»` : ""}${limites.length ? ` (${limites.join(", ")})` : ""}. Tardo unos segundos.`,
    luego,
  };
}

/** Cómo quedó la red después de aplicar una opción del ajuste (con la simulación real). */
function textoAjusteAplicado(a: Ajuste, i: number, r: ResultadoSimulacion | null, base: Escenario): Respuesta {
  const op = a.opciones[i];
  const partes: string[] = [];
  const f = r?.factibilidad;
  const util = r ? (r.areaObjetivo ? r.areaObjetivo.utilPct : r.porcentajeUtil) : op.resumen.utilPct;
  const zona = r?.areaObjetivo ? `de «${r.areaObjetivo.nombre}»` : "del área de estudio";
  partes.push(
    `Listo: apliqué la opción «${op.titulo}»${f ? ` y la red quedó ${f.nivel === "factible" ? "factible" : f.titulo.toLowerCase()} (${f.puntaje}/100)` : ""}: cobertura útil del ${fp(util)} % ${zona}, antes ${fp(a.inicial.utilPct)} %.`,
  );
  const cambios = op.cambios.map(textoCambio);
  partes.push(`Lo que cambié: ${cambios.slice(0, 6).join("; ")}${cambios.length > 6 ? `; y ${cambios.length - 6} cambios más (los ve en el mapa y en la lista de nodos)` : ""}.`);
  if (a.area.tipo === "zona") partes.push("Como no había un área pedida, dejé la zona de la red como área objetivo: así la factibilidad se mide siempre en la misma zona.");
  const otras = a.analisis.filter((t) => /^(La de máxima|Si quiere más|Si basta)/.test(t));
  if (otras.length) partes.push(otras.join(" "));
  if (f && f.nivel !== "factible" && f.recomendaciones[0]) partes.push(`Todavía: ${f.recomendaciones[0]}`);
  if (a.motivo) partes.push(a.motivo);
  partes.push("Las antenas de apoyo son puntos sugeridos: antes de instalar, revise en campo el acceso, la energía y que nada tape las antenas.");
  const acciones: Respuesta["acciones"] = [{ texto: "Deshacer", accion: "deshacer", escenario: base }];
  a.opciones.forEach((x, k) => {
    if (k !== i && x.cambios.length) acciones.push({ texto: `Usar «${x.titulo}»`, accion: "orden", orden: { tipo: "aplicar-ajuste", ajuste: a, indice: k, base } });
  });
  return { texto: partes.join("\n"), acciones };
}

/** La propuesta del ajuste, sin aplicar: diagnóstico, opciones y recomendación. */
function textoAjustePropuesta(a: Ajuste, i: number, base: Escenario): Respuesta {
  const partes = [...a.analisis];
  const op = a.opciones[i];
  if (!a.opciones.length || !op?.cambios.length) {
    partes.push(a.modo === "optimizar" ? "No hay nada que cambiar: la red ya está bien dimensionada para su meta." : "No encontré cambios que mejoren la red con esos límites.");
    return { texto: partes.join("\n") };
  }
  const cambios = op.cambios.map(textoCambio);
  partes.push(`«${op.titulo}» necesita ${resumenCambios(op)}:\n${cambios.slice(0, 8).map((t) => `• ${t}`).join("\n")}${cambios.length > 8 ? `\n• y ${cambios.length - 8} cambios más (en el panel)` : ""}`);
  partes.push("Le dejé la propuesta en el panel Resultado y en el mapa (las antenas de apoyo se ven como torres punteadas). ¿La aplico?");
  const acciones: Respuesta["acciones"] = a.opciones
    .map((x, k) => ({ x, k }))
    .filter(({ x }) => x.cambios.length)
    .map(({ x, k }) => ({ texto: `Aplicar «${x.titulo}»${k === a.recomendada ? " (recomendada)" : ""}`, accion: "orden" as const, orden: { tipo: "aplicar-ajuste" as const, ajuste: a, indice: k, base } }));
  acciones.push({ texto: "Descartar", accion: "orden", orden: { tipo: "descartar-ajuste" } });
  return { texto: partes.join("\n"), acciones };
}

function ejecutarDiseno(o: Extract<Orden, { tipo: "disenar" }>, api: Api, antes: Escenario): ResultadoOrden {
  if (o.reemplazar) api.restaurar(o.reemplazar);
  const base = o.reemplazar ?? antes;
  const antenas = o.reemplazar ? o.reemplazar.antenas : api.antenas();
  let poligono: Poligono;
  let donde = "";
  let dibujar = true;
  let nombreArea = "";
  let idArea: string | null = null;
  if (o.area.forma === "medicion") {
    const id = o.area.id;
    const m = api.mediciones().find((x) => x.id === id) ?? [...api.mediciones()].reverse().find((x) => x.tipo === "area");
    if (!m)
      return {
        texto: "No encuentro un área medida. Dibújela con la regla (Área) y pídamelo de nuevo, o dígame el tamaño: «cubre 500 hectáreas alrededor del gateway con señal media en el 99 %».",
        acciones: [{ texto: "Activar la regla", accion: "orden", orden: { tipo: "herramienta", herramienta: "regla" } }],
      };
    poligono = m.puntos;
    dibujar = false;
    nombreArea = m.nombre;
    idArea = m.id;
    donde = `en el área «${m.nombre}»`;
  } else if (o.area.forma === "poligono") {
    const puntos = o.area.puntos;
    poligono = puntos;
    dibujar = o.area.dibujar;
    donde = o.area.nombre;
    // Rehacer sobre la misma área: se sigue usando su medición
    const m = api.mediciones().find((x) => x.tipo === "area" && x.puntos.length === puntos.length && x.puntos.every((p, i) => p[0] === puntos[i][0] && p[1] === puntos[i][1]));
    if (m && !dibujar) {
      idArea = m.id;
      nombreArea = m.nombre;
    }
  } else {
    const a = o.area;
    let centro: { lat: number; lon: number } | null = null;
    if (a.centro.tipo === "coord") {
      centro = a.centro.coord;
      const lugar = api.ubicacion(centro.lat, centro.lon);
      donde = a.centro.nombre ? `${a.centro.nombre.startsWith("a ") || a.centro.nombre.startsWith("en ") || a.centro.nombre.startsWith("alrededor") ? "" : "en "}${a.centro.nombre}` : `alrededor de ${aDecimal(centro.lat)}, ${aDecimal(centro.lon)}${lugar ? ` (${lugar})` : ""}`;
    } else if (a.centro.tipo === "gateway") {
      const g = antenas.find((x) => x.pasarela && x.activa);
      if (g) {
        centro = { lat: g.lat, lon: g.lon };
        donde = `alrededor del gateway «${g.nombre}»`;
      }
    }
    if (!centro) {
      centro = api.centroMapa();
      const lugar = centro ? api.ubicacion(centro.lat, centro.lon) : null;
      donde = `en el centro del mapa que está viendo${lugar ? `, en ${lugar}` : ""}`;
    }
    if (!centro) return { texto: "¿Dónde armo la malla? Dígame un municipio, una coordenada o dibuje el área con la regla." };
    if (a.areaM2 < 5000) return { texto: "Esa área es muy pequeña (menos de media hectárea): con un solo nodo basta. Dígame un área más grande o ponga el gateway directamente." };
    if (a.areaM2 > 3e9) return { texto: "Esa área es muy grande para diseñarla de una vez (más de 300.000 ha). Divídala en zonas y pídamelas por partes, por ejemplo por municipio." };
    poligono =
      a.forma === "circulo"
        ? conArea(poligonoCirculo(centro.lat, centro.lon, radioDeArea(a.areaM2)), a.areaM2)
        : conArea(poligonoRectangulo(centro.lat, centro.lon, a.anchoM ?? Math.sqrt(a.areaM2), a.altoM ?? Math.sqrt(a.areaM2)), a.areaM2);
  }
  const area = areaM2(poligono);
  if (area > 3e9) return { texto: "Esa área es muy grande para diseñarla de una vez (más de 300.000 ha). Divídala en zonas y pídamelas por partes." };
  const gw = antenas.find((x) => x.pasarela && x.activa);
  if (o.gateway && gw) api.editar(gw.id, { lat: Number(o.gateway.lat.toFixed(6)), lon: Number(o.gateway.lon.toFixed(6)), activa: true });
  const forma = o.area.forma === "cuadrado" ? "cuadrada" : o.area.forma === "rectangulo" ? "rectangular" : "";
  if (dibujar) {
    nombreArea = `Área objetivo · ${textoArea(area)}`;
    idArea = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    api.medir({ id: idArea, nombre: nombreArea, tipo: "area", puntos: poligono, visible: true }, false);
  } else {
    const b = cajaPoligono(poligono);
    api.encuadrarCaja([b.oeste, b.sur, b.este, b.norte]);
  }
  const meta = `${o.clases} en el ${fp(o.porcentaje)} % del área${o.respaldo ? ", con respaldo (cada punto con dos nodos)" : ""}`;
  const pedido = { area: poligono, margenDb: o.margenDb, porcentaje: o.porcentaje, respaldo: o.respaldo, alturaRepetidorM: o.alturaM, gateway: o.gateway, maxRepetidores: o.maxRepetidores };
  const luego = (async (): Promise<Respuesta> => {
    const d = await api.disenarArea(pedido);
    if (!d) return { texto: "No pude calcular el diseño (el relieve no cargó o el motor se detuvo). Intente de nuevo en un momento.", acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: base }] };
    const puestas = api.aplicarDiseno(d, o.alturaM);
    // El área del diseño queda como área objetivo: la factibilidad se mide ahí y con la meta pedida
    if (idArea) api.fijarAreaObjetivo(idArea, { metaPct: o.porcentaje, margenDb: o.margenDb, respaldo: o.respaldo || undefined });
    const r = await api.esperarResultado();
    const hecho = textoDiseno(o, d, puestas, r, poligono, nombreArea || donde, base, api);
    if (!o.despues) return hecho;
    // Y luego las zonas de popularidad (y la prueba de estrés) sobre la red recién diseñada
    const sigue = await seguirConZonas(o.despues.zonas, o.despues.estres, api);
    return { texto: `${hecho.texto}\n\n${sigue.texto}`, acciones: [...(sigue.acciones ?? []), ...(hecho.acciones ?? [])].slice(0, 5) };
  })();
  return {
    texto: `Diseño la malla para ${textoArea(area)}${forma ? ` (área ${forma})` : ""} ${donde}: ${meta}. ${dibujar ? "Dibujé el área en el mapa. " : ""}Busco con el relieve real dónde va ${gw || o.gateway ? "cada repetidor" : "el gateway y cada repetidor"} (torres de ${fn(o.alturaM)} m), siempre enlazados a la red.${o.despues ? ` Después pongo ${o.despues.zonas.n ?? 250} personas alrededor de cada gateway y repetidor (zonas de popularidad)${o.despues.estres ? " y hago la prueba de estrés de la hora pico para ver si la red se revienta" : ""}.` : ""} Tardo unos segundos.`,
    acciones: [{ texto: "Deshacer", accion: "deshacer", escenario: base }],
    deshacer: base,
    luego,
  };
}

function textoDiseno(o: Extract<Orden, { tipo: "disenar" }>, d: Diseno, puestas: Antena[], r: ResultadoSimulacion | null, poligono: Poligono, nombreArea: string, base: Escenario, api: Api): Respuesta {
  const area = areaM2(poligono);
  const gw = puestas.find((a) => a.pasarela);
  const reps = puestas.filter((a) => !a.pasarela);
  const real = r ? coberturaEnArea(r, poligono, o.respaldo ? "segundo" : "mejor") : null;
  const pct = real ? porcentajeSobre(real, o.margenDb) : d.coberturaPct;
  const ok = pct >= o.porcentaje - 1e-6;
  const partes: string[] = [];
  partes.push(
    ok
      ? `Listo: la malla cubre el ${fp(pct)} % de las ${textoArea(area)} con ${o.clases}${o.respaldo ? " desde al menos dos nodos (respaldo)" : ""}. Meta cumplida (${fp(o.porcentaje)} %).`
      : `Llegué al ${fp(pct)} % de las ${textoArea(area)} con ${o.clases}; la meta era ${fp(o.porcentaje)} %.`,
  );
  const lugarGw = gw ? api.ubicacion(gw.lat, gw.lon) : null;
  const nodosR = r ? new Map(r.nodos.map((x) => [x.id, x])) : null;
  const saltos = reps.map((a) => nodosR?.get(a.id)?.saltos ?? null);
  const sinRuta = reps.filter((_, i) => saltos[i] === null).length;
  const maxSaltos = Math.max(0, ...saltos.filter((x): x is number => x !== null));
  const enlaces = d.nodos.filter((x) => x.pieza === "repetidor" && x.enlaceDb !== null).map((x) => x.enlaceDb!);
  const gwTxt = gw ? `Puse el gateway «${gw.nombre}» en ${aDecimal(gw.lat)}, ${aDecimal(gw.lon)}${lugarGw ? `, en ${lugarGw},` : ""} donde más área cubre; si el internet entra en otro sitio, dígame dónde y lo rehago.` : "";
  if (!reps.length) partes.push(`${gwTxt ? `${gwTxt} ` : ""}${gw ? "Con el gateway" : "Con la red que ya había"} basta: no hizo falta ningún repetidor.`);
  else {
    const lista = reps.length <= 4 ? reps.map((a) => a.nombre).join(", ") : `${reps[0].nombre} a ${reps[reps.length - 1].nombre}`;
    const uno = reps.length === 1;
    const saltosTxt = `${maxSaltos} ${maxSaltos === 1 ? "salto" : "saltos"}`;
    partes.push(
      `${gwTxt ? `${gwTxt} ` : ""}Sembré ${uno ? "1 repetidor" : `${reps.length} repetidores`} de ${fn(o.alturaM)} m (${lista}), ${uno ? "en el sitio que más área nueva cubría, enlazado" : "cada uno en el sitio que más área nueva cubría y enlazado"} a la red${enlaces.length ? (uno ? ` con ${f1(enlaces[0], 0)} dB` : ` con al menos ${f1(Math.min(...enlaces), 0)} dB`) : ""}${nodosR ? (uno ? `; llega al gateway en ${saltosTxt}` : `; llegan al gateway en máximo ${saltosTxt}`) : ""}.${sinRuta ? ` Ojo: ${sinRuta} no ${sinRuta === 1 ? "quedó" : "quedaron"} con ruta al gateway en la simulación.` : ""}${maxSaltos > api.parametros().limiteSaltos ? ` ${uno ? "Pasa" : "Algunos pasan"} del límite de ${api.parametros().limiteSaltos} saltos: súbalo o use torres más altas.` : ""}`,
    );
  }
  if (real) partes.push(o.respaldo ? `Respaldo dentro del área (señal del segundo mejor nodo): ${resumenClases(real)}.` : `Dentro del área: ${resumenClases(real)}.`);
  // Cuántos repetidores hicieron falta para cada nivel (el último tramo suele ser el más caro)
  const curva = d.nodos.filter((x) => x.pieza === "repetidor").map((x) => x.coberturaPct);
  if (curva.length >= 4 && o.porcentaje > 97) {
    const a95 = curva.findIndex((v) => v >= 95);
    const a99 = curva.findIndex((v) => v >= 99);
    if (a95 >= 0 && a99 > a95 + 1) partes.push(`Con ${a95 + 1} ${a95 === 0 ? "repetidor" : "repetidores"} ya se llegaba al 95 % y con ${a99 + 1} al 99 %; los demás tapan huecos pequeños detrás de lomas y en hondonadas.`);
  }
  if (!ok && d.motivo) partes.push(d.motivo);
  partes.push(ok ? "Antes de instalar, revise en campo el acceso, la energía y que nada tape las antenas." : "Puedo probar con torres más altas, o puede aceptar este resultado.");
  const conPoligono = (cambios: Partial<Extract<Orden, { tipo: "disenar" }>>): Orden => ({ ...o, area: { forma: "poligono", puntos: poligono, nombre: `en el área «${nombreArea}»`, dibujar: Boolean(cambios.reemplazar) }, ...cambios });
  const acciones: Respuesta["acciones"] = [{ texto: "Deshacer", accion: "deshacer", escenario: base }];
  if (!ok) {
    if (d.motivo?.startsWith("Llegué al máximo") && o.maxRepetidores < 200) {
      const mas = Math.min(200, Math.max(60, o.maxRepetidores * 3));
      acciones.push({ texto: `Rehacer con hasta ${mas} repetidores`, accion: "orden", orden: conPoligono({ maxRepetidores: mas, reemplazar: base }) });
    }
    for (const h of [12, 20, 30].filter((x) => x > o.alturaM).slice(0, 2)) acciones.push({ texto: `Rehacer con torres de ${h} m`, accion: "orden", orden: conPoligono({ alturaM: h, reemplazar: base }) });
    if (d.huecos[0]) acciones.push({ texto: "Ver un punto sin cobertura", accion: "orden", orden: { tipo: "ir", coord: { lat: d.huecos[0][1], lon: d.huecos[0][0] } } });
    acciones.push({ texto: "Ajústamelo (alturas, lomas y apoyos)", accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] } });
  } else {
    acciones.push({ texto: "Optimizar el costo (misma cobertura)", accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] } });
    if (!o.respaldo) acciones.push({ texto: "Agregar respaldo (dos nodos por punto)", accion: "orden", orden: conPoligono({ respaldo: true }) });
    if (o.porcentaje < 99.9) acciones.push({ texto: "Subir la meta a 99,9 %", accion: "orden", orden: conPoligono({ porcentaje: 99.9 }) });
  }
  return { texto: partes.join("\n"), acciones };
}
