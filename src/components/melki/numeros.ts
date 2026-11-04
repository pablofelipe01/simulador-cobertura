// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Números dichos en palabras → cifras, para lo que llega por voz: «doscientas cincuenta personas» → «250 personas»,
// «cuatro punto dos cinco» → «4.25», «menos setenta y tres punto treinta y siete» → «-73.37», «once mil doscientas
// veintiséis hectáreas» → «11226 hectáreas», «noventa y nueve coma nueve por ciento» → «99.9 %». «Un» y «una» solos
// se dejan como están («un repetidor», «una persona»).

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const UNIDADES: Record<string, number> = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const ESPECIALES: Record<string, number> = {
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21,
  veintiuno: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};
const DECENAS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const CENTENAS: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  doscientas: 200,
  trescientos: 300,
  trescientas: 300,
  cuatrocientos: 400,
  cuatrocientas: 400,
  quinientos: 500,
  quinientas: 500,
  seiscientos: 600,
  seiscientas: 600,
  setecientos: 700,
  setecientas: 700,
  ochocientos: 800,
  ochocientas: 800,
  novecientos: 900,
  novecientas: 900,
};
const DIGITOS = new Set(["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]);

type Token = { antes: string; palabra: string; despues: string; clave: string };

function partir(t: string): Token[] {
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^([¿¡"«(]*)(.*?)([.,;:!?»")]*)$/) ?? ["", "", x, ""];
      return { antes: m[1], palabra: m[2], despues: m[3], clave: sinTildes(m[2]) };
    });
}

const esEntero = (k: string) => /^\d+$/.test(k);
const esPalabraNumero = (k: string) => k in UNIDADES || k in ESPECIALES || k in DECENAS || k in CENTENAS || k === "mil" || k === "millon" || k === "millones";

/**
 * Lee un número desde `i`: devuelve su valor, hasta dónde llegó y cuántas palabras de número usó. Se detiene en la
 * primera palabra que no es de número o en una con puntuación pegada (la coma de «cuatro, menos…»).
 */
function leerEntero(ts: Token[], i: number): { valor: number; fin: number; palabras: string[] } | null {
  let total = 0;
  let actual = 0;
  let j = i;
  const palabras: string[] = [];
  let ultimo: "unidad" | "decena" | "especial" | "centena" | "mil" | "cifra" | null = null;
  while (j < ts.length) {
    const k = ts[j].clave;
    const corte = ts[j].despues !== "" || (j > i && ts[j].antes !== "");
    if (j > i && ts[j].antes !== "") break;
    if (esEntero(k) && j === i && ts[j + 1] && /^(mil|millon|millones)$/.test(ts[j + 1].clave)) {
      actual = Number(k);
      ultimo = "cifra";
    } else if (esEntero(k) && (ultimo === "mil" || ultimo === "centena") && j > i) {
      // «11 mil 226», «mil 200»
      actual += Number(k);
      ultimo = "cifra";
    } else if (k === "y" && ultimo === "decena" && j + 1 < ts.length && ts[j + 1].clave in UNIDADES && UNIDADES[ts[j + 1].clave] > 0 && ts[j].despues === "") {
      j++;
      continue;
    } else if (k in UNIDADES) {
      if (ultimo === "unidad" || ultimo === "especial" || ultimo === "cifra") break;
      actual += UNIDADES[k];
      ultimo = "unidad";
    } else if (k in ESPECIALES) {
      if (ultimo === "unidad" || ultimo === "especial" || ultimo === "decena" || ultimo === "cifra") break;
      actual += ESPECIALES[k];
      // «veinte» se comporta como decena («veinte y cinco»)
      ultimo = k === "veinte" ? "decena" : "especial";
    } else if (k in DECENAS) {
      if (ultimo === "unidad" || ultimo === "especial" || ultimo === "decena" || ultimo === "cifra") break;
      actual += DECENAS[k];
      ultimo = "decena";
    } else if (k in CENTENAS) {
      if (ultimo !== null && ultimo !== "mil") break;
      actual += CENTENAS[k];
      ultimo = "centena";
    } else if (k === "mil") {
      total += (actual || 1) * 1000;
      actual = 0;
      ultimo = "mil";
    } else if (k === "millon" || k === "millones") {
      total = (total + (actual || 1)) * 1_000_000;
      actual = 0;
      ultimo = "mil";
    } else break;
    palabras.push(k);
    j++;
    if (corte) break;
  }
  if (!palabras.length) return null;
  return { valor: total + actual, fin: j, palabras };
}

/** Parte decimal después de «punto» o «coma»: dígitos sueltos («dos cinco» → 25) o un número («treinta y siete»). */
function leerDecimal(ts: Token[], i: number): { texto: string; fin: number } | null {
  if (i >= ts.length) return null;
  if (esEntero(ts[i].clave)) return { texto: ts[i].clave, fin: i + 1 };
  if (DIGITOS.has(ts[i].clave)) {
    // Varios dígitos seguidos («cero cinco», «tres siete»)
    let j = i;
    let texto = "";
    while (j < ts.length && DIGITOS.has(ts[j].clave)) {
      texto += String(UNIDADES[ts[j].clave]);
      j++;
      if (ts[j - 1].despues) break;
    }
    if (j - i > 1 || ts[i].clave === "cero") return { texto, fin: j };
  }
  const n = leerEntero(ts, i);
  if (!n) return null;
  return { texto: String(n.valor), fin: n.fin };
}

/** El valor de una frase que es solo un número en palabras («doscientos cincuenta» → 250, «una» → 1); si no, null. */
export function numeroDePalabras(frase: string): number | null {
  const ts = partir(sinTildes(frase.trim()));
  if (!ts.length) return null;
  const n = leerEntero(ts, 0);
  return n && n.fin === ts.length ? n.valor : null;
}

/** Cambia los números en palabras por cifras (solo lo que es claramente un número). */
export function numerosEnPalabras(texto: string): string {
  const ts = partir(texto.trim());
  const salida: string[] = [];
  let i = 0;
  while (i < ts.length) {
    const t = ts[i];
    // v17.4 · «50 por ciento» (el número ya en cifras, como lo escribe el reconocimiento) → «50 %», no «50 por 100»
    if (/^\d+(?:[.,]\d+)?$/.test(t.clave) && !t.despues && ts[i + 1]?.clave === "por" && ts[i + 2]?.clave === "ciento" && !ts[i + 1].despues) {
      salida.push(`${t.antes}${t.palabra} %${ts[i + 2].despues}`);
      i += 3;
      continue;
    }
    const puedeEmpezar = esPalabraNumero(t.clave) || (esEntero(t.clave) && ts[i + 1] && /^(mil|millon|millones)$/.test(ts[i + 1].clave));
    if (!puedeEmpezar) {
      salida.push(`${t.antes}${t.palabra}${t.despues}`);
      i++;
      continue;
    }
    const n = leerEntero(ts, i);
    if (!n) {
      salida.push(`${t.antes}${t.palabra}${t.despues}`);
      i++;
      continue;
    }
    // «un», «una» y «uno» solos se quedan en palabras, salvo en un nombre («Repetidor uno» → «Repetidor 1»)
    const nombre = i > 0 && /^(repetidor|persona|antena|gateway|torre|nodo|zona|punto|sitio|opcion|paso)$/.test(ts[i - 1].clave) && !ts[i - 1].despues;
    if (n.palabras.length === 1 && /^(un|una|uno)$/.test(n.palabras[0]) && !nombre) {
      salida.push(`${t.antes}${t.palabra}${t.despues}`);
      i++;
      continue;
    }
    let cifra = String(n.valor);
    let fin = n.fin;
    let despues = ts[fin - 1].despues;
    // Decimales: «cuatro punto dos cinco», «noventa y nueve coma nueve»
    if (!despues && fin < ts.length - 1 && /^(punto|coma)$/.test(ts[fin].clave) && !ts[fin].despues) {
      const d = leerDecimal(ts, fin + 1);
      if (d) {
        cifra = `${cifra}.${d.texto}`;
        fin = d.fin;
        despues = ts[fin - 1].despues;
      }
    }
    // «menos setenta» → «-70» (solo si «menos» va justo antes)
    const previo = salida.length ? salida[salida.length - 1] : "";
    if (sinTildes(previo) === "menos") {
      salida.pop();
      cifra = `-${cifra}`;
    }
    // «por ciento»
    if (!despues && fin + 1 < ts.length && ts[fin].clave === "por" && ts[fin + 1].clave === "ciento") {
      salida.push(`${t.antes}${cifra} %${ts[fin + 1].despues}`);
      i = fin + 2;
      continue;
    }
    salida.push(`${t.antes}${cifra}${despues}`);
    i = fin;
  }
  return salida.join(" ");
}

/* ───────────── En inglés ───────────── */

// «two hundred fifty people» → «250 people», «four point two five» → «4.25», «minus seventy three point three seven» →
// «-73.37», «eleven thousand two hundred and twenty-six hectares» → «11226 hectares», «ninety nine point nine percent»
// → «99.9 %», «two and a half km» → «2.5 km», «half a mile» → «0.5 mile», «a mile and a half» → «1.5 mile». «One», «a»
// y «an» solos se dejan como están («a repeater», «one of them»), salvo en un nombre («Repeater one» → «Repeater 1»).

const UNIDADES_EN: Record<string, number> = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const ESPECIALES_EN: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const DECENAS_EN: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const DIGITOS_EN = new Set(["zero", "oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]);
const MULTIPLOS_EN: Record<string, number> = { thousand: 1000, million: 1_000_000, millions: 1_000_000, billion: 1_000_000_000 };

type TokenEn = { antes: string; palabra: string; despues: string; clave: string };

function partirEn(t: string): TokenEn[] {
  return t
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((x) => {
      // «twenty-five» → «twenty five» (solo cuando las dos partes son números)
      const g = x.match(/^([a-z]+)-([a-z]+)$/i);
      if (g && g[1].toLowerCase() in DECENAS_EN && g[2].toLowerCase() in UNIDADES_EN) return [g[1], g[2]];
      return [x];
    })
    .map((x) => {
      const m = x.match(/^([¿¡"“«(]*)(.*?)([.,;:!?»”")]*)$/) ?? ["", "", x, ""];
      return { antes: m[1], palabra: m[2], despues: m[3], clave: m[2].toLowerCase() };
    });
}

const esPalabraNumeroEn = (k: string) => k in UNIDADES_EN || k in ESPECIALES_EN || k in DECENAS_EN || k === "hundred" || k in MULTIPLOS_EN;

function leerEnteroEn(ts: TokenEn[], i: number): { valor: number; fin: number; palabras: string[] } | null {
  let total = 0;
  let actual = 0;
  let j = i;
  const palabras: string[] = [];
  let ultimo: "unidad" | "decena" | "especial" | "centena" | "mil" | "cifra" | null = null;
  while (j < ts.length) {
    const k = ts[j].clave;
    const corte = ts[j].despues !== "";
    if (j > i && ts[j].antes !== "") break;
    if (/^\d+$/.test(k) && j === i && ts[j + 1] && (ts[j + 1].clave === "hundred" || ts[j + 1].clave === "thousand") && !corte) {
      actual = Number(k);
      ultimo = "cifra";
    } else if ((k === "a" || k === "an") && j === i && ts[j + 1] && (ts[j + 1].clave === "hundred" || ts[j + 1].clave in MULTIPLOS_EN) && !corte) {
      // «a hundred», «a thousand»
      actual = 1;
      ultimo = "cifra";
    } else if (k === "and" && (ultimo === "centena" || ultimo === "mil") && j + 1 < ts.length && esPalabraNumeroEn(ts[j + 1].clave) && !(ts[j + 1].clave in MULTIPLOS_EN) && ts[j].despues === "") {
      // «one hundred and fifty»
      j++;
      continue;
    } else if (k in UNIDADES_EN) {
      if (ultimo === "unidad" || ultimo === "especial" || ultimo === "cifra") break;
      actual += UNIDADES_EN[k];
      ultimo = "unidad";
    } else if (k in ESPECIALES_EN) {
      if (ultimo === "unidad" || ultimo === "especial" || ultimo === "decena" || ultimo === "cifra") break;
      actual += ESPECIALES_EN[k];
      ultimo = "especial";
    } else if (k in DECENAS_EN) {
      if (ultimo === "unidad" || ultimo === "especial" || ultimo === "decena" || ultimo === "cifra") break;
      actual += DECENAS_EN[k];
      ultimo = "decena";
    } else if (k === "hundred") {
      if (ultimo === "centena" || ultimo === "decena") break;
      actual = (actual || 1) * 100;
      ultimo = "centena";
    } else if (k in MULTIPLOS_EN) {
      total += (actual || 1) * MULTIPLOS_EN[k];
      actual = 0;
      ultimo = "mil";
    } else break;
    palabras.push(k);
    j++;
    if (corte) break;
  }
  if (!palabras.length) return null;
  return { valor: total + actual, fin: j, palabras };
}

function leerDecimalEn(ts: TokenEn[], i: number): { texto: string; fin: number } | null {
  if (i >= ts.length) return null;
  if (/^\d+$/.test(ts[i].clave)) return { texto: ts[i].clave, fin: i + 1 };
  // Dígitos sueltos («two five» → 25, «oh five» → 05)
  let j = i;
  let texto = "";
  while (j < ts.length && DIGITOS_EN.has(ts[j].clave)) {
    texto += String(UNIDADES_EN[ts[j].clave]);
    j++;
    if (ts[j - 1].despues) break;
  }
  if (j > i) return { texto, fin: j };
  const n = leerEnteroEn(ts, i);
  return n ? { texto: String(n.valor), fin: n.fin } : null;
}

const NOMBRE_EN = /^(repeater|repetidor|person|persona|antenna|antena|gateway|tower|torre|node|nodo|zone|point|site|option|step|support|apoyo)$/;

/** El valor de una frase en inglés que es solo un número («two hundred fifty» → 250); si no, null. */
export function numeroDePalabrasEn(frase: string): number | null {
  const ts = partirEn(frase.trim());
  if (!ts.length) return null;
  const n = leerEnteroEn(ts, 0);
  return n && n.fin === ts.length ? n.valor : null;
}

/** Cambia los números en palabras del inglés por cifras (solo lo que es claramente un número). */
export function numerosEnPalabrasEn(texto: string): string {
  const ts = partirEn(texto.trim());
  const salida: string[] = [];
  let i = 0;
  while (i < ts.length) {
    const t = ts[i];
    const k = t.clave;
    // «half a mile», «half a km» → «0.5 mile»
    if (k === "half" && ts[i + 1]?.clave === "a" && ts[i + 2] && !t.despues) {
      salida.push(`${t.antes}0.5`);
      i += 2;
      continue;
    }
    const puedeEmpezar =
      (esPalabraNumeroEn(k) && !(k in MULTIPLOS_EN)) || (/^\d+$/.test(k) && ts[i + 1] && (ts[i + 1].clave === "hundred" || ts[i + 1].clave === "thousand")) || ((k === "a" || k === "an") && ts[i + 1] && (ts[i + 1].clave === "hundred" || ts[i + 1].clave in MULTIPLOS_EN));
    if (!puedeEmpezar) {
      salida.push(`${t.antes}${t.palabra}${t.despues}`);
      i++;
      continue;
    }
    const n = leerEnteroEn(ts, i);
    if (!n) {
      salida.push(`${t.antes}${t.palabra}${t.despues}`);
      i++;
      continue;
    }
    // «one» solo se queda en palabras, salvo en un nombre («Repeater one» → «Repeater 1»)
    const nombre = i > 0 && NOMBRE_EN.test(ts[i - 1].clave) && !ts[i - 1].despues;
    if (n.palabras.length === 1 && n.palabras[0] === "one" && !nombre) {
      salida.push(`${t.antes}${t.palabra}${t.despues}`);
      i++;
      continue;
    }
    let cifra = String(n.valor);
    let fin = n.fin;
    let despues = ts[fin - 1].despues;
    // «two million», «a million» → «2 million» (la plata se dice en millones también en español)
    const ultima = n.palabras[n.palabras.length - 1];
    if ((ultima === "million" || ultima === "millions" || ultima === "billion") && n.valor % 1_000_000 === 0) {
      const escala = ultima === "billion" ? 1_000_000_000 : 1_000_000;
      salida.push(`${t.antes}${n.valor / escala} ${ultima === "billion" ? "billion" : "million"}${despues}`);
      i = fin;
      continue;
    }
    // Decimales: «four point two five»
    if (!despues && fin < ts.length - 1 && ts[fin].clave === "point" && !ts[fin].despues) {
      const d = leerDecimalEn(ts, fin + 1);
      if (d) {
        cifra = `${cifra}.${d.texto}`;
        fin = d.fin;
        despues = ts[fin - 1].despues;
      }
    }
    // «two and a half» → 2.5
    if (!despues && ts[fin]?.clave === "and" && ts[fin + 1]?.clave === "a" && ts[fin + 2]?.clave === "half") {
      cifra = String(Number(cifra) + 0.5);
      despues = ts[fin + 2].despues;
      fin += 3;
    }
    // «minus seventy», «negative seventy» → «-70»
    const previo = salida.length ? salida[salida.length - 1].toLowerCase() : "";
    if (previo === "minus" || previo === "negative") {
      salida.pop();
      cifra = `-${cifra}`;
    }
    // «percent», «per cent»
    if (!despues && ts[fin]?.clave.replace(/[.,;:!?]+$/, "") === "percent") {
      salida.push(`${t.antes}${cifra} %${ts[fin].despues}`);
      i = fin + 1;
      continue;
    }
    if (!despues && ts[fin]?.clave === "per" && ts[fin + 1]?.clave.replace(/[.,;:!?]+$/, "") === "cent") {
      salida.push(`${t.antes}${cifra} %${ts[fin + 1].despues}`);
      i = fin + 2;
      continue;
    }
    salida.push(`${t.antes}${cifra}${despues}`);
    i = fin;
  }
  let r = salida.join(" ");
  // «a mile and a half» → «1.5 mile»; «a km and a half» → «1.5 km»
  r = r.replace(/\b(?:a|an|one|1) (mile|kilometer|kilometre|km|meter|metre|hectare|block|foot|yard)s? and a half\b/gi, "1.5 $1");
  // «2 and a half km» (ya en cifras) → «2.5 km»
  r = r.replace(/\b(\d+) and a half\b/gi, (_m, n: string) => String(Number(n) + 0.5));
  // «one and a half» quedó como «one and a half»
  r = r.replace(/\bone and a half\b/gi, "1.5");
  // v17.3 · «a quarter mile», «three quarters of a mile», «a kilometer north», «a couple of repeaters», «a dozen people»,
  // «10k people» (miles de personas, hectáreas, pagos…)
  r = r.replace(/\b(?:3|three) quarters of an? (mile|kilometer|kilometre|km)\b/gi, "0.75 $1");
  r = r.replace(/\ba quarter(?: of an?)? (mile|kilometer|kilometre|km)\b/gi, "0.25 $1");
  r = r.replace(/\b(?:a|an|one) (mile|kilometer|kilometre|km|meter|metre|hectare|acre|foot|yard|block)\b/gi, "1 $1");
  r = r.replace(/\ba couple(?: of)?\b(?= \w)/gi, "2");
  r = r.replace(/\b(?:a|one) dozen\b/gi, "12");
  r = r.replace(/\b(\d+(?:\.\d+)?) ?k\b(?= (?:people|persons|users|hectares|ha|payments|messages|families|wallets|pesos|households)\b)/gi, (_m, n: string) => String(Math.round(Number(n) * 1000)));
  // «-73 . 37»: nada; «4,5» en inglés no es decimal: se deja
  return r;
}
