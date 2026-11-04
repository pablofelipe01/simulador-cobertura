// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// v17.3 · El inglés escrito o dictado con errores, como el español: lo que el reconocimiento de voz en inglés suele
// escribir mal en el simulador («repeat her» → «repeater», «gate way» → «gateway», «mesh tastic» → «Meshtastic») y los
// errores de tecleo de las palabras del simulador («simualte», «repaeter», «netwrok», «delte», «expotr»). Solo se
// corrigen palabras que no existen en inglés: «remote», «expert», «eight» o «weight» se quedan como están.

/** Lo que el reconocimiento de voz en inglés escribe mal (también vale escrito). */
const DICTADO: [RegExp, string][] = [
  [/\b(?:gate\s+way|gait\s*way|gateaway|gate-way)\b/gi, "gateway"],
  [/\b(?:gate\s+ways|gait\s*ways|gate-ways)\b/gi, "gateways"],
  [/\b(?:mesh|mash|mush|mess)[\s-]*(?:core|chore|cor|corps?)\b/gi, "MeshCore"],
  [/\b(?:mesh|mash|mush|mess)[\s-]*(?:tastic|tactic|tastik|tastics)\b/gi, "Meshtastic"],
  [/\b(?:star\s+link|star-link)\b/gi, "Starlink"],
  [/\b(?:whats\s+app|what's\s+app|what\s+sap)\b/gi, "WhatsApp"],
  [/\blow\s+ra\b|\blaura\b(?=\s+(?:network|mesh|radio|signal|node|nodes|modulation|range|gateway))/gi, "LoRa"],
  [/\b(?:s\s+f|ess\s+eff|es\s+ef|s-f)\s*(\d{1,2})\b/gi, "SF$1"],
  [/\bsf\s+(\d{1,2})\b/gi, "SF$1"],
  [/\b(?:hectors|hecktares|hectars|hectres|hecatres)\b/gi, "hectares"],
  [/\b(?:repeat\s+hers|repeat\s+ers|re\s+peters|repeters)\b/gi, "repeaters"],
  [/\b(?:repeat\s+her|repeat\s+er|re\s+peter|re-peater|repeter|repeator)\b/gi, "repeater"],
  [/\b(?:long\s+fast)\b/gi, "LongFast"],
  [/\b(?:long\s*(?:lee|ly|ley)\s*[-\s]?\s*rice)\b/gi, "Longley-Rice"],
  [/\b(?:d\s+b\s+m)\b/gi, "dBm"],
  [/\b(?:d\s+b\s+i)\b/gi, "dBi"],
  [/\bkilo\s+met(?:er|re)s\b/gi, "kilometers"],
  [/\bkilo\s+met(?:er|re)\b/gi, "kilometer"],
  [/\bt\s*(?:one\s+thousand|1000|thousand)\s*e\b/gi, "T1000-E"],
];

/**
 * Las palabras del simulador que se escriben mal al teclear rápido. De cada una salen sus errores de una sola tecla:
 * una letra de menos («repeter»), dos letras cambiadas de lugar («repaeter») o una letra repetida («repeaater»).
 */
const PALABRAS = (
  "simulate simulation simulations optimize optimization repeater repeaters gateway gateways network networks delete remove " +
  "export download coverage hectares people person signal height meters metres kilometers kilometres satellite terrain " +
  "topographic distance between around north south antenna antennas towers budget payments messages scenario example " +
  "populate design create rename duplicate connect everything everyone everybody reliability frequency protocol spreading " +
  "results pencil measure square please profile report stress optimise lower raise people simulator meshcore meshtastic " +
  "elevation hundred thousand million minutes seconds degrees latitude longitude northeast northwest southeast southwest " +
  "adjust apply select gateway relocate increase decrease capacity feasible sustainable municipality department"
).split(/\s+/);
/** Palabras de cuatro letras: solo dos letras cambiadas de lugar («mvoe», «shwo»). */
const CORTAS = "move show save load open undo zoom road roads east west".split(/\s+/);

/** Errores que no salen de una sola tecla pero se ven a menudo. */
const FRECUENTES: Record<string, string> = {
  similate: "simulate",
  simmulate: "simulate",
  simolate: "simulate",
  semulate: "simulate",
  simulte: "simulate",
  optimice: "optimize",
  optimse: "optimise",
  optimze: "optimize",
  repeeter: "repeater",
  repiter: "repeater",
  ripiter: "repeater",
  repetear: "repeater",
  reapter: "repeater",
  gatewey: "gateway",
  getway: "gateway",
  gatewya: "gateway",
  netwerk: "network",
  newtork: "network",
  delite: "delete",
  sattelite: "satellite",
  satelite: "satellite",
  satellit: "satellite",
  cuverage: "coverage",
  coverge: "coverage",
  frecuency: "frequency",
  pepole: "people",
  poeple: "people",
  peopel: "people",
  metters: "meters",
  kilometeres: "kilometers",
  kilomters: "kilometers",
  heigth: "height",
  hieght: "height",
  hight: "height",
  heigt: "height",
  distnace: "distance",
  wich: "which",
  whats: "what's",
  dont: "don't",
  doesnt: "doesn't",
  cant: "can't",
  isnt: "isn't",
};

/**
 * Palabras de verdad del inglés que quedan a una tecla de una del simulador: no se tocan (sin esta lista, «eight» se
 * volvería «height» y «remote», «remove»).
 */
const EXISTEN = new Set(
  (
    "eight weight rise arise rose ride rid rods reads rads road rode loads lads deign crate elect parson meter miters maters " +
    "pleas plea rule rules lover lowe owe mover remote motor expert sport port draw dawn tower towel toward " +
    "nets deft nest pole poles gale gate gates gaze ether neither wether whether net sign design deigns resign resin " +
    "result measures pencils sweat swear sear seat eats teas sate seta eta beat bean being beings lean leans seal deal dial " +
    "heal heat hate heights eights weights ten tens tea bud budge nudge budgets moments messes ages sages sage stage " +
    "examples ample sample simple persons prison poison parsons present pressure prose creates crated carte trace caret " +
    "react cater trade grade genre derange adjusts just dust must apple sleet elects conned cone cones done one ones none " +
    "nine mine fine wine line lines worth forth froth mouth youth sough tough though through thorough borough round ground " +
    "aground arouse grounds tween twee twine tine tin tins ton tons movie moves shows shoe shoes hows how howl owl saves " +
    "vase vases sea seas safe lord lords loud lode lado opens peon pen pens nope undue nod node nodes zoo zooms moo mood " +
    "rod roam roams dora eats wets stew stews " +
    // Palabras del español que no se tocan (el traductor las entiende tal cual)
    "antena antenas latitud longitud millon hectarea hectareas minuto segundo metro metros nudo " +
    // Y otras que existen en inglés
    "overage peron meres spading lease pease tress minuets altitude decease terran"
  ).split(/\s+/),
);

/** Los errores de una tecla de una palabra (sin las palabras que existen ni los que se confunden con otra palabra). */
function erroresDe(p: string, largo = true): string[] {
  const salida = new Set<string>();
  for (let i = 0; i < p.length - 1; i++) salida.add(p.slice(0, i) + p[i + 1] + p[i] + p.slice(i + 2));
  if (largo) {
    // Sin la «s» final queda el singular, que es otra palabra («payments» → «payment»)
    for (let i = 0; i < p.length; i++) if (!(i === p.length - 1 && p.endsWith("s"))) salida.add(p.slice(0, i) + p.slice(i + 1));
    for (let i = 0; i < p.length; i++) salida.add(p.slice(0, i + 1) + p[i] + p.slice(i + 1));
  }
  salida.delete(p);
  return [...salida];
}

let tabla: Map<string, string> | null = null;

/** Cada error de tecleo con su palabra (se arma una sola vez). */
function tablaErrores(): Map<string, string> {
  if (tabla) return tabla;
  const correctas = new Set([...PALABRAS, ...CORTAS]);
  const conteo = new Map<string, Set<string>>();
  const anotar = (error: string, bien: string) => {
    if (correctas.has(error) || EXISTEN.has(error) || error.length < 4) return;
    const s = conteo.get(error) ?? new Set<string>();
    s.add(bien);
    conteo.set(error, s);
  };
  for (const p of PALABRAS) if (p.length >= 5) for (const e of erroresDe(p)) anotar(e, p);
  for (const p of CORTAS) for (const e of erroresDe(p, false)) anotar(e, p);
  const t = new Map<string, string>();
  // Un error que puede venir de dos palabras no se corrige (no hay cómo saber cuál era)
  for (const [e, s] of conteo) if (s.size === 1) t.set(e, [...s][0]);
  for (const [e, bien] of Object.entries(FRECUENTES)) if (!correctas.has(e) || e !== bien) t.set(e, bien);
  for (const p of correctas) t.delete(p);
  tabla = t;
  return t;
}

/** La palabra corregida con la mayúscula de como se escribió («Simualte» → «Simulate»). */
const conForma = (original: string, bien: string) =>
  original === original.toUpperCase() && original.length > 1 ? bien.toUpperCase() : /^[A-Z]/.test(original) ? bien.charAt(0).toUpperCase() + bien.slice(1) : bien;

/**
 * El inglés escrito o dictado, sin los errores de siempre: lo que dicta mal el reconocimiento («repeat her», «gate way»,
 * «mesh tastic», «s f 10») y los errores de tecleo de las palabras del simulador. Los nombres de los nodos del mapa y lo
 * que va entre comillas no se tocan.
 */
export function corregirIngles(texto: string, nombres: string[] = []): string {
  let t = texto;
  for (const [re, por] of DICTADO) t = t.replace(re, por);
  const errores = tablaErrores();
  // Las palabras que son parte del nombre de un nodo («Rods 1») se respetan
  const deNombres = new Set(nombres.flatMap((n) => n.toLowerCase().split(/[^\p{L}]+/u)).filter(Boolean));
  // Nada dentro de comillas («call it "Netwrok"»). Las palabras con tilde o eñe van enteras: son del español («conectó»,
  // «El Cantón») y no se corrigen
  return t.replace(/(["“«][^"”»]*["”»])|(\p{L}+(?:'\p{L}+)?)/gu, (m, comillas: string | undefined, palabra: string | undefined) => {
    if (comillas || !palabra) return m;
    const k = palabra.toLowerCase();
    if (deNombres.has(k)) return m;
    const bien = errores.get(k);
    return bien ? conForma(palabra, bien) : m;
  });
}
