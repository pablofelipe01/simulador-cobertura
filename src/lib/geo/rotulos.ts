// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Nombres que el mapa pinta además de los datos de referencia: las ciudades principales (para ver las capitales con
// el mapa lejos, donde no se muestran los poblados de Esri), los océanos, mares, golfos y el lago de Maracaibo, y
// los nombres en inglés de los países, ríos y lagos que cambian de un idioma a otro (los nombres propios que se
// escriben igual no se traducen). Coordenadas de las ciudades: GeoNames (CC BY 4.0), redondeadas.

export type Ciudad = {
  es: string;
  /** Solo si en inglés se escribe distinto («Ciudad de Panamá» → «Panama City»). */
  en?: string;
  lat: number;
  lon: number;
  /** 1: capitales de país y las ciudades más grandes de Colombia; 2: grandes ciudades; 3: capitales de departamento y otras. */
  rango: 1 | 2 | 3;
  /** Municipio y departamento (DANE) de las ciudades de Colombia: con la ciudad a la vista no se repite su municipio. */
  municipio?: string;
  departamento?: string;
};

export const CIUDADES: Ciudad[] = [
  { es: "Bogotá", lat: 4.6097, lon: -74.0817, rango: 1, municipio: "Bogotá, D. C.", departamento: "Bogotá, D. C." },
  { es: "Medellín", lat: 6.245, lon: -75.5715, rango: 1, municipio: "Medellín", departamento: "Antioquia" },
  { es: "Cali", lat: 3.4305, lon: -76.5199, rango: 1, municipio: "Cali", departamento: "Valle del Cauca" },
  { es: "Barranquilla", lat: 10.9685, lon: -74.7813, rango: 1, municipio: "Barranquilla", departamento: "Atlántico" },
  { es: "Cartagena de Indias", en: "Cartagena", lat: 10.3982, lon: -75.4933, rango: 2, municipio: "Cartagena de Indias", departamento: "Bolívar" },
  { es: "Bucaramanga", lat: 7.125, lon: -73.1189, rango: 2, municipio: "Bucaramanga", departamento: "Santander" },
  { es: "Cúcuta", lat: 7.9074, lon: -72.5049, rango: 2, municipio: "Cúcuta", departamento: "Norte de Santander" },
  { es: "Villavicencio", lat: 4.1324, lon: -73.6256, rango: 2, municipio: "Villavicencio", departamento: "Meta" },
  { es: "Ibagué", lat: 4.4357, lon: -75.2029, rango: 3, municipio: "Ibagué", departamento: "Tolima" },
  { es: "Pereira", lat: 4.8143, lon: -75.6949, rango: 3, municipio: "Pereira", departamento: "Risaralda" },
  { es: "Manizales", lat: 5.0668, lon: -75.5068, rango: 3, municipio: "Manizales", departamento: "Caldas" },
  { es: "Armenia", lat: 4.5366, lon: -75.6726, rango: 3, municipio: "Armenia", departamento: "Quindío" },
  { es: "Neiva", lat: 2.93, lon: -75.2797, rango: 3, municipio: "Neiva", departamento: "Huila" },
  { es: "Pasto", lat: 1.2146, lon: -77.2785, rango: 3, municipio: "Pasto", departamento: "Nariño" },
  { es: "Popayán", lat: 2.4382, lon: -76.6132, rango: 3, municipio: "Popayán", departamento: "Cauca" },
  { es: "Montería", lat: 8.7508, lon: -75.8782, rango: 3, municipio: "Montería", departamento: "Córdoba" },
  { es: "Sincelejo", lat: 9.3045, lon: -75.3905, rango: 3, municipio: "Sincelejo", departamento: "Sucre" },
  { es: "Valledupar", lat: 10.4654, lon: -73.2531, rango: 3, municipio: "Valledupar", departamento: "Cesar" },
  { es: "Santa Marta", lat: 11.2386, lon: -74.1943, rango: 3, municipio: "Santa Marta", departamento: "Magdalena" },
  { es: "Riohacha", lat: 11.5444, lon: -72.9072, rango: 3, municipio: "Riohacha", departamento: "La Guajira" },
  { es: "Tunja", lat: 5.5448, lon: -73.3576, rango: 3, municipio: "Tunja", departamento: "Boyacá" },
  { es: "Yopal", lat: 5.3357, lon: -72.3939, rango: 3, municipio: "Yopal", departamento: "Casanare" },
  { es: "Arauca", lat: 7.0847, lon: -70.7591, rango: 3, municipio: "Arauca", departamento: "Arauca" },
  { es: "Quibdó", lat: 5.6919, lon: -76.6583, rango: 3, municipio: "Quibdó", departamento: "Chocó" },
  { es: "Florencia", lat: 1.6155, lon: -75.6041, rango: 3, municipio: "Florencia", departamento: "Caquetá" },
  { es: "Mocoa", lat: 1.1528, lon: -76.6521, rango: 3, municipio: "Mocoa", departamento: "Putumayo" },
  { es: "San José del Guaviare", lat: 2.568, lon: -72.6397, rango: 3, municipio: "San José del Guaviare", departamento: "Guaviare" },
  { es: "Puerto Carreño", lat: 6.1904, lon: -67.4839, rango: 3, municipio: "Puerto Carreño", departamento: "Vichada" },
  { es: "Inírida", lat: 3.8653, lon: -67.9239, rango: 3, municipio: "Inírida", departamento: "Guainía" },
  { es: "Mitú", lat: 1.2574, lon: -70.2355, rango: 3, municipio: "Mitú", departamento: "Vaupés" },
  { es: "Leticia", lat: -4.2108, lon: -69.9394, rango: 3, municipio: "Leticia", departamento: "Amazonas" },
  { es: "San Andrés", lat: 12.5786, lon: -81.6997, rango: 3, municipio: "San Andrés", departamento: "San Andrés y Providencia" },
  { es: "Caracas", lat: 10.488, lon: -66.8792, rango: 1 },
  { es: "Maracaibo", lat: 10.6423, lon: -71.6109, rango: 2 },
  { es: "Valencia", lat: 10.1615, lon: -68.0004, rango: 2 },
  { es: "Barquisimeto", lat: 10.0647, lon: -69.357, rango: 2 },
  { es: "Maracay", lat: 10.2497, lon: -67.5948, rango: 3 },
  { es: "Barcelona", lat: 10.1384, lon: -64.6877, rango: 3 },
  { es: "Maturín", lat: 9.7457, lon: -63.1832, rango: 3 },
  { es: "Ciudad Guayana", lat: 8.3512, lon: -62.641, rango: 3 },
  { es: "Ciudad Bolívar", lat: 8.1237, lon: -63.5469, rango: 3 },
  { es: "Puerto Ayacucho", lat: 5.6605, lon: -67.5834, rango: 3 },
  { es: "San Cristóbal", lat: 7.7659, lon: -72.2358, rango: 3 },
  { es: "Mérida", lat: 8.579, lon: -71.1692, rango: 3 },
  { es: "San Fernando de Apure", lat: 7.8896, lon: -67.4718, rango: 3 },
  { es: "Ciudad de Panamá", en: "Panama City", lat: 8.9936, lon: -79.5197, rango: 1 },
  { es: "Colón", lat: 9.3603, lon: -79.9002, rango: 3 },
  { es: "David", lat: 8.4273, lon: -82.4309, rango: 3 },
  { es: "San José", lat: 9.9339, lon: -84.0849, rango: 1 },
  { es: "Managua", lat: 12.1328, lon: -86.2504, rango: 1 },
  { es: "Tegucigalpa", lat: 14.0818, lon: -87.2068, rango: 1 },
  { es: "Kingston", lat: 17.997, lon: -76.7936, rango: 1 },
  { es: "Puerto Príncipe", en: "Port-au-Prince", lat: 18.5435, lon: -72.3388, rango: 1 },
  { es: "Santo Domingo", lat: 18.4719, lon: -69.8923, rango: 1 },
  { es: "La Habana", en: "Havana", lat: 23.133, lon: -82.383, rango: 1 },
  { es: "Puerto España", en: "Port of Spain", lat: 10.6667, lon: -61.5189, rango: 1 },
  { es: "Oranjestad", lat: 12.524, lon: -70.027, rango: 2 },
  { es: "Willemstad", lat: 12.1225, lon: -68.8864, rango: 2 },
  { es: "Georgetown", lat: 6.8045, lon: -58.1553, rango: 1 },
  { es: "Paramaribo", lat: 5.8664, lon: -55.1668, rango: 1 },
  { es: "Quito", lat: -0.2298, lon: -78.525, rango: 1 },
  { es: "Guayaquil", lat: -2.1962, lon: -79.8862, rango: 2 },
  { es: "Lima", lat: -12.0432, lon: -77.0282, rango: 1 },
  { es: "Iquitos", lat: -3.7481, lon: -73.2529, rango: 2 },
  { es: "Chiclayo", lat: -6.7701, lon: -79.855, rango: 3 },
  { es: "Manaos", en: "Manaus", lat: -3.1019, lon: -60.025, rango: 2 },
  { es: "Boa Vista", lat: 2.8197, lon: -60.6733, rango: 3 },
  { es: "Tabatinga", lat: -4.2312, lon: -69.9386, rango: 3 },
  { es: "Brasilia", en: "Brasília", lat: -15.7797, lon: -47.9297, rango: 1 },
  { es: "La Paz", lat: -16.5, lon: -68.15, rango: 1 },
];

export type Agua = {
  es: string;
  en: string;
  tipo: "oceano" | "mar" | "golfo" | "lago";
  /** Dónde va el nombre ([lat, lon]); los océanos tienen varios y se usa el que quede a la vista. */
  puntos: [number, number][];
};

export const AGUAS: Agua[] = [
  { es: "Océano Pacífico", en: "Pacific Ocean", tipo: "oceano", puntos: [[3.5, -80.6], [-4, -83.5], [11.5, -89.5]] },
  { es: "Océano Atlántico", en: "Atlantic Ocean", tipo: "oceano", puntos: [[9.5, -53.5], [1, -42]] },
  { es: "Mar Caribe", en: "Caribbean Sea", tipo: "mar", puntos: [[14.6, -75.5], [15.5, -67]] },
  { es: "Golfo del Darién", en: "Gulf of Darién", tipo: "golfo", puntos: [[9.1, -77.2]] },
  { es: "Golfo de Panamá", en: "Gulf of Panama", tipo: "golfo", puntos: [[8.25, -79.3]] },
  { es: "Golfo de Venezuela", en: "Gulf of Venezuela", tipo: "golfo", puntos: [[11.6, -71.1]] },
  { es: "Golfo de Paria", en: "Gulf of Paria", tipo: "golfo", puntos: [[10.4, -62.1]] },
  { es: "Golfo de Guayaquil", en: "Gulf of Guayaquil", tipo: "golfo", puntos: [[-3, -80.4]] },
  { es: "Lago de Maracaibo", en: "Lake Maracaibo", tipo: "lago", puntos: [[9.8, -71.6]] },
];

/** Países que en inglés se escriben distinto (los demás quedan igual: Colombia, Venezuela, Ecuador…). */
export const PAISES_EN: Record<string, string> = {
  Perú: "Peru",
  Surinam: "Suriname",
  Brasil: "Brazil",
  Haití: "Haiti",
  "República Dominicana": "Dominican Republic",
  Panamá: "Panama",
  Curazao: "Curaçao",
  "Trinidad y Tobago": "Trinidad and Tobago",
};

/** Ríos y lagos de los datos con su nombre completo o en inglés (los demás se escriben igual en los dos idiomas). */
export const AGUAS_DATOS: Record<string, { es: string; en: string }> = {
  Amazonas: { es: "Amazonas", en: "Amazon" },
  "Canal de Panamá": { es: "Canal de Panamá", en: "Panama Canal" },
  Valencia: { es: "Lago de Valencia", en: "Lake Valencia" },
  Guri: { es: "Embalse de Guri", en: "Guri Reservoir" },
  Camatagua: { es: "Embalse de Camatagua", en: "Camatagua Reservoir" },
  "del Guárico": { es: "Embalse del Guárico", en: "Guárico Reservoir" },
  Gatún: { es: "Lago Gatún", en: "Gatun Lake" },
};
