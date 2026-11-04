// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El idioma del simulador (español o inglés). Cada texto se escribe en los dos idiomas donde nace: tx("Simular",
// "Simulate") devuelve el del idioma actual. El motor de cálculo (Web Worker) no sabe en qué idioma está la
// pantalla: allá tx() devuelve los dos textos marcados y la interfaz los resuelve al recibirlos; así, al cambiar de
// idioma, lo ya calculado cambia al instante sin volver a calcular. También: los números y fechas del idioma, la
// preferencia guardada (la primera vez, el idioma del navegador) y la detección del idioma de lo que se escribe o
// se dice.

export type Idioma = "es" | "en";

let actual: Idioma = "es";
let bilingue = false;
const oyentes = new Set<() => void>();

/** El idioma de ahora. */
export const idioma = (): Idioma => actual;
export const enIngles = (): boolean => actual === "en";

/** Cambia el idioma de todo el simulador (avisa a quien escucha: la pantalla, Melki, la voz). */
export function fijarIdioma(i: Idioma): void {
  if (i !== "es" && i !== "en") return;
  if (i === actual) return;
  actual = i;
  if (typeof document !== "undefined") document.documentElement.lang = i;
  for (const f of [...oyentes]) {
    try {
      f();
    } catch {
      // Un oyente que falla no impide avisar a los demás
    }
  }
}

/** Escucha los cambios de idioma; devuelve cómo dejar de escuchar. */
export function suscribirIdioma(f: () => void): () => void {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

/* ───────────── Textos en los dos idiomas ───────────── */

const M1 = "\u0001";
const M2 = "\u0002";
const M3 = "\u0003";
// La pareja más interna (sin otras marcas adentro): se resuelven de adentro hacia afuera
const PAREJA = /\u0001([^\u0001\u0002\u0003]*)\u0002([^\u0001\u0002\u0003]*)\u0003/g;

/**
 * Modo bilingüe (solo en el motor de cálculo): tx() devuelve los dos textos marcados, para resolverlos en la
 * interfaz con el idioma que tenga en ese momento.
 */
export function modoBilingue(v: boolean): void {
  bilingue = v;
}
export const esBilingue = (): boolean => bilingue;

/** El texto en el idioma actual: tx("Simular", "Simulate"). */
export function tx(es: string, en: string): string {
  if (bilingue) return es === en ? es : M1 + es + M2 + en + M3;
  return actual === "en" ? en : es;
}

/** ¿Trae textos marcados del motor (sin resolver)? */
export const tieneMarcas = (t: string): boolean => t.includes(M1);

/** Resuelve los textos marcados del motor en un idioma (por defecto, el actual). */
export function resolver(t: string, i: Idioma = actual): string {
  if (!t.includes(M1)) return t;
  let s = t;
  for (let k = 0; k < 50 && s.includes(M1); k++) {
    const antes = s;
    s = s.replace(PAREJA, (_m, es: string, en: string) => (i === "en" ? en : es));
    if (s === antes) break;
  }
  // Una marca suelta (texto cortado) no se muestra
  return s.includes(M1) || s.includes(M2) || s.includes(M3) ? s.replace(/[\u0001\u0002\u0003]/g, "") : s;
}

/**
 * Aplica una transformación de texto a cada idioma por separado (en el motor, a los dos textos marcados): para poner
 * la primera letra en mayúscula, recortar o reemplazar sin mezclar los idiomas.
 */
export function porTexto(t: string, f: (s: string, i: Idioma) => string): string {
  if (!bilingue || !t.includes(M1)) return f(t, bilingue ? "es" : actual);
  return tx(f(resolver(t, "es"), "es"), f(resolver(t, "en"), "en"));
}

/** La primera letra en mayúscula (también con textos marcados del motor). */
export const conMayuscula = (t: string): string => porTexto(t, (s) => s.charAt(0).toUpperCase() + s.slice(1));

const esPlano = (x: object): boolean => {
  const p = Object.getPrototypeOf(x);
  return p === Object.prototype || p === null;
};

function resolverValor(x: unknown, i: Idioma, vistos: Map<object, unknown>): unknown {
  if (typeof x === "string") return x.includes(M1) ? resolver(x, i) : x;
  if (x === null || typeof x !== "object") return x;
  if (ArrayBuffer.isView(x) || x instanceof ArrayBuffer || x instanceof Date || x instanceof RegExp) return x;
  if (vistos.has(x)) return vistos.get(x);
  if (Array.isArray(x)) {
    const salida: unknown[] = new Array(x.length);
    vistos.set(x, salida);
    let cambio = false;
    for (let k = 0; k < x.length; k++) {
      salida[k] = resolverValor(x[k], i, vistos);
      if (salida[k] !== x[k]) cambio = true;
    }
    if (!cambio) {
      vistos.set(x, x);
      return x;
    }
    return salida;
  }
  if (x instanceof Map) {
    const salida = new Map();
    vistos.set(x, salida);
    let cambio = false;
    for (const [k, v] of x) {
      const k2 = resolverValor(k, i, vistos);
      const v2 = resolverValor(v, i, vistos);
      if (k2 !== k || v2 !== v) cambio = true;
      salida.set(k2, v2);
    }
    if (!cambio) {
      vistos.set(x, x);
      return x;
    }
    return salida;
  }
  if (x instanceof Set) {
    const salida = new Set();
    vistos.set(x, salida);
    let cambio = false;
    for (const v of x) {
      const v2 = resolverValor(v, i, vistos);
      if (v2 !== v) cambio = true;
      salida.add(v2);
    }
    if (!cambio) {
      vistos.set(x, x);
      return x;
    }
    return salida;
  }
  if (!esPlano(x)) return x;
  const salida: Record<string, unknown> = {};
  vistos.set(x, salida);
  let cambio = false;
  for (const [k, v] of Object.entries(x)) {
    const v2 = resolverValor(v, i, vistos);
    if (v2 !== v) cambio = true;
    salida[k] = v2;
  }
  if (!cambio) {
    vistos.set(x, x);
    return x;
  }
  return salida;
}

/** Resuelve todos los textos marcados dentro de un resultado del motor (objetos, listas, Map y Set). */
export function resolverTodo<T>(x: T, i: Idioma = actual): T {
  return resolverValor(x, i, new Map()) as T;
}

// Cada resultado resuelto recuerda el original con las marcas, para volver a resolverlo al cambiar de idioma
const CRUDO = new WeakMap<object, unknown>();

/** Resuelve un resultado del motor y guarda el original para traducirlo después sin volver a calcular. */
export function recibirDelMotor<T>(crudo: T, i: Idioma = actual): T {
  const r = resolverTodo(crudo, i);
  if (r !== crudo && r !== null && typeof r === "object") CRUDO.set(r as object, crudo);
  return r;
}

function retraducirValor(x: unknown, i: Idioma, vistos: Map<object, unknown>): unknown {
  if (x === null || typeof x !== "object") return x;
  if (vistos.has(x)) return vistos.get(x);
  if (CRUDO.has(x)) {
    const r = recibirDelMotor(CRUDO.get(x), i);
    vistos.set(x, r);
    return r;
  }
  if (ArrayBuffer.isView(x) || x instanceof ArrayBuffer || x instanceof Date || x instanceof RegExp) return x;
  if (Array.isArray(x)) {
    vistos.set(x, x);
    let cambio = false;
    const salida = x.map((v) => {
      const v2 = retraducirValor(v, i, vistos);
      if (v2 !== v) cambio = true;
      return v2;
    });
    const r = cambio ? salida : x;
    vistos.set(x, r);
    return r;
  }
  if (x instanceof Map || x instanceof Set || !esPlano(x)) return x;
  vistos.set(x, x);
  let cambio = false;
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) {
    const v2 = retraducirValor(v, i, vistos);
    if (v2 !== v) cambio = true;
    salida[k] = v2;
  }
  const r = cambio ? salida : x;
  vistos.set(x, r);
  return r;
}

/**
 * Vuelve a resolver, en otro idioma, los resultados del motor que haya dentro de un valor (el estado de la pantalla).
 * Lo que no viene del motor queda igual (el mismo objeto, si nada cambió).
 */
export function retraducir<T>(x: T, i: Idioma = actual): T {
  return retraducirValor(x, i, new Map()) as T;
}

/**
 * Un valor que depende del idioma (listas de textos, tours, catálogos): se arma una vez por idioma y se guarda.
 * Uso: `const SUGERENCIAS = porIdioma(() => [tx("Hazme un tour", "Give me a tour")])` y luego `SUGERENCIAS()`.
 */
export function porIdioma<T>(crear: () => T): () => T {
  const hechos: Partial<Record<Idioma | "ambos", T>> = {};
  return () => {
    const k = bilingue ? "ambos" : actual;
    if (!(k in hechos)) hechos[k] = crear();
    return hechos[k] as T;
  };
}

/* ───────────── Números y fechas ───────────── */

/** La configuración regional del idioma actual («es-CO» o «en-US»). */
export const regional = (): string => (actual === "en" ? "en-US" : "es-CO");

/** Un número con el formato del idioma (español: 1.234,5; inglés: 1,234.5). */
export function numeroLocal(x: number, opciones?: Intl.NumberFormatOptions): string {
  return tx(x.toLocaleString("es-CO", opciones), x.toLocaleString("en-US", opciones));
}

/** Un número con `d` decimales fijos y el separador del idioma (sin separador de miles): «2,5» o «2.5». */
export function decimalLocal(x: number, d = 1): string {
  const s = x.toFixed(d);
  return tx(s.replace(".", ","), s);
}

/** Una fecha con el formato del idioma. */
export function fechaLocal(f: Date, opciones?: Intl.DateTimeFormatOptions): string {
  return tx(f.toLocaleDateString("es-CO", opciones), f.toLocaleDateString("en-US", opciones));
}

/** Lista de cosas con «y» o «and»: «A, B y C» / «A, B and C». */
export function listaLocal(cosas: string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? "";
  const inicio = cosas.slice(0, -1).join(", ");
  return tx(`${inicio} y ${cosas[cosas.length - 1]}`, `${inicio} and ${cosas[cosas.length - 1]}`);
}

/* ───────────── Preferencia ───────────── */

export const CLAVE_IDIOMA = "simulador-cobertura-idioma";
export type PreferenciaIdioma = { idioma: Idioma; auto: boolean };
let auto = true;

/** El idioma del navegador: el primero en español o en inglés de su lista (si no hay ninguno, español). */
export function idiomaDelNavegador(): Idioma {
  if (typeof navigator === "undefined") return "es";
  const lista = navigator.languages?.length ? navigator.languages : [navigator.language ?? ""];
  for (const l of lista) {
    if (/^es\b/i.test(l)) return "es";
    if (/^en\b/i.test(l)) return "en";
  }
  return "es";
}

/** La preferencia guardada; la primera vez, el idioma del navegador y el cambio automático encendido. */
export function leerPreferenciaIdioma(): PreferenciaIdioma {
  try {
    const j = JSON.parse(localStorage.getItem(CLAVE_IDIOMA) ?? "null") as Partial<PreferenciaIdioma> | null;
    if (j && (j.idioma === "es" || j.idioma === "en")) return { idioma: j.idioma, auto: j.auto !== false };
  } catch {
    // Sin almacenamiento (ventana privada): el idioma del navegador
  }
  return { idioma: idiomaDelNavegador(), auto: true };
}

function guardarPreferencia() {
  try {
    localStorage.setItem(CLAVE_IDIOMA, JSON.stringify({ idioma: actual, auto }));
  } catch {
    // Sin almacenamiento: vale para esta visita
  }
}

/** ¿Cambia de idioma solo cuando le hablan o le escriben en el otro? */
export const cambioAutomatico = (): boolean => auto;

/** Arranca con la preferencia guardada (o el idioma del navegador). */
export function iniciarIdioma(): Idioma {
  const p = leerPreferenciaIdioma();
  auto = p.auto;
  fijarIdioma(p.idioma);
  if (typeof document !== "undefined") document.documentElement.lang = actual;
  return actual;
}

/** Cambia el idioma y lo recuerda para la próxima visita. */
export function elegirIdioma(i: Idioma): void {
  fijarIdioma(i);
  guardarPreferencia();
}

/** Enciende o apaga el cambio automático de idioma (y lo recuerda). */
export function fijarCambioAutomatico(v: boolean): void {
  if (auto === v) return;
  auto = v;
  guardarPreferencia();
  for (const f of [...oyentes]) {
    try {
      f();
    } catch {
      // nada
    }
  }
}

/* ───────────── ¿En qué idioma está lo que se dijo? ───────────── */

// Palabras que delatan cada idioma (sin tildes). Las que existen en los dos («a», «no», «me», «gateway», «ok», los
// nombres de lugares y de nodos) no cuentan.
const PALABRAS_ES = new Set(
  (
    "de del la las el los lo que en y o u para por con sin una unos unas un al se su sus le les mi mis tu tus te nos es son esta estan este esto estos esas ese eso esa " +
    "como cual cuales cuando donde quien quienes cuanto cuanta cuantos cuantas porque pero tambien muy mas menos hay hasta desde entre sobre segun hacia " +
    "hola gracias buenos buenas dias tardes noches oye oiga por favor porfa claro listo vale bueno perfecto ayudame ayuda quiero necesito puedes podrias " +
    "pon ponme ponle agrega agregale anade quita quitale borra borrale mueve muevelo muevela cambia cambiale renombra sube subelo baja bajalo simula simular " +
    "disena disename arma armame crea creame haz hazme muestra muestrame ensename dime dame llevame ubicame busca abre cierra oculta prueba probar exporta descarga " +
    "deshaz repite habla hablame callate silencio sigue siguiente anterior termina empieza explicame cuentame calcula mide optimiza ajusta ajustamelo " +
    "repetidor repetidores persona personas nodo nodos antena antenas torre torres red malla senal cobertura altura metros kilometros hectareas mapa zona zonas " +
    "costo cuesta presupuesto precio pesos millones mensaje mensajes pagos gente usuarios billeteras resultados herramientas parametros frecuencia potencia ganancia " +
    "norte sur este oeste oriente occidente cerca lejos alrededor aqui alla ahi ahora todo todos todas nada algo cada otro otra otros otras mejor peor"
  ).split(/\s+/),
);
const PALABRAS_EN = new Set(
  (
    "the of and or to in on at by from with without for about into onto over under between near around this that these those there here it its is are was were be been " +
    "do does did done have had will would can could should shall may might must what which who whom whose when where why how much many more less " +
    "please thanks thank hello hi hey yes yeah okay sure great good morning afternoon evening help want need you your i my we our us they them he she let lets " +
    "add put place remove delete erase move rename change raise lower set make build create design simulate run show tell give take go open close hide test export " +
    "download undo repeat speak talk stop quiet next previous back finish start explain calculate measure optimize adjust zoom center find search " +
    "repeater repeaters person people node nodes antenna antennas tower towers network mesh signal coverage height meters kilometers hectares map area zone zones " +
    "cost costs budget price money message messages payments users wallets results tools settings parameters frequency power gain " +
    "north south east west nearby far everything all every each nothing something another other better worse doing going feasible"
  ).split(/\s+/),
);
// Contracciones del inglés («what's», «don't», «I'm», «let's»): casi nunca aparecen en español
const CONTRACCION = /\b[a-z]+'(s|t|re|ve|ll|d|m)\b/;
// v17.3 · Más palabras que delatan cada idioma (las órdenes del simulador con otras palabras). No van las que se usan en
// los dos («real», «normal», «radio», «link», «test», «zoom», «set» como préstamo, «use» del «use usted»)
for (const p of (
  "apply switch turn load save select pick choose connect duplicate copy clone populate cover fly navigate increase decrease " +
  "reduce enable disable activate deactivate tilt point orient aim mark suggest recommend send seed spread scatter fill draw " +
  "wipe clear lift shift push relocate nudge satellite roads terrain ground ruler pencil scenario example sample simulation " +
  "protocol spreading factor hops hop limit report profile distance reliability climate soil wet dry flat everyone everybody " +
  "someone somebody gonna wanna sir accept approve kill trash ditch scrap hook off optimization optimisation adjustment " +
  "layer layers toolbar label labels rivers tall high feet miles yards blocks acres hectare kilometer meter mile foot"
).split(" "))
  PALABRAS_EN.add(p);
for (const p of (
  "aplica selecciona conecta duplica copia elimina guarda carga usa activa desactiva apaga enciende prende siembra puebla " +
  "reparte dibuja suelta marca apunta orienta inclina llama sugiere sugiereme recomienda envia manda cubre vamos escenario " +
  "ejemplo simulacion relieve terreno satelital vias regla lapiz saltos limite enlace informe perfil distancia confiabilidad " +
  "clima suelo humedo seco plano alto alta ponlo ponla subelo bajalo muevelo senor senora"
).split(" "))
  PALABRAS_ES.add(p);

/**
 * v17.3 · Verbos y preguntas con que empieza una orden y que son de un solo idioma: con ellos basta una orden corta para
 * saber el idioma («Simulate», «optimize it», «load the example»; «simula», «carga el ejemplo», «usa SF10»). Los préstamos
 * que se dicen igual en español («ok», «zoom», «reset», «stop», «test», «check», «play», «click») no están, ni «use»
 * (también es el «use usted» del español: «Use SF10»).
 */
const VERBOS_EN = new Set(
  (
    "simulate simulation optimize optimise add delete remove erase move shift relocate raise lower lift rename show display hide " +
    "export download save load select pick choose connect duplicate copy clone apply switch turn set put place design build " +
    "create make populate measure cover take go fly navigate center find locate open close run start give undo redo explain tell " +
    "increase decrease reduce enable disable activate deactivate adjust calculate compute send draw mark point tilt orient aim " +
    "spread scatter fill seed suggest recommend help walk present speak talk read repeat call name drop get bring keep let lets " +
    "accept approve kill trash ditch scrap hook lose " +
    "can could would will should shall what how why where who which when is are does do did am was were have"
  ).split(" "),
);
const VERBOS_ES = new Set(
  (
    "simula simular simulalo optimiza optimizala agrega agregale agregame anade elimina eliminalo eliminala borra borralo quita " +
    "quitale mueve muevelo muevela sube subelo subela baja bajalo bajala renombra muestra muestrame oculta exporta descarga guarda " +
    "carga selecciona conecta duplica aplica cambia usa pon ponme ponle ponlo ponla disena disename arma armame crea creame puebla " +
    "mide cubre llevame lleva ve vamos haz hazme prueba abre cierra deshaz explicame dime dame ensename calcula ajusta ajustamelo " +
    "activa desactiva apaga enciende prende manda envia siembra reparte dibuja suelta marca apunta orienta inclina llama sugiere " +
    "sugiereme recomienda recomiendame ubica ubicame busca encuentra acerca aleja habla hablame repite " +
    // Con «usted» (sin «active», «incline» ni «quite», que también son palabras del inglés)
    "simule agregue anada ponga mueva suba baje muestre oculte elimine borre cambie haga disene arme exporte descargue guarde " +
    "cargue seleccione conecte duplique aplique renombre desactive apague encienda mande envie siembre pueble reparta " +
    "dibuje suelte marque apunte oriente sugiera recomiende ubique busque encuentre acerque aleje hable repita mida cubra " +
    "calcule optimice pruebe abra cierre deshaga explique digame deme ensename lleve " +
    // Preguntas
    "que como cuanto cuanta cuantos cuantas donde cual cuales quien quienes cuando hay tengo necesito quiero puedes podrias"
  ).split(" "),
);
/** v17.3 · Las órdenes de una sola palabra (sin nada más se hacen): con ellas basta para saber el idioma. */
const SOLAS_EN = new Set("simulate optimize optimise undo redo export download save recalculate calculate compute populate".split(" "));
const SOLAS_ES = new Set(
  "simula simular simulalo optimiza optimizala deshaz exporta descarga guarda calcula recalcula puebla simule optimice exporte descargue guarde calcule pueble".split(" "),
);
/** Lo que puede ir antes del verbo sin decir el idioma («ok», «hey», «Melki», «please»). */
const ANTES_DEL_VERBO = new Set("ok okay oki okey hey hi hello hola oye oiga melki please porfa so well um uh eh ah ya bueno listo vale dale y and".split(" "));

export type Deteccion = { idioma: Idioma | null; es: number; en: number };

/**
 * ¿En qué idioma está el texto? Cuenta las palabras propias de cada uno (y los signos «¿», «¡», la «ñ» y las tildes
 * del español; las contracciones del inglés). Decide solo con ventaja clara: con poco texto o mezclado devuelve null.
 * `quitar` saca antes lo que no cuenta (nombres de lugares y de nodos).
 */
export function detectarIdioma(texto: string, quitar?: (t: string) => string): Deteccion {
  let t = texto.normalize("NFC");
  if (quitar) t = quitar(t);
  let es = 0;
  let en = 0;
  if (/[¿¡]/.test(t)) es += 2;
  // La «ñ» y las tildes en palabras comunes (no en los nombres propios, que van con mayúscula)
  for (const p of t.match(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü']+/g) ?? []) {
    if (/[ñáéíóúü]/.test(p) && p === p.toLowerCase()) es += 1;
  }
  const bajo = t.toLowerCase();
  if (CONTRACCION.test(bajo)) en += 2;
  const palabras = bajo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/'[a-z]+/g, "")
    .match(/[a-z]+/g) ?? [];
  for (const p of palabras) {
    if (PALABRAS_ES.has(p)) es += 1;
    else if (PALABRAS_EN.has(p)) en += 1;
  }
  const decide = (a: number, b: number) => a >= 2 && a - b >= 2 && a >= b * 2;
  return { idioma: decide(en, es) ? "en" : decide(es, en) ? "es" : null, es, en };
}

/**
 * v17.3 · El idioma de una orden, también cuando es corta: si detectarIdioma no decide, decide el verbo con que empieza
 * cuando es de un solo idioma y no hay palabras del otro («Simulate», «apply the optimization» → inglés; «simula», «usa
 * SF10» → español). Con palabras que se usan en los dos idiomas («ok», «zoom», «gateway», «LoRa», «hello») sigue sin decidir.
 */
export function idiomaProbable(texto: string, quitar?: (t: string) => string): Idioma | null {
  const d = detectarIdioma(texto, quitar);
  if (d.idioma) return d.idioma;
  let t = texto.normalize("NFC");
  if (quitar) t = quitar(t);
  const palabras =
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/'[a-z]+/g, "")
      .match(/[a-z]+/g) ?? [];
  const resto = palabras.filter((p) => !ANTES_DEL_VERBO.has(p));
  const primera = resto[0];
  if (!primera) return null;
  // Un verbo solo es una orden si se hace sin más («Simulate», «deshaz»); «show», «mark» o «will» solos no dicen el idioma
  if (resto.length === 1 && !SOLAS_EN.has(primera) && !SOLAS_ES.has(primera)) return null;
  if (d.es === 0 && VERBOS_EN.has(primera)) return "en";
  if (d.en === 0 && VERBOS_ES.has(primera)) return "es";
  return null;
}

/* ───────────── Cambiar de idioma por pedido ───────────── */

/**
 * «Speak English», «switch to English», «en inglés», «habla en español», «Spanish please»: el idioma que se pide,
 * o null si no es un pedido de cambiar de idioma.
 */
export function pedidoDeIdioma(texto: string): Idioma | null {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:«»"()]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(melki|hey melki|hola melki|oye melki|ok melki)\s+/, "")
    .replace(/\s+(melki|please|por favor|porfa)$/, "")
    .trim();
  const INGLES = "(?:english|ingles|inglish|ingless|engl[ie]sh)";
  const ESPANOL = "(?:spanish|espanol|espanyol|espaniol|espanol|castellano|spanich)";
  const pide = (lengua: string) =>
    new RegExp(
      `^(?:(?:please |por favor )?(?:speak|talk|switch|change|go|answer|reply|respond|let'?s speak|let'?s talk|can you speak|could you speak|habla(?:me)?|hablemos|cambia(?:te)?|pasa(?:te)?|ponte|responde(?:me)?|contesta(?:me)?|puedes hablar|podrias hablar|quiero hablar|i want to speak|i'?d like to speak)(?: (?:to|in|into|en|a|al))? (?:the )?${lengua}(?: (?:language|please|idioma|por favor|now|ahora))?|(?:in|en) ${lengua}(?: (?:please|por favor))?|${lengua}(?: (?:please|por favor|mode|language|idioma))?|(?:el )?idioma ${lengua}|(?:modo|mode) ${lengua})$`,
    );
  if (pide(INGLES).test(t)) return "en";
  if (pide(ESPANOL).test(t)) return "es";
  return null;
}
