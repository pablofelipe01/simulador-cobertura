// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Trama · red por radio (MeshCore) para pagos, mensajes de WhatsApp y consultas a la IA donde no hay señal: equipos, precios, capacidad por frecuencia, cobertura por terreno y el
// dimensionamiento por departamento, tal como los trae el documento de trabajo del Inge «Territorios sin
// conectividad» (octubre de 2026). Son estimaciones de cálculo para planear; se ajustan midiendo
// el canal en una red piloto.
// Los textos visibles (nombres, detalles y notas) son getters: salen en el idioma de la pantalla al leerlos.
import { tx } from "../idioma";

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

/** Un artículo del catálogo con su nombre y su detalle en los dos idiomas (getters). */
const articulo = (id: string, grupo: ItemCatalogo["grupo"], nombre: [string, string], detalle: [string, string], resto: Pick<ItemCatalogo, "precio" | "moneda" | "periodo" | "importado">): ItemCatalogo => ({
  id,
  grupo,
  get nombre() {
    return tx(nombre[0], nombre[1]);
  },
  get detalle() {
    return tx(detalle[0], detalle[1]);
  },
  ...resto,
});

/** Catálogo del cotizador (los equipos de la red). */
export const CATALOGO: readonly ItemCatalogo[] = [
  articulo("minipc", "caja", ["Mini PC sin ventilador Intel N100, 16 GB / SSD 512 GB (Linux)", "Fanless mini PC Intel N100, 16 GB / 512 GB SSD (Linux)"], ["Ej. Minisforum UN100L; uno por torre", "E.g. Minisforum UN100L; one per tower"], { precio: 249, moneda: "USD", periodo: "unico", importado: true }),
  articulo("hub_usb", "caja", ["Hub USB alimentado 7 puertos (industrial, metálico)", "Powered 7-port USB hub (industrial, metal)"], ["Para las radios de la torre; precio de referencia", "For the tower's radios; reference price"], { precio: 220_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("ups", "caja", ["Mini UPS / respaldo de energía", "Mini UPS / power backup"], ["Aguanta cortes cortos de luz", "Rides through short power cuts"], { precio: 250_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("cajaip", "caja", ["Caja hermética IP65 + prensaestopas", "IP65 sealed enclosure + cable glands"], ["Para el mini PC y las radios en exterior", "For the mini PC and the radios outdoors"], { precio: 120_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("solar_kit", "energia", ["Kit solar para Starlink + caja (si no hay red eléctrica)", "Solar kit for Starlink + enclosure (if there is no grid power)"], ["Starlink gasta 75–100 W: ~400 W de panel + batería ~2 kWh + inversor", "Starlink draws 75–100 W: ~400 W of panels + ~2 kWh battery + inverter"], { precio: 4_500_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("solar_torre", "energia", ["Kit solar para torre sin red (mini PC + radios + enlace, ~30 W)", "Solar kit for an off-grid tower (mini PC + radios + link, ~30 W)"], ["~300 W de panel + batería LiFePO4 100 Ah + controlador; precio de referencia", "~300 W of panels + 100 Ah LiFePO4 battery + controller; reference price"], { precio: 2_600_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("tubo", "instalacion", ["Tubo de hierro 6 m", "6 m iron pipe"], ["Mástil para antena o repetidor", "Mast for an antenna or repeater"], { precio: 230_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("herrajes", "instalacion", ["Abrazaderas, templetes y tornillería (por mástil)", "Clamps, guy wires and hardware (per mast)"], ["", ""], { precio: 90_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("base", "instalacion", ["Base en concreto / anclaje (por mástil)", "Concrete base / anchoring (per mast)"], ["Cemento, arena, varilla", "Cement, sand, rebar"], { precio: 70_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("tierra", "instalacion", ["Pararrayos + polo a tierra (por sitio con gateway)", "Lightning rod + grounding (per gateway site)"], ["Varilla cobre-cobre, cable y conector", "Copper-clad rod, cable and connector"], { precio: 380_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("torre", "instalacion", ["Torre arriostrada 12 m (secciones, templetes y base)", "12 m guyed tower (sections, guy wires and base)"], ["Para separar en vertical las antenas de varias radios; precio de referencia", "To separate the antennas of several radios vertically; reference price"], { precio: 3_200_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("starlink_kit", "internet", ["Starlink kit Estándar V4", "Starlink Standard Kit V4"], ["Precio Homecenter", "Homecenter price"], { precio: 1_599_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("starlink_mes", "internet", ["Starlink Residencial Lite (mensual)", "Starlink Residential Lite (monthly)"], ["Hasta 200 Mb/s; el plan comercial de la operación es $300.000 al mes", "Up to 200 Mb/s; the operation's business plan is COP 300,000 per month"], { precio: 160_000, moneda: "COP", periodo: "mensual", importado: false }),
  articulo("ptp", "internet", ["Enlace WiFi punto a punto 5 GHz (par Ubiquiti LiteBeam 5AC Gen2)", "5 GHz point-to-point WiFi link (Ubiquiti LiteBeam 5AC Gen2 pair)"], ["Lleva el internet del Starlink a cada torre; 10–20 km con línea de vista", "Carries the Starlink internet to each tower; 10–20 km with line of sight"], { precio: 130, moneda: "USD", periodo: "unico", importado: true }),
  articulo("p1", "radio", ["SenseCAP Solar Node P1 (repetidor solar)", "SenseCAP Solar Node P1 (solar repeater)"], ["Panel 5 W, nRF52840 + SX1262, soporte incluido; MeshCore oficial. Lleva 4 pilas 18650 aparte", "5 W panel, nRF52840 + SX1262, mount included; official MeshCore. Takes 4 18650 cells, sold separately"], { precio: 72.9, moneda: "USD", periodo: "unico", importado: true }),
  articulo("pilas18650", "radio", ["Pilas 18650 para el P1 (juego de 4)", "18650 cells for the P1 (set of 4)"], ["~3.000 mAh; el P1-Pro ya las trae", "~3,000 mAh; the P1-Pro already includes them"], { precio: 60_000, moneda: "COP", periodo: "unico", importado: false }),
  articulo("antena8", "radio", ["Antena RF Explorer 8 dBi fibra de vidrio 1,3 m", "RF Explorer 8 dBi fiberglass antenna, 1.3 m"], ["902–928 MHz, trae 1 m de cable CFD200 y soporte", "902–928 MHz, comes with 1 m of CFD200 cable and a mount"], { precio: 29.9, moneda: "USD", periodo: "unico", importado: true }),
  articulo("coax", "radio", ["Cable N hembra → RP-SMA macho CFD400, 3 m", "N female → RP-SMA male CFD400 cable, 3 m"], ["Para bajar de la antena a la caja", "To run from the antenna down to the enclosure"], { precio: 19.9, moneda: "USD", periodo: "unico", importado: true }),
  articulo("t1000", "radio", ["SenseCAP T1000-E (nodo de la persona)", "SenseCAP T1000-E (the person's node)"], ["Tarjeta BLE + GPS, sellada, se empareja con el celular", "BLE + GPS card, sealed, pairs with the phone"], { precio: 39.9, moneda: "USD", periodo: "unico", importado: true }),
  articulo("t114", "radio", ["Heltec Mesh Node T114 (radio del gateway)", "Heltec Mesh Node T114 (gateway radio)"], ["Una por frecuencia, companion USB en el mini PC", "One per frequency, USB companion on the mini PC"], { precio: 27.9, moneda: "USD", periodo: "unico", importado: true }),
  articulo("xiao", "radio", ["Seeed XIAO ESP32S3 & Wio-SX1262 Kit (billetera económica)", "Seeed XIAO ESP32S3 & Wio-SX1262 Kit (budget wallet)"], ["BLE + LoRa; sin batería, carcasa ni GPS", "BLE + LoRa; no battery, case or GPS"], { precio: 11, moneda: "USD", periodo: "unico", importado: true }),
  articulo("bat_xiao", "radio", ["Batería LiPo ~1.000 mAh + carcasa para el XIAO", "~1,000 mAh LiPo battery + case for the XIAO"], ["Precio de referencia", "Reference price"], { precio: 40_000, moneda: "COP", periodo: "unico", importado: false }),
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
/** Terreno con su nombre y su nota en los dos idiomas (getters). */
const nuevoTerreno = (nombre: [string, string], radioKm: number, sitiosPorStarlink: number, nota: [string, string]) => ({
  get nombre() {
    return tx(nombre[0], nombre[1]);
  },
  radioKm,
  sitiosPorStarlink,
  get nota() {
    return tx(nota[0], nota[1]);
  },
});

export const TERRENOS_TRAMA: Record<TerrenoTrama, { nombre: string; radioKm: number; sitiosPorStarlink: number; nota: string }> = {
  plano: nuevoTerreno(["Plano / semidesierto", "Flat / semi-desert"], 10, 4, ["Línea de vista larga: el mejor caso para la radio y el sol.", "Long line of sight: the best case for radio and sun."]),
  sabana: nuevoTerreno(["Sabana", "Savanna"], 8, 4, ["Abierta, con bosques de galería en los ríos.", "Open, with gallery forests along the rivers."]),
  montana: nuevoTerreno(["Montaña", "Mountains"], 5, 2, ["De loma a loma llega lejos; los valles cerrados se tapan.", "From hilltop to hilltop it reaches far; closed valleys get blocked."]),
  rios: nuevoTerreno(["Ríos en selva", "Jungle rivers"], 5, 1, ["La radio corre sobre el agua; el bosque la frena a los lados.", "Radio travels over the water; the forest stops it on the sides."]),
  selva: nuevoTerreno(["Selva cerrada", "Dense jungle"], 3, 1, ["El follaje mojado se come la señal: celdas pequeñas.", "Wet foliage eats the signal: small cells."]),
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
    {
      valor: 0.2,
      get nombre() {
        return tx("disperso", "sparse");
      },
    },
    {
      valor: 1,
      get nombre() {
        return tx("medio", "medium");
      },
    },
    {
      valor: 5,
      get nombre() {
        return tx("denso", "dense");
      },
    },
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

/** Región con su nota en los dos idiomas (getter). */
const nuevaRegion = (terreno: TerrenoTrama, fraccion: number, logistica: number, solar: number, nota: [string, string]) => ({
  terreno,
  fraccion,
  logistica,
  solar,
  get nota() {
    return tx(nota[0], nota[1]);
  },
});

export const REGIONES_TRAMA: Record<RegionTrama, { terreno: TerrenoTrama; fraccion: number; logistica: number; solar: number; nota: string }> = {
  Caribe: nuevaRegion("sabana", 0.6, 1.1, 1, ["Llanuras y sabanas con mucho sol.", "Plains and savannas with plenty of sun."]),
  Andina: nuevaRegion("montana", 0.5, 1.15, 1.1, ["Montaña con veredas dispersas en las laderas.", "Mountains with scattered rural settlements on the slopes."]),
  Pacífico: nuevaRegion("rios", 0.3, 1.6, 1.4, ["Selva húmeda: la gente vive sobre los ríos.", "Rainforest: people live along the rivers."]),
  "Pacífico/Andina": nuevaRegion("montana", 0.5, 1.25, 1.2, ["Cordillera y costa pacífica.", "Mountain range and Pacific coast."]),
  Orinoquía: nuevaRegion("sabana", 0.3, 1.3, 1, ["Llanos muy extensos y poco poblados.", "Very extensive, sparsely populated plains."]),
  Amazonía: nuevaRegion("rios", 0.15, 1.6, 1.2, ["Selva: comunidades sobre los ríos, acceso fluvial o aéreo.", "Jungle: communities along the rivers, access by river or air."]),
};

/** Nombre de una región natural de Colombia en el idioma de la pantalla (la clave sigue en español). */
export function nombreRegion(r: RegionTrama): string {
  const en: Record<RegionTrama, string> = { Caribe: "Caribbean", Andina: "Andean", Pacífico: "Pacific", "Pacífico/Andina": "Pacific/Andean", Orinoquía: "Orinoquía", Amazonía: "Amazon" };
  return tx(r, en[r]);
}

type FilaDepto = [string, string, RegionTrama, number, number, number, number, number, number, [number, number], number, Partial<{ terreno: TerrenoTrama; fraccion: number; logistica: number; nota: string }>?];

/** Las notas de los departamentos en inglés (por id; las de español están en cada fila). */
const NOTAS_EN: Record<string, string> = {
  guajira:
    "Flat and semi-desert: the best case for radio and sun. Upper and Middle La Guajira (Uribia and Manaure, ~245,000 rural residents) concentrate the Wayuu population in rancherías; 2,553 are georeferenced.",
  sanandres: "The ECV survey doesn't measure rural San Andrés: the department-wide figure was used.",
  bogota: "Minimal rural population, mostly in Sumapaz.",
  quindio: "Rural share from the DANE 2025 breakdown (70,571 of 557,884).",
  choco: "Rainforest; the rural population lives along the Atrato, San Juan and Baudó rivers: the corridors are covered (~30% of the area). Magnitude 7.4 earthquake on August 10, 2026. 4G population coverage of 74%, the lowest in the country.",
  vichada: "The worst connectivity and financial inclusion indicators in the country. Cumaribo (65,674 km²) concentrates the rural population in 392 Indigenous communities. Three quarters is savanna.",
  guainia: "Population concentrated in Inírida; the rest in riverside communities reachable only by river or air. Large differences between the DANE projection and other sources.",
  vaupes: "Mitú concentrates 72.6% of the population; the rest live in communities along the Vaupés River and its tributaries.",
};

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
  const { nota, ...resto }: NonNullable<FilaDepto[11]> = extra ?? {};
  const d: DepartamentoTrama = { id, nombre, region, areaKm2, rurales, propRural, adultos, hogaresInternetPct, ruralUsaInternetPct, sinCanal, puesto, terreno: r.terreno, fraccion: r.fraccion, logistica: r.logistica, solar: r.solar, ...resto };
  // La nota (si la hay) sale en el idioma de la pantalla al leerla
  if (nota !== undefined) Object.defineProperty(d, "nota", { get: () => tx(nota, NOTAS_EN[id] ?? nota), enumerable: true, configurable: true });
  return d;
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

export type CostoRed = {
  gateways: number;
  repetidores: number;
  personas: number;
  /** Inversión (COP): sitios del gateway, repetidores, equipos de la gente, instalación y transporte. */
  inversion: { sitios: number; repetidores: number; personas: number; instalacion: number; transporte: number; total: number };
  /** Operación mensual (COP): internet, mantenimiento de los sitios, baterías y visitas a los repetidores, soporte. */
  mensual: { internet: number; sitios: number; repetidores: number; soporte: number; total: number };
  /** La inversión repartida en los años del documento, más la operación: lo que cuesta la red al mes. */
  totalMes: number;
  logistica: number;
};

/**
 * Lo que cuesta una red concreta con los precios del documento de Trama: cada gateway es un sitio completo (mini PC,
 * hub, UPS, caja, tierra, torre de 12 m, kit solar, una radio T114 y Starlink con su kit solar); cada repetidor, un P1
 * solar con pilas, antena de 8 dBi, cable, tubo de 6 m, herrajes y base; cada persona, su billetera. `logistica`
 * encarece instalación, transporte y visitas según la región (1 = sin recargo).
 */
export function costoRedTrama(gateways: number, repetidores: number, personas = 0, nodo: NodoUsuario = "xiao", logistica = 1, pr = PRECIOS, op = OPERACION_TRAMA): CostoRed {
  const g = Math.max(0, Math.round(gateways));
  const r = Math.max(0, Math.round(repetidores));
  const p = Math.max(0, Math.round(personas));
  const sitios = (pr.sitioBase + pr.radio + pr.starlink) * g;
  const reps = pr.repetidor * r;
  const nodos = pr.nodo[nodo] * p;
  const equipos = sitios + reps + nodos;
  const instalacion = (op.instalacionSitio * g + op.instalacionRepetidor * r) * logistica + op.inscripcionUsuario * p;
  const transporte = equipos * (op.transportePct / 100) * logistica;
  const total = equipos + instalacion + transporte;
  const mensual = {
    internet: op.starlinkMesComercial * g,
    sitios: op.mantenimientoSitioMes * logistica * g,
    repetidores: ((op.bateriaRepetidor + op.visitaRepetidor * logistica) / op.vidaBateriaMeses) * r,
    soporte: op.soporteUsuarioMes * p,
  };
  const totalMensual = mensual.internet + mensual.sitios + mensual.repetidores + mensual.soporte;
  return {
    gateways: g,
    repetidores: r,
    personas: p,
    inversion: { sitios, repetidores: reps, personas: nodos, instalacion, transporte, total },
    mensual: { ...mensual, total: totalMensual },
    totalMes: total / (12 * op.aniosInversion) + totalMensual,
    logistica,
  };
}

/** Formato de pesos como en el documento: «$6,4 mil M», «$248 M», «$178.065» (en inglés: «COP 6.4 B», «COP 248 M», «COP 178,065»). */
export function pesosTrama(v: number): string {
  const n = (x: number, d: number) => x.toLocaleString("es-CO", { maximumFractionDigits: d });
  const nEn = (x: number, d: number) => x.toLocaleString("en-US", { maximumFractionDigits: d });
  if (v >= 1e9) return tx(`$${n(v / 1e9, 1)} mil M`, `COP ${nEn(v / 1e9, 1)} B`);
  if (v >= 1e6) return tx(`$${n(v / 1e6, v >= 1e8 ? 0 : 1)} M`, `COP ${nEn(v / 1e6, v >= 1e8 ? 0 : 1)} M`);
  return tx(`$${Math.round(v).toLocaleString("es-CO")}`, `COP ${Math.round(v).toLocaleString("en-US")}`);
}
