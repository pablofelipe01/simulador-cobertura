// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Medidas y cantidades de un pedido: distancias en km, metros, millas (terrestres y náuticas), yardas, pies y cuadras;
// el círculo de un pedido («5 millas a la redonda», «en un radio de 800 yardas», «10 km de diámetro»), el rectángulo
// («2 × 1 millas») y el cuadrado («de 3 km de lado»); el presupuesto («con 80 millones», «USD 25.000») y la gente a
// atender («para 400 familias»). Los números dichos en palabras pegados a una unidad se pasan a cifras («cinco
// millas», «un kilómetro y medio», «media milla»).
import { COTIZADOR } from "@/lib/radio/trama";

import { numeroDePalabras } from "./numeros";

/** Minúsculas y sin tildes, conservando símbolos como «²», «%» y «$». */
export const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

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

/** Un número con «mil» opcional: grupos 1 (cifra) y 2 («mil»). */
export const NUMERO = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?:\s*(mil(?:es)?)\b)?`;

/* ───────────── Distancias ───────────── */

export type UnidadLongitud = "km" | "m" | "mi" | "nmi" | "yd" | "ft" | "cuadra";

export const LONGITUDES: Record<UnidadLongitud, { metros: number; singular: string; plural: string; simbolo: string }> = {
  km: { metros: 1000, singular: "kilómetro", plural: "kilómetros", simbolo: "km" },
  m: { metros: 1, singular: "metro", plural: "metros", simbolo: "m" },
  mi: { metros: 1609.344, singular: "milla", plural: "millas", simbolo: "mi" },
  nmi: { metros: 1852, singular: "milla náutica", plural: "millas náuticas", simbolo: "NM" },
  yd: { metros: 0.9144, singular: "yarda", plural: "yardas", simbolo: "yd" },
  ft: { metros: 0.3048, singular: "pie", plural: "pies", simbolo: "ft" },
  // Una cuadra de pueblo colombiano: unos 100 m (de esquina a esquina, con la calle)
  cuadra: { metros: 100, singular: "cuadra", plural: "cuadras", simbolo: "cuadras" },
};

/** Cómo se escriben o se dicen (en minúsculas y sin tildes); lo más largo primero. Grupo 1: la unidad. */
export const UNIDAD_LONGITUD = String.raw`(millas?\s+nauticas?|nmi|kilometros?|kms?|millas?|mi|metros?|mts?|m|yardas?|yds?|pies|pie|ft|cuadras?)(?![a-z0-9²])`;

export function unidadDe(txt: string): UnidadLongitud | null {
  const u = txt.trim().replace(/\s+/g, " ");
  if (/^(millas? nauticas?|nmi)$/.test(u)) return "nmi";
  if (/^(kilometros?|kms?)$/.test(u)) return "km";
  if (/^(millas?|mi)$/.test(u)) return "mi";
  if (/^(metros?|mts?|m)$/.test(u)) return "m";
  if (/^(yardas?|yds?)$/.test(u)) return "yd";
  if (/^(pies|pie|ft)$/.test(u)) return "ft";
  if (/^cuadras?$/.test(u)) return "cuadra";
  return null;
}

export type Distancia = { valor: number; unidad: UnidadLongitud; metros: number };

export function distancia(valor: number, unidad: UnidadLongitud): Distancia {
  return { valor, unidad, metros: valor * LONGITUDES[unidad].metros };
}

/** «1,5», «8,05», «20»: con coma decimal y sin ceros de más. */
export function cifra(x: number, d = 2): string {
  const r = Number(x.toFixed(d));
  return Number.isInteger(r) ? r.toLocaleString("es-CO") : r.toLocaleString("es-CO", { maximumFractionDigits: d });
}

/** «850 m», «8,05 km», «12,9 km», «160 km». */
export function textoMetros(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${cifra(km, km < 10 ? 2 : km < 100 ? 1 : 0)} km`;
}

/** «8 km», «800 m», «5 millas (8,05 km)», «300 yardas (274 m)», «2 cuadras (200 m)». */
export function textoDistancia(d: Distancia): string {
  const u = LONGITUDES[d.unidad];
  if (d.unidad === "km" || d.unidad === "m") return `${cifra(d.valor)} ${u.simbolo}`;
  return `${cifra(d.valor)} ${d.valor === 1 ? u.singular : u.plural} (${textoMetros(d.metros)})`;
}

/** Lo dicho en la unidad dicha, sin la conversión: «5 millas», «8 km». */
export function textoDicho(d: Distancia): string {
  const u = LONGITUDES[d.unidad];
  if (d.unidad === "km" || d.unidad === "m") return `${cifra(d.valor)} ${u.simbolo}`;
  return `${cifra(d.valor)} ${d.valor === 1 ? u.singular : u.plural}`;
}

const MEDIDA = String.raw`${NUMERO}\s*${UNIDAD_LONGITUD}`;
const deMedida = (m: RegExpMatchArray, i: number): Distancia | null => {
  const u = unidadDe(m[i + 2] ?? "");
  const v = leerNumero(`${m[i]}${m[i + 1] ? " mil" : ""}`);
  return u && v > 0 ? distancia(v, u) : null;
};

/** La primera distancia escrita en el texto (sin tildes), con su unidad. */
export function distanciaEnTexto(bajo: string): Distancia | null {
  const m = bajo.match(new RegExp(MEDIDA));
  return m ? deMedida(m, 1) : null;
}

/** ¿Trae una distancia con unidad («5 millas», «800 m»)? */
export const tieneDistancia = (bajo: string) => new RegExp(MEDIDA).test(bajo);

export type Circulo = { radio: Distancia; dicho: Distancia; como: "radio" | "diametro" | "supuesto" };

/**
 * El círculo de un pedido: «5 millas a la redonda», «en un radio de 800 yardas», «3 km de radio», «2 km alrededor
 * del gateway», «un diámetro de 10 km» o «10 km de diámetro» (el radio es la mitad).
 */
export function circuloEnTexto(bajo: string): Circulo | null {
  const radio =
    bajo.match(new RegExp(String.raw`\b(?:en\s+)?(?:un\s+)?radio\s+de\s+(?:unos?\s+|unas\s+|como\s+|aproximadamente\s+|cerca\s+de\s+)?${MEDIDA}`)) ??
    bajo.match(new RegExp(String.raw`${MEDIDA}\s+(?:de\s+radio|a\s+la\s+redonda|al\s+rededor|alrededor|en\s+torno|a\s+su\s+alrededor)`));
  if (radio) {
    const d = deMedida(radio, 1);
    if (d) return { radio: d, dicho: d, como: "radio" };
  }
  const diam = bajo.match(new RegExp(String.raw`\bdiametro\s+de\s+(?:unos?\s+|unas\s+)?${MEDIDA}`)) ?? bajo.match(new RegExp(String.raw`${MEDIDA}\s+de\s+diametro`));
  if (diam) {
    const d = deMedida(diam, 1);
    if (d) return { radio: distancia(d.valor / 2, d.unidad), dicho: d, como: "diametro" };
  }
  // «Una red de 5 km», «una malla de 3 millas»: sin decir si es radio o lado, se toma como radio (y se dice así)
  const suelta = bajo.match(new RegExp(String.raw`\b(?:red|redes|malla|cobertura)\s+de\s+(?:unos?\s+|unas\s+|como\s+)?${MEDIDA}(?!\s*(?:por|x|×|de\s+lado|por\s+lado|cuadrad|de\s+ancho|de\s+largo))`));
  if (suelta) {
    const d = deMedida(suelta, 1);
    if (d && d.unidad !== "m" && d.unidad !== "ft") return { radio: d, dicho: d, como: "supuesto" };
  }
  return null;
}

/** «2 × 1 millas», «4 km por 3 km», «500 x 800 m» (la primera unidad puede faltar: toma la segunda). */
export function rectanguloEnTexto(bajo: string): { ancho: Distancia; alto: Distancia } | null {
  const m = bajo.match(new RegExp(String.raw`${NUMERO}\s*(?:${UNIDAD_LONGITUD})?\s*(?:por|x|×)\s*${MEDIDA}`));
  if (!m) return null;
  const u2 = unidadDe(m[6] ?? "");
  const u1 = m[3] ? unidadDe(m[3]) : u2;
  const v1 = leerNumero(`${m[1]}${m[2] ? " mil" : ""}`);
  const v2 = leerNumero(`${m[4]}${m[5] ? " mil" : ""}`);
  if (!u1 || !u2 || !(v1 > 0) || !(v2 > 0)) return null;
  return { ancho: distancia(v1, u1), alto: distancia(v2, u2) };
}

/** «Un cuadrado de 3 km de lado», «de 2 millas por lado». */
export function ladoEnTexto(bajo: string): Distancia | null {
  const m = bajo.match(new RegExp(String.raw`cuadrad\w*\s+de\s+${MEDIDA}\s+(?:de|por)\s+lado`)) ?? bajo.match(new RegExp(String.raw`${MEDIDA}\s+(?:de|por)\s+lado`));
  return m ? deMedida(m, 1) : null;
}

/* ───────────── Áreas ───────────── */

/** Unidades de área (grupo 1); lo más largo primero. */
export const UNIDAD_AREA = String.raw`(hectareas?|hectarias?|has?(?![a-z])|km\s?2(?![0-9])|km²|kms?\s+cuadrados?|kilometros?\s+cuadrados?|metros?\s+cuadrados?|m\s?2(?![0-9])|m²|millas?\s+cuadradas?|mi\s?2(?![0-9])|mi²|yardas?\s+cuadradas?|yd\s?2(?![0-9])|yd²|pies?\s+cuadrados?|ft\s?2(?![0-9])|ft²|fanegadas?|acres?)`;

/** m² por unidad de área. */
export function factorArea(unidad: string): number {
  const u = unidad.replace(/\s+/g, " ");
  if (/^h/.test(u)) return 1e4;
  if (/^(km|kms|kilometro)/.test(u)) return 1e6;
  if (/^(milla|mi)/.test(u)) return 2_589_988.110336;
  if (/^(yarda|yd)/.test(u)) return 0.83612736;
  if (/^(pie|ft)/.test(u)) return 0.09290304;
  if (/^fanegada/.test(u)) return 6400;
  if (/^acre/.test(u)) return 4046.8564224;
  return 1;
}

/** «2 millas cuadradas», «5.000 yardas cuadradas»: la unidad imperial como se dice (null si es métrica o hectáreas). */
export function unidadAreaImperial(unidad: string, valor: number): string | null {
  const u = unidad.replace(/\s+/g, " ");
  const uno = valor === 1;
  if (/^(milla|mi)/.test(u)) return uno ? "milla cuadrada" : "millas cuadradas";
  if (/^(yarda|yd)/.test(u)) return uno ? "yarda cuadrada" : "yardas cuadradas";
  if (/^(pie|ft)/.test(u)) return uno ? "pie cuadrado" : "pies cuadrados";
  if (/^acre/.test(u)) return uno ? "acre" : "acres";
  if (/^fanegada/.test(u)) return uno ? "fanegada" : "fanegadas";
  return null;
}

/* ───────────── Números dichos en palabras junto a una unidad ───────────── */

const PALABRA_NUMERO =
  "cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiun|veintiuno|veintiuna|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscient[oa]s|trescient[oa]s|cuatrocient[oa]s|quinient[oa]s|seiscient[oa]s|setecient[oa]s|ochocient[oa]s|novecient[oa]s|mil";
const UNIDAD_DICHA = String.raw`kilometros?|kms?|millas?|metros?|yardas?|pies|pie|cuadras?|hectareas?`;
/** Lo que puede venir después del número: una unidad de longitud o de área, «por ciento» o «millones». */
const DESPUES = String.raw`(?:${UNIDAD_AREA.slice(1, -1)}|millas?\s+nauticas?|nmi|kilometros?|kms?|millas?|metros?|mts?|yardas?|yds?|pies|pie|cuadras?|por\s+ciento|millones|millon)(?![a-z])`;
const SECUENCIA = String.raw`((?:${PALABRA_NUMERO})(?:\s+(?:${PALABRA_NUMERO}|y))*)`;
const RE_Y_MEDIO_PALABRAS = new RegExp(String.raw`\b${SECUENCIA}\s+y\s+medi[oa]\s+(?=${UNIDAD_DICHA})`, "g");
const RE_Y_MEDIO_CIFRAS = new RegExp(String.raw`\b(\d+(?:[.,]\d+)?)\s+y\s+medi[oa]\s+(?=${UNIDAD_DICHA})`, "g");
// No después de una cifra («1,2 mil millones» ya está en cifras)
const RE_PALABRAS = new RegExp(String.raw`(?<![0-9]\s)\b${SECUENCIA}\s+(?=${DESPUES})`, "g");
const RE_UNIDAD_Y_MEDIO = new RegExp(String.raw`\b(\d+(?:[.,]\d+)?)(\s+(?:${UNIDAD_DICHA}))\s+y\s+medi[oa]\b`, "g");
const RE_MEDIO = new RegExp(String.raw`\bmedi[oa](?=\s+(?:${UNIDAD_DICHA})\b)`, "g");

/**
 * El texto en minúsculas y sin tildes, letra por letra (del mismo largo que el original), para buscar con expresiones
 * sin tildes y cambiar el texto original en las mismas posiciones.
 */
function plano(texto: string): string {
  let s = "";
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    const x = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    s += x.length === 1 ? x : x.length === 0 ? "\u0001" : ch;
  }
  return s;
}

type Cambio = { desde: number; hasta: number; por: string };

function reemplazar(t: string, re: RegExp, cambio: (m: RegExpMatchArray, desde: number) => Cambio | null): string {
  const cambios: Cambio[] = [];
  for (const m of plano(t).matchAll(re)) {
    const c = cambio(m, m.index ?? 0);
    if (c) cambios.push(c);
  }
  let s = t;
  for (const c of cambios.reverse()) s = s.slice(0, c.desde) + c.por + s.slice(c.hasta);
  return s;
}

/** «1.5», «2»: el número que se escribe en el texto (con punto decimal, como lo lee el intérprete). */
const escrito = (v: number) => String(Number(v.toFixed(6)));

/**
 * Pasa a cifras los números en palabras que van con una unidad («cinco millas» → «5 millas», «dos mil metros» →
 * «2000 metros», «noventa y cinco por ciento» → «95 por ciento», «ochenta millones» → «80 millones»), y el «y medio»:
 * «un kilómetro y medio» → «1.5 kilómetro», «dos y media millas» → «2.5 millas», «media milla» → «0.5 milla». Lo demás
 * del texto queda igual (los nombres de lugares con números, como Tres Esquinas, no se tocan).
 */
export function medidasEnCifras(texto: string): string {
  let t = reemplazar(texto, RE_Y_MEDIO_PALABRAS, (m, desde) => {
    const v = numeroDePalabras(m[1]);
    return v === null ? null : { desde, hasta: desde + m[0].length, por: `${escrito(v + 0.5)} ` };
  });
  t = reemplazar(t, RE_Y_MEDIO_CIFRAS, (m, desde) => ({ desde, hasta: desde + m[0].length, por: `${escrito(Number(m[1].replace(",", ".")) + 0.5)} ` }));
  t = reemplazar(t, RE_PALABRAS, (m, desde) => {
    const v = numeroDePalabras(m[1]);
    return v === null ? null : { desde, hasta: desde + m[1].length, por: escrito(v) };
  });
  // «1 kilómetro y medio» → «1.5 kilómetro»: la unidad queda como se escribió
  const conUnidad = t;
  t = reemplazar(conUnidad, RE_UNIDAD_Y_MEDIO, (m, desde) => {
    const unidad = conUnidad.slice(desde + m[1].length, desde + m[1].length + m[2].length);
    return { desde, hasta: desde + m[0].length, por: `${escrito(Number(m[1].replace(",", ".")) + 0.5)}${unidad}` };
  });
  t = reemplazar(t, RE_MEDIO, (_m, desde) => ({ desde, hasta: desde + 5, por: "0.5" }));
  return t;
}

/* ───────────── Presupuesto y gente a atender ───────────── */

export type Presupuesto = { cop: number; dicho: string; dolares?: number };

const PIDE_PLATA = /\b(presupuesto|invertir|inversion|gastar|plata|dinero|capital|que no (?:cueste|pase|supere|valga)|costo maximo|tope|que cueste (?:maximo|menos de|hasta)|por (?:maximo|mucho)|con (?:solo|apenas))\b/;

/**
 * El presupuesto del pedido, en pesos: «con un presupuesto de 80 millones», «invertir máximo $120.000.000», «que no
 * pase de 1.200 millones», «presupuesto de USD 25.000» (a la TRM del cotizador). Exige palabras de plata.
 */
export function presupuestoEnTexto(bajo: string): Presupuesto | null {
  if (!PIDE_PLATA.test(bajo) && !/\$|\b(pesos|cop|usd|dolares)\b/.test(bajo)) return null;
  const re = new RegExp(String.raw`(us\$|usd|\$|cop)?\s*${NUMERO}\s*(mil\s+millones|millones|millon|mm?(?![a-z0-9²])|k(?![a-z]))?\s*(?:de\s+)?(pesos|cop|dolares|usd)?`, "g");
  for (const m of bajo.matchAll(re)) {
    const moneda = m[1] ?? "";
    const escala = (m[4] ?? "").replace(/\s+/g, " ");
    const despues = m[5] ?? "";
    const dolares = /usd|us\$/.test(moneda) || /dolares|usd/.test(despues);
    // «12 m» son metros; «$80 M» o «80 MM de pesos» son millones
    if (/^mm?$/.test(escala) && !moneda && !despues) continue;
    const plata = Boolean(moneda) || Boolean(despues) || /millon|mil millones/.test(escala);
    if (!plata) continue;
    let v = leerNumero(`${m[2]}${m[3] ? " mil" : ""}`);
    if (/^mil millones/.test(escala)) v *= 1e9;
    else if (/^millon/.test(escala) || /^mm?$/.test(escala)) v *= 1e6;
    else if (escala === "k") v *= 1e3;
    if (!(v > 0)) continue;
    // Sin escala ni moneda clara, menos de un millón de pesos no es un presupuesto de red (es otra cifra)
    if (!dolares && v < 1e6) continue;
    const cop = dolares ? v * COTIZADOR.trm : v;
    return { cop, dicho: m[0].trim(), ...(dolares ? { dolares: v } : {}) };
  }
  return null;
}

const GENTE = "usuarios?|personas|familias|hogares|billeteras|clientes|habitantes|suscriptores|dispositivos|sensores|abonados";

/**
 * La gente que debe atender la red: «para 400 familias», «que atienda a 1.200 usuarios», «con capacidad para 300
 * personas». No es una zona de popularidad («250 personas alrededor de cada repetidor»).
 */
export function usuariosEnTexto(bajo: string): { n: number; quienes: string } | null {
  const m = bajo.match(new RegExp(String.raw`\b(?:para|que\s+atienda\s+a?|que\s+sirva\s+a|atender\s+a|servir\s+a|con\s+capacidad\s+(?:para|de)|capacidad\s+(?:para|de))\s+(?:unos?\s+|unas\s+|hasta\s+|mas\s+de\s+)?${NUMERO}\s+(${GENTE})\b(?!\s+(?:alrededor|a\s+la\s+redonda|en\s+cada|cada|por\s+(?:punto|nodo|repetidor|gateway|zona)))`));
  if (!m) return null;
  const n = Math.round(leerNumero(`${m[1]}${m[2] ? " mil" : ""}`));
  if (!(n >= 1) || n > 5_000_000) return null;
  return { n, quienes: m[3] };
}
