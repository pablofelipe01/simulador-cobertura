// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Los datos de un pedido para el Modelo Melki: el modelo dice QUÉ se pide (la intención) y aquí se sacan, con las mismas
// reglas del intérprete, los datos con que se pide (la medida, el lugar, el nodo, la altura, la gente, la plata…). Con
// eso se arma la orden en las palabras que el intérprete entiende, y el intérprete la verifica antes de hacerla: el
// modelo nunca inventa una cifra ni un lugar.
import { circuloEnTexto, distanciaEnTexto, ladoEnTexto, medidasEnCifras, NUMERO, presupuestoEnTexto, rectanguloEnTexto, textoDicho, UNIDAD_AREA, usuariosEnTexto } from "../medidas";
import { numerosEnPalabras } from "../numeros";
import { AQUI, A_CUALQUIER_COSTO, candidatosLugar, extraerCoordenadas, NO_ES_LUGAR, nodosMencionados, RUMBOS, textoOrden, type Api } from "../ordenes";
import { decidirLugar } from "@/lib/geo/referencia";

export type Ranuras = {
  /** Lo dicho, tal cual. */
  texto: string;
  /** Lo dicho como lo compara el intérprete (minúsculas, sin tildes, números en cifras). */
  tn: string;
  /** Lo dicho antes de la posición («una casa a 800 m al este del Repetidor 3» → «una casa a 800 m»): ahí se nombra la pieza nueva. */
  tnPieza: string;
  /** La medida del círculo o la distancia («3 millas»); `diametro` si se dijo el diámetro. */
  dist?: { texto: string; diametro: boolean };
  /** El área, el rectángulo o el cuadrado («500 hectareas», «un área de 2 millas x 1 milla»). */
  area?: string;
  /** La gente que se debe atender («400 familias»). */
  gente?: string;
  /** El presupuesto como se dijo («80 millones»). */
  plata?: string;
  /** Un porcentaje («95 %»). */
  pct?: string;
  /** Una altura de torre o de antena («12 m»). */
  altura?: string;
  /** Un número suelto (personas de una zona, pagos al tiempo…). */
  cantidad?: number;
  /** Los nodos nombrados que existen en la red, en el orden dicho. */
  nodos: string[];
  /** El nodo desde el que se cuenta una posición («a 2 km al norte DEL GATEWAY»). */
  referencia?: string;
  /**
   * Un municipio o departamento dicho: con su nombre oficial si no hay duda («barranca de upia» → «Barranca de Upía»); si
   * puede ser varios, las palabras dichas con mayúscula, para que el intérprete pregunte «¿se refiere a…?» como siempre.
   */
  lugar?: string;
  /** El lugar reconocido es un departamento. */
  departamento?: boolean;
  /** «Aquí», «donde estoy»: el centro del mapa. */
  aqui: boolean;
  /** Una coordenada escrita («4.5149, -73.0024»). */
  coord?: string;
  /** Un rumbo («norte», «suroriente»). */
  rumbo?: string;
  /** Una capa del mapa, como la nombra el intérprete («las vías»). */
  capa?: string;
  /** El fondo del mapa («satelital», «topográfico», «de calles», «de curvas de nivel»). */
  fondo?: string;
  formato?: "kmz" | "csv" | "json";
  protocolo?: "Meshtastic" | "MeshCore";
  /** Un nombre nuevo (entre comillas o después de «como», «llamado», «con el nombre»). */
  nombre?: string;
  /** Qué se manda en la prueba de carga. */
  trafico: "pagos" | "mensajes de WhatsApp" | "consultas a la IA";
  estres: boolean;
  aCualquierCosto: boolean;
  respaldo: boolean;
  /** La clase de señal pedida («señal estable»). */
  senal?: string;
};

const CAPAS: [RegExp, string][] = [
  [/\b(zonas? sin (servicio|cobertura|senal)|areas? sin (servicio|cobertura|senal)|lo rojo|partes rojas|zonas rojas|donde no (hay|llega|tiene) (senal|cobertura|servicio)|sin cobertura|sin senal)\b/, "lo rojo"],
  [/\b(vias|carreteras|caminos|trochas|calles|autopistas)\b/, "las vías"],
  [/\b(rios|quebradas|cauces|cano|canos|hidrografia|fuentes hidricas|cuerpos de agua)\b/, "los ríos"],
  [/\b(limites|division politica|fronteras|linderos|bordes de los municipios)\b/, "los límites"],
  [/\b(nombres|etiquetas|poblados|pueblos|veredas)\b/, "los nombres"],
  [/\b(enlaces?|lineas entre (las )?antenas|conexiones entre)\b/, "los enlaces"],
  [/\b(alcance|rango de alcance|contornos?|hasta donde llega)\b/, "el alcance"],
  [/\bcirculos\b/, "los círculos de estudio"],
  [/\b(3d|tres dimensiones|tercera dimension)\b/, "el relieve en 3d"],
  [/\banillos\b/, "los anillos"],
  [/\b(haces|direccion de las antenas|conos)\b/, "los haces"],
];

const NOMBRE_NUEVO = /["“«']([^"”»']{2,40})["”»']/;
/** El nombre después de «como», «llamado», «con el nombre»… (en el texto sin tildes, con sus mayúsculas). */
const NOMBRE_DESPUES = /\b(?:como|llamad[oa]|que se llame|de nombre|por nombre|por el nombre de|con el nombre de|con el nombre|el nombre de|nombre de|ponle de nombre|pongale de nombre|ponle|pongale)\s+([a-z0-9][a-z0-9 ]{1,38}?)\s*$/i;
const VERBO_NOMBRE = /\b(renombr\w*|llam\w*|bautiz\w*|nombre|nombra\w*|titul\w*|guard\w*)\b/;
const MINUSCULAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en"]);

/** El nombre nuevo como se escribió («La Loma»); dictado en minúsculas, con mayúscula inicial en cada palabra. */
function nombreDicho(texto: string): string | undefined {
  const comillas = texto.match(NOMBRE_NUEVO)?.[1]?.trim();
  if (comillas) return comillas;
  const original = texto
    .normalize("NFC")
    .replace(/[.!?¡¿,;:]+\s*$/g, "")
    .replace(/\s+(por favor|porfa|porfis|gracias|please)\s*$/i, "")
    .trimEnd();
  const plano = original.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (plano.length !== original.length || !VERBO_NOMBRE.test(plano.toLowerCase())) return undefined;
  const m = plano.match(NOMBRE_DESPUES);
  if (!m || m.index === undefined) return undefined;
  const ini = m.index + m[0].lastIndexOf(m[1]);
  let nombre = original.slice(ini, ini + m[1].length).trim();
  if (!nombre || /^(el|la|un|una|nuevo|nueva)$/i.test(nombre)) return undefined;
  if (nombre === nombre.toLowerCase())
    nombre = nombre
      .split(" ")
      .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(" ");
  return nombre;
}

/** Números de un texto ya en cifras que no son medidas, alturas, porcentajes, plata, nombres de nodos ni coordenadas. */
function cantidadSuelta(bajo: string): number | undefined {
  const re = /(?<![\d.,-])(\d{1,3}(?:\.\d{3})+|\d+)(?![\d.,]*\d)(?!\s*(?:km|kms|kilometros?|m\b|mts?|metros?|millas?|mi\b|yardas?|yds?|pies|ft|cuadras?|%|por ciento|hectareas?|ha\b|has\b|km2|km²|millones|millon|mil millones|mm\b|db|dbm|dbi|mhz|grados|°|x\b|por\b))/g;
  for (const m of bajo.matchAll(re)) {
    const antes = bajo.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0);
    if (/(repetidor|persona|antena|gateway|nodo|torre|opcion|propuesta|zona|punto|paso|\$)\s*$/.test(antes)) continue;
    const v = Number(m[1].replace(/\./g, ""));
    if (v > 0 && v <= 100000) return v;
  }
  return undefined;
}

/** Prueba si unas palabras suenan a un municipio o departamento conocido (sin preguntar nada). */
function probarLugar(frase: string, api: Api, soloExacto: boolean) {
  const sinArticulo = frase.replace(/^(la|las|los|el)\s+/, "");
  if (sinArticulo.length < 3 || NO_ES_LUGAR.test(sinArticulo) || /\b(que|con|para|hacia|y|o|de|del|en|el|la|los|las|a|al|aqui|aca)$/.test(frase)) return null;
  if (/^(aqui|aca|alla|ahi|todo|toda|esta|este|esa|ese)\b/.test(sinArticulo)) return null;
  let c;
  try {
    c = candidatosLugar(frase, api)[0];
  } catch {
    c = undefined;
  }
  if (!c || !(c.exacto || (!soloExacto && c.puntaje >= 0.9))) return null;
  return c;
}

/**
 * Cómo se escribe el lugar en la orden (y en «Entendí: …»): con su nombre oficial si es uno solo sin duda; si no, las
 * palabras dichas con mayúscula («el carmen» → «El Carmen»), y el intérprete pregunta «¿se refiere a…?» como siempre.
 */
function nombreDelLugar(frase: string, api: Api): string {
  let oficial: string | null = null;
  try {
    const d = decidirLugar(candidatosLugar(frase, api));
    // Con el departamento, si se dijo («granada meta» → «Granada, Meta»: hay varias Granadas)
    if (d.tipo === "seguro" && /^[\p{L} ]+$/u.test(d.candidato.lugar.nombre))
      oficial = d.candidato.departamentoDicho && d.candidato.lugar.tipo === "municipio" ? `${d.candidato.lugar.nombre}, ${d.candidato.lugar.detalle}` : d.candidato.lugar.nombre;
  } catch {
    oficial = null;
  }
  if (oficial) return oficial;
  return frase
    .split(" ")
    .map((w, i) => (i > 0 && /^(de|del|la|las|los|el|y)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** El lugar dicho después de «en», «de», «cerca de»… (o al final de la frase), si suena a un municipio o departamento. */
function lugarDicho(tn: string, api: Api): { frase: string; departamento: boolean } | undefined {
  // Con la mirada adelante: «en todo el municipio de Restrepo» también prueba «de Restrepo»
  const re = /\b(?:en|alrededor de|cerca de|junto a|por|del municipio de|municipio de|de|del|para|a|hacia)\s+(?=(?:el municipio de |el pueblo de |la ciudad de |el departamento del? |el )?([a-z][a-z ]{2,60}))/g;
  let mejor: { frase: string; puntaje: number; departamento: boolean } | undefined;
  for (const m of tn.matchAll(re)) {
    const palabras = m[1].split(/\s+\d/)[0].trim().split(/\s+/).slice(0, 6);
    for (let k = palabras.length; k >= 1; k--) {
      const frase = palabras.slice(0, k).join(" ");
      const c = probarLugar(frase, api, false);
      if (c && (!mejor || c.puntaje > mejor.puntaje + 1e-9)) mejor = { frase, puntaje: c.puntaje, departamento: c.lugar.tipo === "departamento" };
    }
  }
  if (mejor) return { frase: mejor.frase, departamento: mejor.departamento };
  // Al final de la frase, sin preposición («¿qué inversión necesita el Meta?»): solo si es el nombre exacto
  const cola = tn
    .replace(/\b(por favor|porfa|gracias|ahora|ya|rapido)\b/g, " ")
    .trim()
    .split(/\s+/)
    .slice(-4);
  for (let k = cola.length; k >= 1; k--) {
    const frase = cola.slice(cola.length - k).join(" ");
    const c = probarLugar(frase, api, true);
    if (c) return { frase, departamento: c.lugar.tipo === "departamento" };
  }
  return undefined;
}

/** Distancia de edición entre dos palabras (para «repetdor 2» → Repetidor 2). */
function distanciaEdicion(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Un nodo mal escrito con su número («el repetdor 2», «la persna 1»): el nodo que se le parece, si es uno solo. */
function nodoParecido(tn: string, antenas: { nombre: string }[]): string | undefined {
  const dichos = [...tn.matchAll(/\b([a-z]{4,})\s+(\d{1,3})\b(?!\s*(?:km|kms|kilometros?|m|mts?|metros?|millas?|mi|yardas?|pies|cuadras?|%|personas|usuarios|pagos)\b)/g)];
  for (const [, palabra, numero] of dichos) {
    const parecidos = antenas.filter((a) => {
      const [tipo, num] = textoOrden(a.nombre).split(/\s+(?=\d+$)/);
      return num === numero && tipo && !tipo.includes(" ") && distanciaEdicion(palabra, tipo) <= (tipo.length >= 7 ? 2 : 1);
    });
    if (parecidos.length === 1) return parecidos[0].nombre;
  }
  return undefined;
}

/** «Repetidor 2 millas» es «repetidor a 2 millas», no el Repetidor 2 (el número va con la medida). */
const NODO_Y_MEDIDA = /\b(repetidor(?:es|as?)?|gateway|getway|pasarela|persona|antena|nodo|torre)\s+(\d+(?:[.,]\d+)?)\s*(km|kms|kilometros?|m|mts?|metros?|millas?|mi|yardas?|yd|pies|ft|cuadras?)\b/g;

/** Los datos de lo que se pidió. Sin `api` (en las pruebas del modelo) no hay nodos ni lugares. */
export function extraerRanuras(texto: string, api?: Api | null): Ranuras {
  let cifras = texto;
  try {
    cifras = numerosEnPalabras(medidasEnCifras(texto));
  } catch {
    // tal cual
  }
  const tn = textoOrden(cifras);
  // Lo mismo con los signos que el intérprete quita («%», «$», «²»)
  const bajo = cifras.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  const r: Ranuras = {
    texto,
    tn,
    tnPieza: tn.split(new RegExp(String.raw`\b(?:al|hacia el|hacia|rumbo al)\s+(?:${RUMBOS})\b`))[0],
    nodos: [],
    aqui: AQUI.test(tn) || /\b(aqui|aca)\b/.test(tn),
    trafico: /\b(whatsapps?|wasaps?|guasaps?|mensajes? de texto|chats?)\b/.test(tn) ? "mensajes de WhatsApp" : /\b(consultas?|preguntas?) (a|de) la (ia|inteligencia artificial)\b|\bconsultas? (de|a) ia\b/.test(tn) ? "consultas a la IA" : "pagos",
    estres: /\b(estres\w*|estresa\w*|hora pico|prueba de carga|reviente|revienta|aguant\w*|limite)\b/.test(tn),
    aCualquierCosto: A_CUALQUIER_COSTO.test(tn),
    respaldo: /\b(respaldo|redundan\w*|doble cobertura)\b/.test(tn),
  };
  // La altura de una torre o de una antena: pocos metros («12 m», «a 20 metros»), no un radio («500 m a la redonda»)
  // ni una distancia («a 50 m al norte», «a 40 m del gateway»)
  const alt = tn.match(new RegExp(String.raw`(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*(?:a la redonda|de radio|cuadrad|alrededor|(?:hacia )?(?:al|el|del) (?:${RUMBOS})\b|(?:del|de la|de el) (?:gateway|getway|pasarela|repetidor|persona|nodo|antena|torre)))`));
  if (alt && Number(alt[1].replace(",", ".")) <= 60) r.altura = `${alt[1]} m`;
  // La medida del círculo (o una distancia suelta que no sea esa altura)
  const circulo = circuloEnTexto(tn);
  if (circulo) r.dist = { texto: textoDicho(circulo.dicho), diametro: circulo.como === "diametro" };
  else {
    const d = distanciaEnTexto(tn);
    if (d && !(d.unidad === "m" && d.valor <= 60)) r.dist = { texto: textoDicho(d), diametro: false };
  }
  // El área: rectángulo, cuadrado o un área con su unidad
  const rect = rectanguloEnTexto(tn);
  const lado = rect ? null : ladoEnTexto(tn);
  const area = bajo.match(new RegExp(String.raw`${NUMERO}\s*${UNIDAD_AREA}`));
  if (rect) r.area = `un área de ${textoDicho(rect.ancho)} x ${textoDicho(rect.alto)}`;
  else if (lado) r.area = `un cuadrado de ${textoDicho(lado)} de lado`;
  else if (area) r.area = area[0].trim();
  if (r.area && r.dist && !circulo) r.dist = undefined;
  // La gente que se debe atender («para 400 familias», «conectar 400 familias»; no «400 personas alrededor de…»)
  const gente = usuariosEnTexto(tn);
  if (gente) r.gente = `${gente.n} ${gente.quienes}`;
  else {
    const g = tn.match(/\b(\d{1,3}(?:\.\d{3})+|\d+)\s+(usuarios?|personas|familias|hogares|billeteras|clientes|habitantes|suscriptores|abonados)\b(?!\s+(?:alrededor|a la redonda|en cada|cada|por (?:punto|nodo|repetidor|gateway|zona)|al tiempo|a la vez|al mismo tiempo|en el|en la|del|de la|al))/);
    if (g && /\b(conect\w*|atend\w*|atiend\w*|serv\w*|llegue a|llegar a|cubr\w*|darle|dar|alcance para|aguante|soporte|para)\b/.test(tn)) r.gente = `${g[1]} ${g[2]}`;
  }
  // El presupuesto («con un presupuesto de 80 millones», «con 80 millones», «$120.000.000»)
  const plata = presupuestoEnTexto(bajo);
  if (plata) r.plata = plata.dicho;
  else {
    // «con 80 millones» llega en cifras («con 80000000»): se dice en pesos para que el intérprete lo tome como plata
    const p = tn.match(/\b(?:con|por|de|hasta|maximo|no mas de|menos de|presupuesto de)\s+(\d{7,}|\d{1,3}(?:\.\d{3}){2,})\b(?!\s*(?:m|km|ha|hectareas|personas|usuarios|familias)\b)/);
    const v = p ? Number(p[1].replace(/\./g, "")) : 0;
    if (v >= 1e6) r.plata = `$${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  }
  const pct = bajo.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:%|por ciento|por 100\b)/);
  if (pct) r.pct = `${pct[1]} %`;
  const c = extraerCoordenadas(cifras);
  if (c) r.coord = `${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`;
  const rumbo = tn.match(new RegExp(String.raw`\b(${RUMBOS})\b`));
  if (rumbo) r.rumbo = rumbo[1];
  for (const [re, capa] of CAPAS)
    if (re.test(tn)) {
      r.capa = capa;
      break;
    }
  r.fondo = /\bsatelit\w*\b/.test(tn) ? "satelital" : /\b(curvas de nivel|opentopomap)\b/.test(tn) ? "de curvas de nivel" : /\btopograf\w*\b/.test(tn) ? "topográfico" : /\b(callejero|mapa de calles|de calles|openstreetmap|normal|estandar|el de siempre|clasico)\b/.test(tn) ? "de calles" : undefined;
  r.formato = /\b(kmz|kml|google earth)\b/.test(tn) ? "kmz" : /\b(csv|excel|hoja de calculo)\b/.test(tn) ? "csv" : /\bjson\b/.test(tn) ? "json" : undefined;
  r.protocolo = /\bme(sh|s)\s?t[a]?stic\w*\b/.test(tn) ? "Meshtastic" : /\bme(sh|s)\s?cor\w*\b/.test(tn) ? "MeshCore" : undefined;
  r.nombre = nombreDicho(texto);
  const senal = tn.match(/\bsenal (media|estable|buena|confiable|fuerte|excelente)\b/);
  if (senal) r.senal = `señal ${senal[1] === "fuerte" || senal[1] === "excelente" ? "buena" : senal[1]}`;
  r.cantidad = cantidadSuelta(bajo);
  if (api) {
    try {
      const antenas = api.antenas();
      r.nodos = nodosMencionados(tn, antenas).map((a) => a.nombre);
      // El nodo de referencia de una posición: el que se nombra después del rumbo (sin confundir «repetidor 2 millas»)
      const tras = tn.replace(NODO_Y_MEDIDA, "$1 a $2 $3").match(new RegExp(String.raw`\b(?:${RUMBOS})\s+(?:de|del|de la|desde)\s+(.+)$`));
      const ref = tras ? nodosMencionados(tras[1], antenas)[0] : undefined;
      if (ref) r.referencia = ref.nombre;
      else if (tras && /^(el )?(gateway|getway|pasarela)\b/.test(tras[1])) r.referencia = antenas.find((a) => a.pasarela && a.activa)?.nombre;
      // Un nodo mal escrito («sube el repetdor 2 a 12 m»)
      if (!r.nodos.length) {
        const parecido = nodoParecido(tn, antenas);
        if (parecido) r.nodos = [parecido];
      }
      // «El gateway» sin nombre: el que hay
      if (!r.nodos.length && /\b(gateway|getway|pasarela)\b/.test(tn)) {
        const g = antenas.find((a) => a.pasarela && a.activa);
        if (g) r.nodos = [g.nombre];
      }
    } catch {
      r.nodos = [];
    }
    const l = lugarDicho(tn, api);
    if (l) {
      r.lugar = nombreDelLugar(l.frase, api);
      r.departamento = l.departamento;
    }
  }
  return r;
}
