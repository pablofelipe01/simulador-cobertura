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
