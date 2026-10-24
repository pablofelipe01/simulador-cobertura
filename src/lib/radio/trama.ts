// Trama · red por radio (MeshCore) para pagos, mensajes de WhatsApp y consultas a la IA donde no hay señal: equipos, precios, capacidad por frecuencia, cobertura por terreno y el
// dimensionamiento por departamento, tal como los trae el documento de trabajo del Inge «Territorios sin
// conectividad» (octubre de 2026). Son estimaciones de cálculo para planear; se ajustan midiendo
// el canal en una red piloto.

/** Parámetros de importación del cotizador (USD → COP). La TRM es la del día en el documento. */
export const COTIZADOR = { trm: 3158, colchonPct: 3, envioPct: 12, arancelPct: 10, ivaImportPct: 19 } as const;

export type ItemCatalogo = {
  id: string;
  grupo: "caja" | "energia" | "instalacion" | "internet" | "radio";
  nombre: string;
  detalle: string;
  precio: number;
  moneda: "USD" | "COP";
  periodo: "unico" | "mensual";
  importado: boolean;
};

/** Catálogo del cotizador (los equipos de la red). */
export const CATALOGO: readonly ItemCatalogo[] = [
  { id: "minipc", grupo: "caja", nombre: "Mini PC sin ventilador Intel N100, 16 GB / SSD 512 GB (Linux)", detalle: "Ej. Minisforum UN100L; uno por torre", precio: 249, moneda: "USD", periodo: "unico", importado: true },
  { id: "hub_usb", grupo: "caja", nombre: "Hub USB alimentado 7 puertos (industrial, metálico)", detalle: "Para las radios de la torre; precio de referencia", precio: 220_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "ups", grupo: "caja", nombre: "Mini UPS / respaldo de energía", detalle: "Aguanta cortes cortos de luz", precio: 250_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "cajaip", grupo: "caja", nombre: "Caja hermética IP65 + prensaestopas", detalle: "Para el mini PC y las radios en exterior", precio: 120_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "solar_kit", grupo: "energia", nombre: "Kit solar para Starlink + caja (si no hay red eléctrica)", detalle: "Starlink gasta 75–100 W: ~400 W de panel + batería ~2 kWh + inversor", precio: 4_500_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "solar_torre", grupo: "energia", nombre: "Kit solar para torre sin red (mini PC + radios + enlace, ~30 W)", detalle: "~300 W de panel + batería LiFePO4 100 Ah + controlador; precio de referencia", precio: 2_600_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "tubo", grupo: "instalacion", nombre: "Tubo de hierro 6 m", detalle: "Mástil para antena o repetidor", precio: 230_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "herrajes", grupo: "instalacion", nombre: "Abrazaderas, templetes y tornillería (por mástil)", detalle: "", precio: 90_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "base", grupo: "instalacion", nombre: "Base en concreto / anclaje (por mástil)", detalle: "Cemento, arena, varilla", precio: 70_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "tierra", grupo: "instalacion", nombre: "Pararrayos + polo a tierra (por sitio con gateway)", detalle: "Varilla cobre-cobre, cable y conector", precio: 380_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "torre", grupo: "instalacion", nombre: "Torre arriostrada 12 m (secciones, templetes y base)", detalle: "Para separar en vertical las antenas de varias radios; precio de referencia", precio: 3_200_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "starlink_kit", grupo: "internet", nombre: "Starlink kit Estándar V4", detalle: "Precio Homecenter", precio: 1_599_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "starlink_mes", grupo: "internet", nombre: "Starlink Residencial Lite (mensual)", detalle: "Hasta 200 Mb/s; el plan comercial de la operación es $300.000 al mes", precio: 160_000, moneda: "COP", periodo: "mensual", importado: false },
  { id: "ptp", grupo: "internet", nombre: "Enlace WiFi punto a punto 5 GHz (par Ubiquiti LiteBeam 5AC Gen2)", detalle: "Lleva el internet del Starlink a cada torre; 10–20 km con línea de vista", precio: 130, moneda: "USD", periodo: "unico", importado: true },
  { id: "p1", grupo: "radio", nombre: "SenseCAP Solar Node P1 (repetidor solar)", detalle: "Panel 5 W, nRF52840 + SX1262, soporte incluido; MeshCore oficial. Lleva 4 pilas 18650 aparte", precio: 72.9, moneda: "USD", periodo: "unico", importado: true },
  { id: "pilas18650", grupo: "radio", nombre: "Pilas 18650 para el P1 (juego de 4)", detalle: "~3.000 mAh; el P1-Pro ya las trae", precio: 60_000, moneda: "COP", periodo: "unico", importado: false },
  { id: "antena8", grupo: "radio", nombre: "Antena RF Explorer 8 dBi fibra de vidrio 1,3 m", detalle: "902–928 MHz, trae 1 m de cable CFD200 y soporte", precio: 29.9, moneda: "USD", periodo: "unico", importado: true },
  { id: "coax", grupo: "radio", nombre: "Cable N hembra → RP-SMA macho CFD400, 3 m", detalle: "Para bajar de la antena a la caja", precio: 19.9, moneda: "USD", periodo: "unico", importado: true },
  { id: "t1000", grupo: "radio", nombre: "SenseCAP T1000-E (nodo de la persona)", detalle: "Tarjeta BLE + GPS, sellada, se empareja con el celular", precio: 39.9, moneda: "USD", periodo: "unico", importado: true },
  { id: "t114", grupo: "radio", nombre: "Heltec Mesh Node T114 (radio del gateway)", detalle: "Una por frecuencia, companion USB en el mini PC", precio: 27.9, moneda: "USD", periodo: "unico", importado: true },
  { id: "xiao", grupo: "radio", nombre: "Seeed XIAO ESP32S3 & Wio-SX1262 Kit (billetera económica)", detalle: "BLE + LoRa; sin batería, carcasa ni GPS", precio: 11, moneda: "USD", periodo: "unico", importado: true },
  { id: "bat_xiao", grupo: "radio", nombre: "Batería LiPo ~1.000 mAh + carcasa para el XIAO", detalle: "Precio de referencia", precio: 40_000, moneda: "COP", periodo: "unico", importado: false },
];

/** Precio puesto en Colombia (COP): dólares a la TRM con colchón y, si es importado, envío, arancel e IVA. */
export function unitarioCop(item: ItemCatalogo, c: { trm: number; colchonPct: number; envioPct: number; arancelPct: number; ivaImportPct: number } = COTIZADOR): number {
  let v = item.precio;
  if (item.moneda === "USD") v *= c.trm * (1 + c.colchonPct / 100);
  if (item.importado) v *= (1 + c.envioPct / 100) * (1 + c.arancelPct / 100) * (1 + c.ivaImportPct / 100);
  return v;
}

const precio = (id: string) => {
  const it = CATALOGO.find((x) => x.id === id);
  return it ? unitarioCop(it) : 0;
};

/** Precios de los conjuntos que usa el dimensionamiento (COP). */
export const PRECIOS = {
  solarTorre: precio("solar_torre"),
  solarStarlink: precio("solar_kit"),
  /** Sitio gateway sin radios: mini PC, hub, UPS, caja, tierra, torre de 12 m y kit solar. */
  sitioBase: precio("minipc") + precio("hub_usb") + precio("ups") + precio("cajaip") + precio("tierra") + precio("torre") + precio("solar_torre"),
  /** Cada radio del gateway: Heltec T114 + antena 8 dBi + cable. */
  radio: precio("t114") + precio("antena8") + precio("coax"),
  /** Repetidor solar: P1 + pilas + antena 8 dBi + cable + tubo de 6 m + herrajes + base. */
  repetidor: precio("p1") + precio("pilas18650") + precio("antena8") + precio("coax") + precio("tubo") + precio("herrajes") + precio("base"),
  starlink: precio("starlink_kit") + precio("solar_kit"),
  starlinkMes: precio("starlink_mes"),
  enlace: precio("ptp"),
  nodo: { t1000: precio("t1000"), xiao: precio("xiao") + precio("bat_xiao") },
};

export type TerrenoTrama = "plano" | "sabana" | "montana" | "rios" | "selva";

/** Alcance supuesto de un repetidor por terreno (km) y cuántos sitios alimenta un Starlink. */
export const TERRENOS_TRAMA: Record<TerrenoTrama, { nombre: string; radioKm: number; sitiosPorStarlink: number; nota: string }> = {
  plano: { nombre: "Plano / semidesierto", radioKm: 10, sitiosPorStarlink: 4, nota: "Línea de vista larga: el mejor caso para la radio y el sol." },
  sabana: { nombre: "Sabana", radioKm: 8, sitiosPorStarlink: 4, nota: "Abierta, con bosques de galería en los ríos." },
  montana: { nombre: "Montaña", radioKm: 5, sitiosPorStarlink: 2, nota: "De loma a loma llega lejos; los valles cerrados se tapan." },
  rios: { nombre: "Ríos en selva", radioKm: 5, sitiosPorStarlink: 1, nota: "La radio corre sobre el agua; el bosque la frena a los lados." },
  selva: { nombre: "Selva cerrada", radioKm: 3, sitiosPorStarlink: 1, nota: "El follaje mojado se come la señal: celdas pequeñas." },
};

export type SfTrama = 9 | 10 | 11;

/** Capacidad por frecuencia según el SF (canal al 15 % en la hora pico). */
export const SF_TRAMA: Record<SfTrama, { usuariosFrecuencia: number; factorRadio: number; pagosHora: number; segPago: number }> = {
  11: { usuariosFrecuencia: 150, factorRadio: 1, pagosHora: 55, segPago: 9.5 },
  10: { usuariosFrecuencia: 280, factorRadio: 0.8, pagosHora: 105, segPago: 5 },
  9: { usuariosFrecuencia: 500, factorRadio: 0.65, pagosHora: 185, segPago: 3 },
};

/** El diseño de capacidad de Trama. */
export const CAPACIDAD_TRAMA = {
  /** Uso máximo del canal en la hora más cargada (%). */
  canalPicoPct: 15,
  /** Parte de los pagos del día que cae en la hora pico: día normal y día de mercado (%). */
  horaPicoNormalPct: 15,
  horaPicoMercadoPct: 25,
  /** Bytes de la orden firmada y del comprobante. */
  ordenBytes: 118,
  comprobanteBytes: 126,
  /** Radios (frecuencias) por sitio gateway y repetidores por sitio (anillo hexagonal de dos vueltas). */
  radiosPorSitio: 4,
  celdasPorSitio: 19,
  frecuenciasMhz: [920, 921.5, 924, 925.5],
  /** Densidad de usuarios por km² en la zona habitada. */
  densidades: [
    { valor: 0.2, nombre: "disperso" },
    { valor: 1, nombre: "medio" },
    { valor: 5, nombre: "denso" },
  ],
} as const;

/** Instalación y operación (COP). */
export const OPERACION_TRAMA = {
  instalacionSitio: 6_000_000,
  instalacionRepetidor: 800_000,
  inscripcionUsuario: 15_000,
  transportePct: 4,
  mantenimientoSitioMes: 400_000,
  starlinkMesComercial: 300_000,
  reposicionNodosPctAnual: 10,
  bateriaRepetidor: 60_000,
  visitaRepetidor: 300_000,
  vidaBateriaMeses: 36,
  soporteUsuarioMes: 250,
  aniosInversion: 5,
} as const;

export type RegionTrama = "Caribe" | "Andina" | "Pacífico" | "Pacífico/Andina" | "Orinoquía" | "Amazonía";

export const REGIONES_TRAMA: Record<RegionTrama, { terreno: TerrenoTrama; fraccion: number; logistica: number; solar: number; nota: string }> = {
  Caribe: { terreno: "sabana", fraccion: 0.6, logistica: 1.1, solar: 1, nota: "Llanuras y sabanas con mucho sol." },
  Andina: { terreno: "montana", fraccion: 0.5, logistica: 1.15, solar: 1.1, nota: "Montaña con veredas dispersas en las laderas." },
  Pacífico: { terreno: "rios", fraccion: 0.3, logistica: 1.6, solar: 1.4, nota: "Selva húmeda: la gente vive sobre los ríos." },
  "Pacífico/Andina": { terreno: "montana", fraccion: 0.5, logistica: 1.25, solar: 1.2, nota: "Cordillera y costa pacífica." },
  Orinoquía: { terreno: "sabana", fraccion: 0.3, logistica: 1.3, solar: 1, nota: "Llanos muy extensos y poco poblados." },
  Amazonía: { terreno: "rios", fraccion: 0.15, logistica: 1.6, solar: 1.2, nota: "Selva: comunidades sobre los ríos, acceso fluvial o aéreo." },
};

type FilaDepto = [string, string, RegionTrama, number, number, number, number, number, number, [number, number], number, Partial<{ terreno: TerrenoTrama; fraccion: number; logistica: number; nota: string }>?];

/** Departamentos: área (km²), personas rurales, proporción rural, adultos rurales, % hogares con internet, % rural que usa internet, adultos sin canal digital [mín, máx] y puesto. */
const FILAS: FilaDepto[] = [
  ["atlantico", "Atlántico", "Caribe", 3388, 114600, 0.04, 73300, 65.2, 76.5, [17200, 42100], 25, { terreno: "plano" }],
  ["bolivar", "Bolívar", "Caribe", 25978, 560300, 0.25, 358600, 70.7, 63.6, [130500, 173500], 7],
  ["cesar", "Cesar", "Caribe", 22905, 367300, 0.25, 235100, 66.9, 70.7, [68900, 128500], 13],
  ["cordoba", "Córdoba", "Caribe", 25020, 916700, 0.46, 586700, 55.7, 59, [240600, 429200], 2],
  ["guajira", "La Guajira", "Caribe", 20848, 480000, 0.45, 249600, 52.6, 52.9, [117600, 195400], 6, { terreno: "plano", fraccion: 0.8, logistica: 1.15, nota: "Plano y semidesértico: el mejor caso para la radio y el sol. La Alta y Media Guajira (Uribia y Manaure, ~245.000 personas rurales) concentran la población wayúu en rancherías; hay 2.553 georreferenciadas." }],
  ["magdalena", "Magdalena", "Caribe", 23188, 401600, 0.26, 257000, 77.5, 78.6, [55000, 95500], 16],
  ["sanandres", "San Andrés", "Caribe", 52, 15900, 0.25, 10200, 90, 88.5, [1200, 1700], 33, { terreno: "plano", fraccion: 1, logistica: 1.2, nota: "La ECV no mide el rural de San Andrés: se usó el dato departamental." }],
  ["sucre", "Sucre", "Caribe", 10917, 341300, 0.33, 218400, 58.3, 67.3, [71400, 150400], 10],
  ["antioquia", "Antioquia", "Andina", 63612, 1455000, 0.21, 989400, 73.4, 74.7, [250300, 434600], 1],
  ["bogota", "Bogotá D.C.", "Andina", 1775, 15900, 0.002, 10800, 82.9, 82.2, [1900, 3100], 32, { fraccion: 0.3, nota: "Población rural mínima, sobre todo en Sumapaz." }],
  ["boyaca", "Boyacá", "Andina", 23189, 529100, 0.41, 359800, 73.6, 72.2, [100000, 156800], 8],
  ["caldas", "Caldas", "Andina", 7888, 274200, 0.26, 186400, 71, 65, [65200, 89300], 15],
  ["cundinamarca", "Cundinamarca", "Andina", 24210, 1095900, 0.31, 745200, 70.5, 73.1, [200500, 363000], 3],
  ["huila", "Huila", "Andina", 19890, 483500, 0.4, 328800, 72.9, 79.5, [67400, 147100], 12],
  ["nsantander", "Norte de Santander", "Andina", 21658, 341900, 0.2, 232500, 79.5, 70.4, [68800, 78700], 18],
  ["quindio", "Quindío", "Andina", 1845, 70300, 0.13, 47800, 78.4, 81.3, [8900, 17000], 28, { nota: "Proporción rural del desagregado DANE 2025 (70.571 de 557.884)." }],
  ["risaralda", "Risaralda", "Andina", 4140, 200600, 0.2, 136400, 82.6, 70.9, [39700, 39700], 22],
  ["santander", "Santander", "Andina", 30537, 575600, 0.24, 391400, 79.3, 78.1, [85700, 133800], 11],
  ["tolima", "Tolima", "Andina", 23562, 429800, 0.31, 292300, 77.9, 72.9, [79200, 106700], 14],
  ["choco", "Chocó", "Pacífico", 46530, 296600, 0.5, 163100, 36.4, 48.3, [84300, 154900], 9, { nota: "Selva húmeda; la población rural vive sobre los ríos Atrato, San Juan y Baudó: se cubren los corredores (~30 % del área). Sismo de magnitud 7,4 el 10 de agosto de 2026. Cobertura 4G poblacional del 74 %, la más baja del país." }],
  ["cauca", "Cauca", "Pacífico/Andina", 29308, 975500, 0.61, 624300, 67.1, 75.4, [153600, 339200], 4, { logistica: 1.3 }],
  ["narino", "Nariño", "Pacífico/Andina", 33268, 856800, 0.5, 548300, 72, 69.6, [166700, 253500], 5, { logistica: 1.3 }],
  ["valle", "Valle del Cauca", "Pacífico/Andina", 22140, 565000, 0.12, 384200, 86.9, 83.2, [64500, 83100], 17, { logistica: 1.15 }],
  ["arauca", "Arauca", "Orinoquía", 23818, 83800, 0.3, 53600, 56.5, 78.5, [11500, 38500], 26],
  ["casanare", "Casanare", "Orinoquía", 44640, 127800, 0.27, 81800, 61.5, 73.7, [21500, 52000], 23],
  ["meta", "Meta", "Orinoquía", 85635, 277500, 0.24, 177600, 78.8, 81.9, [32100, 62200], 20, { fraccion: 0.25 }],
  ["vichada", "Vichada", "Orinoquía", 99095, 96700, 0.65, 53200, 23.3, 21.1, [42000, 50500], 21, { logistica: 1.4, nota: "Los peores indicadores de conectividad e inclusión financiera del país. Cumaribo (65.674 km²) concentra la población rural en 392 comunidades indígenas. Tres cuartas partes son sabana." }],
  ["amazonas", "Amazonas", "Amazonía", 109665, 46800, 0.55, 24300, 38.3, 44.2, [13600, 23100], 27, { fraccion: 0.08, logistica: 1.9 }],
  ["caqueta", "Caquetá", "Amazonía", 88965, 167300, 0.39, 107100, 71, 81.2, [20100, 51300], 24, { logistica: 1.5 }],
  ["guainia", "Guainía", "Amazonía", 72238, 25100, 0.42, 12500, 41.5, 35.7, [8100, 11900], 29, { fraccion: 0.1, logistica: 1.8, nota: "Población concentrada en Inírida; el resto en comunidades ribereñas con acceso solo fluvial o aéreo. Diferencias grandes entre la proyección DANE y otras fuentes." }],
  ["guaviare", "Guaviare", "Amazonía", 53460, 35600, 0.42, 22800, 71.1, 74.5, [5800, 10900], 31, { fraccion: 0.12 }],
  ["putumayo", "Putumayo", "Amazonía", 24885, 195400, 0.5, 125000, 64.6, 70.8, [36500, 73100], 19, { fraccion: 0.3, logistica: 1.4 }],
  ["vaupes", "Vaupés", "Amazonía", 54135, 22100, 0.5, 11000, 18.6, 40.2, [6600, 10500], 30, { fraccion: 0.1, logistica: 1.8, nota: "Mitú concentra el 72,6 % de la población; el resto vive en comunidades sobre el río Vaupés y sus afluentes." }],
];

export type DepartamentoTrama = {
  id: string;
  nombre: string;
  region: RegionTrama;
  areaKm2: number;
  rurales: number;
  propRural: number;
  adultos: number;
  hogaresInternetPct: number;
  ruralUsaInternetPct: number;
  /** Adultos rurales sin canal digital (mínimo y máximo). */
  sinCanal: [number, number];
  /** Puesto por número de adultos sin canal (1 = más). */
  puesto: number;
  terreno: TerrenoTrama;
  fraccion: number;
  logistica: number;
  solar: number;
  nota?: string;
};

export const DEPARTAMENTOS_TRAMA: readonly DepartamentoTrama[] = FILAS.map(([id, nombre, region, areaKm2, rurales, propRural, adultos, hogaresInternetPct, ruralUsaInternetPct, sinCanal, puesto, extra]) => {
  const r = REGIONES_TRAMA[region];
  return { id, nombre, region, areaKm2, rurales, propRural, adultos, hogaresInternetPct, ruralUsaInternetPct, sinCanal, puesto, terreno: r.terreno, fraccion: r.fraccion, logistica: r.logistica, solar: r.solar, ...extra };
}).sort((a, b) => a.puesto - b.puesto);

export type NodoUsuario = "xiao" | "t1000";

export type PedidoDimension = {
  usuarios: number;
  areaKm2: number;
  terreno: TerrenoTrama;
  sf: SfTrama;
  nodo: NodoUsuario;
  logistica: number;
  solar: number;
};

export type Dimension = {
  usuarios: number;
  areaKm2: number;
  /** Alcance por repetidor (km) y área de su hexágono (km²). */
  radioKm: number;
  celdaKm2: number;
  celdas: number;
  radios: number;
  sitios: number;
  repetidores: number;
  starlinks: number;
  enlaces: number;
  manda: "cobertura" | "capacidad";
  costo: { sitios: number; radios: number; repetidores: number; internet: number; nodos: number; instalacion: number; transporte: number; total: number };
  mensual: number;
  mensualDetalle: { starlink: number; sitios: number; repetidores: number; nodos: number; soporte: number };
  porUsuario: number;
  mensualPorUsuario: number;
  inversionMes: number;
  totalMesPorUsuario: number;
};

/**
 * Dimensionamiento de la red (el mismo cálculo del documento del Inge): celdas hexagonales de un repetidor
 * para cubrir el área, una radio cada 150 usuarios (SF11), sitios de hasta 4 radios y 19 celdas, Starlink cada 4,
 * 2 o 1 sitios según el terreno, y costos de inversión y de operación.
 */
export function dimensionarTrama(e: PedidoDimension, pr = PRECIOS, op = OPERACION_TRAMA): Dimension {
  const t = TERRENOS_TRAMA[e.terreno];
  const n = SF_TRAMA[e.sf];
  const o = Math.max(0, Math.round(e.usuarios));
  const l = t.radioKm * n.factorRadio;
  const d = 2.598 * l * l;
  const c = e.areaKm2 > 0 ? Math.ceil(e.areaKm2 / d) : 0;
  const p = o > 0 ? Math.ceil(o / n.usuariosFrecuencia) : 0;
  const x = Math.ceil(p / CAPACIDAD_TRAMA.radiosPorSitio);
  const m = Math.ceil(c / CAPACIDAD_TRAMA.celdasPorSitio);
  const u = o > 0 ? Math.max(1, x, m) : 0;
  const h = Math.max(p, u);
  const g = o > 0 ? Math.max(c, h) : 0;
  const f = u > 0 ? Math.ceil(u / t.sitiosPorStarlink) : 0;
  const j = u - f;
  const b = (e.solar - 1) * (pr.solarTorre * u + pr.solarStarlink * f);
  const v = pr.sitioBase * u + b;
  const y = pr.radio * h;
  const k = pr.repetidor * g;
  const w = pr.starlink * f + pr.enlace * j;
  const N = pr.nodo[e.nodo] * o;
  const S = v + y + k + w + N;
  const C = (op.instalacionSitio * u + op.instalacionRepetidor * g) * e.logistica + op.inscripcionUsuario * o;
  const z = S * (op.transportePct / 100) * e.logistica;
  const A = S + C + z;
  const M = {
    starlink: op.starlinkMesComercial * f,
    sitios: op.mantenimientoSitioMes * e.logistica * u,
    repetidores: ((op.bateriaRepetidor + op.visitaRepetidor * e.logistica) / op.vidaBateriaMeses) * g,
    nodos: (pr.nodo[e.nodo] * o * (op.reposicionNodosPctAnual / 100)) / 12,
    soporte: op.soporteUsuarioMes * o,
  };
  const P = Object.values(M).reduce((s, q) => s + q, 0);
  const q = A / (12 * op.aniosInversion);
  return {
    usuarios: o,
    areaKm2: e.areaKm2,
    radioKm: l,
    celdaKm2: d,
    celdas: c,
    radios: h,
    sitios: u,
    repetidores: g,
    starlinks: f,
    enlaces: j,
    manda: c > p ? "cobertura" : "capacidad",
    costo: { sitios: v, radios: y, repetidores: k, internet: w, nodos: N, instalacion: C, transporte: z, total: A },
    mensual: P,
    mensualDetalle: M,
    porUsuario: o ? A / o : 0,
    mensualPorUsuario: o ? P / o : 0,
    inversionMes: q,
    totalMesPorUsuario: o ? (P + q) / o : 0,
  };
}

/** Dimensionamiento de un departamento con la adopción elegida (por defecto, 30 % de los adultos sin canal). */
export function dimensionarDepartamento(dep: DepartamentoTrama, adopcionPct = 30, sf: SfTrama = 11, nodo: NodoUsuario = "xiao"): Dimension {
  return dimensionarTrama({
    usuarios: Math.round(((dep.sinCanal[0] + dep.sinCanal[1]) / 2) * (adopcionPct / 100)),
    areaKm2: dep.areaKm2 * dep.fraccion,
    terreno: dep.terreno,
    sf,
    nodo,
    logistica: dep.logistica,
    solar: dep.solar,
  });
}

/** Formato de pesos como en el documento: «$6,4 mil M», «$248 M», «$178.065». */
export function pesosTrama(v: number): string {
  const n = (x: number, d: number) => x.toLocaleString("es-CO", { maximumFractionDigits: d });
  if (v >= 1e9) return `$${n(v / 1e9, 1)} mil M`;
  if (v >= 1e6) return `$${n(v / 1e6, v >= 1e8 ? 0 : 1)} M`;
  return `$${Math.round(v).toLocaleString("es-CO")}`;
}
