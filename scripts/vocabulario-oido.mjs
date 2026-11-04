// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// v17.4 · El vocabulario de lo oído: las palabras que entiende el intérprete de Melki, en inglés y en español, para
// comparar por cómo suena lo que escribió el reconocimiento de voz («feel» → «fill», «maya» → «malla»). Salen de sus
// propias reglas (las expresiones regulares del traductor y del intérprete, expandidas: grupos, alternativas,
// opcionales y clases cortas; las raíces pegadas a un comodín no cuentan) y de las órdenes de las pruebas; una palabra
// de las reglas solo entra si también aparece escrita en el simulador (los textos de la pantalla y de Melki en ese
// idioma o las órdenes de las pruebas), y así no entran pedazos ni palabras pegadas.
// Genera src/components/melki/vocabulario-oido.ts. Uso: npm run vocabulario:oido [-- --sin frases.json …]
// (--sin: frases que no deben aportar palabras, para medir con pruebas ciegas sin sesgo)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(raiz, "package.json"));
const ts = require("typescript");
const melki = path.join(raiz, "src", "components", "melki");
const leer = (f) => JSON.parse(readFileSync(f, "utf8"));

/* ───────────── Las reglas, expandidas ───────────── */

const COMODIN = "\u0000";
const TOPE = 4000;

/** Cruza dos listas sin perder ninguna alternativa (primero en diagonal, después lo demás hasta el tope). */
function cruzar(a, b) {
  const salida = [];
  const n = Math.max(a.length, b.length);
  for (let k = 0; k < n; k++) salida.push(a[k % a.length] + b[k % b.length]);
  for (const x of a)
    for (const y of b) {
      if (salida.length >= TOPE) return salida;
      salida.push(x + y);
    }
  return salida;
}

/** Los textos que acepta una expresión regular (lo que es comodín queda marcado). */
function expandir(src) {
  let i = 0;
  const alternativas = () => {
    let alts = secuencia();
    while (src[i] === "|") {
      i++;
      alts = alts.concat(secuencia());
    }
    return alts;
  };
  const secuencia = () => {
    let res = [""];
    while (i < src.length && src[i] !== "|" && src[i] !== ")") {
      let atomo = unAtomo();
      const q = src[i];
      if (q === "?" || q === "*") {
        i++;
        // Un comodín opcional sigue siendo comodín («reajust\w*» es una raíz) y un espacio opcional se toma como espacio
        // (si no, se pegan las palabras)
        if (!atomo.some((a) => a.includes(COMODIN)) && !(atomo.length === 1 && atomo[0] === " ")) atomo = ["", ...atomo];
        if (src[i] === "?") i++;
      } else if (q === "+") {
        i++;
        if (src[i] === "?") i++;
      } else if (q === "{") {
        const m = src.slice(i).match(/^\{(\d+)(?:,(\d*))?\}/);
        if (m) {
          i += m[0].length;
          if (Number(m[1]) === 0) atomo = ["", ...atomo];
          if (src[i] === "?") i++;
        }
      }
      res = cruzar(res, atomo.length ? atomo : [""]);
    }
    return res;
  };
  const unAtomo = () => {
    const c = src[i];
    if (c === "(") {
      i++;
      let mirada = false;
      if (src[i] === "?") {
        if (src[i + 1] === ":") i += 2;
        else if (src[i + 1] === "=" || src[i + 1] === "!") {
          i += 2;
          mirada = true;
        } else if (src[i + 1] === "<" && (src[i + 2] === "=" || src[i + 2] === "!")) {
          i += 3;
          mirada = true;
        } else if (src[i + 1] === "<") i = src.indexOf(">", i) + 1;
      }
      const alts = alternativas();
      if (src[i] === ")") i++;
      return mirada ? [""] : alts;
    }
    if (c === "[") {
      let j = i + 1;
      let comodin = false;
      if (src[j] === "^") {
        comodin = true;
        j++;
      }
      const letras = [];
      while (j < src.length && src[j] !== "]") {
        if (src[j] === "\\") {
          const e = src[j + 1];
          if (/[sdwSDWpP]/.test(e)) comodin = true;
          else letras.push(e);
          j += 2;
          if (e === "p" || e === "P") j = src.indexOf("}", j) + 1;
          continue;
        }
        if (src[j + 1] === "-" && src[j + 2] && src[j + 2] !== "]") {
          comodin = true;
          j += 3;
          continue;
        }
        letras.push(src[j]);
        j++;
      }
      i = j + 1;
      return comodin || letras.length > 8 ? [COMODIN] : letras;
    }
    if (c === "\\") {
      const e = src[i + 1];
      i += 2;
      if (e === "b" || e === "B") return [""];
      if (e === "s") return [" "];
      if (e === "d") return ["0"];
      if (/[wWSD]/.test(e)) return [COMODIN];
      if (e === "p" || e === "P") {
        i = src.indexOf("}", i) + 1;
        return [COMODIN];
      }
      if (e === "u") {
        const h = src.slice(i, i + 4);
        i += 4;
        return [String.fromCharCode(parseInt(h, 16))];
      }
      if (/\d/.test(e)) return [COMODIN];
      return [e];
    }
    if (c === "^" || c === "$") {
      i++;
      return [""];
    }
    if (c === ".") {
      i++;
      return [COMODIN];
    }
    i++;
    return [c];
  };
  return alternativas();
}

const PALABRA = /[a-záéíóúñü]+(?:'[a-z]+)?/gi;

/** Las palabras enteras y los pares de palabras seguidas de lo expandido (sin las pegadas a un comodín). */
function deExpandidas(textos, palabras, pares) {
  for (const s of textos) {
    let previa = null;
    let finPrevia = -1;
    for (const m of s.matchAll(PALABRA)) {
      const antes = s[m.index - 1];
      const despues = s[m.index + m[0].length];
      if (antes === COMODIN || despues === COMODIN) {
        previa = null;
        continue;
      }
      const w = m[0].toLowerCase();
      palabras.add(w);
      if (previa && s.slice(finPrevia, m.index) === " ") pares.add(`${previa} ${w}`);
      previa = w;
      finPrevia = m.index + m[0].length;
    }
  }
}

/** Las expresiones regulares de un archivo (literales y new RegExp con texto o plantilla) y los textos de tx(es, en). */
function leerArchivo(archivo) {
  const texto = readFileSync(archivo, "utf8");
  const sf = ts.createSourceFile(archivo, texto, ts.ScriptTarget.Latest, true, archivo.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const reglas = [];
  const es = [];
  const en = [];
  const textoDe = (a) => (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) ? a.text : ts.isTemplateExpression(a) ? [a.head.text, ...a.templateSpans.map((x) => x.literal.text)].join(" ") : null);
  const visitar = (n) => {
    if (n.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const t = n.getText();
      reglas.push(t.slice(1, t.lastIndexOf("/")));
    } else if (ts.isNewExpression(n) && n.expression.getText() === "RegExp" && n.arguments?.length) {
      const t = textoDe(n.arguments[0]);
      if (t !== null) reglas.push(t);
    } else if (ts.isCallExpression(n) && n.expression.getText() === "tx" && n.arguments.length >= 2) {
      const a = textoDe(n.arguments[0]);
      const b = textoDe(n.arguments[1]);
      if (a) es.push(a);
      if (b) en.push(b);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { reglas, es, en };
}

/* ───────────── Lo que se arma ───────────── */

const iSin = process.argv.indexOf("--sin");
const sin = new Set();
if (iSin > 1) for (const f of process.argv.slice(iSin + 1).filter((x) => !x.startsWith("--"))) for (const x of leer(f)) sin.add((Array.isArray(x) ? x[1] : x).toLowerCase().trim());

// Las órdenes de las pruebas: [inglés, español] y las frases bien dichas de lo oído
const pruebas = path.join(raiz, "tests", "melki");
const pares = [...leer(path.join(pruebas, "frases-ingles.json")), ...leer(path.join(pruebas, "pares-ingles.json"))];
const pronunciacion = leer(path.join(pruebas, "frases-pronunciacion.json"));
const ordenesEn = [...pares.map((x) => x[0]), ...pronunciacion.en.map((x) => x[1])].filter((t) => !sin.has(t.toLowerCase().trim()));
const ordenesEs = [...pares.map((x) => x[1]), ...pronunciacion.es.map((x) => x[1])].filter((t) => !sin.has(t.toLowerCase().trim()));

// Los textos del simulador en cada idioma (para saber qué es una palabra) y las reglas de cada idioma
const textosEs = new Set();
const textosEn = new Set();
const archivosSrc = [];
const recorrer = (d) => {
  for (const x of require("node:fs").readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) recorrer(p);
    else if (/\.(ts|tsx)$/.test(x.name) && !/vocabulario-oido\.ts$/.test(x.name)) archivosSrc.push(p);
  }
};
recorrer(path.join(raiz, "src"));
for (const f of archivosSrc) {
  const { es, en } = leerArchivo(f);
  for (const t of es) for (const m of t.matchAll(PALABRA)) textosEs.add(m[0].toLowerCase());
  for (const t of en) for (const m of t.matchAll(PALABRA)) textosEn.add(m[0].toLowerCase());
}
const contar = (frases) => {
  const n = new Map();
  for (const f of frases) for (const m of f.matchAll(PALABRA)) n.set(m[0].toLowerCase(), (n.get(m[0].toLowerCase()) ?? 0) + 1);
  return n;
};
const cuentaEn = contar(ordenesEn);
const cuentaEs = contar(ordenesEs);
const pantallaEn = new Set(textosEn);
const pantallaEs = new Set(textosEs);
for (const w of cuentaEn.keys()) textosEn.add(w);
for (const w of cuentaEs.keys()) textosEs.add(w);

const reglasDe = (archivos) => {
  const palabras = new Set();
  const paresR = new Set();
  for (const f of archivos) for (const re of leerArchivo(path.join(melki, f)).reglas) deExpandidas(expandir(re), palabras, paresR);
  return { palabras, pares: paresR };
};
// (ortografia-en.ts no: sus reglas son los errores de tecleo, no palabras)
const reglasEn = reglasDe(["ingles.ts", "manos-libres.ts", "numeros.ts"]);
const reglasEs = reglasDe(["ordenes.ts", "capacidad.ts", "medidas.ts"]);

// Los lugares y los nombres de los nodos se reconocen aparte (por su fonética): no se cambia una palabra por ellos
const PROPIOS =
  /^(cumaral|loma|alta|villavicencio|villa|vicencio|meta|barranca|upía|upia|restrepo|cerro|azul|puerto|lópez|lopez|bogotá|bogota|paratebueno|villanueva|casanare|granada|chocó|choco|torre|esperanza|finca|hacienda|central|north|tower)$/;
// Los pares que el dictado puede partir o juntar mal («roads layer», «in diameter»): sin los que empiezan o terminan en
// un artículo o un pronombre («the gateway», «accept the»)
const SUELTAS = /^(the|a|an|my|your|our|their|this|that|these|those|it|its|them|me|us|you|el|la|los|las|un|una|mi|tu|su|lo|le|me|nos|se)$/;
// Una palabra de las órdenes de las pruebas entra si también la usan la pantalla o las reglas, o si se repite: las
// pruebas traen errores de tecleo a propósito («netwrok», «simualte»), que no son palabras
const armar = (cuenta, reglas, textos, extra, valida = () => true, pantalla = new Set()) => {
  const deLasPruebas = [...cuenta.keys()].filter((w) => pantalla.has(w) || reglas.palabras.has(w) || (cuenta.get(w) ?? 0) >= 3);
  const palabras = new Set([...deLasPruebas, ...[...reglas.palabras].filter((w) => textos.has(w)), ...extra]);
  const lista = [...palabras].filter((w) => w.length >= 2 && !PROPIOS.test(w) && !/^[a-z]'/.test(w) && valida(w));
  // De la más usada en las órdenes a la menos (las de las reglas al final, por orden alfabético)
  lista.sort((a, b) => (cuenta.get(b) ?? 0) - (cuenta.get(a) ?? 0) || a.localeCompare(b));
  const enLista = new Set(lista);
  const losPares = [...reglas.pares].filter((p) => p.split(" ").every((w) => enLista.has(w) && !SUELTAS.test(w)) && p.replace(" ", "").length >= 6).sort();
  return { lista, pares: losPares };
};
// En inglés, solo palabras del inglés: las órdenes de las pruebas traen español mezclado («llévame a…»); una palabra
// que también es del español solo entra si la pantalla en inglés la usa
const ES = armar(cuentaEs, reglasEs, textosEs, ["kmz", "csv", "pdf", "meshcore", "meshtastic", "sf", "whatsapp", "lora", "melki", "gateway", "gateways"], () => true, pantallaEs);
const deEspanol = new Set(ES.lista);
const EN = armar(cuentaEn, reglasEn, textosEn, ["kmz", "csv", "pdf", "meshcore", "meshtastic", "sf", "whatsapp", "lora", "melki"], (w) => /^[a-z']+$/.test(w) && (!deEspanol.has(w) || pantallaEn.has(w)), pantallaEn);
// En inglés, «north» y «tower» sí son palabras del simulador (no solo de un nombre)
EN.lista.push("north", "tower", "example");
ES.lista.push("torre", "ejemplo");

const salida = `// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Generado por scripts/vocabulario-oido.mjs (npm run vocabulario:oido): no se edita a mano.
// v17.4 · Las palabras que entiende el intérprete de Melki (de sus reglas y de las órdenes de las pruebas), de la más
// usada a la menos, y los pares de palabras seguidas de sus reglas, para comparar por cómo suena lo que se oyó.

export const PALABRAS_EN = ${JSON.stringify(EN.lista.join(" "))};
export const PARES_EN = ${JSON.stringify(EN.pares.join("|"))};
export const PALABRAS_ES = ${JSON.stringify(ES.lista.join(" "))};
export const PARES_ES = ${JSON.stringify(ES.pares.join("|"))};
`;
writeFileSync(path.join(melki, "vocabulario-oido.ts"), salida);
console.log(`vocabulario-oido.ts: inglés ${EN.lista.length} palabras y ${EN.pares.length} pares; español ${ES.lista.length} palabras y ${ES.pares.length} pares${sin.size ? ` (sin ${sin.size} frases)` : ""}`);
